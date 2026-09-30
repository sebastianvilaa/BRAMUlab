-- BRAMUlab — V04.16 (ronda acumulada cierre QA general, Issue #9).
--
-- 1) IDENTIDAD VISIBLE (Issue #8): display name ACTUAL retrospectivo por player_id en las lecturas
--    que hoy devuelven el snapshot de `match_participants`. Un cambio Esteban -> Steve se ve como
--    Steve también en partidos anteriores.
--      - Helper `_match_participant_display_name(player_id, snapshot)`:
--          * jugador REGISTRADO, activo y no eliminado -> `players.display_name` vigente
--            (complete_profile ya lo mantiene sincronizado con profiles.display_name);
--          * eliminado (P0.3) -> SIEMPRE el snapshot ("Jugador eliminado"): nunca recupera un
--            nombre histórico ni el actual;
--          * provisional, invitado, "Por identificar" (player_id null) -> snapshot, igual que hoy
--            (siguen las reglas de identidad/claim vigentes);
--          * nunca resuelve por coincidencia de nombre: SOLO por player_id.
--      - get_my_matches, get_match_detail y _bloque6_notification_match_context (matchContext de
--        notificaciones) pasan a usar el helper. CREATE OR REPLACE puro: mismas firmas, columnas de
--        retorno y permisos que sus últimas definiciones; no se altera ninguna otra línea.
--      - NO se reescribe ni se borra `match_participants.display_name_snapshot`, revisiones,
--        acciones ni evidencia: el snapshot queda como dato de auditoría/fallback.
--
-- 2) DELTA REAL DE NIVEL (Issue #7): `get_my_last_level_delta()` — último cambio de Nivel REAL
--    aplicable al caller, desde match_level_result_players (formula_mu_before / mu_after /
--    delta_capped) de resultados vigentes (effect_status='applied', eligible). Sin evidencia
--    -> delta null (el cliente oculta el chip; nunca se fabrica). No toca la fórmula.
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — la aplica y verifica
-- Central en Staging con supabase/tests/verify-preprod-v0416-identidad-nivel.sql (BEGIN/ROLLBACK).

create or replace function public._match_participant_display_name(p_player_id uuid, p_snapshot text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(pl.display_name), '')
     from public.players pl
     where pl.player_id = p_player_id
       and pl.type = 'registered'
       and pl.is_active
       and pl.deleted_at is null),
    p_snapshot
  );
$$;

revoke all on function public._match_participant_display_name(uuid, text) from public;
revoke all on function public._match_participant_display_name(uuid, text) from anon;
revoke all on function public._match_participant_display_name(uuid, text) from authenticated;

-- ------------------------------------------------------------------
-- Lecturas (últimas definiciones + helper)
-- ------------------------------------------------------------------

create or replace function public.get_my_matches(p_limit integer default 50, p_include_hidden boolean default false)
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
          'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
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
        'displayName', public._match_participant_display_name(mp.player_id, mp.display_name_snapshot)
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
    -- Ronda correctiva (revisión central) — ver nota de cabecera §1. `revision_number - 1` sobre
    -- la MISMA revisión vigente ya resuelta arriba (nunca un segundo criterio de "cuál es la
    -- vigente"); si no existe esa revisión_number-1 en match_sets (currentRevisionNumber=1),
    -- `jsonb_agg` sin filas devuelve `null`, igual que `sets` arriba sin `coalesce`.
    'previousRevisionSets', (
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
          select revision_number - 1
          from public.match_revisions
          where revision_id = v_match.current_revision_id
        )
    ),
    -- Ronda correctiva (revisión central) — ver nota de cabecera §2. `pending_correction_revision_id`
    -- ya se exponía como id (`pendingCorrectionRevisionId`, sin cambios), nunca resuelto a sets
    -- hasta ahora. Sin corrección pendiente, `v_match.pending_correction_revision_id` es NULL:
    -- comparar `revision_id = NULL` nunca es verdadero en SQL, el subselect no encuentra fila y
    -- el `jsonb_agg` externo devuelve `null` sin necesitar un `case`/`if` aparte.
    'pendingCorrectionSets', (
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
          where revision_id = v_match.pending_correction_revision_id
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

create or replace function public._bloque6_notification_match_context(p_match_id uuid, p_caller_player_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'myTeam', mp_me.team,
    'opponentNames', (
      select jsonb_agg(public._match_participant_display_name(mp2.player_id, mp2.display_name_snapshot) order by mp2.position_in_team)
      from public.match_participants mp2
      where mp2.match_id = p_match_id
        and mp2.team = (case mp_me.team when 'A' then 'B' else 'A' end)
    ),
    -- match_sets.games_a/games_b están SIEMPRE fijos a team=A/B (mismo criterio documentado en
    -- el comment de esa tabla), nunca a "quién mira" — acá se invierte a la perspectiva del
    -- caller si su equipo es B. Revisión VIGENTE (matches.current_revision_id), mismo patrón
    -- exacto que ya usa get_match_detail para 'sets'. Sin sets todavía (no debería pasar para un
    -- partido ya validated/con match_actions, pero por las dudas): jsonb_agg sin filas -> null,
    -- nunca un score inventado.
    'score', (
      select jsonb_agg(
        (case mp_me.team when 'B' then ms.games_b else ms.games_a end)::text
        || '–' ||
        (case mp_me.team when 'B' then ms.games_a else ms.games_b end)::text
        order by ms.set_number
      )
      from public.match_sets ms
      where ms.match_id = p_match_id
        and ms.revision_number = (
          select mr.revision_number
          from public.matches m
          join public.match_revisions mr on mr.revision_id = m.current_revision_id
          where m.match_id = p_match_id
        )
    )
  )
  from public.match_participants mp_me
  where mp_me.match_id = p_match_id
    and mp_me.player_id = p_caller_player_id;
$$;

-- ------------------------------------------------------------------
-- get_my_last_level_delta
-- ------------------------------------------------------------------

create or replace function public.get_my_last_level_delta()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid;
  v_row record;
begin
  select pl.player_id into v_caller from public.players pl where pl.auth_user_id = auth.uid() and pl.is_active;
  if v_caller is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select rp.delta_capped, rp.formula_mu_before, rp.mu_after, r.match_id, m.played_at
    into v_row
  from public.match_level_result_players rp
  join public.match_level_results r on r.result_id = rp.result_id
  join public.matches m on m.match_id = r.match_id
  where rp.player_id = v_caller
    and r.effect_status = 'applied'
    and r.eligible
  order by m.played_at desc, r.computed_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', true, 'delta', null);
  end if;
  return jsonb_build_object(
    'ok', true,
    'delta', v_row.delta_capped,
    'muBefore', v_row.formula_mu_before,
    'muAfter', v_row.mu_after,
    'matchId', v_row.match_id,
    'playedAt', v_row.played_at
  );
end;
$$;

revoke all on function public.get_my_last_level_delta() from public;
revoke all on function public.get_my_last_level_delta() from anon;
grant execute on function public.get_my_last_level_delta() to authenticated;
