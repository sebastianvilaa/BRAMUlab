/* ==========================================================================
   BRAMU Lab — match-load.js (Etapa 3, Fase 3)
   Funciones puras de la pantalla "Cargar partido jugado": selector de
   jugadores (recientes/búsqueda/duplicados), teclado numérico del resultado,
   visibilidad del tercer set, validación central del marcador y el impacto
   de cambiar de formato sobre un resultado ya cargado. Sin DOM, sin estado
   propio — igual que engine.js/stats.js/player-home.js, app.js hace toda la
   orquestación de pantalla sobre lo que estas funciones devuelven.
   ========================================================================== */
(function (global) {
  'use strict';

  const Store = global.PLStore;
  const Engine = global.PLEngine;
  const PH = global.PLPlayerHome;

  /* ------------------------------------------------------------------ */
  /* JUGADORES                                                            */
  /* ------------------------------------------------------------------ */

  /** Jugadores con los que `playerName` ya compartió cancha (compañeros y rivales, mezclados),
   *  del más reciente al más antiguo por fecha REAL jugada (vía PH.filterMatchesForPlayer,
   *  que ya usa PH.getPlayedAt — nunca se repite esa cadena de fallback acá). Sin duplicados
   *  (comparación normalizada) y sin nadie de `excludeNames` (tampoco el propio `playerName`,
   *  se agrega solo por si el caller no lo incluyó). */
  function computeRecentPlayers(history, playerName, excludeNames) {
    const excluded = new Set(
      (excludeNames || []).concat(playerName || '').map((n) => Store.normalizePlayerName(n)).filter(Boolean)
    );
    const matches = PH.filterMatchesForPlayer(history, playerName);
    const seen = new Set();
    const result = [];
    matches.forEach((m) => {
      (m.players || []).forEach((p) => {
        if (!p || !p.name) return;
        const norm = Store.normalizePlayerName(p.name);
        if (!norm || excluded.has(norm) || seen.has(norm)) return;
        seen.add(norm);
        result.push(p.name);
      });
    });
    return result;
  }

  /** Todos los nombres conocidos localmente: los recordados (Store.loadPlayerNames) más
   *  cualquiera que haya aparecido alguna vez en el historial — unión sin duplicados. Es el
   *  universo completo sobre el que el buscador del selector filtra. */
  function computeAllKnownPlayers(history, playerNames) {
    const fromHistory = (history || []).reduce(
      (acc, m) => acc.concat((m.players || []).map((p) => p && p.name)), []
    );
    const seen = new Set();
    const result = [];
    (playerNames || []).concat(fromHistory).forEach((n) => {
      if (!n) return;
      const norm = Store.normalizePlayerName(n);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      result.push(n);
    });
    return result;
  }

  /** Filtra `pool` (nombres) por `query` (substring normalizado, insensible a mayúsculas y
   *  espacios repetidos) y excluye `excludeNames` — el propio jugador actual y quien ya esté
   *  elegido en otro lugar nunca deben aparecer como sugerencia. */
  function filterPlayerCandidates(pool, query, excludeNames) {
    const excluded = new Set((excludeNames || []).map((n) => Store.normalizePlayerName(n)).filter(Boolean));
    const q = Store.normalizePlayerName(query || '').toLocaleLowerCase('es');
    const seen = new Set();
    const result = [];
    (pool || []).forEach((n) => {
      if (!n) return;
      const norm = Store.normalizePlayerName(n);
      if (!norm || excluded.has(norm) || seen.has(norm)) return;
      if (q && !norm.toLocaleLowerCase('es').includes(q)) return;
      seen.add(norm);
      result.push(n);
    });
    return result;
  }

  /** ¿`name` ya está entre `existingNames`? Comparación siempre normalizada — "Matu", "matu "
   *  y "MATU" son el mismo jugador, nunca tres distintos (§7 del consolidado). */
  function isDuplicatePlayerName(name, existingNames) {
    const norm = Store.normalizePlayerName(name);
    if (!norm) return false;
    return (existingNames || []).some((n) => Store.normalizePlayerName(n) === norm);
  }

  /* ------------------------------------------------------------------ */
  /* RESULTADO / TECLADO NUMÉRICO                                         */
  /* ------------------------------------------------------------------ */

  /** Hotfix v2.2.1 (§7.2) — dado lo ya tecleado para el lado activo (`digitsStr`) y, si ya se
   *  conoce, el valor YA CONFIRMADO del lado opuesto (`otherValue`, `undefined`/`NaN` si ese
   *  lado todavía no tiene un valor), ¿qué dígitos 0-9 son legítimos para continuar? Un dígito
   *  es legítimo si, agregado a `digitsStr` (con o sin más dígitos después), el número
   *  resultante todavía podría cerrar un set COMPLETO y válido para `format` — emparejado con
   *  `otherValue` si ya existe, o con cualquier valor plausible del otro lado si todavía no.
   *  Única fuente de verdad: Engine.isValidCompletedSetScore, la misma que ya usa el resto de
   *  la carga manual — nunca una lista de pares hardcodeada. Recursiva pero acotada: cada
   *  candidato que ya supera `maxPossible` corta esa rama sin seguir explorando (con los
   *  formatos actuales, de un solo dígito, nunca profundiza más de un nivel; si algún formato
   *  futuro aceptara un set de 2+ dígitos, sigue siendo correcta sin tocarla). */
  function computeValidNextDigits(digitsStr, format, otherValue) {
    const target = format.setWinTarget;
    const tbAt = format.tiebreakTriggerAt;
    const maxPossible = Math.max(target + 1, tbAt + 1);
    const hasOther = Number.isFinite(otherValue);
    const isPlausibleCandidate = (candidate) => {
      if (hasOther) return Engine.isValidCompletedSetScore(candidate, otherValue, format);
      for (let opp = 0; opp <= maxPossible; opp++) {
        if (Engine.isValidCompletedSetScore(candidate, opp, format)) return true;
      }
      return false;
    };
    const prefixHasReachableCandidate = (prefixStr) => {
      if (prefixStr.length > 1 && prefixStr.charAt(0) === '0') return false; // sin ceros a la izquierda
      const base = Number(prefixStr);
      if (!Number.isFinite(base) || base > maxPossible) return false;
      if (isPlausibleCandidate(base)) return true;
      for (let d = 0; d <= 9; d++) {
        if (prefixHasReachableCandidate(prefixStr + String(d))) return true;
      }
      return false;
    };
    const digits = [];
    for (let d = 0; d <= 9; d++) {
      if (prefixHasReachableCandidate(digitsStr + String(d))) digits.push(String(d));
    }
    return digits;
  }

  /** ¿Tecleando un dígito más después de `digitsStr` todavía podría llegar a formar un score
   *  de set COMPLETO válido para `format`, emparejado con `otherValue` si ya se conoce el lado
   *  opuesto? Envoltorio booleano de `computeValidNextDigits` — con los formatos actuales
   *  (máximo 7 games) el resultado es siempre `false` después del primer dígito, el teclado
   *  avanza solo, como pide §8. */
  function canExtendSetDigits(digitsStr, format, otherValue) {
    if (!digitsStr) return true;
    return computeValidNextDigits(digitsStr, format, otherValue).length > 0;
  }

  /** ¿El partido ya quedó decidido con estos sets ({a,b}, en orden, `null` = todavía sin
   *  cargar)? Cuenta solo sets completos y numéricos — nunca asume que un set a medio cargar
   *  ya está definido. */
  function isMatchDecided(sets, format) {
    const need = Math.ceil(format.bestOfSets / 2);
    const complete = (sets || []).filter((s) => s && Number.isFinite(s.a) && Number.isFinite(s.b));
    const wonA = complete.filter((s) => s.a > s.b).length;
    const wonB = complete.filter((s) => s.b > s.a).length;
    return wonA >= need || wonB >= need;
  }

  /** §9: el Set 3 se muestra únicamente cuando Set 1 y Set 2 son ambos resultados COMPLETOS y
   *  VÁLIDOS para `format`, y entre los dos dejan el partido 1-1. Cualquier otra combinación
   *  (todavía incompletos, o ya decidido 2-0) lo mantiene oculto — nunca se pregunta un tercer
   *  set que no corresponde. */
  function isThirdSetVisible(set1, set2, format) {
    if (format.bestOfSets === 1) return false;
    if (!set1 || !set2) return false;
    if (!Number.isFinite(set1.a) || !Number.isFinite(set1.b) || !Number.isFinite(set2.a) || !Number.isFinite(set2.b)) return false;
    if (!Engine.isValidCompletedSetScore(set1.a, set1.b, format)) return false;
    if (!Engine.isValidCompletedSetScore(set2.a, set2.b, format)) return false;
    return !isMatchDecided([set1, set2], format);
  }

  /** Etapa 4.2 (§6.2/§6.3) — cuál es el set "actual" a editar: el primero, en orden, que
   *  todavía no sea un resultado completo y válido para `format`. `null` cuando los sets
   *  necesarios ya están todos cargados y son válidos — es decir, el partido quedó decidido y
   *  no hay ningún set más que pedir. Recorre solo los slots que corresponden según
   *  `isThirdSetVisible` (nunca pide un Set 3 que no corresponde). Única fuente para decidir
   *  qué se muestra grande (el set en edición) y qué pasa al marcador acumulado (los
   *  anteriores) — app.js no debe recalcular este criterio por su cuenta. */
  function resolveActiveSetIndex(sets, format) {
    const thirdVisible = isThirdSetVisible(sets && sets[0], sets && sets[1], format);
    const neededSlots = format.bestOfSets === 1 ? 1 : (thirdVisible ? 3 : 2);
    for (let i = 0; i < neededSlots; i++) {
      const s = sets && sets[i];
      if (!s || !Number.isFinite(s.a) || !Number.isFinite(s.b) || !Engine.isValidCompletedSetScore(s.a, s.b, format)) return i;
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* VALIDACIÓN CENTRAL                                                   */
  /* ------------------------------------------------------------------ */

  /** Validador puro central de "Cargar partido jugado" (§10 del consolidado: aislado en
   *  funciones puras y testeables, nunca distribuido por eventos DOM). Recibe los 4 nombres ya
   *  resueltos, hasta 3 sets en bruto (`{a,b}|null`, en el orden en que se muestran en
   *  pantalla), el formato elegido y la fecha (string, puede venir vacía). Devuelve SIEMPRE
   *  una razón específica en vez de un booleano solo — el mensaje visible se arma en app.js a
   *  partir de `reason`, nunca un "Hay un error" genérico. `ok:true` incluye `sets[]` con la
   *  MISMA forma que usa el motor (`gamesA/gamesB/tiebreak/winner`, sin `setNumber`) y
   *  `winnerTeam`, listos para pasar a finishMatchManual sin transformación adicional. */
  function validateMatchDraft(names, rawSets, formatId, dateVal) {
    const format = Engine.FORMATS[formatId] || Engine.FORMATS.classic;
    const [a1, a2, b1, b2] = names || [];
    if (!a1 || !a2 || !b1 || !b2) return { ok: false, reason: 'players-missing' };
    const allNames = [a1, a2, b1, b2];
    for (let i = 0; i < allNames.length; i++) {
      for (let j = i + 1; j < allNames.length; j++) {
        if (Store.normalizePlayerName(allNames[i]) === Store.normalizePlayerName(allNames[j])) {
          return { ok: false, reason: 'players-duplicate' };
        }
      }
    }
    if (!dateVal) return { ok: false, reason: 'date-missing' };

    const set1 = rawSets[0] || null;
    const set2 = format.bestOfSets === 1 ? null : (rawSets[1] || null);
    const thirdVisible = isThirdSetVisible(set1, set2, format);
    const neededSlots = format.bestOfSets === 1 ? 1 : (thirdVisible ? 3 : 2);
    const activeSets = (rawSets || []).slice(0, neededSlots);
    // `neededSlots` solo llega a 3 cuando Set 1 y Set 2 YA son ambos completos, válidos y
    // dejaron el partido 1-1 (ver isThirdSetVisible) — si en ese caso el Set 3 todavía está
    // vacío, el problema puntual es "falta definir el tercer set", una razón más específica
    // que el genérico "falta completar un set" que cubre el resto de los casos (§10).
    if (neededSlots === 3) {
      const set3 = activeSets[2];
      if (!set3 || !Number.isFinite(set3.a) || !Number.isFinite(set3.b)) {
        return { ok: false, reason: 'third-set-missing' };
      }
    }
    if (activeSets.length < neededSlots || activeSets.some((s) => !s || !Number.isFinite(s.a) || !Number.isFinite(s.b))) {
      return { ok: false, reason: 'set-incomplete' };
    }
    for (let i = 0; i < activeSets.length; i++) {
      if (!Engine.isValidCompletedSetScore(activeSets[i].a, activeSets[i].b, format)) {
        return { ok: false, reason: 'set-invalid' };
      }
    }
    const sets = activeSets.map((s) => {
      const winner = s.a > s.b ? 'A' : 'B';
      let tiebreak = null;
      if (Engine.completedSetHasTiebreak(s.a, s.b, format)) {
        // Mismo criterio que el editor de Por Games (§7 del consolidado): el score INTERNO
        // del tie break nunca se pregunta acá — se guarda un valor plausible del modo Clásico
        // solo para que la celda "TB" tenga algo consistente que mostrar, nunca se narra en
        // BRAMU Intelligence.
        const cfg = Engine.tiebreakModeConfig('classic');
        tiebreak = winner === 'A' ? { a: cfg.winTarget, b: cfg.winTarget - 2, mode: 'classic' } : { a: cfg.winTarget - 2, b: cfg.winTarget, mode: 'classic' };
      }
      return { gamesA: s.a, gamesB: s.b, tiebreak, winner };
    });
    const need = Math.ceil(format.bestOfSets / 2);
    const wonA = sets.filter((s) => s.winner === 'A').length;
    const wonB = sets.filter((s) => s.winner === 'B').length;
    const winnerTeam = wonA >= need ? 'A' : (wonB >= need ? 'B' : null);
    if (!winnerTeam) return { ok: false, reason: 'no-winner' };
    return { ok: true, sets, winnerTeam };
  }

  /** §11: al cambiar de formato, ¿qué sets ya cargados siguen siendo compatibles con
   *  `newFormatId`? Nunca borra a ciegas: conserva cada set que siga siendo un score completo
   *  válido y cuya posición siga existiendo en el nuevo formato; limpia el resto (incluido un
   *  Set 3 que haya quedado huérfano porque el 1-1 que lo justificaba ya no está). Puro —
   *  app.js decide, con este resultado, si hace falta confirmar antes de aplicar. */
  function computeFormatChangeImpact(rawSets, newFormatId) {
    const format = Engine.FORMATS[newFormatId] || Engine.FORMATS.classic;
    const maxSlots = format.bestOfSets === 1 ? 1 : 3;
    const keptSets = (rawSets || []).map((s, i) => {
      if (i >= maxSlots || !s) return null;
      if (!Number.isFinite(s.a) || !Number.isFinite(s.b)) return null;
      if (!Engine.isValidCompletedSetScore(s.a, s.b, format)) return null;
      return s;
    });
    if (!isThirdSetVisible(keptSets[0], keptSets[1], format)) keptSets[2] = null;
    const hasImpact = (rawSets || []).some((s, i) => !!s && !keptSets[i]);
    return { hasImpact, keptSets };
  }

  global.PLMatchLoad = {
    computeRecentPlayers, computeAllKnownPlayers, filterPlayerCandidates, isDuplicatePlayerName,
    canExtendSetDigits, computeValidNextDigits, isMatchDecided, isThirdSetVisible, resolveActiveSetIndex,
    validateMatchDraft, computeFormatChangeImpact,
  };
})(typeof window !== 'undefined' ? window : globalThis);
