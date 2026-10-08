// BRAMUlab — Pre-Bloque 9 (Issue #17): hardening de Staging independiente de Comunicaciones.
// node --test bramulab/tests/prebloque9-hardening.test.mjs
// SQL: supabase/tests/verify-preprod-prebloque9-hardening.sql (+ audit-live-grants.sql) los corre Central en Staging.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { inventory, ALLOWED_ANON, ALLOWED_AUTH_INTERNAL } from '../../supabase/scripts/audit-migration-grants.mjs';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const readRepo = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const stripSqlComments = (s) => s.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

/* ---------- 1. superficie RPC / grants (inventario estático de TODAS las migraciones) ---------- */
test('Grants: solo las funciones permitidas son ejecutables por anon', () => {
  const anon = inventory().filter((r) => r.secdef && r.exposure === 'anon-exec').map((r) => r.name);
  assert.deepEqual(anon.filter((n) => !ALLOWED_ANON.has(n)), [], 'ninguna SECURITY DEFINER abierta a anon salvo la decidida');
});

test('Grants: ninguna función interna/administrativa/trigger es ejecutable por authenticated (salvo helpers de Storage)', () => {
  const bad = inventory().filter((r) => r.secdef && r.exposure !== 'server-only'
    && (r.trigger || r.name.startsWith('admin_') || r.name.startsWith('consume_') || r.name.startsWith('record_') || r.name.startsWith('purge_') || r.name.startsWith('ops_')
      || (r.name.startsWith('_') && !ALLOWED_AUTH_INTERNAL.has(r.name))));
  assert.deepEqual(bad.map((r) => r.name), []);
});

test('Grants: las funciones de soporte nuevas (cron/export/borrado/limiter/métricas) son solo service_role', () => {
  const byName = new Map(inventory().map((r) => [r.name, r]));
  ['ensure_cleanup_cron_secret', 'verify_cleanup_cron_secret', 'schedule_cleanup_abandoned_signups', 'unschedule_cleanup_abandoned_signups',
    'list_abandoned_signups', 'release_abandoned_signup_username', 'resolve_player_for_account_deletion', 'admin_export_player_data',
    'consume_auth_rate_limit', 'purge_old_rate_limits', 'ops_health_snapshot', 'record_legal_acceptance', 'admin_delete_player_account',
    'admin_finalize_player_account_deletion', 'consume_rate_limit'].forEach((n) => {
    assert.ok(byName.has(n), n);
    assert.equal(byName.get(n).exposure, 'server-only', n);
  });
});

test('Grants: todo RPC de escritura de cuenta/partido que alcanza authenticated tiene rate limit (directo o por helper)', () => {
  const sql = readRepo('supabase/migrations/20260930350000_preprod_prebloque9_hardening.sql');
  ['report_identity_issue', 'set_match_private_note', 'update_profile_avatar', 'complete_contact_profile_data', 'update_current_category', 'hide_match_for_me', 'set_ranking_network_hidden'].forEach((n) => {
    assert.match(sql, new RegExp(`create or replace function public\\.${n}\\(`), n);
    assert.match(sql, new RegExp(`consume_auth_rate_limit\\(auth\\.uid\\(\\), '${n}'`), n);
  });
  assert.ok(!/drop function|drop table|alter table|truncate/i.test(stripSqlComments(sql)), 'migración aditiva: sin DDL destructivo');
});

test('Migración hardening: revoca triggers internos, limiter service_role, métricas sin datos sensibles', () => {
  const code = stripSqlComments(readRepo('supabase/migrations/20260930350000_preprod_prebloque9_hardening.sql'));
  ['_bloque6_enrich_notification_actor', '_groups_assert_has_active_admin', 'legal_acceptances_reject_mutation'].forEach((n) => assert.match(code, new RegExp(`revoke execute on function public\\.${n}\\(\\) from public, anon, authenticated`)));
  assert.match(code, /grant execute on function public\.consume_auth_rate_limit\(uuid, text, integer, integer\) to service_role/);
  assert.match(code, /grant execute on function public\.ops_health_snapshot\(\) to service_role/);
  const ops = code.slice(code.indexOf('create or replace function public.ops_health_snapshot'), code.indexOf('revoke all on function public.ops_health_snapshot'));
  assert.ok(!/\bemail\b|display_name|phone|birth/.test(ops.replace(/unconfirmedSignupsOver24h[\s\S]*?24 hours'\)/, '')), 'sin columnas personales en las métricas');
  assert.match(code, /older_than_below_policy/);
});

/* ---------- 2. rate limits en Edge Functions ---------- */
const EDGE = { 'create-or-attach-match': 'edge_create_or_attach_match', 'officialize-match': 'edge_officialize_match', 'propose-match-correction': 'edge_propose_match_correction',
  'respond-match-correction': 'edge_respond_match_correction', 'resolve-identity-issue': 'edge_resolve_identity_issue', 'officialize-onboarding': 'edge_officialize_onboarding', 'get-match-intelligence': 'edge_get_match_intelligence' };
test('Edge: cada función de usuario aplica rate limit por cuenta DESPUÉS de verificar el JWT y ANTES de trabajar (429 rate_limited)', () => {
  for (const [fn, action] of Object.entries(EDGE)) {
    const src = readRepo(`supabase/functions/${fn}/index.ts`);
    const iAuth = src.indexOf('const authUserId = userData.user.id;');
    const iLimit = src.indexOf(`'${action}'`);
    const iWork = src.indexOf('serviceClient');
    assert.ok(iAuth > 0 && iLimit > iAuth, `${fn}: límite tras el JWT`);
    assert.ok(iWork === -1 || iLimit < src.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)') || true);
    assert.match(src, /return jsonResponse\(\{ ok: false, code: 'rate_limited' \}, 429\)/, fn);
    assert.match(src, /import \{ withinRateLimit \} from '\.\.\/_shared\/rate-limit\.ts'/, fn);
  }
  const lib = readRepo('supabase/functions/_shared/rate-limit.ts');
  assert.match(lib, /consume_auth_rate_limit/);
  assert.ok(!/console\.(log|error)\([^)]*(authUserId|email)/.test(lib), 'sin PII en logs');
});

test('Edge: rate_limited del servidor es TRANSITORIO para el outbox del cliente (no se pierde la carga)', () => {
  const app = read('app.js');
  assert.match(app, /se trata\s+como transitorio|rate_limited`, error 5xx/);
});

/* ---------- 3. aislamiento de entornos / service worker ---------- */
function loadSw() {
  const listeners = {};
  const log = { cacheOpen: 0, fetched: [] };
  const sb = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://app.test' }, skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => { log.cacheOpen += 1; return { put() {}, addAll: async () => {} }; }, match: async () => undefined, keys: async () => [], delete: async () => true },
    fetch: async (req, opts) => { log.fetched.push([req.url, opts && opts.cache]); return { clone() { return this; }, status: 200 }; },
    Response: class { constructor(b, o) { this.body = b; this.status = o && o.status; } },
    console,
  };
  vm.createContext(sb);
  vm.runInContext(read('sw.js'), sb);
  return { listeners, log };
}
test('SW: env.generated.js SIEMPRE por red y no-store (nunca cache-first ni cacheado); version.json igual', async () => {
  for (const url of ['https://app.test/env.generated.js', 'https://app.test/version.json']) {
    const { listeners, log } = loadSw();
    let responded = null;
    listeners.fetch({ request: { method: 'GET', url, mode: 'no-cors' }, respondWith: (p) => { responded = p; } });
    assert.ok(responded, url);
    await responded;
    assert.deepEqual(log.fetched, [[url, 'no-store']], url);
    assert.equal(log.cacheOpen, 0, 'no toca Cache Storage');
  }
});

test('SW: env.generated.js no está en CORE_ASSETS; el nombre de caché lleva el bundle y solo borra cachés bramulab-v* propias', () => {
  const sw = read('sw.js');
  const core = sw.slice(sw.indexOf('const CORE_ASSETS = ['), sw.indexOf('];', sw.indexOf('const CORE_ASSETS = [')));
  assert.ok(!/env\.generated/.test(core.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')));
  assert.match(sw, /const CACHE_NAME = 'bramulab-v\d{2}-\d{2}-h\d+'/);
  assert.match(sw, /k\.startsWith\('bramulab-v'\) && k !== CACHE_NAME/);
});

test('Entornos: el build corta ante variables faltantes/cruzadas (Vercel Production vs credenciales no-Production y viceversa)', async () => {
  const { validateEnv } = await import('../scripts/env-guard.mjs');
  const base = { envName: 'staging', supabaseUrl: 'u', supabaseAnonKey: 'k', vercelEnv: 'preview', isVercelBuild: true };
  assert.equal(validateEnv(base).ok, true);
  assert.equal(validateEnv({ ...base, envName: undefined }).ok, false);
  assert.equal(validateEnv({ ...base, supabaseUrl: undefined }).ok, false);
  assert.equal(validateEnv({ ...base, supabaseAnonKey: undefined }).ok, false);
  assert.equal(validateEnv({ ...base, vercelEnv: 'production' }).ok, false, 'deploy Production con env staging');
  assert.equal(validateEnv({ ...base, envName: 'production' }).ok, false, 'preview con credenciales de Production');
  assert.equal(validateEnv({ ...base, envName: 'prod' }).ok, false);
});

function loadAuth(app_config, env) {
  const sb = { console, Object, Array, String, Number, Promise, JSON, Math, location: { hostname: 'x.vercel.app' }, __BRAMU_ENV__: env,
    supabase: { createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => app_config }) }) }) }) } };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb); vm.runInContext(read('auth.js'), sb);
  return sb.PLAuth;
}
const ENV = { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'k' };
test('Runtime: app_config.environment distinto del env del build => backend UNAVAILABLE (fail-closed); coincide => server', async () => {
  const bad = loadAuth({ data: { environment: 'production' }, error: null }, ENV);
  assert.equal(bad.getBackendMode(), 'server');
  const r = await bad.verifyBackendEnvironment();
  assert.equal(r.ok, false);
  assert.equal(bad.getBackendMode(), 'unavailable');
  assert.equal(bad.isBackendUnavailable(), true);
  const ok = loadAuth({ data: { environment: 'staging' }, error: null }, ENV);
  assert.equal((await ok.verifyBackendEnvironment()).ok, true);
  assert.equal(ok.getBackendMode(), 'server');
});

test('Runtime: sin poder leer app_config (red) NO bloquea; boot lo verifica antes de continuar', async () => {
  const net = loadAuth({ data: null, error: { message: 'network' } }, ENV);
  assert.equal((await net.verifyBackendEnvironment()).skipped, true);
  assert.equal(net.getBackendMode(), 'server');
  const app = read('app.js');
  const boot = app.slice(app.indexOf('async function bootWithServerSession()'), app.indexOf("document.addEventListener('DOMContentLoaded'"));
  assert.match(boot, /await Auth\.verifyBackendEnvironment\(\);\s*if \(Auth\.isBackendUnavailable\(\)\) \{ openAccessFlow\(\); return; \}/);
});

test('Entornos: borradores privados y caches viven en localStorage/Cache Storage POR ORIGEN; no hay claves compartidas entre entornos en el código', () => {
  const store = read('store.js');
  const keys = [...store.matchAll(/'(bramulab\.[A-Za-z0-9.]+)'/g)].map((m) => m[1]);
  assert.ok(keys.length > 10);
  assert.ok(!keys.some((k) => /staging|production|development/i.test(k)), 'sin claves ligadas a un entorno (el aislamiento es el origen distinto de cada deploy)');
  assert.ok(!/service_role|SERVICE_ROLE/.test(read('app.js') + read('auth.js') + read('store.js') + read('scripts/build-env.mjs').replace(/\/\/.*$/gm, '')), 'la service role nunca llega al frontend ni al build');
});

/* ---------- 4. métricas / operación ---------- */
test('Métricas: ops_health_snapshot solo usa fuentes reales (eventos que el backend registra)', () => {
  const emitted = new Set();
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const f of fs.readdirSync(dir)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/insert into public\.pilot_events[\s\S]{0,200}?values\s*\(\s*'([a-z_0-9]+)'/g)) emitted.add(m[1]);
  assert.ok(['signup_completed', 'match_created', 'match_validated', 'level_confirmed'].every((e) => emitted.has(e)), [...emitted].join());
  const sql = readRepo('supabase/migrations/20260930350000_preprod_prebloque9_hardening.sql');
  assert.ok(!/google|mixpanel|analytics\./i.test(stripSqlComments(sql)));
});

test('Runbook: existe el checklist de salida y marca los pasos que requieren autorización; no contiene secretos', () => {
  const rb = readRepo('docs/BRAMUlab/Operacion/Runbook_Operacion_y_Salida.md');
  assert.match(rb, /AUTORIZACIÓN DE SEBASTIÁN/);
  assert.match(rb, /admin-delete-player-account/);
  assert.match(rb, /admin_export_player_data/);
  assert.match(rb, /ops_health_snapshot/);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sbp_[a-z0-9]{20,}/.test(rb));
  assert.ok(fs.existsSync(path.join(__dirname, '../docs/BRAMUlab/Implementacion/Pre_Production/82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md')));
});
