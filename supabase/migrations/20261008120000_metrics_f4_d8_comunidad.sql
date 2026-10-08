-- BRAMU Metrics V1 · F4 — Decisión D8 (días completos), indicadores de Comunidad/Nivel/Ranking y «hoy parcial». SOLO lectura, SOLO service_role.
--
-- Ver docs/BRAMUlab/Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md §11 y 149 §8.
-- Migración ADITIVA: no crea tablas ni toca datos; reemplaza (create or replace) funciones de métricas de F2 conservando sus permisos
-- y agrega dos helpers internos. NO aplicada desde el sandbox del agente — la aplica Central en Staging.
--
--   1) D8 — «días completos hasta ayer»: `_metrics_window` fija el FIN de la ventana actual en las 00:00 de HOY (BA), no en el instante de
--      consulta. La previa son los N días completos anteriores (misma longitud, ambos completos). DAU/WAU/MAU miran, por construcción,
--      hasta AYER. Los saldos al corte (cuentas, grupos, membresías, invitaciones abiertas) siguen siendo el estado actual.
--   2) «Hoy (parcial)» — `_metrics_today`: altas, partidos cargados/validados y activos de HOY, claramente parciales y NUNCA comparados.
--   3) Seis KPIs nuevos `community.*` (grupos con partido, tamaño medio de grupo, Nivel calibrado, Ranking: antigüedad de la última edición,
--      elegibles y tasa de elegibilidad), tres desgloses (tamaño de grupo, banda de Nivel con n ≥ 10, densidad de universos de Ranking) y
--      dos series (grupos e invitaciones creados).
--   4) Fix de coherencia: los ratios que son FOTO DEL ESTADO ACTUAL (perfiles completos, localidad, Nivel calibrado, elegibilidad) llevan
--      `snapshot:true` y no se comparan (antes el período previo repetía el mismo estado y mostraba «Sin cambios»).
--
-- Permisos: igual que F2 (revoke … from public, anon, authenticated; grant execute … to service_role). `create or replace` conserva el ACL
-- de las funciones existentes; las nuevas se revocan/conceden explícitamente al final.


-- ------------------------------------------------------------------
-- 1) Ventana D8: días completos hasta ayer
-- ------------------------------------------------------------------
create or replace function public._metrics_window(p_range text, p_asof timestamptz)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_today date := (p_asof at time zone 'America/Argentina/Buenos_Aires')::date;
  v_today0 timestamptz := (v_today::timestamp) at time zone 'America/Argentina/Buenos_Aires';
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
    v_from := least((((v_first at time zone 'America/Argentina/Buenos_Aires')::date)::timestamp) at time zone 'America/Argentina/Buenos_Aires', v_today0);
    v_span := greatest(1, v_today - (v_from at time zone 'America/Argentina/Buenos_Aires')::date);
    return jsonb_build_object('range', p_range, 'from', v_from, 'to', v_today0, 'prevFrom', null, 'prevTo', null,
                              'days', v_span, 'granularity', case when v_span <= 45 then 'day' else 'week_ba' end);
  end if;
  v_days := replace(p_range, 'd', '')::integer;
  v_from := ((v_today - v_days)::timestamp) at time zone 'America/Argentina/Buenos_Aires';
  return jsonb_build_object(
    'range', p_range, 'from', v_from, 'to', v_today0,
    'prevFrom', ((v_today - 2 * v_days)::timestamp) at time zone 'America/Argentina/Buenos_Aires', 'prevTo', v_from,
    'days', v_days, 'granularity', case when v_days <= 45 then 'day' else 'week_ba' end);
end;
$$;


-- Meta: agrega completeDaysOnly (D8) y la fecha de «hoy» BA
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
    'completeDaysOnly', true,
    'today', (p_asof at time zone 'America/Argentina/Buenos_Aires')::date,
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


-- ------------------------------------------------------------------
-- 2) «Hoy (parcial)»: actividad del día en curso, fuera de toda comparación
-- ------------------------------------------------------------------
create or replace function public._metrics_today(p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_d date := (p_asof at time zone 'America/Argentina/Buenos_Aires')::date;
  v_t0 timestamptz := (v_d::timestamp) at time zone 'America/Argentina/Buenos_Aires';
  v_signups integer; v_created integer; v_validated integer; v_active integer; v_since date;
begin
  select count(*) into v_signups from public.players pl
   where pl.type = 'registered' and pl.created_at >= v_t0 and pl.created_at <= p_asof and not public._metrics_excluded(pl.player_id, p_include);
  select count(*) into v_created from public.matches m
   where m.created_at >= v_t0 and m.created_at <= p_asof and not public._metrics_excluded(m.created_by_player_id, p_include);
  select count(*) into v_validated from public.matches m
   where m.status = 'validated' and m.validated_at >= v_t0 and m.validated_at <= p_asof and not public._metrics_excluded(m.created_by_player_id, p_include);
  select (min(a.first_seen_at) at time zone 'America/Argentina/Buenos_Aires')::date into v_since from public.player_activity_days a;
  if v_since is not null and v_since <= v_d then
    select count(distinct a.player_id) into v_active from public.player_activity_days a
     where a.activity_date = v_d and not public._metrics_excluded(a.player_id, p_include);
  end if;
  return jsonb_build_object('date', v_d, 'partial', true, 'asOf', p_asof,
    'signups', v_signups, 'matchesCreated', v_created, 'matchesValidated', v_validated,
    'activePlayers', v_active, 'activePlayersAvailability', case when v_active is null then 'not_instrumented' else 'ok' end,
    'presenceSince', v_since);
end;
$$;


-- Series: +groups_created, +invites_created
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
  if p_source not in ('signups', 'matches_created', 'matches_played', 'matches_validated', 'active_players', 'groups_created', 'invites_created') then
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
      union all
      select (g.created_at at time zone 'America/Argentina/Buenos_Aires')::date, g.group_id, 'groups_created'
        from public.groups g
       where g.created_at >= p_from and g.created_at < p_to and not public._metrics_excluded(g.created_by_player_id, p_include)
      union all
      select (c.created_at at time zone 'America/Argentina/Buenos_Aires')::date, c.claim_id, 'invites_created'
        from public.provisional_claims c
       where c.created_at >= p_from and c.created_at < p_to and not public._metrics_excluded(c.created_by_player_id, p_include)
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


-- KPI: soporte de `snapshot` (ratio que es foto del estado actual: no se compara contra el período previo)
create or replace function public._metrics_kpi(p_entry jsonb, p_cur jsonb, p_prev jsonb, p_compare boolean)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_id text := p_entry ->> 'id';
  v_kind text := p_entry ->> 'kind';
  v_snap boolean := coalesce((p_entry ->> 'snapshot')::boolean, false);
  v_min numeric := (p_entry ->> 'minN')::numeric;
  v_c jsonb := p_cur -> v_id;
  v_p jsonb := case when p_compare and not v_snap then p_prev -> v_id else null end;
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

  if not p_compare then
    v_note := 'sin_comparacion';
  elsif v_kind = 'stock' or v_snap then
    v_note := 'stock_sin_comparacion';
  elsif v_p is null then
    v_note := 'sin_comparacion';
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
    'id', v_id, 'label', p_entry ->> 'label', 'kind', v_kind, 'snapshot', v_snap,
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


-- Catálogo: +6 KPIs community.*, `snapshot` en 2 ratios de users, definiciones D8 de DAU/WAU/MAU
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
 {"id":"users.profile_complete_rate","section":"users","label":"Perfiles completos (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Perfiles completos sobre cuentas actuales","population":"cuentas registradas actuales"},
 {"id":"users.with_location_rate","section":"users","label":"Con localidad declarada (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas actuales con localidad declarada (sin localidad no equivale a otra localidad)","population":"cuentas registradas actuales"},
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
 {"id":"community.groups_with_match","section":"community","label":"Grupos con partido","kind":"flow","definition":"Grupos vigentes al corte con al menos un partido validado calificable (criterio de Grupos BRAMU: 3 o más integrantes) jugado dentro de la ventana","population":"groups status active con partido calificable en la ventana"},
 {"id":"community.groups_avg_members","section":"community","label":"Integrantes por grupo (promedio)","kind":"stock","minN":5,"definition":"Promedio de integrantes vigentes por grupo vigente, al corte (requiere al menos 5 grupos)","population":"groups status active"},
 {"id":"community.level_calibrated_share","section":"community","label":"Nivel calibrado (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas con Nivel CALIBRADO sobre las que ya iniciaron su Nivel (sin PENDIENTE), al corte. Foto del estado actual: no se compara","population":"cuentas registradas actuales con Nivel iniciado"},
 {"id":"community.ranking_days_since_edition","section":"community","label":"Días desde la última edición de Ranking","kind":"stock","definition":"Días de Buenos Aires entre la última edición semanal publicada y el corte","population":"ranking_editions publicadas"},
 {"id":"community.ranking_eligible_players","section":"community","label":"Elegibles en la última edición","kind":"stock","definition":"Cuentas elegibles para Ranking en la última edición publicada (alcance global), según el snapshot de esa edición","population":"ranking_rows global elegibles de la última edición"},
 {"id":"community.ranking_eligibility_rate","section":"community","label":"Cuentas elegibles para Ranking (%)","kind":"ratio","snapshot":true,"minN":5,"definition":"Cuentas actuales que figuran como elegibles en la última edición sobre el total de cuentas actuales. Foto del estado actual: no se compara","population":"cuentas registradas actuales"},
 {"id":"usage.dau","section":"usage","label":"Activos en el último día completo","kind":"flow","definition":"Jugadores distintos con presencia en el último día completo de la ventana (ayer, en la ventana actual; apertura real autenticada, no último login). La actividad de hoy se informa aparte como parcial","population":"player_activity_days del día"},
 {"id":"usage.wau","section":"usage","label":"Activos 7 días","kind":"flow","definition":"Jugadores distintos con presencia en los 7 días completos que terminan ayer (no se suman DAU)","population":"player_activity_days de 7 días"},
 {"id":"usage.mau","section":"usage","label":"Activos 30 días","kind":"flow","definition":"Jugadores distintos con presencia en los 30 días completos que terminan ayer","population":"player_activity_days de 30 días"},
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


comment on function public._metrics_catalog is 'BRAMU Metrics: catálogo cerrado y versionado de KPIs (id, sección, tipo, definición, población, muestra mínima, snapshot).';


-- ------------------------------------------------------------------
-- 3) Comunidad: grupos, Nivel y Ranking (tres sistemas separados)
-- ------------------------------------------------------------------
create or replace function public._metrics_community_core(p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ga integer; v_gc integer; v_mem integer; v_ic integer; v_icl integer; v_io integer; v_ie integer;
  v_cohort_claimed integer; v_cohort_expired integer; v_ed integer;
  v_gwm integer; v_ng integer; v_avg numeric;
  v_cal integer; v_started integer; v_regnow integer;
  v_ed_id uuid; v_ed_at timestamptz; v_elig integer; v_elig_now integer;
  v_rank_days jsonb; v_rank_elig jsonb; v_rank_rate jsonb;
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

  -- Grupos: con partido calificable (fuente única del criterio: _groups_candidate_matches_exact) y tamaño medio
  select count(*) into v_gwm
    from public.groups g
   where g.status = 'active' and not public._metrics_excluded(g.created_by_player_id, p_include)
     and exists (select 1 from public._groups_candidate_matches_exact(g.group_id, p_from, p_to));
  select count(*), avg(s.c) into v_ng, v_avg from (
    select (select count(*) from public.group_memberships gm
              join public.players p on p.player_id = gm.player_id and p.deleted_at is null
             where gm.group_id = g.group_id and gm.left_at is null and not public._metrics_excluded(gm.player_id, p_include)) as c
      from public.groups g
     where g.status = 'active' and not public._metrics_excluded(g.created_by_player_id, p_include)) s;

  -- Nivel: estado de calibración actual
  select count(*) filter (where ls.status = 'CALIBRADO'), count(*) filter (where ls.status <> 'PENDIENTE')
    into v_cal, v_started
    from public.level_states ls join public.players pl on pl.player_id = ls.player_id
   where pl.type = 'registered' and pl.is_active and pl.deleted_at is null and not public._metrics_excluded(pl.player_id, p_include);

  -- Ranking: última edición publicada hasta el corte
  select count(*) into v_regnow from public.players pl
   where pl.type = 'registered' and pl.is_active and pl.deleted_at is null and not public._metrics_excluded(pl.player_id, p_include);
  select e.edition_id, e.published_at into v_ed_id, v_ed_at
    from public.ranking_editions e where e.published_at <= p_asof order by e.published_at desc limit 1;
  if v_ed_id is null then
    v_rank_days := public._metrics_raw(null, null, null, 'no_evidence');
    v_rank_elig := public._metrics_raw(null, null, null, 'no_evidence');
    v_rank_rate := public._metrics_raw(null, v_regnow, null, 'no_evidence');
  else
    select count(*), count(*) filter (where pl.is_active and pl.deleted_at is null) into v_elig, v_elig_now
      from public.ranking_rows rr join public.players pl on pl.player_id = rr.player_id
     where rr.edition_id = v_ed_id and rr.scope_type = 'global' and rr.is_eligible and not public._metrics_excluded(rr.player_id, p_include);
    v_rank_days := public._metrics_raw(((p_asof at time zone 'America/Argentina/Buenos_Aires')::date - (v_ed_at at time zone 'America/Argentina/Buenos_Aires')::date)::numeric);
    v_rank_elig := public._metrics_raw(v_elig);
    v_rank_rate := public._metrics_ratio(v_elig_now, v_regnow);
  end if;

  return jsonb_build_object(
    'community.groups_active', public._metrics_raw(v_ga),
    'community.groups_created', public._metrics_raw(v_gc),
    'community.memberships_active', public._metrics_raw(v_mem),
    'community.invites_created', public._metrics_raw(v_ic),
    'community.invites_claimed', public._metrics_raw(v_icl),
    'community.invites_open', public._metrics_raw(v_io),
    'community.invites_expired', public._metrics_raw(v_ie),
    'community.invite_conversion', public._metrics_ratio(v_cohort_claimed, v_cohort_claimed + v_cohort_expired),
    'community.ranking_editions', public._metrics_raw(v_ed),
    'community.groups_with_match', public._metrics_raw(v_gwm),
    'community.groups_avg_members', public._metrics_raw(round(v_avg, 1), v_ng),
    'community.level_calibrated_share', public._metrics_ratio(v_cal, v_started),
    'community.ranking_days_since_edition', v_rank_days,
    'community.ranking_eligible_players', v_rank_elig,
    'community.ranking_eligibility_rate', v_rank_rate
  );
end;
$$;

-- Desgloses de Comunidad. Personas: umbral k (5) vía _metrics_apply_k; distribución de Nivel además exige n ≥ 10 calibrados.
-- Universos de Ranking: se cuentan universos (no personas) por estado de densidad.
create or replace function public._metrics_community_breakdowns(p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ed_id uuid;
  v_cal integer;
  v_band jsonb;
  v_density jsonb;
begin
  select e.edition_id into v_ed_id from public.ranking_editions e where e.published_at <= p_asof order by e.published_at desc limit 1;

  select count(*) into v_cal from public.ranking_rows rr
   where rr.edition_id = v_ed_id and rr.scope_type = 'global' and rr.level_status = 'CALIBRADO' and rr.level_band is not null
     and not public._metrics_excluded(rr.player_id, p_include);
  if v_ed_id is null or v_cal < 10 then
    v_band := jsonb_build_object('items', '[]'::jsonb, 'suppressed', true, 'minCell', 10);
  else
    v_band := public._metrics_apply_k((
      select coalesce(jsonb_agg(jsonb_build_object('label', 'band_' || s.band, 'n', s.n)), '[]'::jsonb) from (
        select rr.level_band as band, count(*) as n from public.ranking_rows rr
         where rr.edition_id = v_ed_id and rr.scope_type = 'global' and rr.level_status = 'CALIBRADO' and rr.level_band is not null
           and not public._metrics_excluded(rr.player_id, p_include)
         group by 1) s));
  end if;

  select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object('label', s.st, 'n', s.n) order by s.st), '[]'::jsonb), 'suppressed', false, 'unit', 'universes')
    into v_density
    from (select rr.density_status as st, count(distinct rr.scope_key) as n from public.ranking_rows rr
           where rr.edition_id = v_ed_id and rr.scope_type = 'local' group by 1) s;

  return jsonb_build_object(
    'level_status', public._metrics_apply_k((
      select coalesce(jsonb_agg(jsonb_build_object('label', status, 'n', n)), '[]'::jsonb) from (
        select ls.status, count(*) as n
          from public.level_states ls join public.players pl on pl.player_id = ls.player_id
         where pl.type = 'registered' and pl.deleted_at is null and pl.is_active and not public._metrics_excluded(pl.player_id, p_include)
         group by 1) s)),
    'group_size', public._metrics_apply_k((
      select coalesce(jsonb_agg(jsonb_build_object('label', s.b, 'n', s.n)), '[]'::jsonb) from (
        select case when c.cnt <= 1 then 'size_1' when c.cnt <= 3 then 'size_2_3' when c.cnt <= 6 then 'size_4_6' else 'size_7_plus' end as b, count(*) as n
          from (select g.group_id, (select count(*) from public.group_memberships gm
                                      join public.players p on p.player_id = gm.player_id and p.deleted_at is null
                                     where gm.group_id = g.group_id and gm.left_at is null and not public._metrics_excluded(gm.player_id, p_include)) as cnt
                  from public.groups g where g.status = 'active' and not public._metrics_excluded(g.created_by_player_id, p_include)) c
         group by 1) s)),
    'level_band', v_band,
    'ranking_density', coalesce(v_density, jsonb_build_object('items', '[]'::jsonb, 'suppressed', false, 'unit', 'universes'))
  );
end;
$$;


-- Secciones: +today, +series de Comunidad, desgloses de Comunidad desde el helper
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
    'today', public._metrics_today(p_asof, p_include),
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
      when 'community' then jsonb_build_object(
          'groups_created', jsonb_build_object('granularity', v_gran,
            'current', public._metrics_series('groups_created', v_from, v_to, v_gran, p_include),
            'previous', case when v_cmp then public._metrics_series('groups_created', v_pfrom, v_pto, v_gran, p_include) end),
          'invites_created', jsonb_build_object('granularity', v_gran,
            'current', public._metrics_series('invites_created', v_from, v_to, v_gran, p_include),
            'previous', case when v_cmp then public._metrics_series('invites_created', v_pfrom, v_pto, v_gran, p_include) end))
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
      when 'community' then public._metrics_community_breakdowns(p_asof, p_include)
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


-- Inicio: +today
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
    'today', v_users -> 'today',
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
-- 4) Permisos de las funciones nuevas (las reemplazadas conservan su ACL)
-- ------------------------------------------------------------------
revoke all on function public._metrics_today(timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_community_breakdowns(timestamptz, boolean) from public, anon, authenticated;
