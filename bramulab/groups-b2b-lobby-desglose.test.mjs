// BRAMUlab — Grupos BRAMU B2b: lobby + desglose de puntos + resumen de Race (handoff 79, 28/09/2026).
// Ejecutar con: node --test bramulab/groups-b2b-lobby-desglose.test.mjs
//
// groups.js sigue siendo la ÚNICA autoridad de puntos/top-3/posiciones — este archivo prueba las
// funciones puras nuevas (buildLobbyCardSummary/buildPlayerWeeklyBreakdown/buildRaceWeeklySummary)
// contra IIFE cargados en vm.createContext, mismo arnés que los tests de Grupos anteriores. La
// UI (app.js) no tiene cobertura unitaria por diseño (necesita DOM completo); sus garantías de
// wiring (navegación lobby<->detalle, "no duplicar lógica") se cubren con guardas estáticas sobre
// el código fuente, mismo mecanismo que otros archivos de este mismo módulo.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

function makeSandbox() {
  const store = {};
  const sandbox = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  vm.createContext(sandbox);
  return sandbox;
}
const sb = makeSandbox();
for (const f of ['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js']) {
  vm.runInContext(read(f), sb, { filename: f });
}
const PG = sb.PLGroups;
const PH = sb.PLPlayerHome;
const j = (x) => JSON.parse(JSON.stringify(x));

/* ------------------------------------------------------------------ */
/* buildLobbyCardSummary                                                */
/* ------------------------------------------------------------------ */

test('lobby: 1 miembro sin puntos -> estado one_member', () => {
  const s = PG.buildLobbyCardSummary([], 1, 'x');
  assert.equal(s.state, 'one_member');
  assert.deepEqual(j(s.visibleRows), []);
  assert.equal(s.compressedTie, null);
  assert.equal(s.selfRow, null);
});

test('lobby: 2 miembros sin puntos -> estado two_members', () => {
  assert.equal(PG.buildLobbyCardSummary([], 2, 'x').state, 'two_members');
  // También con filas de 0 puntos (grupo con miembros pero sin actividad puntuable).
  assert.equal(PG.buildLobbyCardSummary([{ userId: 'a', name: 'A', points: 0, position: 1 }], 2, 'x').state, 'two_members');
});

test('lobby: 3+ miembros sin puntos -> estado no_activity', () => {
  assert.equal(PG.buildLobbyCardSummary([{ userId: 'a', name: 'A', points: 0, position: 1 }], 3, 'x').state, 'no_activity');
});

test('lobby: con puntos, hasta 3 filas reales respetando el empate 1,1,3', () => {
  const table = [
    { userId: 'a', name: 'A', points: 12, position: 1 },
    { userId: 'b', name: 'B', points: 12, position: 1 },
    { userId: 'c', name: 'C', points: 7, position: 3 },
    { userId: 'd', name: 'D', points: 0, position: 4 },
  ];
  const s = PG.buildLobbyCardSummary(table, 4, 'd');
  assert.equal(s.state, 'has_points');
  assert.equal(s.compressedTie, null);
  assert.deepEqual(j(s.visibleRows.map((r) => [r.position, r.userId])), [[1, 'a'], [1, 'b'], [3, 'c']]);
  // D no está entre las visibles -> aparece como "Vos".
  assert.deepEqual(j(s.selfRow), j(table[3]));
});

test('lobby: caller ya visible no se duplica como "Vos"', () => {
  const table = [
    { userId: 'a', name: 'A', points: 12, position: 1 },
    { userId: 'b', name: 'B', points: 12, position: 1 },
    { userId: 'c', name: 'C', points: 7, position: 3 },
  ];
  assert.equal(PG.buildLobbyCardSummary(table, 3, 'c').selfRow, null);
});

test('lobby: compresión de empate — 4 comparten la punta, nunca se corta la tira a la mitad', () => {
  const table = [
    { userId: 'a', name: 'A', points: 5, position: 1 },
    { userId: 'b', name: 'B', points: 5, position: 1 },
    { userId: 'c', name: 'C', points: 5, position: 1 },
    { userId: 'd', name: 'D', points: 5, position: 1 },
  ];
  const inside = PG.buildLobbyCardSummary(table, 4, 'a');
  assert.deepEqual(j(inside.visibleRows), []);
  assert.deepEqual(j(inside.compressedTie), { count: 4, points: 5 });
  assert.deepEqual(j(inside.selfRow), j(table[0]), 'caller dentro del empate comprimido igual aparece como "Vos"');
  const outside = PG.buildLobbyCardSummary(table, 5, 'e');
  assert.equal(outside.selfRow, null, 'caller ni siquiera tiene fila -> nunca se inventa una');
});

test('lobby: un grupo tenso (2+3 empatados) nunca corta el segundo grupo a la mitad', () => {
  const table = [
    { userId: 'a', name: 'A', points: 10, position: 1 },
    { userId: 'b', name: 'B', points: 10, position: 1 },
    { userId: 'c', name: 'C', points: 8, position: 3 },
    { userId: 'd', name: 'D', points: 8, position: 3 },
    { userId: 'e', name: 'E', points: 8, position: 3 },
  ];
  const s = PG.buildLobbyCardSummary(table, 5, 'z');
  // Agregar el grupo de 3 (posición 3) a las 2 ya visibles pasaría de 3 -> nunca se corta:
  // quedan solo las 2 primeras.
  assert.deepEqual(j(s.visibleRows.map((r) => r.userId)), ['a', 'b']);
  assert.equal(s.compressedTie, null);
});

/* ------------------------------------------------------------------ */
/* buildPlayerWeeklyBreakdown — mismo helper que computeWeeklyTable      */
/* ------------------------------------------------------------------ */

function member(name, userId, periods) { return { name, userId, isAdmin: false, periods }; }
function period(joinedAt, leftAt) { return { joinedAt, leftAt: leftAt || null }; }
function match(id, playedAt, winnerTeam, sets, levelsSource) {
  return {
    matchId: id, playedAt, winnerTeam, regulationCompleted: true, levelsSource,
    sets,
    players: [
      { id: 0, team: 'A', userId: 'a', name: 'A' },
      { id: 1, team: 'A', userId: 'c', name: 'C' },
      { id: 2, team: 'B', userId: 'b', name: 'B' },
      { id: 3, team: 'B', userId: 'd', name: 'D' },
    ],
  };
}
const LONG_AGO = '2026-01-05T00:00:00.000Z';
const GROUP = { id: 'g', members: [
  member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]), member('C', 'c', [period(LONG_AGO)]),
] };
const THIS_MON = PH.startOfWeekMonday(new Date('2026-09-21T12:00:00'));

function buildTenMatchHistory() {
  const history = [];
  const wins = [[6, 1], [6, 1], [6, 4], [6, 4], [6, 4], [6, 4]];
  wins.forEach(([ga, gb], i) => {
    history.push(match(`win${i}`, `2026-09-2${1 + i}T10:00:00Z`, 'A', [{ gamesA: ga, gamesB: gb }, { gamesA: ga, gamesB: gb }], 'official'));
  });
  for (let i = 0; i < 4; i++) {
    history.push(match(`loss${i}`, `2026-09-27T1${i}:00:00Z`, 'B', [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }], 'official'));
  }
  return history;
}

test('desglose: total visible = suma exacta de los 2 partidos marcados counted (10 partidos · 6V · 4D · 12 pts, sin esconder los otros 8)', () => {
  const history = buildTenMatchHistory();
  const matches = PG.computeMatchesForGroupInWeek(history, GROUP, THIS_MON);
  const bd = PG.buildPlayerWeeklyBreakdown(matches, { name: 'C', userId: 'c' }, history);
  assert.equal(bd.matchesPlayed, 10);
  assert.equal(bd.rows.length, 10, 'los 10 partidos están, ninguno escondido');
  const counted = bd.rows.filter((r) => r.counted);
  assert.equal(counted.length, 2);
  assert.equal(counted.reduce((s, r) => s + r.points, 0), bd.total, 'total = suma EXACTA de los counted');
  assert.equal(bd.total, 12);
  // Coincide con la fila real de la tabla (mismo helper compartido, computePlayerScoredMatches).
  const table = PG.computeWeeklyTable(history, GROUP, THIS_MON);
  const rowC = table.find((r) => r.userId === 'c');
  assert.equal(rowC.points, bd.total);
  assert.equal(rowC.matchesPlayed, bd.matchesPlayed);
});

test('desglose: derrota = 0 pts; victoria fuera del top 2 = "no contada" (no oculta, marcada)', () => {
  const history = buildTenMatchHistory();
  const matches = PG.computeMatchesForGroupInWeek(history, GROUP, THIS_MON);
  const bd = PG.buildPlayerWeeklyBreakdown(matches, { name: 'C', userId: 'c' }, history);
  const losses = bd.rows.filter((r) => !r.won);
  assert.ok(losses.length > 0);
  losses.forEach((r) => { assert.equal(r.points, 0); assert.equal(r.counted, false); });
  const uncountedWin = bd.rows.find((r) => r.won && !r.counted);
  assert.ok(uncountedWin, 'hay al menos una victoria que no entró en el top 2');
  assert.ok(uncountedWin.points > 0, 'sigue teniendo puntos propios (no se pisan a 0), solo no se suman al total');
});

test('desglose: el bonus mostrado coincide con computeMatchPointsBreakdown del mismo partido', () => {
  const history = buildTenMatchHistory();
  const matches = PG.computeMatchesForGroupInWeek(history, GROUP, THIS_MON);
  const bd = PG.buildPlayerWeeklyBreakdown(matches, { name: 'C', userId: 'c' }, history);
  bd.rows.forEach((row) => {
    const m = matches.find((mm) => mm.matchId === row.matchId);
    const real = PG.computeMatchPointsBreakdown(m, history);
    assert.deepEqual(j(row.bonus), { sorpresa: real.sorpresa, remontada: real.remontada, claraVictoria: real.claraVictoria });
  });
  // El primer partido (6-1/6-1) es Victoria clara real.
  assert.equal(bd.rows[0].bonus.claraVictoria, true);
});

test('desglose: trae compañero y rivales reales del partido (nunca vacío si el partido los tiene)', () => {
  const history = buildTenMatchHistory();
  const matches = PG.computeMatchesForGroupInWeek(history, GROUP, THIS_MON);
  const bd = PG.buildPlayerWeeklyBreakdown(matches, { name: 'C', userId: 'c' }, history);
  bd.rows.forEach((row) => {
    assert.equal(row.partnerName, 'A');
    assert.deepEqual(j(row.rivalNames), ['B', 'D']);
  });
});

/* ------------------------------------------------------------------ */
/* buildRaceWeeklySummary — misma enumeración de semanas que Race        */
/* ------------------------------------------------------------------ */

test('race semanal: suma al total anual de esa misma semana (misma fuente que computeRaceAnual)', () => {
  const history = buildTenMatchHistory();
  const weeks = PG.buildRaceWeeklySummary(history, GROUP, 2026, { name: 'C', userId: 'c' });
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].points, 12);
  assert.equal(weeks[0].matchesPlayed, 10);
  assert.equal(weeks[0].wins, 6);
  assert.equal(weeks[0].losses, 4);
  const race = PG.computeRaceAnual(history, GROUP, 2026);
  const rowC = race.find((r) => r.userId === 'c');
  assert.equal(weeks.reduce((s, w) => s + w.points, 0), rowC.points);
});

test('race semanal: orden más-reciente-primero', () => {
  const history = buildTenMatchHistory();
  // Agrega un partido de una semana bien anterior para tener 2 semanas.
  history.push(match('old', '2026-02-03T10:00:00Z', 'A', [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }], 'official'));
  const weeks = PG.buildRaceWeeklySummary(history, GROUP, 2026, { name: 'C', userId: 'c' });
  assert.equal(weeks.length, 2);
  assert.ok(new Date(weeks[0].weekStart).getTime() > new Date(weeks[1].weekStart).getTime());
});

/* ------------------------------------------------------------------ */
/* Guardas estáticas — navegación/wiring del lobby (app.js)             */
/* ------------------------------------------------------------------ */

const appJs = read('app.js');
const indexHtml = read('index.html');

test('app.js: bottom-nav "groups" abre el lobby, nunca el detalle directo', () => {
  assert.match(appJs, /else if \(target === 'groups'\) openGroupsLobbyScreen\(\);/);
});

test('app.js: back del detalle vuelve al lobby, nunca a Home', () => {
  const body = appJs.slice(appJs.indexOf('function initGroupsScreen'), appJs.indexOf('function initGroupsScreen') + 400);
  assert.match(body, /groups-back-btn'\)\.addEventListener\('click', \(\) => openGroupsLobbyScreen\(\)\);/);
});

test('app.js: tocar una tarjeta del lobby abre el detalle (openGroupsScreen con el groupId)', () => {
  assert.match(appJs, /card\.addEventListener\('click', \(\) => openGroupsScreen\(card\.dataset\.groupId\)\);/);
});

test('app.js: el lobby usa Auth.getGroupsLobby (un solo viaje), nunca N llamadas por grupo ni localStorage como autoridad', () => {
  const body = appJs.slice(appJs.indexOf('async function refreshGroupsLobby'), appJs.indexOf('function groupInitials'));
  assert.match(body, /Auth\.getGroupsLobby\(/);
  assert.doesNotMatch(body, /Store\.loadGroups\(\)/);
  assert.doesNotMatch(body, /for \s*\(|\.forEach\([^)]*Auth\./s, 'sin loop que llame a Auth por cada grupo');
});

test('app.js: la fila de Semana actual/pasada/Race ya no abre Perfil directo — solo "Ver perfil" adentro de la hoja', () => {
  const body = appJs.slice(appJs.indexOf('function renderGroupTableInto'), appJs.indexOf('function clearGroupPanelsWhileLoading'));
  assert.doesNotMatch(body, /openProfileScreen|openPlayerPublicProfile/);
  assert.match(body, /openGroupBreakdownSheet\(/);
  assert.match(body, /openGroupRaceSummarySheet\(/);
  const profileTargetBody = appJs.slice(appJs.indexOf('function openGroupsSheetProfileTarget'), appJs.indexOf('function openGroupsSheetProfileTarget') + 500);
  assert.match(profileTargetBody, /openProfileScreen\('mi-perfil'\)/);
  assert.match(profileTargetBody, /openPlayerPublicProfile\(/);
});

test('app.js: el desglose/Race reusan groups.js (PG.build...), nunca reconstruyen el top-3 en app.js', () => {
  const bdBody = appJs.slice(appJs.indexOf('function openGroupBreakdownSheet'), appJs.indexOf('function closeGroupBreakdownSheet'));
  assert.match(bdBody, /PG\.buildPlayerWeeklyBreakdown\(/);
  const raceBody = appJs.slice(appJs.indexOf('function openGroupRaceSummarySheet'), appJs.indexOf('function closeGroupRaceSummarySheet'));
  assert.match(raceBody, /PG\.buildRaceWeeklySummary\(/);
});

test('index.html: el EJEMPLO del estado cero usa la misma clase de tarjeta que el lobby real (.lobby-card)', () => {
  assert.match(appJs, /GROUPS_LOBBY_EXAMPLE_ENTRY/);
  assert.match(appJs, /class="lobby-card\$\{isExample/);
});

test('index.html: "Agregar jugador" vive SOLO en Configuración (familia secundaria lima), no en el detalle', () => {
  assert.doesNotMatch(indexHtml, /id="groups-add-member-btn"/);
  assert.doesNotMatch(indexHtml, /id="groups-points-info-btn"/);
  assert.match(indexHtml, /id="group-settings-add-member-btn" class="btn-secondary btn-secondary--lime[ "]/);
  assert.doesNotMatch(appJs, /groups-add-member-btn|groups-points-info-btn/);
});

test('index.html: la ayuda de Grupos quedó fusionada en una sola hoja ("Cómo funcionan los Grupos BRAMU")', () => {
  const matches = indexHtml.match(/group-points-info-sheet/g) || [];
  assert.ok(matches.length >= 1);
  assert.match(indexHtml, /CÓMO FUNCIONAN LOS GRUPOS BRAMU/);
  assert.doesNotMatch(indexHtml, /¿CÓMO SE SUMAN LOS PUNTOS\?/);
});

/* ------------------------------------------------------------------ */
/* Issue #2 — ajustes Central pre-PASS visual                           */
/* ------------------------------------------------------------------ */

function fnBody(src, sig, len = 2500) { const i = src.indexOf(sig); assert.ok(i >= 0, sig); return src.slice(i, i + len); }

test('create server: refreshGroupsLobby + renderGroupsLobbyScreen ocurren antes de openGroupCreatedSheet', () => {
  const body = fnBody(appJs, 'async function submitCreateGroupServer');
  const iSheet = body.indexOf('openGroupCreatedSheet(');
  const iRefresh = body.indexOf('refreshGroupsLobby()');
  const iRender = body.indexOf('renderGroupsLobbyScreen()');
  assert.ok(iRefresh > 0 && iRender > 0 && iSheet > 0);
  assert.ok(iRefresh < iSheet && iRender < iSheet);
});

test('create legacy: repinta el lobby antes del success sheet', () => {
  const full = fnBody(appJs, '  function submitCreateGroup()');
  const body = full.slice(full.indexOf('Store.createGroup('));
  const iRender = body.indexOf('renderGroupsLobbyScreen()');
  const iSheet = body.indexOf('openGroupCreatedSheet(');
  assert.ok(iRender > 0 && iSheet > 0 && iRender < iSheet);
});

test('delete: vuelve al lobby nuevo (reset cache + openGroupsLobbyScreen), nunca a la vista legacy', () => {
  const body = fnBody(appJs, 'function handleDeleteGroup', 1200);
  assert.match(body, /resetGroupsLobbyCache\(\)/);
  assert.match(body, /openGroupsLobbyScreen\(\)/);
  assert.doesNotMatch(body, /showView\('groups'\)/);
  assert.doesNotMatch(body, /renderGroupsScreen\(\)/);
});

test('race semanal: reingreso — no fabrica semanas 0 pts anteriores a la etapa visible vigente', () => {
  const REJOIN = '2026-09-21T03:00:00.000Z';
  const g = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]), member('D', 'd', [period(LONG_AGO)]),
    member('C', 'c', [period('2026-01-05T00:00:00.000Z', '2026-03-01T00:00:00.000Z'), period(REJOIN)]),
  ] };
  const win = [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }];
  const history = [
    match('feb', '2026-02-03T10:00:00Z', 'A', win, 'official'),
    match('now', '2026-09-22T10:00:00Z', 'A', win, 'official'),
  ];
  const starts = PG.computeGroupYearWeekStarts(history, g, 2026);
  assert.equal(starts.length, 2, 'la semana de febrero sigue siendo del grupo');
  const weeks = PG.buildRaceWeeklySummary(history, g, 2026, { name: 'C', userId: 'c' });
  assert.ok(weeks.length >= 1);
  weeks.forEach((w) => assert.ok(new Date(w.weekStart).getTime() >= new Date('2026-09-14').getTime(), 'sin semanas previas al reingreso'));
  const rowC = PG.computeRaceAnual(history, g, 2026).find((r) => r.userId === 'c');
  assert.equal(weeks.reduce((s, w) => s + w.points, 0), rowC ? rowC.points : 0);
});

test('bottom-nav: group-settings mantiene activa la sección groups', () => {
  const body = fnBody(appJs, 'function updateBottomNavActive', 700);
  assert.match(body, /viewName === 'group-settings'/);
  assert.match(body, /\? 'groups'/);
});

/* ------------------------------------------------------------------ */
/* Pulido visual final B2b (revisión real iPhone, h35)                  */
/* ------------------------------------------------------------------ */

test('detalle: un único "?" en el header junto al engranaje abre la ayuda existente', () => {
  assert.match(indexHtml, /id="groups-help-btn"/);
  assert.ok(indexHtml.indexOf('id="groups-help-btn"') < indexHtml.indexOf('id="groups-settings-btn"'));
  assert.match(appJs, /#groups-help-btn'\)\.addEventListener\('click', openGroupPointsInfoSheet\)/);
});

test('lobby: "Crear otro grupo" pasa a "Nuevo grupo"', () => {
  assert.doesNotMatch(indexHtml, /Crear otro grupo/);
  assert.match(indexHtml, /groups-lobby-create-other-btn[^>]*>Nuevo grupo</);
});

test('lobby: medallas 🥇🥈🥉 según posición de competición real (1,1,3 = 🥇 🥇 🥉; sin plata inventada)', () => {
  const body = fnBody(appJs, 'function lobbyMedal', 200);
  assert.match(body, /1: '🥇', 2: '🥈', 3: '🥉'/);
  const summary = PG.buildLobbyCardSummary([
    { name: 'A', userId: 'a', points: 10, position: 1 }, { name: 'B', userId: 'b', points: 10, position: 1 },
    { name: 'C', userId: 'c', points: 5, position: 3 },
  ], 3, null);
  assert.deepEqual(j(summary.visibleRows).map((r) => r.position), [1, 1, 3]);
  const row = fnBody(appJs, 'function buildLobbyCardRowHTML', 1000);
  assert.match(row, /lobbyMedal\(row\.position\)/);
  assert.match(row, /avatarSignedUrl/);
  assert.match(row, /playerInitials\(row\.name\)/, 'iniciales como fallback');
});

test('lobby: composición final 50 (grupo) / 45 (jugador) / gap 6 / separación del head 15', () => {
  const css = read('styles.css');
  assert.match(css, /\.lobby-card__avatar\{\s*flex:none; width:50px; height:50px;/);
  assert.match(css, /\.lobby-card__row-avatar\{\s*flex:none; width:45px; height:45px;/);
  assert.match(css, /\.lobby-card__body\{[^}]*gap: 6px;/);
  assert.match(css, /\.lobby-card__head\{[^}]*margin-bottom: 15px;/);
  assert.match(css, /\.lobby-card__row\{[^}]*min-height: 45px;/);
  // El avatar del grupo sigue con iniciales (B2c pondrá la foto real).
  assert.match(appJs, /<span class="lobby-card__avatar">\$\{escapeHtml\(groupInitials\(entry\.name\)\)\}<\/span>/);
});

test('configuración: cada miembro reusa avatar + @usuario canónicos (sin RPC por fila)', () => {
  const full = fnBody(appJs, 'function renderGroupSettingsMembers', 2600);
  const body = full.slice(0, full.indexOf('function handleGroupSettingsAction'));
  assert.match(body, /groupRowIdentity\(m\.name, m\.userId\)/);
  assert.match(body, /buildGroupAvatarHTML\(m\.name, m\.userId\)/);
  assert.match(body, /ident\.username \? `@\$\{ident\.username\}` : \(ident\.serverBacked \? null : buildPlayerHandle\(m\.name\)\)/);
  assert.match(body, /group-table__admin-tag/);
  assert.doesNotMatch(body, /Auth\.|await |fetch\(|ensureGroupIdentities/, 'sin requests por miembro');
  assert.doesNotMatch(body, /matchesPlayed|wins|levelPublic|efectividad/i);
});

test('desglose: la pareja incluye al titular ("Seba / Lucho vs Steve / Pablito")', () => {
  const row = fnBody(appJs, 'function buildGroupBreakdownRowHTML', 1500);
  assert.match(row, /buildGroupBreakdownRowHTML\(row, ownerName\)|\[ownerName, row\.partnerName\]\.filter\(Boolean\)\.join\(' \/ '\)/);
  assert.match(appJs, /buildGroupBreakdownRowHTML\(r, name\)/);
  assert.doesNotMatch(row, /`con \$\{/);
});

test('scroll: reserva derecha en desglose/Race y bottom-nav despejada (--bottomnav-h, sin hardcodear)', () => {
  const css = read('styles.css');
  assert.match(css, /#group-breakdown-sheet \.load-player-sheet__scroll,\s*#group-race-summary-sheet \.load-player-sheet__scroll\{ padding-right: 12px; \}/);
  assert.match(css, /\.analysis-scroll\{[^}]*var\(--bottomnav-h, 0px\)/);
});

test('configuración: Agregar jugador vuelve a ancho completo, secundario lima (misma composición que CREAR GRUPO)', () => {
  assert.match(indexHtml, /id="group-settings-add-member-btn" class="btn-secondary btn-secondary--lime groups-switch-create-btn">\+ AGREGAR JUGADOR</);
  const css = read('styles.css');
  assert.match(css, /\.groups-switch-create-btn\{ width:100%; flex:none;/);
  assert.doesNotMatch(css, /#group-settings-add-member-btn\{/, 'sin override compacto de V04.12');
});

test('desglose: cada partido trae sets reales desde la perspectiva del jugador (sin inventar)', () => {
  const history = [
    match('w', '2026-09-22T10:00:00Z', 'A', [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 2 }], 'official'),
    match('l', '2026-09-23T10:00:00Z', 'B', [{ gamesA: 3, gamesB: 6 }, { gamesA: 4, gamesB: 6 }], 'official'),
  ];
  const asA = j(PG.buildPlayerWeeklyBreakdown(history, { name: 'A', userId: 'a' }, history)).rows;
  assert.deepEqual(asA.find((r) => r.matchId === 'w').sets, [[6, 4], [6, 2]]);
  assert.deepEqual(asA.find((r) => r.matchId === 'l').sets, [[3, 6], [4, 6]]);
  const asB = j(PG.buildPlayerWeeklyBreakdown(history, { name: 'B', userId: 'b' }, history)).rows;
  assert.deepEqual(asB.find((r) => r.matchId === 'w').sets, [[4, 6], [2, 6]]);
});

test('desglose: fila con "/" (nunca "+"), resultado + motivo y sheet más alto con "Ver perfil de X ›" discreto', () => {
  const row = fnBody(appJs, 'function buildGroupBreakdownRowHTML', 1500);
  assert.match(row, /join\(' \/ '\)/);
  assert.doesNotMatch(row, /join\(' \+ '\)/);
  assert.match(row, /setsText/);
  assert.match(row, /breakdownReasonLabel\(row\)/);
  assert.match(row, /No entra en tus 2 mejores/);
  assert.match(indexHtml, /id="group-breakdown-sheet" class="bottom-sheet bottom-sheet--tall bottom-sheet--tall-xl"/);
  assert.match(indexHtml, /id="group-breakdown-view-profile-btn" class="group-sheet-profile-link"/);
  assert.doesNotMatch(indexHtml, />VER PERFIL</);
  assert.match(appJs, /Ver perfil de \$\{name\} ›/);
  assert.match(read('styles.css'), /\.bottom-sheet--tall-xl\{ height: clamp\(520px, 82dvh/);
});

test('ayuda: cubre automatización, 3/4, top 2, Clásico/Americano, reinicio semanal + Race y que NO toca Nivel ni Ranking', () => {
  const sheet = fnBody(indexHtml, 'id="group-points-info-sheet"', 3500);
  ['Jugá como siempre. BRAMU hace el resto.', '3 de los 4 jugadores', 'Tus 2 mejores cuentan', 'Clásico', 'Americano', '5 puntos', '3 puntos', 'Remontada', 'lunes', 'Race anual', 'no modifican', 'Nivel BRAMU', 'Ranking BRAMU']
    .forEach((t) => assert.ok(sheet.includes(t), t));
});
