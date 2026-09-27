-- BRAMUlab — P0.3 Fase A: eliminación/anonimización de cuenta (handoff 26, 27/09/2026).
--
-- Ver docs/BRAMUlab/Pre_Production.md §P0.3, docs/BRAMUlab/Backend_Infraestructura.md §12,
-- docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md §5, y el
-- resultado de esta fase en
-- docs/BRAMUlab/Implementacion/Pre_Production/27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md.
--
-- Decisiones de producto YA CERRADAS que esta migración implementa (Pre_Production.md §P0.3):
--   - eliminación asistida por administración, NUNCA autoservicio ni invocable por el propio
--     usuario (Backend_Infraestructura.md §19: "automatización de eliminación/exportación de
--     cuenta" queda explícitamente como decisión NO bloqueante/futura — acá se implementa el
--     procedimiento ADMINISTRATIVO mínimo, no un botón "Eliminar mi cuenta");
--   - los partidos compartidos NO se borran; la historia competitiva de terceros no se destruye;
--   - en superficies compartidas la persona eliminada pasa a mostrarse como "Jugador eliminado",
--     sin conservar su nombre visible;
--   - se preserva únicamente la estructura deportiva/histórica mínima necesaria (los player_id
--     referenciados desde partidos/Nivel/Ranking permanecen intactos: solo se anonimiza el
--     NOMBRE, nunca el vínculo estructural);
--   - la persona sale de listas/grupos personales donde corresponda;
--   - la identidad deportiva eliminada no se recupera ni revincula; si la persona vuelve, crea
--     una identidad nueva desde cero (V1 no implementa cooldown/hash de email/huella antifraude
--     — riesgo de "reset de carrera" aceptado explícitamente para V1).
--
-- ALCANCE REAL de esta migración — SOLO la capa de datos (anonimización SQL). El procedimiento
-- completo tiene DOS pasos deliberadamente separados (handoff 26 §3.2: "separación entre
-- borrar/desactivar Auth y anonimizar identidad deportiva"):
--   PASO 1 (Auth) — fuera de esta migración. Ningún código de este repo toca `auth.users`
--     directamente ni usa el Auth Admin API (auditado explícitamente para esta ronda: cero
--     ocurrencias en migraciones/Edge Functions). `players.auth_user_id` ya tiene
--     `on delete set null` (Bloque 1) — si Central borra/banea la fila de `auth.users` vía el
--     Auth Admin API o el dashboard de Supabase, `players.auth_user_id` queda NULL solo por esa
--     FK, sin necesitar tocar `players` para ese campo. Este paso queda documentado como
--     procedimiento operativo manual/Admin API en el documento de resultado — implementarlo como
--     código exigiría una Edge Function nueva, explícitamente prohibida en esta fase (handoff 26
--     §3 NO HACER: "NO desplegar Edge Functions").
--   PASO 2 (esta migración) — anonimiza/limpia TODA la identidad deportiva y PII bajo control
--     de este esquema. 100% implementable en SQL, sin ninguna decisión legal pendiente para lo
--     que cubre.
--
-- No se aplica esta migración a Supabase Staging desde este sandbox (handoff 26 §3 NO HACER:
-- "NO aplicar migraciones a Supabase Staging remoto en esta fase").

-- ------------------------------------------------------------------
-- 1) players.deleted_at — marca de anonimización + idempotencia.
--
-- Deliberadamente SEPARADA de `is_active` (que ya existe y se reutiliza para excluir al jugador
-- de búsqueda/perfil público — ver search_players/get_public_profile, ambas ya filtran por
-- `pl.is_active`): `is_active=false` por sí solo no distingue "cuenta eliminada" de cualquier
-- otro futuro motivo de inactivación que no implique anonimización real. `deleted_at` es la
-- única fuente de verdad de "esta cuenta ya pasó por el procedimiento de eliminación" —
-- admin_delete_player_account la usa como guarda de idempotencia (ver más abajo).
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
-- 2) pilot_events.event_name — agrega 'account_deleted' al CHECK existente (mismo patrón que
--    'provisional_claimed' en Bloque 4), para auditoría interna mínima de CUÁNDO se ejecutó la
--    eliminación, sin retener PII: `properties` de esta fila nunca debe llevar nombre/email/
--    teléfono del jugador eliminado, solo metadata operativa (ver la función más abajo).
-- ------------------------------------------------------------------

alter table public.pilot_events drop constraint if exists pilot_events_event_name_check;
alter table public.pilot_events add constraint pilot_events_event_name_check check (event_name in (
  'signup_started', 'signup_completed', 'level_started', 'level_confirmed',
  'match_created', 'match_validated', 'match_rejected',
  'calibration_1_5', 'calibration_3_5', 'calibration_5_5', 'daily_active',
  'provisional_claimed', 'account_deleted'
));

-- ------------------------------------------------------------------
-- 3) admin_delete_player_account — procedimiento administrativo mínimo V1.
--
-- SOLO service_role (nunca invocable por el propio usuario ni por ningún rol de cliente —
-- "operación privilegiada, nunca invocable por usuario común", handoff 26 §3.2). Idempotente,
-- atómica (una función = una transacción), bajo lock de la fila `players` para serializar
-- reintentos/ejecuciones concurrentes sobre el mismo jugador.
--
-- Recorrido de tablas y su tratamiento (ver auditoría completa en el documento de resultado):
--   players / profiles           -> ANONIMIZAR (nombre/PII a null, display_name fijo
--                                    'Jugador eliminado', is_active=false, deleted_at=now()).
--   match_participants           -> ANONIMIZAR SOLO display_name_snapshot (el player_id de la
--                                    fila se PRESERVA — es la estructura deportiva mínima que
--                                    mantiene coherente el historial de los otros 3 participantes
--                                    de cada partido compartido).
--   intelligence_match_outputs   -> INVALIDAR (delete) las filas de TODOS los partidos donde el
--                                    jugador participó, propias y de sus compañeros/rivales —
--                                    confirmado por lectura de código
--                                    (_shared/intelligence-presentation.js#buildNameResolver) que
--                                    el texto narrativo persistido en `output`/`audit` puede
--                                    embeber su nombre; es un output derivado/regenerable (nunca
--                                    la fuente de verdad de Nivel/Ranking), así que invalidarlo
--                                    es seguro — se recalcula solo con el nombre ya anonimizado.
--   match_user_state             -> BORRAR (nota privada + ocultamiento personal del propio
--                                    jugador eliminado; no tiene valor para terceros).
--   notifications                -> BORRAR (100% privadas de ese jugador, nunca compartidas).
--   player_saved_players         -> BORRAR como owner Y como saved (sale de su propia lista y de
--                                    las listas de otros — "sale de listas/grupos personales
--                                    donde corresponda").
--   ranking_network_hidden       -> BORRAR como player Y como hidden_player (mismo criterio).
--   matches / match_sets / match_revisions / match_actions / match_identity_issues /
--   match_level_results / match_level_result_players / level_states / level_events /
--   ranking_rows / ranking_editions / ranking_profile_events / location_change_events /
--   provisional_claims / api_rate_limits
--                                 -> NUNCA TOCADAS. Preservan la estructura deportiva/histórica
--                                    (player_id, cifras, posiciones) que Nivel/Ranking/
--                                    Intelligence de TERCEROS necesitan para seguir siendo
--                                    coherentes — "los partidos compartidos NO se borran", "la
--                                    historia competitiva de terceros NO se destruye". Ninguna de
--                                    estas tablas tiene una columna de nombre libre (auditado
--                                    explícitamente: ranking_rows.location_display_label es un
--                                    label de UBICACIÓN, nunca de jugador); el nombre que
--                                    eventualmente se muestre para ese player_id en cualquier
--                                    lectura futura se resuelve siempre contra
--                                    profiles/players, que ya quedan anonimizados acá.
--
-- Un jugador `type='provisional'` NO pasa por este camino (nunca tuvo auth_user_id/cuenta real
-- que "eliminar" en el sentido de este procedimiento) — devuelve `not_a_registered_account` sin
-- tocar nada; los mecanismos existentes de Bloque 4/6 (claim, identidad cuestionada) siguen
-- siendo la vía correcta para un slot provisional.
-- ------------------------------------------------------------------

create or replace function public.admin_delete_player_account(
  p_player_id uuid,
  -- Nota operativa LIBRE del administrador (ej. "solicitado por email 27/09", "cuenta duplicada
  -- reportada") — NUNCA debe contener PII del jugador eliminado (nombre/email/teléfono); queda
  -- en pilot_events.properties, que es auditoría server-only, nunca una superficie de producto.
  p_admin_note text default null
)
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

  -- Idempotencia PRIMERO, antes de cualquier otro guard: reintentar sobre una cuenta ya
  -- eliminada es siempre un no-op seguro, sin importar en qué estado quedó type/is_active
  -- después de la primera corrida.
  if v_player.deleted_at is not null then
    return jsonb_build_object('ok', true, 'playerId', p_player_id, 'alreadyDeleted', true);
  end if;

  if v_player.type <> 'registered' then
    return jsonb_build_object('ok', false, 'code', 'not_a_registered_account');
  end if;

  -- ---- players / profiles: anonimizar identidad. ----
  update public.players set
    display_name = 'Jugador eliminado',
    is_active = false,
    deleted_at = now(),
    updated_at = now()
  where player_id = p_player_id;

  -- `terms_version`/`terms_accepted_at` se CONSERVAN deliberadamente (decisión menor, ver
  -- documento de resultado): no son PII identificable por sí solas (no incluyen nombre) y sirven
  -- de evidencia de que la persona aceptó los términos vigentes en su momento — coherente con
  -- "conservar únicamente la estructura mínima necesaria", acá aplicado a evidencia de
  -- cumplimiento en vez de estructura deportiva. `ranking_opt_in` se deja en false por prolijidad
  -- (ya no participa, is_active=false lo excluye de cualquier cálculo igual).
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

  -- ---- Intelligence: invalidar (regenerable) TODO output que pueda embeber su nombre en texto
  --      narrativo, tanto propio como el de sus compañeros/rivales en esos mismos partidos. ----
  delete from public.intelligence_match_outputs
    where match_id in (select match_id from public.match_participants where player_id = p_player_id);

  -- ---- Datos 100% privados del jugador eliminado: sin valor para terceros. ----
  delete from public.match_user_state where player_id = p_player_id;
  delete from public.notifications where player_id = p_player_id;

  -- ---- Relaciones personales: sale de su propia lista y de las de otros. ----
  delete from public.player_saved_players
    where owner_player_id = p_player_id or saved_player_id = p_player_id;
  delete from public.ranking_network_hidden
    where player_id = p_player_id or hidden_player_id = p_player_id;

  -- ---- Auditoría mínima, sin PII (event_name + player_id + nota operativa del ADMIN). ----
  insert into public.pilot_events (event_name, player_id, properties)
  values ('account_deleted', p_player_id, jsonb_build_object('adminNote', p_admin_note));

  return jsonb_build_object('ok', true, 'playerId', p_player_id, 'alreadyDeleted', false);
end;
$$;

comment on function public.admin_delete_player_account is
  'P0.3 Fase A — procedimiento administrativo mínimo de eliminación/anonimización de cuenta
   (26_Handoff/27_Resultado). SOLO service_role. Anonimiza players/profiles y
   match_participants.display_name_snapshot, invalida intelligence_match_outputs regenerable,
   borra datos 100% privados (match_user_state, notifications) y relaciones personales
   (player_saved_players, ranking_network_hidden). NUNCA toca matches/match_sets/
   match_revisions/match_actions/match_identity_issues/match_level_results/level_states/
   level_events/ranking_rows/ranking_editions — preserva la estructura deportiva/histórica
   mínima de terceros. Idempotente vía players.deleted_at. Paso de Auth (desactivar/borrar
   auth.users) es un procedimiento SEPARADO, fuera de esta función — ver comentario de
   encabezado de esta migración y 27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md.';

revoke all on function public.admin_delete_player_account(uuid, text) from public;
revoke all on function public.admin_delete_player_account(uuid, text) from anon;
revoke all on function public.admin_delete_player_account(uuid, text) from authenticated;
grant execute on function public.admin_delete_player_account(uuid, text) to service_role;
