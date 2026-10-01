// BRAMUlab — Bloque 9B: ENSAYO OPERATIVO no destructivo para los procedimientos del Runbook. Cada ensayo corre sobre una base
// EFÍMERA recién replayada (PGlite, ver replay-migrations.mjs) con fixtures descartables y el cliente falso respaldado por esa base
// (pglite-admin-client.mjs), ejecutando el código operativo REAL (`runAccountDeletion`/`verifyAccountDeleted`, `exportPlayerData`,
// `cleanupAbandonedSignups`, RPC administrativas). Nada toca Staging ni cuentas reales.
//
// Secciones:  A exportación/acceso · B operación/recuperación · C backup lógico.  `runOpsRehearsal()` → { sections: [{id,name,items}] }.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { replay } from './replay-migrations.mjs';
import { seedOpsFixtures, THIRD_PARTY_PII, IDS } from './ops-fixtures.mjs';
import { makePgliteAdminClient } from './pglite-admin-client.mjs';
import { exportPlayerData, writeReportAtomic, validateReport } from './admin-export-player-data.mjs';
import { runAccountDeletion, verifyAccountDeleted } from '../functions/_shared/account-deletion-core.mjs';
import { cleanupAbandonedSignups } from '../functions/_shared/abandoned-signups-core.mjs';
import { dumpPublicData, restorePublicData, exportDeletionLedger, listPublicTables } from './logical-backup.mjs';

const mkItems = () => { const items = []; return { items, add: (name, ok, detail = '') => items.push({ name, ok: !!ok, detail: String(detail) }) }; };
async function freshWorld(opts = {}) {
  const r = await replay({ acl: 'observed' });
  if (!r.ok) throw new Error(`replay falló: ${JSON.stringify(r.results.find((x) => !x.ok))}`);
  const fx = await seedOpsFixtures(r.db);
  return { db: r.db, fx, client: makePgliteAdminClient(r.db, opts) };
}
const q = async (db, sql, params) => (await db.query(sql, params)).rows;

/* ====================== A — exportación / acceso a datos ====================== */
export async function rehearseExport() {
  const { items, add } = mkItems();
  const { db, fx, client } = await freshWorld();
  const A = fx.pid.A;

  const res = await exportPlayerData(client, A);
  add('export de A: ok y el informe valida (secciones completas, titular correcto)', res.ok === true, res.code || '');
  const txt = JSON.stringify(res.report || {});
  const leaks = [];
  for (const [who, pii] of Object.entries(THIRD_PARTY_PII)) for (const v of Object.values(pii)) if (txt.includes(v)) leaks.push(`${who}:${v}`);
  for (const k of ['B', 'C', 'D']) { if (txt.includes(fx.pid[k]) || txt.includes(IDS[k])) leaks.push(`id de ${k}`); }
  add('redacción de terceros: ningún email/teléfono/nacimiento/username/player_id/auth id de B, C o D', leaks.length === 0, leaks.join(', '));
  add('terceros: solo aparece el NOMBRE mostrado en el partido compartido', /TerceroB/.test(txt) && /TerceroC/.test(txt) && !/tercero_b|tercero\.b/.test(txt));
  add('sin secretos ni internals (hash, memoria/auditoría, semanticKey, rate limits) y sin UUIDs de terceros embebidos en strings', !/HASH_SECRETO|SECRETO_MEMORIA|SECRETO_AUDIT|encrypted_password|semanticKey|api_rate_limits/.test(txt) && !txt.includes(fx.pid.B) && !txt.includes(fx.pid.C));
  add('datos propios completos: email, teléfono, nacimiento, nota privada, aceptación legal, sets, grupos, notificaciones, Intelligence',
    res.ok && res.report.account.email === 'sujeto.a@example.test' && res.report.profile.phone === '+5491100000001' && res.report.profile.birth_date === '1990-01-01'
    && res.report.matches[0].myPrivateState.privateNote === 'nota privada de A' && res.report.legalAcceptances.length === 1 && res.report.matches[0].sets.length === 2
    && res.report.groups.length === 2 && res.report.notifications.length === 1 && res.report.intelligence.length === 1);
  add('el payload de la notificación conserva lo propio (nombres de rivales del partido) pero pierde actorPlayerId de B',
    res.ok && res.report.notifications[0].payload.matchContext.opponentNames.length === 2 && !('actorPlayerId' in res.report.notifications[0].payload));

  // defensa en profundidad: un informe manipulado/regresivo NO se escribe
  const tampered = JSON.parse(JSON.stringify(res.report)); tampered.notifications[0].payload.actorPlayerId = fx.pid.B; tampered.profile.encrypted_password = 'x'; tampered.intelligence[0].output.semanticKey = `rival_relacion:${fx.pid.B}`;
  const problems = validateReport(tampered, A);
  add('validateReport rechaza ids de terceros y claves internas/secretas (barrera cliente aun si el backend regresionara)', problems.length >= 3, problems.join(' | '));
  const fakeBad = { rpc: async () => ({ data: tampered, error: null }), from: client.from };
  const bad = await exportPlayerData(fakeBad, A);
  add('un informe inválido es FALLO (report_invalid), nunca un resultado parcial', bad.ok === false && bad.code === 'report_invalid');

  // errores: definitivos sin reintento; transitorios con reintento acotado
  let calls = 0;
  const flaky = { rpc: async (n, a) => { calls += 1; return calls < 3 ? { data: null, error: { message: 'fetch failed: network timeout' } } : client.rpc(n, a); }, from: client.from };
  const okAfter = await exportPlayerData(flaky, A, { sleep: async () => {} });
  add('error transitorio de red: se reintenta (3 intentos) y termina bien', okAfter.ok === true && okAfter.attempts === 3, JSON.stringify({ calls }));
  calls = 0;
  const always = { rpc: async () => { calls += 1; return { data: null, error: { message: 'fetch failed' } }; }, from: client.from };
  const gaveUp = await exportPlayerData(always, A, { sleep: async () => {} });
  add('si el transporte sigue fallando: falla tras 3 intentos con rpc_failed (sin salida parcial)', gaveUp.ok === false && gaveUp.code === 'rpc_failed' && calls === 3);
  calls = 0;
  const logical = { rpc: async () => { calls += 1; return { data: { ok: false, code: 'account_deleted' }, error: null }; }, from: client.from };
  const del = await exportPlayerData(logical, A);
  add('códigos de negocio son definitivos: sin reintentos', del.code === 'account_deleted' && calls === 1);
  add('referencia inválida / inexistente / @usuario resuelto', (await exportPlayerData(client, 'x; drop table')).code === 'invalid_reference' && (await exportPlayerData(client, '@no_existe_nadie')).code === 'player_not_found' && (await exportPlayerData(client, '@sujeto_a')).ok === true);
  const prov = (await q(db, `insert into public.players (display_name, type) values ('Prov','provisional') returning player_id`))[0].player_id;
  add('provisional / UUID inexistente rechazados', (await exportPlayerData(client, prov)).code === 'not_a_registered_account' && (await exportPlayerData(client, '11111111-1111-4111-8111-111111111111')).code === 'player_not_found');

  // archivo: 0600, atómico, sin pisar, sin parciales
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-export-'));
  const out = path.join(dir, 'informe.json');
  const w1 = writeReportAtomic(out, JSON.stringify(res.report));
  add('archivo nuevo con permisos 0600', w1.ok && (fs.statSync(out).mode & 0o777) === 0o600, (fs.statSync(out).mode & 0o777).toString(8));
  const w2 = writeReportAtomic(out, 'otro');
  add('NO pisa un archivo existente sin --force (output_exists) y no lo altera', !w2.ok && w2.code === 'output_exists' && fs.readFileSync(out, 'utf8').length > 10);
  const lax = path.join(dir, 'laxo.json'); fs.writeFileSync(lax, 'viejo', { mode: 0o644 });
  const w3 = writeReportAtomic(lax, 'nuevo', { force: true });
  add('con --force reemplaza y deja 0600 aunque el archivo previo fuera 0644 (defecto de writeFileSync({mode}) evitado)', w3.ok && (fs.statSync(lax).mode & 0o777) === 0o600 && fs.readFileSync(lax, 'utf8') === 'nuevo');
  const w4 = writeReportAtomic(path.join(dir, 'no', 'existe', 'x.json'), 'x');
  add('destino inválido: falla limpio y no deja temporales', !w4.ok && w4.code === 'write_failed' && fs.readdirSync(dir).every((f) => !f.endsWith('.tmp')));
  add('el directorio queda solo con informes (sin .tmp huérfanos)', fs.readdirSync(dir).every((f) => !f.endsWith('.tmp')));
  fs.rmSync(dir, { recursive: true, force: true });

  // permisos SQL: ni cliente ni authenticated
  const priv = (await q(db, `select has_function_privilege('anon','public.admin_export_player_data(uuid)','EXECUTE') a, has_function_privilege('authenticated','public.admin_export_player_data(uuid)','EXECUTE') u, has_function_privilege('authenticated','public._admin_export_player_data_raw(uuid)','EXECUTE') r, has_function_privilege('service_role','public.admin_export_player_data(uuid)','EXECUTE') s`))[0];
  add('admin_export_player_data y su generador interno: solo service_role', !priv.a && !priv.u && !priv.r && priv.s);
  return items;
}

/* ====================== B — operación / recuperación ====================== */
export async function rehearseOperations() {
  const { items, add } = mkItems();

  // --- B1 eliminación (motor P0.3 real) con fallos parciales y retry ---
  {
    const failOn = { 'auth.delete': 1 };
    const { db, fx, client } = await freshWorld({ failOn });
    const A = fx.pid.A;
    const pre = {
      sharedMatchParticipants: Number((await q(db, `select count(*)::int n from public.match_participants where match_id=$1`, [fx.matchId]))[0].n),
      bOpen: Number((await q(db, `select count(*)::int n from public.group_memberships where group_id=$1 and player_id=$2 and left_at is null`, [fx.groupShared, fx.pid.B]))[0].n),
    };
    // acceso cortado por la Fase 1: antes de eliminar, el JWT de A resuelve; después no
    await db.exec(`select set_config('request.jwt.claim.sub','${IDS.A}', false)`);
    const before = (await q(db, `select public.get_my_legal_status() s`))[0].s;
    add('antes de eliminar: la sesión de A resuelve a su jugador', before.currentVersion === 'legal_v1');

    const first = await runAccountDeletion(client, A, {});
    add('fallo parcial inyectado (Auth delete): el motor se detiene en auth_delete y NO declara éxito', first.ok === false && first.step === 'auth_delete', JSON.stringify({ ok: first.ok, step: first.step }));
    let cut = false; try { await db.query(`select public.get_my_legal_status()`); } catch (e) { cut = /no_player_for_session/.test(e.message); }
    add('aun con el fallo de Auth, el acceso BRAMU ya está cortado (Fase 1 atómica: auth_user_id nulo)', cut);
    const resolved = (await client.rpc('resolve_player_for_account_deletion', { p_auth_user_id: IDS.A })).data;
    add('el RETRY resuelve al jugador por la auditoría (mismo JWT todavía válido)', resolved.ok === true && resolved.playerId === A && resolved.alreadyDeleted === true, JSON.stringify(resolved));
    const second = await runAccountDeletion(client, A, {});
    add('retry: completa Auth y finaliza la auditoría', second.ok === true && second.authPhase === 'completed' && second.auditFinalized === true, JSON.stringify({ ok: second.ok, step: second.step }));
    const post = await verifyAccountDeleted(client, A, second.authUserId);
    add('postcondiciones P0.3 todas verdaderas (anonimizado, desvinculado, inactivo, storage, grupos, Auth, auditoría)', post.ok === true, JSON.stringify(post));
    const again = await runAccountDeletion(client, A, {});
    add('re-ejecutar tras el éxito es idempotente (alreadyDeleted)', again.ok === true && again.alreadyDeleted === true);
    const partsAfter = await q(db, `select player_id, display_name_snapshot from public.match_participants where match_id=$1 order by team, position_in_team`, [fx.matchId]);
    add('el partido compartido se PRESERVA: 4 participantes, A figura "Jugador eliminado" con su player_id estructural',
      partsAfter.length === pre.sharedMatchParticipants && partsAfter.some((p) => p.player_id === A && p.display_name_snapshot === 'Jugador eliminado') && partsAfter.filter((p) => p.display_name_snapshot !== 'Jugador eliminado').length === 3);
    const prof = (await q(db, `select username, first_name, phone, birth_date, avatar_url, allow_whatsapp_contact, ranking_opt_in from public.profiles where player_id=$1`, [A]))[0];
    add('perfil anonimizado (sin usuario, nombre, teléfono, nacimiento, avatar, consentimiento, Ranking)', !prof.username && !prof.first_name && !prof.phone && !prof.birth_date && !prof.avatar_url && prof.allow_whatsapp_contact === false && prof.ranking_opt_in === false);
    const gone = (await q(db, `select (select count(*)::int from public.notifications where player_id=$1) n, (select count(*)::int from public.match_user_state where player_id=$1) s, (select count(*)::int from public.intelligence_match_outputs where player_id=$1) i, (select count(*)::int from public.player_saved_players where owner_player_id=$1 or saved_player_id=$1) l`, [A]))[0];
    add('datos privados eliminados (notificaciones, notas, Intelligence, listas personales en ambos sentidos)', gone.n === 0 && gone.s === 0 && gone.i === 0 && gone.l === 0, JSON.stringify(gone));
    const grp = await q(db, `select group_id, status from public.groups where group_id in ($1,$2)`, [fx.groupShared, fx.groupSolo]);
    const bStill = Number((await q(db, `select count(*)::int n from public.group_memberships where group_id=$1 and player_id=$2 and left_at is null`, [fx.groupShared, fx.pid.B]))[0].n);
    const aOpen = Number((await q(db, `select count(*)::int n from public.group_memberships where player_id=$1 and left_at is null`, [A]))[0].n);
    add('Grupos: el solo-de-A se borra lógicamente, el compartido sigue activo con B y A sin períodos abiertos', grp.find((g) => g.group_id === fx.groupSolo).status === 'deleted' && grp.find((g) => g.group_id === fx.groupShared).status === 'active' && bStill === pre.bOpen && aOpen === 0);
    const objs = Number((await q(db, `select count(*)::int n from storage.objects`))[0].n);
    add('Storage: avatar y foto de grupo eliminados', objs === 0, `objetos restantes=${objs}`);
    add('la evidencia legal (aceptaciones) se conserva append-only', Number((await q(db, `select count(*)::int n from public.legal_acceptances where player_id=$1`, [A]))[0].n) === 1);
    await db.exec(`select set_config('request.jwt.claim.sub','${IDS.B}', false)`);
    add('para otros jugadores el perfil público de A ya no existe y su WhatsApp no se entrega',
      (await q(db, `select * from public.get_public_profile($1)`, [A])).length === 0 && (await q(db, `select public.get_whatsapp_contact($1) r`, [A]))[0].r.ok === false);
    const bProf = (await q(db, `select username, phone from public.profiles where player_id=$1`, [fx.pid.B]))[0];
    add('la cuenta de B (tercero) queda INTACTA', bProf.username === 'tercero_b' && bProf.phone === THIRD_PARTY_PII.B.phone);

    // fallo de Storage en otra corrida: retry completa
    const w2 = await freshWorld({ failOn: { 'storage.remove': 1 } });
    const s1 = await runAccountDeletion(w2.client, w2.fx.pid.A, {});
    const s2 = await runAccountDeletion(w2.client, w2.fx.pid.A, {});
    add('fallo de Storage: se detiene en storage_remove y el retry completa la eliminación', s1.ok === false && s1.step === 'storage_remove' && s2.ok === true && (await verifyAccountDeleted(w2.client, w2.fx.pid.A, s2.authUserId)).ok === true, JSON.stringify({ s1: s1.step, s2: s2.ok }));
  }

  // --- B2 cuenta problemática: ban inmediato ---
  {
    const { db, fx, client } = await freshWorld();
    const ban = await client.auth.admin.updateUserById(IDS.C, { ban_duration: '876000h' });
    const u = (await client.auth.admin.getUserById(IDS.C)).data.user;
    add('cuenta problemática: el baneo por Auth Admin API deja banned_until a ~100 años sin tocar datos', !ban.error && new Date(u.banned_until).getTime() > Date.now() + 50 * 365 * 864e5 && (await q(db, `select username from public.profiles where player_id=$1`, [fx.pid.C]))[0].username === 'tercero_c');
  }

  // --- B3 corrección/anulación excepcional de partido ---
  {
    const { db, fx, client } = await freshWorld();
    let rejected = false; try { await db.query(`select public.admin_annul_match($1, '', 'motivo')`, [fx.matchId]); } catch (e) { rejected = /actor_label_and_reason_required/.test(e.message); }
    add('anulación exige actor y motivo (rechaza vacío)', rejected);
    const r1 = (await client.rpc('admin_annul_match', { p_match_id: fx.matchId, p_actor_label: 'operador-9b', p_reason: 'ensayo: resultado falso' })).data;
    const m = (await q(db, `select status, annulment_reason from public.matches where match_id=$1`, [fx.matchId]))[0];
    const act = (await q(db, `select action_type, metadata from public.match_actions where match_id=$1 and action_type='annulled'`, [fx.matchId]))[0];
    const notif = Number((await q(db, `select count(*)::int n from public.notifications where match_id=$1 and type='admin_action'`, [fx.matchId]))[0].n);
    add('anulación: estado annulled, motivo/actor en el partido y en match_actions, aviso a los 4 participantes', r1.ok && m.status === 'annulled' && m.annulment_reason.actorLabel === 'operador-9b' && act.metadata.adminActorLabel === 'operador-9b' && act.metadata.reason.includes('falso') && notif >= 3, JSON.stringify({ r1: r1.code, notif }));
    const r2 = (await client.rpc('admin_annul_match', { p_match_id: fx.matchId, p_actor_label: 'operador-9b', p_reason: 'otra vez' })).data;
    add('anular dos veces es idempotente (already_annulled, sin acción duplicada)', r2.idempotentReturn === true && Number((await q(db, `select count(*)::int n from public.match_actions where match_id=$1 and action_type='annulled'`, [fx.matchId]))[0].n) === 1);
    add('partido inexistente => match_not_found', (await client.rpc('admin_annul_match', { p_match_id: '11111111-1111-4111-8111-111111111111', p_actor_label: 'x', p_reason: 'y' })).data.code === 'match_not_found');
    // partido validado
    const v = (await q(db, `insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, validation_deadline_at, validated_at) values ($1,'ops-fp-2','classic', now() - interval '2 days','validated', now() + interval '10 days', now()) returning match_id`, [fx.pid.A]))[0].match_id;
    const r3 = (await client.rpc('admin_annul_match', { p_match_id: v, p_actor_label: 'operador-9b', p_reason: 'ensayo validado' })).data;
    add('anular un partido VALIDADO también funciona (reversión pura, sin motor)', r3.ok === true && r3.code === 'annulled', JSON.stringify(r3));
  }

  // --- B4 cleanup de altas abandonadas ---
  {
    const { db, fx, client } = await freshWorld({ failOn: { 'auth.delete': 1 } });
    const deps = {
      listCandidates: async (limit) => (await client.rpc('list_abandoned_signups', { p_min_age: '24 hours', p_limit: limit })).data,
      releaseUsername: async (id) => (await client.rpc('release_abandoned_signup_username', { p_user_id: id, p_min_age: '24 hours' })).data,
      getAuthUser: async (id) => (await client.auth.admin.getUserById(id)).data.user,
      deleteAuthUser: async (id) => { const r = await client.auth.admin.deleteUser(id); return r.error ? (r.error.status === 404 ? { ok: false, notFound: true } : { ok: false }) : { ok: true }; },
    };
    const s1 = await cleanupAbandonedSignups(deps);
    add('cleanup con un fallo de borrado inyectado: lo cuenta como error y NO toca a nadie más', s1.errors === 1 && s1.deleted === 0 && s1.candidates === 1, JSON.stringify(s1));
    const s2 = await cleanupAbandonedSignups(deps);
    add('retry: borra la alta abandonada (>24 h)', s2.deleted === 1 && s2.errors === 0, JSON.stringify(s2));
    const left = (await q(db, `select email from auth.users where email in ('abandonada@example.test','joven@example.test','sujeto.a@example.test') order by 1`)).map((r) => r.email);
    add('quedan la alta joven (<24 h) y las cuentas confirmadas; la abandonada no', JSON.stringify(left) === '["joven@example.test","sujeto.a@example.test"]', left.join(','));
    const s3 = await cleanupAbandonedSignups(deps);
    add('una tercera pasada es no-op (idempotente)', s3.candidates === 0 && s3.deleted === 0);
    add('el cron de altas abandonadas autentica con secreto de Vault (no con la service role) y verifica sin exponerlo',
      (await client.rpc('ensure_cleanup_cron_secret')).data === true && (await client.rpc('ensure_cleanup_cron_secret')).data === false
      && (await client.rpc('verify_cleanup_cron_secret', { p_secret: 'incorrecto'.repeat(5) })).data === false);
  }

  // --- B5 rate limits ---
  {
    const { db, fx, client } = await freshWorld();
    let blocked = false;
    for (let i = 0; i < 4; i += 1) blocked = !(await client.rpc('consume_auth_rate_limit', { p_auth_user_id: IDS.A, p_action: 'ops_9b', p_max_requests: 3, p_window_seconds: 60 })).data;
    add('rate limit por cuenta: la 4.ª llamada de una ventana de 3 se bloquea', blocked);
    await db.query(`insert into public.api_rate_limits (player_id, action, window_started_at, request_count) values ($1,'viejo', now() - interval '10 days', 5)`, [fx.pid.A]);
    const purged = (await client.rpc('purge_old_rate_limits', {})).data;
    add('purge de contadores: elimina lo viejo (>7 días) y conserva lo reciente', purged >= 1 && Number((await q(db, `select count(*)::int n from public.api_rate_limits where action='ops_9b'`))[0].n) === 1, `purgadas=${purged}`);
    const snap = (await client.rpc('ops_health_snapshot')).data;
    add('ops_health_snapshot: contadores coherentes y sin PII', snap.accounts.registeredActive === 4 && snap.accounts.unconfirmedSignupsOver24h === 1 && !/@example|tercero_|sujeto_/.test(JSON.stringify(snap)), JSON.stringify(snap.accounts));
  }
  return items;
}

/* ====================== C — backup lógico ====================== */
export async function rehearseBackup() {
  const { items, add } = mkItems();
  const w = await freshWorld();
  const A = w.fx.pid.A;
  const dumpFull = await dumpPublicData(w.db);
  const tables = await listPublicTables(w.db);
  add(`dump lógico de ${tables.length} tablas de public con checksum por tabla`, Object.keys(dumpFull.checksums).length === tables.length && Object.values(dumpFull.tables).flat().length > 20);
  add('el dump declara su alcance (sin auth.*, storage.*, vault)', /public-only/.test(dumpFull.scope));

  // restauración sobre esquema limpio
  const r2 = await replay({ acl: 'observed' });
  const rs = await restorePublicData(r2.db, dumpFull);
  add('restauración sobre una base replayada VACÍA: checksums idénticos tabla por tabla', rs.ok === true && rs.mismatched.length === 0, `${rs.rows} filas / ${rs.tables} tablas; difieren: ${rs.mismatched.join(',')}`);
  await r2.db.exec(`select set_config('request.jwt.claim.sub','${IDS.A}', false)`).catch(() => {});
  const restoredProfile = (await q(r2.db, `select username from public.profiles where player_id=$1`, [A]))[0];
  add('lo restaurado es funcional (perfil y relaciones presentes; triggers no re-dispararon efectos)', restoredProfile.username === 'sujeto_a' && Number((await q(r2.db, `select count(*)::int n from public.pilot_events where event_name='signup_completed'`))[0].n) === Number((await q(w.db, `select count(*)::int n from public.pilot_events where event_name='signup_completed'`))[0].n));
  let corrupt = false;
  const badDump = JSON.parse(JSON.stringify(dumpFull)); badDump.tables.profiles[0].username = 'manipulado';
  const r3 = await replay({ acl: 'observed' });
  const rb = await restorePublicData(r3.db, badDump);
  corrupt = rb.ok === false && rb.mismatched.includes('profiles');
  add('un dump alterado se DETECTA por checksum al restaurar', corrupt);

  // eliminación vs backup
  const ledgerBefore = await exportDeletionLedger(w.db);
  await runAccountDeletion(w.client, A, {});
  const ledger = await exportDeletionLedger(w.db);
  add('libro de eliminaciones: solo ids técnicos de cuentas eliminadas (sin PII)', ledgerBefore.length === 0 && ledger.length === 1 && ledger[0] === A);
  const dumpAfter = await dumpPublicData(w.db);
  const r4 = await replay({ acl: 'observed' });
  await restorePublicData(r4.db, dumpAfter);
  const p4 = (await q(r4.db, `select username, phone from public.profiles where player_id=$1`, [A]))[0];
  add('backup POSTERIOR a la eliminación: al restaurar, A sigue anonimizada', !p4.username && !p4.phone);
  const r5 = await replay({ acl: 'observed' });
  await restorePublicData(r5.db, dumpFull); // backup ANTERIOR a la eliminación
  const resurrected = (await q(r5.db, `select username, phone from public.profiles where player_id=$1`, [A]))[0];
  add('RIESGO DEMOSTRADO: restaurar un backup ANTERIOR a la eliminación resucita los datos personales de A', resurrected.username === 'sujeto_a' && resurrected.phone === '+5491100000001');
  const c5 = makePgliteAdminClient(r5.db);
  for (const id of ledger) await c5.rpc('admin_delete_player_account', { p_player_id: id });
  const fixed = (await q(r5.db, `select username, phone from public.profiles where player_id=$1`, [A]))[0];
  add('PROCEDIMIENTO: re-aplicar el libro de eliminaciones (admin_delete_player_account por id) tras restaurar vuelve a anonimizar', !fixed.username && !fixed.phone);
  return items;
}

export async function runOpsRehearsal({ log = () => {} } = {}) {
  const defs = [['A', 'exportación / acceso a datos', rehearseExport], ['B', 'operación / recuperación', rehearseOperations], ['C', 'backup lógico', rehearseBackup]];
  const sections = [];
  for (const [id, name, fn] of defs) {
    let items;
    try { items = await fn(); } catch (e) { items = [{ name: 'el ensayo terminó sin excepciones', ok: false, detail: String(e.stack || e.message).slice(0, 400) }]; }
    sections.push({ id, name, items, ok: items.every((i) => i.ok) });
    log(`[ops-rehearsal] ${id} ${name}: ${items.every((i) => i.ok) ? 'PASS' : 'FAIL'} (${items.length})`);
    items.filter((i) => !i.ok).forEach((i) => log(`   ✖ ${i.name} :: ${i.detail}`));
  }
  return { ok: sections.every((s) => s.ok), sections };
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await runOpsRehearsal({ log: console.log });
  console.log(r.ok ? '[ops-rehearsal] PASS' : '[ops-rehearsal] FAIL');
  process.exit(r.ok ? 0 : 1);
}
