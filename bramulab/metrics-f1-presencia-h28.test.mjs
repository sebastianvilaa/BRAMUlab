// BRAMU Metrics V1 · F1 (bundle 04.37-h28; consentimiento desde V04.38) — presencia diaria en el cliente.
// node --test bramulab/metrics-f1-presencia-h28.test.mjs
// Backend: supabase/functions/_shared/metrics-f1-activity.test.mjs (PGlite). Aquí: auth.js#recordActivity real (vm) y
// garantías estáticas de DÓNDE se dispara (y dónde NO) en app.js.
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const authJs = read('auth.js'); const appJs = read('app.js');

function makeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; }
function loadAuth({ consent = 'granted', rpc, ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone = false, visible = 'visible', storage = makeStorage(), configured = true } = {}) {
  const calls = [];
  const client = { rpc: async (name, args) => { if (name === 'get_my_activity_consent') return { data: { enabled: true, version: 'activity_v1', status: consent, decidedAt: null }, error: null }; calls.push({ name, args }); return rpc ? rpc(name, args) : { data: { ok: true, recorded: true }, error: null }; }, auth: { signOut: async () => ({ error: null }) } };
  const sb = {
    console, Object, Array, String, Number, Promise, JSON, Math, Date, RegExp, Map,
    location: { hostname: 'x.vercel.app' }, localStorage: storage,
    navigator: { userAgent: ua, standalone },
    matchMedia: (q) => ({ matches: q.includes('standalone') ? standalone : false }),
    document: { visibilityState: visible },
    __BRAMU_ENV__: configured ? { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'k' } : undefined,
    supabase: { createClient: () => client },
  };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(authJs, sb);
  return { Auth: sb.PLAuth, calls, storage, sb };
}

/** La presencia exige consentimiento CONFIRMADO por el servidor en la sesión: se lo lee igual que lo hace la app antes de registrar. */
async function loadGranted(opts) { const x = loadAuth(opts); await x.Auth.getMyActivityConsent(); return x; }

test('envía SOLO modo, plataforma y bundle público (nunca jugador, fecha ni user-agent)', async () => {
  const { Auth, calls } = await loadGranted({ standalone: true });
  const r = await Auth.recordActivity({ appBundle: '04.37-h28' });
  assert.deepEqual(plain(r), { ok: true, recorded: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'register_app_presence');
  assert.deepEqual(Object.keys(calls[0].args).sort(), ['p_app_bundle', 'p_display_mode', 'p_platform']);
  assert.deepEqual({ ...calls[0].args }, { p_display_mode: 'standalone', p_platform: 'ios', p_app_bundle: '04.37-h28' });
});

test('clasificación gruesa de plataforma y modo (4 valores, sin guardar el user-agent)', () => {
  const { Auth } = loadAuth();
  const mk = (ua, standalone) => ({ navigator: { userAgent: ua, standalone }, matchMedia: () => ({ matches: false }) });
  const c = (ua, st = false) => { const r = Auth.classifyActivityContext(mk(ua, st)); return `${r.platform}/${r.displayMode}`; };
  assert.equal(c('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'ios/browser');
  assert.equal(c('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', true), 'ios/standalone');
  assert.equal(c('Mozilla/5.0 (Linux; Android 15; SM-S938B)'), 'android/browser');
  assert.equal(c('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'), 'desktop/browser');
  assert.equal(c('curl/8'), 'other/browser');
});

test('bundle con formato inválido viaja como null (el servidor lo rechazaría)', async () => {
  const { Auth, calls } = await loadGranted();
  await Auth.recordActivity({ appBundle: "04.37-h28'; drop table x" });
  assert.equal(calls[0].args.p_app_bundle, null);
});

test('throttle: una sola llamada por 30 min por dispositivo (persistido), incluso tras recargar el módulo', async () => {
  const storage = makeStorage();
  const a = await loadGranted({ storage });
  await a.Auth.recordActivity({ appBundle: '04.37-h28' });
  const second = await a.Auth.recordActivity({ appBundle: '04.37-h28' });
  assert.deepEqual(plain(second), { ok: false, skipped: 'throttled' });
  assert.equal(a.calls.length, 1);
  const b = await loadGranted({ storage }); // “recarga”: memoria vacía, localStorage conservado
  assert.deepEqual(plain(await b.Auth.recordActivity({ appBundle: '04.37-h28' })), { ok: false, skipped: 'throttled' });
  assert.equal(b.calls.length, 0);
  storage._m.set('bramu_activity_ts', String(Date.now() - 31 * 60 * 1000));
  const c = await loadGranted({ storage });
  assert.equal((await c.Auth.recordActivity({ appBundle: '04.37-h28' })).ok, true);
  assert.equal(c.calls.length, 1);
});

test('pestaña oculta o backend sin configurar: no llama a nada', async () => {
  const h = loadAuth({ visible: 'hidden' });
  assert.deepEqual(plain(await h.Auth.recordActivity({})), { ok: false, skipped: 'hidden' });
  assert.equal(h.calls.length, 0);
  const n = loadAuth({ configured: false });
  assert.equal((await n.Auth.recordActivity({})).ok, false);
  assert.equal(n.calls.length, 0);
});

test('best-effort: error de red, respuesta ok:false, excepción o localStorage bloqueado NUNCA lanzan', async () => {
  const bad = async (rpc, storage) => (await loadGranted({ rpc, storage })).Auth.recordActivity({ appBundle: '04.37-h28' });
  assert.equal((await bad(async () => ({ data: null, error: { message: 'boom' } }))).ok, false);
  assert.deepEqual(plain(await bad(async () => ({ data: { ok: false, code: 'no_player_for_session' }, error: null }))), { ok: false, code: 'no_player_for_session' });
  assert.deepEqual(plain(await bad(async () => { throw new Error('offline'); })), { ok: false, code: 'exception' });
  const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal((await bad(undefined, blocked)).ok, true);
});

test('app.js: la presencia se dispara en TRES puntos y TODOS exigen consentimiento (aceptado en pantalla, ya aceptado al reanudar sesión, o vuelta a primer plano con sesión viva)', () => {
  const hits = appJs.match(/Auth\.recordActivity\(/g) || [];
  assert.equal(hits.length, 3);
  const resume = appJs.slice(appJs.indexOf('async function resumeServerSession'), appJs.indexOf('function captureClaimTokenFromUrl'));
  assert.ok(!/Auth\.recordActivity/.test(resume), 'NO se registra al reanudar antes de resolver el consentimiento: ya no hay una llamada directa en resumeServerSession');
  assert.match(resume, /enforceLegalGate\(\(\) => resumeServerSession\(options\)\)\) return;[\s\S]*?resolveActivityConsent\(/, 'el consentimiento se resuelve DESPUÉS del gate legal');
  const resolve = appJs.slice(appJs.indexOf('async function resolveActivityConsent'), appJs.indexOf('function openActivityConsent'));
  assert.match(resolve, /st\.status === 'granted'\) \{ Auth\.recordActivity/);
  assert.ok(!/status === 'unset'[^;]*recordActivity/.test(resolve) && !/declined[^;]*recordActivity/.test(resolve));
  const decide = appJs.slice(appJs.indexOf('async function decideActivityConsent'), appJs.indexOf('function initActivityConsent'));
  assert.match(decide, /if \(granted\) Auth\.recordActivity/);
  const fg = appJs.slice(appJs.indexOf('async function refreshServerStateOnForeground'), appJs.indexOf('function initUpdateCheck'));
  assert.match(fg, /exitGhostServerSession\(Store\.getCurrentUser\(\)\);\s*return;\s*\}[\s\S]*?if \(session\) Auth\.recordActivity/);
});

test('sin consentimiento CONFIRMADO no se hace ni una llamada: desconocido, sin decidir, declinado, apagado y tras cerrar sesión', async () => {
  for (const status of ['unset', 'declined', 'disabled']) {
    const g = await loadGranted({ consent: status });
    assert.deepEqual(plain(await g.Auth.recordActivity({ appBundle: '04.37-h28' })), { ok: false, skipped: 'no_consent' }, status);
    assert.equal(g.calls.length, 0, `${status}: ninguna llamada a register_app_presence`);
  }
  const unknown = loadAuth(); // nunca se leyó el estado
  assert.deepEqual(plain(await unknown.Auth.recordActivity({})), { ok: false, skipped: 'no_consent' });
  assert.equal(unknown.calls.length, 0);
  const g2 = await loadGranted({ consent: 'granted' });
  assert.equal((await g2.Auth.recordActivity({ appBundle: '04.37-h28' })).ok, true);
  await g2.Auth.signOut();
  assert.equal(g2.Auth.getActivityConsentCached(), null, 'el estado de consentimiento no sobrevive al cierre de sesión');
  assert.deepEqual(plain(await g2.Auth.recordActivity({})), { ok: false, skipped: 'no_consent' });
});

test('app.js: NO se dispara desde chequeo de versión, timers ni refresco de token', () => {
  const check = appJs.slice(appJs.indexOf('async function checkForNewVersion'), appJs.indexOf('let foregroundRefreshInFlight'));
  assert.ok(check.length > 100 && !/recordActivity/.test(check));
  assert.ok(!/setInterval\([^)]*recordActivity|setTimeout\([^)]*recordActivity/.test(appJs));
  assert.ok(!/onAuthStateChange[\s\S]{0,200}recordActivity/.test(appJs) && !/TOKEN_REFRESHED[\s\S]{0,120}recordActivity/.test(authJs + appJs));
});

test('auth.js: la RPC es la única vía y no hay nada de IP, geolocalización ni user-agent crudo en el payload', () => {
  const fn = authJs.slice(authJs.indexOf('async function recordActivity'), authJs.indexOf('global.PLAuth = {'));
  assert.match(fn, /rpc\('register_app_presence'/);
  assert.ok(!/geolocation|userAgent[^;]*p_|\.from\('player_activity_days'\)/.test(fn));
});
