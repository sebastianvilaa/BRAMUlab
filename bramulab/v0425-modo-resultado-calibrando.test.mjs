// BRAMUlab V04.25 — mensaje de tercer set + Issue #26 (CALIBRANDO). La edición de set completo con teclado
// (V04.25) fue reemplazada por el wheel de V04.26: ver v0426-cargar-partido-dos-instancias.test.mjs.
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
/* ---------------- B) mensaje de tercer set ---------------- */
test('mensaje de tercer set: integrado (ancho completo, centrado, sin margen negativo, no superpuesto)', () => {
  const rule = css.match(/\.load-match-error\{[^}]*\}/)[0];
  assert.doesNotMatch(rule, /margin: -/);
  assert.match(rule, /text-align: center/); assert.match(rule, /width: 100%/); assert.match(rule, /padding:/); assert.match(rule, /border-radius/);
  assert.match(app, /'third-set-missing': 'Con 1 set para cada equipo, falta definir el tercer set\.'/);
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
