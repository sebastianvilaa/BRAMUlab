-- BRAMUlab — Bloque 6: RPCs de lectura para la oficialización server-side.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.2/§3.5/§3.8,
-- 03_Plan_Implementacion_Claude.md §1.4}. Todas SECURITY DEFINER, SOLO service_role (a
-- diferencia de las RPC de lectura de Bloque 5, nada de esto tiene sentido para un cliente
-- autenticado normal: exponen niveles/participantes de partidos ajenos por diseño, porque la
-- Edge Function de oficialización necesita ver a los 4 jugadores, no solo al caller).
--
--   1) get_match_officialization_snapshot(match_id) — TODO lo que la Edge Function necesita en
--      una sola lectura consistente: partido + revisión vigente + sets + level_states de los
--      participantes conocidos + snapshot ORIGINAL de cada jugador para ESTE partido (primera
--      vez que se calculó, nunca se recalcula aunque el partido se corrija después — ver
--      comentario de priorSnapshots) + el match_level_results actualmente `applied`, si existe
--      (para revertirlo antes de reaplicar).
--   2) get_player_match_history_for_level_engine(player_ids, before_played_at) — partidos
--      validados de esos jugadores en los 180 días anteriores, en la MISMA forma jsonb
--      (camelCase) que ya usa get_my_matches, para que
--      PLMatchSync.translateServerMatchToLocalShape (Bloque 5) los traduzca sin ningún cambio.
--      Filtra también por match_level_results.eligible=true: un partido sin efecto de Nivel
--      (ventana de 30 días excedida) no debe contar como "computable" para repetición/
--      compañero/círculo de otro partido.
--   3) get_player_level_state_as_of(player_id, cutoff) — reconstrucción determinística del
--      estado de un jugador inmediatamente antes de un instante dado (Decisión Abierta #2,
--      resuelta por 04_Revision_ChatGPT.md §2: orden (created_at, event_id), nunca solo
--      created_at). Devuelve NULL si no hay ningún evento antes del cutoff (el jugador no tenía
--      Nivel real en ese momento — el llamador lo trata como invitado, Nivel_BRAMU_Formula_V1.5.md §13).
--
-- Además, se extiende get_my_matches/get_match_detail (Bloque 5) con dos campos nuevos
-- (pendingCorrectionRevisionId, openIdentityIssue) para que Home/Historial puedan distinguir
-- "corrección propuesta"/"identidad cuestionada" de "pendiente accionable" — sin tocar el
-- filtro de hidden existente ni ningún otro campo ya devuelto.

-- ------------------------------------------------------------------
-- 1) get_match_officialization_snapshot
-- ------------------------------------------------------------------

create or replace function public.get_match_officialization_snapshot(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_result jsonb;
begin
  select * into v_match from public.matches where match_id = p_match_id;
  if v_match is null then
    return null;
  end if;

  select jsonb_build_object(
    'matchId', v_match.match_id,
    'status', v_match.status,
    'playedAt', v_match.played_at,
    'playedAtTimeKnown', v_match.played_at_time_known,
    'reportedTimeZone', v_match.reported_time_zone,
    'formatId', v_match.format_id,
    'scoringSystem', v_match.scoring_system,
    'locationName', v_match.location_name,
    'locationLat', v_match.location_lat,
    'locationLng', v_match.location_lng,
    'hidden', false,
    'actionSide', v_match.action_side,
    'isActionMine', false,
    'readyForValidation', false,
    'createdByPlayerId', v_match.created_by_player_id,
    'validatedAt', v_match.validated_at,
    'validationDeadlineAt', v_match.validation_deadline_at,
    'privateNote', null,
    'currentRevisionId', v_match.current_revision_id,
    'pendingCorrectionRevisionId', v_match.pending_correction_revision_id,
    'currentRevisionNumber', (select revision_number from public.match_revisions where revision_id = v_match.current_revision_id),
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team, 'position', mp.position_in_team, 'playerId', mp.player_id,
        'displayName', mp.display_name_snapshot
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = v_match.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = v_match.match_id
        and ms.revision_number = (select revision_number from public.match_revisions where revision_id = v_match.current_revision_id)
    ),
    -- level_states de los participantes CONOCIDOS (player_id no nulo). Un slot no identificado
    -- simplemente no aparece acá — el llamador lo trata como invitado, sin caso especial.
    'levelStates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', ls.player_id, 'mu', ls.mu, 'confidence', ls.confidence,
        'evidenceUnits', ls.evidence_units, 'confidenceOrigin', ls.confidence_origin,
        'status', ls.status, 'ratedMatches', ls.rated_matches, 'distinctOpponents', ls.distinct_opponents
      )), '[]'::jsonb)
      from public.level_states ls
      where ls.player_id in (
        select mp.player_id from public.match_participants mp
        where mp.match_id = v_match.match_id and mp.player_id is not null
      )
    ),
    -- Snapshot ORIGINAL (primera vez que se calculó ALGO para este partido, applied o reverted)
    -- de cada jugador que ya participó de algún cálculo previo de este partido. Es INMUTABLE a
    -- través de correcciones posteriores: "mismos snapshots previos" (Nivel_BRAMU_Formula_V1.5.md
    -- §12.3) significa que el Nivel de cada jugador INMEDIATAMENTE ANTES de este encuentro no
    -- cambia aunque el partido se corrija muchas veces después.
    'priorSnapshots', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', first_rows.player_id, 'muBefore', first_rows.mu_before,
        'confidenceBefore', first_rows.confidence_before, 'evidenceUnitsBefore', first_rows.evidence_units_before
      )), '[]'::jsonb)
      from (
        select distinct on (mlrp.player_id)
          mlrp.player_id, mlrp.mu_before, mlrp.confidence_before, mlrp.evidence_units_before
        from public.match_level_result_players mlrp
        join public.match_level_results mlr on mlr.result_id = mlrp.result_id
        where mlr.match_id = v_match.match_id
        order by mlrp.player_id, mlr.computed_at asc
      ) first_rows
    ),
    -- El resultado actualmente vigente (si existe) — para revertirlo antes de reaplicar.
    'currentAppliedResult', (
      select jsonb_build_object(
        'resultId', mlr.result_id, 'revisionId', mlr.revision_id, 'eligible', mlr.eligible,
        'reasonCodes', mlr.reason_codes, 'algorithmVersion', mlr.algorithm_version,
        'players', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'playerId', mlrp.player_id, 'team', mlrp.team,
            'muBefore', mlrp.mu_before, 'confidenceBefore', mlrp.confidence_before,
            'evidenceUnitsBefore', mlrp.evidence_units_before,
            'deltaCapped', mlrp.delta_capped, 'evidenceQuality', mlrp.evidence_quality,
            'muAfter', mlrp.mu_after, 'confidenceAfter', mlrp.confidence_after,
            'evidenceUnitsAfter', mlrp.evidence_units_after
          )), '[]'::jsonb)
          from public.match_level_result_players mlrp where mlrp.result_id = mlr.result_id
        )
      )
      from public.match_level_results mlr
      where mlr.match_id = v_match.match_id and mlr.effect_status = 'applied'
      limit 1
    ),
    -- Incidencia de identidad abierta, si existe — el llamador la usa para bloquear una
    -- corrección de resultado mientras esté open (04_Revision_ChatGPT.md §11).
    'openIdentityIssues', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
        'openedAt', mii.opened_at, 'resolutionDeadlineAt', mii.resolution_deadline_at
      )), '[]'::jsonb)
      from public.match_identity_issues mii
      where mii.match_id = v_match.match_id and mii.status = 'open'
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_match_officialization_snapshot is
  'Lectura consolidada para la oficialización/corrección/identidad de un partido. SOLO
   service_role — expone niveles/participantes de los 4 jugadores, nunca para un cliente normal.';

revoke all on function public.get_match_officialization_snapshot(uuid) from public;
grant execute on function public.get_match_officialization_snapshot(uuid) to service_role;

-- ------------------------------------------------------------------
-- 2) get_player_match_history_for_level_engine
-- ------------------------------------------------------------------

create or replace function public.get_player_match_history_for_level_engine(
  p_player_ids uuid[],
  p_before_played_at timestamptz
)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'matchId', m.match_id,
    'status', m.status,
    'playedAt', m.played_at,
    'playedAtTimeKnown', m.played_at_time_known,
    'reportedTimeZone', m.reported_time_zone,
    'formatId', m.format_id,
    'scoringSystem', m.scoring_system,
    'locationName', m.location_name,
    'locationLat', m.location_lat,
    'locationLng', m.location_lng,
    'hidden', false,
    'actionSide', null,
    'isActionMine', false,
    'readyForValidation', false,
    'createdByPlayerId', m.created_by_player_id,
    'validatedAt', m.validated_at,
    'validationDeadlineAt', m.validation_deadline_at,
    'privateNote', null,
    'participants', (
      select jsonb_agg(jsonb_build_object(
        'team', mp.team, 'position', mp.position_in_team, 'playerId', mp.player_id,
        'displayName', mp.display_name_snapshot
      ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = m.match_id
    ),
    'sets', (
      select jsonb_agg(jsonb_build_object(
        'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
        'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b
      ) order by ms.set_number)
      from public.match_sets ms
      where ms.match_id = m.match_id
        and ms.revision_number = (select revision_number from public.match_revisions where revision_id = m.current_revision_id)
    )
  )
  from public.matches m
  where m.status = 'validated'
    and m.played_at < p_before_played_at
    and m.played_at >= p_before_played_at - interval '180 days'
    -- Solo partidos que efectivamente tuvieron efecto de Nivel (Decisión Abierta #1, resuelta):
    -- uno sin efecto (ventana de 30 días desde played_at excedida, o disponibilidad
    -- insuficiente) no cuenta como "computable" para repetición/compañero/círculo de otro
    -- partido tampoco — Nivel_BRAMU_Formula_V1.5.md §8 solo habla de partidos computables.
    and exists (
      select 1 from public.match_level_results mlr
      where mlr.match_id = m.match_id and mlr.effect_status = 'applied' and mlr.eligible
    )
    and exists (
      select 1 from public.match_participants mp
      where mp.match_id = m.match_id and mp.player_id = any(p_player_ids)
    );
$$;

comment on function public.get_player_match_history_for_level_engine is
  'Partidos validados y Nivel-elegibles de los jugadores dados, últimos 180 días antes de
   before_played_at. Forma jsonb IDÉNTICA (camelCase) a una fila de get_my_matches, para que
   PLMatchSync.translateServerMatchToLocalShape (Bloque 5) la traduzca sin ningún adaptador
   nuevo. SOLO service_role.';

revoke all on function public.get_player_match_history_for_level_engine(uuid[], timestamptz) from public;
grant execute on function public.get_player_match_history_for_level_engine(uuid[], timestamptz) to service_role;

-- ------------------------------------------------------------------
-- 3) get_player_level_state_as_of — Decisión Abierta #2, resuelta
-- ------------------------------------------------------------------

create or replace function public.get_player_level_state_as_of(p_player_id uuid, p_cutoff timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    -- initial_estimate (Bloque 3) usa otras claves (confirmedLevel/confidenceOrigin) y siempre
    -- representa evidencia 0 / status CALIBRANDO — se traduce acá sin tocar el contrato ya
    -- cerrado de officialize_level_onboarding.
    when le.event_type = 'initial_estimate' then jsonb_build_object(
      'mu', (le.result->>'confirmedLevel')::numeric,
      'confidence', (le.result->>'confidenceOrigin')::numeric,
      'evidenceUnits', 0,
      'status', 'CALIBRANDO'
    )
    else jsonb_build_object(
      'mu', (le.result->>'muAfter')::numeric,
      'confidence', (le.result->>'confidenceAfter')::numeric,
      'evidenceUnits', (le.result->>'evidenceUnitsAfter')::numeric,
      'status', le.result->>'statusAfter'
    )
  end
  from public.level_events le
  where le.player_id = p_player_id
    and le.created_at <= p_cutoff
  -- Orden determinístico obligatorio (04_Revision_ChatGPT.md §2): (created_at, event_id), NUNCA
  -- created_at solo — puede haber más de un evento con timestamps equivalentes.
  order by le.created_at desc, le.event_id desc
  limit 1;
$$;

comment on function public.get_player_level_state_as_of is
  'Reconstrucción determinística del estado de un jugador INMEDIATAMENTE ANTES de p_cutoff
   (Decisión Abierta #2 de 02_Analisis_Claude.md, resuelta por 04_Revision_ChatGPT.md §2). NULL
   si el jugador no tenía ningún evento antes de esa fecha — el llamador lo trata como invitado
   sin Nivel conocido (Nivel_BRAMU_Formula_V1.5.md §13), nunca inventa un valor. SOLO service_role.';

revoke all on function public.get_player_level_state_as_of(uuid, timestamptz) from public;
grant execute on function public.get_player_level_state_as_of(uuid, timestamptz) to service_role;

-- ------------------------------------------------------------------
-- 4) get_my_matches / get_match_detail — extensión mínima (Bloque 6)
-- ------------------------------------------------------------------

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
  sets jsonb,
  pending_correction_revision_id uuid,
  has_open_identity_issue boolean
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
      ) as sets,
      m.pending_correction_revision_id,
      exists (
        select 1 from public.match_identity_issues mii
        where mii.match_id = m.match_id and mii.status = 'open'
      ) as has_open_identity_issue
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
  'Feed compartido del caller. Bloque 6: agrega pending_correction_revision_id (corrección
   post-validación en espera) y has_open_identity_issue (para distinguir el badge de "identidad
   cuestionada" del de "pendiente accionable"). Ningún campo previo cambia de significado —
   hidden sigue siendo una preferencia de VISUALIZACIÓN, la capa computable (buildComputableHistory,
   match-sync.js) sigue sin filtrarlo (04_Revision_ChatGPT.md §4).';

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
    'pendingCorrectionRevisionId', v_match.pending_correction_revision_id,
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
    'openIdentityIssues', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'issueId', mii.issue_id, 'team', mii.team, 'positionInTeam', mii.position_in_team,
        'openedAt', mii.opened_at, 'resolutionDeadlineAt', mii.resolution_deadline_at
      )), '[]'::jsonb)
      from public.match_identity_issues mii
      where mii.match_id = v_match.match_id and mii.status = 'open'
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
  'Detalle completo del partido para participantes. Bloque 6: agrega pendingCorrectionRevisionId
   y openIdentityIssues. NULL si el caller no participa.';

revoke all on function public.get_match_detail(uuid) from public;
grant execute on function public.get_match_detail(uuid) to authenticated;
