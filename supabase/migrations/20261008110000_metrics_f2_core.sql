-- BRAMU Metrics V1 · F2 — Núcleo protegido de métricas (SOLO lectura, SOLO service_role).
--
-- Ver docs/BRAMUlab/Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md §3–§6 y
-- docs/BRAMUlab/BRAMU_Metrics_Auditoria_Tecnica_V1.md (Apéndices A/B: las consultas validadas que acá se vuelven funciones).
--
--   1) `metrics_admins`          — lista de administradores autorizados (UUID de auth.users; se siembra a mano por entorno).
--   2) `metrics_internal_players`— cuentas internas/de prueba, excluidas por defecto de las métricas (interruptor).
--   3) `metrics_is_admin`        — chequeo que usa la Edge Function `admin-metrics` tras validar el JWT.
--   4) Catálogo + helpers        — UNA definición por KPI (id, tipo, definición, población, muestra mínima).
--   5) Secciones `metrics_overview|users|matches|activation|community|usage` — devuelven {meta, kpis, series, breakdowns}.
--
-- Principios (no negociables):
--   * Todo es SECURITY DEFINER + `revoke … from public, anon, authenticated` + `grant execute … to service_role`
--     (patrón de ops_health_snapshot): ningún cliente de PostgREST puede ejecutar nada de esto. Central usa las MISMAS
--     funciones desde su conector de solo lectura (una definición para el panel y para el análisis).
--   * Solo agregados: ninguna función devuelve UUID, email, @usuario ni nombre. Los desgloses por personas aplican el
--     umbral k = metrics_min_cell() (5) DENTRO de SQL (segmentos chicos → «Otros»; residuo chico → se absorbe/oculta).
--   * Zona horaria America/Argentina/Buenos_Aires; semana lunes–domingo; ventana [from, to); «hoy» parcial.
--   * Hechos persistidos: vencido = pending_validation con plazo vencido (status 'expired' nunca se escribe);
--     «partido real» = status <> 'annulled' (las anulaciones se reportan aparte; NULL-safe); provisionales recuperados
--     no son invitados; las cuentas «actuales» excluyen deleted_at.
--   * Presencia (DAU/WAU/MAU/retención) = player_activity_days (F1); sin histórico previo: devuelve not_instrumented.
--
-- NO aplicada desde el sandbox del agente — la aplica Central en Staging. Verify:
-- supabase/functions/_shared/metrics-f2-core.test.mjs (PGlite) + checklist del documento de resultado.

-- ------------------------------------------------------------------
-- 1) metrics_admins
-- ------------------------------------------------------------------

create table if not exists public.metrics_admins (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  label        text not null,
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz
);

comment on table public.metrics_admins is
  'BRAMU Metrics: administradores autorizados del panel /admin/metrics. La identidad es el UUID de auth.users (nunca @usuario/email/metadatos). Se siembra a mano por entorno (Central), nunca en una migración.';

alter table public.metrics_admins enable row level security;
revoke all on table public.metrics_admins from public, anon, authenticated;
grant select on table public.metrics_admins to service_role;

-- ------------------------------------------------------------------
-- 2) metrics_internal_players
-- ------------------------------------------------------------------

create table if not exists public.metrics_internal_players (
  player_id  uuid primary key references public.players (player_id) on delete cascade,
  reason     text not null,
  created_at timestamptz not null default now()
);

comment on table public.metrics_internal_players is
  'BRAMU Metrics: cuentas internas/de prueba excluidas por defecto de las métricas (alta/baja manual por Central). No reutiliza players.ranking_excluded (integridad de Ranking).';

alter table public.metrics_internal_players enable row level security;
revoke all on table public.metrics_internal_players from public, anon, authenticated;
grant select on table public.metrics_internal_players to service_role;

-- ------------------------------------------------------------------
-- 3) Constantes y chequeo de administrador
-- ------------------------------------------------------------------

create or replace function public.metrics_min_cell()
returns integer
language sql
immutable
set search_path = public
as $$ select 5 $$;

comment on function public.metrics_min_cell is 'BRAMU Metrics: umbral k de privacidad (personas distintas por segmento / celda de filtro cruzado).';

create or replace function public.metrics_is_admin(p_auth_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select true from public.metrics_admins a
     where a.auth_user_id = p_auth_user_id and a.revoked_at is null
  ), false)
$$;

comment on function public.metrics_is_admin is
  'BRAMU Metrics: true solo si el UUID figura en metrics_admins y no está revocado. La llama la Edge Function admin-metrics DESPUÉS de validar el JWT.';

-- ------------------------------------------------------------------
-- 4) Helpers internos
-- ------------------------------------------------------------------

create or replace function public._metrics_excluded(p_player uuid, p_include boolean)
returns boolean
language sql
stable
set search_path = public
as $$
  select not coalesce(p_include, false)
         and exists (select 1 from public.metrics_internal_players x where x.player_id = p_player)
$$;

-- Ventana de análisis. Rango «Nd» = N días calendario BA terminando HOY (parcial); la previa es la inmediatamente anterior
-- de igual longitud. 'all' = desde el primer dato; sin período previo.
create or replace function public._metrics_window(p_range text, p_asof timestamptz)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_today date := (p_asof at time zone 'America/Argentina/Buenos_Aires')::date;
  v_days integer;
  v_from timestamptz;
  v_first timestamptz;
  v_span integer;
begin
  if p_range is null or p_range not in ('7d', '30d', '90d', 'all') then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;
  if p_range = 'all' then
    select min(t) into v_first from (select min(created_at) t from public.players union all select min(created_at) from public.matches) x;
    v_first := least(coalesce(v_first, p_asof), p_asof);
    v_from := (((v_first at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp) at time zone 'America/Argentina/Buenos_Aires';
    v_span := greatest(1, (v_today - (v_from at time zone 'America/Argentina/Buenos_Aires')::date) + 1);
    return jsonb_build_object('range', p_range, 'from', v_from, 'to', p_asof, 'prevFrom', null, 'prevTo', null,
                              'days', v_span, 'granularity', case when v_span <= 45 then 'day' else 'week_ba' end);
  end if;
  v_days := replace(p_range, 'd', '')::integer;
  v_from := ((v_today - (v_days - 1))::timestamp) at time zone 'America/Argentina/Buenos_Aires';
  return jsonb_build_object(
    'range', p_range, 'from', v_from, 'to', p_asof,
    'prevFrom', ((v_today - (2 * v_days - 1))::timestamp) at time zone 'America/Argentina/Buenos_Aires', 'prevTo', v_from,
    'days', v_days, 'granularity', case when v_days <= 45 then 'day' else 'week_ba' end);
end;
$$;

create or replace function public._metrics_ba_date(p_ts timestamptz)
returns date
language sql
immutable
set search_path = public
as $$ select (p_ts at time zone 'America/Argentina/Buenos_Aires')::date $$;

create or replace function public._metrics_meta(p_range text, p_compare boolean, p_include boolean, p_asof timestamptz, p_window jsonb)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'environment', (select c.environment from public.app_config c where c.id = 1),
    'catalogVersion', 'metrics_v1',
    'generatedAt', now(),
    'asOf', p_asof,
    'tz', 'America/Argentina/Buenos_Aires',
    'range', p_range,
    'compare', coalesce(p_compare, true) and p_window -> 'prevFrom' is not null and p_window ->> 'prevFrom' is not null,
    'window', jsonb_build_array(p_window -> 'from', p_window -> 'to'),
    'previousWindow', case when p_window ->> 'prevFrom' is null then null
                           else jsonb_build_array(p_window -> 'prevFrom', p_window -> 'prevTo') end,
    'granularity', p_window ->> 'granularity',
    'presenceSince', (select min(a.first_seen_at) from public.player_activity_days a),
    'includeInternal', coalesce(p_include, false),
    'internalExcluded', case when coalesce(p_include, false) then 0 else (select count(*) from public.metrics_internal_players) end,
    'minCell', public.metrics_min_cell()
  )
$$;

-- Umbral k sobre un desglose [{label, n}]: segmentos < k → «Otros»; si el residuo queda en (0,k) se absorbe el segmento visible más
-- chico hasta llegar a k (así no se puede restar del total para descubrir un segmento chico); si aun así no alcanza, se oculta todo.
create or replace function public._metrics_apply_k(p_items jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_k integer := public.metrics_min_cell();
  v_residual integer := 0;
  v_lbl text[] := '{}';
  v_n integer[] := '{}';
  v_i integer := 1;
  r record;
  v_out jsonb := '[]'::jsonb;
  v_total integer := 0;
begin
  for r in
    select e ->> 'label' as lbl, (e ->> 'n')::integer as n
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where (e ->> 'n')::integer > 0
     order by (e ->> 'n')::integer asc, e ->> 'label' asc
  loop
    v_total := v_total + r.n;
    if r.n < v_k then
      v_residual := v_residual + r.n;
    else
      v_lbl := v_lbl || r.lbl;
      v_n := v_n || r.n;
    end if;
  end loop;

  while v_residual > 0 and v_residual < v_k and v_i <= coalesce(array_length(v_n, 1), 0) loop
    v_residual := v_residual + v_n[v_i];
    v_i := v_i + 1;
  end loop;

  if v_residual > 0 and v_residual < v_k then
    return jsonb_build_object('items', '[]'::jsonb, 'suppressed', true, 'minCell', v_k);
  end if;

  for r in select v_lbl[g] as lbl, v_n[g] as n from generate_series(v_i, coalesce(array_length(v_n, 1), 0)) g order by v_n[g] desc, v_lbl[g] asc loop
    v_out := v_out || jsonb_build_array(jsonb_build_object('label', r.lbl, 'n', r.n));
  end loop;
  if v_residual > 0 then
    v_out := v_out || jsonb_build_array(jsonb_build_object('label', 'Otros (n<' || v_k || ')', 'n', v_residual));
  end if;
  return jsonb_build_object('items', v_out, 'suppressed', false, 'minCell', v_k);
end;
$$;

-- Serie temporal por bucket (día BA o semana BA lun–dom), con ceros explícitos.
create or replace function public._metrics_series(p_source text, p_from timestamptz, p_to timestamptz, p_gran text, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_d0 date := (p_from at time zone 'America/Argentina/Buenos_Aires')::date;
  v_d1 date := ((p_to - interval '1 microsecond') at time zone 'America/Argentina/Buenos_Aires')::date;
  v_out jsonb;
begin
  if p_source not in ('signups', 'matches_created', 'matches_played', 'matches_validated', 'active_players') then
    raise exception 'invalid_series_source' using errcode = 'P0001';
  end if;
  if v_d1 < v_d0 then return '[]'::jsonb; end if;

  with b as (
    select g::date as start
      from generate_series(
             case when p_gran = 'week_ba' then date_trunc('week', v_d0::timestamp)::date else v_d0 end,
             v_d1,
             case when p_gran = 'week_ba' then interval '1 week' else interval '1 day' end) g
  ), ev as (
    select d, pid from (
      select (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d, pl.player_id as pid, 'signups' as src
        from public.players pl
       where pl.type = 'registered' and pl.created_at >= p_from and pl.created_at < p_to and not public._metrics_excluded(pl.player_id, p_include)
      union all
      select (m.created_at at time zone 'America/Argentina/Buenos_Aires')::date, m.match_id, 'matches_created'
        from public.matches m
       where m.created_at >= p_from and m.created_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include)
      union all
      select (m.played_at at time zone 'America/Argentina/Buenos_Aires')::date, m.match_id, 'matches_played'
        from public.matches m
       where m.played_at >= p_from and m.played_at < p_to and m.status <> 'annulled' and not public._metrics_excluded(m.created_by_player_id, p_include)
      union all
      select (m.validated_at at time zone 'America/Argentina/Buenos_Aires')::date, m.match_id, 'matches_validated'
        from public.matches m
       where m.status = 'validated' and m.validated_at >= p_from and m.validated_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include)
      union all
      select a.activity_date, a.player_id, 'active_players'
        from public.player_activity_days a
       where a.activity_date >= v_d0 and a.activity_date <= v_d1 and not public._metrics_excluded(a.player_id, p_include)
    ) u where u.src = p_source
  ), c as (
    select case when p_gran = 'week_ba' then date_trunc('week', ev.d::timestamp)::date else ev.d end as start,
           count(distinct ev.pid) as n
      from ev group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('start', b.start, 'value', coalesce(c.n, 0)) order by b.start), '[]'::jsonb)
    into v_out
    from b left join c using (start);
  return v_out;
end;
$$;

-- ------------------------------------------------------------------
-- 4b) Catálogo de KPIs (una sola definición) + armado de cada KPI con comparación
-- ------------------------------------------------------------------

create or replace function public._metrics_catalog()
returns jsonb
language sql
immutable
set search_path = public
as $json$
select $cat$[
 {"id":"users.registered_now","section":"users","label":"Cuentas registradas","kind":"stock","definition":"Cuentas con email confirmado, activas y no eliminadas, al corte","population":"players registrados, is_active, sin deleted_at"},
 {"id":"users.signups","section":"users","label":"Altas","kind":"flow","definition":"Cuentas que confirmaron el email en la ventana (brutas: incluye las luego eliminadas)","population":"players registrados con created_at en la ventana"},
 {"id":"users.guests_open","section":"users","label":"Invitados vigentes","kind":"stock","definition":"Jugadores provisionales que no fueron recuperados en una cuenta","population":"players provisionales sin recovered_into_player_id ni deleted_at"},
 {"id":"users.profile_complete","section":"users","label":"Perfiles completos","kind":"stock","definition":"Cuentas actuales con @usuario definido","population":"cuentas registradas actuales"},
 {"id":"users.profile_complete_rate","section":"users","label":"Perfiles completos (%)","kind":"ratio","minN":5,"definition":"Perfiles completos sobre cuentas actuales","population":"cuentas registradas actuales"},
 {"id":"users.with_location_rate","section":"users","label":"Con localidad declarada (%)","kind":"ratio","minN":5,"definition":"Cuentas actuales con localidad declarada (sin localidad no equivale a otra localidad)","population":"cuentas registradas actuales"},
 {"id":"matches.created","section":"matches","label":"Partidos cargados","kind":"flow","definition":"Partidos creados en la ventana, en cualquier estado (hecho operativo, incluye anulados)","population":"matches con created_at en la ventana"},
 {"id":"matches.real","section":"matches","label":"Partidos reales cargados","kind":"flow","definition":"Partidos creados en la ventana que no fueron anulados","population":"matches con created_at en la ventana y status distinto de annulled"},
 {"id":"matches.annulled","section":"matches","label":"Partidos anulados","kind":"flow","definition":"Partidos creados en la ventana que hoy están anulados (duplicado, carga retirada o administrativa)","population":"matches con created_at en la ventana y status annulled"},
 {"id":"matches.validated","section":"matches","label":"Partidos validados","kind":"flow","definition":"Partidos cuya validación ocurrió dentro de la ventana","population":"matches validated con validated_at en la ventana"},
 {"id":"matches.pending_validable","section":"matches","label":"Pendientes validables","kind":"stock","definition":"Cargados en la ventana, plazo vigente y ambas parejas con al menos una cuenta registrada","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.pending_waiting_counterpart","section":"matches","label":"Pendientes esperando contraparte","kind":"stock","definition":"Cargados en la ventana, plazo vigente y una pareja sin cuentas registradas (no se validan solos)","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.expired_derived","section":"matches","label":"Vencidos sin validar","kind":"stock","definition":"Pendientes cuyo plazo venció (estado derivado: el servidor no escribe expired)","population":"cohorte de la ventana, estado al corte"},
 {"id":"matches.validation_rate_closed","section":"matches","label":"Validados entre validables con plazo cerrado (%)","kind":"ratio","minN":5,"definition":"Validados / (validados + vencidos con ambas parejas con cuenta), cohorte de la ventana","population":"cohorte de la ventana con plazo cerrado"},
 {"id":"matches.validation_p50_hours","section":"matches","label":"Mediana de validación (h)","kind":"duration","minN":5,"definition":"Horas entre carga y validación","population":"validados con validated_at en la ventana"},
 {"id":"matches.validation_p90_hours","section":"matches","label":"P90 de validación (h)","kind":"duration","minN":5,"definition":"Percentil 90 de horas entre carga y validación","population":"validados con validated_at en la ventana"},
 {"id":"matches.authors","section":"matches","label":"Autores únicos","kind":"flow","definition":"Jugadores distintos que cargaron al menos un partido real","population":"matches reales con created_at en la ventana"},
 {"id":"matches.registered_participants","section":"matches","label":"Participantes con cuenta","kind":"flow","definition":"Cuentas registradas distintas que participaron en partidos reales","population":"matches reales con created_at en la ventana"},
 {"id":"activation.cohort","section":"activation","label":"Cohorte madura de altas","kind":"flow","definition":"Altas de la ventana con al menos 7 días de antigüedad (las más recientes todavía no tuvieron tiempo de activarse)","population":"players registrados con alta en la ventana y antigüedad mayor o igual a 7 días"},
 {"id":"activation.cohort_immature","section":"activation","label":"Altas todavía inmaduras","kind":"flow","definition":"Altas de la ventana con menos de 7 días: no entran en los porcentajes","population":"players registrados con alta en la ventana y antigüedad menor a 7 días"},
 {"id":"activation.level_initial","section":"activation","label":"Completó Nivel inicial (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con estimador inicial confirmado","population":"cohorte madura"},
 {"id":"activation.loaded_first","section":"activation","label":"Cargó su 1.er partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura que cargó al menos un partido real (autor)","population":"cohorte madura"},
 {"id":"activation.participated_first","section":"activation","label":"Participó en un partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con al menos un partido real como participante (autor o no)","population":"cohorte madura"},
 {"id":"activation.participated_validated","section":"activation","label":"Participó en un partido validado (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con al menos un partido validado como participante","population":"cohorte madura"},
 {"id":"activation.third_match","section":"activation","label":"Llegó al 3.er partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con 3 o más partidos reales como participante","population":"cohorte madura"},
 {"id":"activation.fifth_match","section":"activation","label":"Llegó al 5.º partido (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con 5 o más partidos reales como participante","population":"cohorte madura"},
 {"id":"activation.returned_other_week","section":"activation","label":"Volvió con una acción otra semana (%)","kind":"ratio","minN":5,"definition":"Cohorte madura con una acción de usuario registrada en una semana BA posterior a la de su alta (proxy retroactivo; la presencia exacta está en Uso)","population":"cohorte madura"},
 {"id":"activation.median_days_to_first_load","section":"activation","label":"Días del alta a la 1.ª carga (mediana)","kind":"duration","minN":5,"definition":"Mediana de días entre el alta y el primer partido real cargado","population":"cohorte madura que cargó"},
 {"id":"community.groups_active","section":"community","label":"Grupos vigentes","kind":"stock","definition":"Grupos con estado activo al corte","population":"groups status active"},
 {"id":"community.groups_created","section":"community","label":"Grupos creados","kind":"flow","definition":"Grupos creados en la ventana (incluye los luego eliminados)","population":"groups con created_at en la ventana"},
 {"id":"community.memberships_active","section":"community","label":"Membresías activas","kind":"stock","definition":"Pertenencias vigentes a grupos vigentes de cuentas no eliminadas","population":"group_memberships sin left_at en grupos activos"},
 {"id":"community.invites_created","section":"community","label":"Invitaciones creadas","kind":"flow","definition":"Enlaces de invitación generados en la ventana","population":"provisional_claims con created_at en la ventana"},
 {"id":"community.invites_claimed","section":"community","label":"Invitaciones canjeadas","kind":"flow","definition":"Invitaciones canjeadas dentro de la ventana","population":"provisional_claims claimed con claimed_at en la ventana"},
 {"id":"community.invites_open","section":"community","label":"Invitaciones abiertas","kind":"stock","definition":"Pendientes con vencimiento futuro al corte","population":"provisional_claims pending no vencidos"},
 {"id":"community.invites_expired","section":"community","label":"Invitaciones vencidas sin canjear","kind":"stock","definition":"Pendientes con vencimiento pasado (derivado: el estado expired solo se escribe al intentar canjear)","population":"provisional_claims pending vencidos"},
 {"id":"community.invite_conversion","section":"community","label":"Invitaciones canjeadas (%)","kind":"ratio","minN":5,"definition":"Canjeadas / (canjeadas + vencidas sin canjear), de las creadas en la ventana","population":"invitaciones de la ventana ya resueltas"},
 {"id":"community.ranking_editions","section":"community","label":"Ediciones de Ranking publicadas","kind":"flow","definition":"Ediciones semanales publicadas en la ventana","population":"ranking_editions con published_at en la ventana"},
 {"id":"usage.dau","section":"usage","label":"Activos del día (abrieron la app)","kind":"flow","definition":"Jugadores distintos con presencia en el último día de la ventana (apertura real autenticada, no último login)","population":"player_activity_days del día"},
 {"id":"usage.wau","section":"usage","label":"Activos 7 días","kind":"flow","definition":"Jugadores distintos con presencia en los últimos 7 días (no se suman DAU)","population":"player_activity_days de 7 días"},
 {"id":"usage.mau","section":"usage","label":"Activos 30 días","kind":"flow","definition":"Jugadores distintos con presencia en los últimos 30 días","population":"player_activity_days de 30 días"},
 {"id":"usage.dau_avg","section":"usage","label":"Promedio diario de activos","kind":"flow","definition":"Promedio de activos por día dentro de la ventana, desde que hay presencia","population":"días con presencia instrumentada"},
 {"id":"usage.standalone_share","section":"usage","label":"Uso desde la app instalada (%)","kind":"ratio","minN":5,"definition":"Días de presencia abiertos en modo app instalada. Es uso, NO instalaciones","population":"días de presencia de la ventana"},
 {"id":"usage.wau_with_action","section":"usage","label":"Con acción 7 días","kind":"flow","definition":"Jugadores distintos con una acción de usuario registrada en 7 días (retroactivo; no es presencia)","population":"acciones de usuario persistidas"},
 {"id":"usage.mau_with_action","section":"usage","label":"Con acción 30 días","kind":"flow","definition":"Jugadores distintos con una acción de usuario registrada en 30 días (retroactivo; no es presencia)","population":"acciones de usuario persistidas"},
 {"id":"usage.ret_w1","section":"usage","label":"Retención semanal W1 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia en la semana BA siguiente a la de su alta (solo cohortes maduras y posteriores al inicio de la presencia)","population":"altas de la ventana con semana objetivo completa"},
 {"id":"usage.ret_w4","section":"usage","label":"Retención semanal W4 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia en la 4.ª semana BA posterior a la de su alta","population":"altas de la ventana con semana objetivo completa"},
 {"id":"usage.ret_d1","section":"usage","label":"Retención D1 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente al día siguiente","population":"altas de la ventana con el día objetivo completo"},
 {"id":"usage.ret_d7","section":"usage","label":"Retención D7 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente 7 días después","population":"altas de la ventana con el día objetivo completo"},
 {"id":"usage.ret_d30","section":"usage","label":"Retención D30 (%)","kind":"ratio","minN":5,"definition":"Altas con presencia exactamente 30 días después","population":"altas de la ventana con el día objetivo completo"}
]$cat$::jsonb
$json$;

comment on function public._metrics_catalog is 'BRAMU Metrics: catálogo cerrado y versionado de KPIs (id, sección, tipo, definición, población, muestra mínima).';

-- Arma un KPI desde su entrada de catálogo + valores crudos {v,n,a,since,c} del período actual y previo.
create or replace function public._metrics_kpi(p_entry jsonb, p_cur jsonb, p_prev jsonb, p_compare boolean)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_id text := p_entry ->> 'id';
  v_kind text := p_entry ->> 'kind';
  v_min numeric := (p_entry ->> 'minN')::numeric;
  v_c jsonb := p_cur -> v_id;
  v_p jsonb := case when p_compare then p_prev -> v_id else null end;
  v_val numeric := (v_c ->> 'v')::numeric;
  v_n numeric := (v_c ->> 'n')::numeric;
  v_pval numeric := (v_p ->> 'v')::numeric;
  v_pn numeric := (v_p ->> 'n')::numeric;
  v_avail text;
  v_pavail text;
  v_abs numeric;
  v_pct numeric;
  v_note text;
begin
  v_avail := coalesce(v_c ->> 'a',
    case when v_min is not null and (v_n is null or v_n < v_min) then 'insufficient_sample'
         when v_kind = 'flow' and coalesce(v_val, 0) = 0 then 'no_evidence'
         else 'ok' end);
  if v_val is null and v_avail in ('ok', 'no_evidence') then v_avail := 'no_evidence'; end if;

  v_pavail := coalesce(v_p ->> 'a',
    case when v_p is null then null
         when v_min is not null and (v_pn is null or v_pn < v_min) then 'insufficient_sample'
         when v_kind = 'flow' and coalesce(v_pval, 0) = 0 then 'no_evidence'
         else 'ok' end);

  if not p_compare or v_p is null then
    v_note := 'sin_comparacion';
  elsif v_kind = 'stock' then
    v_note := 'stock_sin_comparacion';
  elsif v_avail not in ('ok', 'no_evidence') or v_pavail not in ('ok', 'no_evidence') or v_val is null or v_pval is null then
    v_note := 'sin_datos_suficientes';
  elsif v_kind = 'ratio' then
    v_abs := round((v_val - v_pval) * 100, 1);
    v_note := 'puntos_porcentuales';
  else
    v_abs := round(v_val - v_pval, 2);
    if v_pval > 0 then
      v_pct := round((v_val - v_pval) / v_pval * 100, 1);
    else
      v_note := 'base_previa_cero';
    end if;
  end if;

  return jsonb_build_object(
    'id', v_id, 'label', p_entry ->> 'label', 'kind', v_kind,
    'definition', p_entry ->> 'definition', 'population', p_entry ->> 'population',
    'value', case when v_avail in ('insufficient_sample', 'not_instrumented', 'immature') then null else round(v_val, 4) end,
    -- Con muestra insuficiente (k) NO se expone el numerador: value y count quedan nulos; n es el total de la población.
    'count', case when v_avail in ('insufficient_sample', 'not_instrumented', 'immature') then null else v_c -> 'c' end,
    'n', v_n,
    'previous', case when v_p is null then null
                     else jsonb_build_object('value', case when v_pavail in ('ok', 'no_evidence') then round(v_pval, 4) else null end, 'n', v_pn, 'availability', v_pavail) end,
    'delta', jsonb_build_object('abs', v_abs, 'pct', v_pct, 'note', v_note),
    'availability', v_avail,
    'since', v_c -> 'since'
  );
end;
$$;

create or replace function public._metrics_assemble(p_section text, p_cur jsonb, p_prev jsonb, p_compare boolean)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_agg(public._metrics_kpi(e, p_cur, p_prev, p_compare) order by o), '[]'::jsonb)
    from jsonb_array_elements(public._metrics_catalog()) with ordinality as t(e, o)
   where e ->> 'section' = p_section
$$;

-- «Valor crudo» uniforme: {v, n, c?, a?, since?}
create or replace function public._metrics_raw(p_v numeric, p_n numeric default null, p_count numeric default null, p_avail text default null, p_since date default null)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_strip_nulls(jsonb_build_object('v', p_v, 'n', p_n, 'c', p_count, 'a', p_avail, 'since', p_since))
         || case when p_v is null then jsonb_build_object('v', null) else '{}'::jsonb end
$$;

create or replace function public._metrics_ratio(p_num numeric, p_den numeric)
returns jsonb
language sql
immutable
set search_path = public
as $$ select public._metrics_raw(case when coalesce(p_den, 0) > 0 then p_num / p_den end, p_den, p_num) $$;

-- Acciones de usuario persistidas (retroactivas): NO es presencia. Excluye acciones administrativas y de sistema.
create or replace function public._metrics_user_actions()
returns table (player_id uuid, at timestamptz)
language sql
stable
set search_path = public
as $$
  select a.actor_player_id, a.occurred_at from public.match_actions a
   where a.action_type in ('created', 'declared_again_same_side', 'confirmed', 'revision_proposed', 'validated', 'identity_questioned', 'correction_accepted')
     and not (a.metadata ? 'adminActorLabel')
  union all select g.actor_player_id, g.occurred_at from public.group_events g
  union all select le.player_id, le.created_at from public.level_events le where le.event_type = 'initial_estimate'
  union all select n.player_id, n.read_at from public.notifications n where n.read_at is not null
$$;

-- ------------------------------------------------------------------
-- 5a) Núcleos por sección (valores crudos de UNA ventana) → jsonb { "<id>": {v,n,...} }
-- ------------------------------------------------------------------

create or replace function public._metrics_users_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_now integer; v_signups integer; v_guests integer; v_complete integer; v_loc integer;
begin
  select count(*) filter (where pl.is_active and pl.deleted_at is null),
         count(*) filter (where pl.created_at >= p_from and pl.created_at < p_to),
         count(*) filter (where pl.is_active and pl.deleted_at is null and pr.username is not null),
         count(*) filter (where pl.is_active and pl.deleted_at is null and pr.location_id is not null)
    into v_now, v_signups, v_complete, v_loc
    from public.players pl left join public.profiles pr on pr.player_id = pl.player_id
   where pl.type = 'registered' and not public._metrics_excluded(pl.player_id, p_include);
  select count(*) into v_guests from public.players
   where type = 'provisional' and recovered_into_player_id is null and deleted_at is null;

  return jsonb_build_object(
    'users.registered_now', public._metrics_raw(v_now, v_now),
    'users.signups', public._metrics_raw(v_signups),
    'users.guests_open', public._metrics_raw(v_guests),
    'users.profile_complete', public._metrics_raw(v_complete),
    'users.profile_complete_rate', public._metrics_ratio(v_complete, v_now),
    'users.with_location_rate', public._metrics_ratio(v_loc, v_now)
  );
end;
$$;

create or replace function public._metrics_matches_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_created integer; v_real integer; v_annulled integer; v_validated integer;
  v_pv integer; v_pw integer; v_exp integer; v_exp_validable integer; v_val_cohort integer;
  v_p50 numeric; v_p90 numeric; v_nval integer; v_authors integer; v_parts integer;
begin
  with mm as (
    select m.match_id, m.status, m.validation_deadline_at, m.created_by_player_id,
           (select count(*) from (
              select mp.team from public.match_participants mp
                join public.players p on p.player_id = mp.player_id and p.type = 'registered' and p.deleted_at is null
               where mp.match_id = m.match_id
               group by mp.team) t) as teams_with_account
      from public.matches m
     where m.created_at >= p_from and m.created_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include)
  )
  select count(*), count(*) filter (where status <> 'annulled'), count(*) filter (where status = 'annulled'),
         count(*) filter (where status = 'validated'),
         count(*) filter (where status = 'pending_validation' and validation_deadline_at >= p_asof and teams_with_account = 2),
         count(*) filter (where status = 'pending_validation' and validation_deadline_at >= p_asof and teams_with_account < 2),
         count(*) filter (where status = 'expired' or (status = 'pending_validation' and validation_deadline_at < p_asof)),
         count(*) filter (where status = 'expired' or (status = 'pending_validation' and validation_deadline_at < p_asof and teams_with_account = 2))
    into v_created, v_real, v_annulled, v_val_cohort, v_pv, v_pw, v_exp, v_exp_validable
    from mm;

  select count(*),
         percentile_cont(0.5) within group (order by extract(epoch from m.validated_at - m.created_at) / 3600),
         percentile_cont(0.9) within group (order by extract(epoch from m.validated_at - m.created_at) / 3600)
    into v_nval, v_p50, v_p90
    from public.matches m
   where m.status = 'validated' and m.validated_at >= p_from and m.validated_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include);
  v_validated := v_nval;

  select count(distinct m.created_by_player_id) into v_authors
    from public.matches m
   where m.created_at >= p_from and m.created_at < p_to and m.status <> 'annulled' and not public._metrics_excluded(m.created_by_player_id, p_include);
  select count(distinct mp.player_id) into v_parts
    from public.matches m
    join public.match_participants mp on mp.match_id = m.match_id
    join public.players p on p.player_id = mp.player_id and p.type = 'registered'
   where m.created_at >= p_from and m.created_at < p_to and m.status <> 'annulled' and not public._metrics_excluded(m.created_by_player_id, p_include);

  return jsonb_build_object(
    'matches.created', public._metrics_raw(v_created),
    'matches.real', public._metrics_raw(v_real),
    'matches.annulled', public._metrics_raw(v_annulled),
    'matches.validated', public._metrics_raw(v_validated),
    'matches.pending_validable', public._metrics_raw(v_pv),
    'matches.pending_waiting_counterpart', public._metrics_raw(v_pw),
    'matches.expired_derived', public._metrics_raw(v_exp),
    'matches.validation_rate_closed', public._metrics_ratio(v_val_cohort, v_val_cohort + v_exp_validable),
    'matches.validation_p50_hours', public._metrics_raw(round(v_p50, 2), v_nval),
    'matches.validation_p90_hours', public._metrics_raw(round(v_p90, 2), v_nval),
    'matches.authors', public._metrics_raw(v_authors),
    'matches.registered_participants', public._metrics_raw(v_parts)
  );
end;
$$;

create or replace function public._metrics_activation_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  r record;
begin
  with cohort as (
    select pl.player_id, pl.created_at as signup_at
      from public.players pl
     where pl.type = 'registered' and pl.created_at >= p_from and pl.created_at < p_to
       and not public._metrics_excluded(pl.player_id, p_include)
  ), mature as (
    select * from cohort where signup_at <= p_asof - interval '7 days'
  ), rm as (
    select * from public.matches where status <> 'annulled'
  ), lvl as (
    select player_id, min(created_at) as at from public.level_events where event_type = 'initial_estimate' group by 1
  ), authored as (
    select created_by_player_id as player_id, min(created_at) as at from rm group by 1
  ), part as (
    select mp.player_id, rm.created_at as at, rm.status,
           row_number() over (partition by mp.player_id order by rm.created_at) as n
      from public.match_participants mp join rm using (match_id) where mp.player_id is not null
  ), part_n as (
    select player_id, count(*) as played,
           bool_or(status = 'validated') as any_validated
      from part group by 1
  ), ret as (
    select m.player_id,
           bool_or(date_trunc('week', a.at at time zone 'America/Argentina/Buenos_Aires') >
                   date_trunc('week', m.signup_at at time zone 'America/Argentina/Buenos_Aires')) as returned
      from mature m left join public._metrics_user_actions() a on a.player_id = m.player_id and a.at <= p_asof
     group by 1
  )
  select (select count(*) from mature) as n_mature,
         (select count(*) from cohort where signup_at > p_asof - interval '7 days') as n_immature,
         count(l.at) as c_level, count(a.at) as c_loaded, count(pn.player_id) as c_part,
         count(*) filter (where pn.any_validated) as c_validated,
         count(*) filter (where pn.played >= 3) as c_third, count(*) filter (where pn.played >= 5) as c_fifth,
         count(*) filter (where rt.returned) as c_returned,
         count(a.at) as n_loaded,
         percentile_cont(0.5) within group (order by extract(epoch from a.at - mt.signup_at) / 86400) as med_days
    into r
    from mature mt
    left join lvl l on l.player_id = mt.player_id
    left join authored a on a.player_id = mt.player_id
    left join part_n pn on pn.player_id = mt.player_id
    left join ret rt on rt.player_id = mt.player_id;

  return jsonb_build_object(
    'activation.cohort', public._metrics_raw(r.n_mature),
    'activation.cohort_immature', public._metrics_raw(r.n_immature),
    'activation.level_initial', public._metrics_ratio(r.c_level, r.n_mature),
    'activation.loaded_first', public._metrics_ratio(r.c_loaded, r.n_mature),
    'activation.participated_first', public._metrics_ratio(r.c_part, r.n_mature),
    'activation.participated_validated', public._metrics_ratio(r.c_validated, r.n_mature),
    'activation.third_match', public._metrics_ratio(r.c_third, r.n_mature),
    'activation.fifth_match', public._metrics_ratio(r.c_fifth, r.n_mature),
    'activation.returned_other_week', public._metrics_ratio(r.c_returned, r.n_mature),
    'activation.median_days_to_first_load', public._metrics_raw(round(r.med_days::numeric, 2), r.n_loaded)
  );
end;
$$;

create or replace function public._metrics_community_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ga integer; v_gc integer; v_mem integer; v_ic integer; v_icl integer; v_io integer; v_ie integer;
  v_cohort_claimed integer; v_cohort_expired integer; v_ed integer;
begin
  select count(*) filter (where g.status = 'active'),
         count(*) filter (where g.created_at >= p_from and g.created_at < p_to)
    into v_ga, v_gc
    from public.groups g where not public._metrics_excluded(g.created_by_player_id, p_include);
  select count(*) into v_mem
    from public.group_memberships gm
    join public.groups g on g.group_id = gm.group_id and g.status = 'active'
    join public.players p on p.player_id = gm.player_id and p.deleted_at is null
   where gm.left_at is null and not public._metrics_excluded(gm.player_id, p_include);

  select count(*) filter (where c.created_at >= p_from and c.created_at < p_to),
         count(*) filter (where c.status = 'claimed' and c.claimed_at >= p_from and c.claimed_at < p_to),
         count(*) filter (where c.status = 'pending' and c.expires_at >= p_asof),
         count(*) filter (where c.status = 'pending' and c.expires_at < p_asof),
         count(*) filter (where c.created_at >= p_from and c.created_at < p_to and c.status = 'claimed'),
         count(*) filter (where c.created_at >= p_from and c.created_at < p_to and c.status in ('pending', 'expired') and c.expires_at < p_asof)
    into v_ic, v_icl, v_io, v_ie, v_cohort_claimed, v_cohort_expired
    from public.provisional_claims c where not public._metrics_excluded(c.created_by_player_id, p_include);

  select count(*) into v_ed from public.ranking_editions where published_at >= p_from and published_at < p_to;

  return jsonb_build_object(
    'community.groups_active', public._metrics_raw(v_ga),
    'community.groups_created', public._metrics_raw(v_gc),
    'community.memberships_active', public._metrics_raw(v_mem),
    'community.invites_created', public._metrics_raw(v_ic),
    'community.invites_claimed', public._metrics_raw(v_icl),
    'community.invites_open', public._metrics_raw(v_io),
    'community.invites_expired', public._metrics_raw(v_ie),
    'community.invite_conversion', public._metrics_ratio(v_cohort_claimed, v_cohort_claimed + v_cohort_expired),
    'community.ranking_editions', public._metrics_raw(v_ed)
  );
end;
$$;

-- Retención por cohorte de altas (presencia). Solo cohortes maduras y posteriores al inicio de la presencia.
create or replace function public._metrics_retention(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language sql
stable
set search_path = public
as $$
  with t as (select (min(a.first_seen_at) at time zone 'America/Argentina/Buenos_Aires')::date as since_day from public.player_activity_days a),
  asof as (select (p_asof at time zone 'America/Argentina/Buenos_Aires')::date as d),
  cohort as (
    select pl.player_id, (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date as sd
      from public.players pl, t
     where pl.type = 'registered' and pl.created_at >= p_from and pl.created_at < p_to
       and t.since_day is not null and (pl.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= t.since_day - 1
       and not public._metrics_excluded(pl.player_id, p_include)
  ), r as (
    select c.player_id, c.sd,
           coalesce(bool_or(a.activity_date = c.sd + 1), false) as d1,
           coalesce(bool_or(a.activity_date = c.sd + 7), false) as d7,
           coalesce(bool_or(a.activity_date = c.sd + 30), false) as d30,
           coalesce(bool_or(date_trunc('week', a.activity_date::timestamp) = date_trunc('week', c.sd::timestamp) + interval '1 week'), false) as w1,
           coalesce(bool_or(date_trunc('week', a.activity_date::timestamp) = date_trunc('week', c.sd::timestamp) + interval '4 weeks'), false) as w4
      from cohort c left join public.player_activity_days a on a.player_id = c.player_id
     group by 1, 2
  )
  select jsonb_build_object(
    'cohort', count(*),
    'd1_den', count(*) filter (where sd + 1 <= asof.d - 1),   'd1_ret', count(*) filter (where d1 and sd + 1 <= asof.d - 1),
    'd7_den', count(*) filter (where sd + 7 <= asof.d - 1),   'd7_ret', count(*) filter (where d7 and sd + 7 <= asof.d - 1),
    'd30_den', count(*) filter (where sd + 30 <= asof.d - 1), 'd30_ret', count(*) filter (where d30 and sd + 30 <= asof.d - 1),
    'w1_den', count(*) filter (where date_trunc('week', sd::timestamp) + interval '2 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w1_ret', count(*) filter (where w1 and date_trunc('week', sd::timestamp) + interval '2 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w4_den', count(*) filter (where date_trunc('week', sd::timestamp) + interval '5 weeks' <= date_trunc('week', asof.d::timestamp)),
    'w4_ret', count(*) filter (where w4 and date_trunc('week', sd::timestamp) + interval '5 weeks' <= date_trunc('week', asof.d::timestamp))
  ) from r, asof
$$;

-- Presencia + proxys por acción. p_end = fin efectivo de la ventana (se evalúa «móvil» hasta ese instante).
create or replace function public._metrics_usage_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_since timestamptz;
  v_since_d date;
  v_e date := ((least(p_asof, p_to) - interval '1 microsecond') at time zone 'America/Argentina/Buenos_Aires')::date;
  v_from_d date := (p_from at time zone 'America/Argentina/Buenos_Aires')::date;
  v_dau integer; v_wau integer; v_mau integer; v_days integer; v_avg numeric;
  v_rows integer; v_stand integer; v_wa integer; v_ma integer;
  v_ret jsonb;
  v_avail text;
  v_partial date;
  v_out jsonb;
begin
  select min(first_seen_at) into v_since from public.player_activity_days;
  v_since_d := (v_since at time zone 'America/Argentina/Buenos_Aires')::date;

  -- Acciones de usuario (retroactivo, no es presencia)
  select count(distinct a.player_id) filter (where a.at >= ((v_e - 6)::timestamp at time zone 'America/Argentina/Buenos_Aires') and a.at < ((v_e + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires')),
         count(distinct a.player_id) filter (where a.at >= ((v_e - 29)::timestamp at time zone 'America/Argentina/Buenos_Aires') and a.at < ((v_e + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'))
    into v_wa, v_ma
    from public._metrics_user_actions() a where not public._metrics_excluded(a.player_id, p_include);

  v_out := jsonb_build_object(
    'usage.wau_with_action', public._metrics_raw(v_wa),
    'usage.mau_with_action', public._metrics_raw(v_ma)
  );

  if v_since is null or v_e < v_since_d then
    v_avail := 'not_instrumented';
    return v_out || jsonb_build_object(
      'usage.dau', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.wau', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.mau', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.dau_avg', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.standalone_share', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.ret_w1', public._metrics_raw(null, null, null, v_avail, v_since_d), 'usage.ret_w4', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.ret_d1', public._metrics_raw(null, null, null, v_avail, v_since_d), 'usage.ret_d7', public._metrics_raw(null, null, null, v_avail, v_since_d),
      'usage.ret_d30', public._metrics_raw(null, null, null, v_avail, v_since_d));
  end if;

  select count(distinct a.player_id) filter (where a.activity_date = v_e),
         count(distinct a.player_id) filter (where a.activity_date > v_e - 7),
         count(distinct a.player_id) filter (where a.activity_date > v_e - 30)
    into v_dau, v_wau, v_mau
    from public.player_activity_days a
   where a.activity_date > v_e - 30 and a.activity_date <= v_e and not public._metrics_excluded(a.player_id, p_include);

  select count(distinct d), coalesce(avg(c), 0) into v_days, v_avg from (
    select gs.d, (select count(distinct a.player_id) from public.player_activity_days a
                   where a.activity_date = gs.d and not public._metrics_excluded(a.player_id, p_include)) as c
      from generate_series(greatest(v_from_d, v_since_d), v_e, interval '1 day') g(d2)
     cross join lateral (select g.d2::date as d) gs
  ) x;

  select count(*), count(*) filter (where a.display_mode = 'standalone') into v_rows, v_stand
    from public.player_activity_days a
   where a.activity_date >= v_from_d and a.activity_date <= v_e and not public._metrics_excluded(a.player_id, p_include);

  v_ret := public._metrics_retention(p_from, p_to, p_asof, p_include);

  -- cobertura parcial: la ventana arranca antes de que existiera la presencia
  v_partial := case when v_from_d < v_since_d then v_since_d else null end;

  return v_out || jsonb_build_object(
    'usage.dau', public._metrics_raw(v_dau, null, null, 'ok', case when v_e < v_since_d then v_since_d end),
    'usage.wau', public._metrics_raw(v_wau, null, null, 'ok', case when v_e - 6 < v_since_d then v_since_d end),
    'usage.mau', public._metrics_raw(v_mau, null, null, 'ok', case when v_e - 29 < v_since_d then v_since_d end),
    'usage.dau_avg', public._metrics_raw(round(v_avg, 2), v_days, null, 'ok', v_partial),
    'usage.standalone_share', public._metrics_ratio(v_stand, v_rows) || case when v_partial is not null then jsonb_build_object('since', v_partial) else '{}'::jsonb end,
    'usage.ret_w1', public._metrics_raw(case when (v_ret ->> 'w1_den')::int > 0 then (v_ret ->> 'w1_ret')::numeric / (v_ret ->> 'w1_den')::numeric end, (v_ret ->> 'w1_den')::numeric, (v_ret ->> 'w1_ret')::numeric,
                                        case when (v_ret ->> 'w1_den')::int = 0 then 'immature' end),
    'usage.ret_w4', public._metrics_raw(case when (v_ret ->> 'w4_den')::int > 0 then (v_ret ->> 'w4_ret')::numeric / (v_ret ->> 'w4_den')::numeric end, (v_ret ->> 'w4_den')::numeric, (v_ret ->> 'w4_ret')::numeric,
                                        case when (v_ret ->> 'w4_den')::int = 0 then 'immature' end),
    'usage.ret_d1', public._metrics_raw(case when (v_ret ->> 'd1_den')::int > 0 then (v_ret ->> 'd1_ret')::numeric / (v_ret ->> 'd1_den')::numeric end, (v_ret ->> 'd1_den')::numeric, (v_ret ->> 'd1_ret')::numeric,
                                        case when (v_ret ->> 'd1_den')::int = 0 then 'immature' end),
    'usage.ret_d7', public._metrics_raw(case when (v_ret ->> 'd7_den')::int > 0 then (v_ret ->> 'd7_ret')::numeric / (v_ret ->> 'd7_den')::numeric end, (v_ret ->> 'd7_den')::numeric, (v_ret ->> 'd7_ret')::numeric,
                                        case when (v_ret ->> 'd7_den')::int = 0 then 'immature' end),
    'usage.ret_d30', public._metrics_raw(case when (v_ret ->> 'd30_den')::int > 0 then (v_ret ->> 'd30_ret')::numeric / (v_ret ->> 'd30_den')::numeric end, (v_ret ->> 'd30_den')::numeric, (v_ret ->> 'd30_ret')::numeric,
                                        case when (v_ret ->> 'd30_den')::int = 0 then 'immature' end)
  );
end;
$$;

-- ------------------------------------------------------------------
-- 5b) Secciones públicas (service_role): {meta, kpis, series, breakdowns}
-- ------------------------------------------------------------------

create or replace function public._metrics_run(
  p_section text,
  p_range text, p_compare boolean, p_include boolean, p_asof timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_w jsonb := public._metrics_window(p_range, p_asof);
  v_from timestamptz := (v_w ->> 'from')::timestamptz;
  v_to timestamptz := (v_w ->> 'to')::timestamptz;
  v_pfrom timestamptz := (v_w ->> 'prevFrom')::timestamptz;
  v_pto timestamptz := (v_w ->> 'prevTo')::timestamptz;
  v_gran text := v_w ->> 'granularity';
  v_cmp boolean := coalesce(p_compare, true) and (v_w ->> 'prevFrom') is not null;
  v_cur jsonb; v_prev jsonb;
begin
  v_cur := case p_section
    when 'users' then public._metrics_users_core(v_from, v_to, p_asof, p_include)
    when 'matches' then public._metrics_matches_core(v_from, v_to, p_asof, p_include)
    when 'activation' then public._metrics_activation_core(v_from, v_to, p_asof, p_include)
    when 'community' then public._metrics_community_core(v_from, v_to, p_asof, p_include)
    when 'usage' then public._metrics_usage_core(v_from, v_to, p_asof, p_include)
  end;
  if v_cmp then
    v_prev := case p_section
      when 'users' then public._metrics_users_core(v_pfrom, v_pto, p_asof, p_include)
      when 'matches' then public._metrics_matches_core(v_pfrom, v_pto, p_asof, p_include)
      when 'activation' then public._metrics_activation_core(v_pfrom, v_pto, p_asof, p_include)
      when 'community' then public._metrics_community_core(v_pfrom, v_pto, p_asof, p_include)
      when 'usage' then public._metrics_usage_core(v_pfrom, v_pto, p_asof, p_include)
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'section', p_section,
    'meta', public._metrics_meta(p_range, p_compare, p_include, p_asof, v_w),
    'kpis', public._metrics_assemble(p_section, v_cur, v_prev, v_cmp),
    'series', case p_section
      when 'users' then jsonb_build_object('signups', jsonb_build_object('granularity', v_gran,
          'current', public._metrics_series('signups', v_from, v_to, v_gran, p_include),
          'previous', case when v_cmp then public._metrics_series('signups', v_pfrom, v_pto, v_gran, p_include) end))
      when 'matches' then jsonb_build_object(
          'created', jsonb_build_object('granularity', v_gran,
            'current', public._metrics_series('matches_created', v_from, v_to, v_gran, p_include),
            'previous', case when v_cmp then public._metrics_series('matches_created', v_pfrom, v_pto, v_gran, p_include) end),
          'played', jsonb_build_object('granularity', v_gran,
            'current', public._metrics_series('matches_played', v_from, v_to, v_gran, p_include),
            'previous', case when v_cmp then public._metrics_series('matches_played', v_pfrom, v_pto, v_gran, p_include) end),
          'validated', jsonb_build_object('granularity', v_gran,
            'current', public._metrics_series('matches_validated', v_from, v_to, v_gran, p_include),
            'previous', case when v_cmp then public._metrics_series('matches_validated', v_pfrom, v_pto, v_gran, p_include) end))
      when 'usage' then jsonb_build_object('active_players', jsonb_build_object('granularity', v_gran,
          'current', public._metrics_series('active_players', v_from, v_to, v_gran, p_include),
          'previous', case when v_cmp then public._metrics_series('active_players', v_pfrom, v_pto, v_gran, p_include) end))
      else '{}'::jsonb end,
    'breakdowns', case p_section
      when 'users' then jsonb_build_object('location', public._metrics_apply_k((
          select coalesce(jsonb_agg(jsonb_build_object('label', lbl, 'n', n)), '[]'::jsonb) from (
            select case when l.location_id is null then '(sin localidad)' else l.locality_label || ', ' || l.province_label end as lbl, count(*) as n
              from public.players pl join public.profiles pr on pr.player_id = pl.player_id
              left join public.locations l on l.location_id = pr.location_id
             where pl.type = 'registered' and pl.is_active and pl.deleted_at is null and not public._metrics_excluded(pl.player_id, p_include)
             group by 1) s)))
      when 'matches' then jsonb_build_object('status', jsonb_build_object('suppressed', false, 'items', (
          select coalesce(jsonb_agg(jsonb_build_object('label', bucket, 'n', n) order by bucket), '[]'::jsonb) from (
            select case when status = 'annulled' then 'annulled_' || coalesce(annulment_reason ->> 'kind', 'admin')
                        when status = 'validated' then 'validated'
                        when status = 'expired' or (status = 'pending_validation' and validation_deadline_at < p_asof) then 'expired_derived'
                        else 'pending' end as bucket, count(*) as n
              from public.matches m
             where m.created_at >= v_from and m.created_at < v_to and not public._metrics_excluded(m.created_by_player_id, p_include)
             group by 1) s)))
      when 'community' then jsonb_build_object('level_status', public._metrics_apply_k((
          select coalesce(jsonb_agg(jsonb_build_object('label', status, 'n', n)), '[]'::jsonb) from (
            select ls.status, count(*) as n
              from public.level_states ls join public.players pl on pl.player_id = ls.player_id
             where pl.type = 'registered' and pl.deleted_at is null and pl.is_active and not public._metrics_excluded(pl.player_id, p_include)
             group by 1) s)))
      when 'usage' then jsonb_build_object(
          'platform', public._metrics_apply_k((
            select coalesce(jsonb_agg(jsonb_build_object('label', platform, 'n', n)), '[]'::jsonb) from (
              select x.platform, count(*) as n from (
                select distinct on (a.player_id) a.platform from public.player_activity_days a
                 where a.activity_date > public._metrics_ba_date(least(p_asof, v_to) - interval '1 microsecond') - 7
                   and a.activity_date <= public._metrics_ba_date(least(p_asof, v_to) - interval '1 microsecond')
                   and not public._metrics_excluded(a.player_id, p_include)
                 order by a.player_id, a.activity_date desc) x group by 1) s)),
          'bundle', public._metrics_apply_k((
            select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(bundle, '(sin dato)'), 'n', n)), '[]'::jsonb) from (
              select x.app_bundle as bundle, count(*) as n from (
                select distinct on (a.player_id) a.app_bundle from public.player_activity_days a
                 where a.activity_date > public._metrics_ba_date(least(p_asof, v_to) - interval '1 microsecond') - 7
                   and a.activity_date <= public._metrics_ba_date(least(p_asof, v_to) - interval '1 microsecond')
                   and not public._metrics_excluded(a.player_id, p_include)
                 order by a.player_id, a.activity_date desc) x group by 1) s)))
      else '{}'::jsonb end
  );
end;
$$;

create or replace function public.metrics_users(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb language sql stable security definer set search_path = public
as $$ select public._metrics_run('users', p_range, p_compare, p_include_internal, p_asof) $$;

create or replace function public.metrics_matches(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb language sql stable security definer set search_path = public
as $$ select public._metrics_run('matches', p_range, p_compare, p_include_internal, p_asof) $$;

create or replace function public.metrics_activation(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb language sql stable security definer set search_path = public
as $$ select public._metrics_run('activation', p_range, p_compare, p_include_internal, p_asof) $$;

create or replace function public.metrics_community(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb language sql stable security definer set search_path = public
as $$ select public._metrics_run('community', p_range, p_compare, p_include_internal, p_asof) $$;

create or replace function public.metrics_usage(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb language sql stable security definer set search_path = public
as $$ select public._metrics_run('usage', p_range, p_compare, p_include_internal, p_asof) $$;

-- Inicio: KPIs ancla elegidos del catálogo (sin duplicar lógica) + series de usuarios, partidos y activos.
create or replace function public.metrics_overview(p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false, p_asof timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids text[] := array['users.registered_now', 'users.signups', 'usage.wau', 'matches.created', 'matches.validated', 'community.groups_active'];
  v_users jsonb := public._metrics_run('users', p_range, p_compare, p_include_internal, p_asof);
  v_matches jsonb := public._metrics_run('matches', p_range, p_compare, p_include_internal, p_asof);
  v_usage jsonb := public._metrics_run('usage', p_range, p_compare, p_include_internal, p_asof);
  v_comm jsonb := public._metrics_run('community', p_range, p_compare, p_include_internal, p_asof);
  v_act jsonb := public._metrics_run('activation', p_range, p_compare, p_include_internal, p_asof);
begin
  return jsonb_build_object(
    'ok', true,
    'section', 'overview',
    'meta', v_users -> 'meta',
    'kpis', (
      select coalesce(jsonb_agg(k order by array_position(v_ids, k ->> 'id')), '[]'::jsonb)
        from (select k from jsonb_array_elements((v_users -> 'kpis') || (v_matches -> 'kpis') || (v_usage -> 'kpis') || (v_comm -> 'kpis')) k) s
       where (k ->> 'id') = any (v_ids)),
    'funnel', (
      select coalesce(jsonb_agg(k order by array_position(array['activation.cohort', 'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.third_match', 'activation.fifth_match'], k ->> 'id')), '[]'::jsonb)
        from jsonb_array_elements(v_act -> 'kpis') k
       where (k ->> 'id') = any (array['activation.cohort', 'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.third_match', 'activation.fifth_match'])),
    'series', jsonb_build_object(
      'signups', v_users #> '{series,signups}',
      'matches_created', v_matches #> '{series,created}',
      'active_players', v_usage #> '{series,active_players}')
  );
end;
$$;

-- ------------------------------------------------------------------
-- 6) Permisos: SOLO service_role (patrón ops_health_snapshot). Nada ejecutable por clientes.
-- ------------------------------------------------------------------

revoke all on function public.metrics_min_cell() from public, anon, authenticated;
revoke all on function public.metrics_is_admin(uuid) from public, anon, authenticated;
revoke all on function public._metrics_excluded(uuid, boolean) from public, anon, authenticated;
revoke all on function public._metrics_window(text, timestamptz) from public, anon, authenticated;
revoke all on function public._metrics_ba_date(timestamptz) from public, anon, authenticated;
revoke all on function public._metrics_meta(text, boolean, boolean, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public._metrics_apply_k(jsonb) from public, anon, authenticated;
revoke all on function public._metrics_series(text, timestamptz, timestamptz, text, boolean) from public, anon, authenticated;
revoke all on function public._metrics_catalog() from public, anon, authenticated;
revoke all on function public._metrics_kpi(jsonb, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public._metrics_assemble(text, jsonb, jsonb, boolean) from public, anon, authenticated;
revoke all on function public._metrics_raw(numeric, numeric, numeric, text, date) from public, anon, authenticated;
revoke all on function public._metrics_ratio(numeric, numeric) from public, anon, authenticated;
revoke all on function public._metrics_user_actions() from public, anon, authenticated;
revoke all on function public._metrics_users_core(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_matches_core(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_activation_core(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_community_core(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_retention(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_usage_core(timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_run(text, text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_users(text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_matches(text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_activation(text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_community(text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_usage(text, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_overview(text, boolean, boolean, timestamptz) from public, anon, authenticated;

grant execute on function public.metrics_is_admin(uuid) to service_role;
grant execute on function public.metrics_users(text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.metrics_matches(text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.metrics_activation(text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.metrics_community(text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.metrics_usage(text, boolean, boolean, timestamptz) to service_role;
grant execute on function public.metrics_overview(text, boolean, boolean, timestamptz) to service_role;
-- Los helpers `_metrics_*` y metrics_min_cell() los invocan las funciones SECURITY DEFINER (dueño): no se conceden a nadie más.
