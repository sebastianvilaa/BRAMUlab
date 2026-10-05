// BRAMUlab — V04.30: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de las correcciones del QA 04/10.
// Ejecutar con: node --test supabase/functions/_shared/v0430-correcciones.test.mjs
//   B2  replay idempotente de create_or_attach_match con error de negocio (antes SQLSTATE 23505 -> 500 -> falso "Sin conexión")
//   B3  candidato de duplicado STALE (el caller ya no figura en alguno de los dos partidos) no se lista ni se cuenta
//   preview_claim_link con contexto del partido fuente · get_my_recovered_match_ids · notificación selfReported
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { makePgliteAdminClient } from '../../scripts/pglite-admin-client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRAMULAB = path.resolve(HERE, '../../../bramulab');

// Motor compartido como en el navegador (IIFE -> global) y expuesto en globalThis para el núcleo.
const sandbox = {};
vm.createContext(sandbox);
for (const f of ['engine.js', 'level.js', 'level-context.js', 'match-sync.js', 'match-level-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(BRAMULAB, f), 'utf8'), sandbox, { filename: f });
}
globalThis.PLLevel = sandbox.PLLevel;
globalThis.PLMatchSync = sandbox.PLMatchSync;
globalThis.PLMatchLevelEngine = sandbox.PLMatchLevelEngine;
const MLE = sandbox.PLMatchLevelEngine;

let db; let svc;
before(async () => {
  const r = await replay({ acl: 'observed' });
  assert.ok(r.ok, 'el replay limpio debe aplicar todas las migraciones');
  db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
  svc = makePgliteAdminClient(db);
});
after(async () => { if (db) await db.close(); });

// ------------------------------------------------------------------ helpers
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const asUser = async (authUserId) => { await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [authUserId]); };
const rpcAs = async (authUserId, fn, args = []) => {
  await asUser(authUserId);
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  return (await one(`select public.${fn}(${ph}) as r`, args)).r;
};
const scenario = (name, fn) => test(name, async () => {
  await db.exec('begin');
  try { await fn(); } finally { await db.exec('rollback'); }
});

async function mkUser(key, { status = 'PENDIENTE', mu = null, confidence = null, rated = 0, distinct = 0 } = {}) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), '{"legal_version":"legal_v1"}'::jsonb)`,
    [uid, `${key.toLowerCase()}_${uid.slice(0, 6)}@example.test`]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set display_name = $2 where player_id = $1`, [pid, key]);
  await q(`update public.profiles set username = $2, first_name = $3, last_name = 'Test', display_name = $3 where player_id = $1`,
    [pid, `u_${key.toLowerCase()}_${uid.slice(0, 5)}`, key]);
  if (status !== 'PENDIENTE') {
    await q(`update public.level_states set status = $2, mu = $3, confidence = $4, confidence_origin = $4, evidence_units = 0,
               last_rated_at = now() - interval '40 days', rated_matches = $5, distinct_opponents = $6 where player_id = $1`,
      [pid, status, mu, confidence, rated, distinct]);
  }
  return { uid, pid, key };
}
async function mkProvisional(creator, name) {
  return (await one(`insert into public.players (type, display_name, created_by_player_id) values ('provisional', $1, $2) returning player_id`, [name, creator.pid])).player_id;
}
let matchSeq = 0;
/** Partido de dobles con las 4 posiciones (ids) y, opcionalmente, un resultado de Nivel vigente con snapshots por jugador. */
async function mkMatch({ creator, slots, names, daysAgo = 5, validated = true, validatedAfterDays = 1, sets = [[6, 4], [6, 3]], result = null, timeKnown = true }) {
  matchSeq += 1;
  const played = `now() - interval '${daysAgo} days' + interval '${matchSeq} seconds'`;
  const m = await one(`insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, played_at_time_known, status,
      winner_team, validation_deadline_at, validated_at)
    values ($1, 'seed-' || $2::text, 'classic', ${played}, $3, $4, 'A', now() + interval '20 days',
            case when $4 = 'validated' then (${played}) + make_interval(days => $5) else null end) returning match_id, played_at`,
    [creator.pid, matchSeq, timeKnown, validated ? 'validated' : 'pending_validation', validatedAfterDays]);
  const teams = [['A', 1], ['A', 2], ['B', 1], ['B', 2]];
  for (let i = 0; i < 4; i += 1) {
    await q(`insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values ($1,$2,$3,$4,$5)`,
      [m.match_id, teams[i][0], teams[i][1], slots[i], names[i]]);
  }
  await q(`select public._bloque6_refresh_participant_fingerprint($1)`, [m.match_id]);
  const rev = (await one(`insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
      values ($1, 1, $2, 'A', 'created', $3) returning revision_id`, [m.match_id, creator.pid, m.played_at])).revision_id;
  for (let i = 0; i < sets.length; i += 1) {
    await q(`insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values ($1,1,$2,$3,$4)`, [m.match_id, i + 1, sets[i][0], sets[i][1]]);
  }
  await q(`update public.matches set current_revision_id = $2, action_side = case when $3 then null else 'B' end where match_id = $1`, [m.match_id, rev, validated]);
  if (result) {
    const mlr = (await one(`insert into public.match_level_results (match_id, revision_id, trigger, algorithm_version, eligible, reason_codes, known_levels_count,
        repetition_factor_a, repetition_factor_b, companion_factor_a, companion_factor_b, effect_status)
        values ($1,$2,'initial',$3,$4,'[]'::jsonb,$5,1,1,1,1,'applied') returning result_id`,
      [m.match_id, rev, sandbox.PLLevel.ALGORITHM_VERSION, result.eligible !== false, Object.keys(result.priors).length])).result_id;
    if (result.eligible !== false) {
      for (const [pid, p] of Object.entries(result.priors)) {
        const idx = slots.indexOf(pid);
        await q(`insert into public.match_level_result_players (result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state, effective_level, k, opponent_factor,
            circle_factor, delta_raw, delta_capped, evidence_quality, original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before, mu_after, confidence_after)
          values ($1,$2,$3,$4,$5,$6,$4,0.3,1,1,0.1,0.1,0.2,$4,$5,0,$7,$8)`,
          [mlr, pid, teams[idx][0], p.mu, p.conf, p.state || 'CALIBRADO', p.mu + 0.1, p.conf + 0.01]);
      }
    }
    m.resultId = mlr;
  }
  return { ...m, revisionId: rev };
}
const priors = (...pairs) => Object.fromEntries(pairs.map(([p, mu = 5.0, conf = 0.7, state = 'CALIBRADO']) => [p, { mu, conf, state }]));
const inviteToken = async (inviter, provisionalId) => rpcAs(inviter.uid, 'create_claim_link', [provisionalId]);
const claim = async (target, token) => rpcAs(target.uid, 'claim_provisional_player', [token]);
async function world() {
  const seba = await mkUser('Seba', { status: 'CALIBRADO', mu: 5.5, confidence: 0.8, rated: 9, distinct: 6 });
  const matu = await mkUser('Matu', { status: 'CALIBRADO', mu: 5.0, confidence: 0.75, rated: 9, distinct: 6 });
  const lucho = await mkUser('Lucho', { status: 'CALIBRADO', mu: 4.5, confidence: 0.7, rated: 9, distinct: 6 });
  const pedro = await mkProvisional(seba, 'Pedro');
  return { seba, matu, lucho, pedro };
}
const sets1 = [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }];

scenario('B2: el MISMO idempotency_key con un error de negocio (match_submissions.result_match_id NULL) devuelve el mismo resultado, sin SQLSTATE 23505', async () => {
  const w = await world();
  const key = crypto.randomUUID();
  const args = {
    p_auth_user_id: w.seba.uid, p_idempotency_key: key,
    p_pair1_player_id_1: w.seba.pid, p_pair1_player_id_2: w.seba.pid, p_pair2_player_id_1: w.matu.pid, p_pair2_player_id_2: w.lucho.pid,
    p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic', p_sets: sets1,
  };
  const first = await svc.rpc('create_or_attach_match', args);
  assert.equal(first.error, null, JSON.stringify(first.error));
  assert.equal(first.data.code, 'duplicate_participant');
  const second = await svc.rpc('create_or_attach_match', args);
  assert.equal(second.error, null, `el reintento no debe fallar: ${JSON.stringify(second.error)}`);
  assert.deepEqual(second.data, first.data);
  assert.equal((await q(`select count(*)::int n from public.match_submissions where idempotency_key = $1`, [key]))[0].n, 1);
  // Mismo key con OTRO payload sigue siendo un error de negocio explícito.
  const other = await svc.rpc('create_or_attach_match', { ...args, p_sets: [{ gamesA: 6, gamesB: 2, tiebreakA: null, tiebreakB: null }] });
  assert.equal(other.data.code, 'idempotency_key_reused_with_different_payload');
});

scenario('B2: una carga válida con el mismo key sigue siendo idempotente (un solo partido)', async () => {
  const w = await world();
  const key = crypto.randomUUID();
  const args = {
    p_auth_user_id: w.seba.uid, p_idempotency_key: key,
    p_pair1_player_id_1: w.seba.pid, p_pair1_player_id_2: w.matu.pid, p_pair2_player_id_1: w.lucho.pid, p_pair2_player_id_2: w.pedro,
    p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic', p_sets: sets1,
  };
  const a = await svc.rpc('create_or_attach_match', args);
  const b = await svc.rpc('create_or_attach_match', args);
  assert.equal(a.data.ok, true, JSON.stringify(a));
  assert.deepEqual(b.data, a.data);
  assert.equal((await one(`select count(*)::int n from public.matches`)).n, 1);
});

scenario('B3: un candidato de duplicado STALE (el caller se desligó de uno de los partidos) ya no se lista ni cuenta como abierto', async () => {
  const w = await world();
  const t = await mkUser('Dup', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 4, validated: false });
  const m2 = await mkMatch({ creator: t, slots: [w.seba.pid, t.pid, w.matu.pid, w.lucho.pid], names: ['Seba', 'Dup', 'Matu', 'Lucho'], daysAgo: 4, validated: false });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.duplicateCandidates, 1);
  assert.equal((await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates.length, 1, 'antes de desligarse sí corresponde preguntar');
  assert.equal((await rpcAs(t.uid, 'get_my_identity_recovery_status')).openDuplicateCandidates, 1);
  // El target dice "No participé" sobre SU lugar del partido 2 -> su slot pasa a "Por identificar".
  const issue = await rpcAs(t.uid, 'report_identity_issue', [m2.match_id, 'A', 2, null]);
  assert.equal(issue.ok, true, JSON.stringify(issue));
  assert.equal((await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates.length, 0, 'candidato stale: no se lista');
  assert.equal((await rpcAs(t.uid, 'get_my_identity_recovery_status')).openDuplicateCandidates, 0, 'candidato stale: no se cuenta');
});

scenario('preview_claim_link: suma matchCount + partido fuente compacto (cargador, parejas, score, fecha) sin ids de partido; get_my_recovered_match_ids solo para el target', async () => {
  const w = await world();
  const t = await mkUser('Rec', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m1 = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 6, sets: [[6, 4], [6, 3]] });
  const m2 = await mkMatch({ creator: w.seba, slots: [w.matu.pid, w.pedro, w.seba.pid, w.lucho.pid], names: ['Matu', 'Pedro', 'Seba', 'Lucho'], daysAgo: 2, sets: [[7, 5], [6, 4]] });
  const token = await inviteToken(w.seba, w.pedro);
  const p = await rpcAs(t.uid, 'preview_claim_link', [token]);
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(p.displayName, 'Pedro');
  assert.equal(p.matchCount, 2);
  assert.equal(p.sourceMatch.loaderName, 'Seba');
  assert.equal(p.sourceMatch.sets[0].gamesA, 7, 'el partido fuente es el más reciente');
  assert.equal(p.sourceMatch.matchId, undefined, 'sin id de partido');
  assert.ok(p.sourceMatch.participants.length === 4);
  const r = await claim(t, token);
  assert.equal(r.ok, true, JSON.stringify(r));
  const rec = await rpcAs(t.uid, 'get_my_recovered_match_ids', [r.recoveryId]);
  assert.equal(rec.ok, true);
  assert.deepEqual([...rec.matchIds].sort(), [m1.match_id, m2.match_id].sort());
  assert.equal(rec.sourceName, 'Pedro');
  assert.equal((await rpcAs(w.seba.uid, 'get_my_recovered_match_ids', [r.recoveryId])).code, 'not_found', 'otra cuenta no lee la recuperación');
});

scenario('notificación identity_questioned: selfReported=true si la persona señaló SU lugar; false si señaló a otro', async () => {
  const w = await world();
  const m = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.matu.pid, w.lucho.pid, w.pedro], names: ['Seba', 'Matu', 'Lucho', 'Pedro'], daysAgo: 2, validated: false });
  // Matu (A2) dice que NO participó él.
  const self = await rpcAs(w.matu.uid, 'report_identity_issue', [m.match_id, 'A', 2, null]);
  assert.equal(self.ok, true, JSON.stringify(self));
  await asUser(w.seba.uid);
  let rows = await q(`select type, payload from public.get_notifications(50, false) where type = 'identity_questioned'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.selfReported, true);
  assert.equal(rows[0].payload.openedByPlayerId, w.matu.pid);
});

scenario('B1: con dos partidos de los MISMOS 4 jugadores, la corrección con disambiguationMatchId opera sobre el partido indicado (revisión append-only, deadline intacto, el otro partido sin tocar); sin él es ambiguous_candidates', async () => {
  const seba = await mkUser('Seba'); const nico = await mkUser('Nico'); const matu = await mkUser('Matu'); const lucho = await mkUser('Lucho');
  const slots = [seba.pid, nico.pid, matu.pid, lucho.pid]; const names = ['Seba', 'Nico', 'Matu', 'Lucho'];
  const m1 = await mkMatch({ creator: seba, slots, names, daysAgo: 1, validated: false, sets: [[6, 4], [6, 3]] });
  const m2 = await mkMatch({ creator: seba, slots, names, daysAgo: 1, validated: false, sets: [[6, 2], [6, 1]] });
  const state = async (id) => one(`select (select count(*)::int from public.match_revisions where match_id = m.match_id) as revs, m.validation_deadline_at, m.action_side, m.status from public.matches m where m.match_id = $1`, [id]);
  const b1 = await state(m1.match_id); const b2 = await state(m2.match_id);
  const playedAt = (await one(`select played_at from public.matches where match_id = $1`, [m2.match_id])).played_at.toISOString();
  const args = (extra) => ({
    p_auth_user_id: matu.uid, p_idempotency_key: crypto.randomUUID(),
    p_pair1_player_id_1: seba.pid, p_pair1_player_id_2: nico.pid, p_pair2_player_id_1: matu.pid, p_pair2_player_id_2: lucho.pid,
    p_played_at: playedAt, p_played_at_time_known: true, p_format_id: 'classic',
    p_sets: [{ gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 2, tiebreakA: null, tiebreakB: null }], ...extra,
  });
  const amb = await svc.rpc('create_or_attach_match', args({}));
  assert.equal(amb.data.code, 'ambiguous_candidates', 'sin match_id explícito, dos partidos iguales son ambiguos');
  const fixed = await svc.rpc('create_or_attach_match', args({ p_disambiguation_match_id: m2.match_id }));
  assert.equal(fixed.error, null, JSON.stringify(fixed.error));
  assert.equal(fixed.data.ok, true, JSON.stringify(fixed.data));
  assert.equal(fixed.data.matchId, m2.match_id, 'el match correcto');
  const a1 = await state(m1.match_id); const a2 = await state(m2.match_id);
  assert.equal(a1.revs, b1.revs, 'el partido homónimo no se toca');
  assert.deepEqual(a1.validation_deadline_at, b1.validation_deadline_at);
  assert.equal(a2.revs, b2.revs + 1, 'append-only: una revisión nueva');
  assert.deepEqual(a2.validation_deadline_at, b2.validation_deadline_at, 'deadline intacto');
  assert.notEqual(a2.action_side, b2.action_side, 'la acción pasa a la otra pareja');
  assert.equal(a1.action_side, b1.action_side);
});
