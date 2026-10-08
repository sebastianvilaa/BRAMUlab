// BRAMU Metrics V1 · F2 — pruebas del núcleo de la Edge Function admin-metrics (fakes) + contrato contra el SQL real (PGlite).
// node --test supabase/functions/_shared/admin-metrics-core.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminMetrics, validateMetricsBody, SECTION_FUNCTIONS, RANGES } from './admin-metrics-core.mjs';
import { replay } from '../../scripts/replay-migrations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function deps(over = {}) {
  const calls = { user: [], admin: [], limit: [], section: [], log: [] };
  const base = {
    jwt: 'jwt-opaco',
    body: { section: 'users', range: '30d' },
    getUser: async (j) => { calls.user.push(j); return { id: 'auth-admin-1' }; },
    isAdmin: async (id) => { calls.admin.push(id); return true; },
    withinRateLimit: async (id) => { calls.limit.push(id); return true; },
    callSection: async (fn, args) => { calls.section.push([fn, args]); return { data: { ok: true, section: 'users', kpis: [] }, error: null }; },
    log: (c) => calls.log.push(c),
  };
  return { d: { ...base, ...over }, calls };
}

test('camino feliz: JWT -> admin -> rate limit -> RPC fija con args normalizados; devuelve el JSON agregado tal cual', async () => {
  const { d, calls } = deps();
  const r = await handleAdminMetrics(d);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, section: 'users', kpis: [] });
  assert.deepEqual(calls.admin, ['auth-admin-1']);
  assert.deepEqual(calls.section, [['metrics_users', { p_range: '30d', p_compare: true, p_include_internal: false }]]);
  assert.deepEqual(calls.log, ['served']);
});

test('sin Authorization o JWT inválido: 401 y NADA más se ejecuta', async () => {
  for (const [jwt, getUser, code] of [['', undefined, 'missing_authorization'], ['x', async () => null, 'invalid_session'], ['x', async () => { throw new Error('boom'); }, 'invalid_session'], ['x', async () => ({}), 'invalid_session']]) {
    const { d, calls } = deps({ jwt, ...(getUser ? { getUser } : {}) });
    const r = await handleAdminMetrics(d);
    assert.equal(r.status, 401); assert.equal(r.body.code, code);
    assert.deepEqual([calls.admin, calls.limit, calls.section], [[], [], []]);
  }
});

test('usuario autenticado que NO es administrador: 403 genérico, sin rate limit ni RPC ni validación del body (no se puede sondear)', async () => {
  for (const isAdmin of [async () => false, async () => { throw new Error('rpc down'); }, async () => 'true', async () => null]) {
    const { d, calls } = deps({ isAdmin, body: { section: 'DROP', range: 'x', extra: 1 } });
    const r = await handleAdminMetrics(d);
    assert.equal(r.status, 403);
    assert.deepEqual(r.body, { ok: false, code: 'forbidden' });
    assert.deepEqual([calls.limit, calls.section], [[], []]);
    assert.deepEqual(calls.log, ['denied']);
  }
});

test('la respuesta de 403 es idéntica para cuenta común, admin revocado e inexistente (sin oráculo)', async () => {
  const outs = [];
  for (const user of [{ id: 'comun' }, { id: 'revocado' }, { id: 'no-existe' }]) {
    outs.push(JSON.stringify((await handleAdminMetrics(deps({ getUser: async () => user, isAdmin: async () => false }).d)).body));
  }
  assert.equal(new Set(outs).size, 1);
});

test('rate limit: 429 tras autorizar y antes del RPC; si el limitador falla se deja pasar (fail-open) solo para el admin ya autorizado', async () => {
  const lim = deps({ withinRateLimit: async () => false });
  assert.deepEqual([(await handleAdminMetrics(lim.d)).status, lim.calls.section.length], [429, 0]);
  const down = deps({ withinRateLimit: async () => { throw new Error('down'); } });
  assert.equal((await handleAdminMetrics(down.d)).status, 200);
});

test('validación del body: solo section/range/compare/includeInternal; secciones y rangos de lista cerrada; custom reservado', () => {
  const ok = (b) => validateMetricsBody(b);
  assert.equal(ok({ section: 'overview' }).args.p_range, '30d', 'rango por defecto');
  assert.equal(ok({ section: 'usage', range: 'all', compare: false, includeInternal: true }).args.p_include_internal, true);
  for (const s of Object.keys(SECTION_FUNCTIONS)) assert.equal(ok({ section: s }).fn, SECTION_FUNCTIONS[s]);
  for (const r of RANGES) assert.equal(ok({ section: 'users', range: r }).ok, true);
  const bad = [
    [null, 'invalid_payload'], ['x', 'invalid_payload'], [[], 'invalid_payload'], [{}, 'invalid_section'],
    [{ section: 'metrics_users' }, 'invalid_section'], [{ section: 'users; drop table players' }, 'invalid_section'], [{ section: '__proto__' }, 'invalid_section'], [{ section: 'constructor' }, 'invalid_section'],
    [{ section: 'users', range: '1d' }, 'invalid_range'], [{ section: 'users', range: 7 }, 'invalid_range'],
    [{ section: 'users', range: 'custom' }, 'range_not_supported'],
    [{ section: 'users', compare: 'yes' }, 'invalid_payload'], [{ section: 'users', includeInternal: 1 }, 'invalid_payload'],
    [{ section: 'users', playerId: 'x' }, 'invalid_payload'], [{ section: 'users', sql: 'select 1' }, 'invalid_payload'], [{ section: 'users', metric: 'matches.created' }, 'invalid_payload'],
  ];
  for (const [b, code] of bad) assert.equal(ok(b).code, code, JSON.stringify(b));
});

test('errores del RPC o respuesta rara: 500 genérico, sin detalle interno', async () => {
  for (const callSection of [async () => ({ data: null, error: { message: 'relation "x" does not exist' } }), async () => { throw new Error('secreto'); }, async () => ({ data: { ok: false }, error: null }), async () => null]) {
    const { d } = deps({ callSection });
    const r = await handleAdminMetrics(d);
    assert.deepEqual([r.status, r.body], [500, { ok: false, code: 'metrics_failed' }]);
  }
});

test('index.ts: verify_jwt=true con getUser del JWT, rate limit tras el JWT, sin SQL libre, sin service role en la respuesta y no-store', () => {
  const src = fs.readFileSync(path.join(HERE, '..', 'admin-metrics', 'index.ts'), 'utf8');
  assert.match(src, /auth\.getUser\(token\)/);
  assert.match(src, /import \{ withinRateLimit \} from '\.\.\/_shared\/rate-limit\.ts'/);
  assert.match(src, /'edge_admin_metrics', 60, 60/);
  assert.match(src, /rpc\('metrics_is_admin'/);
  assert.match(src, /Cache-Control': 'no-store'/);
  assert.ok(!/\.from\(['"]|\.sql|exec_sql|rpc\(fn \+|rpc\(`/.test(src), 'nada de tablas ni SQL arbitrario desde la función');
  assert.ok(!/console\.(log|error)\([^)]*(jwt|token|authUserId|email|body)/i.test(src), 'sin PII en logs');
  assert.ok(!/SERVICE_ROLE_KEY[^;]*(json|Response|body)/i.test(src.replace(/createClient\([^)]*\)/g, '')), 'la service role no viaja a respuestas');
});

test('contrato con el SQL real: cada función del mapa existe y acepta exactamente los args que arma el núcleo', async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok);
  const db = r.db;
  try {
    await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
    for (const [section, fn] of Object.entries(SECTION_FUNCTIONS)) {
      for (const range of RANGES) {
        const v = validateMetricsBody({ section, range, compare: range !== 'all' });
        const res = (await db.query(`select public.${fn}(p_range => $1, p_compare => $2, p_include_internal => $3) as r`, [v.args.p_range, v.args.p_compare, v.args.p_include_internal])).rows[0].r;
        assert.equal(res.ok, true, `${fn}/${range}`);
        assert.equal(res.section, section);
        assert.equal(res.meta.environment, 'staging');
        assert.ok(Array.isArray(res.kpis), `${fn}: kpis`);
      }
    }
  } finally { await db.close(); }
});
