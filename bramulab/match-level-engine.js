/* ==========================================================================
   BRAMU Lab — match-level-engine.js (Backend Bloque 6, Etapa C de Nivel BRAMU)
   Capa de orquestación MÍNIMA entre datos server-backed (Bloque 5/6) y el
   motor de Nivel ya cerrado (level.js = Etapa A, level-context.js = Etapa B).
   Cero DOM, cero localStorage, cero red — mismo criterio que el resto del
   motor: recibe objetos ya resueltos por la Edge Function (que sí consulta
   Supabase) y devuelve estructuras listas para persistir.

   POR QUÉ ESTE ARCHIVO ES CHICO (a propósito, ver 02_Analisis_Claude.md §3.2/
   §3.8 y Riesgo 1 tras auditar el código existente):
   - la traducción de una fila server-backed a la forma local que
     `level-context.js` espera (`players[]`, `sets[]` con `winner` derivado,
     `mode:'manual'`, `regulationCompleted:true`) YA la resuelve
     `match-sync.js#translateServerMatchToLocalShape` (Bloque 5) — este
     archivo no la reimplementa, la Edge Function reutiliza esa función tal
     cual sobre filas que las RPCs de lectura de Bloque 6 devuelven con la
     MISMA forma camelCase que `get_my_matches`;
   - la matemática de Nivel, incluida repetición/compañero/círculo
     competitivo real desde historial, YA la resuelve
     `level-context.js#computeMatchLevelUpdate` (Etapa B) + `level.js`
     (Etapa A) — este archivo no las reimplementa, las invoca;
   - la reconstrucción de "estado de un jugador a una fecha pasada"
     (Decisión Abierta #2, resuelta por 04_Revision_ChatGPT.md §2) y el
     conteo de rated_matches/distinct_opponents se resuelven en SQL, por
     consulta directa contra match_level_result_players — no hace falta
     reimplementarlos acá (ver migraciones de Bloque 6).

   Lo que SÍ falta y por eso vive acá:
   - la ventana de 30 días desde `played_at` que determina si un partido
     `validated` produce o no efecto de Nivel (Nivel_BRAMU_Formula_V1.5.md
     §12.2/§13, resuelta como Decisión Abierta #1 por 04_Revision_ChatGPT.md
     §1) — el chequeo interno de `level-context.js` (createdAt-playedAt) NO
     sirve para esto con datos de Bloque 5 (ver 02_Analisis_Claude.md Riesgo
     2), así que el chequeo real vive acá, ANTES de invocar el motor;
   - el mapeo entre `level_states.status` (PENDIENTE/CALIBRANDO/CALIBRADO/
     RECALIBRANDO) y `Level.STATES` (sin_estimacion/calibrando/calibrado/
     recalibrando) — los strings no coinciden 1:1;
   - una referencia sintética única por slot "no identificado", para que dos
     slots sin identidad en partidos distintos nunca se traten como "la
     misma persona" por coincidencia de nombre dentro de level-context.js;
   - el punto único de entrada que decide, ANTES de tocar el motor, si un
     partido produce efecto de Nivel o no, y devuelve un resultado uniforme
     tanto para el caso "no computable" como para el caso "computable".
   ========================================================================== */
(function (global) {
  'use strict';

  const Level = global.PLLevel;
  const LevelContext = global.PLLevelContext;

  // Nivel_BRAMU_Formula_V1.5.md §12.2/§13 — resuelto como Decisión Abierta #1 por
  // 04_Revision_ChatGPT.md §1: validated_at - played_at > 30 días => historial/estadísticas
  // oficiales sí, Nivel no. Bloque 5 no se reabre (su propia ventana de carga+pendiente puede
  // permitir hasta 44 días entre played_at y validated_at); este chequeo es ADICIONAL y más
  // estricto, exclusivo del efecto de Nivel.
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

  /** `{playerId,mu,confidence,status}[]` (fila cruda de level_states, service_role) ->
   *  `{[playerId]: {mu,confidence,state}}` (lo que `resolvePlayerRating` de level-context.js
   *  necesita). Un jugador PENDIENTE (mu/confidence todavía null, cuestionario sin confirmar)
   *  queda deliberadamente AFUERA del diccionario: level-context.js lo trata entonces como
   *  invitado sin nivel conocido, exactamente la regla correcta para alguien sin Nivel real
   *  todavía (Nivel_BRAMU_Formula_V1.5.md §13) — nunca se le inventa un mu. */
  function buildPlayerStatesDict(levelStateRows) {
    const dict = {};
    (Array.isArray(levelStateRows) ? levelStateRows : []).forEach((row) => {
      if (!row || !row.playerId) return;
      if (!Number.isFinite(row.mu) || !Number.isFinite(row.confidence)) return;
      dict[row.playerId] = {
        mu: row.mu,
        confidence: row.confidence,
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
   *  colisionarían como "la misma persona" en `identityKey` (level-context.js cae a
   *  `'name:'+nombre` cuando no hay `userId`). Se aplica sobre CUALQUIER partido que vaya a
   *  alimentar el motor — el actual y cada partido de `history` — mutando una copia, nunca el
   *  objeto original. Un jugador ya identificado (`userId` presente) no se toca. */
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
   *  YA en la forma local que `PLMatchSync.translateServerMatchToLocalShape` produce (la Edge
   *  Function la reutiliza tal cual, ver cabecera). `playedAtIso` es `localMatch.playedAt`;
   *  `validatedAtIso` es la oficialización ACTUAL (primera vez) o la ORIGINAL ya fija del
   *  partido (corrección/identidad) — nunca "ahora" en una reaplicación.
   *
   *  Devuelve siempre la misma forma, elegible o no, para que el llamador nunca tenga que
   *  distinguir "no elegible" de "elegible pero sin computar" con dos contratos distintos:
   *    { eligible, reasonCodes, engineOutput, guestPlayerIds, imputedEffectiveLevel } */
  function computeOfficializationResult({ localMatch, history, playerStates, validatedAtIso }) {
    const playedAtIso = localMatch && localMatch.playedAt;
    if (!isWithinNivelWindow(playedAtIso, validatedAtIso)) {
      return {
        eligible: false,
        reasonCodes: [REASON_OUTSIDE_NIVEL_WINDOW],
        engineOutput: null,
        guestPlayerIds: [],
        imputedEffectiveLevel: null,
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
    // companionFactor por equipo — que la función de conveniencia no expone y que
    // match_level_results necesita para auditoría completa, Nivel_BRAMU_Formula_V1.5.md §19).
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
   *  recalcular; aplicar solo la diferencia neta"). Nunca reimplementa el motor: toma los
   *  deltas YA CALCULADOS de ambos lados y hace aritmética simple sobre el estado LIVE actual
   *  de cada jugador. Cubre los tres casos:
   *   - jugador en ambos (corrección de resultado con los mismos 4, o identidad que no lo
   *     afecta): net = deltaNuevo - deltaViejo;
   *   - jugador solo en el nuevo (identidad recién asignada a este partido): net = deltaNuevo
   *     puro, usando el mu efectivo LIVE actual como base — el snapshot "antes de ESTE
   *     partido" que alimentó el cálculo del motor es otro concepto (ver
   *     get_match_officialization_snapshot/get_player_level_state_as_of), no se confunde con
   *     "estado live actual sobre el que se aplica el neto";
   *   - jugador solo en el viejo (identidad retirada de este partido): net = -deltaViejo puro.
   *
   *  `oldAppliedResult`: null, o `{ players: [{playerId, deltaCapped, evidenceQuality}] }` (el
   *  `currentAppliedResult` que devuelve get_match_officialization_snapshot).
   *  `engineOutput`: la salida de `computeOfficializationResult` (o null si no eligible — en ese
   *  caso el nuevo lado no aporta a nadie, todo el mundo solo revierte lo viejo).
   *  `guestPlayerIds`: ids sintéticos de invitados en el engineOutput nuevo — nunca reciben fila.
   *  `currentLevelStatesByPlayerId`: `{[playerId]: {mu,confidence,evidenceUnits,confidenceOrigin}}`
   *  LIVE actual — el llamador la arma leyendo `levelStates` de
   *  get_match_officialization_snapshot para cualquier player_id involucrado (viejo ∪ nuevo).
   *  `preMatchEvidenceUnitsByPlayerId`: `{[playerId]: number}` — evidence_units INMUTABLE de
   *  cada jugador nuevo en el resultado, tal como estaba justo antes de ESTE partido (de
   *  `priorSnapshots`, o reconstruido con get_player_level_state_as_of para una identidad
   *  recién asignada — Decisión Abierta #2). 0 si no hay ningún antecedente (jugador sin Nivel
   *  antes de este partido). Es un concepto DISTINTO de `currentLevelStatesByPlayerId`: éste es
   *  "antes de este partido específico" (fijo para siempre), aquél es "ahora mismo" (cambia con
   *  cada partido). Solo se usa para completar la fila de auditoría (match_level_result_players),
   *  nunca para el neto aplicado a level_states. */
  function computeLevelStateUpdates({
    oldAppliedResult, engineOutput, guestPlayerIds, currentLevelStatesByPlayerId, preMatchEvidenceUnitsByPlayerId,
  }) {
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
      const oldDelta = oldP ? oldP.deltaCapped : 0;
      const oldEvidence = oldP ? oldP.evidenceQuality : 0;
      const newDelta = newP ? newP.deltaCapped : 0;
      const newEvidence = newP ? newP.evidenceQuality : 0;

      const netMuChange = newDelta - oldDelta;
      const netEvidenceChange = newEvidence - oldEvidence;
      const finalMu = Level.clampLevel(current.mu + netMuChange);
      const finalEvidenceUnits = Math.max(0, (current.evidenceUnits || 0) + netEvidenceChange);
      const finalConfidence = Level.computeConfidenceFromEvidence(finalEvidenceUnits, current.confidenceOrigin);

      levelStateUpdates.push({
        playerId,
        currentMuForLock: current.mu,
        currentConfidenceForLock: current.confidence,
        currentEvidenceUnitsForLock: current.evidenceUnits || 0,
        finalMu,
        finalConfidence,
        finalEvidenceUnits,
      });

      if (newP) {
        const evidenceUnitsBefore = ((preMatchEvidenceUnitsByPlayerId || {})[playerId]) || 0;
        resultPlayers.push({
          playerId,
          team: newP.team,
          muBefore: newP.muBefore,
          confidenceBefore: newP.confidenceBefore,
          evidenceUnitsBefore,
          effectiveLevel: newP.effectiveLevel,
          k: newP.k,
          opponentFactor: newP.opponentFactor,
          circleFactor: newP.circleFactor,
          deltaRaw: newP.deltaRaw,
          deltaCapped: newP.deltaCapped,
          evidenceQuality: newP.evidenceQuality,
          muAfter: newP.muAfter,
          confidenceAfter: newP.confidenceAfter,
          evidenceUnitsAfter: evidenceUnitsBefore + newP.evidenceQuality,
        });
      }
    });

    return { resultPlayers, levelStateUpdates };
  }

  global.PLMatchLevelEngine = {
    NIVEL_MATCH_WINDOW_DAYS,
    REASON_OUTSIDE_NIVEL_WINDOW,
    isWithinNivelWindow,
    mapLevelStateStatusToEngineState,
    mapEngineStateToLevelStateStatus,
    buildPlayerStatesDict,
    buildUnidentifiedRef,
    sanitizeUnidentifiedPlayers,
    computeOfficializationResult,
    computeLevelStateUpdates,
  };
})(typeof window !== 'undefined' ? window : globalThis);
