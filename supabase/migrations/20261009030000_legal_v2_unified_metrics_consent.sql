-- BRAMUlab 09/10/2026 — legal_v2: UNA aceptación visible en alta y UNA reaceptación legal para cuentas existentes.
-- EN STAGING / PREPARACIÓN: No cambia app_config.legal_version ni activity_consent_version por sí misma.
-- NO aplica a cuentas preexistentes hasta que el usuario acepte legal_v2, sin consentimiento retroactivo.
-- IMPORTANTE: El sustento jurídico de una aceptación obligatoria para la analítica vinculada a la cuenta requiere
-- revisión de consentimiento libre/expreso/informado y el expediente AAIP (ampliación presentada como opcional)
-- ANTES DE PROMOVER A PRODUCTION. No es una autorización jurídica por escribir este SQL.

insert into public.legal_versions (legal_version, effective_at)
values ('legal_v2', null)
on conflict (legal_version) do nothing;

-- Preservar la evidencia precisa de origen para la aceptación legal, sin convertirla en 'prompt' opt-in.
alter table public.activity_consents drop constraint if exists activity_consents_source_check;
alter table public.activity_consents add constraint activity_consents_source_check
check (source in ('signup','prompt','settings','legal_gate'));

-- Conserva idempotencia y controles de la función vigente, agrega la aceptación específica
-- de actividad SÓLO cuando el jugador acepta materialmente legal_v2 en la UI unificada.
-- La revocación anterior de actividad prevalece y no se sobreescribe por accidente.
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
  if v_current = 'legal_v2' and v_activity_version is not null
     and coalesce((v_rec ->> 'inserted')::boolean, false)
     and not exists (
       select 1 from public.activity_consents
        where player_id = v_player_id and consent_version = v_activity_version
     ) then
    perform public._record_activity_consent(v_player_id, v_activity_version, 'granted', 'legal_gate', now());
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
 'Acepta versión legal vigente; en legal_v2 registra consentimiento expreso de medición integrado en una única casilla, solo si el servidor habilitó la versión de medición y no existía una decisión previa; nunca retroactivo.';
revoke all on function public.accept_legal_version(text) from public, anon;
grant execute on function public.accept_legal_version(text) to authenticated;
