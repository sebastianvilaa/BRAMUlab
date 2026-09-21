// BRAMUlab — Backend Bloque 6: rutina COMPARTIDA de oficialización/corrección/identidad de Nivel.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.1-§3.6,
// 03_Plan_Implementacion_Claude.md §1.7, 04_Revision_ChatGPT.md §10}.
//
// Mismo patrón que officialize-onboarding/create-or-attach-match (Bloques 3/5): importa el
// motor JS compartido (symlinks reales a bramulab/, nunca copias) y hace TODO el cálculo acá
// (nunca reimplementado en SQL); la RPC officialize_match_validation solo persiste de forma
// atómica lo que este módulo ya calculó.
//
// Se IMPORTA (nunca se llama por HTTP) desde:
//   - officialize-match/index.ts (trigger 'Confirmar' explícito);
//   - create-or-attach-match/index.ts (segunda carga rival coincidente, readyForValidation=true);
//   - respond-match-correction/index.ts (corrección post-validación aceptada);
//   - resolve-identity-issue/index.ts (identidad resuelta o vencimiento materializado sobre un
//     partido ya validated).
// Un único núcleo, nunca dos lógicas paralelas (04_Revision_ChatGPT.md §10).

import '../_shared/engine.js';
import '../_shared/level.js';
import '../_shared/level-context.js';
import '../_shared/match-sync.js';
import '../_shared/match-level-engine.js';

// deno-lint-ignore no-explicit-any
const LV = (globalThis as any).PLLevel;
// deno-lint-ignore no-explicit-any
const MS = (globalThis as any).PLMatchSync;
// deno-lint-ignore no-explicit-any
const MLE = (globalThis as any).PLMatchLevelEngine;

export type OfficializeTrigger = 'initial' | 'correction_accepted' | 'identity_resolved' | 'identity_unidentified';

export interface OfficializeResult {
  ok: boolean;
  code?: string;
  resultId?: string;
  eligible?: boolean;
}

const MAX_STALE_SNAPSHOT_RETRIES = 3;

/** Núcleo único de oficialización. `serviceClient` ya debe estar creado con la service role key
 *  (el caller lo arma una sola vez y lo reutiliza). `matchId` + `trigger` determinan qué
 *  revisión/ventana temporal aplica — ver cada punto de llamada. `actorPlayerId` puede ser null
 *  (p. ej. materialización idempotente de un vencimiento, sin actor humano puntual). */
export async function officializeMatch(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  matchId: string,
  trigger: OfficializeTrigger,
  actorPlayerId: string | null,
  actorNote: string | null,
): Promise<OfficializeResult> {
  if (!LV || !MS || !MLE) {
    // No debería pasar nunca: son el MISMO archivo que usa el navegador (symlinks). Si esto
    // dispara, el import compartido se rompió — nunca cae a una reimplementación local.
    return { ok: false, code: 'engine_unavailable' };
  }

  for (let attempt = 0; attempt < MAX_STALE_SNAPSHOT_RETRIES; attempt++) {
    const { data: snapshot, error: snapshotError } = await serviceClient.rpc('get_match_officialization_snapshot', {
      p_match_id: matchId,
    });
    if (snapshotError) {
      return { ok: false, code: 'snapshot_fetch_failed' };
    }
    if (!snapshot) {
      return { ok: false, code: 'match_not_found' };
    }

    // La revisión oficial vigente. Para 'correction_accepted', respond_post_validation_correction
    // ya movió current_revision_id ANTES de que esta rutina se invoque — nunca se mueve acá.
    const revisionId = snapshot.currentRevisionId;
    if (!revisionId) {
      return { ok: false, code: 'no_current_revision' };
    }

    // 'initial' oficializa "ahora" (este instante ES el validated_at que se va a fijar). Toda
    // reaplicación (corrección/identidad) usa el validated_at YA FIJO del partido — nunca "ahora"
    // (Nivel_BRAMU_Formula_V1.5.md §12.2, Decisión Abierta #1 resuelta por 04_Revision_ChatGPT.md §1).
    const nowIso = new Date().toISOString();
    const validatedAtIso = trigger === 'initial' ? nowIso : snapshot.validatedAt;
    if (trigger !== 'initial' && !validatedAtIso) {
      return { ok: false, code: 'missing_validated_at_for_reapplication' };
    }

    // deno-lint-ignore no-explicit-any
    const knownParticipantIds: string[] = (snapshot.participants || [])
      // deno-lint-ignore no-explicit-any
      .map((p: any) => p.playerId)
      .filter((id: unknown): id is string => typeof id === 'string');

    const localMatch = MS.translateServerMatchToLocalShape(snapshot);

    let historyRows: unknown[] = [];
    if (knownParticipantIds.length) {
      const { data, error } = await serviceClient.rpc('get_player_match_history_for_level_engine', {
        p_player_ids: knownParticipantIds,
        p_before_played_at: snapshot.playedAt,
      });
      if (error) {
        return { ok: false, code: 'history_fetch_failed' };
      }
      historyRows = data || [];
    }
    // deno-lint-ignore no-explicit-any
    const history = historyRows.map((row: any) => MS.translateServerMatchToLocalShape(row));

    const playerStates = MLE.buildPlayerStatesDict(snapshot.levelStates || []);

    const officialization = MLE.computeOfficializationResult({
      localMatch,
      history,
      playerStates,
      validatedAtIso,
    });

    const engineOutput = officialization.engineOutput;
    const guestPlayerIds: string[] = officialization.guestPlayerIds || [];
    const newKnownIds: string[] = engineOutput
      ? Object.keys(engineOutput.players).filter((id) => !guestPlayerIds.includes(id))
      : [];
    const oldAppliedResult = snapshot.currentAppliedResult || null;
    // deno-lint-ignore no-explicit-any
    const oldKnownIds: string[] = oldAppliedResult ? oldAppliedResult.players.map((p: any) => p.playerId) : [];
    const neededPlayerIds = Array.from(new Set(newKnownIds.concat(oldKnownIds)));

    // Snapshot "antes de ESTE partido" (inmutable, Decisión Abierta #2 resuelta) por jugador —
    // se reutiliza si ya existe (get_match_officialization_snapshot.priorSnapshots), se
    // reconstruye con orden determinístico (get_player_level_state_as_of) si es la primera vez
    // que este jugador participa del cálculo de este partido.
    // deno-lint-ignore no-explicit-any
    const priorByPlayerId: Record<string, any> = {};
    // deno-lint-ignore no-explicit-any
    (snapshot.priorSnapshots || []).forEach((p: any) => { priorByPlayerId[p.playerId] = p; });

    const preMatchEvidenceUnitsByPlayerId: Record<string, number> = {};
    for (const playerId of neededPlayerIds) {
      const prior = priorByPlayerId[playerId];
      if (prior) {
        preMatchEvidenceUnitsByPlayerId[playerId] = Number(prior.evidenceUnitsBefore) || 0;
        continue;
      }
      const cutoff = validatedAtIso || nowIso;
      const { data: asOf } = await serviceClient.rpc('get_player_level_state_as_of', {
        p_player_id: playerId,
        p_cutoff: cutoff,
      });
      preMatchEvidenceUnitsByPlayerId[playerId] = asOf ? Number(asOf.evidenceUnits) || 0 : 0;
    }

    // Estado LIVE actual (ahora mismo, no "antes de este partido") — sobre esto se aplica el
    // neto. snapshot.levelStates ya trae a todo participante CONOCIDO actual; un jugador
    // recién asignado por una identidad puede no estar ahí si no es participante todavía en el
    // momento del snapshot (no debería pasar: resolve_identity_issue ya lo asignó a
    // match_participants antes de invocar esta rutina) — se completa leyendo level_states
    // directo como red de seguridad.
    // deno-lint-ignore no-explicit-any
    const liveByPlayerId: Record<string, any> = {};
    // deno-lint-ignore no-explicit-any
    (snapshot.levelStates || []).forEach((ls: any) => {
      liveByPlayerId[ls.playerId] = {
        mu: ls.mu,
        confidence: ls.confidence,
        evidenceUnits: Number(ls.evidenceUnits) || 0,
        confidenceOrigin: ls.confidenceOrigin,
      };
    });
    for (const playerId of neededPlayerIds) {
      if (liveByPlayerId[playerId]) continue;
      const { data: row } = await serviceClient
        .from('level_states')
        .select('mu,confidence,evidence_units,confidence_origin')
        .eq('player_id', playerId)
        .maybeSingle();
      if (row) {
        liveByPlayerId[playerId] = {
          mu: row.mu,
          confidence: row.confidence,
          evidenceUnits: Number(row.evidence_units) || 0,
          confidenceOrigin: row.confidence_origin,
        };
      }
    }

    const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
      oldAppliedResult,
      engineOutput,
      guestPlayerIds,
      currentLevelStatesByPlayerId: liveByPlayerId,
      preMatchEvidenceUnitsByPlayerId,
    });

    const teamStrength = engineOutput ? engineOutput.teamStrength : null;
    const expectation = engineOutput ? engineOutput.expectation : null;
    const rivalPairConfidenceAvg = engineOutput ? engineOutput.rivalPairConfidenceAvg : null;
    const context = officialization.context;

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('officialize_match_validation', {
      p_match_id: matchId,
      p_revision_id: revisionId,
      p_trigger: trigger,
      p_actor_player_id: actorPlayerId,
      p_actor_note: actorNote,
      p_eligible: officialization.eligible,
      p_reason_codes: JSON.stringify(officialization.reasonCodes || []),
      p_algorithm_version: LV.ALGORITHM_VERSION,
      p_known_levels_count: context ? context.knownLevelsCount : null,
      p_team_strength_a: teamStrength ? teamStrength.A : null,
      p_team_strength_b: teamStrength ? teamStrength.B : null,
      p_expectation_a: expectation ? expectation.A : null,
      p_expectation_b: expectation ? expectation.B : null,
      p_rival_pair_confidence_avg_a: rivalPairConfidenceAvg ? rivalPairConfidenceAvg.A : null,
      p_rival_pair_confidence_avg_b: rivalPairConfidenceAvg ? rivalPairConfidenceAvg.B : null,
      p_margin: engineOutput ? engineOutput.margin : null,
      p_format_factor: engineOutput ? engineOutput.formatFactor : null,
      p_availability_factor: engineOutput ? engineOutput.availabilityFactor : null,
      p_repetition_factor_a: context ? context.repetitionFactorA : null,
      p_repetition_factor_b: context ? context.repetitionFactorB : null,
      p_companion_factor_a: context ? context.companionFactorA : null,
      p_companion_factor_b: context ? context.companionFactorB : null,
      p_result_players: JSON.stringify(resultPlayers),
      p_level_state_updates: JSON.stringify(levelStateUpdates),
    });

    if (rpcError) {
      return { ok: false, code: 'persist_failed' };
    }
    if (rpcResult && rpcResult.ok === false && rpcResult.code === 'stale_level_snapshot') {
      // Otra oficialización concurrente ya movió a ese jugador primero — relee el snapshot
      // fresco y reintenta (acotado). Nunca se aplica un delta sobre datos que ya cambiaron.
      continue;
    }
    if (rpcResult && rpcResult.ok === false) {
      return { ok: false, code: rpcResult.code || 'unknown_error' };
    }

    return { ok: true, resultId: rpcResult && rpcResult.resultId, eligible: rpcResult && rpcResult.eligible };
  }

  return { ok: false, code: 'stale_level_snapshot_retries_exhausted' };
}
