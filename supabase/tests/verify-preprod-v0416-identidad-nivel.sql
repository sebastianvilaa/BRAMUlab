-- BRAMUlab — V04.16: verificación transaccional de
-- 20260930220000_preprod_v0416_identidad_nivel.sql. Crea sus propios fixtures y termina en
-- ROLLBACK. Requiere Bloques 1-8 + P0.3 + Grupos aplicados.
--
-- Identidad visible (Issue #8):
--  I1  get_my_matches: un cambio de display name se ve retrospectivamente (Esteban -> Steve)
--  I2  get_match_detail: idem
--  I3  homónimos: dos player_id con el mismo nombre siguen separados; nunca se resuelve por nombre
--  I4  cuenta eliminada (P0.3): "Jugador eliminado", nunca recupera nombre histórico ni actual
--  I5  provisional e "Por identificar" (player_id null): siguen mostrando el snapshot
--  I6  matchContext de notificaciones usa el nombre actual
--  I7  los snapshots de match_participants NO se reescriben
-- Nivel (Issue #7):
--  N1  sin evidencia -> delta null (nunca se fabrica)
--  N2  con resultado aplicado -> último delta real; revertido / no elegible -> se ignoran
--  N3  el delta de un jugador no se filtra a otro; permisos de ejecución

begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._t where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._mk(p_key text, p_name text) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'v416_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values (p_name, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_pid, 'v416_' || lower(p_key) || substr(v_uid::text, 1, 6), 'V416', p_key, p_name);
  insert into pg_temp._t values (p_key, v_pid);
end $$;
-- Participante (nombre del snapshot explícito) de un partido validado.
create or replace function pg_temp._mk_match(p_tag text, p_a1 text, p_a2 text, p_b1 text, p_b2 uuid, p_b2_snapshot text, p_played timestamptz)
returns uuid language plpgsql as $$
declare v_match uuid; v_rev uuid;
begin
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, winner_team, validation_deadline_at, validated_at)
    values (pg_temp._id(p_a1), 'v416-fp-' || p_tag, 'classic', p_played, 'validated', 'A', now() + interval '13 days', now())
    returning match_id into v_match;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_match, 'A', 1, pg_temp._id(p_a1), (select v2.snap from (values (p_a1, (select display_name_snapshot_seed from pg_temp._seed where k = p_a1))) v2(n, snap))),
    (v_match, 'A', 2, pg_temp._id(p_a2), (select display_name_snapshot_seed from pg_temp._seed where k = p_a2)),
    (v_match, 'B', 1, pg_temp._id(p_b1), (select display_name_snapshot_seed from pg_temp._seed where k = p_b1)),
    (v_match, 'B', 2, p_b2, p_b2_snapshot);
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_match, 1, pg_temp._id(p_a1), 'A', 'created', p_played) returning revision_id into v_rev;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_match, 1, 1, 6, 4), (v_match, 1, 2, 6, 3);
  update public.matches set current_revision_id = v_rev where match_id = v_match;
  insert into public.match_actions (match_id, action_type, actor_player_id, revision_id, occurred_at)
    values (v_match, 'validated', pg_temp._id(p_a1), v_rev, now());
  insert into pg_temp._t values ('M_' || p_tag, v_match);
  return v_match;
end $$;

-- Nombres "de entonces" (snapshot) de cada jugador
create temporary table _seed (k text primary key, display_name_snapshot_seed text) on commit drop;

do $$
begin
  perform pg_temp._mk('ESTEBAN', 'Esteban');   -- se renombra a Steve
  perform pg_temp._mk('SEBA', 'Seba');         -- el que mira
  perform pg_temp._mk('LUCHO', 'Lucho');
  perform pg_temp._mk('CARLA', 'Carla');       -- se renombra y luego se elimina
  perform pg_temp._mk('HOMO', 'Esteban');      -- OTRO player_id con el nombre viejo de Esteban
  insert into _seed values ('ESTEBAN', 'Esteban'), ('SEBA', 'Seba'), ('LUCHO', 'Lucho'), ('CARLA', 'Carla'), ('HOMO', 'Esteban');
  -- un provisional (no registrado)
  insert into public.players (display_name, type) values ('Prov Viejo', 'provisional');
  insert into pg_temp._t values ('PROV', (select player_id from public.players where display_name = 'Prov Viejo' and type = 'provisional' order by created_at desc limit 1));
end $$;

-- M1: SEBA+ESTEBAN vs LUCHO+CARLA. M2: SEBA+HOMO vs LUCHO+PROV (provisional). M3: slot "Por identificar".
do $$
begin
  perform pg_temp._mk_match('m1', 'SEBA', 'ESTEBAN', 'LUCHO', pg_temp._id('CARLA'), 'Carla', now() - interval '3 days');
  perform pg_temp._mk_match('m2', 'SEBA', 'HOMO', 'LUCHO', pg_temp._id('PROV'), 'Prov Viejo', now() - interval '2 days');
  perform pg_temp._mk_match('m3', 'SEBA', 'ESTEBAN', 'LUCHO', null, 'Por identificar', now() - interval '1 day');
end $$;

-- Renombres reales (mismo camino que complete_profile: players.display_name + profiles.display_name)
update public.players set display_name = 'Steve' where player_id = pg_temp._id('ESTEBAN');
update public.profiles set display_name = 'Steve' where player_id = pg_temp._id('ESTEBAN');
update public.players set display_name = 'Carla Nueva' where player_id = pg_temp._id('CARLA');
update public.players set display_name = 'Prov Nuevo' where player_id = pg_temp._id('PROV');

create or replace function pg_temp._names(p_rows jsonb, p_match uuid) returns jsonb language sql as $$
  select (select r->'participants' from jsonb_array_elements(p_rows) r where r->>'match_id' = p_match::text)
$$;
create or replace function pg_temp._name_of(p_participants jsonb, p_player uuid) returns text language sql as $$
  select p->>'displayName' from jsonb_array_elements(p_participants) p where p->>'playerId' = p_player::text
$$;

-- ---------- I1 / I3 / I5 (get_my_matches) ----------
do $$
declare rows jsonb; m1 jsonb; m2 jsonb; m3 jsonb;
begin
  perform pg_temp._as('SEBA');
  rows := (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.get_my_matches(50, true) x);
  -- forma real de la salida: una fila por partido con `participants`
  m1 := pg_temp._names(rows, pg_temp._id('M_m1'));
  m2 := pg_temp._names(rows, pg_temp._id('M_m2'));
  m3 := pg_temp._names(rows, pg_temp._id('M_m3'));
  perform pg_temp._assert(m1 is not null and m2 is not null and m3 is not null, 'I fixtures visibles en get_my_matches');
  perform pg_temp._assert(pg_temp._name_of(m1, pg_temp._id('ESTEBAN')) = 'Steve', 'I1 Esteban -> Steve en un partido viejo: ' || m1::text);
  perform pg_temp._assert(pg_temp._name_of(m1, pg_temp._id('CARLA')) = 'Carla Nueva', 'I1 otro renombre retrospectivo');
  perform pg_temp._assert(pg_temp._name_of(m1, pg_temp._id('SEBA')) = 'Seba' and pg_temp._name_of(m1, pg_temp._id('LUCHO')) = 'Lucho', 'I1 sin renombre queda igual');
  -- I3 homónimo: HOMO sigue siendo 'Esteban' (su nombre real) y NO se mezcla con Steve
  perform pg_temp._assert(pg_temp._name_of(m2, pg_temp._id('HOMO')) = 'Esteban', 'I3 el homónimo (otro player_id) conserva su nombre');
  perform pg_temp._assert(pg_temp._name_of(m1, pg_temp._id('ESTEBAN')) <> pg_temp._name_of(m2, pg_temp._id('HOMO')), 'I3 dos player_id distintos nunca se fusionan por nombre');
  -- I5 provisional: snapshot; "Por identificar": snapshot
  perform pg_temp._assert(pg_temp._name_of(m2, pg_temp._id('PROV')) = 'Prov Viejo', 'I5 provisional conserva el snapshot: ' || m2::text);
  perform pg_temp._assert(exists (select 1 from jsonb_array_elements(m3) p where p->>'playerId' is null and p->>'displayName' = 'Por identificar'), 'I5 "Por identificar" intacto');
end $$;

-- ---------- I2 get_match_detail ----------
do $$
declare d jsonb;
begin
  perform pg_temp._as('SEBA');
  d := public.get_match_detail(pg_temp._id('M_m1'));
  perform pg_temp._assert((d->>'ok')::boolean is not false, 'I2 detalle ok: ' || left(d::text, 200));
  perform pg_temp._assert(pg_temp._name_of(coalesce(d->'match'->'participants', d->'participants'), pg_temp._id('ESTEBAN')) = 'Steve', 'I2 get_match_detail muestra Steve: ' || left(d::text, 400));
end $$;

-- ---------- I6 matchContext de notificaciones ----------
do $$
declare ctx jsonb;
begin
  -- SEBA (equipo A) mira a los rivales (LUCHO + CARLA) de M1
  ctx := public._bloque6_notification_match_context(pg_temp._id('M_m1'), pg_temp._id('SEBA'));
  perform pg_temp._assert(ctx->'opponentNames' @> '["Carla Nueva"]'::jsonb and ctx->'opponentNames' @> '["Lucho"]'::jsonb, 'I6 opponentNames con nombre actual: ' || ctx::text);
  -- desde la perspectiva de LUCHO el rival Esteban se ve como Steve
  ctx := public._bloque6_notification_match_context(pg_temp._id('M_m1'), pg_temp._id('LUCHO'));
  perform pg_temp._assert(ctx->'opponentNames' @> '["Steve"]'::jsonb, 'I6 Steve en matchContext: ' || ctx::text);
end $$;

-- ---------- I4 eliminada (P0.3): nunca recupera nombre ----------
do $$
declare rows jsonb; m1 jsonb;
begin
  perform public.admin_delete_player_account(pg_temp._id('CARLA'));
  perform pg_temp._as('SEBA');
  rows := (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.get_my_matches(50, true) x);
  m1 := pg_temp._names(rows, pg_temp._id('M_m1'));
  perform pg_temp._assert(pg_temp._name_of(m1, pg_temp._id('CARLA')) = 'Jugador eliminado', 'I4 eliminada = "Jugador eliminado": ' || m1::text);
  perform pg_temp._assert(m1::text not like '%Carla%', 'I4 ni el nombre histórico ni el actual reaparecen');
  -- aunque alguien escriba un nombre nuevo en una fila eliminada, no se muestra
  update public.players set display_name = 'Carla Zombie' where player_id = pg_temp._id('CARLA');
  rows := (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.get_my_matches(50, true) x);
  perform pg_temp._assert(pg_temp._name_of(pg_temp._names(rows, pg_temp._id('M_m1')), pg_temp._id('CARLA')) = 'Jugador eliminado', 'I4 una fila eliminada nunca vuelve a mostrar un nombre');
end $$;

-- ---------- I7 snapshots sin reescribir ----------
do $$
begin
  perform pg_temp._assert((select display_name_snapshot from public.match_participants where match_id = pg_temp._id('M_m1') and player_id = pg_temp._id('ESTEBAN')) = 'Esteban', 'I7 snapshot de Esteban intacto');
  perform pg_temp._assert((select display_name_snapshot from public.match_participants where match_id = pg_temp._id('M_m2') and player_id = pg_temp._id('PROV')) = 'Prov Viejo', 'I7 snapshot del provisional intacto');
  perform pg_temp._assert((select count(*) from public.match_participants where match_id = pg_temp._id('M_m3') and player_id is null and display_name_snapshot = 'Por identificar') = 1, 'I7 "Por identificar" intacto');
end $$;

-- ---------- N1..N3 delta real de Nivel ----------
create or replace function pg_temp._mk_level_result(p_match uuid, p_player text, p_before numeric, p_delta numeric, p_status text, p_eligible boolean)
returns void language plpgsql as $$
declare v_res uuid;
begin
  insert into public.match_level_results (match_id, revision_id, "trigger", algorithm_version, eligible, effect_status)
    values (p_match, (select current_revision_id from public.matches where match_id = p_match), 'initial', 'test', p_eligible, p_status)
    returning result_id into v_res;
  insert into public.match_level_result_players (result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state,
      effective_level, k, opponent_factor, circle_factor, delta_raw, delta_capped, evidence_quality,
      original_live_mu_before, original_live_confidence_before, original_live_evidence_units_before, mu_after, confidence_after)
    values (v_res, pg_temp._id(p_player), 'A', p_before, 0.5, 'CALIBRATED', p_before, 1, 1, 1, p_delta, p_delta, 1,
      p_before, 0.5, 1, p_before + p_delta, 0.5);
end $$;
do $$
declare r jsonb;
begin
  perform pg_temp._as('SEBA');
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'ok')::boolean and r->'delta' = 'null'::jsonb, 'N1 sin evidencia -> delta null (nunca se fabrica): ' || r::text);

  -- resultados: m1 (hace 3 días) +0.30 aplicado; m2 (hace 2 días) -0.20 REVERTIDO; m3 (hace 1 día) +0.50 NO elegible
  perform pg_temp._mk_level_result(pg_temp._id('M_m1'), 'SEBA', 5.0, 0.30, 'applied', true);
  perform pg_temp._mk_level_result(pg_temp._id('M_m2'), 'SEBA', 5.3, -0.20, 'reverted', true);
  perform pg_temp._mk_level_result(pg_temp._id('M_m3'), 'SEBA', 5.3, 0.50, 'applied', false);
  r := public.get_my_last_level_delta();
  perform pg_temp._assert((r->>'delta')::numeric = 0.30 and r->>'matchId' = pg_temp._id('M_m1')::text, 'N2 ignora revertido y no elegible: ' || r::text);
  perform pg_temp._assert((r->>'muAfter')::numeric = 5.30 and (r->>'muBefore')::numeric = 5.0, 'N2 muBefore/muAfter reales');

  -- N3: otro jugador no ve el delta de SEBA
  perform pg_temp._as('ESTEBAN');
  r := public.get_my_last_level_delta();
  perform pg_temp._assert(r->'delta' = 'null'::jsonb, 'N3 el delta de otro jugador no se filtra: ' || r::text);
end $$;

do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.get_my_last_level_delta()', 'execute'), 'N3 authenticated ejecuta');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_my_last_level_delta()', 'execute'), 'N3 anon NO');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public._match_participant_display_name(uuid,text)', 'execute'), 'helper interno NO expuesto');
end $$;

select 'V0416_VERIFY_OK' as result;
rollback;
