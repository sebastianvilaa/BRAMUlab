/* ==========================================================================
   BRAMU Lab — intelligence-claims.js (Backend Bloque 8, Fase B)
   Capa pura de CLAIMS Y EVIDENCIA para BRAMU Intelligence V1. Cero DOM, cero
   localStorage, cero red — mismo criterio que intelligence-context.js (Fase
   A), sobre el que se apoya EXCLUSIVAMENTE por composición: este archivo no
   modifica ni reabre `intelligence-context.js` (Bloque 8 Fase A, CERRADA en
   Staging) — solo consume su API pública (`PLIntelligenceContext`).

   División de responsabilidad (docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md
   §10, Bloque B): este módulo construye candidatos de insight ESTRUCTURADOS
   con su evidencia, comparabilidad, tamaño de muestra y alcance personal/
   oficial — NUNCA puntúa relevancia (`salienceScore`), NUNCA deduplica
   semánticamente ni aplica memoria editorial/cooldowns (Fase C), NUNCA
   redacta texto ni asigna plantilla (`templateId`, Fase D). Por eso el objeto
   de claim de este módulo es un subconjunto deliberado del contrato completo
   de `BRAMU_Intelligence.md` §12.2: incluye `insightType`, `family`,
   `perspectivePlayerId`, `claim`, `evidenceMatchIds`, `comparisonScope`,
   `sampleSize`, `confidenceTier`, `officialScope`, `dataAsOf` y
   `rulesVersion` — pero deliberadamente NO incluye `salienceScore`,
   `semanticKey` ni `templateId`.

   CONTRATO DE SALIDA: `buildClaimsForMatch(historyAsc, callerPlayerId)`
   devuelve `{ ctx, claims }`, donde `claims` es la lista COMPLETA de
   candidatos evaluados para ese partido — tanto los que sí tienen evidencia
   suficiente (`discarded:false`) como los que se evaluaron y se descartaron
   explícitamente por muestra/umbral insuficiente (`discarded:true` +
   `discardReasonCodes`, mismo criterio que `eligible`/`reason_codes` de
   `match_level_results` y `is_eligible`/`eligibility_reason_codes` de
   `ranking_rows`). Nunca se omite silenciosamente un candidato evaluado: o
   se afirma con evidencia, o se descarta con motivo — "0 claims sin
   evidencia" del criterio absoluto de Intelligence significa exactamente
   esto. Ordenar, elegir 1 principal + hasta 2 secundarios y aplicar
   cooldowns es Fase C — este módulo nunca decide qué se muestra.

   ALCANCE DE FAMILIAS CUBIERTAS EN ESTA RONDA (Implementacion.md §7,
   detectores 1–8, sin Nivel/Ranking):
   - A — estructura del resultado (§5.1);
   - B — hitos, rachas y récords (§5.2/§5.3);
   - C — forma reciente, como evidencia pura sin juicio de "es material" (§5.3);
   - D — compañeros (§5.4);
   - E — rivales, pareja rival exacta y cruce exacto (§5.5);
   - F — patrón histórico de score, solo "resultado excepcional dentro de
     formato comparable" (§5.6, detector 8) y "balance cuando se perdió el
     primer set" (§5.6, ejemplo 2);
   - G — contexto sin Nivel BRAMU, acotado a compañero nuevo, dificultad
     previa frente a un rival y regreso tras inactividad excepcional (§5.7).

   FUERA DE ALCANCE, explícitamente diferido a Fase E (Implementacion.md §10,
   "Integración Nivel + Ranking"): Familia H completa (expectativa,
   calibración, delta de Nivel — detector 9) e hitos de Ranking semanal
   (detector 10). Ninguno de los dos requiere tocar Nivel/Ranking real desde
   Fase B — este módulo no importa ni llama ninguna RPC de Nivel/Ranking.

   Todos los umbrales numéricos (3/4/5/10/etc.) están tomados literalmente de
   `BRAMU_Intelligence.md` §5 — ninguno se inventa acá. Donde el documento no
   fija un número exacto (p. ej. "la diferencia es material" de forma
   reciente, §5.3), este módulo expone el dato comparativo crudo y NO emite
   un juicio de materialidad: esa decisión es de relevancia (Fase C).
   ========================================================================== */
(function (global) {
  'use strict';

  const RULES_VERSION = 'bramu_intelligence_v1';

  // Umbrales cerrados en BRAMU_Intelligence.md §5 — ver comentario de cada builder para la cita exacta.
  const STREAK_SHOWABLE_MIN = 3; // §5.3
  const RECORD_MIN_SAMPLE = 10; // §5.2 "récord personal requiere al menos 10 partidos comparables"
  const COMPANION_HABITUAL_MIN = 4; // §5.4
  const COMPANION_COMPARISON_MIN_EACH = 5; // §5.4 "mejor balance"
  const RIVAL_HABITUAL_MIN = 3; // §5.5
  const RIVAL_TREND_MIN = 4; // §5.5 "tendencia de enfrentamiento"
  const FIRST_WIN_AFTER_LOSSES_MIN = 2; // §5.5 "al menos 2 derrotas previas en el mismo alcance"
  const PAIR_CROSSING_SHOWABLE_MIN = 2; // §5.5 "puede mostrarse desde el segundo antecedente"
  const PAIR_CROSSING_TREND_MIN = 4; // §5.5 "sin hablar de tendencia hasta 4"

  /* ------------------------------------------------------------------ */
  /* 0. ENVOLTORIO COMÚN — contrato de evidencia (§12.2, subconjunto B)   */
  /* ------------------------------------------------------------------ */

  function officialScopeOf(evidenceMatchIds, isOfficialEligible) {
    if (!evidenceMatchIds.length) return 'sin_evidencia';
    const flags = evidenceMatchIds.map((id) => !!isOfficialEligible(id));
    if (flags.every(Boolean)) return 'oficial';
    if (flags.some(Boolean)) return 'mixto';
    return 'personal';
  }

  /** Un claim CON evidencia suficiente. `claim` son los valores estructurados que sustentan la
   *  afirmación — nunca la frase final (eso es Fase D). `officialScope` se deriva SIEMPRE de
   *  `evidenceMatchIds` reales, nunca se asume. */
  function makeClaim({
    insightType, family, perspectivePlayerId, claim, evidenceMatchIds, comparisonScope,
    sampleSize, minSampleRequired, confidenceTier, dataAsOf, isOfficialEligible,
  }) {
    return {
      discarded: false,
      insightType,
      family,
      perspectivePlayerId,
      claim,
      evidenceMatchIds: evidenceMatchIds.slice(),
      comparisonScope,
      sampleSize,
      minSampleRequired,
      confidenceTier,
      officialScope: officialScopeOf(evidenceMatchIds, isOfficialEligible),
      dataAsOf,
      rulesVersion: RULES_VERSION,
      discardReasonCodes: [],
    };
  }

  /** Un candidato SIN evidencia suficiente — se registra explícitamente (nunca se omite en
   *  silencio) para que "0 claims sin evidencia" sea verificable: este candidato fue evaluado y
   *  su motivo de descarte queda auditado, igual que `eligible=false` + `reason_codes` en
   *  `match_level_results`. */
  function makeDiscarded({
    insightType, family, perspectivePlayerId, comparisonScope, sampleSize, minSampleRequired,
    dataAsOf, reasonCodes,
  }) {
    return {
      discarded: true,
      insightType,
      family,
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

  /** Tier de confianza compartido por los 4 alcances relacionales (compañero/rival individual/
   *  pareja rival/cruce exacto) — cada alcance pasa sus propios umbrales (§5.4/§5.5), la
   *  etiqueta resultante ('temprano'/'habitual'/'tendencia') es solo metadata de evidencia, no
   *  redacción: Fase D decide qué palabras usar para cada tier. */
  function relationshipTier(sampleSize, habitualMin, trendMin) {
    if (sampleSize >= trendMin) return 'tendencia';
    if (sampleSize >= habitualMin) return 'habitual';
    return 'temprano';
  }

  function matchIdsOf(summary) { return summary.matches.map((m) => m.matchId); }

  /* ------------------------------------------------------------------ */
  /* A — ESTRUCTURA DEL RESULTADO (§5.1)                                  */
  /* ------------------------------------------------------------------ */

  /** Solo con `winnerTeam` definido: sin resultado no hay estructura que afirmar (un partido
   *  pendiente sin consenso no es evidencia de nada, mismo criterio que Fase A). */
  function buildScoreStructureClaims(ctx, isOfficialEligible) {
    const f = ctx.formatFacts;
    if (!f.winnerTeam) return [];
    const envelope = (insightType, claim) => makeClaim({
      insightType, family: 'A', perspectivePlayerId: ctx.perspective.own.userId, claim,
      evidenceMatchIds: [ctx.matchId], comparisonScope: 'partido_actual', sampleSize: 1,
      minSampleRequired: 1, confidenceTier: 'partido_unico', dataAsOf: ctx.playedAt, isOfficialEligible,
    });
    const out = [envelope(f.setsPlayed === 2 ? 'sets_corridos' : 'definicion_en_tres_sets', {
      setsPlayed: f.setsPlayed, gamesWonByWinner: f.gamesWonByWinner, gamesTotal: f.gamesTotal, marginNormalized: f.marginNormalized,
    })];
    if (f.lostFirstSetWonMatch) out.push(envelope('reversion_tras_perder_primer_set', { perSetWinner: f.perSetWinner }));
    if (f.alternatingSetWinners === true) out.push(envelope('alternancia_de_sets', { perSetWinner: f.perSetWinner }));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* B — HITOS, RACHAS Y RÉCORDS (§5.2/§5.3/§6.2)                         */
  /* ------------------------------------------------------------------ */

  function buildMilestoneClaims(ctx, isOfficialEligible) {
    if (ctx.perspective.result === null) return [];
    const out = [];
    if (ctx.isFirstMatchEver) {
      out.push(makeClaim({
        insightType: 'primer_partido_de_la_historia', family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
        claim: {}, evidenceMatchIds: [ctx.matchId], comparisonScope: 'historial_completo', sampleSize: 1,
        minSampleRequired: 1, confidenceTier: 'primer_antecedente', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    if (ctx.milestones.isFirstWinEver) {
      out.push(makeClaim({
        insightType: 'primera_victoria_registrada', family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
        claim: {}, evidenceMatchIds: [ctx.matchId], comparisonScope: 'historial_completo',
        sampleSize: ctx.milestones.decidedMatches, minSampleRequired: 1, confidenceTier: 'primer_antecedente',
        dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    if (ctx.milestones.winMilestoneReached) {
      out.push(makeClaim({
        insightType: 'hito_de_victorias', family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { winCount: ctx.milestones.winMilestoneReached }, evidenceMatchIds: [ctx.matchId],
        comparisonScope: 'historial_completo', sampleSize: ctx.milestones.decidedMatches,
        minSampleRequired: ctx.milestones.winMilestoneReached, confidenceTier: 'establecido',
        dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    return out;
  }

  /** `decidedSequence` en el mismo orden que ya usa Fase A (`IC.buildDecidedSequence`). Récord
   *  (nuevo o empatado) exige al menos 10 partidos comparables (§5.2) — por debajo de eso se
   *  registra como descartado, nunca se omite ni se afirma "récord" sin la muestra que ese
   *  concepto exige. */
  function buildStreakClaims(ctx, decidedSequence, isOfficialEligible) {
    if (!ctx.streakForThisMatch) return [];
    const { before, after, isRecord, tiesRecord } = ctx.streakForThisMatch;
    const sampleSize = decidedSequence.length;
    const lastN = (n) => decidedSequence.slice(-n).map((e) => e.match.matchId);
    const out = [];

    if (after.length >= STREAK_SHOWABLE_MIN) {
      out.push(makeClaim({
        insightType: after.type === 'win' ? 'racha_de_victorias' : 'racha_de_derrotas', family: 'B',
        perspectivePlayerId: ctx.perspective.own.userId, claim: { type: after.type, length: after.length },
        evidenceMatchIds: lastN(after.length), comparisonScope: 'racha_actual', sampleSize: after.length,
        minSampleRequired: STREAK_SHOWABLE_MIN, confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    if (before && before.type !== after.type && before.length >= STREAK_SHOWABLE_MIN) {
      out.push(makeClaim({
        insightType: 'racha_cortada', family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { previousType: before.type, previousLength: before.length, newType: after.type },
        evidenceMatchIds: [ctx.matchId], comparisonScope: 'racha_anterior', sampleSize: before.length,
        minSampleRequired: STREAK_SHOWABLE_MIN, confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    if ((isRecord || tiesRecord) && after.length >= STREAK_SHOWABLE_MIN) {
      const insightType = isRecord ? 'racha_nuevo_record_personal' : 'racha_iguala_record_personal';
      if (sampleSize >= RECORD_MIN_SAMPLE) {
        out.push(makeClaim({
          insightType, family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
          claim: { type: after.type, length: after.length }, evidenceMatchIds: lastN(after.length),
          comparisonScope: 'historial_completo', sampleSize, minSampleRequired: RECORD_MIN_SAMPLE,
          confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
        }));
      } else {
        out.push(makeDiscarded({
          insightType, family: 'B', perspectivePlayerId: ctx.perspective.own.userId,
          comparisonScope: 'historial_completo', sampleSize, minSampleRequired: RECORD_MIN_SAMPLE,
          dataAsOf: ctx.playedAt, reasonCodes: ['muestra_insuficiente_para_record_personal'],
        }));
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* C — FORMA RECIENTE, como evidencia pura (§5.3)                       */
  /* ------------------------------------------------------------------ */

  /** Expone el balance de los últimos 5 y el de la ventana inmediatamente anterior como HECHO
   *  comparativo — nunca afirma "mejoró"/"empeoró": el documento exige que esa diferencia sea
   *  "material" sin fijar un número, así que decidir si lo es queda para Fase C (relevancia). */
  function buildRecentFormClaim(ctx, decidedSequence, isOfficialEligible) {
    if (!ctx.recentForm5) return null;
    // Ventana inmediatamente anterior a los últimos 5 (los hasta 5 partidos previos a esa
    // ventana, nunca más allá) — la comparación que pide §5.3, expuesta como dato, no como juicio.
    const windowEnd = decidedSequence.length - ctx.recentForm5.sampleSize;
    const priorWindow = decidedSequence.slice(Math.max(0, windowEnd - 5), windowEnd);
    const priorWins = priorWindow.filter((e) => e.perspective.result === 'win').length;
    return makeClaim({
      insightType: 'forma_reciente', family: 'C', perspectivePlayerId: ctx.perspective.own.userId,
      claim: {
        current: { wins: ctx.recentForm5.wins, losses: ctx.recentForm5.losses, sampleSize: ctx.recentForm5.sampleSize },
        previousWindow: { wins: priorWins, losses: priorWindow.length - priorWins, sampleSize: priorWindow.length },
      },
      evidenceMatchIds: ctx.recentForm5.matchIds, comparisonScope: 'ultimos_5', sampleSize: ctx.recentForm5.sampleSize,
      minSampleRequired: 1, confidenceTier: ctx.recentForm5.sampleSize >= 5 ? 'establecido' : 'temprano',
      dataAsOf: ctx.playedAt, isOfficialEligible,
    });
  }

  /* ------------------------------------------------------------------ */
  /* D — COMPAÑEROS (§5.4)                                                */
  /* ------------------------------------------------------------------ */

  function buildCompanionClaims(ctx, isOfficialEligible) {
    const summary = ctx.companion;
    if (!summary) return [];
    const companionId = ctx.perspective.teammate.userId;
    const evidence = matchIdsOf(summary);
    const currentIsWin = ctx.perspective.result === 'win';
    const priorWins = summary.wins - (currentIsWin ? 1 : 0);
    const out = [];

    // Independientes a propósito: si el primer partido juntos también es una victoria, AMBOS
    // hechos son evidencia real simultánea ("primer partido" y "primera victoria" del mismo
    // encuentro) — decidir si mostrar los dos o solo uno es relevancia/diversidad (§6.3), Fase C,
    // nunca una decisión de evidencia de Fase B.
    if (summary.isFirstEncounter) {
      out.push(makeClaim({
        insightType: 'companero_primer_partido_juntos', family: 'D', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { companionPlayerId: companionId }, evidenceMatchIds: [ctx.matchId],
        comparisonScope: `companero:${companionId}`, sampleSize: 1, minSampleRequired: 1,
        confidenceTier: 'primer_antecedente', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    if (currentIsWin && priorWins === 0) {
      out.push(makeClaim({
        insightType: 'companero_primera_victoria_juntos', family: 'D', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { companionPlayerId: companionId, totalMatches: summary.totalMatches }, evidenceMatchIds: evidence,
        comparisonScope: `companero:${companionId}`, sampleSize: summary.decidedMatches, minSampleRequired: 1,
        confidenceTier: 'temprano', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }

    if (summary.decidedMatches >= COMPANION_HABITUAL_MIN) {
      out.push(makeClaim({
        insightType: 'companero_balance', family: 'D', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { companionPlayerId: companionId, wins: summary.wins, losses: summary.losses }, evidenceMatchIds: evidence,
        comparisonScope: `companero:${companionId}`, sampleSize: summary.decidedMatches,
        minSampleRequired: COMPANION_HABITUAL_MIN, confidenceTier: 'habitual', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    } else if (summary.totalMatches >= 2) {
      out.push(makeDiscarded({
        insightType: 'companero_balance', family: 'D', perspectivePlayerId: ctx.perspective.own.userId,
        comparisonScope: `companero:${companionId}`, sampleSize: summary.decidedMatches,
        minSampleRequired: COMPANION_HABITUAL_MIN, dataAsOf: ctx.playedAt,
        reasonCodes: ['muestra_insuficiente_para_companero_habitual'],
      }));
    }
    return out;
  }

  /** "Mejor balance" entre compañeros (§5.4: "al menos 5 partidos juntos y mostrar siempre la
   *  muestra"): recorre TODA `historyAsc` para identificar compañeros distintos — Fase A no
   *  expone un listado de compañeros porque `buildMatchDerivedContext` es por partido puntual;
   *  esta función lo arma por composición de `IC.resolvePerspective`/`IC.computeRelationshipSummary`
   *  ya exportados, sin tocar ni reabrir intelligence-context.js. */
  function buildBestCompanionClaim(historyAsc, callerPlayerId, currentMatch, isOfficialEligible) {
    const IC = global.PLIntelligenceContext;
    const companionIds = new Set();
    (historyAsc || []).forEach((m) => {
      const p = IC.resolvePerspective(m, callerPlayerId);
      const id = p && p.teammate && p.teammate.userId;
      if (id) companionIds.add(id);
    });
    const candidates = Array.from(companionIds)
      .map((id) => ({ id, summary: IC.computeRelationshipSummary(historyAsc, callerPlayerId, IC.relationCompanion(id)) }))
      .filter((c) => c.summary.decidedMatches >= COMPANION_COMPARISON_MIN_EACH);

    if (candidates.length < 2) {
      return makeDiscarded({
        insightType: 'companero_mejor_balance', family: 'D', perspectivePlayerId: callerPlayerId,
        comparisonScope: 'todos_los_companeros', sampleSize: candidates.length, minSampleRequired: 2,
        dataAsOf: currentMatch.playedAt, reasonCodes: ['menos_de_2_companeros_comparables'],
      });
    }
    candidates.sort((a, b) => (
      (b.summary.wins / b.summary.decidedMatches) - (a.summary.wins / a.summary.decidedMatches)
    ) || (a.id < b.id ? -1 : 1));
    const best = candidates[0];
    return makeClaim({
      insightType: 'companero_mejor_balance', family: 'D', perspectivePlayerId: callerPlayerId,
      claim: { companionPlayerId: best.id, wins: best.summary.wins, losses: best.summary.losses, comparedAgainst: candidates.length },
      evidenceMatchIds: matchIdsOf(best.summary), comparisonScope: 'todos_los_companeros',
      sampleSize: best.summary.decidedMatches, minSampleRequired: COMPANION_COMPARISON_MIN_EACH,
      confidenceTier: 'establecido', dataAsOf: currentMatch.playedAt, isOfficialEligible,
    });
  }

  /* ------------------------------------------------------------------ */
  /* E — RIVALES, PAREJA RIVAL EXACTA Y CRUCE EXACTO (§5.5)                */
  /* ------------------------------------------------------------------ */

  /** Común a los 3 alcances de rival (individual/pareja rival/cruce exacto): primer
   *  enfrentamiento, balance con su tier de confianza propio, y "primer triunfo tras derrotas"
   *  (§5.5: "al menos 2 derrotas previas en el mismo alcance"). `habitualMin`/`trendMin` varían
   *  por alcance (ver llamadores). */
  function buildRivalScopeClaims({ scopeLabel, scopeKey, summary, ctx, isOfficialEligible, habitualMin, trendMin, familyOverride }) {
    if (!summary) return [];
    const family = familyOverride || 'E';
    const evidence = matchIdsOf(summary);
    const out = [];

    if (summary.isFirstEncounter) {
      out.push(makeClaim({
        insightType: `${scopeLabel}_primer_enfrentamiento`, family, perspectivePlayerId: ctx.perspective.own.userId,
        claim: { scopeKey }, evidenceMatchIds: [ctx.matchId], comparisonScope: `${scopeLabel}:${scopeKey}`,
        sampleSize: 1, minSampleRequired: 1, confidenceTier: 'primer_antecedente', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }

    if (summary.decidedMatches >= habitualMin) {
      out.push(makeClaim({
        insightType: `${scopeLabel}_balance`, family, perspectivePlayerId: ctx.perspective.own.userId,
        claim: { scopeKey, wins: summary.wins, losses: summary.losses }, evidenceMatchIds: evidence,
        comparisonScope: `${scopeLabel}:${scopeKey}`, sampleSize: summary.decidedMatches, minSampleRequired: habitualMin,
        confidenceTier: relationshipTier(summary.decidedMatches, habitualMin, trendMin), dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    } else if (summary.totalMatches >= 2) {
      out.push(makeDiscarded({
        insightType: `${scopeLabel}_balance`, family, perspectivePlayerId: ctx.perspective.own.userId,
        comparisonScope: `${scopeLabel}:${scopeKey}`, sampleSize: summary.decidedMatches, minSampleRequired: habitualMin,
        dataAsOf: ctx.playedAt, reasonCodes: [`muestra_insuficiente_para_${scopeLabel}_habitual`],
      }));
    }

    const firstWinClaim = buildFirstWinAfterLossesClaim({ scopeLabel, scopeKey, summary, ctx, isOfficialEligible, family });
    if (firstWinClaim) out.push(firstWinClaim);
    return out;
  }

  /** `summary.matches` está en orden cronológico ascendente (Fase A) y, cuando el partido actual
   *  participa del alcance, es siempre el último elemento — se verifica explícitamente antes de
   *  contar hacia atrás, para no atribuir la racha de derrotas de OTRO partido reciente. */
  function buildFirstWinAfterLossesClaim({ scopeLabel, scopeKey, summary, ctx, isOfficialEligible, family }) {
    if (ctx.perspective.result !== 'win') return null;
    const matches = summary.matches;
    if (!matches.length || matches[matches.length - 1].matchId !== ctx.matchId) return null;
    let priorLosses = 0;
    for (let i = matches.length - 2; i >= 0; i--) {
      if (matches[i].result === 'loss') priorLosses += 1;
      else break;
    }
    if (priorLosses < FIRST_WIN_AFTER_LOSSES_MIN) return null;
    return makeClaim({
      insightType: `${scopeLabel}_primer_triunfo_tras_derrotas`, family, perspectivePlayerId: ctx.perspective.own.userId,
      claim: { scopeKey, priorLosses }, evidenceMatchIds: matches.slice(-(priorLosses + 1)).map((m) => m.matchId),
      comparisonScope: `${scopeLabel}:${scopeKey}`, sampleSize: priorLosses + 1,
      minSampleRequired: FIRST_WIN_AFTER_LOSSES_MIN + 1, confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
    });
  }

  function pairKey(idA, idB) { return [idA, idB].slice().sort().join('+'); }

  function buildIndividualRivalClaims(ctx, isOfficialEligible) {
    return (ctx.rivalsIndividual || []).filter(Boolean).flatMap((entry) => buildRivalScopeClaims({
      scopeLabel: 'rival', scopeKey: entry.playerId, summary: entry.summary, ctx, isOfficialEligible,
      habitualMin: RIVAL_HABITUAL_MIN, trendMin: RIVAL_TREND_MIN,
    }));
  }

  function buildRivalPairClaims(ctx, isOfficialEligible) {
    if (!ctx.rivalPair) return [];
    const rivalIds = (ctx.perspective.rivals || []).map((r) => r && r.userId).filter(Boolean);
    return buildRivalScopeClaims({
      scopeLabel: 'pareja_rival', scopeKey: pairKey(rivalIds[0], rivalIds[1]), summary: ctx.rivalPair, ctx, isOfficialEligible,
      habitualMin: RIVAL_HABITUAL_MIN, trendMin: RIVAL_TREND_MIN,
    });
  }

  /** Cruce exacto: umbrales más bajos por diseño (§5.5 — "puede mostrarse desde el segundo
   *  antecedente porque su especificidad ya es alta, pero sin hablar de tendencia hasta 4"). */
  function buildExactPairCrossingClaims(ctx, isOfficialEligible) {
    if (!ctx.exactPairCrossing) return [];
    const rivalIds = (ctx.perspective.rivals || []).map((r) => r && r.userId).filter(Boolean);
    const teammateId = ctx.perspective.teammate && ctx.perspective.teammate.userId;
    const scopeKey = `${teammateId}_vs_${pairKey(rivalIds[0], rivalIds[1])}`;
    return buildRivalScopeClaims({
      scopeLabel: 'cruce_exacto', scopeKey, summary: ctx.exactPairCrossing, ctx, isOfficialEligible,
      habitualMin: PAIR_CROSSING_SHOWABLE_MIN, trendMin: PAIR_CROSSING_TREND_MIN,
    });
  }

  /* ------------------------------------------------------------------ */
  /* F — PATRÓN HISTÓRICO DE SCORE (§5.6, detector 8)                      */
  /* ------------------------------------------------------------------ */

  /** "Score excepcional dentro de formatos comparables" (Implementacion.md §7, detector 8):
   *  compara el margen normalizado del partido actual contra TODOS los partidos decididos del
   *  mismo `formatKey` — exige la misma muestra mínima que un récord (§5.2, ≥10 comparables,
   *  reusando el mismo criterio que la sección 5.6 ejemplifica con "14 partidos de formato
   *  comparable"). Recorre `decidedSequence` con `IC.computeFormatFacts` ya exportado por Fase
   *  A — no agrega ningún campo nuevo a Fase A. */
  function buildComparableFormatExtremeClaim(ctx, decidedSequence, isOfficialEligible) {
    const IC = global.PLIntelligenceContext;
    const currentFormatKey = ctx.formatFacts.formatKey;
    if (!currentFormatKey || ctx.formatFacts.marginNormalized === null) return null;

    const comparable = decidedSequence
      .map((entry) => ({ matchId: entry.match.matchId, facts: IC.computeFormatFacts(entry.match) }))
      .filter((e) => e.facts.formatKey === currentFormatKey && e.facts.marginNormalized !== null);

    if (comparable.length < RECORD_MIN_SAMPLE) {
      return makeDiscarded({
        insightType: 'score_excepcional_formato_comparable', family: 'F', perspectivePlayerId: ctx.perspective.own.userId,
        comparisonScope: `formato_comparable:${currentFormatKey}`, sampleSize: comparable.length,
        minSampleRequired: RECORD_MIN_SAMPLE, dataAsOf: ctx.playedAt, reasonCodes: ['muestra_insuficiente_de_formato_comparable'],
      });
    }
    const margins = comparable.map((e) => e.facts.marginNormalized);
    const min = Math.min.apply(null, margins);
    const max = Math.max.apply(null, margins);
    const current = ctx.formatFacts.marginNormalized;
    let extreme = null;
    if (current === min) extreme = 'mas_ajustado';
    else if (current === max) extreme = 'mas_amplio';
    if (!extreme) {
      return makeDiscarded({
        insightType: 'score_excepcional_formato_comparable', family: 'F', perspectivePlayerId: ctx.perspective.own.userId,
        comparisonScope: `formato_comparable:${currentFormatKey}`, sampleSize: comparable.length,
        minSampleRequired: RECORD_MIN_SAMPLE, dataAsOf: ctx.playedAt, reasonCodes: ['no_es_extremo_de_la_muestra'],
      });
    }
    return makeClaim({
      insightType: 'score_excepcional_formato_comparable', family: 'F', perspectivePlayerId: ctx.perspective.own.userId,
      claim: { extreme, marginNormalized: current }, evidenceMatchIds: comparable.map((e) => e.matchId),
      comparisonScope: `formato_comparable:${currentFormatKey}`, sampleSize: comparable.length,
      minSampleRequired: RECORD_MIN_SAMPLE, confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
    });
  }

  /** Balance histórico cuando el propio equipo perdió el primer set (§5.6, ejemplo: "Hasta hoy
   *  habías perdido los dos partidos registrados en los que cediste el primer set"). No
   *  requiere ningún derivado nuevo de Fase A: reconstruye `perSetWinner[0]` de cada partido
   *  histórico con `IC.computeFormatFacts`, ya exportado. */
  function buildLostFirstSetBalanceClaim(ctx, decidedSequence, isOfficialEligible) {
    if (!ctx.formatFacts.winnerTeam || !ctx.formatFacts.perSetWinner.length) return null;
    const IC = global.PLIntelligenceContext;
    const own = ctx.perspective.own;
    const lostFirstSetMatches = [];
    decidedSequence.forEach((entry) => {
      const p = IC.resolvePerspective(entry.match, own.userId);
      if (!p) return;
      const facts = IC.computeFormatFacts(entry.match);
      if (facts.perSetWinner.length && facts.perSetWinner[0] && facts.perSetWinner[0] !== p.own.team) {
        lostFirstSetMatches.push({ matchId: entry.match.matchId, result: p.result });
      }
    });
    const currentLostFirstSet = ctx.formatFacts.perSetWinner[0] && ctx.formatFacts.perSetWinner[0] !== own.team;
    if (!currentLostFirstSet) return null;
    if (!lostFirstSetMatches.length || lostFirstSetMatches[lostFirstSetMatches.length - 1].matchId !== ctx.matchId) return null;

    const wins = lostFirstSetMatches.filter((m) => m.result === 'win').length;
    return makeClaim({
      insightType: 'balance_perdiendo_primer_set', family: 'F', perspectivePlayerId: own.userId,
      claim: { wins, losses: lostFirstSetMatches.length - wins }, evidenceMatchIds: lostFirstSetMatches.map((m) => m.matchId),
      comparisonScope: 'historial_completo_perdiendo_primer_set', sampleSize: lostFirstSetMatches.length,
      minSampleRequired: 1, confidenceTier: lostFirstSetMatches.length >= 5 ? 'establecido' : 'temprano',
      dataAsOf: ctx.playedAt, isOfficialEligible,
    });
  }

  /* ------------------------------------------------------------------ */
  /* G — CONTEXTO Y DIFICULTAD SIN NIVEL BRAMU (§5.7)                     */
  /* ------------------------------------------------------------------ */

  /** Acotado a 3 de los bullets de §5.7 que ya tienen evidencia lista en el contexto de Fase A:
   *  compañero nuevo, dificultad previa frente a un rival (incluye "nunca le había ganado" como
   *  caso particular de `priorWins===0`) y regreso tras inactividad excepcional. "Formato
   *  infrecuente" y "dentro/fuera de forma reciente" quedan fuera de esta ronda (ver informe de
   *  resultado): el primero no tiene un umbral de "infrecuente" definido en la fuente, el
   *  segundo ya es exactamente `buildRecentFormClaim`. */
  function buildContextClaims(ctx, isOfficialEligible) {
    const out = [];
    if (ctx.companion && ctx.companion.isFirstEncounter) {
      out.push(makeClaim({
        insightType: 'contexto_companero_nuevo', family: 'G', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { companionPlayerId: ctx.perspective.teammate.userId }, evidenceMatchIds: [ctx.matchId],
        comparisonScope: `companero:${ctx.perspective.teammate.userId}`, sampleSize: 1, minSampleRequired: 1,
        confidenceTier: 'temprano', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    (ctx.rivalsIndividual || []).forEach((entry) => {
      if (!entry) return;
      const currentIsWin = ctx.perspective.result === 'win';
      const priorWins = entry.summary.wins - (currentIsWin ? 1 : 0);
      const priorLosses = entry.summary.losses - (!currentIsWin && ctx.perspective.result === 'loss' ? 1 : 0);
      if (priorWins === 0 && priorLosses >= 1) {
        const priorMatchIds = entry.summary.matches
          .filter((m) => m.matchId !== ctx.matchId)
          .map((m) => m.matchId);
        out.push(makeClaim({
          insightType: 'contexto_dificultad_previa_rival', family: 'G', perspectivePlayerId: ctx.perspective.own.userId,
          claim: { rivalPlayerId: entry.playerId, priorWins, priorLosses, neverWonBefore: true },
          evidenceMatchIds: priorMatchIds, comparisonScope: `rival:${entry.playerId}`,
          sampleSize: priorWins + priorLosses, minSampleRequired: 1,
          confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
        }));
      }
    });
    if (ctx.inactivity && ctx.inactivity.isExceptional) {
      out.push(makeClaim({
        insightType: 'contexto_regreso_tras_inactividad', family: 'G', perspectivePlayerId: ctx.perspective.own.userId,
        claim: { daysSincePrevious: ctx.inactivity.daysSincePrevious, threshold: ctx.inactivity.threshold },
        evidenceMatchIds: [ctx.matchId], comparisonScope: 'historial_completo', sampleSize: 1, minSampleRequired: 1,
        confidenceTier: 'establecido', dataAsOf: ctx.playedAt, isOfficialEligible,
      }));
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* ORQUESTADOR                                                          */
  /* ------------------------------------------------------------------ */

  /** `historyAsc` es la MISMA historia personal truncada (contrato de Fase A: ascendente, hasta
   *  el partido de interés inclusive) que ya consume `IC.buildMatchDerivedContext`. Devuelve
   *  `{ ctx, claims }` — `ctx` para que el llamador (Fase C en el futuro, o un fixture de
   *  prueba) pueda inspeccionar los derivados crudos sin recalcularlos, `claims` con TODOS los
   *  candidatos evaluados (afirmados o descartados, nunca omitidos). `null`/`{ctx:null,
   *  claims:[]}` si Fase A no pudo armar contexto (historia vacía o el caller no participó del
   *  último partido) — nunca se inventa evidencia para compensar. */
  function buildClaimsForMatch(historyAsc, callerPlayerId) {
    const IC = global.PLIntelligenceContext;
    const ctx = IC.buildMatchDerivedContext(historyAsc, callerPlayerId);
    if (!ctx) return { ctx: null, claims: [] };

    const isOfficialEligible = (matchId) => {
      const match = (historyAsc || []).find((m) => m.matchId === matchId);
      return !!(match && match.officialEligible);
    };
    const decidedSequence = IC.buildDecidedSequence(historyAsc, callerPlayerId);

    const claims = [
      ...buildScoreStructureClaims(ctx, isOfficialEligible),
      ...buildMilestoneClaims(ctx, isOfficialEligible),
      ...buildStreakClaims(ctx, decidedSequence, isOfficialEligible),
      ...buildCompanionClaims(ctx, isOfficialEligible),
      ...buildIndividualRivalClaims(ctx, isOfficialEligible),
      ...buildRivalPairClaims(ctx, isOfficialEligible),
      ...buildExactPairCrossingClaims(ctx, isOfficialEligible),
      ...buildContextClaims(ctx, isOfficialEligible),
    ];

    const recentForm = buildRecentFormClaim(ctx, decidedSequence, isOfficialEligible);
    if (recentForm) claims.push(recentForm);

    const bestCompanion = buildBestCompanionClaim(historyAsc, callerPlayerId, ctx, isOfficialEligible);
    if (bestCompanion) claims.push(bestCompanion);

    const comparableFormatExtreme = buildComparableFormatExtremeClaim(ctx, decidedSequence, isOfficialEligible);
    if (comparableFormatExtreme) claims.push(comparableFormatExtreme);

    const lostFirstSetBalance = buildLostFirstSetBalanceClaim(ctx, decidedSequence, isOfficialEligible);
    if (lostFirstSetBalance) claims.push(lostFirstSetBalance);

    return { ctx, claims };
  }

  global.PLIntelligenceClaims = {
    RULES_VERSION,
    STREAK_SHOWABLE_MIN,
    RECORD_MIN_SAMPLE,
    COMPANION_HABITUAL_MIN,
    COMPANION_COMPARISON_MIN_EACH,
    RIVAL_HABITUAL_MIN,
    RIVAL_TREND_MIN,
    FIRST_WIN_AFTER_LOSSES_MIN,
    PAIR_CROSSING_SHOWABLE_MIN,
    PAIR_CROSSING_TREND_MIN,
    buildScoreStructureClaims,
    buildMilestoneClaims,
    buildStreakClaims,
    buildRecentFormClaim,
    buildCompanionClaims,
    buildBestCompanionClaim,
    buildIndividualRivalClaims,
    buildRivalPairClaims,
    buildExactPairCrossingClaims,
    buildComparableFormatExtremeClaim,
    buildLostFirstSetBalanceClaim,
    buildContextClaims,
    buildClaimsForMatch,
  };
})(typeof window !== 'undefined' ? window : globalThis);
