-- BRAMUlab — V04.20 (L3): verificación transaccional de 20260930320000_preprod_v0420_account_self_service.sql. ROLLBACK al final.
--  R1 resolve_player_for_account_deletion: por auth user; retry tras Fase 1 (auth_user_id nulo) vía auditoría; desconocido/provisional
--  X1 admin_export_player_data: datos propios completos; de terceros SOLO nombre mostrado (sin ids, email, teléfono, nacimiento)
--  X2 sin secretos/auditoría interna de Intelligence; cuenta eliminada/provisional rechazadas; solo service_role
begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._mk(p_key text, p_phone text, p_birth date) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'ss_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('SS ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name, phone, birth_date)
    values (v_pid, 'ss_' || lower(p_key) || substr(v_uid::text, 1, 6), 'SS', p_key, 'SS ' || p_key, p_phone, p_birth);
  insert into pg_temp._t values (p_key, v_pid);
  insert into pg_temp._t values (p_key || '_uid', v_uid);
end $$;

do $$
declare v jsonb; v_text text; v_prov uuid; v_m uuid; v_r1 uuid; v_b_email text;
begin
  perform pg_temp._mk('A', '+5491100000001', date '1990-01-01');
  perform pg_temp._mk('B', '+5491100000002', date '1991-02-02');
  insert into public.players (display_name, type) values ('SS prov', 'provisional') returning player_id into v_prov;
  select email into v_b_email from auth.users where id = pg_temp._id('B_uid');
  insert into public.legal_versions (legal_version) values ('legal_v1') on conflict do nothing;
  insert into public.legal_acceptances (player_id, legal_version, accepted_at, source) values (pg_temp._id('A'), 'legal_v1', now() - interval '2 days', 'signup');

  -- partido compartido A+B (pendiente) con sets y nota privada de A
  insert into public.matches (created_by_player_id, participant_fingerprint, format_id, played_at, status, action_side, validation_deadline_at)
    values (pg_temp._id('A'), 'ss-fp-1', 'classic', now() - interval '1 day', 'pending_validation', 'B', now() + interval '20 days') returning match_id into v_m;
  insert into public.match_participants (match_id, team, position_in_team, player_id, display_name_snapshot) values
    (v_m, 'A', 1, pg_temp._id('A'), 'SS A'), (v_m, 'B', 1, pg_temp._id('B'), 'SS B');
  insert into public.match_revisions (match_id, revision_number, proposed_by_player_id, proposed_by_team, source, played_at)
    values (v_m, 1, pg_temp._id('A'), 'A', 'created', now() - interval '1 day') returning revision_id into v_r1;
  insert into public.match_sets (match_id, revision_number, set_number, games_a, games_b) values (v_m, 1, 1, 6, 2);
  update public.matches set current_revision_id = v_r1 where match_id = v_m;
  insert into public.match_user_state (match_id, player_id, hidden, private_note) values (v_m, pg_temp._id('A'), false, 'nota propia de A');

  -- R1
  v := public.resolve_player_for_account_deletion(pg_temp._id('A_uid'));
  perform pg_temp._assert((v ->> 'ok')::boolean and (v ->> 'playerId')::uuid = pg_temp._id('A') and not (v ->> 'alreadyDeleted')::boolean, 'R1 resuelve por auth user');
  perform pg_temp._assert(not (public.resolve_player_for_account_deletion(gen_random_uuid()) ->> 'ok')::boolean, 'R1 desconocido');
  perform pg_temp._assert(not (public.resolve_player_for_account_deletion(null) ->> 'ok')::boolean, 'R1 null');

  -- X1 antes de eliminar
  v := public.admin_export_player_data(pg_temp._id('A'));
  v_text := v::text;
  perform pg_temp._assert((v ->> 'ok')::boolean, 'X1 ok');
  perform pg_temp._assert(v #>> '{account,email}' like 'ss_a_%@example.test', 'X1 email propio');
  perform pg_temp._assert(v #>> '{profile,phone}' = '+5491100000001' and v #>> '{profile,birth_date}' = '1990-01-01', 'X1 datos propios completos');
  perform pg_temp._assert(jsonb_array_length(v -> 'legalAcceptances') = 1, 'X1 aceptaciones');
  perform pg_temp._assert(jsonb_array_length(v -> 'matches') = 1, 'X1 partidos');
  perform pg_temp._assert(v #>> '{matches,0,myPrivateState,privateNote}' = 'nota propia de A', 'X1 nota privada propia');
  perform pg_temp._assert(v #>> '{matches,0,sets,0,gamesA}' = '6', 'X1 sets de la revisión vigente');
  -- X1 terceros: solo el nombre mostrado
  perform pg_temp._assert(v_text like '%SS B%', 'X1 nombre mostrado del rival presente');
  perform pg_temp._assert(position(pg_temp._id('B')::text in v_text) = 0, 'X1 sin player_id del rival');
  perform pg_temp._assert(position(v_b_email in v_text) = 0 and position('ss_b_' in v_text) = 0, 'X1 sin email/username del rival');
  perform pg_temp._assert(position('+5491100000002' in v_text) = 0 and position('1991-02-02' in v_text) = 0, 'X1 sin teléfono/nacimiento del rival');
  -- X2 sin internals
  perform pg_temp._assert(position('memory_after' in v_text) = 0 and position('"audit"' in v_text) = 0 and position('encrypted_password' in v_text) = 0, 'X2 sin internals/secretos');

  -- R1 retry: Fase 1 de P0.3 deja auth_user_id nulo; la auditoría permite resolver de nuevo
  perform public.admin_delete_player_account(pg_temp._id('A'));
  v := public.resolve_player_for_account_deletion(pg_temp._id('A_uid'));
  perform pg_temp._assert((v ->> 'ok')::boolean and (v ->> 'playerId')::uuid = pg_temp._id('A') and (v ->> 'alreadyDeleted')::boolean, 'R1 retry por auditoría');
  perform public.admin_finalize_player_account_deletion(pg_temp._id('A'));
  perform pg_temp._assert(not (public.resolve_player_for_account_deletion(pg_temp._id('A_uid')) ->> 'ok')::boolean, 'R1 tras finalizar ya no resuelve (authUserId purgado)');

  -- X2 cuentas no exportables
  perform pg_temp._assert(public.admin_export_player_data(pg_temp._id('A')) ->> 'code' = 'account_deleted', 'X2 eliminada');
  perform pg_temp._assert(public.admin_export_player_data(v_prov) ->> 'code' = 'not_a_registered_account', 'X2 provisional');
  perform pg_temp._assert(public.admin_export_player_data(gen_random_uuid()) ->> 'code' = 'player_not_found', 'X2 inexistente');

  perform pg_temp._assert(has_function_privilege('service_role', 'public.admin_export_player_data(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.resolve_player_for_account_deletion(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.admin_export_player_data(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.admin_export_player_data(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.resolve_player_for_account_deletion(uuid)', 'EXECUTE'), 'X2 permisos');
end $$;

select 'V0420_SELF_SERVICE_VERIFY_OK' as result;
rollback;
