// BRAMU Metrics V1 · F3 (04.37-h29) + F4 (04.37-h30) + F6 Explorar (04.37-h31) — consola privada /admin/metrics.
// node --test bramulab/metrics-f3-dashboard.test.mjs
// Cubre: funciones puras de la UI, contrato con el SQL REAL (el fixture de QA no puede divergir del backend), seguridad/privacidad
// estática de la página, publicación en dist/ (fixture solo en Staging), Service Worker (bypass de /admin/), headers y robots.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDist, DIST_DIRS, QA_FIXTURE_FILE } from './scripts/build-dist.mjs';
import { replay } from '../supabase/scripts/replay-migrations.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const NB = ' ';

function loadMetrics() {
  const sb = { console, Intl, Date, Math, Number, String, Array, Set, Object, JSON, isNaN, isFinite, URLSearchParams, __MX_NO_BOOT__: true };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(read('admin/metrics/metrics.js'), sb);
  return sb.PLMetricsAdmin;
}
function loadFixture() {
  const sb = { console, Intl, Date, Math, Number, String, Array, Object, JSON, Promise, setTimeout };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(read('admin/metrics/qa-fixture.js'), sb);
  return sb.PLMetricsQaFixture;
}
const M = loadMetrics();
const Q = loadFixture();

/* ---------------- Formato y estados ---------------- */

test('formatValue: ratio en %, horas, días, enteros con separador es-AR y guion para nulos (nunca 0 inventado)', () => {
  assert.equal(M.formatValue({ id: 'x', kind: 'ratio' }, 0.6), `60${NB}%`);
  assert.equal(M.formatValue({ id: 'x', kind: 'ratio' }, 0.923), `92,3${NB}%`);
  assert.equal(M.formatValue({ id: 'matches.validation_p50_hours', kind: 'duration' }, 9.5), `9,5${NB}h`);
  assert.equal(M.formatValue({ id: 'activation.median_days_to_first_load', kind: 'duration' }, 11.83), `11,8${NB}días`);
  assert.equal(M.formatValue({ id: 'users.signups', kind: 'flow' }, 12), '12');
  assert.match(M.formatValue({ id: 'users.signups', kind: 'flow' }, 12345), /^12\.?345$/);
  assert.equal(M.formatValue({ id: 'usage.dau_avg', kind: 'flow' }, 5.24), '5,2');
  for (const v of [null, undefined, NaN, '3']) assert.equal(M.formatValue({ id: 'x', kind: 'flow' }, v), '—');
});

test('deltaView: respeta TODAS las notas del contrato (sin % engañoso con base cero, stock sin comparación, pp en ratios)', () => {
  const k = (id, kind, delta) => ({ id, kind, delta });
  assert.equal(M.deltaView(k('users.signups', 'flow', { abs: 5, pct: 100, note: null }), false), null, 'comparación apagada');
  assert.equal(M.deltaView(k('users.signups', 'flow', { abs: null, pct: null, note: 'sin_comparacion' }), true), null);
  let d = plain(M.deltaView(k('users.signups', 'flow', { abs: 5, pct: 100, note: null }), true));
  assert.deepEqual([d.tone, d.arrow, d.text], ['good', '▲', `+5 · +100${NB}%`]);
  d = plain(M.deltaView(k('matches.annulled', 'flow', { abs: 2, pct: 66.7, note: null }), true));
  assert.equal(d.tone, 'bad', 'más anulados es malo');
  d = plain(M.deltaView(k('matches.validation_p50_hours', 'duration', { abs: -4.7, pct: -33.1, note: null }), true));
  assert.deepEqual([d.tone, d.arrow], ['good', '▼']);
  d = plain(M.deltaView(k('users.guests_open', 'flow', { abs: 3, pct: 20, note: null }), true));
  assert.equal(d.tone, 'neutral', 'sin juicio de valor definido => azul neutro');
  d = plain(M.deltaView(k('users.signups', 'flow', { abs: 4, pct: null, note: 'base_previa_cero' }), true));
  assert.ok(!/%/.test(d.text), 'sin porcentaje con base previa 0'); assert.equal(d.sub, 'sin base previa (0)');
  d = plain(M.deltaView(k('matches.validation_rate_closed', 'ratio', { abs: 12, pct: null, note: 'puntos_porcentuales' }), true));
  assert.equal(d.text, `+12${NB}pp`);
  d = plain(M.deltaView(k('users.registered_now', 'stock', { abs: null, pct: null, note: 'stock_sin_comparacion' }), true));
  assert.equal(d.text, 'Saldo al corte');
  d = plain(M.deltaView(k('x.y', 'ratio', { abs: null, pct: null, note: 'sin_datos_suficientes' }), true));
  assert.equal(d.text, 'Sin datos suficientes para comparar');
  d = plain(M.deltaView(k('users.signups', 'flow', { abs: 0, pct: 0, note: null }), true));
  assert.deepEqual([d.tone, d.text], ['flat', 'Sin cambios']);
});

test('availabilityView: cada estado tiene rótulo propio; no medible muestra desde cuándo; la muestra insuficiente muestra n y mínimo', () => {
  const a = (kpi, meta) => plain(M.availabilityView(kpi, meta || { minCell: 5 }));
  assert.equal(a({ availability: 'ok' }), null);
  assert.deepEqual(a({ availability: 'no_evidence' }), { tone: 'none', text: 'Sin registros en el período' });
  assert.equal(a({ availability: 'insufficient_sample', n: 4 }).text, 'Muestra insuficiente · n = 4 (mínimo 5)');
  assert.equal(a({ availability: 'not_instrumented', since: '2026-10-12' }).text, 'Todavía no medible · captura desde 12/10');
  assert.match(a({ availability: 'not_instrumented', since: null }).text, /sin fecha de inicio de captura/);
  assert.equal(a({ availability: 'immature' }).tone, 'wait');
  assert.equal(a({ availability: 'ok', since: '2026-10-07' }).text, 'Captura parcial · desde 07/10');
  assert.equal(M.previousText({ id: 'x', kind: 'flow', previous: { value: null } }, true), 'Anterior: sin datos');
  assert.equal(M.previousText({ id: 'x', kind: 'stock', previous: { value: 3 } }, true), null, 'el stock no muestra «anterior»');
  assert.equal(M.previousText({ id: 'x', kind: 'flow', previous: { value: 3 } }, false), null);
});

test('ventanas (D8): días completos en hora de Buenos Aires; el fin exclusivo se muestra como el último día incluido (nunca «hoy»)', () => {
  assert.equal(M.windowLabel(['2026-09-08T03:00:00+00:00', '2026-10-08T03:00:00+00:00']), '08/09 – 07/10');
  assert.equal(M.windowLabel(['2026-08-09T03:00:00+00:00', '2026-09-08T03:00:00+00:00']), '09/08 – 07/09');
  assert.equal(M.windowLabel(['2026-10-08T03:00:00+00:00', '2026-10-08T03:00:00+00:00']), 'sin días completos todavía', 'histórico con datos solo de hoy');
  assert.equal(M.windowLabel(null), '—');
  assert.ok(!/hoy/.test(M.windowLabel(['2026-09-08T03:00:00+00:00', '2026-10-08T03:00:00+00:00'])));
  assert.equal(M.baDate('2026-09-09T02:59:59+00:00'), '2026-09-08', 'antes de las 03:00Z todavía es el día anterior en BA');
  assert.equal(M.fmtDayMonth('2026-10-02'), '02/10');
});

test('chartModel: ticks enteros, barras con previa alineada por índice, vacío => estado sin datos, etiquetas acotadas', () => {
  const days = (vals, start = 1) => vals.map((v, i) => ({ start: `2026-09-${String(start + i).padStart(2, '0')}`, value: v }));
  let m = M.chartModel({ granularity: 'day', current: days([0, 1, 0, 1, 1]), previous: days([1, 1, 0, 0, 0], 1) }, { compare: true });
  assert.equal(m.empty, false); assert.equal(m.kind, 'bars');
  assert.ok(m.yTicks.every((t) => Number.isInteger(t.v)), 'ticks enteros en conteos chicos');
  assert.equal(new Set(m.yTicks.map((t) => t.v)).size, m.yTicks.length, 'sin ticks duplicados');
  assert.equal(m.curPts.length, 5); assert.equal(m.prevPts.length, 5);
  assert.equal(m.prevPts[2].x, m.curPts[2].x, 'previa alineada con la actual');
  assert.ok(m.curPts[1].y < m.curPts[0].y, 'más valor => más alto');
  m = M.chartModel({ granularity: 'day', current: days([0, 0, 0]), previous: days([0, 0, 0]) }, { compare: true });
  assert.equal(m.empty, true);
  m = M.chartModel({ granularity: 'day', current: days([0, 0, 0]), previous: days([2, 0, 0]) }, { compare: false });
  assert.equal(m.empty, true, 'con comparación apagada la previa no cuenta');
  assert.equal(m.prevPts, null);
  m = M.chartModel({ granularity: 'week_ba', current: days(Array.from({ length: 30 }, (_, i) => i % 5)), previous: null }, { compare: true });
  assert.ok(m.xLabels.length <= 5 && m.xLabels.length >= 2);
  assert.ok(m.curPts.every((p) => p.x > m.pad.l && p.x < m.W - m.pad.r));
  assert.equal(M.chartModel({ granularity: 'day', current: [], previous: null }, {}).empty, true);
  const big = M.chartModel({ granularity: 'day', current: days([0, 120, 40]), previous: null }, {});
  assert.ok(big.yTicks.length <= 7); assert.ok(big.ymax >= 120);
});

test('seriesFor/parseHash/apiErrorKind/qaAllowed', () => {
  assert.equal(plain(M.seriesFor('users.signups', { series: { signups: { current: [] } } })).def.key, 'signups');
  assert.equal(M.seriesFor('users.registered_now', { series: {} }), null);
  assert.equal(M.seriesFor('matches.created', { series: {} }), null);
  assert.deepEqual(plain(M.parseHash('')), { view: 'inicio' });
  assert.deepEqual(plain(M.parseHash('#/usuarios')), { view: 'usuarios' });
  assert.deepEqual(plain(M.parseHash('#/kpi/matches.validated')), { view: 'kpi', kpiId: 'matches.validated' });
  for (const bad of ['#/kpi/evil.id;drop', '#/kpi/otra.cosa', '#/kpi/../x', '#/admin', '#/kpi/users.<script>']) assert.deepEqual(plain(M.parseHash(bad)), { view: 'inicio' }, bad);
  assert.deepEqual([401, 403, 429, 400, 500, 502].map((s) => M.apiErrorKind(s, true)), ['session', 'forbidden', 'rate', 'bad', 'server', 'server']);
  assert.equal(M.apiErrorKind(null, true), 'network');
  assert.equal(M.qaAllowed({ name: 'production' }, 'localhost'), false, 'nunca en Production');
  assert.equal(M.qaAllowed({ name: 'staging' }, 'x.vercel.app'), true);
  assert.equal(M.qaAllowed(null, 'localhost'), true);
  assert.equal(M.qaAllowed(null, 'app.bramulab.com'), false);
  assert.equal(M.qaAllowed(undefined, 'evil.localhost.example.com'), false);
});

/* ---------------- Contrato con el backend REAL ---------------- */

const migrationsDir = path.join(dir, '..', 'supabase', 'migrations');
const catalogMigration = fs.readdirSync(migrationsDir).filter((f) => f.startsWith('20261008') && /\$cat\$/.test(fs.readFileSync(path.join(migrationsDir, f), 'utf8'))).sort().at(-1);
const migration = fs.readFileSync(path.join(migrationsDir, catalogMigration), 'utf8');
const sqlCatalog = JSON.parse(/\$cat\$(\[[\s\S]*?\])\$cat\$/.exec(migration)[1]);

test('contrato: el catálogo del fixture es copia EXACTA del de la última migración (si el backend cambia, este test obliga a actualizar el QA)', () => {
  assert.deepEqual(plain(Q.CATALOG), sqlCatalog);
  assert.equal(sqlCatalog.length, 55);
});

test('contrato: cada sección del fixture trae exactamente los KPIs del catálogo, con las claves del contrato y valores coherentes', () => {
  for (const state of ['', 'empty', 'sparse', 'nopresence']) {
    for (const range of ['7d', '30d', '90d', 'all']) {
      for (const section of ['users', 'matches', 'activation', 'community', 'usage']) {
        const r = Q.respond({ section, range, compare: true }, state);
        assert.deepEqual(plain(r.kpis.map((k) => k.id)), sqlCatalog.filter((e) => e.section === section).map((e) => e.id), `${section}/${range}/${state}`);
        for (const k of r.kpis) {
          assert.deepEqual(plain(Object.keys(k).sort()), ['availability', 'count', 'definition', 'delta', 'id', 'kind', 'label', 'n', 'population', 'previous', 'since', 'snapshot', 'value']);
          if (k.snapshot) { assert.equal(k.previous, null, k.id); assert.equal(k.delta.note, r.meta.compare ? 'stock_sin_comparacion' : 'sin_comparacion', k.id); }
          if (['insufficient_sample', 'not_instrumented', 'immature'].includes(k.availability)) { assert.equal(k.value, null); assert.equal(k.count, null); }
        }
        assert.equal(r.meta.minCell, 5); assert.equal(r.meta.environment, 'qa');
      }
    }
  }
  const o = Q.respond({ section: 'overview', range: '30d' }, '');
  assert.deepEqual(plain(o.kpis.map((k) => k.id)), ['users.registered_now', 'users.signups', 'usage.wau', 'matches.created', 'matches.validated', 'community.groups_active']);
  assert.equal(o.funnel.length, 7);
  const off = Q.respond({ section: 'users', range: '30d', compare: false }, '');
  assert.equal(off.meta.compare, false); assert.equal(off.series.signups.previous, null); assert.ok(off.kpis.every((k) => k.previous === null));
  const all = Q.respond({ section: 'matches', range: 'all' }, '');
  assert.equal(all.meta.previousWindow, null);
});

test('contrato: el armado de KPI del fixture coincide con _metrics_kpi del SQL real en valor, disponibilidad y comparación', async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok);
  const db = r.db;
  try {
    const entry = (kind, minN, snapshot) => ({ id: 'x.k', section: 'x', label: 'L', kind, definition: 'D', population: 'P', ...(minN ? { minN } : {}), ...(snapshot ? { snapshot: true } : {}) });
    const cases = [
      ['flow', 0, { v: 10 }, { v: 5 }], ['flow', 0, { v: 4 }, { v: 0 }], ['flow', 0, { v: 0 }, { v: 0 }], ['flow', 0, { v: 3 }, { v: 7 }],
      ['stock', 0, { v: 4, n: 4 }, { v: 3, n: 3 }],
      ['ratio', 5, { v: 0.6, n: 10 }, { v: 0.4, n: 10 }], ['ratio', 5, { v: 0.6, n: 3 }, { v: 0.4, n: 10 }], ['ratio', 5, { v: 0.6, n: 10 }, { v: 0.4, n: 2 }], ['ratio', 5, { v: 0.5, n: 8 }, { v: 0.5, n: 9 }],
      ['duration', 5, { v: 9.5, n: 29 }, { v: 14.2, n: 18 }], ['duration', 5, { v: 9.5, n: 2 }, { v: 14.2, n: 18 }],
      ['ratio', 5, { v: null, a: 'immature' }, { v: null, a: 'immature' }], ['flow', 0, { v: null, a: 'not_instrumented' }, { v: null, a: 'not_instrumented' }],
      ['ratio', 5, { v: 0.6, n: 10 }, { v: 0.4, n: 10 }, true], ['ratio', 5, { v: 0.6, n: 3 }, { v: 0.4, n: 10 }, true],
    ];
    for (const [kind, minN, cur, prev, snap] of cases) {
      const e = entry(kind, minN, snap);
      const sql = (await db.query(`select public._metrics_kpi($1::jsonb, $2::jsonb, $3::jsonb, true) as r`, [JSON.stringify(e), JSON.stringify({ 'x.k': cur }), JSON.stringify({ 'x.k': prev })])).rows[0].r;
      const js = plain(Q.__build(e, cur, prev, true));
      const norm = (k) => ({ value: k.value, availability: k.availability, delta: k.delta, snapshot: k.snapshot, prev: k.previous && { value: k.previous.value, availability: k.previous.availability } });
      assert.deepEqual(norm(js), norm(sql), JSON.stringify([kind, cur, prev]));
    }
  } finally { await db.close(); }
});

/* ---------------- Seguridad y privacidad (estática) ---------------- */

test('HTML: privado y no indexable, NO es PWA, supabase-js fijado con el MISMO SRI que la app, rutas absolutas', () => {
  const html = read('admin/metrics/index.html');
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.ok(!/rel="manifest"/.test(html) && !/serviceWorker/.test(html) && !/apple-touch-icon/.test(html), 'sin manifest ni registro de SW');
  const tag = (src) => /<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+)" integrity="([^"]+)"/.exec(src);
  const [, u1, i1] = tag(html); const [, u2, i2] = tag(read('index.html'));
  assert.deepEqual([u1, i1], [u2, i2], 'pin exacto + SRI idénticos a los de la app');
  assert.match(u1, /supabase-js@\d+\.\d+\.\d+\//);
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(dir, m[1].replace(/^\//, ''))) || m[1] === '/env.generated.js' || m[1] === '/admin/metrics/', m[1]);
  assert.ok(!/<script(?![^>]*src)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'sin JS inline');
});

test('metrics.js: sin innerHTML/eval, sin secretos, la autorización la decide el servidor (no el nombre) y no guarda datos en storage', () => {
  const js = read('admin/metrics/metrics.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const bad of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\(/, /new Function/, /service_role/i, /SERVICE_ROLE/, /\.from\(['"]/, /\.rpc\(/]) assert.ok(!bad.test(code), String(bad));
  assert.match(code, /functions\.invoke\('admin-metrics'/);
  assert.ok(!/username|@usuario|\.email|user_metadata|app_metadata|display_name/.test(code), 'ninguna decisión de acceso por nombre/email/metadatos');
  const stor = code.match(/localStorage\.[a-zA-Z]+\([^)]*\)/g) || [];
  assert.ok(stor.length === 2 && stor.every((s) => /PREF_KEY/.test(s)), 'solo preferencias en storage: ' + stor.join(' | '));
  assert.ok(!/sessionStorage|indexedDB|caches\./.test(code));
  assert.ok(!/console\.(log|info|debug)/.test(code), 'sin logs de datos');
  assert.match(code, /meta\.environment !== env\.name/, 'verifica el entorno que responde el servidor');
  assert.match(code, /qaAllowed\(env, global\.location\.hostname\)/);
});

test('sin fichas individuales: la consola no tiene búsqueda, listados ni navegación por jugador', () => {
  const code = read('admin/metrics/metrics.js') + read('admin/metrics/index.html');
  assert.ok(!/playerId|player_id|<input[^>]*type="(search|text)"|buscar|searchPlayers|search_players/i.test(code));
  assert.equal((read('admin/metrics/index.html').match(/<input/g) || []).length, 2, 'solo los 2 interruptores');
});

test('fixture QA: rotulado como datos de prueba y solo cargable fuera de Production', () => {
  const f = read('admin/metrics/qa-fixture.js');
  assert.match(f, /INVENTADOS/); assert.match(f, /NO son datos de ningún entorno/);
  assert.equal(Q.respond({ section: 'users', range: '30d' }, '').meta.environment, 'qa');
  const js = read('admin/metrics/metrics.js');
  assert.match(js, /DATOS DE PRUEBA \(QA\) · NO PRODUCTION/);
  assert.match(js, /const QA = params\.get\('qa'\) === '1' && qaAllowed\(env, global\.location\.hostname\)/);
});

/* ---------------- Publicación ---------------- */

test('build: admin/ entra en la allowlist; el fixture de QA solo en Staging; dist valida las referencias de la página', () => {
  assert.ok(DIST_DIRS.includes('admin'));
  for (const variant of ['official', 'staging']) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-dist-'));
    try {
      const built = buildDist({ outDir: out, requireGenerated: false, iconVariant: variant });
      assert.deepEqual(built.problems, [], variant);
      for (const f of ['admin/metrics/index.html', 'admin/metrics/metrics.js', 'admin/metrics/metrics.css']) assert.ok(built.files.includes(f), `${variant}: ${f}`);
      assert.equal(built.files.includes(QA_FIXTURE_FILE), variant === 'staging', `${variant}: fixture ${variant === 'staging' ? 'presente' : 'AUSENTE'}`);
      assert.ok(!built.files.some((f) => /\.test\.mjs$|^api\/|^scripts\//.test(f)), 'ningún test ni api en dist');
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

function loadSw() {
  const listeners = {}; const log = { cacheOpen: 0, fetched: [] };
  const sb = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://app.test' }, skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => { log.cacheOpen += 1; return { put() {}, addAll: async () => {} }; }, match: async () => undefined, keys: async () => [], delete: async () => true },
    fetch: async (req) => { log.fetched.push(req.url); return { clone() { return this; }, status: 200 }; },
    Response: class { constructor(b, o) { this.body = b; this.status = o && o.status; } },
    URL, console,
  };
  vm.createContext(sb); vm.runInContext(read('sw.js'), sb);
  return { listeners, log };
}

test('Service Worker: /admin/* NO se intercepta (sin respondWith, sin caché); el resto de la app sigue como antes', async () => {
  for (const url of ['https://app.test/admin/metrics/', 'https://app.test/admin/metrics', 'https://app.test/admin/metrics/metrics.js']) {
    const { listeners, log } = loadSw(); let responded = false;
    listeners.fetch({ request: { method: 'GET', url, mode: url.endsWith('/') ? 'navigate' : 'no-cors' }, respondWith: () => { responded = true; } });
    assert.equal(responded, false, url); assert.equal(log.cacheOpen, 0);
  }
  const { listeners } = loadSw(); let responded = false;
  listeners.fetch({ request: { method: 'GET', url: 'https://app.test/index.html', mode: 'navigate' }, respondWith: () => { responded = true; } });
  assert.equal(responded, true, 'la app sí pasa por el SW');
  assert.ok(!/admin/.test(read('sw.js').slice(read('sw.js').indexOf('CORE_ASSETS = ['), read('sw.js').indexOf('];', read('sw.js').indexOf('CORE_ASSETS = [')))), 'la consola no se precachea');
});

test('Vercel/robots: headers noindex + no-store + no-referrer para /admin/*; robots de Production excluye /admin/ y el resto sigue igual', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.deepEqual(v.rewrites, [{ source: '/robots.txt', destination: '/robots.generated.txt' }]);
  const h = v.headers.find((x) => x.source === '/admin/(.*)');
  const map = Object.fromEntries(h.headers.map((x) => [x.key, x.value]));
  assert.match(map['X-Robots-Tag'], /noindex/); assert.equal(map['Cache-Control'], 'no-store'); assert.equal(map['Referrer-Policy'], 'no-referrer');
  const env = read('scripts/build-env.mjs');
  assert.match(env, /envName === 'production' \? 'User-agent: \*\\nDisallow: \/admin\/\\nAllow: \/\\n' : 'User-agent: \*\\nDisallow: \/\\n'/);
});

test('versionado: V04.39-h5 sincronizado (ronda visible: Bienvenida, invitación genérica y Ayuda); la app no enlaza a la consola', () => {
  assert.equal(JSON.parse(read('version.json')).bundle, '04.39-h5');
  assert.equal(JSON.parse(read('version.json')).version, 'BRAMUlab V04.39');
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.39-h5'/);
  assert.match(read('sw.js'), /bramulab-v04-39-h5/);
  for (const f of ['index.html', 'app.js', 'player-home.js', 'groups.js']) assert.ok(!/admin\/metrics/.test(read(f)), `${f} no enlaza a la consola`);
});


/* ====================================================================== */
/* F4 — Activación · Comunidad · Uso, D8 (días completos) y «hoy parcial»  */
/* ====================================================================== */

test('F4 · pestañas y rutas: Activación, Comunidad y Uso existen, mapean a su sección del Edge y las rutas no aceptan basura', () => {
  assert.deepEqual(plain(M.VIEWS.map((v) => [v.id, v.section])), [['inicio', 'overview'], ['usuarios', 'users'], ['partidos', 'matches'], ['activacion', 'activation'], ['comunidad', 'community'], ['uso', 'usage'], ['explorar', 'explore']]);
  for (const [hash, view] of [['#/activacion', 'activacion'], ['#/comunidad', 'comunidad'], ['#/uso', 'uso']]) assert.deepEqual(plain(M.parseHash(hash)), { view });
  assert.deepEqual(plain(M.parseHash('#/kpi/community.ranking_eligible_players')), { view: 'kpi', kpiId: 'community.ranking_eligible_players' });
  assert.deepEqual(plain(M.parseHash('#/kpi/usage.ret_w1')), { view: 'kpi', kpiId: 'usage.ret_w1' });
  assert.deepEqual(plain(M.parseHash('#/uso/../x')), { view: 'inicio' });
  // todas las secciones que pide la UI existen en el mapa fijo del Edge (sin cambios de backend para F4)
  const edge = read('../supabase/functions/_shared/admin-metrics-core.mjs');
  for (const v of M.VIEWS.filter((x) => x.id !== 'explorar')) assert.match(edge, new RegExp(`${v.section}: 'metrics_${v.section}'`), v.section);
  assert.match(edge, /metrics_explore/, 'el Explorador usa funciones SQL fijas propias, no un mapa dinámico');
});

test('F4 · series de detalle: grupos, invitaciones y activos diarios tienen gráfico; el resto de los KPIs nuevos es valor puntual', () => {
  for (const [id, key] of [['community.groups_created', 'groups_created'], ['community.invites_created', 'invites_created'], ['usage.dau', 'active_players']]) {
    assert.equal(plain(M.seriesFor(id, { series: { [key]: { current: [] } } })).def.key, key, id);
  }
  for (const id of ['community.ranking_eligible_players', 'usage.ret_w1', 'activation.fifth_match', 'community.groups_avg_members']) assert.equal(M.seriesFor(id, { series: {} }), null, id);
});

test('F4 · snapshot: los ratios foto del estado actual no muestran «anterior» ni variación (se vería «Sin cambios» falso)', () => {
  const k = { id: 'community.level_calibrated_share', kind: 'ratio', snapshot: true, previous: { value: 0.4 }, delta: { abs: 0, pct: null, note: 'stock_sin_comparacion' } };
  assert.equal(M.previousText(k, true), null);
  assert.equal(plain(M.deltaView(k, true)).text, 'Saldo al corte');
  assert.equal(M.previousText({ id: 'matches.validation_rate_closed', kind: 'ratio', previous: { value: 0.4 } }, true), `Anterior: 40${NB}%`, 'un ratio de ventana SÍ compara');
});

test('F4 · estados: Ranking sin ediciones dice «Todavía no se publicó ninguna edición»; el resto de «sin registros» no cambia', () => {
  assert.equal(M.availabilityView({ id: 'community.ranking_eligible_players', availability: 'no_evidence' }, { minCell: 5 }).text, 'Todavía no se publicó ninguna edición de Ranking');
  assert.equal(M.availabilityView({ id: 'community.ranking_days_since_edition', availability: 'no_evidence' }, { minCell: 5 }).text, 'Todavía no se publicó ninguna edición de Ranking');
  assert.equal(M.availabilityView({ id: 'community.groups_created', availability: 'no_evidence' }, { minCell: 5 }).text, 'Sin registros en el período');
});

test('F4 · D8 «hoy parcial»: se presenta aparte, solo con los campos pedidos, y lo no medible dice «Todavía no medible» (nunca 0)', () => {
  const today = { date: '2026-10-08', partial: true, asOf: '2026-10-08T17:35:00Z', signups: 1, matchesCreated: 3, matchesValidated: 0, activePlayers: null };
  let v = plain(M.todayView(today, ['signups', 'activePlayers']));
  assert.deepEqual(v.items.map((i) => [i.key, i.text, i.pending]), [['signups', '1', false], ['activePlayers', 'Todavía no medible', true]]);
  assert.equal(v.upTo, '14:35', 'hora de Buenos Aires');
  v = plain(M.todayView({ ...today, activePlayers: 0 }, ['activePlayers']));
  assert.deepEqual(v.items.map((i) => [i.text, i.pending]), [['0', false]], 'un cero REAL con presencia instrumentada sí se muestra');
  assert.equal(M.todayView(null, ['signups']), null);
  assert.deepEqual(plain(M.todayView(today, ['inexistente']).items), []);
});

test('F4 · el fixture respeta D8: la ventana termina a las 00:00 de hoy (BA), las series terminan ayer y `today` viaja aparte', () => {
  for (const range of ['7d', '30d', '90d', 'all']) {
    const r = Q.respond({ section: 'users', range, compare: true }, '');
    assert.equal(r.meta.completeDaysOnly, true); assert.equal(r.meta.window[1], `${r.meta.today}T03:00:00.000Z`, `${range}: fin = 00:00 BA de hoy`);
    const last = r.series.signups.current.at(-1).start;
    assert.ok(last < r.meta.today, `${range}: la serie termina antes de hoy (${last} < ${r.meta.today})`);
    assert.equal(r.today.partial, true); assert.equal(r.today.date, r.meta.today);
    if (r.meta.previousWindow) assert.equal(new Date(r.meta.window[1]) - new Date(r.meta.window[0]), new Date(r.meta.previousWindow[1]) - new Date(r.meta.previousWindow[0]), `${range}: ambas ventanas miden lo mismo`);
  }
  assert.equal(Q.respond({ section: 'usage', range: '30d' }, 'nopresence').today.activePlayers, null);
});

test('F4 · contrato: las claves de `today`, de los desgloses y de las series del fixture coinciden con las del SQL REAL', async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok);
  try {
    await r.db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
    const sql = async (fn) => (await r.db.query(`select public.${fn}('30d', true, false, '2026-10-08T12:00:00Z') as r`)).rows[0].r;
    for (const section of ['users', 'matches', 'activation', 'community', 'usage']) {
      const real = await sql(`metrics_${section}`); const fx = Q.respond({ section, range: '30d' }, '');
      assert.deepEqual(plain(Object.keys(fx.today).sort()), Object.keys(real.today).sort(), `${section}: today`);
      assert.deepEqual(plain(Object.keys(fx.breakdowns).sort()), Object.keys(real.breakdowns).sort(), `${section}: desgloses`);
      assert.deepEqual(plain(Object.keys(fx.series).sort()), Object.keys(real.series).sort(), `${section}: series`);
      assert.deepEqual(plain(Object.keys(fx.meta).sort()), Object.keys(real.meta).sort(), `${section}: meta`);
      assert.deepEqual(real.kpis.map((k) => k.id), plain(fx.kpis.map((k) => k.id)), `${section}: KPIs`);
    }
    const ov = await sql('metrics_overview'); const fo = Q.respond({ section: 'overview', range: '30d' }, '');
    assert.deepEqual(plain(Object.keys(fo.today).sort()), Object.keys(ov.today).sort());
    const comm = await sql('metrics_community');
    for (const key of ['level_status', 'group_size', 'level_band', 'ranking_density']) assert.ok(comm.breakdowns[key], key);
    assert.equal(comm.breakdowns.level_band.minCell, 10, 'la distribución de Nivel exige n ≥ 10');
  } finally { await r.db.close(); }
});

test('F4 · estática: las vistas nuevas no abren datos individuales, no usan innerHTML y mantienen los tres sistemas separados', () => {
  const js = read('admin/metrics/metrics.js'); const css = read('admin/metrics/metrics.css');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(code));
  for (const sys of ['grupos', 'nivel', 'ranking']) { assert.match(code, new RegExp(`systemSection\\('${sys}'`)); assert.match(css, new RegExp(`\\.mx-h--${sys}::before`)); }
  assert.match(code, /'Grupos BRAMU'/); assert.match(code, /'Nivel BRAMU'/); assert.match(code, /'Ranking BRAMU'/);
  assert.match(css, /\.mx-today/, 'estilo propio para «Hoy · parcial»');
  assert.ok(!/windowLabel\([^)]*,\s*(true|false)\)/.test(code), 'nadie pide ya el rótulo «hoy» de la ventana (D8)');
  assert.ok(!/\bhoy\b/.test(M.windowLabel(['2026-09-08T03:00:00+00:00', '2026-10-08T03:00:00+00:00'])));
});


/* ====================================================================== */
/* F6 — Explorar                                                           */
/* ====================================================================== */

const f6migration = fs.readFileSync(path.join(dir, '..', 'supabase', 'migrations', '20261008130000_metrics_f6_explorar.sql'), 'utf8');
const sqlSpec = JSON.parse(/\$spec\$([\s\S]*?)\$spec\$/.exec(f6migration)[1]);

test('F6 · la selección vive en la URL, se valida y no admite claves ni valores hostiles (round trip)', () => {
  const h = M.exploreHash({ metric: 'users.signups', filter: 'location', value: 'Bella Vista, Buenos Aires' });
  assert.equal(h, '#/explorar?m=users.signups&f=location&v=Bella%20Vista%2C%20Buenos%20Aires');
  assert.deepEqual(plain(M.parseHash(h)), { view: 'explorar', metric: 'users.signups', filter: 'location', value: 'Bella Vista, Buenos Aires' });
  assert.deepEqual(plain(M.parseHash('#/explorar')), { view: 'explorar', metric: null, filter: null, value: null });
  assert.equal(M.exploreHash({ metric: 'matches.created' }), '#/explorar?m=matches.created');
  assert.equal(M.exploreHash({ filter: 'location', value: 'x' }), '#/explorar', 'sin indicador no hay filtro');
  for (const bad of ['#/explorar?m=users.signups;drop', '#/explorar?m=Users.Signups', '#/explorar?m=../x', '#/explorar?m=' + 'a.'.repeat(40)]) assert.equal(M.parseHash(bad).metric, null, bad);
  assert.equal(M.parseHash('#/explorar?m=users.signups&f=Bad-Filter&v=x').filter, null);
  assert.equal(M.parseHash('#/explorar?m=users.signups&f=location&v=' + 'x'.repeat(121)).filter, null);
  assert.equal(M.parseHash('#/explorar?m=users.signups&f=location&v=%00').filter, null);
  assert.equal(M.parseHash('#/explorar?f=location&v=x').filter, null, 'filtro sin indicador se descarta');
  assert.deepEqual(plain(M.parseHash('#/explorarX')), { view: 'inicio' });
});

test('F6 · etiquetas, agrupación del selector y mensajes sin gráfico (nunca una línea inventada)', () => {
  assert.equal(M.optionLabel('level_status', 'CALIBRANDO'), 'Calibrando');
  assert.equal(M.optionLabel('platform', 'ios'), 'iPhone / iPad');
  assert.equal(M.optionLabel('match_status', 'expired_derived'), 'Vencidos sin validar');
  assert.equal(M.optionLabel('location', 'Bella Vista, Buenos Aires'), 'Bella Vista, Buenos Aires');
  assert.equal(M.optionLabel('match_status', 'algo_nuevo'), 'algo_nuevo');
  const g = plain(M.groupCatalog(plain(Q.exploreCatalog().catalog)));
  assert.deepEqual(g.map((x) => x.title), ['Usuarios', 'Partidos', 'Activación', 'Comunidad', 'Uso']);
  assert.equal(g.reduce((a, x) => a + x.items.length, 0), 55);
  assert.match(M.seriesMessage('unavailable'), /Evolución temporal no disponible/);
  assert.match(M.seriesMessage('filter_disabled'), /Quitá el filtro/);
  assert.match(M.seriesMessage('available', false), /Todavía no medible/);
  assert.equal(M.seriesMessage('available', true), null);
  assert.equal(M.DEFAULT_EXPLORE_METRIC, 'users.signups');
});

test('F6 · gráfico con huecos de captura: null no es 0, no genera NaN y una serie toda nula es «sin datos»', () => {
  const days = (vals) => vals.map((v, i) => ({ start: `2026-09-${String(i + 1).padStart(2, '0')}`, value: v }));
  let m = M.chartModel({ granularity: 'day', current: days([null, null, 3, 0, 2]), previous: null }, { compare: true });
  assert.equal(m.empty, false);
  for (const p of m.curPts) { assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'sin NaN'); }
  assert.equal(m.curPts[0].v, null, 'se conserva el null para el tooltip «Sin captura»');
  assert.ok(m.curPts[2].y < m.curPts[0].y);
  m = M.chartModel({ granularity: 'day', current: days([null, null, null]), previous: null }, {});
  assert.equal(m.empty, true);
});

test('F6 · contrato: la especificación del fixture es copia EXACTA de `_metrics_explore_spec()` y todo indicador declarado existe en el catálogo', () => {
  assert.deepEqual(plain(Q.EXPLORE_SPEC), sqlSpec);
  const ids = new Set(sqlCatalog.map((e) => e.id));
  for (const id of Object.keys(sqlSpec.metrics)) assert.ok(ids.has(id), `${id} es del catálogo auditado (no hay indicadores ficticios)`);
  for (const m of Object.values(sqlSpec.metrics)) for (const f of m.filters || []) assert.ok(sqlSpec.filters[f], f);
  for (const f of Object.values(sqlSpec.filters)) { assert.ok(f.label && f.note && ['personas', 'partidos'].includes(f.unit)); }
});

test('F6 · contrato con el SQL REAL: catálogo y respuestas del Explorador del fixture tienen la misma forma que `metrics_explore*`', async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok);
  try {
    await r.db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
    const sqlCat = (await r.db.query(`select public.metrics_explore_catalog() as r`)).rows[0].r;
    const fxCat = plain(Q.exploreCatalog());
    assert.deepEqual(Object.keys(fxCat).sort(), Object.keys(sqlCat).sort());
    assert.deepEqual(fxCat.catalog, sqlCat.catalog, 'mismo catálogo, mismo orden, mismas series y filtros');
    assert.deepEqual(fxCat.filterDefs, sqlCat.filterDefs);
    const keys = (o) => Object.keys(o).sort();
    for (const [metric, filter, value] of [['users.signups', null, null], ['users.registered_now', 'location', 'Bella Vista, Buenos Aires'], ['matches.created', 'match_status', 'validated'],
      ['usage.dau', null, null], ['usage.wau', 'platform', 'ios'], ['activation.fifth_match', null, null], ['community.groups_created', null, null]]) {
      const real = (await r.db.query(`select public.metrics_explore($1, '30d', true, false, $2, $3, '2026-10-08T12:00:00Z') as r`, [metric, filter, value])).rows[0].r;
      const fx = plain(Q.respondExplore({ metric, range: '30d', compare: true, ...(filter ? { filter: { id: filter, value } } : {}) }, ''));
      assert.deepEqual(keys(fx), keys(real), `${metric}: claves de nivel superior`);
      assert.deepEqual(keys(fx.kpi), keys(real.kpi), `${metric}: claves del KPI`);
      assert.deepEqual(keys(fx.filters), keys(real.filters));
      assert.deepEqual(fx.filters.available.map(keys), real.filters.available.map(keys), `${metric}: forma de los filtros`);
      assert.deepEqual(fx.filters.available.map((f) => f.id), real.filters.available.map((f) => f.id));
      assert.equal(fx.seriesState, real.seriesState, `${metric}: estado de la serie`);
      assert.equal(fx.series === null, real.series === null);
      if (real.series) { assert.deepEqual(keys(fx.series), keys(real.series)); assert.deepEqual(keys(fx.series), ['current', 'granularity', 'label', 'previous', 'source']); }
      assert.deepEqual(keys(fx.meta), keys(real.meta)); assert.deepEqual(keys(fx.today), keys(real.today));
    }
    assert.deepEqual(plain(Q.respondExplore({ metric: 'nada.x' }, '')), { ok: false, code: 'invalid_metric' });
    assert.equal(plain(Q.respondExplore({ metric: 'users.signups', filter: { id: 'platform', value: 'ios' } }, '')).code, 'invalid_filter');
  } finally { await r.db.close(); }
});

test('F6 · el fixture del Explorador respeta las reglas: serie solo si el SQL la declara, filtro de personas sin serie, presencia anterior = null, opciones sin «Otros»', () => {
  const cat = Q.exploreCatalog().catalog;
  for (const e of cat) {
    const x = plain(Q.respondExplore({ metric: e.id, range: '30d' }, ''));
    assert.equal(x.ok, true, e.id);
    assert.equal(x.seriesState === 'available', e.hasSeries, e.id);
    assert.equal(x.series === null, !e.hasSeries, e.id);
    assert.deepEqual(x.filters.available.map((f) => f.id), plain(e.filters));
    for (const f of x.filters.available) assert.ok(f.options.every((o) => o.n >= 5 || f.unit === 'partidos') && !/Otros/.test(JSON.stringify(f.options)), `${e.id}/${f.id}`);
    assert.equal(x.kpi.id, e.id);
  }
  const f = plain(Q.respondExplore({ metric: 'users.signups', range: '30d', filter: { id: 'location', value: 'Bella Vista, Buenos Aires' } }, ''));
  assert.deepEqual([f.seriesState, f.series], ['filter_disabled', null]);
  assert.equal(f.kpi.value, 14);
  const hidden = plain(Q.respondExplore({ metric: 'users.signups', range: '30d', filter: { id: 'location', value: 'Loc inexistente' } }, ''));
  assert.deepEqual([hidden.kpi.value, hidden.kpi.availability, hidden.kpi.count], [null, 'insufficient_sample', null]);
  const m = plain(Q.respondExplore({ metric: 'matches.created', range: '30d', filter: { id: 'match_status', value: 'validated' } }, ''));
  assert.deepEqual([m.seriesState, m.series.current.reduce((a, p) => a + p.value, 0)], ['available', m.kpi.value]);
  const dau = plain(Q.respondExplore({ metric: 'usage.dau', range: '30d' }, ''));
  assert.ok(dau.series.current.some((p) => p.value === null) && dau.series.current.some((p) => typeof p.value === 'number'), 'antes de la captura es null, después números');
  assert.ok(plain(Q.respondExplore({ metric: 'usage.dau', range: '30d' }, 'nopresence')).series.current.every((p) => p.value === null));
  assert.equal(plain(Q.respondExplore({ metric: 'usage.wau', filter: { id: 'platform', value: 'ios' }, range: '30d' }, 'nopresence')).kpi.availability, 'not_instrumented');
});

test('F6 · estática de seguridad: el cliente solo envía {catalog} o {metric, range, compare, includeInternal, filter}; sin SQL, tablas, columnas ni texto libre', () => {
  const js = read('admin/metrics/metrics.js');
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /callServer\(\{ catalog: true \}\)/);
  assert.match(code, /const body = \{ metric: sel\.metric, range: S\.range, compare: S\.compare, includeInternal: S\.internal \};/);
  assert.match(code, /body\.filter = \{ id: sel\.filter, value: sel\.value \}/);
  assert.ok(!/\b(select\s+\w+\s+from|insert\s+into|drop\s+table|p_table|p_column|order\s+by)\b/i.test(code.replace(/createElement\('select'\)|h\('select'/g, '')), 'ningún SQL en el cliente');
  assert.ok(!/h\('input'|createElement\('input'\)|createElement\('textarea'\)|contenteditable/i.test(code), 'el Explorador usa solo <select>: no hay texto libre');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function/.test(code));
  // la selección no se persiste (ni datos): solo vive en la URL; el storage sigue guardando únicamente 3 preferencias
  const stor = code.match(/localStorage\.[a-zA-Z]+\([^)]*\)/g) || [];
  assert.ok(stor.length === 2 && stor.every((x) => /PREF_KEY/.test(x)));
  // el valor de filtro que se envía sale de las opciones que el servidor ofreció (selects), nunca de un campo de texto
  assert.match(code, /\(f\.options \|\| \[\]\)\.map\(\(o\) => h\('option', \{ value: o\.value/);
  const html = read('admin/metrics/index.html');
  assert.equal((html.match(/<input/g) || []).length, 2, 'index.html sigue con solo los 2 interruptores');
});

test('F6 · Edge: las únicas funciones SQL que invoca son las del mapa fijo y las 2 del Explorador (sin nombres que vengan del cliente)', () => {
  const core = fs.readFileSync(path.join(dir, '..', 'supabase', 'functions', '_shared', 'admin-metrics-core.mjs'), 'utf8');
  const fns = new Set([...core.matchAll(/fn: '([a-z_]+)'/g)].map((m) => m[1]));
  assert.deepEqual([...fns].sort(), ['metrics_explore', 'metrics_explore_catalog']);
  assert.ok(!/args\.p_[a-z_]+ = body\./.test(core) && !/rpc\(`/.test(core));
});

test('F6 · UX móvil: el selector de indicador y los filtros son controles nativos de ancho completo y táctiles (≥ 44 px); el diseño apila en móvil y usa 2 columnas en escritorio', () => {
  const css = read('admin/metrics/metrics.css');
  assert.match(css, /\.mx-select\{[^}]*width:100%[^}]*min-height:46px/);
  assert.match(css, /\.mx-ex\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*grid-template-areas:"pick" "main" "filters" "def"/);
  assert.match(css, /@media \(min-width:1000px\)\{ \.mx-ex\{grid-template-columns:340px minmax\(0,1fr\)/);
  assert.match(css, /\.mx-select\{[^}]*font-size:16px/, 'select a 16 px: iOS Safari no hace zoom automático al enfocarlo');
  const html = read('admin/metrics/index.html');
  assert.match(html, /viewport-fit=cover/);
});
