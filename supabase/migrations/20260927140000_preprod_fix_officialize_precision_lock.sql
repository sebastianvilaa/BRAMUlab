-- BRAMUlab — Fix P0 precisión de oficialización (handoff 23, 26/09/2026).
--
-- Causa raíz reproducida por Central contra Staging real (partido aa41e8d9-6d16-4c47-8928-
-- 187c5fad5ccd): la verificación optimista de officialize_match_validation compara mu/
-- confidence/evidence_units con IGUALDAD EXACTA (`is distinct from`) contra los valores que
-- viajaron Postgres NUMERIC -> JSON -> JavaScript Number -> JSON -> NUMERIC. Para el jugador
-- 98442582-8440-4076-b028-1681c0f33906, level_states.evidence_units::text real es
-- 2.4797000000000004; al pasar por JSON/IEEE-754 en JavaScript ese mismo valor se representa
-- como 2.4797000000000002 — un artefacto binario de representación, NO un cambio real de
-- Nivel. La comparación exacta SIEMPRE rechaza ese caso como 'stale_level_snapshot', aunque
-- ningún proceso concurrente haya movido el estado — el core reintenta 3 veces, obtiene el
-- mismo mismatch, y termina en 'stale_snapshot_retries_exhausted' (el HTTP 500 real reportado).
--
-- La fórmula normativa (Nivel_BRAMU_Formula_V1.5.md, level.js#PARAMS.INTERNAL_DECIMALS) ya
-- trabaja con precisión interna de 4 decimales — cualquier diferencia por debajo de esa
-- precisión es ruido de representación, nunca una diferencia real que el propio motor
-- reconozca. Esta migración es ADITIVA: CREATE OR REPLACE sobre la MISMA firma exacta de
-- officialize_match_validation (27 parámetros, sin agregar/quitar ninguno — a diferencia de
-- 20260924110000_bloque6_public_match_outcomes.sql, que sí cambió la firma y por eso necesitó
-- `drop function` antes, acá no hace falta), preservando el 100% del contrato y la lógica.
-- ÚNICO cambio real: la comparación de los 3 locks numéricos pasa de igualdad exacta a
-- igualdad redondeada a la misma precisión interna de 4 decimales que el motor ya usa — el
-- lock sigue detectando cualquier cambio REAL de Nivel (una oficialización/corrección/
-- identidad concurrente que de verdad movió el estado sigue produciendo una diferencia mayor a
-- 4 decimales), solo deja de rechazar diferencias que el propio motor ya considera "el mismo
-- valor". No se elimina el optimistic lock.
--
-- Ver docs/BRAMUlab/Implementacion/Pre_Production/23_Handoff_Fix_P0_Precision_Officialization_26SEP.md
-- y 24_Resultado_Fix_P0_Precision_Officialization_26SEP.md.

create or replace function public.officialize_match_validation(
  p_match_id uuid,
  -- La revisión que ESTE cálculo asume vigente — B6-A-07: bajo lock, debe coincidir con
  -- matches.current_revision_id (initial/identity_*) o matches.pending_correction_revision_id
  -- (correction_accepted). Mismatch => stale_match_revision, cero escritura.
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
  -- [{playerId,team,formulaMuBefore,formulaConfidenceBefore,formulaState,effectiveLevel,k,
  --   opponentFactor,circleFactor,deltaRaw,deltaCapped,evidenceQuality,
  --   muBefore,muAfter,confidenceBefore,confidenceAfter,evidenceUnitsBefore,evidenceUnitsAfter}]
  -- — salida de PLMatchLevelEngine.computeLevelStateUpdates().resultPlayers. Vacío si !p_eligible.
  p_result_players jsonb,
  -- [{playerId,finalMu,finalConfidence,finalEvidenceUnits,currentMuForLock,
  --   currentConfidenceForLock,currentEvidenceUnitsForLock}] — .levelStateUpdates. Incluye TODO
  -- jugador afectado (viejo ∪ nuevo), incluso uno que ya no participa del resultado nuevo
  -- (reversión pura, ver computeLevelStateUpdates).
  p_level_state_updates jsonb,
  -- Bookkeeping atómico específico de trigger (B6-A-08/B6-A-09) — NULL salvo que corresponda.
  -- team/position_in_team del slot NO se reciben como parámetro: se leen de la propia fila de
  -- match_identity_issues (ya bajo lock acá abajo) para que nunca puedan desalinearse de la
  -- incidencia real que se está resolviendo.
  p_identity_issue_id uuid default null,
  p_identity_replacement_player_id uuid default null,
  -- Pre-Production P0.1 (revisión central 24/09/2026) — MISMO winnerTeam que la Edge Function ya
  -- calculó vía match-sync.js#deriveWinnerTeam para localMatch (nunca recalculado acá). Default
  -- null: un caller que todavía no lo pase deja matches.winner_team intacto, nunca lo pisa con
  -- NULL — ver el guard `if p_winner_team is not null` más abajo.
  p_winner_team text default null
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
  v_identity_issue public.match_identity_issues;
  v_result_id uuid;
  v_update jsonb;
  v_player_id uuid;
  v_has_new_row boolean;
  v_current_level_state public.level_states;
  v_new_rated_matches integer;
  v_new_distinct_opponents integer;
  v_new_status text;
  v_new_last_rated_at timestamptz;
  v_event_type text;
  v_action_type text;
  v_notification_type text;
  v_result jsonb;
begin
  if p_trigger not in ('initial', 'correction_accepted', 'identity_resolved', 'identity_unidentified') then
    raise exception 'invalid_trigger' using errcode = 'P0001';
  end if;
  if p_trigger in ('identity_resolved', 'identity_unidentified') and p_identity_issue_id is null then
    raise exception 'identity_issue_id_required' using errcode = 'P0001';
  end if;
  if p_trigger = 'identity_resolved' and p_identity_replacement_player_id is null then
    raise exception 'identity_replacement_player_id_required' using errcode = 'P0001';
  end if;

  select * into v_match from public.matches where match_id = p_match_id for update;
  if v_match is null then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  -- ------------------------------------------------------------------
  -- C-02 — defensa en profundidad para la PRIMERA oficialización.
  -- Solo un partido pending_validation puede crear un resultado initial nuevo. Un partido ya
  -- validated es un estado terminal para este trigger: el reintento de Confirmar se resuelve en
  -- la Edge Function como NO-OP y, aun si algún caller service-role invoca este núcleo directo,
  -- acá nunca se permite que un trigger='initial' pise un resultado posterior de corrección o
  -- identidad. Tampoco estados annulled/expired/etc. pueden oficializarse por accidente.
  -- ------------------------------------------------------------------
  if p_trigger = 'initial' then
    if v_match.status = 'validated' then
      return jsonb_build_object('ok', false, 'code', 'already_validated');
    end if;
    if v_match.status <> 'pending_validation' then
      return jsonb_build_object('ok', false, 'code', 'match_not_actionable');
    end if;
    if v_match.action_side is not null then
      return jsonb_build_object('ok', false, 'code', 'not_ready_for_validation');
    end if;
    if v_match.validation_deadline_at is null or now() > v_match.validation_deadline_at then
      return jsonb_build_object('ok', false, 'code', 'match_expired');
    end if;
    if exists (select 1 from public.match_identity_issues where match_id = p_match_id and status = 'open') then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_open');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-07 — verificación de REVISIÓN esperada, distinta y adicional a la de snapshots de
  -- Nivel: protege contra oficializar/reaplicar sobre una revisión que ya dejó de ser la
  -- correcta para este trigger (p. ej. una nueva corrección pre-validación se coló entre que la
  -- Edge Function leyó el snapshot y llamó acá).
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    if v_match.pending_correction_revision_id is null or v_match.pending_correction_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  else
    if v_match.current_revision_id is null or v_match.current_revision_id <> p_revision_id then
      return jsonb_build_object('ok', false, 'code', 'stale_match_revision');
    end if;
  end if;

  -- ------------------------------------------------------------------
  -- B6-A-09 — para triggers de identidad, la incidencia debe seguir open bajo lock: protege
  -- contra una resolución concurrente duplicada o una ya vencida/materializada por otro camino.
  -- ------------------------------------------------------------------
  if p_trigger in ('identity_resolved', 'identity_unidentified') then
    select * into v_identity_issue from public.match_identity_issues where issue_id = p_identity_issue_id for update;
    if v_identity_issue is null or v_identity_issue.status <> 'open' then
      return jsonb_build_object('ok', false, 'code', 'identity_issue_not_open');
    end if;
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

  if v_existing_applied.result_id is not null and v_existing_applied.revision_id = p_revision_id and v_existing_applied.trigger = p_trigger then
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
  --
  -- Fix P0 precisión (handoff 23, 26/09/2026) — la comparación pasa de igualdad EXACTA
  -- (`is distinct from` directo sobre el numeric crudo) a igualdad redondeada a
  -- INTERNAL_DECIMALS=4 (level.js#PARAMS.INTERNAL_DECIMALS, la misma precisión interna que la
  -- fórmula normativa ya usa para todo su pipeline — Nivel_BRAMU_Formula_V1.5.md). El valor
  -- persistido en `level_states` y el valor recibido en `p_level_state_updates` viajan por
  -- Postgres NUMERIC -> JSON -> JavaScript Number -> JSON -> NUMERIC; esa ida y vuelta puede
  -- introducir un artefacto binario IEEE-754 en los decimales MÁS ALLÁ del cuarto (ej.
  -- 2.4797000000000004 vs. 2.4797000000000002 — el mismo valor de negocio, una diferencia de
  -- representación, nunca un cambio real). Redondear ambos lados a 4 decimales antes de
  -- comparar es fiel a la propia precisión que el motor ya declara como su resolución interna
  -- — nunca una tolerancia arbitraria inventada acá. El lock sigue rechazando cualquier
  -- diferencia REAL (>= 0.0001): una oficialización/corrección/identidad concurrente que de
  -- verdad movió mu/confidence/evidence_units sigue produciendo `stale_level_snapshot` como
  -- corresponde. `4` es literal (SQL no puede importar la constante JS) — si
  -- INTERNAL_DECIMALS cambia algún día en level.js, esta función debe actualizarse junto con
  -- ese cambio normativo.
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
       or round(v_current_level_state.mu, 4) is distinct from round((v_update->>'currentMuForLock')::numeric, 4)
       or round(v_current_level_state.confidence, 4) is distinct from round((v_update->>'currentConfidenceForLock')::numeric, 4)
       or round(coalesce(v_current_level_state.evidence_units, 0), 4) is distinct from round(coalesce((v_update->>'currentEvidenceUnitsForLock')::numeric, 0), 4)
    then
      return jsonb_build_object('ok', false, 'code', 'stale_level_snapshot', 'playerId', v_player_id);
    end if;
  end loop;

  -- ------------------------------------------------------------------
  -- Revertir el resultado anterior vigente (si existe) — nunca se borra, se marca reverted.
  --
  -- B6-B-02: acá NO se escribe un level_events por jugador. Todo jugador del resultado anterior
  -- (viejo ∪ nuevo, ver PLMatchLevelEngine.computeLevelStateUpdates) recibe MÁS ABAJO, en la
  -- MISMA transacción, un evento único con el snapshot post-operación COMPLETO — un segundo
  -- evento acá, con el mismo `created_at` de transacción (now() es fijo por transacción en
  -- Postgres) y solo `{revertedResultId}`, competía por el desempate de
  -- get_player_level_state_as_of y podía devolver un estado roto. El resultado revertido sigue
  -- siendo auditable por match_level_results.reverses_result_id/superseded_by_result_id.
  -- ------------------------------------------------------------------
  if v_existing_applied.result_id is not null then
    update public.match_level_results
      set effect_status = 'reverted', reverted_at = now()
      where result_id = v_existing_applied.result_id;
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
    case when v_existing_applied.result_id is not null then v_existing_applied.result_id else null end,
    p_actor_player_id, p_actor_note
  ) returning result_id into v_result_id;

  if v_existing_applied.result_id is not null then
    update public.match_level_results set superseded_by_result_id = v_result_id where result_id = v_existing_applied.result_id;
  end if;

  if coalesce(p_eligible, false) then
    -- C-01: original_live_*_before es el baseline LIVE INMUTABLE de este partido/jugador
    -- (se propaga sin cambios entre correcciones); mu_after/confidence_after son el valor
    -- ABSOLUTO de fórmula de ESTA aplicación puntual (nunca el LIVE contaminado por partidos
    -- posteriores) — ver PLMatchLevelEngine.computeLevelStateUpdates.
    insert into public.match_level_result_players (
      result_id, player_id, team,
      formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before,
      mu_after, confidence_after
    )
    select
      v_result_id, (rp->>'playerId')::uuid, rp->>'team',
      (rp->>'formulaMuBefore')::numeric, (rp->>'formulaConfidenceBefore')::numeric, rp->>'formulaState',
      (rp->>'effectiveLevel')::numeric, (rp->>'k')::numeric, (rp->>'opponentFactor')::numeric, (rp->>'circleFactor')::numeric,
      (rp->>'deltaRaw')::numeric, (rp->>'deltaCapped')::numeric, (rp->>'evidenceQuality')::numeric,
      (rp->>'originalLiveMuBefore')::numeric, (rp->>'originalLiveConfidenceBefore')::numeric, (rp->>'originalLiveEvidenceUnitsBefore')::numeric,
      (rp->>'muAfter')::numeric, (rp->>'confidenceAfter')::numeric
    from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp;
  end if;

  -- ------------------------------------------------------------------
  -- B6-B-06 — para identity_resolved, el reemplazo de participante debe quedar escrito ANTES de
  -- recalcular rated_matches/distinct_opponents (loop de abajo): si no, el conteo de los propios
  -- RIVALES del jugador reemplazado podía leer ese slot todavía NULL/con el jugador viejo. Ocurre
  -- en la MISMA transacción que todo lo demás — si algo falla después, Postgres revierte todo.
  -- B6-B-04: el fingerprint se actualiza inmediatamente después, atómicamente.
  -- ------------------------------------------------------------------
  if p_trigger = 'identity_resolved' then
    update public.match_participants set
      player_id = p_identity_replacement_player_id,
      display_name_snapshot = coalesce((select display_name from public.players where player_id = p_identity_replacement_player_id), 'Jugador')
    where match_id = p_match_id and team = v_identity_issue.team and position_in_team = v_identity_issue.position_in_team;

    perform public._bloque6_refresh_participant_fingerprint(p_match_id);
  end if;

  -- ------------------------------------------------------------------
  -- Escribir los valores YA CALCULADOS en level_states. B6-A-11: distinct_opponents cuenta
  -- CUALQUIER player_id rival de match_participants (registrado o provisional, nunca un slot
  -- NULL) de partidos con resultado applied+eligible — no exige que el rival tenga su propia
  -- fila en match_level_result_players. B6-A-12: status se deriva de la evidencia oficial
  -- VIGENTE, nunca monotónico (una corrección/incidencia que retira evidencia puede devolver
  -- CALIBRADO -> CALIBRANDO; RECALIBRANDO conserva su semántica propia, fuera de Bloque 6).
  -- B6-A-13: last_rated_at es actividad deportiva computable (played_at del partido), nunca
  -- hora de escritura — y para un jugador cuya contribución a ESTE partido se retira sin
  -- reemplazo (reversión pura dentro de esta misma operación), se recompone como el máximo
  -- played_at de sus resultados applied+eligible restantes.
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

    v_has_new_row := exists (
      select 1 from jsonb_array_elements(coalesce(p_result_players, '[]'::jsonb)) rp
      where (rp->>'playerId')::uuid = v_player_id
    );

    select count(distinct mlr.match_id) into v_new_rated_matches
    from public.match_level_result_players mlrp
    join public.match_level_results mlr on mlr.result_id = mlrp.result_id
    where mlrp.player_id = v_player_id and mlr.effect_status = 'applied' and mlr.eligible;

    select count(distinct opp.player_id) into v_new_distinct_opponents
    from public.match_participants self_p
    join public.match_participants opp
      on opp.match_id = self_p.match_id and opp.team <> self_p.team and opp.player_id is not null
    join public.match_level_results mlr
      on mlr.match_id = self_p.match_id and mlr.effect_status = 'applied' and mlr.eligible
    where self_p.player_id = v_player_id;

    v_new_status := case
      when v_current_level_state.status = 'RECALIBRANDO' then 'RECALIBRANDO'
      when coalesce(v_new_rated_matches, 0) >= 5 and coalesce(v_new_distinct_opponents, 0) >= 3 then 'CALIBRADO'
      else 'CALIBRANDO'
    end;

    if v_has_new_row then
      v_new_last_rated_at := greatest(coalesce(v_current_level_state.last_rated_at, v_match.played_at), v_match.played_at);
    else
      -- Reversión pura sin reemplazo en esta misma operación (p. ej. identidad retirada):
      -- last_rated_at nunca puede caer por debajo del ancla inicial del cuestionario (C-09).
      -- Se recompone con la actividad computable restante y, como piso temporal real, el
      -- initial_estimate que creó el primer Nivel del jugador.
      select greatest(
        (
          select max(m.played_at)
          from public.match_level_result_players mlrp
          join public.match_level_results mlr on mlr.result_id = mlrp.result_id and mlr.effect_status = 'applied' and mlr.eligible
          join public.matches m on m.match_id = mlr.match_id
          where mlrp.player_id = v_player_id
        ),
        (
          select max(le.created_at)
          from public.level_events le
          where le.player_id = v_player_id and le.event_type = 'initial_estimate'
        )
      ) into v_new_last_rated_at;
    end if;

    update public.level_states set
      mu = (v_update->>'finalMu')::numeric,
      confidence = (v_update->>'finalConfidence')::numeric,
      evidence_units = (v_update->>'finalEvidenceUnits')::numeric,
      rated_matches = coalesce(v_new_rated_matches, 0),
      distinct_opponents = coalesce(v_new_distinct_opponents, 0),
      status = v_new_status,
      algorithm_version = p_algorithm_version,
      last_rated_at = v_new_last_rated_at,
      updated_at = now()
    where player_id = v_player_id;

    insert into public.level_events (player_id, event_type, algorithm_version, match_id, match_level_result_id, result)
    values (
      v_player_id, v_event_type, p_algorithm_version, p_match_id, v_result_id,
      jsonb_build_object(
        'muAfter', (v_update->>'finalMu')::numeric,
        'confidenceAfter', (v_update->>'finalConfidence')::numeric,
        'evidenceUnitsAfter', (v_update->>'finalEvidenceUnits')::numeric,
        'statusAfter', v_new_status,
        -- B6-B-02: imprescindible para que get_player_level_state_as_of pueda devolver lastRatedAt.
        'lastRatedAtAfter', v_new_last_rated_at
      )
    );
  end loop;

  -- ------------------------------------------------------------------
  -- B6-A-08/B6-A-09 — bookkeeping atómico específico de trigger, en la MISMA transacción que
  -- ya aplicó/revirtió Nivel: nunca queda un estado a medias entre "el resultado/participante ya
  -- cambió" y "Nivel todavía no". La reasignación de match_participants de identity_resolved ya
  -- ocurrió ARRIBA (B6-B-06, antes de recalcular distinct_opponents) — acá solo cierra la
  -- incidencia, enlazando el resultado recién calculado.
  -- ------------------------------------------------------------------
  if p_trigger = 'correction_accepted' then
    update public.matches set
      current_revision_id = p_revision_id,
      pending_correction_revision_id = null,
      updated_at = now()
    where match_id = p_match_id;
  elsif p_trigger = 'identity_resolved' then
    update public.match_identity_issues set
      status = 'resolved', resolved_player_id = p_identity_replacement_player_id, resolved_at = now(),
      reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  elsif p_trigger = 'identity_unidentified' then
    update public.match_identity_issues set
      status = 'unidentified', resolved_at = now(), reapplied_result_id = v_result_id, updated_at = now()
    where issue_id = p_identity_issue_id;
  end if;

  -- ------------------------------------------------------------------
  -- Pre-Production P0.1 (revisión central 24/09/2026) — único agregado real de esta migración:
  -- persiste el winnerTeam que la Edge Function ya calculó (nunca lo recalcula), para los 4
  -- triggers por igual. `is not null` protege contra un caller viejo que todavía no lo pase: deja
  -- matches.winner_team exactamente como estaba, nunca lo pisa con NULL por omisión.
  -- ------------------------------------------------------------------
  if p_winner_team is not null then
    update public.matches set winner_team = p_winner_team, updated_at = now() where match_id = p_match_id;
  end if;

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
   matemática (motor JS compartido, incluida la diferencia neta y el winnerTeam) ya la hizo la
   Edge Function con bramulab/match-level-engine.js/match-sync.js. SOLO service_role. Idempotente
   por (match_id, revision_id, trigger, composición de jugadores). Verifica revisión esperada
   (B6-A-07) y hace atómico el bookkeeping de corrección/identidad con la aplicación de Nivel
   (B6-A-08/B6-A-09). Para identity_resolved, reasigna el participante + refresca el fingerprint
   ANTES de recalcular distinct_opponents (B6-B-06/B6-B-04). Pre-Production P0.1 (24/09/2026)
   agrega `p_winner_team` (default null, compatible): persiste en matches.winner_team el mismo
   valor ya calculado por match-sync.js#deriveWinnerTeam, para los 4 triggers por igual — nunca
   una segunda regla de victoria. Fix P0 precisión (26/09/2026, handoff 23): el optimistic lock
   de mu/confidence/evidence_units compara redondeado a 4 decimales (INTERNAL_DECIMALS de
   level.js), no con igualdad exacta — evita falsos stale_level_snapshot por artefactos de
   representación IEEE-754 al viajar NUMERIC->JSON->Number->JSON->NUMERIC, sin dejar de
   detectar cambios reales de Nivel. Ver 02_Analisis_Claude.md §3.1-§3.3, 06_Revision_Fase_A_
   ChatGPT.md, 08_Revision_Central_Adicional.md, el informe de Pre-Production P0.1/P0.1B
   (08_Resultado_P0_1_Ranking_Automatico_Claude.md) y 24_Resultado_Fix_P0_Precision_
   Officialization_26SEP.md.';

revoke all on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text
) from public;
grant execute on function public.officialize_match_validation(
  uuid, uuid, text, uuid, text, boolean, jsonb, text, integer,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text
) to service_role;
