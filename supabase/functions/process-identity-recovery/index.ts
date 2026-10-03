// BRAMUlab — V04.29: procesa el Nivel recuperado de una vinculación de identidad (replay server-side).
//
// Ver docs/BRAMUlab/Implementacion/Pre_Production/116_* §4 y supabase/migrations/20261003110000_g3_identity_recovery_core.sql.
//
// Body (JSON), con el access token del usuario en Authorization: {} (procesa TODAS las recuperaciones del caller con Nivel
// pendiente) o { recoveryId: string } (solo esa, y solo si es del caller). El cliente NUNCA elige el jugador: el target
// siempre es el player de la sesión. Reutiliza el MISMO motor JS que officialize-match (symlinks reales a bramulab/*.js) —
// no hay fórmula nueva. Idempotente y reanudable: reintentar nunca duplica efectos (ledger UNIQUE (recovery_id, match_id) +
// lease por recuperación); si el target todavía no tiene Nivel base responde `pending_level` sin tocar nada.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withinRateLimit } from '../_shared/rate-limit.ts';
import '../_shared/engine.js';
import '../_shared/level.js';
import '../_shared/level-context.js';
import '../_shared/match-sync.js';
import '../_shared/match-level-engine.js';
import { processIdentityRecoveryLevel, processPendingRecoveriesForPlayer } from '../_shared/identity-recovery-core.mjs';

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

  // Verifica el JWT con el cliente ANON (nunca con la service role): impide invocar a nombre de otro usuario.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData || !userData.user) return jsonResponse({ ok: false, code: 'invalid_session' }, 401);
  const authUserId = userData.user.id;

  if (!(await withinRateLimit(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authUserId, 'edge_process_identity_recovery', 20, 600))) {
    return jsonResponse({ ok: false, code: 'rate_limited' }, 429);
  }

  // deno-lint-ignore no-explicit-any
  let payload: any = {};
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return jsonResponse({ ok: false, code: 'invalid_payload' }, 400);
  }
  const requestedRecoveryId = payload && payload.recoveryId;
  if (requestedRecoveryId != null && typeof requestedRecoveryId !== 'string') {
    return jsonResponse({ ok: false, code: 'invalid_payload' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: callerPlayer } = await serviceClient.from('players').select('player_id').eq('auth_user_id', authUserId).maybeSingle();
  if (!callerPlayer) return jsonResponse({ ok: false, code: 'no_player_for_user' }, 400);

  try {
    if (requestedRecoveryId) {
      // Solo una recuperación DEL caller: se verifica contra su lista de pendientes (nunca se confía en el id del cliente).
      const { data: own } = await serviceClient.rpc('list_identity_recoveries_pending_level', { p_target_player_id: callerPlayer.player_id });
      // deno-lint-ignore no-explicit-any
      if (!(own || []).some((r: any) => r.recovery_id === requestedRecoveryId)) {
        return jsonResponse({ ok: true, results: [] });
      }
      const result = await processIdentityRecoveryLevel(serviceClient, requestedRecoveryId);
      return jsonResponse({ ok: result.ok !== false, results: [{ ...result, recoveryId: requestedRecoveryId }] });
    }
    const all = await processPendingRecoveriesForPlayer(serviceClient, callerPlayer.player_id);
    return jsonResponse({ ok: all.ok !== false, results: all.results });
  } catch (e) {
    console.error('[process-identity-recovery] unexpected', { message: String((e as Error)?.message || e) });
    return jsonResponse({ ok: false, code: 'unexpected_error' }, 500);
  }
});
