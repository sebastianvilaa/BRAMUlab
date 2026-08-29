/* ==========================================================================
   BRAMU Lab — engine.js (v9)
   Motor puro (sin DOM) de:
     - formatos de partido (Clásico / Americano)
     - sistemas de puntuación (Con ventaja / Punto de Oro / Star Point)
     - modos de tie break (Clásico / Muere en 7 / Tie break a 15)
     - reconstrucción de estado a partir de eventos
     - resolución progresiva/retrospectiva del sacador
     - detección de Break Point / Set Point / Match Point
     - validadores de estados reglamentarios (usados por el editor)
   Todo expuesto en window.PLEngine. Nada de esto toca el DOM.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* FORMATOS DE PARTIDO                                                  */
  /* ------------------------------------------------------------------ */
  const FORMATS = {
    classic: {
      id: 'classic',
      label: 'Clásico',
      shortDescription: 'Al mejor de 3 sets',
      bestOfSets: 3,
      setWinTarget: 6,
      tiebreakTriggerAt: 6,
    },
    americano: {
      id: 'americano',
      label: 'Americano',
      shortDescription: '1 set · Tie break en 5–5',
      bestOfSets: 1,
      setWinTarget: 6,
      tiebreakTriggerAt: 5,
    },
  };

  /* ------------------------------------------------------------------ */
  /* MODOS DE TIE BREAK                                                   */
  /* ------------------------------------------------------------------ */
  const TIEBREAK_MODES = {
    classic: { id: 'classic', label: 'Clásico', winTarget: 7, requireDiff2: true },
    death7: { id: 'death7', label: 'Muere en 7', winTarget: 7, requireDiff2: false },
    to15: { id: 'to15', label: 'Tie break a 15', winTarget: 15, requireDiff2: true },
  };

  /** V12 (§10.2): además de los 3 presets por id de string, acepta un config directo
   *  `{winTarget, requireDiff2}` — usado por el Tie break extraordinario cuando el usuario
   *  elige "Otro" con un objetivo personalizado. No se registra como preset nuevo en
   *  TIEBREAK_MODES: es un config ad-hoc, válido solo mientras dure ese Tie break. */
  function tiebreakModeConfig(modeId) {
    if (modeId && typeof modeId === 'object') return modeId;
    return TIEBREAK_MODES[modeId] || TIEBREAK_MODES.classic;
  }

  function tiebreakIsWon(w, l, modeId) {
    const cfg = tiebreakModeConfig(modeId);
    if (!cfg.requireDiff2) return w >= cfg.winTarget;
    return w >= cfg.winTarget && w - l >= 2;
  }

  /** ¿Se puede seguir cambiando la modalidad? Solo mientras nadie llegó a 7 puntos (umbral fijo del reglamento).
   *  @deprecated usar availableTiebreakModes() (V5): esta versión simple solo mira el score actual y no valida
   *  contra el historial real de puntos jugados. Se mantiene por compatibilidad con quien la llamaba directo. */
  function canChangeTiebreakMode(tbA, tbB) { return tbA < 7 && tbB < 7; }

  /**
   * Recorre los eventos y extrae la secuencia punto a punto del Tie break
   * ACTUAL (el que está en curso ahora mismo, si lo hay). Necesaria para
   * validar qué modalidades son compatibles con lo que realmente se jugó.
   * Si el tie break en curso arrancó por un `adjustment` (marcador seteado
   * a mano, sin puntos reales detrás), `sequenceKnown` es false: no podemos
   * reconstruir el orden real de los puntos.
   */
  function extractCurrentTiebreakSequence(events, scoringSystem, format, defaultTiebreakMode, baseline) {
    let state = baseline ? cloneBaselineState(baseline) : createInitialEngineState();
    let seq = [];
    let sequenceKnown = true;
    for (const ev of events) {
      if (ev.type === 'adjustment') {
        state = applyAdjustment(ev.newState);
        seq = [];
        sequenceKnown = !(state.inTiebreak && (state.tbA > 0 || state.tbB > 0));
        continue;
      }
      const before = state;
      const modeForThisPoint = ev.tbMode || defaultTiebreakMode;
      state = applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);
      if (before.inTiebreak) {
        if (state.inTiebreak) {
          seq.push(ev.team);
        } else {
          // Este tie break ya terminó (ya sea que haya arrancado otro más adelante o no): reiniciar.
          seq = [];
          sequenceKnown = true;
        }
      } else if (state.inTiebreak) {
        // Este punto fue el que disparó el tie break (punto de game normal): arranca secuencia vacía.
        seq = [];
        sequenceKnown = true;
      }
    }
    if (!state.inTiebreak) return { inTiebreak: false, sequence: [], sequenceKnown: true };
    return { inTiebreak: true, sequence: seq, sequenceKnown };
  }

  /**
   * Modalidades de Tie break todavía compatibles con el score actual Y con
   * el historial real de puntos jugados en el tie break en curso (V5 — G3/G4).
   * No alcanza con mirar el score actual: hay que validar que, bajo la
   * modalidad candidata, el tie break NO se hubiera dado por terminado en
   * ningún punto anterior de la secuencia real.
   * Si no conocemos la secuencia real (arrancó por un ajuste manual), cae a
   * validar solo contra el score actual.
   */
  function availableTiebreakModes(tbInfo, currentTbA, currentTbB) {
    const allModes = Object.keys(TIEBREAK_MODES);
    if (!tbInfo || !tbInfo.inTiebreak) return allModes;
    if (!tbInfo.sequenceKnown) {
      return allModes.filter((modeId) => !tiebreakIsWon(currentTbA, currentTbB, modeId) && !tiebreakIsWon(currentTbB, currentTbA, modeId));
    }
    return allModes.filter((modeId) => {
      let a = 0, b = 0;
      for (const team of tbInfo.sequence) {
        if (team === 'A') a++; else b++;
        if (tiebreakIsWon(a, b, modeId) || tiebreakIsWon(b, a, modeId)) return false;
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ */
  /* PUNTOS DENTRO DE UN GAME                                             */
  /* ------------------------------------------------------------------ */

  function isGameWon(pointsWinner, pointsLoser, scoringSystem) {
    if (pointsWinner < 4) return false;
    if (scoringSystem === 'golden') return pointsLoser <= 3;
    if (scoringSystem === 'starpoint') {
      if (pointsWinner - pointsLoser >= 2) return true;
      if (pointsWinner === 6 && pointsLoser === 5) return true;
      return false;
    }
    return pointsWinner - pointsLoser >= 2; // con ventaja (deuce infinito)
  }

  /**
   * Única fuente de verdad para el texto de puntos. Devuelve tanto el texto
   * para la ZONA GRANDE (aText/bText) como para el MARCADOR COMPACTO
   * (compactAText/compactBText) — son distintos a propósito: "AD" arriba,
   * "VENTAJA" / "1ª VENTAJA" / "2ª VENTAJA" abajo (grande).
   */
  function formatPointsDisplay(pointsA, pointsB, scoringSystem) {
    const labels = ['0', '15', '30', '40'];
    const bothDeuceZone = pointsA >= 3 && pointsB >= 3;

    if (!bothDeuceZone) {
      const a = labels[Math.min(pointsA, 3)], b = labels[Math.min(pointsB, 3)];
      return {
        aText: a, bText: b, compactAText: a, compactBText: b,
        centralLabel: '', centralTone: 'neutral', isGoldenPoint: false, isStarPoint: false,
      };
    }
    const diff = pointsA - pointsB;
    const level = Math.min(pointsA, pointsB) - 3; // 0 = primer 40-40

    if (scoringSystem === 'golden') {
      return {
        aText: '40', bText: '40', compactAText: '40', compactBText: '40',
        centralLabel: '⚡ PUNTO DE ORO ⚡', centralTone: 'gold', isGoldenPoint: true, isStarPoint: false,
      };
    }
    if (scoringSystem === 'starpoint') {
      if (diff === 0) {
        const label = level === 0 ? 'DEUCE 1' : level === 1 ? 'DEUCE 2' : '⭐ STAR POINT ⭐';
        return {
          aText: '40', bText: '40', compactAText: '40', compactBText: '40',
          centralLabel: label, centralTone: level >= 2 ? 'star' : 'neutral', isGoldenPoint: false, isStarPoint: level >= 2,
        };
      }
      const leaderIsA = diff > 0;
      const ordinal = level === 0 ? '1ª' : '2ª'; // Star Point solo tiene 2 niveles de ventaja antes del punto decisivo
      return {
        aText: leaderIsA ? `${ordinal} VENTAJA` : '40',
        bText: leaderIsA ? '40' : `${ordinal} VENTAJA`,
        compactAText: leaderIsA ? 'AD' : '40',
        compactBText: leaderIsA ? '40' : 'AD',
        centralLabel: '', centralTone: 'neutral', isGoldenPoint: false, isStarPoint: false,
      };
    }
    // classic (con ventaja) — SOLO existen DEUCE y VENTAJA. Nunca "1ª/2ª".
    if (diff === 0) {
      return {
        aText: '40', bText: '40', compactAText: '40', compactBText: '40',
        centralLabel: 'DEUCE', centralTone: 'neutral', isGoldenPoint: false, isStarPoint: false,
      };
    }
    const leaderIsA = diff > 0;
    return {
      aText: leaderIsA ? 'VENTAJA' : '40',
      bText: leaderIsA ? '40' : 'VENTAJA',
      compactAText: leaderIsA ? 'AD' : '40',
      compactBText: leaderIsA ? '40' : 'AD',
      centralLabel: '', centralTone: 'neutral', isGoldenPoint: false, isStarPoint: false,
    };
  }

  /* ------------------------------------------------------------------ */
  /* ESTADO DEL MOTOR                                                     */
  /* ------------------------------------------------------------------ */

  function createInitialEngineState() {
    return {
      sets: [],
      gamesA: 0, gamesB: 0,
      pointsA: 0, pointsB: 0,
      inTiebreak: false,
      tbA: 0, tbB: 0,
      tbBaseGameNumber: 0,
      tbBaseWithinSet: 0,
      gameIndex: 0,
      setsWonA: 0, setsWonB: 0,
      matchWinner: null,
      // V12 (§9-14): Tie break extraordinario en curso, o null si no hay ninguno.
      // { active, startedAtGames:{a,b}, winTarget, requireDiff2 } — `startedAtGames` es el
      // score REAL de games con el que se resuelve el set/partido al cerrar (§13): nunca se
      // fabrican games para llegar a un 6-6/7-6 que no ocurrió.
      extraordinaryTiebreak: null,
    };
  }

  /** ¿Puede arrancar un Tie break extraordinario ahora? Solo con el game actual en 0-0
   *  (§9.3/9.4: nunca a mitad de un game en curso) y el partido todavía sin definir. */
  function canStartExtraordinaryTiebreak(state) {
    return !state.inTiebreak && !state.matchWinner && state.pointsA === 0 && state.pointsB === 0;
  }

  /**
   * V12 (§9-11) — arranca un Tie break extraordinario EN EL LUGAR del game pendiente,
   * preservando el score real de games (nunca lo fabrica hacia 6-6/7-6, §13). No toca
   * `gamesA/gamesB/sets`: el game "vacío" que la UI venía mostrando en 0-0 simplemente
   * nunca llegó a jugarse (§9.4) — no hace falta "cancelarlo" en el estado, porque nunca
   * dejó rastro en él.
   */
  function startExtraordinaryTiebreak(state, winTarget, requireDiff2) {
    if (!canStartExtraordinaryTiebreak(state)) return null;
    const s = JSON.parse(JSON.stringify(state));
    s.inTiebreak = true;
    s.tbA = 0; s.tbB = 0;
    s.tbBaseGameNumber = s.gameIndex + 1;
    s.tbBaseWithinSet = s.gamesA + s.gamesB + 1;
    s.extraordinaryTiebreak = { active: true, startedAtGames: { a: s.gamesA, b: s.gamesB }, winTarget, requireDiff2: !!requireDiff2 };
    return s;
  }

  /**
   * V12 (§12.3) — el objetivo de un Tie break extraordinario puede AUMENTARSE en vivo,
   * nunca bajarse a un valor que implique que el TB ya debería haber terminado
   * retroactivamente. Esta única desigualdad cubre todos los casos del Consolidado (p.ej.
   * 8-4: rechaza bajar a 7) sin necesitar replay del historial — subir siempre es seguro.
   */
  function isValidExtraordinaryTargetChange(currentTbA, currentTbB, newWinTarget) {
    return newWinTarget > Math.max(currentTbA, currentTbB);
  }

  /**
   * Aplica un punto sobre el estado. Devuelve un nuevo estado (no muta).
   * `tiebreakMode` = 'classic' | 'death7' | 'to15' (default 'classic').
   */
  function applyPoint(state, team, scoringSystem, format, tiebreakMode) {
    const mode = tiebreakMode || 'classic';
    const winTarget = format.setWinTarget;
    const tbTrigger = format.tiebreakTriggerAt;
    const s = JSON.parse(JSON.stringify(state));
    if (s.matchWinner) return s;

    if (s.inTiebreak) {
      // V12 (§9-14): un Tie break extraordinario trae su propio objetivo/regla (guardado en
      // el propio estado, no en el `tiebreakMode` externo) — así un cambio de objetivo en
      // vivo (§12) solo necesita mutar `s.extraordinaryTiebreak` vía un `adjustment`, sin
      // tocar nada más: el próximo punto ya lo levanta acá.
      const isExtraordinary = !!(s.extraordinaryTiebreak && s.extraordinaryTiebreak.active);
      const effectiveMode = isExtraordinary
        ? { winTarget: s.extraordinaryTiebreak.winTarget, requireDiff2: s.extraordinaryTiebreak.requireDiff2 }
        : mode;
      if (team === 'A') s.tbA += 1; else s.tbB += 1;
      const w = team === 'A' ? s.tbA : s.tbB;
      const l = team === 'A' ? s.tbB : s.tbA;
      if (tiebreakIsWon(w, l, effectiveMode)) {
        if (isExtraordinary) {
          // V12 (§13): NUNCA fabricar games — el set/partido se cierra con el score real de
          // games que había ANTES del TB extraordinario (ej. 5-5, 4-3), nunca 6-6/7-6.
          s.sets.push({ gamesA: s.extraordinaryTiebreak.startedAtGames.a, gamesB: s.extraordinaryTiebreak.startedAtGames.b, tiebreak: { a: s.tbA, b: s.tbB, mode: effectiveMode }, winner: team, extraordinary: true });
        } else {
          if (team === 'A') s.gamesA += 1; else s.gamesB += 1;
          s.sets.push({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: { a: s.tbA, b: s.tbB, mode }, winner: team });
        }
        if (team === 'A') s.setsWonA += 1; else s.setsWonB += 1;
        s.gamesA = 0; s.gamesB = 0;
        s.inTiebreak = false; s.tbA = 0; s.tbB = 0;
        s.extraordinaryTiebreak = null;
        s.gameIndex += 1;
        if (s.setsWonA >= Math.ceil(format.bestOfSets / 2) || s.setsWonB >= Math.ceil(format.bestOfSets / 2)) {
          s.matchWinner = s.setsWonA > s.setsWonB ? 'A' : 'B';
        }
      }
      return s;
    }

    if (team === 'A') s.pointsA += 1; else s.pointsB += 1;
    const pw = team === 'A' ? s.pointsA : s.pointsB;
    const pl = team === 'A' ? s.pointsB : s.pointsA;

    if (isGameWon(pw, pl, scoringSystem)) {
      if (team === 'A') s.gamesA += 1; else s.gamesB += 1;
      s.pointsA = 0; s.pointsB = 0;
      s.gameIndex += 1;

      const gw = team === 'A' ? s.gamesA : s.gamesB;
      const gl = team === 'A' ? s.gamesB : s.gamesA;

      if (s.gamesA === tbTrigger && s.gamesB === tbTrigger) {
        s.inTiebreak = true; s.tbA = 0; s.tbB = 0;
        s.tbBaseGameNumber = s.gameIndex + 1;
        s.tbBaseWithinSet = s.gamesA + s.gamesB + 1;
      } else if (gw >= winTarget && gw - gl >= 2) {
        s.sets.push({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: null, winner: team });
        if (team === 'A') s.setsWonA += 1; else s.setsWonB += 1;
        s.gamesA = 0; s.gamesB = 0;
        if (s.setsWonA >= Math.ceil(format.bestOfSets / 2) || s.setsWonB >= Math.ceil(format.bestOfSets / 2)) {
          s.matchWinner = s.setsWonA > s.setsWonB ? 'A' : 'B';
        }
      }
    }
    return s;
  }

  /**
   * Reconstruye el estado a partir de una secuencia de eventos que puede
   * contener DOS tipos:
   *   - punto normal: { team, matchTimeMs, tbMode? }
   *   - ajuste de marcador: { type:'adjustment', newState:{...} }
   *     (ver applyAdjustment). Un ajuste NUNCA se interpreta como puntos
   *     jugados: simplemente reemplaza el estado deportivo por el nuevo,
   *     preservando en el array de eventos todo lo que pasó ANTES del
   *     ajuste (para estadísticas honestas — nunca se borra el historial
   *     real por corregir el marcador).
   */
  function computeStateFromEvents(events, scoringSystem, format, defaultTiebreakMode, baseline) {
    let state = baseline ? cloneBaselineState(baseline) : createInitialEngineState();
    for (const ev of events) {
      if (ev.type === 'adjustment') {
        state = applyAdjustment(ev.newState);
        continue;
      }
      // Cada punto de tie break lleva grabado el modo vigente EN ESE MOMENTO
      // (ev.tbMode). Nunca se reinterpreta un tie break pasado con el modo
      // actual: eso fue el bug de la revisión anterior.
      const modeForThisPoint = ev.tbMode || defaultTiebreakMode;
      state = applyPoint(state, ev.team, scoringSystem, format, modeForThisPoint);
    }
    return state;
  }

  function cloneBaselineState(baseline) {
    const base = createInitialEngineState();
    return Object.assign(base, JSON.parse(JSON.stringify(baseline)));
  }

  /** Un ajuste de marcador reemplaza el estado deportivo completo (mismo formato que un baseline). */
  function applyAdjustment(newState) { return cloneBaselineState(newState); }

  /**
   * Deriva el gameIndex (games completados en TODO el partido) a partir de
   * sets ya cerrados + games ya jugados en el set actual. NUNCA usar
   * aproximaciones como `sets.length * 2`: cada set puede tener una cantidad
   * distinta de games (6-0 no es lo mismo que 7-6).
   */
  function computeGameIndexFromParts(completedSets, currentGamesA, currentGamesB) {
    const fromCompleted = completedSets.reduce((acc, s) => acc + s.gamesA + s.gamesB, 0);
    return fromCompleted + (currentGamesA || 0) + (currentGamesB || 0);
  }

  function currentWithinSetGameNumber(state) {
    return state.inTiebreak ? state.tbBaseWithinSet : (state.gamesA + state.gamesB + 1);
  }
  function currentMatchGameNumber(state) {
    return state.inTiebreak ? state.tbBaseGameNumber : (state.gameIndex + 1);
  }

  /* ------------------------------------------------------------------ */
  /* BREAK POINT / SET POINT / MATCH POINT                               */
  /* ------------------------------------------------------------------ */

  /**
   * Detecta, para el estado ANTES de jugar el próximo punto, si ese punto
   * puede ser decisivo para cada equipo. Usa simulación real del motor
   * (aplica el punto hipotéticamente) en vez de umbrales hardcodeados, así
   * funciona igual para cualquier formato/modo de tie break sin duplicar
   * reglas.
   * Devuelve: { break: 'A'|'B'|'both'|null, set: ..., match: ... }
   * servingTeam puede ser null si el sacador no se conoce (en ese caso no
   * se puede determinar Break Point, pero sí Set Point / Match Point).
   */
  function detectPointImportance(state, scoringSystem, format, tiebreakMode, servingTeam) {
    const result = { break: null, set: null, match: null };
    if (state.matchWinner) return result;

    ['A', 'B'].forEach((team) => {
      const hypo = applyPoint(state, team, scoringSystem, format, tiebreakMode);
      const wonSet = hypo.sets.length > state.sets.length;
      const wonMatch = hypo.matchWinner === team;
      const wonNormalGame = !state.inTiebreak && hypo.gameIndex > state.gameIndex;

      if (wonMatch) result.match = result.match && result.match !== team ? 'both' : team;
      if (wonSet) result.set = result.set && result.set !== team ? 'both' : team;
      if (!state.inTiebreak && wonNormalGame && servingTeam && team !== servingTeam) {
        result.break = result.break && result.break !== team ? 'both' : team;
      }
    });
    return result;
  }

  /** Prioridad de comunicación: Match Point > Set Point > Break Point. */
  function primaryPointImportance(importance) {
    if (importance.match) return { kind: 'match', team: importance.match };
    if (importance.set) return { kind: 'set', team: importance.set };
    if (importance.break) return { kind: 'break', team: importance.break };
    return null;
  }

  /**
   * FUENTE ÚNICA DE VERDAD para la franja contextual de la pantalla de partido.
   * Todo lo que la UI necesita mostrar (franja + selector de tie break) sale
   * de un solo objeto calculado en un solo lugar, para que sea IMPOSIBLE
   * mezclar estados (ej: "TIE BREAK" en un game normal, "2ª VENTAJA" jugando
   * Punto de Oro, o un Break Point mostrado encima de un Punto de Oro).
   *
   * Devuelve:
   * {
   *   showBanner, primaryLabel, primaryTone ('neutral'|'gold'|'star'|'tiebreak'),
   *   secondaryKind ('break'|'set'|'match'|null), secondaryTeam ('A'|'B'|'both'|null),
   *   showTiebreakSelector, tiebreakSelectorDisabled,
   *   isGoldenPoint, isStarPoint, disp (el resultado de formatPointsDisplay)
   * }
   */
  function getLiveContext(state, scoringSystem, format, tiebreakMode, servingTeam, availableTbModes) {
    const disp = state.inTiebreak
      ? { aText: String(state.tbA), bText: String(state.tbB), compactAText: String(state.tbA), compactBText: String(state.tbB), centralLabel: 'TIE BREAK', centralTone: 'tiebreak', isGoldenPoint: false, isStarPoint: false }
      : formatPointsDisplay(state.pointsA, state.pointsB, scoringSystem);

    const importance = detectPointImportance(state, scoringSystem, format, tiebreakMode, servingTeam);
    let primary = primaryPointImportance(importance);

    // Durante Punto de Oro / Star Point, un Break Point es información obvia y
    // redundante (el punto YA es decisivo): se registra igual internamente en
    // `importance`, pero no se comunica una segunda vez en la franja.
    if (primary && primary.kind === 'break' && (disp.isGoldenPoint || disp.isStarPoint)) {
      primary = null;
    }

    /* ------------------------------------------------------------------
       V5 — MODELO DE BANDA ÚNICO (Bloques C/D/E/F).
       En vez de "texto central + pastilla secundaria", la franja entera
       comunica UN estado con jerarquía clara:
         - bandKind: identifica la variante visual (color/intensidad/animación)
         - bandLabel: el/los textos a mostrar, ya combinados si corresponde
         - bandTeam: 'A'|'B'|'both'|null — a qué equipo pertenece el color
           (null = tono neutro/temático, no de equipo: DEUCE, TIE BREAK solo)
       Reglas de combinación (D1-D8, F3, G6):
         - Punto de Oro / Star Point solos → banda dorada temática.
         - + Set Point / Match Point → banda dorada + segmento de color del
           equipo integrado (nunca una pastillita aparte).
         - + Break Point → se ignora visualmente (ya contabilizado arriba).
         - Break/Set/Match Point solos (sin oro/star) → banda completa del
           color del equipo, con jerarquía de intensidad creciente.
         - Tie break solo → banda temática neutra con selector de modo.
         - Tie break + Set/Match Point → banda combinada igual que oro/star.
       ------------------------------------------------------------------ */
    let bandKind = 'none';
    let bandLabel = '';
    let bandTeam = null;

    if (disp.isGoldenPoint) {
      if (primary && primary.kind === 'match') { bandKind = 'gold-match'; bandLabel = 'PUNTO DE ORO | MATCH POINT'; bandTeam = primary.team; }
      else if (primary && primary.kind === 'set') { bandKind = 'gold-set'; bandLabel = 'PUNTO DE ORO | SET POINT'; bandTeam = primary.team; }
      else { bandKind = 'gold'; bandLabel = 'PUNTO DE ORO'; }
    } else if (disp.isStarPoint) {
      if (primary && primary.kind === 'match') { bandKind = 'star-match'; bandLabel = 'STAR POINT | MATCH POINT'; bandTeam = primary.team; }
      else if (primary && primary.kind === 'set') { bandKind = 'star-set'; bandLabel = 'STAR POINT | SET POINT'; bandTeam = primary.team; }
      else { bandKind = 'star'; bandLabel = 'STAR POINT'; }
    } else if (state.inTiebreak) {
      if (primary && primary.kind === 'match') { bandKind = 'tiebreak-match'; bandLabel = 'TIE BREAK | MATCH POINT'; bandTeam = primary.team; }
      else if (primary && primary.kind === 'set') { bandKind = 'tiebreak-set'; bandLabel = 'TIE BREAK | SET POINT'; bandTeam = primary.team; }
      else { bandKind = 'tiebreak'; bandLabel = 'TIE BREAK'; }
    } else if (disp.centralLabel && disp.centralTone === 'neutral') {
      // Cubre 'DEUCE' (Con ventaja) y 'DEUCE 1'/'DEUCE 2' (Star Point) — V6 fix:
      // antes solo se reconocía el string exacto 'DEUCE', así que en Star Point el
      // segundo deuce (después de perderse la 1ª ventaja) no mostraba nada en la
      // franja (quedaba en blanco aunque el marcador seguía siendo 40-40 por dentro).
      bandKind = 'neutral'; bandLabel = disp.centralLabel;
    } else if (primary) {
      bandKind = primary.kind; // 'break' | 'set' | 'match'
      bandLabel = primary.kind === 'match' ? 'MATCH POINT' : primary.kind === 'set' ? 'SET POINT' : 'BREAK POINT';
      bandTeam = primary.team;
    }

    const showBanner = bandKind !== 'none';
    const tbModes = state.inTiebreak ? (availableTbModes || Object.keys(TIEBREAK_MODES)) : [];

    return {
      showBanner,
      bandKind,
      bandLabel,
      bandTeam,
      // Campos legacy (se mantienen por compatibilidad, ya no los usa la UI de franja):
      primaryLabel: bandLabel,
      primaryTone: bandKind,
      secondaryKind: primary ? primary.kind : null,
      secondaryTeam: primary ? primary.team : null,
      // V5: el selector de modalidad de TB solo se muestra como <select> cuando hay
      // 2+ opciones todavía válidas contra el historial real. Con una sola opción
      // válida se debe mostrar como texto simple (sin caja/flecha) — ver UI.
      showTiebreakSelector: state.inTiebreak,
      tiebreakAvailableModes: tbModes,
      tiebreakSelectorDisabled: state.inTiebreak && tbModes.length <= 1,
      isGoldenPoint: disp.isGoldenPoint,
      isStarPoint: disp.isStarPoint,
      disp,
      importance,
    };
  }

  /* ------------------------------------------------------------------ */
  /* VALIDADORES DE ESTADOS REGLAMENTARIOS (para el editor)               */
  /* ------------------------------------------------------------------ */

  /** ¿Es un resultado de set FINALIZADO válido para este formato? (p.ej. 6-4, 7-5, 7-6; NO 9-6, NO 6-6). */
  function isValidCompletedSetScore(gamesA, gamesB, format) {
    const hi = Math.max(gamesA, gamesB), lo = Math.min(gamesA, gamesB);
    const target = format.setWinTarget;
    const tbAt = format.tiebreakTriggerAt;
    if (hi === target && lo <= target - 2) return true; // gana sin llegar al punto de disparo del TB (6-0..6-4)
    if (hi === tbAt + 1 && lo === tbAt) return true; // termina por tie break (7-6 clásico, 6-5 americano)
    if (tbAt === target && hi === target + 1 && lo === target - 1) return true; // extensión natural sin TB (7-5, solo si tbAt=target)
    return false;
  }

  /** ¿Ese resultado de set finalizado terminó por tie break? */
  function completedSetHasTiebreak(gamesA, gamesB, format) {
    const hi = Math.max(gamesA, gamesB), lo = Math.min(gamesA, gamesB);
    return hi === format.tiebreakTriggerAt + 1 && lo === format.tiebreakTriggerAt;
  }

  /** ¿Es un score de set EN CURSO (todavía no terminado) válido para este formato? */
  function isValidInProgressSetScore(gamesA, gamesB, format) {
    if (gamesA < 0 || gamesB < 0) return false;
    if (isValidCompletedSetScore(gamesA, gamesB, format)) return false;
    const hi = Math.max(gamesA, gamesB), lo = Math.min(gamesA, gamesB);
    const target = format.setWinTarget;
    if (hi > target + 1) return false;
    if (hi === target + 1 && lo < target - 1) return false;
    return true;
  }

  /** ¿Este score de set en curso corresponde a un tie break en marcha? */
  function isCurrentlyTiebreakScore(gamesA, gamesB, format) {
    return gamesA === format.tiebreakTriggerAt && gamesB === format.tiebreakTriggerAt;
  }

  /** ¿Es un score de tie break válido (en curso o recién terminado) para el modo elegido? */
  function isValidTiebreakScore(tbA, tbB, modeId) {
    if (tbA < 0 || tbB < 0) return false;
    // ¿Es exactamente el punto en el que ALGUIEN acaba de ganar? (el punto anterior todavía no era victoria)
    const aJustWon = tiebreakIsWon(tbA, tbB, modeId) && !tiebreakIsWon(tbA - 1, tbB, modeId);
    const bJustWon = tiebreakIsWon(tbB, tbA, modeId) && !tiebreakIsWon(tbB - 1, tbA, modeId);
    if (aJustWon || bJustWon) return true;
    // Si ya se había ganado ANTES de llegar a este score, es un score imposible (ej: 18-3 en clásico).
    if (tiebreakIsWon(tbA, tbB, modeId) || tiebreakIsWon(tbB, tbA, modeId)) return false;
    return true; // todavía en curso, nadie ganó
  }

  /**
   * Enumera los estados de punto válidos para un sistema de puntuación,
   * en términos de (pointsA, pointsB) internos + una etiqueta humana.
   * No incluye niveles de deuce/ventaja más allá del primero o segundo
   * (limitación documentada: para deuces más profundos conviene dejar
   * avanzar el partido en vivo en vez de editarlo a mano).
   */
  function enumerateValidGameStates(scoringSystem) {
    const labels = ['0', '15', '30', '40'];
    const states = [];
    for (let a = 0; a <= 3; a++) {
      for (let b = 0; b <= 3; b++) {
        if (a === 3 && b === 3) continue;
        states.push({ pointsA: a, pointsB: b, label: `${labels[a]}-${labels[b]}` });
      }
    }
    if (scoringSystem === 'golden') {
      states.push({ pointsA: 3, pointsB: 3, label: '40-40 (Punto de Oro)' });
    } else if (scoringSystem === 'starpoint') {
      states.push({ pointsA: 3, pointsB: 3, label: 'Deuce 1' });
      states.push({ pointsA: 4, pointsB: 3, label: '1ª ventaja Equipo A' });
      states.push({ pointsA: 3, pointsB: 4, label: '1ª ventaja Equipo B' });
      states.push({ pointsA: 4, pointsB: 4, label: 'Deuce 2' });
      states.push({ pointsA: 5, pointsB: 4, label: '2ª ventaja Equipo A' });
      states.push({ pointsA: 4, pointsB: 5, label: '2ª ventaja Equipo B' });
      states.push({ pointsA: 5, pointsB: 5, label: 'Star Point' });
    } else {
      states.push({ pointsA: 3, pointsB: 3, label: 'Deuce' });
      states.push({ pointsA: 4, pointsB: 3, label: 'Ventaja Equipo A' });
      states.push({ pointsA: 3, pointsB: 4, label: 'Ventaja Equipo B' });
    }
    return states;
  }

  /* ------------------------------------------------------------------ */
  /* RESOLUCIÓN DE SAQUE (progresiva + retrospectiva)                    */
  /* ------------------------------------------------------------------ */

  function createServerKnowledge() { return { parity: null, perSet: {} }; }
  function otherTeam(team) { return team === 'A' ? 'B' : 'A'; }

  function recordServerAnswer(knowledge, players, setNumber, matchGameNumber, withinSetGameNumber, playerId) {
    const k = JSON.parse(JSON.stringify(knowledge));
    const player = players.find((p) => p.id === playerId);
    if (!player) return k;
    const team = player.team;
    if (!k.parity) {
      const isOddGlobal = matchGameNumber % 2 === 1;
      k.parity = { oddTeam: isOddGlobal ? team : otherTeam(team) };
    }
    const setEntry = k.perSet[setNumber] || { orderA: null, orderB: null };
    const partner = players.find((p) => p.team === team && p.id !== playerId);
    const turn = Math.ceil(withinSetGameNumber / 2);
    const order = (turn % 2 === 1) ? [playerId, partner.id] : [partner.id, playerId];
    if (team === 'A') setEntry.orderA = order; else setEntry.orderB = order;
    k.perSet[setNumber] = setEntry;
    return k;
  }

  function resolveServerCore(knowledge, players, setNumber, matchGameNumber, withinSetGameNumber) {
    if (!knowledge.parity) return { resolved: false, candidateTeam: null, candidatePlayers: players };
    const isOddGlobal = matchGameNumber % 2 === 1;
    const team = isOddGlobal ? knowledge.parity.oddTeam : otherTeam(knowledge.parity.oddTeam);
    const setEntry = knowledge.perSet[setNumber];
    const order = setEntry ? (team === 'A' ? setEntry.orderA : setEntry.orderB) : null;
    if (!order) return { resolved: false, candidateTeam: team, candidatePlayers: players.filter((p) => p.team === team) };
    const turn = Math.ceil(withinSetGameNumber / 2);
    const idx = (turn % 2 === 1) ? 0 : 1;
    return { resolved: true, team, playerId: order[idx] };
  }

  /**
   * V12 (§5.3) — corrige el sacador de un game YA EN CURSO ("se seleccionó por error al
   * jugador que estaba sacando") sin tocar la resolución de games anteriores. Reusar
   * `recordServerAnswer` a secas no alcanza: esa función recalcula `orderA/orderB` con una
   * fórmula pareja para TODO el set (pasado y futuro), así que corregir el game actual
   * contaminaría también los games anteriores del mismo set.
   *
   * Estrategia — snapshot congelado: la PRIMERA vez que se corrige dentro de un set, se
   * guarda una foto de cómo se resolvía todo ANTES de esta corrección
   * (`perSet[setNumber].frozenBefore`). A partir de ahí, `resolveServer` (el dispatcher de
   * abajo) resuelve cualquier game ANTERIOR al de la corrección contra esa foto congelada —
   * nunca contra la fórmula recién actualizada — mientras que el game corregido en adelante
   * usa el order nuevo. Alcance deliberado: cubre "jugador equivocado, mismo equipo" (el caso
   * real de 5.1); una corrección de equipo más profunda sigue derivándose a EDITAR (5.3).
   */
  function recordServerCorrection(knowledge, players, setNumber, matchGameNumber, withinSetGameNumber, playerId) {
    const k = JSON.parse(JSON.stringify(knowledge));
    const setEntry = k.perSet[setNumber] || { orderA: null, orderB: null };
    if (!setEntry.frozenBefore) {
      setEntry.frozenBefore = {
        matchGameNumber,
        orderA: setEntry.orderA,
        orderB: setEntry.orderB,
        parityOddTeam: k.parity ? k.parity.oddTeam : null,
      };
      k.perSet[setNumber] = setEntry;
    }
    // Sobreescribe la paridad global, anclada a ESTA corrección: el jugador elegido pasa a
    // determinar qué equipo saca en `matchGameNumber` (y, por la fórmula de paridad, en
    // todos los games futuros a partir de acá). Hace falta para el caso más exigente — "¿Quién
    // comienza sacando?" al arrancar un Tie break extraordinario (V12 §11) — donde el
    // jugador elegido puede ser de CUALQUIER equipo, sin relación con la rotación previa; sin
    // este paso, `recordServerAnswer` (que solo fija la paridad la primera vez) escribiría en
    // el "casillero" de equipo equivocado y la corrección nunca se resolvería. Es seguro
    // sobreescribir la paridad global acá porque los games ANTERIORES ya quedaron protegidos
    // por el snapshot congelado de arriba (`resolveServer` los resuelve contra esa foto, no
    // contra esta paridad nueva).
    const player = players.find((p) => p.id === playerId);
    if (player) {
      const isOddGlobal = matchGameNumber % 2 === 1;
      k.parity = { oddTeam: isOddGlobal ? player.team : otherTeam(player.team) };
    }
    return recordServerAnswer(k, players, setNumber, matchGameNumber, withinSetGameNumber, playerId);
  }

  /** Dispatcher: si este set tiene una corrección congelada Y el game consultado es
   *  ANTERIOR al game donde se hizo la corrección, resuelve contra la foto congelada
   *  (nunca contra la fórmula ya corregida). Si no, cae en el comportamiento de siempre —
   *  así que un partido sin ninguna corrección de sacador se comporta EXACTAMENTE igual
   *  que antes de V12 (cero riesgo de regresión para el caso común). */
  function resolveServer(knowledge, players, setNumber, matchGameNumber, withinSetGameNumber) {
    const setEntry = knowledge.perSet ? knowledge.perSet[setNumber] : null;
    const frozen = setEntry && setEntry.frozenBefore;
    if (frozen && matchGameNumber < frozen.matchGameNumber) {
      const frozenKnowledge = {
        parity: frozen.parityOddTeam ? { oddTeam: frozen.parityOddTeam } : null,
        perSet: { [setNumber]: { orderA: frozen.orderA, orderB: frozen.orderB } },
      };
      return resolveServerCore(frozenKnowledge, players, setNumber, matchGameNumber, withinSetGameNumber);
    }
    return resolveServerCore(knowledge, players, setNumber, matchGameNumber, withinSetGameNumber);
  }

  function resolveTiebreakServer(knowledge, players, setNumber, tbBaseGameNumber, tbBaseWithinSet, pointIndexInBreak) {
    let slot;
    if (pointIndexInBreak === 0) slot = 0;
    else { const turn = Math.floor((pointIndexInBreak - 1) / 2) + 1; slot = turn % 4; }
    return resolveServer(knowledge, players, setNumber, tbBaseGameNumber + slot, tbBaseWithinSet + slot);
  }

  /* ------------------------------------------------------------------ */
  /* EXPORT                                                               */
  /* ------------------------------------------------------------------ */

  global.PLEngine = {
    FORMATS,
    TIEBREAK_MODES,
    tiebreakModeConfig,
    tiebreakIsWon,
    canChangeTiebreakMode,
    extractCurrentTiebreakSequence,
    availableTiebreakModes,
    isGameWon,
    formatPointsDisplay,
    createInitialEngineState,
    canStartExtraordinaryTiebreak,
    startExtraordinaryTiebreak,
    isValidExtraordinaryTargetChange,
    applyPoint,
    computeStateFromEvents,
    applyAdjustment,
    computeGameIndexFromParts,
    currentWithinSetGameNumber,
    currentMatchGameNumber,
    detectPointImportance,
    primaryPointImportance,
    getLiveContext,
    isValidCompletedSetScore,
    completedSetHasTiebreak,
    isValidInProgressSetScore,
    isCurrentlyTiebreakScore,
    isValidTiebreakScore,
    enumerateValidGameStates,
    createServerKnowledge,
    recordServerAnswer,
    recordServerCorrection,
    resolveServer,
    resolveTiebreakServer,
    otherTeam,
  };
})(typeof window !== 'undefined' ? window : globalThis);
