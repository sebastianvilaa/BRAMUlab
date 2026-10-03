-- BRAMUlab — V04.29 · Eliminación de cuenta y provisionales recuperadas.
--
-- admin_delete_player_account (definición vigente: 20260930120000_preprod_grupos_b2c_group_photo.sql) se reaplica IDÉNTICA salvo
-- una sentencia nueva: anonimiza el display_name de las provisionales que esa cuenta había recuperado (players.recovered_into_player_id),
-- que de otro modo conservarían el nombre original de una persona que pidió borrar su cuenta. Nada más cambia: sin DELETE de players,
-- sin tocar player_identity_recoveries/legal_acceptances/ranking_rows.

create or replace function public.admin_delete_player_account(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
  v_captured_auth_user_id uuid;
begin
  select * into v_player from public.players where player_id = p_player_id for update;

  if v_player is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  if v_player.deleted_at is not null then
    select (properties->>'authUserId')::uuid into v_captured_auth_user_id
      from public.pilot_events
      where event_name = 'account_deleted' and player_id = p_player_id
      order by created_at desc
      limit 1;
    return jsonb_build_object(
      'ok', true, 'playerId', p_player_id, 'alreadyDeleted', true, 'authUserId', v_captured_auth_user_id
    );
  end if;

  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;

  v_captured_auth_user_id := v_player.auth_user_id;

  -- ---- B2c/P0.3: salir de TODOS los grupos (Issue #4), en esta misma transacción. ----
  perform public._groups_account_deletion_cleanup(p_player_id);

  update public.players set
    display_name = 'Jugador eliminado',
    is_active = false,
    deleted_at = now(),
    auth_user_id = null,
    updated_at = now()
  where player_id = p_player_id;

  update public.profiles set
    username = null,
    first_name = null,
    last_name = null,
    display_name = null,
    avatar_url = null,
    birth_date = null,
    gender = null,
    dominant_hand = null,
    preferred_side = null,
    competitive_branch = null,
    location_id = null,
    location_effective_from = null,
    phone = null,
    allow_whatsapp_contact = false,
    current_category = null,
    current_category_at = null,
    ranking_opt_in = false,
    updated_at = now()
  where player_id = p_player_id;

  update public.match_participants
    set display_name_snapshot = 'Jugador eliminado'
    where player_id = p_player_id;

  -- V04.29: las identidades provisionales que esta cuenta había recuperado (tombstones) conservan el nombre con el
  -- que alguien las cargó: se anonimizan igual que la cuenta. La estructura deportiva (match_participants.player_id ya
  -- apunta a la cuenta) y la auditoría de player_identity_recoveries se preservan sin PII adicional.
  update public.players
    set display_name = 'Jugador eliminado', updated_at = now()
    where recovered_into_player_id = p_player_id;

  delete from public.intelligence_match_outputs
    where match_id in (select match_id from public.match_participants where player_id = p_player_id);

  delete from public.match_user_state where player_id = p_player_id;
  delete from public.notifications where player_id = p_player_id;

  delete from public.player_saved_players
    where owner_player_id = p_player_id or saved_player_id = p_player_id;
  delete from public.ranking_network_hidden
    where player_id = p_player_id or hidden_player_id = p_player_id;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('account_deleted', p_player_id, jsonb_build_object('authUserId', v_captured_auth_user_id));

  return jsonb_build_object(
    'ok', true, 'playerId', p_player_id, 'alreadyDeleted', false,
    'authUserId', v_captured_auth_user_id
  );
end;
$$;

revoke all on function public.admin_delete_player_account(uuid) from public;
revoke all on function public.admin_delete_player_account(uuid) from anon;
revoke all on function public.admin_delete_player_account(uuid) from authenticated;
grant execute on function public.admin_delete_player_account(uuid) to service_role;
