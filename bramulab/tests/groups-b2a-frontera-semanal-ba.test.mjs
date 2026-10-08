// BRAMUlab — Grupos BRAMU B2a: microfix de frontera semanal canónica (handoff 77, 28/09/2026).
// Ejecutar con: node --test bramulab/tests/groups-b2a-frontera-semanal-ba.test.mjs
//
// Decisión de producto cerrada (Grupos_BRAMU.md "Zona horaria canónica V1"): Grupos BRAMU V1
// usa SIEMPRE America/Argentina/Buenos_Aires (lunes 00:00 -> domingo 23:59:59.999 de Buenos
// Aires) para toda frontera semanal, nunca el huso del dispositivo. Este archivo prueba
// `PLGroups.weekStartBA` (el helper JS) contra los MISMOS instantes que el verify SQL del
// backend (`supabase/tests/verify-preprod-grupos-b2a-backend-lobby.sql`, sección "T-borde")
// afirma para `_groups_week_start_ba` — ambos deben coincidir siempre (no se pueden ejecutar
// uno contra el otro en el mismo proceso, así que la evidencia de paridad es que los DOS
// archivos, escritos de forma independiente, declaran el mismo resultado esperado para el mismo
// instante).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
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

/* ------------------------------------------------------------------ */
/* weekStartBA — mismos instantes que el verify SQL "T-borde"           */
/* Lunes 00:00 de Buenos Aires de la semana que empieza el 2026-09-21   */
/* es EXACTAMENTE 2026-09-21T03:00:00.000Z (BA = UTC-3 fijo).           */
/* ------------------------------------------------------------------ */

test('weekStartBA: domingo 23:59 UTC (20:59 BA) -> lunes de la semana ANTERIOR', () => {
  assert.equal(PG.weekStartBA('2026-09-20T23:59:00.000Z').toISOString(), '2026-09-14T03:00:00.000Z');
});

test('weekStartBA: caso trampa — lunes 02:59 UTC ya es "lunes" en UTC pero SIGUE siendo domingo 23:59 en BA', () => {
  // Esta es la razón de ser del fix: un cálculo naive por fecha-calendario UTC diría "lunes",
  // pero la frontera real (Buenos Aires) todavía no cruzó la medianoche.
  assert.equal(PG.weekStartBA('2026-09-21T02:59:00.000Z').toISOString(), '2026-09-14T03:00:00.000Z');
});

test('weekStartBA: lunes 03:00:00.000 UTC = lunes 00:00 BA EXACTO -> el propio instante', () => {
  assert.equal(PG.weekStartBA('2026-09-21T03:00:00.000Z').toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(PG.weekStartBA('2026-09-21T03:00:00.001Z').toISOString(), '2026-09-21T03:00:00.000Z');
});

test('weekStartBA: domingo de la MISMA semana BA -> el lunes con el que empezó (nunca el siguiente)', () => {
  assert.equal(PG.weekStartBA('2026-09-27T23:59:00.000Z').toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(PG.weekStartBA('2026-09-28T02:59:59.999Z').toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(PG.weekStartBA('2026-09-28T03:00:00.000Z').toISOString(), '2026-09-28T03:00:00.000Z');
});

test('weekStartBA: null para fecha inválida (nunca lanza)', () => {
  assert.equal(PG.weekStartBA('no-es-una-fecha'), null);
});

/* ------------------------------------------------------------------ */
/* Bordes de calificación 3/4 con el piso semanal BA exacto             */
/* (mismo mecanismo que _groups_candidate_matches_exact del backend,    */
/* ejercitado acá vía doesMatchCountForGroup/groups.js).                */
/* ------------------------------------------------------------------ */

function member(name, userId, periods) { return { name, userId, isAdmin: false, periods }; }
function period(joinedAt, leftAt) { return { joinedAt, leftAt: leftAt || null }; }
function match(id, playedAt, teamA, teamB, winnerTeam) {
  return {
    matchId: id, playedAt, winnerTeam, regulationCompleted: true,
    sets: [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }],
    players: [
      { id: 0, team: 'A', userId: teamA[0], name: teamA[0] },
      { id: 1, team: 'A', userId: teamA[1], name: teamA[1] },
      { id: 2, team: 'B', userId: teamB[0], name: teamB[0] },
      { id: 3, team: 'B', userId: teamB[1], name: teamB[1] },
    ],
  };
}
const LONG_AGO = '2026-01-05T00:00:00.000Z';

test('borde: alta LUNES BA + partido del DOMINGO anterior -> NO califica', () => {
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('F', 'f', [period('2026-09-21T15:00:00.000Z')]), // lunes 15:00 UTC
  ] };
  const m = match('m', '2026-09-20T20:00:00.000Z', ['A', 'B'], ['F', 'D'], 'A'); // domingo anterior
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'f'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), false, 'F no cuenta: el domingo es de la semana BA anterior a su alta');
});

test('borde: alta LUNES BA + partido del MISMO lunes, antes de la hora exacta del alta -> SÍ puede calificar', () => {
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('F', 'f', [period('2026-09-21T15:00:00.000Z')]), // lunes 15:00 UTC
  ] };
  const m = match('m', '2026-09-21T05:00:00.000Z', ['A', 'B'], ['F', 'D'], 'A'); // lunes 05:00 UTC, ANTES de las 15:00
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'f'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), true, 'F cuenta: el piso es el lunes 00:00 BA, no la hora exacta del alta');
});

test('borde: alta DOMINGO BA + partido del LUNES de esa misma semana -> SÍ puede calificar', () => {
  const group = { id: 'g', members: [
    member('A', 'a', [period(LONG_AGO)]), member('B', 'b', [period(LONG_AGO)]),
    member('F', 'f', [period('2026-09-27T20:00:00.000Z')]), // domingo 17:00 BA, misma semana que el lunes 21/9
  ] };
  const m = match('m', '2026-09-21T05:00:00.000Z', ['A', 'B'], ['F', 'D'], 'A'); // lunes de esa misma semana
  m.players[0].userId = 'a'; m.players[1].userId = 'b'; m.players[2].userId = 'f'; m.players[3].userId = 'd';
  assert.equal(PG.doesMatchCountForGroup(m, group), true, 'domingo y el lunes que lo precede son la MISMA semana BA');
});

/* ------------------------------------------------------------------ */
/* Consistencia: Semana actual/pasada de Grupos usa weekStartBA, nunca   */
/* PH.startOfWeekMonday (device-local) — guarda estática sobre app.js.  */
/* ------------------------------------------------------------------ */

test('app.js: renderActiveGroupPanels usa PG.weekStartBA, nunca PH.startOfWeekMonday, para Semana actual/pasada', () => {
  const appJs = read('app.js');
  const body = appJs.slice(appJs.indexOf('function renderActiveGroupPanels'), appJs.indexOf('function initGroupsScreen'));
  assert.match(body, /const weekStart = PG\.weekStartBA\(now\);/);
  const codeOnly = body.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codeOnly, /PH\.startOfWeekMonday/);
});

test('groups.js: computeRaceAnual (vía computeGroupYearWeekStarts, B2b) agrupa por weekStartBA, nunca PH.startOfWeekMonday', () => {
  const groupsJs = read('groups.js');
  // B2b (handoff 79) extrajo la enumeración de semanas a computeGroupYearWeekStarts (reusada
  // también por buildRaceWeeklySummary) — el cálculo real vive ahí, no en computeRaceAnual.
  const body = groupsJs.slice(groupsJs.indexOf('function computeGroupYearWeekStarts'), groupsJs.indexOf('function computeGroupYearWeekStarts') + 1200);
  assert.match(body, /matchesInYear\.map\(\(m\) => weekStartBA\(PH\.getPlayedAt\(m\)\)\.getTime\(\)\)/);
  // El único "PH.startOfWeekMonday" permitido en la función es el que nombra en su propio
  // comentario explicativo por qué NO se usa acá — nunca en código ejecutable.
  const codeOnly = body.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codeOnly, /PH\.startOfWeekMonday/);
  // computeRaceAnual en sí ya no enumera semanas por su cuenta: delega en el helper de arriba.
  const raceBody = groupsJs.slice(groupsJs.indexOf('function computeRaceAnual'), groupsJs.indexOf('function computeRaceAnual') + 300);
  assert.match(raceBody, /computeGroupYearWeekStarts\(fullHistory, group, year\)/);
});
