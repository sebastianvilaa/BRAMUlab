// 06 — Escenarios G y C2.  Salida: resultados/06-ingresantes-y-circulo.json
//   G : ingresantes "honestos" a un grupo veterano sesgado (¿adoptan la escala del grupo?) y ingresantes sobredeclarantes
//       a un grupo veterano bien anclado (¿se corrigen?).
//   C2: círculo cerrado HOMOGÉNEO (único caso en que la regla de §7.7 puede cumplir "amplitud ≤ 1,5"), con el
//       orquestador real, con diccionario completo y con la detección desactivada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, Sim, spawn, aggregate, mean } from './scenario-lib.mjs';
import { groupMetrics } from './sim-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const REPS = Number(process.env.REPS || 30);

/* ---------- G ---------- */
function runG({ vetBeta, newBeta, nVet = 12, nNew = 4, seed }) {
  const rng = makeRng(seed);
  const world = createWorld({});
  const sim = new Sim(world, rng, {});
  const vets = []; const news = [];
  for (let i = 0; i < nVet; i += 1) { const id = 'v' + i; spawn(world, rng, { id, theta: 5.5 + rng.normal() * 0.9, beta: vetBeta }); vets.push(id); }
  let played = 0;
  while (played / nVet < 30) { sim.playPool('v', vets, nVet); played += 4; }
  for (let i = 0; i < nNew; i += 1) { const id = 'n' + i; spawn(world, rng, { id, theta: 5.5 + rng.normal() * 0.9, beta: newBeta }); news.push(id); }
  const all = vets.concat(news);
  const bias = (ids) => mean(ids.map((id) => world.players.get(id).mu - world.players.get(id).theta));
  const cps = [0, 5, 10, 20, 30, 50, 100]; const out = [];
  out.push({ m: 0, biasNew: bias(news), biasVet: bias(vets) });
  let p2 = 0; let ci = 1;
  while (ci < cps.length) {
    sim.playPool('all', all, all.length); p2 += 4;
    if (p2 / all.length >= cps[ci]) { out.push({ m: cps[ci], biasNew: bias(news), biasVet: bias(vets) }); ci += 1; }
  }
  return out;
}
function manyG(label, opts) {
  const per = [];
  for (let r = 0; r < REPS; r += 1) per.push(runG(Object.assign({ seed: 3000 + r }, opts)));
  const byCp = {};
  per[0].forEach((_, i) => { byCp[per[0][i].m] = aggregate(per.map((rows) => rows[i])); });
  console.log('OK', label);
  return { label, opts, byCp };
}

/* ---------- C2 ---------- */
function runC2({ n, thetaSd, mode, noCircle, seed }) {
  const rng = makeRng(seed);
  const world = createWorld({ mode, noCircle });
  const sim = new Sim(world, rng, {});
  const ids = [];
  for (let i = 0; i < n; i += 1) { const id = 'g' + i; spawn(world, rng, { id, theta: 5.5 + rng.normal() * thetaSd, beta: 1.0 }); ids.push(id); }
  const list = () => ids.map((id) => world.players.get(id));
  const cps = [0, 20, 30, 50, 80]; const out = [];
  const snap = (m) => { const g = groupMetrics(list()); return { m, bias: g.meanBias, relRmse: g.relRmse, spearman: g.spearman, conf: g.meanConf, circleShare: world.stats.circleEvals ? world.stats.circleHits / world.stats.circleEvals : 0 }; };
  out.push(snap(0));
  let played = 0; let ci = 1;
  while (ci < cps.length) {
    sim.playPool('g', ids, n); played += 4;
    if (played / n >= cps[ci]) { out.push(snap(cps[ci])); ci += 1; }
  }
  return out;
}
function manyC2(label, opts) {
  const per = [];
  for (let r = 0; r < REPS; r += 1) per.push(runC2(Object.assign({ seed: 4000 + r }, opts)));
  const byCp = {};
  per[0].forEach((_, i) => { byCp[per[0][i].m] = aggregate(per.map((rows) => rows[i])); });
  console.log('OK', label);
  return { label, opts, byCp };
}

const res = {};
res.G_veteranosSesgados_ingresantesHonestos = manyG('12 veteranos con +1,0; 4 ingresantes honestos (β=0)', { vetBeta: 1.0, newBeta: 0 });
res.G_veteranosHonestos_ingresantesSobre = manyG('12 veteranos honestos; 4 ingresantes con +1,0', { vetBeta: 0, newBeta: 1.0 });
res.G_veteranosSesgados_ingresantesSesgadosIgual = manyG('control: ingresantes con el mismo +1,0 que los veteranos', { vetBeta: 1.0, newBeta: 1.0 });
[[8, 0.45], [12, 0.45], [8, 0.9]].forEach(([n, sdv]) => {
  ['real', 'fullDict', 'noCircle'].forEach((v) => {
    res[`C2_n${n}_sd${sdv}_${v}`] = manyC2(`n=${n}, sd(θ)=${sdv}, ${v}`, { n, thetaSd: sdv, mode: v === 'fullDict' ? 'fullDict' : 'real', noCircle: v === 'noCircle' });
  });
});
fs.writeFileSync(path.join(OUT, '06-ingresantes-y-circulo.json'), JSON.stringify({ reps: REPS, results: res }, null, 1));
console.log('listo 06');
