#!/usr/bin/env node
// BRAMUlab — Bloque 3: verificación contra un proyecto Supabase REAL
// (perfil mínimo relajado, level_states/level_events, RPC privada
// officialize_level_onboarding, Edge Function officialize-onboarding).
//
// Igual que verify-bloque2.mjs, esto NO es parte de la suite local (tests.html): necesita red,
// las migraciones de Bloque 1+2 y la migración 20260919120000_bloque3_nivel_persistente.sql
// aplicadas en ese orden, Y la Edge Function ya desplegada:
//   supabase functions deploy officialize-onboarding
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY (Publishable Key) y SUPABASE_SERVICE_ROLE_KEY —
// misma nota de seguridad que verify-bloque2.mjs: nunca las pegues en el chat, se leen solo de
// variables de entorno de esta terminal.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque3.mjs
//
// Qué comprueba (ver docs/BRAMUlab/Implementacion/Backend/Bloque_03/03_Revision_ChatGPT.md):
//   §3  — level_states nace en PENDIENTE apenas el trigger corre (email confirmado), incluso
//         ANTES de llamar a complete_profile/officialize (confirmación anticipada);
//   §4  — complete_profile acepta perfil mínimo SIN competitive_branch ni ubicación;
//   §6  — is_username_available responde también sin sesión (anon) y la oficialización vuelve
//         a validar el username en el momento (carrera: queda ocupado entre medio);
//   §2/§9 — officialize_level_onboarding (RPC privada) NO es alcanzable con el token del
//         propio usuario (solo service_role, vía la Edge Function) — un intento directo debe
//         ser rechazado;
//   §9  — oficialización vía Edge Function: camino rápido y completo producen level_states
//         CALIBRANDO con mu/confidence/versión coherentes; reintentar con el MISMO payload o
//         con uno DISTINTO después de un éxito no recalcula ni duplica level_events (el
//         índice único parcial + el guard de status lo garantizan);
//   RLS — un usuario no puede leer level_states/level_events de otra cuenta.
//
// Fixtures de camino rápido usados acá (arbitrarios pero fijos, no son los nombrados de
// Nivel_BRAMU_Implementacion.md §6 — la paridad exacta con esos fixtures ya la cubre
// bramulab/tests.html + verify-nivel-parity.mjs): seedKey='intermedio', sin mapa de categoría
// (categoryContextKey=null, coherente con que el alta real ya no pide género/localidad — ver
// Bloque 3 §D del informe), declaredCategory='4'.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque3.mjs');
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

async function rpcAs(accessToken, apiKeyForHeader, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: apiKeyForHeader, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

async function callEdgeFunction(accessToken, body) {
  const res = await fetch(`${url}/functions/v1/officialize-onboarding`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
  if (!id) return true;
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  return res.ok;
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

// BRAMUlab_Backlog.md §2 — a diferencia de verify-bloque2.mjs (cuya limpieza nunca revisaba el
// resultado del DELETE), acá SÍ se comprueba `.ok` en cada borrado de service_role y se avisa
// si algo no se pudo limpiar, en vez de fallar en silencio.
async function serviceDelete(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
  return res.ok;
}

const stamp = Date.now().toString(36);
const userA = { email: `bramu-verify-b3-a-${stamp}@example.com`, password: 'Verificar#Bloque3!' };
const userB = { email: `bramu-verify-b3-b-${stamp}@example.com`, password: 'Verificar#Bloque3!' };
const cleanup = { authIds: [], playerIds: [] };

const QUICK_PAYLOAD_A = { mode: 'quick', quickSeedKey: 'intermedio', categoryContextKey: null, declaredCategory: '4' };
const FULL_PAYLOAD_B = {
  mode: 'full',
  quizAnswers: {
    autoevaluacion: 'intermedio_alto', anos: 'uno_a_cinco', entrenamiento: 'sin_continuidad',
    frecuencia: 'una_dos_semana', competicion: 'sin_referencia', red: 'c', paredes: 'c',
  },
  categoryContextKey: null,
  declaredCategory: '5',
};

async function main() {
  // --- 1) crear cuenta A ya confirmada (dispara el trigger) ---
  const createdA = await adminCreateConfirmedUser(userA.email, userA.password);
  cleanup.authIds.push(createdA.id);
  const sessionA = await signIn(userA.email, userA.password);
  const tokenA = sessionA.access_token;

  const ownProfileRes = await restAuthed('profiles?select=player_id', tokenA);
  const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
  const playerIdA = Array.isArray(ownProfileRows) && ownProfileRows[0] ? ownProfileRows[0].player_id : null;
  if (playerIdA) cleanup.playerIds.push(playerIdA);

  // --- 2) §3/§8: level_states nace PENDIENTE apenas confirma el email, ANTES de perfil/Nivel ---
  const levelStateEarlyRes = await restAuthed('level_states?select=status', tokenA);
  const levelStateEarlyRows = levelStateEarlyRes.ok ? await levelStateEarlyRes.json() : null;
  const isPendingEarly = Array.isArray(levelStateEarlyRows) && levelStateEarlyRows.length === 1 && levelStateEarlyRows[0].status === 'PENDIENTE';
  report('trigger: level_states nace PENDIENTE apenas se confirma el email (antes de oficializar)', isPendingEarly, JSON.stringify(levelStateEarlyRows));

  // --- 3) §4: complete_profile con perfil MÍNIMO, sin competitive_branch ni ubicación ---
  const minimalUsername = `vb3_${stamp}`;
  const minimalProfile = await rpcAs(tokenA, anonKey, 'complete_profile', {
    p_username: minimalUsername, p_first_name: 'Verificación', p_last_name: 'Bloque3',
    p_display_name: 'Verificación', p_birth_date: null, p_gender: null, p_dominant_hand: null,
    p_preferred_side: null, p_competitive_branch: null, p_location_country_code: null,
    p_location_province_label: null, p_location_locality_label: null, p_terms_version: 'piloto_v1',
  });
  report('complete_profile: perfil mínimo sin rama/ubicación ya NO falla', minimalProfile.res.ok, minimalProfile.res.ok ? '' : JSON.stringify(minimalProfile.json));

  // --- 4) §2/§9: la RPC de persistencia NO es alcanzable con el token del propio usuario ---
  const directRpcAttempt = await rpcAs(tokenA, anonKey, 'officialize_level_onboarding', {
    p_auth_user_id: createdA.id, p_algorithm_version: 'nivel_bramu_v1_0', p_questionnaire_version: 'nivel_inicial_v1_1',
    p_questionnaire_mode: 'quick', p_mu: 9.9, p_confidence: 0.9, p_declared_category: '1',
    p_category_context_key: null, p_input_context: {}, p_result: {},
  });
  const directRpcBlocked = !directRpcAttempt.res.ok && (directRpcAttempt.res.status === 401 || directRpcAttempt.res.status === 403 || directRpcAttempt.res.status === 404);
  report('seguridad: officialize_level_onboarding rechaza el token del propio usuario (solo service_role)', directRpcBlocked, `status ${directRpcAttempt.res.status} ${JSON.stringify(directRpcAttempt.json)}`);

  // --- 5) oficialización real vía Edge Function (camino rápido) ---
  const officialize1 = await callEdgeFunction(tokenA, QUICK_PAYLOAD_A);
  const officialize1Ok = officialize1.res.ok && officialize1.json && officialize1.json.ok && officialize1.json.levelState && officialize1.json.levelState.status === 'CALIBRANDO';
  report('officialize-onboarding (camino rápido): pasa a CALIBRANDO con mu/confidence', officialize1Ok, JSON.stringify(officialize1.json));
  const muFirst = officialize1Ok ? officialize1.json.levelState.mu : null;

  // --- 6) idempotencia: mismo payload de nuevo -> mismo resultado, sin duplicar evento ---
  const officialize2 = await callEdgeFunction(tokenA, QUICK_PAYLOAD_A);
  const sameResult = officialize2.res.ok && officialize2.json && officialize2.json.ok && officialize2.json.levelState && officialize2.json.levelState.mu === muFirst;
  report('idempotencia: reintentar el mismo payload devuelve el mismo mu (no recalcula)', sameResult, JSON.stringify(officialize2.json));

  // --- 7) idempotencia: payload MUY DISTINTO después de oficializar -> NO sobrescribe.
  // 'profesional' produciría un mu bien distinto a 'intermedio' si de verdad recalculara —
  // exactamente lo que este chequeo necesita para no pasar "por casualidad".
  const officialize3 = await callEdgeFunction(tokenA, { ...QUICK_PAYLOAD_A, quickSeedKey: 'profesional', declaredCategory: '1' });
  const notOverwritten = officialize3.res.ok && officialize3.json && officialize3.json.ok && officialize3.json.levelState && officialize3.json.levelState.mu === muFirst;
  report('idempotencia: un payload MUY distinto tras oficializar NO sobrescribe el resultado oficial', notOverwritten, JSON.stringify(officialize3.json));

  const eventsRes = await restAuthed(`level_events?select=event_id&player_id=eq.${playerIdA}`, tokenA);
  const eventsRows = eventsRes.ok ? await eventsRes.json() : null;
  report('idempotencia: exactamente 1 level_event initial_estimate para este jugador (no se duplicó)', Array.isArray(eventsRows) && eventsRows.length === 1, JSON.stringify(eventsRows));

  // --- 8) cuenta B: username ocupado durante la oficialización (carrera de @usuario) ---
  const createdB = await adminCreateConfirmedUser(userB.email, userB.password);
  cleanup.authIds.push(createdB.id);
  const sessionB = await signIn(userB.email, userB.password);
  const tokenB = sessionB.access_token;
  const ownProfileBRes = await restAuthed('profiles?select=player_id', tokenB);
  const ownProfileBRows = ownProfileBRes.ok ? await ownProfileBRes.json() : null;
  const playerIdB = Array.isArray(ownProfileBRows) && ownProfileBRows[0] ? ownProfileBRows[0].player_id : null;
  if (playerIdB) cleanup.playerIds.push(playerIdB);

  const usernameTakenAttempt = await rpcAs(tokenB, anonKey, 'complete_profile', {
    p_username: minimalUsername, p_first_name: 'Otro', p_last_name: 'Jugador',
    p_display_name: 'Otro', p_birth_date: null, p_gender: null, p_dominant_hand: null,
    p_preferred_side: null, p_competitive_branch: null, p_location_country_code: null,
    p_location_province_label: null, p_location_locality_label: null, p_terms_version: 'piloto_v1',
  });
  const usernameTakenOk = !usernameTakenAttempt.res.ok && usernameTakenAttempt.json && usernameTakenAttempt.json.message === 'username_taken';
  report('§6: username ya tomado durante la oficialización -> username_taken (no toca Nivel)', usernameTakenOk, JSON.stringify(usernameTakenAttempt.json));

  const levelStateBStillPending = await restAuthed('level_states?select=status', tokenB);
  const levelStateBRows = levelStateBStillPending.ok ? await levelStateBStillPending.json() : null;
  report('§6: tras username_taken, level_states de la cuenta B sigue PENDIENTE (nada se tocó)', Array.isArray(levelStateBRows) && levelStateBRows[0] && levelStateBRows[0].status === 'PENDIENTE', JSON.stringify(levelStateBRows));

  // Ahora con un username libre, cuenta B sigue de punta a punta (camino completo)
  const freeUsernameB = `vb3b_${stamp}`;
  const profileB = await rpcAs(tokenB, anonKey, 'complete_profile', {
    p_username: freeUsernameB, p_first_name: 'Otro', p_last_name: 'Jugador',
    p_display_name: 'Otro', p_birth_date: null, p_gender: null, p_dominant_hand: null,
    p_preferred_side: null, p_competitive_branch: null, p_location_country_code: null,
    p_location_province_label: null, p_location_locality_label: null, p_terms_version: 'piloto_v1',
  });
  report('complete_profile: cuenta B con @usuario libre sí funciona', profileB.res.ok, profileB.res.ok ? '' : JSON.stringify(profileB.json));

  const officializeB = await callEdgeFunction(tokenB, FULL_PAYLOAD_B);
  const officializeBOk = officializeB.res.ok && officializeB.json && officializeB.json.ok && officializeB.json.levelState && officializeB.json.levelState.status === 'CALIBRANDO';
  report('officialize-onboarding (camino completo): pasa a CALIBRANDO', officializeBOk, JSON.stringify(officializeB.json));

  // --- 9) RLS: B no puede leer los level_states/level_events de A ---
  const crossReadStates = await restAuthed(`level_states?select=player_id&player_id=eq.${playerIdA}`, tokenB);
  const crossReadStatesRows = crossReadStates.ok ? await crossReadStates.json() : null;
  report('RLS: un usuario no puede leer level_states de otro', crossReadStates.ok && Array.isArray(crossReadStatesRows) && crossReadStatesRows.length === 0, JSON.stringify(crossReadStatesRows));

  const crossReadEvents = await restAuthed(`level_events?select=event_id&player_id=eq.${playerIdA}`, tokenB);
  const crossReadEventsRows = crossReadEvents.ok ? await crossReadEvents.json() : null;
  report('RLS: un usuario no puede leer level_events de otro', crossReadEvents.ok && Array.isArray(crossReadEventsRows) && crossReadEventsRows.length === 0, JSON.stringify(crossReadEventsRows));

  // --- 10) anon: is_username_available funciona sin sesión (§6) ---
  const anonUsernameCheck = await fetch(`${url}/rest/v1/rpc/is_username_available`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_username: `vb3_libre_${stamp}` }),
  });
  const anonUsernameJson = anonUsernameCheck.ok ? await anonUsernameCheck.json() : null;
  report('§6: is_username_available responde también sin sesión (anon)', anonUsernameCheck.ok && anonUsernameJson === true, `status ${anonUsernameCheck.status} -> ${JSON.stringify(anonUsernameJson)}`);

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed ? 'BLOQUE 3 OK: level_states/level_events/officialize-onboarding se comportan como espera 03_Revision_ChatGPT.md.' : 'BLOQUE 3: hay fallas — revisar antes de cerrar el bloque.');
  return allPassed;
}

async function cleanupAll() {
  console.log('\nLimpiando cuentas y filas de prueba...');
  for (const id of cleanup.playerIds) {
    const okEvents = await serviceDelete(`level_events?player_id=eq.${id}`);
    const okStates = await serviceDelete(`level_states?player_id=eq.${id}`);
    const okPilot = await serviceDelete(`pilot_events?player_id=eq.${id}`);
    const okPlayers = await serviceDelete(`players?player_id=eq.${id}`);
    if (!okEvents || !okStates || !okPilot || !okPlayers) {
      console.warn(`ATENCIÓN: la limpieza de player_id=${id} pudo no haberse completado del todo (events=${okEvents} states=${okStates} pilot=${okPilot} players=${okPlayers}) — revisar a mano en Staging.`);
    }
  }
  for (const id of cleanup.authIds) {
    const ok = await adminDeleteUser(id);
    if (!ok) console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${id} — revisar a mano en Staging.`);
  }
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
