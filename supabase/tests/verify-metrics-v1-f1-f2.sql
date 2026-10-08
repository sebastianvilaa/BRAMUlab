-- BRAMU Metrics V1 · F1+F2 — verificación de SOLO LECTURA para Central en Supabase Staging (después de aplicar las migraciones
-- 20261008100000_metrics_f1_player_activity.sql y 20261008110000_metrics_f2_core.sql y desplegar la Edge Function admin-metrics).
-- No escribe nada y no imprime identidades. Cada consulta indica el resultado esperado.

-- 1) Tablas nuevas: RLS activo, cero políticas, ningún privilegio de cliente. ESPERADO: 3 filas, rls=true, policies=0, client_priv=false.
select c.relname as table_name,
       c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
        or has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')) as client_priv
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('player_activity_days', 'metrics_admins', 'metrics_internal_players')
 order by 1;

-- 2) Ninguna función de métricas ejecutable por anon/authenticated. ESPERADO: 0 filas.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and (p.proname like 'metrics\_%' escape '\' or p.proname like '\_metrics\_%' escape '\')
   and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

-- 3) La RPC de presencia: authenticated sí, anon no. ESPERADO: 1 fila, authenticated_exec=true, anon_exec=false, security_definer=true.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       p.prosecdef as security_definer
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname = 'register_app_presence';

-- 4) Las 7 funciones públicas de métricas las ejecuta service_role. ESPERADO: 7 filas, service_role_exec=true.
select p.proname, has_function_privilege('service_role', p.oid, 'execute') as service_role_exec
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('metrics_overview', 'metrics_users', 'metrics_matches', 'metrics_activation', 'metrics_community', 'metrics_usage', 'metrics_is_admin')
 order by 1;

-- 5) Administradores y cuentas internas CONFIGURADOS (solo conteos). ESPERADO tras el alta manual: admins_active >= 1.
select (select count(*) from public.metrics_admins where revoked_at is null) as admins_active,
       (select count(*) from public.metrics_admins where revoked_at is not null) as admins_revoked,
       (select count(*) from public.metrics_internal_players) as internal_players;

-- 6) Humo de las secciones (ejecutar como postgres/service). ESPERADO: ok=true y environment='staging' en TODAS; kpis > 0.
select s as section,
       (r ->> 'ok')::boolean as ok,
       r #>> '{meta,environment}' as environment,
       jsonb_array_length(r -> 'kpis') as kpis
  from (values ('overview', public.metrics_overview('30d')), ('users', public.metrics_users('30d')), ('matches', public.metrics_matches('30d')),
               ('activation', public.metrics_activation('30d')), ('community', public.metrics_community('30d')), ('usage', public.metrics_usage('30d'))) v(s, r);

-- 7) Concordancia manual (comparar con el JSON de la sección): cuentas actuales y partidos creados en 30 días BA.
select (select count(*) from public.players where type = 'registered' and is_active and deleted_at is null) as registered_now_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_users('30d', true, true) -> 'kpis') k where k ->> 'id' = 'users.registered_now') as registered_now_metrics_include_internal,
       (select count(*) from public.matches where created_at >= ((((now() at time zone 'America/Argentina/Buenos_Aires')::date - 29)::timestamp) at time zone 'America/Argentina/Buenos_Aires')) as matches_created_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_matches('30d', true, true) -> 'kpis') k where k ->> 'id' = 'matches.created') as matches_created_metrics_include_internal;

-- 8) Presencia: ninguna fila fuera de contrato y como máximo una por jugador y día. ESPERADO: 0 en ambas columnas.
select (select count(*) from public.player_activity_days where opens < 1 or opens > 999) as bad_opens,
       (select count(*) from (select player_id, activity_date from public.player_activity_days group by 1, 2 having count(*) > 1) d) as duplicated_days;
