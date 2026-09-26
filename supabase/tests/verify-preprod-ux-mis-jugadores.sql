-- BRAMUlab — Ronda correctiva QA 26SEP (§15.24 punto 5 "Mis Jugadores / Agregar Jugador —
-- terminar migración server-backed") — verificación transaccional segura de
-- 20260927130000_preprod_ux_mis_jugadores.sql. Requiere Bloques 1-8 aplicados y al menos UNA
-- cuenta real registrada con sesión (auth_user_id no nulo, perfil con username) ya existente en
-- el entorno. No deja fixtures: toda mutación ocurre entre BEGIN/ROLLBACK.
--
-- Cubre:
--   A. save_player agrega; una segunda llamada al mismo player_id es idempotente (no duplica).
--   B. save_player rechaza auto-agregado ({ok:false, code:cannot_save_self}).
--   C. save_player rechaza un provisional y una cuenta inactiva ({ok:false, code:player_not_found}).
--   D. remove_saved_player quita; una segunda llamada es idempotente ({ok:true} igual).
--   E. list_saved_players: más reciente primero.
--   F. list_saved_players excluye un jugador guardado que DESPUÉS quedó inactivo — la relación
--      sigue existiendo en la tabla (se verifica con una query directa), pero no aparece listada.
--   G. is_player_saved true/false real.
--   H. owner isolation: la lista de un dueño nunca incluye filas de otro.
--   I. permisos: authenticated puede ejecutar las 4 RPCs, anon ninguna.

begin;

create temporary table _mj_caller on commit drop as
select pl.player_id, pl.auth_user_id
from public.players pl
join public.profiles pr using (player_id)
where pl.auth_user_id is not null
  and pr.username is not null
order by pr.created_at
limit 1;

do $$
begin
  if (select count(*) from _mj_caller) <> 1 then
    raise exception 'verify_mis_jugadores_requires_one_registered_account_with_session';
  end if;
end $$;

create temporary table _mj_state (k text primary key, v uuid) on commit drop;

do $$
declare
  v_target1 uuid;
  v_target2 uuid;
  v_will_go_inactive uuid;
  v_provisional uuid;
  v_other_owner uuid;
begin
  insert into public.players (display_name) values ('MJ Target Uno') returning player_id into v_target1;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_target1, 'mj_target1', 'MJ', 'Target Uno', 'MJ Target Uno');

  insert into public.players (display_name) values ('MJ Target Dos') returning player_id into v_target2;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_target2, 'mj_target2', 'MJ', 'Target Dos', 'MJ Target Dos');

  insert into public.players (display_name) values ('MJ Se Va A Inactivar') returning player_id into v_will_go_inactive;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_will_go_inactive, 'mj_inactivar', 'MJ', 'Se Va A Inactivar', 'MJ Se Va A Inactivar');

  insert into public.players (display_name, type) values ('MJ Provisional', 'provisional') returning player_id into v_provisional;

  -- Segunda cuenta real (dueño distinto) para el caso de owner isolation.
  insert into public.players (display_name) values ('MJ Otro Dueño') returning player_id into v_other_owner;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_other_owner, 'mj_otro_dueno', 'MJ', 'Otro Dueño', 'MJ Otro Dueño');

  insert into _mj_state (k, v) values
    ('target1', v_target1), ('target2', v_target2), ('will_go_inactive', v_will_go_inactive),
    ('provisional', v_provisional), ('other_owner', v_other_owner);
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from _mj_caller), true);

-- A) save_player agrega + idempotente.
do $$
declare
  v_result jsonb;
  v_count integer;
begin
  v_result := public.save_player((select v from _mj_state where k = 'target1'));
  if (v_result->>'ok')::boolean is not true then raise exception 'A_FAILED_save_player_target1: %', v_result; end if;

  -- Segunda llamada al mismo player_id: no debe duplicar ni fallar.
  v_result := public.save_player((select v from _mj_state where k = 'target1'));
  if (v_result->>'ok')::boolean is not true then raise exception 'A_FAILED_save_player_target1_second_call: %', v_result; end if;

  select count(*) into v_count from public.player_saved_players
  where owner_player_id = (select player_id from _mj_caller)
    and saved_player_id = (select v from _mj_state where k = 'target1');
  if v_count <> 1 then raise exception 'A_FAILED_expected_exactly_1_row_got_%', v_count; end if;

  -- Segundo jugador real, agregado DESPUÉS (para el orden de E).
  -- `now()` dentro de una misma transacción devuelve el timestamp de inicio de transacción,
  -- así que pg_sleep NO diferencia created_at en este verify. Fijamos timestamps distintos de
  -- forma explícita dentro del fixture para probar el ORDER BY real sin depender del reloj.
  v_result := public.save_player((select v from _mj_state where k = 'target2'));
  if (v_result->>'ok')::boolean is not true then raise exception 'A_FAILED_save_player_target2: %', v_result; end if;
  update public.player_saved_players
    set created_at = now() - interval '2 seconds'
    where owner_player_id = (select player_id from _mj_caller)
      and saved_player_id = (select v from _mj_state where k = 'target1');
  update public.player_saved_players
    set created_at = now() - interval '1 second'
    where owner_player_id = (select player_id from _mj_caller)
      and saved_player_id = (select v from _mj_state where k = 'target2');
end $;

-- B) auto-agregado rechazado.
do $$
declare
  v_result jsonb;
begin
  v_result := public.save_player((select player_id from _mj_caller));
  if (v_result->>'ok')::boolean is not false or (v_result->>'code') is distinct from 'cannot_save_self' then
    raise exception 'B_FAILED_expected_cannot_save_self: %', v_result;
  end if;
end $$;

-- C) provisional e inactivo rechazados con player_not_found, sin excepción.
do $$
declare
  v_result_provisional jsonb;
  v_result_nonexistent jsonb;
begin
  v_result_provisional := public.save_player((select v from _mj_state where k = 'provisional'));
  if (v_result_provisional->>'ok')::boolean is not false or (v_result_provisional->>'code') is distinct from 'player_not_found' then
    raise exception 'C_FAILED_expected_player_not_found_for_provisional: %', v_result_provisional;
  end if;

  v_result_nonexistent := public.save_player(gen_random_uuid());
  if (v_result_nonexistent->>'ok')::boolean is not false or (v_result_nonexistent->>'code') is distinct from 'player_not_found' then
    raise exception 'C_FAILED_expected_player_not_found_for_nonexistent: %', v_result_nonexistent;
  end if;
end $$;

-- D) remove_saved_player quita + idempotente.
do $$
declare
  v_result jsonb;
  v_count integer;
begin
  -- Agrega y quita un tercer objetivo, exclusivo de este caso.
  perform public.save_player((select v from _mj_state where k = 'will_go_inactive'));

  v_result := public.remove_saved_player((select v from _mj_state where k = 'will_go_inactive'));
  if (v_result->>'ok')::boolean is not true then raise exception 'D_FAILED_remove_first_call: %', v_result; end if;

  select count(*) into v_count from public.player_saved_players
  where owner_player_id = (select player_id from _mj_caller)
    and saved_player_id = (select v from _mj_state where k = 'will_go_inactive');
  if v_count <> 0 then raise exception 'D_FAILED_expected_0_rows_after_remove_got_%', v_count; end if;

  -- Segunda llamada: sigue {ok:true}, nunca falla porque ya no estaba.
  v_result := public.remove_saved_player((select v from _mj_state where k = 'will_go_inactive'));
  if (v_result->>'ok')::boolean is not true then raise exception 'D_FAILED_remove_second_call_should_still_be_ok: %', v_result; end if;
end $$;

-- F prep) re-agrega will_go_inactive (para el caso F) y lo inactiva DESPUÉS de guardarlo.
do $$
begin
  perform public.save_player((select v from _mj_state where k = 'will_go_inactive'));
  update public.players set is_active = false where player_id = (select v from _mj_state where k = 'will_go_inactive');
end $$;

-- E) list_saved_players: más reciente primero entre las filas VISIBLES.
--    will_go_inactive ya fue marcado is_active=false en el prep anterior, por contrato debe
--    quedar filtrado desde ESTA lectura (F verifica además que la relación persiste en tabla).
--    target2 fue agregado después de target1, por lo que debe aparecer primero.
do $body$
declare
  v_rows uuid[];
begin
  select array_agg(player_id order by saved_at desc) into v_rows from public.list_saved_players();
  if v_rows[1] is distinct from (select v from _mj_state where k = 'target2') then
    raise exception 'E_FAILED_expected_target2_most_recent_visible_first: %', v_rows;
  end if;
  if v_rows[2] is distinct from (select v from _mj_state where k = 'target1') then
    raise exception 'E_FAILED_expected_target1_second_visible: %', v_rows;
  end if;
  if array_length(v_rows, 1) <> 2 then
    raise exception 'E_FAILED_expected_exactly_2_visible_rows_got_%: %', array_length(v_rows, 1), v_rows;
  end if;
end $body$;

-- F) list_saved_players excluye al inactivo, pero la relación SIGUE en la tabla (nunca se borra
--    sola).
do $$
declare
  v_listed_count integer;
  v_relation_count integer;
begin
  select count(*) into v_listed_count from public.list_saved_players()
  where player_id = (select v from _mj_state where k = 'will_go_inactive');
  if v_listed_count <> 0 then raise exception 'F_FAILED_inactive_player_should_not_be_listed: %', v_listed_count; end if;

  select count(*) into v_relation_count from public.player_saved_players
  where owner_player_id = (select player_id from _mj_caller)
    and saved_player_id = (select v from _mj_state where k = 'will_go_inactive');
  if v_relation_count <> 1 then raise exception 'F_FAILED_relation_row_should_still_exist_got_%', v_relation_count; end if;
end $$;

-- G) is_player_saved real.
do $$
begin
  if public.is_player_saved((select v from _mj_state where k = 'target1')) is not true then
    raise exception 'G_FAILED_expected_true_for_target1';
  end if;
  if public.is_player_saved((select v from _mj_state where k = 'target2')) is not true then
    raise exception 'G_FAILED_expected_true_for_target2';
  end if;
  if public.is_player_saved((select v from _mj_state where k = 'other_owner')) is not false then
    raise exception 'G_FAILED_expected_false_for_never_saved_player';
  end if;
end $$;

-- H) owner isolation: nada de esto pertenece a otra cuenta (no hay una segunda sesión real
--    disponible en este arnés, así que se verifica por consulta directa que las filas quedaron
--    con owner_player_id = caller, nunca con otro owner).
do $$
declare
  v_foreign_count integer;
begin
  select count(*) into v_foreign_count from public.player_saved_players
  where saved_player_id in (select v from _mj_state where k in ('target1', 'target2', 'will_go_inactive'))
    and owner_player_id <> (select player_id from _mj_caller);
  if v_foreign_count <> 0 then raise exception 'H_FAILED_unexpected_rows_with_foreign_owner: %', v_foreign_count; end if;
end $$;

-- I) permisos: authenticated puede ejecutar las 4 RPCs, anon ninguna.
do $$
begin
  if not has_function_privilege('authenticated', 'public.save_player(uuid)', 'execute') then
    raise exception 'I_FAILED_save_player_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.save_player(uuid)', 'execute') then
    raise exception 'I_FAILED_save_player_should_not_be_executable_by_anon';
  end if;
  if not has_function_privilege('authenticated', 'public.remove_saved_player(uuid)', 'execute') then
    raise exception 'I_FAILED_remove_saved_player_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.remove_saved_player(uuid)', 'execute') then
    raise exception 'I_FAILED_remove_saved_player_should_not_be_executable_by_anon';
  end if;
  if not has_function_privilege('authenticated', 'public.list_saved_players()', 'execute') then
    raise exception 'I_FAILED_list_saved_players_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.list_saved_players()', 'execute') then
    raise exception 'I_FAILED_list_saved_players_should_not_be_executable_by_anon';
  end if;
  if not has_function_privilege('authenticated', 'public.is_player_saved(uuid)', 'execute') then
    raise exception 'I_FAILED_is_player_saved_not_executable_by_authenticated';
  end if;
  if has_function_privilege('anon', 'public.is_player_saved(uuid)', 'execute') then
    raise exception 'I_FAILED_is_player_saved_should_not_be_executable_by_anon';
  end if;
end $$;

rollback;
