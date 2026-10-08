// 01 — Grupos cerrados: escenarios A, B, C y E de la auditoría.  Salida: resultados/01-grupos-cerrados.json
//   A  mismo nivel real, cuestionarios sistemáticamente distintos (+1,0 / 0)
//   B  distinto nivel real, cuestionarios que producen niveles parecidos (−1,0 / +1,0 respecto de la capacidad)
//   C  grupos cerrados de distinto tamaño, 5/10/20/30/50 partidos por jugador (y sensibilidad)
//   E  desvíos INDIVIDUALES (sobre/subdeclarar) sin sesgo compartido, según tamaño del círculo
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, Sim, spawn, aggregate, mean, sd } from './scenario-lib.mjs';
import { groupMetrics, spearman } from './sim-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const REPS = Number(process.env.REPS || 30);
const CHECKS = [0, 5, 10, 20, 30, 50];

/** Ejecuta uno o varios grupos cerrados concurrentes y mide en cada checkpoint (partidos promedio por jugador). */
function runClosed({ groups, mode = 'real', noCircle = false, truthP1, rate = 1, seed, checkpoints = CHECKS, individualOnly = false }) {
  const rng = makeRng(seed);
  const world = createWorld({ mode, noCircle });
  const sim = new Sim(world, rng, { truthP1, ratePerWeek: rate });
  const pools = groups.map((g, gi) => {
    const ids = [];
    for (let i = 0; i < g.n; i += 1) {
      const id = `${g.name}-${i}`;
      const theta = g.thetaMean + rng.normal() * g.thetaSd;
      // sesgo compartido del grupo (+ desvío individual de una fracción, si se pide)
      let beta = g.beta || 0;
      if (g.indivDev) beta += rng.normal() * g.indivDev;
      spawn(world, rng, { id, theta, beta, group: g.name });
      ids.push(id);
    }
    return { name: g.name, ids, played: 0 };
  });
  const totalN = pools.reduce((s, p) => s + p.ids.length, 0);
  const snap = (m) => {
    const rec = { m };
    const lists = pools.map((p) => p.ids.map((id) => world.players.get(id)));
    lists.forEach((list, gi) => {
      const gm = groupMetrics(list);
      const tag = pools[gi].name;
      rec[`${tag}.bias`] = gm.meanBias; rec[`${tag}.relRmse`] = gm.relRmse; rec[`${tag}.spearman`] = gm.spearman;
      rec[`${tag}.conf`] = gm.meanConf; rec[`${tag}.calib`] = gm.shareCalibrated; rec[`${tag}.sdRatio`] = gm.sdMu / gm.sdTheta;
      rec[`${tag}.meanMu`] = mean(list.map((p) => p.mu)); rec[`${tag}.meanTheta`] = mean(list.map((p) => p.theta));
      rec[`${tag}.absErr`] = mean(list.map((p) => Math.abs(p.mu - p.theta))); // error absoluto individual vs capacidad
    });
    if (pools.length === 2) {
      const [a, b] = lists;
      rec.muGap = mean(b.map((p) => p.mu)) - mean(a.map((p) => p.mu));
      rec.thetaGap = mean(b.map((p) => p.theta)) - mean(a.map((p) => p.theta));
      rec.gapError = rec.muGap - rec.thetaGap; // distorsión de la brecha que vería un Ranking que junta a ambos
      let invObs = 0; let invTrue = 0; let pairs = 0;
      a.forEach((x) => b.forEach((y) => { pairs += 1; if (x.mu > y.mu) invObs += 1; if (x.theta > y.theta) invTrue += 1; }));
      rec.pairsAoverB_obs = invObs / pairs; rec.pairsAoverB_true = invTrue / pairs;
      const all = a.concat(b);
      rec.spearmanMerged = spearman(all.map((p) => p.mu), all.map((p) => p.theta));
      const top = all.slice().sort((p, q) => q.mu - p.mu).slice(0, Math.round(all.length / 4));
      const topT = all.slice().sort((p, q) => q.theta - p.theta).slice(0, Math.round(all.length / 4));
      rec.topQuartileFromA_obs = top.filter((p) => p.group === pools[0].name).length / top.length;
      rec.topQuartileFromA_true = topT.filter((p) => p.group === pools[0].name).length / topT.length;
    }
    return rec;
  };
  const out = [];
  const cp = checkpoints.slice();
  out.push(snap(0)); cp.shift();
  let nextCp = cp.shift();
  const maxM = checkpoints[checkpoints.length - 1];
  while (nextCp !== undefined) {
    // el grupo que menos jugó por jugador juega el próximo partido (reparte equitativamente)
    const p = pools.slice().sort((x, y) => (x.played / x.ids.length) - (y.played / y.ids.length))[0];
    sim.playPool(p.name, p.ids, totalN);
    p.played += 4;
    const minAvg = Math.min.apply(null, pools.map((q) => q.played / q.ids.length));
    if (minAvg >= nextCp) { out.push(snap(nextCp)); nextCp = cp.shift(); }
    if (minAvg > maxM + 5) break;
  }
  // factores de repetición/compañero medios (peso residual del partido) por tramo
  const buckets = {};
  sim.log.forEach((r) => { const b = CHECKS.find((c) => r.nPlayersDone < c) || 50; (buckets[b] = buckets[b] || []).push(r); });
  const weights = {};
  Object.keys(buckets).forEach((b) => { weights[b] = { rep: mean(buckets[b].map((r) => r.rep)), comp: mean(buckets[b].map((r) => r.comp)) }; });
  return { rows: out, weights, circleHits: world.stats.circleHits, circleEvals: world.stats.circleEvals, ineligible: world.stats.ineligible };
}

function runMany(label, cfgFn, reps = REPS) {
  const per = [];
  const weights = [];
  let circleHits = 0; let circleEvals = 0;
  for (let r = 0; r < reps; r += 1) {
    const res = runClosed(Object.assign({ seed: 1000 + r }, cfgFn(r)));
    per.push(res.rows); weights.push(res.weights); circleHits += res.circleHits; circleEvals += res.circleEvals;
  }
  const byCp = {};
  per[0].forEach((_, i) => {
    const m = per[0][i].m;
    byCp[m] = aggregate(per.map((rows) => rows[i]));
  });
  const wAgg = {};
  Object.keys(weights[0]).forEach((b) => {
    const vs = weights.map((w) => w[b]).filter(Boolean);
    wAgg[b] = { rep: +mean(vs.map((v) => v.rep)).toFixed(3), comp: +mean(vs.map((v) => v.comp)).toFixed(3) };
  });
  console.log('OK', label);
  return { label, reps, byCp, repetitionWeights: wAgg, circleShare: circleEvals ? circleHits / circleEvals : 0 };
}

const results = {};
const G = (name, n, thetaMean, thetaSd, beta, extra) => Object.assign({ name, n, thetaMean, thetaSd, beta }, extra || {});

/* ---------- A: mismo nivel real, cuestionarios distintos ---------- */
['real', 'fullDict'].forEach((mode) => {
  [0.5, 1.0, 1.5].forEach((b) => {
    results[`A_${mode}_beta${b}`] = runMany(`A ${mode} β=${b}`, () => ({ mode, groups: [G('G1', 16, 5.5, 0.9, 0), G('G2', 16, 5.5, 0.9, b)] }));
  });
});
results['A_noCircle_beta1.0'] = runMany('A noCircle β=1', () => ({ noCircle: true, groups: [G('G1', 16, 5.5, 0.9, 0), G('G2', 16, 5.5, 0.9, 1.0)] }));

/* ---------- B: distinta capacidad real, cuestionarios que igualan los niveles ---------- */
results['B_gap2.0'] = runMany('B gap 2.0', () => ({ groups: [G('G1', 16, 4.5, 0.8, +1.0), G('G2', 16, 6.5, 0.8, -1.0)] }));
results['B_gap1.0'] = runMany('B gap 1.0', () => ({ groups: [G('G1', 16, 5.0, 0.8, +0.5), G('G2', 16, 6.0, 0.8, -0.5)] }));
results['B_control_sinSesgo'] = runMany('B control (sin sesgo, brecha real 2.0 declarada bien)', () => ({ groups: [G('G1', 16, 4.5, 0.8, 0), G('G2', 16, 6.5, 0.8, 0)] }));

/* ---------- C: tamaño del círculo, un solo grupo con sesgo +1,0 y control sin sesgo ---------- */
[5, 8, 12, 16, 24, 48].forEach((n) => {
  results[`C_n${n}_beta1.0`] = runMany(`C n=${n} β=+1`, () => ({ groups: [G('G', n, 5.5, 0.9, 1.0)] }));
  results[`C_n${n}_beta0`] = runMany(`C n=${n} β=0`, () => ({ groups: [G('G', n, 5.5, 0.9, 0)] }));
});
results['C_n12_beta1.0_rate2'] = runMany('C n=12 β=+1, 2 partidos/semana', () => ({ rate: 2, groups: [G('G', 12, 5.5, 0.9, 1.0)] }));
results['C_n12_beta1.0_fullDict'] = runMany('C n=12 β=+1, diccionario completo', () => ({ mode: 'fullDict', groups: [G('G', 12, 5.5, 0.9, 1.0)] }));
results['C_n8_beta1.0_fullDict'] = runMany('C n=8 β=+1, diccionario completo', () => ({ mode: 'fullDict', groups: [G('G', 8, 5.5, 0.9, 1.0)] }));
results['C_n12_beta1.0_noCircle'] = runMany('C n=12 β=+1, sin círculo', () => ({ noCircle: true, groups: [G('G', 12, 5.5, 0.9, 1.0)] }));
[0.70, 0.92].forEach((p1) => {
  results[`C_n16_beta1.0_truthP${p1}`] = runMany(`C n=16 β=+1 escala real P(1,0)=${p1}`, () => ({ truthP1: p1, groups: [G('G', 16, 5.5, 0.9, 1.0)] }));
});

/* ---------- E: desvíos individuales (sin sesgo compartido), según tamaño del círculo ---------- */
[6, 12, 24, 48, 96].forEach((n) => {
  results[`E_n${n}`] = runMany(`E n=${n} desvíos individuales`, () => ({ groups: [G('G', n, 5.5, 1.0, 0, { indivDev: 0.9 })] }), Math.max(10, Math.round(REPS * (n <= 24 ? 1 : 0.5))));
});

fs.writeFileSync(path.join(OUT, '01-grupos-cerrados.json'), JSON.stringify({ reps: REPS, checkpoints: CHECKS, results }, null, 1));
console.log('listo 01');
