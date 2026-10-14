-- BRAMUlab Web / BRAMU Metrics: SOLO contadores diarios agregados. Staging antes de Production.
-- Sin IP, cookies, UUID, email, user_id ni histórico de eventos individuales.
create table if not exists public.web_analytics_daily (
  day date not null,
  event_type text not null check (event_type in ('view', 'click')),
  source text not null check (source in ('page', 'hero', 'login', 'instalacion', 'final', 'other')),
  total bigint not null default 0 check (total >= 0),
  primary key (day, event_type, source),
  constraint web_analytics_event_source_chk check (
    (event_type = 'view' and source = 'page')
    or (event_type = 'click' and source in ('hero','login','instalacion','final','other'))
  )
);
alter table public.web_analytics_daily enable row level security;
revoke all on public.web_analytics_daily from public, anon, authenticated;
grant select, insert, update on public.web_analytics_daily to service_role;

create or replace function public.web_analytics_increment(p_event_type text, p_source text)
returns boolean language plpgsql security definer set search_path = public
as $body$
declare
  v_day date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not (
    (p_event_type = 'view' and p_source = 'page')
    or (p_event_type = 'click' and p_source in ('hero','login','instalacion','final','other'))
  ) then
    raise exception 'invalid_web_event' using errcode = '22023';
  end if;
  insert into public.web_analytics_daily(day,event_type,source,total)
  values (v_day,p_event_type,p_source,1)
  on conflict (day,event_type,source)
  do update set total = public.web_analytics_daily.total + 1;
  return true;
end;
$body$;
revoke all on function public.web_analytics_increment(text,text) from public, anon, authenticated;
grant execute on function public.web_analytics_increment(text,text) to service_role;

-- Lectura solo-admin: se invoca DESPUÉS de la autorización de admin-metrics y solo con service_role.
-- El mismo entorno app_config impide mezclar Production con Staging.
create or replace function public.metrics_web(
  p_range text default '30d',
  p_compare boolean default true,
  p_include_internal boolean default false
)
returns jsonb language plpgsql security definer set search_path = public
as $body$
declare
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_start date;
  v_days integer;
  v_first date;
  v_env text;
  v_views bigint;
  v_clicks bigint;
  v_today_views bigint;
  v_today_clicks bigint;
  v_sources jsonb;
  v_daily jsonb;
begin
  if p_range not in ('7d','30d','90d','all') or p_range is null then
    raise exception 'invalid_metrics_range' using errcode='22023';
  end if;
  select environment into v_env from public.app_config limit 1;
  select min(day) into v_first from public.web_analytics_daily;
  v_days := case p_range when '7d' then 7 when '30d' then 30 when '90d' then 90 else 30 end;
  v_start := case when p_range='all' and v_first is not null then v_first else v_today - v_days end;
  -- Los períodos de Metrics terminan ayer. Hoy se expone únicamente como dato parcial.
  select coalesce(sum(total) filter (where event_type='view'),0)::bigint,
         coalesce(sum(total) filter (where event_type='click'),0)::bigint
  into v_views,v_clicks
  from public.web_analytics_daily where day>=v_start and day<v_today;

  select coalesce(sum(total) filter (where event_type='view'),0)::bigint,
         coalesce(sum(total) filter (where event_type='click'),0)::bigint
  into v_today_views,v_today_clicks
  from public.web_analytics_daily where day=v_today;

  select coalesce(jsonb_object_agg(source, sum_total),'{}'::jsonb) into v_sources
  from (
    select source,sum(total)::bigint as sum_total
    from public.web_analytics_daily
    where event_type='click' and day>=v_start and day<v_today
    group by source
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day::text,
    'views',coalesce(k.views,0),
    'clicks',coalesce(k.clicks,0)
  ) order by d.day),'[]'::jsonb) into v_daily
  from (select generate_series(v_start::timestamp,(v_today-1)::timestamp,'1 day'::interval)::date as day) d
  left join lateral (
    select coalesce(sum(total) filter (where event_type='view'),0)::bigint as views,
           coalesce(sum(total) filter (where event_type='click'),0)::bigint as clicks
    from public.web_analytics_daily w where w.day=d.day
  ) k on true;

  return jsonb_build_object(
    'ok',true,
    'meta',jsonb_build_object(
      'environment',v_env,
      'generatedAt',now(),
      'window',jsonb_build_array(
        v_start::timestamp at time zone 'America/Argentina/Buenos_Aires',
        v_today::timestamp at time zone 'America/Argentina/Buenos_Aires'
      ),
      'webSince',v_first,
      'timeZone','America/Argentina/Buenos_Aires'
    ),
    'web',jsonb_build_object(
      'instrumented',v_first is not null,
      'views',case when v_first is null then null else v_views end,
      'clicks',case when v_first is null then null else v_clicks end,
      'sources',v_sources,
      'daily',v_daily,
      'today',jsonb_build_object(
        'date',v_today,'views',case when v_first is null then null else v_today_views end,
        'clicks',case when v_first is null then null else v_today_clicks end
      )
    )
  );
end;
$body$;
revoke all on function public.metrics_web(text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.metrics_web(text,boolean,boolean) to service_role;
