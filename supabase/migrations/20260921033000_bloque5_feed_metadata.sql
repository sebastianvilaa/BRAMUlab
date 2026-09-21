-- BRAMUlab — Backend Bloque 5 hotfix: completar metadatos del feed compartido
--
-- El wiring frontend necesita preservar datos que el servidor ya guarda y que son visibles
-- en la experiencia existente: hora conocida/desconocida, zona horaria, lugar y nota privada.
-- get_my_matches era demasiado mínimo y obligaba al cliente a inventar timeKnown=true / perder
-- ubicación y nota al abrir un partido desde Historial.
--
-- La nota privada es segura en este feed porque la función resuelve al caller con auth.uid()
-- y lee exclusivamente SU fila de match_user_state.

drop function if exists public.get_my_matches(integer, boolean);

create function public.get_my_matches(p_limit integer default 50, p_include_hidden boolean default false)
returns table (
  match_id uuid,
  status text,
  played_at timestamptz,
  played_at_time_known boolean,
  reported_time_zone text,
  format_id text,
  scoring_system text,
  location_name text,
  location_lat numeric,
  location_lng numeric,
  my_team text,
  action_side text,
  is_action_mine boolean,
  ready_for_validation boolean,
  created_by_player_id uuid,
  validated_at timestamptz,
  validation_deadline_at timestamptz,
  hidden boolean,
  private_note text,
  participants jsonb,
  sets jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  return query
    select
      m.match_id,
      case when m.status = 'pending_validation' and m.validation_deadline_at <= now()
           then 'expired' else m.status end as status,
      m.played_at,
      m.played_at_time_known,
      m.reported_time_zone,
      m.format_id,
      m.scoring_system,
      m.location_name,
      m.location_lat,
      m.location_lng,
      mp_self.team as my_team,
      m.action_side,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side = mp_self.team) as is_action_mine,
      (m.status = 'pending_validation'
        and m.validation_deadline_at > now()
        and m.action_side is null) as ready_for_validation,
      m.created_by_player_id,
      m.validated_at,
      m.validation_deadline_at,
      coalesce(mus.hidden, false) as hidden,
      mus.private_note,
      (
        select jsonb_agg(jsonb_build_object(
          'team', mp.team,
          'position', mp.position_in_team,
          'playerId', mp.player_id,
          'displayName', mp.display_name_snapshot
        ) order by mp.team, mp.position_in_team)
        from public.match_participants mp
        where mp.match_id = m.match_id
      ) as participants,
      (
        select jsonb_agg(jsonb_build_object(
          'setNumber', ms.set_number,
          'gamesA', ms.games_a,
          'gamesB', ms.games_b,
          'tiebreakA', ms.tiebreak_a,
          'tiebreakB', ms.tiebreak_b
        ) order by ms.set_number)
        from public.match_sets ms
        where ms.match_id = m.match_id
          and ms.revision_number = (
            select mr.revision_number
            from public.match_revisions mr
            where mr.revision_id = m.current_revision_id
          )
      ) as sets
    from public.matches m
    join public.match_participants mp_self
      on mp_self.match_id = m.match_id
     and mp_self.player_id = v_caller_player_id
    left join public.match_user_state mus
      on mus.match_id = m.match_id
     and mus.player_id = v_caller_player_id
    where (p_include_hidden or coalesce(mus.hidden, false) = false)
    order by m.played_at desc
    limit v_limit;
end;
$$;

comment on function public.get_my_matches is
  'Feed compartido del caller. Incluye metadatos de presentación (timeKnown/timezone/lugar) y
   la nota privada DEL CALLER para no perder información al abrir desde Historial. Expiración
   sigue siendo lógica; ready_for_validation no equivale a status=validated.';

revoke all on function public.get_my_matches(integer, boolean) from public;
grant execute on function public.get_my_matches(integer, boolean) to authenticated;

create or replace function public.get_match_detail(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
  v_match public.matches;
  v_my_row public.match_participants;
  v_result jsonb;
begin
  select player_id into v_caller_player_id
  from public.players
  where auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select * into v_match
  from public.matches
  where match_id = p_match_id;

  if v_match is null then
    return null;
  end if;

  select * into v_my_row
  from public.match_participants
  where match_id = p_match_id
    and player_id = v_caller_player_id;

  if v_my_row is null then
    return null;
  end if;

  select jsonb_build_object(
    'matchId', v_match.match_id,
    'status', case when v_match.status = 'pending_validation'
                       and v_match.validation_deadline_at <= now()
                   then 'expired' else v_match.status end,
    'playedAt', v_match.played_at,
    'playedAtTimeKnown', v_match.played_at_time_known,
    'reportedTimeZone', v_match.reported_time_zone,
    'formatId', v_match.format_id,
    'scoringSystem', v_match.scoring_system,
    'locationName', v_match.location_name,
    'locationLat', v_match.location_lat,
    'locationLng', v_match.location_lng,
    'myTeam', v_my_row.team,
    'actionSide', v_match.action_side,
    'isActionMine', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side = v_my_row.team
    ),
    'readyForValidation', (
      v_match.status = 'pending_validation'
      and v_match.validation_deadline_at > now()
      and v_match.action_side is null
    ),
    'createdByPlayerId', v_match.created_by_player_id,
    'validatedAt', v_match.validated_at,
    'validationDeadlineAt', v_match.validation_deadline_at,
    'currentRevisionNumber', (
      select revision_number
      from public.match_revisions
      where revision_id = v_match.current_revision_id
    ),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team,
        'position', mp.position_in_team,
        'playerId', mp.player_id,
        'displayName', mp.display_name_snapshot
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp
      where mp.match_id = v_match.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number,
        'gamesA', ms.games_a,
        'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a,
        'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (
          select revision_number
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    'revisionCount', (
      select count(*)
      from public.match_revisions
      where match_id = v_match.match_id
    ),
    'actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'actionType', ma.action_type,
        'actorPlayerId', ma.actor_player_id,
        'actingSide', ma.acting_side,
        'occurredAt', ma.occurred_at
      ) order by ma.occurred_at), '[]'::jsonb)
      from public.match_actions ma
      where ma.match_id = v_match.match_id
    ),
    'hidden', coalesce((
      select hidden
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    ), false),
    'privateNote', (
      select private_note
      from public.match_user_state
      where match_id = v_match.match_id
        and player_id = v_caller_player_id
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_match_detail is
  'Detalle completo del partido para participantes, preservando timeKnown/timezone/lugar,
   modificaciones y estado privado del caller. NULL si el caller no participa.';

revoke all on function public.get_match_detail(uuid) from public;
grant execute on function public.get_match_detail(uuid) to authenticated;
