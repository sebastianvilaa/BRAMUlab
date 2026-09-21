#!/usr/bin/env node
// BRAMUlab — Bloque 5: verificación contra un proyecto Supabase REAL (partidos compartidos,
// create-or-attach, idempotencia, deduplicación, concurrencia, provisionales relacionadas,
// pendientes, ocultamiento).
//
// Igual que verify-bloque2/3/4.mjs, esto NO es parte de la suite local (tests.html): necesita
// red, las migraciones de Bloque 1-4 + las 3 de Bloque 5
// (20260920180000_bloque5_matches_core.sql, 20260920190000_bloque5_rpcs_read.sql,
// 20260920200000_bloque5_create_or_attach_rpc.sql) aplicadas en ese orden, y la Edge Function
// `create-or-attach-match` desplegada.
//
// Necesita SUPABASE_URL, SUPABASE_ANON_KEY (Publishable Key) y SUPABASE_SERVICE_ROLE_KEY —
// misma nota de seguridad que los scripts anteriores: nunca las pegues en el chat, se leen
// solo de variables de entorno de esta terminal.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node supabase/tests/verify-bloque5.mjs
//
// Qué comprueba (ver docs/BRAMUlab/Implementacion/Backend/Bloque_05/
// {02_Analisis_Claude.md,04_Revision_ChatGPT.md,06_Revision_Pre_Staging_ChatGPT.md}):
//   RLS       — anon no puede llamar ninguna RPC nueva ni la Edge Function; un usuario
//               authenticated no puede leer match_submissions NI matches NI match_participants
//               directo por REST — la única lectura es vía RPC (§5 de la revisión pre-Staging);
//               un no-participante no puede leer el detalle de un partido ajeno (get_match_detail
//               devuelve null, nunca confirma ni niega su existencia).
//   Identidad — partido normal con 4 cuentas reales; registrado + provisional; el MISMO
//               provisional aparece en 2 partidos distintos con el MISMO player_id (creador
//               original y, vía list_related_provisional_players, un co-participante distinto
//               del creador); un claim posterior conserva la relación en ambos partidos sin
//               migrar ninguna fila.
//   Ventanas  — carga >14 días rechazada (played_at_too_old); carga en el futuro rechazada.
//   Idempotencia — dos requests CONCURRENTES con la misma key+payload devuelven el mismo
//               resultado sin duplicar (advisory lock por idempotency_key, §3 de la revisión
//               pre-Staging); un reintento secuencial posterior también; la misma key con
//               payload distinto se rechaza (el hash cubre TODO el payload de negocio, §4).
//   Dedup     — dos cuentas cargan el mismo encuentro con el mismo score → un único match_id,
//               `matched_confirmed`, pero el partido SIGUE `pending_validation` (Bloque 5 nunca
//               marca `validated`, §1 de la revisión pre-Staging) — se registra conformidad
//               (`match_actions` tipo `confirmed`), `validated_at` queda null, Nivel no se
//               toca; equipos A/B invertidos entre las dos cargas igual convergen; score
//               distinto → `matched_revised` (revisión nueva, nunca un partido duplicado);
//               candidato ambiguo (2 partidos plausibles, creados deliberadamente con
//               `disambiguationForceNew`) → `ambiguous_candidates`, nunca auto-merge, resuelto
//               con `disambiguationMatchId`; un `disambiguationMatchId` fuera de la ventana
//               temporal se rechaza explícitamente (§6).
//   Concurrencia — dos cargas simultáneas del mismo encuentro NUEVO (Promise.all) → un único
//               match_id (advisory lock por huella).
//   Nivel     — level_states del jugador no cambia mientras el partido sigue pending_validation,
//               ni siquiera después de una conformidad rival registrada.
//   Historial — visible para los 4 participantes (get_my_matches); no visible para un 5º
//               jugador sin relación; hide_match_for_me oculta solo para quien lo pide.
//   Pendientes — validation_deadline_at queda fijo en +30 días; get_pending_action_count
//               refleja correctamente accionable vs. en espera; con 5 pendientes acumulados,
//               CREAR un partido nuevo se rechaza (pending_action_limit_reached), pero
//               responder/coincidir sobre un partido YA EXISTENTE sigue permitido (§2 de la
//               revisión pre-Staging) — sección aislada con cuentas dedicadas (G/H/I/J/F) para
//               que residuos de otros fixtures nunca contaminen el conteo.
//   Limpieza  — en 2 fases por dependencias FK, mismo patrón que verify-bloque4.mjs.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx SUPABASE_SERVICE_ROLE_KEY=xxxx node supabase/tests/verify-bloque5.mjs');
  process.exit(1);
}

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ' -> ' + detail : ''}`);
  return ok;
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

async function rpcAsAnon(fn, body) {
  return rpcAs(anonKey, anonKey, fn, body);
}

/** Invoca la Edge Function create-or-attach-match con el access token de una cuenta real. */
async function createOrAttach(accessToken, body) {
  const res = await fetch(`${url}/functions/v1/create-or-attach-match`, {
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

async function restAuthed(path, accessToken) {
  return fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
}

async function serviceGet(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  return res.ok ? res.json() : null;
}

async function serviceDelete(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, Prefer: 'return=minimal' },
  });
  return res.ok;
}

function isoDaysAgo(days, hour) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  if (Number.isFinite(hour)) d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function genUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const stamp = Date.now().toString(36);
const cleanup = { authIds: [], playerIds: [], matchIds: [] };

async function createOnboardedAccount(tag, username) {
  const email = `bramu-verify-b5-${tag}-${stamp}@example.com`;
  const password = 'Verificar#Bloque5!';
  const created = await adminCreateConfirmedUser(email, password);
  cleanup.authIds.push(created.id);
  const session = await signIn(email, password);
  const token = session.access_token;
  const ownProfileRes = await restAuthed('profiles?select=player_id', token);
  const ownProfileRows = ownProfileRes.ok ? await ownProfileRes.json() : null;
  const playerId = Array.isArray(ownProfileRows) && ownProfileRows[0] ? ownProfileRows[0].player_id : null;
  if (playerId) cleanup.playerIds.push(playerId);

  await rpcAs(token, anonKey, 'complete_profile', {
    p_username: username, p_first_name: 'Verificacion', p_last_name: `B5${tag}`,
    p_display_name: `Verificacion B5 ${tag}`, p_birth_date: null, p_gender: null,
    p_dominant_hand: null, p_preferred_side: null, p_competitive_branch: null,
    p_location_country_code: null, p_location_province_label: null, p_location_locality_label: null,
    p_terms_version: 'piloto_v1',
  });
  const res = await fetch(`${url}/functions/v1/officialize-onboarding`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'quick', quickSeedKey: 'intermedio' }),
  });
  await res.json().catch(() => null);
  return { authId: created.id, email, password, token, playerId, username };
}

function basicSets() {
  return [{ a: 6, b: 4 }, { a: 6, b: 2 }];
}

function invertedSets(sets) {
  return sets.map((s) => ({ a: s.b, b: s.a }));
}

async function main() {
  // --- 0) cuentas reales onboardeadas ---
  // A/B/C/D: núcleo reusado en dedup/revisión/ambigüedad/concurrencia/idempotencia — su estado
  // acumulado de pendientes entre sí no importa para esas aserciones puntuales.
  // E: SIEMPRE ajena — nunca debe aparecer en match1/match2/match3 antes de su propio test
  // negativo, para que "todavía no está relacionada con el provisional" sea cierto.
  // F/G/H/I/J: dedicadas EXCLUSIVAMENTE a la sección de límite de pendientes
  // (06_Revision_Pre_Staging_ChatGPT.md §8) — nunca aparecen en ningún otro fixture, para que el
  // conteo de F sea determinístico y los creadores G/H/I/J nunca estén bloqueados por residuos
  // de tests anteriores.
  const A = await createOnboardedAccount('a', `vb5a_${stamp}`);
  const B = await createOnboardedAccount('b', `vb5b_${stamp}`);
  const C = await createOnboardedAccount('c', `vb5c_${stamp}`);
  const D = await createOnboardedAccount('d', `vb5d_${stamp}`);
  const E = await createOnboardedAccount('e', `vb5e_${stamp}`);
  const F = await createOnboardedAccount('f', `vb5f_${stamp}`);
  const G = await createOnboardedAccount('g', `vb5g_${stamp}`);
  const H = await createOnboardedAccount('h', `vb5h_${stamp}`);
  const I = await createOnboardedAccount('i', `vb5i_${stamp}`);
  const J = await createOnboardedAccount('j', `vb5j_${stamp}`);

  // --- 1) RLS/seguridad ---
  const anonMy = await rpcAsAnon('get_my_matches', {});
  report('seguridad: get_my_matches rechaza anon', !anonMy.res.ok, `status ${anonMy.res.status}`);
  const anonDetail = await rpcAsAnon('get_match_detail', { p_match_id: genUuid() });
  report('seguridad: get_match_detail rechaza anon', !anonDetail.res.ok, `status ${anonDetail.res.status}`);
  const anonHide = await rpcAsAnon('hide_match_for_me', { p_match_id: genUuid(), p_hidden: true });
  report('seguridad: hide_match_for_me rechaza anon', !anonHide.res.ok, `status ${anonHide.res.status}`);
  const anonPending = await rpcAsAnon('get_pending_action_count', {});
  report('seguridad: get_pending_action_count rechaza anon', !anonPending.res.ok, `status ${anonPending.res.status}`);
  const anonRelated = await rpcAsAnon('list_related_provisional_players', {});
  report('seguridad: list_related_provisional_players rechaza anon', !anonRelated.res.ok, `status ${anonRelated.res.status}`);

  const anonEdge = await createOrAttach(anonKey, { idempotencyKey: genUuid() });
  report('seguridad: la Edge Function create-or-attach-match rechaza sin sesión real', !anonEdge.res.ok, `status ${anonEdge.res.status}`);

  // §5 de 06_Revision_Pre_Staging_ChatGPT.md: NINGUNA de las 7 tablas tiene policy/GRANT de
  // SELECT para `authenticated` — la única lectura es vía RPC. Se prueba explícitamente sobre
  // las 2 tablas más consultadas (matches/match_participants) además de match_submissions.
  const authedReadMatches = await restAuthed('matches?select=match_id', A.token);
  const authedReadMatchesRows = authedReadMatches.ok ? await authedReadMatches.json() : null;
  const authedReadMatchesBlocked = !authedReadMatches.ok || (Array.isArray(authedReadMatchesRows) && authedReadMatchesRows.length === 0);
  report('RLS: un usuario authenticated no puede leer matches directo (solo vía RPC)', authedReadMatchesBlocked, `status ${authedReadMatches.status}`);

  const authedReadParticipants = await restAuthed('match_participants?select=match_id', A.token);
  const authedReadParticipantsRows = authedReadParticipants.ok ? await authedReadParticipants.json() : null;
  const authedReadParticipantsBlocked = !authedReadParticipants.ok || (Array.isArray(authedReadParticipantsRows) && authedReadParticipantsRows.length === 0);
  report('RLS: un usuario authenticated no puede leer match_participants directo (solo vía RPC)', authedReadParticipantsBlocked, `status ${authedReadParticipants.status}`);

  const authedReadSubmissions = await restAuthed('match_submissions?select=idempotency_key', A.token);
  const authedReadSubmissionsRows = authedReadSubmissions.ok ? await authedReadSubmissions.json() : null;
  const authedReadSubmissionsBlocked = !authedReadSubmissions.ok || (Array.isArray(authedReadSubmissionsRows) && authedReadSubmissionsRows.length === 0);
  report('RLS: un usuario authenticated no puede leer match_submissions directo', authedReadSubmissionsBlocked, `status ${authedReadSubmissions.status}`);

  // --- 2) provisional creada por A, usada en el partido A+P vs B+C ---
  const provRes = await rpcAs(A.token, anonKey, 'create_provisional_player', { p_display_name: `Invitado B5 ${stamp}` });
  const provId = provRes.res.ok ? provRes.json.player_id : null;
  if (provId) cleanup.playerIds.push(provId);
  report('setup: A crea una identidad provisional', provRes.res.ok && !!provId, JSON.stringify(provRes.json));

  const playedAt1 = isoDaysAgo(1, 18);
  const create1 = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, provId],
    pair2PlayerIds: [B.playerId, C.playerId],
    rawSets: basicSets(),
    formatId: 'classic',
    playedAtIso: playedAt1,
    playedAtTimeKnown: true,
  });
  const match1Id = create1.json && create1.json.matchId;
  if (match1Id) cleanup.matchIds.push(match1Id);
  report('camino feliz: A crea el partido A+provisional vs B+C', create1.res.ok && create1.json && create1.json.ok && create1.json.code === 'created', JSON.stringify(create1.json));
  report('camino feliz: partido nuevo queda pending_validation con action_side asignado', create1.json && create1.json.status === 'pending_validation' && !!create1.json.actionSide, JSON.stringify(create1.json));

  // --- 3) provisional reutilizada por el MISMO creador en un 2º partido (mismo player_id) ---
  const playedAt2 = isoDaysAgo(2, 18);
  const create2 = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, provId],
    pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: [{ a: 6, b: 1 }, { a: 6, b: 0 }],
    formatId: 'classic',
    playedAtIso: playedAt2,
    playedAtTimeKnown: true,
  });
  const match2Id = create2.json && create2.json.matchId;
  if (match2Id) cleanup.matchIds.push(match2Id);
  report('provisional: el mismo creador la reutiliza en un 2º partido distinto', create2.res.ok && create2.json && create2.json.ok && create2.json.matchId !== match1Id, JSON.stringify(create2.json));

  const provInBothMatches = await serviceGet(`match_participants?select=match_id,player_id&player_id=eq.${provId}`);
  const provMatchIds = Array.isArray(provInBothMatches) ? provInBothMatches.map((r) => r.match_id) : [];
  report('provisional: el MISMO player_id aparece en 2 match_id distintos (test literal de Bloque 4/5)',
    provMatchIds.includes(match1Id) && provMatchIds.includes(match2Id) && provMatchIds.length === 2,
    JSON.stringify(provMatchIds));

  // --- 4) provisional relacionada: B (co-participante de match1, NO creador) la reutiliza ---
  const relatedForB = await rpcAs(B.token, anonKey, 'list_related_provisional_players', {});
  const bSeesProv = relatedForB.res.ok && Array.isArray(relatedForB.json) && relatedForB.json.some((r) => r.player_id === provId && r.relation === 'played_with');
  report('provisional relacionada: B (compartió match1 con el provisional, no la creó) la ve en list_related_provisional_players', bSeesProv, JSON.stringify(relatedForB.json));

  const playedAt3 = isoDaysAgo(3, 18);
  const create3 = await createOrAttach(B.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [B.playerId, provId],
    pair2PlayerIds: [A.playerId, D.playerId],
    rawSets: [{ a: 7, b: 5 }, { a: 6, b: 3 }],
    formatId: 'classic',
    playedAtIso: playedAt3,
    playedAtTimeKnown: true,
  });
  const match3Id = create3.json && create3.json.matchId;
  if (match3Id) cleanup.matchIds.push(match3Id);
  report('provisional relacionada: B (no creador) puede usarla en un 3er partido nuevo', create3.res.ok && create3.json && create3.json.ok, JSON.stringify(create3.json));

  const eAlone = await createOrAttach(E.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [E.playerId, provId],
    pair2PlayerIds: [D.playerId, A.playerId],
    rawSets: basicSets(), formatId: 'classic', playedAtIso: isoDaysAgo(4), playedAtTimeKnown: true,
  });
  const eProvRejected = !eAlone.json || eAlone.json.ok === false;
  report('provisional NO relacionada: E (nunca compartió partido con el provisional hasta este intento) es rechazada',
    eProvRejected && eAlone.json && eAlone.json.code === 'provisional_not_selectable', JSON.stringify(eAlone.json));

  // --- 5) ventanas de tiempo ---
  const tooOld = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: basicSets(), formatId: 'classic', playedAtIso: isoDaysAgo(20), playedAtTimeKnown: true,
  });
  report('ventana: carga de hace 20 días se rechaza (played_at_too_old)', tooOld.json && tooOld.json.ok === false && tooOld.json.code === 'played_at_too_old', JSON.stringify(tooOld.json));

  const inFuture = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: basicSets(), formatId: 'classic',
    playedAtIso: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), playedAtTimeKnown: true,
  });
  report('ventana: carga en el futuro se rechaza (played_at_in_future)', inFuture.json && inFuture.json.ok === false && inFuture.json.code === 'played_at_in_future', JSON.stringify(inFuture.json));

  // --- 6) idempotencia: carrera concurrente sobre la MISMA key, reintento posterior, y payload
  //        distinto con la misma key (06_Revision_Pre_Staging_ChatGPT.md §3/§4) ---
  const idemKey = genUuid();
  const idemPlayedAt = isoDaysAgo(5, 12);
  const idemPayload = {
    idempotencyKey: idemKey,
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: [{ a: 6, b: 2 }, { a: 6, b: 3 }], formatId: 'classic',
    playedAtIso: idemPlayedAt, playedAtTimeKnown: true,
  };
  const [idemRace1, idemRace2] = await Promise.all([
    createOrAttach(A.token, idemPayload),
    createOrAttach(A.token, idemPayload),
  ]);
  const idemMatchId = (idemRace1.json && idemRace1.json.matchId) || (idemRace2.json && idemRace2.json.matchId);
  if (idemMatchId) cleanup.matchIds.push(idemMatchId);
  report('idempotencia: dos requests CONCURRENTES con la misma key+payload devuelven el mismo resultado, sin error',
    idemRace1.res.ok && idemRace2.res.ok && idemRace1.json && idemRace2.json
      && idemRace1.json.matchId === idemRace2.json.matchId && idemRace1.json.code === idemRace2.json.code,
    JSON.stringify({ idemRace1: idemRace1.json, idemRace2: idemRace2.json }));

  const matchesWithIdemKeyCount = await serviceGet(`matches?select=match_id&match_id=eq.${idemMatchId}`);
  report('idempotencia: la carrera concurrente NO creó una segunda fila en matches', Array.isArray(matchesWithIdemKeyCount) && matchesWithIdemKeyCount.length === 1, JSON.stringify(matchesWithIdemKeyCount));

  const idemRetry = await createOrAttach(A.token, idemPayload);
  report('idempotencia: un reintento SECUENCIAL posterior devuelve el MISMO match_id', idemRetry.res.ok && idemRetry.json && idemRetry.json.matchId === idemMatchId, JSON.stringify(idemRetry.json));

  const idemDifferentPayload = await createOrAttach(A.token, Object.assign({}, idemPayload, {
    rawSets: [{ a: 6, b: 0 }, { a: 6, b: 0 }],
  }));
  report('idempotencia: MISMA key con payload DISTINTO (incluye timezone/location/scoringSystem en el hash) se rechaza',
    idemDifferentPayload.json && idemDifferentPayload.json.ok === false && idemDifferentPayload.json.code === 'idempotency_key_reused_with_different_payload',
    JSON.stringify(idemDifferentPayload.json));

  const idemSamePayloadDifferentLocation = await createOrAttach(A.token, Object.assign({}, idemPayload, {
    locationName: 'Un lugar distinto',
  }));
  report('idempotencia: MISMA key con solo locationName distinto también se rechaza (hash cubre todo el payload de negocio)',
    idemSamePayloadDifferentLocation.json && idemSamePayloadDifferentLocation.json.ok === false && idemSamePayloadDifferentLocation.json.code === 'idempotency_key_reused_with_different_payload',
    JSON.stringify(idemSamePayloadDifferentLocation.json));

  // --- 7) deduplicación: misma carga desde la pareja contraria, mismo score → matched_confirmed,
  //        pero el partido SIGUE pending_validation (06_Revision_Pre_Staging_ChatGPT.md §1) ---
  const dedupPlayedAt = isoDaysAgo(6, 20);
  const dedupSets = [{ a: 6, b: 3 }, { a: 6, b: 4 }];
  const dedupCreate = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: dedupSets, formatId: 'classic', playedAtIso: dedupPlayedAt, playedAtTimeKnown: true,
  });
  const dedupMatchId = dedupCreate.json && dedupCreate.json.matchId;
  if (dedupMatchId) cleanup.matchIds.push(dedupMatchId);
  report('dedup: A crea el partido A+B vs C+D', dedupCreate.res.ok && dedupCreate.json && dedupCreate.json.code === 'created', JSON.stringify(dedupCreate.json));

  // C (rival) carga el MISMO encuentro con A/B invertidos como "pair2" y mismo score normalizado
  const dedupConfirm = await createOrAttach(C.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [C.playerId, D.playerId], pair2PlayerIds: [A.playerId, B.playerId],
    rawSets: invertedSets(dedupSets), formatId: 'classic', playedAtIso: dedupPlayedAt, playedAtTimeKnown: true,
  });
  report('dedup: C (rival, A/B invertidos como pair2, score invertido correctamente) converge al MISMO match_id (matched_confirmed)',
    dedupConfirm.res.ok && dedupConfirm.json && dedupConfirm.json.ok && dedupConfirm.json.matchId === dedupMatchId && dedupConfirm.json.code === 'matched_confirmed',
    JSON.stringify(dedupConfirm.json));
  report('dedup: la confirmación NUNCA pone status=validated — Bloque 5 solo registra conformidad (sigue pending_validation)',
    dedupConfirm.json && dedupConfirm.json.status === 'pending_validation' && dedupConfirm.json.readyForValidation === true,
    JSON.stringify(dedupConfirm.json));

  const dedupMatchRow = await serviceGet(`matches?select=status,validated_at,action_side&match_id=eq.${dedupMatchId}`);
  report('dedup: la fila real de matches confirma status=pending_validation, validated_at=null, action_side=null',
    Array.isArray(dedupMatchRow) && dedupMatchRow[0]
      && dedupMatchRow[0].status === 'pending_validation' && dedupMatchRow[0].validated_at === null && dedupMatchRow[0].action_side === null,
    JSON.stringify(dedupMatchRow));

  const dedupActions = await serviceGet(`match_actions?select=action_type&match_id=eq.${dedupMatchId}`);
  const dedupActionTypes = Array.isArray(dedupActions) ? dedupActions.map((a) => a.action_type) : [];
  report('dedup: se registró la acción "confirmed" (nunca "validated") en match_actions',
    dedupActionTypes.includes('confirmed') && !dedupActionTypes.includes('validated'), JSON.stringify(dedupActionTypes));

  const levelAfterConformity = await serviceGet(`level_states?select=player_id,mu,rated_matches&player_id=eq.${A.playerId}`);
  report('Nivel: level_states de A no cambia ni siquiera después de una conformidad rival registrada (Bloque 5 nunca escribe Nivel)',
    Array.isArray(levelAfterConformity) && levelAfterConformity.length === 1 && levelAfterConformity[0].rated_matches === 0,
    JSON.stringify(levelAfterConformity));

  // --- 8) score distinto → matched_revised (nunca un partido duplicado) ---
  const revisePlayedAt = isoDaysAgo(7, 19);
  const reviseCreate = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: [{ a: 6, b: 2 }, { a: 6, b: 2 }], formatId: 'classic', playedAtIso: revisePlayedAt, playedAtTimeKnown: true,
  });
  const reviseMatchId = reviseCreate.json && reviseCreate.json.matchId;
  if (reviseMatchId) cleanup.matchIds.push(reviseMatchId);

  const reviseCorrect = await createOrAttach(D.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [D.playerId, C.playerId], pair2PlayerIds: [A.playerId, B.playerId],
    rawSets: [{ a: 4, b: 6 }, { a: 3, b: 6 }], // D+C dicen que en realidad ganaron ellos
    formatId: 'classic', playedAtIso: revisePlayedAt, playedAtTimeKnown: true,
  });
  report('dedup: score distinto NO crea un partido nuevo, crea una revisión sobre el existente (matched_revised)',
    reviseCorrect.res.ok && reviseCorrect.json && reviseCorrect.json.ok && reviseCorrect.json.matchId === reviseMatchId && reviseCorrect.json.code === 'matched_revised',
    JSON.stringify(reviseCorrect.json));
  const reviseRevisionCount = await serviceGet(`match_revisions?select=revision_number&match_id=eq.${reviseMatchId}`);
  report('dedup: el partido revisado tiene exactamente 2 revisiones (nunca se pisa la original)',
    Array.isArray(reviseRevisionCount) && reviseRevisionCount.length === 2, JSON.stringify(reviseRevisionCount));

  // --- 9) candidato ambiguo: mismos 4, 2 partidos plausibles en la ventana ---
  // El 2º encuentro se crea con `disambiguationForceNew` a propósito: con la misma huella y
  // ventana que el 1º, el algoritmo normal lo adjuntaría como revisión — para el setup de
  // ambigüedad necesitamos DELIBERADAMENTE 2 match_id distintos (06_Revision_Pre_Staging_
  // ChatGPT.md §7).
  const ambigBase = isoDaysAgo(8, 12);
  const ambigCreate1 = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: [{ a: 6, b: 1 }, { a: 6, b: 1 }], formatId: 'classic',
    playedAtIso: new Date(new Date(ambigBase).getTime() - 60 * 60 * 1000).toISOString(), playedAtTimeKnown: true,
  });
  const ambigCreate2 = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: [{ a: 6, b: 2 }, { a: 6, b: 2 }], formatId: 'classic',
    playedAtIso: new Date(new Date(ambigBase).getTime() + 60 * 60 * 1000).toISOString(), playedAtTimeKnown: true,
    disambiguationForceNew: true,
  });
  const ambigMatch1 = ambigCreate1.json && ambigCreate1.json.matchId;
  const ambigMatch2 = ambigCreate2.json && ambigCreate2.json.matchId;
  if (ambigMatch1) cleanup.matchIds.push(ambigMatch1);
  if (ambigMatch2) cleanup.matchIds.push(ambigMatch2);
  report('setup ambigüedad: A creó 2 partidos DISTINTOS a propósito (mismos 4, ventana ±3h de ambos, disambiguationForceNew)',
    !!ambigMatch1 && !!ambigMatch2 && ambigMatch1 !== ambigMatch2 && ambigCreate2.json.code === 'created', `${ambigMatch1} / ${ambigMatch2}`);

  const ambigThird = await createOrAttach(C.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [C.playerId, D.playerId], pair2PlayerIds: [A.playerId, B.playerId],
    rawSets: [{ a: 1, b: 6 }, { a: 1, b: 6 }], formatId: 'classic',
    playedAtIso: ambigBase, playedAtTimeKnown: true,
  });
  report('dedup: candidato ambiguo (2 partidos plausibles) nunca fusiona solo', ambigThird.json && ambigThird.json.ok === false && ambigThird.json.code === 'ambiguous_candidates' && Array.isArray(ambigThird.json.candidates) && ambigThird.json.candidates.length === 2, JSON.stringify(ambigThird.json));

  if (ambigThird.json && ambigThird.json.code === 'ambiguous_candidates') {
    const ambigResolved = await createOrAttach(C.token, {
      idempotencyKey: genUuid(),
      pair1PlayerIds: [C.playerId, D.playerId], pair2PlayerIds: [A.playerId, B.playerId],
      rawSets: [{ a: 1, b: 6 }, { a: 1, b: 6 }], formatId: 'classic',
      playedAtIso: ambigBase, playedAtTimeKnown: true,
      disambiguationMatchId: ambigMatch1,
    });
    report('dedup: la desambiguación explícita resuelve al candidato elegido', ambigResolved.json && ambigResolved.json.ok && ambigResolved.json.matchId === ambigMatch1, JSON.stringify(ambigResolved.json));
  }

  // --- 9bis) disambiguationMatchId fuera de la ventana temporal se rechaza (§6) ---
  const disambigOutOfWindow = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: basicSets(), formatId: 'classic', playedAtIso: isoDaysAgo(13, 9), playedAtTimeKnown: true,
    disambiguationMatchId: dedupMatchId, // dedupMatchId está a isoDaysAgo(6,20): 7 días de diferencia, fuera de ventana
  });
  report('desambiguación: un disambiguationMatchId fuera de la ventana temporal se rechaza (disambiguation_match_id_invalid), nunca adjunta',
    disambigOutOfWindow.json && disambigOutOfWindow.json.ok === false && disambigOutOfWindow.json.code === 'disambiguation_match_id_invalid',
    JSON.stringify(disambigOutOfWindow.json));

  // --- 10) concurrencia: 2 cargas simultáneas del MISMO encuentro NUEVO ---
  const raceSets = [{ a: 6, b: 0 }, { a: 6, b: 0 }];
  const racePlayedAt = isoDaysAgo(9, 17);
  const [raceX, raceY] = await Promise.all([
    createOrAttach(A.token, {
      idempotencyKey: genUuid(),
      pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
      rawSets: raceSets, formatId: 'classic', playedAtIso: racePlayedAt, playedAtTimeKnown: true,
    }),
    createOrAttach(C.token, {
      idempotencyKey: genUuid(),
      pair1PlayerIds: [C.playerId, D.playerId], pair2PlayerIds: [A.playerId, B.playerId],
      rawSets: invertedSets(raceSets), formatId: 'classic', playedAtIso: racePlayedAt, playedAtTimeKnown: true,
    }),
  ]);
  const raceMatchIds = [raceX.json && raceX.json.matchId, raceY.json && raceY.json.matchId].filter(Boolean);
  const raceUniqueIds = [...new Set(raceMatchIds)];
  if (raceUniqueIds[0]) cleanup.matchIds.push(raceUniqueIds[0]);
  report('concurrencia: 2 cargas simultáneas del mismo encuentro nuevo -> un único match_id', raceMatchIds.length === 2 && raceUniqueIds.length === 1, JSON.stringify({ raceX: raceX.json, raceY: raceY.json }));

  // --- 11) historial / visibilidad ---
  const myMatchesA = await rpcAs(A.token, anonKey, 'get_my_matches', { p_limit: 100, p_include_hidden: true });
  const aSeesMatch1 = myMatchesA.res.ok && Array.isArray(myMatchesA.json) && myMatchesA.json.some((m) => m.match_id === match1Id);
  report('historial: A ve match1 en get_my_matches', aSeesMatch1, '');

  const detailForE = await rpcAs(E.token, anonKey, 'get_match_detail', { p_match_id: match1Id });
  report('historial: E (no participa de match1) recibe null, nunca confirma su existencia', detailForE.res.ok && detailForE.json === null, JSON.stringify(detailForE.json));

  const hideRes = await rpcAs(B.token, anonKey, 'hide_match_for_me', { p_match_id: match1Id, p_hidden: true });
  report('ocultar: hide_match_for_me responde ok para un participante real', hideRes.res.ok && hideRes.json && hideRes.json.ok, JSON.stringify(hideRes.json));

  const myMatchesBAfterHide = await rpcAs(B.token, anonKey, 'get_my_matches', { p_limit: 100, p_include_hidden: false });
  const bNoLongerSeesIt = myMatchesBAfterHide.res.ok && Array.isArray(myMatchesBAfterHide.json) && !myMatchesBAfterHide.json.some((m) => m.match_id === match1Id);
  report('ocultar: B ya no ve match1 por default tras ocultarlo', bNoLongerSeesIt, '');

  const myMatchesAAfterBHide = await rpcAs(A.token, anonKey, 'get_my_matches', { p_limit: 100, p_include_hidden: false });
  const aStillSeesIt = myMatchesAAfterBHide.res.ok && Array.isArray(myMatchesAAfterBHide.json) && myMatchesAAfterBHide.json.some((m) => m.match_id === match1Id);
  report('ocultar: A (otro participante) SIGUE viendo match1 — ocultar de B no lo borra para nadie más', aStillSeesIt, '');

  // --- 12) validation_deadline_at fijo a 30 días ---
  const matchRow = await serviceGet(`matches?select=created_at,validation_deadline_at&match_id=eq.${match1Id}`);
  if (Array.isArray(matchRow) && matchRow[0]) {
    const created = new Date(matchRow[0].created_at).getTime();
    const deadline = new Date(matchRow[0].validation_deadline_at).getTime();
    const diffDays = Math.round((deadline - created) / (24 * 3600 * 1000));
    report('deadline: validation_deadline_at = created_at + 30 días exactos', diffDays === 30, `diffDays=${diffDays}`);
  } else {
    report('deadline: validation_deadline_at = created_at + 30 días exactos', false, 'no se pudo leer matches');
  }

  // --- 13) límite de 5 pendientes accionables — sección AISLADA con cuentas dedicadas
  //         (06_Revision_Pre_Staging_ChatGPT.md §8): G/H/I/J crean, F siempre recibe. Ninguna
  //         de las 5 aparece en ningún fixture anterior. ---
  const pendingCreators = [G, H, I, J];
  let pendingCountBefore = null;
  {
    const r = await rpcAs(F.token, anonKey, 'get_pending_action_count', {});
    pendingCountBefore = r.json && r.json.count;
  }
  report('pendientes: F arranca sin pendientes accionables (cuenta dedicada, nunca usada antes)', pendingCountBefore === 0, `count=${pendingCountBefore}`);

  const pendingFixtures = [];
  for (let i = 0; i < 5; i += 1) {
    const partner = pendingCreators[i % pendingCreators.length];
    const rival1 = pendingCreators[(i + 1) % pendingCreators.length];
    const rival2 = pendingCreators[(i + 2) % pendingCreators.length];
    const fixture = {
      pair1PlayerIds: [partner.playerId, rival1.playerId], // partner+rival1 vs rival2+F: F queda del lado sin declarar
      pair2PlayerIds: [rival2.playerId, F.playerId],
      rawSets: [{ a: 6, b: 3 + (i % 3) }, { a: 6, b: 2 }], formatId: 'classic',
      // i+1 (nunca 0): isoDaysAgo(0, hora fija) podría caer en el futuro según a qué hora UTC
      // corra el script — siempre al menos 1 día atrás, y siempre dentro de la ventana de 14
      // días (nunca disparar played_at_too_old por accidente en esta sección).
      playedAtIso: isoDaysAgo(i + 1, 15), playedAtTimeKnown: true,
    };
    // eslint-disable-next-line no-await-in-loop
    const r = await createOrAttach(partner.token, Object.assign({ idempotencyKey: genUuid() }, fixture));
    if (r.json && r.json.matchId) cleanup.matchIds.push(r.json.matchId);
    pendingFixtures.push(Object.assign({ matchId: r.json && r.json.matchId }, fixture));
  }

  const pendingAfter5 = await rpcAs(F.token, anonKey, 'get_pending_action_count', {});
  report('pendientes: F acumula 5 pendientes accionables reales', pendingAfter5.json && pendingAfter5.json.count === 5 && pendingAfter5.json.blocked === true, JSON.stringify(pendingAfter5.json));

  const sixthByF = await createOrAttach(F.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [F.playerId, G.playerId], pair2PlayerIds: [H.playerId, I.playerId],
    rawSets: basicSets(), formatId: 'classic', playedAtIso: isoDaysAgo(10, 16), playedAtTimeKnown: true,
  });
  report('pendientes: con 5 acumulados, CREAR un partido NUEVO se rechaza (pending_action_limit_reached)',
    sixthByF.json && sixthByF.json.ok === false && sixthByF.json.code === 'pending_action_limit_reached', JSON.stringify(sixthByF.json));

  // 06_Revision_Pre_Staging_ChatGPT.md §2/§9: con 5 pendientes, F SIGUE pudiendo responder sobre
  // un encuentro YA EXISTENTE — el límite nunca bloquea un attach/conformidad.
  const firstFixture = pendingFixtures[0];
  if (firstFixture && firstFixture.matchId) {
    const attachWhileAtLimit = await createOrAttach(F.token, {
      idempotencyKey: genUuid(),
      pair1PlayerIds: firstFixture.pair2PlayerIds, // F relabela su propio lado como "pair1"
      pair2PlayerIds: firstFixture.pair1PlayerIds,
      rawSets: invertedSets(firstFixture.rawSets), // mismo resultado, orientación invertida
      formatId: firstFixture.formatId, playedAtIso: firstFixture.playedAtIso, playedAtTimeKnown: true,
    });
    report('pendientes: con 5 acumulados, F SÍ puede responder/coincidir sobre un partido YA EXISTENTE (nunca bloqueado)',
      attachWhileAtLimit.res.ok && attachWhileAtLimit.json && attachWhileAtLimit.json.ok
        && attachWhileAtLimit.json.matchId === firstFixture.matchId && attachWhileAtLimit.json.code === 'matched_confirmed',
      JSON.stringify(attachWhileAtLimit.json));
  } else {
    report('pendientes: con 5 acumulados, F SÍ puede responder/coincidir sobre un partido YA EXISTENTE (nunca bloqueado)', false, 'no se pudo obtener el primer fixture de pendientes');
  }

  const sixthByOther = await createOrAttach(A.token, {
    idempotencyKey: genUuid(),
    pair1PlayerIds: [A.playerId, B.playerId], pair2PlayerIds: [C.playerId, D.playerId],
    rawSets: basicSets(), formatId: 'classic', playedAtIso: isoDaysAgo(12, 16), playedAtTimeKnown: true,
  });
  report('pendientes: el límite de F NUNCA bloquea que otros jugadores sigan cargando partidos', sixthByOther.res.ok && sixthByOther.json && sixthByOther.json.ok, JSON.stringify(sixthByOther.json));
  if (sixthByOther.json && sixthByOther.json.matchId) cleanup.matchIds.push(sixthByOther.json.matchId);

  const allPassed = results.every(Boolean);
  console.log('');
  console.log(allPassed
    ? 'BLOQUE 5 OK: create-or-attach/idempotencia/deduplicación/concurrencia/provisionales relacionadas/pendientes/ocultamiento se comportan como espera 02_Analisis_Claude.md/04_Revision_ChatGPT.md/06_Revision_Pre_Staging_ChatGPT.md.'
    : 'BLOQUE 5: hay fallas — revisar antes de cerrar el bloque.');
  return allPassed;
}

async function cleanupAll() {
  console.log('\nLimpiando cuentas y filas de prueba...');
  const uniqueMatchIds = [...new Set(cleanup.matchIds.filter(Boolean))];
  const uniquePlayerIds = [...new Set(cleanup.playerIds.filter(Boolean))];
  let cleanupOk = true;

  // Fase 1: dependencias de cada match_id, en orden hijo -> padre.
  for (const id of uniqueMatchIds) {
    const okActions = await serviceDelete(`match_actions?match_id=eq.${id}`);
    const okSets = await serviceDelete(`match_sets?match_id=eq.${id}`);
    const okRevisions = await serviceDelete(`match_revisions?match_id=eq.${id}`);
    const okUserState = await serviceDelete(`match_user_state?match_id=eq.${id}`);
    const okParticipants = await serviceDelete(`match_participants?match_id=eq.${id}`);
    const okSubmissions = await serviceDelete(`match_submissions?result_match_id=eq.${id}`);
    if (!okActions || !okSets || !okRevisions || !okUserState || !okParticipants || !okSubmissions) {
      cleanupOk = false;
      console.warn(`ATENCIÓN: limpieza de dependencias incompleta para match_id=${id}.`);
    }
  }
  for (const id of uniqueMatchIds) {
    const ok = await serviceDelete(`matches?match_id=eq.${id}`);
    if (!ok) { cleanupOk = false; console.warn(`ATENCIÓN: no se pudo borrar match_id=${id}.`); }
  }

  // Fase 2: dependencias de cada player_id (provisionales/claims/rate limits/eventos), luego el
  // player_id mismo, en orden inverso al alta (mismo criterio que verify-bloque4.mjs).
  for (const id of uniquePlayerIds) {
    await serviceDelete(`match_submissions?submitted_by_player_id=eq.${id}`);
    await serviceDelete(`match_user_state?player_id=eq.${id}`);
    await serviceDelete(`provisional_claims?created_by_player_id=eq.${id}`);
    await serviceDelete(`provisional_claims?provisional_player_id=eq.${id}`);
    await serviceDelete(`provisional_claims?claimed_by_player_id=eq.${id}`);
    await serviceDelete(`api_rate_limits?player_id=eq.${id}`);
    await serviceDelete(`level_events?player_id=eq.${id}`);
    await serviceDelete(`level_states?player_id=eq.${id}`);
    await serviceDelete(`pilot_events?player_id=eq.${id}`);
  }
  for (const id of [...uniquePlayerIds].reverse()) {
    const ok = await serviceDelete(`players?player_id=eq.${id}`);
    if (!ok) { cleanupOk = false; console.warn(`ATENCIÓN: no se pudo borrar player_id=${id} — revisar a mano en Staging.`); }
  }

  for (const id of cleanup.authIds) {
    const ok = await adminDeleteUser(id);
    if (!ok) { cleanupOk = false; console.warn(`ATENCIÓN: no se pudo borrar la cuenta de Auth ${id} — revisar a mano en Staging.`); }
  }
  console.log(cleanupOk ? 'Limpieza terminada.' : 'Limpieza terminada con advertencias.');
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
