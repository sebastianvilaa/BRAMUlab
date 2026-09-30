// BRAMUlab — V04.20 (L3): núcleo PURO de la eliminación AUTOSERVICIO (Edge Function `delete-my-account`).
//
// Reglas (Privacidad_Legal.md §3, Issue #16 §D):
//   * la identidad sale SOLO del JWT de sesión (nunca del body: cualquier campo distinto de `confirm` => rechazo);
//   * REAUTENTICACIÓN RECIENTE: el JWT debe provenir de un OTP/recovery de email verificado hace <= 10 minutos
//     (claim `amr`), no de un login por contraseña ni de una sesión vieja;
//   * el player se resuelve server-side (resolve_player_for_account_deletion) — soporta el RETRY tras un fallo parcial;
//   * la eliminación la hace el MOTOR P0.3 existente (runAccountDeletion), nunca un segundo motor;
//   * la respuesta no contiene PII ni ids: solo estado y postcondiciones booleanas.

export const REAUTH_MAX_AGE_SECONDS = 10 * 60;
// Métodos de Supabase Auth que prueban CONTROL DEL EMAIL en ese instante (no "password").
const EMAIL_PROOF_METHODS = new Set(['otp', 'recovery', 'magiclink', 'email_change']);

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

/** true si el token trae una prueba de control del email (otp/recovery/...) con timestamp dentro de la ventana. */
export function isRecentEmailReauth(payload, nowMs, maxAgeSeconds = REAUTH_MAX_AGE_SECONDS) {
  if (!payload || !Array.isArray(payload.amr)) return false;
  const nowSec = Math.floor(nowMs / 1000);
  return payload.amr.some((a) => a && EMAIL_PROOF_METHODS.has(String(a.method)) && Number.isFinite(Number(a.timestamp))
    && nowSec - Number(a.timestamp) >= -60 && nowSec - Number(a.timestamp) <= maxAgeSeconds);
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
 * @param {()=>number} [deps.now]
 * @param {(jwt:string)=>Promise<{id:string}|null>} deps.getUser     Auth getUser(jwt)
 * @param {(authUserId:string)=>Promise<{ok:boolean,playerId?:string,code?:string}>} deps.resolvePlayer
 * @param {(playerId:string)=>Promise<object>} deps.runDeletion        runAccountDeletion(admin, playerId)
 * @param {(playerId:string, authUserId:string|null)=>Promise<object>} deps.verifyDeletion  verifyAccountDeleted(...)
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleSelfDeletion(deps) {
  const now = deps.now || (() => Date.now());
  const v = validateSelfDeleteBody(deps.body);
  if (!v.ok) return { status: 400, body: { ok: false, code: v.code } };

  if (!deps.jwt) return { status: 401, body: { ok: false, code: 'invalid_session' } };
  const user = await deps.getUser(deps.jwt);
  if (!user || !user.id) return { status: 401, body: { ok: false, code: 'invalid_session' } };

  if (!isRecentEmailReauth(decodeJwtPayload(deps.jwt), now())) {
    return { status: 403, body: { ok: false, code: 'recent_reauth_required' } };
  }

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
  return { status: 200, body: { ok: true, postconditions: pickPost(post) } };
}

function pickPost(post) {
  const out = {};
  ['anonymized', 'authUnlinked', 'inactiveInBramu', 'storageClean', 'groupStorageClean', 'authDeleted', 'auditPurged'].forEach((k) => { if (post && k in post) out[k] = !!post[k]; });
  return out;
}
