// BRAMUlab — Cierre UX h13 -> h14
// (docs/.../45_Handoff_Cierre_UX_h13_27SEP.md, docs/.../46_Plan_Implementacion_Cierre_UX_h13_27SEP.md):
// guarda de regresión para los 11 puntos (P0-A..G, P1-H..K).
// Ejecutar con: node --test bramulab/cierre-ux-h13.test.mjs
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea — no
// ejecutable en un `vm` sandbox (mismo límite documentado en varios *.test.mjs de este repo).
// Guarda ESTÁTICA sobre el código fuente real para todo lo que vive ahí; dinámica (vm real)
// para lo que se movió a match-load.js (P0-D), que sí es un módulo puro sin DOM.

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

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

/* ---- P0-A: barra de Nivel decimal real (nunca 100% fijo) ---- */

test('P0-A: renderPlayerCard usa PH.levelProgressPct para la barra del Nivel V1 calibrado, nunca un 100% fijo', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerCard');
  assert.match(body, /barEl\.style\.width = PH\.levelProgressPct\(publicLevel\) \+ '%'/, 'debe usar el progreso decimal real (mismo contrato que el camino legacy), no un ancho fijo');
  assert.doesNotMatch(body, /barEl\.style\.width = '100%'/, 'no debe volver al 100% fijo (bug reportado en QA físico h13: 6.0 se veía con la barra llena)');
});

/* ---- P0-B: Último partido con corrección activa, sin desplazar el layout ----
   SUPERSEDIDO en h17 (docs/.../53_Auditoria_Central_Reapertura_h16_y_Plan_h17_27SEP.md, punto 2):
   la implementación de h13/h14 (badge-slot con min-height:18px dentro de .datetime/row1) resultó
   ser un FAIL VISUAL REAL en QA físico h16 — la reserva no alcanzaba cuando el copy real medía
   más, row1 crecía y empujaba row2 hacia abajo. Estos dos tests quedan reemplazados por los de
   h17-visual-regression.test.mjs (status-slot como segundo hijo de row2, sin badge-slot). */

test('P0-B: renderPlayerLastMatchCard calcula explícitamente si hay una corrección activa sobre ESTE último partido', () => {
  const body = extractFunctionBody(appJs, 'renderPlayerLastMatchCard');
  assert.match(body, /hasActiveCorrectionOnLastMatch/, 'debe calcular explícitamente si hay una corrección activa sobre ESTE último partido');
});

/* ---- P0-C: grilla canónica de resultado, fusionada entre oficial y propuesta ---- */

test('P0-C: buildScoreCardHTML y buildCorrectionPreviewCardHTML comparten la MISMA primitiva de filas (buildResultRowsHTML)', () => {
  const scoreCardBody = extractFunctionBody(appJs, 'buildScoreCardHTML');
  const previewBody = extractFunctionBody(appJs, 'buildCorrectionPreviewCardHTML');
  assert.match(scoreCardBody, /buildResultRowsHTML\(f\.players, f\.sets, f\.currentPartial\)/, 'el resultado oficial debe armar sus filas con la primitiva compartida');
  assert.match(previewBody, /buildResultRowsHTML\(players, sets, null\)/, 'la propuesta debe armar sus filas con la MISMA primitiva compartida, nunca una copia');
  assert.doesNotMatch(scoreCardBody, /function cellsForTeam/, 'buildScoreCardHTML ya no debe tener su propia copia de cellsForTeam');
  assert.doesNotMatch(previewBody, /function cellsForTeam/, 'buildCorrectionPreviewCardHTML ya no debe tener su propia copia de cellsForTeam');
});

test('P0-C: el divisor entre parejas es un elemento PROPIO que atraviesa las dos columnas del grid (nunca un border-top por celda)', () => {
  const helperBody = extractFunctionBody(appJs, 'buildResultRowsHTML');
  assert.match(helperBody, /result-card__divider-row/, 'debe insertar un elemento divisor propio entre las dos filas de equipo');
  assert.match(stylesCss, /\.result-card__divider-row\{[^}]*grid-column:\s*1 \/ -1/, 'el divisor debe ocupar las dos columnas del grid (1/-1), no depender de bordes por celda que deban coincidir ópticamente');
  assert.doesNotMatch(stylesCss, /result-card__row\[data-team="B"\][^{]*\{[^}]*border-top/, 'no debe quedar el border-top viejo por celda (causa real del bug reabierto en QA físico h13)');
});

/* ---- P0-D: explicación humana del cambio (función pura, dinámica contra match-load.js real) ---- */

function loadPureModules() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'match-load.js'), 'utf8'), sandbox, { filename: 'match-load.js' });
  return { E: sandbox.PLEngine, ML: sandbox.PLMatchLoad };
}
const { ML } = loadPureModules();

function set(a, b) { return { gamesA: a, gamesB: b, tiebreak: null, winner: a > b ? 'A' : 'B' }; }

test('P0-D: un solo set cambiado -> frase humana con el ordinal correcto, nunca el delta técnico como lectura principal', () => {
  const before = [set(6, 3), set(6, 0)];
  const after = [set(6, 3), set(6, 4)];
  const summary = ML.buildCorrectionHumanSummary(before, after, 'Esteban');
  assert.equal(summary, 'Esteban indica que el segundo set fue 6–4, no 6–0.');
});

test('P0-D: sin nombre de actor resoluble, usa "La otra pareja" — nunca inventa un nombre', () => {
  const summary = ML.buildCorrectionHumanSummary([set(6, 3)], [set(6, 4)], null);
  assert.match(summary, /^La otra pareja indica/);
});

test('P0-D: set agregado se explica en lenguaje humano, no como delta técnico', () => {
  const summary = ML.buildCorrectionHumanSummary([set(6, 3), set(3, 6)], [set(6, 3), set(3, 6), set(6, 2)], 'Seba');
  assert.equal(summary, 'Seba agrega el tercer set: 6–2.');
});

test('P0-D: múltiples cambios se resumen en una frase breve, no una lista de sets sueltos', () => {
  const before = [set(6, 3), set(6, 0)];
  const after = [set(7, 5), set(6, 4)];
  const summary = ML.buildCorrectionHumanSummary(before, after, 'Esteban');
  assert.match(summary, /^Esteban indica varios cambios:/);
  assert.match(summary, /primer set fue 7–5, no 6–3/);
  assert.match(summary, /segundo set fue 6–4, no 6–0/);
});

test('P0-D: sin diferencias reales, no fuerza ninguna frase', () => {
  assert.equal(ML.buildCorrectionHumanSummary([set(6, 3)], [set(6, 3)], 'Esteban'), '');
});

// SUPERSEDIDO en h17 (doc 53, punto B): el diff técnico de este bloque (renderCorrectionDiff
// sobre 'b6-respond-correction-diff') se retiró por redundante con la explicación humana — ver
// h17-visual-regression.test.mjs. ML.buildCorrectionHumanSummary sigue siendo la lectura
// principal, ahora la ÚNICA de este bloque.
test('P0-D: paintB6Actions usa ML.buildCorrectionHumanSummary como lectura principal del bloque de corrección', () => {
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.match(body, /ML\.buildCorrectionHumanSummary\(f\.sets, f\.pendingCorrectionSets, rawProposerName\)/);
});

test('P0-D: los rótulos de la comparación oficial/propuesta quedan centrados', () => {
  assert.match(stylesCss, /\.b6-correction-compare__label\{[^}]*text-align:\s*center/);
});

/* ---- P0-E: metadata de Cargar partido ANTES de los equipos ---- */

test('P0-E: .court-meta-compact aparece ANTES que .mp-teams (V04.26) en el DOM (nunca duplicado)', () => {
  const metaIdx = indexHtml.indexOf('class="court-meta-compact"');
  const teamsIdx = indexHtml.indexOf('class="mp-teams"');
  assert.ok(metaIdx !== -1 && teamsIdx !== -1, 'ambos bloques deben seguir existiendo');
  assert.ok(metaIdx < teamsIdx, 'la metadata (formato/fecha) debe quedar ANTES que Equipo A/B en el documento');
  const metaCount = indexHtml.split('class="court-meta-compact"').length - 1;
  assert.equal(metaCount, 1, 'la metadata no debe quedar duplicada en ningún otro punto de la pantalla');
});

/* ---- P0-F: outbox comprensible (sync_pending / necesita_revision) ---- */

test('P0-F: retryOneOutboxEntry reintenta con la MISMA submissionId (idempotency key), nunca genera una nueva', () => {
  const body = extractFunctionBody(appJs, 'retryOneOutboxEntry');
  assert.match(body, /idempotencyKey:\s*entry\.submissionId/, 'debe reusar la key existente del borrador, nunca una key nueva para un reintento');
});

test('P0-F: retryMatchOutbox (reintento automático de fondo) sigue sin cambiar de semántica — pasa por el mismo helper', () => {
  const body = extractFunctionBody(appJs, 'retryMatchOutbox');
  assert.match(body, /state === 'sync_pending'/, 'solo debe reintentar sync_pending automáticamente, nunca necesita_revision');
  assert.match(body, /retryOneOutboxEntry\(entry\.localDraftId, \{ silent: true \}\)/, 'debe reusar el helper extraído, sin duplicar la llamada a Matches.createOrAttach');
});

test('P0-F: paintB6Actions explica sync_pending y necesita_revision (antes quedaba vacío para un borrador de outbox)', () => {
  const body = extractFunctionBody(appJs, 'paintB6Actions');
  assert.match(body, /f\.status === 'sync_pending'/);
  assert.match(body, /f\.status === 'necesita_revision'/);
  assert.match(body, /ambiguous_candidates/, 'debe distinguir el caso de ambigüedad del resto de errores de negocio');
  assert.match(body, /MATCH_BUSINESS_ERROR_MESSAGES\[code\]/, 'debe mostrar el motivo REAL (lastError.code), nunca un "NECESITA REVISIÓN" genérico sin explicación');
});

test('P0-F: handleCreateOrAttachOutcome repinta el Resumen abierto tras un intento explícito fallido (nunca deja una pantalla con estado viejo)', () => {
  const body = extractFunctionBody(appJs, 'handleCreateOrAttachOutcome');
  assert.match(body, /!silent && MSync && analysisCurrent && analysisCurrent\.matchId === entry\.localDraftId/, 'el repintado debe ser SOLO para acciones explícitas del usuario, nunca para el reintento silencioso de fondo');
  assert.match(body, /MSync\.buildOutboxDisplayEntry\(freshEntry\)/);
});

/* ---- P0-G: patrón canónico de jugador por player_id (guarda de regresión) ---- */

test('P0-G: ninguna superficie server-backed navega al perfil público por nombre plano (las ramas local/legacy ya auditadas quedan fuera de esta ronda a propósito; Mis grupos pasa por player_id desde Grupos B1)', () => {
  // Extrae cada línea de llamada real (line-based, más legible que parsear JS).
  const lines = appJs.split('\n').filter((l) => l.includes('openPlayerPublicProfile('));
  const bareNameLines = lines.filter((l) => !l.includes('{ name:') && !l.includes('playerId'));
  // Únicas líneas de nombre-plano YA auditadas y legítimas: la propia declaración de la función
  // (Mis Grupos ya no está en esta lista: desde Grupos B1 navega por player_id), y las 3 ramas LOCAL/LEGACY
  // (gateadas por `if (user && user.serverBacked) return;` antes de esta línea, ver openPersonListScreen
  // en la ronda h11/h12 y renderJugadoresList/renderPlayerSearchResults) — cualquier línea NUEVA
  // fuera de esta lista es una regresión real: una superficie server-backed navegando por nombre.
  const allowedSnippets = [
    'function openPlayerPublicProfile(nameOrRef, origin)',
    "openPlayerPublicProfile(btn.dataset.name, 'jugadores-tab')",
    "openPlayerPublicProfile(btn.dataset.name, 'search')",
  ];
  const unexpected = bareNameLines.filter((l) => !allowedSnippets.some((snippet) => l.includes(snippet)));
  assert.equal(unexpected.length, 0, `llamadas con nombre plano no reconocidas (posible regresión server-backed):\n${unexpected.join('\n')}`);
  // Y a la inversa: si alguna de las líneas ya auditadas desaparece del todo, esta guarda perdió
  // su referencia — mejor fallar explícito que quedar comprobando código que ya no existe.
  allowedSnippets.forEach((snippet) => {
    assert.ok(bareNameLines.some((l) => l.includes(snippet)) || appJs.includes(snippet), `referencia esperada ya no existe en app.js: ${snippet}`);
  });
});

/* ---- P1-H: Mi Perfil > Jugadores con búsqueda directa ---- */

test('P1-H: el buscador de JUGADORES ya no queda oculto por "hasAny" (nunca más pantalla vacía con botón a otra pantalla)', () => {
  assert.doesNotMatch(indexHtml, /id="jugadores-search-wrap" hidden/, 'el campo de búsqueda debe estar SIEMPRE visible en el marcado, nunca hidden por defecto');
  assert.doesNotMatch(indexHtml, /id="jugadores-empty-action"/, 'el botón "BUSCAR JUGADORES" del estado vacío debe haber sido retirado');
});

test('P1-H: renderJugadoresListServerBacked busca también en el universo global (Auth.searchPlayers) desde el mismo campo', () => {
  const body = extractFunctionBody(appJs, 'renderJugadoresListServerBacked');
  assert.match(body, /Auth\.searchPlayers\(trimmed\)/, 'debe reusar la MISMA RPC que ya usa Buscar Jugadores, nunca una segunda lógica de búsqueda');
  assert.match(body, /savedIds\.has\(r\.player_id\)/, 'un jugador ya agregado no debe duplicarse en la sección de resultados globales');
});

/* ---- P1-I: Reportar un error (verificación, ya implementado en h11) ---- */

// SUPERSEDIDO en el sistema visual unificado h21 (doc 59): "Reportar un error" deja de usar
// `.btn-secondary.btn-secondary--danger` (pasa a `.b6-correction-choice--report`, outline rojo
// discreto — mismo lenguaje que Aceptar/Mantener/Confirmar). Ver
// h16-report-error-cta.test.mjs para la guarda de sentence case vigente.
test('P1-I: el CTA de Reportar un error sigue en sentence case', () => {
  assert.match(indexHtml, />Reportar un error<\/button>/);
});

/* ---- P1-J: identidad incorrecta — copy actualizado ---- */

test('P1-J: el copy de confirmación usa la frase corta preferida ("¿Seguro que no fue...?")', () => {
  const body = extractFunctionBody(appJs, 'confirmReportIdentity');
  assert.match(body, /¿Seguro que no fue \$\{name\}\?/);
});

/* ---- P1-K: notificaciones en lenguaje humano de pádel ---- */

test('P1-K: los títulos con actor real usan lenguaje humano, nunca vocabulario técnico del workflow', () => {
  const match = appJs.match(/const B6_NOTIF_ACTOR_TITLE = \{([\s\S]*?)\n  \};/);
  assert.ok(match, 'no se encontró B6_NOTIF_ACTOR_TITLE en app.js');
  const block = match[1];
  assert.match(block, /confirmó el nuevo resultado/);
  assert.match(block, /indicó quién jugó/);
  assert.match(block, /quiere corregir el resultado/);
  assert.doesNotMatch(block, /propuso una corrección/, 'debe reemplazar la frase técnica vieja');
  assert.doesNotMatch(block, /resolvió un participante/, 'debe reemplazar la frase técnica vieja');
  assert.doesNotMatch(block, /cuestionó un participante/, 'debe reemplazar la frase técnica vieja');
});

test('P1-K: identity_questioned nunca nombra al jugador cuestionado (sin evidencia real en el payload)', () => {
  const match = appJs.match(/const B6_NOTIF_ACTOR_TITLE = \{([\s\S]*?)\n  \};/);
  const block = match[1];
  const line = block.split('\n').find((l) => l.includes('identity_questioned:'));
  assert.ok(line, 'debe seguir existiendo una entrada identity_questioned');
  assert.doesNotMatch(line, /\$\{name\} indicó que \$\{/, 'no debe interpolar un segundo nombre inventado para la persona cuestionada');
});
