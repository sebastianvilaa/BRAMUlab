/* ==========================================================================
   BRAMU Lab — ranking.js (BRAMUlab_V03.5, Bloques 2 y 3)
   Funciones puras del Ranking BRAMU simulado: universo mock territorial
   (determinístico, sin backend), ordenamiento por Nivel interno exacto
   (mismo criterio de ranking de competición que ya usa PLGroups.assignPositions
   — "1, 1, 3", nunca "1, 1, 2"), movimiento semanal simulado y utilidades de
   banda/búsqueda/paginación. Sin DOM — igual criterio que groups.js/
   player-home.js: app.js hace toda la orquestación de pantalla sobre lo que
   estas funciones devuelven.

   Fuente funcional cerrada: docs/BRAMUlab/Ranking_BRAMU.md. Este módulo NUNCA
   calcula ni modifica Nivel BRAMU — el nivel de cada jugador (incluido el
   propio) siempre viene de PH.computeSimulatedJugadorLevel, la misma función
   que ya usa el resto del prototipo para mostrar el Nivel de otros jugadores
   (Buscar Jugadores, Mis grupos, Perfil público). Acá solo se ordena y se
   pagina lo que esa función ya devuelve.

   Separación de una futura fuente real (§21 del documento de versión): todo
   lo que este archivo genera (nombres/universo territorial) es EXPLÍCITAMENTE
   simulado — MOCK_SCOPE_CONFIG y buildScopeUniverseNames son el único lugar
   que hay que reemplazar cuando exista backend; el resto (ranking/movimiento/
   paginación) es lógica reutilizable con datos reales también.
   ========================================================================== */
(function (global) {
  'use strict';

  const Store = global.PLStore;
  const PH = global.PLPlayerHome;
  const PG = global.PLGroups;
  const PLLoc = global.PLLocations;

  const BLOCK_SIZE = 50;

  /* ------------------------------------------------------------------ */
  /* UNIVERSO TERRITORIAL SIMULADO — MOCK, sin backend (§21)              */
  /* ------------------------------------------------------------------ */
  const MOCK_FIRST_NAMES = [
    'Agustín', 'Bianca', 'Camila', 'Diego', 'Elena', 'Fabián', 'Gabriela', 'Hernán',
    'Inés', 'Joaquín', 'Karina', 'Leandro', 'Micaela', 'Nicolás', 'Olivia', 'Pablo',
    'Rocío', 'Santiago', 'Tomás', 'Valentina', 'Walter', 'Ximena', 'Yamila', 'Zoe',
    'Bruno', 'Carla',
  ];
  const MOCK_LAST_NAMES = [
    'Aguirre', 'Benítez', 'Cabrera', 'Domínguez', 'Echeverría', 'Fernández', 'Gómez', 'Herrera',
    'Ibáñez', 'Juárez', 'Krause', 'Lezcano', 'Medina', 'Núñez', 'Ortiz', 'Paredes',
    'Quiroga', 'Rivas', 'Sosa', 'Torres', 'Urrutia', 'Vega', 'Weiss', 'Ximénez',
    'Yáñez', 'Zapata',
  ];
  const MOCK_POOL_SIZE = MOCK_FIRST_NAMES.length * MOCK_LAST_NAMES.length; // 676

  /** `stride` coprimo con MOCK_POOL_SIZE (676 = 2²×13²): cualquier impar no múltiplo de 13
   *  lo es, así que multiplicar el índice por `stride` y tomar módulo produce una biyección
   *  (cada `i` de 0..count-1 cae en un índice de nombre distinto, sin colisiones) — cada
   *  ámbito se ve con una lista diferente sin necesidad de rangos separados ni de un pool de
   *  nombres más grande. */
  const MOCK_SCOPE_CONFIG = {
    local: { count: 44, stride: 3 },
    provincial: { count: 136, stride: 5 },
    pais: { count: 328, stride: 7 },
    global: { count: 612, stride: 9 },
  };

  function mockNameAt(index) {
    const first = MOCK_FIRST_NAMES[index % MOCK_FIRST_NAMES.length];
    const last = MOCK_LAST_NAMES[Math.floor(index / MOCK_FIRST_NAMES.length) % MOCK_LAST_NAMES.length];
    return `${first} ${last}`;
  }

  /** Universo mock determinístico de un ámbito territorial (local/provincial/pais/global) —
   *  siempre la MISMA lista de nombres para el mismo ámbito, en cualquier momento (no depende
   *  de Date/Math.random). `mis-jugadores` NUNCA pasa por acá: se arma en app.js con partidos
   *  reales (ML.computeRecentPlayers), tal como pide §10.1 de Ranking_BRAMU.md. */
  function buildScopeUniverseNames(scopeKey) {
    const cfg = MOCK_SCOPE_CONFIG[scopeKey];
    if (!cfg) return [];
    const names = [];
    for (let i = 0; i < cfg.count; i++) names.push(mockNameAt((i * cfg.stride) % MOCK_POOL_SIZE));
    return names;
  }

  /** Localidad mock determinística para la segunda línea de una fila en Provincial/País/
   *  Global (§13.1 de Ranking_BRAMU.md) — reutiliza el dataset REAL de locations.js (no
   *  inventa ciudades nuevas), simplemente la cicla por índice. Local no la necesita (todas
   *  las filas comparten la misma localidad, sería redundante repetirla). */
  function mockLocalityAt(index) {
    if (!PLLoc || !PLLoc.LOCATIONS || !PLLoc.LOCATIONS.length) return '';
    const loc = PLLoc.LOCATIONS[index % PLLoc.LOCATIONS.length];
    return PLLoc.formatLocationLabel(loc);
  }

  /* ------------------------------------------------------------------ */
  /* ENTRADAS DE RANKING — nivel SIEMPRE vía PH.computeSimulatedJugadorLevel */
  /* ------------------------------------------------------------------ */

  /** `names`: array de nombres visibles (mock + reales, según ámbito). `selfName`: nombre
   *  visible del usuario actual — se agrega siempre (si no está ya) y se marca `isMe`. El
   *  nivel de CADA jugador (self incluido) es PH.computeSimulatedJugadorLevel(history, name):
   *  la misma función que ya muestra Buscar Jugadores/Mis grupos/Perfil público — nunca un
   *  cálculo propio, así que el número que ve acá siempre coincide con el que va a ver si
   *  toca la fila y abre el perfil público de esa persona. */
  /** `assignMockLocality` — SOLO true para los ámbitos territoriales (universo 100% mock, ver
   *  buildScopeUniverseNames). Mis jugadores son personas reales (self o compañeros con
   *  partidos compartidos) — asignarles una localidad simulada sería inventarle un dato real a
   *  alguien que nunca lo declaró, así que ahí siempre queda en `null` (ver §11.1: Local/Mis
   *  jugadores no necesitan ese contexto igual). */
  function buildRankingEntries(names, history, selfName, assignMockLocality, localityIndexOffset) {
    const selfNorm = Store.normalizePlayerName(selfName);
    const seen = new Set();
    const entries = [];
    let localityCursor = localityIndexOffset || 0;
    (names || []).forEach((rawName) => {
      const norm = Store.normalizePlayerName(rawName);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      const level = PH.computeSimulatedJugadorLevel(history, rawName);
      entries.push({
        id: norm,
        name: norm === selfNorm ? Store.normalizePlayerName(selfName) : rawName,
        level,
        isMe: norm === selfNorm,
        locality: (assignMockLocality && norm !== selfNorm) ? mockLocalityAt(localityCursor++) : null,
      });
    });
    if (selfNorm && !seen.has(selfNorm)) {
      entries.push({ id: selfNorm, name: Store.normalizePlayerName(selfName), level: PH.computeSimulatedJugadorLevel(history, selfName), isMe: true, locality: null });
    }
    return entries;
  }

  function bandForLevel(level) {
    return Math.max(1, Math.min(10, Math.floor(level)));
  }

  function stableHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** ⚠️ APROXIMACIÓN MOCK EXCLUSIVA DE V03.5 — leer antes de tocar.
   *
   *  PH.computeSimulatedJugadorLevel (usada por TODO el prototipo, no solo Ranking) ya
   *  redondea a un decimal cuando no hay partidos reales — nunca guarda los "cuatro
   *  decimales" que Ranking_BRAMU.md (§5.1/§13.2) da por hecho para que "la igualdad exacta
   *  sea poco frecuente". Con un universo mock de decenas/cientos de jugadores repartido en
   *  solo ~46 valores posibles (rango 3,0–7,5 de la función), ese redondeo produciría empates
   *  masivos de 5-10 jugadores por puesto — no "poco frecuentes" como describe el documento.
   *  `sortNudge` simula esa precisión interna faltante: un decimal extra estable por jugador
   *  (0,00–0,0499, nunca cruza el redondeo a un decimal) que SOLO se usa para desempatar el
   *  ORDEN — el Nivel BRAMU mostrado (`entry.level`, sin tocar) sigue siendo exactamente el
   *  mismo número que ve Buscar Jugadores/Perfil público para esa persona.
   *
   *  Límites duros de esta función (no negociables mientras exista):
   *  - NUNCA toca ni llama a PH.computeSimulatedJugadorLevel ni ningún cálculo de Nivel BRAMU.
   *  - El valor que devuelve (`points`) es un desempate de ORDEN, no un Nivel: nunca se
   *    muestra en pantalla, nunca se guarda en Store, nunca sale de `rankEntries`/
   *    `computeWeeklyMovement` hacia otro módulo (app.js solo lee `entry.level`/`.position`).
   *  - Es enteramente local a esta capa mock de Ranking — no es información deportiva real.
   *
   *  Cuándo desaparece: cuando exista el Nivel BRAMU consolidado interno REAL (con su propia
   *  precisión de cuatro decimales — V04+), `rankEntries` debe ordenar directamente por ese
   *  valor consolidado y esta función completa (`stableHash`/`sortNudge`) se elimina, no se
   *  adapta ni se reutiliza para otra cosa. */
  function sortNudge(id) {
    return (stableHash(id + '::bramu-ranking-sortnudge') % 500) / 10000;
  }

  /* ------------------------------------------------------------------ */
  /* ORDENAMIENTO — Ranking_BRAMU.md §5.1: Nivel interno exacto desc,     */
  /* empate exacto comparte puesto ("1, 1, 3"), un id estable solo fija   */
  /* el orden TÉCNICO del array, nunca rompe el empate visible.           */
  /* ------------------------------------------------------------------ */
  function rankEntries(entries) {
    const withPoints = (entries || []).map((e) => {
      const displayLevel = Math.round(e.level * 10) / 10;
      return Object.assign({}, e, { points: displayLevel + sortNudge(e.id) });
    });
    const sorted = withPoints.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    // PG.assignPositions (BRAMUlab_V03.4) ya implementa exactamente esta regla de
    // competición sobre `.points` — se reutiliza tal cual en vez de duplicarla acá.
    return PG.assignPositions(sorted);
  }

  function bandFilter(entries, band) {
    return (entries || []).filter((e) => bandForLevel(e.level) === band);
  }

  /* ------------------------------------------------------------------ */
  /* MOVIMIENTO SEMANAL SIMULADO — Ranking_BRAMU.md §8.2/§18: compara el  */
  /* puesto actual contra el de un corte semanal anterior, nunca un       */
  /* semáforo rojo/verde de éxito o fracaso.                              */
  /* ------------------------------------------------------------------ */
  /** Nivel "de la semana pasada" determinístico: mismo id, mismo jitter, siempre — nunca
   *  Math.random/Date.now. Rango acotado (±0.4) para que el movimiento semanal se sienta
   *  creíble (pocos puestos), no un reordenamiento completo del universo. */
  function priorWeekLevel(entry) {
    const h = stableHash(entry.id + '::bramu-ranking-prevweek');
    const jitter = ((h % 81) - 40) / 100; // -0.40 .. +0.40
    return entry.level - jitter;
  }

  /** Devuelve un Map id → { delta, label }. `delta` > 0 significa que subió puestos (el
   *  número de puesto bajó). Etiquetas "↑N" / "↓N" / "—" — mismo guion largo que ya usa el
   *  resto de la app para "sin dato/sin cambio". Adrede sin color propio por dirección (§18:
   *  "evitar tratamiento visual rojo/verde asociado a éxito o fracaso") — eso lo decide el CSS
   *  de la fila (un único tono neutro para las tres variantes), nunca esta función. */
  function computeWeeklyMovement(universe) {
    const current = rankEntries(universe);
    const priorSource = (universe || []).map((e) => Object.assign({}, e, { level: priorWeekLevel(e) }));
    const prior = rankEntries(priorSource);
    const priorPositionById = new Map(prior.map((e) => [e.id, e.position]));
    const map = new Map();
    current.forEach((e) => {
      const priorPos = priorPositionById.get(e.id);
      if (priorPos == null) { map.set(e.id, { delta: null, label: '—' }); return; }
      const delta = priorPos - e.position;
      map.set(e.id, { delta, label: delta === 0 ? '—' : (delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`) });
    });
    return map;
  }

  /* ------------------------------------------------------------------ */
  /* BÚSQUEDA — por nombre visible o @usuario, dentro del universo activo */
  /* (§13: nunca modifica el cálculo del ranking, solo qué filas se ven). */
  /* ------------------------------------------------------------------ */
  function filterEntriesBySearch(rankedEntries, query, usernameById) {
    const q = Store.normalizePlayerName(query || '').toLocaleLowerCase('es');
    if (!q) return rankedEntries;
    return (rankedEntries || []).filter((e) => {
      const nameHit = Store.normalizePlayerName(e.name).toLocaleLowerCase('es').includes(q);
      const handle = ((usernameById && usernameById.get(e.id)) || '').replace(/^@/, '').toLocaleLowerCase('es');
      const handleHit = !!handle && handle.includes(q.replace(/^@/, ''));
      return nameHit || handleHit;
    });
  }

  /* ------------------------------------------------------------------ */
  /* CERCA TUYO — 2 arriba / self / 2 abajo (§10).                        */
  /* ------------------------------------------------------------------ */
  function buildNearbyWindow(rankedEntries, myId, radius) {
    const idx = (rankedEntries || []).findIndex((e) => e.id === myId);
    if (idx === -1) return [];
    const r = radius == null ? 2 : radius;
    return rankedEntries.slice(Math.max(0, idx - r), Math.min(rankedEntries.length, idx + r + 1));
  }

  /* ------------------------------------------------------------------ */
  /* PAGINACIÓN — bloques de 50 (§12): nunca cargar cientos de filas      */
  /* desde el inicio; "Verme en la clasificación" salta directo al bloque */
  /* que contiene la posición del usuario.                                */
  /* ------------------------------------------------------------------ */
  function blockForPosition(position) {
    return Math.max(1, Math.ceil(position / BLOCK_SIZE));
  }

  function paginate(rankedEntries, loadedBlocks) {
    return (rankedEntries || []).slice(0, (loadedBlocks || 1) * BLOCK_SIZE);
  }

  /* ======================================================================
     BRAMUlab_V03.5 (Bloque 3) — ESTADOS DE PRODUCTO
     Fuente funcional cerrada: docs/BRAMUlab/Ranking_BRAMU.md (§6/§7/§10.2/§11/§17) y
     BRAMUlab_V03.5.md (§15/§16/§17). Toda esta sección calcula estados a partir de datos
     REALES ya existentes en el prototipo (partidos, calibración, cuenta) — nunca inventa
     historia ni fabrica motivos de exclusión para terceros (§ "estados propios" del pedido
     de Bloque 3: privado para el usuario actual, sin exponer nada ajeno).
     ====================================================================== */

  const INACTIVITY_DAYS = 180; // Ranking_BRAMU.md §7.2/§21 regla 6
  // Regla de calibración CERRADA (Ranking_BRAMU.md, Caso 4): el jugador entra recién cuando
  // completa el quinto partido computable Y el tercer rival diferente — las dos condiciones a
  // la vez, nunca la cantidad de partidos sola.
  const MIN_DISTINCT_RIVALS = 3;

  /** Suma a `set` los rivales de UN partido computable, con la MISMA definición de "rival" que
   *  ya usa el resto del prototipo: `evolution.points[i].rivals` viene armado por
   *  computeLevelEvolution con PH.getOpponentNames (nunca una lista propia acá), y se excluyen
   *  los jugadores placeholder (invitados sin cuenta) con Store.isPlaceholderPlayerName — el
   *  mismo criterio que ya usa PH.computeRivalBreakdown para "Rival más enfrentado". */
  function addDistinctRivals(set, rivals) {
    (rivals || []).forEach((name) => {
      if (name && !Store.isPlaceholderPlayerName(name)) set.add(Store.normalizePlayerName(name));
    });
  }

  /** Recorre los partidos computables en orden cronológico (evolution.points, más viejo
   *  primero) y devuelve el índice del que completa la calibración — el primer partido en el
   *  que YA van 5 computables acumulados Y 3 rivales distintos acumulados, a la vez — o -1 si
   *  ninguno de los partidos existentes alcanza esa combinación todavía. Necesario porque el
   *  partido que completa cada condición puede no ser el mismo: alguien puede llegar a 5
   *  partidos con solo 2 rivales distintos y recién calibrar bastante después, en el partido
   *  donde aparece su tercer rival — nunca automáticamente "en el partido número 5". */
  function findCalibrationCompletionIndex(points) {
    const rivals = new Set();
    for (let i = 0; i < points.length; i++) {
      addDistinctRivals(rivals, points[i].rivals);
      if (i + 1 >= PH.CALIBRATION_THRESHOLD && rivals.size >= MIN_DISTINCT_RIVALS) return i;
    }
    return -1;
  }

  /** PH.buildCalibrationStatus (sin tocar — sigue siendo la única fuente del progreso de
   *  PARTIDOS que ya usa el Home) más la condición de rivales distintos que Ranking necesita
   *  para decidir elegibilidad. Con 5+ partidos pero menos de 3 rivales, el texto de partidos
   *  a solas ("5 / 5 PARTIDOS") se leería como calibración completa cuando NO lo está — ahí se
   *  reemplaza por un texto que nombra el motivo real. */
  function buildCalibrationProgress(consideredCount, distinctRivals) {
    const base = PH.buildCalibrationStatus(consideredCount);
    if (consideredCount < PH.CALIBRATION_THRESHOLD) {
      return Object.assign({}, base, { complete: false, distinctRivals, minDistinctRivals: MIN_DISTINCT_RIVALS });
    }
    const complete = distinctRivals >= MIN_DISTINCT_RIVALS;
    return Object.assign({}, base, {
      complete,
      distinctRivals,
      minDistinctRivals: MIN_DISTINCT_RIVALS,
      progressText: complete ? base.progressText : `${consideredCount} PARTIDOS · ${distinctRivals} / ${MIN_DISTINCT_RIVALS} RIVALES`,
    });
  }

  /** Estado de participación de UN jugador (self o compañero de Mis jugadores), calculado
   *  SIEMPRE desde partidos reales — nunca aplicado a los jugadores mock territoriales (esos
   *  representan población YA elegible por construcción, ver buildScopeUniverseNames/§21: no
   *  tiene sentido "calibrarlos", no tienen historial que leer).
   *  `playerRef`: nombre plano o `{name,userId}` — identidad por userId cuando existe (self,
   *  vía computeSelfStatus) y por nombre normalizado como fallback legacy (compañeros de Mis
   *  jugadores sin cuenta propia en este dispositivo), mismo criterio que el resto de PH/ML.
   *  Devuelve `{ key: 'sin-nivel'|'calibrando'|'inactivo'|'elegible', calib, level?, isNew? }`.
   *  `isNew` (solo con key 'elegible') cubre los casos 4 y 7 del documento (fin de
   *  calibración / reingreso tras inactividad): ambos se muestran igual, como "Nuevo" en el
   *  movimiento semanal (§7.3/§8.2 — el documento no los distingue visualmente). */
  function computeParticipantStatus(playerRef, history, nowDate) {
    // Mismo criterio que ya usa app.js (renderPlayerHome, etc.): computeLevelEvolution recibe
    // los partidos YA filtrados por jugador — nunca el historial completo sin filtrar.
    const matches = PH.filterMatchesForPlayer(history, playerRef);
    const evolution = PH.computeLevelEvolution(matches, playerRef);
    // "Último partido COMPUTABLE validado" (§7.2/§21 regla 6) — `evolution.points` ya viene
    // filtrado a solo los partidos que cuentan para el Nivel (isMatchConsideredForLevel),
    // ordenado del más viejo al más nuevo; nunca `matches` crudo, que incluye cualquier
    // partido donde jugó aunque no haya afectado su Nivel. Cada punto ya trae sus propios
    // `rivals` (PH.getOpponentNames) — se reutilizan tal cual, nunca se recalculan.
    const points = evolution.points;
    const rivalsAll = new Set();
    points.forEach((p) => addDistinctRivals(rivalsAll, p.rivals));
    const calib = buildCalibrationProgress(evolution.consideredCount, rivalsAll.size);

    if (evolution.consideredCount === 0) return { key: 'sin-nivel', calib };
    if (!calib.complete) return { key: 'calibrando', calib };

    const now = nowDate || new Date();
    const last = points[points.length - 1];
    const lastPlayedTime = last.playedAt ? new Date(last.playedAt).getTime() : null;
    const daysSinceLast = lastPlayedTime != null ? Math.floor((now.getTime() - lastPlayedTime) / 86400000) : Infinity;
    if (daysSinceLast > INACTIVITY_DAYS) return { key: 'inactivo', calib, daysSinceLast };
    // Caso 4 — "fin de calibración": el ÚLTIMO partido computable es justo el que cumplió las
    // dos condiciones a la vez (nunca simplemente "el quinto partido" — ver
    // findCalibrationCompletionIndex).
    let isNew = findCalibrationCompletionIndex(points) === points.length - 1;
    // Caso 7 — "reingreso": el hueco ANTES del último partido computable superaba 180 días.
    if (!isNew && points.length >= 2 && lastPlayedTime != null) {
      const prev = points[points.length - 2];
      const prevTime = prev.playedAt ? new Date(prev.playedAt).getTime() : null;
      if (prevTime != null && Math.floor((lastPlayedTime - prevTime) / 86400000) > INACTIVITY_DAYS) isNew = true;
    }
    return { key: 'elegible', calib, level: evolution.current, isNew };
  }

  /** Estado de participación del usuario ACTUAL, con las dos condiciones adicionales que solo
   *  aplican a self en ámbitos territoriales: ubicación declarada y (cuando existan) perfil
   *  público/opt-in de Ranking.
   *
   *  `user.rankingOptOut`/`user.isPublicProfile` — BRAMUlab_V03.5 (Bloque 3): estos dos campos
   *  TODAVÍA NO existen en el modelo de cuenta (Store.createUserAccount) ni tienen ningún
   *  control en Perfil/MIS DATOS — nadie puede activarlos hoy. La función ya los lee (si en el
   *  futuro Perfil agrega ese toggle, esto se activa solo, sin tocar Ranking) pero mientras no
   *  existan, `user.rankingOptOut` es siempre `undefined` y `user.isPublicProfile` siempre
   *  distinto de `false` → ninguno de los dos estados es alcanzable desde la UI real todavía
   *  (sí están cubiertos por tests, ver tests.html). No se agregó ese toggle a Perfil en este
   *  bloque a propósito — el pedido fue representar los ESTADOS de Ranking, no diseñar
   *  Privacidad; §"No tocar" del Bloque 3 excluye tocar Perfil fuera de integraciones ya
   *  existentes. */
  function computeSelfStatus(user, history, isTerritorialScope, nowDate) {
    if (user && user.rankingOptOut === true) return { key: 'opt-out' };
    if (user && user.isPublicProfile === false) return { key: 'perfil-privado' };
    const ref = user ? { name: user.displayName, userId: user.id } : null;
    const base = ref ? computeParticipantStatus(ref, history, nowDate) : { key: 'sin-nivel', calib: buildCalibrationProgress(0, 0) };
    if (base.key === 'elegible' && isTerritorialScope && (!user || !user.locality)) {
      return Object.assign({}, base, { key: 'sin-ubicacion' });
    }
    return base;
  }

  /* ------------------------------------------------------------------ */
  /* DENSIDAD — Ranking_BRAMU.md §11 (territorial) y §10.2 (Mis jugadores, */
  /* umbrales DISTINTOS — nunca los mismos 5/15).                          */
  /* ------------------------------------------------------------------ */

  /** 0–4: sin posiciones. 5–14: en formación (con denominador, sin podio). 15+: establecido. */
  function computeTerritorialDensity(count) {
    if (count <= 4) return { level: 'insufficient', missing: Math.max(0, 5 - count) };
    if (count <= 14) return { level: 'forming' };
    return { level: 'established' };
  }

  /** 0: vacío. 1–2: comparación simple, SIN "N de total" (§10.2). 3+: "N de total" habilitado. */
  function computeMisJugadoresDensity(count) {
    if (count <= 0) return { level: 'empty' };
    if (count <= 2) return { level: 'simple' };
    return { level: 'established' };
  }

  /** §17/Caso 18 — Global recién se desbloquea con elegibles en 2+ países. Este prototipo es
   *  enteramente de Argentina (dataset mock de locations.js, únicos usuarios reales posibles
   *  también locales) — nunca existe un segundo país real que lo justifique. Constante
   *  explícita (no una función que "podría" devolver true) para que sea imposible simular un
   *  desbloqueo que el documento prohíbe expresamente mientras esa condición no se cumpla. */
  const GLOBAL_UNLOCKED = false;

  global.PLRanking = {
    BLOCK_SIZE,
    MOCK_SCOPE_CONFIG,
    buildScopeUniverseNames,
    buildRankingEntries,
    bandForLevel,
    rankEntries,
    bandFilter,
    computeWeeklyMovement,
    filterEntriesBySearch,
    buildNearbyWindow,
    blockForPosition,
    paginate,
    INACTIVITY_DAYS,
    MIN_DISTINCT_RIVALS,
    computeParticipantStatus,
    computeSelfStatus,
    computeTerritorialDensity,
    computeMisJugadoresDensity,
    GLOBAL_UNLOCKED,
  };
})(typeof window !== 'undefined' ? window : globalThis);
