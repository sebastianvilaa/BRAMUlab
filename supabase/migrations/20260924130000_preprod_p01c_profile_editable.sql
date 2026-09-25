-- Pre-Production P0.1C — Perfil editable server-backed (24/09/2026).
--
-- Handoff: docs/BRAMUlab/Implementacion/Pre_Production/09_Handoff_Perfil_Editable_ServerBacked_Claude.md
-- Revisión central posterior (misma fecha, ANTES de aplicar nada en Staging — esta migración
-- nunca llegó a ejecutarse contra un entorno real, así que se corrige acá mismo sin ningún
-- problema de compatibilidad de datos): dos correcciones reales, documentadas en detalle en cada
-- sección de abajo y en el informe (§17 "Revisión central 2").
--
--   1) AVATAR/PRIVACIDAD — la versión anterior usaba un bucket PÚBLICO. Backend_Infraestructura.md
--      §5.1 exige que los perfiles (avatar incluido) sean visibles SOLO para usuarios autenticados
--      de BRAMU, nunca objetos públicos de Internet accesibles por URL directa. Se reemplaza por
--      un bucket PRIVADO + URLs firmadas resueltas client-side con sesión real (ver §4/§6).
--   2) CATEGORÍA — se separan dos conceptos que la ronda anterior había fusionado sin querer:
--      (A) `level_states.declared_category`/`category_context_key` = contexto HISTÓRICO e
--          inmutable del onboarding de Nivel (Bloque 3/6) — se corrige el Edge Function para que
--          reenvíe el valor real del motor en vez de un `null` hardcodeado (ver §5), pero NUNCA
--          se vuelve a tocar desde Perfil.
--      (B) `profiles.current_category`/`current_category_at` = dato declarativo ACTUAL de Perfil,
--          NUEVO en esta revisión, inicializado una vez desde (A) al completar el onboarding y
--          después editable libremente desde Editar Datos SIN tocar Nivel en absoluto (ver §2/§3).
--
-- Resto de la ronda 1 sin cambios: nombre/apellido/nombre visible/fecha/género/mano/lado siguen en
-- `complete_profile` (Bloque 2/3, sin tocar); localidad/rama siguen en
-- `complete_ranking_profile_data` (Bloque 7, sin tocar); teléfono/consentimiento WhatsApp siguen
-- en `complete_contact_profile_data` (nueva de esta migración, sin cambios en esta revisión);
-- `get_public_profile` sigue agregando `matches_played`/`matches_won` (P0.1) y ahora también
-- `avatar_url` (que pasa a contener una RUTA de Storage, nunca una URL pública — ver §4) y
-- `whatsapp_phone` (filtrado por consentimiento, sin cambios).

-- ------------------------------------------------------------------
-- 1) profiles.phone / profiles.allow_whatsapp_contact — SIN CAMBIOS respecto de la versión
--    anterior de esta misma migración.
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
-- 2) complete_contact_profile_data — SIN CAMBIOS respecto de la versión anterior.
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
-- 3) profiles.current_category / current_category_at — NUEVO (revisión 2)
--
-- Categoría ACTUAL declarada en Perfil — dato puramente descriptivo, sin ningún efecto sobre
-- Nivel BRAMU. Deliberadamente SEPARADA de `level_states.declared_category` (que es el contexto
-- HISTÓRICO e inmutable del onboarding, Bloque 3/6 — ver §5): mezclar ambas habría significado
-- que editar Perfil pudiera reescribir contexto de auditoría de Nivel, o que Nivel no pudiera
-- conservar intacto el valor con el que realmente se calculó el estimador inicial.
-- ------------------------------------------------------------------

alter table public.profiles
  add column if not exists current_category text,
  add column if not exists current_category_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_current_category_check'
  ) then
    alter table public.profiles
      add constraint profiles_current_category_check
      check (current_category is null or current_category in (
        '1', '2', '3', '4', '5', '6', '7', '8', '9', 'no-se', 'no-compito'
      ));
  end if;
end $$;

comment on column public.profiles.current_category is
  'Categoría ACTUAL declarada en Perfil (mismas 11 claves que bramulab/app.js#CATEGORY_LABELS).
   NUNCA usada por Nivel BRAMU — puramente descriptiva. Se inicializa UNA vez, con el mismo valor
   que level_states.declared_category, dentro de officialize_level_onboarding (ver más abajo);
   después el usuario puede cambiarla libremente vía update_current_category, sin ningún efecto
   sobre mu/confidence/evidence_units/level_events/Ranking. Distinta a propósito de
   level_states.declared_category (contexto histórico e inmutable del onboarding, nunca se
   reescribe desde Perfil).';
comment on column public.profiles.current_category_at is
  'Timestamp de la última declaración de current_category — separado de profiles.updated_at (que
   cambia con cualquier edición de Perfil) para poder mostrar "declarada el <fecha>" con
   precisión, igual que ya hacía el camino local/legacy.';

-- ------------------------------------------------------------------
-- 4) update_current_category — NUEVO (revisión 2). Única vía de escritura de
--    profiles.current_category/current_category_at. Nunca toca level_states.
-- ------------------------------------------------------------------

create or replace function public.update_current_category(p_current_category text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_previous  text;
  v_result    public.profiles;
begin
  select player_id into v_player_id from public.players where auth_user_id = auth.uid();
  if v_player_id is null then
    raise exception 'no_player_for_session' using errcode = 'P0001';
  end if;

  if p_current_category is not null and p_current_category not in (
    '1', '2', '3', '4', '5', '6', '7', '8', '9', 'no-se', 'no-compito'
  ) then
    raise exception 'current_category_invalid' using errcode = 'P0001';
  end if;

  select current_category into v_previous from public.profiles where player_id = v_player_id;

  update public.profiles set
    current_category = p_current_category,
    -- Mismo criterio que ya usaba el camino local (app.js): el timestamp solo se re-estampa si
    -- el valor realmente cambió — guardar sin tocar el campo (o guardando el mismo valor)
    -- conserva la fecha de declaración original.
    current_category_at = case
      when p_current_category is distinct from v_previous then now()
      else current_category_at
    end,
    updated_at = now()
  where player_id = v_player_id
  returning * into v_result;

  if v_result is null then
    raise exception 'no_profile_for_player' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

comment on function public.update_current_category is
  'Única vía de escritura de profiles.current_category/current_category_at. NUNCA toca
   level_states — no puede recalcular mu/confidence/evidence_units ni reescribir level_events ni
   snapshots de Ranking, estructuralmente (esta función no referencia esas tablas).';

revoke all on function public.update_current_category(text) from public;
grant execute on function public.update_current_category(text) to authenticated;

-- ------------------------------------------------------------------
-- 5) officialize_level_onboarding — CREATE OR REPLACE, MISMA firma y MISMO comportamiento de
--    Nivel (Bloque 3/6, cuerpo idéntico salvo las dos inserciones marcadas explícitamente más
--    abajo). Agrega exactamente dos cosas, ninguna toca mu/confidence/evidence_units/nivel:
--
--    a) inicializa profiles.current_category/current_category_at UNA sola vez, con el mismo
--       valor que declared_category, dentro del mismo bloque idempotente que ya existía (nunca
--       se ejecuta dos veces para el mismo jugador — misma guarda de siempre,
--       `status = 'PENDIENTE'` en el WHERE del UPDATE de level_states);
--    b) ninguna otra — el fix real de "p_declared_category: null hardcodeado" vive en el Edge
--       Function (supabase/functions/officialize-onboarding/index.ts), no acá: esta función ya
--       recibía `p_declared_category`/`p_category_context_key` como parámetros reales, el
--       problema era que el caller nunca los llenaba con el valor del motor.
--
--    Nota de alcance (ver informe §17 para el detalle completo): el estimador universal V1.2
--    (nivel_inicial_v1_2, ver bramulab/level-calibration.js#confirmInitialLevelV1_2) llama
--    internamente a `computeCategoryStep(rawResult, null, null)` — es decir, el cuestionario de
--    onboarding real HOY NO le pide categoría al usuario en absoluto (decisión ya cerrada,
--    documentada en README.md: "V1.2 retira categoría local del onboarding/cálculo"). Corregir el
--    Edge Function para reenviar el valor REAL del motor (en vez de hardcodear null) es correcto
--    y necesario, pero como el motor V1.2 sigue devolviendo null en ese campo por diseño,
--    level_states.declared_category va a seguir en NULL para toda cuenta real hasta que exista
--    una decisión de producto aparte de volver a pedir categoría en el cuestionario — eso
--    reabriría el flujo de onboarding de Nivel (Bloque 3), fuera del alcance de "Perfil
--    editable". Por eso profiles.current_category (b) es igual de importante: es la única vía
--    real, hoy, para que una cuenta declare y vea reflejada una categoría en Perfil.
-- ------------------------------------------------------------------

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
    -- Bloque 6: origen de confianza + evidencia inicial (siempre 0 en este punto: es la
    -- oficialización del cuestionario, todavía no hay ningún partido computado).
    confidence_origin = p_confidence,
    evidence_units = 0,
    -- C-09: el cuestionario ES el primer instante que establece un estado de Nivel — el reloj de
    -- inactividad (§10.3) arranca acá, nunca queda NULL hasta el primer partido computado.
    last_rated_at = now(),
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

  -- Pre-Production P0.1C (revisión 2) — inicialización única de la categoría ACTUAL de Perfil,
  -- con el mismo valor recién confirmado como contexto histórico de Nivel. Vive DENTRO de este
  -- mismo bloque idempotente (solo se llega acá cuando `v_updated is not null`, es decir, la
  -- transición PENDIENTE->CALIBRANDO ocurrió de verdad esta vez) — nunca se re-ejecuta para el
  -- mismo jugador. No es un requisito que p_declared_category tenga un valor real hoy (ver nota
  -- de alcance arriba): si es NULL, current_category simplemente queda NULL, igual que antes de
  -- esta migración — el usuario puede declararla después desde Editar Datos sin ningún bloqueo.
  update public.profiles set
    current_category = p_declared_category,
    current_category_at = case when p_declared_category is not null then now() else null end
  where player_id = v_player_id;

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
  'Única vía de escritura de level_states/level_events para el onboarding. SOLO service_role.
   Bloque 6 (20260921200000): agrega confidence_origin/evidence_units=0 al mismo UPDATE, sin
   cambiar firma ni comportamiento observable de Bloque 3. Pre-Production P0.1C (revisión 2,
   24/09/2026): además inicializa profiles.current_category/current_category_at UNA vez, con el
   mismo valor recién confirmado en declared_category — nunca los vuelve a tocar en llamadas
   posteriores (la guarda de idempotencia existente ya lo impide). Ver 03_Revision_ChatGPT.md
   (Bloque 3) §2/§9 para el resto del contrato, sin cambios.';

revoke all on function public.officialize_level_onboarding(
  uuid, text, text, text, numeric, numeric, text, text, jsonb, jsonb
) from public;
grant execute on function public.officialize_level_onboarding(
  uuid, text, text, text, numeric, numeric, text, text, jsonb, jsonb
) to service_role;

-- ------------------------------------------------------------------
-- 6) update_profile_avatar — REESCRITA (revisión 2): valida FORMATO DE RUTA, no substring de
--    URL. La versión anterior aceptaba cualquier string que CONTUVIERA
--    "/avatars/{player_id}/" — eso incluía `https://dominio-ajeno.com/avatars/{player_id}/x.jpg`,
--    una URL completamente externa que igual hubiera pasado el chequeo. Ahora `p_avatar_path` es
--    una RUTA DE STORAGE pura (nunca una URL completa — con bucket privado ya no existe una "URL
--    pública" que guardar, ver §7): se exige que sea EXACTAMENTE `{player_id_propio}/<nombre de
--    archivo seguro>`, sin esquema, sin dominio, sin barras adicionales, sin `..`.
-- ------------------------------------------------------------------

create or replace function public.update_profile_avatar(
  p_avatar_path text default null
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
  -- fuera de la carpeta propia): la ruta persistida debe ser EXACTAMENTE
  -- "{player_id_propio}/<archivo>" — un solo segmento de carpeta (el player_id del caller, nunca
  -- otro) seguido de un nombre de archivo con caracteres seguros. Rechaza estructuralmente
  -- cualquier esquema/dominio (`http://`, `//`, etc.), cualquier carpeta ajena y cualquier
  -- traversal (`../`). `null` (quitar foto) siempre se permite sin este chequeo.
  if p_avatar_path is not null
     and p_avatar_path !~ ('^' || v_player_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'avatar_path_invalid' using errcode = 'P0001';
  end if;

  update public.profiles set
    avatar_url = p_avatar_path,
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
  'Única vía de escritura de profiles.avatar_url. Pre-Production P0.1C (revisión 2): el nombre de
   columna se conserva (evita tocar get_ranking_classification, Bloque 7 Fase 3, que ya la
   selecciona), pero desde esta revisión almacena una RUTA de Storage pura
   ("{player_id}/archivo.jpg"), NUNCA una URL completa — el bucket "avatars" es privado, así que
   una "URL pública" no existe; el cliente resuelve una URL firmada temporal con su propia sesión
   (bramulab/auth.js#resolveAvatarUrl) recién al necesitar renderizarla. La subida real del
   archivo ocurre client-side contra Storage (RLS por carpeta = player_id propio) ANTES de llamar
   acá. Valida que la ruta tenga EXACTAMENTE el formato "{player_id_propio}/<archivo>" — rechaza
   cualquier otra carpeta, esquema/dominio o traversal. NULL quita la foto.';

revoke all on function public.update_profile_avatar(text) from public;
grant execute on function public.update_profile_avatar(text) to authenticated;

-- ------------------------------------------------------------------
-- 7) Storage: bucket "avatars" — PRIVADO (revisión 2). Escritura restringida a carpeta propia
--    (sin cambios); lectura restringida a usuarios AUTENTICADOS (nunca pública/anónima).
--
-- Backend_Infraestructura.md §5.1 es explícito: los perfiles deportivos (avatar incluido) son
-- visibles ÚNICAMENTE para personas autenticadas en BRAMU, "no son páginas públicas indexables en
-- Internet". Un bucket público de lectura contradice esa fuente maestra directamente — cualquiera
-- con la URL, sin sesión, podía abrir el archivo. Se reemplaza por:
--
--   - bucket privado (`public=false`);
--   - RLS de insert/update/delete SIN cambios: solo el dueño (carpeta = player_id propio);
--   - RLS de select AMPLIADA a cualquier `authenticated` (ya no solo la carpeta propia) — así
--     Perfil público puede resolver el avatar de OTRO jugador autenticado, y `createSignedUrl`
--     (que internamente exige permiso de SELECT sobre el objeto) funciona para cualquier avatar,
--     nunca solo el propio;
--   - el frontend (bramulab/auth.js#resolveAvatarUrl) pide una URL firmada con vencimiento (24h)
--     cada vez que necesita renderizar un avatar — nunca persiste esa URL firmada en ningún
--     lado, se resuelve de nuevo en cada fetchOwnProfile()/getPublicProfile();
--   - una persona SIN sesión no tiene forma de generar una URL firmada (createSignedUrl exige
--     autenticación + la política de SELECT de abajo) ni de abrir el objeto por la ruta directa
--     (bucket privado: esa ruta devuelve 400 sin excepción).
-- ------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
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

-- Revisión 2 — reemplaza a "avatars_select_own" (que restringía la lectura a la carpeta propia,
-- insuficiente ahora que Perfil público necesita resolver el avatar de OTRO jugador). Cualquier
-- usuario AUTENTICADO puede generar una URL firmada / listar cualquier objeto de esta bucket —
-- nunca un usuario anónimo (la policy es `to authenticated`, no `to public`/`anon`). Esto es
-- exactamente "lectura de avatares permitida a usuarios autenticados", la misma regla que ya
-- aplica al resto del perfil deportivo (Backend_Infraestructura.md §5.1).
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_select_authenticated" on storage.objects;
create policy "avatars_select_authenticated" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- ------------------------------------------------------------------
-- 8) get_public_profile — P0.1C
--
-- IMPORTANTE: esta migración todavía no había sido aplicada cuando se hizo la revisión 2.
-- Por eso debe incluir también el cambio SQL original de P0.1C (avatar_url + whatsapp_phone).
-- La revisión 2 solo cambia la semántica de avatar_url: ahora contiene una RUTA de Storage del
-- bucket privado, que el cliente resuelve a URL firmada; nunca una URL pública persistida.
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
  avatar_url text,
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
   matches_played/matches_won (P0.1) y avatar_url/whatsapp_phone (P0.1C). avatar_url contiene una
   RUTA de Storage del bucket privado "avatars" (nunca una URL completa desde la revisión 2 de
   P0.1C) — el cliente resuelve una URL firmada temporal con su propia sesión
   (bramulab/auth.js#resolveAvatarUrl) antes de renderizarla. whatsapp_phone es NULL salvo
   allow_whatsapp_contact=true — nunca expone profiles.phone crudo. 0 filas para
   provisional/inexistente/perfil sin username todavía.';

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;
