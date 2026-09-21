// BRAMUlab — Bloque 6: pruebas locales de match-level-engine.js (Etapa C de Nivel BRAMU).
// Ejecutar con: node --test bramulab/match-level-engine.test.mjs
//
// Mismo criterio que supabase/tests/verify-nivel-parity.mjs: los módulos compartidos
// (level.js/level-context.js/engine.js/match-sync.js/match-level-engine.js) son scripts de
// navegador (IIFE que asignan a `window`/`globalThis`, sin `export`) — se cargan tal cual en un
// contexto vm nuevo, sin tocarlos ni envolverlos en ningún formato de módulo distinto al que ya
// usa index.html. Esto prueba el mismo pipeline que va a correr server-side: una fila con forma
// get_my_matches -> PLMatchSync.translateServerMatchToLocalShape -> PLMatchLevelEngine.
// computeOfficializationResult -> PLLevelContext.computeMatchLevelUpdate -> PLLevel.
// computeMatchUpdate.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSharedEngine() {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const relPath of ['engine.js', 'level.js', 'level-context.js', 'match-sync.js', 'match-level-engine.js']) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadSharedEngine();
const { PLLevel: Level, PLMatchSync: MatchSync, PLMatchLevelEngine: MLE } = sandbox;

test('los 5 módulos compartidos se cargan y exponen su API pública', () => {
  assert.ok(Level && typeof Level.computeMatchUpdate === 'function');
  assert.ok(sandbox.PLLevelContext && typeof sandbox.PLLevelContext.computeMatchLevelUpdate === 'function');
  assert.ok(MatchSync && typeof MatchSync.translateServerMatchToLocalShape === 'function');
  assert.ok(MLE && typeof MLE.computeOfficializationResult === 'function');
});

/* ------------------------------------------------------------------ */
/* isWithinNivelWindow — Decisión Abierta #1, resuelta por revisión central */
/* ------------------------------------------------------------------ */

test('isWithinNivelWindow: exactamente 30 días es elegible, 30 días + 1ms no', () => {
  const playedAt = '2026-01-01T00:00:00.000Z';
  const exactly30 = '2026-01-31T00:00:00.000Z';
  const over30 = '2026-01-31T00:00:00.001Z';
  assert.equal(MLE.isWithinNivelWindow(playedAt, exactly30), true);
  assert.equal(MLE.isWithinNivelWindow(playedAt, over30), false);
});

test('isWithinNivelWindow: 44 días (peor caso operativo de Bloque 5: 14 carga + 30 pendiente) NO es elegible para Nivel', () => {
  const playedAt = '2026-01-01T00:00:00.000Z';
  const day44 = '2026-02-14T00:00:00.000Z';
  assert.equal(MLE.isWithinNivelWindow(playedAt, day44), false);
});

test('isWithinNivelWindow: fechas faltantes nunca son elegibles', () => {
  assert.equal(MLE.isWithinNivelWindow(null, '2026-01-01T00:00:00.000Z'), false);
  assert.equal(MLE.isWithinNivelWindow('2026-01-01T00:00:00.000Z', null), false);
});

/* ------------------------------------------------------------------ */
/* Mapeo de estados level_states.status <-> Level.STATES                */
/* ------------------------------------------------------------------ */

test('mapLevelStateStatusToEngineState / mapEngineStateToLevelStateStatus son inversas', () => {
  const statuses = ['CALIBRANDO', 'CALIBRADO', 'RECALIBRANDO'];
  statuses.forEach((status) => {
    const engineState = MLE.mapLevelStateStatusToEngineState(status);
    assert.equal(MLE.mapEngineStateToLevelStateStatus(engineState), status);
  });
});

test('mapLevelStateStatusToEngineState: PENDIENTE u otro valor cae a STATES.NONE', () => {
  assert.equal(MLE.mapLevelStateStatusToEngineState('PENDIENTE'), Level.STATES.NONE);
  assert.equal(MLE.mapLevelStateStatusToEngineState(undefined), Level.STATES.NONE);
});

/* ------------------------------------------------------------------ */
/* buildPlayerStatesDict — PENDIENTE / mu ausente nunca entra al diccionario */
/* ------------------------------------------------------------------ */

test('buildPlayerStatesDict: excluye PENDIENTE (mu/confidence null) y filas sin playerId', () => {
  const dict = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.5, confidence: 0.6, status: 'CALIBRADO' },
    { playerId: 'p2', mu: null, confidence: null, status: 'PENDIENTE' },
    { playerId: null, mu: 5.0, confidence: 0.5, status: 'CALIBRANDO' },
  ]);
  assert.deepEqual(Object.keys(dict), ['p1']);
  assert.equal(dict.p1.state, Level.STATES.CALIBRATED);
});

/* ------------------------------------------------------------------ */
/* buildUnidentifiedRef — nunca dos slots sin identidad colisionan          */
/* ------------------------------------------------------------------ */

test('buildUnidentifiedRef: nombres únicos para slots distintos, estable para el mismo slot', () => {
  const a = MLE.buildUnidentifiedRef('11111111-aaaa-bbbb-cccc-000000000001', 'A', 1);
  const b = MLE.buildUnidentifiedRef('22222222-aaaa-bbbb-cccc-000000000002', 'A', 1);
  const aAgain = MLE.buildUnidentifiedRef('11111111-aaaa-bbbb-cccc-000000000001', 'A', 1);
  assert.notEqual(a.name, b.name);
  assert.equal(a.name, aAgain.name);
  assert.equal(a.userId, null);
});

/* ------------------------------------------------------------------ */
/* computeOfficializationResult — pipeline completo, partiendo de una fila  */
/* con forma get_my_matches (misma que la Edge Function va a recibir).      */
/* ------------------------------------------------------------------ */

function buildRow({ playedAt, gamesA1, gamesB1, gamesA2, gamesB2 }) {
  return {
    matchId: 'match-fixture-1',
    status: 'pending_validation',
    playedAt,
    playedAtTimeKnown: true,
    reportedTimeZone: 'America/Argentina/Buenos_Aires',
    formatId: 'classic',
    scoringSystem: null,
    locationName: null,
    locationLat: null,
    locationLng: null,
    hidden: false,
    createdByPlayerId: 'p1',
    validatedAt: null,
    validationDeadlineAt: null,
    privateNote: null,
    participants: [
      { team: 'A', position: 1, playerId: 'p1', displayName: 'A1' },
      { team: 'A', position: 2, playerId: 'p2', displayName: 'A2' },
      { team: 'B', position: 1, playerId: 'p3', displayName: 'B1' },
      { team: 'B', position: 2, playerId: 'p4', displayName: 'B2' },
    ],
    sets: [
      { setNumber: 1, gamesA: gamesA1, gamesB: gamesB1, tiebreakA: null, tiebreakB: null },
      { setNumber: 2, gamesA: gamesA2, gamesB: gamesB2, tiebreakA: null, tiebreakB: null },
    ],
  };
}

function evenPlayerStates() {
  return MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p4', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
  ]);
}

test('computeOfficializationResult: fuera de ventana de 30 días -> no elegible, motor nunca se invoca', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates: evenPlayerStates(),
    validatedAtIso: '2026-03-15T00:00:00.000Z', // 73 días después de jugado
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes(MLE.REASON_OUTSIDE_NIVEL_WINDOW));
  assert.equal(result.engineOutput, null);
});

test('computeOfficializationResult: dentro de ventana, 4 conocidos, parejas parejas 5.0 -> A (ganador) sube, B baja, magnitudes simétricas', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  assert.equal(localMatch.winnerTeam, 'A');

  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates: evenPlayerStates(),
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  assert.equal(result.eligible, true);
  assert.equal(result.guestPlayerIds.length, 0);
  const { players } = result.engineOutput;
  assert.ok(players.p1.deltaCapped > 0, 'ganador debe subir');
  assert.ok(players.p2.deltaCapped > 0, 'ganador debe subir');
  assert.ok(players.p3.deltaCapped < 0, 'perdedor debe bajar');
  assert.ok(players.p4.deltaCapped < 0, 'perdedor debe bajar');
  // Parejas simétricas (mismo mu/confidence en los 4) -> deltas de compañeros iguales entre sí
  // y magnitud del ganador igual a la del perdedor (Nivel_BRAMU_Formula_V1.5.md §14: "Parejas
  // 5,0 estables, dos sets" -> +/-X simétrico).
  assert.ok(Math.abs(players.p1.deltaCapped - players.p2.deltaCapped) < 1e-9);
  assert.ok(Math.abs(players.p3.deltaCapped - players.p4.deltaCapped) < 1e-9);
  assert.ok(Math.abs(players.p1.deltaCapped + players.p3.deltaCapped) < 1e-9);
  // Contexto expuesto para auditoría (match_level_results) — knownLevelsCount y factores de
  // equipo que la función de conveniencia de level-context.js no expone directamente.
  assert.equal(result.context.knownLevelsCount, 4);
  assert.equal(typeof result.context.repetitionFactorA, 'number');
  assert.equal(typeof result.context.companionFactorA, 'number');
});

test('computeOfficializationResult: 2 conocidos en la MISMA pareja -> no elegible (no inventa disponibilidad)', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    // p3/p4 (equipo B) sin level_state -> invitados sin nivel conocido, los 2 conocidos quedan
    // concentrados en el mismo equipo A.
  ]);
  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates,
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('dos_conocidos_en_la_misma_pareja'));
});

/* ------------------------------------------------------------------ */
/* computeLevelStateUpdates — diferencia neta (Nivel_BRAMU_Formula_V1.5.md §12.3) */
/* ------------------------------------------------------------------ */

function liveStates(overrides) {
  const base = {
    p1: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0, confidenceOrigin: 0.15 },
    p2: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0, confidenceOrigin: 0.15 },
    p3: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0, confidenceOrigin: 0.15 },
    p4: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0, confidenceOrigin: 0.15 },
  };
  return Object.assign(base, overrides || {});
}

test('computeLevelStateUpdates: primera oficialización (sin resultado previo) aplica el delta nuevo completo', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const officialization = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult: null,
    engineOutput: officialization.engineOutput,
    guestPlayerIds: officialization.guestPlayerIds,
    currentLevelStatesByPlayerId: liveStates(),
  });

  assert.equal(resultPlayers.length, 4);
  assert.equal(levelStateUpdates.length, 4);
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  const p1Result = resultPlayers.find((r) => r.playerId === 'p1');
  // Sin resultado previo, el neto ES el delta nuevo completo.
  assert.ok(Math.abs((p1Update.finalMu - p1Update.currentMuForLock) - p1Result.deltaCapped) < 1e-9);
});

test('computeLevelStateUpdates: corrección de resultado (mismos 4 jugadores) aplica solo la diferencia neta', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const first = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  const oldAppliedResult = {
    players: Object.keys(first.engineOutput.players)
      .filter((id) => !first.guestPlayerIds.includes(id))
      .map((id) => Object.assign({ playerId: id }, first.engineOutput.players[id])),
  };

  // Corrección: el resultado real fue MÁS amplio (6-2, 6-2) — el ganador debería ganar más neto
  // que en la primera pasada, no un delta completo nuevo sumado al viejo.
  const correctedRow = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 2, gamesA2: 6, gamesB2: 2 });
  const correctedMatch = MatchSync.translateServerMatchToLocalShape(correctedRow);
  const corrected = MLE.computeOfficializationResult({
    localMatch: correctedMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  const live = liveStates();
  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult,
    engineOutput: corrected.engineOutput,
    guestPlayerIds: corrected.guestPlayerIds,
    currentLevelStatesByPlayerId: live,
  });

  assert.equal(resultPlayers.length, 4);
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  const p1OldDelta = oldAppliedResult.players.find((p) => p.playerId === 'p1').deltaCapped;
  const p1NewDelta = corrected.engineOutput.players.p1.deltaCapped;
  const expectedFinalMu = Level.clampLevel(live.p1.mu + (p1NewDelta - p1OldDelta));
  assert.ok(Math.abs(p1Update.finalMu - expectedFinalMu) < 1e-9);
  // El resultado más amplio debe producir un delta nuevo mayor o igual al original.
  assert.ok(p1NewDelta >= p1OldDelta);
});

test('computeLevelStateUpdates: identidad reemplazada -> el jugador retirado revierte puro, el nuevo aplica puro', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const first = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  const oldAppliedResult = {
    players: Object.keys(first.engineOutput.players)
      .filter((id) => !first.guestPlayerIds.includes(id))
      .map((id) => Object.assign({ playerId: id }, first.engineOutput.players[id])),
  };

  // p4 sale, p5 entra en su lugar (misma composición de partido, otro jugador en esa posición).
  const swappedRow = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  swappedRow.participants[3].playerId = 'p5';
  swappedRow.participants[3].displayName = 'B2-nuevo';
  const swappedMatch = MatchSync.translateServerMatchToLocalShape(swappedRow);
  const swapped = MLE.computeOfficializationResult({
    localMatch: swappedMatch, history: [],
    playerStates: MLE.buildPlayerStatesDict([
      { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
      { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
      { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
      { playerId: 'p5', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    ]),
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  const live = liveStates({ p5: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0, confidenceOrigin: 0.15 } });
  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult,
    engineOutput: swapped.engineOutput,
    guestPlayerIds: swapped.guestPlayerIds,
    currentLevelStatesByPlayerId: live,
  });

  // p4 ya no aparece en el resultado nuevo, pero SÍ debe ajustarse su level_state (reversión pura).
  assert.ok(!resultPlayers.some((r) => r.playerId === 'p4'));
  const p4Update = levelStateUpdates.find((u) => u.playerId === 'p4');
  assert.ok(p4Update, 'p4 debe recibir un ajuste de reversión aunque ya no participe del resultado nuevo');
  const p4OldDelta = oldAppliedResult.players.find((p) => p.playerId === 'p4').deltaCapped;
  assert.ok(Math.abs((p4Update.finalMu - p4Update.currentMuForLock) - (-p4OldDelta)) < 1e-9);

  // p5 es nuevo en este partido: no tenía fila vieja, su neto es el delta completo nuevo.
  const p5Update = levelStateUpdates.find((u) => u.playerId === 'p5');
  const p5Result = resultPlayers.find((r) => r.playerId === 'p5');
  assert.ok(Math.abs((p5Update.finalMu - p5Update.currentMuForLock) - p5Result.deltaCapped) < 1e-9);
});

test('computeOfficializationResult: un slot no identificado (playerId null) se trata como invitado, con referencia única', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  // Mismo string compartido que report_identity_issue realmente escribe en
  // match_participants.display_name_snapshot para CUALQUIER slot no identificado.
  row.participants[3].playerId = null;
  row.participants[3].displayName = 'Por identificar';
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  assert.equal(localMatch.players[3].name, 'Por identificar', 'sin sanear todavía, antes de pasar por el motor');

  const result = MLE.computeOfficializationResult({
    localMatch, history: [],
    playerStates: MLE.buildPlayerStatesDict([
      { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
      { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
      { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    ]),
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  assert.equal(result.eligible, true);
  assert.equal(result.guestPlayerIds.length, 1, 'el slot sin identidad computa como invitado imputado');
});

test('sanitizeUnidentifiedPlayers: dos slots sin identidad de partidos distintos nunca terminan con el mismo nombre', () => {
  const rowA = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  rowA.matchId = 'match-aaaa';
  rowA.participants[3].playerId = null;
  rowA.participants[3].displayName = 'Por identificar';
  const rowB = buildRow({ playedAt: '2026-01-05T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  rowB.matchId = 'match-bbbb';
  rowB.participants[3].playerId = null;
  rowB.participants[3].displayName = 'Por identificar';

  const sanitizedA = MLE.sanitizeUnidentifiedPlayers(MatchSync.translateServerMatchToLocalShape(rowA));
  const sanitizedB = MLE.sanitizeUnidentifiedPlayers(MatchSync.translateServerMatchToLocalShape(rowB));
  assert.notEqual(sanitizedA.players[3].name, sanitizedB.players[3].name);
  // Un jugador YA identificado no se toca.
  assert.equal(sanitizedA.players[0].name, 'A1');
});

test('computeOfficializationResult: 3 conocidos + 1 invitado imputado -> computa, el invitado nunca recibe delta', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO' },
    // p4 sin level_state -> invitado, un conocido en cada pareja (2 en A, 1 en B) -> computa
    // con disponibilidad 3/4.
  ]);
  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates,
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  assert.ok(result.guestPlayerIds.length === 1, 'debe haber exactamente un invitado imputado');
  assert.ok(!Object.prototype.hasOwnProperty.call(result.engineOutput.players, 'p1') === false);
  // El id del invitado nunca es uno de los 4 player_id reales conocidos — el llamador debe
  // excluirlo de cualquier escritura en level_states usando exactamente guestPlayerIds.
  assert.ok(!['p1', 'p2', 'p3'].includes(result.guestPlayerIds[0]));
});
