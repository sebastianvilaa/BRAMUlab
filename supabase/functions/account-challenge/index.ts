// BRAMUlab — G1 Emails V1 (Issue #21): desafíos sensibles server-side para CAMBIO DE EMAIL (2 verificaciones) y ELIMINACIÓN.
//
//   POST  Authorization: Bearer <JWT de la sesión del usuario>
//     { action: 'request', purpose: 'change_email_current' | 'delete_account' }
//     { action: 'request', purpose: 'change_email_new', newEmail }          (solo con change_email_current verificado)
//     { action: 'verify',  purpose, code }                                  (change_email_new verificado => cambia el email)
//     { action: 'complete_email_change' }                                   (reintento idempotente de un cambio a medias)
//
// El destino del email y la identidad salen de Auth (JWT) — el body NUNCA los trae. Respuestas sin OTP ni emails.
// verify_jwt=true. Secrets: BRAMU_CHALLENGE_PEPPER (HMAC del OTP, >= 32 chars) + BRAMU_SMTP_* (ver _shared/mailer.ts).
// La decisión de negocio vive en ../_shared/account-challenge-core.mjs; el estado, en las RPC service_role de
// 20261001100000_g1_emails_account_challenges.sql.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleAccountChallenge } from '../_shared/account-challenge-core.mjs';
import { sendBramuEmail } from '../_shared/mailer.ts';
import { withinRateLimit } from '../_shared/rate-limit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmacHex(pepper: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}
/** 6 dígitos con sesgo cero (rechazo de muestreo sobre uint32). */
function randomCode(): string {
  const limit = 4294967296 - (4294967296 % 1000000);
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return String(buf[0] % 1000000).padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  const pepper = Deno.env.get('BRAMU_CHALLENGE_PEPPER') || '';
  if (pepper.length < 32) return jsonResponse({ ok: false, code: 'challenge_not_configured' }, 503);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { status, body: out } = await handleAccountChallenge({
      jwt,
      body,
      getUser: async (token: string) => {
        const { data, error } = await admin.auth.getUser(token);
        return error || !data?.user ? null : { id: data.user.id, email: data.user.email ?? null };
      },
      rpc: (name: string, args: Record<string, unknown>) => admin.rpc(name, args),
      hmac: (m: string) => hmacHex(pepper, m),
      randomCode,
      sendMail: sendBramuEmail,
      rateLimit: (userId: string, action: string, max: number, windowSeconds: number) =>
        withinRateLimit(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, userId, action, max, windowSeconds),
      updateAuthEmail: async (userId: string, newEmail: string) => {
        // email_confirm:true => ya está verificado por NUESTRO desafío (no dispara el flujo Secure Email Change nativo).
        const { error } = await admin.auth.admin.updateUserById(userId, { email: newEmail, email_confirm: true });
        if (!error) return { ok: true };
        const msg = String(error.message || '').toLowerCase();
        return { ok: false, code: msg.includes('already') || msg.includes('exists') || msg.includes('registered') ? 'email_taken' : 'auth_error' };
      },
      signOutOthers: async (token: string) => {
        const { error } = await admin.auth.admin.signOut(token, 'others');
        return !error;
      },
      log: (code: string) => console.error(`[account-challenge] ${code}`),
    });
    return jsonResponse(out, status);
  } catch (_e) {
    console.error('[account-challenge] unexpected failure');
    return jsonResponse({ ok: false, code: 'unavailable' }, 503);
  }
});
