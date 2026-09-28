-- Pre-Production · Grupos BRAMU
-- Hotfix QA real B1 — trigger diferido de "nunca cero admins" bajo sesión authenticated.
--
-- El constraint trigger es DEFERRABLE INITIALLY DEFERRED. Al dispararse en COMMIT ya no conserva
-- el contexto SECURITY DEFINER de create_group/otras RPCs y, como las tablas de Grupos están
-- correctamente revocadas para authenticated, la función invoker-rights fallaba con 42501.
--
-- La función sigue siendo interna y sin EXECUTE público; SECURITY DEFINER le permite únicamente
-- verificar el invariante sobre las tablas protegidas cuando PostgreSQL dispara el trigger.

create or replace function public._groups_assert_has_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if tg_op = 'DELETE' then
    v_group_id := old.group_id;
  else
    v_group_id := new.group_id;
  end if;

  if exists (
       select 1
       from public.groups g
       where g.group_id = v_group_id
         and g.status = 'active'
     )
     and not exists (
       select 1
       from public.group_memberships gm
       where gm.group_id = v_group_id
         and gm.left_at is null
         and gm.is_admin
     ) then
    raise exception 'group_without_active_admin' using errcode = 'P0001';
  end if;

  return null;
end;
$$;

revoke all on function public._groups_assert_has_active_admin() from public;
