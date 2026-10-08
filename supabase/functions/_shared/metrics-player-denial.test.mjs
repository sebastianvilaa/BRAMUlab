// BRAMU Metrics V1 — DENEGACIÓN a jugadores comunes (y a cualquiera que no sea la administradora autorizada), con la base REAL (PGlite) y el núcleo
// REAL de la Edge. A diferencia de pruebas anteriores, la autorización del Edge acá NO se simula: `isAdmin` ejecuta `metrics_is_admin` en el SQL real
// con el rol `service_role`, igual que la Edge Function desplegada.
// node --test supabase/functions/_shared/metrics-player-denial.test.mjs
import crypto from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { handleAdminMetrics } from './admin-metrics-core.mjs';

let db; const U = {}; const P = {};
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

async function mk(key) {
  const u = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, '2026-10-01T12:00:00Z')`, [u, `${key}_${u.slice(0, 5)}@example.test`]);
  P[key] = (await one(`select player_id from public.players where auth_user_id = $1`, [u])).player_id; U[key] = u;
}

before(async () => {
  const r = await replay({ acl: 'observed' }); assert.ok(r.ok); db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
  for (const k of ['common', 'common2', 'admin', 'revoked', 'ghost']) await mk(k);
  await q(`insert into public.metrics_admins (auth_user_id, label) values ($1, 'Admin (test)')`, [U.admin]);
  await q(`insert into public.metrics_admins (auth_user_id, label, revoked_at) values ($1, 'Revocada (test)', now())`, [U.revoked]);
});
after(async () => { if (db) await db.close(); });

/** Ejecuta una sentencia con un rol de plataforma real y, opcionalmente, la sesión (JWT sub) de una cuenta. Siempre revierte. */
async function as(role, uid, sql, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    if (uid) await q(`select set_config('request.jwt.claim.sub', $1, true)`, [uid]);
    return { rows: (await db.query(sql, params)).rows };
  } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec('rollback'); }
}
const IDENTITIES = () => [['anon', 'anon', null], ['jugador común', 'authenticated', U.common], ['administradora (por PostgREST)', 'authenticated', U.admin], ['administradora revocada', 'authenticated', U.revoked]];

test('MATRIZ de funciones: NINGUNA función de métricas es ejecutable por anon ni authenticated (ni por la propia administradora vía PostgREST)', async () => {
  const fns = await q(`select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) a from pg_proc p where p.pronamespace = 'public'::regnamespace
                         and (p.proname like 'metrics\\_%' or p.proname like '\\_metrics\\_%')`);
  assert.ok(fns.length >= 30, `hay ${fns.length} funciones de métricas`);
  for (const f of fns) for (const role of ['anon', 'authenticated']) assert.equal((await one(`select has_function_privilege($1, $2::oid, 'execute') x`, [role, f.oid])).x, false, `${role}/${f.proname}(${f.a})`);
  // ejecución REAL de las funciones públicas con cada identidad
  const calls = [`select public.metrics_overview('30d')`, `select public.metrics_users('30d')`, `select public.metrics_matches('30d')`, `select public.metrics_activation('30d')`, `select public.metrics_community('30d')`,
    `select public.metrics_usage('30d')`, `select public.metrics_explore('users.signups')`, `select public.metrics_explore('matches.created','30d',true,false,'match_status','validated')`, `select public.metrics_explore_catalog()`,
    `select public.metrics_is_admin('${U.admin}')`, `select public._metrics_catalog()`, `select public._metrics_explore_cells('users.signups','location', now(), now(), now(), false)`];
  for (const [label, role, uid] of IDENTITIES()) for (const sql of calls) {
    const r = await as(role, uid, sql);
    assert.match(r.error || 'EJECUTÓ', /permission denied/i, `${label}: ${sql}`);
  }
});

test('MATRIZ de tablas: ningún jugador (ni la administradora vía PostgREST) lee ni escribe metrics_admins, metrics_internal_players ni player_activity_days', async () => {
  for (const t of ['metrics_admins', 'metrics_internal_players', 'player_activity_days']) {
    for (const [label, role, uid] of IDENTITIES()) {
      for (const sql of [`select * from public.${t}`, `select count(*) from public.${t}`, `delete from public.${t}`, `update public.${t} set ${t === 'metrics_admins' ? 'label' : t === 'metrics_internal_players' ? 'reason' : 'platform'} = 'x'`]) {
        const r = await as(role, uid, sql);
        assert.match(r.error || 'EJECUTÓ', /permission denied/i, `${label}: ${sql}`);
      }
    }
  }
  // auto-promoción: una cuenta común no puede darse de alta como administradora
  for (const [label, role, uid] of IDENTITIES()) {
    const r = await as(role, uid, `insert into public.metrics_admins (auth_user_id, label) values ('${U.common}', 'yo')`);
    assert.match(r.error || 'EJECUTÓ', /permission denied/i, label);
  }
  assert.equal(Number((await one(`select count(*) c from public.metrics_admins where revoked_at is null`)).c), 1, 'sigue habiendo UN solo administrador');
});

test('un jugador común SÍ puede registrar su propia presencia, pero NO leerla, NO escribir la de otro y NO elegir jugador ni fecha', async () => {
  const sig = (await one(`select pg_get_function_arguments(oid) a from pg_proc where proname = 'register_app_presence'`)).a;
  assert.ok(!/player|date|uid|user/i.test(sig), `la RPC no recibe jugador ni fecha: ${sig}`);
  await db.exec('begin');
  try {
    await db.exec('set local role authenticated');
    await q(`select set_config('request.jwt.claim.sub', $1, true)`, [U.common]);
    const r = (await one(`select public.register_app_presence('browser', 'ios', '04.37-h31') r`)).r;
    assert.deepEqual([r.ok, r.recorded], [true, true]);
    await assert.rejects(() => db.query('select * from public.player_activity_days'), /permission denied/i);
  } finally { await db.exec('rollback'); }
});

// ---- Edge real (núcleo) + autorización REAL en SQL (service_role) ----
const TOKENS = { 'tok-common': () => U.common, 'tok-common2': () => U.common2, 'tok-admin': () => U.admin, 'tok-revoked': () => U.revoked, 'tok-ghost': () => U.ghost, 'tok-unknown': () => crypto.randomUUID() };
const edge = (token, body) => handleAdminMetrics({
  jwt: token, body,
  getUser: async (j) => (TOKENS[j] ? { id: TOKENS[j]() } : null),
  isAdmin: async (id) => {
    await db.exec('begin');
    try { await db.exec('set local role service_role'); return (await one(`select public.metrics_is_admin($1) r`, [id])).r === true; } finally { await db.exec('rollback'); }
  },
  withinRateLimit: async () => true,
  callSection: async (fn, args) => {
    const names = Object.keys(args);
    await db.exec('begin');
    try {
      await db.exec('set local role service_role');
      const sql = names.length ? `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r` : `select public.${fn}() as r`;
      return { data: (await one(sql, names.map((n) => args[n]))).r, error: null };
    } finally { await db.exec('rollback'); }
  },
});
const BODIES = [{ catalog: true }, { section: 'overview' }, { section: 'users', range: '90d' }, { metric: 'users.signups' }, { metric: 'matches.created', filter: { id: 'match_status', value: 'validated' } },
  { metric: 'no.existe' }, { section: 'users', range: 'custom' }, { foo: 1 }, null];

test('Edge real + autorización SQL real: un jugador común recibe 403 IDÉNTICO en TODOS los modos (catálogo, secciones, Explorador y cuerpos inválidos), sin números ni datos', async () => {
  const outs = new Set();
  for (const token of ['tok-common', 'tok-common2']) for (const b of BODIES) {
    const r = await edge(token, b);
    assert.equal(r.status, 403, JSON.stringify(b));
    assert.deepEqual(r.body, { ok: false, code: 'forbidden' });
    outs.add(JSON.stringify(r));
  }
  assert.equal(outs.size, 1, 'respuesta única: no se puede sondear qué existe');
});

test('Edge real: administradora revocada, cuenta inexistente, token inválido y cuenta sin fila → 403/401; la administradora vigente → 200 en los 3 modos', async () => {
  for (const b of BODIES.slice(0, 5)) {
    assert.equal((await edge('tok-revoked', b)).status, 403, 'revocada');
    assert.equal((await edge('tok-ghost', b)).status, 403, 'cuenta sin fila de administradora');
    assert.equal((await edge('tok-unknown', b)).status, 403, 'usuario autenticado que no existe en la lista');
    assert.equal((await edge('tok-basura', b)).status, 401, 'token inválido');
    assert.equal((await edge('', b)).status, 401, 'sin token');
  }
  for (const b of BODIES.slice(0, 5)) { const r = await edge('tok-admin', b); assert.equal(r.status, 200, JSON.stringify(b)); assert.equal(r.body.ok, true); }
  assert.equal((await edge('tok-admin', { metric: 'no.existe' })).status, 400, 'la administradora sí ve los errores de negocio');
  const txt = JSON.stringify((await edge('tok-admin', { section: 'users', range: '90d' })).body);
  assert.ok(!txt.includes(U.common) && !txt.includes(U.admin) && !txt.includes(P.common), 'ni siquiera a la administradora se le devuelven ids de cuentas');
});

test('la autorización cae sola con el usuario de Auth: al eliminarse la cuenta de la administradora (cascade) deja de ser administradora; la baja inmediata también', async () => {
  assert.equal((await edge('tok-admin', { catalog: true })).status, 200);
  await q(`update public.metrics_admins set revoked_at = now() where auth_user_id = $1`, [U.admin]);
  assert.equal((await edge('tok-admin', { catalog: true })).status, 403, 'baja inmediata');
  await q(`update public.metrics_admins set revoked_at = null where auth_user_id = $1`, [U.admin]);
  assert.equal((await edge('tok-admin', { catalog: true })).status, 200, 'reversible');
  await q(`delete from auth.users where id = $1`, [U.admin]);
  assert.equal(Number((await one(`select count(*) c from public.metrics_admins where auth_user_id = $1`, [U.admin])).c), 0, 'cascade');
  assert.equal((await edge('tok-admin', { catalog: true })).status, 403, 'sin el usuario de Auth no hay acceso');
});
