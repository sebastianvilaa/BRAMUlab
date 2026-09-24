-- BRAMUlab — Pre-Production P0.1 (revisión central 24/09/2026) — verificación transaccional
-- segura de la migración 20260924110000_bloque6_public_match_outcomes.sql (matches.winner_team +
-- officialize_match_validation(p_winner_team) + get_public_profile.matches_played/matches_won).
-- Requiere Bloques 1-7 + esa migración aplicados. No deja fixtures: toda mutación ocurre entre
-- BEGIN/ROLLBACK, igual que verify-bloque7-fase2.sql.
--
-- Cubre directamente por SQL (sin necesitar la Edge Function ni un JWT real, porque
-- officialize_match_validation es SECURITY DEFINER service_role-only y no depende de auth.uid()):
--   1) un partido oficializado (trigger=initial) persiste winner_team;
--   2) varios partidos oficiales acumulan correctamente en el agregado (played/won);
--   3) un partido pending_validation (nunca oficializado) NO cuenta;
--   4) una corrección aceptada (trigger=correction_accepted) que cambia el resultado ACTUALIZA
--      winner_team — no queda desactualizado con el ganador viejo;
--   5) permisos/firmas: la firma vieja de 26 parámetros de officialize_match_validation ya no
--      existe (el DROP FUNCTION de la migración corrió), la nueva de 27 sigue SOLO service_role,
--      y get_public_profile sigue SOLO authenticated.
--
-- NO cubierto acá (requiere sesión autenticada real / QA de navegador, ver informe §"Revisión
-- central posterior"): la llamada completa a get_public_profile(uuid) a través de su RPC pública
-- (auth.uid()-dependiente) — este archivo verifica la MISMA expresión de agregación que esa RPC
-- usa (copiada literal del LEFT JOIN LATERAL de la migración) directamente contra las tablas,
-- como service_role, para no depender de fabricar una sesión/JWT ni de que ya exista una cuenta
-- real en Staging.

begin;

-- ------------------------------------------------------------------
-- Fixtures mínimos: 2 jugadores reales (sin auth_user_id — no hace falta para nada de lo que
-- se prueba acá), 3 partidos entre ellos.
-- ------------------------------------------------------------------

create temporary table _b6pmo_state (k text primary key, v uuid) on commit drop;

do $$
declare
  v_player_a uuid;
  v_player_b uuid;
begin
  insert into public.players (display_name) values ('B6PMO Player A') returning player_id into v_player_a;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_a, 'b6pmo_player_a', 'Player', 'A', 'B6PMO Player A');

  insert into public.players (display_name) values ('B6PMO Player B') returning player_id into v_player_b;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_player_b, 'b6pmo_player_b', 'Player', 'B', 'B6PMO Player B');

  insert into _b6pmo_state (k, v) values ('player_a', v_player_a), ('player_b', v_player_b);
end $$;

-- ------------------------------------------------------------------
-- Match 1 — A gana. trigger=initial, p_winner_team='A'.
-- ------------------------------------------------------------------

do $$
declare
  v_player_a uuid := (select v from _b6pmo_state where k = 'player_a');
  v_player_b uuid := (select v from _b6pmo_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_a, 'b6pmo-fp-match1', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_a, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_a, 'B6PMO Player A'),
    (v_match_id, 'B', 1, v_player_b, 'B6PMO Player B');

  insert into _b6pmo_state (k, v) values ('match1', v_match_id), ('match1_rev1', v_revision_id);

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_player_a, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["b6pmo_test_fixture"]'::jsonb, p_algorithm_version := 'b6pmo_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := '[]'::jsonb,
    p_winner_team := 'A'
  ) into v_result;

  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'match1_officialize_failed: %', v_result;
  end if;

  if not exists (select 1 from public.matches where match_id = v_match_id and status = 'validated' and winner_team = 'A') then
    raise exception 'match1_winner_team_not_persisted';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Match 2 — A gana otra vez (mismos jugadores). Prueba "varios partidos oficiales".
-- ------------------------------------------------------------------

do $$
declare
  v_player_a uuid := (select v from _b6pmo_state where k = 'player_a');
  v_player_b uuid := (select v from _b6pmo_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_a, 'b6pmo-fp-match2', 'classic', now() - interval '30 minutes', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_a, 'A', 'created', now() - interval '30 minutes')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_a, 'B6PMO Player A'),
    (v_match_id, 'B', 1, v_player_b, 'B6PMO Player B');

  insert into _b6pmo_state (k, v) values ('match2', v_match_id);

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_player_a, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["b6pmo_test_fixture"]'::jsonb, p_algorithm_version := 'b6pmo_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := '[]'::jsonb,
    p_winner_team := 'A'
  ) into v_result;

  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'match2_officialize_failed: %', v_result;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Match 3 — mismos jugadores, queda pending_validation (nunca se oficializa). Prueba
-- "pendientes NO cuentan": ni siquiera necesita winner_team para probar el punto, alcanza con
-- que status nunca sea 'validated'.
-- ------------------------------------------------------------------

do $$
declare
  v_player_a uuid := (select v from _b6pmo_state where k = 'player_a');
  v_player_b uuid := (select v from _b6pmo_state where k = 'player_b');
  v_match_id uuid;
  v_revision_id uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_player_a, 'b6pmo-fp-match3-pending', 'classic', now() - interval '5 minutes', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_player_a, 'A', 'created', now() - interval '5 minutes')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_player_a, 'B6PMO Player A'),
    (v_match_id, 'B', 1, v_player_b, 'B6PMO Player B');

  insert into _b6pmo_state (k, v) values ('match3_pending', v_match_id);
  -- A propósito: nunca se llama a officialize_match_validation para este partido.
end $$;

-- ------------------------------------------------------------------
-- Agregado — MISMA expresión que el LEFT JOIN LATERAL de get_public_profile (copiada literal de
-- la migración, no reinventada acá) contra las tablas directamente, evitando depender de
-- auth.uid()/una sesión real. Esperado tras match1+match2 validated (A gana ambos) + match3
-- pending (excluido): A jugó 2, ganó 2; B jugó 2, ganó 0.
-- ------------------------------------------------------------------

do $$
declare
  v_player_a uuid := (select v from _b6pmo_state where k = 'player_a');
  v_player_b uuid := (select v from _b6pmo_state where k = 'player_b');
  v_played integer;
  v_won integer;
begin
  select count(*), count(*) filter (where m.winner_team = mp.team)
    into v_played, v_won
    from public.match_participants mp
    join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_player_a and m.status = 'validated' and m.winner_team is not null;
  if v_played <> 2 or v_won <> 2 then
    raise exception 'player_a_aggregate_wrong_before_correction: played=% won=%', v_played, v_won;
  end if;

  select count(*), count(*) filter (where m.winner_team = mp.team)
    into v_played, v_won
    from public.match_participants mp
    join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_player_b and m.status = 'validated' and m.winner_team is not null;
  if v_played <> 2 or v_won <> 0 then
    raise exception 'player_b_aggregate_wrong_before_correction: played=% won=%', v_played, v_won;
  end if;

  -- El partido 3 (pending) nunca debe aparecer en ninguno de los dos conteos anteriores — ya
  -- queda probado por los propios totales (2, no 3), pero se deja explícito para que una futura
  -- edición de este archivo no pueda perder de vista el caso "pendientes NO cuentan".
  if exists (
    select 1 from public.matches where match_id = (select v from _b6pmo_state where k = 'match3_pending') and status = 'validated'
  ) then
    raise exception 'match3_should_never_have_been_validated_by_this_test';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Corrección aceptada sobre Match 1: el resultado se corrige y el ganador CAMBIA de A a B.
-- winner_team debe actualizarse — no puede quedar pegado al ganador original.
-- ------------------------------------------------------------------

do $$
declare
  v_player_a uuid := (select v from _b6pmo_state where k = 'player_a');
  v_player_b uuid := (select v from _b6pmo_state where k = 'player_b');
  v_match1 uuid := (select v from _b6pmo_state where k = 'match1');
  v_rev2 uuid;
  v_result jsonb;
  v_played integer;
  v_won integer;
begin
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match1, 2, v_player_b, 'B', 'proposed_correction', now() - interval '1 hour')
    returning revision_id into v_rev2;

  update public.matches set pending_correction_revision_id = v_rev2 where match_id = v_match1;

  select public.officialize_match_validation(
    p_match_id := v_match1, p_revision_id := v_rev2, p_trigger := 'correction_accepted',
    p_actor_player_id := v_player_b, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["b6pmo_test_fixture"]'::jsonb, p_algorithm_version := 'b6pmo_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := '[]'::jsonb,
    p_winner_team := 'B'
  ) into v_result;

  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'match1_correction_failed: %', v_result;
  end if;

  if not exists (
    select 1 from public.matches
    where match_id = v_match1 and winner_team = 'B' and current_revision_id = v_rev2 and pending_correction_revision_id is null
  ) then
    raise exception 'match1_winner_team_not_updated_by_correction';
  end if;

  -- Recalcular el agregado: A ahora jugó 2/ganó 1 (perdió match1 corregido, sigue ganando
  -- match2); B jugó 2/ganó 1 (ganó match1 corregido). Si esto fallara, significaría que
  -- winner_team quedó desactualizado tras la corrección — exactamente el bug que se evita.
  select count(*), count(*) filter (where m.winner_team = mp.team)
    into v_played, v_won
    from public.match_participants mp
    join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_player_a and m.status = 'validated' and m.winner_team is not null;
  if v_played <> 2 or v_won <> 1 then
    raise exception 'player_a_aggregate_wrong_after_correction: played=% won=%', v_played, v_won;
  end if;

  select count(*), count(*) filter (where m.winner_team = mp.team)
    into v_played, v_won
    from public.match_participants mp
    join public.matches m on m.match_id = mp.match_id
    where mp.player_id = v_player_b and m.status = 'validated' and m.winner_team is not null;
  if v_played <> 2 or v_won <> 1 then
    raise exception 'player_b_aggregate_wrong_after_correction: played=% won=%', v_played, v_won;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Seguridad / permisos / firmas.
-- ------------------------------------------------------------------

do $$
begin
  -- La firma VIEJA (26 parámetros, sin p_winner_team) ya no debe existir: confirma que la
  -- migración hizo `drop function` en vez de dejar un segundo overload orgánico coexistiendo.
  if to_regprocedure(
       'public.officialize_match_validation(uuid, uuid, text, uuid, text, boolean, jsonb, text, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid)'
     ) is not null then
    raise exception 'old_officialize_match_validation_signature_still_exists';
  end if;

  if has_function_privilege(
       'public',
       'public.officialize_match_validation(uuid, uuid, text, uuid, text, boolean, jsonb, text, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.officialize_match_validation(uuid, uuid, text, uuid, text, boolean, jsonb, text, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.officialize_match_validation(uuid, uuid, text, uuid, text, boolean, jsonb, text, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text)',
       'EXECUTE'
     ) then
    raise exception 'officialize_match_validation_execute_too_broad';
  end if;
  if not has_function_privilege(
       'service_role',
       'public.officialize_match_validation(uuid, uuid, text, uuid, text, boolean, jsonb, text, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, uuid, text)',
       'EXECUTE'
     ) then
    raise exception 'officialize_match_validation_service_role_execute_missing';
  end if;

  if has_function_privilege('public', 'public.get_public_profile(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_execute_too_broad';
  end if;
  if not has_function_privilege('authenticated', 'public.get_public_profile(uuid)', 'EXECUTE') then
    raise exception 'get_public_profile_authenticated_execute_missing';
  end if;
end $$;

rollback;

select 'BLOQUE 6 — matches.winner_team + get_public_profile.matches_played/matches_won OK — rollback limpio' as result;
