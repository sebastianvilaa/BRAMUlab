-- BRAMUlab — V04.19 (L1): verificación transaccional de
-- 20260930280000_preprod_l1_legal_acceptance_abandoned_signups.sql. Fixtures propios, termina en ROLLBACK.
--
--  V1  signUp con metadata legal_version => handle_email_confirmed registra 1 fila, accepted_at = auth.users.created_at
--  V2  sin metadata / versión desconocida => NO se registra nada (nunca se fabrica aceptación)
--  V3  complete_profile sin aceptación => legal_acceptance_required; con aceptación => ok y snapshot = accepted_at original
--  V4  retry de complete_profile NO mueve terms_accepted_at
--  V5  append-only: UPDATE y DELETE rechazados; cliente (authenticated/anon) sin DML ni SELECT directo
--  V6  accept_legal_version: idempotente (accepted_at original), rechaza versión no vigente/arbitraria, anon sin EXECUTE
--  V7  reaceptación: nueva versión vigente => requiresAcceptance=true => nueva FILA, la vieja intacta
--  V8  get_my_legal_status coherente
--  V9  list_abandoned_signups: solo no confirmados >= 24 h; nunca confirmados/con sesión; min_age < 24 h rechazado
--  V10 release_abandoned_signup_username: libera @usuario de alta abandonada (idempotente), NO toca confirmadas/jóvenes
--  V11 permisos de ejecución de las RPC de cleanup (solo service_role)

begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
-- Usuario Auth CONFIRMADO con metadata opcional (dispara handle_email_confirmed); created_at controlado.
create or replace function pg_temp._mk_user(p_key text, p_meta jsonb, p_created interval) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at)
    values (v_uid, 'l1_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test', now(), p_meta, now() - p_created);
  select player_id into v_pid from public.players where auth_user_id = v_uid;
  insert into pg_temp._t values (p_key, v_pid);
  insert into pg_temp._t values (p_key || '_uid', v_uid);
end $$;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', (select v::text from pg_temp._t where k = p_key || '_uid'), true); end $$;
create or replace function pg_temp._complete(p_username text) returns void language plpgsql as $$
begin
  perform public.complete_profile(p_username, 'L1', 'Test', 'L1 Test', null, null, null, null, null, 'AR', null, null, null, null, 'IGNORADO_POR_EL_SERVIDOR');
end $$;

-- ---------------------------------------------------------------- V1 / V2
do $$
declare v_row public.legal_acceptances; v_uid uuid; v_created timestamptz;
begin
  perform pg_temp._mk_user('OK', '{"legal_version":"legal_v1"}'::jsonb, interval '3 hours');
  perform pg_temp._mk_user('NOMETA', null, interval '1 hour');
  perform pg_temp._mk_user('BADVER', '{"legal_version":"legal_v999"}'::jsonb, interval '1 hour');
  perform pg_temp._mk_user('BLANK', '{"legal_version":"  "}'::jsonb, interval '1 hour');

  select * into v_row from public.legal_acceptances where player_id = pg_temp._id('OK');
  select created_at into v_created from auth.users where id = pg_temp._id('OK_uid');
  perform pg_temp._assert(v_row.acceptance_id is not null, 'V1 fila registrada');
  perform pg_temp._assert(v_row.legal_version = 'legal_v1' and v_row.source = 'signup', 'V1 version/source');
  perform pg_temp._assert(v_row.accepted_at = v_created, 'V1 accepted_at = auth.users.created_at (server clock)');
  perform pg_temp._assert((select count(*) from public.legal_acceptances where player_id = pg_temp._id('OK')) = 1, 'V1 una sola fila');

  perform pg_temp._assert(not exists (select 1 from public.legal_acceptances where player_id = pg_temp._id('NOMETA')), 'V2 sin metadata => sin fila');
  perform pg_temp._assert(not exists (select 1 from public.legal_acceptances where player_id = pg_temp._id('BADVER')), 'V2 version desconocida => sin fila');
  perform pg_temp._assert(not exists (select 1 from public.legal_acceptances where player_id = pg_temp._id('BLANK')), 'V2 blank => sin fila');
end $$;

-- ---------------------------------------------------------------- V3 / V4
do $$
declare v_p public.profiles; v_at timestamptz; v_fail boolean := false;
begin
  -- sin aceptación => rechazado y NO se toca el perfil
  perform pg_temp._as('NOMETA');
  begin
    perform pg_temp._complete('l1_nometa_' || substr(pg_temp._id('NOMETA_uid')::text, 1, 6));
  exception when others then v_fail := sqlerrm like '%legal_acceptance_required%'; end;
  perform pg_temp._assert(v_fail, 'V3 complete_profile sin aceptación => legal_acceptance_required');
  perform pg_temp._assert((select username from public.profiles where player_id = pg_temp._id('NOMETA')) is null, 'V3 perfil sin tocar');

  -- con aceptación => ok; snapshot = accepted_at original (NO now())
  perform pg_temp._as('OK');
  perform pg_temp._complete('l1_ok_' || substr(pg_temp._id('OK_uid')::text, 1, 6));
  select * into v_p from public.profiles where player_id = pg_temp._id('OK');
  select accepted_at into v_at from public.legal_acceptances where player_id = pg_temp._id('OK');
  perform pg_temp._assert(v_p.terms_version = 'legal_v1', 'V3 snapshot version viene de legal_acceptances (no del cliente)');
  perform pg_temp._assert(v_p.terms_accepted_at = v_at, 'V3 snapshot accepted_at = original');
  perform pg_temp._assert(v_at < now() - interval '2 hours', 'V3 accepted_at es el de la creación Auth, no now()');

  -- retry idempotente: nada se mueve
  perform pg_temp._complete('l1_ok_' || substr(pg_temp._id('OK_uid')::text, 1, 6));
  select * into v_p from public.profiles where player_id = pg_temp._id('OK');
  perform pg_temp._assert(v_p.terms_accepted_at = v_at, 'V4 retry no mueve terms_accepted_at');
  perform pg_temp._assert((select count(*) from public.legal_acceptances where player_id = pg_temp._id('OK')) = 1, 'V4 retry no duplica');
end $$;

-- ---------------------------------------------------------------- V5 append-only + permisos de tabla
do $$
declare v_blocked boolean;
begin
  v_blocked := false;
  begin update public.legal_acceptances set accepted_at = now() where player_id = pg_temp._id('OK');
  exception when others then v_blocked := sqlerrm like '%legal_acceptances_append_only%'; end;
  perform pg_temp._assert(v_blocked, 'V5 UPDATE rechazado');
  v_blocked := false;
  begin delete from public.legal_acceptances where player_id = pg_temp._id('OK');
  exception when others then v_blocked := sqlerrm like '%legal_acceptances_append_only%'; end;
  perform pg_temp._assert(v_blocked, 'V5 DELETE rechazado');

  perform pg_temp._assert(not has_table_privilege('authenticated', 'public.legal_acceptances', 'INSERT')
    and not has_table_privilege('authenticated', 'public.legal_acceptances', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.legal_acceptances', 'DELETE')
    and not has_table_privilege('authenticated', 'public.legal_acceptances', 'SELECT')
    and not has_table_privilege('anon', 'public.legal_acceptances', 'SELECT'), 'V5 cliente sin acceso directo');
  perform pg_temp._assert(has_table_privilege('service_role', 'public.legal_acceptances', 'INSERT')
    and not has_table_privilege('service_role', 'public.legal_acceptances', 'UPDATE')
    and not has_table_privilege('service_role', 'public.legal_acceptances', 'DELETE'), 'V5 service_role solo append');
  perform pg_temp._assert(has_table_privilege('anon', 'public.app_config', 'SELECT') and has_table_privilege('anon', 'public.legal_versions', 'SELECT'),
    'V5 versión vigente legible sin sesión (app_config + legal_versions)');
end $$;

-- ---------------------------------------------------------------- V6 / V7 / V8 accept_legal_version + reaceptación
do $$
declare v jsonb; v2 jsonb; v_at timestamptz; v_fail boolean;
begin
  perform pg_temp._as('NOMETA');
  v := public.get_my_legal_status();
  perform pg_temp._assert((v ->> 'requiresAcceptance')::boolean and v ->> 'currentVersion' = 'legal_v1' and v ->> 'latestAcceptedVersion' is null, 'V8 sin aceptación => requiresAcceptance');

  v_fail := false;
  begin perform public.accept_legal_version('legal_v0'); exception when others then v_fail := sqlerrm like '%legal_version_not_current%'; end;
  perform pg_temp._assert(v_fail, 'V6 versión antigua/arbitraria rechazada');
  v_fail := false;
  begin perform public.accept_legal_version(null); exception when others then v_fail := sqlerrm like '%legal_version_not_current%'; end;
  perform pg_temp._assert(v_fail, 'V6 null rechazado');

  v := public.accept_legal_version('legal_v1');
  perform pg_temp._assert((v ->> 'ok')::boolean and not (v ->> 'alreadyAccepted')::boolean, 'V6 primera aceptación');
  v_at := (v ->> 'acceptedAt')::timestamptz;
  v2 := public.accept_legal_version('legal_v1');
  perform pg_temp._assert((v2 ->> 'alreadyAccepted')::boolean and (v2 ->> 'acceptedAt')::timestamptz = v_at, 'V6 idempotente: accepted_at original');
  perform pg_temp._assert((select count(*) from public.legal_acceptances where player_id = pg_temp._id('NOMETA')) = 1, 'V6 una sola fila');
  perform pg_temp._assert((select source from public.legal_acceptances where player_id = pg_temp._id('NOMETA')) = 'reaccept', 'V6 source=reaccept');
  perform pg_temp._assert(not (public.get_my_legal_status() ->> 'requiresAcceptance')::boolean, 'V8 tras aceptar => ok');

  -- V7: cambio material de versión
  insert into public.legal_versions (legal_version) values ('legal_v2_test');
  update public.app_config set legal_version = 'legal_v2_test' where id = 1;
  v := public.get_my_legal_status();
  perform pg_temp._assert((v ->> 'requiresAcceptance')::boolean and v ->> 'latestAcceptedVersion' = 'legal_v1' and v ->> 'currentVersion' = 'legal_v2_test', 'V7 nueva versión => reaceptación');
  v_fail := false;
  begin perform public.accept_legal_version('legal_v1'); exception when others then v_fail := sqlerrm like '%legal_version_not_current%'; end;
  perform pg_temp._assert(v_fail, 'V7 no se puede "aceptar" la versión vieja');
  perform public.accept_legal_version('legal_v2_test');
  perform pg_temp._assert((select count(*) from public.legal_acceptances where player_id = pg_temp._id('NOMETA')) = 2, 'V7 append: 2 filas (la vieja intacta)');
  perform pg_temp._assert((select accepted_at from public.legal_acceptances where player_id = pg_temp._id('NOMETA') and legal_version = 'legal_v1') = v_at, 'V7 la aceptación vieja conserva su accepted_at');
  update public.app_config set legal_version = 'legal_v1' where id = 1;

  perform pg_temp._assert(not has_function_privilege('anon', 'public.accept_legal_version(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_my_legal_status()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.accept_legal_version(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_legal_acceptance(uuid,text,text,timestamptz)', 'EXECUTE'), 'V6 permisos de ejecución');
end $$;

-- ---------------------------------------------------------------- V9 list_abandoned_signups
create or replace function pg_temp._mk_unconfirmed(p_key text, p_age interval) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, created_at) values (v_uid, 'l1_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test', now() - p_age);
  insert into pg_temp._t values (p_key || '_uid', v_uid);
end $$;

do $$
declare v_fail boolean := false; v_ids uuid[];
begin
  perform pg_temp._mk_unconfirmed('AB_OLD', interval '30 hours');
  perform pg_temp._mk_unconfirmed('AB_EDGE', interval '24 hours 1 minute');
  perform pg_temp._mk_unconfirmed('AB_YOUNG', interval '23 hours');
  perform pg_temp._mk_user('CONF_OLD', '{"legal_version":"legal_v1"}'::jsonb, interval '500 hours');

  select array_agg(user_id) into v_ids from public.list_abandoned_signups(interval '24 hours', 1000);
  perform pg_temp._assert(pg_temp._id('AB_OLD_uid') = any(v_ids) and pg_temp._id('AB_EDGE_uid') = any(v_ids), 'V9 >=24 h listados');
  perform pg_temp._assert(not (pg_temp._id('AB_YOUNG_uid') = any(v_ids)), 'V9 <24 h NO listado');
  perform pg_temp._assert(not (pg_temp._id('CONF_OLD_uid') = any(v_ids)), 'V9 cuenta confirmada NUNCA listada');
  perform pg_temp._assert(not (pg_temp._id('OK_uid') = any(v_ids)) and not (pg_temp._id('NOMETA_uid') = any(v_ids)), 'V9 cuentas constituidas no listadas');

  begin perform * from public.list_abandoned_signups(interval '1 hour', 10); exception when others then v_fail := sqlerrm like '%min_age_below_policy%'; end;
  perform pg_temp._assert(v_fail, 'V9 min_age < 24 h rechazado');
end $$;

-- ---------------------------------------------------------------- V10 release_abandoned_signup_username
do $$
declare v jsonb; v_pid uuid; v_pid_young uuid; v_conf_user text;
begin
  -- @usuario atado a un alta abandonada (anómalo, defensa en profundidad)
  insert into public.players (display_name, auth_user_id) values ('L1 abandoned', pg_temp._id('AB_OLD_uid')) returning player_id into v_pid;
  insert into public.profiles (player_id, username) values (v_pid, 'l1_reserved_ab');
  insert into public.players (display_name, auth_user_id) values ('L1 young', pg_temp._id('AB_YOUNG_uid')) returning player_id into v_pid_young;
  insert into public.profiles (player_id, username) values (v_pid_young, 'l1_young_ab');
  select username into v_conf_user from public.profiles where player_id = pg_temp._id('OK');

  perform pg_temp._assert(not public.is_username_available('l1_reserved_ab'), 'V10 antes: @usuario ocupado');
  v := public.release_abandoned_signup_username(pg_temp._id('AB_OLD_uid'));
  perform pg_temp._assert((v ->> 'eligible')::boolean and (v ->> 'usernameReleased')::boolean, 'V10 liberado');
  perform pg_temp._assert((select username from public.profiles where player_id = v_pid) is null, 'V10 username null');
  perform pg_temp._assert(public.is_username_available('l1_reserved_ab'), 'V10 @usuario otra vez disponible');
  v := public.release_abandoned_signup_username(pg_temp._id('AB_OLD_uid'));
  perform pg_temp._assert((v ->> 'eligible')::boolean and not (v ->> 'usernameReleased')::boolean, 'V10 idempotente');

  -- NO toca: alta joven, cuenta confirmada/constituida, usuario inexistente
  v := public.release_abandoned_signup_username(pg_temp._id('AB_YOUNG_uid'));
  perform pg_temp._assert(not (v ->> 'eligible')::boolean and (select username from public.profiles where player_id = v_pid_young) = 'l1_young_ab', 'V10 joven intacto');
  v := public.release_abandoned_signup_username(pg_temp._id('OK_uid'));
  perform pg_temp._assert(not (v ->> 'eligible')::boolean and (select username from public.profiles where player_id = pg_temp._id('OK')) = v_conf_user, 'V10 constituida intacta');
  v := public.release_abandoned_signup_username(gen_random_uuid());
  perform pg_temp._assert(v ->> 'reason' = 'not_found', 'V10 inexistente => not_found');
end $$;

-- ---------------------------------------------------------------- V11 permisos cleanup
do $$
begin
  perform pg_temp._assert(has_function_privilege('service_role', 'public.list_abandoned_signups(interval,integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.release_abandoned_signup_username(uuid,interval)', 'EXECUTE'), 'V11 service_role puede');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public.list_abandoned_signups(interval,integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.list_abandoned_signups(interval,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.release_abandoned_signup_username(uuid,interval)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.release_abandoned_signup_username(uuid,interval)', 'EXECUTE'), 'V11 cliente NO puede');
end $$;

select 'L1_VERIFY_OK' as result;
rollback;
