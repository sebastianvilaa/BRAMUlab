/* ==========================================================================
   BRAMU Lab — level-calibration.js (BRAMUlab_V04.3, Etapa C)
   Ciclo de vida puro del Nivel BRAMU de UN jugador: cuestionario (rápido y
   completo), ajuste inicial, estado CALIBRANDO, transición a CALIBRADO,
   recalibración cada 90 días. Cero DOM, cero localStorage — mismo criterio
   que level.js/level-context.js. Reutiliza `Level.STATES`,
   `Level.PARAMS.CONFIDENCE_ORIGIN_*` y `Level.clampLevel` — nunca duplica una
   constante ni una fórmula ya cerrada en `level.js`.

   ALCANCE DE ETAPA C (autorización de Sebastián sobre V04.1/V04.2 ya
   cerradas): solo el ciclo cuestionario → ajuste → calibrando → calibrado →
   recalibración, como funciones puras que reciben todo lo que necesitan por
   parámetro (partidos/rivales computables, fechas, estado anterior) y
   devuelven el nuevo estado + auditoría. NO conecta con `store.js`, `app.js`,
   `player-home.js` ni `ranking.js` — quien integre esto en producción decide
   de dónde vienen esos parámetros (hoy no existe ese integrador). NO diseña
   ni conecta UI.

   FUENTES (en este orden de precedencia, igual que el resto de V04):
   1. Nivel_BRAMU_Formula_V1.4.md §3 (cuestionario), §11 (recalibración).
   2. Nivel_BRAMU_Implementacion.md — Etapa C.
   3. Nivel_BRAMU.md §4-§6 (estados/UX), solo donde no contradice a los
      anteriores — confirmado sin contradicciones reales, ver
      BRAMUlab_V04_Informe.md §"V04.3" para el detalle de las 2 inferencias
      documentadas (ninguna es una contradicción, son huecos que la fórmula
      no fija explícitamente y se resuelven por la lectura más consistente).
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;

  const DAY_MS = 86400000;

  function round4(n) { return Math.round(n * 10000) / 10000; }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /* ------------------------------------------------------------------ */
  /* PARÁMETROS DE ETAPA C — citan su sección de Nivel_BRAMU_Formula_V1.4.md. */
  /* ------------------------------------------------------------------ */
  const PARAMS = Object.freeze({
    // §3.2 — rango bruto del cuestionario completo y rango final tras ajuste.
    QUESTIONNAIRE_RAW_MIN: 1.0,
    QUESTIONNAIRE_RAW_MAX: 8.5,
    ADJUSTED_LEVEL_MIN: 1.0,
    ADJUSTED_LEVEL_MAX: 9.0,
    // §3.2/§3.7 — ajuste único permitido, pasos de 0.1.
    ADJUSTMENT_MAX_ABS: 0.5,
    ADJUSTMENT_STEP: 0.1,
    // §10.2 — transición CALIBRANDO -> CALIBRADO.
    CALIBRATION_MIN_MATCHES: 5,
    CALIBRATION_MIN_DISTINCT_RIVALS: 3,
    // §11.1/§11.3 — recalibración.
    RECALIBRATION_COOLDOWN_DAYS: 90,
    RECALIBRATION_CLOSE_MIN_MATCHES: 3,
    RECALIBRATION_CLOSE_MIN_DISTINCT_RIVALS: 2,
    RECALIBRATION_WINDOW_MAX_DAYS: 120,
    // §11.2 — ancla provisional y confianza provisional.
    RECALIBRATION_MU_WEIGHT_PREVIOUS: 0.75,
    RECALIBRATION_MU_WEIGHT_NEW: 0.25,
    RECALIBRATION_MU_MAX_SHIFT: 0.5,
    RECALIBRATION_CONFIDENCE_FLOOR: 0.30,
    RECALIBRATION_CONFIDENCE_CEILING: 0.70,
    RECALIBRATION_CONFIDENCE_WEIGHT: 0.75,
  });

  /* ------------------------------------------------------------------ */
  /* 1. CUESTIONARIO COMPLETO (§3.1/§3.2/§3.5) — 7 preguntas exactas.      */
  /* `options` en el orden EXACTO del documento; el índice elegido por el  */
  /* jugador es lo que recibe `computeFullQuestionnaireRaw`.               */
  /* ------------------------------------------------------------------ */
  const FULL_QUESTIONNAIRE = Object.freeze([
    {
      id: 'autoevaluacion', weight: 0.30,
      label: '¿Cómo describirías tu nivel actual?',
      options: Object.freeze([
        { label: 'Estoy empezando', value: 0.00 },
        { label: 'Inicial', value: 0.25 },
        { label: 'Intermedio', value: 0.50 },
        { label: 'Intermedio alto', value: 0.75 },
        { label: 'Avanzado o competición', value: 1.00 },
      ]),
    },
    {
      id: 'tiempo_jugando', weight: 0.15,
      label: '¿Hace cuánto jugás al pádel?',
      options: Object.freeze([
        { label: 'Menos de 3 meses', value: 0.00 },
        { label: 'Entre 3 meses y 1 año', value: 0.25 },
        { label: 'Entre 1 y 2 años', value: 0.50 },
        { label: 'Entre 2 y 4 años', value: 0.75 },
        { label: 'Más de 4 años', value: 1.00 },
      ]),
    },
    {
      id: 'clases_entrenamiento', weight: 0.10,
      label: '¿Qué experiencia tenés con clases o entrenamiento?',
      options: Object.freeze([
        { label: 'Nunca tomé clases', value: 0.00 },
        { label: 'Hice algunas clases o clínicas', value: 0.25 },
        { label: 'Tomo clases de vez en cuando', value: 0.50 },
        { label: 'Entreno con regularidad actualmente', value: 0.75 },
        { label: 'Entreno regularmente hace más de un año', value: 1.00 },
      ]),
    },
    {
      id: 'frecuencia_reciente', weight: 0.10,
      label: 'En los últimos 3 meses, ¿con qué frecuencia jugaste?',
      options: Object.freeze([
        { label: 'No estuve jugando', value: 0.00 },
        { label: 'Menos de una vez por mes', value: 0.20 },
        { label: 'Entre 1 y 3 veces por mes', value: 0.40 },
        { label: 'Una vez por semana', value: 0.60 },
        { label: 'Entre 2 y 3 veces por semana', value: 0.80 },
        { label: '4 veces por semana o más', value: 1.00 },
      ]),
    },
    {
      id: 'experiencia_competitiva', weight: 0.15,
      label: '¿Qué experiencia competitiva te describe mejor hoy?',
      options: Object.freeze([
        { label: 'Nunca competí', value: 0.00 },
        { label: 'Jugué alguna liga o torneo recreativo', value: 0.20 },
        { label: 'Compito en categorías iniciales y tengo partidos parejos', value: 0.40 },
        { label: 'Compito en categorías intermedias y tengo partidos parejos', value: 0.60 },
        { label: 'Compito en categorías avanzadas y tengo partidos parejos', value: 0.80 },
        { label: 'Compito en categorías avanzadas y suelo llegar a instancias finales', value: 1.00 },
      ]),
    },
    {
      id: 'red', weight: 0.10,
      label: 'Cuando estás en la red, ¿qué opción te representa mejor?',
      options: Object.freeze([
        { label: 'Todavía me cuesta subir y ubicarme', value: 0.00 },
        { label: 'Resuelvo voleas simples, pero pierdo control con presión', value: 0.25 },
        { label: 'Sostengo la red y me ubico con mi compañero', value: 0.50 },
        { label: 'Uso voleas y bandejas para conservar la posición', value: 0.75 },
        { label: 'Varío golpes con intención y recupero la red con consistencia', value: 1.00 },
      ]),
    },
    {
      id: 'paredes', weight: 0.10,
      label: '¿Cómo te llevás con las paredes?',
      options: Object.freeze([
        { label: 'Todavía evito dejarlas pasar', value: 0.00 },
        { label: 'Devuelvo pelotas simples después de la pared de fondo', value: 0.25 },
        { label: 'Uso pared de fondo y lateral en situaciones habituales', value: 0.50 },
        { label: 'Leo rebotes dobles y elijo cuándo girar o salir', value: 0.75 },
        { label: 'Uso las paredes con consistencia incluso con velocidad o presión', value: 1.00 },
      ]),
    },
  ]);

  /** §3.2 — Q = Σ(w_k × q_k); nivel_cuestionario = 1 + 7.5×Q. `answerIndices`:
   *  {questionId: índice elegido dentro de `options`}. Ninguna pregunta sin respuesta
   *  válida contribuye (se trata como índice 0 — nunca inventa una respuesta faltante con
   *  un valor intermedio: 0 es la opción más conservadora del propio cuestionario). */
  function computeFullQuestionnaireRaw(answerIndices) {
    const answers = answerIndices || {};
    let q = 0;
    const resolvedAnswers = {};
    FULL_QUESTIONNAIRE.forEach((question) => {
      const idx = answers[question.id];
      const option = (typeof idx === 'number' && question.options[idx]) ? question.options[idx] : question.options[0];
      resolvedAnswers[question.id] = { index: question.options.indexOf(option), value: option.value };
      q += question.weight * option.value;
    });
    const raw = round4(PARAMS.QUESTIONNAIRE_RAW_MIN + 7.5 * q);
    return { raw: clamp(raw, PARAMS.QUESTIONNAIRE_RAW_MIN, PARAMS.QUESTIONNAIRE_RAW_MAX), q: round4(q), answers: resolvedAnswers };
  }

  /* ------------------------------------------------------------------ */
  /* 2. CAMINO RÁPIDO (§3.3) — 5 semillas fijas.                          */
  /* ------------------------------------------------------------------ */
  const QUICK_SEEDS = Object.freeze({
    iniciacion: 2.0,
    intermedio: 4.0,
    intermedio_alto: 5.5,
    avanzado: 7.0,
    competicion: 8.5,
  });

  function computeQuickLevel(seedKey) {
    if (!Object.prototype.hasOwnProperty.call(QUICK_SEEDS, seedKey)) return null;
    return { raw: QUICK_SEEDS[seedKey], seedKey };
  }

  /* ------------------------------------------------------------------ */
  /* 3. AJUSTE INICIAL (§3.2/§3.7) — única corrección, pasos de 0.1,      */
  /* resultado final limitado a 1.0-9.0.                                  */
  /* ------------------------------------------------------------------ */

  /** Valida un ajuste ANTES de aplicarlo — nunca clampea silenciosamente un valor fuera de
   *  rango: |ajuste| > 0.5 o que no sea múltiplo de 0.1 se RECHAZA explícitamente. */
  function validateAdjustment(adjustment) {
    const a = typeof adjustment === 'number' ? adjustment : 0;
    if (Math.abs(a) > PARAMS.ADJUSTMENT_MAX_ABS + 1e-9) {
      return { valid: false, reasonCodes: ['ajuste_fuera_de_rango_0_5'] };
    }
    const steps = a / PARAMS.ADJUSTMENT_STEP;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) {
      return { valid: false, reasonCodes: ['ajuste_no_es_multiplo_de_0_1'] };
    }
    return { valid: true, reasonCodes: [] };
  }

  /** Confirma el nivel inicial (cuestionario completo o camino rápido) con su ajuste. Si
   *  `alreadyConfirmed` es `true` (el llamador ya tiene un `origin` confirmado antes para
   *  este jugador), rechaza SIEMPRE — "el ajuste no puede repetirse luego de confirmar"
   *  (§3.2: "un único ajuste"). Nunca muta `rawResult`. */
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
  /* 4. ESTADO INICIAL (§2/§3.7) — al confirmar, arranca CALIBRANDO.       */
  /* ------------------------------------------------------------------ */

  /** `origin.type`: 'quick' | 'full'. Las respuestas del cuestionario (si las hay) quedan
   *  SOLO dentro de `origin.questionnaireAnswers`, como dato declarado — nunca se usan como
   *  si fueran un hecho deportivo observado (§3.5, "nunca autorizan a BRAMU Intelligence a
   *  afirmar que una acción técnica ocurrió"). */
  function buildInitialCalibrationState(originType, confirmResult, questionnaireAnswers) {
    if (!confirmResult || !confirmResult.ok) return null;
    const confidence = originType === 'quick'
      ? Level.PARAMS.CONFIDENCE_ORIGIN_QUESTIONNAIRE_QUICK
      : Level.PARAMS.CONFIDENCE_ORIGIN_QUESTIONNAIRE_FULL;
    return {
      mu: confirmResult.origin.confirmedLevel,
      confidence,
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
  /* 5. CALIBRACIÓN (§10.2) — transición CALIBRANDO -> CALIBRADO           */
  /* SOLO con las 2 condiciones a la vez, nunca partidos solos.            */
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
  /* 6. RECALIBRACIÓN (§11) — cooldown 90 días, ancla provisional,        */
  /* cierre 3 partidos/2 rivales, ventana máxima 120 días.                 */
  /* ------------------------------------------------------------------ */

  /** §11.1/§6.1 — "el plazo comienza en la fecha de confirmación de la última calibración
   *  o recalibración" — `lastConfirmationAt` es esa fecha (inicial o de la última
   *  recalibración, lo que sea más reciente; decisión de QUIÉN es "la última" queda en el
   *  llamador, este módulo no guarda historial). */
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

  /** §11.2 — ancla provisional. `qNuevoConfirmed` es el resultado YA confirmado (con su
   *  propio ajuste, mismo mecanismo que la calibración inicial — `confirmInitialLevel`
   *  reutilizado tal cual, ver `confirmRecalibrationQuestionnaire` más abajo) del nuevo
   *  cuestionario completo. Nunca muta `currentState`. */
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
   *  que la calibración inicial (§11.1: "repetir cuestionario completo... permitir un
   *  ajuste acotado") — nunca una segunda implementación de "confirmar+ajustar". */
  function confirmRecalibrationQuestionnaire(rawResult, adjustment, confirmedAt) {
    return confirmInitialLevel(rawResult, adjustment, false, confirmedAt);
  }

  /** §11.3 — cierre/expiración. `daysSinceStart` se deriva de `recalibrationStartedAt` +
   *  `nowIso`; ventana > 120 días -> expira y vuelve al consolidado anterior SIN perder
   *  trazabilidad (el estado devuelto conserva `recalibrationExpired` con los datos
   *  provisionales que no llegaron a confirmarse). Nunca muta `recalState`. */
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

  global.PLLevelCalibration = {
    PARAMS,
    FULL_QUESTIONNAIRE,
    QUICK_SEEDS,
    computeFullQuestionnaireRaw,
    computeQuickLevel,
    validateAdjustment,
    confirmInitialLevel,
    buildInitialCalibrationState,
    computeCalibrationTransition,
    computeRecalibrationEligibility,
    startRecalibration,
    confirmRecalibrationQuestionnaire,
    computeRecalibrationClosure,
  };
})(typeof window !== 'undefined' ? window : globalThis);
