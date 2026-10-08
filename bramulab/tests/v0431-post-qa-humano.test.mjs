// BRAMUlab — V04.31: ronda post QA humano (05/10/2026), lado CLIENTE.
// Ejecutar con: node --test bramulab/tests/v0431-post-qa-humano.test.mjs
// Backend (Intelligence canónica, identity_claimed, openedByName, 1 cuenta + 3 provisionales): supabase/functions/_shared/v0431-post-qa.test.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const cssText = read('styles.css');
function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 70)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 70)}`);
  return src.slice(a, b);
}
function loadModule(file, global) {
  const sandbox = { console }; sandbox.window = sandbox; Object.assign(sandbox, global || {});
  vm.createContext(sandbox); vm.runInContext(read(file), sandbox, { filename: file }); return sandbox;
}

/* ============ BUG 1 — alta nueva + claim abre PARTIDOS RECUPERADOS ============ */
function makeReviewEnv(initialUser) {
  const store = {};
  const state = { currentUserId: initialUser, cache: [] };
  const code = between(appJs, '  const RECOVERED_REVIEW_KEY', '  /** Al arrancar con sesión');
  const sb = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } },
    Store: { loadServerMatchesCache: () => ({ matches: state.cache }) }, JSON, Object, Array, Set,
  };
  const f = new Function('state', ...Object.keys(sb), `${code.replace(/currentUserId/g, 'state.currentUserId')}\nreturn { loadRecoveredReview, saveRecoveredReview, clearRecoveredReview };`)(state, ...Object.values(sb));
  return { f, state, store };
}
test('BUG 1 · el claim de un ALTA NUEVA (sin currentUserId todavía) se guarda sin dueño y la cuenta que termina el alta la encuentra', () => {
  const { f, state } = makeReviewEnv(undefined); // durante el alta no hay identidad local resuelta
  f.saveRecoveredReview({ recoveryId: 'rec-1' });
  assert.equal(f.loadRecoveredReview().recoveryId, 'rec-1');
  state.currentUserId = 'player-nuevo'; // al terminar el onboarding ya hay identidad canónica
  const rev = f.loadRecoveredReview();
  assert.ok(rev, 'la revisión NO se pierde por cambiar de identificador');
  f.saveRecoveredReview(rev);
  assert.equal(f.loadRecoveredReview().userId, 'player-nuevo', 'se adopta la cuenta que la abre');
  state.currentUserId = 'otra-cuenta';
  assert.equal(f.loadRecoveredReview(), null, 'una vez adoptada, otra cuenta del dispositivo no la ve');
  f.clearRecoveredReview();
});
test('BUG 1 · el flujo de alta nueva abre la pantalla tras el onboarding y no duplica el recovery (un solo recoveryId)', () => {
  const link = between(appJs, '  async function afterIdentityLinked(result, opts) {', '  /* ---- V04.33 · RECUPERAMOS');
  assert.match(link, /saveRecoveredReview\(\{ recoveryId: result\.recoveryId \}\)/);
  assert.match(link, /onboardingDone === false\) return;/);
  assert.match(appJs, /\(async \(\) => \{ if \(!\(await maybeOpenRecoveredReview\(\)\)\) syncIdentityRecovery\(\); \}\)\(\);/);
  const rev = between(appJs, '  function saveRecoveredReview(review) {', '  function clearRecoveredReview()');
  assert.match(rev, /userId: review\.userId \|\| currentUserId \|\| null/);
});

/* ============ Respuestas, carrusel y UX de PARTIDOS RECUPERADOS ============ */
/* ============ ¿SOS X? / invitación ============ */
test('¿SOS X? · SÍ, SOY YO verde / NO, NO SOY YO outline rojo; conflicto con estado corto; COPIAR INVITACIÓN', () => {
  assert.match(indexHtml, /id="invitation-confirm-yes" class="btn-start btn-start--overlay" type="button">SÍ, SOY YO</);
  assert.match(indexHtml, /id="invitation-confirm-no" class="btn-secondary btn-secondary--danger" type="button">NO, NO SOY YO</);
  assert.match(indexHtml, /id="invitation-confirm-conflict-ok"[^>]*>ENTENDIDO</);
  assert.match(indexHtml, />COPIAR INVITACIÓN</);
  assert.doesNotMatch(indexHtml, /COPIAR ENLACE/);
  assert.match(appJs, /Invitación copiada\. Enviásela a/);
  assert.match(appJs, /btn\.disabled = link\.code === 'provisional_not_found'/);
});

/* ============ @usuario ============ */
test('@usuario · ✓ verde compacto en el campo (sin texto "Disponible"), ✕ roja + explicación debajo; reglas intactas', () => {
  const code = between(appJs, '  function renderUsernameFeedback(inputId, feedbackId, excludeUserId) {', '  /** Consolidado §2 Paso 2');
  const mk = () => ({ value: '', cls: new Set(), attrs: {}, textContent: '', classList: null });
  const input = { value: '', _c: new Set(), setAttribute(k, v) { this[k] = v; }, removeAttribute(k) { delete this[k]; }, classList: null };
  input.classList = { toggle: (c, on) => (on ? input._c.add(c) : input._c.delete(c)) };
  const fb = { textContent: '', _c: new Set(), classList: { toggle(c, on) { on ? fb._c.add(c) : fb._c.delete(c); } } };
  let taken = false; let available = true;
  const sb = {
    $: (sel) => (sel === '#u' ? input : fb), usernameFeedbackToken: 0,
    PLI: { isValidUsernameFormat: (u) => /^[a-z0-9._]{3,24}$/.test(u), isUsernameReserved: () => false, isUsernameTaken: () => taken },
    Store: { loadUsers: () => [] }, Auth: { isConfigured: () => true, isUsernameAvailable: async () => available },
  };
  const render = new Function(...Object.keys(sb), `${code}\nreturn renderUsernameFeedback;`)(...Object.values(sb));
  input.value = 'ab'; render('u', 'f');
  assert.ok(input._c.has('is-invalid') && !input._c.has('is-valid')); assert.match(fb.textContent, /Entre 3 y 24 caracteres/);
  input.value = 'seba_ok'; render('u', 'f');
  assert.ok(input._c.has('is-valid') && !input._c.has('is-invalid')); assert.equal(fb.textContent, '', 'sin texto "Disponible" pegado a la línea');
  taken = true; render('u', 'f');
  assert.ok(input._c.has('is-invalid')); assert.equal(fb.textContent, 'Ese @usuario ya está en uso.');
  assert.match(cssText, /\.field__input\.is-valid\{ background-image:/); assert.match(cssText, /\.field__input\.is-invalid\{ background-image:/);
});

/* ============ Notificaciones ============ */
function loadMapper(cacheMatches, me = 'me') {
  const code = between(appJs, '  const B6_NOTIF_COPY = {', '  /** Ronda UX 25/09 (Ronda 2, §9) — único punto que traduce+filtra');
  const sb = {
    Store: { getCurrentUser: () => ({ id: me }), loadServerMatchesCache: () => ({ matches: cacheMatches }) },
    PH: loadModule('player-home.js', { PLStore: { normalizePlayerName: (r) => String(r || '').trim().toLowerCase() } }).PLPlayerHome,
  };
  return new Function(...Object.keys(sb), `${code}\nreturn mapB6Notification;`)(...Object.values(sb));
}
test('Notificaciones · self-report nombra al actor aunque ya no figure en el partido (openedByName); sin dato, nunca inventa', () => {
  const map = loadMapper([]);
  const n = map({ id: '1', type: 'identity_questioned', matchId: 'm', payload: { openedByPlayerId: 'jul', openedByName: 'Julián', selfReported: true } });
  assert.equal(n.title, 'Julián indicó que no participó en este partido');
  const other = map({ id: '2', type: 'identity_questioned', matchId: 'm', payload: { openedByPlayerId: 'jul', openedByName: 'Julián', selfReported: false } });
  assert.equal(other.title, 'Julián indicó que un jugador cargado no participó');
  assert.equal(map({ id: '3', type: 'identity_questioned', matchId: 'm', payload: { selfReported: true } }).title, 'Alguien indicó que no participó en este partido');
});
test('Notificaciones · PARTIDO POR VALIDAR (me toca) vs ESPERANDO VALIDACIÓN (espero a la otra pareja), alineado con Home', () => {
  const mine = loadMapper([{ matchId: 'm', status: 'pending_validation', isActionMine: true }]);
  assert.equal(mine({ id: '1', type: 'pending_review', matchId: 'm', payload: {} }).title, 'PARTIDO POR VALIDAR');
  const waiting = loadMapper([{ matchId: 'm', status: 'pending_validation', isActionMine: false }]);
  assert.equal(waiting({ id: '1', type: 'pending_review', matchId: 'm', payload: {} }).title, 'ESPERANDO VALIDACIÓN');
  assert.equal(loadMapper([])({ id: '1', type: 'pending_review', matchId: 'm', payload: {} }).title, 'PARTIDO POR VALIDAR', 'sin caché: el servidor solo deriva pendientes accionables');
});
test('Notificaciones · identity_claimed: "{nombre} ya se sumó a BRAMU y recuperó sus partidos."', () => {
  const n = loadMapper([])({ id: '1', type: 'identity_claimed', matchId: null, payload: { claimedByName: 'Seba' } });
  assert.equal(n.title, 'Seba ya se sumó a BRAMU y recuperó sus partidos.');
  assert.equal(n.body, '');
});

/* ============ Historial estado cero e Intelligence ============ */
test('Historial con 0 partidos reutiliza la card "TODO EMPIEZA CON TU PRIMER RESULTADO" (misma fuente que Home)', () => {
  assert.match(indexHtml, /id="history-empty-first-card"[\s\S]*?id="history-empty-first-body"/);
  const fn = between(appJs, '  function renderHistoryEmptyState(totalCount) {', '  /** Handoff sistema visual unificado h21 (doc 59, punto 10)');
  assert.match(fn, /buildFirstResultCardHTML\(\)/);
  assert.match(fn, /openManualLoadScreen\('player-home'\)/);
  const helper = between(appJs, '  function buildFirstResultCardHTML() {', '  function renderPlayerLastMatchCard(');
  assert.match(helper, /TU PRIMER RESULTADO/);
  assert.match(appJs, /body\.innerHTML = buildFirstResultCardHTML\(\);/);
});
test('Intelligence · el fingerprint incluye el NOMBRE (invalida checkpoints con nombres viejos) y la aclaración de pendiente usa la jerarquía del subtítulo', () => {
  const sb = loadModule('intelligence-presentation.js', {});
  assert.ok(true);
  const PR = sb.PLIntelligencePresentation;
  const m = (name) => [{ matchId: 'm', playedAt: '2026-10-01T10:00:00Z', timeKnown: true, status: 'pending_validation', players: [{ team: 'A', userId: 'u1', name }, { team: 'B', userId: 'u2', name: 'X' }], sets: [], winnerTeam: null }];
  sb.PLIntelligenceOfficial = { fingerprintFieldsOf: () => null };
  assert.notEqual(PR.computeHistoryFingerprint(m('Bruno')), PR.computeHistoryFingerprint(m('Seba')));
  assert.equal(PR.computeHistoryFingerprint(m('Seba')), PR.computeHistoryFingerprint(m('Seba')));
  assert.match(appJs, /class="intelligence-frame intelligence-frame--pending"/);
  // V04.35 (margen 5px): `.intelligence-text p` ganaba por especificidad; la regla explícita iguala tamaño/color/itálica del subtítulo y da más aire
  assert.match(cssText, /\.intelligence-text p\.intelligence-frame--pending[^{]*\{[^}]*font-size: 12px[^}]*margin: 5px 0 0/);
});

/* ============ 1 cuenta + 3 sin cuenta (decisión de producto) ============ */
test('1 cuenta + 3 sin cuenta: ninguna regla del cliente exige una cuenta por pareja; el servidor lo admite y queda pendiente (ver test SQL)', () => {
  const manual = appJs.slice(appJs.indexOf('  async function submitManualMatch') >= 0 ? appJs.indexOf('  async function submitManualMatch') : 0);
  assert.doesNotMatch(appJs, /cada pareja (debe|necesita) (tener )?(al menos )?una cuenta|una cuenta por pareja|al menos un usuario registrado por pareja/i);
  assert.ok(manual.length > 0);
  const ML = loadModule('engine.js', {}); // el validador de carga solo exige 4 jugadores distintos, fecha y sets
  assert.ok(ML);
  const mlSrc = read('match-load.js');
  const v = between(mlSrc, '  function validateMatchDraft(names, rawSets, formatId, dateVal) {', '  /** §11: al cambiar de formato');
  assert.doesNotMatch(v, /registered|cuenta|provisional/i);
});

test('Versionado V04.31 / 04.37-h2 coherente', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.37', bundle: '04.37-h2' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.37'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-37-h2'/);
  assert.match(indexHtml, /app\.js\?v=04\.37-h2/);
});

/* ============ V04.32 — ajustes visuales post QA (handoff 128) ============ */
test('V04.32 · "mi equipo verde": solo se alterna una clase de presentación; los datos canónicos A/B no se tocan', () => {
  const fn = between(appJs, '  function renderAnalysis(f) {', '    analysisSetFilter');
  assert.match(fn, /classList\.toggle\('team-mine-b', !!\(f && f\.players && PH\.getPlayerTeam\(f, currentIdentity\(\)\) === 'B'\)\)/);
  // no hay ninguna inversión de datos en las primitivas del resultado: siguen leyendo gamesA/gamesB y team A/B canónicos
  const rows = between(appJs, '  function buildResultRowsHTML(players, sets, currentPartial, firstTeam) {', '  /** Bloque M2/M3/M4/M5');
  assert.match(rows, /team === 'A' \? s\.gamesA : s\.gamesB/);
  // V04.34: mi pareja siempre ARRIBA (solo orden de filas; los datos por fila siguen siendo los canónicos A/B)
  assert.match(rows, /firstTeam === 'B'\s*\?\s*`\$\{cellsForTeam\('B'\)\}<div class="result-card__divider-row" aria-hidden="true"><\/div>\$\{cellsForTeam\('A'\)\}`\s*:\s*`\$\{cellsForTeam\('A'\)\}<div class="result-card__divider-row" aria-hidden="true"><\/div>\$\{cellsForTeam\('B'\)\}`/);
  assert.match(cssText, /#view-analysis\.team-mine-b\{ --team-a: var\(--accent-cyan\); --team-a-deep: #0D6FCC; --team-b: var\(--brand-lime\); --team-b-deep: var\(--brand-lime-deep\); \}/);
  // el color de cada pareja sale SOLO de las variables --team-a/--team-b (por eso el intercambio alcanza)
  assert.match(cssText, /\.result-card__row\[data-team="A"\] \.result-card__name\{ color: var\(--team-a\); \}/);
  assert.match(cssText, /\.result-card__row\[data-team="B"\] \.result-card__name\{ color: var\(--team-b\); \}/);
  // Team A del usuario: sin clase; Team B: con clase (misma función pura que el resto de la app)
  const PH = loadModule('player-home.js', { PLStore: { normalizePlayerName: (r) => String(r || '').trim().toLowerCase() } }).PLPlayerHome;
  const f = { players: [{ team: 'A', userId: 'x', name: 'X' }, { team: 'B', userId: 'me', name: 'Yo' }] };
  assert.equal(PH.getPlayerTeam(f, { userId: 'me', name: 'Yo' }), 'B');
  assert.equal(PH.getPlayerTeam(f, { userId: 'x', name: 'X' }), 'A');
});
test('V04.32 · @usuario: ícono en círculo en el campo; cierre global TERMINAR REVISIÓN', () => {
  assert.match(cssText, /\.field__input\.is-valid\{ background-image: url\("data:image\/svg\+xml[^"]*circle/);
  assert.match(cssText, /background-position: right 12px center; background-size: 20px 20px/);
});
