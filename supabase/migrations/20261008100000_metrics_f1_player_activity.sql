-- BRAMU Metrics V1 · F1 — Presencia diaria (único registro nuevo de uso real).
--
-- Ver docs/BRAMUlab/Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md §4.2 y
-- docs/BRAMUlab/BRAMU_Metrics_Auditoria_Tecnica_V1.md §5.
--
--   1) `player_activity_days` — UNA fila por jugador registrado y día BA. Sin IP, sin user-agent, sin pantalla,
--      sin geolocalización. Solo: cuándo (servidor), cuántas aperturas, modo de visualización, plataforma gruesa
--      y bundle público. Deny-by-default: RLS activo, cero políticas, ningún grant a anon/authenticated.
--   2) `register_app_presence` — ÚNICA vía de escritura. El jugador sale SIEMPRE de auth.uid() y el día lo fija el
--      servidor (America/Argentina/Buenos_Aires): el cliente no manda jugador, fecha ni hora, así que no puede
--      escribir filas ajenas ni retroactivas. Idempotente por (jugador, día); re-escribe como máximo cada 5 min.
--   3) `admin_export_player_data` — el informe de acceso/copia incluye ahora `activityDays` (derecho de acceso).
--
-- Tratamiento al eliminar cuenta (decisión por defecto D3 del plan): `players` se ANONIMIZA, no se borra; las filas
-- de presencia se conservan pseudonimizadas (mismo criterio que pilot_events) y las métricas de poblaciones
-- «actuales» excluyen `deleted_at`. La FK es ON DELETE CASCADE solo como red de seguridad si algún día se borrara
-- físicamente un player (nunca debe bloquear ese borrado).
--
-- NO aplicada desde el sandbox del agente — la aplica Central en Staging. Verify:
-- supabase/functions/_shared/metrics-f1-activity.test.mjs (PGlite) + checklist del handoff de resultado.

-- ------------------------------------------------------------------
-- 1) Tabla
-- ------------------------------------------------------------------

create table if not exists public.player_activity_days (
  player_id     uuid not null references public.players (player_id) on delete cascade,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  opens         smallint not null default 1 check (opens between 1 and 999),
  display_mode  text not null check (display_mode in ('standalone', 'browser')),
  platform      text not null check (platform in ('ios', 'android', 'desktop', 'other')),
  app_bundle    text check (app_bundle is null or app_bundle ~ '^[0-9]{2}\.[0-9]{2}-h[0-9]{1,3}$'),
  primary key (player_id, activity_date)
);

comment on table public.player_activity_days is
  'BRAMU Metrics F1: presencia diaria (1 fila por jugador y día BA). Solo la escribe register_app_presence(); solo la lee service_role. Sin IP/UA/pantalla/geolocalización.';

-- Para DAU/WAU/MAU (agrupa por día): la PK cubre las búsquedas por jugador; este índice cubre las por fecha.
create index if not exists player_activity_days_date_idx on public.player_activity_days (activity_date);

alter table public.player_activity_days enable row level security;
-- Deny-by-default deliberado: cero políticas.
revoke all on table public.player_activity_days from public, anon, authenticated;
grant select on table public.player_activity_days to service_role;

-- ------------------------------------------------------------------
-- 2) register_app_presence — única vía de escritura
-- ------------------------------------------------------------------

create or replace function public.register_app_presence(
  p_display_mode text,
  p_platform text,
  p_app_bundle text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_player_id uuid;
  v_day date;
  v_rows integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'not_authenticated');
  end if;

  -- Validación estricta: ante cualquier valor fuera de contrato NO se escribe nada.
  if p_display_mode is null or p_display_mode not in ('standalone', 'browser') then
    return jsonb_build_object('ok', false, 'code', 'invalid_display_mode');
  end if;
  if p_platform is null or p_platform not in ('ios', 'android', 'desktop', 'other') then
    return jsonb_build_object('ok', false, 'code', 'invalid_platform');
  end if;
  if p_app_bundle is not null and p_app_bundle !~ '^[0-9]{2}\.[0-9]{2}-h[0-9]{1,3}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_app_bundle');
  end if;

  -- El jugador SIEMPRE sale de la sesión. Solo cuentas registradas y no eliminadas.
  select player_id into v_player_id
    from public.players
   where auth_user_id = v_uid and type = 'registered' and deleted_at is null;
  if v_player_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_player_for_session');
  end if;

  v_day := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

  insert into public.player_activity_days as d (player_id, activity_date, display_mode, platform, app_bundle)
  values (v_player_id, v_day, p_display_mode, p_platform, p_app_bundle)
  on conflict (player_id, activity_date) do update
     set last_seen_at = now(),
         opens = least(d.opens + 1, 999),
         -- «usó la app instalada ese día» si ALGUNA apertura fue standalone.
         display_mode = case when d.display_mode = 'standalone' or excluded.display_mode = 'standalone' then 'standalone' else 'browser' end,
         platform = excluded.platform,
         app_bundle = coalesce(excluded.app_bundle, d.app_bundle)
   -- Anti-amplificación de escritura: ráfagas dentro de 5 min no tocan la fila.
   where d.last_seen_at < now() - interval '5 minutes';
  get diagnostics v_rows = row_count;

  return jsonb_build_object('ok', true, 'recorded', v_rows > 0);
end;
$$;

comment on function public.register_app_presence is
  'BRAMU Metrics F1: registra presencia del día BA del jugador de la sesión (auth.uid()). Idempotente; no recibe jugador ni fecha.';

revoke all on function public.register_app_presence(text, text, text) from public, anon;
grant execute on function public.register_app_presence(text, text, text) to authenticated;

-- ------------------------------------------------------------------
-- 3) Informe de acceso/copia: incluir activityDays (envoltorio vigente de 9B + clave nueva)
-- ------------------------------------------------------------------

create or replace function public.admin_export_player_data(p_player_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  v := public._admin_export_player_data_raw(p_player_id);
  if v is null or coalesce((v ->> 'ok')::boolean, false) is not true then
    return v;
  end if;
  -- Presencia propia: sin player_id (es el del titular). Nada de terceros.
  v := v || jsonb_build_object('activityDays', coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', a.activity_date, 'firstSeenAt', a.first_seen_at, 'lastSeenAt', a.last_seen_at,
             'opens', a.opens, 'displayMode', a.display_mode, 'platform', a.platform, 'appBundle', a.app_bundle
           ) order by a.activity_date)
      from public.player_activity_days a where a.player_id = p_player_id
  ), '[]'::jsonb));
  return public._export_redact_third_parties(v, p_player_id);
end;
$$;

comment on function public.admin_export_player_data is
  'Bloque 9B: informe de acceso/copia (solo lectura, solo service_role). Envoltorio que redacta recursivamente ids de terceros
   sobre el generador interno _admin_export_player_data_raw. Metrics F1: agrega activityDays (presencia propia). Sin secretos,
   sin internals de Intelligence, sin PII de terceros.';

revoke all on function public.admin_export_player_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_export_player_data(uuid) to service_role;
