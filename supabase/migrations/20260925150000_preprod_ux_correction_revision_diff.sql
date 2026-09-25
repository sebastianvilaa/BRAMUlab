-- BRAMUlab — Ronda correctiva (revisión central) sobre la Ronda UX 25/09.
--
-- Handoff 13 (§G, "Recepción de una corrección") exige que el receptor entienda no solo quién
-- propuso una corrección, sino QUÉ CAMBIÓ. El frontend ya resolvía actor + framing + CTA sin
-- tocar backend (Ronda UX 25/09, commit 3c53900), pero central verificó contra Supabase Staging
-- real que `get_match_detail` solo devuelve los sets de la revisión VIGENTE
-- (`current_revision_id`) — no hay forma de armar un diff antes/después con el contrato previo.
--
-- Extensión MÍNIMA y ADITIVA (misma firma, mismo `returns jsonb`, CREATE OR REPLACE sobre la
-- definición vigente de `20260921220000_bloque6_read_rpcs.sql` — nunca se edita esa migración ya
-- aplicada): agrega dos campos nuevos al mismo `jsonb_build_object`, ningún campo existente
-- cambia de nombre ni de significado.
--
--   1) `previousRevisionSets` — sets de la revisión INMEDIATAMENTE ANTERIOR a
--      `currentRevisionNumber` (mismo match_id, `revision_number - 1`). Cubre el caso
--      PRE-VALIDACIÓN: cuando la pareja rival propone una corrección antes de validar, esa nueva
--      revisión YA pasa a ser `current_revision_id` (Bloque 5: `action_side` es derivado de la
--      revisión vigente, no de la original) — `sets` (campo ya existente) es el resultado
--      PROPUESTO vigente; `previousRevisionSets` es contra qué compararlo. `null` cuando
--      `currentRevisionNumber = 1` (nunca hubo una revisión anterior) o cuando el partido
--      todavía no tiene revisiones — mismo criterio de `jsonb_agg` sin filas que ya usa `sets`
--      (sin `coalesce`, consistente con ese campo hermano, nunca `'[]'::jsonb` forzado).
--   2) `pendingCorrectionSets` — sets de la revisión referenciada por
--      `pending_correction_revision_id` (ya expuesto como `pendingCorrectionRevisionId`, nunca
--      resuelto a sets hasta ahora). Cubre el caso POST-VALIDACIÓN: `current_revision_id` sigue
--      apuntando a la revisión OFICIAL (campo `sets` = oficial vigente); la corrección propuesta
--      y todavía no aceptada vive en `pending_correction_revision_id` — `pendingCorrectionSets`
--      es su resultado propuesto. `null` cuando no existe una corrección post-validación
--      pendiente (`pending_correction_revision_id is null`) — comparar contra NULL en SQL nunca
--      es verdadero, así que el subselect no encuentra filas y `jsonb_agg` devuelve `null` solo,
--      sin necesitar un `case`/`if` explícito.
--
-- Mapeo esperado del lado del cliente (bramulab/app.js, ver comentario en paintB6Actions):
--   PRE-VALIDACIÓN  (status='pending_validation', currentRevisionNumber > 1):
--     before = previousRevisionSets · after = sets
--   POST-VALIDACIÓN (status='validated', pendingCorrectionRevisionId no nulo):
--     before = sets · after = pendingCorrectionSets
--
-- No se toca ninguna otra RPC, tabla, política RLS ni GRANT — mismos `revoke`/`grant` que ya
-- tenía la función (authenticated), sin cambios.
--
-- NO aplicada desde esta sesión (sin Supabase CLI ni credenciales en este entorno) — central
-- aplicará/verificará esta migración contra Staging real después del push.

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

comment on function public.get_match_detail is
  'Detalle completo del partido para participantes. Bloque 6: agrega pendingCorrectionRevisionId
   y openIdentityIssues. Ronda correctiva (revisión central, 25/09/2026): agrega
   previousRevisionSets/pendingCorrectionSets para el diff antes/después de una corrección
   (handoff 13 §G) — ver nota de cabecera de la migración para el mapeo pre/post-validación. NULL
   si el caller no participa.';

revoke all on function public.get_match_detail(uuid) from public;
grant execute on function public.get_match_detail(uuid) to authenticated;
