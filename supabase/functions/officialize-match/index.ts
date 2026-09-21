// BRAMUlab — Backend Bloque 6: oficialización explícita ("Confirmar").
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md §3.1.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string }
//
// Dos casos, MISMO endpoint — nunca dos lógicas paralelas (04_Revision_ChatGPT.md §10):
//   1) matches.action_side ya es NULL (la conformidad rival ya quedó registrada — por Bloque 5,
//      o por este mismo endpoint llamado un instante antes por otro participante): oficializa
//      directo.
//   2) matches.action_side todavía es el equipo del caller (es su turno real de responder):
//      registra su conformidad con el MISMO score vigente vía create_or_attach_match (Bloque 5,
//      RPC ya existente, NUNCA reimplementada acá) y, si eso deja action_side=NULL, oficializa
//      en la misma llamada.
//
// El "reintento silencioso" que el cliente dispara al detectar readyForValidation=true en una
// lectura (self-healing sin cron, 02_Analisis_Claude.md §3.1) llama a este mismo endpoint con
// solo matchId — cae siempre en el caso 1.

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

  const { data: callerRow } = await serviceClient
    .from('match_participants')
    .select('team')
    .eq('match_id', matchId)
    .eq('player_id', callerPlayerId)
    .maybeSingle();
  if (!callerRow) return jsonResponse({ ok: false, code: 'not_a_participant' }, 403);

  const { data: matchRow } = await serviceClient
    .from('matches')
    .select('status, action_side')
    .eq('match_id', matchId)
    .maybeSingle();
  if (!matchRow) return jsonResponse({ ok: false, code: 'match_not_found' }, 404);
  if (matchRow.status !== 'pending_validation') {
    return jsonResponse({ ok: false, code: 'match_not_actionable', status: matchRow.status }, 409);
  }

  if (matchRow.action_side === callerRow.team) {
    // Caso 2: es el turno real del caller. Reconstruye el envío desde la revisión vigente y lo
    // resubmite vía create_or_attach_match (Bloque 5) — el mismo mecanismo que ya usa cualquier
    // carga, nunca reimplementado acá.
    const { data: setsRows } = await serviceClient
      .from('match_sets')
      .select('set_number,games_a,games_b,tiebreak_a,tiebreak_b')
      .eq('match_id', matchId)
      .order('set_number');
    const { data: participantsRows } = await serviceClient
      .from('match_participants')
      .select('team,position_in_team,player_id')
      .eq('match_id', matchId)
      .order('team')
      .order('position_in_team');
    const { data: matchMeta } = await serviceClient
      .from('matches')
      .select('played_at,played_at_time_known,format_id,scoring_system,reported_time_zone,location_name,location_lat,location_lng')
      .eq('match_id', matchId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const teamA = (participantsRows || []).filter((p: any) => p.team === 'A').map((p: any) => p.player_id);
    // deno-lint-ignore no-explicit-any
    const teamB = (participantsRows || []).filter((p: any) => p.team === 'B').map((p: any) => p.player_id);

    if (teamA.length !== 2 || teamB.length !== 2 || teamA.some((id: unknown) => !id) || teamB.some((id: unknown) => !id)) {
      // Un slot sin player_id (incidencia de identidad abierta) no puede resubmitirse por este
      // camino — el detalle del partido debe estar mostrando la incidencia, no "Confirmar".
      return jsonResponse({ ok: false, code: 'unidentified_slot_present' }, 409);
    }

    const { data: confirmResult, error: confirmError } = await serviceClient.rpc('create_or_attach_match', {
      p_auth_user_id: authUserId,
      p_idempotency_key: crypto.randomUUID(),
      p_pair1_player_id_1: teamA[0],
      p_pair1_player_id_2: teamA[1],
      p_pair2_player_id_1: teamB[0],
      p_pair2_player_id_2: teamB[1],
      p_played_at: matchMeta?.played_at,
      p_played_at_time_known: matchMeta?.played_at_time_known,
      p_format_id: matchMeta?.format_id,
      // deno-lint-ignore no-explicit-any
      p_sets: (setsRows || []).map((s: any) => ({
        gamesA: s.games_a,
        gamesB: s.games_b,
        tiebreakA: s.tiebreak_a,
        tiebreakB: s.tiebreak_b,
      })),
      p_reported_time_zone: matchMeta?.reported_time_zone || null,
      p_scoring_system: matchMeta?.scoring_system || null,
      p_location_name: matchMeta?.location_name || null,
      p_location_lat: matchMeta?.location_lat || null,
      p_location_lng: matchMeta?.location_lng || null,
    });

    if (confirmError || !confirmResult || confirmResult.ok === false) {
      return jsonResponse({ ok: false, code: 'confirm_failed', detail: confirmResult }, 500);
    }
    if (!confirmResult.readyForValidation) {
      // No debería pasar (confirmar exactamente el mismo score vigente siempre libera
      // action_side) — se devuelve sin oficializar; el cliente puede releer/reintentar.
      return jsonResponse({ ok: true, code: 'confirmed_not_ready', matchId });
    }
  }

  const result = await officializeMatch(serviceClient, matchId, 'initial', callerPlayerId, null);
  if (!result.ok) {
    return jsonResponse({ ok: false, code: result.code || 'officialize_failed' }, 500);
  }
  return jsonResponse({ ok: true, code: 'officialized', matchId, resultId: result.resultId, eligible: result.eligible });
});
