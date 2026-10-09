// BRAMU Metrics · V04.38 — consentimiento de medición de actividad en el cliente (Staging).
// node --test bramulab/tests/activity-consent-v0438.test.mjs
// Backend: supabase/functions/_shared/metrics-activity-consent.test.mjs (PGlite). Aquí: auth.js real (vm) + garantías estáticas de app.js / index.html.
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const authJs = read('auth.js'); const appJs = read('app.js'); const html = read('index.html');

function load({ cfg = { activity_consent_version: 'activity_v1' }, cfgError = null, rpcs = {}, signUpImpl } = {}) {
  const calls = []; const store = new Map();
  const client = {
    from: (t) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { calls.push({ from: t }); return cfgError ? { data: null, error: cfgError } : { data: cfg, error: null }; } }) }) }),
    rpc: async (name, args) => { calls.push({ rpc: name, args }); const f = rpcs[name]; return f ? f(args) : { data: { ok: true, recorded: true }, error: null }; },
    auth: { signOut: async () => ({ error: null }), signUp: async (a) => { calls.push({ signUp: a }); return signUpImpl ? signUpImpl(a) : { data: { user: { id: 'u', identities: [{}] } }, error: null }; } },
  };
  const sb = {
    console, Object, Array, String, Number, Promise, JSON, Math, Date, RegExp, Map,
    location: { hostname: 'x.vercel.app' }, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    navigator: { userAgent: 'Mozilla/5.0 (iPhone)', standalone: false }, matchMedia: () => ({ matches: false }), document: { visibilityState: 'visible' },
    __BRAMU_ENV__: { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'k' }, supabase: { createClient: () => client },
  };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb); vm.runInContext(authJs, sb);
  return { Auth: sb.PLAuth, calls };
}
const status = (s) => ({ get_my_activity_consent: () => ({ data: { enabled: s !== 'disabled', version: 'activity_v1', status: s, decidedAt: null }, error: null }) });

test('config: lee la versión vigente (anon); sin versión = medición apagada; error o valor raro → no disponible, sin romper', async () => {
  assert.deepEqual(plain(await load().Auth.getActivityConsentConfig()), { ok: true, version: 'activity_v1' });
  assert.deepEqual(plain(await load({ cfg: { activity_consent_version: null } }).Auth.getActivityConsentConfig()), { ok: true, version: null });
  assert.equal((await load({ cfg: { activity_consent_version: 'x y!' } }).Auth.getActivityConsentConfig()).ok, false);
  assert.equal((await load({ cfgError: { message: 'boom' } }).Auth.getActivityConsentConfig()).ok, false);
});

test('estado: se cachea solo en memoria, una lectura fallida lo deja desconocido y no se guarda nada en storage', async () => {
  const g = load({ rpcs: status('granted') });
  assert.equal(g.Auth.getActivityConsentCached(), null);
  const r = await g.Auth.getMyActivityConsent();
  assert.deepEqual(plain(r), { ok: true, enabled: true, version: 'activity_v1', status: 'granted', decidedAt: null });
  assert.equal(g.Auth.getActivityConsentCached(), 'granted');
  const bad = load({ rpcs: { get_my_activity_consent: () => ({ data: null, error: { message: 'x' } }) } });
  assert.equal((await bad.Auth.getMyActivityConsent()).ok, false);
  assert.equal(bad.Auth.getActivityConsentCached(), null);
  assert.ok(!/localStorage\.(set|get)Item\([^)]*consent/i.test(authJs), 'el estado de consentimiento nunca va a localStorage');
});

test('presencia: solo con «granted»; sin decidir, declinado, apagado o desconocido no se llama a register_app_presence', async () => {
  for (const s of ['unset', 'declined', 'disabled']) {
    const g = load({ rpcs: status(s) }); await g.Auth.getMyActivityConsent();
    assert.deepEqual(plain(await g.Auth.recordActivity({ appBundle: '04.38-h1' })), { ok: false, skipped: 'no_consent' });
    assert.ok(!g.calls.some((c) => c.rpc === 'register_app_presence'), s);
  }
  const g = load({ rpcs: status('granted') }); await g.Auth.getMyActivityConsent();
  assert.equal((await g.Auth.recordActivity({ appBundle: '04.38-h1' })).ok, true);
  assert.equal(g.calls.filter((c) => c.rpc === 'register_app_presence').length, 1);
});

test('decidir: aceptar habilita la presencia; declinar la corta; solo manda versión, decisión y origen (nunca jugador)', async () => {
  const g = load({ rpcs: { ...status('unset'), set_my_activity_consent: (a) => ({ data: { ok: true, status: a.p_granted ? 'granted' : 'declined', changed: true }, error: null }) } });
  await g.Auth.getMyActivityConsent();
  assert.deepEqual(plain(await g.Auth.setMyActivityConsent('activity_v1', true, 'prompt')), { ok: true, status: 'granted', changed: true });
  const call = g.calls.find((c) => c.rpc === 'set_my_activity_consent');
  assert.deepEqual(Object.keys(call.args).sort(), ['p_granted', 'p_source', 'p_version']);
  assert.equal(g.Auth.getActivityConsentCached(), 'granted');
  assert.equal((await g.Auth.setMyActivityConsent('activity_v1', false, 'settings')).status, 'declined');
  assert.equal(g.calls.filter((c) => c.rpc === 'set_my_activity_consent').pop().args.p_source, 'settings');
  assert.deepEqual(plain(await g.Auth.recordActivity({})), { ok: false, skipped: 'no_consent' });
  assert.equal((await g.Auth.setMyActivityConsent('activity_v1', 'si', 'prompt')).code, 'invalid_decision');
  assert.equal(g.Auth.getActivityConsentCached(), 'declined');
  const fail = load({ rpcs: { set_my_activity_consent: () => ({ data: null, error: { message: 'activity_consent_version_not_current' } }) } });
  assert.equal((await fail.Auth.setMyActivityConsent('activity_v0', true)).code, 'activity_consent_version_not_current');
  assert.equal(fail.Auth.getActivityConsentCached(), null, 'un rechazo del servidor no concede nada');
});

test('alta: la elección viaja como metadata junto a legal_version, solo si la casilla fue ofrecida; la legal sigue siendo obligatoria', async () => {
  const g = load();
  await g.Auth.signUp('a@b.co', 'x', 'legal_v1', { version: 'activity_v1', granted: true });
  assert.deepEqual({ ...g.calls.find((c) => c.signUp).signUp.options.data }, { legal_version: 'legal_v1', activity_consent_version: 'activity_v1', activity_consent: 'granted' });
  const n = load(); await n.Auth.signUp('a@b.co', 'x', 'legal_v1', { version: 'activity_v1', granted: false });
  assert.equal(n.calls.find((c) => c.signUp).signUp.options.data.activity_consent, 'declined');
  for (const choice of [undefined, null, { version: 'x y', granted: true }, { version: 'activity_v1', granted: 'si' }]) {
    const m = load(); await m.Auth.signUp('a@b.co', 'x', 'legal_v1', choice);
    assert.deepEqual({ ...m.calls.find((c) => c.signUp).signUp.options.data }, { legal_version: 'legal_v1' }, 'sin elección válida solo viaja la versión legal');
  }
  const none = load();
  assert.deepEqual(plain(await none.Auth.signUp('a@b.co', 'x', undefined, { version: 'activity_v1', granted: true })), { ok: false, reason: 'legal_acceptance_required' });
  assert.ok(!none.calls.some((c) => c.signUp), 'sin aceptación legal no se crea cuenta, aunque haya consentimiento de actividad');
});

test('cerrar sesión borra el estado en memoria', async () => {
  const g = load({ rpcs: status('granted') }); await g.Auth.getMyActivityConsent();
  await g.Auth.signOut();
  assert.equal(g.Auth.getActivityConsentCached(), null);
});

test('index.html: casilla del alta OPCIONAL, desmarcada y oculta de origen; pantalla de decisión con ACEPTAR y NO, GRACIAS equivalentes; fila en ajustes', () => {
  const field = html.match(/<[^>]*id="signup-activity-consent-field"[^>]*>/)[0];
  assert.match(field, /hidden/);
  const box = html.match(/<input[^>]*id="signup-activity-checkbox"[^>]*>/)[0];
  assert.ok(!/checked/.test(box) && !/required/.test(box), 'nunca marcada de antemano ni obligatoria');
  assert.match(html, /data-legal-hash="actividad-de-uso"/);
  const view = html.slice(html.indexOf('id="view-activity-consent"'));
  for (const id of ['activity-consent-accept-btn', 'activity-consent-decline-btn', 'activity-consent-later-btn', 'activity-consent-back-btn', 'activity-consent-error']) assert.match(view.slice(0, 6000), new RegExp(`id="${id}"`));
  assert.match(html, /id="settings-activity-row"/);
  assert.match(html, /id="signup-terms-checkbox"/, 'la casilla legal existente sigue ahí (no se duplica ni se reemplaza el sistema legal)');
});

test('app.js: el consentimiento se resuelve DESPUÉS del gate legal, nunca bloquea el uso (hay salida «más tarde») y la elección del alta se toma de la casilla visible', () => {
  assert.ok(appJs.indexOf('enforceLegalGate(() => resumeServerSession(options))') < appJs.indexOf('resolveActivityConsent((o)'));
  const resolve = appJs.slice(appJs.indexOf('async function resolveActivityConsent'), appJs.indexOf('function openActivityConsent'));
  assert.match(resolve, /return false/);
  assert.ok(!/status === 'declined'[^\n]*openActivityConsent/.test(resolve), 'quien declinó no es vuelto a interrogar en cada apertura');
  assert.match(appJs, /activity-consent-later-btn'\)\.addEventListener/);
  assert.match(appJs, /signupActivityConsentVersion && !\$\('#signup-activity-consent-field'\)\.hidden/);
  assert.match(appJs, /Auth\.signUp\(email, \$\('#signup-password'\)\.value, legal\.legalVersion, activityChoice\)/);
});

test('versionado en cuarteto consistente (V04.39 / 04.39-h2)', () => {
  const v = JSON.parse(read('version.json'));
  assert.match(String(v.bundle || v.version || JSON.stringify(v)), /04\.39-h\d+/);
  assert.match(read('store.js'), /BRAMUlab V04\.39/);
  assert.match(read('sw.js'), /bramulab-v04-39-h\d+/);
});

test('Política y «Eliminar mi cuenta» (V04.38-h2): describen la medición como OPCIONAL, con retiro, eliminación y constancia; ancla para el enlace; legal_v1 intacta', () => {
  const pol = read('privacidad/index.html'); const del = read('eliminar-cuenta/index.html');
  assert.match(pol, /<h3 id="actividad-de-uso">Actividad básica de uso \(solo si lo aceptás\)<\/h3>/, 'ancla que usan la casilla y la pantalla de consentimiento');
  for (const re of [/es opcional/i, /no registramos esta actividad y usás BRAMUlab exactamente igual/, /Perfil → Configuración → Medición de uso/, /constancia de tu decisión/, /Medición de uso \(solo con tu consentimiento\)/, /no la conservamos anonimizada ni seudonimizada/, /Historial de cambios/, /no hacemos seguimiento individual/i, /no elaboramos fichas, listados ni rankings de uso por persona/]) assert.match(pol, re, String(re));
  assert.match(pol, /data-legal-version="legal_v1"/); assert.match(del, /data-legal-version="legal_v1"/);
  assert.match(pol, /No integramos analítica ni publicidad de terceros/, 'la promesa sobre terceros sigue siendo verdadera y se mantiene');
  assert.ok(!/(sin posibilidad de oposición|no existe un interruptor)/i.test(pol));
  assert.match(del, /registro de actividad básica de uso/); assert.match(del, /constancia técnica/); assert.match(del, /no contiene datos de actividad/);
  for (const [name, h] of [['Política', pol], ['Eliminar cuenta', del]]) assert.ok(!/\[\[PENDIENTE_PRODUCCION/.test(h), `${name}: sin marcadores de Production nuevos`);
  const idx = html.match(/data-legal-hash="([^"]+)"/g) || [];
  assert.ok(idx.length >= 2 && idx.every((x) => x === 'data-legal-hash="actividad-de-uso"'), 'todos los enlaces apuntan al ancla existente');
});

test('Configuración → Medición de uso: ofrece solo la acción OPUESTA al estado actual y la fila no parte su rótulo', () => {
  const fn = appJs.slice(appJs.indexOf('function openActivityConsent'), appJs.indexOf('async function decideActivityConsent'));
  assert.match(fn, /accept-btn'\)\.hidden = fromSettings && currentStatus === 'granted'/);
  assert.match(fn, /decline-btn'\)\.hidden = fromSettings && currentStatus !== 'granted'/);
  const css = read('styles.css');
  assert.match(css, /#settings-activity-row \.settings-row__label\{ white-space:nowrap; \}/);
});
