/* ==========================================================================
   BRAMU Lab — intelligence-context.js (Backend Bloque 8, Fase A)
   Capa pura de DERIVADOS para BRAMU Intelligence V1. Cero DOM, cero
   localStorage, cero red — mismo criterio que level-context.js/match-sync.js.

   División de responsabilidad (docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md
   §10, Bloque A): este módulo NO genera claims, NO puntúa relevancia, NO
   redacta texto y NO decide qué se muestra — eso es Fase B/C/D. Solo
   convierte la historia personal ya persistida (server-backed, vía
   get_player_intelligence_history + PLMatchSync.translateServerMatchToLocalShape)
   en hechos atómicos y agregados verificables: perspectiva por jugador,
   estructura de sets/margen, rachas, forma reciente, hitos acumulativos,
   relaciones (compañero/rival individual/pareja rival/cruce exacto de
   parejas) y separación entre "vino a jugar" (participación) y "cuenta
   como oficial" (Nivel-elegible). NUNCA reimplementa detectFormatKey,
   computeMarginScoreInputs ni la traducción servidor->forma local: siempre
   llama a PLLevelContext/PLMatchSync, igual que level-context.js nunca
   reimplementa level.js.

   CONTRATO DE ORDEN (BRAMU_Intelligence.md §11.1: "orden por fecha real
   jugada, no por orden de carga"): toda función de este módulo que recibe
   `historyAsc` espera un array YA ordenado ascendente por `playedAt` real
   (ver `buildPersonalHistory`, el único punto que ordena) — nunca reordena
   por su cuenta ni asume el orden de llegada de la RPC.

   CONTRATO "COMO DE ESE MOMENTO" (BRAMU_Intelligence.md §13.1: una
   corrección/anulación puede cambiar rachas/forma/balances posteriores):
   cada función recibe la historia TRUNCADA hasta el partido de interés
   inclusive (el último elemento de `historyAsc` es siempre "el partido que
   se está evaluando"). Esto permite recalcular el contexto de CUALQUIER
   partido, pasado o presente, sin una API separada — el llamador decide
   hasta dónde truncar.

   SEPARACIÓN HISTORIA PERSONAL VS. OFICIAL (BRAMU_Intelligence.md §8.2):
   `historyAsc` es siempre la historia PERSONAL completa (cualquier partido
   propio no anulado, oculto excluido salvo pedido explícito — ver la RPC
   get_player_intelligence_history). Los balances de participación
   (cuántas veces jugó con/contra alguien) se calculan sobre esa historia
   completa; wins/losses y rachas SOLO cuentan partidos con resultado
   definido (`perspective.result` no nulo) — un partido pendiente sin
   consenso todavía no es evidencia de victoria ni de derrota para nadie.
   El flag `officialEligible` de cada partido queda disponible sin
   filtrar acá: decidir qué familia de insight exige oficialidad es Fase B.

   Ningún número se inventa: donde falta muestra o identidad, las funciones
   devuelven `null`/conteos en 0, nunca un valor estimado.
   ========================================================================== */
(function (global) {
  'use strict';

  const WIN_MILESTONES = Object.freeze([10, 25, 50, 100]);

  function round4(n) { return Math.round(n * 10000) / 10000; }

  function playedAtMs(match) {
    const t = new Date(match.playedAt).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /* ------------------------------------------------------------------ */
  /* 0. TRADUCCIÓN Y ORDEN — único punto de entrada desde filas servidor  */
  /* ------------------------------------------------------------------ */

  /** `get_player_intelligence_history` es `returns table (...)`: Supabase/PostgREST serializa
   *  sus columnas TOP-LEVEL en snake_case (mismo comportamiento ya resuelto para `get_my_matches`
   *  por `normalizeMyMatchesRow` en `bramulab/matches.js`, Revisión Central Fase A — C01). Esta
   *  función replica esa normalización EN LA FRONTERA de Intelligence, sin tocar `matches.js`
   *  (Bloque 5 cerrado): ningún otro archivo la necesita todavía porque no existe otro consumidor
   *  de esta RPC. `participants`/`sets` NO se tocan acá — son objetos jsonb que la propia función
   *  SQL arma con `jsonb_build_object('team', ..., 'playerId', ...)`, ya en camelCase, nunca
   *  columnas top-level de la tabla de retorno. */
  function normalizeIntelligenceHistoryRow(row) {
    return {
      matchId: row.match_id,
      status: row.status,
      playedAt: row.played_at,
      playedAtTimeKnown: row.played_at_time_known,
      formatId: row.format_id,
      scoringSystem: row.scoring_system,
      myTeam: row.my_team,
      createdByPlayerId: row.created_by_player_id,
      validatedAt: row.validated_at,
      validationDeadlineAt: row.validation_deadline_at,
      hidden: row.hidden,
      hasOpenIdentityIssue: !!row.has_open_identity_issue,
      officialEligible: !!row.official_eligible,
      participants: row.participants,
      sets: row.sets,
    };
  }

  /** Traduce una fila REAL de get_player_intelligence_history a la MISMA forma local que ya usa
   *  PLMatchSync.translateServerMatchToLocalShape (Bloque 5): primero normaliza snake_case ->
   *  camelCase (ver `normalizeIntelligenceHistoryRow`), después traduce, y por último anota
   *  `officialEligible` — el único campo que `translateServerMatchToLocalShape` no conoce
   *  todavía. No se modifica match-sync.js (Bloque 5 cerrado): se anota el resultado ya
   *  traducido, nunca se duplica la traducción. */
  function translateForIntelligence(row) {
    const MatchSync = global.PLMatchSync;
    const normalized = normalizeIntelligenceHistoryRow(row);
    const local = MatchSync.translateServerMatchToLocalShape(normalized);
    local.officialEligible = normalized.officialEligible;
    return local;
  }

  /** Único punto de orden de todo el módulo (ver contrato de cabecera). Ascendente por
   *  `playedAt` real; `matchId` como desempate estable para timestamps idénticos (partidos con
   *  hora desconocida pueden compartir el mismo instante por defecto). */
  function buildPersonalHistory(rows) {
    return (Array.isArray(rows) ? rows.slice() : [])
      .map(translateForIntelligence)
      .sort((a, b) => {
        const diff = (playedAtMs(a) || 0) - (playedAtMs(b) || 0);
        if (diff !== 0) return diff;
        return a.matchId < b.matchId ? -1 : (a.matchId > b.matchId ? 1 : 0);
      });
  }

  /* ------------------------------------------------------------------ */
  /* 1. PERSPECTIVA — resultado, compañero y rivales desde UN jugador     */
  /* ------------------------------------------------------------------ */

  function playerIdOf(p) { return (p && p.userId) || null; }

  /** `null` si el caller no aparece en `match.players` (no debería pasar: la RPC ya filtra por
   *  participante) — nunca inventa una fila. `result` es `null` cuando el partido todavía no
   *  tiene `winnerTeam` definido (pendiente sin consenso de ambas parejas): un partido sin
   *  resultado no es evidencia de victoria ni de derrota. */
  function resolvePerspective(match, callerPlayerId) {
    const players = match.players || [];
    const own = players.find((p) => p && p.userId === callerPlayerId) || null;
    if (!own) return null;
    const teammate = players.find((p) => p && p.team === own.team && p !== own) || null;
    const rivals = players.filter((p) => p && p.team !== own.team);
    const result = (match.winnerTeam === 'A' || match.winnerTeam === 'B')
      ? (match.winnerTeam === own.team ? 'win' : 'loss')
      : null;
    return { own, teammate, rivals, result };
  }

  /* ------------------------------------------------------------------ */
  /* 2. ESTRUCTURA DE SETS Y MARGEN — BRAMU_Intelligence.md §5.1/§11.2    */
  /* ------------------------------------------------------------------ */

  /** Reutiliza detectFormatKey/computeMarginScoreInputs de PLLevelContext (nunca reimplementa
   *  la clasificación de formato ni el cálculo de margen — "no duplicar motores"). Los campos
   *  dependientes del ganador quedan en `null` mientras `match.winnerTeam` no esté definido:
   *  nunca se infiere un margen de un resultado que todavía no existe. `alternatingSetWinners`
   *  solo aplica con exactamente 3 sets jugados (con 2 sets, straight-sets, el concepto de
   *  "alternó hasta la definición" no existe — BRAMU solo juega al mejor de 3, nunca 5). */
  function computeFormatFacts(match) {
    const LevelContext = global.PLLevelContext;
    const sets = match.sets || [];
    const perSetWinner = sets.map((s) => (s && s.winner) || null);
    const facts = {
      setsPlayed: sets.length,
      perSetWinner,
      decisiveSet: sets.length >= 3,
      formatKey: null,
      winnerTeam: match.winnerTeam || null,
      setsWonByWinner: null,
      gamesWonByWinner: null,
      gamesTotal: null,
      marginNormalized: null,
      lostFirstSetWonMatch: null,
      alternatingSetWinners: sets.length === 3 ? (perSetWinner[0] !== perSetWinner[1] && perSetWinner[1] !== perSetWinner[2]) : null,
    };
    if (!match.winnerTeam) return facts;
    facts.formatKey = LevelContext.detectFormatKey(match);
    const margin = LevelContext.computeMarginScoreInputs(match, match.winnerTeam);
    facts.setsWonByWinner = margin.setsWonByWinner;
    facts.gamesWonByWinner = margin.gamesWonByWinner;
    facts.gamesTotal = margin.gamesTotal;
    facts.marginNormalized = margin.gamesTotal > 0
      ? round4(Math.abs(2 * margin.gamesWonByWinner - margin.gamesTotal) / margin.gamesTotal)
      : null;
    facts.lostFirstSetWonMatch = !!(perSetWinner[0] && perSetWinner[0] !== match.winnerTeam);
    return facts;
  }

  /* ------------------------------------------------------------------ */
  /* 3. SECUENCIA DECIDIDA — base compartida de rachas/forma/hitos        */
  /* ------------------------------------------------------------------ */

  /** Filtra `historyAsc` a los partidos con resultado definido desde la perspectiva del
   *  caller, preservando el orden ascendente. Único punto de "qué cuenta como evidencia de
   *  victoria/derrota" para rachas, forma reciente e hitos — un partido pendiente/sin
   *  consenso simplemente no aparece, nunca rompe ni extiende una racha. */
  function buildDecidedSequence(historyAsc, callerPlayerId) {
    return (historyAsc || [])
      .map((match) => ({ match, perspective: resolvePerspective(match, callerPlayerId) }))
      .filter((entry) => entry.perspective && entry.perspective.result);
  }

  /* ------------------------------------------------------------------ */
  /* 4. RACHAS — BRAMU_Intelligence.md §5.3/§6.2 ("extender/igualar/      */
  /*    marcar récord/terminar")                                          */
  /* ------------------------------------------------------------------ */

  /** Un elemento por partido decidido, alineado 1:1 con `decidedSequence`. `before`/`after`
   *  son la racha inmediatamente antes/después de ESE partido — permite detectar tanto un
   *  corte (before.type != after.type) como una extensión, sin fijar acá el umbral de "a
   *  partir de qué longitud se muestra" (eso es selección editorial, Fase C). `isRecordWin`/
   *  `isRecordLoss` son estrictos (superan el máximo previo); `tiesRecordWin`/`tiesRecordLoss`
   *  cubren el empate explícito que pide §5.2 ("iguala tu récord si no es único"). */
  function computeStreakTimeline(decidedSequence) {
    let curType = null;
    let curLength = 0;
    let bestWin = 0;
    let bestLoss = 0;
    return decidedSequence.map((entry) => {
      const before = curType ? { type: curType, length: curLength } : null;
      const bestWinBefore = bestWin;
      const bestLossBefore = bestLoss;
      const result = entry.perspective.result;
      curLength = (result === curType) ? curLength + 1 : 1;
      curType = result;
      if (curType === 'win') bestWin = Math.max(bestWin, curLength);
      else bestLoss = Math.max(bestLoss, curLength);
      const bestBeforeOfType = curType === 'win' ? bestWinBefore : bestLossBefore;
      const isRecord = curLength > bestBeforeOfType;
      const tiesRecord = !isRecord && curLength === bestBeforeOfType && bestBeforeOfType > 0;
      return {
        matchId: entry.match.matchId,
        playedAt: entry.match.playedAt,
        before,
        after: { type: curType, length: curLength },
        isRecord,
        tiesRecord,
      };
    });
  }

  /** Estado de racha vigente al final de `decidedSequence` (o `null` sin partidos decididos) +
   *  los récords absolutos de cada tipo hasta ese punto. */
  function computeCurrentStreak(decidedSequence) {
    const timeline = computeStreakTimeline(decidedSequence);
    if (!timeline.length) return { current: null, bestWinStreak: 0, bestLossStreak: 0 };
    const last = timeline[timeline.length - 1];
    const bestWinStreak = Math.max.apply(null, timeline.filter((t) => t.after.type === 'win').map((t) => t.after.length).concat(0));
    const bestLossStreak = Math.max.apply(null, timeline.filter((t) => t.after.type === 'loss').map((t) => t.after.length).concat(0));
    return { current: last.after, bestWinStreak, bestLossStreak };
  }

  /* ------------------------------------------------------------------ */
  /* 5. FORMA RECIENTE — BRAMU_Intelligence.md §5.3 (ventana de 5, contexto 10) */
  /* ------------------------------------------------------------------ */

  /** Balance exacto de los últimos `windowSize` partidos DECIDIDOS, incluido el actual (último
   *  elemento de `decidedSequence`). `sampleSize` puede ser menor que `windowSize` cuando
   *  todavía no hay suficiente historial — nunca se completa con partidos inexistentes. */
  function computeRecentForm(decidedSequence, windowSize) {
    const window = decidedSequence.slice(Math.max(0, decidedSequence.length - windowSize));
    const wins = window.filter((e) => e.perspective.result === 'win').length;
    return {
      windowSize,
      sampleSize: window.length,
      wins,
      losses: window.length - wins,
      matchIds: window.map((e) => e.match.matchId),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. HITOS ACUMULATIVOS — BRAMU_Intelligence.md §5.2                   */
  /* ------------------------------------------------------------------ */

  /** Tally corrido hasta el ÚLTIMO partido decidido de `decidedSequence` (contrato "como de
   *  ese momento", ver cabecera). `winMilestoneReached` es el número exacto de WIN_MILESTONES
   *  alcanzado POR ese partido puntual, o `null` si no coincide con ninguno — nunca se redondea
   *  ni se aproxima a "casi 50". */
  function computeMilestones(decidedSequence) {
    let wins = 0;
    let losses = 0;
    let isFirstWinEver = false;
    decidedSequence.forEach((entry, idx) => {
      const isLast = idx === decidedSequence.length - 1;
      if (entry.perspective.result === 'win') {
        wins += 1;
        if (isLast) isFirstWinEver = wins === 1;
      } else {
        losses += 1;
      }
    });
    const lastResult = decidedSequence.length ? decidedSequence[decidedSequence.length - 1].perspective.result : null;
    const winMilestoneReached = (lastResult === 'win' && WIN_MILESTONES.indexOf(wins) !== -1) ? wins : null;
    return {
      decidedMatches: decidedSequence.length,
      totalWins: wins,
      totalLosses: losses,
      isFirstDecidedMatchEver: decidedSequence.length === 1,
      isFirstWinEver,
      winMilestoneReached,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 7. RELACIONES — compañero / rival individual / pareja rival / cruce  */
  /*    exacto de parejas (BRAMU_Intelligence.md §5.4/§5.5)               */
  /* ------------------------------------------------------------------ */

  /** Recorre TODA `historyAsc` (participación, no solo decididos: "primer partido juntos"
   *  cuenta aunque siga pendiente) y agrega los partidos donde `matchesRelation` es cierto.
   *  Único agregador de relación: compañero, rival individual, pareja rival exacta y cruce
   *  exacto de parejas son la MISMA operación con un predicado distinto (ver los 4
   *  constructores debajo) — nunca cuatro copias de este bucle. */
  function computeRelationshipSummary(historyAsc, callerPlayerId, matchesRelation) {
    const entries = [];
    let wins = 0;
    let losses = 0;
    (historyAsc || []).forEach((match) => {
      const perspective = resolvePerspective(match, callerPlayerId);
      if (!perspective || !matchesRelation(match, perspective)) return;
      if (perspective.result === 'win') wins += 1;
      else if (perspective.result === 'loss') losses += 1;
      entries.push({ matchId: match.matchId, playedAt: match.playedAt, result: perspective.result });
    });
    return {
      totalMatches: entries.length,
      decidedMatches: wins + losses,
      wins,
      losses,
      firstMatchAt: entries.length ? entries[0].playedAt : null,
      isFirstEncounter: entries.length <= 1,
      matches: entries,
    };
  }

  function relationCompanion(companionPlayerId) {
    return (match, perspective) => playerIdOf(perspective.teammate) === companionPlayerId;
  }

  function relationIndividualRival(rivalPlayerId) {
    return (match, perspective) => perspective.rivals.some((r) => playerIdOf(r) === rivalPlayerId);
  }

  /** Pareja rival EXACTA (§5.5 punto 3): ambos rivales identificados y coincidentes con los 2
   *  ids dados, sin importar posición. Un slot rival sin identidad conocida ("Por identificar"/
   *  "Jugador no identificado") nunca cuenta como "esa pareja exacta" — nunca se deduplica por
   *  nombre. */
  function relationRivalPair(rivalPlayerIdA, rivalPlayerIdB) {
    const target = [rivalPlayerIdA, rivalPlayerIdB].slice().sort().join('|');
    return (match, perspective) => {
      const ids = perspective.rivals.map(playerIdOf);
      if (ids.length !== 2 || ids.some((id) => !id)) return false;
      return ids.slice().sort().join('|') === target;
    };
  }

  /** Cruce exacto de las dos parejas (§5.5 punto 4): mismo compañero propio Y misma pareja
   *  rival exacta. Más específico que `relationRivalPair` — cambiar de compañero frente a la
   *  misma pareja rival no es el mismo cruce. */
  function relationExactPairCrossing(teammatePlayerId, rivalPlayerIdA, rivalPlayerIdB) {
    const rivalPair = relationRivalPair(rivalPlayerIdA, rivalPlayerIdB);
    return (match, perspective) => playerIdOf(perspective.teammate) === teammatePlayerId && rivalPair(match, perspective);
  }

  /* ------------------------------------------------------------------ */
  /* 8. INACTIVIDAD — BRAMU_Intelligence.md §5.2 ("regreso registrado")   */
  /* ------------------------------------------------------------------ */

  /** `historyAsc` truncada hasta el partido de interés inclusive (último elemento). Umbral
   *  exacto de §5.2: excepcional si supera `máximo entre 30 días y 2 veces la mediana de
   *  separación de los últimos 10 partidos ANTERIORES`, exigiendo al menos 6 de esos previos —
   *  por debajo de esa muestra, se informa la razón sin afirmar excepcionalidad (nunca se
   *  inventa un umbral con datos insuficientes). */
  function computeInactivityGap(historyAsc) {
    if (!historyAsc || historyAsc.length < 2) {
      return { daysSincePrevious: null, isExceptional: false, reasonCodes: ['historial_insuficiente'] };
    }
    const current = historyAsc[historyAsc.length - 1];
    const previous = historyAsc[historyAsc.length - 2];
    const daysSincePrevious = round4((playedAtMs(current) - playedAtMs(previous)) / 86400000);

    const priorTen = historyAsc.slice(Math.max(0, historyAsc.length - 11), historyAsc.length - 1);
    if (priorTen.length < 6) {
      return { daysSincePrevious, isExceptional: false, reasonCodes: ['menos_de_6_partidos_previos'] };
    }
    const gaps = [];
    for (let i = 1; i < priorTen.length; i++) {
      gaps.push((playedAtMs(priorTen[i]) - playedAtMs(priorTen[i - 1])) / 86400000);
    }
    gaps.sort((a, b) => a - b);
    const mid = Math.floor(gaps.length / 2);
    const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
    const threshold = Math.max(30, 2 * median);
    return {
      daysSincePrevious,
      medianRecentGapDays: round4(median),
      threshold: round4(threshold),
      isExceptional: daysSincePrevious > threshold,
      reasonCodes: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /* 9. ORQUESTADOR — arma TODO el contexto derivado de UN partido        */
  /* ------------------------------------------------------------------ */

  /** `historyAsc` truncada hasta el partido de interés inclusive (contrato de cabecera).
   *  Devuelve la superficie completa de derivados de Fase A para ese partido puntual, desde la
   *  perspectiva de `callerPlayerId` — Fase B arma claims a partir de este objeto, nunca vuelve
   *  a leer `historyAsc` directamente. `null` si el caller no participó del último partido de
   *  `historyAsc` (uso incorrecto del contrato: el llamador siempre debe truncar hasta un
   *  partido donde participa). */
  function buildMatchDerivedContext(historyAsc, callerPlayerId) {
    if (!historyAsc || !historyAsc.length) return null;
    const currentMatch = historyAsc[historyAsc.length - 1];
    const perspective = resolvePerspective(currentMatch, callerPlayerId);
    if (!perspective) return null;

    const decidedSequence = buildDecidedSequence(historyAsc, callerPlayerId);
    const streakTimeline = computeStreakTimeline(decidedSequence);
    const isCurrentMatchDecided = perspective.result !== null;

    return {
      matchId: currentMatch.matchId,
      playedAt: currentMatch.playedAt,
      officialEligible: !!currentMatch.officialEligible,
      hidden: !!currentMatch.hidden,
      hasOpenIdentityIssue: !!currentMatch.hasOpenIdentityIssue,
      perspective,
      formatFacts: computeFormatFacts(currentMatch),
      isFirstMatchEver: historyAsc.length === 1,
      inactivity: computeInactivityGap(historyAsc),
      milestones: computeMilestones(decidedSequence),
      // `streakForThisMatch`/`recentForm*` son `null` cuando el partido actual no tiene
      // resultado definido todavía: no hay racha ni forma "posterior" a un hecho que no ocurrió.
      streakForThisMatch: isCurrentMatchDecided ? streakTimeline[streakTimeline.length - 1] : null,
      recentForm5: isCurrentMatchDecided ? computeRecentForm(decidedSequence, 5) : null,
      recentForm10: isCurrentMatchDecided ? computeRecentForm(decidedSequence, 10) : null,
      companion: perspective.teammate
        ? computeRelationshipSummary(historyAsc, callerPlayerId, relationCompanion(playerIdOf(perspective.teammate)))
        : null,
      rivalsIndividual: perspective.rivals.map((rival) => (
        playerIdOf(rival)
          ? { playerId: playerIdOf(rival), summary: computeRelationshipSummary(historyAsc, callerPlayerId, relationIndividualRival(playerIdOf(rival))) }
          : null
      )),
      rivalPair: (perspective.rivals.length === 2 && perspective.rivals.every(playerIdOf))
        ? computeRelationshipSummary(historyAsc, callerPlayerId, relationRivalPair(playerIdOf(perspective.rivals[0]), playerIdOf(perspective.rivals[1])))
        : null,
      exactPairCrossing: (perspective.teammate && perspective.rivals.length === 2 && perspective.rivals.every(playerIdOf))
        ? computeRelationshipSummary(historyAsc, callerPlayerId, relationExactPairCrossing(playerIdOf(perspective.teammate), playerIdOf(perspective.rivals[0]), playerIdOf(perspective.rivals[1])))
        : null,
    };
  }

  global.PLIntelligenceContext = {
    WIN_MILESTONES,
    normalizeIntelligenceHistoryRow,
    translateForIntelligence,
    buildPersonalHistory,
    resolvePerspective,
    computeFormatFacts,
    buildDecidedSequence,
    computeStreakTimeline,
    computeCurrentStreak,
    computeRecentForm,
    computeMilestones,
    computeRelationshipSummary,
    relationCompanion,
    relationIndividualRival,
    relationRivalPair,
    relationExactPairCrossing,
    computeInactivityGap,
    buildMatchDerivedContext,
  };
})(typeof window !== 'undefined' ? window : globalThis);
