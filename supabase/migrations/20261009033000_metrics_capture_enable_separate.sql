-- BRAMU Metrics: independent acceptance evidence and capture enablement.
-- Legal_v2 signup/reaccept can record activity_v1 decision while capture is OFF.
-- The user may withdraw that decision in Settings, since version remains active.
-- Capture remains server-side OFF until separately authorized/legal-reviewed.
-- No retroactive opens, no automatic switch-on, fail-closed default FALSE.
alter table public.app_config
  add column if not exists activity_capture_enabled boolean not null default false;
comment on column public.app_config.activity_capture_enabled is
  'Enable writing identifiable daily app-presence data; FALSE means no capture, regardless of stored informed decisions. Different from activity_consent_version.';

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
  v_cfg text;
  v_capture boolean;
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

  -- Consentimiento (decisión de Sebastián): NO se registra ninguna apertura si la medición está desactivada en este entorno o si el jugador
  -- no aceptó la versión vigente (nunca antes de aceptar; nunca hacia atrás). La exigencia es SERVER-SIDE: el cliente no decide.
  select activity_consent_version, activity_capture_enabled
    into v_cfg, v_capture from public.app_config where id = 1;
  if v_cfg is null or not coalesce(v_capture, false) then
    return jsonb_build_object('ok', false, 'code', 'measurement_disabled');
  end if;
  if public._activity_consent_status(v_player_id) <> 'granted' then
    return jsonb_build_object('ok', false, 'code', 'no_consent');
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


revoke all on function public.register_app_presence(text,text,text) from public, anon;
grant execute on function public.register_app_presence(text,text,text) to authenticated;
