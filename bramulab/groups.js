/* ==========================================================================
   BRAMU Lab — groups.js (BRAMUlab_V03.4 — "MIS GRUPOS")
   Funciones puras de la competencia privada por grupos: pertenencia temporal
   de un miembro, detección automática de qué partidos cuentan para un grupo
   (3 de 4 jugadores activos), cálculo de puntos por partido (base + bonuses),
   tabla semanal (top 2 mejores partidos por jugador), Race anual y BRAMU
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

   Cierre Grupos B1 (handoff 71, 28/09/2026) — dos reglas nuevas, ver sus funciones:
   §A `isMemberDeportivamenteActiveAt`/`effectiveMembershipStartAt`: un alta/reingreso cuenta
   deportivamente desde el LUNES de esa semana, nunca desde el instante exacto ni de semanas
   anteriores — usada SOLO para decidir qué partidos cuentan (countActiveMembersInMatch).
   §B `membersRelevantForWeek`: eliminar un miembro lo saca de TODAS las superficies visibles
   (Semana actual/pasada/Race/Intelligence) de inmediato, sin excepción — solo se muestra a
   quien sigue siendo miembro activo HOY. Nunca borra partidos reales ni recalcula puntos ya
   obtenidos por otros (esos siguen mirando TODOS los períodos, abiertos y cerrados).
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

  /** Miembros activos DE UN GRUPO en un instante dado — base de la detección de partidos válidos
   *  (§7). `nowDate` inyectable solo para tests deterministas. */
  function activeMembersAt(group, iso) {
    return ((group && group.members) || []).filter((m) => isMemberActiveAt(m, iso));
  }

  /** B2a — microfix frontera semanal (handoff 77, 28/09/2026) — DECISIÓN DE PRODUCTO CERRADA
   *  (`Grupos_BRAMU.md` §"Zona horaria canónica V1"): Grupos BRAMU V1 usa SIEMPRE
   *  `America/Argentina/Buenos_Aires` (lunes 00:00 → domingo 23:59:59.999 de Buenos Aires) para
   *  toda frontera semanal — Semana actual/pasada, piso de alta/reingreso, calificación 3/4 y
   *  actividad del lobby — nunca el huso horario del dispositivo (a diferencia de
   *  `PH.startOfWeekMonday`, usado por Actividad/Ranking/Home, que SÍ es intencionalmente local
   *  a cada dispositivo y queda fuera de este cambio: es un producto distinto). Backend usa el
   *  mismo criterio vía `_groups_week_start_ba` (SQL, migración B2a) — ambos deben coincidir
   *  siempre, ver groups-b2a-frontera-semanal-ba.test.mjs.
   *
   *  Argentina no tiene horario de verano desde 2009 (America/Argentina/Buenos_Aires es UTC-3
   *  fijo todo el año) — por eso alcanza con restar 3h fijas en vez de necesitar una librería de
   *  zonas horarias completa; es matemáticamente equivalente a `AT TIME ZONE
   *  'America/Argentina/Buenos_Aires'` en Postgres para cualquier fecha real de esta app. Si
   *  Argentina alguna vez reintrodujera DST, este atajo dejaría de ser válido y habría que
   *  reemplazarlo por una conversión de zona horaria real. */
  const BA_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

  /** Lunes 00:00:00.000 de Buenos Aires de la semana que contiene `input` (string ISO o Date) —
   *  SIEMPRE el mismo instante real sin importar el huso del dispositivo que lo calcula.
   *  `null` si `input` no es una fecha válida. */
  function weekStartBA(input) {
    const t = new Date(input).getTime();
    if (Number.isNaN(t)) return null;
    // Se calcula sobre los componentes UTC del instante ya desplazado -3h — nunca sobre
    // getDay()/getFullYear() "locales" del runtime, que dependen del huso del dispositivo.
    const shifted = new Date(t - BA_UTC_OFFSET_MS);
    const day = shifted.getUTCDay(); // 0=domingo..6=sábado
    const back = day === 0 ? 6 : day - 1;
    const mondayShiftedMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - back * 86400000;
    return new Date(mondayShiftedMs + BA_UTC_OFFSET_MS);
  }

  /** Cierre B1 (handoff 71 §A) — PISO SEMANAL de un alta/reingreso: para el CÓMPUTO DEPORTIVO de
   *  Grupos (qué partidos cuentan), la pertenencia de un período nuevo vale desde el lunes 00:00
   *  de Buenos Aires (`weekStartBA`, ver arriba) de la semana en que ocurrió `joinedAt` — nunca
   *  desde una semana anterior, nunca solo desde el instante exacto. Ejemplo real QA:
   *  Esteban+Matu vs Seba+Pablito ya era oficial y contaba 3/4 sin Pablito; al agregarse Pablito
   *  esa misma semana, el partido debe poder sumarle puntos A ÉL también aunque se jugó antes de
   *  su alta exacta. Se aplica SOLO al inicio de un período (`joinedAt`); `leftAt` sigue siendo
   *  el instante exacto — la baja no tiene piso semanal (regla B, más abajo). `null` si
   *  `joinedAt` es inválido. */
  function effectiveMembershipStartAt(joinedAtIso) {
    const start = weekStartBA(joinedAtIso);
    return start === null ? null : start.getTime();
  }

  /** Como `isMemberActiveAt`, pero para USO DEPORTIVO (§A): aplica el piso semanal de arriba a
   *  CADA período del miembro, abierto o CERRADO — una baja nunca debe des-contar
   *  retroactivamente un partido que ya contó para el grupo (§B: "no recalcular hacia atrás los
   *  puntos de los demás"), así que esta función sigue mirando toda la historia de períodos tal
   *  cual, nunca solo el actual. NUNCA usar esta variante para decidir si alguien es miembro
   *  VISIBLE hoy (eso sigue siendo `isMemberActiveAt`/`isMemberActiveNow`/`membersRelevantForWeek`,
   *  gobernadas por la regla B). */
  function isMemberDeportivamenteActiveAt(member, iso) {
    if (!member || !iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return (member.periods || []).some((p) => {
      if (!p || !p.joinedAt) return false;
      const start = effectiveMembershipStartAt(p.joinedAt);
      if (start === null) return false;
      const end = p.leftAt ? new Date(p.leftAt).getTime() : Infinity;
      return t >= start && t < end;
    });
  }

  /** Único punto de "¿esta fila de `players[]` de un partido es ESTE miembro del grupo?" —
   *  mismo principio de exclusividad que `PH.findPlayerRow` (player-home.js), aplicado en el
   *  otro sentido: un miembro con `userId` guardado SOLO puede resolverse por ese `userId`
   *  exacto (nunca por coincidencia de nombre, para que dos personas con el mismo nombre
   *  visible no puedan "robarse" puntos entre sí); un miembro sin cuenta real detrás (solo un
   *  nombre conocido, igual que el resto del sistema de JUGADORES de V03.3) resuelve por
   *  nombre normalizado. `opts.effective` (§A) cambia el chequeo de pertenencia a
   *  `isMemberDeportivamenteActiveAt` — usado únicamente por `countActiveMembersInMatch` (qué
   *  partidos cuentan para el grupo); el resto de los llamadores (siempre con `iso = ahora`)
   *  deja el parámetro sin pasar. */
  function findActiveMemberForPlayerRow(row, members, iso, opts) {
    if (!row) return null;
    const effective = !!(opts && opts.effective);
    const rowName = Store.normalizePlayerName(row.name);
    return (members || []).find((mem) => {
      const active = effective ? isMemberDeportivamenteActiveAt(mem, iso) : isMemberActiveAt(mem, iso);
      if (!active) return false;
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
    // §A — pertenencia DEPORTIVA (piso semanal), nunca el instante exacto de alta.
    return ((match && match.players) || []).filter((row) => !!findActiveMemberForPlayerRow(row, members, iso, { effective: true })).length;
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

  const BONUS_POINTS = 1;

  /** V04.23 — reglas de puntaje POR FORMATO (única fuente). Clásico conserva exactamente la
   *  lógica vigente; Americano (1 set, tie-break en 5-5) tiene base 3, Sorpresa con diferencia
   *  >= 1,0, Victoria clara = único set 6-0/6-1/6-2 y nunca Remontada. Se resuelve con
   *  `formatId === 'americano'` explícito: un formato futuro de un set NO hereda estas reglas
   *  (cae en Clásico, igual que antes). */
  const SCORING_PROFILES = {
    classic: { id: 'classic', basePoints: 5, sorpresaMinDiff: 0.5, remontada: true, claraMaxRivalGames: null },
    americano: { id: 'americano', basePoints: 3, sorpresaMinDiff: 1.0, remontada: false, claraMaxRivalGames: 2 },
  };
  function getScoringProfile(match) {
    return (match && match.formatId === 'americano') ? SCORING_PROFILES.americano : SCORING_PROFILES.classic;
  }
  // Alias del perfil Clásico (compatibilidad con consumidores/tests existentes).
  const BASE_POINTS = SCORING_PROFILES.classic.basePoints;
  const SORPRESA_MIN_DIFF = SCORING_PROFILES.classic.sorpresaMinDiff;

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
    if (!getScoringProfile(match).remontada) return false;
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
    const profile = getScoringProfile(match);
    const sets = match.sets || [];
    if (profile.id === 'americano') {
      // Americano: único set ganado por la pareja ganadora con el rival en 0, 1 o 2 games.
      if (sets.length !== 1 || setWinnerTeam(sets[0]) !== match.winnerTeam) return false;
      const rg = match.winnerTeam === 'A' ? sets[0].gamesB : sets[0].gamesA;
      return rg <= profile.claraMaxRivalGames;
    }
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
    const minDiff = getScoringProfile(match).sorpresaMinDiff;
    const players = match.players || [];
    // Grupos B1 — camino server-backed: el partido trae el Nivel OFICIAL previo por jugador
    // (`levelBefore`, de get_group_competition_data). Nunca se cae al estimador simulado: si falta
    // el Nivel de cualquiera de los 4 (o hay un jugador sin identificar), no hay comparación
    // válida y el bonus simplemente no se concede.
    if (match.levelsSource === 'official') {
      if (players.length !== 4) return false;
      const winners = players.filter((p) => p && p.team === match.winnerTeam);
      const losers = players.filter((p) => p && p.team !== match.winnerTeam);
      if (winners.length !== 2 || losers.length !== 2) return false;
      const all = winners.concat(losers);
      if (!all.every((p) => typeof p.levelBefore === 'number' && Number.isFinite(p.levelBefore))) return false;
      const avg = (rows) => rows.reduce((sum, p) => sum + p.levelBefore, 0) / rows.length;
      return round2(avg(losers) - avg(winners)) >= minDiff;
    }
    const winners = players.filter((p) => p && p.team === match.winnerTeam).map((p) => p.name);
    const losers = players.filter((p) => p && p.team !== match.winnerTeam).map((p) => p.name);
    if (winners.length !== 2 || losers.length !== 2) return false;
    const avgLevel = (names) => names.reduce((sum, n) => sum + computeSimulatedLevelBeforeMatch(fullHistory, n, match), 0) / names.length;
    const diff = round2(avgLevel(losers) - avgLevel(winners));
    return diff >= minDiff;
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
    const profile = getScoringProfile(match);
    const bonusCount = (sorpresa ? 1 : 0) + (remontada ? 1 : 0) + (claraVictoria ? 1 : 0);
    return {
      base: profile.basePoints, sorpresa, remontada, claraVictoria,
      total: profile.basePoints + bonusCount * BONUS_POINTS,
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
  const MAX_COUNTED_MATCHES_PER_WEEK = 2;

  /** Partidos de `fullHistory` que cuentan para `group` Y caen dentro de la semana que empieza
   *  en `weekStart` — el llamador (app.js) debe construir ese límite con `PG.weekStartBA` (B2a,
   *  handoff 77): Grupos usa SIEMPRE la frontera canónica de Buenos Aires, nunca el huso local
   *  del dispositivo (a diferencia de Actividad del Home, que sí es intencionalmente local). */
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

  /** Cierre B1 (handoff 71 §B, 28/09/2026) — REEMPLAZA la regla anterior ("estuvo activo en
   *  algún momento de esa semana", con CUALQUIER período histórico). Producto simplificó V1:
   *  "eliminar/quitar miembro = sacarlo del grupo también a nivel visible" — deja de aparecer en
   *  Semana actual, Semana pasada Y Race, sin excepción, aunque haya sumado puntos reales en su
   *  momento (hallazgo QA real: Matu, eliminado, seguía apareciendo). Por eso un miembro entra acá
   *  SOLO si sigue siendo miembro ACTIVO ahora (tiene un período abierto, `leftAt: null`) — nunca
   *  por un período YA CERRADO, ni siquiera si ese período cerrado cae dentro de la semana
   *  pedida. Dentro de ESE único período abierto se aplica el mismo piso semanal de la regla A
   *  (`effectiveMembershipStartAt`): la fila aparece desde el lunes de la semana de su alta/
   *  reingreso en adelante, nunca antes — así un reingreso NUNCA "revive" automáticamente las
   *  semanas de una etapa anterior ya eliminada (si reingresa, es una etapa nueva).
   *
   *  Esto NO afecta qué partidos cuentan para el grupo ni los puntos ya obtenidos por OTROS
   *  miembros: eso sigue decidido por `countActiveMembersInMatch`/`doesMatchCountForGroup`, que
   *  miran TODOS los períodos (abiertos y cerrados) vía `isMemberDeportivamenteActiveAt` — quitar
   *  a alguien nunca des-cuenta retroactivamente un partido que ya calificó para el grupo. */
  function membersRelevantForWeek(group, weekStart, weekEnd) {
    return ((group && group.members) || []).filter((mem) => {
      const openPeriod = (mem.periods || []).find((p) => p && p.joinedAt && !p.leftAt);
      if (!openPeriod) return false;
      const start = effectiveMembershipStartAt(openPeriod.joinedAt);
      return start !== null && start < weekEnd.getTime();
    });
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

  /** Regla central §8: para cada jugador cuentan sus 2 MEJORES partidos puntuables de la
   *  semana (menos de 2 jugados → cuentan todos) — esto decide ÚNICAMENTE `points`.
   *
   *  Cierre B1, retest real (handoff 72, 28/09/2026) — BUG REAL confirmado en Staging: la
   *  segunda línea de la tabla (§11, "actividad") mostraba `matchesCounted/wins/losses` del
   *  mismo subconjunto top-3 que ya computó los puntos, nunca el total jugado esa semana —
   *  un jugador con 10 partidos calificables (6V/4D) pero cuyos 3 mejores fueron 3 victorias
   *  aparecía como "3 partidos · 3 V · 0 D", una lectura falsa de invicto. `points`/
   *  `pointsMatchesCounted` (renombrado, mismo cálculo de siempre) siguen siendo el
   *  subconjunto top-3; `matchesPlayed`/`wins`/`losses` (REALES, sobre TODO lo jugado esa
   *  semana que calificó para el grupo) son ahora los que alimentan esa línea — ver
   *  `buildGroupTableRowHTML` (app.js). La fórmula de puntos, el top 2, la regla 3/4 y la
   *  membresía semanal no cambian: es exclusivamente una corrección de qué dato se MUESTRA.
   *
   *  Orden de PANTALLA: puntos desc, empate por victorias REALES desc, empate final alfabético
   *  — mismo criterio determinístico que `PH.computeBestPartner`, usado únicamente para decidir
   *  en qué orden se listan los empatados (nunca para inventarles una posición distinta — ver
   *  `assignPositions`: dos filas con el mismo puntaje comparten número de posición sin importar
   *  este desempate). */
  /** Handoff 79 §G — ÚNICO punto que decide, para UN jugador dentro de un conjunto de partidos
   *  ya filtrados a una semana, cuáles son sus resultados reales (`scored`, TODOS, orden puntos
   *  desc) — de acá sale tanto la fila de la tabla (`computeWeeklyTable`, top 2 de este mismo
   *  array) como el desglose de puntos del sheet (`buildPlayerWeeklyBreakdown`). "No duplicar
   *  lógica": ningún otro lugar vuelve a recorrer partidos para decidir puntos/top-3 de un
   *  jugador — ambos consumidores llaman a esta función y cortan/leen el mismo array. */
  function computePlayerScoredMatches(matches, playerRef, fullHistory) {
    return (matches || [])
      .filter((m) => !!PH.getPlayerTeam(m, playerRef))
      .map((m) => ({
        match: m,
        matchId: m.matchId,
        points: computePointsForPlayerInMatch(m, playerRef, fullHistory),
        won: PH.matchResultForPlayer(m, playerRef) === 'win',
      }))
      .sort((a, b) => b.points - a.points);
  }

  function computeWeeklyTable(fullHistory, group, weekStart) {
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS);
    const matches = computeMatchesForGroupInWeek(fullHistory, group, weekStart);
    const relevantMembers = membersRelevantForWeek(group, weekStart, weekEnd);
    const rows = relevantMembers.map((mem) => {
      const ref = mem.userId ? { name: mem.name, userId: mem.userId } : mem.name;
      const scored = computePlayerScoredMatches(matches, ref, fullHistory);
      const counted = scored.slice(0, MAX_COUNTED_MATCHES_PER_WEEK);
      const realWins = scored.filter((s) => s.won).length;
      return {
        name: mem.name,
        userId: mem.userId || null,
        isAdmin: !!mem.isAdmin,
        points: counted.reduce((sum, c) => sum + c.points, 0),
        // Actividad REAL — toda esta semana, no solo el top 2 que puntuó.
        matchesPlayed: scored.length,
        wins: realWins,
        losses: scored.length - realWins,
        // Top 2 que efectivamente aportó a `points` (informativo/tests; nunca para la UI de
        // actividad — ver comentario de arriba).
        pointsMatchesCounted: counted.length,
      };
    });
    rows.sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name, 'es'));
    return assignPositions(rows);
  }

  /* ------------------------------------------------------------------ */
  /* §10 — RACE ANUAL                                                     */
  /* ------------------------------------------------------------------ */

  /** Acumulado del año calendario: suma, semana por semana, los puntos EFECTIVOS de cada
   *  jugador (ya recortados al top 2 de esa semana por `computeWeeklyTable` — §10: "respeta el
   *  criterio de los 2 mejores partidos por semana", nunca un top-3 sobre el año entero). Solo
   *  recorre las semanas que realmente tuvieron al menos un partido contable — evita recalcular
   *  semanas vacías del año. Nunca se resetea semanalmente (a diferencia de ACTUAL/ANTERIOR);
   *  se reinicia únicamente al cambiar de año calendario, pasando otro `year`.
   *
   *  Cierre B1, retest real (handoff 72) — `matchesPlayed`/`wins`/`losses` acumulan la
   *  actividad REAL semana a semana (mismo campo ya corregido en `computeWeeklyTable`), nunca el
   *  subconjunto top-3: la línea secundaria de Race debe reflejar la actividad real acumulada
   *  del período visible del miembro, mientras `points` sigue siendo la suma de los puntos
   *  semanales EFECTIVOS (top-3 por semana) — eso no cambia. */

  /** Semanas (lunes BA, orden ascendente) del año calendario que tuvieron al menos un partido
   *  contable para `group` — extraído de `computeRaceAnual` (handoff 79 §G) para que el resumen
   *  semana-por-semana del sheet de Race (`buildRaceWeeklySummary`) recorra EXACTAMENTE las
   *  mismas semanas que el total anual, nunca una segunda enumeración que pueda divergir. */
  function computeGroupYearWeekStarts(fullHistory, group, year) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const matchesInYear = (fullHistory || []).filter((m) => {
      if (!doesMatchCountForGroup(m, group)) return false;
      const played = PH.getPlayedAt(m);
      if (!played) return false;
      const t = new Date(played).getTime();
      return t >= yearStart.getTime() && t < yearEnd.getTime();
    });
    // B2a — misma frontera BA que `effectiveMembershipStartAt` (nunca `PH.startOfWeekMonday`
    // local): si difirieran, un partido podría agruparse en una semana para "qué cuenta" y en
    // otra distinta para el Race, produciendo totales inconsistentes.
    return Array.from(new Set(
      matchesInYear.map((m) => weekStartBA(PH.getPlayedAt(m)).getTime())
    )).sort((a, b) => a - b);
  }

  /** V04.37 — `opts.beforeWeekStartMs` (opcional): Race del AÑO hasta el cierre de la semana BRAMU anterior a esa
   *  frontera, es decir solo semanas con lunes BA < `beforeWeekStartMs`. Sin `opts` el cálculo es el de siempre,
   *  byte a byte (nadie más pasa ese parámetro): puntos, top 2, bonus y membresía no cambian. */
  function computeRaceAnual(fullHistory, group, year, opts) {
    const limitMs = opts && Number.isFinite(opts.beforeWeekStartMs) ? opts.beforeWeekStartMs : null;
    const weekStartsMs = computeGroupYearWeekStarts(fullHistory, group, year).filter((ms) => limitMs === null || ms < limitMs);
    const totals = {};
    weekStartsMs.forEach((ms) => {
      const table = computeWeeklyTable(fullHistory, group, new Date(ms));
      table.forEach((row) => {
        const key = row.userId || Store.normalizePlayerName(row.name);
        if (!totals[key]) {
          totals[key] = { name: row.name, userId: row.userId, isAdmin: row.isAdmin, points: 0, matchesPlayed: 0, wins: 0, losses: 0, pointsMatchesCounted: 0 };
        }
        totals[key].points += row.points;
        totals[key].matchesPlayed += row.matchesPlayed;
        totals[key].wins += row.wins;
        totals[key].losses += row.losses;
        totals[key].pointsMatchesCounted += row.pointsMatchesCounted;
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

  /** V04.37 (Grupos_BRAMU.md §29) — movimiento de puestos de la Race anual respecto del cierre de la semana BRAMU
   *  anterior. Función pura de PRESENTACIÓN: recibe las dos tablas ya calculadas por `computeRaceAnual` (actual y
   *  `beforeWeekStartMs`) y NUNCA toca puntos, top 2, bonus ni posiciones: solo agrega `movement` a cada fila.
   *  - `movement = { delta }` con delta = puesto previo − puesto actual (> 0 sube, < 0 baja), SOLO si el jugador tenía fila
   *    en la Race previa (alta/reingreso sin comparación válida, o primera semana del año → sin `movement`) y el puesto cambió;
   *  - los puestos son los de competición `1,1,3` que ya trae `position` (empates comparten número);
   *  - `movementSlot: true` en TODAS las filas cuando al menos una tiene movimiento (reserva la columna para que la tabla no
   *    se desalinee); sin ningún movimiento no se agrega nada (la tabla queda exactamente igual que antes). */
  function annotateRaceMovement(raceRows, previousRaceRows) {
    const prior = new Map((previousRaceRows || []).map((r) => [rowKey(r), r.position]));
    const withMv = (raceRows || []).map((r) => {
      const prev = prior.get(rowKey(r));
      const delta = prev == null ? null : prev - r.position;
      return delta ? Object.assign({}, r, { movement: { delta } }) : r;
    });
    const any = withMv.some((r) => r.movement);
    return any ? withMv.map((r) => Object.assign({}, r, { movementSlot: true })) : withMv;
  }

  /* ------------------------------------------------------------------ */
  /* B2b — LOBBY, DESGLOSE DE PUNTOS Y RESUMEN DE RACE (handoff 79)       */
  /* Funciones puras de PRESENTACIÓN: toman una tabla/partidos ya         */
  /* calculados por las funciones de arriba y solo deciden qué mostrar —  */
  /* nunca recalculan puntos/top-3/posiciones con una segunda regla.      */
  /* ------------------------------------------------------------------ */

  function rowKey(row) { return row.userId || Store.normalizePlayerName(row.name); }

  /** §B — tarjeta de un grupo en el lobby, a partir de `weeklyTable` YA calculada
   *  (`computeWeeklyTable` sobre `weekMatches`/`group` del payload de `get_groups_lobby`, misma
   *  función que ya usa Semana actual del detalle — nunca una segunda regla deportiva). Nunca
   *  recalcula actividad ni decide el orden entre grupos: eso es `lastActivityAt`, autoritativo
   *  del backend (ver app.js — la lista de tarjetas se ordena tal cual llega).
   *
   *  Estados sin puntos (§B, copy cerrado):
   *  - `activeMemberCount<=1` → `one_member` ("el grupo ya existe, falta la banda" — por la
   *    regla 3/4 un grupo de 1 nunca puede sumar);
   *  - `activeMemberCount===2` → `two_members` (mismo motivo, falta 1);
   *  - `activeMemberCount>=3` sin nadie con puntos → `no_activity`.
   *
   *  Con puntos: hasta 3 FILAS visibles agrupadas por posición real — un empate NUNCA se corta
   *  a la mitad (§B/Grupos_BRAMU.md §10.1): si el primer grupo de posición ya tiene más de 3
   *  integrantes, se comprime en una sola fila (`compressedTie`); si no, se muestran grupos
   *  completos hasta llegar o quedar justo por debajo de 3 filas. `selfRow` solo aparece si
   *  `callerKey` tiene una fila real en `weeklyTable` (aunque sea 0 pts) y NO quedó ya visible
   *  individualmente (comprimido o fuera de las 3 filas) — nunca duplicado. */
  function buildLobbyCardSummary(weeklyTable, activeMemberCount, callerKey) {
    const rows = weeklyTable || [];
    const hasPoints = rows.some((r) => r.points > 0);
    if (!hasPoints) {
      let state = 'no_activity';
      if ((activeMemberCount || 0) <= 1) state = 'one_member';
      else if (activeMemberCount === 2) state = 'two_members';
      return { state, visibleRows: [], compressedTie: null, selfRow: null };
    }
    const scored = rows.filter((r) => r.points > 0);
    const groups = [];
    scored.forEach((r) => {
      const last = groups[groups.length - 1];
      if (last && last.position === r.position) last.rows.push(r); else groups.push({ position: r.position, rows: [r] });
    });
    let visibleRows = [];
    let compressedTie = null;
    if (groups[0].rows.length > 3) {
      compressedTie = { count: groups[0].rows.length, points: groups[0].rows[0].points };
    } else {
      for (const g of groups) {
        if (visibleRows.length + g.rows.length > 3) break;
        visibleRows = visibleRows.concat(g.rows);
      }
    }
    const shownKeys = new Set(visibleRows.map(rowKey));
    let selfRow = null;
    if (callerKey && !shownKeys.has(callerKey)) {
      const mine = rows.find((r) => rowKey(r) === callerKey);
      if (mine) selfRow = mine;
    }
    return { state: 'has_points', visibleRows, compressedTie, selfRow };
  }

  /** §G — desglose de puntos de UN jugador en una semana, para el sheet que reemplaza el tap a
   *  Perfil desde Semana actual/pasada. Usa `computePlayerScoredMatches` — el MISMO array que
   *  alimenta la fila de `computeWeeklyTable` — así que `total` es SIEMPRE exactamente la suma
   *  de los partidos marcados `counted:true` (nunca puede haber una fila con más/menos puntos
   *  que su propio desglose). `rows` trae TODOS los partidos calificables jugados esa semana
   *  (no solo los 2 que puntuaron) para que una victoria fuera del top 2 sea visible como "no
   *  entra en tus 2 mejores", nunca escondida. */
  function buildPlayerWeeklyBreakdown(matches, playerRef, fullHistory) {
    const scored = computePlayerScoredMatches(matches, playerRef, fullHistory);
    const countedIds = new Set(scored.slice(0, MAX_COUNTED_MATCHES_PER_WEEK).map((s) => s.matchId));
    const rows = scored.map((s) => {
      const breakdown = computeMatchPointsBreakdown(s.match, fullHistory);
      const partnerRow = PH.getPartnerRow(s.match, playerRef);
      const rivalRows = PH.getOpponentRows(s.match, playerRef);
      // Resultado real por set, desde la perspectiva del jugador (sus games primero). Solo sets
      // con games cargados: nunca se inventa un score.
      const ownTeam = PH.getPlayerTeam(s.match, playerRef);
      const sets = (s.match.sets || [])
        .filter((st) => st && Number.isFinite(st.gamesA) && Number.isFinite(st.gamesB))
        .map((st) => (ownTeam === 'A' ? [st.gamesA, st.gamesB] : [st.gamesB, st.gamesA]));
      return {
        matchId: s.matchId,
        playedAt: PH.getPlayedAt(s.match),
        partnerName: partnerRow ? partnerRow.name : null,
        rivalNames: (rivalRows || []).map((r) => r.name),
        sets,
        won: s.won,
        points: s.points,
        counted: countedIds.has(s.matchId),
        bonus: breakdown ? { sorpresa: breakdown.sorpresa, remontada: breakdown.remontada, claraVictoria: breakdown.claraVictoria } : null,
      };
    });
    return {
      rows,
      total: scored.slice(0, MAX_COUNTED_MATCHES_PER_WEEK).reduce((sum, s) => sum + s.points, 0),
      matchesPlayed: scored.length,
    };
  }

  /** §G — resumen Race semana por semana de UN jugador: una fila por semana con partidos reales
   *  del grupo, orden más-reciente-primero (V1: nunca despliega los partidos de cada semana acá
   *  — eso ya lo cubre `buildPlayerWeeklyBreakdown` si en el futuro se navega a una semana
   *  puntual). Parte de EXACTAMENTE las mismas semanas de `computeGroupYearWeekStarts` que suma
   *  `computeRaceAnual`, pero omite las semanas donde el jugador no tiene fila visible en su
   *  etapa competitiva vigente (p. ej. anteriores a un reingreso): esas aportaban 0, así que la
   *  suma de `points` de este resumen coincide siempre con la fila de Race del jugador. */
  function buildRaceWeeklySummary(fullHistory, group, year, playerRef) {
    const key = rowKey({ userId: playerRef && playerRef.userId, name: (playerRef && playerRef.name) || playerRef });
    const weekStartsMs = computeGroupYearWeekStarts(fullHistory, group, year).slice().reverse(); // más reciente primero
    return weekStartsMs.map((ms) => {
      const weekStart = new Date(ms);
      const table = computeWeeklyTable(fullHistory, group, weekStart);
      const row = table.find((r) => rowKey(r) === key);
      if (!row) return null; // sin fila visible en su etapa competitiva vigente: no se fabrica "0 pts"
      return {
        weekStart: weekStart.toISOString(),
        weekEnd: new Date(ms + WEEK_MS).toISOString(),
        points: row.points,
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses: row.losses,
      };
    }).filter(Boolean);
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
   *  que el conjunto completo de 2-3 insights sea rico; este es uno de esos insights).
   *
   *  Cierre B1 (handoff 71 §B) — `activeMemberKeys` (Set de `userId`/nombre normalizado, ver
   *  `buildGroupIntelligence`) evita nombrar en el texto a un miembro YA ELIMINADO: el partido
   *  real sigue contando para el grupo (§B: nunca se recalcula), pero Intelligence no debe
   *  mencionarlo — un partido con algún ganador ya eliminado del grupo simplemente no se
   *  considera como candidato a destacar (el resto de los insights, ya basados en
   *  currentTable/raceTable filtradas, quedan cubiertos sin este chequeo extra). */
  function insightBonusHighlight(matches, fullHistory, activeMemberKeys) {
    let best = null;
    (matches || []).forEach((m) => {
      const b = computeMatchPointsBreakdown(m, fullHistory);
      if (!b) return;
      const winnerRows = (m.players || []).filter((p) => p.team === b.winnerTeam);
      if (activeMemberKeys && !winnerRows.every((p) => activeMemberKeys.has(p.userId || Store.normalizePlayerName(p.name)))) return;
      const winners = winnerRows.map((p) => p.name).join(' y ');
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
    // §B — claves de miembros ACTUALMENTE activos (currentTable ya viene filtrada por
    // membersRelevantForWeek: nunca incluye a un eliminado), para que insightBonusHighlight no
    // nombre a nadie que ya no está en el grupo.
    const activeMemberKeys = new Set((c.currentTable || []).map((r) => r.userId || Store.normalizePlayerName(r.name)));
    return [
      insightLeader(c.currentTable),
      insightBonusHighlight(c.currentMatches, c.fullHistory, activeMemberKeys),
      insightPreviousWeekComparison(c.currentTable, c.previousTable),
      insightGapOrParity(c.currentTable),
      insightRaceLeader(c.raceTable),
      insightActivity(c.currentMatches),
    ].filter(Boolean).slice(0, 3);
  }

  /* ------------------------------------------------------------------ */
  /* Grupos B1 — ADAPTADORES desde el contrato server-backed (Fase A)      */
  /* Puros, sin storage: nunca se persiste su salida como autoridad local. */
  /* `identityById`: Map<playerId, {displayName}> (get_players_compact);   */
  /* un id sin identidad resuelta se muestra como "Jugador", nunca se      */
  /* inventa un nombre.                                                    */
  /* ------------------------------------------------------------------ */

  function serverDisplayName(identityById, playerId) {
    const c = identityById && typeof identityById.get === 'function' ? identityById.get(playerId) : null;
    return (c && c.displayName) || 'Jugador';
  }

  /** `list_my_groups().groups[i]` / `get_group_detail().group` -> forma legacy que consume la UI
   *  (`{id,name,createdAt,createdBy,members:[{name,userId,isAdmin,periods}]}`). `userId` es el
   *  `player_id` (compatibilidad interna con la forma actual). `periods` se preservan tal cual.
   *  Un item de lista (sin `members`) devuelve `members: null` + `activeMemberCount`. */
  function adaptServerGroup(sg, identityById) {
    if (!sg) return null;
    const members = Array.isArray(sg.members)
      ? sg.members.map((m) => ({
        name: serverDisplayName(identityById, m.playerId),
        userId: m.playerId,
        isAdmin: !!m.isAdmin,
        periods: (m.periods || []).map((p) => ({ joinedAt: p.joinedAt, leftAt: p.leftAt || null })),
      }))
      : null;
    return {
      id: sg.groupId, name: sg.name, createdAt: sg.createdAt, createdBy: sg.createdByPlayerId,
      photoPath: sg.photoPath || null, // ruta cruda de Storage; la URL firmada se resuelve en Auth/app.js
      isAdmin: !!sg.isAdmin, activeMemberCount: sg.activeMemberCount != null ? sg.activeMemberCount : null,
      members, serverBacked: true,
    };
  }

  /** `get_group_competition_data().matches` -> historial con la forma que ya lee el motor
   *  (`players[{team,name,userId}]`, `sets[{gamesA,gamesB}]`, `winnerTeam`, `playedAt`) +
   *  `levelBefore` por jugador y `levelsSource:'official'` (activa el camino de Sorpresa sin
   *  Nivel simulado). */
  function adaptServerCompetitionMatches(serverMatches, identityById) {
    return (serverMatches || []).map((m) => ({
      matchId: m.matchId,
      playedAt: m.playedAt,
      winnerTeam: m.winnerTeam,
      formatId: m.formatId || null,
      regulationCompleted: true,
      levelsSource: 'official',
      sets: (m.sets || []).map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB })),
      players: (m.players || []).map((p, i) => ({
        id: i, team: p.team, userId: p.playerId,
        name: serverDisplayName(identityById, p.playerId),
        levelBefore: (typeof p.levelBefore === 'number' && Number.isFinite(p.levelBefore)) ? p.levelBefore : null,
      })),
    }));
  }

  global.PLGroups = {
    isMemberActiveAt, isMemberActiveNow, activeMembersAt, findActiveMemberForPlayerRow,
    weekStartBA, effectiveMembershipStartAt, isMemberDeportivamenteActiveAt,
    isMatchValidForGroups, countActiveMembersInMatch, doesMatchCountForGroup,
    setWinnerTeam, computeBonusRemontada, computeBonusVictoriaClara,
    computeSimulatedLevelBeforeMatch, computeBonusSorpresa,
    computeMatchPointsBreakdown, computePointsForPlayerInMatch,
    computeMatchesForGroupInWeek, membersRelevantForWeek, assignPositions, computeWeeklyTable,
    computePlayerScoredMatches, computeGroupYearWeekStarts, computeRaceAnual, annotateRaceMovement,
    buildGroupIntelligence, topTiedNames, joinNamesEs,
    buildLobbyCardSummary, buildPlayerWeeklyBreakdown, buildRaceWeeklySummary,
    adaptServerGroup, adaptServerCompetitionMatches,
    BASE_POINTS, BONUS_POINTS, SORPRESA_MIN_DIFF, SCORING_PROFILES, getScoringProfile, WEEK_MS, MAX_COUNTED_MATCHES_PER_WEEK,
  };
})(typeof window !== 'undefined' ? window : globalThis);
