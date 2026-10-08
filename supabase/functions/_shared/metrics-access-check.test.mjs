// BRAMU Metrics V1 — pruebas del VERIFICADOR de acceso (supabase/scripts/metrics-access-check.mjs).
// Se corre contra una réplica local fiel: el núcleo REAL de la Edge (admin-metrics-core.mjs) + el SQL REAL (PGlite) detrás de un `fetch` simulado.
// Demuestra que (1) el verificador aprueba un servidor correcto y (2) FALLA ante cada tipo de fuga/defecto que debe detectar.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { handleAdminMetrics } from './admin-metrics-core.mjs';
import { runChecks, summarize } from '../../scripts/metrics-access-check.mjs';

const URL_ = 'https://fake.supabase.test'; const SITE = 'https://fake.site.test'; const ANON = 'anon-key-publica';
let db;
before(async () => {
  const r = await replay({ acl: 'observed' }); assert.ok(r.ok); db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
});
after(async () => { if (db) await db.close(); });

const res = (status, body, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });

function makeFetch(opt = {}) {
  const tokens = { 'adm@x.test': 'tok-admin', 'com@x.test': 'tok-common' };
  const who = { 'tok-admin': 'admin-uid', 'tok-common': 'common-uid' };
  const log = [];
  const f = async (u, init = {}) => {
    const method = init.method || 'GET'; const headers = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    log.push(`${method} ${u.replace(URL_, '').replace(SITE, '')}`);
    if (u.includes('/auth/v1/token')) { const b = JSON.parse(init.body); return tokens[b.email] && b.password === 'pw' ? res(200, { access_token: tokens[b.email] }) : res(400, { error: 'invalid' }); }
    if (u.includes('/auth/v1/logout')) return res(204, '');
    if (u.endsWith('/functions/v1/admin-metrics')) {
      const auth = headers.authorization;
      if (!auth) return res(401, { code: 'UNAUTHORIZED_NO_AUTH_HEADER' });
      const jwt = auth.replace(/^Bearer /, '');
      const body = JSON.parse(init.body);
      const out = await handleAdminMetrics({
        jwt, body,
        getUser: async (j) => (who[j] ? { id: who[j] } : null),
        isAdmin: async (id) => (opt.everyoneAdmin ? true : id === 'admin-uid'),
        withinRateLimit: async () => true,
        callSection: async (fn, args) => {
          const names = Object.keys(args);
          const sql = names.length ? `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r` : `select public.${fn}() as r`;
          const r = (await db.query(sql, names.map((n) => args[n]))).rows[0].r;
          return { data: opt.leakEmail && r.ok ? { ...r, leak: 'a@b.com' } : r, error: null };
        },
      });
      return res(out.status, out.body, { 'cache-control': opt.noStoreMissing ? 'public' : 'no-store' });
    }
    if (u.includes('/rest/v1/')) {
      if (opt.restOpen) return res(200, [{ x: 1 }]);
      return res(401, { code: '42501', message: 'permission denied' });
    }
    if (u === `${SITE}/admin/metrics/`) return res(200, '<html>', opt.noIndexMissing ? { 'cache-control': 'no-store' } : { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' });
    if (u === `${SITE}/robots.txt`) return res(200, 'User-agent: *\nDisallow: /\n');
    if (u.startsWith(`${SITE}/admin/metrics/qa-fixture.js`)) return res(opt.fixturePublished ? 200 : 404, '');
    if (u.startsWith(`${SITE}/version.json`)) return res(200, { bundle: '04.37-h31' });
    return res(404, '');
  };
  f.log = log;
  return f;
}
const env = { SUPABASE_URL: URL_, SUPABASE_ANON_KEY: ANON, ADMIN_EMAIL: 'adm@x.test', ADMIN_PASSWORD: 'pw', COMMON_EMAIL: 'com@x.test', COMMON_PASSWORD: 'pw', SITE_URL: SITE };
const by = (results, prefix) => results.find((r) => r.name.startsWith(prefix));

test('servidor correcto (Edge real + SQL real): todas las comprobaciones aprueban; la escritura de presencia queda OMITIDA salvo opt-in', async () => {
  const results = await runChecks({ fetch: makeFetch(), env, target: 'staging' });
  const s = summarize(results);
  assert.equal(s.fail, 0, JSON.stringify(results.filter((r) => r.status === 'FALLA')));
  assert.equal(by(results, '4c').status, 'OMITIDA');
  assert.ok(s.ok >= 18, `OK=${s.ok}`);
  assert.equal(by(results, '2a').status, 'OK'); assert.equal(by(results, '3a').status, 'OK'); assert.equal(by(results, '3f').status, 'OK');
});

test('nunca imprime ni envía credenciales fuera de los pedidos de inicio de sesión; cierra las sesiones (scope local)', async () => {
  const f = makeFetch(); const lines = [];
  await runChecks({ fetch: f, env, target: 'staging', log: (l) => lines.push(l) });
  const text = lines.join('\n');
  for (const secret of ['tok-admin', 'tok-common', ANON, 'adm@x.test', 'com@x.test']) assert.ok(!text.includes(secret), `no imprime ${secret}`);
  assert.equal(f.log.filter((l) => l.includes('/auth/v1/logout')).length, 2);
  assert.ok(f.log.every((l) => !/DELETE|PATCH|PUT/.test(l)), 'solo GET/POST');
});

test('sin credenciales de usuario: lo que no se pudo ejecutar figura OMITIDA (jamás aprobada)', async () => {
  const results = await runChecks({ fetch: makeFetch(), env: { SUPABASE_URL: URL_, SUPABASE_ANON_KEY: ANON }, target: 'staging' });
  for (const p of ['2 cuenta común', '3 cuenta administradora']) assert.equal(by(results, p).status, 'OMITIDA');
  assert.equal(by(results, '1a').status, 'OK');
  assert.equal(summarize(results).fail, 0);
});

test('DETECTA que una cuenta común pueda leer (todos admin) y que el servidor filtre emails o falte no-store', async () => {
  let r = await runChecks({ fetch: makeFetch({ everyoneAdmin: true }), env, target: 'staging' });
  assert.equal(by(r, '2a').status, 'FALLA');
  r = await runChecks({ fetch: makeFetch({ leakEmail: true }), env, target: 'staging' });
  assert.equal(by(r, '3c').status, 'FALLA');
  r = await runChecks({ fetch: makeFetch({ noStoreMissing: true }), env, target: 'staging' });
  assert.equal(by(r, '3d').status, 'FALLA');
});

test('DETECTA PostgREST abierto, sitio sin noindex y fixture de QA publicado en Production; entorno equivocado', async () => {
  let r = await runChecks({ fetch: makeFetch({ restOpen: true }), env, target: 'staging' });
  assert.ok(r.filter((x) => x.name.startsWith('4') && x.status === 'FALLA').length >= 2);
  r = await runChecks({ fetch: makeFetch({ noIndexMissing: true }), env, target: 'staging' });
  assert.equal(by(r, '5b').status, 'FALLA');
  r = await runChecks({ fetch: makeFetch({ fixturePublished: true }), env, target: 'production' });
  assert.equal(by(r, '5d').status, 'FALLA');
  r = await runChecks({ fetch: makeFetch(), env, target: 'production' });
  assert.equal(by(r, '3b').status, 'FALLA', 'el servidor dice staging y se esperaba production');
});
