// 03 — Escenario F: impacto en posiciones de Ranking al reunir jugadores de varias localidades.
//   Salida: resultados/03-ranking.json
//   Provincia: L localidades de n jugadores, TODAS con la misma distribución de capacidad real (θ ~ N(5,5; 1,0)).
//   Cada localidad tiene un sesgo compartido de cuestionario β_loc ~ N(0, σ_loc) (hipótesis, se barre σ_loc).
//   Fracción f de partidos "mezclados" entre localidades (0 = islas).
//   Ranking = orden por Nivel interno entre CALIBRADOS (igual que la SQL: rank() over (... order by level_internal desc)).
//   "Verdad" = orden por capacidad simulada θ (hipótesis del experimento).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, Sim, spawn, aggregate, mean } from './scenario-lib.mjs';
import { spearman, rankByMu } from './sim-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const REPS = Number(process.env.REPS || 30);
const CHECKS = [10, 30, 50];

function rankMetrics(all, topK) {
  const calibrated = all.filter((p) => p.status === 'CALIBRADO');
  const byMu = calibrated.slice().sort((a, b) => b.mu - a.mu);
  const byTh = calibrated.slice().sort((a, b) => b.theta - a.theta);
  const posMu = new Map(byMu.map((p, i) => [p.id, i + 1]));
  const posTh = new Map(byTh.map((p, i) => [p.id, i + 1]));
  const disp = calibrated.map((p) => Math.abs(posMu.get(p.id) - posTh.get(p.id)));
  const topObs = new Set(byMu.slice(0, topK).map((p) => p.id));
  const topTrue = new Set(byTh.slice(0, topK).map((p) => p.id));
  let overlap = 0; topObs.forEach((id) => { if (topTrue.has(id)) overlap += 1; });
  // pares de localidades distintas cuya capacidad real difiere >= 1,0: ¿el Nivel los ordena bien?
  let pairs = 0; let wrong = 0;
  for (let i = 0; i < calibrated.length; i += 1) {
    for (let j = i + 1; j < calibrated.length; j += 1) {
      const a = calibrated[i]; const b = calibrated[j];
      if (a.group === b.group) continue;
      if (Math.abs(a.theta - b.theta) < 1.0) continue;
      pairs += 1;
      if ((a.theta - b.theta) * (a.mu - b.mu) < 0) wrong += 1;
    }
  }
  // mayor desplazamiento: jugador del top-K observado cuya posición real es la peor
  const worstInTop = byMu.slice(0, topK).reduce((w, p) => Math.max(w, posTh.get(p.id)), 0);
  return {
    nRanked: calibrated.length,
    spearman: spearman(calibrated.map((p) => p.mu), calibrated.map((p) => p.theta)),
    meanAbsRankShift: mean(disp),
    p90AbsRankShift: disp.slice().sort((a, b) => a - b)[Math.floor(disp.length * 0.9)],
    topKOverlap: overlap / topK,
    wrongCrossPairs: pairs ? wrong / pairs : NaN,
    worstTrueRankInObservedTop: worstInTop,
  };
}

function run({ L, n, sigmaLoc, f, mode = 'real', seed, topK }) {
  const rng = makeRng(seed);
  const world = createWorld({ mode });
  const sim = new Sim(world, rng, {});
  const locs = [];
  for (let l = 0; l < L; l += 1) {
    const beta = rng.normal() * sigmaLoc;
    const ids = [];
    for (let i = 0; i < n; i += 1) { const id = `L${l}-${i}`; spawn(world, rng, { id, theta: 5.5 + rng.normal() * 1.0, beta, group: 'L' + l }); ids.push(id); }
    locs.push({ l, beta, ids, played: 0 });
  }
  const all = () => locs.flatMap((x) => x.ids.map((id) => world.players.get(id)));
  const allIds = locs.flatMap((x) => x.ids);
  const N = L * n;
  const out = [];
  let ci = 0; let guard = 0;
  while (ci < CHECKS.length && guard++ < 1e6) {
    if (f > 0 && rng.next() < f) {
      const four = rng.shuffle(allIds).slice(0, 4);
      sim.playFour(four, N);
      four.forEach((id) => { const lo = locs.find((x) => x.ids.includes(id)); lo.played += 1; });
    } else {
      const lo = locs.slice().sort((a, b) => a.played - b.played)[0];
      sim.playPool('loc' + lo.l, lo.ids, N); lo.played += 4;
    }
    const avg = Math.min.apply(null, locs.map((x) => x.played / x.ids.length));
    if (avg >= CHECKS[ci]) {
      const rm = rankMetrics(all(), topK);
      // sesgo medio de la localidad más sobrevalorada / más subvalorada
      const bias = locs.map((x) => mean(x.ids.map((id) => world.players.get(id).mu - world.players.get(id).theta)));
      rm.maxLocBias = Math.max.apply(null, bias); rm.minLocBias = Math.min.apply(null, bias);
      rm.sdLocBias = Math.sqrt(mean(bias.map((b) => (b - mean(bias)) ** 2)));
      // top-K observado: cuántos provienen de la localidad con mayor β real (sobrevalorada) vs. lo esperable (K/L)
      const hiLoc = locs.slice().sort((a, b) => b.beta - a.beta)[0];
      const topObs = all().filter((p) => p.status === 'CALIBRADO').sort((a, b) => b.mu - a.mu).slice(0, topK);
      rm.topKfromHighestBetaLoc = topObs.filter((p) => p.group === 'L' + hiLoc.l).length / topK;
      rm.expectedShare = 1 / L;
      // dentro de una localidad el orden local se mantiene
      rm.withinLocSpearman = mean(locs.map((x) => spearman(x.ids.map((id) => world.players.get(id).mu), x.ids.map((id) => world.players.get(id).theta))));
      out.push(Object.assign({ m: CHECKS[ci] }, rm));
      ci += 1;
    }
  }
  return out;
}

function many(label, opts, reps = REPS) {
  const per = [];
  for (let r = 0; r < reps; r += 1) per.push(run(Object.assign({ seed: 9000 + r }, opts)));
  const byCp = {};
  per[0].forEach((_, i) => { byCp[per[0][i].m] = aggregate(per.map((rows) => rows[i])); });
  console.log('OK', label);
  return { label, opts, reps, byCp };
}

const res = {};
[0, 0.3, 0.6, 1.0].forEach((s) => {
  res[`F_prov_6x24_sigma${s}_f0`] = many(`provincia 6x24 σ=${s} islas`, { L: 6, n: 24, sigmaLoc: s, f: 0, topK: 10 });
});
[0.02, 0.10].forEach((f) => {
  res[`F_prov_6x24_sigma0.6_f${f}`] = many(`provincia 6x24 σ=0.6 mezcla ${f}`, { L: 6, n: 24, sigmaLoc: 0.6, f, topK: 10 });
});
res['F_nacion_20x12_sigma0.6_f0'] = many('nación 20x12 σ=0.6 islas', { L: 20, n: 12, sigmaLoc: 0.6, f: 0, topK: 20 }, Math.max(10, Math.round(REPS / 2)));
res['F_nacion_20x12_sigma0.3_f0'] = many('nación 20x12 σ=0.3 islas', { L: 20, n: 12, sigmaLoc: 0.3, f: 0, topK: 20 }, Math.max(10, Math.round(REPS / 2)));
res['F_prov_6x24_sigma0.6_f0_fullDict'] = many('provincia 6x24 σ=0.6 islas (diccionario completo)', { L: 6, n: 24, sigmaLoc: 0.6, f: 0, mode: 'fullDict', topK: 10 }, Math.max(10, Math.round(REPS / 2)));

fs.writeFileSync(path.join(OUT, '03-ranking.json'), JSON.stringify({ reps: REPS, checkpoints: CHECKS, results: res }, null, 1));
console.log('listo 03');
