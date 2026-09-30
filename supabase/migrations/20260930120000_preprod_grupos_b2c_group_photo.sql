-- BRAMUlab — Grupos BRAMU · B2c · Foto de grupo server-backed (30/09/2026).
--
-- Fuente: Issue #5 (Central, incl. revisión técnica de Storage/privacidad) + Grupos_BRAMU.md.
--
-- ALCANCE
--   1) groups.photo_path — RUTA cruda de Storage (bucket privado `group-photos`), NUNCA una URL
--      ni base64. null = fallback de iniciales. CHECK estructural: `{group_id}/<archivo-seguro>`.
--   2) group_events.event_type += 'photo_changed' (alta/reemplazo/quitar). Lo recoge solo
--      `_groups_last_activity_at()` (máximo de group_events.occurred_at): un cambio de foto mueve
--      el grupo en el lobby sin una segunda lógica de orden.
--   3) update_group_photo(p_group_id, p_photo_path) — solo admin activo, rate limit
--      `group_mutation`, valida la ruta con regex anclada (no LIKE), idempotente (changed:false).
--   4) `photoPath` fusionado en _groups_detail_json / list_my_groups / get_groups_lobby (misma
--      forma, sin RPC nueva de lectura).
--   5) Storage: bucket privado `group-photos` (2 MB, jpeg/png/webp) + políticas por membresía.
--   6) delete_group limpia photo_path (borrado lógico; los objetos se limpian después, ver RLS).
--   7) P0.3: admin_delete_player_account sale de TODOS sus grupos (ver abajo) y borra
--      lógicamente los grupos donde era el ÚNICO miembro activo, limpiando su photo_path, dentro
--      de la MISMA transacción; el orquestador (supabase/scripts/admin-delete-player-account.mjs) limpia
--      `group-photos/{group_id}/*` de esos grupos como parte de la postcondición.
--
-- RLS de Storage (revisión técnica Central, corregida tras la revisión de d8d2763):
--   SELECT  : miembro con período ABIERTO y grupo `active` (leer/firmar/listar). Tras el borrado
--             lógico NADIE genera nuevas signed URLs ni lee el objeto. Única excepción, mínima:
--             un ADMIN abierto de un grupo `deleted` puede LISTAR y BORRAR residuos, y solo
--             mediante las operaciones de Storage `object.list`/`object.list_v2`/`object.delete`/
--             `object.delete_many` (storage.allow_any_operation) — nunca `sign`/`get` (Postgres
--             exige que la fila también pase SELECT para poder borrarla vía Storage).
--   INSERT/UPDATE : admin abierto + grupo `active` + ruta `{group_id}/<archivo-seguro>`.
--   DELETE  : admin abierto del mismo group_id, aunque el grupo ya esté `deleted` (el borrado
--             lógico deja memberships abiertas), para poder limpiar el objeto después.
--   Las políticas no leen las tablas de Grupos directamente (RLS deny-by-default para
--   authenticated): usan helpers SECURITY DEFINER `_group_photo_can_*` con EXECUTE solo para
--   authenticated.
--
-- P0.3 ↔ Grupos (Issue #4, algoritmo cerrado): `_groups_account_deletion_cleanup` (service_role)
-- se llama explícitamente desde `admin_delete_player_account`, en la MISMA transacción, ANTES de
-- anonimizar: cierra TODAS las memberships abiertas de la persona eliminada; grupo activo con
-- otros miembros -> se conserva (si era el último admin, promueve primero al sucesor
-- determinístico `joined_at, membership_id`); único miembro -> borrado lógico (+ photo_path
-- null); grupo ya `deleted` -> solo cierra su período. Auditoría con los eventos existentes y
-- metadata {"reason":"account_deletion"}. Cualquier falla revierte toda la Fase 1.
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — se aplica y verifica
-- en Staging con supabase/tests/verify-preprod-grupos-b2c-group-photo.sql (BEGIN/ROLLBACK).

-- ------------------------------------------------------------------
-- 1) Columna + CHECK estructural
-- ------------------------------------------------------------------

alter table public.groups add column photo_path text;

alter table public.groups add constraint groups_photo_path_shape
  check (photo_path is null or photo_path ~ ('^' || group_id::text || '/[A-Za-z0-9._-]+$'));

comment on column public.groups.photo_path is
  'Ruta cruda de Storage (bucket privado group-photos), formato {group_id}/<archivo>.jpg. Nunca URL
   pública ni base64. null = fallback de iniciales. Solo update_group_photo / delete_group /
   admin_delete_player_account la escriben.';

-- ------------------------------------------------------------------
-- 2) group_events: 'photo_changed'
-- ------------------------------------------------------------------

do $$
declare v_con text;
begin
  for v_con in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.group_events'::regclass and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%event_type%'
  loop
    execute format('alter table public.group_events drop constraint %I', v_con);
  end loop;
end $$;

alter table public.group_events add constraint group_events_event_type_check
  check (event_type in (
    'created', 'renamed', 'member_added', 'member_removed',
    'admin_promoted', 'admin_demoted', 'deleted', 'photo_changed'));

-- ------------------------------------------------------------------
-- 3) Contratos de lectura: photoPath
-- ------------------------------------------------------------------

create or replace function public._groups_detail_json(p_group_id uuid, p_caller uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'groupId', g.group_id,
    'name', g.name,
    'photoPath', g.photo_path,
    'createdByPlayerId', g.created_by_player_id,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at,
    'isAdmin', exists (
      select 1 from public.group_memberships c
      where c.group_id = g.group_id and c.player_id = p_caller and c.left_at is null and c.is_admin),
    'members', public._groups_members_json(g.group_id)
  )
  from public.groups g
  where g.group_id = p_group_id;
$$;

revoke all on function public._groups_detail_json(uuid, uuid) from public;

create or replace function public.list_my_groups()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
begin
  return jsonb_build_object('ok', true, 'groups', coalesce((
    select jsonb_agg(jsonb_build_object(
             'groupId', g.group_id,
             'name', g.name,
             'photoPath', g.photo_path,
             'createdByPlayerId', g.created_by_player_id,
             'createdAt', g.created_at,
             'updatedAt', g.updated_at,
             'isAdmin', me.is_admin,
             'myJoinedAt', me.joined_at,
             'activeMemberCount', (select count(*) from public.group_memberships x
                                   where x.group_id = g.group_id and x.left_at is null)
           ) order by g.created_at, g.group_id)
    from public.group_memberships me
    join public.groups g on g.group_id = me.group_id and g.status = 'active'
    where me.player_id = v_caller and me.left_at is null
  ), '[]'::jsonb));
end;
$$;

create or replace function public.get_groups_lobby(p_week_from timestamptz default null, p_week_to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
begin
  return jsonb_build_object('ok', true, 'groups', coalesce((
    select jsonb_agg(jsonb_build_object(
             'groupId', g.group_id,
             'name', g.name,
             'photoPath', g.photo_path,
             'createdAt', g.created_at,
             'activeMemberCount', (select count(*) from public.group_memberships x where x.group_id = g.group_id and x.left_at is null),
             'isAdmin', me.is_admin,
             'lastActivityAt', la.last_activity_at,
             'members', public._groups_members_json(g.group_id),
             'weekMatches', public._groups_week_matches_json(g.group_id, p_week_from, p_week_to)
           )
           order by la.last_activity_at desc, g.created_at desc, g.group_id)
    from public.group_memberships me
    join public.groups g on g.group_id = me.group_id and g.status = 'active'
    cross join lateral (select public._groups_last_activity_at(g.group_id) as last_activity_at) la
    where me.player_id = v_caller and me.left_at is null
  ), '[]'::jsonb));
end;
$$;

-- ------------------------------------------------------------------
-- 4) update_group_photo
-- ------------------------------------------------------------------

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
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  -- Regex ANCLADA (nunca LIKE): exactamente "{este group_id}/<archivo seguro>". Rechaza URL,
  -- esquema/dominio, carpeta ajena y traversal. null (quitar foto) siempre se permite.
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

revoke all on function public.update_group_photo(uuid, text) from public;
revoke all on function public.update_group_photo(uuid, text) from anon;
grant execute on function public.update_group_photo(uuid, text) to authenticated;

-- ------------------------------------------------------------------
-- 5) delete_group: además del borrado lógico, limpia photo_path
-- ------------------------------------------------------------------

create or replace function public.delete_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_err text;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  -- Borrado LÓGICO: memberships, group_events y partidos quedan intactos. photo_path se limpia
  -- (el objeto de Storage lo borra el cliente admin best-effort DESPUÉS; un fallo de cleanup
  -- nunca revierte este borrado).
  update public.groups
    set status = 'deleted', deleted_at = now(), deleted_by_player_id = v_caller, updated_at = now(),
        photo_path = null
    where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'deleted', v_caller);
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------------
-- 6) Storage: bucket privado + políticas por membresía
-- ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Primer segmento de la ruta como uuid, o NULL si no tiene esa forma (nunca lanza por un cast).
create or replace function public._group_photo_folder_group_id(p_name text)
returns uuid
language sql
immutable
set search_path = pg_catalog
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

create or replace function public._group_photo_can_read(p_name text)
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
      and g.status = 'active'
  );
$$;

-- Residuos de un grupo ya ELIMINADO: solo admins abiertos, y solo para listar/borrar (la policy
-- exige además la operación de Storage; ver storage.allow_any_operation abajo).
create or replace function public._group_photo_can_cleanup(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.left_at is null and gm.is_admin
    join public.players pl on pl.player_id = gm.player_id
    where g.group_id = public._group_photo_folder_group_id(p_name)
      and g.status = 'deleted'
      and pl.auth_user_id = auth.uid() and pl.is_active
  );
$$;

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
      join public.group_memberships gm on gm.group_id = g.group_id and gm.left_at is null and gm.is_admin
      join public.players pl on pl.player_id = gm.player_id
      where g.group_id = public._group_photo_folder_group_id(p_name)
        and g.status = 'active'
        and pl.auth_user_id = auth.uid() and pl.is_active
    );
$$;

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
    join public.group_memberships gm on gm.group_id = g.group_id and gm.left_at is null and gm.is_admin
    join public.players pl on pl.player_id = gm.player_id
    where g.group_id = public._group_photo_folder_group_id(p_name)
      and pl.auth_user_id = auth.uid() and pl.is_active
  );
$$;

revoke all on function public._group_photo_folder_group_id(text) from public;
revoke all on function public._group_photo_can_read(text) from public;
revoke all on function public._group_photo_can_write(text) from public;
revoke all on function public._group_photo_can_delete(text) from public;
revoke all on function public._group_photo_can_cleanup(text) from public;
grant execute on function public._group_photo_folder_group_id(text) to authenticated;
grant execute on function public._group_photo_can_read(text) to authenticated;
grant execute on function public._group_photo_can_write(text) to authenticated;
grant execute on function public._group_photo_can_delete(text) to authenticated;
grant execute on function public._group_photo_can_cleanup(text) to authenticated;

drop policy if exists "group_photos_select_member" on storage.objects;
create policy "group_photos_select_member" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'group-photos'
    and (
      public._group_photo_can_read(name)
      or (
        public._group_photo_can_cleanup(name)
        and storage.allow_any_operation(array['object.list', 'object.list_v2', 'object.delete', 'object.delete_many'])
      )
    )
  );

drop policy if exists "group_photos_insert_admin" on storage.objects;
create policy "group_photos_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'group-photos' and public._group_photo_can_write(name));

drop policy if exists "group_photos_update_admin" on storage.objects;
create policy "group_photos_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'group-photos' and public._group_photo_can_write(name))
  with check (bucket_id = 'group-photos' and public._group_photo_can_write(name));

drop policy if exists "group_photos_delete_admin" on storage.objects;
create policy "group_photos_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'group-photos' and public._group_photo_can_delete(name));

-- ------------------------------------------------------------------
-- 7) P0.3 ↔ Grupos — helper interno (service_role) + admin_delete_player_account
-- ------------------------------------------------------------------

create or replace function public._groups_account_deletion_cleanup(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid uuid;
  v_status text;
  v_mem public.group_memberships;
  v_successor public.group_memberships;
  v_reason jsonb := jsonb_build_object('reason', 'account_deletion');
begin
  -- Orden estable por group_id (evita deadlocks entre corridas concurrentes).
  for v_gid in
    select distinct gm.group_id from public.group_memberships gm
    where gm.player_id = p_player_id and gm.left_at is null
    order by gm.group_id
  loop
    -- 1) bloquear el grupo antes de mutar
    select g.status into v_status from public.groups g where g.group_id = v_gid for update;
    -- 2) período abierto de la persona (tolera reintentos: si ya se cerró, no-op)
    select * into v_mem from public.group_memberships gm
      where gm.group_id = v_gid and gm.player_id = p_player_id and gm.left_at is null for update;
    if not found then continue; end if;

    if v_status = 'active' then
      if not exists (
        select 1 from public.group_memberships o
        where o.group_id = v_gid and o.left_at is null and o.player_id <> p_player_id
      ) then
        -- único miembro activo: borrado lógico (y foto fuera) ANTES de cerrar su período
        update public.groups
          set status = 'deleted', deleted_at = now(), deleted_by_player_id = p_player_id,
              updated_at = now(), photo_path = null
          where group_id = v_gid;
        perform public._groups_log(v_gid, 'deleted', p_player_id, null, v_reason);
      elsif v_mem.is_admin and not exists (
        select 1 from public.group_memberships o
        where o.group_id = v_gid and o.left_at is null and o.is_admin and o.player_id <> p_player_id
      ) then
        -- último admin con otros miembros: sucesor determinístico ANTES de cerrar su período
        select * into v_successor from public.group_memberships o
          where o.group_id = v_gid and o.left_at is null and o.player_id <> p_player_id
          order by o.joined_at asc, o.membership_id asc
          limit 1 for update;
        update public.group_memberships set is_admin = true, updated_at = now()
          where membership_id = v_successor.membership_id;
        perform public._groups_log(v_gid, 'admin_promoted', p_player_id, v_successor.player_id, v_reason);
      end if;
    end if;

    -- 3) cierre histórico (nunca se borra la fila)
    update public.group_memberships
      set left_at = greatest(clock_timestamp(), joined_at), removed_by_player_id = p_player_id, updated_at = now()
      where membership_id = v_mem.membership_id;
    perform public._groups_log(v_gid, 'member_removed', p_player_id, p_player_id, v_reason);
  end loop;
end;
$$;

revoke all on function public._groups_account_deletion_cleanup(uuid) from public;
revoke all on function public._groups_account_deletion_cleanup(uuid) from anon;
revoke all on function public._groups_account_deletion_cleanup(uuid) from authenticated;
grant execute on function public._groups_account_deletion_cleanup(uuid) to service_role;

-- Idéntica a 20260927150000 salvo la llamada explícita al helper (bloque "B2c/P0.3"), ANTES de
-- anonimizar: si cualquier mutación de grupo falla, revierte TODA la Fase 1.
create or replace function public.admin_delete_player_account(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
  v_captured_auth_user_id uuid;
begin
  select * into v_player from public.players where player_id = p_player_id for update;

  if v_player is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  if v_player.deleted_at is not null then
    select (properties->>'authUserId')::uuid into v_captured_auth_user_id
      from public.pilot_events
      where event_name = 'account_deleted' and player_id = p_player_id
      order by created_at desc
      limit 1;
    return jsonb_build_object(
      'ok', true, 'playerId', p_player_id, 'alreadyDeleted', true, 'authUserId', v_captured_auth_user_id
    );
  end if;

  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;

  v_captured_auth_user_id := v_player.auth_user_id;

  -- ---- B2c/P0.3: salir de TODOS los grupos (Issue #4), en esta misma transacción. ----
  perform public._groups_account_deletion_cleanup(p_player_id);

  update public.players set
    display_name = 'Jugador eliminado',
    is_active = false,
    deleted_at = now(),
    auth_user_id = null,
    updated_at = now()
  where player_id = p_player_id;

  update public.profiles set
    username = null,
    first_name = null,
    last_name = null,
    display_name = null,
    avatar_url = null,
    birth_date = null,
    gender = null,
    dominant_hand = null,
    preferred_side = null,
    competitive_branch = null,
    location_id = null,
    location_effective_from = null,
    phone = null,
    allow_whatsapp_contact = false,
    current_category = null,
    current_category_at = null,
    ranking_opt_in = false,
    updated_at = now()
  where player_id = p_player_id;

  update public.match_participants
    set display_name_snapshot = 'Jugador eliminado'
    where player_id = p_player_id;

  delete from public.intelligence_match_outputs
    where match_id in (select match_id from public.match_participants where player_id = p_player_id);

  delete from public.match_user_state where player_id = p_player_id;
  delete from public.notifications where player_id = p_player_id;

  delete from public.player_saved_players
    where owner_player_id = p_player_id or saved_player_id = p_player_id;
  delete from public.ranking_network_hidden
    where player_id = p_player_id or hidden_player_id = p_player_id;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('account_deleted', p_player_id, jsonb_build_object('authUserId', v_captured_auth_user_id));

  return jsonb_build_object(
    'ok', true, 'playerId', p_player_id, 'alreadyDeleted', false,
    'authUserId', v_captured_auth_user_id
  );
end;
$$;

revoke all on function public.admin_delete_player_account(uuid) from public;
revoke all on function public.admin_delete_player_account(uuid) from anon;
revoke all on function public.admin_delete_player_account(uuid) from authenticated;
grant execute on function public.admin_delete_player_account(uuid) to service_role;
