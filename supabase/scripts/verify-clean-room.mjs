// BRAMUlab — Bloque 9A: verificación de BASE LIMPIA. Replaya TODAS las migraciones desde cero (ver replay-migrations.mjs) bajo
// tres escenarios de ACL por defecto del proyecto y comprueba, para cada uno, que el estado inicial y la línea base de
// privilegios son IDÉNTICOS y correctos — es decir, que no dependen de residuos de Staging ni de defaults de plataforma.
//
// Uso: node supabase/scripts/verify-clean-room.mjs [--json salida.json]    (exit 0 solo si todo pasa)

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { replay, ACL_SCENARIOS, listMigrations, checkMigrationNames, MIGRATIONS_DIR, adaptMigration } from './replay-migrations.mjs';

/** Tablas de public que PUEDEN traer filas tras el replay (datos de referencia, no fixtures). */
export const REFERENCE_TABLES = new Set(['reserved_usernames', 'legal_versions']);
/** Lecturas públicas deliberadas para anon. */
export const ANON_SELECT_TABLES = ['app_config', 'legal_versions'];
export const ANON_EXEC_FUNCTIONS = ['is_username_available'];
/** Verifies que comparan clock_timestamp() entre sentencias consecutivas. PGlite (WASM) tiene un reloj de resolución gruesa
 *  (medido: 6 valores distintos en 2000 inserts consecutivos), así que NO son evaluables en este motor; se evalúan en
 *  Staging real (Central). Si fallan acá no se cuentan como defecto ni como PASS: se reportan como no evaluables. */
export const CLOCK_SENSITIVE_VERIFIES = new Set(['verify-preprod-grupos-26-miembros-leave.sql', 'verify-preprod-grupos-b2a-backend-lobby.sql', 'verify-preprod-grupos-b2c-group-photo.sql']);
export const AUTH_INTERNAL_OK = new Set(['_group_photo_can_cleanup', '_group_photo_can_delete', '_group_photo_can_read', '_group_photo_can_write', '_group_photo_folder_group_id']);

export async function checkCleanState(db) {
  const checks = [];
  const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });
  const q = async (sql) => (await db.query(sql)).rows;

  // --- Ranking/Nivel/Intelligence/Grupos/cuentas/partidos: sin filas; solo referencia permitida ---
  const tables = (await q(`select c.relname t, c.relrowsecurity rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`));
  const withRows = [];
  for (const t of tables) { const n = Number((await q(`select count(*)::int n from public."${t.t}"`))[0].n); if (n > 0) withRows.push(`${t.t}=${n}`); }
  const unexpected = withRows.filter((x) => !REFERENCE_TABLES.has(x.split('=')[0]));
  add('ninguna tabla de public trae filas salvo datos de referencia (reserved_usernames, legal_versions)', unexpected.length === 0, unexpected.join(', ') || withRows.join(', '));
  for (const [label, tbl] of [['Ranking sin ediciones falsas', 'ranking_editions'], ['Ranking sin filas', 'ranking_rows'], ['Nivel sin usuarios', 'level_states'], ['Intelligence sin outputs', 'intelligence_match_outputs'], ['Grupos sin fixtures', 'groups'], ['sin cuentas', 'players'], ['sin perfiles', 'profiles'], ['sin partidos', 'matches'], ['sin eventos', 'pilot_events'], ['sin aceptaciones legales', 'legal_acceptances']]) {
    add(label, Number((await q(`select count(*)::int n from public.${tbl}`))[0].n) === 0);
  }
  add('app_config SIN fila (debe sembrarse como paso de configuración, nunca viene "staging" de las migraciones)', Number((await q(`select count(*)::int n from public.app_config`))[0].n) === 0);
  add('legal_versions = [legal_v1] sin fecha de vigencia', JSON.stringify((await q(`select legal_version, effective_at from public.legal_versions`)).map((r) => [r.legal_version, r.effective_at])) === '[["legal_v1",null]]');
  add('reserved_usernames sembrados', Number((await q(`select count(*)::int n from public.reserved_usernames`))[0].n) > 0);
  add('auth.users vacío / storage.objects vacío / sin secretos en Vault',
    Number((await q(`select (select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from vault.secrets) n`))[0].n) === 0);
  add('único cron job de las migraciones = bramu_weekly_ranking_publish (sin URL ni secretos); el de altas abandonadas NO se programa solo',
    JSON.stringify((await q(`select jobname, command from cron.job order by 1`)).map((j) => [j.jobname, j.command])) === '[["bramu_weekly_ranking_publish","select public.publish_current_ranking_edition();"]]');
  add('buckets = avatars + group-photos, ambos privados', JSON.stringify(await q(`select id, public from storage.buckets order by 1`)) === '[{"id":"avatars","public":false},{"id":"group-photos","public":false}]');

  // --- RLS ---
  add('todas las tablas de public tienen RLS habilitada', tables.every((t) => t.rls), tables.filter((t) => !t.rls).map((t) => t.t).join(', '));

  // --- privilegios de tabla ---
  const tg = await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated')`);
  const badDml = tg.filter((g) => ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'].includes(g.privilege_type));
  add('anon/authenticated sin INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER en ninguna tabla', badDml.length === 0, badDml.slice(0, 5).map((g) => `${g.table_name}:${g.grantee}:${g.privilege_type}`).join(', '));
  // PG17: MAINTAIN no aparece en information_schema.role_table_grants.
  const maintain = await q(`select c.relname t
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
      and (has_table_privilege('anon', c.oid, 'MAINTAIN')
           or has_table_privilege('authenticated', c.oid, 'MAINTAIN'))
    order by 1`);
  add('anon/authenticated sin MAINTAIN en ninguna tabla (PostgreSQL 17)', maintain.length === 0, maintain.map((x) => x.t).join(','));
  const anonSel = [...new Set(tg.filter((g) => g.grantee === 'anon').map((g) => g.table_name))].sort();
  add(`anon solo lee ${ANON_SELECT_TABLES.join(' y ')}`, JSON.stringify(anonSel) === JSON.stringify([...ANON_SELECT_TABLES].sort()), anonSel.join(','));

  // --- privilegios de función ---
  const fn = await q(`select p.proname, p.prosecdef, p.prorettype::regtype::text rt, has_function_privilege('anon',p.oid,'EXECUTE') a, has_function_privilege('authenticated',p.oid,'EXECUTE') u, has_function_privilege('public',p.oid,'EXECUTE') pub
                       from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'`);
  const anonFns = fn.filter((f) => f.a).map((f) => f.proname);
  add('anon solo ejecuta is_username_available (todas las funciones de public)', anonFns.every((f) => ANON_EXEC_FUNCTIONS.includes(f)) && anonFns.includes('is_username_available'), anonFns.filter((f) => !ANON_EXEC_FUNCTIONS.includes(f)).slice(0, 8).join(','));
  const authBad = fn.filter((f) => f.u && (f.prosecdef) && (f.rt === 'trigger' || f.proname.startsWith('admin_') || /^(consume_|record_|purge_|ops_|ensure_|verify_cleanup|schedule_|unschedule_|list_abandoned|release_abandoned|resolve_player_for)/.test(f.proname) || (f.proname.startsWith('_') && !AUTH_INTERNAL_OK.has(f.proname)))).map((f) => f.proname);
  add('ninguna función interna/administrativa/trigger SECURITY DEFINER es ejecutable por authenticated', authBad.length === 0, authBad.join(','));
  const pubSecdef = fn.filter((f) => f.pub && f.prosecdef).map((f) => f.proname);
  add('ninguna SECURITY DEFINER conserva EXECUTE para PUBLIC salvo is_username_available', pubSecdef.every((n) => ANON_EXEC_FUNCTIONS.includes(n)), pubSecdef.join(','));
  const svc = await q(`select has_function_privilege('service_role','public.admin_delete_player_account(uuid)','EXECUTE') a, has_function_privilege('service_role','public.ops_health_snapshot()','EXECUTE') b, has_function_privilege('service_role','public.consume_auth_rate_limit(uuid,text,integer,integer)','EXECUTE') c`);
  add('service_role conserva sus RPC administrativas', svc[0].a && svc[0].b && svc[0].c);

  // --- G1 (Emails V1): desafíos sensibles server-only, en CUALQUIER escenario de ACL por defecto ---
  const ac = (await q(`select c.relrowsecurity rls,
      (select count(*)::int from pg_policies where schemaname='public' and tablename='account_challenges') pol,
      has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('authenticated', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE') or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'MAINTAIN') or has_table_privilege('authenticated', c.oid, 'MAINTAIN') clientAccess
    from pg_class c where c.oid = 'public.account_challenges'::regclass`))[0];
  add('G1: account_challenges server-only (RLS sin políticas y cero privilegios para anon/authenticated)', ac.rls === true && ac.pol === 0 && ac.clientaccess === false, JSON.stringify(ac));
  const g1Fns = fn.filter((f) => /^account_(challenge|challenges|email_change|delete_proof|receipt)/.test(f.proname));
  add('G1: las 10 RPC de desafíos son SECURITY DEFINER y SOLO service_role (ni anon, ni authenticated, ni PUBLIC)', g1Fns.length === 10 && g1Fns.every((f) => f.prosecdef && !f.a && !f.u && !f.pub), g1Fns.map((f) => `${f.proname}:${f.a}/${f.u}/${f.pub}`).join(','));
  const g1Svc = await q(`select bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')) ok from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^account_(challenge|challenges|email_change|delete_proof|receipt)'`);
  add('G1: service_role ejecuta las RPC de desafíos', g1Svc[0].ok === true);

  // --- triggers de Auth ---
  const trg = await q(`select tgname from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal order by 1`);
  add('triggers de alta presentes en auth.users', trg.length >= 2, trg.map((t) => t.tgname).join(','));
  return checks;
}

/** Humo post-configuración: lo que haría el primer alta real tras sembrar app_config (en una base descartable). */
export async function postConfigSmoke(db) {
  const checks = []; const add = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: String(detail) });
  const q = async (sql) => (await db.query(sql)).rows;
  await db.exec(`insert into public.app_config (id, environment) values (1, 'production')`);
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ('00000000-0000-4000-8000-0000000000a1', 'smoke@example.test', now(), '{"legal_version":"legal_v1"}')`);
  const c = (await q(`select (select count(*) from public.players)::int p, (select count(*) from public.profiles)::int pr, (select count(*) from public.level_states)::int l, (select count(*) from public.legal_acceptances)::int la`))[0];
  add('alta confirmada con metadata legal => 1 player + 1 profile + 1 level_state PENDIENTE + 1 aceptación', c.p === 1 && c.pr === 1 && c.l === 1 && c.la === 1, JSON.stringify(c));
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000a1', false)`);
  const st = (await q(`select public.get_my_legal_status() s`))[0].s;
  add('get_my_legal_status coherente con la versión sembrada', st.currentVersion === 'legal_v1' && st.requiresAcceptance === false, JSON.stringify(st));
  await db.exec(`select public.complete_profile('smoke_user','Smoke','Test','Smoke',null,null,null,null,null,'AR',null,null,null,null,null)`);
  add('complete_profile funciona con la aceptación registrada', (await q(`select username from public.profiles`))[0].username === 'smoke_user');
  const h = (await q(`select public.ops_health_snapshot() s`))[0].s;
  add('ops_health_snapshot responde con la cuenta de humo', h.accounts.registeredActive === 1 && !JSON.stringify(h).includes('smoke@'), JSON.stringify(h.accounts));
  const sec = (await q(`select public.ensure_cleanup_cron_secret() a, public.ensure_cleanup_cron_secret() b`))[0];
  add('cron: secreto generado server-side una sola vez', sec.a === true && sec.b === false);
  const job = (await q(`select public.schedule_cleanup_abandoned_signups('https://abcdefgh.supabase.co/functions/v1/cleanup-abandoned-signups') j`))[0].j;
  add('cron: schedule idempotente (un solo job)', Number((await q(`select count(*)::int n from cron.job where jobname = 'cleanup-abandoned-signups'`))[0].n) === 1 && job != null);
  return checks;
}

/** Verifies SQL autocontenidos del repo contra la base replayada (los que dependen de cuentas de Staging se clasifican aparte). */
export async function runRepoVerifies(db) {
  const dir = path.resolve(MIGRATIONS_DIR, '../tests');
  const out = { passed: [], needsStagingData: [], flaky: [], notEvaluable: [], failed: [] };
  await db.exec(`insert into public.app_config (id, environment) values (1, 'staging')`); // paso de configuración post-replay
  const attempt = async (f) => { await db.exec(adaptMigration(fs.readFileSync(path.join(dir, f), 'utf8'))); };
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('verify') && x.endsWith('.sql')).sort()) {
    try { await attempt(f); out.passed.push(f); }
    catch (e) {
      try { await db.exec('rollback'); } catch { /* sin transacción abierta */ }
      const msg = String(e.message || e);
      if (/requires_one_registered/.test(msg)) { out.needsStagingData.push(f); continue; }
      // Los verifies de Grupos comparan clock_timestamp() entre sentencias consecutivas: en PGlite (WASM) el reloj tiene
      // resolución de ms y puede empatar. Se reintenta; si pasa en algún intento se clasifica como flaky de motor.
      let recovered = false;
      for (let i = 0; i < 6 && !recovered; i += 1) {
        try { await attempt(f); recovered = true; } catch { try { await db.exec('rollback'); } catch { /* idem */ } }
      }
      if (recovered) out.flaky.push(f);
      else if (CLOCK_SENSITIVE_VERIFIES.has(f)) out.notEvaluable.push({ file: f, error: msg.slice(0, 120) });
      else out.failed.push({ file: f, error: msg.slice(0, 200) });
    }
  }
  return out;
}

export async function verifyScenario(acl, { withVerifies = false } = {}) {
  const r = await replay({ acl });
  const report = { acl, replayOk: r.ok, migrations: r.files.length, failedMigration: r.results.find((x) => !x.ok) || null, checks: [], verifies: null };
  if (!r.ok) return report;
  report.checks = await checkCleanState(r.db);
  if (withVerifies) report.verifies = await runRepoVerifies(r.db);
  // el humo muta la base: se corre en una réplica aparte para no contaminar las verificaciones del estado inicial
  const r2 = await replay({ acl });
  report.smoke = await postConfigSmoke(r2.db);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = checkMigrationNames(listMigrations());
  const reports = [];
  let ok = names.length === 0;
  if (names.length) console.error(names.join('\n'));
  for (const acl of Object.keys(ACL_SCENARIOS)) {
    const rep = await verifyScenario(acl, { withVerifies: acl === 'observed' });
    reports.push(rep);
    const bad = [...rep.checks, ...(rep.smoke || [])].filter((c) => !c.ok);
    const scenarioOk = rep.replayOk && bad.length === 0 && (!rep.verifies || rep.verifies.failed.length === 0);
    ok = ok && scenarioOk;
    console.log(`[clean-room] ACL=${acl}: ${scenarioOk ? 'PASS' : 'FAIL'} (${rep.migrations} migraciones; ${rep.checks.length + (rep.smoke || []).length} chequeos)`);
    if (rep.failedMigration) console.log('   migración fallida:', rep.failedMigration.file, '-', rep.failedMigration.error);
    bad.forEach((c) => console.log(`   ✖ ${c.name} :: ${c.detail}`));
    if (rep.verifies) console.log(`   verifies SQL del repo: ${rep.verifies.passed.length} OK, ${rep.verifies.needsStagingData.length} requieren cuentas de Staging, ${rep.verifies.flaky.length} pasan con reintento, ${rep.verifies.notEvaluable.length} no evaluables (reloj WASM), ${rep.verifies.failed.length} FALLAN`, rep.verifies.failed);
  }
  const ji = process.argv.indexOf('--json');
  if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(reports, null, 2));
  console.log(ok ? '[clean-room] PASS' : '[clean-room] FAIL');
  process.exit(ok ? 0 : 1);
}
