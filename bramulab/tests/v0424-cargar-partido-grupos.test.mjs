// BRAMUlab V04.25 — Cargar partido (modo resultado, Fecha/Hora/Lugar) + cierre visual de Grupos.
// Ejecutar con: node --test bramulab/tests/v0424-cargar-partido-grupos.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html'), app = read('app.js'), css = read('styles.css');
const fn = (sig, len = 2200) => { const i = app.indexOf(sig); assert.ok(i >= 0, sig); return app.slice(i, i + len); };
const section = (id) => { const s = html.indexOf(`id="${id}"`); assert.ok(s >= 0, id); return html.slice(s, html.indexOf('</section>', s)); };

test('Hora: input nativo type=time, sin máscara manual; valor HH:MM llega a buildPlayedAtFromLocalFields', () => {
  assert.match(html, /<input id="manual-time-input" class="field__input" type="time"/);
  assert.doesNotMatch(app, /maskManualTimeInput|normalizeManualTimeOnBlur/);
  assert.doesNotMatch(html, /id="manual-time-input"[^>]*(maxlength|inputmode)/);
  assert.match(app, /ML\.buildPlayedAtFromLocalFields\(dateVal, timeVal\)/);
  assert.match(app, /\.replace\(\/\^24\/, '00'\)/);
  assert.match(fn('function initManualDateTimeFields', 800), /manual-time-input'\)\.addEventListener\('change'/);
  assert.match(fn('function updateManualTimeClearVisibility', 300), /manual-time-input'\)\.value/);
});
test('Fecha y Hora comparten UN shell (misma altura, appearance:none, divisor)', () => {
  assert.match(css, /\.manual-datetime-row\{ border: 1px solid var\(--court-line\)/);
  assert.match(css, /\.manual-datetime-row \.field \+ \.field\{ border-left:/);
  assert.match(css, /\.manual-datetime-row \.field__input\{\s*-webkit-appearance: none; appearance: none;/);
  assert.match(css, /\.manual-datetime-row \.field__input\{ box-sizing: border-box; height: 38px; \}/);
});
test('Lugar + Usar ubicación en el mismo renglón; handlers y opcionalidad intactos', () => {
  const row = html.slice(html.indexOf('class="manual-place-row"'), html.indexOf('id="manual-location-status"'));
  assert.ok(row.includes('id="manual-place-input"') && row.includes('id="manual-location-btn"'));
  assert.match(row, /maxlength="60"/); assert.doesNotMatch(row, /required/);
  assert.match(app, /manual-location-btn'\)\.addEventListener\('click', requestManualLocation\)/);
  assert.match(css, /\.manual-place-row\{ display:flex; align-items:center;/);
});

/* ---------------- GRUPOS ---------------- */
test('ayuda: bottom sheet acotado, header/X fijos, body scrolleable con safe-area; copies nuevos exactos', () => {
  const s = html.slice(html.indexOf('id="group-points-info-sheet"'), html.indexOf('id="profile-picker-sheet-scrim"'));
  assert.ok(s.indexOf('bottom-sheet__header') < s.indexOf('group-help-body'));
  assert.ok(s.indexOf('id="group-points-info-close"') < s.indexOf('group-help-body'), 'la X está fuera del body scrolleable');
  assert.match(css, /\.group-help-sheet\{[^}]*max-height: min\(85dvh, 720px\)/);
  assert.match(css, /\.group-help-sheet \.bottom-sheet__header\{ flex:none;/);
  assert.match(css, /\.group-help-body\{ flex:1 1 auto; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;[^}]*--safe-bottom/);
  ['BRAMU detecta automáticamente qué partidos corresponden a cada grupo y actualiza la competencia. Para el grupo, no tenés que hacer nada extra.',
    'BRAMU detecta los partidos', 'Si al menos <strong>3 de los 4 jugadores</strong> pertenecen al grupo, el partido entra automáticamente.',
    'Cada semana cuentan tus 2 mejores partidos', 'Si jugás más de dos, BRAMU toma los que más puntos te dieron. Todos siguen apareciendo en tu actividad.',
    'Nueva semana, nueva tabla', 'Cada lunes la tabla vuelve a empezar.', '5 pts por victoria · hasta 7 con bonus', '3 pts por victoria · hasta 5 con bonus',
    '+1 por vencer a una pareja claramente superior.', '+1 si perdés el primer set y ganás el partido. No aplica en Americano.', '+1 por ganar con claridad.',
    'Los puntos de Grupos son propios de esta competencia. No modifican tu Nivel BRAMU ni tu Ranking BRAMU.'].forEach((t) => assert.ok(s.includes(t), t));
  ['Cargá el resultado una sola vez', 'Entra solo', 'Tus 2 mejores cuentan', 'Cada semana, una nueva pelea', '0,5', '1,0', '6-0', '6–0'].forEach((t) => assert.ok(!s.includes(t), 'ausente: ' + t));
  assert.match(app, /group-points-info-scrim'\)\.addEventListener\('click'/);
  assert.match(app, /Escape'[\s\S]*group-points-info-scrim'\)\.hidden\) closeGroupPointsInfoSheet/);
});
test('desglose: subtítulo, valor real SIEMPRE, lima solo counted && points>0, sin "No entra en tus 2 mejores"', () => {
  assert.match(html, /Cuentan tus 2 mejores partidos de la semana/);
  const row = fn('function buildGroupBreakdownRowHTML', 1700);
  assert.match(row, /const ptsText = `\$\{row\.points\} pts`/);
  assert.match(row, /row\.counted && row\.points > 0/);
  assert.doesNotMatch(row, /No entra en tus/);
  assert.match(css, /\.group-breakdown-row--counted \.group-breakdown-row__pts\{ color: var\(--brand-lime\)/);
  assert.match(css, /\.group-breakdown-row__pts\{[^}]*color: var\(--paper-faint\)/);
});
test('Grupos: motor sin cambios (top 2, 3/4, Americano)', () => {
  const g = read('groups.js');
  assert.match(g, /MAX_COUNTED_MATCHES_PER_WEEK = 2/);
  assert.match(g, /americano: \{ id: 'americano', basePoints: 3, sorpresaMinDiff: 1\.0/);
  assert.match(g, />= 3;/);
});
test('Docs: Cargar_Partido.md existe y Grupos_BRAMU.md no contradice top 2', () => {
  const dir = path.join(__dirname, '../docs/BRAMUlab/Producto');
  assert.ok(fs.existsSync(path.join(dir, 'Cargar_Partido.md')));
  const g = fs.readFileSync(path.join(dir, 'Grupos_BRAMU.md'), 'utf8');
  assert.doesNotMatch(g, /No entra en tus 3 mejores|Tus 3 mejores partidos cuentan|3 partidos que efectivamente/);
});
