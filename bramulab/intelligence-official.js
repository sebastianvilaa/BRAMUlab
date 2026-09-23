/* ==========================================================================
   BRAMU Lab — intelligence-official.js (Backend Bloque 8, Fase E)
   Capa pura de INTEGRACIÓN NIVEL BRAMU para BRAMU Intelligence V1 (Familia H,
   BRAMU_Intelligence.md §5.8/§6.2/§13.2). Cero DOM, cero localStorage, cero
   red, cero SQL — mismo criterio que intelligence-claims.js (Fase B), del
   que reproduce el contrato de claim EXACTO (nunca lo reabre ni lo importa:
   `makeClaim`/`makeDiscarded` son privados a ese módulo). Este módulo NUNCA
   recalcula Nivel BRAMU: solo traduce un snapshot YA PERSISTIDO y vigente
   (`match_level_results`/`match_level_result_players`, tabla `applied` —
   ver `buildLevelSnapshot`) a claims del mismo contrato que ya entiende
   Fase C, para que el motor de selección existente (`buildEditorialDecision`)
   decida si merecen mostrarse exactamente con la misma lógica que el resto.

   División de responsabilidad (handoff Bloque_08/25_Handoff_Fase_E_Claude.md
   §3-4): NUNCA deriva expectativa desde niveles ACTUALES (`level_states`) —
   solo desde el snapshot congelado al momento del partido. Solo el resultado
   `effect_status='applied'` alimenta Intelligence; uno `reverted` nunca
   llega a este módulo (el llamador ya filtra por eso, ver `buildLevelSnapshot`).
   Reglas V1 de elegibilidad tomadas literalmente de la fuente (nunca
   inventadas acá):
     - por encima de expectativa: victoria, expectativa propia <=35%, 4
       niveles conocidos, confianza prepartido >=0,60 en los CUATRO;
     - pareja por debajo: victoria, expectativa 36%-44%, misma calidad de
       evidencia (4 conocidos, confianza >=0,60 en los cuatro);
     - equilibrado 45%-55%: NUNCA genera un insight de dificultad por sí solo
       (nunca se afirma, ni siquiera como candidato débil);
     - resultado esperable (expectativa >=65%): solo explica por qué el Nivel
       cambió poco, nunca festejo;
     - 3 niveles conocidos: lenguaje acotado ("con los niveles disponibles,
       tu pareja partía por debajo"), nunca "sorpresa"/"batacazo"/"triunfo de
       alto valor" — eso lo garantiza la plantilla de Fase D, nunca este
       módulo (que solo entrega el claim estructurado);
     - 2 niveles conocidos o algún nivel calibrando: nunca clasifica
       dificultad — solo "evidencia limitada"/"sigue calibrando";
     - variación: SIEMPRE el delta oficial ya aplicado (`delta_capped`/
       `mu_after` de `match_level_result_players`), nunca una resta contra
       el Nivel EN VIVO del jugador.
   "Nuevo mejor Nivel BRAMU" (§4.8 de la fuente) — DECISIÓN ABIERTA, no
   implementado esta ronda: el backend real no persiste un historial de
   picos de Nivel del jugador (solo el valor `mu`/confianza vigentes), e
   inferirlo desde el estado EN VIVO violaría la regla de nunca usar Nivel
   actual para un partido antiguo (§13.2 de la fuente). Documentado, no
   bloqueante — la fuente explícitamente autoriza esta omisión ("si el
   backend actual no conserva un dato histórico suficiente... no inferirlo
   desde el estado live actual").
   "Estabilidad de Nivel cuando el delta es pequeño" (§4.8) tampoco es un
   claim separado esta ronda: `nivel_resultado_esperable` ya cubre
   exactamente ese caso (expectativa alta -> delta chico) y `nivel_variacion`
   ya reporta el número exacto sin importar la magnitud — un tercer claim
   describiendo lo mismo sería una historia duplicada (§6.3), no una nueva.
   ========================================================================== */
(function (global) {
  'use strict';

  const RULES_VERSION = 'bramu_intelligence_official_v1';

  // Umbrales cerrados en BRAMU_Intelligence.md §5.8 / handoff §4 — ninguno se inventa acá.
  const SURPRISE_MAX_EXPECTATION = 0.35;
  const BELOW_EXPECTATION_MIN = 0.36;
  const BELOW_EXPECTATION_MAX = 0.44;
  const BALANCED_MIN = 0.45;
  const BALANCED_MAX = 0.55;
  const EXPECTED_RESULT_MIN_EXPECTATION = 0.65;
  const MIN_CONFIDENCE_FOR_STRONG_CLAIM = 0.60;

  /* ------------------------------------------------------------------ */
  /* 0. Snapshot — traducción 1 a 1 de las filas ya persistidas           */
  /* ------------------------------------------------------------------ */

  /** `resultRow`/`playerRows`: filas crudas (snake_case) de `match_level_results`/
   *  `match_level_result_players` para UN `match_id`, ya filtradas por el llamador a
   *  `effect_status='applied'` (nunca este módulo decide esa condición — el llamador, server-
   *  side, es quien tiene la sola-fila-vigente-por-partido garantizada por el índice único de la
   *  base). `null` si no hay fila aplicada (partido todavía pendiente/no officializado, o su
   *  único resultado fue revertido sin reemplazo) — nunca se inventa un snapshot vacío con
   *  `eligible:false` para simular "no hay datos": la ausencia real de fila es distinguible de
   *  un resultado presente pero no elegible. */
  function buildLevelSnapshot(resultRow, playerRows) {
    if (!resultRow) return null;
    return {
      resultId: resultRow.result_id,
      matchId: resultRow.match_id,
      algorithmVersion: resultRow.algorithm_version,
      eligible: !!resultRow.eligible,
      reasonCodes: Array.isArray(resultRow.reason_codes) ? resultRow.reason_codes.slice() : [],
      knownLevelsCount: resultRow.known_levels_count,
      teamStrengthA: resultRow.team_strength_a,
      teamStrengthB: resultRow.team_strength_b,
      expectationA: resultRow.expectation_a,
      expectationB: resultRow.expectation_b,
      rivalPairConfidenceAvgA: resultRow.rival_pair_confidence_avg_a,
      rivalPairConfidenceAvgB: resultRow.rival_pair_confidence_avg_b,
      margin: resultRow.margin,
      effectStatus: resultRow.effect_status,
      players: (Array.isArray(playerRows) ? playerRows : []).map((p) => ({
        playerId: p.player_id,
        team: p.team,
        formulaMuBefore: p.formula_mu_before,
        formulaConfidenceBefore: p.formula_confidence_before,
        formulaState: p.formula_state,
        effectiveLevel: p.effective_level,
        deltaRaw: p.delta_raw,
        deltaCapped: p.delta_capped,
        evidenceQuality: p.evidence_quality,
        muAfter: p.mu_after,
        confidenceAfter: p.confidence_after,
      })),
    };
  }

  /** Subconjunto MÍNIMO del snapshot que debe viajar dentro del fingerprint de historia de Fase
   *  D (handoff §6) — nunca el snapshot completo (innecesario) ni el estado EN VIVO del jugador.
   *  `null` explícito representa "sin snapshot oficial vigente" — nunca se omite el campo (un
   *  partido pending vs. uno validated deben producir fingerprints DISTINTOS, nunca el mismo por
   *  ausencia silenciosa de este bloque). */
  function fingerprintFieldsOf(snapshot) {
    if (!snapshot) return { hasOfficialSnapshot: false };
    return {
      hasOfficialSnapshot: true,
      resultId: snapshot.resultId,
      algorithmVersion: snapshot.algorithmVersion,
      eligible: snapshot.eligible,
      reasonCodes: snapshot.reasonCodes.slice().sort(),
      knownLevelsCount: snapshot.knownLevelsCount,
      expectationA: snapshot.expectationA,
      expectationB: snapshot.expectationB,
      teamStrengthA: snapshot.teamStrengthA,
      teamStrengthB: snapshot.teamStrengthB,
      effectStatus: snapshot.effectStatus,
      players: snapshot.players
        .map((p) => ({ playerId: p.playerId, team: p.team, deltaCapped: p.deltaCapped, muAfter: p.muAfter, confidenceAfter: p.confidenceAfter, formulaState: p.formulaState }))
        .slice()
        .sort((a, b) => (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0)),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 1. Envoltorio de claim — MISMO contrato que Fase B (nunca la reabre) */
  /* ------------------------------------------------------------------ */

  function makeOfficialClaim({ insightType, claim, evidenceMatchIds, comparisonScope, sampleSize, minSampleRequired, confidenceTier, perspectivePlayerId, dataAsOf }) {
    return {
      discarded: false,
      insightType,
      family: 'H',
      perspectivePlayerId,
      claim,
      evidenceMatchIds: evidenceMatchIds.slice(),
      comparisonScope,
      sampleSize,
      minSampleRequired,
      confidenceTier,
      // Nivel BRAMU solo existe para partidos computables/validados (Bloque 6, precondición de
      // `officialize_match_validation`) — un claim de Familia H es SIEMPRE alcance oficial,
      // nunca personal/mixto (nunca se deriva de `evidenceMatchIds`, a diferencia de Fase B).
      officialScope: 'oficial',
      dataAsOf,
      rulesVersion: RULES_VERSION,
      discardReasonCodes: [],
    };
  }

  function makeDiscardedOfficial({ insightType, comparisonScope, sampleSize, minSampleRequired, perspectivePlayerId, dataAsOf, reasonCodes }) {
    return {
      discarded: true,
      insightType,
      family: 'H',
      perspectivePlayerId,
      claim: null,
      evidenceMatchIds: [],
      comparisonScope,
      sampleSize,
      minSampleRequired,
      confidenceTier: null,
      officialScope: null,
      dataAsOf,
      rulesVersion: RULES_VERSION,
      discardReasonCodes: reasonCodes,
    };
  }

  function confidenceTierFor(knownLevelsCount, minConfidence) {
    if (knownLevelsCount >= 4 && minConfidence >= MIN_CONFIDENCE_FOR_STRONG_CLAIM) return 'establecido';
    if (knownLevelsCount === 3) return 'habitual';
    return 'temprano';
  }

  /* ------------------------------------------------------------------ */
  /* 2. Perspectiva — misma resolución que Fase A, nunca reimplementada   */
  /*    de otra forma: equipo/resultado del caller vienen del PARTIDO,    */
  /*    nunca del snapshot (que no guarda winnerTeam).                    */
  /* ------------------------------------------------------------------ */

  function resolveCallerTeamAndResult(match, callerPlayerId) {
    const players = (match && match.players) || [];
    const own = players.find((p) => p && p.userId === callerPlayerId);
    if (!own) return null;
    const result = (match.winnerTeam === 'A' || match.winnerTeam === 'B')
      ? (match.winnerTeam === own.team ? 'win' : 'loss')
      : null;
    return { team: own.team, result };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Claims de Familia H — uno por regla V1, siempre afirma o descarta */
  /* ------------------------------------------------------------------ */

  /** `match`: el partido ACTUAL (último elemento de `historyAsc`, mismo contrato que Fase A —
   *  nunca un partido distinto). `snapshot`: `buildLevelSnapshot(...)` para `match.matchId`, o
   *  `null` si no existe fila `applied` (partido todavía sin efecto oficial). Devuelve SIEMPRE un
   *  array (nunca `null`) — vacío si no hay snapshot o el resultado no es elegible (handoff §12,
   *  pruebas 1/2: "0 claims H" en ambos casos, sin discardReasonCodes sintéticos que simulen una
   *  evaluación que nunca ocurrió). H01 (hardening, defensa en profundidad): un partido con
   *  identidad todavía abierta nunca produce Familia H, aunque en la práctica nunca debería tener
   *  snapshot (Bloque 6 exige identidad resuelta antes de officializar). */
  function buildLevelClaims(snapshot, match, callerPlayerId) {
    if (!snapshot || !match || match.hasOpenIdentityIssue) return [];
    if (!snapshot.eligible) return [];
    const perspective = resolveCallerTeamAndResult(match, callerPlayerId);
    if (!perspective || perspective.result === null) return [];

    const dataAsOf = match.playedAt;
    const evidenceMatchIds = [match.matchId];
    const knownLevelsCount = snapshot.knownLevelsCount;
    const expectationOwn = perspective.team === 'A' ? snapshot.expectationA : snapshot.expectationB;
    const callerRow = snapshot.players.find((p) => p.playerId === callerPlayerId);
    const confidences = snapshot.players.map((p) => p.formulaConfidenceBefore);
    const minConfidence = confidences.length ? Math.min.apply(null, confidences) : 0;
    const anyCalibrating = snapshot.players.some((p) => p.formulaState === 'CALIBRANDO');
    const claims = [];

    // --- por_encima_expectativa / pareja_por_debajo (4 niveles conocidos, confianza fuerte) ---
    // Cascada ÚNICA y excluyente por `knownLevelsCount` — nunca ramas paralelas evaluando la
    // misma combinación de condiciones por separado: una versión anterior de este mismo archivo,
    // detectada y corregida antes de commitear, dejaba sin cubrir "4 niveles conocidos, ninguno
    // formalmente CALIBRANDO, pero confianza mínima igual por debajo de 0,60" — esa combinación
    // no calzaba en ninguna rama y desaparecía en silencio en vez de caer en evidencia limitada.
    const fourKnownStrongEvidence = knownLevelsCount === 4 && minConfidence >= MIN_CONFIDENCE_FOR_STRONG_CLAIM && !anyCalibrating;
    // Revisión Central Fase E (E03): `nivel_evidencia_limitada` NUNCA puede decir "tu Nivel
    // sigue calibrando" cuando la limitación viene de OTRO participante (rival/pareja) con el
    // caller ya `CALIBRADO` — eso sería factualmente falso para el jugador de perspectiva. El
    // claim ahora declara explícitamente `callerCalibrating` (derivado del propio `callerRow`,
    // nunca de `anyCalibrating`, que mezcla a los cuatro); la plantilla de Fase D decide el copy
    // exacto según ESTE campo, nunca según si "alguien" está calibrando.
    const callerCalibrating = !!(callerRow && callerRow.formulaState === 'CALIBRANDO');
    if (perspective.result === 'win' && expectationOwn != null) {
      if (knownLevelsCount === 4) {
        if (!fourKnownStrongEvidence) {
          // §4.6 — 4 conocidos pero evidencia débil (confianza <0,60 en alguno, o alguno
          // todavía CALIBRANDO): nunca clasifica dificultad, solo evidencia limitada.
          claims.push(makeOfficialClaim({
            insightType: 'nivel_evidencia_limitada', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
            claim: { knownLevelsCount, anyCalibrating, minConfidence, callerCalibrating },
            comparisonScope: 'nivel_oficial_partido_actual', sampleSize: knownLevelsCount, minSampleRequired: 4,
            confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
          }));
        } else if (expectationOwn <= SURPRISE_MAX_EXPECTATION) {
          claims.push(makeOfficialClaim({
            insightType: 'nivel_por_encima_expectativa', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
            claim: { expectationOwn, knownLevelsCount, minConfidence, deltaCapped: callerRow ? callerRow.deltaCapped : null },
            comparisonScope: 'nivel_oficial_partido_actual', sampleSize: 4, minSampleRequired: 4,
            confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
          }));
        } else if (expectationOwn >= BELOW_EXPECTATION_MIN && expectationOwn <= BELOW_EXPECTATION_MAX) {
          claims.push(makeOfficialClaim({
            insightType: 'nivel_pareja_por_debajo', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
            claim: { expectationOwn, knownLevelsCount, minConfidence, deltaCapped: callerRow ? callerRow.deltaCapped : null },
            comparisonScope: 'nivel_oficial_partido_actual', sampleSize: 4, minSampleRequired: 4,
            confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
          }));
        } else if (expectationOwn >= BALANCED_MIN && expectationOwn <= BALANCED_MAX) {
          // §4.3 — equilibrado: nunca genera insight de dificultad por sí solo. Se audita como
          // descarte explícito, nunca se omite en silencio (mismo criterio que Fase B).
          claims.push(makeDiscardedOfficial({
            insightType: 'nivel_pareja_equilibrada', perspectivePlayerId: callerPlayerId, dataAsOf,
            comparisonScope: 'nivel_oficial_partido_actual', sampleSize: knownLevelsCount, minSampleRequired: 4,
            reasonCodes: ['expectativa_equilibrada_sin_insight'],
          }));
        }
        // Fuera de estos rangos (56%-64%) ninguna regla V1 cubre el caso — no se inventa un
        // claim ni un descarte sintético para una zona que la fuente no definió.
      } else if (knownLevelsCount === 3) {
        if (expectationOwn <= BELOW_EXPECTATION_MAX) {
          // §4.5 — 3 niveles conocidos: lenguaje acotado, nunca "sorpresa"/"batacazo" (lo
          // garantiza la plantilla de Fase D; este claim solo entrega el dato estructurado).
          claims.push(makeOfficialClaim({
            insightType: 'nivel_tres_niveles_pareja_por_debajo', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
            claim: { expectationOwn, knownLevelsCount },
            comparisonScope: 'nivel_oficial_partido_actual', sampleSize: 3, minSampleRequired: 3,
            confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
          }));
        }
      } else {
        // §4.6 — 2 niveles conocidos (o menos): nunca clasifica dificultad.
        claims.push(makeOfficialClaim({
          insightType: 'nivel_evidencia_limitada', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
          claim: { knownLevelsCount, anyCalibrating, minConfidence, callerCalibrating },
          comparisonScope: 'nivel_oficial_partido_actual', sampleSize: knownLevelsCount, minSampleRequired: 4,
          confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
        }));
      }
    }

    // Revisión Central Fase E (E05): expectativa >=65% + victoria — "resultado esperable".
    // `nivel_resultado_esperable` sigue existiendo como claim AUDITABLE (queda en `allClaims`,
    // reconstruible), pero su perfil editorial (`genericScoreOnly`, categoría 2 de baja
    // excepcionalidad) hace que estructuralmente NUNCA supere el umbral de publicación por sí
    // solo — nunca es "código muerto que decide la salida", es evidencia de auditoría que Fase C
    // puede seguir viendo/puntuando igual. La pieza que SÍ puede ser visible es
    // `nivel_variacion` (más abajo): se enriquece con `wasExpectedResult`/`expectationOwn` para
    // que, cuando gane, su propia plantilla pueda explicar el contexto favorable previo sin
    // depender de que `nivel_resultado_esperable` llegue a mostrarse — nunca dos historias H
    // contando lo mismo (nunca ambas terminan visibles a la vez: son la MISMA familia H, y C ya
    // limita a 1 principal + secundarios de familias distintas).
    const wasExpectedResult = perspective.result === 'win' && expectationOwn != null && expectationOwn >= EXPECTED_RESULT_MIN_EXPECTATION;
    if (wasExpectedResult) {
      claims.push(makeOfficialClaim({
        insightType: 'nivel_resultado_esperable', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
        claim: { expectationOwn, knownLevelsCount, deltaCapped: callerRow ? callerRow.deltaCapped : null },
        comparisonScope: 'nivel_oficial_partido_actual', sampleSize: knownLevelsCount, minSampleRequired: 1,
        confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
      }));
    }

    // --- variación (§4.7): delta oficial exacto del caller, siempre disponible si hay fila propia ---
    if (callerRow) {
      claims.push(makeOfficialClaim({
        insightType: 'nivel_variacion', perspectivePlayerId: callerPlayerId, dataAsOf, evidenceMatchIds,
        claim: {
          deltaCapped: callerRow.deltaCapped, deltaRaw: callerRow.deltaRaw, muAfter: callerRow.muAfter, formulaState: callerRow.formulaState,
          // E05 — nunca se inventa un umbral nuevo de "delta chico": se reusa LITERALMENTE la
          // misma condición ya cerrada de "resultado esperable" (expectativa >=65% + victoria).
          wasExpectedResult, expectationOwn: wasExpectedResult ? expectationOwn : null,
        },
        comparisonScope: 'nivel_oficial_partido_actual', sampleSize: knownLevelsCount, minSampleRequired: 1,
        confidenceTier: confidenceTierFor(knownLevelsCount, minConfidence),
      }));
    }

    return claims;
  }

  /** ¿El propio Nivel BRAMU del caller, según ESTE snapshot puntual, sigue en `CALIBRANDO`? Uso
   *  exclusivo del mensaje de aprendizaje cerrado de Fase D (handoff §4.6/BRAMU_Intelligence.md
   *  §8.1: "Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.") — nunca clasifica
   *  dificultad, solo informa progreso de calibración. `false` sin snapshot (nada que decir
   *  todavía sobre Nivel oficial para este partido puntual). */
  function isCallerCalibratingIn(snapshot, callerPlayerId) {
    if (!snapshot) return false;
    const callerRow = snapshot.players.find((p) => p.playerId === callerPlayerId);
    return !!(callerRow && callerRow.formulaState === 'CALIBRANDO');
  }

  global.PLIntelligenceOfficial = {
    RULES_VERSION,
    buildLevelSnapshot,
    fingerprintFieldsOf,
    buildLevelClaims,
    isCallerCalibratingIn,
  };
})(typeof window !== 'undefined' ? window : globalThis);
