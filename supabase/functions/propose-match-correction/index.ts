// BRAMUlab — Backend Bloque 6: "Proponer corrección" post-validación.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md §3.4.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string, sets: [{gamesA:number, gamesB:number}, ...] (1 a 3) }
//
// A diferencia de create-or-attach-match, acá NO hay canonicalización de pareja: el partido ya
// existe con team_a/team_b FIJOS desde su creación — los sets llegan directamente en esos
// términos (los mismos que ya muestra el detalle del partido), sin ambigüedad de orientación.
//
// Mismo patrón que create-or-attach-match: revalida legalidad de sets con el MISMO motor
// (engine.js/match-load.js, symlinks reales) antes de llamar a la RPC privada — nunca
// reimplementado en SQL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import '../_shared/engine.js';
import '../_shared/match-load.js';

// deno-lint-ignore no-explicit-any
const ML = (globalThis as any).PLMatchLoad;

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

// deno-lint-ignore no-explicit-any
function tiebreakField(tb: any, side: 'a' | 'b'): number | null {
  if (!tb) return null;
  const v = side === 'a' ? tb.a : tb.b;
  return Number.isFinite(v) ? v : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  if (!ML || typeof ML.validateMatchSets !== 'function') {
    return jsonResponse({ ok: false, code: 'engine_unavailable' }, 500);
  }

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
  const sets = payload && Array.isArray(payload.sets) ? payload.sets : null;
  if (!matchId || typeof matchId !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_match_id' }, 400);
  }
  if (!sets || sets.length < 1) {
    return jsonResponse({ ok: false, code: 'invalid_sets' }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: matchRow } = await serviceClient
    .from('matches')
    .select('format_id')
    .eq('match_id', matchId)
    .maybeSingle();
  if (!matchRow) return jsonResponse({ ok: false, code: 'match_not_found' }, 404);

  // deno-lint-ignore no-explicit-any
  const rawSets = sets.map((s: any) => ({ a: s.gamesA, b: s.gamesB }));
  const validated = ML.validateMatchSets(rawSets, matchRow.format_id);
  if (!validated.ok) {
    return jsonResponse({ ok: false, code: `invalid_sets_${validated.reason}` }, 400);
  }

  // deno-lint-ignore no-explicit-any
  const setsForRpc = validated.sets.map((s: { gamesA: number; gamesB: number; tiebreak: unknown }) => ({
    gamesA: s.gamesA,
    gamesB: s.gamesB,
    tiebreakA: tiebreakField(s.tiebreak, 'a'),
    tiebreakB: tiebreakField(s.tiebreak, 'b'),
  }));

  const { data: result, error: rpcError } = await serviceClient.rpc('propose_post_validation_correction', {
    p_auth_user_id: authUserId,
    p_match_id: matchId,
    p_sets: setsForRpc,
  });

  if (rpcError) {
    return jsonResponse({ ok: false, code: 'persist_failed', detail: rpcError.message }, 500);
  }
  return jsonResponse(result);
});
