-- BRAMUlab — Grupos BRAMU · Cierre de producto/UX post-B2c (Grupos_BRAMU.md §26, 30/09/2026).
--
-- Fuente: Grupos_BRAMU.md §26 + Issue #6. Migración NUEVA posterior a
-- 20260930140204 preprod_grupos_b2c_group_photo (ya aplicada en Staging): no se edita esa.
--
-- ALCANCE (§26.4–26.6)
--   1) Nombre y foto del grupo pasan a ser colaborativos: rename_group y update_group_photo
--      exigen MIEMBRO ACTIVO (ya no admin). Nadie que no sea miembro activo puede.
--   2) Las acciones administrativas NO se relajan: add/remove member, promote/demote, delete_group
--      siguen `require_admin` (sin cambios en esta migración).
--   3) Storage `group-photos`: escribir/reemplazar (INSERT/UPDATE) y borrar el archivo reemplazado
--      (DELETE) pasan a miembro abierto; lectura/firma sigue siendo SOLO miembro abierto + grupo
--      active; el cleanup post-delete conserva su regla especial (admin abierto de grupo deleted,
--      solo list/delete vía storage.allow_any_operation).
--   4) leave_group(p_group_id): "Salir del grupo" para cualquier miembro. Atómico, idempotente y
--      auditable, con el MISMO algoritmo validado en P0.3 ↔ Grupos (se factoriza en
--      `_groups_close_membership`, compartido con `_groups_account_deletion_cleanup`):
--        - miembro no-admin, o admin con otro admin activo: cierra su período;
--        - ÚLTIMO admin con otros miembros: promueve antes al sucesor determinístico
--          (`joined_at ASC, membership_id ASC`) y recién después cierra;
--        - ÚNICO miembro activo: borrado lógico del grupo (+ photo_path null) y luego cierra;
--        - el período se cierra (`left_at = greatest(clock_timestamp(), joined_at)`), la fila
--          histórica y los partidos/puntos de terceros NO se tocan.
--      Auditoría con eventos existentes y metadata {"reason":"voluntary_leave"}.
--      Reintento: si la persona ya no tiene período abierto pero sí historia en ese grupo ->
--      {ok:true, changed:false}; si nunca fue miembro -> group_not_found.
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — la aplica y verifica
-- Central en Staging con supabase/tests/verify-preprod-grupos-26-miembros-leave.sql (BEGIN/ROLLBACK).

-- ------------------------------------------------------------------
-- 1) Nombre y foto: miembro activo
-- ------------------------------------------------------------------

create or replace function public.rename_group(p_group_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_err text;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, false);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name');
  end if;

  update public.groups set name = v_name, updated_at = now() where group_id = p_group_id and name <> v_name;
  if found then
    perform public._groups_log(p_group_id, 'renamed', v_caller, null, jsonb_build_object('name', v_name));
  end if;
  return jsonb_build_object('ok', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

create or replace function public.update_group_photo(p_group_id uuid, p_photo_path text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_err text;
  v_current text;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, false);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  if p_photo_path is not null
     and p_photo_path !~ ('^' || p_group_id::text || '/[A-Za-z0-9._-]+$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_photo_path');
  end if;

  select g.photo_path into v_current from public.groups g where g.group_id = p_group_id;
  if v_current is not distinct from p_photo_path then
    return jsonb_build_object('ok', true, 'changed', false, 'group', public._groups_detail_json(p_group_id, v_caller));
  end if;

  update public.groups set photo_path = p_photo_path, updated_at = now() where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'photo_changed', v_caller, null,
    jsonb_build_object('removed', p_photo_path is null));
  return jsonb_build_object('ok', true, 'changed', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

-- ------------------------------------------------------------------
-- 2) Storage: escribir/reemplazar/borrar el reemplazado = miembro abierto (grupo active)
-- ------------------------------------------------------------------

create or replace function public._group_photo_can_write(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$'
    and exists (
      select 1
      from public.groups g
      join public.group_memberships gm on gm.group_id = g.group_id and gm.left_at is null
      join public.players pl on pl.player_id = gm.player_id
      where g.group_id = public._group_photo_folder_group_id(p_name)
        and g.status = 'active'
        and pl.auth_user_id = auth.uid() and pl.is_active
    );
$$;

-- DELETE: miembro abierto del mismo group_id (aunque el grupo ya esté deleted: el borrado lógico
-- deja memberships abiertas). En un grupo deleted la fila solo es visible para el admin de cleanup
-- y solo bajo list/delete (ver policy SELECT de la migración B2c), así que un miembro común sigue
-- sin poder tocar residuos de un grupo eliminado.
create or replace function public._group_photo_can_delete(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.left_at is null
    join public.players pl on pl.player_id = gm.player_id
    where g.group_id = public._group_photo_folder_group_id(p_name)
      and pl.auth_user_id = auth.uid() and pl.is_active
  );
$$;

-- ------------------------------------------------------------------
-- 3) Cierre de membresía compartido (leave_group + eliminación de cuenta)
-- ------------------------------------------------------------------

-- Devuelve 'left' (período cerrado), 'deleted' (cerrado y el grupo quedó eliminado lógicamente) o
-- 'noop' (sin período abierto). El llamador debe haber resuelto el caller; acá se bloquea el grupo.
create or replace function public._groups_close_membership(p_group_id uuid, p_player_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_mem public.group_memberships;
  v_successor public.group_memberships;
  v_meta jsonb := jsonb_build_object('reason', p_reason);
  v_result text := 'left';
begin
  select g.status into v_status from public.groups g where g.group_id = p_group_id for update;
  select * into v_mem from public.group_memberships gm
    where gm.group_id = p_group_id and gm.player_id = p_player_id and gm.left_at is null for update;
  if not found then return 'noop'; end if;

  if v_status = 'active' then
    if not exists (
      select 1 from public.group_memberships o
      where o.group_id = p_group_id and o.left_at is null and o.player_id <> p_player_id
    ) then
      update public.groups
        set status = 'deleted', deleted_at = now(), deleted_by_player_id = p_player_id,
            updated_at = now(), photo_path = null
        where group_id = p_group_id;
      perform public._groups_log(p_group_id, 'deleted', p_player_id, null, v_meta);
      v_result := 'deleted';
    elsif v_mem.is_admin and not exists (
      select 1 from public.group_memberships o
      where o.group_id = p_group_id and o.left_at is null and o.is_admin and o.player_id <> p_player_id
    ) then
      select * into v_successor from public.group_memberships o
        where o.group_id = p_group_id and o.left_at is null and o.player_id <> p_player_id
        order by o.joined_at asc, o.membership_id asc
        limit 1 for update;
      update public.group_memberships set is_admin = true, updated_at = now()
        where membership_id = v_successor.membership_id;
      perform public._groups_log(p_group_id, 'admin_promoted', p_player_id, v_successor.player_id, v_meta);
    end if;
  end if;

  update public.group_memberships
    set left_at = greatest(clock_timestamp(), joined_at), removed_by_player_id = p_player_id, updated_at = now()
    where membership_id = v_mem.membership_id;
  perform public._groups_log(p_group_id, 'member_removed', p_player_id, p_player_id, v_meta);
  return v_result;
end;
$$;

revoke all on function public._groups_close_membership(uuid, uuid, text) from public;
revoke all on function public._groups_close_membership(uuid, uuid, text) from anon;
revoke all on function public._groups_close_membership(uuid, uuid, text) from authenticated;

-- P0.3: mismo comportamiento que antes (algoritmo de Issue #4), ahora sobre el helper compartido.
create or replace function public._groups_account_deletion_cleanup(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid uuid;
begin
  for v_gid in
    select distinct gm.group_id from public.group_memberships gm
    where gm.player_id = p_player_id and gm.left_at is null
    order by gm.group_id
  loop
    perform public._groups_close_membership(v_gid, p_player_id, 'account_deletion');
  end loop;
end;
$$;

-- ------------------------------------------------------------------
-- 4) leave_group
-- ------------------------------------------------------------------

create or replace function public.leave_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_res text;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if p_group_id is null or not exists (
    select 1 from public.group_memberships gm where gm.group_id = p_group_id and gm.player_id = v_caller
  ) then
    return jsonb_build_object('ok', false, 'code', 'group_not_found');
  end if;

  v_res := public._groups_close_membership(p_group_id, v_caller, 'voluntary_leave');
  if v_res = 'noop' then
    -- reintento: ya había salido (tiene historia en el grupo pero ningún período abierto)
    return jsonb_build_object('ok', true, 'changed', false, 'groupDeleted', false);
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'groupDeleted', v_res = 'deleted');
end;
$$;

revoke all on function public.leave_group(uuid) from public;
revoke all on function public.leave_group(uuid) from anon;
grant execute on function public.leave_group(uuid) to authenticated;
