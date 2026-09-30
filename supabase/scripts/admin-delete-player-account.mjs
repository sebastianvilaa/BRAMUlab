// BRAMUlab — P0.3, vehículo administrativo mínimo (handoff 28 §5, 30 §2 — hardening final,
// 27/09/2026).
//
// Script server-side/repo-local, NUNCA una Edge Function — Central prefirió explícitamente este
// vehículo. Orquesta las fases reales del procedimiento completo de eliminación/anonimización de
// cuenta:
//
//   FASE 1 (SQL, síncrona y atómica) — RPC `admin_delete_player_account`: corta el acceso BRAMU
//     de inmediato (players.auth_user_id=null) y anonimiza toda la identidad deportiva/PII en
//     una sola transacción Postgres. Devuelve/persiste el `authUserId` capturado — dato
//     OPERATIVO mínimo, necesario solo mientras el resto del procedimiento sigue incompleto (ver
//     FASE 5).
//   FASE 2 (Storage API) — borra los objetos reales del avatar en el bucket privado "avatars"
//     (`{playerId}/*`), mismo patrón que bramulab/auth.js#removeAvatarFiles pero con el cliente
//     service_role. Un usuario de Auth puede no poder eliminarse mientras siga siendo propietario
//     de objetos en Storage — por eso esta fase corre ANTES de la Fase 3.
//   FASE 2b (Storage API, B2c) — la Fase 1 borra lógicamente los grupos donde la persona era el
//     ÚNICO miembro activo (photo_path=null en la misma transacción); acá se consultan los grupos
//     `status='deleted'` con `deleted_by_player_id = playerId` y se limpia
//     `group-photos/{group_id}/*` (mismo cliente service_role). Postcondición: ninguno de esos
//     grupos conserva objetos en el bucket.
//   FASE 3 (Auth Admin API) — banea inmediatamente la cuenta (defensa adicional mientras se
//     completa el resto) y después la elimina. NUNCA se toca `auth.users`/`auth.sessions`/
//     `auth.refresh_tokens` por SQL directo.
//   FASE 4 (Auth Admin API, verificación — handoff 30 §2.B) — confirma con `getUserById` que la
//     cuenta REALMENTE ya no existe antes de considerar segura la Fase 5. Si por cualquier motivo
//     `getUserById` todavía la encuentra, la operación se detiene ACÁ, sin purgar el
//     `authUserId` — nunca se declara Auth cerrado sin haberlo verificado de vuelta.
//   FASE 5 (SQL, `admin_finalize_player_account_deletion` — handoff 30 §2.A) — SOLO después de
//     que la Fase 4 confirma que Auth ya no existe: purga `authUserId` de la auditoría
//     (`pilot_events.properties`). Ya cumplió su único propósito (permitir un retry); no
//     corresponde conservarlo indefinidamente — es un identificador técnico de la identidad
//     eliminada, y P0.3 ya decidió minimizar/eliminar identificadores personales.
//
// Corrección de una afirmación incorrecta de una ronda anterior (handoff 28 §3.A): la
// documentación vigente de Supabase confirma que borrar/banear un usuario de `auth.users` NO
// invalida automáticamente un access token JWT ya emitido — ese JWT puede seguir siendo
// criptográficamente válido hasta su expiración natural (~1h). El corte de acceso REAL a BRAMU
// (Fase 1) nunca depende de que este script llegue a correr, ni de que tenga éxito.
//
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node admin-delete-player-account.mjs <playerId>
// Requiere `npm ci` en este directorio (@supabase/supabase-js, versión fijada + package-lock.json
// commiteado — handoff 30 §2.D, "para un script administrativo destructivo esto es demasiado
// abierto") antes de la primera corrida. NUNCA commitear credenciales — se leen exclusivamente de
// variables de entorno.
//
// Criterio de éxito del CLI (handoff 30 §2.C): exit 0 SOLO si la operación Y TODAS las
// postcondiciones requeridas quedan confirmadas — nunca solo por que runAccountDeletion() haya
// completado sus pasos sin error. Ver verifyAccountDeleted() y el bootstrap al final del archivo.
//
// Idempotencia de cada fase, pensada para que la operación completa sea reintentable después de
// un fallo parcial en cualquier punto:
//   - Fase 1: idempotente por `players.deleted_at`. El `authUserId` capturado en la corrida
//     original se relee desde `pilot_events` si el reintento llega después de que
//     `players.auth_user_id` ya quedó NULL — MIENTRAS esa clave siga existiendo (ver Fase 5).
//   - Fase 2: `list(playerId)` sobre un bucket ya vacío devuelve `[]` — no-op seguro.
//   - Fase 3: banear/eliminar una cuenta que ya no existe en Auth se reconoce por señal
//     ESTRUCTURADA primero (status/code — handoff 30 §2.E), mensaje solo como fallback cuando no
//     hay ninguna señal estructurada disponible — se trata como éxito, nunca como fallo.
//   - Fase 4: re-verificable en cualquier momento, nunca muta nada.
//   - Fase 5: idempotente (operador jsonb `-` sobre una clave ausente es no-op). Un retry donde
//     Auth ya no existe pero todavía queda `authUserId` operativo simplemente la limpia y cierra
//     (handoff 30 §3.4).

import { pathToFileURL } from 'node:url';

const AVATAR_BUCKET = 'avatars';
const GROUP_PHOTO_BUCKET = 'group-photos';
// ~100 años — "permanente en la práctica" mientras se completa el resto del procedimiento, sin
// depender de una duración exacta arbitraria menor que pudiera vencer antes del borrado final.
const BAN_DURATION = '876000h';

/** Heurística de "la cuenta/objeto ya no existe" — handoff 30 §2.E: prioriza señales
 *  ESTRUCTURADAS del error (`status`/`code`, cuando `supabase-js` las expone) sobre el `message`.
 *  El fallback de substring de mensaje SOLO se usa cuando el error no trae ninguna señal
 *  estructurada en absoluto — así un error real que sí trae `status`/`code` (ej. rate limit,
 *  permisos) nunca se cuela como "ya no existe" solo porque su texto se parezca. Nunca se usa
 *  para silenciar un error real: solo colapsa a éxito el caso puntual "el objetivo de este paso
 *  ya estaba cumplido". */
function isAlreadyGoneError(error) {
  if (!error) return false;
  if (error.status === 404) return true;
  if (typeof error.code === 'string' && /not[_-]?found/i.test(error.code)) return true;
  if (error.status !== undefined || error.code !== undefined) {
    // Trae señal estructurada pero no matchea "ya no existe" -> es un error real, nunca cae al
    // fallback de mensaje (que podría dar un falso positivo por coincidencia de texto).
    return false;
  }
  const msg = ((error.message) || '').toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist') || msg.includes('user not found');
}

/** Confirma con el Auth Admin API si una cuenta YA NO EXISTE — usada tanto por la Fase 4 (gate
 *  antes de finalizar) como por `verifyAccountDeleted` (postcondición independiente), para no
 *  duplicar el criterio en dos lugares. `authUserId` null se considera trivialmente "gone" (no
 *  hay ninguna cuenta que verificar — cubre tanto "nunca tuvo sesión vinculada" como "ya se
 *  purgó tras una finalización exitosa"). */
async function checkAuthUserGone(supabaseAdmin, authUserId) {
  if (!authUserId) return { gone: true };
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(authUserId);
  if (error) {
    if (isAlreadyGoneError(error)) return { gone: true };
    return { gone: false, error: error.message };
  }
  // Sin error pero tampoco usuario -> tratamiento defensivo, mismo criterio que "gone" (algunas
  // versiones del SDK devuelven data:null sin poblar error en este caso puntual).
  if (!data || !data.user) return { gone: true };
  return { gone: false };
}

/** Núcleo puro del orquestador — recibe el cliente Supabase (service_role) ya armado, nunca lo
 *  construye ni lee variables de entorno acá (eso vive solo en el bootstrap CLI) para que sea
 *  testeable con un cliente fabricado, sin depender de credenciales reales ni de que
 *  @supabase/supabase-js esté instalado (ver admin-delete-player-account.test.mjs). */
export async function runAccountDeletion(supabaseAdmin, playerId, opts) {
  const log = (opts && opts.log) || (() => {});

  if (!playerId || typeof playerId !== 'string') {
    return { ok: false, step: 'validate_input', code: 'missing_player_id' };
  }

  // ---- FASE 1: SQL — corte de acceso BRAMU + anonimización, atómico. ----
  log(`[account-deletion] Fase 1 (SQL): admin_delete_player_account(${playerId})`);
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('admin_delete_player_account', {
    p_player_id: playerId,
  });
  if (rpcError) {
    return { ok: false, step: 'sql_phase1', error: rpcError.message };
  }
  if (!rpcResult || rpcResult.ok !== true) {
    return { ok: false, step: 'sql_phase1', code: rpcResult && rpcResult.code };
  }
  const alreadyDeleted = !!rpcResult.alreadyDeleted;
  const authUserId = rpcResult.authUserId || null;
  log(`[account-deletion] Fase 1 OK (alreadyDeleted=${alreadyDeleted}, authUserId=${authUserId ? 'presente' : 'ausente'})`);

  // ---- FASE 2: Storage — borrar objetos reales del avatar vía Storage API. ----
  log('[account-deletion] Fase 2 (Storage): listando objetos del jugador');
  const { data: existingFiles, error: listError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).list(playerId);
  if (listError) {
    return { ok: false, step: 'storage_list', error: listError.message, authUserId };
  }
  let avatarFilesRemoved = 0;
  if (Array.isArray(existingFiles) && existingFiles.length) {
    const paths = existingFiles.map((f) => `${playerId}/${f.name}`);
    const { error: removeError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).remove(paths);
    if (removeError) {
      return { ok: false, step: 'storage_remove', error: removeError.message, authUserId };
    }
    avatarFilesRemoved = paths.length;
  }
  log(`[account-deletion] Fase 2 OK (${avatarFilesRemoved} objeto(s) de avatar borrados)`);

  // ---- FASE 2b (B2c): fotos de los grupos que la Fase 1 borró lógicamente. ----
  const groupCleanup = await cleanDeletedGroupPhotos(supabaseAdmin, playerId);
  if (!groupCleanup.ok) {
    return { ok: false, step: groupCleanup.step, error: groupCleanup.error, authUserId, avatarFilesRemoved };
  }
  const groupPhotoFilesRemoved = groupCleanup.removed;
  log(`[account-deletion] Fase 2b OK (${groupPhotoFilesRemoved} objeto(s) de foto de grupo borrados)`);

  // Sin authUserId (cuenta que nunca tuvo sesión vinculada, o cuyo vínculo ya se perdió sin
  // auditoría recuperable): el acceso BRAMU YA está cortado por la Fase 1 — Fases 3/4 se omiten,
  // pero igual se intenta la Fase 5 (idempotente, no-op si no hay nada que purgar) para dejar el
  // estado consistente y el proceso "cerrado" de punta a punta.
  if (!authUserId) {
    log('[account-deletion] Fases 3/4 (Auth) omitidas: sin authUserId recuperable');
    const finalize = await finalizeAudit(supabaseAdmin, playerId, log);
    if (!finalize.ok) return { ...finalize, authUserId: null, avatarFilesRemoved };
    return {
      ok: true, playerId, alreadyDeleted, authUserId: null, avatarFilesRemoved,
      authPhase: 'skipped_no_auth_user_id', auditFinalized: true,
    };
  }

  // ---- FASE 3: Auth Admin API — banear + eliminar la cuenta. ----
  log(`[account-deletion] Fase 3 (Auth): baneando ${authUserId}`);
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { ban_duration: BAN_DURATION });
  if (banError && !isAlreadyGoneError(banError)) {
    return { ok: false, step: 'auth_ban', error: banError.message, authUserId, avatarFilesRemoved };
  }

  log(`[account-deletion] Fase 3 (Auth): eliminando ${authUserId}`);
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
  if (deleteError && !isAlreadyGoneError(deleteError)) {
    return { ok: false, step: 'auth_delete', error: deleteError.message, authUserId, avatarFilesRemoved };
  }

  // ---- FASE 4: verificar con el Auth Admin API que la cuenta REALMENTE ya no existe. ----
  // Nunca se asume el éxito de deleteUser sin re-confirmar — si por cualquier motivo la cuenta
  // sigue existiendo, la operación se detiene ACÁ, sin avanzar a la Fase 5 (nunca se purga el
  // authUserId mientras Auth siga vivo — perderlo en ese estado dejaría la operación
  // irrecuperable).
  log('[account-deletion] Fase 4 (Auth): verificando que la cuenta ya no existe');
  const authCheck = await checkAuthUserGone(supabaseAdmin, authUserId);
  if (!authCheck.gone) {
    return {
      ok: false, step: 'auth_verify', error: authCheck.error || 'auth_user_still_exists',
      authUserId, avatarFilesRemoved,
    };
  }
  log('[account-deletion] Fase 4 OK — cuenta Auth confirmada inexistente');

  // ---- FASE 5: purgar el authUserId de la auditoría — ya cumplió su único propósito. ----
  const finalize = await finalizeAudit(supabaseAdmin, playerId, log);
  if (!finalize.ok) return { ...finalize, authUserId, avatarFilesRemoved };

  return {
    ok: true, playerId, alreadyDeleted, authUserId, avatarFilesRemoved,
    authPhase: 'completed', auditFinalized: true,
  };
}

/** IDs de los grupos borrados lógicamente por esta persona (Fase 1: era el único miembro activo). */
async function listDeletedGroupIds(supabaseAdmin, playerId) {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('group_id')
    .eq('status', 'deleted')
    .eq('deleted_by_player_id', playerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, ids: (Array.isArray(data) ? data : []).map((g) => g.group_id) };
}

async function cleanDeletedGroupPhotos(supabaseAdmin, playerId) {
  const groups = await listDeletedGroupIds(supabaseAdmin, playerId);
  if (!groups.ok) return { ok: false, step: 'groups_query', error: groups.error };
  let removed = 0;
  for (const groupId of groups.ids) {
    const { data: files, error: listError } = await supabaseAdmin.storage.from(GROUP_PHOTO_BUCKET).list(groupId);
    if (listError) return { ok: false, step: 'group_storage_list', error: listError.message };
    if (Array.isArray(files) && files.length) {
      const paths = files.map((f) => `${groupId}/${f.name}`);
      const { error: removeError } = await supabaseAdmin.storage.from(GROUP_PHOTO_BUCKET).remove(paths);
      if (removeError) return { ok: false, step: 'group_storage_remove', error: removeError.message };
      removed += paths.length;
    }
  }
  return { ok: true, removed };
}

async function finalizeAudit(supabaseAdmin, playerId, log) {
  log('[account-deletion] Fase 5 (SQL): admin_finalize_player_account_deletion — purgando authUserId de la auditoría');
  const { data: finalizeResult, error: finalizeError } = await supabaseAdmin.rpc('admin_finalize_player_account_deletion', {
    p_player_id: playerId,
  });
  if (finalizeError) {
    return { ok: false, step: 'sql_finalize', error: finalizeError.message };
  }
  if (!finalizeResult || finalizeResult.ok !== true) {
    return { ok: false, step: 'sql_finalize', code: finalizeResult && finalizeResult.code };
  }
  log('[account-deletion] Fase 5 OK — authUserId purgado de la auditoría');
  return { ok: true };
}

/** Verificación de postcondición — independiente de `runAccountDeletion`, para que el bootstrap
 *  CLI pueda reportarla, y para que un operador pueda re-ejecutarla en cualquier momento sin
 *  mutar nada. `authUserId` es el que `runAccountDeletion` devolvió (o `null` si nunca hubo
 *  sesión vinculada / ya fue purgado) — quien llama a esta función lo pasa explícitamente, nunca
 *  se re-deriva acá (una vez purgado, ya no es recuperable desde `players`/`pilot_events`, así
 *  que "no tenerlo" es una señal ambigua por diseño: puede significar éxito completo o que nunca
 *  hubo nada que hacer — el llamador es quien sabe cuál de los dos casos es).
 *  Handoff 30 §2.B: éxito (`ok:true`) únicamente si TODAS las postcondiciones se cumplen —
 *  BRAMU anonimizado/desvinculado/inactivo, Storage limpio, Auth confirmado inexistente Y la
 *  auditoría ya purgada del authUserId. */
export async function verifyAccountDeleted(supabaseAdmin, playerId, authUserId) {
  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('deleted_at, auth_user_id, is_active')
    .eq('player_id', playerId)
    .maybeSingle();
  if (playerError) return { ok: false, error: playerError.message };
  if (!player) return { ok: false, code: 'player_not_found' };

  const { data: files, error: listError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).list(playerId);
  if (listError) return { ok: false, error: listError.message };

  const authCheck = await checkAuthUserGone(supabaseAdmin, authUserId || null);

  // B2c — postcondición: ningún grupo borrado por esta persona conserva objetos de foto.
  const deletedGroups = await listDeletedGroupIds(supabaseAdmin, playerId);
  if (!deletedGroups.ok) return { ok: false, error: deletedGroups.error };
  let groupStorageClean = true;
  for (const groupId of deletedGroups.ids) {
    const { data: gFiles, error: gListError } = await supabaseAdmin.storage.from(GROUP_PHOTO_BUCKET).list(groupId);
    if (gListError) return { ok: false, error: gListError.message };
    if (Array.isArray(gFiles) && gFiles.length) groupStorageClean = false;
  }

  const { data: auditRows, error: auditError } = await supabaseAdmin
    .from('pilot_events')
    .select('properties')
    .eq('event_name', 'account_deleted')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (auditError) return { ok: false, error: auditError.message };
  const auditRow = Array.isArray(auditRows) ? auditRows[0] : null;
  const auditPurged = !auditRow || !auditRow.properties || !('authUserId' in auditRow.properties);

  const anonymized = !!player.deleted_at;
  const authUnlinked = player.auth_user_id === null;
  const inactiveInBramu = player.is_active === false;
  const storageClean = Array.isArray(files) && files.length === 0;
  const authDeleted = !!authCheck.gone;

  return {
    ok: anonymized && authUnlinked && inactiveInBramu && storageClean && groupStorageClean && authDeleted && auditPurged,
    anonymized, authUnlinked, inactiveInBramu, storageClean, groupStorageClean, authDeleted, auditPurged,
  };
}

// ------------------------------------------------------------------
// Bootstrap CLI — SOLO corre cuando el archivo se invoca directamente como script (nunca al
// importar runAccountDeletion/verifyAccountDeleted desde un test). Único punto de este archivo
// que lee variables de entorno o importa @supabase/supabase-js.
//
// Handoff 30 §2.C — exit code: 0 ÚNICAMENTE si la operación completó Y la verificación de
// postcondición confirma TODO (anonymized/authUnlinked/inactiveInBramu/storageClean/
// authDeleted/auditPurged). `runAccountDeletion` devolviendo `ok:true` ya no alcanza por sí solo
// para decidir el exit code — antes era el único criterio, lo que podía dar exit 0 aunque la
// postcondición real quedara incumplida.
//
// `pathToFileURL` (no un template literal `file://${...}`) — un path con espacios/caracteres
// especiales (real en este repo: "Otros Trabajos") se URL-encodea distinto en `import.meta.url`
// que en `process.argv[1]` crudo; comparar los strings directo hacía que este bootstrap NUNCA se
// activara en checkouts con esos caracteres, silenciosamente (el proceso terminaba con exit 0
// sin correr nada). `pathToFileURL` (importado arriba) aplica el mismo encoding que usa
// `import.meta.url`.
// ------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const playerId = process.argv[2];
  if (!playerId) {
    console.error('Uso: node admin-delete-player-account.mjs <playerId>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno. Nunca hardcodear estas credenciales.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const result = await runAccountDeletion(supabaseAdmin, playerId, { log: (msg) => console.log(msg) });
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    console.error(`[account-deletion] FALLÓ en la fase "${result.step}" — reintentable, no se declara la operación cerrada.`);
    process.exit(1);
  }

  const postcondition = await verifyAccountDeleted(supabaseAdmin, playerId, result.authUserId);
  console.log('[account-deletion] Verificación post-condición:', JSON.stringify(postcondition, null, 2));

  if (!postcondition.ok) {
    console.error('[account-deletion] La operación reportó éxito pero la POSTCONDICIÓN quedó incompleta — reintentar.');
    process.exit(1);
  }

  process.exit(0);
}
