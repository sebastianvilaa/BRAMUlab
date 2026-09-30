-- BRAMUlab — Grupos BRAMU B2c: verificación transaccional de
-- 20260930120000_preprod_grupos_b2c_group_photo.sql. Requiere Fase A + B1 + B2a + esta
-- migración aplicadas. Crea sus propios fixtures (auth.users+players+profiles) y termina en
-- ROLLBACK: no deja nada.
--
-- Cubre (Issue #5 §10 + revisión técnica de Storage/privacidad):
--  T1  columna photo_path + event_type photo_changed aceptado
--  T2  update_group_photo: admin OK / miembro no-admin, no-miembro, removido rechazados
--  T3  ruta inválida (otro group_id, URL, traversal, carpeta anidada) rechazada; null quita
--  T4  idempotencia (changed:false, sin evento nuevo) + photo_changed mueve lastActivityAt
--  T5  photoPath en get_group_detail / list_my_groups / get_groups_lobby
--  T6  RLS Storage: SELECT miembro sí / no-miembro no / removido no; INSERT/UPDATE/DELETE solo admin;
--      carpeta de otro grupo rechazada
--  T7  delete_group: photo_path null; no se puede subir/modificar, el admin sí puede limpiar el
--      objeto; un miembro común / removido no lo ve
--  T8  P0.3: grupo de UN solo miembro -> borrado lógico + photo_path null; grupo con otros
--      miembros intacto
--  T9  permisos de ejecución (anon no ejecuta update_group_photo)

begin;

create temporary table _b2c (k text primary key, v uuid) on commit drop;

create or replace function pg_temp._as(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select pl.auth_user_id::text from public.players pl where pl.player_id = (select v from pg_temp._b2c where k = p_key)), true);
end $$;
create or replace function pg_temp._id(p_key text) returns uuid language sql as $$
  select v from pg_temp._b2c where k = p_key
$$;
create or replace function pg_temp._assert(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'ASSERT_FAILED: %', p_msg; end if;
end $$;
-- Ejecuta una sentencia SQL como el rol `authenticated` con la sesión de p_key y devuelve
-- 'ok' o 'denied' (RLS/permiso). Siempre vuelve al rol original.
create or replace function pg_temp._try(p_key text, p_sql text) returns text language plpgsql as $$
declare v_res text := 'ok';
begin
  perform pg_temp._as(p_key);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    get diagnostics v_res = row_count;
    v_res := case when v_res::int = 0 then 'zero_rows' else 'ok' end;
  exception when others then
    v_res := 'denied';
  end;
  execute 'reset role';
  return v_res;
end $$;

do $$
declare v_key text; v_uid uuid; v_pid uuid;
begin
  foreach v_key in array array['A','B','C','D'] loop
    v_uid := gen_random_uuid();
    insert into auth.users (id, email) values (v_uid, 'b2c_' || lower(v_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
    insert into public.players (display_name, auth_user_id) values ('B2C ' || v_key, v_uid) returning player_id into v_pid;
    insert into public.profiles (player_id, username, first_name, last_name, display_name)
      values (v_pid, 'b2c_' || lower(v_key) || substr(v_uid::text, 1, 6), 'B2C', v_key, 'B2C ' || v_key);
    insert into pg_temp._b2c values (v_key, v_pid);
  end loop;
end $$;

-- A crea G1 con B y D (A admin). C ajeno. D se remueve más abajo.
select pg_temp._as('A');
do $$
declare v jsonb;
begin
  v := public.create_group('B2C Uno', array[pg_temp._id('B'), pg_temp._id('D')]);
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G1: ' || v::text);
  insert into pg_temp._b2c values ('G1', (v->'group'->>'groupId')::uuid);
  v := public.create_group('B2C Solo', '{}');
  perform pg_temp._assert((v->>'ok')::boolean, 'fixture G2: ' || v::text);
  insert into pg_temp._b2c values ('G2', (v->'group'->>'groupId')::uuid);
  perform pg_temp._assert(public.remove_group_member(pg_temp._id('G1'), pg_temp._id('D'))->>'ok' = 'true', 'fixture remove D');
end $$;

-- ---------- T1 ----------
do $$
begin
  perform pg_temp._assert(exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='groups' and column_name='photo_path'), 'T1 columna photo_path');
  perform pg_temp._assert((select photo_path is null from public.groups where group_id = pg_temp._id('G1')), 'T1 photo_path arranca null');
  insert into public.group_events (group_id, event_type, actor_player_id)
    values (pg_temp._id('G1'), 'photo_changed', pg_temp._id('A'));
  delete from public.group_events where group_id = pg_temp._id('G1') and event_type = 'photo_changed';
end $$;

-- ---------- T2 permisos de update_group_photo ----------
do $$
declare v jsonb; p text := pg_temp._id('G1')::text || '/1700000000000.jpg';
begin
  perform pg_temp._as('B');
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert(v->>'code' = 'not_admin', 'T2 miembro no-admin rechazado: ' || v::text);
  perform pg_temp._as('C');
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert(v->>'code' = 'group_not_found', 'T2 no-miembro rechazado: ' || v::text);
  perform pg_temp._as('D');
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert(v->>'code' = 'group_not_found', 'T2 removido rechazado: ' || v::text);
  perform pg_temp._assert((select photo_path is null from public.groups where group_id = pg_temp._id('G1')), 'T2 nada cambió');
  perform pg_temp._as('A');
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'T2 admin OK: ' || v::text);
  perform pg_temp._assert(v->'group'->>'photoPath' = p, 'T2 detalle devuelve photoPath');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = pg_temp._id('G1') and event_type = 'photo_changed'), 'T2 evento photo_changed');
end $$;

-- ---------- T3 rutas inválidas / null ----------
do $$
declare v jsonb; g text := pg_temp._id('G1')::text; o text := pg_temp._id('G2')::text; cur text;
  bad text[];
  x text;
begin
  perform pg_temp._as('A');
  select photo_path into cur from public.groups where group_id = pg_temp._id('G1');
  bad := array[
    o || '/x.jpg',                       -- carpeta de OTRO grupo
    'https://evil.example/' || g || '/x.jpg',
    '//' || g || '/x.jpg',
    g || '/../' || o || '/x.jpg',
    g || '/sub/x.jpg',
    g || '/',
    g,
    '/' || g || '/x.jpg',
    g || '/x y.jpg',
    g || '/x.jpg?token=1'
  ];
  foreach x in array bad loop
    v := public.update_group_photo(pg_temp._id('G1'), x);
    perform pg_temp._assert(v->>'code' = 'invalid_photo_path', 'T3 rechazada: ' || x || ' -> ' || v::text);
  end loop;
  perform pg_temp._assert((select photo_path from public.groups where group_id = pg_temp._id('G1')) = cur, 'T3 la foto vigente no cambió');
  -- quitar
  v := public.update_group_photo(pg_temp._id('G1'), null);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean and v->'group'->>'photoPath' is null, 'T3 null quita: ' || v::text);
  perform pg_temp._assert((select photo_path is null from public.groups where group_id = pg_temp._id('G1')), 'T3 photo_path null');
  -- el CHECK estructural también rechaza escrituras directas malas
  begin
    update public.groups set photo_path = 'http://x/y.jpg' where group_id = pg_temp._id('G1');
    raise exception 'ASSERT_FAILED: T3 CHECK debía rechazar';
  exception when check_violation then null;
  end;
end $$;

-- ---------- T4 idempotencia + actividad ----------
do $$
declare v jsonb; p text := pg_temp._id('G1')::text || '/1700000000001.jpg';
  la1 timestamptz; la2 timestamptz; n1 int; n2 int;
begin
  perform pg_temp._as('A');
  la1 := (select (g->>'lastActivityAt')::timestamptz from jsonb_array_elements(public.get_groups_lobby()->'groups') g where g->>'groupId' = pg_temp._id('G1')::text);
  perform pg_sleep(0.02);
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert((v->>'changed')::boolean, 'T4 alta');
  la2 := (select (g->>'lastActivityAt')::timestamptz from jsonb_array_elements(public.get_groups_lobby()->'groups') g where g->>'groupId' = pg_temp._id('G1')::text);
  perform pg_temp._assert(la2 > la1, 'T4 photo_changed mueve lastActivityAt');
  select count(*) into n1 from public.group_events where group_id = pg_temp._id('G1') and event_type = 'photo_changed';
  v := public.update_group_photo(pg_temp._id('G1'), p);
  perform pg_temp._assert((v->>'ok')::boolean and not (v->>'changed')::boolean, 'T4 idempotente: ' || v::text);
  select count(*) into n2 from public.group_events where group_id = pg_temp._id('G1') and event_type = 'photo_changed';
  perform pg_temp._assert(n1 = n2, 'T4 sin evento nuevo');
end $$;

-- ---------- T5 photoPath en los 3 contratos de lectura ----------
do $$
declare p text := pg_temp._id('G1')::text || '/1700000000001.jpg';
begin
  perform pg_temp._as('B');
  perform pg_temp._assert(public.get_group_detail(pg_temp._id('G1'))->'group'->>'photoPath' = p, 'T5 get_group_detail');
  perform pg_temp._assert((select g->>'photoPath' from jsonb_array_elements(public.list_my_groups()->'groups') g where g->>'groupId' = pg_temp._id('G1')::text) = p, 'T5 list_my_groups');
  perform pg_temp._assert((select g->>'photoPath' from jsonb_array_elements(public.get_groups_lobby()->'groups') g where g->>'groupId' = pg_temp._id('G1')::text) = p, 'T5 get_groups_lobby');
  perform pg_temp._as('A');
  perform pg_temp._assert((select g->>'photoPath' from jsonb_array_elements(public.get_groups_lobby()->'groups') g where g->>'groupId' = pg_temp._id('G2')::text) is null, 'T5 grupo sin foto -> null');
end $$;

-- ---------- T6 RLS de Storage ----------
do $$
declare g text := pg_temp._id('G1')::text; o text := pg_temp._id('G2')::text;
  n int;
begin
  perform pg_temp._assert((select public = false from storage.buckets where id = 'group-photos'), 'T6 bucket privado');
  -- INSERT: solo admin, solo su carpeta
  perform pg_temp._assert(pg_temp._try('A', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/a.jpg')$f$, g)) = 'ok', 'T6 admin inserta');
  perform pg_temp._assert(pg_temp._try('B', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/b.jpg')$f$, g)) = 'denied', 'T6 miembro común NO inserta');
  perform pg_temp._assert(pg_temp._try('C', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/c.jpg')$f$, g)) = 'denied', 'T6 no-miembro NO inserta');
  perform pg_temp._assert(pg_temp._try('D', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/d.jpg')$f$, g)) = 'denied', 'T6 removido NO inserta');
  perform pg_temp._assert(pg_temp._try('A', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/z.jpg')$f$, pg_temp._id('C'))) = 'denied', 'T6 carpeta que no es un grupo propio');
  perform pg_temp._assert(pg_temp._try('B', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/z.jpg')$f$, o)) = 'denied', 'T6 B no es admin de G2');
  perform pg_temp._assert(pg_temp._try('A', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/sub/z.jpg')$f$, g)) = 'denied', 'T6 subcarpeta rechazada');
  -- SELECT / firma
  perform pg_temp._as('B'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos' and name = g || '/a.jpg'; execute 'reset role';
  perform pg_temp._assert(n = 1, 'T6 miembro VE el objeto');
  perform pg_temp._as('C'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos'; execute 'reset role';
  perform pg_temp._assert(n = 0, 'T6 no-miembro no ve nada');
  perform pg_temp._as('D'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos'; execute 'reset role';
  perform pg_temp._assert(n = 0, 'T6 miembro REMOVIDO ya no ve (no puede firmar)');
  -- UPDATE / DELETE
  perform pg_temp._assert(pg_temp._try('B', format($f$update storage.objects set name = name where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) in ('zero_rows','denied'), 'T6 miembro común NO actualiza');
  perform pg_temp._assert(pg_temp._try('B', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) in ('zero_rows','denied'), 'T6 miembro común NO borra');
  perform pg_temp._assert(pg_temp._try('C', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) in ('zero_rows','denied'), 'T6 no-miembro NO borra');
  perform pg_temp._assert(pg_temp._try('A', format($f$update storage.objects set owner = owner where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) = 'ok', 'T6 admin actualiza');
  perform pg_temp._assert((select count(*) from storage.objects where bucket_id='group-photos' and name = g || '/a.jpg') = 1, 'T6 el objeto sigue tras los intentos ajenos');
end $$;

-- ---------- T7 delete_group: sin escritura, cleanup por admin, sin lectura de miembros comunes ----------
do $$
declare g text := pg_temp._id('G1')::text; v jsonb; n int;
begin
  perform pg_temp._as('A');
  v := public.delete_group(pg_temp._id('G1'));
  perform pg_temp._assert((v->>'ok')::boolean, 'T7 delete_group: ' || v::text);
  perform pg_temp._assert((select photo_path is null and status = 'deleted' from public.groups where group_id = pg_temp._id('G1')), 'T7 photo_path null + deleted');
  perform pg_temp._assert(pg_temp._try('A', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/new.jpg')$f$, g)) = 'denied', 'T7 no se puede subir a un grupo deleted');
  perform pg_temp._assert(pg_temp._try('A', format($f$update storage.objects set owner = owner where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) in ('zero_rows','denied'), 'T7 no se puede modificar');
  perform pg_temp._as('B'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos' and name like g || '/%'; execute 'reset role';
  perform pg_temp._assert(n = 0, 'T7 miembro común ya no ve el objeto del grupo eliminado');
  perform pg_temp._assert(pg_temp._try('B', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) in ('zero_rows','denied'), 'T7 miembro común NO borra');
  perform pg_temp._assert(pg_temp._try('A', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g)) = 'ok', 'T7 el admin SÍ limpia el objeto');
  perform pg_temp._assert((select count(*) from storage.objects where bucket_id='group-photos' and name like g || '/%') = 0, 'T7 objeto borrado');
end $$;

-- ---------- T8 P0.3 ----------
do $$
declare v jsonb; gsolo uuid; gmulti uuid; pa uuid := pg_temp._id('A');
begin
  -- G2 (solo A) con foto; G3 con A + B (B seguirá activo).
  perform pg_temp._as('A');
  perform public.update_group_photo(pg_temp._id('G2'), pg_temp._id('G2')::text || '/1700000000002.jpg');
  v := public.create_group('B2C Multi', array[pg_temp._id('B')]);
  gmulti := (v->'group'->>'groupId')::uuid;
  perform public.update_group_photo(gmulti, gmulti::text || '/1700000000003.jpg');
  gsolo := pg_temp._id('G2');
  perform pg_temp._assert((select photo_path is not null from public.groups where group_id = gsolo), 'T8 fixture con foto');

  v := public.admin_delete_player_account(pa);
  perform pg_temp._assert((v->>'ok')::boolean, 'T8 admin_delete_player_account: ' || v::text);
  perform pg_temp._assert((select status = 'deleted' and photo_path is null and deleted_by_player_id = pa from public.groups where group_id = gsolo), 'T8 grupo de un solo miembro -> deleted + photo_path null + deleted_by');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = gsolo and event_type = 'deleted' and actor_player_id = pa), 'T8 evento deleted');
  perform pg_temp._assert((select status = 'active' and photo_path is not null from public.groups where group_id = gmulti), 'T8 grupo con otros miembros INTACTO');
  -- idempotencia
  v := public.admin_delete_player_account(pa);
  perform pg_temp._assert((v->>'alreadyDeleted')::boolean, 'T8 idempotente');
end $$;

-- ---------- T9 permisos de ejecución ----------
do $$
begin
  perform pg_temp._assert(not has_function_privilege('anon', 'public.update_group_photo(uuid,text)', 'execute'), 'T9 anon NO ejecuta update_group_photo');
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.update_group_photo(uuid,text)', 'execute'), 'T9 authenticated sí');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public.admin_delete_player_account(uuid)', 'execute'), 'T9 authenticated NO ejecuta admin_delete_player_account');
end $$;

select 'B2C_VERIFY_OK' as result;
rollback;
