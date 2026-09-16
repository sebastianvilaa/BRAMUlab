-- BRAMUlab — Bloque 2: Auth, perfil, username, ubicación y recuperación.
--
-- Depende de Bloque 1 (20260916120000_.../20260916150000_...): ya existe
-- public.app_config y public.players (esqueleto, RLS habilitada, cero
-- políticas). Esta migración:
--
--   1) agrega las columnas de identidad de jugador que Bloque 1 dejó
--      pendientes en `players` y agrega la política de lectura del propio
--      registro (todavía sin insert/update/delete para el cliente: la fila
--      la crea únicamente el trigger de abajo);
--   2) crea `public.locations` — ubicación canónica (GeoRef) o manual, con
--      el invariante "manual nunca es elegible para Ranking" impuesto por
--      un CHECK, no por confianza en el cliente;
--   3) crea `public.reserved_usernames` (lista de @usuario prohibidos);
--   4) crea `public.profiles` — perfil deportivo, con RLS de solo-lectura
--      del propio registro: toda escritura pasa por las funciones
--      SECURITY DEFINER de más abajo (`complete_profile`), nunca por
--      update directo del cliente (Backend_Infraestructura.md §10.3);
--   5) crea `public.pilot_events` (métricas mínimas del piloto, solo
--      Bloque 2 emite `signup_completed`);
--   6) crea el trigger idempotente sobre `auth.users` que arma
--      player+profile (incompleto) apenas el email queda verificado
--      (Backend_Infraestructura.md §8.1.3) — cubre tanto el alta normal
--      (insert con email_confirmed_at nulo, luego update al confirmar)
--      como un alta ya confirmada en el mismo insert (por ejemplo, un
--      usuario de prueba creado con el Admin API para verificación);
--   7) expone `is_username_available` y `complete_profile` como RPC
--      SECURITY DEFINER, únicas vías de escritura de perfil — validan
--      formato/reservados/unicidad de username, la rama competitiva y el
--      invariante de ubicación en el propio servidor, nunca confiando en
--      lo que mande el cliente.
--
-- Deliberadamente FUERA de esta migración (no le corresponde a Bloque 2):
--   - Nivel BRAMU productivo (`level_states`/`level_events`): Bloque 3.
--   - búsqueda de jugadores / lectura de perfiles ajenos: Bloque 4 — acá
--     cada usuario autenticado solo puede leer su propio player/profile.
--   - avatar real (Supabase Storage): no está en el alcance de Bloque 2;
--     `profiles.avatar_url` queda nullable, sin ninguna vía para setearlo
--     todavía.
--   - `ranking_opt_in`: no hay checkbox de consentimiento en el alta
--     todavía (no documentado como pantalla existente); la columna existe
--     y por defecto es `false` (nunca opt-in implícito) hasta que Ranking
--     agregue esa UI explícita.

-- ------------------------------------------------------------------
-- 1) players — columnas que Bloque 1 dejó pendientes + lectura propia
-- ------------------------------------------------------------------

alter table public.players
  add column if not exists created_by_player_id uuid references public.players (player_id);

comment on column public.players.created_by_player_id is
  'Quién creó esta identidad (siempre NULL para cuentas registradas via trigger; reservado para invitados/provisionales de Bloque 4).';

drop policy if exists "players_select_own" on public.players;
create policy "players_select_own"
  on public.players
  for select
  to authenticated
  using (auth_user_id = auth.uid());

-- Sin políticas de insert/update/delete: la única fila de `players` de una
-- cuenta la crea el trigger `on_auth_user_confirmed_*` de más abajo
-- (SECURITY DEFINER, corre como dueño de la tabla y no necesita policy).

grant select on table public.players to authenticated;

-- ------------------------------------------------------------------
-- 2) locations — ubicación canónica (GeoRef) o manual
-- ------------------------------------------------------------------

create table public.locations (
  location_id uuid primary key default gen_random_uuid(),
  country_code text not null default 'AR',
  source text not null check (source in ('georef', 'manual')),
  -- IDs canónicos de GeoRef (apis.datos.gob.ar/georef). NULL cuando
  -- source='manual' o cuando GeoRef no devolvió id (fallback local sin
  -- conexión) — en cualquiera de esos casos la fila queda no verificada,
  -- ver el CHECK de verified_for_ranking más abajo.
  georef_province_id text,
  georef_locality_id text,
  province_label text not null,
  locality_label text not null,
  display_label text not null,
  -- Invariante de Backend_Infraestructura.md §5.3: "una localidad escrita
  -- manualmente... queda verified_for_ranking=false... no habilita Ranking
  -- territorial". Esto no se confía a la aplicación: una fila 'georef' sin
  -- verified_for_ranking=true, o una 'manual' con verified_for_ranking=true,
  -- son directamente imposibles de insertar.
  verified_for_ranking boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_verified_matches_source check (
    (source = 'georef' and verified_for_ranking = true)
    or (source = 'manual' and verified_for_ranking = false)
  ),
  -- Evita duplicar la MISMA localidad de GeoRef en dos filas (permite
  -- reutilizarla entre perfiles). NULLs (todas las filas 'manual') se
  -- tratan como distintos entre sí en Postgres, así que esto nunca deduplica
  -- ubicaciones manuales — a propósito, cada una es su propio texto libre.
  constraint locations_georef_unique unique (source, georef_province_id, georef_locality_id)
);

comment on table public.locations is
  'Ubicación canónica (GeoRef, Argentina) o manual no verificada. verified_for_ranking nunca se decide del lado del cliente, ver locations_verified_matches_source.';

alter table public.locations enable row level security;

drop policy if exists "locations_select_authenticated" on public.locations;
create policy "locations_select_authenticated"
  on public.locations
  for select
  to authenticated
  using (is_active);

-- Sin insert/update/delete para el cliente: la única vía de alta es
-- `complete_profile` (SECURITY DEFINER) más abajo, que hace el
-- find-or-create de forma atómica y recalcula verified_for_ranking desde
-- `source`, ignorando cualquier valor que el cliente intente mandar.

grant select on table public.locations to authenticated;

-- ------------------------------------------------------------------
-- 3) reserved_usernames — lista de @usuario prohibidos (Backend_Infraestructura.md §5.2)
-- ------------------------------------------------------------------

create table public.reserved_usernames (
  username text primary key
);

comment on table public.reserved_usernames is
  'Lista de @usuario reservados. Sin RLS legible desde el cliente a propósito: solo la consultan is_username_available/complete_profile (SECURITY DEFINER).';

alter table public.reserved_usernames enable row level security;
-- Deny-by-default deliberado: cero políticas. Ni anon ni authenticated
-- pueden leer esta tabla directo — solo las funciones de abajo, que corren
-- como dueño de la tabla.

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('root'), ('superuser'), ('support'),
  ('help'), ('api'), ('bramu'), ('bramulab'), ('moderator'), ('mod'),
  ('staff'), ('system'), ('null'), ('undefined'), ('test'), ('official'),
  ('security'), ('info'), ('contact'), ('webmaster'), ('postmaster'),
  ('sales'), ('billing'), ('ranking'), ('nivel'), ('nosotros'), ('about'),
  ('legal'), ('privacy'), ('terminos'), ('soporte'), ('ayuda')
on conflict (username) do nothing;

-- ------------------------------------------------------------------
-- 4) profiles — perfil deportivo (Backend_Infraestructura.md §6.1)
-- ------------------------------------------------------------------

create table public.profiles (
  player_id uuid primary key references public.players (player_id) on delete cascade,
  -- Username: obligatorio-una-vez-completado, único, canónico en minúscula.
  -- NULL mientras el perfil sigue incompleto (recién verificado, todavía no
  -- pasó por complete_profile) — "ausencia de perfil completo" nunca se
  -- confunde con "perfil completo pero sin username", que Backend_
  -- Infraestructura.md no contempla como estado válido.
  username text unique check (username ~ '^[a-z0-9._]{3,24}$'),
  first_name text,
  last_name text,
  display_name text,
  avatar_url text,
  birth_date date,
  -- Privado (Backend_Infraestructura.md §5.1): nunca expuesto por una vista
  -- pública futura de Bloque 4 sin decisión explícita aparte.
  gender text check (gender is null or gender in ('femenino', 'masculino', 'otro', 'prefiero-no-decir')),
  dominant_hand text check (dominant_hand is null or dominant_hand in ('derecha', 'izquierda')),
  preferred_side text check (preferred_side is null or preferred_side in ('drive', 'reves', 'indiferente')),
  -- Separada del género personal (Backend_Infraestructura.md §5.4): nunca
  -- derivada automáticamente, obligatoria para Ranking (no impuesto acá
  -- como NOT NULL de tabla porque el perfil puede seguir incompleto; sí es
  -- obligatoria dentro de `complete_profile`, ver más abajo).
  competitive_branch text check (competitive_branch is null or competitive_branch in ('F', 'M')),
  location_id uuid references public.locations (location_id),
  ranking_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil deportivo, 1:1 con players. Sin políticas de insert/update/delete para el cliente: toda escritura pasa por complete_profile (SECURITY DEFINER) — ver Backend_Infraestructura.md §10.3.';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (player_id in (select player_id from public.players where auth_user_id = auth.uid()));

grant select on table public.profiles to authenticated;

-- ------------------------------------------------------------------
-- 5) pilot_events — métricas mínimas del piloto (Backend_Infraestructura.md §6.8)
-- ------------------------------------------------------------------

create table public.pilot_events (
  event_id uuid primary key default gen_random_uuid(),
  -- Lista completa documentada en Backend_Infraestructura.md §6.8, aunque
  -- Bloque 2 solo emite 'signup_completed' (server-side, ver el trigger de
  -- abajo). El resto queda declarado para que los bloques que los emitan
  -- (3-7) no necesiten otra migración solo para el CHECK.
  event_name text not null check (event_name in (
    'signup_started', 'signup_completed', 'level_started', 'level_confirmed',
    'match_created', 'match_validated', 'match_rejected',
    'calibration_1_5', 'calibration_3_5', 'calibration_5_5', 'daily_active'
  )),
  player_id uuid references public.players (player_id),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.pilot_events is
  'Métricas mínimas del piloto, identificador pseudónimo (player_id) + timestamp de servidor. Sin RLS legible desde el cliente: es autoridad server-side, no un dato de producto.';

alter table public.pilot_events enable row level security;
-- Deny-by-default deliberado: cero políticas para anon/authenticated. Solo
-- el trigger de abajo (SECURITY DEFINER) escribe acá. No se hace GRANT
-- para authenticated/anon a propósito (ni siquiera SELECT): es una tabla
-- de auditoría interna, no un dato de producto.

-- ------------------------------------------------------------------
-- 6) Alta idempotente de player+profile al verificar el email
--    (Backend_Infraestructura.md §8.1.3)
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
  -- En UPDATE, solo procesar la transición null -> not null (evita
  -- reprocesar en cada login, que también hace UPDATE de auth.users para
  -- last_sign_in_at). En INSERT (alta ya confirmada, p. ej. Admin API con
  -- email_confirm:true) no hay "old" con qué comparar: procesar siempre.
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

  insert into public.pilot_events (event_name, player_id, properties)
  values ('signup_completed', v_player_id, '{}'::jsonb);

  return new;
end;
$$;

comment on function public.handle_email_confirmed is
  'Idempotente: crea players+profiles (incompleto) y registra signup_completed la primera vez que auth.users.email_confirmed_at pasa a no-nulo. No implementa level_state inicial (Bloque 3, fuera de alcance de Bloque 2 a propósito).';

drop trigger if exists on_auth_user_confirmed_insert on auth.users;
create trigger on_auth_user_confirmed_insert
  after insert on auth.users
  for each row
  execute function public.handle_email_confirmed();

drop trigger if exists on_auth_user_confirmed_update on auth.users;
create trigger on_auth_user_confirmed_update
  after update of email_confirmed_at on auth.users
  for each row
  execute function public.handle_email_confirmed();

-- ------------------------------------------------------------------
-- 7) RPCs — únicas vías de escritura de perfil
-- ------------------------------------------------------------------

/** true si `p_username` está bien formado, no está reservado y no está en
 *  uso por otro player_id. Restringida a authenticated (el buscador de
 *  disponibilidad se usa en el paso "TU PERFIL", ya autenticado tras
 *  verificar el email — ver BRAMUlab_Backend_Informe.md Bloque 2). */
create or replace function public.is_username_available(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := lower(trim(p_username));
begin
  if v_username !~ '^[a-z0-9._]{3,24}$' then
    return false;
  end if;
  if exists (select 1 from public.reserved_usernames where username = v_username) then
    return false;
  end if;
  if exists (select 1 from public.profiles where username = v_username) then
    return false;
  end if;
  return true;
end;
$$;

grant execute on function public.is_username_available(text) to authenticated;

/** Única vía de escritura de perfil (Backend_Infraestructura.md §10.3).
 *  Válida para la primera carga ("TU PERFIL" tras verificar el email) y
 *  para ediciones posteriores de los mismos campos, EXCEPTO username:
 *  una vez fijado, solo puede repetirse igual (llamada idempotente) —
 *  cambiarlo produce 'username_locked' (Backend_Infraestructura.md §5.2:
 *  "durante el piloto queda fijo salvo corrección administrativa").
 *  Hace find-or-create de la ubicación en la MISMA transacción: nunca dos
 *  round-trips ni una ubicación huérfana si el resto del perfil falla.
 *  `p_location_georef_*_id` en NULL implica source='manual' y por lo tanto
 *  verified_for_ranking=false, sin importar qué mande el cliente en otro
 *  lado — ver locations_verified_matches_source. */
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
  p_location_georef_locality_id text default null
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
  if p_competitive_branch is null or p_competitive_branch not in ('F', 'M') then
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
  if coalesce(trim(p_location_province_label), '') = '' or coalesce(trim(p_location_locality_label), '') = '' then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  -- find-or-create de ubicación. source/verified_for_ranking se derivan acá
  -- (nunca de un parámetro del cliente): con los dos IDs de GeoRef, es
  -- 'georef' verificada; si falta cualquiera de los dos, es 'manual' no
  -- verificada — igual que el fallback local sin conexión o una carga
  -- manual real quedan tratados igual (ninguno trae ambos IDs canónicos).
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
    v_location_id := null; -- una ubicación manual siempre es una fila nueva, nunca se reutiliza
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
  'Única vía de escritura de perfil. username queda fijo tras el primer set (username_locked si se intenta cambiar) y único en toda la tabla (username_taken si otra cuenta ya lo tiene). Ver Backend_Infraestructura.md §5.2/§5.3/§5.4/§10.3.';

grant execute on function public.complete_profile(
  text, text, text, text, date, text, text, text, text, text, text, text, text, text
) to authenticated;
