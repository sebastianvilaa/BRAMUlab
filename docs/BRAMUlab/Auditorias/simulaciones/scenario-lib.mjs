// Utilidades compartidas por los escenarios (muestreo, reloj, agregación). Sin lógica de Nivel propia.
import { createWorld, makeRng, answerQuestionnaire, calibrateGameScale, simulateMatchScore, mean, sd } from './sim-core.mjs';

export const DEFAULT_TRUTH_P1 = 0.822; // P(ganar partido) con diferencia 1,0 = el valor que el propio motor asume (hipótesis favorable al motor)
export const SIGMA_RESP = 0.5; // desvío individual de cómo se percibe cada persona (hipótesis)
export const SIGMA_Q = 0.8; // ruido por pregunta del slider (hipótesis)

/** Crea un jugador: capacidad θ (hipótesis) -> percepción θ+β+ε -> respuestas REALES del cuestionario -> Nivel inicial REAL. */
export function spawn(world, rng, { id, theta, beta = 0, group = null, sigmaResp = SIGMA_RESP, sigmaQ = SIGMA_Q, meta }) {
  const perceived = theta + beta + rng.normal() * sigmaResp;
  const q = answerQuestionnaire(world.eng.Cal, perceived, sigmaQ, rng);
  world.addPlayer({ id, theta, initialLevel: q.initialLevel, originConfidence: q.originConfidence, group, meta });
  return world.players.get(id);
}

/** Reloj + muestreo justo (barajas sucesivas) + juego de partidos con resultados simulados. */
export class Sim {
  constructor(world, rng, { truthP1 = DEFAULT_TRUTH_P1, ratePerWeek = 1 } = {}) {
    this.world = world; this.rng = rng; this.sg = calibrateGameScale(truthP1); this.rate = ratePerWeek;
    this.clock = world.t0; this.queues = new Map(); this.log = [];
    this.count = new Map(); // partidos por jugador desde el inicio
  }
  _four(poolKey, ids) {
    let q = this.queues.get(poolKey) || [];
    const four = [];
    let guard = 0;
    while (four.length < 4) {
      if (!q.length) q = this.rng.shuffle(ids);
      const c = q.shift();
      if (!four.includes(c)) four.push(c);
      if (++guard > 1000) throw new Error('no se pudo armar un cuarteto');
    }
    this.queues.set(poolKey, q);
    return four;
  }
  /** Juega un partido con cuatro jugadores del pool (reparto aleatorio de parejas). `activeN` fija el ritmo del reloj. */
  playPool(poolKey, ids, activeN) {
    const four = this._four(poolKey, ids);
    return this.playFour(four, activeN);
  }
  playFour(four, activeN) {
    const dtMs = (7 * 86400000) / (this.rate * activeN / 4);
    this.clock += dtMs;
    const th = (id) => this.world.players.get(id).theta;
    const diff = (th(four[0]) + th(four[1])) / 2 - (th(four[2]) + th(four[3])) / 2;
    const score = simulateMatchScore(diff, this.sg, this.rng);
    const res = this.world.playMatch(four, this.clock, score);
    if (res.eligible && res.context) {
      this.log.push({ rep: (res.context.repetitionFactorA + res.context.repetitionFactorB) / 2, comp: (res.context.companionFactorA + res.context.companionFactorB) / 2, nPlayersDone: four.reduce((s, id) => s + (this.count.get(id) || 0), 0) / 4 });
    }
    four.forEach((id) => this.count.set(id, (this.count.get(id) || 0) + 1));
    return res;
  }
}

/** Promedia una lista de objetos numéricos del mismo esquema -> {clave: {mean, sd}}. */
export function aggregate(list) {
  const keys = Object.keys(list[0]);
  const out = {};
  keys.forEach((k) => {
    const v = list.map((o) => o[k]).filter((x) => Number.isFinite(x));
    out[k] = { mean: +mean(v).toFixed(4), sd: +sd(v).toFixed(4) };
  });
  return out;
}

export function fmt(x, d = 2) { return Number.isFinite(x) ? x.toFixed(d) : '—'; }
export function fmtMS(a, d = 2) { return a ? `${fmt(a.mean, d)} ± ${fmt(a.sd, d)}` : '—'; }

export { createWorld, makeRng, mean, sd };
