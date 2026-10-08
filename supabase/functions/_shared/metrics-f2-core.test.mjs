// BRAMU Metrics V1 · F2 — pruebas SQL (PGlite = Postgres real, TODAS las migraciones) del núcleo protegido de métricas.
// Ejecutar con: node --test supabase/functions/_shared/metrics-f2-core.test.mjs
//
// Cubre: permisos (nada ejecutable por clientes), lista de administradores, ventanas BA, umbral de privacidad k=5,
// reglas de comparación, cada trampa de datos de la Auditoría (vencido derivado, NULL de anulaciones, partidos de 1 cuenta,
// provisionales recuperados, cuentas eliminadas), exclusión de cuentas internas, presencia/retención y NO FUGA de datos
// personales. El fixture es el del Apéndice B de Metrics/BRAMU_Metrics_Auditoria_Tecnica_V1.md.
// F4 (migración 20261008120000): D8 (días completos hasta ayer), «hoy parcial», snapshots sin comparación, Comunidad (Grupos · Nivel · Ranking)
// con umbrales k=5 y n≥10 — ver la sección «F4» al final.
import crypto from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';

const ASOF = '2026-10-08T12:00:00Z';
const SECTIONS = ['overview', 'users', 'matches', 'activation', 'community', 'usage'];
let db; let dbOpen; let dbStrict;
const ids = {};

before(async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'replay limpio');
  db = r.db;
  dbOpen = (await replay({ acl: 'open' })).db;
  dbStrict = (await replay({ acl: 'strict' })).db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
  await buildFixture();
});
after(async () => { for (const d of [db, dbOpen, dbStrict]) if (d) await d.close(); });

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const call = async (fn, range = '90d', { compare = true, internal = false, asof = ASOF } = {}) =>
  (await one(`select public.${fn}($1, $2, $3, $4::timestamptz) as r`, [range, compare, internal, asof])).r;
const kpi = (res, id) => { const k = res.kpis.find((x) => x.id === id); assert.ok(k, `KPI ${id} presente`); return k; };
const scenario = (name, fn) => test(name, async () => {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
});

async function mkAccount(key, confirmedAt, { username = true } = {}) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)`, [uid, `${key}_${uid.slice(0, 5)}@example.test`, confirmedAt]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set created_at = $2, display_name = $3 where player_id = $1`, [pid, confirmedAt, `Nombre ${key}`]);
  if (username) await q(`update public.profiles set username = $2, first_name = $3 where player_id = $1`, [pid, `user_${key}`, `Nombre${key}`]);
  return { uid, pid };
}
let seq = 0;
async function mkMatch(author, status, createdAt, parts, extra = {}) {
  seq += 1;
  const m = await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at, status, created_at, validated_at, annulled_at, annulment_reason)
    values ($1, $2, 'classic', $3, $4, $5, $3, $6, $7, $8) returning match_id`,
  [author, `fp-${seq}`, createdAt, extra.deadline || '2026-12-01', status, extra.validated || null, extra.annulled || null, extra.reason ? JSON.stringify(extra.reason) : null]);
  const slots = [['A', 1], ['A', 2], ['B', 1], ['B', 2]];
  for (let i = 0; i < parts.length; i += 1) {
    await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`, [m.match_id, slots[i][0], slots[i][1], parts[i], `Snapshot ${i}`]);
  }
  return m.match_id;
}

async function buildFixture() {
  const a1 = await mkAccount('a1', '2026-09-01T12:00:00Z'); const a2 = await mkAccount('a2', '2026-09-02T12:00:00Z');
  const a3 = await mkAccount('a3', '2026-09-10T12:00:00Z'); const a4 = await mkAccount('a4', '2026-09-20T12:00:00Z');
  const a5 = await mkAccount('a5', '2026-10-01T12:00:00Z', { username: false });
  Object.assign(ids, { a1: a1.pid, a2: a2.pid, a3: a3.pid, a4: a4.pid, a5: a5.pid, a1u: a1.uid });
  await q(`insert into auth.users (id, email) values ($1, 'sinconfirmar@example.test')`, [crypto.randomUUID()]);
  await q(`update public.players set deleted_at = '2026-10-03T10:00:00Z', is_active = false, auth_user_id = null where player_id = $1`, [a5.pid]);
  const p1 = (await one(`insert into public.players (type, display_name, created_at) values ('provisional', 'Esteban Provisional', '2026-09-05T10:00:00Z') returning player_id`)).player_id;
  const p2 = (await one(`insert into public.players (type, display_name, created_at) values ('provisional', 'Lucia Provisional', '2026-09-05T10:00:00Z') returning player_id`)).player_id;
  await q(`update public.players set recovered_into_player_id = $2, recovered_at = '2026-09-25T10:00:00Z', is_active = false where player_id = $1`, [p2, a2.pid]);
  ids.p1 = p1;
  await q(`insert into public.locations (country_code, source, georef_province_id, georef_locality_id, province_label, locality_label, display_label, verified_for_ranking)
           values ('AR','georef','06','0600','Buenos Aires','Bella Vista','Bella Vista, Buenos Aires',true), ('AR','georef','06','0601','Buenos Aires','San Miguel','San Miguel, Buenos Aires',true)`);
  const bv = (await one(`select location_id from public.locations where locality_label = 'Bella Vista'`)).location_id;
  const sm = (await one(`select location_id from public.locations where locality_label = 'San Miguel'`)).location_id;
  await q(`update public.profiles set location_id = $2 where player_id in ($1, $3)`, [a1.pid, bv, a2.pid]);
  await q(`update public.profiles set location_id = $2 where player_id = $1`, [a3.pid, sm]);
  for (const a of [a1, a2, a3]) {
    await q(`insert into public.level_events (player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode, created_at)
             values ($1, 'initial_estimate', 'v1.3', 'q', 'full', $2::timestamptz + interval '5 minutes')`, [a.pid, a === a1 ? '2026-09-01T12:00:00Z' : a === a2 ? '2026-09-02T12:00:00Z' : '2026-09-10T12:00:00Z']);
  }
  ids.m1 = await mkMatch(a1.pid, 'validated', '2026-09-12T20:00:00Z', [a1.pid, a2.pid, a3.pid, p1], { validated: '2026-09-13T09:00:00Z' });
  ids.m2 = await mkMatch(a1.pid, 'pending_validation', '2026-09-30T20:00:00Z', [a1.pid, p1, null, null]);
  ids.m3 = await mkMatch(a2.pid, 'pending_validation', '2026-09-14T20:00:00Z', [a2.pid, p1, a3.pid, null], { deadline: '2026-09-20' });
  ids.m4 = await mkMatch(a2.pid, 'annulled', '2026-09-15T20:00:00Z', [a2.pid, p1, a3.pid, null], { annulled: '2026-09-15T21:00:00Z', reason: { kind: 'duplicate' } });
  ids.m5 = await mkMatch(a3.pid, 'annulled', '2026-09-16T20:00:00Z', [a3.pid, p1, a2.pid, null], { annulled: '2026-09-16T21:00:00Z', reason: { kind: 'author_retracted' } });
  ids.m6 = await mkMatch(a3.pid, 'annulled', '2026-09-17T20:00:00Z', [a3.pid, p1, a2.pid, null], { annulled: '2026-09-17T21:00:00Z', reason: { actorLabel: 'ops', reason: 'x' } });
  ids.m7 = await mkMatch(a1.pid, 'validated', '2026-10-02T20:00:00Z', [a1.pid, a3.pid, a2.pid, a4.pid], { validated: '2026-10-02T22:00:00Z' });
  await q(`insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at) values ($1,'created',$2,'2026-09-12T20:00:00Z'), ($1,'validated',$3,'2026-09-13T09:00:00Z'), ($1,'annulled',$2,'2026-09-20T00:00:00Z')`, [ids.m1, a1.pid, a2.pid]);
  await q(`insert into public.match_actions (match_id, action_type, actor_player_id, occurred_at, metadata) values ($1,'validated',$2,'2026-10-05T00:00:00Z','{"adminActorLabel":"ops"}')`, [ids.m6, a3.pid]);
  await q(`insert into public.groups (group_id, name, created_by_player_id, status, created_at) values ('00000000-0000-0000-0000-00000000e001','G1',$1,'active','2026-09-10T10:00:00Z'), ('00000000-0000-0000-0000-00000000e002','G2',$1,'active','2026-09-11T10:00:00Z')`, [a1.pid]);
  await q(`update public.groups set status='deleted', deleted_at='2026-09-30T10:00:00Z', deleted_by_player_id=$1 where group_id='00000000-0000-0000-0000-00000000e002'`, [a1.pid]);
  await q(`insert into public.group_memberships (group_id, player_id, is_admin, joined_at, left_at) values ('00000000-0000-0000-0000-00000000e001',$1,true,'2026-09-10T10:00:00Z',null), ('00000000-0000-0000-0000-00000000e001',$2,false,'2026-09-10T11:00:00Z',null), ('00000000-0000-0000-0000-00000000e001',$3,false,'2026-09-10T12:00:00Z','2026-09-20T00:00:00Z')`, [a1.pid, a2.pid, a3.pid]);
  await q(`insert into public.provisional_claims (provisional_player_id, token_hash, status, created_by_player_id, created_at, expires_at, claimed_at, claimed_by_player_id)
           values ($1,'h1','claimed',$2,'2026-09-06T10:00:00Z','2026-10-06','2026-09-25T10:00:00Z',$3), ($1,'h2','pending',$3,'2026-09-07T10:00:00Z','2026-09-20',null,null), ($1,'h3','pending',$2,'2026-10-06T10:00:00Z','2026-12-20',null,null)`, [p1, a1.pid, a2.pid]);
  const pres = [[a1, '2026-09-01'], [a1, '2026-09-02'], [a1, '2026-09-12'], [a1, '2026-10-02'], [a2, '2026-09-02'], [a2, '2026-09-09'], [a2, '2026-10-02'], [a3, '2026-09-10'], [a3, '2026-09-11'], [a4, '2026-09-20']];
  for (const [a, d] of pres) {
    await q(`insert into public.player_activity_days (player_id, activity_date, first_seen_at, last_seen_at, display_mode, platform, app_bundle)
             values ($1, $2::date, ($2::date + time '15:00') at time zone 'America/Argentina/Buenos_Aires', ($2::date + time '15:30') at time zone 'America/Argentina/Buenos_Aires', 'standalone', 'ios', '04.37-h28')`, [a.pid, d]);
  }
}

/* ---------------- Permisos ---------------- */

test('permisos: NADA de métricas es ejecutable por anon/authenticated/public ni legible por clientes (ACL strict, observed y open)', async () => {
  for (const [label, d] of [['strict', dbStrict], ['observed', db], ['open', dbOpen]]) {
    const fns = (await d.query(`select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) a from pg_proc p
                                 where p.pronamespace = 'public'::regnamespace and (p.proname like 'metrics\\_%' or p.proname like '\\_metrics\\_%')`)).rows;
    assert.ok(fns.length >= 25, `${label}: hay funciones de métricas (${fns.length})`);
    for (const f of fns) {
      for (const role of ['anon', 'authenticated']) {
        const ok = (await d.query(`select has_function_privilege($1, $2::oid, 'execute') as x`, [role, f.oid])).rows[0].x;
        assert.equal(ok, false, `${label}: ${role} NO ejecuta ${f.proname}(${f.a})`);
      }
    }
    const ex = (await d.query(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('metrics_users','metrics_matches','metrics_activation','metrics_community','metrics_usage','metrics_overview','metrics_is_admin')
                                and has_function_privilege('service_role', p.oid, 'execute')`)).rows.map((x) => x.proname).sort();
    assert.deepEqual(ex, ['metrics_activation', 'metrics_community', 'metrics_is_admin', 'metrics_matches', 'metrics_overview', 'metrics_usage', 'metrics_users'], `${label}: service_role ejecuta las 7 públicas`);
    for (const t of ['metrics_admins', 'metrics_internal_players']) {
      const p = (await d.query(`select has_table_privilege('anon', $1, 'select') a, has_table_privilege('authenticated', $1, 'select') b, has_table_privilege('authenticated', $1, 'insert') c,
                                       has_table_privilege('authenticated', $1, 'update') u, has_table_privilege('authenticated', $1, 'delete') x,
                                       has_table_privilege('service_role', $1, 'select') s,
                                       (select relrowsecurity from pg_class where oid = $1::regclass) rls, (select count(*) from pg_policies where tablename = $2) pol`, [`public.${t}`, t])).rows[0];
      assert.deepEqual([p.a, p.b, p.c, p.u, p.x], [false, false, false, false, false], `${label}: ${t} sin acceso de cliente`);
      assert.equal(p.s, true); assert.equal(p.rls, true); assert.equal(Number(p.pol), 0);
    }
  }
});

scenario('rol real authenticated/anon: no puede ejecutar ninguna sección ni leer metrics_admins', async () => {
  for (const role of ['authenticated', 'anon']) {
    for (const sql of [`select public.metrics_users('30d')`, `select public.metrics_overview('7d')`, `select public.metrics_is_admin('${crypto.randomUUID()}')`,
      'select * from public.metrics_admins', 'select * from public.metrics_internal_players', `select public._metrics_catalog()`]) {
      await db.exec('savepoint sp'); await db.exec(`set local role ${role}`);
      await assert.rejects(() => db.query(sql), /permission denied/i, `${role}: ${sql}`);
      await db.exec('rollback to savepoint sp');
    }
  }
});

/* ---------------- Administradores ---------------- */

scenario('metrics_is_admin: solo UUID listado y no revocado; nulo, ajeno o revocado => false', async () => {
  const admin = await mkAccount('adm', '2026-08-01T12:00:00Z');
  const other = await mkAccount('oth', '2026-08-01T12:00:00Z');
  const isAdmin = async (u) => (await one(`select public.metrics_is_admin($1) as r`, [u])).r;
  assert.equal(await isAdmin(admin.uid), false, 'sin fila');
  await q(`insert into public.metrics_admins (auth_user_id, label) values ($1, 'Test (Staging)')`, [admin.uid]);
  assert.equal(await isAdmin(admin.uid), true);
  assert.equal(await isAdmin(other.uid), false);
  assert.equal(await isAdmin(null), false);
  assert.equal(await isAdmin(crypto.randomUUID()), false);
  await q(`update public.metrics_admins set revoked_at = now() where auth_user_id = $1`, [admin.uid]);
  assert.equal(await isAdmin(admin.uid), false, 'revocado');
});

scenario('metrics_admins: eliminar el usuario de Auth borra la fila (cascade); no admite @usuario/email como identidad', async () => {
  const u = await mkAccount('adm2', '2026-08-01T12:00:00Z');
  await q(`insert into public.metrics_admins (auth_user_id, label) values ($1, 'x')`, [u.uid]);
  const cols = (await q(`select column_name from information_schema.columns where table_name = 'metrics_admins' order by 1`)).map((x) => x.column_name);
  assert.deepEqual(cols, ['auth_user_id', 'granted_at', 'label', 'revoked_at']);
  await q(`delete from auth.users where id = $1`, [u.uid]);
  assert.equal(Number((await one(`select count(*) c from public.metrics_admins`)).c), 0);
});

/* ---------------- Ventanas, catálogo, helpers ---------------- */

scenario('ventana BA (D8): Nd = N días COMPLETOS hasta ayer; previa de igual longitud también completa; all sin previa; rango inválido => error', async () => {
  const w = async (r) => (await one(`select public._metrics_window($1, $2::timestamptz) as w`, [r, ASOF])).w;
  const w7 = await w('7d');
  assert.equal(new Date(w7.from).toISOString(), '2026-10-01T03:00:00.000Z', '08/10 BA menos 7 días a medianoche BA (UTC-3)');
  assert.equal(new Date(w7.to).toISOString(), '2026-10-08T03:00:00.000Z', 'D8: la ventana termina a las 00:00 de HOY (BA), no en el instante de consulta');
  assert.equal(new Date(w7.prevFrom).toISOString(), '2026-09-24T03:00:00.000Z');
  assert.equal(new Date(w7.prevTo).toISOString(), new Date(w7.from).toISOString(), 'la previa termina donde empieza la actual');
  assert.equal(w7.granularity, 'day'); assert.equal((await w('90d')).granularity, 'week_ba');
  const all = await w('all');
  assert.equal(all.prevFrom, null);
  assert.equal(new Date(all.from).toISOString(), '2026-09-01T03:00:00.000Z', 'primer dato del fixture a medianoche BA');
  assert.equal(new Date(all.to).toISOString(), '2026-10-08T03:00:00.000Z');
  for (const r of ['7d', '30d', '90d']) {
    const x = await w(r);
    assert.equal(new Date(x.to) - new Date(x.from), new Date(x.prevTo) - new Date(x.prevFrom), `${r}: ambas ventanas miden lo mismo (días completos)`);
  }
  // el mismo día BA devuelve la misma ventana a cualquier hora (la actividad de hoy no la mueve)
  const early = (await one(`select public._metrics_window('30d', '2026-10-08T03:30:00Z') as w`)).w;
  const late = (await one(`select public._metrics_window('30d', '2026-10-09T02:59:00Z') as w`)).w;
  assert.deepEqual([early.from, early.to], [late.from, late.to]);
  for (const bad of ['1d', '', 'custom', "7d'; drop table players;--"]) {
    await db.exec('savepoint sp');
    await assert.rejects(() => db.query(`select public._metrics_window($1, $2::timestamptz)`, [bad, ASOF]), /invalid_range/);
    await db.exec('rollback to savepoint sp');
  }
  await assert.rejects(() => db.query(`select public.metrics_users('forever')`), /invalid_range/);
});

test('catálogo: JSON válido, ids únicos, todo KPI de cada sección existe en la salida y viceversa', async () => {
  const cat = (await one(`select public._metrics_catalog() as c`)).c;
  const idsCat = cat.map((e) => e.id);
  assert.equal(new Set(idsCat).size, idsCat.length);
  for (const e of cat) {
    assert.ok(e.label && e.definition && e.population, `${e.id} completo`);
    assert.ok(['stock', 'flow', 'ratio', 'duration'].includes(e.kind), `${e.id} tipo válido`);
    assert.ok(e.id.startsWith(`${e.section}.`));
  }
  for (const s of ['users', 'matches', 'activation', 'community', 'usage']) {
    const res = await call(`metrics_${s}`);
    assert.deepEqual(res.kpis.map((k) => k.id), cat.filter((e) => e.section === s).map((e) => e.id), `${s}: KPIs = catálogo, en orden`);
    for (const k of res.kpis) assert.deepEqual(Object.keys(k).sort(), ['availability', 'count', 'definition', 'delta', 'id', 'kind', 'label', 'n', 'population', 'previous', 'since', 'snapshot', 'value']);
  }
});

test('umbral k=5: segmentos chicos van a «Otros»; el residuo chico absorbe al visible más chico (no se resta del total); si no alcanza, todo oculto', async () => {
  const k = async (items) => (await one(`select public._metrics_apply_k($1::jsonb) as r`, [JSON.stringify(items)])).r;
  const L = (r) => r.items.map((i) => `${i.label}:${i.n}`);
  assert.deepEqual(L(await k([{ label: 'A', n: 7 }, { label: 'B', n: 3 }, { label: 'C', n: 1 }])), ['Otros (n<5):11'], 'residuo 4 => absorbe A');
  assert.deepEqual(L(await k([{ label: 'A', n: 9 }, { label: 'B', n: 6 }, { label: 'C', n: 2 }])), ['A:9', 'Otros (n<5):8']);
  assert.deepEqual(L(await k([{ label: 'A', n: 2 }, { label: 'B', n: 3 }])), ['Otros (n<5):5']);
  assert.deepEqual(L(await k([{ label: 'A', n: 5 }])), ['A:5']);
  assert.deepEqual(L(await k([{ label: 'A', n: 8 }, { label: 'B', n: 5 }, { label: 'C', n: 5 }])), ['A:8', 'B:5', 'C:5']);
  const hidden = await k([{ label: 'A', n: 3 }]);
  assert.equal(hidden.suppressed, true); assert.deepEqual(hidden.items, []);
  assert.equal((await k([])).suppressed, false);
  // propiedad: ningún segmento mostrado < 5 y la suma mostrada nunca revela un residuo < 5
  for (let t = 0; t < 200; t += 1) {
    const items = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, (_, i) => ({ label: `S${i}`, n: 1 + Math.floor(Math.random() * 12) }));
    const r = await k(items); const total = items.reduce((a, b) => a + b.n, 0);
    assert.ok(r.items.every((i) => i.n >= 5), JSON.stringify([items, r]));
    if (!r.suppressed) assert.equal(r.items.reduce((a, b) => a + b.n, 0), total, 'sin pérdida cuando no se oculta');
    else assert.ok(total < 5);
  }
});

test('comparación: flujo con base previa (abs y %), base cero => sin porcentaje, stock sin comparación, ratio en puntos, muestra insuficiente y compare=false', async () => {
  const entry = (kind, minN) => ({ id: 'x.k', section: 'x', label: 'L', kind, definition: 'D', population: 'P', ...(minN ? { minN } : {}) });
  const run = async (e, cur, prev, cmp = true) => (await one(`select public._metrics_kpi($1::jsonb, $2::jsonb, $3::jsonb, $4) as r`, [JSON.stringify(e), JSON.stringify({ 'x.k': cur }), JSON.stringify(prev ? { 'x.k': prev } : null), cmp])).r;
  let r = await run(entry('flow'), { v: 10 }, { v: 5 });
  assert.deepEqual([r.delta.abs, r.delta.pct, r.availability], [5, 100, 'ok']);
  r = await run(entry('flow'), { v: 4 }, { v: 0 });
  assert.deepEqual([r.delta.abs, r.delta.pct, r.delta.note], [4, null, 'base_previa_cero']);
  r = await run(entry('flow'), { v: 0 }, { v: 0 });
  assert.equal(r.availability, 'no_evidence'); assert.equal(r.value, 0);
  r = await run(entry('stock'), { v: 4, n: 4 }, { v: 3, n: 3 });
  assert.deepEqual([r.delta.abs, r.delta.pct, r.delta.note], [null, null, 'stock_sin_comparacion']);
  r = await run(entry('ratio', 5), { v: 0.6, n: 10 }, { v: 0.4, n: 10 });
  assert.deepEqual([r.delta.abs, r.delta.pct, r.delta.note], [20, null, 'puntos_porcentuales']);
  r = await run(entry('ratio', 5), { v: 0.6, n: 3 }, { v: 0.4, n: 10 });
  assert.deepEqual([r.availability, r.value, r.delta.note], ['insufficient_sample', null, 'sin_datos_suficientes']);
  r = await run(entry('ratio', 5), { v: 0.6, n: 10 }, { v: 0.4, n: 2 });
  assert.deepEqual([r.availability, r.previous.value, r.delta.note], ['ok', null, 'sin_datos_suficientes']);
  r = await run(entry('flow'), { v: 10 }, { v: 5 }, false);
  assert.deepEqual([r.previous, r.delta.note], [null, 'sin_comparacion']);
  r = await run(entry('flow'), { v: null, a: 'not_instrumented', since: '2026-10-12' }, { v: null, a: 'not_instrumented' });
  assert.deepEqual([r.availability, r.value, r.since], ['not_instrumented', null, '2026-10-12']);
});

/* ---------------- Valores sobre el fixture (Apéndice B) ---------------- */

test('Usuarios: cuentas actuales sin la eliminada, altas brutas, invitados sin el recuperado, ratios con muestra insuficiente y localidad suprimida por k', async () => {
  const r = await call('metrics_users', '90d');
  assert.equal(kpi(r, 'users.registered_now').value, 4);
  assert.equal(kpi(r, 'users.signups').value, 5, 'altas brutas: incluye la cuenta luego eliminada');
  assert.equal(kpi(r, 'users.guests_open').value, 1, 'el provisional recuperado no es invitado');
  assert.equal(kpi(r, 'users.profile_complete').value, 4);
  const loc = kpi(r, 'users.with_location_rate');
  assert.equal(loc.availability, 'insufficient_sample'); assert.equal(loc.value, null); assert.equal(loc.count, null, 'el numerador tampoco se expone con muestra insuficiente'); assert.equal(loc.n, 4);
  assert.deepEqual(r.breakdowns.location, { items: [], suppressed: true, minCell: 5 }, 'con 4 cuentas nada se desglosa por localidad');
  assert.equal(r.meta.environment, 'staging'); assert.equal(r.meta.compare, true); assert.equal(r.meta.minCell, 5);
  assert.equal(kpi(r, 'users.signups').previous.value, 0);
  assert.equal(kpi(r, 'users.signups').delta.note, 'base_previa_cero');
  const sig = r.series.signups;
  assert.equal(sig.granularity, 'week_ba');
  assert.equal(sig.current.reduce((a, b) => a + b.value, 0), 5);
  assert.deepEqual(sig.current.filter((b) => b.value > 0).map((b) => [b.start, b.value]), [['2026-08-31', 2], ['2026-09-07', 1], ['2026-09-14', 1], ['2026-09-28', 1]]);
});

test('Partidos: estados con vencido derivado y anulaciones NULL-safe, partidos de 1 cuenta aparte, tiempos y únicos', async () => {
  const r = await call('metrics_matches', '90d');
  assert.equal(kpi(r, 'matches.created').value, 7);
  assert.equal(kpi(r, 'matches.real').value, 4, 'no anulados (la anulación administrativa NO se pierde por NULL)');
  assert.equal(kpi(r, 'matches.annulled').value, 3);
  assert.equal(kpi(r, 'matches.validated').value, 2);
  assert.equal(kpi(r, 'matches.pending_validable').value, 0);
  assert.equal(kpi(r, 'matches.pending_waiting_counterpart').value, 1, 'm2: una pareja sin cuentas no se valida sola');
  assert.equal(kpi(r, 'matches.expired_derived').value, 1, 'm3: pending con plazo vencido; el status no es expired');
  assert.equal((await one(`select count(*)::int c from public.matches where status = 'expired'`)).c, 0);
  assert.deepEqual(r.breakdowns.status.items.map((i) => `${i.label}:${i.n}`), ['annulled_admin:1', 'annulled_author_retracted:1', 'annulled_duplicate:1', 'expired_derived:1', 'pending:1', 'validated:2']);
  assert.equal(r.breakdowns.status.items.reduce((a, b) => a + b.n, 0), kpi(r, 'matches.created').value, 'los buckets suman el total creado');
  assert.equal(kpi(r, 'matches.authors').value, 2);
  assert.equal(kpi(r, 'matches.registered_participants').value, 4, 'los provisionales no cuentan como cuentas');
  const p50 = kpi(r, 'matches.validation_p50_hours');
  assert.equal(p50.availability, 'insufficient_sample'); assert.equal(p50.value, null); assert.equal(p50.n, 2);
  const rate = kpi(r, 'matches.validation_rate_closed');
  assert.deepEqual([rate.count, rate.n, rate.availability], [null, 3, 'insufficient_sample']);
  assert.deepEqual(r.series.created.current.filter((b) => b.value).map((b) => [b.start, b.value]), [['2026-09-07', 1], ['2026-09-14', 4], ['2026-09-28', 2]]);
  const played = r.series.played.current.filter((b) => b.value).map((b) => [b.start, b.value]);
  assert.deepEqual(played, [['2026-09-07', 1], ['2026-09-14', 1], ['2026-09-28', 2]], 'jugados excluye anulados');
});

test('Activación: embudo sobre cohorte madura; carga vs participación separadas; retorno por acción (sin acciones admin ni anulaciones)', async () => {
  const r = await call('metrics_activation', '90d');
  assert.equal(kpi(r, 'activation.cohort').value, 5);
  assert.equal(kpi(r, 'activation.cohort_immature').value, 0);
  const v = (id) => [kpi(r, id).count, kpi(r, id).value];
  assert.deepEqual(v('activation.level_initial'), [3, 0.6]);
  assert.deepEqual(v('activation.loaded_first'), [2, 0.4]);
  assert.deepEqual(v('activation.participated_first'), [4, 0.8]);
  assert.deepEqual(v('activation.participated_validated'), [4, 0.8]);
  assert.deepEqual(v('activation.third_match'), [3, 0.6]);
  assert.deepEqual(v('activation.fifth_match'), [0, 0]);
  assert.deepEqual(v('activation.returned_other_week'), [2, 0.4]);
  assert.equal(kpi(r, 'activation.median_days_to_first_load').availability, 'insufficient_sample');
});

scenario('Activación: las altas con menos de 7 días quedan fuera de los porcentajes (cohorte inmadura)', async () => {
  await mkAccount('fresh', '2026-10-06T12:00:00Z');
  const r = await call('metrics_activation', '90d');
  assert.equal(kpi(r, 'activation.cohort').value, 5);
  assert.equal(kpi(r, 'activation.cohort_immature').value, 1);
});

test('Comunidad: grupos vigentes vs creados, membresías vigentes, invitaciones con vencimiento derivado y Nivel suprimido por k', async () => {
  const r = await call('metrics_community', '90d');
  assert.equal(kpi(r, 'community.groups_active').value, 1);
  assert.equal(kpi(r, 'community.groups_created').value, 2);
  assert.equal(kpi(r, 'community.memberships_active').value, 2, 'a3 salió del grupo');
  assert.equal(kpi(r, 'community.invites_created').value, 3);
  assert.equal(kpi(r, 'community.invites_claimed').value, 1);
  assert.equal(kpi(r, 'community.invites_open').value, 1);
  assert.equal(kpi(r, 'community.invites_expired').value, 1, 'pending con expires_at pasado: derivado');
  assert.equal(kpi(r, 'community.invite_conversion').availability, 'insufficient_sample');
  assert.deepEqual(r.breakdowns.level_status, { items: [], suppressed: true, minCell: 5 });
});

test('Uso con presencia: DAU/WAU/MAU móviles al corte, promedio, instalada, acciones retroactivas y retención solo con cohortes maduras', async () => {
  const r = await call('metrics_usage', '90d');
  const val = (id) => kpi(r, id).value;
  assert.deepEqual([val('usage.dau'), val('usage.wau'), val('usage.mau')], [0, 2, 4]);
  assert.equal(kpi(r, 'usage.dau').availability, 'ok', 'cero con presencia instrumentada es un cero real');
  assert.equal(val('usage.standalone_share'), 1);
  assert.equal(val('usage.dau_avg'), 0.27, '10 días de presencia / 37 días completos desde el 01/09 hasta AYER');
  assert.equal(kpi(r, 'usage.dau_avg').since, '2026-09-01', 'la ventana arranca antes de la presencia: cobertura parcial rotulada');
  assert.deepEqual([val('usage.wau_with_action'), val('usage.mau_with_action')], [0, 3]);
  assert.deepEqual([kpi(r, 'usage.ret_d1').count, kpi(r, 'usage.ret_d1').n, val('usage.ret_d1')], [2, 5, 0.4]);
  assert.deepEqual([kpi(r, 'usage.ret_d7').count, kpi(r, 'usage.ret_d7').n, kpi(r, 'usage.ret_d7').availability], [null, 4, 'insufficient_sample']);
  assert.deepEqual([kpi(r, 'usage.ret_w1').count, kpi(r, 'usage.ret_w1').n, kpi(r, 'usage.ret_w1').availability], [null, 4, 'insufficient_sample']);
  assert.deepEqual([kpi(r, 'usage.ret_w4').count, kpi(r, 'usage.ret_w4').n, kpi(r, 'usage.ret_w4').availability], [null, 2, 'insufficient_sample']);
  assert.deepEqual(r.breakdowns.platform, { items: [], suppressed: true, minCell: 5 });
  assert.deepEqual(r.series.active_players.current.reduce((a, b) => a + b.value, 0) > 0, true);
});

scenario('Uso sin presencia: todo not_instrumented (nunca 0 engañoso) pero las acciones retroactivas siguen midiéndose', async () => {
  await q('delete from public.player_activity_days');
  const r = await call('metrics_usage', '30d');
  for (const id of ['usage.dau', 'usage.wau', 'usage.mau', 'usage.dau_avg', 'usage.standalone_share', 'usage.ret_w1', 'usage.ret_d1']) {
    const k = kpi(r, id); assert.equal(k.availability, 'not_instrumented', id); assert.equal(k.value, null, id);
  }
  assert.equal(kpi(r, 'usage.mau_with_action').availability, 'ok');
  assert.equal(r.meta.presenceSince, null);
});

scenario('Uso con presencia reciente: cobertura parcial rotulada con «desde» y ventana anterior sin datos => not_instrumented', async () => {
  await q('delete from public.player_activity_days');
  await q(`insert into public.player_activity_days (player_id, activity_date, display_mode, platform, first_seen_at, last_seen_at) values ($1, '2026-10-06', 'browser', 'android', '2026-10-06T15:00:00Z', '2026-10-06T15:00:00Z'), ($2, '2026-10-07', 'browser', 'ios', '2026-10-07T15:00:00Z', '2026-10-07T15:00:00Z'), ($3, '2026-10-08', 'browser', 'ios', '2026-10-08T09:30:00Z', '2026-10-08T09:30:00Z')`, [ids.a1, ids.a2, ids.a3]);
  const r = await call('metrics_usage', '30d');
  assert.equal(kpi(r, 'usage.mau').value, 2, 'D8: la presencia de HOY (a3) no entra en MAU'); assert.equal(kpi(r, 'usage.mau').since, '2026-10-06');
  assert.deepEqual([r.today.date, r.today.partial, r.today.activePlayers, r.today.activePlayersAvailability], ['2026-10-08', true, 1, 'ok'], 'hoy se informa aparte, rotulado parcial');
  assert.equal(kpi(r, 'usage.mau').previous.availability, 'not_instrumented', 'el período anterior es previo a la presencia');
  assert.equal(kpi(r, 'usage.mau').delta.note, 'sin_datos_suficientes');
  assert.equal(kpi(r, 'usage.standalone_share').availability, 'insufficient_sample');
});

test('Inicio: KPIs ancla y embudo salen del mismo catálogo; series de usuarios, partidos y activos', async () => {
  const r = await call('metrics_overview', '30d');
  assert.deepEqual(r.kpis.map((k) => k.id), ['users.registered_now', 'users.signups', 'usage.wau', 'matches.created', 'matches.validated', 'community.groups_active']);
  assert.deepEqual(r.funnel.map((k) => k.id), ['activation.cohort', 'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.third_match', 'activation.fifth_match']);
  assert.deepEqual(Object.keys(r.series).sort(), ['active_players', 'matches_created', 'signups']);
  assert.equal(r.series.signups.granularity, 'day');
  const direct = await call('metrics_matches', '30d');
  assert.equal(kpi(r, 'matches.created').value, kpi(direct, 'matches.created').value, 'misma definición que la sección');
});

/* ---------------- Concordancia contra consultas independientes (Apéndice A) ---------------- */

test('concordancia: en ventanas de 7/30/90 días cada KPI directo coincide con la consulta cruda independiente sobre la misma ventana [from,to)', async () => {
  for (const range of ['7d', '30d', '90d']) {
    const users = await call('metrics_users', range); const matches = await call('metrics_matches', range);
    const [from, to] = matches.meta.window;
    const o = await one(`select
        (select count(*)::int from public.players where type='registered' and created_at >= $1 and created_at < $2) signups,
        (select count(*)::int from public.matches where created_at >= $1 and created_at < $2) created,
        (select count(*)::int from public.matches where created_at >= $1 and created_at < $2 and status <> 'annulled') real,
        (select count(*)::int from public.matches where status='validated' and validated_at >= $1 and validated_at < $2) validated,
        (select count(distinct created_by_player_id)::int from public.matches where created_at >= $1 and created_at < $2 and status <> 'annulled') authors`, [from, to]);
    assert.equal(kpi(users, 'users.signups').value, o.signups, `${range} altas`);
    assert.equal(kpi(matches, 'matches.created').value, o.created, `${range} cargados`);
    assert.equal(kpi(matches, 'matches.real').value, o.real, `${range} reales`);
    assert.equal(kpi(matches, 'matches.validated').value, o.validated, `${range} validados`);
    assert.equal(kpi(matches, 'matches.authors').value, o.authors, `${range} autores`);
    const buckets = matches.breakdowns.status.items.reduce((a, b) => a + b.n, 0);
    assert.equal(buckets, o.created, `${range} buckets = creados`);
    const sumSeries = (s) => s.current.reduce((a, b) => a + b.value, 0);
    assert.equal(sumSeries(matches.series.created), o.created, `${range} serie creados`);
    assert.equal(sumSeries(users.series.signups), o.signups, `${range} serie altas`);
  }
  // la ventana previa de 30d también concuerda
  const m30 = await call('metrics_matches', '30d');
  const [pf, pt] = m30.meta.previousWindow;
  const prevCreated = (await one(`select count(*)::int c from public.matches where created_at >= $1 and created_at < $2`, [pf, pt])).c;
  assert.equal(kpi(m30, 'matches.created').previous.value, prevCreated);
});

/* ---------------- Cuentas internas ---------------- */

scenario('cuentas internas: se excluyen por defecto (jugadores y partidos que cargaron) y el interruptor las incluye; meta lo informa', async () => {
  const base = await call('metrics_users', '90d'); const baseM = await call('metrics_matches', '90d');
  await q(`insert into public.metrics_internal_players (player_id, reason) values ($1, 'owner')`, [ids.a2]);
  const ex = await call('metrics_users', '90d'); const exM = await call('metrics_matches', '90d');
  assert.equal(kpi(ex, 'users.registered_now').value, kpi(base, 'users.registered_now').value - 1);
  assert.equal(kpi(ex, 'users.signups').value, 4);
  assert.equal(ex.meta.internalExcluded, 1); assert.equal(ex.meta.includeInternal, false);
  assert.equal(kpi(exM, 'matches.created').value, kpi(baseM, 'matches.created').value - 2, 'm3 y m4 las cargó a2');
  const inc = await call('metrics_users', '90d', { internal: true });
  assert.equal(kpi(inc, 'users.registered_now').value, kpi(base, 'users.registered_now').value);
  assert.equal(inc.meta.internalExcluded, 0); assert.equal(inc.meta.includeInternal, true);
  assert.equal(kpi(await call('metrics_matches', '90d', { internal: true }), 'matches.created').value, kpi(baseM, 'matches.created').value);
  const act = await call('metrics_activation', '90d');
  assert.equal(kpi(act, 'activation.cohort').value, 4);
});

/* ---------------- Privacidad: no fuga ---------------- */

test('no fuga: ninguna salida contiene UUID, emails, @usuario ni nombres (todas las secciones y rangos, con y sin internas)', async () => {
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const s of SECTIONS) {
    for (const range of ['7d', '30d', '90d', 'all']) {
      for (const internal of [false, true]) {
        const txt = JSON.stringify(await call(`metrics_${s}`, range, { internal }));
        assert.ok(!uuid.test(txt), `${s}/${range}: sin UUID`);
        assert.ok(!/[A-Za-z0-9._-]+@[A-Za-z0-9-]+/.test(txt), `${s}/${range}: sin emails`);
        assert.ok(!/example\.test|Nombre a|user_a|Esteban|Lucia|Snapshot/.test(txt), `${s}/${range}: sin nombres/usernames/emails del fixture`);
        assert.ok(txt.length < 60000, `${s}/${range}: respuesta acotada (${txt.length})`);
      }
    }
  }
});

test('comparación apagada o rango all: sin previous y meta.compare=false', async () => {
  const off = await call('metrics_users', '30d', { compare: false });
  assert.equal(off.meta.compare, false); assert.equal(kpi(off, 'users.signups').previous, null); assert.equal(off.series.signups.previous, null);
  const all = await call('metrics_users', 'all');
  assert.equal(all.meta.compare, false); assert.equal(all.meta.previousWindow, null);
});

test('solo lectura: ninguna función de métricas es VOLATILE (todas stable/immutable) y ninguna escribe', async () => {
  const rows = (await db.query(`select proname, provolatile from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'metrics\\_%' or proname like '\\_metrics\\_%')`)).rows;
  assert.ok(rows.length > 20);
  assert.deepEqual(rows.filter((r) => r.provolatile === 'v').map((r) => r.proname), []);
});

scenario('rol real service_role (el de la Edge Function): ejecuta las 7 públicas y NO los helpers internos', async () => {
  await db.exec('set local role service_role');
  try {
    for (const s of SECTIONS) {
      const r = (await db.query(`select public.metrics_${s}('7d', true, false, $1::timestamptz) as r`, [ASOF])).rows[0].r;
      assert.equal(r.ok, true, s);
    }
    assert.equal((await db.query(`select public.metrics_is_admin($1) as r`, [crypto.randomUUID()])).rows[0].r, false);
    await db.exec('savepoint sp');
    await assert.rejects(() => db.query(`select public._metrics_catalog()`), /permission denied/i);
    await db.exec('rollback to savepoint sp');
  } finally { await db.exec('reset role'); }
});


/* ====================================================================== */
/* F4 — D8 (días completos), «hoy parcial», snapshots y Comunidad          */
/* (migración 20261008120000_metrics_f4_d8_comunidad.sql)                  */
/* ====================================================================== */

const dayCount = (res, key = 'signups') => res.series[key].current.reduce((a, b) => a + b.value, 0);

scenario('D8: lo que ocurre HOY no entra en flujos, series ni comparaciones; se informa aparte en `today` y no cambia la ventana durante el día', async () => {
  const before = await call('metrics_matches', '7d');
  const beforeU = await call('metrics_users', '7d');
  const hoy = await mkAccount('hoy', '2026-10-08T10:00:00Z');
  await mkMatch(hoy.pid, 'pending_validation', '2026-10-08T10:30:00Z', [hoy.pid, ids.a1, null, null]);
  const after = await call('metrics_matches', '7d'); const afterU = await call('metrics_users', '7d');
  assert.equal(kpi(after, 'matches.created').value, kpi(before, 'matches.created').value, 'el partido de hoy no suma al período');
  assert.equal(kpi(afterU, 'users.signups').value, kpi(beforeU, 'users.signups').value, 'ni el alta de hoy');
  assert.equal(dayCount(after, 'created'), dayCount(before, 'created'));
  const lastBucket = after.series.created.current.at(-1).start;
  assert.equal(lastBucket, '2026-10-07', 'la serie termina AYER (día completo)');
  assert.equal(after.today.matchesCreated, 1); assert.equal(afterU.today.signups, 1); assert.equal(after.today.partial, true);
  assert.equal(kpi(afterU, 'users.registered_now').value, kpi(beforeU, 'users.registered_now').value + 1, 'el saldo al corte SÍ incluye hoy (es estado, no flujo)');
  // la ventana actual/previa y sus valores no dependen de la hora del día
  const a = await call('metrics_matches', '30d', { asof: '2026-10-08T03:10:00Z' }); const b = await call('metrics_matches', '30d', { asof: '2026-10-09T02:50:00Z' });
  assert.deepEqual(a.meta.window, b.meta.window);
  for (const id of ['matches.created', 'matches.real', 'matches.validated']) assert.equal(kpi(a, id).value, kpi(b, id).value, id);
  // inicio y todas las secciones traen `today` y meta lo declara
  for (const sName of SECTIONS) { const r = await call(`metrics_${sName}`, '7d'); assert.ok(r.today && r.today.partial === true, sName); assert.equal(r.meta.completeDaysOnly, true); if (sName !== 'overview') assert.equal(r.meta.today, '2026-10-08'); }
});

scenario('D8: «hoy» respeta cuentas internas y la presencia no instrumentada devuelve null (nunca 0 engañoso)', async () => {
  const hoy = await mkAccount('hoy2', '2026-10-08T10:00:00Z');
  await q(`insert into public.metrics_internal_players (player_id, reason) values ($1, 'owner')`, [hoy.pid]);
  assert.equal((await call('metrics_users', '7d')).today.signups, 0, 'interna excluida');
  assert.equal((await call('metrics_users', '7d', { internal: true })).today.signups, 1);
  await q('delete from public.player_activity_days');
  const t = (await call('metrics_usage', '7d')).today;
  assert.deepEqual([t.activePlayers, t.activePlayersAvailability], [null, 'not_instrumented']);
});

test('snapshot: los ratios que son foto del estado actual no se comparan (antes mostraban «Sin cambios» falsos) y no exponen «anterior»', async () => {
  const u = await call('metrics_users', '30d');
  for (const id of ['users.profile_complete_rate', 'users.with_location_rate']) {
    const k = kpi(u, id); assert.equal(k.snapshot, true, id); assert.equal(k.previous, null, id); assert.equal(k.delta.note, 'stock_sin_comparacion', id);
  }
  assert.equal(kpi(u, 'users.signups').snapshot, false);
  const c = await call('metrics_community', '30d');
  for (const id of ['community.level_calibrated_share', 'community.ranking_eligibility_rate']) assert.equal(kpi(c, id).snapshot, true, id);
  const off = await call('metrics_users', '30d', { compare: false });
  assert.equal(kpi(off, 'users.profile_complete_rate').delta.note, 'sin_comparacion');
});

scenario('Comunidad · Grupos: grupos con partido calificable (criterio de Grupos BRAMU), tamaño medio solo con ≥ 5 grupos y desglose por tamaño con k', async () => {
  // m1 (validado, 12/09, a1+a2+a3 miembros del grupo e001) pasa a ser calificable
  await q(`update public.matches set winner_team = 'A', current_revision_id = gen_random_uuid() where match_id = $1`, [ids.m1]);
  let r = await call('metrics_community', '90d');
  assert.equal(kpi(r, 'community.groups_with_match').value, 1);
  assert.equal(kpi(await call('metrics_community', '7d'), 'community.groups_with_match').value, 0, 'el partido es de septiembre');
  let avg = kpi(r, 'community.groups_avg_members');
  assert.deepEqual([avg.availability, avg.value, avg.n], ['insufficient_sample', null, 1], 'con 1 solo grupo no se expone el promedio');
  assert.deepEqual(r.breakdowns.group_size.items, [], 'un grupo (< 5) no se desglosa');
  // 4 grupos más con 3 integrantes: 5 grupos => promedio visible
  for (let i = 3; i <= 6; i += 1) {
    const g = (await one(`insert into public.groups (name, created_by_player_id, status, created_at) values ($1, $2, 'active', '2026-09-20T10:00:00Z') returning group_id`, [`G${i}`, ids.a1])).group_id;
    for (const pid of [ids.a1, ids.a2, ids.a4]) await q(`insert into public.group_memberships (group_id, player_id, joined_at) values ($1, $2, '2026-09-20T10:00:00Z')`, [g, pid]);
  }
  r = await call('metrics_community', '90d');
  avg = kpi(r, 'community.groups_avg_members');
  assert.deepEqual([avg.availability, avg.value, avg.n], ['ok', 2.8, 5], '(2 + 4×3) / 5');
  assert.deepEqual(r.breakdowns.group_size.items.map((i) => `${i.label}:${i.n}`), ['size_2_3:5']);
  assert.equal(kpi(r, 'community.groups_active').value, 5);
  assert.equal(dayCount(r, 'groups_created') > 0, true);
  assert.equal(dayCount(r, 'groups_created'), kpi(r, 'community.groups_created').value, 'la serie suma el KPI');
  assert.equal(dayCount(r, 'invites_created'), kpi(r, 'community.invites_created').value, 'ídem invitaciones');
});

scenario('Comunidad · Nivel: % calibrado sobre quienes ya iniciaron su Nivel, con muestra mínima; estados desglosados con k', async () => {
  const accts = [];
  for (let i = 0; i < 5; i += 1) accts.push(await mkAccount(`lv${i}`, '2026-09-03T12:00:00Z'));
  let r = await call('metrics_community', '90d');
  assert.equal(kpi(r, 'community.level_calibrated_share').availability, 'insufficient_sample', 'todos PENDIENTE: sin base');
  const set = async (pid, st) => q(`update public.level_states set status = $2 where player_id = $1`, [pid, st]);
  for (let i = 0; i < 5; i += 1) await set(accts[i].pid, i < 2 ? 'CALIBRADO' : 'CALIBRANDO');
  await set(ids.a1, 'RECALIBRANDO');
  r = await call('metrics_community', '90d');
  const k = kpi(r, 'community.level_calibrated_share');
  assert.deepEqual([k.count, k.n, k.value, k.availability, k.previous, k.snapshot], [2, 6, 0.3333, 'ok', null, true]);
  assert.deepEqual(r.breakdowns.level_status.items.map((i) => `${i.label}:${i.n}`), ['Otros (n<5):9'], 'CALIBRADO 2 + CALIBRANDO 3 + RECALIBRANDO 1 + PENDIENTE 3: todos < 5 => un solo «Otros»');
  for (const it of r.breakdowns.level_status.items) assert.ok(it.n >= 5 || /^Otros/.test(it.label), 'ningún segmento < 5 sin agrupar');
});

async function mkEdition(publishedAt, rows) {
  const e = (await one(`insert into public.ranking_editions (period_start_at, period_end_at, published_at) values ($1::timestamptz - interval '7 days', $1::timestamptz - interval '1 second', $1) returning edition_id`, [publishedAt])).edition_id;
  for (const r of rows) {
    await q(`insert into public.ranking_rows (edition_id, player_id, scope_type, scope_key, is_eligible, total_eligible, density_status, level_status, level_band, ranking_rules_version, eligibility_reason_codes)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ranking_v1', $10::jsonb)`,
    [e, r.pid, r.scope || 'global', r.key || 'GLOBAL', r.elig !== false, r.total ?? 1, r.density || 'forming', r.status || 'CALIBRADO', r.band ?? 5, r.elig === false ? '["no_opt_in"]' : '[]']);
  }
  return e;
}

scenario('Comunidad · Ranking: sin ediciones => «sin registros» (no 0); con edición: antigüedad, elegibles, tasa sobre cuentas actuales y universos por densidad', async () => {
  let r = await call('metrics_community', '90d');
  for (const id of ['community.ranking_days_since_edition', 'community.ranking_eligible_players', 'community.ranking_eligibility_rate']) {
    const k = kpi(r, id); assert.equal(k.availability, 'no_evidence', id); assert.equal(k.value, null, id);
  }
  assert.deepEqual(r.breakdowns.ranking_density, { items: [], suppressed: false, unit: 'universes' });
  const six = []; for (let i = 0; i < 5; i += 1) six.push(await mkAccount(`rk${i}`, '2026-09-04T12:00:00Z'));
  const all = [ids.a1, ids.a2, ids.a3, ids.a4, ...six.map((x) => x.pid)];
  await mkEdition('2026-10-05T15:00:00Z', [
    ...all.slice(0, 6).map((pid) => ({ pid, band: 4 })),
    { pid: all[6], elig: false, status: 'CALIBRANDO', band: null }, { pid: all[0], scope: 'local', key: 'loc-1', density: 'forming' }, { pid: all[1], scope: 'local', key: 'loc-1', density: 'forming' },
    { pid: all[2], scope: 'local', key: 'loc-2', density: 'insufficient' }, { pid: all[3], scope: 'local', key: 'loc-3', density: 'established' },
  ]);
  r = await call('metrics_community', '90d');
  assert.equal(kpi(r, 'community.ranking_days_since_edition').value, 3, '08/10 − 05/10');
  assert.equal(kpi(r, 'community.ranking_eligible_players').value, 6);
  const rate = kpi(r, 'community.ranking_eligibility_rate');
  assert.deepEqual([rate.count, rate.n, rate.availability, rate.previous], [6, 9, 'ok', null], '6 elegibles / 9 cuentas actuales');
  assert.deepEqual(r.breakdowns.ranking_density.items.map((i) => `${i.label}:${i.n}`), ['established:1', 'forming:1', 'insufficient:1'], 'cuenta UNIVERSOS, no personas');
  // distribución de Nivel: 6 calibrados (< 10) => oculta entera, aunque haya bandas con ≥ 5
  assert.deepEqual(r.breakdowns.level_band, { items: [], suppressed: true, minCell: 10 });
  assert.equal(kpi(r, 'community.ranking_editions').value, 1);
});

scenario('Comunidad · distribución de Nivel por banda: solo con ≥ 10 calibrados y cada banda con ≥ 5 (si no, «Otros»)', async () => {
  const pl = []; for (let i = 0; i < 12; i += 1) pl.push(await mkAccount(`bd${i}`, '2026-09-04T12:00:00Z'));
  await mkEdition('2026-10-05T15:00:00Z', pl.map((x, i) => ({ pid: x.pid, band: i < 7 ? 4 : i < 10 ? 5 : 6 })));
  const r = await call('metrics_community', '90d');
  assert.deepEqual(r.breakdowns.level_band.items.map((i) => `${i.label}:${i.n}`), ['band_4:7', 'Otros (n<5):5'], 'bandas 5 (3) y 6 (2) suman 5 => un solo «Otros»');
  assert.equal(r.breakdowns.level_band.minCell, 5);
  const txt = JSON.stringify(r);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(txt), 'sin UUID');
  await q(`insert into public.metrics_internal_players (player_id, reason) select player_id, 'test' from public.players where display_name like 'Nombre bd%' limit 4`);
  const ex = await call('metrics_community', '90d');
  assert.equal(ex.breakdowns.level_band.suppressed, true, 'excluidas las internas quedan 8 (< 10)');
});

test('F4 — permisos: las funciones nuevas (`_metrics_today`, `_metrics_community_breakdowns`) y las reemplazadas siguen sin acceso de clientes ', async () => {
  for (const [label, d] of [['strict', dbStrict], ['observed', db], ['open', dbOpen]]) {
    for (const fn of ['_metrics_today', '_metrics_community_breakdowns', '_metrics_window', '_metrics_community_core', '_metrics_run', '_metrics_catalog', 'metrics_overview', 'metrics_community']) {
      const rows = (await d.query(`select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1`, [fn])).rows;
      assert.ok(rows.length >= 1, `${label}: ${fn} existe`);
      for (const { oid } of rows) for (const role of ['anon', 'authenticated']) {
        assert.equal((await d.query(`select has_function_privilege($1, $2::oid, 'execute') x`, [role, oid])).rows[0].x, false, `${label}: ${role} NO ejecuta ${fn}`);
      }
    }
  }
});

test('F4 — catálogo: +6 KPIs community.* (ruteo de detalle sin cambios en el cliente), todos con definición y los ratios snapshot con muestra mínima', async () => {
  const cat = (await one(`select public._metrics_catalog() as c`)).c;
  const comm = cat.filter((e) => e.section === 'community').map((e) => e.id);
  assert.equal(cat.length, 55);
  assert.deepEqual(comm.slice(-6), ['community.groups_with_match', 'community.groups_avg_members', 'community.level_calibrated_share', 'community.ranking_days_since_edition', 'community.ranking_eligible_players', 'community.ranking_eligibility_rate']);
  for (const e of cat.filter((x) => x.snapshot)) { assert.equal(e.kind, 'ratio', e.id); assert.ok(e.minN >= 5, e.id); }
  assert.deepEqual(cat.filter((x) => x.snapshot).map((x) => x.id).sort(), ['community.level_calibrated_share', 'community.ranking_eligibility_rate', 'users.profile_complete_rate', 'users.with_location_rate']);
});
