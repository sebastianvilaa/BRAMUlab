// BRAMU Metrics V1 · F1 — pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de la presencia diaria.
// Ejecutar con: node --test supabase/functions/_shared/metrics-f1-activity.test.mjs
import crypto from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';

let db;
let dbOpen;
before(async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'el replay limpio debe aplicar todas las migraciones');
  db = r.db;
  // Peor caso de privilegios por defecto: todo objeto nuevo concedido a anon/authenticated.
  const r2 = await replay({ acl: 'open' });
  assert.ok(r2.ok, 'el replay con ACL abierto debe aplicar todas las migraciones');
  dbOpen = r2.db;
});
after(async () => { if (db) await db.close(); if (dbOpen) await dbOpen.close(); });

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const asUser = async (uid) => { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid || '']); };
const scenario = (name, fn) => test(name, async () => {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
});

async function mkUser(key) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [uid, `${key}_${uid.slice(0, 6)}@example.test`]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  return { uid, pid };
}
const record = async (u, mode = 'browser', platform = 'ios', bundle = '04.37-h28') => {
  await asUser(u.uid);
  return (await one(`select public.register_app_presence($1, $2, $3) as r`, [mode, platform, bundle])).r;
};
const rows = (pid) => q(`select * from public.player_activity_days where player_id = $1`, [pid]);

test('privilegios: ni anon ni authenticated tocan la tabla; solo authenticated ejecuta la RPC (ACL observed y open)', async () => {
  for (const [label, d] of [['observed', db], ['open', dbOpen]]) {
    const p = (await d.query(`
      select has_table_privilege('anon', 'public.player_activity_days', 'select') as anon_sel,
             has_table_privilege('authenticated', 'public.player_activity_days', 'select') as auth_sel,
             has_table_privilege('authenticated', 'public.player_activity_days', 'insert') as auth_ins,
             has_table_privilege('authenticated', 'public.player_activity_days', 'update') as auth_upd,
             has_table_privilege('authenticated', 'public.player_activity_days', 'delete') as auth_del,
             has_table_privilege('service_role', 'public.player_activity_days', 'select') as svc_sel,
             has_function_privilege('anon', 'public.register_app_presence(text,text,text)', 'execute') as anon_exec,
             has_function_privilege('authenticated', 'public.register_app_presence(text,text,text)', 'execute') as auth_exec,
             (select relrowsecurity from pg_class where oid = 'public.player_activity_days'::regclass) as rls,
             (select count(*) from pg_policies where tablename = 'player_activity_days') as policies`)).rows[0];
    assert.deepEqual([p.anon_sel, p.auth_sel, p.auth_ins, p.auth_upd, p.auth_del], [false, false, false, false, false], `${label}: tabla sin acceso de cliente`);
    assert.equal(p.svc_sel, true, `${label}: service_role lee`);
    assert.equal(p.anon_exec, false, `${label}: anon no ejecuta la RPC`);
    assert.equal(p.auth_exec, true, `${label}: authenticated ejecuta la RPC`);
    assert.equal(p.rls, true, `${label}: RLS activo`);
    assert.equal(Number(p.policies), 0, `${label}: cero políticas`);
  }
});

scenario('la RPC no recibe jugador ni fecha: su firma son solo modo, plataforma y bundle', async () => {
  const f = await one(`select pg_get_function_arguments(oid) a, prosecdef from pg_proc where proname = 'register_app_presence' and pronamespace = 'public'::regnamespace`);
  assert.equal(f.a, 'p_display_mode text, p_platform text, p_app_bundle text DEFAULT NULL::text');
  assert.equal(f.prosecdef, true);
});

scenario('sin sesión: not_authenticated y no escribe', async () => {
  await asUser('');
  const r = (await one(`select public.register_app_presence('browser', 'ios', null) as r`)).r;
  assert.deepEqual(r, { ok: false, code: 'not_authenticated' });
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days`)).c), 0);
});

scenario('cuenta registrada: una fila con el día BA del servidor; el cliente no manda fecha', async () => {
  const u = await mkUser('a');
  const r = await record(u, 'browser', 'ios', '04.37-h28');
  assert.deepEqual(r, { ok: true, recorded: true });
  const [row] = await rows(u.pid);
  const expectedDay = (await one(`select (now() at time zone 'America/Argentina/Buenos_Aires')::date::text d`)).d;
  assert.equal(String(row.activity_date.toISOString ? row.activity_date.toISOString().slice(0, 10) : row.activity_date).slice(0, 10), expectedDay);
  assert.equal(row.opens, 1);
  assert.equal(row.display_mode, 'browser');
  assert.equal(row.platform, 'ios');
  assert.equal(row.app_bundle, '04.37-h28');
});

scenario('idempotencia por día y anti-ráfaga (5 min): la 2.ª llamada inmediata no escribe; pasados 5 min suma una apertura', async () => {
  const u = await mkUser('b');
  await record(u);
  const again = await record(u);
  assert.deepEqual(again, { ok: true, recorded: false });
  assert.equal((await rows(u.pid)).length, 1);
  assert.equal((await rows(u.pid))[0].opens, 1);
  await q(`update public.player_activity_days set last_seen_at = now() - interval '10 minutes' where player_id = $1`, [u.pid]);
  assert.deepEqual(await record(u), { ok: true, recorded: true });
  const [row] = await rows(u.pid);
  assert.equal(row.opens, 2);
  assert.equal((await rows(u.pid)).length, 1, 'sigue habiendo una sola fila por día');
});

scenario('standalone es pegajoso dentro del día; el bundle nuevo gana; un valor nulo no borra el bundle', async () => {
  const u = await mkUser('c');
  await record(u, 'standalone', 'android', '04.37-h27');
  await q(`update public.player_activity_days set last_seen_at = now() - interval '10 minutes' where player_id = $1`, [u.pid]);
  await record(u, 'browser', 'android', null);
  const [row] = await rows(u.pid);
  assert.equal(row.display_mode, 'standalone');
  assert.equal(row.app_bundle, '04.37-h27');
  await q(`update public.player_activity_days set last_seen_at = now() - interval '10 minutes' where player_id = $1`, [u.pid]);
  await record(u, 'browser', 'android', '04.37-h28');
  assert.equal((await rows(u.pid))[0].app_bundle, '04.37-h28');
});

scenario('entradas fuera de contrato se rechazan sin escribir', async () => {
  const u = await mkUser('d');
  await asUser(u.uid);
  for (const [m, p, b, code] of [
    ['kiosk', 'ios', null, 'invalid_display_mode'], [null, 'ios', null, 'invalid_display_mode'],
    ['browser', 'smart-tv', null, 'invalid_platform'], ['browser', null, null, 'invalid_platform'],
    ['browser', 'ios', '4.37', 'invalid_app_bundle'], ['browser', 'ios', "04.37-h28'; drop table players;--", 'invalid_app_bundle'],
    ['browser', 'ios', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'invalid_app_bundle'],
  ]) {
    const r = (await one(`select public.register_app_presence($1, $2, $3) as r`, [m, p, b])).r;
    assert.deepEqual(r, { ok: false, code });
  }
  assert.equal((await rows(u.pid)).length, 0);
});

scenario('solo cuentas registradas y no eliminadas; un provisional o una cuenta anonimizada no pueden registrar', async () => {
  const u = await mkUser('e');
  await q(`update public.players set deleted_at = now(), is_active = false where player_id = $1`, [u.pid]);
  assert.deepEqual(await record(u), { ok: false, code: 'no_player_for_session' });
  const ghost = crypto.randomUUID(); // sesión sin player
  assert.deepEqual(await record({ uid: ghost }), { ok: false, code: 'no_player_for_session' });
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days`)).c), 0);
});

scenario('aislamiento: cada sesión escribe solo su propia fila', async () => {
  const a = await mkUser('f1'); const b = await mkUser('f2');
  await record(a);
  assert.equal((await rows(b.pid)).length, 0);
  assert.equal((await rows(a.pid)).length, 1);
});

// Cada sentencia denegada aborta la transacción: se ejecuta en su propio savepoint, bajo el rol indicado.
async function deniedAs(role, sql) {
  await db.exec('savepoint sp_role');
  try {
    await db.exec(`set local role ${role}`);
    await assert.rejects(() => db.query(sql), /permission denied/i);
  } finally { await db.exec('rollback to savepoint sp_role'); }
}

scenario('rol authenticated/anon real: no lee ni escribe la tabla; anon no ejecuta la RPC', async () => {
  const a = await mkUser('g');
  await record(a);
  await deniedAs('authenticated', 'select * from public.player_activity_days');
  await deniedAs('authenticated', `insert into public.player_activity_days (player_id, activity_date, display_mode, platform) values ('${a.pid}', current_date - 1, 'browser', 'ios')`);
  await deniedAs('authenticated', 'update public.player_activity_days set opens = 999');
  await deniedAs('authenticated', 'delete from public.player_activity_days');
  await deniedAs('anon', "select public.register_app_presence('browser','ios',null)");
  await deniedAs('anon', 'select * from public.player_activity_days');
  // y un autenticado SÍ puede ejecutar la RPC (por su sesión)
  await db.exec('savepoint sp_ok');
  await db.exec('set local role authenticated');
  const r = (await db.query(`select public.register_app_presence('browser','ios',null) as r`)).rows[0].r;
  assert.equal(r.ok, true);
  await db.exec('rollback to savepoint sp_ok');
});

scenario('el informe de acceso a datos incluye activityDays propios y nada de terceros', async () => {
  const a = await mkUser('h1'); const b = await mkUser('h2');
  await q(`update public.profiles set username = 'h1user', first_name = 'H', last_name = 'Uno' where player_id = $1`, [a.pid]);
  await record(a, 'standalone', 'ios', '04.37-h28');
  await record(b);
  const rep = (await one(`select public.admin_export_player_data($1) as r`, [a.pid])).r;
  assert.equal(rep.ok, true);
  assert.equal(rep.activityDays.length, 1);
  assert.deepEqual(Object.keys(rep.activityDays[0]).sort(), ['appBundle', 'date', 'displayMode', 'firstSeenAt', 'lastSeenAt', 'opens', 'platform']);
  assert.equal(rep.activityDays[0].displayMode, 'standalone');
  assert.ok(!JSON.stringify(rep).includes(b.pid), 'no aparece el id de otro jugador');
});

scenario('eliminar cuenta (anonimiza) ELIMINA su actividad diaria (no se conserva seudonimizada) y no rompe', async () => {
  const a = await mkUser('i');
  await record(a);
  assert.equal((await rows(a.pid)).length, 1);
  await q(`select public.admin_delete_player_account($1)`, [a.pid]);
  assert.equal((await rows(a.pid)).length, 0, 'decisión confirmada: la actividad se elimina con la cuenta');
  assert.equal((await one(`select deleted_at is not null as d from public.players where player_id = $1`, [a.pid])).d, true);
});
