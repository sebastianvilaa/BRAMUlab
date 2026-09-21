-- BRAMUlab — Bloque 6: officialize_match_validation — núcleo único de oficialización.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.1/§3.2/§3.3,
-- 03_Plan_Implementacion_Claude.md §1.4}. Resumen del contrato:
--
-- NO recalcula nada — TODA la matemática (elegibilidad de ventana, expectativa, factores,
-- deltas, y la diferencia NETA entre un resultado anterior y uno nuevo) ya la hizo la Edge
-- Function con bramulab/match-level-engine.js + level-context.js + level.js (motor JS
-- compartido, nunca reimplementado en SQL). Esta RPC solo:
--   1) protege concurrencia (lock de matches + lock de level_states en orden determinístico por
--      player_id, verificación optimista contra el snapshot que el motor usó);
--   2) revierte el match_level_results anterior si existe (marca reverted, nunca borra);
--   3) persiste el nuevo match_level_results (+ match_level_result_players si eligible);
--   4) escribe los valores YA CALCULADOS en level_states (mu/confidence/evidence_units), y
--      recalcula rated_matches/distinct_opponents por CONTEO DIRECTO contra
--      match_level_result_players (nunca un contador incremental que pueda desincronizarse);
--   5) escribe level_events/match_actions/notifications/pilot_events;
--   6) es idempotente por (match_id, revision_id, trigger, composición exacta de jugadores) —
--      mismo criterio que officialize_level_onboarding (Bloque 3): un reintento exacto del
--      mismo intento devuelve el resultado ya persistido, nunca duplica.
--
-- Único llamador: la Edge Function `officialize-match` (y, en su interior, la rutina
-- compartida que también invocan create-or-attach-match/respond-match-correction/
-- resolve-identity-issue) — SOLO service_role.

create or replace function public.officialize_match_validation(
  p_match_id uuid,
  p_revision_id uuid,
  p_trigger text,
  p_actor_player_id uuid,
  p_actor_note text,
  p_eligible boolean,
  p_reason_codes jsonb,
  p_algorithm_version text,
  p_known_levels_count integer,
  p_team_strength_a numeric,
  p_team_strength_b numeric,
  p_expectation_a numeric,
  p_expectation_b numeric,
  p_rival_pair_confidence_avg_a numeric,
  p_rival_pair_confidence_avg_b numeric,
  p_margin numeric,
  p_format_factor numeric,
  p_availability_factor numeric,
  p_repetition_factor_a numeric,
  p_repetition_factor_b numeric,
  p_companion_factor_a numeric,
  p_companion_factor_b numeric,
  -- [{playerId,team,muBefore,confidenceBefore,evidenceUnitsBefore,effectiveLevel,k,
  --   opponentFactor,circleFactor,deltaRaw,deltaCapped,evidenceQuality,muAfter,confidenceAfter,
  --   evidenceUnitsAfter}] — salida de PLMatchLevelEngine.computeLevelStateUpdates().resultPlayers.
  -- Vacío si !p_eligible.
  p_result_players jsonb,
  -- [{playerId,finalMu,finalConfidence,finalEvidenceUnits,currentMuForLock,
  --   currentConfidenceForLock,currentEvidenceUnitsForLock}] — .levelStateUpdates. Incluye TODO
  -- jugador afectado (viejo ∪ nuevo), incluso uno que ya no participa del resultado nuevo
  -- (reversión pura, ver computeLevelStateUpdates).
  p_level_state_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_existing_applied public.match_level_results;
  v_existing_player_ids uuid[];
  v_new_result_player_ids uuid[];
  v_result_id uuid;
  v_update jsonb;
  v_rp jsonb;
  v_player_id uuid;
  v_current_level_state public.level_states;
  v_new_rated_matches integer;
  v_new_distinct_opponents integer;
  v_new_status text;
  v_event_type text;
  v_action_type text;
  v_notification_type text;
  v_result jsonb;
begin
  if p_trigger not in ('initial', 'correction_accepted', 'identity_resolved', 'identity_unidentified') then
    raise exception 'invalid_trigger' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- Idempotencia por estado (mismo criterio que officialize_level_onboarding, Bloque 3): si YA
  -- existe un resultado applied para exactamente esta revisión/trigger/composición de
  -- jugadores conocidos, se devuelve tal cual — nunca se recalcula ni se duplica.
  -- ------------------------------------------------------------------
  select * into v_existing_applied
  from public.match_level_results
  where match_id = p_match_id and effect_status = 'applied'
  for update;

  if v_existing_applied is not null and v_existing_applied.revision_id = p_revision_id and v_existing_applied.trigger = p_trigger then
    select array_agg(player_id order by player_id) into v_existing_player_ids
    from public.match_level_result_players where result_id = v_existing_applied.result_id;

    select array_agg((elem->>'playerId')::uuid order by (elem->>'playerId')::uuid)
      into v_new_result_player_ids
      from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) elem;

    if coalesce(v_existing_player_ids, array[]::uuid[]) = coalesce(v_new_result_player_ids, array[]::uuid[]) then
      return jsonb_build_object(
        'ok', true, 'resultId', v_existing_applied.result_id, 'eligible', v_existing_applied.eligible,
        'idempotentReturn', true
      );
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- Verificación optimista: el mu/confidence/evidence_units ACTUAL de level_states (bajo lock,
  -- en orden determinístico por player_id para no producir deadlocks entre dos oficializaciones
  -- concurrentes que comparten jugadores) debe coincidir con el que el motor usó como base del
  -- neto. Si no coincide, otra oficialización concurrente ya movió ese jugador primero: se
  -- rechaza sin escribir nada — el llamador relee y recalcula sobre el estado fresco.
  -- ------------------------------------------------------------------
  for v_player_id in
    select (elem->>'playerId')::uuid
    from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb)) elem
    order by (elem->>'playerId')::uuid
  loop
    select * into v_current_level_state from public.level_states where player_id = v_player_id for update;
    v_update := (
      select elem from jsonb_array_elements(p_level_state_updates) elem where (elem->>'playerId')::uuid = v_player_id limit 1
    );
    if v_current_level_state is null
       or v_current_level_state.mu is distinct from (v_update->>'currentMuForLock')::numeric
       or v_current_level_state.confidence is distinct from (v_update->>'currentConfidenceForLock')::numeric
       or coalesce(v_current_level_state.evidence_units, 0) is distinct from coalesce((v_update->>'currentEvidenceUnitsForLock')::numeric, 0)
    then
      return jsonb_build_object('ok', false, 'code', 'stale_level_snapshot', 'playerId', v_player_id);
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- Revertir el resultado anterior vigente (si existe) — nunca se borra, se marca reverted.
  -- ------------------------------------------------------------------
  if v_existing_applied is not null then
    update public.match_level_results
      set effect_status = 'reverted', reverted_at = now()
      where result_id = v_existing_applied.result_id;

    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    select mlrp.player_id, 'match_correction_reversal', v_existing_applied.algorithm_version, p_match_id, v_existing_applied.result_id,
      jsonb_build_object('revertedResultId', v_existing_applied.result_id)
    from public.match_level_result_players mlrp
    where mlrp.result_id = v_existing_applied.result_id;
  end if;

  -- ------------------------------------------------------------------
  -- Nuevo match_level_results (cabecera) — siempre se inserta, eligible o no, para auditoría.
  -- ------------------------------------------------------------------
  insert into public.match_level_results (
    match_id, revision_id, trigger, algorithm_version, eligible, reason_codes,
    known_levels_count, team_strength_a, team_strength_b, expectation_a, expectation_b,
    rival_pair_confidence_avg_a, rival_pair_confidence_avg_b, margin, format_factor,
    availability_factor, repetition_factor_a, repetition_factor_b, companion_factor_a, companion_factor_b,
    reverses_result_id, actor_player_id, actor_note
  ) values (
    p_match_id, p_revision_id, p_trigger, p_algorithm_version, coalesce(p_eligible, false), coalesce(p_reason_codes, '[]'::jsonb),
    p_known_levels_count, p_team_strength_a, p_team_strength_b, p_expectation_a, p_expectation_b,
    p_rival_pair_confidence_avg_a, p_rival_pair_confidence_avg_b, p_margin, p_format_factor,
    p_availability_factor, p_repetition_factor_a, p_repetition_factor_b, p_companion_factor_a, p_companion_factor_b,
    case when v_existing_applied is not null then v_existing_applied.result_id else null end,
    p_actor_player_id, p_actor_note
  ) returning result_id into v_result_id;

  if v_existing_applied is not null then
    update public.match_level_results set superseded_by_result_id = v_result_id where result_id = v_existing_applied.result_id;
  end if;

  if coalesce(p_eligible, false) then
    insert into public.match_level_result_players (
      result_id, player_id, team, mu_before, confidence_before, evidence_units_before,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      mu_after, confidence_after, evidence_units_after
    )
    select
      v_result_id, (rp->>'playerId')::uuid, rp->>'team',
      (rp->>'muBefore')::numeric, (rp->>'confidenceBefore')::numeric, (rp->>'evidenceUnitsBefore')::numeric,
      (rp->>'effectiveLevel')::numeric, (rp->>'k')::numeric, (rp->>'opponentFactor')::numeric, (rp->>'circleFactor')::numeric,
      (rp->>'deltaRaw')::numeric, (rp->>'deltaCapped')::numeric, (rp->>'evidenceQuality')::numeric,
      (rp->>'muAfter')::numeric, (rp->>'confidenceAfter')::numeric, (rp->>'evidenceUnitsAfter')::numeric
    from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp;
  end if;

  -- ------------------------------------------------------------------
  -- Escribir los valores YA CALCULADOS en level_states, recalcular rated_matches/
  -- distinct_opponents por conteo directo (nunca incremental), avanzar status de forma
  -- MONOTÓNICA (CALIBRADO nunca vuelve a CALIBRANDO por una suspensión temporal; RECALIBRANDO
  -- no es tocado por Bloque 6, fuera de su alcance).
  -- ------------------------------------------------------------------
  v_event_type := case p_trigger
    when 'initial' then 'match_delta'
    when 'correction_accepted' then 'match_correction_reapply'
    else 'identity_reassignment_delta'
  end;

  for v_update in select * from jsonb_array_elements(coalesce(p_level_state_updates, '[]'::jsonb))
  loop
    v_player_id := (v_update->>'playerId')::uuid;
    select * into v_current_level_state from public.level_states where player_id = v_player_id;

    select count(distinct mlr.match_id) into v_new_rated_matches
    from public.match_level_result_players mlrp
    join public.match_level_results mlr on mlr.result_id = mlrp.result_id
    where mlrp.player_id = v_player_id and mlr.effect_status = 'applied' and mlr.eligible;

    select count(distinct opp.player_id) into v_new_distinct_opponents
    from public.match_level_result_players mlrp
    join public.match_level_results mlr on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
    join public.match_level_result_players opp on opp.result_id = mlrp.result_id and opp.team <> mlrp.team
    where mlrp.player_id = v_player_id;

    v_new_status := case
      when v_current_level_state.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when v_current_level_state.status = 'CALIBRADO' then 'CALIBRADO'
      when coalesce(v_new_rated_matches, 0) >= 5 and coalesce(v_new_distinct_opponents, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    update public.level_states set
      mu = (v_update->>'finalMu')::numeric,
      confidence = (v_update->>'finalConfidence')::numeric,
      evidence_units = (v_update->>'finalEvidenceUnits')::numeric,
      rated_matches = coalesce(v_new_rated_matches, 0),
      distinct_opponents = coalesce(v_new_distinct_opponents, 0),
      status = v_new_status,
      algorithm_version = p_algorithm_version,
      last_rated_at = now(),
      updated_at = now()
    where player_id = v_player_id;

    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    values (
      v_player_id, v_event_type, p_algorithm_version, p_match_id, v_result_id,
      jsonb_build_object(
        'muAfter', (v_update->>'finalMu')::numeric,
        'confidenceAfter', (v_update->>'finalConfidence')::numeric,
        'evidenceUnitsAfter', (v_update->>'finalEvidenceUnits')::numeric,
        'statusAfter', v_new_status
      )
    );
  end loop;

  -- ------------------------------------------------------------------
  -- match_actions / notifications / pilot_events
  -- ------------------------------------------------------------------
  v_action_type := case p_trigger
    when 'initial' then 'validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'participant_replaced'
    else 'participant_unidentified'
  end;
  v_notification_type := case p_trigger
    when 'initial' then 'match_validated'
    when 'correction_accepted' then 'correction_accepted'
    when 'identity_resolved' then 'identity_resolved'
    else 'identity_unidentified'
  end;

  insert into public.match_actions (match_id, action_type, actor_player_id, acting_side, revision_id, metadata)
  values (p_match_id, v_action_type, coalesce(p_actor_player_id, v_match.created_by_player_id), null, p_revision_id, coalesce(p_reason_codes, '[]'::jsonb));

  insert into public.notifications (player_id, type, match_id, payload)
  select mp.player_id, v_notification_type, p_match_id, '{}'::jsonb
  from public.match_participants mp
  where mp.match_id = p_match_id and mp.player_id is not null;

  if p_trigger = 'initial' then
    update public.matches set
      status = 'validated',
      validated_at = coalesce(validated_at, now()),
      action_side = null,
      updated_at = now()
    where match_id = p_match_id;

    insert into public.pilot_events (event_name, player_id, properties)
    values ('match_validated', v_match.created_by_player_id, jsonb_build_object('matchId', p_match_id));
  end if;

  select jsonb_build_object('ok', true, 'resultId', v_result_id, 'eligible', coalesce(p_eligible, false)) into v_result;
  return v_result;
end;
$$;

comment on function public.officialize_match_validation is
  'Núcleo único de oficialización/corrección/identidad de Bloque 6. No recalcula nada — toda la
   matemática (motor JS compartido, incluida la diferencia neta) ya la hizo la Edge Function con
   bramulab/match-level-engine.js. SOLO service_role. Idempotente por (match_id, revision_id,
   trigger, composición de jugadores). Ver 02_Analisis_Claude.md §3.1-§3.3.';

revoke all on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb
) from public;
grant execute on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb
) to service_role;
