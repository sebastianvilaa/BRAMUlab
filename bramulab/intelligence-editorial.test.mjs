// BRAMUlab — Bloque 8 (Fase C): pruebas locales de intelligence-editorial.js.
// Ejecutar con: node --test bramulab/intelligence-editorial.test.mjs
//
// Mismo criterio de arnés que intelligence-claims.test.mjs: módulos compartidos (IIFE sin
// `export`) cargados en un `vm.createContext` nuevo. Fixtures en la forma REAL snake_case de
// get_player_intelligence_history (corrección C01 de Fase A).
//
// Cobertura: las 16 pruebas mínimas de
// docs/BRAMUlab/Implementacion/Backend/Bloque_08/10_Handoff_Fase_C_Claude.md §9, más una prueba
// de carga de módulo y de desglose de puntaje.

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
  for (const relPath of [
    'engine.js', 'level.js', 'level-context.js', 'match-sync.js',
    'intelligence-context.js', 'intelligence-claims.js', 'intelligence-editorial.js',
  ]) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadSharedEngine();
const IC = sandbox.PLIntelligenceContext;
const CL = sandbox.PLIntelligenceClaims;
const ED = sandbox.PLIntelligenceEditorial;

const ME = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const PARTNER_2 = '77777777-7777-7777-7777-777777777777';
const RIVAL_1 = '33333333-3333-3333-3333-333333333333';
const RIVAL_2 = '44444444-4444-4444-4444-444444444444';

let seq = 0;
function matchId() {
  seq += 1;
  return `match-${String(seq).padStart(4, '0')}`;
}

/** Fila con la forma REAL snake_case de get_player_intelligence_history. */
function row({
  playedAt, team1 = PARTNER, rivalA = RIVAL_1, rivalB = RIVAL_2, sets,
  status = 'validated', officialEligible = true, hidden = false, hasOpenIdentityIssue = false,
  ownTeam = 'A',
} = {}) {
  const participants = ownTeam === 'A'
    ? [
        { team: 'A', position: 1, playerId: ME, displayName: 'Yo' },
        { team: 'A', position: 2, playerId: team1, displayName: 'Compañero' },
        { team: 'B', position: 1, playerId: rivalA, displayName: 'Rival 1' },
        { team: 'B', position: 2, playerId: rivalB, displayName: 'Rival 2' },
      ]
    : [
        { team: 'B', position: 1, playerId: ME, displayName: 'Yo' },
        { team: 'B', position: 2, playerId: team1, displayName: 'Compañero' },
        { team: 'A', position: 1, playerId: rivalA, displayName: 'Rival 1' },
        { team: 'A', position: 2, playerId: rivalB, displayName: 'Rival 2' },
      ];
  return {
    match_id: matchId(),
    status,
    played_at: playedAt,
    played_at_time_known: true,
    format_id: 'classic',
    scoring_system: 'standard',
    my_team: ownTeam,
    created_by_player_id: ME,
    validated_at: status === 'validated' ? playedAt : null,
    validation_deadline_at: null,
    hidden,
    official_eligible: officialEligible,
    has_open_identity_issue: hasOpenIdentityIssue,
    participants,
    sets: sets.map((s, i) => ({ setNumber: i + 1, gamesA: s[0], gamesB: s[1], tiebreakA: s[2] ?? null, tiebreakB: s[3] ?? null })),
  };
}

function straightSetsWin(ownTeam) {
  return ownTeam === 'A' ? [[6, 3], [6, 4]] : [[3, 6], [4, 6]];
}
function straightSetsLoss(ownTeam) {
  return straightSetsWin(ownTeam === 'A' ? 'B' : 'A');
}
function dayIso(n) { return new Date(Date.UTC(2026, 0, n)).toISOString(); }

/** N filas ganadas seguidas (mismo compañero/rivales por defecto), en días consecutivos. */
function winSeries(n, opts = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(row({ playedAt: dayIso(1 + i), sets: straightSetsWin('A'), ...opts }));
  return rows;
}

function findEvaluated(decision, insightType) {
  return decision.evaluated.find((e) => e.candidate.insightType === insightType) || null;
}
function selectedInsightTypes(decision) {
  return [decision.principal].concat(decision.secondary).filter(Boolean).map((c) => c.insightType);
}

test('los módulos se cargan y PLIntelligenceEditorial expone su API pública', () => {
  assert.ok(ED && typeof ED.buildEditorialDecision === 'function');
  assert.ok(typeof ED.emptyMemory === 'function');
});

/* ------------------------------------------------------------------ */
/* 1. candidato bajo 55 => no seleccionado                              */
/* ------------------------------------------------------------------ */

test('1. un candidato con puntaje bajo 55 nunca queda seleccionado', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const setsCorridos = findEvaluated(decision, 'sets_corridos');
  assert.ok(setsCorridos);
  assert.ok(setsCorridos.scored.finalScore < 55);
  assert.equal(setsCorridos.status, 'below_threshold');
  assert.equal(selectedInsightTypes(decision).includes('sets_corridos'), false);
});

/* ------------------------------------------------------------------ */
/* 2. candidato fuerte => principal                                     */
/* ------------------------------------------------------------------ */

test('2. un candidato fuerte (debut ganado) se selecciona como principal, determinísticamente', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const decision1 = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const decision2 = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  assert.ok(decision1.principal);
  assert.ok(decision1.principal.scored.finalScore >= 55);
  // Determinístico: la misma historia + memoria vacía siempre elige el mismo principal, nunca
  // varía entre corridas (varios candidatos fuertes compiten en un debut: el propio partido, la
  // primera vez con el compañero y la primera victoria juntos — el punto de esta prueba es que
  // SIEMPRE gana el mismo, nunca cuál en particular).
  assert.equal(decision1.principal.insightType, decision2.principal.insightType);
  assert.equal(decision1.principal.scored.finalScore, decision2.principal.scored.finalScore);
});

/* ------------------------------------------------------------------ */
/* 3/4. máximo 1 principal + 2 secundarios, de familias/historias distintas */
/* ------------------------------------------------------------------ */

test('3/4. máximo 1 principal + 2 secundarios, siempre de familias y semanticKeys distintas', () => {
  const rows = winSeries(10); // récord de racha (B) + hito de victorias (B) + balances D/E ya habituales
  const history = IC.buildPersonalHistory(rows);
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  assert.ok(decision.principal);
  assert.ok(decision.secondary.length <= 2);
  const all = [decision.principal].concat(decision.secondary);
  const families = all.map((c) => c.family);
  assert.equal(new Set(families).size, families.length); // todas distintas
  const keys = all.map((c) => c.semanticKey);
  assert.equal(new Set(keys).size, keys.length); // todas distintas
});

/* ------------------------------------------------------------------ */
/* 5. duplicado semántico penalizado/descartado                         */
/* ------------------------------------------------------------------ */

test('5. duplicado semántico: "primer partido con X" y "compañero nuevo X" nunca aparecen los dos', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), team1: PARTNER, sets: straightSetsWin('A') })]);
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const both = ['companero_primer_partido_juntos', 'contexto_companero_nuevo'];
  const selectedBoth = selectedInsightTypes(decision).filter((t) => both.includes(t));
  assert.ok(selectedBoth.length <= 1);
  // Ambos SÍ fueron evaluados (Fase B los afirma con evidencia) — la deduplicación es de Fase C.
  both.forEach((t) => assert.ok(findEvaluated(decision, t)));
});

test('5b. duplicado semántico: una racha larga y "forma reciente" que dice lo mismo nunca aparecen los dos (handoff §7, ejemplo 1)', () => {
  const history = IC.buildPersonalHistory(winSeries(10)); // racha de 10 cubre por completo la ventana de 5 de forma reciente
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const forma = findEvaluated(decision, 'forma_reciente');
  const record = findEvaluated(decision, 'racha_nuevo_record_personal');
  assert.ok(forma && record);
  // Comparten semanticKey tras la fusión — es la MISMA historia (la racha explica el 100% de la ventana).
  assert.equal(forma.semanticKey, record.semanticKey);
  const both = ['forma_reciente', 'racha_nuevo_record_personal'];
  assert.ok(selectedInsightTypes(decision).filter((t) => both.includes(t)).length <= 1);
});

test('5c. una racha corta (3) que NO cubre toda la ventana de forma reciente (5+) queda como historia distinta', () => {
  // 2 derrotas + 3 victorias: racha de 3 NO cubre los 5 de la ventana (los primeros 2 son derrotas).
  const rows = [1, 2].map((d) => row({ playedAt: dayIso(d), sets: straightSetsLoss('A') }))
    .concat([3, 4, 5].map((d) => row({ playedAt: dayIso(d), sets: straightSetsWin('A') })));
  const history = IC.buildPersonalHistory(rows);
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const forma = findEvaluated(decision, 'forma_reciente');
  const racha = findEvaluated(decision, 'racha_de_victorias');
  assert.ok(forma && racha);
  assert.notEqual(forma.semanticKey, racha.semanticKey);
});

test('C03 (§8.5, ejemplo literal de la fuente): 4 victorias seguidas + "4 de los últimos 5" comparten historia', () => {
  const rows = [row({ playedAt: dayIso(1), sets: straightSetsLoss('A') })]
    .concat([2, 3, 4, 5].map((d) => row({ playedAt: dayIso(d), sets: straightSetsWin('A') })));
  const history = IC.buildPersonalHistory(rows); // ventana de 5: 1 derrota + 4 victorias; racha vigente = 4 victorias
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const forma = findEvaluated(decision, 'forma_reciente');
  const racha = findEvaluated(decision, 'racha_de_victorias');
  assert.ok(forma && racha);
  assert.equal(racha.candidate.claim.length, 4);
  assert.equal(forma.semanticKey, racha.semanticKey);
});

test('C03 (§8.6): 4 derrotas seguidas + "4 de los últimos 5" comparten historia (caso simétrico con derrotas)', () => {
  const rows = [row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]
    .concat([2, 3, 4, 5].map((d) => row({ playedAt: dayIso(d), sets: straightSetsLoss('A') })));
  const history = IC.buildPersonalHistory(rows); // ventana de 5: 1 victoria + 4 derrotas; racha vigente = 4 derrotas
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const forma = findEvaluated(decision, 'forma_reciente');
  const racha = findEvaluated(decision, 'racha_de_derrotas');
  assert.ok(forma && racha);
  assert.equal(racha.candidate.claim.length, 4);
  assert.equal(forma.semanticKey, racha.semanticKey);
});

test('C03 (§8.7): la fusión racha/forma reciente respeta memoria previa — una racha ya mostrada no reaparece disfrazada de forma reciente', () => {
  const rows = [row({ playedAt: dayIso(1), sets: straightSetsLoss('A') })]
    .concat([2, 3, 4, 5].map((d) => row({ playedAt: dayIso(d), sets: straightSetsWin('A') })));
  const history = IC.buildPersonalHistory(rows);

  // La MISMA racha (semanticKey 'racha_vigente') ya fue mostrada hace 1 partido.
  const memoryAlreadyShown = Object.assign({}, ED.emptyMemory(), {
    shownSemanticKeys: { racha_vigente: { lastMatchId: history[history.length - 2].matchId, lastValueSignature: 'length:3' } },
  });
  const decision = ED.buildEditorialDecision(history, ME, memoryAlreadyShown);
  const forma = findEvaluated(decision, 'forma_reciente');
  // Como forma_reciente HEREDA la clave 'racha_vigente' (fusión resuelta ANTES de puntuar), su
  // novedad editorial debe reflejar la memoria de esa clave compartida, NUNCA la de una clave
  // 'forma_reciente' propia y "nunca mostrada".
  assert.equal(forma.semanticKey, 'racha_vigente');
  assert.equal(forma.scored.dimensions.novedadEditorial, 0);
});

/* ------------------------------------------------------------------ */
/* 6. misma familia principal en los últimos 2 partidos => −15         */
/* ------------------------------------------------------------------ */

test('6. penalización −15 cuando la misma familia fue principal en los últimos 2 partidos', () => {
  const history = IC.buildPersonalHistory(winSeries(3)); // racha_de_victorias (familia B) elegible en longitud 3
  const noPenaltyMemory = ED.emptyMemory();
  const withPenaltyMemory = Object.assign({}, ED.emptyMemory(), {
    recentMatches: [{ matchId: 'otro-partido', principalFamily: 'B' }],
  });
  const decisionNoPenalty = ED.buildEditorialDecision(history, ME, noPenaltyMemory);
  const decisionWithPenalty = ED.buildEditorialDecision(history, ME, withPenaltyMemory);
  const rachaNoPenalty = findEvaluated(decisionNoPenalty, 'racha_de_victorias');
  const rachaWithPenalty = findEvaluated(decisionWithPenalty, 'racha_de_victorias');
  assert.equal(rachaNoPenalty.scored.penalties.some((p) => p.code === 'misma_familia_principal_ultimos_2'), false);
  assert.equal(rachaWithPenalty.scored.penalties.some((p) => p.code === 'misma_familia_principal_ultimos_2'), true);
  assert.equal(rachaWithPenalty.scored.finalScore, rachaNoPenalty.scored.finalScore - 15);
});

test('6b (C01, §8.1): la penalización mira los 2 partidos REALES anteriores, incluidas abstenciones en el medio — no los últimos 2 CON principal', () => {
  const history = IC.buildPersonalHistory(winSeries(3));
  // Escenario literal de la revisión: A=principal Familia B, B=abstención, C=abstención, D=(este
  // partido) candidato Familia B — B ya quedó 3 partidos atrás, fuera de la ventana de 2.
  const memoryWithOldPrincipal = Object.assign({}, ED.emptyMemory(), {
    recentMatches: [
      { matchId: 'A', principalFamily: 'B' },
      { matchId: 'B', principalFamily: null },
      { matchId: 'C', principalFamily: null },
    ],
  });
  const decision = ED.buildEditorialDecision(history, ME, memoryWithOldPrincipal);
  const racha = findEvaluated(decision, 'racha_de_victorias');
  assert.equal(racha.scored.penalties.some((p) => p.code === 'misma_familia_principal_ultimos_2'), false);
});

/* ------------------------------------------------------------------ */
/* 7/8. hecho relacional: cooldown de 4 partidos salvo cambio de balance */
/* ------------------------------------------------------------------ */

test('7. hecho relacional sin cambio de balance antes de 4 partidos queda excluido por cooldown', () => {
  const rows = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // companero_balance: 4-0
  const memoryShownSameBalance = Object.assign({}, ED.emptyMemory(), {
    shownSemanticKeys: { [`companero_balance:${PARTNER}`]: { lastMatchId: history[2].matchId, lastValueSignature: '4-0' } },
  });
  const decision = ED.buildEditorialDecision(history, ME, memoryShownSameBalance);
  const companero = findEvaluated(decision, 'companero_balance');
  assert.equal(companero.status, 'excluded_by_cooldown');
  assert.equal(companero.excludedReason, 'mismo_hecho_relacional_sin_cambio');
});

test('8. hecho relacional CON balance cambiado puede reaparecer aunque no pasaron 4 partidos', () => {
  const rows = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // companero_balance actual: 4-0
  const memoryShownDifferentBalance = Object.assign({}, ED.emptyMemory(), {
    shownSemanticKeys: { [`companero_balance:${PARTNER}`]: { lastMatchId: history[2].matchId, lastValueSignature: '3-0' } },
  });
  const decision = ED.buildEditorialDecision(history, ME, memoryShownDifferentBalance);
  const companero = findEvaluated(decision, 'companero_balance');
  assert.notEqual(companero.status, 'excluded_by_cooldown');
});

/* ------------------------------------------------------------------ */
/* 9. mismo hito no vuelve a aparecer                                    */
/* ------------------------------------------------------------------ */

test('9. un hito ya mostrado alguna vez nunca vuelve a proponerse (defensa en profundidad del cooldown)', () => {
  const memoryWithMilestoneShown = Object.assign({}, ED.emptyMemory(), {
    shownMilestoneKeys: { 'hito_de_victorias:10': true },
  });
  const syntheticCandidate = {
    insightType: 'hito_de_victorias', family: 'B', claim: { winCount: 10 },
    comparisonScope: 'historial_completo', evidenceMatchIds: ['a', 'b'],
  };
  const semanticKey = ED.semanticKeyOf(syntheticCandidate);
  const reason = ED.cooldownReason(syntheticCandidate, semanticKey, memoryWithMilestoneShown, []);
  assert.equal(reason, 'mismo_hito_ya_mostrado');

  const reasonWithoutMemory = ED.cooldownReason(syntheticCandidate, semanticKey, ED.emptyMemory(), []);
  assert.equal(reasonWithoutMemory, null);
});

/* ------------------------------------------------------------------ */
/* 10. racha no se publica automáticamente en cada extensión            */
/* ------------------------------------------------------------------ */

test('10. la racha simple es elegible desde longitud 3 en adelante mientras nunca haya sido MOSTRADA (C02: ya no es "length===3 o nada")', () => {
  const at3 = ED.buildEditorialDecision(IC.buildPersonalHistory(winSeries(3)), ME, ED.emptyMemory());
  const at4 = ED.buildEditorialDecision(IC.buildPersonalHistory(winSeries(4)), ME, ED.emptyMemory());
  const racha3 = findEvaluated(at3, 'racha_de_victorias');
  const racha4 = findEvaluated(at4, 'racha_de_victorias');
  // Con memoria vacía (nunca se mostró esta racha) TANTO 3 COMO 4 son candidatas — una racha de
  // 4 nunca queda prohibida solo por no ser exactamente 3 (bug corregido en C02).
  assert.notEqual(racha3.status, 'excluded_by_cooldown');
  assert.notEqual(racha4.status, 'excluded_by_cooldown');
});

test('10b (C02, §8.3): racha de 4 sigue elegible si la racha (continua) todavía no fue mostrada', () => {
  const candidate4 = { insightType: 'racha_de_victorias', claim: { type: 'win', length: 4 } };
  const reason = ED.cooldownReason(candidate4, 'racha_vigente', ED.emptyMemory(), []);
  assert.equal(reason, null);
});

test('10c (C02, §8.4): racha de 4 simple se suprime si la MISMA racha continua ya fue mostrada, sin evento material nuevo', () => {
  const candidate4 = { insightType: 'racha_de_victorias', claim: { type: 'win', length: 4 } };
  const memoryAfterShowingIt = Object.assign({}, ED.emptyMemory(), { rachaSimpleYaMostrada: true });
  const reason = ED.cooldownReason(candidate4, 'racha_vigente', memoryAfterShowingIt, []);
  assert.equal(reason, 'racha_simple_ya_mostrada_sin_evento_nuevo');
});

test('10d (C02, extremo a extremo): la racha se corta y reinicia -> "ya mostrada" NUNCA sobrevive a un quiebre real', () => {
  // Etapa 1: 3 victorias — se muestra (nada más compite), memoria propone rachaSimpleYaMostrada=true.
  const stage1 = ED.buildEditorialDecision(IC.buildPersonalHistory(winSeries(3)), ME, ED.emptyMemory());
  assert.equal(stage1.memoryUpdate.rachaSimpleYaMostrada, true);

  // Etapa 2: se agrega 1 derrota (corta la racha; la nueva racha de derrotas es de longitud 1,
  // todavía no mostrable) — el reinicio debe resetear el flag para el próximo partido.
  const rows2 = winSeries(3).concat(row({ playedAt: dayIso(4), sets: straightSetsLoss('A') }));
  const stage2 = ED.buildEditorialDecision(IC.buildPersonalHistory(rows2), ME, stage1.memoryUpdate);
  assert.equal(stage2.memoryUpdate.rachaSimpleYaMostrada, false);

  // Etapa 3: 2 derrotas más (racha de derrotas llega a longitud 3, una racha NUEVA) — debe ser
  // elegible: el "ya mostrada" de la racha ganadora anterior nunca contamina esta racha nueva.
  const rows3 = rows2.concat(
    row({ playedAt: dayIso(5), sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(6), sets: straightSetsLoss('A') }),
  );
  const stage3 = ED.buildEditorialDecision(IC.buildPersonalHistory(rows3), ME, stage2.memoryUpdate);
  const rachaDerrotas = findEvaluated(stage3, 'racha_de_derrotas');
  assert.notEqual(rachaDerrotas.status, 'excluded_by_cooldown');
});

/* ------------------------------------------------------------------ */
/* 11. empate de score usa prioridad editorial + ID estable, nunca azar */
/* ------------------------------------------------------------------ */

test('11. un empate exacto de puntaje se resuelve por prioridad editorial + ID estable, siempre igual', () => {
  const history = IC.buildPersonalHistory(winSeries(10)); // racha_nuevo_record_personal e hito_de_victorias, mismo puntaje
  const decisions = [1, 2, 3].map(() => ED.buildEditorialDecision(history, ME, ED.emptyMemory()));
  const record = findEvaluated(decisions[0], 'racha_nuevo_record_personal');
  const hito = findEvaluated(decisions[0], 'hito_de_victorias');
  assert.equal(record.scored.finalScore, hito.scored.finalScore); // empate real confirmado
  // Determinístico entre corridas repetidas, nunca azar.
  decisions.forEach((d) => assert.equal(d.principal.insightType, decisions[0].principal.insightType));
});

/* ------------------------------------------------------------------ */
/* 12. memoria vacía vs. memoria previa produce salida determinística   */
/* ------------------------------------------------------------------ */

test('12. memoria vacía vs. memoria previa producen cada una una salida determinística (y distinta entre sí)', () => {
  const history = IC.buildPersonalHistory(winSeries(3));
  // Se compara un candidato ESPECÍFICO (no "el principal", que puede variar según qué otros
  // candidatos compitan) — mismo criterio que la prueba 6, para aislar el efecto de la memoria
  // del efecto de la selección.
  const emptyResult1 = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const emptyResult2 = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const rachaEmpty1 = findEvaluated(emptyResult1, 'racha_de_victorias');
  const rachaEmpty2 = findEvaluated(emptyResult2, 'racha_de_victorias');
  assert.equal(rachaEmpty1.scored.finalScore, rachaEmpty2.scored.finalScore);
  assert.deepEqual(emptyResult1.evaluated.map((e) => e.status), emptyResult2.evaluated.map((e) => e.status));

  const priorMemory = Object.assign({}, ED.emptyMemory(), { recentMatches: [{ matchId: 'x', principalFamily: 'B' }] });
  const withMemoryResult1 = ED.buildEditorialDecision(history, ME, priorMemory);
  const withMemoryResult2 = ED.buildEditorialDecision(history, ME, priorMemory);
  const rachaWithMemory1 = findEvaluated(withMemoryResult1, 'racha_de_victorias');
  const rachaWithMemory2 = findEvaluated(withMemoryResult2, 'racha_de_victorias');
  assert.equal(rachaWithMemory1.scored.finalScore, rachaWithMemory2.scored.finalScore);
  // La memoria previa SÍ cambia el resultado (penalización −15 aplicada) respecto de la vacía.
  assert.notEqual(rachaWithMemory1.scored.finalScore, rachaEmpty1.scored.finalScore);
});

/* ------------------------------------------------------------------ */
/* 13. ningún candidato descartado por Fase B puede revivirse en C      */
/* ------------------------------------------------------------------ */

test('13. un candidato descartado por Fase B (discarded:true) nunca aparece entre los evaluados de C', () => {
  const rows = [1, 2, 3].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // companero_balance: solo 3 partidos, Fase B lo descarta (umbral 4)
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const discardedByB = claims.find((c) => c.insightType === 'companero_balance' && c.discarded);
  assert.ok(discardedByB); // confirma que Fase B efectivamente lo descartó en este escenario

  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  assert.equal(findEvaluated(decision, 'companero_balance'), null); // nunca llega a Fase C
});

/* ------------------------------------------------------------------ */
/* 14. sin candidatos >55 => abstención                                  */
/* ------------------------------------------------------------------ */

test('14. sin ningún candidato por encima de 55, la decisión es abstención explícita (nunca inventa un principal)', () => {
  // Relación ya establecida (misma pareja de 4 jugadores, alternando victoria/derrota para
  // nunca formar una racha mostrable) + memoria que ya mostró TODO lo vigente hace 1 partido, sin
  // cambio de balance donde aplica — los hechos relacionales quedan excluidos por cooldown
  // (§7.3) y el resto (p. ej. `forma_reciente`, un balance móvil estable) cae por debajo de 55
  // porque su "novedad editorial" ya se agotó (§6.1). Solo sobrevive evaluado, y muy por debajo
  // del umbral, lo genérico (prueba #1). Ningún claim se inventa ni se fuerza: es la combinación
  // real de "ya lo dijimos" + "nada nuevo pasó".
  const rows = [1, 2, 3, 4, 5, 6].map((d, i) => row({
    playedAt: dayIso(d), team1: PARTNER, sets: i % 2 === 0 ? straightSetsWin('A') : straightSetsLoss('A'),
  }));
  const history = IC.buildPersonalHistory(rows);

  // Primera pasada (memoria vacía) solo para descubrir, de forma robusta, qué candidatos están
  // realmente vigentes hoy y por encima de 55 — nunca se calcula/asume a mano.
  const discovery = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const strongCandidates = discovery.evaluated.filter((e) => e.status === 'above_threshold');
  assert.ok(strongCandidates.length > 0); // confirma que hay algo que suprimir con memoria

  const priorMemory = ED.emptyMemory();
  strongCandidates.forEach((e) => {
    priorMemory.shownSemanticKeys[e.semanticKey] = {
      lastMatchId: history[history.length - 2].matchId, // 1 partido atrás: dentro de la ventana de 4
      lastValueSignature: ED.valueSignatureOf(e.candidate), // idéntico al actual: "sin cambio"
    };
  });

  const decision = ED.buildEditorialDecision(history, ME, priorMemory);
  assert.equal(decision.evaluated.some((e) => e.status === 'above_threshold'), false);
  assert.equal(decision.abstention, true);
  assert.equal(decision.principal, null);
  assert.equal(decision.secondary.length, 0); // objetos creados en el vm sandbox: comparar por campo, no deepEqual
});

/* ------------------------------------------------------------------ */
/* 15. forma reciente con ventana previa incompleta nunca se convierte  */
/*     en "mejoró/empeoró" — Fase C no agrega ese juicio                */
/* ------------------------------------------------------------------ */

test('15. forma_reciente conserva EXACTAMENTE el claim factual de Fase B, sin agregar semántica de mejora/empeora', () => {
  const rows = [1, 2, 3, 4, 5].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // exactamente 5 decididos: primera lectura válida, ventana previa incompleta
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const fromB = claims.find((c) => c.insightType === 'forma_reciente');
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const fromC = findEvaluated(decision, 'forma_reciente');
  assert.ok(fromB && fromC);
  assert.equal(JSON.stringify(fromC.candidate.claim), JSON.stringify(fromB.claim));
  assert.equal('mejoro' in fromC.candidate.claim, false);
  assert.equal('empeoro' in fromC.candidate.claim, false);
  assert.equal('esMaterial' in fromC.candidate.claim, false);
});

/* ------------------------------------------------------------------ */
/* 16. criterio absoluto: 0 claims/números/entidades nuevos              */
/* ------------------------------------------------------------------ */

test('16. Fase C nunca agrega candidatos nuevos ni modifica el claim/evidencia que entregó Fase B', () => {
  const history = IC.buildPersonalHistory(winSeries(10));
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const affirmedByB = claims.filter((c) => !c.discarded);
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  assert.equal(decision.evaluated.length, affirmedByB.length); // ni uno más, ni uno menos
  decision.evaluated.forEach((e) => {
    const matching = affirmedByB.find((c) => c.insightType === e.candidate.insightType && c.comparisonScope === e.candidate.comparisonScope);
    assert.ok(matching, `candidato inesperado: ${e.candidate.insightType}`);
    assert.equal(JSON.stringify(e.candidate.claim), JSON.stringify(matching.claim));
    assert.deepEqual(e.candidate.evidenceMatchIds.slice().sort(), matching.evidenceMatchIds.slice().sort());
  });
});

/* ------------------------------------------------------------------ */
/* C04: semanticKey de "primer encuentro" por matchId, nunca por timestamp */
/* ------------------------------------------------------------------ */

test('C04 (§8.8): dos partidos DISTINTOS con el mismo playedAt no comparten milestone de "primer encuentro"', () => {
  const RIVAL_3 = '55555555-5555-5555-5555-555555555555';
  const RIVAL_4 = '66666666-6666-6666-6666-666666666666';
  const sharedPlayedAt = dayIso(1); // ambos partidos "el mismo día", hora desconocida en la práctica real

  const historyA = IC.buildPersonalHistory([row({ playedAt: sharedPlayedAt, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') })]);
  const decisionA = ED.buildEditorialDecision(historyA, ME, ED.emptyMemory());
  const enfrentamientoA = findEvaluated(decisionA, 'rival_primer_enfrentamiento');
  assert.ok(enfrentamientoA);

  // Partido B: OTRO partido real, rivales completamente distintos, pero el MISMO timestamp
  // técnico que A — antes de C04 esto podía colisionar en la clave semántica.
  const historyB = IC.buildPersonalHistory([row({ playedAt: sharedPlayedAt, rivalA: RIVAL_3, rivalB: RIVAL_4, sets: straightSetsWin('A') })]);
  // Se usa la memoria PROPUESTA por A (como si A ya se hubiera mostrado) para evaluar B.
  const decisionB = ED.buildEditorialDecision(historyB, ME, decisionA.memoryUpdate);
  const enfrentamientoB = findEvaluated(decisionB, 'rival_primer_enfrentamiento');
  assert.ok(enfrentamientoB);

  assert.notEqual(enfrentamientoA.semanticKey, enfrentamientoB.semanticKey);
  assert.notEqual(enfrentamientoB.status, 'excluded_by_cooldown'); // nunca "ya mostrado" por compartir fecha con A
  // La clave usa el matchId real, nunca el timestamp compartido.
  assert.ok(enfrentamientoA.semanticKey.indexOf(historyA[0].matchId) !== -1);
  assert.ok(enfrentamientoB.semanticKey.indexOf(historyB[0].matchId) !== -1);
});

/* ------------------------------------------------------------------ */
/* C05-A: firma de "mejor compañero" identifica AL protagonista, no solo el marcador */
/* ------------------------------------------------------------------ */

test('C05-A (§8.9): un cambio de protagonista de "mejor compañero" con el MISMO W-L se considera un cambio real', () => {
  const rowsPartnerBest = [];
  for (let i = 0; i < 5; i++) rowsPartnerBest.push(row({ playedAt: dayIso(1 + i), team1: PARTNER, sets: straightSetsWin('A') }));
  for (let i = 0; i < 5; i++) rowsPartnerBest.push(row({ playedAt: dayIso(10 + i), team1: PARTNER_2, sets: i < 2 ? straightSetsWin('A') : straightSetsLoss('A') }));
  const historyPartnerBest = IC.buildPersonalHistory(rowsPartnerBest);
  const decisionPartnerBest = ED.buildEditorialDecision(historyPartnerBest, ME, ED.emptyMemory());
  const bestPartner = findEvaluated(decisionPartnerBest, 'companero_mejor_balance');
  assert.equal(bestPartner.candidate.claim.companionPlayerId, PARTNER);

  // Memoria: "ya mostré companero_mejor_balance con el mismo 5-0 hace 1 partido" — pero el
  // PROTAGONISTA de esa memoria es OTRO compañero (uno sintético, nunca visto en esta historia).
  const OTHER_COMPANION = '99999999-9999-9999-9999-999999999999';
  const staleSignature = ED.valueSignatureOf({
    insightType: 'companero_mejor_balance',
    claim: { companionPlayerId: OTHER_COMPANION, wins: 5, losses: 0, isUnique: true, tiedWith: [] },
  });
  const memoryWithDifferentProtagonist = Object.assign({}, ED.emptyMemory(), {
    shownSemanticKeys: {
      companero_mejor_balance: { lastMatchId: historyPartnerBest[historyPartnerBest.length - 2].matchId, lastValueSignature: staleSignature },
    },
  });
  const decision2 = ED.buildEditorialDecision(historyPartnerBest, ME, memoryWithDifferentProtagonist);
  const bestPartner2 = findEvaluated(decision2, 'companero_mejor_balance');
  // El semanticKey sigue siendo global ('companero_mejor_balance'), pero la firma de valor real
  // (con PARTNER, 5-0, único) es DISTINTA de la firma guardada (con OTHER_COMPANION) — nunca se
  // interpreta como "sin cambio" solo porque el marcador numérico coincide.
  const realSignature = ED.valueSignatureOf(bestPartner2.candidate);
  assert.notEqual(realSignature, staleSignature);
});

/* ------------------------------------------------------------------ */
/* C05-B: motivo editorial final para todo candidato por encima de 55   */
/* ------------------------------------------------------------------ */

test('C05-B (§8.10): todo candidato por encima de 55 que no queda seleccionado conserva un motivo editorial final reconstruible', () => {
  const history = IC.buildPersonalHistory(winSeries(10)); // varios candidatos fuertes compitiendo (racha, hito, balances D/E)
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  const aboveThreshold = decision.evaluated.filter((e) => e.status === 'above_threshold');
  assert.ok(aboveThreshold.length > 3); // confirma que hay más candidatos fuertes que lugares (1+2)

  const validReasons = [
    'selected_principal', 'selected_secondary',
    'not_selected_duplicate_semantic', 'not_selected_family_already_used', 'not_selected_capacity',
  ];
  aboveThreshold.forEach((e) => {
    assert.ok(validReasons.includes(e.editorialStatus), `motivo inesperado: ${e.editorialStatus}`);
  });
  // Exactamente 1 principal y hasta 2 secundarios llevan motivo "selected_*"; el resto, un motivo
  // "not_selected_*" — nunca queda un candidato fuerte sin explicación de por qué no se mostró.
  const selectedCount = aboveThreshold.filter((e) => e.editorialStatus.indexOf('selected_') === 0).length;
  const notSelectedCount = aboveThreshold.filter((e) => e.editorialStatus.indexOf('not_selected_') === 0).length;
  assert.equal(selectedCount, 1 + decision.secondary.length);
  assert.equal(selectedCount + notSelectedCount, aboveThreshold.length);
});

/* ------------------------------------------------------------------ */
/* C01: recentTemplateIds preparado para Fase D                         */
/* ------------------------------------------------------------------ */

test('C01 (§8.2): recentTemplateIds existe en la memoria vacía y se preserva intacto en memoryUpdate', () => {
  const empty = ED.emptyMemory();
  assert.ok(Array.isArray(empty.recentTemplateIds));
  assert.equal(empty.recentTemplateIds.length, 0);

  const priorWithTemplates = Object.assign({}, empty, { recentTemplateIds: ['plantilla_x', 'plantilla_y'] });
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const decision = ED.buildEditorialDecision(history, ME, priorWithTemplates);
  assert.deepEqual(decision.memoryUpdate.recentTemplateIds.slice().sort(), ['plantilla_x', 'plantilla_y'].sort());
});

/* ------------------------------------------------------------------ */
/* Extra: desglose de puntaje reconstruible                              */
/* ------------------------------------------------------------------ */

test('extra: el desglose de puntaje suma exactamente a finalScore (rawScore + penalizaciones)', () => {
  const history = IC.buildPersonalHistory(winSeries(10));
  const decision = ED.buildEditorialDecision(history, ME, ED.emptyMemory());
  decision.evaluated.forEach((e) => {
    if (!e.scored) return;
    const dimSum = Object.values(e.scored.dimensions).reduce((s, v) => s + v, 0);
    assert.equal(dimSum, e.scored.rawScore);
    const penaltySum = e.scored.penalties.reduce((s, p) => s + p.value, 0);
    assert.equal(e.scored.rawScore + penaltySum, e.scored.finalScore);
  });
});
