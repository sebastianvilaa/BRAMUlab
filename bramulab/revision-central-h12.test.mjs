// BRAMUlab — Revisión central h12 -> h13 (docs/.../42_Revision_Central_h12_Completar_Alcance_27SEP.md):
// guarda de regresión para los 4 puntos que la revisión de código encontró incompletos en la
// ronda h12.
// Ejecutar con: node --test bramulab/revision-central-h12.test.mjs
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea — no
// ejecutable en un `vm` sandbox (mismo límite documentado en b6-identity-resolve-sheet.test.mjs/
// login-resume-session.test.mjs). Guarda ESTÁTICA sobre el código fuente real.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

/* ---- §A — quien PROPUSO ve su propuesta completa, sin botones de aceptar/rechazar ---- */

test('§A: paintB6Actions distingue isResponder y reutiliza el mismo bloque para quien propuso (nunca una representación paralela)', () => {
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.match(body, /const isResponder = proposedByTeam !== f\.myTeam/, 'debe distinguir explícitamente si el jugador actual es quien responde o quien propuso');
  assert.match(body, /respondBlock\.hidden = false/, 'el MISMO respondBlock debe abrirse para ambos casos');
  assert.match(body, /b6-respond-action-row['"]\)\.hidden = !isResponder/, 'la fila de Aceptar/Rechazar solo debe mostrarse para quien responde, nunca para quien propuso');
  assert.match(body, /Tu corrección propuesta/, 'quien propuso debe ver un rótulo en 2da persona, no "Corrección propuesta por <su propio nombre>" únicamente');
  assert.match(body, /Esperando respuesta de la otra pareja/, 'quien propuso debe ver el estado de espera junto a la propuesta completa');
  assert.match(body, /buildCorrectionPreviewCardHTML\(f\.players, f\.pendingCorrectionSets, proposedWinner\)/, 'la tarjeta completa debe construirse UNA sola vez y reutilizarse para ambos casos');
});

test('§A: la fila de acciones tiene su propio id en index.html para poder ocultarla sin tocar el resto del bloque', () => {
  // Handoff ajuste visual final post-h18 (doc 57, punto E) — la clase visual de esta fila pasó
  // de `.b6-action-row` (h17, apilada full-width) a `.b6-correction-choices` (grid 1fr 1fr, lado
  // a lado incluso en móvil) — el id, que es lo que este test realmente verifica, no cambió.
  assert.match(indexHtml, /<div class="b6-correction-choices" id="b6-respond-action-row">/);
});

/* ---- §B — CORRECCIÓN PROPUESTA elevada en Home/Historial, sin tocar VICTORIA/DERROTA oficial ---- */

test('§B: serverMatchStatusBadgeModifier devuelve un modificador PROPIO (correction) para validated+pendingCorrectionRevisionId, no el "waiting" genérico', () => {
  const body = extractFunctionBody(appJs, 'serverMatchStatusBadgeModifier');
  assert.match(body, /f\.status === 'validated' && f\.pendingCorrectionRevisionId\) return 'correction'/, 'debe devolver "correction", separado de "waiting" (pending_validation esperando confirmación)');
});

test('§B: renderPlayerLastMatchCard aplica el acento ámbar (--waiting) por encima de win/loss cuando hay una corrección activa sobre un partido validado', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  assert.match(body, /hasActiveCorrectionOnLastMatch/, 'debe calcular explícitamente si el último partido tiene una corrección activa');
  assert.match(body, /m\.status === 'validated' && !!m\.pendingCorrectionRevisionId && b6CorrectionWindowOpen\(m\)/, 'debe reusar b6CorrectionWindowOpen (mismo criterio de ventana de 3 días que el resto de la app), nunca una regla nueva');
  const winLossIdx = body.search(/resultKind === 'win' \|\| resultKind === 'loss'/);
  const correctionIdx = body.search(/hasActiveCorrectionOnLastMatch\) \{/);
  assert.ok(correctionIdx !== -1 && winLossIdx !== -1 && correctionIdx < winLossIdx, 'el chequeo de corrección activa debe evaluarse ANTES que win/loss, para que gane precedencia visual sin borrar el dato de resultado (resultLabel/RESULT_LABEL siguen sin cambios debajo)');
});

test('§B: los badges nuevos (.history-item__badge--correction / .player-home-lastmatch__badge--correction) existen y tienen más peso que el badge base de 10px', () => {
  assert.match(stylesCss, /\.history-item__badge--correction\{[^}]*font-size:\s*11px[^}]*font-weight:\s*800/);
  assert.match(stylesCss, /\.player-home-lastmatch__badge--correction\{[^}]*font-size:\s*11px/);
});

/* ---- §C — Nivel BRAMU real en Compañeros/Rivales, reusando compactById (sin N+1) ---- */

test('§C: openPersonListScreen agrega Nivel real leyendo levelStatus/levelPublic del MISMO compactById ya pedido (sin una segunda llamada de red)', () => {
  const body = extractFunctionBody(appJs, 'openPersonListScreen');
  assert.match(body, /c\.levelStatus && c\.levelStatus !== 'PENDIENTE' && Number\.isFinite\(c\.levelPublic\)/, 'debe usar el mismo gate que buildCompactPlayerRowHTML ("distinto de PENDIENTE"), no una regla nueva');
  const compactCallCount = (body.match(/Auth\.getPlayersCompact/g) || []).length;
  assert.equal(compactCallCount, 1, 'debe seguir habiendo una única llamada batch a getPlayersCompact, nunca una por fila');
  assert.match(body, /Nivel BRAMU \$\{levelText\}/, 'debe renderizar el Nivel real cuando existe');
});

test('§C: sin dato real de Nivel, la fila no inventa un número (el chip completo se omite)', () => {
  const body = extractFunctionBody(appJs, 'openPersonListScreen');
  assert.match(body, /const levelText = \(c && c\.levelStatus && c\.levelStatus !== 'PENDIENTE' && Number\.isFinite\(c\.levelPublic\)\) \? c\.levelPublic\.toFixed\(1\) : null;/, 'sin dato real, levelText debe quedar null (nunca "—" ni un número fabricado) para que el template lo omita por completo');
});

/* ---- §D — salida explícita "Por identificar" (sin backend nuevo) ---- */

test('§D: el sheet de identidad tiene una acción explícita para "no sé quién jugó", separada de buscar/elegir', () => {
  assert.match(indexHtml, /id="identity-resolve-unidentified-btn"/);
  assert.match(indexHtml, /No sé · dejar Por identificar/);
  assert.match(indexHtml, /¿SABÉS QUIÉN JUGÓ\?/, 'el título debe acercarse a la pregunta real, no un genérico de búsqueda');
});

test('§D: confirmIdentityUnresolved NUNCA llama a una RPC — solo cierra el sheet (el slot ya quedó "Por identificar" al reportar la incidencia)', () => {
  const body = extractFunctionBody(appJs, 'confirmIdentityUnresolved');
  assert.doesNotMatch(body, /MV\.|Auth\.|Matches\./, 'no debe invocar ningún cliente de red — el estado ya existe del lado del servidor desde report_identity_issue');
  assert.match(body, /closeIdentityResolveSheet\(\)/, 'debe cerrar el sheet, mismo mecanismo que la X');
});

test('§D: el botón está conectado en initIdentityResolveSheet', () => {
  const body = extractFunctionBody(appJs, 'initIdentityResolveSheet');
  assert.match(body, /identity-resolve-unidentified-btn['"]\)\.addEventListener\('click', confirmIdentityUnresolved\)/);
});
