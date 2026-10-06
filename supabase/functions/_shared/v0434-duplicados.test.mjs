// BRAMUlab — V04.34: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de la decisión DURABLE "ES OTRO PARTIDO" (QA humano V04.33).
// Ejecutar con: node --test supabase/functions/_shared/v0434-duplicados.test.mjs
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

const inviteToken = async (inviter, provisionalId) => rpcAs(inviter.uid, 'create_claim_link', [provisionalId]);
const claim = async (target, token) => rpcAs(target.uid, 'claim_provisional_player', [token]);
const sets2 = [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }];
const create = (user, ids, extra = {}) => svc.rpc('create_or_attach_match', {
  p_auth_user_id: user.uid, p_idempotency_key: crypto.randomUUID(),
  p_pair1_player_id_1: ids[0], p_pair1_player_id_2: ids[1], p_pair2_player_id_1: ids[2], p_pair2_player_id_2: ids[3],
  p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic', p_sets: sets2, ...extra,
});


const SETS_DIFF = [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }];
const pairRows = async () => q(`select match_low_id, match_high_id, status, target_player_id, resolved_by_player_id, resolution from public.match_duplicate_candidates order by created_at`);

scenario('CASO REAL QA: validado + otro score → ES OTRO PARTIDO se persiste; tras el claim de Gastón el MISMO par NO reaparece (ni en lista ni en contador)', async () => {
  const seba = await mkUser('Seba'); const esteban = await mkUser('Esteban'); const leo = await mkUser('Leo');
  const gaston = await mkProvisional(esteban, 'Gastón');
  const m1 = await mkMatch({ creator: esteban, slots: [esteban.pid, gaston, seba.pid, leo.pid], names: ['Esteban', 'Gastón', 'Seba', 'Leo'], daysAgo: 1, validated: true, sets: [[6, 2], [6, 2]] });
  // Seba carga el mismo encuentro (parejas invertidas) con otro score: el backend lo detecta como posible duplicado (gate final intacto).
  const first = await create(seba, [seba.pid, leo.pid, esteban.pid, gaston], { p_sets: SETS_DIFF });
  assert.equal(first.data.ok, false); assert.equal(first.data.code, 'validated_match_needs_bloque6_correction');
  assert.equal(first.data.matchId, m1.match_id);
  assert.equal((await pairRows()).length, 0, 'sin decisión no se persiste nada');
  // ES OTRO PARTIDO
  const second = await create(seba, [seba.pid, leo.pid, esteban.pid, gaston], { p_sets: SETS_DIFF, p_disambiguation_force_new: true });
  assert.equal(second.data.ok, true, JSON.stringify(second.data)); assert.equal(second.data.code, 'created');
  const m2 = second.data.matchId;
  const rows = await pairRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'resolved_different');
  assert.ok(rows[0].match_low_id < rows[0].match_high_id, 'par ordenado: simétrico, no depende del orden');
  assert.deepEqual([rows[0].match_low_id, rows[0].match_high_id].sort(), [m1.match_id, m2].sort());
  assert.equal(rows[0].resolved_by_player_id, seba.pid);
  assert.equal(rows[0].resolution.decision, 'different');
  // Gastón crea cuenta y reclama su identidad.
  const nuevo = await mkUser('GastonReal');
  const res = await claim(nuevo, await inviteToken(esteban, gaston));
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.duplicateCandidates, 0, 'el par decidido NO se vuelve a detectar en el claim');
  await asUser(nuevo.uid);
  const status = await one(`select public.get_my_identity_recovery_status() as r`);
  assert.equal(status.r.openDuplicateCandidates, 0);
  const after = await pairRows();
  assert.equal(after.length, 1, 'sigue habiendo UNA fila (no se duplica)'); assert.equal(after[0].status, 'resolved_different');
  // Re-detección posterior (sync de candidatos) tampoco lo reabre.
  await asUser(nuevo.uid);
  await q(`select public.get_my_identity_recovery_status()`);
  assert.equal((await pairRows())[0].status, 'resolved_different');
  const listed = (await one(`select public.list_my_duplicate_match_candidates() as r`)).r;
  assert.equal(JSON.stringify(listed).includes(m2), false, 'la lista de candidatos del recuperado no incluye el par decidido');
});

scenario('SAME sigue funcionando: dos partidos del mismo encuentro SIN decisión previa SÍ se proponen tras el claim (control de la detección V04.29)', async () => {
  const seba = await mkUser('Seba'); const esteban = await mkUser('Esteban'); const leo = await mkUser('Leo');
  const gaston = await mkProvisional(esteban, 'Gastón');
  const slots = [esteban.pid, gaston, seba.pid, leo.pid]; const names = ['Esteban', 'Gastón', 'Seba', 'Leo'];
  await mkMatch({ creator: esteban, slots, names, daysAgo: 1, validated: true, sets: [[6, 2], [6, 2]] });
  await mkMatch({ creator: seba, slots, names, daysAgo: 1, validated: true, sets: [[6, 4], [6, 3]] });
  const nuevo = await mkUser('GastonReal');
  const res = await claim(nuevo, await inviteToken(esteban, gaston));
  assert.equal(res.ok, true);
  assert.equal(res.duplicateCandidates, 1, 'sin decisión durable, el posible duplicado se propone (comportamiento V04.29 intacto)');
  const rows = await pairRows();
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'open');
});

scenario('ES OTRO PARTIDO sobre un candidato PENDIENTE con el MISMO score también es durable; y sin candidatos no se persiste nada', async () => {
  const seba = await mkUser('Seba'); const esteban = await mkUser('Esteban'); const leo = await mkUser('Leo');
  const gaston = await mkProvisional(seba, 'Gastón');
  const ids = [seba.pid, leo.pid, esteban.pid, gaston];
  // 1) sin candidatos: crear con force_new no escribe filas
  const solo = await create(seba, ids, { p_disambiguation_force_new: true });
  assert.equal(solo.data.ok, true, JSON.stringify(solo.data));
  assert.equal((await pairRows()).length, 0);
  // 2) segundo partido idéntico (mismo score) con force_new: se crea y se persiste la decisión
  const dos = await create(seba, ids, { p_disambiguation_force_new: true });
  assert.equal(dos.data.code, 'created');
  const rows = await pairRows();
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'resolved_different');
  const nuevo = await mkUser('GastonReal');
  const res = await claim(nuevo, await inviteToken(seba, gaston));
  assert.equal(res.ok, true); assert.equal(res.duplicateCandidates, 0);
});

scenario('Un par con candidato ABIERTO que luego se resuelve como "otro partido" por create_force_new queda resolved_different (on conflict update solo desde open); resolved_same no se pisa', async () => {
  const seba = await mkUser('Seba'); const esteban = await mkUser('Esteban'); const leo = await mkUser('Leo');
  const ids = [seba.pid, leo.pid, esteban.pid];
  const g = await mkUser('Gaston');
  const slots = [esteban.pid, g.pid, seba.pid, leo.pid]; const names = ['Esteban', 'Gaston', 'Seba', 'Leo'];
  const a = await mkMatch({ creator: esteban, slots, names, daysAgo: 1, validated: true, sets: [[6, 2], [6, 2]] });
  const b = await mkMatch({ creator: seba, slots, names, daysAgo: 1, validated: true, sets: [[6, 4], [6, 3]] });
  const [lo, hi] = [a.match_id, b.match_id].sort();
  await q(`insert into public.match_duplicate_candidates (match_low_id, match_high_id, target_player_id, status) values ($1,$2,$3,'resolved_same')`, [lo, hi, g.pid]);
  // un tercer partido forzado como nuevo NO pisa la resolución same del par anterior
  const c = await create(seba, [seba.pid, leo.pid, esteban.pid, g.pid], { p_disambiguation_force_new: true });
  assert.equal(c.data.ok, true, JSON.stringify(c.data));
  const rows = await pairRows();
  const same = rows.find((r) => r.match_low_id === lo && r.match_high_id === hi);
  assert.equal(same.status, 'resolved_same', 'SAME ya resuelto no se modifica');
  assert.equal(rows.filter((r) => r.status === 'resolved_different').length, 2, 'el nuevo partido queda marcado como distinto de los dos existentes');
});
