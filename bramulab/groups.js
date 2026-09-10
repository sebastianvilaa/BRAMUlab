/* ==========================================================================
   BRAMU Lab — groups.js (BRAMUlab_V03.4 — "MIS GRUPOS")
   Funciones puras de la competencia privada por grupos: pertenencia temporal
   de un miembro, detección automática de qué partidos cuentan para un grupo
   (3 de 4 jugadores activos), cálculo de puntos por partido (base + bonuses),
   tabla semanal (top 3 mejores partidos por jugador), Race anual y BRAMU
   Intelligence grupal. Sin DOM, sin localStorage — igual criterio que
   player-home.js/match-load.js: recibe siempre `fullHistory` (Store.loadHistory())
   y el `group` ya cargado (Store.loadGroups()), app.js hace toda la
   orquestación de pantalla sobre lo que estas funciones devuelven.

   Modelo de un `group`:
   { id, name, createdAt, createdBy,
     members: [ { name, userId|null, isAdmin,
                  periods: [ { joinedAt, leftAt|null }, ... ] }, ... ] }

   `periods` (en vez de un único joinedAt/leftAt) es la única desviación real
   del modelo mínimo pedido por el consolidado (§6/§15: "guardar fecha de
   ingreso y, si corresponde, fecha de salida") — necesaria para que la regla
   "los históricos no se reescriben al agregar/quitar miembros" (§6/§22) siga
   siendo cierta si alguna vez sale y vuelve a entrar: con un solo par de
   fechas, un reingreso pisaría el `joinedAt` original y excluiría del cálculo
   los partidos que sí contaron durante su primera etapa como miembro. Con
   períodos, cada etapa de pertenencia queda registrada por separado y ningún
   partido pasado deja de contar. Ver Store.addGroupMember/removeGroupMember.
   ========================================================================== */
(function (global) {
  'use strict';

  const Store = global.PLStore;
  const PH = global.PLPlayerHome;

  /* ------------------------------------------------------------------ */
  /* PERTENENCIA TEMPORAL (§6)                                            */
  /* ------------------------------------------------------------------ */

  /** ¿`member` estaba activo en el instante `iso`? Activo si `iso` cae dentro de alguno de
   *  sus períodos de pertenencia — `leftAt: null` significa "todavía activo en ese período".
   *  Nunca asume que el período más reciente es el único relevante: un partido viejo, jugado
   *  durante una etapa anterior como miembro, debe seguir contando aunque hoy ese jugador ya no
   *  esté (o esté de nuevo, en una etapa distinta). */
  function isMemberActiveAt(member, iso) {
    if (!member || !iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return (member.periods || []).some((p) => {
      if (!p || !p.joinedAt) return false;
      const start = new Date(p.joinedAt).getTime();
      if (Number.isNaN(start)) return false;
      const end = p.leftAt ? new Date(p.leftAt).getTime() : Infinity;
      return t >= start && t < end;
    });
  }

  function isMemberActiveNow(member, nowDate) {
    return isMemberActiveAt(member, (nowDate || new Date()).toISOString());
  }

  /** Miembros activos DE UN GRUPO en un instante dado — base de la tabla semanal (§8) y de la
   *  detección de partidos válidos (§7). `nowDate` inyectable solo para tests deterministas. */
  function activeMembersAt(group, iso) {
    return ((group && group.members) || []).filter((m) => isMemberActiveAt(m, iso));
  }

  /** Único punto de "¿esta fila de `players[]` de un partido es ESTE miembro del grupo?" —
   *  mismo principio de exclusividad que `PH.findPlayerRow` (player-home.js), aplicado en el
   *  otro sentido: un miembro con `userId` guardado SOLO puede resolverse por ese `userId`
   *  exacto (nunca por coincidencia de nombre, para que dos personas con el mismo nombre
   *  visible no puedan "robarse" puntos entre sí); un miembro sin cuenta real detrás (solo un
   *  nombre conocido, igual que el resto del sistema de JUGADORES de V03.3) resuelve por
   *  nombre normalizado. */
  function findActiveMemberForPlayerRow(row, members, iso) {
    if (!row) return null;
    const rowName = Store.normalizePlayerName(row.name);
    return (members || []).find((mem) => {
      if (!isMemberActiveAt(mem, iso)) return false;
      if (mem.userId) return !!row.userId && row.userId === mem.userId;
      return !!rowName && rowName === Store.normalizePlayerName(mem.name);
    }) || null;
  }

  /* ------------------------------------------------------------------ */
  /* §7 — QUÉ PARTIDOS CUENTAN                                            */
  /* ------------------------------------------------------------------ */

  /** Barra mínima de "partido válido" — misma exigida por `PH.isMatchConsideredForLevel`
   *  (Nivel BRAMU): ganador definido y no cortado manualmente. Acá no se pregunta por un
   *  jugador puntual (a diferencia de esa función), porque la pregunta de un grupo es sobre el
   *  partido en sí, no sobre la participación de una persona. */
  function isMatchValidForGroups(match) {
    return !!(match && match.winnerTeam && match.regulationCompleted !== false);
  }

  /** Cuántos de los 4 jugadores del partido eran miembros ACTIVOS del grupo en la fecha real
   *  en que se jugó (§7: la pertenencia se evalúa "en la fecha del partido", nunca con la
   *  membresía de hoy). `null`/0 si el partido no tiene fecha real válida — sin fecha no hay
   *  forma de ubicarlo en ninguna semana, así que nunca puede contar (ver
   *  computeMatchesForGroupInWeek). */
  function countActiveMembersInMatch(match, members) {
    const iso = PH.getPlayedAt(match);
    if (!iso) return 0;
    return ((match && match.players) || []).filter((row) => !!findActiveMemberForPlayerRow(row, members, iso)).length;
  }

  /** Regla central §7: cuenta para EL GRUPO si al menos 3 de los 4 jugadores eran miembros
   *  activos en la fecha del partido — automático, sin selector ni confirmación. Un mismo
   *  partido puede cumplir esta regla en varios grupos a la vez (cada grupo se evalúa
   *  independiente — nunca hay un "ya se usó en otro grupo" que lo bloquee). */
  function doesMatchCountForGroup(match, group) {
    if (!isMatchValidForGroups(match)) return false;
    return countActiveMembersInMatch(match, group && group.members) >= 3;
  }

  /* ------------------------------------------------------------------ */
  /* §9 — PUNTOS POR PARTIDO                                              */
  /* ------------------------------------------------------------------ */

  const BASE_POINTS = 5;
  const BONUS_POINTS = 1;
  const SORPRESA_MIN_DIFF = 0.5;

  /** Un set completo de pádel nunca termina en empate de games — determinar el ganador desde
   *  `gamesA/gamesB` directamente (nunca depender de un campo `winner` opcional que algún
   *  registro viejo podría no tener) es el mismo criterio ya usado en app.js (ver
   *  `s.gamesA > s.gamesB ? 'A' : 'B'` en los editores de sets). */
  function setWinnerTeam(s) { return (s && s.gamesA > s.gamesB) ? 'A' : 'B'; }

  /** Redondeo a 2 decimales — evita que una resta de dos promedios (ej. 5.05 - 4.55) quede en
   *  0.49999999999999996 por precisión flotante y falle un umbral que en los datos reales sí
   *  se cumple. Mismo espíritu que `roundToOneDecimal` de player-home.js, un decimal más de
   *  margen porque acá se promedian niveles ya redondeados a 1 decimal (el promedio de dos
   *  X.Y puede terminar en X.Y5). */
  function round2(n) { return Math.round(n * 100) / 100; }

  /** Bonus 2 — Remontada (§9): la pareja ganadora perdió el Set 1. Requiere al menos 2 sets
   *  jugados (un Americano de 1 solo set nunca puede "perder el primero y remontar"). */
  function computeBonusRemontada(match) {
    if (!isMatchValidForGroups(match)) return false;
    const sets = match.sets || [];
    if (sets.length < 2) return false;
    return setWinnerTeam(sets[0]) !== match.winnerTeam;
  }

  /** Bonus 3 — Victoria clara (§9): la pareja gana en EXACTAMENTE 2 sets (2-0) y el rival suma
   *  menos de la mitad de los games totales de la pareja ganadora. Por construcción, esto
   *  nunca puede coincidir con Remontada (si ganó 2-0 no perdió el Set 1) — la "exclusión
   *  lógica en la práctica" del consolidado (§9) sale gratis de las dos condiciones, sin
   *  necesidad de un chequeo extra que las excluya a mano. */
  function computeBonusVictoriaClara(match) {
    if (!isMatchValidForGroups(match)) return false;
    const sets = match.sets || [];
    if (sets.length !== 2) return false;
    if (!sets.every((s) => setWinnerTeam(s) === match.winnerTeam)) return false;
    let winnerGames = 0, rivalGames = 0;
    sets.forEach((s) => {
      const wg = match.winnerTeam === 'A' ? s.gamesA : s.gamesB;
      const rg = match.winnerTeam === 'A' ? s.gamesB : s.gamesA;
      winnerGames += wg; rivalGames += rg;
    });
    return rivalGames < winnerGames / 2;
  }

  /** Nivel BRAMU simulado de `playerName` usando SOLO el historial anterior a `match` (§9:
   *  "Nivel BRAMU promedio... antes del partido") — nunca el nivel final ya incluyendo este
   *  mismo resultado, que sesgaría la comparación a favor de quien ganó. Reutiliza
   *  `PH.computeSimulatedJugadorLevel` tal cual (misma fuente que Home/Perfil/Jugadores),
   *  solo recortando `fullHistory` a los partidos con fecha real anterior a este. */
  function computeSimulatedLevelBeforeMatch(fullHistory, playerName, match) {
    const playedAt = PH.getPlayedAt(match);
    const matchTime = playedAt ? new Date(playedAt).getTime() : NaN;
    const prior = (fullHistory || []).filter((m) => {
      const t = PH.getPlayedAt(m);
      if (t === null) return false;
      const tt = new Date(t).getTime();
      return !Number.isNaN(matchTime) && tt < matchTime;
    });
    return PH.computeSimulatedJugadorLevel(prior, playerName);
  }

  /** Bonus 1 — Sorpresa de nivel (§9): la pareja ganadora tenía un Nivel BRAMU promedio al
   *  menos 0,5 INFERIOR al de la pareja rival, ambos medidos antes del partido. Diferencia
   *  menor a 0,5 no suma nada — el umbral se compara sobre la diferencia ya redondeada a 2
   *  decimales (ver `round2`) para no perder el bonus por precisión flotante. */
  function computeBonusSorpresa(match, fullHistory) {
    if (!isMatchValidForGroups(match)) return false;
    const players = match.players || [];
    const winners = players.filter((p) => p && p.team === match.winnerTeam).map((p) => p.name);
    const losers = players.filter((p) => p && p.team !== match.winnerTeam).map((p) => p.name);
    if (winners.length !== 2 || losers.length !== 2) return false;
    const avgLevel = (names) => names.reduce((sum, n) => sum + computeSimulatedLevelBeforeMatch(fullHistory, n, match), 0) / names.length;
    const diff = round2(avgLevel(losers) - avgLevel(winners));
    return diff >= SORPRESA_MIN_DIFF;
  }

  /** Desglose completo de puntos de UN partido para el grupo — `null` si el partido no es
   *  válido (§10 de la app.js validation-style: nunca un booleano solo, siempre explícito).
   *  `total` es siempre lo que se acredita al EQUIPO GANADOR; el perdedor no recibe nada
   *  (§9: derrota = 0 puntos, sin bonus posibles del lado perdedor). */
  function computeMatchPointsBreakdown(match, fullHistory) {
    if (!isMatchValidForGroups(match)) return null;
    const sorpresa = computeBonusSorpresa(match, fullHistory);
    const remontada = computeBonusRemontada(match);
    const claraVictoria = computeBonusVictoriaClara(match);
    const bonusCount = (sorpresa ? 1 : 0) + (remontada ? 1 : 0) + (claraVictoria ? 1 : 0);
    return {
      base: BASE_POINTS, sorpresa, remontada, claraVictoria,
      total: BASE_POINTS + bonusCount * BONUS_POINTS,
      winnerTeam: match.winnerTeam,
    };
  }

  /** Puntos que este partido le aporta A `playerRef` puntualmente (string o `{name,userId}` —
   *  mismo criterio que el resto de la app): el total del desglose si ganó, 0 si perdió o no
   *  jugó este partido. */
  function computePointsForPlayerInMatch(match, playerRef, fullHistory) {
    const breakdown = computeMatchPointsBreakdown(match, fullHistory);
    if (!breakdown) return 0;
    const team = PH.getPlayerTeam(match, playerRef);
    if (!team) return 0;
    return team === breakdown.winnerTeam ? breakdown.total : 0;
  }

  /* ------------------------------------------------------------------ */
  /* §4/§10 — SEMANA DEL GRUPO (lunes-domingo) Y TABLA SEMANAL (§8)        */
  /* ------------------------------------------------------------------ */

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_COUNTED_MATCHES_PER_WEEK = 3;

  /** Partidos de `fullHistory` que cuentan para `group` Y caen dentro de la semana que empieza
   *  en `weekStart` (medianoche local del lunes, ver `PH.startOfWeekMonday`) — reutiliza esa
   *  misma función en vez de reimplementar el criterio de "semana calendario" que ya usa
   *  Actividad del Home (§4: "lunes 00:00 → domingo 23:59, según zona horaria local"). */
  function computeMatchesForGroupInWeek(fullHistory, group, weekStart) {
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    return (fullHistory || []).filter((m) => {
      if (!doesMatchCountForGroup(m, group)) return false;
      const played = PH.getPlayedAt(m);
      if (!played) return false;
      const t = new Date(played).getTime();
      return t >= weekStart.getTime() && t < weekEnd.getTime();
    });
  }

  /** Un miembro aparece en la tabla de una semana si estuvo activo en ALGÚN momento dentro de
   *  esa semana (aunque no haya jugado ningún partido contable — la tabla es de posiciones,
   *  no solo de quien ya tiene puntos). Nunca se filtra por "está activo HOY": una semana
   *  ANTERIOR debe poder mostrar a alguien que ya no es miembro, exactamente como estaba esa
   *  semana (§6/§10 — "resultados congelados"). */
  function membersRelevantForWeek(group, weekStart, weekEnd) {
    return ((group && group.members) || []).filter((mem) => (mem.periods || []).some((p) => {
      if (!p || !p.joinedAt) return false;
      const start = new Date(p.joinedAt).getTime();
      const end = p.leftAt ? new Date(p.leftAt).getTime() : Infinity;
      return start < weekEnd.getTime() && end > weekStart.getTime();
    }));
  }

  /** BRAMUlab_V03.4.1 (§5) — bug real corregido: dos jugadores con el MISMO puntaje deben
   *  compartir posición ("1 Seba — 6 / 1 Esteban — 6 / 3 Diegote — 0"), nunca un desempate
   *  inventado para forzar un líder único. `rows` ya viene ordenado (puntos desc + criterios de
   *  desempate SOLO para el orden de pantalla, nunca para el número de posición en sí — ver
   *  comentario de `computeWeeklyTable` más abajo). Posición "por competencia": un empate en la
   *  cima dejaría el siguiente puesto distinto en 3, no en 2 (nunca "1, 1, 2"). */
  function assignPositions(rows) {
    let lastPoints = null;
    let lastPosition = 0;
    return rows.map((r, i) => {
      const position = (lastPoints !== null && r.points === lastPoints) ? lastPosition : i + 1;
      lastPoints = r.points;
      lastPosition = position;
      return Object.assign({}, r, { position });
    });
  }

  /** Regla central §8: para cada jugador cuentan sus 3 MEJORES partidos puntuables de la
   *  semana (menos de 3 jugados → cuentan todos). `matchesCounted/wins/losses` de la segunda
   *  línea de la tabla (§11) se calculan sobre ese mismo subconjunto de "los que cuentan",
   *  nunca sobre el total jugado esa semana (que puede ser mayor). Orden de PANTALLA: puntos
   *  desc, empate por victorias desc, empate final alfabético — mismo criterio determinístico
   *  que `PH.computeBestPartner`, usado únicamente para decidir en qué orden se listan los
   *  empatados (nunca para inventarles una posición distinta — ver `assignPositions`: dos
   *  filas con el mismo puntaje comparten número de posición sin importar este desempate). */
  function computeWeeklyTable(fullHistory, group, weekStart) {
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const matches = computeMatchesForGroupInWeek(fullHistory, group, weekStart);
    const relevantMembers = membersRelevantForWeek(group, weekStart, weekEnd);
    const rows = relevantMembers.map((mem) => {
      const ref = mem.userId ? { name: mem.name, userId: mem.userId } : mem.name;
      const played = matches.filter((m) => !!PH.getPlayerTeam(m, ref));
      const scored = played
        .map((m) => ({
          matchId: m.matchId,
          points: computePointsForPlayerInMatch(m, ref, fullHistory),
          won: PH.matchResultForPlayer(m, ref) === 'win',
        }))
        .sort((a, b) => b.points - a.points);
      const counted = scored.slice(0, MAX_COUNTED_MATCHES_PER_WEEK);
      const wins = counted.filter((c) => c.won).length;
      return {
        name: mem.name,
        userId: mem.userId || null,
        isAdmin: !!mem.isAdmin,
        points: counted.reduce((sum, c) => sum + c.points, 0),
        matchesCounted: counted.length,
        wins,
        losses: counted.length - wins,
        totalPlayedThisWeek: played.length,
      };
    });
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
    return assignPositions(rows);
  }

  /* ------------------------------------------------------------------ */
  /* §10 — RACE ANUAL                                                     */
  /* ------------------------------------------------------------------ */

  /** Acumulado del año calendario: suma, semana por semana, los puntos EFECTIVOS de cada
   *  jugador (ya recortados al top 3 de esa semana por `computeWeeklyTable` — §10: "respeta el
   *  criterio de los 3 mejores partidos por semana", nunca un top-3 sobre el año entero). Solo
   *  recorre las semanas que realmente tuvieron al menos un partido contable — evita recalcular
   *  semanas vacías del año. Nunca se resetea semanalmente (a diferencia de ACTUAL/ANTERIOR);
   *  se reinicia únicamente al cambiar de año calendario, pasando otro `year`. */
  function computeRaceAnual(fullHistory, group, year) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const matchesInYear = (fullHistory || []).filter((m) => {
      if (!doesMatchCountForGroup(m, group)) return false;
      const played = PH.getPlayedAt(m);
      if (!played) return false;
      const t = new Date(played).getTime();
      return t >= yearStart.getTime() && t < yearEnd.getTime();
    });
    const weekStartsMs = Array.from(new Set(
      matchesInYear.map((m) => PH.startOfWeekMonday(new Date(PH.getPlayedAt(m))).getTime())
    ));
    const totals = {};
    weekStartsMs.forEach((ms) => {
      const table = computeWeeklyTable(fullHistory, group, new Date(ms));
      table.forEach((row) => {
        const key = row.userId || Store.normalizePlayerName(row.name);
        if (!totals[key]) {
          totals[key] = { name: row.name, userId: row.userId, isAdmin: row.isAdmin, points: 0, matchesCounted: 0, wins: 0, losses: 0 };
        }
        totals[key].points += row.points;
        totals[key].matchesCounted += row.matchesCounted;
        totals[key].wins += row.wins;
        totals[key].losses += row.losses;
        // Un admin puede haber dejado de serlo (o empezado a serlo) en otra semana del mismo
        // año — se queda con el estado de admin más reciente encontrado, sin que eso afecte
        // los puntos ya sumados (la Race es sobre resultados, el rol es solo una etiqueta).
        totals[key].isAdmin = row.isAdmin;
      });
    });
    const rows = Object.keys(totals).map((k) => totals[k]);
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
    return assignPositions(rows);
  }

  /* ------------------------------------------------------------------ */
  /* §12 — BRAMU INTELLIGENCE GRUPAL                                      */
  /* Cada candidata es una función pura e independiente que devuelve un    */
  /* string o `null` (sin dato real suficiente). `buildGroupIntelligence`  */
  /* las intenta en un orden de prioridad fijo y devuelve las primeras 2-3 */
  /* que sí tengan algo real que decir (§12: "no inventar... todo debe     */
  /* salir de tabla/partidos/puntos/bonuses/posiciones/comparación         */
  /* semanal/Race"). Nunca hay menos de 2 salvo que el grupo literalmente   */
  /* no tenga ningún dato todavía (grupo recién creado, sin partidos).      */
  /* ------------------------------------------------------------------ */

  function pluralize(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

  /** "Ana, Bea y Cruz" / "Ana y Bea" / "Ana" — único punto de armado de listas de nombres en
   *  español, para nunca repetir la lógica de comas/"y" en cada insight. */
  function joinNamesEs(names) {
    if (names.length <= 1) return names[0] || '';
    if (names.length === 2) return `${names[0]} y ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  }

  /** BRAMUlab_V03.4.1 (§5) — único punto de "¿quién está primero, con cuántos puntos, y con
   *  quién lo comparte?". Nunca devuelve un solo nombre cuando hay un empate real en la cima —
   *  la tabla ya no fuerza un líder único (ver `assignPositions`) y BRAMU Intelligence tiene que
   *  reflejar exactamente lo mismo, nunca una lectura que contradiga la propia tabla. */
  function topTiedNames(table) {
    const withPoints = (table || []).filter((r) => r.points > 0);
    if (!withPoints.length) return null;
    const topPoints = withPoints[0].points;
    return { names: withPoints.filter((r) => r.points === topPoints).map((r) => r.name), points: topPoints };
  }

  function insightLeader(table) {
    const top = topTiedNames(table);
    if (!top) return null;
    if (top.names.length > 1) return `${joinNamesEs(top.names)} comparten el liderazgo con ${pluralize(top.points, 'punto', 'puntos')}.`;
    return `${top.names[0]} lidera la semana con ${pluralize(top.points, 'punto', 'puntos')}.`;
  }

  /** BRAMUlab_V03.4.1 (§5) — el gap se mide entre el PRIMER GRUPO de puntaje y el SEGUNDO grupo
   *  distinto (nunca entre la fila 0 y la fila 1 del array, que si están empatadas en la cima ya
   *  las cuenta `insightLeader` — comparar esas dos acá daría gap=0 y el texto prohibido "le
   *  pisa los talones" sobre gente que en realidad ya comparte el primer puesto). Nunca usa
   *  "le pisa los talones"/"está segundo" cuando el puntaje es EXACTAMENTE igual — ese caso ya
   *  no llega acá (queda filtrado al buscar el primer punto de corte con `points` distinto). */
  function insightGapOrParity(table) {
    const withPoints = (table || []).filter((r) => r.points > 0);
    if (withPoints.length < 2) return null;
    const topPoints = withPoints[0].points;
    const leaderNames = withPoints.filter((r) => r.points === topPoints).map((r) => r.name);
    const chaser = withPoints.find((r) => r.points < topPoints);
    if (!chaser) return null; // todo el mundo con puntos empatado en la cima — ya lo cuenta insightLeader
    const chaserPoints = chaser.points;
    const chaserNames = withPoints.filter((r) => r.points === chaserPoints).map((r) => r.name);
    const gap = topPoints - chaserPoints;
    if (gap <= 1) {
      const verb = chaserNames.length > 1 ? 'le pisan' : 'le pisa';
      return `La semana está muy pareja: ${joinNamesEs(chaserNames)} ${verb} los talones a ${joinNamesEs(leaderNames)} por ${pluralize(gap, 'punto', 'puntos')}.`;
    }
    if (gap >= 4) {
      const verb = leaderNames.length > 1 ? 'se despegaron' : 'se despegó';
      return `${joinNamesEs(leaderNames)} ${verb} del resto por ${pluralize(gap, 'punto', 'puntos')}.`;
    }
    return null;
  }

  /** Prioridad Sorpresa > Remontada > Victoria clara — un único evento destacado por semana
   *  (§12: "no resolverlo con una sola frase pobre" no significa listar TODOS los bonuses, solo
   *  que el conjunto completo de 2-3 insights sea rico; este es uno de esos insights). */
  function insightBonusHighlight(matches, fullHistory) {
    let best = null;
    (matches || []).forEach((m) => {
      const b = computeMatchPointsBreakdown(m, fullHistory);
      if (!b) return;
      const winners = (m.players || []).filter((p) => p.team === b.winnerTeam).map((p) => p.name).join(' y ');
      if (b.sorpresa) best = { rank: 3, text: `${winners} dieron la sorpresa de la semana, ganando con Nivel BRAMU más bajo que su rival.` };
      else if (b.remontada && (!best || best.rank < 2)) best = { rank: 2, text: `${winners} se dieron vuelta un partido después de perder el primer set.` };
      else if (b.claraVictoria && (!best || best.rank < 1)) best = { rank: 1, text: `${winners} se impusieron con autoridad esta semana.` };
    });
    return best ? best.text : null;
  }

  function insightPreviousWeekComparison(currentTable, previousTable) {
    if (!previousTable || !previousTable.length) return null;
    const prevByKey = {};
    previousTable.forEach((r) => { prevByKey[r.userId || Store.normalizePlayerName(r.name)] = r; });
    let bestClimb = null;
    (currentTable || []).forEach((r) => {
      const prev = prevByKey[r.userId || Store.normalizePlayerName(r.name)];
      if (!prev) return;
      const climb = prev.position - r.position;
      if (climb > 0 && (!bestClimb || climb > bestClimb.climb)) bestClimb = { climb, name: r.name };
    });
    return bestClimb ? `${bestClimb.name} subió ${pluralize(bestClimb.climb, 'puesto', 'puestos')} respecto a la semana pasada.` : null;
  }

  function insightRaceLeader(raceTable) {
    const top = topTiedNames(raceTable);
    if (!top) return null;
    if (top.names.length > 1) return `En la Race anual, ${joinNamesEs(top.names)} comparten la punta con ${pluralize(top.points, 'punto', 'puntos')}.`;
    return `En la Race anual, ${top.names[0]} sigue al frente con ${pluralize(top.points, 'punto', 'puntos')}.`;
  }

  function insightActivity(matches) {
    if (!matches || !matches.length) return null;
    return `El grupo jugó ${pluralize(matches.length, 'partido', 'partidos')} esta semana.`;
  }

  /** `ctx = { currentTable, previousTable, raceTable, currentMatches, fullHistory }`. Devuelve
   *  un array de 2-3 strings (o menos, solo si el grupo no tiene ningún dato real todavía —
   *  nunca se rellena con relleno genérico para forzar el mínimo). */
  function buildGroupIntelligence(ctx) {
    const c = ctx || {};
    return [
      insightLeader(c.currentTable),
      insightBonusHighlight(c.currentMatches, c.fullHistory),
      insightPreviousWeekComparison(c.currentTable, c.previousTable),
      insightGapOrParity(c.currentTable),
      insightRaceLeader(c.raceTable),
      insightActivity(c.currentMatches),
    ].filter(Boolean).slice(0, 3);
  }

  global.PLGroups = {
    isMemberActiveAt, isMemberActiveNow, activeMembersAt, findActiveMemberForPlayerRow,
    isMatchValidForGroups, countActiveMembersInMatch, doesMatchCountForGroup,
    setWinnerTeam, computeBonusRemontada, computeBonusVictoriaClara,
    computeSimulatedLevelBeforeMatch, computeBonusSorpresa,
    computeMatchPointsBreakdown, computePointsForPlayerInMatch,
    computeMatchesForGroupInWeek, membersRelevantForWeek, assignPositions, computeWeeklyTable,
    computeRaceAnual,
    buildGroupIntelligence, topTiedNames, joinNamesEs,
    BASE_POINTS, BONUS_POINTS, SORPRESA_MIN_DIFF, WEEK_MS, MAX_COUNTED_MATCHES_PER_WEEK,
  };
})(typeof window !== 'undefined' ? window : globalThis);
