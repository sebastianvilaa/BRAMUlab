-- Pre-Production P0.1C — Perfil editable server-backed (24/09/2026).
--
-- Handoff: docs/BRAMUlab/Implementacion/Pre_Production/09_Handoff_Perfil_Editable_ServerBacked_Claude.md
-- Problema real: `openProfileEditModal()` bloqueaba por completo el guardado para cuentas
-- `serverBacked` — varios campos (teléfono/WhatsApp, avatar) ni siquiera tenían columna en
-- `profiles` todavía (ver `bramulab/auth.js:fetchOwnProfile`, que los devolvía hardcodeados en
-- `null`/`false` con un comentario explícito de que Backend_Infraestructura.md §6.1 no los
-- definía). Esta migración agrega exactamente lo que falta, reutilizando los contratos ya
-- existentes en vez de crear un segundo sistema de Perfil:
--
--   - nombre/apellido/nombre visible/fecha de nacimiento/género/mano/lado: SIN CAMBIOS,
--     `complete_profile` (Bloque 2/3) ya los soporta y sigue siendo la única vía — no se toca.
--   - localidad/rama competitiva: SIN CAMBIOS de contrato, `complete_ranking_profile_data`
--     (Bloque 7, F1-C03) sigue siendo la ÚNICA vía server-side para esos dos campos (cooldown de
--     30 días + auditoría en `location_change_events`) — `complete_profile` los ignora a
--     propósito desde Bloque 7 y esta migración no lo revierte. El frontend de Editar Datos pasa
--     a llamar a esta RPC ya existente en vez de no ofrecer edición de rama en absoluto.
--   - teléfono/consentimiento WhatsApp: NUEVO — columnas + RPC dedicada
--     `complete_contact_profile_data`, mismo patrón que `complete_ranking_profile_data` (una
--     RPC por concern, nunca sobrecargar `complete_profile` con semántica de "reemplazo total"
--     ambigua para un campo que también se escribe en otro momento).
--   - avatar: NUEVO — `profiles.avatar_url` YA EXISTÍA desde Bloque 2 (`avatar_url text`, sin
--     vía de escritura desde entonces, ver 20260916180000_bloque2_auth_profile_username_
--     location.sql:38/164) — se agrega el bucket de Storage + una RPC mínima
--     `update_profile_avatar` que solo persiste la referencia ya subida (nunca sube el archivo
--     por SQL). La subida real ocurre client-side contra Supabase Storage, protegida por RLS
--     (carpeta = player_id propio) — la RPC es defensa en profundidad adicional, no la única
--     barrera.
--   - `get_public_profile` (Bloque 4, ya extendido en la ronda anterior con matches_played/
--     matches_won) agrega `avatar_url` y `whatsapp_phone` — este último NUNCA expone el teléfono
--     si `allow_whatsapp_contact=false` (el filtro ocurre server-side, dentro del propio SELECT,
--     nunca confiando en que el cliente decida no mostrarlo).
--   - `declared_category` (level_states): trazado, NO se toca en esta ronda. Se escribe UNA sola
--     vez, dentro de `officialize_level_onboarding` (Bloque 3/6), en la transición PENDIENTE ->
--     CALIBRANDO — ningún otro camino (incluida la oficialización de partidos,
--     `officialize_match_validation`) lo vuelve a tocar jamás. Hoy además el Edge Function
--     `officialize-onboarding` todavía envía `p_declared_category: null` hardcodeado (gap
--     preexistente de Bloque 3, fuera de alcance de este handoff) — así que en la práctica el
--     campo está siempre NULL para cualquier cuenta real hoy. Dado que el handoff ofrece
--     explícitamente la opción de dejarlo solo lectura si no hay una vía semánticamente limpia
--     ("no recalcular mu/confidence/evidence ni reescribir eventos históricos"), y que agregar
--     una vía de escritura nueva no tiene ningún efecto observable mientras ese gap de Bloque 3
--     siga abierto, esta ronda deja `declared_category` en SOLO LECTURA para cuentas
--     server-backed — DECISIÓN ABIERTA no bloqueante, ver el informe.

-- ------------------------------------------------------------------
-- 1) profiles.phone / profiles.allow_whatsapp_contact
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists phone text,
  add column if not exists allow_whatsapp_contact boolean not null default false;

comment on column public.profiles.phone is
  'Privado (Backend_Infraestructura.md §5.1) — nunca expuesto por get_public_profile salvo el
   caso puntual y filtrado de whatsapp_phone (ver más abajo). Cargarlo NO activa consentimiento
   por sí solo — allow_whatsapp_contact es un campo separado.';
comment on column public.profiles.allow_whatsapp_contact is
  'Consentimiento explícito para contacto público por WhatsApp. Default false. Activarlo exige
   un teléfono con formato válido (8-15 dígitos, validado también server-side en
   complete_contact_profile_data); desactivarlo siempre está permitido sin condición.';

-- ------------------------------------------------------------------
-- 2) complete_contact_profile_data — única vía de escritura de phone/allow_whatsapp_contact
-- ------------------------------------------------------------------

create or replace function public.complete_contact_profile_data(
  p_phone text,
  p_allow_whatsapp_contact boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id     uuid;
  v_phone_digits  text;
  v_result        public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- Defensa server-side — MISMO criterio simple que ya usa el cliente
  -- (bramulab/player-identity.js#isValidWhatsAppPhone: 8-15 dígitos, sin resolver telefonía
  -- internacional real): nunca confiar solo en la validación del formulario. Desactivar el
  -- consentimiento (`p_allow_whatsapp_contact=false`) nunca exige un teléfono válido — "revocar
  -- consentimiento siempre debe ser posible" (handoff §5).
  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if coalesce(p_allow_whatsapp_contact, false)
     and (length(v_phone_digits) < 8 or length(v_phone_digits) > 15) then
    raise exception 'whatsapp_phone_invalid' using errcode = 'P0001';
  end if;

  update public.profiles set
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    allow_whatsapp_contact = coalesce(p_allow_whatsapp_contact, false),
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

comment on function public.complete_contact_profile_data is
  'Única vía de escritura de profiles.phone/allow_whatsapp_contact. Valida formato mínimo de
   teléfono server-side cuando el consentimiento pasa a true; desactivar el consentimiento nunca
   requiere teléfono válido. No toca ningún otro campo de profiles.';

revoke all on function public.complete_contact_profile_data(text, boolean) from public;
grant execute on function public.complete_contact_profile_data(text, boolean) to authenticated;

-- ------------------------------------------------------------------
-- 3) update_profile_avatar — persiste la referencia YA subida a Storage (nunca sube el archivo)
-- ------------------------------------------------------------------

create or replace function public.update_profile_avatar(
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_result    public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  -- Defensa en profundidad además de la política RLS de storage.objects (que ya impide subir
  -- fuera de la carpeta propia): la URL persistida debe apuntar al bucket avatars, carpeta
  -- {player_id} propio — nunca la ruta de otro jugador ni un dominio arbitrario. `null` (quitar
  -- foto) siempre se permite sin este chequeo.
  if p_avatar_url is not null
     and p_avatar_url not like ('%/avatars/' || v_player_id::text || '/%') then
    raise exception 'avatar_path_invalid' using errcode = 'P0001';
  end if;

  update public.profiles set
    avatar_url = p_avatar_url,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

comment on function public.update_profile_avatar is
  'Única vía de escritura de profiles.avatar_url. La subida real del archivo ocurre client-side
   contra Supabase Storage (bucket avatars, RLS por carpeta = player_id propio) ANTES de llamar
   acá — esta RPC solo persiste la referencia y valida que la ruta pertenezca al jugador de la
   sesión (defensa en profundidad, no la única barrera). p_avatar_url NULL quita la foto.';

revoke all on function public.update_profile_avatar(text) from public;
grant execute on function public.update_profile_avatar(text) to authenticated;

-- ------------------------------------------------------------------
-- 4) Storage: bucket "avatars" — público de lectura, escritura restringida a carpeta propia
-- ------------------------------------------------------------------
--
-- Avatares no son datos sensibles (Backend_Infraestructura.md §5.1 ya los lista como visibles
-- para cualquier usuario autenticado, igual que nombre/localidad/rama) — la app entera renderiza
-- avatares con <img src="..."> directo (setAvatarPreview, bramulab/app.js) en al menos 6 lugares
-- (Home, Mi Perfil, Editar Datos, Perfil público local y server-backed, filas de Ranking). Un
-- bucket privado exigiría reescribir todos esos <img> a un flujo async de blob/URL firmada — una
-- superficie de cambio mucho mayor que "una corrección acotada de Perfil" para un dato que el
-- propio contrato de privacidad ya trata como público-entre-usuarios. Se elige bucket público de
-- LECTURA (con límite de tamaño/MIME) + RLS estricta de ESCRITURA por carpeta propia, en vez de
-- "hacer público todo el bucket" sin ningún control — la escritura sigue exactamente tan
-- restringida como cualquier otro dato de este proyecto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- RLS de storage.objects ya viene ON por defecto en Supabase (deny-by-default, mismo criterio
-- que el resto de este proyecto) — no se toca esa configuración, solo se agregan las políticas
-- puntuales de esta bucket. Carpeta = primer segmento de la ruta (storage.foldername(name)[1]),
-- que la app siempre fija como el propio player_id al subir (bramulab/auth.js#uploadAvatar).
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (
      select player_id::text from public.players where auth_user_id = auth.uid()
    )
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (
      select player_id::text from public.players where auth_user_id = auth.uid()
    )
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (
      select player_id::text from public.players where auth_user_id = auth.uid()
    )
  );

-- SELECT restringida a la carpeta propia: la lectura PÚBLICA (perfiles de otros jugadores,
-- Ranking) nunca pasa por esta política — usa la URL pública del bucket (bucket público, GET
-- directo vía CDN, no evalúa RLS). Esta política solo habilita que el propio dueño pueda LISTAR/
-- borrar sus archivos viejos antes de subir uno nuevo (bramulab/auth.js#uploadAvatar hace
-- list()+remove() de su propia carpeta para no acumular archivos huérfanos).
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (
      select player_id::text from public.players where auth_user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- 5) get_public_profile — agrega avatar_url + whatsapp_phone (filtrado server-side)
-- ------------------------------------------------------------------

drop function if exists public.get_public_profile(uuid);

create or replace function public.get_public_profile(p_player_id uuid)
returns table (
  player_id uuid,
  username text,
  display_name text,
  first_name text,
  last_name text,
  competitive_branch text,
  dominant_hand text,
  preferred_side text,
  locality_label text,
  province_label text,
  level_status text,
  level_public numeric,
  rated_matches integer,
  distinct_opponents integer,
  matches_played integer,
  matches_won integer,
  -- Pre-Production P0.1C (24/09/2026):
  avatar_url text,
  -- NUNCA el teléfono crudo — solo cuando allow_whatsapp_contact=true, y ni siquiera entonces se
  -- expone como "phone" (nombre distinto a propósito, para que ningún llamador futuro confunda
  -- esta columna con un teléfono siempre-visible). Filtrado DENTRO del propio SELECT — nunca
  -- confía en que el cliente decida no mostrarlo.
  whatsapp_phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_player_id uuid;
begin
  select p.player_id into v_caller_player_id
  from public.players p
  where p.auth_user_id = auth.uid();

  if v_caller_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if not public.consume_rate_limit(v_caller_player_id, 'get_public_profile', 30, 60) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return query
    select
      pl.player_id,
      pr.username,
      pr.display_name,
      pr.first_name,
      pr.last_name,
      pr.competitive_branch,
      pr.dominant_hand,
      pr.preferred_side,
      loc.locality_label,
      loc.province_label,
      ls.status,
      round(ls.mu, 1),
      coalesce(ls.rated_matches, 0),
      coalesce(ls.distinct_opponents, 0),
      coalesce(pubstats.matches_played, 0)::integer,
      coalesce(pubstats.matches_won, 0)::integer,
      pr.avatar_url,
      case when pr.allow_whatsapp_contact then pr.phone else null end
    from public.players pl
    join public.profiles pr on pr.player_id = pl.player_id
    left join public.locations loc on loc.location_id = pr.location_id
    left join public.level_states ls on ls.player_id = pl.player_id
    left join lateral (
      select
        count(*) as matches_played,
        count(*) filter (where m.winner_team = mp.team) as matches_won
      from public.match_participants mp
      join public.matches m on m.match_id = mp.match_id
      where mp.player_id = pl.player_id
        and m.status = 'validated'
        and m.winner_team is not null
    ) pubstats on true
    where pl.type = 'registered'
      and pl.is_active
      and pl.player_id = p_player_id
      and pr.username is not null;
end;
$$;

comment on function public.get_public_profile is
  'Perfil público de un player_id puntual, mismas columnas/exclusiones que search_players más
   matches_played/matches_won (P0.1) y avatar_url/whatsapp_phone (P0.1C). whatsapp_phone es NULL
   salvo allow_whatsapp_contact=true — nunca expone profiles.phone crudo. 0 filas para
   provisional/inexistente/perfil sin username todavía.';

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
