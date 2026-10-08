// 04 — Escenario H (complementa E): sobre/subdeclaración de una PARTE de un grupo mixto.
//   Un grupo abierto de n jugadores (todos juegan con todos) donde k declararon +1,5 (o −1,5) por encima de su capacidad real.
//   Mide cuánto se corrige el sesgo de esos k y cuánto "se derrama" sobre el resto (propiedad de suma cero del motor).
//   Salida: resultados/04-sesgo-individual.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, Sim, spawn, aggregate, mean } from './scenario-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const REPS = Number(process.env.REPS || 30);
const CHECKS = [0, 5, 10, 20, 30, 50, 100];

function run({ n, k, beta, seed }) {
  const rng = makeRng(seed);
  const world = createWorld({});
  const sim = new Sim(world, rng, {});
  const ids = []; const flagged = [];
  for (let i = 0; i < n; i += 1) {
    const id = 'p' + i; const isF = i < k;
    spawn(world, rng, { id, theta: 5.5 + rng.normal() * 0.9, beta: isF ? beta : 0 });
    ids.push(id); if (isF) flagged.push(id);
  }
  const others = ids.filter((id) => !flagged.includes(id));
  const bias = (list) => mean(list.map((id) => world.players.get(id).mu - world.players.get(id).theta));
  const out = [{ m: 0, biasFlagged: bias(flagged), biasOthers: bias(others), meanAll: bias(ids) }];
  let ci = 1; let played = 0;
  while (ci < CHECKS.length) {
    sim.playPool('p', ids, n); played += 4;
    if (played / n >= CHECKS[ci]) { out.push({ m: CHECKS[ci], biasFlagged: bias(flagged), biasOthers: bias(others), meanAll: bias(ids) }); ci += 1; }
  }
  return out;
}
function many(label, opts) {
  const per = [];
  for (let r = 0; r < REPS; r += 1) per.push(run(Object.assign({ seed: 7000 + r }, opts)));
  const byCp = {};
  per[0].forEach((_, i) => { byCp[per[0][i].m] = aggregate(per.map((rows) => rows[i])); });
  console.log('OK', label);
  return { label, opts, byCp };
}
const res = {};
[[24, 1], [24, 3], [24, 6], [24, 12], [12, 3], [48, 6]].forEach(([n, k]) => { res[`H_n${n}_k${k}_over+1.5`] = many(`n=${n}, ${k} sobredeclarantes +1,5`, { n, k, beta: 1.5 }); });
res['H_n24_k3_under-1.5'] = many('n=24, 3 subdeclarantes −1,5', { n: 24, k: 3, beta: -1.5 });
fs.writeFileSync(path.join(OUT, '04-sesgo-individual.json'), JSON.stringify({ reps: REPS, checkpoints: CHECKS, results: res }, null, 1));
console.log('listo 04');
