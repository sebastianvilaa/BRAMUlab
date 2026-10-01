// BRAMUlab — G1 Emails V1 (handoff 89 §5.3/§5.4/§6): núcleo PURO de los desafíos sensibles (cambio de email en DOS verificaciones
// y eliminación `delete_account`). Lo usa la Edge Function `account-challenge`; la decisión de negocio vive acá y se testea en Node
// con dependencias inyectadas (y contra la base real replayada en PGlite). La persistencia/estado está en las RPC de
// 20261001100000_g1_emails_account_challenges.sql (service_role únicamente).
//
// Reglas:
//   * identidad SOLO del JWT (Auth getUser): el body NUNCA trae userId/email actual (cualquier clave desconocida => 400);
//   * el email actual lo aporta Auth; el email nuevo solo se acepta en `change_email_new`, después de `change_email_current` verificado;
//   * el OTP se genera acá, se envía por email y se persiste SOLO su HMAC (nunca vuelve en respuestas ni en logs);
//   * el cambio real lo hace `updateAuthEmail` (Auth Admin) únicamente tras las DOS verificaciones; luego cierra las demás sesiones y
//     envía el aviso #5 al email ANTERIOR (claim idempotente);
//   * respuestas sin PII: solo estado/códigos.

export const PURPOSES = ['change_email_current', 'change_email_new', 'delete_account'];
/** purpose -> id del email (handoff 89 §1). */
export const EMAIL_FOR_PURPOSE = { change_email_current: 3, change_email_new: 4, delete_account: 7 };
export const CODE_TTL_SECONDS = 3600;
export const RESEND_AFTER_SECONDS = 60;

const STATUS = {
  invalid_payload: 400, invalid_email: 400, same_email: 400, code_invalid: 400, invalid_input: 400,
  invalid_session: 401,
  current_verification_required: 403, new_verification_required: 403,
  email_taken: 409,
  code_expired: 410,
  resend_too_soon: 429, rate_limited: 429, too_many_attempts: 429,
  send_failed: 502, change_incomplete: 502,
  mailer_not_configured: 503, challenge_not_configured: 503, unavailable: 503,
};
const fail = (code, extra = {}) => ({ status: STATUS[code] || 400, body: { ok: false, code, ...extra } });

/** Claves permitidas por acción. Todo lo demás (email, userId, playerId, to...) se rechaza: el destino NUNCA viene del body. */
export function validateBody(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false };
  const keys = Object.keys(body);
  const { action, purpose } = body;
  if (action === 'request') {
    if (!PURPOSES.includes(purpose)) return { ok: false };
    const allowed = purpose === 'change_email_new' ? ['action', 'purpose', 'newEmail'] : ['action', 'purpose'];
    if (keys.some((k) => !allowed.includes(k))) return { ok: false };
    if (purpose === 'change_email_new' && (typeof body.newEmail !== 'string' || !body.newEmail.trim() || body.newEmail.length > 254)) return { ok: false };
    return { ok: true, action, purpose, newEmail: purpose === 'change_email_new' ? body.newEmail.trim().toLowerCase() : null };
  }
  if (action === 'verify') {
    if (!PURPOSES.includes(purpose)) return { ok: false };
    if (keys.some((k) => !['action', 'purpose', 'code'].includes(k))) return { ok: false };
    if (typeof body.code !== 'string' || !/^[0-9]{6}$/.test(body.code)) return { ok: false, code: 'code_invalid' };
    return { ok: true, action, purpose, code: body.code };
  }
  if (action === 'complete_email_change') {
    if (keys.some((k) => k !== 'action')) return { ok: false };
    return { ok: true, action };
  }
  return { ok: false };
}

/** Reintentos acotados (envío SMTP). `sleep` inyectable para tests. */
export async function withRetries(fn, { attempts = 3, delayMs = 400, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let last = { ok: false };
  for (let i = 0; i < attempts; i += 1) {
    try { last = await fn(i); } catch (_e) { last = { ok: false }; }
    if (last && last.ok) return last;
    if (i < attempts - 1) await sleep(delayMs * (i + 1));
  }
  return last || { ok: false };
}

const callRpc = async (deps, name, args) => {
  try {
    const { data, error } = await deps.rpc(name, args);
    if (error) return { ok: false, code: 'unavailable' };
    return { ok: true, data };
  } catch (_e) {
    return { ok: false, code: 'unavailable' };
  }
};

/**
 * @param {object} deps
 * @param {string} deps.jwt
 * @param {unknown} deps.body
 * @param {(jwt:string)=>Promise<{id:string,email?:string|null}|null>} deps.getUser     Auth getUser(jwt) — fuente del email ACTUAL
 * @param {(name:string,args:object)=>Promise<{data:any,error:any}>} deps.rpc          RPC service_role
 * @param {(message:string)=>Promise<string>} deps.hmac                                HMAC-SHA256 hex con el secreto del entorno
 * @param {()=>string} deps.randomCode                                                 6 dígitos criptográficos
 * @param {(m:{emailId:number,to:string,code?:string,previousEmail?:string,newEmail?:string})=>Promise<{ok:boolean,code?:string}>} deps.sendMail
 * @param {(userId:string,action:string,max:number,windowSeconds:number)=>Promise<boolean>} deps.rateLimit
 * @param {(userId:string,newEmail:string)=>Promise<{ok:boolean,code?:string}>} deps.updateAuthEmail   Auth Admin updateUserById
 * @param {(jwt:string)=>Promise<boolean>} deps.signOutOthers                          Auth Admin signOut(jwt,'others')
 * @param {(code:string)=>void} [deps.log]                                             solo códigos, sin PII
 * @param {(ms:number)=>Promise<void>} [deps.sleep]
 */
export async function handleAccountChallenge(deps) {
  const log = deps.log || (() => {});
  const v = validateBody(deps.body);
  if (!v.ok) return fail(v.code === 'code_invalid' ? 'code_invalid' : 'invalid_payload');
  if (!deps.jwt) return fail('invalid_session');
  const user = await deps.getUser(deps.jwt);
  if (!user || !user.id) return fail('invalid_session');
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (!email) return fail('invalid_session');

  if (v.action === 'request') return requestChallenge(deps, user.id, email, v, log);
  if (v.action === 'verify') return verifyChallenge(deps, user.id, email, v, log);
  return completeEmailChange(deps, user.id, email, log);
}

async function requestChallenge(deps, userId, email, v, log) {
  if (!(await deps.rateLimit(userId, 'account_challenge_request', 10, 3600))) return fail('rate_limited');
  const code = deps.randomCode();
  const codeHash = await deps.hmac(`${v.purpose}:${userId}:${code}`);
  const isNew = v.purpose === 'change_email_new';
  const issued = await callRpc(deps, 'account_challenge_issue', {
    p_auth_user_id: userId, p_purpose: v.purpose, p_code_hash: codeHash,
    p_target_email: isNew ? v.newEmail : null, p_previous_email: isNew ? email : null,
  });
  if (!issued.ok) return fail('unavailable');
  if (!issued.data || issued.data.ok !== true) {
    const c = (issued.data && issued.data.code) || 'unavailable';
    return fail(c, issued.data && issued.data.retryAfterSeconds ? { retryAfterSeconds: issued.data.retryAfterSeconds } : {});
  }
  // Destino derivado server-side: el email ACTUAL (Auth) o, en el segundo paso, el nuevo ya validado/normalizado por la RPC.
  const to = isNew ? v.newEmail : email;
  const sent = await withRetries(() => deps.sendMail({ emailId: EMAIL_FOR_PURPOSE[v.purpose], to, code }), { attempts: 2, delayMs: 300, sleep: deps.sleep });
  if (!sent.ok) {
    // sin desafío fantasma: se revoca y se libera el cupo de reenvío
    await callRpc(deps, 'account_challenge_revoke', { p_auth_user_id: userId, p_challenge_id: issued.data.challengeId });
    log(`send_failed:${sent.code || 'transport'}`);
    return fail(sent.code === 'mailer_not_configured' ? 'mailer_not_configured' : 'send_failed', { retryable: true });
  }
  return { status: 200, body: { ok: true, expiresInSeconds: CODE_TTL_SECONDS, resendAfterSeconds: RESEND_AFTER_SECONDS } };
}

async function verifyChallenge(deps, userId, email, v, log) {
  if (!(await deps.rateLimit(userId, 'account_challenge_verify', 30, 3600))) return fail('rate_limited');
  const codeHash = await deps.hmac(`${v.purpose}:${userId}:${v.code}`);
  const r = await callRpc(deps, 'account_challenge_verify', { p_auth_user_id: userId, p_purpose: v.purpose, p_code_hash: codeHash });
  if (!r.ok) return fail('unavailable');
  if (!r.data || r.data.ok !== true) {
    const c = (r.data && r.data.code) || 'code_invalid';
    return fail(c, r.data && r.data.attemptsLeft !== undefined ? { attemptsLeft: r.data.attemptsLeft } : {});
  }
  if (v.purpose === 'change_email_current') return { status: 200, body: { ok: true, next: 'new_email' } };
  if (v.purpose === 'delete_account') return { status: 200, body: { ok: true, next: 'confirm_delete' } };
  // change_email_new: las DOS verificaciones están => cambio real
  return completeEmailChange(deps, userId, email, log);
}

/** Idempotente/reintentable: si el cambio quedó a medias (Auth ya cambió pero faltó consumir) el mismo paso lo termina. */
async function completeEmailChange(deps, userId, currentEmail, log) {
  const prep = await callRpc(deps, 'account_email_change_prepare', { p_auth_user_id: userId });
  if (!prep.ok) return fail('unavailable');
  if (!prep.data || prep.data.ok !== true) return fail((prep.data && prep.data.code) || 'new_verification_required');
  const { challengeId, newEmail, previousEmail } = prep.data;
  if (!challengeId || !newEmail || !previousEmail) return fail('new_verification_required');

  if (currentEmail !== String(newEmail).toLowerCase()) {
    const upd = await deps.updateAuthEmail(userId, newEmail);
    if (!upd || !upd.ok) {
      log(`auth_email_update_failed:${(upd && upd.code) || 'unknown'}`);
      if (upd && upd.code === 'email_taken') return fail('email_taken');
      return fail('change_incomplete', { retryable: true });
    }
  }

  const fin = await callRpc(deps, 'account_email_change_finalize', { p_auth_user_id: userId, p_challenge_id: challengeId });
  if (!fin.ok) return fail('change_incomplete', { retryable: true });

  // Cierra las DEMÁS sesiones (contrato). Si no se pudo, se informa para que el cliente intente el cierre por su cuenta.
  let othersSignedOut = false;
  try { othersSignedOut = !!(await deps.signOutOthers(deps.jwt)); } catch (_e) { othersSignedOut = false; }

  // Aviso #5 al email ANTERIOR — claim atómico: un solo envío aunque haya reintentos/concurrencia.
  let notice = 'duplicate';
  if (fin.data === true) {
    const claim = await callRpc(deps, 'account_receipt_claim', { p_auth_user_id: userId, p_challenge_id: challengeId });
    if (claim.ok && claim.data && claim.data.claimed) {
      const sent = await withRetries(() => deps.sendMail({ emailId: 5, to: previousEmail, previousEmail, newEmail }), { attempts: 3, delayMs: 400, sleep: deps.sleep });
      if (sent.ok) {
        notice = 'sent';
        await callRpc(deps, 'account_challenge_scrub', { p_auth_user_id: userId, p_challenge_id: challengeId });
      } else {
        notice = 'failed';
        log(`changed_notice_failed:${sent.code || 'transport'}`);
        await callRpc(deps, 'account_receipt_release', { p_auth_user_id: userId, p_challenge_id: challengeId });
      }
    }
  }
  return { status: 200, body: { ok: true, emailChanged: true, othersSignedOut, notice } };
}

/**
 * Email #8 (comprobante) — SOLO se invoca después de que la eliminación pasó sus postcondiciones reales (ver self-delete-core).
 * Claim atómico (un solo envío aunque haya reintentos/concurrencia) + reintentos acotados + purga de TODO lo del usuario en
 * `account_challenges`. Un fallo del envío no revierte nada: se informa 'failed' y se registra solo el código.
 * @param {{rpc:Function,sendMail:Function,log?:Function,sleep?:Function}} deps
 * @returns {Promise<'sent'|'failed'|'duplicate'|'skipped'>}
 */
export async function finishDeletionReceipt(deps, { authUserId, challengeId, email }) {
  const log = deps.log || (() => {});
  let status = 'skipped';
  try {
    if (email) {
      const claim = await callRpc(deps, 'account_receipt_claim', { p_auth_user_id: authUserId, p_challenge_id: challengeId });
      if (claim.ok && claim.data && claim.data.claimed) {
        const sent = await withRetries(() => deps.sendMail({ emailId: 8, to: email }), { attempts: 3, delayMs: 400, sleep: deps.sleep });
        status = sent.ok ? 'sent' : 'failed';
        if (!sent.ok) log(`deletion_receipt_failed:${sent.code || 'transport'}`);
      } else {
        status = 'duplicate';
      }
    }
  } catch (_e) {
    status = 'failed';
  } finally {
    await callRpc(deps, 'account_challenges_purge_user', { p_auth_user_id: authUserId });
  }
  return status;
}
