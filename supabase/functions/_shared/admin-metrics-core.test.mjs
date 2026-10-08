// BRAMU Metrics V1 · F2 — pruebas del núcleo de la Edge Function admin-metrics (fakes) + contrato contra el SQL real (PGlite).
// node --test supabase/functions/_shared/admin-metrics-core.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminMetrics, validateMetricsBody, validateExploreBody, validateAnyBody, SECTION_FUNCTIONS, RANGES, EXPLORE_CLIENT_ERRORS } from './admin-metrics-core.mjs';
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


/* ---------------- F6 · Explorar ---------------- */

test('F6 · validación del Explorador: solo id de catálogo, rango cerrado y UN filtro {id,value}; nada de SQL, tablas, columnas ni claves extra', () => {
  const ok = validateExploreBody({ metric: 'users.signups' });
  assert.deepEqual([ok.ok, ok.fn, ok.args], [true, 'metrics_explore', { p_metric: 'users.signups', p_range: '30d', p_compare: true, p_include_internal: false, p_filter: null, p_value: null }]);
  const f = validateExploreBody({ metric: 'matches.created', range: 'all', compare: false, includeInternal: true, filter: { id: 'match_status', value: 'validated' } });
  assert.deepEqual(f.args, { p_metric: 'matches.created', p_range: 'all', p_compare: false, p_include_internal: true, p_filter: 'match_status', p_value: 'validated' });
  assert.deepEqual(validateExploreBody({ catalog: true }), { ok: true, mode: 'catalog', fn: 'metrics_explore_catalog', args: {} });
  assert.equal(validateExploreBody({ metric: 'users.signups', filter: null }).args.p_filter, null);
  const bad = [
    [null, 'invalid_payload'], [[], 'invalid_payload'], ['x', 'invalid_payload'], [{ catalog: false }, 'invalid_payload'], [{ catalog: true, metric: 'users.signups' }, 'invalid_payload'],
    [{ metric: 5 }, 'invalid_metric'], [{ metric: 'users' }, 'invalid_metric'], [{ metric: 'Users.Signups' }, 'invalid_metric'], [{ metric: 'users.signups; drop table players' }, 'invalid_metric'],
    [{ metric: 'users.' + 'a'.repeat(60) }, 'invalid_metric'], [{ metric: '__proto__' }, 'invalid_metric'], [{ metric: 'matches.created\n' }, 'invalid_metric'],
    [{ metric: 'users.signups', range: '1d' }, 'invalid_range'], [{ metric: 'users.signups', range: 'custom' }, 'range_not_supported'],
    [{ metric: 'users.signups', compare: 'si' }, 'invalid_payload'], [{ metric: 'users.signups', includeInternal: 1 }, 'invalid_payload'],
    [{ metric: 'users.signups', sql: 'select 1' }, 'invalid_payload'], [{ metric: 'users.signups', table: 'players' }, 'invalid_payload'], [{ metric: 'users.signups', groupBy: 'x' }, 'invalid_payload'],
    [{ metric: 'users.signups', filter: 'location' }, 'invalid_filter'], [{ metric: 'users.signups', filter: [] }, 'invalid_filter'], [{ metric: 'users.signups', filter: { id: 'location', value: 'x', extra: 1 } }, 'invalid_filter'],
    [{ metric: 'users.signups', filter: { id: 'Location', value: 'x' } }, 'invalid_filter'], [{ metric: 'users.signups', filter: { id: 'a'.repeat(30), value: 'x' } }, 'invalid_filter'],
    [{ metric: 'users.signups', filter: { id: 'location' } }, 'invalid_filter_value'], [{ metric: 'users.signups', filter: { id: 'location', value: '' } }, 'invalid_filter_value'],
    [{ metric: 'users.signups', filter: { id: 'location', value: 'x'.repeat(121) } }, 'invalid_filter_value'], [{ metric: 'users.signups', filter: { id: 'location', value: 3 } }, 'invalid_filter_value'],
    [{ metric: 'users.signups', filter: { id: 'location', value: 'a\u0000b' } }, 'invalid_filter_value'],
  ];
  for (const [b, code] of bad) assert.equal(validateExploreBody(b).code, code, JSON.stringify(b));
  // el valor es texto libre acotado: puede traer comillas/tildes (se compara, nunca se concatena)
  assert.equal(validateExploreBody({ metric: 'users.signups', filter: { id: 'location', value: "Bella Vista' ; --" } }).ok, true);
});

test('F6 · el modo se decide por la forma del body y mezclarlos es inválido; los paneles siguen validándose igual', () => {
  assert.equal(validateAnyBody({ section: 'users' }).fn, 'metrics_users');
  assert.equal(validateAnyBody({ metric: 'users.signups' }).fn, 'metrics_explore');
  assert.equal(validateAnyBody({ catalog: true }).fn, 'metrics_explore_catalog');
  for (const b of [{ section: 'users', metric: 'users.signups' }, { section: 'users', catalog: true }, { metric: 'users.signups', catalog: true }]) assert.equal(validateAnyBody(b).ok, false, JSON.stringify(b));
  assert.equal(validateAnyBody({ section: 'users', metric: 'users.signups' }).code, 'invalid_payload');
});

test('F6 · mismo camino de seguridad: JWT → administrador → rate limit → validación → RPC fija; un no-admin no puede sondear el Explorador', async () => {
  for (const body of [{ metric: 'no.existe', filter: { id: 'x', value: 'y' } }, { catalog: true }, { metric: 5 }]) {
    const { d, calls } = deps({ isAdmin: async () => false, body });
    const r = await handleAdminMetrics(d);
    assert.deepEqual([r.status, r.body], [403, { ok: false, code: 'forbidden' }]);
    assert.deepEqual([calls.limit, calls.section], [[], []]);
  }
  const noJwt = deps({ jwt: '', body: { catalog: true } }); assert.equal((await handleAdminMetrics(noJwt.d)).status, 401);
  const lim = deps({ withinRateLimit: async () => false, body: { catalog: true } }); const rl = await handleAdminMetrics(lim.d);
  assert.deepEqual([rl.status, lim.calls.section.length], [429, 0]);
  const ok = deps({ body: { metric: 'matches.created', filter: { id: 'match_status', value: 'validated' } }, callSection: async (fn, args) => { return { data: { ok: true, section: 'explore', fn, args }, error: null }; } });
  const r = await handleAdminMetrics(ok.d);
  assert.equal(r.status, 200); assert.equal(r.body.fn, 'metrics_explore');
});

test('F6 · errores de negocio del SQL (métrica/filtro inválidos) → 400 con código acotado; cualquier otra falla sigue siendo 500 genérico', async () => {
  for (const code of EXPLORE_CLIENT_ERRORS) {
    const { d } = deps({ body: { metric: 'users.signups' }, callSection: async () => ({ data: { ok: false, code }, error: null }) });
    assert.deepEqual([(await handleAdminMetrics(d)).status, (await handleAdminMetrics(d)).body], [400, { ok: false, code }]);
  }
  for (const data of [{ ok: false, code: 'boom_interno' }, { ok: false }, null]) {
    const { d } = deps({ body: { metric: 'users.signups' }, callSection: async () => ({ data, error: null }) });
    assert.deepEqual([(await handleAdminMetrics(d)).status, (await handleAdminMetrics(d)).body], [500, { ok: false, code: 'metrics_failed' }]);
  }
  // un panel (section) nunca se traduce a 400 por ok:false
  const { d } = deps({ callSection: async () => ({ data: { ok: false, code: 'invalid_metric' }, error: null }) });
  assert.equal((await handleAdminMetrics(d)).status, 500);
});

test('F6 · contrato con el SQL real: los args que arma el núcleo calzan con metrics_explore / metrics_explore_catalog y los códigos 400 existen', async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok);
  const db = r.db;
  try {
    await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
    const call = async (body) => { const v = validateAnyBody(body); assert.equal(v.ok, true, JSON.stringify(body)); const names = Object.keys(v.args); 
      const sql = names.length ? `select public.${v.fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r` : `select public.${v.fn}() as r`;
      return (await db.query(sql, names.map((n) => v.args[n]))).rows[0].r; };
    assert.equal((await call({ catalog: true })).catalog.length, 55);
    for (const range of RANGES) assert.equal((await call({ metric: 'matches.created', range })).ok, true, range);
    assert.equal((await call({ metric: 'matches.created', filter: { id: 'match_status', value: 'validated' } })).filters.applied.value, 'validated');
    assert.equal((await call({ metric: 'no.existe' })).code, 'invalid_metric');
    assert.equal((await call({ metric: 'users.signups', filter: { id: 'platform', value: 'ios' } })).code, 'invalid_filter');
    assert.equal((await call({ metric: 'matches.created', filter: { id: 'match_status', value: 'x' } })).code, 'invalid_filter_value');
  } finally { await db.close(); }
});
