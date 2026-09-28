// BRAMUlab — Grupos BRAMU: cierre B1 tras QA real (handoff 71, 28/09/2026).
// Ejecutar con: node --test bramulab/groups-b1-cierre-membresia-baja.test.mjs
//
// Cubre exactamente los 12 tests mínimos del handoff (§A regla semanal de alta/reingreso,
// §B baja = ocultamiento total) + guardas estáticas de los ajustes C1-C4 (no-Grupos). Mismo
// arnés que groups-b1-server-backed.test.mjs (IIFE sin `export`, vm.createContext con
// localStorage falso).

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

/* ------------------------------------------------------------------ */
/* Fixtures                                                             */
/* ------------------------------------------------------------------ */

// Lunes real de referencia (setiembre 2026) — mismo patrón que groups-b1-server-backed.test.mjs.
const THIS_MON = PH.startOfWeekMonday(new Date('2026-09-21T12:00:00'));
const PREV_MON = new Date(THIS_MON.getTime() - PG.WEEK_MS);
const iso = (day, hour) => new Date(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).toISOString();
const isoPrev = (day, hour) => new Date(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

function member(name, userId, periods, isAdmin) {
  return { name, userId, isAdmin: !!isAdmin, periods };
}
function period(joinedAt, leftAt) { return { joinedAt, leftAt: leftAt || null }; }

function match(id, playedAt, teamA, teamB, winnerTeam, sets) {
  return {
    matchId: id, playedAt, winnerTeam, regulationCompleted: true,
    sets: sets || [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }],
    players: [
      { id: 0, team: 'A', userId: teamA[0], name: teamA[0] },
      { id: 1, team: 'A', userId: teamA[1], name: teamA[1] },
      { id: 2, team: 'B', userId: teamB[0], name: teamB[0] },
      { id: 3, team: 'B', userId: teamB[1], name: teamB[1] },
    ],
  };
}

const LONG_AGO = '2026-01-05T00:00:00.000Z'; // un lunes bien anterior

/* ------------------------------------------------------------------ */
/* §A — 6 tests: alta/reingreso vale desde el lunes de esa semana       */
/* ------------------------------------------------------------------ */

test('A1: alta posterior a DERROTA, misma semana → el jugador puede reflejar ese partido (0 pts, cuenta como jugado)', () => {
  // C se agrega el miércoles de esta semana; el partido (A+B vs C+D) se jugó el lunes, ANTES del
  // instante exacto de alta de C — bajo el piso semanal, cuenta igual (A,B,C = 3/4; D ajeno).
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period(iso(23, 15))]), // miércoles 15:00
  ] };
  const m = match('m1', iso(21, 20), ['A_', 'B_'], ['C_', 'D_'], 'A'); // team A gana, C (team B) pierde
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'c'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), true, 'con el piso semanal, A,B,C ya son 3/4');
  const table = PG.computeWeeklyTable([m], group, THIS_MON);
  const c = table.find((r) => r.userId === 'c');
  assert.ok(c, 'C tiene fila en la tabla de esta semana');
  assert.equal(c.matchesPlayed, 1);
  assert.equal(c.losses, 1);
  assert.equal(c.points, 0, 'perdió: 0 puntos, pero el partido SÍ se refleja (matchesPlayed=1)');
});

test('A2: alta posterior a VICTORIA, misma semana → puede recibir puntos', () => {
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period(iso(23, 15))]),
  ] };
  // C (team B) gana esta vez — sets explícitos consistentes con winnerTeam='B' (sin bonus).
  const m = match('m2', iso(21, 20), ['D_', 'A_'], ['C_', 'B_'], 'B', [{ gamesA: 4, gamesB: 6 }, { gamesA: 4, gamesB: 6 }]);
  m.players[0].userId = 'd'; m.players[1].userId = 'a'; m.players[2].userId = 'c'; m.players[3].userId = 'b';
  assert.equal(PG.doesMatchCountForGroup(m, group), true);
  const table = PG.computeWeeklyTable([m], group, THIS_MON);
  const c = table.find((r) => r.userId === 'c');
  assert.equal(c.wins, 1);
  // El valor exacto de puntos (base+bonus) no es el objeto de esta regla — eso ya lo cubre
  // groups-b1-server-backed.test.mjs (B1-4). Acá solo importa que GANAR le da puntos (>0).
  assert.ok(c.points > 0, 'ganó: recibe puntos (no queda en 0 solo por haberse sumado esta semana)');
});

test('A3: alta del tercer miembro DESPUÉS del partido, misma semana → 2/4 pasa a 3/4 y entra', () => {
  const groupSinC = { id: 'g', members: [member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)])] };
  const groupConC = { id: 'g', members: [...groupSinC.members, member('C', 'c', [period(iso(23, 15))])] };
  const m = match('m3', iso(21, 20), ['A_', 'B_'], ['C_', 'D_'], 'A');
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'c'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, groupSinC), false, 'sin C todavía en el grupo: solo 2/4');
  assert.equal(PG.doesMatchCountForGroup(m, groupConC), true, 'con C agregado (piso semanal): 3/4');
});

test('A4: alta actual NO habilita un partido de una semana ANTERIOR', () => {
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period(iso(23, 15))]), // alta ESTA semana
  ] };
  // Mismo partido que A3, pero jugado la semana PASADA.
  const prevDay = new Date(THIS_MON.getTime() - 3 * 86400000); // jueves de la semana anterior
  const m = match('m4', prevDay.toISOString(), ['A_', 'B_'], ['C_', 'D_'], 'A');
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'c'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), false, 'el piso semanal de C es ESTA semana; nunca alcanza una semana anterior');
});

test('A5: crear el grupo a mitad de semana puede recuperar partidos de esa misma semana', () => {
  // Los 3 miembros se incorporan juntos el miércoles (creación del grupo a mitad de semana).
  const group = { id: 'g', members: [
    member('A', 'a', [period(iso(23, 10))]), member('B', 'b', [period(iso(23, 10))]), member('C', 'c', [period(iso(23, 10))]),
  ] };
  const m = match('m5', iso(21, 20), ['A_', 'B_'], ['C_', 'D_'], 'A'); // lunes, ANTES de la creación
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'c'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), true);
});

test('A6: reingreso = nueva etapa, con la misma regla semanal (piso al lunes de la semana de reingreso)', () => {
  // C tuvo un período cerrado hace mucho y reingresa el miércoles de ESTA semana.
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period('2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z'), period(iso(23, 15))]),
  ] };
  const m = match('m6', iso(21, 20), ['A_', 'B_'], ['C_', 'D_'], 'A');
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'c'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), true, 'el reingreso de esta semana también aplica el piso semanal');
});

/* ------------------------------------------------------------------ */
/* §B — 6 tests: eliminar = dejar de verlo, sin borrar ni recalcular    */
/* ------------------------------------------------------------------ */

function buildRemovalScenario() {
  // A,B siempre activos. C activo hasta el jueves de esta semana (removido), con un partido
  // ganado ESTA semana y otro ganado la SEMANA PASADA (para probar Semana actual Y pasada).
  const activeGroup = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)], true), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period(LONG_AGO)]),
  ] };
  const removedGroup = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)], true), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period(LONG_AGO, iso(25, 10))]), // removido el jueves de esta semana
  ] };
  const prevWeekDay = new Date(PREV_MON.getTime() + 3 * 86400000);
  const history = [
    match('r1', iso(21, 20), ['A_', 'C_'], ['B_', 'D_'], 'A', [{ gamesA: 6, gamesB: 1 }, { gamesA: 6, gamesB: 2 }]), // esta semana, gana A+C
    match('r2', prevWeekDay.toISOString(), ['A_', 'C_'], ['B_', 'D_'], 'A'), // semana pasada, gana A+C
  ];
  history.forEach((m) => { m.players[0].userId = 'a'; m.players[1].userId = 'c'; m.players[2].userId = 'b'; m.players[3].userId = 'd'; });
  return { activeGroup, removedGroup, history };
}

test('B1: eliminado desaparece de Semana actual, Semana pasada y Race', () => {
  const { activeGroup, removedGroup, history } = buildRemovalScenario();
  const beforeCurrent = PG.computeWeeklyTable(history, activeGroup, THIS_MON);
  assert.ok(beforeCurrent.some((r) => r.userId === 'c'), 'control: antes de eliminar, C aparece');
  const afterCurrent = PG.computeWeeklyTable(history, removedGroup, THIS_MON);
  const afterPrev = PG.computeWeeklyTable(history, removedGroup, PREV_MON);
  const afterRace = PG.computeRaceAnual(history, removedGroup, 2026);
  assert.ok(!afterCurrent.some((r) => r.userId === 'c'), 'C no aparece en Semana actual');
  assert.ok(!afterPrev.some((r) => r.userId === 'c'), 'C no aparece en Semana pasada (aunque ganó puntos reales esa semana)');
  assert.ok(!afterRace.some((r) => r.userId === 'c'), 'C no aparece en la Race');
});

test('B2: eliminado desaparece de BRAMU Intelligence (no se lo nombra en el destaque de bonus)', () => {
  const { removedGroup, history } = buildRemovalScenario();
  // Victoria clara (6-1/6-2) de A+C: candidato natural de insightBonusHighlight.
  const currentMatches = PG.computeMatchesForGroupInWeek(history, removedGroup, THIS_MON);
  const currentTable = PG.computeWeeklyTable(history, removedGroup, THIS_MON);
  const out = PG.buildGroupIntelligence({ currentTable, previousTable: [], raceTable: currentTable, currentMatches, fullHistory: history });
  assert.ok(!out.some((t) => /\bC\b/.test(t)), `ningún insight nombra a C ya eliminado: ${JSON.stringify(out)}`);
  // Control: con C todavía activo, el highlight SÍ lo nombra (prueba que el guard es real).
  const { activeGroup } = buildRemovalScenario();
  const activeMatches = PG.computeMatchesForGroupInWeek(history, activeGroup, THIS_MON);
  const activeTable = PG.computeWeeklyTable(history, activeGroup, THIS_MON);
  const activeOut = PG.buildGroupIntelligence({ currentTable: activeTable, previousTable: [], raceTable: activeTable, currentMatches: activeMatches, fullHistory: history });
  assert.ok(activeOut.some((t) => /\bC\b/.test(t)), 'control: con C activo, sí puede nombrarlo');
});

test('B3: los puntos de los demás miembros permanecen exactamente iguales tras la baja', () => {
  const { activeGroup, removedGroup, history } = buildRemovalScenario();
  const before = PG.computeWeeklyTable(history, activeGroup, THIS_MON).find((r) => r.userId === 'a');
  const after = PG.computeWeeklyTable(history, removedGroup, THIS_MON).find((r) => r.userId === 'a');
  assert.equal(after.points, before.points);
  assert.equal(after.matchesPlayed, before.matchesPlayed);
  assert.equal(after.wins, before.wins);
});

test('B4: el partido real permanece — sigue contando para el grupo (con y sin C activo)', () => {
  const { removedGroup, history } = buildRemovalScenario();
  history.forEach((m) => assert.equal(PG.doesMatchCountForGroup(m, removedGroup), true, `el partido ${m.matchId} sigue contando pese a la baja de C`));
});

test('B5: la Race de los demás no cambia', () => {
  const { activeGroup, removedGroup, history } = buildRemovalScenario();
  const before = PG.computeRaceAnual(history, activeGroup, 2026).find((r) => r.userId === 'a');
  const after = PG.computeRaceAnual(history, removedGroup, 2026).find((r) => r.userId === 'a');
  assert.equal(after.points, before.points);
});

test('B6: reingreso no revive automáticamente filas/puntos de una etapa eliminada anterior', () => {
  // C: período 1 (hace mucho, YA cerrado por una baja anterior) tenía partidos con puntos;
  // reingresa ahora (período 2, abierto, esta semana). Una semana DURANTE el período 1 no debe
  // volver a mostrar a C, aunque hoy vuelva a ser miembro activo.
  const oldPeriodMon = new Date('2026-02-02T00:00:00'); // un lunes durante el período 1
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('C', 'c', [period('2026-01-05T00:00:00.000Z', '2026-03-01T00:00:00.000Z'), period(iso(23, 15))]),
  ] };
  const oldMatch = match('old', '2026-02-03T20:00:00.000Z', ['A_', 'C_'], ['B_', 'D_'], 'A');
  oldMatch.players[0].userId = 'a'; oldMatch.players[1].userId = 'c'; oldMatch.players[2].userId = 'b'; oldMatch.players[3].userId = 'd';
  const newMatch = match('new', iso(21, 20), ['A_', 'B_'], ['C_', 'D_'], 'A');
  newMatch.players[0].userId = 'a'; newMatch.players[1].userId = 'b'; newMatch.players[2].userId = 'c'; newMatch.players[3].userId = 'd';

  // Semana del período 1 (vieja): el partido SIGUE contando para el grupo (B4), pero C no
  // aparece como fila — solo su período ABIERTO actual decide en qué semanas se lo muestra.
  assert.equal(PG.doesMatchCountForGroup(oldMatch, group), true);
  const oldWeekTable = PG.computeWeeklyTable([oldMatch], group, PH.startOfWeekMonday(oldPeriodMon));
  assert.ok(!oldWeekTable.some((r) => r.userId === 'c'), 'la semana de la etapa eliminada NO revive la fila de C');
  // Semana actual (etapa nueva, reingreso): C SÍ aparece normalmente.
  const currentTable = PG.computeWeeklyTable([newMatch], group, THIS_MON);
  assert.ok(currentTable.some((r) => r.userId === 'c'), 'la etapa nueva (reingreso) sí muestra a C');
});

/* ------------------------------------------------------------------ */
/* Retest real (handoff 72) — actividad VISIBLE real, nunca el top 3    */
/* ------------------------------------------------------------------ */

/** Caso real del retest de Staging (handoff 72): 10 partidos calificables de C esta semana — 6
 *  ganados (2 con Victoria clara = 6 pts, 4 lisos = 5 pts) y 4 perdidos (0 pts). Top 3 = los 2
 *  claras + 1 lisa = 6+6+5 = 17, exactamente el ejemplo del handoff ("10 partidos · 6 V · 4 D ·
 *  17 pts"). `levelsSource:'official'` sin `levelBefore` desactiva Sorpresa de forma
 *  determinística (nunca None por azar del estimador simulado) — no es el objeto de este test. */
function buildTenMatchScenario() {
  const group = { id: 'g', members: [member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]), member('C', 'c', [period(LONG_AGO)])] };
  const history = [];
  const winMargins = [[6, 1], [6, 1], [6, 4], [6, 4], [6, 4], [6, 4]]; // 2 claras (6pts) + 4 lisas (5pts)
  winMargins.forEach(([ga, gb], i) => {
    const setPair = [{ gamesA: ga, gamesB: gb }, { gamesA: ga, gamesB: gb }];
    const m = match(`win${i}`, iso(21 + i, 10), ['A_', 'C_'], ['B_', 'D_'], 'A', setPair);
    m.levelsSource = 'official';
    m.players[0].userId = 'a'; m.players[1].userId = 'c'; m.players[2].userId = 'b'; m.players[3].userId = 'd';
    history.push(m);
  });
  // 4 derrotas de C (equipo B+C pierde) — nunca aportan puntos, pero SÍ deben contar como jugados.
  for (let i = 0; i < 4; i++) {
    const m = match(`loss${i}`, iso(27, 10 + i), ['A_', 'D_'], ['B_', 'C_'], 'A');
    m.levelsSource = 'official';
    m.players[0].userId = 'a'; m.players[1].userId = 'd'; m.players[2].userId = 'b'; m.players[3].userId = 'c';
    history.push(m);
  }
  return { group, history };
}

test('retest 72: 10 partidos · 6 V · 4 D en la actividad visible, sin alterar que solo los 3 mejores aporten a los puntos', () => {
  const { group, history } = buildTenMatchScenario();
  const table = PG.computeWeeklyTable(history, group, THIS_MON);
  const c = table.find((r) => r.userId === 'c');
  assert.ok(c, 'C tiene fila');
  // Actividad REAL: los 10 partidos calificables de la semana, con su V/D real — nunca el top 3.
  assert.equal(c.matchesPlayed, 10, 'actividad visible = TODO lo jugado, no el top 3');
  assert.equal(c.wins, 6);
  assert.equal(c.losses, 4);
  // Puntos: exactamente el ejemplo del handoff — 3 partidos aportaron, 17 puntos.
  assert.equal(c.pointsMatchesCounted, 3, 'los puntos siguen saliendo de exactamente 3 partidos');
  assert.equal(c.points, 17, '10 partidos · 6 V · 4 D · 17 pts (2 claras + 1 lisa, nunca las 6 victorias completas)');
});

test('retest 72: la Race anual acumula la MISMA distinción (puntos = top-3 semanal; actividad = real)', () => {
  const { group, history } = buildTenMatchScenario();
  const race = PG.computeRaceAnual(history, group, 2026);
  const c = race.find((r) => r.userId === 'c');
  assert.ok(c);
  assert.equal(c.matchesPlayed, 10);
  assert.equal(c.wins, 6);
  assert.equal(c.losses, 4);
  assert.equal(c.pointsMatchesCounted, 3);
  assert.equal(c.points, 17);
});

test('retest 72: la fila de la tabla de Grupos (app.js) usa la actividad REAL, nunca pointsMatchesCounted', () => {
  const appJsSrc = read('app.js');
  const body = appJsSrc.slice(appJsSrc.indexOf('function buildGroupTableRowHTML'), appJsSrc.indexOf('function buildGroupTableRowHTML') + 900);
  assert.match(body, /row\.matchesPlayed/);
  assert.doesNotMatch(body, /row\.matchesCounted|row\.pointsMatchesCounted/);
});

/* ------------------------------------------------------------------ */
/* C1-C4 — ajustes UX chicos detectados en QA (guardas estáticas)       */
/* ------------------------------------------------------------------ */

const appJs = read('app.js');
const indexHtml = read('index.html');
const stylesCss = read('styles.css');

test('C1: error contextual de nombre al crear grupo (campo/borde/mensaje junto al campo, nunca el error inferior)', () => {
  assert.match(indexHtml, /id="create-group-name-hint"/, 'hint contextual en el markup');
  assert.match(appJs, /function setCreateGroupNameFieldError/);
  assert.match(appJs, /field--invalid/);
  // Las dos rutas (server y legacy) ya NO escriben "Ingresá un nombre" en el #create-group-error
  // genérico — deben usar el helper contextual.
  assert.doesNotMatch(appJs, /create-group-error'\)\.textContent = 'Ingresá un nombre para el grupo\./);
  assert.match(appJs, /setCreateGroupNameFieldError\('Ingresá un nombre para el grupo\.'\)/g);
  // "Elegí al menos un jugador" (selección de jugadores) sigue en el error genérico de siempre —
  // fuera del alcance de C1, no debe tocarse.
  assert.match(appJs, /Elegí al menos un jugador\./);
});

test('C2: borde ámbar PLENO en Resumen pendiente (igual al de Home/Último partido)', () => {
  assert.match(stylesCss, /\.result-card\.result-card--pending\{ border-color: var\(--gold\);/);
  assert.doesNotMatch(stylesCss, /\.result-card\.result-card--pending\{ border-color: rgba\(255,201,61,0\.45\)/);
});

const paintB6Block = appJs.slice(appJs.indexOf('function paintB6Actions'), appJs.indexOf('function renderMatchTimelineTable') > -1
  ? appJs.indexOf('function renderMatchTimelineTable') : appJs.indexOf('function paintB6Actions') + 12000);

test('C3: identity_replacement se funde en la misma .result-card--pending, nunca un banner separado', () => {
  assert.match(appJs, /function paintPendingInResultCard\(f, mode, waitingTeam, opts\)/);
  // Las dos ramas (accionable/espera) de identity_replacement llaman a paintPendingInResultCard.
  const idBlock = appJs.slice(appJs.indexOf("pendingEventType === 'identity_replacement'"), appJs.lastIndexOf("pendingEventType === 'identity_replacement'") + 800);
  assert.match(appJs, /paintPendingInResultCard\(f, 'act', null, \{ titleText: contextText \}\)/);
  assert.match(appJs, /paintPendingInResultCard\(f, 'wait', waitingTeam, \{ waitText:/);
});

test('C4: Home no atribuye la carga original como evento accionable actual (copy neutro para accionable)', () => {
  const carousel = appJs.slice(appJs.indexOf('function renderPlayerHomeCarousel'), appJs.indexOf('function renderPlayerHome()'));
  assert.doesNotMatch(carousel, /cargó un partido con vos/, 'ya no atribuye la carga original como el evento actual');
  assert.doesNotMatch(carousel, /loaderName/, 'el cómputo de loaderName (sin uso real) se retiró junto con el copy');
  assert.match(carousel, /text = `Partido con \$\{rivalNames\}\.`;/);
});
