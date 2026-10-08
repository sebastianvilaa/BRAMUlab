// BRAMU Metrics V1 — alta de la ÚNICA cuenta administradora (supabase/scripts/metrics-grant-admin.sql) y PREFLIGHT de Production
// (supabase/tests/preflight-metrics-production.sql), ejecutados sobre el esquema real (PGlite).
// node --test supabase/functions/_shared/metrics-admin-grant.test.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay, adaptMigration, MIGRATIONS_DIR } from '../../scripts/replay-migrations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GRANT = fs.readFileSync(path.join(HERE, '..', '..', 'scripts', 'metrics-grant-admin.sql'), 'utf8');
const PREFLIGHT = fs.readFileSync(path.join(HERE, '..', '..', 'tests', 'preflight-metrics-production.sql'), 'utf8');
let db; let dbM; const U = {}; const UM = {};
const qq = (d) => async (sql, p = []) => (await d.query(sql, p)).rows;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await q(sql, p))[0];

async function acct(key, username, { confirmed = true } = {}, d = db, U_ = U) {
  const q = qq(d); const one = async (sql, p = []) => (await q(sql, p))[0];
  const u = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [u, `${key}_${u.slice(0, 5)}@example.test`, confirmed ? '2026-10-01T12:00:00Z' : null]);
  const pl = await one(`select player_id from public.players where auth_user_id = $1`, [u]);
  if (pl && username) await q(`update public.profiles set username = $2 where player_id = $1`, [pl.player_id, username]);
  U_[key] = { uid: u, pid: pl && pl.player_id };
}
/** ejecuta el SQL del script dentro de una transacción que SIEMPRE se revierte; devuelve {error?, admins} */
async function run(sql) {
  await dbM.exec('begin');
  try { await dbM.exec(sql); return { admins: await qq(dbM)(`select auth_user_id, label, revoked_at from public.metrics_admins`) }; }
  catch (e) { return { error: String(e.message || e) }; } finally { await dbM.exec('rollback'); }
}
const statements = (sql) => sql.split(/;\s*\n/).map((x) => x.replace(/^(\s*--.*\n)+/gm, '').trim()).filter(Boolean);

before(async () => {
  // base tipo Production SIN Metrics + el registro de migraciones de Supabase (simulado: el motor local no lo trae)
  const r = await replay({ acl: 'observed', exclude: ['20261008'] }); assert.ok(r.ok); db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'production')`);
  await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text)`);
  for (const f of r.files) await q(`insert into supabase_migrations.schema_migrations (version, name) values ($1, $2)`, [f.slice(0, 14), f.replace(/^\d{14}_/, '').replace(/\.sql$/, '')]);
  await acct('seba', 'seba'); await acct('seba_qa', 'seba_qa'); await acct('seba2', 'seba2'); await acct('otro', 'otro');
  await acct('sinconfirmar', null, { confirmed: false });
  // segunda base: la misma con Metrics INSTALADO, para probar el alta del administrador
  dbM = (await replay({ acl: 'observed' })).db;
  await dbM.exec(`insert into public.app_config (id, environment) values (1, 'production')`);
  await acct('seba', 'seba', {}, dbM, UM); await acct('seba_qa', 'seba_qa', {}, dbM, UM); await acct('seba2', 'seba2', {}, dbM, UM); await acct('otro', 'otro', {}, dbM, UM);
  await acct('sinconfirmar', null, { confirmed: false }, dbM, UM);
});
after(async () => { for (const d of [db, dbM]) if (d) await d.close(); });

test('PREFLIGHT sobre una base tipo Production SIN Metrics: todas las verificaciones dan ok y la línea base se imprime sin identidades', async () => {
  const res = []; for (const st of statements(PREFLIGHT)) res.push((await db.query(st)).rows);
  assert.equal(res.length, 6);
  assert.deepEqual([res[0][0].ok, res[0][0].has_last_pre_metrics, Number(res[0][0].metrics_migrations_applied)], [true, true, 0], 'P1');
  assert.deepEqual([res[1][0].ok, Number(res[1][0].metrics_functions), Number(res[1][0].metrics_tables), Number(res[1][0].presence_function)], [true, 0, 0, 0], 'P2');
  assert.deepEqual([res[2][0].ok, res[2][0].environment], [true, 'production'], 'P3');
  assert.deepEqual([res[3][0].ok, Number(res[3][0].candidates)], [true, 1], 'P4: una sola candidata @seba (no se confunde con @seba_qa ni @seba2)');
  assert.ok(Object.keys(res[4][0]).every((k) => Number.isFinite(Number(res[4][0][k]))) && Number(res[4][0].accounts) === 4, 'P5 línea base numérica');
  assert.ok(Number.isFinite(Number(res[5][0].security_definer_executable_by_clients)), 'P6');
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(JSON.stringify(res)), 'sin UUID/identidades');
});

test('el preflight es de SOLO LECTURA (ninguna sentencia escribe)', async () => {
  assert.ok(!/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/i.test(PREFLIGHT.replace(/--.*$/gm, '')), 'sin DML/DDL');
});

test('el preflight DETECTA: Metrics ya instalado, migración previa faltante, entorno equivocado y cuenta candidata ausente o duplicada', async () => {
  const run1 = async (i) => (await db.query(statements(PREFLIGHT)[i])).rows;
  await db.exec('begin');
  try {
    await db.exec(`update public.app_config set environment = 'staging'`);
    assert.equal((await run1(2))[0].ok, false, 'P3: entorno distinto de production');
    await db.exec(`delete from supabase_migrations.schema_migrations where name like '%v0437_level_evolution'`);
    assert.equal((await run1(0))[0].ok, false, 'P1: falta la última migración previa');
    await db.exec(`insert into supabase_migrations.schema_migrations (version, name) values ('90000000000001', 'v0437_level_evolution'), ('90000000000002', 'metrics_f1_player_activity')`);
    const p1 = (await run1(0))[0]; assert.deepEqual([p1.ok, Number(p1.metrics_migrations_applied)], [false, 1], 'P1: ya hay migraciones de Metrics');
  } finally { await db.exec('rollback'); }
  await db.exec('begin');
  try {
    await q(`update public.profiles set username = null where player_id = $1`, [U.seba.pid]);
    assert.deepEqual([(await run1(3))[0].ok, Number((await run1(3))[0].candidates)], [false, 0], 'P4: sin candidata');
    await q(`update public.profiles set username = 'seba' where player_id = $1`, [U.seba.pid]);
    // la base impide dos cuentas con el mismo @usuario (único por minúsculas): no puede haber dos candidatas
    await db.exec('savepoint dup');
    await assert.rejects(() => db.exec(`update public.profiles set username = 'seba' where player_id = '${U.seba2.pid}'`), /unique|duplicate/i);
    await db.exec('rollback to savepoint dup');
  } finally { await db.exec('rollback'); }
  // instalar Metrics (P2 debe detectarlo)
  for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((x) => x.startsWith('20261008')).sort()) await db.exec(adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')));
  const p2 = (await run1(1))[0]; assert.equal(p2.ok, false, 'P2: Metrics ya instalado'); assert.ok(Number(p2.metrics_functions) > 30);
});

const oneM = async (sql, p = []) => (await qq(dbM)(sql, p))[0];
test('ALTA: inserta SOLO la cuenta @seba (no @seba_qa, @seba2 ni otra), con su UUID de Auth, y queda como único administrador', async () => {
  const r = await run(GRANT);
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.admins.length, 1);
  assert.equal(r.admins[0].auth_user_id, UM.seba.uid); assert.equal(r.admins[0].revoked_at, null);
  assert.equal(r.admins[0].label, 'Sebastián (@seba, Production)');
});

test('ALTA: tras darla, SOLO esa cuenta es administradora; las demás (incluida @seba_qa) no; y un segundo alta falla sin insertar', async () => {
  await dbM.exec('begin');
  try {
    await dbM.exec(GRANT);
    assert.equal((await oneM(`select public.metrics_is_admin($1) r`, [UM.seba.uid])).r, true);
    for (const k of ['seba_qa', 'seba2', 'otro', 'sinconfirmar']) assert.equal((await oneM(`select public.metrics_is_admin($1) r`, [UM[k].uid])).r, false, k);
    await dbM.exec('savepoint again');
    await assert.rejects(() => dbM.exec(GRANT), /metrics_admin_already_granted/);
    await dbM.exec('rollback to savepoint again');
    assert.equal(Number((await oneM(`select count(*) c from public.metrics_admins`)).c), 1);
  } finally { await dbM.exec('rollback'); }
});

test('ALTA: aborta SIN insertar si la cuenta no existe, está eliminada, sin email confirmado, es provisional o hay dos con ese @usuario', async () => {
  const cases = [
    ['no existe', async () => { await qq(dbM)(`update public.profiles set username = 'otro_nombre' where player_id = $1`, [UM.seba.pid]); }],
    ['eliminada', async () => { await qq(dbM)(`select public.admin_delete_player_account($1)`, [UM.seba.pid]); }],
    ['sin email confirmado', async () => { await qq(dbM)(`update auth.users set email_confirmed_at = null where id = $1`, [UM.seba.uid]); }],
    ['inactiva', async () => { await qq(dbM)(`update public.players set is_active = false where player_id = $1`, [UM.seba.pid]); }],
    ['sin vínculo a Auth', async () => { await qq(dbM)(`update public.players set auth_user_id = null where player_id = $1`, [UM.seba.pid]); }],
  ];
  for (const [name, setup] of cases) {
    await dbM.exec('begin');
    try {
      await setup();
      await dbM.exec('savepoint s');
      await assert.rejects(() => dbM.exec(GRANT), /metrics_admin_account_not_unique/, name);
      await dbM.exec('rollback to savepoint s');
      assert.equal(Number((await oneM(`select count(*) c from public.metrics_admins`)).c), 0, `${name}: no se insertó nada`);
    } finally { await dbM.exec('rollback'); }
  }
});

test('el script de alta no contiene UUIDs ni emails, usa el @usuario solo para resolver el UUID una vez, y exige explícitamente «una sola cuenta»', async () => {
  const code = GRANT.replace(/--.*$/gm, '');
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(GRANT) && !/@[a-z0-9-]+\.[a-z]{2,}/i.test(GRANT.replace(/@seba[a-z_]*/g, '')), 'sin UUID ni emails');
  assert.match(code, /v_username constant text := 'seba'/);
  assert.match(code, /metrics_admin_already_granted/); assert.match(code, /<> 1/);
  // el runtime NO usa el @usuario: la Edge y el SQL de autorización solo conocen el UUID
  const core = fs.readFileSync(path.join(HERE, 'admin-metrics-core.mjs'), 'utf8'); const edge = fs.readFileSync(path.join(HERE, '..', 'admin-metrics', 'index.ts'), 'utf8');
  assert.ok(!/username|email|metadata/i.test(core.replace(/\/\/.*$/gm, '')) && !/username|\.email|user_metadata/i.test(edge.replace(/\/\/.*$/gm, '')));
});
