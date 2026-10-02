// BRAMUlab V04.25 — edición de set completo en Cargar partido (comportamiento REAL de las funciones de
// app.js ejecutadas en un sandbox con DOM stub) + tercer set + Issue #26 (CALIBRANDO).
// Ejecutar con: node --test bramulab/v0425-modo-resultado-calibrando.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const app = read('app.js'), css = read('styles.css'), html = read('index.html');

/* ---- sandbox: motor real (engine.js + match-load.js) + funciones reales de app.js ---- */
const eng = { window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
eng.window = eng; vm.createContext(eng);
['engine.js', 'stats.js', 'match-load.js'].forEach((f) => vm.runInContext(read(f), eng, { filename: f }));
const E = eng.PLEngine, ML = eng.PLMatchLoad;

function fnSource(name) {
  const i = app.indexOf(`  function ${name}(`); assert.ok(i >= 0, name);
  const j = app.indexOf('\n  }\n', i); return app.slice(i, j + 5);
}
const NAMES = ['manualNeededSlots', 'openManualKeypad', 'closeManualKeypadPanel', 'commitDraftDigits', 'advanceDraftSide',
  'commitCurrentManualSetIfValid', 'pressManualKeypadKey', 'reopenManualSet', 'pruneOrphanThirdSet', 'updateManualKeypadKeysState'];

function makeApp(formatId = 'classic') {
  const ctx = { E, ML, confirms: [], keysState: null };
  vm.createContext(ctx);
  const dom = { classList: { add() {}, remove() {} }, hidden: true };
  ctx.$ = () => dom; ctx.$all = () => [];
  vm.runInContext(`
    var manualSets = [null, null, null], manualActiveSetIndex = 0, manualDraftSet = { a: undefined, b: undefined },
      manualDraftActiveTeam = 'A', manualDecided = false, manualKeypadOpen = false, manualKeypadDigits = '',
      manualSideEntered = { a: false, b: false }, manualSelectedFormatId = '${formatId}', renders = 0;
    function renderManualScoreboard() { renders++; }
    function markManualLoadDirty() {}
    function syncManualScoreEntryChrome() {}
    function confirmAction(t, m, ok, cancel) { confirms.push(t); ok(); }
    ${NAMES.map(fnSource).join('\n')}
  `, ctx);
  const get = (n) => vm.runInContext(n, ctx);
  const press = (...keys) => keys.forEach((k) => vm.runInContext(`pressManualKeypadKey(${JSON.stringify(k)})`, ctx));
  return {
    ctx, press, get,
    open: (t) => vm.runInContext(`openManualKeypad('${t}')`, ctx),
    reopen: (i) => vm.runInContext(`reopenManualSet(${i})`, ctx),
    state: () => JSON.parse(JSON.stringify({ sets: get('manualSets').map((s) => s && [s.a, s.b]), active: get('manualActiveSetIndex'), open: get('manualKeypadOpen'),
      team: get('manualDraftActiveTeam'), decided: get('manualDecided'), draft: [get('manualDraftSet').a, get('manualDraftSet').b] })),
  };
}
// Ingresar un set completo desde cero: teclea A y B (cada lado de un dígito se cierra solo cuando ya no se puede extender).
const enter = (h, a, b) => { h.press(String(a)); h.press(String(b)); };

test('1) carga normal 2-0: 6-3 + 6-4 deja el partido decidido y cierra el keypad', () => {
  const h = makeApp(); h.open('A');
  enter(h, 6, 3); assert.deepEqual(h.state().sets[0], [6, 3]); assert.equal(h.state().active, 1); assert.equal(h.state().open, true);
  enter(h, 6, 4);
  const s = h.state(); assert.equal(s.decided, true); assert.equal(s.open, false); assert.deepEqual(s.sets.slice(0, 2), [[6, 3], [6, 4]]);
});

test('2) 1-1 abre el tercer set automáticamente con el keypad abierto', () => {
  const h = makeApp(); h.open('A'); enter(h, 2, 6); enter(h, 6, 3);
  const s = h.state(); assert.equal(s.decided, false); assert.equal(s.active, 2); assert.equal(s.open, true); assert.equal(s.team, 'A');
});

test('3-5) reabrir Set 1 con Set 3 pendiente: cambiar el primer lado NO cierra el keypad; el segundo lado confirma el set; vuelve al set pendiente', () => {
  const h = makeApp(); h.open('A'); enter(h, 2, 6); enter(h, 6, 3);        // 2-6, 6-3, set 3 pendiente
  h.reopen(0);
  let s = h.state(); assert.equal(s.open, true, 'reabrir entra al modo resultado con keypad'); assert.equal(s.active, 0); assert.equal(s.team, 'A');
  h.press('4');                                                              // A: 2 -> 4 (primer lado; sigue ganando B)
  s = h.state(); assert.equal(s.open, true, 'el keypad sigue abierto tras cambiar el primer lado'); assert.equal(s.active, 0);
  assert.equal(s.team, 'B', 'el teclado pasa al otro lado del MISMO set');
  assert.deepEqual(s.sets[0], [2, 6], 'el set confirmado no se pisa hasta que el set completo es válido');
  h.press('6');                                                              // B: reafirma 6 => 4-6 válido
  s = h.state(); assert.deepEqual(s.sets[0], [4, 6]); assert.equal(s.active, 2, 'regresa al set pendiente');
  assert.equal(s.open, true); assert.equal(s.team, 'A'); assert.equal(s.decided, false);
});

test('6) corrección que cambia el ganador e invalida el Set 3 conserva la poda existente con confirmación', () => {
  const h = makeApp(); h.open('A'); enter(h, 2, 6); enter(h, 6, 3); enter(h, 6, 4); // 1-1 y set 3 ganado por A => decidido
  assert.equal(h.state().decided, true);
  h.reopen(0);                                                               // set 1 -> 6-2: ahora A gana 2-0, el Set 3 sobra
  h.press('6'); h.press('2');
  const s = h.state();
  assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.confirms)), ['Este cambio ya no necesita un tercer set']);
  assert.deepEqual(s.sets, [[6, 2], [6, 3], null]); assert.equal(s.decided, true); assert.equal(s.open, false);
});

test('"Listo" sobre un set reabierto confirma sin obligar a retocar el otro lado', () => {
  const h = makeApp(); h.open('A'); enter(h, 6, 3); enter(h, 6, 4);
  h.reopen(0); h.press('6');                                                 // A sigue 6; pasa a B
  h.press('done');                                                           // B conserva 3 => 6-3 válido
  assert.deepEqual(h.state().sets[0], [6, 3]); assert.equal(h.state().decided, true);
});

test('Americano: un solo set, reabrir y corregir ambos lados', () => {
  const h = makeApp('americano'); h.open('A'); enter(h, 6, 2);
  assert.equal(h.state().decided, true);
  h.reopen(0); h.press('6'); assert.equal(h.state().open, true); h.press('4');
  assert.deepEqual(h.state().sets[0], [6, 4]); assert.equal(h.state().decided, true);
});

test('8) las fichas de sets quedan visibles y reabribles (clase is-current / is-pending / tocables)', () => {
  const i = app.indexOf('function renderManualScoreEntryChips'); const body = app.slice(i, i + 2200);
  assert.match(body, /is-current/); assert.match(body, /is-pending/); assert.match(body, /data-set-index/);
});

test('9) bottom nav: se oculta solo durante el keypad (derivado de manualKeypadOpen)', () => {
  const i = app.indexOf('function syncManualScoreEntryChrome'); const body = app.slice(i, i + 1400);
  assert.match(body, /active = !view\.hidden && manualKeypadOpen/);
  assert.match(body, /nav\.hidden = true/); assert.match(body, /nav\.hidden = false/);
});

/* ---------------- B) mensaje de tercer set ---------------- */
test('mensaje de tercer set: integrado (ancho completo, centrado, sin margen negativo, no superpuesto)', () => {
  const rule = css.match(/\.load-match-error\{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /margin: -/);
  assert.match(rule, /text-align: center/); assert.match(rule, /width: 100%/); assert.match(rule, /padding:/); assert.match(rule, /border-radius/);
  assert.match(app, /'third-set-missing': 'Con 1 set para cada equipo, falta definir el tercer set\.'/);
});

/* ---------------- A) result board ---------------- */
test('matchup: A arriba / B abajo en bloques completos teñidos, nombres grandes de hasta 2 líneas', () => {
  assert.match(css, /\.score-matchup\{ display:flex; flex-direction:column;/);
  assert.match(css, /\.score-matchup__team\{[^}]*min-height: 58px/);
  assert.match(css, /\.score-matchup__names\{[^}]*font-size: 18px[^}]*-webkit-line-clamp: 2/);
  assert.ok(html.indexOf('score-matchup__team--a') < html.indexOf('score-matchup__vs') && html.indexOf('score-matchup__vs') < html.indexOf('score-matchup__team--b'));
});

/* ---------------- Issue #26: CALIBRANDO ---------------- */
function loadRowHelper() {
  const src = fnSource('buildLevelCellHTML');
  const c = {}; vm.createContext(c); vm.runInContext(src + '\nthis.f = buildLevelCellHTML;', c); return c.f;
}
test('#26 filas compactas: NIVEL BRAMU → valor → CALIBRANDO (ámbar); consolidado sin etiqueta', () => {
  const f = loadRowHelper();
  const cal = f('5.4', true), ok = f('5.4', false);
  assert.ok(cal.indexOf('NIVEL BRAMU') < cal.indexOf('5.4') && cal.indexOf('5.4') < cal.indexOf('CALIBRANDO'));
  assert.match(cal, /player-row__level-value is-calibrating/);
  assert.doesNotMatch(ok, /CALIBRANDO|is-calibrating/);
  assert.ok(ok.indexOf('NIVEL BRAMU') < ok.indexOf('5.4'));
  assert.doesNotMatch(f('—', true), /CALIBRANDO/, 'sin valor no hay estado');
  assert.match(css, /\.player-row__level-value\.is-calibrating\{ color: var\(--gold\)/);
  assert.match(css, /\.player-row__level-state\{[^}]*color: var\(--gold\)/);
});
test('#26 filas server-backed pasan levelStatus === CALIBRANDO; las locales nunca marcan estado', () => {
  assert.equal((app.match(/buildLevelCellHTML\(levelText, p\.levelStatus === 'CALIBRANDO'\)/g) || []).length, 2);
  assert.equal((app.match(/buildLevelCellHTML\(levelText, false\)/g) || []).length, 2);
  assert.doesNotMatch(app, /<span class="player-row__level-value">\$\{levelText\}<\/span>\s*<span class="player-row__level-label">/, 'jerarquía vieja eliminada');
});
test('#26 Home / Mi Perfil / Perfil público: número ámbar solo si CALIBRANDO', () => {
  assert.match(app, /setLevelValueText\('player-home-level-value', [^;]*, false, levelV1\.state !== LV\.STATES\.CALIBRATED\)/);
  assert.match(app, /setLevelValueText\('mi-perfil-level-value', [^;]*, false, !isCalibrated\)/);
  assert.match(app, /const calibrating = p\.level_status === 'CALIBRANDO'/);
  assert.match(app, /classList\.toggle\('player-card__level-value--calibrating'/);
  assert.match(css, /\.player-card__level-value--calibrating\{ color: var\(--gold\)/);
  assert.match(css, /\.player-card__level-sub--calibrating\{ color: var\(--gold\)/);
});
