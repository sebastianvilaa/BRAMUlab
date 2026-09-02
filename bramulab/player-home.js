/* ==========================================================================
   BRAMU Lab — player-home.js (Etapa 2, Rama Jugador)
   Funciones puras de agregación histórica para el Home del jugador: filtrar
   Store.loadHistory() por jugador, forma reciente, mejor racha, compañero/rival
   más frecuente y el texto determinístico de "Tu momento". Sin DOM, sin estado
   propio — recibe siempre el historial ya cargado y el nombre del jugador actual.
   app.js hace toda la orquestación de DOM/navegación sobre lo que estas funciones
   devuelven, igual que ya hace con engine.js/stats.js.
   ========================================================================== */
(function (global) {
  'use strict';

  const Store = global.PLStore;
  const Engine = global.PLEngine;

  /** Auditoría funcional (BRAMU_Rama_Jugador_Auditoria_Funcional.md, §8) — resuelve el nombre
   *  que se guarda para Jugador 1 al cargar un partido, según desde dónde se abrió la pantalla:
   *  - `origin === 'player-home'` (el "+"/"Cargar primer partido" del Home del jugador): SIEMPRE
   *    `currentPlayerName`, sin importar qué haya en el campo de texto — ahí es de solo lectura
   *    y muestra "Vos", nunca el nombre real, así que su valor nunca debe leerse para esto.
   *  - cualquier otro origen (flujo tradicional desde `view-setup`): comportamiento de siempre,
   *    texto libre normalizado con el mismo fallback genérico que Jugador 2/3/4. */
  function resolvePlayerOneName(origin, currentPlayerName, fieldValue, fallback) {
    if (origin === 'player-home') return currentPlayerName;
    const normalized = Store.normalizePlayerName(fieldValue);
    return normalized || fallback;
  }

  /** Partido en el que aparece `playerName` (nombre ya normalizado o no — se normaliza acá). */
  function getPlayerTeam(m, playerName) {
    const target = Store.normalizePlayerName(playerName);
    const p = (m.players || []).find((pl) => pl && pl.name === target);
    return p ? p.team : null;
  }

  function getPartnerName(m, playerName) {
    const team = getPlayerTeam(m, playerName);
    if (!team) return null;
    const target = Store.normalizePlayerName(playerName);
    const partner = (m.players || []).find((pl) => pl.team === team && pl.name !== target);
    return partner ? partner.name : null;
  }

  function getOpponentNames(m, playerName) {
    const team = getPlayerTeam(m, playerName);
    if (!team) return [];
    const rivalTeam = team === 'A' ? 'B' : 'A';
    return (m.players || []).filter((pl) => pl.team === rivalTeam).map((pl) => pl.name);
  }

  /** 'win' | 'loss' | 'neutral' — neutral cuando el partido no tiene ganador definido
   *  (ej. "Sin definir" en un cierre manual), nunca se fuerza un resultado inventado. */
  function matchResultForPlayer(m, playerName) {
    const team = getPlayerTeam(m, playerName);
    if (!team || !m.winnerTeam) return 'neutral';
    return m.winnerTeam === team ? 'win' : 'loss';
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 3 (FASE 1) — SEMÁNTICA DE FECHA DEL PARTIDO                    */
  /* Única fuente de verdad para "cuándo se jugó" un partido y para el orden
   *  cronológico de la historia. Nunca repetir esta cadena de fallback ni el
   *  criterio de desempate en otro archivo — todo lo que necesita ordenar o
   *  mostrar la fecha real jugada pasa por acá. */
  /* ------------------------------------------------------------------ */

  /** Convierte un ISO string a timestamp numérico, o `null` si está ausente o es
   *  inválido — nunca deja pasar un NaN silencioso que rompa una comparación. */
  function parseTimeOrNull(iso) {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /** Fecha real en que se jugó el partido — §4 del consolidado de Fase 1:
   *  `playedAt` (elegida por el usuario o igual a `startedAt` en partidos en vivo) →
   *  `startedAt` (partidos históricos sin `playedAt` todavía) → `finishedAt` (colchón
   *  defensivo final). Devuelve el ISO string tal cual está guardado, o `null` si
   *  ninguno de los tres campos es una fecha válida (nunca inventa una fecha). */
  function getPlayedAt(match) {
    if (!match) return null;
    if (parseTimeOrNull(match.playedAt) !== null) return match.playedAt;
    if (parseTimeOrNull(match.startedAt) !== null) return match.startedAt;
    if (parseTimeOrNull(match.finishedAt) !== null) return match.finishedAt;
    return null;
  }

  function timeOrNegInfinity(iso) {
    const t = parseTimeOrNull(iso);
    return t === null ? -Infinity : t;
  }

  /** Comparador para `Array.prototype.sort`: más reciente primero, por fecha REAL
   *  jugada (vía `getPlayedAt`). Desempate documentado (§7): ante `playedAt` idéntico,
   *  `createdAt` descendente; si tampoco alcanza, `finishedAt` descendente; si aún hay
   *  empate exacto, `matchId` como último criterio estable y determinístico (nunca
   *  cambia entre corridas, aunque no tenga significado cronológico propio). */
  function comparePlayedAtDesc(a, b) {
    const byPlayed = timeOrNegInfinity(getPlayedAt(b)) - timeOrNegInfinity(getPlayedAt(a));
    if (byPlayed !== 0) return byPlayed;
    const byCreated = timeOrNegInfinity(b.createdAt) - timeOrNegInfinity(a.createdAt);
    if (byCreated !== 0) return byCreated;
    const byFinished = timeOrNegInfinity(b.finishedAt) - timeOrNegInfinity(a.finishedAt);
    if (byFinished !== 0) return byFinished;
    if (a.matchId === b.matchId) return 0;
    return a.matchId < b.matchId ? 1 : -1;
  }

  /** Fuente única para el Home: partidos de `history` donde jugó `playerName`, ordenados
   *  del más reciente al más antiguo por fecha REAL jugada (Etapa 3, Fase 1) — nunca por
   *  cuándo se guardó. No crea ni duplica ningún almacenamiento — filtra el mismo array
   *  de siempre. */
  function filterMatchesForPlayer(history, playerName) {
    const target = Store.normalizePlayerName(playerName);
    if (!target) return [];
    return (history || [])
      .filter((m) => m && Array.isArray(m.players) && m.players.some((p) => p && p.name === target))
      .slice()
      .sort(comparePlayedAtDesc);
  }

  /** `matches` ya viene ordenado del más reciente al más antiguo (ver arriba). */
  function computeRecentForm(matches, playerName, limit) {
    return (matches || []).slice(0, limit || 5).map((m) => ({
      matchId: m.matchId,
      result: matchResultForPlayer(m, playerName),
    }));
  }

  function computeMatchesThisMonth(matches) {
    const now = new Date();
    return (matches || []).filter((m) => {
      const playedAt = getPlayedAt(m);
      if (!playedAt) return false; // sin fecha real válida: no se puede ubicar en ningún mes, se excluye en vez de adivinar
      const d = new Date(playedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }

  /** Mejor racha de victorias consecutivas en TODO el historial filtrado (orden
   *  cronológico real, no solo los últimos 5). Una derrota o un partido sin definición
   *  cortan la racha — nunca se asume continuidad que los datos no confirman. */
  function computeBestWinStreak(matches, playerName) {
    const chronological = (matches || []).slice().reverse();
    let best = 0, current = 0;
    chronological.forEach((m) => {
      if (matchResultForPlayer(m, playerName) === 'win') { current += 1; best = Math.max(best, current); }
      else { current = 0; }
    });
    return best;
  }

  function topEntry(counts) {
    const names = Object.keys(counts);
    if (!names.length) return null;
    let best = names[0];
    names.forEach((n) => { if (counts[n] > counts[best]) best = n; });
    return { name: best, count: counts[best] };
  }

  function computeMostFrequentPartner(matches, playerName) {
    const counts = {};
    (matches || []).forEach((m) => {
      const partner = getPartnerName(m, playerName);
      if (partner) counts[partner] = (counts[partner] || 0) + 1;
    });
    return topEntry(counts);
  }

  function computeMostFrequentRival(matches, playerName) {
    const counts = {};
    (matches || []).forEach((m) => {
      getOpponentNames(m, playerName).forEach((name) => { counts[name] = (counts[name] || 0) + 1; });
    });
    return topEntry(counts);
  }

  function capitalizeFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /** Etapa 2 §6.2 — texto determinístico de "Tu momento": nunca inventa, combina como
   *  máximo dos datos (forma reciente > compañero frecuente > actividad del mes, en ese
   *  orden de prioridad) y solo cuando hay muestra suficiente para no forzar conclusiones. */
  function buildTuMomentoText(matches, playerName) {
    const n = (matches || []).length;
    if (n === 0) {
      return 'Tu historia empieza acá. Cargá tu primer partido para empezar a descubrir tu pádel.';
    }
    if (n < 3) {
      return n === 1
        ? 'Tu historia recién empieza: ya cargaste tu primer partido. Seguí sumando resultados para descubrir patrones.'
        : 'Tu historia empezó a construirse. Seguí cargando partidos para que BRAMU pueda leer patrones reales.';
    }
    const clauses = [];
    const form = computeRecentForm(matches, playerName, 5);
    const withResult = form.filter((f) => f.result !== 'neutral');
    const wins = form.filter((f) => f.result === 'win').length;
    if (withResult.length >= 3) {
      clauses.push(`venís de ganar ${wins} de tus últimos ${form.length} partidos`);
    }
    const partner = computeMostFrequentPartner(matches, playerName);
    if (clauses.length < 2 && partner && partner.count >= 2) {
      clauses.push(`${partner.name} es tu compañero más frecuente`);
    }
    if (clauses.length < 2) {
      const month = computeMatchesThisMonth(matches);
      if (month > 0) clauses.push(`jugaste ${month} ${month === 1 ? 'partido' : 'partidos'} este mes`);
    }
    if (!clauses.length) {
      return `Ya cargaste ${n} partidos. Tu historia se sigue construyendo, partido a partido.`;
    }
    return capitalizeFirst(clauses.join('. ')) + '.';
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 3 (FASE 2) — ACCESO Y PARTIDO EN CURSO                         */
  /* Única pieza de lógica de la Fase 2 que es genuinamente pura (sin DOM ni
   *  localStorage): el resto (hoja, franja, descarte, reanudación automática)
   *  es orquestación de vistas y vive en app.js, verificada manualmente
   *  (ver informe de la fase — no hay arnés de pruebas para DOM/interacción). */
  /* ------------------------------------------------------------------ */

  const LIVE_MODE_LABELS = { games: 'Game por game', complete: 'Punto por punto' };

  /** Etiqueta visible del modo de registro en vivo (Adenda §2 / Fase 2 §4) — única fuente
   *  de la correspondencia games→"Game por game", complete→"Punto por punto", para no
   *  repetir el mapeo suelto en la franja y en la tarjeta contextual de la hoja. */
  function registerModeLabel(mode) {
    return LIVE_MODE_LABELS[mode] || LIVE_MODE_LABELS.complete;
  }

  /** Texto de UN set ya terminado — MISMO criterio que `formatSetSegmentLabel` de app.js
   *  (Historial/Último partido/Compartir): un set extraordinario (Resolver con Tie break)
   *  agrega su propio resultado de TB aparte ("4-4 · TB 5-10"); un set reglamentario (incluso
   *  si terminó en tie break, ej. "7-6") muestra solo `gamesA-gamesB` — mostrar el desglose
   *  del TB ahí sería redundante. No se reimporta esa función desde app.js (vive en el otro
   *  módulo) para no crear una dependencia cruzada nueva; es la misma lógica, no una segunda. */
  function formatFinishedSetSegment(s) {
    if (!s) return '';
    return s.extraordinary && s.tiebreak
      ? `${s.gamesA}-${s.gamesB} · TB ${s.tiebreak.a}-${s.tiebreak.b}`
      : `${s.gamesA}-${s.gamesB}`;
  }

  /** Correcciones postprueba de Fase 2 (§3.3) — resultado parcial COMPLETO de un partido en
   *  vivo: todos los sets ya terminados más el set actual, nunca solo este último. Recibe el
   *  `state` real del motor (`Engine.computeStateFromEvents`/`computeGameStateFromEvents`) —
   *  única fuente de verdad, sin reinterpretar ni inventar reglas de puntuación. Helper único
   *  y central: lo usan por igual la franja del Home y la tarjeta contextual de la hoja. */
  function formatLiveScoreLabel(state) {
    if (!state) return '0-0';
    const finished = (state.sets || []).map(formatFinishedSetSegment);
    const current = `${state.gamesA || 0}-${state.gamesB || 0}`;
    return finished.concat(current).join(' · ');
  }

  /** Resume un snapshot de partido en curso (la misma forma que guarda
   *  Store.saveActiveMatch/lee Store.loadActiveMatch) a lo que necesitan mostrar la franja
   *  del Home y la hoja "Registrar partido": parejas, resultado parcial completo y modo.
   *  `null` si el snapshot no representa un partido en vivo utilizable. Pura — reutiliza
   *  engine.js para el estado (misma fuente de verdad que el propio marcador), nunca
   *  reinterpreta puntos/games por su cuenta. */
  function summarizeActiveMatchSnapshot(snap) {
    if (!snap || !snap.match) return null;
    const m = snap.match;
    const format = Engine.FORMATS[m.formatId];
    if (!format) return null;
    const state = m.mode === 'games'
      ? Engine.computeGameStateFromEvents(snap.gameEvents || [], format, null)
      : Engine.computeStateFromEvents(snap.pointEvents || [], m.scoringSystem, format, m.tiebreakMode, m.baseline);
    const teamName = (team) => (m.players || []).filter((p) => p && p.team === team).map((p) => p.name).join(' / ');
    return {
      teamAName: teamName('A'),
      teamBName: teamName('B'),
      modeLabel: registerModeLabel(m.mode),
      scoreLabel: formatLiveScoreLabel(state),
    };
  }

  global.PLPlayerHome = {
    resolvePlayerOneName,
    getPlayedAt, comparePlayedAtDesc,
    getPlayerTeam, getPartnerName, getOpponentNames, matchResultForPlayer,
    filterMatchesForPlayer, computeRecentForm, computeMatchesThisMonth,
    computeBestWinStreak, computeMostFrequentPartner, computeMostFrequentRival,
    buildTuMomentoText,
    registerModeLabel, formatLiveScoreLabel, summarizeActiveMatchSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
