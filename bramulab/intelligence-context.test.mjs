// BRAMUlab — Bloque 8 (Fase A): pruebas locales de intelligence-context.js.
// Ejecutar con: node --test bramulab/intelligence-context.test.mjs
//
// Mismo criterio que match-level-engine.test.mjs: los módulos compartidos son scripts de
// navegador (IIFE que asignan a `window`/`globalThis`, sin `export`) — se cargan tal cual en un
// contexto vm nuevo, sin envolverlos en ningún formato de módulo distinto al que ya usa
// index.html/las Edge Functions. Esto prueba el mismo pipeline previsto para Fase B:
// fila con forma get_player_intelligence_history -> PLIntelligenceContext.buildPersonalHistory
// (que internamente traduce con PLMatchSync.translateServerMatchToLocalShape) ->
// PLIntelligenceContext.buildMatchDerivedContext.
//
// Criterio absoluto de Intelligence (BRAMU_Intelligence_Implementacion.md §11): 0 números
// incorrectos, 0 entidades inventadas, 0 acciones no registradas, 0 claims sin evidencia. Estas
// pruebas verifican los DERIVADOS (Fase A), no los claims (Fase B) — pero cualquier número mal
// calculado acá se propagaría a todos los claims futuros, así que se prueban con precisión
// exacta, no aproximada.

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
  for (const relPath of ['engine.js', 'level.js', 'level-context.js', 'match-sync.js', 'intelligence-context.js']) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadSharedEngine();
const IC = sandbox.PLIntelligenceContext;

const ME = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const RIVAL_1 = '33333333-3333-3333-3333-333333333333';
const RIVAL_2 = '44444444-4444-4444-4444-444444444444';
const RIVAL_3 = '55555555-5555-5555-5555-555555555555';
const RIVAL_4 = '66666666-6666-6666-6666-666666666666';

let seq = 0;
function matchId() {
  seq += 1;
  return `match-${String(seq).padStart(4, '0')}`;
}

/** Fila con la MISMA forma jsonb (camelCase) que get_player_intelligence_history — se
 *  construye a mano en vez de pegarle a Supabase, mismo criterio que match-level-engine.test.mjs
 *  con get_my_matches. `winnerTeam` NUNCA se pasa acá: se deriva de `sets` con el mismo Engine
 *  que la app real, igual que hace translateServerMatchToLocalShape. */
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
    matchId: matchId(),
    status,
    playedAt,
    playedAtTimeKnown: true,
    formatId: 'classic',
    scoringSystem: 'standard',
    myTeam: ownTeam,
    createdByPlayerId: ME,
    validatedAt: status === 'validated' ? playedAt : null,
    validationDeadlineAt: null,
    hidden,
    officialEligible,
    hasOpenIdentityIssue,
    participants,
    sets: sets.map((s, i) => ({ setNumber: i + 1, gamesA: s[0], gamesB: s[1], tiebreakA: s[2] ?? null, tiebreakB: s[3] ?? null })),
  };
}

/** Sets que dan la victoria al equipo `ownTeam` en dos sets corridos (6-3, 6-4), sin tocar
 *  al rival. */
function straightSetsWin(ownTeam) {
  return ownTeam === 'A' ? [[6, 3], [6, 4]] : [[3, 6], [4, 6]];
}
function straightSetsLoss(ownTeam) {
  return straightSetsWin(ownTeam === 'A' ? 'B' : 'A');
}

test('los módulos compartidos se cargan y PLIntelligenceContext expone su API pública', () => {
  assert.ok(IC && typeof IC.buildMatchDerivedContext === 'function');
  assert.ok(typeof IC.buildPersonalHistory === 'function');
  assert.ok(typeof sandbox.PLMatchSync.translateServerMatchToLocalShape === 'function');
});

/* ------------------------------------------------------------------ */
/* buildPersonalHistory — orden por fecha real, nunca por orden de carga */
/* ------------------------------------------------------------------ */

test('buildPersonalHistory ordena por playedAt real aunque las filas lleguen en otro orden', () => {
  const r1 = row({ playedAt: '2026-01-10T00:00:00.000Z', sets: straightSetsWin('A') });
  const r2 = row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') });
  const r3 = row({ playedAt: '2026-01-20T00:00:00.000Z', sets: straightSetsWin('A') });
  // Orden de llegada deliberadamente desordenado (simula orden de carga, no de fecha jugada).
  const history = IC.buildPersonalHistory([r1, r3, r2]);
  assert.deepEqual(history.map((m) => m.playedAt), [
    '2026-01-01T00:00:00.000Z', '2026-01-10T00:00:00.000Z', '2026-01-20T00:00:00.000Z',
  ]);
});

/* ------------------------------------------------------------------ */
/* resolvePerspective                                                   */
/* ------------------------------------------------------------------ */

test('resolvePerspective identifica compañero, rivales y resultado ganado', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') })]);
  const perspective = IC.resolvePerspective(history[0], ME);
  assert.equal(perspective.result, 'win');
  assert.equal(perspective.teammate.userId, PARTNER);
  assert.deepEqual(perspective.rivals.map((r) => r.userId).sort(), [RIVAL_1, RIVAL_2].sort());
});

test('resolvePerspective devuelve result=null cuando el partido no tiene winnerTeam definido (sets vacíos = sin declarar)', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: [] })]);
  const perspective = IC.resolvePerspective(history[0], ME);
  assert.equal(perspective.result, null);
});

/* ------------------------------------------------------------------ */
/* computeFormatFacts — BRAMU_Intelligence.md §5.1                      */
/* ------------------------------------------------------------------ */

test('computeFormatFacts: sets corridos, margen normalizado y lostFirstSetWonMatch=false', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: [[6, 1], [6, 1]] })]);
  const facts = IC.computeFormatFacts(history[0]);
  assert.equal(facts.setsPlayed, 2);
  assert.equal(facts.decisiveSet, false);
  assert.equal(facts.gamesWonByWinner, 12);
  assert.equal(facts.gamesTotal, 14);
  assert.equal(facts.marginNormalized, round4(Math.abs(2 * 12 - 14) / 14));
  assert.equal(facts.lostFirstSetWonMatch, false);
  assert.equal(facts.alternatingSetWinners, null); // solo aplica con exactamente 3 sets
});

test('computeFormatFacts: revirtieron después de perder el primer set (detector 1 de Implementacion.md §7)', () => {
  // A pierde el primero 4-6, gana los dos siguientes: A gana el partido.
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: [[4, 6], [6, 3], [6, 4]] })]);
  const facts = IC.computeFormatFacts(history[0]);
  assert.equal(facts.winnerTeam, 'A');
  assert.equal(facts.lostFirstSetWonMatch, true);
  assert.equal(facts.decisiveSet, true);
});

test('computeFormatFacts: alternatingSetWinners distingue A,B,A de A,B,B', () => {
  const alternating = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: [[6, 4], [4, 6], [6, 4]] })]); // A,B,A
  const notAlternating = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: [[4, 6], [4, 6], [4, 6]] })]); // B,B,B (no debería pasar en la realidad, pero prueba el booleano puro)
  assert.equal(IC.computeFormatFacts(alternating[0]).alternatingSetWinners, true);
  assert.equal(IC.computeFormatFacts(notAlternating[0]).alternatingSetWinners, false);
});

/* ------------------------------------------------------------------ */
/* Rachas — BRAMU_Intelligence.md §5.3/§6.2                             */
/* ------------------------------------------------------------------ */

test('racha: 4 victorias seguidas es un nuevo récord en la 4ta, no antes', () => {
  const rows = [1, 2, 3, 4].map((n) => row({ playedAt: `2026-01-0${n}T00:00:00.000Z`, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const timeline = IC.computeStreakTimeline(decided);
  assert.deepEqual(timeline.map((t) => t.after.length), [1, 2, 3, 4]);
  assert.deepEqual(timeline.map((t) => t.isRecord), [true, true, true, true]);
});

test('racha: una derrota corta una racha de 3 victorias (before/after distintos tipos)', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-03T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-04T00:00:00.000Z', sets: straightSetsLoss('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const timeline = IC.computeStreakTimeline(decided);
  const cutEntry = timeline[3];
  // Objetos creados dentro del vm sandbox: se comparan por campo (deepEqual entre realms
  // distintos compara prototipos, no solo estructura).
  assert.equal(cutEntry.before.type, 'win');
  assert.equal(cutEntry.before.length, 3);
  assert.equal(cutEntry.after.type, 'loss');
  assert.equal(cutEntry.after.length, 1);
});

test('racha: iguala el récord anterior sin superarlo (tiesRecord=true, isRecord=false)', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', sets: straightSetsWin('A') }), // racha 2 (récord)
    row({ playedAt: '2026-01-03T00:00:00.000Z', sets: straightSetsLoss('A') }), // corta
    row({ playedAt: '2026-01-04T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-05T00:00:00.000Z', sets: straightSetsWin('A') }), // iguala 2, no supera
  ];
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const timeline = IC.computeStreakTimeline(decided);
  assert.equal(timeline[4].after.length, 2);
  assert.equal(timeline[4].isRecord, false);
  assert.equal(timeline[4].tiesRecord, true);
});

test('un partido sin resultado definido (pendiente) no rompe ni extiende la racha: simplemente no aparece', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', sets: [], status: 'pending_validation', officialEligible: false }),
    row({ playedAt: '2026-01-03T00:00:00.000Z', sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  assert.equal(decided.length, 2); // el pendiente sin sets queda afuera de la secuencia decidida
  const timeline = IC.computeStreakTimeline(decided);
  assert.equal(timeline[1].after.length, 2); // sigue siendo la 2da victoria consecutiva, no la 3ra
});

/* ------------------------------------------------------------------ */
/* Forma reciente — BRAMU_Intelligence.md §5.3                          */
/* ------------------------------------------------------------------ */

test('forma reciente de últimos 5: sampleSize nunca excede el historial disponible', () => {
  const rows = [1, 2].map((n) => row({ playedAt: `2026-01-0${n}T00:00:00.000Z`, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const form5 = IC.computeRecentForm(decided, 5);
  assert.equal(form5.sampleSize, 2);
  assert.equal(form5.wins, 2);
  assert.equal(form5.losses, 0);
});

test('forma reciente de últimos 5 sobre 7 partidos: solo mira los últimos 5, no todo el historial', () => {
  // 2 derrotas, luego 5 victorias -> balance de los últimos 5 debe ser 5-0, no 5-2.
  const rows = [];
  for (let i = 1; i <= 2; i++) rows.push(row({ playedAt: `2026-01-0${i}T00:00:00.000Z`, sets: straightSetsLoss('A') }));
  for (let i = 3; i <= 7; i++) rows.push(row({ playedAt: `2026-01-0${i}T00:00:00.000Z`, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const form5 = IC.computeRecentForm(decided, 5);
  assert.equal(form5.wins, 5);
  assert.equal(form5.losses, 0);
});

/* ------------------------------------------------------------------ */
/* Hitos acumulativos — BRAMU_Intelligence.md §5.2                      */
/* ------------------------------------------------------------------ */

test('hitos: primer partido decidido y primera victoria coinciden en el debut ganado', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') })]);
  const decided = IC.buildDecidedSequence(history, ME);
  const milestones = IC.computeMilestones(decided);
  assert.equal(milestones.isFirstDecidedMatchEver, true);
  assert.equal(milestones.isFirstWinEver, true);
  assert.equal(milestones.totalWins, 1);
});

test('hitos: victoria número 10 se marca exactamente en la 10ma, no antes ni después', () => {
  const rows = [];
  for (let i = 1; i <= 11; i++) {
    rows.push(row({ playedAt: `2026-01-${String(i).padStart(2, '0')}T00:00:00.000Z`, sets: straightSetsWin('A') }));
  }
  const history = IC.buildPersonalHistory(rows);
  const decided = IC.buildDecidedSequence(history, ME);
  const at9 = IC.computeMilestones(decided.slice(0, 9));
  const at10 = IC.computeMilestones(decided.slice(0, 10));
  const at11 = IC.computeMilestones(decided.slice(0, 11));
  assert.equal(at9.winMilestoneReached, null);
  assert.equal(at10.winMilestoneReached, 10);
  assert.equal(at11.winMilestoneReached, null);
});

/* ------------------------------------------------------------------ */
/* Relaciones — BRAMU_Intelligence.md §5.4/§5.5                         */
/* ------------------------------------------------------------------ */

test('balance con compañero: cuenta partidos jugados juntos y balance exacto, incluye un pendiente en totalMatches pero no en decidedMatches', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', team1: PARTNER, sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', team1: PARTNER, sets: straightSetsLoss('A') }),
    row({ playedAt: '2026-01-03T00:00:00.000Z', team1: PARTNER, sets: [], status: 'pending_validation', officialEligible: false }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationCompanion(PARTNER));
  assert.equal(summary.totalMatches, 3);
  assert.equal(summary.decidedMatches, 2);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.isFirstEncounter, false);
});

test('primer partido con un compañero nuevo: isFirstEncounter=true', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', team1: PARTNER, sets: straightSetsWin('A') })]);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationCompanion(PARTNER));
  assert.equal(summary.isFirstEncounter, true);
  assert.equal(summary.totalMatches, 1);
});

test('rival habitual: balance contra un rival individual sin importar quién fue su compañero', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', team1: RIVAL_3, rivalA: RIVAL_1, rivalB: RIVAL_4, sets: straightSetsLoss('A') }),
    row({ playedAt: '2026-01-03T00:00:00.000Z', team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationIndividualRival(RIVAL_1));
  assert.equal(summary.totalMatches, 3); // RIVAL_1 estuvo en los 3, con compañeros propios distintos
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 2);
});

test('pareja rival exacta no se confunde con enfrentar solo a uno de sus integrantes', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }), // pareja exacta
    row({ playedAt: '2026-01-02T00:00:00.000Z', rivalA: RIVAL_1, rivalB: RIVAL_3, sets: straightSetsWin('A') }), // solo RIVAL_1 repite, pareja distinta
  ];
  const history = IC.buildPersonalHistory(rows);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationRivalPair(RIVAL_1, RIVAL_2));
  assert.equal(summary.totalMatches, 1);
  assert.equal(summary.losses, 1);
});

test('cruce exacto de parejas exige el MISMO compañero y la MISMA pareja rival a la vez', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }), // cruce exacto
    row({ playedAt: '2026-01-02T00:00:00.000Z', team1: RIVAL_3, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }), // misma pareja rival, otro compañero propio
  ];
  const history = IC.buildPersonalHistory(rows);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationExactPairCrossing(PARTNER, RIVAL_1, RIVAL_2));
  assert.equal(summary.totalMatches, 1);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 0);
});

test('un slot rival sin identidad conocida nunca cuenta como "pareja rival exacta"', () => {
  const r = row({ playedAt: '2026-01-01T00:00:00.000Z', rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') });
  // Simula un slot "Por identificar": playerId null en el rival B.
  r.participants = r.participants.map((p) => (p.playerId === RIVAL_2 ? Object.assign({}, p, { playerId: null }) : p));
  const history = IC.buildPersonalHistory([r]);
  const summary = IC.computeRelationshipSummary(history, ME, IC.relationRivalPair(RIVAL_1, RIVAL_2));
  assert.equal(summary.totalMatches, 0);
});

/* ------------------------------------------------------------------ */
/* Inactividad — BRAMU_Intelligence.md §5.2                              */
/* ------------------------------------------------------------------ */

test('inactividad: menos de 6 partidos previos nunca afirma excepcionalidad', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-06-01T00:00:00.000Z', sets: straightSetsWin('A') }), // 151 días después
  ];
  const history = IC.buildPersonalHistory(rows);
  const gap = IC.computeInactivityGap(history);
  assert.equal(gap.isExceptional, false);
  assert.equal(gap.reasonCodes.length, 1);
  assert.equal(gap.reasonCodes[0], 'menos_de_6_partidos_previos');
});

test('inactividad: regreso excepcional con separación habitual corta y una pausa larga', () => {
  const rows = [];
  // 7 partidos separados por 3 días cada uno (mediana de separación = 3 días -> umbral = max(30, 6) = 30).
  for (let i = 0; i < 7; i++) {
    rows.push(row({ playedAt: new Date(Date.UTC(2026, 0, 1 + i * 3)).toISOString(), sets: straightSetsWin('A') }));
  }
  // Pausa de 45 días antes del 8vo partido -> supera el umbral de 30.
  rows.push(row({ playedAt: new Date(Date.UTC(2026, 0, 1 + 6 * 3 + 45)).toISOString(), sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const gap = IC.computeInactivityGap(history);
  assert.equal(gap.threshold, 30);
  assert.equal(gap.daysSincePrevious, 45);
  assert.equal(gap.isExceptional, true);
});

/* ------------------------------------------------------------------ */
/* buildMatchDerivedContext — orquestador                                */
/* ------------------------------------------------------------------ */

test('buildMatchDerivedContext arma la superficie completa para un partido decidido', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const ctx = IC.buildMatchDerivedContext(history, ME);
  assert.equal(ctx.matchId, history[1].matchId);
  assert.equal(ctx.perspective.result, 'win');
  assert.equal(ctx.streakForThisMatch.after.length, 2);
  assert.equal(ctx.recentForm5.wins, 2);
  assert.equal(ctx.companion.totalMatches, 2);
  assert.equal(ctx.rivalPair.totalMatches, 2);
  assert.equal(ctx.exactPairCrossing.totalMatches, 2);
  assert.equal(ctx.isFirstMatchEver, false);
});

test('buildMatchDerivedContext: primer partido de la historia -> isFirstMatchEver=true y sin racha previa', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') })]);
  const ctx = IC.buildMatchDerivedContext(history, ME);
  assert.equal(ctx.isFirstMatchEver, true);
  assert.equal(ctx.streakForThisMatch.before, null);
  assert.equal(ctx.milestones.isFirstWinEver, true);
});

test('buildMatchDerivedContext: partido pendiente sin resultado no tiene racha ni forma reciente, pero sí formatFacts/inactividad', () => {
  const rows = [
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A') }),
    row({ playedAt: '2026-01-02T00:00:00.000Z', sets: [], status: 'pending_validation', officialEligible: false }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const ctx = IC.buildMatchDerivedContext(history, ME);
  assert.equal(ctx.perspective.result, null);
  assert.equal(ctx.streakForThisMatch, null);
  assert.equal(ctx.recentForm5, null);
  assert.equal(ctx.inactivity.daysSincePrevious, 1);
});

test('buildMatchDerivedContext respeta oficialidad/ocultamiento tal cual llegan, sin recalcularlos', () => {
  const history = IC.buildPersonalHistory([
    row({ playedAt: '2026-01-01T00:00:00.000Z', sets: straightSetsWin('A'), officialEligible: false, hidden: true, hasOpenIdentityIssue: true }),
  ]);
  const ctx = IC.buildMatchDerivedContext(history, ME);
  assert.equal(ctx.officialEligible, false);
  assert.equal(ctx.hidden, true);
  assert.equal(ctx.hasOpenIdentityIssue, true);
});

function round4(n) { return Math.round(n * 10000) / 10000; }
