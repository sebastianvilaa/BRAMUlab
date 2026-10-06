// BRAMUlab — V04.37: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de get_my_level_evolution().
// Ejecutar con: node --test supabase/functions/_shared/v0437-level-evolution.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let db;
before(async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'el replay limpio debe aplicar todas las migraciones');
  db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
});
after(async () => { if (db) await db.close(); });

const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const asUser = async (uid) => { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]); };
const evolutionAs = async (u) => { await asUser(u.uid); return (await one(`select public.get_my_level_evolution() as r`)).r; };
const scenario = (name, fn) => test(name, async () => {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
});

let seq = 0;
async function mkUser(key, { mu = 5.0, status = 'CALIBRANDO', initialDaysAgo = 40 } = {}) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"legal_version":"legal_v1"}'::jsonb)`,
    [uid, `${key.toLowerCase()}_${uid.slice(0, 6)}@example.test`]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set display_name = $2 where player_id = $1`, [pid, key]);
  await q(`update public.profiles set username = $2, first_name = $3, last_name = 'Test', display_name = $3 where player_id = $1`, [pid, `u_${key.toLowerCase()}_${uid.slice(0, 5)}`, key]);
  if (status !== 'PENDIENTE') {
    await q(`update public.level_states set status = $2, mu = $3, confidence = 0.2, evidence_units = 0, last_rated_at = now() where player_id = $1`, [pid, status, mu]);
    await q(`insert into public.level_events (player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode, result, created_at)
             values ($1, 'initial_estimate', 'nivel_bramu_v1_0', 'nivel_inicial_v1_3', 'full', $2::jsonb, now() - make_interval(days => $3))`,
      [pid, JSON.stringify({ confirmedLevel: mu, confidenceOrigin: 0.15 }), initialDaysAgo]);
  }
  return { uid, pid, key };
}

/** Partido validado de `me` (+3 invitados/otros) jugado hace `daysAgo` días. */
async function mkMatch(creator, others, daysAgo, { secs = 0 } = {}) {
  seq += 1;
  const m = await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, played_at_time_known, status, winner_team, validation_deadline_at, validated_at)
    values ($1, 'seed-' || $2::text, 'classic', now() - make_interval(days => $3) + make_interval(secs => $4), true, 'validated', 'A', now() + interval '20 days', now() - make_interval(days => $3)) returning match_id, played_at`,
    [creator.pid, seq, daysAgo, secs]);
  const slots = [creator.pid, ...others];
  const teams = [['A', 1], ['A', 2], ['B', 1], ['B', 2]];
  for (let i = 0; i < 4; i += 1) {
    await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`, [m.match_id, teams[i][0], teams[i][1], slots[i], `P${i}`]);
  }
  await q(`select public._bloque6_refresh_participant_fingerprint($1)`, [m.match_id]);
  const rev = (await one(`insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at) values ($1, 1, $2, 'A', 'created', $3) returning revision_id`, [m.match_id, creator.pid, m.played_at])).revision_id;
  await q(`update public.matches set current_revision_id = $2, action_side = null where match_id = $1`, [m.match_id, rev]);
  return { matchId: m.match_id, revisionId: rev };
}
const others = async () => { const o = []; for (let i = 0; i < 3; i += 1) o.push(await mkUser(`Otro${seq}_${i}_${crypto.randomUUID().slice(0, 4)}`, { status: 'PENDIENTE' })); return o.map((x) => x.pid); };

/** Aplica un resultado vigente con un efecto dado sobre `u` y mueve level_states como lo hace officialize_match_validation. */
async function applyResult(u, match, effect, { eligible = true, trigger = 'initial' } = {}) {
  const live = Number((await one(`select mu from public.level_states where player_id = $1`, [u.pid])).mu);
  const existing = await one(`select result_id from public.match_level_results where match_id = $1 and effect_status = 'applied'`, [match.matchId]);
  const res = existing ? existing.result_id : (await one(`insert into public.match_level_results (match_id, revision_id, trigger, algorithm_version, eligible, reason_codes, known_levels_count, effect_status)
    values ($1, $2, $3, 'nivel_bramu_v1_0', $4, '[]'::jsonb, 4, 'applied') returning result_id`, [match.matchId, match.revisionId, trigger, eligible])).result_id;
  if (eligible) {
    await q(`insert into public.match_level_result_players (result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state, effective_level, k, opponent_factor, circle_factor,
        delta_raw, delta_capped, evidence_quality, original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before, mu_after, confidence_after)
      values ($1,$2,'A',$3,0.2,'CALIBRANDO',$3,0.3,1,1,$4,$4,0.2,$3,0.2,0,$5,0.25)`, [res, u.pid, live, effect, Math.round((live + effect) * 10000) / 10000]);
    await q(`update public.level_states set mu = $2 where player_id = $1`, [u.pid, Math.round((live + effect) * 10000) / 10000]);
  }
  return res;
}
const pub = async (u) => Number((await one(`select round(mu, 1) as v from public.level_states where player_id = $1`, [u.pid])).v);
const levels = (r) => r.points.map((p) => p.level);

scenario('1) cuenta con resultados reales: serie anclada [inicio, …, actual]; el ÚLTIMO punto == Nivel público actual; orden deportivo; solo valores públicos', async () => {
  const me = await mkUser('Yo', { mu: 5.0 });
  const m1 = await mkMatch(me, await others(), 20); await applyResult(me, m1, 0.30);
  const m2 = await mkMatch(me, await others(), 10); await applyResult(me, m2, -0.12);
  const m3 = await mkMatch(me, await others(), 3); await applyResult(me, m3, 0.25);
  const r = await evolutionAs(me);
  assert.equal(r.ok, true); assert.equal(r.available, true);
  assert.deepEqual(levels(r), [5.0, 5.3, 5.2, 5.4]); // 5.0 → 5.30 → 5.18 → 5.43 (públicos a 1 decimal)
  assert.equal(r.currentLevel, await pub(me)); assert.equal(levels(r).at(-1), await pub(me));
  assert.deepEqual(r.points.map((p) => p.matchId), [null, m1.matchId, m2.matchId, m3.matchId]);
  const dates = r.points.map((p) => Date.parse(p.at)); assert.deepEqual([...dates].sort((a, b) => a - b), dates, 'cronológico');
  // El punto inicial coincide con la estimación inicial (valor base vigente).
  assert.equal(r.points[0].level, 5.0);
  // Contrato mínimo: NADA de internals del motor.
  assert.deepEqual(Object.keys(r).sort(), ['available', 'currentLevel', 'ok', 'points']);
  r.points.forEach((p) => assert.deepEqual(Object.keys(p).sort(), ['at', 'level', 'matchId']));
  r.points.forEach((p) => assert.equal(Math.round(p.level * 10) / 10, p.level, 'valor público a 1 decimal'));
});

scenario('2) sin evidencia: PENDIENTE o sin resultados vigentes → available=false (la UI oculta el módulo, nunca un placeholder)', async () => {
  const pend = await mkUser('Pend', { status: 'PENDIENTE' });
  assert.deepEqual(await evolutionAs(pend), { ok: true, available: false, reason: 'no_level' });
  const zero = await mkUser('Cero', { mu: 5.4 });
  assert.deepEqual(await evolutionAs(zero), { ok: true, available: false, reason: 'no_results' });
  // Un resultado no elegible (sin efecto de Nivel) tampoco genera evolución.
  const m = await mkMatch(zero, await others(), 4); await applyResult(zero, m, 0, { eligible: false });
  assert.equal((await evolutionAs(zero)).available, false);
});

scenario('3) resultado REVERTIDO no queda como punto: anulación administrativa real (revierte Nivel con la rutina vigente) → la serie y el último punto siguen coherentes', async () => {
  const me = await mkUser('Yo', { mu: 6.0 });
  const m1 = await mkMatch(me, await others(), 15); await applyResult(me, m1, 0.40);
  const m2 = await mkMatch(me, await others(), 8); await applyResult(me, m2, 0.20);
  const m3 = await mkMatch(me, await others(), 2); await applyResult(me, m3, -0.10);
  assert.deepEqual(levels(await evolutionAs(me)), [6.0, 6.4, 6.6, 6.5]);
  const out = await one(`select public.admin_annul_match($1, 'test', 'anulación de prueba') as r`, [m2.matchId]);
  assert.equal(out.r.ok, true, JSON.stringify(out.r));
  const r = await evolutionAs(me);
  assert.deepEqual(r.points.map((p) => p.matchId), [null, m1.matchId, m3.matchId], 'el partido anulado no deja punto');
  assert.deepEqual(levels(r), [6.0, 6.4, 6.3]);
  assert.equal(levels(r).at(-1), await pub(me), 'el último punto sigue siendo el Nivel público actual tras la reversión');
});

scenario('4) corrección: el resultado anterior queda `reverted` y el nuevo `applied` → UN solo punto por partido (el vigente), sin duplicados ni "blips"', async () => {
  const me = await mkUser('Yo', { mu: 5.0 });
  const m1 = await mkMatch(me, await others(), 12); const r1 = await applyResult(me, m1, 0.30);
  const m2 = await mkMatch(me, await others(), 5); await applyResult(me, m2, 0.20);
  // Se corrige el resultado del partido 1: revertir el anterior (resta su efecto) y aplicar el nuevo.
  await q(`select public._bloque6_revert_applied_result($1)`, [m1.matchId]);
  assert.equal((await one(`select effect_status from public.match_level_results where result_id = $1`, [r1])).effect_status, 'reverted');
  await applyResult(me, m1, -0.10, { trigger: 'correction_accepted' });
  const r = await evolutionAs(me);
  assert.equal(r.points.filter((p) => p.matchId === m1.matchId).length, 1, 'un único punto del partido corregido');
  assert.equal(r.points.length, 3);
  assert.deepEqual(levels(r), [5.0, 4.9, 5.1]); // 5.00 → 4.90 (corregido) → 5.10
  assert.equal(levels(r).at(-1), await pub(me));
});

scenario('5) orden DEPORTIVO: un partido jugado antes pero oficializado después se ubica por played_at; el último punto sigue siendo el Nivel actual', async () => {
  const me = await mkUser('Yo', { mu: 5.0 });
  const late = await mkMatch(me, await others(), 3); await applyResult(me, late, 0.10);   // oficializado primero, jugado después
  const early = await mkMatch(me, await others(), 9); await applyResult(me, early, 0.20); // oficializado después, jugado antes
  const r = await evolutionAs(me);
  assert.deepEqual(r.points.map((p) => p.matchId), [null, early.matchId, late.matchId]);
  assert.deepEqual(levels(r), [5.0, 5.2, 5.3]);
  assert.equal(levels(r).at(-1), await pub(me));
});

scenario('6) self-only y aislamiento: cada jugador ve SOLO su serie (la RPC no recibe parámetros); otro jugador del mismo partido tiene la suya', async () => {
  const a = await mkUser('Ana', { mu: 5.0 }); const b = await mkUser('Beto', { mu: 7.0 });
  const m = await mkMatch(a, [b.pid, ...(await others()).slice(0, 2)], 4);
  await applyResult(a, m, 0.30); await applyResult(b, m, -0.20);
  assert.deepEqual(levels(await evolutionAs(a)), [5.0, 5.3]);
  assert.deepEqual(levels(await evolutionAs(b)), [7.0, 6.8]);
  assert.equal((await one(`select pronargs from pg_proc where proname = 'get_my_level_evolution'`)).pronargs, 0);
  await asUser(crypto.randomUUID());
  await assert.rejects(() => one(`select public.get_my_level_evolution() as r`), /no_player_for_session/);
});

scenario('7) permisos: solo authenticated (anon y public sin EXECUTE)', async () => {
  const can = async (role) => (await one(`select has_function_privilege($1, 'public.get_my_level_evolution()', 'execute') as ok`, [role])).ok;
  assert.equal(await can('authenticated'), true);
  assert.equal(await can('anon'), false);
});

test('8) la migración no expone internals y no escribe: función STABLE, solo lecturas, valores públicos redondeados', () => {
  const sql = fs.readFileSync(path.join(HERE, '../../migrations/20261006300000_v0437_level_evolution.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('create or replace function public.get_my_level_evolution'), sql.indexOf('comment on function'));
  assert.match(fn, /\bstable\b/);
  assert.doesNotMatch(fn, /\b(insert|update|delete)\b\s+(into\s+)?public\./i);
  const out = fn.slice(fn.indexOf("return jsonb_build_object(\n    'ok', true, 'available', true"));
  assert.doesNotMatch(out, /confidence|\bk\b|expectation|delta/i);
  assert.match(fn, /round\(/);
});
