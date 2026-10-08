// 05 — Genera resultados/resumen.md (tablas) a partir de los JSON de 01–04. No simula nada.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => JSON.parse(fs.readFileSync(path.join(HERE, 'resultados', f), 'utf8'));
const f2 = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const ms = (o, d = 2) => (o ? `${f2(o.mean, d)}` : '—');
const msd = (o, d = 2) => (o ? `${f2(o.mean, d)} (±${f2(o.sd, d)})` : '—');
let md = '';
const line = (s = '') => { md += s + '\n'; };
function table(headers, rows) {
  line('| ' + headers.join(' | ') + ' |'); line('|' + headers.map(() => '---').join('|') + '|');
  rows.forEach((r) => line('| ' + r.join(' | ') + ' |'));
  line();
}

const v = R('00-validacion.json');
const c = R('01-grupos-cerrados.json'); const d = R('02-puentes.json'); const rk = R('03-ranking.json'); const h = R('04-sesgo-individual.json');
const cps = c.checkpoints;

line('# Resumen automático de resultados (generado por 05-resumen.mjs)'); line();
line(`Réplicas por celda: ${c.reps} (semillas fijas 1000+, 5000+, 7000+, 9000+). Entre paréntesis: desvío entre réplicas.`); line();

line('## Validación'); line();
line('Anexo B (cifras del documento vs. simulador):'); line();
table(['Caso', 'P(A) simulada', 'Δ ganadora', 'Δ perdedora'], Object.entries(v.anexoB).map(([k, o]) => [k, f2(o.pA), f2(o.dA, 3), f2(o.dB, 3)]));
line('Curva del cuestionario (percepción exacta, sin ruido → Nivel inicial real):'); line();
table(['Percibido', 'Nivel inicial'], v.cuestionarioCurva.map((o) => [o.percibido, o.nivelInicial]));
line('Sonda de círculo cerrado:'); line();
table(['Caso', 'Evaluaciones con factor círculo <1', 'Evaluaciones'], Object.entries(v.circuloSonda).map(([k, o]) => [k, o.circleHits ?? o.circleHitsFaseFija, o.circleEvals ?? o.circleEvalsFaseFija]));

/* A */
line('## A — Mismo nivel real, cuestionarios distintos (2 grupos de 16, orquestador REAL)'); line();
['real', 'fullDict'].forEach((mode) => {
  [0.5, 1.0, 1.5].forEach((b) => {
    const r = c.results[`A_${mode}_beta${b}`];
    line(`**${mode}, sesgo del grupo 2 = +${b}**`); line();
    table(['Partidos/jugador', 'Brecha de Nivel medio G2−G1', 'Brecha real (θ)', 'Distorsión de la brecha', 'Sesgo G1', 'Sesgo G2', 'Error orden G1 (rmse)', 'Spearman G1', '% calibrados'],
      cps.map((m) => { const x = r.byCp[m]; return [m, msd(x.muGap), msd(x.thetaGap), msd(x.gapError), ms(x['G1.bias']), ms(x['G2.bias']), ms(x['G1.relRmse']), ms(x['G1.spearman']), f2(x['G1.calib'].mean * 100, 0) + '%']; }));
  });
});
{ const r = c.results['A_noCircle_beta1.0']; line('**sin detección de círculo (variante en memoria), β=+1,0**'); line();
  table(['Partidos/jugador', 'Brecha de Nivel medio', 'Distorsión'], cps.map((m) => [m, ms(r.byCp[m].muGap), ms(r.byCp[m].gapError)])); }

/* B */
line('## B — Distinta capacidad real, cuestionarios que igualan niveles'); line();
['B_gap2.0', 'B_gap1.0', 'B_control_sinSesgo'].forEach((k) => {
  const r = c.results[k]; line(`**${r.label}**`); line();
  table(['Partidos/jugador', 'Brecha real (θ2−θ1)', 'Brecha de Nivel (mu2−mu1)', 'P(jugador G1 > jugador G2): observada', 'verdadera', 'Spearman fusionado', 'Cuartil superior desde G1: observado', 'verdadero'],
    cps.map((m) => { const x = r.byCp[m]; return [m, ms(x.thetaGap), ms(x.muGap), ms(x.pairsAoverB_obs), ms(x.pairsAoverB_true), ms(x.spearmanMerged), ms(x.topQuartileFromA_obs), ms(x.topQuartileFromA_true)]; }));
});

/* C */
line('## C — Grupo cerrado único: tamaño del círculo'); line();
const keysC = [5, 8, 12, 16, 24, 48];
['1.0', '0'].forEach((b) => {
  line(`**Sesgo compartido del grupo = ${b === '0' ? '0 (control)' : '+1,0'}**`); line();
  table(['Tamaño', ...cps.map((m) => `sesgo @${m}`), 'rmse orden @0', 'rmse @50', 'Spearman @0', 'Spearman @50', '% calibrados @5', 'sd(mu)/sd(θ) @50'],
    keysC.map((n) => { const r = c.results[`C_n${n}_beta${b === '0' ? '0' : '1.0'}`]; const x = r.byCp; return [n, ...cps.map((m) => ms(x[m]['G.bias'])), ms(x[0]['G.relRmse']), ms(x[50]['G.relRmse']), ms(x[0]['G.spearman']), ms(x[50]['G.spearman']), f2(x[5]['G.calib'].mean * 100, 0) + '%', ms(x[50]['G.sdRatio'])]; }));
});
line('**Sensibilidad (sesgo +1,0; filas = variante)**'); line();
['C_n12_beta1.0', 'C_n12_beta1.0_rate2', 'C_n12_beta1.0_fullDict', 'C_n12_beta1.0_noCircle', 'C_n8_beta1.0', 'C_n8_beta1.0_fullDict', 'C_n16_beta1.0', 'C_n16_beta1.0_truthP0.7', 'C_n16_beta1.0_truthP0.92'].forEach((k) => {
  const r = c.results[k]; if (!r) return;
  line(`- ${k}: sesgo @0=${ms(r.byCp[0]['G.bias'])}, @30=${ms(r.byCp[30]['G.bias'])}, @50=${ms(r.byCp[50]['G.bias'])}; rmse orden @50=${ms(r.byCp[50]['G.relRmse'])}; sd(mu)/sd(θ)@50=${ms(r.byCp[50]['G.sdRatio'])}; % de evaluaciones con factor círculo<1 = ${f2(r.circleShare * 100, 1)}%`);
});
line();
line('**Peso residual por repetición/compañero (factor medio sobre todas las evaluaciones, por tramo de partidos/jugador)**'); line();
table(['Tamaño', 'rep ≤5', 'rep 6–10', 'rep 11–20', 'rep 21–30', 'rep 31–50', 'comp ≤5', 'comp 6–10', 'comp 11–20', 'comp 21–30', 'comp 31–50'],
  keysC.map((n) => { const w = c.results[`C_n${n}_beta1.0`].repetitionWeights; return [n, ...[5, 10, 20, 30, 50].map((b) => f2(w[b]?.rep, 2)), ...[5, 10, 20, 30, 50].map((b) => f2(w[b]?.comp, 2))]; }));

/* E */
line('## E — Desvíos individuales sin sesgo compartido, según tamaño del círculo'); line();
table(['Tamaño', ...cps.map((m) => `rmse orden @${m}`), 'Spearman @0', 'Spearman @50', 'Error abs. medio vs θ @0', '@50'],
  [6, 12, 24, 48, 96].map((n) => { const x = c.results[`E_n${n}`].byCp; return [n, ...cps.map((m) => ms(x[m]['G.relRmse'])), ms(x[0]['G.spearman']), ms(x[50]['G.spearman']), ms(x[0]['G.absErr']), ms(x[50]['G.absErr'])]; }));

/* D */
line('## D — Grupos aislados que se conectan (brecha de sesgo G2−G1 tras 30 partidos internos; 0 = sin corrección aún)'); line();
const cd = d.checkpoints;
table(['Conexión', ...cd.map((m) => `+${m} partidos`), '% de la brecha corregida a +100', 'a +200'],
  Object.entries(d.results).map(([k, r]) => { const g0 = r.byCp[0].gap.mean; const corr = (m) => f2((1 - r.byCp[m].gap.mean / g0) * 100, 0) + '%'; return [r.label, ...cd.map((m) => ms(r.byCp[m].gap)), corr(100), corr(200)]; }));
line('Sesgo propio de los jugadores puente (promedio):'); line();
table(['Variante', ...cd.map((m) => `+${m}`)], Object.entries(d.results).filter(([k]) => /puentes_k\d$/.test(k)).map(([k, r]) => [r.label, ...cd.map((m) => ms(r.byCp[m].biasBridge))]));
line('Sesgo medio G1 (no puente) y G2 a +0 / +100 / +200:'); line();
table(['Variante', 'G1 +0', 'G2 +0', 'G1 +100', 'G2 +100', 'G1 +200', 'G2 +200'], Object.entries(d.results).map(([k, r]) => [r.label, ms(r.byCp[0].bias1), ms(r.byCp[0].bias2), ms(r.byCp[100].bias1), ms(r.byCp[100].bias2), ms(r.byCp[200].bias1), ms(r.byCp[200].bias2)]));

/* F */
line('## F — Ranking provincial/nacional con varias localidades'); line();
const ck = rk.checkpoints;
Object.entries(rk.results).forEach(([k, r]) => {
  line(`**${r.label}** (réplicas ${r.reps})`); line();
  table(['Partidos/jugador', 'Ranking: Spearman con capacidad', 'Solapamiento top-K', 'Pares entre localidades mal ordenados (dif. real ≥1,0)', 'Desplazamiento medio de puesto', 'p90', 'Peor puesto real dentro del top-K observado', 'Sesgo medio loc. más sobrevalorada', 'menos', '% del top-K desde la localidad más sobrevalorada (esperable)', 'Spearman dentro de cada localidad'],
    ck.map((m) => { const x = r.byCp[m]; return [m, ms(x.spearman), ms(x.topKOverlap), ms(x.wrongCrossPairs), ms(x.meanAbsRankShift, 1), ms(x.p90AbsRankShift, 0), ms(x.worstTrueRankInObservedTop, 0), ms(x.maxLocBias), ms(x.minLocBias), `${f2(x.topKfromHighestBetaLoc.mean * 100, 0)}% (${f2(x.expectedShare.mean * 100, 0)}%)`, ms(x.withinLocSpearman)]; }));
});

/* H */
line('## H — Subgrupo sobre/subdeclarante dentro de un grupo abierto (sesgo respecto de capacidad)'); line();
const ch = h.checkpoints;
table(['Caso', ...ch.map((m) => `declarantes @${m}`), ...ch.map((m) => `resto @${m}`)],
  Object.entries(h.results).map(([k, r]) => [r.label, ...ch.map((m) => ms(r.byCp[m].biasFlagged)), ...ch.map((m) => ms(r.byCp[m].biasOthers))]));

/* G y C2 */
const g6 = R('06-ingresantes-y-circulo.json');
line('## G — Ingresantes a un grupo veterano (12 veteranos con 30 partidos; 4 ingresantes; sesgo medio respecto de capacidad)'); line();
const cg = [0, 5, 10, 20, 30, 50, 100];
table(['Caso', ...cg.map((m) => `ingresantes @${m}`), ...cg.map((m) => `veteranos @${m}`)],
  Object.entries(g6.results).filter(([k]) => k.startsWith('G_')).map(([k, r]) => [r.label, ...cg.map((m) => ms(r.byCp[m].biasNew)), ...cg.map((m) => ms(r.byCp[m].biasVet))]));
line('## C2 — Círculo cerrado homogéneo (sesgo +1,0): ¿importa el factor de círculo cuando puede activarse?'); line();
table(['Variante', 'sesgo @80', 'error de orden @50', '@80', 'confiabilidad media @80', '% evaluaciones con factor círculo <1 (acum. a 80)'],
  Object.entries(g6.results).filter(([k]) => k.startsWith('C2_')).map(([k, r]) => [r.label, ms(r.byCp[80].bias), ms(r.byCp[50].relRmse), ms(r.byCp[80].relRmse), ms(r.byCp[80].conf), f2(r.byCp[80].circleShare.mean * 100, 1) + '%']));

fs.writeFileSync(path.join(HERE, 'resultados', 'resumen.md'), md);
console.log('resumen.md escrito');
