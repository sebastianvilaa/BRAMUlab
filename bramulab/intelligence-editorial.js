/* ==========================================================================
   BRAMU Lab — intelligence-editorial.js (Backend Bloque 8, Fase C)
   Capa pura de RELEVANCIA Y MEMORIA EDITORIAL para BRAMU Intelligence V1.
   Cero DOM, cero localStorage, cero red — construida por COMPOSICIÓN sobre
   `PLIntelligenceClaims` (Fase B, CERRADA en Staging): nunca reabre esa API,
   nunca recalcula evidencia, nunca inventa un claim nuevo.

   División de responsabilidad (docs/BRAMUlab/Implementacion/Backend/
   Bloque_08/10_Handoff_Fase_C_Claude.md): este módulo puntúa, prioriza,
   deduplica semánticamente, aplica cooldowns/memoria editorial y selecciona
   1 principal + hasta 2 secundarios — NUNCA redacta texto final (Fase D),
   NUNCA integra Nivel/Ranking (Fase E) y NUNCA activa capa generativa
   (Fase F). Ningún claim descartado por Fase B (`discarded:true`) puede
   revivirse acá — es el mismo criterio de "0 claims sin evidencia" de B,
   aplicado hacia adelante.

   PUNTAJE V1 (BRAMU_Intelligence.md §6.1) — pesos máximos y penalizaciones
   CERRADOS por la fuente:
     cambio/excepcionalidad 25 · relevancia personal 20 · especificidad
     relacional 15 · confianza de evidencia 20 · actualidad narrativa 10 ·
     novedad editorial 10 = 100. Penalizaciones: −30 repetir el score visible
     sin comparación · −20 otro candidato SELECCIONADO ya cuenta la misma
     historia · −15 misma familia principal en los últimos 2 partidos · −10
     misma plantilla exacta de los últimos 5 (Fase D todavía no asigna
     `templateId` — ver §8 del handoff: esta penalización nunca se dispara
     en esta ronda, pero el camino de código existe). Umbral de publicación:
     55/100 (§6.1/§6.4).

   LO QUE LA FUENTE **NO** DA (handoff §6): una fórmula numérica exhaustiva
   de cuánto vale cada SUBTIPO de claim dentro de cada dimensión de 25/20/
   15/20/10/10. Este módulo resuelve eso con una tabla ÚNICA, explícita y
   versionada por `insightType` (`EDITORIAL_PROFILE_BY_INSIGHT_TYPE`, más
   abajo) que traduce cada categoría de prioridad de §6.2 en 3 atributos
   (rango de prioridad, nivel de excepcionalidad, si representa un cambio
   "ahora") — reutilizando SIEMPRE datos ya cerrados de Fase A/B
   (`confidenceTier`, `officialScope`, familia, presencia de una entidad
   relacional) para todo lo que sí es derivable sin autoría nueva. Esta
   tabla es un PARÁMETRO DE FASE C, no un número tomado literalmente de
   `BRAMU_Intelligence.md` — ver DECISIÓN ABIERTA #1 en el informe de esta
   ronda. No bloquea la fase: es exactamente lo que el handoff autoriza
   ("parametrizar decisiones... no esconder heurísticas nuevas como si
   estuvieran documentadas").

   FORMA RECIENTE (handoff §6, nota explícita): la fuente exige una
   diferencia "material" para hablar de "mejoró/empeoró" sin fijar el
   umbral numérico. Este módulo NUNCA agrega ese juicio: `forma_reciente`
   se puntúa/selecciona como cualquier otro candidato factual, pero su
   `claim` sigue siendo exactamente el que entregó Fase B (balance exacto de
   ambas ventanas) — jamás se le añade un campo "mejoró"/"empeoró".

   DEDUPLICACIÓN SEMÁNTICA (handoff §7): por `semanticKey`, nunca por texto
   ni por un ID técnico usado como criterio de importancia. Ver
   `semanticKeyOf` — agrupa, entre otros, los 3 ejemplos literales del
   handoff (racha+forma cuando se solapan totalmente, "primer partido con X"
   + "compañero nuevo X", y los `_primer_enfrentamiento` de un mismo debut).
   ========================================================================== */
(function (global) {
  'use strict';

  const RULES_VERSION = 'bramu_intelligence_editorial_v1';
  const PUBLISH_THRESHOLD = 55; // §6.1/§6.4
  const MAX_SECONDARY = 2; // §6.5 paso 7
  const SAME_FAMILY_PRINCIPAL_WINDOW = 2; // §6.1 penalización −15 / §7.3
  const RELATIONAL_NO_CHANGE_WINDOW = 4; // §7.3 "mismo hecho relacional... o pasen 4 partidos"
  const STREAK_SHOWABLE_MIN = 3; // mismo umbral que Fase B (BRAMU_Intelligence.md §5.3)

  /* ------------------------------------------------------------------ */
  /* 0. PERFIL EDITORIAL POR insightType — DECISIÓN ABIERTA #1 (ver cabecera) */
  /* ------------------------------------------------------------------ */

  /** `priorityRank` = categoría de §6.2 (1 = más prioritaria). `exceptionality` alimenta la
   *  dimensión "cambio o excepcionalidad" (25 max). `representsChange` alimenta "actualidad
   *  narrativa" (10 max): ¿esto describe algo que cambió A RAÍZ de este partido, o es un balance
   *  estable que existiría igual sin él? `genericScoreOnly` dispara la penalización −30 (§6.1:
   *  "repite el score visible sin comparación") — solo la descripción más genérica del score
   *  (§6.2 categoría 8) califica; `reversion_tras_perder_primer_set`/`alternancia_de_sets` SÍ
   *  comparan algo (el desarrollo de sets dentro del propio partido), así que no llevan esta
   *  penalización. Categoría 2 (§6.2, expectativa de Nivel) queda reservada y vacía: Familia H
   *  no existe todavía (Fase E). */
  const EDITORIAL_PROFILE_BY_INSIGHT_TYPE = {
    // Categoría 1 — hito excepcional o quiebre de tendencia.
    racha_cortada: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    racha_nuevo_record_personal: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    racha_iguala_record_personal: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    hito_de_victorias: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    primera_victoria_registrada: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    primer_partido_de_la_historia: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    // Categoría 3 — récord o mejor marca personal.
    companero_mejor_balance: { priorityRank: 3, exceptionality: 'high', representsChange: false },
    score_excepcional_formato_comparable: { priorityRank: 3, exceptionality: 'high', representsChange: true },
    // Categoría 4 — historia específica con compañero/rival/cruce. Los "primer encuentro" y
    // "primer triunfo tras derrotas" SÍ "inician/marcan algo fuera de lo normal" (exceptionality
    // media/alta); un BALANCE en curso (companero_balance, rival_balance, pareja_rival_balance,
    // cruce_exacto_balance, contexto_dificultad_previa_rival) es un hecho ESTABLE que no
    // "corta/inicia/iguala/marca" nada por sí solo (§6.1, la pregunta de esta dimensión) — su
    // peso ya viene de "relevancia personal" + "especificidad relacional", no de excepcionalidad.
    companero_balance: { priorityRank: 4, exceptionality: 'low', representsChange: false },
    companero_primer_partido_juntos: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    companero_primera_victoria_juntos: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    contexto_companero_nuevo: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    rival_balance: { priorityRank: 4, exceptionality: 'low', representsChange: false },
    pareja_rival_balance: { priorityRank: 4, exceptionality: 'low', representsChange: false },
    cruce_exacto_balance: { priorityRank: 4, exceptionality: 'low', representsChange: false },
    rival_primer_enfrentamiento: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    pareja_rival_primer_enfrentamiento: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    cruce_exacto_primer_enfrentamiento: { priorityRank: 4, exceptionality: 'medium', representsChange: true },
    rival_primer_triunfo_tras_derrotas: { priorityRank: 4, exceptionality: 'high', representsChange: true },
    pareja_rival_primer_triunfo_tras_derrotas: { priorityRank: 4, exceptionality: 'high', representsChange: true },
    cruce_exacto_primer_triunfo_tras_derrotas: { priorityRank: 4, exceptionality: 'high', representsChange: true },
    contexto_dificultad_previa_rival: { priorityRank: 4, exceptionality: 'low', representsChange: false },
    // Categoría 5 — racha o cambio material de forma. La racha ya está gateada por cooldown para
    // solo ser candidata en el momento justo en que se vuelve mostrable (ver §4 más abajo), así
    // que sí conserva excepcionalidad media; `forma_reciente` es un balance móvil ESTABLE (mismo
    // criterio que los balances de la categoría 4).
    racha_de_victorias: { priorityRank: 5, exceptionality: 'medium', representsChange: true },
    racha_de_derrotas: { priorityRank: 5, exceptionality: 'medium', representsChange: true },
    forma_reciente: { priorityRank: 5, exceptionality: 'low', representsChange: false },
    // Categoría 6 — patrón histórico de score. Mismo criterio de "balance estable" que arriba.
    balance_perdiendo_primer_set: { priorityRank: 6, exceptionality: 'low', representsChange: false },
    // Categoría 7 — lectura particular del resultado actual.
    reversion_tras_perder_primer_set: { priorityRank: 7, exceptionality: 'medium', representsChange: true },
    alternancia_de_sets: { priorityRank: 7, exceptionality: 'low', representsChange: true },
    contexto_regreso_tras_inactividad: { priorityRank: 7, exceptionality: 'medium', representsChange: true },
    // Categoría 8 — descripción genérica del score.
    sets_corridos: { priorityRank: 8, exceptionality: 'low', representsChange: false, genericScoreOnly: true },
    definicion_en_tres_sets: { priorityRank: 8, exceptionality: 'low', representsChange: false, genericScoreOnly: true },
  };

  function profileOf(insightType) {
    return EDITORIAL_PROFILE_BY_INSIGHT_TYPE[insightType] || { priorityRank: 8, exceptionality: 'low', representsChange: false };
  }

  /* ------------------------------------------------------------------ */
  /* 1. semanticKey — deduplicación por HISTORIA, nunca por texto (§7)    */
  /* ------------------------------------------------------------------ */

  /** Agrupa candidatos que responden la MISMA pregunta narrativa. Un ID técnico (matchId,
   *  scopeKey) puede aparecer DENTRO de la clave para distinguir historias genuinamente
   *  distintas (compañero A vs compañero B) — nunca para decidir cuál de dos historias iguales
   *  es "más importante": eso lo decide el puntaje, nunca el desempate técnico (handoff §7,
   *  último párrafo). */
  function semanticKeyOf(candidate) {
    const { insightType, claim, comparisonScope } = candidate;
    switch (insightType) {
      case 'racha_de_victorias':
      case 'racha_de_derrotas':
      case 'racha_cortada':
      case 'racha_nuevo_record_personal':
      case 'racha_iguala_record_personal':
        // Las 5 variantes de racha de ESTE partido son, por construcción, la MISMA racha vigente
        // (nunca coexisten dos rachas activas a la vez) — un solo bucket, la más fuerte gana.
        return 'racha_vigente';
      case 'primer_partido_de_la_historia':
      case 'primera_victoria_registrada':
        // Handoff §7, ejemplo 2 (adaptado): el debut ganado es UN solo evento, no dos historias.
        return 'debut_historia';
      case 'hito_de_victorias':
        // Bare a propósito (sin `comparisonScope`/conteo): solo existe UN candidato de este tipo
        // por partido, así que no hace falta granularidad extra para deduplicar dentro de la
        // misma selección. El conteo exacto (10/25/50/100) vive en `milestoneKey`, calculado
        // aparte en `cooldownReason`/la actualización de memoria — nunca en `semanticKey`.
        return 'hito_de_victorias';
      case 'companero_primer_partido_juntos':
      case 'contexto_companero_nuevo':
        // Handoff §7, ejemplo 2 literal: "primer partido con X" + "compañero nuevo X".
        return `companero_debut:${claim.companionPlayerId}`;
      case 'companero_primera_victoria_juntos':
        return `companero_primera_victoria:${claim.companionPlayerId}`;
      case 'companero_balance':
        return `companero_balance:${claim.companionPlayerId}`;
      case 'rival_primer_enfrentamiento':
      case 'pareja_rival_primer_enfrentamiento':
      case 'cruce_exacto_primer_enfrentamiento':
        // Handoff §7, ejemplo 3: los 3 alcances de rival narran el MISMO debut cuando coinciden
        // en el mismo partido (agrupar por `dataAsOf`, que en Fase B es siempre el partido
        // evaluado — nunca por scopeKey, que es distinto para cada alcance a propósito).
        return `primer_encuentro_rival:${candidate.dataAsOf}`;
      case 'rival_balance':
      case 'contexto_dificultad_previa_rival':
        // Ambos narran "tu relación histórica con este rival concreto" — agrupados por el rival,
        // no por el scope técnico, que difiere entre balance y contexto. `rival_balance` guarda
        // el id del rival en `claim.scopeKey` (Fase B); `contexto_dificultad_previa_rival` lo
        // guarda en `claim.rivalPlayerId` — nunca el mismo nombre de campo entre los dos.
        return `rival_relacion:${claim.scopeKey || claim.rivalPlayerId}`;
      case 'rival_primer_triunfo_tras_derrotas':
      case 'pareja_rival_primer_triunfo_tras_derrotas':
      case 'cruce_exacto_primer_triunfo_tras_derrotas':
        return `primer_triunfo_tras_derrotas:${comparisonScope}`;
      case 'pareja_rival_balance':
      case 'cruce_exacto_balance':
        return `${insightType}:${comparisonScope}`;
      default:
        return `${insightType}:${comparisonScope}`;
    }
  }

  /* ------------------------------------------------------------------ */
  /* 2. Confianza de evidencia — reutiliza Fase B, nunca inventa una nueva */
  /* ------------------------------------------------------------------ */

  const CONFIDENCE_TIER_BASE = {
    tendencia: 20, establecido: 20, habitual: 15, partido_unico: 12, temprano: 8, primer_antecedente: 5,
  };
  const OFFICIAL_SCOPE_FACTOR = { oficial: 1, mixto: 0.9, personal: 0.85 };

  function confidenceScore(candidate) {
    const base = CONFIDENCE_TIER_BASE[candidate.confidenceTier] || 5;
    const factor = OFFICIAL_SCOPE_FACTOR[candidate.officialScope] || 0.85;
    return Math.min(20, Math.round(base * factor));
  }

  function isRelational(candidate) {
    const c = candidate.claim || {};
    return !!(c.companionPlayerId || c.rivalPlayerId || c.scopeKey);
  }

  /* ------------------------------------------------------------------ */
  /* 3. Memoria editorial — contrato mínimo por jugador (§7.1)            */
  /* ------------------------------------------------------------------ */

  function emptyMemory() {
    return {
      rulesVersion: RULES_VERSION,
      // Últimos 5 principales (familia + matchId) — §7.1 pide la ventana de 5 completa; la
      // penalización −15/novedad editorial solo miran los últimos 2, pero la memoria conserva 5
      // para que Fase D/futuras rondas puedan usar el resto sin otra migración de estructura.
      recentPrincipalFamilies: [],
      // Por semanticKey: última aparición + firma de valor mostrada (para "cambió el balance").
      shownSemanticKeys: {},
      // Hitos permanentes ya mostrados alguna vez — nunca se borran (§7.3 "una sola aparición").
      shownMilestoneKeys: {},
    };
  }

  function valueSignatureOf(candidate) {
    const c = candidate.claim || {};
    if (typeof c.wins === 'number' || typeof c.losses === 'number') return `${c.wins || 0}-${c.losses || 0}`;
    if (typeof c.priorLosses === 'number') return `priorLosses:${c.priorLosses}`;
    if (typeof c.length === 'number') return `length:${c.length}`;
    return candidate.matchId || candidate.dataAsOf || '';
  }

  /** ¿Este semanticKey pertenece a un hito de "una sola aparición" (§7.3), o a un hecho
   *  relacional que se rige por la regla de 4 partidos/cambio de balance? Los hitos ya son, en
   *  su enorme mayoría, estructuralmente irrepetibles desde Fase B (un `isFirstEncounter`/
   *  `isFirstWinEver` solo puede ser cierto una vez) — esta función es la defensa explícita en
   *  profundidad que pide la prueba mínima #9 del handoff, no el único mecanismo. */
  function isOneTimeMilestoneKey(semanticKey) {
    return semanticKey === 'debut_historia'
      || semanticKey.indexOf('companero_debut:') === 0
      || semanticKey.indexOf('companero_primera_victoria:') === 0
      || semanticKey.indexOf('primer_encuentro_rival:') === 0
      || semanticKey.indexOf('primer_triunfo_tras_derrotas:') === 0
      || semanticKey === 'hito_de_victorias'; // se afina por conteo exacto vía claim.winCount abajo
  }

  /* ------------------------------------------------------------------ */
  /* 4. Cooldowns — exclusión dura antes de puntuar (§7.3)                */
  /* ------------------------------------------------------------------ */

  /** Devuelve `null` si el candidato pasa todos los cooldowns, o un código de motivo si debe
   *  excluirse. `historyAsc` se usa SOLO para medir "partidos transcurridos" por posición, nunca
   *  para recalcular evidencia (eso ya lo hizo Fase B). */
  function cooldownReason(candidate, semanticKey, memory, historyAsc) {
    // Racha: "mostrar al llegar a 3... no necesariamente en cada extensión" — la variante SIMPLE
    // (sin récord) solo es elegible exactamente en el umbral mostrable; extensiones posteriores
    // sin récord quedan cubiertas por esta regla, nunca por "cambió el balance en 4 partidos"
    // (que es la regla de hechos RELACIONALES, no de rachas).
    if ((candidate.insightType === 'racha_de_victorias' || candidate.insightType === 'racha_de_derrotas')
      && candidate.claim.length !== STREAK_SHOWABLE_MIN) {
      return 'racha_no_en_cada_extension';
    }

    const milestoneKey = candidate.insightType === 'hito_de_victorias'
      ? `hito_de_victorias:${candidate.claim.winCount}`
      : semanticKey;
    if (isOneTimeMilestoneKey(semanticKey) && memory.shownMilestoneKeys[milestoneKey]) {
      return 'mismo_hito_ya_mostrado';
    }

    // Hecho relacional: no repetir hasta que cambie el balance o pasen 4 partidos (§7.3).
    const shown = memory.shownSemanticKeys[semanticKey];
    if (shown && isRelational(candidate) && !isOneTimeMilestoneKey(semanticKey)) {
      const currentSignature = valueSignatureOf(candidate);
      if (currentSignature === shown.lastValueSignature) {
        const lastIndex = (historyAsc || []).findIndex((m) => m.matchId === shown.lastMatchId);
        const currentIndex = (historyAsc || []).length - 1;
        const matchesSince = lastIndex === -1 ? Infinity : currentIndex - lastIndex;
        if (matchesSince < RELATIONAL_NO_CHANGE_WINDOW) return 'mismo_hecho_relacional_sin_cambio';
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* 5. Puntaje V1 (§6.1)                                                 */
  /* ------------------------------------------------------------------ */

  function novedadEditorialScore(semanticKey, memory, historyAsc) {
    const shown = memory.shownSemanticKeys[semanticKey];
    if (!shown) return 10;
    const lastIndex = (historyAsc || []).findIndex((m) => m.matchId === shown.lastMatchId);
    const currentIndex = (historyAsc || []).length - 1;
    const matchesSince = lastIndex === -1 ? Infinity : currentIndex - lastIndex;
    if (matchesSince <= SAME_FAMILY_PRINCIPAL_WINDOW) return 0;
    if (matchesSince < RELATIONAL_NO_CHANGE_WINDOW) return 5;
    return 10;
  }

  /** Arma el desglose completo de puntaje — nunca solo el número final, para que la decisión sea
   *  reconstruible (§6.5 paso 10). */
  function scoreCandidate(candidate, semanticKey, memory, historyAsc) {
    const profile = profileOf(candidate.insightType);
    const dims = {
      cambioOExcepcionalidad: profile.exceptionality === 'high' ? 25 : profile.exceptionality === 'medium' ? 15 : 5,
      relevanciaPersonal: profile.genericScoreOnly ? 8 : 20,
      especificidadRelacional: isRelational(candidate) ? 15 : 0,
      confianzaDeEvidencia: confidenceScore(candidate),
      actualidadNarrativa: profile.representsChange ? 10 : 4,
      novedadEditorial: novedadEditorialScore(semanticKey, memory, historyAsc),
    };
    const rawScore = Object.values(dims).reduce((s, v) => s + v, 0);

    const penalties = [];
    if (profile.genericScoreOnly) penalties.push({ code: 'repite_score_sin_comparacion', value: -30 });
    const recentPrincipal = memory.recentPrincipalFamilies.slice(-SAME_FAMILY_PRINCIPAL_WINDOW);
    if (recentPrincipal.some((p) => p.family === candidate.family)) {
      penalties.push({ code: 'misma_familia_principal_ultimos_2', value: -15 });
    }
    // −10 "misma plantilla exacta de los últimos 5": Fase D todavía no asigna `templateId`
    // (handoff §8) — el candidato nunca lo trae en esta ronda, así que esta penalización nunca
    // se dispara todavía; el camino de código queda listo para cuando exista.
    if (candidate.templateId && memory.recentTemplateIds && memory.recentTemplateIds.indexOf(candidate.templateId) !== -1) {
      penalties.push({ code: 'misma_plantilla_ultimos_5', value: -10 });
    }
    const penaltyTotal = penalties.reduce((s, p) => s + p.value, 0);
    const finalScore = rawScore + penaltyTotal;

    return { dimensions: dims, rawScore, penalties, finalScore };
  }

  /* ------------------------------------------------------------------ */
  /* 6. Orden estable — prioridad editorial + ID estable, NUNCA azar (§6.2) */
  /* ------------------------------------------------------------------ */

  function stableId(candidate) {
    return `${candidate.insightType}|${candidate.comparisonScope}|${(candidate.evidenceMatchIds || []).slice().sort().join(',')}`;
  }

  function compareForSelection(a, b) {
    if (b.scored.finalScore !== a.scored.finalScore) return b.scored.finalScore - a.scored.finalScore;
    const rankA = profileOf(a.insightType).priorityRank;
    const rankB = profileOf(b.insightType).priorityRank;
    if (rankA !== rankB) return rankA - rankB;
    const idA = stableId(a);
    const idB = stableId(b);
    return idA < idB ? -1 : (idA > idB ? 1 : 0);
  }

  const STREAK_INSIGHT_TYPES = [
    'racha_de_victorias', 'racha_de_derrotas', 'racha_cortada', 'racha_nuevo_record_personal', 'racha_iguala_record_personal',
  ];

  /** Handoff §7, ejemplo 1 literal: "racha de 4 victorias" + "4 victorias en los últimos 4/5"
   *  como dos historias distintas debe impedirse. No hay un umbral numérico de la fuente para
   *  "cuándo se solapan lo suficiente" — la condición elegida (documentada, no oculta) es
   *  estructural y verificable: si la longitud de la racha vigente es AL MENOS tan larga como la
   *  ventana de `forma_reciente` (5), la racha explica el 100% de esa ventana (todos los
   *  partidos de los últimos 5 son parte de la misma racha activa) y ambas comparten
   *  `semanticKey` — el puntaje decide cuál de las dos representaciones sobrevive. Si la racha
   *  es más corta que la ventana, quedan como historias distintas — mismo criterio que separa
   *  "racha" de "forma reciente" en `BRAMU_Intelligence.md` §5.3. Solo aplica a
   *  `racha_de_victorias`/`racha_de_derrotas`/las variantes de récord (todas tienen `claim.length`
   *  numérico) — `racha_cortada` no participa: su "racha vigente" es de longitud 1, nunca cubre
   *  una ventana de 5. */
  function mergeStreakAndRecentFormWhenFullyOverlapping(evaluated) {
    const forma = evaluated.find((e) => e.candidate.insightType === 'forma_reciente' && e.scored);
    const windowSize = forma && forma.candidate.claim.current && forma.candidate.claim.current.sampleSize;
    if (!forma || !windowSize) return;
    const streak = evaluated.find((e) => e.scored
      && STREAK_INSIGHT_TYPES.indexOf(e.candidate.insightType) !== -1
      && typeof e.candidate.claim.length === 'number'
      && e.candidate.claim.length >= windowSize);
    if (streak) forma.semanticKey = streak.semanticKey;
  }

  /* ------------------------------------------------------------------ */
  /* 7. ORQUESTADOR                                                       */
  /* ------------------------------------------------------------------ */

  /** `historyAsc`/`callerPlayerId`: mismo contrato de Fase A/B (historia personal truncada hasta
   *  el partido de interés inclusive). `priorMemory`: memoria editorial previa del jugador
   *  (`emptyMemory()` si no existe todavía). Devuelve un objeto determinístico y auditable — ver
   *  cabecera del archivo para el contrato completo. Nunca persiste nada: la actualización de
   *  memoria se PROPONE (`memoryUpdate`), el llamador decide cuándo/si guardarla. */
  function buildEditorialDecision(historyAsc, callerPlayerId, priorMemory) {
    const CL = global.PLIntelligenceClaims;
    const memory = priorMemory || emptyMemory();
    const { ctx, claims } = CL.buildClaimsForMatch(historyAsc, callerPlayerId);
    if (!ctx) return { ctx: null, evaluated: [], principal: null, secondary: [], abstention: true, memoryUpdate: memory, rulesVersion: RULES_VERSION };

    // "0 claims sin evidencia": ningún candidato descartado por Fase B puede revivirse acá
    // (prueba mínima #13 del handoff) — se filtran ANTES de cualquier otra evaluación.
    const affirmed = claims.filter((c) => !c.discarded);

    const evaluated = affirmed.map((candidate) => {
      const semanticKey = semanticKeyOf(candidate);
      const excludedBy = cooldownReason(candidate, semanticKey, memory, historyAsc);
      if (excludedBy) {
        return { candidate, semanticKey, status: 'excluded_by_cooldown', excludedReason: excludedBy, scored: null };
      }
      const scored = scoreCandidate(candidate, semanticKey, memory, historyAsc);
      const status = scored.finalScore >= PUBLISH_THRESHOLD ? 'above_threshold' : 'below_threshold';
      return { candidate, semanticKey, status, scored };
    });
    mergeStreakAndRecentFormWhenFullyOverlapping(evaluated);

    const eligible = evaluated.filter((e) => e.status === 'above_threshold')
      .map((e) => Object.assign({}, e.candidate, { semanticKey: e.semanticKey, scored: e.scored }));
    eligible.sort(compareForSelection);

    let principal = null;
    const secondary = [];
    const usedSemanticKeys = new Set();
    const usedFamilies = new Set();
    eligible.forEach((candidate) => {
      if (usedSemanticKeys.has(candidate.semanticKey)) return; // §6.1 −20 operacionalizado: nunca 2 que cuenten la misma historia
      if (!principal) {
        principal = candidate;
        usedSemanticKeys.add(candidate.semanticKey);
        usedFamilies.add(candidate.family);
        return;
      }
      if (secondary.length >= MAX_SECONDARY) return;
      if (usedFamilies.has(candidate.family)) return; // §6.5 paso 7: familias diferentes
      secondary.push(candidate);
      usedSemanticKeys.add(candidate.semanticKey);
      usedFamilies.add(candidate.family);
    });

    const abstention = !principal;

    // Memoria propuesta: refleja SOLO lo efectivamente seleccionado (§7.1 "insight MOSTRADO"),
    // nunca los candidatos evaluados que no llegaron a mostrarse.
    const shown = principal ? [principal].concat(secondary) : [];
    const memoryUpdate = {
      rulesVersion: RULES_VERSION,
      recentPrincipalFamilies: principal
        ? memory.recentPrincipalFamilies.concat([{ family: principal.family, matchId: ctx.matchId }]).slice(-5)
        : memory.recentPrincipalFamilies.slice(),
      shownSemanticKeys: Object.assign({}, memory.shownSemanticKeys),
      shownMilestoneKeys: Object.assign({}, memory.shownMilestoneKeys),
    };
    shown.forEach((candidate) => {
      memoryUpdate.shownSemanticKeys[candidate.semanticKey] = {
        lastMatchId: ctx.matchId, lastValueSignature: valueSignatureOf(candidate),
      };
      if (isOneTimeMilestoneKey(candidate.semanticKey)) {
        const milestoneKey = candidate.insightType === 'hito_de_victorias'
          ? `hito_de_victorias:${candidate.claim.winCount}`
          : candidate.semanticKey;
        memoryUpdate.shownMilestoneKeys[milestoneKey] = true;
      }
    });

    return {
      ctx,
      evaluated, // TODOS los candidatos afirmados por Fase B, con status/score/motivo — nunca omitidos.
      principal,
      secondary,
      abstention,
      memoryUpdate,
      rulesVersion: RULES_VERSION,
    };
  }

  global.PLIntelligenceEditorial = {
    RULES_VERSION,
    PUBLISH_THRESHOLD,
    MAX_SECONDARY,
    SAME_FAMILY_PRINCIPAL_WINDOW,
    RELATIONAL_NO_CHANGE_WINDOW,
    emptyMemory,
    semanticKeyOf,
    valueSignatureOf,
    scoreCandidate,
    cooldownReason,
    buildEditorialDecision,
  };
})(typeof window !== 'undefined' ? window : globalThis);
