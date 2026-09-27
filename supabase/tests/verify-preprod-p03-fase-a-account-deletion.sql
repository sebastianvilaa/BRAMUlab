-- BRAMUlab — P0.3 Fase A: verificación transaccional segura de
-- 20260927150000_preprod_p03_fase_a_account_deletion.sql (admin_delete_player_account). Requiere
-- Bloques 1-8 aplicados Y al menos UNA cuenta real registrada con sesión (auth_user_id no nulo,
-- perfil con username) ya existente en el entorno — mismo requisito que
-- verify-preprod-ux-mis-jugadores.sql, usada como CALLER real para ejercitar search_players/
-- get_public_profile (ambas exigen auth.uid() -> players.auth_user_id real; no se fabrica un
-- auth_user_id falso, players.auth_user_id tiene FK real a auth.users). No deja fixtures: toda
-- mutación ocurre entre BEGIN/ROLLBACK, mismo criterio que
-- verify-bloque6-public-match-outcomes.sql/verify-preprod-fix-officialize-precision-lock.sql.
--
-- Cubre los 10 riesgos del handoff 26 §5:
--   1) usuario eliminado no vuelve a autenticarse -> FUERA DE ALCANCE de este verify (depende
--      del Paso 1/Auth, no implementado en esta fase — ver el documento de resultado). Lo que SÍ
--      se prueba acá es la consecuencia del lado de datos: is_active=false + username=null
--      dejan al jugador estructuralmente inutilizable por cualquier RPC de sesión/búsqueda.
--   2) nombre/email/teléfono/avatar/PII no quedan disponibles en superficies ordinarias
--      (search_players/get_public_profile reales, con sesión simulada);
--   3) partidos compartidos de B/C/D permanecen (matches/sets/revisiones intactos);
--   4) participantes históricos siguen estructuralmente válidos (match_participants.player_id
--      de A se PRESERVA, solo cambia el nombre);
--   5) Nivel/Ranking/Intelligence históricos de TERCEROS no se corrompen (level_states/
--      level_events de B intactos; intelligence_match_outputs de B se invalida -- ver nota --
--      pero eso es intencional y documentado, nunca corrompido);
--   6) búsquedas no devuelven al jugador eliminado como jugador activo (search_players real);
--   7) relaciones personales/listas dejan de tratarlo como activo (player_saved_players/
--      ranking_network_hidden en ambas direcciones);
--   8) repetición de la operación no duplica ni rompe nada (idempotencia real, 2da llamada);
--   9) usuario común no puede ejecutar la operación (permisos anon/authenticated);
--  10) no quedan fixtures al terminar el verify (rollback limpio).

begin;

create temporary table _p03_caller on commit drop as
select pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _p03_caller) <> 1 then
    raise exception 'verify_p03_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _p03_state (k text primary key, v uuid) on commit drop;

-- ------------------------------------------------------------------
-- Fixtures: 4 jugadores reales (A se elimina; B es su compañero de equipo, comparte el partido y
-- listas personales con A; C/D son los rivales — C también guarda a A en su lista personal y lo
-- oculta de Mi red, para probar la dirección "saved_player_id"/"hidden_player_id"). A tiene perfil
-- completo (avatar, teléfono, WhatsApp, categoría, ubicación) para poder confirmar que TODO se
-- anonimiza. Un quinto jugador PROV es un provisional, para probar el guard de tipo.
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_prov uuid; v_loc uuid;
begin
  select location_id into v_loc from public.locations limit 1;

  insert into public.players (display_name) values ('P03 Jugador A') returning player_id into v_a;
  insert into public.profiles (
    player_id, username, first_name, last_name, display_name, avatar_url, birth_date, gender,
    dominant_hand, preferred_side, competitive_branch, location_id, phone, allow_whatsapp_contact,
    current_category, current_category_at, ranking_opt_in
  ) values (
    v_a, 'p03_jugador_a', 'P03', 'Jugador A', 'P03 Jugador A', 'avatars/p03-a.jpg', '1990-01-01',
    'masculino', 'derecha', 'drive', 'M', v_loc, '5491122334455', true, '4', now(), true
  );

  insert into public.players (display_name) values ('P03 Jugador B') returning player_id into v_b;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_b, 'p03_jugador_b', 'P03', 'Jugador B', 'P03 Jugador B');

  insert into public.players (display_name) values ('P03 Jugador C') returning player_id into v_c;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_c, 'p03_jugador_c', 'P03', 'Jugador C', 'P03 Jugador C');

  insert into public.players (display_name) values ('P03 Jugador D') returning player_id into v_d;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_d, 'p03_jugador_d', 'P03', 'Jugador D', 'P03 Jugador D');

  insert into public.players (display_name, type) values ('P03 Provisional', 'provisional') returning player_id into v_prov;

  insert into public.level_states (player_id, status, mu, confidence, evidence_units, rated_matches, distinct_opponents)
    values (v_a, 'CALIBRADO', 6.5, 0.7, 3.0, 6, 4);
  insert into public.level_states (player_id, status, mu, confidence, evidence_units, rated_matches, distinct_opponents)
    values (v_b, 'CALIBRADO', 5.5, 0.65, 2.5, 5, 3);

  insert into _p03_state (k, v) values
    ('a', v_a), ('b', v_b), ('c', v_c), ('d', v_d), ('prov', v_prov);
end $$;

-- ------------------------------------------------------------------
-- Partido compartido A+B vs C+D, oficializado (initial, p_eligible=false para no depender del
-- payload completo del motor — mismo patrón que verify-bloque6-public-match-outcomes.sql).
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from _p03_state where k = 'a');
  v_b uuid := (select v from _p03_state where k = 'b');
  v_c uuid := (select v from _p03_state where k = 'c');
  v_d uuid := (select v from _p03_state where k = 'd');
  v_match_id uuid;
  v_revision_id uuid;
  v_result jsonb;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, validation_deadline_at)
    values (v_a, 'p03-fp-match1', 'classic', now() - interval '1 hour', now() + interval '13 days')
    returning match_id into v_match_id;

  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match_id, 1, v_a, 'A', 'created', now() - interval '1 hour')
    returning revision_id into v_revision_id;

  update public.matches set current_revision_id = v_revision_id where match_id = v_match_id;

  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match_id, 'A', 1, v_a, 'P03 Jugador A'),
    (v_match_id, 'A', 2, v_b, 'P03 Jugador B'),
    (v_match_id, 'B', 1, v_c, 'P03 Jugador C'),
    (v_match_id, 'B', 2, v_d, 'P03 Jugador D');

  insert into _p03_state (k, v) values ('match1', v_match_id);

  select public.officialize_match_validation(
    p_match_id := v_match_id, p_revision_id := v_revision_id, p_trigger := 'initial',
    p_actor_player_id := v_a, p_actor_note := null,
    p_eligible := false, p_reason_codes := '["p03_test_fixture"]'::jsonb, p_algorithm_version := 'p03_test_v0',
    p_known_levels_count := null,
    p_team_strength_a := null, p_team_strength_b := null, p_expectation_a := null, p_expectation_b := null,
    p_rival_pair_confidence_avg_a := null, p_rival_pair_confidence_avg_b := null,
    p_margin := null, p_format_factor := null, p_availability_factor := null,
    p_repetition_factor_a := null, p_repetition_factor_b := null, p_companion_factor_a := null, p_companion_factor_b := null,
    p_result_players := '[]'::jsonb, p_level_state_updates := '[]'::jsonb,
    p_winner_team := 'A'
  ) into v_result;

  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'FIXTURE_FAILED_officialize: %', v_result;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Resto de fixtures: notificación de A, nota privada de A, Intelligence de A y de B sobre el
-- MISMO partido (para probar que se invalida la de ambos), listas personales en ambas
-- direcciones (A guarda a B / C guarda a A), Mi red oculta en ambas direcciones (A oculta a B /
-- C oculta a A).
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from _p03_state where k = 'a');
  v_b uuid := (select v from _p03_state where k = 'b');
  v_c uuid := (select v from _p03_state where k = 'c');
  v_match1 uuid := (select v from _p03_state where k = 'match1');
begin
  insert into public.notifications (player_id, type, match_id, payload)
    values (v_a, 'match_validated', v_match1, '{}'::jsonb);

  insert into public.match_user_state (match_id, player_id, private_note)
    values (v_match1, v_a, 'Nota privada de A: jugamos mal el segundo set');

  insert into public.intelligence_match_outputs (player_id, match_id, source_fingerprint, rules_version, output, memory_after, audit)
    values (v_a, v_match1, 'fp-a', 'v1', jsonb_build_object('body', 'Vos y P03 Jugador B ganaron'), '{}'::jsonb, '{}'::jsonb);
  insert into public.intelligence_match_outputs (player_id, match_id, source_fingerprint, rules_version, output, memory_after, audit)
    values (v_b, v_match1, 'fp-b', 'v1', jsonb_build_object('body', 'Vos y P03 Jugador A ganaron'), '{}'::jsonb, '{}'::jsonb);

  insert into public.player_saved_players (owner_player_id, saved_player_id) values (v_a, v_b);
  insert into public.player_saved_players (owner_player_id, saved_player_id) values (v_c, v_a);

  insert into public.ranking_network_hidden (player_id, hidden_player_id) values (v_a, v_b);
  insert into public.ranking_network_hidden (player_id, hidden_player_id) values (v_c, v_a);
end $$;

-- ------------------------------------------------------------------
-- Caso 1 — player_not_found sobre un uuid random.
-- ------------------------------------------------------------------

do $$
declare
  v_result jsonb;
begin
  v_result := public.admin_delete_player_account(gen_random_uuid(), 'test');
  if v_result->>'code' <> 'player_not_found' then
    raise exception 'CASO_1_FAILED_esperaba_player_not_found: %', v_result;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso 2 — not_a_registered_account sobre un provisional.
-- ------------------------------------------------------------------

do $$
declare
  v_prov uuid := (select v from _p03_state where k = 'prov');
  v_result jsonb;
begin
  v_result := public.admin_delete_player_account(v_prov, 'test');
  if v_result->>'code' <> 'not_a_registered_account' then
    raise exception 'CASO_2_FAILED_esperaba_not_a_registered_account: %', v_result;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso 3 — eliminación real de A. Confirma anonimización + preservación + limpieza de privados/
-- relaciones + auditoría, todo en un solo pasaje.
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from _p03_state where k = 'a');
  v_b uuid := (select v from _p03_state where k = 'b');
  v_match1 uuid := (select v from _p03_state where k = 'match1');
  v_result jsonb;
  v_count integer;
  v_snapshot text;
begin
  v_result := public.admin_delete_player_account(v_a, 'solicitud de prueba P03');
  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'CASO_3_FAILED_admin_delete_player_account: %', v_result;
  end if;
  if coalesce((v_result->>'alreadyDeleted')::boolean, true) then
    raise exception 'CASO_3_FAILED_alreadyDeleted_deberia_ser_false_la_primera_vez: %', v_result;
  end if;

  -- players/profiles anonimizados.
  if not exists (
    select 1 from public.players
    where player_id = v_a and display_name = 'Jugador eliminado' and is_active = false and deleted_at is not null
  ) then
    raise exception 'CASO_3_FAILED_players_no_quedo_anonimizado';
  end if;
  if exists (
    select 1 from public.profiles
    where player_id = v_a and (
      username is not null or first_name is not null or last_name is not null or display_name is not null
      or avatar_url is not null or birth_date is not null or gender is not null or phone is not null
      or allow_whatsapp_contact <> false or current_category is not null or location_id is not null
    )
  ) then
    raise exception 'CASO_3_FAILED_profiles_quedo_con_PII_residual';
  end if;

  -- match_participants: nombre anonimizado, player_id PRESERVADO (estructura intacta).
  select display_name_snapshot into v_snapshot from public.match_participants
    where match_id = v_match1 and player_id = v_a;
  if v_snapshot <> 'Jugador eliminado' then
    raise exception 'CASO_3_FAILED_display_name_snapshot_no_se_anonimizo: %', v_snapshot;
  end if;
  if not exists (select 1 from public.match_participants where match_id = v_match1 and player_id = v_a) then
    raise exception 'CASO_3_FAILED_player_id_de_A_no_deberia_desaparecer_de_match_participants';
  end if;

  -- Partido compartido y participantes de TERCEROS (B/C/D) intactos.
  if not exists (select 1 from public.matches where match_id = v_match1 and status = 'validated') then
    raise exception 'CASO_3_FAILED_el_partido_compartido_no_debia_verse_afectado';
  end if;
  if not exists (
    select 1 from public.match_participants where match_id = v_match1 and display_name_snapshot = 'P03 Jugador B'
  ) then
    raise exception 'CASO_3_FAILED_el_nombre_de_B_no_debia_tocarse';
  end if;

  -- Nivel de A y de B (tercero) intacto — nunca se toca level_states/level_events.
  if not exists (select 1 from public.level_states where player_id = v_a and mu = 6.5 and confidence = 0.7 and evidence_units = 3.0) then
    raise exception 'CASO_3_FAILED_level_states_de_A_no_debia_cambiar';
  end if;
  if not exists (select 1 from public.level_states where player_id = v_b and mu = 5.5) then
    raise exception 'CASO_3_FAILED_level_states_de_B_tercero_no_debia_cambiar';
  end if;

  -- Intelligence: AMBAS filas del partido (A y B) invalidadas — es un output regenerable, no la
  -- fuente de verdad; esto es intencional (ver comentario de la migración), nunca "corrupción".
  select count(*) into v_count from public.intelligence_match_outputs where match_id = v_match1;
  if v_count <> 0 then
    raise exception 'CASO_3_FAILED_intelligence_match_outputs_debia_invalidarse_para_todo_el_partido, quedaron %', v_count;
  end if;

  -- Datos 100% privados de A: borrados.
  if exists (select 1 from public.match_user_state where player_id = v_a) then
    raise exception 'CASO_3_FAILED_match_user_state_de_A_no_se_borro';
  end if;
  if exists (select 1 from public.notifications where player_id = v_a) then
    raise exception 'CASO_3_FAILED_notifications_de_A_no_se_borraron';
  end if;

  -- Relaciones personales, ambas direcciones.
  if exists (select 1 from public.player_saved_players where owner_player_id = v_a or saved_player_id = v_a) then
    raise exception 'CASO_3_FAILED_player_saved_players_de_A_no_se_limpio';
  end if;
  if exists (select 1 from public.ranking_network_hidden where player_id = v_a or hidden_player_id = v_a) then
    raise exception 'CASO_3_FAILED_ranking_network_hidden_de_A_no_se_limpio';
  end if;

  -- Auditoría mínima, sin PII en la nota.
  if not exists (
    select 1 from public.pilot_events
    where event_name = 'account_deleted' and player_id = v_a and properties->>'adminNote' = 'solicitud de prueba P03'
  ) then
    raise exception 'CASO_3_FAILED_no_quedo_registro_de_auditoria_account_deleted';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso 4 — riesgo #2/#6: search_players/get_public_profile (RPCs reales) ya no devuelven a A
-- como resultado. Usa la cuenta real existente (_p03_caller) como sesión — ambas RPCs exigen
-- auth.uid() -> players.auth_user_id real (FK real a auth.users, no se puede fabricar un
-- auth_user_id random). El caller real nunca coincide con los fixtures de este archivo, así que
-- excluirse a sí mismo del resultado (pl.player_id <> v_caller_player_id, ya existente en
-- search_players) no interfiere con lo que se está probando acá.
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from _p03_state where k = 'a');
  v_caller_auth uuid := (select auth_user_id from _p03_caller);
  v_count integer;
  v_others integer;
begin
  perform set_config('request.jwt.claim.sub', v_caller_auth::text, true);

  -- Buscar por 'p03' (fragmento común a username/display_name/first_name/last_name de TODOS los
  -- fixtures de este archivo) prueba la propiedad real: A nunca aparece, aunque B/C/D SÍ
  -- (confirma que la búsqueda funciona en general y que la ausencia de A no es casualidad de la
  -- consulta — A ya no tiene ningún campo de texto para hacer match en absoluto, justamente
  -- porque profiles quedó anonimizado).
  select count(*) into v_others from public.search_players('p03', 20);
  if v_others = 0 then
    raise exception 'CASO_4_FAILED_fixture_de_busqueda_no_encontro_ni_siquiera_a_B_C_D_algo_esta_mal_en_el_fixture';
  end if;
  select count(*) into v_count from public.search_players('p03', 20) where player_id = v_a;
  if v_count <> 0 then
    raise exception 'CASO_4_FAILED_search_players_todavia_devuelve_a_A_eliminado';
  end if;

  select count(*) into v_count from public.get_public_profile(v_a);
  if v_count <> 0 then
    raise exception 'CASO_4_FAILED_get_public_profile_todavia_devuelve_a_A_eliminado';
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso 5 — riesgo #8: repetir la operación es idempotente, no duplica ni rompe nada. Se
-- confirma que `updated_at`/`deleted_at` de la primera corrida NO se vuelven a tocar.
-- ------------------------------------------------------------------

do $$
declare
  v_a uuid := (select v from _p03_state where k = 'a');
  v_deleted_at_before timestamptz;
  v_deleted_at_after timestamptz;
  v_result jsonb;
  v_count integer;
begin
  select deleted_at into v_deleted_at_before from public.players where player_id = v_a;

  v_result := public.admin_delete_player_account(v_a, 'segundo intento, deberia ser no-op');
  if not coalesce(v_result->>'ok', 'false')::boolean then
    raise exception 'CASO_5_FAILED_segunda_llamada_deberia_seguir_devolviendo_ok_true: %', v_result;
  end if;
  if not coalesce((v_result->>'alreadyDeleted')::boolean, false) then
    raise exception 'CASO_5_FAILED_alreadyDeleted_deberia_ser_true_la_segunda_vez: %', v_result;
  end if;

  select deleted_at into v_deleted_at_after from public.players where player_id = v_a;
  if v_deleted_at_before <> v_deleted_at_after then
    raise exception 'CASO_5_FAILED_deleted_at_no_deberia_cambiar_en_un_reintento';
  end if;

  -- La segunda llamada no debe haber insertado un segundo evento de auditoría.
  select count(*) into v_count from public.pilot_events where event_name = 'account_deleted' and player_id = v_a;
  if v_count <> 1 then
    raise exception 'CASO_5_FAILED_esperaba_exactamente_1_evento_de_auditoria_obtuvo_%', v_count;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Caso 6 — riesgo #9: usuario común (anon/authenticated) NO puede ejecutar la operación.
-- ------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.admin_delete_player_account(uuid, text)', 'EXECUTE') then
    raise exception 'CASO_6_FAILED_anon_no_deberia_poder_ejecutar_admin_delete_player_account';
  end if;
  if has_function_privilege('authenticated', 'public.admin_delete_player_account(uuid, text)', 'EXECUTE') then
    raise exception 'CASO_6_FAILED_authenticated_no_deberia_poder_ejecutar_admin_delete_player_account';
  end if;
  if has_function_privilege('public', 'public.admin_delete_player_account(uuid, text)', 'EXECUTE') then
    raise exception 'CASO_6_FAILED_public_no_deberia_poder_ejecutar_admin_delete_player_account';
  end if;
  if not has_function_privilege('service_role', 'public.admin_delete_player_account(uuid, text)', 'EXECUTE') then
    raise exception 'CASO_6_FAILED_service_role_deberia_poder_ejecutar_admin_delete_player_account';
  end if;
end $$;

rollback;

select 'P0.3 FASE A — admin_delete_player_account OK — rollback limpio' as result;
