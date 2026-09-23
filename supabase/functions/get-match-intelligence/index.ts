// BRAMUlab — Backend Bloque 8 (Fase D): BRAMU Intelligence server-side, real y persistente.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_08/15_Handoff_Fase_D_Claude.md §9. Mismo
// patrón exacto que officialize-match/create-or-attach-match: reutiliza el MISMO motor JS que
// usa el navegador (`intelligence-context.js`/`intelligence-claims.js`/`intelligence-editorial.js`/
// `intelligence-presentation.js`), importado acá como side-effect import desde
// supabase/functions/_shared/ — los 4 son SYMLINKS reales a bramulab/*.js, nunca una copia.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string }
//
// El cliente NUNCA elige el jugador: `callerPlayerId` se deriva siempre de la sesión (igual
// criterio que officialize-match/create-or-attach-match) — nunca se acepta un `playerId` del
// body, ni siquiera para depuración.
//
// Flujo (handoff §8/§9):
//   1) resolver `callerPlayerId` desde el JWT;
//   2) traer la historia personal REAL del caller vía la RPC de Fase A
//      `get_player_intelligence_history`, llamada con el cliente DEL USUARIO (su propio JWT) —
//      nunca con service role para esto: esa RPC ya resuelve `auth.uid()` sola, tal como lo
//      haría el navegador si la llamara directo;
//   3) truncar la historia (ya ordenada por `playedAt`, Fase A) hasta el `matchId` objetivo
//      inclusive — "trunca por el partido objetivo según fecha jugada + desempate estable"
//      (handoff §9), nunca por orden de llegada;
//   4) calcular el fingerprint determinístico de ese prefijo
//      (`PLIntelligencePresentation.computeHistoryFingerprint`);
//   5) si ya existe una salida guardada para (jugador, partido) con el MISMO fingerprint y la
//      MISMA versión de reglas combinada → devolverla tal cual, sin tocar memoria ni plantilla
//      (idempotencia real, handoff §8: "no regenerarla al abrir una pantalla");
//   6) si no, correr el pipeline A→B→C→D completo con la memoria actual del jugador, persistir
//      la salida nueva y — SOLO si el partido objetivo es el más reciente de su historia — la
//      memoria actualizada (ver nota "por qué no siempre" más abajo).
//
// Por qué la memoria NO se actualiza si el partido objetivo no es el más reciente: la memoria
// editorial/de plantillas es UN solo blob "como de ahora" (`intelligence_player_memory`, ver la
// migración). Si un jugador reabre el Resumen de un partido VIEJO después de que partidos más
// nuevos ya generaron su propia salida (y ya avanzaron la memoria), recalcular ese partido viejo
// con la memoria ACTUAL y guardarla de nuevo REGRESARÍA la memoria del jugador a un estado
// anterior a esos partidos más nuevos — un bug real, no una simplificación aceptable. La salida
// de ESE partido viejo sí se calcula y persiste igual (usando la memoria actual como mejor
// aproximación disponible, documentado como limitación V1 en el informe de esta ronda) — lo que
// nunca se permite es que ese cálculo le pise la memoria vigente del jugador.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import '../_shared/engine.js';
import '../_shared/level.js';
import '../_shared/level-context.js';
import '../_shared/match-sync.js';
import '../_shared/intelligence-context.js';
import '../_shared/intelligence-claims.js';
import '../_shared/intelligence-editorial.js';
import '../_shared/intelligence-presentation.js';

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
const IC = g.PLIntelligenceContext;
const CL = g.PLIntelligenceClaims;
const ED = g.PLIntelligenceEditorial;
const PR = g.PLIntelligencePresentation;

// Fase A no expone hoy una constante de versión propia (no tiene claims/reglas versionadas, solo
// derivados) — se fija el literal acá, alineado con lo que intelligence-presentation.js ya
// embebe internamente en `rulesVersions.a` de cada insight. B/C/D SÍ exponen su propia constante:
// nunca se hardcodea su valor por separado, para que no puedan desincronizarse en silencio.
const RULES_VERSION_COMBINED = ['bramu_intelligence_context_v1', CL.RULES_VERSION, ED.RULES_VERSION, PR.RULES_VERSION].join(':');

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

  // Verifica el JWT con el cliente ANON (nunca con la service role para esto) — impide que
  // cualquiera invoque esta función a nombre de otro usuario, mismo criterio que
  // officialize-match/create-or-attach-match.
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

  // Historia real del CALLER, vía el cliente DEL USUARIO — get_player_intelligence_history
  // (Fase A) resuelve `auth.uid()` sola; nunca se le pasa un playerId elegido por el navegador.
  const { data: rawRows, error: historyError } = await userClient.rpc('get_player_intelligence_history', { p_limit: 1000 });
  if (historyError) {
    return jsonResponse({ ok: false, code: 'history_fetch_failed', detail: historyError.message }, 500);
  }

  const historyFull = IC.buildPersonalHistory(rawRows || []);
  // deno-lint-ignore no-explicit-any
  const targetIndex = historyFull.findIndex((m: any) => m.matchId === matchId);
  if (targetIndex === -1) {
    // Nunca confirma ni niega POR QUÉ falta (no participante, oculto, o inexistente) — mismo
    // criterio de no-filtración de get_match_detail (Bloque 5/6).
    return jsonResponse({ ok: false, code: 'match_not_available' }, 404);
  }

  const truncated = historyFull.slice(0, targetIndex + 1);
  const isLatestMatch = targetIndex === historyFull.length - 1;
  const fingerprint = PR.computeHistoryFingerprint(truncated);

  const { data: existingOutput } = await serviceClient
    .from('intelligence_match_outputs')
    .select('output, source_fingerprint, rules_version')
    .eq('player_id', callerPlayerId)
    .eq('match_id', matchId)
    .maybeSingle();

  if (existingOutput && existingOutput.source_fingerprint === fingerprint && existingOutput.rules_version === RULES_VERSION_COMBINED) {
    // Idempotencia real: misma fuente + mismas versiones -> se devuelve exactamente lo guardado,
    // sin elegir otra frase, sin cambiar template, sin tocar memoria (handoff §8).
    return jsonResponse({ ok: true, output: existingOutput.output, regenerated: false });
  }

  const { data: memoryRow } = await serviceClient
    .from('intelligence_player_memory')
    .select('memory')
    .eq('player_id', callerPlayerId)
    .maybeSingle();
  const priorMemory = (memoryRow && memoryRow.memory) || ED.emptyMemory();

  const decision = ED.buildEditorialDecision(truncated, callerPlayerId, priorMemory);
  const rendered = PR.renderIntelligence(decision, truncated, decision.memoryUpdate);

  const { error: upsertOutputError } = await serviceClient
    .from('intelligence_match_outputs')
    .upsert({
      player_id: callerPlayerId,
      match_id: matchId,
      source_fingerprint: fingerprint,
      rules_version: RULES_VERSION_COMBINED,
      output: rendered,
      generated_at: new Date().toISOString(),
    });
  if (upsertOutputError) {
    return jsonResponse({ ok: false, code: 'persist_output_failed', detail: upsertOutputError.message }, 500);
  }

  // Ver nota de cabecera: la memoria del jugador SOLO avanza cuando el partido objetivo es el
  // más reciente de su historia — reabrir un partido viejo nunca regresa la memoria vigente.
  if (isLatestMatch) {
    const { error: upsertMemoryError } = await serviceClient
      .from('intelligence_player_memory')
      .upsert({
        player_id: callerPlayerId,
        memory: rendered.memoryUpdate,
        rules_version: RULES_VERSION_COMBINED,
        updated_at: new Date().toISOString(),
      });
    if (upsertMemoryError) {
      return jsonResponse({ ok: false, code: 'persist_memory_failed', detail: upsertMemoryError.message }, 500);
    }
  }

  return jsonResponse({ ok: true, output: rendered, regenerated: true });
});
