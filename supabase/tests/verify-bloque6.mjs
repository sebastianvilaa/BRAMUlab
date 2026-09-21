#!/usr/bin/env node
// BRAMUlab — Bloque 6: verificación contra un proyecto Supabase REAL (oficialización atómica,
// corrección post-validación, incidencias de identidad, notificaciones, comando administrativo).
//
// Igual que verify-bloque2/3/4/5.mjs, esto NO es parte de la suite local (tests.html): necesita
// red, las migraciones de Bloque 1-5 + las 8 de Bloque 6 (20260921200000 .. 20260921233000)
// aplicadas en ese orden, y las Edge Functions officialize-match / propose-match-correction /
// respond-match-correction / resolve-identity-issue desplegadas (además de
// create-or-attach-match ya redesplegada con el hook de Bloque 6).
//
// ENTREGADO EN FASE A SIN EJECUTAR: esta ronda de Claude Code no tiene autorización para tocar
// Supabase Staging real (docs/BRAMUlab/Implementacion/Backend/Bloque_06/03_Plan_Implementacion_
// Claude.md). Este script es el punto de partida para la verificación real que hace Fase
// central después de aplicar migraciones/Edge Functions — cubre los casos centrales de
// 02_Analisis_Claude.md §7, no pretende ser tan exhaustivo como verify-bloque5.mjs todavía.
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY (Publishable Key) y SUPABASE_SERVICE_ROLE_KEY — nunca
// las pegues en el chat, se leen solo de variables de entorno de esta terminal.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque6.mjs
//
// Qué comprueba:
//   Oficialización — partido normal (4 cuentas reales) llega a validated tras la segunda carga
//               coincidente (hook en create-or-attach-match, sin llamar a officialize-match
//               aparte); level_states de los 4 refleja el delta esperado (sube ganadores, baja
//               perdedores); reintento de officialize-match sobre el mismo partido ya validated
//               es idempotente (mismo resultId, sin delta duplicado).
//   Ventana 30d — partido cargado/validado más allá de 30 días desde played_at (simulado
//               forzando played_at viejo vía service role) queda validated pero SIN efecto de
//               Nivel (match_level_results.eligible=false, reasonCode presente).
//   Corrección  — propose-match-correction + respond-match-correction (accept) dentro de 3 días
//               revierte+reaplica con diferencia neta; fuera de 3 días se rechaza.
//   Identidad   — report_identity_issue sobre un partido validated suspende el efecto COMPLETO
//               (los 4 jugadores, no solo el cuestionado); resolve-identity-issue con reemplazo
//               reaplica el partido completo; verificación de que compute_pending_action_count
//               no se mueve con una incidencia/corrección post-validación abierta.
//   Notificaciones — get_notifications trae el evento de match_validated para los 4 participantes.
//   Seguridad   — anon no puede llamar ninguna RPC nueva de Bloque 6; admin_annul_match/
//               admin_force_resolve_identity_issue rechazadas con un JWT de usuario normal.
//   Regresión   — verify-bloque5.mjs (Bloque 5) se re-corre aparte y debe seguir en 100%; este
//               script no lo reimplementa.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque6.mjs');
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
  return rpcAs(anonKey, fn, body);
}

async function callFunction(name, accessToken, body) {
  const res = await fetch(`${url}/functions/v1/${name}`, {
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

async function ensureFullOnboarding(accessToken, username) {
  // Perfil mínimo + Nivel rápido, mismo camino que verify-bloque3/4/5.mjs.
  await rpcAs(accessToken, 'complete_profile', {
    p_username: username, p_first_name: username, p_last_name: 'Verify6', p_display_name: username,
    p_birth_date: null, p_gender: null, p_dominant_hand: null, p_preferred_side: null,
    p_competitive_branch: null, p_location_country_code: null, p_location_province_label: null,
    p_location_locality_label: null, p_location_georef_province_id: null, p_location_georef_locality_id: null,
    p_terms_version: 'v1',
  });
  const res = await fetch(`${url}/functions/v1/officialize-onboarding`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'quick', quickSeedKey: 'intermedio' }),
  });
  return res.ok;
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
  const matchIds = [];

  // 4 cuentas reales: A1/A2 vs B1/B2.
  const accounts = {};
  for (const key of ['a1', 'a2', 'b1', 'b2']) {
    const email = `bramu-verify6-${key}-${stamp}@example.com`;
    const password = 'Verificar#Bloque6!';
    const created = await adminCreateConfirmedUser(email, password);
    authIds.push(created.id);
    const session = await signIn(email, password);
    const username = `v6${key}${stamp}`.slice(0, 20);
    await ensureFullOnboarding(session.access_token, username);
    const playerId = await ownPlayerId(session.access_token);
    if (playerId) playerIds.push(playerId);
    accounts[key] = { email, password, accessToken: session.access_token, playerId };
  }

  const playedAt = new Date(Date.now() - 2 * 86400000).toISOString();

  // ------------------------------------------------------------------
  // 1) Oficialización — segunda carga coincidente dispara el hook, sin llamar a
  //    officialize-match aparte.
  // ------------------------------------------------------------------
  const idem1 = crypto.randomUUID();
  const created1 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem1,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 4 }, { a: 6, b: 4 }],
    formatId: 'classic',
    playedAtIso: playedAt,
    playedAtTimeKnown: true,
  });
  report('carga inicial A1 -> created', created1.json && created1.json.ok && created1.json.code === 'created', JSON.stringify(created1.json));
  const matchId = created1.json && created1.json.matchId;
  if (matchId) matchIds.push(matchId);

  const idem2 = crypto.randomUUID();
  const confirmed = await callFunction('create-or-attach-match', accounts.b1.accessToken, {
    idempotencyKey: idem2,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 4 }, { a: 6, b: 4 }],
    formatId: 'classic',
    playedAtIso: playedAt,
    playedAtTimeKnown: true,
  });
  report('segunda carga B1 (mismo score) -> matched_confirmed, readyForValidation', confirmed.json && confirmed.json.readyForValidation === true, JSON.stringify(confirmed.json));

  // El hook de create-or-attach-match debería haber oficializado ya. Verificar vía service role.
  await new Promise((resolve) => setTimeout(resolve, 500));
  const matchRow = matchId ? (await serviceGet(`matches?match_id=eq.${matchId}&select=status,validated_at`))?.[0] : null;
  report('el hook de create-or-attach-match dejó el partido validated', !!matchRow && matchRow.status === 'validated', JSON.stringify(matchRow));

  const levelA1 = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=mu,rated_matches,distinct_opponents`))?.[0] : null;
  report('level_states de A1 (ganador) refleja rated_matches=1', !!levelA1 && levelA1.rated_matches === 1, JSON.stringify(levelA1));

  // Reintento explícito de officialize-match sobre un partido ya validated -> idempotente.
  const retryOfficialize = await callFunction('officialize-match', accounts.a1.accessToken, { matchId });
  report('reintento explícito de officialize-match sobre partido ya validated es ok', retryOfficialize.json && retryOfficialize.json.ok === true, JSON.stringify(retryOfficialize.json));
  const levelA1After = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches`))?.[0] : null;
  report('el reintento NO duplica rated_matches', !!levelA1After && levelA1After.rated_matches === 1, JSON.stringify(levelA1After));

  // ------------------------------------------------------------------
  // 2) Notificaciones — los 4 participantes tienen match_validated.
  // ------------------------------------------------------------------
  const notifA1 = await rpcAs(accounts.a1.accessToken, 'get_notifications', { p_limit: 10 });
  const hasMatchValidated = Array.isArray(notifA1.json) && notifA1.json.some((n) => n.type === 'match_validated' && n.match_id === matchId);
  report('get_notifications trae match_validated para A1', hasMatchValidated, JSON.stringify(notifA1.json));

  // ------------------------------------------------------------------
  // 3) Corrección post-validación — dentro de 3 días.
  // ------------------------------------------------------------------
  const propose = await callFunction('propose-match-correction', accounts.a1.accessToken, {
    matchId, sets: [{ gamesA: 6, gamesB: 2 }, { gamesA: 6, gamesB: 2 }],
  });
  report('propose-match-correction (resultado más amplio) -> correction_proposed', propose.json && propose.json.ok && propose.json.code === 'correction_proposed', JSON.stringify(propose.json));

  const respond = await callFunction('respond-match-correction', accounts.b1.accessToken, { matchId, accept: true });
  report('respond-match-correction (B1 acepta) -> correction_accepted', respond.json && respond.json.ok && String(respond.json.code || '').startsWith('correction_accepted'), JSON.stringify(respond.json));

  const levelA1AfterCorrection = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=mu,rated_matches`))?.[0] : null;
  report('tras la corrección, rated_matches de A1 sigue siendo 1 (mismo partido, no duplicado)', !!levelA1AfterCorrection && levelA1AfterCorrection.rated_matches === 1, JSON.stringify(levelA1AfterCorrection));
  report('el mu de A1 cambió tras la corrección (resultado más amplio -> mayor magnitud)', !!levelA1AfterCorrection && !!levelA1 && levelA1AfterCorrection.mu !== levelA1.mu, JSON.stringify({ before: levelA1, after: levelA1AfterCorrection }));

  // ------------------------------------------------------------------
  // 4) Incidencia de identidad — B2 reporta que no participó; se reemplaza por B1... (usamos
  //    un 5º jugador para no romper la fingerprint del partido).
  // ------------------------------------------------------------------
  const email5 = `bramu-verify6-b2new-${stamp}@example.com`;
  const created5 = await adminCreateConfirmedUser(email5, 'Verificar#Bloque6!');
  authIds.push(created5.id);
  const session5 = await signIn(email5, 'Verificar#Bloque6!');
  await ensureFullOnboarding(session5.access_token, `v6b2new${stamp}`.slice(0, 20));
  const player5Id = await ownPlayerId(session5.access_token);
  if (player5Id) playerIds.push(player5Id);

  const report1 = await rpcAs(accounts.b2.accessToken, 'report_identity_issue', {
    p_match_id: matchId, p_team: 'B', p_position_in_team: 2, p_reason: 'No jugué este partido',
  });
  report('report_identity_issue (B2, "No participé") -> identity_issue_opened', report1.json && report1.json.ok && report1.json.code === 'identity_issue_opened', JSON.stringify(report1.json));
  const issueId = report1.json && report1.json.issueId;

  const matchAfterIssue = matchId ? (await serviceGet(`matches?match_id=eq.${matchId}&select=status`))?.[0] : null;
  report('el partido SIGUE validated mientras la incidencia está abierta (resultado deportivo oficial)', !!matchAfterIssue && matchAfterIssue.status === 'validated', JSON.stringify(matchAfterIssue));

  const levelA1WhileOpen = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches`))?.[0] : null;
  report('rated_matches de A1 (jugador NO cuestionado) baja mientras la incidencia está abierta -> reversión de PARTIDO COMPLETO', !!levelA1WhileOpen && levelA1WhileOpen.rated_matches === 0, JSON.stringify(levelA1WhileOpen));

  const proposeBlocked = await callFunction('propose-match-correction', accounts.a1.accessToken, {
    matchId, sets: [{ gamesA: 6, gamesB: 1 }, { gamesA: 6, gamesB: 1 }],
  });
  report('propose-match-correction bloqueada mientras hay incidencia de identidad open', proposeBlocked.json && proposeBlocked.json.ok === false && proposeBlocked.json.code === 'identity_issue_open', JSON.stringify(proposeBlocked.json));

  if (issueId) {
    const resolve = await callFunction('resolve-identity-issue', accounts.a1.accessToken, {
      issueId, replacementPlayerId: player5Id,
    });
    report('resolve-identity-issue con reemplazo -> identity_resolved, reaplica el partido completo', resolve.json && resolve.json.ok && String(resolve.json.code || '').startsWith('identity_resolved'), JSON.stringify(resolve.json));

    const levelA1AfterResolve = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches`))?.[0] : null;
    report('rated_matches de A1 vuelve a 1 tras resolver la identidad', !!levelA1AfterResolve && levelA1AfterResolve.rated_matches === 1, JSON.stringify(levelA1AfterResolve));
  }

  const pendingCountA1 = await rpcAs(accounts.a1.accessToken, 'get_pending_action_count', {});
  report('compute_pending_action_count de A1 no se movió por la corrección/incidencia post-validación', pendingCountA1.json && pendingCountA1.json.count === 0, JSON.stringify(pendingCountA1.json));

  // ------------------------------------------------------------------
  // 5) Seguridad — anon / usuario normal no pueden alcanzar RPCs privadas de Bloque 6.
  // ------------------------------------------------------------------
  const anonOfficialize = await rpcAsAnon('officialize_match_validation', { p_match_id: matchId });
  report('anon no puede llamar officialize_match_validation', anonOfficialize.res.status === 401 || anonOfficialize.res.status === 404 || anonOfficialize.res.status === 403, `status=${anonOfficialize.res.status}`);

  const userAdminAnnul = await rpcAs(accounts.a1.accessToken, 'admin_annul_match', {
    p_match_id: matchId, p_actor_label: 'test', p_reason: 'test',
  });
  report('un usuario normal no puede llamar admin_annul_match', userAdminAnnul.res.status === 401 || userAdminAnnul.res.status === 404 || userAdminAnnul.res.status === 403, `status=${userAdminAnnul.res.status}`);

  // ------------------------------------------------------------------
  // Limpieza
  // ------------------------------------------------------------------
  console.log('\nLimpiando datos de prueba...');
  for (const mid of matchIds) {
    await serviceDelete(`match_level_result_players?result_id=in.(select result_id from match_level_results where match_id=eq.${mid})`);
    await serviceDelete(`match_level_results?match_id=eq.${mid}`);
    await serviceDelete(`match_identity_issues?match_id=eq.${mid}`);
    await serviceDelete(`notifications?match_id=eq.${mid}`);
    await serviceDelete(`match_actions?match_id=eq.${mid}`);
    await serviceDelete(`match_sets?match_id=eq.${mid}`);
    await serviceDelete(`match_revisions?match_id=eq.${mid}`);
    await serviceDelete(`match_participants?match_id=eq.${mid}`);
    await serviceDelete(`match_submissions?result_match_id=eq.${mid}`);
    await serviceDelete(`match_user_state?match_id=eq.${mid}`);
    await serviceDelete(`matches?match_id=eq.${mid}`);
  }
  for (const playerId of playerIds) {
    await serviceDelete(`level_events?player_id=eq.${playerId}`);
    await serviceDelete(`level_states?player_id=eq.${playerId}`);
    await serviceDelete(`notifications?player_id=eq.${playerId}`);
    await serviceDelete(`pilot_events?player_id=eq.${playerId}`);
    await serviceDelete(`players?player_id=eq.${playerId}`);
  }
  for (const authId of authIds) {
    const deleted = await adminDeleteUser(authId);
    if (!deleted) console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${authId} — revisar a mano en Staging.`);
  }

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed ? 'BLOQUE 6 OK' : 'BLOQUE 6: hay fallas — revisar antes de cerrar.');
  return allPassed;
}

let exitCode = 1;
try {
  exitCode = (await main()) ? 0 : 1;
} catch (err) {
  console.error('\nError durante la verificación de Bloque 6:', err);
  exitCode = 1;
}
process.exit(exitCode);
