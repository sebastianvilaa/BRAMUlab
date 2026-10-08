// BRAMUlab — Auditoría de Nivel/Ranking · núcleo de simulación (SOLO LECTURA del código operativo).
//
// Carga el motor REAL de `bramulab/` (engine.js, level.js, level-context.js, level-calibration.js,
// match-level-engine.js) dentro de un contexto `vm` aislado, exactamente como lo hacen los tests del
// repo. Nunca escribe en `bramulab/`, `supabase/` ni toca red/datos reales.
//
// Qué es REAL en esta simulación (código operativo, sin copiar fórmulas):
//   - estimador inicial del cuestionario  -> PLLevelCalibration.computeInitialEstimateV13
//   - elegibilidad / repetición / círculo -> PLLevelContext (vía PLMatchLevelEngine)
//   - motor de partido y confiabilidad    -> PLLevel.computeMatchUpdate
//   - delta aplicado a level_states       -> PLMatchLevelEngine.computeLevelStateUpdates
//   - inactividad                         -> PLMatchLevelEngine.buildPlayerStatesDict
//
// Qué es MODELO SIMPLIFICADO (hipótesis del experimento, no del producto):
//   - la "capacidad deportiva" θ de cada jugador y el generador de resultados (juego a juego);
//   - el comportamiento de quien responde el cuestionario (θ + sesgo + ruido -> posiciones del slider);
//   - la regla de transición CALIBRANDO->CALIBRADO (replica la SQL: >=5 partidos y >=3 rivales
//     distintos), el reloj (un partido cada tanto) y el muestreo de quién juega con quién.
//
// Modos del orquestador (cómo se arma `playerStates`):
//   'real'    -> como hace hoy supabase/functions/_shared/match-officialize-core.ts: SOLO los 4
//                participantes del partido actual (knownParticipantIds).
//   'fullDict'-> contrafactual: se pasa el estado de TODOS los jugadores conocidos (es lo que la
//                detección de círculo cerrado de level-context.js parece asumir).
// Variante de motor 'noCircle': desactiva en memoria la detección de círculo (CIRCLE_MIN_MATCHES=1e9).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '../../../../bramulab');
const DAY_MS = 86400000;

/* ------------------------------ carga del motor real ------------------------------ */
export function loadEngine({ noCircle = false } = {}) {
  const sandbox = {};
  vm.createContext(sandbox);
  for (const rel of ['engine.js', 'level.js', 'level-context.js', 'level-calibration.js', 'match-level-engine.js']) {
    let code = fs.readFileSync(path.join(APP_DIR, rel), 'utf8');
    if (noCircle && rel === 'level-context.js') {
      const before = code;
      code = code.replace('const CIRCLE_MIN_MATCHES = 20;', 'const CIRCLE_MIN_MATCHES = 1e9;');
      if (code === before) throw new Error('No se pudo aplicar la variante noCircle: texto no encontrado');
    }
    vm.runInContext(code, sandbox, { filename: rel });
  }
  return {
    Level: sandbox.PLLevel,
    Ctx: sandbox.PLLevelContext,
    Cal: sandbox.PLLevelCalibration,
    MLE: sandbox.PLMatchLevelEngine,
  };
}

/* ------------------------------ aleatoriedad reproducible ------------------------------ */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    let u = 0; let v = 0;
    while (u === 0) u = next();
    v = next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };
  const shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, normal, shuffle };
}

/* ------------------------------ modelo de resultados (hipótesis) ------------------------------ */
// Juego a juego: p_game = 1/(1+10^(-d/sg)); d = diferencia de capacidad media entre parejas.
// Set a 6 (7-5, 7-6: el tie-break se modela como un juego más con la misma p). Mejor de 3.
function setWinProb(p) {
  // P(ganar el set) para p = prob. de ganar cada juego.
  const memo = new Map();
  const f = (a, b) => {
    if (a >= 6 && a - b >= 2) return 1;
    if (b >= 6 && b - a >= 2) return 0;
    if (a === 7) return 1; // 7-6
    if (b === 7) return 0;
    const k = a * 10 + b;
    if (memo.has(k)) return memo.get(k);
    const v = p * f(a + 1, b) + (1 - p) * f(a, b + 1);
    memo.set(k, v);
    return v;
  };
  return f(0, 0);
}
export function matchWinProbFromGameProb(p) {
  const s = setWinProb(p);
  return s * s * (3 - 2 * s);
}
/** Busca sg tal que la prob. de ganar el partido con diferencia 1.0 sea `target`. */
export function calibrateGameScale(targetMatchProbAtDiff1) {
  let lo = 0.05; let hi = 20;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const pg = 1 / (1 + Math.pow(10, -1 / mid));
    const pm = matchWinProbFromGameProb(pg);
    if (pm > targetMatchProbAtDiff1) lo = mid; else hi = mid; // sg mayor -> menos prob.
  }
  return (lo + hi) / 2;
}
export function matchWinProb(diff, sg) {
  return matchWinProbFromGameProb(1 / (1 + Math.pow(10, -diff / sg)));
}

function simulateSet(pGameA, rng) {
  let a = 0; let b = 0;
  for (;;) {
    if (rng.next() < pGameA) a += 1; else b += 1;
    if (a >= 6 && a - b >= 2) return { gamesA: a, gamesB: b, winner: 'A' };
    if (b >= 6 && b - a >= 2) return { gamesA: a, gamesB: b, winner: 'B' };
    if (a === 7) return { gamesA: 7, gamesB: 6, winner: 'A', tiebreak: { a: 7, b: 5, mode: 'standard' } };
    if (b === 7) return { gamesA: 6, gamesB: 7, winner: 'B', tiebreak: { a: 5, b: 7, mode: 'standard' } };
  }
}
export function simulateMatchScore(diffAminusB, sg, rng) {
  const pg = 1 / (1 + Math.pow(10, -diffAminusB / sg));
  const sets = [];
  let wa = 0; let wb = 0;
  while (wa < 2 && wb < 2) {
    const s = simulateSet(pg, rng);
    sets.push(s);
    if (s.winner === 'A') wa += 1; else wb += 1;
  }
  return { sets, winnerTeam: wa > wb ? 'A' : 'B' };
}

/* ------------------------------ cuestionario (uso del estimador REAL) ------------------------------ */
/** Un jugador con "percepción de su nivel" `perceived` responde las 5 preguntas: en cada una elige
 *  la posición del slider (0..9) cuyo valor interpolado REAL queda más cerca de
 *  perceived + ruido_pregunta, respetando la adaptatividad real (rama según la media acumulada). */
export function answerQuestionnaire(Cal, perceived, sigmaQ, rng) {
  const positions = [];
  let sum = 0;
  for (let k = 0; k < Cal.QUESTION_IDS.length; k += 1) {
    const branch = k === 0 ? 'common' : Cal.branchForRunningMean(sum / k);
    const anchors = Cal.ANCHORS[Cal.QUESTION_IDS[k]][branch];
    const target = perceived + (sigmaQ > 0 ? rng.normal() * sigmaQ : 0);
    let bestP = 0; let bestD = Infinity;
    for (let p = 0; p <= 9; p += 1) {
      const d = Math.abs(Cal.interpolateAnchor(anchors, p) - target);
      if (d < bestD - 1e-12) { bestD = d; bestP = p; }
    }
    positions.push(bestP);
    sum += Cal.interpolateAnchor(anchors, bestP);
  }
  const est = Cal.computeInitialEstimateV13(positions);
  return { initialLevel: est.initialLevel, originConfidence: est.originConfidence, spread: est.spread, positions };
}

/* ------------------------------ mundo simulado ------------------------------ */
export function createWorld({ mode = 'real', noCircle = false, startIso = '2026-01-05T12:00:00.000Z' } = {}) {
  const eng = loadEngine({ noCircle });
  const { Level, MLE } = eng;
  const players = new Map(); // id -> estado
  const historyByPlayer = new Map(); // id -> [localMatch]
  const t0 = new Date(startIso).getTime();
  let matchSeq = 0;
  const stats = { matches: 0, ineligible: 0, circleHits: 0, circleEvals: 0, outsideWindow: 0 };

  function addPlayer({ id, theta, initialLevel, originConfidence, group, meta }) {
    players.set(id, {
      id, theta, group: group || null, meta: meta || {},
      mu: initialLevel, mu0: initialLevel, confidence: originConfidence, evidence: 0,
      status: 'CALIBRANDO', rated: 0, rivals: new Set(), lastRatedAt: new Date(t0).toISOString(),
      matchesPlayed: 0,
    });
    historyByPlayer.set(id, []);
  }

  function historyFor(ids, nowMs) {
    const seen = new Set(); const out = [];
    const cutoff = nowMs - 181 * DAY_MS;
    ids.forEach((id) => {
      (historyByPlayer.get(id) || []).forEach((m) => {
        if (seen.has(m.matchId)) return;
        if (new Date(m.playedAt).getTime() < cutoff) return;
        seen.add(m.matchId); out.push(m);
      });
    });
    return out;
  }

  /** Juega UN partido entre 4 ids (A=[0,1], B=[2,3]) en el instante `tMs`. `score` = {sets, winnerTeam}. */
  function playMatch(ids, tMs, score) {
    const playedAt = new Date(tMs).toISOString();
    matchSeq += 1;
    const matchId = 'm' + matchSeq;
    const localMatch = {
      matchId, formatId: 'classic', regulationCompleted: true, playedAt,
      winnerTeam: score.winnerTeam, sets: score.sets,
      players: ids.map((id, i) => ({ id: 'p' + i, name: id, userId: id, team: i < 2 ? 'A' : 'B' })),
    };
    const rowsFor = (list) => list.map((id) => {
      const p = players.get(id);
      return { playerId: id, mu: p.mu, confidence: p.confidence, status: p.status, lastRatedAt: p.lastRatedAt };
    });
    const dictIds = mode === 'fullDict' ? Array.from(players.keys()) : ids;
    const playerStates = MLE.buildPlayerStatesDict(rowsFor(dictIds), playedAt);
    const history = historyFor(ids, tMs);
    const validatedAtIso = new Date(tMs + DAY_MS).toISOString();
    const res = MLE.computeOfficializationResult({ localMatch, history, playerStates, validatedAtIso });
    stats.matches += 1;
    if (!res.eligible) { stats.ineligible += 1; return res; }

    const current = {};
    ids.forEach((id) => {
      const p = players.get(id);
      current[id] = { mu: p.mu, confidence: p.confidence, evidenceUnits: p.evidence, lastRatedAt: p.lastRatedAt };
    });
    const upd = MLE.computeLevelStateUpdates({
      oldAppliedResult: null, engineOutput: res.engineOutput,
      guestPlayerIds: res.guestPlayerIds, currentLevelStatesByPlayerId: current,
    });
    Object.keys(res.engineOutput.players).forEach((id) => {
      if (res.engineOutput.players[id].circleFactor < 1) stats.circleHits += 1;
      stats.circleEvals += 1;
    });
    upd.levelStateUpdates.forEach((u) => {
      const p = players.get(u.playerId);
      p.mu = u.finalMu; p.confidence = u.finalConfidence; p.evidence = u.finalEvidenceUnits;
      p.lastRatedAt = playedAt; p.rated += 1; p.matchesPlayed += 1;
      const myTeamIdx = ids.indexOf(u.playerId) < 2 ? [2, 3] : [0, 1];
      myTeamIdx.forEach((i) => p.rivals.add(ids[i]));
      p.status = (p.rated >= 5 && p.rivals.size >= 3) ? 'CALIBRADO' : 'CALIBRANDO';
    });
    ids.forEach((id) => historyByPlayer.get(id).push(localMatch));
    return res;
  }

  return { eng, players, stats, t0, addPlayer, playMatch, DAY_MS };
}

/* ------------------------------ métricas ------------------------------ */
export const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
export const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };

function ranks(values) {
  const idx = values.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(values.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
export function pearson(x, y) {
  const mx = mean(x); const my = mean(y);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < x.length; i += 1) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
export const spearman = (x, y) => pearson(ranks(x), ranks(y));

/** Métricas de un conjunto de jugadores (un grupo o una población). */
export function groupMetrics(list) {
  const mu = list.map((p) => p.mu); const th = list.map((p) => p.theta);
  const mm = mean(mu); const mt = mean(th);
  const centeredErr = list.map((p) => (p.mu - mm) - (p.theta - mt));
  return {
    n: list.length,
    meanBias: mm - mt, // nivel medio calculado − capacidad media simulada
    relRmse: Math.sqrt(mean(centeredErr.map((e) => e * e))), // error de orden relativo dentro del grupo
    spearman: spearman(mu, th),
    meanConf: mean(list.map((p) => p.confidence)),
    shareCalibrated: list.filter((p) => p.status === 'CALIBRADO').length / list.length,
    sdMu: sd(mu), sdTheta: sd(th),
  };
}

/** Rankea por mu desc (ranking de competición, igual que la SQL `rank() ... order by level_internal desc`). */
export function rankByMu(list) {
  const sorted = list.slice().sort((a, b) => b.mu - a.mu);
  const pos = new Map();
  sorted.forEach((p, i) => { pos.set(p.id, (i > 0 && sorted[i - 1].mu === p.mu) ? pos.get(sorted[i - 1].id) : i + 1); });
  return pos;
}
