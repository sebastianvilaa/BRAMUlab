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

    events.forEach((ev) => {
      matchEndMs = ev.matchTimeMs;

      // Un AJUSTE DE MARCADOR nunca es un punto jugado: reemplaza el estado
      // deportivo, corta cualquier racha en curso (nunca puede "atravesar"
      // un ajuste) y marca que las estadísticas son parciales/discontinuas.
      if (ev.type === 'adjustment') {
        state = E.applyAdjustment(ev.newState);
        currentStreak = { team: null, count: 0 };
        hasAdjustments = true;
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
      const servingTeam = resolved.resolved ? resolved.team : null;
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
      const importance = E.detectPointImportance(before, scoringSystem, format, modeForThisPoint, servingTeam);
      recordOpportunity(breakPoints, importance.break, ev.team);
      recordOpportunity(setPoints, importance.set, ev.team);
      recordOpportunity(matchPoints, importance.match, ev.team);

      // V11 (§12.1): saque/resto por punto — INCLUYE tie break. Cada punto de TB tiene un
      // sacador conocido (rotación dentro del propio TB, ya resuelto arriba vía
      // resolveTiebreakServer); lo único que el TB nunca alimenta es un game de saque
      // completo (más abajo, wasNormalGameEnd sigue excluyéndolo) ni breaks/Break Points.
      if (servingTeam) {
        serveStats[servingTeam].served += 1;
        if (ev.team === servingTeam) serveStats[servingTeam].wonServing += 1;
        if (servingPlayerId != null && perPlayerServe[servingPlayerId]) {
          perPlayerServe[servingPlayerId].pointsTotal += 1;
          if (ev.team === servingTeam) perPlayerServe[servingPlayerId].pointsWon += 1;
        }
      }

      state = E.applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);

      const wasTiebreakConcluding = before.inTiebreak && !state.inTiebreak;
      const wasNormalGameEnd = !before.inTiebreak && state.gameIndex > before.gameIndex;

      // Games de saque / breaks — SOLO games normales, nunca tie break.
      if (wasNormalGameEnd) {
        const winnerOfGame = state.sets.length > before.sets.length
          ? state.sets[state.sets.length - 1].winner
          : (state.gamesA > before.gamesA ? 'A' : 'B');
        if (servingTeam) {
          if (winnerOfGame === servingTeam) {
            if (servingTeam === 'A') serviceGames.wonA += 1; else serviceGames.wonB += 1;
          } else {
            if (servingTeam === 'A') serviceGames.lostA += 1; else serviceGames.lostB += 1;
            if (winnerOfGame === 'A') breaks.A += 1; else breaks.B += 1;
          }
          if (servingPlayerId != null && perPlayerServe[servingPlayerId]) {
            perPlayerServe[servingPlayerId].games += 1;
            if (winnerOfGame === servingTeam) perPlayerServe[servingPlayerId].held += 1;
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
    const serverFullyKnown = hasServerInfo && serviceGames.unknown === 0;

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
      return `${nameOf(moreBreaks)} ${chancesClause}, y además las aprovecharon mejor. Convirtieron ${moreBucket.converted} quiebres contra los ${fewerBucket.converted} de ${nameOf(fewerBreaks)}.`;
    }
    if (fewerBucket.opportunities > moreBucket.opportunities) {
      // V11 (§7.9): PRESIÓN SIN CONVERSIÓN — quien convirtió MENOS en realidad generó MÁS
      // oportunidades (presión real) pero no las aprovechó. No confundir con dominio de quien
      // tuvo más chances: la conversión real fue del otro lado, y eso también hay que decirlo.
      const oppPhrase = magnitudeOpportunitiesPhrase(fewerBucket.opportunities, moreBucket.opportunities);
      const pressureClause = oppPhrase ? `generaron ${oppPhrase} de quiebre` : `generaron más oportunidades de quiebre, ${fewerBucket.opportunities} contra ${moreBucket.opportunities}`;
      return `${nameOf(fewerBreaks)} ${pressureClause}, pero fueron ${nameOf(moreBreaks)} quienes más veces lograron convertir, ${moreBucket.converted} contra ${fewerBucket.converted}.`;
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
      state = E.applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);
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
      const servingTeam = resolved.resolved ? resolved.team : null;
      const servingPlayerId = resolved.resolved ? resolved.playerId : null;
      state = E.applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);
      const wasNormalGameEnd = !before.inTiebreak && state.gameIndex > before.gameIndex;
      if (wasNormalGameEnd && servingTeam) {
        const closedSet = state.sets.length > before.sets.length;
        const winnerOfGame = closedSet ? state.sets[state.sets.length - 1].winner : (state.gamesA > before.gamesA ? 'A' : 'B');
        if (winnerOfGame !== servingTeam) {
          found = {
            setNumber, breakerTeam: winnerOfGame, servedByTeam: servingTeam, serverPlayerId: servingPlayerId,
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

  const ORDINALS = { 1: 'primera', 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta', 6: 'sexta' };

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
  function buildClosingActText(matchCtx, sets, actSetNumber, nameOf) {
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
    const text = (hasServerInfoInSet && winnerBreaksInSet > 0)
      ? `El último set tuvo otro desarrollo: ${nameOf(lastSet.winner)} consiguieron ${winnerBreaksInSet === 1 ? 'un quiebre' : `${winnerBreaksInSet} quiebres`} y cerraron ${closeClause}.`
      : `El último set tuvo otro desarrollo: ${nameOf(lastSet.winner)} se quedaron con el set ${closeClause}.`;
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
   */
  function generateBramuIntelligence(stats, matchCtx, sets, winnerTeam, finishInfo) {
    // R1: en texto narrativo, "Seba y Matu" — nunca "Seba / Matu" (esa barra es para UI, no para prosa).
    const narrativeTeamLabel = (team) => matchCtx.players.filter((p) => p.team === team).map((p) => p.name).join(' y ');
    const nameA = narrativeTeamLabel('A');
    const nameB = narrativeTeamLabel('B');
    const otherName = (team) => (team === 'A' ? nameB : nameA);
    const nameOf = (team) => (team === 'A' ? nameA : nameB);
    const partial = !!(stats.hasAdjustments || matchCtx.coverageStartLabel);
    const events = matchCtx.events || [];

    // ---- Recolecta candidatas a "la historia principal" (R4/R5), en orden de prioridad ----
    const stories = [];
    const evoData = computeEvolutionData(events, matchCtx);

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
        let text = `El momento decisivo llegó con ${decisive.scoreBefore} en el ${decisive.setNumber}° set. `;
        text += `${nameOf(decisive.team)} ganaron ${pointLabel}${serverClause}, consiguieron el quiebre`;
        text += sets.length > 1
          ? ' y después sostuvieron su servicio para cerrar el partido.'
          : ` y después sostuvieron su servicio para cerrar ${orientScore(decidingSet.gamesA, decidingSet.gamesB, decisive.team)}.`;
        const arc = buildSetArcSentence(sets, nameOf, decisive.setNumber);
        stories.push({ kind: 'decisivo-oro-break', weight: 110, text: (arc ? arc + ' ' : '') + text, partialSensitive: false });
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
          text: `${nameOf(winnerTeam)} arrancaron perdiendo el primer set (${orientScore(sets[0].gamesA, sets[0].gamesB, winnerTeam)}) y se repusieron para llevarse el partido.`,
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
          text: `${nameOf(winnerTeam)} empezaron mejor, pero ${otherName(winnerTeam)} les cambiaron el partido en el medio antes de que ${nameOf(winnerTeam)} volvieran a imponerse para cerrarlo.`,
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
    if (stats.hasServerInfo && stats.breaks.A === 0 && stats.breaks.B === 0 && winnerTeam) {
      const decidingSet = sets[sets.length - 1];
      if (decidingSet && decidingSet.tiebreak) {
        const tb = decidingSet.tiebreak;
        const tbResult = orientTiebreak(tb, winnerTeam);
        const text = sets.length > 1
          ? `Nadie quebró el servicio en todo el partido: la definición pasó por el Tie break del ${sets.length}° set, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`
          : `Nadie quebró el servicio en todo el set: la definición pasó por el Tie break, que ${nameOf(winnerTeam)} ganaron ${tbResult}.`;
        // V11 (§2.5): marca que el Tie break del último set ya quedó narrado acá, para que el
        // cierre por duración (párrafo final) no lo repita ("...cerrando el Tie break final
        // X-Y" después de ya haberlo contado) — bug real de redundancia narrativa.
        stories.push({ kind: 'tie-break-decisivo', weight: 89, text, partialSensitive: false, tbMentionedSetNumber: sets.length });
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
      const closingAct = buildClosingActText(matchCtx, sets, remontadaStory.actSetNumber, nameOf);
      if (closingAct) {
        paras.push(closingAct.text);
        closingActTbMentioned = closingAct.tbMentioned;
      }
    }

    // ---- Párrafo 2: puntos decisivos (R6/R7/R8/R9/AB) ----
    const sentences2 = [];
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
        sentences2.push(`Cerraron el partido en su ${ORDINALS[winnerMp.opportunities] || winnerMp.opportunities + 'ª'} oportunidad de Match Point.`);
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
      const tbAlreadyMentioned = closingActTbMentioned || topStories.some((s) => s.tbMentionedSetNumber === sets.length);
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
        state = E.applyAdjustment(ev.newState);
        completedSets = state.sets.slice();
        breaksFor = { A: 0, B: 0 }; breaksAgainst = { A: 0, B: 0 }; consolidations = { A: 0, B: 0 };
        lastBreakBy = null; consolidatedThisBreak = true;
        tbMiniFor = { A: 0, B: 0 }; tbMiniAgainst = { A: 0, B: 0 };
        worstDiffA = 0; bestDiffA = 0; comebackFlagA = false; comebackFlagB = false;
        pendingGap = true;
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
      const servingTeam = resolved.resolved ? resolved.team : null;

      const importance = E.detectPointImportance(before, scoringSystem, format, modeForThisPoint, servingTeam);
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
        const isBreak = !wasInTiebreak && !!servingTeam && winnerOfGame !== servingTeam;

        if (isBreak) {
          const wasCounterbreak = lastBreakBy === E.otherTeam(winnerOfGame);
          breaksFor[winnerOfGame] += 1; breaksAgainst[E.otherTeam(winnerOfGame)] += 1;
          moments.push({ kind: 'break', team: winnerOfGame, setNumber, server: servingTeam, isGoldOrStar: isGoldOrStarPoint, isCounterbreak: wasCounterbreak, scoreBefore: `${before.gamesA}-${before.gamesB}`, scoreAfter: `${after.gamesA}-${after.gamesB}`, matchTimeMs: ev.matchTimeMs });
          lastBreakBy = winnerOfGame; consolidatedThisBreak = false;
        } else if (!wasInTiebreak && servingTeam && winnerOfGame === servingTeam) {
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
          winner: winnerOfGame, isBreak, server: servingTeam, isTiebreakClose: wasInTiebreak,
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
        if (servingTeam && ev.team !== servingTeam) {
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
      state = E.applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);
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

  global.PLStats = {
    computeStats, generatePlayerIntelligence: generateBramuIntelligence, generateBramuIntelligence,
    computeEvolutionData, computeSetGameDeficits, computeSetSegments, teamLabel, fmtOpp, EVOLUTION_WEIGHTS,
    // V10 (46/89) — expuestas para el arnés de tests sintéticos (tests.html): son funciones
    // puras, sin estado, así que exponerlas no cambia ningún comportamiento de la app.
    describeMagnitude, magnitudeOpportunitiesPhrase, interpretBreakPointsNarrative, orientScore, orientTiebreak,
  };
})(typeof window !== 'undefined' ? window : globalThis);
