// BRAMU Metrics V1 — VERIFICACIÓN DE ANONIMIZACIÓN al eliminar una cuenta (decisión confirmada de Sebastián, 08/10/2026):
//   «Los datos históricos de actividad pueden conservarse únicamente si quedan realmente anonimizados y no permiten identificar al jugador.
//    Si no se puede garantizar, deben eliminarse.»
// node --test supabase/functions/_shared/metrics-deletion-anonymization.test.mjs
//
// FASE A (evidencia, SIN la migración de borrado): la fila de actividad de una cuenta eliminada sigue unida por `player_id` a partidos, Ranking
//   (localidad, banda de Nivel, rama) y grupos del MISMO jugador → está seudonimizada, NO anonimizada: no se puede garantizar el anonimato.
// FASE B (CON la migración 20261008140000): la actividad se elimina con la cuenta; ningún objeto de Metrics conserva rastro del jugador; las
//   demás cuentas no cambian; la purga única limpia lo que ya hubiera; el retiro por niveles no rompe la eliminación de cuentas.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay, adaptMigration, MIGRATIONS_DIR } from '../../scripts/replay-migrations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ERASURE = '20261008140000_metrics_presence_erased_on_account_deletion.sql';
const ROLLBACK = fs.readFileSync(path.join(HERE, '..', '..', 'scripts', 'metrics-rollback.sql'), 'utf8');
const ASOF = '2026-10-12T15:00:00Z';
let A; let B; // A = base SIN borrado de actividad; B = base CON borrado

function level(n) {
  const start = ROLLBACK.indexOf(`-- NIVEL ${n} —`); const next = ROLLBACK.indexOf('-- NIVEL', start + 10);
  return ROLLBACK.slice(start, next < 0 ? undefined : next).split('\n').filter((l) => l === '-->' || l.startsWith('--> ')).map((l) => (l === '-->' ? '' : l.slice(4))).join('\n');
}
const mk = (db) => ({ q: async (sql, p = []) => (await db.query(sql, p)).rows, one: async (sql, p = []) => (await db.query(sql, p)).rows[0] });

async function seed(db) {
  const { q, one } = mk(db); const ids = {}; const uid = {};
  const acct = async (key, at) => {
    const u = crypto.randomUUID();
    await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [u, `${key}_${u.slice(0, 5)}@example.test`, at]);
    const p = (await one(`select player_id from public.players where auth_user_id = $1`, [u])).player_id;
    await q(`update public.players set created_at = $2, display_name = $3 where player_id = $1`, [p, at, `Nombre ${key}`]);
    await q(`update public.profiles set username = $2, first_name = $3, competitive_branch = 'M' where player_id = $1`, [p, `user_${key}`, `Nombre${key}`]);
    ids[key] = p; uid[key] = u; return p;
  };
  const x = await acct('x', '2026-09-20T12:00:00Z'); const y = await acct('y', '2026-09-20T13:00:00Z'); const z = await acct('z', '2026-09-20T14:00:00Z'); const w = await acct('w', '2026-09-20T15:00:00Z');
  await q(`insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
           values ('AR','georef','06','0600','Buenos Aires','Bella Vista','Bella Vista, Buenos Aires',true)`);
  const loc = (await one(`select location_id from public.locations limit 1`)).location_id;
  await q(`update public.profiles set location_id = $1 where player_id = any($2::uuid[])`, [loc, [x, y]]);
  const m = (await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, created_at, validated_at)
    values ($1, 'fp-anon', 'classic', '2026-10-03T20:00:00Z', '2026-12-01', 'validated', '2026-10-03T20:00:00Z', '2026-10-03T21:00:00Z') returning match_id`, [x])).match_id;
  for (const [t, pos, p] of [['A', 1, x], ['A', 2, y], ['B', 1, z], ['B', 2, w]]) await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`, [m, t, pos, p, `Snap ${t}${pos}`]);
  const g = (await one(`insert into public.groups (name, created_by_player_id, status) values ('Grupo anon', $1, 'active') returning group_id`, [y])).group_id;
  for (const p of [y, x, z]) await q(`insert into public.group_memberships (group_id, player_id, is_admin, joined_at) values ($1, $2, $3, '2026-10-01T10:00:00Z')`, [g, p, p === y]);
  const ed = (await one(`insert into public.ranking_editions (period_start_at, period_end_at, published_at) values ('2026-10-05T03:00:00Z', '2026-10-12T02:59:59Z', '2026-10-12T03:05:00Z') returning edition_id`)).edition_id;
  await q(`insert into public.ranking_rows (edition_id, player_id, scope_type, scope_key, is_eligible, total_eligible, density_status, level_status, level_band, ranking_rules_version, location_id, location_display_label, competitive_branch)
           values ($1, $2, 'local', 'loc-1', true, 2, 'insufficient', 'CALIBRADO', 6, 'ranking_v1', $3, 'Bella Vista, Buenos Aires', 'M')`, [ed, x, loc]);
  const days = ['2026-10-04', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-10', '2026-10-11'];
  for (const [k, ds, plat] of [['x', days, 'ios'], ['y', days.slice(0, 4), 'android'], ['z', days.slice(2), 'ios'], ['w', days.slice(1, 3), 'desktop']]) {
    for (const d of ds) await q(`insert into public.player_activity_days (player_id, activity_date, first_seen_at, last_seen_at, opens, display_mode, platform, app_bundle) values ($1, $2::date, $2::date + time '15:00', $2::date + time '15:40', 3, 'standalone', $3, '04.37-h31')`, [ids[k], d, plat]);
  }
  await q(`insert into public.metrics_internal_players (player_id, reason) values ($1, 'test')`, [x]);
  return { ids, uid };
}

before(async () => {
  A = (await replay({ acl: 'observed', exclude: [ERASURE] })).db; B = (await replay({ acl: 'observed' })).db;
  for (const d of [A, B]) await d.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
  A.s = await seed(A); B.s = await seed(B);
});
after(async () => { for (const d of [A, B]) if (d) await d.close(); });

/** Todo lo que una persona con acceso a la base podría juntar sobre un jugador a partir de su `player_id` (sin Auth ni PII directa). */
async function contextFor(db, playerId) {
  const { q } = mk(db);
  return {
    activityRows: Number((await q(`select count(*) c from public.player_activity_days where player_id = $1`, [playerId]))[0].c),
    rankingRows: await q(`select location_display_label, level_band, competitive_branch from public.ranking_rows where player_id = $1`, [playerId]),
    matches: await q(`select m.played_at, array(select p2.display_name_snapshot from public.match_participants p2 where p2.match_id = m.match_id and p2.player_id <> $1 order by 1) as with_players
                        from public.match_participants mp join public.matches m on m.match_id = mp.match_id where mp.player_id = $1`, [playerId]),
    groups: Number((await q(`select count(*) c from public.group_memberships where player_id = $1`, [playerId]))[0].c),
  };
}

test('FASE A · SIN borrado: la actividad de una cuenta eliminada queda UNIDA a localidad, banda de Nivel, rama, partidos y grupo del mismo jugador (seudonimizada, no anónima)', async () => {
  const { q, one } = mk(A); const x = A.s.ids.x;
  await q(`select public.admin_delete_player_account($1)`, [x]);
  const p = await one(`select display_name, deleted_at is not null d, auth_user_id from public.players where player_id = $1`, [x]);
  assert.deepEqual([p.display_name, p.d, p.auth_user_id], ['Jugador eliminado', true, null], 'la cuenta SÍ queda anonimizada');
  const ctx = await contextFor(A, x);
  assert.equal(ctx.activityRows, 6, 'las 6 filas de actividad siguen ahí');
  assert.deepEqual(ctx.rankingRows.map((r) => [r.location_display_label, r.level_band, r.competitive_branch]), [['Bella Vista, Buenos Aires', 6, 'M']], 'unida a localidad + Nivel + rama');
  assert.equal(ctx.matches.length, 1); assert.deepEqual(ctx.matches[0].with_players, ['Snap A2', 'Snap B1', 'Snap B2'], 'unida a un partido con sus compañeros y rivales');
  // una persona que jugó con X puede ubicar a ese jugador por localidad/rama/fechas y leer entonces todo su historial de uso: eso es re-identificar
  // la propia actividad, además, sigue contando en las métricas como una persona concreta con historia
  const u = (await one(`select public.metrics_usage('30d', true, true, $1::timestamptz) r`, [ASOF])).r;
  assert.ok(u.kpis.find((k) => k.id === 'usage.mau').value >= 4, 'sigue sumando como una de las personas activas');
  // CONCLUSIÓN: no se puede garantizar el anonimato (fila + player_id + contexto) → por la decisión confirmada, debe eliminarse
});

test('FASE A→B · la purga única de la migración elimina la actividad de cuentas YA eliminadas (y su marca interna) sin tocar a nadie más', async () => {
  const { q, one } = mk(A);
  const others = async () => (await one(`select md5(string_agg(a::text, '|' order by a::text)) h, count(*)::int n from public.player_activity_days a where player_id <> $1`, [A.s.ids.x]));
  const before_ = await others();
  await A.exec(adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, ERASURE), 'utf8')));
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days where player_id = $1`, [A.s.ids.x])).c), 0, 'purgada');
  assert.equal(Number((await one(`select count(*) c from public.metrics_internal_players where player_id = $1`, [A.s.ids.x])).c), 0);
  assert.deepEqual(await others(), before_, 'las demás cuentas, intactas');
  // reaplicar es seguro
  await A.exec(adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, ERASURE), 'utf8')));
  assert.equal((await others()).n, before_.n);
});

test('FASE B · CON borrado: eliminar la cuenta borra TODA su actividad (y su marca interna); ningún objeto de Metrics conserva rastro del jugador', async () => {
  const { q, one } = mk(B); const { ids } = B.s; const x = ids.x;
  const peers = async () => (await one(`select md5(string_agg(a::text, '|' order by a::text)) h, count(*)::int n from public.player_activity_days a where player_id <> $1`, [x]));
  const peersBefore = await peers();
  const mauBefore = (await one(`select public.metrics_usage('30d', true, true, $1::timestamptz) r`, [ASOF])).r.kpis.find((k) => k.id === 'usage.mau').value;
  const del = (await one(`select public.admin_delete_player_account($1) r`, [x])).r;
  assert.deepEqual([del.ok, del.alreadyDeleted], [true, false]);
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days where player_id = $1`, [x])).c), 0, 'la actividad se eliminó con la cuenta');
  assert.equal(Number((await one(`select count(*) c from public.metrics_internal_players where player_id = $1`, [x])).c), 0);
  // exploración EXHAUSTIVA: ninguna tabla de Metrics menciona al jugador ni su usuario de Auth
  for (const t of ['player_activity_days', 'metrics_internal_players', 'metrics_admins']) {
    const txt = (await q(`select t::text s from public.${t} t`)).map((r) => r.s).join('\n');
    assert.ok(!txt.includes(x) && !txt.includes(B.s.uid.x), `${t}: sin rastro del jugador`);
  }
  assert.deepEqual(await peers(), peersBefore, 'las actividades de las demás cuentas no cambiaron');
  // las métricas ya no lo cuentan (ni como persona activa ni en cohortes de retención)
  const u = (await one(`select public.metrics_usage('30d', true, true, $1::timestamptz) r`, [ASOF])).r;
  assert.equal(u.kpis.find((k) => k.id === 'usage.mau').value, mauBefore - 1, 'una persona activa menos: la eliminada');
  const txt = JSON.stringify(u) + JSON.stringify((await one(`select public.metrics_explore('usage.mau','30d',true,true,null,null,$1::timestamptz) r`, [ASOF])).r);
  assert.ok(!txt.includes(x), 'sin el id en las salidas');
  // idempotente: segunda eliminación y limpieza
  const again = (await one(`select public.admin_delete_player_account($1) r`, [x])).r;
  assert.deepEqual([again.ok, again.alreadyDeleted], [true, true]);
  // reingreso = identidad NUEVA: no hereda actividad
  const u2 = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'x_reingreso@example.test', '2026-10-12T10:00:00Z')`, [u2]);
  const p2 = (await one(`select player_id from public.players where auth_user_id = $1`, [u2])).player_id;
  assert.notEqual(p2, x); assert.equal(Number((await one(`select count(*) c from public.player_activity_days where player_id = $1`, [p2])).c), 0);
});

test('FASE B · la retención no cuenta como «no volvió» a quien eliminó su cuenta (cohorte sin cuentas eliminadas) y el catálogo lo declara', async () => {
  const { one } = mk(B);
  const r = (await one(`select public.metrics_usage('all', false, true, $1::timestamptz) r`, [ASOF])).r;
  const w1 = r.kpis.find((k) => k.id === 'usage.ret_d1');
  assert.ok(/sin cuentas eliminadas/.test(w1.population), w1.population);
  for (const id of ['w1', 'w4', 'd1', 'd7', 'd30']) assert.match(r.kpis.find((k) => k.id === `usage.ret_${id}`).population, /sin cuentas eliminadas/);
  // cohorte posterior al inicio de la presencia: 2 altas del 06/10, una de ellas con actividad y luego eliminada
  const { q } = mk(B);
  await q(`update public.app_config set activity_consent_version = 'activity_v1'`);
  const mkNew = async (key) => {
    const u = crypto.randomUUID();
    await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, '2026-10-06T12:00:00Z')`, [u, `${key}_${u.slice(0, 5)}@example.test`]);
    const p = (await one(`select player_id from public.players where auth_user_id = $1`, [u])).player_id;
    await q(`update public.players set created_at = '2026-10-06T12:00:00Z' where player_id = $1`, [p]);
    await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'signup', '2026-10-06T12:01:00Z'::timestamptz)`, [p]);
    for (const d of ['2026-10-07', '2026-10-13']) await q(`insert into public.player_activity_days (player_id, activity_date, display_mode, platform) values ($1, $2::date, 'browser', 'ios')`, [p, d]);
    return p;
  };
  const keep = await mkNew('keep'); const gone = await mkNew('gone');
  const ret = async () => (await one(`select public._metrics_retention('2026-10-05T03:00:00Z'::timestamptz, '2026-10-12T03:00:00Z'::timestamptz, '2026-10-20T12:00:00Z'::timestamptz, true) r`)).r;
  const c0 = (await ret()).cohort; const r0 = (await ret()).d1_ret; const n0 = (await ret()).d1_den;
  assert.ok(c0 >= 2 && r0 >= 2, 'antes de eliminar: las 2 altas nuevas cuentan');
  await q(`select public.admin_delete_player_account($1)`, [gone]);
  const after_ = await ret();
  assert.equal(after_.cohort, c0 - 1, 'la cohorte excluye a la cuenta eliminada: no cuenta como «no volvió»');
  assert.equal(after_.d1_ret, r0 - 1);
  assert.equal(after_.d1_den, n0 - 1, 'ni el denominador la cuenta: sale de la cohorte, no baja la retención');
  assert.ok(keep);
});

test('FASE B · el borrado no depende de las tablas de Metrics: tras el retiro nivel 2 sigue borrando; tras el nivel 3 la eliminación de cuentas vuelve a su definición original y funciona', async () => {
  const { q, one } = mk(B); const { ids } = B.s;
  await B.exec(level(2));
  const d2 = (await one(`select public.admin_delete_player_account($1) r`, [ids.y])).r;
  assert.equal(d2.ok, true, 'nivel 2: elimina sin las tablas de lectura de métricas');
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days where player_id = $1`, [ids.y])).c), 0, 'y borra su actividad (la tabla de presencia sigue en nivel 2)');
  await B.exec(level(3));
  assert.equal(Number((await one(`select count(*) c from pg_class where relnamespace = 'public'::regnamespace and relname = 'player_activity_days'`)).c), 0);
  const d3 = (await one(`select public.admin_delete_player_account($1) r`, [ids.z])).r;
  assert.equal(d3.ok, true, 'nivel 3: sin ninguna tabla de Metrics la eliminación funciona');
  assert.equal((await one(`select public.admin_delete_player_account($1) r`, [ids.w])).r.ok, true);
  const def = (await one(`select pg_get_functiondef('public.admin_delete_player_account(uuid)'::regprocedure) d`)).d;
  assert.ok(!/player_activity_days/.test(def), 'definición original restaurada');
});

test('todas las vías de eliminación pasan por la MISMA función SQL (autoservicio con OTP y vehículo administrativo): no hay otro camino que deje actividad', async () => {
  const core = fs.readFileSync(path.join(HERE, 'account-deletion-core.mjs'), 'utf8');
  assert.match(core, /rpc\('admin_delete_player_account'/);
  const edge = fs.readFileSync(path.join(HERE, '..', 'delete-my-account', 'index.ts'), 'utf8');
  assert.match(edge, /account-deletion-core/);
  const script = fs.readFileSync(path.join(HERE, '..', '..', 'scripts', 'admin-delete-player-account.mjs'), 'utf8');
  assert.match(script, /account-deletion-core/);
  // `players` solo se DELETEa en la fusión de identidad (borra el player vacío recién creado de quien reclama una invitación); ahí la FK de la
  // actividad es ON DELETE CASCADE: tampoco queda actividad huérfana. La eliminación de cuenta nunca borra la fila (se anonimiza) y por eso borra la actividad a mano.
  const deleters = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /delete\s+from\s+public\.players\b/i.test(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')));
  assert.deepEqual(deleters, ['20260920120000_bloque4_jugadores_busqueda_provisional.sql']);
  const f1 = fs.readFileSync(path.join(MIGRATIONS_DIR, '20261008100000_metrics_f1_player_activity.sql'), 'utf8');
  assert.match(f1, /player_id\s+uuid not null references public\.players \(player_id\) on delete cascade/, 'FK de la actividad: ON DELETE CASCADE');
  const fnDef = (await mk(B).one(`select pg_get_functiondef('public.admin_delete_player_account(uuid)'::regprocedure) d`)).d;
  assert.ok(!/delete\s+from\s+public\.players\b/i.test(fnDef));
});
