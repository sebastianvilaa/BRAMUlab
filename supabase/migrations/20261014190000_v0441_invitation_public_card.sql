-- BRAMUlab V04.41 — Tarjeta de invitación con el partido REAL (vista previa de WhatsApp).
--
-- Decisión de producto (Sebastián, 14/10/2026): quien posea un enlace personal de invitación VÁLIDO puede ver, sin iniciar sesión, un resumen
-- MÍNIMO del partido que originó esa invitación (nombres de los cuatro participantes + games por set), porque la invitación se comparte
-- deliberadamente con esa persona y los bots de vista previa (WhatsApp, iMessage) piden la imagen sin sesión.
--
-- Contrato (único objeto nuevo, ejecutable por `anon`; NO toca tablas ni permisos de tablas):
--   get_invitation_card(p_token text) -> jsonb
--     ok:true  → { ok, teams:[ {names:[text,text], sets:[int…]}, {names:[…], sets:[…]} ] }   (la pareja de la identidad invitada primero)
--     ok:false → { ok:false }   IDÉNTICO para token mal formado, desconocido, revocado, ya usado, vencido o sin partido vigente:
--                               no revela por qué (sin oráculo de estado).
--   NO devuelve: ids (partido/jugador/claim), @usuario, avatares, fecha/hora, lugar, formato, estado de validación, quién invitó, ni el token/hash.
--   Solo con claim `pending` y no vencido, identidad provisional todavía vigente y partido NO anulado. Tras SOY YO / rotación / vencimiento
--   (30 días) deja de responder: el enlace consumido ya no muestra datos.
--   El token son 256 bits (64 hex): sin límite de frecuencia por jugador (un `anon` no tiene player_id) porque adivinarlo es inviable.
-- Fallback de partido: el de origen del claim (V04.33); si el link es anterior o el origen ya no aplica, el más reciente de la identidad
-- (mismo criterio que preview_claim_link).

create or replace function public.get_invitation_card(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_claim public.provisional_claims;
  v_prov public.players;
  v_match uuid := null;
  v_revnum integer;
  v_first text;
  v_other text;
  v_teams jsonb;
begin
  if v_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_claim from public.provisional_claims
    where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex');
  if v_claim is null or v_claim.status <> 'pending' or v_claim.expires_at <= now() then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_prov from public.players where player_id = v_claim.provisional_player_id;
  if v_prov is null or v_prov.type <> 'provisional' or not v_prov.is_active or v_prov.recovered_into_player_id is not null then
    return jsonb_build_object('ok', false);
  end if;

  if v_claim.source_match_id is not null then
    select m.match_id into v_match
      from public.matches m
     where m.match_id = v_claim.source_match_id
       and m.status <> 'annulled'
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id);
  end if;
  if v_match is null then
    select m.match_id into v_match
      from public.matches m
     where m.status <> 'annulled'
       and exists (select 1 from public.match_participants mp where mp.match_id = m.match_id and mp.player_id = v_prov.player_id)
     order by m.played_at desc, m.match_id
     limit 1;
  end if;
  if v_match is null then
    return jsonb_build_object('ok', false);
  end if;

  select mr.revision_number into v_revnum
    from public.matches m join public.match_revisions mr on mr.revision_id = m.current_revision_id
   where m.match_id = v_match;
  select mp.team into v_first from public.match_participants mp where mp.match_id = v_match and mp.player_id = v_prov.player_id;
  if v_revnum is null or v_first is null then
    return jsonb_build_object('ok', false);
  end if;
  v_other := case when v_first = 'A' then 'B' else 'A' end;

  select jsonb_agg(jsonb_build_object(
           'names', (select coalesce(jsonb_agg(public._match_participant_display_name(mp.player_id, mp.display_name_snapshot) order by mp.position_in_team), '[]'::jsonb)
                       from public.match_participants mp where mp.match_id = v_match and mp.team = t.team),
           'sets', (select coalesce(jsonb_agg(case when t.team = 'A' then ms.games_a else ms.games_b end order by ms.set_number), '[]'::jsonb)
                      from public.match_sets ms where ms.match_id = v_match and ms.revision_number = v_revnum)
         ) order by t.ord)
    into v_teams
    from (values (v_first, 1), (v_other, 2)) as t(team, ord);

  return jsonb_build_object('ok', true, 'teams', v_teams);
end;
$$;

comment on function public.get_invitation_card(text) is
  'V04.41: resumen MÍNIMO (nombres + games por set) del partido de origen de un enlace de invitación válido, sin sesión (vista previa de WhatsApp). Mismo {ok:false} para cualquier fallo. Ejecutable por anon A PROPÓSITO (decisión de producto 14/10/2026).';

revoke all on function public.get_invitation_card(text) from public, anon, authenticated;
grant execute on function public.get_invitation_card(text) to anon;
