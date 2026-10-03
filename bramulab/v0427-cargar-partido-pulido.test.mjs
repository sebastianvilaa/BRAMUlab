// BRAMUlab V04.28 — Cargar partido en dos instancias (Jugadores → Resultado) con wheel A/B.
// Ejecuta las funciones REALES de app.js en un sandbox con DOM stub + motor real (engine/stats/match-load).
// Ejecutar con: node --test bramulab/v0427-cargar-partido-pulido.test.mjs
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
const NAMES = ['manualRosterComplete', 'manualNeededSlots', 'manualSetIsConfirmed',
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
      manualDecided = false, manualStep = 'players', manualWheelOpen = false,
      manualSelectedFormatId = '${formatId}', manualSelectedScoring = 'golden', manualServerBacked = false, manualSaveAttempted = false,
      manualSaveInFlight = false, MANUAL_WHEEL_ITEM_H = 40,
      manualPlayers = { a1: '${players[0] || ''}', a2: '${players[1] || ''}', b1: '${players[2] || ''}', b2: '${players[3] || ''}' },
      manualPlayerIds = { a1: null, a2: null, b1: null, b2: null };
    var MANUAL_SCORING_LINE_LABELS = { golden: 'Punto de Oro' };
    var MANUAL_ERROR_MESSAGES = {}; var MANUAL_INLINE_REASONS = new Set(['players-duplicate']);
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
      decided: get('manualDecided'), step: get('manualStep'), draft: [get('manualDraftSet').a, get('manualDraftSet').b], })),
    opts: () => JSON.parse(JSON.stringify(run('manualWheelOptions()'))),
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
test('el teclado numérico ya no es la UX de Cargar partido', () => {
  const view = html.slice(html.indexOf('id="view-manual-load"'), html.indexOf('</section>', html.indexOf('id="view-manual-load"')));
  assert.doesNotMatch(view.replace(/<!--[\s\S]*?-->/g, ''), /load-keypad|data-key=/);
  assert.doesNotMatch(app, /manualKeypad|openManualKeypad|manualSideEntered|manualDraftActiveTeam/);
});
test('versionado: V04.29 / 04.29-h2 coherente', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.29', bundle: '04.29-h2' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.29'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.29-h2'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-29-h2'/); assert.match(html, /app\.js\?v=04\.29-h2/); assert.match(html, /styles\.css\?v=04\.29-h2/);
});

/* ================= V04.27 ================= */
test('V04.27 · labels EQUIPO A/B FUERA de la tarjeta; la tarjeta solo tiene las dos filas; VS sin cápsula', () => {
  const v = html.slice(html.indexOf('id="manual-step-players"'), html.indexOf('id="manual-go-result-btn"'));
  assert.match(v, /<div class="mp-team-wrap">\s*<div class="mp-team__label"><span class="team-dot team-dot--a"><\/span>EQUIPO A<\/div>\s*<div class="mp-team mp-team--a">\s*<div class="mp-slot mp-slot--fixed"/);
  assert.match(v, /<div class="mp-team__label"><span class="team-dot team-dot--b"><\/span>EQUIPO B<\/div>\s*<div class="mp-team mp-team--b">/);
  assert.doesNotMatch(v.replace(/<div class="mp-team mp-team--[ab]">[\s\S]*?<\/div>\s*<\/div>/g, ''), /mp-team__label[^>]*>(?=[\s\S]*mp-slot)[\s\S]{0}x/);
  assert.match(css, /\.mp-teams \.vs-divider__text\{ background: none; border: none;/);
  assert.match(html, /vs-divider__line/);
});
test('V04.27 · wheels independientes 0–7: mover uno nunca toca el otro; par inválido permitido mientras se edita', () => {
  const h = makeApp(); h.go();
  assert.deepEqual(h.opts(), [0, 1, 2, 3, 4, 5, 6, 7]);
  h.wheel('a', 4); h.wheel('b', 4);
  assert.deepEqual(h.state().draft, [4, 4], 'A=4 B=4 se muestra');
  h.wheel('a', 6); assert.deepEqual(h.state().draft, [6, 4]);
  h.wheel('b', 6); assert.deepEqual(h.state().draft, [6, 6], 'cambiar B no borra A aunque el par sea inválido');
  h.wheel('a', undefined); assert.deepEqual(h.state().draft, [null, 6]);
  h.wheel('b', 2); h.wheel('a', 6); assert.deepEqual(h.state().draft, [6, 2]);
  assert.doesNotMatch(fnSource('setManualWheelValue'), /manualDraftSet\[other\]|isValidCompletedSetScore/);
});
test('V04.27 · SIGUIENTE: disabled con par inválido/incompleto, habilitado con par válido; sin toast ni mensaje', () => {
  assert.match(html, /id="manual-wheel-next" class="btn-start mw-panel__next" disabled>SIGUIENTE</);
  assert.doesNotMatch(html, /manual-wheel-done/);
  const h = makeApp(); h.go();
  assert.equal(h.els['#manual-wheel-next'].disabled, true);
  h.wheel('a', 4); assert.equal(h.els['#manual-wheel-next'].disabled, true, 'incompleto');
  h.wheel('b', 4); assert.equal(h.els['#manual-wheel-next'].disabled, true, '4-4 inválido');
  h.wheel('b', 6); assert.equal(h.els['#manual-wheel-next'].disabled, false, '4-6 válido');
  assert.doesNotMatch(fnSource('renderManualWheels'), /showToast/);
  assert.match(css, /\.mw-panel__head\{[^}]*justify-content:center/); assert.match(css, /\.mw-panel__next\{ width: 100%/);
  assert.ok(html.indexOf('mw-panel__wheels') < html.indexOf('manual-wheel-next'), 'SIGUIENTE al pie del panel');
});
test('V04.27 · avance: 2–0 decide tras SIGUIENTE; 1–1 abre Set 3 sin error rojo; Americano decide', () => {
  const h = makeApp(); h.go(); h.enter(6, 3); h.enter(6, 4);
  assert.equal(h.state().decided, true); assert.equal(h.state().open, false);
  const g = makeApp(); g.go(); g.enter(2, 6); g.enter(6, 3);
  assert.equal(g.state().active, 2); assert.equal(g.state().open, true);
  assert.equal(g.els['#load-match-error'].hidden, true, 'sin mensaje rojo del tercer set');
  assert.doesNotMatch(app.slice(app.indexOf('const MANUAL_INLINE_REASONS'), app.indexOf('const MANUAL_INLINE_REASONS') + 120), /third-set-missing/);
  const a = makeApp('americano'); a.go(); a.enter(6, 2); assert.equal(a.state().decided, true);
});
test('V04.27 · editar set previo conserva ambos lados sin autoborrar; Set 3 ya confirmado conserva su confirmación', () => {
  const h = makeApp(); h.go(); h.enter(2, 6); h.enter(6, 3); h.enter(6, 4);
  h.reopen(0); h.wheel('a', 6); assert.deepEqual(h.state().draft, [6, 6], 'B conserva su 6');
  h.wheel('b', 2); h.run('commitCurrentManualSetIfValid()');
  assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.confirms)), ['Este cambio ya no necesita un tercer set']);
});
test('V04.27 · CAMBIAR JUGADORES conserva sets confirmados, set parcial y set activo', () => {
  const h = makeApp(); h.go(); h.enter(6, 3); h.wheel('a', 5);
  h.run('changeManualPlayers()');
  let s = h.state(); assert.equal(s.step, 'players'); assert.deepEqual(s.sets[0], [6, 3]); assert.deepEqual(s.draft, [5, null]); assert.equal(s.active, 1); assert.equal(s.open, true);
  h.go(); s = h.state(); assert.equal(s.step, 'result'); assert.deepEqual(s.draft, [5, null]); assert.equal(s.active, 1); assert.equal(s.open, true);
  assert.match(app, /!\(name === 'manual-load' && manualWheelOpen && manualStep === 'result'\)/);
});
test('V04.27 · cambiar/quitar jugador NO descarta el score; slot vacío bloquea avanzar sin borrarlo', () => {
  const sel = fnSource('selectManualPlayer'), rem = app.slice(app.indexOf("$('#load-player-sheet-remove').addEventListener"), app.indexOf("$('#manual-step-players').addEventListener"));
  for (const b of [sel, rem]) assert.doesNotMatch(b, /discardManualResult|manualSets = |se va a descartar|confirmAction/);
  assert.doesNotMatch(app, /El resultado ya cargado se va a descartar y vas/);
  const h = makeApp(); h.go(); h.enter(6, 3); h.enter(6, 4);
  h.run("manualPlayers.a2 = null; manualStep = 'players'");
  assert.equal(h.run('manualRosterComplete()'), false);
  assert.deepEqual(h.state().sets.slice(0, 2), [[6, 3], [6, 4]], 'score intacto');
  h.run("manualPlayers.a2 = 'Lucho'");
  assert.equal(h.run('manualRosterComplete()'), true); h.go(); assert.equal(h.state().decided, true);
  h.els['#manual-confirm-btn'].disabled = true; h.run('renderManualScoreboard()'); assert.equal(h.els['#manual-confirm-btn'].disabled, false);
});
test('V04.27 · wheel: scroll-snap, ítem 40px JS↔CSS, columnas alineadas, nav oculta solo con wheel abierto en Resultado', () => {
  assert.match(css, /\.mw-wheel\{[^}]*scroll-snap-type: y mandatory/); assert.match(css, /\.mw-panel\{\s*--mw-item-h: 40px;/); assert.match(app, /MANUAL_WHEEL_ITEM_H = 40;/);
  assert.match(css, /\.result-card--editable\{ --rc-col: 52px;/);
  assert.match(css, /\.load-match-scroll\.has-wheel\{ padding-bottom: calc\(352px/);
  const sync = fnSource('syncManualResultChrome');
  assert.match(sync, /active = !view\.hidden && inResult && manualWheelOpen/); assert.match(sync, /nav\.hidden = true/);
});

/* ---- Borrador local 15 min (Store real) ---- */
function makeStore() {
  const mem = {}; const ctx = { window: {}, localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('store.js'), ctx, { filename: 'store.js' }); return { S: ctx.PLStore, mem };
}
test('V04.27 · borrador: guarda, renueva TTL con cada cambio, vence a los 15 min y es por usuario', () => {
  const { S, mem } = makeStore(); const t0 = 1_000_000_000_000;
  assert.equal(S.loadManualDraft('u1', t0), null);
  S.saveManualDraft('u1', { step: 'result', sets: [{ a: 6, b: 3 }, null, null], draftSet: { a: 5, b: null } }, t0);
  const d = S.loadManualDraft('u1', t0 + 14 * 60000); assert.equal(d.step, 'result'); assert.deepEqual(JSON.parse(JSON.stringify(d.draftSet)), { a: 5, b: null });
  S.saveManualDraft('u1', { step: 'result' }, t0 + 14 * 60000);               // cambio relevante → renueva
  assert.ok(S.loadManualDraft('u1', t0 + 28 * 60000), 'vigente 14 min después de la última modificación');
  assert.equal(S.loadManualDraft('u2', t0 + 28 * 60000), null, 'no se muestra a otra cuenta');
  assert.equal(S.loadManualDraft('u1', t0 + 14 * 60000 + 15 * 60000 + 1), null, 'vencido');
  assert.equal(mem['bramulab.manualDraft.v1'], undefined, 'el vencido se limpia');
  S.saveManualDraft('u1', { x: 1 }); S.clearManualDraft(); assert.equal(S.loadManualDraft('u1'), null);
  assert.equal(Object.keys(mem).some((k) => /history|outbox/i.test(k)), false, 'no toca Historial ni outbox');
});
test('V04.27 · borrador: contenido, restauración exacta e invitado con su referencia', () => {
  const b = fnSource('buildManualDraftData');
  for (const k of ['formatId', 'scoring', 'date', 'time', 'place', 'coords', 'players', 'playerIds', 'step', 'sets', 'activeSetIndex', 'draftSet', 'decided', 'wheelOpen']) assert.match(b, new RegExp(k + ':'), k);
  assert.match(b, /playerIds: manualServerBacked \? JSON\.parse\(JSON\.stringify\(manualPlayerIds\)\)/, 'conserva {playerId, kind:provisional}');
  const a = fnSource('applyManualDraft');
  assert.match(a, /manualPlayerIds = Object\.assign\([^;]*d\.playerIds/); assert.match(a, /manualStep = d\.step === 'result' && manualRosterComplete\(\)/);
  assert.match(a, /manualDraftSet = /); assert.match(a, /manualActiveSetIndex = /);
});
test('V04.27 · borrador: navegar no lo borra; "+" ofrece CONTINUAR / EMPEZAR DE NUEVO; se limpia solo al guardar/empezar de nuevo', () => {
  const o = fnSource('openManualLoadScreen');
  assert.match(o, /Store\.loadManualDraft\(currentUserId\)/);
  assert.match(o, /confirmAction\('Tenés un partido sin terminar'[\s\S]*openManualLoadScreenInner\(origin, null, draft\)[\s\S]*Store\.clearManualDraft\(\); openManualLoadScreenInner\(origin, null, null\)[\s\S]*'Continuar', 'Empezar de nuevo'/);
  assert.match(fnSource('exitManualLoadScreen'), /manualIsNewLoad\) \{ goBack\(\)/, 'salir sin preguntar');
  const clears = app.match(/Store\.clearManualDraft\(\)|discardManualDraft\(\)/g) || [];
  assert.ok(clears.length >= 4);
  const exitSrc = fnSource('exitManualLoadScreen') + fnSource('showView');
  assert.doesNotMatch(exitSrc, /clearManualDraft|discardManualDraft/);
  assert.match(fnSource('confirmManualMatch'), /persistManualSnapshot\(snapshot\);\s*discardManualDraft\(\)/);
  assert.match(app, /manualOutboxDraftId = entry\.localDraftId;\s*discardManualDraft\(\)/);
  assert.doesNotMatch(fnSource('persistManualDraft') + fnSource('buildManualDraftData'), /Auth\.|Matches\.|saveMatchOutboxEntry|upsertHistory/);
});
test('V04.27 · #26 RECALIBRANDO queda blanco; ámbar solo CALIBRANDO', () => {
  assert.match(app, /'player-home-level-value', [^;]*, false, levelV1\.state === LV\.STATES\.CALIBRATING\)/);
  assert.match(app, /'mi-perfil-level-value', [^;]*, false, levelV1\.state === LV\.STATES\.CALIBRATING\)/);
  assert.doesNotMatch(app, /levelV1\.state !== LV\.STATES\.CALIBRATED\)/);
});

/* ================= V04.28-h7 ================= */
test('h2 · #26 presentación completa: RECALIBRANDO consolidado (blanco, sin bloque/copy/progreso CALIBRANDO) en Home y Mi Perfil', () => {
  assert.match(app, /const calibrated = levelV1\.state !== LV\.STATES\.CALIBRATING;/);
  assert.match(app, /const isCalibrated = levelV1\.state !== LV\.STATES\.CALIBRATING;/);
  assert.doesNotMatch(app, /levelV1\.state === LV\.STATES\.CALIBRATED;/, 'ningún branch trata RECALIBRATING como calibración inicial');
  // el único camino que escribe CALIBRANDO · X / 5 / progreso es el branch "no consolidado" (state === CALIBRATING)
  const home = app.slice(app.indexOf('const calibrated = levelV1.state'), app.indexOf('const calibrated = levelV1.state') + 6000);
  assert.match(home, /if \(calibrated\) \{\s*levelSubEl\.hidden = true;[\s\S]*calibEl\.hidden = true;/);
  const perfil = app.slice(app.indexOf('const isCalibrated = levelV1.state'), app.indexOf('const isCalibrated = levelV1.state') + 4500);
  assert.match(perfil, /if \(isCalibrated\) \{[\s\S]*calibEl\.hidden = true;[\s\S]*\} else \{[\s\S]*CALIBRANDO · \$\{levelV1\.ratedMatches\}/);
  assert.match(perfil, /\$\('#evolution-card'\)\.hidden = isCalibrated/);
  // semántica ejecutada: CALIBRATING es el único estado "no consolidado"
  const LVsrc = read('level.js'); const c = { window: {} }; c.window = c; vm.createContext(c); vm.runInContext(LVsrc, c);
  const ST = (c.PLLevel || c.PLLevelV1 || Object.values(c).find((v) => v && v.STATES)).STATES;
  const consolidated = (st) => st !== ST.CALIBRATING; const amber = (st) => st === ST.CALIBRATING;
  assert.deepEqual([amber(ST.CALIBRATING), consolidated(ST.CALIBRATING)], [true, false]);
  assert.deepEqual([amber(ST.CALIBRATED), consolidated(ST.CALIBRATED)], [false, true]);
  assert.deepEqual([amber(ST.RECALIBRATING), consolidated(ST.RECALIBRATING)], [false, true]);
});
test('h2 · modal "Tenés un partido sin terminar": acciones verticales solo en este caso; lógica del borrador intacta', () => {
  assert.match(app, /'Continuar', 'Empezar de nuevo', false, true\);/);
  assert.match(app, /toggle\('overlay--stacked-actions', !!stacked\)/);
  assert.match(css, /#confirm-overlay\.overlay--stacked-actions \.overlay__actions\{ flex-direction: column-reverse; gap: 12px; \}/);
  assert.match(css, /overlay--stacked-actions \.overlay__actions \.btn-secondary\{[^}]*width: 100%[^}]*white-space: nowrap/);
  assert.match(css, /overlay--stacked-actions \.overlay__actions \.btn-start/);
  // DOM: cancel antes que accept → column-reverse deja CONTINUAR (accept) arriba
  assert.ok(html.indexOf('id="confirm-cancel"') < html.indexOf('id="confirm-accept"'));
  const o = fnSource('openManualLoadScreen');
  assert.match(o, /openManualLoadScreenInner\(origin, null, draft\)/); assert.match(o, /Store\.clearManualDraft\(\); openManualLoadScreenInner\(origin, null, null\)/);
  // otros confirmAction no pasan el 8º argumento
  const calls = app.match(/confirmAction\(/g).length; const stackedCalls = (app.match(/'Empezar de nuevo', false, true\)/g) || []).length;
  assert.equal(stackedCalls, 1); assert.ok(calls > 5);
  assert.match(fnSource('confirmAction'), /danger, stacked\)/);
});
test('h2 · versionado 04.29-h2 con APP_VERSION V04.29', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.29', bundle: '04.29-h2' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.29'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.29-h2'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-29-h2'/);
});
