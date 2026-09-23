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

/* ------------------------------------------------------------------ */
/* 6. misma familia principal en los últimos 2 partidos => −15         */
/* ------------------------------------------------------------------ */

test('6. penalización −15 cuando la misma familia fue principal en los últimos 2 partidos', () => {
  const history = IC.buildPersonalHistory(winSeries(3)); // racha_de_victorias (familia B) elegible en longitud 3
  const noPenaltyMemory = ED.emptyMemory();
  const withPenaltyMemory = Object.assign({}, ED.emptyMemory(), {
    recentPrincipalFamilies: [{ family: 'B', matchId: 'otro-partido' }],
  });
  const decisionNoPenalty = ED.buildEditorialDecision(history, ME, noPenaltyMemory);
  const decisionWithPenalty = ED.buildEditorialDecision(history, ME, withPenaltyMemory);
  const rachaNoPenalty = findEvaluated(decisionNoPenalty, 'racha_de_victorias');
  const rachaWithPenalty = findEvaluated(decisionWithPenalty, 'racha_de_victorias');
  assert.equal(rachaNoPenalty.scored.penalties.some((p) => p.code === 'misma_familia_principal_ultimos_2'), false);
  assert.equal(rachaWithPenalty.scored.penalties.some((p) => p.code === 'misma_familia_principal_ultimos_2'), true);
  assert.equal(rachaWithPenalty.scored.finalScore, rachaNoPenalty.scored.finalScore - 15);
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

test('10. la racha simple es elegible exactamente al llegar a 3, no en cada extensión posterior', () => {
  const at3 = ED.buildEditorialDecision(IC.buildPersonalHistory(winSeries(3)), ME, ED.emptyMemory());
  const at4 = ED.buildEditorialDecision(IC.buildPersonalHistory(winSeries(4)), ME, ED.emptyMemory());
  const racha3 = findEvaluated(at3, 'racha_de_victorias');
  const racha4 = findEvaluated(at4, 'racha_de_victorias');
  assert.notEqual(racha3.status, 'excluded_by_cooldown');
  assert.equal(racha4.status, 'excluded_by_cooldown');
  assert.equal(racha4.excludedReason, 'racha_no_en_cada_extension');
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

  const priorMemory = Object.assign({}, ED.emptyMemory(), { recentPrincipalFamilies: [{ family: 'B', matchId: 'x' }] });
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
