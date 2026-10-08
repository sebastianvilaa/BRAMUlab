// 00 — Validación del simulador y sondas estructurales. Salida: resultados/00-validacion.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, answerQuestionnaire, loadEngine, calibrateGameScale, matchWinProb } from './sim-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const out = {};

/* V1 — Anexo B de Nivel_BRAMU.md: casos de un solo partido con parejas con confiabilidad 0,79 (el Anexo B no la explicita; con 0,79 se reproducen sus cifras), CALIBRADO. */
{
  const { Level } = loadEngine();
  const run = (muA, muB, sets, winner = 'A') => {
    const mk = (id, mu) => ({ id, mu, confidence: 0.79, state: Level.STATES.CALIBRATED });
    const A1 = sets.filter((s) => s[0] > s[1]).length; const B1 = sets.length - A1;
    const r = Level.computeMatchUpdate({
      matchId: 'x',
      teamA: { players: [mk('a1', muA[0]), mk('a2', muA[1])], repetitionFactor: 1, companionFactor: 1, circleFactors: [false, false] },
      teamB: { players: [mk('b1', muB[0]), mk('b2', muB[1])], repetitionFactor: 1, companionFactor: 1, circleFactors: [false, false] },
      winnerTeam: winner,
      score: { setsWonByWinner: Math.max(A1, B1), setsPlayed: sets.length, gamesWonByWinner: sets.reduce((s, x) => s + x[0], 0), gamesTotal: sets.reduce((s, x) => s + x[0] + x[1], 0) },
      formatKey: 'bestOf3', knownLevelsCount: 4,
    });
    return { pA: r.expectation.A, dA: r.players.a1.deltaCapped, dB: r.players.b1.deltaCapped };
  };
  out.anexoB = {
    '5,0 vs 5,0 (6-4 6-4)  doc: P=50% +0,08': run([5, 5], [5, 5], [[6, 4], [6, 4]]),
    '5,0 vence a 6,0       doc: P=23% +0,12': run([5, 5], [6, 6], [[6, 4], [6, 4]]),
    '6,0 vence a 5,0       doc: P=77% +0,04': run([6, 6], [5, 5], [[6, 4], [6, 4]]),
    '4,5 vence a 6,5       doc: P=8%  +0,14': run([4.5, 4.5], [6.5, 6.5], [[6, 4], [6, 4]]),
  };
}

/* V2 — curva del cuestionario: percepción exacta del propio nivel (sin ruido) -> Nivel inicial. */
{
  const { Cal } = loadEngine();
  const rng = makeRng(1);
  out.cuestionarioCurva = [];
  for (let L = 1.5; L <= 9.01; L += 0.5) {
    const r = answerQuestionnaire(Cal, L, 0, rng);
    out.cuestionarioCurva.push({ percibido: L, nivelInicial: +r.initialLevel.toFixed(2), spread: r.spread, conf: r.originConfidence });
  }
}

/* V3 — sensibilidad del cuestionario al ruido de respuesta (qué parte del error es "ruido por pregunta"). */
{
  const { Cal } = loadEngine();
  out.cuestionarioRuido = [];
  [0, 0.5, 1.0, 1.5].forEach((sq) => {
    const rng = makeRng(77);
    const vals = [];
    for (let i = 0; i < 4000; i += 1) vals.push(answerQuestionnaire(Cal, 5.5, sq, rng).initialLevel);
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    const s = Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / (vals.length - 1));
    out.cuestionarioRuido.push({ sigmaPregunta: sq, mediaNivelInicial: +m.toFixed(3), sdNivelInicial: +s.toFixed(3) });
  });
}

/* V4 — sonda de detección de círculo cerrado en el orquestador REAL vs con diccionario completo. */
function probeCircle(mode, groupSize, matchesPerPlayer, seed) {
  const w = createWorld({ mode });
  const { Cal } = w.eng;
  const rng = makeRng(seed);
  const sg = calibrateGameScale(0.82);
  const ids = [];
  for (let i = 0; i < groupSize; i += 1) {
    const theta = 5.5 + (rng.normal() * 0.6);
    const q = answerQuestionnaire(Cal, theta, 0.5, rng);
    const id = 'g' + i; ids.push(id);
    w.addPlayer({ id, theta, initialLevel: q.initialLevel, originConfidence: q.originConfidence });
  }
  const total = Math.round(groupSize * matchesPerPlayer / 4);
  const dtMs = (7 * 86400000) / (groupSize / 4); // 1 partido/jugador/semana
  let queue = [];
  let hitsLate = 0; let evalsLate = 0;
  for (let k = 0; k < total; k += 1) {
    const four = [];
    while (four.length < 4) {
      if (!queue.length) queue = rng.shuffle(ids);
      const c = queue.shift(); if (!four.includes(c)) four.push(c);
    }
    const [a, b, c, d] = four;
    const sc = { sets: [{ gamesA: 6, gamesB: 3, winner: 'A' }, { gamesA: 6, gamesB: 3, winner: 'A' }], winnerTeam: 'A' };
    const before = { h: w.stats.circleHits, e: w.stats.circleEvals };
    w.playMatch([a, b, c, d], w.t0 + (k + 1) * dtMs, sc);
    if (k > total * 0.5) { hitsLate += w.stats.circleHits - before.h; evalsLate += w.stats.circleEvals - before.e; }
  }
  return { circleHits: w.stats.circleHits, circleEvals: w.stats.circleEvals, hitsSegundaMitad: hitsLate, evalsSegundaMitad: evalsLate };
}
function probeFixedFoursome(mode) {
  // Un quinto jugador rota en las primeras 12 partidas (así los 4 acumulan >=3 rivales distintos y
  // pasan a CALIBRADO); después los mismos 4 juegan 40 partidas seguidas entre sí.
  const w = createWorld({ mode });
  const { Cal } = w.eng; const rng = makeRng(5);
  const ids = ['f0', 'f1', 'f2', 'f3', 'f4'];
  ids.forEach((id) => { const q = answerQuestionnaire(Cal, 5.5, 0.3, rng); w.addPlayer({ id, theta: 5.5, initialLevel: q.initialLevel, originConfidence: q.originConfidence }); });
  const mk = (win) => ({ sets: [0, 1].map(() => (win === 'A' ? { gamesA: 6, gamesB: 4, winner: 'A' } : { gamesA: 4, gamesB: 6, winner: 'B' })), winnerTeam: win });
  let k = 0;
  const day = 86400000;
  for (let r = 0; r < 12; r += 1) {
    const four = rng.shuffle(ids).slice(0, 4);
    w.playMatch(four, w.t0 + (++k) * 3 * day, mk(rng.next() < 0.5 ? 'A' : 'B'));
  }
  const calibrated = ids.slice(0, 4).map((id) => w.players.get(id).status);
  const before = { h: w.stats.circleHits, e: w.stats.circleEvals };
  for (let r = 0; r < 40; r += 1) {
    w.playMatch(['f0', 'f1', 'f2', 'f3'], w.t0 + (++k) * 3 * day, mk(rng.next() < 0.5 ? 'A' : 'B'));
  }
  return { estadosTrasFaseRotativa: calibrated, circleHitsFaseFija: w.stats.circleHits - before.h, circleEvalsFaseFija: w.stats.circleEvals - before.e };
}
out.circuloSonda = {
  grupo12_40partidos_real: probeCircle('real', 12, 40, 11),
  grupo12_40partidos_diccionarioCompleto: probeCircle('fullDict', 12, 40, 11),
  grupo8_40partidos_real: probeCircle('real', 8, 40, 12),
  grupo8_40partidos_diccionarioCompleto: probeCircle('fullDict', 8, 40, 12),
  grupo24_40partidos_diccionarioCompleto: probeCircle('fullDict', 24, 40, 13),
  mismoCuarteto40partidos_real: probeFixedFoursome('real'),
  mismoCuarteto40partidos_diccionarioCompleto: probeFixedFoursome('fullDict'),
};

/* V5 — escala de resultados: prob. de ganar el partido según diferencia de capacidad (hipótesis "fiel al motor"). */
{
  const sg = calibrateGameScale(0.822);
  out.escalaResultados = { sg: +sg.toFixed(4), tabla: [0.25, 0.5, 1, 1.5, 2, 3].map((d) => ({ dif: d, pGana: +matchWinProb(d, sg).toFixed(3) })) };
}

fs.writeFileSync(path.join(OUT, '00-validacion.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
