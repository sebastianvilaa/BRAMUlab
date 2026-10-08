// BRAMUlab V04.37-h2 — hotfix visual: (1) línea de Evolución celeste y suavizada sin alterar la serie; (2) avatares reales en Ranking por playerId, en batch.
// Ejecutar con: node --test bramulab/tests/v0437-h2-evolucion-avatares.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const app = read('app.js'); const css = read('styles.css');
const between = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));

/* ---------------- 1. Evolución: trazo ---------------- */
const smoothSrc = between('function buildSmoothLinePath(coords)', '  function buildLevelEvolutionSvgHTML');
const ctx = {}; vm.createContext(ctx); vm.runInContext(smoothSrc + '\nthis.smooth = buildSmoothLinePath;', ctx);
const smooth = ctx.smooth;
const parse = (d) => {
  const [, m0] = d.match(/^M ([\d.-]+),([\d.-]+)/); const start = [Number(m0), Number(d.match(/^M [\d.-]+,([\d.-]+)/)[1])];
  const segs = [...d.matchAll(/C ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)/g)].map((m) => m.slice(1).map(Number));
  return { start, segs };
};
const bez = (p0, c1, c2, p1, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1; };

test('EV-1) el trazo suavizado pasa EXACTAMENTE por cada punto real (extremos incluidos) y mantiene el orden en X', () => {
  const pts = [[34, 150], [90, 120], [150, 130], [210, 60], [270, 62], [310, 40]];
  const { start, segs } = parse(smooth(pts));
  assert.deepEqual(start, pts[0]);
  assert.equal(segs.length, pts.length - 1);
  segs.forEach((s, i) => { assert.deepEqual([s[4], s[5]], pts[i + 1], `pasa por el punto ${i + 1}`); assert.ok(s[0] >= pts[i][0] && s[2] <= pts[i + 1][0], 'control points entre las X de sus puntos'); });
});

test('EV-2) SIN overshoot: ningún tramo sale del rango [min,max] de sus dos puntos (no inventa máximos ni mínimos) — 300 series aleatorias', () => {
  let seed = 11; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let r = 0; r < 300; r += 1) {
    const n = 2 + Math.floor(rnd() * 12);
    let x = 34; const pts = [];
    for (let i = 0; i < n; i += 1) { pts.push([x, Math.round(20 + rnd() * 140)]); x += 10 + Math.floor(rnd() * 40); }
    if (r % 7 === 0) pts.forEach((p, i) => { if (i % 2) p[1] = pts[i - 1][1]; }); // tramos planos
    const { start, segs } = parse(smooth(pts));
    let prev = start;
    segs.forEach((s, i) => {
      const lo = Math.min(pts[i][1], pts[i + 1][1]) - 0.35; const hi = Math.max(pts[i][1], pts[i + 1][1]) + 0.35; // 0.35 = redondeo a 1 decimal del path
      for (let k = 0; k <= 40; k += 1) {
        const y = bez(prev[1], s[1], s[3], s[5], k / 40);
        assert.ok(y >= lo && y <= hi, `serie ${r} tramo ${i}: y=${y.toFixed(2)} fuera de [${lo},${hi}]`);
      }
      prev = [s[4], s[5]];
    });
  }
});

test('EV-3) casos borde: 2 puntos = recta; tramo plano queda plano; pico/valle real conserva su extremo; serie de 1 punto no dibuja', () => {
  assert.equal(smooth([[34, 100], [310, 40]]), 'M 34.0,100.0 L 310.0,40.0');
  const flat = parse(smooth([[0, 50], [50, 50], [100, 50]]));
  flat.segs.forEach((s) => assert.deepEqual([s[1], s[3]], [50, 50]));
  const peak = parse(smooth([[0, 100], [50, 20], [100, 100]]));
  assert.equal(peak.segs[0][5], 20); assert.equal(peak.segs[0][3], 20); assert.equal(peak.segs[1][1], 20); // tangente horizontal en el pico: sin overshoot
  assert.match(between('const pathD = coords.length > 1', 'const lineHTML'), /buildSmoothLinePath\(coords\)/);
  assert.match(app, /return '';[\s\S]{0,40}const \{ yMin, yMax, step \}/); // sin puntos no hay gráfico
});

test('EV-4) línea celeste BRAMU (--accent-cyan #199FFF); datos, ejes, animación e Intelligence intactos; sin dots ni tooltips nuevos', () => {
  assert.match(css, /\.evolution-chart__line\{ stroke: var\(--accent-cyan\);/);
  assert.match(css, /--accent-cyan: #199FFF;/);
  const svg = between('function buildLevelEvolutionSvgHTML', 'function animateEvolutionLine').split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');
  assert.doesNotMatch(svg, /<circle|<title|data-tip|tooltip/); // línea limpia
  assert.match(svg, /const \{ yMin, yMax, step \} = computeLevelYAxis\(points\.map\(\(p\) => p\.level\)\);/); // ejes desde la serie, sin cambios
  assert.match(svg, /xLabelsHTML/); assert.match(svg, /gridHTML/);
  assert.match(app, /animateEvolutionLine\(wrap\.querySelector\('\.evolution-chart__line'\)\)/);
  // la serie/insight no se tocan: PH.buildRealLevelEvolution sigue siendo la fuente (no hay otra ruta)
  assert.match(app, /PH\.buildRealLevelEvolution\(levelEvolutionV1\.raw, new Date\(\)\)/);
  assert.ok(!/smooth|spline/i.test(read('player-home.js').slice(read('player-home.js').indexOf('function buildRealLevelEvolution'), read('player-home.js').indexOf('function computeBestWinStreakRange'))));
});

/* ---------------- 2. Ranking: avatares ---------------- */
const avatarSrc = between('const RANKING_AVATAR_TTL_MS', '  function wireRankingRowClicks');
function makeAvatarEnv({ photos = {}, owner = 'u1' } = {}) {
  const calls = [];
  const env = {
    currentUserId: owner, Date, Map, Set, Array,
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'),
    playerInitials: (n) => String(n).trim().slice(0, 1).toUpperCase(),
    isServerBackedSession: () => true,
    Auth: { getPlayersCompact: async (ids) => { calls.push(ids.slice()); return { ok: true, players: new Map(ids.filter((i) => i in photos).map((i) => [i, { avatarSignedUrl: photos[i] }]).concat(ids.filter((i) => !(i in photos)).map((i) => [i, { avatarSignedUrl: null }]))) }; } },
    rows: [], $all: null,
  };
  env.$all = () => env.rows;
  vm.createContext(env);
  vm.runInContext(avatarSrc + '\nthis.api = { buildRankingAvatarHTML, resolveRankingAvatars, rankingAvatarUrl, rankingAvatars };', env);
  const mkRow = (playerId, name) => {
    const av = { outerHTML: `<span class="person-list__avatar">${name[0]}</span>`, classList: { contains: (c) => /person-list__avatar--photo/.test(av.outerHTML) && c === 'person-list__avatar--photo' } };
    return { dataset: { playerId, name }, av, querySelector: () => av };
  };
  return { env, api: env.api, calls, mkRow };
}

test('RK-1) con URL real la fila renderiza <img>; sin foto conserva las iniciales (fallback real); sin playerId (universo local) también iniciales', () => {
  const { api } = makeAvatarEnv();
  api.rankingAvatars.ownerId = 'u1'; api.rankingAvatars.byId.set('p1', { url: 'https://cdn.test/a.png?x=1&y=2', at: Date.now() });
  const withPhoto = api.buildRankingAvatarHTML('Seba', 'p1');
  assert.match(withPhoto, /^<span class="person-list__avatar person-list__avatar--photo"><img src="https:\/\/cdn\.test\/a\.png\?x=1&amp;y=2" alt="" \/><\/span>$/);
  assert.equal(api.buildRankingAvatarHTML('Matu', 'p2'), '<span class="person-list__avatar">M</span>');
  api.rankingAvatars.byId.set('p3', { url: null, at: Date.now() });
  assert.equal(api.buildRankingAvatarHTML('Gusti', 'p3'), '<span class="person-list__avatar">G</span>');
  assert.equal(api.buildRankingAvatarHTML('Local', undefined), '<span class="person-list__avatar">L</span>');
});

test('RK-2) resolución en BATCH: 50 filas (con repetidos) = UNA sola llamada con ids únicos; el cache evita volver a pedir; el no-foto no se re-pide', async () => {
  const photos = {}; for (let i = 0; i < 50; i += 1) if (i % 2 === 0) photos[`p${i}`] = `https://cdn.test/p${i}.png`;
  const { env, api, calls, mkRow } = makeAvatarEnv({ photos });
  env.rows = Array.from({ length: 50 }, (_, i) => mkRow(`p${i}`, `N${i}`)).concat([mkRow('p0', 'N0'), mkRow('p1', 'N1')]);
  await api.resolveRankingAvatars();
  assert.equal(calls.length, 1, 'una sola llamada batch (no N+1)');
  assert.equal(calls[0].length, 50); assert.equal(new Set(calls[0]).size, 50);
  // Las filas con foto se reemplazaron por <img>; las demás conservan iniciales.
  env.rows.forEach((r) => assert.equal(/<img /.test(r.av.outerHTML), Number(r.dataset.playerId.slice(1)) % 2 === 0, r.dataset.playerId));
  await api.resolveRankingAvatars();
  assert.equal(calls.length, 1, 'segunda pasada: todo en cache (también los sin foto)');
  env.rows.push(mkRow('p99', 'Nuevo')); await api.resolveRankingAvatars();
  assert.equal(calls.length, 2); assert.deepEqual(calls[1], ['p99'], 'solo se pide lo que falta');
});

test('RK-3) el cache es por cuenta (otro usuario no hereda fotos) y las URLs vencidas se refrescan', async () => {
  const { env, api, calls, mkRow } = makeAvatarEnv({ photos: { p1: 'https://cdn.test/1.png' } });
  env.rows = [mkRow('p1', 'Uno')]; await api.resolveRankingAvatars(); assert.equal(calls.length, 1);
  env.currentUserId = 'u2'; assert.equal(api.rankingAvatarUrl('p1'), null, 'otra cuenta: cache vacío');
  env.currentUserId = 'u1'; api.rankingAvatars.ownerId = 'u1'; api.rankingAvatars.byId.set('p1', { url: 'https://cdn.test/1.png', at: Date.now() - 31 * 60 * 1000 });
  assert.equal(api.rankingAvatarUrl('p1'), null, 'URL vencida');
  env.rows = [mkRow('p1', 'Uno')]; await api.resolveRankingAvatars(); assert.equal(calls.length, 2, 'se refresca en un batch');
});

test('RK-4) cableado: ambas filas (clasificación y sin posición) usan el avatar por playerId; se resuelve al pintar cualquier lista; sin acoplarse a Mis Grupos ni a N+1', () => {
  const rowFn = between('function buildRankingRowHTML', 'function buildUnrankedRowHTML');
  assert.match(rowFn, /\$\{buildRankingAvatarHTML\(entry\.name, entry\.playerId\)\}/); assert.doesNotMatch(rowFn, /buildGroupAvatarHTML/);
  const unr = between('function buildUnrankedRowHTML', 'function wireRankingRowClicks').slice(0, 2600);
  assert.match(unr, /\$\{buildRankingAvatarHTML\(p\.name, p\.playerId\)\}/); assert.doesNotMatch(unr.split('function wireRankingRowClicks')[0], /buildGroupAvatarHTML/);
  assert.doesNotMatch(avatarSrc, /groupsServer|groupsUseServer|ensureGroupIdentities/);
  assert.equal((avatarSrc.match(/Auth\.getPlayersCompact\(/g) || []).length, 1, 'una sola llamada, sobre el conjunto');
  assert.doesNotMatch(avatarSrc.slice(avatarSrc.indexOf('async function resolveRankingAvatars')), /\.forEach\(async|for \(const[^)]*\) \{[^}]*await Auth/);
  assert.match(between('function wireRankingRowClicks', 'function rankingUsernameMap'), /^function wireRankingRowClicks\(containerId\) \{[\s\S]*?resolveRankingAvatars\(\);/);
  // Ranking sin cambios: posición, Nivel, movimiento y filtros siguen en las mismas funciones.
  assert.match(rowFn, /entry\.position/); assert.match(rowFn, /entry\.level\.toFixed\(1\)/); assert.match(rowFn, /rankingMovementClass\(mv\)/);
  assert.match(app, /renderRankingClassification\(view\);\s*renderRankingUnrankedSections\(view\);/);
});

test('RK-5) versionado 04.37-h2 con APP_VERSION V04.37 (sin cambiar la versión visible)', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.37', bundle: '04.37-h2' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.37'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.37-h2'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-37-h2'/);
});
