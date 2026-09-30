-- BRAMUlab — V04.20 (Pre-Production L3 técnico): soporte SQL de eliminación autoservicio y acceso/copia.
--
-- 1) resolve_player_for_account_deletion — la Edge Function `delete-my-account` resuelve el player SIEMPRE
--    server-side a partir del JWT (nunca del body). Tras la Fase 1 de P0.3 `players.auth_user_id` queda NULL
--    (corte de acceso BRAMU); para que un RETRY tras un fallo parcial (mismo JWT todavía válido) pueda
--    completar las fases de Storage/Auth, se resuelve también por la auditoría mínima `account_deleted`
--    (`properties.authUserId`, que el motor purga recién al finalizar).
-- 2) admin_export_player_data — informe estandarizado de ACCESO/COPIA (Privacidad_Legal.md §2): solicitud por
--    email, respuesta generada por un operador con datos reales de la cuenta. SOLO lectura, solo service_role.
--    Incluye únicamente datos PROPIOS; de los demás participantes de un partido solo el nombre mostrado en ese
--    partido (nunca ids, email, teléfono, fecha de nacimiento, etc.). Sin secretos, sin memoria/auditoría
--    interna de Intelligence, sin internals de rate limit.
--
-- NO aplicada desde el sandbox del agente — la aplica y verifica Central con
-- supabase/tests/verify-preprod-v0420-account-self-service.sql (BEGIN/ROLLBACK).

create or replace function public.resolve_player_for_account_deletion(p_auth_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_player public.players;
begin
  if p_auth_user_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_user');
  end if;

  select * into v_player from public.players where auth_user_id = p_auth_user_id;
  if v_player.player_id is not null then
    if v_player.type <> 'registered' then
      return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
    end if;
    return jsonb_build_object('ok', true, 'playerId', v_player.player_id, 'alreadyDeleted', v_player.deleted_at is not null);
  end if;

  -- Retry: Fase 1 ya desvinculó el player; la auditoría todavía guarda el authUserId (se purga al finalizar).
  select pl.* into v_player
    from public.pilot_events pe
    join public.players pl on pl.player_id = pe.player_id
   where pe.event_name = 'account_deleted'
     and pe.properties ->> 'authUserId' = p_auth_user_id::text
     and pl.deleted_at is not null
   order by pe.created_at desc
   limit 1;
  if v_player.player_id is not null then
    return jsonb_build_object('ok', true, 'playerId', v_player.player_id, 'alreadyDeleted', true);
  end if;

  return jsonb_build_object('ok', false, 'code', 'player_not_found');
end;
$$;

comment on function public.resolve_player_for_account_deletion is
  'V04.20: resuelve el player_id de la cuenta que pide eliminarse a partir del auth user id del JWT (nunca del body).
   Soporta el retry posterior a la Fase 1 de P0.3 vía la auditoría account_deleted. Solo service_role.';

revoke all on function public.resolve_player_for_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.resolve_player_for_account_deletion(uuid) to service_role;

create or replace function public.admin_export_player_data(p_player_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_player public.players;
  v_email text;
  v_profile jsonb;
  v_result jsonb;
begin
  select * into v_player from public.players where player_id = p_player_id;
  if v_player.player_id is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;
  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;
  if v_player.deleted_at is not null then
    return jsonb_build_object('ok', false, 'code', 'account_deleted');
  end if;

  select u.email into v_email from auth.users u where u.id = v_player.auth_user_id;

  select to_jsonb(pr) - 'player_id' into v_profile from public.profiles pr where pr.player_id = p_player_id;

  v_result := jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'kind', 'BRAMUlab — informe de acceso/copia de datos personales',
      'format', 1,
      'generatedAt', now(),
      'controllerContact', 'bramulab@gmail.com',
      'scope', 'Datos propios de la cuenta. De otros participantes de un partido solo se incluye el nombre mostrado en ese partido.'
    ),
    'account', jsonb_build_object(
      'playerId', v_player.player_id,
      'email', v_email,
      'createdAt', v_player.created_at,
      'isActive', v_player.is_active
    ),
    'profile', coalesce(v_profile, '{}'::jsonb),
    'location', (
      select to_jsonb(l) - 'location_id'
        from public.profiles pr join public.locations l on l.location_id = pr.location_id
       where pr.player_id = p_player_id
    ),
    'legalAcceptances', coalesce((
      select jsonb_agg(jsonb_build_object('legalVersion', la.legal_version, 'acceptedAt', la.accepted_at, 'source', la.source) order by la.accepted_at)
        from public.legal_acceptances la where la.player_id = p_player_id
    ), '[]'::jsonb),
    'levelState', (select to_jsonb(ls) - 'player_id' from public.level_states ls where ls.player_id = p_player_id),
    'levelEvents', coalesce((select jsonb_agg(to_jsonb(le) - 'player_id' order by le.created_at) from public.level_events le where le.player_id = p_player_id), '[]'::jsonb),
    'locationChanges', coalesce((select jsonb_agg(jsonb_build_object('changeType', e.change_type, 'effectiveAt', e.effective_at) order by e.effective_at) from public.location_change_events e where e.player_id = p_player_id), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', m.match_id,
        'status', m.status,
        'playedAt', m.played_at,
        'formatId', m.format_id,
        'loadedByMe', m.created_by_player_id = p_player_id,
        'myTeam', me.team,
        'winnerTeam', m.winner_team,
        'participants', (
          select jsonb_agg(jsonb_build_object('team', mp.team, 'position', mp.position_in_team, 'displayName', mp.display_name_snapshot, 'isMe', mp.player_id = p_player_id) order by mp.team, mp.position_in_team)
            from public.match_participants mp where mp.match_id = m.match_id
        ),
        'sets', (
          select jsonb_agg(jsonb_build_object('set', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b) order by ms.set_number)
            from public.match_revisions r join public.match_sets ms on ms.match_id = r.match_id and ms.revision_number = r.revision_number
           where r.revision_id = m.current_revision_id
        ),
        'myPrivateState', (
          select jsonb_build_object('hidden', s.hidden, 'privateNote', s.private_note)
            from public.match_user_state s where s.match_id = m.match_id and s.player_id = p_player_id
        )
      ) order by m.played_at)
      from public.match_participants me
      join public.matches m on m.match_id = me.match_id
     where me.player_id = p_player_id
    ), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(to_jsonb(rr) - 'player_id' - 'row_id' order by rr.created_at)
        from public.ranking_rows rr where rr.player_id = p_player_id
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('groupName', g.name, 'isAdmin', gm.is_admin, 'joinedAt', gm.joined_at, 'leftAt', gm.left_at) order by gm.joined_at)
        from public.group_memberships gm join public.groups g on g.group_id = gm.group_id
       where gm.player_id = p_player_id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object('type', n.type, 'createdAt', n.created_at, 'readAt', n.read_at, 'payload', n.payload) order by n.created_at)
        from public.notifications n where n.player_id = p_player_id
    ), '[]'::jsonb),
    'savedPlayersCount', (select count(*) from public.player_saved_players sp where sp.owner_player_id = p_player_id),
    'intelligence', coalesce((
      select jsonb_agg(jsonb_build_object('matchId', i.match_id, 'generatedAt', i.generated_at, 'output', i.output) order by i.generated_at)
        from public.intelligence_match_outputs i where i.player_id = p_player_id
    ), '[]'::jsonb),
    'purposesAndRecipients', jsonb_build_object(
      'purposes', jsonb_build_array('Operar la cuenta y el perfil deportivo', 'Calcular Nivel BRAMU, Ranking y BRAMU Intelligence', 'Seguridad y prevención de abuso', 'Cumplimiento legal'),
      'recipientClasses', jsonb_build_array('Otros jugadores (solo datos de perfil público y de partidos compartidos)', 'Proveedores de infraestructura y correo (Supabase, Vercel, proveedor de email) — inventario final pendiente de Production')
    )
  );
  return v_result;
end;
$$;

comment on function public.admin_export_player_data is
  'V04.20: informe de acceso/copia de datos propios (Privacidad_Legal.md §2). SOLO lectura, solo service_role. Sin datos
   privados de terceros, sin secretos ni auditoría/memoria interna de Intelligence, sin internals de rate limit.';

revoke all on function public.admin_export_player_data(uuid) from public, anon, authenticated;
grant execute on function public.admin_export_player_data(uuid) to service_role;
