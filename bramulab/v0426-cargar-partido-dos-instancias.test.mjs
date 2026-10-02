// BRAMUlab V04.26 — Cargar partido en dos instancias (Jugadores → Resultado) con wheel A/B.
// Ejecuta las funciones REALES de app.js en un sandbox con DOM stub + motor real (engine/stats/match-load).
// Ejecutar con: node --test bramulab/v0426-cargar-partido-dos-instancias.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const app = read('app.js'), css = read('styles.css'), html = read('index.html'), sw = read('sw.js');

const eng = { window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
eng.window = eng; vm.createContext(eng);
['engine.js', 'stats.js', 'store.js', 'match-load.js'].forEach((f) => vm.runInContext(read(f), eng, { filename: f }));
const E = eng.PLEngine, ML = eng.PLMatchLoad, S = eng.PLStats;

function fnSource(name) {
  let i = app.indexOf(`  function ${name}(`); if (i < 0) i = app.indexOf(`  async function ${name}(`); assert.ok(i >= 0, name);
  const j = app.indexOf('\n  }\n', i); return app.slice(i, j + 5);
}
const NAMES = ['manualRosterComplete', 'manualNeededSlots', 'manualSetIsConfirmed', 'manualHasLoadedResult', 'discardManualResult',
  'loadManualDraftFromSet', 'goToManualResultStep', 'changeManualPlayers', 'syncManualResultChrome', 'renderManualResultCard',
  'manualWheelOptions', 'renderManualWheel', 'paintManualWheelSelection', 'renderManualWheels', 'setManualWheelValue',
  'reopenManualSet', 'commitCurrentManualSetIfValid', 'pruneOrphanThirdSet', 'renderManualScoreboard', 'recomputeManualValidation',
  'manualCurrentDraft', 'escapeHtml', 'buildWinnersBannerHTML', 'buildSetsGamesSummaryHTML', 'applyManualFormatChange'];

function makeApp(formatId = 'classic', players = ['Seba', 'Gusti', 'Esteban', 'Diego']) {
  const els = {};
  const mk = () => ({ innerHTML: '', textContent: '', hidden: false, disabled: false, value: '2026-10-02', dataset: {}, scrollTop: 0,
    classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll: () => [], setAttribute() {}, style: { setProperty() {} }, offsetHeight: 0 });
  const ctx = { E, ML, S, confirms: [], Store: { getCurrentUser: () => null }, document: { documentElement: { style: { setProperty() {} } } } };
  ctx.$ = (sel) => (els[sel] = els[sel] || mk());
  ctx.$all = () => [];
  vm.createContext(ctx);
  vm.runInContext(`
    var manualSets = [null, null, null], manualActiveSetIndex = 0, manualDraftSet = { a: undefined, b: undefined },
      manualDecided = false, manualStep = 'players', manualWheelOpen = false, manualWheelAnchor = null,
      manualSelectedFormatId = '${formatId}', manualSelectedScoring = 'golden', manualServerBacked = false, manualSaveAttempted = false,
      manualSaveInFlight = false, MANUAL_WHEEL_ITEM_H = 40,
      manualPlayers = { a1: '${players[0] || ''}', a2: '${players[1] || ''}', b1: '${players[2] || ''}', b2: '${players[3] || ''}' },
      manualPlayerIds = { a1: null, a2: null, b1: null, b2: null };
    var MANUAL_SCORING_LINE_LABELS = { golden: 'Punto de Oro' };
    var MANUAL_ERROR_MESSAGES = {}; var MANUAL_INLINE_REASONS = new Set(['third-set-missing']);
    function manualPlayerNamesArray() { return [manualPlayers.a1, manualPlayers.a2, manualPlayers.b1, manualPlayers.b2]; }
    function markManualLoadDirty() {}
    function renderManualPlayers() {}
    function confirmAction(t, m, ok, cancel) { confirms.push(t); ok(); }
    ${NAMES.map(fnSource).join('\n')}
  `, ctx);
  const get = (n) => vm.runInContext(n, ctx);
  const run = (code) => vm.runInContext(code, ctx);
  const wheel = (side, v) => run(`setManualWheelValue('${side}', ${v === undefined ? 'undefined' : v})`);
  const enter = (a, b) => { wheel('a', a); wheel('b', b); run('commitCurrentManualSetIfValid()'); };
  return {
    ctx, run, get, wheel, enter, els,
    go: () => run('goToManualResultStep()'),
    reopen: (i) => run(`reopenManualSet(${i})`),
    state: () => JSON.parse(JSON.stringify({ sets: get('manualSets').map((s) => s && [s.a, s.b]), active: get('manualActiveSetIndex'), open: get('manualWheelOpen'),
      decided: get('manualDecided'), step: get('manualStep'), draft: [get('manualDraftSet').a, get('manualDraftSet').b], anchor: get('manualWheelAnchor') })),
    opts: (side) => JSON.parse(JSON.stringify(run(`manualWheelOptions('${side}')`))),
  };
}

/* ---------------- Instancia JUGADORES ---------------- */
test('1) roster incompleto → CARGAR RESULTADO deshabilitado; completo → habilitado (sin autoavance)', () => {
  assert.match(html, /<button type="button" id="manual-go-result-btn" class="btn-start mp-cta" disabled>CARGAR RESULTADO<\/button>/);
  const h3 = makeApp('classic', ['Seba', 'Gusti', 'Esteban', '']);
  assert.equal(h3.run('manualRosterComplete()'), false);
  assert.equal(makeApp().run('manualRosterComplete()'), true);
  const server = makeApp();
  server.run("manualServerBacked = true; manualPlayerIds = { a1: { playerId: 'x' }, a2: { playerId: 'y' }, b1: { playerId: 'z' }, b2: null };");
  assert.equal(server.run('manualRosterComplete()'), false, 'server-backed exige player_id real en los cuatro slots');
  assert.match(fnSource('renderManualPlayers'), /cta\.disabled = !manualRosterComplete\(\)/);
});
test('2) completar el cuarto jugador NO pasa a Resultado: solo el toque en CARGAR RESULTADO', () => {
  for (const n of ['selectManualPlayer', 'advanceManualSelectionSequence', 'renderManualPlayers', 'ensureManualPlayerCompact']) {
    assert.doesNotMatch(fnSource(n), /goToManualResultStep|manualStep = 'result'|openManualKeypad/, n);
  }
  assert.match(app, /\$\('#manual-go-result-btn'\)\.addEventListener\('click', goToManualResultStep\)/);
});
test('tarjetas de equipo: borde completo A verde / B celeste, VS existente, filas = .player-row canónico', () => {
  assert.match(css, /\.mp-team\{[^}]*border: 1px solid var\(--line\)[^}]*border-radius: var\(--radius-card\)/);
  assert.match(css, /\.mp-team--a\{ border-color: rgba\(149,255,25/); assert.match(css, /\.mp-team--b\{ border-color: rgba\(25,159,255/);
  assert.doesNotMatch(css.slice(css.indexOf('V04.26 — CARGAR PARTIDO')), /linear-gradient\(135deg/, 'sin degradés grandes nuevos');
  assert.ok(html.indexOf('mp-team--a') < html.indexOf('vs-divider vs-divider--compact') && html.indexOf('vs-divider vs-divider--compact') < html.indexOf('mp-team--b'));
  const row = fnSource('buildManualSlotRowHTML');
  assert.match(row, /buildCompactPlayerRowHTML\(/); assert.match(row, /buildProvisionalRowHTML\(/); assert.match(row, /buildPlayerRowHTML\(name/);
  assert.match(row, /\+ Agregar compañero|MANUAL_SLOT_ADD_LABEL\[slot\]/); assert.match(app, /'\+ Agregar compañero'/); assert.match(app, /'\+ Agregar rival'/);
  assert.doesNotMatch(row, /username: .*\|\| '@/, 'nunca inventa @usuario');
});
test('4) la metadata (formato/fecha/hora/lugar) queda FUERA de ambas instancias y se conserva al pasar a Resultado', () => {
  const meta = html.indexOf('class="court-meta-compact"');
  assert.ok(meta > 0 && meta < html.indexOf('id="manual-step-players"') && meta < html.indexOf('id="manual-step-result"'));
  const sync = fnSource('syncManualResultChrome');
  assert.doesNotMatch(sync, /court-meta-compact|manual-date-input/);
  assert.doesNotMatch(fnSource('goToManualResultStep'), /manual-date-input|manual-place-input|manual-time-input/);
});

/* ---------------- Instancia RESULTADO: wheel + reglas ---------------- */
test('3) pasar a Resultado abre el wheel en el Set 1; Fecha/Hora/Lugar no se tocan', () => {
  const h = makeApp(); h.go();
  const s = h.state(); assert.equal(s.step, 'result'); assert.equal(s.open, true); assert.equal(s.active, 0); assert.equal(s.decided, false);
  assert.match(h.els['#manual-result-card'].innerHTML, /result-card--editable/);
});
test('5) carga 2-0: 6-3 + 6-4 deja el partido decidido y cierra el wheel', () => {
  const h = makeApp(); h.go(); h.enter(6, 3);
  assert.deepEqual(h.state().sets[0], [6, 3]); assert.equal(h.state().active, 1); assert.equal(h.state().open, true);
  h.enter(6, 4);
  const s = h.state(); assert.equal(s.decided, true); assert.equal(s.open, false); assert.deepEqual(s.sets.slice(0, 2), [[6, 3], [6, 4]]);
});
test('6) 1-1 abre el Set 3 con el wheel abierto', () => {
  const h = makeApp(); h.go(); h.enter(2, 6); h.enter(6, 3);
  const s = h.state(); assert.equal(s.decided, false); assert.equal(s.active, 2); assert.equal(s.open, true);
  assert.match(h.els['#manual-result-card'].innerHTML, /SET 3/);
});
test('7) el wheel refleja el valor en la result-card en vivo (render + preview durante el scroll)', () => {
  const h = makeApp(); h.go(); h.wheel('a', 6);
  assert.match(h.els['#manual-result-card'].innerHTML, /result-card__set--edit is-active"[^>]*data-set-index="0" data-side="a"[^>]*>6</);
  const prev = fnSource('previewManualWheel'); assert.match(prev, /\.is-active\[data-side=/); assert.match(app, /previewManualWheel\(side, manualWheelValueAt\(el, idx\)\)/);
});
test('8) reglas inválidas no pueden producir un score inválido: opciones del motor + el otro lado se vacía si el par deja de ser válido', () => {
  const fmt = E.FORMATS.classic;
  const h = makeApp(); h.go();
  const J = (v) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(h.opts('a'), J(ML.computeValidNextDigits('', fmt, undefined).map(Number)));
  h.wheel('a', 6);
  assert.deepEqual(h.opts('b'), J(ML.computeValidNextDigits('', fmt, 6).map(Number)), 'B queda restringido por A (motor)');
  assert.ok(!h.opts('b').includes(6) && h.opts('b').every((v) => E.isValidCompletedSetScore(6, v, fmt)));
  h.wheel('b', 3); assert.deepEqual(h.state().draft, [6, 3]);
  h.wheel('a', 3);                                       // 3-3 no es un set completo válido
  assert.deepEqual(h.state().draft, [3, undefined].map((v) => v === undefined ? null : v), 'B se vacía: nunca queda un par inválido');
  assert.equal(h.run('E.isValidCompletedSetScore(manualDraftSet.a, manualDraftSet.b || 0, E.FORMATS.classic)'), false);
  const done = fnSource('renderManualWheels'); assert.match(done, /isValidCompletedSetScore/);
  assert.equal(h.els['#manual-wheel-done'].disabled, true, 'LISTO deshabilitado con el par incompleto');
});
test('9) reabrir Set 1 completo con Set 3 pendiente: modificar A y B NO cierra la edición ni pisa el set confirmado', () => {
  const h = makeApp(); h.go(); h.enter(2, 6); h.enter(6, 3);       // 2-6, 6-3, set 3 pendiente
  h.reopen(0);
  let s = h.state(); assert.equal(s.open, true); assert.equal(s.active, 0); assert.deepEqual(s.draft, [2, 6]);
  h.wheel('a', 4);                                                  // primer lado: nada se cierra ni rebota
  s = h.state(); assert.equal(s.open, true); assert.equal(s.active, 0); assert.deepEqual(s.sets[0], [2, 6], 'el set confirmado no se pisa hasta confirmar');
  h.wheel('b', 6);
  assert.deepEqual(h.state().draft, [4, 6]); assert.equal(h.state().open, true);
  h.run('commitCurrentManualSetIfValid()');
  s = h.state(); assert.deepEqual(s.sets[0], [4, 6]); assert.equal(s.active, 2, 'vuelve al set pendiente'); assert.equal(s.decided, false);
});
test('10) editar un set que vuelve innecesario el Set 3: confirmación vigente, nunca descarte silencioso', () => {
  const h = makeApp(); h.go(); h.enter(2, 6); h.enter(6, 3); h.enter(6, 4);
  assert.equal(h.state().decided, true);
  h.reopen(0); h.wheel('a', 6); h.wheel('b', 2); h.run('commitCurrentManualSetIfValid()');
  assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.confirms)), ['Este cambio ya no necesita un tercer set']);
  const s = h.state(); assert.deepEqual(s.sets, [[6, 2], [6, 3], null]); assert.equal(s.decided, true); assert.equal(s.open, false);
});
test('reabrir con un borrador válido sin confirmar lo confirma antes de cambiar de set (nunca se pierde en silencio)', () => {
  const h = makeApp(); h.go(); h.enter(6, 3); h.enter(6, 4);
  h.reopen(0); h.wheel('b', 2);                                     // 6-2 válido, sin LISTO
  h.reopen(1);                                                      // tocar Set 2
  assert.deepEqual(h.state().sets[0], [6, 2]); assert.equal(h.state().active, 1);
});
test('Americano: un solo set, wheel y decisión', () => {
  const h = makeApp('americano'); h.go(); h.enter(6, 2);
  assert.equal(h.state().decided, true); assert.equal(h.state().open, false);
  assert.match(h.els['#manual-result-card'].innerHTML, />SET</);
  h.reopen(0); h.wheel('a', 6); h.wheel('b', 4); h.run('commitCurrentManualSetIfValid()');
  assert.deepEqual(h.state().sets[0], [6, 4]); assert.equal(h.state().decided, true);
});

/* ---------------- Cambiar jugadores / protección ---------------- */
test('11) CAMBIAR JUGADORES conserva jugadores, metadata y sets confirmados; el borrador sin confirmar se suelta', () => {
  const h = makeApp(); h.go(); h.enter(6, 3); h.wheel('a', 5);
  h.run('changeManualPlayers()');
  const s = h.state(); assert.equal(s.step, 'players'); assert.equal(s.open, false); assert.deepEqual(s.sets[0], [6, 3]);
  assert.equal(h.run('manualPlayers.b2'), 'Diego');
  h.go(); assert.equal(h.state().active, 1, 'al volver, retoma el set pendiente');
  assert.match(fnSource('exitManualLoadScreen'), /manualStep === 'result'\) \{ changeManualPlayers\(\); return; \}/);
  assert.match(html, /id="manual-change-players-btn"[^>]*>‹ CAMBIAR JUGADORES</);
});
test('12) protección: cambiar un participante con score cargado pide confirmación explícita y descarta SOLO si acepta', () => {
  const h = makeApp(); h.go(); h.enter(6, 3);
  assert.equal(h.run('manualHasLoadedResult()'), true);
  const sel = fnSource('selectManualPlayer');
  assert.match(sel, /previous && !sameAsBefore && manualHasLoadedResult\(\)[\s\S]*confirmAction\('Cambiar jugador', 'El resultado ya cargado se va a descartar y vas a tener que cargarlo de nuevo\.'/);
  assert.match(sel, /discardManualResult\(\); apply\(\)/);
  assert.match(app, /confirmAction\('Quitar jugador', 'El resultado ya cargado se va a descartar/);
  h.run('discardManualResult()'); assert.equal(h.run('manualHasLoadedResult()'), false);
});

/* ---------------- Partido completo / confirmar ---------------- */
test('13) partido válido: GANADORES + nombres + sets y games ganados en la misma tarjeta; CONFIRMAR habilitado solo entonces', () => {
  const h = makeApp(); h.go();
  assert.equal(h.els['#manual-confirm-btn'].disabled, true, 'visible y deshabilitado mientras no hay partido decidido');
  assert.doesNotMatch(h.els['#manual-result-card'].innerHTML, /winners-banner/);
  h.enter(6, 3); assert.equal(h.els['#manual-confirm-btn'].disabled, true);
  h.enter(6, 4);
  const card = h.els['#manual-result-card'].innerHTML;
  assert.match(card, /result-card__winners">Ganadores/); assert.match(card, /result-card__winners-names--a">Seba \/ Gusti</);
  assert.match(card, /summary-stat-row__a">2<\/span><span class="summary-stat-row__label">SETS GANADOS<\/span><span class="summary-stat-row__b">0</);
  assert.match(card, /summary-stat-row__a">12<\/span><span class="summary-stat-row__label">GAMES GANADOS<\/span><span class="summary-stat-row__b">7</);
  assert.equal(h.els['#manual-confirm-btn'].disabled, false);
  h.reopen(1); assert.equal(h.els['#manual-confirm-btn'].disabled, true, 'al reabrir un set deja de estar decidido');
});
test('14) no existe la tarjeta "RESULTADO DEL SET X" ni la pantalla intermedia de Confirmar; el resumen es el formulario', () => {
  const noComments = (x) => x.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(noComments(html.slice(html.indexOf('id="view-manual-load"'), html.indexOf('</section>', html.indexOf('id="view-manual-load"')))), /RESULTADO DEL SET|load-keypad|court-current-set/);
  assert.doesNotMatch(html, /id="view-match-saved"|match-saved-view-summary/);
  assert.doesNotMatch(app, /openConfirmMatchScreen|initMatchSavedScreen|manualConfirmDraft|view-match-saved|'match-saved'/);
});
test('15) CONFIRMAR PARTIDO guarda directo con el pipeline vigente y abre el Resumen oficial existente', () => {
  const c = fnSource('confirmManualMatch');
  assert.match(c, /if \(!draft\.ok \|\| !manualDecided\) return;/);
  assert.match(c, /submitManualMatchServerBacked\(built, snapshot\.location\)/);           // create-or-attach + feedback + Resumen
  assert.match(c, /persistManualSnapshot\(snapshot\);[\s\S]*showToast\('Partido guardado'\);[\s\S]*openCanonicalResumen\(snapshot, 'player-home'\)/);
  assert.match(app, /await handleCreateOrAttachOutcome\(entry, result, \{ silent: false \}\)/, 'feedback/Resumen oficial del camino server-backed intactos');
  assert.match(html, /id="manual-confirm-btn" class="btn-start mp-cta" disabled>CONFIRMAR PARTIDO/);
});

/* ---------------- Wheel / responsive ---------------- */
test('16) wheel: scroll-snap vertical, ítem 40px sincronizado JS↔CSS, A/B alineados con las columnas de la result-card', () => {
  assert.match(css, /\.mw-wheel\{[^}]*scroll-snap-type: y mandatory/); assert.match(css, /\.mw-wheel__item\{[^}]*scroll-snap-align: center/);
  assert.match(css, /\.mw-panel\{\s*--mw-item-h: 40px;/); assert.match(app, /MANUAL_WHEEL_ITEM_H = 40;/);
  assert.match(css, /\.mw-panel__wheels\{[^}]*grid-template-columns: 1fr 1fr/);
  assert.match(css, /\.result-card--editable\{ --rc-col: 52px;/);
  assert.match(css, /\.result-card--editable \.result-card__sets\{ grid-auto-columns: var\(--rc-col\)/);
  assert.match(css, /\.result-card__setlabel\{\s*width: var\(--rc-col\)/); assert.match(css, /\.result-card__set--edit\{\s*width: var\(--rc-col\)/);
  assert.match(css, /\.load-match-scroll\.has-wheel\{ padding-bottom: calc\(292px/);
  assert.match(css, /\.load-keypad, \.court-continue-wrap, \.mw-panel\{ max-width: 768px/);
});
test('wheel: nav oculta solo con el wheel abierto, restaurada al cerrar/salir (único punto de sync)', () => {
  const sync = fnSource('syncManualResultChrome');
  assert.match(sync, /active = !view\.hidden && inResult && manualWheelOpen/); assert.match(sync, /nav\.hidden = true/); assert.match(sync, /nav\.hidden = false/);
  assert.match(app, /!\(name === 'manual-load' && manualWheelOpen\)/);
});
test('el teclado numérico ya no es la UX de Cargar partido', () => {
  const view = html.slice(html.indexOf('id="view-manual-load"'), html.indexOf('</section>', html.indexOf('id="view-manual-load"')));
  assert.doesNotMatch(view.replace(/<!--[\s\S]*?-->/g, ''), /load-keypad|data-key=/);
  assert.doesNotMatch(app, /manualKeypad|openManualKeypad|manualSideEntered|manualDraftActiveTeam/);
});
test('versionado: V04.26 / 04.26-h1 coherente', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.26', bundle: '04.26-h1' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.26'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.26-h1'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-26-h1'/); assert.match(html, /app\.js\?v=04\.26-h1/); assert.match(html, /styles\.css\?v=04\.26-h1/);
});
