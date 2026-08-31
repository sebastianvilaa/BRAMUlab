/* ==========================================================================
   BRAMU Lab — stats.js (v11)
   Calcula estadísticas REALES a partir de eventos + resolución de saque.
   Reglas duras:
     - El tie break NUNCA contribuye a: breaks, break points, ni games de
       saque ganados/perdidos (el TB no es un game de saque completo de una
       pareja/jugador, el servicio se alterna dentro del propio desempate).
     - V11 (§12): el tie break SÍ contribuye a: puntos ganados totales,
       puntos ganados al saque/al resto (por equipo y por jugador), y
       Set Points / Match Points cuando ocurren dentro del TB. Cada punto de
       TB tiene un sacador conocido (vía resolución de sacador de TB), así
       que sí puede atribuirse a saque/resto — lo único que no tiene es un
       "game de saque" completo que ganar o perder.
     - Si falta información de saque, las métricas que dependen de él se
       omiten (o se marcan `hasServerInfo:false`), nunca se estiman.
   ========================================================================== */
(function (global) {
  'use strict';
  const E = global.PLEngine;

  /** V8 (32-34): rangos aproximados de duración para el cierre narrativo de BRAMU
   *  Intelligence, centralizados para poder ajustarlos sin tocar la lógica. Por debajo de
   *  `devSimulationMaxMs` se asume un partido de prueba generado durante desarrollo (2-5
   *  min) y la duración directamente no se narra: no tiene ningún significado deportivo. */
  const DURATION_RANGES = {
    devSimulationMaxMs: 6 * 60000,
    veryShortMaxMs: 45 * 60000,
    normalMaxMs: 80 * 60000,
  };

  function emptyOpp() { return { A: { opportunities: 0, converted: 0, saved: 0 }, B: { opportunities: 0, converted: 0, saved: 0 } }; }

  /**
   * matchCtx = { players, scoringSystem, format, tiebreakMode, serverKnowledge, baseline }
   */
  function computeStats(events, matchCtx) {
    const { players, scoringSystem, format, tiebreakMode, serverKnowledge } = matchCtx;

    let state = matchCtx.baseline
      ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, matchCtx.baseline)
      : E.createInitialEngineState();

    const totals = { A: 0, B: 0 };
    const goldenPoints = { played: 0, wonA: 0, wonB: 0 };
    const starPoints = { played: 0, wonA: 0, wonB: 0 };
    const serviceGames = { wonA: 0, wonB: 0, lostA: 0, lostB: 0, unknown: 0 };
    const serveStats = { A: { served: 0, wonServing: 0 }, B: { served: 0, wonServing: 0 } };
    const breaks = { A: 0, B: 0 };
    const breakPoints = emptyOpp();
    const setPoints = emptyOpp();
    const matchPoints = emptyOpp();
    const perPlayerServe = {}; // { [playerId]: { games:0, held:0, pointsWon:0, pointsTotal:0 } }
    players.forEach((p) => { perPlayerServe[p.id] = { games: 0, held: 0, pointsWon: 0, pointsTotal: 0 }; });

    let currentStreak = { team: null, count: 0 };
    let maxStreak = { A: 0, B: 0 };
    let leadChanges = 0;
    let lastLeader = null;
    const setDurations = [];
    let lastSetBoundaryMs = 0;
    let matchEndMs = 0;
    let hasAdjustments = false;
    // V12 (§6): games donde se conoce el EQUIPO al saque pero no el jugador individual —
    // ya no caen en `serviceGames.unknown` (el equipo sí se sabe), así que se cuentan aparte
    // para que `serverFullyKnown` conserve su significado real ("el jugador se conoce SIEMPRE").
    let gamesWithUnknownPlayer = 0;

    events.forEach((ev) => {
      matchEndMs = ev.matchTimeMs;

      // Un AJUSTE DE MARCADOR nunca es un punto jugado: reemplaza el estado
      // deportivo, corta cualquier racha en curso (nunca puede "atravesar"
      // un ajuste) y marca que las estadísticas son parciales/discontinuas.
      if (ev.type === 'adjustment') {
        const beforeAdj = state;
        state = E.applyAdjustment(ev.newState);
        currentStreak = { team: null, count: 0 };
        // V12 (§3.1-3.2): un ajuste nunca fabrica lo que no se sabe (orden real, sacador,
        // rachas, BP/SP/MP del tramo salteado) — pero si el tramo queda DENTRO del mismo
        // game y avanza (nunca hacia atrás), el delta de puntos ganados por cada equipo SÍ
        // es un dato seguro: no depende de conocer el orden real de esos puntos, solo de
        // cuántos ganó cada uno. Fuera de ese caso (cruza un game, toca el tie break, o es
        // una corrección hacia atrás) no se conserva nada — mejor sub-reportar que inventar.
        const sameGameForward = beforeAdj.gameIndex === state.gameIndex && !beforeAdj.inTiebreak && !state.inTiebreak
          && state.pointsA >= beforeAdj.pointsA && state.pointsB >= beforeAdj.pointsB;
        if (sameGameForward) {
          totals.A += state.pointsA - beforeAdj.pointsA;
          totals.B += state.pointsB - beforeAdj.pointsB;
        }
        // V12 (§9-14): resolver con Tie break extraordinario (arrancarlo o cambiarle el
        // objetivo en vivo) es una transición DELIBERADA y totalmente conocida — nunca una
        // ambigüedad como AJUSTAR — así que no debe marcar el partido como "datos parciales".
        const isExtraordinaryTbEvent = !!(ev.newState && ev.newState.extraordinaryTiebreak && ev.newState.extraordinaryTiebreak.active);
        if (!isExtraordinaryTbEvent) hasAdjustments = true;
        return;
      }

      const before = state;
      totals[ev.team] += 1;
      const modeForThisPoint = ev.tbMode || tiebreakMode;

      if (currentStreak.team === ev.team) currentStreak.count += 1; else currentStreak = { team: ev.team, count: 1 };
      maxStreak[ev.team] = Math.max(maxStreak[ev.team], currentStreak.count);

      const diff = totals.A - totals.B;
      const leader = diff > 0 ? 'A' : diff < 0 ? 'B' : null;
      if (leader && lastLeader && leader !== lastLeader) leadChanges += 1;
      if (leader) lastLeader = leader;

      const setNumber = before.sets.length + 1;
      const matchGameNumber = E.currentMatchGameNumber(before);
      const withinSetGameNumber = E.currentWithinSetGameNumber(before);
      const resolved = serverKnowledge
        ? (before.inTiebreak
          ? E.resolveTiebreakServer(serverKnowledge, players, setNumber, before.tbBaseGameNumber, before.tbBaseWithinSet, before.tbA + before.tbB)
          : E.resolveServer(serverKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber))
        : { resolved: false };
      // V12 (§6): separar "sabemos qué EQUIPO saca" de "sabemos qué JUGADOR saca" —
      // `resolved.candidateTeam` puede ser conocido aunque `resolved.resolved` (el jugador
      // individual) no lo sea. Antes esta línea descartaba el dato de equipo entero cada vez
      // que el jugador no se conocía, apagando de paso `serveStats`/`serviceGames`/`breaks`
      // de PAREJA (que no dependen del jugador) — bug real de la auditoría del Consolidado.
      const servingTeamKnown = resolved.resolved ? resolved.team : (resolved.candidateTeam || null);
      const servingPlayerId = resolved.resolved ? resolved.playerId : null;

      // Punto de Oro / Star Point disputados y ganados
      if (scoringSystem === 'golden' && !before.inTiebreak) {
        const disp = E.formatPointsDisplay(before.pointsA, before.pointsB, 'golden');
        if (disp.isGoldenPoint) { goldenPoints.played += 1; if (ev.team === 'A') goldenPoints.wonA += 1; else goldenPoints.wonB += 1; }
      }
      if (scoringSystem === 'starpoint' && !before.inTiebreak) {
        const disp = E.formatPointsDisplay(before.pointsA, before.pointsB, 'starpoint');
        if (disp.isStarPoint) { starPoints.played += 1; if (ev.team === 'A') starPoints.wonA += 1; else starPoints.wonB += 1; }
      }

      // Break / Set / Match point: detectados ANTES de jugar este punto
      const importance = E.detectPointImportance(before, scoringSystem, format, modeForThisPoint, servingTeamKnown);
      recordOpportunity(breakPoints, importance.break, ev.team);
      recordOpportunity(setPoints, importance.set, ev.team);
      recordOpportunity(matchPoints, importance.match, ev.team);

      // V11 (§12.1): saque/resto por punto — INCLUYE tie break. Cada punto de TB tiene un
      // sacador conocido (rotación dentro del propio TB, ya resuelto arriba vía
      // resolveTiebreakServer); lo único que el TB nunca alimenta es un game de saque
      // completo (más abajo, wasNormalGameEnd sigue excluyéndolo) ni breaks/Break Points.
      if (servingTeamKnown) {
        serveStats[servingTeamKnown].served += 1;
        if (ev.team === servingTeamKnown) serveStats[servingTeamKnown].wonServing += 1;
        if (servingPlayerId != null && perPlayerServe[servingPlayerId]) {
          perPlayerServe[servingPlayerId].pointsTotal += 1;
          if (ev.team === servingTeamKnown) perPlayerServe[servingPlayerId].pointsWon += 1;
        }
      }

      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado

      const wasTiebreakConcluding = before.inTiebreak && !state.inTiebreak;
      const wasNormalGameEnd = !before.inTiebreak && state.gameIndex > before.gameIndex;

      // Games de saque / breaks — SOLO games normales, nunca tie break. V12 (§6): solo
      // necesitan el EQUIPO al saque, así que sobreviven aunque el jugador individual no se
      // conozca — eso se rastrea aparte en `gamesWithUnknownPlayer`, para no aflojar
      // `serverFullyKnown` (que sigue significando "el jugador se conoce en todos los games").
      if (wasNormalGameEnd) {
        const winnerOfGame = state.sets.length > before.sets.length
          ? state.sets[state.sets.length - 1].winner
          : (state.gamesA > before.gamesA ? 'A' : 'B');
        if (servingTeamKnown) {
          if (winnerOfGame === servingTeamKnown) {
            if (servingTeamKnown === 'A') serviceGames.wonA += 1; else serviceGames.wonB += 1;
          } else {
            if (servingTeamKnown === 'A') serviceGames.lostA += 1; else serviceGames.lostB += 1;
            if (winnerOfGame === 'A') breaks.A += 1; else breaks.B += 1;
          }
          if (servingPlayerId != null && perPlayerServe[servingPlayerId]) {
            perPlayerServe[servingPlayerId].games += 1;
            if (winnerOfGame === servingTeamKnown) perPlayerServe[servingPlayerId].held += 1;
          } else {
            gamesWithUnknownPlayer += 1;
          }
        } else {
          serviceGames.unknown += 1;
        }
      }
      // Nota: wasTiebreakConcluding NO alimenta serviceGames/breaks (regla dura). Sí pudo haber
      // generado Set Point / Match Point, ya registrados arriba antes de aplicar el punto.

      if (state.sets.length > before.sets.length) {
        setDurations.push({ setNumber: state.sets.length, ms: ev.matchTimeMs - lastSetBoundaryMs });
        lastSetBoundaryMs = ev.matchTimeMs;
      }
    });

    const totalPoints = totals.A + totals.B;
    const serverKnown = serviceGames.wonA + serviceGames.wonB + serviceGames.lostA + serviceGames.lostB;
    const hasServerInfo = serverKnown > 0;
    const serverFullyKnown = hasServerInfo && serviceGames.unknown === 0 && gamesWithUnknownPlayer === 0;

    return {
      totalPoints, pointsA: totals.A, pointsB: totals.B,
      goldenPoints, starPoints,
      hasServerInfo, serverFullyKnown,
      serviceGames, serveStats, breaks,
      breakPoints, setPoints, matchPoints,
      perPlayerServe,
      maxStreak, leadChanges, setDurations,
      matchDurationMs: matchEndMs,
      hasAdjustments,
      finalState: state,
    };
  }

  function recordOpportunity(bucket, importanceValue, winnerTeam) {
    if (!importanceValue) return;
    const teams = importanceValue === 'both' ? ['A', 'B'] : [importanceValue];
    teams.forEach((team) => {
      bucket[team].opportunities += 1;
      if (winnerTeam === team) bucket[team].converted += 1;
      else bucket[team].saved += 1;
    });
  }

  function fmtOpp(bucket, team) { return `${bucket[team].converted}/${bucket[team].opportunities}`; }

  /**
   * V7 (23-24-27) — convierte el par de buckets de Break Points en una interpretación (no
   * en una oración con dos fracciones pegadas). Cubre los casos que puede tomar la
   * comparación: conversión perfecta/casi perfecta de un lado, mismas oportunidades con
   * distinta efectividad, o el caso general (distintas oportunidades y conversiones sin el
   * patrón "generó más pero convirtió menos" que ya tiene su propio texto dedicado).
   * Devuelve `null` si no hay nada interesante que contar (p.ej. ambos en cero, o iguales
   * en todo).
   */
  /**
   * V11 (§2.1/§2.2/§2.3/§8) — reescrita de nuevo sobre la base V9.2. Reglas duras:
   *   - 0/0 NUNCA es una tasa de conversión: si una pareja no tuvo ninguna oportunidad real,
   *     jamás se la compara en "eficiencia" contra la otra ni se escribe "0 de 0".
   *   - Ambas parejas con oportunidades pero CERO conversiones de los dos lados: nunca
   *     "más contundente" ni eficiencia — solo presión/oportunidades sin conversión (bug
   *     real §2.1: "fueron mucho más contundentes y consiguieron 0 quiebres en 3
   *     oportunidades", con 0/3 vs 0/5).
   *   - Misma eficiencia con distinto número de oportunidades: nunca "aprovechó mejor" (bug
   *     real §2.2: 3/9 y 2/6 son la MISMA eficiencia, 33%, aunque los breaks difieran).
   *   - Prioridad de lectura: BREAKS CONVERTIDOS > EFICIENCIA > OPORTUNIDADES GENERADAS,
   *     nunca forzando las tres a la vez.
   *   - Sujeto de dos jugadores siempre en plural ("consiguieron", nunca "consiguió") — bug
   *     real §2.3 encontrado en esta misma función (varias ramas usaban el verbo en singular).
   * Devuelve `null` si no hay nada interesante que contar.
   */
  function interpretBreakPointsNarrative(bpA, bpB, nameOf, otherName) {
    const a = bpA, b = bpB;
    if (a.opportunities === 0 && b.opportunities === 0) return null;

    // Una sola pareja tuvo oportunidades reales: no hay eficiencia que comparar, solo el
    // hecho aislado (y, si aporta, que el rival nunca dispuso de una chance real).
    if (a.opportunities === 0 || b.opportunities === 0) {
      const withOpps = a.opportunities > 0 ? a : b;
      const withOppsTeam = a.opportunities > 0 ? 'A' : 'B';
      const withoutOppsTeam = withOppsTeam === 'A' ? 'B' : 'A';
      if (withOpps.converted === 0) return null; // no convirtió nada: no aporta a la historia
      const perfect = withOpps.converted === withOpps.opportunities;
      const text = perfect
        ? `${nameOf(withOppsTeam)} convirtieron ${withOpps.opportunities === 1 ? 'su única oportunidad' : `las ${withOpps.opportunities} oportunidades`} de quiebre.`
        : `${nameOf(withOppsTeam)} consiguieron ${withOpps.converted === 1 ? 'un quiebre' : `${withOpps.converted} quiebres`} en ${withOpps.opportunities} oportunidad${withOpps.opportunities === 1 ? '' : 'es'}.`;
      return `${text} ${nameOf(withoutOppsTeam)} no llegaron a disponer de una oportunidad de quiebre.`;
    }

    // Ambas parejas tuvieron oportunidades reales — prioridad: breaks convertidos primero.
    if (a.converted === b.converted) {
      if (a.opportunities === b.opportunities) return null; // igual en todo: no aporta

      if (a.converted === 0) {
        // V11 (§2.1): ninguna convirtió nada, pero hubo distinta cantidad de oportunidades —
        // se narra la presión sin conversión, nunca como eficiencia ni "más contundente".
        const moreOppsTeam = a.opportunities > b.opportunities ? 'A' : 'B';
        const moreVal = moreOppsTeam === 'A' ? a.opportunities : b.opportunities;
        const fewerVal = moreOppsTeam === 'A' ? b.opportunities : a.opportunities;
        const magnitude = describeMagnitude(moreVal, fewerVal);
        if (!magnitude || magnitude === 'apenas') {
          return 'Ambas parejas tuvieron oportunidades al resto, pero ninguna consiguió quebrar.';
        }
        const oppPhrase = magnitudeOpportunitiesPhrase(moreVal, fewerVal) || 'más oportunidades';
        return `${nameOf(moreOppsTeam)} generaron ${oppPhrase} desde la devolución, con ${moreVal} oportunidades frente a ${fewerVal}, aunque ninguno de los dos equipos consiguió convertir un Break Point.`;
      }

      // Mismos quiebres convertidos (y al menos uno cada uno), distinta cantidad de
      // oportunidades: sí hay algo real que contar — la eficiencia relativa.
      const moreEffTeam = a.opportunities < b.opportunities ? 'A' : 'B';
      const moreEffOpps = moreEffTeam === 'A' ? a.opportunities : b.opportunities;
      const lessEffOpps = moreEffTeam === 'A' ? b.opportunities : a.opportunities;
      return `Ambos consiguieron la misma cantidad de quiebres (${a.converted}), pero ${nameOf(moreEffTeam)} necesitaron menos oportunidades para lograrlo, ${moreEffOpps} contra ${lessEffOpps}.`;
    }

    const moreBreaks = a.converted > b.converted ? 'A' : 'B';
    const fewerBreaks = moreBreaks === 'A' ? 'B' : 'A';
    const moreBucket = moreBreaks === 'A' ? a : b;
    const fewerBucket = fewerBreaks === 'A' ? a : b;
    const moreRate = moreBucket.opportunities ? moreBucket.converted / moreBucket.opportunities : 0;
    const fewerRate = fewerBucket.opportunities ? fewerBucket.converted / fewerBucket.opportunities : 0;

    if (fewerBucket.converted > 0 && fewerRate > moreRate) {
      // Sección 8 del consolidado: quien menos quebró fue realmente más eficiente — vale
      // contar las dos caras (más quiebres vs. más eficiente), nunca "aprovechó mejor" para
      // quien simplemente convirtió más con más chances.
      return `${nameOf(moreBreaks)} consiguieron más quiebres, ${moreBucket.converted} contra ${fewerBucket.converted}, pero ${nameOf(fewerBreaks)} fueron más eficientes y necesitaron solo ${fewerBucket.opportunities} oportunidad${fewerBucket.opportunities === 1 ? '' : 'es'} para convertir ${fewerBucket.converted === 1 ? 'su quiebre' : 'sus quiebres'}.`;
    }
    if (fewerBucket.converted > 0 && Math.abs(fewerRate - moreRate) < 1e-9) {
      // V11 (§2.2): misma eficiencia con distinto número de oportunidades — nunca "aprovechó
      // mejor" (bug real: 3/9 y 2/6 son la misma tasa, 33%, aunque los breaks difieran).
      return `${nameOf(moreBreaks)} consiguieron más quiebres, ${moreBucket.converted} contra ${fewerBucket.converted}, con una efectividad de conversión similar.`;
    }
    if (moreBucket.opportunities > fewerBucket.opportunities) {
      // V10 (16/45.1): la calificación de "cuánto más" depende de la magnitud real de la
      // diferencia (7 vs 6 no es lo mismo que 16 vs 2), nunca un "más chances" plano.
      const phrase = magnitudeOpportunitiesPhrase(moreBucket.opportunities, fewerBucket.opportunities);
      const chancesClause = phrase ? `generaron ${phrase} de quiebre` : `generaron más chances de quiebre, ${moreBucket.opportunities} contra ${fewerBucket.opportunities}`;
      // V11.16 (feedback real): "convirtieron X quiebres contra los 0 de Fulano" suena a
      // tabla leída en voz alta cuando el otro lado quedó en cero — se prefiere una frase
      // natural que diga directamente que esa pareja no pudo convertir ninguna.
      const convertedClause = fewerBucket.converted === 0
        ? `Convirtieron ${moreBucket.converted === 1 ? 'su única oportunidad' : `${moreBucket.converted} de sus ${moreBucket.opportunities} oportunidades`}, mientras que ${nameOf(fewerBreaks)} no consiguieron convertir ${fewerBucket.opportunities === 1 ? 'la única que tuvieron' : 'ninguna de las suyas'}.`
        : `Convirtieron ${moreBucket.converted} quiebres contra los ${fewerBucket.converted} de ${nameOf(fewerBreaks)}.`;
      return `${nameOf(moreBreaks)} ${chancesClause}, y además las aprovecharon mejor. ${convertedClause}`;
    }
    if (fewerBucket.opportunities > moreBucket.opportunities) {
      // V11 (§7.9): PRESIÓN SIN CONVERSIÓN — quien convirtió MENOS en realidad generó MÁS
      // oportunidades (presión real) pero no las aprovechó. No confundir con dominio de quien
      // tuvo más chances: la conversión real fue del otro lado, y eso también hay que decirlo.
      const oppPhrase = magnitudeOpportunitiesPhrase(fewerBucket.opportunities, moreBucket.opportunities);
      const pressureClause = oppPhrase ? `generaron ${oppPhrase} de quiebre` : `generaron más oportunidades de quiebre, ${fewerBucket.opportunities} contra ${moreBucket.opportunities}`;
      // V11.16 (feedback real): misma preferencia por lenguaje natural cuando quien generó
      // más presión terminó en cero conversiones.
      const convertClause = fewerBucket.converted === 0
        ? `pero no consiguieron convertir ${fewerBucket.opportunities === 1 ? 'la única' : 'ninguna de esas'} en quiebre; ${nameOf(moreBreaks)} sí aprovecharon las suyas y se quedaron con ${moreBucket.converted === 1 ? 'el único quiebre del partido' : `los ${moreBucket.converted} quiebres`}.`
        : `pero fueron ${nameOf(moreBreaks)} quienes más veces lograron convertir, ${moreBucket.converted} contra ${fewerBucket.converted}.`;
      return `${nameOf(fewerBreaks)} ${pressureClause}, ${convertClause}`;
    }
    // V11.16 (feedback real): mismo ajuste en el fallback genérico (oportunidades iguales).
    if (fewerBucket.converted === 0) {
      return `${nameOf(moreBreaks)} ${moreBucket.converted === 1 ? 'convirtieron su única oportunidad de quiebre' : `convirtieron ${moreBucket.converted} de sus ${moreBucket.opportunities} oportunidades de quiebre`}, mientras que ${nameOf(fewerBreaks)} no consiguieron quebrar.`;
    }
    return `${nameOf(moreBreaks)} consiguieron más quiebres, ${moreBucket.converted} contra ${fewerBucket.converted}.`;
  }

  /**
   * Bloque V — deficit máximo (en games) que enfrentó el ganador de CADA set antes de
   * ganarlo, medido SOLO sobre sets cerrados por eventos realmente registrados (nunca
   * sobre sets que vinieron ya cerrados en un baseline — esos no tienen desarrollo
   * conocido, R10). También sirve de insumo a Evolución (V14).
   * V8 (24-26): además de `deficitFacedByWinner`, ahora también devuelve:
   *   - `deficitFacedByLoser`: el mayor déficit que enfrentó el PERDEDOR de ese set (para
   *     narrar una remontada que casi se completa pero termina perdiéndose, 26).
   *   - `worstScoreForWinner`: el marcador exacto {gamesA,gamesB} en el peor momento del
   *     ganador (para poder decir "estuvieron 1-5 abajo" en vez de solo "por 4 games").
   */
  function computeSetGameDeficits(events, scoringSystem, format, defaultTiebreakMode, baseline) {
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, defaultTiebreakMode, baseline) : E.createInitialEngineState();
    const results = [];
    let minDiffA = 0, maxDiffA = 0;
    let scoreAtMinDiffA = null, scoreAtMaxDiffA = null;
    events.forEach((ev) => {
      if (ev.type === 'adjustment') { state = E.applyAdjustment(ev.newState); minDiffA = 0; maxDiffA = 0; scoreAtMinDiffA = null; scoreAtMaxDiffA = null; return; }
      const before = state;
      const modeForThisPoint = ev.tbMode || defaultTiebreakMode;
      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado
      if (state.sets.length > before.sets.length) {
        const s = state.sets[state.sets.length - 1];
        results.push({
          setNumber: state.sets.length, gamesA: s.gamesA, gamesB: s.gamesB, winner: s.winner,
          deficitFacedByWinner: s.winner === 'A' ? Math.max(0, -minDiffA) : Math.max(0, maxDiffA),
          deficitFacedByLoser: s.winner === 'A' ? Math.max(0, maxDiffA) : Math.max(0, -minDiffA),
          worstScoreForWinner: s.winner === 'A' ? scoreAtMinDiffA : scoreAtMaxDiffA,
        });
        minDiffA = 0; maxDiffA = 0; scoreAtMinDiffA = null; scoreAtMaxDiffA = null;
      } else if (!state.inTiebreak) {
        const diff = state.gamesA - state.gamesB;
        if (diff < minDiffA) { minDiffA = diff; scoreAtMinDiffA = { gamesA: state.gamesA, gamesB: state.gamesB }; }
        if (diff > maxDiffA) { maxDiffA = diff; scoreAtMaxDiffA = { gamesA: state.gamesA, gamesB: state.gamesB }; }
      }
    });
    return results;
  }

  /**
   * V7 (70-72) — localiza el detalle del ÚNICO quiebre real del partido (a qué pareja, sobre
   * el saque de quién si se conoce con certeza, y el marcador antes/después). Se llama
   * solamente cuando `stats.breaks.A + stats.breaks.B === 1`, así que el último (y único)
   * quiebre encontrado al recorrer los eventos es siempre el correcto.
   */
  function findSoleBreakDetail(events, matchCtx) {
    const { players, scoringSystem, format, tiebreakMode, serverKnowledge, baseline } = matchCtx;
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, baseline) : E.createInitialEngineState();
    let found = null;
    events.forEach((ev) => {
      if (ev.type === 'adjustment') { state = E.applyAdjustment(ev.newState); return; }
      const before = state;
      const modeForThisPoint = ev.tbMode || tiebreakMode;
      const setNumber = before.sets.length + 1;
      const matchGameNumber = E.currentMatchGameNumber(before);
      const withinSetGameNumber = E.currentWithinSetGameNumber(before);
      const resolved = serverKnowledge
        ? (before.inTiebreak
          ? E.resolveTiebreakServer(serverKnowledge, players, setNumber, before.tbBaseGameNumber, before.tbBaseWithinSet, before.tbA + before.tbB)
          : E.resolveServer(serverKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber))
        : { resolved: false };
      // V12 (§6): equipo conocido sin jugador individual sigue siendo un quiebre de PAREJA
      // válido — solo se pierde `serverPlayerId` (queda null, la narrativa ya lo maneja).
      const servingTeamKnown = resolved.resolved ? resolved.team : (resolved.candidateTeam || null);
      const servingPlayerId = resolved.resolved ? resolved.playerId : null;
      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado
      const wasNormalGameEnd = !before.inTiebreak && state.gameIndex > before.gameIndex;
      if (wasNormalGameEnd && servingTeamKnown) {
        const closedSet = state.sets.length > before.sets.length;
        const winnerOfGame = closedSet ? state.sets[state.sets.length - 1].winner : (state.gamesA > before.gamesA ? 'A' : 'B');
        if (winnerOfGame !== servingTeamKnown) {
          found = {
            setNumber, breakerTeam: winnerOfGame, servedByTeam: servingTeamKnown, serverPlayerId: servingPlayerId,
            scoreBefore: { gamesA: before.gamesA, gamesB: before.gamesB },
            scoreAfter: closedSet
              ? { gamesA: state.sets[state.sets.length - 1].gamesA, gamesB: state.sets[state.sets.length - 1].gamesB }
              : { gamesA: state.gamesA, gamesB: state.gamesB },
            // V9.2 (4/12): saber si este quiebre cerró el set y/o el partido evita narrar
            // "sostuvieron esa diferencia hasta el final" cuando en realidad ESE MISMO game
            // ya fue el final — bug real reportado (6-4 con un único break que cierra el
            // partido en el acto).
            closedSet,
            closedMatch: !!state.matchWinner,
          };
        }
      }
    });
    return found;
  }

  /**
   * V11.1 (§4.3) — HOLD BAJO PRESIÓN: "no es lo mismo un hold 40-0 que un hold salvando
   * 0-40" (ejemplo textual del consolidado). Localiza, entre todos los games sostenidos
   * (holds) del partido, el que exigió salvar MÁS Break Points seguidos antes de cerrarlo.
   * Deliberadamente NO es el motor genérico de "importancia por punto" de las secciones
   * 4-5 del consolidado (dominancia × leverage combinados con una fórmula) — es una señal
   * puntual y concreta, del mismo tipo que `findSoleBreakDetail`, reusando exactamente el
   * mismo patrón de recorrido de eventos. Nunca infiere psicología (nervios, carácter): solo
   * reporta el hecho observable. Devuelve `null` si ningún hold tuvo que salvar 2+ Break
   * Points en el mismo game — por debajo de eso no aporta lo suficiente a la historia.
   */
  function findDramaticHold(events, matchCtx) {
    const { players, scoringSystem, format, tiebreakMode, serverKnowledge, baseline } = matchCtx;
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, baseline) : E.createInitialEngineState();
    let best = null;
    let bpSavedThisGame = 0;
    events.forEach((ev) => {
      if (ev.type === 'adjustment') { state = E.applyAdjustment(ev.newState); bpSavedThisGame = 0; return; }
      const before = state;
      const modeForThisPoint = ev.tbMode || tiebreakMode;
      const setNumber = before.sets.length + 1;
      const matchGameNumber = E.currentMatchGameNumber(before);
      const withinSetGameNumber = E.currentWithinSetGameNumber(before);
      const resolved = serverKnowledge
        ? (before.inTiebreak
          ? E.resolveTiebreakServer(serverKnowledge, players, setNumber, before.tbBaseGameNumber, before.tbBaseWithinSet, before.tbA + before.tbB)
          : E.resolveServer(serverKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber))
        : { resolved: false };
      // V12 (§6): equipo conocido alcanza para detectar presión de Break Point — nunca
      // dependió del jugador individual, solo se descartaba de más por la misma línea.
      const servingTeamKnown = resolved.resolved ? resolved.team : (resolved.candidateTeam || null);
      if (!before.inTiebreak && servingTeamKnown) {
        const importance = E.detectPointImportance(before, scoringSystem, format, modeForThisPoint, servingTeamKnown);
        const receivingTeam = servingTeamKnown === 'A' ? 'B' : 'A';
        // V11.1 (§2.5, aplicado acá): un Break Point que ADEMÁS es Match Point o Set Point ya
        // queda cubierto por la historia de remontada/Match Points salvados (son literalmente
        // los mismos puntos) — contarlo taquí también sería narrar la misma secuencia dos
        // veces con dos etiquetas distintas. Solo cuenta la presión "pura" de Break Point,
        // sin protagonismo de set/partido en juego todavía.
        if ((importance.break === receivingTeam || importance.break === 'both') && !importance.match && !importance.set) {
          // El resto tiene Break Point: si el punto lo termina ganando el que saca, lo salvó.
          if (ev.team === servingTeamKnown) bpSavedThisGame += 1;
        }
      }
      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado
      const wasNormalGameEnd = !before.inTiebreak && state.gameIndex > before.gameIndex;
      if (wasNormalGameEnd) {
        const closedSet = state.sets.length > before.sets.length;
        const winnerOfGame = closedSet ? state.sets[state.sets.length - 1].winner : (state.gamesA > before.gamesA ? 'A' : 'B');
        if (servingTeamKnown && winnerOfGame === servingTeamKnown && bpSavedThisGame >= 2 && (!best || bpSavedThisGame > best.bpSaved)) {
          // V11.16 (feedback real): `withinSetGameNumber` viaja acá SOLO para poder describir
          // el hold sin decir "en el Set 1" en partidos de un único set (Americano) — no
          // cambia en nada CUÁL hold se elige (esa decisión sigue siendo bpSavedThisGame >= 2
          // y el máximo entre los candidatos, sin tocar).
          best = { team: servingTeamKnown, setNumber, withinSetGameNumber, bpSaved: bpSavedThisGame, closedSet, closedMatch: !!state.matchWinner };
        }
        bpSavedThisGame = 0;
      }
    });
    return best;
  }

  /**
   * V11.4 (feedback real) — PARIDAD ESTADÍSTICA REAL: antes de narrar un partido definido
   * por Tie break como "extremadamente parejo", exige evidencia — nunca alcanza con que el
   * marcador final haya sido ajustado. Cuenta señales objetivas e independientes (puntos
   * totales, % de saque, % de resto, ausencia de breaks, Punto de Oro/Star repartido); hacen
   * falta varias coincidiendo, nunca una sola. Caso real que motivó esto: 5-5 sin quiebres,
   * TB 7-3 — el marcador final "ajustado" (7-3) no demuestra nada por sí solo, pero la
   * paridad de TODO lo anterior (puntos, saque, resto, Oro) sí.
   */
  function detectStrongParity(stats) {
    if (!stats.hasServerInfo || !stats.serverFullyKnown) return false;
    let signals = 0;
    if (stats.totalPoints > 0) {
      const diff = Math.abs(stats.pointsA - stats.pointsB);
      if (diff <= Math.max(2, Math.round(stats.totalPoints * 0.04))) signals++;
    }
    const sgA = stats.serviceGames.wonA + stats.serviceGames.lostA;
    const sgB = stats.serviceGames.wonB + stats.serviceGames.lostB;
    const holdA = sgA > 0 ? stats.serviceGames.wonA / sgA : null;
    const holdB = sgB > 0 ? stats.serviceGames.wonB / sgB : null;
    if (holdA != null && holdB != null && Math.abs(holdA - holdB) <= 0.15) signals++;
    const servedA = stats.serveStats.A.served, servedB = stats.serveStats.B.served;
    const servePctA = servedA ? stats.serveStats.A.wonServing / servedA : null;
    const servePctB = servedB ? stats.serveStats.B.wonServing / servedB : null;
    if (servePctA != null && servePctB != null && Math.abs(servePctA - servePctB) <= 0.12) signals++;
    if (stats.breaks.A === 0 && stats.breaks.B === 0) signals++;
    const golden = stats.goldenPoints.played > 0 ? stats.goldenPoints : (stats.starPoints.played > 0 ? stats.starPoints : null);
    if (golden && golden.played >= 2 && Math.abs(golden.wonA - golden.wonB) <= 1) signals++;
    return signals >= 3;
  }

  /**
   * V11.4 (feedback real) — DESARROLLO DEL TIE BREAK: hasta ahora el TB se narraba SOLO como
   * un resultado final ("ganaron 7-3"), sin importar si fue parejo de punta a punta o si una
   * pareja se separó temprano y administró la ventaja — perdiendo justo la parte de la
   * historia que un TB reñido puede aportar. Reusa el mismo patrón de mínimos/máximos que
   * `computeSetGameDeficits`, pero sobre los PUNTOS del propio Tie break, ya en términos de
   * "ganador/perdedor" (no A/B) para no tener que reorientar después.
   *   - `worstDiff` (<=0 si el ganador llegó a estar abajo): su peor momento dentro del TB.
   *   - `bestDiff`/`bestScore`: la mayor ventaja que sacó el ganador en cualquier momento.
   *   - `dipDiff`/`dipScore`: el punto más bajo que tocó esa ventaja DESPUÉS de alcanzar su
   *     último máximo — permite distinguir "sacó 4 y lo administró" de "sacó 4, el rival lo
   *     ajustó a 2, y recién ahí cerró" (dos historias distintas con el mismo marcador final).
   */
  function describeTiebreakArc(events, matchCtx, setNumber, winnerTeam) {
    const { scoringSystem, format, tiebreakMode, baseline } = matchCtx;
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, baseline) : E.createInitialEngineState();
    let winnerPts = 0, loserPts = 0;
    let worstDiff = 0, worstScore = null;
    let bestDiff = 0, bestScore = null;
    let dipDiff = null, dipScore = null;
    events.forEach((ev) => {
      if (ev.type === 'adjustment') { state = E.applyAdjustment(ev.newState); return; }
      const before = state;
      const modeForThisPoint = ev.tbMode || tiebreakMode;
      const curSetNumber = before.sets.length + 1;
      const wasInThisTb = before.inTiebreak && curSetNumber === setNumber;
      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado
      if (!wasInThisTb) return;
      if (ev.team === winnerTeam) winnerPts += 1; else loserPts += 1;
      const diff = winnerPts - loserPts;
      if (diff < worstDiff) { worstDiff = diff; worstScore = { winner: winnerPts, loser: loserPts }; }
      if (diff > bestDiff) {
        bestDiff = diff; bestScore = { winner: winnerPts, loser: loserPts };
        dipDiff = diff; dipScore = { winner: winnerPts, loser: loserPts }; // el "piso" arranca en el propio pico
      } else if (dipDiff !== null && diff < dipDiff) {
        dipDiff = diff; dipScore = { winner: winnerPts, loser: loserPts };
      }
    });
    return { worstDiff, worstScore, bestDiff, bestScore, dipDiff, dipScore, finalWinner: winnerPts, finalLoser: loserPts };
  }

  /** Convierte `describeTiebreakArc` en prosa — `null` si el TB no tuvo una forma
   *  narrativamente relevante (parejo de punta a punta, sin separación real). */
  function buildTiebreakArcClause(arc, nameOf, winnerTeam, loserTeam) {
    if (arc.worstDiff <= -2) {
      return `${nameOf(winnerTeam)} llegaron a estar ${Math.abs(arc.worstDiff)} abajo en el propio Tie break, pero remontaron para cerrarlo.`;
    }
    if (arc.bestDiff >= 3) {
      const finalDiff = arc.finalWinner - arc.finalLoser;
      const wobbled = arc.dipDiff !== null && (arc.bestDiff - arc.dipDiff) >= 2 && arc.dipDiff !== finalDiff;
      let text = `${nameOf(winnerTeam)} se separaron temprano en el Tie break y llegaron a sacar ${arc.bestDiff} de ventaja (${arc.bestScore.winner}-${arc.bestScore.loser})`;
      text += wobbled
        ? `; ${nameOf(loserTeam)} achicaron la diferencia hasta ${arc.dipScore.winner}-${arc.dipScore.loser}, pero esa separación inicial terminó siendo decisiva.`
        : ', y administraron esa diferencia hasta el cierre.';
      return text;
    }
    return null;
  }

  /**
   * V11.16 (feedback real) — cuenta cuántos Match Points de `winnerTeam` salvó `loserTeam`
   * dentro de un set puntual, reusando los mismos `moments` de `computeEvolutionData` (nunca
   * una segunda interpretación de los mismos hechos). Sirve para anteponer "Después de que
   * [rival] salvaran N Match Points, ..." antes de narrar el punto que finalmente cerró el
   * partido — en vez de mencionar esos Match Points recién en un párrafo posterior, fuera de
   * orden cronológico (bug real reportado).
   */
  function countMatchPointsSavedInSet(evoData, winnerTeam, loserTeam, setNumber) {
    return (evoData.moments || []).filter((m) => m.kind === 'match-point-saved' && m.team === winnerTeam && m.savedBy === loserTeam && m.setNumber === setNumber).length;
  }

  /**
   * V11.16 (feedback real) — variante de `countMatchPointsSavedInSet` restringida a los
   * Match Points salvados ANTES de que arrancara el Tie break de ese set (usa el momento
   * `tiebreak-start` como corte cronológico — con `<=`, porque el punto que salva el ÚLTIMO
   * Match Point y sostiene el servicio es exactamente el mismo punto que hace arrancar el
   * TB, mismo `matchTimeMs`). Un partido puede llegar 5-5 justamente PORQUE una pareja salvó
   * varios Match Points y sostuvo su servicio — ese hecho es el antecedente directo del
   * propio Tie break y debe narrarse ANTES de su desarrollo interno, nunca después (bug real:
   * BRAMU contaba primero el TB y volvía hacia atrás a mencionar los MP).
   *   A diferencia de `countMatchPointsSavedInSet` (donde el "dueño" de los Match Points
   * salvados es SIEMPRE quien ganó el partido — literalmente el mismo game del quiebre
   * decisivo), acá NO se puede asumir de antemano si esos Match Points pertenecían a quien
   * terminó ganando el partido o a quien terminó perdiéndolo: el punto de 5-5 solo fuerza el
   * Tie break, no decide el partido — cualquiera de las dos parejas puede terminar
   * quedándoselo. Por eso esta función detecta el "dueño" directamente de los hechos
   * registrados, en vez de recibirlo como parámetro (bug real: asumir que siempre era
   * `winnerTeam` dejaba en 0 el conteo cuando la pareja que remontó en el TB era distinta de
   * la que había salvado esos Match Points).
   */
  function findPreTiebreakMatchPointsSaved(evoData, setNumber) {
    const moments = evoData.moments || [];
    const tbStart = moments.find((m) => m.kind === 'tiebreak-start' && m.setNumber === setNumber);
    const cutoff = tbStart ? tbStart.matchTimeMs : Infinity;
    const preTbSaved = moments.filter((m) => m.kind === 'match-point-saved' && m.setNumber === setNumber && m.matchTimeMs <= cutoff);
    if (!preTbSaved.length) return null;
    const holderTeam = preTbSaved[0].team;
    const saverTeam = preTbSaved[0].savedBy;
    return { holderTeam, saverTeam, count: preTbSaved.filter((m) => m.team === holderTeam).length };
  }

  const ORDINALS = { 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta', 6: 'sexta' };
  // V11.16 (feedback real) — ordinales en MASCULINO (para "game", nunca los femeninos de
  // ORDINALS de arriba, pensados para "oportunidad"). Usado para describir la ubicación de un
  // hold bajo presión en partidos de un único set (Americano), donde "en el Set 1" suena
  // mecánico al no existir posibilidad de un Set 2.
  const GAME_ORDINALS_M = { 1: 'primer', 2: 'segundo', 3: 'tercer', 4: 'cuarto', 5: 'quinto', 6: 'sexto', 7: 'séptimo', 8: 'octavo', 9: 'noveno', 10: 'décimo' };
  function ordinalGameWord(n) { return GAME_ORDINALS_M[n] ? `${GAME_ORDINALS_M[n]} game` : `game ${n}`; }

  /** V9.2 (11) — "ORIENTACIÓN DEL SCORE EN TODA LA NARRATIVA": helper general, no solo para
   *  Tie break. Cualquier marcador en prosa se lee con el número del protagonista primero
   *  (p.ej. si B ganó un set real A-B de 4-6, narrando a B: "ganaron 6-4", nunca "4-6").
   *  La UI, Timeline y tarjetas de marcador NO usan esto — ahí el orden A-B fijo es
   *  intencional y no cambia. */
  function orientScore(numA, numB, team) {
    return team === 'A' ? `${numA}-${numB}` : `${numB}-${numA}`;
  }
  function orientTiebreak(tiebreak, team) {
    return orientScore(tiebreak.a, tiebreak.b, team);
  }
  function capitalizeFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /**
   * V10 (16/45.1) — GRADACIÓN DE MAGNITUD: reemplaza las comparaciones binarias ("A > B =
   * muchas más") por una lectura semántica de qué tan grande es realmente la diferencia.
   * Pensada para conteos comparables (Break Points, puntos totales, breaks, rachas...).
   * `bigger`/`smaller` son las dos cantidades (`bigger` >= `smaller`, ambas >= 0).
   * Devuelve `null` cuando la diferencia es tan chica que ni vale la pena calificarla (el
   * llamador decide si omite la comparación entera o solo el adjetivo, §55).
   */
  function describeMagnitude(bigger, smaller) {
    const diff = bigger - smaller;
    if (diff <= 0) return null; // sin diferencia real: nada que graduar (§55, puede omitirse)
    if (smaller === 0) return 'enorme'; // "16 vs 0": diferencia enorme, no hay nada con qué comparar
    if (diff === 1) return 'apenas'; // "7 vs 6": apenas una más
    const ratio = bigger / smaller;
    if (ratio < 2) return 'leve'; // "9 vs 6"
    if (ratio < 4) return 'clara'; // "9 vs 3"
    return 'mucha'; // "16 vs 2"
  }

  /** Convierte el calificador de `describeMagnitude` en el adjetivo/frase concreta para
   *  "oportunidades" (Break Points u otro conteo de chances). `null` → sin calificar (el
   *  llamador debe decidir si igual necesita mostrar el número crudo o directamente omitir). */
  function magnitudeOpportunitiesPhrase(bigger, smaller) {
    const m = describeMagnitude(bigger, smaller);
    switch (m) {
      case 'apenas': return 'apenas una más';
      case 'leve': return 'algo más de oportunidades';
      case 'clara': return 'claramente más oportunidades';
      case 'mucha': return 'muchas más oportunidades';
      case 'enorme': return 'muchas más oportunidades';
      default: return null;
    }
  }

  /**
   * V11.1 (§11.3) — VARIEDAD DE LENGUAJE. Bancos de sinónimos agrupados por función
   * narrativa exacta (nunca mezclados entre sí, para no cambiar el significado). La
   * elección es DETERMINÍSTICA a partir de datos reales del propio partido (nunca
   * `Math.random`) — el mismo partido siempre genera el mismo texto (tests reproducibles),
   * pero partidos distintos (duración, puntos, sets distintos) tienden a elegir variantes
   * distintas, así jugar varios partidos seguidos con amigos no suena siempre igual.
   * Los 4 bancos y sus lugares de uso quedan documentados en cada punto de inyección
   * (`pickPhrase('inicio'|'reaccion'|'quiebre'|'cierre', seed)`) — no se aplicó en TODOS
   * los lugares posibles donde podría encajar una de estas palabras (p.ej. no se tocó
   * `interpretBreakPointsNarrative`, ya bastante delicada en su lógica de precisión), solo
   * en los puntos donde el cambio de palabra es 100% seguro y no interactúa con ninguna
   * otra rama condicional.
   */
  const PHRASE_BANKS = {
    inicio: ['arrancaron mejor', 'comenzaron mejor', 'tomaron primero la ventaja', 'marcaron las primeras diferencias'],
    reaccion: ['respondieron', 'reaccionaron', 'recuperaron terreno', 'consiguieron igualar el desarrollo'],
    quiebre: ['consiguieron el quiebre', 'encontraron el break', 'quebraron el servicio rival', 'aprovecharon la oportunidad al resto'],
    cierre: ['cerraron', 'terminaron imponiéndose', 'se impusieron', 'aprovecharon la oportunidad para cerrarlo'],
    // V11.16 (feedback real) — variante segura para un hold que sostuvo el servicio después
    // de atravesar presión real (Break Points, Match Points, 0-40 salvado). Nunca se usa en
    // holds rutinarios (queda reservada a los lugares donde ya se confirmó presión real antes
    // de llamarla) y nunca infiere actitud/carácter — describe solo el hecho observable de
    // haber sostenido el servicio. Siempre en infinitivo, para usarse detrás de "para".
    holdPresion: ['sostener el servicio', 'sacar adelante su servicio'],
  };
  function pickPhrase(bankKey, seed) {
    const bank = PHRASE_BANKS[bankKey];
    return bank[Math.abs(seed || 0) % bank.length];
  }
  /** Semilla determinística por partido — ninguna de estas cifras se elige a mano por el
   *  jugador, así que dos partidos reales prácticamente nunca coinciden en los tres a la
   *  vez (duración real en ms incluida a propósito: es la que más varía entre partidos con
   *  un resultado parecido). */
  function varietySeedFor(stats, sets) {
    return (stats.totalPoints || 0) + (stats.matchDurationMs || 0) + (sets ? sets.length : 0) * 97;
  }

  /** V9 (3/8) — cuando la historia principal es una secuencia decisiva puntual (p.ej. un
   *  quiebre logrado con Punto de Oro sobre el final de un set), antepone un resumen
   *  cronológico breve de los sets ANTERIORES a ese, para dar contexto de "cómo se llegó"
   *  antes de contar el momento decisivo (jerarquía narrativa V9, puntos 1-2: primero
   *  estructura general, después la historia cronológica). */
  function buildSetArcSentence(sets, nameOf, decidingSetNumber) {
    const priorSets = sets.slice(0, decidingSetNumber - 1);
    if (!priorSets.length) return '';
    if (priorSets.length === 1) {
      const s = priorSets[0];
      return `${nameOf(s.winner)} se quedaron con el primer set ${orientScore(s.gamesA, s.gamesB, s.winner)}.`;
    }
    return priorSets.map((s, i) => {
      if (i === 0) return `${nameOf(s.winner)} ganaron el primer set ${orientScore(s.gamesA, s.gamesB, s.winner)}`;
      const changed = s.winner !== priorSets[i - 1].winner;
      return (changed ? ', pero ' : ', y ') + `${nameOf(s.winner)} se llevaron el ${i + 1}° set ${orientScore(s.gamesA, s.gamesB, s.winner)}`;
    }).join('') + '.';
  }

  /**
   * V11 (§3.1/§3.4) — ACTO DE CIERRE: cuando la remontada elegida como historia principal
   * ocurrió en un set que NO es el último del partido, el desenlace real queda en un set
   * completamente distinto (p.ej. remontada en el Set 2 de un partido a 3 sets — el Set 3
   * es "otra película"). Devuelve `null` si `actSetNumber` YA es el último set (nada que
   * agregar: la historia principal ya cubre el cierre). Reusa `computeSetSegments` +
   * `computeStats` para tener datos REALES de ese set puntual (quiebres si se conoce el
   * saque), nunca un resumen inventado.
   */
  function buildClosingActText(matchCtx, sets, actSetNumber, nameOf, seed) {
    if (!actSetNumber || actSetNumber >= sets.length) return null;
    const lastSet = sets[sets.length - 1];
    const segments = computeSetSegments(matchCtx.events || [], matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline);
    const seg = segments.find((s) => s.setNumber === sets.length);
    let winnerBreaksInSet = 0;
    let hasServerInfoInSet = false;
    if (seg) {
      const segStats = computeStats(seg.events, Object.assign({}, matchCtx, { baseline: seg.baseline }));
      winnerBreaksInSet = lastSet.winner === 'A' ? segStats.breaks.A : segStats.breaks.B;
      hasServerInfoInSet = segStats.hasServerInfo;
    }
    const closeClause = lastSet.tiebreak
      ? `en el Tie break, ${orientTiebreak(lastSet.tiebreak, lastSet.winner)}`
      : orientScore(lastSet.gamesA, lastSet.gamesB, lastSet.winner);
    // V11.1 (§11.3): verbo de cierre variable — "el set" ya quedó establecido en la frase
    // de apertura ("El último set tuvo otro desarrollo"), así que el banco no lo repite.
    const cierre = pickPhrase('cierre', seed);
    const text = (hasServerInfoInSet && winnerBreaksInSet > 0)
      ? `El último set tuvo otro desarrollo: ${nameOf(lastSet.winner)} consiguieron ${winnerBreaksInSet === 1 ? 'un quiebre' : `${winnerBreaksInSet} quiebres`} y ${cierre} ${closeClause}.`
      : `El último set tuvo otro desarrollo: ${nameOf(lastSet.winner)} ${cierre} ${closeClause}.`;
    return { text, tbMentioned: !!lastSet.tiebreak };
  }

  /**
   * V9.2 (1-2) — CLASIFICADOR DE FORMA GENERAL DEL PARTIDO. Antes de elegir la historia
   * principal, BRAMU Intelligence necesita saber si el partido, en conjunto, fue un
   * dominio claro — para que un evento puntual (un quiebre con Oro tardío, por ejemplo)
   * no termine encabezando el análisis de un partido que en realidad estuvo resuelto de
   * principio a fin. Combina varias señales (nunca una sola), sobre una base obligatoria:
   * victoria en sets corridos (el perdedor no ganó ningún set). Señales adicionales:
   *   - margen amplio en los sets (games cedidos por el perdedor);
   *   - diferencia fuerte en el total de puntos;
   *   - breaks a favor sin haber sido quebrado ni una vez;
   *   - dominio del saque (0 games de servicio perdidos);
   *   - el rival casi no dispuso de Break Points reales.
   * No exige que se cumplan todas — alcanza con 2 señales fuertes además de la base.
   */
  function detectClearDominance(stats, sets, winnerTeam) {
    if (!winnerTeam || !sets.length) return null;
    const straightSets = sets.every((s) => s.winner === winnerTeam);
    if (!straightSets) return null;

    const marginPerSet = sets.map((s) => (winnerTeam === 'A' ? s.gamesA - s.gamesB : s.gamesB - s.gamesA));
    const avgMargin = marginPerSet.reduce((acc, m) => acc + m, 0) / marginPerSet.length;
    const minMargin = Math.min(...marginPerSet);

    let signals = 0;
    if (avgMargin >= 4 || minMargin >= 3) signals++;

    if (stats.totalPoints > 0) {
      const winnerPct = (winnerTeam === 'A' ? stats.pointsA : stats.pointsB) / stats.totalPoints;
      if (winnerPct >= 0.62) signals++;
    }

    const winnerBreaks = winnerTeam === 'A' ? stats.breaks.A : stats.breaks.B;
    const loserBreaks = winnerTeam === 'A' ? stats.breaks.B : stats.breaks.A;
    if (stats.hasServerInfo && winnerBreaks >= 3 && loserBreaks === 0) signals++;

    // V9.2: "nunca fue quebrado" y "el rival no dispuso de Break Points" están altamente
    // correlacionados (casi siempre ocurren juntos) — cuentan como UNA sola señal, no dos.
    // Sin este ajuste, un partido a un set realmente parejo (un único quiebre decide todo,
    // TEST 1 del consolidado) también cumplía "sets corridos" (trivial con 1 solo set) más
    // estas dos señales de saque, alcanzando el umbral de "dominio claro" sin serlo.
    let neverBroken = false;
    let serveSignal = false;
    if (stats.hasServerInfo && stats.serverFullyKnown) {
      const wonSg = winnerTeam === 'A' ? stats.serviceGames.wonA : stats.serviceGames.wonB;
      const lostSg = winnerTeam === 'A' ? stats.serviceGames.lostA : stats.serviceGames.lostB;
      const loserBpOpps = winnerTeam === 'A' ? stats.breakPoints.B.opportunities : stats.breakPoints.A.opportunities;
      neverBroken = wonSg > 0 && lostSg === 0;
      // V10 (§6.1/test §50): "nunca lo quebraron" o "el rival casi no tuvo Break Points"
      // son casi SIEMPRE ciertos cuando el partido entero se definió por un único quiebre a
      // favor de quien ganó — eso no es dominio, es exactamente el caso "partido parejo que
      // se rompe con un solo quiebre tardío" que este archivo tiene que distinguir. Por eso
      // esta señal de saque exige ADEMÁS que el ganador haya quebrado más de una vez — sin
      // eso, un 6-3 de un único quiebre alcanzaba el umbral de "dominio claro" solo por
      // combinarse con el margen de games (bug real encontrado con la batería de tests).
      if (winnerBreaks >= 2 && (neverBroken || loserBpOpps <= 1)) serveSignal = true;
    }
    if (serveSignal) signals++;

    if (signals < 2) return null;
    return { winnerTeam, neverBroken };
  }

  /** V9.2 (2) — redacta el "dominio de principio a fin" con datos reales del partido (nunca
   *  una plantilla fija con números hardcodeados): sets, cuántos games cedió el perdedor,
   *  breaks conseguidos, saque nunca cedido, y el % de puntos si también fue contundente. */
  function buildClearDominanceText(dominance, stats, sets, nameOf) {
    const { winnerTeam } = dominance;
    let text = `${nameOf(winnerTeam)} dominaron el partido de principio a fin.`;
    if (sets.length === 1) {
      text += ` Se lo llevaron ${orientScore(sets[0].gamesA, sets[0].gamesB, winnerTeam)}.`;
    } else {
      text += ` Se llevaron el primer set ${orientScore(sets[0].gamesA, sets[0].gamesB, winnerTeam)}`;
      if (sets.length === 2) {
        const loserGames2 = winnerTeam === 'A' ? sets[1].gamesB : sets[1].gamesA;
        text += loserGames2 <= 2
          ? ` y apenas cedieron ${loserGames2 === 0 ? 'ningún game' : loserGames2 === 1 ? 'un game' : `${loserGames2} games`} en el segundo para cerrarlo ${orientScore(sets[1].gamesA, sets[1].gamesB, winnerTeam)}.`
          : ` y repitieron la fórmula en el segundo para cerrarlo ${orientScore(sets[1].gamesA, sets[1].gamesB, winnerTeam)}.`;
      } else {
        const setsStr = sets.slice(1).map((s) => orientScore(s.gamesA, s.gamesB, winnerTeam)).join(' y ');
        text += ` y no soltaron el control hasta cerrarlo ${setsStr}.`;
      }
    }
    const extraFacts = [];
    if (dominance.neverBroken) extraFacts.push('no cedieron su servicio en todo el partido');
    const winnerBreaks = winnerTeam === 'A' ? stats.breaks.A : stats.breaks.B;
    if (winnerBreaks > 0) extraFacts.push(`consiguieron ${winnerBreaks === 1 ? 'un quiebre' : `${winnerBreaks} quiebres`}`);
    if (extraFacts.length) text += ` ${capitalizeFirst(extraFacts.join(' y '))}.`;
    if (stats.totalPoints > 0) {
      const winnerPts = winnerTeam === 'A' ? stats.pointsA : stats.pointsB;
      const pct = Math.round((winnerPts / stats.totalPoints) * 100);
      if (pct >= 60) text += ` La diferencia también se reflejó en los puntos, donde se quedaron con el ${pct}% del total.`;
    }
    return text;
  }

  /**
   * V11.14 (feedback real, partido Seba/Matu vs Gusti/Esteban 6-4 · 3-6 · 6-4) — desarrollo
   * del SET DECISIVO (siempre el último de un partido a 3 sets). Sigue la jerarquía
   * orientativa del consolidado (§8 de la ronda V11.14): Tie break del propio set > remontada
   * dentro del propio set > Punto de Oro/Star Point decisivo y tardío > quiebre único de alto
   * impacto > resumen genérico de quiebres. Nunca relleno: si nada de eso aplica, se queda en
   * el resultado con los quiebres que hubo (o sin ellos).
   */
  function buildDecidingSetParagraph(matchCtx, sets, s3, st3, winnerTeam, evoData, nameOf, varietySeed) {
    const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
    const closeStr = orientScore(s3.gamesA, s3.gamesB, winnerTeam);

    // 1) Tie break en el set decisivo: su propio desarrollo (no solo el resultado final) es
    //    la historia — misma lógica que `describeTiebreakArc` usa en el resto del motor.
    if (s3.tiebreak) {
      // V11.16 (feedback real) — si el camino al Tie break pasó por salvar Match Points (la
      // pareja que sirve sostiene su saque bajo presión real para forzar el desempate), ese
      // hecho es el antecedente directo del TB y va PRIMERO — nunca después de contar cómo
      // se desarrolló el propio Tie break (bug real de orden narrativo reportado).
      const preTbMp = findPreTiebreakMatchPointsSaved(evoData, sets.length);
      let leadIn = '';
      if (preTbMp) {
        leadIn = `${nameOf(preTbMp.saverTeam)} salvaron ${preTbMp.count === 1 ? 'un Match Point' : `${preTbMp.count} Match Points`} de ${nameOf(preTbMp.holderTeam)} para ${pickPhrase('holdPresion', varietySeed)} y forzar el Tie break del set decisivo. `;
      }
      const arc = describeTiebreakArc(matchCtx.events || [], matchCtx, sets.length, winnerTeam);
      const arcClause = buildTiebreakArcClause(arc, nameOf, winnerTeam, loserTeam);
      // Sujeto SIEMPRE explícito acá: si quien salvó los Match Points (leadIn) no es
      // `winnerTeam` (pudo haber sido cualquiera de las dos parejas — el 5-5 solo fuerza el
      // TB, no decide el partido), un "lo ganaron" implícito quedaría ambiguo.
      let text = leadIn + (preTbMp
        ? `${nameOf(winnerTeam)} ganaron el Tie break del set decisivo ${orientTiebreak(s3.tiebreak, winnerTeam)}.`
        : `La definición llegó al Tie break del set decisivo, que ${nameOf(winnerTeam)} ganaron ${orientTiebreak(s3.tiebreak, winnerTeam)}.`);
      if (arcClause) text += ' ' + arcClause;
      return text;
    }

    // 2) Remontada del ganador dentro del propio set decisivo (déficit real de 3+ games).
    const deficits = computeSetGameDeficits(matchCtx.events || [], matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline);
    const s3Deficit = deficits.find((d) => d.setNumber === sets.length && d.winner === winnerTeam && d.deficitFacedByWinner >= 3);
    if (s3Deficit) {
      const scoreAbajo = s3Deficit.worstScoreForWinner
        ? orientScore(s3Deficit.worstScoreForWinner.gamesA, s3Deficit.worstScoreForWinner.gamesB, winnerTeam)
        : `por ${s3Deficit.deficitFacedByWinner} games`;
      return `El tercer set también tuvo su propia vuelta de tuerca: ${nameOf(winnerTeam)} llegaron a estar ${scoreAbajo} abajo antes de dar vuelta el marcador y cerrar el partido ${closeStr}.`;
    }

    // 3) Punto de Oro/Star Point decisivo, tardío y con el set parejo — misma detección que
    //    la secuencia cronológica decisiva del motor original, restringida al set decisivo.
    const lateThreshold = Math.max(0, matchCtx.format.setWinTarget - 2);
    const decisive = (evoData.moments || []).find((m) => {
      if (m.kind !== 'break' || !m.isGoldOrStar || m.setNumber !== sets.length || m.team !== winnerTeam) return false;
      const [beforeA, beforeB] = m.scoreBefore.split('-').map(Number);
      return Math.max(beforeA, beforeB) >= lateThreshold && Math.abs(beforeA - beforeB) <= 1;
    });
    if (decisive) {
      const [beforeA, beforeB] = decisive.scoreBefore.split('-').map(Number);
      const [afterA, afterB] = decisive.scoreAfter.split('-').map(Number);
      const gamesBeforeBreak = beforeA + beforeB;
      const pointLabel = matchCtx.scoringSystem === 'golden' ? 'el Punto de Oro' : matchCtx.scoringSystem === 'starpoint' ? 'el Star Point' : 'el punto decisivo';
      const serverClause = decisive.server ? ' sobre el saque rival' : '';
      // V11.16 (feedback real) — este quiebre puede o no haber sido el ÚLTIMO punto del set:
      // se compara con el momento `match-finish` (nunca con `decisive.scoreAfter`, que
      // queda en "0-0" cuando el mismo punto que rompe TAMBIÉN cierra el set — el contador
      // de games se resetea de cara al set siguiente, un detalle interno de
      // `computeEvolutionData` que no se toca en esta ronda). Si no hubo ningún punto
      // posterior, no hubo ningún hold que narrar (bug real: se afirmaba "y después
      // sostuvieron su servicio" sobre un partido que ya había terminado en ese mismo punto).
      const matchFinishMoment = (evoData.moments || []).find((m) => m.kind === 'match-finish');
      const closedDirectly = !!matchFinishMoment && matchFinishMoment.matchTimeMs === decisive.matchTimeMs;
      const mpSavedBeforeDecisive = countMatchPointsSavedInSet(evoData, winnerTeam, loserTeam, sets.length);
      let text = gamesBeforeBreak >= 6
        ? `Ninguna pareja consiguió quebrar durante los primeros ${gamesBeforeBreak} games del set decisivo y llegaron ${decisive.scoreBefore}. `
        : `El set decisivo estuvo parejo hasta ${decisive.scoreBefore}. `;
      if (mpSavedBeforeDecisive > 0) {
        // Los Match Points salvados son el antecedente directo del punto decisivo: van
        // primero, cronológicamente (mismo bug de orden narrativo que en el Tie break).
        text += `Después de que ${nameOf(loserTeam)} salvaran ${mpSavedBeforeDecisive === 1 ? 'un Match Point' : `${mpSavedBeforeDecisive} Match Points`}, ${nameOf(winnerTeam)} aprovecharon ${pointLabel}${serverClause} y consiguieron el quiebre`;
      } else {
        text += `Ahí apareció la jugada que terminó inclinando el partido: ${nameOf(winnerTeam)} ganaron ${pointLabel}${serverClause}, consiguieron el quiebre`;
      }
      text += closedDirectly
        ? ` que cerró directamente el partido ${closeStr}.`
        : ` para ${orientScore(afterA, afterB, winnerTeam)} y después sostuvieron su servicio para cerrar ${closeStr}.`;
      return text;
    }

    // 4) Quiebre único del set decisivo (sin el patrón Oro/Star tardío de arriba).
    if (st3 && st3.hasServerInfo && (st3.breaks.A + st3.breaks.B) === 1) {
      const seg = computeSetSegments(matchCtx.events || [], matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline).find((sg) => sg.setNumber === sets.length);
      const detail = seg ? findSoleBreakDetail(seg.events, Object.assign({}, matchCtx, { baseline: seg.baseline })) : null;
      if (detail && detail.breakerTeam === winnerTeam) {
        const beforeStr = orientScore(detail.scoreBefore.gamesA, detail.scoreBefore.gamesB, winnerTeam);
        return `El set decisivo se definió por un solo quiebre: ${nameOf(winnerTeam)} lo consiguieron con el marcador en ${beforeStr}, y cerraron el partido ${closeStr}.`;
      }
    }

    // 5) Genérico: resumen de quiebres del set decisivo (si los hay) + cierre.
    if (st3 && st3.hasServerInfo && st3.serverFullyKnown && (st3.breaks.A + st3.breaks.B) > 1) {
      const wB = winnerTeam === 'A' ? st3.breaks.A : st3.breaks.B;
      const lB = winnerTeam === 'A' ? st3.breaks.B : st3.breaks.A;
      return `El set decisivo tuvo quiebres de los dos lados (${wB} de ${nameOf(winnerTeam)} y ${lB} de ${nameOf(loserTeam)}) antes de que ${nameOf(winnerTeam)} se lo quedaran ${closeStr}.`;
    }
    return `${nameOf(winnerTeam)} se quedaron con el set decisivo ${closeStr} para cerrar el partido.`;
  }

  /**
   * V11.14 — PÁRRAFO 4 opcional (lectura global del partido). Nunca repite los sets; solo
   * aporta una conclusión objetiva cuando existe evidencia que realmente ayude a entender el
   * resultado (§2/§6 del consolidado V11.14: "evidence selection", nunca cuota obligatoria de
   * estadísticas). Deliberadamente NO usa la eficiencia agregada de Break Points del equipo
   * perdedor como evidencia — bug real reportado: "necesitaron menos oportunidades para
   * lograrlo" es correcto pero no explica por qué esa pareja perdió el partido. Prioriza
   * paridad global en puntos y diferencia de quiebres, que sí hablan directamente del
   * resultado.
   */
  function buildGlobalReadParagraph(stats, winnerTeam, nameOf) {
    if (!winnerTeam || stats.totalPoints <= 0) return null;
    const winnerPts = winnerTeam === 'A' ? stats.pointsA : stats.pointsB;
    const loserPts = winnerTeam === 'A' ? stats.pointsB : stats.pointsA;
    const diff = Math.abs(winnerPts - loserPts);
    const closeOverall = diff <= Math.max(2, Math.round(stats.totalPoints * 0.04));
    if (closeOverall) {
      const pctWinner = Math.round((winnerPts / stats.totalPoints) * 100);
      const pctLoser = 100 - pctWinner;
      return `La paridad también quedó reflejada en el total de puntos: ${nameOf(winnerTeam)} terminaron apenas por encima, ${pctWinner}% a ${pctLoser}%. La diferencia final no estuvo en un dominio general del partido, sino en haber conseguido el quiebre decisivo cuando el resultado todavía estaba abierto.`;
    }
    if (stats.hasServerInfo && stats.serverFullyKnown) {
      const bw = winnerTeam === 'A' ? stats.breaks.A : stats.breaks.B;
      const bl = winnerTeam === 'A' ? stats.breaks.B : stats.breaks.A;
      if (bw - bl >= 2) {
        return `En el balance global del partido, ${nameOf(winnerTeam)} también se impusieron en la cuenta de quiebres, ${bw} contra ${bl}.`;
      }
    }
    return null;
  }

  /**
   * V11.14 (feedback real) — COMPOSICIÓN CRONOLÓGICA para partidos Clásico completos a tres
   * sets. Reemplaza el ranking global de historias (que hacía competir un hold del Set 1
   * contra el cierre del Set 3 por los mismos dos lugares narrativos) por una estructura fija:
   * Párrafo 1 = Set 1, Párrafo 2 = Set 2, Párrafo 3 = Set 3 (el set decisivo, máxima
   * prioridad), Párrafo 4 (opcional) = lectura global. Story Ranking (`findDramaticHold`,
   * etc.) se sigue usando, pero DENTRO de cada bloque cronológico — nunca para decidir qué
   * bloque aparece o desaparece. Bug real que motivó este cambio: un hold del Set 1 que
   * salvó Break Points terminaba narrado DESPUÉS del cierre del Set 3, y una comparación de
   * eficiencia de Break Points del equipo perdedor —correcta pero irrelevante para explicar
   * el resultado— le ganaba el lugar al desarrollo real del set decisivo.
   *   REGLA DE UBICACIÓN DEL HOLD BAJO PRESIÓN (reemplaza la de V11.4): ya no tiene un lugar
   *   garantizado en un párrafo fijo — tiene ubicación cronológica obligatoria SI es
   *   seleccionado (se narra dentro del párrafo del set en el que ocurrió, nunca después).
   */
  function buildThreeSetChronologicalStory(stats, matchCtx, sets, winnerTeam, evoData, varietySeed, nameOf) {
    const events = matchCtx.events || [];
    const segments = computeSetSegments(events, matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline);
    const setStats = sets.map((s, i) => {
      const seg = segments.find((sg) => sg.setNumber === i + 1);
      return seg ? computeStats(seg.events, Object.assign({}, matchCtx, { baseline: seg.baseline })) : null;
    });
    const setDeficits = computeSetGameDeficits(events, matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline);
    const dramaticHold = stats.hasServerInfo ? findDramaticHold(events, matchCtx) : null;

    function holdClause(setNumber) {
      if (!dramaticHold || dramaticHold.setNumber !== setNumber) return '';
      let c = ` ${nameOf(dramaticHold.team)} tuvieron que salvar ${dramaticHold.bpSaved} Break Points seguidos para ${pickPhrase('holdPresion', varietySeed)}`;
      if (dramaticHold.closedMatch) c += ' en el game que terminó cerrando el partido.';
      else if (dramaticHold.closedSet) c += ' en el game que cerró ese set.';
      else c += '.';
      return c;
    }
    function deficitFor(setNumber, team) {
      const d = setDeficits.find((x) => x.setNumber === setNumber);
      return (d && d.winner === team) ? d : null;
    }

    // Set 1/Set 2 comparten estructura: déficit real (con Match Points salvados si además esa
    // pareja ya venía 1 set arriba, caso real §3.4) > resumen de quiebres > genérico. Ambas
    // ramas reconocen si el set se resolvió en Tie break (nunca se pierde ese desarrollo por
    // estar fuera del set decisivo, bug potencial detectado al reusar el caso de prueba §3.4).
    function buildEarlySetParagraph(setNumber, phraseBank) {
      const s = sets[setNumber - 1], st = setStats[setNumber - 1];
      const winner = s.winner;
      const opp = winner === 'A' ? 'B' : 'A';
      const deficit = deficitFor(setNumber, winner);
      const hasBigDeficit = deficit && deficit.deficitFacedByWinner >= 3;
      // Match Point solo es posible si el RIVAL de quien ganó este set ya venía con un set de
      // ventaja (cerrar este set hubiera cerrado el partido) — se detecta con los mismos
      // `moments` que alimenta Evolución, nunca una segunda interpretación de los hechos.
      const mpSaved = (evoData.moments || []).filter((m) => m.kind === 'match-point-saved' && m.team === opp && m.setNumber === setNumber).length;
      const closeClause = s.tiebreak ? `en el Tie break, ${orientTiebreak(s.tiebreak, winner)}` : orientScore(s.gamesA, s.gamesB, winner);
      // Solo el Set 2 "fuerza un tercero" — ganar el Set 1 nunca fuerza nada por sí solo.
      const forcingSuffix = setNumber === 2 ? ' para forzar un tercero' : '';
      const setWord = setNumber === 1 ? 'primer set' : 'segundo set';
      let text;
      if (hasBigDeficit) {
        const scoreAbajo = deficit.worstScoreForWinner
          ? orientScore(deficit.worstScoreForWinner.gamesA, deficit.worstScoreForWinner.gamesB, winner)
          : `por ${deficit.deficitFacedByWinner} games`;
        text = `${nameOf(winner)} ${pickPhrase(phraseBank, varietySeed)}: llegaron a estar ${scoreAbajo} abajo en el ${setWord}`;
        if (mpSaved > 0) text += ` y salvaron ${mpSaved === 1 ? 'un Match Point' : `${mpSaved} Match Points`} de ${nameOf(opp)}`;
        text += ` antes de dar vuelta el marcador y quedárselo ${closeClause}${forcingSuffix}.`;
      } else if (st && st.hasServerInfo && st.serverFullyKnown) {
        const wB = winner === 'A' ? st.breaks.A : st.breaks.B;
        const lB = winner === 'A' ? st.breaks.B : st.breaks.A;
        if (wB > 0 && lB === 0) {
          text = `${nameOf(winner)} ${pickPhrase(phraseBank, varietySeed)} y, con ${wB === 1 ? 'un quiebre' : `${wB} quiebres`} a favor, se quedaron con ${setNumber === 1 ? 'un primer set competitivo' : 'el control del segundo set'} ${closeClause}${forcingSuffix}.`;
        } else if (wB > 0 && lB > 0) {
          text = `El ${setWord} tuvo quiebres de los dos lados antes de que ${nameOf(winner)} se lo llevaran ${closeClause}${forcingSuffix}.`;
        } else {
          text = `${nameOf(winner)} ${pickPhrase(phraseBank, varietySeed)} y se quedaron con el ${setWord} ${closeClause}${forcingSuffix}.`;
        }
        if (mpSaved > 0) text = text.replace(/\.$/, '') + `, salvando ${mpSaved === 1 ? 'un Match Point' : `${mpSaved} Match Points`} de ${nameOf(opp)} en el camino.`;
      } else {
        text = `${nameOf(winner)} se quedaron con el ${setWord} ${closeClause}${forcingSuffix}.`;
        if (mpSaved > 0) text = text.replace(/\.$/, '') + `, salvando ${mpSaved === 1 ? 'un Match Point' : `${mpSaved} Match Points`} de ${nameOf(opp)} en el camino.`;
      }
      return text;
    }

    // ---- PÁRRAFO 1 — SET 1: cómo empezó, quién tomó ventaja, cómo terminó ----
    let p1 = buildEarlySetParagraph(1, 'inicio');
    p1 += holdClause(1);

    // ---- PÁRRAFO 2 — SET 2: qué cambió, cómo reaccionó quien perdió el primero, cómo forzó
    //      el tercer set. El ganador del Set 2 es siempre el perdedor del Set 1 (si no, el
    //      partido ya habría terminado en 2 sets corridos y nunca llegaría acá). ----
    let p2 = buildEarlySetParagraph(2, 'reaccion');
    p2 += holdClause(2);

    // ---- PÁRRAFO 3 — SET 3: el set decisivo, máxima prioridad narrativa ----
    const s3 = sets[2], st3 = setStats[2];
    let p3 = buildDecidingSetParagraph(matchCtx, sets, s3, st3, winnerTeam, evoData, nameOf, varietySeed);
    p3 += holdClause(3);
    const closingDuration = buildDurationClosingSentence(stats.matchDurationMs, nameOf(winnerTeam), false);
    if (closingDuration && !s3.tiebreak) p3 += ' ' + closingDuration;

    const paras = [p1, p2, p3];

    // ---- PÁRRAFO 4 (opcional) — lectura global, nunca relleno obligatorio ----
    const globalRead = buildGlobalReadParagraph(stats, winnerTeam, nameOf);
    if (globalRead) paras.push(globalRead);

    return paras.filter(Boolean).join('\n\n');
  }

  /**
   * Bloque R, ahora BRAMU Intelligence (V9) — "de cancha", no una plantilla de
   * estadísticas. Busca primero CUÁL ES LA HISTORIA del partido y recién después la
   * narra con lenguaje deportivo cercano, sin diagnosticar psicología, sin inventar
   * certeza sobre tramos no registrados. V9: si existe una secuencia cronológica
   * decisiva (p.ej. Punto de Oro + quiebre sobre el final del set que definió el
   * partido), esa secuencia tiene prioridad narrativa sobre cualquier estadística
   * agregada (consolidado V9, punto 3) — se detecta reusando el MISMO detector de
   * eventos que alimenta Evolución (`computeEvolutionData`), nunca una segunda
   * interpretación independiente de los mismos hechos (punto 24). V9.2: antes de eso,
   * se clasifica la FORMA GENERAL del partido (dominio claro o no) — ver
   * `detectClearDominance`.
   * V11.14 (feedback real): partidos Clásico completos a tres sets pasan por
   * `buildThreeSetChronologicalStory` en vez de este ranking global — ver esa función para
   * el porqué. El resto de este cuerpo sigue vigente para todos los demás casos (Americano,
   * partidos a un set, dos sets, cobertura parcial, finalización manual).
   */
  /**
   * V12 (§14.1) — envoltorio delgado: el motor narrativo interno (`generateBramuIntelligenceCore`,
   * la función completa de abajo, con toda su lógica ya afinada por múltiples rondas) no se
   * toca. Acá solo se AGREGA, al final de cualquier camino que haya tomado, un párrafo
   * explícito cuando algún set se resolvió con un Tie break extraordinario (§9-13) — nunca
   * se reescribe como si hubiera sido un Tie break reglamentario a 6-6/7-6 (§14.1, última
   * línea: "no presentarlo como un Tie break reglamentario si eso no ocurrió").
   */
  function generateBramuIntelligence(stats, matchCtx, sets, winnerTeam, finishInfo) {
    const text = generateBramuIntelligenceCore(stats, matchCtx, sets, winnerTeam, finishInfo);
    const narrativeTeamLabel = (team) => matchCtx.players.filter((p) => p.team === team).map((p) => p.name).join(' y ');
    const nameOf = (team) => (team === 'A' ? narrativeTeamLabel('A') : narrativeTeamLabel('B'));
    return appendExtraordinaryTiebreakNote(text, sets, nameOf);
  }

  /** §9-13: nunca hay más de un set extraordinario real en un partido — identifica ese set
   *  (si existe) y describe la resolución con su score REAL previo (nunca 6-6/7-6). */
  function appendExtraordinaryTiebreakNote(text, sets, nameOf) {
    const idx = sets.findIndex((s) => s.extraordinary);
    if (idx === -1) return text;
    const s = sets[idx];
    // V12.1 (§1): el segmento extraordinario SIEMPRE es el último — elegir "Resolver con
    // Tie break" termina el partido en el acto, nunca deja continuar a otro set después.
    const setLabel = sets.length === 1 ? 'el set' : (idx === 0 ? 'el primer set' : idx === 1 ? 'el segundo set' : 'el tercer set');
    const cfg = s.tiebreak && s.tiebreak.mode;
    const targetLabel = cfg && typeof cfg === 'object' && cfg.winTarget ? ` a ${cfg.winTarget}` : '';
    // V9.2 (11, reusado acá): marcador orientado hacia quien ganó — mismo criterio que el
    // resto de la prosa (orientScore/orientTiebreak), nunca el orden fijo A-B. V12.1: ya no
    // dice "resolverlo" (el set) — el TB extraordinario resuelve el PARTIDO ENTERO.
    const note = `Con ${setLabel} ${orientScore(s.gamesA, s.gamesB, s.winner)}, decidieron resolver el partido mediante un Tie break${targetLabel}. ${nameOf(s.winner)} se impusieron ${orientTiebreak(s.tiebreak, s.winner)} y se quedaron con el encuentro.`;
    return text + '\n\n' + note;
  }

  function generateBramuIntelligenceCore(stats, matchCtx, sets, winnerTeam, finishInfo) {
    // R1: en texto narrativo, "Seba y Matu" — nunca "Seba / Matu" (esa barra es para UI, no para prosa).
    const narrativeTeamLabel = (team) => matchCtx.players.filter((p) => p.team === team).map((p) => p.name).join(' y ');
    const nameA = narrativeTeamLabel('A');
    const nameB = narrativeTeamLabel('B');
    const otherName = (team) => (team === 'A' ? nameB : nameA);
    const nameOf = (team) => (team === 'A' ? nameA : nameB);
    const partial = !!(stats.hasAdjustments || matchCtx.coverageStartLabel);
    const events = matchCtx.events || [];
    const varietySeed = varietySeedFor(stats, sets); // V11.1 (§11.3): variedad de lenguaje

    // ---- Recolecta candidatas a "la historia principal" (R4/R5), en orden de prioridad ----
    const stories = [];
    const evoData = computeEvolutionData(events, matchCtx);

    // V11.14 (feedback real): partido Clásico completo a tres sets — composición
    // CRONOLÓGICA dedicada, ver `buildThreeSetChronologicalStory`. Nunca se activa con
    // cobertura parcial (`partial`: hay adjustments o el registro arrancó a mitad de
    // partido) ni con finalización manual — esos casos no tienen un desarrollo completo y
    // confiable de CADA set para narrar capítulo por capítulo, así que siguen por el motor
    // original de abajo. Solo es alcanzable en el formato Clásico (bestOfSets:3); Americano
    // es bestOfSets:1 y nunca llega a sets.length === 3.
    // V12 (§14.1): un set resuelto por Tie break extraordinario tampoco toma este camino —
    // su score real (p.ej. 5-5) no encaja en los supuestos de "set reglamentario cerrado"
    // que este composer asume por diseño; sigue por el motor original, y la nota de §14.1
    // se agrega aparte en `appendExtraordinaryTiebreakNote`.
    const hasExtraordinarySet = sets.some((s) => s.extraordinary);
    if (winnerTeam && sets.length === 3 && !partial && !hasExtraordinarySet && !(finishInfo && finishInfo.manual)) {
      return buildThreeSetChronologicalStory(stats, matchCtx, sets, winnerTeam, evoData, varietySeed, nameOf);
    }

    // -1) V9.2 (1-2) — DOMINIO CLARO: se evalúa ANTES que cualquier evento puntual. La
    //    prioridad narrativa depende del CONTEXTO GLOBAL del partido — un quiebre con Oro
    //    tardío no puede encabezar el análisis de un partido que en realidad ya estaba
    //    resuelto de principio a fin (bug real: 6-0/6-1 narrado como "decidido en el 4-1
    //    del segundo set"). Si el partido fue un dominio claro, ESA es la historia
    //    principal, por encima incluso de la secuencia decisiva puntual.
    const dominance = detectClearDominance(stats, sets, winnerTeam);
    if (dominance) {
      stories.push({ kind: 'dominio-claro', weight: 120, partialSensitive: false, text: buildClearDominanceText(dominance, stats, sets, nameOf) });
    }

    // 0) V9 (3/8) — SECUENCIA CRONOLÓGICA DECISIVA: un quiebre logrado con Punto de
    //    Oro/Star Point sobre el tramo final del set que definió el partido, a favor de
    //    quien terminó ganando. Tiene prioridad por sobre cualquier otra lectura (incluso
    //    una remontada o un resultado contraintuitivo) porque es, literalmente, el punto
    //    en el que se decidió el partido — PERO solo si el marcador previo era realmente
    //    parejo (V9.2, punto 3: "competitividad previa", diferencia de games <= 1). Sin esa
    //    condición, un quiebre tardío en un partido ya inclinado (4-1 en el segundo set de
    //    un 6-0/6-1) se leía incorrectamente como "el momento decisivo".
    if (!dominance && winnerTeam && sets.length) {
      const decidingSetNumber = sets.length;
      const decidingSet = sets[decidingSetNumber - 1];
      const lateThreshold = Math.max(0, matchCtx.format.setWinTarget - 2);
      const decisive = evoData.moments.find((m) => {
        if (m.kind !== 'break' || !m.isGoldOrStar || m.setNumber !== decidingSetNumber || m.team !== winnerTeam) return false;
        const [beforeA, beforeB] = m.scoreBefore.split('-').map(Number);
        const isLate = Math.max(beforeA, beforeB) >= lateThreshold;
        const isClose = Math.abs(beforeA - beforeB) <= 1;
        return isLate && isClose;
      });
      if (decisive && decidingSet && decidingSet.winner === winnerTeam) {
        const pointLabel = matchCtx.scoringSystem === 'golden' ? 'un Punto de Oro' : 'un Star Point';
        const serverClause = decisive.server ? ' sobre el saque rival' : '';
        const loserTeamDec = winnerTeam === 'A' ? 'B' : 'A';
        // V11.16 (feedback real) — este quiebre puede haber sido el ÚLTIMO punto jugado: se
        // compara con el momento `match-finish` (nunca con `decisive.scoreAfter`, que queda
        // en "0-0" cuando el mismo punto que rompe TAMBIÉN cierra el set/partido — el
        // contador de games se resetea de cara a un set siguiente que acá no existe, un
        // detalle interno de `computeEvolutionData` que no se toca en esta ronda). Si no hubo
        // ningún punto posterior, no hubo ningún hold — bug real reportado: se afirmaba "y
        // después sostuvieron su servicio para cerrar" sobre un partido ya terminado.
        const matchFinishMoment = evoData.moments.find((m) => m.kind === 'match-finish');
        const closedDirectly = !!matchFinishMoment && matchFinishMoment.matchTimeMs === decisive.matchTimeMs;
        const finalScoreStr = orientScore(decidingSet.gamesA, decidingSet.gamesB, winnerTeam);
        const mpSavedBeforeDecisive = countMatchPointsSavedInSet(evoData, winnerTeam, loserTeamDec, decisive.setNumber);

        let text;
        if (mpSavedBeforeDecisive > 0) {
          // Los Match Points salvados son el antecedente directo del punto decisivo: van
          // primero, cronológicamente (bug real de orden narrativo).
          text = `Después de que ${nameOf(loserTeamDec)} salvaran ${mpSavedBeforeDecisive === 1 ? 'un Match Point' : `${mpSavedBeforeDecisive} Match Points`}, ${nameOf(winnerTeam)} aprovecharon ${pointLabel}${serverClause} y consiguieron el quiebre`;
        } else {
          // V11.16: "en el X° set" solo aporta con más de un set en juego (Clásico) — en
          // Americano (un único set posible) suena mecánico, se omite.
          const setClause = sets.length > 1 ? ` en el ${decisive.setNumber}° set` : '';
          text = `El momento decisivo llegó con ${decisive.scoreBefore}${setClause}. `;
          text += `${nameOf(decisive.team)} ganaron ${pointLabel}${serverClause}, ${pickPhrase('quiebre', varietySeed)}`;
        }
        text += closedDirectly
          ? ` que cerró directamente el partido ${finalScoreStr}.`
          : (sets.length > 1 ? ' y después sostuvieron su servicio para cerrar el partido.' : ` y después sostuvieron su servicio para cerrar ${finalScoreStr}.`);
        const arc = buildSetArcSentence(sets, nameOf, decisive.setNumber);
        stories.push({ kind: 'decisivo-oro-break', weight: 110, text: (arc ? arc + ' ' : '') + text, partialSensitive: false, mpMentioned: mpSavedBeforeDecisive > 0 });
      }
    }

    // 1) Resultado contraintuitivo: el ganador hizo menos puntos totales.
    if (winnerTeam && stats.totalPoints > 0) {
      const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
      if (stats[`points${loserTeam}`] > stats[`points${winnerTeam}`]) {
        stories.push({
          kind: 'contraintuitivo', weight: 100,
          text: `${nameOf(winnerTeam)} ganaron pese a sumar menos puntos que ${nameOf(loserTeam)}, ${stats.pointsA}-${stats.pointsB} en el cómputo total. Fueron más efectivos en los momentos que realmente valían.`,
        });
      }
    }

    // 2) Remontada: mayor deficit (en games, dentro de un set con eventos reales) o haber
    //    perdido el primer set y dado vuelta el resultado.
    // V8 (24-25): cuando esa remontada ocurre en el SET QUE DEFINE el partido, se enriquece
    //    con lo que realmente la hace grande — el marcador exacto en el peor momento, los
    //    Match Points salvados y un Tie break decisivo — en vez de quedarse en el resultado
    //    final del set. Esta es LA historia principal por delante de cualquier lectura de
    //    igualdad de puntos (25): el peso sube de 90 a 97 cuando además hubo Match Points
    //    salvados y Tie break, que es exactamente el caso que no puede perder contra un
    //    "parejo-extremo" calculado sobre el total de puntos.
    let setDeficits = [];
    if (winnerTeam) {
      const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
      setDeficits = computeSetGameDeficits(events, matchCtx.scoringSystem, matchCtx.format, matchCtx.tiebreakMode, matchCtx.baseline);
      const winnerDeficits = setDeficits.filter((d) => d.winner === winnerTeam && d.deficitFacedByWinner >= 3);
      if (winnerDeficits.length) {
        const biggest = winnerDeficits.reduce((max, d) => (d.deficitFacedByWinner > max.deficitFacedByWinner ? d : max));
        // V11 (§3.1/§3.4): la remontada puede haber ocurrido en CUALQUIER set del partido, no
        // solo en el último — en un bo3, ir 1 set arriba ya genera Match Points reales en el
        // segundo set aunque el partido siga a un tercero. Antes esto solo se enriquecía con
        // Match Points/Tie break cuando coincidía con el ÚLTIMO set del partido — bug real: el
        // caso patrón del consolidado (6-3 · 6-7 · 2-6) perdía los 3 Match Points salvados y
        // el Tie break del segundo set por completo, porque ese set no era el último. Ahora se
        // buscan los hechos puntuales DE ESE set específico, vía los mismos momentos que
        // alimentan Evolución/Momentos Clave (nunca una segunda interpretación de los mismos
        // datos, punto 24 del histórico).
        const actSet = sets[biggest.setNumber - 1];
        const loserMpSavedInSet = evoData.moments.filter((m) => m.kind === 'match-point-saved' && m.team === loserTeam && m.setNumber === biggest.setNumber).length;
        const wasTiebreakClose = !!(actSet && actSet.tiebreak);

        let scoreAbajo = `por ${biggest.deficitFacedByWinner} games`;
        if (biggest.worstScoreForWinner) {
          const theirs = winnerTeam === 'A' ? biggest.worstScoreForWinner.gamesA : biggest.worstScoreForWinner.gamesB;
          const opp = winnerTeam === 'A' ? biggest.worstScoreForWinner.gamesB : biggest.worstScoreForWinner.gamesA;
          scoreAbajo = `${theirs}-${opp}`;
        }
        let text = `${nameOf(winnerTeam)} protagonizaron una gran remontada en el Set ${biggest.setNumber}. Estuvieron ${scoreAbajo} abajo`;
        if (loserMpSavedInSet > 0) {
          text += ` y salvaron ${loserMpSavedInSet === 1 ? 'un Match Point' : `${loserMpSavedInSet} Match Points`} de ${nameOf(loserTeam)}`;
        }
        if (wasTiebreakClose) {
          // V9 (7): el marcador narrativo se orienta siempre hacia el protagonista de la
          // frase (acá, quien ganó) — nunca el orden fijo A-B del Tie break real, que es
          // el que usan la Timeline y las tarjetas de marcador (esos sí mantienen A-B).
          text += ` antes de llevar el set al Tie break, donde terminaron imponiéndose ${orientTiebreak(actSet.tiebreak, winnerTeam)}.`;
          // V11.4 (feedback real) — mismo desarrollo del propio TB que la historia dedicada
          // de "Tie break decisivo sin quiebres": si hubo una separación real dentro del
          // desempate, contarla también acá en vez de quedarse solo en el resultado final.
          const tbArc = describeTiebreakArc(events, matchCtx, biggest.setNumber, winnerTeam);
          const tbArcClause = buildTiebreakArcClause(tbArc, nameOf, winnerTeam, loserTeam);
          if (tbArcClause) text += ' ' + tbArcClause;
        } else {
          // V11 (§2.4): marcador orientado hacia quien protagoniza la frase — nunca
          // gamesA-gamesB crudo (bug real: "ganarlo 6-7" narrando al equipo que ganó 7-6).
          text += ` y lo dieron vuelta para ganarlo ${orientScore(biggest.gamesA, biggest.gamesB, winnerTeam)}.`;
        }
        // V11 (§3.1): si hubo sets ANTES de este (p.ej. el rival se llevó el primero), se
        // antepone su resumen — ningún acto de la "película" queda sin contar.
        const arc = buildSetArcSentence(sets, nameOf, biggest.setNumber);
        const weight = (loserMpSavedInSet > 0 && wasTiebreakClose) ? 97 : 90;
        stories.push({
          kind: 'remontada', weight, text: (arc ? arc + ' ' : '') + text,
          mpMentioned: loserMpSavedInSet > 0, actSetNumber: biggest.setNumber,
          tbMentionedSetNumber: wasTiebreakClose ? biggest.setNumber : null,
        });
      } else if (sets.length >= 2 && sets[0].winner && sets[0].winner !== winnerTeam) {
        stories.push({
          kind: 'remontada-set', weight: 85, partialSensitive: false,
          // V11 (§2.4): orientado hacia el protagonista de la frase — nunca el orden fijo A-B.
          // V11.1 (§11.3): verbo de reacción variable.
          text: `${nameOf(winnerTeam)} arrancaron perdiendo el primer set (${orientScore(sets[0].gamesA, sets[0].gamesB, winnerTeam)}) pero ${pickPhrase('reaccion', varietySeed)} y se llevaron el partido.`,
        });
      } else {
        // V9.2 (10): "se agarraron al partido" se reserva EXCLUSIVAMENTE para quien salva
        // Match Points y termina GANANDO — acá el equipo que remontó parcialmente terminó
        // PERDIENDO, así que corresponde "se mantuvieron con vida" / "resistieron", nunca
        // la frase de remontada victoriosa (bug real reportado).
        const lastDeficit = setDeficits[setDeficits.length - 1];
        const winnerMpOpps = stats.matchPoints[winnerTeam].opportunities;
        if (lastDeficit && lastDeficit.setNumber === sets.length && lastDeficit.winner === winnerTeam
          && lastDeficit.deficitFacedByLoser >= 3 && winnerMpOpps >= 2) {
          const savedMp = winnerMpOpps - 1;
          let text = `${nameOf(loserTeam)} se mantuvieron con vida: llegaron a estar ${lastDeficit.deficitFacedByLoser} games abajo en el Set ${lastDeficit.setNumber} y achicaron la diferencia`;
          if (savedMp > 0) text += `, salvando ${savedMp === 1 ? 'un Match Point' : `${savedMp} Match Points`} en el camino`;
          text += `, pero no consiguieron completar la remontada: ${nameOf(winnerTeam)} se quedaron con el partido.`;
          stories.push({ kind: 'casi-remontada', weight: 70, text, mpMentioned: savedMp > 0 });
        }
      }
    }

    // 2b) Partido extremadamente parejo (R2/37.2): puntos ganados casi idénticos. Si además
    //     los breaks (y, cuando se conoce el saque, los holds) también están parejos, el
    //     empate es todavía más marcado — se sostiene con esos datos, nunca solo se afirma.
    // V8 (25): esta es evidencia SECUNDARIA — nunca debe pisar una remontada, un único
    //    quiebre o un cambio de dominio como historia principal. Antes tenía peso 95 (por
    //    encima incluso de la remontada) y era exactamente el bug reportado: un 38-38 en
    //    puntos totales le ganaba a una remontada de 1-5 con 4 Match Points salvados. Ahora
    //    queda por debajo de todas las historias de peso deportivo real, para que aparezca
    //    como segunda oración de refuerzo ("aun así, terminaron parejos en puntos") y no
    //    como titular.
    if (stats.totalPoints > 0) {
      const ptsDiff = Math.abs(stats.pointsA - stats.pointsB);
      const veryClose = ptsDiff <= Math.max(2, Math.round(stats.totalPoints * 0.02));
      if (veryClose) {
        let extra = '';
        const sameBreaks = stats.breaks.A === stats.breaks.B;
        if (sameBreaks && stats.breaks.A > 0) {
          extra = `Ambas parejas consiguieron ${stats.breaks.A} break${stats.breaks.A === 1 ? '' : 's'}`;
          if (stats.hasServerInfo && stats.serverFullyKnown) {
            const sgA = stats.serviceGames.wonA + stats.serviceGames.lostA;
            const sgB = stats.serviceGames.wonB + stats.serviceGames.lostB;
            const sameHoldRatio = stats.serviceGames.wonA === stats.serviceGames.wonB && sgA === sgB;
            extra += sameHoldRatio
              ? ` y sostuvieron ${stats.serviceGames.wonA} de sus ${sgA} games de saque`
              : ` y sostuvieron ${stats.serviceGames.wonA} de sus ${sgA} y ${stats.serviceGames.wonB} de sus ${sgB} games de saque respectivamente`;
          }
          extra = ' ' + extra + '.';
        }
        stories.push({
          kind: 'parejo-extremo', weight: 20,
          text: `El equilibrio final fue enorme: incluso terminaron ${stats.pointsA}-${stats.pointsB} en puntos ganados.${extra}`,
        });
      }
    }

    // 3) Cambio de dominio: el que ganó el primer set no fue el mismo que dominó el cierre.
    if (winnerTeam && sets.length >= 2 && sets[0].winner && sets[0].winner === winnerTeam) {
      const lastSet = sets[sets.length - 1];
      if (lastSet.winner === winnerTeam && sets.some((s) => s.winner !== winnerTeam)) {
        stories.push({
          kind: 'dominio-cambio', weight: 60, partialSensitive: false,
          // V11.1 (§11.3): verbo de apertura variable.
          text: `${nameOf(winnerTeam)} ${pickPhrase('inicio', varietySeed)}, pero ${otherName(winnerTeam)} les cambiaron el partido en el medio antes de que ${nameOf(winnerTeam)} volvieran a imponerse para cerrarlo.`,
        });
      }
    }

    // 4b) V7 (70-72) — ÚNICO QUIEBRE DEL PARTIDO: si en todo el encuentro hubo exactamente
    //     un solo break real (siempre que se conozca el saque), esa es casi siempre la
    //     historia central — prioridad muy alta (por debajo solo de un resultado
    //     contraintuitivo o una remontada grande, sección 58 #3). V9.2: solo si además ESE
    //     quiebre fue de la pareja que terminó GANANDO el partido — si rompió y de todos
    //     modos terminó perdiendo (una remontada posterior lo dio vuelta), "sostuvieron esa
    //     diferencia hasta el final" sería directamente falso; en ese caso la remontada ya
    //     cuenta la historia real por su cuenta.
    if (stats.hasServerInfo && (stats.breaks.A + stats.breaks.B) === 1 && winnerTeam) {
      const detail = findSoleBreakDetail(events, matchCtx);
      if (detail && detail.breakerTeam === winnerTeam) {
        const breaker = detail.breakerTeam;
        const serverPlayer = detail.serverPlayerId != null ? matchCtx.players.find((p) => p.id === detail.serverPlayerId) : null;
        // V9.2 (11): marcador orientado hacia quien rompió, en vez del orden fijo A-B.
        const beforeStr = orientScore(detail.scoreBefore.gamesA, detail.scoreBefore.gamesB, breaker);
        const afterStr = orientScore(detail.scoreAfter.gamesA, detail.scoreAfter.gamesB, breaker);
        const gamesBeforeBreak = detail.scoreBefore.gamesA + detail.scoreBefore.gamesB;
        const serverClause = serverPlayer ? ` sobre el saque de ${serverPlayer.name}` : '';

        // V9.2 (4/12): si este mismo quiebre cerró el set y/o el partido, decirlo tal cual
        // — nunca "sostuvieron esa diferencia hasta el final" cuando ese game YA FUE el
        // final (bug real: Americano 6-4 con el único break cerrando el partido en el acto).
        // Con cobertura parcial, la salvedad de "hasta donde llega el registro" solo aplica
        // cuando el cierre en sí NO está registrado — si sabemos que cerró, se dice igual.
        let closingClause;
        if (detail.closedMatch) closingClause = `cerraron el partido ${afterStr}`;
        else if (detail.closedSet) closingClause = `cerraron el set ${afterStr}`;
        else closingClause = `se pusieron ${afterStr} y sostuvieron esa diferencia hasta ${partial ? 'donde llega el registro' : 'el final'}`;

        // 5/TEST1 del consolidado: si el quiebre llegó tarde en un set largo sin diferencias
        // previas, vale la pena decir que el partido fue parejo hasta ese momento.
        const parejoPrefix = gamesBeforeBreak >= 6
          ? `Fue un partido muy parejo: sostuvieron el servicio durante los primeros ${gamesBeforeBreak} games hasta llegar ${beforeStr}. `
          : '';

        // 30: si la cobertura es parcial, no podemos afirmar que fue "el" quiebre de TODO el
        // partido — solo que fue el único dentro del tramo que realmente registramos.
        let text;
        if (partial) {
          text = `${parejoPrefix}En el tramo registrado, el único quiebre fue de ${nameOf(breaker)}${serverClause}, con el marcador en ${beforeStr}: ${closingClause}.`;
        } else {
          text = `${parejoPrefix}El partido se decidió por un solo quiebre: ${nameOf(breaker)} lo consiguieron${serverClause} cuando el marcador estaba ${beforeStr}, y ${closingClause}.`;
        }
        // partialSensitive:false — la aclaración de cobertura ya está integrada arriba a mano.
        stories.push({ kind: 'unico-break', weight: 92, text, partialSensitive: false });
      }
    }

    // 4c) V10 (§6.12/test §52) — TIE BREAK DECISIVO SIN QUIEBRES: nadie rompió el servicio
    //     en todo el partido y el desempate fue lo que realmente definió. Es la misma
    //     jerarquía narrativa que "único quiebre" (89 vs 92) — un solo factor estructural
    //     decide un partido por lo demás parejo — pero nunca debe leerse como dominio por
    //     puntos totales (§52: paridad estructural, no volumen).
    // V11.4 (feedback real, caso 5-5 sin breaks → TB 7-3): antes esto se quedaba en el
    // resultado final del TB sin más — perdiendo tanto la paridad real que traía el resto
    // del partido (puntos, saque, resto, Oro casi espejados) como el desarrollo del propio
    // TB (una pareja se separa temprano, la otra ajusta, pero no alcanza). Ahora, cuando hay
    // evidencia real, se agregan esas dos capas — nunca por relleno, solo si hay historia.
    if (stats.hasServerInfo && stats.breaks.A === 0 && stats.breaks.B === 0 && winnerTeam) {
      const decidingSet = sets[sets.length - 1];
      // V12.2 (§3): un Tie break EXTRAORDINARIO nunca entra acá — `appendExtraordinaryTiebreakNote`
      // (envoltorio de `generateBramuIntelligence`) ya lo narra completo con su propio
      // contexto real (score previo, "resolver el partido"); dejar que esta historia
      // también lo cuente duplicaba el mismo hecho con dos redacciones distintas.
      if (decidingSet && decidingSet.tiebreak && !decidingSet.extraordinary) {
        const tb = decidingSet.tiebreak;
        const tbResult = orientTiebreak(tb, winnerTeam);
        const loserTeamTb = winnerTeam === 'A' ? 'B' : 'A';
        const strongParity = detectStrongParity(stats);
        // V11.16 (feedback real) — si el camino al Tie break pasó por salvar Match Points (la
        // pareja que terminó ganando sostuvo su saque bajo presión real para forzar el
        // desempate), ese hecho es el antecedente directo del propio TB: va PRIMERO, nunca
        // después de contar cómo se desarrolló el desempate (bug real de orden narrativo:
        // BRAMU contaba primero el TB y volvía hacia atrás a mencionar los Match Points).
        const preTbMp = findPreTiebreakMatchPointsSaved(evoData, sets.length);
        let leadIn = '';
        if (preTbMp) {
          leadIn = `${nameOf(preTbMp.saverTeam)} salvaron ${preTbMp.count === 1 ? 'un Match Point' : `${preTbMp.count} Match Points`} de ${nameOf(preTbMp.holderTeam)} para ${pickPhrase('holdPresion', varietySeed)} y forzar el Tie break. `;
        }
        let text;
        if (strongParity) {
          text = sets.length > 1
            ? `El partido se mantuvo extremadamente parejo: nadie quebró el servicio y la diferencia apareció recién en el Tie break del ${sets.length}° set, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`
            : `El partido se mantuvo extremadamente parejo: nadie quebró el servicio y la diferencia apareció recién en el Tie break, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`;
          if (stats.totalPoints > 0) {
            text += ` Incluso los números terminaron parejos: ${stats.pointsA}-${stats.pointsB} en puntos ganados.`;
          }
        } else {
          text = sets.length > 1
            ? `Nadie quebró el servicio en todo el partido: la definición pasó por el Tie break del ${sets.length}° set, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`
            : `Nadie quebró el servicio en todo el set: la definición pasó por el Tie break, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`;
        }
        text = leadIn + text;
        const arc = describeTiebreakArc(events, matchCtx, sets.length, winnerTeam);
        const arcClause = buildTiebreakArcClause(arc, nameOf, winnerTeam, loserTeamTb);
        if (arcClause) text += ' ' + arcClause;
        // V11 (§2.5): marca que el Tie break del último set ya quedó narrado acá, para que el
        // cierre por duración (párrafo final) no lo repita ("...cerrando el Tie break final
        // X-Y" después de ya haberlo contado) — bug real de redundancia narrativa.
        stories.push({ kind: 'tie-break-decisivo', weight: 89, text, partialSensitive: false, tbMentionedSetNumber: sets.length, mpMentioned: !!preTbMp });
      }
    }

    // 4) Dominio con el saque (prioridad 6 del consolidado — por debajo de remontada/cambio de set).
    if (stats.hasServerInfo && stats.serverFullyKnown) {
      const sgA = stats.serviceGames.wonA + stats.serviceGames.lostA;
      const sgB = stats.serviceGames.wonB + stats.serviceGames.lostB;
      const holdA = sgA > 0 ? stats.serviceGames.wonA / sgA : null;
      const holdB = sgB > 0 ? stats.serviceGames.wonB / sgB : null;
      if (holdA != null && holdB != null && Math.abs(holdA - holdB) >= 0.15 && (sgA + sgB) >= 4) {
        const leader = holdA > holdB ? 'A' : 'B';
        const leaderLost = leader === 'A' ? stats.serviceGames.lostA : stats.serviceGames.lostB;
        const neverBroken = leaderLost === 0;
        // 28: "en todo el partido" solo si el registro es completo — con cobertura parcial,
        // la afirmación se limita explícitamente a los games de saque REGISTRADOS.
        let text;
        if (neverBroken) {
          text = partial
            ? `${nameOf(leader)} se hicieron fuertes con el saque: no cedieron su servicio en los games registrados.`
            : `${nameOf(leader)} se hicieron fuertes con el saque: no cedieron su servicio en todo el partido.`;
        } else {
          const leaderWon = leader === 'A' ? stats.serviceGames.wonA : stats.serviceGames.wonB;
          const leaderTotal = leader === 'A' ? sgA : sgB;
          // V8.2 (27): sin paréntesis pegado al final — la cifra entra como cláusula natural.
          text = `${nameOf(leader)} se hicieron fuertes con el saque y sostuvieron casi todos sus games, ${leaderWon} de ${leaderTotal}.`;
        }
        stories.push({ kind: 'saque', weight: neverBroken ? 55 : 35, text, partialSensitive: false });
      }
    }

    // 5) Presión desde el resto / Break Points (prioridad 7). REGLA CENTRAL (35): nunca
    //    mostrar solo las oportunidades generadas sin decir cuántas se convirtieron — “generó
    //    16 Break Points” sin más es una estadística aislada que cuenta una historia falsa si
    //    solo convirtió 2. Siempre oportunidad + conversión de ambas parejas (40).
    // V11 (§2.1/§23): toda la interpretación (breaks > eficiencia > oportunidades, nunca "0
    //    quiebres" como contundencia, nunca "aprovechó mejor" con la misma eficiencia) vive
    //    entera en interpretBreakPointsNarrative — antes había una rama especial acá con sus
    //    propias guardas, ligeramente distintas de las de esa función, y esa duplicación fue
    //    exactamente lo que produjo el bug real de "0 quiebres" en V10.
    if (stats.hasServerInfo && stats.serverFullyKnown && (stats.breakPoints.A.opportunities + stats.breakPoints.B.opportunities) >= 6) {
      const text = interpretBreakPointsNarrative(stats.breakPoints.A, stats.breakPoints.B, nameOf, otherName);
      if (text) stories.push({ kind: 'resto', weight: 40, text });
    }

    // V9/V9.2: cuando aparece "dominio claro" (120) o la secuencia cronológica decisiva
    // (110), ya traen su propio resumen de sets — las historias que describirían el mismo
    // arco general del partido desde otro ángulo (único quiebre, remontada, cambio de
    // dominio, presión desde el resto, dominio del saque) quedarían redundantes repitiendo
    // el mismo hecho dos veces en el párrafo principal, así que se descartan a favor de la
    // versión más rica. "Dominio claro" además descarta "decisivo-oro-break": si el partido
    // ya estaba resuelto de principio a fin, ningún quiebre puntual debe encabezar la
    // historia (bug real V9.2, punto 1-2).
    if (stories.some((s) => s.kind === 'dominio-claro')) {
      ['decisivo-oro-break', 'unico-break', 'tie-break-decisivo', 'remontada', 'remontada-set', 'casi-remontada', 'dominio-cambio', 'resto', 'saque'].forEach((k) => {
        const dupIdx = stories.findIndex((s) => s.kind === k);
        if (dupIdx !== -1) stories.splice(dupIdx, 1);
      });
    } else if (stories.some((s) => s.kind === 'decisivo-oro-break')) {
      ['unico-break', 'tie-break-decisivo', 'remontada', 'remontada-set', 'casi-remontada', 'dominio-cambio'].forEach((k) => {
        const dupIdx = stories.findIndex((s) => s.kind === k);
        if (dupIdx !== -1) stories.splice(dupIdx, 1);
      });
    }
    stories.sort((a, b) => b.weight - a.weight);
    const topStories = stories.slice(0, 2);
    // 29: separar DOS fuentes distintas de certeza. Un resultado de set conocido (aunque se
    // haya cargado a mano en "Partido ya empezado") es un hecho objetivo del marcador —
    // nunca lleva la salvedad de cobertura parcial. Lo que sí depende exclusivamente de los
    // eventos trackeados (puntos, breaks, rachas, Match Points) sí la lleva, salvo que la
    // propia historia ya integre su propia aclaración a mano (`partialSensitive:false`).
    const mainStories = topStories.map((s) => {
      if (partial && s.partialSensitive !== false) {
        const t = s.text;
        return 'En el tramo registrado, ' + t.charAt(0).toLowerCase() + t.slice(1);
      }
      return s.text;
    });
    const usedKinds = topStories.map((s) => s.kind);

    // ---- Párrafo 1: la historia principal, o un resumen general si no hay ninguna marcada ----
    const paras = [];
    if (mainStories.length) {
      paras.push(mainStories.join(' '));
    } else if (stats.totalPoints > 0) {
      const diff = stats.pointsA - stats.pointsB;
      const closeMatch = Math.abs(diff) <= Math.max(2, Math.round(stats.totalPoints * 0.04));
      if (closeMatch) {
        paras.push(`${partial ? 'En los tramos registrados, el' : 'El'} partido estuvo parejo de punta a punta (${stats.pointsA}-${stats.pointsB}).`);
      } else {
        const leader = diff > 0 ? 'A' : 'B';
        paras.push(`${nameOf(leader)} ${partial ? 'llevaron la iniciativa en los tramos registrados' : 'llevaron la iniciativa durante buena parte del encuentro'}, con ${stats.pointsA}-${stats.pointsB} en el cómputo de puntos.`);
      }
    }
    // 87/V8(30): solo se declara "el set más parejo" si hay un ÚNICO set con el margen más
    // chico (nunca un empate arbitrario entre dos), ese margen es realmente ajustado (2
    // games o menos), Y no hay ya una historia con más peso deportivo real contando el
    // partido (remontada, único quiebre, cambio de dominio, resultado contraintuitivo...).
    // Si esas existen, "el set más parejo" no suma nada y se omite (30).
    const strongStoryKinds = ['remontada', 'remontada-set', 'casi-remontada', 'unico-break', 'tie-break-decisivo', 'contraintuitivo', 'dominio-cambio', 'decisivo-oro-break', 'dominio-claro'];
    const hasStrongStory = usedKinds.some((k) => strongStoryKinds.includes(k));
    if (sets.length > 1 && !hasStrongStory) {
      const diffs = sets.map((s) => Math.abs(s.gamesA - s.gamesB));
      const minDiff = Math.min(...diffs);
      const minCount = diffs.filter((d) => d === minDiff).length;
      if (minCount === 1 && minDiff <= 2) {
        const idx = diffs.indexOf(minDiff);
        paras[0] = (paras[0] || '') + ` El set más parejo fue el ${idx + 1}° (${sets[idx].gamesA}-${sets[idx].gamesB}).`;
      }
    }

    // ---- Acto de cierre (V11 §3.1/§3.4): si la remontada elegida como historia principal
    //      ocurrió en un set que NO es el último, el desenlace real del partido queda en un
    //      set totalmente distinto que el párrafo principal no cubre — bug real reportado
    //      (6-3 · 6-7 · 2-6: se omitía por completo el dominio del ganador en el tercer set).
    //      Se agrega como párrafo propio, con datos reales de ESE set (quiebres si se conoce
    //      el saque, marcador siempre orientado), para que ningún acto de la "película" quede
    //      sin contar.
    let closingActTbMentioned = false;
    const remontadaStory = topStories.find((s) => s.kind === 'remontada');
    if (remontadaStory && remontadaStory.actSetNumber) {
      const closingAct = buildClosingActText(matchCtx, sets, remontadaStory.actSetNumber, nameOf, varietySeed);
      if (closingAct) {
        paras.push(closingAct.text);
        closingActTbMentioned = closingAct.tbMentioned;
      }
    }

    // ---- Párrafo 2: puntos decisivos (R6/R7/R8/R9/AB) ----
    const sentences2 = [];
    // V11.4 (§4.3, feedback real): el hold bajo presión pasa a ser un agregado GARANTIZADO
    // del párrafo de puntos decisivos, no una historia que compite por el lugar
    // protagónico — antes, con peso propio, le podía ganar la portada al resumen agregado
    // de Break Points (weight 40) en partidos sin dominancia ni remontada, dejando afuera
    // justo la lectura más importante del partido (bug real reportado: un partido 5-5 sin
    // breaks definido por Tie break terminaba mencionando SOLO un hold puntual del Set 1,
    // sin una palabra sobre la paridad real ni el propio Tie break). `findDramaticHold` ya
    // excluye los puntos que también fueron Match/Set Point (evita narrar la misma
    // secuencia dos veces bajo dos etiquetas), así que agregarlo acá es seguro.
    if (stats.hasServerInfo) {
      const dramaticHold = findDramaticHold(events, matchCtx);
      if (dramaticHold) {
        // V11.16 (feedback real) — "en el Set 1" suena mecánico en un partido Americano, que
        // solo tiene un set posible (nunca hay un "Set 2" del que distinguirse). Ahí se usa
        // el game exacto en su lugar; en Clásico (más de un set) "Set N" sigue ayudando a
        // ordenar la crónica, así que se mantiene.
        const isSingleSetMatch = sets.length === 1;
        const locationClause = !isSingleSetMatch
          ? ` en el Set ${dramaticHold.setNumber}`
          : (dramaticHold.withinSetGameNumber ? ` en el ${ordinalGameWord(dramaticHold.withinSetGameNumber)}` : '');
        let holdText = `${nameOf(dramaticHold.team)} tuvieron que salvar ${dramaticHold.bpSaved} Break Points seguidos para ${pickPhrase('holdPresion', varietySeed)}${locationClause}`;
        if (dramaticHold.closedMatch) holdText += ', justo en el game que terminó cerrando el partido.';
        else if (dramaticHold.closedSet) holdText += ', justo en el game que cerró ese set.';
        else holdText += '.';
        sentences2.push(holdText);
      }
    }
    // V8: si la historia principal (remontada o casi-remontada) YA narró estos mismos
    // Match Points salvados, no se repite acá con otra frase que cuenta lo mismo.
    const alreadyMentionedMp = topStories.some((s) => s.mpMentioned);
    if (winnerTeam && !alreadyMentionedMp) {
      const winnerMp = stats.matchPoints[winnerTeam]; // oportunidades propias antes de cerrar
      const loserTeam = winnerTeam === 'A' ? 'B' : 'A';
      const loserMp = stats.matchPoints[loserTeam]; // oportunidades que tuvo el PERDEDOR (siempre salvadas por el ganador)
      const savedByLoser = Math.max(0, winnerMp.opportunities - 1); // veces que el perdedor le salvó un Match Point al ganador

      // V9.2 (10): loserTeam salvó Match Points del ganador pero terminó PERDIENDO — no
      // corresponde "se agarraron al partido" (esa frase es solo para quien salva MPs y
      // termina GANANDO). Acá va "se mantuvieron con vida" / "estiraron el partido".
      if (savedByLoser >= 3) {
        sentences2.push(`${nameOf(loserTeam)} se mantuvieron con vida y salvaron ${savedByLoser} Match Point${savedByLoser === 1 ? '' : 's'}, pero ${nameOf(winnerTeam)} terminaron cerrándolo en su ${ORDINALS[winnerMp.opportunities] || winnerMp.opportunities + 'ª'} oportunidad.`);
      } else if (winnerMp.opportunities >= 4) {
        sentences2.push(`A ${nameOf(winnerTeam)} les costó cerrar: necesitaron ${winnerMp.opportunities} Match Points para terminar el partido.`);
      } else if (winnerMp.opportunities >= 2) {
        // V11.16 (feedback real) — sujeto SIEMPRE explícito: si la oración anterior (p.ej. el
        // hold bajo presión de arriba) tuvo a la pareja RIVAL como protagonista, un "Cerraron"
        // sin sujeto queda ambiguo sobre quién cerró el partido.
        sentences2.push(`${nameOf(winnerTeam)} cerraron el partido en su ${ORDINALS[winnerMp.opportunities] || winnerMp.opportunities + 'ª'} oportunidad de Match Point.`);
      }

      // V9.2 (10): esta es la otra cara — el GANADOR enfrentó Match Point(s) DEL RIVAL, los
      // salvó, y terminó ganando. Esta sí es la situación correcta para "se agarraron al
      // partido" (66): si fueron 2+, se usa esa frase; si fue solo 1, la mención simple
      // alcanza sin necesitar el lenguaje más dramático.
      if (loserMp.opportunities >= 2) {
        sentences2.push(`${nameOf(winnerTeam)} se agarraron al partido y salvaron ${loserMp.opportunities} Match Points de ${nameOf(loserTeam)} antes de cerrarlo.`);
      } else if (loserMp.opportunities === 1) {
        sentences2.push(`${nameOf(winnerTeam)} salvaron un Match Point de ${nameOf(loserTeam)} antes de cerrarlo.`);
      }
    }
    const goldName = matchCtx.scoringSystem === 'golden' ? 'Puntos de Oro' : matchCtx.scoringSystem === 'starpoint' ? 'Star Points' : null;
    // V9.2 (6): NUNCA usar la distribución de Oro/Star para afirmar que el PARTIDO fue
    // parejo (bug real: "Estuvo muy parejo" con solo 1 punto de diferencia en Oro, en un
    // 6-0/6-1 completamente desequilibrado). Tampoco convertir cada reparto en una oración:
    // 1/2 vs 1/2 o 2/3 vs 1/3 no aportan nada a la historia y se omiten. Solo se narra
    // cuando la distribución es extraordinariamente desequilibrada (shutout real, con
    // muestra suficiente) — un evento contextual puntual (Oro que produce quiebre, salva
    // MP, etc.) ya se cuenta aparte, vía la secuencia decisiva o Momentos Clave.
    if (goldName && stats.goldenPoints.played + stats.starPoints.played > 0) {
      const bucket = matchCtx.scoringSystem === 'golden' ? stats.goldenPoints : stats.starPoints;
      const wa = bucket.wonA, wb = bucket.wonB, played = bucket.played;
      const leaderCount = Math.max(wa, wb), otherCount = Math.min(wa, wb);
      if (played >= 3 && otherCount === 0) {
        const leader = wa > wb ? 'A' : 'B';
        sentences2.push(`${nameOf(leader)} se llevaron los ${played} ${goldName} disputados. ${otherName(leader)} no pudieron imponerse en ninguno.`);
      }
    }
    // Evita repetir en el párrafo de puntos decisivos lo que ya se contó como historia
    // principal (párrafo 1) con la misma lectura de oportunidad+conversión.
    if (!usedKinds.includes('resto') && !usedKinds.includes('unico-break') && stats.hasServerInfo && (stats.breakPoints.A.opportunities + stats.breakPoints.B.opportunities) > 0) {
      // V11 (§23): misma interpretación que en la historia principal, sin una rama propia
      // separada — nunca la oración con dos fracciones pegadas ("convirtieron 7/7 y 3/6").
      const interpreted = interpretBreakPointsNarrative(stats.breakPoints.A, stats.breakPoints.B, nameOf, otherName);
      if (interpreted) sentences2.push(interpreted);
    }
    if (sentences2.length) paras.push(sentences2.join(' '));

    // ---- Párrafo 3 (opcional, R13): racha destacada + cierre con duración/tie break ----
    // 37.8/53: NO mencionar automáticamente la racha máxima — solo si es lo bastante grande
    // como para razonablemente haber sido parte de la historia (una racha de 5 puntos que no
    // definió nada mejor queda solo en Estadísticas, sin mención en la narración).
    const sentences3 = [];
    // 84/85: el umbral sube a 9+ puntos (antes 6) — por debajo de eso una racha puede seguir
    // viéndose en Estadísticas, pero no alcanza para ser parte de la historia narrada. De
    // 12 en adelante el lenguaje es más categórico (dominio marcado), sin frases absolutas
    // como "hubo un solo equipo en la cancha" (86).
    const streakVal = Math.max(stats.maxStreak.A, stats.maxStreak.B);
    const streakRelevant = streakVal >= 9 && streakVal >= Math.max(9, Math.round(stats.totalPoints * 0.07));
    if (streakRelevant) {
      const streakLeader = stats.maxStreak.A >= stats.maxStreak.B ? 'A' : 'B';
      sentences3.push(streakVal >= 12
        ? `Hubo un tramo de dominio muy marcado: ${nameOf(streakLeader)} encadenaron ${streakVal} puntos seguidos.`
        : `Hubo un tramo clave con una racha de ${streakVal} puntos seguidos de ${nameOf(streakLeader)}.`);
    }
    if (finishInfo && finishInfo.manual) {
      const reasonPhrases = { tiempo: 'por límite de tiempo de cancha', retiro: 'por retiro o lesión', suspendido: 'por suspensión', otro: 'de forma manual' };
      const phrase = reasonPhrases[finishInfo.reason] || 'de forma manual';
      const scoreStr = sets.map((s) => `${s.gamesA}-${s.gamesB}`).join(' · ') || `${stats.finalState.gamesA}-${stats.finalState.gamesB} en el set en curso`;
      if (finishInfo.declaredWinner) {
        sentences3.push(`El encuentro se dio por finalizado ${phrase}, con ${nameOf(finishInfo.declaredWinner)} declarados ganadores (${scoreStr}). No llegó a un cierre reglamentario.`);
      } else {
        sentences3.push(`El encuentro se dio por finalizado ${phrase}, sin un ganador definido (${scoreStr}). No llegó a un cierre reglamentario.`);
      }
    } else if (winnerTeam) {
      const lastSet = sets[sets.length - 1];
      const wasTiebreak = lastSet && lastSet.tiebreak;
      // V11 (§2.5): si el Tie break del último set ya se narró (como historia principal o en
      // el acto de cierre de arriba), no se repite acá — bug real de redundancia narrativa
      // ("...que ganaron 7-3" y después "...cerrando el Tie break final 7-3").
      // V12.2 (§3): un Tie break EXTRAORDINARIO siempre queda cubierto por
      // `appendExtraordinaryTiebreakNote` (envoltorio de `generateBramuIntelligence`, ver
      // más abajo en el archivo) con la versión contextual completa — nunca debe repetirse
      // acá como "Tie break final" genérico (bug real reportado: dos narraciones del mismo
      // hecho). `lastSet` es siempre el segmento extraordinario cuando existe uno (el TB
      // extraordinario termina el partido en el acto, V12.1 §1), así que alcanza con mirar
      // ese único set, sin necesitar que el resto de la lógica de "historias" lo sepa.
      const tbAlreadyMentioned = !!lastSet.extraordinary || closingActTbMentioned || topStories.some((s) => s.tbMentionedSetNumber === sets.length);
      // V8 (33): "dominio claro" — señal simple para decidir si vale la pena resaltar una
      // duración muy corta: una racha grande, o alguna pareja que no perdió ni un game de
      // saque en todo el partido.
      const hasClearDominance = streakVal >= 9 || (stats.hasServerInfo && stats.serverFullyKnown && (
        (stats.serviceGames.wonA > 0 && stats.serviceGames.lostA === 0) ||
        (stats.serviceGames.wonB > 0 && stats.serviceGames.lostB === 0)
      ));
      const closingDuration = buildDurationClosingSentence(stats.matchDurationMs, nameOf(winnerTeam), hasClearDominance);
      if (wasTiebreak && !tbAlreadyMentioned && closingDuration) {
        sentences3.push(`${closingDuration.replace(/\.$/, '')}, cerrando el Tie break final ${orientTiebreak(lastSet.tiebreak, winnerTeam)}.`);
      } else if (wasTiebreak && !tbAlreadyMentioned) {
        sentences3.push(`Terminaron cerrando el Tie break final ${orientTiebreak(lastSet.tiebreak, winnerTeam)}.`);
      } else if (closingDuration) {
        sentences3.push(closingDuration);
      }
    }
    if (sentences3.length) paras.push(sentences3.join(' '));

    // 80/96: estructura objetiva de los sets ya definidos (aunque vengan cargados a mano en
    // "Partido ya empezado") — válida de narrar incluso sin un ganador todavía. Va primero,
    // como apertura factual, sin pisar ninguna historia más fuerte ya elegida arriba.
    if (!winnerTeam && sets.length >= 1) {
      let setsSummary;
      if (sets.length === 1) {
        // V10 (27/45.4): marcador orientado hacia quien ganó el set, nunca el orden A-B
        // crudo — bug residual detectado acá (esta rama solo corre sin ganador de partido
        // todavía, p.ej. viendo Análisis de un partido en curso o parcial).
        setsSummary = `${nameOf(sets[0].winner)} se quedaron con el primer set ${orientScore(sets[0].gamesA, sets[0].gamesB, sets[0].winner)}.`;
      } else {
        setsSummary = sets.map((s, i) => {
          const seg = `${nameOf(s.winner)} ${i === 0 ? 'ganaron el primero' : 'se llevaron el ' + (i + 1) + '°'} ${orientScore(s.gamesA, s.gamesB, s.winner)}`;
          if (i === 0) return seg;
          return (s.winner !== sets[i - 1].winner ? ', pero ' : ', y ') + seg;
        }).join('') + '.';
      }
      paras.unshift(setsSummary);
    }

    if (paras.length === 0 || !paras[0]) return 'Todavía no hay suficientes datos registrados para generar un análisis del partido.';
    return paras.filter(Boolean).join('\n\n');
  }

  /** Duración en lenguaje narrativo (no el formato compacto de la UI). */
  function formatDurationForNarrative(ms) {
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) return `${h} h ${m} min`;
    return `${m} min`;
  }

  /**
   * V8 (32-34): la duración entra al cierre narrativo con variantes — nunca siempre
   * "Después de X min...". Por debajo de `devSimulationMaxMs` (partidos de prueba de
   * desarrollo) directamente no se narra (34). En partidos "muy cortos" (33) solo se
   * menciona si además hubo un dominio claro; si no, no hace falta resaltarla. La
   * selección de variante es determinística sobre `ms` (no aleatoria) para que el mismo
   * partido narre siempre igual si se regenera.
   * V11.16 (feedback real) — la duración "normal" (ni corta ni larga) tampoco se narra por
   * obligación: antes SIEMPRE se agregaba una frase de cierre para partidos de 45-80 min,
   * aunque esa duración no aportara nada a explicar el partido ("no debe entrar
   * automáticamente"). Ahora exige la misma señal de dominio claro que el tramo corto — solo
   * el tramo "muy largo" sigue siendo incondicional, porque ahí la duración en sí misma ya es
   * la historia (desgaste).
   */
  function buildDurationClosingSentence(ms, winnerName, hasClearDominance) {
    if (!ms || ms < DURATION_RANGES.devSimulationMaxMs) return null;
    const durText = formatDurationForNarrative(ms);
    const pick = (variants) => variants[Math.floor(ms / 1000) % variants.length];
    if (ms < DURATION_RANGES.veryShortMaxMs) {
      if (!hasClearDominance) return null;
      return pick([
        `En apenas ${durText}, ${winnerName} resolvieron el partido.`,
        `${winnerName} despacharon el partido en poco más de ${durText}.`,
      ]);
    }
    if (ms < DURATION_RANGES.normalMaxMs) {
      if (!hasClearDominance) return null;
      return pick([
        `Después de ${durText}, ${winnerName} terminaron cerrando el partido.`,
        `Tras ${durText} de partido, ${winnerName} se quedaron con la victoria.`,
      ]);
    }
    return pick([
      `Después de ${durText}, ${winnerName} terminaron cerrando el partido.`,
      `Tras más de ${durText} de partido, ${winnerName} se quedaron con la victoria.`,
      `Luego de un partido largo, ${winnerName} se llevaron el triunfo tras ${durText}.`,
    ]);
  }

  function teamLabel(players, team) { return players.filter((p) => p.team === team).map((p) => p.name).join(' / '); }

  /* ========================================================================
     BRAMU (V9) — Motor común de "Match Story" + Evolución del partido.
     REEMPLAZA por completo la lógica anterior de Momentum (% de los últimos
     8 puntos). Una sola fuente de verdad de lo que pasó en el partido:
     computeEvolutionData() reconstruye, punto a punto, la POSICIÓN
     COMPETITIVA de cada pareja (índice propio 0-100, no una probabilidad ni
     un % de puntos) y además arma la lista cronológica de acontecimientos
     relevantes (breaks, contra-breaks, consolidación, Match/Set Points
     salvados o convertidos, Oro/Star, mini-breaks de Tie break, remontadas
     completadas). Evolución y BRAMU Intelligence consumen el MISMO
     resultado — nunca dos interpretaciones independientes de los mismos
     hechos (consolidado V9, punto 24).
     ======================================================================== */

  const EVOLUTION_WEIGHTS = {
    base: 50,               // arranque neutro para ambas parejas
    setWinBase: 16,         // por cada set ganado
    setLossBase: 16,        // por cada set perdido (techo del castigo)
    setMarginMax: 8,        // alivio máximo si el set perdido fue muy parejo (7-6 duele mucho menos que 6-0)
    gameDiffWeightBase: 1.5,     // peso base por game de diferencia en el set actual
    gameDiffProximityMax: 2.5,   // peso ADICIONAL cuando el set está cerca de terminar (el mismo game de diferencia pesa más en 5-4 que en 1-0)
    breakBase: 7,           // primer break neto de diferencia en el set actual
    breakDecay: 0.55,       // el 2°/3er break adicional suma cada vez menos (retorno decreciente)
    breakConsolidationBonus: 2, // sostener el saque inmediatamente después de un break propio
    tbMiniBase: 3.5,        // mini-break dentro del Tie break
    tbMiniDecay: 0.6,
    peakBlend: 0.62,        // cuánto se acerca un pico (MP/SP/Oro decisivo) al valor "si se convierte ahora"
    // V9.2 (15): al cerrar un set, los breaks netos del set actual NO se resetean del todo
    // a 0 — una fracción "sobrevive" al arranque del set siguiente. Sin esto, el índice
    // sufría una caída mecánica (un reset de fórmula, no un cambio competitivo real) justo
    // al empezar el nuevo set, incluso después de haber cerrado el anterior con dominio
    // total (bug real reportado con un 6-0 seguido de una caída injustificada en el set 2).
    breakCarryOverRatio: 0.5,
    minVal: 2,
    maxVal: 98,             // el 100 exacto se reserva para el cierre real del partido (ganador)
  };

  /** V9.2 (15) — decae (no borra) los breaks netos del set que acaba de cerrar, para que el
   *  arranque del set siguiente conserve una fracción de ese impulso en vez de sufrir un
   *  salto artificial producido solo por el reset de un componente de la fórmula. */
  function carryOverBreakCount(n) {
    return Math.floor(n * EVOLUTION_WEIGHTS.breakCarryOverRatio);
  }

  function diminishingSum(n, base, decay) {
    let total = 0, cur = base;
    for (let i = 0; i < n; i++) { total += cur; cur *= decay; }
    return total;
  }

  /** Índice de posición competitiva de UNA pareja para un snapshot dado del partido.
   *  Combina: A) sets ya ganados/perdidos (con alivio si el set perdido fue parejo),
   *  B) situación del set actual (diferencia de games, pesada más cerca del cierre),
   *  C) control del saque (breaks netos del set actual, con retorno decreciente, más
   *  bonus de consolidación) y, dentro de un Tie break, D) mini-breaks netos. Nunca usa
   *  el total de puntos ganados como insumo (a propósito: dominar puntos sin convertir
   *  breaks no debe generar una falsa sensación de control, consolidado V9 TEST C). */
  function structuralIndex(team, snap) {
    const W = EVOLUTION_WEIGHTS;
    let score = W.base;
    snap.completedSets.forEach((s) => {
      const hi = Math.max(s.gamesA, s.gamesB), lo = Math.min(s.gamesA, s.gamesB);
      const margin = Math.min(hi - lo, 6);
      const closeness = 1 - margin / 6;
      if (s.winner === team) score += W.setWinBase;
      else score -= (W.setLossBase - closeness * W.setMarginMax);
    });
    if (!snap.inTiebreak) {
      const my = team === 'A' ? snap.curGamesA : snap.curGamesB;
      const opp = team === 'A' ? snap.curGamesB : snap.curGamesA;
      const played = snap.curGamesA + snap.curGamesB;
      const proximity = Math.min(1, played / (snap.format.setWinTarget + 1));
      const weight = W.gameDiffWeightBase + proximity * W.gameDiffProximityMax;
      score += (my - opp) * weight;
    }
    const bf = (snap.breaksFor && snap.breaksFor[team]) || 0;
    const ba = (snap.breaksAgainst && snap.breaksAgainst[team]) || 0;
    score += diminishingSum(bf, W.breakBase, W.breakDecay);
    score -= diminishingSum(ba, W.breakBase, W.breakDecay);
    score += ((snap.consolidations && snap.consolidations[team]) || 0) * W.breakConsolidationBonus;
    if (snap.inTiebreak) {
      const mf = (snap.tbMiniFor && snap.tbMiniFor[team]) || 0;
      const ma = (snap.tbMiniAgainst && snap.tbMiniAgainst[team]) || 0;
      score += diminishingSum(mf, W.tbMiniBase, W.tbMiniDecay);
      score -= diminishingSum(ma, W.tbMiniBase, W.tbMiniDecay);
    }
    return Math.max(W.minVal, Math.min(W.maxVal, score));
  }

  /**
   * Motor único de Evolución + detector de Match Story. Recorre los eventos punto a
   * punto y devuelve:
   *   - `games`: un nodo por GAME cerrado (incluye el Tie break como cierre de set),
   *     con el índice de posición competitiva de cada pareja ya calculado — la unidad
   *     del gráfico es el GAME, nunca el punto individual (V9, punto 13).
   *   - `specialNodes`: picos puntuales dentro de un game/Tie break todavía abierto
   *     (Match Point, Set Point, Oro/Star, mini-break) para no perder visualmente un
   *     acontecimiento de leverage extremo sin llenar la curva de nodos por cada punto.
   *   - `moments`: la lista cronológica de hechos (breaks, contra-breaks, consolidación,
   *     MP/SP salvados o convertidos, Oro/Star, remontada completada, inicio/fin de Tie
   *     break) que consume BRAMU Intelligence para redactar la historia del partido.
   */
  function computeEvolutionData(events, matchCtx) {
    const { scoringSystem, format, tiebreakMode, serverKnowledge, baseline, players } = matchCtx;
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, baseline) : E.createInitialEngineState();
    let completedSets = state.sets.slice();
    let breaksFor = { A: 0, B: 0 }, breaksAgainst = { A: 0, B: 0 }, consolidations = { A: 0, B: 0 };
    let lastBreakBy = null, consolidatedThisBreak = true;
    let tbMiniFor = { A: 0, B: 0 }, tbMiniAgainst = { A: 0, B: 0 };
    let worstDiffA = 0, bestDiffA = 0, comebackFlagA = false, comebackFlagB = false;
    let pendingGap = false;
    const games = [];
    const specialNodes = [];
    const moments = [];
    let gameIdx = 0;

    // IMPORTANTE: nunca leer de una variable mutable de "estado actual" acá — siempre
    // recibir el estado exacto (before/after) como parámetro explícito. Leer un estado
    // reasignado a mitad del procesamiento de un punto (antes de terminar de aplicarlo)
    // devuelve valores desactualizados — bug real detectado y corregido durante el
    // desarrollo de este motor con los tests de aceptación del consolidado V9.
    function snapshotFor(st) {
      return { completedSets, curGamesA: st.gamesA, curGamesB: st.gamesB, inTiebreak: st.inTiebreak, format, breaksFor, breaksAgainst, consolidations, tbMiniFor, tbMiniAgainst };
    }
    function pushGameNode(st, extra) {
      const snap = snapshotFor(st);
      const indexA = structuralIndex('A', snap), indexB = structuralIndex('B', snap);
      games.push(Object.assign({ idx: gameIdx++, indexA, indexB, isGap: pendingGap }, extra));
      pendingGap = false;
    }

    events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        const beforeAdj = state;
        state = E.applyAdjustment(ev.newState);
        completedSets = state.sets.slice();
        breaksFor = { A: 0, B: 0 }; breaksAgainst = { A: 0, B: 0 }; consolidations = { A: 0, B: 0 };
        lastBreakBy = null; consolidatedThisBreak = true;
        tbMiniFor = { A: 0, B: 0 }; tbMiniAgainst = { A: 0, B: 0 };
        worstDiffA = 0; bestDiffA = 0; comebackFlagA = false; comebackFlagB = false;
        // V12 (§14.2): resolver con Tie break extraordinario es una transición CONOCIDA —
        // nunca dibujar el hueco de "orden desconocido" (§4.4) que sí corresponde a un
        // AJUSTAR genérico. En cambio, se registra como un momento explícito que BRAMU
        // Intelligence pueda narrar (§14.1: "decidieron resolverlo mediante un Tie break").
        const etb = ev.newState && ev.newState.extraordinaryTiebreak && ev.newState.extraordinaryTiebreak.active ? ev.newState.extraordinaryTiebreak : null;
        if (etb && !beforeAdj.inTiebreak) {
          moments.push({ kind: 'tiebreak-extraordinary-start', gamesBefore: { a: etb.startedAtGames.a, b: etb.startedAtGames.b }, winTarget: etb.winTarget, requireDiff2: etb.requireDiff2, matchTimeMs: ev.matchTimeMs });
        } else if (!etb) {
          pendingGap = true;
        }
        return;
      }
      const before = state;
      const modeForThisPoint = ev.tbMode || tiebreakMode;
      const setNumber = before.sets.length + 1;
      const matchGameNumber = E.currentMatchGameNumber(before);
      const withinSetGameNumber = E.currentWithinSetGameNumber(before);
      const resolved = serverKnowledge
        ? (before.inTiebreak
          ? E.resolveTiebreakServer(serverKnowledge, players, setNumber, before.tbBaseGameNumber, before.tbBaseWithinSet, before.tbA + before.tbB)
          : E.resolveServer(serverKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber))
        : { resolved: false };
      // V12 (§6): equipo conocido alcanza para marcar breaks/momentos en Evolución, sin
      // depender del jugador individual (que acá ni siquiera se usa más abajo).
      const servingTeamKnown = resolved.resolved ? resolved.team : (resolved.candidateTeam || null);

      const importance = E.detectPointImportance(before, scoringSystem, format, modeForThisPoint, servingTeamKnown);
      const disp = before.inTiebreak ? null : E.formatPointsDisplay(before.pointsA, before.pointsB, scoringSystem);
      const isGoldOrStarPoint = !!(disp && (disp.isGoldenPoint || disp.isStarPoint));
      const scoreLabelBefore = before.inTiebreak ? `${before.tbA}-${before.tbB}` : `${before.gamesA}-${before.gamesB}`;

      const after = E.applyPoint(before, ev.team, scoringSystem, format, modeForThisPoint);

      // ---- Match Point / Set Point: salvado o convertido (prioridad Match > Set, igual
      //      que la franja contextual del marcador Live — nunca se cuentan los dos a la vez). ----
      ['match', 'set'].forEach((kind) => {
        const holder = importance[kind];
        if (!holder) return;
        if (kind === 'set' && importance.match) return;
        const holders = holder === 'both' ? ['A', 'B'] : [holder];
        holders.forEach((h) => {
          if (ev.team === h) {
            moments.push({ kind: kind + '-point-converted', team: h, setNumber, scoreBefore: scoreLabelBefore, isGoldOrStar: isGoldOrStarPoint, matchTimeMs: ev.matchTimeMs });
          } else {
            moments.push({ kind: kind + '-point-saved', team: h, savedBy: E.otherTeam(h), setNumber, scoreBefore: scoreLabelBefore, isGoldOrStar: isGoldOrStarPoint, matchTimeMs: ev.matchTimeMs });
          }
        });
      });

      if (isGoldOrStarPoint) {
        moments.push({ kind: scoringSystem === 'golden' ? 'gold-point-won' : 'star-point-won', team: ev.team, setNumber, scoreBefore: scoreLabelBefore, matchTimeMs: ev.matchTimeMs });
      }

      // ---- Picos especiales sobre la curva (MP/SP/Oro-Star, y mini-break más abajo) ----
      // V9.2 (16): un Oro/Star SIN Match/Set Point asociado solo genera pico visual si el
      // marcador del set está realmente cerrado (diferencia de games <= 1) — un Punto de
      // Oro rutinario en un tramo ya definido no necesita rombo/estrella (menos ruido en
      // el gráfico). Match Point y Set Point SIEMPRE generan pico, tengan o no Oro/Star.
      const isCloseGameContext = !before.inTiebreak && Math.abs(before.gamesA - before.gamesB) <= 1;
      const goldWorthMarking = isGoldOrStarPoint && isCloseGameContext;
      if (importance.match || importance.set || goldWorthMarking) {
        const leverageHolders = importance.match ? (importance.match === 'both' ? ['A', 'B'] : [importance.match])
          : importance.set ? (importance.set === 'both' ? ['A', 'B'] : [importance.set])
          : ['A', 'B'];
        const curSnap = snapshotFor(before);
        const curValA = structuralIndex('A', curSnap), curValB = structuralIndex('B', curSnap);
        leverageHolders.forEach((h) => {
          const hypo = E.applyPoint(before, h, scoringSystem, format, modeForThisPoint);
          const hypoSnap = {
            completedSets: hypo.sets.length > before.sets.length ? hypo.sets.slice() : completedSets,
            curGamesA: hypo.gamesA, curGamesB: hypo.gamesB, inTiebreak: hypo.inTiebreak, format,
            breaksFor, breaksAgainst, consolidations, tbMiniFor, tbMiniAgainst,
          };
          let hypoValA = structuralIndex('A', hypoSnap), hypoValB = structuralIndex('B', hypoSnap);
          // Si convertir este punto cierra el PARTIDO, el techo hipotético se trata igual
          // que el cierre real (100) antes de mezclarlo con la posición actual — así un
          // Match Point se siente como "a un paso de cerrarlo", no como una mejora
          // marginal más (consolidado V9, punto 17).
          if (hypo.matchWinner === 'A') hypoValA = 100;
          if (hypo.matchWinner === 'B') hypoValB = 100;
          const blend = EVOLUTION_WEIGHTS.peakBlend;
          const peakA = curValA + (hypoValA - curValA) * blend;
          const peakB = curValB + (hypoValB - curValB) * blend;
          const kindLabel = importance.match ? 'match-point' : importance.set ? 'set-point' : 'gold-star-point';
          // Evita amontonar picos casi idénticos cuando el mismo Match/Set Point se salva
          // varias veces seguidas dentro del mismo game (punto 22: "evitar saturar el
          // gráfico") — se actualiza el pico ya existente (con el valor más alto) en vez
          // de apilar uno nuevo por cada punto salvado.
          const prev = specialNodes[specialNodes.length - 1];
          if (prev && prev.afterGameIdx === gameIdx && prev.team === h && prev.kind === kindLabel) {
            prev.indexA = Math.max(prev.indexA, peakA);
            prev.indexB = Math.max(prev.indexB, peakB);
            prev.scoreLabel = scoreLabelBefore;
            prev.matchTimeMs = ev.matchTimeMs;
            // V10 (35): cuenta cuántos Match/Set Points de esta misma secuencia se salvaron
            // — la vista Partido lo usa para etiquetar "2 MP"/"3 MP" en vez de una línea por
            // cada uno (agrupar Match Points consecutivos de una misma secuencia).
            prev.count = (prev.count || 1) + 1;
          } else {
            specialNodes.push({ afterGameIdx: gameIdx, team: h, kind: kindLabel, isGoldOrStar: isGoldOrStarPoint, indexA: peakA, indexB: peakB, setNumber, scoreLabel: scoreLabelBefore, matchTimeMs: ev.matchTimeMs, count: 1 });
          }
        });
      }

      if (after.gameIndex > before.gameIndex) {
        const closedSet = after.sets.length > before.sets.length;
        const winnerOfGame = closedSet ? after.sets[after.sets.length - 1].winner : (after.gamesA > before.gamesA ? 'A' : 'B');
        const wasInTiebreak = before.inTiebreak;
        const isBreak = !wasInTiebreak && !!servingTeamKnown && winnerOfGame !== servingTeamKnown;

        if (isBreak) {
          const wasCounterbreak = lastBreakBy === E.otherTeam(winnerOfGame);
          breaksFor[winnerOfGame] += 1; breaksAgainst[E.otherTeam(winnerOfGame)] += 1;
          moments.push({ kind: 'break', team: winnerOfGame, setNumber, server: servingTeamKnown, isGoldOrStar: isGoldOrStarPoint, isCounterbreak: wasCounterbreak, scoreBefore: `${before.gamesA}-${before.gamesB}`, scoreAfter: `${after.gamesA}-${after.gamesB}`, matchTimeMs: ev.matchTimeMs });
          lastBreakBy = winnerOfGame; consolidatedThisBreak = false;
        } else if (!wasInTiebreak && servingTeamKnown && winnerOfGame === servingTeamKnown) {
          if (lastBreakBy === winnerOfGame && !consolidatedThisBreak) {
            consolidations[winnerOfGame] = (consolidations[winnerOfGame] || 0) + 1;
            consolidatedThisBreak = true;
            moments.push({ kind: 'break-consolidated', team: winnerOfGame, setNumber, matchTimeMs: ev.matchTimeMs });
          }
        }

        // Remontada completada dentro del set actual: erosionar un déficit de 3+ games
        // hasta la igualdad (o mejor) es un acontecimiento propio (V9, punto 18).
        if (!wasInTiebreak && !closedSet) {
          const diffA = after.gamesA - after.gamesB;
          if (diffA < worstDiffA) worstDiffA = diffA;
          if (diffA > bestDiffA) bestDiffA = diffA;
          if (worstDiffA <= -3 && diffA >= 0 && !comebackFlagA) {
            moments.push({ kind: 'comeback-completed', team: 'A', setNumber, deficit: -worstDiffA, scoreAfter: `${after.gamesA}-${after.gamesB}`, matchTimeMs: ev.matchTimeMs });
            comebackFlagA = true;
          }
          if (bestDiffA >= 3 && diffA <= 0 && !comebackFlagB) {
            moments.push({ kind: 'comeback-completed', team: 'B', setNumber, deficit: bestDiffA, scoreAfter: `${after.gamesA}-${after.gamesB}`, matchTimeMs: ev.matchTimeMs });
            comebackFlagB = true;
          }
        }

        if (closedSet) completedSets = after.sets.slice();

        pushGameNode(after, {
          setNumber: closedSet ? after.sets.length : setNumber,
          gamesA: closedSet ? after.sets[after.sets.length - 1].gamesA : after.gamesA,
          gamesB: closedSet ? after.sets[after.sets.length - 1].gamesB : after.gamesB,
          winner: winnerOfGame, isBreak, server: servingTeamKnown, isTiebreakClose: wasInTiebreak,
          tiebreak: closedSet ? after.sets[after.sets.length - 1].tiebreak : null,
          closedSet, setResult: closedSet ? after.sets[after.sets.length - 1] : null,
          matchWinner: after.matchWinner, matchTimeMs: ev.matchTimeMs,
        });

        if (closedSet) {
          // V9.2 (15): decae los breaks netos en vez de resetearlos a 0 — evita la caída
          // artificial al arrancar el set siguiente (ver EVOLUTION_WEIGHTS.breakCarryOverRatio).
          breaksFor = { A: carryOverBreakCount(breaksFor.A), B: carryOverBreakCount(breaksFor.B) };
          breaksAgainst = { A: carryOverBreakCount(breaksAgainst.A), B: carryOverBreakCount(breaksAgainst.B) };
          consolidations = { A: 0, B: 0 };
          lastBreakBy = null; consolidatedThisBreak = true;
          tbMiniFor = { A: 0, B: 0 }; tbMiniAgainst = { A: 0, B: 0 };
          worstDiffA = 0; bestDiffA = 0; comebackFlagA = false; comebackFlagB = false;
          moments.push({ kind: 'set-finish', setNumber: after.sets.length, winner: winnerOfGame, gamesA: after.sets[after.sets.length - 1].gamesA, gamesB: after.sets[after.sets.length - 1].gamesB, tiebreak: after.sets[after.sets.length - 1].tiebreak, matchTimeMs: ev.matchTimeMs });
        }
        if (after.matchWinner && !before.matchWinner) {
          moments.push({ kind: 'match-finish', winner: after.matchWinner, matchTimeMs: ev.matchTimeMs });
          // 20: el cierre real del partido lleva a la pareja ganadora a 100 en el nodo final.
          const last = games[games.length - 1];
          if (after.matchWinner === 'A') last.indexA = 100; else last.indexB = 100;
        }
      } else if (before.inTiebreak && after.inTiebreak) {
        if (servingTeamKnown && ev.team !== servingTeamKnown) {
          tbMiniFor[ev.team] += 1; tbMiniAgainst[E.otherTeam(ev.team)] += 1;
          moments.push({ kind: 'tiebreak-minibreak', team: ev.team, setNumber, scoreAfter: `${after.tbA}-${after.tbB}`, matchTimeMs: ev.matchTimeMs });
          const snap = snapshotFor(after);
          specialNodes.push({ afterGameIdx: gameIdx, team: ev.team, kind: 'minibreak', indexA: structuralIndex('A', snap), indexB: structuralIndex('B', snap), setNumber, scoreLabel: `${after.tbA}-${after.tbB}`, matchTimeMs: ev.matchTimeMs });
        }
      }
      if (!before.inTiebreak && after.inTiebreak) {
        moments.push({ kind: 'tiebreak-start', setNumber, scoreAfter: `${after.gamesA}-${after.gamesB}`, matchTimeMs: ev.matchTimeMs });
      }

      state = after;
    });

    return { games, specialNodes, moments };
  }

  /**
   * Bloque S2 — parte los eventos en tramos por set, cada uno con su propio baseline
   * (el estado deportivo al empezar ese set), para poder recalcular estadísticas
   * filtradas por SET reusando `computeStats` sin tocar su lógica. Un `adjustment`
   * puede caer en cualquier punto: el tramo se corta ahí igual que en Evolución.
   */
  function computeSetSegments(events, scoringSystem, format, tiebreakMode, baseline) {
    let state = baseline ? E.computeStateFromEvents([], scoringSystem, format, tiebreakMode, baseline) : E.createInitialEngineState();
    const segments = [];
    let startIdx = 0;
    let curSetNumber = state.sets.length + 1;
    let curBaseline = JSON.parse(JSON.stringify(state));
    events.forEach((ev, i) => {
      if (ev.type === 'adjustment') {
        // El tramo previo NO incluye el ajuste (queda como cierre limpio); el tramo nuevo
        // arranca EN el ajuste (computeStats lo vuelve a aplicar sobre el mismo baseline
        // resultante, que es un no-op seguro, y así marca correctamente hasAdjustments).
        segments.push({ setNumber: curSetNumber, baseline: curBaseline, events: events.slice(startIdx, i) });
        state = E.applyAdjustment(ev.newState);
        startIdx = i;
        curSetNumber = state.sets.length + 1;
        curBaseline = JSON.parse(JSON.stringify(state));
        return;
      }
      const before = state;
      const modeForThisPoint = ev.tbMode || tiebreakMode;
      state = E.applyPoint(state, ev.team, ev.scoringSystem || scoringSystem, format, modeForThisPoint); // V13.3 (§14-19): mismo criterio que engine.js, nunca reinterpreta un punto ya jugado
      if (state.sets.length > before.sets.length) {
        segments.push({ setNumber: curSetNumber, baseline: curBaseline, events: events.slice(startIdx, i + 1) });
        startIdx = i + 1;
        curSetNumber = state.sets.length + 1;
        curBaseline = JSON.parse(JSON.stringify(state));
      }
    });
    // Tramo final: el set en curso. Si el partido ya terminó justo en un límite de set
    // (sin eventos pendientes), no hay "próximo set" que listar: se omite.
    const tail = events.slice(startIdx);
    if (tail.length || !state.matchWinner) {
      segments.push({ setNumber: curSetNumber, baseline: curBaseline, events: tail });
    }
    // V6 — fix bug "SET 1 | SET 1": un `adjustment` dentro del mismo set lógico corta
    // el tramo (para que el gap se refleje en Evolución, T13/L13), pero eso NO debe
    // crear un segundo "Set 1" en los filtros de Estadísticas/Evolución. Acá se
    // agrupan los tramos consecutivos que pertenecen al MISMO número de set real,
    // concatenando sus eventos (el evento `adjustment` que separaba los tramos queda
    // preservado dentro de la lista concatenada, así que al recalcular stats sobre el
    // tramo combinado se sigue viendo como ajuste — no como puntos jugados de más).
    const merged = [];
    segments.forEach((seg) => {
      const last = merged[merged.length - 1];
      if (last && last.setNumber === seg.setNumber) {
        last.events = last.events.concat(seg.events);
      } else {
        merged.push({ setNumber: seg.setNumber, baseline: seg.baseline, events: seg.events.slice() });
      }
    });
    return merged;
  }

  /* ======================================================================
     V13 — ESTADÍSTICAS Y BRAMU INTELLIGENCE PARA "POR GAMES · BETA" (§20-25)
     Módulo DELIBERADAMENTE separado de `computeStats`/`generateBramuIntelligence`
     de arriba: esos leen un log de PUNTOS y no tienen manera honesta de producir
     nada útil sobre un log de GAMES. En vez de fabricar puntos falsos para
     reusar el motor existente (violaría el principio "no inventar" del
     Consolidado V13), este módulo trabaja directo sobre `gameEvents` y produce
     solo las métricas que esa granularidad respalda de verdad.
     Reglas duras (§11/§24, mismo espíritu que arriba):
       - Un evento `adjustment` reemplaza el estado entero; nunca se interpreta
         como games jugados. Holds/breaks/racha/máxima ventaja/remontada NUNCA
         cruzan ese punto — se cortan y se retoma desde 0 ahí (mejor
         sub-reportar que inventar el orden real).
       - Un Tie break (reglamentario o extraordinario) SÍ cuenta como "un game
         ganado" para racha/máxima ventaja (cierra el set, es parte real de la
         secuencia de games), pero NUNCA alimenta holds/breaks/games de saque:
         no sabemos quién sacó cada punto del TB (§14, "no se pide etiquetar").
     ====================================================================== */

  /** V13 (§20/§22) — estadísticas Por Games para un tramo de eventos (partido completo o
   *  un set, según qué lista de eventos se pase). `matchCtx = { players, format,
   *  serverKnowledge }`.
   *  V13.3 (§12) — BUG REAL corregido: cuando `events` es el tramo de UN SET aislado (ej.
   *  Set 3), el replay interno siempre arranca desde `createInitialGameEngineState()`, así
   *  que `before.sets.length` es 0 durante TODO el tramo — sin `startingSetNumber`, el
   *  cálculo de a qué número de set pertenece cada game caía siempre en "Set 1", y
   *  `E.resolveServer` terminaba consultando la rotación de saque guardada para el Set 1 en
   *  vez de la del Set 3 real. `startingSetNumber` (default 1, para el partido completo)
   *  es el número de set REAL con el que arranca `events[0]` — ver `computeGameSetSegments`,
   *  que ya lo conocía pero no se lo pasaba a esta función. `startingGameIndex` es el
   *  SEGUNDO offset que hacía falta: `resolveServer` decide el equipo al saque por la
   *  PARIDAD del número de game global, y un replay aislado de un set reinicia su propio
   *  conteo de games desde 0 — sin este offset, la paridad calculada para el Set 2 en
   *  adelante podía salir invertida (games globales 10,11,12... vs locales 1,2,3...). */
  function computeGamesStats(events, matchCtx, startingSetNumber, startingGameIndex) {
    const format = matchCtx.format;
    const serverKnowledge = matchCtx.serverKnowledge;
    const players = matchCtx.players;
    const baseSetNumber = startingSetNumber || 1;

    let state = E.createInitialGameEngineState();
    state.gameIndex = startingGameIndex || 0;
    let gamesA = 0, gamesB = 0; // se derivan del estado final después del loop, ver más abajo (§11: total seguro)
    const serviceGames = { wonA: 0, wonB: 0, lostA: 0, lostB: 0 };
    let breaksA = 0, breaksB = 0, holdsA = 0, holdsB = 0;
    let currentStreak = null; // { team, count }
    let maxGameStreakA = 0, maxGameStreakB = 0;
    let maxAdvantageA = 0, maxAdvantageB = 0;
    let maxComebackA = 0, maxComebackB = 0;
    let worstDiffA = 0, worstDiffB = 0; // §22 — trackers de remontada, ver comentario más abajo
    const setDurations = [];
    let lastSetEndMs = 0;
    let hasAdjustments = false;

    function noteStreak(team) {
      if (currentStreak && currentStreak.team === team) currentStreak.count += 1;
      else currentStreak = { team, count: 1 };
      if (team === 'A') maxGameStreakA = Math.max(maxGameStreakA, currentStreak.count);
      else maxGameStreakB = Math.max(maxGameStreakB, currentStreak.count);
    }

    /** §22 — "máxima ventaja" y "mayor desventaja remontada" a partir de la diferencia de
     *  games EN CURSO (gamesA-gamesB del set que se está jugando en ese momento; se resetea
     *  sola en cada set nuevo porque el motor resetea gamesA/gamesB a 0-0 al cerrar un set).
     *  Remontada = se registra la primera vez que, habiendo estado abajo, se vuelve a 0 o
     *  a favor — nunca se cuenta una recuperación PARCIAL que no llegó a igualar (§22,
     *  ejemplo "1-4 → 3-4 → pierde 3-6" no cuenta). */
    function sampleDiff(diff) {
      if (diff > 0) maxAdvantageA = Math.max(maxAdvantageA, diff);
      if (diff < 0) maxAdvantageB = Math.max(maxAdvantageB, -diff);
      if (diff >= 0) { if (worstDiffA < 0) maxComebackA = Math.max(maxComebackA, -worstDiffA); worstDiffA = 0; }
      else worstDiffA = Math.min(worstDiffA, diff);
      const diffB = -diff;
      if (diffB >= 0) { if (worstDiffB < 0) maxComebackB = Math.max(maxComebackB, -worstDiffB); worstDiffB = 0; }
      else worstDiffB = Math.min(worstDiffB, diffB);
    }
    sampleDiff(0);

    events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        // Reemplaza el estado entero; corta racha y trackers de remontada (orden desconocido
        // a partir de acá — §11/§24, mejor sub-reportar que inventar).
        state = E.computeGameStateFromEvents([ev], format, null);
        hasAdjustments = true;
        currentStreak = null;
        // Reset DIRECTO (no vía sampleDiff): un ajuste corta el tramo por completo — no debe
        // acreditarse como "remontada completada" el déficit que hubiera quedado pendiente
        // justo antes del ajuste (ese tramo queda con orden desconocido, §11/§24).
        worstDiffA = 0; worstDiffB = 0;
        return;
      }
      const before = state;
      const isTbResolution = ev.type === 'tiebreak' || ev.type === 'extraordinary-tiebreak';
      let winnerTeam;
      if (ev.type === 'tiebreak') { state = E.applyGameTiebreak(state, ev.team, ev.score || null, format); winnerTeam = ev.team; }
      else if (ev.type === 'extraordinary-tiebreak') { state = E.applyExtraordinaryGameTiebreak(state, ev.team, ev.score || null, ev.winTarget, ev.requireDiff2); winnerTeam = ev.team; }
      else { state = E.applyGameWin(state, ev.team, format); winnerTeam = ev.team; }

      // Holds/breaks/games de saque: NUNCA en un TB (§14/regla dura de arriba) — el
      // servicio se resuelve por punto dentro del TB, algo que este modo no observa.
      if (!isTbResolution) {
        const setNumber = baseSetNumber + before.sets.length;
        const matchGameNumber = E.currentMatchGameNumberGames(before);
        const withinSetGameNumber = E.currentWithinSetGameNumberGames(before);
        const info = E.resolveServer(serverKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber);
        const servingTeam = info.resolved ? info.team : null;
        if (servingTeam) {
          if (servingTeam === winnerTeam) {
            if (winnerTeam === 'A') { holdsA += 1; serviceGames.wonA += 1; } else { holdsB += 1; serviceGames.wonB += 1; }
          } else {
            if (winnerTeam === 'A') { breaksA += 1; serviceGames.lostB += 1; } else { breaksB += 1; serviceGames.lostA += 1; }
          }
        }
      }

      noteStreak(winnerTeam);

      const setJustClosed = state.sets.length > before.sets.length;
      if (setJustClosed) {
        const closedSet = state.sets[state.sets.length - 1];
        // Bug conocido en el motor de puntos (`scoreAfter` con "0-0" tras el reset de fin de
        // set) también aplica acá: si leyéramos `state.gamesA/gamesB` DESPUÉS de este evento
        // veríamos 0-0 (el motor ya reseteó para el set siguiente). Se lee del set recién
        // cerrado, nunca del estado post-reset.
        sampleDiff(closedSet.gamesA - closedSet.gamesB);
        setDurations.push({ ms: Math.max(0, (ev.matchTimeMs || 0) - lastSetEndMs) });
        lastSetEndMs = ev.matchTimeMs || lastSetEndMs;
        // Reset DIRECTO al arrancar el set siguiente en 0-0 (no vía sampleDiff): perder un
        // set estando abajo no es "una remontada" solo porque el set siguiente arranca
        // parejo — eso acreditaba falsamente una remontada de 6 games con solo perder 0-6.
        worstDiffA = 0; worstDiffB = 0;
      } else {
        sampleDiff(state.gamesA - state.gamesB);
      }
    });

    // V13 (§11) — "games ganados" es un TOTAL, matemáticamente seguro incluso después de un
    // `adjustment` (a diferencia de holds/breaks/racha/remontada, que sí dependen del orden
    // real): se deriva directo del estado final — nunca de una cuenta evento por evento, que
    // se quedaría corta con los games que un `adjustment` absorbió de una sola vez.
    gamesA = state.sets.reduce((acc, s) => acc + s.gamesA, 0) + state.gamesA;
    gamesB = state.sets.reduce((acc, s) => acc + s.gamesB, 0) + state.gamesB;

    return {
      gamesA, gamesB,
      setsWonA: state.setsWonA, setsWonB: state.setsWonB,
      matchWinner: state.matchWinner,
      serviceGames, breaksA, breaksB, holdsA, holdsB,
      maxGameStreakA, maxGameStreakB,
      maxAdvantageA, maxAdvantageB,
      maxComebackA, maxComebackB,
      setDurations,
      hasAdjustments,
    };
  }

  /** V13 (§13/§26) — separa `gameEvents` en tramos por set, misma filosofía que
   *  `computeSetSegments` pero para el motor de games (sin scoringSystem/tiebreakMode). */
  function computeGameSetSegments(events, format) {
    let state = E.createInitialGameEngineState();
    const segments = [];
    let startIdx = 0;
    let curSetNumber = 1;
    // V13.3 (§12): cada segmento necesita saber en qué GAME GLOBAL arranca, no solo en qué
    // set — `resolveServer` decide qué equipo saca según la PARIDAD del número de game
    // global (matchGameNumber), así que un replay aislado del segmento (que reinicia su
    // propio conteo de games desde 0) necesita este offset para no calcular la paridad mal.
    let curStartGameIndex = 0;
    events.forEach((ev, i) => {
      if (ev.type === 'adjustment') {
        segments.push({ setNumber: curSetNumber, events: events.slice(startIdx, i), startingGameIndex: curStartGameIndex });
        state = E.computeGameStateFromEvents([ev], format, null);
        startIdx = i;
        curSetNumber = state.sets.length + 1;
        curStartGameIndex = state.gameIndex;
        return;
      }
      const before = state;
      if (ev.type === 'tiebreak') state = E.applyGameTiebreak(state, ev.team, ev.score || null, format);
      else if (ev.type === 'extraordinary-tiebreak') state = E.applyExtraordinaryGameTiebreak(state, ev.team, ev.score || null, ev.winTarget, ev.requireDiff2);
      else state = E.applyGameWin(state, ev.team, format);
      if (state.sets.length > before.sets.length) {
        segments.push({ setNumber: curSetNumber, events: events.slice(startIdx, i + 1), startingGameIndex: curStartGameIndex });
        startIdx = i + 1;
        curSetNumber = state.sets.length + 1;
        curStartGameIndex = state.gameIndex;
      }
    });
    const tail = events.slice(startIdx);
    if (tail.length || !state.matchWinner) segments.push({ setNumber: curSetNumber, events: tail, startingGameIndex: curStartGameIndex });
    const merged = [];
    segments.forEach((seg) => {
      const last = merged[merged.length - 1];
      if (last && last.setNumber === seg.setNumber) last.events = last.events.concat(seg.events);
      else merged.push({ setNumber: seg.setNumber, events: seg.events.slice(), startingGameIndex: seg.startingGameIndex });
    });
    return merged;
  }

  /** V13 (§25) — curva de Evolución Por Games: un nodo por game jugado (incluye los
   *  resueltos por Tie break), con la diferencia de games acumulada DEL SET en curso (se
   *  resetea sola en cada set nuevo, igual razonamiento que `sampleDiff` de arriba). Tramos
   *  posteriores a un `adjustment` se marcan `partial:true` (orden desconocido, §13) en vez
   *  de fabricar un punto intermedio inventado. */
  function computeGamesEvolutionData(events, matchCtx) {
    const format = matchCtx.format;
    let state = E.createInitialGameEngineState();
    const games = [];
    const moments = [];
    let partial = false;
    let idx = 0;
    events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        state = E.computeGameStateFromEvents([ev], format, null);
        idx += 1;
        // V13 (§13): la corrección SÍ tiene que llegar a verse en la curva (el Consolidado es
        // explícito: "Evolución debe llegar correctamente a 4-3") — se agrega un nodo propio
        // para el salto, marcado `partial`/`adjustment` (círculo hueco en el gráfico) en vez
        // de omitirlo — omitirlo dejaría la curva "atrasada" hasta el próximo game real, que
        // podría no llegar nunca si la corrección cierra el partido. `winner: null` porque acá
        // no hubo un game individual que alguien "ganara": es un salto de marcador, no un game.
        games.push({
          index: idx, setNumber: state.sets.length + 1, winner: null, diff: state.gamesA - state.gamesB,
          gamesA: state.gamesA, gamesB: state.gamesB, server: null, holdOrBreak: null,
          setJustClosed: false, matchWinnerAfter: state.matchWinner, partial: true, adjustment: true,
          matchTimeMs: ev.matchTimeMs, timestamp: ev.timestamp,
        });
        if (state.matchWinner) moments.push({ kind: 'match-finish', gameIndex: idx, team: state.matchWinner, sets: state.sets.slice(), partial: true, matchTimeMs: ev.matchTimeMs, timestamp: ev.timestamp });
        partial = true; // el PRÓXIMO game real también nace de un tramo con orden desconocido
        return;
      }
      const before = state;
      const isTbResolution = ev.type === 'tiebreak' || ev.type === 'extraordinary-tiebreak';
      let winnerTeam;
      if (ev.type === 'tiebreak') { state = E.applyGameTiebreak(state, ev.team, ev.score || null, format); winnerTeam = ev.team; }
      else if (ev.type === 'extraordinary-tiebreak') { state = E.applyExtraordinaryGameTiebreak(state, ev.team, ev.score || null, ev.winTarget, ev.requireDiff2); winnerTeam = ev.team; }
      else { state = E.applyGameWin(state, ev.team, format); winnerTeam = ev.team; }
      idx += 1;

      const setJustClosed = state.sets.length > before.sets.length;
      const closedSet = setJustClosed ? state.sets[state.sets.length - 1] : null;
      const diff = setJustClosed ? (closedSet.gamesA - closedSet.gamesB) : (state.gamesA - state.gamesB);
      const setNumberForThisGame = before.sets.length + 1;
      // V13.3 (§13) — Timeline Por Games necesita el score ABSOLUTO después del game (no solo
      // la diferencia) y quién sacaba/HOLD-BREAK, igual criterio de "no inventar" que en
      // `computeGamesStats`: nunca se atribuye TB (no sabemos servicio dentro de uno), y si
      // el sacador no se conoce, el campo queda `null` en vez de adivinarlo.
      let server = null, holdOrBreak = null;
      if (!isTbResolution && matchCtx.serverKnowledge && matchCtx.players) {
        const matchGameNumber = E.currentMatchGameNumberGames(before);
        const withinSetGameNumber = E.currentWithinSetGameNumberGames(before);
        const info = E.resolveServer(matchCtx.serverKnowledge, matchCtx.players, setNumberForThisGame, matchGameNumber, withinSetGameNumber);
        if (info.resolved) {
          server = { id: info.playerId, team: info.team };
          holdOrBreak = info.team === winnerTeam ? 'hold' : 'break';
        }
      }
      games.push({
        index: idx,
        setNumber: setNumberForThisGame,
        winner: winnerTeam,
        diff,
        gamesA: closedSet ? closedSet.gamesA : state.gamesA,
        gamesB: closedSet ? closedSet.gamesB : state.gamesB,
        server,
        holdOrBreak,
        setJustClosed,
        matchWinnerAfter: state.matchWinner,
        partial,
        matchTimeMs: ev.matchTimeMs,
        timestamp: ev.timestamp,
      });

      if (isTbResolution) moments.push({ kind: 'tiebreak', gameIndex: idx, team: winnerTeam, extraordinary: ev.type === 'extraordinary-tiebreak', partial, matchTimeMs: ev.matchTimeMs, timestamp: ev.timestamp });
      if (setJustClosed) moments.push({ kind: 'set-finish', gameIndex: idx, team: winnerTeam, setNumber: setNumberForThisGame, closedSet, partial, matchTimeMs: ev.matchTimeMs, timestamp: ev.timestamp });
      if (state.matchWinner) moments.push({ kind: 'match-finish', gameIndex: idx, team: state.matchWinner, sets: state.sets.slice(), partial, matchTimeMs: ev.matchTimeMs, timestamp: ev.timestamp });
      partial = false; // el nodo ya quedó marcado; el siguiente vuelve a ser confiable salvo otro ajuste
    });
    return { games, moments };
  }

  const GAMES_PHRASE_BANKS = {
    inicio: ['arrancaron mejor', 'comenzaron mejor', 'tomaron primero la ventaja'],
    reaccion: ['reaccionaron', 'recuperaron terreno', 'consiguieron dar vuelta el desarrollo'],
    cierre: ['cerraron', 'terminaron imponiéndose', 'se impusieron'],
  };
  function gamesPickPhrase(bankKey, seed) {
    const bank = GAMES_PHRASE_BANKS[bankKey];
    return bank[Math.abs(seed || 0) % bank.length];
  }
  function gamesVarietySeedFor(stats, sets, matchCtx) {
    return (stats.gamesA || 0) * 3 + (stats.gamesB || 0) * 7 + (matchCtx.durationMs || 0) + (sets ? sets.length : 0) * 97;
  }

  /** V13.1 — nombre de pareja para PROSA narrativa: "Seba y Matu", nunca "Seba / Matu" (esa
   *  barra es para UI, no para texto — mismo criterio que `narrativeTeamLabel` del motor de
   *  puntos). Necesario para que los verbos que siguen sean plurales de forma natural
   *  ("se impusieron", nunca "se impuso"). */
  function gamesNarrativeTeamLabel(players, team) {
    return players.filter((p) => p.team === team).map((p) => p.name).join(' y ');
  }

  /** V13.1 (§2/§4) — recorre los eventos de UN SET (ya separado por `computeGameSetSegments`)
   *  y devuelve la secuencia real de scores game a game: `[{a,b,winner}, ...]`, arrancando
   *  en `{a:0,b:0,winner:null}`. Sirve para detectar empates intermedios, rachas de cierre y
   *  cambios de mando SIN re-derivar nada que `computeGamesStats` no calcule ya — esto solo
   *  agrega la secuencia completa (esa función solo guarda máximos). Mismo cuidado con el
   *  reset de fin de set que en el resto del módulo: si el evento cierra el set, se lee el
   *  score del set recién cerrado, nunca `state.gamesA/gamesB` ya reseteado a 0-0. */
  function walkGamesProgression(events, format) {
    let state = E.createInitialGameEngineState();
    const seq = [{ a: 0, b: 0, winner: null }];
    events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        state = E.computeGameStateFromEvents([ev], format, null);
        seq.push({ a: state.gamesA, b: state.gamesB, winner: null, adjustment: true });
        return;
      }
      const before = state;
      let winnerTeam;
      if (ev.type === 'tiebreak') { state = E.applyGameTiebreak(state, ev.team, ev.score || null, format); winnerTeam = ev.team; }
      else if (ev.type === 'extraordinary-tiebreak') { state = E.applyExtraordinaryGameTiebreak(state, ev.team, ev.score || null, ev.winTarget, ev.requireDiff2); winnerTeam = ev.team; }
      else { state = E.applyGameWin(state, ev.team, format); winnerTeam = ev.team; }
      const closedSet = state.sets.length > before.sets.length ? state.sets[state.sets.length - 1] : null;
      seq.push({ a: closedSet ? closedSet.gamesA : state.gamesA, b: closedSet ? closedSet.gamesB : state.gamesB, winner: winnerTeam });
    });
    return seq;
  }

  /** V13.3 (§3) — de la secuencia real de un set, extrae la RACHA DE CIERRE: la corrida más
   *  larga de games consecutivos ganados por `winner`, terminando en el último game del set,
   *  y el score REAL desde el que arrancó esa racha (`runStartScore`) — que puede ser un
   *  empate O un déficit. Antes esto asumía que la racha siempre arrancaba en un empate
   *  ("último empate"); eso es una contradicción real cuando la racha empieza estando abajo
   *  (Consolidado V13.3 §3, ejemplo explícito: "si una racha fue 1-4 → 6-4, el origen de la
   *  racha es 1-4", nunca un empate intermedio que puede no haber existido).
   *  También detecta si el EQUIPO QUE PIERDE cortó una racha de apertura del ganador antes
   *  de que este la retomara (§6 — "contar también al equipo que pierde cuando aporta
   *  historia"), y cuántas veces cambió el mando del set. */
  function analyzeGamesSetProgression(seq, winner) {
    let closingStreak = 0;
    let runStartIdx = seq.length - 1;
    for (let i = seq.length - 1; i >= 1; i--) {
      if (seq[i].adjustment) break;
      if (seq[i].winner === winner) { closingStreak += 1; runStartIdx = i - 1; } else break;
    }
    const runStartScore = seq[runStartIdx];

    let openingStreak = 0;
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].adjustment) break;
      if (seq[i].winner === winner) openingStreak += 1; else break;
    }
    const loserInterruptedOpening = openingStreak >= 2 && closingStreak >= 2 && runStartIdx > openingStreak;
    const openingEndScore = loserInterruptedOpening ? seq[openingStreak] : null;

    let domainChanges = 0;
    let lastSign = 0;
    seq.forEach((p, i) => {
      if (i === 0 || p.adjustment) return;
      const diff = p.a - p.b;
      const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
      if (sign !== 0 && lastSign !== 0 && sign !== lastSign) domainChanges += 1;
      if (sign !== 0) lastSign = sign;
    });
    return { closingStreak, runStartScore, openingStreak, loserInterruptedOpening, openingEndScore, domainChanges };
  }

  /** V13.1 (§1/§2/§4/§6/§7) — párrafo de UN set reglamentario (nunca uno extraordinario, ese
   *  se narra aparte — ver `appendGamesExtraordinaryNote`). Prioriza, en este orden: Tie
   *  break reglamentario del set (score exterior siempre seguro, interno opcional — §7) >
   *  tramo con corrección manual (descripción plana, sin inventar racha/remontada/cambio de
   *  mando — §3/Caso C) > empate tardío + racha de cierre (el "tramo decisivo" que pide §4) >
   *  empate tardío sin racha > varios cambios de mando > quiebres de los dos lados > un solo
   *  lado quebró > genérico. El marcador SIEMPRE se narra orientado hacia quien ganó ESE
   *  set (§6, `orientScore`/`orientTiebreak`, igual criterio que el motor de puntos). */
  /** V13.2 (§3) — "forma" de un set reglamentario, usada tanto para elegir plantilla de
   *  redacción como para decidir si dos sets son lo bastante parecidos como para
   *  relacionarlos en vez de narrarlos por separado (`buildGamesRelatedSetsParagraphs`).
   *  `progAnalysis` es el resultado de `analyzeGamesSetProgression` (o null si el tramo
   *  tuvo una corrección manual — Caso C, nunca se clasifica como "parejo"/"dominante" sin
   *  conocer el orden real). */
  function classifyGamesSetShape(s, progAnalysis, hadAdjustment, setStats, format) {
    if (E.completedSetHasTiebreak(s.gamesA, s.gamesB, format)) return 'tiebreak';
    if (hadAdjustment || !progAnalysis) return 'plain';
    const winner = s.winner;
    const rs = progAnalysis.runStartScore;
    // V13.3 (§3/§7): distingue una REMONTADA real (la racha de cierre arrancó con el
    // ganador ABAJO en el marcador) de un set simplemente parejo (arrancó empatado) — son
    // historias distintas aunque el resultado final se parezca (§7, "los resultados pueden
    // ser parecidos, las historias no").
    const winnerWasBehindAtRunStart = winner === 'A' ? rs.a < rs.b : rs.b < rs.a;
    const winnerWasTiedAtRunStart = rs.a === rs.b;
    if (winnerWasBehindAtRunStart && progAnalysis.closingStreak >= 2) return 'comeback';
    if (winnerWasTiedAtRunStart && progAnalysis.closingStreak >= 2) return 'tight';
    if (progAnalysis.domainChanges >= 2) return 'volatile';
    const wB = winner === 'A' ? setStats.breaksA : setStats.breaksB;
    const lB = winner === 'A' ? setStats.breaksB : setStats.breaksA;
    if ((wB > 0 && lB === 0) || Math.abs(s.gamesA - s.gamesB) >= 3) return 'comfortable';
    return 'plain';
  }

  /** V13.2 (§3) — párrafo de UN set, con 2-3 REDACCIONES ALTERNATIVAS por forma (nunca una
   *  sola plantilla fija) elegidas de forma determinística por `(seed + setNumber)`: con
   *  sets consecutivos, ese cálculo cae en restos distintos mod 2/3, así que dos sets
   *  seguidos del mismo partido nunca terminan sonando idénticos aunque compartan forma.
   *  El marcador siempre se narra orientado hacia quien ganó ESE set. */
  function buildGamesSetParagraph(setNumber, totalRegularSets, s, progAnalysis, setStats, nameOf, format, seed, shape) {
    const winner = s.winner;
    const loser = winner === 'A' ? 'B' : 'A';
    const setLabel = totalRegularSets === 1 ? 'set' : setNumber === 1 ? 'primer set' : (setNumber === totalRegularSets ? (totalRegularSets === 3 ? 'tercer set' : 'segundo set') : 'segundo set');
    const scoreClause = orientScore(s.gamesA, s.gamesB, winner);
    const pick = (variants) => variants[Math.abs(seed + setNumber) % variants.length];

    if (shape === 'tiebreak') {
      const trigger = format.tiebreakTriggerAt;
      const opener = pick([
        `El ${setLabel} llegó al ${trigger}-${trigger} y ${nameOf(winner)} se lo llevaron en el Tie break, ${scoreClause}`,
        `${nameOf(winner)} se impusieron en el Tie break del ${setLabel}, tras llegar al ${trigger}-${trigger}, ${scoreClause}`,
      ]);
      return opener + (s.tiebreak ? ` (TB ${orientTiebreak(s.tiebreak, winner)}).` : '.'); // §7: nunca inventa el score interno si se omitió
    }
    // V13.3 (§3/§5) — REMONTADA real: la racha de cierre arrancó con el ganador ABAJO. El
    // origen exacto de la racha (`runStartScore`) puede ser cualquier score, no solo un
    // empate — nunca se afirma "llegaron a X-X" si eso no ocurrió.
    if (shape === 'comeback') {
      const deficitClause = orientScore(progAnalysis.runStartScore.a, progAnalysis.runStartScore.b, winner);
      const streak = progAnalysis.closingStreak;
      return pick([
        `${nameOf(winner)} estuvieron ${deficitClause} abajo en el ${setLabel}, pero ganaron los últimos ${streak === 1 ? 'game' : `${streak} games`} seguidos para dar vuelta el parcial y quedárselo ${scoreClause}.`,
        `Abajo ${deficitClause} en el ${setLabel}, ${nameOf(winner)} reaccionaron con ${streak} games consecutivos y se lo llevaron ${scoreClause}.`,
        `El ${setLabel} parecía de ${nameOf(loser)}, pero desde el ${deficitClause} ${nameOf(winner)} ganaron ${streak === 1 ? 'el último game' : `los últimos ${streak} games`} y dieron vuelta el marcador para cerrarlo ${scoreClause}.`,
      ]);
    }
    if (shape === 'tight') {
      const tieClause = orientScore(progAnalysis.runStartScore.a, progAnalysis.runStartScore.b, winner);
      const streak = progAnalysis.closingStreak;
      return pick([
        `El ${setLabel} llegó ${tieClause} antes de que ${nameOf(winner)} ganaran los últimos ${streak} games seguidos para cerrarlo ${scoreClause}.`,
        `${nameOf(winner)} se mantuvieron firmes hasta el ${tieClause} en el ${setLabel}, y desde ahí encadenaron ${streak} games para quedárselo ${scoreClause}.`,
        `El ${setLabel} estuvo parejo hasta el ${tieClause}; a partir de ahí, ${nameOf(winner)} dieron el salto y lo cerraron ${scoreClause}.`,
      ]);
    }
    if (shape === 'volatile') {
      return pick([
        `El ${setLabel} tuvo varios cambios de mando antes de que ${nameOf(winner)} se lo quedaran ${scoreClause}.`,
        `El mando del ${setLabel} cambió de manos más de una vez, hasta que ${nameOf(winner)} se lo terminaron llevando ${scoreClause}.`,
      ]);
    }
    if (shape === 'comfortable') {
      // V13.3 (§6) — "contar también al equipo que pierde cuando aporta historia": si el
      // ganador tuvo una racha de apertura que el rival llegó a cortar (aunque sea un solo
      // game) antes de que el ganador retomara el control, ese hecho entra en la narración
      // en vez de mostrar el set como una sola línea recta.
      if (progAnalysis && progAnalysis.loserInterruptedOpening) {
        const openClause = orientScore(progAnalysis.openingEndScore.a, progAnalysis.openingEndScore.b, winner);
        const cutClause = orientScore(progAnalysis.runStartScore.a, progAnalysis.runStartScore.b, winner);
        const streak = progAnalysis.closingStreak;
        return `${nameOf(winner)} se pusieron ${openClause} en el ${setLabel}. ${nameOf(loser)} cortaron la racha para el ${cutClause}, pero no alcanzó: ${nameOf(winner)} ganaron ${streak === 1 ? 'el siguiente game' : `los ${streak} siguientes`} y cerraron ${scoreClause}.`;
      }
      const wB = winner === 'A' ? setStats.breaksA : setStats.breaksB;
      const breakClause = wB > 0 ? `, con ${wB === 1 ? 'un quiebre' : `${wB} quiebres`} a favor,` : '';
      const bank = setNumber === 1 ? 'inicio' : 'reaccion';
      return pick([
        `${nameOf(winner)} ${gamesPickPhrase(bank, seed)}${breakClause} y se quedaron con el ${setLabel} ${scoreClause}.`,
        `${nameOf(winner)} tomaron el control del ${setLabel} desde temprano y lo cerraron ${scoreClause}.`,
        `Sin demasiados sobresaltos, ${nameOf(winner)} se quedaron con el ${setLabel} ${scoreClause}.`,
      ]);
    }
    // 'plain' — Caso C (corrección manual) u otro tramo sin desarrollo confiable: solo el
    // score final es seguro (§11 del V13), nunca se afirma remontada/cambio de mando.
    return pick([
      `${nameOf(winner)} se quedaron con el ${setLabel} ${scoreClause}.`,
      `${nameOf(winner)} ganaron el ${setLabel} ${scoreClause}.`,
    ]);
  }

  /** V13.2 (§3) — cuando un partido termina en sets corridos (2 sets reglamentarios, mismo
   *  ganador) y AMBOS sets comparten forma "tight" o "comfortable", los relaciona en vez de
   *  narrarlos como dos párrafos casi idénticos (el problema real reportado: "6-3 · 6-2"
   *  sonaba a plantilla repetida). Compara CUÁNDO apareció la diferencia (antes/después) y
   *  CUÁNTO margen dejó cada uno — nunca introduce psicología, solo hechos comparables.
   *  Devuelve `null` si no aplica (formas distintas, ganadores distintos, u otra forma) —
   *  el llamador cae entonces al párrafo-por-set de siempre. */
  function buildGamesRelatedSetsParagraphs(a1, a2, nameOf) {
    if (a1.s.winner !== a2.s.winner) return null;
    if (a1.shape !== a2.shape) return null;
    if (a1.shape !== 'tight' && a1.shape !== 'comfortable' && a1.shape !== 'comeback') return null;
    const winner = a1.s.winner;
    const scoreClause1 = orientScore(a1.s.gamesA, a1.s.gamesB, winner);
    const scoreClause2 = orientScore(a2.s.gamesA, a2.s.gamesB, winner);
    const margin1 = Math.abs(a1.s.gamesA - a1.s.gamesB);
    const margin2 = Math.abs(a2.s.gamesA - a2.s.gamesB);
    const marginLabel = margin2 > margin1 ? 'con mayor margen' : margin2 < margin1 ? 'aunque esta vez más ajustado' : 'con un margen parecido';

    if (a1.shape === 'tight' || a1.shape === 'comeback') {
      // V13.3 (§3): `runStartScore` es el origen REAL de la racha de cierre (empate o
      // déficit) — nunca se asume que fue un empate si en realidad fue una remontada.
      const rs1 = a1.progAnalysis.runStartScore, rs2 = a2.progAnalysis.runStartScore;
      const rs1Total = rs1.a + rs1.b, rs2Total = rs2.a + rs2.b;
      const whenLabel = rs2Total < rs1Total ? 'apareció antes' : rs2Total > rs1Total ? 'apareció más tarde' : 'apareció en un momento parecido';
      const p1 = a1.shape === 'comeback'
        ? `El primero estuvo ${orientScore(rs1.a, rs1.b, winner)} en contra, hasta que ${nameOf(winner)} encadenaron ${a1.progAnalysis.closingStreak === 1 ? 'un game' : `${a1.progAnalysis.closingStreak} games`} para darlo vuelta y llevárselo ${scoreClause1}.`
        : `El primero se mantuvo abierto hasta el ${orientScore(rs1.a, rs1.b, winner)}, cuando ${nameOf(winner)} encadenaron ${a1.progAnalysis.closingStreak === 1 ? 'un game' : `${a1.progAnalysis.closingStreak} games`} para llevárselo ${scoreClause1}.`;
      const p2 = a1.shape === 'comeback'
        ? `El segundo tuvo una historia parecida — otra vez ${nameOf(winner)} remontaron, aunque la reacción ${whenLabel}: desde el ${orientScore(rs2.a, rs2.b, winner)} en contra dieron vuelta el marcador y cerraron ${marginLabel} ${scoreClause2}.`
        : `El segundo siguió un patrón parecido, aunque la diferencia ${whenLabel}: desde el ${orientScore(rs2.a, rs2.b, winner)} volvieron a despegarse y cerraron ${marginLabel} ${scoreClause2}.`;
      return [p1, p2];
    }
    // 'comfortable'
    const p1 = `${nameOf(winner)} tomaron el control del primer set y lo cerraron ${scoreClause1}.`;
    const p2 = `Repitieron el patrón en el segundo, ${marginLabel}, ${scoreClause2}.`;
    return [p1, p2];
  }

  /** V13.1 (§3) — paridad real por combinación de señales (nunca por una sola métrica
   *  aislada): diferencia total de games chica, máxima ventaja baja para ambos, breaks
   *  parejos, y todos los sets cerrados por poco margen o en Tie break. */
  function buildGamesGlobalReadParagraph(stats, regularSets, format) {
    if (regularSets.length < 2) return null; // con un solo set no hace falta una lectura aparte
    const totalGames = stats.gamesA + stats.gamesB;
    const gameDiffRatio = totalGames > 0 ? Math.abs(stats.gamesA - stats.gamesB) / totalGames : 0;
    const maxAdvBoth = Math.max(stats.maxAdvantageA, stats.maxAdvantageB);
    const breaksClose = Math.abs(stats.breaksA - stats.breaksB) <= 1;
    const closeSets = regularSets.filter((s) => Math.abs(s.gamesA - s.gamesB) <= 2 || E.completedSetHasTiebreak(s.gamesA, s.gamesB, format)).length;

    let signals = 0;
    if (gameDiffRatio <= 0.15) signals += 1;
    if (maxAdvBoth <= 3) signals += 1;
    if (breaksClose) signals += 1;
    if (closeSets === regularSets.length) signals += 1;

    if (signals >= 3) return 'Fue un partido muy parejo de principio a fin.';
    return null;
  }

  /** V13.1 — equivalente de `appendExtraordinaryTiebreakNote` (motor de puntos) para Por
   *  Games: el set extraordinario se narra aparte, con su score real previo (nunca
   *  fabricado) y el resultado del TB si se conoce. */
  function appendGamesExtraordinaryNote(text, sets, nameOf) {
    const idx = sets.findIndex((s) => s.extraordinary);
    if (idx === -1) return text;
    const s = sets[idx];
    const setLabel = sets.length === 1 ? 'el set' : (idx === 0 ? 'el primer set' : idx === 1 ? 'el segundo set' : 'el tercer set');
    const cfg = s.tiebreak && s.tiebreak.mode;
    const targetLabel = cfg && typeof cfg === 'object' && cfg.winTarget ? ` a ${cfg.winTarget}` : '';
    const note = `Con ${setLabel} ${orientScore(s.gamesA, s.gamesB, s.winner)}, decidieron resolver el partido mediante un Tie break${targetLabel}.`
      + (s.tiebreak ? ` ${nameOf(s.winner)} se impusieron ${orientTiebreak(s.tiebreak, s.winner)} y se quedaron con el encuentro.` : ` ${nameOf(s.winner)} se quedaron con el encuentro.`);
    return text ? text + '\n\n' + note : note;
  }

  /** V13.2 (§1/§2/§3) — BRAMU Intelligence para Por Games: un párrafo por set reglamentario
   *  (cronológico — Set 1, Set 2, set decisivo, misma filosofía que
   *  `buildThreeSetChronologicalStory` del motor de puntos) — o, en sets corridos con el
   *  mismo patrón en ambos, un párrafo RELACIONADO en vez de dos casi idénticos (§3) — más
   *  una lectura global de paridad si corresponde, más una nota aparte si algún set se
   *  resolvió con Tie break extraordinario. Nunca afirma nada de puntos (§24 del V13) ni
   *  inventa el orden de un tramo corregido a mano (Caso C). Las redacciones varían de forma
   *  determinística por forma de set (§3) — nunca la misma plantilla mecánica para todos. */
  function generateGamesIntelligence(stats, matchCtx, sets, winnerTeam, finishInfo) {
    const format = matchCtx.format;
    const nameOf = (team) => gamesNarrativeTeamLabel(matchCtx.players, team);
    const seed = gamesVarietySeedFor(stats, sets, matchCtx);

    if (!sets.length) {
      if (finishInfo && finishInfo.manual) return `El partido se dio por finalizado antes de tiempo (${finishInfo.reasonLabel || 'motivo no especificado'}), sin datos suficientes para un resumen.`;
      return 'El partido no llegó a completar ningún set con datos suficientes para un resumen.';
    }

    const regularSets = sets.filter((s) => !s.extraordinary);
    const events = matchCtx.events || [];
    const segs = computeGameSetSegments(events, format);

    const analyses = regularSets.map((s, i) => {
      const setNumber = i + 1;
      const seg = segs.find((sg) => sg.setNumber === setNumber);
      const segEvents = seg ? seg.events : [];
      const hadAdjustment = segEvents.some((ev) => ev.type === 'adjustment');
      const seq = hadAdjustment ? null : walkGamesProgression(segEvents, format);
      const setStats = computeGamesStats(segEvents, matchCtx, setNumber, seg ? seg.startingGameIndex : 0); // V13.3 (§12): setNumber y game global reales, no los locales del tramo
      const progAnalysis = seq ? analyzeGamesSetProgression(seq, s.winner) : null;
      const shape = classifyGamesSetShape(s, progAnalysis, hadAdjustment, setStats, format);
      return { setNumber, s, setStats, progAnalysis, shape };
    });

    let paras = null;
    if (regularSets.length === 2) {
      paras = buildGamesRelatedSetsParagraphs(analyses[0], analyses[1], nameOf);
    }
    if (!paras) {
      paras = analyses.map((a) => buildGamesSetParagraph(a.setNumber, regularSets.length, a.s, a.progAnalysis, a.setStats, nameOf, format, seed, a.shape));
    }

    const globalRead = buildGamesGlobalReadParagraph(stats, regularSets, format);
    if (globalRead) paras.push(globalRead);

    let text = paras.filter(Boolean).join('\n\n');
    text = appendGamesExtraordinaryNote(text, sets, nameOf);

    if (!winnerTeam && finishInfo && finishInfo.manual) {
      text += `\n\nEl partido se dio por finalizado antes de tiempo (${finishInfo.reasonLabel || 'motivo no especificado'}), sin un ganador definido.`;
    }
    if (stats.hasAdjustments) {
      text += '\n\nHubo una corrección manual del marcador durante el partido: algunas rachas y remontadas pueden estar incompletas.';
    }
    return text;
  }

  global.PLStats = {
    computeStats, generatePlayerIntelligence: generateBramuIntelligence, generateBramuIntelligence,
    computeEvolutionData, computeSetGameDeficits, computeSetSegments, teamLabel, fmtOpp, EVOLUTION_WEIGHTS,
    // V10 (46/89) — expuestas para el arnés de tests sintéticos (tests.html): son funciones
    // puras, sin estado, así que exponerlas no cambia ningún comportamiento de la app.
    describeMagnitude, magnitudeOpportunitiesPhrase, interpretBreakPointsNarrative, orientScore, orientTiebreak,
    // V11.1 (§4.3) — ídem, para poder testear la detección de hold bajo presión aislada.
    findDramaticHold,
    // V11.1 (§11.3) — ídem, para poder testear que la elección de variantes es determinística.
    pickPhrase, varietySeedFor, PHRASE_BANKS,
    // V11.4 (feedback real) — ídem, paridad estadística y desarrollo del Tie break.
    detectStrongParity, describeTiebreakArc, buildTiebreakArcClause,
    // V11.14 (feedback real) — composición cronológica de partidos a 3 sets, para poder
    // testear cada párrafo por separado además del resultado combinado.
    buildThreeSetChronologicalStory, buildDecidingSetParagraph, buildGlobalReadParagraph,
    // V11.16 (feedback real) — ídem, para poder testear aisladamente el conteo de Match
    // Points salvados (antes/durante del Tie break) y el ordinal masculino de game.
    countMatchPointsSavedInSet, findPreTiebreakMatchPointsSaved, ordinalGameWord,
    // V13 — estadísticas y BRAMU Intelligence de Por Games (§20-25)
    computeGamesStats, computeGameSetSegments, computeGamesEvolutionData, generateGamesIntelligence,
  };
})(typeof window !== 'undefined' ? window : globalThis);
