// BRAMUlab — Bloque 8 (Fase E): pruebas locales de intelligence-official.js.
// Ejecutar con: node --test bramulab/intelligence-official.test.mjs
//
// Mismo criterio de arnés que el resto de Bloque 8: módulo IIFE (sin `export`) cargado en un
// `vm.createContext` nuevo. `intelligence-official.js` no depende de ningún otro módulo
// (`global.PL*`), así que el harness acá es el más simple de todo el bloque. Cobertura de los
// puntos 1-10 y 15 (Nivel) de docs/BRAMUlab/Implementacion/Backend/Bloque_08/
// 25_Handoff_Fase_E_Claude.md §12 — los puntos 11-14 (fingerprint/checkpoint/audit) viven en
// intelligence-presentation.test.mjs, donde se integran con el replay real de Fase D.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadModule() {
  const sandbox = {};
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, 'intelligence-official.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'intelligence-official.js' });
  return sandbox;
}

const sandbox = loadModule();
const IO = sandbox.PLIntelligenceOfficial;

const ME = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const RIVAL_1 = '33333333-3333-3333-3333-333333333333';
const RIVAL_2 = '44444444-4444-4444-4444-444444444444';

function match({ matchId = 'match-1', playedAt = '2026-01-01T00:00:00.000Z', winnerTeam = 'A', hasOpenIdentityIssue = false } = {}) {
  return {
    matchId, playedAt, winnerTeam, hasOpenIdentityIssue,
    players: [
      { userId: ME, team: 'A' },
      { userId: PARTNER, team: 'A' },
      { userId: RIVAL_1, team: 'B' },
      { userId: RIVAL_2, team: 'B' },
    ],
  };
}

function playerRow({ playerId, team, confidence = 0.7, state = 'CALIBRADO', deltaCapped = 0.05, deltaRaw = 0.05, muBefore = 5.0, muAfter = 5.05 }) {
  return {
    player_id: playerId, team,
    formula_mu_before: muBefore, formula_confidence_before: confidence, formula_state: state,
    effective_level: muBefore, delta_raw: deltaRaw, delta_capped: deltaCapped, evidence_quality: 1,
    mu_after: muAfter, confidence_after: Math.min(0.95, confidence + 0.02),
  };
}

function fourKnownPlayerRows(confidence = 0.7, state = 'CALIBRADO') {
  return [
    playerRow({ playerId: ME, team: 'A', confidence, state }),
    playerRow({ playerId: PARTNER, team: 'A', confidence, state }),
    playerRow({ playerId: RIVAL_1, team: 'B', confidence, state }),
    playerRow({ playerId: RIVAL_2, team: 'B', confidence, state }),
  ];
}

function resultRow({ eligible = true, knownLevelsCount = 4, expectationA = 0.30, expectationB = 0.70, effectStatus = 'applied', matchId = 'match-1', resultId = 'result-1' } = {}) {
  return {
    result_id: resultId, match_id: matchId, algorithm_version: 'nivel_bramu_v1_0', eligible,
    reason_codes: [], known_levels_count: knownLevelsCount,
    team_strength_a: 5.0, team_strength_b: 5.4, expectation_a: expectationA, expectation_b: expectationB,
    rival_pair_confidence_avg_a: 0.8, rival_pair_confidence_avg_b: 0.8, margin: 0.5, effect_status: effectStatus,
  };
}

test('los módulos se cargan y PLIntelligenceOfficial expone su API pública', () => {
  assert.ok(IO && typeof IO.buildLevelSnapshot === 'function');
  assert.ok(typeof IO.buildLevelClaims === 'function');
  assert.ok(typeof IO.fingerprintFieldsOf === 'function');
  assert.ok(typeof IO.isCallerCalibratingIn === 'function');
});

/* ------------------------------------------------------------------ */
/* 1: sin resultado oficial aplicado -> 0 claims H                       */
/* ------------------------------------------------------------------ */

test('1: sin fila applied (snapshot null) -> 0 claims H', () => {
  const snapshot = IO.buildLevelSnapshot(null, []);
  assert.equal(snapshot, null);
  const claims = IO.buildLevelClaims(snapshot, match(), ME);
  assert.equal(claims.length, 0);
});

/* ------------------------------------------------------------------ */
/* 2: resultado no elegible -> no afirmar impacto de Nivel               */
/* ------------------------------------------------------------------ */

test('2: eligible=false -> 0 claims H (nunca afirma impacto de Nivel)', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ eligible: false }), fourKnownPlayerRows());
  const claims = IO.buildLevelClaims(snapshot, match(), ME);
  assert.equal(claims.length, 0);
});

/* ------------------------------------------------------------------ */
/* 3: victoria <=35%, 4 niveles, conf>=0.60 -> sorpresa confiable        */
/* ------------------------------------------------------------------ */

test('3: victoria con expectativa propia <=35%, 4 niveles conocidos y confianza >=0.60 -> nivel_por_encima_expectativa', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.30, expectationB: 0.70 }), fourKnownPlayerRows(0.65));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_por_encima_expectativa');
  assert.ok(claim, 'se esperaba nivel_por_encima_expectativa');
  assert.equal(claim.discarded, false);
  assert.equal(claim.officialScope, 'oficial');
  assert.equal(claim.claim.expectationOwn, 0.30);
});

test('3b: la misma victoria pero PERDIENDO (equipo B gana) nunca produce nivel_por_encima_expectativa para el caller', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.30, expectationB: 0.70 }), fourKnownPlayerRows(0.65));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'B' }), ME);
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
  assert.equal(claims.find((c) => c.insightType === 'nivel_pareja_por_debajo'), undefined);
});

/* ------------------------------------------------------------------ */
/* 4: 36-44% -> pareja por debajo, sin lenguaje de sorpresa extrema      */
/* ------------------------------------------------------------------ */

test('4: victoria con expectativa propia entre 36% y 44% -> nivel_pareja_por_debajo', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.40, expectationB: 0.60 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_pareja_por_debajo');
  assert.ok(claim);
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
});

/* ------------------------------------------------------------------ */
/* 5: 45-55% -> no claim de dificultad por sí solo                       */
/* ------------------------------------------------------------------ */

test('5: expectativa equilibrada (45%-55%) nunca genera un claim afirmado de dificultad, queda descartado y auditable', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.50, expectationB: 0.50 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
  assert.equal(claims.find((c) => c.insightType === 'nivel_pareja_por_debajo'), undefined);
  const discarded = claims.find((c) => c.insightType === 'nivel_pareja_equilibrada');
  assert.ok(discarded);
  assert.equal(discarded.discarded, true);
  assert.ok(discarded.discardReasonCodes.indexOf('expectativa_equilibrada_sin_insight') !== -1);
});

/* ------------------------------------------------------------------ */
/* 6: >=65% -> solo explica delta pequeño, nunca festejo                 */
/* ------------------------------------------------------------------ */

test('6: expectativa de victoria >=65% -> nivel_resultado_esperable (nunca por_encima_expectativa/pareja_por_debajo)', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.70, expectationB: 0.30 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_resultado_esperable');
  assert.ok(claim);
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
  assert.equal(claims.find((c) => c.insightType === 'nivel_pareja_por_debajo'), undefined);
});

/* ------------------------------------------------------------------ */
/* 7: 3 niveles -> lenguaje limitado                                     */
/* ------------------------------------------------------------------ */

test('7: 3 niveles conocidos + expectativa por debajo -> nivel_tres_niveles_pareja_por_debajo (nunca la variante de 4 conocidos)', () => {
  const rows = fourKnownPlayerRows(0.70).slice(0, 3); // solo 3 de los 4 identificados
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 3, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_tres_niveles_pareja_por_debajo');
  assert.ok(claim);
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
});

/* ------------------------------------------------------------------ */
/* 8: 2 niveles / calibrando -> no clasifica dificultad                  */
/* ------------------------------------------------------------------ */

test('8a: solo 2 niveles conocidos -> nivel_evidencia_limitada, nunca clasifica dificultad', () => {
  const rows = fourKnownPlayerRows(0.70).slice(0, 2);
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 2, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  assert.ok(claims.find((c) => c.insightType === 'nivel_evidencia_limitada'));
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
  assert.equal(claims.find((c) => c.insightType === 'nivel_tres_niveles_pareja_por_debajo'), undefined);
});

test('8b: 4 niveles conocidos pero uno todavía CALIBRANDO -> nivel_evidencia_limitada, nunca sorpresa confiable', () => {
  const rows = fourKnownPlayerRows(0.70);
  rows[1] = playerRow({ playerId: PARTNER, team: 'A', confidence: 0.62, state: 'CALIBRANDO' });
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 4, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  assert.ok(claims.find((c) => c.insightType === 'nivel_evidencia_limitada'));
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
});

test('8c: confianza por debajo de 0.60 en alguno de los cuatro -> nivel_evidencia_limitada, no sorpresa confiable', () => {
  const rows = fourKnownPlayerRows(0.70);
  rows[2] = playerRow({ playerId: RIVAL_1, team: 'B', confidence: 0.40, state: 'CALIBRADO' });
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 4, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  assert.ok(claims.find((c) => c.insightType === 'nivel_evidencia_limitada'));
  assert.equal(claims.find((c) => c.insightType === 'nivel_por_encima_expectativa'), undefined);
});

/* ------------------------------------------------------------------ */
/* E03 (Revisión Central Fase E) — nivel_evidencia_limitada nunca puede   */
/* decir "TU Nivel sigue calibrando" si la limitación viene de otro       */
/* participante con el caller ya CALIBRADO                                */
/* ------------------------------------------------------------------ */

test('E03.1: caller ya CALIBRADO + un tercero (pareja) todavía CALIBRANDO -> callerCalibrating=false (nunca se le atribuye al caller)', () => {
  const rows = fourKnownPlayerRows(0.70, 'CALIBRADO');
  rows[1] = playerRow({ playerId: PARTNER, team: 'A', confidence: 0.62, state: 'CALIBRANDO' }); // el TERCERO calibrando, no el caller
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 4, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_evidencia_limitada');
  assert.ok(claim);
  assert.equal(claim.claim.callerCalibrating, false);
  assert.equal(claim.claim.anyCalibrating, true); // sigue siendo cierto que ALGUIEN calibra, solo que no es el caller
});

test('E03.2: el caller MISMO todavía CALIBRANDO -> callerCalibrating=true (acá sí corresponde el mensaje de calibración propia)', () => {
  const rows = fourKnownPlayerRows(0.70, 'CALIBRADO');
  rows[0] = playerRow({ playerId: ME, team: 'A', confidence: 0.55, state: 'CALIBRANDO' }); // el CALLER calibrando
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 4, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_evidencia_limitada');
  assert.ok(claim);
  assert.equal(claim.claim.callerCalibrating, true);
});

test('E03.3: baja confianza de un rival (nunca CALIBRANDO formalmente) con caller CALIBRADO -> sigue siendo callerCalibrating=false', () => {
  const rows = fourKnownPlayerRows(0.70, 'CALIBRADO');
  rows[3] = playerRow({ playerId: RIVAL_2, team: 'B', confidence: 0.35, state: 'CALIBRADO' }); // confianza baja, pero YA "CALIBRADO"
  const snapshot = IO.buildLevelSnapshot(resultRow({ knownLevelsCount: 4, expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_evidencia_limitada');
  assert.ok(claim);
  assert.equal(claim.claim.callerCalibrating, false);
});

/* ------------------------------------------------------------------ */
/* 9: delta exacto sale del snapshot oficial, no de Nivel live           */
/* ------------------------------------------------------------------ */

test('9: nivel_variacion usa exactamente delta_capped/mu_after del snapshot oficial del caller', () => {
  const rows = fourKnownPlayerRows(0.70);
  rows[0] = playerRow({ playerId: ME, team: 'A', confidence: 0.70, deltaCapped: 0.0734, deltaRaw: 0.0734, muBefore: 5.1, muAfter: 5.1734 });
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.30, expectationB: 0.70 }), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_variacion');
  assert.ok(claim);
  assert.equal(claim.claim.deltaCapped, 0.0734);
  assert.equal(claim.claim.muAfter, 5.1734);
});

test('9b: sin fila propia del caller en match_level_result_players (guest/no identificado) -> nunca nivel_variacion', () => {
  const rows = fourKnownPlayerRows(0.70).filter((p) => p.player_id !== ME);
  const snapshot = IO.buildLevelSnapshot(resultRow(), rows);
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  assert.equal(claims.find((c) => c.insightType === 'nivel_variacion'), undefined);
});

/* ------------------------------------------------------------------ */
/* E05 (Revisión Central Fase E) — nivel_variacion se enriquece con      */
/* wasExpectedResult/expectationOwn para poder explicar el contexto      */
/* esperable sin inventar un umbral nuevo de "delta chico"               */
/* ------------------------------------------------------------------ */

test('E05.1: victoria con expectativa >=65% -> nivel_variacion trae wasExpectedResult=true y expectationOwn (MISMA condición que nivel_resultado_esperable, ningún umbral nuevo)', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.70, expectationB: 0.30 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const variacion = claims.find((c) => c.insightType === 'nivel_variacion');
  const esperable = claims.find((c) => c.insightType === 'nivel_resultado_esperable');
  assert.ok(variacion);
  assert.ok(esperable, 'nivel_resultado_esperable sigue generándose para auditoría, aunque nunca gane la selección');
  assert.equal(variacion.claim.wasExpectedResult, true);
  assert.equal(variacion.claim.expectationOwn, 0.70);
});

test('E05.2: victoria con expectativa <65% -> nivel_variacion trae wasExpectedResult=false y expectationOwn=null (nunca dos historias H contando el contexto esperable a la vez)', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.50, expectationB: 0.50 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const variacion = claims.find((c) => c.insightType === 'nivel_variacion');
  assert.ok(variacion);
  assert.equal(variacion.claim.wasExpectedResult, false);
  assert.equal(variacion.claim.expectationOwn, null);
  assert.equal(claims.find((c) => c.insightType === 'nivel_resultado_esperable'), undefined);
});

/* ------------------------------------------------------------------ */
/* 10: resultado revertido/supersedido no alimenta claim                 */
/* ------------------------------------------------------------------ */

test('10: una fila con effect_status="reverted" nunca debe llegar a buildLevelClaims (el llamador la filtra; defensa en profundidad acá)', () => {
  // buildLevelSnapshot no decide la condición `applied` (eso es del llamador server-side), pero
  // si por error llegara una fila reverted, el snapshot igual se construye tal cual — la
  // garantía real vive en que el llamador SOLO llama a esta función con filas `applied` (ver
  // Edge Function). Se documenta y verifica el campo para que quede auditable si algo falla.
  const snapshot = IO.buildLevelSnapshot(resultRow({ effectStatus: 'reverted' }), fourKnownPlayerRows(0.70));
  assert.equal(snapshot.effectStatus, 'reverted');
});

test('10b (H01, defensa en profundidad): un partido con identidad todavía abierta nunca produce Familia H', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.30, expectationB: 0.70 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A', hasOpenIdentityIssue: true }), ME);
  assert.equal(claims.length, 0);
});

/* ------------------------------------------------------------------ */
/* 15: templates H no exponen porcentajes en principal (verificado en   */
/* intelligence-presentation.test.mjs) — acá se prueba que el CLAIM en  */
/* sí guarda el porcentaje solo como dato estructurado, nunca en texto  */
/* (este módulo nunca redacta, eso es Fase D).                          */
/* ------------------------------------------------------------------ */

test('15: el claim guarda expectationOwn como dato estructurado — este módulo nunca redacta texto, eso es responsabilidad exclusiva de Fase D', () => {
  const snapshot = IO.buildLevelSnapshot(resultRow({ expectationA: 0.30, expectationB: 0.70 }), fourKnownPlayerRows(0.70));
  const claims = IO.buildLevelClaims(snapshot, match({ winnerTeam: 'A' }), ME);
  const claim = claims.find((c) => c.insightType === 'nivel_por_encima_expectativa');
  assert.equal(typeof claim.claim.expectationOwn, 'number');
  assert.equal(Object.prototype.hasOwnProperty.call(claim, 'title'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(claim, 'body'), false);
});

/* ------------------------------------------------------------------ */
/* Calibración del caller — usado por el mensaje de aprendizaje de D    */
/* ------------------------------------------------------------------ */

test('isCallerCalibratingIn: true cuando la fila del propio caller tiene formula_state=CALIBRANDO', () => {
  const rows = fourKnownPlayerRows(0.50, 'CALIBRANDO');
  const snapshot = IO.buildLevelSnapshot(resultRow(), rows);
  assert.equal(IO.isCallerCalibratingIn(snapshot, ME), true);
});

test('isCallerCalibratingIn: false sin snapshot, y false cuando el caller ya está CALIBRADO', () => {
  assert.equal(IO.isCallerCalibratingIn(null, ME), false);
  const snapshot = IO.buildLevelSnapshot(resultRow(), fourKnownPlayerRows(0.70, 'CALIBRADO'));
  assert.equal(IO.isCallerCalibratingIn(snapshot, ME), false);
});

/* ------------------------------------------------------------------ */
/* Fingerprint fields — nunca el estado en vivo, siempre el snapshot    */
/* ------------------------------------------------------------------ */

test('fingerprintFieldsOf: sin snapshot devuelve {hasOfficialSnapshot:false} explícito, nunca lo omite', () => {
  const fields = IO.fingerprintFieldsOf(null);
  // Comparación por JSON en vez de assert.deepEqual: el objeto viene del sandbox `vm`, y
  // deepEqual contra un literal del realm principal falla por prototipos distintos aunque el
  // contenido sea idéntico (mismo criterio ya documentado en otros tests de Bloque 8).
  assert.equal(JSON.stringify(fields), JSON.stringify({ hasOfficialSnapshot: false }));
  assert.equal(Object.keys(fields).length, 1);
});

test('fingerprintFieldsOf: con snapshot, cambiar el resultado oficial (nueva fila applied) cambia el fingerprint resultante', () => {
  const snapshot1 = IO.buildLevelSnapshot(resultRow({ resultId: 'result-1', expectationA: 0.30, expectationB: 0.70 }), fourKnownPlayerRows(0.70));
  const snapshot2 = IO.buildLevelSnapshot(resultRow({ resultId: 'result-2', expectationA: 0.45, expectationB: 0.55 }), fourKnownPlayerRows(0.70));
  const f1 = JSON.stringify(IO.fingerprintFieldsOf(snapshot1));
  const f2 = JSON.stringify(IO.fingerprintFieldsOf(snapshot2));
  assert.notEqual(f1, f2);
});
