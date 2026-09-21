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
//
// Cobertura agregada tras 06_Revision_Fase_A_ChatGPT.md §4 (B6-A-04/05 — movimiento real vs.
// deltaCapped en los bordes 1.0/10.0, inactividad 59/60/>60 días, corrección sobre estado con
// decay).

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
/* computeEffectiveConfidence / buildPlayerStatesDict — inactividad B6-A-05 */
/* ------------------------------------------------------------------ */

test('computeEffectiveConfidence: 59 días de inactividad no cambia nada', () => {
  const lastRated = '2026-01-01T00:00:00.000Z';
  const reference = new Date(new Date(lastRated).getTime() + 59 * 86400000).toISOString();
  const eff = MLE.computeEffectiveConfidence(0.80, lastRated, reference);
  assert.equal(eff, 0.80);
});

test('computeEffectiveConfidence: exactamente 60 días todavía no decae (límite inclusive de la fórmula)', () => {
  const lastRated = '2026-01-01T00:00:00.000Z';
  const reference = new Date(new Date(lastRated).getTime() + 60 * 86400000).toISOString();
  const eff = MLE.computeEffectiveConfidence(0.80, lastRated, reference);
  assert.equal(eff, 0.80);
});

test('computeEffectiveConfidence: más de 60 días de inactividad reduce la confianza efectiva sin tocar mu', () => {
  const lastRated = '2026-01-01T00:00:00.000Z';
  const reference = new Date(new Date(lastRated).getTime() + 300 * 86400000).toISOString(); // 300 días
  const eff = MLE.computeEffectiveConfidence(0.80, lastRated, reference);
  assert.ok(eff < 0.80, `esperaba decay, obtuve ${eff}`);
  assert.ok(eff >= 0.15, 'nunca por debajo del piso 0.15');
});

test('computeEffectiveConfidence: sin lastRatedAt (jugador recién oficializado) no decae', () => {
  const eff = MLE.computeEffectiveConfidence(0.15, null, '2026-06-01T00:00:00.000Z');
  assert.equal(eff, 0.15);
});

test('buildPlayerStatesDict: aplica inactividad por jugador usando referenceIso (playedAt del partido)', () => {
  const referenceIso = '2026-06-01T00:00:00.000Z'; // ~151 días después de lastRatedAt
  const dict = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.5, confidence: 0.6, status: 'CALIBRADO', lastRatedAt: '2026-01-01T00:00:00.000Z' },
    { playerId: 'p2', mu: 5.0, confidence: 0.6, status: 'CALIBRADO', lastRatedAt: null },
  ], referenceIso);
  assert.ok(dict.p1.confidence < 0.6, 'p1 estuvo inactivo, su confianza debe decaer');
  assert.equal(dict.p2.confidence, 0.6, 'p2 sin lastRatedAt no decae');
  assert.equal(dict.p1.mu, 5.5, 'mu nunca decae');
});

test('buildPlayerStatesDict: excluye PENDIENTE (mu/confidence null) y filas sin playerId', () => {
  const dict = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.5, confidence: 0.6, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p2', mu: null, confidence: null, status: 'PENDIENTE', lastRatedAt: null },
    { playerId: null, mu: 5.0, confidence: 0.5, status: 'CALIBRANDO', lastRatedAt: null },
  ], '2026-01-02T00:00:00.000Z');
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
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p4', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], '2026-01-01T00:00:00.000Z');
}

function liveStates(overrides) {
  const base = {
    p1: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0 },
    p2: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0 },
    p3: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0 },
    p4: { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0 },
  };
  return Object.assign(base, overrides || {});
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
  assert.ok(Math.abs(players.p1.deltaCapped - players.p2.deltaCapped) < 1e-9);
  assert.ok(Math.abs(players.p3.deltaCapped - players.p4.deltaCapped) < 1e-9);
  assert.ok(Math.abs(players.p1.deltaCapped + players.p3.deltaCapped) < 1e-9);
  assert.equal(result.context.knownLevelsCount, 4);
  assert.equal(typeof result.context.repetitionFactorA, 'number');
  assert.equal(typeof result.context.companionFactorA, 'number');
});

test('computeOfficializationResult: 2 conocidos en la MISMA pareja -> no elegible (no inventa disponibilidad)', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], '2026-01-01T00:00:00.000Z');
  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates,
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('dos_conocidos_en_la_misma_pareja'));
});

test('computeOfficializationResult: 3 conocidos + 1 invitado imputado -> computa, el invitado nunca recibe delta', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], '2026-01-01T00:00:00.000Z');
  const result = MLE.computeOfficializationResult({
    localMatch,
    history: [],
    playerStates,
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
  assert.equal(result.eligible, true);
  assert.ok(result.guestPlayerIds.length === 1, 'debe haber exactamente un invitado imputado');
  assert.ok(!['p1', 'p2', 'p3'].includes(result.guestPlayerIds[0]));
});

test('computeOfficializationResult: un slot no identificado (playerId null) se trata como invitado, con referencia única', () => {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  row.participants[3].playerId = null;
  row.participants[3].displayName = 'Por identificar';
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  assert.equal(localMatch.players[3].name, 'Por identificar', 'sin sanear todavía, antes de pasar por el motor');

  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], '2026-01-01T00:00:00.000Z');
  const result = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates, validatedAtIso: '2026-01-02T00:00:00.000Z',
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
  assert.equal(sanitizedA.players[0].name, 'A1');
});

/* ------------------------------------------------------------------ */
/* computeLevelStateUpdates — diferencia neta con movimiento real (B6-A-04) */
/* y confianza incremental (B6-A-05), Nivel_BRAMU_Formula_V1.5.md §12.3     */
/* ------------------------------------------------------------------ */

function firstOfficialization() {
  const row = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  return MLE.computeOfficializationResult({
    localMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });
}

test('computeLevelStateUpdates: primera oficialización (sin resultado previo) aplica el delta completo sobre el estado live', () => {
  const officialization = firstOfficialization();
  const live = liveStates();
  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult: null,
    engineOutput: officialization.engineOutput,
    guestPlayerIds: officialization.guestPlayerIds,
    currentLevelStatesByPlayerId: live,
  });

  assert.equal(resultPlayers.length, 4);
  assert.equal(levelStateUpdates.length, 4);
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  const p1Result = resultPlayers.find((r) => r.playerId === 'p1');
  const p1Delta = officialization.engineOutput.players.p1.deltaCapped;
  assert.ok(Math.abs((p1Update.finalMu - live.p1.mu) - p1Delta) < 1e-9);
  // Los valores LIVE before/after de la fila de auditoría son los realmente aplicados, no la
  // referencia de fórmula.
  assert.ok(Math.abs(p1Result.muBefore - live.p1.mu) < 1e-9);
  assert.ok(Math.abs(p1Result.muAfter - p1Update.finalMu) < 1e-9);
  assert.equal(typeof p1Result.formulaMuBefore, 'number');
  assert.equal(p1Result.formulaState, 'CALIBRADO', 'formulaState debe quedar en formato level_states (CALIBRADO), no en formato interno del motor');
});

test('computeLevelStateUpdates: revertir usa el MOVIMIENTO REAL (after-before), nunca deltaCapped, cerca del clamp superior 10.0 (B6-A-04)', () => {
  // Simula un resultado previo cuyo deltaCapped nominal era +0.20 pero el clamp de escala lo
  // recortó a +0.05 real (mu 9.95 -> 10.00).
  const oldAppliedResult = {
    players: [
      {
        playerId: 'p1', team: 'A',
        muBefore: 9.95, muAfter: 10.00, // movimiento real = +0.05, NO +0.20
        confidenceBefore: 0.60, confidenceAfter: 0.6244,
        evidenceUnitsBefore: 3.0, evidenceUnitsAfter: 3.4,
      },
    ],
  };
  // engineOutput null => esta corrección retira por completo el efecto (ej. anulación / partido
  // ya no elegible), solo debe revertir.
  const live = { p1: { mu: 10.00, confidence: 0.6244, evidenceUnits: 3.4 } };
  const { levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult, engineOutput: null, guestPlayerIds: [], currentLevelStatesByPlayerId: live,
  });
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  // Revertir el movimiento REAL (+0.05) desde 10.00 da 9.95 — si se usara deltaCapped (+0.20) a
  // mano hubiera dado 9.80, un resultado incorrecto.
  assert.ok(Math.abs(p1Update.finalMu - 9.95) < 1e-9, `esperaba 9.95, obtuve ${p1Update.finalMu}`);
});

test('computeLevelStateUpdates: revertir cerca del clamp inferior 1.0 también usa movimiento real', () => {
  const oldAppliedResult = {
    players: [
      {
        playerId: 'p3', team: 'B',
        muBefore: 1.05, muAfter: 1.00, // movimiento real = -0.05, no -0.20
        confidenceBefore: 0.60, confidenceAfter: 0.6244,
        evidenceUnitsBefore: 3.0, evidenceUnitsAfter: 3.4,
      },
    ],
  };
  const live = { p3: { mu: 1.00, confidence: 0.6244, evidenceUnits: 3.4 } };
  const { levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult, engineOutput: null, guestPlayerIds: [], currentLevelStatesByPlayerId: live,
  });
  const p3Update = levelStateUpdates.find((u) => u.playerId === 'p3');
  assert.ok(Math.abs(p3Update.finalMu - 1.05) < 1e-9, `esperaba 1.05, obtuve ${p3Update.finalMu}`);
});

test('computeLevelStateUpdates: revertir restaura confidence EXACTAMENTE (movimiento real, no aproximado) — B6-A-03', () => {
  const oldAppliedResult = {
    players: [
      {
        playerId: 'p1', team: 'A',
        muBefore: 5.0, muAfter: 5.08,
        confidenceBefore: 0.60, confidenceAfter: 0.6244,
        evidenceUnitsBefore: 3.0, evidenceUnitsAfter: 3.4,
      },
    ],
  };
  const live = { p1: { mu: 5.08, confidence: 0.6244, evidenceUnits: 3.4 } };
  const { levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult, engineOutput: null, guestPlayerIds: [], currentLevelStatesByPlayerId: live,
  });
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  assert.ok(Math.abs(p1Update.finalConfidence - 0.60) < 1e-9, `esperaba 0.60, obtuve ${p1Update.finalConfidence}`);
  assert.ok(Math.abs(p1Update.finalEvidenceUnits - 3.0) < 1e-9);
});

test('computeLevelStateUpdates: corrección de resultado (mismos 4 jugadores) revierte+reaplica con confianza incremental real (B6-B-01)', () => {
  const first = firstOfficialization();
  const oldAppliedResult = {
    // B6-B-01: el "before" LIVE de la primera aplicación es EXACTAMENTE la referencia de fórmula
    // que el motor usó (p.confidenceBefore/p.muBefore) — sin decay de por medio (evenPlayerStates
    // no tiene lastRatedAt), el valor LIVE antes de la primera vez que se computa un partido
    // siempre coincide con lo que alimentó la fórmula.
    players: Object.keys(first.engineOutput.players)
      .filter((id) => !first.guestPlayerIds.includes(id))
      .map((id) => {
        const p = first.engineOutput.players[id];
        const evidenceUnits = liveStates()[id].evidenceUnits;
        return {
          playerId: id, team: p.team,
          muBefore: p.muBefore, muAfter: p.muAfter,
          confidenceBefore: p.confidenceBefore, confidenceAfter: p.confidenceAfter,
          evidenceUnitsBefore: evidenceUnits, evidenceUnitsAfter: evidenceUnits + p.evidenceQuality,
        };
      }),
  };
  // Estado live ya refleja la primera oficialización.
  const liveAfterFirst = {};
  oldAppliedResult.players.forEach((p) => {
    liveAfterFirst[p.playerId] = { mu: p.muAfter, confidence: p.confidenceAfter, evidenceUnits: p.evidenceUnitsAfter };
  });

  // Corrección: resultado más amplio (6-2, 6-2 en vez de 6-4, 6-4). Misma referencia de fórmula
  // (evenPlayerStates) que la primera vez — "mismos snapshots previos" (Nivel_BRAMU_Formula_V1.5.md §12.3).
  const correctedRow = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 2, gamesA2: 6, gamesB2: 2 });
  const correctedMatch = MatchSync.translateServerMatchToLocalShape(correctedRow);
  const corrected = MLE.computeOfficializationResult({
    localMatch: correctedMatch, history: [], playerStates: evenPlayerStates(), validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult,
    engineOutput: corrected.engineOutput,
    guestPlayerIds: corrected.guestPlayerIds,
    currentLevelStatesByPlayerId: liveAfterFirst,
  });

  assert.equal(resultPlayers.length, 4);
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  const p1Old = oldAppliedResult.players.find((p) => p.playerId === 'p1');
  const p1New = corrected.engineOutput.players.p1;
  // mu: revertir movimiento real, aplicar delta nuevo, clamp.
  const expectedMuAfterRevert = Level.clampLevel(liveAfterFirst.p1.mu - (p1Old.muAfter - p1Old.muBefore));
  const expectedFinalMu = Level.clampLevel(expectedMuAfterRevert + p1New.deltaCapped);
  assert.ok(Math.abs(p1Update.finalMu - expectedFinalMu) < 1e-9);
  // B6-B-01: confidence NUNCA se rebasa sobre el valor live revertido — es EXACTAMENTE lo que el
  // motor calculó desde su propia referencia de fórmula congelada (p1New.confidenceAfter).
  assert.ok(Math.abs(p1Update.finalConfidence - p1New.confidenceAfter) < 1e-9);
  const p1Result = resultPlayers.find((r) => r.playerId === 'p1');
  // El "before" LIVE persistido para la PRÓXIMA reversión es el valor revertido (0.9, sin decay
  // en este escenario) — nunca la base de fórmula reaplicada dos veces.
  const expectedConfidenceAfterRevert = liveAfterFirst.p1.confidence - (p1Old.confidenceAfter - p1Old.confidenceBefore);
  assert.ok(Math.abs(p1Result.confidenceBefore - expectedConfidenceAfterRevert) < 1e-9);
  assert.ok(p1New.deltaCapped >= p1Old.muAfter - p1Old.muBefore, 'resultado más amplio -> delta nuevo mayor o igual');
});

test('computeLevelStateUpdates: identidad reemplazada -> el jugador retirado revierte puro (movimiento real), el nuevo aplica puro', () => {
  const first = firstOfficialization();
  const oldAppliedResult = {
    players: Object.keys(first.engineOutput.players)
      .filter((id) => !first.guestPlayerIds.includes(id))
      .map((id) => {
        const p = first.engineOutput.players[id];
        const live = liveStates()[id];
        return {
          playerId: id, team: p.team,
          muBefore: live.mu, muAfter: Level.clampLevel(live.mu + p.deltaCapped),
          confidenceBefore: live.confidence, confidenceAfter: Level.computeConfidenceAfterMatch(live.confidence, p.evidenceQuality),
          evidenceUnitsBefore: live.evidenceUnits, evidenceUnitsAfter: live.evidenceUnits + p.evidenceQuality,
        };
      }),
  };
  const liveAfterFirst = {};
  oldAppliedResult.players.forEach((p) => {
    liveAfterFirst[p.playerId] = { mu: p.muAfter, confidence: p.confidenceAfter, evidenceUnits: p.evidenceUnitsAfter };
  });
  liveAfterFirst.p5 = { mu: 5.0, confidence: 0.60, evidenceUnits: 3.0 };

  // p4 sale, p5 entra en su lugar.
  const swappedRow = buildRow({ playedAt: '2026-01-01T00:00:00.000Z', gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  swappedRow.participants[3].playerId = 'p5';
  swappedRow.participants[3].displayName = 'B2-nuevo';
  const swappedMatch = MatchSync.translateServerMatchToLocalShape(swappedRow);
  const swapped = MLE.computeOfficializationResult({
    localMatch: swappedMatch, history: [],
    playerStates: MLE.buildPlayerStatesDict([
      { playerId: 'p1', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
      { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
      { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
      { playerId: 'p5', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    ], '2026-01-01T00:00:00.000Z'),
    validatedAtIso: '2026-01-02T00:00:00.000Z',
  });

  const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
    oldAppliedResult,
    engineOutput: swapped.engineOutput,
    guestPlayerIds: swapped.guestPlayerIds,
    currentLevelStatesByPlayerId: liveAfterFirst,
  });

  assert.ok(!resultPlayers.some((r) => r.playerId === 'p4'));
  const p4Update = levelStateUpdates.find((u) => u.playerId === 'p4');
  const p4Old = oldAppliedResult.players.find((p) => p.playerId === 'p4');
  assert.ok(p4Update, 'p4 debe recibir un ajuste de reversión aunque ya no participe del resultado nuevo');
  const expectedP4Mu = Level.clampLevel(liveAfterFirst.p4.mu - (p4Old.muAfter - p4Old.muBefore));
  assert.ok(Math.abs(p4Update.finalMu - expectedP4Mu) < 1e-9);

  const p5Update = levelStateUpdates.find((u) => u.playerId === 'p5');
  const p5Result = resultPlayers.find((r) => r.playerId === 'p5');
  assert.ok(Math.abs((p5Update.finalMu - liveAfterFirst.p5.mu) - p5Result.deltaCapped) < 1e-9);
});

test('computeLevelStateUpdates: un jugador con decay por inactividad usa confianza efectiva como base del próximo partido, sin recuperar de golpe (B6-A-05)', () => {
  const inactiveReferenceIso = '2026-08-01T00:00:00.000Z'; // ~212 días desde lastRatedAt
  const rawConfidence = 0.80;
  const effectiveConfidence = MLE.computeEffectiveConfidence(rawConfidence, '2026-01-01T00:00:00.000Z', inactiveReferenceIso);
  assert.ok(effectiveConfidence < rawConfidence);

  const row = buildRow({ playedAt: inactiveReferenceIso, gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: rawConfidence, status: 'CALIBRADO', lastRatedAt: '2026-01-01T00:00:00.000Z' },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p4', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], inactiveReferenceIso);
  assert.ok(Math.abs(playerStates.p1.confidence - effectiveConfidence) < 1e-9);

  const officialization = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates, validatedAtIso: inactiveReferenceIso,
  });
  assert.equal(officialization.eligible, true);

  const live = {
    p1: { mu: 5.0, confidence: rawConfidence, evidenceUnits: 5.0, lastRatedAt: '2026-01-01T00:00:00.000Z' },
    p2: liveStates().p2, p3: liveStates().p3, p4: liveStates().p4,
  };
  const { levelStateUpdates, resultPlayers } = MLE.computeLevelStateUpdates({
    oldAppliedResult: null, engineOutput: officialization.engineOutput, guestPlayerIds: officialization.guestPlayerIds,
    currentLevelStatesByPlayerId: live,
  });
  const p1Update = levelStateUpdates.find((u) => u.playerId === 'p1');
  // La confianza posterior nunca "recupera de golpe" el valor previo a la inactividad: sale de
  // la base EFECTIVA (decayeada), no de la cruda almacenada (0.80).
  const expectedFinal = Level.computeConfidenceAfterMatch(rawConfidence, officialization.engineOutput.players.p1.evidenceQuality);
  assert.ok(p1Update.finalConfidence < expectedFinal, 'no debe recuperar de golpe la confianza previa a la inactividad');
  // B6-B-01: el "before" LIVE persistido para la próxima reversión es la confianza CRUDA
  // original (0.80, antes de decay) — nunca la base decayeada que alimentó la fórmula. Esto es
  // lo que permite que revertir restaure exactamente la confianza previa (ver el test dedicado
  // más abajo).
  const p1Result = resultPlayers.find((r) => r.playerId === 'p1');
  assert.ok(Math.abs(p1Result.confidenceBefore - rawConfidence) < 1e-9);
});

test('computeLevelStateUpdates: partido tras >60d de inactividad -> aplicar -> revertir -> confidence CRUDA original restaurada exactamente, decay se aplica una sola vez (B6-B-01)', () => {
  const originalLastRatedAt = '2026-01-01T00:00:00.000Z';
  const matchPlayedAt = '2026-08-01T00:00:00.000Z'; // ~212 días después, muy por encima de los 60 de gracia
  const rawConfidence = 0.80;

  const row = buildRow({ playedAt: matchPlayedAt, gamesA1: 6, gamesB1: 4, gamesA2: 6, gamesB2: 4 });
  const localMatch = MatchSync.translateServerMatchToLocalShape(row);
  const playerStates = MLE.buildPlayerStatesDict([
    { playerId: 'p1', mu: 5.0, confidence: rawConfidence, status: 'CALIBRADO', lastRatedAt: originalLastRatedAt },
    { playerId: 'p2', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p3', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
    { playerId: 'p4', mu: 5.0, confidence: 0.9, status: 'CALIBRADO', lastRatedAt: null },
  ], matchPlayedAt);

  const officialization = MLE.computeOfficializationResult({
    localMatch, history: [], playerStates, validatedAtIso: matchPlayedAt,
  });
  assert.equal(officialization.eligible, true);

  // 1) Aplicar: p1 sale de un estado LIVE con confianza cruda 0.80 (todavía no persistida con
  // decay — buildPlayerStatesDict solo ajustó la copia que alimentó al motor).
  const liveBeforeApply = {
    p1: { mu: 5.0, confidence: rawConfidence, evidenceUnits: 5.0, lastRatedAt: originalLastRatedAt },
    p2: liveStates().p2, p3: liveStates().p3, p4: liveStates().p4,
  };
  const applied = MLE.computeLevelStateUpdates({
    oldAppliedResult: null, engineOutput: officialization.engineOutput, guestPlayerIds: officialization.guestPlayerIds,
    currentLevelStatesByPlayerId: liveBeforeApply,
  });
  const p1AppliedResult = applied.resultPlayers.find((r) => r.playerId === 'p1');
  const p1AppliedUpdate = applied.levelStateUpdates.find((u) => u.playerId === 'p1');
  assert.ok(Math.abs(p1AppliedResult.confidenceBefore - rawConfidence) < 1e-9);

  // 2) Simula que level_states quedó con el resultado de la aplicación (lo que escribiría
  // officialize_match_validation).
  const liveAfterApply = {
    p1: { mu: p1AppliedUpdate.finalMu, confidence: p1AppliedUpdate.finalConfidence, evidenceUnits: p1AppliedUpdate.finalEvidenceUnits },
  };

  // 3) Revertir puro (equivalente a _bloque6_revert_applied_result): debe restaurar la confianza
  // CRUDA original (0.80), nunca la base decayeada que se usó para calcular el delta.
  const reverted = MLE.computeLevelStateUpdates({
    oldAppliedResult: { players: [p1AppliedResult] },
    engineOutput: null, guestPlayerIds: [],
    currentLevelStatesByPlayerId: liveAfterApply,
  });
  const p1RevertedUpdate = reverted.levelStateUpdates.find((u) => u.playerId === 'p1');
  assert.ok(Math.abs(p1RevertedUpdate.finalConfidence - rawConfidence) < 1e-9,
    `esperaba la confianza cruda original ${rawConfidence}, obtuve ${p1RevertedUpdate.finalConfidence}`);

  // 4) El siguiente partido, calculado desde la confianza cruda restaurada + el mismo
  // lastRatedAt original, aplica el decay EXACTAMENTE UNA VEZ — nunca sobre una base que ya
  // estaba decayeada (lo que habría pasado si confidenceBefore hubiera persistido la base
  // decayeada en vez de la cruda).
  const nextMatchPlayedAt = '2026-09-01T00:00:00.000Z';
  const decayOnRestored = MLE.computeEffectiveConfidence(p1RevertedUpdate.finalConfidence, originalLastRatedAt, nextMatchPlayedAt);
  const decayFromScratch = MLE.computeEffectiveConfidence(rawConfidence, originalLastRatedAt, nextMatchPlayedAt);
  assert.ok(Math.abs(decayOnRestored - decayFromScratch) < 1e-9);
});
