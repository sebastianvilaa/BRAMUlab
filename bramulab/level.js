/* ==========================================================================
   BRAMU Lab — level.js (BRAMUlab_V04.1, Etapa A)
   Motor puro y determinístico de Nivel BRAMU V1 — fórmula normativa cerrada en
   docs/BRAMUlab/Nivel_BRAMU_Formula_V1.4.md (fuente de todo número/parámetro
   de este archivo), secuencia técnica en docs/BRAMUlab/Nivel_BRAMU_Implementacion.md.
   Mismo criterio que engine.js/stats.js/groups.js: cero DOM, cero localStorage
   — recibe objetos de entrada ya armados y devuelve objetos de salida, nunca
   lee ni escribe Store.

   ALCANCE DE ETAPA A (BRAMUlab_V04_Consolidado.md §4/§8, confirmado por
   Sebastián al autorizar V04.1): este módulo implementa las funciones
   MATEMÁTICAS puras de la fórmula V1 — nivel efectivo, fuerza de pareja,
   expectativa, margen, factores, K, confianza/evidencia, decay por
   inactividad, clamps y auditoría. NO resuelve la integración histórica real
   que determina elegibilidad, invitados, repetición, compañero o círculo
   competitivo cerrado a partir del historial de partidos — esos VALORES
   llegan como parámetros de entrada ya calculados por quien llame a este
   módulo (repetitionFactor/companionFactor/circleFactors/knownLevelsCount).
   Detectar esos valores a partir de partidos reales es trabajo de Etapa B.

   NIVEL_BRAMU_V1_ENABLED queda en `false` a propósito y es una CONSTANTE DE
   CÓDIGO, no una clave de Store ni un toggle expuesto en ninguna pantalla
   (BRAMUlab_V04_Informe.md §4.6): activarlo alguna vez es un cambio de una
   sola línea, explícito y revisable en un commit, nunca un estado que pueda
   quedar prendido por accidente en el dispositivo de alguien. Este archivo
   NO se carga desde index.html/sw.js — solo desde tests.html (arnés de
   pruebas). El Nivel provisional simulado de V03 (player-home.js:
   LEVEL_BASE/computeLevelDeltaForMatch/computeLevelEvolution) sigue siendo
   el único que ve la UI — este archivo no lo reemplaza ni lo toca.
   ========================================================================== */
(function (global) {
  'use strict';

  const ALGORITHM_VERSION = 'nivel_bramu_v1_0';
  const NIVEL_BRAMU_V1_ENABLED = false;

  /** Estados de un jugador (Formula_V1.4 §2) — nombres de código para los 4 valores del
   *  enum documentado, para no repetir strings sueltos en cada call site. */
  const STATES = {
    NONE: 'sin_estimacion',
    CALIBRATING: 'calibrando',
    CALIBRATED: 'calibrado',
    RECALIBRATING: 'recalibrando',
  };

  /* ------------------------------------------------------------------ */
  /* PARÁMETROS V1 — un único objeto centralizado (Consolidado §5 "Ubicación
   * de parámetros"). Cada valor cita la sección de Nivel_BRAMU_Formula_V1.4.md
   * de la que sale. Cualquier cambio de valor acá es, por definición, una
   * versión nueva del algoritmo — nunca se pisa silenciosamente un resultado
   * histórico ya calculado con otra versión. */
  /* ------------------------------------------------------------------ */
  const PARAMS = Object.freeze({
    // §2 — escala pública y precisión.
    SCALE_MIN: 1.0,
    SCALE_MAX: 10.0,
    INTERNAL_DECIMALS: 4,
    PUBLIC_DECIMALS: 1,

    // §4.1 — mu_efectivo = 5 + confidence × (mu − 5).
    EFFECTIVE_LEVEL_CENTER: 5.0,

    // §5 — P(A) = 1 / (1 + 10^(−(fuerza_A − fuerza_B) / divisor)).
    EXPECTATION_DIVISOR: 1.5,

    // §6.1 — dominio = 0.45×share_sets + 0.55×share_games; margen 0.90–1.15.
    MARGIN_WEIGHT_SETS: 0.45,
    MARGIN_WEIGHT_GAMES: 0.55,
    MARGIN_DOMINANCE_FLOOR: 0.55,
    MARGIN_DOMINANCE_SPAN: 0.35,
    MARGIN_MIN: 0.90,
    MARGIN_MAX: 1.15,

    // §7 — peso del formato.
    FORMAT_FACTORS: Object.freeze({
      bestOf3: 1.00,                  // Mejor de tres sets completos
      twoSetsPlusMatchTiebreak: 0.90, // Dos sets completos + match tie-break
      miniSets: 0.80,                 // Mini sets a cuatro games
      shortSingleSet: 0.65,           // Set único / pro set corto
      incomplete: 0.00,               // Incompleto, abandono o walkover
    }),

    // §8 — repetición de rivales (misma pareja / rivales individuales) y de compañero.
    REPETITION_PAIR_WEIGHT: 0.10,
    REPETITION_INDIVIDUAL_WEIGHT: 0.025,
    REPETITION_FLOOR: 0.45,
    COMPANION_WEIGHT: 0.05,
    COMPANION_FLOOR: 0.60,

    // §8.1 — círculo competitivo cerrado: la DETECCIÓN es Etapa B, acá solo el factor.
    CIRCLE_FACTOR_CLOSED: 0.45,
    CIRCLE_FACTOR_OPEN: 1.00,

    // §13 — disponibilidad según niveles conocidos en cancha (4/4, 3/4, 2/4 uno por pareja).
    AVAILABILITY_FACTORS: Object.freeze({ 4: 1.00, 3: 0.80, 2: 0.60 }),

    // §9 — K individual y factor de confianza de la pareja rival.
    K_BASE: 0.10,
    K_CONFIDENCE_WEIGHT: 0.30,
    OPPONENT_FACTOR_BASE: 0.55,
    OPPONENT_FACTOR_WEIGHT: 0.45,

    // §9 — topes de delta por partido, según estado del jugador.
    DELTA_CAP_CALIBRATING_OR_RECALIBRATING: 0.50,
    DELTA_CAP_CALIBRATED: 0.35,

    // §2/§10.2 — rango y techo de confiabilidad, orígenes de confianza inicial (§3.2).
    CONFIDENCE_MIN: 0.00,
    CONFIDENCE_MAX: 0.95,
    CONFIDENCE_ORIGIN_QUESTIONNAIRE_FULL: 0.15,
    CONFIDENCE_ORIGIN_QUESTIONNAIRE_QUICK: 0.10,
    CONFIDENCE_EVIDENCE_DIVISOR: 5.5,

    // §10.3 — inactividad: gracia, semivida y piso de confianza efectiva.
    INACTIVITY_GRACE_DAYS: 60,
    INACTIVITY_HALFLIFE_DAYS: 240,
    INACTIVITY_CONFIDENCE_FLOOR: 0.15,
  });

  /* ------------------------------------------------------------------ */
  /* UTILIDADES NUMÉRICAS — redondeo interno (4 decimales) vs. público (1
   * decimal), siempre separados: el motor nunca redondea a 1 decimal para
   * seguir calculando, solo para mostrar (Formula_V1.4 §2, Consolidado §5). */
  /* ------------------------------------------------------------------ */
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function roundTo(n, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  }

  function roundInternal(n) { return roundTo(n, PARAMS.INTERNAL_DECIMALS); }

  /** Único punto de redondeo a 1 decimal para mostrar — nunca usado dentro del
   *  propio pipeline de cálculo (Consolidado §5: "precisión interna separada
   *  de redondeo público"). Normaliza `-0` a `0` (nunca "-0.0" en pantalla). */
  function roundPublicLevel(mu) {
    const r = roundTo(mu, PARAMS.PUBLIC_DECIMALS);
    return r === 0 ? 0 : r;
  }

  function clampLevel(mu) { return roundInternal(clamp(mu, PARAMS.SCALE_MIN, PARAMS.SCALE_MAX)); }

  /* ------------------------------------------------------------------ */
  /* §4 — NIVEL EFECTIVO Y FUERZA DE PAREJA                               */
  /* ------------------------------------------------------------------ */

  /** §4.1 — mu_efectivo = 5 + confidence×(mu−5): retrae un nivel poco confiable
   *  hacia el centro de la escala para que una autoevaluación todavía débil no
   *  defina con exceso de seguridad la dificultad del partido. */
  function computeEffectiveLevel(mu, confidence) {
    const c = clamp(confidence, PARAMS.CONFIDENCE_MIN, PARAMS.CONFIDENCE_MAX);
    return roundInternal(PARAMS.EFFECTIVE_LEVEL_CENTER + c * (mu - PARAMS.EFFECTIVE_LEVEL_CENTER));
  }

  /** §4.2 — fuerza_pareja = promedio simple de los dos niveles efectivos. */
  function computePairStrength(effectiveLevelA, effectiveLevelB) {
    return roundInternal((effectiveLevelA + effectiveLevelB) / 2);
  }

  /* ------------------------------------------------------------------ */
  /* §5 — EXPECTATIVA PREVIA                                              */
  /* ------------------------------------------------------------------ */

  /** P(pareja con `strengthSelf`) frente a una pareja con `strengthRival`. Complementaria
   *  por construcción: computeExpectation(a,b) + computeExpectation(b,a) = 1 (salvo el
   *  redondeo interno de cada llamada por separado — para garantizar complementariedad
   *  EXACTA en una salida compuesta, calcular una sola vez y usar `1 − expectativa` para
   *  la pareja rival, como hace computeMatchUpdate más abajo). */
  function computeExpectation(strengthSelf, strengthRival) {
    const diff = strengthSelf - strengthRival;
    return roundInternal(1 / (1 + Math.pow(10, -diff / PARAMS.EXPECTATION_DIVISOR)));
  }

  /* ------------------------------------------------------------------ */
  /* §6 — INFLUENCIA DEL SCORE (MARGEN)                                   */
  /* ------------------------------------------------------------------ */

  /** §6.1 — multiplicador de margen a partir del dominio de la pareja GANADORA.
   *  `setsWonByWinner`/`setsPlayed`/`gamesWonByWinner`/`gamesTotal` ya deben venir
   *  calculados por quien llama (Etapa B): los puntos de un match tie-break NUNCA se
   *  cuentan como games (§6.1) — ese criterio de conteo es responsabilidad del llamador,
   *  esta función solo aplica la fórmula sobre los 4 números ya armados. */
  function computeMarginMultiplier(setsWonByWinner, setsPlayed, gamesWonByWinner, gamesTotal) {
    const shareSets = setsPlayed > 0 ? setsWonByWinner / setsPlayed : 0;
    const shareGames = gamesTotal > 0 ? gamesWonByWinner / gamesTotal : 0;
    const dominance = PARAMS.MARGIN_WEIGHT_SETS * shareSets + PARAMS.MARGIN_WEIGHT_GAMES * shareGames;
    const t = clamp((dominance - PARAMS.MARGIN_DOMINANCE_FLOOR) / PARAMS.MARGIN_DOMINANCE_SPAN, 0, 1);
    return roundInternal(PARAMS.MARGIN_MIN + (PARAMS.MARGIN_MAX - PARAMS.MARGIN_MIN) * t);
  }

  /* ------------------------------------------------------------------ */
  /* §7/§8/§8.1/§13 — FACTORES                                            */
  /* ------------------------------------------------------------------ */

  /** §7 — peso del formato. `formatKey` es una de las claves de PARAMS.FORMAT_FACTORS;
   *  cualquier otra devuelve 0 (mismo tratamiento que "incompleto/abandono/walkover" —
   *  nunca inventa un peso para un formato no reconocido). */
  function computeFormatFactor(formatKey) {
    return Object.prototype.hasOwnProperty.call(PARAMS.FORMAT_FACTORS, formatKey)
      ? PARAMS.FORMAT_FACTORS[formatKey] : 0;
  }

  /** §8 — factor_repeticion = max(piso, 1 − 0.10×n_pair − 0.025×(n_r1+n_r2)). Los 3
   *  contadores (partidos previos contra esa pareja / contra cada rival individual en
   *  los últimos 180 días) los calcula Etapa B a partir del historial real — acá solo
   *  se aplica la fórmula sobre los números ya contados. */
  function computeRepetitionFactor(nPair, nRivalIndividual1, nRivalIndividual2) {
    const raw = 1
      - PARAMS.REPETITION_PAIR_WEIGHT * nPair
      - PARAMS.REPETITION_INDIVIDUAL_WEIGHT * (nRivalIndividual1 + nRivalIndividual2);
    return roundInternal(Math.max(PARAMS.REPETITION_FLOOR, raw));
  }

  /** §8 — factor_companero = max(piso, 1 − 0.05×n_companero). */
  function computeCompanionFactor(nMatchesWithSameCompanion) {
    return roundInternal(Math.max(PARAMS.COMPANION_FLOOR, 1 - PARAMS.COMPANION_WEIGHT * nMatchesWithSameCompanion));
  }

  /** §8.1 — factor de círculo competitivo cerrado. La detección de "¿este jugador está
   *  en un círculo cerrado ahora mismo?" (20+ partidos, 80% concentrados en ≤11
   *  coparticipantes, amplitud ≤1.5, rival dentro del círculo) es Etapa B — acá solo se
   *  aplica el factor una vez que ese booleano ya se decidió. */
  function computeCircleFactor(isClosedCircleForPlayer) {
    return isClosedCircleForPlayer ? PARAMS.CIRCLE_FACTOR_CLOSED : PARAMS.CIRCLE_FACTOR_OPEN;
  }

  /** §13 — disponibilidad según cuántos de los 4 participantes tienen nivel conocido.
   *  Cualquier valor fuera de {4,3,2} (ej. 1, 0, o un partido que directamente no
   *  computa por regla de elegibilidad) devuelve 0 — nunca inventa un factor. */
  function computeAvailabilityFactor(knownLevelsCount) {
    return Object.prototype.hasOwnProperty.call(PARAMS.AVAILABILITY_FACTORS, knownLevelsCount)
      ? PARAMS.AVAILABILITY_FACTORS[knownLevelsCount] : 0;
  }

  /* ------------------------------------------------------------------ */
  /* §9 — VARIACIÓN INDIVIDUAL (K, FACTOR DE OPONENTE, DELTA, TOPES)      */
  /* ------------------------------------------------------------------ */

  /** §9 — K_i = 0.10 + 0.30×(1 − confidence_i): más K cuanto menos evidencia sostiene
   *  el nivel del propio jugador. */
  function computeK(confidence) {
    const c = clamp(confidence, PARAMS.CONFIDENCE_MIN, PARAMS.CONFIDENCE_MAX);
    return roundInternal(PARAMS.K_BASE + PARAMS.K_CONFIDENCE_WEIGHT * (1 - c));
  }

  /** §9 — factor_oponente = 0.55 + 0.45×confianza_pareja_rival (promedio de la pareja
   *  rival, ya calculado por el llamador). */
  function computeOpponentFactor(rivalPairConfidenceAvg) {
    return roundInternal(PARAMS.OPPONENT_FACTOR_BASE + PARAMS.OPPONENT_FACTOR_WEIGHT * rivalPairConfidenceAvg);
  }

  /** §9 — tope de delta por partido: ±0.50 en CALIBRANDO/RECALIBRANDO, ±0.35 en
   *  CALIBRADO. Cualquier estado que no sea exactamente CALIBRATED usa el tope más
   *  amplio (nunca al revés — un estado desconocido/sin-estimación no debería llegar acá,
   *  pero si llega, el tope más conservador para el jugador que "más puede moverse" es
   *  el correcto por defecto). */
  function deltaCapForState(state) {
    return state === STATES.CALIBRATED ? PARAMS.DELTA_CAP_CALIBRATED : PARAMS.DELTA_CAP_CALIBRATING_OR_RECALIBRATING;
  }

  /** §9 — delta_i = K_i × (resultado − expectativa) × margen × formato × repetición ×
   *  compañero × círculo × disponibilidad × factor_oponente, clampeado al tope de su
   *  estado. `result` es 1 (ganó) o 0 (perdió) — nunca otro valor: el signo de
   *  (resultado − expectativa) es lo único que puede volver negativo el delta, y solo
   *  cuando `result` es 0, así que una victoria (result=1, expectativa siempre < 1)
   *  jamás produce delta negativo, y una derrota (result=0, expectativa siempre > 0)
   *  jamás produce delta positivo — garantizado por construcción mientras todos los
   *  demás factores permanezcan ≥ 0 (ver PARAMS, todos los pisos son positivos). */
  function computePlayerDelta(input) {
    const k = computeK(input.confidence);
    const opponentFactor = computeOpponentFactor(input.rivalPairConfidenceAvg);
    const rawDelta = k * (input.result - input.expectation) * input.margin * input.formatFactor
      * input.repetitionFactor * input.companionFactor * input.circleFactor
      * input.availabilityFactor * opponentFactor;
    const cap = deltaCapForState(input.state);
    const cappedDelta = clamp(rawDelta, -cap, cap);
    return {
      k,
      opponentFactor,
      cap,
      deltaRaw: roundInternal(rawDelta),
      deltaCapped: roundInternal(cappedDelta),
    };
  }

  /* ------------------------------------------------------------------ */
  /* §10 — CONFIABILIDAD (EVIDENCIA Y ACTUALIZACIÓN DE CONFIANZA)         */
  /* ------------------------------------------------------------------ */

  /** §10.1 — calidad_evidencia = formato×repetición×compañero×círculo×disponibilidad×
   *  (0.55+0.45×confianza_pareja_rival). Mismos factores que ya entraron al delta, sin
   *  K ni margen ni resultado — la evidencia se gana jugando, gane o pierda el jugador. */
  function computeEvidenceQuality(input) {
    const opponentFactor = computeOpponentFactor(input.rivalPairConfidenceAvg);
    return roundInternal(
      input.formatFactor * input.repetitionFactor * input.companionFactor
      * input.circleFactor * input.availabilityFactor * opponentFactor
    );
  }

  /** §10.2 — confidence = b + (0.95−b)×(1−exp(−evidence_units/5.5)). `originConfidence`
   *  es `b`: 0.15 para cuestionario completo, 0.10 para camino rápido (§3.2). */
  function computeConfidenceFromEvidence(evidenceUnits, originConfidence) {
    return roundInternal(
      originConfidence + (PARAMS.CONFIDENCE_MAX - originConfidence) * (1 - Math.exp(-evidenceUnits / PARAMS.CONFIDENCE_EVIDENCE_DIVISOR))
    );
  }

  /** §10.2 — forma incremental equivalente, útil partido a partido: confidence_post =
   *  confidence_pre + (0.95−confidence_pre)×(1−exp(−calidad_evidencia/5.5)). */
  function computeConfidenceAfterMatch(confidenceBefore, evidenceQuality) {
    return roundInternal(
      confidenceBefore + (PARAMS.CONFIDENCE_MAX - confidenceBefore) * (1 - Math.exp(-evidenceQuality / PARAMS.CONFIDENCE_EVIDENCE_DIVISOR))
    );
  }

  /** §10.3 — sin cambios los primeros 60 días sin actividad computable; después,
   *  confidence_efectiva = max(0.15, confidence × 2^(−(días_inactivo−60)/240)). El nivel
   *  (`mu`) NUNCA se toca acá — solo la confianza efectiva usada en el próximo cálculo. */
  function computeEffectiveConfidenceAfterInactivity(confidence, daysInactive) {
    if (daysInactive <= PARAMS.INACTIVITY_GRACE_DAYS) return roundInternal(confidence);
    const decayed = confidence * Math.pow(2, -(daysInactive - PARAMS.INACTIVITY_GRACE_DAYS) / PARAMS.INACTIVITY_HALFLIFE_DAYS);
    return roundInternal(Math.max(PARAMS.INACTIVITY_CONFIDENCE_FLOOR, decayed));
  }

  /* ------------------------------------------------------------------ */
  /* MOTOR COMPUESTO — UN partido, los 4 jugadores, salida auditable       */
  /* completa (Formula_V1.4 §19 / Implementacion.md §4). Compone las       */
  /* funciones puras de arriba; no agrega ninguna regla nueva.             */
  /* ------------------------------------------------------------------ */

  function normalizeZero(n) { return n === 0 ? 0 : n; }

  function pushReasonCodeOnce(list, code) {
    if (list.indexOf(code) === -1) list.push(code);
  }

  /** `input` (ver docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md §4.4 para
   *  el contrato documentado):
   *  {
   *    algorithmVersion?: string,
   *    matchId: string,
   *    teamA: { players: [{id,mu,confidence,state}, {id,mu,confidence,state}],
   *             repetitionFactor, companionFactor, circleFactors: [bool,bool] },
   *    teamB: { ...misma forma... },
   *    winnerTeam: 'A' | 'B',
   *    score: { setsWonByWinner, setsPlayed, gamesWonByWinner, gamesTotal },
   *    formatKey: string,
   *    knownLevelsCount: 4 | 3 | 2,
   *  }
   *  `repetitionFactor`/`companionFactor` son valores YA CALCULADOS por equipo (Etapa B);
   *  `circleFactors` son booleanos YA DECIDIDOS por jugador (Etapa B). Etapa A no deriva
   *  ninguno de los tres desde el historial — ver cabecera del archivo. */
  function computeMatchUpdate(input) {
    const algorithmVersion = input.algorithmVersion || ALGORITHM_VERSION;
    const teams = { A: input.teamA, B: input.teamB };

    const effectiveLevels = {};
    const teamStrength = {};
    ['A', 'B'].forEach((teamKey) => {
      effectiveLevels[teamKey] = teams[teamKey].players.map((p) => computeEffectiveLevel(p.mu, p.confidence));
      teamStrength[teamKey] = computePairStrength(effectiveLevels[teamKey][0], effectiveLevels[teamKey][1]);
    });

    // Complementariedad EXACTA (§5): se calcula una sola vez y B = 1 − A, nunca dos
    // llamadas redondeadas por separado que podrían no sumar 1 por el redondeo interno.
    const expectationA = computeExpectation(teamStrength.A, teamStrength.B);
    const expectation = { A: expectationA, B: roundInternal(1 - expectationA) };

    const margin = computeMarginMultiplier(
      input.score.setsWonByWinner, input.score.setsPlayed,
      input.score.gamesWonByWinner, input.score.gamesTotal
    );
    const formatFactor = computeFormatFactor(input.formatKey);
    const availabilityFactor = computeAvailabilityFactor(input.knownLevelsCount);

    const rivalPairConfidenceAvg = {
      A: roundInternal((teams.B.players[0].confidence + teams.B.players[1].confidence) / 2),
      B: roundInternal((teams.A.players[0].confidence + teams.A.players[1].confidence) / 2),
    };

    const reasonCodes = [];
    const winnerExpectation = expectation[input.winnerTeam];
    const surprise = Math.abs(1 - winnerExpectation);
    if (surprise >= 0.50) pushReasonCodeOnce(reasonCodes, 'sorpresa_por_dificultad');
    else if (surprise <= 0.15) pushReasonCodeOnce(reasonCodes, 'resultado_esperado');
    if (margin >= PARAMS.MARGIN_MAX) pushReasonCodeOnce(reasonCodes, 'margen_amplio');
    else if (margin <= PARAMS.MARGIN_MIN) pushReasonCodeOnce(reasonCodes, 'margen_cerrado');
    if (formatFactor < 1) pushReasonCodeOnce(reasonCodes, 'formato_reducido');
    if (availabilityFactor < 1) pushReasonCodeOnce(reasonCodes, 'disponibilidad_reducida');

    const players = {};
    ['A', 'B'].forEach((teamKey) => {
      const team = teams[teamKey];
      const result = input.winnerTeam === teamKey ? 1 : 0;
      team.players.forEach((p, idx) => {
        const circleFactor = computeCircleFactor(!!(team.circleFactors && team.circleFactors[idx]));
        if (team.repetitionFactor < 1 || team.companionFactor < 1) pushReasonCodeOnce(reasonCodes, 'repeticion_de_rivales');
        if (circleFactor < 1) pushReasonCodeOnce(reasonCodes, 'circulo_competitivo_cerrado');
        if (p.confidence < 0.45 || p.state !== STATES.CALIBRATED) pushReasonCodeOnce(reasonCodes, 'baja_confiabilidad');

        const deltaInput = {
          confidence: p.confidence,
          result,
          expectation: expectation[teamKey],
          margin,
          formatFactor,
          repetitionFactor: team.repetitionFactor,
          companionFactor: team.companionFactor,
          circleFactor,
          availabilityFactor,
          rivalPairConfidenceAvg: rivalPairConfidenceAvg[teamKey],
          state: p.state,
        };
        const deltaResult = computePlayerDelta(deltaInput);
        const evidenceQuality = computeEvidenceQuality({
          formatFactor,
          repetitionFactor: team.repetitionFactor,
          companionFactor: team.companionFactor,
          circleFactor,
          availabilityFactor,
          rivalPairConfidenceAvg: rivalPairConfidenceAvg[teamKey],
        });
        const muAfter = clampLevel(p.mu + deltaResult.deltaCapped);
        const confidenceAfter = computeConfidenceAfterMatch(p.confidence, evidenceQuality);

        players[p.id] = {
          team: teamKey,
          muBefore: p.mu,
          confidenceBefore: p.confidence,
          effectiveLevel: effectiveLevels[teamKey][idx],
          k: deltaResult.k,
          opponentFactor: deltaResult.opponentFactor,
          circleFactor,
          deltaRaw: deltaResult.deltaRaw,
          deltaCapped: deltaResult.deltaCapped,
          capApplied: deltaResult.deltaRaw !== deltaResult.deltaCapped,
          deltaPublic: normalizeZero(roundPublicLevel(deltaResult.deltaCapped)),
          evidenceQuality,
          muAfter,
          muAfterPublic: roundPublicLevel(muAfter),
          confidenceAfter,
        };
      });
    });

    return {
      algorithmVersion,
      matchId: input.matchId,
      teamStrength,
      expectation,
      margin,
      formatFactor,
      availabilityFactor,
      rivalPairConfidenceAvg,
      reasonCodes,
      players,
    };
  }

  global.PLLevel = {
    ALGORITHM_VERSION,
    NIVEL_BRAMU_V1_ENABLED,
    STATES,
    PARAMS,
    roundPublicLevel,
    clampLevel,
    computeEffectiveLevel,
    computePairStrength,
    computeExpectation,
    computeMarginMultiplier,
    computeFormatFactor,
    computeRepetitionFactor,
    computeCompanionFactor,
    computeCircleFactor,
    computeAvailabilityFactor,
    computeK,
    computeOpponentFactor,
    deltaCapForState,
    computePlayerDelta,
    computeEvidenceQuality,
    computeConfidenceFromEvidence,
    computeConfidenceAfterMatch,
    computeEffectiveConfidenceAfterInactivity,
    computeMatchUpdate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
