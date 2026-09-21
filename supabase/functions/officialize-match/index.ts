// BRAMUlab — Backend Bloque 6: oficialización explícita ("Confirmar").
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.1,
// 06_Revision_Fase_A_ChatGPT.md B6-A-06/B6-A-10, 10_Revision_Final_Pre_Staging_ChatGPT.md C-02/C-07}.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string }
//
// Dos casos, MISMO endpoint — nunca dos lógicas paralelas (04_Revision_ChatGPT.md §10):
//   1) matches.status ya es 'validated': idempotente (B6-A-10) — llama directo a la rutina
//      compartida, que a su vez es idempotente por (match_id, revision_id, trigger) dentro de
//      officialize_match_validation. Nunca se corta antes con match_not_actionable solo porque
//      ya está validated — el contrato explícito de Confirmar es poder reintentarse sin efecto
//      doble.
//   2) matches.status es 'pending_validation': confirm_match_validation (C-02, RPC B6 nativa)
//      registra la conformidad del caller SOLO si action_side es exactamente su equipo — nunca
//      reconstruye un create_or_attach_match (Bloque 5), que exigía 4 player_id no nulos y por
//      eso rechazaba con unidentified_slot_present un partido con un slot "Jugador no
//      identificado" terminal aunque la incidencia ya hubiera vencido (C-07: ese partido puede
//      seguir su camino normal a validated, con Nivel reducido o sin efecto según corresponda —
//      nunca se fabrica una identidad). Si readyForValidation=true, oficializa en la misma llamada.
//
// El "reintento silencioso" que el cliente dispara al detectar readyForValidation=true en una
// lectura (self-healing sin cron, 02_Analisis_Claude.md §3.1) llama a este mismo endpoint con
// solo matchId — cae siempre en el caso 1, o converge de nuevo al caso 2 si otro participante ya
// confirmó mientras tanto (idempotente).

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

  // Verifica el JWT del usuario con el cliente ANON (nunca con la service role acá) — mismo
  // criterio que officialize-onboarding/create-or-attach-match: impide que cualquiera invoque
  // esta función a nombre de otro usuario.
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
  if (!matchId || typeof matchId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_match_id' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: callerPlayer } = await serviceClient
    .from('players')
    .select('player_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (!callerPlayer) return jsonResponse({ ok: false, code: 'no_player_for_user' }, 400);
  const callerPlayerId = callerPlayer.player_id;

  const { data: matchRow } = await serviceClient
    .from('matches')
    .select('status')
    .eq('match_id', matchId)
    .maybeSingle();
  if (!matchRow) return jsonResponse({ ok: false, code: 'match_not_found' }, 404);

  // B6-A-10: 'validated' NUNCA es match_not_actionable acá — es exactamente el reintento
  // idempotente que el propio contrato de este endpoint promete.
  if (matchRow.status !== 'pending_validation' && matchRow.status !== 'validated') {
    return jsonResponse({ ok: false, code: 'match_not_actionable', status: matchRow.status }, 409);
  }

  if (matchRow.status === 'pending_validation') {
    // C-02: confirm_match_validation exige bajo lock que action_side sea EXACTAMENTE el equipo
    // del caller — nunca deja que el lado proponente oficialice antes de la conformidad rival.
    const { data: confirmResult, error: confirmError } = await serviceClient.rpc('confirm_match_validation', {
      p_auth_user_id: authUserId,
      p_match_id: matchId,
    });
    if (confirmError) {
      return jsonResponse({ ok: false, code: 'confirm_failed', detail: confirmError.message }, 500);
    }
    if (!confirmResult || confirmResult.ok === false) {
      return jsonResponse(confirmResult || { ok: false, code: 'unknown_error' });
    }
    if (!confirmResult.readyForValidation) {
      // No debería pasar (confirm_match_validation solo devuelve ok:true con
      // readyForValidation=true o false explícito antes de eso) — se devuelve sin oficializar.
      return jsonResponse({ ok: true, code: 'confirmed_not_ready', matchId });
    }
  }

  const result = await officializeMatch(serviceClient, matchId, 'initial', callerPlayerId, null);
  if (!result.ok) {
    return jsonResponse({ ok: false, code: result.code || 'officialize_failed' }, 500);
  }
  return jsonResponse({ ok: true, code: 'officialized', matchId, resultId: result.resultId, eligible: result.eligible });
});
