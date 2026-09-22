#!/usr/bin/env node
// BRAMUlab — Bloque 7, Fase 1 (corrección): verificación contra un proyecto Supabase REAL de
// las 4 migraciones de esquema/hardening (20260922100000 .. 20260922130000).
//
// Igual que verify-bloque2/3/4/5/6.mjs, esto NO es parte de la suite local (tests.html): necesita
// red y las 4 migraciones de Fase 1 aplicadas en orden. NO ejercita ninguna función de cálculo
// semanal (no existe todavía — Fase 2) ni ninguna RPC de lectura de Ranking (Fase 3).
//
// ENTREGADO SIN EJECUTAR: esta ronda de Claude Code no tiene autorización para tocar Supabase
// Staging real (docs/BRAMUlab/Implementacion/Backend/Bloque_07/05_Revision_Central_Fase_1.md,
// 06_Correccion_Fase_1_Claude.md) — ni siquiera para aplicar las migraciones que este script
// necesita. Es el punto de partida para la verificación real que hace Fase central después de
// aplicar la migración, antes de decidir si Fase 1 queda apta.
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY (Publishable Key) y SUPABASE_SERVICE_ROLE_KEY — nunca
// las pegues en el chat, se leen solo de variables de entorno de esta terminal.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque7-fase1.mjs
//
// Qué comprueba (05_Revision_Central_Fase_1.md, uno por corrección):
//   F1-C01 — anon NO puede ejecutar complete_ranking_profile_data (PUBLIC revocado).
//   F1-C02 — service_role puede SELECT/INSERT pero NO UPDATE/DELETE sobre ranking_editions,
//            ranking_rows y location_change_events (siguen append-only incluso con los default
//            privileges del proyecto).
//   F1-C03 — complete_profile ya NO puede cambiar location_id/competitive_branch de una cuenta
//            que ya los completó vía complete_ranking_profile_data (bypass cerrado).
//   F1-C04 — dos llamadas concurrentes de complete_ranking_profile_data para el MISMO jugador
//            quedan serializadas (FOR UPDATE): como máximo una queda como alta/cambio real,
//            location_change_events nunca termina con dos filas para un único cambio.
//            Cooldown de 30 días también se prueba en el caso simple (no concurrente).
//   F1-C05/F1-C06 — constraints nuevas de ranking_rows: eligibility_reason_codes siempre array,
//            sin motivo residual si is_eligible=true, position/tie_group positivos y coincidentes,
//            total_eligible >= 0, Nivel dentro de escala 1-10, y el unique
//            (edition_id, scope_type, player_id) — con un control positivo (fila válida y
//            segundo scope_type del mismo jugador) para confirmar que no bloquea casos legítimos.
//
// No se declara ninguna corrida de este script como "validada contra Supabase real" salvo que
// realmente se haya ejecutado con las 3 variables de entorno contra un proyecto real.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque7-fase1.mjs');
  process.exit(1);
}

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`);
  return ok;
}

async function rpcAs(accessToken, fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

async function rpcAsAnon(fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    // apikey=anonKey y SIN Authorization: exactamente cómo pega un cliente no autenticado
    // (nunca reusar rpcAs con la anon key como token: eso todavía manda un JWT válido de rol
    // authenticated si existiera; acá no debe existir ningún JWT).
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
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

async function signIn(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) -> HTTP ${res.status}: ${await res.text()}`);
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

async function serviceGet(pathAndQuery) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  return res.ok ? res.json() : null;
}

async function serviceInsert(pathAndQuery, body) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
}

async function servicePatch(pathAndQuery, body) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function serviceDelete(pathAndQuery) {
  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
  return res.ok;
}

function isPermissionDenied(res, json) {
  // PostgREST puede devolver 401/403 según versión/configuración, o 400 con el SQLSTATE
  // 42501 (insufficient_privilege) en el cuerpo — se acepta cualquiera de las formas reales.
  if (res.status === 401 || res.status === 403) return true;
  const code = json && (json.code || json.error);
  const message = (json && json.message) || '';
  return code === '42501' || /permission denied/i.test(message);
}

async function ensureMinimalProfile(accessToken, username) {
  // Perfil mínimo real (Bloque 2/3), SIN ubicación/rama — mismo payload que manda hoy
  // bramulab/auth.js:completeProfile en producción (ver F1-C03 en
  // 20260922120000_bloque7_fase1_security_hardening.sql). No se oficializa Nivel: estos tests
  // no lo necesitan.
  await rpcAs(accessToken, 'complete_profile', {
    p_username: username, p_first_name: username, p_last_name: 'Verify7', p_display_name: username,
    p_birth_date: null, p_gender: null, p_dominant_hand: null, p_preferred_side: null,
    p_competitive_branch: null, p_location_country_code: null, p_location_province_label: null,
    p_location_locality_label: null, p_location_georef_province_id: null, p_location_georef_locality_id: null,
    p_terms_version: 'v1',
  });
}

async function ownPlayerId(accessToken) {
  const res = await fetch(`${url}/rest/v1/profiles?select=player_id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const rows = res.ok ? await res.json() : null;
  return Array.isArray(rows) && rows[0] ? rows[0].player_id : null;
}

async function main() {
  const stamp = Date.now().toString(36);
  const authIds = [];
  const playerIds = [];
  const locationIds = [];
  const rankingRowIds = [];
  const editionIds = [];

  // 2 cuentas reales: una para bypass/cooldown simple, otra para la carrera concurrente.
  const accounts = {};
  for (const key of ['p1', 'p2']) {
    const email = `bramu-verify7-${key}-${stamp}@example.com`;
    const password = 'Verificar#Bloque7!';
    const created = await adminCreateConfirmedUser(email, password);
    authIds.push(created.id);
    const session = await signIn(email, password);
    const username = `v7${key}${stamp}`.slice(0, 20);
    await ensureMinimalProfile(session.access_token, username);
    const playerId = await ownPlayerId(session.access_token);
    if (playerId) playerIds.push(playerId);
    accounts[key] = { email, password, accessToken: session.access_token, playerId };
  }

  // ------------------------------------------------------------------
  // F1-C01 — anon sin EXECUTE sobre complete_ranking_profile_data
  // ------------------------------------------------------------------
  const anonAttempt = await rpcAsAnon('complete_ranking_profile_data', {
    p_competitive_branch: 'M', p_ranking_opt_in: true, p_location_country_code: 'AR',
    p_location_province_label: 'Buenos Aires', p_location_locality_label: 'Bella Vista',
  });
  report(
    'F1-C01: anon no puede ejecutar complete_ranking_profile_data',
    !anonAttempt.res.ok && isPermissionDenied(anonAttempt.res, anonAttempt.json),
    `status=${anonAttempt.res.status} body=${JSON.stringify(anonAttempt.json)}`,
  );

  // ------------------------------------------------------------------
  // F1-C02 — append-only real para service_role
  // ------------------------------------------------------------------
  const monday = new Date('2026-09-28T03:00:00.000Z'); // lunes 00:00 Buenos Aires (UTC-3)
  const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);
  const editionIns = await serviceInsert('ranking_editions', {
    period_start_at: monday.toISOString(), period_end_at: sunday.toISOString(),
  });
  const edition = Array.isArray(editionIns.json) ? editionIns.json[0] : null;
  report('setup: ranking_editions admite INSERT de service_role', editionIns.res.ok && !!edition, JSON.stringify(editionIns.json));
  if (edition) editionIds.push(edition.edition_id);

  if (edition) {
    const editionPatch = await servicePatch(`ranking_editions?edition_id=eq.${edition.edition_id}`, { ranking_rules_version: 'tampered' });
    report('F1-C02: service_role NO puede UPDATE ranking_editions', editionPatch === false);
    const editionDelete = await serviceDelete(`ranking_editions?edition_id=eq.${edition.edition_id}`);
    report('F1-C02: service_role NO puede DELETE ranking_editions', editionDelete === false);
    const stillThere = await serviceGet(`ranking_editions?edition_id=eq.${edition.edition_id}&select=ranking_rules_version`);
    report(
      'F1-C02: la fila de ranking_editions quedó exactamente igual',
      Array.isArray(stillThere) && stillThere[0] && stillThere[0].ranking_rules_version === 'ranking_v1',
      JSON.stringify(stillThere),
    );
  }

  if (edition && playerIds[0]) {
    const rowIns = await serviceInsert('ranking_rows', {
      edition_id: edition.edition_id, player_id: playerIds[0], scope_type: 'local', scope_key: `f1c02-${stamp}`,
      is_eligible: false, total_eligible: 3, density_status: 'insufficient',
      eligibility_reason_codes: ['location_missing'], ranking_rules_version: 'ranking_v1',
    });
    const row = Array.isArray(rowIns.json) ? rowIns.json[0] : null;
    report('setup: ranking_rows admite INSERT de service_role', rowIns.res.ok && !!row, JSON.stringify(rowIns.json));
    if (row) {
      rankingRowIds.push(row.row_id);
      const rowPatch = await servicePatch(`ranking_rows?row_id=eq.${row.row_id}`, { total_eligible: 99 });
      report('F1-C02: service_role NO puede UPDATE ranking_rows', rowPatch === false);
      const rowDelete = await serviceDelete(`ranking_rows?row_id=eq.${row.row_id}`);
      report('F1-C02: service_role NO puede DELETE ranking_rows', rowDelete === false);
    }
  }

  const seedLocIns = await serviceInsert('locations', {
    country_code: 'AR', source: 'manual', province_label: 'ProvinciaF1C02', locality_label: 'LocalidadF1C02',
    display_label: 'LocalidadF1C02, ProvinciaF1C02', verified_for_ranking: false,
  });
  const seedLoc = Array.isArray(seedLocIns.json) ? seedLocIns.json[0] : null;
  if (seedLoc) locationIds.push(seedLoc.location_id);
  if (seedLoc && playerIds[0]) {
    const evIns = await serviceInsert('location_change_events', {
      player_id: playerIds[0], change_type: 'initial', new_location_id: seedLoc.location_id,
    });
    const ev = Array.isArray(evIns.json) ? evIns.json[0] : null;
    report('setup: location_change_events admite INSERT de service_role', evIns.res.ok && !!ev, JSON.stringify(evIns.json));
    if (ev) {
      const evPatch = await servicePatch(`location_change_events?event_id=eq.${ev.event_id}`, { change_type: 'update' });
      report('F1-C02: service_role NO puede UPDATE location_change_events', evPatch === false);
      const evDelete = await serviceDelete(`location_change_events?event_id=eq.${ev.event_id}`);
      report('F1-C02: service_role NO puede DELETE location_change_events', evDelete === false);
    }
  }

  // ------------------------------------------------------------------
  // F1-C03 — complete_profile ya no puede escribir ubicación/rama
  // ------------------------------------------------------------------
  const p1Complete = await rpcAs(accounts.p1.accessToken, 'complete_ranking_profile_data', {
    p_competitive_branch: 'M', p_ranking_opt_in: true, p_location_country_code: 'AR',
    p_location_province_label: 'Buenos Aires', p_location_locality_label: 'Bella Vista',
  });
  report('setup: complete_ranking_profile_data (alta inicial) funciona', p1Complete.res.ok, JSON.stringify(p1Complete.json));
  const p1LocationId = p1Complete.json && p1Complete.json.location_id;

  const bypassAttempt = await rpcAs(accounts.p1.accessToken, 'complete_profile', {
    p_username: `v7p1${stamp}`.slice(0, 20), p_first_name: 'Bypass', p_last_name: 'Test', p_display_name: 'Bypass Test',
    p_birth_date: null, p_gender: null, p_dominant_hand: null, p_preferred_side: null,
    p_competitive_branch: 'F', p_location_country_code: 'AR',
    p_location_province_label: 'Santa Fe', p_location_locality_label: 'Rosario',
    p_location_georef_province_id: null, p_location_georef_locality_id: null, p_terms_version: null,
  });
  report(
    'F1-C03: complete_profile con datos de ubicación/rama sigue funcionando (no rompe onboarding)',
    bypassAttempt.res.ok,
    JSON.stringify(bypassAttempt.json),
  );
  report(
    'F1-C03: complete_profile NO pisó competitive_branch/location_id ya establecidos',
    bypassAttempt.json && bypassAttempt.json.competitive_branch === 'M' && bypassAttempt.json.location_id === p1LocationId,
    JSON.stringify(bypassAttempt.json),
  );
  const p1ServerTruth = await serviceGet(`profiles?player_id=eq.${accounts.p1.playerId}&select=location_id,competitive_branch`);
  report(
    'F1-C03: el servidor confirma que Rosario/F nunca se escribió',
    Array.isArray(p1ServerTruth) && p1ServerTruth[0]
      && p1ServerTruth[0].location_id === p1LocationId && p1ServerTruth[0].competitive_branch === 'M',
    JSON.stringify(p1ServerTruth),
  );

  // ------------------------------------------------------------------
  // F1-C04 (caso simple) — cooldown de 30 días bloquea un segundo cambio real
  // ------------------------------------------------------------------
  const p1SecondChange = await rpcAs(accounts.p1.accessToken, 'complete_ranking_profile_data', {
    p_competitive_branch: 'M', p_ranking_opt_in: true, p_location_country_code: 'AR',
    p_location_province_label: 'Córdoba', p_location_locality_label: 'Villa Carlos Paz',
  });
  report(
    'F1-C04: segundo cambio de ubicación real dentro de 30 días queda bloqueado',
    !p1SecondChange.res.ok && p1SecondChange.json && p1SecondChange.json.message === 'location_change_cooldown',
    JSON.stringify(p1SecondChange.json),
  );

  const p1IdempotentResend = await rpcAs(accounts.p1.accessToken, 'complete_ranking_profile_data', {
    p_competitive_branch: 'M', p_ranking_opt_in: true, p_location_country_code: 'AR',
    p_location_province_label: 'Buenos Aires', p_location_locality_label: 'Bella Vista',
  });
  report('F1-C04: reenviar la MISMA ubicación no dispara el cooldown', p1IdempotentResend.res.ok, JSON.stringify(p1IdempotentResend.json));

  // ------------------------------------------------------------------
  // F1-C04 (concurrencia real) — dos altas iniciales simultáneas del mismo jugador
  // ------------------------------------------------------------------
  const [concA, concB] = await Promise.all([
    rpcAs(accounts.p2.accessToken, 'complete_ranking_profile_data', {
      p_competitive_branch: 'F', p_ranking_opt_in: true, p_location_country_code: 'AR',
      p_location_province_label: 'Buenos Aires', p_location_locality_label: 'Bella Vista',
    }),
    rpcAs(accounts.p2.accessToken, 'complete_ranking_profile_data', {
      p_competitive_branch: 'F', p_ranking_opt_in: true, p_location_country_code: 'AR',
      p_location_province_label: 'Santa Fe', p_location_locality_label: 'Rosario',
    }),
  ]);
  const outcomes = [concA, concB];
  const succeeded = outcomes.filter((o) => o.res.ok);
  const cooldownBlocked = outcomes.filter((o) => !o.res.ok && o.json && o.json.message === 'location_change_cooldown');
  report(
    'F1-C04 (concurrencia): exactamente una de las dos llamadas concurrentes tuvo éxito',
    succeeded.length === 1,
    `succeeded=${succeeded.length} cooldownBlocked=${cooldownBlocked.length} A=${JSON.stringify(concA.json)} B=${JSON.stringify(concB.json)}`,
  );
  report(
    'F1-C04 (concurrencia): la otra quedó bloqueada por cooldown (nunca un segundo alta silenciosa)',
    cooldownBlocked.length === 1,
    `A=${JSON.stringify(concA.json)} B=${JSON.stringify(concB.json)}`,
  );
  const p2Events = await serviceGet(`location_change_events?player_id=eq.${accounts.p2.playerId}&select=change_type`);
  report(
    'F1-C04 (concurrencia): location_change_events tiene EXACTAMENTE 1 fila para el jugador (serialización real, no dos altas)',
    Array.isArray(p2Events) && p2Events.length === 1 && p2Events[0].change_type === 'initial',
    JSON.stringify(p2Events),
  );

  // ------------------------------------------------------------------
  // F1-C05/F1-C06 — constraints de ranking_rows
  // ------------------------------------------------------------------
  if (edition && playerIds[0]) {
    const pid = playerIds[0];
    const eid = edition.edition_id;

    const validRow = await serviceInsert('ranking_rows', {
      edition_id: eid, player_id: pid, scope_type: 'provincial', scope_key: `f1c05-valid-${stamp}`,
      is_eligible: true, position: 3, tie_group: 3, total_eligible: 20, density_status: 'established',
      level_internal: 5.4321, level_public: 5.4, eligibility_reason_codes: [], ranking_rules_version: 'ranking_v1',
    });
    if (validRow.json && validRow.json[0]) rankingRowIds.push(validRow.json[0].row_id);
    report('constraints: fila válida (elegible, con posición y Nivel en escala) se inserta', validRow.res.ok, JSON.stringify(validRow.json));

    const negativeCases = [
      ['reason_codes no es array', { eligibility_reason_codes: { bad: true }, is_eligible: false }],
      ['is_eligible=true con motivo residual', { is_eligible: true, eligibility_reason_codes: ['location_missing'] }],
      ['is_eligible=false sin ningún motivo', { is_eligible: false, eligibility_reason_codes: [] }],
      ['position negativo', { is_eligible: true, position: -1, tie_group: -1, eligibility_reason_codes: [] }],
      ['tie_group distinto de position', { is_eligible: true, position: 3, tie_group: 5, eligibility_reason_codes: [] }],
      ['total_eligible negativo', { total_eligible: -1, is_eligible: false, eligibility_reason_codes: ['location_missing'] }],
      ['level_internal fuera de escala', { level_internal: 11, is_eligible: false, eligibility_reason_codes: ['location_missing'] }],
      ['level_public fuera de escala', { level_public: 0.5, is_eligible: false, eligibility_reason_codes: ['location_missing'] }],
    ];
    for (const [label, overrides] of negativeCases) {
      const attempt = await serviceInsert('ranking_rows', Object.assign({
        edition_id: eid, player_id: pid, scope_type: 'pais', scope_key: `f1c05-neg-${label}-${stamp}`,
        is_eligible: false, total_eligible: 1, density_status: 'insufficient',
        eligibility_reason_codes: ['location_missing'], ranking_rules_version: 'ranking_v1',
      }, overrides));
      if (attempt.res.ok && attempt.json && attempt.json[0]) rankingRowIds.push(attempt.json[0].row_id);
      report(`F1-C05: rechaza ${label}`, !attempt.res.ok, JSON.stringify(attempt.json));
    }

    // F1-C06 — mismo scope_type, distinto scope_key, mismo jugador/edición: debe rechazarse.
    const dupSameScopeType = await serviceInsert('ranking_rows', {
      edition_id: eid, player_id: pid, scope_type: 'provincial', scope_key: `f1c06-dup-${stamp}`,
      is_eligible: false, total_eligible: 1, density_status: 'insufficient',
      eligibility_reason_codes: ['location_missing'], ranking_rules_version: 'ranking_v1',
    });
    if (dupSameScopeType.res.ok && dupSameScopeType.json && dupSameScopeType.json[0]) rankingRowIds.push(dupSameScopeType.json[0].row_id);
    report(
      'F1-C06: dos filas del mismo scope_type para el mismo jugador/edición se rechazan aunque scope_key sea distinto',
      !dupSameScopeType.res.ok,
      JSON.stringify(dupSameScopeType.json),
    );

    // Control positivo: un scope_type DISTINTO para el mismo jugador/edición sigue permitido.
    const differentScopeType = await serviceInsert('ranking_rows', {
      edition_id: eid, player_id: pid, scope_type: 'local', scope_key: `f1c06-ok-${stamp}`,
      is_eligible: false, total_eligible: 1, density_status: 'insufficient',
      eligibility_reason_codes: ['location_missing'], ranking_rules_version: 'ranking_v1',
    });
    if (differentScopeType.res.ok && differentScopeType.json && differentScopeType.json[0]) rankingRowIds.push(differentScopeType.json[0].row_id);
    report(
      'F1-C06 (control positivo): otro scope_type para el mismo jugador/edición sí se permite',
      differentScopeType.res.ok,
      JSON.stringify(differentScopeType.json),
    );
  }

  // ------------------------------------------------------------------
  // Limpieza — vía owner/SQL controlado (service_role SELECT/INSERT/DELETE directo desde este
  // script de test; en producción una limpieza así se documenta como excepcional, ver F1-C02).
  // ------------------------------------------------------------------
  console.log('\nLimpiando datos de prueba...');
  for (const rowId of rankingRowIds) await serviceDelete(`ranking_rows?row_id=eq.${rowId}`);
  for (const editionId of editionIds) await serviceDelete(`ranking_editions?edition_id=eq.${editionId}`);
  for (const playerId of playerIds) {
    await serviceDelete(`location_change_events?player_id=eq.${playerId}`);
    await serviceDelete(`level_events?player_id=eq.${playerId}`);
    await serviceDelete(`level_states?player_id=eq.${playerId}`);
    await serviceDelete(`notifications?player_id=eq.${playerId}`);
    await serviceDelete(`pilot_events?player_id=eq.${playerId}`);
    await serviceDelete(`players?player_id=eq.${playerId}`);
  }
  for (const locationId of locationIds) await serviceDelete(`locations?location_id=eq.${locationId}`);
  for (const authId of authIds) {
    const deleted = await adminDeleteUser(authId);
    if (!deleted) console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${authId} — revisar a mano en Staging.`);
  }

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed ? 'BLOQUE 7 FASE 1 OK' : 'BLOQUE 7 FASE 1: hay fallas — revisar antes de aplicar.');
  return allPassed;
}

let exitCode = 1;
try {
  exitCode = (await main()) ? 0 : 1;
} catch (err) {
  console.error('\nError durante la verificación de Bloque 7 Fase 1:', err);
  exitCode = 1;
}
process.exit(exitCode);
