/* ==========================================================================
   BRAMU Lab — level-calibration.js (BRAMUlab_V04.6, Etapa C — estimador
   inicial V1.1 reemplaza al V1.4 de V04.3)
   Ciclo de vida puro del Nivel BRAMU de UN jugador: cuestionario inicial
   (completo y rápido) con categoría como último paso, ajuste automático por
   categoría, estado CALIBRANDO, transición a CALIBRADO, recalibración cada 90
   días. Cero DOM, cero localStorage — mismo criterio que level.js/
   level-context.js. Reutiliza `Level.STATES`, `Level.ALGORITHM_VERSION`,
   `Level.PARAMS.CONFIDENCE_ORIGIN_QUESTIONNAIRE_QUICK` (§3.4: el camino
   rápido sigue siendo 0.10, valor YA cerrado en level.js — nunca se duplica)
   y `Level.clampLevel` — nunca duplica una fórmula ya cerrada en `level.js`.

   ALCANCE DE V04.6 (autorización de Sebastián sobre V04.1-V04.5 ya
   cerradas, ver Nivel_BRAMU_Handoff_Cuestionario_V1.5.md y
   BRAMUlab_V04.6_Handoff.md): SUSTITUYE únicamente el estimador inicial
   (cuestionario + ajuste) de V1.4 por V1.1. CONSERVA íntegro el resto de esta
   Etapa C ya cerrado en V04.3: calibración (§5) y recalibración (§6) — ni una
   fórmula, ni un umbral, ni una función de esos bloques cambia. NO conecta
   con `store.js`, `app.js`, `player-home.js` ni `ranking.js` — quien integre
   esto en producción decide de dónde vienen esos parámetros. NO diseña ni
   conecta UI.

   FUENTES (en este orden de precedencia):
   1. Nivel_BRAMU_Formula_V1.5.md §3 (estimador inicial V1.1), §11 (recalibración).
   2. Nivel_BRAMU_Handoff_Cuestionario_V1.5.md
   3. BRAMUlab_V04.6_Handoff.md
   4. Nivel_BRAMU_Implementacion.md / Nivel_BRAMU.md, solo donde no contradicen.
   Nivel_BRAMU_Formula_V1.4.md §§3.1-3.7 queda como antecedente histórico — NO
   se usa para altas nuevas (ver BRAMUlab_V04_Consolidado.md).
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;

  const DAY_MS = 86400000;

  function round4(n) { return Math.round(n * 10000) / 10000; }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function findByKey(list, key) { return list.find((o) => o.key === key) || null; }

  const QUESTIONNAIRE_VERSION = 'nivel_inicial_v1_1';

  /* ------------------------------------------------------------------ */
  /* PARÁMETROS — citan su sección de Nivel_BRAMU_Formula_V1.5.md.        */
  /* ------------------------------------------------------------------ */
  const PARAMS = Object.freeze({
    // §3.7 — rango final del nivel inicial (antes y después del ajuste por categoría).
    ADJUSTED_LEVEL_MIN: 1.0,
    ADJUSTED_LEVEL_MAX: 9.0,
    // §3.3 — ajuste único permitido, automático (nunca manual desde V1.1).
    ADJUSTMENT_MAX_ABS: 0.5,
    // §3.2 — pesos de nivel_base = 0.65×autoevaluación + 0.35×técnica.
    BASE_WEIGHT_AUTOEVALUACION: 0.65,
    BASE_WEIGHT_TECNICA: 0.35,
    // §3.3 — peso de acercamiento hacia la referencia de categoría.
    CATEGORY_ADJUSTMENT_WEIGHT: 0.70,
    // §3.4 — brecha de coherencia a partir de la cual se ofrece revisión.
    COHERENCE_GAP_THRESHOLD: 2.0,
    // §10.2 — transición CALIBRANDO -> CALIBRADO (sin cambios desde V04.3).
    CALIBRATION_MIN_MATCHES: 5,
    CALIBRATION_MIN_DISTINCT_RIVALS: 3,
    // §11.1/§11.3 — recalibración (sin cambios desde V04.3).
    RECALIBRATION_COOLDOWN_DAYS: 90,
    RECALIBRATION_CLOSE_MIN_MATCHES: 3,
    RECALIBRATION_CLOSE_MIN_DISTINCT_RIVALS: 2,
    RECALIBRATION_WINDOW_MAX_DAYS: 120,
    // §11.2 — ancla provisional y confianza provisional (sin cambios desde V04.3).
    RECALIBRATION_MU_WEIGHT_PREVIOUS: 0.75,
    RECALIBRATION_MU_WEIGHT_NEW: 0.25,
    RECALIBRATION_MU_MAX_SHIFT: 0.5,
    RECALIBRATION_CONFIDENCE_FLOOR: 0.30,
    RECALIBRATION_CONFIDENCE_CEILING: 0.70,
    RECALIBRATION_CONFIDENCE_WEIGHT: 0.75,
  });

  /* ------------------------------------------------------------------ */
  /* 1. ANCLAS Y MODIFICADORES DEL ESTIMADOR INICIAL (§3.2).               */
  /* ------------------------------------------------------------------ */

  // Autoevaluación general — compartida por el cuestionario completo (pregunta 1) y el
  // camino rápido (única pregunta). La etiqueta superior es "Profesional" desde V1.1
  // (V1.4 decía "Competición" — Consolidado §"V04.6").
  const ANCHOR_AUTOEVALUACION = Object.freeze([
    { key: 'iniciacion', label: 'Iniciación', value: 2.0 },
    { key: 'intermedio', label: 'Intermedio', value: 4.0 },
    { key: 'intermedio_alto', label: 'Intermedio alto', value: 5.5 },
    { key: 'avanzado', label: 'Avanzado', value: 7.0 },
    { key: 'profesional', label: 'Profesional', value: 8.5 },
  ]);

  // Escala técnica común de red/paredes — el usuario nunca ve estos valores, solo las
  // descripciones de cada opción (ver app.js).
  const ANCHOR_TECNICA = Object.freeze([
    { key: 'a', value: 1.0 },
    { key: 'b', value: 3.0 },
    { key: 'c', value: 5.0 },
    { key: 'd', value: 6.5 },
    { key: 'e', value: 8.5 },
  ]);

  const TRAINING_MODIFIERS = Object.freeze([
    { key: 'nunca', label: 'Nunca tomé clases', value: 0.00 },
    { key: 'aisladas', label: 'Hice clases o clínicas aisladas', value: 0.02 },
    { key: 'sin_continuidad', label: 'Tomo clases de vez en cuando, sin continuidad', value: 0.05 },
    { key: 'regular_pasado', label: 'Entrené regularmente durante una etapa, aunque hoy no entreno', value: 0.08 },
    { key: 'regular_actual', label: 'Entreno con regularidad actualmente', value: 0.10 },
  ]);

  // §3.3 — describe el rendimiento DENTRO de la categoría habitual, nunca de forma aislada.
  const COMPETITION_MODIFIERS = Object.freeze([
    { key: 'no_compito', label: 'No compito', value: 0.00 },
    { key: 'sin_referencia', label: 'Competí pocas veces y no tengo una referencia clara', value: 0.00 },
    { key: 'dificil', label: 'Suelo tener partidos difíciles o quedar eliminado en primeras rondas', value: -0.15 },
    { key: 'parejo', label: 'Tengo partidos parejos y algunas veces avanzo', value: 0.10 },
    { key: 'finales', label: 'Suelo llegar a cuartos, semifinales o finales', value: 0.20 },
  ]);

  // §3.4 — puntos de contexto que alimentan la confianza de origen del cuestionario completo.
  const YEARS_POINTS = Object.freeze([
    { key: 'menos_1', label: 'Menos de un año jugando', points: 0 },
    { key: 'uno_a_cinco', label: 'Entre uno y cinco años', points: 1 },
    { key: 'mas_5', label: 'Más de cinco años', points: 2 },
  ]);
  const FREQUENCY_POINTS = Object.freeze([
    { key: 'esporadico', label: 'Juego esporádicamente o muy poco', points: 0 },
    { key: 'una_a_tres_mes', label: 'Entre una y tres veces por mes', points: 1 },
    { key: 'una_dos_semana', label: 'Una o dos veces por semana', points: 2 },
    { key: 'tres_mas_semana', label: 'Tres veces por semana o más', points: 2 },
  ]);
  // §3.4 — 0-1 -> 0.12, 2-3 -> 0.15, 4-5 -> 0.18 (categoría con mapa compatible aporta +1).
  const CONFIDENCE_ORIGIN_TIERS = Object.freeze([
    { max: 1, value: 0.12 },
    { max: 3, value: 0.15 },
    { max: 5, value: 0.18 },
  ]);
  // §3.4/§3.6 — camino rápido conserva 0.10 SIEMPRE, con o sin categoría. Reutiliza el valor
  // ya cerrado en level.js (nunca lo duplica como número suelto acá).
  const CONFIDENCE_ORIGIN_QUICK = Level.PARAMS.CONFIDENCE_ORIGIN_QUESTIONNAIRE_QUICK;
  // §3.4 — ante brecha de coherencia confirmada sin revisar, la confianza queda limitada acá.
  const CONFIDENCE_ORIGIN_COHERENCE_REVIEWED = 0.10;

  // §3.3 — configuración VERSIONADA de anclas locales de categoría. Activa por ahora solo el
  // piloto argentino masculino ("ar_masculino_v1") — cualquier otro contexto queda sin mapa
  // compatible (categoryAdjustment = 0, ver `computeCategoryAdjustment`). Claves = mismas 9
  // categorías que ya usa `declaredCategory` en app.js (CATEGORY_LABELS).
  const CATEGORY_CONTEXT_MAPS = Object.freeze({
    ar_masculino_v1: Object.freeze({
      '1': 8.4, '2': 7.7, '3': 6.9, '4': 6.1, '5': 5.5, '6': 4.8, '7': 3.8, '8': 2.8, '9': 2.0,
    }),
  });
  // Claves de categoría que NUNCA ajustan el nivel — mismos strings que ya usa el account
  // schema ('no-se', ver CATEGORY_LABELS de app.js) más 'no-compito', nuevo en esta ronda.
  const CATEGORY_NEUTRAL_KEYS = Object.freeze(['no-compito', 'no-se']);

  /* ------------------------------------------------------------------ */
  /* 2. ANCLA TÉCNICA Y NIVEL BASE (§3.2).                                 */
  /* ------------------------------------------------------------------ */

  /** ancla_tecnica = (ancla_red + ancla_paredes) / 2. `null` si falta alguna respuesta —
   *  nunca inventa un promedio parcial. */
  function computeTechnicalAnchor(redKey, paredesKey) {
    const red = findByKey(ANCHOR_TECNICA, redKey);
    const paredes = findByKey(ANCHOR_TECNICA, paredesKey);
    if (!red || !paredes) return null;
    return round4((red.value + paredes.value) / 2);
  }

  /* ------------------------------------------------------------------ */
  /* 3. ESTIMACIÓN INICIAL — CUESTIONARIO COMPLETO Y CAMINO RÁPIDO (§3.2/  */
  /* §3.5/§3.6). Ninguno de los dos incluye todavía la categoría — V1.1    */
  /* la pregunta DESPUÉS, como último paso compartido (§6 del handoff      */
  /* V04.6) — ver `computeCategoryStep`.                                   */
  /* ------------------------------------------------------------------ */

  /** `answers`: {autoevaluacion, anos, entrenamiento, frecuencia, competicion, red, paredes} —
   *  cada valor es la KEY de la opción elegida (nunca un índice posicional: a diferencia de
   *  V1.4, V1.1 no pondera con pesos libres, así que una key explícita es más segura que un
   *  índice que dependería del orden de un array). Devuelve `null` si falta alguna respuesta
   *  obligatoria (autoevaluación/red/paredes/entrenamiento) — nunca inventa un valor medio. */
  function computeFullEstimate(answers) {
    const a = answers || {};
    const autoeval = findByKey(ANCHOR_AUTOEVALUACION, a.autoevaluacion);
    const technicalAnchor = computeTechnicalAnchor(a.red, a.paredes);
    const training = findByKey(TRAINING_MODIFIERS, a.entrenamiento);
    if (!autoeval || technicalAnchor == null || !training) return null;
    const competition = findByKey(COMPETITION_MODIFIERS, a.competicion);
    const baseLevel = round4(
      PARAMS.BASE_WEIGHT_AUTOEVALUACION * autoeval.value +
      PARAMS.BASE_WEIGHT_TECNICA * technicalAnchor +
      training.value
    );
    return {
      pathType: 'full',
      raw: clamp(baseLevel, PARAMS.ADJUSTED_LEVEL_MIN, PARAMS.ADJUSTED_LEVEL_MAX),
      baseLevel,
      technicalAnchor,
      trainingModifier: training.value,
      competitionAnswer: competition ? competition.key : null,
      autoevalAnchorValue: autoeval.value,
      yearsKey: a.anos || null,
      frequencyKey: a.frecuencia || null,
    };
  }

  /** §3.6 — camino rápido: reutiliza las 5 anclas de autoevaluación tal cual, sin pregunta
   *  competitiva (el modificador competitivo no aplica — nunca se inventa una respuesta que
   *  no se formuló). */
  function computeQuickLevel(seedKey) {
    const seed = findByKey(ANCHOR_AUTOEVALUACION, seedKey);
    if (!seed) return null;
    return {
      pathType: 'quick',
      raw: seed.value,
      baseLevel: seed.value,
      technicalAnchor: null,
      trainingModifier: 0,
      competitionAnswer: null,
      autoevalAnchorValue: seed.value,
      yearsKey: null,
      frequencyKey: null,
      seedKey: seed.key,
    };
  }

  // Anclas de autoevaluación expuestas como mapa simple key->valor — conveniencia para UI/
  // tests, misma fuente que ANCHOR_AUTOEVALUACION (nunca un segundo valor suelto).
  const QUICK_SEEDS = Object.freeze(
    ANCHOR_AUTOEVALUACION.reduce((acc, a) => { acc[a.key] = a.value; return acc; }, {})
  );

  /* ------------------------------------------------------------------ */
  /* 4. CATEGORÍA COMO ÚLTIMO PASO (§3.3) — ajuste automático ±0.5,        */
  /* coherencia (§3.4) y confianza de origen variable (§3.4).              */
  /* ------------------------------------------------------------------ */

  /** §3.3 — referencia_categoria = ancla_categoria + modificador_competitivo;
   *  ajuste_categoria = clamp(0.70×(referencia_categoria − nivel_base); ±0.5). Devuelve
   *  ajuste 0 sin tocar el nivel si la categoría es neutral (`no-compito`/`no-se`) o si el
   *  contexto no tiene mapa compatible — nunca inventa una equivalencia rígida. */
  function computeCategoryAdjustment(input) {
    const cfg = input || {};
    const declaredCategory = cfg.declaredCategory || null;
    if (!declaredCategory || CATEGORY_NEUTRAL_KEYS.indexOf(declaredCategory) !== -1) {
      return { categoryReference: null, categoryAdjustment: 0, categoryApplied: false };
    }
    const map = cfg.categoryContextKey ? CATEGORY_CONTEXT_MAPS[cfg.categoryContextKey] : null;
    const categoryAnchor = map ? map[declaredCategory] : undefined;
    if (categoryAnchor === undefined) {
      return { categoryReference: null, categoryAdjustment: 0, categoryApplied: false };
    }
    const competition = findByKey(COMPETITION_MODIFIERS, cfg.competitionKey) || COMPETITION_MODIFIERS[0];
    const categoryReference = round4(categoryAnchor + competition.value);
    const categoryAdjustment = round4(clamp(
      PARAMS.CATEGORY_ADJUSTMENT_WEIGHT * (categoryReference - cfg.baseLevel),
      -PARAMS.ADJUSTMENT_MAX_ABS, PARAMS.ADJUSTMENT_MAX_ABS
    ));
    return { categoryReference, categoryAdjustment, categoryApplied: true };
  }

  /** §3.4 — brecha_coherencia = max(|ancla_autoevaluacion − ancla_tecnica|; |nivel_base −
   *  referencia_categoria| si existe). En camino rápido no hay una segunda medición técnica
   *  independiente, así que ese término aporta 0 (nunca se inventa una brecha donde no hay
   *  dos mediciones distintas). */
  function computeCoherenceGap(autoevalAnchorValue, technicalAnchorForGap, baseLevel, categoryReference) {
    const gaps = [Math.abs(autoevalAnchorValue - technicalAnchorForGap)];
    if (categoryReference != null) gaps.push(Math.abs(baseLevel - categoryReference));
    return round4(Math.max.apply(Math, gaps));
  }

  function sumContextPoints(yearsKey, frequencyKey, categoryApplied) {
    const years = findByKey(YEARS_POINTS, yearsKey);
    const freq = findByKey(FREQUENCY_POINTS, frequencyKey);
    let points = (years ? years.points : 0) + (freq ? freq.points : 0);
    if (categoryApplied) points += 1;
    return points;
  }

  function confidenceFromPoints(points) {
    const tier = CONFIDENCE_ORIGIN_TIERS.find((t) => points <= t.max) || CONFIDENCE_ORIGIN_TIERS[CONFIDENCE_ORIGIN_TIERS.length - 1];
    return tier.value;
  }

  /** Aplica la pregunta final de categoría (§6 del handoff V04.6, ambos caminos) sobre un
   *  `rawResult` de `computeFullEstimate`/`computeQuickLevel`. Devuelve TODO lo necesario para
   *  mostrar "Tu punto de partida en BRAMU" y para `confirmInitialLevelV1_1` — nunca muta
   *  `rawResult`. */
  function computeCategoryStep(rawResult, categoryContextKey, declaredCategory) {
    const baseLevel = rawResult.baseLevel;
    const cat = computeCategoryAdjustment({
      categoryContextKey, declaredCategory, competitionKey: rawResult.competitionAnswer, baseLevel,
    });
    const adjustedLevel = round4(clamp(baseLevel + cat.categoryAdjustment, PARAMS.ADJUSTED_LEVEL_MIN, PARAMS.ADJUSTED_LEVEL_MAX));
    const technicalForGap = rawResult.technicalAnchor != null ? rawResult.technicalAnchor : rawResult.autoevalAnchorValue;
    const coherenceGap = computeCoherenceGap(rawResult.autoevalAnchorValue, technicalForGap, baseLevel, cat.categoryReference);
    const coherenceFlag = coherenceGap >= PARAMS.COHERENCE_GAP_THRESHOLD;
    const naturalConfidenceOrigin = rawResult.pathType === 'quick'
      ? CONFIDENCE_ORIGIN_QUICK
      : confidenceFromPoints(sumContextPoints(rawResult.yearsKey, rawResult.frequencyKey, cat.categoryApplied));
    return {
      preCategoryLevel: baseLevel,
      baseLevel,
      technicalAnchor: rawResult.technicalAnchor,
      trainingModifier: rawResult.trainingModifier,
      competitionAnswer: rawResult.competitionAnswer,
      categoryContextKey: categoryContextKey || null,
      declaredCategory: declaredCategory || null,
      categoryReference: cat.categoryReference,
      categoryAdjustment: cat.categoryAdjustment,
      adjustedLevel,
      coherenceGap,
      coherenceFlag,
      naturalConfidenceOrigin,
    };
  }

  /** Confirma el nivel inicial V1.1 a partir de `computeCategoryStep`. `confirmDespiteCoherence`
   *  SOLO importa cuando `coherenceFlag` es `true`: si el jugador revisó y confirmó igual sin
   *  modificar respuestas, la confianza de origen queda limitada a 0.10 (§3.4) — el nivel
   *  calculado NUNCA se penaliza, solo su confianza. Nunca muta `categoryStep`. */
  function confirmInitialLevelV1_1(categoryStep, confirmDespiteCoherence, confirmedAt) {
    const confidenceOrigin = (categoryStep.coherenceFlag && confirmDespiteCoherence)
      ? CONFIDENCE_ORIGIN_COHERENCE_REVIEWED
      : categoryStep.naturalConfidenceOrigin;
    return {
      ok: true,
      origin: {
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        confirmedLevel: categoryStep.adjustedLevel,
        baseLevel: categoryStep.baseLevel,
        technicalAnchor: categoryStep.technicalAnchor,
        trainingModifier: categoryStep.trainingModifier,
        categoryContextKey: categoryStep.categoryContextKey,
        declaredCategory: categoryStep.declaredCategory,
        competitionAnswer: categoryStep.competitionAnswer,
        categoryReference: categoryStep.categoryReference,
        categoryAdjustment: categoryStep.categoryAdjustment,
        confidenceOrigin,
        coherenceFlag: categoryStep.coherenceFlag,
        confirmedAt: confirmedAt || null,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 5. AJUSTE GENÉRICO (legado, §3.3/§11 recalibración) — primitiva            */
  /* reutilizada EXCLUSIVAMENTE por la recalibración (§11.1: "repetir       */
  /* cuestionario completo... permitir un ajuste acotado", mismo mecanismo  */
  /* de siempre). El estimador inicial V1.1 YA NO la usa (su ajuste es      */
  /* automático por categoría, no manual — ver `confirmInitialLevelV1_1`). */
  /* Ya no exige múltiplos de 0.1: esa granularidad era del stepper manual  */
  /* retirado en V04.6, nunca una regla matemática de la fórmula.           */
  /* ------------------------------------------------------------------ */

  /** Valida un ajuste ANTES de aplicarlo — nunca clampea silenciosamente un valor fuera de
   *  rango: |ajuste| > 0.5 se RECHAZA explícitamente. */
  function validateAdjustment(adjustment) {
    const a = typeof adjustment === 'number' ? adjustment : 0;
    if (Math.abs(a) > PARAMS.ADJUSTMENT_MAX_ABS + 1e-9) {
      return { valid: false, reasonCodes: ['ajuste_fuera_de_rango_0_5'] };
    }
    return { valid: true, reasonCodes: [] };
  }

  /** Confirma un nivel con su ajuste acotado — usado por la recalibración
   *  (`confirmRecalibrationQuestionnaire`). Si `alreadyConfirmed` es `true`, rechaza SIEMPRE.
   *  Nunca muta `rawResult`. */
  function confirmInitialLevel(rawResult, adjustment, alreadyConfirmed, confirmedAt) {
    if (alreadyConfirmed) {
      return { ok: false, reasonCodes: ['ajuste_ya_confirmado_no_puede_repetirse'] };
    }
    const validation = validateAdjustment(adjustment);
    if (!validation.valid) return { ok: false, reasonCodes: validation.reasonCodes };

    const confirmedLevel = round4(clamp(rawResult.raw + adjustment, PARAMS.ADJUSTED_LEVEL_MIN, PARAMS.ADJUSTED_LEVEL_MAX));
    return {
      ok: true,
      reasonCodes: ['ajuste_confirmado'],
      origin: {
        rawLevel: rawResult.raw,
        adjustment: round4(adjustment || 0),
        confirmedLevel,
        confirmedAt: confirmedAt || null,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 6. ESTADO INICIAL — al confirmar, arranca CALIBRANDO.                 */
  /* ------------------------------------------------------------------ */

  /** `originType`: 'quick' | 'full'. `confirmResult` viene de `confirmInitialLevelV1_1` — su
   *  `origin.confidenceOrigin` YA es la confianza correcta para ese camino (variable en
   *  completo, 0.10 fijo en rápido, o 0.10 si hubo coherencia confirmada sin revisar): esta
   *  función nunca vuelve a decidir confianza por tipo de camino, solo la propaga.
   *  Las respuestas del cuestionario (si las hay) quedan SOLO dentro de
   *  `origin.questionnaireAnswers`, como dato declarado — nunca se usan como si fueran un
   *  hecho deportivo observado. */
  function buildInitialCalibrationState(originType, confirmResult, questionnaireAnswers) {
    if (!confirmResult || !confirmResult.ok) return null;
    return {
      mu: confirmResult.origin.confirmedLevel,
      confidence: confirmResult.origin.confidenceOrigin,
      evidenceUnits: 0,
      state: Level.STATES.CALIBRATING,
      ratedMatches: 0,
      distinctOpponents: 0,
      lastRatedAt: null,
      algorithmVersion: Level.ALGORITHM_VERSION,
      origin: Object.assign({ type: originType, questionnaireAnswers: questionnaireAnswers || null }, confirmResult.origin),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 7. CALIBRACIÓN (§10.2) — transición CALIBRANDO -> CALIBRADO           */
  /* SOLO con las 2 condiciones a la vez, nunca partidos solos.            */
  /* SIN CAMBIOS desde V04.3 — CONSERVAR (Handoff V04.6 §2).               */
  /* ------------------------------------------------------------------ */
  function computeCalibrationTransition(currentState, ratedMatches, distinctOpponents) {
    if (!currentState || currentState.state !== Level.STATES.CALIBRATING) {
      return { transition: false, reasonCodes: ['jugador_no_esta_calibrando'] };
    }
    const meetsMatches = (ratedMatches || 0) >= PARAMS.CALIBRATION_MIN_MATCHES;
    const meetsRivals = (distinctOpponents || 0) >= PARAMS.CALIBRATION_MIN_DISTINCT_RIVALS;
    if (meetsMatches && meetsRivals) {
      return {
        transition: true,
        reasonCodes: ['calibracion_completa_5_partidos_3_rivales'],
        newState: Object.assign({}, currentState, { state: Level.STATES.CALIBRATED, ratedMatches, distinctOpponents }),
      };
    }
    const reasonCodes = [];
    if (!meetsMatches) reasonCodes.push('faltan_partidos_computables');
    if (!meetsRivals) reasonCodes.push('faltan_rivales_distintos');
    return { transition: false, reasonCodes };
  }

  /* ------------------------------------------------------------------ */
  /* 8. RECALIBRACIÓN (§11) — cooldown 90 días, ancla provisional,        */
  /* cierre 3 partidos/2 rivales, ventana máxima 120 días.                 */
  /* SIN CAMBIOS desde V04.3 — CONSERVAR (Handoff V04.6 §2).               */
  /* ------------------------------------------------------------------ */

  function computeRecalibrationEligibility(lastConfirmationAt, nowIso) {
    const days = (new Date(nowIso).getTime() - new Date(lastConfirmationAt).getTime()) / DAY_MS;
    const nextEligibleAt = new Date(new Date(lastConfirmationAt).getTime() + PARAMS.RECALIBRATION_COOLDOWN_DAYS * DAY_MS).toISOString();
    return {
      eligible: days >= PARAMS.RECALIBRATION_COOLDOWN_DAYS,
      daysSinceLastConfirmation: round4(days),
      nextEligibleAt,
      reasonCodes: days >= PARAMS.RECALIBRATION_COOLDOWN_DAYS ? ['recalibracion_disponible'] : ['cooldown_90_dias_no_cumplido'],
    };
  }

  function startRecalibration(currentState, qNuevoConfirmed, startedAt) {
    const muActual = currentState.mu;
    const confidenceActual = currentState.confidence;
    const muRaw = PARAMS.RECALIBRATION_MU_WEIGHT_PREVIOUS * muActual + PARAMS.RECALIBRATION_MU_WEIGHT_NEW * qNuevoConfirmed;
    const muProvisional = Level.clampLevel(clamp(muRaw, muActual - PARAMS.RECALIBRATION_MU_MAX_SHIFT, muActual + PARAMS.RECALIBRATION_MU_MAX_SHIFT));
    const confidenceProvisional = round4(Math.max(
      PARAMS.RECALIBRATION_CONFIDENCE_FLOOR,
      Math.min(PARAMS.RECALIBRATION_CONFIDENCE_CEILING, PARAMS.RECALIBRATION_CONFIDENCE_WEIGHT * confidenceActual)
    ));
    return Object.assign({}, currentState, {
      state: Level.STATES.RECALIBRATING,
      muConsolidatedPrevious: muActual,
      confidenceConsolidatedPrevious: confidenceActual,
      muProvisional: round4(muProvisional),
      confidenceProvisional,
      recalibrationStartedAt: startedAt,
      recalibrationWindowExpiresAt: new Date(new Date(startedAt).getTime() + PARAMS.RECALIBRATION_WINDOW_MAX_DAYS * DAY_MS).toISOString(),
      recalibrationRatedMatches: 0,
      recalibrationDistinctOpponents: 0,
    });
  }

  /** El cuestionario de recalibración reutiliza EXACTAMENTE el mismo mecanismo de ajuste
   *  acotado que ya existía (§11.1: "repetir cuestionario completo... permitir un ajuste
   *  acotado") — nunca una segunda implementación de "confirmar+ajustar". */
  function confirmRecalibrationQuestionnaire(rawResult, adjustment, confirmedAt) {
    return confirmInitialLevel(rawResult, adjustment, false, confirmedAt);
  }

  function computeRecalibrationClosure(recalState, ratedMatchesSinceStart, distinctOpponentsSinceStart, nowIso) {
    const daysSinceStart = (new Date(nowIso).getTime() - new Date(recalState.recalibrationStartedAt).getTime()) / DAY_MS;

    if (daysSinceStart > PARAMS.RECALIBRATION_WINDOW_MAX_DAYS) {
      return {
        closed: false, expired: true,
        reasonCodes: ['ventana_120_dias_expirada_vuelve_a_consolidado'],
        resultState: Object.assign({}, recalState, {
          state: Level.STATES.CALIBRATED,
          mu: recalState.muConsolidatedPrevious,
          confidence: recalState.confidenceConsolidatedPrevious,
          recalibrationExpired: {
            muProvisional: recalState.muProvisional,
            confidenceProvisional: recalState.confidenceProvisional,
            startedAt: recalState.recalibrationStartedAt,
            expiredAt: nowIso,
          },
        }),
      };
    }

    const meetsMatches = (ratedMatchesSinceStart || 0) >= PARAMS.RECALIBRATION_CLOSE_MIN_MATCHES;
    const meetsRivals = (distinctOpponentsSinceStart || 0) >= PARAMS.RECALIBRATION_CLOSE_MIN_DISTINCT_RIVALS;
    if (meetsMatches && meetsRivals) {
      return {
        closed: true, expired: false,
        reasonCodes: ['recalibracion_cerrada_3_partidos_2_rivales'],
        resultState: Object.assign({}, recalState, {
          state: Level.STATES.CALIBRATED,
          mu: recalState.muProvisional,
          confidence: recalState.confidenceProvisional,
          recalibrationClosedAt: nowIso,
        }),
      };
    }
    const reasonCodes = [];
    if (!meetsMatches) reasonCodes.push('faltan_partidos_computables');
    if (!meetsRivals) reasonCodes.push('faltan_rivales_distintos');
    return { closed: false, expired: false, reasonCodes };
  }

  /* ------------------------------------------------------------------ */
  /* 9. CATEGORÍAS DE COMUNICACIÓN (§3.7) — puramente de presentación (qué */
  /* palabra usar para un número), no participa del cálculo. Cortes        */
  /* actualizados en V04.6 (V1.4 tenía 5.4/6.9/8.4; V1.5 corrige a          */
  /* 4.9/6.3/7.9) y la etiqueta superior pasa de "Competición" a            */
  /* "Profesional" — mismo criterio: fuente única de los 6 cortes, nunca   */
  /* UI duplicando números de la fórmula.                                  */
  /* ------------------------------------------------------------------ */
  const LEVEL_CATEGORIES = Object.freeze([
    { max: 2.4, key: 'iniciacion', label: 'Iniciación' },
    { max: 3.9, key: 'recreativo', label: 'Recreativo' },
    { max: 4.9, key: 'intermedio', label: 'Intermedio' },
    { max: 6.3, key: 'intermedio_alto', label: 'Intermedio alto' },
    { max: 7.9, key: 'avanzado', label: 'Avanzado' },
    { max: 10.0, key: 'profesional', label: 'Profesional' },
  ]);

  function categorizeLevel(level) {
    const found = LEVEL_CATEGORIES.find((c) => level <= c.max + 1e-9) || LEVEL_CATEGORIES[LEVEL_CATEGORIES.length - 1];
    return { key: found.key, label: found.label };
  }

  global.PLLevelCalibration = {
    PARAMS,
    QUESTIONNAIRE_VERSION,
    ANCHOR_AUTOEVALUACION,
    ANCHOR_TECNICA,
    TRAINING_MODIFIERS,
    COMPETITION_MODIFIERS,
    YEARS_POINTS,
    FREQUENCY_POINTS,
    CATEGORY_CONTEXT_MAPS,
    CATEGORY_NEUTRAL_KEYS,
    QUICK_SEEDS,
    computeTechnicalAnchor,
    computeFullEstimate,
    computeQuickLevel,
    computeCategoryAdjustment,
    computeCategoryStep,
    confirmInitialLevelV1_1,
    validateAdjustment,
    confirmInitialLevel,
    buildInitialCalibrationState,
    computeCalibrationTransition,
    computeRecalibrationEligibility,
    startRecalibration,
    confirmRecalibrationQuestionnaire,
    computeRecalibrationClosure,
    LEVEL_CATEGORIES,
    categorizeLevel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
