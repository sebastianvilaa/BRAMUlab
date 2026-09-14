/* ==========================================================================
   BRAMU Lab — level-context.js (BRAMUlab_V04.2, Etapa B)
   Capa pura de INTERPRETACIÓN de partido/historial para Nivel BRAMU. Cero DOM,
   cero localStorage — mismo criterio que level.js/engine.js/groups.js.

   División de responsabilidad (Consolidado §"recomendación de arquitectura"):
   - `level.js` = matemática ya cerrada en Etapa A (factores, K, delta, confianza).
   - este módulo = decide SI un partido aporta evidencia y arma el CONTEXTO
     (disponibilidad, imputación de invitados, repetición, círculo cerrado) que
     `level.js` necesita — nunca reimplementa una fórmula de `level.js`, siempre
     llama a `Level.computeXxx(...)` para el cálculo matemático compartido.

   ALCANCE DE ETAPA B (autorización de Sebastián sobre BRAMUlab_V04_Informe.md
   §V04.1.4 "pendientes"): elegibilidad, invitados, repetición/compañero real
   desde historial, y detección real de círculo competitivo cerrado. NO
   construye persistencia ni reversión real de correcciones (§12.3 de la
   fórmula) — 'corregido'/'anulado' se MODELAN como estado y decisión de
   elegibilidad, nunca se ejecuta la reversión/recálculo real acá. Sigue sin
   tocar `store.js`, `app.js`, `player-home.js`, `ranking.js`, UI, cuestionario,
   BRAMU Intelligence, backend ni la versión pública.

   MODELO DE DATOS QUE ESTE ARCHIVO ASUME (real, verificado en el código actual
   de `store.js`/`engine.js`/`player-home.js`, sin inventar campos nuevos salvo
   los 2 marcados explícitamente como "forward-compatible" abajo):
   - `match.players[]`: {name, team:'A'|'B', userId?} — 4 filas, 2 por equipo.
     `userId` autoritativo y exclusivo (V03.0): sin `userId`, la fila es legacy
     y se resuelve por nombre normalizado — mismo criterio que
     `player-home.js#findPlayerRow`, reimplementado acá en miniatura para no
     depender de ese archivo (módulo puro y standalone).
   - `match.winnerTeam`: 'A' | 'B' | undefined (sin definir).
   - `match.sets[]`: {gamesA, gamesB, winner:'A'|'B', extraordinary?:true,
     tiebreak?:{a,b,mode}} — `extraordinary:true` es el ÚNICO rastro real hoy
     de un "match tie-break" (§6.1 de la fórmula: sus puntos NUNCA cuentan
     como games — interpretación de esta ronda: tampoco cuentan los games que
     ya se habían jugado en ese set antes de convertirlo, ver
     `computeMarginScoreInputs`, más simple y conservador que contar una parte
     sí y otra no).
   - `match.formatId`: hoy únicamente 'classic' (bestOfSets 3) o 'americano'
     (bestOfSets 1) — `engine.js` no define "mini sets" ni un formatId propio
     de "match tie-break" (ver `detectFormatKey`: 'twoSetsPlusMatchTiebreak' se
     detecta por `sets[último].extraordinary`, no por `formatId`). 'miniSets'
     de la fórmula NO tiene hoy ningún camino real que lo produzca — brecha
     real documentada en BRAMUlab_V04_Informe.md §V04.2, no inventada acá.
   - `match.regulationCompleted`: booleano ya real (player-home.js ya lo usa)
     — `false` es la ÚNICA señal real de "incompleto/abandono/walkover" hoy;
     no existe un campo separado de "walkover" en el modelo actual.
   - `match.mode`: 'manual' | 'games' | 'complete' — la ventana de 30 días de
     §12.2 ("un partido MANUAL...") solo aplica cuando `mode === 'manual'`.
   - `match.playedAt`/`startedAt`/`finishedAt`/`createdAt`: ISO strings reales.
   - `match.validationState` (FORWARD-COMPATIBLE, NO existe todavía en ningún
     partido real — el flujo de validación por la pareja rival de múltiples
     cuentas/dispositivos es backlog, ver memoria del proyecto): opcional, uno
     de VALIDATION_STATES; si falta, se asume 'validado' — es exactamente el
     comportamiento real de hoy (todo partido guardado localmente se trata como
     definitivo, sin espera de validación rival).
   - `match.recordedByParticipant` (FORWARD-COMPATIBLE, tampoco existe hoy):
     si falta, se asume `true` — cierto siempre en la realidad actual: tanto
     el registro en vivo como la carga manual solo pueden ser hechos por un
     participante (`app.js` ya lo dice explícitamente: "en la carga manual, el
     jugador actual siempre es Equipo A, nunca 'observado' acá").

   `playerStates`: dict `userId -> {mu, confidence, state}` — el estado de
   rating de cada jugador YA CALCULADO (Etapa C construirá de dónde sale esto;
   acá solo se recibe como input, igual criterio que `level.js`). Un jugador
   del partido sin `userId`, o cuyo `userId` no está en este dict, es un
   INVITADO sin Nivel BRAMU real.
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;
  const Engine = global.PLEngine;

  const MATCH_STATUS = Object.freeze({
    COMPUTABLE: 'computable',
    PENDING: 'pendiente',
    EXCLUDED: 'excluido',
    CORRECTED: 'corregido',
    ANNULLED: 'anulado',
    DUPLICATE: 'duplicado',
  });

  const VALIDATION_STATES = Object.freeze({
    PENDING: 'pendiente',
    VALIDATED: 'validado',
    DISPUTED: 'disputado',
    SPECTATOR_OBSERVED: 'observado',
    ANNULLED: 'anulado',
    CORRECTED: 'corregido',
  });

  // §8/§8.1 — ventana de 180 días para repetición, compañero y círculo cerrado.
  const REPETITION_WINDOW_DAYS = 180;
  const CIRCLE_WINDOW_DAYS = 180;
  // §8.1 — umbrales exactos del círculo competitivo cerrado.
  const CIRCLE_MIN_MATCHES = 20;
  const CIRCLE_MAX_COMPANIONS = 11;
  const CIRCLE_MAX_GROUP_SIZE = 12; // jugador + hasta 11 coparticipantes habituales
  const CIRCLE_CONCENTRATION_THRESHOLD = 0.80;
  const CIRCLE_AMPLITUDE_MAX = 1.5;
  const CIRCLE_RIVAL_SUPERIORITY_THRESHOLD = 0.75;
  // §12.2 — ventana de carga/asociación/validación de un partido manual.
  const MANUAL_LOAD_WINDOW_DAYS = 30;

  const DAY_MS = 86400000;

  function round4(n) { return Math.round(n * 10000) / 10000; }

  function parseTimeOrNull(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /** Misma cadena de fallback que `player-home.js#getPlayedAt`, reimplementada acá en
   *  miniatura para que este módulo no dependa de ese archivo (standalone, ver cabecera). */
  function resolvePlayedAt(match) {
    if (!match) return null;
    if (parseTimeOrNull(match.playedAt) !== null) return match.playedAt;
    if (parseTimeOrNull(match.startedAt) !== null) return match.startedAt;
    if (parseTimeOrNull(match.finishedAt) !== null) return match.finishedAt;
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* IDENTIDAD — mismo criterio de integridad que V03.0 (userId autoritativo */
  /* y exclusivo, nombre normalizado como fallback legacy).                 */
  /* ------------------------------------------------------------------ */

  function refOf(playerRow) {
    return playerRow ? { userId: playerRow.userId || null, name: playerRow.name || null } : null;
  }

  function playerRowMatchesRef(playerRow, ref) {
    if (!playerRow || !ref) return false;
    if (playerRow.userId) return !!ref.userId && playerRow.userId === ref.userId;
    return !!ref.name && playerRow.name === ref.name;
  }

  function identityKey(ref) {
    if (ref && ref.userId) return 'id:' + ref.userId;
    return 'name:' + String((ref && ref.name) || '').trim().toLowerCase();
  }

  function teamOf(match, team) { return (match.players || []).filter((p) => p && p.team === team); }

  function findPlayerRow(match, ref) {
    return (match.players || []).find((p) => playerRowMatchesRef(p, ref)) || null;
  }

  function partnerOf(match, ref) {
    const row = findPlayerRow(match, ref);
    if (!row) return null;
    return (match.players || []).find((p) => p && p.team === row.team && p !== row) || null;
  }

  function rivalsOf(match, ref) {
    const row = findPlayerRow(match, ref);
    if (!row) return [];
    return teamOf(match, row.team === 'A' ? 'B' : 'A');
  }

  /* ------------------------------------------------------------------ */
  /* 1. ELEGIBILIDAD DEL PARTIDO (Formula_V1.4.md §12/§13)                */
  /* ------------------------------------------------------------------ */

  /** Estado + razones de un partido, SIN mirar todavía disponibilidad de niveles (eso es
   *  un segundo filtro, ver `computeAvailabilityContext`). `options.alreadyComputedMatchIds`
   *  (Set opcional) es el único mecanismo de "duplicado" posible sin backend: idempotencia
   *  local — nunca procesar dos veces el mismo `matchId` (Implementacion.md §4/§6). */
  function computeMatchStatus(match, options) {
    const opts = options || {};
    if (!match || !match.matchId) return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['partido_invalido'] };

    if (opts.alreadyComputedMatchIds && opts.alreadyComputedMatchIds.has(match.matchId)) {
      return { status: MATCH_STATUS.DUPLICATE, reasonCodes: ['duplicado_ya_computado'] };
    }

    const validationState = match.validationState || VALIDATION_STATES.VALIDATED;
    if (validationState === VALIDATION_STATES.ANNULLED) {
      return { status: MATCH_STATUS.ANNULLED, reasonCodes: ['anulado'] };
    }
    if (validationState === VALIDATION_STATES.CORRECTED) {
      // §12.3 — modelado como estado/decisión únicamente: la reversión/recálculo real no se
      // construye en Etapa B. No se llama al motor para un partido en este estado.
      return { status: MATCH_STATUS.CORRECTED, reasonCodes: ['pendiente_de_correccion_real'] };
    }
    if (validationState === VALIDATION_STATES.PENDING) {
      return { status: MATCH_STATUS.PENDING, reasonCodes: ['pendiente_de_validacion_rival'] };
    }
    if (validationState === VALIDATION_STATES.DISPUTED) {
      return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['disputado'] };
    }
    if (validationState === VALIDATION_STATES.SPECTATOR_OBSERVED || match.recordedByParticipant === false) {
      return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['observado_por_espectador'] };
    }

    const players = match.players || [];
    const teamA = teamOf(match, 'A');
    const teamB = teamOf(match, 'B');
    if (players.length !== 4 || teamA.length !== 2 || teamB.length !== 2) {
      return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['formato_de_partido_invalido'] };
    }
    if (match.winnerTeam !== 'A' && match.winnerTeam !== 'B') {
      return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['resultado_no_definido'] };
    }
    if (match.regulationCompleted === false) {
      return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['incompleto_abandono_o_walkover'] };
    }

    if (match.mode === 'manual') {
      const playedAt = resolvePlayedAt(match);
      const loadedAt = match.createdAt || playedAt;
      if (playedAt && loadedAt) {
        const days = (new Date(loadedAt).getTime() - new Date(playedAt).getTime()) / DAY_MS;
        if (days > MANUAL_LOAD_WINDOW_DAYS) {
          return { status: MATCH_STATUS.EXCLUDED, reasonCodes: ['fuera_de_ventana_30_dias'] };
        }
      }
    }

    return { status: MATCH_STATUS.COMPUTABLE, reasonCodes: [] };
  }

  /* ------------------------------------------------------------------ */
  /* FORMATO Y MARGEN — §6.1/§7. Traduce el partido real al contrato de   */
  /* entrada de `level.js` (formatKey + los 4 números del margen).        */
  /* ------------------------------------------------------------------ */

  /** §7 — 'classic' (bestOfSets 3) → 'bestOf3', salvo que el último de 3 sets sea
   *  `extraordinary` (match tie-break real, único rastro que existe hoy) →
   *  'twoSetsPlusMatchTiebreak'. 'americano' (bestOfSets 1) → 'shortSingleSet' (el
   *  formato corto más cercano de la fórmula — 'miniSets' no tiene hoy ningún camino
   *  real, ver cabecera del archivo). Formato no reconocido → 'incomplete' (nunca
   *  inventa un peso). */
  function detectFormatKey(match) {
    const format = (Engine && Engine.FORMATS && Engine.FORMATS[match.formatId]) || null;
    if (!format) return 'incomplete';
    if (format.bestOfSets === 1) return 'shortSingleSet';
    const sets = match.sets || [];
    const last = sets[sets.length - 1];
    if (sets.length === 3 && last && last.extraordinary) return 'twoSetsPlusMatchTiebreak';
    return 'bestOf3';
  }

  /** §6.1 — dominio de la pareja ganadora. Un set `extraordinary` (match tie-break) cuenta
   *  como UN set ganado/perdido, pero sus games NUNCA entran en `gamesTotal`/
   *  `gamesWonByWinner` (interpretación de esta ronda, ver cabecera: se excluyen también
   *  los games ya jugados de ese set antes de convertirlo, no solo los puntos del
   *  desempate — más simple y conservador que un conteo parcial). */
  function computeMarginScoreInputs(match, winnerTeam) {
    const sets = match.sets || [];
    let setsWonByWinner = 0, gamesWonByWinner = 0, gamesTotal = 0;
    sets.forEach((s) => {
      if (!s) return;
      if (s.winner === winnerTeam) setsWonByWinner += 1;
      if (s.extraordinary) return;
      const gA = s.gamesA || 0, gB = s.gamesB || 0;
      gamesTotal += gA + gB;
      gamesWonByWinner += winnerTeam === 'A' ? gA : gB;
    });
    return { setsWonByWinner, setsPlayed: sets.length, gamesWonByWinner, gamesTotal };
  }

  /* ------------------------------------------------------------------ */
  /* 2. PARTICIPANTES E INVITADOS (§13)                                   */
  /* ------------------------------------------------------------------ */

  /** `known:false` cuando la fila no tiene `userId`, o ese `userId` no aparece en
   *  `playerStates` — un invitado nunca "adivina" un estado, simplemente no lo tiene. */
  function resolvePlayerRating(playerRow, playerStates) {
    if (playerRow && playerRow.userId && playerStates && playerStates[playerRow.userId]) {
      const st = playerStates[playerRow.userId];
      return { known: true, userId: playerRow.userId, name: playerRow.name, mu: st.mu, confidence: st.confidence, state: st.state };
    }
    return { known: false, userId: (playerRow && playerRow.userId) || null, name: playerRow && playerRow.name, mu: null, confidence: null, state: null };
  }

  /** Regla de elegibilidad por participantes (§13) + disponibilidad (1.00/0.80/0.60) +
   *  imputación del invitado. `computable:false` cubre exactamente los 2 casos que
   *  excluyen el partido: sin nivel conocido en alguna de las 2 parejas, o 2 conocidos
   *  concentrados en la MISMA pareja (uno solo o ninguno en la rival). */
  function computeAvailabilityContext(match, playerStates) {
    const resolvedA = teamOf(match, 'A').map((p) => resolvePlayerRating(p, playerStates));
    const resolvedB = teamOf(match, 'B').map((p) => resolvePlayerRating(p, playerStates));
    const knownA = resolvedA.filter((r) => r.known).length;
    const knownB = resolvedB.filter((r) => r.known).length;
    const knownLevelsCount = knownA + knownB;

    // Orden importa: "2 conocidos en la misma pareja" (knownA=2,knownB=0 o viceversa) es un
    // caso MÁS ESPECÍFICO de "sin nivel conocido en alguna pareja" — se chequea primero para
    // dar el reasonCode más preciso (si el chequeo genérico fuera primero, este nunca
    // podría dispararse: cualquier 2-0 ya tiene una pareja en 0, y el genérico la atraparía
    // antes con una razón menos específica).
    if (knownLevelsCount === 2 && (knownA === 2 || knownB === 2)) {
      return { computable: false, knownLevelsCount, reasonCodes: ['dos_conocidos_en_la_misma_pareja'] };
    }
    if (knownA === 0 || knownB === 0) {
      return { computable: false, knownLevelsCount, reasonCodes: ['sin_nivel_conocido_en_alguna_pareja'] };
    }

    const availabilityFactor = Level.computeAvailabilityFactor(knownLevelsCount);
    const knownEffectiveLevels = resolvedA.concat(resolvedB)
      .filter((r) => r.known)
      .map((r) => Level.computeEffectiveLevel(r.mu, r.confidence));
    // §13 — "el nivel imputado no crea un perfil, no se guarda como nivel del invitado":
    // este valor SOLO se usa para armar el input de ESTE partido, nunca se persiste.
    const imputedEffectiveLevel = knownEffectiveLevels.length
      ? round4(knownEffectiveLevels.reduce((s, v) => s + v, 0) / knownEffectiveLevels.length)
      : null;

    return {
      computable: true,
      knownLevelsCount,
      availabilityFactor,
      imputedEffectiveLevel: knownLevelsCount === 4 ? null : imputedEffectiveLevel,
      teamA: resolvedA,
      teamB: resolvedB,
      reasonCodes: knownLevelsCount < 4 ? ['disponibilidad_reducida'] : [],
    };
  }

  /** Arma el par (mu, confidence) sintético que, al pasar por `Level.computeEffectiveLevel`,
   *  reproduce EXACTAMENTE `targetEffectiveLevel` — sin tocar `level.js` ni duplicar su
   *  fórmula. Truco: mu_efectivo = 5 + c×(mu−5) es lineal en mu para cualquier c≠0, así que
   *  despejando mu = 5 + (E−5)/c con c = la confianza REAL del compañero conocido, el
   *  resultado es exacto. Este mismo `c` deja además la confianza rival correcta sin
   *  cambio adicional: `confianza_pareja_rival` promedia a ambos jugadores del equipo, y con
   *  c_invitado = c_companero, ese promedio da exactamente c_companero — que es lo que pide
   *  §9 ("confianza_pareja_rival se calcula con los rivales que sí tienen nivel"). El mu
   *  resultante es una CONSTRUCCIÓN INTERNA para alimentar el motor — nunca se expone como
   *  "nivel del invitado" en la salida de `buildLevelEngineContext` (ver `imputedEffectiveLevel`
   *  ahí, que es el valor real y correcto a mostrar/auditar). */
  function buildGuestEngineInput(targetEffectiveLevel, mirrorConfidence) {
    const c = mirrorConfidence > 0 ? mirrorConfidence : 0.95;
    const mu = round4(5 + (targetEffectiveLevel - 5) / c);
    return { mu, confidence: c, state: Level.STATES.CALIBRATED };
  }

  /* ------------------------------------------------------------------ */
  /* 3. REPETICIÓN — ventana de 180 días (§8)                            */
  /* ------------------------------------------------------------------ */

  /** Partidos COMPUTABLES de `ref` (mismo criterio de elegibilidad de §1), dentro de los
   *  180 días anteriores a `nowIso`, excluyendo `excludeMatchId`. Reutilizado por
   *  repetición/compañero/círculo — un solo punto de "qué cuenta como partido reciente". */
  function computableMatchesForPlayerInWindow(history, ref, nowIso, windowDays, excludeMatchId) {
    const cutoff = new Date(nowIso).getTime() - windowDays * DAY_MS;
    return (history || []).filter((m) => {
      if (!m || m.matchId === excludeMatchId) return false;
      if (!findPlayerRow(m, ref)) return false;
      const playedAt = parseTimeOrNull(resolvePlayedAt(m));
      if (playedAt === null || playedAt < cutoff || playedAt > new Date(nowIso).getTime()) return false;
      return computeMatchStatus(m, {}).status === MATCH_STATUS.COMPUTABLE;
    });
  }

  /** n_pair / n_r1 / n_r2 de UN jugador contra los 2 rivales de referencia (`rivalRefs`),
   *  dentro de los últimos 180 días. */
  function computeIndividualRepetitionCounts(history, currentMatch, ref, rivalRefs, nowIso) {
    const matches = computableMatchesForPlayerInWindow(history, ref, nowIso, REPETITION_WINDOW_DAYS, currentMatch.matchId);
    let nPair = 0;
    const rivalCounts = rivalRefs.map(() => 0);
    matches.forEach((m) => {
      const rivals = rivalsOf(m, ref);
      if (rivals.length !== 2) return;
      const rivalKeys = rivals.map((r) => identityKey(refOf(r)));
      const targetKeys = rivalRefs.map((r) => identityKey(r)).sort();
      if (rivalKeys.slice().sort().join('|') === targetKeys.join('|')) nPair += 1;
      rivalRefs.forEach((target, idx) => {
        if (rivals.some((r) => playerRowMatchesRef(r, target))) rivalCounts[idx] += 1;
      });
    });
    return { nPair, nR1: rivalCounts[0] || 0, nR2: rivalCounts[1] || 0 };
  }

  /** n_companero: partidos jugados con EL MISMO compañero (`partnerRef`) en 180 días —
   *  simétrico por construcción (da igual desde cuál de los dos se cuente). */
  function computeCompanionCount(history, currentMatch, ref, partnerRef, nowIso) {
    const matches = computableMatchesForPlayerInWindow(history, ref, nowIso, REPETITION_WINDOW_DAYS, currentMatch.matchId);
    return matches.filter((m) => playerRowMatchesRef(partnerOf(m, ref), partnerRef)).length;
  }

  /** Factor de repetición/compañero de UN EQUIPO para el partido actual. Decisión de
   *  diseño explícita (la fórmula describe n_pair/n_r1/n_r2 "de la pareja", sin fijar qué
   *  hacer si los dos compañeros tienen historiales distintos entre sí frente a los mismos
   *  rivales — ver BRAMUlab_V04_Informe.md §V04.2): se calculan los 3 contadores para CADA
   *  compañero por separado y se toma el MÁXIMO de cada uno entre ambos — el criterio más
   *  conservador (nunca subestima cuánta repetición hay), consistente con el resto de la
   *  fórmula (que ya penaliza farming, nunca lo premia). n_companero es simétrico, sin
   *  ambigüedad. */
  function computeTeamRepetitionFactors(history, currentMatch, teamRefs, rivalRefs, nowIso) {
    const counts = teamRefs.map((ref) => computeIndividualRepetitionCounts(history, currentMatch, ref, rivalRefs, nowIso));
    const nPair = Math.max(counts[0].nPair, counts[1].nPair);
    const nR1 = Math.max(counts[0].nR1, counts[1].nR1);
    const nR2 = Math.max(counts[0].nR2, counts[1].nR2);
    const nCompanero = computeCompanionCount(history, currentMatch, teamRefs[0], teamRefs[1], nowIso);
    return {
      nPair, nR1, nR2, nCompanero,
      repetitionFactor: Level.computeRepetitionFactor(nPair, nR1, nR2),
      companionFactor: Level.computeCompanionFactor(nCompanero),
    };
  }

  /* ------------------------------------------------------------------ */
  /* 4. CÍRCULO COMPETITIVO CERRADO (§8.1)                                */
  /* ------------------------------------------------------------------ */

  /** Detección exacta de §8.1 para UN jugador ya calibrado. Devuelve si existe un círculo
   *  cerrado PREEXISTENTE (a partir de los partidos ANTERIORES al actual, dentro de 180
   *  días — nunca influido por el propio partido que se está evaluando, para no ser
   *  circular) y si el partido ACTUAL cae íntegramente dentro de él sin que la pareja
   *  rival sea claramente superior. El "grupo habitual" se construye por frecuencia
   *  (coparticipantes más repetidos primero, hasta 11) y se usa el prefijo MÁS CHICO que
   *  alcanza el 80% — decisión de diseño (la fórmula no fija cuál de varios prefijos
   *  válidos usar): el grupo mínimo necesario es el más defendible para medir amplitud,
   *  nunca se infla con gente que no hace falta para la concentración. Coparticipantes sin
   *  Nivel BRAMU real (invitados puros) se ignoran para el ranking/amplitud — no se puede
   *  comparar el nivel de alguien que no tiene uno. */
  function computeClosedCircleContext(history, currentMatch, playerRef, playerState, playerStates, nowIso) {
    if (playerState !== Level.STATES.CALIBRATED) {
      return { closedCircleApplies: false, reasonCodes: ['jugador_no_calibrado'] };
    }

    const priorMatches = computableMatchesForPlayerInWindow(history, playerRef, nowIso, CIRCLE_WINDOW_DAYS, currentMatch.matchId);
    if (priorMatches.length < CIRCLE_MIN_MATCHES) {
      return { closedCircleApplies: false, reasonCodes: ['menos_de_20_partidos_computables'] };
    }

    // Coparticipantes (compañero + 2 rivales) de cada partido previo, solo identidades con
    // Nivel BRAMU real conocido (playerStates) — nunca un invitado en el ranking del círculo.
    const perMatchParticipantKeys = [];
    const frequency = {};
    const refByKey = {};
    priorMatches.forEach((m) => {
      const partner = partnerOf(m, playerRef);
      const rivals = rivalsOf(m, playerRef);
      const co = [partner].concat(rivals).filter(Boolean);
      const knownCo = co.filter((p) => p.userId && playerStates && playerStates[p.userId]);
      if (knownCo.length !== co.length) { perMatchParticipantKeys.push(null); return; } // alguien sin nivel real -> nunca "concentrado"
      const keys = knownCo.map((p) => { const k = identityKey(refOf(p)); refByKey[k] = refOf(p); return k; });
      perMatchParticipantKeys.push(keys);
      keys.forEach((k) => { frequency[k] = (frequency[k] || 0) + 1; });
    });

    const rankedKeys = Object.keys(frequency).sort((a, b) => (frequency[b] - frequency[a]) || (a < b ? -1 : 1));

    function coverageWithPrefix(prefixKeys) {
      const set = new Set(prefixKeys);
      let covered = 0;
      perMatchParticipantKeys.forEach((keys) => {
        if (keys && keys.every((k) => set.has(k))) covered += 1;
      });
      return covered / priorMatches.length;
    }

    let habitualKeys = null;
    for (let size = 1; size <= CIRCLE_MAX_COMPANIONS; size++) {
      const prefix = rankedKeys.slice(0, size);
      if (coverageWithPrefix(prefix) >= CIRCLE_CONCENTRATION_THRESHOLD) { habitualKeys = prefix; break; }
    }
    if (!habitualKeys) {
      return { closedCircleApplies: false, reasonCodes: ['no_alcanza_concentracion_80_por_ciento'] };
    }

    const selfState = playerStates[playerRef.userId];
    const groupMuValues = [selfState.mu].concat(habitualKeys.map((k) => playerStates[refByKey[k].userId].mu));
    const amplitude = round4(Math.max.apply(null, groupMuValues) - Math.min.apply(null, groupMuValues));
    if (amplitude > CIRCLE_AMPLITUDE_MAX) {
      return { closedCircleApplies: false, reasonCodes: ['amplitud_de_grupo_mayor_a_1_5'], groupSize: habitualKeys.length + 1, amplitude };
    }

    // ¿El partido ACTUAL cae íntegramente dentro de ese círculo?
    const currentPartner = partnerOf(currentMatch, playerRef);
    const currentRivals = rivalsOf(currentMatch, playerRef);
    const currentCo = [currentPartner].concat(currentRivals).filter(Boolean);
    const currentKnown = currentCo.every((p) => p.userId && playerStates && playerStates[p.userId]);
    const currentKeys = currentKnown ? currentCo.map((p) => identityKey(refOf(p))) : null;
    const habitualSet = new Set(habitualKeys);
    const matchInsideCircle = !!currentKeys && currentKeys.every((k) => habitualSet.has(k));
    if (!matchInsideCircle) {
      return { closedCircleApplies: false, reasonCodes: ['partido_actual_fuera_del_circulo'], groupSize: habitualKeys.length + 1, amplitude };
    }

    // Pareja rival claramente superior (§8.1: "no supera a la propia por 0.75 puntos o más").
    const ownRow = findPlayerRow(currentMatch, playerRef);
    const ownEffLevels = [ownRow, currentPartner].map((p) => {
      const st = p === ownRow ? selfState : playerStates[p.userId];
      return Level.computeEffectiveLevel(st.mu, st.confidence);
    });
    const rivalEffLevels = currentRivals.map((p) => {
      const st = playerStates[p.userId];
      return Level.computeEffectiveLevel(st.mu, st.confidence);
    });
    const ownStrength = Level.computePairStrength(ownEffLevels[0], ownEffLevels[1]);
    const rivalStrength = Level.computePairStrength(rivalEffLevels[0], rivalEffLevels[1]);
    if (rivalStrength - ownStrength >= CIRCLE_RIVAL_SUPERIORITY_THRESHOLD) {
      return { closedCircleApplies: false, reasonCodes: ['rival_claramente_superior'], groupSize: habitualKeys.length + 1, amplitude };
    }

    return { closedCircleApplies: true, reasonCodes: ['circulo_competitivo_cerrado'], groupSize: habitualKeys.length + 1, amplitude };
  }

  /* ------------------------------------------------------------------ */
  /* 5. CONTEXTO COMPUESTO — arma el input de `Level.computeMatchUpdate`  */
  /* ------------------------------------------------------------------ */

  /** Transforma match + history + playerStates (+ options de validación/duplicado) en el
   *  input exacto que espera `Level.computeMatchUpdate`, o en `null` si el partido no
   *  computa — nunca llama al motor acá, solo arma su entrada (ver `computeMatchLevelUpdate`
   *  más abajo para el flujo completo, incluida la llamada). */
  function buildLevelEngineContext(match, history, playerStates, options) {
    const opts = options || {};
    const nowIso = opts.nowIso || resolvePlayedAt(match) || new Date().toISOString();

    const statusResult = computeMatchStatus(match, opts);
    if (statusResult.status !== MATCH_STATUS.COMPUTABLE) {
      return { eligible: false, status: statusResult.status, reasonCodes: statusResult.reasonCodes, engineInput: null };
    }

    const availability = computeAvailabilityContext(match, playerStates);
    if (!availability.computable) {
      return { eligible: false, status: MATCH_STATUS.EXCLUDED, reasonCodes: availability.reasonCodes, engineInput: null };
    }

    function buildTeamInput(resolvedTeam, teamKey) {
      const guestIds = [];
      const players = resolvedTeam.map((r, idx) => {
        const id = r.userId || ('guest:' + teamKey + idx + ':' + (r.name || 'sin_nombre'));
        if (r.known) return { id, mu: r.mu, confidence: r.confidence, state: r.state };
        const mirrorConfidence = resolvedTeam.find((other) => other !== r && other.known).confidence;
        const guestInput = buildGuestEngineInput(availability.imputedEffectiveLevel, mirrorConfidence);
        guestIds.push(id);
        return Object.assign({ id }, guestInput);
      });
      return { players, guestIds };
    }

    const teamAInput = buildTeamInput(availability.teamA, 'A');
    const teamBInput = buildTeamInput(availability.teamB, 'B');

    const refsA = teamOf(match, 'A').map(refOf);
    const refsB = teamOf(match, 'B').map(refOf);
    const repetitionWindowNow = opts.nowIso || resolvePlayedAt(match) || nowIso;
    const repA = computeTeamRepetitionFactors(history, match, refsA, refsB, repetitionWindowNow);
    const repB = computeTeamRepetitionFactors(history, match, refsB, refsA, repetitionWindowNow);

    function circleFactorsForTeam(resolvedTeam, refs) {
      return resolvedTeam.map((r, idx) => {
        if (!r.known) return false;
        const circle = computeClosedCircleContext(history, match, refs[idx], r.state, playerStates, repetitionWindowNow);
        return circle.closedCircleApplies;
      });
    }

    const circleA = circleFactorsForTeam(availability.teamA, refsA);
    const circleB = circleFactorsForTeam(availability.teamB, refsB);

    const engineInput = {
      matchId: match.matchId,
      teamA: { players: teamAInput.players, repetitionFactor: repA.repetitionFactor, companionFactor: repA.companionFactor, circleFactors: circleA },
      teamB: { players: teamBInput.players, repetitionFactor: repB.repetitionFactor, companionFactor: repB.companionFactor, circleFactors: circleB },
      winnerTeam: match.winnerTeam,
      score: computeMarginScoreInputs(match, match.winnerTeam),
      formatKey: detectFormatKey(match),
      knownLevelsCount: availability.knownLevelsCount,
    };

    return {
      eligible: true,
      status: MATCH_STATUS.COMPUTABLE,
      reasonCodes: availability.reasonCodes,
      engineInput,
      guestPlayerIds: teamAInput.guestIds.concat(teamBInput.guestIds),
      imputedEffectiveLevel: availability.imputedEffectiveLevel,
      repetition: { A: repA, B: repB },
      circle: { A: circleA, B: circleB },
    };
  }

  /** Flujo completo: arma el contexto y, SOLO si el partido computa, llama a
   *  `Level.computeMatchUpdate` — nunca al revés. Los invitados quedan marcados en
   *  `guestPlayerIds`: sus filas en `engineOutput.players` existen (level.js siempre calcula
   *  las 4) pero NUNCA deben aplicarse — "los invitados nunca reciben actualización" (§13). */
  function computeMatchLevelUpdate(match, history, playerStates, options) {
    const context = buildLevelEngineContext(match, history, playerStates, options);
    if (!context.eligible) {
      return { eligible: false, status: context.status, reasonCodes: context.reasonCodes, engineOutput: null, guestPlayerIds: [] };
    }
    const engineOutput = Level.computeMatchUpdate(context.engineInput);
    return {
      eligible: true,
      status: context.status,
      reasonCodes: context.reasonCodes.concat(engineOutput.reasonCodes),
      engineOutput,
      guestPlayerIds: context.guestPlayerIds,
      imputedEffectiveLevel: context.imputedEffectiveLevel,
    };
  }

  global.PLLevelContext = {
    MATCH_STATUS,
    VALIDATION_STATES,
    REPETITION_WINDOW_DAYS,
    CIRCLE_WINDOW_DAYS,
    CIRCLE_MIN_MATCHES,
    CIRCLE_MAX_COMPANIONS,
    CIRCLE_MAX_GROUP_SIZE,
    CIRCLE_CONCENTRATION_THRESHOLD,
    CIRCLE_AMPLITUDE_MAX,
    CIRCLE_RIVAL_SUPERIORITY_THRESHOLD,
    MANUAL_LOAD_WINDOW_DAYS,
    computeMatchStatus,
    detectFormatKey,
    computeMarginScoreInputs,
    resolvePlayerRating,
    computeAvailabilityContext,
    buildGuestEngineInput,
    computeIndividualRepetitionCounts,
    computeCompanionCount,
    computeTeamRepetitionFactors,
    computeClosedCircleContext,
    buildLevelEngineContext,
    computeMatchLevelUpdate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
