/* ==========================================================================
   BRAMU Lab — match-sync.js (Backend Bloque 5)
   Funciones puras de traducción servidor -> forma local y de separación
   historial/estadísticas. Sin DOM, sin red, sin storage — mismo criterio que
   engine.js/stats.js/player-home.js/match-load.js: recibe datos ya
   resueltos (por matches.js/store.js) y devuelve estructuras listas para que
   app.js las renderice o para que player-home.js/stats.js/groups.js las
   agreguen SIN NINGÚN CAMBIO en esos archivos.

   Punto central de esta ronda (09_Resultado_Wiring_Frontend_Claude.md):
   un partido servidor (get_my_matches/get_match_detail, ya en camelCase por
   matches.js) se traduce UNA vez acá a la MISMA forma que ya usa
   buildManualMatchSnapshot (app.js) para un partido local — `players[]` con
   `{id,team,name,userId}`, `sets[]` con `{gamesA,gamesB,tiebreak,winner}`,
   `winnerTeam` derivado (nunca enviado por el servidor: se calcula acá con
   el MISMO Engine que ya usa la carga local, para no tener una tercera
   copia de la regla de victoria — 02_Analisis_Claude.md §2) — más un puñado
   de campos NUEVOS exclusivos de un partido compartido (`serverBacked`,
   `status`, `actionSide`, `readyForValidation`, `hidden`, etc.) que los
   consumidores viejos simplemente ignoran.

   SEPARACIÓN HISTORIAL vs. ESTADÍSTICAS (punto 5 del pedido de wiring): un
   partido local legacy siempre fue "oficial" en el sentido del prototipo
   (no existe la noción de pendiente) — por eso `isComputableMatch` lo deja
   pasar siempre. Un partido server-backed SOLO es computable cuando
   `status==='validated'` — hoy eso nunca ocurre todavía (Bloque 5 nunca
   marca `validated`, eso es Bloque 6), así que en la práctica NINGÚN
   partido server-backed alimenta estadísticas hasta que exista Bloque 6.
   Esto es intencional, no un bug: "antes de validar no afecta Nivel,
   calibración ni estadísticas oficiales" (Backend_Infraestructura.md §8.5). */
(function (global) {
  'use strict';

  /** Deriva `tiebreak` en la forma local (`{a,b,mode}|null`) desde los campos planos que
   *  devuelve el servidor (`tiebreakA`/`tiebreakB`, `null` cuando ese set no tuvo tie break). */
  function deriveTiebreak(setRow) {
    if (!Number.isFinite(setRow.tiebreakA) || !Number.isFinite(setRow.tiebreakB)) return null;
    // El modo interno del tie break nunca se preguntó ni se guardó server-side (mismo criterio
    // que match-load.js ya aplica para un partido cargado localmente: "el score INTERNO del
    // tie break nunca se pregunta acá") — 'classic' es solo un valor plausible para que la
    // celda "TB" tenga algo consistente que mostrar.
    return { a: setRow.tiebreakA, b: setRow.tiebreakB, mode: 'classic' };
  }

  /** sets[] en la forma local, ordenados por número de set, con `winner` derivado por set y
   *  `tiebreak` reconstruido. `rawSets` es el array `sets` que ya devuelven get_my_matches/
   *  get_match_detail (camelCase, ver matches.js). */
  function buildLocalSets(rawSets) {
    return (Array.isArray(rawSets) ? rawSets.slice() : [])
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((s) => ({
        gamesA: s.gamesA,
        gamesB: s.gamesB,
        tiebreak: deriveTiebreak(s),
        winner: s.gamesA > s.gamesB ? 'A' : 'B',
      }));
  }

  /** winnerTeam derivado de `sets` + `formatId`, con el MISMO criterio de "sets necesarios para
   *  ganar" que ya usa Engine/match-load.js — nunca un campo que el servidor calcule o envíe. */
  function deriveWinnerTeam(sets, formatId) {
    const Engine = global.PLEngine;
    const format = (Engine && Engine.FORMATS && Engine.FORMATS[formatId]) || (Engine && Engine.FORMATS && Engine.FORMATS.classic);
    if (!format) return null;
    const need = Math.ceil(format.bestOfSets / 2);
    const wonA = sets.filter((s) => s.winner === 'A').length;
    const wonB = sets.filter((s) => s.winner === 'B').length;
    return wonA >= need ? 'A' : (wonB >= need ? 'B' : null);
  }

  /** players[] en la forma local (`{id,team,name,userId}` × 4), ordenados A1/A2/B1/B2 —
   *  `participants` es el array que ya devuelven get_my_matches/get_match_detail
   *  (`{team,position,playerId,displayName}`). `userId` es SIEMPRE el player_id real
   *  (registrado o provisional): identidad server-backed nunca se resuelve por nombre. */
  function buildLocalPlayers(participants) {
    return (Array.isArray(participants) ? participants.slice() : [])
      .sort((a, b) => (a.team !== b.team ? (a.team < b.team ? -1 : 1) : a.position - b.position))
      .map((p, i) => ({ id: i, team: p.team, name: p.displayName, userId: p.playerId }));
  }

  /** `stats`/`intelligence` con el MISMO agregador puro que ya usa un partido local
   *  (`S.computeManualStats`/`S.generateManualIntelligence`, stats.js) — nunca una fórmula
   *  nueva ni un número inventado: son un resumen puramente DESCRIPTIVO de LOS SETS DE ESTE
   *  partido puntual (quién ganó más games, si fue parejo, etc.), no una afirmación oficial de
   *  Nivel/Ranking/BRAMU Intelligence V1 (eso sigue exigiendo `status==='validated'`, ver
   *  `isComputableMatch`). Se calculan igual sin importar el estado — Resumen/Historial pueden
   *  reusar `buildScoreCardHTML`/`buildResultBlockHTML` (app.js) sin ningún cambio, tal como ya
   *  pide el punto 4 del wiring ("un único punto de traducción... para evitar reescribir
   *  stats.js"). `null` únicamente si no hay `Stats`/`Engine` cargados (nunca debería pasar en
   *  la app real) o si el partido no tiene sets todavía. */
  function computeDescriptiveStats(sets, players, formatId) {
    const Engine = global.PLEngine;
    const Stats = global.PLStats;
    if (!Engine || !Stats || !sets.length) return { stats: null, intelligence: null };
    const format = Engine.FORMATS[formatId] || Engine.FORMATS.classic;
    const matchCtx = { players, format };
    const stats = Stats.computeManualStats(sets, matchCtx);
    const winnerTeam = deriveWinnerTeam(sets, formatId);
    const intelligence = Stats.generateManualIntelligence(stats, matchCtx, sets, winnerTeam, { manual: false });
    return { stats, intelligence };
  }

  /** Traduce UNA fila server-backed (ya en camelCase, ver matches.js) a la MISMA forma que
   *  `buildManualMatchSnapshot` arma para un partido local — ver comentario de cabecera. */
  function translateServerMatchToLocalShape(row) {
    const sets = buildLocalSets(row.sets);
    const winnerTeam = deriveWinnerTeam(sets, row.formatId);
    const players = buildLocalPlayers(row.participants);
    const openIdentityIssues = Array.isArray(row.openIdentityIssues) ? row.openIdentityIssues : null;
    // Bloque 6 — un slot sin player_id puede estar temporalmente "Por identificar" (issue open)
    // o haber quedado terminalmente como "Jugador no identificado". get_match_detail expone
    // únicamente issues OPEN; por eso, cuando el detalle completo está disponible, un slot NULL
    // sin issue open ya es terminal y no debe seguir pareciendo resoluble.
    if (openIdentityIssues) {
      const openSlots = new Set(openIdentityIssues.map((i) => `${i.team}:${i.positionInTeam}`));
      const positionByTeam = { A: 0, B: 0 };
      players.forEach((p) => {
        positionByTeam[p.team] = (positionByTeam[p.team] || 0) + 1;
        if (!p.userId) {
          const key = `${p.team}:${positionByTeam[p.team]}`;
          p.name = openSlots.has(key) ? 'Por identificar' : 'Jugador no identificado';
        }
      });
    }
    const { stats, intelligence } = computeDescriptiveStats(sets, players, row.formatId);
    const location = row.locationName || Number.isFinite(row.locationLat)
      ? { name: row.locationName || '', lat: row.locationLat, lng: row.locationLng }
      : null;
    return {
      matchId: row.matchId,
      // El servidor no expone un created_at propio en get_my_matches/get_match_detail
      // (Backend_Infraestructura.md nunca lo pidió como dato de UI) — playedAt es la mejor
      // aproximación disponible sin una llamada adicional, y coincide con el criterio de
      // getPlayedAt (player-home.js): playedAt siempre gana como "fecha real jugada".
      createdAt: row.playedAt,
      playedAt: row.playedAt,
      startedAt: row.playedAt,
      finishedAt: row.playedAt,
      timeZone: row.reportedTimeZone || null,
      players,
      mode: 'manual',
      scoringSystem: row.scoringSystem || null,
      formatId: row.formatId,
      tiebreakMode: null,
      baseline: null,
      sets,
      currentPartial: null,
      winnerTeam,
      terminationType: 'automatic',
      terminationReason: null,
      terminationReasonLabel: null,
      regulationCompleted: true,
      durationMs: 0,
      stats,
      perSetStats: [],
      evolution: null,
      intelligence,
      highlights: [],
      events: [],
      coverageStartLabel: null,
      timeKnown: row.playedAtTimeKnown !== false,
      location,
      privateNote: row.privateNote || null,
      // Campos NUEVOS, exclusivos de un partido server-backed — un consumidor viejo que no los
      // conoce simplemente los ignora (nunca rompe player-home.js/stats.js/groups.js).
      serverBacked: true,
      status: row.status,
      actionSide: row.actionSide || null,
      isActionMine: !!row.isActionMine,
      readyForValidation: !!row.readyForValidation,
      hidden: !!row.hidden,
      createdByPlayerId: row.createdByPlayerId || null,
      validatedAt: row.validatedAt || null,
      validationDeadlineAt: row.validationDeadlineAt || null,
      myTeam: row.myTeam || null,
      // Backend Bloque 6 (Fase B) — extensión de get_my_matches/get_match_detail. `get_my_matches`
      // (Historial/Home) solo trae el booleano `hasOpenIdentityIssue`; `get_match_detail` (Resumen)
      // trae además el detalle completo `openIdentityIssues` (team/position/deadline por slot) —
      // se deriva el booleano desde el array cuando está disponible, nunca al revés (el array
      // nunca se inventa desde el booleano). `pendingCorrectionRevisionId` viene igual de ambas.
      pendingCorrectionRevisionId: row.pendingCorrectionRevisionId || null,
      openIdentityIssues,
      hasOpenIdentityIssue: openIdentityIssues ? openIdentityIssues.length > 0 : !!row.hasOpenIdentityIssue,
      // Solo get_match_detail la trae (get_my_matches no) — se usa para derivar client-side
      // quién propuso la corrección post-validación pendiente (último 'revision_proposed'),
      // ver paintB6Actions en app.js. `null` para cualquier fila que no la incluya.
      actionsRaw: Array.isArray(row.actions) ? row.actions : null,
      // Ronda UX 25/09 (§G/§I) — solo get_match_detail las trae (get_my_matches no, mismo
      // criterio que actionsRaw arriba): currentRevisionNumber > 1 distingue "la revisión
      // vigente de este partido pendiente es una corrección" de "es la carga original" — sin
      // esto, paintB6Actions no puede diferenciar ambos casos y el receptor de una corrección
      // pre-validación veía el mismo copy genérico que una carga nueva (Laboratorio §15.7).
      // `null` cuando la fila viene de get_my_matches (Historial/Home, sin detalle todavía) —
      // el llamador debe tratar `null` como "todavía no se sabe", nunca como "no es corrección".
      currentRevisionNumber: Number.isFinite(row.currentRevisionNumber) ? row.currentRevisionNumber : null,
      revisionCount: Number.isFinite(row.revisionCount) ? row.revisionCount : null,
      // Ronda correctiva (revisión central) — migración 20260925150000: solo get_match_detail
      // las trae (get_my_matches no toca esta migración a propósito, mismo criterio que
      // currentRevisionNumber arriba). Pasadas por el MISMO buildLocalSets que `sets` — misma
      // forma exacta (gamesA/gamesB/tiebreak/winner, posicional), para que
      // ML.buildCorrectionDiffLines pueda comparar los tres arrays sin traducir formas
      // distintas. `buildLocalSets(null)` ya devuelve `[]` (nunca null) cuando el campo crudo no
      // aplica (currentRevisionNumber=1 sin revisión anterior, o sin corrección pendiente) —
      // buildCorrectionDiffLines interpreta un array vacío como "sin datos para comparar de ese
      // lado", exactamente lo que corresponde.
      previousRevisionSets: buildLocalSets(row.previousRevisionSets),
      pendingCorrectionSets: buildLocalSets(row.pendingCorrectionSets),
    };
  }

  /** Hotfix B6 — reemplaza el snapshot del Resumen abierto por el detalle canónico recién
   *  leído del servidor. Mantener esta decisión en una función pura permite cubrir la regresión:
   *  una mutación exitosa nunca debe dejar marcador/participantes/estado del Resumen atados al
   *  snapshot previo. Si el usuario ya navegó a otro partido, no reemplaza nada. */
  function refreshOpenAnalysisSnapshot(currentAnalysis, freshServerRow, matchId) {
    if (!currentAnalysis || !freshServerRow || currentAnalysis.matchId !== matchId) return currentAnalysis;
    return translateServerMatchToLocalShape(freshServerRow);
  }

  /** Traduce una entrada del outbox local (store.js: bramulab.matchOutbox.v1) a una fila
   *  MÍNIMA con forma de partido, suficiente para que el Historial la liste con badge
   *  "PENDIENTE DE SINCRONIZACIÓN" (o "NECESITA REVISIÓN") — nunca se le agregan sets/
   *  jugadores inventados más allá de lo que el propio borrador ya tiene. `entry.payload` es
   *  el payload tal cual se le manda a Matches.createOrAttach (pair1PlayerIds/pair2PlayerIds/
   *  rawSets/formatId/playedAtIso/...). */
  function buildOutboxDisplayEntry(entry) {
    if (!entry || !entry.payload) return null;
    const p = entry.payload;
    const rawSets = Array.isArray(p.rawSets) ? p.rawSets : [];
    const sets = rawSets.map((s) => ({ gamesA: s.a, gamesB: s.b, tiebreak: null, winner: s.a > s.b ? 'A' : 'B' }));
    const winnerTeam = deriveWinnerTeam(sets, p.formatId);
    const pair1 = Array.isArray(p.pair1PlayerIds) ? p.pair1PlayerIds : [null, null];
    const pair2 = Array.isArray(p.pair2PlayerIds) ? p.pair2PlayerIds : [null, null];
    const names = entry.participantNames || {};
    const players = [
      { id: 0, team: 'A', name: names[pair1[0]] || 'Vos', userId: pair1[0] || null },
      { id: 1, team: 'A', name: names[pair1[1]] || null, userId: pair1[1] || null },
      { id: 2, team: 'B', name: names[pair2[0]] || null, userId: pair2[0] || null },
      { id: 3, team: 'B', name: names[pair2[1]] || null, userId: pair2[1] || null },
    ];
    const { stats, intelligence } = computeDescriptiveStats(sets, players, p.formatId);
    return {
      matchId: entry.localDraftId,
      createdAt: entry.createdAt,
      playedAt: p.playedAtIso,
      startedAt: p.playedAtIso,
      finishedAt: entry.createdAt,
      timeZone: p.reportedTimeZone || null,
      players,
      mode: 'manual',
      scoringSystem: p.scoringSystem || null,
      formatId: p.formatId,
      tiebreakMode: null,
      baseline: null,
      sets,
      currentPartial: null,
      winnerTeam,
      terminationType: 'automatic',
      terminationReason: null,
      terminationReasonLabel: null,
      regulationCompleted: true,
      durationMs: 0,
      stats,
      perSetStats: [],
      evolution: null,
      intelligence,
      highlights: [],
      events: [],
      coverageStartLabel: null,
      timeKnown: !!p.playedAtTimeKnown,
      location: p.locationName ? { name: p.locationName, lat: p.locationLat, lng: p.locationLng } : null,
      privateNote: entry.privateNote || null,
      serverBacked: true,
      // `sync_pending`: todavía sin respuesta final del servidor. `necesita_revision`: el
      // servidor respondió pidiendo una decisión (error corregible o ambigüedad sin resolver)
      // — ver Store.saveMatchOutboxEntry/02_Analisis_Claude.md §7.
      status: entry.state === 'necesita_revision' ? 'necesita_revision' : 'sync_pending',
      actionSide: null,
      isActionMine: false,
      readyForValidation: false,
      hidden: false,
      createdByPlayerId: pair1[0] || null,
      validatedAt: null,
      validationDeadlineAt: null,
      lastError: entry.lastError || null,
    };
  }

  /** ¿Este partido (ya en forma local, local legacy o server-backed traducido) alimenta
   *  estadísticas/agregaciones oficiales? Un partido local legacy SIEMPRE fue "oficial" en el
   *  sentido del prototipo (nunca existió la noción de pendiente ahí) — se deja pasar sin
   *  cambios, exactamente como hoy. Un partido server-backed SOLO es computable cuando el
   *  servidor lo marcó `validated` — hoy eso nunca ocurre todavía (Bloque 5 nunca escribe ese
   *  estado, ver create_or_attach_match), así que en la práctica ningún partido server-backed
   *  entra a estadísticas hasta que exista Bloque 6. Nunca se fabrica una excepción para
   *  `pending_validation`/`expired`/`sync_pending`/`necesita_revision`. */
  function isComputableMatch(match) {
    if (!match) return false;
    if (!match.serverBacked) return true;
    // Una incidencia de identidad abierta suspende los derivados que dependen de saber quién
    // jugó (Nivel ya se revierte server-side al abrirla). El partido sigue visible/oficial, pero
    // no debe alimentar Efectividad/Evolución/compañeros/rivales mientras el slot esté en duda.
    return match.status === 'validated' && !match.hasOpenIdentityIssue;
  }

  /** Orden más-reciente-primero por `createdAt`, para que `matches[0]` siga significando "el
   *  último partido" para cualquier consumidor (PH.computeRecentForm, renderPlayerLastMatchCard,
   *  etc.) sin importar si el array mezcla local + server-backed + outbox. Sin este orden, una
   *  simple concatenación dejaría SIEMPRE el historial local antes que cualquier partido
   *  server-backed, aunque este último sea más reciente. (`Store.loadHistory()` en solitario no
   *  ordena — mantiene orden de inserción, que en la práctica coincide con `createdAt`
   *  descendente porque `upsertHistory` siempre inserta al frente; acá se ordena explícito
   *  porque server/outbox se insertan por concatenación, no por `unshift`.) */
  function sortByCreatedAtDesc(list) {
    // "Más reciente" en BRAMU significa cuándo se JUGÓ el partido, no cuándo se guardó.
    // Un legacy puede cargarse retroactivamente (createdAt hoy, playedAt hace varios días);
    // ordenar solo por createdAt lo pondría falsamente por encima de un partido realmente
    // más nuevo. Mismo criterio conceptual que PH.getPlayedAt, sin depender de player-home.js.
    const playedMs = (m) => {
      const iso = m && (m.playedAt || m.startedAt || m.createdAt);
      const ms = iso ? new Date(iso).getTime() : 0;
      return Number.isFinite(ms) ? ms : 0;
    };
    return list.slice().sort((a, b) => playedMs(b) - playedMs(a));
  }

  /** Historial para MOSTRAR (Historial/Home badges): local legacy + server-backed traducidos
   *  (cualquier estado) + outbox traducido — todo junto, ordenable/filtrable por las pantallas
   *  como ya hacen hoy con `Store.loadHistory()`. Nunca migra el legacy al servidor: solo se
   *  concatenan arrays en memoria, cada partido conserva su origen (`serverBacked`). */
  function buildDisplayHistory({ localHistory, serverRows, outboxEntries }) {
    // hidden es una preferencia privada de visualización: jamás borra el partido ni sus
    // efectos oficiales, pero sí debe sacarlo de MI Historial/Home. Se filtra también acá
    // como defensa adicional aunque get_my_matches normalmente ya se pida sin ocultos.
    const server = (Array.isArray(serverRows) ? serverRows : [])
      .filter((row) => !row.hidden)
      .map(translateServerMatchToLocalShape);
    const outbox = (Array.isArray(outboxEntries) ? outboxEntries : []).map(buildOutboxDisplayEntry).filter(Boolean);
    return sortByCreatedAtDesc((Array.isArray(localHistory) ? localHistory : []).concat(server, outbox));
  }

  /** Historial para ESTADÍSTICAS (player-home.js/stats.js/groups.js): local legacy completo +
   *  SOLO los server-backed ya `validated` — nunca outbox, nunca pending/expired server-backed.
   *  Mismo array de entrada que `buildDisplayHistory`, filtrado con `isComputableMatch`. */
  function buildComputableHistory({ localHistory, serverRows }) {
    const server = (Array.isArray(serverRows) ? serverRows : []).map(translateServerMatchToLocalShape).filter(isComputableMatch);
    return sortByCreatedAtDesc((Array.isArray(localHistory) ? localHistory : []).concat(server));
  }

  global.PLMatchSync = {
    translateServerMatchToLocalShape, refreshOpenAnalysisSnapshot, buildOutboxDisplayEntry,
    isComputableMatch, buildDisplayHistory, buildComputableHistory,
  };
})(typeof window !== 'undefined' ? window : globalThis);
