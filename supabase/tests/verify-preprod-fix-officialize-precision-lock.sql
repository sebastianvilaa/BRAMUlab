-- BRAMUlab — Fix P0 precisión de oficialización (handoff 23, 26/09/2026) — verificación
-- transaccional segura de 20260927140000_preprod_fix_officialize_precision_lock.sql (el
-- optimistic lock de officialize_match_validation pasa de igualdad EXACTA a igualdad redondeada
-- a 4 decimales, INTERNAL_DECIMALS de level.js). Requiere Bloques 1-8 aplicados. No deja
-- fixtures: toda mutación ocurre entre BEGIN/ROLLBACK, mismo criterio que
-- verify-bloque6-public-match-outcomes.sql (llama officialize_match_validation directo, SOLO
-- service_role/SECURITY DEFINER, no depende de auth.uid() ni de una sesión real).
--
-- Reproduce el caso REAL de Staging citado en el handoff (partido aa41e8d9-..., jugador
-- 98442582-8440-4076-b028-1681c0f33906): level_states.evidence_units persistido
-- 2.4797000000000004, payload recalculado en JS con la variante IEEE-754 vecina
-- 2.4797000000000002 — el mismo valor de negocio, un artefacto de representación, nunca un
-- cambio real de Nivel.
--
-- Cubre exactamente los 5 puntos pedidos por el handoff §8 "Tests obligatorios / SQL / Staging":
--   1) estado DB (level_states) con un decimal largo equivalente a 4 decimales;
--   2) payload JS/caller con la variante IEEE-754 vecina;
--   3) NO debe devolver stale_level_snapshot (el fix real);
--   4) una diferencia REAL > precisión interna sí debe devolver stale_level_snapshot (el lock
--      sigue vivo, nunca se elimina);
--   5) rollback limpio (BEGIN/ROLLBACK, sin fixtures residuales).
--
-- Además prueba explícitamente los 3 campos del lock (mu, confidence, evidence_units, "mismo
-- criterio" pedido por el handoff §5.A) y que la ausencia de mismatch real en 2 de los 3 campos
-- nunca enmascara un mismatch real en el tercero.

begin;

create temporary table _oplk_state (k text primary key, v uuid) on commit drop;

-- ------------------------------------------------------------------
-- Fixtures: 3 jugadores reales (A_OK y A_STALE son los que disparan cada caso del lock; B es el
-- rival común, sin level_state propio — no participa de p_level_state_updates en ningún caso).
-- ------------------------------------------------------------------

do $$
declare
  v_player_ok uuid;
  v_player_stale uuid;
  v_player_b uuid;
begin
  insert into public.players (display_name) values ('OPLK Jugador Precision OK') returning player_id into v_player_ok;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_ok, 'oplk_precision_ok', 'OPLK', 'Precision OK', 'OPLK Jugador Precision OK');

  insert into public.players (display_name) values ('OPLK Jugador Precision Stale') returning player_id into v_player_stale;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_stale, 'oplk_precision_stale', 'OPLK', 'Precision Stale', 'OPLK Jugador Precision Stale');

  insert into public.players (display_name) values ('OPLK Rival Comun') returning player_id into v_player_b;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_b, 'oplk_rival_comun', 'OPLK', 'Rival Comun', 'OPLK Rival Comun');

  insert into _oplk_state (k, v) values ('player_ok', v_player_ok), ('player_stale', v_player_stale), ('player_b', v_player_b);

  -- Caso 1) estado DB (level_states) con el decimal largo real reportado en el handoff —
  -- Postgres `numeric` es precisión arbitraria: este literal se persiste EXACTO, sin ningún
  -- redondeo de por medio (a diferencia de un float64 en JS).
  insert into public.level_states (player_id, status, mu, confidence, evidence_units, rated_matches, distinct_opponents)
    values (v_player_ok, 'CALIBRADO', 5.1234000000000004, 0.6000000000000004, 2.4797000000000004, 5, 3);

  -- Jugador del caso "diferencia real": valores limpios de referencia (5.1234 / 0.6000 / 2.4797).
  insert into public.level_states (player_id, status, mu, confidence, evidence_units, rated_matches, distinct_opponents)
    values (v_player_stale, 'CALIBRADO', 5.1234, 0.6000, 2.4797, 5, 3);
end $$;

-- ------------------------------------------------------------------
-- Caso A — NO debe devolver stale_level_snapshot: el payload trae la variante IEEE-754 VECINA
-- del handoff (2.4797000000000002, mismos "vecinos" también para mu/confidence) — el mismo
-- valor de negocio que el DB, con ruido de representación en decimales muy por debajo de la
-- precisión normativa (4 decimales). Antes del fix esto SIEMPRE rechazaba; con el fix debe
-- resolver ok:true.
-- ------------------------------------------------------------------

do $$
declare
  v_player_ok uuid := (select v from _oplk_state where k = 'player_ok');
  v_player_b uuid := (select v from _oplk_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
  v_level_state_updates jsonb;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_ok, 'oplk-fp-match-ok', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_ok, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_ok, 'OPLK Jugador Precision OK'),
    (v_match_id, 'B', 1, v_player_b, 'OPLK Rival Comun');

  insert into _oplk_state (k, v) values ('match_ok', v_match_id);

  v_level_state_updates := jsonb_build_array(jsonb_build_object(
    'playerId', v_player_ok,
    -- Variante IEEE-754 vecina EXACTA del handoff (§3): mismo valor de negocio que
    -- level_states.evidence_units (2.4797000000000004), difiere solo en el último dígito
    -- binario representable — round(...,4) de ambos da 2.4797.
    'currentMuForLock', 5.1234000000000002,
    'currentConfidenceForLock', 0.6000000000000002,
    'currentEvidenceUnitsForLock', 2.4797000000000002,
    'finalMu', 5.1234, 'finalConfidence', 0.6000, 'finalEvidenceUnits', 2.4797
  ));

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_player_ok, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["oplk_test_fixture"]'::jsonb, p_algorithm_version := 'oplk_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := v_level_state_updates,
    p_winner_team := null
  ) into v_result;

  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'CASO_A_FAILED_esperaba_ok_true_obtuvo: %', v_result;
  end if;
  if v_result->>'code' = 'stale_level_snapshot' then
    raise exception 'CASO_A_FAILED_stale_level_snapshot_no_debia_dispararse_el_fix_no_esta_aplicado: %', v_result;
  end if;

  -- Confirma que sí escribió (el camino "éxito" es real, no un early-return disfrazado).
  if not exists (
    select 1 from public.level_states where player_id = v_player_ok and round(evidence_units, 4) = 2.4797
  ) then
    raise exception 'CASO_A_FAILED_level_states_no_quedo_escrito_como_2_4797';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso B — SÍ debe devolver stale_level_snapshot: diferencia REAL (> precisión interna de 4
-- decimales) en evidence_units. El lock sigue vivo — nunca se elimina, solo deja de rechazar
-- ruido de representación.
-- ------------------------------------------------------------------

do $$
declare
  v_player_stale uuid := (select v from _oplk_state where k = 'player_stale');
  v_player_b uuid := (select v from _oplk_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
  v_level_state_updates jsonb;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_stale, 'oplk-fp-match-stale', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_stale, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_stale, 'OPLK Jugador Precision Stale'),
    (v_match_id, 'B', 1, v_player_b, 'OPLK Rival Comun');

  insert into _oplk_state (k, v) values ('match_stale', v_match_id);

  -- mu/confidence limpios y coincidentes (para aislar que la única causa de rechazo es
  -- evidence_units) — diferencia real de 0.0003, muy por encima de la resolución de 4 decimales.
  v_level_state_updates := jsonb_build_array(jsonb_build_object(
    'playerId', v_player_stale,
    'currentMuForLock', 5.1234,
    'currentConfidenceForLock', 0.6000,
    'currentEvidenceUnitsForLock', 2.4800,
    'finalMu', 5.1234, 'finalConfidence', 0.6000, 'finalEvidenceUnits', 2.4800
  ));

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_player_stale, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["oplk_test_fixture"]'::jsonb, p_algorithm_version := 'oplk_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := v_level_state_updates,
    p_winner_team := null
  ) into v_result;

  if coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'CASO_B_FAILED_esperaba_ok_false_stale_level_snapshot_obtuvo: %', v_result;
  end if;
  if v_result->>'code' <> 'stale_level_snapshot' then
    raise exception 'CASO_B_FAILED_esperaba_code_stale_level_snapshot_obtuvo: %', v_result;
  end if;
  if (v_result->>'playerId')::uuid <> v_player_stale then
    raise exception 'CASO_B_FAILED_playerId_del_rechazo_no_coincide: %', v_result;
  end if;

  -- El rechazo no debe haber escrito NADA — mismo comportamiento de siempre, el lock rechaza
  -- ANTES de cualquier mutación.
  if exists (
    select 1 from public.level_states where player_id = v_player_stale and evidence_units <> 2.4797
  ) then
    raise exception 'CASO_B_FAILED_level_states_se_modifico_pese_al_rechazo';
  end if;
  if exists (select 1 from public.matches where match_id = v_match_id and status = 'validated') then
    raise exception 'CASO_B_FAILED_match_quedo_validated_pese_al_rechazo';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso C — mu/confidence con diferencia REAL también disparan stale_level_snapshot (mismo
-- criterio pedido por el handoff para los 3 campos, no solo evidence_units) — probado sobre el
-- mismo jugador OK reusando su match ya validated no es posible (ya es 'validated' tras el
-- Caso A); se prueba con un jugador/match nuevo para no depender de mutar estado entre casos.
-- ------------------------------------------------------------------

do $$
declare
  v_player_mu uuid;
  v_player_b uuid := (select v from _oplk_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
  v_level_state_updates jsonb;
begin
  insert into public.players (display_name) values ('OPLK Jugador Mu Stale') returning player_id into v_player_mu;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_mu, 'oplk_mu_stale', 'OPLK', 'Mu Stale', 'OPLK Jugador Mu Stale');
  insert into public.level_states (player_id, status, mu, confidence, evidence_units, rated_matches, distinct_opponents)
    values (v_player_mu, 'CALIBRADO', 5.1234, 0.6000, 2.4797, 5, 3);

  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_mu, 'oplk-fp-match-mu-stale', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_mu, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_revision_id;
  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_mu, 'OPLK Jugador Mu Stale'),
    (v_match_id, 'B', 1, v_player_b, 'OPLK Rival Comun');

  -- mu con diferencia real de 0.01 (>> 4 decimales); confidence/evidence_units limpios y
  -- coincidentes, para aislar que mu por sí solo alcanza para disparar el rechazo.
  v_level_state_updates := jsonb_build_array(jsonb_build_object(
    'playerId', v_player_mu,
    'currentMuForLock', 5.1334,
    'currentConfidenceForLock', 0.6000,
    'currentEvidenceUnitsForLock', 2.4797,
    'finalMu', 5.1334, 'finalConfidence', 0.6000, 'finalEvidenceUnits', 2.4797
  ));

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_player_mu, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["oplk_test_fixture"]'::jsonb, p_algorithm_version := 'oplk_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := v_level_state_updates,
    p_winner_team := null
  ) into v_result;

  if v_result->>'code' <> 'stale_level_snapshot' then
    raise exception 'CASO_C_FAILED_mu_con_diferencia_real_debia_disparar_stale_level_snapshot: %', v_result;
  end if;
end $$;

rollback;

select 'FIX P0 PRECISION — optimistic lock redondeado a 4 decimales OK — rollback limpio' as result;
