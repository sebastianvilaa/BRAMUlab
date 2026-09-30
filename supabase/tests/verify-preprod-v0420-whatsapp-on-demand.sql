-- BRAMUlab — V04.20 (L2): verificación transaccional de 20260930300000_preprod_v0420_whatsapp_on_demand.sql. ROLLBACK al final.
--  W1 get_public_profile NO expone teléfono: columna whatsapp_contact_available (true solo con consentimiento + número)
--  W2 get_whatsapp_contact entrega el número SOLO con consentimiento activo en ese instante
--  W3 revocar consentimiento corta la entrega INMEDIATAMENTE (misma transacción)
--  W4 toda no-disponibilidad responde igual (sin enumeración): sin consentimiento, sin número, inexistente, provisional, uno mismo
--  W5 rate limit (10/60s) y permisos (anon sin EXECUTE)
begin;

create temporary table _t (k text primary key, v uuid) on commit drop;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$ select v from pg_temp._t where k = p_key $$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if; end $$;
create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._t where k = p_key)), true); end $$;
create or replace function pg_temp._mk(p_key text, p_phone text, p_consent boolean) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'wa_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('WA ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name, phone, allow_whatsapp_contact)
    values (v_pid, 'wa_' || lower(p_key) || substr(v_uid::text, 1, 6), 'WA', p_key, 'WA ' || p_key, p_phone, p_consent);
  insert into pg_temp._t values (p_key, v_pid);
end $$;

do $$
declare v jsonb; r record; i integer; v_fail boolean; v_prov uuid;
begin
  perform pg_temp._mk('A', null, false);
  perform pg_temp._mk('B', '+5491122334455', true);
  perform pg_temp._mk('C', '+5491166778899', false);   -- número cargado, SIN consentimiento
  perform pg_temp._mk('D', null, true);                -- consentimiento, SIN número
  insert into public.players (display_name, type) values ('WA prov', 'provisional') returning player_id into v_prov;

  perform pg_temp._as('A');

  -- W1
  select * into r from public.get_public_profile(pg_temp._id('B'));
  perform pg_temp._assert(to_jsonb(r) ? 'whatsapp_contact_available' and not (to_jsonb(r) ? 'whatsapp_phone'), 'W1 columna nueva, sin whatsapp_phone');
  perform pg_temp._assert((to_jsonb(r) ->> 'whatsapp_contact_available')::boolean, 'W1 B disponible');
  perform pg_temp._assert(position('+549' in to_jsonb(r)::text) = 0, 'W1 el perfil público no contiene el número');
  select * into r from public.get_public_profile(pg_temp._id('C'));
  perform pg_temp._assert(not (to_jsonb(r) ->> 'whatsapp_contact_available')::boolean, 'W1 C (sin consentimiento) no disponible');
  select * into r from public.get_public_profile(pg_temp._id('D'));
  perform pg_temp._assert(not (to_jsonb(r) ->> 'whatsapp_contact_available')::boolean, 'W1 D (sin número) no disponible');

  -- W2
  v := public.get_whatsapp_contact(pg_temp._id('B'));
  perform pg_temp._assert((v ->> 'ok')::boolean and v ->> 'phone' = '+5491122334455', 'W2 entrega con consentimiento');

  -- W4 (misma respuesta exacta)
  perform pg_temp._assert(public.get_whatsapp_contact(pg_temp._id('C')) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W4 sin consentimiento');
  perform pg_temp._assert(public.get_whatsapp_contact(pg_temp._id('D')) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W4 sin número');
  perform pg_temp._assert(public.get_whatsapp_contact(gen_random_uuid()) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W4 inexistente');
  perform pg_temp._assert(public.get_whatsapp_contact(v_prov) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W4 provisional');
  perform pg_temp._assert(public.get_whatsapp_contact(pg_temp._id('A')) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W4 uno mismo');

  -- W3: B revoca => corte inmediato
  update public.profiles set allow_whatsapp_contact = false where player_id = pg_temp._id('B');
  perform pg_temp._assert(public.get_whatsapp_contact(pg_temp._id('B')) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W3 revocado => no se entrega');
  select * into r from public.get_public_profile(pg_temp._id('B'));
  perform pg_temp._assert(not (to_jsonb(r) ->> 'whatsapp_contact_available')::boolean, 'W3 el perfil deja de anunciarlo');
  update public.profiles set allow_whatsapp_contact = true where player_id = pg_temp._id('B');
  -- cuenta eliminada => tampoco
  update public.players set deleted_at = now(), is_active = false where player_id = pg_temp._id('B');
  perform pg_temp._assert(public.get_whatsapp_contact(pg_temp._id('B')) = '{"ok": false, "code": "unavailable"}'::jsonb, 'W3 cuenta eliminada => no se entrega');
  update public.players set deleted_at = null, is_active = true where player_id = pg_temp._id('B');

  -- W5: rate limit 10/60s (ya se consumieron 7 llamadas arriba)
  v_fail := false;
  for i in 1..10 loop
    begin perform public.get_whatsapp_contact(pg_temp._id('B'));
    exception when others then v_fail := sqlerrm like '%rate_limited%'; exit; end;
  end loop;
  perform pg_temp._assert(v_fail, 'W5 rate limit');

  perform pg_temp._assert(not has_function_privilege('anon', 'public.get_whatsapp_contact(uuid)', 'EXECUTE')
    and not has_function_privilege('public', 'public.get_whatsapp_contact(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_whatsapp_contact(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.get_public_profile(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_public_profile(uuid)', 'EXECUTE'), 'W5 permisos');
end $$;

select 'V0420_WHATSAPP_VERIFY_OK' as result;
rollback;
