-- BRAMU Metrics V1 — PREFLIGHT de SOLO LECTURA para Production (lo corre Central ANTES de aplicar nada; también sirve como línea base).
-- No escribe, no imprime identidades. Cada consulta devuelve `ok` (true/false) y el dato que lo sustenta.
-- Probado en PGlite (base tipo Production sin Metrics): supabase/functions/_shared/metrics-admin-grant.test.mjs.
-- Las migraciones aplicadas con la herramienta de Supabase se registran con SU PROPIA versión (fecha de aplicación): se compara por NOMBRE.

-- P1) Estado de migraciones por nombre. ESPERADO antes de publicar: ok=true, has_last_pre_metrics=true, metrics_migrations_applied=0.
select (coalesce(bool_or(name like '%v0437_level_evolution'), false) and count(*) filter (where name like '%metrics%') = 0) as ok,
       coalesce(bool_or(name like '%v0437_level_evolution'), false) as has_last_pre_metrics,
       count(*) filter (where name like '%metrics%') as metrics_migrations_applied,
       count(*) as total_applied
  from supabase_migrations.schema_migrations;

-- P2) Production NO tiene nada de Metrics todavía. ESPERADO: ok=true, todos los conteos 0.
select (f = 0 and t = 0 and r = 0) as ok, f as metrics_functions, t as metrics_tables, r as presence_function
  from (select (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'metrics\_%' escape '\' or proname like '\_metrics\_%' escape '\')) as f,
               (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname in ('player_activity_days', 'metrics_admins', 'metrics_internal_players')) as t,
               (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'register_app_presence') as r) x;

-- P3) Entorno. ESPERADO: ok=true, environment='production'.
select (environment = 'production') as ok, environment from public.app_config where id = 1;

-- P4) Existe EXACTAMENTE una cuenta candidata a administradora (@seba) activa y con email confirmado. ESPERADO: ok=true, candidates=1.
--     (Es el mismo criterio con que `metrics-grant-admin.sql` la resuelve; no imprime el UUID.)
select (n = 1) as ok, n as candidates
  from (select count(*) as n
          from public.players pl join public.profiles pr on pr.player_id = pl.player_id
          join auth.users u on u.id = pl.auth_user_id and u.email_confirmed_at is not null
         where lower(pr.username) = 'seba' and pl.type = 'registered' and pl.is_active and pl.deleted_at is null and pl.auth_user_id is not null) x;

-- P5) Línea base para comparar DESPUÉS de publicar (guardar estos números; no deben cambiar por la publicación, solo por la actividad real de los jugadores).
select (select count(*) from public.players where type = 'registered' and deleted_at is null) as accounts,
       (select count(*) from public.players where type = 'provisional' and recovered_into_player_id is null and deleted_at is null) as guests,
       (select count(*) from public.matches) as matches,
       (select count(*) from public.groups where status = 'active') as active_groups,
       (select count(*) from public.ranking_editions) as ranking_editions,
       (select count(*) from public.legal_acceptances) as legal_acceptances,
       (select count(*) from public.level_states) as level_states;

-- P6) Funciones de usuario/administración existentes con permisos de cliente: línea base para contrastar con `audit-live-grants.sql` (que se corre aparte).
select count(*) as security_definer_executable_by_clients
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
