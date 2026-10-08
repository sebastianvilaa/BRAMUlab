-- BRAMU Metrics V1 · F6 — Explorar (indicador + período + comparación + filtros declarados). SOLO lectura, SOLO service_role.
--
-- Ver docs/BRAMUlab/Metrics/BRAMU_Metrics.md §11 y docs/BRAMUlab/Implementacion/Post_Lanzamiento/148_… §12 y 149_… §10.
-- Migración ADITIVA: no crea tablas ni toca datos. Agrega funciones nuevas (revocadas de clientes; ejecutables solo por service_role):
--   * `metrics_explore_catalog()`  — catálogo cerrado para el selector (id, sección, tipo, si tiene serie, qué filtros admite).
--   * `metrics_explore(...)`       — UN indicador del catálogo: KPI (la MISMA definición de los paneles), serie temporal solo si es fiable,
--                                    filtros disponibles (opciones ya protegidas por k) y filtro aplicado.
-- y helpers internos `_metrics_explore_spec`, `_metrics_match_bucket`, `_metrics_explore_cells`, `_metrics_explore_visible`, `_metrics_explore_series`.
--
-- Principios (no negociables):
--   * Catálogo cerrado y consultas declaradas: el cliente envía SOLO un id del catálogo, un rango, y opcionalmente UN filtro declarado para ese
--     indicador con su valor. El valor nunca se concatena en SQL (solo se compara contra las opciones que el propio SQL calcula).
--   * Un filtro por vez (sin cruces): evita inferencia por intersecciones de celdas chicas.
--   * k = 5 EN SQL con la misma lógica que los desgloses (`_metrics_apply_k`: segmento < 5 → «Otros»; residuo chico se absorbe; si no alcanza,
--     se oculta todo). Una opción solo se ofrece —y solo devuelve valor— si es visible; pedir una oculta responde «muestra insuficiente»
--     (sin oráculo). Así NO se puede reconstruir una celda chica restando de los totales. Los filtros sobre partidos cuentan eventos, no personas.
--   * Con un filtro de personas NO se entrega serie (celdas diarias chicas): `seriesState = filter_disabled`.
--   * D8: mismas ventanas de días completos hasta ayer (`_metrics_window`); lo de hoy viaja aparte en `today`.
--   * Sin serie fiable no hay línea: `seriesState = unavailable`. La presencia anterior a su inicio es NULL (no 0).
--
-- NO aplicada desde el sandbox del agente — la aplica Central en Staging (después de F1/F2/F4). La Edge Function `admin-metrics` debe
-- REDESPLEGARSE para exponer el modo `metric`/`catalog` (el núcleo `_shared/admin-metrics-core.mjs` cambió).

-- ------------------------------------------------------------------
-- 1) Especificación declarada (qué indicadores tienen serie y qué filtros admiten)
-- ------------------------------------------------------------------
create or replace function public._metrics_explore_spec()
returns jsonb
language sql
immutable
set search_path = public
as $json$
select $spec${
 "filters": {
  "location":     {"label": "Localidad",        "unit": "personas",  "note": "Localidad declarada hoy en el perfil. «(sin localidad)» no equivale a otra localidad; las cuentas luego eliminadas figuran aparte."},
  "level_status": {"label": "Estado de Nivel",  "unit": "personas",  "note": "Estado de Nivel ACTUAL de la cuenta (no el que tenía en la fecha del alta)."},
  "platform":     {"label": "Plataforma",       "unit": "personas",  "note": "Plataforma de la última apertura de cada jugador dentro del período (cada jugador cuenta una sola vez)."},
  "match_status": {"label": "Estado del partido","unit": "partidos", "note": "Estado ACTUAL del partido al corte (vencido es derivado). Cuenta partidos, no personas."}
 },
 "metrics": {
  "users.registered_now":   {"filters": ["location", "level_status"]},
  "users.signups":          {"series": {"source": "signups", "label": "Altas"}, "filters": ["location", "level_status"]},
  "users.profile_complete": {"filters": ["location", "level_status"]},
  "matches.created":        {"series": {"source": "matches_created", "label": "Partidos cargados"}, "filters": ["match_status"]},
  "matches.real":           {"series": {"source": "matches_real", "label": "Partidos reales cargados"}},
  "matches.annulled":       {"series": {"source": "matches_annulled", "label": "Partidos anulados"}},
  "matches.validated":      {"series": {"source": "matches_validated", "label": "Partidos validados"}},
  "community.groups_created":  {"series": {"source": "groups_created", "label": "Grupos creados"}},
  "community.invites_created": {"series": {"source": "invites_created", "label": "Invitaciones creadas"}},
  "community.invites_claimed": {"series": {"source": "invites_claimed", "label": "Invitaciones canjeadas"}},
  "community.ranking_editions":{"series": {"source": "ranking_editions", "label": "Ediciones de Ranking"}},
  "usage.dau": {"series": {"source": "active_players", "label": "Jugadores activos"}, "filters": ["platform"]},
  "usage.wau": {"filters": ["platform"]},
  "usage.mau": {"filters": ["platform"]}
 }
}$spec$::jsonb
$json$;

comment on function public._metrics_explore_spec is 'BRAMU Metrics F6: especificación CERRADA del Explorador (series fiables y filtros declarados por indicador).';

-- Bucket de estado de un partido (misma regla que el desglose de la sección Partidos; vencido es derivado).
create or replace function public._metrics_match_bucket(p_status text, p_reason jsonb, p_deadline timestamptz, p_asof timestamptz)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_status = 'annulled' then 'annulled_' || coalesce(p_reason ->> 'kind', 'admin')
              when p_status = 'validated' then 'validated'
              when p_status = 'expired' or (p_status = 'pending_validation' and p_deadline < p_asof) then 'expired_derived'
              else 'pending' end
$$;

-- ------------------------------------------------------------------
-- 2) Celdas por categoría de un filtro, para la población del indicador en la ventana [p_from, p_to)
--    → [{label, n}] SIN protección (la protección es `_metrics_explore_visible`).
-- ------------------------------------------------------------------
create or replace function public._metrics_explore_cells(p_metric text, p_filter text, p_from timestamptz, p_to timestamptz, p_asof timestamptz, p_include boolean)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_e date := ((least(p_asof, p_to) - interval '1 microsecond') at time zone 'America/Argentina/Buenos_Aires')::date;
  v_span integer;
  v_out jsonb;
begin
  if p_filter in ('location', 'level_status') and p_metric in ('users.registered_now', 'users.signups', 'users.profile_complete') then
    select coalesce(jsonb_agg(jsonb_build_object('label', s.cat, 'n', s.n)), '[]'::jsonb) into v_out from (
      select case when pl.deleted_at is not null then '(cuenta eliminada)'
                  when p_filter = 'location' then case when l.location_id is null then '(sin localidad)' else l.locality_label || ', ' || l.province_label end
                  else coalesce(ls.status, 'PENDIENTE') end as cat,
             count(*) as n
        from public.players pl
        left join public.profiles pr on pr.player_id = pl.player_id
        left join public.locations l on l.location_id = pr.location_id
        left join public.level_states ls on ls.player_id = pl.player_id
       where pl.type = 'registered' and not public._metrics_excluded(pl.player_id, p_include)
         and case p_metric
               when 'users.registered_now' then pl.is_active and pl.deleted_at is null
               when 'users.profile_complete' then pl.is_active and pl.deleted_at is null and pr.username is not null
               else pl.created_at >= p_from and pl.created_at < p_to end
       group by 1) s;
    return v_out;
  elsif p_filter = 'platform' and p_metric in ('usage.dau', 'usage.wau', 'usage.mau') then
    v_span := case p_metric when 'usage.dau' then 1 when 'usage.wau' then 7 else 30 end;
    select coalesce(jsonb_agg(jsonb_build_object('label', s.platform, 'n', s.n)), '[]'::jsonb) into v_out from (
      select x.platform, count(*) as n from (
        select distinct on (a.player_id) a.platform
          from public.player_activity_days a
         where a.activity_date > v_e - v_span and a.activity_date <= v_e and not public._metrics_excluded(a.player_id, p_include)
         order by a.player_id, a.activity_date desc) x
       group by 1) s;
    return v_out;
  elsif p_filter = 'match_status' and p_metric = 'matches.created' then
    select coalesce(jsonb_agg(jsonb_build_object('label', s.b, 'n', s.n)), '[]'::jsonb) into v_out from (
      select public._metrics_match_bucket(m.status, m.annulment_reason, m.validation_deadline_at, p_asof) as b, count(*) as n
        from public.matches m
       where m.created_at >= p_from and m.created_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include)
       group by 1) s;
    return v_out;
  end if;
  return '[]'::jsonb;
end;
$$;

-- Celdas VISIBLES: personas → misma regla k que los desgloses (sin «Otros»); partidos → todas (son eventos).
-- Devuelve {items:[{label,n}], suppressed}. `items` solo contiene lo que puede mostrarse y filtrarse.
create or replace function public._metrics_explore_visible(p_filter text, p_cells jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_k jsonb;
begin
  if p_filter = 'match_status' then
    return jsonb_build_object('items', coalesce(p_cells, '[]'::jsonb), 'suppressed', false);
  end if;
  v_k := public._metrics_apply_k(p_cells);
  return jsonb_build_object(
    'items', (select coalesce(jsonb_agg(i order by (i ->> 'n')::int desc, i ->> 'label'), '[]'::jsonb)
                from jsonb_array_elements(v_k -> 'items') i where (i ->> 'label') not like 'Otros (n<%'),
    'suppressed', coalesce((v_k ->> 'suppressed')::boolean, false));
end;
$$;

-- ------------------------------------------------------------------
-- 3) Series del Explorador (solo fuentes con hechos persistidos; nulos antes del inicio de la presencia)
-- ------------------------------------------------------------------
create or replace function public._metrics_explore_series(p_source text, p_bucket text, p_from timestamptz, p_to timestamptz, p_gran text, p_include boolean, p_asof timestamptz)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_d0 date := (p_from at time zone 'America/Argentina/Buenos_Aires')::date;
  v_d1 date := ((p_to - interval '1 microsecond') at time zone 'America/Argentina/Buenos_Aires')::date;
  v_out jsonb;
  v_since date;
begin
  if p_source not in ('signups', 'matches_created', 'matches_real', 'matches_annulled', 'matches_validated', 'groups_created', 'invites_created',
                      'invites_claimed', 'ranking_editions', 'active_players') then
    raise exception 'invalid_series_source' using errcode = 'P0001';
  end if;
  if v_d1 < v_d0 then return '[]'::jsonb; end if;

  if p_source in ('matches_real', 'matches_annulled', 'invites_claimed', 'ranking_editions') or (p_source = 'matches_created' and p_bucket is not null) then
    with b as (
      select g::date as start
        from generate_series(case when p_gran = 'week_ba' then date_trunc('week', v_d0::timestamp)::date else v_d0 end, v_d1,
                             case when p_gran = 'week_ba' then interval '1 week' else interval '1 day' end) g
    ), ev as (
      select (m.created_at at time zone 'America/Argentina/Buenos_Aires')::date as d, m.match_id as pid
        from public.matches m
       where m.created_at >= p_from and m.created_at < p_to and not public._metrics_excluded(m.created_by_player_id, p_include)
         and ((p_source = 'matches_real' and m.status <> 'annulled')
              or (p_source = 'matches_annulled' and m.status = 'annulled')
              or (p_source = 'matches_created' and public._metrics_match_bucket(m.status, m.annulment_reason, m.validation_deadline_at, p_asof) = p_bucket))
      union all
      select (c.claimed_at at time zone 'America/Argentina/Buenos_Aires')::date, c.claim_id
        from public.provisional_claims c
       where p_source = 'invites_claimed' and c.status = 'claimed' and c.claimed_at >= p_from and c.claimed_at < p_to
         and not public._metrics_excluded(c.created_by_player_id, p_include)
      union all
      select (e.published_at at time zone 'America/Argentina/Buenos_Aires')::date, e.edition_id
        from public.ranking_editions e
       where p_source = 'ranking_editions' and e.published_at >= p_from and e.published_at < p_to
    ), c as (
      select case when p_gran = 'week_ba' then date_trunc('week', ev.d::timestamp)::date else ev.d end as start, count(distinct ev.pid) as n
        from ev group by 1
    )
    select coalesce(jsonb_agg(jsonb_build_object('start', b.start, 'value', coalesce(c.n, 0)) order by b.start), '[]'::jsonb)
      into v_out from b left join c using (start);
    return v_out;
  end if;

  v_out := public._metrics_series(p_source, p_from, p_to, p_gran, p_include);
  if p_source = 'active_players' then
    -- Antes de que existiera la presencia NO hay dato (no es 0): value = null
    select (min(a.first_seen_at) at time zone 'America/Argentina/Buenos_Aires')::date into v_since from public.player_activity_days a;
    select coalesce(jsonb_agg(
             case when v_since is null or ((e ->> 'start')::date + case when p_gran = 'week_ba' then 7 else 1 end) <= v_since
                  then jsonb_build_object('start', e -> 'start', 'value', null)
                  else e end order by ord), '[]'::jsonb)
      into v_out from jsonb_array_elements(v_out) with ordinality t(e, ord);
  end if;
  return v_out;
end;
$$;

-- ------------------------------------------------------------------
-- 4) Catálogo para el selector
-- ------------------------------------------------------------------
create or replace function public.metrics_explore_catalog()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true, 'catalogVersion', 'metrics_v1', 'minCell', public.metrics_min_cell(),
    'filterDefs', public._metrics_explore_spec() -> 'filters',
    'catalog', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e ->> 'id', 'section', e ->> 'section', 'label', e ->> 'label', 'kind', e ->> 'kind',
               'snapshot', coalesce((e ->> 'snapshot')::boolean, false),
               'hasSeries', (public._metrics_explore_spec() -> 'metrics' -> (e ->> 'id') -> 'series') is not null,
               'filters', coalesce(public._metrics_explore_spec() -> 'metrics' -> (e ->> 'id') -> 'filters', '[]'::jsonb)) order by o), '[]'::jsonb)
        from jsonb_array_elements(public._metrics_catalog()) with ordinality t(e, o)));
$$;

-- ------------------------------------------------------------------
-- 5) Explorar un indicador
-- ------------------------------------------------------------------
create or replace function public.metrics_explore(
  p_metric text, p_range text default '30d', p_compare boolean default true, p_include_internal boolean default false,
  p_filter text default null, p_value text default null, p_asof timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_entry jsonb; v_mspec jsonb; v_fdefs jsonb := public._metrics_explore_spec() -> 'filters';
  v_section text; v_w jsonb; v_cmp boolean; v_run jsonb; v_kpi jsonb;
  v_from timestamptz; v_to timestamptz; v_pfrom timestamptz; v_pto timestamptz; v_gran text;
  v_fid text; v_vis jsonb; v_cur jsonb; v_prev jsonb; v_n_cur integer; v_n_prev integer;
  v_cells jsonb; v_prev_cells jsonb; v_options jsonb := '[]'::jsonb; v_applied jsonb := null;
  v_series jsonb := null; v_state text; v_src text; v_bucket text; v_final jsonb; v_pkpi jsonb;
  v_valid_values jsonb;
begin
  select e into v_entry from jsonb_array_elements(public._metrics_catalog()) e where e ->> 'id' = p_metric;
  if v_entry is null then return jsonb_build_object('ok', false, 'code', 'invalid_metric'); end if;
  v_mspec := coalesce(public._metrics_explore_spec() -> 'metrics' -> p_metric, '{}'::jsonb);
  v_section := v_entry ->> 'section';

  if p_filter is not null then
    if not exists (select 1 from jsonb_array_elements_text(coalesce(v_mspec -> 'filters', '[]'::jsonb)) f where f = p_filter) then
      return jsonb_build_object('ok', false, 'code', 'invalid_filter');
    end if;
    if p_value is null or char_length(p_value) < 1 or char_length(p_value) > 120 then
      return jsonb_build_object('ok', false, 'code', 'invalid_filter_value');
    end if;
  elsif p_value is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_filter');
  end if;

  v_w := public._metrics_window(p_range, p_asof);
  v_from := (v_w ->> 'from')::timestamptz; v_to := (v_w ->> 'to')::timestamptz;
  v_pfrom := (v_w ->> 'prevFrom')::timestamptz; v_pto := (v_w ->> 'prevTo')::timestamptz;
  v_gran := v_w ->> 'granularity';
  v_cmp := coalesce(p_compare, true) and (v_w ->> 'prevFrom') is not null;

  v_run := public._metrics_run(v_section, p_range, p_compare, p_include_internal, p_asof);
  select k into v_kpi from jsonb_array_elements(v_run -> 'kpis') k where k ->> 'id' = p_metric;
  v_final := v_kpi;

  -- Filtros disponibles (opciones ya protegidas por k) para la población del indicador en la ventana actual
  for v_fid in select f from jsonb_array_elements_text(coalesce(v_mspec -> 'filters', '[]'::jsonb)) f loop
    v_cells := public._metrics_explore_cells(p_metric, v_fid, v_from, v_to, p_asof, p_include_internal);
    v_vis := public._metrics_explore_visible(v_fid, v_cells);
    v_options := v_options || jsonb_build_array(jsonb_build_object(
      'id', v_fid, 'label', v_fdefs -> v_fid ->> 'label', 'unit', v_fdefs -> v_fid ->> 'unit', 'note', v_fdefs -> v_fid ->> 'note',
      'suppressed', (v_vis ->> 'suppressed')::boolean,
      'options', (select coalesce(jsonb_agg(jsonb_build_object('value', i ->> 'label', 'n', (i ->> 'n')::int)), '[]'::jsonb) from jsonb_array_elements(v_vis -> 'items') i)));
  end loop;

  -- Filtro aplicado: mismo armado de KPI que los paneles, con la celda visible del filtro
  if p_filter is not null then
    v_cells := public._metrics_explore_cells(p_metric, p_filter, v_from, v_to, p_asof, p_include_internal);
    if p_filter = 'match_status' then
      select coalesce(jsonb_agg(x), '[]'::jsonb) into v_valid_values from (
        select to_jsonb(b) as x from unnest(array['validated', 'pending', 'expired_derived', 'annulled_duplicate', 'annulled_author_retracted', 'annulled_admin']) b
        union select to_jsonb(c ->> 'label') from jsonb_array_elements(v_cells) c) u;
      if not (v_valid_values @> to_jsonb(p_value)) then return jsonb_build_object('ok', false, 'code', 'invalid_filter_value'); end if;
    end if;
    v_vis := public._metrics_explore_visible(p_filter, v_cells);
    select (i ->> 'n')::int into v_n_cur from jsonb_array_elements(v_vis -> 'items') i where i ->> 'label' = p_value;
    if v_cmp and v_entry ->> 'kind' <> 'stock' then
      v_prev_cells := public._metrics_explore_cells(p_metric, p_filter, v_pfrom, v_pto, p_asof, p_include_internal);
      select (i ->> 'n')::int into v_n_prev from jsonb_array_elements(public._metrics_explore_visible(p_filter, v_prev_cells) -> 'items') i where i ->> 'label' = p_value;
    end if;

    if p_filter = 'match_status' then
      v_cur := public._metrics_raw(coalesce(v_n_cur, 0));
      v_prev := case when v_cmp then public._metrics_raw(coalesce(v_n_prev, 0)) end;
    else
      v_pkpi := v_kpi -> 'previous';
      v_cur := case when v_kpi ->> 'availability' = 'not_instrumented' then public._metrics_raw(null, null, null, 'not_instrumented', (v_kpi ->> 'since')::date)
                    when v_n_cur is null then public._metrics_raw(null, null, null, 'insufficient_sample', (v_kpi ->> 'since')::date)
                    else public._metrics_raw(v_n_cur, v_n_cur, null, null, (v_kpi ->> 'since')::date) end;
      v_prev := case when not v_cmp then null
                     when v_pkpi is not null and v_pkpi ->> 'availability' = 'not_instrumented' then public._metrics_raw(null, null, null, 'not_instrumented')
                     when v_n_prev is null then public._metrics_raw(null, null, null, 'insufficient_sample')
                     else public._metrics_raw(v_n_prev, v_n_prev) end;
    end if;
    v_final := public._metrics_kpi(case when p_filter = 'match_status' then v_entry else v_entry || '{"minN":5}'::jsonb end,
                                   jsonb_build_object(p_metric, v_cur), jsonb_build_object(p_metric, v_prev), v_cmp);
    v_applied := jsonb_build_object('id', p_filter, 'value', p_value);
  end if;

  -- Serie: solo si hay hechos históricos fiables; con filtro de personas no se grafica (celdas diarias chicas)
  v_src := v_mspec -> 'series' ->> 'source';
  if v_src is null then v_state := 'unavailable';
  elsif p_filter is not null and p_filter <> 'match_status' then v_state := 'filter_disabled';
  else
    v_state := 'available';
    v_bucket := case when p_filter = 'match_status' then p_value end;
    v_series := jsonb_build_object('source', v_src, 'label', v_mspec -> 'series' ->> 'label', 'granularity', v_gran,
      'current', public._metrics_explore_series(v_src, v_bucket, v_from, v_to, v_gran, p_include_internal, p_asof),
      'previous', case when v_cmp then public._metrics_explore_series(v_src, v_bucket, v_pfrom, v_pto, v_gran, p_include_internal, p_asof) end);
  end if;

  return jsonb_build_object(
    'ok', true, 'section', 'explore', 'metric', p_metric,
    'meta', v_run -> 'meta', 'today', v_run -> 'today',
    'kpi', v_final, 'series', v_series, 'seriesState', v_state,
    'filters', jsonb_build_object('available', v_options, 'applied', v_applied));
end;
$$;

-- ------------------------------------------------------------------
-- 6) Permisos: SOLO service_role
-- ------------------------------------------------------------------
revoke all on function public._metrics_explore_spec() from public, anon, authenticated;
revoke all on function public._metrics_match_bucket(text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._metrics_explore_cells(text, text, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public._metrics_explore_visible(text, jsonb) from public, anon, authenticated;
revoke all on function public._metrics_explore_series(text, text, timestamptz, timestamptz, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.metrics_explore_catalog() from public, anon, authenticated;
revoke all on function public.metrics_explore(text, text, boolean, boolean, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.metrics_explore_catalog() to service_role;
grant execute on function public.metrics_explore(text, text, boolean, boolean, text, text, timestamptz) to service_role;
