-- BRAMUlab — Bloque 3: Nivel BRAMU productivo y persistente.
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_03/03_Revision_ChatGPT.md para las
-- decisiones cerradas que esta migración implementa. Resumen:
--
--   1) agrega `terms_version`/`terms_accepted_at` a `profiles` (§10 de la revisión);
--   2) relaja `complete_profile` para que `competitive_branch` y ubicación dejen de ser
--      obligatorios (perfil mínimo = nombre+apellido+@usuario+términos) — SIN generalizar a
--      un merge parcial con COALESCE en los campos de Bloque 2 (§4 de la revisión: "no hacer
--      COALESCE genérico"). El resto de las validaciones (formato/reservado/unicidad/
--      username_locked) queda intacto;
--   3) abre `is_username_available` a `anon`, acotada a disponibilidad booleana (§6);
--   4) crea `level_states`/`level_events` (§6.5 de Backend_Infraestructura.md), con
--      `level_states.status` incluyendo PENDIENTE explícito (§3 de la revisión — NO se
--      representa como ausencia de fila, aunque esa haya sido la convención histórica del
--      prototipo local);
--   5) extiende idempotentemente `handle_email_confirmed` para crear también el
--      `level_states` PENDIENTE en el mismo momento que `players`/`profiles` (§3/§8 de la
--      revisión: "email confirmado ≠ onboarding terminado", pero la identidad server-side
--      mínima puede existir apenas hay player_id);
--   6) crea la RPC privada `officialize_level_onboarding` — ÚNICA vía de escritura de
--      `level_states`/`level_events`, alcanzable EXCLUSIVAMENTE por `service_role` (nunca
--      `authenticated`): la llama la Edge Function `officialize-onboarding`, que ya validó el
--      JWT del usuario y ya corrió el motor JS compartido (level.js/level-calibration.js)
--      antes de pedir la persistencia — el motor NO se reimplementa acá en SQL (§2 de la
--      revisión). Idempotente por estado + `for update` + índice único parcial (§9).
--
-- Deliberadamente FUERA de esta migración (no le corresponde a Bloque 3):
--   - `match_level_results`: depende de partidos reales validados (Bloque 5/6).
--   - más `event_type` en `level_events` (match_delta, recalibration_*, correction): se
--     agregan al CHECK recién cuando el bloque que los emite exista de verdad.
--   - la pantalla "Completá tus datos para el Ranking" (§5 de la revisión: no se adelanta
--     Bloque 7) — el modelo ya admite localidad/rama/ranking_opt_in incompletos sin bloquear.

-- ------------------------------------------------------------------
-- 1) profiles — soporte técnico de términos y condiciones (§10)
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_version is
  'Versión de términos y condiciones aceptada (string libre, sin sistema legal todavía —
   Bloque 3 §10 de 03_Revision_ChatGPT.md). NULL mientras el perfil sigue sin aceptación.';
comment on column public.profiles.terms_accepted_at is
  'Timestamp de SERVIDOR (nunca del cliente) de la última aceptación de términos registrada
   por complete_profile. La aceptación se persiste server-side, no depende solo del borrador
   local del onboarding.';

-- ------------------------------------------------------------------
-- 2) complete_profile — perfil mínimo sin rama/ubicación obligatorias (§4)
-- ------------------------------------------------------------------

/** Misma función de Bloque 2, con 2 relajaciones puntuales y 1 parámetro nuevo, nada más:
 *    - `p_competitive_branch` ya NO es obligatorio (antes: `competitive_branch_invalid` si
 *      era null). Si se manda, se sigue validando el formato F/M igual que siempre.
 *    - la ubicación ya NO es obligatoria (antes: `location_required` si faltaba). Si se manda
 *      CUALQUIERA de las 2 etiquetas (provincia/localidad), se exige la otra igual que antes
 *      (sigue sin admitir un envío parcial ambiguo) y el find-or-create de `locations` no
 *      cambia en absoluto.
 *    - `p_terms_version` (nuevo, opcional): si se manda, persiste `terms_version` y fija
 *      `terms_accepted_at = now()` (timestamp de servidor). NO es un merge genérico: el resto
 *      de los campos (username/nombre/apellido/display_name/birth_date/gender/mano/lado)
 *      sigue siendo sobreescritura total, exactamente como en Bloque 2 — 03_Revision_
 *      ChatGPT.md §4 pidió explícitamente no generalizar a COALESCE.
 *  Username sigue fijo tras el primer set (`username_locked`) y único (`username_taken`). */
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
  v_player_id uuid;
  v_username text := lower(trim(p_username));
  v_current_username text;
  v_has_location boolean := coalesce(trim(p_location_province_label), '') <> '' or coalesce(trim(p_location_locality_label), '') <> '';
  v_source text;
  v_verified boolean;
  v_location_id uuid;
  v_result public.profiles;
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
  -- Bloque 3 (Backend_Infraestructura.md §8.2) — rama competitiva deja de ser obligatoria acá:
  -- el perfil mínimo previo a Nivel no la pide. Se sigue validando el formato SOLO si se manda
  -- un valor (por ejemplo, un futuro "completar datos para Ranking" con su propio contrato).
  if p_competitive_branch is not null and p_competitive_branch not in ('F', 'M') then
    raise exception 'competitive_branch_invalid' using errcode = 'P0001';
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

  if v_has_location then
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
  else
    -- Perfil mínimo sin ubicación todavía (Bloque 3): nunca se inventa ni se conserva una
    -- ubicación previa acá — v_location_id queda null, igual que antes de Bloque 3 para una
    -- cuenta que recién arma su perfil.
    v_location_id := null;
  end if;

  update public.profiles set
    username = v_username,
    first_name = p_first_name,
    last_name = p_last_name,
    display_name = p_display_name,
    birth_date = p_birth_date,
    gender = p_gender,
    dominant_hand = p_dominant_hand,
    preferred_side = p_preferred_side,
    competitive_branch = p_competitive_branch,
    location_id = v_location_id,
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
  'Única vía de escritura de perfil. Bloque 3: competitive_branch/ubicación dejan de ser
   obligatorios (perfil mínimo), agrega terms_version/terms_accepted_at. username sigue fijo
   tras el primer set y único. Ver 03_Revision_ChatGPT.md §4.';

grant execute on function public.complete_profile(
  text, text, text, text, date, text, text, text, text, text, text, text, text, text, text
) to authenticated;

-- ------------------------------------------------------------------
-- 3) is_username_available — abierta a anon, acotada (§6)
-- ------------------------------------------------------------------

-- Sin cambios en el cuerpo de la función (Bloque 2): solo devuelve un booleano de formato/
-- reservado/unicidad, nunca datos de perfil. El único cambio es el GRANT — feedback real de
-- disponibilidad durante el borrador PRE-confirmación de email, cuando todavía no hay sesión
-- (`authenticated`). La validación definitiva sigue siendo server-side en
-- officialize_level_onboarding → complete_profile al oficializar (la carrera de @usuario NO
-- desaparece por esto, ver 03_Revision_ChatGPT.md §6).
grant execute on function public.is_username_available(text) to anon;

-- ------------------------------------------------------------------
-- 4) level_states — estado actual de Nivel BRAMU por jugador (Backend_Infraestructura.md §6.5)
-- ------------------------------------------------------------------

create table public.level_states (
  player_id uuid primary key references public.players (player_id) on delete cascade,
  -- PENDIENTE explícito (03_Revision_ChatGPT.md §3): el contrato backend define los 4 estados
  -- como valores reales de columna, nunca como "ausencia de fila" (esa fue la convención del
  -- prototipo local en localStorage, no la del backend productivo).
  status text not null default 'PENDIENTE' check (status in ('PENDIENTE', 'CALIBRANDO', 'CALIBRADO', 'RECALIBRANDO')),
  -- Precisión interna 4 decimales (numeric sin escala fija: el motor ya redondea a 4
  -- decimales con round4 antes de mandar el valor — Nivel_BRAMU_Formula_V1.5.md §2,
  -- confirmado sin cambios por 03_Revision_ChatGPT.md §1). El valor público de 1 decimal se
  -- deriva en lectura (roundPublicLevel), nunca se duplica como columna aparte.
  mu numeric,
  confidence numeric,
  rated_matches integer not null default 0,
  distinct_opponents integer not null default 0,
  declared_category text,
  category_context_key text,
  algorithm_version text,
  questionnaire_version text,
  questionnaire_mode text check (questionnaire_mode is null or questionnaire_mode in ('quick', 'full')),
  last_rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.level_states is
  'Estado actual de Nivel BRAMU por jugador. PENDIENTE lo crea handle_email_confirmed
   (trigger) apenas existe player_id; la transición a CALIBRANDO la hace EXCLUSIVAMENTE
   officialize_level_onboarding (RPC privada, solo service_role) — nunca un INSERT/UPDATE
   directo del cliente. mu/confidence son la autoridad server-side; el navegador nunca calcula
   el valor oficial, solo una vista previa local antes de confirmar el email.';

alter table public.level_states enable row level security;

drop policy if exists "level_states_select_own" on public.level_states;
create policy "level_states_select_own"
  on public.level_states
  for select
  to authenticated
  using (player_id in (select player_id from public.players where auth_user_id = auth.uid()));

grant select on table public.level_states to authenticated;
grant select, insert, update, delete on table public.level_states to service_role;
-- Sin insert/update/delete para authenticated/anon: deny-by-default, igual que profiles.

-- ------------------------------------------------------------------
-- 5) level_events — historial append-only de Nivel BRAMU (Backend_Infraestructura.md §6.5)
-- ------------------------------------------------------------------

create table public.level_events (
  event_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (player_id) on delete cascade,
  -- Bloque 3 solo emite 'initial_estimate'. Los demás tipos documentados en
  -- Backend_Infraestructura.md §6.5 (variación por partido, corrección/reversión, entrada/
  -- salida de recalibración) se agregan a este CHECK cuando el bloque que los emite exista de
  -- verdad — nunca se declara estructura sin uso, mismo criterio que pilot_events en Bloque 2.
  event_type text not null check (event_type in ('initial_estimate')),
  algorithm_version text not null,
  questionnaire_version text not null,
  questionnaire_mode text not null check (questionnaire_mode in ('quick', 'full')),
  -- Respuestas crudas del cuestionario (nunca un Nivel ya calculado por el cliente) — auditable,
  -- reproducible, coherente con "el navegador nunca es autoridad" (03_Revision_ChatGPT.md §2/§6).
  input_context jsonb not null default '{}'::jsonb,
  -- mu/confidence/reasonCodes/categoría y demás campos de origin() que devuelve
  -- confirmInitialLevelV1_1 — snapshot completo de cómo se llegó al número persistido.
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.level_events is
  'Eventos append-only de Nivel BRAMU. Escritura EXCLUSIVA de officialize_level_onboarding
   (SECURITY DEFINER, solo service_role). El índice único parcial de abajo impide más de un
   initial_estimate oficial por jugador incluso ante una carrera de concurrencia real.';

alter table public.level_events enable row level security;

drop policy if exists "level_events_select_own" on public.level_events;
create policy "level_events_select_own"
  on public.level_events
  for select
  to authenticated
  using (player_id in (select player_id from public.players where auth_user_id = auth.uid()));

grant select on table public.level_events to authenticated;
grant select, insert, update, delete on table public.level_events to service_role;

-- 03_Revision_ChatGPT.md §9 — "impedir más de un initial_estimate inicial oficial por jugador
-- mediante constraint/índice". Defensa en profundidad además del guard por status + `for
-- update` de la RPC de más abajo.
create unique index if not exists level_events_one_initial_estimate_per_player
  on public.level_events (player_id)
  where event_type = 'initial_estimate';

-- ------------------------------------------------------------------
-- 6) handle_email_confirmed — extendida idempotentemente para crear level_states PENDIENTE
--    (03_Revision_ChatGPT.md §3: "evaluá si lo más coherente es extender idempotentemente
--    handle_email_confirmed... elegí la variante más simple y segura")
-- ------------------------------------------------------------------

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  insert into public.players (auth_user_id, type, display_name)
  values (new.id, 'registered', null)
  on conflict (auth_user_id) do nothing
  returning player_id into v_player_id;

  if v_player_id is null then
    select player_id into v_player_id from public.players where auth_user_id = new.id;
  end if;

  insert into public.profiles (player_id)
  values (v_player_id)
  on conflict (player_id) do nothing;

  -- Bloque 3 — level_states PENDIENTE apenas existe player_id, sin importar si el usuario
  -- confirmó el email antes o después de terminar perfil mínimo + cuestionario de Nivel
  -- (03_Revision_ChatGPT.md §8: "email confirmado ≠ onboarding terminado", pero la identidad
  -- server-side mínima sí puede/debe existir desde este momento).
  insert into public.level_states (player_id, status)
  values (v_player_id, 'PENDIENTE')
  on conflict (player_id) do nothing;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('signup_completed', v_player_id, '{}'::jsonb);

  return new;
end;
$$;

comment on function public.handle_email_confirmed is
  'Idempotente: crea players+profiles (incompleto) y level_states (PENDIENTE) la primera vez
   que auth.users.email_confirmed_at pasa a no-nulo. La oficialización de Nivel (PENDIENTE ->
   CALIBRANDO) es responsabilidad exclusiva de officialize_level_onboarding, nunca de este
   trigger — confirmar el email no oficializa el Nivel por sí solo.';

-- Los triggers ya existentes (on_auth_user_confirmed_insert/on_auth_user_confirmed_update)
-- apuntan a esta misma función por nombre: no hace falta recrearlos.

-- ------------------------------------------------------------------
-- 7) officialize_level_onboarding — RPC privada, atómica e idempotente (03_Revision_ChatGPT.md §2/§9)
-- ------------------------------------------------------------------

/** Persiste el resultado de Nivel BRAMU YA CALCULADO por la Edge Function
 *  `officialize-onboarding` (motor JS compartido level.js/level-calibration.js — nunca
 *  reimplementado acá en SQL, ver 03_Revision_ChatGPT.md §2). NO se otorga a `authenticated`
 *  ni `anon`: la única vía de entrada es la Edge Function, que ya validó el JWT del usuario y
 *  ya corrió el motor real antes de pedir esta persistencia — así el cliente nunca puede
 *  inyectar directamente un mu/confidence arbitrario.
 *
 *  Idempotente: si `level_states.status` para este jugador ya NO es PENDIENTE (oficialización
 *  previa exitosa), devuelve el estado oficial existente TAL CUAL — nunca recalcula, nunca
 *  duplica `level_events`, nunca sobrescribe con un payload distinto de un reintento
 *  posterior. `for update` + el índice único parcial de level_events cubren además una
 *  carrera de concurrencia real (dos llamadas simultáneas para el mismo player_id). */
create or replace function public.officialize_level_onboarding(
  p_auth_user_id uuid,
  p_algorithm_version text,
  p_questionnaire_version text,
  p_questionnaire_mode text,
  p_mu numeric,
  p_confidence numeric,
  p_declared_category text,
  p_category_context_key text,
  p_input_context jsonb,
  p_result jsonb
)
returns public.level_states
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_existing public.level_states;
  v_updated public.level_states;
begin
  select player_id into v_player_id from public.players where auth_user_id = p_auth_user_id;
  if v_player_id is null then
    raise exception 'no_player_for_user' using errcode = 'P0001';
  end if;

  select * into v_existing from public.level_states where player_id = v_player_id for update;
  if v_existing is null then
    raise exception 'no_level_state_for_player' using errcode = 'P0001';
  end if;

  if v_existing.status <> 'PENDIENTE' then
    return v_existing;
  end if;

  update public.level_states set
    status = 'CALIBRANDO',
    mu = p_mu,
    confidence = p_confidence,
    declared_category = p_declared_category,
    category_context_key = p_category_context_key,
    algorithm_version = p_algorithm_version,
    questionnaire_version = p_questionnaire_version,
    questionnaire_mode = p_questionnaire_mode,
    updated_at = now()
  where player_id = v_player_id and status = 'PENDIENTE'
  returning * into v_updated;

  if v_updated is null then
    select * into v_updated from public.level_states where player_id = v_player_id;
    return v_updated;
  end if;

  insert into public.level_events (
    player_id, event_type, algorithm_version, questionnaire_version, questionnaire_mode,
    input_context, result
  ) values (
    v_player_id, 'initial_estimate', p_algorithm_version, p_questionnaire_version, p_questionnaire_mode,
    coalesce(p_input_context, '{}'::jsonb), coalesce(p_result, '{}'::jsonb)
  )
  on conflict do nothing;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('level_confirmed', v_player_id, jsonb_build_object('mode', p_questionnaire_mode));

  return v_updated;
end;
$$;

comment on function public.officialize_level_onboarding is
  'Única vía de escritura de level_states/level_events. SOLO service_role — la llama
   exclusivamente la Edge Function officialize-onboarding (supabase/functions/officialize-
   onboarding). Nunca otorgar execute a authenticated/anon: eso permitiría inyectar un mu/
   confidence arbitrario sin pasar por el motor real. Ver 03_Revision_ChatGPT.md §2/§9.';

revoke all on function public.officialize_level_onboarding(
  uuid, text, text, text, numeric, numeric, text, text, jsonb, jsonb
) from public;
grant execute on function public.officialize_level_onboarding(
  uuid, text, text, text, numeric, numeric, text, text, jsonb, jsonb
) to service_role;
