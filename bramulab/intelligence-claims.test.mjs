// BRAMUlab — Bloque 8 (Fase B): pruebas locales de intelligence-claims.js.
// Ejecutar con: node --test bramulab/intelligence-claims.test.mjs
//
// Mismo criterio que intelligence-context.test.mjs: módulos compartidos (IIFE sin `export`)
// cargados tal cual en un `vm.createContext` nuevo. Los fixtures usan la forma REAL snake_case
// de get_player_intelligence_history (corrección C01 de Fase A) — nunca una idealización.
//
// Criterio absoluto de Intelligence: 0 números incorrectos, 0 entidades inventadas, 0 acciones
// no registradas, 0 claims sin evidencia. La última prueba de cada bloque temático verifica
// explícitamente que TODO claim afirmado (`discarded:false`) trae `evidenceMatchIds` reales y
// no vacíos — nunca un claim "flotando" sin partidos fuente.

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
  for (const relPath of ['engine.js', 'level.js', 'level-context.js', 'match-sync.js', 'intelligence-context.js', 'intelligence-claims.js']) {
    const code = fs.readFileSync(path.join(__dirname, relPath), 'utf8');
    vm.runInContext(code, sandbox, { filename: relPath });
  }
  return sandbox;
}

const sandbox = loadSharedEngine();
const IC = sandbox.PLIntelligenceContext;
const CL = sandbox.PLIntelligenceClaims;

const ME = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const PARTNER_2 = '77777777-7777-7777-7777-777777777777';
const RIVAL_1 = '33333333-3333-3333-3333-333333333333';
const RIVAL_2 = '44444444-4444-4444-4444-444444444444';
const RIVAL_3 = '55555555-5555-5555-5555-555555555555';
const RIVAL_4 = '66666666-6666-6666-6666-666666666666';

let seq = 0;
function matchId() {
  seq += 1;
  return `match-${String(seq).padStart(4, '0')}`;
}

/** Fila con la forma REAL snake_case de get_player_intelligence_history — mismo criterio que
 *  intelligence-context.test.mjs (corrección C01). */
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

function dayIso(n) {
  return new Date(Date.UTC(2026, 0, n)).toISOString();
}

/** Arma N filas ganadas seguidas (o perdidas si win=false) en días consecutivos, útil para
 *  escenarios de racha/hitos donde no importa el rival exacto. */
function seriesRows(n, { win = true, startDay = 1, ...rest } = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(row({ playedAt: dayIso(startDay + i), sets: win ? straightSetsWin('A') : straightSetsLoss('A'), ...rest }));
  }
  return rows;
}

function assertClaimHasRealEvidence(claim) {
  assert.equal(claim.discarded, false);
  assert.ok(Array.isArray(claim.evidenceMatchIds));
  assert.ok(claim.evidenceMatchIds.length > 0, `claim ${claim.insightType} no debe tener evidenceMatchIds vacío`);
  assert.ok(claim.evidenceMatchIds.every((id) => typeof id === 'string' && id.length > 0));
}

function findClaim(claims, insightType) {
  return claims.find((c) => c.insightType === insightType) || null;
}

test('los módulos se cargan y PLIntelligenceClaims expone su API pública', () => {
  assert.ok(CL && typeof CL.buildClaimsForMatch === 'function');
});

/* ------------------------------------------------------------------ */
/* Criterio absoluto — 0 claims sin evidencia, en un escenario grande   */
/* ------------------------------------------------------------------ */

test('criterio absoluto: todo claim afirmado en un historial largo y variado trae evidenceMatchIds real', () => {
  const rows = [];
  for (let i = 0; i < 18; i++) {
    const win = i % 3 !== 0;
    rows.push(row({ playedAt: dayIso(1 + i), sets: win ? straightSetsWin('A') : straightSetsLoss('A'), team1: i % 2 === 0 ? PARTNER : PARTNER_2, rivalA: RIVAL_1, rivalB: i % 4 === 0 ? RIVAL_3 : RIVAL_2 }));
  }
  const history = IC.buildPersonalHistory(rows);
  for (let i = 0; i < history.length; i++) {
    const { claims } = CL.buildClaimsForMatch(history.slice(0, i + 1), ME);
    claims.filter((c) => !c.discarded).forEach(assertClaimHasRealEvidence);
    claims.forEach((c) => {
      // Todo candidato evaluado queda con su motivo (afirmado con evidencia, o descartado con
      // discardReasonCodes) — nunca "a medias".
      if (c.discarded) assert.ok(c.discardReasonCodes.length > 0);
      else assert.equal(c.discardReasonCodes.length, 0);
    });
  }
});

test('un partido pendiente sin resultado no produce NINGÚN claim con evidencia inventada', () => {
  const rows = [
    row({ playedAt: dayIso(1), sets: straightSetsWin('A') }),
    row({ playedAt: dayIso(2), sets: [], status: 'pending_validation', officialEligible: false }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  // Sin winnerTeam no hay estructura/racha/hitos ni forma reciente para ESTE partido — solo
  // pueden sobrevivir claims de contexto que no dependen del resultado del partido actual
  // (p. ej. "compañero nuevo" evaluado con datos de partidos previos).
  assert.equal(findClaim(claims, 'sets_corridos'), null);
  assert.equal(findClaim(claims, 'racha_de_victorias'), null);
  assert.equal(findClaim(claims, 'forma_reciente'), null);
  claims.filter((c) => !c.discarded).forEach(assertClaimHasRealEvidence);
});

/* ------------------------------------------------------------------ */
/* Familia A — estructura del resultado (§5.1)                          */
/* ------------------------------------------------------------------ */

test('Familia A: reversión tras perder el primer set produce el claim con evidencia del propio partido', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: [[4, 6], [6, 3], [6, 4]] })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const claim = findClaim(claims, 'reversion_tras_perder_primer_set');
  assertClaimHasRealEvidence(claim);
  assert.equal(claim.family, 'A');
  assert.equal(claim.evidenceMatchIds.length, 1);
  assert.equal(claim.evidenceMatchIds[0], history[0].matchId);
});

test('Familia A: sets corridos no produce reversión ni alternancia', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assert.ok(findClaim(claims, 'sets_corridos'));
  assert.equal(findClaim(claims, 'reversion_tras_perder_primer_set'), null);
  assert.equal(findClaim(claims, 'alternancia_de_sets'), null);
});

/* ------------------------------------------------------------------ */
/* Familia B — hitos, rachas y récords (§5.2/§5.3)                      */
/* ------------------------------------------------------------------ */

test('Familia B: racha de 3 ya es mostrable, de 2 todavía no', () => {
  const history2 = IC.buildPersonalHistory(seriesRows(2));
  const { claims: claims2 } = CL.buildClaimsForMatch(history2, ME);
  assert.equal(findClaim(claims2, 'racha_de_victorias'), null);

  const history3 = IC.buildPersonalHistory(seriesRows(3));
  const { claims: claims3 } = CL.buildClaimsForMatch(history3, ME);
  const streak3 = findClaim(claims3, 'racha_de_victorias');
  assertClaimHasRealEvidence(streak3);
  assert.equal(streak3.claim.length, 3);
});

test('Familia B: racha cortada trae la longitud/tipo anterior como evidencia estructurada', () => {
  const rows = seriesRows(4).concat(seriesRows(1, { win: false, startDay: 5 }));
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const cut = findClaim(claims, 'racha_cortada');
  assertClaimHasRealEvidence(cut);
  assert.equal(cut.claim.previousType, 'win');
  assert.equal(cut.claim.previousLength, 4);
  assert.equal(cut.claim.newType, 'loss');
});

test('Familia B: nuevo récord de racha exige al menos 10 partidos comparables — con 9 se descarta explícitamente', () => {
  // 9 partidos: alterna para nunca superar longitud 1 hasta los últimos 4, que sí forman récord,
  // pero el TOTAL de decididos (9) sigue por debajo de RECORD_MIN_SAMPLE (10).
  const rows = [];
  rows.push(row({ playedAt: dayIso(1), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(2), sets: straightSetsLoss('A') }));
  rows.push(row({ playedAt: dayIso(3), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(4), sets: straightSetsLoss('A') }));
  rows.push(row({ playedAt: dayIso(5), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(6), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(7), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(8), sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // 8 decididos, racha final de 4 (nuevo récord de longitud)
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const discarded = claims.find((c) => c.insightType === 'racha_nuevo_record_personal' && c.discarded);
  assert.ok(discarded);
  assert.equal(discarded.discardReasonCodes.length, 1);
  assert.equal(discarded.discardReasonCodes[0], 'muestra_insuficiente_para_record_personal');
  assert.equal(claims.some((c) => c.insightType === 'racha_nuevo_record_personal' && !c.discarded), false); // no hay versión afirmada en paralelo
});

test('Familia B: nuevo récord de racha SÍ se afirma con al menos 10 partidos comparables', () => {
  const rows = [];
  rows.push(row({ playedAt: dayIso(1), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(2), sets: straightSetsLoss('A') }));
  for (let i = 0; i < 9; i++) rows.push(row({ playedAt: dayIso(3 + i), sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows); // 11 decididos, racha final de 9 (récord)
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const record = claims.find((c) => c.insightType === 'racha_nuevo_record_personal' && !c.discarded);
  assertClaimHasRealEvidence(record);
  assert.equal(record.sampleSize, 11);
  assert.equal(record.claim.length, 9);
});

test('Familia B: hito de victoria número 10 se marca exactamente en la 10ma', () => {
  const history9 = IC.buildPersonalHistory(seriesRows(9));
  assert.equal(findClaim(CL.buildClaimsForMatch(history9, ME).claims, 'hito_de_victorias'), null);

  const history10 = IC.buildPersonalHistory(seriesRows(10));
  const claim10 = findClaim(CL.buildClaimsForMatch(history10, ME).claims, 'hito_de_victorias');
  assertClaimHasRealEvidence(claim10);
  assert.equal(claim10.claim.winCount, 10);
});

test('Familia B: primer partido de la historia y primera victoria coinciden en el debut', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assertClaimHasRealEvidence(findClaim(claims, 'primer_partido_de_la_historia'));
  assertClaimHasRealEvidence(findClaim(claims, 'primera_victoria_registrada'));
});

/* ------------------------------------------------------------------ */
/* Familia C — forma reciente, evidencia sin juicio de materialidad     */
/* ------------------------------------------------------------------ */

test('Familia C: forma reciente expone balance actual y de la ventana anterior sin afirmar "mejoró"', () => {
  // 2 derrotas, luego 5 victorias: ventana actual 5-0, ventana anterior (las 2 previas) 0-2.
  const rows = [
    row({ playedAt: dayIso(1), sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(2), sets: straightSetsLoss('A') }),
    ...[3, 4, 5, 6, 7].map((d) => row({ playedAt: dayIso(d), sets: straightSetsWin('A') })),
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const form = findClaim(claims, 'forma_reciente');
  assertClaimHasRealEvidence(form);
  assert.equal(form.claim.current.wins, 5);
  assert.equal(form.claim.current.losses, 0);
  assert.equal(form.claim.previousWindow.wins, 0);
  assert.equal(form.claim.previousWindow.losses, 2);
  assert.equal(typeof form.claim.current, 'object');
});

/* ------------------------------------------------------------------ */
/* Familia D — compañeros (§5.4)                                        */
/* ------------------------------------------------------------------ */

test('Familia D: primer partido juntos y primera victoria juntos son evidencia independiente (ambas ciertas si el debut se gana)', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), team1: PARTNER, sets: straightSetsWin('A') })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assertClaimHasRealEvidence(findClaim(claims, 'companero_primer_partido_juntos'));
  assertClaimHasRealEvidence(findClaim(claims, 'companero_primera_victoria_juntos'));
});

test('Familia D: primera victoria juntos también aparece sola cuando NO es el primer partido juntos', () => {
  const rows = [
    row({ playedAt: dayIso(1), team1: PARTNER, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(2), team1: PARTNER, sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assert.equal(findClaim(claims, 'companero_primer_partido_juntos'), null);
  assertClaimHasRealEvidence(findClaim(claims, 'companero_primera_victoria_juntos'));
});

test('Familia D: balance con compañero se descarta explícitamente por debajo de 4 partidos, se afirma desde 4', () => {
  const rows3 = [1, 2, 3].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history3 = IC.buildPersonalHistory(rows3);
  const { claims: claims3 } = CL.buildClaimsForMatch(history3, ME);
  const discarded = claims3.find((c) => c.insightType === 'companero_balance' && c.discarded);
  assert.ok(discarded);
  assert.equal(discarded.discardReasonCodes.length, 1);
  assert.equal(discarded.discardReasonCodes[0], 'muestra_insuficiente_para_companero_habitual');

  const rows4 = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A') }));
  const history4 = IC.buildPersonalHistory(rows4);
  const { claims: claims4 } = CL.buildClaimsForMatch(history4, ME);
  const balance = findClaim(claims4, 'companero_balance');
  assertClaimHasRealEvidence(balance);
  assert.equal(balance.claim.wins, 4);
  assert.equal(balance.confidenceTier, 'habitual');
});

test('Familia D: mejor balance entre compañeros compara solo a los que tienen al menos 5 partidos cada uno', () => {
  const rows = [];
  // Con PARTNER: 5 partidos, 5 victorias (100%).
  for (let i = 0; i < 5; i++) rows.push(row({ playedAt: dayIso(1 + i), team1: PARTNER, sets: straightSetsWin('A') }));
  // Con PARTNER_2: 5 partidos, 2 victorias (40%).
  for (let i = 0; i < 5; i++) rows.push(row({ playedAt: dayIso(10 + i), team1: PARTNER_2, sets: i < 2 ? straightSetsWin('A') : straightSetsLoss('A') }));
  // Con un tercer compañero, solo 3 partidos (no comparable, no debe ni entrar a la comparación).
  const RIVAL_5 = '88888888-8888-8888-8888-888888888888';
  for (let i = 0; i < 3; i++) rows.push(row({ playedAt: dayIso(20 + i), team1: RIVAL_5, sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const best = findClaim(claims, 'companero_mejor_balance');
  assertClaimHasRealEvidence(best);
  assert.equal(best.claim.companionPlayerId, PARTNER);
  assert.equal(best.claim.comparedAgainst, 2); // PARTNER y PARTNER_2, nunca el de 3 partidos
});

/* ------------------------------------------------------------------ */
/* Familia E — rivales, pareja rival exacta y cruce exacto (§5.5)       */
/* ------------------------------------------------------------------ */

test('Familia E: rival individual habitual desde 3, tendencia desde 4', () => {
  const rows3 = [1, 2, 3].map((d) => row({ playedAt: dayIso(d), rivalA: RIVAL_1, rivalB: RIVAL_3, sets: straightSetsLoss('A') }));
  const history3 = IC.buildPersonalHistory(rows3);
  const { claims: claims3 } = CL.buildClaimsForMatch(history3, ME);
  const rivalClaim3 = claims3.find((c) => c.insightType === 'rival_balance' && c.claim.scopeKey === RIVAL_1);
  assertClaimHasRealEvidence(rivalClaim3);
  assert.equal(rivalClaim3.confidenceTier, 'habitual');

  const rows4 = rows3.concat([row({ playedAt: dayIso(4), rivalA: RIVAL_1, rivalB: RIVAL_4, sets: straightSetsLoss('A') })]);
  const history4 = IC.buildPersonalHistory(rows4);
  const { claims: claims4 } = CL.buildClaimsForMatch(history4, ME);
  const rivalClaim4 = claims4.find((c) => c.insightType === 'rival_balance' && c.claim.scopeKey === RIVAL_1);
  assert.equal(rivalClaim4.confidenceTier, 'tendencia');
});

test('Familia E: primer triunfo tras al menos 2 derrotas previas frente al mismo rival', () => {
  const rows = [
    row({ playedAt: dayIso(1), rivalA: RIVAL_1, rivalB: RIVAL_3, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(2), rivalA: RIVAL_1, rivalB: RIVAL_4, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(3), rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const claim = claims.find((c) => c.insightType === 'rival_primer_triunfo_tras_derrotas' && c.claim.scopeKey === RIVAL_1);
  assertClaimHasRealEvidence(claim);
  assert.equal(claim.claim.priorLosses, 2);
});

test('Familia E: pareja rival exacta no se confunde con enfrentar solo a uno de sus integrantes', () => {
  const rows = [
    row({ playedAt: dayIso(1), rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(2), rivalA: RIVAL_1, rivalB: RIVAL_3, sets: straightSetsWin('A') }),
    row({ playedAt: dayIso(3), rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  // buildClaimsForMatch evalúa un partido puntual (el último de la historia truncada) — para
  // confirmar "primer encuentro" hay que evaluar cada prefijo, no solo el estado final.
  const day1 = CL.buildClaimsForMatch(history.slice(0, 1), ME);
  const day2 = CL.buildClaimsForMatch(history.slice(0, 2), ME);
  const day3 = CL.buildClaimsForMatch(history.slice(0, 3), ME);
  // Día 1: primer encuentro real contra la pareja exacta RIVAL_1+RIVAL_2.
  assertClaimHasRealEvidence(findClaim(day1.claims, 'pareja_rival_primer_enfrentamiento'));
  // Día 2: rival distinto (RIVAL_1+RIVAL_3) — nunca se confunde con la pareja del día 1.
  assertClaimHasRealEvidence(findClaim(day2.claims, 'pareja_rival_primer_enfrentamiento'));
  // Día 3: MISMA pareja exacta que el día 1 — ya no es "primer encuentro", es el segundo.
  assert.equal(findClaim(day3.claims, 'pareja_rival_primer_enfrentamiento'), null);
});

test('Familia E: cruce exacto de parejas es mostrable desde el 2do antecedente, con tendencia desde el 4to', () => {
  const rows2 = [1, 2].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }));
  const history2 = IC.buildPersonalHistory(rows2);
  const { claims: claims2 } = CL.buildClaimsForMatch(history2, ME);
  const crossing2 = findClaim(claims2, 'cruce_exacto_balance');
  assertClaimHasRealEvidence(crossing2);
  assert.equal(crossing2.confidenceTier, 'habitual'); // mostrable, todavía sin lenguaje de tendencia

  const rows4 = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsWin('A') }));
  const history4 = IC.buildPersonalHistory(rows4);
  const { claims: claims4 } = CL.buildClaimsForMatch(history4, ME);
  assert.equal(findClaim(claims4, 'cruce_exacto_balance').confidenceTier, 'tendencia');
});

/* ------------------------------------------------------------------ */
/* Familia F — patrón histórico de score (§5.6, detector 8)             */
/* ------------------------------------------------------------------ */

test('Familia F: score excepcional de formato comparable exige al menos 10 partidos y detecta el más ajustado', () => {
  const rows = [];
  // 9 partidos con margen amplio (6-1,6-1 => marginNormalized alto).
  for (let i = 0; i < 9; i++) rows.push(row({ playedAt: dayIso(1 + i), sets: [[6, 1], [6, 1]] }));
  const history9 = IC.buildPersonalHistory(rows);
  const { claims: claims9 } = CL.buildClaimsForMatch(history9, ME);
  const discarded9 = claims9.find((c) => c.insightType === 'score_excepcional_formato_comparable' && c.discarded);
  assert.ok(discarded9);

  // 10mo partido, mucho más ajustado (6-4,4-6,7-6) => debería ser el mínimo margen de la muestra.
  rows.push(row({ playedAt: dayIso(10), sets: [[6, 4], [4, 6], [7, 6]] }));
  const history10 = IC.buildPersonalHistory(rows);
  const { claims: claims10 } = CL.buildClaimsForMatch(history10, ME);
  const extreme = claims10.find((c) => c.insightType === 'score_excepcional_formato_comparable' && !c.discarded);
  assertClaimHasRealEvidence(extreme);
  assert.equal(extreme.claim.extreme, 'mas_ajustado');
  assert.equal(extreme.sampleSize, 10);
});

test('Familia F: balance histórico perdiendo el primer set, solo cuando el partido actual también lo perdió', () => {
  const rows = [
    row({ playedAt: dayIso(1), sets: [[4, 6], [6, 3], [6, 4]] }), // perdió el 1ro, ganó el partido
    row({ playedAt: dayIso(2), sets: [[4, 6], [3, 6]] }), // perdió el 1ro, perdió el partido
    row({ playedAt: dayIso(3), sets: [[4, 6], [6, 3], [6, 4]] }), // perdió el 1ro otra vez, ganó
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const claim = findClaim(claims, 'balance_perdiendo_primer_set');
  assertClaimHasRealEvidence(claim);
  assert.equal(claim.claim.wins, 2);
  assert.equal(claim.claim.losses, 1);
  assert.equal(claim.sampleSize, 3);
});

test('Familia F: si el partido actual NO perdió el primer set, no aparece el claim de balance perdiendo el primer set', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), sets: straightSetsWin('A') })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assert.equal(findClaim(claims, 'balance_perdiendo_primer_set'), null);
});

/* ------------------------------------------------------------------ */
/* Familia G — contexto sin Nivel BRAMU (§5.7)                          */
/* ------------------------------------------------------------------ */

test('Familia G: compañero nuevo', () => {
  const history = IC.buildPersonalHistory([row({ playedAt: dayIso(1), team1: PARTNER, sets: straightSetsWin('A') })]);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assertClaimHasRealEvidence(findClaim(claims, 'contexto_companero_nuevo'));
});

test('Familia G: dificultad previa — rival al que nunca se le había ganado, la evidencia es SOLO la previa (nunca incluye el partido actual)', () => {
  const rows = [
    row({ playedAt: dayIso(1), rivalA: RIVAL_1, rivalB: RIVAL_2, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(2), rivalA: RIVAL_1, rivalB: RIVAL_3, sets: straightSetsLoss('A') }),
    row({ playedAt: dayIso(3), rivalA: RIVAL_1, rivalB: RIVAL_4, sets: straightSetsWin('A') }),
  ];
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const claim = claims.find((c) => c.insightType === 'contexto_dificultad_previa_rival' && c.claim.rivalPlayerId === RIVAL_1);
  assertClaimHasRealEvidence(claim);
  assert.equal(claim.claim.neverWonBefore, true);
  assert.equal(claim.claim.priorWins, 0);
  assert.equal(claim.claim.priorLosses, 2);
  assert.equal(claim.evidenceMatchIds.includes(history[2].matchId), false);
});

test('Familia G: regreso tras inactividad excepcional', () => {
  const rows = [];
  for (let i = 0; i < 7; i++) rows.push(row({ playedAt: dayIso(1 + i * 3), sets: straightSetsWin('A') }));
  rows.push(row({ playedAt: dayIso(1 + 6 * 3 + 45), sets: straightSetsWin('A') }));
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  assertClaimHasRealEvidence(findClaim(claims, 'contexto_regreso_tras_inactividad'));
});

/* ------------------------------------------------------------------ */
/* officialScope — separación historia personal vs. oficial             */
/* ------------------------------------------------------------------ */

test('officialScope distingue personal/oficial/mixto según officialEligible real de cada partido fuente', () => {
  const rowsOficiales = [1, 2, 3, 4].map((d) => row({ playedAt: dayIso(d), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: true }));
  const historyOficial = IC.buildPersonalHistory(rowsOficiales);
  const balanceOficial = findClaim(CL.buildClaimsForMatch(historyOficial, ME).claims, 'companero_balance');
  assert.equal(balanceOficial.officialScope, 'oficial');

  const rowsMixtas = [
    row({ playedAt: dayIso(1), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: true }),
    row({ playedAt: dayIso(2), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: false }),
    row({ playedAt: dayIso(3), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: true }),
    row({ playedAt: dayIso(4), team1: PARTNER, sets: straightSetsWin('A'), officialEligible: false }),
  ];
  const historyMixta = IC.buildPersonalHistory(rowsMixtas);
  const balanceMixto = findClaim(CL.buildClaimsForMatch(historyMixta, ME).claims, 'companero_balance');
  assert.equal(balanceMixto.officialScope, 'mixto');
});

/* ------------------------------------------------------------------ */
/* playedAtTimeKnown — nunca se usa como evidencia narrativa de orden    */
/* (nota no bloqueante de 05_Validacion_Central_Fase_A_Staging.md §4)    */
/* ------------------------------------------------------------------ */

test('un partido con playedAtTimeKnown=false sigue produciendo claims válidos por FECHA (nunca por hora exacta)', () => {
  const rows = [
    row({ playedAt: dayIso(1), sets: straightSetsWin('A') }),
    row({ playedAt: dayIso(2), sets: straightSetsWin('A') }),
    row({ playedAt: dayIso(3), sets: straightSetsWin('A') }),
  ];
  rows[2].played_at_time_known = false; // hora desconocida, pero la FECHA sigue siendo real y distinta
  const history = IC.buildPersonalHistory(rows);
  const { claims } = CL.buildClaimsForMatch(history, ME);
  const streak = findClaim(claims, 'racha_de_victorias');
  assertClaimHasRealEvidence(streak);
  assert.equal(streak.claim.length, 3); // el orden por fecha sigue siendo correcto y determinista
});
