// BRAMUlab — V04.19 (Pre-Production L1 / Issue #10): aceptación legal real antes de Auth.signUp, password fuera de
// storage, fail-closed, reanudación sin datos sensibles, gate de reaceptación y cleanup de altas abandonadas (cliente).
// Ejecutar con: node --test bramulab/v0419-l1-legal-alta.test.mjs
// Backend (append-only, versión vigente, complete_profile, cleanup SQL): supabase/tests/verify-preprod-l1-legal-cleanup.sql.
// Núcleo del cleanup server-side: supabase/functions/_shared/abandoned-signups-core.test.mjs.
//
// app.js no es cargable tal cual (DOM + IIFE): se EJECUTA código real extraído por marcadores (mismo método que
// v0418-validacion-correcciones.test.mjs) con dependencias falsas, más guardas estáticas de orden/estructura.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const appJs = read('app.js');
const authJs = read('auth.js');
const storeJs = read('store.js');
const indexHtml = read('index.html');

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 60)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 60)}`);
  return src.slice(a, b);
}

/* ---------------- entornos falsos ---------------- */
function makeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m };
}
function loadStore({ now = () => Date.now() } = {}) {
  const local = makeStorage();
  const session = { getItem() { throw new Error('sessionStorage no debe leerse'); }, setItem() { throw new Error('sessionStorage no debe escribirse'); }, removeItem() {} };
  const sb = { console, localStorage: local, sessionStorage: session, Date, JSON, Math, Object, Array, String, Number, Map, Set, Promise, setTimeout, clearTimeout };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(storeJs, sb);
  return { Store: sb.PLStore || sb.Store, local };
}
function loadAuth({ env, hostname = 'localhost', supabaseLib } = {}) {
  const sb = { console, Object, Array, String, Number, Promise, JSON, Math };
  sb.window = sb; sb.globalThis = sb;
  sb.location = { hostname };
  if (env) sb.__BRAMU_ENV__ = env;
  if (supabaseLib) sb.supabase = supabaseLib;
  vm.createContext(sb);
  vm.runInContext(authJs, sb);
  return sb.PLAuth;
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const TEST_ENV = { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'anon' };
function fakeSupabase(record) {
  return {
    createClient: () => ({
      auth: {
        signUp: async (args) => { record.signUps.push(args); return { data: { user: { identities: [{}] } }, error: null }; },
      },
      from: (t) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => record.appConfig(t) }) }) }),
      rpc: async (name, args) => record.rpc(name, args),
    }),
  };
}

/* ================= 1. password fuera de storage + borrador sanitizado ================= */
test('Store: saveSignupDraft NUNCA persiste password/secretos (ni en localStorage ni en sessionStorage)', () => {
  const { Store, local } = loadStore();
  Store.saveSignupDraft({ email: 'a@b.com', password: 'Secreta1!', Password: 'x', otpCode: '123456', accessToken: 't', firstName: 'Ana', legalVersion: 'legal_v1' });
  const raw = local._m.get('bramulab.signupDraft.v1');
  assert.ok(raw, 'se guardó algo');
  assert.ok(!/Secreta1|"password"|otp|123456|accessToken/i.test(raw), 'sin secretos: ' + raw);
  const d = JSON.parse(raw);
  assert.equal(d.email, 'a@b.com');
  assert.equal(d.firstName, 'Ana');
  assert.equal(d.legalVersion, 'legal_v1');
  assert.ok(d.startedAt > 0, 'startedAt registrado');
});

test('Store: un borrador LEGADO con password se purga al cargarlo y se reescribe sin ella', () => {
  const { Store, local } = loadStore();
  local.setItem('bramulab.signupDraft.v1', JSON.stringify({ email: 'viejo@b.com', password: 'Vieja123!', username: 'viejo' }));
  const d = Store.loadSignupDraft();
  assert.equal(d.password, undefined);
  assert.equal(d.email, 'viejo@b.com');
  assert.ok(!local._m.get('bramulab.signupDraft.v1').includes('Vieja123'), 'storage reescrito sin la contraseña');
  assert.ok(d.startedAt > 0);
});

test('Store: startedAt se conserva entre guardados (el reloj de 24 h no se reinicia)', () => {
  const { Store } = loadStore();
  Store.saveSignupDraft({ email: 'a@b.com' });
  const first = Store.loadSignupDraft().startedAt;
  Store.saveSignupDraft({ email: 'a@b.com', firstName: 'Ana' });
  assert.equal(Store.loadSignupDraft().startedAt, first);
});

test('Store: isSignupDraftExpired — vence a las 24 h exactas desde startedAt', () => {
  const { Store } = loadStore();
  const t0 = Date.parse('2026-10-01T10:00:00Z');
  assert.equal(Store.isSignupDraftExpired({ startedAt: t0 }, t0 + 24 * 3600e3 - 1), false);
  assert.equal(Store.isSignupDraftExpired({ startedAt: t0 }, t0 + 24 * 3600e3), true);
  assert.equal(Store.isSignupDraftExpired({}, t0), false, 'sin startedAt no se afirma vencimiento');
  assert.equal(Store.isSignupDraftExpired(null, t0), false);
});

test('app.js: la contraseña nunca entra a signupDraft ni se guarda en variables/almacenes', () => {
  assert.ok(!/signupDraft\.password/.test(appJs), 'signupDraft.password eliminado');
  assert.ok(!/sessionStorage\s*\./.test(appJs + storeJs), 'ni app.js ni store.js usan sessionStorage');
  // el único lugar que lee el campo contraseña del alta hacia Supabase es la llamada a Auth.signUp
  const reads = appJs.match(/\$\('#signup-password'\)\.value/g) || [];
  assert.ok(reads.length >= 3, 'lecturas esperadas (validez, signUp, dev local)');
  assert.ok(!/localStorage\.setItem\([^)]*[Pp]assword/.test(appJs + storeJs), 'nunca se guarda password por localStorage directo');
});

/* ================= 2. aceptación legal antes de Auth.signUp (auth.js real) ================= */
test('Auth.signUp: sin versión legal válida NO llama a Supabase Auth (no nace usuario)', async () => {
  const rec = { signUps: [], appConfig: () => ({ data: null, error: null }), rpc: async () => ({}) };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: fakeSupabase(rec) });
  for (const bad of [undefined, null, '', '   ', 'LEGAL V1', 'x'.repeat(41), 123]) {
    const r = await Auth.signUp('a@b.com', 'Clave123!', bad);
    assert.deepEqual({ ok: r.ok, reason: r.reason }, { ok: false, reason: 'legal_acceptance_required' }, String(bad));
  }
  assert.equal(rec.signUps.length, 0, 'Auth.signUp real jamás se invocó');
});

test('Auth.signUp: con versión legal válida viaja como metadata y la contraseña solo al signUp', async () => {
  const rec = { signUps: [], appConfig: () => ({ data: null, error: null }), rpc: async () => ({}) };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: fakeSupabase(rec) });
  const r = await Auth.signUp('a@b.com', 'Clave123!', 'legal_v1');
  assert.equal(r.ok, true);
  assert.equal(rec.signUps.length, 1);
  assert.deepEqual(plain(rec.signUps[0]), { email: 'a@b.com', password: 'Clave123!', options: { data: { legal_version: 'legal_v1' } } });
});

test('Auth.getCurrentLegalVersion: lee app_config.legal_version del servidor; nunca inventa una', async () => {
  let cfg = { data: { legal_version: 'legal_v1' }, error: null };
  const rec = { signUps: [], appConfig: () => cfg, rpc: async () => ({}) };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: fakeSupabase(rec) });
  assert.deepEqual(plain(await Auth.getCurrentLegalVersion()), { ok: true, legalVersion: 'legal_v1' });
  cfg = { data: null, error: { message: 'boom' } };
  assert.equal((await Auth.getCurrentLegalVersion()).ok, false);
  cfg = { data: { legal_version: '../evil' }, error: null };
  assert.equal((await Auth.getCurrentLegalVersion()).ok, false, 'formato inválido rechazado');
});

test('Auth: get_my_legal_status / accept_legal_version mapean el contrato del servidor (idempotente, append-only)', async () => {
  const calls = [];
  const rec = {
    signUps: [], appConfig: () => ({ data: null, error: null }),
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'get_my_legal_status') return { data: { currentVersion: 'legal_v2', acceptedCurrent: false, latestAcceptedVersion: 'legal_v1', requiresAcceptance: true }, error: null };
      if (name === 'accept_legal_version') return { data: { ok: true, legalVersion: 'legal_v2', acceptedAt: '2026-10-01T00:00:00Z', alreadyAccepted: false }, error: null };
      return { data: null, error: { message: 'unknown' } };
    },
  };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: fakeSupabase(rec) });
  const st = await Auth.getMyLegalStatus();
  assert.deepEqual(plain(st), { ok: true, currentVersion: 'legal_v2', acceptedCurrent: false, latestAcceptedVersion: 'legal_v1', requiresAcceptance: true });
  const acc = await Auth.acceptLegalVersion('legal_v2');
  assert.deepEqual(plain(acc), { ok: true, legalVersion: 'legal_v2', acceptedAt: '2026-10-01T00:00:00Z', alreadyAccepted: false });
  assert.deepEqual(calls.map((c) => c[0]), ['get_my_legal_status', 'accept_legal_version']);
  assert.deepEqual(plain(calls[1][1]), { p_version: 'legal_v2' });
});

test('Auth.completeProfile: el cliente ya NO es autoridad de terms_version (p_terms_version = null siempre)', async () => {
  const calls = [];
  const rec = { signUps: [], appConfig: () => ({}), rpc: async (n, a) => { calls.push([n, a]); return { data: {}, error: null }; } };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: fakeSupabase(rec) });
  await Auth.completeProfile({ username: 'ana', firstName: 'Ana', displayName: 'Ana', termsVersion: 'legal_v999' });
  assert.equal(calls[0][0], 'complete_profile');
  assert.equal(calls[0][1].p_terms_version, null);
});

/* ================= 3. fail-closed Staging/Production ================= */
test('resolveBackendMode: Staging/Production sin credenciales o sin librería => unavailable (nunca local)', () => {
  const Auth = loadAuth();
  const m = (env, lib, host) => Auth.resolveBackendMode(env, lib, host);
  assert.equal(m({ name: 'staging' }, true, 'bramulab-staging.vercel.app'), 'unavailable');
  assert.equal(m({ name: 'production', supabaseUrl: 'u' }, true, 'bramulab.app'), 'unavailable', 'sin anon key');
  assert.equal(m({ name: 'staging', supabaseUrl: 'u', supabaseAnonKey: 'k' }, false, 'x.vercel.app'), 'unavailable', 'librería Supabase no cargó');
  assert.equal(m(undefined, true, 'bramulab-staging.vercel.app'), 'unavailable', 'host desplegado sin env');
  assert.equal(m({ name: 'staging' }, true, 'localhost'), 'unavailable', 'env staging declarado pero incompleto, aun en localhost');
});

test('resolveBackendMode: server con credenciales; local-dev SOLO explícito en host local sin env staging/production', () => {
  const Auth = loadAuth();
  const m = (env, lib, host) => Auth.resolveBackendMode(env, lib, host);
  assert.equal(m({ name: 'staging', supabaseUrl: 'u', supabaseAnonKey: 'k' }, true, 'x.vercel.app'), 'server');
  for (const h of ['localhost', '127.0.0.1', '[::1]', 'app.localhost', 'bramu.test', '']) {
    assert.equal(m(undefined, false, h), 'local-dev', h);
  }
  assert.equal(m({ name: 'development' }, false, 'localhost'), 'local-dev');
  assert.equal(m(undefined, false, 'evil.example.com'), 'unavailable');
});

test('Auth.isBackendUnavailable/isLocalDevFallbackAllowed usan el host real del navegador', () => {
  const dev = loadAuth({ hostname: 'localhost' });
  assert.equal(dev.isLocalDevFallbackAllowed(), true);
  assert.equal(dev.isBackendUnavailable(), false);
  const deployed = loadAuth({ hostname: 'bramulab-staging.vercel.app' });
  assert.equal(deployed.isLocalDevFallbackAllowed(), false);
  assert.equal(deployed.isBackendUnavailable(), true);
});

test('app.js: alta, login y recuperación frenan en unavailable ANTES de cualquier camino local', () => {
  const step1 = between(appJs, "      if (signupStep === 1) {\n        const step1Error", "        const email = $('#signup-email').value.trim();");
  assert.match(step1, /Auth\.isBackendUnavailable\(\)/);
  const login = between(appJs, "const password = $('#login-password').value;", "const result = Store.loginWithEmail(email, password);");
  assert.match(login, /Auth\.isBackendUnavailable\(\)[\s\S]*return;/);
  const forgot = between(appJs, "const email = $('#forgot-password-email').value.trim();\n      if (!Auth.isConfigured()) {", "const user = Store.getUserByEmail(email);");
  assert.match(forgot, /Auth\.isBackendUnavailable\(\)[\s\S]*return;/);
  assert.match(between(appJs, "    if (!Auth.isConfigured()) {\n      // L1 (V04.19) — FAIL-CLOSED", "    let savedDraft"), /openAccessFlow\(\);\s*return;/);
  assert.match(between(appJs, "  function openSignupWizard() {", "  async function prefetchSignupLegalVersion"), /blockIfBackendUnavailable\(\)/);
  assert.match(between(appJs, "      if (!Auth.isConfigured()) {\n        // L1 (V04.19) — fail-closed: nunca se crea una cuenta local", "syncCurrentIdentityFromStore"), /blockIfBackendUnavailable\(\)/);
});

/* ================= 4. Paso 1 real de app.js: aceptación previa, sin password persistida, retry ================= */
function runStep1({ checked = true, unavailable = false, configured = true, legal = { ok: true, legalVersion: 'legal_v1' }, signUpResult = { ok: true }, draft = {}, email = 'Ana@Test.com', password = 'Clave123!' } = {}) {
  const { Store, local } = loadStore();
  const body = between(appJs, "      if (signupStep === 1) {\n        const step1Error", "      if (signupStep === 'verify') {\n        continueBtn.disabled = true;\n        const result = await Auth.verifySignupOtp");
  const els = {
    '#signup-terms-checkbox': { checked }, '#signup-email': { value: email }, '#signup-password': { value: password },
    '#signup-password-repeat': { value: password }, '#signup-step1-error': { hidden: true, textContent: '' },
  };
  const calls = { signUp: [], legal: 0 };
  const sb = {
    $: (sel) => els[sel],
    Store,
    Auth: {
      isBackendUnavailable: () => unavailable,
      isConfigured: () => configured,
      getCurrentLegalVersion: async () => { calls.legal += 1; return legal; },
      signUp: async (...a) => { calls.signUp.push(a); return signUpResult; },
    },
    SIGNUP_STEP1_ERROR_TEXT: { not_configured: 'NC', legal_acceptance_required: 'LAR', legal_version_unavailable: 'LVU', unknown: 'U', email_taken: 'ET' },
    signupDraft: Object.assign({}, draft), signupStep: 1, signupLegalVersion: null, continueBtn: { disabled: false },
    renderSignupStep() {}, console,
  };
  vm.createContext(sb);
  vm.runInContext(`async function __run(){ ${body} }`, sb);
  return { sb, els, calls, local, Store, run: () => sb.__run() };
}

test('Paso 1: checkbox legal SIN marcar => Auth.signUp y lectura de versión NUNCA se invocan', async () => {
  const t = runStep1({ checked: false });
  await t.run();
  assert.equal(t.calls.signUp.length, 0);
  assert.equal(t.calls.legal, 0);
  assert.equal(t.els['#signup-step1-error'].hidden, false);
  assert.equal(t.els['#signup-step1-error'].textContent, 'LAR');
});

test('Paso 1: backend unavailable => no hay signUp ni camino local (fail-closed)', async () => {
  const t = runStep1({ unavailable: true, configured: false });
  await t.run();
  assert.equal(t.calls.signUp.length, 0);
  assert.equal(t.sb.signupStep, 1, 'no avanza a Paso 2 en local');
  assert.equal(t.els['#signup-step1-error'].textContent, 'NC');
});

test('Paso 1: sin poder leer la versión legal vigente del servidor => no hay signUp', async () => {
  const t = runStep1({ legal: { ok: false, reason: 'legal_version_unavailable' } });
  await t.run();
  assert.equal(t.calls.signUp.length, 0);
  assert.equal(t.els['#signup-step1-error'].textContent, 'LVU');
  assert.equal(t.sb.continueBtn.disabled, false, 'el botón se rehabilita');
});

test('Paso 1 feliz: signUp UNA vez con la versión vigente del servidor; password borrada del DOM y ausente del storage', async () => {
  const t = runStep1({});
  await t.run();
  assert.equal(t.calls.signUp.length, 1);
  assert.deepEqual(t.calls.signUp[0], ['Ana@Test.com', 'Clave123!', 'legal_v1']);
  assert.equal(t.els['#signup-password'].value, '', 'password fuera del DOM');
  assert.equal(t.els['#signup-password-repeat'].value, '');
  assert.equal(t.sb.signupStep, 2);
  const raw = t.local._m.get('bramulab.signupDraft.v1');
  assert.ok(raw && !/Clave123/.test(raw), 'storage sin password: ' + raw);
  const d = JSON.parse(raw);
  assert.equal(d.legalVersion, 'legal_v1');
  assert.equal(d.authSignUpDone, true);
  assert.equal(d.email, 'Ana@Test.com');
  assert.ok(d.startedAt > 0);
  assert.ok(!('password' in t.sb.signupDraft), 'tampoco en el objeto en memoria');
});

test('Paso 1 reintento/reanudación: con el alta ya iniciada para el mismo email NO se vuelve a crear el usuario Auth ni se exige la contraseña persistida', async () => {
  const t = runStep1({ draft: { email: 'ana@test.com', authSignUpDone: true, legalVersion: 'legal_v1' }, password: '' });
  await t.run();
  assert.equal(t.calls.signUp.length, 0);
  assert.equal(t.calls.legal, 0);
  assert.equal(t.sb.signupStep, 2);
});

test('Paso 1 con email distinto al del alta iniciada SÍ crea otro alta (con aceptación nueva)', async () => {
  const t = runStep1({ draft: { email: 'otro@test.com', authSignUpDone: true, legalVersion: 'legal_v1' } });
  await t.run();
  assert.equal(t.calls.signUp.length, 1);
});

test('Paso 1: error de signUp (email ya registrado) no marca el alta como iniciada ni persiste nada', async () => {
  const t = runStep1({ signUpResult: { ok: false, reason: 'email_taken' } });
  await t.run();
  assert.equal(t.els['#signup-step1-error'].textContent, 'ET');
  assert.equal(t.sb.signupStep, 1);
  assert.ok(!t.sb.signupDraft.authSignUpDone);
  assert.equal(t.local._m.get('bramulab.signupDraft.v1'), undefined);
});

test('Paso 1 en HTML: checkbox legal único, en el Paso 1 (no en el 2), con links a Términos y Privacidad; sin edad/parental', () => {
  const step1 = between(indexHtml, '<div class="signup-step" data-step="1">', '<div class="signup-step" data-step="verify"');
  const step2 = between(indexHtml, '<div class="signup-step" data-step="2" hidden>', '<button type="button" id="signup-continue-btn"');
  assert.match(step1, /id="signup-terms-checkbox"/);
  assert.ok(!/signup-terms-checkbox/.test(step2), 'el Paso 2 ya no repite el checkbox');
  assert.match(step1, /href="terminos\/"[\s\S]*Términos y Condiciones/);
  assert.match(step1, /href="privacidad\/"[\s\S]*Política de Privacidad/);
  assert.equal((indexHtml.match(/type="checkbox"/g) || []).filter(() => true).length >= 1, true);
  assert.ok(!/13 años|mayor de 13|autorizaci[oó]n parental|adulto responsable/i.test(step1 + step2 + appJs), 'NO se implementa restricción 13+ ni flujo parental');
});

test('Paso 2: la validez ya NO depende del checkbox; Paso 1 SÍ', () => {
  const v = between(appJs, '  function recomputeSignupStepValidity() {', "    $('#signup-continue-btn').disabled = !ok;");
  const p1 = between(v, 'if (signupStep === 1) {', "} else if (signupStep === 'verify')");
  const p2 = between(v, '} else if (signupStep === 2) {', '    }\n');
  assert.match(p1, /signup-terms-checkbox/);
  assert.ok(!/signup-terms-checkbox/.test(p2));
});

/* ================= 5. reanudación / alta abandonada en cliente (bootWithServerSession real) ================= */
function runBoot({ configured = true, unavailable = false, draft = null, session = null, now = Date.now() }) {
  const { Store, local } = loadStore();
  if (draft) local.setItem('bramulab.signupDraft.v1', JSON.stringify(draft));
  const fn = between(appJs, '  async function bootWithServerSession() {', "  document.addEventListener('DOMContentLoaded'");
  const log = [];
  const sb = {
    Store: Object.assign({}, Store, { isSignupDraftExpired: (d) => Store.isSignupDraftExpired(d, now), getCurrentUser: () => null }),
    Auth: { isConfigured: () => configured, isBackendUnavailable: () => unavailable, verifyBackendEnvironment: async () => ({ ok: true }), getSession: async () => session },
    captureClaimTokenFromUrl() {}, bootDefaultScreen: () => log.push('default'), openAccessFlow: () => log.push('access'),
    resumeDraftFlow: async () => log.push('resumeDraft'), resumeServerSession: async () => log.push('resumeSession'),
    exitGhostServerSession: () => log.push('ghost'), signupDraft: {}, console,
  };
  vm.createContext(sb);
  vm.runInContext(fn + '\nglobalThis.__boot = bootWithServerSession;', sb);
  return { run: () => sb.__boot(), log, sb, local };
}

test('Boot: alta iniciada hace < 24 h y sin sesión => reanuda (sin password que recuperar)', async () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const t = runBoot({ draft: { email: 'a@b.com', authSignUpDone: true, legalVersion: 'legal_v1', startedAt: now - 3600e3 }, now });
  await t.run();
  assert.deepEqual(t.log, ['resumeDraft']);
  assert.equal(t.sb.signupDraft.password, undefined);
  assert.ok(t.local._m.get('bramulab.signupDraft.v1'));
});

test('Boot: alta abandonada > 24 h y sin sesión => borrador local descartado (no reanuda)', async () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const t = runBoot({ draft: { email: 'a@b.com', username: 'ana_01', authSignUpDone: true, startedAt: now - 25 * 3600e3 }, now });
  await t.run();
  assert.deepEqual(t.log, ['default']);
  assert.equal(t.local._m.get('bramulab.signupDraft.v1'), undefined, 'borrador (y su @usuario local) eliminado');
  assert.deepEqual(plain(t.sb.signupDraft), {});
});

test('Boot: con sesión REAL el borrador nunca se descarta por edad (cuenta constituida no vence por inactividad)', async () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const t = runBoot({ draft: { email: 'a@b.com', startedAt: now - 500 * 3600e3 }, session: { user: { id: 'u' } }, now });
  await t.run();
  assert.deepEqual(t.log, ['resumeSession']);
  assert.ok(t.local._m.get('bramulab.signupDraft.v1'));
});

test('Boot fail-closed: host desplegado sin backend => Acceso (nunca Home local)', async () => {
  const t = runBoot({ configured: false, unavailable: true });
  await t.run();
  assert.deepEqual(t.log, ['access']);
});

test('Boot dev local explícito: sin backend y host local => arranque local de siempre', async () => {
  const t = runBoot({ configured: false, unavailable: false });
  await t.run();
  assert.deepEqual(t.log, ['default']);
});

/* ================= 6. gate de reaceptación (enforceLegalGate real) ================= */
function runGate({ status, cur = { ok: true, legalVersion: 'legal_v1' }, configured = true, opts }) {
  const fn = between(appJs, '  async function enforceLegalGate(onAccepted, opts) {', '  function initLegalGate() {');
  const opened = [];
  const toasts = [];
  const sb = {
    Auth: { isConfigured: () => configured, getMyLegalStatus: async () => status, getCurrentLegalVersion: async () => cur },
    openLegalGate: (v, cb) => opened.push([v, cb]), showToast: (m) => toasts.push(m), console,
  };
  vm.createContext(sb);
  vm.runInContext(fn + '\nglobalThis.__gate = enforceLegalGate;', sb);
  return { run: (cb) => sb.__gate(cb, opts), opened, toasts };
}

test('Gate: versión vigente distinta de la última aceptada => bloquea (abre gate) con la versión del servidor', async () => {
  const t = runGate({ status: { ok: true, currentVersion: 'legal_v2', acceptedCurrent: false, latestAcceptedVersion: 'legal_v1', requiresAcceptance: true } });
  const cont = () => {};
  assert.equal(await t.run(cont), true);
  assert.deepEqual([t.opened[0][0], t.opened[0][1] === cont], ['legal_v2', true]);
});

test('Gate: cuenta histórica sin aceptación registrada => bloquea hasta aceptar explícitamente', async () => {
  const t = runGate({ status: { ok: true, currentVersion: 'legal_v1', acceptedCurrent: false, latestAcceptedVersion: null, requiresAcceptance: true } });
  assert.equal(await t.run(() => {}), true);
  assert.equal(t.opened.length, 1);
});

test('Gate: versión aceptada al día => no bloquea; lectura fallida => no bloquea (la exigencia dura es server-side)', async () => {
  const ok = runGate({ status: { ok: true, currentVersion: 'legal_v1', acceptedCurrent: true, latestAcceptedVersion: 'legal_v1', requiresAcceptance: false } });
  assert.equal(await ok.run(() => {}), false);
  const fail = runGate({ status: { ok: false, code: 'network' }, cur: { ok: false } });
  assert.equal(await fail.run(() => {}), false);
  assert.equal(fail.opened.length, 0);
  const local = runGate({ status: { ok: false }, configured: false });
  assert.equal(await local.run(() => {}), false);
});

test('Gate force (complete_profile rechazó legal_acceptance_required): abre el gate aunque la lectura falle si hay versión', async () => {
  const t = runGate({ status: { ok: false }, cur: { ok: true, legalVersion: 'legal_v1' }, opts: { force: true } });
  assert.equal(await t.run(() => {}), true);
  assert.equal(t.opened[0][0], 'legal_v1');
  const none = runGate({ status: { ok: false }, cur: { ok: false }, opts: { force: true } });
  assert.equal(await none.run(() => {}), true, 'sin versión: no avanza (avisa) — nunca fabrica aceptación');
  assert.equal(none.opened.length, 0);
  assert.equal(none.toasts.length, 1);
});

test('Gate en app.js: se evalúa en login/boot (resumeServerSession) y foreground; aceptar exige checkbox y llama accept_legal_version; logout disponible', () => {
  const rs = between(appJs, '  async function resumeServerSession(opts) {', '  /** Backend Bloque 4 — captura');
  assert.match(rs, /enforceLegalGate\(\(\) => resumeServerSession\(options\)\)/);
  assert.ok(rs.indexOf('enforceLegalGate') > rs.indexOf('resumeSignupProfileStep'), 'solo para onboarding terminado (el alta en curso lo cubre complete_profile)');
  assert.match(appJs, /enforceLegalGate\(\(\) => openPlayerHome\(\)\)/, 'foreground');
  const init = between(appJs, '  function initLegalGate() {', '  /** Laboratorio integrado — hotfix de "sesión fantasma"');
  assert.match(init, /Auth\.acceptLegalVersion\(legalGateVersion\)/);
  assert.match(init, /legal-gate-checkbox'\)\.checked/);
  assert.match(init, /legal-gate-logout-btn'\)\.addEventListener\('click', doLogout\)/);
  const run = between(appJs, '    const completeResult = await Auth.completeProfile({', '    const officialResult = await Auth.officializeLevel');
  assert.match(run, /legal_acceptance_required[\s\S]*enforceLegalGate\(\(\) => runOfficializeAndEnter\(\), \{ force: true \}\)/);
  assert.match(indexHtml, /id="view-legal-gate"/);
  assert.match(appJs, /'group-settings', 'legal-gate'/, 'showView conoce la vista');
});

/* ================= 7. no regresión login/recovery/onboarding ================= */
test('Regresión: login/recovery/updatePassword/OTP de auth.js conservan su contrato', async () => {
  const calls = [];
  const lib = {
    createClient: () => ({
      auth: {
        signInWithPassword: async (a) => { calls.push(['signIn', a]); return { data: { session: { s: 1 } }, error: null }; },
        resetPasswordForEmail: async (e) => { calls.push(['reset', e]); return { error: null }; },
        verifyOtp: async (a) => { calls.push(['verify', a]); return { data: { session: { s: 2 } }, error: null }; },
        updateUser: async (a) => { calls.push(['update', a]); return { error: null }; },
        resend: async (a) => { calls.push(['resend', a]); return { error: null }; },
      },
    }),
  };
  const Auth = loadAuth({ env: TEST_ENV, supabaseLib: lib });
  assert.equal((await Auth.signInWithPassword('a@b.com', 'p')).ok, true);
  assert.equal((await Auth.sendRecoveryOtp('a@b.com')).ok, true);
  assert.equal((await Auth.verifyRecoveryOtp('a@b.com', '123456')).ok, true);
  assert.equal((await Auth.verifySignupOtp('a@b.com', '123456')).ok, true);
  assert.equal((await Auth.resendSignupOtp('a@b.com')).ok, true);
  assert.equal((await Auth.updatePassword('Nueva123!')).ok, true);
  assert.deepEqual(calls.map((c) => c[0]), ['signIn', 'reset', 'verify', 'verify', 'resend', 'update']);
  assert.deepEqual(plain(calls[3][1]), { email: 'a@b.com', token: '123456', type: 'signup' });
});

test('Regresión: el flujo de onboarding conserva sus pasos (verify último, runOfficializeAndEnter, resumeDraftFlow) y no persiste password', () => {
  assert.match(appJs, /const SIGNUP_STEP_ORDER = \[1, 2, 'verify'\]/);
  assert.match(appJs, /async function resumeDraftFlow\(\)/);
  assert.match(appJs, /Store\.clearSignupDraft\(\);\s*signupDraft = \{\};/);
  assert.ok(!/TERMS_VERSION|piloto_v1/.test(appJs + indexHtml), 'versión legal hardcodeada eliminada');
  assert.ok(!/signupDraft\.termsVersion|signup-terms-checkbox'\)\.checked = !!signupDraft/.test(appJs));
});

test('Versión: V04.24 / 04.24-h1 coherentes entre store/version.json/sw/index/manifest', () => {
  assert.match(storeJs, /APP_VERSION = 'BRAMUlab V04\.24'/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\.24-h1'/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.24', bundle: '04.24-h1' });
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-24-h1'/);
  assert.ok(!/04\.18-h1/.test(read('sw.js') + indexHtml + read('manifest.webmanifest')));
});

/* ================= 8. migración / Edge Function: guardas de contrato ================= */
test('Migración L1: contrato append-only, versión server-side, fail-closed en complete_profile y cleanup sin tocar confirmadas', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930280000_preprod_l1_legal_acceptance_abandoned_signups.sql'), 'utf8');
  assert.match(sql, /constraint legal_acceptances_player_version_key unique \(player_id, legal_version\)/);
  assert.match(sql, /before update or delete on public\.legal_acceptances/);
  assert.match(sql, /on conflict \(player_id, legal_version\) do nothing/);
  assert.match(sql, /record_legal_acceptance\(v_player_id, v_legal_version, 'signup', new\.created_at\)/);
  assert.match(sql, /raise exception 'legal_acceptance_required'/);
  assert.match(sql, /terms_accepted_at = v_terms_at/);
  assert.ok(!/terms_accepted_at = case when p_terms_version/.test(sql), 'ya no pisa terms_accepted_at con now()');
  assert.match(sql, /p_version is distinct from v_current/);
  assert.match(sql, /u\.email_confirmed_at is null[\s\S]*u\.phone_confirmed_at is null[\s\S]*u\.last_sign_in_at is null/);
  assert.match(sql, /min_age_below_policy/);
  assert.match(sql, /grant execute on function public\.list_abandoned_signups\(interval, integer\) to service_role/);
  assert.ok(!/delete from auth\.users/i.test(sql), 'nunca DELETE directo sobre auth.users');
  assert.ok(!/13 años|parental/i.test(sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')), 'sin restricción de edad/parental en el código SQL');
  const edge = fs.readFileSync(path.join(__dirname, '../supabase/functions/cleanup-abandoned-signups/index.ts'), 'utf8');
  assert.match(edge, /token === SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /verify_cleanup_cron_secret/);
  assert.match(edge, /auth\.admin\.deleteUser/);
  assert.ok(!/console\.(log|error)\([^)]*email/i.test(edge));
});
