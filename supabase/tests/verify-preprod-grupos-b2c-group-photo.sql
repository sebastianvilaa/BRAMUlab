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
--  T7  delete_group: photo_path null; no se puede subir/modificar; NADIE firma ni lee (ni el
--      admin, ni un miembro) tras el borrado; el admin SÍ puede listar y borrar el residuo
--      (operaciones de Storage list/delete), no `sign`/`get`
--  T8  P0.3 ↔ Grupos — matriz A–I del Issue #4 (una cuenta en 5 grupos, ver detalle abajo)
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
create or replace function pg_temp._try(p_key text, p_sql text, p_op text default null) returns text language plpgsql as $$
declare v_res text := 'ok';
begin
  perform pg_temp._as(p_key);
  perform set_config('storage.operation', coalesce(p_op, ''), true);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    get diagnostics v_res = row_count;
    v_res := case when v_res::int = 0 then 'zero_rows' else 'ok' end;
  exception when others then
    v_res := 'denied';
  end;
  execute 'reset role';
  perform set_config('storage.operation', '', true);
  return v_res;
end $$;
-- Cuenta filas visibles de storage.objects para p_key bajo RLS, con la operación de Storage indicada.
create or replace function pg_temp._visible(p_key text, p_like text, p_op text default null) returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp._as(p_key);
  perform set_config('storage.operation', coalesce(p_op, ''), true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos' and name like p_like;
  execute 'reset role';
  perform set_config('storage.operation', '', true);
  return n;
end $$;
create or replace function pg_temp._mk(p_key text) returns void language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_pid uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'b2c_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('B2C ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_pid, 'b2c_' || lower(p_key) || substr(v_uid::text, 1, 6), 'B2C', p_key, 'B2C ' || p_key);
  insert into pg_temp._b2c values (p_key, v_pid);
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
declare g text := pg_temp._id('G1')::text; v jsonb;
begin
  perform pg_temp._as('A');
  v := public.delete_group(pg_temp._id('G1'));
  perform pg_temp._assert((v->>'ok')::boolean, 'T7 delete_group: ' || v::text);
  perform pg_temp._assert((select photo_path is null and status = 'deleted' from public.groups where group_id = pg_temp._id('G1')), 'T7 photo_path null + deleted');
  perform pg_temp._assert(pg_temp._try('A', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/new.jpg')$f$, g), 'object.upload') = 'denied', 'T7 no se puede subir a un grupo deleted');
  perform pg_temp._assert(pg_temp._try('A', format($f$update storage.objects set owner = owner where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g), 'object.upload_update') in ('zero_rows','denied'), 'T7 no se puede modificar');
  -- lecturas / firmas: NADIE (ni el admin, ni un miembro común, ni un removido)
  perform pg_temp._assert(pg_temp._visible('A', g || '/%', 'object.sign') = 0, 'T7 el ADMIN no firma (sign) tras el delete');
  perform pg_temp._assert(pg_temp._visible('A', g || '/%', 'object.sign_many') = 0, 'T7 el ADMIN no firma en batch tras el delete');
  perform pg_temp._assert(pg_temp._visible('A', g || '/%', 'object.get_authenticated') = 0, 'T7 el ADMIN no lee/descarga tras el delete');
  perform pg_temp._assert(pg_temp._visible('A', g || '/%', null) = 0, 'T7 sin operación de Storage identificada tampoco');
  perform pg_temp._assert(pg_temp._visible('B', g || '/%', 'object.sign') = 0, 'T7 miembro común no firma tras el delete');
  perform pg_temp._assert(pg_temp._visible('B', g || '/%', 'object.list') = 0, 'T7 miembro común no lista tras el delete');
  perform pg_temp._assert(pg_temp._visible('C', g || '/%', 'object.list') = 0, 'T7 no-miembro no lista');
  perform pg_temp._assert(pg_temp._visible('D', g || '/%', 'object.list') = 0, 'T7 removido no lista');
  -- cleanup: el admin SÍ puede listar y borrar (operaciones list / delete)
  perform pg_temp._assert(pg_temp._visible('A', g || '/%', 'object.list') = 1, 'T7 el admin lista el residuo');
  perform pg_temp._assert(pg_temp._try('B', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg'$f$, g), 'object.delete') in ('zero_rows','denied'), 'T7 miembro común NO borra');
  perform pg_temp._assert(pg_temp._try('A', format($f$delete from storage.objects where bucket_id='group-photos' and name = '%s/a.jpg' returning name$f$, g), 'object.delete_many') = 'ok', 'T7 el admin SÍ limpia el objeto (delete_many)');
  perform pg_temp._assert((select count(*) from storage.objects where bucket_id='group-photos' and name like g || '/%') = 0, 'T7 objeto borrado');
end $$;

-- ---------- T8 P0.3 ↔ Grupos: matriz A–I (Issue #4) ----------
-- Una cuenta (X) en 5 grupos a la vez:
--   GA  X miembro NO admin, con otro admin (P2)                          -> A
--   GB  X admin, con otro admin (P3)                                      -> B
--   GC  X ÚLTIMO admin; otros P5 (joined 1d) y P4 (joined 2d)             -> C: sucesor P4 (joined_at asc)
--   GD  X único miembro/admin, con foto                                   -> D (borrado lógico + photo_path null)
--   GF  grupo ya deleted (por X) con período abierto                      -> F
--   (los 5 en UNA sola cuenta)                                            -> E
--   retry / terceros / constraint                                         -> G / H / I
do $$
declare v jsonb; x uuid;
  ga uuid; gb uuid; gc uuid; gd uuid; gf uuid;
  snap_before text; snap_after text; m_before bigint; mp_before bigint;
  ev_before bigint; ev_after bigint;
begin
  perform pg_temp._mk('X'); perform pg_temp._mk('P2'); perform pg_temp._mk('P3'); perform pg_temp._mk('P4'); perform pg_temp._mk('P5');
  x := pg_temp._id('X');
  perform pg_temp._as('P2'); v := public.create_group('B2C GA', array[x]); ga := (v->'group'->>'groupId')::uuid;
  perform pg_temp._as('X'); v := public.create_group('B2C GB', array[pg_temp._id('P3')]); gb := (v->'group'->>'groupId')::uuid;
  perform public.promote_group_admin(gb, pg_temp._id('P3'));
  v := public.create_group('B2C GC', array[pg_temp._id('P5'), pg_temp._id('P4')]); gc := (v->'group'->>'groupId')::uuid;
  update public.group_memberships set joined_at = now() - interval '1 day' where group_id = gc and player_id = pg_temp._id('P5');
  update public.group_memberships set joined_at = now() - interval '2 days' where group_id = gc and player_id = pg_temp._id('P4');
  update public.group_memberships set joined_at = now() - interval '3 days' where group_id = gc and player_id = x;
  v := public.create_group('B2C GD', '{}'); gd := (v->'group'->>'groupId')::uuid;
  perform public.update_group_photo(gd, gd::text || '/1700000000009.jpg');
  v := public.create_group('B2C GF', '{}'); gf := (v->'group'->>'groupId')::uuid;
  perform public.delete_group(gf);

  select coalesce(string_agg(group_id::text || player_id::text || joined_at::text || coalesce(left_at::text,'-'), '|' order by membership_id), '')
    into snap_before from public.group_memberships where player_id <> x and group_id in (ga, gb, gc);
  select count(*) into m_before from public.matches;
  select count(*) into mp_before from public.match_participants;
  perform pg_temp._assert(exists (select 1 from public.group_memberships where player_id = x and left_at is null and group_id = gf), 'T8 fixture: F tiene período abierto en grupo deleted');

  v := public.admin_delete_player_account(x);
  perform pg_temp._assert((v->>'ok')::boolean and not (v->>'alreadyDeleted')::boolean, 'T8 admin_delete_player_account: ' || v::text);

  -- I: el constraint diferido sigue PASS (forzado a inmediato dentro del ROLLBACK)
  set constraints group_memberships_require_active_admin immediate;
  set constraints group_memberships_require_active_admin deferred;

  -- E: todos los períodos de X cerrados, filas históricas conservadas
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where player_id = x and left_at is null), 'T8 E: ningún período abierto de X');
  perform pg_temp._assert((select count(*) from public.group_memberships where player_id = x and group_id in (ga, gb, gc, gd, gf)) = 5, 'T8 E: filas históricas conservadas');
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where player_id = x and (left_at < joined_at or removed_by_player_id is distinct from x)), 'T8 cierre: left_at >= joined_at y removed_by = X');

  -- A
  perform pg_temp._assert((select status = 'active' from public.groups where group_id = ga), 'T8 A: GA activo');
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = ga and player_id = pg_temp._id('P2') and left_at is null and is_admin), 'T8 A: P2 sigue admin');
  perform pg_temp._assert(not exists (select 1 from public.group_events where group_id = ga and event_type = 'admin_promoted' and metadata->>'reason' = 'account_deletion'), 'T8 A: sin promoción');
  -- B
  perform pg_temp._assert((select status = 'active' from public.groups where group_id = gb), 'T8 B: GB activo');
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = gb and player_id = pg_temp._id('P3') and left_at is null and is_admin), 'T8 B: P3 admin');
  perform pg_temp._assert(not exists (select 1 from public.group_events where group_id = gb and event_type = 'admin_promoted' and metadata->>'reason' = 'account_deletion'), 'T8 B: sin promoción');
  -- C
  perform pg_temp._assert((select status = 'active' from public.groups where group_id = gc), 'T8 C: GC activo');
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = gc and player_id = pg_temp._id('P4') and left_at is null and is_admin), 'T8 C: sucesor = P4 (joined_at más viejo)');
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where group_id = gc and player_id = pg_temp._id('P5') and is_admin), 'T8 C: P5 NO promovido');
  perform pg_temp._assert((select count(*) from public.group_events where group_id = gc and event_type = 'admin_promoted' and metadata->>'reason' = 'account_deletion' and target_player_id = pg_temp._id('P4')) = 1, 'T8 C: 1 evento admin_promoted (reason) al sucesor');
  -- D
  perform pg_temp._assert((select status = 'deleted' and photo_path is null and deleted_by_player_id = x from public.groups where group_id = gd), 'T8 D: deleted + photo_path null + deleted_by');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = gd and event_type = 'deleted' and actor_player_id = x and metadata->>'reason' = 'account_deletion'), 'T8 D: evento deleted (reason)');
  -- F
  perform pg_temp._assert((select status = 'deleted' from public.groups where group_id = gf), 'T8 F: sigue deleted');
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where group_id = gf and player_id = x and left_at is null), 'T8 F: período cerrado');
  perform pg_temp._assert(not exists (select 1 from public.group_events where group_id = gf and event_type = 'deleted' and metadata->>'reason' = 'account_deletion'), 'T8 F: sin evento deleted duplicado');
  -- auditoría: un member_removed(reason) por período cerrado (5)
  perform pg_temp._assert((select count(*) from public.group_events where actor_player_id = x and event_type = 'member_removed' and metadata->>'reason' = 'account_deletion') = 5, 'T8 auditoría: 5 member_removed con reason');
  -- H: terceros intactos
  select coalesce(string_agg(group_id::text || player_id::text || joined_at::text || coalesce(left_at::text,'-'), '|' order by membership_id), '')
    into snap_after from public.group_memberships where player_id <> x and group_id in (ga, gb, gc);
  perform pg_temp._assert(snap_before = snap_after, 'T8 H: períodos de terceros intactos');
  perform pg_temp._assert((select count(*) from public.matches) = m_before and (select count(*) from public.match_participants) = mp_before, 'T8 H: matches/participantes intactos');
  perform pg_temp._assert((select created_by_player_id = x from public.groups where group_id = gb), 'T8 created_by_player_id se conserva');
  -- G: retry completo -> sin eventos ni promociones duplicadas
  select count(*) into ev_before from public.group_events;
  v := public.admin_delete_player_account(x);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'alreadyDeleted')::boolean, 'T8 G: retry idempotente');
  perform public._groups_account_deletion_cleanup(x); -- el helper también tolera reintentos
  select count(*) into ev_after from public.group_events;
  perform pg_temp._assert(ev_before = ev_after, 'T8 G: sin eventos duplicados');
end $$;

-- I (control negativo): el constraint SÍ está vivo — cerrar al último admin de un grupo activo lo rompe
do $$
declare v jsonb; g uuid; raised boolean := false;
begin
  perform pg_temp._as('P2');
  v := public.create_group('B2C control I', '{}'); g := (v->'group'->>'groupId')::uuid;
  update public.group_memberships set left_at = clock_timestamp() where group_id = g and left_at is null;
  begin
    set constraints group_memberships_require_active_admin immediate;
  exception when others then raised := true;
  end;
  perform pg_temp._assert(raised, 'T8 I: el constraint group_memberships_require_active_admin sigue rechazando un grupo activo sin admin');
end $$;

-- ---------- T9 permisos de ejecución ----------
do $$
begin
  perform pg_temp._assert(not has_function_privilege('anon', 'public.update_group_photo(uuid,text)', 'execute'), 'T9 anon NO ejecuta update_group_photo');
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.update_group_photo(uuid,text)', 'execute'), 'T9 authenticated sí');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public.admin_delete_player_account(uuid)', 'execute'), 'T9 authenticated NO ejecuta admin_delete_player_account');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public._groups_account_deletion_cleanup(uuid)', 'execute') and not has_function_privilege('anon', 'public._groups_account_deletion_cleanup(uuid)', 'execute'), 'T9 helper de cleanup solo service_role');
end $$;

select 'B2C_VERIFY_OK' as result;
rollback;
