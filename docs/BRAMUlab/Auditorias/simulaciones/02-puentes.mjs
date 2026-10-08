// 02 — Escenario D: grupos inicialmente aislados que empiezan a conectarse.  Salida: resultados/02-puentes.json
//   Dos grupos de 16 con la misma capacidad real; G2 declaró +1,0 por encima en el cuestionario.
//   Fase 1: 30 partidos por jugador, cada grupo en circuito cerrado.
//   Fase 2: se conectan (k jugadores puente, o una fracción f de partidos mezclados) y se mide cuánto de la brecha
//           de sesgo (bias_G2 − bias_G1, ≈ +1,0 al inicio de la fase 2) sigue sin corregirse.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, makeRng, Sim, spawn, aggregate, mean } from './scenario-lib.mjs';
import { groupMetrics } from './sim-core.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'resultados');
fs.mkdirSync(OUT, { recursive: true });
const REPS = Number(process.env.REPS || 30);
const N = 16; const PHASE1 = 30; const CHECKS2 = [0, 10, 20, 30, 50, 100, 200];

function run({ variant, k = 0, f = 0, mode = 'real', noCircle = false, seed }) {
  const rng = makeRng(seed);
  const world = createWorld({ mode, noCircle });
  const sim = new Sim(world, rng, {});
  const g1 = []; const g2 = [];
  for (let i = 0; i < N; i += 1) { const id = 'a' + i; spawn(world, rng, { id, theta: 5.5 + rng.normal() * 0.9, beta: 0, group: 'G1' }); g1.push(id); }
  for (let i = 0; i < N; i += 1) { const id = 'b' + i; spawn(world, rng, { id, theta: 5.5 + rng.normal() * 0.9, beta: 1.0, group: 'G2' }); g2.push(id); }
  const per = (ids) => ids.map((id) => world.players.get(id));
  // Fase 1: cerrados
  let p1 = 0; let p2 = 0;
  while (Math.min(p1, p2) < PHASE1 * N) {
    if (p1 <= p2) { sim.playPool('g1', g1, 2 * N); p1 += 4; } else { sim.playPool('g2', g2, 2 * N); p2 += 4; }
  }
  const bridges = rng.shuffle(g1).slice(0, k);
  const snap = (m) => {
    const a = groupMetrics(per(g1.filter((id) => !bridges.includes(id))));
    const b = groupMetrics(per(g2));
    const rec = { m, bias1: a.meanBias, bias2: b.meanBias, gap: b.meanBias - a.meanBias };
    if (bridges.length) rec.biasBridge = groupMetrics(per(bridges)).meanBias;
    return rec;
  };
  const out = [snap(0)];
  const poolG1 = g1.filter((id) => !bridges.includes(id));
  const poolG2 = g2.concat(bridges);
  const poolG1b = poolG1.concat(bridges);
  const played = { g1: 0, g2: 0, mix: 0 };
  const targets = CHECKS2.slice(1);
  let ti = 0;
  let guard = 0;
  while (ti < targets.length && guard++ < 200000) {
    // reparto: se juega primero donde menos partidos por jugador lleva (ritmo equitativo)
    const r1 = played.g1 / N; const r2 = played.g2 / N;
    if (f > 0 && rng.next() < f) {
      const four = rng.shuffle(g1.concat(g2)).slice(0, 4);
      sim.playFour(four, 2 * N); played.mix += 4;
      // la mezcla cuenta para los participantes pero se aproxima en el contador por grupo:
      four.forEach((id) => { if (g1.includes(id)) played.g1 += 1; else played.g2 += 1; });
    } else if (r1 <= r2) {
      sim.playPool('g1b', variant === 'puente' ? poolG1b : g1, 2 * N); played.g1 += 4;
    } else {
      sim.playPool('g2b', variant === 'puente' ? poolG2 : g2, 2 * N); played.g2 += 4;
    }
    const avg = Math.min(played.g1, played.g2) / N;
    if (avg >= targets[ti]) { out.push(snap(targets[ti])); ti += 1; }
  }
  return out;
}

function many(label, opts, reps = REPS) {
  const per = [];
  for (let r = 0; r < reps; r += 1) per.push(run(Object.assign({ seed: 5000 + r }, opts)));
  const byCp = {};
  per[0].forEach((_, i) => { byCp[per[0][i].m] = aggregate(per.map((rows) => rows[i])); });
  console.log('OK', label);
  return { label, opts, reps, byCp };
}

const res = {};
res.D_control_sinConexion = many('sin conexión (control)', { variant: 'ninguno' });
[1, 2, 4, 8].forEach((k) => { res[`D_puentes_k${k}`] = many(`${k} puente(s)`, { variant: 'puente', k }); });
[0.02, 0.05, 0.10, 0.25].forEach((f) => { res[`D_mezcla_f${f}`] = many(`fracción mezclada ${f}`, { variant: 'mezcla', f }); });
res.D_puentes_k2_fullDict = many('2 puentes, diccionario completo', { variant: 'puente', k: 2, mode: 'fullDict' });
res['D_mezcla_f0.1_fullDict'] = many('mezcla 10%, diccionario completo', { variant: 'mezcla', f: 0.10, mode: 'fullDict' });
res['D_mezcla_f0.1_noCircle'] = many('mezcla 10%, sin círculo', { variant: 'mezcla', f: 0.10, noCircle: true });

fs.writeFileSync(path.join(OUT, '02-puentes.json'), JSON.stringify({ reps: REPS, phase1: PHASE1, checkpoints: CHECKS2, results: res }, null, 1));
console.log('listo 02');
