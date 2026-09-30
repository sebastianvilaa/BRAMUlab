-- BRAMUlab — Grupos BRAMU §26 (cierre UX post-B2c): verificación transaccional de
-- 20260930180000_preprod_grupos_cierre_ux_miembros_leave.sql. Requiere Fase A + B1 + B2a + B2c +
-- esta migración aplicadas. Crea sus propios fixtures y termina en ROLLBACK.
--
--  L1  nombre y foto: miembro activo (no admin) puede; no-miembro y removido NO; invalid_name
--  L2  acciones administrativas siguen admin-only para un miembro común (add/remove/promote/demote/delete)
--  L3  leave_group — miembro no-admin: sale, período cerrado con historia, sin tocar a terceros
--  L4  leave_group — admin con OTRO admin: sale sin promoción
--  L5  leave_group — ÚLTIMO admin con otros miembros: sucesor determinístico (joined_at, membership_id)
--  L6  leave_group — ÚNICO miembro: borrado lógico + photo_path null + cleanup post-commit seguro
--  L7  retry / idempotencia (sin eventos duplicados), no-miembro -> group_not_found
--  L8  constraint group_memberships_require_active_admin sigue PASS
--  L9  reingreso tras salir: período nuevo, historia preservada
--  L10 Storage: miembro activo escribe/reemplaza; no-miembro y ex-miembro NO; lectura sigue privada
--  L11 permisos de ejecución de leave_group

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
  insert into auth.users (id, email) values (v_uid, 'l26_' || lower(p_key) || '_' || substr(v_uid::text, 1, 8) || '@example.test');
  insert into public.players (display_name, auth_user_id) values ('L26 ' || p_key, v_uid) returning player_id into v_pid;
  insert into public.profiles (player_id, username, first_name, last_name, display_name)
    values (v_pid, 'l26_' || lower(p_key) || substr(v_uid::text, 1, 6), 'L26', p_key, 'L26 ' || p_key);
  insert into pg_temp._t values (p_key, v_pid);
end $$;
create or replace function pg_temp._try(p_key text, p_sql text) returns text language plpgsql as $$
declare v_res text := 'ok';
begin
  perform pg_temp._as(p_key);
  execute 'set local role authenticated';
  begin
    execute p_sql;
    get diagnostics v_res = row_count;
    v_res := case when v_res::int = 0 then 'zero_rows' else 'ok' end;
  exception when others then v_res := 'denied';
  end;
  execute 'reset role';
  return v_res;
end $$;

do $$
declare k text;
begin
  foreach k in array array['ADM','ADM2','M1','M2','M3','OUT','SOLO'] loop perform pg_temp._mk(k); end loop;
end $$;

-- G: ADM (admin), ADM2 (admin), M1 y M2 miembros, OUT ajeno. M3 se agrega y se quita (removido).
do $$
declare v jsonb; g uuid;
begin
  perform pg_temp._as('ADM');
  v := public.create_group('L26 G', array[pg_temp._id('ADM2'), pg_temp._id('M1'), pg_temp._id('M2'), pg_temp._id('M3')]);
  g := (v->'group'->>'groupId')::uuid;
  insert into pg_temp._t values ('G', g);
  perform public.promote_group_admin(g, pg_temp._id('ADM2'));
  perform public.remove_group_member(g, pg_temp._id('M3'));
end $$;

-- ---------- L1 ----------
do $$
declare v jsonb; g uuid := pg_temp._id('G'); p text := pg_temp._id('G')::text || '/1700000000100.jpg';
begin
  perform pg_temp._as('M1');
  v := public.rename_group(g, 'L26 Renombrado por M1');
  perform pg_temp._assert((v->>'ok')::boolean and v->'group'->>'name' = 'L26 Renombrado por M1', 'L1 miembro (no admin) renombra: ' || v::text);
  v := public.update_group_photo(g, p);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'L1 miembro cambia foto: ' || v::text);
  v := public.update_group_photo(g, null);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean, 'L1 miembro quita foto');
  v := public.rename_group(g, '   ');
  perform pg_temp._assert(v->>'code' = 'invalid_name', 'L1 invalid_name se mantiene');
  v := public.update_group_photo(g, pg_temp._id('OUT')::text || '/x.jpg');
  perform pg_temp._assert(v->>'code' = 'invalid_photo_path', 'L1 ruta ajena sigue rechazada');
  perform pg_temp._as('OUT');
  perform pg_temp._assert(public.rename_group(g, 'hack')->>'code' = 'group_not_found', 'L1 no-miembro NO renombra');
  perform pg_temp._assert(public.update_group_photo(g, p)->>'code' = 'group_not_found', 'L1 no-miembro NO cambia foto');
  perform pg_temp._as('M3');
  perform pg_temp._assert(public.rename_group(g, 'hack')->>'code' = 'group_not_found', 'L1 removido NO renombra');
  perform pg_temp._assert(public.update_group_photo(g, p)->>'code' = 'group_not_found', 'L1 removido NO cambia foto');
  perform pg_temp._assert((select name from public.groups where group_id = g) = 'L26 Renombrado por M1', 'L1 el nombre no cambió');
end $$;

-- ---------- L2 acciones administrativas siguen admin-only ----------
do $$
declare g uuid := pg_temp._id('G');
begin
  perform pg_temp._as('M1');
  perform pg_temp._assert(public.add_group_member(g, pg_temp._id('OUT'))->>'code' = 'not_admin', 'L2 M1 NO agrega');
  perform pg_temp._assert(public.remove_group_member(g, pg_temp._id('M2'))->>'code' = 'not_admin', 'L2 M1 NO quita a otro');
  perform pg_temp._assert(public.promote_group_admin(g, pg_temp._id('M2'))->>'code' = 'not_admin', 'L2 M1 NO promueve');
  perform pg_temp._assert(public.demote_group_admin(g, pg_temp._id('ADM2'))->>'code' = 'not_admin', 'L2 M1 NO degrada');
  perform pg_temp._assert(public.delete_group(g)->>'code' = 'not_admin', 'L2 M1 NO elimina el grupo');
  perform pg_temp._assert((select status from public.groups where group_id = g) = 'active', 'L2 grupo intacto');
end $$;

-- ---------- L3 miembro no-admin sale ----------
do $$
declare v jsonb; g uuid := pg_temp._id('G'); snap_b text; snap_a text;
begin
  select coalesce(string_agg(player_id::text || joined_at::text || coalesce(left_at::text,'-') || is_admin::text, '|' order by membership_id), '')
    into snap_b from public.group_memberships where group_id = g and player_id <> pg_temp._id('M2');
  perform pg_temp._as('M2');
  v := public.leave_group(g);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean and not (v->>'groupDeleted')::boolean, 'L3 leave_group: ' || v::text);
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where group_id = g and player_id = pg_temp._id('M2') and left_at is null), 'L3 período cerrado');
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = g and player_id = pg_temp._id('M2') and left_at >= joined_at and removed_by_player_id = pg_temp._id('M2')), 'L3 fila histórica conservada (left_at >= joined_at)');
  select coalesce(string_agg(player_id::text || joined_at::text || coalesce(left_at::text,'-') || is_admin::text, '|' order by membership_id), '')
    into snap_a from public.group_memberships where group_id = g and player_id <> pg_temp._id('M2');
  perform pg_temp._assert(snap_b = snap_a, 'L3 terceros intactos');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = g and event_type = 'member_removed' and actor_player_id = pg_temp._id('M2') and metadata->>'reason' = 'voluntary_leave'), 'L3 evento member_removed (voluntary_leave)');
  -- tras salir ya no ve el grupo
  perform pg_temp._assert(public.get_group_detail(g)->>'code' = 'group_not_found', 'L3 ya no ve el grupo');
  -- L7 retry
  v := public.leave_group(g);
  perform pg_temp._assert((v->>'ok')::boolean and not (v->>'changed')::boolean, 'L7 retry idempotente: ' || v::text);
  perform pg_temp._assert((select count(*) from public.group_events where group_id = g and event_type = 'member_removed' and actor_player_id = pg_temp._id('M2')) = 1, 'L7 sin evento duplicado');
  perform pg_temp._as('OUT');
  perform pg_temp._assert(public.leave_group(g)->>'code' = 'group_not_found', 'L7 quien nunca fue miembro -> group_not_found');
  perform pg_temp._assert(public.leave_group(gen_random_uuid())->>'code' = 'group_not_found', 'L7 grupo inexistente -> group_not_found');
end $$;

-- ---------- L4 admin con otro admin sale ----------
do $$
declare v jsonb; g uuid := pg_temp._id('G');
begin
  perform pg_temp._as('ADM2');
  v := public.leave_group(g);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean and not (v->>'groupDeleted')::boolean, 'L4 leave_group: ' || v::text);
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = g and player_id = pg_temp._id('ADM') and left_at is null and is_admin), 'L4 ADM sigue admin');
  perform pg_temp._assert(not exists (select 1 from public.group_events where group_id = g and event_type = 'admin_promoted' and metadata->>'reason' = 'voluntary_leave'), 'L4 sin promoción');
  perform pg_temp._assert((select status from public.groups where group_id = g) = 'active', 'L4 grupo activo');
end $$;

-- ---------- L5 ÚLTIMO admin con otros miembros -> sucesor determinístico ----------
-- G hoy: ADM (último admin) y M1. Se agrega M3 de nuevo con joined_at MÁS VIEJO que M1 => sucesor M3.
do $$
declare v jsonb; g uuid := pg_temp._id('G');
begin
  perform pg_temp._as('ADM');
  perform public.add_group_member(g, pg_temp._id('M3'));
  update public.group_memberships set joined_at = now() - interval '5 days'
    where group_id = g and player_id = pg_temp._id('M3') and left_at is null;
  update public.group_memberships set joined_at = now() - interval '1 day'
    where group_id = g and player_id = pg_temp._id('M1') and left_at is null;
  update public.group_memberships set joined_at = now() - interval '10 days'
    where group_id = g and player_id = pg_temp._id('ADM') and left_at is null;
  v := public.leave_group(g);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean and not (v->>'groupDeleted')::boolean, 'L5 leave_group: ' || v::text);
  perform pg_temp._assert(exists (select 1 from public.group_memberships where group_id = g and player_id = pg_temp._id('M3') and left_at is null and is_admin), 'L5 sucesor = M3 (joined_at más viejo)');
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where group_id = g and player_id = pg_temp._id('M1') and is_admin), 'L5 M1 NO promovido');
  perform pg_temp._assert((select count(*) from public.group_events where group_id = g and event_type = 'admin_promoted' and metadata->>'reason' = 'voluntary_leave' and target_player_id = pg_temp._id('M3')) = 1, 'L5 1 evento admin_promoted al sucesor');
  perform pg_temp._assert((select status from public.groups where group_id = g) = 'active', 'L5 grupo continúa');
  -- L8: el constraint diferido sigue PASS
  set constraints group_memberships_require_active_admin immediate;
  set constraints group_memberships_require_active_admin deferred;
  -- L7 retry del último admin: no vuelve a promover
  perform pg_temp._as('ADM');
  v := public.leave_group(g);
  perform pg_temp._assert(not (v->>'changed')::boolean, 'L5/L7 retry sin cambios');
  perform pg_temp._assert((select count(*) from public.group_events where group_id = g and event_type = 'admin_promoted' and metadata->>'reason' = 'voluntary_leave') = 1, 'L7 sin promoción duplicada');
end $$;

-- ---------- L9 reingreso: período nuevo, historia preservada ----------
do $$
declare g uuid := pg_temp._id('G'); v jsonb;
begin
  perform pg_temp._as('M3'); -- ahora admin
  v := public.add_group_member(g, pg_temp._id('ADM'));
  perform pg_temp._assert((v->>'ok')::boolean, 'L9 reingreso: ' || v::text);
  perform pg_temp._assert((select count(*) from public.group_memberships where group_id = g and player_id = pg_temp._id('ADM')) = 2, 'L9 dos períodos (historia + nuevo)');
  perform pg_temp._assert((select count(*) from public.group_memberships where group_id = g and player_id = pg_temp._id('ADM') and left_at is null) = 1, 'L9 un solo período abierto');
end $$;

-- ---------- L6 ÚNICO miembro sale -> grupo eliminado lógicamente ----------
do $
declare v jsonb; gs uuid; n int; obj text;
begin
  perform pg_temp._as('SOLO');
  v := public.create_group('L26 Solo', '{}'); gs := (v->'group'->>'groupId')::uuid;
  obj := gs::text || '/1700000000200.jpg';
  perform public.update_group_photo(gs, obj);
  insert into storage.objects (bucket_id, name) values ('group-photos', obj);
  insert into pg_temp._t values ('GS', gs);
  v := public.leave_group(gs);
  perform pg_temp._assert((v->>'ok')::boolean and (v->>'changed')::boolean and (v->>'groupDeleted')::boolean, 'L6 leave_group: ' || v::text);
  perform pg_temp._assert((select status = 'deleted' and photo_path is null and deleted_by_player_id = pg_temp._id('SOLO') from public.groups where group_id = gs), 'L6 deleted + photo_path null + deleted_by');
  perform pg_temp._assert(not exists (select 1 from public.group_memberships where group_id = gs and left_at is null), 'L6 período cerrado');
  perform pg_temp._assert(exists (select 1 from public.group_events where group_id = gs and event_type = 'deleted' and metadata->>'reason' = 'voluntary_leave'), 'L6 evento deleted');

  -- La membership ya está cerrada: el actor que produjo el logical-delete conserva SOLO la
  -- ventana de cleanup list/delete. No recupera lectura/firma del objeto.
  perform pg_temp._as('SOLO');
  perform pg_temp._assert(public._group_photo_can_cleanup(obj), 'L6 deleted_by conserva gate de cleanup');
  perform set_config('storage.operation', 'object.list', true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id='group-photos' and name=obj;
  execute 'reset role';
  perform pg_temp._assert(n = 1, 'L6 deleted_by puede listar residuo para cleanup');
  perform set_config('storage.operation', 'object.sign', true);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id='group-photos' and name=obj;
  execute 'reset role';
  perform pg_temp._assert(n = 0, 'L6 deleted_by NO puede firmar/leer tras salir');
  perform set_config('storage.operation', '', true);

  perform pg_temp._as('OUT');
  perform pg_temp._assert(not public._group_photo_can_cleanup(obj), 'L6 ajeno no obtiene cleanup');

  perform pg_temp._as('SOLO');
  v := public.leave_group(gs);
  perform pg_temp._assert((v->>'ok')::boolean and not (v->>'changed')::boolean, 'L7 retry sobre grupo eliminado: idempotente');
  perform pg_temp._assert(not exists (select 1 from public.group_events where group_id = gs and event_type = 'deleted' and (select count(*) from public.group_events e2 where e2.group_id = gs and e2.event_type = 'deleted') > 1), 'L7 un solo evento deleted');
  set constraints group_memberships_require_active_admin immediate;
  set constraints group_memberships_require_active_admin deferred;
  perform pg_temp._assert(not exists (select 1 from jsonb_array_elements(public.list_my_groups()->'groups') g where g->>'groupId' = gs::text), 'L6 ya no figura en list_my_groups');
end $;

-- ---------- L10 Storage: miembro activo escribe/reemplaza; ajenos NO; lectura privada ----------
create or replace function pg_temp._storage(p_key text, p_sql text) returns text language plpgsql as $$
declare v_res text := 'ok';
begin
  perform pg_temp._as(p_key);
  execute 'set local role authenticated';
  begin execute p_sql; get diagnostics v_res = row_count; v_res := case when v_res::int = 0 then 'zero_rows' else 'ok' end;
  exception when others then v_res := 'denied'; end;
  execute 'reset role';
  return v_res;
end $$;
do $$
declare g text := pg_temp._id('G')::text; n int;
begin
  -- hoy G: ADM (reingresó), M1, M3 (admin); M2/ADM2 salieron; OUT ajeno
  perform pg_temp._assert(pg_temp._storage('M1', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/m1.jpg')$f$, g)) = 'ok', 'L10 miembro activo sube');
  perform pg_temp._assert(pg_temp._storage('M1', format($f$update storage.objects set owner = owner where bucket_id='group-photos' and name = '%s/m1.jpg'$f$, g)) = 'ok', 'L10 miembro activo reemplaza');
  perform pg_temp._assert(pg_temp._storage('OUT', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/o.jpg')$f$, g)) = 'denied', 'L10 no-miembro NO sube');
  perform pg_temp._assert(pg_temp._storage('M2', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/x.jpg')$f$, g)) = 'denied', 'L10 ex-miembro (salió) NO sube');
  perform pg_temp._assert(pg_temp._storage('ADM2', format($f$insert into storage.objects (bucket_id, name) values ('group-photos', '%s/x2.jpg')$f$, g)) = 'denied', 'L10 ex-admin (salió) NO sube');
  perform pg_temp._as('M3'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos' and name like g || '/%'; execute 'reset role';
  perform pg_temp._assert(n = 1, 'L10 miembro lee');
  perform pg_temp._as('M2'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos'; execute 'reset role';
  perform pg_temp._assert(n = 0, 'L10 ex-miembro NO lee/firma');
  perform pg_temp._as('OUT'); execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'group-photos'; execute 'reset role';
  perform pg_temp._assert(n = 0, 'L10 no-miembro NO lee/firma');
  perform pg_temp._as('M3');
  perform pg_temp._assert(public._group_photo_can_delete(g || '/m1.jpg'), 'L10 miembro activo: helper DELETE (archivo reemplazado)');
  perform pg_temp._as('M2');
  perform pg_temp._assert(not public._group_photo_can_delete(g || '/m1.jpg'), 'L10 ex-miembro: helper DELETE NO');
end $$;

-- ---------- L11 ----------
do $$
begin
  perform pg_temp._assert(has_function_privilege('authenticated', 'public.leave_group(uuid)', 'execute'), 'L11 authenticated ejecuta leave_group');
  perform pg_temp._assert(not has_function_privilege('anon', 'public.leave_group(uuid)', 'execute'), 'L11 anon NO');
  perform pg_temp._assert(not has_function_privilege('authenticated', 'public._groups_close_membership(uuid,uuid,text)', 'execute'), 'L11 helper interno NO expuesto');
end $$;

select 'GRUPOS_26_VERIFY_OK' as result;
rollback;
