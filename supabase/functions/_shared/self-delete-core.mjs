// BRAMUlab — V04.20 (L3): núcleo PURO de la eliminación AUTOSERVICIO (Edge Function `delete-my-account`).
//
// Reglas (Privacidad_Legal.md §3, Issue #16 §D; G1 / handoff 89 §5.4):
//   * la identidad sale SOLO del JWT de sesión (nunca del body: cualquier campo distinto de `confirm` => rechazo);
//   * PRUEBA ESPECÍFICA `delete_account` (G1): el usuario verificó, hace <= 10 minutos, el OTP del email #7 emitido para ESA acción
//     (RPC `account_delete_proof_check`). Una reautenticación genérica (OTP de signup/recovery/magiclink/email_change, claim `amr`)
//     YA NO alcanza: un recovery pedido para otra cosa no puede disparar la eliminación;
//   * el player se resuelve server-side (resolve_player_for_account_deletion) — soporta el RETRY tras un fallo parcial;
//   * la eliminación la hace el MOTOR P0.3 existente (runAccountDeletion), nunca un segundo motor;
//   * la respuesta no contiene PII ni ids: solo estado y postcondiciones booleanas.

// Antigüedad máxima de la prueba `delete_account` verificada (el reintento tras un fallo parcial la reutiliza mientras siga reciente).
export const DELETE_PROOF_MAX_AGE_SECONDS = 10 * 60;

export function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
    return JSON.parse(decodeURIComponent(Array.prototype.map.call(json, (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  } catch (_e) {
    return null;
  }
}

/** El body solo puede ser `{}` o `{ confirm: true }` — cualquier otra clave (player_id, email, userId...) se rechaza. */
export function validateSelfDeleteBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'invalid_payload' };
  const keys = Object.keys(body);
  if (keys.some((k) => k !== 'confirm')) return { ok: false, code: 'invalid_payload' };
  if (body.confirm !== true) return { ok: false, code: 'confirmation_required' };
  return { ok: true };
}

/**
 * @param {object} deps
 * @param {string} deps.jwt                                   access token del caller (sin "Bearer")
 * @param {unknown} deps.body                                 body JSON parseado
 * @param {(jwt:string)=>Promise<{id:string,email?:string|null}|null>} deps.getUser     Auth getUser(jwt) — el email de destino del #8 se captura ACÁ, antes de borrar Auth
 * @param {(authUserId:string)=>Promise<{ok:boolean,challengeId?:string}>} deps.checkDeleteProof   prueba `delete_account` verificada y reciente
 * @param {(m:{authUserId:string,challengeId:string,email:string})=>Promise<'sent'|'failed'|'duplicate'|'skipped'>} [deps.finishReceipt]   claim + envío del #8 + purga (SOLO tras postcondiciones OK)
 * @param {(authUserId:string)=>Promise<{ok:boolean,playerId?:string,code?:string}>} deps.resolvePlayer
 * @param {(playerId:string)=>Promise<object>} deps.runDeletion        runAccountDeletion(admin, playerId)
 * @param {(playerId:string, authUserId:string|null)=>Promise<object>} deps.verifyDeletion  verifyAccountDeleted(...)
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleSelfDeletion(deps) {
  const v = validateSelfDeleteBody(deps.body);
  if (!v.ok) return { status: 400, body: { ok: false, code: v.code } };

  if (!deps.jwt) return { status: 401, body: { ok: false, code: 'invalid_session' } };
  const user = await deps.getUser(deps.jwt);
  if (!user || !user.id) return { status: 401, body: { ok: false, code: 'invalid_session' } };

  const proof = await deps.checkDeleteProof(user.id);
  if (!proof || proof.ok !== true || !proof.challengeId) {
    return { status: 403, body: { ok: false, code: 'delete_challenge_required' } };
  }
  // Email de destino del comprobante: se captura AHORA (después de borrar Auth ya no existe). Nunca viaja en la respuesta.
  const receiptEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';

  const resolved = await deps.resolvePlayer(user.id);
  if (!resolved || !resolved.ok || !resolved.playerId) {
    return { status: 404, body: { ok: false, code: 'account_not_found' } };
  }

  const result = await deps.runDeletion(resolved.playerId);
  if (!result || !result.ok) {
    // Fallo parcial: reintentable (el motor es idempotente por fase). Solo se informa la fase, sin ids/PII.
    return { status: 500, body: { ok: false, code: 'deletion_incomplete', step: (result && result.step) || 'unknown', retryable: true } };
  }
  const post = await deps.verifyDeletion(resolved.playerId, result.authUserId || user.id);
  if (!post || !post.ok) {
    return { status: 500, body: { ok: false, code: 'postcondition_failed', retryable: true, postconditions: pickPost(post) } };
  }
  // Email #8 SOLO ahora: eliminación + postcondiciones reales OK. Un fallo del envío NUNCA revierte ni falla la eliminación.
  let receipt = 'skipped';
  if (deps.finishReceipt) {
    try { receipt = await deps.finishReceipt({ authUserId: user.id, challengeId: proof.challengeId, email: receiptEmail }); } catch (_e) { receipt = 'failed'; }
  }
  return { status: 200, body: { ok: true, postconditions: pickPost(post), receipt } };
}

function pickPost(post) {
  const out = {};
  ['anonymized', 'authUnlinked', 'inactiveInBramu', 'storageClean', 'groupStorageClean', 'authDeleted', 'auditPurged'].forEach((k) => { if (post && k in post) out[k] = !!post[k]; });
  return out;
}
