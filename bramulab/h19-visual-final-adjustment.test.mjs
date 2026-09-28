// BRAMUlab — Ajuste visual final post-h18
// (docs/.../57_Handoff_Ajuste_Visual_Final_Post_h18_27SEP.md): guarda técnica de los puntos
// A-H de esta ronda (sistema único de estados de Último partido, carrusel único de Home,
// tarjeta oficial/corrección del Resumen, acciones de corrección, animación de la barra de
// Nivel).
// Ejecutar con: node --test bramulab/h19-visual-final-adjustment.test.mjs
//
// Guarda estática sobre app.js (mismo límite que el resto de *-visual-*.test.mjs: IIFE que
// asume document/window reales) + guarda DINÁMICA (vm real) sobre player-home.js, que sí es un
// módulo puro sin DOM.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const versionJson = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

function loadPlayerHome() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'player-home.js'), 'utf8'), sandbox, { filename: 'player-home.js' });
  return sandbox.PLPlayerHome;
}
const PH = loadPlayerHome();

/* ---- Punto A: sistema único de estados — Último partido ---- */

test('h19-A: TODOS los estados operativos usan la misma columna de row2 (status-slot), nunca .datetime/row1', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  assert.doesNotMatch(body, /player-home-lastmatch__badge-slot/, 'el badge-slot bajo fecha/hora (reintroducido en h18) debe quedar retirado de nuevo');
  assert.match(body, /const generalStatusText = serverMatchStatusLabel\(m\)/, 'debe partir del mismo texto general compartido con Historial/Resumen');
  assert.match(body, /'CONFIRMAR PARTIDO'/, 'quien debe confirmar ve un copy específico, nunca el genérico TU TURNO: CONFIRMAR');
  assert.match(body, /'ESPERANDO VALIDACIÓN'/, 'quien cargó y espera ve un copy específico, nunca el genérico PENDIENTE DE VALIDACIÓN');
});

test('h19-A: el status-slot es texto compacto (10px, nowrap), nunca una píldora con fondo/borde/padding', () => {
  const rule = stylesCss.match(/\.player-home-lastmatch__status-text\{([^}]*)\}/);
  assert.ok(rule, 'debe existir la regla .player-home-lastmatch__status-text');
  assert.doesNotMatch(rule[1], /background|border-radius|padding|border:/, 'no debe llevar ninguna propiedad de cápsula/píldora');
  assert.match(rule[1], /white-space:\s*nowrap/);
  assert.match(rule[1], /font-size:\s*10px/, 'se reduce un punto para que los copies más largos entren sin wrappear');
});

/* ---- Punto B: slot/carrusel único del Home (acciones + insights) ---- */

test('h19-B: renderPlayerHomeCarousel arma acciones + TU MOMENTO en el MISMO track, nunca dos bloques separados', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerHomeCarousel');
  assert.match(body, /PH\.computeHomePendingCarouselItems\(displayMatches \|\| \[\], new Date\(\)\)/);
  assert.match(body, /player-home-carousel-card--insight/, 'TU MOMENTO debe pintarse como una tarjeta más del mismo carrusel');
  assert.match(body, /id="player-home-momento-text"/, 'el id que el refresco asíncrono de Ranking sigue actualizando debe seguir existiendo');
  assert.match(body, /'PARTIDO POR CONFIRMAR'/);
  assert.match(body, /'CORRECCIÓN PENDIENTE'/);
  assert.match(body, /'ESPERANDO CONFIRMACIÓN'/);
});

test('h19-B: ya no existe una tarjeta TU MOMENTO separada en index.html (una sola superficie)', () => {
  assert.doesNotMatch(indexHtml, /pastilla--momento/, 'la tarjeta propia de TU MOMENTO debe haber sido retirada — ahora vive dentro del carrusel');
});

test('h19-B: computeHomePendingCarouselItems (player-home.js, pura) suma partidos validados con corrección activa, sin distinguir proponente/respondedor', () => {
  const now = new Date('2026-09-27T12:00:00.000Z');
  const base = { serverBacked: true };
  const mine = { ...base, matchId: 'a', status: 'pending_validation', isActionMine: true };
  const waiting = { ...base, matchId: 'e', status: 'pending_validation', isActionMine: false, actionSide: 'B' };
  const activeCorrection = { ...base, matchId: 'c', status: 'validated', pendingCorrectionRevisionId: 'rev1', validatedAt: '2026-09-26T12:00:00.000Z' };
  const staleCorrection = { ...base, matchId: 'stale', status: 'validated', pendingCorrectionRevisionId: 'rev2', validatedAt: '2026-09-01T12:00:00.000Z' };
  const items = PH.computeHomePendingCarouselItems([mine, waiting, activeCorrection, staleCorrection], now);
  // JSON.stringify en vez de assert.deepEqual: `items` es un array construido DENTRO del
  // contexto vm (otro realm) — deepEqual/deepStrictEqual pueden reportar falso negativo entre
  // arrays de realms distintos aunque el contenido sea idéntico (gotcha real de Node, mismo
  // motivo por el que cierre-ux-h13.test.mjs compara strings, nunca arrays, de sus módulos vm).
  const ids = items.map((i) => i.matchId);
  assert.equal(JSON.stringify(ids), JSON.stringify(['a', 'c', 'e']), 'orden accionable > correccion > espera; corrección vencida (>3 días) nunca entra');
  assert.equal(items[1].kind, 'correccion');
});

/* ---- Punto C: Resumen — "Resultado oficial actual" dentro de la tarjeta oficial ---- */

test('h19-C: el rótulo se calcula sincrónicamente en renderAnalysis (nunca depende de get_match_detail) y se pasa a la tarjeta oficial', () => {
  const body = extractFunctionBody(appJs, 'renderAnalysis');
  assert.match(body, /f\.status === 'validated' && !!f\.pendingCorrectionRevisionId && b6CorrectionWindowOpen\(f\)/, 'debe bastar con datos ya disponibles en el f liviano, sin esperar actionsRaw');
  assert.match(body, /buildResultBlockHTML\(f, \{ officialLabelHTML \}\)/);
});

test('h19-C: buildScoreCardHTML pinta el rótulo como PRIMER hijo de .result-card (antes de ganadores/grilla)', () => {
  const body = extractFunctionBody(appJs, 'buildScoreCardHTML');
  const cardIdx = body.indexOf('<div class="result-card">');
  const labelIdx = body.indexOf('${officialLabelHTML}');
  const winnersIdx = body.indexOf('${winnersHTML}');
  const rowsIdx = body.indexOf('<div class="result-card__rows">');
  assert.ok(cardIdx !== -1 && labelIdx !== -1 && winnersIdx !== -1 && rowsIdx !== -1);
  assert.ok(cardIdx < labelIdx && labelIdx < winnersIdx && winnersIdx < rowsIdx, 'orden: 1) título, 2) ganadores, 3) grilla');
});

test('h19-C: ya no existe el rótulo como elemento propio afuera de la tarjeta (paintB6Actions ya no lo togglea)', () => {
  assert.doesNotMatch(indexHtml, /id="analysis-result-official-label"/);
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.doesNotMatch(body, /\$\('#analysis-result-official-label'\)/, 'paintB6Actions ya no debe buscar ni togglear ese elemento (retirado del DOM)');
});

/* ---- Punto D/E/F: Resumen — tarjeta de corrección como unidad completa ---- */

test('h19-D: una única .b6-correction-card contiene propuesta + estado de espera + acciones, en ese orden', () => {
  assert.match(indexHtml, /<div class="b6-action-block b6-correction-card" id="b6-respond-correction-block" hidden>/);
  const blockMatch = indexHtml.match(/<div class="b6-action-block b6-correction-card" id="b6-respond-correction-block" hidden>([\s\S]*?)\n        <\/div>\n        <div class="b6-action-block" id="b6-confirm-block"/);
  assert.ok(blockMatch, 'debe encontrarse el bloque completo de la tarjeta de corrección');
  const inner = blockMatch[1];
  const compareIdx = inner.indexOf('b6-correction-compare');
  const waitTextIdx = inner.indexOf('id="b6-respond-correction-text"');
  const choicesIdx = inner.indexOf('b6-correction-choices');
  assert.ok(compareIdx !== -1 && waitTextIdx !== -1 && choicesIdx !== -1);
  assert.ok(compareIdx < waitTextIdx && waitTextIdx < choicesIdx, 'orden: propuesta -> estado de espera -> acciones (antes el estado de espera vivía ANTES de la propuesta)');
});

test('h19-F: .b6-correction-card lleva borde+halo ámbar con el MISMO glow ya tuneado de Último partido, respeta prefers-reduced-motion', () => {
  const rule = stylesCss.match(/\.b6-correction-card\{([^}]*)\}/);
  assert.ok(rule);
  assert.match(rule[1], /border:\s*1px solid rgba\(255,201,61/);
  assert.match(rule[1], /box-shadow:\s*0 0 18px rgba\(255,201,61,\.12\)/, 'reusa el valor de reposo ya tuneado de .player-home-lastmatch, no uno nuevo');
  assert.match(rule[1], /animation:\s*b6CorrectionGlowPulse/);
  assert.match(stylesCss, /@media \(prefers-reduced-motion: reduce\)\{\s*\.b6-correction-card\{\s*animation:\s*none/);
});

test('h19-F: el result-card interno pierde su propio borde/fondo (un solo nivel de caja, nunca dos anidadas)', () => {
  assert.match(stylesCss, /\.b6-correction-card \.result-card\{\s*border:\s*none;\s*background:\s*transparent;\s*\}/);
});

test('h19-E: Aceptar/Rechazar quedan lado a lado incluso en móvil (grid 1fr 1fr, nunca apilados)', () => {
  assert.match(stylesCss, /\.b6-correction-choices\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*1fr 1fr/);
  assert.doesNotMatch(stylesCss, /\.b6-action-row\{/, 'el viejo apilado full-width de h17/h18 no debe seguir existiendo');
});

test('h19-E: estilo outline (nunca botón lima macizo) — aceptar en verde, rechazar en borde neutro, sentence case real', () => {
  assert.match(stylesCss, /\.b6-correction-choice--accept\{\s*border:\s*1\.5px solid var\(--confirm-green\);\s*color:\s*var\(--confirm-green\);\s*\}/);
  assert.match(stylesCss, /\.b6-correction-choice--reject\{\s*border:\s*1\.5px solid var\(--line\);\s*color:\s*var\(--paper\);\s*\}/);
  const choiceRule = stylesCss.match(/\.b6-correction-choice\{([^}]*)\}/);
  assert.ok(choiceRule);
  assert.doesNotMatch(choiceRule[1], /text-transform/, 'no debe forzar mayúsculas — el sentence case real viene del texto fuente');
  assert.match(indexHtml, />Aceptar corrección<\/button>/, 'el texto fuente debe estar en sentence case, no en mayúsculas');
  assert.match(indexHtml, />Rechazar<\/button>/);
});

test('h19-E: "Reportar un error" se reubica DENTRO de la tarjeta de corrección solo mientras hay una activa (mismo elemento, nunca duplicado)', () => {
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.match(body, /confirmBlock\.after\(reportErrorBlock\)/, 'por defecto vuelve a su posición de siempre en cada render');
  assert.match(body, /respondBlock\.appendChild\(reportErrorBlock\)/, 'se muda a la tarjeta de corrección cuando hay una activa que me involucra');
  // Solo debe existir UN elemento con este id en todo el documento (nunca duplicado).
  const occurrences = (indexHtml.match(/id="b6-report-error-block"/g) || []).length;
  assert.equal(occurrences, 1);
});

/* ---- Punto H: barra de Nivel — regresión confirmada y restaurada ---- */

test('h19-H: la cuenta V1 CALIBRADA retrigger la animación de entrada de la barra (regresión de h13 confirmada por git blame, restaurada)', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerCard');
  // Aísla el branch `if (calibrated) { ... }` dentro de renderPlayerCard.
  const calibratedStart = body.indexOf('if (calibrated) {');
  const calibratedEnd = body.indexOf('} else {', calibratedStart);
  assert.ok(calibratedStart !== -1 && calibratedEnd !== -1, 'debe existir el branch de cuenta V1 calibrada');
  const calibratedBranch = body.slice(calibratedStart, calibratedEnd);
  assert.match(calibratedBranch, /barEl\.classList\.remove\('is-animating'\)/);
  assert.match(calibratedBranch, /if \(shouldAnimate\) \{\s*void barEl\.offsetWidth;\s*barEl\.classList\.add\('is-animating'\);\s*\}/, 'debe reintroducir el mismo patrón remove+reflow+add que ya usa el branch legacy');
});

test('h19-H: no se tocó la fórmula/porcentaje del Nivel (levelProgressPct sigue siendo la única fuente del ancho)', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerCard');
  assert.match(body, /barEl\.style\.width = PH\.levelProgressPct\(publicLevel\) \+ '%'/);
});

/* ---- Bundle/cache quartet de esta ronda ---- */

test('h19: bundle/cache quartet queda alineado', () => {
  assert.match(indexHtml, /app\.js\?v=04\.11-h19/);
  assert.match(indexHtml, /styles\.css\?v=04\.11-h19/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\.11-h19'/);
  assert.match(swJs, /CACHE_NAME = 'bramulab-v04-11-h19'/);
  assert.match(swJs, /app\.js\?v=04\.11-h19/);
  assert.match(swJs, /styles\.css\?v=04\.11-h19/);
  assert.match(versionJson, /"bundle":\s*"04\.11-h19"/);
});
