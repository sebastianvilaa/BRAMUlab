// BRAMUlab — V04.29-h2 (gate 118, hallazgo 3): CONCURRENCIA REAL del vínculo de identidad sobre un Postgres real (varias conexiones).
// Ejecutar: BRAMU_PG_MODULES=<dir con node_modules de embedded-postgres y pg> node --test supabase/scripts/real-pg-concurrency.test.mjs
// Sin esos paquetes los tests se OMITEN (ver real-pg.mjs). No toca Supabase: Postgres efímero local.
//
// Invariantes que se verifican tras cada carrera (repetida N veces con datos nuevos y desfasajes aleatorios):
//   I1 nunca la misma persona dos veces en el mismo partido;
//   I2 si el vínculo triunfó, la provisional recuperada NO figura en ningún slot (ni en uno creado/asignado por la carrera);
//   I3 un único ganador por provisional; los demás links quedan revocados/usados;
//   I4 ningún deadlock ni error SQL genérico: todo resultado es un código estructurado;
//   I5 el vínculo sigue siendo atómico: o identity_conflict (cero mutación) o ok completo.

import crypto from 'node:crypto';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadRealPg } from './real-pg.mjs';

let rp = null;
before(async () => { rp = await loadRealPg(); if (!rp) console.warn('[real-pg] embedded-postgres/pg no disponibles: concurrencia real OMITIDA'); });
after(async () => { if (rp) await rp.stop(); });

const ITER = Number(process.env.BRAMU_CONCURRENCY_ITER || 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => sleep(Math.floor(Math.random() * 6));

async function q(sql, params = []) { return (await rp.admin.query(sql, params)).rows; }
async function one(sql, params = []) { return (await q(sql, params))[0]; }

async function mkUser(key) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"legal_version":"legal_v1"}'::jsonb)`, [uid, `${key.toLowerCase()}_${uid.slice(0, 6)}@example.test`]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set display_name = $2 where player_id = $1`, [pid, key]);
  await q(`update public.profiles set username = $2, first_name = $3, last_name = 'T', display_name = $3 where player_id = $1`, [pid, `u_${key.toLowerCase()}_${uid.slice(0, 5)}`, key]);
  return { uid, pid, key };
}
async function mkProv(creator, name) {
  return (await one(`insert into public.players (type, display_name, created_by_player_id) values ('provisional', $1, $2) returning player_id`, [name, creator.pid])).player_id;
}
let seq = 0;
async function mkMatch(creator, slots, names, { issueAt = null } = {}) {
  seq += 1;
  const m = await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
     values ($1, 'rp-' || $2::int::text, 'classic', now() - interval '3 hours' + make_interval(secs => $2::int), 'pending_validation', 'B', now() + interval '20 days') returning match_id`, [creator.pid, seq]);
  const pos = [['A', 1], ['A', 2], ['B', 1], ['B', 2]];
  for (let i = 0; i < 4; i += 1) {
    await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`, [m.match_id, pos[i][0], pos[i][1], slots[i], names[i]]);
  }
  const rev = (await one(`insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
     values ($1, 1, $2, 'A', 'created', now()) returning revision_id`, [m.match_id, creator.pid])).revision_id;
  await q(`insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values ($1,1,1,6,3),($1,1,2,6,4)`, [m.match_id]);
  await q(`update public.matches set current_revision_id = $2 where match_id = $1`, [m.match_id, rev]);
  let issueId = null;
  if (issueAt) {
    issueId = (await one(`insert into public.match_identity_issues (match_id, team, position_in_team, previous_player_id, opened_by_player_id, resolution_deadline_at)
       values ($1,$2,$3,null,$4, now() + interval '7 days') returning issue_id`, [m.match_id, issueAt[0], issueAt[1], creator.pid])).issue_id;
  }
  await q(`select public._bloque6_refresh_participant_fingerprint($1)`, [m.match_id]);
  return { matchId: m.match_id, issueId };
}
async function token(user, provId) {
  const c = await rp.connect();
  await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user.uid]);
  const t = (await c.query(`select public.create_claim_link($1) as t`, [provId])).rows[0].t;
  await c.end();
  return t;
}
/** Ejecuta `fn(conn)` en una conexión propia con la sesión de `user`; devuelve {ok, value} o {ok:false, error}. */
async function as(user, fn) {
  const c = await rp.connect();
  try {
    await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user.uid]);
    await jitter();
    return { ok: true, value: await fn(c) };
  } catch (e) { return { ok: false, error: e }; } finally { await c.end().catch(() => {}); }
}
const claimFn = (tok) => async (c) => (await c.query(`select public.claim_provisional_player($1) as r`, [tok])).rows[0].r;
const noSqlErrors = (...results) => results.forEach((r) => assert.ok(r.ok, `error SQL no estructurado (posible deadlock/unicidad): ${r.error && r.error.message} [${r.error && r.error.code}]`));
async function assertInvariants(provIds) {
  const dup = await q(`select match_id, player_id, count(*)::int n from public.match_participants where player_id is not null group by 1,2 having count(*) > 1`);
  assert.deepEqual(dup, [], 'I1: la misma persona dos veces en un partido');
  for (const p of provIds) {
    const tomb = await one(`select is_active, recovered_into_player_id from public.players where player_id = $1`, [p]);
    if (tomb.recovered_into_player_id) {
      const n = (await one(`select count(*)::int n from public.match_participants where player_id = $1`, [p])).n;
      assert.equal(n, 0, 'I2: una provisional recuperada quedó incorporada a un partido');
    }
  }
}

test('C1 dos links de invitadores distintos, dos cuentas distintas, a la vez: un solo ganador', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const t1 = await mkUser('T1'); const t2 = await mkUser('T2'); const lu = await mkUser('Lu');
    const p = await mkProv(seba, 'Pedro');
    const m = await mkMatch(seba, [seba.pid, p, matu.pid, lu.pid], ['Seba', 'Pedro', 'Matu', 'Lu']);
    const [ta, tb] = [await token(seba, p), await token(matu, p)];
    const [a, b] = await Promise.all([as(t1, claimFn(ta)), as(t2, claimFn(tb))]);
    noSqlErrors(a, b);
    const oks = [a, b].filter((x) => x.value.ok === true);
    assert.equal(oks.length, 1, JSON.stringify([a.value, b.value]));
    assert.equal([a, b].find((x) => x.value.ok !== true).value.code, 'claim_already_used');
    assert.equal((await q(`select 1 from public.provisional_claims where provisional_player_id = $1 and status = 'pending'`, [p])).length, 0);
    assert.equal((await q(`select 1 from public.player_identity_recoveries where source_provisional_player_id = $1 and status = 'completed'`, [p])).length, 1);
    assert.equal((await q(`select 1 from public.match_participants where match_id = $1 and player_id = any($2::uuid[])`, [m.matchId, [t1.pid, t2.pid]])).length, 1);
    await assertInvariants([p]);
  }
});

test('C2 vínculo vs create_or_attach que USA la provisional (y a la cuenta destino en el mismo partido): nunca doble slot ni provisional recuperada incorporada', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  const outcomes = { claimOk: 0, claimConflict: 0, createOk: 0, createBlocked: 0 };
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const lu = await mkUser('Lu'); const t = await mkUser('Tgt');
    const p = await mkProv(seba, 'Pedro');
    await mkMatch(seba, [seba.pid, p, matu.pid, lu.pid], ['Seba', 'Pedro', 'Matu', 'Lu']);
    const tok = await token(seba, p);
    const createFn = async (c) => (await c.query(`select public.create_or_attach_match($1, gen_random_uuid(), $2, $3, $4, $5, now() - interval '1 hour', true, 'classic', $6::jsonb) as r`,
      [seba.uid, seba.pid, p, t.pid, lu.pid, JSON.stringify([{ gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }])])).rows[0].r;
    const [cl, cr] = await Promise.all([as(t, claimFn(tok)), as(seba, createFn)]);
    noSqlErrors(cl, cr);
    if (cl.value.ok) outcomes.claimOk += 1; else { assert.equal(cl.value.code, 'identity_conflict', JSON.stringify(cl.value)); outcomes.claimConflict += 1; }
    if (cr.value.ok) outcomes.createOk += 1; else { assert.equal(cr.value.code, 'participant_not_found', JSON.stringify(cr.value)); outcomes.createBlocked += 1; }
    // coherencia cruzada: si el vínculo ganó, la creación no pudo haber usado la provisional (o fue vinculada con el resto); si hubo conflicto, la provisional sigue activa.
    if (cl.value.ok) assert.equal((await one(`select is_active from public.players where player_id = $1`, [p])).is_active, false);
    else assert.equal((await one(`select is_active from public.players where player_id = $1`, [p])).is_active, true, 'identity_conflict = CERO mutación');
    await assertInvariants([p]);
  }
  console.log('  C2 resultados', JSON.stringify(outcomes));
});

test('C3 vínculo vs create_or_attach con la provisional (sin el target): tras el vínculo la provisional no figura en ningún partido, ni en el creado en la carrera', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const lu = await mkUser('Lu'); const t = await mkUser('Tgt');
    const p = await mkProv(seba, 'Pedro');
    await mkMatch(seba, [seba.pid, p, matu.pid, lu.pid], ['Seba', 'Pedro', 'Matu', 'Lu']);
    const tok = await token(seba, p);
    const createFn = async (c) => (await c.query(`select public.create_or_attach_match($1, gen_random_uuid(), $2, $3, $4, $5, now() - interval '5 hours', true, 'classic', $6::jsonb) as r`,
      [seba.uid, seba.pid, p, matu.pid, lu.pid, JSON.stringify([{ gamesA: 6, gamesB: 2, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 2, tiebreakA: null, tiebreakB: null }])])).rows[0].r;
    const [cl, cr] = await Promise.all([as(t, claimFn(tok)), as(seba, createFn)]);
    noSqlErrors(cl, cr);
    assert.equal(cl.value.ok, true, JSON.stringify(cl.value));
    await assertInvariants([p]);
    assert.equal((await one(`select count(*)::int n from public.match_participants where player_id = $1`, [p])).n, 0);
  }
});

test('C4 vínculo vs resolve_identity_issue que asigna a la CUENTA destino en un partido donde la provisional también está: nunca doble slot', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  const outcomes = { claimOk: 0, claimConflict: 0, resolveOk: 0, resolveBlocked: 0 };
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const t = await mkUser('Tgt');
    const p = await mkProv(seba, 'Pedro');
    const m = await mkMatch(seba, [seba.pid, p, matu.pid, null], ['Seba', 'Pedro', 'Matu', 'Por identificar'], { issueAt: ['B', 2] });
    await q(`select public._bloque6_refresh_participant_fingerprint($1)`, [m.matchId]);
    const tok = await token(seba, p);
    const resolveFn = async (c) => (await c.query(`select public.resolve_identity_issue($1, $2, $3, false) as r`, [seba.uid, m.issueId, t.pid])).rows[0].r;
    const [cl, rs] = await Promise.all([as(t, claimFn(tok)), as(seba, resolveFn)]);
    noSqlErrors(cl, rs);
    if (cl.value.ok) outcomes.claimOk += 1; else { assert.equal(cl.value.code, 'identity_conflict', JSON.stringify(cl.value)); outcomes.claimConflict += 1; }
    if (rs.value.ok) outcomes.resolveOk += 1; else { assert.equal(rs.value.code, 'duplicate_participant', JSON.stringify(rs.value)); outcomes.resolveBlocked += 1; }
    await assertInvariants([p]);
  }
  console.log('  C4 resultados', JSON.stringify(outcomes));
});

test('C5 vínculo vs resolve_identity_issue que asigna la PROVISIONAL a otro partido: nunca queda un tombstone incorporado', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const nico = await mkUser('Nico'); const t = await mkUser('Tgt');
    const p = await mkProv(seba, 'Pedro');
    await mkMatch(seba, [seba.pid, p, matu.pid, nico.pid], ['Seba', 'Pedro', 'Matu', 'Nico']);
    const m2 = await mkMatch(seba, [seba.pid, nico.pid, matu.pid, null], ['Seba', 'Nico', 'Matu', 'Por identificar'], { issueAt: ['B', 2] });
    const tok = await token(seba, p);
    const resolveFn = async (c) => (await c.query(`select public.resolve_identity_issue($1, $2, $3, false) as r`, [seba.uid, m2.issueId, p])).rows[0].r;
    const [cl, rs] = await Promise.all([as(t, claimFn(tok)), as(seba, resolveFn)]);
    noSqlErrors(cl, rs);
    assert.equal(cl.value.ok, true, JSON.stringify(cl.value));
    if (!rs.value.ok) assert.equal(rs.value.code, 'participant_not_found', JSON.stringify(rs.value));
    await assertInvariants([p]);
    assert.equal((await one(`select count(*)::int n from public.match_participants where player_id = $1`, [p])).n, 0);
  }
});

test('C6 una cuenta vincula DOS provisionales que comparten partido, a la vez: un solo ganador, sin deadlock, sin doble slot', async (t) => {
  if (!rp) return t.skip('embedded-postgres no disponible');
  for (let i = 0; i < ITER; i += 1) {
    const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const lu = await mkUser('Lu'); const t = await mkUser('Tgt');
    const p1 = await mkProv(seba, 'P1'); const p3 = await mkProv(seba, 'P3');
    await mkMatch(seba, [seba.pid, p1, p3, matu.pid], ['Seba', 'P1', 'P3', 'Matu']);
    await mkMatch(seba, [seba.pid, p1, matu.pid, lu.pid], ['Seba', 'P1', 'Matu', 'Lu']);
    await mkMatch(seba, [seba.pid, p3, matu.pid, lu.pid], ['Seba', 'P3', 'Matu', 'Lu']);
    const [k1, k3] = [await token(seba, p1), await token(seba, p3)];
    const [a, b] = await Promise.all([as(t, claimFn(k1)), as(t, claimFn(k3))]);
    noSqlErrors(a, b);
    const oks = [a, b].filter((x) => x.value.ok === true);
    assert.equal(oks.length, 1, JSON.stringify([a.value, b.value]));
    assert.equal([a, b].find((x) => x.value.ok !== true).value.code, 'identity_conflict');
    await assertInvariants([p1, p3]);
  }
});
