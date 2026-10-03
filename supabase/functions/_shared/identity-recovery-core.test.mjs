// BRAMUlab — V04.29: pruebas END-TO-END del replay de Nivel de una recuperación de identidad.
// Ejecutar con: node --test supabase/functions/_shared/identity-recovery-core.test.mjs
//
// Usa una base PGlite REPLAYADA desde cero (Postgres real, TODAS las migraciones) + el motor JS REAL compartido
// (engine/level/level-context/match-sync/match-level-engine cargados como en el navegador) + el núcleo
// identity-recovery-core.mjs que la Edge `process-identity-recovery` importa. Cada escenario corre dentro de una
// transacción que termina en ROLLBACK, así que no hay fixtures residuales.
//
// Cubre (lista obligatoria 116 §10): cuenta nueva desde invitación, cuenta existente, dos provisionales -> misma cuenta,
// Nivel con evidencia suficiente / sin snapshot / fuera de ventana, CALIBRANDO avanza, 5+3 cierra calibración, CALIBRADO no se
// descalibra, terceros conservan deltas, ranking_rows publicadas intactas, legal_acceptances intacta, idempotencia,
// duplicado SAME con doble efecto + reversión estrecha idempotente, DIFFERENT conserva ambos, Stats/Grupos sin doble conteo.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { makePgliteAdminClient } from '../../scripts/pglite-admin-client.mjs';
import { processIdentityRecoveryLevel, processPendingRecoveriesForPlayer } from './identity-recovery-core.mjs';
import { officializeMatch } from './match-officialize-core.ts';

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
const levelOf = (pid) => one(`select status, mu::float8 as mu, confidence::float8 as confidence, evidence_units::float8 as evidence_units, rated_matches, distinct_opponents, last_rated_at from public.level_states where player_id = $1`, [pid]);
const snapshotThirdParties = async (excludePid) => ({
  levels: await q(`select player_id, status, mu::text, confidence::text, evidence_units::text, rated_matches, distinct_opponents from public.level_states where player_id <> $1 order by player_id`, [excludePid]),
  results: await q(`select result_id, player_id, mu_after::text, confidence_after::text, delta_capped::text, original_live_mu_before::text from public.match_level_result_players where player_id <> $1 order by result_id, player_id`, [excludePid]),
  events: (await one(`select count(*)::int n from public.level_events where player_id <> $1`, [excludePid])).n,
});

/** Mundo base: Seba/Matu/Lucho (CALIBRADOS) + provisional "Pedro" creada por Seba; N partidos validados donde juega Pedro. */
async function world({ matches = 3, rivalsRotation = true } = {}) {
  const seba = await mkUser('Seba', { status: 'CALIBRADO', mu: 5.5, confidence: 0.8, rated: 9, distinct: 6 });
  const matu = await mkUser('Matu', { status: 'CALIBRADO', mu: 5.0, confidence: 0.75, rated: 9, distinct: 6 });
  const lucho = await mkUser('Lucho', { status: 'CALIBRADO', mu: 4.5, confidence: 0.7, rated: 9, distinct: 6 });
  const nico = await mkUser('Nico', { status: 'CALIBRADO', mu: 6.0, confidence: 0.7, rated: 9, distinct: 6 });
  const pedro = await mkProvisional(seba, 'Pedro');
  const ms = [];
  for (let i = 0; i < matches; i += 1) {
    const rivals = rivalsRotation && i % 2 ? [lucho, nico] : [matu, lucho];
    ms.push(await mkMatch({
      creator: seba, slots: [seba.pid, pedro, rivals[0].pid, rivals[1].pid], names: ['Seba', 'Pedro', rivals[0].key, rivals[1].key],
      daysAgo: 12 - i, result: { priors: priors([seba.pid, 5.5, 0.8], [rivals[0].pid, rivals[0].key === 'Matu' ? 5.0 : 4.5, 0.75], [rivals[1].pid, rivals[1].key === 'Lucho' ? 4.5 : 6.0, 0.7]) },
    }));
  }
  return { seba, matu, lucho, nico, pedro, ms };
}
const inviteToken = async (inviter, provisionalId) => rpcAs(inviter.uid, 'create_claim_link', [provisionalId]);
const claim = async (target, token) => rpcAs(target.uid, 'claim_provisional_player', [token]);
async function onboard(target, mu = 4.0, confidence = 0.45) {
  await svc.rpc('officialize_level_onboarding', {
    p_auth_user_id: target.uid, p_algorithm_version: sandbox.PLLevel.ALGORITHM_VERSION, p_questionnaire_version: 'nivel_inicial_v1_3',
    p_questionnaire_mode: 'full', p_mu: mu, p_confidence: confidence, p_declared_category: null, p_category_context_key: null,
    p_input_context: {}, p_result: { confirmedLevel: mu, confidenceOrigin: confidence },
  });
}

// ------------------------------------------------------------------ escenarios
scenario('cuenta NUEVA desde invitación: vincula antes del Nivel, espera Nivel base, luego replay solo del target (terceros intactos, legal intacta, ranking intacto)', async () => {
  const w = await world({ matches: 3 });
  const pedroAcc = await mkUser('PedroReal'); // alta nueva: bootstrap con legal_acceptances + level_states PENDIENTE
  const legalBefore = await q(`select acceptance_id, player_id, legal_version, accepted_at, source from public.legal_acceptances where player_id = $1`, [pedroAcc.pid]);
  assert.equal(legalBefore.length, 1, 'el bootstrap tiene su aceptación legal append-only');
  // Edición de Ranking ya PUBLICADA con una fila de un tercero: debe quedar byte a byte igual.
  const ed = (await one(`insert into public.ranking_editions (period_start_at, period_end_at) values (now() - interval '14 days', now() - interval '7 days') returning edition_id`)).edition_id;
  await q(`insert into public.ranking_rows (edition_id, player_id, scope_type, scope_key, is_eligible, position, tie_group, total_eligible, density_status, level_internal, level_public, level_band, level_status, ranking_rules_version)
           values ($1, $2, 'global', 'global', true, 1, 1, 3, 'established', 5.5, 5.5, 5, 'CALIBRADO', 'ranking_v1')`, [ed, w.seba.pid]);
  const rankingBefore = JSON.stringify(await q(`select * from public.ranking_rows order by 1,2`));
  assert.equal(JSON.parse(rankingBefore).length, 1);
  const before3 = await snapshotThirdParties(pedroAcc.pid);

  const token = await inviteToken(w.seba, w.pedro);
  const r = await claim(pedroAcc, token);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.matchCount, 3);
  assert.equal(r.levelPending, true);

  // El Nivel inicial todavía no existe: el replay espera sin tocar nada.
  const wait = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(wait.status, 'pending_level');
  assert.equal((await q(`select count(*)::int n from public.level_recovery_effects`))[0].n, 0);

  await onboard(pedroAcc, 4.0, 0.45);
  const res = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(res.status, 'completed', JSON.stringify(res));
  assert.equal(res.applied, 3);

  const lv = await levelOf(pedroAcc.pid);
  assert.equal(lv.status, 'CALIBRANDO');
  assert.equal(lv.rated_matches, 3, 'CALIBRANDO 3/5 gracias a la evidencia recuperada');
  assert.ok(lv.distinct_opponents >= 3);
  assert.ok(lv.evidence_units > 0);

  // Terceros conservan sus deltas y niveles históricos (ni una fila ni un evento nuevo para ellos).
  const after3 = await snapshotThirdParties(pedroAcc.pid);
  assert.deepEqual(after3, before3, 'ningún tercero fue tocado por el replay');
  // El target aparece como participante del resultado vigente de cada partido (fila propia) y en el ledger.
  assert.equal((await q(`select count(*)::int n from public.match_level_result_players where player_id = $1`, [pedroAcc.pid]))[0].n, 3);
  assert.equal((await q(`select count(*)::int n from public.level_recovery_effects where status = 'applied'`))[0].n, 3);
  // Legal intacta y única identidad activa: la cuenta; la provisional es tombstone auditable.
  assert.deepEqual(await q(`select acceptance_id, player_id, legal_version, accepted_at, source from public.legal_acceptances where player_id = $1`, [pedroAcc.pid]), legalBefore);
  assert.equal((await one(`select is_active, recovered_into_player_id from public.players where player_id = $1`, [w.pedro])).is_active, false);
  assert.equal(JSON.stringify(await q(`select * from public.ranking_rows order by 1,2`)), rankingBefore, 'ranking_rows publicadas intactas');
  // Idempotencia: reintentar no duplica nada.
  const again = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(again.status, 'completed');
  assert.equal(again.idempotentReturn, true);
  assert.equal((await q(`select count(*)::int n from public.level_recovery_effects`))[0].n, 3);
  assert.deepEqual(await levelOf(pedroAcc.pid), lv);
});

scenario('usa snapshots HISTÓRICOS de compañero/rivales, nunca sus niveles actuales (el efecto coincide con el motor sobre priorSnapshots)', async () => {
  const w = await world({ matches: 1 });
  const t = await mkUser('Tgt', { status: 'CALIBRANDO', mu: 4.2, confidence: 0.5, rated: 0, distinct: 0 });
  // Los niveles ACTUALES de terceros divergen fuertemente de los de ese partido.
  await q(`update public.level_states set mu = 9.0 where player_id in ($1,$2,$3)`, [w.seba.pid, w.matu.pid, w.lucho.pid]);
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.ok, true);
  const before = await levelOf(t.pid);
  const res = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(res.status, 'completed');
  const eff = await one(`select * from public.level_recovery_effects where recovery_id = $1`, [r.recoveryId]);
  assert.equal(eff.status, 'applied');
  const used = eff.snapshots_used.others.map((o) => [o.playerId, o.muBefore]).sort();
  assert.deepEqual(used, [[w.matu.pid, 5.0], [w.lucho.pid, 4.5], [w.seba.pid, 5.5]].sort(), 'snapshots históricos reales (no el mu actual = 9.0)');
  // Recalcular con el motor directo sobre esos mismos snapshots debe dar el mismo efecto.
  const snap = (await one(`select public.get_match_officialization_snapshot($1) s`, [w.ms[0].match_id])).s;
  const states = {};
  snap.priorSnapshots.filter((p) => p.playerId !== t.pid).forEach((p) => { states[p.playerId] = { mu: p.muBefore, confidence: p.confidenceBefore, state: MLE.mapLevelStateStatusToEngineState(p.state) }; });
  states[t.pid] = MLE.buildPlayerStatesDict([{ playerId: t.pid, mu: before.mu, confidence: before.confidence, status: 'CALIBRANDO', lastRatedAt: before.last_rated_at }], snap.playedAt)[t.pid];
  const local = sandbox.PLMatchSync.translateServerMatchToLocalShape(snap);
  const off = MLE.computeOfficializationResult({ localMatch: local, history: [], playerStates: states, validatedAtIso: snap.validatedAt });
  const { levelStateUpdates } = MLE.computeLevelStateUpdates({ oldAppliedResult: null, engineOutput: off.engineOutput, guestPlayerIds: off.guestPlayerIds, currentLevelStatesByPlayerId: { [t.pid]: { mu: before.mu, confidence: before.confidence, evidenceUnits: before.evidence_units, lastRatedAt: before.last_rated_at } } });
  const expected = levelStateUpdates.find((u) => u.playerId === t.pid);
  const after = await levelOf(t.pid);
  assert.ok(Math.abs(after.mu - expected.finalMu) < 1e-3, `mu ${after.mu} vs motor ${expected.finalMu}`);
  assert.ok(Math.abs(after.confidence - expected.finalConfidence) < 1e-3);
});

scenario('sin evidencia suficiente NO se inventa: partido sin resultado de Nivel = skipped_missing_snapshot; pendiente/fuera de ventana/no elegible = skipped_ineligible; todos quedan en Historial', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Tgt2', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const slots = [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid];
  const names = ['Seba', 'Pedro', 'Matu', 'Lucho'];
  const okM = await mkMatch({ creator: w.seba, slots, names, daysAgo: 20, result: { priors: priors([w.seba.pid], [w.matu.pid], [w.lucho.pid]) } });
  const noResult = await mkMatch({ creator: w.seba, slots, names, daysAgo: 19 });                       // validado, sin resultado vigente
  const pending = await mkMatch({ creator: w.seba, slots, names, daysAgo: 18, validated: false });     // todavía pendiente
  const late = await mkMatch({ creator: w.seba, slots, names, daysAgo: 17, validatedAfterDays: 31, result: { priors: priors([w.seba.pid], [w.matu.pid], [w.lucho.pid]), eligible: false } }); // fuera de ventana de 30 días
  const inelig = await mkMatch({ creator: w.seba, slots, names, daysAgo: 16, result: { eligible: false, priors: priors([w.seba.pid]) } }); // original no elegible
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.matchCount, 5);
  const res = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(res.status, 'completed', JSON.stringify(res));
  const byMatch = Object.fromEntries((await q(`select match_id, status, reason_codes from public.level_recovery_effects where recovery_id = $1`, [r.recoveryId])).map((e) => [e.match_id, e]));
  assert.equal(byMatch[okM.match_id].status, 'applied');
  assert.equal(byMatch[noResult.match_id].status, 'skipped_missing_snapshot');
  assert.equal(byMatch[pending.match_id].status, 'skipped_ineligible');
  assert.deepEqual(byMatch[pending.match_id].reason_codes, ['partido_no_validado']);
  assert.equal(byMatch[late.match_id].status, 'skipped_ineligible');
  assert.deepEqual(byMatch[late.match_id].reason_codes, [MLE.REASON_OUTSIDE_NIVEL_WINDOW]);
  assert.equal(byMatch[inelig.match_id].status, 'skipped_ineligible');
  // Los 5 partidos pasan a Historial/Stats del target (verdad de participantes), solo 1 produjo Nivel.
  const hist = await rpcAs(t.uid, 'get_my_matches', [50, true]).catch(() => null);
  assert.equal((await q(`select count(distinct match_id)::int n from public.match_participants where player_id = $1`, [t.pid]))[0].n, 5);
  assert.equal((await levelOf(t.pid)).rated_matches, 1);
  void hist;
});

scenario('CALIBRANDO 0/5 cierra con 5 partidos + 3 rivales distintos gracias a la evidencia recuperada; con 5 partidos y 2 rivales sigue calibrando', async () => {
  // 5 partidos, rivales rotando entre {Matu,Lucho} y {Lucho,Nico} -> 3 rivales distintos.
  const w = await world({ matches: 5 });
  const t = await mkUser('Cal5', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const lv = await levelOf(t.pid);
  assert.equal(lv.rated_matches, 5);
  assert.ok(lv.distinct_opponents >= 3);
  assert.equal(lv.status, 'CALIBRADO', '5 partidos + >=3 rivales distintos cierran la calibración');
});

scenario('5 partidos pero solo 2 rivales distintos NO cierra calibración (sigue CALIBRANDO)', async () => {
  const w = await world({ matches: 5, rivalsRotation: false }); // siempre Matu+Lucho
  const t = await mkUser('Cal52', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const lv = await levelOf(t.pid);
  assert.equal(lv.rated_matches, 5);
  assert.equal(lv.distinct_opponents, 2);
  assert.equal(lv.status, 'CALIBRANDO');
});

scenario('cuenta existente CALIBRADA: aporta evidencia y mueve el Nivel actual pero NO se descalibra; conserva su identidad como destino', async () => {
  const w = await world({ matches: 2 });
  const t = await mkUser('Vet', { status: 'CALIBRADO', mu: 6.5, confidence: 0.85, rated: 0, distinct: 0 });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.ok, true);
  assert.equal((await one(`select player_id from public.players where auth_user_id = $1`, [t.uid])).player_id, t.pid, 'la cuenta conserva su player_id');
  const before = await levelOf(t.pid);
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const after = await levelOf(t.pid);
  assert.equal(after.status, 'CALIBRADO');
  assert.notEqual(after.mu, before.mu, 'el Nivel vigente se movió por la evidencia recuperada');
  assert.ok(after.evidence_units > before.evidence_units);
  assert.equal(after.rated_matches, 2, 'sus partidos recuperados cuentan; el estado CALIBRADO se conserva aunque el conteo derivado sea < 5');
});

scenario('dos provisionales -> la MISMA cuenta, una por una, cada una con su link, recovery_id e idempotencia propios', async () => {
  const w = await world({ matches: 2 });
  const pedrito = await mkProvisional(w.seba, 'Pedrito');
  await mkMatch({ creator: w.seba, slots: [w.seba.pid, pedrito, w.matu.pid, w.nico.pid], names: ['Seba', 'Pedrito', 'Matu', 'Nico'], daysAgo: 8, result: { priors: priors([w.seba.pid], [w.matu.pid], [w.nico.pid, 6.0]) } });
  const t = await mkUser('Pedro2', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const r1 = await claim(t, await inviteToken(w.seba, w.pedro));
  const r2 = await claim(t, await inviteToken(w.seba, pedrito));
  assert.equal(r1.ok, true); assert.equal(r2.ok, true);
  assert.notEqual(r1.recoveryId, r2.recoveryId);
  const all = await processPendingRecoveriesForPlayer(svc, t.pid);
  assert.equal(all.results.length, 2);
  assert.ok(all.results.every((x) => x.status === 'completed'));
  assert.equal((await levelOf(t.pid)).rated_matches, 3);
  // Reintentar el MISMO token de la primera no duplica nada.
  const token2 = await inviteToken(w.seba, w.pedro).catch((e) => String(e.message));
  assert.match(String(token2), /provisional_not_found/, 'una provisional ya recuperada deja de ser invitable');
});

scenario('reintento de red del claim por la misma cuenta es idempotente (mismo recovery, sin duplicar)', async () => {
  const w = await world({ matches: 1 });
  const t = await mkUser('Retry');
  const token = await inviteToken(w.seba, w.pedro);
  const a = await claim(t, token);
  const b = await claim(t, token);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.equal(b.idempotentReturn, true);
  assert.equal(b.recoveryId, a.recoveryId);
  assert.equal((await q(`select count(*)::int n from public.player_identity_recoveries where status = 'completed'`))[0].n, 1);
});

scenario('lease: un procesador a la vez; un efecto ya aplicado se devuelve idempotente y no duplica la fila del target', async () => {
  const w = await world({ matches: 1 });
  const t = await mkUser('Lease', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  const l1 = (await one(`select public.acquire_identity_recovery_level_lease($1, 120) as t`, [r.recoveryId])).t;
  assert.ok(l1);
  const busy = await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.equal(busy.status, 'busy', 'con el lease tomado otro procesador no avanza');
  await q(`select public.release_identity_recovery_level_lease($1, $2, null)`, [r.recoveryId, l1]);
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  assert.equal((await q(`select count(*)::int n from public.match_level_result_players where player_id = $1`, [t.pid]))[0].n, 1);
});

scenario('DUPLICADO ya oficial con doble efecto: SÍ, ES EL MISMO anula el extra, revierte SOLO ese efecto (target + terceros del duplicado) y es idempotente; Stats/Grupos cuentan una vez', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Dup', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const slotsProv = [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid];
  // M1: Seba cargó con "Pedro" provisional (validado, con efecto). M2: la cuenta real cargó el MISMO encuentro con su cuenta (validado, con efecto).
  const m1 = await mkMatch({ creator: w.seba, slots: slotsProv, names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 9, result: { priors: priors([w.seba.pid], [w.matu.pid, 5.0], [w.lucho.pid, 4.5]) } });
  const m2 = await mkMatch({ creator: t, slots: [w.seba.pid, t.pid, w.matu.pid, w.lucho.pid], names: ['Seba', 'Dup', 'Matu', 'Lucho'], daysAgo: 9, validatedAfterDays: 2,
    result: { priors: priors([w.seba.pid], [t.pid, 4.0, 0.5, 'CALIBRANDO'], [w.matu.pid, 5.0], [w.lucho.pid, 4.5]) } });
  // Distinta huella hasta vincular -> no eran candidatos. Al vincular, M1 pasa a tener los mismos 4 jugadores que M2.
  assert.equal((await q(`select count(*)::int n from public.match_duplicate_candidates`))[0].n, 0);
  const sebaBefore = await levelOf(w.seba.pid);
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  // Conflicto de slot NO aplica acá (el target no estaba en M1). Pero M1 y M2 tienen la misma composición ahora.
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.duplicateCandidates, 1);
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const tAfterRecovery = await levelOf(t.pid);
  assert.equal((await q(`select count(*)::int n from public.match_level_result_players where player_id = $1`, [t.pid]))[0].n, 2, 'M2 ya la tenía de origen; M1 (recuperado) agregó la suya');
  assert.equal((await q(`select count(*)::int n from public.level_recovery_effects where status = 'applied'`))[0].n, 1);

  const cands = await rpcAs(t.uid, 'list_my_duplicate_match_candidates');
  assert.equal(cands.candidates.length, 1);
  assert.equal(cands.candidates[0].matches.length, 2);
  const cid = cands.candidates[0].candidateId;

  // Un tercero no puede resolver ni ver el candidato.
  const outsider = await rpcAs(w.seba.uid, 'resolve_duplicate_match_candidate', [cid, 'same']);
  assert.equal(outsider.code, 'candidate_not_found');
  assert.equal((await rpcAs(w.seba.uid, 'list_my_duplicate_match_candidates')).candidates.length, 0);

  const res = await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'same']);
  assert.equal(res.ok, true, JSON.stringify(res));
  // Canónico = el validado primero (M1: validated_at más antiguo); M2 es el extra.
  assert.equal(res.canonicalMatchId, m1.match_id);
  assert.equal(res.annulledMatchId, m2.match_id);
  assert.equal((await one(`select status from public.matches where match_id = $1`, [m2.match_id])).status, 'annulled');
  assert.equal((await one(`select effect_status from public.match_level_results where result_id = $1`, [m2.resultId])).effect_status, 'reverted');
  assert.equal((await one(`select effect_status from public.match_level_results where result_id = $1`, [m1.resultId])).effect_status, 'applied', 'el efecto canónico se conserva');
  // Un solo partido efectivo en Stats/Grupos (derivan de validated).
  assert.equal((await q(`select count(*)::int n from public.matches m join public.match_participants mp on mp.match_id = m.match_id
                         where mp.player_id = $1 and m.status = 'validated'`, [t.pid]))[0].n, 1);
  // Historia preservada: nada se borró (revisiones/acciones de ambas cargas siguen).
  assert.equal((await q(`select count(*)::int n from public.match_revisions where match_id in ($1,$2)`, [m1.match_id, m2.match_id]))[0].n, 2);
  assert.ok((await q(`select count(*)::int n from public.match_actions where match_id = $1 and action_type = 'annulled'`, [m2.match_id]))[0].n === 1);
  // El efecto extra (de M2) se revirtió también sobre los terceros de ESE duplicado; el de M1 sigue (doble efecto => uno).
  const sebaAfter = await levelOf(w.seba.pid);
  const derived = (await one(`select count(distinct mlr.match_id)::int n from public.match_level_result_players mlrp
      join public.match_level_results mlr on mlr.result_id = mlrp.result_id where mlrp.player_id = $1 and mlr.effect_status = 'applied' and mlr.eligible`, [w.seba.pid])).n;
  assert.equal(derived, 1, 'Seba conserva UN solo efecto aplicado (el canónico): el doble efecto se eliminó');
  assert.equal(sebaAfter.rated_matches, derived, 'contadores derivados de la verdad vigente, sin recalcular historia de terceros');
  assert.ok(sebaBefore.evidence_units === 0 && sebaAfter.evidence_units === 0, 'la fixture no fabrica evidencia previa y el revert pura no la vuelve negativa');
  // Idempotencia: repetir la misma decisión devuelve lo mismo y no revierte dos veces.
  const sebaLevelsBeforeRepeat = JSON.stringify(await snapshotThirdParties(t.pid));
  const again = await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'same']);
  assert.equal(again.ok, true); assert.equal(again.idempotentReturn, true);
  assert.equal(JSON.stringify(await snapshotThirdParties(t.pid)), sebaLevelsBeforeRepeat);
  assert.equal((await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'different'])).code, 'already_resolved');
  void tAfterRecovery;
});

scenario('DUPLICADO: el efecto de recuperación del extra se revierte de forma estrecha (ledger reverted_duplicate) cuando el duplicado es el partido recuperado', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Dup2', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  // M2 (cuenta real) validado PRIMERO; M1 (provisional) validado después => canónico M2, extra = M1 (que recibirá efecto de recuperación).
  const m2 = await mkMatch({ creator: t, slots: [w.seba.pid, t.pid, w.matu.pid, w.lucho.pid], names: ['Seba', 'Dup2', 'Matu', 'Lucho'], daysAgo: 9, validatedAfterDays: 1,
    result: { priors: priors([w.seba.pid], [t.pid, 4.0, 0.5, 'CALIBRANDO'], [w.matu.pid], [w.lucho.pid]) } });
  const m1 = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 9, validatedAfterDays: 3,
    result: { priors: priors([w.seba.pid], [w.matu.pid], [w.lucho.pid]) } });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const eff = await one(`select effect_id, status from public.level_recovery_effects where match_id = $1`, [m1.match_id]);
  assert.equal(eff.status, 'applied');
  const lvWithBoth = await levelOf(t.pid);
  const cid = (await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates[0].candidateId;
  const res = await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'same']);
  assert.equal(res.canonicalMatchId, m2.match_id);
  assert.equal(res.annulledMatchId, m1.match_id);
  const eff2 = await one(`select status, reverted_at, reverted_reason, resolution_candidate_id from public.level_recovery_effects where effect_id = $1`, [eff.effect_id]);
  assert.equal(eff2.status, 'reverted_duplicate');
  assert.ok(eff2.reverted_at && eff2.reverted_reason.startsWith('duplicate_of:'));
  assert.equal(eff2.resolution_candidate_id, cid);
  // El target quedó con UN solo efecto: el de M2 (origen); el de M1 se revirtió (mu/evidence vuelven al estado sin ese partido).
  const lvAfter = await levelOf(t.pid);
  assert.ok(lvAfter.evidence_units < lvWithBoth.evidence_units, 'se retiró la evidencia del duplicado');
  assert.equal(lvAfter.rated_matches, 1, 'M2 sigue contando, M1 ya no');
  assert.equal((await one(`select effect_status from public.match_level_results where result_id = $1`, [m1.resultId])).effect_status, 'reverted');
});

scenario('DUPLICADO: NO, SON DISTINTOS conserva ambos, no toca efectos y el par no se vuelve a ofrecer', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Dup3', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m1 = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 9, result: { priors: priors([w.seba.pid], [w.matu.pid], [w.lucho.pid]) } });
  const m2 = await mkMatch({ creator: t, slots: [w.seba.pid, t.pid, w.matu.pid, w.lucho.pid], names: ['Seba', 'Dup3', 'Matu', 'Lucho'], daysAgo: 9, validatedAfterDays: 2,
    result: { priors: priors([w.seba.pid], [t.pid, 4.0, 0.5, 'CALIBRANDO'], [w.matu.pid], [w.lucho.pid]) } });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  await processIdentityRecoveryLevel(svc, r.recoveryId);
  const lvBefore = await levelOf(t.pid);
  const cid = (await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates[0].candidateId;
  const res = await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'different']);
  assert.equal(res.ok, true);
  assert.equal((await q(`select count(*)::int n from public.matches where status = 'validated' and match_id in ($1,$2)`, [m1.match_id, m2.match_id]))[0].n, 2);
  assert.deepEqual(await levelOf(t.pid), lvBefore);
  assert.equal((await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates.length, 0);
  // Re-detección posterior no vuelve a crear/abrir el par resuelto.
  await q(`select public._detect_duplicate_candidates($1, $2, $3)`, [m1.match_id, r.recoveryId, t.pid]);
  assert.equal((await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates.length, 0);
});

scenario('DUPLICADO pending + pending con score distinto: SÍ pliega la declaración como revisión propuesta (mecanismo vigente) y conserva ambas cargas', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Dup4', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m1 = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 1, validated: false, sets: [[6, 4], [6, 3]] });
  const m2 = await mkMatch({ creator: t, slots: [t.pid, w.seba.pid, w.matu.pid, w.lucho.pid], names: ['Dup4', 'Seba', 'Matu', 'Lucho'], daysAgo: 1, validated: false, sets: [[6, 2], [6, 2]] });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.duplicateCandidates, 1);
  const cid = (await rpcAs(t.uid, 'list_my_duplicate_match_candidates')).candidates[0].candidateId;
  const res = await rpcAs(t.uid, 'resolve_duplicate_match_candidate', [cid, 'same']);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.fold.folded, true);
  const canonical = res.canonicalMatchId;
  const secondary = res.annulledMatchId;
  assert.equal(new Set([canonical, secondary]).size, 2);
  assert.equal((await one(`select status from public.matches where match_id = $1`, [secondary])).status, 'annulled');
  // Los scores difieren -> el canónico recibió una revisión propuesta (revision_number 2), sin borrar la original.
  assert.equal(res.fold.outcome, 'revised');
  assert.equal((await q(`select count(*)::int n from public.match_revisions where match_id = $1`, [canonical]))[0].n, 2);
  assert.equal((await q(`select count(*)::int n from public.match_revisions where match_id in ($1,$2)`, [m1.match_id, m2.match_id]))[0].n, 3);
  void m1; void m2;
});

scenario('un partido de la provisional donde el target YA figura en otro slot => identity_conflict, CERO mutación, el link no se consume y queda auditado', async () => {
  const w = await world({ matches: 1 });
  const t = await mkUser('Conf', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  // Un partido donde el target ya está y la provisional ocupa OTRO slot (misma persona dos veces).
  await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, t.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Conf', 'Lucho'], daysAgo: 4, result: { priors: priors([w.seba.pid], [t.pid, 4, 0.5, 'CALIBRANDO'], [w.lucho.pid]) } });
  const token = await inviteToken(w.seba, w.pedro);
  const partsBefore = JSON.stringify(await q(`select match_id, team, position_in_team, player_id from public.match_participants order by 1,2,3`));
  const fpBefore = JSON.stringify(await q(`select match_id, participant_fingerprint from public.matches order by 1`));
  const r = await claim(t, token);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'identity_conflict');
  assert.equal(r.conflicts.length, 1);
  assert.equal(JSON.stringify(await q(`select match_id, team, position_in_team, player_id from public.match_participants order by 1,2,3`)), partsBefore);
  assert.equal(JSON.stringify(await q(`select match_id, participant_fingerprint from public.matches order by 1`)), fpBefore);
  assert.equal((await one(`select status from public.provisional_claims where token_hash = encode(extensions.digest($1,'sha256'),'hex')`, [token])).status, 'pending', 'el link NO se consume');
  assert.equal((await one(`select is_active from public.players where player_id = $1`, [w.pedro])).is_active, true);
  assert.equal((await q(`select count(*)::int n from public.player_identity_recoveries where status = 'completed'`))[0].n, 0);
  assert.equal((await q(`select attempts from public.player_identity_recoveries where status = 'blocked_conflict'`))[0].attempts, 1);
  await claim(t, token); // reintento: sigue fallando cerrado y cuenta el intento
  assert.equal((await q(`select attempts from public.player_identity_recoveries where status = 'blocked_conflict'`))[0].attempts, 2);
});

scenario('Grupos: 2/4 -> 3/4 solo si el target ya era miembro esa semana (sin inventar membresía retroactiva)', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Grp', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const nonMember = await mkUser('NoMember', { status: 'CALIBRADO', mu: 5, confidence: 0.7 });
  // Grupo con Seba + Matu + el target (miembros desde hace 60 días).
  const g = (await one(`insert into public.groups (name, created_by_player_id) values ('G', $1) returning group_id`, [w.seba.pid])).group_id;
  for (const p of [w.seba, w.matu, t]) {
    await q(`insert into public.group_memberships (group_id, player_id, is_admin, joined_at) values ($1,$2,$3, now() - interval '60 days')`, [g, p.pid, p === w.seba]);
  }
  const m = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, nonMember.pid], names: ['Seba', 'Pedro', 'Matu', 'NoMember'], daysAgo: 3,
    result: { priors: priors([w.seba.pid], [w.matu.pid], [nonMember.pid]) } });
  const countFor = async () => (await rpcAs(w.seba.uid, 'get_group_competition_data', [g])).matches.length;
  assert.equal(await countFor(), 0, 'antes del vínculo: 2/4 miembros no cuenta');
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.ok, true);
  assert.equal(await countFor(), 1, 'después: 3/4 (el target ya era miembro) cuenta');
  void m;
  // Contraejemplo: un target que NO era miembro no cambia nada.
  const w2 = await world({ matches: 0 });
  const g2 = (await one(`insert into public.groups (name, created_by_player_id) values ('G2', $1) returning group_id`, [w2.seba.pid])).group_id;
  for (const p of [w2.seba, w2.matu]) await q(`insert into public.group_memberships (group_id, player_id, is_admin, joined_at) values ($1,$2,$3, now() - interval '60 days')`, [g2, p.pid, p === w2.seba]);
  await mkMatch({ creator: w2.seba, slots: [w2.seba.pid, w2.pedro, w2.matu.pid, w2.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 3, result: { priors: priors([w2.seba.pid], [w2.matu.pid], [w2.lucho.pid]) } });
  const outsider = await mkUser('Out', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  // 2 miembros (Seba, Matu) + provisional->outsider (no miembro): sigue 2/4... pero Seba+Matu son 2 => no cuenta.
  assert.equal((await rpcAs(w2.seba.uid, 'get_group_competition_data', [g2])).matches.length, 0);
  assert.equal((await claim(outsider, await inviteToken(w2.seba, w2.pedro))).ok, true);
  assert.equal((await rpcAs(w2.seba.uid, 'get_group_competition_data', [g2])).matches.length, 0, 'no se inventa membresía retroactiva');
});

scenario('Intelligence: el fingerprint de la historia cambia cuando cambia la composición de participantes (replay de prefijos afectados)', async () => {
  // Pura (sin DB): computeHistoryFingerprint ya incluye la identidad real de participantes.
  const ictx = {};
  vm.createContext(ictx);
  for (const f of ['engine.js', 'level.js', 'level-context.js', 'match-sync.js', 'intelligence-context.js', 'intelligence-claims.js', 'intelligence-editorial.js', 'intelligence-official.js', 'intelligence-presentation.js']) {
    vm.runInContext(fs.readFileSync(path.join(BRAMULAB, f), 'utf8'), ictx, { filename: f });
  }
  const PR = ictx.PLIntelligencePresentation;
  assert.ok(PR && typeof PR.computeHistoryFingerprint === 'function');
  const mk = (pid, snapshotPlayers = []) => ({
    matchId: 'm1', playedAt: '2026-09-20T20:00:00.000Z', timeKnown: true, formatId: 'classic', scoringSystem: null, status: 'validated',
    officialEligible: true, hidden: false, hasOpenIdentityIssue: false, winnerTeam: 'A',
    sets: [{ gamesA: 6, gamesB: 4 }, { gamesA: 6, gamesB: 3 }],
    players: [{ team: 'A', userId: 'seba' }, { team: 'A', userId: pid }, { team: 'B', userId: 'matu' }, { team: 'B', userId: 'lucho' }],
    officialLevelSnapshot: ictx.PLIntelligenceOfficial.buildLevelSnapshot(
      { result_id: 'r1', match_id: 'm1', algorithm_version: 'v', eligible: true, reason_codes: [], effect_status: 'applied' },
      snapshotPlayers),
  });
  const fpBefore = PR.computeHistoryFingerprint([mk('prov-uuid')]);
  const fpAfter = PR.computeHistoryFingerprint([mk('acc-uuid')]);
  // También cambia cuando solo se agrega la fila del target recuperado al snapshot oficial del partido.
  const fpSnap = PR.computeHistoryFingerprint([mk('prov-uuid', [{ player_id: 'acc-uuid', team: 'A', mu_after: 4.1, confidence_after: 0.5, delta_capped: 0.1, formula_state: 'CALIBRANDO' }])]);
  assert.notEqual(fpBefore, fpSnap, 'la fila recuperada en el snapshot oficial también invalida el checkpoint');
  assert.notEqual(fpBefore, fpAfter, 'la identidad recuperada cambia el fingerprint => el checkpoint se regenera por replay');
});

// ------------------------------------------------------------------ regresiones focales de corrección / identidad
scenario('REGRESIÓN corrección: corregir el score de un partido RECUPERADO netea el efecto del target (no lo duplica) por el mecanismo vigente', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Corr', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 3, validatedAfterDays: 1,
    result: { priors: priors([w.seba.pid, 5.5, 0.8], [w.matu.pid, 5.0, 0.75], [w.lucho.pid, 4.5, 0.7]) } });
  const base = await levelOf(t.pid);
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal((await processIdentityRecoveryLevel(svc, r.recoveryId)).status, 'completed');
  const afterRecovery = await levelOf(t.pid);
  assert.ok(afterRecovery.evidence_units > base.evidence_units);

  // Seba (pareja A) propone invertir el resultado; Matu (pareja B) acepta; se reaplica con el núcleo REAL de oficialización.
  const sets = [{ gamesA: 3, gamesB: 6, tiebreakA: null, tiebreakB: null }, { gamesA: 3, gamesB: 6, tiebreakA: null, tiebreakB: null }];
  const prop = (await svc.rpc('propose_post_validation_correction', { p_auth_user_id: w.seba.uid, p_match_id: m.match_id, p_sets: sets })).data;
  assert.equal(prop.ok, true, JSON.stringify(prop));
  const resp = (await svc.rpc('respond_post_validation_correction', { p_auth_user_id: w.matu.uid, p_match_id: m.match_id, p_accept: true })).data;
  assert.equal(resp.ok, true, JSON.stringify(resp));
  const off = await officializeMatch(svc, m.match_id, 'correction_accepted', w.matu.pid, null);
  assert.equal(off.ok, true, JSON.stringify(off));

  const rows = await q(`select mlr.result_id, mlr.effect_status, mlrp.mu_after::float8 mu_after, mlrp.evidence_quality::float8 evidence_quality
                          from public.match_level_results mlr join public.match_level_result_players mlrp on mlrp.result_id = mlr.result_id
                         where mlr.match_id = $1 and mlrp.player_id = $2 order by mlr.computed_at, mlr.result_id`, [m.match_id, t.pid]);
  assert.equal(rows.filter((x) => x.effect_status === 'applied').length, 1, 'un solo resultado vigente con fila del target');
  const live = rows.find((x) => x.effect_status === 'applied');
  const lv = await levelOf(t.pid);
  assert.ok(Math.abs(lv.evidence_units - (base.evidence_units + live.evidence_quality)) < 1e-4, `evidencia = base + SOLO el efecto nuevo (${lv.evidence_units})`);
  assert.ok(Math.abs(lv.mu - live.mu_after) < 1e-3, 'el Nivel refleja el efecto de la corrección, no la suma de los dos');
  assert.equal(lv.rated_matches, 1);
});

scenario('REGRESIÓN identidad: abrir una incidencia de identidad sobre un partido recuperado suspende el partido COMPLETO, incluido el efecto del target', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Idn', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 3, validatedAfterDays: 1,
    result: { priors: priors([w.seba.pid, 5.5, 0.8], [w.matu.pid, 5.0, 0.75], [w.lucho.pid, 4.5, 0.7]) } });
  const base = await levelOf(t.pid);
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  await processIdentityRecoveryLevel(svc, r.recoveryId);
  assert.ok((await levelOf(t.pid)).evidence_units > base.evidence_units);
  const issue = await rpcAs(w.seba.uid, 'report_identity_issue', [m.match_id, 'B', 2, null]);
  assert.equal(issue.ok, true, JSON.stringify(issue));
  const after = await levelOf(t.pid);
  assert.ok(Math.abs(after.mu - base.mu) < 1e-3 && Math.abs(after.evidence_units - base.evidence_units) < 1e-6, 'el target vuelve a su estado previo al partido');
  assert.equal(after.rated_matches, 0);
  assert.equal((await one(`select effect_status from public.match_level_results where result_id = $1`, [m.resultId])).effect_status, 'reverted');
});

scenario('REGRESIÓN create-or-attach: tras vincular, una carga de la cuenta con los MISMOS 4 jugadores converge al partido recuperado (huella refrescada), no crea un duplicado', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Att', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 1, validated: false, sets: [[6, 4], [6, 3]] });
  assert.equal((await claim(t, await inviteToken(w.seba, w.pedro))).ok, true);
  const before = (await one(`select count(*)::int n from public.matches`)).n;
  const res = await svc.rpc('create_or_attach_match', {
    p_auth_user_id: t.uid, p_idempotency_key: crypto.randomUUID(),
    p_pair1_player_id_1: t.pid, p_pair1_player_id_2: w.seba.pid, p_pair2_player_id_1: w.matu.pid, p_pair2_player_id_2: w.lucho.pid,
    p_played_at: (await one(`select played_at from public.matches where match_id = $1`, [m.match_id])).played_at.toISOString(), p_played_at_time_known: true, p_format_id: 'classic',
    p_sets: [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }, { gamesA: 6, gamesB: 3, tiebreakA: null, tiebreakB: null }],
  });
  assert.equal(res.error, null, JSON.stringify(res.error));
  assert.equal(res.data.ok, true, JSON.stringify(res.data));
  assert.equal(res.data.matchId, m.match_id, 'converge al partido recuperado');
  assert.ok(String(res.data.code).startsWith('matched_'), res.data.code);
  assert.equal((await one(`select count(*)::int n from public.matches`)).n, before, 'no se creó un partido nuevo');
  // La provisional recuperada ya no es seleccionable en una carga nueva.
  const sel = await svc.rpc('create_or_attach_match', {
    p_auth_user_id: w.seba.uid, p_idempotency_key: crypto.randomUUID(),
    p_pair1_player_id_1: w.seba.pid, p_pair1_player_id_2: w.pedro, p_pair2_player_id_1: w.matu.pid, p_pair2_player_id_2: w.lucho.pid,
    p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic',
    p_sets: [{ gamesA: 6, gamesB: 4, tiebreakA: null, tiebreakB: null }],
  });
  assert.equal(sel.data.code, 'participant_not_found', 'el tombstone no se puede volver a elegir');
});

scenario('carrera create-or-attach vs vínculo: un partido nacido con la huella nueva ANTES del commit del vínculo se detecta de forma idempotente al consultar el estado', async () => {
  const w = await world({ matches: 0 });
  const t = await mkUser('Race', { status: 'CALIBRANDO', mu: 4.0, confidence: 0.5 });
  const m1 = await mkMatch({ creator: w.seba, slots: [w.seba.pid, w.pedro, w.matu.pid, w.lucho.pid], names: ['Seba', 'Pedro', 'Matu', 'Lucho'], daysAgo: 2, validated: false });
  const r = await claim(t, await inviteToken(w.seba, w.pedro));
  assert.equal(r.duplicateCandidates, 0);
  assert.deepEqual(await rpcAs(t.uid, 'get_my_identity_recovery_status'), { pendingLevelRecoveries: 1, openDuplicateCandidates: 0 });
  // Un segundo partido con la MISMA composición aparece "después" (p. ej. insertado por una carga concurrente ya commiteada).
  const m2 = await mkMatch({ creator: t, slots: [w.seba.pid, t.pid, w.matu.pid, w.lucho.pid], names: ['Seba', 'Race', 'Matu', 'Lucho'], daysAgo: 2, validated: false });
  await q(`update public.matches set played_at = (select played_at from public.matches where match_id = $1) where match_id = $2`, [m1.match_id, m2.match_id]);
  const st = await rpcAs(t.uid, 'get_my_identity_recovery_status');
  assert.equal(st.openDuplicateCandidates, 1, 'la re-detección idempotente lo encuentra');
  assert.equal((await rpcAs(t.uid, 'get_my_identity_recovery_status')).openDuplicateCandidates, 1, 'idempotente: no duplica candidatos');
  assert.equal((await q(`select count(*)::int n from public.match_duplicate_candidates`))[0].n, 1);
});
