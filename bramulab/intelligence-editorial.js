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
   *  penalización. Categoría 2 (§6.2, expectativa de Nivel BRAMU) la ocupa Familia H (Fase E,
   *  `bramulab/intelligence-official.js`) — ver las entradas `nivel_*` más abajo. */
  const EDITORIAL_PROFILE_BY_INSIGHT_TYPE = {
    // Categoría 1 — hito excepcional o quiebre de tendencia.
    racha_cortada: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    racha_nuevo_record_personal: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    racha_iguala_record_personal: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    hito_de_victorias: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    primera_victoria_registrada: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    primer_partido_de_la_historia: { priorityRank: 1, exceptionality: 'high', representsChange: true },
    // Categoría 2 — resultado por encima/debajo de expectativa confiable de Nivel BRAMU (Fase E,
    // Familia H). `nivel_por_encima_expectativa` es una sorpresa confiable real (excepcionalidad
    // alta); `nivel_pareja_por_debajo`/`nivel_tres_niveles_pareja_por_debajo` narran lo mismo con
    // menos certeza (3 niveles conocidos en vez de 4) — excepcionalidad media, nunca alta, para
    // que la plantilla de Fase D pueda seguir el mandato de "lenguaje acotado, nunca sorpresa"
    // sin depender de un texto que el score no respalda. `nivel_evidencia_limitada` nunca
    // clasifica dificultad (§4.6) — es informativo, no un quiebre, por eso vive en la categoría 7
    // (lectura particular) en vez de acá. `nivel_resultado_esperable`/`nivel_variacion` NUNCA
    // pueden ser festejo principal por sí solos (§4.4/§4.7) — `genericScoreOnly` en el primero
    // reutiliza la MISMA penalización −30 que ya protege `sets_corridos`/`definicion_en_tres_sets`
    // (describir lo esperable sin comparación nueva), y el segundo queda en categoría 7 con
    // excepcionalidad baja: un número que se informa siempre, nunca un titular por sí mismo.
    nivel_por_encima_expectativa: { priorityRank: 2, exceptionality: 'high', representsChange: true },
    nivel_pareja_por_debajo: { priorityRank: 2, exceptionality: 'medium', representsChange: true },
    nivel_tres_niveles_pareja_por_debajo: { priorityRank: 2, exceptionality: 'medium', representsChange: false },
    nivel_resultado_esperable: { priorityRank: 2, exceptionality: 'low', representsChange: false, genericScoreOnly: true },
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
    // Fase E — informativos de Nivel BRAMU, nunca clasifican dificultad (§4.6/§4.7): evidencia
    // limitada/calibración en curso, y la variación oficial exacta del jugador.
    nivel_evidencia_limitada: { priorityRank: 7, exceptionality: 'low', representsChange: false },
    nivel_variacion: { priorityRank: 7, exceptionality: 'low', representsChange: true },
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
        // en el mismo partido — agrupar por el `matchId` FUENTE (evidenceMatchIds[0], siempre el
        // partido actual para este tipo de claim), nunca por `dataAsOf` (Revisión Central Fase C
        // C04: dos partidos distintos pueden compartir el mismo `playedAt` técnico, sobre todo
        // con `playedAtTimeKnown=false` — un timestamp nunca identifica un partido).
        return `primer_encuentro_rival:${candidate.evidenceMatchIds[0]}`;
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
      // C01 (Revisión Central Fase C): ventana de hasta los últimos 5 PARTIDOS PROCESADOS (no
      // solo los que tuvieron principal) — cada entrada es `{matchId, principalFamily}`, con
      // `principalFamily:null` cuando ese partido fue abstención. La penalización −15 mira
      // exactamente los 2 partidos reales anteriores; antes, un partido en abstención "desaparecía"
      // de la ventana en vez de ocupar su lugar, dejando la penalización activa más partidos de
      // los que corresponde.
      recentMatches: [],
      // Por semanticKey: última aparición + firma de valor mostrada (para "cambió el balance").
      shownSemanticKeys: {},
      // Hitos permanentes ya mostrados alguna vez — nunca se borran (§7.3 "una sola aparición").
      shownMilestoneKeys: {},
      // C02 (Revisión Central Fase C): ¿la racha SIMPLE (sin récord) de la racha vigente ya se
      // mostró alguna vez durante esta misma racha continua? Se resetea a `false` en cuanto la
      // racha se corta/reinicia (ver `buildEditorialDecision`) — nunca sobrevive a un quiebre.
      rachaSimpleYaMostrada: false,
      // C01: preparado para Fase D (penalización −10, "misma plantilla exacta de los últimos 5")
      // — `templateId` todavía no existe en ningún candidato de esta ronda (handoff §8), así que
      // esta ventana queda siempre vacía, pero el contrato de memoria ya la declara y preserva
      // para que D no necesite reabrir este módulo solo para agregar el campo.
      recentTemplateIds: [],
    };
  }

  function valueSignatureOf(candidate) {
    const c = candidate.claim || {};
    // C05-A (Revisión Central Fase C): `companero_mejor_balance` usa un semanticKey GLOBAL
    // ('todos_los_companeros', no por compañero) — si dos compañeros distintos llegan al mismo
    // W-L, la firma genérica `wins-losses` los vería como "sin cambio" aunque el PROTAGONISTA
    // cambió. La firma debe identificar quién es el mejor, no solo con qué marcador.
    if (candidate.insightType === 'companero_mejor_balance') {
      const tieState = c.isUnique ? 'unico' : `empatado:${(c.tiedWith || []).slice().sort().join(',')}`;
      return `${c.companionPlayerId}:${c.wins || 0}-${c.losses || 0}:${tieState}`;
    }
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
    // Racha: "mostrar al llegar a 3... no necesariamente en cada extensión" — C02 (Revisión
    // Central Fase C): la variante SIMPLE (sin récord) es candidata desde longitud 3 en
    // adelante; lo que la excluye NO es "no ser exactamente 3" (eso prohibía para siempre una
    // racha de 4/5/6 si la de 3 nunca llegó a mostrarse), sino que esta MISMA racha continua ya
    // se haya mostrado antes sin haberse cortado desde entonces (`memory.rachaSimpleYaMostrada`,
    // reseteado en `buildEditorialDecision` apenas la racha se reinicia). Récord/empate de
    // récord/corte siguen siendo eventos propios, sin este gate — cada uno tiene sus propias
    // reglas de aparición (§7.3).
    if ((candidate.insightType === 'racha_de_victorias' || candidate.insightType === 'racha_de_derrotas')
      && candidate.claim.length >= STREAK_SHOWABLE_MIN && memory.rachaSimpleYaMostrada) {
      return 'racha_simple_ya_mostrada_sin_evento_nuevo';
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
    // C01: ventana de los últimos 2 PARTIDOS REALES (no de los últimos 2 con principal) — una
    // abstención ocupa su lugar en `recentMatches`, así que este slice ya refleja partidos
    // reales transcurridos, nunca principales salteados.
    const recentMatches = (memory.recentMatches || []).slice(-SAME_FAMILY_PRINCIPAL_WINDOW);
    if (recentMatches.some((m) => m.principalFamily === candidate.family)) {
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
    const rankA = profileOf(a.candidate.insightType).priorityRank;
    const rankB = profileOf(b.candidate.insightType).priorityRank;
    if (rankA !== rankB) return rankA - rankB;
    const idA = stableId(a.candidate);
    const idB = stableId(b.candidate);
    return idA < idB ? -1 : (idA > idB ? 1 : 0);
  }

  const STREAK_INSIGHT_TYPES = [
    'racha_de_victorias', 'racha_de_derrotas', 'racha_cortada', 'racha_nuevo_record_personal', 'racha_iguala_record_personal',
  ];
  const SIMPLE_OR_RECORD_STREAK_TYPES = [
    'racha_de_victorias', 'racha_de_derrotas', 'racha_nuevo_record_personal', 'racha_iguala_record_personal',
  ];

  /** Handoff §7, ejemplo 1 literal: "racha de 4 victorias" + "4 victorias en los últimos 4/5"
   *  como dos historias distintas debe impedirse. C03 (Revisión Central Fase C): el umbral
   *  anterior (`racha.length >= ventana.sampleSize`, típicamente 5+) NO cubría el ejemplo
   *  LITERAL de la fuente (racha de 4 dentro de una ventana de 5) — corregido a la condición
   *  estructural que la propia revisión sugiere, sin inventar un porcentaje de solapamiento:
   *  la racha vigente tiene longitud ≥4, Y la cantidad de resultados de su mismo signo dentro de
   *  la ventana actual de `forma_reciente` es exactamente `mín(longitud, tamañoVentana)` — es
   *  decir, la racha explica TODOS los resultados de ese signo que hay en la ventana, no solo
   *  "al menos algunos". Solo aplica a `racha_de_victorias`/`racha_de_derrotas`/las variantes de
   *  récord (todas tienen `claim.length` y `claim.type` numérico/string) — `racha_cortada` no
   *  participa (no tiene `claim.length`, su racha vigente es de longitud 1).
   *
   *  IMPORTANTE (C03, "orden de aplicación"): esta función debe correr ANTES de cooldown/score/
   *  novedad — recibe `withKeys` (candidato + semanticKey inicial, SIN puntuar todavía) para que
   *  la clave final ya esté resuelta cuando `cooldownReason`/`novedadEditorialScore` consulten la
   *  memoria. Antes corría después de puntuar, así que `forma_reciente` podía recibir novedad
   *  "10 (nunca mostrada)" bajo su clave propia y solo DESPUÉS heredar la clave de la racha —
   *  permitiendo que una racha ya mostrada reapareciera disfrazada de forma reciente. */
  function mergeStreakAndRecentFormWhenFullyOverlapping(withKeys) {
    const forma = withKeys.find((e) => e.candidate.insightType === 'forma_reciente');
    const current = forma && forma.candidate.claim.current;
    if (!forma || !current || typeof current.sampleSize !== 'number') return;
    const streakEntry = withKeys.find((e) => {
      const c = e.candidate;
      if (SIMPLE_OR_RECORD_STREAK_TYPES.indexOf(c.insightType) === -1) return false;
      if (typeof c.claim.length !== 'number' || !c.claim.type) return false;
      if (c.claim.length < 4) return false; // umbral literal de la fuente ("racha de 4")
      const matchingCount = c.claim.type === 'win' ? current.wins : current.losses;
      return matchingCount === Math.min(c.claim.length, current.sampleSize);
    });
    if (streakEntry) forma.semanticKey = streakEntry.semanticKey;
  }

  /* ------------------------------------------------------------------ */
  /* 7. ORQUESTADOR                                                       */
  /* ------------------------------------------------------------------ */

  /** `historyAsc`/`callerPlayerId`: mismo contrato de Fase A/B (historia personal truncada hasta
   *  el partido de interés inclusive). `priorMemory`: memoria editorial previa del jugador
   *  (`emptyMemory()` si no existe todavía). `extraClaims` (Fase E, handoff
   *  Bloque_08/25_Handoff_Fase_E_Claude.md §5: "C puede aceptar extraClaims/claims oficiales como
   *  entrada adicional, manteniendo exactamente la misma lógica editorial"): array OPCIONAL de
   *  claims ya construidos con el MISMO contrato que devuelve `CL.buildClaimsForMatch` (hoy,
   *  Familia H de `PLIntelligenceOfficial.buildLevelClaims`) — se concatenan con los de Fase B
   *  ANTES de filtrar afirmados/descartados y participan de scoring/selección/cooldowns
   *  IDÉNTICAMENTE a cualquier otro claim, nunca por un segundo selector paralelo. Este módulo
   *  nunca los genera ni sabe de dónde vienen — los recibe ya armados, exactamente como recibe
   *  los de Fase B. Devuelve un objeto determinístico y auditable — ver cabecera del archivo
   *  para el contrato completo. Nunca persiste nada: la actualización de memoria se PROPONE
   *  (`memoryUpdate`), el llamador decide cuándo/si guardarla. */
  function buildEditorialDecision(historyAsc, callerPlayerId, priorMemory, extraClaims) {
    const CL = global.PLIntelligenceClaims;
    const memory = priorMemory || emptyMemory();
    const { ctx, claims: claimsFromB } = CL.buildClaimsForMatch(historyAsc, callerPlayerId);
    const claims = claimsFromB.concat(Array.isArray(extraClaims) ? extraClaims : []);
    // D06 (Revisión Central Fase D, auditoría): `claims` es la lista COMPLETA de Fase B + los
    // `extraClaims` oficiales de Fase E (tanto afirmados como descartados por evidencia/muestra
    // insuficiente) — se conserva tal cual bajo `allClaims`, exclusivamente para que Fase D pueda
    // construir un snapshot de auditoría completo sin recalcular nada. Extensión de CONTRATO
    // únicamente: `evaluated`/`principal`/`secondary`/`abstention` siguen calculándose
    // exactamente igual que antes, a partir de `affirmed` (más abajo) — `allClaims` nunca
    // participa de ninguna decisión de puntaje/selección, solo se adjunta al final para quien
    // quiera auditar.
    if (!ctx) return { ctx: null, allClaims: claims, evaluated: [], principal: null, secondary: [], abstention: true, memoryUpdate: memory, rulesVersion: RULES_VERSION };

    // "0 claims sin evidencia": ningún candidato descartado por Fase B/E puede revivirse acá
    // (prueba mínima #13 del handoff) — se filtran ANTES de cualquier otra evaluación.
    const affirmed = claims.filter((c) => !c.discarded);

    // C03: la clave semántica final (incluida la fusión racha/forma reciente) se resuelve
    // ANTES de cooldown/score/novedad — nunca después.
    const withKeys = affirmed.map((candidate) => ({ candidate, semanticKey: semanticKeyOf(candidate) }));
    mergeStreakAndRecentFormWhenFullyOverlapping(withKeys);

    // C02: si la racha se reinició este partido (no venía continuando la misma racha de antes),
    // la memoria de "racha simple ya mostrada" no puede seguir aplicando a la racha NUEVA — se
    // usa una memoria efectiva (copia superficial) solo para esta evaluación, nunca se muta la
    // memoria de entrada.
    const streak = ctx.streakForThisMatch;
    const streakRestartedThisMatch = !!streak && (!streak.before || streak.before.type !== streak.after.type);
    const effectiveMemory = streakRestartedThisMatch ? Object.assign({}, memory, { rachaSimpleYaMostrada: false }) : memory;

    const evaluated = withKeys.map(({ candidate, semanticKey }) => {
      const excludedBy = cooldownReason(candidate, semanticKey, effectiveMemory, historyAsc);
      if (excludedBy) {
        return { candidate, semanticKey, status: 'excluded_by_cooldown', editorialStatus: 'excluded_by_cooldown', excludedReason: excludedBy, scored: null };
      }
      const scored = scoreCandidate(candidate, semanticKey, effectiveMemory, historyAsc);
      const status = scored.finalScore >= PUBLISH_THRESHOLD ? 'above_threshold' : 'below_threshold';
      // C05-B: `editorialStatus` empieza igual a `status` — la selección de abajo lo refina a
      // `selected_principal`/`selected_secondary`/`not_selected_*` para los candidatos elegibles.
      return { candidate, semanticKey, status, editorialStatus: status, scored };
    });

    const eligibleEntries = evaluated.filter((e) => e.status === 'above_threshold');
    eligibleEntries.sort(compareForSelection);

    let principal = null;
    const secondary = [];
    const usedSemanticKeys = new Set();
    const usedFamilies = new Set();
    eligibleEntries.forEach((entry) => {
      // C05-B: todo candidato evaluado conserva un motivo editorial final reconstruible, nunca
      // solo "above_threshold" sin decir por qué de todos modos no se mostró.
      if (usedSemanticKeys.has(entry.semanticKey)) { entry.editorialStatus = 'not_selected_duplicate_semantic'; return; }
      if (!principal) {
        principal = Object.assign({}, entry.candidate, { semanticKey: entry.semanticKey, scored: entry.scored });
        entry.editorialStatus = 'selected_principal';
        usedSemanticKeys.add(entry.semanticKey);
        usedFamilies.add(entry.candidate.family);
        return;
      }
      if (secondary.length >= MAX_SECONDARY) { entry.editorialStatus = 'not_selected_capacity'; return; }
      if (usedFamilies.has(entry.candidate.family)) { entry.editorialStatus = 'not_selected_family_already_used'; return; } // §6.5 paso 7
      secondary.push(Object.assign({}, entry.candidate, { semanticKey: entry.semanticKey, scored: entry.scored }));
      entry.editorialStatus = 'selected_secondary';
      usedSemanticKeys.add(entry.semanticKey);
      usedFamilies.add(entry.candidate.family);
    });

    const abstention = !principal;

    // Memoria propuesta: refleja SOLO lo efectivamente seleccionado (§7.1 "insight MOSTRADO"),
    // nunca los candidatos evaluados que no llegaron a mostrarse.
    const shown = principal ? [principal].concat(secondary) : [];
    const memoryUpdate = {
      rulesVersion: RULES_VERSION,
      // C01: se agrega SIEMPRE una entrada por este partido, haya o no principal — una
      // abstención ocupa su lugar en la ventana en vez de desaparecer de ella.
      recentMatches: (memory.recentMatches || [])
        .concat([{ matchId: ctx.matchId, principalFamily: principal ? principal.family : null }])
        .slice(-5),
      shownSemanticKeys: Object.assign({}, memory.shownSemanticKeys),
      shownMilestoneKeys: Object.assign({}, memory.shownMilestoneKeys),
      // C02: se muestra (principal o secundario) alguna variante simple/récord de la racha
      // vigente → queda marcada; si no, se preserva el valor EFECTIVO (ya resuelto arriba,
      // incluido el reinicio por corte) para el próximo partido.
      rachaSimpleYaMostrada: shown.some((c) => SIMPLE_OR_RECORD_STREAK_TYPES.indexOf(c.insightType) !== -1)
        || effectiveMemory.rachaSimpleYaMostrada,
      // C01: preservada intacta — Fase C nunca asigna `templateId` (eso es Fase D).
      recentTemplateIds: (memory.recentTemplateIds || []).slice(),
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
      allClaims: claims, // D06: TODOS los candidatos de Fase B, afirmados Y descartados — solo para auditoría.
      evaluated, // TODOS los candidatos afirmados por Fase B, con status/editorialStatus/score/motivo — nunca omitidos.
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
