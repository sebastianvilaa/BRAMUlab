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

  /* ------------------------------------------------------------------ */
  /* ETAPA 4 (v2.0) — HOME INTEGRAL: Racha actual, Mejor compañero, Actividad
   *  30 días, Efectividad 30 días e Hitos. Todo puro y sin DOM, igual criterio
   *  que el resto de este archivo — `matches` siempre llega ya filtrado y
   *  ordenado por PH.filterMatchesForPlayer (más reciente primero). */
  /* ------------------------------------------------------------------ */

  /** Racha de victorias consecutivas contando desde el partido MÁS RECIENTE hacia atrás
   *  (a diferencia de computeBestWinStreak, que busca la mejor racha de todo el historial).
   *  Una derrota o un partido sin definición corta la racha en 0 — nunca se asume que
   *  sigue activa. Solo cuenta victorias (mismo criterio que "Mejor racha"): una racha de
   *  derrotas no se modela todavía. */
  function computeCurrentStreak(matches, playerName) {
    let count = 0;
    for (let i = 0; i < (matches || []).length; i++) {
      if (matchResultForPlayer(matches[i], playerName) !== 'win') break;
      count += 1;
    }
    return { count };
  }

  /** V02.1 (§22) — los partidos que componen la racha actual, del más reciente hacia atrás
   *  hasta la primera derrota (o hasta donde llegue la muestra). `matches` ya viene ordenado
   *  más reciente primero (PH.filterMatchesForPlayer), así que la racha es simplemente el
   *  prefijo — mismo criterio de conteo que computeCurrentStreak, sin recalcularlo aparte. */
  function computeCurrentStreakMatches(matches, playerName) {
    const { count } = computeCurrentStreak(matches, playerName);
    return (matches || []).slice(0, count);
  }

  /** §10 — "Mejor compañero histórico": a diferencia de computeMostFrequentPartner (el más
   *  repetido), este es el de MAYOR efectividad jugando juntos, exigiendo una muestra mínima
   *  (default 3 partidos juntos) para no premiar un 1/1 casual. Empate de efectividad se
   *  resuelve por más partidos jugados juntos y, si sigue empatado, alfabético — siempre
   *  determinístico. `null` si nadie alcanza la muestra mínima. */
  function computeBestPartner(matches, playerName, minSample) {
    const min = minSample || 3;
    const counts = {};
    (matches || []).forEach((m) => {
      const partner = getPartnerName(m, playerName);
      if (!partner) return;
      if (!counts[partner]) counts[partner] = { count: 0, wins: 0 };
      counts[partner].count += 1;
      if (matchResultForPlayer(m, playerName) === 'win') counts[partner].wins += 1;
    });
    const names = Object.keys(counts).filter((n) => counts[n].count >= min);
    if (!names.length) return null;
    let best = names[0];
    names.forEach((n) => {
      const a = counts[n], b = counts[best];
      const pctA = a.wins / a.count, pctB = b.wins / b.count;
      if (pctA > pctB) best = n;
      else if (pctA === pctB && a.count > b.count) best = n;
      else if (pctA === pctB && a.count === b.count && n < best) best = n;
    });
    const c = counts[best];
    return { name: best, count: c.count, wins: c.wins, pct: Math.round((c.wins / c.count) * 100) };
  }

  /** V02.1 (§22) — agregación completa por compañero/rival para las vistas nuevas
   *  "Compañeros"/"Rivales": récord conjunto con CADA persona real con la que `playerName`
   *  compartió cancha (como compañero o como rival respectivamente). `matches` ya viene de
   *  PH.filterMatchesForPlayer, que por definición excluye los partidos Observados (el
   *  jugador actual no participa en ellos) — nunca hace falta filtrar eso de nuevo acá.
   *  Placeholders del sistema ("Jugador 1"...) se excluyen igual que en el selector de carga
   *  manual (§9) — nunca listados como si fueran personas reales. Orden: más partidos juntos/
   *  enfrentados primero; empate por victorias; empate final alfabético (determinístico). */
  function buildPersonBreakdown(matches, playerName, nameExtractor) {
    const byName = {};
    (matches || []).forEach((m) => {
      const result = matchResultForPlayer(m, playerName);
      nameExtractor(m).forEach((name) => {
        if (!name || Store.isPlaceholderPlayerName(name)) return;
        if (!byName[name]) byName[name] = { name, count: 0, wins: 0, losses: 0 };
        const entry = byName[name];
        entry.count += 1;
        if (result === 'win') entry.wins += 1;
        else if (result === 'loss') entry.losses += 1;
      });
    });
    return Object.keys(byName).map((n) => byName[n])
      .map((e) => Object.assign(e, { pct: (e.wins + e.losses) ? Math.round((e.wins / (e.wins + e.losses)) * 100) : null }))
      .sort((a, b) => b.count - a.count || b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
  }
  function computeTeammateBreakdown(matches, playerName) {
    return buildPersonBreakdown(matches, playerName, (m) => {
      const p = getPartnerName(m, playerName);
      return p ? [p] : [];
    });
  }
  function computeRivalBreakdown(matches, playerName) {
    return buildPersonBreakdown(matches, playerName, (m) => getOpponentNames(m, playerName));
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  /** §9/§15 — Actividad: partidos jugados en la ventana MÓVIL de los últimos 30 días (no mes
   *  calendario), repartidos en 4 bloques cronológicos de igual duración (~7.5 días cada uno)
   *  para que la franja se lea como una línea de tiempo. `buckets[0]` es el tramo MÁS ANTIGUO
   *  de la ventana y `buckets[3]` el más reciente (incluye hoy) — así se dibuja de izquierda a
   *  derecha en el orden natural del tiempo. Un partido sin fecha real válida (getPlayedAt
   *  null) o fuera de la ventana no se cuenta — nunca se ubica a ciegas. */
  function computeActivity30d(matches, playerName, nowDate) {
    const nowMs = (nowDate || new Date()).getTime();
    const bucketMs = THIRTY_DAYS_MS / 4;
    const raw = [0, 1, 2, 3].map(() => ({ count: 0, wins: 0, losses: 0 }));
    let total = 0;
    (matches || []).forEach((m) => {
      const t = parseTimeOrNull(getPlayedAt(m));
      if (t === null) return;
      const age = nowMs - t;
      if (age < 0 || age > THIRTY_DAYS_MS) return;
      const idxFromNow = Math.min(3, Math.floor(age / bucketMs)); // 0 = más reciente
      total += 1;
      raw[idxFromNow].count += 1;
      const res = matchResultForPlayer(m, playerName);
      if (res === 'win') raw[idxFromNow].wins += 1;
      else if (res === 'loss') raw[idxFromNow].losses += 1;
    });
    return { total, buckets: raw.slice().reverse() };
  }

  /** V02.4 (Bloque A, §2.3) — segmentos APILADOS (victorias/derrotas) de UN período de
   *  Actividad, como proporción del propio total de ese período — nunca relativo al máximo
   *  entre los 4 períodos (eso decide la ALTURA de la barra completa, calculada aparte en
   *  app.js/renderPlayerActivity). Puro: sin partidos, ambos segmentos en 0 (nada que apilar,
   *  la barra queda en su baseline vacío). Un período con 0 victorias sigue devolviendo
   *  `lossPct: 100` cuando tiene partidos — la derrota nunca queda en 0% de alto. */
  function computeActivityBarSegments(count, wins, losses) {
    if (!count) return { winPct: 0, lossPct: 0 };
    return {
      winPct: Math.round((wins / count) * 100),
      lossPct: Math.round((losses / count) * 100),
    };
  }

  /** V02.4 (Bloque A, §3.2) — progreso decimal DENTRO del nivel entero actual (nunca la
   *  posición global en el rango LEVEL_MIN–LEVEL_MAX, que era el bug real: un nivel 6.2 se
   *  mostraba a más de la mitad de la barra). 6.0→0%, 6.2→20%, 6.9→90%, 7.0→0% (arranca un
   *  nivel nuevo). Evita precisión flotante (6.3 - 6 = 0.29999999999999982 en JS): en vez de
   *  restar decimales, redondea el nivel a décimos como ENTERO y toma el resto módulo 10 —
   *  aritmética entera, sin resta de floats de por medio. */
  function levelProgressPct(level) {
    const tenths = Math.round((level || 0) * 10) % 10;
    return tenths * 10;
  }

  /** §9 — Efectividad: % de victorias sobre partidos CONSIDERADOS (con resultado definido,
   *  ganado o perdido — un partido sin ganador nunca infla ni desinfla el porcentaje) en los
   *  últimos 30 días. `pct` es `null` sin ninguna muestra — nunca "0%" engañoso. */
  function computeEffectiveness30d(matches, playerName, nowDate) {
    const nowMs = (nowDate || new Date()).getTime();
    let wins = 0, losses = 0;
    (matches || []).forEach((m) => {
      const t = parseTimeOrNull(getPlayedAt(m));
      if (t === null) return;
      const age = nowMs - t;
      if (age < 0 || age > THIRTY_DAYS_MS) return;
      const res = matchResultForPlayer(m, playerName);
      if (res === 'win') wins += 1;
      else if (res === 'loss') losses += 1;
    });
    const considered = wins + losses;
    return { wins, losses, considered, pct: considered ? Math.round((wins / considered) * 100) : null };
  }

  /** V02.1 (§22/§27) — el mismo conjunto de partidos de la ventana móvil de 30 días que ya usan
   *  computeActivity30d/computeEffectiveness30d, expuesto como lista (no solo el conteo) para
   *  que el filtro "Últimos 30 días" del Historial muestre EXACTAMENTE lo mismo que el
   *  porcentaje de Efectividad — nunca un criterio de fecha recalculado aparte que pueda
   *  divergir. */
  function filterMatchesWithin30d(matches, nowDate) {
    const nowMs = (nowDate || new Date()).getTime();
    return (matches || []).filter((m) => {
      const t = parseTimeOrNull(getPlayedAt(m));
      if (t === null) return false;
      const age = nowMs - t;
      return age >= 0 && age <= THIRTY_DAYS_MS;
    });
  }

  /** Cuenta partidos por período de 30 días SIN solapar, anclado a "ahora": índice 0 son los
   *  últimos 30 días, índice 1 los 30 días anteriores a esos, etc. Partidos futuros (fecha
   *  posterior a `nowDate`) o sin fecha real válida quedan afuera. Único uso: detectar el
   *  hito "período más activo" (§5 del consolidado de Etapa 4) sin repetir esta cuenta ahí. */
  function computeThirtyDayPeriodCounts(matches, nowDate) {
    const nowMs = (nowDate || new Date()).getTime();
    const periods = [];
    (matches || []).forEach((m) => {
      const t = parseTimeOrNull(getPlayedAt(m));
      if (t === null || t > nowMs) return;
      const idx = Math.floor((nowMs - t) / THIRTY_DAYS_MS);
      periods[idx] = (periods[idx] || 0) + 1;
    });
    const out = [];
    for (let i = 0; i < periods.length; i++) out[i] = periods[i] || 0;
    return out;
  }

  /** §5 — Hitos personales: observaciones puntuales y justificadas por la historia real,
   *  nunca misiones genéricas. Como máximo 2, evaluadas en este orden de prioridad; cualquiera
   *  que no tenga muestra suficiente simplemente no aparece (nunca se rellena con relleno
   *  genérico). Con menos de 3 partidos en total, ninguno se muestra — es exactamente el
   *  mismo umbral que ya usa buildTuMomentoText para "no inventar con muestra chica". */
  function computeHitos(matches, playerName) {
    const hitos = [];
    if ((matches || []).length < 3) return hitos;

    // (a) a una victoria de igualar la mejor racha histórica.
    const current = computeCurrentStreak(matches, playerName);
    const best = computeBestWinStreak(matches, playerName);
    if (current.count > 0 && best > 0 && current.count === best - 1) {
      hitos.push(`Una victoria más para igualar tu racha de ${best}.`);
    }

    // (b) buen momento reciente con el compañero más frecuente (ventana de hasta 5 juntos,
    // mínimo 3, al menos dos de cada tres ganados).
    if (hitos.length < 2) {
      const partner = computeMostFrequentPartner(matches, playerName);
      if (partner && partner.count >= 3) {
        const withPartner = matches.filter((m) => getPartnerName(m, playerName) === partner.name).slice(0, 5);
        const winsRecent = withPartner.filter((m) => matchResultForPlayer(m, playerName) === 'win').length;
        if (withPartner.length >= 3 && (winsRecent / withPartner.length) >= 0.66) {
          hitos.push(`Ganaste ${winsRecent} de tus últimos ${withPartner.length} con ${partner.name}.`);
        }
      }
    }

    // (c) período más activo: los últimos 30 días superan a TODOS los períodos de 30 días
    // anteriores (nunca en empate) y ya hay al menos un período previo con el que comparar.
    if (hitos.length < 2) {
      const periods = computeThirtyDayPeriodCounts(matches);
      if (periods.length >= 2 && periods[0] >= 3 && periods[0] > Math.max(...periods.slice(1))) {
        hitos.push('Este es tu período más activo.');
      }
    }

    return hitos.slice(0, 2);
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 4.1 (v2.1) — HISTORIAL: pestañas de pertenencia (Todos/Mis
   *  partidos/Observados) + chips de modo. Puras — sin ordenar por sí solas
   *  salvo filterHistoryCombined (única que expone la lista final para pintar). */
  /* ------------------------------------------------------------------ */

  /** §3.1 — "Mis partidos": el jugador actual aparece entre los 4 participantes.
   *  "Observados": registrado en este dispositivo, pero el jugador actual no participa. */
  function classifyMatchOwnership(match, playerName) {
    return getPlayerTeam(match, playerName) ? 'mine' : 'observed';
  }

  function filterHistoryByOwnership(history, playerName, ownership) {
    if (!ownership || ownership === 'all') return (history || []).slice();
    return (history || []).filter((m) => classifyMatchOwnership(m, playerName) === ownership);
  }

  /** Modo canónico ya guardado en el partido — 'manual' | 'games' | 'complete'. Los partidos
   *  guardados antes de que existiera el campo (pre-V13) no lo tienen: se tratan como
   *  'complete', mismo criterio de compatibilidad que ya usa isGamesMode() en app.js. */
  function matchModeCanonical(match) {
    return (match && match.mode) || 'complete';
  }

  function filterHistoryByMode(history, mode) {
    if (!mode || mode === 'all') return (history || []).slice();
    return (history || []).filter((m) => matchModeCanonical(m) === mode);
  }

  /** Intersección de ambos filtros + orden por fecha real jugada (desc) — única función que
   *  necesita pintar la lista del Historial; las dos de arriba quedan expuestas aparte
   *  porque los CONTEOS de las pestañas (§3.1) se calculan sobre el historial completo, sin
   *  aplicar el filtro de modo (ver computeHistoryTabCounts). */
  function filterHistoryCombined(history, playerName, ownership, mode) {
    return filterHistoryByMode(filterHistoryByOwnership(history, playerName, ownership), mode)
      .slice()
      .sort(comparePlayedAtDesc);
  }

  /** §3.1 — conteos reales para las 3 pestañas de pertenencia, sobre el historial COMPLETO
   *  (nunca afectados por el chip de modo activo — cada fila de filtro informa su propia
   *  dimensión, ver comentario de renderHistoryFilters en app.js). */
  function computeHistoryTabCounts(history, playerName) {
    const list = history || [];
    return {
      all: list.length,
      mine: filterHistoryByOwnership(list, playerName, 'mine').length,
      observed: filterHistoryByOwnership(list, playerName, 'observed').length,
    };
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 4.1 (v2.1) — EVOLUCIÓN DEL NIVEL BRAMU (simulada, §4)
   *  Reemplaza el valor fijo `LEVEL_DEMO` de v2.0: el nivel ahora se DERIVA del
   *  historial real, nunca se guarda como puntaje acumulado aparte (§4.2 — "no
   *  guardar puntos acumulados independientes que puedan desincronizarse").
   *  Regla provisional documentada en el consolidado de Etapa 4.1 §4.3, aislada
   *  acá para poder reemplazarla después sin tocar la interfaz. */
  /* ------------------------------------------------------------------ */

  const LEVEL_BASE = 5.0;
  const LEVEL_MIN = 1.0;
  const LEVEL_MAX = 10.0;

  function roundToOneDecimal(n) { return Math.round(n * 10) / 10; }
  function clampLevel(n) { return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n)); }

  /** §4.2 — solo partidos TERMINADOS (con ganador definido y regulación completa — nunca uno
   *  cortado manualmente por tiempo/lesión/suspendido, `regulationCompleted === false`) donde
   *  el jugador actual participa (nunca uno Observado). Los partidos manuales cargados por el
   *  propio usuario SÍ cuentan en esta beta, aunque todavía no exista validación rival. */
  function isMatchConsideredForLevel(match, playerName) {
    if (!match || !match.winnerTeam) return false;
    if (match.regulationCompleted === false) return false;
    return !!getPlayerTeam(match, playerName);
  }

  /** §4.3 — movimiento de un partido ya considerado (ver isMatchConsideredForLevel). Un
   *  Americano se identifica por el FORMATO (bestOfSets === 1), nunca por la cantidad de sets
   *  jugados — así un Clásico cortado en 1 set (si alguna vez existiera) nunca se confunde
   *  con un Americano real. */
  function computeLevelDeltaForMatch(match, playerName) {
    const team = getPlayerTeam(match, playerName);
    const won = match.winnerTeam === team;
    const format = Engine.FORMATS[match.formatId] || Engine.FORMATS.classic;
    if (format.bestOfSets === 1) return won ? 0.1 : -0.1;
    const neededThirdSet = (match.sets || []).length >= 3;
    if (neededThirdSet) return won ? 0.1 : -0.1;
    return won ? 0.2 : -0.2;
  }

  /** §4.2/§4.4 — serie completa, siempre recalculada desde cero a partir del historial (nunca
   *  incremental): ordena cronológicamente ascendente por fecha real jugada y aplica cada
   *  movimiento en cadena, redondeando y acotando a [1.0, 10.0] EN CADA PASO (nunca solo al
   *  final — evita que un límite se cruce de forma invisible a mitad de la serie). Devuelve
   *  `points` en el mismo orden ascendente (para dibujar el gráfico de izquierda a derecha) —
   *  el punto base (5.0, sin partido) NO se incluye ahí a propósito: con un solo partido
   *  considerado, `points.length === 1` y el llamador sabe que debe pintar un único punto,
   *  nunca una línea inventada (§4.4). */
  function computeLevelEvolution(history, playerName) {
    const chronological = (history || [])
      .filter((m) => isMatchConsideredForLevel(m, playerName))
      .slice()
      .sort(comparePlayedAtDesc)
      .reverse();
    let level = LEVEL_BASE;
    const points = chronological.map((m) => {
      const delta = computeLevelDeltaForMatch(m, playerName);
      level = clampLevel(roundToOneDecimal(level + delta));
      return {
        matchId: m.matchId,
        playedAt: getPlayedAt(m),
        result: matchResultForPlayer(m, playerName),
        partner: getPartnerName(m, playerName),
        rivals: getOpponentNames(m, playerName),
        delta,
        level,
      };
    });
    const current = points.length ? points[points.length - 1].level : LEVEL_BASE;
    return {
      base: LEVEL_BASE,
      points,
      current,
      changeFromBase: roundToOneDecimal(current - LEVEL_BASE),
      consideredCount: points.length,
      lastDelta: points.length ? points[points.length - 1].delta : null,
    };
  }

  global.PLPlayerHome = {
    getPlayedAt, comparePlayedAtDesc,
    getPlayerTeam, getPartnerName, getOpponentNames, matchResultForPlayer,
    filterMatchesForPlayer, computeRecentForm, computeMatchesThisMonth,
    computeBestWinStreak, computeMostFrequentPartner, computeMostFrequentRival,
    buildTuMomentoText,
    registerModeLabel, formatLiveScoreLabel, summarizeActiveMatchSnapshot,
    computeCurrentStreak, computeCurrentStreakMatches, computeBestPartner, computeActivity30d, computeEffectiveness30d,
    computeActivityBarSegments, levelProgressPct,
    computeTeammateBreakdown, computeRivalBreakdown,
    computeThirtyDayPeriodCounts, computeHitos, filterMatchesWithin30d,
    classifyMatchOwnership, filterHistoryByOwnership, matchModeCanonical, filterHistoryByMode,
    filterHistoryCombined, computeHistoryTabCounts,
    isMatchConsideredForLevel, computeLevelDeltaForMatch, computeLevelEvolution,
    LEVEL_BASE, LEVEL_MIN, LEVEL_MAX,
  };
})(typeof window !== 'undefined' ? window : globalThis);
