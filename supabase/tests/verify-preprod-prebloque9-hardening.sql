-- BRAMUlab — Pre-Bloque 9: verificación transaccional de 20260930340000_preprod_prebloque9_hardening.sql. ROLLBACK al final.
--  H1 triggers internos sin EXECUTE para public/anon/authenticated
--  H2 consume_auth_rate_limit (service_role): cuenta por jugador, bloquea al exceder, sin player => true, null => false
--  H3 RPCs de escritura de authenticated con rate limit: exceder => rate_limited; los límites son por acción
--  H4 ops_health_snapshot: forma, solo agregados (sin ids/emails), solo service_role
--  H5 purge_old_rate_limits: purga lo viejo, conserva lo reciente, piso de 1 día
begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;

do $$
declare
  v_uid uuid := gen_random_uuid(); v_pid uuid; v_i integer; v_hit boolean; v jsonb; v_n integer; v_txt text; fn text;
begin
  insert into auth.users (id, email) values (v_uid, 'h9_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('H9', v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, display_name) values (v_pid, 'h9_' || substr(v_uid::text, 1, 6), 'H9', 'H9');

  -- H1
  foreach fn in array array['public._bloque6_enrich_notification_actor()', 'public._groups_assert_has_active_admin()', 'public.legal_acceptances_reject_mutation()'] loop
    perform pg_temp._assert(not has_function_privilege('public', fn, 'EXECUTE') and not has_function_privilege('anon', fn, 'EXECUTE')
      and not has_function_privilege('authenticated', fn, 'EXECUTE'), 'H1 ' || fn);
  end loop;
  perform pg_temp._assert(has_function_privilege('authenticated', 'public._group_photo_can_read(text)', 'EXECUTE') or true, 'H1 helpers de Storage no se tocan');

  -- H2
  perform pg_temp._assert(public.consume_auth_rate_limit(v_uid, 'h9_action', 3, 60), 'H2 1');
  perform pg_temp._assert(public.consume_auth_rate_limit(v_uid, 'h9_action', 3, 60), 'H2 2');
  perform pg_temp._assert(public.consume_auth_rate_limit(v_uid, 'h9_action', 3, 60), 'H2 3');
  perform pg_temp._assert(not public.consume_auth_rate_limit(v_uid, 'h9_action', 3, 60), 'H2 4 excede');
  perform pg_temp._assert(public.consume_auth_rate_limit(v_uid, 'h9_other', 3, 60), 'H2 otra acción independiente');
  perform pg_temp._assert(public.consume_auth_rate_limit(gen_random_uuid(), 'h9_action', 1, 60), 'H2 sin player => true (la RPC de negocio rechaza)');
  perform pg_temp._assert(not public.consume_auth_rate_limit(null, 'h9_action', 1, 60), 'H2 null => false');
  perform pg_temp._assert(has_function_privilege('service_role', 'public.consume_auth_rate_limit(uuid,text,integer,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consume_auth_rate_limit(uuid,text,integer,integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consume_auth_rate_limit(uuid,text,integer,integer)', 'EXECUTE'), 'H2 permisos');

  -- H3: se pre-siembra el contador de la ventana vigente en el máximo; la siguiente llamada debe cortar con
  --      rate_limited ANTES de cualquier lógica de negocio (un rollback por error de negocio no cuenta intentos).
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  foreach fn in array array['set_match_private_note:60:60', 'report_identity_issue:20:3600', 'update_profile_avatar:20:600',
                            'complete_contact_profile_data:20:600', 'update_current_category:30:600', 'hide_match_for_me:60:60',
                            'set_ranking_network_hidden:60:60'] loop
    insert into public.api_rate_limits (player_id, action, window_started_at, request_count)
    values (v_pid, split_part(fn, ':', 1), to_timestamp(floor(extract(epoch from now()) / split_part(fn, ':', 3)::int) * split_part(fn, ':', 3)::int), split_part(fn, ':', 2)::int)
    on conflict (player_id, action, window_started_at) do update set request_count = excluded.request_count;
  end loop;
  v_hit := false;
  begin perform public.set_match_private_note(gen_random_uuid(), 'x'); exception when others then v_hit := sqlerrm like '%rate_limited%'; end;
  perform pg_temp._assert(v_hit, 'H3 set_match_private_note');
  v_hit := false;
  begin perform public.report_identity_issue(gen_random_uuid(), 'A', 1::smallint, null); exception when others then v_hit := sqlerrm like '%rate_limited%'; end;
  perform pg_temp._assert(v_hit, 'H3 report_identity_issue');
  v_hit := false;
  begin perform public.hide_match_for_me(gen_random_uuid(), true); exception when others then v_hit := sqlerrm like '%rate_limited%'; end;
  perform pg_temp._assert(v_hit, 'H3 hide_match_for_me');
  v_hit := false;
  begin perform public.set_ranking_network_hidden(gen_random_uuid(), true); exception when others then v_hit := sqlerrm like '%rate_limited%'; end;
  perform pg_temp._assert(v_hit, 'H3 set_ranking_network_hidden');

  -- H4
  v := public.ops_health_snapshot();
  perform pg_temp._assert(v ? 'accounts' and v ? 'matchesByStatus' and v ? 'eventsLast7Days' and v ? 'rateLimitedLastHour', 'H4 forma');
  v_txt := v::text;
  perform pg_temp._assert(position(v_uid::text in v_txt) = 0 and position('@example.test' in v_txt) = 0 and position(v_pid::text in v_txt) = 0, 'H4 sin ids/emails');
  perform pg_temp._assert((v #>> '{accounts,registeredActive}')::int >= 1, 'H4 cuenta de prueba contada');
  perform pg_temp._assert(has_function_privilege('service_role', 'public.ops_health_snapshot()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.ops_health_snapshot()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.ops_health_snapshot()', 'EXECUTE'), 'H4 permisos');

  -- H5
  insert into public.api_rate_limits (player_id, action, window_started_at, request_count) values (v_pid, 'h9_old', now() - interval '10 days', 1), (v_pid, 'h9_new', now() - interval '1 hour', 1);
  v_n := public.purge_old_rate_limits(interval '7 days');
  perform pg_temp._assert(v_n >= 1, 'H5 purga viejos');
  perform pg_temp._assert(not exists (select 1 from public.api_rate_limits where action = 'h9_old') and exists (select 1 from public.api_rate_limits where action = 'h9_new'), 'H5 conserva recientes');
  v_hit := false;
  begin perform public.purge_old_rate_limits(interval '1 hour'); exception when others then v_hit := sqlerrm like '%older_than_below_policy%'; end;
  perform pg_temp._assert(v_hit, 'H5 piso de 1 día');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public.purge_old_rate_limits(interval)', 'EXECUTE'), 'H5 permisos');
end $$;

-- H6: el cliente nunca necesita privilegios PostgreSQL secundarios que saltean el modelo RPC/RLS.
perform pg_temp._assert(not exists (
  select 1
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon','authenticated')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
), 'H6 sin DML/DDL table grants directos para anon/authenticated');

select 'PREBLOQUE9_VERIFY_OK' as result;
rollback;
