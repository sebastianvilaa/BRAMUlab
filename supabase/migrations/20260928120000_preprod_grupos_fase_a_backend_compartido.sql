-- BRAMUlab — Grupos BRAMU · Fase A · Backend compartido (handoff 65, 28/09/2026).
--
-- Fuente de producto: docs/BRAMUlab/Grupos_BRAMU.md. Fuente de esta fase:
-- docs/BRAMUlab/Implementacion/Pre_Production/65_Handoff_Grupos_Fase_A_Backend_Compartido_28SEP.md.
--
-- ALCANCE: solo persistencia + contratos server-side. NO toca frontend, groups.js, Nivel, Ranking
-- ni la fórmula de partidos. NO migra los grupos locales de QA (bramulab.groups.v1).
--
-- DISEÑO
--   1) groups — grupo con borrado LÓGICO (status/deleted_at). Eliminarlo nunca borra memberships,
--      matches ni historia deportiva.
--   2) group_memberships — UNA FILA POR PERÍODO de pertenencia (membership_id propio). Un
--      reingreso abre una fila nueva; nunca se pisa joined_at. Partial unique index: como máximo
--      un período ABIERTO (left_at null) por (group_id, player_id). is_admin vive en el período
--      (un admin es siempre un miembro activo: no existe admin sin fila abierta).
--   3) group_events — bitácora append-only (creación, renombre, altas/bajas, cambios de admin,
--      eliminación). Cubre "rol admin históricamente coherente" sin reescribir períodos.
--   4) Invariante "nunca cero admins activos": defensa en DOS capas — (a) cada RPC bloquea el
--      grupo (SELECT ... FOR UPDATE) y valida antes de mutar; (b) constraint trigger DEFERRED
--      sobre group_memberships que aborta la transacción si un grupo activo termina sin admin
--      activo (cubre también escrituras service_role directas y carreras entre RPCs).
--   5) RPCs (SECURITY DEFINER, GRANT solo a authenticated): list_my_groups, get_group_detail,
--      create_group, rename_group, add_group_member, remove_group_member, promote_group_admin,
--      demote_group_admin, delete_group. Errores esperables = {ok:false, code}; sesión inválida /
--      rate limit = excepción (mismo patrón que save_player).
--   6) get_group_competition_data — lectura deportiva autorizada (solo miembros activos). Entrega
--      DATOS NORMALIZADOS para que el mismo motor puro (bramulab/groups.js) calcule puntos/top3/
--      Race en Fase B. NO existe ninguna fórmula de puntos en SQL. El único filtro server-side es
--      de PRIVACIDAD/alcance: solo devuelve partidos con >= 3 miembros del grupo activos en la
--      fecha del partido (misma regla de elegibilidad que groups.js#doesMatchCountForGroup; el
--      motor JS sigue siendo la autoridad y la re-evalúa con los períodos que también recibe).
--
-- NIVEL para Sorpresa: `levelBefore` = match_level_result_players.effective_level del resultado
-- APPLIED y eligible de ese partido (Nivel oficial que la fórmula usó ANTES del partido). Si no
-- hay resultado aplicado/eligible, o el jugador no tiene fila (invitado/no identificado), es NULL
-- y el motor NO concede Sorpresa. Nunca se usa el Nivel simulado legacy ni el nivel actual.
--
-- `regulationCompleted` no se persiste en matches (solo existía en el modelo local legacy); todo
-- partido validated con winner_team se considera completo, igual que el resto del backend.
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — se aplica y verifica
-- en Staging con supabase/tests/verify-preprod-grupos-fase-a.sql (BEGIN/ROLLBACK).

-- ------------------------------------------------------------------
-- 1) Tablas
-- ------------------------------------------------------------------

create table public.groups (
  group_id             uuid primary key default gen_random_uuid(),
  name                 text not null,
  created_by_player_id uuid not null references public.players (player_id),
  status               text not null default 'active' check (status in ('active', 'deleted')),
  deleted_at           timestamptz,
  deleted_by_player_id uuid references public.players (player_id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint groups_name_clean check (name = btrim(name) and char_length(name) between 1 and 60),
  constraint groups_deleted_consistent check ((status = 'deleted') = (deleted_at is not null))
);

comment on table public.groups is
  'Grupos BRAMU (competencia privada). Borrado LÓGICO: status=deleted no elimina group_memberships
   ni partidos. RLS deny-by-default (cero políticas): todo acceso de cliente vía RPCs SECURITY
   DEFINER de esta migración.';

create table public.group_memberships (
  membership_id        uuid primary key default gen_random_uuid(),
  group_id             uuid not null references public.groups (group_id),
  player_id            uuid not null references public.players (player_id),
  is_admin             boolean not null default false,
  joined_at            timestamptz not null default clock_timestamp(),
  left_at              timestamptz,
  added_by_player_id   uuid references public.players (player_id),
  removed_by_player_id uuid references public.players (player_id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint group_memberships_period_order check (left_at is null or left_at >= joined_at)
);

comment on table public.group_memberships is
  'UN PERÍODO de pertenencia por fila. Reingreso = fila nueva (nunca se pisa joined_at). left_at
   null = período abierto = miembro activo. is_admin solo es "admin activo" si el período está
   abierto. Identidad SIEMPRE por player_id.';

create unique index group_memberships_one_open_period
  on public.group_memberships (group_id, player_id) where left_at is null;
create index group_memberships_group_idx on public.group_memberships (group_id, player_id, joined_at);
create index group_memberships_player_open_idx on public.group_memberships (player_id) where left_at is null;

create table public.group_events (
  event_id        uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (group_id),
  event_type      text not null check (event_type in (
                     'created', 'renamed', 'member_added', 'member_removed',
                     'admin_promoted', 'admin_demoted', 'deleted')),
  actor_player_id uuid not null references public.players (player_id),
  target_player_id uuid references public.players (player_id),
  metadata        jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default clock_timestamp()
);

comment on table public.group_events is
  'Bitácora append-only de mutaciones de un grupo (auditoría de admins/altas/bajas/renombres).';

create index group_events_group_idx on public.group_events (group_id, occurred_at);

alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.group_events enable row level security;

revoke all on table public.groups, public.group_memberships, public.group_events from anon, authenticated;
grant select, insert, update, delete on table public.groups to service_role;
grant select, insert, update, delete on table public.group_memberships to service_role;
grant select, insert, update, delete on table public.group_events to service_role;

-- ------------------------------------------------------------------
-- 2) Backstop DB-level del invariante "nunca cero admins activos"
-- ------------------------------------------------------------------

create or replace function public._groups_assert_has_active_admin()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  -- OLD no está asignado en INSERT ni NEW en DELETE: se elige por TG_OP.
  if tg_op = 'DELETE' then v_group_id := old.group_id; else v_group_id := new.group_id; end if;
  if exists (select 1 from public.groups g where g.group_id = v_group_id and g.status = 'active')
     and not exists (
       select 1 from public.group_memberships gm
       where gm.group_id = v_group_id and gm.left_at is null and gm.is_admin
     ) then
    raise exception 'group_without_active_admin' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create constraint trigger group_memberships_require_active_admin
  after insert or update or delete on public.group_memberships
  deferrable initially deferred
  for each row execute function public._groups_assert_has_active_admin();

revoke all on function public._groups_assert_has_active_admin() from public;

-- ------------------------------------------------------------------
-- 3) Helpers internos (no expuestos)
-- ------------------------------------------------------------------

create or replace function public._groups_caller_player_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  select p.player_id into v_player_id from public.players p where p.auth_user_id = auth.uid() and p.is_active;
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;
  return v_player_id;
end;
$$;

-- Mismas exclusiones que save_player/search_players: registrado, activo, no eliminado, perfil
-- completo (username). Único criterio de "jugador seleccionable" para agregar a un grupo.
create or replace function public._groups_player_selectable(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    where pl.player_id = p_player_id
      and pl.type = 'registered'
      and pl.is_active
      and pl.deleted_at is null
      and pr.username is not null
  );
$$;

create or replace function public._groups_log(
  p_group_id uuid, p_type text, p_actor uuid, p_target uuid default null, p_metadata jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.group_events (group_id, event_type, actor_player_id, target_player_id, metadata)
  values (p_group_id, p_type, p_actor, p_target, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Forma estable de "detalle de grupo" (la consume Fase B). Sin nombres: la identidad visual se
-- resuelve por player_id con los contratos vigentes (get_players_compact / perfil público).
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
    'createdByPlayerId', g.created_by_player_id,
    'createdAt', g.created_at,
    'updatedAt', g.updated_at,
    'isAdmin', exists (
      select 1 from public.group_memberships c
      where c.group_id = g.group_id and c.player_id = p_caller and c.left_at is null and c.is_admin),
    'members', coalesce((
      select jsonb_agg(m.j order by m.first_joined, m.player_id)
      from (
        select gm.player_id,
               min(gm.joined_at) as first_joined,
               jsonb_build_object(
                 'playerId', gm.player_id,
                 'isActive', bool_or(gm.left_at is null),
                 'isAdmin', bool_or(gm.left_at is null and gm.is_admin),
                 'periods', jsonb_agg(jsonb_build_object('joinedAt', gm.joined_at, 'leftAt', gm.left_at)
                                      order by gm.joined_at)
               ) as j
        from public.group_memberships gm
        where gm.group_id = g.group_id
        group by gm.player_id
      ) m
    ), '[]'::jsonb)
  )
  from public.groups g
  where g.group_id = p_group_id;
$$;

revoke all on function public._groups_caller_player_id() from public;
revoke all on function public._groups_player_selectable(uuid) from public;
revoke all on function public._groups_log(uuid, text, uuid, uuid, jsonb) from public;
revoke all on function public._groups_detail_json(uuid, uuid) from public;

-- ------------------------------------------------------------------
-- 4) Lecturas de grupo
-- ------------------------------------------------------------------

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

create or replace function public.get_group_detail(p_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
begin
  -- Mismo código para "no existe", "eliminado" y "no soy miembro activo": no filtra existencia.
  if p_group_id is null or not exists (
    select 1 from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.player_id = v_caller and gm.left_at is null
    where g.group_id = p_group_id and g.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'group_not_found');
  end if;
  return jsonb_build_object('ok', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

-- ------------------------------------------------------------------
-- 5) Mutaciones
-- ------------------------------------------------------------------

create or replace function public.create_group(p_name text, p_member_player_ids uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_group_id uuid;
  v_member uuid;
  v_ids uuid[];
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name');
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_member_player_ids, '{}')) x
  where x is not null and x <> v_caller;

  if coalesce(array_length(v_ids, 1), 0) > 100 then
    return jsonb_build_object('ok', false, 'code', 'too_many_members');
  end if;

  -- Todo o nada: un solo id inválido cancela la creación completa (sin grupo a medias).
  foreach v_member in array v_ids loop
    if not public._groups_player_selectable(v_member) then
      return jsonb_build_object('ok', false, 'code', 'player_not_found', 'playerId', v_member);
    end if;
  end loop;

  insert into public.groups (name, created_by_player_id) values (v_name, v_caller)
  returning group_id into v_group_id;

  insert into public.group_memberships (group_id, player_id, is_admin, added_by_player_id)
  values (v_group_id, v_caller, true, v_caller);

  foreach v_member in array v_ids loop
    insert into public.group_memberships (group_id, player_id, is_admin, added_by_player_id)
    values (v_group_id, v_member, false, v_caller);
  end loop;

  perform public._groups_log(v_group_id, 'created', v_caller, null, jsonb_build_object('name', v_name));
  foreach v_member in array v_ids loop
    perform public._groups_log(v_group_id, 'member_added', v_caller, v_member);
  end loop;

  return jsonb_build_object('ok', true, 'group', public._groups_detail_json(v_group_id, v_caller));
end;
$$;

-- Bloquea el grupo y valida "miembro activo" (+ admin si se pide). Devuelve NULL si ok, o el
-- código de error. Único punto de autorización de las mutaciones administrativas.
create or replace function public._groups_lock_and_authorize(p_group_id uuid, p_caller uuid, p_require_admin boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  perform 1 from public.groups g where g.group_id = p_group_id and g.status = 'active' for update;
  if not found then return 'group_not_found'; end if;

  select gm.is_admin into v_is_admin
  from public.group_memberships gm
  where gm.group_id = p_group_id and gm.player_id = p_caller and gm.left_at is null;
  if not found then return 'group_not_found'; end if;

  if p_require_admin and not v_is_admin then return 'not_admin'; end if;
  return null;
end;
$$;

revoke all on function public._groups_lock_and_authorize(uuid, uuid, boolean) from public;

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
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
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

create or replace function public.add_group_member(p_group_id uuid, p_player_id uuid)
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

  if p_player_id is null or not public._groups_player_selectable(p_player_id) then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  -- Ya activo: idempotente (no abre un segundo período).
  if exists (select 1 from public.group_memberships
             where group_id = p_group_id and player_id = p_player_id and left_at is null) then
    return jsonb_build_object('ok', true, 'changed', false, 'group', public._groups_detail_json(p_group_id, v_caller));
  end if;

  -- Período NUEVO (alta o reingreso); los anteriores quedan intactos.
  insert into public.group_memberships (group_id, player_id, is_admin, added_by_player_id)
  values (p_group_id, p_player_id, false, v_caller);
  update public.groups set updated_at = now() where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'member_added', v_caller, p_player_id);

  return jsonb_build_object('ok', true, 'changed', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

create or replace function public.remove_group_member(p_group_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_err text;
  v_target public.group_memberships%rowtype;
  v_other_admins integer;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  select * into v_target from public.group_memberships
  where group_id = p_group_id and player_id = p_player_id and left_at is null;
  if not found then
    return jsonb_build_object('ok', true, 'changed', false, 'group', public._groups_detail_json(p_group_id, v_caller));
  end if;

  if v_target.is_admin then
    select count(*) into v_other_admins from public.group_memberships
    where group_id = p_group_id and left_at is null and is_admin and membership_id <> v_target.membership_id;
    if v_other_admins = 0 then
      return jsonb_build_object('ok', false, 'code', 'last_admin');
    end if;
  end if;

  -- Cierra el período: NO se borra la fila (historia intacta).
  update public.group_memberships
    set left_at = greatest(clock_timestamp(), joined_at), removed_by_player_id = v_caller, updated_at = now()
    where membership_id = v_target.membership_id;
  update public.groups set updated_at = now() where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'member_removed', v_caller, p_player_id);

  -- Si el caller se quitó a sí mismo (admin con otro admin presente), ya no puede leer el detalle.
  if v_caller = p_player_id then
    return jsonb_build_object('ok', true, 'changed', true, 'group', null);
  end if;
  return jsonb_build_object('ok', true, 'changed', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

create or replace function public.promote_group_admin(p_group_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_err text;
  v_target public.group_memberships%rowtype;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  select * into v_target from public.group_memberships
  where group_id = p_group_id and player_id = p_player_id and left_at is null;
  if not found then return jsonb_build_object('ok', false, 'code', 'target_not_member'); end if;

  if v_target.is_admin then
    return jsonb_build_object('ok', true, 'changed', false, 'group', public._groups_detail_json(p_group_id, v_caller));
  end if;

  update public.group_memberships set is_admin = true, updated_at = now() where membership_id = v_target.membership_id;
  update public.groups set updated_at = now() where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'admin_promoted', v_caller, p_player_id);
  return jsonb_build_object('ok', true, 'changed', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

create or replace function public.demote_group_admin(p_group_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_err text;
  v_target public.group_memberships%rowtype;
  v_other_admins integer;
begin
  if not public.consume_rate_limit(v_caller, 'group_mutation', 60, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_err := public._groups_lock_and_authorize(p_group_id, v_caller, true);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', v_err); end if;

  select * into v_target from public.group_memberships
  where group_id = p_group_id and player_id = p_player_id and left_at is null;
  if not found then return jsonb_build_object('ok', false, 'code', 'target_not_member'); end if;

  if not v_target.is_admin then
    return jsonb_build_object('ok', true, 'changed', false, 'group', public._groups_detail_json(p_group_id, v_caller));
  end if;

  select count(*) into v_other_admins from public.group_memberships
  where group_id = p_group_id and left_at is null and is_admin and membership_id <> v_target.membership_id;
  if v_other_admins = 0 then
    return jsonb_build_object('ok', false, 'code', 'last_admin');
  end if;

  update public.group_memberships set is_admin = false, updated_at = now() where membership_id = v_target.membership_id;
  update public.groups set updated_at = now() where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'admin_demoted', v_caller, p_player_id);

  -- Si el caller se demovió a sí mismo, su detalle sigue legible (sigue siendo miembro) pero
  -- con isAdmin=false.
  return jsonb_build_object('ok', true, 'changed', true, 'group', public._groups_detail_json(p_group_id, v_caller));
end;
$$;

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

  -- Borrado LÓGICO: memberships, group_events y partidos quedan intactos.
  update public.groups
    set status = 'deleted', deleted_at = now(), deleted_by_player_id = v_caller, updated_at = now()
    where group_id = p_group_id;
  perform public._groups_log(p_group_id, 'deleted', v_caller);
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------------
-- 6) Autoridad deportiva compartida — datos normalizados para groups.js
-- ------------------------------------------------------------------

create or replace function public.get_group_competition_data(
  p_group_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_caller uuid := public._groups_caller_player_id();
  v_matches jsonb;
begin
  if p_group_id is null or not exists (
    select 1 from public.groups g
    join public.group_memberships gm on gm.group_id = g.group_id and gm.player_id = v_caller and gm.left_at is null
    where g.group_id = p_group_id and g.status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'code', 'group_not_found');
  end if;

  with mem as (
    select gm.player_id, gm.joined_at, gm.left_at
    from public.group_memberships gm where gm.group_id = p_group_id
  ),
  cand as (
    select m.match_id, m.played_at, m.played_at_time_known, m.format_id, m.scoring_system,
           m.winner_team, m.current_revision_id
    from public.matches m
    where m.status = 'validated'
      and m.winner_team is not null
      and m.current_revision_id is not null
      and (p_from is null or m.played_at >= p_from)
      and (p_to is null or m.played_at < p_to)
      and (
        select count(distinct mp.player_id)
        from public.match_participants mp
        join mem on mem.player_id = mp.player_id
                and mem.joined_at <= m.played_at
                and (mem.left_at is null or m.played_at < mem.left_at)
        where mp.match_id = m.match_id
      ) >= 3
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'matchId', c.match_id,
    'playedAt', c.played_at,
    'playedAtTimeKnown', c.played_at_time_known,
    'formatId', c.format_id,
    'scoringSystem', c.scoring_system,
    'winnerTeam', c.winner_team,
    'sets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'setNumber', ms.set_number, 'gamesA', ms.games_a, 'gamesB', ms.games_b,
               'tiebreakA', ms.tiebreak_a, 'tiebreakB', ms.tiebreak_b) order by ms.set_number)
      from public.match_sets ms
      join public.match_revisions mr on mr.match_id = ms.match_id and mr.revision_number = ms.revision_number
      where mr.revision_id = c.current_revision_id
    ), '[]'::jsonb),
    'players', (
      select jsonb_agg(jsonb_build_object(
               'playerId', mp.player_id,
               'team', mp.team,
               'position', mp.position_in_team,
               'isGroupMember', exists (
                 select 1 from mem
                 where mem.player_id = mp.player_id and mem.joined_at <= c.played_at
                   and (mem.left_at is null or c.played_at < mem.left_at)),
               'levelBefore', (
                 select mlrp.effective_level
                 from public.match_level_results mlr
                 join public.match_level_result_players mlrp on mlrp.result_id = mlr.result_id
                 where mlr.match_id = c.match_id and mlr.effect_status = 'applied' and mlr.eligible
                   and mlrp.player_id = mp.player_id)
             ) order by mp.team, mp.position_in_team)
      from public.match_participants mp where mp.match_id = c.match_id
    )
  ) order by c.played_at, c.match_id), '[]'::jsonb)
  into v_matches
  from cand c;

  return jsonb_build_object(
    'ok', true,
    'group', public._groups_detail_json(p_group_id, v_caller),
    'matches', v_matches
  );
end;
$$;

comment on function public.get_group_competition_data(uuid, timestamptz, timestamptz) is
  'Lectura deportiva de un grupo (solo miembros activos; group_not_found si no). Devuelve datos
   normalizados para el motor puro bramulab/groups.js — NO calcula puntos. matches: solo partidos
   validated con >=3 miembros activos en played_at, con sets de la revisión OFICIAL vigente, los 4
   participantes por player_id, isGroupMember en la fecha del partido y levelBefore (Nivel oficial
   previo al partido, NULL si no hay evidencia => sin bonus Sorpresa). group.members trae los
   períodos históricos de pertenencia.';

-- ------------------------------------------------------------------
-- 7) Permisos: solo authenticated (nunca anon); helpers internos sin GRANT.
-- ------------------------------------------------------------------

revoke all on function public.list_my_groups() from public;
revoke all on function public.get_group_detail(uuid) from public;
revoke all on function public.create_group(text, uuid[]) from public;
revoke all on function public.rename_group(uuid, text) from public;
revoke all on function public.add_group_member(uuid, uuid) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.promote_group_admin(uuid, uuid) from public;
revoke all on function public.demote_group_admin(uuid, uuid) from public;
revoke all on function public.delete_group(uuid) from public;
revoke all on function public.get_group_competition_data(uuid, timestamptz, timestamptz) from public;

grant execute on function public.list_my_groups() to authenticated;
grant execute on function public.get_group_detail(uuid) to authenticated;
grant execute on function public.create_group(text, uuid[]) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.promote_group_admin(uuid, uuid) to authenticated;
grant execute on function public.demote_group_admin(uuid, uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.get_group_competition_data(uuid, timestamptz, timestamptz) to authenticated;
