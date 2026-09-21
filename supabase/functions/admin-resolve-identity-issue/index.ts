// BRAMUlab — Backend Bloque 6: orquestación administrativa mínima de resolución de identidad.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.11,
// 04_Revision_ChatGPT.md §8, 10_Revision_Final_Pre_Staging_ChatGPT.md C-05}.
//
// Sin panel. Admin-only por diseño: EXIGE que el Authorization sea la service role key EXACTA,
// nunca un JWT de usuario — mismo criterio que admin_annul_match/admin_force_resolve_identity_issue
// (SOLO service_role, invocable exclusivamente desde un script/agente autorizado con la service
// role key en un entorno seguro, NUNCA pensado para que Sebastián maneje esa key o la pegue en
// el chat). No hay ningún otro mecanismo de autenticación posible acá — si el token no coincide,
// se rechaza sin tocar nada.
//
// Body esperado (JSON):
//   { issueId: string, replacementPlayerId: string, actorLabel: string, reason: string }
//
// admin_force_resolve_identity_issue (SQL) decide: si el partido sigue pending_validation,
// reasigna directo (sin Nivel involucrado). Si ya está validated (C-05), SOLO autoriza — esta
// Edge Function llama entonces al núcleo único de oficialización, que hace la reasignación + el
// refresco de fingerprint + la reaplicación de Nivel + el cierre de la incidencia en UNA sola
// transacción atómica (mismo patrón que resolve-identity-issue/index.ts para el camino normal).
// Un fallo entre la autorización y la oficialización deja la incidencia EXACTAMENTE open — el
// script puede reintentar esta misma llamada sin ningún riesgo de estado a medias.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { officializeMatch } from '../_shared/match-officialize-core.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
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
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  // Admin-only: exige la service role key EXACTA — nunca un JWT de usuario, nunca alcanzable
  // desde el cliente. No hay flujo de "olvidé mi permiso": quien no tiene la key no puede llamar
  // esta función, punto.
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, code: 'forbidden' }, 403);
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, code: 'invalid_payload' }, 400);
  }

  const issueId = payload && payload.issueId;
  const replacementPlayerId = payload && payload.replacementPlayerId;
  const actorLabel = payload && payload.actorLabel;
  const reason = payload && payload.reason;
  if (!issueId || typeof issueId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_issue_id' }, 400);
  }
  if (!replacementPlayerId || typeof replacementPlayerId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_replacement_player_id' }, 400);
  }
  if (!actorLabel || !reason) {
    return jsonResponse({ ok: false, code: 'actor_label_and_reason_required' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: result, error: rpcError } = await serviceClient.rpc('admin_force_resolve_identity_issue', {
    p_issue_id: issueId,
    p_replacement_player_id: replacementPlayerId,
    p_actor_label: actorLabel,
    p_reason: reason,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, code: 'persist_failed', detail: rpcError.message }, 500);
  }
  if (!result || result.ok === false) {
    return jsonResponse(result || { ok: false, code: 'unknown_error' });
  }

  if (result.needsRecompute) {
    const officialization = await officializeMatch(
      serviceClient,
      result.matchId,
      'identity_resolved',
      null,
      `admin:${actorLabel} — ${reason}`,
      {
        issueId,
        team: result.team,
        positionInTeam: result.positionInTeam,
        replacementPlayerId: result.replacementPlayerId,
      },
    );
    if (!officialization.ok) {
      // C-05: nada mutó todavía (la SQL solo autorizó) — la incidencia sigue exactamente open,
      // el script puede reintentar esta misma llamada sin ningún riesgo de estado a medias.
      return jsonResponse({ ok: false, code: officialization.code || 'identity_recompute_failed', issueId, matchId: result.matchId });
    }
    return jsonResponse({
      ok: true, code: 'identity_resolved', issueId, matchId: result.matchId,
      resultId: officialization.resultId, eligible: officialization.eligible,
    });
  }

  return jsonResponse(result);
});
