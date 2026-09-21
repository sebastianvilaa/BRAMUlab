/* ==========================================================================
   BRAMU Lab — match-level-engine.js (Backend Bloque 6, Etapa C de Nivel BRAMU)
   Capa de orquestación MÍNIMA entre datos server-backed (Bloque 5/6) y el
   motor de Nivel ya cerrado (level.js = Etapa A, level-context.js = Etapa B).
   Cero DOM, cero localStorage, cero red — mismo criterio que el resto del
   motor: recibe objetos ya resueltos por la Edge Function (que sí consulta
   Supabase) y devuelve estructuras listas para persistir.

   Revisión 06_Revision_Fase_A_ChatGPT.md (21/09/2026) — B6-A-04/B6-A-05
   corregidos acá:
   - la reversión de `mu`/`confidence`/`evidence_units` usa el MOVIMIENTO
     REALMENTE APLICADO (`after - before`) de la aplicación anterior, nunca
     `deltaCapped` — el clamp de escala 1.0/10.0 puede haber recortado el
     movimiento efectivo cerca de los bordes (B6-A-04);
   - `confidence` se calcula con la fórmula INCREMENTAL real
     (`Level.computeConfidenceAfterMatch`), nunca reconstruida "desde cero"
     con evidence_units — evidence_units queda como total histórico de
     auditoría (Nivel_BRAMU_Formula_V1.5.md §10.1), pero no vuelve a
     determinar `confidence` por sí solo una vez que existió decay por
     inactividad (B6-A-05, ver `computeEffectiveConfidence`);
   - se distingue explícitamente la referencia de FÓRMULA (`formulaMuBefore`/
     `formulaConfidenceBefore`/`formulaState` — inmutable por partido,
     alimenta expectativa/K) del valor LIVE realmente aplicado
     (`muBefore`/`muAfter`/... — cambia con cada aplicación, sostiene la
     reversión exacta).

   POR QUÉ ESTE ARCHIVO ES CHICO (a propósito, ver 02_Analisis_Claude.md §3.2/
   §3.8 y Riesgo 1 tras auditar el código existente):
   - la traducción de una fila server-backed a la forma local que
     `level-context.js` espera YA la resuelve
     `match-sync.js#translateServerMatchToLocalShape` (Bloque 5);
   - la matemática de Nivel, incluida repetición/compañero/círculo
     competitivo real desde historial, YA la resuelve
     `level-context.js#computeMatchLevelUpdate` (Etapa B) + `level.js`
     (Etapa A) — este archivo no las reimplementa, las invoca.

   Lo que SÍ falta y por eso vive acá:
   - la ventana de 30 días desde `played_at` que determina si un partido
     `validated` produce o no efecto de Nivel (Decisión Abierta #1, resuelta);
   - el mapeo entre `level_states.status` y `Level.STATES`;
   - la confianza EFECTIVA por inactividad (Nivel_BRAMU_Formula_V1.5.md
     §10.3), calculada acá y nunca en SQL;
   - una referencia sintética única por slot "no identificado";
   - la reversión/reaplicación por diferencia neta con movimiento real
     (B6-A-04) y confianza incremental (B6-A-05).
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;
  const LevelContext = global.PLLevelContext;

  // Nivel_BRAMU_Formula_V1.5.md §12.2/§13 — Decisión Abierta #1, resuelta: validated_at -
  // played_at > 30 días => historial/estadísticas oficiales sí, Nivel no. Bloque 5 no se reabre
  // (su propia ventana de carga+pendiente puede permitir hasta 44 días entre played_at y
  // validated_at); este chequeo es ADICIONAL y más estricto, exclusivo del efecto de Nivel.
  const NIVEL_MATCH_WINDOW_DAYS = 30;
  const DAY_MS = 86400000;

  const REASON_OUTSIDE_NIVEL_WINDOW = 'fuera_de_ventana_30_dias_desde_partido';

  function parseTimeOrNull(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /** true si `validatedAtIso` (la oficialización actual o la original de un partido ya
   *  validado — nunca "ahora" en una reaplicación, ver cabecera del módulo) cae dentro de los
   *  30 días posteriores a `playedAtIso`. Si falta cualquiera de las dos fechas, se considera
   *  FUERA de ventana (nunca se asume elegible por datos incompletos). */
  function isWithinNivelWindow(playedAtIso, validatedAtIso) {
    const played = parseTimeOrNull(playedAtIso);
    const validated = parseTimeOrNull(validatedAtIso);
    if (played === null || validated === null) return false;
    return (validated - played) <= NIVEL_MATCH_WINDOW_DAYS * DAY_MS;
  }

  /** level_states.status (Bloque 3) -> Level.STATES (level.js, Bloque 3 Etapa A). Los strings
   *  NO coinciden: PENDIENTE no tiene equivalente útil acá (un jugador PENDIENTE nunca debería
   *  llegar a este módulo con mu utilizable — ver buildPlayerStatesDict). */
  function mapLevelStateStatusToEngineState(status) {
    switch (status) {
      case 'CALIBRANDO': return Level.STATES.CALIBRATING;
      case 'CALIBRADO': return Level.STATES.CALIBRATED;
      case 'RECALIBRANDO': return Level.STATES.RECALIBRATING;
      default: return Level.STATES.NONE;
    }
  }

  /** Level.STATES -> level_states.status, para escribir de vuelta. */
  function mapEngineStateToLevelStateStatus(state) {
    switch (state) {
      case Level.STATES.CALIBRATING: return 'CALIBRANDO';
      case Level.STATES.CALIBRATED: return 'CALIBRADO';
      case Level.STATES.RECALIBRATING: return 'RECALIBRANDO';
      default: return 'PENDIENTE';
    }
  }

  /** Nivel_BRAMU_Formula_V1.5.md §10.3 — B6-A-05. Sin cambio los primeros 60 días sin
   *  actividad computable; después, la confianza EFECTIVA decae (nunca `mu`). `lastRatedAtIso`
   *  nulo (jugador recién oficializado, sin ningún partido computable todavía) significa "sin
   *  decay posible todavía" — se devuelve `rawConfidence` sin tocar. */
  function computeEffectiveConfidence(rawConfidence, lastRatedAtIso, referenceIso) {
    if (!Number.isFinite(rawConfidence)) return rawConfidence;
    const lastRated = parseTimeOrNull(lastRatedAtIso);
    const reference = parseTimeOrNull(referenceIso);
    if (lastRated === null || reference === null) return rawConfidence;
    const daysInactive = Math.max(0, (reference - lastRated) / DAY_MS);
    return Level.computeEffectiveConfidenceAfterInactivity(rawConfidence, daysInactive);
  }

  /** `{playerId,mu,confidence,status,lastRatedAt}[]` (filas crudas de level_states,
   *  service_role) -> `{[playerId]: {mu,confidence,state}}` (lo que `resolvePlayerRating` de
   *  level-context.js necesita) — con la confianza ya ajustada por inactividad respecto de
   *  `referenceIso` (`localMatch.playedAt`, B6-A-05). Un jugador PENDIENTE (mu/confidence
   *  todavía null) queda deliberadamente AFUERA del diccionario: level-context.js lo trata
   *  entonces como invitado sin nivel conocido (Nivel_BRAMU_Formula_V1.5.md §13). Este
   *  diccionario es la referencia por defecto para un jugador que NO tiene todavía un
   *  `priorSnapshot` propio de este partido — ver `computeOfficializationResult` y el
   *  orquestador (`match-officialize-core.ts`), que la combina con los snapshots inmutables ya
   *  existentes antes de llamar acá. */
  function buildPlayerStatesDict(levelStateRows, referenceIso) {
    const dict = {};
    (Array.isArray(levelStateRows) ? levelStateRows : []).forEach((row) => {
      if (!row || !row.playerId) return;
      if (!Number.isFinite(row.mu) || !Number.isFinite(row.confidence)) return;
      dict[row.playerId] = {
        mu: row.mu,
        confidence: computeEffectiveConfidence(row.confidence, row.lastRatedAt, referenceIso),
        state: mapLevelStateStatusToEngineState(row.status),
      };
    });
    return dict;
  }

  /** Referencia sintética ÚNICA para un slot sin `player_id` (por identificar / no
   *  identificado). Nunca dos slots distintos —ni siquiera en partidos distintos— deben
   *  terminar agrupados como "la misma persona" por `identityKey` (level-context.js, que cae a
   *  `'name:' + nombre_normalizado` cuando no hay `userId`) — por eso el nombre incluye
   *  matchId+team+position, no un texto genérico fijo como "Por identificar". */
  function buildUnidentifiedRef(matchId, team, position) {
    const shortId = String(matchId || '').replace(/-/g, '').slice(0, 8) || 'sinid';
    return { name: `Sin identificar (${shortId}-${team}${position})`, userId: null };
  }

  /** `PLMatchSync.translateServerMatchToLocalShape` (Bloque 5) copia `displayName` tal cual
   *  para un slot sin `player_id` — que server-side es SIEMPRE el mismo string compartido
   *  ('Por identificar', ver report_identity_issue) para cualquier slot no identificado de
   *  CUALQUIER partido. Sin este paso, dos slots sin identidad de partidos distintos
   *  colisionarían como "la misma persona" en `identityKey`. Se aplica sobre CUALQUIER partido
   *  que vaya a alimentar el motor — el actual y cada partido de `history` — mutando una copia,
   *  nunca el objeto original. Un jugador ya identificado (`userId` presente) no se toca. */
  function sanitizeUnidentifiedPlayers(localMatch) {
    if (!localMatch || !Array.isArray(localMatch.players)) return localMatch;
    const players = localMatch.players.map((p) => {
      if (p && !p.userId) {
        const ref = buildUnidentifiedRef(localMatch.matchId, p.team, p.id);
        return Object.assign({}, p, { name: ref.name });
      }
      return p;
    });
    return Object.assign({}, localMatch, { players });
  }

  /** Punto único de entrada: decide primero la ventana de Nivel (§12.2/§13) y SOLO si el
   *  partido está dentro de ventana invoca el motor real. `localMatch`/`history` deben venir
   *  YA en la forma local que `PLMatchSync.translateServerMatchToLocalShape` produce.
   *  `playerStates` ya debe traer, para cada jugador conocido, la referencia de FÓRMULA correcta
   *  (snapshot inmutable si ya existe uno para este partido, o el valor actual con inactividad
   *  ya aplicada si es la primera vez — arma esta combinación el orquestador, no este módulo).
   *  `validatedAtIso` es la oficialización ACTUAL (primera vez) o la ORIGINAL ya fija del
   *  partido (corrección/identidad) — nunca "ahora" en una reaplicación.
   *
   *  Devuelve siempre la misma forma, elegible o no:
   *    { eligible, reasonCodes, engineOutput, guestPlayerIds, imputedEffectiveLevel, context } */
  function computeOfficializationResult({ localMatch, history, playerStates, validatedAtIso }) {
    const playedAtIso = localMatch && localMatch.playedAt;
    if (!isWithinNivelWindow(playedAtIso, validatedAtIso)) {
      return {
        eligible: false,
        reasonCodes: [REASON_OUTSIDE_NIVEL_WINDOW],
        engineOutput: null,
        guestPlayerIds: [],
        imputedEffectiveLevel: null,
        context: null,
      };
    }

    // Sanitiza slots sin identidad ANTES de tocar el motor — el propio partido actual y cada
    // partido de `history` (ver sanitizeUnidentifiedPlayers): nunca queda a cargo del llamador
    // acordarse de hacerlo.
    const safeMatch = sanitizeUnidentifiedPlayers(localMatch);
    const safeHistory = (Array.isArray(history) ? history : []).map(sanitizeUnidentifiedPlayers);
    const options = { nowIso: playedAtIso };

    // Llama a las dos funciones de nivel más bajo de level-context.js en la MISMA secuencia
    // exacta que su propio `computeMatchLevelUpdate` (no se reimplementa ninguna fórmula, solo
    // se captura también `context.engineInput` — knownLevelsCount, repetitionFactor/
    // companionFactor por equipo — que la función de conveniencia no expone).
    const context = LevelContext.buildLevelEngineContext(safeMatch, safeHistory, playerStates || {}, options);
    if (!context.eligible) {
      return {
        eligible: false,
        reasonCodes: context.reasonCodes || [],
        engineOutput: null,
        guestPlayerIds: [],
        imputedEffectiveLevel: null,
        context: null,
      };
    }

    const engineOutput = Level.computeMatchUpdate(context.engineInput);

    // `computeMatchUpdate` no repite `state` en su salida (era solo un INPUT) — se adjunta acá
    // desde `context.engineInput` para que `computeLevelStateUpdates` pueda persistir
    // `formulaState` (la referencia de estado que alimentó K/cap, Nivel_BRAMU_Formula_V1.5.md
    // §9) junto con `formulaMuBefore`/`formulaConfidenceBefore`.
    context.engineInput.teamA.players.concat(context.engineInput.teamB.players).forEach((p) => {
      if (engineOutput.players[p.id]) engineOutput.players[p.id].state = p.state;
    });

    return {
      eligible: true,
      reasonCodes: (context.reasonCodes || []).concat(engineOutput.reasonCodes || []),
      engineOutput,
      guestPlayerIds: context.guestPlayerIds || [],
      imputedEffectiveLevel: context.imputedEffectiveLevel != null ? context.imputedEffectiveLevel : null,
      context: {
        knownLevelsCount: context.engineInput.knownLevelsCount,
        repetitionFactorA: context.engineInput.teamA.repetitionFactor,
        repetitionFactorB: context.engineInput.teamB.repetitionFactor,
        companionFactorA: context.engineInput.teamA.companionFactor,
        companionFactorB: context.engineInput.teamB.companionFactor,
      },
    };
  }

  /** Diferencia NETA entre un resultado anterior (si existe, ya vigente) y uno nuevo recién
   *  calculado (Nivel_BRAMU_Formula_V1.5.md §12.3: "revertir exactamente el efecto anterior;
   *  recalcular; aplicar solo la diferencia neta") — corregido según 06_Revision_Fase_A_
   *  ChatGPT.md B6-A-04/B6-A-05 y 08_Revision_Central_Adicional.md B6-B-01:
   *
   *  1) Revertir usa el MOVIMIENTO REALMENTE APLICADO de la aplicación anterior
   *     (`oldP.muAfter - oldP.muBefore` / `oldP.confidenceAfter - oldP.confidenceBefore`, ambos
   *     LIVE — nunca `deltaCapped`/`evidenceQuality`, que pueden diferir del movimiento real
   *     cerca de los clamps 1.0/10.0 o de la fórmula incremental).
   *  2) El nuevo `confidenceAfter` (LIVE) es EXACTAMENTE `newP.confidenceAfter` — el motor ya lo
   *     calculó desde su propia referencia de fórmula congelada (`newP.confidenceBefore` =
   *     `formulaConfidenceBefore`, ya decay-ajustada por quien armó `playerStates` — nunca se
   *     vuelve a aplicar decay ni se recalcula acá, B6-B-01). El nuevo `confidenceBefore` (LIVE)
   *     es el valor LIVE tal cual estaba INMEDIATAMENTE ANTES de esta aplicación
   *     (`confidenceAfterRevert`) — nunca la base decayeada que alimentó la fórmula. Antes de
   *     este fix, `confidenceBefore` persistía la base YA decayeada: revertir devolvía esa base
   *     decayeada en vez de la confianza cruda original, y el siguiente partido podía volver a
   *     aplicar decay sobre un valor que ya estaba decayeado ("doble decay", B6-B-01).
   *  3) `mu`/`confidence`/`evidence_units` "before"/"after" que se persisten en
   *     `match_level_result_players` son los valores LIVE de ESTA aplicación puntual (soportan
   *     la próxima reversión exacta) — DISTINTOS de `formulaMuBefore`/`formulaConfidenceBefore`
   *     (la referencia inmutable que alimentó la fórmula, ya presente en `newP` vía
   *     `engineOutput.players[id].muBefore/confidenceBefore`).
   *
   *  `oldAppliedResult`: null, o `{ players: [{playerId, muBefore, muAfter, confidenceBefore,
   *  confidenceAfter, evidenceUnitsBefore, evidenceUnitsAfter}] }` — los valores LIVE ya
   *  persistidos por la aplicación anterior (el `currentAppliedResult` que devuelve
   *  `get_match_officialization_snapshot`).
   *  `engineOutput`: la salida de `computeOfficializationResult` (o null si no eligible).
   *  `guestPlayerIds`: ids sintéticos de invitados en el engineOutput nuevo — nunca reciben fila.
   *  `currentLevelStatesByPlayerId`: `{[playerId]: {mu,confidence,evidenceUnits,lastRatedAt}}`
   *  LIVE actual (ahora mismo) — el llamador la arma leyendo `levelStates` de
   *  `get_match_officialization_snapshot` para cualquier player_id involucrado (viejo ∪ nuevo).
   *  Nunca recibe/necesita `referenceIso`: la inactividad (B6-A-05) ya se resolvió ANTES de
   *  llegar acá, al construir `playerStates` para el motor (`buildPlayerStatesDict` o el
   *  snapshot inmutable de una corrección) — este módulo solo usa lo que `newP.confidenceBefore`
   *  ya trae. */
  function computeLevelStateUpdates({ oldAppliedResult, engineOutput, guestPlayerIds, currentLevelStatesByPlayerId }) {
    const oldByPlayerId = {};
    ((oldAppliedResult && oldAppliedResult.players) || []).forEach((p) => {
      if (p && p.playerId) oldByPlayerId[p.playerId] = p;
    });

    const guestSet = new Set(guestPlayerIds || []);
    const newByPlayerId = {};
    if (engineOutput && engineOutput.players) {
      Object.keys(engineOutput.players).forEach((id) => {
        if (guestSet.has(id)) return; // invitados nunca reciben efecto (Formula V1.5 §13/§21).
        newByPlayerId[id] = Object.assign({ playerId: id }, engineOutput.players[id]);
      });
    }

    const allPlayerIds = Array.from(new Set(Object.keys(oldByPlayerId).concat(Object.keys(newByPlayerId))));
    const resultPlayers = [];
    const levelStateUpdates = [];

    allPlayerIds.forEach((playerId) => {
      const current = (currentLevelStatesByPlayerId || {})[playerId];
      if (!current) return; // defensivo: el llamador debe garantizar cobertura completa.
      const oldP = oldByPlayerId[playerId];
      const newP = newByPlayerId[playerId];

      // Paso 1 — revertir el movimiento REAL de la aplicación anterior (B6-A-04): nunca
      // deltaCapped, siempre after-before ya persistido.
      const oldMuMovement = oldP ? (oldP.muAfter - oldP.muBefore) : 0;
      const oldConfidenceMovement = oldP ? (oldP.confidenceAfter - oldP.confidenceBefore) : 0;
      const oldEvidenceMovement = oldP ? (oldP.evidenceUnitsAfter - oldP.evidenceUnitsBefore) : 0;

      const muAfterRevert = Level.clampLevel(current.mu - oldMuMovement);
      // confidence no tiene clamp de escala propio (su rango lo mantiene la propia fórmula
      // incremental entre 0 y CONFIDENCE_MAX); evidence_units sí tiene piso 0.
      const confidenceAfterRevert = current.confidence - oldConfidenceMovement;
      const evidenceUnitsAfterRevert = Math.max(0, (current.evidenceUnits || 0) - oldEvidenceMovement);

      if (!newP) {
        // Solo reversión pura — identidad retirada de este partido, o corrección que ya no
        // incluye a este jugador.
        levelStateUpdates.push({
          playerId,
          currentMuForLock: current.mu,
          currentConfidenceForLock: current.confidence,
          currentEvidenceUnitsForLock: current.evidenceUnits || 0,
          finalMu: muAfterRevert,
          finalConfidence: confidenceAfterRevert,
          finalEvidenceUnits: evidenceUnitsAfterRevert,
        });
        return;
      }

      // Paso 2 — aplicar el delta NUEVO. B6-B-01: `confidenceAfter` es EXACTAMENTE lo que el
      // motor ya calculó (`newP.confidenceAfter` = `Level.computeConfidenceAfterMatch(newP.
      // confidenceBefore, newP.evidenceQuality)`, level.js#computeMatchUpdate) — nunca se vuelve
      // a invocar la fórmula acá ni se aplica decay una segunda vez: quien armó `playerStates`
      // para el motor (buildPlayerStatesDict o el snapshot inmutable de una corrección) ya
      // decidió la base correcta (decayeada o no). `mu` sigue siendo un delta ADITIVO
      // (`deltaCapped`) aplicado sobre el valor LIVE ya revertido — a diferencia de confidence,
      // el delta de mu es independiente de la base salvo el clamp de escala, ya cubierto por el
      // paso de reversión (B6-A-04).
      const muAfterApply = Level.clampLevel(muAfterRevert + newP.deltaCapped);
      const confidenceAfterApply = newP.confidenceAfter;
      const evidenceUnitsAfterApply = evidenceUnitsAfterRevert + newP.evidenceQuality;

      levelStateUpdates.push({
        playerId,
        currentMuForLock: current.mu,
        currentConfidenceForLock: current.confidence,
        currentEvidenceUnitsForLock: current.evidenceUnits || 0,
        finalMu: muAfterApply,
        finalConfidence: confidenceAfterApply,
        finalEvidenceUnits: evidenceUnitsAfterApply,
      });

      resultPlayers.push({
        playerId,
        team: newP.team,
        // Referencia de FÓRMULA (inmutable por partido — alimentó expectativa/K/opponentFactor).
        // Nunca se usa para revertir, solo para explicar/auditar el cálculo y para que una
        // futura corrección de ESTE MISMO partido siga usando "los mismos snapshots previos"
        // (Nivel_BRAMU_Formula_V1.5.md §12.3).
        formulaMuBefore: newP.muBefore,
        formulaConfidenceBefore: newP.confidenceBefore,
        formulaState: mapEngineStateToLevelStateStatus(newP.state),
        effectiveLevel: newP.effectiveLevel,
        k: newP.k,
        opponentFactor: newP.opponentFactor,
        circleFactor: newP.circleFactor,
        deltaRaw: newP.deltaRaw,
        deltaCapped: newP.deltaCapped,
        evidenceQuality: newP.evidenceQuality,
        // Valores LIVE realmente aplicados en ESTA operación — sostienen la próxima reversión
        // exacta (B6-A-04/B6-B-01). confidenceBefore es el valor LIVE tal cual estaba
        // INMEDIATAMENTE ANTES de esta aplicación (nunca la base decayeada que alimentó la
        // fórmula) — así "after - before" siempre reconstruye el movimiento total (decay +
        // delta del partido) y revertir restaura exactamente la confianza cruda previa.
        muBefore: muAfterRevert,
        muAfter: muAfterApply,
        confidenceBefore: confidenceAfterRevert,
        confidenceAfter: confidenceAfterApply,
        evidenceUnitsBefore: evidenceUnitsAfterRevert,
        evidenceUnitsAfter: evidenceUnitsAfterApply,
      });
    });

    return { resultPlayers, levelStateUpdates };
  }

  global.PLMatchLevelEngine = {
    NIVEL_MATCH_WINDOW_DAYS,
    REASON_OUTSIDE_NIVEL_WINDOW,
    isWithinNivelWindow,
    mapLevelStateStatusToEngineState,
    mapEngineStateToLevelStateStatus,
    computeEffectiveConfidence,
    buildPlayerStatesDict,
    buildUnidentifiedRef,
    sanitizeUnidentifiedPlayers,
    computeOfficializationResult,
    computeLevelStateUpdates,
  };
})(typeof window !== 'undefined' ? window : globalThis);
