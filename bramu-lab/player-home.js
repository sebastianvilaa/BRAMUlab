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

  /** Fuente única para el Home: partidos de `history` donde jugó `playerName`, ordenados
   *  del más reciente al más antiguo por `finishedAt` (Etapa 2 §3.3). No crea ni duplica
   *  ningún almacenamiento — filtra el mismo array de siempre. */
  function filterMatchesForPlayer(history, playerName) {
    const target = Store.normalizePlayerName(playerName);
    if (!target) return [];
    return (history || [])
      .filter((m) => m && Array.isArray(m.players) && m.players.some((p) => p && p.name === target))
      .slice()
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
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
      const d = new Date(m.finishedAt);
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

  global.PLPlayerHome = {
    getPlayerTeam, getPartnerName, getOpponentNames, matchResultForPlayer,
    filterMatchesForPlayer, computeRecentForm, computeMatchesThisMonth,
    computeBestWinStreak, computeMostFrequentPartner, computeMostFrequentRival,
    buildTuMomentoText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
