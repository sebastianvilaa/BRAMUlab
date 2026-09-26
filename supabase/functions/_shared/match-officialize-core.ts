// BRAMUlab — Backend Bloque 6: rutina COMPARTIDA de oficialización/corrección/identidad de Nivel.
//
// Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/{02_Analisis_Claude.md §3.1-§3.6,
// 03_Plan_Implementacion_Claude.md §1.7, 04_Revision_ChatGPT.md §10, 06_Revision_Fase_A_
// ChatGPT.md (B6-A-02/06/07/08/09), 10_Revision_Final_Pre_Staging_ChatGPT.md (C-01: baseline
// LIVE inmutable en liveByPlayerId.originalLive* para una identidad recién incorporada; C-06:
// correction_accepted congela repetición/compañero/círculo/disponibilidad, nunca los recalcula
// del historial actual).
//
// Mismo patrón que officialize-onboarding/create-or-attach-match (Bloques 3/5): importa el
// motor JS compartido (symlinks reales a bramulab/, nunca copias) y hace TODO el cálculo acá
// (nunca reimplementado en SQL); la RPC officialize_match_validation solo persiste de forma
// atómica lo que este módulo ya calculó.
//
// Se IMPORTA (nunca se llama por HTTP) desde:
//   - officialize-match/index.ts (trigger 'Confirmar' explícito, e idempotente sobre un partido
//     ya validated — B6-A-10);
//   - create-or-attach-match/index.ts (segunda carga rival coincidente, readyForValidation=true);
//   - respond-match-correction/index.ts (corrección post-validación aceptada — trigger=
//     'correction_accepted', usa pendingCorrectionRevisionId/pendingCorrectionSets, NUNCA los de
//     la revisión vigente todavía-no-reemplazada, B6-A-06/08);
//   - resolve-identity-issue/index.ts (identidad resuelta o vencimiento materializado sobre un
//     partido ya validated — `identityAction`, B6-A-09).
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

export interface IdentityAction {
  issueId: string;
  team: 'A' | 'B';
  positionInTeam: 1 | 2;
  // Requerido para 'identity_resolved'; ausente/null para 'identity_unidentified'.
  replacementPlayerId?: string | null;
}

export interface OfficializeResult {
  ok: boolean;
  code?: string;
  resultId?: string;
  eligible?: boolean;
}

const MAX_STALE_SNAPSHOT_RETRIES = 3;

// Ronda correctiva QA 26SEP (P0 oficialización compartida, handoff §2) — BUG REAL encontrado
// por lectura de código en las 3 Edge Functions que llaman a `officializeMatch`
// (officialize-match/respond-match-correction/resolve-identity-issue): las tres trataban
// CUALQUIER `!result.ok` como si fuera un error de servidor — officialize-match devolvía HTTP
// 500 para TODOS los códigos por igual, y las otras dos devolvían HTTP 200 con `{ok:false}` (el
// mismo toast genérico "No se pudo completar la acción" del lado del cliente en los dos casos).
// Varios de estos códigos son ESTADOS DE NEGOCIO esperables (el partido venció, ya está
// validado, hay una incidencia abierta, otra operación concurrente ganó la carrera del lock) —
// nunca "el servidor se rompió". Único mapeo compartido código->status HTTP para los 3
// callers, para no repetir el mismo criterio 3 veces ("nunca tres parches separados", handoff
// §2). `already_validated` en trigger='initial' YA NO llega acá como código de error — ver el
// manejo idempotente dentro de `officializeMatch` más abajo.
const BUSINESS_STATE_CODES = new Set([
  'already_validated', 'match_not_actionable', 'not_ready_for_validation', 'match_expired',
  'identity_issue_open', 'stale_match_revision', 'stale_level_snapshot', 'identity_issue_not_open',
  'no_pending_correction', 'no_current_revision', 'missing_validated_at_for_reapplication',
  'match_not_found',
]);

/** HTTP status para un `code` de `OfficializeResult`/RPCs relacionadas: 409 (Conflict) para un
 *  estado de negocio esperable que el cliente puede simplemente releer/reintentar, 500 SOLO
 *  para una falla real (motor no disponible, snapshot/historial/persistencia ilegibles,
 *  reintentos de concurrencia agotados, o cualquier código nuevo no reconocido — nunca se
 *  asume benigno por default). */
export function officializeErrorHttpStatus(code: string | null | undefined): number {
  return code && BUSINESS_STATE_CODES.has(code) ? 409 : 500;
}

/** Núcleo único de oficialización. `serviceClient` ya debe estar creado con la service role key
 *  (el caller lo arma una sola vez y lo reutiliza). `matchId` + `trigger` determinan qué
 *  revisión/ventana temporal aplica. `identityAction` solo se pasa para trigger=
 *  identity_resolved|identity_unidentified — la reasignación del slot/cierre de la incidencia
 *  ocurre ATÓMICAMENTE dentro de la RPC junto con Nivel (B6-A-09), nunca antes acá. */
export async function officializeMatch(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  matchId: string,
  trigger: OfficializeTrigger,
  actorPlayerId: string | null,
  actorNote: string | null,
  identityAction?: IdentityAction,
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
      // Ronda correctiva QA 26SEP (P0 oficialización compartida) — logging técnico real, SOLO
      // en los logs de la Edge Function (nunca en la respuesta al cliente, que sigue recibiendo
      // únicamente el código genérico `snapshot_fetch_failed`). Central lo necesita para
      // diagnosticar sin depender de que el sandbox de Claude pueda reproducir contra Staging
      // real (handoff §2: "hoy match-officialize-core.ts aplasta rpcError a persist_failed").
      console.error('[officializeMatch] snapshot_fetch_failed', {
        matchId, trigger, attempt,
        message: snapshotError.message, details: (snapshotError as { details?: unknown }).details,
        hint: (snapshotError as { hint?: unknown }).hint, code: (snapshotError as { code?: unknown }).code,
      });
      return { ok: false, code: 'snapshot_fetch_failed' };
    }
    if (!snapshot) {
      return { ok: false, code: 'match_not_found' };
    }

    // ------------------------------------------------------------------
    // Revisión objetivo + sets — B6-A-06/B6-A-08: 'correction_accepted' usa EXCLUSIVAMENTE la
    // revisión/sets PENDIENTES (todavía no oficiales), nunca los de la revisión vigente
    // (matches.current_revision_id no se mueve hasta que officialize_match_validation lo hace
    // atómicamente). Cualquier otro trigger usa la revisión vigente actual.
    // ------------------------------------------------------------------
    let revisionId: string | null;
    // deno-lint-ignore no-explicit-any
    let setsForEngine: any[] | null;
    if (trigger === 'correction_accepted') {
      revisionId = snapshot.pendingCorrectionRevisionId || null;
      setsForEngine = snapshot.pendingCorrectionSets || null;
      if (!revisionId || !setsForEngine) {
        return { ok: false, code: 'no_pending_correction' };
      }
    } else {
      revisionId = snapshot.currentRevisionId || null;
      setsForEngine = snapshot.sets || null;
      if (!revisionId) {
        return { ok: false, code: 'no_current_revision' };
      }
    }

    // ------------------------------------------------------------------
    // Participantes para el motor — B6-A-09: para una acción de identidad, se simula EN MEMORIA
    // cómo quedaría el slot DESPUÉS de la reasignación (la reasignación real todavía no ocurrió,
    // ocurre atómicamente junto con Nivel dentro de la RPC) — nunca se mutan match_participants
    // antes de tener el cálculo de Nivel listo.
    // ------------------------------------------------------------------
    // deno-lint-ignore no-explicit-any
    let participantsForEngine: any[] = snapshot.participants || [];
    if (identityAction) {
      participantsForEngine = participantsForEngine.map((p: { team: string; position: number; playerId: string | null; displayName: string }) => {
        if (p.team === identityAction.team && p.position === identityAction.positionInTeam) {
          return Object.assign({}, p, {
            playerId: identityAction.replacementPlayerId || null,
            displayName: identityAction.replacementPlayerId ? p.displayName : 'Sin identificar',
          });
        }
        return p;
      });
    }

    const matchForEngine = Object.assign({}, snapshot, { sets: setsForEngine, participants: participantsForEngine });
    const localMatch = MS.translateServerMatchToLocalShape(matchForEngine);

    // 'initial' oficializa "ahora" (este instante ES el validated_at que se va a fijar). Toda
    // reaplicación (corrección/identidad) usa el validated_at YA FIJO del partido — nunca "ahora"
    // (Nivel_BRAMU_Formula_V1.5.md §12.2, Decisión Abierta #1 resuelta por 04_Revision_ChatGPT.md §1).
    const nowIso = new Date().toISOString();
    const validatedAtIso = trigger === 'initial' ? nowIso : snapshot.validatedAt;
    if (trigger !== 'initial' && !validatedAtIso) {
      return { ok: false, code: 'missing_validated_at_for_reapplication' };
    }

    const knownParticipantIds: string[] = participantsForEngine
      .map((p: { playerId: string | null }) => p.playerId)
      .filter((id: unknown): id is string => typeof id === 'string');

    let historyRows: unknown[] = [];
    if (knownParticipantIds.length) {
      const { data, error } = await serviceClient.rpc('get_player_match_history_for_level_engine', {
        p_player_ids: knownParticipantIds,
        p_before_played_at: snapshot.playedAt,
      });
      if (error) {
        console.error('[officializeMatch] history_fetch_failed', {
          matchId, trigger, attempt, knownParticipantIds,
          message: error.message, details: (error as { details?: unknown }).details,
          hint: (error as { hint?: unknown }).hint, code: (error as { code?: unknown }).code,
        });
        return { ok: false, code: 'history_fetch_failed' };
      }
      historyRows = data || [];
    }
    // deno-lint-ignore no-explicit-any
    const history = historyRows.map((row: any) => MS.translateServerMatchToLocalShape(row));

    // ------------------------------------------------------------------
    // Estado LIVE actual (ahora mismo) de cada participante conocido — base para el neto
    // aplicado (computeLevelStateUpdates) y para decidir inactividad (B6-A-05) de quien no
    // tenga todavía un snapshot de fórmula propio de este partido. snapshot.levelStates solo
    // trae a quien YA es participante actual — un jugador recién asignado por una identidad
    // (todavía no persistido en match_participants) se completa acá con una lectura directa.
    // deno-lint-ignore no-explicit-any
    const liveByPlayerId: Record<string, any> = {};
    // deno-lint-ignore no-explicit-any
    (snapshot.levelStates || []).forEach((ls: any) => {
      liveByPlayerId[ls.playerId] = {
        mu: ls.mu,
        confidence: ls.confidence,
        evidenceUnits: Number(ls.evidenceUnits) || 0,
        lastRatedAt: ls.lastRatedAt,
        status: ls.status,
      };
    });
    for (const playerId of knownParticipantIds) {
      if (liveByPlayerId[playerId]) continue;
      const { data: row } = await serviceClient
        .from('level_states')
        .select('mu,confidence,evidence_units,last_rated_at,status')
        .eq('player_id', playerId)
        .maybeSingle();
      if (row) {
        liveByPlayerId[playerId] = {
          mu: row.mu,
          confidence: row.confidence,
          evidenceUnits: Number(row.evidence_units) || 0,
          lastRatedAt: row.last_rated_at,
          status: row.status,
        };
      }
    }

    // ------------------------------------------------------------------
    // playerStates para el MOTOR: la referencia de fórmula INMUTABLE de este partido
    // (priorSnapshots, Decisión Abierta #2) tiene prioridad para un jugador que ya participó de
    // algún cálculo previo de ESTE partido. El participante RECIÉN asignado por una acción de
    // identidad (sin priorSnapshot posible, es la primera vez que aparece en este partido) usa
    // su estado histórico reconstruido a `validatedAtIso` (get_player_level_state_as_of, Decisión
    // Abierta #2 resuelta por 04_Revision_ChatGPT.md §2) — NUNCA su Nivel actual, que puede
    // haber cambiado en los hasta 17 días (10+7) desde la oficialización original. Cualquier
    // otro jugador sin priorSnapshot (trigger='initial', primera vez que se computa el partido)
    // usa el valor LIVE actual con inactividad ya aplicada (B6-A-05).
    // ------------------------------------------------------------------
    // deno-lint-ignore no-explicit-any
    const priorByPlayerId: Record<string, any> = {};
    // deno-lint-ignore no-explicit-any
    (snapshot.priorSnapshots || []).forEach((p: any) => { priorByPlayerId[p.playerId] = p; });

    const decayAdjustedDict = MLE.buildPlayerStatesDict(
      knownParticipantIds
        .filter((id) => liveByPlayerId[id])
        .map((id) => ({ playerId: id, mu: liveByPlayerId[id].mu, confidence: liveByPlayerId[id].confidence, status: liveByPlayerId[id].status, lastRatedAt: liveByPlayerId[id].lastRatedAt })),
      localMatch.playedAt,
    );

    // deno-lint-ignore no-explicit-any
    const playerStates: Record<string, any> = {};
    for (const playerId of knownParticipantIds) {
      const prior = priorByPlayerId[playerId];
      if (prior) {
        playerStates[playerId] = {
          mu: prior.muBefore,
          confidence: prior.confidenceBefore,
          state: MLE.mapLevelStateStatusToEngineState(prior.state),
        };
        continue;
      }

      const isFreshIdentityReplacement = !!identityAction
        && identityAction.replacementPlayerId === playerId
        && trigger === 'identity_resolved';
      if (isFreshIdentityReplacement) {
        const cutoff = validatedAtIso || nowIso;
        const { data: asOf } = await serviceClient.rpc('get_player_level_state_as_of', {
          p_player_id: playerId,
          p_cutoff: cutoff,
        });
        if (asOf && Number.isFinite(asOf.mu) && Number.isFinite(asOf.confidence)) {
          // B6-B-02: la confidence histórica reconstruida es CRUDA (tal cual quedó escrita en su
          // momento) — nunca se usa directamente como si ya fuera efectiva. Se le aplica la
          // regla de inactividad (§10.3) usando su lastRatedAt histórico y la fecha del partido
          // (cutoff), igual que a cualquier otro jugador conocido.
          const effectiveConfidence = MLE.computeEffectiveConfidence(asOf.confidence, asOf.lastRatedAt, cutoff);
          playerStates[playerId] = { mu: asOf.mu, confidence: effectiveConfidence, state: MLE.mapLevelStateStatusToEngineState(asOf.status) };
          // C-01: el baseline LIVE inmutable de este jugador para ESTE partido es su estado RAW
          // histórico a la fecha de oficialización original — NUNCA su Nivel actual (que puede
          // incluir partidos jugados durante los hasta 17 días de la ventana de identidad). Sin
          // esto, computeLevelStateUpdates asumiría por defecto el LIVE actual como baseline,
          // perdiendo cualquier efecto que este partido debería aportar por separado.
          liveByPlayerId[playerId] = Object.assign({}, liveByPlayerId[playerId], {
            originalLiveMu: asOf.mu,
            originalLiveConfidence: asOf.confidence,
            originalLiveEvidenceUnits: Number(asOf.evidenceUnits) || 0,
          });
        }
        // Sin `asOf` (nunca tuvo Nivel antes de validatedAtIso): se lo deja sin entrada — se
        // trata como invitado sin Nivel conocido (Nivel_BRAMU_Formula_V1.5.md §13), nunca se
        // usa su Nivel actual como sustituto.
        continue;
      }

      if (decayAdjustedDict[playerId]) {
        playerStates[playerId] = decayAdjustedDict[playerId];
        continue;
      }
      // Identidad recién asignada, sin fila LIVE conocida (nunca tuvo Nivel oficializado) y sin
      // snapshot previo de este partido: se trata como invitado sin Nivel conocido — no se
      // agrega entrada, level-context.js ya resuelve esto correctamente vía §13.
    }

    const oldAppliedResult = snapshot.currentAppliedResult || null;

    // ------------------------------------------------------------------
    // C-06 — una corrección de RESULTADO (mismos 4 participantes) reutiliza los factores
    // contextuales que NO dependen del score (repetición/compañero/círculo/disponibilidad/
    // knownLevelsCount) del resultado vigente ANTES de esta corrección — nunca los recalcula
    // desde el historial ACTUAL, que puede haber cambiado por una anulación/corrección de OTRO
    // encuentro. Solo aplica cuando existe un resultado previo eligible con esos factores ya
    // persistidos; si no (p. ej. nunca fue eligible), cae al camino normal. Una corrección de
    // IDENTIDAD (trigger=identity_resolved/identity_unidentified) SÍ recalcula — la composición
    // cambió, per 10_Revision_Final_Pre_Staging_ChatGPT.md C-06.
    // ------------------------------------------------------------------
    // deno-lint-ignore no-explicit-any
    let officialization: any;
    const canFreezeContext = trigger === 'correction_accepted' && oldAppliedResult && oldAppliedResult.eligible
      && Number.isFinite(oldAppliedResult.knownLevelsCount);
    if (canFreezeContext) {
      const circleFactorByPlayerId: Record<string, boolean> = {};
      // deno-lint-ignore no-explicit-any
      (oldAppliedResult.players || []).forEach((p: any) => {
        circleFactorByPlayerId[p.playerId] = p.circleFactor === LV.PARAMS.CIRCLE_FACTOR_CLOSED;
      });
      officialization = MLE.computeOfficializationResultFrozenContext({
        localMatch,
        playerStates,
        frozenContext: {
          knownLevelsCount: oldAppliedResult.knownLevelsCount,
          repetitionFactorA: oldAppliedResult.repetitionFactorA,
          repetitionFactorB: oldAppliedResult.repetitionFactorB,
          companionFactorA: oldAppliedResult.companionFactorA,
          companionFactorB: oldAppliedResult.companionFactorB,
          circleFactorByPlayerId,
        },
        validatedAtIso,
      });
    } else {
      officialization = MLE.computeOfficializationResult({
        localMatch,
        history,
        playerStates,
        validatedAtIso,
      });
    }

    const engineOutput = officialization.eligible ? officialization.engineOutput : null;
    const guestPlayerIds: string[] = officialization.guestPlayerIds || [];

    const { resultPlayers, levelStateUpdates } = MLE.computeLevelStateUpdates({
      oldAppliedResult,
      engineOutput,
      guestPlayerIds,
      currentLevelStatesByPlayerId: liveByPlayerId,
    });

    const teamStrength = engineOutput ? engineOutput.teamStrength : null;
    const expectation = engineOutput ? engineOutput.expectation : null;
    const rivalPairConfidenceAvg = engineOutput ? engineOutput.rivalPairConfidenceAvg : null;
    const context = officialization.context;

    // B6-A-02: los parámetros jsonb de la RPC reciben ARRAYS/OBJETOS JS directamente — nunca
    // JSON.stringify(...) (eso envía un string escalar, `jsonb_array_elements` no puede
    // recorrerlo — "cannot extract elements from a scalar").
    // deno-lint-ignore no-explicit-any
    const rpcParams: Record<string, unknown> = {
      p_match_id: matchId,
      p_revision_id: revisionId,
      p_trigger: trigger,
      p_actor_player_id: actorPlayerId,
      p_actor_note: actorNote,
      p_eligible: officialization.eligible,
      p_reason_codes: officialization.reasonCodes || [],
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
      p_result_players: resultPlayers,
      p_level_state_updates: levelStateUpdates,
      // Pre-Production P0.1 (revisión central 24/09/2026) — mismo winnerTeam que localMatch ya
      // trae (match-sync.js#deriveWinnerTeam, calculado arriba sobre setsForEngine/formatId de
      // ESTA revisión): se persiste en matches.winner_team para agregados públicos seguros
      // (get_public_profile), nunca una segunda derivación. Presente en los 4 triggers por
      // igual — correction_accepted trae el score corregido, así que también corrige el ganador.
      p_winner_team: localMatch.winnerTeam,
    };
    if (identityAction) {
      rpcParams.p_identity_issue_id = identityAction.issueId;
      rpcParams.p_identity_replacement_player_id = identityAction.replacementPlayerId || null;
    }

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('officialize_match_validation', rpcParams);

    if (rpcError) {
      // Ronda correctiva QA 26SEP (P0 oficialización compartida, handoff §2) — ESTE es el punto
      // exacto que hoy "aplasta rpcError a persist_failed" sin dejar rastro técnico. El error
      // REAL de Postgres (mensaje/código/detail/hint — típicamente una violación de constraint
      // NOT NULL/CHECK si el payload calculado por el motor tiene un campo inesperado, o
      // cualquier otra falla real de la transacción) queda SOLO en los logs de esta Edge
      // Function, nunca en la respuesta al cliente (que sigue recibiendo únicamente
      // `persist_failed`, sin datos sensibles). Loguea también el payload completo que se mandó
      // — necesario para poder correlacionar el error real con la fila exacta que lo disparó,
      // sin tener que reproducir el cálculo desde cero.
      console.error('[officializeMatch] persist_failed — error real de officialize_match_validation', {
        matchId, trigger, attempt,
        message: rpcError.message, details: (rpcError as { details?: unknown }).details,
        hint: (rpcError as { hint?: unknown }).hint, code: (rpcError as { code?: unknown }).code,
        rpcParams,
      });
      return { ok: false, code: 'persist_failed' };
    }
    if (rpcResult && rpcResult.ok === false && (rpcResult.code === 'stale_level_snapshot' || rpcResult.code === 'stale_match_revision')) {
      // Otra oficialización/corrección/identidad concurrente ya movió el estado primero — relee
      // el snapshot fresco y reintenta (acotado). Nunca se aplica un cálculo sobre datos que ya
      // cambiaron.
      console.warn('[officializeMatch] snapshot desactualizado, reintentando', { matchId, trigger, attempt, code: rpcResult.code, playerId: rpcResult.playerId });
      continue;
    }
    // Ronda correctiva QA 26SEP (P0 oficialización compartida) — carrera real detectada en
    // Staging (handoff §2: "ocurrieron con Seba y con Esteban"): dos llamadas concurrentes
    // (los dos integrantes de la pareja rival confirmando casi a la vez, o el reintento
    // "self-healing" que el propio cliente dispara al leer readyForValidation=true —
    // officialize-match/index.ts) pueden ganar la carrera del lock `for update` en distinto
    // orden. La PRIMERA en llegar oficializa normalmente; la SEGUNDA, con trigger='initial',
    // encuentra el partido YA validated y la RPC responde `already_validated` — un resultado
    // de NEGOCIO esperable, nunca un error real. El resultado que esa segunda llamada buscaba
    // (partido validated) YA es cierto en ese momento: se trata como éxito idempotente, releyendo
    // el resultado recién aplicado, en vez de devolver un código de fallo que las 3 Edge
    // Functions convertían en un toast de error (500 en officialize-match, 200 con ok:false en
    // resolve-identity-issue/respond-match-correction) — exactamente el síntoma reportado.
    if (rpcResult && rpcResult.ok === false && rpcResult.code === 'already_validated' && trigger === 'initial') {
      console.warn('[officializeMatch] already_validated en trigger=initial: carrera real, se resuelve como éxito idempotente', { matchId, trigger, attempt });
      const { data: freshSnapshot } = await serviceClient.rpc('get_match_officialization_snapshot', { p_match_id: matchId });
      const applied = freshSnapshot && freshSnapshot.currentAppliedResult;
      return { ok: true, resultId: applied ? applied.resultId : undefined, eligible: applied ? applied.eligible : undefined };
    }
    if (rpcResult && rpcResult.ok === false) {
      console.error('[officializeMatch] rechazado por officialize_match_validation', {
        matchId, trigger, attempt, code: rpcResult.code, playerId: rpcResult.playerId,
      });
      return { ok: false, code: rpcResult.code || 'unknown_error' };
    }

    return { ok: true, resultId: rpcResult && rpcResult.resultId, eligible: rpcResult && rpcResult.eligible };
  }

  console.error('[officializeMatch] stale_snapshot_retries_exhausted', { matchId, trigger, retries: MAX_STALE_SNAPSHOT_RETRIES });
  return { ok: false, code: 'stale_snapshot_retries_exhausted' };
}
