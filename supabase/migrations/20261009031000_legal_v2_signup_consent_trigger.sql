-- BRAMUlab legal_v2: en alta nueva, una sola casilla legal expresa y destacada
-- gobierna legal_acceptances y activity_consents. No modifica por sí misma la configuración.
-- Importante: pendiente validar suficiencia del consentimiento libre antes de Production.
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
  if v_ac_cfg is not null and v_legal_version = 'legal_v2' then
    if not exists (select 1 from public.activity_consents
                    where player_id = v_player_id and consent_version = v_ac_cfg) then
      perform public._record_activity_consent(v_player_id, v_ac_cfg, 'granted', 'signup', new.created_at);
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

