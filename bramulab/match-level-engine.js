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

  /** C-06 (10_Revision_Final_Pre_Staging_ChatGPT.md) — mismo `buildTeamInput` privado de
   *  level-context.js#buildLevelEngineContext, reimplementado en miniatura porque esa función es
   *  un closure interno no exportado (nunca se reabre ni se reimplementa distinto — es exactamente
   *  la misma lógica, solo expuesta para reuso acá). Resuelve jugadores conocidos/invitados de UN
   *  equipo ya resuelto por `LevelContext.computeAvailabilityContext` (que no depende de historial). */
  function buildTeamPlayersInput(resolvedTeam, teamKey, imputedEffectiveLevel) {
    const guestIds = [];
    const players = (resolvedTeam || []).map((r, idx) => {
      const id = r.userId || ('guest:' + teamKey + idx + ':' + (r.name || 'sin_nombre'));
      if (r.known) return { id, mu: r.mu, confidence: r.confidence, state: r.state };
      const mirror = resolvedTeam.find((other) => other !== r && other.known);
      const guestInput = LevelContext.buildGuestEngineInput(imputedEffectiveLevel, mirror ? mirror.confidence : 0.95);
      guestIds.push(id);
      return Object.assign({ id }, guestInput);
    });
    return { players, guestIds };
  }

  /** C-06 — variante de `computeOfficializationResult` EXCLUSIVA de trigger=correction_accepted:
   *  una corrección de RESULTADO (mismos 4 participantes) debe reutilizar los MISMOS factores
   *  contextuales que no dependen del score — repetición/compañero/círculo/disponibilidad/
   *  knownLevelsCount — del resultado más reciente de este partido, nunca recalcularlos desde el
   *  historial ACTUAL (que puede haber cambiado por una anulación/corrección de OTRO encuentro,
   *  alterando el peso de este partido por una razón ajena al score corregido). Solo lo que
   *  depende del SCORE (ganador, margen, formato, deltas) se recalcula desde los sets nuevos.
   *  Una corrección de IDENTIDAD sí puede recalcular estos factores (la composición cambió) —
   *  por eso esta variante es exclusiva de `correction_accepted`, nunca de `identity_resolved`.
   *  `frozenContext`: `{knownLevelsCount, repetitionFactorA, repetitionFactorB, companionFactorA,
   *  companionFactorB, circleFactorByPlayerId}` — el llamador los arma desde el
   *  `currentAppliedResult` vigente ANTES de esta corrección (nunca desde `history`). */
  function computeOfficializationResultFrozenContext({ localMatch, playerStates, frozenContext, validatedAtIso }) {
    const playedAtIso = localMatch && localMatch.playedAt;
    if (!isWithinNivelWindow(playedAtIso, validatedAtIso)) {
      return {
        eligible: false, reasonCodes: [REASON_OUTSIDE_NIVEL_WINDOW], engineOutput: null,
        guestPlayerIds: [], imputedEffectiveLevel: null, context: null,
      };
    }

    const safeMatch = sanitizeUnidentifiedPlayers(localMatch);
    // Disponibilidad/invitados NO depende de historial — reuso directo, nunca reimplementado.
    const availability = LevelContext.computeAvailabilityContext(safeMatch, playerStates || {});
    if (!availability.computable) {
      return {
        eligible: false, reasonCodes: availability.reasonCodes, engineOutput: null,
        guestPlayerIds: [], imputedEffectiveLevel: null, context: null,
      };
    }

    const teamAInput = buildTeamPlayersInput(availability.teamA, 'A', availability.imputedEffectiveLevel);
    const teamBInput = buildTeamPlayersInput(availability.teamB, 'B', availability.imputedEffectiveLevel);

    function circleFactorsForTeam(resolvedTeam) {
      const frozen = (frozenContext && frozenContext.circleFactorByPlayerId) || {};
      return (resolvedTeam || []).map((r) => (r.known && r.userId ? !!frozen[r.userId] : false));
    }

    const engineInput = {
      matchId: safeMatch.matchId,
      teamA: {
        players: teamAInput.players,
        repetitionFactor: frozenContext.repetitionFactorA,
        companionFactor: frozenContext.companionFactorA,
        circleFactors: circleFactorsForTeam(availability.teamA),
      },
      teamB: {
        players: teamBInput.players,
        repetitionFactor: frozenContext.repetitionFactorB,
        companionFactor: frozenContext.companionFactorB,
        circleFactors: circleFactorsForTeam(availability.teamB),
      },
      winnerTeam: safeMatch.winnerTeam,
      score: LevelContext.computeMarginScoreInputs(safeMatch, safeMatch.winnerTeam),
      formatKey: LevelContext.detectFormatKey(safeMatch),
      knownLevelsCount: frozenContext.knownLevelsCount,
    };

    const engineOutput = Level.computeMatchUpdate(engineInput);
    engineInput.teamA.players.concat(engineInput.teamB.players).forEach((p) => {
      if (engineOutput.players[p.id]) engineOutput.players[p.id].state = p.state;
    });

    return {
      eligible: true,
      reasonCodes: (availability.reasonCodes || []).concat(engineOutput.reasonCodes || []),
      engineOutput,
      guestPlayerIds: teamAInput.guestIds.concat(teamBInput.guestIds),
      imputedEffectiveLevel: availability.imputedEffectiveLevel,
      context: {
        knownLevelsCount: frozenContext.knownLevelsCount,
        repetitionFactorA: frozenContext.repetitionFactorA,
        repetitionFactorB: frozenContext.repetitionFactorB,
        companionFactorA: frozenContext.companionFactorA,
        companionFactorB: frozenContext.companionFactorB,
      },
    };
  }

  /** Diferencia NETA entre un resultado anterior (si existe, ya vigente) y uno nuevo recién
   *  calculado (Nivel_BRAMU_Formula_V1.5.md §12.3: "revertir exactamente el efecto anterior;
   *  recalcular; aplicar solo la diferencia neta") — corregido según 06_Revision_Fase_A_
   *  ChatGPT.md B6-A-04/B6-A-05, 08_Revision_Central_Adicional.md B6-B-01 y
   *  10_Revision_Final_Pre_Staging_ChatGPT.md C-01:
   *
   *  C-01 — ni revertir ni aplicar tocan el valor LIVE actual como base aditiva/absoluta: ambos
   *  se calculan como un EFECTO relativo a una única referencia INMUTABLE por partido/jugador
   *  (`originalLiveXBefore` — el valor LIVE que existía la primera vez que este partido se
   *  calculó para este jugador, se propaga sin cambios en cada corrección posterior):
   *
   *    efecto_X = X_after(fórmula, absoluto) - originalLiveXBefore
   *    final_live_X = current_live_X - efecto_anterior_X + efecto_nuevo_X
   *
   *  `X_after` es SIEMPRE el valor absoluto que la fórmula calculó desde su propia referencia
   *  congelada (`newP.muAfter`/`newP.confidenceAfter`, level.js#computeMatchUpdate) — NUNCA el
   *  valor LIVE ya escrito (B6-B-01 asignaba `newP.confidenceAfter` directo como el nuevo LIVE,
   *  y mu sumaba `deltaCapped` sobre el LIVE revertido: ambos casos, si un partido/corrección de
   *  OTRO encuentro ocurrió entre dos aplicaciones de ESTE, el efecto quedaba contaminado por esa
   *  interferencia — el clamp de mu cerca de 1.0/10.0 se re-anclaba en un punto equivocado, y
   *  confidence directamente perdía cualquier ganancia/pérdida posterior). Con `X_after` SIEMPRE
   *  relativo a la MISMA referencia inmutable, el término `originalLiveXBefore` se CANCELA
   *  algebraicamente cuando existe una aplicación anterior (`final = current - oldP.XAfter +
   *  newP.XAfter`) — el efecto de cualquier partido posterior queda intacto sin importar cuántas
   *  veces se corrija este partido. `evidence_units` ya era un incremento puro (`evidenceQuality`,
   *  nunca un valor absoluto) — sigue igual, solo expresado con el mismo criterio de "efecto".
   *
   *  Para un jugador NUEVO en el resultado (`!oldP`): `originalLiveXBefore` lo establece el
   *  llamador vía `current.originalLiveMu/Confidence/EvidenceUnits` — una identidad recién
   *  incorporada por corrección usa su estado RAW histórico reconstruido a la fecha de
   *  oficialización original (nunca su Nivel actual, que puede incluir partidos posteriores);
   *  si falta, se asume el valor LIVE actual (primera vez real, trigger=initial).
   *
   *  `oldAppliedResult`: null, o `{ players: [{playerId, muAfter, confidenceAfter, evidenceQuality,
   *  originalLiveMuBefore, originalLiveConfidenceBefore, originalLiveEvidenceUnitsBefore}] }` —
   *  el `currentAppliedResult` que devuelve `get_match_officialization_snapshot`.
   *  `engineOutput`: la salida de `computeOfficializationResult`/`...FrozenContext` (o null).
   *  `guestPlayerIds`: ids sintéticos de invitados en el engineOutput nuevo — nunca reciben fila.
   *  `currentLevelStatesByPlayerId`: `{[playerId]: {mu,confidence,evidenceUnits,lastRatedAt,
   *  originalLiveMu?,originalLiveConfidence?,originalLiveEvidenceUnits?}}` LIVE actual (ahora
   *  mismo) — el llamador la arma leyendo `levelStates` de `get_match_officialization_snapshot`
   *  para cualquier player_id involucrado (viejo ∪ nuevo). */
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

      // Baseline LIVE original INMUTABLE de este partido para este jugador (C-01) — oldP ya
      // trae el propio (se propaga sin cambios entre correcciones); si es nuevo, lo decide el
      // llamador o, por defecto, el valor LIVE actual (primera vez real).
      const originalLiveMuBefore = oldP ? oldP.originalLiveMuBefore
        : (Number.isFinite(current.originalLiveMu) ? current.originalLiveMu : current.mu);
      const originalLiveConfidenceBefore = oldP ? oldP.originalLiveConfidenceBefore
        : (Number.isFinite(current.originalLiveConfidence) ? current.originalLiveConfidence : current.confidence);
      const originalLiveEvidenceUnitsBefore = oldP ? oldP.originalLiveEvidenceUnitsBefore
        : (Number.isFinite(current.originalLiveEvidenceUnits) ? current.originalLiveEvidenceUnits : (current.evidenceUnits || 0));

      // Efecto de la aplicación ANTERIOR, relativo a ese baseline inmutable — nunca al LIVE de
      // aquel momento (C-01: eso seguía siendo vulnerable a un partido/corrección posterior
      // intercalado entre esa aplicación y esta).
      const oldMuEffect = oldP ? (oldP.muAfter - originalLiveMuBefore) : 0;
      const oldConfidenceEffect = oldP ? (oldP.confidenceAfter - originalLiveConfidenceBefore) : 0;
      const oldEvidenceEffect = oldP ? oldP.evidenceQuality : 0;

      if (!newP) {
        // Solo reversión pura — identidad retirada de este partido, o corrección que ya no
        // incluye a este jugador.
        levelStateUpdates.push({
          playerId,
          currentMuForLock: current.mu,
          currentConfidenceForLock: current.confidence,
          currentEvidenceUnitsForLock: current.evidenceUnits || 0,
          finalMu: Level.clampLevel(current.mu - oldMuEffect),
          finalConfidence: current.confidence - oldConfidenceEffect,
          finalEvidenceUnits: Math.max(0, (current.evidenceUnits || 0) - oldEvidenceEffect),
        });
        return;
      }

      // Efecto NUEVO, relativo al MISMO baseline inmutable — `newP.muAfter`/`confidenceAfter`
      // son los valores ABSOLUTOS que la fórmula ya calculó (level.js#computeMatchUpdate) desde
      // su propia referencia congelada (`newP.muBefore`/`confidenceBefore`), nunca reconstruidos
      // acá. `evidenceQuality` ya es un incremento puro, no depende de ningún baseline.
      const newMuEffect = newP.muAfter - originalLiveMuBefore;
      const newConfidenceEffect = newP.confidenceAfter - originalLiveConfidenceBefore;
      const newEvidenceEffect = newP.evidenceQuality;

      const finalMu = Level.clampLevel(current.mu - oldMuEffect + newMuEffect);
      const finalConfidence = current.confidence - oldConfidenceEffect + newConfidenceEffect;
      const finalEvidenceUnits = Math.max(0, (current.evidenceUnits || 0) - oldEvidenceEffect + newEvidenceEffect);

      levelStateUpdates.push({
        playerId,
        currentMuForLock: current.mu,
        currentConfidenceForLock: current.confidence,
        currentEvidenceUnitsForLock: current.evidenceUnits || 0,
        finalMu,
        finalConfidence,
        finalEvidenceUnits,
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
        // Baseline LIVE inmutable — se propaga SIN CAMBIOS a través de cualquier corrección
        // futura de este mismo partido (C-01).
        originalLiveMuBefore,
        originalLiveConfidenceBefore,
        originalLiveEvidenceUnitsBefore,
        // Valores ABSOLUTOS de fórmula de ESTA aplicación — sostienen el efecto de una futura
        // corrección sin contaminarse por el LIVE (C-01). NUNCA lo que se escribió en
        // level_states (eso es finalMu/finalConfidence, ver levelStateUpdates arriba).
        muAfter: newP.muAfter,
        confidenceAfter: newP.confidenceAfter,
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
    computeOfficializationResultFrozenContext,
    computeLevelStateUpdates,
  };
})(typeof window !== 'undefined' ? window : globalThis);
