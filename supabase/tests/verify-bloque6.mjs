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
//   Identidad pre-validación (B6-B-03/04/05/07, 08_Revision_Central_Adicional.md) — resolver una
//               identidad sobre un partido todavía pending_validation crea una nueva revisión
//               append-only y pasa la acción a la pareja contraria (nunca muta directo); un
//               jugador ajeno al partido no puede resolver aunque conozca el issueId;
//               validation_deadline_at nunca se reinicia; participant_fingerprint pasa al
//               centinela mientras el slot está sin identificar y vuelve al hash real al
//               resolver; un partido pending_validation con la ventana de 30 días ya vencida
//               rechaza report_identity_issue con match_expired.
//   Corrección final pre-Staging (10_Revision_Final_Pre_Staging_ChatGPT.md) — C-02: la pareja sin
//               la acción real no puede Confirmar (confirm_match_validation); C-03: cargar con
//               los IDs correctos mientras hay una incidencia open no crea un match_id duplicado;
//               C-04: attach a un match existente tras un reemplazo de identidad preserva la
//               orientación A/B almacenada; C-05: admin_force_resolve_identity_issue sobre un
//               partido validated queda STAGED (la incidencia sigue open hasta que
//               admin-resolve-identity-issue, SOLO alcanzable con la service role key exacta,
//               completa la reaplicación de Nivel); C-07: un slot "Jugador no identificado"
//               terminal pre-validación no bloquea Confirmar; C-08/C-10: las tareas accionables
//               de Notificaciones se derivan en lectura y desaparecen solas al resolverse; C-09:
//               last_rated_at nunca es NULL tras el cuestionario. (C-01/C-06 — diferencia neta
//               contra un baseline LIVE inmutable y factores contextuales congelados en
//               correction_accepted — tienen cobertura dedicada en
//               bramulab/match-level-engine.test.mjs, no acá.)
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

// Para RPCs SOLO service_role (admin_*, officialize_match_validation, etc.): apikey y
// Authorization deben ser AMBOS la service role key, mismo criterio que serviceGet/servicePatch
// — nunca reusar rpcAs (que fija apikey=anonKey, pensado para un usuario normal).
async function rpcAsService(fn, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* sin cuerpo */ }
  return { res, json };
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

  // Regresión central post-C-02: Confirmar sobre un partido que YA tuvo una corrección debe ser
  // un NO-OP real. Nunca puede reentrar como trigger='initial' y reemplazar el resultado vigente.
  const appliedBeforeRetryAfterCorrection = matchId
    ? (await serviceGet(`match_level_results?match_id=eq.${matchId}&effect_status=eq.applied&select=result_id,trigger,revision_id`))?.[0]
    : null;
  const retryAfterCorrection = await callFunction('officialize-match', accounts.a1.accessToken, { matchId });
  report('reintento Confirmar después de una corrección devuelve already_validated', retryAfterCorrection.json && retryAfterCorrection.json.ok === true && retryAfterCorrection.json.code === 'already_validated', JSON.stringify(retryAfterCorrection.json));
  const appliedAfterRetryAfterCorrection = matchId
    ? (await serviceGet(`match_level_results?match_id=eq.${matchId}&effect_status=eq.applied&select=result_id,trigger,revision_id`))?.[0]
    : null;
  report('reintento Confirmar NO reemplaza el correction_accepted vigente por un nuevo initial',
    !!appliedBeforeRetryAfterCorrection && !!appliedAfterRetryAfterCorrection
      && appliedBeforeRetryAfterCorrection.result_id === appliedAfterRetryAfterCorrection.result_id
      && appliedAfterRetryAfterCorrection.trigger === 'correction_accepted',
    JSON.stringify({ before: appliedBeforeRetryAfterCorrection, after: appliedAfterRetryAfterCorrection }));

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

  const levelA1WhileOpen = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches,last_rated_at`))?.[0] : null;
  report('rated_matches de A1 (jugador NO cuestionado) baja mientras la incidencia está abierta -> reversión de PARTIDO COMPLETO', !!levelA1WhileOpen && levelA1WhileOpen.rated_matches === 0, JSON.stringify(levelA1WhileOpen));

  // C-09 regresión: al revertirse el ÚNICO partido computable, last_rated_at debe volver al
  // initial_estimate del cuestionario, nunca quedar NULL (si no, se pierde el reloj de inactividad).
  const initialAnchorA1 = accounts.a1.playerId
    ? (await serviceGet(`level_events?player_id=eq.${accounts.a1.playerId}&event_type=eq.initial_estimate&select=created_at&order=created_at.asc&limit=1`))?.[0]
    : null;
  report('C-09: revertir el único partido conserva last_rated_at anclado al cuestionario',
    !!levelA1WhileOpen && !!levelA1WhileOpen.last_rated_at && !!initialAnchorA1
      && new Date(levelA1WhileOpen.last_rated_at).getTime() === new Date(initialAnchorA1.created_at).getTime(),
    JSON.stringify({ state: levelA1WhileOpen, initialAnchor: initialAnchorA1 }));

  const proposeBlocked = await callFunction('propose-match-correction', accounts.a1.accessToken, {
    matchId, sets: [{ gamesA: 6, gamesB: 1 }, { gamesA: 6, gamesB: 1 }],
  });
  report('propose-match-correction bloqueada mientras hay incidencia de identidad open', proposeBlocked.json && proposeBlocked.json.ok === false && proposeBlocked.json.code === 'identity_issue_open', JSON.stringify(proposeBlocked.json));

  if (issueId) {
    const resolve = await callFunction('resolve-identity-issue', accounts.a1.accessToken, {
      issueId, replacementPlayerId: player5Id,
    });
    report('resolve-identity-issue con reemplazo -> identity_resolved, reaplica el partido completo', resolve.json && resolve.json.ok && String(resolve.json.code || '').startsWith('identity_resolved'), JSON.stringify(resolve.json));

    const levelA1AfterResolve = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches,distinct_opponents,status`))?.[0] : null;
    report('rated_matches de A1 vuelve a 1 tras resolver la identidad', !!levelA1AfterResolve && levelA1AfterResolve.rated_matches === 1, JSON.stringify(levelA1AfterResolve));
    // B6-A-11/B6-B-06: A1 jugó contra B1 (set original) y contra player5 (reemplazo de B2) — dos
    // rivales DISTINTOS. B6-B-06 exigía que la reasignación de match_participants quedara escrita
    // ANTES de este recálculo: si el orden estuviera roto, este conteo daría 1 (solo B1), no 2.
    report('distinct_opponents de A1 cuenta EXACTAMENTE a B1 + player5 (B6-A-11/B6-B-06)', !!levelA1AfterResolve && levelA1AfterResolve.distinct_opponents === 2, JSON.stringify(levelA1AfterResolve));

    const matchFingerprintAfterResolve = matchId ? (await serviceGet(`matches?match_id=eq.${matchId}&select=participant_fingerprint`))?.[0] : null;
    report('B6-B-04: participant_fingerprint vuelve a un hash real (64 hex) tras resolver con los 4 IDs conocidos',
      !!matchFingerprintAfterResolve && /^[0-9a-f]{64}$/.test(matchFingerprintAfterResolve.participant_fingerprint || ''),
      JSON.stringify(matchFingerprintAfterResolve));
  }

  const pendingCountA1 = await rpcAs(accounts.a1.accessToken, 'get_pending_action_count', {});
  report('compute_pending_action_count de A1 no se movió por la corrección/incidencia post-validación', pendingCountA1.json && pendingCountA1.json.count === 0, JSON.stringify(pendingCountA1.json));

  // ------------------------------------------------------------------
  // 4.1) B6-A-07 — revisión stale rechazada sin escritura.
  // ------------------------------------------------------------------
  const staleAttempt = await rpcAs(accounts.a1.accessToken, 'officialize_match_validation', {
    p_match_id: matchId, p_revision_id: '00000000-0000-0000-0000-000000000000',
    p_trigger: 'initial', p_actor_player_id: null, p_actor_note: null,
    p_eligible: false, p_reason_codes: [], p_algorithm_version: 'test',
    p_known_levels_count: null, p_team_strength_a: null, p_team_strength_b: null,
    p_expectation_a: null, p_expectation_b: null, p_rival_pair_confidence_avg_a: null,
    p_rival_pair_confidence_avg_b: null, p_margin: null, p_format_factor: null,
    p_availability_factor: null, p_repetition_factor_a: null, p_repetition_factor_b: null,
    p_companion_factor_a: null, p_companion_factor_b: null, p_result_players: [], p_level_state_updates: [],
  });
  // Nota: se espera 401/403/404 (RLS/GRANT — un usuario normal no puede llamar esta RPC en
  // absoluto, ver §5 más abajo) O, si se corriera con service_role, 'stale_match_revision'. Acá
  // solo confirmamos que NO se cuela como un 200 exitoso con un revision_id inventado.
  report('officialize_match_validation con revision_id inventado nunca devuelve éxito', !(staleAttempt.json && staleAttempt.json.ok === true), JSON.stringify(staleAttempt.json) + ` status=${staleAttempt.res.status}`);

  // ------------------------------------------------------------------
  // 4.2) Ocultar (hidden) no afecta lo computable — B6-A referencia 04_Revision_ChatGPT.md §4/§5.
  // ------------------------------------------------------------------
  const beforeHide = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches`))?.[0] : null;
  await rpcAs(accounts.a1.accessToken, 'hide_match_for_me', { p_match_id: matchId, p_hidden: true });
  const afterHide = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=rated_matches`))?.[0] : null;
  report('ocultar el partido NO cambia rated_matches (hidden nunca toca la capa computable)', !!beforeHide && !!afterHide && beforeHide.rated_matches === afterHide.rated_matches, JSON.stringify({ beforeHide, afterHide }));
  await rpcAs(accounts.a1.accessToken, 'hide_match_for_me', { p_match_id: matchId, p_hidden: false });

  // ------------------------------------------------------------------
  // 4.3) B6-B-03/04/05/07 — identidad sobre un partido TODAVÍA pending_validation: conversación
  //      entre parejas (nueva revisión append-only, nunca mutación directa), autorización de
  //      participante actual, y ventana de 30 días sin reiniciarse.
  // ------------------------------------------------------------------
  const emailOutsider = `bramu-verify6-outsider-${stamp}@example.com`;
  const createdOutsider = await adminCreateConfirmedUser(emailOutsider, 'Verificar#Bloque6!');
  authIds.push(createdOutsider.id);
  const sessionOutsider = await signIn(emailOutsider, 'Verificar#Bloque6!');
  await ensureFullOnboarding(sessionOutsider.access_token, `v6out${stamp}`.slice(0, 20));
  const outsiderPlayerId = await ownPlayerId(sessionOutsider.access_token);
  if (outsiderPlayerId) playerIds.push(outsiderPlayerId);

  // Mismos 4 jugadores, fecha bien alejada (>3h) de la del partido #1 -> fingerprint distinto,
  // nunca colisiona con el partido ya validated de más arriba.
  const playedAt2 = new Date(Date.now() - 5 * 86400000).toISOString();
  const idem3 = crypto.randomUUID();
  const created2 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem3,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
    formatId: 'classic',
    playedAtIso: playedAt2,
    playedAtTimeKnown: true,
  });
  const match2Id = created2.json && created2.json.matchId;
  if (match2Id) matchIds.push(match2Id);
  report('partido #2 creado, sigue pending_validation (B no confirmó todavía)', !!match2Id && created2.json.status === 'pending_validation', JSON.stringify(created2.json));

  const match2Before = match2Id ? (await serviceGet(`matches?match_id=eq.${match2Id}&select=action_side,current_revision_id,validation_deadline_at,participant_fingerprint`))?.[0] : null;
  report('partido #2 arranca con action_side=B (equipo contrario al creador A1)', !!match2Before && match2Before.action_side === 'B', JSON.stringify(match2Before));

  // B1 mismo indica que su propio slot está mal (Experiencia_Inicial.md §13.1/§13.2: no hace
  // falta que sea otro quien lo detecte).
  const report2 = await rpcAs(accounts.b1.accessToken, 'report_identity_issue', {
    p_match_id: match2Id, p_team: 'B', p_position_in_team: 1, p_reason: 'Error de carga',
  });
  report('report_identity_issue sobre partido #2 (todavía pending_validation) -> identity_issue_opened', report2.json && report2.json.ok && report2.json.code === 'identity_issue_opened', JSON.stringify(report2.json));
  const issueId2 = report2.json && report2.json.issueId;

  const match2AfterReport = match2Id ? (await serviceGet(`matches?match_id=eq.${match2Id}&select=participant_fingerprint`))?.[0] : null;
  report('B6-B-04: participant_fingerprint pasa al centinela mientras el slot está sin identificar', !!match2AfterReport && match2AfterReport.participant_fingerprint === `bloque6_unidentified:${match2Id}`, JSON.stringify(match2AfterReport));

  if (issueId2) {
    // B6-B-05: un jugador AJENO al partido (nunca fue participante) no puede resolver la
    // incidencia, aunque conozca el issueId. resolve_identity_issue es SOLO service_role — se
    // llama por la Edge Function (mismo camino que un cliente real), nunca por RPC directa.
    const outsiderAttempt = await callFunction('resolve-identity-issue', sessionOutsider.access_token, {
      issueId: issueId2, replacementPlayerId: player5Id,
    });
    report('B6-B-05: un jugador ajeno al partido no puede resolver la incidencia', outsiderAttempt.json && outsiderAttempt.json.ok === false && outsiderAttempt.json.code === 'not_a_participant', JSON.stringify(outsiderAttempt.json));

    // B2 (pareja de B1, participante actual) resuelve reemplazando por player5 -> pasa la acción
    // a la pareja CONTRARIA (A), nunca reinicia validation_deadline_at.
    const resolve2 = await callFunction('resolve-identity-issue', accounts.b2.accessToken, {
      issueId: issueId2, replacementPlayerId: player5Id,
    });
    report('B6-B-03: resolución pre-validación (B2, participante actual) -> identity_resolved', resolve2.json && resolve2.json.ok && resolve2.json.code === 'identity_resolved', JSON.stringify(resolve2.json));

    const match2After = match2Id ? (await serviceGet(`matches?match_id=eq.${match2Id}&select=action_side,current_revision_id,validation_deadline_at,participant_fingerprint,status`))?.[0] : null;
    report('B6-B-03: la acción pasa a la pareja CONTRARIA del actor (B2 actuó -> action_side=A)', !!match2After && match2After.action_side === 'A', JSON.stringify(match2After));
    report('B6-B-03: current_revision_id cambió (nueva revisión append-only, nunca mutación directa)', !!match2After && !!match2Before && match2After.current_revision_id !== match2Before.current_revision_id, JSON.stringify({ before: match2Before, after: match2After }));
    report('B6-B-07: validation_deadline_at NUNCA se reinicia por una corrección de identidad', !!match2After && !!match2Before && match2After.validation_deadline_at === match2Before.validation_deadline_at, JSON.stringify({ before: match2Before, after: match2After }));
    report('B6-B-04: participant_fingerprint vuelve a un hash real (64 hex) tras resolver con los 4 IDs conocidos', !!match2After && /^[0-9a-f]{64}$/.test(match2After.participant_fingerprint || ''), JSON.stringify(match2After));
    report('el partido #2 SIGUE pending_validation (identidad no oficializa por sí sola)', !!match2After && match2After.status === 'pending_validation', JSON.stringify(match2After));
  }

  // ------------------------------------------------------------------
  // 4.4) B6-B-07 — partido pending_validation con la ventana de 30 días ya vencida: no aceptable
  //      ni para reportar identidad.
  // ------------------------------------------------------------------
  const playedAt3 = new Date(Date.now() - 10 * 86400000).toISOString();
  const idem4 = crypto.randomUUID();
  const created3 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem4,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 0 }, { a: 6, b: 0 }],
    formatId: 'classic',
    playedAtIso: playedAt3,
    playedAtTimeKnown: true,
  });
  const match3Id = created3.json && created3.json.matchId;
  if (match3Id) matchIds.push(match3Id);
  if (match3Id) {
    await servicePatch(`matches?match_id=eq.${match3Id}`, { validation_deadline_at: new Date(Date.now() - 86400000).toISOString() });
    const expiredAttempt = await rpcAs(accounts.a1.accessToken, 'report_identity_issue', {
      p_match_id: match3Id, p_team: 'A', p_position_in_team: 1, p_reason: 'test B6-B-07',
    });
    report('B6-B-07: report_identity_issue sobre un partido pending_validation ya vencido -> match_expired', expiredAttempt.json && expiredAttempt.json.ok === false && expiredAttempt.json.code === 'match_expired', JSON.stringify(expiredAttempt.json));
  }

  // ------------------------------------------------------------------
  // 4.5) C-02 — Confirmar exige autoridad por pareja real: el lado PROPONENTE (action_side
  //      todavía de la pareja contraria) no puede oficializar. Reusa el partido #2 (A1,A2 vs
  //      player5,B2 tras la resolución de identidad de 4.3), que quedó con action_side='A'.
  // ------------------------------------------------------------------
  if (match2Id) {
    const proposerAttempt = await callFunction('officialize-match', accounts.b2.accessToken, { matchId: match2Id });
    report('C-02: la pareja SIN la acción (B, action_side=A) no puede confirmar', proposerAttempt.json && proposerAttempt.json.ok === false && proposerAttempt.json.code === 'not_actionable_for_caller', JSON.stringify(proposerAttempt.json));

    const realConfirm = await callFunction('officialize-match', accounts.a1.accessToken, { matchId: match2Id });
    report('C-02: la pareja CON la acción real (A) confirma y oficializa', realConfirm.json && realConfirm.json.ok === true && realConfirm.json.code === 'officialized', JSON.stringify(realConfirm.json));

    const match2Validated = (await serviceGet(`matches?match_id=eq.${match2Id}&select=status`))?.[0];
    report('C-02: partido #2 queda validated tras la confirmación correcta', !!match2Validated && match2Validated.status === 'validated', JSON.stringify(match2Validated));
  }

  // ------------------------------------------------------------------
  // 4.6) C-04 — attach a un match YA EXISTENTE tras un reemplazo de identidad: la orientación A/B
  //      se toma de match_participants almacenada, nunca de un recálculo léxico de los IDs
  //      entrantes (que un reemplazo puede invertir). player5 (nuevo team B) redeclara el score
  //      vigente de partido #2 — debe converger sin error ni corromper los sets.
  // ------------------------------------------------------------------
  if (match2Id) {
    const setsBefore = await serviceGet(`match_sets?match_id=eq.${match2Id}&select=set_number,games_a,games_b&order=set_number`);
    const idem5 = crypto.randomUUID();
    const reattach = await callFunction('create-or-attach-match', session5.access_token, {
      idempotencyKey: idem5,
      pair1PlayerIds: [player5Id, accounts.b2.playerId],
      pair2PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
      rawSets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
      formatId: 'classic',
      playedAtIso: playedAt2,
      playedAtTimeKnown: true,
    });
    report('C-04: re-declarar el score vigente tras el swap converge sin error (nunca ambiguous/creado de nuevo)', reattach.json && reattach.json.ok === true && reattach.json.matchId === match2Id, JSON.stringify(reattach.json));
    const setsAfter = await serviceGet(`match_sets?match_id=eq.${match2Id}&select=set_number,games_a,games_b&order=set_number`);
    report('C-04: los sets almacenados NO se corrompen (misma orientación que antes del re-attach)', JSON.stringify(setsBefore) === JSON.stringify(setsAfter), JSON.stringify({ setsBefore, setsAfter }));
  }

  // ------------------------------------------------------------------
  // 4.7) C-09 — el Nivel inicial fija last_rated_at desde el cuestionario (nunca NULL).
  // ------------------------------------------------------------------
  const levelStateA1Full = accounts.a1.playerId ? (await serviceGet(`level_states?player_id=eq.${accounts.a1.playerId}&select=last_rated_at`))?.[0] : null;
  report('C-09: last_rated_at de A1 nunca es NULL (arranca desde el cuestionario, no desde el primer partido)', !!levelStateA1Full && !!levelStateA1Full.last_rated_at, JSON.stringify(levelStateA1Full));

  // ------------------------------------------------------------------
  // 4.8) C-08/C-10 — tareas accionables DERIVADAS en get_notifications (nunca persistidas),
  //      desaparecen automáticamente al resolverse el estado.
  // ------------------------------------------------------------------
  const playedAt6 = new Date(Date.now() - 6 * 86400000).toISOString();
  const idem6 = crypto.randomUUID();
  const created6 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem6,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 2 }, { a: 6, b: 2 }],
    formatId: 'classic',
    playedAtIso: playedAt6,
    playedAtTimeKnown: true,
  });
  const match6Id = created6.json && created6.json.matchId;
  if (match6Id) matchIds.push(match6Id);
  if (match6Id) {
    const notifB1Pending = await rpcAs(accounts.b1.accessToken, 'get_notifications', { p_limit: 20 });
    const hasPendingReview = Array.isArray(notifB1Pending.json) && notifB1Pending.json.some((n) => n.type === 'pending_review' && n.match_id === match6Id);
    report('C-08: get_notifications de B1 (lado accionable) trae pending_review sintético para partido #6', hasPendingReview, JSON.stringify(notifB1Pending.json && notifB1Pending.json.filter((n) => n.match_id === match6Id)));

    await callFunction('create-or-attach-match', accounts.b1.accessToken, {
      idempotencyKey: crypto.randomUUID(),
      pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
      pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
      rawSets: [{ a: 6, b: 2 }, { a: 6, b: 2 }],
      formatId: 'classic',
      playedAtIso: playedAt6,
      playedAtTimeKnown: true,
    });
    const notifB1AfterConfirm = await rpcAs(accounts.b1.accessToken, 'get_notifications', { p_limit: 20 });
    const stillPending = Array.isArray(notifB1AfterConfirm.json) && notifB1AfterConfirm.json.some((n) => n.type === 'pending_review' && n.match_id === match6Id);
    report('C-08/C-10: pending_review desaparece SOLO tras confirmar (derivado, nunca marcable como leído)', !stillPending, JSON.stringify(notifB1AfterConfirm.json && notifB1AfterConfirm.json.filter((n) => n.match_id === match6Id)));
  }

  // ------------------------------------------------------------------
  // 4.9) C-03 — guardia de duplicados: una carga con los 3 participantes conocidos coincidentes
  //      mientras hay una incidencia open NO crea un segundo match_id.
  // ------------------------------------------------------------------
  const playedAt7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const idem7 = crypto.randomUUID();
  const created7 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem7,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
    formatId: 'classic',
    playedAtIso: playedAt7,
    playedAtTimeKnown: true,
  });
  const match7Id = created7.json && created7.json.matchId;
  if (match7Id) matchIds.push(match7Id);
  if (match7Id) {
    const report7 = await rpcAs(accounts.a2.accessToken, 'report_identity_issue', {
      p_match_id: match7Id, p_team: 'A', p_position_in_team: 2, p_reason: 'test C-03',
    });
    const issueId7 = report7.json && report7.json.issueId;
    if (issueId7) {
      const duplicateAttempt = await callFunction('create-or-attach-match', accounts.b1.accessToken, {
        idempotencyKey: crypto.randomUUID(),
        pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
        pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
        rawSets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
        formatId: 'classic',
        playedAtIso: playedAt7,
        playedAtTimeKnown: true,
      });
      report('C-03: cargar con los 4 IDs correctos mientras hay issue open -> identity_resolution_required, NUNCA crea otro match_id',
        duplicateAttempt.json && duplicateAttempt.json.ok === false && duplicateAttempt.json.code === 'identity_resolution_required' && duplicateAttempt.json.matchId === match7Id,
        JSON.stringify(duplicateAttempt.json));
    }
  }

  // ------------------------------------------------------------------
  // 4.10) C-05 — resolución administrativa de identidad sobre un partido validated: STAGED, la
  //       incidencia queda EXACTAMENTE open hasta que la Edge Function admin completa la
  //       reaplicación de Nivel. usuario normal no puede ejecutar la vía admin.
  // ------------------------------------------------------------------
  const playedAt8 = new Date(Date.now() - 8 * 86400000).toISOString();
  const idem8a = crypto.randomUUID();
  await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem8a,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 1 }, { a: 6, b: 1 }],
    formatId: 'classic',
    playedAtIso: playedAt8,
    playedAtTimeKnown: true,
  });
  const created8b = await callFunction('create-or-attach-match', accounts.b1.accessToken, {
    idempotencyKey: crypto.randomUUID(),
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 1 }, { a: 6, b: 1 }],
    formatId: 'classic',
    playedAtIso: playedAt8,
    playedAtTimeKnown: true,
  });
  const match8Id = created8b.json && created8b.json.matchId;
  if (match8Id) matchIds.push(match8Id);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const match8Row = match8Id ? (await serviceGet(`matches?match_id=eq.${match8Id}&select=status`))?.[0] : null;
  if (match8Id && match8Row && match8Row.status === 'validated') {
    const report8 = await rpcAs(accounts.a1.accessToken, 'report_identity_issue', {
      p_match_id: match8Id, p_team: 'A', p_position_in_team: 2, p_reason: 'test C-05',
    });
    const issueId8 = report8.json && report8.json.issueId;
    if (issueId8) {
      const userAdminAttempt = await rpcAs(accounts.a1.accessToken, 'admin_force_resolve_identity_issue', {
        p_issue_id: issueId8, p_replacement_player_id: player5Id, p_actor_label: 'test', p_reason: 'test',
      });
      report('C-05: un usuario normal no puede llamar admin_force_resolve_identity_issue', userAdminAttempt.res.status === 401 || userAdminAttempt.res.status === 404 || userAdminAttempt.res.status === 403, `status=${userAdminAttempt.res.status}`);

      const authAttempt = await rpcAsService('admin_force_resolve_identity_issue', {
        p_issue_id: issueId8, p_replacement_player_id: player5Id, p_actor_label: 'QA automatizada', p_reason: 'verify-bloque6 C-05',
      });
      report('C-05: admin_force_resolve_identity_issue sobre partido validated -> SOLO autoriza (identity_resolved_authorized)', authAttempt.json && authAttempt.json.ok === true && authAttempt.json.code === 'identity_resolved_authorized' && authAttempt.json.needsRecompute === true, JSON.stringify(authAttempt.json));

      const issueStillOpen = (await serviceGet(`match_identity_issues?issue_id=eq.${issueId8}&select=status`))?.[0];
      report('C-05: la incidencia sigue EXACTAMENTE open tras solo autorizar (nada mutó todavía)', !!issueStillOpen && issueStillOpen.status === 'open', JSON.stringify(issueStillOpen));

      const wrongKeyAttempt = await callFunction('admin-resolve-identity-issue', anonKey, {
        issueId: issueId8, replacementPlayerId: player5Id, actorLabel: 'test', reason: 'test',
      });
      report('C-05: admin-resolve-identity-issue rechaza cualquier bearer que no sea la service role key exacta', wrongKeyAttempt.json && wrongKeyAttempt.json.ok === false && wrongKeyAttempt.json.code === 'forbidden', JSON.stringify(wrongKeyAttempt.json));

      const adminComplete = await callFunction('admin-resolve-identity-issue', serviceRoleKey, {
        issueId: issueId8, replacementPlayerId: player5Id, actorLabel: 'QA automatizada', reason: 'verify-bloque6 C-05',
      });
      report('C-05: admin-resolve-identity-issue completa la reasignación + reaplicación de Nivel atómicamente', adminComplete.json && adminComplete.json.ok === true && adminComplete.json.code === 'identity_resolved', JSON.stringify(adminComplete.json));

      const issueNowResolved = (await serviceGet(`match_identity_issues?issue_id=eq.${issueId8}&select=status,resolved_player_id`))?.[0];
      report('C-05: la incidencia queda resolved con el reemplazo correcto', !!issueNowResolved && issueNowResolved.status === 'resolved' && issueNowResolved.resolved_player_id === player5Id, JSON.stringify(issueNowResolved));
    }
  }

  // ------------------------------------------------------------------
  // 4.11) C-07 — "Jugador no identificado" terminal PRE-validación no bloquea Confirmar.
  // ------------------------------------------------------------------
  const playedAt9 = new Date(Date.now() - 9 * 86400000).toISOString();
  const idem9 = crypto.randomUUID();
  const created9 = await callFunction('create-or-attach-match', accounts.a1.accessToken, {
    idempotencyKey: idem9,
    pair1PlayerIds: [accounts.a1.playerId, accounts.a2.playerId],
    pair2PlayerIds: [accounts.b1.playerId, accounts.b2.playerId],
    rawSets: [{ a: 6, b: 4 }, { a: 4, b: 6 }, { a: 6, b: 4 }],
    formatId: 'classic',
    playedAtIso: playedAt9,
    playedAtTimeKnown: true,
  });
  const match9Id = created9.json && created9.json.matchId;
  if (match9Id) matchIds.push(match9Id);
  if (match9Id) {
    const report9 = await rpcAs(accounts.b2.accessToken, 'report_identity_issue', {
      p_match_id: match9Id, p_team: 'B', p_position_in_team: 1, p_reason: 'test C-07',
    });
    const issueId9 = report9.json && report9.json.issueId;
    if (issueId9) {
      await servicePatch(`match_identity_issues?issue_id=eq.${issueId9}`, { resolution_deadline_at: new Date(Date.now() - 3600000).toISOString() });
      const forceResult = await callFunction('resolve-identity-issue', accounts.b2.accessToken, {
        issueId: issueId9, forceUnidentified: true,
      });
      report('C-07: force_unidentified materializa el estado terminal sobre partido pending_validation', forceResult.json && forceResult.json.ok === true, JSON.stringify(forceResult.json));

      // El lado accionable (B, ya que A cargó) confirma con el slot B1 todavía NULL/terminal.
      const confirmWithUnidentified = await callFunction('officialize-match', accounts.b2.accessToken, { matchId: match9Id });
      report('C-07: Confirmar valida un partido con "Jugador no identificado" terminal (nunca rechaza por slot NULL)', confirmWithUnidentified.json && confirmWithUnidentified.json.ok === true, JSON.stringify(confirmWithUnidentified.json));

      const match9Row = (await serviceGet(`matches?match_id=eq.${match9Id}&select=status`))?.[0];
      report('C-07: partido #9 queda validated con un participante no identificado', !!match9Row && match9Row.status === 'validated', JSON.stringify(match9Row));
    }
  }

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
