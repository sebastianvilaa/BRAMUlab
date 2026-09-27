// BRAMUlab — P0.3, vehículo administrativo mínimo (handoff 28 §5, 27/09/2026).
//
// Script server-side/repo-local, NUNCA una Edge Function — Central prefirió explícitamente este
// vehículo ("puede ser más seguro y simple que exponer una nueva Edge Function destructiva").
// Orquesta las 3 fases reales del procedimiento completo de eliminación/anonimización de cuenta:
//
//   FASE 1 (SQL, síncrona y atómica) — RPC `admin_delete_player_account`: corta el acceso BRAMU
//     de inmediato (players.auth_user_id=null) y anonimiza toda la identidad deportiva/PII en
//     una sola transacción Postgres. Ver supabase/migrations/20260927150000_....sql.
//   FASE 2 (Storage API) — borra los objetos reales del avatar en el bucket privado "avatars"
//     (`{playerId}/*`), mismo patrón que bramulab/auth.js#removeAvatarFiles pero con el cliente
//     service_role (esa función está RLS-scoped a la carpeta propia del usuario; acá no hay
//     sesión de usuario, así que se reimplementa el mismo list()+remove() con service_role). Un
//     usuario de Auth puede no poder eliminarse mientras siga siendo propietario de objetos en
//     Storage — por eso esta fase corre ANTES de la Fase 3.
//   FASE 3 (Auth Admin API) — banea inmediatamente la cuenta (defensa adicional mientras se
//     completa el resto) y después la elimina. NUNCA se toca `auth.users`/`auth.sessions`/
//     `auth.refresh_tokens` por SQL directo — todo pasa por `supabase.auth.admin.*`.
//
// Corrección de una afirmación incorrecta de la ronda anterior (handoff 28 §3.A): la
// documentación vigente de Supabase confirma que borrar/banear un usuario de `auth.users` NO
// invalida automáticamente un access token JWT ya emitido — ese JWT puede seguir siendo
// criptográficamente válido hasta su expiración natural (~1h). Por eso el corte de acceso REAL a
// BRAMU (Fase 1) nunca depende de que este script llegue a correr, ni de que tenga éxito: ya
// ocurrió, atómico, del lado de la base. Este script completa el resto (Storage/Auth) — best
// effort de seguridad adicional, recuperable ante fallo parcial.
//
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node admin-delete-player-account.mjs <playerId>
// Requiere `npm install` en este directorio (@supabase/supabase-js) antes de la primera corrida.
// NUNCA commitear credenciales — se leen exclusivamente de variables de entorno.
//
// Idempotencia de cada fase, pensada para que la operación completa sea reintentable después de
// un fallo parcial en cualquier punto (handoff §7.9):
//   - Fase 1: la RPC ya es idempotente por `players.deleted_at` (ver esa migración). El
//     `authUserId` capturado en la corrida original se relee desde `pilot_events` si el
//     reintento llega después de que `players.auth_user_id` ya quedó NULL.
//   - Fase 2: `list(playerId)` sobre un bucket ya vacío devuelve `[]` — un `remove([])` nunca se
//     invoca, no-op seguro.
//   - Fase 3: banear/eliminar una cuenta que ya no existe en Auth devuelve un error identificable
//     ("not found"/"does not exist") que este script trata como ÉXITO (el objetivo — que la
//     cuenta no exista — ya está cumplido), nunca como fallo.

const AVATAR_BUCKET = 'avatars';
// ~100 años — "permanente en la práctica" mientras se completa el resto del procedimiento, sin
// depender de una duración exacta arbitraria menor que pudiera vencer antes del borrado final.
const BAN_DURATION = '876000h';

/** Heurística de "la cuenta/objeto ya no existe" sobre el `message` de un error de la Auth Admin
 *  API — Supabase no expone un código estable único para esto en todas las versiones del SDK, así
 *  que se matchea contra las variantes de mensaje conocidas. Nunca se usa para silenciar un error
 *  real: solo colapsa a éxito el caso puntual "el objetivo de este paso ya estaba cumplido". */
function isAlreadyGoneError(error) {
  const msg = ((error && error.message) || '').toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist') || msg.includes('user not found');
}

/** Núcleo puro del orquestador — recibe el cliente Supabase (service_role) ya armado, nunca lo
 *  construye ni lee variables de entorno acá (eso vive solo en el bootstrap CLI, al final de este
 *  archivo) para que sea testeable con un cliente fabricado, sin depender de credenciales reales
 *  ni de que @supabase/supabase-js esté instalado (ver admin-delete-player-account.test.mjs). */
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

  // ---- FASE 3: Auth Admin API — banear + eliminar la cuenta. ----
  // Sin authUserId (cuenta que nunca tuvo sesión vinculada, o cuyo vínculo ya se perdió sin
  // auditoría recuperable): el acceso BRAMU YA está cortado por la Fase 1, que es la garantía
  // mínima real — esta fase se omite explícitamente, nunca falla el proceso completo por esto.
  if (!authUserId) {
    log('[account-deletion] Fase 3 (Auth) omitida: sin authUserId recuperable');
    return { ok: true, playerId, alreadyDeleted, authUserId: null, avatarFilesRemoved, authPhase: 'skipped_no_auth_user_id' };
  }

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

  log('[account-deletion] Fase 3 OK — cuenta Auth baneada y eliminada (o ya no existía)');
  return { ok: true, playerId, alreadyDeleted, authUserId, avatarFilesRemoved, authPhase: 'completed' };
}

/** Verificación de postcondición — separada de `runAccountDeletion` para que el bootstrap CLI
 *  pueda reportarla, y para que un test pueda ejercitarla de forma aislada. Nunca muta nada. */
export async function verifyAccountDeleted(supabaseAdmin, playerId) {
  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('deleted_at, auth_user_id, is_active')
    .eq('player_id', playerId)
    .maybeSingle();
  if (playerError) return { ok: false, error: playerError.message };
  if (!player) return { ok: false, code: 'player_not_found' };

  const { data: files, error: listError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).list(playerId);
  if (listError) return { ok: false, error: listError.message };

  return {
    ok: true,
    anonymized: !!player.deleted_at,
    authUnlinked: player.auth_user_id === null,
    inactiveInBramu: player.is_active === false,
    storageClean: Array.isArray(files) && files.length === 0,
  };
}

// ------------------------------------------------------------------
// Bootstrap CLI — SOLO corre cuando el archivo se invoca directamente como script (nunca al
// importar runAccountDeletion/verifyAccountDeleted desde un test). Único punto de este archivo
// que lee variables de entorno o importa @supabase/supabase-js.
// ------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
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

  if (result.ok) {
    const postcondition = await verifyAccountDeleted(supabaseAdmin, playerId);
    console.log('[account-deletion] Verificación post-condición:', JSON.stringify(postcondition, null, 2));
  }

  process.exit(result.ok ? 0 : 1);
}
