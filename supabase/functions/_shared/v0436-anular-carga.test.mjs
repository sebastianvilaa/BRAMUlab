// BRAMUlab — V04.36: pruebas SQL (PGlite = Postgres real, TODAS las migraciones) de `Anular carga` (annul_my_match_submission).
// Ejecutar con: node --test supabase/functions/_shared/v0436-anular-carga.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay } from '../../scripts/replay-migrations.mjs';
import { makePgliteAdminClient } from '../../scripts/pglite-admin-client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

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
const rpcAs = async (authUserId, fn, args = []) => {
  await asUser(authUserId);
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  return (await one(`select public.${fn}(${ph}) as r`, args)).r;
};
const tableAs = async (authUserId, fn, args = []) => {
  await asUser(authUserId);
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  return q(`select * from public.${fn}(${ph})`, args);
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
const mirror = (sets) => sets.map((s) => ({ gamesA: s.gamesB, gamesB: s.gamesA, tiebreakA: s.tiebreakB, tiebreakB: s.tiebreakA }));
const create = (user, ids, sets = SETS, extra = {}) => svc.rpc('create_or_attach_match', {
  p_auth_user_id: user.uid, p_idempotency_key: crypto.randomUUID(),
  p_pair1_player_id_1: ids[0], p_pair1_player_id_2: ids[1], p_pair2_player_id_1: ids[2], p_pair2_player_id_2: ids[3],
  p_played_at: new Date(Date.now() - 86400000).toISOString(), p_played_at_time_known: true, p_format_id: 'classic', p_sets: sets, ...extra,
});

/** Cuatro usuarios reales; a1 carga el partido (pareja A = a1+a2 gana 6-4 6-3) -> pending_validation con la acción en la pareja B. */
async function world() {
  const [a1, a2, b1, b2] = [await mkUser('Autor'), await mkUser('Companero'), await mkUser('RivalUno'), await mkUser('RivalDos')];
  const r = await create(a1, [a1.pid, a2.pid, b1.pid, b2.pid]);
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal(r.data.code, 'created');
  return { a1, a2, b1, b2, matchId: r.data.matchId, all: [a1, a2, b1, b2] };
}
const status = async (matchId) => one(`select status, action_side, annulment_reason, annulled_at from public.matches where match_id = $1`, [matchId]);
const annul = (u, matchId) => rpcAs(u.uid, 'annul_my_match_submission', [matchId]);
const visibleIds = async (u, includeHidden = false) => (await tableAs(u.uid, 'get_my_matches', [50, includeHidden])).map((r) => r.match_id);

scenario('1) autor elegible: ANULA OK; queda annulled/author_retracted con auditoría y SIN notificación nueva ni efecto deportivo', async () => {
  const w = await world();
  const notifBefore = (await one(`select count(*)::int c from public.notifications`)).c;
  const levelBefore = await q(`select player_id, status, mu, confidence, rated_matches from public.level_states order by player_id`);
  const resultsBefore = (await one(`select count(*)::int c from public.match_level_results`)).c;
  const eventsBefore = (await one(`select count(*)::int c from public.level_events`)).c;
  const r = await annul(w.a1, w.matchId);
  assert.deepEqual(r, { ok: true, code: 'annulled', matchId: w.matchId });
  const m = await status(w.matchId);
  assert.equal(m.status, 'annulled'); assert.equal(m.action_side, null); assert.ok(m.annulled_at);
  assert.equal(m.annulment_reason.kind, 'author_retracted'); assert.equal(m.annulment_reason.byPlayerId, w.a1.pid);
  const act = await q(`select actor_player_id, acting_side, metadata from public.match_actions where match_id = $1 and action_type = 'annulled'`, [w.matchId]);
  assert.equal(act.length, 1); assert.equal(act[0].actor_player_id, w.a1.pid); assert.equal(act[0].metadata.reason, 'author_retracted');
  // No se borra nada: el partido, sus participantes, revisiones y sets siguen en base.
  assert.equal((await one(`select count(*)::int c from public.match_participants where match_id = $1`, [w.matchId])).c, 4);
  assert.ok((await one(`select count(*)::int c from public.match_sets where match_id = $1`, [w.matchId])).c >= 2);
  // Sin notificación nueva y sin ningún efecto deportivo.
  assert.equal((await one(`select count(*)::int c from public.notifications`)).c, notifBefore);
  assert.equal((await one(`select count(*)::int c from public.notifications where type = 'admin_action'`)).c, 0);
  assert.deepEqual(await q(`select player_id, status, mu, confidence, rated_matches from public.level_states order by player_id`), levelBefore);
  assert.equal((await one(`select count(*)::int c from public.match_level_results`)).c, resultsBefore);
  assert.equal((await one(`select count(*)::int c from public.level_events`)).c, eventsBefore);
});

scenario('2) invisibilidad robusta: desaparece para los 4 participantes (aun con "mostrar ocultos"), detalle null, sin pendiente ni notificación', async () => {
  const w = await world();
  // Antes: la pareja B tenía la acción (pendiente + notificación pending_review) y todos lo veían.
  assert.equal((await rpcAs(w.b1.uid, 'get_pending_action_count')).count, 1);
  assert.ok((await tableAs(w.b1.uid, 'get_notifications')).some((n) => n.type === 'pending_review' && n.match_id === w.matchId));
  for (const u of w.all) assert.ok((await visibleIds(u)).includes(w.matchId), `${u.key} lo ve antes`);
  assert.ok((await rpcAs(w.b1.uid, 'get_match_detail', [w.matchId])));
  assert.equal((await annul(w.a1, w.matchId)).ok, true);
  for (const u of w.all) {
    assert.ok(!(await visibleIds(u)).includes(w.matchId), `${u.key}: oculto`);
    assert.ok(!(await visibleIds(u, true)).includes(w.matchId), `${u.key}: oculto incluso con p_include_hidden`);
    assert.equal(await rpcAs(u.uid, 'get_match_detail', [w.matchId]), null, `${u.key}: detalle null`);
    assert.ok(!(await tableAs(u.uid, 'get_notifications')).some((n) => n.match_id === w.matchId), `${u.key}: sin notificaciones del partido`);
  }
  assert.equal((await rpcAs(w.b1.uid, 'get_pending_action_count')).count, 0);
  assert.equal((await rpcAs(w.a1.uid, 'get_pending_action_count')).count, 0);
  // Defensa adicional: oculto para cada participante en match_user_state.
  assert.equal((await one(`select count(*)::int c from public.match_user_state where match_id = $1 and hidden`, [w.matchId])).c, 4);
});

scenario('3) elegibilidad: solo el AUTOR; un participante que no es autor recibe not_author y un extraño match_not_found; sin sesión falla', async () => {
  const w = await world();
  assert.equal((await annul(w.a2, w.matchId)).code, 'not_author');  // compañero del autor
  assert.equal((await annul(w.b1, w.matchId)).code, 'not_author');  // rival
  const stranger = await mkUser('Extrano');
  assert.equal((await annul(stranger, w.matchId)).code, 'match_not_found');
  assert.equal((await annul(w.a1, crypto.randomUUID())).code, 'match_not_found');
  assert.equal((await status(w.matchId)).status, 'pending_validation');
  await asUser(crypto.randomUUID());
  await assert.rejects(() => one(`select public.annul_my_match_submission($1) as r`, [w.matchId]), /no_player_for_session/);
});

scenario('4) solo pending_validation vigente: validado, vencido o ya anulado por otra causa → not_pending (nada cambia)', async () => {
  const w = await world();
  await q(`update public.matches set status = 'validated', validated_at = now(), action_side = null where match_id = $1`, [w.matchId]);
  assert.equal((await annul(w.a1, w.matchId)).code, 'not_pending');
  assert.equal((await status(w.matchId)).status, 'validated');
  await q(`update public.matches set status = 'pending_validation', validated_at = null, validation_deadline_at = now() - interval '1 hour' where match_id = $1`, [w.matchId]);
  assert.equal((await annul(w.a1, w.matchId)).code, 'not_pending');
  await q(`update public.matches set validation_deadline_at = now() + interval '5 days', status = 'annulled', annulled_at = now(), annulment_reason = '{"kind":"duplicate"}'::jsonb where match_id = $1`, [w.matchId]);
  assert.equal((await annul(w.a1, w.matchId)).code, 'not_pending');
  assert.equal((await status(w.matchId)).annulment_reason.kind, 'duplicate', 'no se pisa una anulación de otra causa');
});

scenario('5) BLOQUEA: otra persona CONFIRMÓ el mismo resultado (la pareja rival declara el mismo marcador)', async () => {
  const w = await world();
  const r = await create(w.b1, [w.b1.pid, w.b2.pid, w.a1.pid, w.a2.pid], mirror(SETS));
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal(r.data.matchId, w.matchId);
  assert.ok((await q(`select 1 from public.match_actions where match_id = $1 and action_type = 'confirmed' and actor_player_id = $2`, [w.matchId, w.b1.pid])).length === 1);
  assert.deepEqual(await annul(w.a1, w.matchId), { ok: false, code: 'recognized_by_other' });
  assert.equal((await status(w.matchId)).status, 'pending_validation');
});

scenario('6) BLOQUEA: otra persona PROPUSO una corrección de resultado (revisión con otro proponente)', async () => {
  const w = await world();
  const other = [{ gamesA: 3, gamesB: 6, tiebreakA: null, tiebreakB: null }, { gamesA: 4, gamesB: 6, tiebreakA: null, tiebreakB: null }];
  const r = await create(w.b2, [w.b2.pid, w.b1.pid, w.a1.pid, w.a2.pid], other);
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal(r.data.code, 'matched_revised');
  assert.equal((await annul(w.a1, w.matchId)).code, 'recognized_by_other');
});

scenario('7) BLOQUEA: un compañero del autor declara de nuevo desde el mismo lado, o se reemplaza un participante afirmando quién jugó', async () => {
  const w = await world();
  const r = await create(w.a2, [w.a1.pid, w.a2.pid, w.b1.pid, w.b2.pid]);
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal((await annul(w.a1, w.matchId)).code, 'recognized_by_other');
  // Reemplazo de participante hecho por OTRA persona (acción registrada en la bitácora).
  const w2 = await world();
  await q(`insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, metadata) values ($1, 'participant_replaced', $2, 'B', '{}'::jsonb)`, [w2.matchId, w2.b1.pid]);
  assert.equal((await annul(w2.a1, w2.matchId)).code, 'recognized_by_other');
});

scenario('8) NO bloquea: "No participé" de otra persona (incidencia abierta) → se anula igual y la incidencia desaparece de las superficies', async () => {
  const w = await world();
  const issue = await rpcAs(w.b2.uid, 'report_identity_issue', [w.matchId, 'B', 2, null]);
  assert.equal(issue.ok, true, JSON.stringify(issue));
  assert.equal((await q(`select 1 from public.match_actions where match_id = $1 and action_type = 'identity_questioned'`, [w.matchId])).length, 1);
  assert.ok((await tableAs(w.b1.uid, 'get_notifications')).some((n) => n.type === 'identity_questioned' && n.match_id === w.matchId), 'antes: la incidencia es una tarea visible');
  const r = await annul(w.a1, w.matchId);
  assert.deepEqual(r, { ok: true, code: 'annulled', matchId: w.matchId });
  for (const u of w.all) {
    assert.ok(!(await tableAs(u.uid, 'get_notifications')).some((n) => n.match_id === w.matchId), `${u.key}: sin incidencia visible`);
    assert.ok(!(await visibleIds(u, true)).includes(w.matchId));
  }
  // La incidencia queda en base (auditoría), pero ya no es accionable en ninguna lectura.
  assert.equal((await one(`select status from public.match_identity_issues where match_id = $1`, [w.matchId])).status, 'open');
});

scenario('9) NO bloquea: acciones del PROPIO autor (volver a declarar lo mismo); se anula sin problema', async () => {
  const w = await world();
  const again = await create(w.a1, [w.a1.pid, w.a2.pid, w.b1.pid, w.b2.pid]);
  assert.equal(again.data.ok, true, JSON.stringify(again.data));
  assert.equal(again.data.matchId, w.matchId);
  assert.ok((await q(`select 1 from public.match_actions where match_id = $1 and actor_player_id <> $2`, [w.matchId, w.a1.pid])).length === 0, 'solo hay acciones del autor');
  assert.equal((await annul(w.a1, w.matchId)).ok, true);
});

scenario('10) doble ejecución: idempotente, sin segunda acción de bitácora ni cambio de timestamps; para un no-autor el partido retirado "no existe"', async () => {
  const w = await world();
  assert.equal((await annul(w.a1, w.matchId)).code, 'annulled');
  const t1 = (await status(w.matchId)).annulled_at;
  const again = await annul(w.a1, w.matchId);
  assert.deepEqual(again, { ok: true, code: 'already_annulled', idempotentReturn: true, matchId: w.matchId });
  assert.equal((await one(`select count(*)::int c from public.match_actions where match_id = $1 and action_type = 'annulled'`, [w.matchId])).c, 1);
  assert.equal(String((await status(w.matchId)).annulled_at), String(t1));
  assert.equal((await annul(w.b1, w.matchId)).code, 'match_not_found');
});

scenario('11) canAnnulSubmission en get_match_detail lo decide el SERVIDOR: true solo para el autor elegible; false si lo reconocen o no es el autor', async () => {
  const w = await world();
  assert.equal((await rpcAs(w.a1.uid, 'get_match_detail', [w.matchId])).canAnnulSubmission, true);
  assert.equal((await rpcAs(w.a2.uid, 'get_match_detail', [w.matchId])).canAnnulSubmission, false);
  assert.equal((await rpcAs(w.b1.uid, 'get_match_detail', [w.matchId])).canAnnulSubmission, false);
  // "No participé" de un tercero no lo quita.
  assert.equal((await rpcAs(w.b2.uid, 'report_identity_issue', [w.matchId, 'B', 2, null])).ok, true);
  assert.equal((await rpcAs(w.a1.uid, 'get_match_detail', [w.matchId])).canAnnulSubmission, true);
  // Un reconocimiento de la otra pareja sí (partido aparte, sin incidencia abierta).
  const w2 = await world();
  const r = await create(w2.b1, [w2.b1.pid, w2.b2.pid, w2.a1.pid, w2.a2.pid], mirror(SETS));
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal((await rpcAs(w2.a1.uid, 'get_match_detail', [w2.matchId])).canAnnulSubmission, false);
});

scenario('12) tras anular, el MISMO encuentro puede volver a cargarse: crea un partido NUEVO (nunca se adjunta al retirado)', async () => {
  const w = await world();
  assert.equal((await annul(w.a1, w.matchId)).ok, true);
  const r = await create(w.b1, [w.b1.pid, w.b2.pid, w.a1.pid, w.a2.pid], mirror(SETS));
  assert.equal(r.data.ok, true, JSON.stringify(r.data));
  assert.equal(r.data.code, 'created');
  assert.notEqual(r.data.matchId, w.matchId);
  assert.equal((await status(w.matchId)).status, 'annulled');
  assert.ok((await visibleIds(w.a1)).includes(r.data.matchId));
});

scenario('13) un candidato de duplicado ABIERTO que involucra al partido retirado se anula (void)', async () => {
  const w = await world();
  const other = await create(w.a1, [w.a1.pid, w.b1.pid, w.a2.pid, w.b2.pid], SETS, { p_played_at: new Date(Date.now() - 2 * 86400000).toISOString() });
  assert.equal(other.data.ok, true, JSON.stringify(other.data));
  const [low, high] = [w.matchId, other.data.matchId].sort();
  await q(`insert into public.match_duplicate_candidates (match_low_id, match_high_id, target_player_id, status) values ($1, $2, $3, 'open')`, [low, high, w.a2.pid]);
  assert.equal((await annul(w.a1, w.matchId)).ok, true);
  assert.equal((await one(`select status from public.match_duplicate_candidates where match_low_id = $1 and match_high_id = $2`, [low, high])).status, 'void');
  assert.equal((await status(other.data.matchId)).status, 'pending_validation', 'el otro partido no se toca');
});

scenario('14) una notificación PERSISTIDA que apunta al partido retirado tampoco se muestra; las demás sí', async () => {
  const w = await world();
  const other = await create(w.a1, [w.a1.pid, w.b1.pid, w.a2.pid, w.b2.pid], SETS, { p_played_at: new Date(Date.now() - 3 * 86400000).toISOString() });
  await q(`insert into public.notifications (player_id, type, match_id, payload) values ($1, 'match_validated', $2, '{}'::jsonb), ($1, 'match_validated', $3, '{}'::jsonb)`, [w.a2.pid, w.matchId, other.data.matchId]);
  assert.equal((await tableAs(w.a2.uid, 'get_notifications')).filter((n) => n.type === 'match_validated').length, 2);
  assert.equal((await annul(w.a1, w.matchId)).ok, true);
  const rows = (await tableAs(w.a2.uid, 'get_notifications')).filter((n) => n.type === 'match_validated');
  assert.deepEqual(rows.map((n) => n.match_id), [other.data.matchId]);
});

scenario('15) permisos: la RPC es solo para authenticated (anon y public sin EXECUTE) y los helpers internos no son invocables', async () => {
  const can = async (role, sig) => (await one(`select has_function_privilege($1, $2, 'execute') as ok`, [role, sig])).ok;
  assert.equal(await can('authenticated', 'public.annul_my_match_submission(uuid)'), true);
  assert.equal(await can('anon', 'public.annul_my_match_submission(uuid)'), false);
  for (const sig of ['public._match_is_author_retracted(uuid)', 'public._annul_submission_block_reason(uuid, uuid)']) {
    assert.equal(await can('anon', sig), false, sig);
    assert.equal(await can('authenticated', sig), false, sig);
  }
});

test('16) la migración no inserta notificaciones ni toca Nivel/Ranking y no reutiliza admin_annul_match', () => {
  const sql = fs.readFileSync(path.join(HERE, '../../migrations/20261006200000_v0436_annul_own_submission.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('create or replace function public.annul_my_match_submission'), sql.indexOf('comment on function public.annul_my_match_submission'));
  assert.doesNotMatch(fn, /insert into public\.notifications/);
  assert.doesNotMatch(fn, /admin_annul_match|_bloque6_revert_applied_result|level_states|level_events|ranking/i);
  assert.match(fn, /for update/);
});
