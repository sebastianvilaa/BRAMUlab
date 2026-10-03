// BRAMUlab — Sistema visual unificado Home/Historial/Resumen post-h20
// (docs/.../59_Handoff_Sistema_Visual_Unificado_h21_27SEP.md): guarda técnica focalizada en los
// puntos 9 (pestañas de Historial) y 10 (ocultar/volver a mostrar por long press), que son los
// que esta ronda agrega de cero. El resto de los puntos (2-8, 11) ya quedaron cubiertos por las
// actualizaciones in-place de h16/h17/h19's propios archivos de test (ver sus notas de
// supersedencia) — no se duplica esa cobertura acá.
// Ejecutar con: node --test bramulab/h21-sistema-visual-unificado.test.mjs
//
// Guarda estática sobre app.js (mismo límite que el resto de *-visual-*.test.mjs) + guarda
// DINÁMICA (vm real) sobre player-home.js, que sí es un módulo puro sin DOM. `Store` se
// stubea acá (solo `normalizePlayerName`, la única función de Store que estas funciones puras
// tocan) para no arrastrar store.js completo (localStorage en el top-level del módulo real) a
// un sandbox vm — mismo criterio de aislamiento que ya documenta cierre-ux-h13.test.mjs.

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
const matchSyncJs = fs.readFileSync(path.join(__dirname, 'match-sync.js'), 'utf8');
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
  // Stub mínimo: la única función de Store que classifyHistoryStatusTab/getPlayerTeam tocan.
  sandbox.window.PLStore = {
    normalizePlayerName: (raw) => (raw || '').replace(/\s+/g, ' ').trim().toLowerCase(),
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'player-home.js'), 'utf8'), sandbox, { filename: 'player-home.js' });
  return sandbox.PLPlayerHome;
}
const PH = loadPlayerHome();

function m(matchId, overrides) {
  return Object.assign({
    matchId, serverBacked: true, status: 'validated', hidden: false,
    players: [
      { team: 'A', position: 1, userId: 'u_me', name: 'Yo' },
      { team: 'A', position: 2, userId: 'u_partner', name: 'Compa' },
      { team: 'B', position: 1, userId: 'u_r1', name: 'Rival1' },
      { team: 'B', position: 2, userId: 'u_r2', name: 'Rival2' },
    ],
  }, overrides || {});
}
const ME = { userId: 'u_me', name: 'Yo' };

/* ---- Punto 9: taxonomía de pestañas de Historial (player-home.js, pura) ---- */

test('h21-9: classifyHistoryStatusTab — ocultos es exclusivo, nunca cuenta como pendiente/victoria/derrota', () => {
  const hiddenPending = m('h1', { hidden: true, status: 'pending_validation', isActionMine: true });
  assert.equal(PH.classifyHistoryStatusTab(hiddenPending, ME), 'ocultos');
});

test('h21-9: classifyHistoryStatusTab — pending_validation y corrección activa son "pendientes" (misma familia)', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');
  const pending = m('p1', { status: 'pending_validation', isActionMine: false, actionSide: 'B' });
  const activeCorrection = m('c1', { status: 'validated', pendingCorrectionRevisionId: 'rev1', validatedAt: '2026-09-27T12:00:00.000Z' });
  const staleCorrection = m('c2', { status: 'validated', pendingCorrectionRevisionId: 'rev2', validatedAt: '2026-09-01T12:00:00.000Z', winnerTeam: 'A' });
  assert.equal(PH.classifyHistoryStatusTab(pending, ME, now), 'pendientes');
  assert.equal(PH.classifyHistoryStatusTab(activeCorrection, ME, now), 'pendientes');
  // Corrección vencida (>3 días): ya no es "pendientes" — cae a victoria/derrota si corresponde.
  assert.equal(PH.classifyHistoryStatusTab(staleCorrection, ME, now), 'victorias');
});

test('h21-9: classifyHistoryStatusTab — victorias/derrotas SOLO para partidos propios, oficiales, con resultado real', () => {
  const won = m('w1', { status: 'validated', winnerTeam: 'A' });
  const lost = m('l1', { status: 'validated', winnerTeam: 'B' });
  const observed = m('o1', {
    status: 'validated', winnerTeam: 'A',
    players: [
      { team: 'A', position: 1, userId: 'u_x', name: 'X' }, { team: 'A', position: 2, userId: 'u_y', name: 'Y' },
      { team: 'B', position: 1, userId: 'u_z', name: 'Z' }, { team: 'B', position: 2, userId: 'u_w', name: 'W' },
    ],
  });
  const expired = m('e1', { status: 'expired' });
  assert.equal(PH.classifyHistoryStatusTab(won, ME), 'victorias');
  assert.equal(PH.classifyHistoryStatusTab(lost, ME), 'derrotas');
  assert.equal(PH.classifyHistoryStatusTab(observed, ME), null, 'un Observado (no participo) nunca es victoria/derrota propia');
  assert.equal(PH.classifyHistoryStatusTab(expired, ME), null, 'expired/annulled/sync_pending/necesita_revision no caen en ninguna de las 4 pestañas de estado');
});

test('h21-9: filterHistoryByStatusTab("todos") excluye ocultos; computeHistoryStatusTabCounts cuenta las 5 pestañas', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');
  const list = [
    m('w1', { status: 'validated', winnerTeam: 'A' }),
    m('l1', { status: 'validated', winnerTeam: 'B' }),
    m('p1', { status: 'pending_validation', isActionMine: true }),
    m('h1', { hidden: true, status: 'validated', winnerTeam: 'A' }),
  ];
  const todos = PH.filterHistoryByStatusTab(list, ME, 'todos', now);
  assert.equal(todos.length, 3, 'todos debe excluir el oculto');
  assert.ok(!todos.some((x) => x.matchId === 'h1'));
  const counts = PH.computeHistoryStatusTabCounts(list, ME, now);
  // JSON.stringify en vez de assert.deepEqual: `counts` es un objeto construido DENTRO del
  // contexto vm (otro realm) — deepEqual/deepStrictEqual reportan falso negativo entre objetos
  // de realms distintos aunque el contenido sea idéntico (mismo gotcha ya documentado en
  // h19-visual-final-adjustment.test.mjs para arrays vm).
  assert.equal(JSON.stringify(counts), JSON.stringify({ todos: 3, pendientes: 1, victorias: 1, derrotas: 1, ocultos: 1 }));
});

/* ---- Punto 9: pestañas visibles en Historial (app.js) ---- */

test('h21-9: renderHistoryFilters pinta HISTORY_STATUS_TABS y desoculta #history-tabs (antes quedaba forzado a hidden=true)', () => {
  const body = extractFunctionBody(appJs, 'renderHistoryFilters');
  assert.match(body, /PH\.computeHistoryStatusTabCounts\(fullHistory, currentIdentity\(\), new Date\(\)\)/);
  assert.match(body, /HISTORY_STATUS_TABS\.map/);
  assert.match(body, /historyStatusFilter = btn\.dataset\.key/);
  assert.match(body, /\$\('#history-tabs'\)\.hidden = false/);
});

test('h21-9: HISTORY_STATUS_TABS son exactamente Todos/Pendientes/Victorias/Derrotas/Ocultos, en ese orden', () => {
  const match = appJs.match(/const HISTORY_STATUS_TABS = \[([\s\S]*?)\];/);
  assert.ok(match, 'debe existir HISTORY_STATUS_TABS');
  const keys = [...match[1].matchAll(/key:\s*'([a-z]+)'/g)].map((m2) => m2[1]);
  assert.deepEqual(keys, ['todos', 'pendientes', 'victorias', 'derrotas', 'ocultos']);
});

test('h21-9: renderHistory pide includeHidden:true y aplica PH.filterHistoryByStatusTab', () => {
  const body = extractFunctionBody(appJs, 'renderHistory');
  assert.match(body, /getDisplayHistory\(\{\s*includeHidden:\s*true\s*\}\)/);
  assert.match(body, /PH\.filterHistoryByStatusTab\(list, currentIdentity\(\), historyStatusFilter, new Date\(\)\)/);
});

test('h21-9: getDisplayHistory/buildDisplayHistory soportan includeHidden sin romper el default (opt-in)', () => {
  const appBody = extractFunctionBody(appJs, 'getDisplayHistory');
  assert.match(appBody, /includeHidden:\s*!!\(opts && opts\.includeHidden\)/);
  assert.match(matchSyncJs, /function buildDisplayHistory\(\{ localHistory, serverRows, outboxEntries, includeHidden \}\)/);
  assert.match(matchSyncJs, /\.filter\(\(row\) => includeHidden \|\| !row\.hidden\)/);
});

test('h21-9: initHistorySwipe recorre HISTORY_STATUS_TABS/historyStatusFilter (nunca la vieja HISTORY_TABS/historyOwnershipFilter) y está RE-HABILITADO', () => {
  const swipeBody = extractFunctionBody(appJs, 'initHistorySwipe');
  assert.match(swipeBody, /HISTORY_STATUS_TABS\.findIndex/);
  assert.match(swipeBody, /historyStatusFilter = HISTORY_STATUS_TABS\[nextIdx\]\.key/);
  const screenBody = extractFunctionBody(appJs, 'initHistoryScreen');
  assert.match(screenBody, /initHistorySwipe\(\);/, 'debe volver a llamarse (antes comentado porque las pestañas estaban ocultas)');
});

/* ---- Punto 10: ocultar / volver a mostrar reutilizando hide_match_for_me ---- */

test('h21-10: confirmToggleMatchHidden reutiliza Matches.hideMatchForMe, nunca un mecanismo nuevo', () => {
  const body = extractFunctionBody(appJs, 'confirmToggleMatchHidden');
  assert.match(body, /Matches\.hideMatchForMe\(m\.matchId, hidden\)/);
  assert.match(body, /refreshServerMatches\(\)/, 'debe refrescar el cache server-backed tras ocultar/mostrar');
  assert.match(body, /renderHistory\(\)/, 'debe repintar Historial para que la tarjeta desaparezca/reaparezca de la pestaña activa');
});

test('h21-10: wireHistoryItemInteractions ofrece long press solo para partidos server-backed ya sincronizados (nunca outbox)', () => {
  const body = extractFunctionBody(appJs, 'wireHistoryItemInteractions');
  assert.match(body, /m\.serverBacked && m\.status !== 'sync_pending' && m\.status !== 'necesita_revision'/);
  assert.match(body, /confirmToggleMatchHidden\(m, !m\.hidden\)/, 'ocultar si está visible, volver a mostrar si ya está oculto');
});

test('h21-10: el tap corto sigue abriendo Resumen; un long press disparado suprime el click sintético siguiente', () => {
  const body = extractFunctionBody(appJs, 'wireHistoryItemInteractions');
  assert.match(body, /openCanonicalResumen\(m, 'history'\)/);
  assert.match(body, /suppressNextClick = true/);
});

test('h21-10: long press se cancela si el dedo se desplaza (nunca interfiere con el scroll vertical)', () => {
  const body = extractFunctionBody(appJs, 'wireHistoryItemInteractions');
  assert.match(body, /clearPressTimer\(\)/);
  assert.match(body, /Math\.abs\(dx\) > 10 \|\| Math\.abs\(dy\) > 10/);
});

test('h21-10: desktop tiene un equivalente contextual simple (click derecho / contextmenu), sin introducir una UI nueva grande', () => {
  const body = extractFunctionBody(appJs, 'wireHistoryItemInteractions');
  assert.match(body, /addEventListener\('contextmenu'/);
});

test('h21-10: "Ocultar partido" ya no vive en Resumen — retirado, mecanismo exclusivo del long press en Historial', () => {
  assert.doesNotMatch(indexHtml, />Ocultar partido</);
  const analysisBody = extractFunctionBody(appJs, 'renderAnalysis');
  assert.doesNotMatch(analysisBody, /OCULTAR PARTIDO/);
});

/* ---- Bundle/cache quartet de esta ronda ---- */

test('h21: bundle/cache quartet queda alineado', () => {
  assert.match(indexHtml, /app\.js\?v=04\.28-h5/);
  assert.match(indexHtml, /styles\.css\?v=04\.28-h5/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\.28-h5'/);
  assert.match(swJs, /CACHE_NAME = 'bramulab-v04-28-h5'/);
  assert.match(swJs, /app\.js\?v=04\.28-h5/);
  assert.match(swJs, /styles\.css\?v=04\.28-h5/);
  assert.match(versionJson, /"bundle":\s*"04\.28-h5"/);
  // V04.12 — ronda visible: la versión pública sube y el modal nunca muestra el sufijo hN.
  assert.match(storeJs, /APP_VERSION = 'BRAMUlab V04\.28'/);
  assert.match(versionJson, /"version":\s*"BRAMUlab V04\.28"/);
});
