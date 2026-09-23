// BRAMUlab — Backend Bloque 8 (Fases D+E): BRAMU Intelligence server-side, real y persistente.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_08/15_Handoff_Fase_D_Claude.md §9,
// 17_Revision_Central_Fase_D.md (corrección D01/D02/D03),
// 19_Revision_Central_Fase_D_Auditoria.md (corrección D06 — auditoría persistida) y
// 25_Handoff_Fase_E_Claude.md (integración Nivel BRAMU — Familia H). Mismo patrón exacto que
// officialize-match/create-or-attach-match: reutiliza el MISMO motor JS que usa el navegador
// (`intelligence-context.js`/`intelligence-claims.js`/`intelligence-editorial.js`/
// `intelligence-official.js`/`intelligence-presentation.js`), importado acá como side-effect
// import desde supabase/functions/_shared/ — los 5 son SYMLINKS reales a bramulab/*.js, nunca
// una copia.
//
// Fase E (nuevo en esta ronda): además de la historia personal, se trae el snapshot OFICIAL de
// Nivel BRAMU ya persistido (`match_level_results`/`match_level_result_players`, filtrado a
// `effect_status='applied'`) para cada partido de la historia, en dos consultas batched — nunca
// se recalcula Nivel, nunca se usa el estado EN VIVO del jugador. El snapshot viaja adjunto a
// cada partido (`officialLevelSnapshot`) y `PLIntelligencePresentation.runIntelligenceReplay` lo
// usa para generar los claims de Familia H (Nivel/expectativa) de ESE partido puntual, con la
// MISMA lógica de selección/scoring/checkpoint/fingerprint que ya existía — nunca un camino
// paralelo. Ranking BRAMU NO pasa por esta Edge Function: su integración (hitos materiales de
// Ranking semanal en "TU MOMENTO"/Home) vive enteramente en `bramulab/ranking.js`/
// `bramulab/player-home.js`, ver esos archivos y el informe de esta ronda.
//
// Body esperado (JSON), con el access token del usuario en el header Authorization:
//   { matchId: string }
//
// El cliente NUNCA elige el jugador: `callerPlayerId` se deriva siempre de la sesión (igual
// criterio que officialize-match/create-or-attach-match) — nunca se acepta un `playerId` del
// body, ni siquiera para depuración.
//
// Flujo (corrección D01 — reemplaza el diseño original de "un solo blob global de memoria"):
//   1) resolver `callerPlayerId` desde el JWT;
//   2) traer la historia personal REAL del caller vía la RPC de Fase A
//      `get_player_intelligence_history`, llamada con el cliente DEL USUARIO (su propio JWT) —
//      nunca con service role para esto: esa RPC ya resuelve `auth.uid()` sola, tal como lo
//      haría el navegador si la llamara directo;
//   3) localizar el partido objetivo en esa historia (ya ordenada por `playedAt`, Fase A);
//   4) traer, en UNA sola consulta, todos los checkpoints existentes del jugador
//      (`intelligence_match_outputs`) — nunca una consulta por partido;
//   5) `PLIntelligencePresentation.runIntelligenceReplay` camina cronológicamente desde el
//      primer partido de la historia hasta el objetivo, reutilizando cada checkpoint cuyo
//      fingerprint+rules_version siga vigente y regenerando (con la memoria del checkpoint
//      INMEDIATAMENTE anterior, nunca con la de un partido posterior ni con la de sí mismo) los
//      que falten o quedaron inválidos — ver el módulo puro para la garantía exacta;
//   6) persistir (upsert) ÚNICAMENTE los checkpoints regenerados — `output`, `memory_after` Y
//      `audit` (D06: snapshot completo de auditoría, server-only);
//   7) devolver ÚNICAMENTE `output` del checkpoint del partido objetivo — `audit` nunca sale en
//      la respuesta al cliente.
//
// Por qué ya no existe un blob global "memoria actual del jugador" (`intelligence_player_memory`,
// eliminada de la migración antes de aplicarla — D01): con esa memoria única, un partido viejo
// podía terminar influido por partidos posteriores (si ya se había generado Intelligence para
// ellos), y corregir el partido MÁS RECIENTE podía autopenalizarlo contra su propia salida
// anterior (la memoria "actual" ya lo incluía a él mismo). El replay cronológico por checkpoints
// resuelve ambos casos por construcción, no con lógica especial — ver el comentario de cabecera
// de `runIntelligenceReplay` en intelligence-presentation.js.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import '../_shared/engine.js';
import '../_shared/level.js';
import '../_shared/level-context.js';
import '../_shared/match-sync.js';
import '../_shared/intelligence-context.js';
import '../_shared/intelligence-claims.js';
import '../_shared/intelligence-editorial.js';
import '../_shared/intelligence-official.js';
import '../_shared/intelligence-presentation.js';

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
const IC = g.PLIntelligenceContext;
const CL = g.PLIntelligenceClaims;
const ED = g.PLIntelligenceEditorial;
const IO = g.PLIntelligenceOfficial;
const PR = g.PLIntelligencePresentation;

// Fase A no expone hoy una constante de versión propia (no tiene claims/reglas versionadas, solo
// derivados) — se fija el literal acá, alineado con lo que intelligence-presentation.js ya
// embebe internamente en `rulesVersions.a` de cada insight. B/C/D/E SÍ exponen su propia
// constante: nunca se hardcodea su valor por separado, para que no puedan desincronizarse en
// silencio.
const RULES_VERSION_COMBINED = ['bramu_intelligence_context_v1', CL.RULES_VERSION, ED.RULES_VERSION, PR.RULES_VERSION, IO.RULES_VERSION].join(':');

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

  // Fase E — snapshot oficial de Nivel BRAMU vigente por partido, en UNA sola consulta batched
  // (nunca una por partido) directamente con `serviceClient` (mismo criterio que
  // officialize-match: estas dos tablas son RLS deny-by-default, service_role únicamente).
  // Solo filas `effect_status='applied'` — la vigente; una revertida nunca alimenta Intelligence.
  // deno-lint-ignore no-explicit-any
  const historyMatchIds = historyFull.map((m: any) => m.matchId);
  const { data: levelResultRows, error: levelResultsError } = await serviceClient
    .from('match_level_results')
    .select('result_id, match_id, algorithm_version, eligible, reason_codes, known_levels_count, team_strength_a, team_strength_b, expectation_a, expectation_b, rival_pair_confidence_avg_a, rival_pair_confidence_avg_b, margin, effect_status')
    .in('match_id', historyMatchIds)
    .eq('effect_status', 'applied');
  if (levelResultsError) {
    return jsonResponse({ ok: false, code: 'level_results_fetch_failed', detail: levelResultsError.message }, 500);
  }
  // deno-lint-ignore no-explicit-any
  const levelResultIds = (levelResultRows || []).map((r: any) => r.result_id);
  // deno-lint-ignore no-explicit-any
  let levelPlayerRows: any[] = [];
  if (levelResultIds.length) {
    const { data: playerRows, error: levelPlayersError } = await serviceClient
      .from('match_level_result_players')
      .select('result_id, player_id, team, formula_mu_before, formula_confidence_before, formula_state, effective_level, delta_raw, delta_capped, evidence_quality, mu_after, confidence_after')
      .in('result_id', levelResultIds);
    if (levelPlayersError) {
      return jsonResponse({ ok: false, code: 'level_result_players_fetch_failed', detail: levelPlayersError.message }, 500);
    }
    levelPlayerRows = playerRows || [];
  }
  // deno-lint-ignore no-explicit-any
  const levelPlayerRowsByResultId: Record<string, any[]> = {};
  levelPlayerRows.forEach((p: any) => {
    (levelPlayerRowsByResultId[p.result_id] = levelPlayerRowsByResultId[p.result_id] || []).push(p);
  });
  // deno-lint-ignore no-explicit-any
  const officialSnapshotByMatchId: Record<string, any> = {};
  (levelResultRows || []).forEach((r: any) => {
    officialSnapshotByMatchId[r.match_id] = IO.buildLevelSnapshot(r, levelPlayerRowsByResultId[r.result_id] || []);
  });
  // Nunca se muta `historyFull` (Fase A cerrada) — se arma un array NUEVO con el campo agregado,
  // exactamente el mismo criterio que D02 ya usaba para leer campos ya presentes en el partido.
  // deno-lint-ignore no-explicit-any
  const historyWithOfficial = historyFull.map((m: any) => Object.assign({}, m, { officialLevelSnapshot: officialSnapshotByMatchId[m.matchId] || null }));

  // Checkpoints existentes del jugador — UNA sola consulta, nunca una por partido (D01). Incluye
  // `audit` (D06, auditoría completa server-only) para que un checkpoint reutilizado reutilice
  // también su audit exacto, sin regenerarlo.
  const { data: existingRows, error: existingError } = await serviceClient
    .from('intelligence_match_outputs')
    .select('match_id, source_fingerprint, rules_version, output, memory_after, audit')
    .eq('player_id', callerPlayerId);
  if (existingError) {
    return jsonResponse({ ok: false, code: 'checkpoints_fetch_failed', detail: existingError.message }, 500);
  }

  // deno-lint-ignore no-explicit-any
  const existingCheckpoints: Record<string, any> = {};
  (existingRows || []).forEach((r: any) => {
    existingCheckpoints[r.match_id] = {
      sourceFingerprint: r.source_fingerprint,
      rulesVersion: r.rules_version,
      output: r.output,
      memoryAfter: r.memory_after,
      audit: r.audit,
    };
  });

  // Camina cronológicamente desde el primer partido hasta el objetivo, reutilizando checkpoints
  // válidos y regenerando los que falten o quedaron inválidos — ver `runIntelligenceReplay` para
  // la garantía exacta de por qué esto nunca deja que un partido viejo reciba memoria del futuro
  // ni que corregir el más reciente lo penalice contra sí mismo. Cada paso trae también `audit`
  // (D06) — snapshot de auditoría completo, server-only. `historyWithOfficial` (Fase E) trae
  // adjunto `officialLevelSnapshot` por partido — nunca `historyFull` a partir de aquí.
  const steps = PR.runIntelligenceReplay(historyWithOfficial, targetIndex, callerPlayerId, existingCheckpoints, RULES_VERSION_COMBINED);

  // deno-lint-ignore no-explicit-any
  const toPersist = steps.filter((s: any) => !s.reused);
  if (toPersist.length) {
    // deno-lint-ignore no-explicit-any
    const rows = toPersist.map((s: any) => ({
      player_id: callerPlayerId,
      match_id: s.matchId,
      source_fingerprint: s.fingerprint,
      rules_version: RULES_VERSION_COMBINED,
      output: s.output,
      memory_after: s.memoryAfter,
      audit: s.audit,
      generated_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await serviceClient.from('intelligence_match_outputs').upsert(rows);
    if (upsertError) {
      return jsonResponse({ ok: false, code: 'persist_checkpoints_failed', detail: upsertError.message }, 500);
    }
  }

  // `audit` NUNCA sale en la respuesta al cliente (D06) — solo `output`, igual que siempre.
  const targetStep = steps[targetIndex];
  return jsonResponse({ ok: true, output: targetStep.output, regenerated: !targetStep.reused });
});
