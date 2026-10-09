-- BRAMUlab Metrics — legal_v2 acceptance independent from capture switch.
-- One legal checkbox in signup / one legal reaccept gate for existing players.
-- When activity_consent_version IS NULL, store evidence tied to activity_v1
-- but do not capture any app opens: register_app_presence still checks NULL.
-- Future enable of activity_v1 reuses that evidence; never reconstructs past opens.
-- Do not manufacture prior acceptance: only explicit new legal_v2 actions are saved.
-- Compatible with players who previously declined: the old decision prevails.
-- Pending targeted legal review: compulsory acceptance of nonessential analytics
-- and consistency with AAIP complement stating measurement is optional.
-- Neither this migration nor the stored evidence grants legal authorization by itself.

create or replace function public.accept_legal_version(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_current text;
  v_rec jsonb;
  v_activity_version text;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  if not public.consume_rate_limit(v_player_id, 'accept_legal_version', 20, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select legal_version, activity_consent_version into v_current, v_activity_version
    from public.app_config where id = 1;
  if v_current is null then
    raise exception 'legal_version_unavailable' using errcode = 'P0001';
  end if;
  if p_version is distinct from v_current then
    raise exception 'legal_version_not_current' using errcode = 'P0001';
  end if;

  v_rec := public.record_legal_acceptance(v_player_id, v_current, 'reaccept', now());
  update public.profiles
    set terms_version = v_current,
        terms_accepted_at = (v_rec ->> 'acceptedAt')::timestamptz
    where player_id = v_player_id;

  -- No registrar actividad si el interruptor del servidor está apagado.
  -- No fabricar aceptación para legal_v1, ni repetir si legal_v2 ya había sido aceptada.
  -- No resucitar la medición si el jugador la había desactivado previamente.
  if v_current = 'legal_v2'
     and coalesce((v_rec ->> 'inserted')::boolean, false)
     and not exists (
       select 1 from public.activity_consents
        where player_id = v_player_id and consent_version = coalesce(v_activity_version, 'activity_v1')
     ) then
    perform public._record_activity_consent(v_player_id, coalesce(v_activity_version, 'activity_v1'), 'granted', 'legal_gate', now());
  end if;

  return jsonb_build_object(
    'ok', true,
    'legalVersion', v_current,
    'acceptedAt', v_rec ->> 'acceptedAt',
    'alreadyAccepted', not (v_rec ->> 'inserted')::boolean
  );
end;
$$;

comment on function public.accept_legal_version(text) is
 'Acepta versión legal vigente; en legal_v2 registra consentimiento expreso de medición integrado en una única casilla, incluso con la medición pausada, sin capturar actividad; no existe decisión previa ni aceptación retroactiva.';
revoke all on function public.accept_legal_version(text) from public, anon;
grant execute on function public.accept_legal_version(text) to authenticated;

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_legal_version text;
  v_ac_version text;
  v_ac_decision text;
  v_ac_cfg text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  insert into public.players (auth_user_id, type, display_name)
  values (new.id, 'registered', null)
  on conflict (auth_user_id) do nothing
  returning player_id into v_player_id;

  if v_player_id is null then
    select player_id into v_player_id from public.players where auth_user_id = new.id;
  end if;

  insert into public.profiles (player_id)
  values (v_player_id)
  on conflict (player_id) do nothing;

  insert into public.level_states (player_id, status)
  values (v_player_id, 'PENDIENTE')
  on conflict (player_id) do nothing;

  -- L1 — aceptación legal declarada en el signUp (metadata `legal_version`). Solo versiones CONOCIDAS del
  -- catálogo; accepted_at = momento en que el servidor creó el usuario Auth (inmediatamente posterior a la
  -- aceptación en pantalla, que bloquea signUp sin checkbox). Idempotente. Falta/versión desconocida => no se
  -- registra nada (nunca se fabrica): complete_profile y el gate de reaceptación lo resuelven.
  v_legal_version := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'legal_version'), '');
  if v_legal_version is not null
     and exists (select 1 from public.legal_versions where legal_version = v_legal_version) then
    perform public.record_legal_acceptance(v_player_id, v_legal_version, 'signup', new.created_at);
  end if;

  -- BRAMU Metrics — consentimiento ESPECÍFICO y OPCIONAL para la medición de actividad, declarado en el mismo paso del alta (metadata
  -- `activity_consent` = granted|declined y `activity_consent_version`). Solo se registra si coincide con la versión VIGENTE del servidor
  -- (si el servidor la apagó o cambió mientras tanto, no se fabrica nada: el jugador verá la pantalla de decisión). Idempotente.
  v_ac_version := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'activity_consent_version'), '');
  v_ac_decision := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'activity_consent'), '');
  select activity_consent_version into v_ac_cfg from public.app_config where id = 1;
  -- legal_v2 expone la medición básica de uso en una ÚNICA aceptación legal destacada.
  -- Solo si legal_v2 fue realmente declarada al crear la cuenta y el servidor ya habilitó la
  -- versión de medición se registra aceptación desde signup. Nunca reescribe un rechazo previo.
  -- No requiere metadata extra de un checkbox que ya no existe.
  if v_legal_version = 'legal_v2' and (select legal_version from public.app_config where id=1) = 'legal_v2' then
    if not exists (select 1 from public.activity_consents
                    where player_id = v_player_id and consent_version = coalesce(v_ac_cfg, 'activity_v1')) then
      perform public._record_activity_consent(v_player_id, coalesce(v_ac_cfg, 'activity_v1'), 'granted', 'signup', new.created_at);
    end if;
  elsif v_ac_cfg is not null and v_ac_version = v_ac_cfg and v_ac_decision in ('granted', 'declined') then
    -- Compatibilidad con altas anteriores a legal_v2. No inventa un consentimiento.
    perform public._record_activity_consent(v_player_id, v_ac_cfg, v_ac_decision, 'signup', new.created_at);
  end if;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('signup_completed', v_player_id, '{}'::jsonb);

  return new;
end;
$$;


