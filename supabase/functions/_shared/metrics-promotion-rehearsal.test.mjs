// BRAMU Metrics V1 — ENSAYO DE PROMOCIÓN a Production (PGlite = Postgres real).
// Ejecutar con: node --test supabase/functions/_shared/metrics-promotion-rehearsal.test.mjs
//
// Responde con evidencia a: «¿aplicar las 4 migraciones de Metrics sobre una base que ya tiene usuarios reales puede romper o alterar
// algo existente?» y «¿el retiro (rollback) deja la base exactamente como estaba?».
//   1. Se reconstruye una base TIPO PRODUCTION: todas las migraciones EXCEPTO las de Metrics (20261008*), con datos sembrados.
//   2. Se fotografía todo lo que ya existe (filas por tabla con checksum, definición/ACL de cada función, ACL de tablas, políticas,
//      triggers, índices) y el informe de acceso/copia de un jugador.
//   3. Se aplican, en orden, F1 → F2 → F4 → F6 (y se re-aplican: reintento seguro).
//   4. Se comprueba que NADA existente cambió, salvo UNA función (`admin_export_player_data`, que gana la clave `activityDays`).
//   5. Se ejercita lo nuevo con datos reales-like (sin fugas) y la presencia escribe solo la fila propia.
//   6. Se ejecutan los 3 niveles de retiro de `supabase/scripts/metrics-rollback.sql` y se demuestra que el esquema vuelve al original.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay, adaptMigration, MIGRATIONS_DIR } from '../../scripts/replay-migrations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROLLBACK = fs.readFileSync(path.join(HERE, '..', '..', 'scripts', 'metrics-rollback.sql'), 'utf8');
const METRICS_MIGRATIONS = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.startsWith('20261008')).sort();
const ERASURE_MIGRATION = '20261008140000_metrics_presence_erased_on_account_deletion.sql';
const CONSENT_MIGRATION = '20261008150000_metrics_activity_consent.sql';
const ASOF = '2026-10-08T12:00:00Z';
let db; let before_; let uid = {}; let pid = {};

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];

/** Nivel N del script de retiro: las líneas `--> ` son el SQL (comentado a propósito para que nadie lo corra entero por error). */
function rollbackLevel(n) {
  const start = ROLLBACK.indexOf(`-- NIVEL ${n} —`);
  assert.ok(start >= 0, `nivel ${n} presente`);
  const next = ROLLBACK.indexOf('-- NIVEL', start + 10);
  const block = ROLLBACK.slice(start, next < 0 ? undefined : next);
  return block.split('\n').filter((l) => l === '-->' || l.startsWith('--> ')).map((l) => (l === '-->' ? '' : l.slice(4))).join('\n');
}

async function mkAccount(key, at, { username = true } = {}) {
  const u = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [u, `${key}_${u.slice(0, 5)}@example.test`, at]);
  const p = (await one(`select player_id from public.players where auth_user_id = $1`, [u])).player_id;
  await q(`update public.players set created_at = $2, display_name = $3 where player_id = $1`, [p, at, `Nombre ${key}`]);
  if (username) await q(`update public.profiles set username = $2, first_name = $3 where player_id = $1`, [p, `user_${key}`, `Nombre${key}`]);
  uid[key] = u; pid[key] = p;
  return p;
}

/** El informe lleva la hora de generación: se normaliza para comparar el resto. */
const stable = (x) => { const c = JSON.parse(JSON.stringify(x)); if (c.report) c.report.generatedAt = '<hora>'; return c; };

/** Fotografía de TODO lo que ya existe (se excluyen los objetos propios de Metrics). */
async function snapshot() {
  const tables = (await q(`select c.relname, c.relacl::text acl, c.relrowsecurity rls from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
                            and c.relname not in ('metrics_admins', 'metrics_internal_players', 'player_activity_days', 'activity_consents') order by 1`));
  const rows = {};
  for (const t of tables) {
    // app_config gana UNA columna nueva (vigente = NULL): se compara sin ella; el resto de las tablas, fila por fila.
    const r = await one(t.relname === 'app_config'
      ? `select count(*)::int n, coalesce(md5(string_agg((to_jsonb(x) - 'activity_consent_version')::text, '|' order by (to_jsonb(x) - 'activity_consent_version')::text)), '') h from public.app_config x`
      : `select count(*)::int n, coalesce(md5(string_agg(x::text, '|' order by x::text)), '') h from public."${t.relname}" x`);
    rows[t.relname] = `${r.n}:${r.h}`;
  }
  const fns = await q(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig, md5(pg_get_functiondef(p.oid)) as def, p.proacl::text as acl
                         from pg_proc p
                        where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
                          and p.proname not like 'metrics\\_%' and p.proname not like '\\_metrics\\_%' and p.proname <> 'register_app_presence'
                          and p.proname not in ('_activity_consent_status', '_record_activity_consent', 'get_my_activity_consent', 'set_my_activity_consent', 'activity_consents_reject_mutation')
                        order by 1`);
  const policies = await q(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public'
                              and tablename not in ('metrics_admins', 'metrics_internal_players', 'player_activity_days', 'activity_consents') order by 1, 2`);
  const triggers = await q(`select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
                              and c.relname not in ('metrics_admins', 'metrics_internal_players', 'player_activity_days', 'activity_consents') order by 1, 2`);
  const indexes = await q(`select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
                             and tablename not in ('metrics_admins', 'metrics_internal_players', 'player_activity_days', 'activity_consents') order by 1, 2`);
  return { tables: tables.map((t) => [t.relname, t.acl, t.rls]), rows, fns, policies, triggers, indexes };
}

before(async () => {
  const names = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  assert.equal(METRICS_MIGRATIONS.length, 6, 'las únicas migraciones del día son las 6 de Metrics (F1, F2, F4, F6, borrado de actividad al eliminar cuenta y consentimiento)');
  assert.deepEqual(METRICS_MIGRATIONS.slice(-2), [ERASURE_MIGRATION, CONSENT_MIGRATION]);
  assert.ok(names.length > 80);
  const r = await replay({ acl: 'observed', exclude: ['20261008'] });
  assert.ok(r.ok, 'la base tipo Production (todo menos Metrics) reconstruye limpia');
  assert.ok(!r.files.some((f) => f.startsWith('20261008')));
  db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'production')`);

  // ---- Datos tipo Production (usuarios reales, pocos): 6 cuentas, localidades, Nivel, 1 grupo, partidos, invitación, Ranking ----
  const a = await mkAccount('a', '2026-10-07T13:00:00Z'); const b = await mkAccount('b', '2026-10-07T14:00:00Z');
  const c = await mkAccount('c', '2026-10-07T15:00:00Z'); const d = await mkAccount('d', '2026-10-07T16:00:00Z');
  const e = await mkAccount('e', '2026-10-07T17:00:00Z', { username: false }); await mkAccount('f', '2026-10-08T01:00:00Z');
  const prov = (await one(`insert into public.players (type, display_name, created_at) values ('provisional', 'Invitado Prov', '2026-10-07T18:00:00Z') returning player_id`)).player_id;
  await q(`insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
           values ('AR','georef','06','0600','Buenos Aires','Bella Vista','Bella Vista, Buenos Aires',true), ('AR','georef','06','0601','Buenos Aires','San Miguel','San Miguel, Buenos Aires',true)`);
  const bv = (await one(`select location_id from public.locations where locality_label = 'Bella Vista'`)).location_id;
  await q(`update public.profiles set location_id = $1 where player_id = any($2::uuid[])`, [bv, [a, b, c]]);
  for (const p of [a, b, c, d]) await q(`insert into public.level_events (player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode) values ($1, 'initial_estimate', 'v1.3', 'q', 'full')`, [p]);
  const m = (await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, created_at, validated_at)
                          values ($1, 'fp-rehearsal-1', 'classic', '2026-10-07T20:00:00Z', '2026-12-01', 'validated', '2026-10-07T20:00:00Z', '2026-10-07T21:00:00Z') returning match_id`, [a])).match_id;
  const slots = [['A', 1, a], ['A', 2, b], ['B', 1, c], ['B', 2, prov]];
  for (const [team, pos, p] of slots) await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,'Snap')`, [m, team, pos, p]);
  await q(`insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at) values ($1, 'created', $2, '2026-10-07T20:00:00Z')`, [m, a]);
  const g = (await one(`insert into public.groups (name, created_by_player_id, status) values ('Grupo ensayo', $1, 'active') returning group_id`, [a])).group_id;
  for (const p of [a, b, c]) await q(`insert into public.group_memberships (group_id, player_id, is_admin, joined_at) values ($1, $2, $3, '2026-10-07T19:00:00Z')`, [g, p, p === a]);
  await q(`insert into public.provisional_claims (provisional_player_id, token_hash, status, created_by_player_id, created_at, expires_at) values ($1, 'h-ensayo', 'pending', $2, '2026-10-07T18:30:00Z', '2026-12-30')`, [prov, a]);
  const ed = (await one(`insert into public.ranking_editions (period_start_at, period_end_at, published_at) values ('2026-09-28T03:00:00Z', '2026-10-05T02:59:59Z', '2026-10-05T03:05:00Z') returning edition_id`)).edition_id;
  await q(`insert into public.ranking_rows (edition_id, player_id, scope_type, scope_key, is_eligible, total_eligible, density_status, level_status, level_band, ranking_rules_version, eligibility_reason_codes)
           values ($1, $2, 'global', 'GLOBAL', false, 0, 'insufficient', 'PENDIENTE', null, 'ranking_v1', '["no_opt_in"]'::jsonb)`, [ed, e]);
  before_ = { snap: await snapshot(), exportA: stable((await one(`select public.admin_export_player_data($1) as r`, [a])).r) };
});
after(async () => { if (db) await db.close(); });

async function apply(files) {
  for (const f of files) await db.exec(adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')));
}

test('1 · la base tipo Production tiene datos reales-like y NO tiene nada de Metrics (punto de partida)', async () => {
  assert.equal(Number((await one(`select count(*) c from public.players where type = 'registered'`)).c), 6);
  assert.equal(Number((await one(`select count(*) c from pg_proc where pronamespace = 'public'::regnamespace and (proname like '%metrics%' or proname = 'register_app_presence')`)).c), 0);
  assert.equal(Number((await one(`select count(*) c from pg_class where relnamespace = 'public'::regnamespace and relname in ('player_activity_days', 'metrics_admins', 'metrics_internal_players')`)).c), 0);
  assert.ok(Object.keys(before_.snap.rows).length > 20, `se fotografiaron todas las tablas existentes (${Object.keys(before_.snap.rows).length})`);
  assert.equal(before_.exportA.ok, true);
  assert.equal('activityDays' in before_.exportA, false);
});

test('2 · aplicar las 5 migraciones de Metrics sobre esa base NO altera NADA existente (datos, ACL, políticas, triggers, índices) y solo cambian TRES funciones (+ una columna nueva en app_config)', async () => {
  await apply(METRICS_MIGRATIONS);
  const now = await snapshot();
  assert.deepEqual(now.rows, before_.snap.rows, 'ninguna fila de ninguna tabla existente cambió (conteo + checksum por tabla)');
  assert.deepEqual(now.tables, before_.snap.tables, 'ACL y RLS de las tablas existentes idénticos');
  assert.deepEqual(now.policies, before_.snap.policies); assert.deepEqual(now.triggers, before_.snap.triggers); assert.deepEqual(now.indexes, before_.snap.indexes);
  const was = Object.fromEntries(before_.snap.fns.map((f) => [f.sig, f])); const is = Object.fromEntries(now.fns.map((f) => [f.sig, f]));
  assert.deepEqual(Object.keys(is).sort(), Object.keys(was).sort(), 'no apareció ni desapareció ninguna función existente');
  const changed = Object.keys(is).filter((k) => is[k].def !== was[k].def);
  assert.deepEqual(changed.sort(), ['admin_delete_player_account(p_player_id uuid)', 'admin_export_player_data(p_player_id uuid)', 'handle_email_confirmed()'], 'las únicas funciones existentes que cambian: informe de acceso/copia (+activityDays/activityConsents), eliminación de cuenta (+borrado de actividad) y el alta (+registro del consentimiento declarado)');
  assert.deepEqual(Object.keys(is).filter((k) => is[k].acl !== was[k].acl), [], 'ningún permiso de función existente cambió');
});

test('2b · lo nuevo del consentimiento: 5 funciones y 1 tabla; los helpers no son de clientes; solo el jugador autenticado decide sobre sí mismo', async () => {
  const fns = (await q(`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_activity_consent_status', '_record_activity_consent', 'get_my_activity_consent', 'set_my_activity_consent', 'activity_consents_reject_mutation') order by 1`)).map((x) => x.proname);
  assert.equal(fns.length, 5);
  const ex = async (role, sig) => (await one(`select has_function_privilege($1, $2::regprocedure, 'execute') x`, [role, sig])).x;
  assert.deepEqual([await ex('anon', 'public.get_my_activity_consent()'), await ex('authenticated', 'public.get_my_activity_consent()'), await ex('anon', 'public.set_my_activity_consent(text,boolean,text)'), await ex('authenticated', 'public.set_my_activity_consent(text,boolean,text)')], [false, true, false, true]);
  for (const sig of ['public._activity_consent_status(uuid)', 'public._record_activity_consent(uuid,text,text,text,timestamptz)']) for (const role of ['anon', 'authenticated']) assert.equal(await ex(role, sig), false, `${role} ${sig}`);
  const t = await one(`select has_table_privilege('anon', 'public.activity_consents', 'select,insert,update,delete') a, has_table_privilege('authenticated', 'public.activity_consents', 'select,insert,update,delete') u, (select relrowsecurity from pg_class where oid = 'public.activity_consents'::regclass) rls`);
  assert.deepEqual([t.a, t.u, t.rls], [false, false, true]);
  assert.equal((await one(`select activity_consent_version v from public.app_config`)).v, null, 'la medición queda APAGADA por defecto en cualquier entorno');
});

test('3 · reintento seguro: volver a aplicar cada migración de Metrics (corte a mitad de camino) no falla ni cambia lo existente', async () => {
  for (const f of METRICS_MIGRATIONS) await apply([f]);
  const now = await snapshot();
  assert.deepEqual(now.rows, before_.snap.rows);
  assert.deepEqual(now.tables, before_.snap.tables);
});

test('4 · el informe de acceso/copia sigue igual y solo gana `activityDays` y `activityConsents` (derecho de acceso)', async () => {
  const after_ = stable((await one(`select public.admin_export_player_data($1) as r`, [pid.a])).r);
  assert.equal(after_.ok, true);
  assert.deepEqual([after_.activityDays, after_.activityConsents], [[], []]);
  const { activityDays, activityConsents, ...rest } = after_;
  assert.deepEqual(rest, before_.exportA, 'todo lo demás del informe es idéntico');
});

test('5 · permisos nuevos: ningún cliente ejecuta el motor; solo `register_app_presence` es de usuarios autenticados', async () => {
  const fns = await q(`select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'metrics\\_%' or p.proname like '\\_metrics\\_%')`);
  assert.ok(fns.length >= 30, `funciones de métricas: ${fns.length}`);
  for (const f of fns) for (const role of ['anon', 'authenticated']) assert.equal((await one(`select has_function_privilege($1, $2::oid, 'execute') x`, [role, f.oid])).x, false, `${role}/${f.proname}`);
  const pr = await one(`select has_function_privilege('anon', 'public.register_app_presence(text,text,text)', 'execute') a, has_function_privilege('authenticated', 'public.register_app_presence(text,text,text)', 'execute') u`);
  assert.deepEqual([pr.a, pr.u], [false, true]);
  for (const t of ['metrics_admins', 'metrics_internal_players', 'player_activity_days']) {
    const x = await one(`select has_table_privilege('anon', $1, 'select,insert,update,delete') a, has_table_privilege('authenticated', $1, 'select,insert,update,delete') u, (select relrowsecurity from pg_class where oid = $1::regclass) rls`, [`public.${t}`]);
    assert.deepEqual([x.a, x.u, x.rls], [false, false, true], t);
  }
});

test('6 · sin administradores NADIE puede leer métricas; con un administrador de Production solo ese UUID es autorizado', async () => {
  assert.equal(Number((await one(`select count(*) c from public.metrics_admins`)).c), 0, 'las migraciones no siembran ningún administrador');
  for (const k of ['a', 'b']) assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid[k]])).r, false);
  await db.exec('begin');
  try {
    await q(`insert into public.metrics_admins (auth_user_id, label) values ($1, 'Sebastián (Production)')`, [uid.a]);
    assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid.a])).r, true);
    for (const k of ['b', 'c', 'd', 'e', 'f']) assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid[k]])).r, false, `la cuenta ${k} NO es administradora`);
    assert.equal((await one(`select public.metrics_is_admin(null) r`)).r, false);
  } finally { await db.exec('rollback'); }
});

test('7 · con usuarios reales-like: las 6 secciones y los 55 indicadores del Explorador responden `production`, sin UUID/emails/nombres y sin inventar datos', async () => {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const s of ['overview', 'users', 'matches', 'activation', 'community', 'usage']) {
    const r = (await one(`select public.metrics_${s}('all', true, false, $1::timestamptz) r`, [ASOF])).r;
    assert.equal(r.ok, true, s); assert.equal(r.meta.environment, 'production');
    const t = JSON.stringify(r);
    assert.ok(!uuid.test(t), `${s}: sin UUID`); assert.ok(!/[A-Za-z0-9._-]+@[A-Za-z0-9-]+/.test(t), `${s}: sin emails`);
    assert.ok(!/Nombre [a-f]|Nombre[a-f]|user_[a-f]|Snap|Invitado Prov|Grupo ensayo/.test(t), `${s}: sin nombres`);
  }
  const users = (await one(`select public.metrics_users('all', true, false, $1::timestamptz) r`, [ASOF])).r;
  assert.equal(users.kpis.find((k) => k.id === 'users.registered_now').value, 6);
  const loc = users.kpis.find((k) => k.id === 'users.with_location_rate');
  assert.deepEqual([loc.n, loc.value, loc.availability], [6, 0.5, 'ok'], '6 cuentas ≥ mínimo 5: el porcentaje se muestra (3 de 6), con su n');
  assert.equal(users.breakdowns.location.suppressed, false);
  assert.ok(users.breakdowns.location.items.every((i) => i.n >= 5 || /^Otros/.test(i.label)), 'ningún segmento < 5 sin agrupar');
  const usage = (await one(`select public.metrics_usage('30d', true, false, $1::timestamptz) r`, [ASOF])).r;
  for (const k of usage.kpis.filter((x) => /^usage\.(dau|wau|mau|dau_avg|standalone_share|ret_[a-z0-9]+)$/.test(x.id))) {
    assert.equal(k.availability, 'not_instrumented', `${k.id}: sin presencia capturada NO se inventa actividad pasada`); assert.equal(k.value, null);
  }
  assert.equal(usage.meta.presenceSince, null);
  const cat = (await one(`select public.metrics_explore_catalog() r`)).r;
  assert.equal(cat.catalog.length, 55);
  for (const e of cat.catalog) {
    const x = (await one(`select public.metrics_explore($1, '30d', true, false, null, null, $2::timestamptz) r`, [e.id, ASOF])).r;
    assert.equal(x.ok, true, e.id); assert.ok(!uuid.test(JSON.stringify(x)) && !/[A-Za-z0-9._-]+@[A-Za-z0-9-]+/.test(JSON.stringify(x)), e.id);
  }
});

test('8 · la presencia: SIN consentimiento no se registra nada; con consentimiento escribe SOLO la fila propia, desde el consentimiento hacia adelante (nunca antes)', async () => {
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days`)).c), 0, 'recién migrado: cero días de actividad (nada retroactivo)');
  const present = async (key, mode = 'standalone') => {
    await db.exec('savepoint pr'); await db.exec('set local role authenticated');
    try { await q(`select set_config('request.jwt.claim.sub', $1, true)`, [key ? uid[key] : '']); return (await one(`select public.register_app_presence($1, 'android', '04.37-h31') r`, [mode])).r; }
    finally { await db.exec('rollback to savepoint pr'); }
  };
  await db.exec('begin');
  try {
    assert.equal((await present(null)).code, 'not_authenticated');
    assert.equal((await present('b')).code, 'measurement_disabled', 'medición APAGADA por defecto en el entorno: nadie registra (ni el que aún no decidió)');
    await db.exec(`update public.app_config set activity_consent_version = 'activity_v1'`);
    assert.equal((await present('b')).code, 'no_consent', 'medición encendida pero sin decisión: NO se registra');
    await q(`select public._record_activity_consent($1, 'activity_v1', 'declined', 'prompt', now())`, [pid.c]);
    assert.equal((await present('c')).code, 'no_consent', 'quien declinó sigue usando la app y NO se registra');
    await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'prompt', now() - interval '1 minute')`, [pid.b]);
    const ok = await present('b'); assert.deepEqual([ok.ok, ok.recorded], [true, true]);
    await q(`select set_config('request.jwt.claim.sub', $1, true)`, [uid.b]);
    await db.exec('set local role authenticated');
    assert.deepEqual((await one(`select public.register_app_presence('standalone', 'android', '04.37-h31') r`)).r, { ok: true, recorded: true });
    assert.deepEqual((await one(`select public.register_app_presence('standalone', 'android', '04.37-h31') r`)).r, { ok: true, recorded: false }, 'idempotente por día y anti-ráfaga');
    await db.exec('reset role');
    const rows = await q(`select a.player_id, a.activity_date = (now() at time zone 'America/Argentina/Buenos_Aires')::date as is_today_ba,
                                 a.first_seen_at >= (select decided_at from public.activity_consents where player_id = a.player_id and decision = 'granted') as after_consent from public.player_activity_days a`);
    assert.equal(rows.length, 1); assert.equal(rows[0].player_id, pid.b, 'solo la fila de la sesión que consintió');
    assert.deepEqual([rows[0].is_today_ba, rows[0].after_consent], [true, true], 'día BA fijado por el servidor y nunca anterior al consentimiento');
  } finally { await db.exec('rollback'); }
});

test('9 · eliminar una cuenta con presencia: queda anonimizada y su actividad diaria se ELIMINA (no se conserva seudonimizada); las poblaciones y la retención no la cuentan', async () => {
  await db.exec('begin');
  try {
    await q(`insert into public.player_activity_days (player_id, activity_date, display_mode, platform, app_bundle) values ($1, '2026-10-08', 'browser', 'ios', '04.37-h31')`, [pid.f]);
    await q(`insert into public.metrics_internal_players (player_id, reason) values ($1, 'test')`, [pid.f]);
    const del = (await one(`select public.admin_delete_player_account($1) r`, [pid.f])).r;
    assert.equal(del.ok, true);
    const p = await one(`select display_name, deleted_at is not null del, auth_user_id from public.players where player_id = $1`, [pid.f]);
    assert.deepEqual([p.display_name, p.del, p.auth_user_id], ['Jugador eliminado', true, null], 'anonimizada y sin vínculo con Auth');
    assert.equal((await q(`select * from public.player_activity_days where player_id = $1`, [pid.f])).length, 0, 'DECISIÓN CONFIRMADA: la actividad se elimina con la cuenta');
    assert.equal((await q(`select * from public.metrics_internal_players where player_id = $1`, [pid.f])).length, 0, 'y también su marca de «cuenta interna»');
    const again = (await one(`select public.admin_delete_player_account($1) r`, [pid.f])).r;
    assert.deepEqual([again.ok, again.alreadyDeleted], [true, true], 'idempotente');
    const u = (await one(`select public.metrics_users('all', true, false, '2026-10-09T12:00:00Z') r`)).r;
    assert.equal(u.kpis.find((k) => k.id === 'users.registered_now').value, 5, 'eliminada fuera de cuentas actuales');
  } finally { await db.exec('rollback'); }
});

test('10 · RETIRO nivel 1: revocar al administrador apaga el acceso sin tocar esquema (y es reversible)', async () => {
  await db.exec('begin');
  try {
    await q(`insert into public.metrics_admins (auth_user_id, label) values ($1, 'x')`, [uid.a]);
    assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid.a])).r, true);
    await db.exec(rollbackLevel(1));
    assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid.a])).r, false, 'apagado');
    await q(`update public.metrics_admins set revoked_at = null`);
    assert.equal((await one(`select public.metrics_is_admin($1) r`, [uid.a])).r, true, 'reversible');
  } finally { await db.exec('rollback'); }
});

test('11 · RETIRO niveles 2 y 3: el esquema vuelve EXACTAMENTE al de antes de Metrics y los datos de jugadores no cambian', async () => {
  // presencia capturada antes del retiro
  await q(`insert into public.player_activity_days (player_id, activity_date, display_mode, platform) values ($1, '2026-10-08', 'browser', 'ios')`, [pid.a]);
  await db.exec(rollbackLevel(2));
  assert.equal(Number((await one(`select count(*) c from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'metrics\\_%' or proname like '\\_metrics\\_%')`)).c), 0, 'nivel 2: sin funciones de métricas');
  assert.equal(Number((await one(`select count(*) c from pg_class where relnamespace = 'public'::regnamespace and relname in ('metrics_admins', 'metrics_internal_players')`)).c), 0);
  assert.equal(Number((await one(`select count(*) c from public.player_activity_days`)).c), 1, 'nivel 2 CONSERVA la presencia ya capturada');
  assert.equal((await one(`select public.admin_export_player_data($1) r`, [pid.a])).r.activityDays.length, 1, 'el informe sigue funcionando');
  await db.exec(rollbackLevel(3));
  const now = await snapshot();
  assert.deepEqual(now.rows, before_.snap.rows, 'datos de todas las tablas existentes idénticos');
  assert.deepEqual(now.tables, before_.snap.tables);
  const diff = now.fns.filter((f, i) => JSON.stringify(f) !== JSON.stringify(before_.snap.fns[i])).map((f) => f.sig);
  assert.deepEqual(diff, [], 'funciones distintas tras el retiro');
  assert.deepEqual(now.fns, before_.snap.fns, 'TODAS las funciones (definición y permisos) idénticas a las de antes, incluido el informe de acceso/copia restaurado');
  assert.deepEqual(now.policies, before_.snap.policies); assert.deepEqual(now.triggers, before_.snap.triggers); assert.deepEqual(now.indexes, before_.snap.indexes);
  assert.equal(Number((await one(`select count(*) c from pg_class where relnamespace = 'public'::regnamespace and relname = 'player_activity_days'`)).c), 0, 'nivel 3: sin tabla de presencia');
  assert.equal(Number((await one(`select count(*) c from pg_proc where pronamespace = 'public'::regnamespace and proname = 'register_app_presence'`)).c), 0);
  assert.equal(Number((await one(`select count(*) c from pg_proc where pronamespace = 'public'::regnamespace and proname in ('_activity_consent_status', '_record_activity_consent', 'get_my_activity_consent', 'set_my_activity_consent', 'activity_consents_reject_mutation')`)).c), 0, 'nivel 3: sin funciones de consentimiento');
  assert.equal(Number((await one(`select count(*) c from pg_class where relnamespace = 'public'::regnamespace and relname = 'activity_consents'`)).c), 0);
  assert.equal(Number((await one(`select count(*) c from information_schema.columns where table_name = 'app_config' and column_name = 'activity_consent_version'`)).c), 0, 'nivel 3: la columna de app_config también se retira');
  const exp = stable((await one(`select public.admin_export_player_data($1) r`, [pid.a])).r);
  assert.deepEqual(exp, before_.exportA, 'el informe de acceso/copia es idéntico al original');
});

test('12 · el script de retiro tiene los 3 niveles, todo el SQL activo está marcado (`--> `) y nada se ejecuta si se corre el archivo entero', async () => {
  for (const n of [1, 2, 3]) assert.ok(rollbackLevel(n).length > 20, `nivel ${n}`);
  const executable = ROLLBACK.split('\n').filter((l) => l.trim() && !l.startsWith('--'));
  assert.deepEqual(executable, [], 'ninguna línea ejecutable fuera de comentarios: correr el archivo entero es inocuo');
  assert.match(ROLLBACK, /DESTRUCTIVO/);
});
