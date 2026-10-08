// BRAMU Metrics V1 — CONSENTIMIENTO INFORMADO para medir actividad (decisión confirmada de Sebastián, 09/10/2026), sobre el esquema real (PGlite).
// node --test supabase/functions/_shared/metrics-activity-consent.test.mjs
//
// Reglas bajo prueba: (1) la medición está APAGADA por defecto; (2) NO se registra ninguna apertura antes de consentir ni hacia atrás; (3) quien
// declina (o retira) sigue usando BRAMUlab con normalidad y su actividad no se registra / se elimina; (4) la constancia se conserva (append-only);
// (5) el alta lo registra en el mismo paso, con la misma mecánica que la aceptación legal; (6) el consentimiento NO toca el gate legal ni lo
// bloquea; (7) las métricas declaran su cobertura y la retención solo mide altas que aceptaron desde el alta.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { replay, adaptMigration, MIGRATIONS_DIR } from '../../scripts/replay-migrations.mjs';

const MIGRATION = '20261008150000_metrics_activity_consent.sql';
let db;
const q = async (sql, p = []) => (await db.query(sql, p)).rows;
const one = async (sql, p = []) => (await q(sql, p))[0];
const scenario = (name, fn) => test(name, async () => { await db.exec('begin'); try { await fn(); } finally { await db.exec('rollback'); } });

before(async () => {
  const r = await replay({ acl: 'observed' }); assert.ok(r.ok); db = r.db;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`);
});
after(async () => { if (db) await db.close(); });

const enable = () => q(`update public.app_config set activity_consent_version = 'activity_v1'`);
async function mk(key, { meta = null, at = '2026-10-06T12:00:00Z' } = {}) {
  const uid = crypto.randomUUID();
  await q(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at) values ($1, $2, $3, $4::jsonb, $3)`, [uid, `${key}_${uid.slice(0, 5)}@example.test`, at, JSON.stringify(meta || { legal_version: 'legal_v1' })]);
  const pid = (await one(`select player_id from public.players where auth_user_id = $1`, [uid])).player_id;
  await q(`update public.players set created_at = $2 where player_id = $1`, [pid, at]);
  return { uid, pid };
}
/** Ejecuta como jugador autenticado (rol y JWT reales). Devuelve {r} o {error}. Se aísla con savepoint. */
async function asPlayer(u, sql, params = []) {
  await db.exec('savepoint sp');
  try {
    await db.exec('set local role authenticated');
    await q(`select set_config('request.jwt.claim.sub', $1, true)`, [u ? u.uid : '']);
    return { r: (await db.query(sql, params)).rows[0].r };
  } catch (e) { return { error: String(e.message || e) }; } finally { await db.exec('rollback to savepoint sp'); await db.exec('reset role'); }
}
// misma sesión, pero sin revertir (para encadenar decisiones y aperturas)
async function actAs(u, sql, params = []) {
  await db.exec('set local role authenticated');
  try { await q(`select set_config('request.jwt.claim.sub', $1, true)`, [u.uid]); return (await db.query(sql, params)).rows[0].r; } finally { try { await db.exec('reset role'); } catch (e) { /* tx abortada: el llamador revierte al savepoint */ } }
}
const rows = (pid) => q(`select * from public.player_activity_days where player_id = $1`, [pid]);
const consents = (pid) => q(`select consent_version, decision, source, legal_version, decided_at from public.activity_consents where player_id = $1 order by consent_id`, [pid]);

scenario('APAGADA por defecto: sin versión vigente nadie decide ni registra, y la app sigue funcionando', async () => {
  const u = await mk('a');
  assert.deepEqual((await asPlayer(u, `select public.get_my_activity_consent() r`)).r, { enabled: false, version: null, status: 'disabled', decidedAt: null });
  assert.match((await asPlayer(u, `select public.set_my_activity_consent('activity_v1', true) r`)).error, /activity_measurement_disabled/);
  assert.equal((await actAs(u, `select public.register_app_presence('browser', 'ios', null) r`)).code, 'measurement_disabled');
  assert.equal((await rows(u.pid)).length, 0);
});

scenario('flujo del jugador existente: sin decidir NO se registra; acepta → se registra desde ahí; evidencia con versión, origen y versión legal vigente', async () => {
  await enable(); const u = await mk('b');
  assert.deepEqual((await asPlayer(u, `select public.get_my_activity_consent() r`)).r, { enabled: true, version: 'activity_v1', status: 'unset', decidedAt: null });
  assert.equal((await actAs(u, `select public.register_app_presence('browser', 'ios', null) r`)).code, 'no_consent', 'antes de decidir: nada');
  assert.equal((await rows(u.pid)).length, 0);
  const set = await actAs(u, `select public.set_my_activity_consent('activity_v1', true, 'prompt') r`);
  assert.deepEqual([set.ok, set.status, set.changed], [true, 'granted', true]);
  const st = (await asPlayer(u, `select public.get_my_activity_consent() r`)).r; assert.equal(st.status, 'granted'); assert.ok(st.decidedAt);
  const rec = await actAs(u, `select public.register_app_presence('browser', 'ios', '04.38-h1') r`);
  assert.deepEqual(rec, { ok: true, recorded: true });
  const [c] = await consents(u.pid);
  assert.deepEqual([c.consent_version, c.decision, c.source, c.legal_version], ['activity_v1', 'granted', 'prompt', 'legal_v1']);
  const [row] = await rows(u.pid); assert.ok(new Date(row.first_seen_at) >= new Date(c.decided_at), 'la primera apertura registrada es POSTERIOR al consentimiento');
  // repetir la misma decisión no duplica la constancia
  assert.equal((await actAs(u, `select public.set_my_activity_consent('activity_v1', true, 'settings') r`)).changed, false);
  assert.equal((await consents(u.pid)).length, 1);
});

scenario('quien DECLINA sigue usando BRAMUlab: no se registra nada, no hay bloqueo y queda constancia; puede cambiar de opinión (solo hacia adelante)', async () => {
  await enable(); const u = await mk('c');
  const d = await actAs(u, `select public.set_my_activity_consent('activity_v1', false, 'prompt') r`);
  assert.deepEqual([d.ok, d.status], [true, 'declined']);
  assert.equal((await actAs(u, `select public.register_app_presence('browser', 'ios', null) r`)).code, 'no_consent');
  assert.equal((await rows(u.pid)).length, 0);
  // el gate legal NO depende del consentimiento: aceptó los Términos en el alta y nada más se le exige
  const legal = (await asPlayer(u, `select public.get_my_legal_status() r`)).r;
  assert.deepEqual([legal.acceptedCurrent, legal.requiresAcceptance], [true, false], 'declinar la medición no reabre ni bloquea la aceptación legal');
  await actAs(u, `select public.set_my_activity_consent('activity_v1', true, 'settings') r`);
  assert.deepEqual(await actAs(u, `select public.register_app_presence('browser', 'ios', null) r`), { ok: true, recorded: true });
  const hist = await consents(u.pid);
  assert.deepEqual(hist.map((h) => [h.decision, h.source]), [['declined', 'prompt'], ['granted', 'settings']], 'historial append-only, en orden');
  assert.equal((await rows(u.pid)).length, 1, 'solo la apertura posterior: nada retroactivo');
});

scenario('RETIRAR el consentimiento elimina la actividad ya registrada y corta el registro', async () => {
  await enable(); const u = await mk('d');
  await actAs(u, `select public.set_my_activity_consent('activity_v1', true) r`);
  await actAs(u, `select public.register_app_presence('standalone', 'android', null) r`);
  assert.equal((await rows(u.pid)).length, 1);
  const w = await actAs(u, `select public.set_my_activity_consent('activity_v1', false, 'settings') r`);
  assert.deepEqual([w.status, w.changed], ['declined', true]);
  assert.equal((await rows(u.pid)).length, 0, 'se elimina lo registrado');
  assert.equal((await actAs(u, `select public.register_app_presence('standalone', 'android', null) r`)).code, 'no_consent');
});

scenario('validaciones: solo la versión vigente, solo origen prompt/settings, decisión obligatoria y límite de frecuencia; nadie decide por otro', async () => {
  await enable(); const u = await mk('e'); const other = await mk('e2');
  assert.match((await asPlayer(u, `select public.set_my_activity_consent('activity_v0', true) r`)).error, /activity_consent_version_not_current/);
  assert.match((await asPlayer(u, `select public.set_my_activity_consent('activity_v2', true) r`)).error, /activity_consent_version_not_current/);
  assert.match((await asPlayer(u, `select public.set_my_activity_consent('activity_v1', true, 'signup') r`)).error, /invalid_activity_consent_request/, 'el origen «signup» solo lo escribe el servidor');
  assert.match((await asPlayer(u, `select public.set_my_activity_consent('activity_v1', null) r`)).error, /invalid_activity_consent_request/);
  assert.match((await asPlayer(null, `select public.set_my_activity_consent('activity_v1', true) r`)).error || 'x', /no_player_for_session|permission/);
  const args = (await one(`select pg_get_function_arguments(oid) a from pg_proc where proname = 'set_my_activity_consent'`)).a;
  assert.ok(!/player|uid|user/i.test(args), `la RPC no recibe jugador: ${args}`);
  await actAs(u, `select public.set_my_activity_consent('activity_v1', true) r`);
  assert.equal((await consents(other.pid)).length, 0, 'la decisión de uno no toca al otro');
  let limited = null;
  for (let i = 0; i < 25 && !limited; i += 1) {
    await db.exec('savepoint rl');
    try { await actAs(u, `select public.set_my_activity_consent('activity_v1', true) r`); await db.exec('release savepoint rl'); }
    catch (e) { limited = String(e.message); await db.exec('rollback to savepoint rl'); }
  }
  assert.match(limited || 'nunca limitó', /rate_limited/);
});

scenario('ALTA nueva: el consentimiento declarado en el mismo paso se registra al confirmar el email (granted o declined) con la fecha del servidor y SIN pantalla extra', async () => {
  await enable();
  const g = await mk('g', { meta: { legal_version: 'legal_v1', activity_consent: 'granted', activity_consent_version: 'activity_v1' } });
  const d = await mk('d2', { meta: { legal_version: 'legal_v1', activity_consent: 'declined', activity_consent_version: 'activity_v1' } });
  const [cg] = await consents(g.pid); const [cd] = await consents(d.pid);
  assert.deepEqual([cg.decision, cg.source, cg.legal_version], ['granted', 'signup', 'legal_v1']);
  assert.equal(new Date(cg.decided_at).toISOString(), '2026-10-06T12:00:00.000Z', 'instante = creación del usuario Auth (servidor)');
  assert.deepEqual([cd.decision, cd.source], ['declined', 'signup']);
  for (const u of [g, d]) assert.equal((await one(`select count(*)::int c from public.legal_acceptances where player_id = $1 and legal_version = 'legal_v1'`, [u.pid])).c, 1, 'la aceptación legal obligatoria se sigue registrando igual');
  assert.equal((await asPlayer(g, `select public.get_my_activity_consent() r`)).r.status, 'granted');
  // tras aceptar en el alta, ya puede registrarse la primera apertura
  assert.deepEqual(await actAs(g, `select public.register_app_presence('browser', 'ios', null) r`), { ok: true, recorded: true });
});

scenario('ALTA: sin declaración, con versión distinta, con valor inválido o con la medición apagada NO se fabrica nada (verá la pantalla de decisión); la aceptación legal sigue', async () => {
  await enable();
  const none = await mk('n0'); const old = await mk('n1', { meta: { legal_version: 'legal_v1', activity_consent: 'granted', activity_consent_version: 'activity_v0' } });
  const bad = await mk('n2', { meta: { legal_version: 'legal_v1', activity_consent: 'yes', activity_consent_version: 'activity_v1' } });
  const sneaky = await mk('n3', { meta: { legal_version: 'legal_v1', activity_consent: 'granted' } });
  for (const u of [none, old, bad, sneaky]) {
    assert.equal((await consents(u.pid)).length, 0);
    assert.equal((await asPlayer(u, `select public.get_my_activity_consent() r`)).r.status, 'unset');
    assert.equal((await one(`select count(*)::int c from public.legal_acceptances where player_id = $1`, [u.pid])).c, 1);
  }
  await q(`update public.app_config set activity_consent_version = null`);
  const off = await mk('n4', { meta: { legal_version: 'legal_v1', activity_consent: 'granted', activity_consent_version: 'activity_v1' } });
  assert.equal((await consents(off.pid)).length, 0, 'con la medición apagada el alta no registra consentimiento');
});

scenario('NO se reconstruye nada: la purga de la migración elimina lo capturado sin consentimiento (y lo anterior al consentimiento) y conserva lo posterior; reaplicarla es inocuo', async () => {
  await enable();
  const sin = await mk('p0'); const ok = await mk('p1'); const antes = await mk('p2');
  const ins = (u, d, at) => q(`insert into public.player_activity_days (player_id, activity_date, first_seen_at, last_seen_at, display_mode, platform) values ($1, $2::date, $3::timestamptz, $3::timestamptz, 'browser', 'ios')`, [u.pid, d, at]);
  await ins(sin, '2026-10-05', '2026-10-05T15:00:00Z');
  await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'prompt', '2026-10-07T12:00:00Z'::timestamptz)`, [ok.pid]);
  await ins(ok, '2026-10-08', '2026-10-08T15:00:00Z');
  await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'prompt', '2026-10-07T12:00:00Z'::timestamptz)`, [antes.pid]);
  await ins(antes, '2026-10-06', '2026-10-06T15:00:00Z');
  const mig = adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8'));
  await db.exec(mig);
  assert.equal((await rows(sin.pid)).length, 0, 'sin consentimiento: se elimina'); assert.equal((await rows(antes.pid)).length, 0, 'anterior al consentimiento: se elimina');
  assert.equal((await rows(ok.pid)).length, 1, 'posterior a un consentimiento válido: se conserva');
  await db.exec(mig);
  assert.equal((await rows(ok.pid)).length, 1, 'reaplicar la migración no borra lo legítimo');
});

scenario('la constancia es APPEND-ONLY y solo el servidor la lee; el jugador no accede a la tabla; el informe de acceso incluye SU constancia', async () => {
  await enable(); const u = await mk('x'); const o = await mk('x2');
  await actAs(u, `select public.set_my_activity_consent('activity_v1', true) r`);
  await actAs(o, `select public.set_my_activity_consent('activity_v1', false) r`);
  for (const sql of [`update public.activity_consents set decision = 'declined'`, `delete from public.activity_consents`]) {
    await db.exec('savepoint ao');
    await assert.rejects(() => db.query(sql), /activity_consents_append_only/);
    await db.exec('rollback to savepoint ao');
  }
  for (const sql of [`select * from public.activity_consents`, `insert into public.activity_consents (player_id, consent_version, decision, source) values ('${u.pid}', 'activity_v1', 'granted', 'prompt')`, 'delete from public.activity_consents']) {
    await db.exec('savepoint t'); await db.exec('set local role authenticated');
    await assert.rejects(() => db.query(sql), /permission denied/i, sql);
    await db.exec('rollback to savepoint t'); await db.exec('reset role');
  }
  await db.exec('set local role service_role');
  assert.ok((await q('select count(*) from public.activity_consents')).length);
  await db.exec('savepoint sr');
  await assert.rejects(() => db.query(`delete from public.activity_consents`), /permission denied/i);
  await db.exec('rollback to savepoint sr');
  await db.exec('reset role');
  const rep = (await one(`select public.admin_export_player_data($1) r`, [u.pid])).r;
  assert.equal(rep.activityConsents.length, 1);
  assert.deepEqual(Object.keys(rep.activityConsents[0]).sort(), ['consentVersion', 'decidedAt', 'decision', 'legalVersion', 'source']);
  assert.ok(!JSON.stringify(rep).includes(o.pid), 'nada de otro jugador');
});

scenario('eliminar la cuenta: se elimina la ACTIVIDAD y se conserva la constancia (como las aceptaciones legales: evidencia, no actividad)', async () => {
  await enable(); const u = await mk('z');
  await actAs(u, `select public.set_my_activity_consent('activity_v1', true) r`);
  await actAs(u, `select public.register_app_presence('browser', 'ios', null) r`);
  await q(`select public.admin_delete_player_account($1)`, [u.pid]);
  assert.equal((await rows(u.pid)).length, 0);
  assert.equal((await consents(u.pid)).length, 1, 'la constancia queda (evidencia del consentimiento que respaldó el tratamiento)');
  assert.equal((await one(`select count(*)::int c from public.legal_acceptances where player_id = $1`, [u.pid])).c, 1, 'mismo criterio que la aceptación legal');
});

scenario('MÉTRICAS: la cobertura de la medición se declara y se protege con k; la retención solo mide altas que aceptaron DESDE el alta (no declinaron ni retiraron)', async () => {
  await enable();
  const metaOf = async () => (await one(`select public.metrics_users('30d', true, true, '2026-10-12T15:00:00Z'::timestamptz) r`)).r.meta.measurement;
  const us = []; for (let i = 0; i < 6; i += 1) us.push(await mk(`m${i}`));
  assert.deepEqual(await metaOf(), { enabled: true, consentVersion: 'activity_v1', accounts: 6, consenting: null }, '0 aceptaron: 0 y el complemento 6 ≥ 5 → pero 0 < 5 se oculta');
  for (const u of us.slice(0, 5)) await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'prompt', now())`, [u.pid]);
  assert.equal((await metaOf()).consenting, null, '5 de 6: el complemento (1) delataría a una persona → oculto');
  await q(`select public._record_activity_consent($1, 'activity_v1', 'granted', 'prompt', now())`, [us[5].pid]);
  assert.equal((await metaOf()).consenting, 6, '6 de 6: sin complemento chico → se muestra');
  await q(`update public.app_config set activity_consent_version = null`);
  assert.deepEqual(await metaOf(), { enabled: false, consentVersion: null, accounts: 6, consenting: null });
  await enable();

  // retención: cohorte del 06/10 con presencia posterior
  const grp = {};
  for (const k of ['alta', 'tarde', 'declina', 'retira', 'sinrespuesta']) grp[k] = await mk(`r_${k}`, { at: '2026-10-06T12:00:00Z' });
  const decide = (k, dec, at) => q(`select public._record_activity_consent($1, 'activity_v1', $2, 'prompt', $3::timestamptz)`, [grp[k].pid, dec, at]);
  await q(`insert into public.player_activity_days (player_id, activity_date, display_mode, platform, first_seen_at, last_seen_at) values ($1, '2026-10-07', 'browser', 'ios', '2026-10-07T15:00:00Z', '2026-10-07T15:00:00Z')`, [grp.alta.pid]);
  await decide('alta', 'granted', '2026-10-06T12:01:00Z'); await decide('tarde', 'granted', '2026-10-09T12:00:00Z');
  await decide('declina', 'declined', '2026-10-06T12:01:00Z'); await decide('retira', 'granted', '2026-10-06T12:01:00Z'); await decide('retira', 'declined', '2026-10-08T12:00:00Z');
  const ret = (await one(`select public._metrics_retention('2026-10-05T03:00:00Z'::timestamptz, '2026-10-12T03:00:00Z'::timestamptz, '2026-10-20T12:00:00Z'::timestamptz, true) r`)).r;
  assert.equal(ret.cohort, 1, 'de las altas del 06/10 solo cuenta la que aceptó desde el alta (no la que aceptó tarde, declinó, retiró o no respondió; ni las que aceptaron «ahora»)');
  assert.equal(ret.d1_ret, 1);
});

test('el consentimiento REUTILIZA el sistema legal (mismas versiones y mismo patrón) sin tocarlo: no hay un segundo catálogo de versiones, ni cambios en el gate de reaceptación', async () => {
  const mig = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION), 'utf8').replace(/--.*$/gm, '');
  assert.match(mig, /references public\.legal_versions \(legal_version\)/, 'la versión legal vigente se referencia, no se duplica');
  assert.ok(!/create or replace function public\.(get_my_legal_status|accept_legal_version)/i.test(mig), 'no se modifica el gate legal');
  assert.ok(!/update\s+public\.legal_acceptances|insert into public\.legal_acceptances/i.test(mig), 'no se escribe en las aceptaciones legales');
  assert.match(mig, /activity_consents_append_only/);
});
