-- BRAMUlab — V04.20 (Pre-Production L2): WhatsApp ON-DEMAND.
--
-- Problema (Issue #10, GAP L2): `get_public_profile` devolvía `whatsapp_phone` CRUDO con solo abrir un
-- Perfil público si había consentimiento — el teléfono viajaba (y podía cachearse/inspeccionarse) sin que
-- nadie tocara "Contactar".
--
-- Contrato nuevo
--   * `get_public_profile` ya NO devuelve el teléfono: solo `whatsapp_contact_available` (boolean = hay
--     consentimiento ACTIVO y un número cargado). El resto de las columnas/filtros queda IDÉNTICO.
--   * `get_whatsapp_contact(p_player_id)` es la ÚNICA vía al teléfono: authenticated, rate limit, y entrega
--     el número solo si el consentimiento sigue activo EN ESE INSTANTE (se lee de `profiles` en cada llamada,
--     sin cache server-side). Revocar el consentimiento (allow_whatsapp_contact=false, o eliminar la cuenta,
--     que también lo pone en false) corta la entrega inmediatamente.
--   * Sin enumeración: cualquier motivo de no-disponibilidad (sin consentimiento, sin número, inactivo,
--     inexistente, provisional, contactarse a uno mismo) responde el MISMO `{ok:false, code:'unavailable'}`.
--   * Auditoría mínima: solo el contador del rate limit (api_rate_limits); no se registra el teléfono ni a
--     quién se contactó.
--
-- NO aplicada desde el sandbox del agente — la aplica y verifica Central con
-- supabase/tests/verify-preprod-v0420-whatsapp-on-demand.sql (BEGIN/ROLLBACK).

drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(p_player_id uuid)
returns table (
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  competitive_branch text,
  dominant_hand text,
  preferred_side text,
  locality_label text,
  province_label text,
  level_status text,
  level_public numeric,
  rated_matches integer,
  distinct_opponents integer,
  matches_played integer,
  matches_won integer,
  avatar_url text,
  whatsapp_contact_available boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id
  from public.players p
  where p.auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'get_public_profile', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id,
      pr.username,
      pr.display_name,
      pr.first_name,
      pr.last_name,
      pr.competitive_branch,
      pr.dominant_hand,
      pr.preferred_side,
      loc.locality_label,
      loc.province_label,
      ls.status,
      round(ls.mu, 1),
      coalesce(ls.rated_matches, 0),
      coalesce(ls.distinct_opponents, 0),
      coalesce(pubstats.matches_played, 0)::integer,
      coalesce(pubstats.matches_won, 0)::integer,
      pr.avatar_url,
      (pr.allow_whatsapp_contact and pr.phone is not null)
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.locations loc on loc.location_id = pr.location_id
    left join public.level_states ls on ls.player_id = pl.player_id
    left join lateral (
      select
        count(*) as matches_played,
        count(*) filter (where m.winner_team = mp.team) as matches_won
      from public.match_participants mp
      join public.matches m on m.match_id = mp.match_id
      where mp.player_id = pl.player_id
        and m.status = 'validated'
        and m.winner_team is not null
    ) pubstats on true
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id = p_player_id
      and pr.username is not null;
end;
$$;

comment on function public.get_public_profile is
  'Perfil público de un player_id puntual. V04.20 (L2): ya NO entrega el teléfono — solo
   whatsapp_contact_available (consentimiento activo + número cargado). El número se obtiene únicamente con
   get_whatsapp_contact. avatar_url es una RUTA de Storage del bucket privado (el cliente firma la URL).';

revoke all on function public.get_public_profile(uuid) from public;
revoke all on function public.get_public_profile(uuid) from anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

create or replace function public.get_whatsapp_contact(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_phone text;
begin
  select p.player_id into v_caller from public.players p where p.auth_user_id = auth.uid();
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- Rate limit más estricto que una lectura de perfil: es la única puerta a un dato personal.
  if not public.consume_rate_limit(v_caller, 'get_whatsapp_contact', 10, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select pr.phone into v_phone
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
   where pl.player_id = p_player_id
     and pl.type = 'registered'
     and pl.is_active
     and pl.deleted_at is null
     and pl.player_id <> v_caller
     and pr.username is not null
     and pr.allow_whatsapp_contact
     and pr.phone is not null;

  if v_phone is null then
    return jsonb_build_object('ok', false, 'code', 'unavailable');
  end if;
  return jsonb_build_object('ok', true, 'phone', v_phone);
end;
$$;

comment on function public.get_whatsapp_contact is
  'V04.20 (L2): entrega el teléfono de contacto de UN jugador solo si su consentimiento WhatsApp sigue activo en
   este instante. authenticated + rate limit 10/60s. Toda causa de no-disponibilidad responde igual
   (unavailable). Sin cache ni log del número.';

revoke all on function public.get_whatsapp_contact(uuid) from public;
revoke all on function public.get_whatsapp_contact(uuid) from anon;
grant execute on function public.get_whatsapp_contact(uuid) to authenticated;
