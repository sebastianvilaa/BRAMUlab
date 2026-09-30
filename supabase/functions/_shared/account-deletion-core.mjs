// BRAMUlab — P0.3: NÚCLEO PURO del orquestador de eliminación de cuenta (fases 1–5), compartido por
//   - supabase/scripts/admin-delete-player-account.mjs (vehículo administrativo por CLI), y
//   - supabase/functions/delete-my-account (autoservicio V04.20, L3).
// UN SOLO motor: ninguno de los dos vehículos reimplementa fases. Sin imports de Node/Deno ni lectura de
// entorno: recibe el cliente Supabase (service_role) ya armado. Ver el comentario de cabecera del script para
// el detalle de cada fase, su idempotencia y la corrección sobre la invalidez de JWTs ya emitidos.

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

