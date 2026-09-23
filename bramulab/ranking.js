/* ==========================================================================
   BRAMU Lab — ranking.js (BRAMUlab_V03.5, Bloques 2 y 3; refinado en V03.5.1:
   "Mis jugadores"→"Mi red" con ventana de 180 días, género, Cerca tuyo
   removido; V03.5.2: Ranking pasa de continuo a SEMANAL — snapshot simulado
   vía historySnapshotAsOf/computeRankingWeekPeriod, movimiento real entre dos
   ediciones en vez del jitter simulado que usaba computeWeeklyMovement)
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
  /* BRAMUlab_V03.5.2 — RANKING SEMANAL (Ranking_BRAMU.md §4, cambio       */
  /* normativo de la revisión del 11/09/2026): Ranking deja de ser        */
  /* continuo y pasa a publicarse una vez por semana. Nivel BRAMU sigue   */
  /* siendo dinámico — esta sección NUNCA calcula Nivel, solo recorta EN  */
  /* QUÉ INSTANTE se "lee" ese Nivel para congelar una edición semanal.   */
  /* ------------------------------------------------------------------ */
  const RANKING_TIMEZONE = 'America/Argentina/Buenos_Aires';
  // Argentina no usa horario de verano desde 2009 — un offset fijo de -180min es exacto para
  // el V1 conceptual del documento. Si alguna vez volviera a existir DST acá, este offset fijo
  // dejaría de alcanzar y habría que resolverlo con una librería de tz real (backend, no V1).
  const RANKING_TZ_OFFSET_MINUTES = -180;
  const DAY_MS = 86400000;
  const WEEK_MS = 7 * DAY_MS;

  /** Mismo instante, expresado como si el reloj fuera el de Buenos Aires — SOLO para leer
   *  campos `getUTC*()` con el día/hora que corresponde allá, nunca para construir un Date que
   *  se use directamente como instante real (ver computeRankingWeekStart, que deshace este
   *  corrimiento antes de devolver el resultado). */
  function toBuenosAiresShifted(date) {
    return new Date(date.getTime() + RANKING_TZ_OFFSET_MINUTES * 60000);
  }

  /** Lunes 00:00:00 (hora de Buenos Aires) de la semana que contiene `date` — como instante
   *  UTC real, listo para comparar con cualquier timestamp guardado (`playedAt`/`createdAt`,
   *  siempre ISO UTC en este prototipo). */
  function computeRankingWeekStart(date) {
    const shifted = toBuenosAiresShifted(date);
    const dow = shifted.getUTCDay(); // 0=domingo..6=sábado, leído en el reloj ya corrido a BA
    const daysSinceMonday = (dow + 6) % 7;
    const mondayShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysSinceMonday, 0, 0, 0, 0);
    return new Date(mondayShifted - RANKING_TZ_OFFSET_MINUTES * 60000);
  }

  /** Ranking_BRAMU.md §4.1 — semana de Ranking: lunes 00:00:00 a domingo 23:59:59.999, ambos
   *  como instantes reales (no strings) para poder comparar directo con timestamps. */
  function computeRankingWeekPeriod(date) {
    const start = computeRankingWeekStart(date || new Date());
    const end = new Date(start.getTime() + WEEK_MS - 1);
    return { start, end };
  }

  function computePreviousRankingWeekPeriod(date) {
    const current = computeRankingWeekPeriod(date || new Date());
    return { start: new Date(current.start.getTime() - WEEK_MS), end: new Date(current.end.getTime() - WEEK_MS) };
  }

  const WEEKDAY_ABBR_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MONTH_ABBR_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /** §3/§13.5 — "Lun 31 ago", leído del calendario de Buenos Aires (nunca el del dispositivo:
   *  cerca de medianoche podrían no coincidir). */
  function formatRankingPeriodDay(instant) {
    const shifted = toBuenosAiresShifted(instant);
    const wd = WEEKDAY_ABBR_ES[shifted.getUTCDay()];
    const dd = String(shifted.getUTCDate()).padStart(2, '0');
    const mon = MONTH_ABBR_ES[shifted.getUTCMonth()];
    return `${wd} ${dd} ${mon}`;
  }

  /** §3/§13.5 — "Lun 31 ago — Dom 06 sep" (sin el prefijo "Ranking semanal ·": app.js decide
   *  dónde y cómo antepone esa etiqueta fija). */
  function formatRankingWeekRangeLabel(period) {
    return `${formatRankingPeriodDay(period.start)} — ${formatRankingPeriodDay(period.end)}`;
  }

  /** §4.3/Caso 2 — "quedó computable" se mide por cuándo el registro ENTRÓ al sistema
   *  (`createdAt`, la única fecha de procesamiento que ya existía en el prototipo — ver
   *  Etapa 3 §5.2 en player-home.js/app.js), nunca por `playedAt` (fecha efectiva, puede ser
   *  anterior al alta si se cargó un partido ya jugado). Un partido jugado el domingo a la
   *  noche pero recién guardado el lunes tiene `createdAt` DESPUÉS del corte → no entra en la
   *  edición que ya cerró, entra en la siguiente (exactamente el Caso 2 del documento). Los
   *  partidos sin `createdAt` (datos legacy/de prueba) caen de vuelta a `playedAt` — nunca se
   *  descartan silenciosamente por falta de un campo que la mayoría de los registros sí tiene. */
  function historySnapshotAsOf(history, cutoffDate) {
    const cutoff = cutoffDate instanceof Date ? cutoffDate.getTime() : new Date(cutoffDate).getTime();
    return (history || []).filter((m) => {
      const recordedAt = (m && m.createdAt) || PH.getPlayedAt(m);
      const t = recordedAt ? new Date(recordedAt).getTime() : null;
      return t != null && t < cutoff;
    });
  }

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

  /** BRAMUlab_V03.5.1 (§4) — género de un jugador mock: derivado del primer nombre (los 26
   *  nombres de MOCK_FIRST_NAMES ya son nombres de pila reales en español, cada uno con un
   *  género convencional inequívoco — no es una suposición nueva, es el mismo nombre que ya se
   *  venía usando). Nunca se le asigna género a una persona real por su nombre: para self/Mi
   *  red siempre se lee (o no) el género DECLARADO en la cuenta, ver buildRankingEntries. */
  const MOCK_FIRST_NAME_GENDER = {
    'Agustín': 'masculino', 'Diego': 'masculino', 'Fabián': 'masculino', 'Hernán': 'masculino',
    'Joaquín': 'masculino', 'Leandro': 'masculino', 'Nicolás': 'masculino', 'Pablo': 'masculino',
    'Santiago': 'masculino', 'Tomás': 'masculino', 'Walter': 'masculino', 'Bruno': 'masculino',
    'Bianca': 'femenino', 'Camila': 'femenino', 'Elena': 'femenino', 'Gabriela': 'femenino',
    'Inés': 'femenino', 'Karina': 'femenino', 'Micaela': 'femenino', 'Olivia': 'femenino',
    'Rocío': 'femenino', 'Valentina': 'femenino', 'Ximena': 'femenino', 'Yamila': 'femenino',
    'Zoe': 'femenino', 'Carla': 'femenino',
  };
  function mockGenderForName(fullName) {
    const first = (fullName || '').split(' ')[0];
    return MOCK_FIRST_NAME_GENDER[first] || 'masculino';
  }

  /** BRAMUlab_V03.6 (hotfix — bug real §1) — único punto de resolución de cuenta real por
   *  nombre visible, reutilizado para Nivel/ubicación/género de CUALQUIER entrada (self
   *  incluido): antes esta búsqueda vivía duplicada solo dentro de `resolveAccountGender`, y
   *  `buildRankingEntries` nunca la usaba para decidir la IDENTIDAD de consulta del Nivel de un
   *  jugador real no-self (ver comentario de `buildRankingEntries` más abajo). `null` si el
   *  nombre no tiene ninguna cuenta local resoluble (jugador mock/territorial, o rival conocido
   *  solo por historial, nunca registrado). */
  function resolveRealAccountByName(name) {
    const norm = Store.normalizePlayerName(name);
    if (!norm) return null;
    return (Store.loadUsers() || []).find((u) => u && Store.normalizePlayerName(u.displayName) === norm) || null;
  }

  /** Género DECLARADO de una cuenta real (self o compañero de Mi red con cuenta local en este
   *  dispositivo) — nunca inventado. `null` si la persona no tiene cuenta encontrable o nunca
   *  declaró género: esa fila simplemente no entra en ninguna clasificación segmentada por
   *  género (§4, "no mostrar ambos mezclados" — no hay un tercer balde "sin declarar"). */
  function resolveAccountGender(name) {
    const account = resolveRealAccountByName(name);
    const g = account && account.gender;
    return (g === 'masculino' || g === 'femenino') ? g : null;
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
   *  inventa ciudades nuevas), simplemente la cicla por índice dentro de `pool` (ver
   *  scopeLocalityPool, BRAMUlab_V03.7). Local no la necesita (todas las filas comparten la
   *  misma localidad, sería redundante repetirla). */
  function mockLocalityAt(pool, index) {
    if (!pool || !pool.length) return '';
    return PLLoc.formatLocationLabel(pool[index % pool.length]);
  }

  /** BRAMUlab_V03.7 — BUG REAL DE PRODUCCIÓN corregido acá: antes `mockLocalityAt` ciclaba
   *  SIEMPRE sobre `PLLoc.LOCATIONS` completo (~180 localidades de TODO el país) sin importar
   *  el ámbito que se estaba mostrando — un usuario de Bella Vista veía en `Local` una mezcla
   *  de Villa Urquiza/Villa Devoto/Bella Vista, y en `Provincial` aparecían filas de CABA y
   *  hasta de Córdoba. Ranking_BRAMU.md §8 exige jerarquía estricta país/provincia/localidad,
   *  nunca agrupamiento por substring ni universos que contradigan el ámbito mostrado.
   *
   *  Esta función arma el POOL de localidades del que `mockLocalityAt` puede samplear, coherente
   *  con el ámbito:
   *  - `local`: únicamente la localidad exacta de `userLoc` (todas las filas comparten
   *    localidad/provincia/país — nunca se "agrupan" localidades vecinas, §8.1).
   *  - `provincial`: todas las localidades de locations.js que comparten `region` Y `country`
   *    con `userLoc`. El dataset ya distingue "CABA" de "Buenos Aires" como valores de `region`
   *    DISTINTOS (nunca se tratan como equivalentes por contener el texto "Buenos Aires"), así
   *    que un usuario de Provincia de Buenos Aires nunca recibe una fila de CABA acá.
   *  - `pais`: todas las localidades que comparten `country` con `userLoc` (en este dataset,
   *    100% Argentina — por eso Provincia de Buenos Aires + CABA + Córdoba conviven en País,
   *    tal como pide §8.3).
   *  - `global` (o sin `userLoc.country`, ej. cuenta sin ubicación cargada todavía): el dataset
   *    completo, comportamiento previo sin cambios — nunca se rompe el ámbito por falta de dato.
   *
   *  Comparación siempre por CAMPO ESTRUCTURADO (`region`/`country` exactos), nunca por
   *  substring ni coincidencia parcial de texto. */
  function scopeLocalityPool(scopeKey, userLoc) {
    const all = (PLLoc && PLLoc.LOCATIONS) || [];
    if (!userLoc || !userLoc.country) return all;
    if (scopeKey === 'local') {
      return userLoc.locality ? [{ locality: userLoc.locality, region: userLoc.region, country: userLoc.country }] : all;
    }
    if (scopeKey === 'provincial') {
      if (!userLoc.region) return all;
      const pool = all.filter((l) => l.country === userLoc.country && l.region === userLoc.region);
      return pool.length ? pool : all;
    }
    if (scopeKey === 'pais') {
      const pool = all.filter((l) => l.country === userLoc.country);
      return pool.length ? pool : all;
    }
    return all;
  }

  /** `assignMockLocality` acepta: `false`/`undefined` (nunca asignar localidad mock — Mi red),
   *  `true` (legacy: samplear de TODO `PLLoc.LOCATIONS`, comportamiento previo a V03.7, usado
   *  todavía por tests que no necesitan un ámbito específico), o un ARRAY ya filtrado por
   *  `scopeLocalityPool` (el pool coherente con el ámbito real que se está mostrando). */
  function resolveMockLocalityPool(assignMockLocality) {
    if (Array.isArray(assignMockLocality)) return assignMockLocality;
    if (assignMockLocality) return (PLLoc && PLLoc.LOCATIONS) || [];
    return null;
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
   *  buildScopeUniverseNames): nombres SIN cuenta real detrás siguen recibiendo una localidad
   *  simulada ahí (nunca en Mi red/Local, §11.1). BRAMUlab_V03.6 (hotfix — bug real §1/§3):
   *  esto es aparte de la ubicación REAL de una cuenta real (self o compañero con cuenta
   *  local), que ahora se resuelve siempre que exista, en cualquier ámbito — nunca se le
   *  inventa una localidad mock a alguien con cuenta real, pero tampoco se le sigue negando la
   *  suya propia si la declaró (bug real encontrado en la prueba de Sebastián: "Seba aparece
   *  sin ubicación" — self nunca leía su propia `locality` acá). */
  /** `selfGender` — género EFECTIVO de self para Ranking (ya resuelto por app.js, con su
   *  propio fallback si el usuario no lo declaró — ver renderRankingScreen/rankingGenderFilter
   *  en app.js): a diferencia de terceros, self siempre debe poder verse a sí mismo. */
  /** `selfUserId` — BRAMUlab_V03.5.2, bug real: una vez que self jugó su primer partido,
   *  `store.js` estampa `userId` en su propia fila de `players[]` (regla de integridad ya
   *  vigente desde V03.0 — ver stampPlayersWithUserId). Por esa MISMA regla, `PH.findPlayerRow`
   *  nunca encuentra esa fila con solo el nombre plano: un partido con `userId` estampado SOLO
   *  es hallable pasando ESE `userId` (nunca por nombre, aunque coincida). Con `selfUserId`
   *  presente se arma `{name, userId}` — mismo criterio que `currentIdentity()` en app.js.
   *  BRAMUlab_V03.6 (hotfix — bug real §1): el MISMO problema existía para cualquier jugador
   *  real NO-self — `resolveRealAccountByName(rawName)` ahora resuelve su cuenta (si existe) y
   *  arma `{name, userId: account.id}` para el Nivel, exactamente igual que ya se hacía solo
   *  para self. Un nombre sin cuenta real resoluble sigue usando el string plano tal cual — el
   *  fallback por hash de `computeSimulatedJugadorLevel` queda reservado exclusivamente a esos
   *  casos (jugadores mock/territoriales, rivales conocidos solo por historial). Sin
   *  `selfUserId` (tests existentes que no lo pasan) el comportamiento de self es idéntico al
   *  de antes; la resolución de terceros por cuenta real es incondicional (no depende de este
   *  parámetro). */
  function buildRankingEntries(names, history, selfName, assignMockLocality, selfGender, localityIndexOffset, selfUserId) {
    const selfNorm = Store.normalizePlayerName(selfName);
    const selfRef = selfUserId ? { name: selfName, userId: selfUserId } : selfName;
    const localityPool = resolveMockLocalityPool(assignMockLocality);
    const seen = new Set();
    const entries = [];
    let localityCursor = localityIndexOffset || 0;
    (names || []).forEach((rawName) => {
      const norm = Store.normalizePlayerName(rawName);
      if (!norm || seen.has(norm)) return;
      seen.add(norm);
      const isMe = norm === selfNorm;
      // BRAMUlab_V03.6 (hotfix — bug real §1) — resuelto para CUALQUIER entrada, self incluido:
      // antes solo self tenía este tratamiento (vía selfRef/selfUserId, arriba); un jugador real
      // no-self nunca resolvía su cuenta y caía siempre al fallback por hash.
      const account = resolveRealAccountByName(rawName);
      const identity = isMe ? selfRef : (account ? { name: rawName, userId: account.id } : rawName);
      const level = PH.computeSimulatedJugadorLevel(history, identity);
      const realLocality = (account && account.locality) ? PLLoc.formatLocationLabel(account) : null;
      entries.push({
        id: norm,
        name: isMe ? Store.normalizePlayerName(selfName) : rawName,
        level,
        isMe,
        // Real primero (self o cualquier cuenta real que la haya declarado); el mock territorial
        // queda exclusivamente para nombres SIN cuenta real resoluble, tal como ya era. El pool
        // (BRAMUlab_V03.7) ya viene coherente con el ámbito — ver scopeLocalityPool.
        locality: realLocality || ((localityPool && !isMe && !account) ? mockLocalityAt(localityPool, localityCursor++) : null),
        gender: isMe ? selfGender : (localityPool ? mockGenderForName(rawName) : resolveAccountGender(rawName)),
      });
    });
    if (selfNorm && !seen.has(selfNorm)) {
      const selfAccount = resolveRealAccountByName(selfName);
      const selfLocality = (selfAccount && selfAccount.locality) ? PLLoc.formatLocationLabel(selfAccount) : null;
      entries.push({ id: selfNorm, name: Store.normalizePlayerName(selfName), level: PH.computeSimulatedJugadorLevel(history, selfRef), isMe: true, locality: selfLocality, gender: selfGender });
    }
    return entries;
  }

  /** §4 — "no mostrar ambos mezclados en una única clasificación oficial": el filtro de
   *  género es SIEMPRE obligatorio (nunca hay un valor "todos"), a diferencia de la banda de
   *  Nivel. Quien no tiene género resoluble (`gender: null`, terceros sin cuenta o sin
   *  declarar) no entra en ninguna de las dos — nunca se lo asigna a un balde por defecto. */
  function filterByGender(entries, gender) {
    return (entries || []).filter((e) => e.gender === gender);
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
  /* MOVIMIENTO SEMANAL — Ranking_BRAMU.md §5/§18: compara DOS ediciones  */
  /* semanales reales (edición vigente vs. edición anterior equivalente,  */
  /* mismo universo/filtro) — nunca un semáforo rojo/verde de éxito o     */
  /* fracaso, y nunca puntos (§5: las flechas expresan PUESTOS). */
  /* ------------------------------------------------------------------ */
  /** `currentUniverse`/`previousUniverse`: ya filtrados por género/banda por el llamador — el
   *  Nivel de cada entrada debe venir de un `history` ya recortado al corte correspondiente
   *  (ver historySnapshotAsOf) para que "edición anterior" sea una edición semanal real y no un
   *  jitter simulado. Devuelve un Map id → { delta, label }. `delta` > 0 significa que subió
   *  puestos (el número de puesto bajó). Etiquetas "↑ N" / "↓ N" / "—" / "Nuevo" (§5: "Nuevo" =
   *  no existe comparación válida anterior — nunca "—", que significa "mismo puesto"). Adrede
   *  sin color propio por dirección (§18: "evitar tratamiento visual rojo/verde asociado a
   *  éxito o fracaso") — eso lo decide el CSS de la fila, nunca esta función. */
  function computeWeeklyMovement(currentUniverse, previousUniverse) {
    const current = rankEntries(currentUniverse);
    const prior = rankEntries(previousUniverse);
    const priorPositionById = new Map(prior.map((e) => [e.id, e.position]));
    const map = new Map();
    current.forEach((e) => {
      const priorPos = priorPositionById.get(e.id);
      if (priorPos == null) { map.set(e.id, { delta: null, label: 'Nuevo' }); return; }
      const delta = priorPos - e.position;
      map.set(e.id, { delta, label: delta === 0 ? '—' : (delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`) });
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
  /* MI RED — BRAMUlab_V03.5.1 §3.3: solo jugadores con al menos un        */
  /* partido COMPUTABLE compartido en los últimos 180 días (reemplaza      */
  /* "Mis jugadores"/ML.computeRecentPlayers, que no filtraba por fecha    */
  /* ni por computabilidad).                                               */
  /* ------------------------------------------------------------------ */
  const NETWORK_WINDOW_DAYS = 180;

  /** `selfRef`: nombre plano o `{name,userId}` (mismo criterio que el resto de PH). Devuelve
   *  nombres visibles únicos, en el orden en que aparecen (más reciente primero, ya que
   *  PH.filterMatchesForPlayer ya ordena así) — nunca incluye a self ni a jugadores
   *  placeholder (invitados sin cuenta), mismo criterio que ya usaba ML.computeRecentPlayers. */
  function computeNetworkNames(history, selfRef, nowDate) {
    const now = nowDate || new Date();
    const cutoff = now.getTime() - NETWORK_WINDOW_DAYS * 86400000;
    const selfNorm = Store.normalizePlayerName(typeof selfRef === 'object' && selfRef ? selfRef.name : selfRef);
    const matches = PH.filterMatchesForPlayer(history, selfRef);
    const seen = new Set();
    const result = [];
    matches.forEach((m) => {
      if (!PH.isMatchConsideredForLevel(m, selfRef)) return;
      const playedAt = PH.getPlayedAt(m);
      const t = playedAt ? new Date(playedAt).getTime() : null;
      if (t == null || t < cutoff) return;
      (m.players || []).forEach((p) => {
        if (!p || !p.name) return;
        if (Store.isPlaceholderPlayerName(p.name)) return;
        const norm = Store.normalizePlayerName(p.name);
        if (!norm || norm === selfNorm || seen.has(norm)) return;
        seen.add(norm);
        result.push(p.name);
      });
    });
    return result;
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

  /** 0: vacío. 1–2: comparación simple, SIN "N de total" (§10.2). 3+: "N de total" habilitado.
   *  Renombrada en V03.5.1 (era computeMisJugadoresDensity) — mismos umbrales, ahora para
   *  "Mi red". */
  function computeNetworkDensity(count) {
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

  /* ======================================================================
     BRAMUlab_V03.7 (parte B) — RANKING BRAMU EN PERFIL PÚBLICO
     Fuente funcional: Ranking_BRAMU.md (§8 ámbitos, §4 snapshot semanal). Reutiliza EXACTAMENTE
     la misma fuente/snapshot que la pantalla Ranking (buildScopeUniverseNames/
     scopeLocalityPool/buildRankingEntries/filterByGender/rankEntries/computeTerritorialDensity)
     — nunca una segunda lógica de Ranking. Las posiciones se calculan SIEMPRE respecto de la
     ubicación/género DEL JUGADOR DEL PERFIL, nunca de quien lo está mirando (§ pedido explícito
     de esta ronda).
     ====================================================================== */

  /** Posición de UN jugador real (`subjectName`/`subjectRef`) en un ámbito territorial, dentro
   *  del mismo universo mock + reglas que ya usa la pantalla Ranking. `null` si el ámbito no
   *  alcanza densidad suficiente (§11, 0-4 elegibles) o si el jugador no tiene género declarado
   *  (sin género resoluble no entra en ninguna clasificación segmentada, §11 — nunca se lo
   *  asigna a un balde por defecto). */
  function computeScopePosition(scopeKey, snapshotHistory, subjectRef, subjectName, subjectLoc, subjectGender) {
    if (!subjectGender) return null;
    const names = buildScopeUniverseNames(scopeKey);
    const pool = scopeLocalityPool(scopeKey, subjectLoc);
    const selfUserId = (subjectRef && typeof subjectRef === 'object') ? subjectRef.userId : undefined;
    const entries = buildRankingEntries(names, snapshotHistory, subjectName, pool, subjectGender, undefined, selfUserId);
    const universe = filterByGender(entries, subjectGender);
    const density = computeTerritorialDensity(universe.length);
    if (density.level === 'insufficient') return null;
    const ranked = rankEntries(universe);
    const norm = Store.normalizePlayerName(subjectName);
    const mine = ranked.find((e) => e.id === norm);
    if (!mine) return null;
    const territory = scopeKey === 'pais' ? subjectLoc.country : (scopeKey === 'provincial' ? subjectLoc.region : subjectLoc.locality);
    return { position: mine.position, total: ranked.length, territory: territory || '' };
  }

  /** Resumen de Ranking BRAMU para la tarjeta del Perfil público de `account` (cuenta real
   *  completa — self o cualquier otro jugador con cuenta, ver renderPlayerPublicRankingCard en
   *  app.js). Usa el mismo corte semanal que la pantalla Ranking (edición VIGENTE =
   *  `previousPeriod`, ver computeRankingView/periodLabel en app.js — nunca recalcula Nivel
   *  actual en vivo). Sin elegibilidad completa (calibrando, inactivo, sin ubicación, opt-out,
   *  perfil privado, sin género declarado) devuelve `scopes: null` — nunca puestos inventados. */
  function computeProfileRankingSummary(account, history, nowDate) {
    const now = nowDate || new Date();
    const period = computeRankingWeekPeriod(now);
    const previousPeriod = computePreviousRankingWeekPeriod(now);
    const periodLabel = formatRankingWeekRangeLabel(previousPeriod);
    const snapshotHistory = historySnapshotAsOf(history, period.start);
    const status = computeSelfStatus(account, snapshotHistory, true, period.start);
    const subjectGender = (account && (account.gender === 'masculino' || account.gender === 'femenino')) ? account.gender : null;
    if (status.key !== 'elegible' || !subjectGender) {
      return { periodLabel, status: status.key === 'elegible' ? { key: 'sin-genero' } : status, scopes: null };
    }
    const subjectRef = { name: account.displayName, userId: account.id };
    const scopes = {
      local: computeScopePosition('local', snapshotHistory, subjectRef, account.displayName, account, subjectGender),
      provincial: computeScopePosition('provincial', snapshotHistory, subjectRef, account.displayName, account, subjectGender),
      pais: computeScopePosition('pais', snapshotHistory, subjectRef, account.displayName, account, subjectGender),
    };
    return { periodLabel, status, scopes };
  }

  /* ======================================================================
     BRAMUlab_V03.8 — RANKING BRAMU EN TU MOMENTO (Home)
     Ranking_BRAMU.md §13.6: Home nunca duplica la clasificación territorial completa con otra
     tarjeta — como mucho aporta UN insight puntual dentro de TU MOMENTO. Reutiliza las mismas
     piezas que ya arma computeScopePosition/computeSelfStatus (nunca una tercera lógica de
     Ranking); la única pieza nueva acá es el DELTA entre la edición vigente y la anterior para
     el ámbito Local, que es la misma resta que ya usa computeWeeklyMovement internamente
     (`priorPos - position`) — no un cálculo de movimiento alternativo.
     ====================================================================== */

  /** Insight de Ranking para `TU MOMENTO` del Home — SIEMPRE ámbito Local (el ámbito por
   *  defecto/canónico de Ranking, §8), nunca "elige" el ámbito más favorable. `null` si no hay
   *  cuenta, no es elegible, no tiene género declarado o el ámbito Local no alcanza densidad —
   *  nunca se inventa una posición para poder mostrar algo. `isNew` reutiliza EXACTAMENTE el
   *  mismo criterio que ya usa `computeRankingView` (§ Caso 4/7 de Ranking_BRAMU.md,
   *  `selfStatus.isNew`) para decidir "Nuevo" — no una redefinición propia. `delta`: `null` si
   *  no hay edición anterior comparable (además de `isNew`, cubre el caso borde de density
   *  insuficiente la semana pasada); en ese caso Home no debe forzar un mensaje (§13.6, "sin
   *  movimiento"). */
  function computeHomeRankingInsight(account, history, nowDate) {
    const now = nowDate || new Date();
    const period = computeRankingWeekPeriod(now);
    const previousPeriod = computePreviousRankingWeekPeriod(now);
    const currentSnapshotHistory = historySnapshotAsOf(history, period.start);
    const status = computeSelfStatus(account, currentSnapshotHistory, true, period.start);
    if (status.key !== 'elegible') return null;
    const gender = (account && (account.gender === 'masculino' || account.gender === 'femenino')) ? account.gender : null;
    if (!gender) return null;
    const ref = { name: account.displayName, userId: account.id };
    const current = computeScopePosition('local', currentSnapshotHistory, ref, account.displayName, account, gender);
    if (!current) return null;
    if (status.isNew) {
      return { position: current.position, total: current.total, territory: current.territory, isNew: true, delta: null };
    }
    const previousSnapshotHistory = historySnapshotAsOf(history, previousPeriod.start);
    const previous = computeScopePosition('local', previousSnapshotHistory, ref, account.displayName, account, gender);
    const delta = previous ? previous.position - current.position : null;
    return { position: current.position, total: current.total, territory: current.territory, isNew: false, delta };
  }

  /* ======================================================================
     BACKEND BLOQUE 7 (Fase 5) — RANKING BRAMU REAL, SERVER-BACKED
     Único punto de contacto con las RPCs de lectura de Fase 3
     (supabase/migrations/20260922150000_bloque7_fase3_read_rpcs.sql) y con el wrapper de
     publicación semanal de Fase 4 (nunca invocado desde acá: pg_cron es exclusivamente
     server-side). Mismo criterio que auth.js/matches.js/match-validation.js: `isConfigured()`
     es la ÚNICA bisagra — sin backend real configurado, ninguna función de acá se llama nunca
     (app.js decide, ver computeRankingView), así que todo lo de arriba (universo mock/orden/
     movimiento local) sigue intacto para desarrollo sin backend. Con backend configurado
     (Staging/Production), Ranking real NUNCA cae a un fallback simulado (handoff Fase 5 §9): si
     una RPC falla, se devuelve `{ok:false, code}` y app.js muestra un estado de error real,
     nunca datos inventados.

     Todas las RPCs de acá devuelven `jsonb` ya armado en camelCase por el propio servidor (ver
     la migración) — a diferencia de otros módulos (matches.js), no hace falta ninguna
     traducción snake_case→camelCase en esta capa. */
  function isRemoteConfigured() {
    const Auth = global.PLAuth;
    return !!(Auth && Auth.isConfigured());
  }

  function getRemoteClient() {
    const Auth = global.PLAuth;
    return Auth ? Auth.getClient() : null;
  }

  /** `get_current_ranking_edition()` — última edición publicada, o `{edition:null}` explícito
   *  (handoff Fase 3 §3) si todavía no existe ninguna. Nunca inventa una edición. */
  async function getCurrentRankingEdition() {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_current_ranking_edition');
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data: data || { edition: null } };
  }

  /** `get_ranking_classification(...)` — clasificación paginada/buscable de Local/Provincial/
   *  País/Global (handoff Fase 3 §4/§5/§6/§11). `scope_key` SIEMPRE se resuelve server-side
   *  desde la fila propia del caller — este wrapper nunca acepta ni envía un territorio propio,
   *  solo `scopeType`. `band`/`search` `null` cuando no aplican (la RPC ya los trata como
   *  "sin filtro"/"sin búsqueda" con sus propios defaults). */
  async function getRankingClassification(scopeType, competitiveBranch, band, search, limit, offset) {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_ranking_classification', {
      p_scope_type: scopeType,
      p_competitive_branch: competitiveBranch,
      p_level_band: band == null ? null : band,
      p_search: search || null,
      p_limit: limit || 50,
      p_offset: offset || 0,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data };
  }

  /** `get_my_ranking_position(...)` — "Tu posición" real: puesto/total si existe, estado de
   *  elegibilidad propio (`reasonCodes`), movimiento vs. edición anterior comparable, ventana de
   *  contexto ±2 filas. Nunca inventa un puesto para un caller CALIBRANDO/sin ubicación/sin
   *  rama (handoff Fase 3 §8). */
  async function getMyRankingPosition(scopeType, band) {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_my_ranking_position', {
      p_scope_type: scopeType,
      p_level_band: band == null ? null : band,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data };
  }

  /** `get_ranking_network(...)` — "Mi red" real: propio + relaciones de partido computable de
   *  los últimos 180 días ANTERIORES al cutoff de la edición (nunca `now()`), umbral 1-2 sin
   *  puesto/3+ con puesto, excluye lo oculto. `competitiveBranch` explícito (`'F'`/`'M'`, nunca
   *  `null`): el selector de Ranking siempre tiene un valor efectivo — dejar que la RPC infiera
   *  la rama propia del caller es solo el comportamiento por defecto de la RPC para otros
   *  consumidores, no el de esta pantalla. */
  async function getRankingNetwork(competitiveBranch) {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_ranking_network', { p_competitive_branch: competitiveBranch || null });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data };
  }

  /** `set_ranking_network_hidden(...)` — ocultar/restaurar de Mi red (idempotente, presentación
   *  personal pura). Nunca toca partidos/Nivel/Ranking oficial ni al otro jugador. */
  async function setRankingNetworkHidden(hiddenPlayerId, hidden) {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { error } = await c.rpc('set_ranking_network_hidden', {
      p_hidden_player_id: hiddenPlayerId,
      p_hidden: !!hidden,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true };
  }

  /** `get_profile_ranking_summary(playerId)` — tarjeta territorial semanal de Perfil (propio o
   *  público, misma fuente — Ranking_BRAMU.md §15.1). SIEMPRE los ámbitos del jugador OBJETIVO,
   *  nunca de quien mira. */
  async function getProfileRankingSummary(playerId) {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_profile_ranking_summary', { p_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data };
  }

  /** `get_home_ranking_insight()` — TU MOMENTO real, ámbito Local por defecto (idéntico
   *  contrato que `getMyRankingPosition('local', null)`, la RPC del servidor literalmente lo
   *  reusa — ver la migración). */
  async function getHomeRankingInsight() {
    const c = getRemoteClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_home_ranking_insight');
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, data };
  }

  /** Traduce el `{status:'nuevo'|'movimiento', delta}` de las RPCs de Fase 3 al mismo shape
   *  `{delta, label}` que ya devuelve `computeWeeklyMovement` (local/mock) — así
   *  `rankingMovementClass`/`rankingMovementLongLabel` (app.js) funcionan sin cambios sobre
   *  cualquiera de las dos fuentes. */
  function mapServerMovement(mv) {
    if (!mv || mv.status === 'nuevo' || mv.delta == null) return { delta: null, label: 'Nuevo' };
    const delta = mv.delta;
    return { delta, label: delta === 0 ? '—' : (delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`) };
  }

  /** "Lun 31 ago — Dom 06 sep" a partir de instantes REALES del servidor (`periodStartAt`/
   *  `periodEndAt`, ISO) — reusa exactamente `formatRankingWeekRangeLabel` (arriba): esa función
   *  ya es pura sobre instantes `Date`, sin importar si vinieron de un cálculo local o de la
   *  edición real congelada por `compute_ranking_edition`. */
  function formatServerPeriodLabel(periodStartAt, periodEndAt) {
    if (!periodStartAt || !periodEndAt) return '';
    return formatRankingWeekRangeLabel({ start: new Date(periodStartAt), end: new Date(periodEndAt) });
  }

  /** Corrección F5-C01 de Fase 5 (bug real reproducido contra Staging con rollback,
   *  B7_F5_GEOREF_ID_LOSS_REPRODUCED_ROLLBACK_OK — ver 21_Correccion_Fase_5_Claude.md) —
   *  reconstruye el objeto de ubicación que el gate "Completar datos para Ranking"
   *  (openRankingGateModal, app.js) precarga desde una cuenta `serverBacked` ya cacheada.
   *  Extraída a una función pura y testeable (antes vivía inline en app.js, que no tiene
   *  cobertura unitaria por diseño): el bug real era exactamente esto — armar el objeto SIN
   *  `provinceId`/`localityId` cuando la cuenta ya tenía una ubicación GeoRef verificada, lo que
   *  hacía que `complete_ranking_profile_data` la reinterpretara como manual/no verificada al
   *  guardar solo rama/opt-in sin tocar el campo de ubicación. `user`: mismo shape que devuelve
   *  `Auth.fetchOwnProfile()`/`Store.getCurrentUser()` (`locality`, `region`, `country`,
   *  `locationGeorefProvinceId`, `locationGeorefLocalityId`). `null` sin ubicación cargada
   *  todavía — nunca se inventa una. */
  function buildGateLocationFromUser(user) {
    if (!user || !user.locality) return null;
    return {
      locality: user.locality,
      region: user.region || null,
      country: user.country || null,
      provinceId: user.locationGeorefProvinceId || null,
      localityId: user.locationGeorefLocalityId || null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Backend Bloque 8 (Fase E) — hitos materiales cerrados de Ranking     */
  /* para TU MOMENTO (BRAMU_Intelligence.md §13.3, handoff Bloque_08/     */
  /* 25_Handoff_Fase_E_Claude.md §8)                                      */
  /* ------------------------------------------------------------------ */

  // §13.3/§8 — universo mínimo, mejora mínima en puestos y "top" cerrados por la fuente.
  const RANKING_MILESTONE_MIN_UNIVERSE = 15;
  const RANKING_MILESTONE_MIN_IMPROVEMENT_PUESTOS = 3;
  const RANKING_MILESTONE_TOP = 10;

  function rankingAscentThreshold(total) {
    return Math.max(RANKING_MILESTONE_MIN_IMPROVEMENT_PUESTOS, Math.ceil(total * 0.05));
  }

  /** Clasifica el movimiento semanal de ESTE jugador (ámbito Local, el único que usa TU MOMENTO)
   *  contra los 5 hitos materiales CERRADOS de la fuente. Reusa/ajusta el camino server-backed ya
   *  existente (`getHomeRankingInsight`/`get_my_ranking_position`) — nunca crea una fuente
   *  paralela ni recalcula la clasificación de Ranking (handoff §8: "reusar/ajustar ese camino
   *  server-backed... sin recalcular la clasificación").
   *
   *  Revisión Central Fase E (E01): el universo mínimo (`total>=15`) corre ANTES de cualquier
   *  hito, INCLUIDA la primera entrada — antes corría después de un `if (insight.isNew) return
   *  true` que la saltaba por completo. Además, `movement.status==='nuevo'` (`insight.isNew`)
   *  significa "sin edición anterior comparable" (Bloque 7), NUNCA "nunca estuviste en este
   *  ranking" — puede ocurrir por reingreso tras inactividad o ruptura de comparabilidad. Por
   *  eso "primera entrada" ya no se afirma solo con `isNew`: exige además
   *  `bestPositionBefore === null` (el dato histórico agregado por la migración de Fase E dice
   *  explícitamente "nunca hubo una posición previa elegible"). Si el campo llega ausente
   *  (`undefined`, migración todavía no aplicada) o es un número real (sí hubo posición previa),
   *  nunca se afirma primera entrada — nunca se inventa.
   *
   *  `insight`: el objeto que arma `renderPlayerHome` (app.js) a partir de
   *  `get_home_ranking_insight` — `{position, total, territory, isNew, delta, bestPositionBefore,
   *  editionId, scopeType, scopeKey, levelPublic, levelBand, previousLevelPublic,
   *  previousLevelBand}`. `bestPositionBefore`/`levelBand`/`previousLevelPublic`/
   *  `previousLevelBand` requieren la extensión de `get_my_ranking_position` que esta ronda deja
   *  PREPARADA pero NO aplicada — mientras no exista, llegan `undefined` y los hitos que
   *  dependen de ellos simplemente nunca disparan, nunca se inventa un valor.
   *
   *  Ajusta, para este propósito puntual, la nota de UX más permisiva de Ranking_BRAMU.md §13.6
   *  ("movimiento negativo, tono neutro, siempre visible dentro de la tarjeta territorial
   *  completa de Ranking") — esa nota sigue vigente para la clasificación completa; lo que fija
   *  esta función es específicamente qué cuenta como HITO dentro de TU MOMENTO/Home, según la
   *  lista cerrada y más estricta de BRAMU_Intelligence.md §13.3. Ninguna caída de posición está
   *  en esa lista (los 5 casos cerrados son todos MEJORAS) — nunca genera un hito, sin importar
   *  la magnitud; cae al siguiente candidato de TU MOMENTO exactamente igual que "sin insight".
   *
   *  Devuelve `null` sin hito, o `{type, editionId, scopeType, scopeKey}` — `type` es uno de
   *  `'cambio_de_banda' | 'primera_entrada' | 'top10' | 'nueva_mejor_posicion' |
   *  'ascenso_material'`. Los 3 campos restantes son la clave de identidad del hito (Revisión
   *  Central Fase E, E02: "el insight que llega al Home debe incluir al menos editionId/
   *  scopeType/scopeKey/milestoneType") — `buildRankingMilestoneKey` los combina en la clave de
   *  memoria de "ya mostrado" (ver más abajo). */
  function classifyHomeRankingMilestone(insight) {
    if (!insight) return null;
    const total = insight.total;
    if (!Number.isFinite(total) || total < RANKING_MILESTONE_MIN_UNIVERSE) return null; // universo insuficiente — aplica a TODOS los hitos, incluida la primera entrada.

    // 5. cambio de banda pública de Nivel BRAMU (E04) — evento semanal de NIVEL, nunca
    // causalidad de un partido; se evalúa antes de los hitos de puesto porque no depende de
    // `isNew`/`delta` en absoluto. Ambas bandas deben venir de snapshots semanales PUBLICADOS
    // reales (la migración solo lee `ranking_editions.published_at is not null`) — nunca se
    // recalcula desde el estado en vivo.
    if (Number.isFinite(insight.levelBand) && Number.isFinite(insight.previousLevelBand)
      && insight.levelBand !== insight.previousLevelBand) {
      return rankingMilestoneOf('cambio_de_banda', insight);
    }

    if (insight.isNew) {
      // 1. primera entrada a un ranking establecido — SOLO si el histórico confirma que nunca
      // hubo una posición previa elegible (nunca solo por `movement.status==='nuevo'`).
      return insight.bestPositionBefore === null ? rankingMilestoneOf('primera_entrada', insight) : null;
    }
    const delta = insight.delta;
    if (!Number.isFinite(delta) || delta <= 0) return null; // solo mejoras cuentan como hito.
    const position = insight.position;
    const previousPosition = Number.isFinite(position) ? position + delta : null;
    if (Number.isFinite(position) && position <= RANKING_MILESTONE_TOP && previousPosition != null && previousPosition > RANKING_MILESTONE_TOP) {
      return rankingMilestoneOf('top10', insight); // 2. entrada al top 10 de un universo establecido.
    }
    if (Number.isFinite(insight.bestPositionBefore) && Number.isFinite(position)
      && position < insight.bestPositionBefore && (insight.bestPositionBefore - position) >= RANKING_MILESTONE_MIN_IMPROVEMENT_PUESTOS) {
      return rankingMilestoneOf('nueva_mejor_posicion', insight); // 3. nueva mejor posición, mejora >=3 puestos.
    }
    if (delta >= rankingAscentThreshold(total)) return rankingMilestoneOf('ascenso_material', insight); // 4. ascenso material (máx(3, 5% del universo)).
    return null;
  }

  function rankingMilestoneOf(type, insight) {
    return { type, editionId: insight.editionId || null, scopeType: insight.scopeType || 'local', scopeKey: insight.scopeKey || null };
  }

  /** Clave estable de "este hito ya se mostró" (Revisión Central Fase E, E02) —
   *  `ranking:<editionId>:<scopeType>:<scopeKey>:<type>`. `null` sin milestone (nada que
   *  recordar). Nunca incluye posición/nivel como verdad deportiva — es puramente un
   *  identificador de presentación, nunca autoridad. El llamador (app.js) la combina con el
   *  `userId` real antes de guardarla (`Store.markRankingMilestoneSeen`/`hasSeenRankingMilestone`)
   *  para que dos cuentas en el mismo navegador nunca comparan el mismo "ya visto". */
  function buildRankingMilestoneKey(milestone) {
    if (!milestone) return null;
    return `ranking:${milestone.editionId}:${milestone.scopeType}:${milestone.scopeKey}:${milestone.type}`;
  }

  global.PLRanking = {
    BLOCK_SIZE,
    RANKING_TIMEZONE,
    computeRankingWeekPeriod,
    computePreviousRankingWeekPeriod,
    formatRankingWeekRangeLabel,
    historySnapshotAsOf,
    MOCK_SCOPE_CONFIG,
    buildScopeUniverseNames,
    scopeLocalityPool,
    mockGenderForName,
    buildRankingEntries,
    filterByGender,
    bandForLevel,
    rankEntries,
    bandFilter,
    computeWeeklyMovement,
    filterEntriesBySearch,
    NETWORK_WINDOW_DAYS,
    computeNetworkNames,
    blockForPosition,
    paginate,
    INACTIVITY_DAYS,
    MIN_DISTINCT_RIVALS,
    computeParticipantStatus,
    computeSelfStatus,
    computeTerritorialDensity,
    computeNetworkDensity,
    GLOBAL_UNLOCKED,
    computeProfileRankingSummary,
    computeHomeRankingInsight,
    isRemoteConfigured,
    getCurrentRankingEdition,
    getRankingClassification,
    getMyRankingPosition,
    getRankingNetwork,
    setRankingNetworkHidden,
    getProfileRankingSummary,
    getHomeRankingInsight,
    classifyHomeRankingMilestone,
    buildRankingMilestoneKey,
    mapServerMovement,
    formatServerPeriodLabel,
    buildGateLocationFromUser,
  };
})(typeof window !== 'undefined' ? window : globalThis);
