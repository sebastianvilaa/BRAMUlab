-- BRAMUlab — Bloque 7 (Fase 1, corrección): endurecimiento de seguridad/concurrencia.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{05_Revision_Central_Fase_1.md,
-- 06_Correccion_Fase_1_Claude.md}. Ninguna de las dos migraciones anteriores de Fase 1
-- (20260922100000/20260922110000) llegó a aplicarse a Supabase real — el dry-run con
-- `BEGIN...ROLLBACK` de la revisión central detectó los problemas de acá antes de que
-- persistieran. Esta migración corrige, en el mismo lote sin aplicar todavía:
--
--   F1-C01 — `complete_ranking_profile_data` quedaba ejecutable por PUBLIC/anon (Postgres
--            otorga EXECUTE a PUBLIC por defecto al crear una función; el archivo anterior
--            nunca lo revocaba). Mismo bug ya visto y corregido en Bloque 6
--            (`20260921235000_bloque6_internal_helper_grants.sql`) — no debía repetirse.
--   F1-C02 — `ranking_editions`/`ranking_rows`/`location_change_events` se declaran
--            inmutables/append-only en comentarios, pero `service_role` conservaba UPDATE/
--            DELETE (por el GRANT explícito del archivo anterior Y por los default privileges
--            ya existentes del proyecto, que otorgan CRUD a `service_role` sobre tablas nuevas
--            de `public`).
--   F1-C03 — `complete_profile` (Bloque 2/3) seguía pudiendo escribir `location_id`/
--            `competitive_branch` sin cooldown ni auditoría — una cuenta autenticada podía
--            evitar `complete_ranking_profile_data` llamando directamente a la RPC vieja.
--   F1-C04 — `complete_ranking_profile_data` leía el perfil sin `FOR UPDATE`: dos llamadas
--            concurrentes podían leer el mismo `location_effective_from`, superar ambas el
--            guard de cooldown y generar dos cambios/eventos.

-- ------------------------------------------------------------------
-- F1-C03 — complete_profile deja de escribir ubicación/rama (Bloque 2/3, sin rehacerlo)
-- ------------------------------------------------------------------

-- Mismo cuerpo que `20260919120000_bloque3_nivel_persistente.sql`, con UN solo cambio real:
-- `p_competitive_branch`/`p_location_*` dejan de escribir `profiles.competitive_branch`/
-- `profiles.location_id` — se conservan en la firma (misma firma exacta, sin DROP FUNCTION,
-- sin tocar el contrato ni los GRANT ya validados de Bloque 2/3) pero quedan ignorados a
-- propósito. Desde esta migración, `complete_ranking_profile_data` es la ÚNICA vía server-side
-- para completar o cambiar esos dos campos (cooldown de 30 días + `location_change_events`).
-- Se eliminan también las validaciones de formato de esos dos parámetros (`competitive_branch_
-- invalid`/`location_required`): validar un valor que ya no se escribe en ningún lado solo
-- confundiría a un llamador real. El resto de la función (username/nombre/apellido/
-- display_name/fecha de nacimiento/género/mano/lado/términos, unique_violation, actualización
-- de `players.display_name`) queda carácter por carácter igual — `auth.js`/`app.js` (el único
-- llamador real hoy, Bloque 2/3) nunca envían `location`/`competitiveBranch` en su payload
-- (confirmado leyendo `bramulab/auth.js:completeProfile`/`bramulab/app.js:runOfficializeAndEnter`
-- antes de este cambio), así que el onboarding/reintentos vigentes no se ven afectados.
create or replace function public.complete_profile(
  p_username text,
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_birth_date date,
  p_gender text,
  p_dominant_hand text,
  p_preferred_side text,
  p_competitive_branch text,
  p_location_country_code text,
  p_location_province_label text,
  p_location_locality_label text,
  p_location_georef_province_id text default null,
  p_location_georef_locality_id text default null,
  p_terms_version text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id            uuid;
  v_username             text := lower(trim(p_username));
  v_current_username     text;
  v_result               public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if v_username !~ '^[a-z0-9._]{3,24}$' then
    raise exception 'username_invalid_format' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reserved_usernames where username = v_username) then
    raise exception 'username_reserved' using errcode = 'P0001';
  end if;

  select username into v_current_username from public.profiles where player_id = v_player_id;
  if v_current_username is not null and v_current_username <> v_username then
    raise exception 'username_locked' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_first_name), '') = '' then
    raise exception 'first_name_required' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'display_name_required' using errcode = 'P0001';
  end if;
  if p_gender is not null and p_gender not in ('femenino', 'masculino', 'otro', 'prefiero-no-decir') then
    raise exception 'gender_invalid' using errcode = 'P0001';
  end if;
  if p_dominant_hand is not null and p_dominant_hand not in ('derecha', 'izquierda') then
    raise exception 'dominant_hand_invalid' using errcode = 'P0001';
  end if;
  if p_preferred_side is not null and p_preferred_side not in ('drive', 'reves', 'indiferente') then
    raise exception 'preferred_side_invalid' using errcode = 'P0001';
  end if;

  -- Bloque 7, F1-C03: `p_competitive_branch`/`p_location_*` quedan deliberadamente sin usar
  -- acá abajo — ni se validan ni se escriben. `location_id`/`competitive_branch` conservan
  -- SIEMPRE el valor que ya tenían (columnas ausentes del SET, nunca sobreescritas), sin
  -- importar qué mande el llamador. Ver `complete_ranking_profile_data`
  -- (`20260922110000_bloque7_ranking_profile_data.sql`) para la vía real.

  update public.profiles set
    username = v_username,
    first_name = p_first_name,
    last_name = p_last_name,
    display_name = p_display_name,
    birth_date = p_birth_date,
    gender = p_gender,
    dominant_hand = p_dominant_hand,
    preferred_side = p_preferred_side,
    terms_version = coalesce(p_terms_version, terms_version),
    terms_accepted_at = case when p_terms_version is not null then now() else terms_accepted_at end,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  update public.players set display_name = p_display_name, updated_at = now()
  where player_id = v_player_id;

  return v_result;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
end;
$$;

comment on function public.complete_profile is
  'Única vía de escritura de perfil MÍNIMO (username/nombre/apellido/display_name/fecha de
   nacimiento/género/mano/lado/términos). Bloque 7 (F1-C03, 05_Revision_Central_Fase_1.md
   C-04/C-03): p_competitive_branch/p_location_* quedan en la firma por compatibilidad pero ya
   NO escriben nada — complete_ranking_profile_data es la única vía para completar/cambiar
   localidad deportiva y rama competitiva, con cooldown de 30 días y auditoría en
   location_change_events. username sigue fijo tras el primer set y único.';

-- ------------------------------------------------------------------
-- F1-C04 — complete_ranking_profile_data: bloquear la fila antes de decidir el cooldown
-- ------------------------------------------------------------------

-- Mismo cuerpo que `20260922110000_bloque7_ranking_profile_data.sql`, con UN solo cambio real:
-- el SELECT del perfil ahora es `FOR UPDATE` — bloquea la fila de `profiles` del jugador desde
-- que se lee hasta que termina la transacción (COMMIT o ROLLBACK de esta misma llamada), así
-- que una segunda llamada concurrente para el MISMO player_id queda esperando en ese SELECT en
-- vez de leer el mismo `location_effective_from` todavía no actualizado. Con eso, el cooldown +
-- el UPDATE + el INSERT en location_change_events quedan efectivamente serializados por
-- jugador, sin necesitar un lock explícito aparte.
create or replace function public.complete_ranking_profile_data(
  p_competitive_branch text,
  p_ranking_opt_in boolean,
  p_location_country_code text,
  p_location_province_label text,
  p_location_locality_label text,
  p_location_georef_province_id text default null,
  p_location_georef_locality_id text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id            uuid;
  v_profile              public.profiles;
  v_source               text;
  v_verified             boolean;
  v_location_id          uuid;
  v_previous_location_id uuid;
  v_change_type          text;
  v_result               public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- F1-C04: FOR UPDATE — bloquea esta fila de profiles hasta el fin de la transacción, para que
  -- dos llamadas concurrentes del mismo jugador nunca lean el mismo estado de cooldown a la vez.
  select * into v_profile from public.profiles where player_id = v_player_id for update;
  if v_profile is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;
  if v_profile.username is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  if p_ranking_opt_in is null then
    raise exception 'ranking_opt_in_required' using errcode = 'P0001';
  end if;

  if p_competitive_branch is null or p_competitive_branch not in ('F', 'M') then
    raise exception 'competitive_branch_invalid' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_location_province_label), '') = '' or coalesce(trim(p_location_locality_label), '') = '' then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  if p_location_georef_province_id is not null and p_location_georef_locality_id is not null then
    v_source := 'georef';
    v_verified := true;
    select location_id into v_location_id
      from public.locations
      where source = 'georef'
        and georef_province_id = p_location_georef_province_id
        and georef_locality_id = p_location_georef_locality_id;
  else
    v_source := 'manual';
    v_verified := false;
    v_location_id := null;
  end if;

  if v_location_id is null then
    insert into public.locations (
      country_code, source, georef_province_id, georef_locality_id,
      province_label, locality_label, display_label, verified_for_ranking
    ) values (
      coalesce(p_location_country_code, 'AR'), v_source, p_location_georef_province_id, p_location_georef_locality_id,
      trim(p_location_province_label), trim(p_location_locality_label),
      trim(p_location_locality_label) || ', ' || trim(p_location_province_label), v_verified
    )
    on conflict (source, georef_province_id, georef_locality_id) do update
      set updated_at = now()
    returning location_id into v_location_id;
  end if;

  v_previous_location_id := v_profile.location_id;

  if v_previous_location_id is null then
    v_change_type := 'initial';
  elsif v_location_id <> v_previous_location_id then
    if v_profile.location_effective_from is not null
       and now() < v_profile.location_effective_from + interval '30 days' then
      raise exception 'location_change_cooldown' using errcode = 'P0001';
    end if;
    v_change_type := 'update';
  else
    v_change_type := null;
  end if;

  update public.profiles set
    competitive_branch = p_competitive_branch,
    ranking_opt_in = p_ranking_opt_in,
    location_id = v_location_id,
    location_effective_from = case when v_change_type is not null then now() else location_effective_from end,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_change_type is not null then
    insert into public.location_change_events (player_id, change_type, previous_location_id, new_location_id, effective_at)
    values (v_player_id, v_change_type, v_previous_location_id, v_location_id, now());
  end if;

  return v_result;
end;
$$;

comment on function public.complete_ranking_profile_data is
  'Única vía de escritura de localidad deportiva/competitive_branch/ranking_opt_in
   (05_Revision_Central_Fase_1.md C-04/F1-C04) — implementa el gate de Ranking_BRAMU.md §13.7
   sin reutilizar complete_profile. FOR UPDATE sobre la fila propia serializa dos llamadas
   concurrentes del mismo jugador (F1-C04). Cooldown de 30 días únicamente ante un cambio real
   de ubicación; registra alta/cambio en location_change_events.';

-- ------------------------------------------------------------------
-- F1-C01 — revocar EXECUTE de PUBLIC/anon sobre complete_ranking_profile_data
-- ------------------------------------------------------------------

-- Postgres otorga EXECUTE a PUBLIC por defecto al crear una función — el archivo anterior
-- (20260922110000) nunca lo revocaba, así que quedaba ejecutable por `anon` (que hereda de
-- PUBLIC salvo revocación explícita) además de por `authenticated` (que ya tenía su propio
-- GRANT explícito, y lo conserva sin cambios: revocar de PUBLIC no le afecta). Mismo bug ya
-- corregido en Bloque 6 para `_bloque6_refresh_participant_fingerprint`/
-- `_bloque6_revert_applied_result` (`20260921235000_bloque6_internal_helper_grants.sql`).
revoke all on function public.complete_ranking_profile_data(
  text, boolean, text, text, text, text, text
) from public;

-- ------------------------------------------------------------------
-- F1-C02 — las tablas append-only/inmutables no pueden quedar mutables por service_role
-- ------------------------------------------------------------------

-- El archivo anterior (20260922100000) otorgaba explícitamente UPDATE/DELETE a service_role
-- sobre las tres, y además el proyecto tiene default privileges previos que ya conceden CRUD a
-- service_role sobre toda tabla nueva de `public` (se aplican en el momento de CREATE TABLE,
-- antes de que esta migración pueda evitarlo) — REVOKE explícito después de crear las tablas es
-- la única forma de dejarlas realmente append-only para el rol con el que corre la API. SELECT
-- e INSERT quedan intactos: es lo único que necesita la función de cálculo de Fase 2. Una
-- limpieza excepcional de fixtures de QA (como la que cerró Bloque 6) se hace por
-- owner/SQL editor, que nunca está sujeto a estos GRANT/REVOKE — ver Ranking_BRAMU.md §16 y
-- 05_Revision_Central_Fase_1.md §3.
revoke update, delete on table public.ranking_editions from service_role;
revoke update, delete on table public.ranking_rows from service_role;
revoke update, delete on table public.location_change_events from service_role;
