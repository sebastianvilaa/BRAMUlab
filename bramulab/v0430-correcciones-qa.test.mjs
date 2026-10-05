// BRAMUlab — V04.30: correcciones del QA humano de Invitados / Identidad / Pendientes (04/10/2026), lado CLIENTE.
// Ejecutar con: node --test bramulab/v0430-correcciones-qa.test.mjs
// Backend (replay idempotente B2, candidatos stale B3, preview con contexto, recuperados, selfReported):
//   supabase/functions/_shared/v0430-correcciones.test.mjs (Postgres real PGlite, todas las migraciones).
//
// matches.js y player-home.js son módulos puros -> se EJECUTAN en un vm. app.js (DOM + IIFE) se prueba extrayendo funciones por
// marcadores con un entorno falso, más guardas estáticas de estructura/orden/copy.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const cssText = read('styles.css');

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 70)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 70)}`);
  return src.slice(a, b);
}

function loadPH() {
  const sandbox = {}; sandbox.window = sandbox;
  sandbox.window.PLStore = { normalizePlayerName: (r) => (r || '').replace(/\s+/g, ' ').trim().toLowerCase() };
  vm.createContext(sandbox);
  vm.runInContext(read('player-home.js'), sandbox, { filename: 'player-home.js' });
  return sandbox.PLPlayerHome;
}
const PH = loadPH();

function loadMatches(client) {
  const sandbox = { console }; sandbox.window = sandbox;
  sandbox.PLAuth = { isConfigured: () => true, getClient: () => client };
  vm.createContext(sandbox);
  vm.runInContext(read('matches.js'), sandbox, { filename: 'matches.js' });
  return sandbox.PLMatches;
}
const httpError = (status, body) => ({ message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => body } });
const basePayload = { idempotencyKey: 'k', pair1PlayerIds: ['a', 'b'], pair2PlayerIds: ['c', 'd'], rawSets: [{ a: 6, b: 4 }], formatId: 'classic', playedAtIso: '2026-10-01T20:00:00Z', playedAtTimeKnown: true };

/* ================= B2 — clasificación de errores y IDs locales ================= */
test('B2 · createOrAttach distingue negocio / servidor / red (nunca todo "Sin conexión")', async () => {
  const mk = (res) => loadMatches({ functions: { invoke: async () => res }, rpc: async () => ({ data: null, error: null }) });
  const biz = await mk({ data: null, error: httpError(409, { ok: false, code: 'pending_action_limit_reached' }) }).createOrAttach(basePayload);
  assert.equal(biz.code, 'pending_action_limit_reached'); assert.notEqual(biz.serverError, true); assert.notEqual(biz.offline, true);
  const srv = await mk({ data: null, error: httpError(500, { ok: false, code: 'persist_failed' }) }).createOrAttach(basePayload);
  assert.equal(srv.code, 'persist_failed'); assert.equal(srv.serverError, true); assert.notEqual(srv.offline, true);
  const srvNoBody = await mk({ data: null, error: { message: 'x', context: { status: 502, json: async () => { throw new Error('no json'); } } } }).createOrAttach(basePayload);
  assert.equal(srvNoBody.serverError, true);
  const off = await mk({ data: null, error: { message: 'Failed to send a request to the Edge Function' } }).createOrAttach(basePayload);
  assert.equal(off.code, 'network_error'); assert.equal(off.offline, true);
  const ok = await mk({ data: { ok: true, code: 'created', matchId: 'm' }, error: null }).createOrAttach(basePayload);
  assert.equal(ok.ok, true);
});

test('B2 · un ID local de outbox (m_...) nunca viaja a una RPC que espera UUID', async () => {
  const calls = [];
  const M = loadMatches({ rpc: async (fn) => { calls.push(fn); return { data: {}, error: null }; }, functions: { invoke: async () => ({ data: {}, error: null }) } });
  assert.equal((await M.getMatchDetail('m_1700000000_abc')).code, 'invalid_match_id');
  assert.equal((await M.hideMatchForMe('m_local')).code, 'invalid_match_id');
  assert.equal((await M.setMatchPrivateNote('m_local', 'x')).code, 'invalid_match_id');
  assert.deepEqual(calls, [], 'ninguna RPC llamada con id local');
  await M.getMatchDetail('123e4567-e89b-42d3-a456-426614174000');
  assert.deepEqual(calls, ['get_match_detail']);
  assert.equal(M.isServerMatchId('m_x'), false);
  assert.equal(M.isServerMatchId('123e4567-e89b-42d3-a456-426614174000'), true);
});

test('B2 · handleCreateOrAttachOutcome: negocio => necesita_revision (sin outbox sync_pending); 5xx NO dice "Sin conexión"; red real sí', () => {
  const fn = between(appJs, '  async function handleCreateOrAttachOutcome(entry, result, opts) {', '  /** Abre el Resumen de un partido server-backed recién guardado');
  assert.match(fn, /MATCH_BUSINESS_ERROR_CODES\.has\(code\)[\s\S]{0,260}state: 'necesita_revision'/);
  assert.match(fn, /result && result\.serverError[\s\S]{0,200}Hubo un problema al guardar en BRAMU/);
  assert.match(fn, /'Sin conexión — el partido quedó guardado y se va a sincronizar solo\.'/);
  const biz = fn.indexOf("MATCH_BUSINESS_ERROR_CODES.has(code)");
  const trans = fn.indexOf('Hubo un problema al guardar en BRAMU');
  assert.ok(biz < trans, 'el negocio se resuelve ANTES del camino transitorio');
});

test('B2 · el Resumen de un borrador local no pide get_match_detail (renderB6Actions lo corta)', () => {
  const fn = between(appJs, '  async function renderB6Actions(f) {', 'const terminalized = await materializeExpiredIdentityIssues(detailed);');
  assert.match(fn, /isServerMatchId\(f\.matchId\)\) return;/);
  assert.ok(fn.indexOf('isServerMatchId') < fn.indexOf('getMatchDetail'));
});

test('B2 · el toast envuelve mensajes largos dentro del viewport', () => {
  const toast = between(cssText, '.toast{', '.toast.is-visible');
  assert.match(toast, /white-space:\s*normal/);
  assert.match(toast, /max-width:\s*calc\(100vw - 32px\)/);
  assert.doesNotMatch(toast, /white-space:\s*nowrap/);
});

/* ================= B1 — corrección de match conocido ================= */
test('B1 · la corrección pre-validación apunta a ESTE match_id (disambiguationMatchId), nunca a discovery por huella', () => {
  const fn = between(appJs, '  async function submitProposeCorrection() {', '  function initProposeCorrectionSheet() {');
  const call = between(fn, 'result = await Matches.createOrAttach({', 'btn.disabled = false;');
  assert.match(call, /disambiguationMatchId: f\.matchId/);
  // sin idempotencyKey fija: cada envío intencional es un intento nuevo (la key se genera en matches.js)
  assert.doesNotMatch(call, /idempotencyKey/);
});

test('B1 · matches.js reenvía disambiguationMatchId al servidor', async () => {
  let body = null;
  const M = loadMatches({ functions: { invoke: async (_n, { body: b }) => { body = b; return { data: { ok: true }, error: null }; } } });
  await M.createOrAttach({ ...basePayload, disambiguationMatchId: 'mid-1' });
  assert.equal(body.disambiguationMatchId, 'mid-1');
});

/* ================= B3 — NO SOY YO no encadena el modal de duplicados ================= */
test('B3 · tras NO SOY YO / enlace inválido / transitorio NO se encadena syncIdentityRecovery; sin invitación o con "none" sí', () => {
  const rs = between(appJs, '  async function resumeServerSession(opts) {', '  /** Backend Bloque 4 — captura');
  assert.match(rs, /invitation && invitation\.outcome !== 'none'\) return;/);
  assert.ok(rs.indexOf("outcome !== 'none') return;") < rs.indexOf('await syncIdentityRecovery();'));
});

/* ================= Gate de 5 pendientes ================= */
function makeGateEnv({ rpc, cache }) {
  const code = between(appJs, '  async function isNewLoadBlockedByPendingLimit() {', '  function showPendingLimitGate() {');
  const sb = {
    isServerBackedSession: () => true, Matches: { getPendingActionCount: rpc }, PH,
    Store: { loadServerMatchesCache: () => ({ matches: cache || [] }) },
  };
  return new Function(...Object.keys(sb), `${code}\nreturn isNewLoadBlockedByPendingLimit;`)(...Object.values(sb));
}
test('Gate pendientes · 4 accionables: el "+" abre; 5: bloquea (RPC)', async () => {
  assert.equal(await makeGateEnv({ rpc: async () => ({ ok: true, count: 4, limit: 5, blocked: false }) })(), false);
  assert.equal(await makeGateEnv({ rpc: async () => ({ ok: true, count: 5, limit: 5, blocked: true }) })(), true);
});
test('Gate pendientes · sin red cae al conteo local de la caché (4 abre, 5 bloquea)', async () => {
  const pend = (n) => Array.from({ length: n }, (_, i) => ({ matchId: `m${i}`, status: 'pending_validation', isActionMine: true, hidden: false }));
  const offline = async () => ({ ok: false, code: 'network_error' });
  assert.equal(await makeGateEnv({ rpc: offline, cache: pend(4) })(), false);
  assert.equal(await makeGateEnv({ rpc: offline, cache: pend(5) })(), true);
  const throwing = async () => { throw new Error('boom'); };
  assert.equal(await makeGateEnv({ rpc: throwing, cache: pend(5) })(), true);
  // lo que no me toca / corrección post-validación / ocultos NO cuentan
  const noCount = [...pend(4), { matchId: 'x', status: 'pending_validation', isActionMine: false }, { matchId: 'y', status: 'validated', isActionMine: true }, { matchId: 'z', status: 'pending_validation', isActionMine: true, hidden: true }];
  assert.equal(PH.countActionablePending(noCount), 4);
});
test('Gate pendientes · se aplica ANTES del formulario/borrador y ofrece VER PARTIDOS PENDIENTES -> Historial > Pendientes; el servidor sigue siendo la última barrera', () => {
  const fn = between(appJs, '  function openManualLoadScreen(origin, editMatch, gatePassed) {', '  function openManualLoadScreenInner(');
  assert.ok(fn.indexOf('isNewLoadBlockedByPendingLimit') < fn.indexOf('loadManualDraft'), 'gate antes del borrador');
  assert.match(fn, /!editMatch && !gatePassed/);
  const gate = between(appJs, '  function showPendingLimitGate() {', '  function openManualLoadScreen(');
  assert.match(gate, /VER PARTIDOS PENDIENTES/);
  assert.match(gate, /openHistoryScreen\('player-home', null, 'pendientes'\)/);
  assert.match(appJs, /pending_action_limit_reached: 'Tenés 5 partidos pendientes/, 'el rechazo server-side se conserva');
  assert.match(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261004100000_v0430_create_or_attach_idempotent_replay.sql'), 'utf8'), /pending_action_limit_reached/);
});

/* ================= Self-report: NO PARTICIPÉ ================= */
test('Self-report · el propio lugar confirma en primera persona, deja "Por identificar" y NO pide quién jugó; otro participante sí', () => {
  const fn = between(appJs, '  function confirmReportIdentity(matchId, team, positionInTeam, name, opts) {', '  /* ---- Resolver identidad ---- */');
  const selfBranch = fn.slice(0, fn.indexOf('// Handoff cierre UX h13'));
  assert.match(selfBranch, /opts && opts\.isSelf/);
  assert.match(selfBranch, /¿Confirmás que no jugaste este partido\?/);
  assert.match(selfBranch, /'NO PARTICIPÉ'/);
  assert.doesNotMatch(selfBranch, /openIdentityResolveSheet/, 'no pide reemplazo');
  assert.match(fn, /openIdentityResolveSheet\(\{ issueId: result\.issueId/, 'denunciar a OTRO conserva ¿Sabés quién jugó?');
  assert.match(fn, /Sí, no fue/);
  const picker = between(appJs, '  function openReportIdentityPicker() {', '  /** Ronda correctiva Laboratorio h11 (§P4 "identidad incorrecta');
  assert.match(picker, /isSelf: !!\(slot && slot\.userId && slot\.userId === currentUserId\)/);
});

test('Notificación · self-report en primera persona; destino sigue siendo el Resumen (misma notificación derivada)', () => {
  assert.match(appJs, /indicó que no participó en este partido/);
  assert.match(appJs, /n\.payload && n\.payload\.selfReported/);
  assert.match(appJs, /identity_questioned: \(name\) => `\$\{name\} indicó que un jugador cargado no participó`/, 'el copy de tercera persona sigue para el resto');
});

/* ================= Pantalla de partidos recuperados ================= */
test('Post-claim · superficie persistente: vista propia + cards de Historial + acciones SÍ/NO; NO LO JUGUÉ reutiliza el self-report', () => {
  assert.match(indexHtml, /<section id="view-recovered" class="view view--history" hidden>[\s\S]*?PARTIDOS RECUPERADOS[\s\S]*?id="recovered-list"/);
  assert.match(appJs, /'recovered'\]\s*\n?\s*\.forEach/);
  const code = between(appJs, '  function renderRecoveredMatchesScreen() {', '  async function closeRecoveredScreen(markDone) {');
  assert.match(code, /buildHistoryItemElement\(f\)/, 'misma tarjeta que Historial');
  assert.match(code, /SÍ, LO JUGUÉ/); assert.match(code, /NO, NO LO JUGUÉ/);
  assert.match(code, /CONFIRMAR O CORREGIR EL RESULTADO/, 'pendiente accionable valida/corrige desde su Resumen');
  assert.match(code, /confirmReportIdentity\(row\.matchId, mine\.team, mine\.position[\s\S]{0,120}isSelf: true/);
  assert.match(code, /openCanonicalResumen\(f, 'recovered'\)/);
  // un partido validado solo confirma participación: "yes" no llama a ninguna acción de validación
  const yes = between(code, "if (act === 'yes') {", '// NO, NO LO JUGUÉ');
  assert.doesNotMatch(yes, /officializeMatch|MV\./);
  const link = between(appJs, '  async function afterIdentityLinked(result, opts) {', '  /* ---- V04.30 · Partidos recuperados');
  assert.match(link, /saveRecoveredReview\(/);
  assert.match(link, /onboardingDone === false\) return;/, 'en un alta nueva se difiere hasta terminar el onboarding');
  assert.match(appJs, /maybeOpenRecoveredReview\(\)\)\) syncIdentityRecovery\(\)/);
  assert.match(read('auth.js'), /getRecoveredMatchIds/);
});

test('Post-claim · la revisión sobrevive recargas (localStorage por usuario) y "Revisar después" no la pierde', () => {
  const store = {};
  const sb = {
    currentUserId: 'u1', localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    JSON, Object,
  };
  const code = between(appJs, '  const RECOVERED_REVIEW_KEY', '  /** Al arrancar con sesión');
  const f = new Function(...Object.keys(sb), `${code}\nreturn { loadRecoveredReview, saveRecoveredReview, clearRecoveredReview, set(u){ currentUserId = u; } };`)(...Object.values(sb));
  assert.equal(f.loadRecoveredReview(), null);
  f.saveRecoveredReview({ recoveryId: 'r1', answers: { m1: 'yes' }, dismissed: true });
  assert.equal(f.loadRecoveredReview().answers.m1, 'yes');
  f.set('otra-cuenta');
  assert.equal(f.loadRecoveredReview(), null, 'otra cuenta en el mismo dispositivo no la ve');
  f.set('u1'); f.clearRecoveredReview();
  assert.equal(f.loadRecoveredReview(), null);
});

/* ================= Entrada de invitación ================= */
test('Invitación · card contextual en Acceso (antes de auth) y "¿SOS {nombre}?" con el partido fuente', () => {
  assert.match(indexHtml, /id="access-invitation-card"[\s\S]*?Te invitaron a BRAMU/);
  assert.match(appJs, /if \(name === 'access'\) \{ refreshBackendUnavailableNotice\(\); renderAccessInvitationCard\(\); \}/);
  assert.match(indexHtml, /id="invitation-confirm-source"/);
  const fn = between(appJs, '  function askInvitationConfirmation(displayName, token, preview) {', '      const yes = $');
  assert.match(fn, /registró este partido con ese nombre/);
  assert.match(fn, /buildDuplicateMatchCardHTML\(src\)/);
  assert.match(fn, /partido\$\{more === 1 \? '' : 's'\} más/);
  assert.match(appJs, /askInvitationConfirmation\(preview\.displayName, token, preview\)/);
  // NO SOY YO sigue sin consumir el link (solo limpia la intención local)
  const no = between(appJs, 'no.onclick = () =>', 'yes.onclick');
  assert.doesNotMatch(no, /claimProvisionalPlayer/);
});

/* ================= Selector, Historial, Resumen ================= */
test('Selector · una cuenta real NUNCA queda bajo el heading de jugadores sin cuenta; heading con el estilo de RECIENTES', () => {
  const fn = between(appJs, '    // V04.30 — cada grupo bajo SU heading', '    const alreadyOffered');
  assert.match(fn, /load-player-sheet__section-label">Sin cuenta</);
  assert.match(fn, /load-player-sheet__section-label" style="margin-top:12px;">Jugadores</);
  assert.doesNotMatch(appJs, /load-player-sheet__list-label">INVITADOS/);
  const prov = fn.indexOf('provisionals.map(buildProvisionalRowHTML)');
  const lbl = fn.indexOf('>Jugadores<');
  const real = fn.indexOf('realRows.map(buildPlayerRowHTMLFromServerRow)');
  assert.ok(prov < lbl && lbl < real, 'las cuentas reales van bajo su propio heading');
});

test('Homónimos sin cuenta · referencia "jugó con X · fecha" solo con partidos ya visibles', () => {
  const matches = [
    { matchId: 'a', playedAt: '2026-09-20T20:00:00Z', participants: [{ team: 'A', playerId: 'me', displayName: 'Yo' }, { team: 'A', playerId: 'p1', displayName: 'Tomás' }, { team: 'B', playerId: 'x', displayName: 'X' }, { team: 'B', playerId: 'y', displayName: 'Y' }] },
    { matchId: 'b', playedAt: '2026-09-28T20:00:00Z', participants: [{ team: 'A', playerId: 'z', displayName: 'Zeta' }, { team: 'A', playerId: 'p1', displayName: 'Tomás' }, { team: 'B', playerId: 'me', displayName: 'Yo' }, { team: 'B', playerId: 'y', displayName: 'Y' }] },
  ];
  const c = PH.describeProvisionalContext(matches, 'p1', 'me');
  assert.equal(c.companionName, 'Zeta', 'toma el partido más reciente');
  assert.equal(PH.describeProvisionalContext(matches.slice(0, 1), 'p1', 'me').companionName, 'vos', 'si el compañero soy yo: "vos"');
  assert.equal(PH.describeProvisionalContext(matches, 'otro', 'me'), null, 'sin partidos visibles: nada inventado');
  const row = between(appJs, '  function buildProvisionalRowHTML(p) {', '  /** Backend Bloque 5');
  assert.match(row, /Sin cuenta/); assert.match(row, /jugó con/);
});

test('Historial · un nombre SIN CUENTA se marca con semántica de pendiente (amarillo); tras vincular vuelve a lo normal', () => {
  assert.match(cssText, /\.player-name--pending\{ color: var\(--gold\); \}/);
  const code = between(appJs, '  let provisionalIdSet = new Set();', '  /** V04.30 — arma UNA tarjeta de Historial');
  const sb = { Matches: { listRelatedProvisionalPlayers: async () => ({ ok: true, players: [{ player_id: 'p1' }] }) }, isServerBackedSession: () => true, $: () => ({ hidden: true }), renderHistory() {}, escapeHtml: (s) => String(s), Set, Array };
  const f = new Function(...Object.keys(sb), `${code}\nreturn { refreshProvisionalIdSet, buildTeamLabelHTML };`)(...Object.values(sb));
  const players = [{ team: 'A', userId: 'p1', name: 'Tomás' }, { team: 'A', userId: 'u2', name: 'Seba' }];
  assert.equal(f.buildTeamLabelHTML(players, 'A'), 'Tomás / Seba', 'antes de conocer provisionales: normal');
  return f.refreshProvisionalIdSet().then(() => {
    assert.match(f.buildTeamLabelHTML(players, 'A'), /<span class="player-name--pending" title="Sin cuenta">Tomás<\/span> \/ Seba/);
  });
});

test('Resumen · bloque sin cuenta: ícono + nombre + CTA "INVITAR A {NOMBRE}" pegados', () => {
  const fn = between(appJs, '  async function renderAnalysisGuests(f) {', '  /** B2');
  assert.match(fn, /guests-row__icon/); assert.match(fn, /INVITAR A \$\{escapeHtml\(name\.toLocaleUpperCase/);
  assert.match(cssText, /\.guests-row\{ display:flex; flex-direction:column;/);
});

test('Alta · feedback en tiempo real de coincidencia de contraseñas (sin tocar reglas de Auth)', () => {
  assert.match(indexHtml, /id="signup-password-match"/);
  assert.match(appJs, /Las contraseñas coinciden/); assert.match(appJs, /Las contraseñas no coinciden/);
  assert.match(appJs, /\$\('#signup-password'\)\.addEventListener\('input', refreshPasswordMatch\)/);
});

test('Intelligence · el insight de un partido pendiente aclara que puede cambiar al validar', () => {
  assert.match(appJs, /pueden cambiar cuando se valide/);
});

test('Versionado V04.30 / 04.30-h1 coherente', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.30', bundle: '04.30-h1' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.30'/);
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.30-h1'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-30-h1'/);
  assert.match(indexHtml, /app\.js\?v=04\.30-h1/);
});
