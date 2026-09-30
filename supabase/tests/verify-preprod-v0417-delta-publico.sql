-- BRAMUlab — V04.17: verificación transaccional de 20260930240000_preprod_v0417_delta_publico_nivel.sql
-- (get_my_last_level_delta = último cambio REAL del Nivel PÚBLICO a 1 decimal). Fixtures propios, ROLLBACK.
--
--  D1  sin evidencia -> null
--  D2  microdelta 5.8928 -> 5.86 (público 5.9 -> 5.9) NO genera ±0.0: se ignora y gana el último cambio público real
--  D3  6.0 -> 5.9 => delta -0.1 (aunque el delta interno sea -0.14)
--  D4  5.8 -> 5.9 => delta +0.1 (equivalente positivo)
--  D5  revertido / no elegible se ignoran; nunca un ±0.0
--  D6  el delta de otro jugador no se filtra; permisos

begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._t where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._mk(p_key text) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'v417_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('V417 ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_pid, 'v417_' || lower(p_key) || substr(v_uid::text, 1, 6), 'V417', p_key, 'V417 ' || p_key);
  insert into pg_temp._t values (p_key, v_pid);
end $$;
-- Partido validado (jugador X en A1) con played_at dado; devuelve match_id y lo guarda con la clave p_tag.
create or replace function pg_temp._mk_match(p_tag text, p_a1 text, p_a2 text, p_b1 text, p_b2 text, p_played timestamptz)
returns uuid language plpgsql as $$
declare v_match uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, winner_team, validation_deadline_at, validated_at)
    values (pg_temp._id(p_a1), 'v417-fp-' || p_tag, 'classic', p_played, 'validated', 'A', now() + interval '13 days', now())
    returning match_id into v_match;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match, 'A', 1, pg_temp._id(p_a1), p_a1), (v_match, 'A', 2, pg_temp._id(p_a2), p_a2),
    (v_match, 'B', 1, pg_temp._id(p_b1), p_b1), (v_match, 'B', 2, pg_temp._id(p_b2), p_b2);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match, 1, pg_temp._id(p_a1), 'A', 'created', p_played) returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_match, 1, 1, 6, 4), (v_match, 1, 2, 6, 3);
  update public.matches set current_revision_id = v_rev where match_id = v_match;
  insert into public.match_actions (match_id, action_type, actor_player_id, revision_id, occurred_at)
    values (v_match, 'validated', pg_temp._id(p_a1), v_rev, now());
  insert into pg_temp._t values ('M_' || p_tag, v_match);
  return v_match;
end $$;
create or replace function pg_temp._mk_level_result(p_match uuid, p_player text, p_before numeric, p_after numeric, p_status text, p_eligible boolean)
returns void language plpgsql as $$
declare v_res uuid;
begin
  insert into public.match_level_results (match_id, revision_id, "trigger", algorithm_version, eligible, effect_status)
    values (p_match, (select current_revision_id from public.matches where match_id = p_match), 'initial', 'test', p_eligible, p_status)
    returning result_id into v_res;
  insert into public.match_level_result_players (result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before, mu_after, confidence_after)
    values (v_res, pg_temp._id(p_player), 'A', p_before, 0.5, 'CALIBRATED', p_before, 1, 1, 1, p_after - p_before, p_after - p_before, 1,
      p_before, 0.5, 1, p_after, 0.5);
end $$;

do $$
begin
  perform pg_temp._mk('SEBA'); perform pg_temp._mk('B'); perform pg_temp._mk('C'); perform pg_temp._mk('D');
  perform pg_temp._mk_match('m1', 'SEBA', 'B', 'C', 'D', now() - interval '10 days');
  perform pg_temp._mk_match('m2', 'SEBA', 'B', 'C', 'D', now() - interval '8 days');
  perform pg_temp._mk_match('m3', 'SEBA', 'B', 'C', 'D', now() - interval '6 days');
  perform pg_temp._mk_match('m4', 'SEBA', 'B', 'C', 'D', now() - interval '4 days');
  perform pg_temp._mk_match('m5', 'SEBA', 'B', 'C', 'D', now() - interval '2 days');
  perform pg_temp._mk_match('m6', 'SEBA', 'B', 'C', 'D', now() - interval '1 day');
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp._as('SEBA');
  -- D1 sin evidencia
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'ok')::boolean and r->'delta' = 'null'::jsonb, 'D1 sin evidencia -> null: ' || r::text);

  -- D4: 5.8 -> 5.94 (público 5.8 -> 5.9) => +0.1
  perform pg_temp._mk_level_result(pg_temp._id('M_m1'), 'SEBA', 5.80, 5.94, 'applied', true);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'delta')::numeric = 0.1 and (r->>'publicBefore')::numeric = 5.8 and (r->>'publicAfter')::numeric = 5.9, 'D4 positivo +0.1: ' || r::text);

  -- D3: 6.04 -> 5.86 (interno -0.18; público 6.0 -> 5.9) => -0.1
  perform pg_temp._mk_level_result(pg_temp._id('M_m2'), 'SEBA', 6.04, 5.86, 'applied', true);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'delta')::numeric = -0.1 and r->>'matchId' = pg_temp._id('M_m2')::text, 'D3 6.0 -> 5.9 => -0.1: ' || r::text);

  -- D2: microdelta 5.8928 -> 5.86 (público 5.9 -> 5.9): NO genera ±0.0, sigue mostrándose el último cambio público real (-0.1 de m2)
  perform pg_temp._mk_level_result(pg_temp._id('M_m3'), 'SEBA', 5.8928, 5.86, 'applied', true);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'delta')::numeric = -0.1 and r->>'matchId' = pg_temp._id('M_m2')::text, 'D2 el microdelta no genera ±0.0 ni reemplaza al último cambio público: ' || r::text);
  perform pg_temp._assert((r->>'delta')::numeric <> 0, 'D2 nunca 0');

  -- D5: un cambio público MÁS reciente pero revertido / no elegible se ignora
  perform pg_temp._mk_level_result(pg_temp._id('M_m4'), 'SEBA', 5.86, 6.30, 'reverted', true);
  perform pg_temp._mk_level_result(pg_temp._id('M_m5'), 'SEBA', 5.86, 6.30, 'applied', false);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert(r->>'matchId' = pg_temp._id('M_m2')::text, 'D5 revertido/no elegible se ignoran: ' || r::text);

  -- un cambio público real MÁS reciente gana (5.86 -> 6.05 = público 5.9 -> 6.1 => +0.2)
  perform pg_temp._mk_level_result(pg_temp._id('M_m6'), 'SEBA', 5.86, 6.05, 'applied', true);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'delta')::numeric = 0.2 and r->>'matchId' = pg_temp._id('M_m6')::text, 'el cambio público más reciente gana: ' || r::text);

  -- D6
  perform pg_temp._as('B');
  perform pg_temp._assert(public.get_my_last_level_delta()->'delta' = 'null'::jsonb, 'D6 no se filtra a otro jugador');
end $$;

do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.get_my_last_level_delta()', 'execute'), 'D6 authenticated ejecuta');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_my_last_level_delta()', 'execute'), 'D6 anon NO');
end $$;

select 'V0417_VERIFY_OK' as result;
rollback;
