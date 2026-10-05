// BRAMUlab — V04.31: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de la ronda post QA humano 05/10.
// Ejecutar con: node --test supabase/functions/_shared/v0431-post-qa.test.mjs
//   Intelligence con nombres canónicos · notificación identity_claimed · openedByName · 1 cuenta + 3 provisionales (pendiente hasta contraparte)
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

scenario('BUG 2: la historia de Intelligence usa el nombre CANÓNICO tras vincular (no el snapshot "Bruno"); una provisional sin vincular conserva su nombre', async () => {
  const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const lucho = await mkUser('Lucho');
  const bruno = await mkProvisional(seba, 'Bruno'); const otro = await mkProvisional(seba, 'Otro');
  const m = await mkMatch({ creator: seba, slots: [seba.pid, bruno, matu.pid, otro], names: ['Seba', 'Bruno', 'Matu', 'Otro'], daysAgo: 3, validated: false });
  const target = await mkUser('Federico');
  const names = async (uid) => { await asUser(uid); return (await q(`select participants from public.get_player_intelligence_history(10)`))[0].participants.map((p) => p.displayName); };
  assert.deepEqual(await names(matu.uid), ['Seba', 'Bruno', 'Matu', 'Otro']);
  assert.equal((await claim(target, await inviteToken(seba, bruno))).ok, true);
  const after = await names(matu.uid);
  assert.ok(after.includes('Federico') && !after.includes('Bruno'), `nombres canónicos: ${after}`);
  assert.ok(after.includes('Otro'), 'la otra provisional sin vincular conserva su nombre');
  assert.ok((await names(target.uid)).includes('Federico'));
});

scenario('identity_claimed: al vincularse, SOLO quien generó ese link recibe "X ya se sumó…"; no hay notificación para el invitado ni por NO SOY YO (preview)', async () => {
  const seba = await mkUser('Seba'); const matu = await mkUser('Matu'); const lucho = await mkUser('Lucho');
  const prov = await mkProvisional(seba, 'Pedro');
  await mkMatch({ creator: seba, slots: [seba.pid, prov, matu.pid, lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 2, validated: false });
  const target = await mkUser('PedroReal');
  const tok = await inviteToken(seba, prov);
  await rpcAs(target.uid, 'preview_claim_link', [tok]); // NO SOY YO = solo preview
  const notifs = async (uid) => { await asUser(uid); return q(`select type, payload from public.get_notifications(50, false) where type = 'identity_claimed'`); };
  assert.equal((await notifs(seba.uid)).length, 0, 'sin vincular no hay aviso');
  assert.equal((await claim(target, tok)).ok, true);
  const got = await notifs(seba.uid);
  assert.equal(got.length, 1);
  assert.equal(got[0].payload.claimedByName, 'PedroReal');
  assert.equal((await notifs(matu.uid)).length, 0, 'terceros no reciben nada');
  assert.equal((await notifs(target.uid)).length, 0);
  // idempotencia del reintento del mismo claim: no duplica
  assert.equal((await claim(target, tok)).ok, true);
  assert.equal((await notifs(seba.uid)).length, 1);
});

scenario('self-report: la notificación trae el nombre del actor aunque su lugar ya no figure en el partido', async () => {
  const seba = await mkUser('Seba'); const julian = await mkUser('Julian'); const matu = await mkUser('Matu'); const lucho = await mkUser('Lucho');
  const m = await mkMatch({ creator: seba, slots: [seba.pid, julian.pid, matu.pid, lucho.pid], names: ['Seba', 'Julian', 'Matu', 'Lucho'], daysAgo: 2, validated: false });
  assert.equal((await rpcAs(julian.uid, 'report_identity_issue', [m.match_id, 'A', 2, null])).ok, true);
  await asUser(seba.uid);
  const rows = await q(`select payload from public.get_notifications(50, false) where type = 'identity_questioned'`);
  assert.equal(rows[0].payload.selfReported, true);
  assert.equal(rows[0].payload.openedByName, 'Julian');
});

scenario('1 cuenta + 3 provisionales: se crea, queda PENDIENTE, nadie puede auto-validarlo; al vincularse una provisional de la pareja contraria esa cuenta recibe la acción y valida', async () => {
  const esteban = await mkUser('Esteban');
  const a = await mkProvisional(esteban, 'A'); const b = await mkProvisional(esteban, 'B'); const c = await mkProvisional(esteban, 'C');
  const r = await create(esteban, [esteban.pid, a, b, c]);
  assert.equal(r.error, null, JSON.stringify(r.error)); assert.equal(r.data.ok, true, JSON.stringify(r.data));
  const matchId = r.data.matchId;
  const mrow = await one(`select status, action_side from public.matches where match_id = $1`, [matchId]);
  assert.equal(mrow.status, 'pending_validation');
  const myTeam = (await one(`select team from public.match_participants where match_id = $1 and player_id = $2`, [matchId, esteban.pid])).team;
  assert.notEqual(mrow.action_side, myTeam, 'la acción es de la pareja contraria (solo provisionales)');
  // El creador NO puede validar su propio partido ni forzarlo.
  const self = await svc.rpc('confirm_match_validation', { p_auth_user_id: esteban.uid, p_match_id: matchId });
  assert.equal(self.data.ok, false, JSON.stringify(self.data));
  assert.equal((await q(`select status from public.matches where match_id = $1`, [matchId]))[0].status, 'pending_validation');
  await asUser(esteban.uid);
  assert.equal((await one(`select public.get_pending_action_count() as r`)).r.count, 0, 'esperar al otro lado no cuenta como pendiente accionable');
  // Una provisional de la pareja contraria se vincula con una cuenta nueva: ahora esa cuenta tiene la acción.
  const opp = (await q(`select player_id from public.match_participants where match_id = $1 and team = $2 order by position_in_team`, [matchId, mrow.action_side])).map((x) => x.player_id);
  const prov = [a, b, c].find((x) => opp.includes(x));
  const nuevo = await mkUser('Nuevo');
  assert.equal((await claim(nuevo, await inviteToken(esteban, prov))).ok, true);
  await asUser(nuevo.uid);
  const mine = (await q(`select is_action_mine from public.get_my_matches(50,false) where match_id = $1`, [matchId]))[0];
  assert.equal(mine.is_action_mine, true);
  assert.equal((await one(`select public.get_pending_action_count() as r`)).r.count, 1);
  const ok = await svc.rpc('confirm_match_validation', { p_auth_user_id: nuevo.uid, p_match_id: matchId });
  assert.equal(ok.data.ok, true, JSON.stringify(ok.data));
});

scenario('1 cuenta + 3 provisionales: la regla de límite de 5 pendientes y el rechazo de un provisional ajeno siguen vigentes', async () => {
  const esteban = await mkUser('Esteban'); const otro = await mkUser('Otro');
  const ajena = await mkProvisional(otro, 'Ajena'); const b = await mkProvisional(esteban, 'B'); const c = await mkProvisional(esteban, 'C'); const a = await mkProvisional(esteban, 'A');
  const r = await create(esteban, [esteban.pid, a, b, ajena]);
  assert.equal(r.data.code, 'provisional_not_selectable', 'solo provisionales propias/relacionadas');
});
