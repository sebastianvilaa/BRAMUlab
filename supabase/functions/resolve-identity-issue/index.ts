// BRAMUlab — Backend Bloque 6: resolver (o vencer) una incidencia de identidad.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md §3.6.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { issueId: string, replacementPlayerId?: string, forceUnidentified?: boolean }
//
// resolve_identity_issue: si el partido sigue pending_validation, reasigna el slot o materializa
// el vencimiento DIRECTO (sin Nivel involucrado). Si el partido ya estaba validated (B6-A-09),
// SOLO autoriza (needsRecompute=true, code=*_authorized) — NO reasigna match_participants ni
// cierra la incidencia todavía. Esta Edge Function arma entonces `identityAction` y llama a la
// rutina compartida, que hace la reasignación + cierre de incidencia + reaplicación de Nivel del
// PARTIDO COMPLETO en UNA sola transacción dentro de officialize_match_validation — nunca queda
// una ventana donde la identidad ya cambió pero Nivel todavía no.

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

  const issueId = payload && payload.issueId;
  const replacementPlayerId = (payload && payload.replacementPlayerId) || null;
  const forceUnidentified = !!(payload && payload.forceUnidentified);
  if (!issueId || typeof issueId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_issue_id' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: result, error: rpcError } = await serviceClient.rpc('resolve_identity_issue', {
    p_auth_user_id: authUserId,
    p_issue_id: issueId,
    p_replacement_player_id: replacementPlayerId,
    p_force_unidentified: forceUnidentified,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, code: 'persist_failed', detail: rpcError.message }, 500);
  }
  if (!result || result.ok === false) {
    return jsonResponse(result || { ok: false, code: 'unknown_error' });
  }

  if (result.needsRecompute) {
    const { data: callerPlayer } = await serviceClient
      .from('players')
      .select('player_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    const isUnidentified = result.code === 'identity_unidentified_authorized';
    const trigger = isUnidentified ? 'identity_unidentified' : 'identity_resolved';
    const officialization = await officializeMatch(
      serviceClient,
      result.matchId,
      trigger,
      callerPlayer ? callerPlayer.player_id : null,
      null,
      {
        issueId,
        team: result.team,
        positionInTeam: result.positionInTeam,
        replacementPlayerId: isUnidentified ? null : result.replacementPlayerId,
      },
    );
    if (!officialization.ok) {
      // B6-A-09: NADA se persistió todavía (ni la reasignación del slot ni el cierre de la
      // incidencia) — la incidencia sigue exactamente open. El cliente puede reintentar este
      // mismo endpoint sin ningún riesgo de estado a medias.
      return jsonResponse({ ok: false, code: officialization.code || 'identity_recompute_failed', issueId, matchId: result.matchId });
    }
    return jsonResponse({
      ok: true,
      code: isUnidentified ? 'identity_unidentified' : 'identity_resolved',
      issueId,
      matchId: result.matchId,
      resultId: officialization.resultId,
      eligible: officialization.eligible,
    });
  }

  return jsonResponse(result);
});
