// BRAMUlab — V04.40 · Ronda 2: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de `get_player_discovery`.
// Ejecutar con: node --test supabase/functions/_shared/v0440-descubrimiento.test.mjs
import path from 'node:path';
import crypto from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { makePgliteAdminClient } from '../../scripts/pglite-admin-client.mjs';

let db; let svc;
before(async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'el replay limpio debe aplicar todas las migraciones');
  db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
  svc = makePgliteAdminClient(db);
});
after(async () => { if (db) await db.close(); });

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const asUser = async (authUserId) => { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [authUserId]); };
const discover = async (u, limit) => {
  await asUser(u.uid);
  return limit === undefined ? q(`select * from public.get_player_discovery()`) : q(`select * from public.get_player_discovery($1)`, [limit]);
};
const scenario = (name, fn) => test(name, async () => {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
});

async function mkUser(key) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"legal_version":"legal_v1"}'::jsonb)`,
    [uid, `${key.toLowerCase()}_${uid.slice(0, 6)}@example.test`]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set display_name = $2 where player_id = $1`, [pid, key]);
  await q(`update public.profiles set username = $2, first_name = $3, last_name = 'Test', display_name = $3 where player_id = $1`,
    [pid, `u_${key.toLowerCase()}_${uid.slice(0, 5)}`, key]);
  return { uid, pid, key };
}
const SETS = [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }];
/** Crea un partido real (create_or_attach_match) entre [a1,a2] y [b1,b2] y lo deja en el estado pedido. */
async function match(author, ids, state = 'validated') {
  const r = await svc.rpc('create_or_attach_match', {
    p_auth_user_id: author.uid, p_idempotency_key: crypto.randomUUID(),
    p_pair1_player_id_1: ids[0].pid, p_pair1_player_id_2: ids[1].pid, p_pair2_player_id_1: ids[2].pid, p_pair2_player_id_2: ids[3].pid,
    p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic', p_sets: SETS,
  });
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  if (state === 'validated') await q(`update public.matches set status = 'validated', validated_at = now(), action_side = null where match_id = $1`, [r.data.matchId]);
  else if (state === 'expired') await q(`update public.matches set status = 'expired', action_side = null where match_id = $1`, [r.data.matchId]);
  else if (state === 'annulled') await q(`update public.matches set status = 'annulled', annulled_at = now(), action_side = null where match_id = $1`, [r.data.matchId]);
  return r.data.matchId;
}
async function mkLocation(label) {
  return (await one(
    `insert into public.locations (source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
     values ('georef', $2, $3, 'Santa Fe', $1, $1 || ', Santa Fe', true) returning location_id`,
    [label, `p_${crypto.randomUUID().slice(0, 6)}`, `l_${crypto.randomUUID().slice(0, 8)}`])).location_id;
}
const setLoc = (u, loc) => q(`update public.profiles set location_id = $2 where player_id = $1`, [u.pid, loc]);
const ids = (rows, section) => rows.filter((r) => r.section === section).map((r) => r.player_id);

/** yo(me)+j vs r1+r2 (oficial); j+p vs x1+x2 (oficial): P, X1, X2 son conexiones INDIRECTAS de `me`. */
async function world() {
  const [me, j, r1, r2, p, x1, x2] = [await mkUser('Yo'), await mkUser('Juan'), await mkUser('RivalUno'), await mkUser('RivalDos'), await mkUser('Pedro'), await mkUser('Equis1'), await mkUser('Equis2')];
  await match(me, [me, j, r1, r2]);
  await match(j, [j, p, x1, x2]);
  return { me, j, r1, r2, p, x1, x2 };
}

scenario('1) usuario sin partidos ni localidad: 0 filas, sin error', async () => {
  const lonely = await mkUser('Solo');
  assert.deepEqual(await discover(lonely), []);
});

scenario('2) conexión indirecta REAL: aparecen Pedro y los rivales de Juan; NO aparecen los directos (Juan, rivales de mi partido) ni yo', async () => {
  const w = await world();
  const rows = await discover(w.me);
  const conn = ids(rows, 'connections');
  assert.deepEqual([...conn].sort(), [w.p.pid, w.x1.pid, w.x2.pid].sort());
  for (const d of [w.j, w.r1, w.r2, w.me]) assert.ok(!conn.includes(d.pid), `${d.key} es directo o soy yo`);
  assert.deepEqual(ids(rows, 'zone'), []);
});

scenario('3) no se revela nada del partido: columnas EXACTAS y solo campos deportivos autorizados', async () => {
  const w = await world();
  const rows = await discover(w.me);
  assert.ok(rows.length >= 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['avatar_url', 'display_name', 'first_name', 'last_name', 'level_public', 'level_status', 'player_id', 'section', 'username']);
  const asText = JSON.stringify(rows);
  assert.ok(!asText.includes(w.j.pid), 'el intermediario nunca se devuelve');
});

scenario('4) conexiones inexistentes: partidos pendientes, vencidos o anulados NO generan sugerencias; un slot sin identidad tampoco', async () => {
  const [me, j, r1, r2] = [await mkUser('Yo'), await mkUser('Juan'), await mkUser('R1'), await mkUser('R2')];
  await match(me, [me, j, r1, r2]);
  const [pend, exp, ann, unk] = [await mkUser('Pendiente'), await mkUser('Vencido'), await mkUser('Anulado'), await mkUser('SinId')];
  const filler = async (k) => [await mkUser(`${k}a`), await mkUser(`${k}b`)];
  await match(j, [j, pend, ...(await filler('f1'))], 'pending_validation');
  await match(j, [j, exp, ...(await filler('f2'))], 'expired');
  await match(j, [j, ann, ...(await filler('f3'))], 'annulled');
  const m4 = await match(j, [j, unk, ...(await filler('f4'))]);
  await q(`update public.match_participants set player_id = null where match_id = $1 and player_id = $2`, [m4, unk.pid]);
  // Solo quedan los rivales REALES del partido oficial de Juan (f4a/f4b): ni pendiente, vencido, anulado ni el slot sin identidad.
  const found = (await discover(me)).map((r) => r.display_name).sort();
  assert.deepEqual(found, ['f4a', 'f4b']);
  // Y un partido pendiente MÍO tampoco me conecta con nadie.
  const [me2, k1, k2, k3] = [await mkUser('Yo2'), await mkUser('K1'), await mkUser('K2'), await mkUser('K3')];
  await match(me2, [me2, k1, k2, k3], 'pending_validation');
  assert.deepEqual(await discover(me2), []);
});

scenario('5) exclusiones: provisionales, eliminados/inactivos, sin username (cuenta incompleta) y ya guardados NO se sugieren', async () => {
  const w = await world();
  // x1 -> inactivo/eliminado; x2 -> sin username; p -> guardado.
  await q(`update public.players set is_active = false where player_id = $1`, [w.x1.pid]);
  await q(`update public.profiles set username = null where player_id = $1`, [w.x2.pid]);
  await q(`insert into public.player_saved_players (owner_player_id, saved_player_id) values ($1, $2)`, [w.me.pid, w.p.pid]);
  assert.deepEqual(await discover(w.me), []);
  // provisional
  await q(`update public.players set is_active = true where player_id = $1`, [w.x1.pid]);
  await q(`update public.profiles set username = 'u_restored_x2' where player_id = $1`, [w.x2.pid]);
  await q(`delete from public.player_saved_players where owner_player_id = $1`, [w.me.pid]);
  const prov = await one(`insert into public.players (type, display_name) values ('provisional', 'Invitado') returning player_id`);
  const m = await one(`select match_id from public.match_participants where player_id = $1 limit 1`, [w.x1.pid]);
  await q(`update public.match_participants set player_id = $1 where match_id = $2 and player_id = $3`, [prov.player_id, m.match_id, w.x1.pid]);
  const conn = ids(await discover(w.me), 'connections');
  assert.ok(!conn.includes(prov.player_id), 'un provisional nunca se sugiere');
  assert.ok(conn.includes(w.p.pid) && conn.includes(w.x2.pid));
});

scenario('6) ZONA: misma localidad canónica; excluye otra localidad, sin localidad, inactivos, sin username, guardados y a mí; no amplía la zona', async () => {
  const [me, a, b, other, inactive, nouser, saved, noloc] = await Promise.all(['Yo', 'ZonaA', 'ZonaB', 'Otra', 'Inactivo', 'SinUser', 'Guardado', 'SinLoc'].map(mkUser));
  const [home, away] = [await mkLocation('Rosario'), await mkLocation('Santa Fe Capital')];
  for (const u of [me, a, b, inactive, nouser, saved]) await setLoc(u, home);
  await setLoc(other, away);
  await q(`update public.players set is_active = false where player_id = $1`, [inactive.pid]);
  await q(`update public.profiles set username = null where player_id = $1`, [nouser.pid]);
  await q(`insert into public.player_saved_players (owner_player_id, saved_player_id) values ($1, $2)`, [me.pid, saved.pid]);
  const rows = await discover(me);
  assert.deepEqual([...ids(rows, 'zone')].sort(), [a.pid, b.pid].sort());
  assert.deepEqual(ids(rows, 'connections'), []);
  // localidad desactivada -> sin zona
  await q(`update public.locations set is_active = false where location_id = $1`, [home]);
  assert.deepEqual(await discover(me), []);
  // sin localidad propia -> nunca se "completa" la zona con otras
  assert.deepEqual(await discover(noloc), []);
});

scenario('7) mismo candidato por conexión y por localidad: aparece UNA sola vez (en conexiones) y respeta el límite por sección', async () => {
  const w = await world();
  const home = await mkLocation('Rosario');
  const extra = await Promise.all(['Z1', 'Z2', 'Z3'].map(mkUser));
  for (const u of [w.me, w.p, w.x1, ...extra]) await setLoc(u, home);
  const rows = await discover(w.me);
  const all = rows.map((r) => r.player_id);
  assert.equal(new Set(all).size, all.length, 'sin duplicados entre secciones');
  assert.ok(ids(rows, 'connections').includes(w.p.pid) && !ids(rows, 'zone').includes(w.p.pid));
  assert.deepEqual([...ids(rows, 'zone')].sort(), extra.map((u) => u.pid).sort());
  const limited = await discover(w.me, 1);
  assert.equal(ids(limited, 'connections').length, 1);
  assert.equal(ids(limited, 'zone').length, 1);
});

scenario('8) orden determinista: más conexiones en común primero; misma lista en cada llamada; el límite se acota a 1..8', async () => {
  const [me, j, k, r1, r2, r3, r4] = await Promise.all(['Yo', 'Juan', 'Karina', 'R1', 'R2', 'R3', 'R4'].map(mkUser));
  const [many, few] = [await mkUser('Zzmuchos'), await mkUser('Aapocos')]; // alfabéticamente al revés a propósito
  const [f1, f2, f3, f4] = await Promise.all(['F1', 'F2', 'F3', 'F4'].map(mkUser));
  await match(me, [me, j, r1, r2]);
  await match(me, [me, k, r3, r4]);
  await match(j, [j, many, f1, f2]);      // many: Juan
  await match(k, [k, many, f3, f4]);      // many: Karina  -> 2 en común
  await match(j, [j, few, await mkUser('G1'), await mkUser('G2')]); // few: solo Juan
  const rows = await discover(me);
  const conn = ids(rows, 'connections');
  assert.ok(conn.indexOf(many.pid) < conn.indexOf(few.pid), 'más conexiones en común primero (aunque su @usuario sea posterior)');
  assert.deepEqual(await discover(me), rows, 'determinista');
  const clamped = await discover(me, 1000);
  assert.ok(ids(clamped, 'connections').length <= 8 && ids(clamped, 'zone').length <= 8);
  assert.equal(ids(await discover(me, 0), 'connections').length, 1);
  assert.equal(ids(await discover(me, null), 'connections').length <= 5, true);
});

scenario('9) sin sesión de jugador: no_player_for_session; el rate limit corta la ráfaga (anti-enumeración)', async () => {
  const failing = async (re) => {
    await db.exec('savepoint s1');
    try { await assert.rejects(() => q(`select * from public.get_player_discovery()`), re); } finally { await db.exec('rollback to savepoint s1'); }
  };
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [crypto.randomUUID()]);
  await failing(/no_player_for_session/);
  const u = await mkUser('Rafaga');
  await asUser(u.uid);
  for (let i = 0; i < 20; i++) await q(`select * from public.get_player_discovery()`);
  await failing(/rate_limited/);
});

test('10) permisos: solo authenticated ejecuta (ni anon ni PUBLIC); SECURITY DEFINER con search_path fijo; sin tablas sociales nuevas', async () => {
  const priv = async (role) => (await one(`select has_function_privilege($1, 'public.get_player_discovery(integer)', 'execute') as ok`, [role])).ok;
  assert.equal(await priv('authenticated'), true);
  assert.equal(await priv('anon'), false);
  const fn = await one(`select prosecdef, proconfig from pg_proc where proname = 'get_player_discovery'`);
  assert.equal(fn.prosecdef, true);
  assert.ok(fn.proconfig.some((c) => /search_path=public/.test(c)));
  const tables = (await q(`select table_name from information_schema.tables where table_schema = 'public'`)).map((r) => r.table_name);
  for (const t of tables) assert.ok(!/follow|friend|connection|suggest|discover/i.test(t), `tabla social inesperada: ${t}`);
});
