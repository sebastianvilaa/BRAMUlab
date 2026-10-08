-- BRAMU Metrics V1 — ALTA DE LA ÚNICA CUENTA ADMINISTRADORA (la ejecuta Central, a mano, UNA vez por entorno).
--
-- Ver docs/BRAMUlab/Operacion/Runbook_Operacion_y_Salida.md Parte D (paso 3). Probado en PGlite:
-- supabase/functions/_shared/metrics-admin-grant.test.mjs.
--
-- Qué hace: resuelve UNA sola vez, por @usuario, el UUID de `auth.users` de la cuenta indicada y lo inserta en `metrics_admins`.
-- A partir de ahí el acceso depende SOLO de ese UUID (nunca del @usuario, el email ni metadatos). El UUID no se escribe en ningún documento.
-- Es SEGURA POR CONSTRUCCIÓN (aborta con un error claro, sin insertar nada, si algo no es exactamente lo esperado):
--   * ya existe un administrador activo (la regla es UNA sola cuenta: para cambiarla se revoca primero la anterior);
--   * no hay exactamente UNA cuenta registrada, activa y no eliminada con ese @usuario, con vínculo a Auth y email confirmado.
--
-- Production: dejar v_username = 'seba'. Staging: 'seba_qa'. Verificación posterior (ESPERADO: admins_active = 1, ese UUID es administrador):
--   select count(*) as admins_active from public.metrics_admins where revoked_at is null;
--   select public.metrics_is_admin((select auth_user_id from public.metrics_admins where revoked_at is null));

do $$
declare
  v_username constant text := 'seba';
  v_label    constant text := 'Sebastián (@seba, Production)';
  v_ids uuid[];
begin
  if exists (select 1 from public.metrics_admins where revoked_at is null) then
    raise exception 'metrics_admin_already_granted: ya hay un administrador activo; revocarlo antes de dar de alta otro' using errcode = 'P0001';
  end if;

  select array_agg(pl.auth_user_id) into v_ids
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    join auth.users u on u.id = pl.auth_user_id and u.email_confirmed_at is not null
   where lower(pr.username) = lower(v_username)
     and pl.type = 'registered' and pl.is_active and pl.deleted_at is null and pl.auth_user_id is not null;

  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    raise exception 'metrics_admin_account_not_unique: se esperaba exactamente 1 cuenta activa con @%, hay %', v_username, coalesce(array_length(v_ids, 1), 0) using errcode = 'P0001';
  end if;

  insert into public.metrics_admins (auth_user_id, label) values (v_ids[1], v_label);
end $$;
