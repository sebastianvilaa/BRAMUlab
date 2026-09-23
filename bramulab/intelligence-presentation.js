/* ==========================================================================
   BRAMU Lab — intelligence-presentation.js (Backend Bloque 8, Fase D)
   Capa pura de PLANTILLAS Y UX para BRAMU Intelligence V1. Cero DOM, cero
   localStorage, cero red — construida por COMPOSICIÓN sobre
   `PLIntelligenceEditorial` (Fase C, CERRADA en Staging): nunca reabre esa
   API, nunca recalcula hechos/puntaje/selección. Solo REDACTA lo que C ya
   decidió, con un resolver de nombres y una memoria de plantillas propia.

   División de responsabilidad (handoff Bloque_08/15_Handoff_Fase_D_Claude.md
   §4): este módulo consume EXCLUSIVAMENTE la decisión de
   `PLIntelligenceEditorial.buildEditorialDecision` + un resolver de nombres
   — nunca vuelve a leer `historyAsc` para "hechos" (solo para resolver
   nombres de `playerId`, que es presentación, no evidencia nueva).

   CONTRATO DE SALIDA — ver `renderIntelligence` al final del archivo. Cada
   insight visible expone `{insightType, family, semanticKey, templateId,
   title (solo principal), body, why, officialScope, confidenceTier,
   evidenceMatchIds, rulesVersions}`. La frase visible NUNCA reemplaza al
   claim: `why` es una traducción factual de la MISMA evidencia que ya
   armó C, nunca un recálculo.

   REGLAS DE COPY (BRAMU_Intelligence.md, resumidas en el handoff §4):
   - nunca psicología/emoción/causalidad/técnica/desarrollo interno;
   - principal: título 3–7 palabras, cuerpo ~12–24 palabras;
   - secundarios: 1 frase, ~10–20 palabras, nunca repiten el título principal;
   - `personal`/`mixto`: "partidos registrados"; `oficial`: puede usar
     lenguaje oficial — nunca al revés (un claim personal nunca se redacta
     como si fuera oficial).

   NOMBRES (handoff §4 "Entidades/nombres"): `buildNameResolver` resuelve
   por `playerId` usando el ÚLTIMO `displayName` visto en `historyAsc` —
   cambiar el nombre visible de alguien NUNCA rompe su identidad ni
   duplica una relación. Si no hay nombre disponible, se usa una
   formulación neutral ("tu compañero", "esa pareja rival") — nunca se
   inventa una entidad.

   PLANTILLAS Y REPETICIÓN (handoff §5): cada `insightType` tiene 1 o 2
   variantes deterministas (nunca `Math.random`). Se evita reutilizar la
   MISMA plantilla exacta en los últimos 5 partidos cuando existe una
   variante alternativa compatible — si no existe alternativa, se usa el
   fallback estable de todos modos (nunca se deja un insight sin redactar).

   ESTADOS DE APRENDIZAJE/ABSTENCIÓN (handoff §6): "1 partido"/"3
   partidos"/"5 partidos" son HITOS DE PROFUNDIDAD DE HISTORIAL, propios de
   esta capa (no existe un claim de Fase B para "3 partidos" o "5
   partidos" en sí) — aparecen como mensaje SOLO cuando C se abstiene, una
   sola vez cada uno (memoria propia, nunca se repiten). "1 partido"
   normalmente ni siquiera llega a la abstención: `primer_partido_de_la_
   historia` (Fase B/C) ya gana como principal — el mensaje de "1 partido"
   queda como fallback defensivo por si alguna vez no fuera así.
   ========================================================================== */
(function (global) {
  'use strict';

  const RULES_VERSION = 'bramu_intelligence_presentation_v1';
  const TEMPLATE_RECENCY_WINDOW = 5; // handoff §5: "no reutilizar la misma plantilla exacta en los siguientes 5 partidos"

  /* ------------------------------------------------------------------ */
  /* 0. Resolver de nombres — SIEMPRE desde identidades reales (§4)       */
  /* ------------------------------------------------------------------ */

  /** Recorre `historyAsc` (la MISMA historia personal que ya usó A/B/C, nunca una consulta
   *  nueva) y arma `playerId -> displayName`, quedándose con el ÚLTIMO nombre visto por fecha
   *  jugada — un cambio de `displayName` nunca rompe identidad ni crea una entidad nueva,
   *  simplemente actualiza cuál nombre se muestra. Devuelve `null` para un `playerId` sin
   *  nombre conocido (slot "Por identificar"/"Jugador no identificado", o vacío) — el llamador
   *  usa una formulación neutral, nunca inventa un nombre. */
  function buildNameResolver(historyAsc) {
    const names = {};
    (historyAsc || []).forEach((match) => {
      (match.players || []).forEach((p) => {
        if (p && p.userId && p.name) names[p.userId] = p.name;
      });
    });
    return function resolveName(playerId) {
      return (playerId && names[playerId]) || null;
    };
  }

  /* ------------------------------------------------------------------ */
  /* 1. Fingerprint determinístico del prefijo de historia (handoff §8)   */
  /* ------------------------------------------------------------------ */

  /** Hash NO criptográfico (FNV-1a de 32 bits) — alcanza para detectar "¿cambió algo de lo que
   *  ya usé?", no hace falta resistencia a colisión adversarial para esto. Determinístico: la
   *  MISMA secuencia de campos relevantes produce SIEMPRE el mismo fingerprint, sin importar
   *  cuántas veces se calcule. Nunca incluye `createdAt`/orden de carga — el fingerprint depende
   *  de la secuencia por `playedAt`, que es como `historyAsc` ya llega ordenada (Fase A).
   *
   *  Revisión Central Fase D (D02): la versión anterior no incluía identidad real de
   *  participantes ni formato/sistema de scoring/conocimiento de hora — una sustitución real de
   *  jugador con `hasOpenIdentityIssue=false` antes Y después (por ejemplo, una identidad que se
   *  resuelve señalando a otra persona distinta de la originalmente registrada) podía conservar
   *  el mismo fingerprint. Ahora incluye, por cada partido del prefijo: identidad/estado/
   *  oficialidad/incidencia de identidad/ocultamiento (igual que antes) + `timeKnown` (equivalente
   *  local de `playedAtTimeKnown`) + `formatId` + `scoringSystem` + la composición ESTABLE de
   *  participantes (`team`+`userId`, en el mismo orden ya estable por team/position que entrega
   *  `PLMatchSync.translateServerMatchToLocalShape` — nunca se reordena acá) + el score derivado.
   *  Cualquier cambio real en uno de estos campos, en CUALQUIER partido del prefijo, cambia el
   *  fingerprint de ESE prefijo y de todos los prefijos posteriores que lo incluyan — es lo que
   *  permite que D01 invalide checkpoints en cascada sin lógica especial (ver
   *  `runIntelligenceReplay`). */
  function computeHistoryFingerprint(historyAsc) {
    const relevant = (historyAsc || []).map((m) => ({
      matchId: m.matchId,
      playedAt: m.playedAt,
      timeKnown: !!m.timeKnown,
      status: m.status,
      officialEligible: !!m.officialEligible,
      hasOpenIdentityIssue: !!m.hasOpenIdentityIssue,
      hidden: !!m.hidden,
      formatId: m.formatId || null,
      scoringSystem: m.scoringSystem || null,
      players: (m.players || []).map((p) => ({ team: p.team, userId: p.userId || null })),
      winnerTeam: m.winnerTeam || null,
      sets: (m.sets || []).map((s) => [s.gamesA, s.gamesB, s.tiebreak ? [s.tiebreak.a, s.tiebreak.b] : null]),
    }));
    const canonical = JSON.stringify(relevant);
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < canonical.length; i++) {
      hash ^= canonical.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0') + ':' + relevant.length;
  }

  /* ------------------------------------------------------------------ */
  /* 2. Utilidades de copy — alcance personal/oficial, plurales, nombres  */
  /* ------------------------------------------------------------------ */

  function matchWord(officialScope, n) {
    const noun = officialScope === 'oficial' ? 'oficial' : 'registrado';
    return n === 1 ? `partido ${noun}` : `partidos ${noun}s`;
  }

  function nameOr(resolveName, playerId, fallback) {
    return (playerId && resolveName(playerId)) || fallback;
  }

  function parsePairKey(scopeKey) {
    const parts = String(scopeKey || '').split('+');
    return [parts[0] || null, parts[1] || null];
  }

  function parseCrossingScopeKey(scopeKey) {
    const [teammatePart, pairPart] = String(scopeKey || '').split('_vs_');
    const [r1, r2] = parsePairKey(pairPart);
    return { teammateId: teammatePart || null, rivalIds: [r1, r2] };
  }

  /* ------------------------------------------------------------------ */
  /* 3. Registro de plantillas por insightType                           */
  /* ------------------------------------------------------------------ */

  /** Cada entrada expone `variants: [{id, title(claim,ctx)=>string, body(claim,ctx)=>string}]`
   *  (al menos 1, hasta 2) y `why(claim,ctx)=>string`. `ctx` acá es `{resolveName,
   *  officialScope, isPrincipal}` — nunca el `ctx` de Fase A (para no confundir capas, este
   *  módulo no recibe ni necesita ese objeto). Ninguna plantilla menciona IDs, nombres de
   *  tablas/RPC, `reasonCodes` ni puntajes internos — el criterio de la sección 7 del handoff. */
  const TEMPLATES = {};

  function register(insightType, def) { TEMPLATES[insightType] = def; }

  // ---- Familia B: hitos personales ----
  register('primer_partido_de_la_historia', {
    variants: [{
      id: 'v1',
      title: () => 'Primer partido registrado',
      body: () => 'Primer partido de tu historia BRAMU. Todavía no hay antecedentes para compararlo.',
    }],
    why: () => 'Es el primer partido que registraste en BRAMU: no existe historial previo para comparar.',
  });
  register('primera_victoria_registrada', {
    variants: [{
      id: 'v1',
      title: () => 'Primera victoria registrada',
      body: () => 'Esta es tu primera victoria registrada en BRAMU.',
    }],
    why: (claim, ctx) => `Se revisó todo tu historial de ${matchWord(ctx.officialScope, 2)} y ninguno anterior fue una victoria.`,
  });
  register('hito_de_victorias', {
    variants: [
      { id: 'v1', title: (c) => `Victoria número ${c.winCount}`, body: (c, ctx) => `Llegaste a ${c.winCount} victorias en tus ${matchWord(ctx.officialScope, c.winCount)}.` },
      { id: 'v2', title: (c) => `${c.winCount} victorias en tu historia`, body: (c, ctx) => `Esta victoria es la número ${c.winCount} de tu historia BRAMU.` },
    ],
    why: (claim, ctx) => `Se contaron tus victorias en ${matchWord(ctx.officialScope, 2)}, ordenadas por fecha jugada, hasta llegar a ${claim.winCount}.`,
  });

  // ---- Familia B: rachas ----
  function streakNoun(type) { return type === 'win' ? 'victorias' : 'derrotas'; }
  register('racha_de_victorias', {
    variants: [
      { id: 'v1', title: (c) => `Racha de ${c.length} victorias`, body: (c) => `Llevás ${c.length} victorias seguidas.` },
      { id: 'v2', title: (c) => `${c.length} triunfos seguidos`, body: (c) => `Encadenaste ${c.length} victorias consecutivas.` },
    ],
    why: () => 'Se consideró tu racha de resultados consecutivos, ordenada por fecha jugada.',
  });
  register('racha_de_derrotas', {
    variants: [{ id: 'v1', title: (c) => `Racha de ${c.length} derrotas`, body: (c) => `Llevás ${c.length} derrotas seguidas.` }],
    why: () => 'Se consideró tu racha de resultados consecutivos, ordenada por fecha jugada.',
  });
  register('racha_cortada', {
    variants: [{
      id: 'v1',
      title: (c) => (c.previousType === 'win' ? 'Racha ganadora cortada' : 'Racha de derrotas cortada'),
      body: (c) => `Este resultado terminó una racha de ${c.previousLength} ${streakNoun(c.previousType)} seguidas.`,
    }],
    why: () => 'Se comparó el resultado de este partido contra la racha inmediatamente anterior.',
  });
  register('racha_nuevo_record_personal', {
    variants: [{ id: 'v1', title: () => 'Nuevo récord de racha', body: (c) => `Tu racha de ${c.length} ${streakNoun(c.type)} es tu nuevo récord personal.` }],
    why: (claim, ctx) => `Se comparó contra los ${matchWord(ctx.officialScope, 2)} decididos de tu historial completo.`,
  });
  register('racha_iguala_record_personal', {
    variants: [{ id: 'v1', title: () => 'Igualaste tu récord', body: (c) => `Tu racha de ${c.length} ${streakNoun(c.type)} iguala tu récord personal.` }],
    why: (claim, ctx) => `Se comparó contra los ${matchWord(ctx.officialScope, 2)} decididos de tu historial completo.`,
  });

  // ---- Familia D: compañeros ----
  register('companero_primer_partido_juntos', {
    variants: [{ id: 'v1', title: () => 'Primer partido con este compañero', body: (c, ctx) => `Jugaste por primera vez con ${nameOr(ctx.resolveName, c.companionPlayerId, 'este compañero')}.` }],
    why: () => 'Es el primer partido registrado con este compañero.',
  });
  register('companero_primera_victoria_juntos', {
    variants: [{ id: 'v1', title: () => 'Primera victoria juntos', body: (c, ctx) => `Es tu primera victoria junto a ${nameOr(ctx.resolveName, c.companionPlayerId, 'este compañero')}.` }],
    why: (claim, ctx) => `De ${claim.totalMatches} ${matchWord(ctx.officialScope, claim.totalMatches)} con este compañero, ninguno anterior había sido una victoria.`,
  });
  register('contexto_companero_nuevo', {
    variants: [{ id: 'v1', title: () => 'Compañero nuevo', body: (c, ctx) => `Jugaste con ${nameOr(ctx.resolveName, c.companionPlayerId, 'un compañero nuevo')} por primera vez.` }],
    why: () => 'Es el primer partido registrado con este compañero.',
  });
  register('companero_balance', {
    variants: [
      { id: 'v1', title: () => 'Balance con tu compañero', body: (c, ctx) => `Con ${nameOr(ctx.resolveName, c.companionPlayerId, 'este compañero')} llevás ${c.wins} victorias en ${c.wins + c.losses} ${matchWord(ctx.officialScope, c.wins + c.losses)}.` },
      { id: 'v2', title: () => 'Tu historial con este compañero', body: (c, ctx) => `${c.wins} victorias y ${c.losses} derrotas junto a ${nameOr(ctx.resolveName, c.companionPlayerId, 'este compañero')}.` },
    ],
    why: (claim, ctx) => `Se consideraron los ${claim.wins + claim.losses} ${matchWord(ctx.officialScope, claim.wins + claim.losses)} decididos junto a este compañero.`,
  });
  register('companero_mejor_balance', {
    variants: [{ id: 'v1', title: () => 'Tu mejor compañero', body: (c, ctx) => `${c.isUnique ? 'Tu mejor balance es con' : 'Empatás tu mejor balance con'} ${nameOr(ctx.resolveName, c.companionPlayerId, 'este compañero')}: ${c.wins} en ${c.wins + c.losses}.` }],
    why: (claim, ctx) => `Se comparó tu balance con los ${claim.comparedAgainst} compañeros con al menos 5 ${matchWord(ctx.officialScope, 5)} cada uno.`,
  });

  // ---- Familia E: rivales / pareja rival / cruce exacto ----
  function rivalGroup(insightType, scopeLabel, nounSingular) {
    register(`${insightType}_primer_enfrentamiento`, {
      variants: [{ id: 'v1', title: () => `Primer cruce con ${nounSingular}`, body: (c, ctx) => `Fue tu primer enfrentamiento registrado con ${scopeLabel(c, ctx)}.` }],
      why: () => 'Es el primer enfrentamiento registrado en este alcance.',
    });
    register(`${insightType}_balance`, {
      variants: [
        { id: 'v1', title: () => `Balance frente a ${nounSingular}`, body: (c, ctx) => `Frente a ${scopeLabel(c, ctx)} llevás ${c.wins} victorias en ${c.wins + c.losses} ${matchWord(ctx.officialScope, c.wins + c.losses)}.` },
        { id: 'v2', title: () => `Tu historial frente a ${nounSingular}`, body: (c, ctx) => `${c.wins} victorias y ${c.losses} derrotas frente a ${scopeLabel(c, ctx)}.` },
      ],
      why: (claim, ctx) => `Se consideraron los ${claim.wins + claim.losses} ${matchWord(ctx.officialScope, claim.wins + claim.losses)} decididos en este alcance.`,
    });
    register(`${insightType}_primer_triunfo_tras_derrotas`, {
      variants: [{ id: 'v1', title: () => `Primer triunfo frente a ${nounSingular}`, body: (c, ctx) => `Ganaste después de ${c.priorLosses} derrotas seguidas frente a ${scopeLabel(c, ctx)}.` }],
      why: (claim) => `Se revisaron las ${claim.priorLosses} derrotas inmediatamente anteriores en este alcance, sin ninguna victoria entre ellas.`,
    });
  }
  rivalGroup('rival', (c, ctx) => nameOr(ctx.resolveName, c.scopeKey, 'ese rival'), 'un rival');
  rivalGroup('pareja_rival', (c, ctx) => {
    const [a, b] = parsePairKey(c.scopeKey);
    return `${nameOr(ctx.resolveName, a, 'ese rival')} y ${nameOr(ctx.resolveName, b, 'su compañero')}`;
  }, 'esa pareja rival');
  rivalGroup('cruce_exacto', (c, ctx) => {
    const { rivalIds } = parseCrossingScopeKey(c.scopeKey);
    return `${nameOr(ctx.resolveName, rivalIds[0], 'esa pareja rival')} y ${nameOr(ctx.resolveName, rivalIds[1], '')}`.trim();
  }, 'este cruce exacto');

  register('contexto_dificultad_previa_rival', {
    // `neverWonBefore` describe el ANTECEDENTE (0 victorias previas), no el resultado de ESTE
    // partido — el título/cuerpo no deben afirmar "primera victoria" sin conocer si este
    // partido en particular fue ganado o perdido (eso vive en Fase B/C, no en `claim`).
    variants: [{
      id: 'v1',
      title: () => 'Contexto frente a este rival',
      body: (c, ctx) => `Antes de este partido no le habías ganado a ${nameOr(ctx.resolveName, c.rivalPlayerId, 'este rival')}: ${c.priorWins} victorias en ${c.priorWins + c.priorLosses} ${matchWord(ctx.officialScope, c.priorWins + c.priorLosses)}.`,
    }],
    why: (claim, ctx) => `Antes de este partido, tu balance frente a este rival era ${claim.priorWins} victorias y ${claim.priorLosses} derrotas.`,
  });

  // ---- Familia C/F: forma, score, patrón ----
  register('forma_reciente', {
    variants: [{ id: 'v1', title: () => 'Tu forma reciente', body: (c) => `En tus últimos ${c.current.sampleSize} partidos llevás ${c.current.wins} victorias y ${c.current.losses} derrotas.` }],
    // D05 (Revisión Central Fase D): con exactamente 5 partidos decididos, Fase B/C ya permiten
    // la PRIMERA lectura válida de forma (`RECENT_FORM_MIN_SAMPLE=5`), pero la ventana previa
    // todavía no llega a 5 partidos comparables (`previousWindow.sampleSize` da 4, nunca menos,
    // ver `buildRecentFormClaim`) — decir "comparada con los 4 inmediatamente anteriores" es
    // literal pero editorialmente engañoso, como si esa comparación fuera equivalente a la
    // ventana móvil real de 5 que sí existe a partir del siguiente partido.
    why: (claim) => (claim.previousWindow.sampleSize >= 5
      ? `Ventana móvil de tus últimos ${claim.current.sampleSize} partidos decididos, comparada con los ${claim.previousWindow.sampleSize} inmediatamente anteriores.`
      : `Primera lectura posible de tu forma reciente, sobre tus últimos ${claim.current.sampleSize} partidos decididos: todavía no existe una ventana anterior completa de 5 partidos para comparar.`),
  });
  register('score_excepcional_formato_comparable', {
    variants: [{
      id: 'v1',
      title: (c) => (c.extreme === 'mas_ajustado' ? 'Tu resultado más ajustado' : 'Tu resultado más amplio'),
      body: (c) => (c.extreme === 'mas_ajustado'
        ? `${c.isUnique ? 'Este fue tu resultado' : 'Este empata tu resultado'} más ajustado dentro de partidos de formato comparable.`
        : `${c.isUnique ? 'Este fue tu resultado' : 'Este empata tu resultado'} más amplio dentro de partidos de formato comparable.`),
    }],
    why: () => 'Se comparó el margen de este partido contra tu historial de partidos de formato comparable.',
  });
  register('balance_perdiendo_primer_set', {
    variants: [{ id: 'v1', title: () => 'Perdiendo el primer set', body: (c) => `Cuando perdés el primer set, tu balance es ${c.wins} victorias y ${c.losses} derrotas.` }],
    why: () => 'Se consideraron los partidos en los que perdiste el primer set.',
  });
  register('reversion_tras_perder_primer_set', {
    variants: [{ id: 'v1', title: () => 'Revirtieron el partido', body: () => 'Después de perder el primer set, se quedaron con el partido en los siguientes.' }],
    why: () => 'Se revisó el orden de sets de este partido.',
  });
  register('alternancia_de_sets', {
    variants: [{ id: 'v1', title: () => (undefined), body: () => 'El ganador de cada set fue alternando hasta la definición.' }],
    why: () => 'Se revisó el orden de sets de este partido.',
  });
  register('sets_corridos', {
    // D04 (Revisión Central Fase D): el número es el TOTAL agregado de games de todo el
    // partido, no el marcador de un set — sin la aclaración explícita "en games" puede leerse
    // como si fuera el score de un set puntual (forma segura de la fuente maestra: "…y con
    // 12–4 en games").
    variants: [{ id: 'v1', title: () => (undefined), body: (c) => `El resultado se resolvió en dos sets, con ${c.gamesWonByWinner}-${c.gamesTotal - c.gamesWonByWinner} en games.` }],
    why: () => 'Descripción directa del resultado.',
  });
  register('definicion_en_tres_sets', {
    variants: [{ id: 'v1', title: () => (undefined), body: () => 'Fue una definición en tres sets.' }],
    why: () => 'Descripción directa del resultado.',
  });

  register('contexto_regreso_tras_inactividad', {
    variants: [{ id: 'v1', title: () => 'Regreso tras una pausa', body: (c) => `Volviste a jugar después de ${Math.round(c.daysSincePrevious)} días sin partidos, más de lo habitual para vos.` }],
    why: (claim) => `Tu separación habitual entre partidos es de ${Math.round(claim.threshold)} días como máximo esperable; esta vez pasaron ${Math.round(claim.daysSincePrevious)}.`,
  });

  const FALLBACK_TEMPLATE = {
    variants: [{ id: 'v1', title: () => 'BRAMU Intelligence', body: () => 'Este resultado todavía no tiene una lectura histórica destacable.' }],
    why: () => 'No se encontró un patrón con evidencia suficiente para destacar.',
  };

  /* ------------------------------------------------------------------ */
  /* 4. Selección de variante — determinística, evita repetición (§5)     */
  /* ------------------------------------------------------------------ */

  function pickVariant(insightType, variants, recentTemplateIds) {
    const recent = recentTemplateIds || [];
    const fresh = variants.find((v) => recent.indexOf(`${insightType}:${v.id}`) === -1);
    return fresh || variants[0]; // sin alternativa disponible: fallback estable, nunca sin redactar
  }

  /* ------------------------------------------------------------------ */
  /* 5. Renderizado de UN insight seleccionado                            */
  /* ------------------------------------------------------------------ */

  function renderInsight(candidate, isPrincipal, resolveName, recentTemplateIds) {
    const def = TEMPLATES[candidate.insightType] || FALLBACK_TEMPLATE;
    const variant = pickVariant(candidate.insightType, def.variants, recentTemplateIds);
    const templateId = `${candidate.insightType}:${variant.id}`;
    const ctx = { resolveName, officialScope: candidate.officialScope, isPrincipal };
    const title = isPrincipal ? (variant.title(candidate.claim, ctx) || defaultTitleFor(candidate)) : undefined;
    return {
      insightType: candidate.insightType,
      family: candidate.family,
      semanticKey: candidate.semanticKey,
      templateId,
      title,
      body: variant.body(candidate.claim, ctx),
      why: def.why(candidate.claim, ctx),
      officialScope: candidate.officialScope,
      confidenceTier: candidate.confidenceTier,
      evidenceMatchIds: candidate.evidenceMatchIds.slice(),
      rulesVersions: {
        a: 'bramu_intelligence_context_v1', b: candidate.rulesVersion || 'bramu_intelligence_v1',
        c: candidate.scored ? 'bramu_intelligence_editorial_v1' : 'bramu_intelligence_editorial_v1', d: RULES_VERSION,
      },
    };
  }

  function defaultTitleFor(candidate) {
    // Familia A/F sin título propio (son de una sola idea, corta) — se usa un título neutro
    // genérico en vez de dejarlo `undefined` cuando SÍ hace falta (solo si es principal).
    return 'BRAMU Intelligence';
  }

  /* ------------------------------------------------------------------ */
  /* 6. Estados de aprendizaje / abstención (§6)                          */
  /* ------------------------------------------------------------------ */

  const LEARNING_THRESHOLDS = [1, 3, 5];
  const LEARNING_MESSAGES = {
    1: 'Primer partido de tu historia BRAMU.',
    3: 'Ya aparecen tus primeros antecedentes con este grupo.',
    5: 'Tu forma reciente ya puede leerse sobre tus últimos 5.',
  };
  const FALLBACK_MESSAGE = 'Partido guardado. No apareció una conclusión histórica más relevante que el resultado.';

  function pickLearningMessage(historyLength, memory) {
    const shown = memory.learningHitosShown || {};
    const threshold = LEARNING_THRESHOLDS.find((t) => historyLength === t && !shown[t]);
    return threshold ? { threshold, message: LEARNING_MESSAGES[threshold] } : null;
  }

  /** Memoria combinada C+D vacía — el `memoryBefore` del primer partido de la historia de
   *  cualquier jugador (checkpoint "cero", Revisión Central Fase D D01). Composición explícita
   *  sobre `PLIntelligenceEditorial.emptyMemory()` en vez de un literal propio: nunca duplica el
   *  contrato de memoria de C, solo le agrega el único campo que D conoce hoy
   *  (`learningHitosShown`; `recentTemplateIds` ya vive en `ED.emptyMemory()` desde su propia
   *  corrección C01). */
  function emptyMemory() {
    const ED = global.PLIntelligenceEditorial;
    return Object.assign({}, ED.emptyMemory(), { learningHitosShown: {} });
  }

  /* ------------------------------------------------------------------ */
  /* 7. ORQUESTADOR (un solo partido)                                     */
  /* ------------------------------------------------------------------ */

  /** `decision`: salida de `PLIntelligenceEditorial.buildEditorialDecision`, construida con ESTE
   *  MISMO `memoryBefore` como su `priorMemory` (nunca con otra memoria — ver `runIntelligenceReplay`,
   *  que es quien garantiza esa correspondencia en el camino real). `historyAsc`: la MISMA
   *  historia usada para construir `decision` (para resolver nombres y el fingerprint — nunca
   *  para recalcular hechos). `memoryBefore`: la memoria combinada C+D **inmediatamente anterior**
   *  a este partido — el checkpoint de partido−1, o `emptyMemory()` si este es el primero.
   *
   *  Revisión Central Fase D (D03): la versión anterior recibía la memoria previa bajo el nombre
   *  `priorMemory` pero, si el llamador (la Edge Function original) le pasaba por error
   *  `decision.memoryUpdate` en su lugar —exactamente lo que hacía—, cualquier campo que Fase C
   *  no conoce (`learningHitosShown`) se perdía en cada partido, porque `decision.memoryUpdate`
   *  es un objeto NUEVO que C construye con SOLO sus propios campos declarados. La corrección no
   *  vive acá (el contrato de este parámetro siempre fue "la memoria previa real"): vive en
   *  `runIntelligenceReplay`, que ahora es el ÚNICO lugar que decide qué memoria es "la
   *  anterior" y SIEMPRE le pasa exactamente lo mismo a `ED.buildEditorialDecision` y a esta
   *  función. Como refuerzo (defensa en profundidad, no como parche del síntoma), la memoria
   *  final ahora parte de `memoryBefore` completo (`Object.assign({}, memoryBefore, ...)`) en vez
   *  de partir únicamente de `decision.memoryUpdate`: cualquier campo propio de D que exista en
   *  `memoryBefore` sobrevive por defecto aunque C nunca lo reenvíe, sin que C tenga que conocer
   *  los campos de D uno por uno — D solo declara explícitamente los que él mismo actualiza. */
  function renderIntelligence(decision, historyAsc, memoryBefore) {
    const resolveName = buildNameResolver(historyAsc);
    const memory = memoryBefore || emptyMemory();
    const recentTemplateIds = memory.recentTemplateIds || [];

    const abstention = !!decision.abstention;
    let principal = null;
    let secondary = [];
    let learningMessage = null;
    let fallbackMessage = null;

    if (!abstention) {
      principal = renderInsight(decision.principal, true, resolveName, recentTemplateIds);
      secondary = decision.secondary.map((c) => renderInsight(c, false, resolveName, recentTemplateIds));
    } else {
      const learning = pickLearningMessage(historyAsc.length, memory);
      if (learning) learningMessage = learning.message;
      else fallbackMessage = FALLBACK_MESSAGE;
    }

    const usedTemplateIds = [principal].concat(secondary).filter(Boolean).map((i) => i.templateId);
    // D03: base = memoria anterior COMPLETA (nunca solo lo que C reenvía) -> encima, los campos
    // propios de C ya actualizados -> encima, los campos propios de D recalculados acá mismo.
    const memoryUpdate = Object.assign({}, memory, decision.memoryUpdate, {
      recentTemplateIds: (memory.recentTemplateIds || []).concat(usedTemplateIds).slice(-TEMPLATE_RECENCY_WINDOW * 3),
      learningHitosShown: Object.assign({}, memory.learningHitosShown,
        (!abstention || !learningMessage) ? {} : { [LEARNING_THRESHOLDS.find((t) => LEARNING_MESSAGES[t] === learningMessage)]: true }),
    });

    return {
      matchId: decision.ctx.matchId,
      playedAt: decision.ctx.playedAt,
      abstention,
      learningMessage,
      fallbackMessage,
      principal,
      secondary,
      rulesVersion: RULES_VERSION,
      memoryUpdate,
    };
  }

  /** Subconjunto de `renderIntelligence(...)` que es seguro exponer al cliente — nunca incluye
   *  `memoryUpdate` (estado interno de continuidad editorial/de plantillas, jamás pensado para
   *  el navegador: `recentMatches`/`shownSemanticKeys`/`shownMilestoneKeys`/`recentTemplateIds`/
   *  `learningHitosShown`). El checkpoint persiste `memoryUpdate` por separado, en su propia
   *  columna (`memory_after`, ver la migración) — nunca duplicado dentro de `output`. */
  function publicOutputOf(rendered) {
    return {
      matchId: rendered.matchId,
      playedAt: rendered.playedAt,
      abstention: rendered.abstention,
      learningMessage: rendered.learningMessage,
      fallbackMessage: rendered.fallbackMessage,
      principal: rendered.principal,
      secondary: rendered.secondary,
      rulesVersion: rendered.rulesVersion,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 8. AUDITORÍA SERVER-ONLY (Revisión Central Fase D — auditoría, D06)  */
  /* ------------------------------------------------------------------ */

  /** Copia explícita de UN claim de Fase B (afirmado o descartado) para el snapshot de
   *  auditoría — nunca un spread ciego: cada campo se nombra a propósito, para que el contrato
   *  de auditoría quede versionado y no arrastre silenciosamente algo que B agregue después sin
   *  que se decida explícitamente incluirlo acá. */
  function summarizeClaimForAudit(c) {
    return {
      insightType: c.insightType,
      family: c.family,
      perspectivePlayerId: c.perspectivePlayerId,
      claim: c.claim,
      evidenceMatchIds: (c.evidenceMatchIds || []).slice(),
      comparisonScope: c.comparisonScope,
      sampleSize: c.sampleSize,
      minSampleRequired: c.minSampleRequired,
      confidenceTier: c.confidenceTier,
      officialScope: c.officialScope,
      dataAsOf: c.dataAsOf,
      rulesVersion: c.rulesVersion,
      discarded: !!c.discarded,
      discardReasonCodes: (c.discardReasonCodes || []).slice(),
    };
  }

  /** Copia explícita de UNA entrada evaluada por Fase C (`decision.evaluated[i]`) — candidatos
   *  afirmados por B que C llegó a puntuar o excluir por cooldown. Mismo criterio que
   *  `summarizeClaimForAudit`: campos nombrados a propósito, nunca un spread ciego del objeto
   *  interno de C (que además mezcla `candidate` + metadata de evaluación en un solo nivel). */
  function summarizeEvaluatedForAudit(e) {
    return {
      insightType: e.candidate.insightType,
      family: e.candidate.family,
      semanticKey: e.semanticKey,
      comparisonScope: e.candidate.comparisonScope,
      evidenceMatchIds: (e.candidate.evidenceMatchIds || []).slice(),
      status: e.status,
      editorialStatus: e.editorialStatus,
      excludedReason: e.excludedReason || null,
      score: e.scored ? {
        dimensions: Object.assign({}, e.scored.dimensions),
        rawScore: e.scored.rawScore,
        penalties: e.scored.penalties.slice(),
        finalScore: e.scored.finalScore,
      } : null,
    };
  }

  /** Snapshot de auditoría INMUTABLE de un checkpoint — server-only, NUNCA se envía al cliente
   *  (ver `publicOutputOf`, que es lo único que sale en la respuesta HTTP). Existe para poder
   *  reconstruir por qué se tomó una decisión histórica sin volver a ejecutar las reglas
   *  actuales sobre datos que pueden haber cambiado desde entonces (BRAMU_Intelligence.md §6.5).
   *  Se construye ÚNICAMENTE a partir de lo que `decision` (Fase C, incluido el `allClaims` que
   *  C ahora reenvía sin tocarlo — D06) y `rendered` (este mismo módulo) ya calcularon — nunca
   *  recalcula ni re-deriva nada. `principal`/`secondary` acá abajo referencian el `templateId`
   *  final tal cual lo asignó `renderInsight` (`rendered.principal`/`rendered.secondary`, en el
   *  MISMO orden que `decision.principal`/`decision.secondary` — `renderIntelligence` los mapea
   *  1 a 1, nunca los reordena). */
  function buildAuditSnapshot(decision, rendered, callerPlayerId, fingerprint, rulesVersionCombined) {
    const CL = global.PLIntelligenceClaims;
    const ED = global.PLIntelligenceEditorial;
    return {
      matchId: decision.ctx.matchId,
      perspectivePlayerId: callerPlayerId,
      dataAsOf: decision.ctx.playedAt,
      fingerprint,
      rulesVersions: {
        a: 'bramu_intelligence_context_v1',
        b: CL.RULES_VERSION,
        c: ED.RULES_VERSION,
        d: RULES_VERSION,
        combined: rulesVersionCombined,
      },
      claims: (decision.allClaims || []).map(summarizeClaimForAudit),
      evaluated: (decision.evaluated || []).map(summarizeEvaluatedForAudit),
      abstention: !!decision.abstention,
      principal: decision.principal ? {
        insightType: decision.principal.insightType,
        semanticKey: decision.principal.semanticKey,
        templateId: rendered.principal ? rendered.principal.templateId : null,
      } : null,
      secondary: (decision.secondary || []).map((c, i) => ({
        insightType: c.insightType,
        semanticKey: c.semanticKey,
        templateId: (rendered.secondary && rendered.secondary[i]) ? rendered.secondary[i].templateId : null,
      })),
      learningMessage: rendered.learningMessage,
      fallbackMessage: rendered.fallbackMessage,
    };
  }

  /* ------------------------------------------------------------------ */
  /* 9. REPLAY CRONOLÓGICO POR CHECKPOINTS (Revisión Central Fase D, D01) */
  /* ------------------------------------------------------------------ */

  /** Reemplaza el diseño original de Fase D (un solo blob global "memoria actual del jugador",
   *  reutilizado sin importar qué partido se pedía) — la fuente y el handoff exigen que la
   *  memoria/generación siga `playedAt`, nunca el orden de apertura/carga. Este es el ÚNICO
   *  punto de todo el módulo que decide, para un partido objetivo, qué memoria es "la anterior":
   *  siempre la del checkpoint del partido INMEDIATAMENTE anterior en `historyAsc`, nunca un
   *  snapshot global mutable. Dos propiedades quedan garantizadas por CONSTRUCCIÓN, no por casos
   *  especiales:
   *
   *  - **un partido viejo nunca puede recibir memoria de partidos posteriores**: el bucle nunca
   *    camina más allá de `targetIndex`, así que la memoria de un partido futuro simplemente no
   *    existe todavía cuando se calcula uno anterior;
   *  - **corregir el partido MÁS RECIENTE nunca lo penaliza contra su propia salida anterior**:
   *    su `memoryBefore` es siempre el checkpoint de partido−1 (que nunca lo incluye a él mismo),
   *    jamás "la memoria actual, que ya lo incluye" — un hito/cooldown que ese mismo partido
   *    mostró la vez anterior no puede aparecer como "ya mostrado" al regenerarlo.
   *
   *  Además, como el fingerprint de cada paso se calcula sobre el PREFIJO completo (no solo
   *  sobre el partido individual, ver `computeHistoryFingerprint`), una corrección o una carga
   *  retroactiva en cualquier punto de la historia invalida automáticamente el fingerprint de
   *  TODOS los prefijos posteriores que la incluyan — sin necesidad de lógica de cascada
   *  separada; y un cambio de `rulesVersion` (nueva versión de reglas combinada A+B+C+D)
   *  invalida un checkpoint aunque su fingerprint de datos siga siendo idéntico.
   *
   *  `existingCheckpoints`: `{ [matchId]: { sourceFingerprint, rulesVersion, output, memoryAfter,
   *  audit } }` — el llamador (la Edge Function) lo arma con UNA sola consulta a
   *  `intelligence_match_outputs` por jugador (nunca N consultas, una por partido). `rulesVersion`
   *  es la combinada A+B+C+D vigente, calculada por el llamador — este módulo nunca la
   *  hardcodea ni la recalcula.
   *
   *  Devuelve `steps`, un array de longitud `targetIndex + 1` (uno por partido del prefijo),
   *  cada uno `{matchId, fingerprint, reused, output, memoryAfter, audit}`. El llamador persiste
   *  (upsert) los TRES campos server-only (`output`/`memoryAfter`/`audit`) únicamente de los
   *  pasos con `reused:false`, y responde al cliente con `steps[targetIndex].output` — nunca con
   *  `audit` (D06: la auditoría completa queda exclusivamente server-side). Un checkpoint
   *  reutilizado reutiliza también su `audit` EXACTO, tal cual quedó guardado — nunca se
   *  regenera solo porque se reutiliza el resto. */
  function runIntelligenceReplay(historyAsc, targetIndex, callerPlayerId, existingCheckpoints, rulesVersion) {
    const ED = global.PLIntelligenceEditorial;
    const checkpoints = existingCheckpoints || {};
    const steps = [];
    let memoryBefore = emptyMemory();
    for (let i = 0; i <= targetIndex; i++) {
      const prefix = historyAsc.slice(0, i + 1);
      const stepMatchId = historyAsc[i].matchId;
      const fingerprint = computeHistoryFingerprint(prefix);
      const existing = checkpoints[stepMatchId];
      if (existing && existing.sourceFingerprint === fingerprint && existing.rulesVersion === rulesVersion) {
        steps.push({ matchId: stepMatchId, fingerprint, reused: true, output: existing.output, memoryAfter: existing.memoryAfter, audit: existing.audit });
        memoryBefore = existing.memoryAfter;
      } else {
        const decision = ED.buildEditorialDecision(prefix, callerPlayerId, memoryBefore);
        const rendered = renderIntelligence(decision, prefix, memoryBefore);
        const audit = buildAuditSnapshot(decision, rendered, callerPlayerId, fingerprint, rulesVersion);
        steps.push({ matchId: stepMatchId, fingerprint, reused: false, output: publicOutputOf(rendered), memoryAfter: rendered.memoryUpdate, audit });
        memoryBefore = rendered.memoryUpdate;
      }
    }
    return steps;
  }

  global.PLIntelligencePresentation = {
    RULES_VERSION,
    TEMPLATE_RECENCY_WINDOW,
    buildNameResolver,
    computeHistoryFingerprint,
    emptyMemory,
    renderIntelligence,
    runIntelligenceReplay,
  };
})(typeof window !== 'undefined' ? window : globalThis);
