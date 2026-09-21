// BRAMUlab — Backend Bloque 6: aceptar/rechazar la corrección post-validación propuesta.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md §3.4.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string, accept: boolean }
//
// respond_post_validation_correction (SQL puro) solo mueve el puntero de revisión. Si
// accept=true y quedó aceptada, esta Edge Function invoca acá mismo la rutina compartida de
// oficialización (trigger='correction_accepted') para reaplicar Nivel — nunca dos lógicas
// paralelas (04_Revision_ChatGPT.md §10).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { officializeMatch } from '../_shared/match-officialize-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return jsonResponse({ ok: false, code: 'missing_authorization' }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData || !userData.user) {
    return jsonResponse({ ok: false, code: 'invalid_session' }, 401);
  }
  const authUserId = userData.user.id;

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, code: 'invalid_payload' }, 400);
  }

  const matchId = payload && payload.matchId;
  const accept = !!(payload && payload.accept);
  if (!matchId || typeof matchId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_match_id' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: result, error: rpcError } = await serviceClient.rpc('respond_post_validation_correction', {
    p_auth_user_id: authUserId,
    p_match_id: matchId,
    p_accept: accept,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, code: 'persist_failed', detail: rpcError.message }, 500);
  }
  if (!result || result.ok === false) {
    return jsonResponse(result || { ok: false, code: 'unknown_error' });
  }

  if (result.code === 'correction_authorized') {
    // B6-A-08: respond_post_validation_correction SOLO autorizó — todavía no movió
    // current_revision_id/pending_correction_revision_id. officializeMatch (trigger=
    // correction_accepted) hace, en UNA sola transacción dentro de officialize_match_validation,
    // el revert+reapply de Nivel Y el movimiento del puntero de revisión — nunca queda una
    // ventana donde el resultado oficial ya cambió pero Nivel todavía no.
    const { data: callerPlayer } = await serviceClient
      .from('players')
      .select('player_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const officialization = await officializeMatch(
      serviceClient,
      matchId,
      'correction_accepted',
      callerPlayer ? callerPlayer.player_id : null,
      null,
    );
    if (!officialization.ok) {
      // Ni el puntero de revisión ni Nivel se movieron todavía (atómico dentro de la RPC) — el
      // partido sigue con pending_correction_revision_id intacto. El cliente puede reintentar
      // (mismo endpoint) sin ningún riesgo de doble efecto.
      return jsonResponse({ ok: false, code: officialization.code || 'correction_recompute_failed', matchId });
    }
    return jsonResponse({ ok: true, code: 'correction_accepted', matchId, resultId: officialization.resultId, eligible: officialization.eligible });
  }

  return jsonResponse(result);
});
