// BRAMU Metrics — ronda de mejoras visuales y UX: ícono propio, período «Hoy · parcial» y tarjetas Web en Inicio.
// node --test bramulab/metrics-hoy-web-icono.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDist } from './scripts/build-dist.mjs';
import { validateMetricsBody } from '../supabase/functions/_shared/admin-metrics-core.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));

function load(file, extra) {
  const sb = { console, Intl, Date, Math, Number, String, Array, Set, Object, JSON, Promise, isNaN, isFinite, URLSearchParams, setTimeout, __MX_NO_BOOT__: true, ...(extra || {}) };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(read(file), sb);
  return sb;
}
const M = load('admin/metrics/metrics.js').PLMetricsAdmin;
const Q = load('admin/metrics/qa-fixture.js').PLMetricsQaFixture;

/* ---------------- 1. Ícono propio de Metrics ---------------- */
const ICON_DIR = 'admin/metrics/icons';
function pngInfo(file) {
  const b = fs.readFileSync(path.join(dir, file));
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file}: firma PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25], bytes: b };
}

test('ícono: derivados reales con el tamaño pedido, opacos (iOS no admite transparencia) y distintos del isotipo de la app y de Staging', () => {
  for (const [f, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon-64.png', 64], ['favicon-32.png', 32]]) {
    const i = pngInfo(`${ICON_DIR}/${f}`);
    assert.deepEqual([i.w, i.h], [size, size], f);
    assert.notEqual(i.colorType, 6, `${f}: sin canal alfa`); assert.notEqual(i.colorType, 4, `${f}: sin canal alfa`);
  }
  const mine = fs.readFileSync(path.join(dir, `${ICON_DIR}/apple-touch-icon.png`));
  assert.notDeepEqual(mine, fs.readFileSync(path.join(dir, 'icons/apple-touch-icon.png')), 'no es el ícono de Production');
  assert.notDeepEqual(mine, fs.readFileSync(path.join(dir, 'icons-staging/apple-touch-icon.png')), 'no es el ícono de Staging');
});

test('ícono: el apple-touch-icon de Metrics va incrustado (iOS lo pide sin cookies) con EXACTAMENTE los bytes del archivo; sin manifest ni Service Worker', () => {
  const html = read('admin/metrics/index.html');
  const m = /<link rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,([A-Za-z0-9+/=]+)">/.exec(html);
  assert.ok(m, 'apple-touch-icon incrustado');
  assert.deepEqual(Buffer.from(m[1], 'base64'), fs.readFileSync(path.join(dir, `${ICON_DIR}/apple-touch-icon.png`)));
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="BRAMU Metrics">/);
  for (const m2 of html.matchAll(/<link rel="icon"[^>]*href="([^"]+)"/g)) {
    assert.match(m2[1], /^\/admin\/metrics\/icons\//, 'los favicon de Metrics viven bajo /admin/metrics/');
    assert.ok(fs.existsSync(path.join(dir, m2[1].replace(/^\//, ''))), m2[1]);
  }
  assert.ok(!/\/icons\/favicon-64\.png/.test(html.replace(/\/admin\/metrics\/icons\//g, '')), 'ya no usa el favicon de la app');
  assert.ok(!/rel="manifest"|serviceWorker/.test(html));
  assert.equal(fs.existsSync(path.join(dir, 'admin/metrics/manifest.webmanifest')), false);
  assert.equal(fs.existsSync(path.join(dir, 'admin/metrics/sw.js')), false);
});

test('ícono: la app y Staging NO cambian (su apple-touch-icon incrustado, favicon y manifest no mencionan el de Metrics)', () => {
  const app = read('index.html'); const man = read('manifest.webmanifest');
  assert.ok(!/admin\/metrics/.test(app) && !/admin\/metrics/.test(man));
  assert.match(app, /<link rel="icon" href="icons\/favicon-64\.png/);
});

test('ícono: viaja en el build de Production y de Staging bajo /admin/metrics/icons/', () => {
  for (const variant of ['official', 'staging']) {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mx-icon-'));
    try {
      const built = buildDist({ outDir: out, requireGenerated: false, iconVariant: variant });
      assert.deepEqual(built.problems, [], variant);
      for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon-64.png', 'favicon-32.png']) {
        assert.ok(built.files.includes(`${ICON_DIR}/${f}`), `${variant}: ${f}`);
        assert.deepEqual(fs.readFileSync(path.join(out, ICON_DIR, f)), fs.readFileSync(path.join(dir, ICON_DIR, f)), `${variant}: ${f} idéntico`);
      }
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

test('ícono: el SVG maestro y el generador existen y el SVG no lleva texto (sin iniciales)', () => {
  const marca = path.join(dir, '..', 'docs', 'BRAMUlab', 'Identidad_Visual', 'Marca');
  const svg = fs.readFileSync(path.join(marca, 'BRAMUMetrics-IconoApp.svg'), 'utf8');
  assert.ok(!/<text|<tspan|font-family/.test(svg), 'sin texto');
  for (const c of ['#95FF19', '#6B7F95', '#FFFFFF']) assert.ok(svg.includes(c), c);
  assert.ok(fs.existsSync(path.join(marca, 'generar-icono-metrics.py')));
});

/* ---------------- 2. Período «Hoy · parcial» ---------------- */
test('Hoy: es una opción visible y parcial; los períodos completos siguen idénticos', () => {
  assert.deepEqual(plain(M.RANGES.map((r) => r.id)), ['today', '7d', '30d', '90d', 'all']);
  assert.equal(M.RANGES.find((r) => r.id === 'today').partial, true);
  assert.deepEqual(plain(M.RANGES.filter((r) => r.id !== 'today').map((r) => [r.id, r.label])), [['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'], ['all', 'Histórico']]);
});

test('Hoy: no cambia el contrato del backend: al servidor se le pide un rango VÁLIDO existente y el rango `1d` sigue rechazado', () => {
  assert.equal(M.apiRangeFor('today'), '7d');
  for (const r of ['7d', '30d', '90d', 'all']) assert.equal(M.apiRangeFor(r), r);
  assert.equal(validateMetricsBody({ section: 'overview', range: M.apiRangeFor('today'), compare: false }).ok, true);
  assert.equal(validateMetricsBody({ section: 'overview', range: '1d' }).ok, false, 'el backend no acepta 1d (no se amplió)');
  assert.equal(validateMetricsBody({ section: 'overview', range: 'today' }).ok, false);
  const code = read('admin/metrics/metrics.js');
  assert.match(code, /compare: S\.range === 'today' \? false : S\.compare/, 'Hoy nunca se compara');
  assert.match(code, /callServer\(\{ section, range: a\.range, compare: a\.compare, includeInternal: a\.includeInternal \}\)/, 'el pedido sale de sectionArgs (rango ya traducido), nunca de S.range crudo');
});

test('Hoy: solo las pestañas con dato REAL del día lo muestran; el resto lo dice y no inventa cifras', () => {
  assert.deepEqual(plain(M.todayTab('inicio')), { fields: ['signups', 'matchesCreated', 'matchesValidated', 'activePlayers'], web: true });
  assert.deepEqual(plain(M.todayTab('partidos').fields), ['matchesCreated', 'matchesValidated']);
  assert.deepEqual(plain(M.todayTab('web')), { fields: [], web: true });
  for (const v of ['activacion', 'comunidad', 'explorar', 'kpi', '__proto__', 'constructor']) assert.equal(M.todayTab(v), null, v);
  for (const f of Object.values(M.TODAY_TABS).flatMap((t) => t.fields)) assert.ok(M.TODAY_FIELDS[f], `${f} existe en el contrato de today`);
});

test('Hoy: sello de fecha/hora en Buenos Aires, tomado del corte del servidor (nunca del reloj del navegador)', () => {
  const meta = { generatedAt: '2026-10-14T21:05:00Z' };
  assert.deepEqual(plain(M.todayStamp(meta, { today: { date: '2026-10-14', asOf: '2026-10-14T21:05:00Z' } })), { date: '14/10', upTo: '18:05' });
  assert.deepEqual(plain(M.todayStamp(meta, { web: { today: { date: '2026-10-14' } } })), { date: '14/10', upTo: '18:05' }, 'sección Web: usa generatedAt');
  assert.deepEqual(plain(M.todayStamp(null, null)), { date: null, upTo: null });
});

test('Hoy: «Hoy» no se guarda como preferencia (se vuelve al último período completo) y no hay cambios de storage', () => {
  const code = read('admin/metrics/metrics.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /range: S\.range === 'today' \? S\.lastRange : S\.range/);
  assert.match(code, /r\.id === p\.range && !r\.partial/, 'una preferencia guardada «today» se descarta');
  const stor = code.match(/localStorage\.[a-zA-Z]+\([^)]*\)/g) || [];
  assert.equal(stor.length, 2);
});

test('Hoy: el fixture QA responde con el mismo contrato para el rango que pide la UI y trae `today`', async () => {
  const r = await Q.get({ section: 'overview', range: M.apiRangeFor('today'), compare: false, includeInternal: false }, '');
  assert.equal(r.ok, true); assert.equal(typeof r.today.signups, 'number'); assert.equal(r.today.partial, true);
});

/* ---------------- 3. Visitas y clics en Indicadores clave ---------------- */
const W = (o) => ({ instrumented: true, views: 1140, clicks: 210, today: { date: '2026-10-14', views: 21, clicks: 4 }, ...o });
// ventana de 30 días completos que termina a las 00:00 de hoy (BA) = 03:00Z
const META = (since, from = '2026-09-14T03:00:00.000Z', to = '2026-10-14T03:00:00.000Z') => ({ window: [from, to], webSince: since });

test('Web: valores exactos del agregado cuando hay medición completa (sin transformar)', () => {
  const m = M.webMeasure(W(), META('2026-08-01'), false);
  assert.deepEqual(plain(m), { state: 'ok', views: 1140, clicks: 210, since: '2026-08-01' });
  assert.equal(M.webCardView('views', m).value, '1.140'); assert.equal(M.webCardView('clicks', m).value, '210');
  assert.equal(M.webCardView('views', m).state, null);
});

test('Web: «Sin medición» —nunca un 0 inventado— sin instrumentar o cuando ningún día completo del período se midió', () => {
  const none = M.webMeasure({ instrumented: false, views: null, clicks: null }, { window: [], webSince: null }, false);
  assert.deepEqual(plain(M.webCardView('views', none)), { value: '—', empty: true, state: { tone: 'none', text: 'Sin medición' } });
  // medición que empezó HOY: los períodos terminan ayer => no hay ningún día completo; los ceros de la base no se muestran
  const today0 = M.webMeasure(W({ views: 0, clicks: 0 }), META('2026-10-14'), false);
  assert.equal(today0.state, 'none');
  assert.equal(M.webCardView('clicks', today0).value, '—');
  assert.equal(M.webCardView('clicks', today0).state.text, 'Sin medición · empezó el 14/10');
  // también para «Histórico» cuando el primer día medido es hoy
  assert.equal(M.webMeasure(W({ views: 0, clicks: 0 }), META('2026-10-14', '2026-10-14T03:00:00.000Z'), false).state, 'none');
});

test('Web: medición que empezó dentro del período = valor real + aviso «Medición desde dd/mm» (no se presenta como período completo)', () => {
  const m = M.webMeasure(W({ views: 76, clicks: 14 }), META('2026-10-12'), false);
  assert.equal(m.state, 'partial');
  const v = M.webCardView('views', m);
  assert.equal(v.value, '76'); assert.deepEqual(plain(v.state), { tone: 'partial', text: 'Medición desde 12/10' });
  // histórico cuyo primer día medido es el inicio de la ventana: completo
  assert.equal(M.webMeasure(W(), META('2026-10-05', '2026-10-05T03:00:00.000Z'), false).state, 'ok');
});

test('Web: Hoy usa los parciales de hoy; null/ausente = «Sin medición»; valores inválidos = «No disponible» (jamás NaN)', () => {
  const m = M.webMeasure(W(), META('2026-10-01'), true);
  assert.deepEqual(plain(m), { state: 'ok', views: 21, clicks: 4, since: null });
  assert.equal(M.webMeasure(W({ today: { date: '2026-10-14', views: null, clicks: null } }), META('2026-10-01'), true).state, 'none');
  assert.equal(M.webMeasure({ instrumented: false }, {}, true).state, 'none');
  for (const bad of [{ views: -1, clicks: 3 }, { views: 1.5, clicks: 3 }, { views: '12', clicks: 3 }, { views: null, clicks: null }, { views: NaN, clicks: 1 }]) {
    const x = M.webMeasure(W(bad), META('2026-08-01'), false);
    assert.equal(x.state, 'unavailable', JSON.stringify(bad));
    assert.deepEqual(plain(M.webCardView('views', x)), { value: '—', empty: true, state: { tone: 'sample', text: 'No disponible por ahora' } });
  }
  assert.equal(M.webMeasure(null, {}, false).state, 'unavailable');
});

test('Web: rótulos EXACTOS de las tarjetas y avisos honestos (visitas ≠ personas únicas; clics ≠ instalaciones ni ingresos confirmados)', () => {
  assert.equal(M.WEB_CARDS.views.label, 'Visitas a la web'); assert.equal(M.WEB_CARDS.clicks.label, 'Clics hacia la app');
  assert.match(M.WEB_CARDS.views.hint, /no son personas únicas/);
  assert.match(M.WEB_CARDS.clicks.hint, /no son ingresos ni instalaciones/);
});

test('Web en Inicio: se agregan a «Indicadores clave» reutilizando la sección `web` ya protegida (sin contador ni endpoint nuevo) y Web degrada sin romper Inicio', () => {
  const code = read('admin/metrics/metrics.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /getSection\('web', !!force\)\.catch\(/);
  assert.match(code, /keyGrid\.appendChild\(webCard\('views'/); assert.match(code, /keyGrid\.appendChild\(webCard\('clicks'/);
  assert.match(code, /href = '#\/web'/, 'las tarjetas abren la pestaña Web');
  assert.ok(!/functions\.invoke\('(?!admin-metrics)/.test(code), 'único endpoint: admin-metrics');
  assert.ok(!/web_analytics|fetch\(|XMLHttpRequest/.test(code), 'no hay un segundo contador ni acceso directo a la tabla');
  // la sección web ignora «comparar» e «internas»: una sola petición/caché por rango
  assert.match(code, /if \(section === 'web'\) return \{ range, compare: false, includeInternal: false \}/);
});

test('Web: el fixture QA cubre los 3 estados (sin medición, empezó hoy, caída solo de Web)', async () => {
  const ok = await Q.get({ section: 'web', range: '30d' }, '');
  assert.equal(ok.web.instrumented, true); assert.ok(ok.web.views > 0 && ok.web.clicks > 0); assert.equal(ok.meta.environment, 'qa');
  const none = await Q.get({ section: 'web', range: '30d' }, 'noweb');
  assert.equal(none.web.instrumented, false); assert.equal(none.web.views, null);
  const start = await Q.get({ section: 'web', range: '7d' }, 'webstart');
  assert.equal(M.webMeasure(start.web, start.meta, false).state, 'none');
  await assert.rejects(() => Q.get({ section: 'web', range: '7d' }, 'webdown'));
  const ov = await Q.get({ section: 'overview', range: '7d' }, 'webdown');
  assert.equal(ov.ok, true, 'solo cae Web; el resto sigue');
});

/* ---------------- 4. Pulido móvil ---------------- */
test('móvil: los botones de período no se parten en dos líneas, el selector ocupa el ancho y hay variante corta de los interruptores', () => {
  const css = read('admin/metrics/metrics.css'); const html = read('admin/metrics/index.html');
  assert.match(css, /\.mx-seg button\{[^}]*white-space:nowrap/);
  assert.match(css, /@media \(max-width:560px\)\{[\s\S]*\.mx-seg\{display:flex;width:100%\}/);
  assert.match(css, /\.mx-switch__txt \.mx-short\{display:none\}/);
  assert.match(html, /mx-long[\s\S]*mx-short/);
  assert.equal((html.match(/<input/g) || []).length, 2, 'siguen siendo 2 interruptores');
  assert.match(css, /\.mx-chip\{[^}]*max-width:100%[^}]*border-radius:12px/, 'el chip largo ya no se dibuja como píldora de 3 líneas');
});
