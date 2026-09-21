// BRAMUlab — Backend Bloque 5: create-or-attach de partidos compartidos.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_05/{02_Analisis_Claude.md §2/§5,
// 03_Plan_Implementacion_Claude.md §1 Fase B, 04_Revision_ChatGPT.md}.
//
// Mismo patrón exacto que supabase/functions/officialize-onboarding/index.ts (Bloque 3):
// reutiliza el MISMO motor JS que usa el navegador para la carga manual (engine.js/
// match-load.js), importado acá como side-effect import desde supabase/functions/_shared/ —
// esos dos archivos son SYMLINKS reales a bramulab/engine.js y bramulab/match-load.js, nunca
// una copia manual. match-load.js referencia `global.PLStore`/`global.PLPlayerHome` en su
// cabecera (para otras funciones de ese mismo archivo que acá NO se usan, como el selector de
// jugadores por nombre): quedan `undefined` en este entorno, sin ningún efecto — la única
// función que este archivo llama, `validateMatchSets`, solo depende de `PLEngine`.
//
// El navegador nunca es autoridad: `ML.validateMatchSets` corre de nuevo acá, a partir de los
// sets CRUDOS que mandó el cliente (nunca un `sets`/`winnerTeam` ya calculado por el cliente),
// exactamente la misma regla que ya usa la carga manual local — nunca reimplementada en SQL
// (02_Analisis_Claude.md §2). La RPC `create_or_attach_match` (SECURITY DEFINER, alcanzable
// EXCLUSIVAMENTE con la service role key) hace el resto: idempotencia, deduplicación,
// concurrencia y persistencia atómica.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   {
//     idempotencyKey: string (uuid),
//     pair1PlayerIds: [string, string], pair2PlayerIds: [string, string],
//     rawSets: [{a:number,b:number}, ...] (1 a 3, en el orden pair1 vs pair2, SIN winner/tiebreak
//       calculado — igual forma que usa hoy la carga manual antes de llamar validateMatchDraft),
//     formatId: 'classic'|'americano',
//     playedAtIso: string (ISO), playedAtTimeKnown: boolean,
//     reportedTimeZone?: string, scoringSystem?: string,
//     locationName?: string, locationLat?: number, locationLng?: number,
//     disambiguationMatchId?: string, disambiguationForceNew?: boolean,
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import '../_shared/engine.js';
import '../_shared/match-load.js';
import { officializeMatch } from '../_shared/match-officialize-core.ts';

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
    // No debería pasar nunca: match-load.js es el MISMO archivo que usa el navegador (symlink,
    // ver supabase/functions/_shared/). Si esto dispara, el import compartido se rompió — nunca
    // cae a una reimplementación local de la validación acá.
    return jsonResponse({ ok: false, code: 'engine_unavailable' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return jsonResponse({ ok: false, code: 'missing_authorization' }, 401);

  // Verifica el JWT del usuario con el cliente ANON (nunca con la service role acá) — mismo
  // criterio que officialize-onboarding: impide que cualquiera invoque esta función a nombre de
  // otro usuario.
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

  const idempotencyKey = payload && payload.idempotencyKey;
  const pair1 = payload && Array.isArray(payload.pair1PlayerIds) ? payload.pair1PlayerIds : null;
  const pair2 = payload && Array.isArray(payload.pair2PlayerIds) ? payload.pair2PlayerIds : null;
  const rawSets = payload && Array.isArray(payload.rawSets) ? payload.rawSets : null;
  const formatId = payload && payload.formatId;
  const playedAtIso = payload && payload.playedAtIso;
  const playedAtTimeKnown = payload ? !!payload.playedAtTimeKnown : true;

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return jsonResponse({ ok: false, code: 'missing_idempotency_key' }, 400);
  }
  if (!pair1 || pair1.length !== 2 || !pair2 || pair2.length !== 2) {
    return jsonResponse({ ok: false, code: 'invalid_participants' }, 400);
  }
  if (formatId !== 'classic' && formatId !== 'americano') {
    return jsonResponse({ ok: false, code: 'invalid_format' }, 400);
  }
  if (!playedAtIso || Number.isNaN(new Date(playedAtIso).getTime())) {
    return jsonResponse({ ok: false, code: 'invalid_played_at' }, 400);
  }
  if (!rawSets || rawSets.length < 1) {
    return jsonResponse({ ok: false, code: 'invalid_sets' }, 400);
  }

  // Revalida legalidad de sets/formato/ganador con el MISMO motor que usa la carga manual local
  // — el cliente nunca puede inyectar un resultado que engine.js no reconozca como un score de
  // set completo y válido para este formato.
  const validated = ML.validateMatchSets(rawSets, formatId);
  if (!validated.ok) {
    return jsonResponse({ ok: false, code: `invalid_sets_${validated.reason}` }, 400);
  }

  // sets orientados "pair1 vs pair2" (A/B de validateMatchSets corresponde 1:1 al orden en que
  // se pasaron los rawSets: pair1=A, pair2=B) — create_or_attach_match decide la orientación
  // final team_a/team_b, nunca esta capa.
  const setsForRpc = validated.sets.map((s: { gamesA: number; gamesB: number; tiebreak: unknown }) => ({
    gamesA: s.gamesA,
    gamesB: s.gamesB,
    tiebreakA: tiebreakField(s.tiebreak, 'a'),
    tiebreakB: tiebreakField(s.tiebreak, 'b'),
  }));

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: result, error: rpcError } = await serviceClient.rpc('create_or_attach_match', {
    p_auth_user_id: authUserId,
    p_idempotency_key: idempotencyKey,
    p_pair1_player_id_1: pair1[0],
    p_pair1_player_id_2: pair1[1],
    p_pair2_player_id_1: pair2[0],
    p_pair2_player_id_2: pair2[1],
    p_played_at: playedAtIso,
    p_played_at_time_known: playedAtTimeKnown,
    p_format_id: formatId,
    p_sets: setsForRpc,
    p_reported_time_zone: (payload && payload.reportedTimeZone) || null,
    p_scoring_system: (payload && payload.scoringSystem) || null,
    p_location_name: (payload && payload.locationName) || null,
    p_location_lat: (payload && payload.locationLat) ?? null,
    p_location_lng: (payload && payload.locationLng) ?? null,
    p_disambiguation_match_id: (payload && payload.disambiguationMatchId) || null,
    p_disambiguation_force_new: !!(payload && payload.disambiguationForceNew),
  });

  if (rpcError) {
    return jsonResponse({ ok: false, code: 'persist_failed', detail: rpcError.message }, 500);
  }

  // Backend Bloque 6 — segundo trigger de oficialización (02_Analisis_Claude.md §3.1): cuando
  // la conformidad rival deja readyForValidation=true (códigos matched_confirmed /
  // matched_already_confirmed), la MISMA invocación de esta Edge Function importa y llama a la
  // rutina compartida antes de responder — el cliente nunca necesita una segunda llamada.
  // Nunca dos lógicas paralelas (04_Revision_ChatGPT.md §10): éste es el mismo núcleo que usa
  // officialize-match/respond-match-correction/resolve-identity-issue.
  //
  // Un fallo acá NUNCA debe ocultar el resultado de create_or_attach_match, que ya se persistió
  // con éxito: si la oficialización falla (motor no disponible, snapshot inconsistente), el
  // partido queda readyForValidation=true sin oficializar — se recupera solo, sin cron, en la
  // próxima lectura que lo detecte y dispare un reintento silencioso contra officialize-match
  // (mismo criterio que Bloque 5 ya usa para expiración lógica: nada se pierde por no tener
  // un job).
  if (result && result.ok && result.readyForValidation && result.matchId) {
    try {
      await officializeMatch(serviceClient, result.matchId, 'initial', null, null);
    } catch (_err) {
      // Silencioso a propósito — ver comentario de arriba. No se re-lanza para no convertir un
      // create_or_attach_match ya persistido con éxito en un error 500 de cara al cliente.
    }
  }

  return jsonResponse(result);
});
