// BRAMUlab V04.37 — Actividad histórica + Evolución REAL del Nivel (cliente) + movimiento de posiciones en la Race anual.
// Fuentes: Experiencia_Inicial.md §27, Nivel_BRAMU.md §16, BRAMU_Intelligence.md §18, Grupos_BRAMU.md §29.
// El contrato server-side de get_my_level_evolution se prueba en supabase/functions/_shared/v0437-level-evolution.test.mjs (Postgres real).
// Ejecutar con: node --test bramulab/tests/v0437-actividad-evolucion-race.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const REPO = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const BASE_SHA = 'f8e03b3'; // último commit ANTES de V04.37: referencia para probar que el resumen de Actividad y la Race no cambiaron
const app = read('app.js'); const html = read('index.html'); const css = read('styles.css');

function sandbox(files, srcOf = read) {
  const store = {};
  const sb = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  vm.createContext(sb);
  files.forEach((f) => vm.runInContext(srcOf(f), sb, { filename: f }));
  return sb;
}
const sbNew = sandbox(['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js']);
const PH = sbNew.PLPlayerHome; const PG = sbNew.PLGroups;
const gitShow = (f) => execFileSync('git', ['show', `${BASE_SHA}:bramulab/${f}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const sbOld = sandbox(['engine.js', 'stats.js', 'store.js', 'player-home.js', 'groups.js'], (f) => (['player-home.js', 'groups.js'].includes(f) ? gitShow(f) : read(f)));
const plain = (x) => JSON.parse(JSON.stringify(x));

/* ------------------------------------------------------------------ */
/* A — ACTIVIDAD                                                        */
/* ------------------------------------------------------------------ */
const NOW = new Date(2026, 9, 7, 12, 0, 0); // miércoles 7/10/2026, hora local (lunes de la semana: 5/10)
const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();
function dm(id, playedAt, { win = true, neutral = false } = {}) {
  return {
    matchId: id, playedAt, winnerTeam: neutral ? null : (win ? 'A' : 'B'), regulationCompleted: true,
    sets: [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }],
    players: [{ id: 0, team: 'A', name: 'Yo' }, { id: 1, team: 'A', name: 'Compa' }, { id: 2, team: 'B', name: 'R1' }, { id: 3, team: 'B', name: 'R2' }],
  };
}
const ME = 'Yo';

test('ACT-1) detalle: una fila por semana CON actividad oficial, de la más reciente a la más antigua, con rango humano, jugados/ganados/perdidos y efectividad', () => {
  const ms = [
    dm('a1', day(2026, 10, 6), { win: true }), dm('a2', day(2026, 10, 7), { win: false }),               // semana 5–11 OCT: 2J 1G 1P
    dm('b1', day(2026, 9, 30), { win: true }),                                                          // semana 28 SEP–4 OCT: 1J 1G
    dm('c1', day(2026, 9, 17), { win: false }), dm('c2', day(2026, 9, 18), { win: false }), dm('c3', day(2026, 9, 20), { win: true }), // 14–20 SEP: 3J 1G 2P
  ];
  const w = PH.computeActivityWeeksHistory(ms, ME, NOW);
  assert.deepEqual(plain(w.map((r) => r.rangeLabel)), ['5 OCT — 11 OCT', '28 SEP — 4 OCT', '14 SEP — 20 SEP']);
  assert.deepEqual(plain(w.map((r) => [r.count, r.wins, r.losses, r.pct])), [[2, 1, 1, 50], [1, 1, 0, 100], [3, 1, 2, 33]]);
  // lunes–domingo reales
  assert.deepEqual(plain(w.map((r) => [r.weekStart.getDay(), r.weekEnd.getDay()])), [[1, 0], [1, 0], [1, 0]]);
});

test('ACT-2) semana con 1 solo partido: 100 % si ganó, 0 % si perdió; sin semanas vacías de relleno entre medio', () => {
  const w = PH.computeActivityWeeksHistory([dm('w', day(2026, 10, 6), { win: true }), dm('l', day(2026, 8, 12), { win: false })], ME, NOW);
  assert.deepEqual(plain(w.map((r) => [r.rangeLabel, r.count, r.wins, r.losses, r.pct])), [['5 OCT — 11 OCT', 1, 1, 0, 100], ['10 AGO — 16 AGO', 1, 0, 1, 0]]);
  assert.equal(w.length, 2, 'las semanas intermedias sin partidos NO generan fila');
});

test('ACT-3) sin actividad oficial → lista vacía (la UI no abre un detalle vacío); fecha futura o inválida no cuentan', () => {
  assert.deepEqual(plain(PH.computeActivityWeeksHistory([], ME, NOW)), []);
  const w = PH.computeActivityWeeksHistory([dm('f', day(2026, 10, 14)), dm('x', 'no-es-fecha'), dm('ok', day(2026, 10, 5))], ME, NOW);
  assert.equal(w.length, 1); assert.equal(w[0].count, 1);
});

test('ACT-4) rango entre años: se agrega el año solo cuando la semana no es del año actual o cruza de año', () => {
  const jan = new Date(2027, 0, 6, 12);
  const w = PH.computeActivityWeeksHistory([dm('n', new Date(2026, 11, 30, 12).toISOString())], ME, jan);
  assert.equal(w[0].rangeLabel, '28 DIC — 3 ENE 2027');
  const old = PH.computeActivityWeeksHistory([dm('o', new Date(2025, 5, 11, 12).toISOString())], ME, NOW);
  assert.equal(old[0].rangeLabel, '9 JUN — 15 JUN 2025');
});

test('ACT-5) MISMA verdad que el resumen del Home: las 4 semanas de computeActivityWeeks4 coinciden fila a fila con el detalle; el resumen NO cambió vs. V04.36 (propiedad con 400 fixtures)', () => {
  const OLD = sbOld.PLPlayerHome;
  let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let round = 0; round < 400; round += 1) {
    const ms = [];
    const n = Math.floor(rnd() * 14);
    for (let i = 0; i < n; i += 1) {
      const offsetDays = Math.floor(rnd() * 60) - 6; // incluye algo de futuro y partidos viejos
      ms.push(dm(`m${round}_${i}`, new Date(2026, 9, 7 - offsetDays, 8 + Math.floor(rnd() * 14)).toISOString(), { win: rnd() > 0.45, neutral: rnd() > 0.93 }));
    }
    const now = PH.computeActivityWeeks4(ms, ME, NOW);
    assert.deepEqual(plain(now), plain(OLD.computeActivityWeeks4(ms, ME, NOW)), 'resumen idéntico al de V04.36');
    const hist = PH.computeActivityWeeksHistory(ms, ME, NOW);
    now.buckets.forEach((b, i) => {
      const weekStart = new Date(PH.startOfWeekMonday(NOW).getTime() - (3 - i) * 7 * 24 * 3600 * 1000).getTime();
      const row = hist.find((h) => h.weekStart.getTime() === weekStart);
      assert.deepEqual([b.count, b.wins, b.losses], row ? [row.count, row.wins, row.losses] : [0, 0, 0], `semana ${i} del resumen == fila del detalle`);
    });
    assert.deepEqual(hist.map((h) => h.weekStart.getTime()), hist.map((h) => h.weekStart.getTime()).sort((a, b) => b - a), 'orden desc');
    assert.ok(hist.every((h) => h.count > 0), 'nunca una semana vacía');
  }
});

test('ACT-6) cableado: tarjeta tocable (rol/tabindex/chevron) con el resumen de 4 barras intacto; pantalla propia con back, nav y scroll; fuente = partidos computables del Home', () => {
  assert.match(html, /<div class="pastilla pastilla--activity pastilla--link" id="player-home-activity-card" role="button" tabindex="0"/);
  assert.match(html, /id="player-home-activity-bars"/); assert.match(html, /id="player-home-activity-total"/); assert.match(html, /activity-legend__dot--win/);
  assert.match(html, /<section id="view-activity" class="view view--history" hidden>[\s\S]*id="activity-back-btn"[\s\S]*id="activity-week-list"/);
  assert.match(app, /'account-deleted',\s*\/\/[^\n]*\n\s*'activity',/); // showView la conoce
  assert.match(app, /'group-settings', 'pending', 'activity'\];/); // con bottom-nav
  const open = app.slice(app.indexOf('function openActivityScreen()'), app.indexOf('function initActivityScreen()'));
  assert.match(open, /PH\.computeActivityWeeksHistory\(getHomeComputableMatches\(\), currentIdentity\(\), new Date\(\)\)/);
  assert.match(open, /if \(!weeks\.length\) return;/);
  // El Home pinta Actividad con el MISMO conjunto computable (nunca pendientes/no oficiales).
  assert.match(app, /const history = getComputableHistory\(\);\s*const matches = PH\.filterMatchesForPlayer\(history, currentIdentity\(\)\);/);
  assert.match(app, /function getHomeComputableMatches\(\) \{\s*return PH\.filterMatchesForPlayer\(getComputableHistory\(\), currentIdentity\(\)\);/);
  assert.doesNotMatch(open, /getDisplayHistory|pending/);
  assert.match(app, /\$\('#activity-back-btn'\)\.addEventListener\('click', \(\) => openPlayerHome\(\)\)/);
  assert.match(css, /\.activity-week-list\{ display:flex; flex-direction:column;/);
});

/* ------------------------------------------------------------------ */
/* B — EVOLUCIÓN REAL DEL NIVEL                                         */
/* ------------------------------------------------------------------ */
const NOWE = new Date('2026-10-07T12:00:00Z');
const dAgo = (n) => new Date(NOWE.getTime() - n * 86400000).toISOString();
const series = (...pairs) => ({ points: pairs.map(([daysAgo, level], i) => ({ at: dAgo(daysAgo), level, matchId: i ? `m${i}` : null })) });

test('EVO-1) sin evidencia suficiente → null (el módulo se oculta completo): sin puntos, 1 solo punto o datos inválidos', () => {
  assert.equal(PH.buildRealLevelEvolution(null, NOWE), null);
  assert.equal(PH.buildRealLevelEvolution({ points: [] }, NOWE), null);
  assert.equal(PH.buildRealLevelEvolution(series([5, 5.0]), NOWE), null);
  assert.equal(PH.buildRealLevelEvolution({ points: [{ at: 'x', level: 5 }, { at: 'y', level: 6 }] }, NOWE), null);
});

test('EVO-2) el último punto es el Nivel actual; mejor Nivel y cambio de 30 días salen de LA MISMA serie', () => {
  const e = PH.buildRealLevelEvolution(series([60, 5.0], [45, 5.4], [20, 6.1], [3, 5.9]), NOWE);
  assert.equal(e.current, 5.9); assert.equal(e.points.at(-1).level, 5.9);
  assert.deepEqual(plain(e.peak), { value: 6.1, isCurrent: false, date: dAgo(20) });
  assert.deepEqual(plain(e.change30), { from: 5.4, to: 5.9, delta: 0.5 }); // valor al cierre del día-30 = 5.4 (último punto ≤ ahora−30d)
  const top = PH.buildRealLevelEvolution(series([60, 5.0], [10, 6.0]), NOWE);
  assert.deepEqual(plain(top.peak), { value: 6.0, isCurrent: true, date: null });
});

test('EVO-3) Intelligence (1): cambio real en 30 días → "pasó de X a Y (↑/↓ Z)" con la serie real, sin causas', () => {
  const up = PH.buildRealLevelEvolution(series([50, 5.8], [20, 5.9], [5, 6.0]), NOWE);
  assert.equal(up.insight, 'En los últimos 30 días tu Nivel pasó de 5.8 a 6.0 (↑ 0.2).');
  const down = PH.buildRealLevelEvolution(series([50, 6.4], [12, 6.1], [2, 6.0]), NOWE);
  assert.equal(down.insight, 'En los últimos 30 días tu Nivel pasó de 6.4 a 6.0 (↓ 0.4).');
  // Cuenta joven (todo dentro de la ventana): el valor de partida es el punto inicial oficial.
  const young = PH.buildRealLevelEvolution(series([10, 5.0], [6, 5.2], [2, 5.1]), NOWE);
  assert.equal(young.insight, 'En los últimos 30 días tu Nivel pasó de 5.0 a 5.1 (↑ 0.1).');
  assert.doesNotMatch(young.insight, /porque|gracias|mejor[óo] tu|técnica|confianza/i);
});

test('EVO-4) Intelligence (2): estabilidad SOLO con ≥ 3 eventos computables en la ventana y TODOS los valores públicos iguales', () => {
  const stable = PH.buildRealLevelEvolution(series([70, 6.0], [25, 6.0], [15, 6.0], [4, 6.0]), NOWE);
  assert.equal(stable.change30, null);
  assert.equal(stable.insight, 'Tu Nivel se mantuvo en 6.0 durante tus últimos 3 partidos computables.');
  // Redondeo público: 5.96/6.04 → ambos 6.0 (el servidor ya manda 1 decimal; el helper compara a la precisión pública).
  assert.equal(PH.buildRealLevelEvolution(series([70, 6.0], [20, 6.0], [10, 6.0], [3, 6.0], [1, 6.0]), NOWE).insight, 'Tu Nivel se mantuvo en 6.0 durante tus últimos 4 partidos computables.');
});

test('EVO-5) abstención: pocas muestras, oscilaciones que terminan igual, sin eventos en la ventana, o historia vieja sin cambios', () => {
  // solo 2 eventos estables en la ventana → no alcanza
  assert.equal(PH.buildRealLevelEvolution(series([70, 6.0], [20, 6.0], [3, 6.0]), NOWE).insight, null);
  // 4 eventos pero oscila (6.0 → 6.2 → 5.9 → 6.0): termina igual, NO es "se mantuvo" ni cambio neto
  const osc = PH.buildRealLevelEvolution(series([70, 6.0], [25, 6.2], [15, 5.9], [8, 6.0], [2, 6.0]), NOWE);
  assert.equal(osc.change30, null);
  assert.equal(osc.insight, null);
  // todo es anterior a 30 días: nada que decir de la ventana
  assert.equal(PH.buildRealLevelEvolution(series([90, 5.0], [70, 5.3], [50, 5.3]), NOWE).insight, null);
});

test('EVO-6) cableado: la tarjeta sale SOLO de la serie oficial server-backed; el gate legacy no se deshace (PH.computeLevelEvolution jamás en el camino V1)', () => {
  const fn = app.slice(app.indexOf('function renderProfileEvolution(user)'), app.indexOf('/** V03.0.1 (§1/§7) — único punto de entrada a Perfil'));
  const v1 = fn.slice(fn.indexOf('if (levelV1) {'), fn.indexOf("$('#evolution-calibration-note-simulado').hidden = false;"));
  const codeOnly = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  assert.doesNotMatch(codeOnly(v1), /computeLevelEvolution/);
  assert.match(fn, /const realEvolution = levelV1 \? currentRealLevelEvolution\(levelV1\) : null;/);
  assert.match(v1, /\$\('#evolution-card'\)\.hidden = isCalibrated && !realEvolution;/); // sin serie real: se oculta como antes
  assert.match(v1, /paintRealLevelEvolution\(realEvolution\)/);
  // El último punto debe coincidir con el Nivel público que muestra la app; si no, no se mezcla.
  const cur = app.slice(app.indexOf('function currentRealLevelEvolution'), app.indexOf('async function refreshServerMatches'));
  assert.match(cur, /Math\.round\(built\.current \* 10\) !== Math\.round\(LV\.roundPublicLevel\(levelV1\.mu\) \* 10\)\) return null/);
  assert.match(cur, /levelEvolutionV1\.userId !== user\.id/);
  // Se relee al abrir Mi Perfil y se repinta si sigue ahí.
  assert.match(app, /refreshLevelEvolution\(\)\.then\(\(ok\) => \{ if \(ok && !\$\('#view-profile'\)\.hidden\) renderProfileEvolution\(Store\.getCurrentUser\(\)\); \}\);/);
  // Intelligence dentro de la misma tarjeta, debajo del gráfico, y nota/badge del camino real.
  assert.ok(html.indexOf('id="evolution-chart-wrap"') < html.indexOf('id="evolution-insight"'));
  assert.match(html, /<div class="evolution-insight" id="evolution-insight" hidden>/);
  const paint = app.slice(app.indexOf('function paintRealLevelEvolution'), app.indexOf('/** §4.1 — resumen numérico'));
  assert.match(paint, /\$\('#evolution-badge'\)\.hidden = true;/);
  assert.doesNotMatch(paint, /Regla de prueba|simulad/i);
  // Hardening 139: el cliente no incorpora el motor ni lee tablas internas.
  assert.doesNotMatch(read('auth.js').slice(read('auth.js').indexOf('async function getMyLevelEvolution'), read('auth.js').indexOf('const deleteGroup')), /\.from\(|level_events|match_level_result/);
  assert.doesNotMatch(html, /<script src="(level|level-context)\.js/);
});

test('EVO-7) Auth.getMyLevelEvolution: valida el contrato y trata "sin evidencia" como available:false', async () => {
  const mk = (data, error = null) => {
    const sb = { window: null };
    sb.window = sb; vm.createContext(sb);
    sb.supabase = { createClient: () => ({ rpc: async () => ({ data, error }) }) };
    sb.__BRAMU_ENV__ = { name: 'staging', supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'sb_publishable_x' };
    sb.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; sb.sessionStorage = sb.localStorage;
    for (const f of ['engine.js', 'stats.js', 'store.js', 'auth.js']) vm.runInContext(read(f), sb, { filename: f });
    return sb.PLAuth;
  };
  const ok = await mk({ ok: true, available: true, currentLevel: 5.4, points: [{ at: dAgo(9), level: 5.0, matchId: null }, { at: dAgo(2), level: 5.4, matchId: 'x' }] }).getMyLevelEvolution();
  assert.deepEqual(plain(ok), { ok: true, available: true, currentLevel: 5.4, points: [{ at: dAgo(9), level: 5, matchId: null }, { at: dAgo(2), level: 5.4, matchId: 'x' }] });
  assert.equal((await mk({ ok: true, available: false, reason: 'no_results' }).getMyLevelEvolution()).available, false);
  assert.equal((await mk({ ok: true, available: true, currentLevel: 5, points: [{ at: dAgo(1), level: 5 }] }).getMyLevelEvolution()).available, false); // 1 punto: no alcanza
  assert.equal((await mk(null, { message: 'boom' }).getMyLevelEvolution()).ok, false);
});

/* ------------------------------------------------------------------ */
/* C — RACE ANUAL: MOVIMIENTO                                           */
/* ------------------------------------------------------------------ */
const mem = (name, userId, joinedAt = '2026-01-05T00:00:00.000Z') => ({ name, userId, isAdmin: false, periods: [{ joinedAt, leftAt: null }] });
const gm = (id, at, a, b, winner) => ({
  matchId: id, playedAt: at, winnerTeam: winner, regulationCompleted: true, sets: [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 4 }],
  players: [{ id: 0, team: 'A', userId: a[0], name: a[0].toUpperCase() }, { id: 1, team: 'A', userId: a[1], name: a[1].toUpperCase() }, { id: 2, team: 'B', userId: b[0], name: b[0].toUpperCase() }, { id: 3, team: 'B', userId: b[1], name: b[1].toUpperCase() }],
});
const GROUP = { id: 'g', members: ['a', 'b', 'c', 'd', 'e'].map((u) => mem(u.toUpperCase(), u)) };
const T_NOW = new Date('2026-09-25T12:00:00-03:00');
const T_WEEK = PG.weekStartBA(T_NOW);
const raceFor = (hist, group = GROUP, g = PG) => {
  const base = g.computeRaceAnual(hist, group, 2026);
  const prev = g.computeRaceAnual(hist, group, 2026, { beforeWeekStartMs: T_WEEK.getTime() });
  return { base, prev, rows: g.annotateRaceMovement(base, prev) };
};
const mv = (rows) => Object.fromEntries(rows.map((r) => [r.name, r.movement ? r.movement.delta : null]));
// Semana previa (14–20 SEP) y semana actual (21–27 SEP), lunes BA.
const HIST_UP_DOWN = [
  gm('p1', '2026-09-15T15:00:00-03:00', ['a', 'c'], ['d', 'e'], 'A'), gm('p2', '2026-09-16T15:00:00-03:00', ['a', 'b'], ['c', 'e'], 'A'), gm('p3', '2026-09-17T15:00:00-03:00', ['a', 'c'], ['b', 'e'], 'A'),
  gm('c1', '2026-09-22T15:00:00-03:00', ['b', 'd'], ['a', 'c'], 'A'), gm('c2', '2026-09-23T15:00:00-03:00', ['b', 'd'], ['a', 'e'], 'A'),
];

test('RACE-1) primera semana comparable (sin Race previa): NINGUNA flecha y las filas son idénticas a las de siempre', () => {
  const hist = HIST_UP_DOWN.filter((m) => m.matchId.startsWith('c'));
  const { base, prev, rows } = raceFor(hist);
  assert.deepEqual(plain(prev), []);
  assert.deepEqual(plain(rows), plain(base));
  assert.ok(rows.every((r) => !r.movement && !r.movementSlot));
});

test('RACE-2) sube / baja / mantiene respecto del cierre de la semana anterior, con empates 1,1,3 respetados', () => {
  const { base, prev, rows } = raceFor(HIST_UP_DOWN);
  // Previa: A y C empatados 1º (1,1), B 3º, D y E empatados 4º; Actual: B 1º, A/C/D empatados 2º (2,2,2), E 5º.
  assert.deepEqual(plain(prev.map((r) => [r.name, r.position])), [['A', 1], ['C', 1], ['B', 3], ['D', 4], ['E', 4]]);
  assert.deepEqual(plain(base.map((r) => [r.name, r.position])), [['B', 1], ['A', 2], ['C', 2], ['D', 2], ['E', 5]]);
  assert.deepEqual(plain(mv(rows)), { B: 2, A: -1, C: -1, D: 2, E: -1 });
  rows.forEach((r) => assert.equal(r.movementSlot, true));
});

test('RACE-3) mismo puesto: sin indicador; solo los que cambian lo muestran (y la columna se reserva en todas las filas)', () => {
  const hist = [
    gm('p1', '2026-09-15T15:00:00-03:00', ['a', 'b'], ['c', 'd'], 'A'), gm('p2', '2026-09-16T15:00:00-03:00', ['a', 'b'], ['c', 'e'], 'A'),
    gm('c1', '2026-09-22T15:00:00-03:00', ['c', 'e'], ['a', 'd'], 'A'), gm('c2', '2026-09-23T15:00:00-03:00', ['c', 'e'], ['b', 'd'], 'A'), gm('c3', '2026-09-24T15:00:00-03:00', ['c', 'e'], ['a', 'b'], 'A'),
  ];
  const { rows } = raceFor(hist);
  const m = mv(rows);
  assert.equal(m.A, null); assert.equal(m.B, null); // A y B conservaron el 1º (empatados)
  assert.equal(m.C, 2); assert.equal(m.E, 2); assert.equal(m.D, -2); // 1,1,1,1,5 vs previa 1,1,3,3,3
});

test('RACE-4) alta/reingreso sin comparación válida (sin fila previa): nada; el resto sí se mueve', () => {
  const group = { id: 'g', members: [...['a', 'b', 'c', 'd', 'e'].map((u) => mem(u.toUpperCase(), u)), mem('F', 'f', '2026-09-22T13:00:00.000Z')] };
  const hist = [...HIST_UP_DOWN, gm('c3', '2026-09-24T15:00:00-03:00', ['f', 'b'], ['c', 'e'], 'A')];
  const { prev, rows } = raceFor(hist, group);
  assert.ok(!prev.some((r) => r.userId === 'f'), 'F no tenía fila en la Race previa');
  const f = rows.find((r) => r.userId === 'f');
  assert.ok(f, 'F ya figura en la Race actual');
  assert.equal(f.movement, undefined, 'sin posición previa comparable → ningún indicador');
});

test('RACE-5) la presentación NO toca la deportiva: puntos/posiciones/top 2/bonus idénticos a V04.36 y a la tabla base; solo se agregan movement/movementSlot', () => {
  const { base, rows } = raceFor(HIST_UP_DOWN);
  assert.deepEqual(plain(rows.map(({ movement, movementSlot, ...rest }) => rest)), plain(base));
  // computeRaceAnual SIN opts == el de V04.36 (byte a byte) y las demás tablas semanales también.
  const OLD = sbOld.PLGroups;
  assert.deepEqual(plain(PG.computeRaceAnual(HIST_UP_DOWN, GROUP, 2026)), plain(OLD.computeRaceAnual(HIST_UP_DOWN, GROUP, 2026)));
  [T_WEEK, new Date(T_WEEK.getTime() - PG.WEEK_MS)].forEach((w) => assert.deepEqual(plain(PG.computeWeeklyTable(HIST_UP_DOWN, GROUP, w)), plain(OLD.computeWeeklyTable(HIST_UP_DOWN, GROUP, w))));
  assert.deepEqual(plain(PG.buildRaceWeeklySummary(HIST_UP_DOWN, GROUP, 2026, { userId: 'b', name: 'B' })), plain(OLD.buildRaceWeeklySummary(HIST_UP_DOWN, GROUP, 2026, { userId: 'b', name: 'B' })));
  assert.deepEqual(plain(PG.buildGroupIntelligence({ currentTable: PG.computeWeeklyTable(HIST_UP_DOWN, GROUP, T_WEEK), previousTable: [], raceTable: base, currentMatches: PG.computeMatchesForGroupInWeek(HIST_UP_DOWN, GROUP, T_WEEK), fullHistory: HIST_UP_DOWN })),
    plain(OLD.buildGroupIntelligence({ currentTable: OLD.computeWeeklyTable(HIST_UP_DOWN, GROUP, T_WEEK), previousTable: [], raceTable: OLD.computeRaceAnual(HIST_UP_DOWN, GROUP, 2026), currentMatches: OLD.computeMatchesForGroupInWeek(HIST_UP_DOWN, GROUP, T_WEEK), fullHistory: HIST_UP_DOWN })));
});

test('RACE-6) cableado: usa la frontera BA (weekStart), compara con la Race hasta la semana anterior, Intelligence sigue sobre la tabla base y el lenguaje visual es el de Ranking', () => {
  const fn = app.slice(app.indexOf('function renderActiveGroupPanels'), app.indexOf('function initGroupsScreen'));
  assert.match(fn, /const raceTable = PG\.annotateRaceMovement\(raceTableBase, PG\.computeRaceAnual\(fullHistory, group, year, \{ beforeWeekStartMs: weekStart\.getTime\(\) \}\)\);/);
  assert.match(fn, /raceTable: raceTableBase/); // Intelligence grupal no cambia
  const row = app.slice(app.indexOf('function buildGroupRaceMovementHTML'), app.indexOf('function buildGroupTableRowHTML'));
  assert.match(row, /if \(!row\.movementSlot\) return '';/);
  assert.match(row, /ranking-row__movement group-table__movement \$\{d > 0 \? 'is-up' : 'is-down'\}/); // mismas clases que Ranking
  assert.match(row, /`↑ \$\{d\}` : `↓ \$\{Math\.abs\(d\)\}`/);
  assert.match(css, /\.ranking-row__movement\.is-up\{ color: var\(--brand-lime\); \}/);
  assert.match(css, /\.ranking-row__movement\.is-down\{ color: var\(--danger\); \}/);
  // computeRaceAnual sigue agrupando por semana BA (guarda existente) y acepta el corte.
  assert.match(read('groups.js'), /function computeRaceAnual\(fullHistory, group, year, opts\) \{[\s\S]{0,400}computeGroupYearWeekStarts\(fullHistory, group, year\)/);
});
