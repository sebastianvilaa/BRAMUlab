-- BRAMUlab — Ronda correctiva QA 26SEP (§15.24 "Fila compacta server-backed de jugador") —
-- verificación transaccional segura de 20260927120000_preprod_ux_players_compact.sql. Requiere
-- Bloques 1-8 aplicados y al menos UNA cuenta real registrada con sesión (auth_user_id no nulo,
-- perfil con username) ya existente en el entorno — mismo criterio que los verify-preprod-ux-*
-- anteriores. No deja fixtures: toda mutación ocurre entre BEGIN/ROLLBACK.
--
-- Cubre:
--   A. search_players ahora devuelve avatar_url (misma RUTA de Storage que profiles.avatar_url).
--   B. get_players_compact devuelve username/display_name/level_status/level_public/avatar_url
--      para una lista mixta de player_ids reales.
--   C. get_players_compact EXCLUYE provisionales, inactivos y cuentas sin username — mismas
--      exclusiones que search_players/get_public_profile — sin lanzar error, solo ausentes.
--   D. un player_id inexistente en la lista simplemente no aparece (0 filas para ese id, nunca
--      un error ni una fila con columnas null "inventadas").
--   E. p_player_ids vacío/null -> 0 filas, nunca un error.
--   F. duplicados en la entrada no producen filas duplicadas en la salida.
--   G. permisos: authenticated puede ejecutar ambas RPCs, anon no puede ninguna.

begin;

create temporary table _plc_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _plc_caller) <> 1 then
    raise exception 'verify_players_compact_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _plc_state (k text primary key, v uuid) on commit drop;

-- ------------------------------------------------------------------
-- Fixtures: 2 cuentas registradas activas (una CON avatar_url, una sin), 1 registrada INACTIVA,
-- 1 registrada SIN username todavía, 1 PROVISIONAL.
-- ------------------------------------------------------------------

do $$
declare
  v_with_avatar uuid;
  v_no_avatar uuid;
  v_inactive uuid;
  v_no_username uuid;
  v_provisional uuid;
begin
  insert into public.players (display_name) values ('PLC Con Avatar') returning player_id into v_with_avatar;
  insert into public.profiles (player_id, username, first_name, last_name, display_name, avatar_url)
    values (v_with_avatar, 'plc_with_avatar', 'PLC', 'Con Avatar', 'PLC Con Avatar', v_with_avatar::text || '/foto.jpg');
  insert into public.level_states (player_id, status, mu, confidence, rated_matches, distinct_opponents)
    values (v_with_avatar, 'CALIBRADO', 5.83, 0.9, 12, 6);

  insert into public.players (display_name) values ('PLC Sin Avatar') returning player_id into v_no_avatar;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_no_avatar, 'plc_no_avatar', 'PLC', 'Sin Avatar', 'PLC Sin Avatar');

  insert into public.players (display_name, is_active) values ('PLC Inactivo', false) returning player_id into v_inactive;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_inactive, 'plc_inactivo', 'PLC', 'Inactivo', 'PLC Inactivo');

  insert into public.players (display_name) values ('PLC Sin Username') returning player_id into v_no_username;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_no_username, null, 'PLC', 'Sin Username', null);

  insert into public.players (display_name, type) values ('PLC Provisional', 'provisional') returning player_id into v_provisional;

  insert into _plc_state (k, v) values
    ('with_avatar', v_with_avatar), ('no_avatar', v_no_avatar), ('inactive', v_inactive),
    ('no_username', v_no_username), ('provisional', v_provisional);
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _plc_caller), true);

-- A) search_players devuelve avatar_url.
do $$
declare
  v_row record;
  v_expected_path text := (select v from _plc_state where k = 'with_avatar')::text || '/foto.jpg';
begin
  select * into v_row from public.search_players('plc_with_avatar', 10)
  where player_id = (select v from _plc_state where k = 'with_avatar');
  if not found then raise exception 'A_FAILED_search_players_did_not_return_fixture_row'; end if;
  if v_row.avatar_url is distinct from v_expected_path then
    raise exception 'A_FAILED_search_players_avatar_url_mismatch: got % expected %', v_row.avatar_url, v_expected_path;
  end if;
end $$;

-- B) get_players_compact — lista mixta real, columnas correctas.
do $$
declare
  v_row_with_avatar record;
  v_row_no_avatar record;
  v_count integer;
begin
  select count(*) into v_count from public.get_players_compact(array[
    (select v from _plc_state where k = 'with_avatar'),
    (select v from _plc_state where k = 'no_avatar')
  ]);
  if v_count <> 2 then raise exception 'B_FAILED_expected_2_rows_got_%', v_count; end if;

  select * into v_row_with_avatar from public.get_players_compact(array[(select v from _plc_state where k = 'with_avatar')]);
  if v_row_with_avatar.username is distinct from 'plc_with_avatar' then
    raise exception 'B_FAILED_username_mismatch: %', v_row_with_avatar.username;
  end if;
  if v_row_with_avatar.level_status is distinct from 'CALIBRADO' or round(v_row_with_avatar.level_public, 1) is distinct from 5.8 then
    raise exception 'B_FAILED_level_mismatch: status=% level=%', v_row_with_avatar.level_status, v_row_with_avatar.level_public;
  end if;
  if v_row_with_avatar.avatar_url is distinct from (select v from _plc_state where k = 'with_avatar')::text || '/foto.jpg' then
    raise exception 'B_FAILED_avatar_url_mismatch: %', v_row_with_avatar.avatar_url;
  end if;

  select * into v_row_no_avatar from public.get_players_compact(array[(select v from _plc_state where k = 'no_avatar')]);
  if v_row_no_avatar.avatar_url is not null then
    raise exception 'B_FAILED_expected_null_avatar_url_got_%', v_row_no_avatar.avatar_url;
  end if;
  if v_row_no_avatar.level_status is not null then
    raise exception 'B_FAILED_expected_null_level_status_no_level_state_row_got_%', v_row_no_avatar.level_status;
  end if;
end $$;

-- C) excluye provisional/inactivo/sin-username, sin error — simplemente ausentes.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.get_players_compact(array[
    (select v from _plc_state where k = 'inactive'),
    (select v from _plc_state where k = 'no_username'),
    (select v from _plc_state where k = 'provisional')
  ]);
  if v_count <> 0 then raise exception 'C_FAILED_expected_0_rows_for_excluded_ids_got_%', v_count; end if;
end $$;

-- D) player_id inexistente -> simplemente ausente, sin error.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.get_players_compact(array[gen_random_uuid()]);
  if v_count <> 0 then raise exception 'D_FAILED_expected_0_rows_for_nonexistent_id_got_%', v_count; end if;
end $$;

-- E) entrada vacía/null -> 0 filas, nunca error.
do $$
declare
  v_count_empty integer;
  v_count_null integer;
begin
  select count(*) into v_count_empty from public.get_players_compact(array[]::uuid[]);
  if v_count_empty <> 0 then raise exception 'E_FAILED_expected_0_rows_for_empty_array_got_%', v_count_empty; end if;

  select count(*) into v_count_null from public.get_players_compact(null);
  if v_count_null <> 0 then raise exception 'E_FAILED_expected_0_rows_for_null_array_got_%', v_count_null; end if;
end $$;

-- F) duplicados en la entrada no producen filas duplicadas en la salida.
do $$
declare
  v_count integer;
  v_id uuid := (select v from _plc_state where k = 'with_avatar');
begin
  select count(*) into v_count from public.get_players_compact(array[v_id, v_id, v_id]);
  if v_count <> 1 then raise exception 'F_FAILED_expected_1_row_for_triplicated_id_got_%', v_count; end if;
end $$;

-- G) permisos: authenticated puede ejecutar ambas RPCs, anon no puede ninguna.
do $$
begin
  if not has_function_privilege('authenticated', 'public.search_players(text, integer)', 'execute') then
    raise exception 'G_FAILED_search_players_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.search_players(text, integer)', 'execute') then
    raise exception 'G_FAILED_search_players_should_not_be_executable_by_anon';
  end if;
  if not has_function_privilege('authenticated', 'public.get_players_compact(uuid[])', 'execute') then
    raise exception 'G_FAILED_get_players_compact_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.get_players_compact(uuid[])', 'execute') then
    raise exception 'G_FAILED_get_players_compact_should_not_be_executable_by_anon';
  end if;
end $$;

rollback;
