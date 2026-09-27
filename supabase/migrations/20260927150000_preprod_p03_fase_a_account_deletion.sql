-- BRAMUlab — P0.3 Fase A: eliminación/anonimización de cuenta (handoff 26, 27/09/2026).
-- Corregida tras revisión central (handoff 28, 27/09/2026) — ver
-- docs/BRAMUlab/Implementacion/Pre_Production/29_Resultado_Revision_Central_P0_3_27SEP.md para
-- el detalle completo de qué cambió y por qué. Esta migración TODAVÍA NO fue aplicada a ningún
-- entorno — se corrige directamente en el mismo archivo, sin crear una migración correctiva
-- encima de una que aún no existe remotamente (handoff 28 §6).
--
-- Ver docs/BRAMUlab/Pre_Production.md §P0.3, docs/BRAMUlab/Backend_Infraestructura.md §12,
-- docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md §5.
--
-- Decisiones de producto YA CERRADAS que esta migración implementa (Pre_Production.md §P0.3):
--   - eliminación asistida por administración, NUNCA autoservicio ni invocable por el propio
--     usuario;
--   - los partidos compartidos NO se borran; la historia competitiva de terceros no se destruye;
--   - en superficies compartidas la persona eliminada pasa a mostrarse como "Jugador eliminado",
--     sin conservar su nombre visible;
--   - se preserva únicamente la estructura deportiva/histórica mínima necesaria (los player_id
--     referenciados desde partidos/Nivel/Ranking permanecen intactos: solo se anonimiza el
--     NOMBRE, nunca el vínculo estructural);
--   - la persona sale de listas/grupos personales donde corresponda;
--   - la identidad deportiva eliminada no se recupera ni revincula; si la persona vuelve, crea
--     una identidad nueva desde cero (V1 no implementa cooldown/hash de email/huella antifraude).
--
-- ------------------------------------------------------------------
-- CORRECCIÓN A (Auth) — handoff 28 §3.A.
--
-- La Fase A original afirmaba, incorrectamente, que el Auth Admin API (`deleteUser`) era "el
-- único mecanismo que invalida realmente una sesión JWT ya emitida". La documentación vigente de
-- Supabase confirma lo contrario: borrar/banear un usuario de `auth.users` NO invalida
-- automáticamente un access token JWT ya emitido — ese JWT puede seguir siendo
-- CRIPTOGRÁFICAMENTE válido hasta su expiración natural (típicamente ~1 hora), incluso después
-- de que la cuenta ya no exista en `auth.users`. Para garantías fuertes de cierre de sesión hacen
-- falta revocación de sesiones/refresh tokens, que Supabase Auth resuelve por su cuenta (fuera de
-- SQL) — nunca tocando `auth.users`/`auth.sessions`/`auth.refresh_tokens` directamente.
--
-- Por eso el corte de acceso REAL a BRAMU no puede depender únicamente de que el paso de Auth
-- (fuera de esta migración, ver más abajo) tenga éxito. Prácticamente TODAS las RPCs sensibles de
-- BRAMU (23 archivos de migración usan el patrón, auditado explícitamente para esta ronda: cada
-- una resuelve `select player_id into v_caller from players where auth_user_id = auth.uid()` y
-- corta con `raise exception 'no_player_for_session'` si no encuentra fila — sin excepción, no
-- existe ninguna otra vía de resolución de identidad de usuario en este esquema) dependen
-- exclusivamente de ese mapping `players.auth_user_id -> auth.uid()`.
--
-- Fix: `admin_delete_player_account` ahora también pone `players.auth_user_id = null` en la
-- MISMA transacción atómica que anonimiza el resto — un JWT viejo que siga siendo
-- criptográficamente válido deja de mapear a CUALQUIER jugador de BRAMU inmediatamente después de
-- que esta función SQL confirma, sin depender de que el Auth Admin API se ejecute (ni de que
-- tenga éxito) después. Este es el corte de acceso "BRAMU-level", distinto y más fuerte que
-- cualquier cosa que dependa de red/Auth API — corre síncrono, dentro de la misma transacción
-- Postgres que ya bloquea la fila con `for update`.
--
-- El procedimiento final distingue 3 fases, deliberadamente separadas:
--   FASE 1 (esta función, SQL, SÍNCRONA Y ATÓMICA) — desautorización BRAMU inmediata:
--     auth_user_id=null + anonimización completa. Suficiente por sí sola para que ninguna RPC de
--     BRAMU vuelva a reconocer a esta persona, incluso si las fases 2/3 nunca llegan a correr.
--   FASE 2 (fuera de esta migración, Auth Admin API) — baneo inmediato de la cuenta
--     (`admin.updateUserById(authUserId, {ban_duration: '876000h'})`, ~100 años, "permanente en
--     la práctica"): defensa adicional mientras se completa el resto del procedimiento — nunca
--     depende de un `signOut` estable por user id, que supabase-js no expone de forma uniforme
--     en todas las versiones. Best-effort adicional de seguridad: BRAMU ya está cortado por la
--     Fase 1 aunque esto falle o se demore.
--   FASE 3 (fuera de esta migración, Auth Admin API) — eliminación final de la cuenta
--     (`admin.deleteUser(authUserId)`), que en el propio backend de Supabase también purga las
--     sesiones/refresh tokens asociados a ese usuario (solo el access token JWT de corta
--     duración ya emitido puede seguir siendo válido hasta expirar, ver Corrección A arriba).
--     Como `players.auth_user_id` ya quedó NULL en la Fase 1, el `on delete set null` de la FK
--     (Bloque 1) no tiene nada que hacer en este punto — ya no hay ninguna fila de `players`
--     apuntando a esa cuenta de Auth.
--
-- El `auth_user_id` capturado ANTES de anonimizar se devuelve en el resultado de esta función Y
-- se persiste en `pilot_events.properties.authUserId` (ver más abajo) — necesario para que el
-- orquestador externo (Fases 2/3) pueda recuperarlo en un REINTENTO después de un fallo parcial,
-- incluso si el proceso que llamó a esta función se cortó antes de poder usarlo (ver
-- supabase/scripts/admin-delete-player-account.mjs). Un UUID técnico interno de Auth no es PII
-- identificatoria por nombre — es el dato mínimo estructurado imprescindible para que la
-- operación sea recuperable, no una nota libre (ver corrección de auditoría más abajo).
--
-- No se toca directamente ninguna tabla interna de `auth.*` (`auth.users`/`auth.sessions`/
-- `auth.refresh_tokens`) desde esta ni ninguna otra función SQL de este repo.
-- ------------------------------------------------------------------
--
-- ------------------------------------------------------------------
-- CORRECCIÓN B (Storage) — handoff 28 §3.B. Trazado: bramulab/auth.js#removeAvatarFiles ya
-- resuelve exactamente este patrón para el propio usuario (RLS-scoped): `storage.from('avatars')
-- .list(playerId)` + `.remove(paths)`, sobre `{playerId}/{timestamp}.jpg`. Esta migración NO
-- toca Storage (SQL puro no tiene acceso al Storage API) — el orquestador
-- (supabase/scripts/admin-delete-player-account.mjs) reutiliza el MISMO patrón list+remove, con
-- el cliente service_role, ANTES de intentar la Fase 3 de Auth (un usuario Auth puede no poder
-- eliminarse si todavía es propietario de objetos en Storage). Ver ese script para el orden
-- completo y su cobertura de test.
-- ------------------------------------------------------------------
--
-- ------------------------------------------------------------------
-- CORRECCIÓN — auditoría administrativa (handoff 28 §4, nota sobre `p_admin_note`). La Fase A
-- original aceptaba una nota libre de administrador (`p_admin_note text`) con la regla "no poner
-- PII", señalada por Central como no técnicamente exigible. Se ELIMINA ese parámetro por
-- completo — sin una necesidad real de producto/operación que lo justifique, no vale la pena el
-- riesgo de texto libre en una operación de privacidad. La auditoría queda mínima y
-- estructurada: `pilot_events(event_name='account_deleted', player_id, properties)`, con
-- `properties` conteniendo ÚNICAMENTE el `authUserId` capturado (un UUID técnico, no una nota de
-- texto) — necesario para la recuperación ante fallo parcial (ver Corrección A). Ningún dato
-- personal del jugador (nombre/email/teléfono) pasa nunca por esta fila.
-- ------------------------------------------------------------------

-- ------------------------------------------------------------------
-- 1) players.deleted_at — marca de anonimización + idempotencia.
-- ------------------------------------------------------------------

alter table public.players
  add column if not exists deleted_at timestamptz;

comment on column public.players.deleted_at is
  'Timestamp de SERVIDOR de la anonimización real (admin_delete_player_account). NULL = cuenta
   nunca eliminada. Distinto de is_active: is_active=false sin deleted_at podría representar otro
   motivo de inactivación futuro; deleted_at siempre implica is_active=false pero no al revés.
   Fuente de verdad de idempotencia — reintentar la operación sobre un player con deleted_at ya
   seteado es un no-op seguro, nunca vuelve a tocar sus datos.';

-- ------------------------------------------------------------------
-- 2) pilot_events.event_name — agrega 'account_deleted' al CHECK existente.
-- ------------------------------------------------------------------

alter table public.pilot_events drop constraint if exists pilot_events_event_name_check;
alter table public.pilot_events add constraint pilot_events_event_name_check check (event_name in (
  'signup_started', 'signup_completed', 'level_started', 'level_confirmed',
  'match_created', 'match_validated', 'match_rejected',
  'calibration_1_5', 'calibration_3_5', 'calibration_5_5', 'daily_active',
  'provisional_claimed', 'account_deleted'
));

-- ------------------------------------------------------------------
-- 3) admin_delete_player_account — procedimiento administrativo mínimo V1 (Fase 1: SQL).
--
-- SOLO service_role. Idempotente, atómica, bajo lock de la fila `players`.
--
-- Recorrido de tablas y su tratamiento (auditoría completa en el documento de resultado):
--   players                      -> ANONIMIZAR: display_name='Jugador eliminado', is_active=
--                                    false, deleted_at=now(), auth_user_id=null (CORTE DE ACCESO
--                                    BRAMU INMEDIATO — Corrección A).
--   profiles                     -> ANONIMIZAR: toda columna de PII a null/false.
--   match_participants           -> ANONIMIZAR SOLO display_name_snapshot (player_id se
--                                    PRESERVA — estructura deportiva mínima de terceros).
--   intelligence_match_outputs   -> INVALIDAR (delete) todo output de TODOS los partidos donde
--                                    participó, propios y de compañeros/rivales — regenerable,
--                                    nunca la fuente de verdad.
--   match_user_state             -> BORRAR (100% privado, sin valor para terceros).
--   notifications                -> BORRAR (100% privadas, nunca compartidas).
--   player_saved_players         -> BORRAR como owner Y como saved.
--   ranking_network_hidden       -> BORRAR como player Y como hidden_player.
--   matches / match_sets / match_revisions / match_actions / match_identity_issues /
--   match_level_results / match_level_result_players / level_states / level_events /
--   ranking_rows / ranking_editions / ranking_profile_events / location_change_events /
--   provisional_claims / api_rate_limits
--                                 -> NUNCA TOCADAS. Preservan estructura deportiva/histórica de
--                                    TERCEROS. `ranking_rows` en particular NUNCA se reescribe
--                                    (inmutabilidad semanal obligatoria, handoff 28 §3.C) — la
--                                    presentación anónima de una fila de Ranking ya publicada con
--                                    este player_id se resuelve en LECTURA, ver la migración de
--                                    presentación de Ranking (20260927160000).
--
-- Un jugador `type='provisional'` NO pasa por este camino -> `not_a_registered_account`.
-- ------------------------------------------------------------------

create or replace function public.admin_delete_player_account(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
  v_captured_auth_user_id uuid;
begin
  select * into v_player from public.players where player_id = p_player_id for update;

  if v_player is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;

  -- Idempotencia PRIMERO: reintentar sobre una cuenta ya eliminada es siempre un no-op seguro.
  -- El authUserId capturado la primera vez se relee acá desde pilot_events (persistido más
  -- abajo en la corrida original) para que el orquestador pueda completar las Fases 2/3 aunque
  -- reintente después de este punto — sin esto, un reintento no tendría forma de recuperar el
  -- auth_user_id, que ya quedó NULL en `players` desde la primera corrida.
  if v_player.deleted_at is not null then
    select (properties->>'authUserId')::uuid into v_captured_auth_user_id
      from public.pilot_events
      where event_name = 'account_deleted' and player_id = p_player_id
      order by created_at desc
      limit 1;
    return jsonb_build_object(
      'ok', true, 'playerId', p_player_id, 'alreadyDeleted', true, 'authUserId', v_captured_auth_user_id
    );
  end if;

  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;

  v_captured_auth_user_id := v_player.auth_user_id;

  -- ---- FASE 1a: corte de acceso BRAMU inmediato + anonimizar identidad. ----
  update public.players set
    display_name = 'Jugador eliminado',
    is_active = false,
    deleted_at = now(),
    auth_user_id = null,
    updated_at = now()
  where player_id = p_player_id;

  -- `terms_version`/`terms_accepted_at` se CONSERVAN deliberadamente (evidencia de aceptación,
  -- no PII identificable por nombre). `ranking_opt_in`/`allow_whatsapp_contact` a false.
  update public.profiles set
    username = null,
    first_name = null,
    last_name = null,
    display_name = null,
    avatar_url = null,
    birth_date = null,
    gender = null,
    dominant_hand = null,
    preferred_side = null,
    competitive_branch = null,
    location_id = null,
    location_effective_from = null,
    phone = null,
    allow_whatsapp_contact = false,
    current_category = null,
    current_category_at = null,
    ranking_opt_in = false,
    updated_at = now()
  where player_id = p_player_id;

  -- ---- Superficies compartidas: anonimizar SOLO el nombre mostrado, preservar la estructura. ----
  update public.match_participants
    set display_name_snapshot = 'Jugador eliminado'
    where player_id = p_player_id;

  -- ---- Intelligence: invalidar (regenerable) TODO output que pueda embeber su nombre. ----
  delete from public.intelligence_match_outputs
    where match_id in (select match_id from public.match_participants where player_id = p_player_id);

  -- ---- Datos 100% privados del jugador eliminado. ----
  delete from public.match_user_state where player_id = p_player_id;
  delete from public.notifications where player_id = p_player_id;

  -- ---- Relaciones personales, ambas direcciones. ----
  delete from public.player_saved_players
    where owner_player_id = p_player_id or saved_player_id = p_player_id;
  delete from public.ranking_network_hidden
    where player_id = p_player_id or hidden_player_id = p_player_id;

  -- ---- Auditoría mínima estructurada, sin texto libre: solo el authUserId capturado (necesario
  --      para que el orquestador pueda recuperar las Fases 2/3 ante un fallo parcial). ----
  insert into public.pilot_events (event_name, player_id, properties)
  values ('account_deleted', p_player_id, jsonb_build_object('authUserId', v_captured_auth_user_id));

  return jsonb_build_object(
    'ok', true, 'playerId', p_player_id, 'alreadyDeleted', false,
    'authUserId', v_captured_auth_user_id
  );
end;
$$;

comment on function public.admin_delete_player_account is
  'P0.3 Fase A (Fase 1 del procedimiento completo, corregida tras revisión central — handoff 28,
   29_Resultado). SOLO service_role. Corta el acceso BRAMU inmediato (auth_user_id=null) en la
   MISMA transacción que anonimiza players/profiles/match_participants.display_name_snapshot,
   invalida intelligence_match_outputs regenerable, borra datos 100% privados y relaciones
   personales. NUNCA toca ranking_rows/matches/level_states/etc — preserva la estructura
   deportiva/histórica de terceros. Idempotente vía players.deleted_at. Devuelve/persiste el
   authUserId capturado para que supabase/scripts/admin-delete-player-account.mjs pueda completar
   las Fases 2 (revocación de sesiones) y 3 (eliminación de la cuenta Auth) — ambas fuera de SQL,
   vía el Auth Admin API, nunca tocando auth.* directamente.';

revoke all on function public.admin_delete_player_account(uuid) from public;
revoke all on function public.admin_delete_player_account(uuid) from anon;
revoke all on function public.admin_delete_player_account(uuid) from authenticated;
grant execute on function public.admin_delete_player_account(uuid) to service_role;

-- ------------------------------------------------------------------
-- 4) admin_finalize_player_account_deletion — hardening final (handoff 30 §2.A, 27/09/2026).
--
-- `pilot_events.properties.authUserId` es un dato OPERATIVO mínimo, necesario ÚNICAMENTE
-- mientras el procedimiento sigue incompleto (para que el orquestador pueda recuperar las
-- Fases 2/3 de Auth ante un fallo parcial, ver Corrección A de la migración anterior). Una vez
-- confirmado que la cuenta Auth ya no existe, ya no corresponde conservarlo indefinidamente: es
-- un identificador técnico de la identidad eliminada, y P0.3 ya decidió minimizar/eliminar
-- identificadores personales. Esta función lo purga — el orquestador
-- (supabase/scripts/admin-delete-player-account.mjs) la llama SOLO después de verificar con el
-- Auth Admin API (`getUserById`) que la cuenta ya no existe, nunca antes.
--
-- SOLO service_role. Idempotente: si `properties` ya no tiene la clave `authUserId` (ya se
-- purgó, o nunca la tuvo), el operador jsonb `-` es un no-op — no falla, no duplica nada. Si el
-- jugador no existe o todavía no pasó por `admin_delete_player_account` (`deleted_at is null`),
-- devuelve un código de negocio sin tocar nada. Conserva `event_name='account_deleted'` +
-- `player_id` (estructura de auditoría mínima, nunca PII por nombre) — nunca reemplaza el
-- identificador purgado por email/hash/HMAC ni ningún otro identificador persistente nuevo.
-- ------------------------------------------------------------------

create or replace function public.admin_finalize_player_account_deletion(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.players;
begin
  select * into v_player from public.players where player_id = p_player_id for update;

  if v_player is null then
    return jsonb_build_object('ok', false, 'code', 'player_not_found');
  end if;
  if v_player.deleted_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_yet_deleted');
  end if;

  update public.pilot_events
    set properties = properties - 'authUserId'
    where event_name = 'account_deleted' and player_id = p_player_id;

  return jsonb_build_object('ok', true, 'playerId', p_player_id);
end;
$$;

comment on function public.admin_finalize_player_account_deletion is
  'P0.3 hardening final (handoff 30 §2.A, 27/09/2026) — purga pilot_events.properties.authUserId
   una vez que el orquestador confirmó vía Auth Admin API que la cuenta ya no existe. SOLO
   service_role. Idempotente (jsonb - clave es no-op si ya no está). Nunca reemplaza el
   identificador purgado por otro dato identificatorio — conserva únicamente event_name/
   player_id/timestamps, la estructura mínima de auditoría que P0.3 ya decidió preservar.';

revoke all on function public.admin_finalize_player_account_deletion(uuid) from public;
revoke all on function public.admin_finalize_player_account_deletion(uuid) from anon;
revoke all on function public.admin_finalize_player_account_deletion(uuid) from authenticated;
grant execute on function public.admin_finalize_player_account_deletion(uuid) to service_role;
