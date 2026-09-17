#!/usr/bin/env node
// BRAMUlab — Bloque 2: verificación contra un proyecto Supabase REAL
// (Auth, players/profiles/locations, RLS, RPCs is_username_available/complete_profile).
//
// Igual que supabase/tests/verify-rls.mjs (Bloque 1), esto NO es parte de la suite
// local (tests.html ni node --test): necesita red y las 2 migraciones de Bloque 1
// + la migración 20260916180000_bloque2_auth_profile_username_location.sql
// aplicadas, en ese orden, en un proyecto Supabase real (pensado para Staging).
//
// A diferencia de verify-rls.mjs (que solo prueba accesos anónimos), este script
// necesita también la SERVICE ROLE KEY para crear/borrar 2 cuentas de prueba
// reales vía el Admin API — nunca la pegues en el chat ni la commitees; se lee
// SOLO de una variable de entorno de esta terminal, y solo vos la tenés.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque2.mjs
//
// Qué comprueba:
//   - anon no puede leer profiles/locations/reserved_usernames/pilot_events;
//   - un usuario autenticado (verificado por el Admin API, email_confirm:true)
//     ya tiene su propia fila de players/profiles (trigger de la migración);
//   - un usuario autenticado puede leer SU propio profile, pero no puede
//     escribirlo directo (PATCH) ni leer el de otro usuario;
//   - is_username_available detecta reservados y usernames ya tomados;
//   - complete_profile: fija el username (falla con 'username_locked' si se
//     intenta cambiar, es idempotente si se repite igual), rechaza un
//     username ya usado por otra cuenta ('username_taken'), y arma la
//     ubicación (manual -> verified_for_ranking=false, GeoRef -> true);
//   - limpieza: borra las 2 cuentas de prueba y sus filas asociadas al final,
//     así el script se puede volver a correr sin ensuciar Staging.
//
// SUPABASE_ANON_KEY es la Publishable Key nueva de Supabase (prefijo
// sb_publishable_...), igual que en verify-rls.mjs/health.js: va en el header
// `apikey`, nunca en `Authorization: Bearer` (esa es para el JWT de sesión).

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque2.mjs');
  process.exit(1);
}

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`);
  return ok;
}

async function restAnon(path, init) {
  return fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: anonKey, ...(init && init.headers) } });
}

async function restAuthed(path, accessToken, init) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
}

async function rpc(fn, accessToken, body) {
  const res = await restAuthed(`rpc/${fn}`, accessToken, { method: 'POST', body: JSON.stringify(body || {}) });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

async function adminCreateConfirmedUser(email, password) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`adminCreateConfirmedUser(${email}) -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function adminDeleteUser(id) {
  if (!id) return;
  await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
}

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function serviceDelete(path) {
  return fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
}

// Base36 (no Date.now() decimal): un timestamp decimal de 13 dígitos ya deja los usernames de
// abajo pegados al límite de 24 caracteres del formato vigente ([a-z0-9._]{3,24}) — el sufijo
// "_otro" del test de username_locked o el prefijo más largo de georefUsername alcanzaban para
// pasarse, y entonces el servidor rechazaba por username_invalid_format antes de poder probar lo
// que el test quería (username_locked / la ubicación GeoRef). Base36 da ~8 caracteres para el
// mismo instante y usa solo [a-z0-9], así que nunca hace falta pensar en el charset.
const stamp = Date.now().toString(36);
const userA = { email: `bramu-verify-b2-a-${stamp}@example.com`, password: 'Verificar#Bloque2!' };
const userB = { email: `bramu-verify-b2-b-${stamp}@example.com`, password: 'Verificar#Bloque2!' };
const cleanup = { authIds: [], playerIds: [], locationIds: [] };

async function main() {
  // --- 1) anon no puede leer nada de Bloque 2 ---
  for (const path of ['profiles?select=player_id', 'locations?select=location_id', 'reserved_usernames?select=username', 'pilot_events?select=event_id']) {
    const res = await restAnon(path);
    let body = null;
    try { body = await res.json(); } catch { /* sin cuerpo */ }
    const emptySelect = res.ok && Array.isArray(body) && body.length === 0;
    const rejected = res.status === 401 || res.status === 403 || res.status === 404;
    report(`anon: lectura de ${path.split('?')[0]} debe volver vacía o rechazada`, emptySelect || rejected, `status ${res.status}`);
  }

  // --- 2) crear 2 cuentas de prueba ya verificadas (dispara el trigger) ---
  const createdA = await adminCreateConfirmedUser(userA.email, userA.password);
  const createdB = await adminCreateConfirmedUser(userB.email, userB.password);
  cleanup.authIds.push(createdA.id, createdB.id);

  const sessionA = await signIn(userA.email, userA.password);
  const sessionB = await signIn(userB.email, userB.password);
  const tokenA = sessionA.access_token;
  const tokenB = sessionB.access_token;

  // --- 3) el trigger ya creó players+profiles; el propio usuario los puede leer ---
  const ownProfileRes = await restAuthed('profiles?select=player_id,username', tokenA);
  const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
  const hasOwnIncompleteProfile = Array.isArray(ownProfileRows) && ownProfileRows.length === 1 && ownProfileRows[0].username === null;
  report('trigger: usuario recién verificado ya tiene profile propio (username null)', hasOwnIncompleteProfile, JSON.stringify(ownProfileRows));
  const playerIdA = hasOwnIncompleteProfile ? ownProfileRows[0].player_id : null;
  if (playerIdA) cleanup.playerIds.push(playerIdA);

  // --- 4) no se puede escribir profiles directo (sin policy de update) ---
  const directPatch = await restAuthed(`profiles?player_id=eq.${playerIdA}`, tokenA, {
    method: 'PATCH', body: JSON.stringify({ username: 'deberia-fallar' }),
  });
  report('RLS: PATCH directo sobre profiles debe ser rechazado', directPatch.status === 401 || directPatch.status === 403 || directPatch.status === 404, `status ${directPatch.status}`);

  // --- 5) is_username_available ---
  const reservedCheck = await rpc('is_username_available', tokenA, { p_username: 'admin' });
  report('is_username_available: "admin" (reservado) -> false', reservedCheck.res.ok && reservedCheck.json === false, JSON.stringify(reservedCheck.json));

  // "vb2_" + ~8 chars de stamp + el sufijo más largo usado más abajo ("_otro", 5 chars) queda
  // bien lejos de los 24 del formato vigente — ver el comentario de `stamp` más arriba.
  const freeUsername = `vb2_${stamp}`;
  const freeCheck = await rpc('is_username_available', tokenA, { p_username: freeUsername });
  report(`is_username_available: "${freeUsername}" (libre) -> true`, freeCheck.res.ok && freeCheck.json === true, JSON.stringify(freeCheck.json));

  // --- 6) complete_profile con ubicación MANUAL -> verified_for_ranking=false ---
  const manualProfilePayload = {
    p_username: freeUsername,
    p_first_name: 'Verificación',
    p_last_name: 'Bloque2',
    p_display_name: 'Verificación B2',
    p_birth_date: '1990-01-01',
    p_gender: 'prefiero-no-decir',
    p_dominant_hand: 'derecha',
    p_preferred_side: 'indiferente',
    p_competitive_branch: 'M',
    p_location_country_code: 'AR',
    p_location_province_label: 'Provincia De Prueba',
    p_location_locality_label: `Localidad Manual ${stamp}`,
  };
  const completeManual = await rpc('complete_profile', tokenA, manualProfilePayload);
  report('complete_profile: alta con ubicación manual', completeManual.res.ok, completeManual.res.ok ? '' : JSON.stringify(completeManual.json));
  const manualLocationId = completeManual.res.ok ? completeManual.json.location_id : null;
  if (manualLocationId) cleanup.locationIds.push(manualLocationId);

  if (manualLocationId) {
    const locRes = await restAuthed(`locations?location_id=eq.${manualLocationId}&select=source,verified_for_ranking`, tokenA);
    const locRows = locRes.ok ? await locRes.json() : null;
    const manualUnverified = Array.isArray(locRows) && locRows[0] && locRows[0].source === 'manual' && locRows[0].verified_for_ranking === false;
    report('ubicación manual queda verified_for_ranking=false', manualUnverified, JSON.stringify(locRows));
  }

  // --- 7) username_locked al intentar cambiar el username ya fijado ---
  const relock = await rpc('complete_profile', tokenA, { ...manualProfilePayload, p_username: `${freeUsername}_otro` });
  const lockedOk = !relock.res.ok && relock.json && relock.json.message === 'username_locked';
  report('complete_profile: cambiar username ya fijado -> username_locked', lockedOk, JSON.stringify(relock.json));

  // --- 8) idempotencia: repetir el MISMO username no falla ---
  const repeatSame = await rpc('complete_profile', tokenA, manualProfilePayload);
  report('complete_profile: repetir el mismo username es idempotente', repeatSame.res.ok, repeatSame.res.ok ? '' : JSON.stringify(repeatSame.json));

  // --- 9) username_taken: otra cuenta no puede usar el mismo username ---
  const takenAttempt = await rpc('complete_profile', tokenB, { ...manualProfilePayload, p_username: freeUsername });
  const takenOk = !takenAttempt.res.ok && takenAttempt.json && takenAttempt.json.message === 'username_taken';
  report('complete_profile: username ya usado por otra cuenta -> username_taken', takenOk, JSON.stringify(takenAttempt.json));

  // registrar el player/location de userB si su intento fallido igual dejó su propio profile creado por el trigger
  const ownProfileBRes = await restAuthed('profiles?select=player_id', tokenB);
  const ownProfileBRows = ownProfileBRes.ok ? await ownProfileBRes.json() : null;
  const playerIdB = Array.isArray(ownProfileBRows) && ownProfileBRows[0] ? ownProfileBRows[0].player_id : null;
  if (playerIdB) cleanup.playerIds.push(playerIdB);

  // --- 10) RLS: userB no puede leer el profile de userA ---
  const crossRead = await restAuthed(`profiles?select=player_id&player_id=eq.${playerIdA}`, tokenB);
  const crossReadRows = crossRead.ok ? await crossRead.json() : null;
  report('RLS: un usuario no puede leer el profile de otro', crossRead.ok && Array.isArray(crossReadRows) && crossReadRows.length === 0, JSON.stringify(crossReadRows));

  // --- 11) ubicación GeoRef (con IDs canónicos) -> verified_for_ranking=true ---
  const georefUsername = `vb2geo_${stamp}`;
  const georefPayload = {
    p_username: georefUsername,
    p_first_name: 'Verificación',
    p_last_name: 'GeoRef',
    p_display_name: 'Verificación GeoRef',
    p_birth_date: '1990-01-01',
    p_gender: null,
    p_dominant_hand: null,
    p_preferred_side: null,
    p_competitive_branch: 'F',
    p_location_country_code: 'AR',
    p_location_province_label: 'Ciudad Autónoma de Buenos Aires',
    p_location_locality_label: 'Palermo',
    p_location_georef_province_id: '02',
    p_location_georef_locality_id: `test-${stamp}`,
  };
  const completeGeoref = await rpc('complete_profile', tokenB, georefPayload);
  report('complete_profile: alta con ubicación GeoRef', completeGeoref.res.ok, completeGeoref.res.ok ? '' : JSON.stringify(completeGeoref.json));
  const georefLocationId = completeGeoref.res.ok ? completeGeoref.json.location_id : null;
  if (georefLocationId) cleanup.locationIds.push(georefLocationId);

  if (georefLocationId) {
    const locRes = await restAuthed(`locations?location_id=eq.${georefLocationId}&select=source,verified_for_ranking`, tokenB);
    const locRows = locRes.ok ? await locRes.json() : null;
    const georefVerified = Array.isArray(locRows) && locRows[0] && locRows[0].source === 'georef' && locRows[0].verified_for_ranking === true;
    report('ubicación GeoRef queda verified_for_ranking=true', georefVerified, JSON.stringify(locRows));
  }

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed ? 'BLOQUE 2 OK: Auth/perfil/username/ubicación se comportan como espera Backend_Infraestructura.md.' : 'BLOQUE 2: hay fallas — revisar antes de cerrar el bloque.');
  return allPassed;
}

async function cleanupAll() {
  // Orden importa por las FK: pilot_events.player_id y profiles.location_id
  // no tienen ON DELETE CASCADE hacia locations (players -> profiles sí lo
  // tiene). Borrar en este orden evita foreign_key_violation:
  //   1) pilot_events (referencia players, sin cascade)
  //   2) players (cascada a profiles, que es lo único que referenciaba locations)
  //   3) locations (ya sin ningún profile apuntándole)
  //   4) las cuentas de Auth de prueba
  console.log('\nLimpiando cuentas y filas de prueba...');
  for (const id of cleanup.playerIds) await serviceDelete(`pilot_events?player_id=eq.${id}`);
  for (const id of cleanup.playerIds) await serviceDelete(`players?player_id=eq.${id}`);
  for (const id of cleanup.locationIds) await serviceDelete(`locations?location_id=eq.${id}`);
  for (const id of cleanup.authIds) await adminDeleteUser(id);
  console.log('Limpieza terminada.');
}

let exitCode = 1;
try {
  exitCode = (await main()) ? 0 : 1;
} catch (err) {
  console.error('\nError durante la verificación:', err);
  exitCode = 1;
} finally {
  await cleanupAll();
}
process.exit(exitCode);
