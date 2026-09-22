-- BRAMUlab — Bloque 7 (Fase 1): datos de perfil para Ranking (ubicación/cooldown/auditoría,
-- integridad mínima y la RPC "Completar datos para Ranking").
--
-- Ver docs/BRAMUlab/Implementacion/Backend/Bloque_07/{02_Analisis_Claude.md,
-- 03_Revision_Central_Analisis.md C-04/C-05/C-06, 04_Resultado_Fase_1_Claude.md}. Resumen:
--
--   1) `profiles.location_effective_from` — estado actual del cooldown de 30 días
--      (Backend_Infraestructura.md §5.3 / Ranking_BRAMU.md §8.5).
--   2) `location_change_events` — historial append-only de cambios de ubicación (alta inicial
--      vs. cambio posterior, before/after, timestamp de servidor) — C-05: un timestamp único no
--      alcanza para "queda auditado".
--   3) `players.ranking_excluded` — exclusión de integridad mínima, server-only, default
--      elegible, sin UX/admin nueva (C-06).
--   4) `complete_ranking_profile_data` — vía server-side ESPECÍFICA para completar/actualizar
--      exclusivamente localidad deportiva + competitive_branch + ranking_opt_in (C-04). Nunca
--      reutiliza `complete_profile` ni obliga a reenviar/pisar nombre, apellido, username o
--      términos — es una función nueva e independiente, sin tocar una línea de
--      `complete_profile` (Bloque 2/3, ya cerrado y validado en Staging).
--
-- Fuera de esta migración: ninguna pantalla de frontend, ninguna RPC de lectura de Ranking,
-- ningún cálculo de edición. Esta RPC solo ESCRIBE datos de perfil — Fase 3 decide cómo el
-- cliente la invoca desde la pantalla "Completá tus datos para el Ranking" (Ranking_BRAMU.md
-- §13.7), sin cambiar ese contrato de UX.

-- ------------------------------------------------------------------
-- 1) profiles.location_effective_from — estado actual del cooldown
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists location_effective_from timestamptz;

comment on column public.profiles.location_effective_from is
  'Instante de SERVIDOR desde el que la ubicación actual (location_id) es efectiva —
   Backend_Infraestructura.md §5.3 / Ranking_BRAMU.md §8.5: el cooldown de 30 días para un
   próximo cambio se mide desde acá. Escritura EXCLUSIVA de complete_ranking_profile_data (más
   abajo). NULL = todavía sin ningún cambio de ubicación auditado por esta vía.';

-- Backfill exacto, no inventado: hasta esta migración, `complete_profile` es el ÚNICO escritor
-- de `profiles` después de la fila vacía que crea `handle_email_confirmed` (Bloques 1-6, sin
-- ninguna función de "cambiar ubicación" todavía) — así que para toda cuenta que YA tiene
-- location_id, `updated_at` es exactamente el instante de la única vez que se fijó esa
-- ubicación (su alta inicial), nunca una fecha aproximada. Las cuentas sin location_id quedan
-- en NULL (correcto: nunca tuvieron una ubicación efectiva).
update public.profiles
  set location_effective_from = updated_at
  where location_id is not null
    and location_effective_from is null;

-- ------------------------------------------------------------------
-- 2) location_change_events — historial append-only (C-05)
-- ------------------------------------------------------------------

create table public.location_change_events (
  event_id             uuid primary key default gen_random_uuid(),
  player_id            uuid not null references public.players (player_id),
  -- 'initial': primera ubicación jamás fijada para este jugador (previous_location_id NULL).
  -- 'update': cambio real de una ubicación previa a otra distinta — el único caso al que aplica
  -- el cooldown de 30 días.
  change_type          text not null check (change_type in ('initial', 'update')),
  previous_location_id uuid references public.locations (location_id),
  new_location_id      uuid not null references public.locations (location_id),
  -- Timestamp de SERVIDOR únicamente (complete_ranking_profile_data usa `now()`, nunca un valor
  -- recibido del cliente) — mismo criterio que terms_accepted_at en Bloque 3.
  effective_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  constraint location_change_events_initial_has_no_previous check (
    (change_type = 'initial' and previous_location_id is null)
    or (change_type = 'update' and previous_location_id is not null)
  ),
  constraint location_change_events_update_actually_changes check (
    change_type = 'initial' or previous_location_id is distinct from new_location_id
  )
);

comment on table public.location_change_events is
  'Historial append-only de cambios de ubicación deportiva (Bloque 7, Fase 1 — C-05: un solo
   timestamp en profiles no "queda auditado" por sí mismo). Escritura EXCLUSIVA de
   complete_ranking_profile_data. Nunca se borra ni se actualiza una fila existente.';

create index location_change_events_player_idx
  on public.location_change_events (player_id, effective_at desc);

alter table public.location_change_events enable row level security;
-- Deny-by-default, mismo criterio que match_submissions/match_level_results: uso interno
-- exclusivo de complete_ranking_profile_data (SECURITY DEFINER). Sin necesidad de lectura desde
-- el cliente en ningún bloque previsto — si alguna vez hace falta mostrar "historial de
-- ubicación" en Perfil, se agrega una RPC de lectura dedicada, nunca un SELECT directo.

grant select, insert, update, delete on table public.location_change_events to service_role;

-- ------------------------------------------------------------------
-- 3) players.ranking_excluded — exclusión de integridad mínima (C-06)
-- ------------------------------------------------------------------

alter table public.players
  add column if not exists ranking_excluded boolean not null default false;

comment on column public.players.ranking_excluded is
  'Exclusión de Ranking por integridad de cuenta, server-only (03_Revision_Central_Analisis.md
   C-06 — "estado server-only mínimo, con default elegible y sin UX/admin avanzada nueva").
   Ningún RPC de esta migración la escribe: hoy es alcanzable únicamente a mano con
   service_role/SQL editor, igual que la fila única de app_config (Bloque 1). `players.is_active`
   sigue resolviendo cuenta activa/inactiva por separado — esta columna es exclusivamente el
   motivo "integridad", nunca se confunde con is_active.';

-- Sin GRANT de UPDATE para authenticated/anon sobre esta columna: profiles/players ya no
-- admiten UPDATE directo del cliente desde Bloque 1 (toda escritura pasa por RPCs
-- SECURITY DEFINER), y ninguna RPC nueva de esta migración toca esta columna.

-- ------------------------------------------------------------------
-- 4) complete_ranking_profile_data — vía server-side específica (C-04)
-- ------------------------------------------------------------------

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

  select * into v_profile from public.profiles where player_id = v_player_id;
  if v_profile is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;
  -- Mismo guard que get_public_profile/search_players: sin @usuario todavía no hay perfil
  -- mínimo completo (Bloque 2/3) — nunca se le da a Ranking una identidad que el resto de la
  -- app tampoco reconoce como completa.
  if v_profile.username is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  if p_ranking_opt_in is null then
    raise exception 'ranking_opt_in_required' using errcode = 'P0001';
  end if;

  -- competitive_branch obligatorio ACÁ (a diferencia de complete_profile, donde sigue siendo
  -- opcional desde Bloque 3) — Ranking_BRAMU.md §6/§17: es condición de elegibilidad, y esta
  -- RPC es específicamente "completar datos para Ranking".
  if p_competitive_branch is null or p_competitive_branch not in ('F', 'M') then
    raise exception 'competitive_branch_invalid' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_location_province_label), '') = '' or coalesce(trim(p_location_locality_label), '') = '' then
    raise exception 'location_required' using errcode = 'P0001';
  end if;

  -- Find-or-create de `locations`, idéntico al de complete_profile (Bloque 2/3) — se copia acá
  -- en vez de refactorizar la función existente, para no tocar una pieza ya cerrada y validada
  -- en Staging. El invariante real (verified_for_ranking coherente con source) lo sigue
  -- garantizando el CHECK de la tabla `locations`, no esta función.
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

  -- Cooldown de 30 días (C-05): aplica EXCLUSIVAMENTE a un cambio real (location_id nuevo
  -- distinto del actual) — nunca a la alta inicial (todavía no había ubicación) ni a un
  -- reenvío idempotente de la misma ubicación ya vigente.
  if v_previous_location_id is null then
    v_change_type := 'initial';
  elsif v_location_id <> v_previous_location_id then
    if v_profile.location_effective_from is not null
       and now() < v_profile.location_effective_from + interval '30 days' then
      raise exception 'location_change_cooldown' using errcode = 'P0001';
    end if;
    v_change_type := 'update';
  else
    -- Misma ubicación que ya tenía: no es alta ni cambio, no hay nada que auditar ni cooldownear.
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
   (03_Revision_Central_Analisis.md C-04) — implementa el gate de Ranking_BRAMU.md §13.7 sin
   reutilizar complete_profile ni arriesgar pisar nombre/apellido/username/términos. Mismo
   criterio de sobreescritura total (sin COALESCE parcial) que complete_profile ya estableció
   para sus propios campos (03_Revision_ChatGPT.md de Bloque 3 §4) — cada llamada debe reenviar
   los 3 datos completos. Aplica cooldown de 30 días únicamente ante un cambio real de
   ubicación y registra todo alta/cambio en location_change_events.';

grant execute on function public.complete_ranking_profile_data(
  text, boolean, text, text, text, text, text
) to authenticated;
