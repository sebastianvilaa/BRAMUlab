-- BRAMU Metrics V1 · F1+F2(+F4) — verificación de SOLO LECTURA para Central en Supabase Staging (después de aplicar las migraciones
-- 20261008100000_metrics_f1_player_activity.sql, 20261008110000_metrics_f2_core.sql y, para F4, 20261008120000_metrics_f4_d8_comunidad.sql,
-- y desplegar la Edge Function admin-metrics). Las consultas 9–12 requieren la migración de F4 (D8: días completos hasta ayer) y las 13–16 la de F6 (Explorar, 20261008130000).
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

-- 7) Concordancia manual (comparar con el JSON de la sección) bajo D8: cuentas actuales (saldo al corte) y partidos creados en los últimos
--    30 DÍAS COMPLETOS BA (de hace 30 días a las 00:00 hasta las 00:00 de hoy; lo de hoy NO entra). ESPERADO: raw = metrics en ambos pares.
select (select count(*) from public.players where type = 'registered' and is_active and deleted_at is null) as registered_now_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_users('30d', true, true) -> 'kpis') k where k ->> 'id' = 'users.registered_now') as registered_now_metrics_include_internal,
       (select count(*) from public.matches
         where created_at >= ((((now() at time zone 'America/Argentina/Buenos_Aires')::date - 30)::timestamp) at time zone 'America/Argentina/Buenos_Aires')
           and created_at <  ((((now() at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp) at time zone 'America/Argentina/Buenos_Aires')) as matches_created_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_matches('30d', true, true) -> 'kpis') k where k ->> 'id' = 'matches.created') as matches_created_metrics_include_internal;

-- 8) Presencia: ninguna fila fuera de contrato y como máximo una por jugador y día. ESPERADO: 0 en ambas columnas.
select (select count(*) from public.player_activity_days where opens < 1 or opens > 999) as bad_opens,
       (select count(*) from (select player_id, activity_date from public.player_activity_days group by 1, 2 having count(*) > 1) d) as duplicated_days;

-- 9) F4 · D8: la ventana actual termina a las 00:00 de HOY (BA) y la previa mide lo mismo. ESPERADO: window_end_is_today_midnight=true, same_length=true,
--    complete_days_only=true, today_partial=true.
select (r #>> '{meta,window,1}')::timestamptz = (((now() at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp) at time zone 'America/Argentina/Buenos_Aires' as window_end_is_today_midnight,
       ((r #>> '{meta,window,1}')::timestamptz - (r #>> '{meta,window,0}')::timestamptz) = ((r #>> '{meta,previousWindow,1}')::timestamptz - (r #>> '{meta,previousWindow,0}')::timestamptz) as same_length,
       (r #>> '{meta,completeDaysOnly}')::boolean as complete_days_only,
       (r #>> '{today,partial}')::boolean as today_partial
  from (select public.metrics_overview('30d') as r) x;

-- 10) F4 · Comunidad: 15 KPIs (9 de F2 + 6 de F4), 4 desgloses y 2 series; sin UUID en la salida. ESPERADO: kpis=15, breakdown_keys = group_size, level_band, level_status, ranking_density; has_uuid=false.
select jsonb_array_length(r -> 'kpis') as kpis,
       (select string_agg(k, ', ' order by k) from jsonb_object_keys(r -> 'breakdowns') k) as breakdown_keys,
       (select string_agg(k, ', ' order by k) from jsonb_object_keys(r -> 'series') k) as series_keys,
       (r::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') as has_uuid
  from (select public.metrics_community('90d') as r) x;

-- 11) F4 · Concordancia de Comunidad con SQL crudo (incluyendo internas). ESPERADO: raw = metrics en cada par (si todavía no hay ediciones de Ranking,
--     ranking_eligible_raw = 0 y ranking_eligible_metrics = NULL: «sin registros», nunca un 0).
select (select count(*) from public.groups where status = 'active') as groups_active_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_community('30d', true, true) -> 'kpis') k where k ->> 'id' = 'community.groups_active') as groups_active_metrics,
       (select count(*) from public.ranking_rows rr where rr.edition_id = (select edition_id from public.ranking_editions order by published_at desc limit 1) and rr.scope_type = 'global' and rr.is_eligible) as ranking_eligible_raw,
       (select (k ->> 'value')::numeric::int from jsonb_array_elements(public.metrics_community('30d', true, true) -> 'kpis') k where k ->> 'id' = 'community.ranking_eligible_players') as ranking_eligible_metrics;

-- 12) F4 · Los ratios «foto» no se comparan. ESPERADO: 4 filas con snapshot=true y previous nulo.
select k ->> 'id' as kpi, (k -> 'snapshot')::boolean as snapshot, k -> 'previous' is null or k -> 'previous' = 'null'::jsonb as previous_is_null
  from jsonb_array_elements((public.metrics_users('30d') -> 'kpis') || (public.metrics_community('30d') -> 'kpis')) k
 where (k -> 'snapshot')::boolean;

-- 13) F6 · Explorar: las 2 funciones públicas las ejecuta service_role y NINGUNA función del Explorador es ejecutable por anon/authenticated.
--     ESPERADO: 7 filas (2 públicas + 5 helpers); anon_exec=false y authenticated_exec=false en todas; service_role_exec=true solo en metrics_explore y metrics_explore_catalog.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_exec
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and (p.proname like '%explore%' or p.proname = '_metrics_match_bucket')
 order by 1;

-- 14) F6 · Catálogo del Explorador = catálogo de KPIs. ESPERADO: catalog_size=55, series_metrics=10 (9 aditivos + usage.dau), filtered_metrics=7, filters=level_status,location,match_status,platform.
select jsonb_array_length(r -> 'catalog') as catalog_size,
       (select count(*) from jsonb_array_elements(r -> 'catalog') e where (e ->> 'hasSeries')::boolean) as series_metrics,
       (select count(*) from jsonb_array_elements(r -> 'catalog') e where jsonb_array_length(e -> 'filters') > 0) as filtered_metrics,
       (select string_agg(k, ',' order by k) from jsonb_object_keys(r -> 'filterDefs') k) as filters
  from (select public.metrics_explore_catalog() as r) x;

-- 15) F6 · El KPI del Explorador es IDÉNTICO al de su sección (un indicador por sección, sin filtro). ESPERADO: 5 filas con identical=true.
select m as metric,
       (public.metrics_explore(m, '30d') -> 'kpi') = (select k from jsonb_array_elements(public._metrics_run(split_part(m, '.', 1), '30d', true, false, now()) -> 'kpis') k where k ->> 'id' = m) as identical
  from unnest(array['users.signups', 'matches.created', 'activation.fifth_match', 'community.groups_created', 'usage.wau']) m;

-- 16) F6 · Sin UUID en las respuestas del Explorador (con y sin filtro). ESPERADO: has_uuid=false en todas las filas.
select m, f, (public.metrics_explore(m, '90d', true, true, f, v)::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') as has_uuid
  from (values ('users.registered_now', 'location', 'Bella Vista, Buenos Aires'), ('matches.created', 'match_status', 'validated'), ('usage.wau', 'platform', 'ios'), ('users.signups', null, null)) t(m, f, v);
