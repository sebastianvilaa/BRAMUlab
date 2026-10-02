// BRAMUlab V04.24 — Cargar partido (modo resultado, Fecha/Hora/Lugar) + cierre visual de Grupos.
// Ejecutar con: node --test bramulab/v0424-cargar-partido-grupos.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html'), app = read('app.js'), css = read('styles.css');
const fn = (sig, len = 2200) => { const i = app.indexOf(sig); assert.ok(i >= 0, sig); return app.slice(i, i + len); };
const section = (id) => { const s = html.indexOf(`id="${id}"`); assert.ok(s >= 0, id); return html.slice(s, html.indexOf('</section>', s)); };

/* ---------------- ARMADO / FORMATO: sin regresión ---------------- */
test('armado: metadata + Equipo A / VS / Equipo B + selección de jugadores siguen presentes', () => {
  const v = section('view-manual-load');
  ['load-format-line', 'manual-meta-line', 'court-team-card--a', 'vs-divider--compact', 'court-team-card--b', 'load-player-a2', 'load-player-b1', 'load-player-b2'].forEach((t) => assert.ok(v.includes(t), t));
  assert.match(html, /id="manual-format-options"/);
  assert.match(html, /id="manual-scoring-options"/);
  assert.match(app, /let selectedScoring = 'golden'/);
  assert.match(app, /let selectedFormatId = 'classic'/);
  assert.match(app, /manualSelectedFormatId = editMatch \? editMatch\.formatId : 'classic'/);
});

/* ---------------- MODO RESULTADO ---------------- */
test('modo resultado: estado explícito is-score-entry derivado de manualKeypadOpen, único punto de sync', () => {
  const body = fn('function syncManualScoreEntryChrome', 1400);
  assert.match(body, /const active = !view\.hidden && manualKeypadOpen/);
  assert.match(body, /classList\.toggle\('is-score-entry', active\)/);
  // se invoca al abrir/cerrar keypad y desde showView (cualquier salida de la vista)
  assert.match(fn('function openManualKeypad', 600), /syncManualScoreEntryChrome\(\)/);
  assert.match(fn('function closeManualKeypadPanel', 500), /syncManualScoreEntryChrome\(\)/);
  assert.match(fn('function showView', 3200), /syncManualScoreEntryChrome\(\);\n  \}/);
});
test('modo resultado: tarjetas grandes ocultas SOLO bajo .is-score-entry; header y subtítulo se mantienen', () => {
  assert.match(css, /\.is-score-entry \.court-meta-compact,\s*\n\.is-score-entry \.court-team-cards\{ display:none; \}/);
  assert.doesNotMatch(css, /(^|\n)\.court-team-cards\{[^}]*display:none/);
  const v = section('view-manual-load');
  assert.ok(v.includes('CARGAR PARTIDO') && v.includes('manual-load-format-mini'));
});
test('matchup compacto: A verde / B celeste, nombres blancos, truncado con elipsis', () => {
  assert.match(html, /id="manual-score-matchup"[^>]*hidden/);
  assert.match(html, /score-matchup__team--a/); assert.match(html, /score-matchup__team--b/);
  assert.match(css, /\.score-matchup__team--a\{[^}]*var\(--team-a\)/);
  assert.match(css, /\.score-matchup__team--b\{[^}]*var\(--team-b\)/);
  assert.match(css, /\.score-matchup__names\{[^}]*color: var\(--paper\)[^}]*text-overflow:ellipsis/);
  const m = fn('function renderManualScoreMatchup', 400);
  assert.match(m, /manualPlayers\.a1, manualPlayers\.a2/); assert.match(m, /manualPlayers\.b1, manualPlayers\.b2/);
  assert.match(fn('function renderManualScoreboard', 1800), /renderManualScoreMatchup\(\);/);
});
test('resultado actual visible: lado A verde, B celeste, lado activo refuerza borde/glow sin unificar', () => {
  assert.match(css, /\.is-score-entry \.court-score--a\.is-active\{[^}]*var\(--team-a\)/);
  assert.match(css, /\.is-score-entry \.court-score--b\.is-active\{[^}]*var\(--team-b\)[^}]*box-shadow/);
  assert.match(css, /\.is-score-entry \.court-score--a\{ border-color: rgba\(149,255,25/);
  assert.match(css, /\.is-score-entry \.court-score--b\{ border-color: rgba\(25,159,255/);
  // el valor en vivo sigue saliendo de manualKeypadDigits (misma fuente de siempre)
  assert.match(fn('function renderManualCurrentSetEditor', 1500), /manualKeypadOpen && manualDraftActiveTeam === side && manualKeypadDigits/);
});
test('fichas de sets: confirmados tocables (reopenManualSet), actual resaltado, pendientes "— —"; sin segundo estado', () => {
  const body = fn('function renderManualScoreEntryChips', 2000);
  assert.match(body, /manualSets\[i\]/); assert.match(body, /manualActiveSetIndex/); assert.match(body, /manualDraftSet/);
  assert.match(body, /is-current/); assert.match(body, /is-pending/); assert.match(body, /— —/);
  assert.match(body, /reopenManualSet\(Number\(btn\.dataset\.setIndex\)\)/);
  assert.match(fn('function renderManualAccumulated', 500), /if \(manualKeypadOpen && !manualDecided\)/);
  assert.match(fn('function reopenManualSet', 400), /if \(manualKeypadOpen\) closeManualKeypadPanel\(\)/);
});
test('teclado: sigue usando el motor actual (computeValidNextDigits, validación, poda, avance)', () => {
  assert.match(fn('function updateManualKeypadKeysState', 900), /ML\.computeValidNextDigits\(/);
  assert.match(fn('function commitCurrentManualSetIfValid', 1200), /E\.isValidCompletedSetScore\(/);
  assert.match(app, /pruneOrphanThirdSet\(\)/);
  assert.match(app, /ML\.resolveActiveSetIndex\(manualSets, format\)/);
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'done'].forEach((k) => assert.ok(html.includes(`data-key="${k}"`), k));
});
test('bottom nav: oculta con keypad abierto, restaurada al cerrar y al salir de la vista; sin offsets fantasma', () => {
  const sync = fn('function syncManualScoreEntryChrome', 1400);
  assert.match(sync, /if \(active\) \{\s*nav\.hidden = true;[\s\S]*--bottomnav-h', '0px'/);
  assert.match(sync, /else if \(!view\.hidden && Store\.getCurrentUser\(\)\) \{\s*nav\.hidden = false;/);
  const show = fn('function showView', 3200);
  assert.match(show, /!\(name === 'manual-load' && manualKeypadOpen\)/);
  // salir de la vista: showView oculta #view-manual-load -> active=false -> clase fuera; la nav la decide showView
  assert.match(show, /\.forEach\(\(v\) => \{ \$\(`#view-\$\{v\}`\)\.hidden = v !== name; \}\);/);
  assert.match(fn('function positionManualContinueBar', 700), /nav && !nav\.hidden\) \? nav\.offsetHeight : 0/);
});
test('resultado final: cierra keypad, sale del modo compacto, "Resultado válido" + CONTINUAR; sin autoabrir Confirmar', () => {
  const c = fn('function commitCurrentManualSetIfValid', 2200);
  assert.match(c, /manualDecided = true;\s*renderManualScoreboard\(\);/);
  assert.match(fn('function advanceDraftSide', 900), /closeManualKeypadPanel\(\);\s*commitCurrentManualSetIfValid\(\);/);
  const u = fn('function updateManualContinueState', 1200);
  assert.match(u, /manualDecided/); assert.match(u, /CONTINUAR/); assert.match(u, /court-current-set-hint'\)\.hidden = false/);
  assert.match(html, />Resultado válido</);
  assert.doesNotMatch(c, /finalizeManualContinue\(/);
});

/* ---------------- FECHA / HORA / LUGAR ---------------- */
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
  const dir = path.join(__dirname, '../docs/BRAMUlab');
  assert.ok(fs.existsSync(path.join(dir, 'Cargar_Partido.md')));
  const g = fs.readFileSync(path.join(dir, 'Grupos_BRAMU.md'), 'utf8');
  assert.doesNotMatch(g, /No entra en tus 3 mejores|Tus 3 mejores partidos cuentan|3 partidos que efectivamente/);
});
