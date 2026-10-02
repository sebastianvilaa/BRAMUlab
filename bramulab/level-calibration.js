/* ==========================================================================
   BRAMU Lab — level-calibration.js (BRAMUlab V04.28 — estimador inicial V1.3)
   Ciclo de vida puro del Nivel BRAMU de UN jugador: cuestionario inicial
   universal adaptativo `nivel_inicial_v1_3` (5 preguntas, slider discreto de 10
   posiciones), estado CALIBRANDO, transición a CALIBRADO y recalibración (90
   días). Cero DOM, cero localStorage — mismo criterio que level.js/
   level-context.js. Reutiliza `Level.STATES`, `Level.ALGORITHM_VERSION` y
   `Level.clampLevel` — nunca duplica una fórmula ya cerrada en `level.js`.

   V1.3 REEMPLAZA al estimador V1.2 (autoevaluación + técnica + entrenamiento +
   años/frecuencia + camino rápido + categoría). Ya no existe NINGUNA de esas
   señales: ni en el cálculo, ni en las funciones exportadas. El motor posterior
   de partidos sigue siendo `nivel_bramu_v1_0` (level.js, sin cambios): "V1.3"
   versiona SOLO el cuestionario/estimador inicial.

   Este archivo es COMPARTIDO por el navegador y por la Edge Function
   `officialize-onboarding` (symlink en supabase/functions/_shared/): la fórmula
   existe en un único lugar y el servidor la recalcula desde las posiciones
   crudas del slider — el navegador nunca es autoridad.

   FUENTE: docs/BRAMUlab/Implementacion/Pre_Production/111_Handoff_Implementacion_Nivel_V13_02OCT.md
   (§7 banco de preguntas, §8 fórmula, §12 recalibración). Los textos del banco son
   EXACTAMENTE los del handoff (generados desde el documento, no retipeados).
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;

  const DAY_MS = 86400000;

  function round4(n) { return Math.round(n * 10000) / 10000; }
  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function deepFreeze(o) {
    Object.keys(o).forEach((k) => { if (o[k] && typeof o[k] === 'object') deepFreeze(o[k]); });
    return Object.freeze(o);
  }

  const QUESTIONNAIRE_VERSION = 'nivel_inicial_v1_3';
  // Compatibilidad de persistencia: la base limita questionnaire_mode a quick|full. V1.3 tiene un
  // ÚNICO cuestionario y se persiste siempre como 'full'; el discriminador normativo es
  // `questionnaire_version`. No hay camino rápido (ni acá, ni en UI, ni en servidor).
  const QUESTIONNAIRE_MODE = 'full';

  /* ------------------------------------------------------------------ */
  /* PARÁMETROS (handoff 111 §8, §12 y calibración sin cambios).          */
  /* ------------------------------------------------------------------ */
  const PARAMS = Object.freeze({
    // §8 — rango final del nivel inicial.
    ADJUSTED_LEVEL_MIN: 1.0,
    ADJUSTED_LEVEL_MAX: 9.0,
    // Primitiva acotada que reutiliza la recalibración (movimiento máx. del cuestionario).
    ADJUSTMENT_MAX_ABS: 0.5,
    // §8 — posiciones del slider y selección de rama.
    SLIDER_POSITIONS: 10,
    BRANCH_LOW_BELOW: 4.1,
    BRANCH_HIGH_FROM: 6.4,
    // §8 — confianza de origen según la dispersión entre dimensiones.
    SPREAD_REVIEW_THRESHOLD: 2.0,
    CONFIDENCE_ORIGIN_COHERENT: 0.15,
    CONFIDENCE_ORIGIN_SPREAD: 0.10,
    // Transición CALIBRANDO -> CALIBRADO (sin cambios).
    CALIBRATION_MIN_MATCHES: 5,
    CALIBRATION_MIN_DISTINCT_RIVALS: 3,
    // Recalibración (sin cambios desde V04.3; handoff 111 §12).
    RECALIBRATION_COOLDOWN_DAYS: 90,
    RECALIBRATION_CLOSE_MIN_MATCHES: 3,
    RECALIBRATION_CLOSE_MIN_DISTINCT_RIVALS: 2,
    RECALIBRATION_WINDOW_MAX_DAYS: 120,
    RECALIBRATION_MU_WEIGHT_PREVIOUS: 0.75,
    RECALIBRATION_MU_WEIGHT_NEW: 0.25,
    RECALIBRATION_MU_MAX_SHIFT: 0.5,
    RECALIBRATION_CONFIDENCE_FLOOR: 0.30,
    RECALIBRATION_CONFIDENCE_CEILING: 0.70,
    RECALIBRATION_CONFIDENCE_WEIGHT: 0.75,
  });

  /* ------------------------------------------------------------------ */
  /* 1. BANCO DE PREGUNTAS V1.3 (§7) y ANCLAS (§8).                       */
  /* ------------------------------------------------------------------ */

  // Orden fijo de las cinco dimensiones (20 % cada una). La pregunta 1 es común; las 2–5 tienen
  // un texto por rama (baja/media/alta) que el jugador nunca ve nombrada.
  const QUESTION_IDS = Object.freeze(['panorama', 'ritmo', 'ataque', 'defensa', 'decisiones']);
  const BRANCHES = Object.freeze(['low', 'mid', 'high']);

  // Anclas internas A/B/C/D por pregunta y rama (§8). `common` es la rama única de P1.
  const ANCHORS = deepFreeze({
    panorama: { common: [1.8, 3.8, 5.8, 7.2] },
    ritmo: { low: [1.5, 2.8, 3.8, 4.6], mid: [3.3, 4.2, 5.2, 6.2], high: [5.7, 6.3, 7.0, 8.8] },
    ataque: { low: [1.5, 2.8, 3.8, 4.6], mid: [3.3, 4.2, 5.2, 6.2], high: [5.7, 6.3, 7.0, 8.8] },
    defensa: { low: [1.5, 2.8, 3.8, 4.6], mid: [3.3, 4.2, 5.2, 6.2], high: [5.7, 6.3, 7.0, 8.8] },
    decisiones: { low: [1.5, 2.8, 3.8, 4.6], mid: [3.3, 4.2, 5.2, 6.2], high: [5.7, 6.3, 7.0, 8.8] },
  });

  // Textos EXACTOS del handoff 111 §7 (menor → mayor dominio). El orden de las cuatro descripciones
  // corresponde a las anclas A/B/C/D, pero ninguna letra ni valor sale nunca a la UI.
  const QUESTION_BANK = deepFreeze({
  "panorama": {
    "dimension": "Panorama general",
    "prompt": "¿Qué describe mejor tu juego durante un partido habitual?",
    "texts": {
      "common": [
        "Estoy aprendiendo a ubicarme y a sostener varios golpes seguidos.",
        "Sostengo intercambios cómodos; cuando aumenta el ritmo pierdo control u orden.",
        "Construyo el punto y utilizo distintos recursos; bajo presión todavía me apuro o dejo una pelota fácil.",
        "Sostengo un ritmo alto, buenas posiciones y decisiones; normalmente el rival debe construir el punto para superarme."
      ]
    }
  },
  "ritmo": {
    "dimension": "Control y ritmo",
    "prompt": null,
    "texts": {
      "low": [
        "Me cuesta devolver tres pelotas seguidas aunque lleguen cómodas.",
        "Sostengo intercambios cortos a ritmo lento; al moverme o dirigir la pelota pierdo control.",
        "Sostengo pelotas cómodas con dirección; la velocidad o profundidad me obliga a devolver fácil.",
        "Resuelvo varias pelotas exigentes y recupero mi posición, todavía de manera irregular."
      ],
      "mid": [
        "Controlo la pelota a ritmo cómodo; cuando aceleran llego tarde o dejo una pelota fácil.",
        "Sostengo un ritmo medio y recupero la posición; si la presión continúa, pierdo dirección o profundidad.",
        "Mantengo dirección y profundidad a ritmo alto en la mayoría de las jugadas; una pelota difícil todavía puede dejarme defendiendo.",
        "A ritmo alto llego equilibrado, neutralizo la presión y puedo elegir la respuesta."
      ],
      "high": [
        "Sostengo el ritmo alto, pero la presión repetida termina reduciendo mi profundidad o control.",
        "Mantengo profundidad y posición a ritmo alto; una defensa extrema todavía puede dejar una oportunidad cómoda.",
        "Absorbo cambios de velocidad, recupero la posición y obligo al rival a sostener la presión.",
        "Frente al ritmo máximo anticipo, neutralizo y puedo transformar la defensa en iniciativa."
      ]
    }
  },
  "ataque": {
    "dimension": "Ataque y red",
    "prompt": null,
    "texts": {
      "low": [
        "Me cuesta ubicarme y controlar la volea, incluso con pelotas cómodas.",
        "Devuelvo voleas simples, pero pierdo la posición o quedo superado por el globo.",
        "Sostengo la red en intercambios lentos con mi compañero; la presión me obliga a retroceder o dejar una pelota fácil.",
        "Utilizo la volea o la bandeja para conservar la red, todavía de manera irregular."
      ],
      "mid": [
        "Controlo voleas cómodas; con velocidad o presión pierdo la posición.",
        "Sostengo la red y uso la volea o la bandeja; a veces acelero desde una posición desfavorable.",
        "Me coordino con mi compañero, conservo la red y elijo una pelota favorable para acelerar.",
        "Varío dirección y ritmo, recupero la red después del globo y mantengo la iniciativa bajo presión."
      ],
      "high": [
        "Controlo la posición; la presión sostenida todavía puede hacerme dejar una pelota cómoda o perder la red.",
        "Uso la volea y la bandeja para sostener la posición y recupero la red después del globo; a veces me precipito al definir.",
        "Varío direcciones y ritmos, elijo cuándo acelerar y mantengo la iniciativa bajo presión.",
        "A velocidad máxima anticipo las respuestas y transformo situaciones difíciles en ataques controlados."
      ]
    }
  },
  "defensa": {
    "dimension": "Defensa y paredes",
    "prompt": null,
    "texts": {
      "low": [
        "Intento jugar antes de la pared porque todavía no interpreto bien el rebote.",
        "Resuelvo rebotes simples y lentos de fondo; suelo llegar tarde o calcular mal.",
        "Utilizo la pared de fondo en situaciones habituales; la velocidad o los rebotes laterales me complican.",
        "Utilizo paredes de fondo y laterales para continuar el punto; todavía pierdo control en rebotes complejos."
      ],
      "mid": [
        "Resuelvo el rebote simple; una pelota rápida, profunda o lateral suele dejarme fuera de posición.",
        "Utilizo las paredes de fondo y laterales en situaciones habituales; los rebotes complejos me obligan a devolver fácil.",
        "Anticipo paredes simples y dobles, recupero la posición y normalmente mantengo una defensa neutral.",
        "Uso las paredes para quitar velocidad, soportar la presión y convertir una defensa difícil en una pelota controlada."
      ],
      "high": [
        "Controlo los rebotes habituales; una pelota muy profunda o compleja todavía puede dejarme defendiendo corto.",
        "Anticipo paredes dobles y sostengo la defensa con velocidad; las situaciones extremas pueden hacerme perder control.",
        "Uso las paredes para neutralizar la presión, recuperar la posición y convertir una defensa difícil en una pelota controlada.",
        "A velocidad máxima resuelvo rebotes complejos y transformo defensas extremas en contraataques sin perder la posición."
      ]
    }
  },
  "decisiones": {
    "dimension": "Decisiones y consistencia",
    "prompt": null,
    "texts": {
      "low": [
        "Me concentro en devolver la pelota, sin una idea clara de dónde jugar o cómo ubicarme.",
        "Conozco ideas como subir a la red o tirar un globo; reacciono tarde o intento atacar una pelota desfavorable.",
        "Intento construir el punto y moverme con mi compañero; cuando se prolonga pierdo el orden.",
        "Reconozco cuándo defender, reconstruir o atacar; todavía me cuesta ejecutarlo durante todo el partido."
      ],
      "mid": [
        "Entiendo la jugada, pero intento resolverla rápido y suelo entregar la iniciativa.",
        "Alterno momentos ordenados con otros en los que ataco desde una posición desfavorable.",
        "Construyo con paciencia y espero una pelota favorable; si la presión continúa, puedo perder el orden.",
        "Mantengo el plan, recupero posiciones y adapto mis decisiones durante todo el partido."
      ],
      "high": [
        "Construyo bien; la presión sostenida termina haciéndome perder profundidad, dirección o iniciativa.",
        "Conservo el orden, elijo una respuesta segura y espero una pelota favorable; ocasionalmente dejo una oportunidad cómoda.",
        "Administro ritmos y direcciones, anticipo la jugada y normalmente obligo al rival a construir para superarme.",
        "Mantengo lectura y calidad frente a presión extrema durante todo el partido, neutralizando o aprovechando situaciones difíciles."
      ]
    }
  }
});

  /* ------------------------------------------------------------------ */
  /* 2. FÓRMULA V1.3 (§8) — funciones puras.                              */
  /* ------------------------------------------------------------------ */

  function isValidPosition(p) {
    return typeof p === 'number' && Number.isInteger(p) && p >= 0 && p <= PARAMS.SLIDER_POSITIONS - 1;
  }

  /** Interpolación del slider: p=9 -> D; si no, segmento = floor(p/3), fracción = (p mod 3)/3. */
  function interpolateAnchor(anchors, p) {
    if (!Array.isArray(anchors) || anchors.length !== 4 || !isValidPosition(p)) return null;
    if (p === 9) return anchors[3];
    const segment = Math.floor(p / 3);
    const fraction = (p % 3) / 3;
    return anchors[segment] + fraction * (anchors[segment + 1] - anchors[segment]);
  }

  /** <4,1 baja; >=4,1 y <6,4 media; >=6,4 alta. El promedio se compara a 4 decimales (precisión
   *  interna), así un 4,1 "exacto" nunca cae del lado equivocado por ruido de coma flotante. */
  function branchForRunningMean(mean) {
    const m = round4(mean);
    if (m < PARAMS.BRANCH_LOW_BELOW) return 'low';
    if (m < PARAMS.BRANCH_HIGH_FROM) return 'mid';
    return 'high';
  }

  function anchorsFor(index, branch) {
    const id = QUESTION_IDS[index];
    if (!id) return null;
    return ANCHORS[id][index === 0 ? 'common' : branch] || null;
  }

  /** Rama de la pregunta `index` (1..4) a partir de las posiciones YA respondidas de las
   *  preguntas anteriores. `null` si alguna anterior falta. La pregunta 0 siempre es 'common'. */
  function branchForIndex(positions, index) {
    if (index === 0) return 'common';
    let sum = 0;
    let branchSoFar = null;
    for (let k = 0; k < index; k += 1) {
      const p = positions ? positions[k] : null;
      if (!isValidPosition(p)) return null;
      const anchors = anchorsFor(k, k === 0 ? 'common' : branchSoFar);
      sum += interpolateAnchor(anchors, p);
      branchSoFar = branchForRunningMean(sum / (k + 1));
    }
    return branchSoFar;
  }

  /** Confianza de origen: dispersión < 2,0 -> 0,15; >= 2,0 -> 0,10. */
  function computeOriginConfidence(spread) {
    return round4(spread) >= PARAMS.SPREAD_REVIEW_THRESHOLD
      ? PARAMS.CONFIDENCE_ORIGIN_SPREAD
      : PARAMS.CONFIDENCE_ORIGIN_COHERENT;
  }

  /** Normaliza las posiciones a un array de 5 desde un array o un objeto {panorama, ritmo, ...}. */
  function positionsToArray(positions) {
    if (Array.isArray(positions)) return positions.slice(0, QUESTION_IDS.length);
    if (positions && typeof positions === 'object') return QUESTION_IDS.map((id) => positions[id]);
    return null;
  }

  /** Estimación inicial V1.3 a partir de las 5 posiciones crudas (enteros 0..9). `null` si falta
   *  o es inválida alguna (nunca inventa un valor medio). Es EL cálculo que corre el servidor. */
  function computeInitialEstimateV13(positions) {
    const arr = positionsToArray(positions);
    if (!arr || arr.length !== QUESTION_IDS.length || !arr.every(isValidPosition)) return null;
    const values = [];
    const branches = ['common'];
    let sum = 0;
    for (let k = 0; k < QUESTION_IDS.length; k += 1) {
      if (k > 0) branches.push(branchForRunningMean(sum / k));
      const v = interpolateAnchor(anchorsFor(k, branches[k]), arr[k]);
      values.push(v);
      sum += v;
    }
    const initialLevel = round4(clamp(sum / QUESTION_IDS.length, PARAMS.ADJUSTED_LEVEL_MIN, PARAMS.ADJUSTED_LEVEL_MAX));
    const spread = round4(Math.max.apply(null, values) - Math.min.apply(null, values));
    return {
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      positions: QUESTION_IDS.reduce((acc, id, i) => { acc[id] = arr[i]; return acc; }, {}),
      branches: QUESTION_IDS.reduce((acc, id, i) => { acc[id] = branches[i]; return acc; }, {}),
      values: values.map(round4),
      initialLevel,
      // `raw` alias: la primitiva de recalibración (`confirmInitialLevel`) lee `rawResult.raw`.
      raw: initialLevel,
      spread,
      originConfidence: computeOriginConfidence(spread),
      // Dispersión >= 2,0: se OFRECE revisar respuestas; nunca bloquea y no se muestra como juicio.
      reviewSuggested: spread >= PARAMS.SPREAD_REVIEW_THRESHOLD,
    };
  }

  /** Confirma el nivel inicial V1.3. El nivel nunca se penaliza: la dispersión solo fija la
   *  confianza de origen (ya calculada en la estimación). */
  function confirmInitialLevelV13(estimate, confirmedAt) {
    if (!estimate || estimate.questionnaireVersion !== QUESTIONNAIRE_VERSION) return null;
    return {
      ok: true,
      origin: {
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        confirmedLevel: estimate.initialLevel,
        confidenceOrigin: estimate.originConfidence,
        spread: estimate.spread,
        coherenceFlag: estimate.reviewSuggested,
        values: estimate.values,
        positions: estimate.positions,
        branches: estimate.branches,
        // V1.3 no tiene categoría local: estas dos columnas se persisten siempre en NULL.
        declaredCategory: null,
        categoryContextKey: null,
        confirmedAt: confirmedAt || null,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 3. PROGRESO DEL CUESTIONARIO (estado puro, versionado, adaptativo).  */
  /* ------------------------------------------------------------------ */

  function createQuestionnaireState() {
    return { version: QUESTIONNAIRE_VERSION, positions: [null, null, null, null, null], branches: [null, null, null, null, null] };
  }

  /** Revalida un estado: recorre las preguntas en orden y, ante la primera respuesta cuya rama
   *  YA no coincide con la rama con la que se respondió, descarta esa y TODAS las posteriores
   *  (nunca reutiliza una posición del slider con textos de otra rama). Estado de otra versión
   *  -> estado nuevo vacío. */
  function reconcileQuestionnaireState(state) {
    if (!state || state.version !== QUESTIONNAIRE_VERSION || !Array.isArray(state.positions)) return createQuestionnaireState();
    const out = createQuestionnaireState();
    for (let k = 0; k < QUESTION_IDS.length; k += 1) {
      const p = state.positions[k];
      if (!isValidPosition(p)) break;
      const branch = branchForIndex(out.positions, k);
      if (branch == null) break;
      if (k > 0 && state.branches && state.branches[k] !== branch) break;
      out.positions[k] = p;
      out.branches[k] = branch;
    }
    return out;
  }

  /** Registra la respuesta `position` a la pregunta `index` y reconcilia las posteriores. Solo
   *  se puede responder una pregunta si todas las anteriores están respondidas. */
  function answerQuestion(state, index, position) {
    const base = reconcileQuestionnaireState(state);
    if (!isValidPosition(position) || index < 0 || index >= QUESTION_IDS.length) return base;
    if (index > 0 && !isValidPosition(base.positions[index - 1])) return base;
    const next = { version: QUESTIONNAIRE_VERSION, positions: base.positions.slice(), branches: base.branches.slice() };
    next.positions[index] = position;
    next.branches[index] = branchForIndex(next.positions, index);
    return reconcileQuestionnaireState(next);
  }

  function isQuestionnaireComplete(state) {
    const s = reconcileQuestionnaireState(state);
    return s.positions.every(isValidPosition);
  }

  /** Índice de la primera pregunta sin responder (o el último índice si está completo). */
  function firstUnansweredIndex(state) {
    const s = reconcileQuestionnaireState(state);
    const i = s.positions.findIndex((p) => !isValidPosition(p));
    return i === -1 ? QUESTION_IDS.length - 1 : i;
  }

  /** Textos (4 descripciones, en orden de menor a mayor dominio) y título de la pregunta `index`
   *  según la rama resultante de las respuestas anteriores. `null` si todavía no corresponde. */
  function questionView(state, index) {
    const id = QUESTION_IDS[index];
    if (!id) return null;
    const branch = branchForIndex(state ? state.positions : null, index);
    if (branch == null) return null;
    const entry = QUESTION_BANK[id];
    return {
      id, index, dimension: entry.dimension, prompt: entry.prompt || null,
      texts: entry.texts[index === 0 ? 'common' : branch],
      position: state && isValidPosition(state.positions[index]) ? state.positions[index] : null,
    };
  }

  /** Borrador de alta heredado de V1.2 (o cualquier versión distinta): se descartan ÚNICAMENTE
   *  las claves de Nivel; cuenta, email, perfil y username se conservan intactos. */
  const LEGACY_DRAFT_NIVEL_KEYS = Object.freeze(['nivelPathType', 'nivelQuickSeedKey', 'nivelQuizAnswers', 'nivelState']);
  function stripLegacyNivelDraft(draft) {
    if (!draft || typeof draft !== 'object') return { draft, removed: false };
    const v13 = draft.nivelQuestionnaireVersion === QUESTIONNAIRE_VERSION && draft.nivelAnswers && draft.nivelState;
    const hasLegacy = LEGACY_DRAFT_NIVEL_KEYS.some((k) => draft[k] != null) || draft.nivelAnswers != null || draft.nivelQuestionnaireVersion != null;
    if (v13 || !hasLegacy) return { draft, removed: false };
    const clean = Object.assign({}, draft);
    LEGACY_DRAFT_NIVEL_KEYS.concat(['nivelAnswers', 'nivelQuestionnaireVersion']).forEach((k) => { delete clean[k]; });
    return { draft: clean, removed: true };
  }

  /* ------------------------------------------------------------------ */
  /* 4. AJUSTE ACOTADO — primitiva reutilizada EXCLUSIVAMENTE por la       */
  /* recalibración (§12 del handoff 111: el cuestionario V1.3 aporta 25 % y */
  /* el movimiento provisional queda limitado a ±0,5). El estimador inicial */
  /* V1.3 NO la usa: no hay ajuste manual ni por categoría.                 */
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
        questionnaireVersion: rawResult.questionnaireVersion || null,
        rawLevel: rawResult.raw,
        adjustment: round4(adjustment || 0),
        confirmedLevel,
        confirmedAt: confirmedAt || null,
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 5. ESTADO INICIAL — al confirmar, arranca CALIBRANDO.                 */
  /* ------------------------------------------------------------------ */

  /** `originType`: siempre 'full' en V1.3 (único cuestionario; ver QUESTIONNAIRE_MODE).
   *  `confirmResult` viene de `confirmInitialLevelV13` — su `origin.confidenceOrigin` YA es la
   *  confianza correcta (0,15 / 0,10 según la dispersión): esta función solo la propaga.
   *  Las respuestas (posiciones del slider) quedan SOLO dentro de `origin.questionnaireAnswers`,
   *  como dato declarado — nunca se usan como si fueran un hecho deportivo observado. */
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
  /* 6. CALIBRACIÓN (§10.2) — transición CALIBRANDO -> CALIBRADO           */
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
  /* 7. RECALIBRACIÓN (§11) — cooldown 90 días, ancla provisional,        */
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

  /** El cuestionario de recalibración ES el V1.3 (`rawResult` = `computeInitialEstimateV13`) y
   *  reutiliza EXACTAMENTE el mismo mecanismo de confirmación acotada que ya existía — nunca una
   *  segunda implementación de "confirmar+ajustar". Su `confirmedLevel` es el `qNuevoConfirmed`
   *  de `startRecalibration` (peso 25 %, movimiento provisional máx. ±0,5). */
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
  /* 8. CATEGORÍAS DE COMUNICACIÓN (legado) — puramente de presentación (qué */
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
    QUESTIONNAIRE_MODE,
    QUESTION_IDS,
    BRANCHES,
    ANCHORS,
    QUESTION_BANK,
    isValidPosition,
    interpolateAnchor,
    branchForRunningMean,
    branchForIndex,
    computeOriginConfidence,
    computeInitialEstimateV13,
    confirmInitialLevelV13,
    createQuestionnaireState,
    reconcileQuestionnaireState,
    answerQuestion,
    isQuestionnaireComplete,
    firstUnansweredIndex,
    questionView,
    stripLegacyNivelDraft,
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
