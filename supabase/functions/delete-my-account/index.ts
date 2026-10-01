// BRAMUlab — V04.20 (L3): eliminación de cuenta AUTOSERVICIO.
//
// REUTILIZA el motor P0.3 (admin_delete_player_account + Storage + Auth Admin API + finalize) vía
// ../_shared/account-deletion-core.mjs — no existe un segundo motor. La decisión de negocio vive en
// ../_shared/self-delete-core.mjs (testeada en Node con fakes).
//
// Contrato:
//   POST  Authorization: Bearer <JWT de la sesión del usuario>   body: { "confirm": true }
//   * el player se resuelve server-side desde el JWT; el body NUNCA elige player_id/email (otro campo => 400);
//   * exige la prueba ESPECÍFICA `delete_account` (OTP del email #7 verificado hace <= 10 min, ver `account-challenge`)
//     => 403 delete_challenge_required; una reautenticación genérica (recovery/otp/...) ya NO alcanza (G1, handoff 89 §5.4);
//   * Email #8 (comprobante) SOLO tras las postcondiciones reales de la eliminación, con claim idempotente; un fallo del envío no revierte;
//   * idempotente/reintentable: tras un fallo parcial el mismo JWT puede reintentar (se resuelve por la auditoría);
//   * la respuesta solo trae estado, postcondiciones booleanas y el estado del comprobante (sin PII).
// Se despliega con verify_jwt=true (JWT de usuario válido requerido por el gateway); la función además lo valida.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runAccountDeletion, verifyAccountDeleted } from '../_shared/account-deletion-core.mjs';
import { handleSelfDeletion } from '../_shared/self-delete-core.mjs';
import { finishDeletionReceipt } from '../_shared/account-challenge-core.mjs';
import { sendBramuEmail } from '../_shared/mailer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { status, body: out } = await handleSelfDeletion({
      jwt,
      body,
      getUser: async (token: string) => {
        const { data, error } = await admin.auth.getUser(token);
        return error || !data?.user ? null : { id: data.user.id, email: data.user.email ?? null };
      },
      checkDeleteProof: async (authUserId: string) => {
        const { data, error } = await admin.rpc('account_delete_proof_check', { p_auth_user_id: authUserId, p_max_age_seconds: 600 });
        return error ? { ok: false } : data;
      },
      finishReceipt: ({ authUserId, challengeId, email }: { authUserId: string; challengeId: string; email: string }) =>
        finishDeletionReceipt(
          { rpc: (n: string, a: Record<string, unknown>) => admin.rpc(n, a), sendMail: sendBramuEmail, log: (c: string) => console.error(`[delete-my-account] ${c}`) },
          { authUserId, challengeId, email },
        ),
      resolvePlayer: async (authUserId: string) => {
        const { data, error } = await admin.rpc('resolve_player_for_account_deletion', { p_auth_user_id: authUserId });
        return error ? { ok: false } : data;
      },
      runDeletion: (playerId: string) => runAccountDeletion(admin, playerId, {}),
      verifyDeletion: (playerId: string, authUserId: string | null) => verifyAccountDeleted(admin, playerId, authUserId),
    });
    return jsonResponse(out, status);
  } catch (_e) {
    console.error('[delete-my-account] unexpected failure');
    return jsonResponse({ ok: false, code: 'deletion_incomplete', retryable: true }, 500);
  }
});
