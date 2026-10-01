-- BRAMUlab — V04.19 (Pre-Production, ronda L1 / Issue #10): aceptación legal real + alta abandonada.
--
-- Fuente maestra: docs/BRAMUlab/Privacidad_Legal.md §4 (alta abandonada 24 h) y §7 (consentimiento
-- versionado). Contrato técnico consolidado en Issue #4 / #10. NO implementa restricción 13+ ni flujo
-- parental (Privacidad_Legal.md §6: decisión de producto cerrada).
--
-- Qué agrega
--   1) public.legal_versions     — catálogo de versiones legales conocidas (inmutables una vez publicadas).
--   2) app_config.legal_version  — versión VIGENTE server-side (cambiarla = cambio material => reaceptación).
--   3) public.legal_acceptances  — evidencia de aceptación APPEND-ONLY (UNIQUE player+versión; sin UPDATE/DELETE).
--   4) record_legal_acceptance   — helper interno idempotente (nunca pisa el accepted_at original).
--   5) handle_email_confirmed    — FUSIONADO: registra la aceptación declarada en el signUp (metadata
--                                  `legal_version`) con accepted_at = auth.users.created_at (reloj del servidor).
--   6) complete_profile          — REEMPLAZADO internamente: exige aceptación previa y ya no pisa terms_accepted_at
--                                  con now() en cada retry (snapshot derivado de legal_acceptances).
--   7) get_my_legal_status / accept_legal_version — base de reaceptación ante cambios materiales.
--   8) list_abandoned_signups / release_abandoned_signup_username — soporte SQL de la Edge Function
--      `cleanup-abandoned-signups` (el borrado del usuario Auth lo hace SIEMPRE la Auth Admin API, nunca SQL).
--
-- Decisiones de diseño
--   * La aceptación ocurre ANTES de crear el usuario Auth (el front bloquea Auth.signUp sin checkbox). Como
--     todavía no existe player_id, el signUp transporta la versión como metadata; el servidor registra la
--     evidencia recién al confirmar el email, con `auth.users.created_at` como instante (server-side, no el
--     reloj del dispositivo). La metadata es una DECLARACIÓN del cliente: no autoriza nada por sí sola.
--   * handle_email_confirmed NO levanta excepción si falta/es inválida la versión (haría fallar verifyOtp y
--     las altas por Admin API): la constitución real de la cuenta es complete_profile, que exige aceptación.
--     Sin aceptación => complete_profile falla con `legal_acceptance_required`, get_my_legal_status marca
--     requiresAcceptance y el cliente bloquea hasta aceptar explícitamente. Nunca se fabrica una aceptación.
--   * Cuentas históricas de Staging sin fila: NO se retro-inventan aceptaciones; pasan por reaceptación.
--   * profiles.terms_version/terms_accepted_at quedan como SNAPSHOT derivado (compatibilidad); nunca deciden
--     la reaceptación (la decide legal_acceptances vs app_config.legal_version).
--   * Un @usuario solo se persiste en complete_profile, que exige sesión confirmada: un alta que nunca
--     confirmó el email NO reserva @usuario server-side. release_abandoned_signup_username es defensa en
--     profundidad (libera igual si apareciera un username atado a un alta abandonada no confirmada).
--
-- NO aplicada desde el sandbox del agente (sin Supabase CLI ni credenciales) — la aplica y verifica Central
-- en Staging con supabase/tests/verify-preprod-l1-legal-cleanup.sql (BEGIN/ROLLBACK).

-- ------------------------------------------------------------------
-- 1) legal_versions + app_config.legal_version
-- ------------------------------------------------------------------

create table if not exists public.legal_versions (
  legal_version text primary key check (legal_version ~ '^[a-z0-9_.-]{1,40}$'),
  effective_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.legal_versions is
  'Catálogo de versiones legales (Términos + Privacidad) conocidas. El contenido vive versionado en el repo; acá solo
   el identificador y la fecha de vigencia (NULL hasta que exista fecha real de publicación). Una versión publicada en
   Production es inmutable: un cambio material crea una versión nueva.';

alter table public.legal_versions enable row level security;
drop policy if exists "legal_versions_public_read" on public.legal_versions;
create policy "legal_versions_public_read" on public.legal_versions for select to anon, authenticated using (true);

grant select on table public.legal_versions to anon, authenticated;
grant select, insert, update on table public.legal_versions to service_role;

insert into public.legal_versions (legal_version) values ('legal_v1') on conflict (legal_version) do nothing;

-- app_config ya es lectura pública (anon/authenticated) a nivel tabla: la columna nueva queda legible sin GRANT extra.
alter table public.app_config
  add column if not exists legal_version text not null default 'legal_v1' references public.legal_versions (legal_version);

comment on column public.app_config.legal_version is
  'Versión legal VIGENTE de este entorno. Cambiarla = cambio material: toda cuenta cuya última aceptación sea distinta
   pasa por reaceptación (get_my_legal_status.requiresAcceptance). Una errata editorial NO cambia este valor.';

-- ------------------------------------------------------------------
-- 2) legal_acceptances — append-only
-- ------------------------------------------------------------------

create table if not exists public.legal_acceptances (
  acceptance_id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (player_id),
  legal_version text not null references public.legal_versions (legal_version),
  accepted_at timestamptz not null default now(),
  source text not null check (source in ('signup', 'reaccept')),
  created_at timestamptz not null default now(),
  constraint legal_acceptances_player_version_key unique (player_id, legal_version)
);

comment on table public.legal_acceptances is
  'Evidencia de aceptación legal. APPEND-ONLY: sin UPDATE ni DELETE (trigger + sin GRANT). La primera aceptación de una
   versión conserva su accepted_at original para siempre; una reaceptación es una FILA NUEVA de otra versión. No guarda
   IP/User-Agent/texto de los documentos (minimización). Sin acceso directo del cliente: escribe solo el servidor.';

create or replace function public.legal_acceptances_reject_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'legal_acceptances_append_only' using errcode = 'P0001';
end;
$$;

drop trigger if exists legal_acceptances_append_only on public.legal_acceptances;
create trigger legal_acceptances_append_only
  before update or delete on public.legal_acceptances
  for each row execute function public.legal_acceptances_reject_mutation();

-- Índice de soporte para la FK legal_version (Advisor). Incluido acá —y no solo en 20260930232000— para que un REPLAY
-- LIMPIO (orden por versión) lo cree: 20260930232000 ordena ANTES que esta migración.
create index if not exists legal_acceptances_legal_version_idx on public.legal_acceptances (legal_version);

alter table public.legal_acceptances enable row level security;
-- Deny-by-default: RLS sin políticas. La lectura propia pasa por get_my_legal_status (SECURITY DEFINER).
revoke all on table public.legal_acceptances from anon, authenticated;
revoke update, delete on table public.legal_acceptances from service_role;
grant select, insert on table public.legal_acceptances to service_role;

-- ------------------------------------------------------------------
-- 3) record_legal_acceptance — helper interno idempotente
-- ------------------------------------------------------------------

create or replace function public.record_legal_acceptance(
  p_player_id uuid,
  p_legal_version text,
  p_source text,
  p_accepted_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_row public.legal_acceptances;
begin
  insert into public.legal_acceptances (player_id, legal_version, accepted_at, source)
  values (p_player_id, p_legal_version, coalesce(p_accepted_at, now()), p_source)
  on conflict (player_id, legal_version) do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_row from public.legal_acceptances
   where player_id = p_player_id and legal_version = p_legal_version;

  return jsonb_build_object('inserted', v_inserted > 0, 'acceptedAt', v_row.accepted_at, 'legalVersion', v_row.legal_version);
end;
$$;

comment on function public.record_legal_acceptance is
  'Helper interno. INSERT ... ON CONFLICT DO NOTHING: un retry/carrera nunca mueve el accepted_at original. Sin EXECUTE
   para anon/authenticated: solo lo llaman handle_email_confirmed y accept_legal_version (SECURITY DEFINER).';

revoke all on function public.record_legal_acceptance(uuid, text, text, timestamptz) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- 4) handle_email_confirmed — FUSIONADO (mismo cuerpo de Bloque 3 + registro de aceptación)
-- ------------------------------------------------------------------

create or replace function public.handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_legal_version text;
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

  insert into public.level_states (player_id, status)
  values (v_player_id, 'PENDIENTE')
  on conflict (player_id) do nothing;

  -- L1 — aceptación legal declarada en el signUp (metadata `legal_version`). Solo versiones CONOCIDAS del
  -- catálogo; accepted_at = momento en que el servidor creó el usuario Auth (inmediatamente posterior a la
  -- aceptación en pantalla, que bloquea signUp sin checkbox). Idempotente. Falta/versión desconocida => no se
  -- registra nada (nunca se fabrica): complete_profile y el gate de reaceptación lo resuelven.
  v_legal_version := nullif(trim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'legal_version'), '');
  if v_legal_version is not null
     and exists (select 1 from public.legal_versions where legal_version = v_legal_version) then
    perform public.record_legal_acceptance(v_player_id, v_legal_version, 'signup', new.created_at);
  end if;

  insert into public.pilot_events (event_name, player_id, properties)
  values ('signup_completed', v_player_id, '{}'::jsonb);

  return new;
end;
$$;

comment on function public.handle_email_confirmed is
  'Idempotente: crea players+profiles (incompleto) y level_states (PENDIENTE) la primera vez que
   auth.users.email_confirmed_at pasa a no-nulo, y (L1) registra la aceptación legal declarada en el signUp con
   accepted_at = auth.users.created_at. No oficializa Nivel ni levanta excepción por falta de aceptación: la
   exigencia está en complete_profile.';

-- ------------------------------------------------------------------
-- 5) complete_profile — REEMPLAZADO internamente (firma idéntica a Bloque 7 F1)
-- ------------------------------------------------------------------

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
  v_terms_version        text;
  v_terms_at             timestamptz;
  v_result               public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- L1: sin aceptación legal registrada no se constituye el perfil. El snapshot de términos sale SIEMPRE de
  -- legal_acceptances (última aceptación, accepted_at original): un retry ya no mueve la fecha. `p_terms_version`
  -- queda en la firma por compatibilidad pero ya no decide ni escribe nada (el cliente no es autoridad).
  select la.legal_version, la.accepted_at into v_terms_version, v_terms_at
    from public.legal_acceptances la
   where la.player_id = v_player_id
   order by la.accepted_at desc, la.created_at desc
   limit 1;
  if v_terms_version is null then
    raise exception 'legal_acceptance_required' using errcode = 'P0001';
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

  -- Bloque 7, F1-C03: `p_competitive_branch`/`p_location_*` quedan deliberadamente sin usar (ver
  -- complete_ranking_profile_data, única vía real para localidad deportiva y rama competitiva).

  update public.profiles set
    username = v_username,
    first_name = p_first_name,
    last_name = p_last_name,
    display_name = p_display_name,
    birth_date = p_birth_date,
    gender = p_gender,
    dominant_hand = p_dominant_hand,
    preferred_side = p_preferred_side,
    terms_version = v_terms_version,
    terms_accepted_at = v_terms_at,
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
  'Única vía de escritura de perfil MÍNIMO (username/nombre/apellido/display_name/fecha de nacimiento/género/mano/
   lado). L1 (V04.19): exige una aceptación legal previa en legal_acceptances (`legal_acceptance_required`) y deriva
   el snapshot terms_version/terms_accepted_at de esa fila (accepted_at original; un retry no lo mueve).
   p_competitive_branch/p_location_*/p_terms_version quedan en la firma por compatibilidad y no escriben nada.
   username sigue fijo tras el primer set y único.';

-- ------------------------------------------------------------------
-- 6) get_my_legal_status / accept_legal_version — base de reaceptación
-- ------------------------------------------------------------------

create or replace function public.get_my_legal_status()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_player_id uuid;
  v_current text;
  v_latest text;
  v_accepted_current boolean;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  select legal_version into v_current from public.app_config where id = 1;
  if v_current is null then
    raise exception 'legal_version_unavailable' using errcode = 'P0001';
  end if;

  select la.legal_version into v_latest
    from public.legal_acceptances la
   where la.player_id = v_player_id
   order by la.accepted_at desc, la.created_at desc
   limit 1;

  v_accepted_current := exists (
    select 1 from public.legal_acceptances la where la.player_id = v_player_id and la.legal_version = v_current
  );

  return jsonb_build_object(
    'currentVersion', v_current,
    'acceptedCurrent', v_accepted_current,
    'latestAcceptedVersion', v_latest,
    'requiresAcceptance', not v_accepted_current
  );
end;
$$;

comment on function public.get_my_legal_status is
  'Estado legal del jugador autenticado: versión vigente (app_config), si aceptó ESA versión y la última aceptada.
   Nunca devuelve historial completo. Sin aceptación de la versión vigente => requiresAcceptance=true.';

create or replace function public.accept_legal_version(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_current text;
  v_rec jsonb;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_player_id, 'accept_legal_version', 20, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select legal_version into v_current from public.app_config where id = 1;
  if v_current is null then
    raise exception 'legal_version_unavailable' using errcode = 'P0001';
  end if;
  -- Solo la versión VIGENTE: nunca una arbitraria, futura ni antigua.
  if p_version is distinct from v_current then
    raise exception 'legal_version_not_current' using errcode = 'P0001';
  end if;

  v_rec := public.record_legal_acceptance(v_player_id, v_current, 'reaccept', now());

  -- Snapshot de compatibilidad con el accepted_at ORIGINAL de la fila (nunca now() si ya existía).
  update public.profiles
     set terms_version = v_current,
         terms_accepted_at = (v_rec ->> 'acceptedAt')::timestamptz
   where player_id = v_player_id;

  return jsonb_build_object(
    'ok', true,
    'legalVersion', v_current,
    'acceptedAt', v_rec ->> 'acceptedAt',
    'alreadyAccepted', not (v_rec ->> 'inserted')::boolean
  );
end;
$$;

comment on function public.accept_legal_version is
  'Registra (append-only, idempotente) la aceptación de la versión legal VIGENTE por el jugador autenticado. Rechaza
   cualquier otra versión (`legal_version_not_current`). Rate limit 20/60s. Devuelve el accepted_at ORIGINAL.';

revoke all on function public.get_my_legal_status() from public, anon;
revoke all on function public.accept_legal_version(text) from public, anon;
grant execute on function public.get_my_legal_status() to authenticated;
grant execute on function public.accept_legal_version(text) to authenticated;

-- ------------------------------------------------------------------
-- 7) Alta abandonada > 24 h — soporte SQL de la Edge Function `cleanup-abandoned-signups`
-- ------------------------------------------------------------------

/** Candidatos: usuarios Auth que NUNCA confirmaron email (ni teléfono), nunca iniciaron sesión y nacieron hace
 *  >= p_min_age. Una cuenta con email confirmado (constituida o incompleta) JAMÁS es candidata: la inactividad
 *  nunca elimina una cuenta constituida (Privacidad_Legal.md §4). `p_min_age` no puede bajar de 24 h. */
create or replace function public.list_abandoned_signups(
  p_min_age interval default interval '24 hours',
  p_limit integer default 200
)
returns table (user_id uuid, created_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if p_min_age is null or p_min_age < interval '24 hours' then
    raise exception 'min_age_below_policy' using errcode = 'P0001';
  end if;
  return query
    select u.id, u.created_at
      from auth.users u
     where u.email_confirmed_at is null
       and u.phone_confirmed_at is null
       and u.last_sign_in_at is null
       and u.created_at <= now() - p_min_age
     order by u.created_at, u.id
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

/** Libera el @usuario atado a un alta abandonada (defensa en profundidad: hoy ningún flujo lo persiste antes de
 *  confirmar el email). REVALIDA la elegibilidad bajo FOR UPDATE del usuario Auth inmediatamente antes: si entre
 *  el listado y este paso el usuario confirmó el email (o ya no existe / es más joven), no toca nada.
 *  Idempotente. Devuelve {eligible, reason, usernameReleased}. */
create or replace function public.release_abandoned_signup_username(
  p_user_id uuid,
  p_min_age interval default interval '24 hours'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users;
  v_released integer := 0;
begin
  if p_min_age is null or p_min_age < interval '24 hours' then
    raise exception 'min_age_below_policy' using errcode = 'P0001';
  end if;

  select * into v_user from auth.users where id = p_user_id for update;
  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'not_found', 'usernameReleased', false);
  end if;
  if v_user.email_confirmed_at is not null or v_user.phone_confirmed_at is not null
     or v_user.last_sign_in_at is not null or v_user.created_at > now() - p_min_age then
    return jsonb_build_object('eligible', false, 'reason', 'not_abandoned', 'usernameReleased', false);
  end if;

  update public.profiles pr
     set username = null, updated_at = now()
   where pr.username is not null
     and pr.player_id in (select pl.player_id from public.players pl where pl.auth_user_id = p_user_id);
  get diagnostics v_released = row_count;

  return jsonb_build_object('eligible', true, 'reason', null, 'usernameReleased', v_released > 0);
end;
$$;

comment on function public.list_abandoned_signups is
  'Solo service_role. Usuarios Auth sin email/teléfono confirmado, sin sesión, con >= 24 h. Nunca incluye cuentas confirmadas.';
comment on function public.release_abandoned_signup_username is
  'Solo service_role. Revalida (FOR UPDATE) que el alta siga abandonada y libera el @usuario atado a ella. Idempotente.';

revoke all on function public.list_abandoned_signups(interval, integer) from public, anon, authenticated;
revoke all on function public.release_abandoned_signup_username(uuid, interval) from public, anon, authenticated;
grant execute on function public.list_abandoned_signups(interval, integer) to service_role;
grant execute on function public.release_abandoned_signup_username(uuid, interval) to service_role;
