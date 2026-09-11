/* ==========================================================================
   BRAMU Lab — app.js (v9)
   ========================================================================== */
(function () {
  'use strict';
  const E = window.PLEngine;
  const S = window.PLStats;
  const Store = window.PLStore;
  const PH = window.PLPlayerHome; // Etapa 2 (Rama Jugador) — agregación pura del Home del jugador
  const PLI = window.PLIdentity; // V03.0 — validación de cuenta (email/contraseña/@usuario/edad)
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  /* ------------------------------------------------------------------ */
  /* ESTADO GLOBAL                                                        */
  /* ------------------------------------------------------------------ */
  let match = null;
  let pointEvents = [];
  let gameEvents = []; // V13 (§4) — log de eventos del motor Por Games, paralelo a pointEvents
  let highlights = [];
  let serverKnowledge = null;
  let manualFinish = null; // { reason, reasonLabel, declaredWinner } | null
  let finishedSnapshot = null;

  const timer = { startedAt: null, pausedAt: null, totalPausedMs: 0, intervalId: null };

  // V13.2 (§1) — Wake Lock: ver sección dedicada más abajo (`requestWakeLock`/`releaseWakeLock`).
  let wakeLockSentinel = null;
  let matchIsActive = false;

  // V13.2 (§2) — chequeo de versión: ver `checkForNewVersion`/`forceUpdateApp` más abajo.
  let dismissedUpdateVersion = null;

  let lastServerPromptCtx = null;
  let pendingConfirmAccept = null;
  let pendingConfirmCancel = null; // Etapa 4.2 (§6.2) — ver confirmAction() más abajo
  let selectedFinishReason = 'tiempo';
  let selectedFinishWinner = 'none';
  let analysisOpenedFrom = 'setup'; // 'live' | 'history' | 'setup'
  let currentHistoryContext = null; // matchId visto en Análisis cuando viene del Historial
  let analysisCurrent = null; // snapshot mostrado actualmente en Análisis (Bloque P: VER RESUMEN)
  let analysisSetFilter = 'match'; // 'match' | 1 | 2 | 3 — selector compartido Estadísticas/Evolución (S2/V5)

  function currentFormat() { return E.FORMATS[match.formatId]; }
  /** V13 (§1-2): `match.mode` es 'complete' (motor punto por punto, de siempre) o 'games'
   *  (V13, un toque por game). Ausente en partidos guardados antes de V13 → tratar como
   *  'complete' (nunca reinterpretar historial viejo como Por Games). */
  function isGamesMode() { return !!match && match.mode === 'games'; }

  /* ------------------------------------------------------------------ */
  /* UTILIDADES                                                           */
  /* ------------------------------------------------------------------ */
  function formatClock(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  }
  function getElapsedMs() {
    if (!timer.startedAt) return 0;
    const end = timer.pausedAt || Date.now();
    return end - timer.startedAt - timer.totalPausedMs;
  }

  /** V02.1 (§4/§5) — fix de corrimiento de día: `Date.prototype.toISOString()` siempre
   *  devuelve la fecha en UTC, nunca la fecha LOCAL. El bug real reportado ("11 partidos
   *  cargados hoy, Actividad solo contaba 3") no era un problema de la agregación temporal del
   *  Home (esos cálculos ya operan sobre timestamps absolutos, correctos en cualquier huso) —
   *  estaba en el prefill de la carga manual (más abajo, `openManualLoadScreen`), que combinaba
   *  la fecha en UTC (`now.toISOString().slice(0,10)`) con la hora en LOCAL (`now.getHours()`).
   *  Durante la ventana diaria en la que el calendario UTC ya rotó pero el local todavía no
   *  (en Argentina, UTC-3: aprox. 21:00–23:59 hora local), esa combinación producía una
   *  fecha/hora un día ADELANTADA respecto del momento real — no un detalle cosmético del
   *  string ISO, sino un instante genuinamente futuro, que PH.computeActivityWeeks4/
   *  computeEffectivenessTotal (V02.1-V02.6: computeActivity30d/computeEffectiveness30d, con
   *  ventana de 30 días — V02.7 las cambió de forma, no el criterio de fecha) excluyen por
   *  diseño. Estas funciones arman el string `YYYY-MM-DD`/`HH:MM` que después escriben los
   *  `<input type="date">` / `<input type="time">` — SIEMPRE en hora local, nunca
   *  `toISOString()`, para que `new Date(`${dateVal}T${timeVal}`)` (que interpreta esa
   *  combinación como hora LOCAL, sin designador de zona) reconstruya el instante real que el
   *  usuario ve en pantalla. */
  function localDateInputValue(d) {
    const dt = d || new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  function localTimeInputValue(d) {
    const dt = d || new Date();
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Formatea una hora real usando la ZONA HORARIA DEL PARTIDO (no la del
   * dispositivo actual). Un partido registrado en Madrid debe seguir
   * mostrando hora de Madrid aunque se abra después desde Argentina.
   * Formato 24h siempre (nunca "9:17 p.m.").
   */
  function formatRealTime(isoString, timeZone) {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timeZone || undefined }).format(new Date(isoString));
    } catch (e) {
      return new Date(isoString).toISOString().slice(11, 19);
    }
  }
  function formatRealDate(isoString, timeZone) {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: timeZone || undefined }).format(new Date(isoString));
    } catch (e) {
      return new Date(isoString).toISOString().slice(0, 10);
    }
  }
  // Etapa 4 (§7) — formato exacto pedido para "Último partido": día SIEMPRE de 2 dígitos +
  // mes de 3 letras mayúsculas SIN separador (`02SEP`). Se arma con una tabla propia (no con
  // el mes corto de Intl: según locale/navegador puede devolver "sept"/"sep." con largo
  // variable) leyendo día/mes en formatToParts para respetar la ZONA HORARIA DEL PARTIDO,
  // igual criterio que formatRealDate/formatRealTime de arriba.
  const COMPACT_MONTH_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  function formatCompactPlayedDate(isoString, timeZone) {
    if (!isoString) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'numeric', timeZone: timeZone || undefined }).formatToParts(new Date(isoString));
      const day = parts.find((p) => p.type === 'day').value;
      const month = Number(parts.find((p) => p.type === 'month').value);
      return `${day}${COMPACT_MONTH_LABELS[month - 1]}`;
    } catch (e) {
      return '';
    }
  }
  // V03.1 (§9/§14) — variantes del mismo criterio (tabla propia de 3 letras, nunca Intl
  // directo por el mismo motivo de arriba): "08 SEP" CON espacio (eje X del gráfico de
  // Evolución/fecha de categoría declarada, a diferencia de "08SEP" sin espacio de Último
  // partido) y "SEP" solo mes (eje X cuando el rango cruza varios meses).
  function formatAxisDayMonth(isoString) {
    if (!isoString) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'numeric' }).formatToParts(new Date(isoString));
      const day = parts.find((p) => p.type === 'day').value;
      const month = Number(parts.find((p) => p.type === 'month').value);
      return `${day} ${COMPACT_MONTH_LABELS[month - 1]}`;
    } catch (e) { return ''; }
  }
  function formatAxisMonthOnly(isoString) {
    if (!isoString) return '';
    try {
      const month = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric' }).format(new Date(isoString)));
      return COMPACT_MONTH_LABELS[month - 1];
    } catch (e) { return ''; }
  }
  /** V03.1 (§4) — "Categoría declarada / 5ª · declarada el 08 SEP 26". */
  function formatDeclaredCategoryDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const day = String(d.getDate()).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day} ${COMPACT_MONTH_LABELS[d.getMonth()]} ${year}`;
    } catch (e) { return ''; }
  }
  /** V03.1 (§9) — "Mejor racha": mismo mes → "SEP 26", cruza meses → "SEP–OCT 26" (año del
   *  partido más reciente de la racha). */
  function formatStreakRangeLabel(startIso, endIso) {
    try {
      const startMonth = Number(new Intl.DateTimeFormat('en-US', { month: 'numeric' }).format(new Date(startIso)));
      const endParts = new Intl.DateTimeFormat('en-US', { month: 'numeric', year: '2-digit' }).formatToParts(new Date(endIso));
      const endMonth = Number(endParts.find((p) => p.type === 'month').value);
      const year = endParts.find((p) => p.type === 'year').value;
      return startMonth === endMonth
        ? `${COMPACT_MONTH_LABELS[endMonth - 1]} ${year}`
        : `${COMPACT_MONTH_LABELS[startMonth - 1]}–${COMPACT_MONTH_LABELS[endMonth - 1]} ${year}`;
    } catch (e) { return ''; }
  }
  let toastTimeoutId = null;
  let undoToastTimeoutId = null;
  /** Microparche V03.3 (§5) — `variant` opcional ('danger') pinta el mismo toast de siempre
   *  en rojo (`.toast.is-danger`) para feedback destructivo (ej. "Jugador eliminado"), sin
   *  crear un segundo componente. Se limpia en cada llamada (`toggle`, no solo `add`) para
   *  que un toast normal nunca herede el rojo de uno destructivo anterior. */
  function showToast(message, durationMs, variant) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    toast.classList.toggle('is-danger', variant === 'danger');
    clearTimeout(toastTimeoutId);
    clearTimeout(undoToastTimeoutId);
    toastTimeoutId = setTimeout(() => toast.classList.remove('is-visible'), durationMs || 1600);
  }
  function teamPlayers(players, team) { return players.filter((p) => p.team === team); }
  function playerName(players, id) { const p = players.find((pl) => pl.id === id); return p ? p.name : '?'; }
  /** V8.2 (31) — helper ÚNICO para convertir (pointsA, pointsB) del game actual a su
   *  representación textual CORRECTA según el modo de puntuación, para textos
   *  históricos/estáticos (baseline de "Partido ya empezado", Timeline, descripciones de
   *  `adjustment`). Antes esos lugares usaban una conversión ingenua ("0"/"15"/"30"/"40"
   *  a secas para cada punto por separado), lo que en zona de deuce siempre daba "40-40" —
   *  incluso cuando en realidad era VENTAJA, 1ª VENTAJA, DEUCE 2, STAR POINT o PUNTO DE ORO.
   *  Reutiliza `E.formatPointsDisplay` — la MISMA fuente de verdad que ya usa el marcador
   *  Live — así nunca puede haber una segunda lógica que diverja de la real. El marcador
   *  Live (getLiveContext) sigue exactamente igual, sin tocar. */
  function gameScoreLabel(pointsA, pointsB, scoringSystem) {
    const disp = E.formatPointsDisplay(pointsA, pointsB, scoringSystem || 'classic');
    if (disp.centralLabel) {
      // Sin los símbolos decorativos (⚡/⭐): en Timeline/baseline queremos texto plano
      // prolijo, no la versión "de banda" que sí los lleva en el marcador Live.
      return disp.centralLabel.replace(/[⚡⭐]/g, '').trim();
    }
    return `${disp.aText}-${disp.bText}`;
  }

  /** V12.2 (§2) — texto plano de UN segmento de `sets[]`: un set reglamentario se muestra
   *  como siempre ("6-3"); un segmento extraordinario (Resolver con Tie break, V12 §9-14)
   *  agrega su propio resultado de TB aparte ("4-4 · TB 5-10") — mostrar solo `gamesA-gamesB`
   *  ahí (4-4) sería engañoso: parece favorecer a un equipo cuando en realidad decidió el
   *  otro. Usado en cualquier lugar que arme el score del partido como texto plano
   *  (Momentos Clave, Historial) — la tarjeta de resultado (chips visuales) tiene su propia
   *  versión en `buildScoreCardHTML`, porque necesita orientación por equipo.
   */
  function formatSetSegmentLabel(s) {
    // V02.2 (Bloque D, §12) — guion EN DASH ("–"), nunca un hyphen-minus ("-"): es el mismo
    // carácter que ya usa el resto de la app (chips de edición, Timeline, Momentos Clave...)
    // — antes esta función era la única excepción, así que Historial y Confirmar partido (sus
    // dos consumidores del marcador en texto plano) quedaban con un guion distinto al resto.
    return s.extraordinary && s.tiebreak
      ? `${s.gamesA}–${s.gamesB} · TB ${s.tiebreak.a}–${s.tiebreak.b}`
      : `${s.gamesA}–${s.gamesB}`;
  }

  /** V02.2 (Bloque D, §12) — componente tipográfico CANÓNICO para un resultado por sets:
   *  "6–2 · 5–7 · 6–4". Reutiliza formatSetSegmentLabel para cada segmento (mismo guion, nunca
   *  un cálculo paralelo que pudiera divergir) y envuelve el punto separador en una clase
   *  chica/secundaria — nunca el mismo blanco/peso que los números. `dotClass`, opcional,
   *  permite que un llamador reduzca el tamaño manteniendo la misma construcción (§12: "en
   *  Home puede reducirse el tamaño, pero no cambiar la construcción"). Devuelve HTML — quien
   *  lo use debe asignarlo con `innerHTML`, nunca `textContent`. */
  function buildCanonicalScoreLineHTML(sets, currentPartial, dotClass) {
    const dotHTML = `<span class="${dotClass || 'score-line__dot'}"> · </span>`;
    const segs = (sets || []).map(formatSetSegmentLabel);
    if (currentPartial) segs.push(`${currentPartial.gamesA}–${currentPartial.gamesB}*`);
    return segs.join(dotHTML) || 'sin sets';
  }

  /** V02.4 (Bloque B, §5) — marcador GRANDE, EXCLUSIVO de la tarjeta Último partido del Home
   *  (nunca usado por Historial/Confirmar partido, fuera de alcance en esta ronda — ver §9 del
   *  consolidado): mismos sets/mismo guion en dash que buildCanonicalScoreLineHTML, pero acá
   *  el guion interior de cada set es un <span> propio, más liviano (§5.3, nunca hereda el
   *  peso 900 de los números), y el punto separador entre sets es blanco y bien marcado
   *  (§5.2) — objetivos de peso/tamaño que el componente canónico compartido no tiene
   *  (Historial/Confirmar partido siguen usando su guion plano de siempre, sin tocar). */
  // V02.6 (§10): el guion y el punto separadores dejan de ser glifos tipográficos ("–"/"·")
  // sujetos a baseline/vertical-align — nunca terminaban de compartir el mismo eje óptico que
  // los números. Ahora son barras/puntos geométricos propios (`currentColor`, sin texto), y
  // el marcador entero pasa a `inline-flex` para centrarlos verticalmente por layout, no por
  // tipografía. Como los separadores dejan de tener contenido de texto, el contenedor exterior
  // (`.player-home-lastmatch__score`, ver renderPlayerLastMatchCard) lleva un `aria-label` con
  // el score completo en texto plano — ver buildLastMatchScoreLabel.
  function buildLastMatchScoreHTML(sets, currentPartial) {
    const numHTML = (n) => `<span class="lastmatch-score__num">${n}</span>`;
    const dashHTML = `<span class="lastmatch-score__dash" aria-hidden="true"></span>`;
    const dotHTML = `<span class="lastmatch-score__dot" aria-hidden="true"></span>`;
    const segs = (sets || []).map((s) => {
      const setHTML = `<span class="lastmatch-score__set">${numHTML(s.gamesA)}${dashHTML}${numHTML(s.gamesB)}</span>`;
      return (s.extraordinary && s.tiebreak) ? `${setHTML} <span class="lastmatch-score__tb">TB ${s.tiebreak.a}–${s.tiebreak.b}</span>` : setHTML;
    });
    if (currentPartial) segs.push(`<span class="lastmatch-score__set">${numHTML(currentPartial.gamesA)}${dashHTML}${numHTML(currentPartial.gamesB)}</span>*`);
    return segs.join(dotHTML) || 'sin sets';
  }

  /** Texto plano equivalente al marcador geométrico de arriba, para el `aria-label` del
   *  contenedor — los separadores ya no llevan glifo de texto que un lector de pantalla
   *  pudiera anunciar. */
  function buildLastMatchScoreLabel(sets, currentPartial) {
    const parts = (sets || []).map((s) => {
      let seg = `${s.gamesA} a ${s.gamesB}`;
      if (s.extraordinary && s.tiebreak) seg += `, tie break ${s.tiebreak.a} a ${s.tiebreak.b}`;
      return seg;
    });
    if (currentPartial) parts.push(`${currentPartial.gamesA} a ${currentPartial.gamesB}, en curso`);
    return parts.join(' · ') || 'sin sets';
  }

  // Etapa 2 (Rama Jugador §4) — vistas donde la barra inferior debe estar presente. Fuera de
  // esta lista la barra se oculta para no competir con una tarea inmersiva en curso (carga de
  // resultados de sets, partido en vivo, edición activa, sheets/modales).
  // Etapa 3 (Fase 3, §5) — "Cargar partido jugado" (view-manual-load) no muestra la barra
  // inferior: es la tarea inmersiva de carga de resultados en sí (§4 del consolidado V02.2).
  // V02.2 (Bloque A, §4) — se agregan Resumen del partido (analysis), Compañeros/Rivales
  // (companions) y la configuración inicial de registro por games/punto a punto (setup):
  // ninguna de las tres es una tarea inmersiva, así que la navegación global no debía
  // perderse ahí — antes dejaban al usuario "encerrado" en recorridos de volver.
  // V03.0.2 (§2) — "Con sesión activa, mantener la bottom nav visible en... Editar datos,
  // Cambiar contraseña, Notificaciones... otras pantallas internas donde navegar a Inicio/
  // Historial/Ranking/Perfil sea una salida válida" — se agregan esas 4 acá.
  // BRAMUlab_V03.2 (§11) — se agregan 'manual-load'/'match-saved' (Cargar partido jugado /
  // Confirmar partido): eran las únicas pantallas de carga/configuración de partido que
  // perdían la navegación inferior con sesión activa, inconsistencia expresa del consolidado.
  // Ver positionManualContinueBar/showView para el ajuste de layout que esto requiere
  // (.court-continue-wrap/.load-keypad ya no pueden asumir bottom:0 fijo).
  // BRAMUlab_V03.3 (§10) — 'player-search'/'player-public' se suman acá (mismo criterio V03.0.2
  // §2 de arriba: pantallas personales donde navegar a Inicio/Historial/Ranking/Perfil es una
  // salida válida).
  // BRAMUlab_V03.4 — 'groups'/'group-settings' se suman con el mismo criterio: MIS GRUPOS
  // reemplaza a Ranking en la barra, así que hereda su misma condición de visibilidad.
  const BOTTOM_NAV_VIEWS = ['player-home', 'history', 'analysis', 'companions', 'ranking', 'profile', 'setup', 'edit-data', 'complete-access', 'change-password', 'notifications', 'manual-load', 'match-saved', 'player-search', 'player-public', 'groups', 'group-settings'];

  function showView(name) {
    ['setup', 'match', 'analysis', 'history', 'timeline', 'manual-load', 'match-saved', 'player-home', 'ranking', 'profile', 'companions',
      'access', 'login', 'signup', 'player-card', 'edit-data', 'complete-access', 'change-password', 'forgot-password', 'notifications',
      'player-search', 'player-public', 'groups', 'group-settings']
      .forEach((v) => { $(`#view-${v}`).hidden = v !== name; });
    const nav = $('#bottom-nav');
    if (nav) {
      // V03.0.1 (§7) — mecanismo PRINCIPAL de "no exponer navegación personal sin sesión":
      // la barra inferior queda oculta en CUALQUIER vista (incluidas 'setup'/'analysis'
      // durante un partido de invitado) mientras no haya sesión activa, no solo en vistas
      // fuera de BOTTOM_NAV_VIEWS. Se usa Store.getCurrentUser() (lectura fresca) y NO la
      // variable de módulo `currentPlayerName`: esa var solo se sincroniza en puntos
      // puntuales (openPlayerHome/openManualLoadScreen/renderPlayerHome/post-login) y sigue
      // en su valor inicial `null` tras un cold boot que resume un partido activo vía
      // continueActiveMatch() (nunca sincroniza) — con la var cacheada, un usuario CON
      // sesión que reabre la app con un partido en curso vería la barra incorrectamente
      // oculta al llegar a Análisis.
      const showNav = BOTTOM_NAV_VIEWS.indexOf(name) !== -1 && !!Store.getCurrentUser();
      nav.hidden = !showNav;
      if (showNav) updateBottomNavActive(name);
      // V03.2 (§11) — alto real de la barra, medido en vivo (nunca adivinado): lo consumen
      // `.court-scroll`/`.load-keypad`/`.court-continue-wrap` (Carga manual/Confirmar
      // partido) vía `--bottomnav-h` para no quedar tapados por la nav cuando hay sesión.
      document.documentElement.style.setProperty('--bottomnav-h', showNav ? `${nav.offsetHeight}px` : '0px');
      if (name === 'manual-load') positionManualContinueBar();
    }
    // V03.0.3 (§12) — "Volver al inicio" en Configurar partido: SOLO sin sesión (guest en
    // pleno flujo de "registrar partido sin cuenta"). Un único punto de verdad acá (en vez de
    // calcularlo en cada call-site que hace `showView('setup')`) para que sea imposible que
    // quede desincronizado del resto de la regla de sesión de esta función.
    if (name === 'setup') { const link = $('#setup-guest-home-link'); if (link) link.hidden = !!Store.getCurrentUser(); }
  }

  /* ------------------------------------------------------------------ */
  /* ENGINE STATE HELPERS                                                 */
  /* ------------------------------------------------------------------ */
  function computeState() {
    return E.computeStateFromEvents(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
  }

  /* ------------------------------------------------------------------ */
  /* PERSISTENCIA (autosave)                                              */
  /* ------------------------------------------------------------------ */
  function buildSnapshot() {
    return {
      match, pointEvents, gameEvents, highlights, serverKnowledge, manualFinish,
      timer: { startedAt: timer.startedAt, pausedAt: timer.pausedAt, totalPausedMs: timer.totalPausedMs },
      finished: !!finishedSnapshot,
    };
  }
  function autosave() { if (match) Store.saveActiveMatch(buildSnapshot()); }

  /* ------------------------------------------------------------------ */
  /* SETUP — pantalla previa                                              */
  /* ------------------------------------------------------------------ */
  let selectedScoring = 'golden';
  let selectedFormatId = 'classic';
  let selectedRecordingMode = 'complete'; // 'complete' | 'games' — V13 (§2)

  const SCORING_HINTS = {
    starpoint: 'Dos ventajas y luego punto decisivo',
    golden: 'Punto decisivo en 40–40',
    classic: 'Deuce + ventaja',
  };

  // V12 (§7): etiquetas del sistema de puntuación para el header de partido en vivo.
  const SCORING_SYSTEM_LABELS = { starpoint: 'STAR POINT', golden: 'PUNTO DE ORO', classic: 'CON VENTAJA' };

  function initSetupScreen() {
    $all('#scoring-options .option-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        $all('#scoring-options .option-col').forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-selected'); btn.setAttribute('aria-checked', 'true');
        selectedScoring = btn.dataset.value;
        $('#scoring-hint').textContent = SCORING_HINTS[selectedScoring];
      });
    });
    $all('#format-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        $all('#format-options .option-pill').forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-selected'); btn.setAttribute('aria-checked', 'true');
        selectedFormatId = btn.dataset.value;
      });
    });
    $('#setup-form').addEventListener('submit', (e) => { e.preventDefault(); startNewMatch(); });
    $('#continue-match-btn').addEventListener('click', continueActiveMatch);

    initModeSelector();
    initHeaderMenu();
    refreshKnownPlayersDatalist();
    checkForActiveMatch();
  }

  /* V13 (§2): selector de modo de registro (Completo / Por games) — se recuerda la última
   *  elección (Store.loadRecordingMode) para la próxima vez que se abre Home.
   *  V03.0.3 (§12) — reemplaza el menú anidado (header-menu → mode-select-menu, 2 toques para
   *  llegar) por 2 tabs siempre visibles debajo del header (#setup-mode-tabs) — "evidente,
   *  táctil, mobile-first".
   *  V03.0.3.2 (§4) — sigue siendo `wireOptionGroup`/`.option-col`/`data-value` por dentro
   *  (misma persistencia, mismo cambio de modo); solo la piel visual pasa de "botón grande"
   *  (.option-row, igual que Sistema de puntuación/Formato) a pestaña con subrayado (mismo
   *  patrón que MI PERFIL/MIS DATOS e Historial) — ver `.setup-mode-tabs` en styles.css. */
  function initModeSelector() {
    selectedRecordingMode = Store.loadRecordingMode();
    updateModeSelectButtonLabel();
    wireOptionGroup('setup-mode-tabs', (mode) => {
      selectedRecordingMode = mode;
      Store.saveRecordingMode(selectedRecordingMode);
    });
  }
  /** Sincroniza el estado visual de los tabs con `selectedRecordingMode` — se llama al iniciar
   *  y no hace falta llamarla de nuevo salvo que algo externo cambie el modo (hoy no pasa:
   *  el modo solo cambia por tap directo en los tabs, que ya se auto-actualizan). */
  function updateModeSelectButtonLabel() {
    $all('#setup-mode-tabs .option-col').forEach((btn) => {
      const isSelected = btn.dataset.value === selectedRecordingMode;
      btn.classList.toggle('is-selected', isSelected);
      btn.setAttribute('aria-checked', String(isSelected));
    });
  }

  /* Etapa 2 (Rama Jugador §3.1) — menú compacto del header de Home: reúne Mi pádel / Historial
   *  (el modo de registro ya no vive acá desde V03.0.3, ver initModeSelector). */
  function initHeaderMenu() {
    $('#header-menu-btn').addEventListener('click', () => { $('#header-menu').hidden = false; });
    $('#header-menu-cancel').addEventListener('click', () => { $('#header-menu').hidden = true; });
    $('#header-menu').addEventListener('click', (e) => { if (e.target === $('#header-menu')) $('#header-menu').hidden = true; });
    $('#header-menu-player-home').addEventListener('click', () => { $('#header-menu').hidden = true; openPlayerHome(); });
    // Etapa 4.1 (§2.1) — este es el único punto de entrada heredado que todavía necesita
    // volver a Configurar partido (view-setup), no al Home: se abre DESDE ese mismo menú de
    // Setup. Se conserva el origen explícitamente (historyOpenedFrom), nunca se adivina por
    // el estado visual — ver openHistoryScreen()/initHistoryScreen() más abajo.
    $('#header-menu-history').addEventListener('click', () => { $('#header-menu').hidden = true; openHistoryScreen('setup'); });
    // V03.0.3 (§12) — invitado (sin sesión): "Volver al inicio" al fondo de la pantalla.
    $('#setup-guest-home-link').addEventListener('click', () => openAccessFlow());
  }

  // Etapa 4.1 (§2.1) — a diferencia del resto de la navegación del jugador (donde "volver"
  // siempre es el Home), Historial tiene DOS puntos de entrada reales: la barra inferior/Home
  // (mayoría de los casos) y el menú de la pantalla tradicional Configurar partido (heredado,
  // §4.4 de la Etapa 2). `historyOpenedFrom` guarda cuál fue, para que Volver regrese
  // exactamente a donde corresponde — nunca se infiere por `match`/`currentPlayerName` u otro
  // estado visual, que podría dar el mismo resultado en ambos casos.
  let historyOpenedFrom = 'player-home';
  // V02.1 (§27) — filtro contextual con el que se abrió Historial: null (normal) |
  // { type:'streak', matchIds:Set, label } | { type:'last30', label }. Vive en memoria de
  // sesión, igual criterio que el resto de los filtros de Historial (§3.3 de Etapa 4.1).
  let historyContextFilter = null;
  function openHistoryScreen(origin, contextFilter) {
    // V03.0.1 (§7) — gate interno (protección adicional, no sustituye el ocultamiento visual
    // de la barra inferior en showView): Historial es una pantalla personal, nunca debe
    // abrirse sin sesión (p.ej. durante un partido de invitado que llegó a 'setup' y usa el
    // menú heredado). Mismo patrón que ya usan openPlayerHome/openManualLoadScreen.
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    // V03.0.3 (§7) — V03.0.2 había quitado la flecha "volver" de las pantallas raíz
    // (bottom nav ya resolvía volver a Inicio) pero en uso real no quedó bien: se restaura,
    // conviviendo con la bottom nav. La flecha siempre visible; el DESTINO sigue siendo
    // contextual (ver el handler de #history-back-btn en initHistoryScreen): a Home si no hay
    // origen especial, o de vuelta a Configurar partido si Historial se abrió desde ahí.
    historyOpenedFrom = origin === 'setup' ? 'setup' : 'player-home';
    historyContextFilter = contextFilter || null;
    // Ambos filtros contextuales son sobre partidos PROPIOS del jugador actual — forzar la
    // pestaña "Mis partidos" para que la lista mostrada sea inequívoca (nunca mezclado con
    // Observados, que ninguna de las dos métricas de origen considera).
    if (historyContextFilter) historyOwnershipFilter = 'mine';
    renderHistory();
    showView('history');
  }

  function refreshKnownPlayersDatalist() {
    const dl = $('#known-players');
    dl.innerHTML = '';
    // V02.1 (§9) — mismo criterio que el selector de carga manual: nunca sugerir los
    // placeholders del sistema ("Jugador 1"...) como si fueran contactos reales.
    Store.loadPlayerNames().filter((n) => !Store.isPlaceholderPlayerName(n)).forEach((n) => { const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt); });
  }

  function checkForActiveMatch() {
    const snap = Store.loadActiveMatch();
    if (snap && snap.match && !snap.finished) {
      const state = snap.match.mode === 'games'
        ? E.computeGameStateFromEvents(snap.gameEvents || [], E.FORMATS[snap.match.formatId], null)
        : E.computeStateFromEvents(snap.pointEvents, snap.match.scoringSystem, E.FORMATS[snap.match.formatId], snap.match.tiebreakMode, snap.match.baseline);
      $('#continue-banner-detail').textContent = `Set ${state.sets.length + 1} · ${state.gamesA}-${state.gamesB}`;
      $('#continue-banner').hidden = false;
    } else {
      $('#continue-banner').hidden = true;
    }
  }

  /** Etapa 3 (Fase 2, §6-§8) — snapshot de solo lectura del partido en vivo activo (si existe),
   *  para la franja del Home y la hoja "Registrar partido". Lee siempre del Store (nunca del
   *  `match` en memoria) para reflejar exactamente lo que se reanudaría, incluso llamada desde
   *  una pantalla sin ningún partido cargado en memoria (Home, Historial, etc.). El cómputo en
   *  sí (nombres/score/modo) es PH.summarizeActiveMatchSnapshot — pura, testeada en tests.html. */
  function getActiveMatchSummary() {
    const snap = Store.loadActiveMatch();
    if (!snap || !snap.match || snap.finished) return null;
    return PH.summarizeActiveMatchSnapshot(snap);
  }

  function makeMatchId() { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Bloque B5: normaliza nombres al guardar — capitalización de palabras, sin pisar
   *  mayúsculas/minúsculas internas arbitrarias del usuario (nunca todo mayúsculas). */
  // Etapa 2 (Rama Jugador): movida a store.js (Store.normalizePlayerName) para que
  // player-home.js use exactamente el mismo criterio de normalización al filtrar el
  // historial por jugador. Se mantiene este wrapper para no tocar los ~10 call-sites
  // existentes en este archivo.
  function normalizePlayerName(raw) { return Store.normalizePlayerName(raw); }

  function startNewMatch() {
    const nameOrDefault = (id, fallback) => { const v = normalizePlayerName($(`#${id}`).value); return v || fallback; };
    const players = [
      { id: 0, team: 'A', name: nameOrDefault('player-1', 'Jugador 1') },
      { id: 1, team: 'A', name: nameOrDefault('player-2', 'Jugador 2') },
      { id: 2, team: 'B', name: nameOrDefault('player-3', 'Jugador 3') },
      { id: 3, team: 'B', name: nameOrDefault('player-4', 'Jugador 4') },
    ];
    Store.rememberPlayerNames(players.map((p) => p.name));

    const now = new Date();
    let timeZone = 'UTC';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* offline-safe fallback */ }

    match = {
      id: makeMatchId(),
      players,
      mode: selectedRecordingMode, // V13 (§2): fijado al arrancar, queda bloqueado todo el partido
      scoringSystem: selectedScoring,
      formatId: selectedFormatId,
      tiebreakMode: 'classic',
      tiebreakModeResetForBase: -1,
      baseline: null,
      coverageStartLabel: null,
      startedAt: now.toISOString(),
      timeZone,
      createdAt: now.toISOString(),
    };
    pointEvents = [];
    gameEvents = [];
    highlights = [];
    serverKnowledge = E.createServerKnowledge();
    manualFinish = null;
    finishedSnapshot = null;

    timer.startedAt = Date.now();
    timer.pausedAt = null;
    timer.totalPausedMs = 0;

    enterMatchScreen();
  }

  function continueActiveMatch() {
    const snap = Store.loadActiveMatch();
    if (!snap) return;
    match = snap.match;
    if (match.tiebreakModeResetForBase === undefined) match.tiebreakModeResetForBase = -1;
    pointEvents = snap.pointEvents || [];
    gameEvents = snap.gameEvents || [];
    highlights = snap.highlights || [];
    serverKnowledge = snap.serverKnowledge || E.createServerKnowledge();
    manualFinish = snap.manualFinish || null;
    finishedSnapshot = null;
    timer.startedAt = snap.timer.startedAt;
    timer.pausedAt = snap.timer.pausedAt;
    timer.totalPausedMs = snap.timer.totalPausedMs;
    enterMatchScreen();
  }

  function enterMatchScreen() {
    showView('match');
    $('#setup-form').reset();
    // V12 (§7): header en una línea (marca · formato · sistema · tiempo) — formato y
    // sistema son fijos para todo el partido, se pintan una sola vez acá.
    $('#match-header-format').textContent = E.FORMATS[match.formatId].label;
    $('#match-header-system').textContent = SCORING_SYSTEM_LABELS[match.scoringSystem] || '';
    // V13 (§4): identifica el modo Por Games en el header sin robar protagonismo al marcador.
    $('#match-header-mode').hidden = !isGamesMode();
    $('#match-header-mode-sep').hidden = !isGamesMode();
    // V13 (§7): en Por Games no se muestra Ajustar (Editar cubre corrección rápida y
    // profunda) — se fija una sola vez acá porque el modo queda bloqueado todo el partido.
    $('#adjust-btn').hidden = isGamesMode();
    // V13.4 (§7/§8): en Por Games "CAMBIAR" no existe (el sistema es metadata, se cambia
    // solo desde ☰) — se resetea acá por si quedó visible de un partido Completo anterior en
    // la misma sesión; `render()` de Completo lo vuelve a evaluar cada frame.
    if (isGamesMode()) $('#scoring-system-change-btn').hidden = true;
    if (timer.pausedAt) { $('#pause-overlay').hidden = false; } else { startTimerLoop(); }
    if (isGamesMode()) renderGamesMode(); else render();
    matchIsActive = true; requestWakeLock(); // V13.2 (§1)
    autosave();
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 3 (FASE 3) — CARGAR PARTIDO JUGADO: rediseño funcional completo. Pantalla tipo
   * "marcador" (no formulario largo), sin motor en vivo (nunca toca `match`/`pointEvents`/
   * `gameEvents`/timer/Wake Lock — no hay partido activo involucrado). La validación pura
   * vive en match-load.js (window.PLMatchLoad, "ML" acá) — esto es solo orquestación de DOM.
   * Guarda/actualiza con `mode:'manual'` en el MISMO Historial (Store.upsertHistory, que ya
   * dedupe por matchId — la edición reutiliza esa misma vía). */
  /* ------------------------------------------------------------------ */
  const ML = window.PLMatchLoad;
  const PG = window.PLGroups; // BRAMUlab_V03.4 — Mis grupos (puntos, tabla semanal, Race anual, BRAMU Intelligence grupal)
  const PLLocations = window.PLLocations; // BRAMUlab_V03.4.1 — dataset y búsqueda de localidades (MIS DATOS §9)
  const RK = window.PLRanking; // BRAMUlab_V03.5 (Bloque 2) — universo/orden/movimiento/paginación de Ranking BRAMU simulado

  let manualSelectedScoring = 'golden';
  let manualSelectedFormatId = 'classic';
  let manualCoords = null; // { lat, lng } | null — el NOMBRE del lugar lo escribe el usuario aparte
  let manualLoadOrigin = 'setup'; // 'setup' | 'player-home' — dónde volver al cancelar sin guardar
  let manualLoadDirty = false;
  let manualSaveAttempted = false;
  let manualSaveInFlight = false;
  let manualIsNewLoad = true; // Etapa 4.2 — false SOLO al editar un partido ya existente
  let manualEditingMatchId = null; // matchId del partido en edición/ya guardado, o null si es alta nueva sin guardar todavía
  let manualEditingCreatedAt = null; // createdAt original a conservar en una edición (§15)
  let manualExistingPrivateNote = null; // nota privada YA guardada, a conservar si se reedita el resultado (§10)
  let manualPlayers = { a1: null, a2: null, b1: null, b2: null };
  let manualSets = [null, null, null]; // sets ya CONFIRMADOS — [{a,b}|null, ...], a=games Equipo A, b=games Equipo B
  let manualActiveSheetSlot = null; // 'a2' | 'b1' | 'b2' — slot que la hoja de jugador edita
  let manualDefaultDateVal = ''; // snapshot al abrir la pantalla — para saber si "Ahora · Hoy" sigue vigente
  let manualDefaultTimeVal = '';

  // Etapa 4.2 (§6.2-§6.3) — el set EN EDICIÓN vive aparte de `manualSets` (que solo guarda
  // sets ya CONFIRMADOS con CONTINUAR) — así los números grandes pueden mostrar un borrador
  // sin comprometer el marcador acumulado hasta que el usuario confirme. `manualDecided` es
  // true una vez que todos los sets necesarios están confirmados y válidos (armado por
  // ML.resolveActiveSetIndex) — en ese momento ya no hay "set actual" que editar.
  let manualActiveSetIndex = 0;
  let manualDraftSet = { a: undefined, b: undefined };
  let manualDraftActiveTeam = 'A';
  let manualDecided = false;
  let manualKeypadOpen = false;
  let manualKeypadDigits = ''; // dígitos tecleados para el lado activo del borrador, todavía sin confirmar
  let manualPendingFormatId = 'classic'; // selección DENTRO de la hoja de formato, sin aplicar (§11)

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const MANUAL_SCORING_LINE_LABELS = { golden: 'Punto de Oro', starpoint: 'Star Point', classic: 'Con ventaja' };
  const MANUAL_ERROR_MESSAGES = {
    'players-missing': 'Faltan jugadores para completar los dos equipos.',
    'players-duplicate': 'Hay un jugador repetido en el partido.',
    'date-missing': 'Falta la fecha del partido.',
    'set-incomplete': 'Falta completar un set.',
    'set-invalid': 'Ese resultado no corresponde a un set válido.',
    'third-set-missing': 'Con 1 set para cada equipo, falta definir el tercer set.',
    'no-winner': 'El resultado cargado no tiene un ganador definido.',
  };
  // Razones que se muestran apenas aparecen (se descubren "en vivo" mientras se carga el
  // resultado); el resto (todavía falta completar algo) solo se explica si ya se intentó
  // guardar — para no llenar de texto rojo una pantalla recién abierta.
  const MANUAL_INLINE_REASONS = new Set(['players-duplicate', 'set-invalid', 'third-set-missing']);

  /* ---- Jugadores ---- */

  function manualPlayerNamesArray() { return [manualPlayers.a1, manualPlayers.a2, manualPlayers.b1, manualPlayers.b2]; }

  function manualSlotLabel(slot) {
    return { a2: 'Elegir compañero', b1: 'Elegir rival 1', b2: 'Elegir rival 2' }[slot] || 'Elegir jugador';
  }
  const MANUAL_SLOT_PLACEHOLDER = { a2: '+ Compañero', b1: '+ Rival 1', b2: '+ Rival 2' };

  function renderManualPlayerChip(slot) {
    const el = $(`#load-player-${slot}`);
    const nameEl = el.querySelector('.court-team-card__player-name');
    const name = manualPlayers[slot];
    if (name) { nameEl.textContent = name; el.classList.remove('is-empty'); }
    else { nameEl.textContent = MANUAL_SLOT_PLACEHOLDER[slot]; el.classList.add('is-empty'); }
  }

  function renderManualPlayers() {
    $('#load-player-a1-name').textContent = manualPlayers.a1 || '—';
    renderManualPlayerChip('a2');
    renderManualPlayerChip('b1');
    renderManualPlayerChip('b2');
  }

  /** Jugadores ya elegidos en cualquier OTRO lugar (nunca el propio slot que se está editando)
   *  — §7: "excluir a los jugadores ya elegidos en cualquiera de los otros lugares". */
  function manualExcludedNamesForSlot(slot) {
    return manualPlayerNamesArray().filter(Boolean).filter((n) => n !== manualPlayers[slot]);
  }

  function openManualPlayerSheet(slot) {
    manualActiveSheetSlot = slot;
    $('#load-player-sheet-title').textContent = manualSlotLabel(slot).toUpperCase();
    $('#load-player-sheet-search').value = '';
    $('#load-player-sheet-remove').hidden = !manualPlayers[slot];
    // V02.3 (Bloque A, §3) / V02.5 (paleta): Rival 1/Rival 2 acentúan en azul BRAMU (Equipo B),
    // Compañero en verde BRAMU (Equipo A) — reutiliza exactamente las mismas variables
    // --team-a/--team-b que el resto de la app.
    $('#load-player-sheet').classList.toggle('is-context-rival', slot === 'b1' || slot === 'b2');
    renderManualPlayerSheetContent('');
    // V02.5 (Bloque B, §12.1) — el sheet ahora es alto y scrolleable (.bottom-sheet--tall):
    // vuelve siempre al tope, nunca reabre donde quedó scrolleado la vez anterior.
    $('#load-player-sheet-scroll').scrollTop = 0;
    $('#load-player-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#load-player-sheet-scrim').classList.add('is-open'); });
    setTimeout(() => $('#load-player-sheet-search').focus(), 60);
  }

  function closeManualPlayerSheet() {
    const scrim = $('#load-player-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
    manualActiveSheetSlot = null;
  }

  /** V02.5 (Bloque B, §12.3) — fila compartida por RECIENTES y TODOS: avatar + Nombre (peso
   *  fuerte) + @usuario (secundario, derivado del nombre igual que buildPlayerHandle ya hace
   *  para el jugador actual — no es un campo de cuenta real, solo deja la interfaz lista para
   *  cuando pueda haber más de un "Matu").
   *  BRAMUlab_V03.3 (§6) — COMPONENTE ÚNICO DE FILA DE JUGADOR: se reutiliza tal cual en
   *  Elegir compañero/rival (acá), Buscar jugadores y la lista JUGADORES de Perfil (ver
   *  renderPlayerSearchResults/renderJugadoresTab más abajo) — un solo lugar que arma el HTML,
   *  cada pantalla decide su propio listener de click. Suma Nivel BRAMU a la derecha (§6/§9,
   *  PH.computeSimulatedJugadorLevel) — `level` es opcional para no romper ningún call site
   *  que todavía no lo calcule. */
  function buildPlayerRowHTML(name, level) {
    const levelText = Number.isFinite(level) ? level.toFixed(1) : '—';
    return `<button type="button" class="player-row" data-name="${escapeHtml(name)}">
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">${escapeHtml(buildPlayerHandle(name))}</span>
      </span>
      <span class="player-row__level">
        <span class="player-row__level-value">${levelText}</span>
        <span class="player-row__level-label">NIVEL BRAMU</span>
      </span>
    </button>`;
  }

  /** V02.9 (§2) — REEMPLAZA el CTA grande de "agregar sin cuenta" (`.sheet-option--primary`,
   *  ancho completo, debajo de la lista): ahora es una fila más dentro del propio listado de
   *  resultados, mismo componente `.player-row` que un jugador real (ver buildPlayerRowHTML) —
   *  para leerse "distinta de un usuario ya existente" (diferenciación pedida en el
   *  consolidado) el avatar deja de tener iniciales y pasa a un ícono circular de persona "+",
   *  y no hay línea de @usuario debajo del texto. El acento de equipo (verde/azul, antes un
   *  punto chico sobre el CTA — `.sheet-add-player-dot`) se conserva pero ahora tiñe el ícono. */
  function buildAddPlayerRowHTML(trimmed) {
    return `<button type="button" id="load-player-sheet-add" class="player-row player-row--add">
      <span class="player-row__avatar player-row__avatar--add" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.4 19c0-3.3 2.7-5.6 5.6-5.6s5.6 2.3 5.6 5.6"/><path d="M18 7.5v5M15.5 10h5"/></svg>
      </span>
      <span class="player-row__info">
        <span class="player-row__name">Agregar a “${escapeHtml(trimmed)}”</span>
      </span>
    </button>`;
  }

  function renderManualPlayerSheetContent(query) {
    const slot = manualActiveSheetSlot;
    if (!slot) return;
    const excluded = manualExcludedNamesForSlot(slot);
    const history = Store.loadHistory();
    const recentsSection = $('#load-player-sheet-recents-section');
    const recentsWrap = $('#load-player-sheet-recents');
    // V02.2 (Bloque C, §8) — BUG real: la sección TODOS no excluía a quienes ya aparecían en
    // RECIENTES, así que la misma persona podía listarse dos veces en la misma pantalla. Se
    // guarda qué nombres quedaron en RECIENTES para restarlos también de TODOS más abajo.
    let recentNames = [];
    if (!query) {
      // Microparche V03.3.2 — currentIdentity() (no el string plano): computeRecentPlayers
      // ahora resuelve pertenencia por userId cuando la cuenta lo tiene (ver match-load.js).
      const recents = ML.computeRecentPlayers(history, currentIdentity(), excluded).slice(0, 12);
      recentNames = recents;
      if (recents.length) {
        recentsSection.hidden = false;
        recentsWrap.innerHTML = recents.map((n) => buildPlayerRowHTML(n, PH.computeSimulatedJugadorLevel(history, n))).join('');
        $all('#load-player-sheet-recents .player-row').forEach((btn) => {
          btn.addEventListener('click', () => selectManualPlayer(btn.dataset.name));
        });
      } else { recentsSection.hidden = true; recentsWrap.innerHTML = ''; }
    } else {
      recentsSection.hidden = true; recentsWrap.innerHTML = '';
    }

    const pool = ML.computeAllKnownPlayers(history, Store.loadPlayerNames());
    const matches = ML.filterPlayerCandidates(pool, query, excluded.concat([currentPlayerName]).concat(recentNames));
    // V02.9 (§2) — la fila "Agregar a…" ya NO es un CTA aparte debajo de la lista: se agrega
    // como último elemento del propio listado de resultados (buildAddPlayerRowHTML), así que
    // los jugadores reales que coincidan y la opción de alta sin cuenta conviven en una sola
    // lista, en el orden natural de lectura. "Sin coincidencias" solo tiene sentido cuando NI
    // hay jugadores reales NI se puede ofrecer el alta (nombre vacío o ya duplicado) — mostrarlo
    // igual mientras la fila "Agregar a…" ya cubre ese hueco sería redundante.
    const trimmed = normalizePlayerName(query);
    const canAdd = !!trimmed && !ML.isDuplicatePlayerName(trimmed, excluded.concat([currentPlayerName]));
    // Microparche V03.3.2 (§1) — label "Todos" solo mientras se navega sin buscar (un
    // resultado de búsqueda ya se explica solo por el propio texto tecleado) y solo si hay
    // algo real que mostrar debajo (nunca "TODOS" flotando sobre "Sin coincidencias.").
    $('#load-player-sheet-list-label').hidden = !!query || !matches.length;
    const listWrap = $('#load-player-sheet-list');
    let listHTML = matches.map((n) => buildPlayerRowHTML(n, PH.computeSimulatedJugadorLevel(history, n))).join('');
    if (canAdd) listHTML += buildAddPlayerRowHTML(trimmed);
    // Microparche V03.3.2 (§1) — ahora que "Recientes" funciona de verdad, "Todos" puede
    // quedar legítimamente vacío (recientes ya cubrió a todo el universo conocido) sin que
    // eso sea un error: "Sin coincidencias." solo aparece si TAMPOCO hubo nada en Recientes.
    const showEmptyMessage = !listHTML && !recentNames.length;
    listWrap.innerHTML = listHTML || (showEmptyMessage ? '<p class="load-player-sheet__empty">Sin coincidencias.</p>' : '');
    $all('#load-player-sheet-list .player-row:not(.player-row--add)').forEach((btn) => {
      btn.addEventListener('click', () => selectManualPlayer(btn.dataset.name));
    });
    if (canAdd) $('#load-player-sheet-add').addEventListener('click', () => selectManualPlayer(trimmed));
  }

  /** V02.2 (Bloque C, §9) — una persona no puede ocupar dos lugares en el mismo partido. La UI
   *  normal ya lo evita (RECIENTES/TODOS excluyen a quien ya está asignado, §8), pero esto es
   *  la fuente de verdad explícita: si de todos modos llega un nombre ya asignado, NO se cierra
   *  el sheet — se explica brevemente que ya participa y se deja elegir de nuevo. */
  function selectManualPlayer(name) {
    const slot = manualActiveSheetSlot;
    const norm = normalizePlayerName(name);
    if (!slot || !norm) return;
    const excludedForDup = manualExcludedNamesForSlot(slot).concat([currentPlayerName]);
    if (ML.isDuplicatePlayerName(norm, excludedForDup)) {
      showToast(`${norm} ya participa en este partido.`);
      return;
    }
    manualPlayers[slot] = norm;
    Store.rememberPlayerNames([norm]);
    markManualLoadDirty();
    renderManualPlayers();
    renderManualScoreboard();
    closeManualPlayerSheet();
    advanceManualSelectionSequence(slot);
  }

  /** V02.2 (Bloque C, §8 / Bloque D, §10.1) — secuencia automática completa: elegir un rol
   *  abre solo el SIGUIENTE rol vacío (Compañero → Rival 1 → Rival 2), y al completar Rival 2
   *  abre directamente el teclado numérico del Set 1, Equipo A — sin ningún toque de regreso a
   *  la pantalla entre medio. Nunca reabre un rol que ya está completo (permite tocar
   *  cualquier jugador ya elegido para modificarlo sin reactivar la cadena) ni pisa un
   *  resultado que ya se empezó a cargar. El pequeño delay deja terminar la animación de
   *  cierre del sheet anterior (220ms) antes de abrir el siguiente paso. */
  const MANUAL_SELECTION_NEXT_SLOT = { a2: 'b1', b1: 'b2' };
  function advanceManualSelectionSequence(justFilledSlot) {
    const nextSlot = MANUAL_SELECTION_NEXT_SLOT[justFilledSlot];
    if (nextSlot) {
      if (!manualPlayers[nextSlot]) setTimeout(() => openManualPlayerSheet(nextSlot), 260);
      return;
    }
    if (justFilledSlot !== 'b2') return;
    const rosterComplete = manualPlayers.a2 && manualPlayers.b1 && manualPlayers.b2;
    const set1Untouched = manualActiveSetIndex === 0 && !manualKeypadOpen
      && !Number.isFinite(manualDraftSet.a) && !Number.isFinite(manualDraftSet.b);
    if (rosterComplete && set1Untouched) setTimeout(() => openManualKeypad('A'), 260);
  }

  function initManualPlayerSheet() {
    $('#load-player-sheet-close').addEventListener('click', closeManualPlayerSheet);
    $('#load-player-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#load-player-sheet-scrim')) closeManualPlayerSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#load-player-sheet-scrim').hidden) closeManualPlayerSheet(); });
    $('#load-player-sheet-search').addEventListener('input', (e) => renderManualPlayerSheetContent(e.target.value));
    $('#load-player-sheet-remove').addEventListener('click', () => {
      const slot = manualActiveSheetSlot;
      if (!slot) return;
      manualPlayers[slot] = null;
      markManualLoadDirty();
      renderManualPlayers();
      renderManualScoreboard();
      closeManualPlayerSheet();
    });
    $('#load-player-a2').addEventListener('click', () => openManualPlayerSheet('a2'));
    $('#load-player-b1').addEventListener('click', () => openManualPlayerSheet('b1'));
    $('#load-player-b2').addEventListener('click', () => openManualPlayerSheet('b2'));
  }

  /* ---- Marcador / resultado / teclado numérico (§6-§7 Etapa 4.2) ----
   *  Rediseño completo de la interacción sobre la MISMA lógica pura (match-load.js): marcador
   *  acumulado (`manualSets`, solo sets confirmados) + un set "en borrador"
   *  (`manualDraftSet`/`manualActiveSetIndex`) que se confirma explícitamente con CONTINUAR.
   *  Ningún cambio en canExtendSetDigits/isThirdSetVisible/isMatchDecided/validateMatchDraft. */

  function manualNeededSlots(format) {
    const thirdVisible = ML.isThirdSetVisible(manualSets[0], manualSets[1], format);
    return format.bestOfSets === 1 ? 1 : (thirdVisible ? 3 : 2);
  }

  function manualTeamShortLabel(names) {
    return names.filter(Boolean).join(' / ') || '—';
  }

  /** §6.2 — marcador acumulado: solo sets ya CONFIRMADOS. Tocar uno lo reabre para editarlo
   *  (reopenManualSet) sin tocar los que quedan más adelante hasta que el usuario confirme
   *  de nuevo (§6.2 del consolidado: "no borra los posteriores en silencio"). */
  function renderManualAccumulated(format) {
    const wrap = $('#court-accumulated');
    const upTo = manualDecided ? manualNeededSlots(format) : manualActiveSetIndex;
    const items = [];
    for (let i = 0; i < upTo; i++) {
      const s = manualSets[i];
      if (!s || !Number.isFinite(s.a) || !Number.isFinite(s.b)) continue;
      items.push(`<button type="button" class="court-accumulated__set" data-set-index="${i}" aria-label="Editar Set ${i + 1}, ${s.a} a ${s.b}"><span class="court-accumulated__set-label">SET ${i + 1}</span><span class="court-accumulated__set-score">${s.a}–${s.b}</span></button>`);
    }
    wrap.innerHTML = items.join('');
    wrap.hidden = items.length === 0;
    $all('#court-accumulated .court-accumulated__set').forEach((btn) => {
      btn.addEventListener('click', () => reopenManualSet(Number(btn.dataset.setIndex)));
    });
  }

  /** §6.3 — números grandes del set en edición; oculto una vez que el partido quedó decidido
   *  (nada más que confirmar ahí, ver updateManualContinueState). */
  function renderManualCurrentSetEditor(format) {
    const section = $('#view-manual-load .court-current-set');
    if (manualDecided) { section.hidden = true; return; }
    section.hidden = false;
    $('#court-current-set-label').textContent = format.bestOfSets === 1 ? 'RESULTADO' : `RESULTADO DEL SET ${manualActiveSetIndex + 1}`;
    $('#court-score-a-name').textContent = manualTeamShortLabel([manualPlayers.a1, manualPlayers.a2]);
    $('#court-score-b-name').textContent = manualTeamShortLabel([manualPlayers.b1, manualPlayers.b2]);
    const liveDigits = (side) => manualKeypadOpen && manualDraftActiveTeam === side && manualKeypadDigits;
    const aVal = liveDigits('A') ? manualKeypadDigits : (Number.isFinite(manualDraftSet.a) ? String(manualDraftSet.a) : '–');
    const bVal = liveDigits('B') ? manualKeypadDigits : (Number.isFinite(manualDraftSet.b) ? String(manualDraftSet.b) : '–');
    $('#court-score-a-value').textContent = aVal;
    $('#court-score-b-value').textContent = bVal;
    $('#court-score-a').classList.toggle('is-active', manualKeypadOpen && manualDraftActiveTeam === 'A');
    $('#court-score-b').classList.toggle('is-active', manualKeypadOpen && manualDraftActiveTeam === 'B');
    $('#court-score-a').classList.toggle('is-empty', aVal === '–');
    $('#court-score-b').classList.toggle('is-empty', bVal === '–');
  }

  /** §6.3/§7.2 — CONTINUAR: deshabilitado mientras el par no cierre un set válido; una vez
   *  que el partido está decidido, pasa a leerse "GUARDAR PARTIDO" (misma acción, ver
   *  attemptManualContinue). */
  /** V02.1 (§10) — el avance entre sets ahora es automático (commitCurrentManualSetIfValid):
   *  esta barra ya no tiene nada que hacer mientras se está cargando un set, así que
   *  permanece oculta hasta que el partido queda decidido — ahí pasa a ser el único paso
   *  explícito que falta: abrir CONFIRMAR PARTIDO (nunca guarda directo, ver §13/§14). */
  function updateManualContinueState() {
    const wrap = $('#court-continue-wrap');
    const btn = $('#manual-continue-btn');
    // V02.3 (Bloque B, §4) — con el resultado final ya válido, la pausa deliberada muestra
    // "Resultado válido" arriba de CONTINUAR (el hint vive ahora dentro de #court-continue-wrap,
    // no dentro de .court-current-set — esa sección queda oculta una vez decidido, ver
    // renderManualCurrentSetEditor).
    if (manualDecided) {
      wrap.hidden = false;
      btn.disabled = false;
      btn.textContent = 'CONTINUAR';
      $('#court-current-set-hint').hidden = false;
      return;
    }
    wrap.hidden = true;
    $('#court-current-set-hint').hidden = true;
  }

  function renderManualScoreboard() {
    const format = E.FORMATS[manualSelectedFormatId];
    // V03.2.1 (§8) — el header ya no repite el estado del set ("SET 1"/"PARTIDO COMPLETO"):
    // pasa a ser un título estático ("CARGAR PARTIDO", ver index.html) que explica la acción
    // general de la pantalla; el estado específico del set vive en el contenido
    // (#court-current-set-label ya lo muestra como "RESULTADO DEL SET N").
    const bestOfLabel = format.bestOfSets === 1 ? '1 set' : `Mejor de ${format.bestOfSets}`;
    const scoringLabel = MANUAL_SCORING_LINE_LABELS[manualSelectedScoring] || '';
    $('#manual-load-format-mini').textContent = `${format.label} · ${scoringLabel}`;
    $('#load-format-line-text').textContent = `${format.label} · ${bestOfLabel} · ${scoringLabel}`;

    renderManualAccumulated(format);
    renderManualCurrentSetEditor(format);
    updateManualContinueState(format);
    positionManualContinueBar();
    recomputeManualValidation();
  }

  /** Tocar un set ya confirmado en el marcador acumulado lo reabre como borrador editable. */
  function reopenManualSet(i) {
    if (manualKeypadOpen) closeManualKeypadPanel();
    manualDecided = false;
    const s = manualSets[i];
    manualDraftSet = s ? { a: s.a, b: s.b } : { a: undefined, b: undefined };
    manualActiveSetIndex = i;
    manualDraftActiveTeam = 'A';
    markManualLoadDirty();
    renderManualScoreboard();
  }

  /** Hotfix v2.2.1 (§7.2) — qué teclas del lado activo son pulsables ANTES de que el usuario
   *  escriba nada, ya considerando el valor del lado opuesto si ya está confirmado (p.ej. con
   *  Equipo A ya en 2, del lado B solo debe quedar habilitado el 6 — único valor capaz de
   *  cerrar un 2-6 válido). Reutiliza ML.computeValidNextDigits, nunca una lista propia. */
  function updateManualKeypadKeysState() {
    const format = E.FORMATS[manualSelectedFormatId];
    const otherValue = manualDraftActiveTeam === 'A' ? manualDraftSet.b : manualDraftSet.a;
    const allowed = new Set(ML.computeValidNextDigits('', format, otherValue));
    $all('#load-keypad [data-key]').forEach((btn) => {
      const key = btn.dataset.key;
      if (key === 'del' || key === 'done') { btn.disabled = false; return; }
      btn.disabled = !allowed.has(key);
    });
  }

  /** Ubica CONTINUAR justo arriba del teclado cuando está abierto (§7.1), o al pie de la
   *  pantalla cuando está cerrado — medido en vivo, no un alto fijo adivinado.
   *  V03.2 (§11) — suma el alto real de #bottom-nav cuando está visible (con sesión): el
   *  `bottom` inline que fija acá pisa cualquier valor de CSS, así que ese offset tiene que
   *  entrar en la cuenta acá también, no solo en `--bottomnav-h` (que sí alcanza para
   *  #load-keypad, sin `style.bottom` propio). */
  function positionManualContinueBar() {
    const wrap = $('#court-continue-wrap');
    const keypad = $('#load-keypad');
    if (!wrap || !keypad) return;
    const nav = $('#bottom-nav');
    const navH = (nav && !nav.hidden) ? nav.offsetHeight : 0;
    wrap.style.bottom = keypad.hidden ? `${navH}px` : `${keypad.offsetHeight + navH}px`;
  }

  function openManualKeypad(team) {
    if (manualKeypadOpen) commitDraftDigits();
    manualDraftActiveTeam = team;
    manualKeypadOpen = true;
    manualKeypadDigits = '';
    $('#load-keypad').hidden = false;
    $('#manual-load-scroll').classList.add('has-keypad');
    updateManualKeypadKeysState();
    renderManualScoreboard();
  }

  function closeManualKeypadPanel() {
    commitDraftDigits();
    manualKeypadOpen = false;
    manualKeypadDigits = '';
    $('#load-keypad').hidden = true;
    $('#manual-load-scroll').classList.remove('has-keypad');
  }

  function commitDraftDigits() {
    if (!manualKeypadOpen || !manualKeypadDigits) return;
    manualDraftSet[manualDraftActiveTeam === 'A' ? 'a' : 'b'] = Number(manualKeypadDigits);
    manualKeypadDigits = '';
  }

  /** El foco pasa solo de Equipo A a Equipo B del MISMO set (§6.3); al completar ambos lados,
   *  el teclado se cierra y espera el toque explícito en CONTINUAR — ya no abre el set
   *  siguiente por sí solo (eso ahora es trabajo exclusivo de CONTINUAR). */
  /** V02.1 (§10) — al completar el lado B, ya no espera un toque explícito en CONTINUAR: si
   *  el par cierra un set válido, lo confirma y avanza solo. Si por algún motivo no cierra un
   *  set válido todavía (p.ej. quedó en un estado intermedio tras editar), simplemente
   *  muestra el marcador tal cual — nunca fuerza un avance con datos incompletos. */
  function advanceDraftSide() {
    if (manualDraftActiveTeam === 'A') { openManualKeypad('B'); return; }
    closeManualKeypadPanel();
    commitCurrentManualSetIfValid();
  }

  /** §6.3/§10 — confirma el set en edición (con confirmación previa si eso deja huérfano un
   *  Set 3 ya cargado — §6.2) y avanza automáticamente al siguiente, o deja el partido
   *  "decidido" (listo para CONFIRMAR PARTIDO) cuando ya no queda ningún set más que pedir. No
   *  hace nada si el borrador todavía no cierra un set completo y válido — nunca avanza con
   *  datos incompletos. */
  function commitCurrentManualSetIfValid() {
    if (manualDecided) return;
    const format = E.FORMATS[manualSelectedFormatId];
    if (!Number.isFinite(manualDraftSet.a) || !Number.isFinite(manualDraftSet.b)) { renderManualScoreboard(); return; }
    if (!E.isValidCompletedSetScore(manualDraftSet.a, manualDraftSet.b, format)) { renderManualScoreboard(); return; }

    const applyConfirm = () => {
      manualSets[manualActiveSetIndex] = { a: manualDraftSet.a, b: manualDraftSet.b };
      if (manualActiveSetIndex === 0 || manualActiveSetIndex === 1) pruneOrphanThirdSet();
      markManualLoadDirty();
      const next = ML.resolveActiveSetIndex(manualSets, format);
      if (next === null) {
        manualDecided = true;
        renderManualScoreboard();
        // V02.3 (Bloque B, §4) — revierte el auto-avance de V02.2: el set que define el
        // partido YA NO abre CONFIRMAR PARTIDO solo. Se detiene acá (teclado cerrado, último
        // set visible en el marcador acumulado, "Resultado válido" + CONTINUAR visibles vía
        // updateManualContinueState) para dejar una pausa deliberada que permita revisar o
        // corregir el resultado antes de continuar. CONTINUAR pasa a ser el único disparador
        // de finalizeManualContinue, tanto acá como en los casos NO interactivos que también
        // pueden dejar el partido "decidido" (reabrir uno ya completo, o un cambio de formato).
      } else {
        manualActiveSetIndex = next;
        const existing = manualSets[next];
        manualDraftSet = existing ? { a: existing.a, b: existing.b } : { a: undefined, b: undefined };
        if (existing) {
          // Ya había un valor cargado en este set (reapertura tras editar un set previo) —
          // no forzar el teclado, se muestra tal cual quedó.
          manualDraftActiveTeam = 'A';
          renderManualScoreboard();
        } else {
          // V02.2 (Bloque D, §10.3) — deja el primer campo del set siguiente activo y el
          // teclado abierto: nunca hace falta un toque extra para "despertar" el set nuevo.
          openManualKeypad('A');
        }
      }
    };

    // §6.2 — si esta confirmación deja huérfano un Set 3 que ya tenía un resultado cargado,
    // pedir confirmación antes de descartarlo en vez de borrarlo en silencio.
    const thirdWasConfirmed = manualActiveSetIndex !== 2 && manualSets[2] && Number.isFinite(manualSets[2].a) && Number.isFinite(manualSets[2].b);
    if (thirdWasConfirmed) {
      const projectedSet1 = manualActiveSetIndex === 0 ? manualDraftSet : manualSets[0];
      const projectedSet2 = manualActiveSetIndex === 1 ? manualDraftSet : manualSets[1];
      if (!ML.isThirdSetVisible(projectedSet1, projectedSet2, format)) {
        confirmAction(
          'Este cambio ya no necesita un tercer set',
          'El resultado que ya cargaste en el Set 3 se va a descartar.',
          applyConfirm,
          () => { renderManualScoreboard(); }
        );
        return;
      }
    }
    applyConfirm();
  }

  function pressManualKeypadKey(key) {
    if (!manualKeypadOpen) return;
    if (key === 'del') {
      if (manualKeypadDigits) { manualKeypadDigits = manualKeypadDigits.slice(0, -1); }
      else { manualDraftSet[manualDraftActiveTeam === 'A' ? 'a' : 'b'] = undefined; }
      markManualLoadDirty();
      renderManualScoreboard();
      return;
    }
    if (key === 'done') {
      closeManualKeypadPanel();
      markManualLoadDirty();
      // V02.1 (§10) — "Listo" explícito en el lado B también dispara el auto-advance si el
      // set ya cerró un resultado válido (mismo criterio que el cierre automático por dígito).
      commitCurrentManualSetIfValid();
      return;
    }
    const format = E.FORMATS[manualSelectedFormatId];
    const otherValue = manualDraftActiveTeam === 'A' ? manualDraftSet.b : manualDraftSet.a;
    manualKeypadDigits += key;
    markManualLoadDirty();
    if (!ML.canExtendSetDigits(manualKeypadDigits, format, otherValue)) {
      commitDraftDigits();
      advanceDraftSide();
      return;
    }
    renderManualScoreboard();
  }

  function initManualKeypad() {
    $all('#load-keypad [data-key]').forEach((btn) => {
      btn.addEventListener('click', () => pressManualKeypadKey(btn.dataset.key));
    });
    $('#court-score-a').addEventListener('click', () => openManualKeypad('A'));
    $('#court-score-b').addEventListener('click', () => openManualKeypad('B'));
    // V02.1 (§10) — el avance entre sets ya no depende de este botón (auto-advance, ver
    // commitCurrentManualSetIfValid): CONTINUAR solo queda visible una vez que el partido está
    // decidido (updateManualContinueState), y su única función pasa a ser abrir Confirmar
    // partido — nunca guarda directamente (§13/§14).
    $('#manual-continue-btn').addEventListener('click', () => { if (manualDecided) finalizeManualContinue(); });
  }

  /** §9: si Set 1 y Set 2 ya están completos y dejaron de sumar 1-1, cualquier valor que
   *  hubiera quedado en el Set 3 pasó a ser huérfano — se limpia acá. La confirmación previa
   *  (cuando ese Set 3 ya tenía un resultado CARGADO) vive en commitCurrentManualSetIfValid;
   *  acá se cubre además el caso silencioso de siempre (Set 3 todavía vacío, nada que perder). */
  function pruneOrphanThirdSet() {
    const format = E.FORMATS[manualSelectedFormatId];
    if (format.bestOfSets === 1) { manualSets[2] = null; return; }
    const set1 = manualSets[0], set2 = manualSets[1];
    const bothComplete = set1 && set2 && Number.isFinite(set1.a) && Number.isFinite(set1.b) && Number.isFinite(set2.a) && Number.isFinite(set2.b);
    if (!bothComplete) return;
    if (manualSets[2] && !ML.isThirdSetVisible(set1, set2, format)) manualSets[2] = null;
  }

  function manualCurrentDraft() {
    return ML.validateMatchDraft(manualPlayerNamesArray(), manualSets, manualSelectedFormatId, $('#manual-date-input').value);
  }

  function recomputeManualValidation() {
    const draft = manualCurrentDraft();
    const errEl = $('#load-match-error');
    if (draft.ok) { errEl.hidden = true; errEl.textContent = ''; return draft; }
    const showInline = MANUAL_INLINE_REASONS.has(draft.reason) || manualSaveAttempted;
    if (showInline) { errEl.hidden = false; errEl.textContent = MANUAL_ERROR_MESSAGES[draft.reason] || 'Revisá el resultado cargado.'; }
    else { errEl.hidden = true; errEl.textContent = ''; }
    return draft;
  }

  /* ---- Formato y sistema de puntuación (§11) ---- */

  function applyManualFormatSelection(formatId) {
    $all('#manual-format-options .option-pill').forEach((b) => {
      const sel = b.dataset.value === formatId;
      b.classList.toggle('is-selected', sel); b.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
  }
  function applyManualScoringSelection(scoringId) {
    $all('#manual-scoring-options .option-col').forEach((b) => {
      const sel = b.dataset.value === scoringId;
      b.classList.toggle('is-selected', sel); b.setAttribute('aria-checked', sel ? 'true' : 'false');
    });
  }

  function openManualFormatSheet() {
    manualPendingFormatId = manualSelectedFormatId;
    applyManualFormatSelection(manualPendingFormatId);
    applyManualScoringSelection(manualSelectedScoring);
    $('#load-format-sheet-scrim').hidden = false;
    requestAnimationFrame(() => $('#load-format-sheet-scrim').classList.add('is-open'));
  }
  function closeManualFormatSheet() {
    const scrim = $('#load-format-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }
  function closeManualFormatSheetInstant() {
    $('#load-format-sheet-scrim').classList.remove('is-open');
    $('#load-format-sheet-scrim').hidden = true;
  }

  function applyManualFormatChange(newFormatId, impact) {
    manualSelectedFormatId = newFormatId;
    manualSets = impact.keptSets;
    if (manualKeypadOpen) closeManualKeypadPanel();
    const format = E.FORMATS[newFormatId];
    const next = ML.resolveActiveSetIndex(manualSets, format);
    if (next === null) {
      manualDecided = true;
      manualActiveSetIndex = manualNeededSlots(format) - 1;
      manualDraftSet = { a: undefined, b: undefined };
    } else {
      manualDecided = false;
      manualActiveSetIndex = next;
      const existing = manualSets[next];
      manualDraftSet = existing ? { a: existing.a, b: existing.b } : { a: undefined, b: undefined };
    }
    manualDraftActiveTeam = 'A';
    markManualLoadDirty();
    renderManualScoreboard();
  }

  function initManualFormatSheet() {
    $('#load-format-line').addEventListener('click', openManualFormatSheet);
    $('#load-format-sheet-close').addEventListener('click', closeManualFormatSheet);
    $('#load-format-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#load-format-sheet-scrim')) closeManualFormatSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#load-format-sheet-scrim').hidden) closeManualFormatSheet(); });
    $all('#manual-format-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => { manualPendingFormatId = btn.dataset.value; applyManualFormatSelection(manualPendingFormatId); });
    });
    $all('#manual-scoring-options .option-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        // El sistema de puntuación nunca invalida un resultado ya cargado (no cambia la forma
        // de los sets) — se aplica directo, sin necesidad de confirmar nada.
        applyManualScoringSelection(btn.dataset.value);
        manualSelectedScoring = btn.dataset.value;
        markManualLoadDirty();
        renderManualScoreboard();
      });
    });
    $('#load-format-sheet-done').addEventListener('click', () => {
      if (manualPendingFormatId === manualSelectedFormatId) { closeManualFormatSheet(); return; }
      const impact = ML.computeFormatChangeImpact(manualSets, manualPendingFormatId);
      if (impact.hasImpact) {
        closeManualFormatSheetInstant();
        confirmAction(
          'El resultado cargado no coincide con el nuevo formato',
          'Cambiar el formato va a borrar los sets que ya no correspondan.',
          () => applyManualFormatChange(manualPendingFormatId, impact)
        );
      } else {
        applyManualFormatChange(manualPendingFormatId, impact);
        closeManualFormatSheet();
      }
    });
  }

  /* ---- Fecha, hora, lugar (§12) ---- */

  /** Geolocalización opcional — mismo criterio que Wake Lock (§1 V13.2): feature-detect,
   *  fallo/rechazo silencioso (solo consola), nunca bloquea Guardar ni muestra un error
   *  técnico al usuario. Sin reverse-geocoding: se guardan coordenadas crudas, el nombre lo
   *  escribe el usuario. */
  async function requestManualLocation() {
    if (!('geolocation' in navigator)) { showToast('Geolocalización no disponible en este dispositivo.'); return; }
    $('#manual-location-status').hidden = false;
    $('#manual-location-status').textContent = 'Buscando ubicación…';
    try {
      const pos = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }));
      manualCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      $('#manual-location-status').textContent = 'Ubicación guardada.';
    } catch (e) {
      console.warn('[BRAMU LAB] No se pudo obtener la ubicación (rechazada o no disponible).', e);
      manualCoords = null;
      $('#manual-location-status').textContent = 'No se pudo obtener la ubicación. Podés escribir el lugar a mano.';
    }
  }

  /** Etapa 4.2 (§9) — texto compacto de la línea de metadato, compartido entre la pantalla
   *  principal y Partido guardado. "Ahora · Hoy" se mantiene mientras la fecha/hora sigan
   *  siendo EXACTAMENTE el default con el que se abrió esta carga (nunca en una edición de un
   *  partido ya existente, donde mostrar "Ahora" sería directamente falso). */
  function computeManualMetaLineText() {
    const dateVal = $('#manual-date-input').value;
    const timeVal = $('#manual-time-input').value;
    const placeVal = $('#manual-place-input').value.trim();
    const isDefault = manualIsNewLoad && dateVal === manualDefaultDateVal && timeVal === manualDefaultTimeVal;
    // V02.1 (§5) — "Ahora ·" era redundante con "Hoy": ambos dicen lo mismo. Durante la
    // carga (todavía sin guardar) alcanza con "Hoy · HH:MM"; una vez que el partido existe
    // como registro real, esta misma línea ya muestra la fecha/hora reales (rama `else`).
    const dateTimePart = isDefault
      ? (timeVal ? `Hoy · ${timeVal}` : 'Hoy')
      : [formatCompactPlayedDate(`${dateVal}T${timeVal || '00:00'}`, undefined), timeVal].filter(Boolean).join(' · ');
    return placeVal ? `${dateTimePart} · ${placeVal}` : dateTimePart;
  }
  function renderManualMetaLine() {
    const text = computeManualMetaLineText();
    const a = $('#manual-meta-line-text'); if (a) a.textContent = text;
    const b = $('#match-saved-meta-text'); if (b) b.textContent = text;
    updateManualTimeClearVisibility();
  }

  /** V02.3 (Bloque B, §6) — "Borrar hora" queda oculto mientras Hora está vacía: acción
   *  terciaria discreta, nunca un ícono muerto sin nada que borrar. Se reevalúa desde
   *  renderManualMetaLine (único punto que ya se llama en cada cambio/apertura de estos
   *  campos) para no tener que acordarse de invocarlo en cada sitio que setea `.value` a mano. */
  function updateManualTimeClearVisibility() {
    const btn = $('#manual-time-clear-btn');
    if (btn) btn.hidden = !$('#manual-time-input').value;
  }

  /** V02.3 (Bloque B, §6) — Hora deja de ser un <input type="time"> nativo: su presentación
   *  depende del idioma/región del dispositivo (puede mostrar "2:50 p. m." aunque el valor
   *  interno ya fuera 24h) — la causa real detrás de "formato de 24 horas en toda la app".
   *  Enmascara mientras se tipea (inserta ':' después de 2 dígitos), sin validar todavía —
   *  el clamp final ocurre en blur (normalizeManualTimeOnBlur). */
  function maskManualTimeInput(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  /** Al perder foco: HH:MM completo (3-4 dígitos) se recorta a rangos válidos (00-23/00-59) y
   *  se rellena con ceros; incompleto (0-2 dígitos) se limpia — nunca deja a medio escribir.
   *  Vacío ya es un estado soportado (equivalente a "Borrar hora": hora desconocida). */
  function normalizeManualTimeOnBlur() {
    const input = $('#manual-time-input');
    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length < 3) { input.value = ''; return; }
    const h = Math.min(23, Number(digits.slice(0, digits.length - 2)));
    const m = Math.min(59, Number(digits.slice(-2)));
    input.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function openManualMetaSheet() {
    $('#manual-meta-sheet-scrim').hidden = false;
    requestAnimationFrame(() => $('#manual-meta-sheet-scrim').classList.add('is-open'));
  }
  function closeManualMetaSheet() {
    const scrim = $('#manual-meta-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }
  function closeManualMetaSheetInstant() {
    $('#manual-meta-sheet-scrim').classList.remove('is-open');
    $('#manual-meta-sheet-scrim').hidden = true;
  }

  /** §9 — al confirmar "Modificar" sobre un partido que YA existe en el historial (una
   *  edición real, o el que se acaba de guardar en Momento 1), el cambio se aplica de
   *  inmediato: nada queda cacheado (Home/Historial/Perfil/Evolución se recalculan solos la
   *  próxima vez que se rendericen), así que un patch al registro alcanza. */
  function persistManualMetaChange() {
    if (!manualEditingMatchId) return;
    const dateVal = $('#manual-date-input').value;
    const timeVal = $('#manual-time-input').value;
    const built = ML.buildPlayedAtFromLocalFields(dateVal, timeVal);
    const placeName = $('#manual-place-input').value.trim();
    const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;
    // V02.5 (Bloque B, §9) — se refresca `timeZone` acá también (antes solo se fijaba al crear
    // el partido, nunca al editar fecha/hora de uno ya guardado): sin esto, un registro editado
    // desde un huso distinto del que tenía guardado quedaría con un `timeZone` desactualizado
    // que ya no coincide con cómo se interpretó el `playedAt` recién calculado.
    let timeZone;
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* deja el timeZone existente sin tocar */ }
    Store.patchHistoryEntry(manualEditingMatchId, Object.assign(
      { playedAt: built.iso, startedAt: built.iso, timeKnown: built.timeKnown, location: location || null },
      timeZone ? { timeZone } : {}
    ));
  }

  function initManualMetaSheet() {
    $('#manual-meta-line').addEventListener('click', openManualMetaSheet);
    $('#match-saved-meta-line').addEventListener('click', openManualMetaSheet);
    $('#manual-meta-sheet-close').addEventListener('click', closeManualMetaSheet);
    $('#manual-meta-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#manual-meta-sheet-scrim')) closeManualMetaSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#manual-meta-sheet-scrim').hidden) closeManualMetaSheet(); });
    $('#manual-meta-sheet-done').addEventListener('click', () => {
      closeManualMetaSheet();
      renderManualMetaLine();
      markManualLoadDirty();
      persistManualMetaChange();
    });
  }

  function initManualDateTimeFields() {
    $('#manual-date-input').addEventListener('input', () => { markManualLoadDirty(); renderManualMetaLine(); recomputeManualValidation(); });
    $('#manual-time-input').addEventListener('input', (e) => {
      e.target.value = maskManualTimeInput(e.target.value);
      markManualLoadDirty();
      renderManualMetaLine();
    });
    $('#manual-time-input').addEventListener('blur', () => { normalizeManualTimeOnBlur(); renderManualMetaLine(); });
    $('#manual-time-clear-btn').addEventListener('click', () => { $('#manual-time-input').value = ''; markManualLoadDirty(); renderManualMetaLine(); });
    $('#manual-place-input').addEventListener('input', () => { markManualLoadDirty(); renderManualMetaLine(); });
    $('#manual-location-btn').addEventListener('click', requestManualLocation);
  }

  /* ---- Apertura / salida / guardado (§8/§13-§16) ---- */

  function markManualLoadDirty() { manualLoadDirty = true; }

  /** §16: Volver cierra primero cualquier capa abierta (teclado, hoja de jugador, hoja de
   *  formato, hoja de fecha/hora/lugar) antes de intentar salir de toda la pantalla. Devuelve
   *  `true` si cerró algo. */
  function closeAnyManualOverlay() {
    if (!$('#load-keypad').hidden) { closeManualKeypadPanel(); renderManualScoreboard(); return true; }
    if (!$('#load-player-sheet-scrim').hidden) { closeManualPlayerSheet(); return true; }
    if (!$('#load-format-sheet-scrim').hidden) { closeManualFormatSheet(); return true; }
    if (!$('#manual-meta-sheet-scrim').hidden) { closeManualMetaSheet(); return true; }
    return false;
  }

  /** Hotfix v1.3.1 (vigente en Etapa 4.2) — a diferencia de `closeAnyManualOverlay` (cierra
   *  UNA capa por toque de Volver), esto cierra TODAS las capas propias de la pantalla de una
   *  sola vez, necesario antes de guardar/navegar para que ningún panel quede flotando por
   *  encima de la pantalla siguiente. */
  function closeAllManualOverlays() {
    if (!$('#load-keypad').hidden) closeManualKeypadPanel();
    if (!$('#load-player-sheet-scrim').hidden) closeManualPlayerSheet();
    if (!$('#load-format-sheet-scrim').hidden) closeManualFormatSheet();
    if (!$('#manual-meta-sheet-scrim').hidden) closeManualMetaSheetInstant();
  }

  function exitManualLoadScreen() {
    if (closeAnyManualOverlay()) return;
    const goBack = () => { if (manualLoadOrigin === 'player-home') openPlayerHome(); else showView('setup'); };
    if (!manualLoadDirty) { goBack(); return; }
    // V03.2 (§9) — caso canónico "Salir sin guardar" del consolidado: botones exactos
    // CANCELAR/SALIR SIN GUARDAR (nunca "Confirmar" genérico), acción de aceptar en rojo
    // (pérdida real de lo cargado hasta ahora).
    confirmAction('¿Salir sin guardar?', 'Los datos que ingresaste todavía no se guardaron.', () => { manualLoadDirty = false; goBack(); }, null, 'Salir sin guardar', 'Cancelar', true);
  }

  /** Abre la pantalla para cargar un partido nuevo (`editMatch` ausente) o para editar uno ya
   *  guardado (`editMatch` = la entrada completa del Historial — §15). §6: TODA entrada a esta
   *  pantalla requiere identidad — Jugador 1 del Equipo A siempre es `currentPlayerName`, fijo,
   *  sin importar desde dónde se abrió. Si falta identidad, se resuelve primero y se retoma el
   *  flujo sin perder contexto. */
  function openManualLoadScreen(origin, editMatch) {
    manualLoadOrigin = origin === 'setup' ? 'setup' : 'player-home';
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(() => openManualLoadScreen(origin, editMatch)); return; }

    manualIsNewLoad = !editMatch;
    manualEditingMatchId = editMatch ? editMatch.matchId : null;
    manualEditingCreatedAt = editMatch ? editMatch.createdAt : null;
    manualExistingPrivateNote = editMatch ? (editMatch.privateNote || null) : null;
    manualSelectedScoring = editMatch ? editMatch.scoringSystem : 'golden';
    manualSelectedFormatId = editMatch ? editMatch.formatId : 'classic';
    manualCoords = (editMatch && editMatch.location && Number.isFinite(editMatch.location.lat)) ? { lat: editMatch.location.lat, lng: editMatch.location.lng } : null;
    manualLoadDirty = false; // §10 — recién se marca dirty con interacción real del usuario
    manualSaveAttempted = false;
    manualKeypadOpen = false;
    manualKeypadDigits = '';
    manualDecided = false;
    manualDraftActiveTeam = 'A';

    if (editMatch) {
      const teamPlayers = (team) => (editMatch.players || []).filter((p) => p && p.team === team);
      const teamA = teamPlayers('A'), teamB = teamPlayers('B');
      // V03.0 — misma regla de exclusividad de userId que PH.findPlayerRow: si la fila ya
      // tiene userId, solo ese id (nunca el nombre) decide si es "mi" fila.
      const identity = currentIdentity();
      const selfInTeamA = teamA.find((p) => p && (p.userId ? p.userId === identity.userId : p.name === currentPlayerName));
      const partner = teamA.find((p) => p !== selfInTeamA) || teamA[1] || null;
      manualPlayers = { a1: currentPlayerName, a2: partner ? partner.name : null, b1: teamB[0] ? teamB[0].name : null, b2: teamB[1] ? teamB[1].name : null };
      manualSets = (editMatch.sets || []).map((s) => ({ a: s.gamesA, b: s.gamesB }));
      while (manualSets.length < 3) manualSets.push(null);
      manualSets = manualSets.slice(0, 3);
    } else {
      manualPlayers = { a1: currentPlayerName, a2: null, b1: null, b2: null };
      manualSets = [null, null, null];
    }

    // §6.2/§6.3 — a qué set entrar apenas se abre la pantalla: el primero que todavía no sea
    // válido (alta nueva: siempre el Set 1), o "decidido" si se edita un partido que ya
    // estaba completo y todavía no se tocó nada.
    const openFormat = E.FORMATS[manualSelectedFormatId];
    const initialActive = ML.resolveActiveSetIndex(manualSets, openFormat);
    if (initialActive === null) {
      manualDecided = true;
      manualActiveSetIndex = manualNeededSlots(openFormat) - 1;
      manualDraftSet = { a: undefined, b: undefined };
    } else {
      manualActiveSetIndex = initialActive;
      const existing = manualSets[initialActive];
      manualDraftSet = existing ? { a: existing.a, b: existing.b } : { a: undefined, b: undefined };
    }

    $('#load-keypad').hidden = true;
    $('#manual-load-scroll').classList.remove('has-keypad');
    $('#manual-location-status').hidden = true;

    if (editMatch) {
      // Formatea en la zona ORIGINAL del partido (no la del dispositivo actual) para no
      // correr la fecha/hora al editar desde un huso distinto — mismo criterio que
      // formatRealTime/formatRealDate, que ya usan el resto de la app para mostrar (no
      // editar) esta misma fecha.
      const zone = editMatch.timeZone || undefined;
      const baseDateObj = new Date(editMatch.playedAt || editMatch.startedAt);
      try {
        $('#manual-date-input').value = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone }).format(baseDateObj);
      } catch (e) { $('#manual-date-input').value = localDateInputValue(baseDateObj); }
      const timeKnown = editMatch.timeKnown !== false;
      if (timeKnown) {
        try { $('#manual-time-input').value = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone }).format(baseDateObj); }
        catch (e) { $('#manual-time-input').value = localTimeInputValue(baseDateObj); }
      } else {
        $('#manual-time-input').value = '';
      }
      $('#manual-place-input').value = (editMatch.location && editMatch.location.name) || '';
    } else {
      const now = new Date();
      $('#manual-date-input').value = localDateInputValue(now);
      $('#manual-time-input').value = localTimeInputValue(now);
      $('#manual-place-input').value = '';
    }
    manualDefaultDateVal = $('#manual-date-input').value;
    manualDefaultTimeVal = $('#manual-time-input').value;

    renderManualPlayers();
    renderManualScoreboard();
    renderManualMetaLine();
    showView('manual-load');
  }

  /** §8.1 — última validación (sobre todo jugadores: el resultado ya está confirmado por
   *  CONTINUAR) antes de guardar. Si falta algo, el error queda visible inline y la pantalla
   *  no navega a ningún lado — nunca se pierde el resultado ya cargado. */
  /** V02.1 (§13/§14) — un partido cargado NUEVO ya no persiste apenas se completa el último
   *  set: arma el borrador y abre CONFIRMAR PARTIDO. Solo una edición de un partido YA
   *  existente sigue guardando directo (no tiene sentido re-confirmar algo que ya estaba
   *  guardado — mismo criterio que ya usaba esta pantalla antes de esta ronda). */
  function finalizeManualContinue() {
    manualSaveAttempted = true;
    const draft = recomputeManualValidation();
    if (!draft.ok) return;
    if (manualSaveInFlight) return;
    manualSaveInFlight = true;
    closeAllManualOverlays();
    try {
      const snapshot = buildManualMatchSnapshot(draft);
      if (manualIsNewLoad) {
        openConfirmMatchScreen(snapshot);
      } else {
        persistManualSnapshot(snapshot);
        openCanonicalResumen(snapshot, 'player-home');
      }
    } finally {
      manualSaveInFlight = false;
    }
  }

  /** Arma el snapshot completo del partido cargado (misma forma que cualquier otra entrada de
   *  Historial) a partir del estado actual del formulario — SIN persistir todavía. Reusado
   *  tanto por la carga nueva (draft para Confirmar) como por una edición (persiste directo). */
  function buildManualMatchSnapshot(draft) {
    let players = [
      { id: 0, team: 'A', name: manualPlayers.a1 },
      { id: 1, team: 'A', name: manualPlayers.a2 },
      { id: 2, team: 'B', name: manualPlayers.b1 },
      { id: 3, team: 'B', name: manualPlayers.b2 },
    ];
    // V03.0 (§1) — identidad FRESCA desde Store (no la variable de módulo, que puede estar
    // desactualizada si todavía no se visitó Home en esta sesión). Estampa userId en la fila
    // del jugador logueado — nunca reestampa una fila que ya tenía uno (ver stampPlayersWithUserId).
    const freshName = Store.loadCurrentPlayerName();
    const freshUser = Store.getCurrentUser();
    if (freshUser) players = Store.stampPlayersWithUserId(players, freshName, freshUser.id);
    const dateVal = $('#manual-date-input').value;
    const timeVal = $('#manual-time-input').value; // '' si el usuario la borró — nunca se completa sola
    const built = ML.buildPlayedAtFromLocalFields(dateVal, timeVal);
    const timeKnown = built.timeKnown;
    let timeZone = 'UTC';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* offline-safe fallback */ }
    const placeName = $('#manual-place-input').value.trim();
    const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;

    Store.rememberPlayerNames(players.map((p) => p.name));

    const format = E.FORMATS[manualSelectedFormatId];
    const matchCtx = { players, format };
    const stats = S.computeManualStats(draft.sets, matchCtx);
    const intelligence = S.generateManualIntelligence(stats, matchCtx, draft.sets, draft.winnerTeam, { manual: false });

    return {
      matchId: manualEditingMatchId || makeMatchId(),
      // §15 (heredado de Etapa 3): una edición conserva el `createdAt` original — solo un
      // alta nueva usa "ahora".
      createdAt: manualEditingCreatedAt || new Date().toISOString(),
      // Etapa 3 (Fase 1, §5.1) — playedAt es la fecha/hora que el usuario eligió a mano en
      // el formulario (built.iso, vía ML.buildPlayedAtFromLocalFields), no el momento en que
      // se toca "Guardar". Nunca se repite esta lógica en otro lugar: PH.getPlayedAt() es la
      // única fuente de verdad para leer "cuándo se jugó" en el resto de la app.
      playedAt: built.iso,
      startedAt: built.iso,
      timeZone,
      finishedAt: new Date().toISOString(),
      players,
      mode: 'manual',
      scoringSystem: manualSelectedScoring,
      formatId: manualSelectedFormatId,
      tiebreakMode: null,
      baseline: null,
      sets: draft.sets,
      currentPartial: null,
      winnerTeam: draft.winnerTeam,
      terminationType: 'automatic', // nunca 'manual' — ese valor significa "cortado antes de tiempo desde ☰", ortogonal a un partido cargado con resultado ya conocido
      terminationReason: null,
      terminationReasonLabel: null,
      regulationCompleted: true,
      durationMs: 0, // nunca se muestra: buildScoreCardHTML/renderHistory lo gatean por mode==='manual'
      stats,
      perSetStats: [],
      evolution: null, // Evolución se OCULTA por completo para partidos manuales — no hay eventos game a game que graficar
      intelligence,
      highlights: [],
      events: [],
      coverageStartLabel: null,
      timeKnown,
      location: location || null,
      // Etapa 4.2 (§10) — nota privada opcional; una edición conserva la que ya existía si el
      // usuario no la tocó en esta sesión (nunca se pisa con vacío por accidente).
      privateNote: manualExistingPrivateNote || null,
    };
  }

  /** Persiste el snapshot (alta o actualización, `Store.upsertHistory` dedupe por matchId) y
   *  deja el estado de la pantalla listo para que "Modificar"/la nota privada patcheen ESTE
   *  registro de acá en más. Nunca toca timer/Wake Lock/Store.clearActiveMatch — la carga
   *  manual no tiene partido en vivo involucrado. */
  function persistManualSnapshot(snapshot) {
    Store.upsertHistory(snapshot);
    finishedSnapshot = snapshot;
    manualLoadDirty = false;
    manualIsNewLoad = false;
    manualEditingMatchId = snapshot.matchId;
    manualEditingCreatedAt = snapshot.createdAt;
  }

  /* ---- Confirmar partido (pre-guardado) — V02.1 (§13/§14) ---- */

  let manualConfirmDraft = null; // snapshot armado, todavía SIN persistir — ver openConfirmMatchScreen

  function openConfirmMatchScreen(snapshot) {
    manualConfirmDraft = snapshot;
    const myTeam = 'A'; // en la carga manual, el jugador actual siempre es Equipo A (§14: nunca "observado" acá)
    const resultKind = !snapshot.winnerTeam ? 'neutral' : (snapshot.winnerTeam === myTeam ? 'win' : 'loss');
    const resultLabel = { win: 'VICTORIA', loss: 'DERROTA', neutral: 'RESULTADO FINAL' }[resultKind];
    const badge = $('#match-saved-badge');
    badge.textContent = resultLabel;
    badge.className = 'court-saved-result__badge court-saved-result__badge--' + resultKind;
    // V02.3 (Bloque B, §5) — misma tarjeta deportiva que el Resumen (buildScoreCardHTML), con
    // GANADORES incluido (buildWinnersBannerHTML) y SIN statsHTML: acá nunca se agregan
    // Sets/Games ganados (eso es exclusivo de buildResultBlockHTML, usado en Resumen/Análisis).
    // `snapshot` ya trae `.sets`/`.stats`/`.players`/`.winnerTeam` con la misma forma que
    // cualquier partido del Historial (ver buildManualMatchSnapshot), lista para reusar sin
    // transformación.
    $('#match-saved-result-card').innerHTML = buildScoreCardHTML(snapshot, { winnersHTML: buildWinnersBannerHTML(snapshot) });
    renderManualMetaLine();
    showView('match-saved');
  }

  function initMatchSavedScreen() {
    // §10 — desde Confirmar se puede volver a corregir el resultado sin perder nada: los sets
    // y jugadores siguen intactos en memoria, la pantalla de carga los vuelve a mostrar tal
    // cual quedaron.
    $('#match-saved-back-btn').addEventListener('click', () => showView('manual-load'));
    $('#match-saved-view-summary').addEventListener('click', () => {
      if (!manualConfirmDraft) return;
      // Vuelve a leer fecha/hora/lugar por si el usuario usó "Modificar" mientras estaba en
      // esta pantalla — nunca persiste el draft original a ciegas.
      const dateVal = $('#manual-date-input').value;
      const timeVal = $('#manual-time-input').value;
      const built = ML.buildPlayedAtFromLocalFields(dateVal, timeVal);
      const placeName = $('#manual-place-input').value.trim();
      const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;
      // V02.5 (Bloque C, §14) — Notas ya no vive en esta pantalla: se guarda sin nota (opcional,
      // se agrega después desde el Resumen, ver #analysis-note-display/renderAnalysisNoteDisplay).
      // Una edición SÍ preserva la nota que ya tuviera (manualConfirmDraft.privateNote), nunca la
      // pisa con null — solo un alta nueva arranca sin nota.
      const snapshot = Object.assign({}, manualConfirmDraft, {
        playedAt: built.iso,
        startedAt: built.iso,
        timeKnown: built.timeKnown,
        location: location || null,
      });
      persistManualSnapshot(snapshot);
      manualConfirmDraft = null;
      showToast('Partido guardado');
      openCanonicalResumen(snapshot, 'player-home');
    });
  }

  function initManualLoadScreen() {
    // V02.2 (Bloque A, §5) — "Cargar partido jugado" ya no tiene acceso propio desde la
    // configuración por games/punto a punto: el "+" central es el único punto global para
    // elegir entre carga manual y registro en vivo (antes duplicaba el mismo destino que
    // "Cargar mi partido jugado" del sheet Registrar partido).
    $('#manual-load-back-btn').addEventListener('click', exitManualLoadScreen);
    initManualDateTimeFields();
    initManualMetaSheet();
    initManualPlayerSheet();
    initManualFormatSheet();
    initManualKeypad();
    initMatchSavedScreen();
  }

  /* ------------------------------------------------------------------ */
  /* RESOLUCIÓN DE SAQUE EN VIVO (helpers)                                */
  /* ------------------------------------------------------------------ */
  function resolveCurrentServer(state) {
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumber(state);
    const withinSetGameNumber = E.currentWithinSetGameNumber(state);
    if (state.inTiebreak) {
      return E.resolveTiebreakServer(serverKnowledge, match.players, setNumber, state.tbBaseGameNumber, state.tbBaseWithinSet, state.tbA + state.tbB);
    }
    return E.resolveServer(serverKnowledge, match.players, setNumber, matchGameNumber, withinSetGameNumber);
  }

  /* ------------------------------------------------------------------ */
  /* RENDER — PANTALLA DE PARTIDO                                         */
  /* ------------------------------------------------------------------ */
  function render() {
    const state = computeState();
    const matchScreen = $('#view-match');
    matchScreen.classList.remove('is-golden-point', 'is-star-point');

    // Reset de la modalidad de tie break a "Clásico" cada vez que arranca un TB nuevo.
    if (state.inTiebreak && match.tiebreakModeResetForBase !== state.tbBaseGameNumber) {
      match.tiebreakMode = 'classic';
      match.tiebreakModeResetForBase = state.tbBaseGameNumber;
    }

    const serverInfo = resolveCurrentServer(state);
    // V12 (§6, bonus): mismo fix que stats.js — el equipo al saque puede conocerse aunque
    // el jugador individual no, y el banner de Break Point en vivo no debería apagarse por
    // eso (síntoma en vivo de la misma causa raíz que la auditoría de stats).
    const servingTeam = serverInfo.resolved ? serverInfo.team : (serverInfo.candidateTeam || null);

    // Modalidades de TB todavía compatibles con lo realmente jugado (V5 — G3/G4). V12: un
    // Tie break extraordinario tiene su propio objetivo fijado en `state.extraordinaryTiebreak`
    // (editable vía "EDITAR DEFINICIÓN", no vía este selector) — se salta este cálculo, que
    // de todos modos queda oculto por `renderEtbDefinitionLabel` en ese caso.
    let availableTbModes = null;
    if (state.inTiebreak && !(state.extraordinaryTiebreak && state.extraordinaryTiebreak.active)) {
      const tbInfo = E.extractCurrentTiebreakSequence(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
      availableTbModes = E.availableTiebreakModes(tbInfo, state.tbA, state.tbB);
      // Si el modo vigente dejó de ser válido (no debería pasar, pero por las dudas
      // nunca lo forzamos silenciosamente a otra cosa: seguimos usando el actual
      // para no reinterpretar puntos ya jugados; solo se ajusta la lista ofrecida).
      if (!availableTbModes.includes(match.tiebreakMode)) availableTbModes = [match.tiebreakMode].concat(availableTbModes);
    }

    // ÚNICA fuente de verdad para todo el estado contextual (franja + selector de TB).
    const ctx = E.getLiveContext(state, match.scoringSystem, currentFormat(), match.tiebreakMode, servingTeam, availableTbModes);

    setScoreText('#score-a', ctx.disp.aText);
    setScoreText('#score-b', ctx.disp.bText);

    if (ctx.isGoldenPoint) matchScreen.classList.add('is-golden-point');
    if (ctx.isStarPoint) matchScreen.classList.add('is-star-point');

    renderStatusBanner(ctx);
    // V13.4 (§6, §8, §11): "CAMBIAR" solo en la zona de Deuce/Punto de Oro/Star Point/Ventaja
    // — donde el sistema de puntuación realmente importa — Y solo mientras no esté bloqueado
    // (ya cerró un game sensible). Nunca durante un Tie break ni con el partido decidido.
    const inDeuceZone = !state.inTiebreak && !state.matchWinner && state.pointsA >= 3 && state.pointsB >= 3;
    $('#scoring-system-change-btn').hidden = !(inDeuceZone && !completoScoringLocked());
    renderEtbDefinitionLabel(state);
    renderScoreboard(state, ctx.disp);
    renderGameProgression(state);
    renderServerPrompt(state, serverInfo);
    renderZonePlayers(state, serverInfo);
    $('#adjust-btn').disabled = !canUseAdjust(state);

    if (!manualFinish && state.matchWinner && !finishedSnapshot) {
      finishMatch(state, null);
    }

    autosave();
    return state;
  }

  function setScoreText(sel, text) {
    const el = $(sel);
    el.textContent = text;
    el.classList.toggle('team-zone__score--word', text.length > 3);
  }

  const TB_MODE_LABELS = { classic: 'CLÁSICO', death7: 'MUERE EN 7', to15: 'TIE BREAK A 15' };

  /**
   * Renderiza la franja EXCLUSIVAMENTE a partir del objeto que devuelve getLiveContext().
   * V5: la franja es UNA banda con jerarquía (color de equipo + intensidad creciente
   * Break < Set < Match Point, o teñido dorado/star con segmento de equipo integrado),
   * nunca una pastillita flotante dentro de una franja neutra.
   */
  function renderStatusBanner(ctx) {
    const banner = $('#status-banner');
    const primaryEl = $('#status-banner-primary');
    const tbSelect = $('#tiebreak-mode-select');
    const tbText = $('#tiebreak-mode-text');

    banner.className = 'status-banner status-banner--' + ctx.bandKind;
    // BUG RAÍZ (encontrado en esta corrección): `ctx.bandTeam` llega en MAYÚSCULA ('A'/'B',
    // tal cual lo usa el motor internamente), pero las clases CSS de color son en minúscula
    // (`.status-banner--team-a` / `--team-b`). La comparación de nombres de clase en HTML es
    // case-sensitive, así que `classList.add('status-banner--team-' + 'A')` generaba la clase
    // `status-banner--team-A`, que NINGÚN selector CSS coincidía — la banda de Break/Set/Match
    // Point (y los combos Oro/Star + Set/Match) se quedaba siempre en el fondo neutro de
    // `.status-banner`, sin que el color de equipo se aplicara nunca. Esto explica por qué
    // "el CSS estaba escrito" pero nunca se veía: la clase correcta jamás llegaba al DOM.
    if (ctx.bandTeam) banner.classList.add('status-banner--team-' + ctx.bandTeam.toLowerCase());
    // Jerarquía perceptual Break < Set < Match Point (C5), aplica a la banda sola y a las combinaciones.
    if (ctx.bandKind.indexOf('match') !== -1) banner.classList.add('status-banner--escalate-match');
    else if (ctx.bandKind.indexOf('set') !== -1) banner.classList.add('status-banner--escalate-set');

    // Texto con el/los segmentos separados por "|" para poder colorear el segundo
    // segmento (Set/Match Point) con el color del equipo cuando la banda es
    // temática (oro/star/tie break) — el separador nunca se muestra como texto.
    if (ctx.bandLabel.indexOf(' | ') !== -1) {
      const parts = ctx.bandLabel.split(' | ');
      primaryEl.innerHTML = `<span class="band-seg band-seg--theme">${parts[0]}</span><span class="band-seg band-seg--team">${parts[1]}</span>`;
    } else {
      primaryEl.textContent = ctx.bandLabel;
    }

    const showSelect = ctx.showTiebreakSelector && !ctx.tiebreakSelectorDisabled;
    const showText = ctx.showTiebreakSelector && ctx.tiebreakSelectorDisabled;
    tbSelect.hidden = !showSelect;
    tbText.hidden = !showText;
    if (showSelect) {
      tbSelect.innerHTML = ctx.tiebreakAvailableModes.map((m) => `<option value="${m}">${TB_MODE_LABELS[m]}</option>`).join('');
      tbSelect.value = match.tiebreakMode;
    } else if (showText) {
      tbText.textContent = TB_MODE_LABELS[match.tiebreakMode] || '';
    }

    banner.hidden = !ctx.showBanner;
  }

  function renderScoreboard(state, disp) {
    const namesA = teamPlayers(match.players, 'A');
    const namesB = teamPlayers(match.players, 'B');
    const serverInfo = resolveCurrentServer(state);

    renderNamesRow('#scoreboard-names-a', namesA, serverInfo);
    renderNamesRow('#scoreboard-names-b', namesB, serverInfo);
    renderCellsRow('#scoreboard-cells-a', state, 'A', disp.compactAText);
    renderCellsRow('#scoreboard-cells-b', state, 'B', disp.compactBText);
  }

  function renderNamesRow(sel, players, serverInfo) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    players.forEach((p, i) => {
      if (i > 0) { const sep = document.createElement('span'); sep.className = 'scoreboard__sep'; sep.textContent = '/'; wrap.appendChild(sep); }
      const span = document.createElement('span');
      span.className = 'scoreboard__player';
      if (serverInfo && serverInfo.resolved && serverInfo.playerId === p.id) span.classList.add('is-serving');
      span.textContent = p.name;
      // V12 (§5.2): "tocar la pelota / indicador del sacador actual" — hace interactivo el
      // indicador YA existente en vez de agregar otro botón grande a la fila de herramientas.
      span.addEventListener('click', openServerCorrectionModal);
      wrap.appendChild(span);
    });
  }

  function renderCellsRow(sel, state, team, compactPointsText) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    state.sets.forEach((set) => {
      const cell = document.createElement('span');
      const mine = team === 'A' ? set.gamesA : set.gamesB;
      const theirs = team === 'A' ? set.gamesB : set.gamesA;
      cell.className = 'scoreboard__cell ' + (mine > theirs ? 'scoreboard__cell--done-win' : 'scoreboard__cell--done-lose');
      cell.textContent = mine;
      wrap.appendChild(cell);
    });
    const current = document.createElement('span');
    current.className = 'scoreboard__cell scoreboard__cell--current';
    current.dataset.teamColor = team;
    current.textContent = team === 'A' ? state.gamesA : state.gamesB;
    wrap.appendChild(current);

    const points = document.createElement('span');
    points.className = 'scoreboard__cell scoreboard__cell--points';
    points.dataset.teamColor = team;
    if (compactPointsText.length > 3) points.classList.add('is-word');
    points.textContent = compactPointsText; // AD en vez de VENTAJA / 1ª-2ª VENTAJA
    wrap.appendChild(points);
  }

  function renderZonePlayers(state, serverInfo) {
    ['A', 'B'].forEach((team) => {
      const wrap = $(`#zone-players-${team.toLowerCase()}`);
      wrap.innerHTML = '';
      teamPlayers(match.players, team).forEach((p, i) => {
        if (i > 0) { wrap.appendChild(document.createTextNode(' / ')); }
        const span = document.createElement('span');
        span.className = 'team-zone__player';
        if (serverInfo && serverInfo.resolved && serverInfo.playerId === p.id) span.classList.add('is-serving');
        span.textContent = p.name;
        wrap.appendChild(span);
      });
    });
  }

  function renderServerPrompt(state, serverInfo) {
    const prompt = $('#server-prompt');
    if (serverInfo.resolved || state.matchWinner) { prompt.hidden = true; lastServerPromptCtx = null; return; }
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumber(state);
    const withinSetGameNumber = E.currentWithinSetGameNumber(state);
    lastServerPromptCtx = { setNumber, matchGameNumber, withinSetGameNumber };
    prompt.hidden = false;
    const optionsWrap = $('#server-prompt-options');
    optionsWrap.innerHTML = '';
    serverInfo.candidatePlayers.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'server-chip-btn'; btn.textContent = p.name;
      btn.addEventListener('click', () => {
        serverKnowledge = E.recordServerAnswer(serverKnowledge, match.players, lastServerPromptCtx.setNumber, lastServerPromptCtx.matchGameNumber, lastServerPromptCtx.withinSetGameNumber, p.id);
        render();
      });
      optionsWrap.appendChild(btn);
    });
  }

  /* ======================================================================
     V13 — MOTOR "POR GAMES · BETA": PANTALLA EN VIVO (§4-17)
     Sección encapsulada: reutiliza el DOM del marcador de siempre (mismas zonas, mismo
     scoreboard, misma barra de herramientas) pero la alimenta desde `gameEvents` +
     `E.computeGameStateFromEvents` en vez de `pointEvents`/`E.computeStateFromEvents`.
     `serverKnowledge` SÍ se comparte con el motor de puntos (es agnóstico de puntos: solo
     necesita número de game/set, ver engine.js §"RESOLUCIÓN DE SAQUE").
     ====================================================================== */
  function computeGameState() {
    return E.computeGameStateFromEvents(gameEvents, currentFormat(), null);
  }

  function resolveCurrentGameServer(state) {
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumberGames(state);
    const withinSetGameNumber = E.currentWithinSetGameNumberGames(state);
    return E.resolveServer(serverKnowledge, match.players, setNumber, matchGameNumber, withinSetGameNumber);
  }

  /** V13 (§4): un toque en la zona = "esa pareja ganó el game". En el score de disparo del
   *  Tie break (§14), el mismo toque significa "esa pareja ganó el Tie break" — se abre el
   *  flujo de TB con el ganador ya preseleccionado en vez de registrar un game normal. */
  function registerGameWin(team) {
    const state = computeGameState();
    if (state.matchWinner) return;
    const format = currentFormat();
    if (E.gamesModeAtTiebreakTrigger(state, format)) { openGameTiebreakFlow(team, false, null); return; }
    gameEvents.push({ team, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() });
    renderGamesMode();
  }

  function undoLastGame() {
    if (gameEvents.length === 0) { showToast('No hay games para deshacer'); return; }
    const wasFinished = !!finishedSnapshot;
    gameEvents.pop();
    if (wasFinished) Store.removeFromHistory(match.id);
    finishedSnapshot = null;
    manualFinish = null;
    // V02.1 (§13) — el Resumen (antes overlay sobre #view-match, ahora #view-analysis con
    // vista propia) ya no queda "detrás" del marcador: hay que volver explícitamente.
    if (wasFinished) showView('match');
    if (!timer.pausedAt) startTimerLoop();
    if (wasFinished) { matchIsActive = true; requestWakeLock(); } // V13.2 (§1): el partido vuelve a estar activo
    renderGamesMode();
    showToast('Último game deshecho');
  }

  function saveHighlightGames() {
    const state = computeGameState();
    const serverInfo = resolveCurrentGameServer(state);
    const entry = {
      timestamp: new Date().toISOString(),
      matchTimeMs: getElapsedMs(),
      set: state.sets.length + 1,
      games: { a: state.gamesA, b: state.gamesB },
      score: { gamesOnly: true }, // V13 (§9): en Por Games no existe score de puntos que guardar — nunca se inventa
      server: serverInfo.resolved ? { id: serverInfo.playerId, name: playerName(match.players, serverInfo.playerId), team: serverInfo.team } : null,
    };
    highlights.push(entry);
    autosave();
    const btn = $('#highlight-btn');
    btn.classList.add('control-btn--flash');
    setTimeout(() => btn.classList.remove('control-btn--flash'), 550);
    showToast('⭐ Highlight guardado');
    openHighlightPopup(entry);
  }

  function renderGamesMode() {
    const state = computeGameState();
    const format = currentFormat();
    const atTrigger = !state.matchWinner && E.gamesModeAtTiebreakTrigger(state, format);
    const serverInfo = resolveCurrentGameServer(state);

    setScoreText('#score-a', String(state.gamesA));
    setScoreText('#score-b', String(state.gamesB));

    renderGamesStatusBanner(state, format, atTrigger);
    renderGamesScoreboard(state, serverInfo);
    $('#game-progression').hidden = true; // V13 — sin equivalente en games: no hay "puntos recientes" que mostrar
    renderServerPromptGames(state, serverInfo);
    renderZonePlayers(state, serverInfo); // reutilizable tal cual (no lee nada punto-específico)

    if (!manualFinish && state.matchWinner && !finishedSnapshot) {
      finishMatchGames(state, null);
    }
    autosave();
    return state;
  }

  /** V13 (§6): nunca lenguaje de puntos (Set/Break/Match Point). Solo "GAME PARA EL SET" /
   *  "GAME PARA EL PARTIDO" (prioridad al partido), o el aviso de Tie break reglamentario. */
  function renderGamesStatusBanner(state, format, atTrigger) {
    const banner = $('#status-banner');
    $('#tiebreak-mode-select').hidden = true;
    $('#tiebreak-mode-text').hidden = true;
    $('#etb-definition-label').hidden = true;
    $('#scoring-system-change-btn').hidden = true; // V13.4 (§7): en Por Games "CAMBIAR" no existe acá, se cambia solo desde ☰

    let bandKind = 'none', bandLabel = '', bandTeam = null;
    if (!state.matchWinner) {
      if (atTrigger) {
        bandKind = 'tiebreak'; bandLabel = 'TIE BREAK REGLAMENTARIO · TOCÁ LA PAREJA GANADORA';
      } else {
        const need = Math.ceil(format.bestOfSets / 2);
        ['A', 'B'].forEach((team) => {
          const gw = (team === 'A' ? state.gamesA : state.gamesB) + 1;
          const gl = team === 'A' ? state.gamesB : state.gamesA;
          if (!(gw >= format.setWinTarget && gw - gl >= 2)) return;
          const setsWon = (team === 'A' ? state.setsWonA : state.setsWonB) + 1;
          if (setsWon >= need) { bandKind = 'match'; bandLabel = 'GAME PARA EL PARTIDO'; bandTeam = bandTeam && bandTeam !== team ? 'both' : team; }
          else if (bandKind !== 'match') { bandKind = 'set'; bandLabel = 'GAME PARA EL SET'; bandTeam = bandTeam && bandTeam !== team ? 'both' : team; }
        });
      }
    }
    banner.className = 'status-banner status-banner--' + bandKind;
    if (bandTeam) banner.classList.add('status-banner--team-' + bandTeam.toLowerCase());
    if (bandKind === 'match') banner.classList.add('status-banner--escalate-match');
    else if (bandKind === 'set') banner.classList.add('status-banner--escalate-set');
    $('#status-banner-primary').textContent = bandLabel;
    banner.hidden = bandKind === 'none';
  }

  function renderGamesScoreboard(state, serverInfo) {
    renderNamesRowGames('#scoreboard-names-a', teamPlayers(match.players, 'A'), serverInfo);
    renderNamesRowGames('#scoreboard-names-b', teamPlayers(match.players, 'B'), serverInfo);
    renderGamesCellsRow('#scoreboard-cells-a', state, 'A');
    renderGamesCellsRow('#scoreboard-cells-b', state, 'B');
  }

  /** Igual que `renderNamesRow` del motor de puntos, salvo el handler de corrección de
   *  sacador (dedicado a games, ver más abajo). */
  function renderNamesRowGames(sel, players, serverInfo) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    players.forEach((p, i) => {
      if (i > 0) { const sep = document.createElement('span'); sep.className = 'scoreboard__sep'; sep.textContent = '/'; wrap.appendChild(sep); }
      const span = document.createElement('span');
      span.className = 'scoreboard__player';
      if (serverInfo && serverInfo.resolved && serverInfo.playerId === p.id) span.classList.add('is-serving');
      span.textContent = p.name;
      span.addEventListener('click', openServerCorrectionModalGames);
      wrap.appendChild(span);
    });
  }

  /** Igual que `renderCellsRow` sin la celda de puntos (§21: en Por Games no hay puntos que mostrar). */
  function renderGamesCellsRow(sel, state, team) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    state.sets.forEach((set) => {
      const cell = document.createElement('span');
      const mine = team === 'A' ? set.gamesA : set.gamesB;
      const theirs = team === 'A' ? set.gamesB : set.gamesA;
      cell.className = 'scoreboard__cell ' + (mine > theirs ? 'scoreboard__cell--done-win' : 'scoreboard__cell--done-lose');
      cell.textContent = mine;
      wrap.appendChild(cell);
    });
    const current = document.createElement('span');
    current.className = 'scoreboard__cell scoreboard__cell--current';
    current.dataset.teamColor = team;
    current.textContent = team === 'A' ? state.gamesA : state.gamesB;
    wrap.appendChild(current);
  }

  function renderServerPromptGames(state, serverInfo) {
    const prompt = $('#server-prompt');
    if (serverInfo.resolved || state.matchWinner) { prompt.hidden = true; lastServerPromptCtx = null; return; }
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumberGames(state);
    const withinSetGameNumber = E.currentWithinSetGameNumberGames(state);
    lastServerPromptCtx = { setNumber, matchGameNumber, withinSetGameNumber };
    prompt.hidden = false;
    const optionsWrap = $('#server-prompt-options');
    optionsWrap.innerHTML = '';
    serverInfo.candidatePlayers.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'server-chip-btn'; btn.textContent = p.name;
      btn.addEventListener('click', () => {
        serverKnowledge = E.recordServerAnswer(serverKnowledge, match.players, lastServerPromptCtx.setNumber, lastServerPromptCtx.matchGameNumber, lastServerPromptCtx.withinSetGameNumber, p.id);
        renderGamesMode();
      });
      optionsWrap.appendChild(btn);
    });
  }

  /** Igual que `openServerCorrectionModal` del motor de puntos, sin la rama de "hay puntos
   *  en curso": en Por Games un game es atómico, nunca hay puntos a medio jugar dentro de él. */
  function openServerCorrectionModalGames() {
    const state = computeGameState();
    if (state.matchWinner) return;
    $('#server-correction-title').textContent = '¿QUIÉN ESTÁ SACANDO?';
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumberGames(state);
    const withinSetGameNumber = E.currentWithinSetGameNumberGames(state);
    const optionsWrap = $('#server-correction-options');
    optionsWrap.innerHTML = '';
    match.players.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'server-radio';
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        $('#server-correction-modal').hidden = true;
        serverKnowledge = E.recordServerCorrection(serverKnowledge, match.players, setNumber, matchGameNumber, withinSetGameNumber, p.id);
        renderGamesMode();
        showToast('Sacador corregido');
      });
      optionsWrap.appendChild(btn);
    });
    $('#server-correction-modal').hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* V13 (§14-17) — FLUJO DE TIE BREAK EN POR GAMES: ganador obligatorio + score interno
   *  opcional, resuelto en un solo paso. Sirve para el TB reglamentario (ganador ya
   *  conocido por el toque en la zona) y para "Resolver con Tie break" extraordinario
   *  desde el menú (ahí sí hace falta el paso de elegir ganador). */
  /* ------------------------------------------------------------------ */
  let gameTbDraft = null; // { team, extraordinary, winTarget, requireDiff2, scoreA, scoreB, scoreKnown }

  function openGameTiebreakFlow(presetTeam, extraordinary, etbParams) {
    gameTbDraft = {
      team: presetTeam || null,
      extraordinary: !!extraordinary,
      winTarget: etbParams ? etbParams.winTarget : 7,
      requireDiff2: etbParams ? etbParams.requireDiff2 : true,
      scoreA: null, scoreB: null, scoreKnown: false,
    };
    $('#game-tb-modal-title').textContent = extraordinary ? 'RESOLVER CON TIE BREAK' : 'TIE BREAK';
    renderGameTbModal();
    $('#game-tb-modal').hidden = false;
  }

  function renderGameTbModal() {
    const needsWinner = !gameTbDraft.team;
    $('#game-tb-winner-section').hidden = !needsWinner;
    $all('#game-tb-winner-options .option-pill').forEach((btn) => btn.classList.toggle('is-selected', btn.dataset.team === gameTbDraft.team));
    $('#game-tb-score-section').hidden = needsWinner;
    $('#game-tb-confirm').hidden = needsWinner;
    if (!needsWinner) {
      const winnerName = S.teamLabel(match.players, gameTbDraft.team);
      $('#game-tb-score-label').textContent = `Ganó ${winnerName} · ¿Sabés el resultado del Tie break?`;
      $('#game-tb-score-a').textContent = gameTbDraft.scoreKnown ? gameTbDraft.scoreA : '–';
      $('#game-tb-score-b').textContent = gameTbDraft.scoreKnown ? gameTbDraft.scoreB : '–';
    }
    $('#game-tb-error').hidden = true;
  }

  /** V02.1 (§6) — fix real del bug "no deja poner más de 7": la versión anterior exigía que
   *  CADA toque del stepper produjera, por sí solo, un resultado FINAL válido (alguien recién
   *  ganado) — así que subir el ganador (7→8) o subir el perdedor (5→6) por separado siempre
   *  caía en un estado "todavía no es un final válido" y quedaba rechazado en silencio. El
   *  stepper ahora solo suma/resta libremente (sin techo artificial — §6 del consolidado), y
   *  la validación real (¿es un resultado final legítimo, con el ganador correcto?) se hace
   *  UNA vez, recién al confirmar — igual criterio que la carga manual, que tampoco valida
   *  cada dígito tecleado como si ya fuera el resultado completo. */
  function applyGameTbStepper(field, delta) {
    let a = gameTbDraft.scoreA, b = gameTbDraft.scoreB;
    if (!gameTbDraft.scoreKnown) {
      a = gameTbDraft.team === 'A' ? gameTbDraft.winTarget : Math.max(0, gameTbDraft.winTarget - 2);
      b = gameTbDraft.team === 'B' ? gameTbDraft.winTarget : Math.max(0, gameTbDraft.winTarget - 2);
    } else if (field === 'gtb-a') { a += delta; } else { b += delta; }
    if (a < 0 || b < 0) return;
    gameTbDraft.scoreA = a; gameTbDraft.scoreB = b; gameTbDraft.scoreKnown = true;
    renderGameTbModal();
  }

  function confirmGameTbModal(omit) {
    if (!gameTbDraft || !gameTbDraft.team) return;
    if (!omit && gameTbDraft.scoreKnown) {
      const cfg = { winTarget: gameTbDraft.winTarget, requireDiff2: gameTbDraft.requireDiff2 };
      if (!E.isValidFinalTiebreakScore(gameTbDraft.scoreA, gameTbDraft.scoreB, cfg)) {
        $('#game-tb-error').hidden = false;
        $('#game-tb-error').textContent = 'Ese resultado no es válido para este tie break (mínimo ' + cfg.winTarget + ' puntos y 2 de diferencia).';
        return;
      }
      const winnerWon = gameTbDraft.team === 'A' ? gameTbDraft.scoreA > gameTbDraft.scoreB : gameTbDraft.scoreB > gameTbDraft.scoreA;
      if (!winnerWon) {
        $('#game-tb-error').hidden = false;
        $('#game-tb-error').textContent = `El resultado tiene que reflejar la victoria de ${S.teamLabel(match.players, gameTbDraft.team)}.`;
        return;
      }
    }
    const score = (!omit && gameTbDraft.scoreKnown) ? { a: gameTbDraft.scoreA, b: gameTbDraft.scoreB } : null;
    if (gameTbDraft.extraordinary) {
      gameEvents.push({ type: 'extraordinary-tiebreak', team: gameTbDraft.team, score, winTarget: gameTbDraft.winTarget, requireDiff2: gameTbDraft.requireDiff2, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() });
    } else {
      gameEvents.push({ type: 'tiebreak', team: gameTbDraft.team, score, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() });
    }
    $('#game-tb-modal').hidden = true;
    gameTbDraft = null;
    finishedSnapshot = null; manualFinish = null;
    renderGamesMode();
  }

  function initGameTbModal() {
    $('#game-tb-close-x').addEventListener('click', () => { $('#game-tb-modal').hidden = true; gameTbDraft = null; });
    $('#game-tb-cancel').addEventListener('click', () => { $('#game-tb-modal').hidden = true; gameTbDraft = null; });
    $all('#game-tb-winner-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => { gameTbDraft.team = btn.dataset.team; renderGameTbModal(); });
    });
    $all('#game-tb-modal .stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyGameTbStepper(btn.dataset.stepper, Number(btn.dataset.delta)));
    });
    $('#game-tb-omit-btn').addEventListener('click', () => confirmGameTbModal(true));
    $('#game-tb-confirm').addEventListener('click', () => confirmGameTbModal(false));
  }

  /* ------------------------------------------------------------------ */
  /* V13 (§10-12) — EDITAR EN POR GAMES: corrección rápida (steppers 0-6 del set actual) con
   *  revelado progresivo hacia la edición profunda (sets ya finalizados). Un solo `adjustment`
   *  al guardar — nunca fabrica el orden real de los games corregidos (§11). */
  /* ------------------------------------------------------------------ */
  let gamesEditDraft = null;

  function gamesEnumerateValidCompletedPairs(format) {
    const pairs = [];
    for (let a = 0; a <= format.setWinTarget + 1; a++) {
      for (let b = 0; b <= format.setWinTarget + 1; b++) {
        if (E.isValidCompletedSetScore(a, b, format)) pairs.push({ a, b });
      }
    }
    return pairs;
  }

  function gamesDraftMatchDecided() {
    const format = currentFormat();
    const need = Math.ceil(format.bestOfSets / 2);
    const setsWonA = gamesEditDraft.finishedSets.filter((s) => s.gamesA > s.gamesB).length;
    const setsWonB = gamesEditDraft.finishedSets.filter((s) => s.gamesB > s.gamesA).length;
    return setsWonA >= need || setsWonB >= need;
  }
  function gamesDraftWinner() {
    const format = currentFormat();
    const need = Math.ceil(format.bestOfSets / 2);
    const setsWonA = gamesEditDraft.finishedSets.filter((s) => s.gamesA > s.gamesB).length;
    const setsWonB = gamesEditDraft.finishedSets.filter((s) => s.gamesB > s.gamesA).length;
    if (setsWonA >= need) return 'A';
    if (setsWonB >= need) return 'B';
    return null;
  }

  function openAdjustGamesModal() {
    const state = computeGameState();
    gamesEditDraft = {
      finishedSets: state.sets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: s.tiebreak })),
      curA: state.gamesA, curB: state.gamesB,
      expanded: false,
      pendingAddTbA: 0, pendingAddTbB: 0, pendingAddTbUnknown: true,
    };
    $('#games-editor-deep').hidden = true;
    $('#games-editor-expand-btn').hidden = false;
    renderGamesEditModal();
    $('#games-editor-modal').hidden = false;
  }

  /** Picker 0-N estilo "paradas" (mismo componente visual que Ajustar de puntos, ver
   *  `renderPointTrack`), pero para un valor entero cualquiera (games), no 0-15-30-40. */
  function renderGamesStepperTrack(sel, currentVal, maxVal, onSelect) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    wrap.classList.add('point-track--games');
    for (let v = 0; v <= maxVal; v++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'point-track__stop' + (currentVal === v ? ' is-selected' : '');
      btn.textContent = String(v);
      btn.addEventListener('click', () => onSelect(v));
      wrap.appendChild(btn);
    }
  }

  function renderGamesEditModal() {
    const format = currentFormat();
    const decided = gamesDraftMatchDecided();
    const singleSetFormat = format.bestOfSets === 1;
    if (singleSetFormat && gamesEditDraft.finishedSets.length) gamesEditDraft.finishedSets = [];

    $('#games-editor-cur-label-a').hidden = decided;
    $('#games-editor-cur-track-a').hidden = decided;
    $('#games-editor-cur-label-b').hidden = decided;
    $('#games-editor-cur-track-b').hidden = decided;
    if (!decided) {
      // §14: nunca se persiste el score EXACTO de disparo del TB como "actual" — ese
      // score se resuelve al instante (ver §4-17), así que el rango de "set en curso"
      // excluye ese único valor (trigger-trigger).
      const maxVal = format.setWinTarget + 1;
      renderGamesStepperTrack('#games-editor-cur-track-a', gamesEditDraft.curA, maxVal, (v) => {
        if (!gamesEditorInProgressValid(v, gamesEditDraft.curB, format)) return;
        gamesEditDraft.curA = v; renderGamesEditModal();
      });
      renderGamesStepperTrack('#games-editor-cur-track-b', gamesEditDraft.curB, maxVal, (v) => {
        if (!gamesEditorInProgressValid(gamesEditDraft.curA, v, format)) return;
        gamesEditDraft.curB = v; renderGamesEditModal();
      });
    }

    $('#games-editor-deep').hidden = !gamesEditDraft.expanded;
    $('#games-editor-expand-btn').hidden = gamesEditDraft.expanded;
    if (gamesEditDraft.expanded) {
      $('#games-editor-add-set-row').hidden = decided || singleSetFormat;
      const chipsWrap = $('#games-editor-finished-sets-list');
      chipsWrap.innerHTML = '';
      gamesEditDraft.finishedSets.forEach((s, idx) => {
        const chip = document.createElement('span');
        chip.className = 'edit-chip';
        const tbTxt = s.tiebreak ? ` (TB ${s.tiebreak.a}-${s.tiebreak.b})` : (E.completedSetHasTiebreak(s.gamesA, s.gamesB, format) ? ' (TB ?)' : '');
        chip.innerHTML = `<span>${s.gamesA}–${s.gamesB}${tbTxt}</span>`;
        const rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'edit-chip__remove'; rm.textContent = '✕';
        rm.addEventListener('click', () => { gamesEditDraft.finishedSets.splice(idx, 1); renderGamesEditModal(); });
        chip.appendChild(rm);
        chipsWrap.appendChild(chip);
      });
      if (!decided && !singleSetFormat) {
        const select = $('#games-editor-add-set-select');
        const pairs = gamesEnumerateValidCompletedPairs(format);
        select.innerHTML = pairs.map((p) => `<option value="${p.a}-${p.b}">${p.a}–${p.b}</option>`).join('');
        const showTbRowIfNeeded = () => {
          const [a, b] = select.value.split('-').map(Number);
          const hasTb = E.completedSetHasTiebreak(a, b, format);
          $('#games-editor-add-set-tb-row').hidden = !hasTb;
          if (hasTb) {
            const cfg = E.tiebreakModeConfig('classic');
            gamesEditDraft.pendingAddTbA = a > b ? cfg.winTarget : cfg.winTarget - 2;
            gamesEditDraft.pendingAddTbB = a > b ? cfg.winTarget - 2 : cfg.winTarget;
            $('#games-editor-add-tb-a').textContent = gamesEditDraft.pendingAddTbA;
            $('#games-editor-add-tb-b').textContent = gamesEditDraft.pendingAddTbB;
          }
        };
        select.onchange = showTbRowIfNeeded;
        showTbRowIfNeeded();
      }
    }
    $('#games-editor-error').hidden = true;
  }

  /** Rango válido de "set en curso" en Por Games: reutiliza el validador reglamentario de
   *  siempre, pero excluye el score exacto de disparo del TB (esa situación nunca se
   *  persiste como "actual" — se resuelve al instante, §14). */
  function gamesEditorInProgressValid(a, b, format) {
    if (a < 0 || b < 0) return false;
    if (!E.isValidInProgressSetScore(a, b, format)) return false;
    if (a === format.tiebreakTriggerAt && b === format.tiebreakTriggerAt) return false;
    return true;
  }

  function saveGamesEditDraft() {
    const format = currentFormat();
    const decided = gamesDraftMatchDecided();
    const winner = gamesDraftWinner();
    const sets = gamesEditDraft.finishedSets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: s.tiebreak, winner: s.gamesA > s.gamesB ? 'A' : 'B' }));
    const curA = decided ? 0 : gamesEditDraft.curA;
    const curB = decided ? 0 : gamesEditDraft.curB;
    const gameIndex = E.computeGameIndexFromParts(sets, curA, curB);

    const newState = {
      sets, gamesA: curA, gamesB: curB, gameIndex,
      setsWonA: sets.filter((s) => s.winner === 'A').length,
      setsWonB: sets.filter((s) => s.winner === 'B').length,
      matchWinner: decided ? winner : null,
      extraordinaryTiebreak: null,
    };
    const stateLabel = decided ? `Partido completo (${sets.length} sets)` : `Set ${sets.length + 1} · ${curA}-${curB}`;
    const beforeState = computeGameState();
    const scoreBeforeLabel = `${beforeState.gamesA}-${beforeState.gamesB}`;
    gameEvents.push({
      type: 'adjustment', timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs(), newState,
      scoreBeforeLabel, scoreAfterLabel: stateLabel,
    });
    $('#games-editor-modal').hidden = true;
    finishedSnapshot = null;
    manualFinish = null;
    renderGamesMode();
    showToast('Marcador actualizado');
  }

  function initGamesEditModal() {
    $('#games-editor-close-x').addEventListener('click', () => { $('#games-editor-modal').hidden = true; });
    $('#games-editor-cancel').addEventListener('click', () => { $('#games-editor-modal').hidden = true; });
    $('#games-editor-expand-btn').addEventListener('click', () => { gamesEditDraft.expanded = true; renderGamesEditModal(); });
    $('#games-editor-add-set-btn').addEventListener('click', () => {
      const format = currentFormat();
      const [a, b] = $('#games-editor-add-set-select').value.split('-').map(Number);
      const hasTb = E.completedSetHasTiebreak(a, b, format);
      let tiebreak = null;
      if (hasTb && !gamesEditDraft.pendingAddTbUnknown) tiebreak = { a: gamesEditDraft.pendingAddTbA, b: gamesEditDraft.pendingAddTbB };
      gamesEditDraft.finishedSets.push({ gamesA: a, gamesB: b, tiebreak });
      renderGamesEditModal();
    });
    $all('#games-editor-modal [data-stepper]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.stepper;
        const delta = Number(btn.dataset.delta);
        gamesEditDraft.pendingAddTbUnknown = false;
        const a = field === 'gadd-tb-a' ? gamesEditDraft.pendingAddTbA + delta : gamesEditDraft.pendingAddTbA;
        const b = field === 'gadd-tb-b' ? gamesEditDraft.pendingAddTbB + delta : gamesEditDraft.pendingAddTbB;
        if (a < 0 || b < 0) return;
        const [selA, selB] = $('#games-editor-add-set-select').value.split('-').map(Number);
        const winnerIsA = selA > selB;
        const winnerScore = winnerIsA ? a : b, loserScore = winnerIsA ? b : a;
        if (!E.isValidTiebreakScore(a, b, 'classic')) return;
        if (E.tiebreakIsWon(loserScore, winnerScore, 'classic')) return;
        gamesEditDraft.pendingAddTbA = a; gamesEditDraft.pendingAddTbB = b;
        $('#games-editor-add-tb-a').textContent = a; $('#games-editor-add-tb-b').textContent = b;
      });
    });
    $('#games-editor-confirm').addEventListener('click', saveGamesEditDraft);
  }

  /* ------------------------------------------------------------------ */
  /* CORREGIR SACADOR (V12 §5) — a diferencia de `renderServerPrompt` (arriba, para cuando
     el saque es DESCONOCIDO), esto corrige un saque YA resuelto que se marcó mal. Usa
     `E.recordServerCorrection` (snapshot congelado, engine.js) en vez de
     `recordServerAnswer` a secas, para no tocar retroactivamente la rotación de games
     anteriores del mismo set (§5.3). Alcance: solo en el game normal en curso — durante un
     Tie break la rotación se resuelve por punto individual dentro del propio TB, un caso
     más ambiguo que sigue cubierto por EDITAR. */
  /* ------------------------------------------------------------------ */
  function openServerCorrectionModal() {
    const state = computeState();
    if (state.inTiebreak) { showToast('Durante el Tie break, corregí el sacador desde Editar.'); return; }
    if (state.matchWinner) return;
    $('#server-correction-title').textContent = '¿QUIÉN ESTÁ SACANDO?';
    const setNumber = state.sets.length + 1;
    const matchGameNumber = E.currentMatchGameNumber(state);
    const withinSetGameNumber = E.currentWithinSetGameNumber(state);
    const hasPointsInGame = (state.pointsA + state.pointsB) > 0;

    const optionsWrap = $('#server-correction-options');
    optionsWrap.innerHTML = '';
    match.players.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'server-radio';
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        $('#server-correction-modal').hidden = true;
        const applyCorrection = () => {
          serverKnowledge = E.recordServerCorrection(serverKnowledge, match.players, setNumber, matchGameNumber, withinSetGameNumber, p.id);
          render();
          showToast('Sacador corregido');
        };
        if (hasPointsInGame) {
          confirmAction('Cambiar sacador de este game', 'Los puntos registrados se reasignarán al sacador correcto.', applyCorrection);
        } else {
          applyCorrection();
        }
      });
      optionsWrap.appendChild(btn);
    });
    $('#server-correction-modal').hidden = false;
  }

  function initServerCorrectionModal() {
    $('#server-correction-close-x').addEventListener('click', () => { $('#server-correction-modal').hidden = true; pendingEtbStart = null; });
    $('#server-correction-cancel').addEventListener('click', () => { $('#server-correction-modal').hidden = true; pendingEtbStart = null; });
  }

  /* ------------------------------------------------------------------ */
  /* RESOLVER CON TIE BREAK EXTRAORDINARIO (V12 §9-14) — "los jugadores acordaron resolver
     el set/partido con un Tie break sin llegar reglamentariamente a N-N". Reusa
     `E.startExtraordinaryTiebreak`/`E.isValidExtraordinaryTargetChange` (engine.js) y el
     mecanismo de `adjustment` de siempre — nunca fabrica games (§13). El modal de selección
     de modalidad (`#etb-modal`) se reusa tal cual para arrancar el TB (§10) y para
     "Editar definición" en vivo (§12) — misma UI, distinto título/acción al confirmar. */
  /* ------------------------------------------------------------------ */
  let etbDraft = null; // { presetId: 'classic'|'death7'|'to15'|'custom', target, requireDiff2 }
  let etbEditing = false;
  let pendingEtbStart = null; // { winTarget, requireDiff2 } — entre elegir modalidad y elegir sacador

  function etbTargetLabel(target, requireDiff2) {
    return requireDiff2 ? `TB A ${target} · +2` : `TB A ${target} · MUERE`;
  }

  /** V12 (§19, excepción explícita) — Timeline/Historial: un ajuste que resuelve un Tie
   *  break extraordinario no es "un ajuste de marcador" genérico — se distingue con su
   *  propia etiqueta, arrancar vs. cambiar el objetivo en vivo (§9-12). */
  function etbAdjustmentLabel(ev, beforeState, genericPrefix) {
    const etb = ev.newState && ev.newState.extraordinaryTiebreak && ev.newState.extraordinaryTiebreak.active ? ev.newState.extraordinaryTiebreak : null;
    if (!etb) return `${genericPrefix} · ${ev.scoreBeforeLabel} → ${ev.scoreAfterLabel}`;
    if (!beforeState.inTiebreak) return `🏆 RESOLVER CON TIE BREAK · ${ev.scoreBeforeLabel} → ${ev.scoreAfterLabel}`;
    return `🏆 EDITAR DEFINICIÓN DE TIE BREAK · ${ev.scoreBeforeLabel} → ${ev.scoreAfterLabel}`;
  }

  function openExtraordinaryTbSelector() {
    if (isGamesMode()) {
      const gState = computeGameState();
      if (!E.canStartExtraordinaryGameTiebreak(gState)) { showToast('El partido ya está definido.'); return; }
      etbEditing = false;
      etbDraft = { presetId: 'classic', target: 7, requireDiff2: true };
      $('#etb-modal-title').textContent = 'RESOLVER CON TIE BREAK';
      $('#etb-confirm').textContent = 'CONTINUAR';
      renderEtbModal();
      $('#etb-modal').hidden = false;
      return;
    }
    const state = computeState();
    if (!E.canStartExtraordinaryTiebreak(state)) { showToast('Solo se puede resolver con Tie break al empezar un game nuevo (0-0).'); return; }
    etbEditing = false;
    etbDraft = { presetId: 'classic', target: 7, requireDiff2: true };
    $('#etb-modal-title').textContent = 'RESOLVER CON TIE BREAK';
    $('#etb-confirm').textContent = 'INICIAR TIE BREAK';
    renderEtbModal();
    $('#etb-modal').hidden = false;
  }

  /** Identifica si la definición ACTUAL de un TB extraordinario coincide con uno de los 3
   *  presets (§10.1) — si no, es porque se eligió "Otro" con un objetivo personalizado. */
  function etbPresetIdFor(cfg) {
    return Object.keys(E.TIEBREAK_MODES).find((id) => E.TIEBREAK_MODES[id].winTarget === cfg.winTarget && E.TIEBREAK_MODES[id].requireDiff2 === cfg.requireDiff2) || 'custom';
  }

  function openEtbEditor() {
    const state = computeState();
    if (!(state.inTiebreak && state.extraordinaryTiebreak && state.extraordinaryTiebreak.active)) return;
    etbEditing = true;
    const cur = state.extraordinaryTiebreak;
    etbDraft = { presetId: etbPresetIdFor(cur), target: cur.winTarget, requireDiff2: cur.requireDiff2 };
    $('#etb-modal-title').textContent = 'EDITAR DEFINICIÓN';
    $('#etb-confirm').textContent = 'GUARDAR DEFINICIÓN';
    renderEtbModal();
    $('#etb-modal').hidden = false;
  }

  function renderEtbModal() {
    $all('#etb-preset-options .option-pill').forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.preset === etbDraft.presetId);
    });
    const isCustom = etbDraft.presetId === 'custom';
    $('#etb-custom-section').hidden = !isCustom;
    if (isCustom) {
      $('#etb-target-value').textContent = etbDraft.target;
      $('#etb-death-label').textContent = `Muere en ${etbDraft.target}`;
      $all('#etb-rule-options .option-pill').forEach((btn) => {
        btn.classList.toggle('is-selected', (btn.dataset.rule === 'diff2') === etbDraft.requireDiff2);
      });
    }
    $('#etb-error').hidden = true;
  }

  function confirmEtbModal() {
    const target = etbDraft.target;
    const requireDiff2 = etbDraft.requireDiff2;
    if (isGamesMode()) {
      // V13 (§17): en Por Games no hay edición en vivo del objetivo (el TB se resuelve en
      // un solo paso, nunca "está en curso") — este modal solo elige modalidad/objetivo,
      // el siguiente paso pregunta ganador + score interno opcional.
      $('#etb-modal').hidden = true;
      openGameTiebreakFlow(null, true, { winTarget: target, requireDiff2 });
      return;
    }
    if (etbEditing) {
      const state = computeState();
      if (!E.isValidExtraordinaryTargetChange(state.tbA, state.tbB, target)) {
        $('#etb-error').textContent = `No se puede bajar el objetivo por debajo de lo ya jugado (${Math.max(state.tbA, state.tbB)}-${Math.min(state.tbA, state.tbB)}).`;
        $('#etb-error').hidden = false;
        return;
      }
      // V12 (§12.3): solo se pisa el objetivo — puntos, servicio y timeline quedan
      // intactos, el próximo punto ya evalúa el nuevo objetivo (engine.js lo lee de
      // `state.extraordinaryTiebreak` en cada `applyPoint`).
      const newState = Object.assign({}, state, { extraordinaryTiebreak: Object.assign({}, state.extraordinaryTiebreak, { winTarget: target, requireDiff2 }) });
      pointEvents.push({
        type: 'adjustment', timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs(), newState,
        scoreBeforeLabel: `TB ${state.tbA}-${state.tbB}`,
        scoreAfterLabel: etbTargetLabel(target, requireDiff2),
      });
      $('#etb-modal').hidden = true;
      etbEditing = false;
      finishedSnapshot = null; manualFinish = null;
      render();
      showToast('Definición del Tie break actualizada');
      return;
    }
    pendingEtbStart = { winTarget: target, requireDiff2 };
    $('#etb-modal').hidden = true;
    openExtraordinaryServerPrompt();
  }

  /** §11 — "¿Quién comienza sacando?": nunca continúa la rotación previa. Reusa el modal de
   *  Corregir Sacador (mismo título dinámico) y `recordServerCorrection` para congelar todo
   *  lo anterior y reanclar la rotación desde el arranque del TB extraordinario. */
  function openExtraordinaryServerPrompt() {
    const state = computeState();
    const newState = E.startExtraordinaryTiebreak(state, pendingEtbStart.winTarget, pendingEtbStart.requireDiff2);
    if (!newState) { showToast('No se puede resolver con Tie break en este momento.'); pendingEtbStart = null; return; }
    $('#server-correction-title').textContent = '¿QUIÉN COMIENZA SACANDO?';
    const setNumber = state.sets.length + 1;
    const optionsWrap = $('#server-correction-options');
    optionsWrap.innerHTML = '';
    match.players.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'server-radio';
      btn.textContent = p.name;
      btn.addEventListener('click', () => {
        $('#server-correction-modal').hidden = true;
        serverKnowledge = E.recordServerCorrection(serverKnowledge, match.players, setNumber, newState.tbBaseGameNumber, newState.tbBaseWithinSet, p.id);
        pointEvents.push({
          type: 'adjustment', timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs(), newState,
          scoreBeforeLabel: `${state.gamesA}-${state.gamesB}`,
          scoreAfterLabel: `${state.gamesA}-${state.gamesB} · ${etbTargetLabel(newState.extraordinaryTiebreak.winTarget, newState.extraordinaryTiebreak.requireDiff2)} iniciado`,
        });
        pendingEtbStart = null;
        finishedSnapshot = null; manualFinish = null;
        render();
        showToast('Tie break extraordinario iniciado');
      });
      optionsWrap.appendChild(btn);
    });
    $('#server-correction-modal').hidden = false;
  }

  function initEtbModal() {
    $('#menu-extraordinary-tb').addEventListener('click', () => { $('#menu-overlay').hidden = true; openExtraordinaryTbSelector(); });
    $('#etb-definition-label').addEventListener('click', openEtbEditor);
    $all('#etb-preset-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.dataset.preset;
        const wasCustom = etbDraft.presetId === 'custom';
        etbDraft.presetId = presetId;
        if (presetId !== 'custom') {
          const cfg = E.TIEBREAK_MODES[presetId];
          etbDraft.target = cfg.winTarget;
          etbDraft.requireDiff2 = cfg.requireDiff2;
        } else if (!wasCustom) {
          // V12 (§10.2): default de "Otro" es Diferencia de 2, con un target de partida
          // razonable (12) — pero solo al ENTRAR a "Otro" desde otro preset; si ya estaba
          // en "Otro", se conserva lo que el usuario ya venía ajustando con los steppers.
          etbDraft.target = 12;
          etbDraft.requireDiff2 = true;
        }
        renderEtbModal();
      });
    });
    $('#etb-target-minus').addEventListener('click', () => { etbDraft.target = Math.max(1, etbDraft.target - 1); renderEtbModal(); });
    $('#etb-target-plus').addEventListener('click', () => { etbDraft.target = etbDraft.target + 1; renderEtbModal(); });
    $all('#etb-rule-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => { etbDraft.requireDiff2 = btn.dataset.rule === 'diff2'; renderEtbModal(); });
    });
    $('#etb-cancel').addEventListener('click', () => { $('#etb-modal').hidden = true; etbEditing = false; });
    $('#etb-close-x').addEventListener('click', () => { $('#etb-modal').hidden = true; etbEditing = false; });
    $('#etb-confirm').addEventListener('click', confirmEtbModal);
  }

  /** Solo se muestra mientras hay un Tie break extraordinario activo; oculta de paso el
   *  selector de modalidad NORMAL (§10 ya fijó su propio objetivo — mostrar los dos
   *  controles juntos sería confuso, viola el principio de un solo estado por franja). */
  function renderEtbDefinitionLabel(state) {
    const label = $('#etb-definition-label');
    const active = !!(state.inTiebreak && state.extraordinaryTiebreak && state.extraordinaryTiebreak.active);
    label.hidden = !active;
    if (active) {
      label.textContent = etbTargetLabel(state.extraordinaryTiebreak.winTarget, state.extraordinaryTiebreak.requireDiff2);
      $('#tiebreak-mode-text').hidden = true;
      $('#tiebreak-mode-select').hidden = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /* INTERACCIÓN — puntos, deshacer, highlight                           */
  /* ------------------------------------------------------------------ */
  function registerPoint(team) {
    const state = computeState();
    if (state.matchWinner) return;
    const ev = { team, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() };
    // Si el punto se juega durante un tie break, se graba el modo VIGENTE en
    // ese instante — así un cambio de modalidad posterior nunca reinterpreta
    // puntos ya jugados (bug #49/#50 de la revisión anterior).
    if (state.inTiebreak) ev.tbMode = match.tiebreakMode;
    pointEvents.push(ev);
    render();
  }

  function undoLastPoint() {
    if (pointEvents.length === 0) { showToast('No hay puntos para deshacer'); return; }
    const wasFinished = !!finishedSnapshot;
    pointEvents.pop();
    if (wasFinished) Store.removeFromHistory(match.id); // evita que quede una copia "fantasma" finalizada
    finishedSnapshot = null;
    manualFinish = null;
    // V02.1 (§13) — mismo criterio que undoLastGame: el Resumen ya no es un overlay sobre el
    // marcador, hay que volver explícitamente a #view-match.
    if (wasFinished) showView('match');
    if (!timer.pausedAt) startTimerLoop();
    if (wasFinished) { matchIsActive = true; requestWakeLock(); } // V13.2 (§1): el partido vuelve a estar activo
    render();
    showToast('Último punto deshecho');
  }

  /** Reanudar un partido finalizado MANUALMENTE: no borra ningún punto, solo quita el estado de finalización. */
  function resumeMatch() {
    Store.removeFromHistory(match.id);
    manualFinish = null;
    finishedSnapshot = null;
    showView('match'); // V02.1 (§13) — mismo criterio que undoLastPoint/undoLastGame
    if (timer.pausedAt) { $('#pause-overlay').hidden = false; } else { startTimerLoop(); }
    matchIsActive = true; requestWakeLock(); // V13.2 (§1): el partido vuelve a estar activo
    if (isGamesMode()) renderGamesMode(); else render();
    showToast('Partido reanudado');
  }

  // V10 (42) — etiquetas visibles de las categorías opcionales de Highlight.
  // V12 (§8.2): "Dejada" se reemplaza por "Blooper" como categoría seleccionable; se
  // conserva `dejada` acá solo para poder seguir mostrando el label de highlights viejos
  // que ya se guardaron con esa categoría antes de este cambio.
  const HIGHLIGHT_CATEGORY_LABELS = { smash: 'Smash / X3', dejada: 'Dejada', blooper: 'Blooper', recuperacion: 'Recuperación', puntazo: 'Puntazo' };
  const HIGHLIGHT_POPUP_TIMEOUT_MS = 3500;
  let highlightPopupTimeoutId = null;
  let highlightPopupTarget = null; // referencia directa al objeto en `highlights` que está esperando categoría

  function saveHighlight() {
    const state = computeState();
    const serverInfo = resolveCurrentServer(state);
    const entry = {
      timestamp: new Date().toISOString(),
      matchTimeMs: getElapsedMs(),
      set: state.sets.length + 1,
      games: { a: state.gamesA, b: state.gamesB },
      score: state.inTiebreak
        ? { tiebreak: true, a: state.tbA, b: state.tbB }
        : { tiebreak: false, pointsA: state.pointsA, pointsB: state.pointsB, scoringSystem: match.scoringSystem },
      server: serverInfo.resolved ? { id: serverInfo.playerId, name: playerName(match.players, serverInfo.playerId), team: serverInfo.team } : null,
    };
    // V10 (40): el Highlight se registra INMEDIATAMENTE — el popup de categoría que sigue
    // es puramente opcional y nunca bloquea ni retrasa este guardado.
    highlights.push(entry);
    autosave();
    const btn = $('#highlight-btn');
    btn.classList.add('control-btn--flash');
    setTimeout(() => btn.classList.remove('control-btn--flash'), 550);
    showToast('⭐ Highlight guardado');
    openHighlightPopup(entry);
  }

  /** V10 (40-41) — popup rápido de categorización: aparece apenas se guarda el Highlight,
   *  se autocierra a los 3-4s (queda como Highlight genérico) y el aro SVG comunica
   *  visualmente el tiempo restante sin necesidad de números. */
  function openHighlightPopup(entry) {
    highlightPopupTarget = entry;
    const popup = $('#highlight-popup');
    const ring = $('#highlight-popup-ring-progress');
    popup.hidden = false;
    // Reinicia la animación del aro: saca la clase, fuerza reflow, la vuelve a poner con
    // la duración exacta del timeout para que el drenaje visual y el auto-cierre coincidan.
    ring.classList.remove('is-draining');
    ring.style.transitionDuration = '0s';
    // eslint-disable-next-line no-unused-expressions
    ring.getBoundingClientRect(); // fuerza reflow
    ring.style.transitionDuration = `${HIGHLIGHT_POPUP_TIMEOUT_MS}ms`;
    ring.classList.add('is-draining');
    clearTimeout(highlightPopupTimeoutId);
    highlightPopupTimeoutId = setTimeout(() => closeHighlightPopup(), HIGHLIGHT_POPUP_TIMEOUT_MS);
  }

  /** Cierra el popup sin tocar el Highlight ya guardado (con o sin categoría elegida). */
  function closeHighlightPopup() {
    clearTimeout(highlightPopupTimeoutId);
    highlightPopupTimeoutId = null;
    highlightPopupTarget = null;
    $('#highlight-popup').hidden = true;
  }

  function initHighlightPopup() {
    $all('#highlight-popup-grid .highlight-popup__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (highlightPopupTarget) { highlightPopupTarget.category = btn.dataset.category; autosave(); }
        // V12 (§8.1): feedback verde de confirmación al elegir categoría, distinto del
        // dorado de "Highlight guardado" y del lima de Team A — breve delay antes de
        // cerrar para que el usuario alcance a verlo.
        clearTimeout(highlightPopupTimeoutId);
        btn.classList.add('is-confirmed');
        setTimeout(() => { btn.classList.remove('is-confirmed'); closeHighlightPopup(); }, 320);
      });
    });
    // Tocar fuera de la tarjeta cierra el popup sin cancelar el Highlight (§40, paso 3C).
    $('#highlight-popup').addEventListener('click', (e) => { if (e.target === $('#highlight-popup')) closeHighlightPopup(); });
  }

  /** Reconstruye la etiqueta de puntuación EXACTA de un highlight (Deuce/Ventaja/Star Point incluidos). */
  function highlightScoreLabel(h) {
    if (h.score.tiebreak) return `${h.score.a}-${h.score.b} (TB)`;
    const disp = E.formatPointsDisplay(h.score.pointsA, h.score.pointsB, h.score.scoringSystem || match.scoringSystem);
    if (disp.centralLabel && disp.aText === disp.bText) return disp.centralLabel; // Deuce / Punto de Oro / Star Point
    return `${disp.aText}-${disp.bText}`;
  }

  /* ------------------------------------------------------------------ */
  /* CRONÓMETRO                                                           */
  /* ------------------------------------------------------------------ */
  function updateTimerDisplay() { $('#match-timer').textContent = formatClock(getElapsedMs()); }
  function startTimerLoop() { stopTimerLoop(); updateTimerDisplay(); timer.intervalId = setInterval(updateTimerDisplay, 1000); }
  function stopTimerLoop() { if (timer.intervalId) { clearInterval(timer.intervalId); timer.intervalId = null; } }
  function togglePause() {
    if (timer.pausedAt) {
      timer.totalPausedMs += Date.now() - timer.pausedAt;
      timer.pausedAt = null;
      $('#pause-overlay').hidden = true;
      startTimerLoop();
    } else {
      timer.pausedAt = Date.now();
      stopTimerLoop();
      $('#pause-overlay').hidden = false;
      updateTimerDisplay();
    }
    autosave();
    updateMenuPauseLabel();
  }
  function updateMenuPauseLabel() { $('#menu-pause').textContent = timer.pausedAt ? 'Reanudar cronómetro' : 'Pausar cronómetro'; }

  /* ------------------------------------------------------------------ */
  /* EDITAR JUGADORES (V13 §18) — cambia el nombre visible; mismo ID por dentro, así que el
   *  cambio es retroactivo a toda la presentación (marcador, Resumen, Análisis, Intelligence,
   *  Historial, Highlights) sin tocar un solo evento ya registrado: todos esos lugares leen
   *  el nombre a través de `playerName(players, id)`/`S.teamLabel`, nunca guardan el string
   *  crudo. Deliberadamente separado de "tocar el indicador de saque" (corrige SACADOR, no
   *  nombres) — solo se accede desde el menú ☰. */
  /* ------------------------------------------------------------------ */
  function openEditPlayersModal() {
    const wrap = $('#edit-players-fields');
    wrap.innerHTML = '';
    match.players.forEach((p) => {
      const field = document.createElement('div');
      field.className = 'edit-field';
      const label = document.createElement('div');
      label.className = 'edit-field__label';
      label.textContent = `Jugador ${p.id + 1}`;
      const input = document.createElement('input');
      input.className = 'field__input';
      input.type = 'text';
      input.maxLength = 18;
      input.value = p.name;
      input.dataset.playerId = String(p.id);
      field.appendChild(label);
      field.appendChild(input);
      wrap.appendChild(field);
    });
    $('#edit-players-modal').hidden = false;
  }

  function saveEditPlayers() {
    const newNames = [];
    $all('#edit-players-fields input').forEach((input) => {
      const id = Number(input.dataset.playerId);
      const player = match.players.find((p) => p.id === id);
      if (!player) return;
      player.name = normalizePlayerName(input.value) || player.name; // nunca vacío
      newNames.push(player.name);
    });
    Store.rememberPlayerNames(newNames);
    $('#edit-players-modal').hidden = true;
    // V13.2 (§4) — BUG REAL: esto llamaba siempre a `render()` (el del motor de puntos),
    // que en Por Games recalcula el estado desde `pointEvents` — vacío en ese modo, así
    // que el marcador mostraba 0-0 hasta el próximo toque (que sí usa el render correcto).
    // El estado real nunca se perdía; era pura desincronización de qué función redibujaba.
    if (isGamesMode()) renderGamesMode(); else render();
    showToast('Jugadores actualizados');
  }

  function initEditPlayersModal() {
    $('#menu-edit-players').addEventListener('click', () => { $('#menu-overlay').hidden = true; openEditPlayersModal(); });
    $('#edit-players-close-x').addEventListener('click', () => { $('#edit-players-modal').hidden = true; });
    $('#edit-players-cancel').addEventListener('click', () => { $('#edit-players-modal').hidden = true; });
    $('#edit-players-save').addEventListener('click', saveEditPlayers);
  }

  /* ------------------------------------------------------------------ */
  /* V13.4 (§1-13) — SISTEMA DE PUNTUACIÓN EN VIVO, REEMPLAZA el modelo V13.3 de "regla por
   *  punto". En Modo Completo el sistema es una propiedad DEL PARTIDO (`match.scoringSystem`,
   *  un único valor): la corrección solo existe para arreglar un dato de configuración
   *  equivocado, nunca para cambiar las reglas hacia adelante. Por eso:
   *    - mientras ningún game "sensible" (uno que llegó a 40-40) haya cerrado, se puede
   *      corregir libremente entre los sistemas que sigan siendo compatibles con el game en
   *      curso (`E.availableScoringSystems` — los incompatibles quedan deshabilitados, §9);
   *    - en cuanto cierra el primer game sensible, `E.isScoringSystemLocked` da true para
   *      siempre y ni el menú ☰ ni "CAMBIAR" vuelven a ofrecer el cambio (§3, §6, §11).
   *  En Por Games el sistema sigue siendo puro metadata (§7, sin tocar): siempre disponible,
   *  nunca bloqueado, nunca deshabilita opciones. Mismo modal para dos entradas: el menú ☰ y
   *  el botón "CAMBIAR" contextual (dentro de la franja, junto al texto central — §8). */
  /* ------------------------------------------------------------------ */
  let pendingScoringSystem = null;

  function completoScoringLocked() {
    return !isGamesMode() && E.isScoringSystemLocked(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
  }

  function openScoringSystemModal() {
    if (completoScoringLocked()) return; // defensivo: el botón/menú ya deberían estar ocultos
    pendingScoringSystem = match.scoringSystem;
    let allowed = E.SCORING_SYSTEMS;
    if (!isGamesMode()) {
      const gameSeq = E.extractCurrentGamePointSequence(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
      allowed = E.availableScoringSystems(gameSeq);
    }
    $all('#scoring-system-options .option-col').forEach((btn) => {
      const value = btn.dataset.value;
      const isAllowed = allowed.indexOf(value) !== -1;
      const selected = value === pendingScoringSystem;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      btn.disabled = !isAllowed;
      btn.classList.toggle('is-disabled', !isAllowed);
    });
    $('#scoring-system-hint').textContent = SCORING_HINTS[pendingScoringSystem];
    $('#scoring-system-modal').hidden = false;
  }

  function initScoringSystemModal() {
    $all('#scoring-system-options .option-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        $all('#scoring-system-options .option-col').forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-selected'); btn.setAttribute('aria-checked', 'true');
        pendingScoringSystem = btn.dataset.value;
        $('#scoring-system-hint').textContent = SCORING_HINTS[pendingScoringSystem];
      });
    });
    $('#scoring-system-cancel').addEventListener('click', () => { $('#scoring-system-modal').hidden = true; });
    $('#scoring-system-modal').addEventListener('click', (e) => { if (e.target === $('#scoring-system-modal')) $('#scoring-system-modal').hidden = true; });
    $('#scoring-system-confirm').addEventListener('click', () => {
      match.scoringSystem = pendingScoringSystem;
      $('#scoring-system-modal').hidden = true;
      $('#match-header-system').textContent = SCORING_SYSTEM_LABELS[match.scoringSystem] || '';
      if (isGamesMode()) renderGamesMode(); else render();
      autosave();
      showToast('Sistema de puntuación actualizado');
    });
    $('#menu-scoring-system').addEventListener('click', () => {
      $('#menu-overlay').hidden = true;
      if (!completoScoringLocked()) openScoringSystemModal();
    });
    $('#scoring-system-change-btn').addEventListener('click', openScoringSystemModal);
  }

  /* ------------------------------------------------------------------ */
  /* MENÚ                                                                 */
  /* ------------------------------------------------------------------ */
  function initMenu() {
    $('#menu-btn').addEventListener('click', () => {
      updateMenuPauseLabel();
      // V12 (§9.3): "Resolver con Tie break" solo tiene sentido con el game actual en 0-0.
      // V13: en Por Games no hay "game en curso" que bloquee esto — solo el partido decidido.
      $('#menu-extraordinary-tb').hidden = isGamesMode()
        ? !E.canStartExtraordinaryGameTiebreak(computeGameState())
        : !E.canStartExtraordinaryTiebreak(computeState());
      // V13.4 (§7): en Completo, una vez bloqueado el sistema de puntuación (ya cerró un
      // game sensible) la opción del menú deja de ofrecerse. En Por Games nunca se bloquea.
      $('#menu-scoring-system').hidden = completoScoringLocked();
      $('#menu-overlay').hidden = false;
    });
    $('#menu-close').addEventListener('click', () => { $('#menu-overlay').hidden = true; });
    $('#menu-overlay').addEventListener('click', (e) => { if (e.target === $('#menu-overlay')) $('#menu-overlay').hidden = true; });
    $('#menu-pause').addEventListener('click', () => { togglePause(); $('#menu-overlay').hidden = true; });
    $('#menu-finish').addEventListener('click', () => { $('#menu-overlay').hidden = true; openFinishModal(); });
    $('#menu-reset').addEventListener('click', () => {
      $('#menu-overlay').hidden = true;
      confirmAction('Reiniciar partido', 'Se borrará el marcador, los eventos y los highlights del partido actual. Los jugadores y la configuración se mantienen.', resetMatch);
    });
    $('#menu-home').addEventListener('click', () => {
      $('#menu-overlay').hidden = true;
      confirmAction('Volver al inicio', 'Se descartará el partido actual (no se guardará en el historial).', goHome);
    });
  }

  function resetMatch() {
    pointEvents = [];
    gameEvents = [];
    highlights = [];
    serverKnowledge = E.createServerKnowledge();
    manualFinish = null;
    finishedSnapshot = null;
    match.baseline = null;
    match.coverageStartLabel = null;
    match.tiebreakMode = 'classic';
    match.tiebreakModeResetForBase = -1;
    timer.startedAt = Date.now();
    timer.pausedAt = null;
    timer.totalPausedMs = 0;
    $('#pause-overlay').hidden = true;
    startTimerLoop();
    render();
    showToast('Partido reiniciado');
  }

  /** Etapa 3 (Fase 2, §9) — núcleo de "descartar el partido activo", extraído de `goHome()`
   *  para reutilizarlo también desde la confirmación de descarte de la hoja "Registrar
   *  partido" (que NO abre el Home como goHome — se queda donde estaba y reabre la hoja). */
  function discardActiveMatchState() {
    stopTimerLoop();
    releaseWakeLock(); // V13.2 (§1)
    Store.clearActiveMatch();
    match = null;
    $('#pause-overlay').hidden = true;
  }

  /** Hotfix v1.2.1 (§2-3.1) — "Volver al inicio" significa el Home del jugador, nunca
   *  "Configurar partido": antes esta función (☰ → "Volver al inicio", descarta el partido
   *  en curso) terminaba en `showView('setup')`. Se llega acá siempre con identidad ya
   *  resuelta (Setup solo es alcanzable desde el Home), así que `openPlayerHome()` nunca
   *  cae en el caso "sin identidad" en este camino. */
  function goHome() {
    discardActiveMatchState();
    checkForActiveMatch();
    openPlayerHome();
  }

  /* ------------------------------------------------------------------ */
  /* CONFIRMACIÓN GENÉRICA                                                */
  /* ------------------------------------------------------------------ */
  function confirmAction(title, text, onAccept, onCancel, acceptLabel, cancelLabel, danger) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    // V02.9 (§5) — "Eliminar partido" necesita que el botón de aceptar diga "Eliminar" (no el
    // "Confirmar" genérico) — parámetros opcionales: los llamadores que no los pasan siguen
    // viendo "Confirmar"/"Cancelar" sin cambios.
    $('#confirm-accept').textContent = acceptLabel || 'Confirmar';
    $('#confirm-cancel').textContent = cancelLabel || 'Cancelar';
    // V03.2 (§9) — 7º parámetro opcional: "Salir sin guardar"/"Eliminar partido" son acciones
    // destructivas (pérdida de datos), así que el botón de aceptar pasa de lima (`.btn-start`,
    // acción positiva) a rojo (mismo `.btn-secondary--danger` que Cerrar sesión/Descartar
    // partido) — nunca un color nuevo. Los llamadores que no lo pasan (mayoría: correcciones
    // de partido en vivo/carga manual, sin pérdida real) siguen viendo el lima de siempre.
    $('#confirm-accept').classList.toggle('btn-start', !danger);
    $('#confirm-accept').classList.toggle('btn-secondary', !!danger);
    $('#confirm-accept').classList.toggle('btn-secondary--danger', !!danger);
    pendingConfirmAccept = onAccept;
    // Etapa 4.2 (§6.2) — cancel opcional: hasta ahora ningún llamador lo necesitaba (cancelar
    // solo cerraba el modal); editar un set anterior que descartaría un Set 3 ya cargado sí
    // necesita deshacer el cambio si el usuario cancela, no solo cerrar el aviso.
    pendingConfirmCancel = onCancel || null;
    $('#confirm-overlay').hidden = false;
  }
  function initConfirmModal() {
    $('#confirm-cancel').addEventListener('click', () => {
      $('#confirm-overlay').hidden = true;
      const fn = pendingConfirmCancel; pendingConfirmAccept = null; pendingConfirmCancel = null;
      if (fn) fn();
    });
    $('#confirm-accept').addEventListener('click', () => {
      $('#confirm-overlay').hidden = true;
      const fn = pendingConfirmAccept; pendingConfirmAccept = null; pendingConfirmCancel = null;
      if (fn) fn();
    });
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 3 (FASE 2, §4-§9) — HOJA "REGISTRAR PARTIDO"                    */
  /* Único punto de entrada del "+" de la barra inferior. Sin partido en vivo activo
   *  muestra dos niveles (Cargar mi partido jugado / Registrar partido en vivo → Game por
   *  game / Punto por punto); con uno activo, la tarjeta contextual para continuarlo más
   *  "Registrar partido nuevo" (que pide confirmación antes de descartar, ver
   *  #discard-match-modal más abajo). Vive fuera de cualquier vista — igual que el toast —
   *  así que abre desde Inicio/Historial/Ranking/Perfil por igual. */
  /* ------------------------------------------------------------------ */
  let registerSheetLevel = null; // 'active' | 'level1' | 'level2' | null (cerrada)
  let registerSheetFocusReturn = null; // §5: restaurar foco al "+" al cerrar

  function showRegisterSheetLevel(level, opts) {
    const animate = !!(opts && opts.animate);
    registerSheetLevel = level;
    ['active', 'level1', 'level2'].forEach((key) => {
      const el = $(`#register-sheet-${key}`);
      const show = key === level;
      el.classList.remove('is-entering');
      el.hidden = !show;
      if (show && animate) {
        void el.offsetWidth; // fuerza reflow — permite re-disparar la animación si se repite el nivel
        el.classList.add('is-entering');
      }
    });
  }

  function openRegisterSheet() {
    registerSheetFocusReturn = document.activeElement;
    const summary = getActiveMatchSummary();
    if (summary) {
      $('#register-sheet-active-teams').textContent = `${summary.teamAName} vs ${summary.teamBName}`;
      $('#register-sheet-active-meta').textContent = `${summary.scoreLabel} · ${summary.modeLabel}`;
      showRegisterSheetLevel('active');
    } else {
      showRegisterSheetLevel('level1');
    }
    $('#register-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#register-sheet-scrim').classList.add('is-open'); });
  }

  /** Cierre animado normal: usado cuando detrás va a quedar una pantalla completa (marcador,
   *  Setup, Cargar partido jugado) — ver la salvedad de `closeRegisterSheetInstant` abajo. */
  function closeRegisterSheet() {
    const scrim = $('#register-sheet-scrim');
    if (scrim.hidden) return;
    scrim.classList.remove('is-open');
    const restoreFocus = registerSheetFocusReturn;
    registerSheetFocusReturn = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      scrim.removeEventListener('transitionend', onEnd);
      scrim.hidden = true;
      if (restoreFocus && typeof restoreFocus.focus === 'function') restoreFocus.focus();
    };
    const onEnd = (e) => { if (e.target === scrim) finish(); };
    scrim.addEventListener('transitionend', onEnd);
    setTimeout(finish, 400); // red de seguridad: nunca deja el scrim invisible pero bloqueando toques
  }

  /** Cierre sin animación — únicamente para la transición hoja → confirmación de descarte
   *  (§9): ambas son overlays de igual jerarquía visual, así que dejar que la hoja se
   *  desvanezca detrás del modal de confirmación se veía como dos capas compitiendo. */
  function closeRegisterSheetInstant() {
    $('#register-sheet-scrim').classList.remove('is-open');
    $('#register-sheet-scrim').hidden = true;
    registerSheetFocusReturn = null;
  }

  function selectRegisterMode(mode) {
    selectedRecordingMode = mode;
    Store.saveRecordingMode(mode);
    updateModeSelectButtonLabel();
    closeRegisterSheet();
    showView('setup');
  }

  function openDiscardMatchModal() { $('#discard-match-modal').hidden = false; }

  function initDiscardMatchModal() {
    $('#discard-match-keep').addEventListener('click', () => {
      $('#discard-match-modal').hidden = true;
      continueActiveMatch();
    });
    $('#discard-match-confirm').addEventListener('click', () => {
      $('#discard-match-modal').hidden = true;
      discardActiveMatchState();
      checkForActiveMatch(); // mantiene sincronizada la franja vieja de view-setup, aunque no esté visible
      if (currentPlayerName) renderActiveMatchBanner(); // refresca la franja del Home si sigue detrás
      openRegisterSheet(); // §9: "luego mostrar las opciones habituales" — ya no hay partido activo, abre en nivel 1
    });
  }

  /** §5: "Puede cerrarse deslizando hacia abajo." Arrastre vertical simple sobre la hoja
   *  (nunca si el toque arranca en un botón/control, para no interferir con los taps de las
   *  opciones) — pasado el umbral, cierra; si no, vuelve a su lugar. */
  function initRegisterSheetSwipe() {
    const sheet = $('#register-sheet');
    let startY = null;
    let dy = 0;
    let dragging = false;

    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, select, input, a')) return;
      startY = e.clientY;
      dy = 0;
      dragging = true;
      sheet.setPointerCapture(e.pointerId);
      sheet.style.transition = 'none';
    });
    sheet.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 80) closeRegisterSheet();
      dy = 0; startY = null;
    };
    sheet.addEventListener('pointerup', endDrag);
    sheet.addEventListener('pointercancel', endDrag);
  }

  function initRegisterSheet() {
    $('#register-sheet-close-1').addEventListener('click', closeRegisterSheet);
    $('#register-sheet-close-2').addEventListener('click', closeRegisterSheet);
    $('#register-sheet-close-active').addEventListener('click', closeRegisterSheet);
    $('#register-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#register-sheet-scrim')) closeRegisterSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#register-sheet-scrim').hidden) closeRegisterSheet();
    });
    $('#register-sheet-live').addEventListener('click', () => showRegisterSheetLevel('level2', { animate: true }));
    $('#register-sheet-back-2').addEventListener('click', () => showRegisterSheetLevel('level1', { animate: true }));
    $('#register-sheet-load-played').addEventListener('click', () => { closeRegisterSheet(); openManualLoadScreen('player-home'); });
    $('#register-sheet-mode-games').addEventListener('click', () => selectRegisterMode('games'));
    $('#register-sheet-mode-complete').addEventListener('click', () => selectRegisterMode('complete'));
    $('#register-sheet-active-card').addEventListener('click', () => { closeRegisterSheet(); continueActiveMatch(); });
    $('#register-sheet-new-match').addEventListener('click', () => { closeRegisterSheetInstant(); openDiscardMatchModal(); });
    initRegisterSheetSwipe();
  }

  /** Etapa 3 (Fase 2, §6) — tap en el logo del header del partido en vivo: navega al Home
   *  SIN descartar el partido (a diferencia de ☰ → "Volver al inicio", que sí descarta).
   *  `openPlayerHome()` ya resuelve tanto el caso identificado como el de "¿Quién sos?"
   *  primero — se reutiliza tal cual, mismo criterio que #home-logo/#player-home-logo. */
  function initMatchHeaderHomeLink() {
    $('#match-header-logo-btn').addEventListener('click', () => { openPlayerHome(); });
  }

  /* ------------------------------------------------------------------ */
  /* FINALIZACIÓN MANUAL                                                  */
  /* ------------------------------------------------------------------ */
  function initFinishModal() {
    $all('#finish-reason-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        $all('#finish-reason-options .option-pill').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedFinishReason = btn.dataset.value;
      });
    });
    $all('#finish-winner-options .option-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        $all('#finish-winner-options .option-pill').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedFinishWinner = btn.dataset.value;
      });
    });
    $('#finish-cancel').addEventListener('click', () => { $('#finish-modal').hidden = true; });
    $('#finish-confirm').addEventListener('click', () => {
      $('#finish-modal').hidden = true;
      const reasonLabels = { tiempo: 'Por tiempo', retiro: 'Retiro / lesión', suspendido: 'Suspendido', otro: 'Otro motivo' };
      manualFinish = {
        reason: selectedFinishReason,
        reasonLabel: reasonLabels[selectedFinishReason],
        declaredWinner: selectedFinishWinner === 'none' ? null : selectedFinishWinner,
      };
      if (isGamesMode()) { finishMatchGames(computeGameState(), manualFinish); return; }
      const state = computeState();
      finishMatch(state, manualFinish);
    });
  }
  function openFinishModal() { $('#finish-modal').hidden = false; }

  /* ------------------------------------------------------------------ */
  /* EDITAR MARCADOR — basado en estados reglamentarios válidos           */
  /* ------------------------------------------------------------------ */
  let editDraft = null;
  let editMode = null; // 'corregir' | 'partido-ya-empezado'

  /** V6 (Bloques 14-16): "Editar" ya no ofrece una pantalla intermedia para elegir entre
   *  "corregir" o "partido ya empezado" — se decide sola según haya o no desarrollo real:
   *   - Sin ningún punto registrado todavía: no hay nada que "corregir" → va directo a
   *     PARTIDO YA EMPEZADO (con Cancelar/X siempre visibles por si fue sin querer).
   *   - Con puntos ya registrados: abre primero CORRECCIÓN RÁPIDA (el caso común de
   *     "tenía mal un punto"), nunca el Editor completo de entrada. */
  function openEditModal() {
    if (isGamesMode()) { openAdjustGamesModal(); return; } // V13 (§7/§10): Editar cubre corrección rápida y profunda, sin Ajustar aparte
    const noEventsYet = pointEvents.length === 0 && !match.baseline;
    if (noEventsYet) {
      openFullEditor('partido-ya-empezado');
    } else {
      openQuickCorrectionModal();
    }
  }

  function openFullEditor(mode) {
    const state = computeState();
    const serverInfo = resolveCurrentServer(state);
    editDraft = {
      finishedSets: state.sets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: s.tiebreak })),
      curA: state.gamesA, curB: state.gamesB,
      tbMode: state.inTiebreak ? match.tiebreakMode : 'classic',
      tbA: state.tbA, tbB: state.tbB,
      pointsA: state.pointsA, pointsB: state.pointsB,
      serverPlayerId: serverInfo.resolved ? serverInfo.playerId : null,
      serverManuallySet: false,
      pendingAdd: null, // {gamesA,gamesB}
      pendingAddTbA: 0, pendingAddTbB: 0, pendingAddTbUnknown: true,
    };
    editMode = mode;
    updateEditModeCopy();
    renderEditModal();
    $('#edit-modal').hidden = false;
  }

  /** Título y aclaración de la pantalla de edición según el camino elegido (Bloque H). */
  function updateEditModeCopy() {
    $('#edit-modal-title').textContent = editMode === 'partido-ya-empezado' ? 'PARTIDO YA EMPEZADO' : 'CORREGIR MARCADOR';
    $('#edit-correct-note').hidden = editMode !== 'corregir';
  }

  function draftMatchDecided() {
    const format = currentFormat();
    const need = Math.ceil(format.bestOfSets / 2);
    const setsWonA = editDraft.finishedSets.filter((s) => s.gamesA > s.gamesB).length;
    const setsWonB = editDraft.finishedSets.filter((s) => s.gamesB > s.gamesA).length;
    return setsWonA >= need || setsWonB >= need;
  }
  function draftWinner() {
    const format = currentFormat();
    const need = Math.ceil(format.bestOfSets / 2);
    const setsWonA = editDraft.finishedSets.filter((s) => s.gamesA > s.gamesB).length;
    const setsWonB = editDraft.finishedSets.filter((s) => s.gamesB > s.gamesA).length;
    if (setsWonA >= need) return 'A';
    if (setsWonB >= need) return 'B';
    return null;
  }

  function enumerateValidCompletedPairs(format) {
    const pairs = [];
    for (let a = 0; a <= format.setWinTarget + 1; a++) {
      for (let b = 0; b <= format.setWinTarget + 1; b++) {
        if (E.isValidCompletedSetScore(a, b, format)) pairs.push({ a, b });
      }
    }
    return pairs;
  }

  function renderEditModal() {
    const format = currentFormat();
    const decided = draftMatchDecided();
    // 21: un formato de UN SOLO SET (Americano) nunca puede tener "sets finalizados"
    // mientras el partido sigue en curso — si ese único set ya terminó, el partido ya
    // terminó. La sección entera (chips + selector "+ Agregar") se oculta directamente,
    // en vez de mostrarla vacía con la posibilidad de agregar un set que no puede existir.
    const singleSetFormat = format.bestOfSets === 1;
    $('#edit-finished-sets-section').hidden = singleSetFormat;
    if (singleSetFormat && editDraft.finishedSets.length) editDraft.finishedSets = [];

    // --- Sets finalizados ---
    const chipsWrap = $('#edit-finished-sets-list');
    chipsWrap.innerHTML = '';
    editDraft.finishedSets.forEach((s, idx) => {
      const chip = document.createElement('span');
      chip.className = 'edit-chip';
      const tbTxt = s.tiebreak ? ` (TB ${s.tiebreak.a}-${s.tiebreak.b})` : (E.completedSetHasTiebreak(s.gamesA, s.gamesB, format) ? ' (TB ?)' : '');
      chip.innerHTML = `<span>${s.gamesA}–${s.gamesB}${tbTxt}</span>`;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'edit-chip__remove'; rm.textContent = '✕';
      rm.addEventListener('click', () => { editDraft.finishedSets.splice(idx, 1); renderEditModal(); });
      chip.appendChild(rm);
      chipsWrap.appendChild(chip);
    });

    $('#edit-add-set-row').hidden = decided || singleSetFormat;
    $('#edit-add-set-tb-row').hidden = true;
    if (!decided && !singleSetFormat) {
      const select = $('#edit-add-set-select');
      const pairs = enumerateValidCompletedPairs(format);
      select.innerHTML = pairs.map((p) => `<option value="${p.a}-${p.b}">${p.a}–${p.b}</option>`).join('');
      const showTbRowIfNeeded = () => {
        const [a, b] = select.value.split('-').map(Number);
        const hasTb = E.completedSetHasTiebreak(a, b, format);
        $('#edit-add-set-tb-row').hidden = !hasTb;
        if (hasTb) {
          const cfg = E.tiebreakModeConfig('classic');
          editDraft.pendingAddTbA = a > b ? cfg.winTarget : cfg.winTarget - 2;
          editDraft.pendingAddTbB = a > b ? cfg.winTarget - 2 : cfg.winTarget;
          $('#edit-add-tb-a').textContent = editDraft.pendingAddTbA;
          $('#edit-add-tb-b').textContent = editDraft.pendingAddTbB;
        }
      };
      select.onchange = showTbRowIfNeeded;
      showTbRowIfNeeded();
    }

    // --- Set actual ---
    $('#edit-current-set-section').hidden = decided;
    if (!decided) {
      $('#edit-cur-a').textContent = editDraft.curA;
      $('#edit-cur-b').textContent = editDraft.curB;

      const isTb = E.isCurrentlyTiebreakScore(editDraft.curA, editDraft.curB, format);
      $('#edit-tb-section').hidden = !isTb;
      $('#edit-points-section').hidden = isTb;

      if (isTb) {
        $('#edit-tb-mode-select').value = editDraft.tbMode;
        $('#edit-tb-a').textContent = editDraft.tbA;
        $('#edit-tb-b').textContent = editDraft.tbB;
      } else {
        // V5 (Bloque I): dos selectores horizontales 0-15-30-40 para el score normal;
        // al llegar a 40-40 (zona de deuce) se reemplazan por los controles específicos
        // de la modalidad vigente (Punto de Oro / Con ventaja / Star Point) — nunca se
        // intenta representar esos estados especiales como combinaciones numéricas.
        const bothDeuceZone = editDraft.pointsA >= 3 && editDraft.pointsB >= 3;
        $('#edit-points-normal').hidden = bothDeuceZone;
        $('#edit-points-special').hidden = !bothDeuceZone;
        if (!bothDeuceZone) {
          renderPointTrack('#edit-points-track-a', editDraft.pointsA, (val) => { editDraft.pointsA = val; renderEditModal(); });
          renderPointTrack('#edit-points-track-b', editDraft.pointsB, (val) => { editDraft.pointsB = val; renderEditModal(); });
        } else {
          const specialGrid = $('#edit-points-special-grid');
          specialGrid.innerHTML = '';
          E.enumerateValidGameStates(match.scoringSystem).filter((st) => st.pointsA >= 3 && st.pointsB >= 3).forEach((st) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-pill' + (st.pointsA === editDraft.pointsA && st.pointsB === editDraft.pointsB ? ' is-selected' : '');
            btn.innerHTML = `<span class="option-pill__title">${st.label}</span>`;
            btn.addEventListener('click', () => { editDraft.pointsA = st.pointsA; editDraft.pointsB = st.pointsB; renderEditModal(); });
            specialGrid.appendChild(btn);
          });
        }
      }
    }

    // --- Sacador ---
    const serverWrap = $('#edit-server-options');
    serverWrap.innerHTML = '';
    const suggested = !editDraft.serverManuallySet ? suggestServerForDraft() : null;
    if (!editDraft.serverManuallySet) editDraft.serverPlayerId = suggested;
    match.players.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isSuggested = !editDraft.serverManuallySet && suggested === p.id;
      btn.className = 'server-radio' + (editDraft.serverPlayerId === p.id ? ' is-selected' : '');
      btn.innerHTML = isSuggested ? `🎾 ${p.name} <span class="server-radio__hint">(sugerido)</span>` : p.name;
      btn.addEventListener('click', () => { editDraft.serverPlayerId = p.id; editDraft.serverManuallySet = true; renderEditModal(); });
      serverWrap.appendChild(btn);
    });
    const noneBtn = document.createElement('button');
    noneBtn.type = 'button';
    noneBtn.className = 'server-radio' + (editDraft.serverPlayerId === null ? ' is-selected' : '');
    noneBtn.textContent = 'No sé todavía';
    noneBtn.addEventListener('click', () => { editDraft.serverPlayerId = null; editDraft.serverManuallySet = true; renderEditModal(); });
    serverWrap.appendChild(noneBtn);

    $('#edit-error').hidden = true;
  }

  /** V5 (Bloque I1/I2): selector horizontal de 4 posiciones discretas (0-15-30-40). No es un
   *  slider continuo: cada parada se toca directamente o se avanza paso a paso. */
  function renderPointTrack(sel, currentVal, onSelect) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    ['0', '15', '30', '40'].forEach((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'point-track__stop' + (Math.min(currentVal, 3) === i ? ' is-selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => onSelect(i));
      wrap.appendChild(btn);
    });
  }

  /** Intenta sugerir quién debería sacar según el nuevo score del draft, usando
   *  el conocimiento de saque YA registrado (nunca inventa: si no alcanza, null). */
  function suggestServerForDraft() {
    const format = currentFormat();
    const decided = draftMatchDecided();
    if (decided) return null;
    const curA = editDraft.curA, curB = editDraft.curB;
    const isTb = E.isCurrentlyTiebreakScore(curA, curB, format);
    const gameIndex = E.computeGameIndexFromParts(editDraft.finishedSets, curA, curB);
    const setNumber = editDraft.finishedSets.length + 1;
    const info = isTb
      ? E.resolveTiebreakServer(serverKnowledge, match.players, setNumber, gameIndex + 1, curA + curB + 1, editDraft.tbA + editDraft.tbB)
      : E.resolveServer(serverKnowledge, match.players, setNumber, gameIndex + 1, curA + curB + 1);
    return info.resolved ? info.playerId : null;
  }

  function initEditModal() {
    $('#edit-btn').addEventListener('click', openEditModal);
    $('#edit-cancel').addEventListener('click', () => { $('#edit-modal').hidden = true; });
    $('#edit-close-x').addEventListener('click', () => { $('#edit-modal').hidden = true; });
    $('#edit-points-special-back').addEventListener('click', () => { editDraft.pointsA = 3; editDraft.pointsB = 2; renderEditModal(); });

    $('#edit-add-set-btn').addEventListener('click', () => {
      const format = currentFormat();
      const [a, b] = $('#edit-add-set-select').value.split('-').map(Number);
      const hasTb = E.completedSetHasTiebreak(a, b, format);
      let tiebreak = null;
      if (hasTb && !editDraft.pendingAddTbUnknown) tiebreak = { a: editDraft.pendingAddTbA, b: editDraft.pendingAddTbB };
      editDraft.finishedSets.push({ gamesA: a, gamesB: b, tiebreak });
      renderEditModal();
    });

    // Steppers genéricos: data-stepper identifica el campo, data-delta +1/-1.
    $all('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.stepper;
        const delta = Number(btn.dataset.delta);
        applyStepper(field, delta);
      });
    });

    $('#edit-tb-mode-select').addEventListener('change', (e) => { editDraft.tbMode = e.target.value; renderEditModal(); });

    $('#edit-confirm').addEventListener('click', saveEditDraft);
  }

  function applyStepper(field, delta) {
    const format = currentFormat();
    if (field === 'add-tb-a' || field === 'add-tb-b') {
      editDraft.pendingAddTbUnknown = false;
      const a = field === 'add-tb-a' ? editDraft.pendingAddTbA + delta : editDraft.pendingAddTbA;
      const b = field === 'add-tb-b' ? editDraft.pendingAddTbB + delta : editDraft.pendingAddTbB;
      if (a < 0 || b < 0) return;
      const [selA, selB] = $('#edit-add-set-select').value.split('-').map(Number);
      const winnerIsA = selA > selB;
      // El ganador del TB debe coincidir con el ganador del set elegido.
      const winnerScore = winnerIsA ? a : b, loserScore = winnerIsA ? b : a;
      if (!E.isValidTiebreakScore(a, b, 'classic')) return;
      if (E.tiebreakIsWon(loserScore, winnerScore, 'classic')) return; // el "perdedor" no puede ser quien gana el TB
      editDraft.pendingAddTbA = a; editDraft.pendingAddTbB = b;
      $('#edit-add-tb-a').textContent = a; $('#edit-add-tb-b').textContent = b;
      return;
    }
    if (field === 'cur-a' || field === 'cur-b') {
      const a = field === 'cur-a' ? editDraft.curA + delta : editDraft.curA;
      const b = field === 'cur-b' ? editDraft.curB + delta : editDraft.curB;
      if (a < 0 || b < 0) return;
      if (!E.isValidInProgressSetScore(a, b, format)) return;
      editDraft.curA = a; editDraft.curB = b;
      // Al cambiar el set actual, reseteamos puntos/TB a un estado neutro válido.
      editDraft.pointsA = 0; editDraft.pointsB = 0; editDraft.tbA = 0; editDraft.tbB = 0; editDraft.tbMode = 'classic';
      renderEditModal();
      return;
    }
    if (field === 'tb-a' || field === 'tb-b') {
      const a = field === 'tb-a' ? editDraft.tbA + delta : editDraft.tbA;
      const b = field === 'tb-b' ? editDraft.tbB + delta : editDraft.tbB;
      if (a < 0 || b < 0) return;
      if (!E.isValidTiebreakScore(a, b, editDraft.tbMode)) return;
      editDraft.tbA = a; editDraft.tbB = b;
      renderEditModal();
    }
  }

  function saveEditDraft() {
    const format = currentFormat();
    const decided = draftMatchDecided();
    const winner = draftWinner();

    // 22: "Partido ya empezado" es exclusivamente para un partido EN CURSO — si el
    // resultado cargado ya está reglamentariamente decidido (una pareja ya ganó los sets
    // que necesitaba), no corresponde guardarlo como baseline de un partido "que sigue".
    // Esa es la futura función "Agregar partido manualmente", explícitamente fuera de esta
    // versión. Se bloquea el guardado y se explica el motivo, sin cerrar el modal.
    if (editMode === 'partido-ya-empezado' && decided) {
      const errEl = $('#edit-error');
      errEl.textContent = 'Este resultado ya está reglamentariamente terminado — no se puede cargar como "Partido ya empezado". Quitá algún set o cargá menos games.';
      errEl.hidden = false;
      return;
    }

    const sets = editDraft.finishedSets.map((s) => ({ gamesA: s.gamesA, gamesB: s.gamesB, tiebreak: s.tiebreak, winner: s.gamesA > s.gamesB ? 'A' : 'B' }));
    const curA = decided ? 0 : editDraft.curA;
    const curB = decided ? 0 : editDraft.curB;
    const isTb = !decided && E.isCurrentlyTiebreakScore(curA, curB, format);

    // V8.2 (33) — VALIDACIÓN FINAL DE TIE BREAK: encontrado en auditoría. El usuario puede
    // cargar un score de Tie break válido para un modo (p.ej. 8-6 en Clásico) y DESPUÉS
    // cambiar el modo (a "Muere en 7", donde 8-6 ya no puede existir — el TB termina apenas
    // alguien llega a 7). El <select> de modo lista las 3 opciones siempre, sin filtrar
    // según el score actual, y cambiar de modo no reclampea el score. Sin esta validación,
    // esa combinación imposible se guardaría tal cual. Se bloquea acá, en el único punto
    // por el que TODO guardado del Editor completo tiene que pasar.
    if (isTb && !E.isValidTiebreakScore(editDraft.tbA, editDraft.tbB, editDraft.tbMode)) {
      const errEl = $('#edit-error');
      errEl.textContent = 'El marcador de Tie break actual no es válido para el modo de Tie break seleccionado. Ajustá el marcador o elegí otro modo antes de guardar.';
      errEl.hidden = false;
      return;
    }

    const gameIndex = E.computeGameIndexFromParts(sets, curA, curB);

    const newState = {
      sets,
      gamesA: curA, gamesB: curB,
      pointsA: (!decided && !isTb) ? editDraft.pointsA : 0,
      pointsB: (!decided && !isTb) ? editDraft.pointsB : 0,
      inTiebreak: isTb,
      tbA: isTb ? editDraft.tbA : 0,
      tbB: isTb ? editDraft.tbB : 0,
      tbBaseGameNumber: isTb ? gameIndex + 1 : 0,
      tbBaseWithinSet: isTb ? curA + curB + 1 : 0,
      gameIndex,
      setsWonA: sets.filter((s) => s.winner === 'A').length,
      setsWonB: sets.filter((s) => s.winner === 'B').length,
      matchWinner: decided ? winner : null,
    };

    const pointsLabel = decided ? '' : (isTb ? `TB ${newState.tbA}-${newState.tbB}` : gameScoreLabel(newState.pointsA, newState.pointsB, match.scoringSystem));
    const stateLabel = decided
      ? `Partido completo (${sets.length} sets)`
      : `Set ${sets.length + 1} · ${curA}-${curB}${pointsLabel ? ' · ' + pointsLabel : ''}`;

    match.tiebreakMode = isTb ? editDraft.tbMode : 'classic';
    match.tiebreakModeResetForBase = isTb ? newState.tbBaseGameNumber : -1;

    if (editMode === 'partido-ya-empezado') {
      // Arranca el registro recién ahora: no hay eventos previos que conservar.
      match.baseline = newState;
      match.coverageStartLabel = stateLabel;
      pointEvents = [];
    } else {
      const beforeState = computeState();
      // V9 (27): si la corrección toca EXCLUSIVAMENTE el marcador del Tie break actual
      // (mismo set, mismos games, ya se estaba en ese mismo tie break antes y después de
      // editar) e ese tie break es reconstruible desde el historial real, se comporta
      // igual que Corrección Rápida — nunca genera un `adjustment` ni marca el partido
      // como parcial. Si no es reconstruible, se cae al comportamiento anterior.
      const sameOngoingTiebreak = isTb && beforeState.inTiebreak
        && beforeState.gamesA === curA && beforeState.gamesB === curB
        && JSON.stringify(beforeState.sets) === JSON.stringify(sets);
      const reconstructed = sameOngoingTiebreak
        ? attemptTiebreakQuickReconstruction(newState.tbA, newState.tbB, match.tiebreakMode)
        : { ok: false };

      if (reconstructed.ok) {
        pointEvents.splice(reconstructed.startIdx, pointEvents.length - reconstructed.startIdx, ...reconstructed.events);
      } else {
        // CORREGIR (caso general): se preservan TODOS los eventos reales ya registrados.
        // El ajuste se agrega como un evento más (nunca se borra el pasado ni se fabrican
        // puntos para "completar" la diferencia).
        const scoreBeforeLabel = beforeState.inTiebreak
          ? `TB ${beforeState.tbA}-${beforeState.tbB}`
          : `${beforeState.gamesA}-${beforeState.gamesB} · ${gameScoreLabel(beforeState.pointsA, beforeState.pointsB, match.scoringSystem)}`;
        pointEvents.push({
          type: 'adjustment',
          timestamp: new Date().toISOString(),
          matchTimeMs: getElapsedMs(),
          newState,
          scoreBeforeLabel,
          scoreAfterLabel: stateLabel,
        });
        // OJO (L1): un ajuste de marcador NO vuelve desconocido el inicio del partido —
        // `match.coverageStartLabel` se reserva exclusivamente para "partido ya empezado"
        // (Duración total vs Tiempo registrado). Las estadísticas parciales por ajuste ya
        // quedan reflejadas por `stats.hasAdjustments`, calculado directo de los eventos.
      }
    }

    if (editDraft.serverPlayerId != null) {
      const setNumber = sets.length + 1;
      const withinSetGameNumber = isTb ? newState.tbBaseWithinSet : (curA + curB + 1);
      const matchGameNumber = isTb ? newState.tbBaseGameNumber : gameIndex + 1;
      serverKnowledge = E.recordServerAnswer(serverKnowledge, match.players, setNumber, matchGameNumber, withinSetGameNumber, editDraft.serverPlayerId);
    }

    finishedSnapshot = null;
    manualFinish = null;
    $('#edit-modal').hidden = true;
    render();
    showToast('Marcador actualizado');
  }

  /* ------------------------------------------------------------------ */
  /* CORRECCIÓN RÁPIDA (V6, Bloques 13-16; V8, Bloques 9-13) — alternativa liviana al
     Editor completo para el caso más común: "el punto del game actual estaba mal".
     Nunca toca sets/games/tie break; solo el score del game en curso. V8: reconstruye
     los eventos-punto reales del game actual para llegar al nuevo marcador — NUNCA
     genera un `adjustment` ni estadísticas parciales cuando la corrección es dentro del
     mismo game (11): el partido sigue siendo Registro completo. */
  /* ------------------------------------------------------------------ */
  let quickDraft = null;
  let adjustDraft = null;

  function openQuickCorrectionModal() {
    const state = computeState();
    if (state.inTiebreak || state.matchWinner) {
      // La Corrección Rápida está pensada para el punteo de un game normal (16). En
      // tie break, o con el partido ya resuelto, el caso no está bien cubierto por
      // 4 posiciones 0-15-30-40: se va directo al Editor completo, que sí sabe manejar
      // tie breaks y sets ya cerrados.
      openFullEditor('corregir');
      return;
    }
    quickDraft = { pointsA: state.pointsA, pointsB: state.pointsB };
    renderQuickCorrectionModal();
    $('#quick-correction-modal').hidden = false;
  }

  function renderQuickCorrectionModal() {
    const wrap = $('#quick-correction-body');
    wrap.innerHTML = '';
    const bothDeuceZone = quickDraft.pointsA >= 3 && quickDraft.pointsB >= 3;
    if (!bothDeuceZone) {
      ['A', 'B'].forEach((team) => {
        const block = document.createElement('div');
        block.className = `quick-correction-team quick-correction-team--${team.toLowerCase()}`;
        const label = document.createElement('div');
        label.className = 'quick-correction-team__name';
        label.textContent = teamPlayers(match.players, team).map((p) => p.name).join(' / ');
        const track = document.createElement('div');
        track.className = 'point-track';
        track.id = `quick-track-${team}`;
        block.appendChild(label);
        block.appendChild(track);
        wrap.appendChild(block);
        renderPointTrack(`#quick-track-${team}`, quickDraft[`points${team}`], (val) => { quickDraft[`points${team}`] = val; renderQuickCorrectionModal(); });
      });
    } else {
      // Zona de deuce: estados especiales según la modalidad vigente (16.2) — Punto de
      // Oro, Deuce/Ventaja, o los niveles de Star Point — nunca combinaciones 40-40+N.
      const label = document.createElement('div');
      label.className = 'quick-correction-team__name';
      label.textContent = 'Estado del game';
      wrap.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'option-grid';
      E.enumerateValidGameStates(match.scoringSystem).filter((st) => st.pointsA >= 3 && st.pointsB >= 3).forEach((st) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-pill' + (st.pointsA === quickDraft.pointsA && st.pointsB === quickDraft.pointsB ? ' is-selected' : '');
        btn.innerHTML = `<span class="option-pill__title">${st.label}</span>`;
        btn.addEventListener('click', () => { quickDraft.pointsA = st.pointsA; quickDraft.pointsB = st.pointsB; renderQuickCorrectionModal(); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'link-btn'; back.style.marginTop = '10px';
      back.textContent = '← Volver a puntos normales';
      back.addEventListener('click', () => { quickDraft.pointsA = 3; quickDraft.pointsB = 2; renderQuickCorrectionModal(); });
      wrap.appendChild(back);
    }
    $('#quick-correction-error').hidden = true;
  }

  /**
   * V7 (26-30) — localiza el tramo de EVENTOS-PUNTO REALES (nunca un `adjustment`) que
   * corresponden al game todavía en curso. Un `adjustment` previo (o el inicio del partido/
   * baseline) puede haber dejado el game arrancando en un marcador que no es 0-0: eso queda
   * como `baseOffsetA/B`, un punto de partida inamovible — la reconstrucción de Corrección
   * Rápida solo puede tocar los puntos realmente registrados DESPUÉS de ese punto.
   */
  function findCurrentGameEventRange() {
    let state = match.baseline ? E.computeStateFromEvents([], match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline) : E.createInitialEngineState();
    let startIdx = 0;
    let baseOffsetA = state.pointsA, baseOffsetB = state.pointsB;
    for (let i = 0; i < pointEvents.length; i++) {
      const ev = pointEvents[i];
      if (ev.type === 'adjustment') {
        state = E.applyAdjustment(ev.newState);
        startIdx = i + 1;
        baseOffsetA = state.pointsA; baseOffsetB = state.pointsB;
        continue;
      }
      const before = state;
      const modeForThisPoint = ev.tbMode || match.tiebreakMode;
      state = E.applyPoint(state, ev.team, match.scoringSystem, currentFormat(), modeForThisPoint);
      if (state.gameIndex !== before.gameIndex || state.inTiebreak) {
        startIdx = i + 1;
        baseOffsetA = state.pointsA; baseOffsetB = state.pointsB;
      }
    }
    return { startIdx, baseOffsetA, baseOffsetB };
  }

  /**
   * V7 (26-30) — intenta reconstruir el game actual con la MÍNIMA modificación posible de
   * la secuencia realmente registrada.
   *
   * V8 (9-13) — CAMBIO DE FILOSOFÍA DE PRODUCTO: en V7.2, si hacía falta reasignar/quitar
   * menos puntos de los que realmente existían de ese tipo (ej. "B·B" con 0-30 → 15-15:
   * hay que convertir 1 de los 2 puntos de B en A, y cualquiera de los dos sirve), el
   * resultado se declaraba AMBIGUO y se derivaba al Editor completo. Eso era demasiado
   * estricto para el uso real: para un game que todavía está en curso, CUALQUIERA de esos
   * puntos es intercambiable a efectos de las estadísticas (todos son "un punto de B"), así
   * que no hay ninguna pérdida real de información en elegir uno u otro.
   *
   * La corrección que el usuario ingresa pasa a ser EL NUEVO ESTADO CORRECTO Y AUTORITATIVO
   * del game actual (12): se reconstruye el SUFIJO más reciente posible de eventos para
   * llegar a él, priorizando modificar los puntos MÁS RECIENTES del game (son los que con
   * más probabilidad corresponden al error que el usuario está corrigiendo). Nunca se toca
   * un game o set anterior, nunca se genera un `adjustment` — sigue siendo Registro
   * completo (11).
   *
   * Solo se deriva al Editor completo (13) cuando el target:
   *   - implica un score por debajo del punto de partida del game (bajaría a un game
   *     anterior) → 'baseline-conflict';
   *   - es reglamentariamente imposible de alcanzar sin cerrar el game/partido antes de
   *     tiempo → 'unsafe';
   *   - por algún motivo no cuadra exactamente con el target pedido → 'mismatch'.
   */
  function buildSafeInsertionSequence(countA, countB) {
    let a = 0, b = 0; const seq = [];
    while (a < countA || b < countB) {
      let pick;
      if (a >= countA) pick = 'B';
      else if (b >= countB) pick = 'A';
      else pick = (a / countA) <= (b / countB) ? 'A' : 'B';
      seq.push({ team: pick, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() });
      if (pick === 'A') a++; else b++;
    }
    return seq;
  }

  function attemptQuickReconstruction(origEvents, baseOffsetA, baseOffsetB, targetA, targetB) {
    const wantA = targetA - baseOffsetA;
    const wantB = targetB - baseOffsetB;
    // 13: el target implica un score por debajo de dónde arrancó este game → eso es tocar
    // un game anterior, no este. Se deriva al Editor completo.
    if (wantA < 0 || wantB < 0) return { ok: false, reason: 'baseline-conflict' };

    const seq = origEvents.map((ev) => ({ team: ev.team, timestamp: ev.timestamp, matchTimeMs: ev.matchTimeMs }));
    const origA = seq.filter((e) => e.team === 'A').length;
    const origB = seq.length - origA;
    const deltaA = wantA - origA;
    const deltaB = wantB - origB;

    if (deltaA === 0 && deltaB === 0) return { ok: true, events: seq };

    // Flip (reasignar A→B o B→A): cuando el target pide menos puntos de un equipo y más del
    // otro, la forma más chica de llegar ahí es reasignar puntos ya registrados en vez de
    // borrar y agregar. V8 (9-13): ya NO hace falta que el flip cubra TODOS los puntos de
    // ese tipo — se reasignan solo los que hacen falta, empezando por los MÁS RECIENTES
    // (los últimos jugados dentro de este game), porque un error de tipeo casi siempre está
    // en el punto que se acaba de cargar, no en uno de hace varios puntos.
    let flips = 0, flipDirection = null;
    if (deltaA < 0 && deltaB > 0) { flipDirection = 'A_to_B'; flips = Math.min(-deltaA, deltaB); }
    else if (deltaA > 0 && deltaB < 0) { flipDirection = 'B_to_A'; flips = Math.min(deltaA, -deltaB); }

    if (flipDirection === 'A_to_B' && flips > 0) {
      let remaining = flips;
      for (let i = seq.length - 1; i >= 0 && remaining > 0; i--) {
        if (seq[i].team === 'A') { seq[i].team = 'B'; remaining--; }
      }
    } else if (flipDirection === 'B_to_A' && flips > 0) {
      let remaining = flips;
      for (let i = seq.length - 1; i >= 0 && remaining > 0; i--) {
        if (seq[i].team === 'B') { seq[i].team = 'A'; remaining--; }
      }
    }

    const newOrigA = seq.filter((e) => e.team === 'A').length;
    const newOrigB = seq.length - newOrigA;
    const remA = wantA - newOrigA;
    const remB = wantB - newOrigB;

    // Eliminaciones restantes (el target pide MENOS puntos de un equipo de los que quedan
    // tras el flip): mismo criterio de "recientes primero" — se quita del final de la
    // secuencia, nunca un subconjunto elegido por posición arbitraria dentro del medio.
    if (remA < 0) {
      let removeCount = -remA;
      for (let i = seq.length - 1; i >= 0 && removeCount > 0; i--) {
        if (seq[i].team === 'A') { seq.splice(i, 1); removeCount--; }
      }
    }
    if (remB < 0) {
      let removeCount = -remB;
      for (let i = seq.length - 1; i >= 0 && removeCount > 0; i--) {
        if (seq[i].team === 'B') { seq.splice(i, 1); removeCount--; }
      }
    }

    // Inserciones restantes (punto omitido): siempre seguras, se intercalan al final
    // proporcionalmente para no disparar un fin de game prematuro en zonas de deuce.
    const afterRemovalA = seq.filter((e) => e.team === 'A').length;
    const afterRemovalB = seq.length - afterRemovalA;
    const insA = Math.max(0, wantA - afterRemovalA);
    const insB = Math.max(0, wantB - afterRemovalB);
    if (insA > 0 || insB > 0) seq.push(...buildSafeInsertionSequence(insA, insB));

    // Validación dura final: la secuencia reconstruida, corrida por el motor real, nunca
    // puede cerrar el game (ni el partido) antes de tiempo (13: "reglamentariamente
    // imposible" se traduce acá en la única forma confiable de detectarlo, simulando).
    let sim = { pointsA: baseOffsetA, pointsB: baseOffsetB, sets: [], gamesA: 0, gamesB: 0, inTiebreak: false, tbA: 0, tbB: 0, tbBaseGameNumber: 0, tbBaseWithinSet: 0, gameIndex: 0, setsWonA: 0, setsWonB: 0, matchWinner: null };
    for (const ev of seq) {
      const beforeIdx = sim.gameIndex;
      sim = E.applyPoint(sim, ev.team, match.scoringSystem, currentFormat(), match.tiebreakMode);
      if (sim.gameIndex !== beforeIdx || sim.inTiebreak || sim.matchWinner) return { ok: false, reason: 'unsafe' };
    }
    if (sim.pointsA !== targetA || sim.pointsB !== targetB) return { ok: false, reason: 'mismatch' };
    return { ok: true, events: seq };
  }

  /**
   * V9 (27) — "FUSIONAR la lógica del editor de Tie break con Quick Correction": cuando la
   * corrección del Editor completo toca EXCLUSIVAMENTE el marcador del TIE BREAK ACTUAL (el
   * que está en curso ahora mismo, sin tocar sets ya cerrados ni el score del set actual),
   * se comporta igual que Corrección Rápida de un game normal: se reconstruye la secuencia
   * real de puntos de ESE tie break para llegar al nuevo marcador, en vez de generar un
   * `adjustment` que marcaría el partido como parcial. Solo aplica cuando esa secuencia es
   * reconstruible (`sequenceKnown`, engine.js) — si el tie break en curso arrancó de un
   * ajuste manual sin secuencia real conocida, se cae al comportamiento anterior.
   */
  function attemptTiebreakQuickReconstruction(targetTbA, targetTbB, targetMode) {
    const tbInfo = E.extractCurrentTiebreakSequence(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
    if (!tbInfo.inTiebreak || !tbInfo.sequenceKnown) return { ok: false, reason: 'sequence-unknown' };

    const startIdx = pointEvents.length - tbInfo.sequence.length;
    const tbStartState = E.computeStateFromEvents(pointEvents.slice(0, startIdx), match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
    // El tie break en curso siempre arranca 0-0 cuando su secuencia es conocida (si hubiera
    // arrancado de un ajuste con score ya seteado, sequenceKnown sería false). Esta
    // validación es un cinturón de seguridad extra, nunca debería fallar en la práctica.
    if (!tbStartState.inTiebreak || tbStartState.tbA !== 0 || tbStartState.tbB !== 0) return { ok: false, reason: 'sequence-unknown' };

    const origSeq = tbInfo.sequence.slice();
    const origA = origSeq.filter((t) => t === 'A').length;
    const origB = origSeq.length - origA;
    const deltaA = targetTbA - origA;
    const deltaB = targetTbB - origB;

    let seq = origSeq.slice();
    if (deltaA !== 0 || deltaB !== 0) {
      // Mismo criterio que Corrección Rápida (9-13): reasignar puntos recientes primero
      // (flip), después eliminar sobrantes, y por último insertar los que falten.
      let flips = 0, dir = null;
      if (deltaA < 0 && deltaB > 0) { dir = 'A_to_B'; flips = Math.min(-deltaA, deltaB); }
      else if (deltaA > 0 && deltaB < 0) { dir = 'B_to_A'; flips = Math.min(deltaA, -deltaB); }
      if (dir === 'A_to_B') { let r = flips; for (let i = seq.length - 1; i >= 0 && r > 0; i--) { if (seq[i] === 'A') { seq[i] = 'B'; r--; } } }
      else if (dir === 'B_to_A') { let r = flips; for (let i = seq.length - 1; i >= 0 && r > 0; i--) { if (seq[i] === 'B') { seq[i] = 'A'; r--; } } }

      const newA = seq.filter((t) => t === 'A').length;
      const newB = seq.length - newA;
      const remA = targetTbA - newA, remB = targetTbB - newB;
      if (remA < 0) { let rc = -remA; for (let i = seq.length - 1; i >= 0 && rc > 0; i--) { if (seq[i] === 'A') { seq.splice(i, 1); rc--; } } }
      if (remB < 0) { let rc = -remB; for (let i = seq.length - 1; i >= 0 && rc > 0; i--) { if (seq[i] === 'B') { seq.splice(i, 1); rc--; } } }

      const afterA = seq.filter((t) => t === 'A').length;
      const afterB = seq.length - afterA;
      const insA = Math.max(0, targetTbA - afterA), insB = Math.max(0, targetTbB - afterB);
      for (let i = 0; i < insA; i++) seq.push('A');
      for (let i = 0; i < insB; i++) seq.push('B');
    }

    // Validación dura: la secuencia reconstruida, jugada desde el arranque real de ESTE tie
    // break bajo el modo elegido, nunca puede cerrarlo antes de llegar al final de la
    // secuencia (salvo que el propio final sea, precisamente, el marcador buscado).
    let sim = tbStartState;
    for (let i = 0; i < seq.length; i++) {
      if (!sim.inTiebreak) return { ok: false, reason: 'unsafe' };
      sim = E.applyPoint(sim, seq[i], match.scoringSystem, currentFormat(), targetMode);
    }
    if (sim.inTiebreak && (sim.tbA !== targetTbA || sim.tbB !== targetTbB)) return { ok: false, reason: 'mismatch' };

    const events = seq.map((team) => ({ team, tbMode: targetMode, timestamp: new Date().toISOString(), matchTimeMs: getElapsedMs() }));
    return { ok: true, startIdx, events };
  }

  function saveQuickCorrection() {
    const state = computeState();
    if (quickDraft.pointsA === state.pointsA && quickDraft.pointsB === state.pointsB) {
      $('#quick-correction-modal').hidden = true;
      return; // sin cambios reales: no genera un ajuste vacío
    }

    const range = findCurrentGameEventRange();
    const origEvents = pointEvents.slice(range.startIdx);
    const result = attemptQuickReconstruction(origEvents, range.baseOffsetA, range.baseOffsetB, quickDraft.pointsA, quickDraft.pointsB);

    if (result.ok) {
      // 20: reconstrucción INEQUÍVOCA — se reconstruye la secuencia real de puntos, NUNCA
      // se crea un `adjustment`. El partido sigue siendo Registro completo: mismos "Puntos
      // ganados", mismo Timeline (sin "Ajuste"), misma Evolución (sin gap).
      pointEvents.splice(range.startIdx, pointEvents.length - range.startIdx, ...result.events);
      finishedSnapshot = null;
      manualFinish = null;
      $('#quick-correction-modal').hidden = true;
      render();
      showToast('Corrección guardada');
      return;
    }

    // 13: el target REALMENTE no se puede alcanzar corrigiendo solo el game actual (afecta
    // un game/set anterior, o es reglamentariamente imposible). Ahí sí hace falta el
    // Editor completo, que usa un `adjustment` explícito.
    $('#quick-correction-modal').hidden = true;
    showToast('Ese marcador no corresponde al game actual. Abriendo el Editor completo…');
    openFullEditor('corregir');
  }

  function initQuickCorrectionModal() {
    $('#quick-correction-cancel').addEventListener('click', () => { $('#quick-correction-modal').hidden = true; });
    $('#quick-correction-close-x').addEventListener('click', () => { $('#quick-correction-modal').hidden = true; });
    $('#quick-correction-save').addEventListener('click', saveQuickCorrection);
    $('#quick-correction-full-editor').addEventListener('click', () => { $('#quick-correction-modal').hidden = true; openFullEditor('corregir'); });
  }

  /* ------------------------------------------------------------------ */
  /* AJUSTAR (V12 §2-4) — "me perdí parte del game; conozco el tanteador
     actual pero no necesariamente la secuencia que llevó hasta ahí". A
     diferencia de Corrección Rápida, NUNCA reconstruye una secuencia de
     puntos plausible: siempre queda como un `adjustment` explícito, para
     no fabricar Break Points/rachas/secuencias sobre un tramo que en
     realidad no se conoce (§3). Solo toca el game actual (puntos), nunca
     games/sets/tie break — para eso sigue existiendo EDITAR. */
  /* ------------------------------------------------------------------ */
  function canUseAdjust(state) { return !state.inTiebreak && !state.matchWinner; }

  function openAdjustModal() {
    const state = computeState();
    if (!canUseAdjust(state)) return; // el botón ya viene deshabilitado en este caso
    adjustDraft = { pointsA: state.pointsA, pointsB: state.pointsB };
    renderAdjustModal();
    $('#adjust-modal').hidden = false;
  }

  /** Igual que renderPointTrack, pero marca cada parada con `data-team` para pintar la
   *  selección con el color de CADA equipo (§2.3) en vez del dorado que usa Editar. */
  function renderAdjustPointTrack(sel, team, currentVal, onSelect) {
    const wrap = $(sel);
    wrap.innerHTML = '';
    ['0', '15', '30', '40'].forEach((label, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.team = team;
      btn.className = 'point-track__stop' + (Math.min(currentVal, 3) === i ? ' is-selected' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => onSelect(i));
      wrap.appendChild(btn);
    });
  }

  function renderAdjustModal() {
    const wrap = $('#adjust-body');
    wrap.innerHTML = '';
    const bothDeuceZone = adjustDraft.pointsA >= 3 && adjustDraft.pointsB >= 3;
    if (!bothDeuceZone) {
      ['A', 'B'].forEach((team) => {
        const label = document.createElement('div');
        label.className = `point-track-label point-track-label--${team.toLowerCase()}`;
        label.textContent = teamPlayers(match.players, team).map((p) => p.name).join(' / ');
        const track = document.createElement('div');
        track.className = 'point-track';
        track.id = `adjust-track-${team}`;
        wrap.appendChild(label);
        wrap.appendChild(track);
        renderAdjustPointTrack(`#adjust-track-${team}`, team, adjustDraft[`points${team}`], (val) => { adjustDraft[`points${team}`] = val; renderAdjustModal(); });
      });
    } else {
      // Zona de deuce: estados especiales según la modalidad vigente (§2.4-2.6) — Punto de
      // Oro, Deuce/Ventaja, o los niveles de Star Point — nunca combinaciones 40-40+N, y
      // exactamente la misma fuente (`enumerateValidGameStates`) que ya usa Editar/
      // Corrección Rápida: no se crean estados paralelos.
      const label = document.createElement('div');
      label.className = 'point-track-label';
      label.textContent = 'Estado del game';
      wrap.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'option-grid';
      E.enumerateValidGameStates(match.scoringSystem).filter((st) => st.pointsA >= 3 && st.pointsB >= 3).forEach((st) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.lead = st.pointsA === st.pointsB ? 'none' : (st.pointsA > st.pointsB ? 'A' : 'B');
        btn.className = 'option-pill' + (st.pointsA === adjustDraft.pointsA && st.pointsB === adjustDraft.pointsB ? ' is-selected' : '');
        btn.innerHTML = `<span class="option-pill__title">${st.label}</span>`;
        btn.addEventListener('click', () => { adjustDraft.pointsA = st.pointsA; adjustDraft.pointsB = st.pointsB; renderAdjustModal(); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      const back = document.createElement('button');
      back.type = 'button'; back.className = 'link-btn'; back.style.marginTop = '10px';
      back.textContent = '← Volver a puntos normales';
      back.addEventListener('click', () => { adjustDraft.pointsA = 3; adjustDraft.pointsB = 2; renderAdjustModal(); });
      wrap.appendChild(back);
    }
  }

  function saveAdjustment() {
    const state = computeState();
    if (adjustDraft.pointsA === state.pointsA && adjustDraft.pointsB === state.pointsB) {
      $('#adjust-modal').hidden = true;
      return; // sin cambio real: no genera un ajuste vacío
    }

    // El alcance de AJUSTAR es el game actual (§2.3): games/sets/tie break quedan
    // intactos, solo se pisan los puntos. A diferencia de Corrección Rápida, nunca se
    // intenta reconstruir la secuencia real — siempre es un `adjustment` explícito, con
    // el mismo formato que ya usa Editar (stats.js lo trata igual sin importar el origen).
    const newState = Object.assign({}, state, { pointsA: adjustDraft.pointsA, pointsB: adjustDraft.pointsB });
    const scoreBeforeLabel = gameScoreLabel(state.pointsA, state.pointsB, match.scoringSystem);
    const scoreAfterLabel = gameScoreLabel(newState.pointsA, newState.pointsB, match.scoringSystem);

    pointEvents.push({
      type: 'adjustment',
      timestamp: new Date().toISOString(),
      matchTimeMs: getElapsedMs(),
      newState,
      scoreBeforeLabel,
      scoreAfterLabel,
    });

    finishedSnapshot = null;
    manualFinish = null;
    $('#adjust-modal').hidden = true;
    render();
    showToast('Marcador ajustado');
  }

  function initAdjustModal() {
    $('#adjust-btn').addEventListener('click', openAdjustModal);
    $('#adjust-cancel').addEventListener('click', () => { $('#adjust-modal').hidden = true; });
    $('#adjust-close-x').addEventListener('click', () => { $('#adjust-modal').hidden = true; });
    $('#adjust-save').addEventListener('click', saveAdjustment);
  }

  /* ------------------------------------------------------------------ */
  /* PROGRESIÓN DEL GAME (V12 §4)                                        */
  /* ------------------------------------------------------------------ */
  const GAME_PROGRESSION_MAX_DOTS = 12;

  /**
   * Recorre TODOS los eventos desde el arranque del partido (no reusa
   * findCurrentGameEventRange: esa función descarta el propio evento de ajuste, pensada
   * para reconstruir puntos reales — acá el ajuste SÍ tiene que aparecer, como hueco) y
   * arma la fila de puntitos del SEGMENTO actual (game normal, o Tie break — reglamentario
   * o extraordinario, V12.1 §2):
   *   - punto real → color de equipo;
   *   - ajuste manual DENTRO del mismo segmento (mismo game, o mismo Tie break — p.ej.
   *     "Editar definición" del TB extraordinario) → círculo vacío, tramo de orden
   *     desconocido (V12 §4.4);
   *   - ajuste que ARRANCA un Tie break extraordinario → no llega a la rama de arriba (ya
   *     cambia de segmento, ver abajo) — nunca se dibuja como hueco: es una transición
   *     conocida, no un vacío de información;
   *   - cualquier punto/ajuste que efectivamente cierra el game o entra/sale de un Tie
   *     break arranca un segmento NUEVO (fila vacía) — la progresión es siempre la del
   *     segmento EN CURSO, incluido el desarrollo del Tie break actual.
   *
   * V12.1 (fix real de V12): la condición de "arrancó un Tie break" comparaba solo
   * `state.inTiebreak` sin mirar el `before` — eso reseteaba la fila después de CADA punto
   * mientras se estuviera en un TB (nunca se acumulaban más de 1 punto), no solo al entrar.
   * Invisible en V12 porque la fila se ocultaba entero durante cualquier TB; V12.1 la
   * muestra también ahí, así que hacía falta corregirlo para que se vea bien.
   */
  function computeGameProgressionDots() {
    let state = match.baseline
      ? E.computeStateFromEvents([], match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline)
      : E.createInitialEngineState();
    let dots = [];
    for (let i = 0; i < pointEvents.length; i++) {
      const ev = pointEvents[i];
      const before = state;
      if (ev.type === 'adjustment') {
        state = E.applyAdjustment(ev.newState);
        const enteredOrLeftTiebreak = state.inTiebreak !== before.inTiebreak;
        if (state.gameIndex !== before.gameIndex || enteredOrLeftTiebreak) {
          dots = [];
        } else {
          // Ajuste dentro del MISMO segmento: AJUSTAR en un game normal → hueco (orden
          // desconocido). "Editar definición" del TB extraordinario (mismo segmento, mismo
          // `extraordinaryTiebreak.active`) NO es una ambigüedad — nada de lo jugado se
          // vuelve desconocido por cambiar el objetivo — así que no se dibuja como hueco.
          const isEtbTargetChange = !!(ev.newState && ev.newState.extraordinaryTiebreak && ev.newState.extraordinaryTiebreak.active && before.inTiebreak);
          if (!isEtbTargetChange) dots.push({ gap: true });
        }
        continue;
      }
      const modeForThisPoint = ev.tbMode || match.tiebreakMode;
      state = E.applyPoint(before, ev.team, match.scoringSystem, currentFormat(), modeForThisPoint);
      dots.push({ team: ev.team });
      const enteredTiebreak = state.inTiebreak && !before.inTiebreak;
      if (state.gameIndex !== before.gameIndex || enteredTiebreak) dots = [];
    }
    return dots.slice(-GAME_PROGRESSION_MAX_DOTS);
  }

  /** V12.1 (§2): visible en games normales, Tie breaks reglamentarios y Tie break
   *  extraordinario por igual — solo se oculta con el partido ya decidido (no hay "segmento
   *  en curso" al que aplicarle esto). Ya NO depende de `canUseAdjust`: que Ajustar esté
   *  deshabilitado dentro de un TB no implica ocultar la progresión. */
  function renderGameProgression(state) {
    const wrap = $('#game-progression');
    if (state.matchWinner) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    const dots = computeGameProgressionDots();
    if (!dots.length) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.innerHTML = '';
    dots.forEach((d) => {
      const dot = document.createElement('span');
      dot.className = 'game-progression__dot' + (d.gap ? ' game-progression__dot--gap' : '');
      if (!d.gap) dot.dataset.team = d.team;
      wrap.appendChild(dot);
    });
    wrap.hidden = false;
  }

  /** V03.0 (§1) — estampa `userId` en la fila del jugador logueado dentro de `players`, con
   *  identidad FRESCA leída de Store (no la variable de módulo `currentPlayerName`/
   *  `currentUserId`, que puede estar desactualizada si el jugador arrancó este partido en
   *  vivo sin haber visitado Home todavía en esta sesión). No-op si no hay sesión activa —
   *  view-setup nunca exigió login para jugar, así que un partido sin nadie logueado se
   *  guarda igual que siempre, solo que sin ningún userId estampado (fallback legacy por
   *  nombre, ver player-home.js). */
  function identityStampedPlayers(players) {
    const freshUser = Store.getCurrentUser();
    if (!freshUser) return players;
    return Store.stampPlayersWithUserId(players, Store.loadCurrentPlayerName(), freshUser.id);
  }

  /** V03.0.2 (§12) — comparte la lógica de persistencia+notificación entre finishMatch/
   *  finishMatchGames (antes duplicada). Sin sesión (invitado), no persiste (V03.0.1 §7, sin
   *  tocar) y no genera ninguna notificación (no hay `userId` a quien asociarla). Con sesión:
   *  genera "partido guardado" siempre, y "Nivel BRAMU cambió" SOLO si `computeLevelEvolution`
   *  efectivamente produce un valor distinto — nunca inventa un cambio, y nunca para cuentas en
   *  calibración (esas no muestran número, ver isLegacyLevelAccount). */
  function persistFinishedMatchAndNotify(finishedSnapshot) {
    const user = Store.getCurrentUser();
    if (!user) return;
    const legacyLevel = isLegacyLevelAccount();
    const beforeEvolution = legacyLevel ? PH.computeLevelEvolution(PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity()), currentIdentity()) : null;
    Store.upsertHistory(finishedSnapshot);
    Store.addNotification({
      userId: user.id, type: 'match_saved', category: 'positive',
      title: 'Partido guardado', body: 'Se agregó un partido nuevo a tu historial.', action: 'history',
    });
    if (legacyLevel) {
      const afterEvolution = PH.computeLevelEvolution(PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity()), currentIdentity());
      if (afterEvolution.current !== beforeEvolution.current) {
        const up = afterEvolution.current > beforeEvolution.current;
        Store.addNotification({
          userId: user.id, type: 'level_changed', category: up ? 'positive' : 'info',
          title: 'Tu Nivel BRAMU cambió', body: `Ahora es ${afterEvolution.current.toFixed(1)} (antes ${beforeEvolution.current.toFixed(1)}).`, action: 'profile',
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* FIN DE PARTIDO — resumen inmediato                                   */
  /* ------------------------------------------------------------------ */
  function finishMatch(state, manual) {
    stopTimerLoop();
    releaseWakeLock(); // V13.2 (§1)
    const matchCtx = { players: match.players, scoringSystem: match.scoringSystem, format: currentFormat(), tiebreakMode: match.tiebreakMode, serverKnowledge, baseline: match.baseline, events: pointEvents, coverageStartLabel: match.coverageStartLabel };
    const stats = S.computeStats(pointEvents, matchCtx);
    const winnerTeam = manual ? manual.declaredWinner : state.matchWinner;
    const finishInfo = manual ? { manual: true, reason: manual.reason, declaredWinner: manual.declaredWinner } : { manual: false };
    const intelligence = S.generateBramuIntelligence(stats, matchCtx, state.sets, winnerTeam, finishInfo);

    // Bloque S2/V5: se precalculan acá (con serverKnowledge disponible) las estadísticas
    // por set y la serie de Evolución por game — así Análisis/Historial nunca necesitan
    // volver a resolver el sacador sobre un snapshot ya guardado.
    const setSegments = S.computeSetSegments(pointEvents, match.scoringSystem, currentFormat(), match.tiebreakMode, match.baseline);
    const perSetStats = setSegments.map((seg) => ({
      setNumber: seg.setNumber,
      stats: S.computeStats(seg.events, Object.assign({}, matchCtx, { baseline: seg.baseline })),
    }));
    // V9: computeEvolutionData ahora es el único motor de Evolución — devuelve, además de
    // los nodos por game, los picos especiales (Match/Set Point, Oro/Star, mini-breaks) y
    // la lista cronológica de "moments" que también consume BRAMU Intelligence (arriba).
    const evolution = S.computeEvolutionData(pointEvents, matchCtx);

    const hasPartialCurrent = !state.matchWinner && (state.gamesA > 0 || state.gamesB > 0 || state.inTiebreak || state.pointsA > 0 || state.pointsB > 0);
    const currentPartial = hasPartialCurrent ? {
      gamesA: state.gamesA, gamesB: state.gamesB,
      tiebreak: state.inTiebreak ? { a: state.tbA, b: state.tbB } : null,
    } : null;

    finishedSnapshot = {
      matchId: match.id,
      // Etapa 3 (Fase 1, §5.2) — createdAt pasa a representar el momento en que este
      // REGISTRO (la entrada de Historial) se crea/guarda, no el momento en que arrancó el
      // partido en vivo (eso ya lo captura startedAt/playedAt). Nada en la app leía
      // match.createdAt hasta ahora, así que este cambio no altera ningún comportamiento
      // existente — solo alinea el campo con su definición nueva (§2 del consolidado).
      createdAt: new Date().toISOString(),
      // playedAt = startedAt: el marcador arrancó cuando se jugó de verdad el partido.
      // PH.getPlayedAt() es la única fuente de verdad para leer "cuándo se jugó" —
      // nunca repetir esta lógica en otro lugar.
      playedAt: match.startedAt,
      startedAt: match.startedAt,
      timeZone: match.timeZone,
      finishedAt: new Date().toISOString(),
      mode: match.mode || 'complete',
      scoringSystem: match.scoringSystem,
      formatId: match.formatId,
      tiebreakMode: match.tiebreakMode,
      // V6 — antes NO se guardaba el baseline en el snapshot: Timeline y Momentos Clave
      // recalculaban todo desde 0-0 ignorando que el partido pudo haber arrancado a mitad
      // de un "Partido ya empezado" (bug: SET 1 inventado, games 1-0/2-0 falsos, score
      // relativo en vez del real). Guardarlo acá es lo que permite reconstruir el estado
      // correcto más adelante, incluso reabriendo el partido desde Historial otro día.
      players: identityStampedPlayers(match.players),
      baseline: match.baseline ? JSON.parse(JSON.stringify(match.baseline)) : null,
      sets: state.sets,
      currentPartial,
      winnerTeam,
      terminationType: manual ? 'manual' : 'automatic',
      terminationReason: manual ? manual.reason : null,
      terminationReasonLabel: manual ? manual.reasonLabel : null,
      regulationCompleted: !manual,
      durationMs: getElapsedMs(),
      stats,
      perSetStats,
      evolution,
      intelligence,
      highlights: JSON.parse(JSON.stringify(highlights)),
      events: JSON.parse(JSON.stringify(pointEvents)),
      coverageStartLabel: match.coverageStartLabel,
    };

    // V03.0.1 (§7) — partido de invitado (sin sesión activa): NO se persiste en el Historial
    // compartido. Antes de esta ronda se guardaba igual, sin userId — por la regla de
    // exclusividad de findPlayerRow (player-home.js, sin tocar), una fila sin userId cae a
    // comparación por nombre, así que un partido de invitado con el mismo nombre que una
    // cuenta real terminaba apareciendo en SU historial personal por coincidencia. Solución
    // más simple y segura (permitida explícitamente por el consolidado §7): el invitado ve el
    // resumen de ESA sesión desde el snapshot en memoria (openCanonicalResumen ya lo recibe
    // como parámetro, no depende de que esté guardado), pero el partido no sobrevive a un
    // recierre de la app. identityStampedPlayers ya deja `players` sin userId en este caso.
    persistFinishedMatchAndNotify(finishedSnapshot);
    Store.clearActiveMatch();
    openCanonicalResumen(finishedSnapshot, 'live');
  }

  /** V13 (§20-27) — equivalente de `finishMatch` para Por Games: usa los generadores de
   *  estadísticas/Intelligence de games (stats.js) en vez de los de puntos, pero produce un
   *  `finishedSnapshot` con la MISMA forma general (mismo Resumen/Análisis/Historial). */
  function finishMatchGames(state, manual) {
    stopTimerLoop();
    releaseWakeLock(); // V13.2 (§1)
    const format = currentFormat();
    const matchCtx = { players: match.players, format, serverKnowledge, durationMs: getElapsedMs(), events: gameEvents };
    const gamesStats = S.computeGamesStats(gameEvents, matchCtx);
    const winnerTeam = manual ? manual.declaredWinner : state.matchWinner;
    const finishInfo = manual ? { manual: true, reason: manual.reason, declaredWinner: manual.declaredWinner } : { manual: false };
    const intelligence = S.generateGamesIntelligence(gamesStats, matchCtx, state.sets, winnerTeam, finishInfo);
    const gameSetSegments = S.computeGameSetSegments(gameEvents, format);
    const perSetStats = gameSetSegments.map((seg) => ({ setNumber: seg.setNumber, stats: S.computeGamesStats(seg.events, matchCtx, seg.setNumber, seg.startingGameIndex) })); // V13.3 (§12): fix bug de sacador inicial por set
    const evolution = S.computeGamesEvolutionData(gameEvents, matchCtx);

    const hasPartialCurrent = !state.matchWinner && (state.gamesA > 0 || state.gamesB > 0);
    const currentPartial = hasPartialCurrent ? { gamesA: state.gamesA, gamesB: state.gamesB, tiebreak: null } : null;

    finishedSnapshot = {
      matchId: match.id,
      // Etapa 3 (Fase 1, §5.3) — mismo criterio que finishMatch: createdAt = momento en que
      // se crea/guarda este registro, no el arranque del partido. playedAt = startedAt.
      createdAt: new Date().toISOString(),
      playedAt: match.startedAt,
      startedAt: match.startedAt,
      timeZone: match.timeZone,
      finishedAt: new Date().toISOString(),
      players: identityStampedPlayers(match.players),
      mode: 'games',
      scoringSystem: match.scoringSystem,
      formatId: match.formatId,
      tiebreakMode: null,
      baseline: null,
      sets: state.sets,
      currentPartial,
      winnerTeam,
      terminationType: manual ? 'manual' : 'automatic',
      terminationReason: manual ? manual.reason : null,
      terminationReasonLabel: manual ? manual.reasonLabel : null,
      regulationCompleted: !manual,
      durationMs: getElapsedMs(),
      stats: gamesStats,
      perSetStats,
      evolution,
      intelligence,
      highlights: JSON.parse(JSON.stringify(highlights)),
      events: JSON.parse(JSON.stringify(gameEvents)),
      coverageStartLabel: null,
    };

    // V03.0.1 (§7) — partido de invitado (sin sesión activa): NO se persiste en el Historial
    // compartido. Antes de esta ronda se guardaba igual, sin userId — por la regla de
    // exclusividad de findPlayerRow (player-home.js, sin tocar), una fila sin userId cae a
    // comparación por nombre, así que un partido de invitado con el mismo nombre que una
    // cuenta real terminaba apareciendo en SU historial personal por coincidencia. Solución
    // más simple y segura (permitida explícitamente por el consolidado §7): el invitado ve el
    // resumen de ESA sesión desde el snapshot en memoria (openCanonicalResumen ya lo recibe
    // como parámetro, no depende de que esté guardado), pero el partido no sobrevive a un
    // recierre de la app. identityStampedPlayers ya deja `players` sin userId en este caso.
    persistFinishedMatchAndNotify(finishedSnapshot);
    Store.clearActiveMatch();
    openCanonicalResumen(finishedSnapshot, 'live');
  }

  /* ------------------------------------------------------------------ */
  /* COMPONENTE DE RESULTADO TIPO TV (V5 — reutilizado en Resumen/Análisis, Bloque Q) */
  /* ------------------------------------------------------------------ */

  /** V13 (§20/§26/§27) — línea de metadata discreta para Resumen/Análisis (único consumidor
   *  real: `#analysis-meta` — Historial arma la suya propia por separado, ver renderHistory):
   *  fecha · hora · formato · sistema · modo.
   *  V02.5 (Bloque C, §16) — "PARTIDO CARGADO" sale de acá: describe cómo BRAMU registró el
   *  dato puertas adentro, no algo sobre el partido del usuario (Historial SÍ lo conserva, en
   *  su propio cálculo — ahí sigue cumpliendo una función real: distinguir de un vistazo qué
   *  modo fue cada fila de una lista mixta). "POR GAMES" se mantiene: identifica una modalidad
   *  de REGISTRO EN VIVO real, no una descripción de "cómo se guardó". */
  function buildMatchMetaLine(f) {
    const dateStr = formatRealDate(f.startedAt || f.createdAt, f.timeZone);
    // V14 (§8): la Hora es opcional en un partido cargado — si el usuario la dejó vacía,
    // nunca se muestra una hora inventada (nunca "00:00" a secas).
    const timeStr = (f.mode === 'manual' && f.timeKnown === false) ? null : formatRealTime(f.startedAt || f.createdAt, f.timeZone).slice(0, 5);
    const formatLabel = (E.FORMATS[f.formatId] && E.FORMATS[f.formatId].label || '').toUpperCase();
    const scoringLabel = HISTORY_SCORING_LABELS[f.scoringSystem] || '';
    const modeLabel = f.mode === 'games' ? 'POR GAMES' : null;
    const placeLabel = (f.location && f.location.name) ? f.location.name : null;
    return [dateStr, timeStr, formatLabel, scoringLabel, modeLabel, placeLabel].filter(Boolean).join(' · ');
  }

  /** ¿Las ESTADÍSTICAS de este partido son parciales? (empezó tarde y/o tuvo ajustes manuales). Bloque N. */
  function isStatsCoveragePartial(f) { return !!(f.coverageStartLabel || (f.stats && f.stats.hasAdjustments)); }

  /** ¿La DURACIÓN es de arranque desconocido? Un ajuste manual NO vuelve desconocido el inicio del
   *  partido (L1): solo "partido ya empezado" (coverageStartLabel) hace que sea "Tiempo registrado". */
  function isDurationUnknownStart(f) { return !!f.coverageStartLabel; }

  /** Bloque L2: segundos si dura menos de 1 minuto, minutos después, horas+minutos para duraciones largas. */
  function formatDuration(ms) {
    if (ms < 60000) return `${Math.max(0, Math.round(ms / 1000))} s`;
    const totalMin = Math.round(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  /** Bloque M1: el ganador vive FUERA de la tarjeta de score, nunca adentro.
   *  V7 (45-46-107): el nombre del ganador va en el color de SU equipo (LIMA/AZUL) — el
   *  dorado queda reservado para Punto de Oro/Star Point, nunca para "quién ganó". */
  function buildWinnersBannerHTML(f) {
    const nameA = S.teamLabel(f.players, 'A'), nameB = S.teamLabel(f.players, 'B');
    if (f.winnerTeam) {
      const wName = f.winnerTeam === 'A' ? nameA : nameB;
      return `<div class="winners-banner"><div class="result-card__winners">Ganadores</div><div class="result-card__winners-names result-card__winners-names--${f.winnerTeam.toLowerCase()}">${wName}</div></div>`;
    }
    if (f.terminationType === 'manual') {
      return `<div class="winners-banner"><div class="result-card__winners">Sin ganador definido</div></div>`;
    }
    return '';
  }

  /** Bloque M2/M3/M4/M5: tarjeta tipo TV. Ganador de cada set a 100% de contraste, perdedor atenuado;
   *  duración por set dentro del mismo componente; duración total/registrada al pie.
   *  V6 (23): `opts.statsHTML`, si se pasa, fusiona las estadísticas rápidas DENTRO de esta
   *  misma tarjeta (separadas por un divisor), en vez de vivir en un bloque aparte — usado
   *  solo por el Resumen del partido (Análisis mantiene su propia sección de estadísticas). */
  function buildScoreCardHTML(f, opts) {
    opts = opts || {};
    const nameA = S.teamLabel(f.players, 'A');
    const nameB = S.teamLabel(f.players, 'B');

    function cellsForTeam(team) {
      let cells = f.sets.map((s) => {
        const mine = team === 'A' ? s.gamesA : s.gamesB;
        const theirs = team === 'A' ? s.gamesB : s.gamesA;
        // V12.2 (§2) — un segmento extraordinario (Resolver con Tie break) nunca tiene un
        // ganador de GAMES claro (puede llegar empatado, ej. 4-4) — mostrar esa celda como
        // "ganada/perdida" sería engañoso (bug reportado: "el marcador parece favorecer a
        // Equipo A pero la app declara ganador a Equipo B"). Se agrega una celda `TB` aparte
        // con el resultado real del desempate, que es lo que efectivamente decidió — nunca
        // se fabrica un score de games distinto (nunca 5-4/6-4/7-6).
        const gameCls = mine === theirs ? '' : (mine > theirs ? 'result-card__set--win' : 'result-card__set--lose');
        const gameCell = `<span class="result-card__set ${gameCls}">${mine}</span>`;
        if (s.extraordinary && s.tiebreak) {
          const mineTb = team === 'A' ? s.tiebreak.a : s.tiebreak.b;
          const theirsTb = team === 'A' ? s.tiebreak.b : s.tiebreak.a;
          const tbCls = mineTb > theirsTb ? 'result-card__set--win' : 'result-card__set--lose';
          const tbCell = `<span class="result-card__set result-card__set--tb ${tbCls}"><span class="result-card__set-tb-label">TB</span>${mineTb}</span>`;
          return gameCell + tbCell;
        }
        return gameCell;
      }).join('');
      if (f.currentPartial) {
        const mine = team === 'A' ? f.currentPartial.gamesA : f.currentPartial.gamesB;
        const theirs = team === 'A' ? f.currentPartial.gamesB : f.currentPartial.gamesA;
        const cls = mine > theirs ? 'result-card__set--win' : (mine < theirs ? 'result-card__set--lose' : '');
        const tbTxt = f.currentPartial.tiebreak ? `<sub style="font-size:9px;">(${team === 'A' ? f.currentPartial.tiebreak.a : f.currentPartial.tiebreak.b})</sub>` : '';
        cells += `<span class="result-card__set is-incomplete ${cls}">${mine}${tbTxt}</span>`;
      }
      return `<div class="result-card__row" data-team="${team}"><span class="result-card__name">${team === 'A' ? nameA : nameB}</span><span class="result-card__sets">${cells}</span></div>`;
    }

    let durationsHTML = '';
    if (f.stats.setDurations && f.stats.setDurations.length) {
      // V12.2 (§2): un segmento extraordinario ahora pinta 2 celdas de score (games + TB,
      // ver `cellsForTeam`) — se agrega una celda de duración vacía en ese mismo lugar para
      // que las columnas sigan alineadas con las de arriba.
      const cells = f.stats.setDurations.map((d, i) => {
        const cell = `<span class="result-card__duration-cell">${formatDuration(d.ms)}</span>`;
        return (f.sets[i] && f.sets[i].extraordinary) ? cell + '<span class="result-card__duration-cell"></span>' : cell;
      }).join('');
      const pad = f.currentPartial ? '<span class="result-card__duration-cell"></span>' : '';
      durationsHTML = `<div class="result-card__durations">${cells}${pad}</div>`;
    }

    let footerHTML = '';
    if (f.terminationType === 'manual') {
      footerHTML = `<div class="result-card__footer"><span>Finalizado manualmente</span><span>${f.terminationReasonLabel}</span></div>`;
      footerHTML += `<div class="result-card__incomplete-note">* Set incompleto al momento de finalizar</div>`;
    }

    // V14 (§14): un partido cargado manualmente no tiene duración conocida — `durationMs` es
    // siempre 0, y mostrar "0 s" daría a entender un dato real que en verdad es desconocido.
    const durLabel = f.mode === 'manual' ? '' : (isDurationUnknownStart(f) ? 'Tiempo registrado' : 'Duración total') + ' · ' + formatDuration(f.durationMs);
    const statsBlockHTML = opts.statsHTML ? `<div class="result-card__divider"></div><div class="result-card__stats">${opts.statsHTML}</div>` : '';
    // V02.2 (Bloque F, §15) — "Ganadores" pasa a vivir DENTRO de la misma tarjeta (antes vivía
    // afuera, en su propio bloque — ver buildWinnersBannerHTML/buildResultBlockHTML). Reutiliza
    // exactamente el mismo HTML/clases, solo cambia dónde se inserta.
    const winnersHTML = opts.winnersHTML || '';

    return `<div class="result-card">
      ${winnersHTML}
      ${durationsHTML}
      ${cellsForTeam('A')}
      ${cellsForTeam('B')}
      ${footerHTML}
      ${statsBlockHTML}
      ${durLabel ? `<p class="result-card__duration-total">${durLabel}</p>` : ''}
    </div>`;
  }

  /** V02.2 (Bloque F, §15) — "Sets ganados"/"Games ganados", derivados directo de `f.sets`
   *  (todo set, en cualquier modo, siempre trae `.winner`/`.gamesA`/`.gamesB` — ver engine.js/
   *  match-load.js): nunca una estadística nueva, solo un total ya calculable que antes vivía
   *  separado del marcador (en el caso de partidos cargados, era la ÚNICA fila de la sección
   *  ESTADÍSTICAS — ver renderManualStatsGrid). */
  function buildSetsGamesSummaryHTML(f) {
    const sets = f.sets || [];
    const setsWonA = sets.filter((s) => s.winner === 'A').length;
    const setsWonB = sets.filter((s) => s.winner === 'B').length;
    const gamesA = sets.reduce((acc, s) => acc + (s.gamesA || 0), 0);
    const gamesB = sets.reduce((acc, s) => acc + (s.gamesB || 0), 0);
    return `
      <div class="summary-stat-row"><span class="summary-stat-row__a">${setsWonA}</span><span class="summary-stat-row__label">SETS GANADOS</span><span class="summary-stat-row__b">${setsWonB}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-row__a">${gamesA}</span><span class="summary-stat-row__label">GAMES GANADOS</span><span class="summary-stat-row__b">${gamesB}</span></div>
    `;
  }

  /** V02.2 (Bloque F, §15) — tarjeta ÚNICA de resultado: Ganadores, marcador por equipo,
   *  divisor y Sets/Games ganados, todo en el mismo componente — "las estadísticas deben
   *  quedar inmediatamente relacionadas con el resultado" (antes Ganadores vivía en un bloque
   *  aparte arriba, y Sets/Games ganados en la sección ESTADÍSTICAS, lejos del marcador). */
  function buildResultBlockHTML(f) {
    return buildScoreCardHTML(f, { winnersHTML: buildWinnersBannerHTML(f), statsHTML: buildSetsGamesSummaryHTML(f) });
  }

  /** Bloque N: legal de datos parciales — se muestra solo cuando corresponde (nunca en partido completo sin ajustes). */
  function buildCoverageLegalHTML(f) {
    // V02.5 (Bloque C, §16) — "Partido cargado manualmente: solo se conoce el resultado final
    // por set..." describía cómo funciona BRAMU por dentro, no algo sobre el partido del
    // usuario — se saca del Resumen. Los otros casos de abajo (ajuste manual sobre un partido
    // EN VIVO, corrección de marcador) sí describen algo real que pasó en ESE partido puntual,
    // y siguen sin cambios.
    if (f.mode === 'manual') {
      return '';
    }
    if (f.stats && f.stats.hasAdjustments) {
      return f.mode === 'games'
        ? '<p class="coverage-note">Marcador corregido manualmente · Datos parciales por corrección manual</p>'
        : '<p class="coverage-note">Marcador ajustado manualmente · Estadísticas basadas en puntos registrados</p>';
    }
    if (f.coverageStartLabel) {
      return `<p class="coverage-note">Registro iniciado en ${f.coverageStartLabel} · Estadísticas parciales</p>`;
    }
    return '';
  }

  /* ------------------------------------------------------------------ */
  /* ESTADÍSTICAS TITULARES (Resumen inmediato / Placa)                   */
  /* ------------------------------------------------------------------ */
  function buildHeadlineRows(stats, scoringSystem, coveragePartial) {
    // V6 (27): "Puntos totales" daba a entender el total del partido (A+B); en realidad
    // cada número es lo ganado por esa pareja. Ahora: "Puntos ganados" cuando el registro es
    // completo, "Puntos registrados" cuando hay tramos sin datos (partido parcial y/o ajustes).
    const pointsLabel = coveragePartial ? 'PUNTOS REGISTRADOS' : 'PUNTOS GANADOS';
    const rows = [{ a: stats.pointsA, label: pointsLabel, b: stats.pointsB }];
    if (scoringSystem === 'golden' && stats.goldenPoints.played > 0) {
      rows.push({ a: `${stats.goldenPoints.wonA}/${stats.goldenPoints.played}`, label: 'PUNTOS DE ORO', b: `${stats.goldenPoints.wonB}/${stats.goldenPoints.played}` });
    } else if (scoringSystem === 'starpoint' && stats.starPoints.played > 0) {
      rows.push({ a: `${stats.starPoints.wonA}/${stats.starPoints.played}`, label: 'STAR POINTS', b: `${stats.starPoints.wonB}/${stats.starPoints.played}` });
    }
    rows.push({ a: S.fmtOpp(stats.breakPoints, 'A'), label: 'BREAK POINTS', b: S.fmtOpp(stats.breakPoints, 'B') });
    rows.push({ a: S.fmtOpp(stats.setPoints, 'A'), label: 'SET POINTS', b: S.fmtOpp(stats.setPoints, 'B') });
    rows.push({ a: S.fmtOpp(stats.matchPoints, 'A'), label: 'MATCH POINTS', b: S.fmtOpp(stats.matchPoints, 'B') });
    return rows;
  }

  /** V6 (28): la fila de Puntos ganados/registrados lleva DEBAJO una barra compartida con el
   *  % de cada pareja (50%|50%, 60%|40%…) — no una fila nueva de "% puntos ganados" aparte, la
   *  misma métrica con su barra. El resto de las filas (Puntos de Oro/Star, BP, SP, MP) se
   *  mantienen como números simples: el desglose con barra vive en Análisis (29). */
  function buildSummaryStatsHTML(f) {
    const rows = buildHeadlineRows(f.stats, f.scoringSystem, isStatsCoveragePartial(f));
    return rows.map((r, i) => {
      if (i === 0) return sharedBarRowHTML(r.label, r.a, r.b, Number(r.a) || 0, Number(r.b) || 0, false, true);
      return `<div class="summary-stat-row"><span class="summary-stat-row__a">${r.a}</span><span class="summary-stat-row__label">${r.label}</span><span class="summary-stat-row__b">${r.b}</span></div>`;
    }).join('');
  }

  /** V02.1 (§13/§15) — único punto de entrada al Resumen del partido, para las tres
   *  procedencias posibles: partido en vivo recién terminado ('live'), partido cargado
   *  manualmente recién guardado ('player-home'), o cualquier partido abierto desde Historial
   *  ('history'). Reemplaza al viejo par Resumen inmediato/Análisis + su navegación circular. */
  function openCanonicalResumen(f, openedFrom) {
    analysisOpenedFrom = openedFrom;
    renderAnalysis(f);
    showView('analysis');
  }

  /** V02.3 (Bloque C, §7) — estado de LECTURA de la tarjeta permanente de notas: el texto
   *  guardado, o (V02.5, Bloque C, §15) "Agregar una nota" si todavía no hay ninguna (nunca un
   *  textarea vacío suelto — ver .court-note__display en styles.css). */
  function renderAnalysisNoteDisplay(note) {
    const el = $('#analysis-note-display');
    const trimmed = (note || '').trim();
    el.textContent = trimmed || 'Agregar una nota';
    el.classList.toggle('is-empty', !trimmed);
  }

  /* ------------------------------------------------------------------ */
  /* ANÁLISIS COMPLETO — también la pantalla "Resumen del partido" (§13/§15)               */
  /* ------------------------------------------------------------------ */
  function renderAnalysis(f) {
    analysisCurrent = f;
    analysisSetFilter = 'match'; // Bloque S2/V5: siempre arranca en PARTIDO al abrir/cambiar de partido
    // V02.1 (§13/§15) — Deshacer/Reanudar solo tienen sentido para el partido EN VIVO recién
    // terminado (mismas condiciones que antes tenía el Resumen inmediato retirado): un
    // partido cargado manualmente o uno viejo visto desde Historial nunca tuvo puntos/games
    // en curso que deshacer sobre el `match`/`pointEvents` actuales.
    const isLiveMatch = analysisOpenedFrom === 'live' && f === finishedSnapshot;
    const showUndo = isLiveMatch && f.terminationType === 'automatic' && f.mode !== 'manual';
    const showResume = isLiveMatch && f.terminationType === 'manual';
    $('#analysis-live-actions').hidden = !showUndo && !showResume;
    $('#analysis-undo-btn').hidden = !showUndo;
    $('#analysis-resume-btn').hidden = !showResume;
    $('#analysis-meta').textContent = buildMatchMetaLine(f);
    $('#analysis-result').innerHTML = buildResultBlockHTML(f);
    $('#analysis-intelligence-text').innerHTML = f.intelligence.split('\n\n').map((p) => `<p>${p}</p>`).join('');
    const covNote = $('#analysis-coverage-note');
    const legalHTML = buildCoverageLegalHTML(f);
    if (legalHTML) { covNote.hidden = false; covNote.innerHTML = legalHTML; } else { covNote.hidden = true; covNote.innerHTML = ''; }

    renderStatsGrid(f);
    renderEvolutionChart(f);
    renderHighlightsSection(f);
    renderKeyMoments(f);

    // V14: un partido cargado no tiene `events` (game a game/punto a punto) que timelinear.
    $('#analysis-full-timeline-btn').hidden = f.mode === 'manual';
    $('#analysis-full-timeline-btn').onclick = () => { if (f.mode === 'games') renderGamesFullTimeline(f); else renderFullTimeline(f); showView('timeline'); };
    $('#analysis-share-btn').onclick = () => shareResult(f, 'analisis');
    // Etapa 3 (Fase 3, §15) — segundo acceso a "Editar partido": desde el detalle del partido
    // (acá, Análisis — es el mismo destino al que ya lleva "VER DETALLE" del Último Partido
    // para cualquier modo). Solo para partidos cargados manualmente.
    $('#analysis-edit-btn').hidden = f.mode !== 'manual';
    $('#analysis-edit-btn').onclick = () => openManualLoadScreen('player-home', f);
    // Etapa 4.2 (§10) — sensaciones privadas: solo partidos CARGADOS, accesibles únicamente
    // desde este detalle (nunca en Home/Historial/Resumen/exportaciones).
    // V02.3 (Bloque C, §7) — tarjeta PERMANENTE: ya no se oculta según haya o no nota
    // guardada (eso reemplazaba la tarjeta entera por un link "+ Agregar nota" — ver
    // renderAnalysisNoteDisplay). Arranca siempre en modo LECTURA (textarea oculto) —
    // cambiar de partido nunca debe dejar el editor abierto del partido anterior.
    const noteSection = $('#analysis-note-section');
    noteSection.hidden = f.mode !== 'manual';
    if (f.mode === 'manual') {
      $('#analysis-note-textarea').value = f.privateNote || '';
      $('#analysis-note-textarea').hidden = true;
      $('#analysis-note-display').hidden = false;
      renderAnalysisNoteDisplay(f.privateNote || '');
    }
    // V11 (§16.2): cierra el recorrido sin obligar al usuario a volver con la flecha. Solo
    // navega — nunca Store.clearActiveMatch(), porque Análisis puede abrirse tanto desde el
    // partido recién terminado como desde el Historial de un partido viejo, y en ese segundo
    // caso podría haber un partido EN VIVO distinto todavía activo que no hay que borrar.
    $('#analysis-home-btn').onclick = () => {
      checkForActiveMatch();
      // Hotfix v1.2.1 (§2-3.1) — "VOLVER AL INICIO" es siempre el Home del jugador (mismo
      // criterio que #summary-new-btn), sin importar si este Análisis es el del partido
      // recién terminado o uno viejo visto desde Historial — en ambos casos el destino es
      // el Home, nunca "Configurar partido". No se toca Store.clearActiveMatch() acá (ver
      // comentario de arriba): Análisis puede abrirse con un partido EN VIVO distinto
      // todavía activo detrás, que no hay que borrar.
      openPlayerHome();
    };
    // V02.9 (§5) — "Eliminar partido": acción deliberada al final del Resumen, con
    // confirmación. En esta etapa local (sin cuentas/backend) es una eliminación completa del
    // registro, igual que ya hacía la X de Historial retirada en esta misma ronda (§4) — Home/
    // Historial/estadísticas se recalculan solos en el próximo render porque leen siempre
    // Store.loadHistory(), nunca un historial paralelo (ver openPlayerHome/renderHistory).
    $('#analysis-delete-btn').onclick = () => {
      confirmAction(
        '¿Eliminar este partido?',
        'Se actualizarán tu historial y tus estadísticas.',
        () => {
          Store.removeFromHistory(f.matchId);
          showToast('Partido eliminado');
          checkForActiveMatch();
          openPlayerHome();
        },
        null,
        // V03.2 (§9/§10) — caso canónico "Eliminar partido" del consolidado: CANCELAR/
        // ELIMINAR PARTIDO (no "Eliminar" genérico), rojo en la acción de aceptar (antes
        // siempre lima vía `.btn-start`, aunque la acción sea destructiva).
        'Eliminar partido',
        'Cancelar',
        true
      );
    };
  }

  /** Bloque S2/V5: pestañas PARTIDO/SET1/SET2/SET3, compartidas entre Estadísticas y Evolución.
   *  S3: si hay un único set (p.ej. Americano), no se muestra selector redundante. */
  function renderSetFilterTabs(sel, f, onChange) {
    const wrap = $(sel);
    if (!f.perSetStats || f.perSetStats.length <= 1) { wrap.innerHTML = ''; wrap.hidden = true; return; }
    wrap.hidden = false;
    const items = [{ key: 'match', label: 'PARTIDO' }].concat(f.perSetStats.map((s) => ({ key: s.setNumber, label: 'SET ' + s.setNumber })));
    wrap.innerHTML = '';
    items.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-filter-tabs__btn' + (analysisSetFilter === it.key ? ' is-selected' : '');
      btn.textContent = it.label;
      btn.addEventListener('click', () => { analysisSetFilter = it.key; onChange(); });
      wrap.appendChild(btn);
    });
  }

  /** Estadísticas correspondientes al filtro compartido vigente ('match' o un número de set). */
  function statsForCurrentFilter(f) {
    if (analysisSetFilter === 'match' || !f.perSetStats) return f.stats;
    const found = f.perSetStats.find((s) => s.setNumber === analysisSetFilter);
    return found ? found.stats : f.stats;
  }

  /** V6 (Bloques 45-53): dos familias de barra, matemáticamente distintas — antes se usaba
   *  la misma barra "compartida" para todo, lo que rompía visualmente cualquier métrica cuyos
   *  dos porcentajes no sumaran 100 (ej: 60% al saque vs 55% al saque no son "60/115").
   *  TIPO A — sharedBarRowHTML: ambos valores forman parte de un mismo total (Puntos ganados,
   *    Puntos de Oro/Star Points) → una única barra dividida entre ambos equipos (50/50, 43/57…).
   *  TIPO B — mirrorBarRowHTML: cada pareja tiene SU PROPIO % (Puntos al saque/resto, Games de
   *    saque, Break/Set/Match Points) → barra espejo desde el centro, cada mitad en su propia
   *    escala 0-100%, nunca sumadas entre sí.
   *  `dash:true` (T1) reemplaza todo por "—" cuando la métrica no es calculable, en vez de un
   *  "0/0" que parecería una certeza falsa. */
  function statRowValuesHTML(label, aText, bText) {
    return `<div class="bar-stat-row__values"><span class="bar-stat-row__a">${aText}</span><span class="bar-stat-row__label">${label}</span><span class="bar-stat-row__b">${bText}</span></div>`;
  }
  function dashRowHTML(label) {
    return `<div class="bar-stat-row bar-stat-row--dash">${statRowValuesHTML(label, '—', '—')}</div>`;
  }
  /** V8 (14-18): en 3 métricas (Puntos ganados/registrados, Puntos al saque/resto, Games de
   *  saque ganados) el PORCENTAJE pasa a ser el dato PRINCIPAL (grande, en el lugar de
   *  `bar-stat-row__a/b`) y la cantidad absoluta queda como dato SECUNDARIO (chico, debajo
   *  de la barra) — antes era al revés. Break/Set/Match Points y Puntos de Oro/Star Point
   *  NO cambian (19-20): ahí la cantidad de oportunidades es parte de la lectura, así que
   *  siguen mostrando `convertidos/oportunidades` como dato principal, sin %. */
  function sharedBarRowHTML(label, aText, bText, aVal, bVal, dash, pctPrimary) {
    if (dash) return dashRowHTML(label);
    const total = aVal + bVal;
    const pctA = total > 0 ? (aVal / total) * 100 : 50, pctB = total > 0 ? (bVal / total) * 100 : 50;
    // V7 (48-50) / V8 (15): cuando `pctPrimary`, el % pasa a ocupar el lugar del dato
    // principal y `aText`/`bText` (la cantidad) baja a la fila secundaria, con el sufijo
    // "pts" para que se lea como cantidad y no como otro porcentaje.
    const mainA = pctPrimary ? `${Math.round(pctA)}%` : aText;
    const mainB = pctPrimary ? `${Math.round(pctB)}%` : bText;
    const secondaryHTML = pctPrimary
      ? `<div class="bar-stat-row__pcts"><span class="bar-stat-row__pcts-a">${aText} pts</span><span class="bar-stat-row__pcts-b">${bText} pts</span></div>`
      : '';
    return `<div class="bar-stat-row">
      ${statRowValuesHTML(label, mainA, mainB)}
      <div class="bar-stat-row__bar"><span class="bar-stat-row__fill bar-stat-row__fill--a" style="width:${pctA.toFixed(1)}%"></span><span class="bar-stat-row__fill bar-stat-row__fill--b" style="width:${pctB.toFixed(1)}%"></span></div>
      ${secondaryHTML}
    </div>`;
  }
  function mirrorBarRowHTML(label, aText, bText, aPct, bPct, dash, secondaryA, secondaryB) {
    if (dash) return dashRowHTML(label);
    const a = Math.max(0, Math.min(100, aPct)), b = Math.max(0, Math.min(100, bPct));
    // V8 (16-18): soporte opcional para una fila secundaria chica debajo de la barra —
    // usada por Puntos al saque/resto y Games de saque ganados para no perder la cantidad
    // absoluta al pasar el % al frente. Break/Set/Match Points no la pasan: se quedan
    // solo con `convertidos/oportunidades` como antes (19).
    const secondaryHTML = (secondaryA != null && secondaryB != null)
      ? `<div class="bar-stat-row__pcts"><span class="bar-stat-row__pcts-a">${secondaryA}</span><span class="bar-stat-row__pcts-b">${secondaryB}</span></div>`
      : '';
    return `<div class="bar-stat-row bar-stat-row--mirror">
      ${statRowValuesHTML(label, aText, bText)}
      <div class="bar-stat-row__mirror">
        <div class="bar-stat-row__mirror-half bar-stat-row__mirror-half--a"><span class="bar-stat-row__mirror-fill bar-stat-row__mirror-fill--a" style="width:${a.toFixed(1)}%"></span></div>
        <span class="bar-stat-row__mirror-center"></span>
        <div class="bar-stat-row__mirror-half bar-stat-row__mirror-half--b"><span class="bar-stat-row__mirror-fill bar-stat-row__mirror-fill--b" style="width:${b.toFixed(1)}%"></span></div>
      </div>
      ${secondaryHTML}
    </div>`;
  }
  /** V8.2 (10): Puntos al saque/resto y Games de saque ganados pasan de "espejo desde el
   *  centro" a una escala 0–100% COMPLETA por equipo — cada barra representa el % real de
   *  ESE equipo sobre todo su ancho disponible, sin verse reducida a la mitad del espacio
   *  solo por arrancar desde el centro. Break/Set/Match Points NO cambian (11): siguen
   *  usando `mirrorBarRowHTML` tal cual, porque ahí la cantidad de oportunidades es parte
   *  fundamental de la lectura y el criterio visual actual (espejo) ya funciona bien. */
  function fullScaleBarRowHTML(label, aText, bText, aPct, bPct, dash, secondaryA, secondaryB) {
    if (dash) return dashRowHTML(label);
    const a = Math.max(0, Math.min(100, aPct)), b = Math.max(0, Math.min(100, bPct));
    const secondaryHTML = (secondaryA != null && secondaryB != null)
      ? `<div class="bar-stat-row__pcts"><span class="bar-stat-row__pcts-a">${secondaryA}</span><span class="bar-stat-row__pcts-b">${secondaryB}</span></div>`
      : '';
    return `<div class="bar-stat-row bar-stat-row--fullscale">
      ${statRowValuesHTML(label, aText, bText)}
      <div class="bar-stat-row__fullscale">
        <div class="bar-stat-row__fullscale-track"><span class="bar-stat-row__fullscale-fill bar-stat-row__fullscale-fill--a" style="width:${a.toFixed(1)}%"></span></div>
        <div class="bar-stat-row__fullscale-track"><span class="bar-stat-row__fullscale-fill bar-stat-row__fullscale-fill--b" style="width:${b.toFixed(1)}%"></span></div>
      </div>
      ${secondaryHTML}
    </div>`;
  }
  /** 53: Racha máxima — sin barra, es un dato comparativo sin porcentaje natural. */
  function noBarRowHTML(label, aText, bText) {
    return `<div class="bar-stat-row bar-stat-row--nobar">${statRowValuesHTML(label, aText, bText)}</div>`;
  }

  /** V12.1 (§4): reemplaza la nota-oración por fila (rompía la altura de la grilla) por un
   *  asterisco pegado a la etiqueta — la aclaración única va aparte, debajo de todo el
   *  bloque de estadísticas (ver `buildStatsPartialNoteText`/`renderStatsGrid`). */
  function withPartialAsterisk(label, isPartial) {
    return isPartial ? `${label} *` : label;
  }

  /** V7 (97-108): lógica pura de las filas de Estadísticas, extraída para que la pantalla de
   *  Análisis Y la exportación de Compartir usen exactamente el mismo HTML — una sola fuente
   *  de verdad, nunca un segundo cálculo que pueda desincronizarse. */
  function buildStatsGridRowsHTML(f, stats) {
    const pointsLabel = isStatsCoveragePartial(f) ? 'Puntos registrados' : 'Puntos ganados';
    const rowsHTML = [];
    rowsHTML.push(sharedBarRowHTML(pointsLabel, stats.pointsA, stats.pointsB, stats.pointsA, stats.pointsB, false, true));

    const serverGap = !stats.hasServerInfo;
    if (stats.hasServerInfo) {
      const servedA = stats.serveStats.A.served, servedB = stats.serveStats.B.served;
      const wonServingA = stats.serveStats.A.wonServing, wonServingB = stats.serveStats.B.wonServing;
      const retWonA = servedB ? servedB - stats.serveStats.B.wonServing : 0;
      const retWonB = servedA ? servedA - stats.serveStats.A.wonServing : 0;
      const pctSaqueA = servedA ? (wonServingA / servedA) * 100 : 0;
      const pctSaqueB = servedB ? (wonServingB / servedB) * 100 : 0;
      const pctRestoA = servedB ? (retWonA / servedB) * 100 : 0;
      const pctRestoB = servedA ? (retWonB / servedA) * 100 : 0;
      // V9 (25): vuelven a la barra espejo desde el centro — el % de saque/resto de cada
      // pareja tiene un denominador propio (no comparten un total), así que no deben
      // parecer una barra compartida que suma 100 (67% vs 83% no es "67 de 150").
      rowsHTML.push(mirrorBarRowHTML('Puntos al saque', `${Math.round(pctSaqueA)}%`, `${Math.round(pctSaqueB)}%`, pctSaqueA, pctSaqueB, false, `${wonServingA}/${servedA} pts`, `${wonServingB}/${servedB} pts`));
      rowsHTML.push(mirrorBarRowHTML('Puntos al resto', `${Math.round(pctRestoA)}%`, `${Math.round(pctRestoB)}%`, pctRestoA, pctRestoB, false, `${retWonA}/${servedB} pts`, `${retWonB}/${servedA} pts`));
      const sgA = stats.serviceGames.wonA + stats.serviceGames.lostA, sgB = stats.serviceGames.wonB + stats.serviceGames.lostB;
      const holdPctA = sgA ? (stats.serviceGames.wonA / sgA) * 100 : 0, holdPctB = sgB ? (stats.serviceGames.wonB / sgB) * 100 : 0;
      rowsHTML.push(mirrorBarRowHTML('Games de saque ganados', `${Math.round(holdPctA)}%`, `${Math.round(holdPctB)}%`, holdPctA, holdPctB, false, `${stats.serviceGames.wonA}/${sgA} games`, `${stats.serviceGames.wonB}/${sgB} games`));
    } else {
      rowsHTML.push(dashRowHTML('Puntos al saque'));
      rowsHTML.push(dashRowHTML('Puntos al resto'));
      rowsHTML.push(dashRowHTML('Games de saque ganados'));
    }

    // V12.1 (§4): asterisco pegado a la etiqueta en Break points y Racha máxima — son justo
    // las métricas que un ajuste manual podría fabricar si no se conociera el tramo
    // salteado (V12 §3.1) — la aclaración única va debajo de todo el bloque (§4: "no repetir
    // el texto dentro de cada tarjeta"), ver `renderStatsGrid`.
    const isPartial = stats.hasAdjustments;
    const bpA = stats.breakPoints.A, bpB = stats.breakPoints.B;
    if (serverGap) {
      rowsHTML.push(dashRowHTML('Break points'));
    } else {
      const bpPctA = bpA.opportunities ? (bpA.converted / bpA.opportunities) * 100 : 0;
      const bpPctB = bpB.opportunities ? (bpB.converted / bpB.opportunities) * 100 : 0;
      rowsHTML.push(mirrorBarRowHTML(withPartialAsterisk('Break points', isPartial), S.fmtOpp(stats.breakPoints, 'A'), S.fmtOpp(stats.breakPoints, 'B'), bpPctA, bpPctB, false));
    }
    const spA = stats.setPoints.A, spB = stats.setPoints.B;
    const spPctA = spA.opportunities ? (spA.converted / spA.opportunities) * 100 : 0;
    const spPctB = spB.opportunities ? (spB.converted / spB.opportunities) * 100 : 0;
    rowsHTML.push(mirrorBarRowHTML('Set points', S.fmtOpp(stats.setPoints, 'A'), S.fmtOpp(stats.setPoints, 'B'), spPctA, spPctB, false));
    const mpA = stats.matchPoints.A, mpB = stats.matchPoints.B;
    const mpPctA = mpA.opportunities ? (mpA.converted / mpA.opportunities) * 100 : 0;
    const mpPctB = mpB.opportunities ? (mpB.converted / mpB.opportunities) * 100 : 0;
    rowsHTML.push(mirrorBarRowHTML('Match points', S.fmtOpp(stats.matchPoints, 'A'), S.fmtOpp(stats.matchPoints, 'B'), mpPctA, mpPctB, false));

    if (f.scoringSystem === 'golden' && stats.goldenPoints.played > 0) {
      const p = stats.goldenPoints.played;
      rowsHTML.push(sharedBarRowHTML('Puntos de oro', `${stats.goldenPoints.wonA}/${p}`, `${stats.goldenPoints.wonB}/${p}`, stats.goldenPoints.wonA, stats.goldenPoints.wonB, false));
    }
    if (f.scoringSystem === 'starpoint' && stats.starPoints.played > 0) {
      const p = stats.starPoints.played;
      rowsHTML.push(sharedBarRowHTML('Star points', `${stats.starPoints.wonA}/${p}`, `${stats.starPoints.wonB}/${p}`, stats.starPoints.wonA, stats.starPoints.wonB, false));
    }
    rowsHTML.push(noBarRowHTML(withPartialAsterisk('Racha máxima de puntos', isPartial), stats.maxStreak.A, stats.maxStreak.B));
    return rowsHTML.join('');
  }

  function buildStatsLegalText(stats) {
    const serverGap = !stats.hasServerInfo;
    if (serverGap) return 'No se pudo determinar el saque en este tramo: las métricas que dependen de él no están disponibles (—).';
    if (!stats.serverFullyKnown) return 'El saque no se conoce en todos los puntos de este tramo: estas métricas son parciales.';
    return '';
  }

  /** V12.1 (§4): aclaración ÚNICA para el asterisco de Break Points/Racha máxima — nunca
   *  repetida por fila. Independiente de `buildStatsLegalText` (esa habla de saque
   *  desconocido; esta, de ajustes manuales) — pueden coexistir. */
  function buildStatsPartialNoteText(stats) {
    return stats.hasAdjustments ? '* Datos parciales por ajuste manual' : '';
  }

  /** V8 (21): el % de games de saque sostenidos pasa a leerse PRIMERO y más grande; games y
   *  puntos quedan como detalle secundario debajo — mismo criterio que el resto de las
   *  métricas de saque/resto (14-18). No se inventa ninguna estadística individual nueva. */
  function buildPerPlayerServeRowsHTML(f, stats) {
    if (!stats.serverFullyKnown) return '';
    return f.players.map((p) => {
      const ps = stats.perPlayerServe[p.id];
      if (!ps || ps.games === 0) return '';
      const holdPct = Math.round((ps.held / ps.games) * 100);
      return `<div class="player-serve-row"><span class="player-serve-row__name">${p.name}</span><span class="player-serve-row__stat"><span class="player-serve-row__pct">${holdPct}%</span><span class="player-serve-row__detail">${ps.held}/${ps.games} games · ${ps.pointsWon}/${ps.pointsTotal} pts</span></span></div>`;
    }).join('');
  }

  /* ======================================================================
     V13 — ANÁLISIS EN POR GAMES (§22/§25/§26): estadísticas, Evolución y
     Momentos Clave adaptados a la granularidad de games. Encapsulado del
     mismo modo que el resto del modo — no reutiliza los builders de puntos.
     ====================================================================== */
  function buildGamesStatsGridRowsHTML(f, stats) {
    const isPartial = stats.hasAdjustments;
    const rowsHTML = [];
    // V02.2 (Bloque F, §15) — "Games ganados" ya vive en la tarjeta de resultado
    // (buildResultBlockHTML/buildSetsGamesSummaryHTML); repetirlo acá sería la misma
    // estadística dos veces en la misma pantalla.
    const sgA = stats.serviceGames.wonA + stats.serviceGames.lostA, sgB = stats.serviceGames.wonB + stats.serviceGames.lostB;
    if (sgA + sgB > 0) {
      const holdPctA = sgA ? (stats.serviceGames.wonA / sgA) * 100 : 0, holdPctB = sgB ? (stats.serviceGames.wonB / sgB) * 100 : 0;
      rowsHTML.push(mirrorBarRowHTML('Games de saque ganados', `${Math.round(holdPctA)}%`, `${Math.round(holdPctB)}%`, holdPctA, holdPctB, false, `${stats.serviceGames.wonA}/${sgA} games`, `${stats.serviceGames.wonB}/${sgB} games`));
    } else {
      rowsHTML.push(dashRowHTML('Games de saque ganados'));
    }
    rowsHTML.push(noBarRowHTML(withPartialAsterisk('Breaks', isPartial), stats.breaksA, stats.breaksB));
    rowsHTML.push(noBarRowHTML(withPartialAsterisk('Racha máxima de games', isPartial), stats.maxGameStreakA, stats.maxGameStreakB));
    rowsHTML.push(noBarRowHTML(withPartialAsterisk('Máxima ventaja alcanzada', isPartial), stats.maxAdvantageA ? `+${stats.maxAdvantageA}` : '—', stats.maxAdvantageB ? `+${stats.maxAdvantageB}` : '—'));
    rowsHTML.push(noBarRowHTML(withPartialAsterisk('Mayor desventaja remontada', isPartial), stats.maxComebackA || '—', stats.maxComebackB || '—'));
    return rowsHTML.join('');
  }

  function renderGamesStatsGrid(f) {
    $('#analysis-stats').hidden = false; // por si quedó oculto de ver un partido manual antes en la misma sesión
    renderSetFilterTabs('#stats-set-filter', f, () => { renderGamesStatsGrid(f); renderGamesEvolutionChart(f); });
    const stats = statsForCurrentFilter(f);
    $('#analysis-stats-grid').innerHTML = buildGamesStatsGridRowsHTML(f, stats);
    $('#analysis-stats-legal').hidden = true;
    $('#analysis-stats-legal').textContent = '';
    const noteEl = $('#analysis-stats-partial-note');
    // V13 (§12): nota única, mismo texto exacto que pide el Consolidado.
    const noteText = stats.hasAdjustments ? '* Datos parciales por corrección manual' : '';
    noteEl.hidden = !noteText;
    noteEl.textContent = noteText;
    $('#analysis-per-player-serve').hidden = true; // sin desglose individual en Por Games
  }

  /** V13 (§25): SVG simple propio — un segmento por set con la diferencia de games
   *  acumulada (0 = arranque del set), sin la sofisticación del índice de momentum de
   *  Completo (esa fórmula necesita puntos que este modo no observa). Nodos marcados
   *  `partial` (después de una corrección manual) se dibujan huecos, nunca se inventa el
   *  tramo intermedio. */
  function buildGamesEvolutionSvgHTML(f, setFilter) {
    const games = (f.evolution && f.evolution.games) || [];
    const nodesBySet = {};
    games.forEach((g) => { (nodesBySet[g.setNumber] = nodesBySet[g.setNumber] || []).push(g); });
    const setNumbers = setFilter === 'match' ? Object.keys(nodesBySet).map(Number).sort((a, b) => a - b) : [setFilter];
    if (!setNumbers.length || !nodesBySet[setNumbers[0]]) return { html: '<p class="coverage-note">Sin datos suficientes todavía.</p>' };

    const maxAbs = Math.max(3, ...games.map((g) => Math.abs(g.diff)));
    const H = 130, padTop = 16, padBottom = 16, plotH = H - padTop - padBottom;
    const colWidth = 34;
    let totalCols = 0;
    setNumbers.forEach((sn) => { totalCols += (nodesBySet[sn] ? nodesBySet[sn].length : 0) + 1; });
    const W = Math.max(240, totalCols * colWidth);
    const yFor = (diff) => padTop + plotH / 2 - (diff / maxAbs) * (plotH / 2);

    let x = 20;
    const segmentsHTML = [];
    setNumbers.forEach((sn, si) => {
      const nodes = nodesBySet[sn] || [];
      let path = `M ${x.toFixed(1)} ${yFor(0).toFixed(1)}`;
      const dots = [];
      nodes.forEach((g) => {
        x += colWidth;
        path += ` L ${x.toFixed(1)} ${yFor(g.diff).toFixed(1)}`;
        // V13: un nodo de corrección manual (`g.adjustment`) no tiene un "ganador de ese
        // game" real — es un salto de marcador, no un game — así que se pinta neutro en vez
        // de caer por defecto en el color de Equipo B.
        const color = g.winner === 'A' ? 'var(--team-a)' : (g.winner === 'B' ? 'var(--team-b)' : 'var(--paper-dim)');
        dots.push(g.partial
          ? `<circle cx="${x.toFixed(1)}" cy="${yFor(g.diff).toFixed(1)}" r="4" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="2,2" />`
          : `<circle cx="${x.toFixed(1)}" cy="${yFor(g.diff).toFixed(1)}" r="4" fill="${color}" />`);
      });
      segmentsHTML.push(`<path d="${path}" fill="none" stroke="var(--paper-faint)" stroke-width="1.5" />` + dots.join(''));
      if (si < setNumbers.length - 1) {
        segmentsHTML.push(`<line x1="${(x + colWidth / 2).toFixed(1)}" y1="${padTop}" x2="${(x + colWidth / 2).toFixed(1)}" y2="${H - padBottom}" stroke="var(--line)" stroke-dasharray="3,3" />`);
        x += colWidth;
      }
    });
    const zeroY = yFor(0).toFixed(1);
    const zeroLine = `<line x1="10" y1="${zeroY}" x2="${W - 10}" y2="${zeroY}" stroke="var(--line)" stroke-width="1" />`;
    return { html: `<svg viewBox="0 0 ${W} ${H}" class="momentum-svg" preserveAspectRatio="xMinYMid meet">${zeroLine}${segmentsHTML.join('')}</svg>` };
  }

  function buildGamesEvolutionLegendHTML(f) {
    const nameA = S.teamLabel(f.players, 'A'), nameB = S.teamLabel(f.players, 'B');
    return `<span class="momentum-legend__item"><span class="momentum-legend__dot momentum-legend__dot--a"></span>${nameA}</span><span class="momentum-legend__item"><span class="momentum-legend__dot momentum-legend__dot--b"></span>${nameB}</span>`;
  }

  function renderGamesEvolutionChart(f) {
    $('#analysis-momentum').hidden = false; // V14: por si quedó oculto de ver un partido manual antes en la misma sesión
    renderSetFilterTabs('#momentum-set-filter', f, () => { renderGamesStatsGrid(f); renderGamesEvolutionChart(f); });
    $('#analysis-momentum-copy').textContent = 'Cada punto es un game ganado. La línea sube o baja según la diferencia de games dentro del set.';
    const partialNote = $('#analysis-momentum-partial-note');
    const hadAdjustments = f.stats && f.stats.hasAdjustments;
    partialNote.hidden = !hadAdjustments;
    if (hadAdjustments) partialNote.textContent = 'Hubo una corrección manual: el tramo afectado se muestra con marcadores huecos (orden real desconocido).';
    $('#analysis-momentum-legend').innerHTML = buildGamesEvolutionLegendHTML(f);
    $('#analysis-momentum-chart').innerHTML = buildGamesEvolutionSvgHTML(f, analysisSetFilter).html;
  }

  /** V13 (§26) — Momentos Clave en Por Games: se arma directo de `f.evolution.moments`
   *  (ya calculado al finalizar, con matchTimeMs) — no hace falta re-derivar el motor acá. */
  function buildGamesKeyMomentsListHTML(f) {
    const nameOf = (team) => S.teamLabel(f.players, team);
    const facts = [{ ms: 0, real: f.startedAt, label: 'Inicio del partido' }];
    ((f.evolution && f.evolution.moments) || []).forEach((m) => {
      if (m.kind === 'match-finish') {
        const scoreStr = (m.sets || []).map(formatSetSegmentLabel).join(' · ');
        facts.push({ ms: m.matchTimeMs, real: m.timestamp, label: `🏆 ${nameOf(m.team)} gana el partido · ${scoreStr}` });
      } else if (m.kind === 'set-finish') {
        const scoreStr = m.closedSet ? formatSetSegmentLabel(m.closedSet) : '';
        facts.push({ ms: m.matchTimeMs, real: m.timestamp, label: `${nameOf(m.team)} gana el Set ${m.setNumber}${scoreStr ? ' · ' + scoreStr : ''}` });
      } else if (m.kind === 'tiebreak') {
        facts.push({ ms: m.matchTimeMs, real: m.timestamp, label: `${nameOf(m.team)} gana el Tie break${m.extraordinary ? ' extraordinario' : ' reglamentario'}` });
      }
    });
    f.highlights.forEach((h) => {
      const categoryLabel = h.category ? HIGHLIGHT_CATEGORY_LABELS[h.category] : null;
      facts.push({ ms: h.matchTimeMs, real: h.timestamp, label: `⭐ Highlight${categoryLabel ? ' · ' + categoryLabel : ''} · Set ${h.set} · ${h.games.a}-${h.games.b}` });
    });
    facts.sort((a, b) => a.ms - b.ms);
    return facts.map((fact) => {
      const realTime = fact.real ? formatRealTime(fact.real, f.timeZone) : '';
      return `<div class="keymoment-row"><div class="keymoment-row__time">${formatClock(fact.ms)}${realTime ? ' · ' + realTime : ''}</div><div class="keymoment-row__label">${fact.label}</div></div>`;
    }).join('');
  }

  /** V02.2 (Bloque F, §15) — un partido cargado a mano ya no tiene una sección ESTADÍSTICAS
   *  propia: su único contenido (Sets/Games ganados) se mudó dentro de la tarjeta de
   *  resultado (buildResultBlockHTML) y su aclaración a la nota de cobertura pegada ahí mismo
   *  (buildCoverageLegalHTML) — mantener esta sección vacía y visible sería justo la
   *  "sección ESTADÍSTICAS flotando lejos del marcador" que el consolidado pide eliminar. */
  function renderManualStatsGrid(f) {
    $('#analysis-stats').hidden = true;
  }

  function renderStatsGrid(f) {
    if (f.mode === 'games') { renderGamesStatsGrid(f); return; }
    if (f.mode === 'manual') { renderManualStatsGrid(f); return; }
    $('#analysis-stats').hidden = false; // por si quedó oculto de ver un partido manual antes en la misma sesión
    renderSetFilterTabs('#stats-set-filter', f, () => { renderStatsGrid(f); renderEvolutionChart(f); });
    const stats = statsForCurrentFilter(f);
    $('#analysis-stats-grid').innerHTML = buildStatsGridRowsHTML(f, stats);

    // T2: UNA sola aclaración general, no repetida en cada fila.
    const legalEl = $('#analysis-stats-legal');
    const legalText = buildStatsLegalText(stats);
    legalEl.hidden = !legalText;
    legalEl.textContent = legalText;

    const partialNoteEl = $('#analysis-stats-partial-note');
    const partialNoteText = buildStatsPartialNoteText(stats);
    partialNoteEl.hidden = !partialNoteText;
    partialNoteEl.textContent = partialNoteText;

    const perPlayerWrap = $('#analysis-per-player-serve');
    const perPlayerHTML = buildPerPlayerServeRowsHTML(f, stats);
    perPlayerWrap.hidden = !perPlayerHTML;
    if (perPlayerHTML) $('#analysis-per-player-serve-grid').innerHTML = perPlayerHTML;
  }

  /** V9 — REEMPLAZA la vieja lógica de Momentum (% de los últimos 8 puntos) por el índice
   *  de posición competitiva (dos líneas independientes, no espejadas, 0-100), calculado
   *  por `computeEvolutionData` (stats.js) — ver esa función para el detalle del cálculo.
   *  Sets delimitados con etiqueta centrada + score de cierre, breaks marcados solo si se
   *  conoce el sacador, Tie break señalado, ajustes cortan la línea (nunca se conectan), y
   *  en partido parcial arranca exactamente donde arrancó el registro (nunca inventa tramos). */
  /** V7 (97-108): construcción PURA del SVG de Evolución — misma fuente para la pantalla de
   *  Análisis y para la exportación de Compartir. Devuelve `{ html, isError }`. */
  /** V8 (40): interpola con Catmull-Rom→Bezier para suavizar el trazado sin inventar
   *  ningún valor intermedio — la curva sigue pasando EXACTAMENTE por cada punto real, solo
   *  cambia cómo se dibuja el tramo entre uno y el siguiente. Tensión moderada (0.2) para
   *  reducir esquinas duras sin volverse una curva excesivamente ondulada. */
  function smoothPathD(pts) {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    const t = 0.2;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) * t, cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t, cp2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  /** V8 (42-43): partido con sets previos SIN datos (arrancó con "Partido ya empezado").
   *  Se muestran como pills atenuadas ANTES del gráfico — nunca como línea inventada — para
   *  que quede claro que esos sets existieron aunque no tengamos su desarrollo punto a
   *  punto. Solo aplica a la vista PARTIDO (no tiene sentido repetirlas dentro de cada tab
   *  de set). */
  function buildUntrackedSetsPillsHTML(f) {
    const untracked = f.baseline ? f.baseline.sets : [];
    if (!untracked || !untracked.length) return '';
    const pills = untracked.map((s, i) => `<span class="momentum-untracked-pill">SET ${i + 1} · ${s.gamesA}–${s.gamesB}</span>`).join('');
    return `<div class="momentum-untracked-sets">${pills}<span class="momentum-untracked-arrow">→</span></div>`;
  }

  /** V9 — REEMPLAZA por completo la vieja curva de Momentum (% de los últimos 8 puntos).
   *  Dibuja el ÍNDICE DE POSICIÓN COMPETITIVA (0-100, independiente por pareja, nunca un
   *  % de puntos ni una probabilidad) que devuelve `computeEvolutionData`. La unidad es
   *  el GAME (no el punto): cada nodo de la curva corresponde al cierre de un game o de
   *  un Tie break. Los picos especiales (Match/Set Point, Oro/Star, mini-break) se
   *  marcan aparte, sin agregar un nodo por cada punto, para que el gráfico no se sature.
   *  `f.evolution.games[i].indexA/indexB` es el formato NUEVO; partidos guardados con la
   *  versión anterior de la app no tienen ese campo — se detecta y se avisa en vez de
   *  dibujar una curva inventada o rota (nunca se pierde el partido guardado, V9 top). */
  function buildEvolutionSvgHTML(f, setFilter) {
    const pillsHTML = setFilter === 'match' ? buildUntrackedSetsPillsHTML(f) : '';
    const evo = f.evolution;
    if (!evo || !evo.games || !evo.games.length) {
      return { html: pillsHTML + '<p class="coverage-note">Evolución no disponible para este partido.</p>', isError: true };
    }
    const hasNewFormat = evo.games.some((g) => typeof g.indexA === 'number');
    if (!hasNewFormat) {
      return { html: pillsHTML + '<p class="coverage-note">Este partido se guardó con una versión anterior de la app y no tiene los datos necesarios para la nueva Evolución del partido.</p>', isError: true };
    }

    // V9: el nodo visual de arranque (50/50, "ambas líneas nacen juntas") es puramente de
    // presentación — se arma acá, LOCAL a esta función, sin tocar `f.evolution.games` (ese
    // array es la fuente compartida que también indexan por posición Momentos Clave y
    // Timeline; agregarle un nodo extra ahí los desalinearía — bug real encontrado y
    // corregido durante el desarrollo de V9).
    const wasLateStart = !!(f.baseline || f.coverageStartLabel);
    const firstGame = evo.games[0];
    const virtualStart = {
      idx: -1, indexA: 50, indexB: 50, isGap: false, isVirtualStart: true,
      setNumber: firstGame.setNumber, matchTimeMs: firstGame.matchTimeMs,
      winner: null, isBreak: false, closedSet: false, setResult: null, matchWinner: null,
    };
    if (wasLateStart) {
      virtualStart.isRegistrationStart = true;
      virtualStart.registrationStartLabel = f.coverageStartLabel || '';
    }
    const allGames = [virtualStart, ...evo.games];
    // V11.4 — cada vista de SET necesita su propio ancla visual de arranque, no solo el
    // Set 1 (que hereda el `virtualStart` del partido completo, arriba). El índice
    // competitivo NUNCA "resetea" a 50/50 entre sets — se hereda del cierre del set
    // anterior — así que el ancla de un Set 2/3 usa el índice real donde quedó ese set al
    // empezar, no un 50/50 inventado (mismo criterio de no inventar datos que V9 ya usaba
    // para el ancla del partido completo).
    function buildSetStartAnchor(setNum) {
      const priorSetGames = evo.games.filter((g) => g.setNumber < setNum);
      const last = priorSetGames[priorSetGames.length - 1];
      return {
        idx: -1, indexA: last ? last.indexA : 50, indexB: last ? last.indexB : 50, isGap: false, isVirtualStart: true,
        setNumber: setNum, matchTimeMs: (evo.games.find((g) => g.setNumber === setNum) || {}).matchTimeMs || 0,
        winner: null, isBreak: false, closedSet: false, setResult: null, matchWinner: null,
      };
    }
    const games = (() => {
      if (setFilter === 'match') return allGames;
      const filtered = allGames.filter((g) => g.setNumber === setFilter);
      if (filtered.length && !filtered[0].isVirtualStart) return [buildSetStartAnchor(setFilter), ...filtered];
      return filtered;
    })();
    const realGames = games.filter((g) => !g.isVirtualStart);
    if (!realGames.length) return { html: pillsHTML + '<p class="coverage-note">Sin games registrados en este set.</p>', isError: true };

    const w = 320, h = 170, pad = 6, topPad = 22;
    const n = games.length;
    const xScale = (i) => (n <= 1 ? w / 2 : pad + (i / (n - 1)) * (w - pad * 2));
    const yScale = (val) => topPad + ((100 - val) / 100) * (h - topPad);

    function pathFor(key) {
      const segments = [[]];
      games.forEach((g, i) => {
        if (g.isGap) segments.push([]);
        segments[segments.length - 1].push({ x: xScale(i), y: yScale(g[key]) });
      });
      return segments.filter((seg) => seg.length > 1).map((seg) =>
        `<path d="${smoothPathD(seg)}" fill="none" stroke="${key === 'indexA' ? 'var(--team-a)' : 'var(--team-b)'}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
      ).join('');
    }
    const pathA = pathFor('indexA');
    const pathB = pathFor('indexB');

    // Gap de ajuste (✎) e inicio de registro tardío — mismo criterio visual que antes.
    const gapMarkers = games.map((g, i) => {
      if (g.isRegistrationStart) {
        const label = g.registrationStartLabel ? `INICIO REGISTRO · ${g.registrationStartLabel}` : 'INICIO REGISTRO';
        return `
          <line x1="${xScale(i).toFixed(1)}" y1="${topPad}" x2="${xScale(i).toFixed(1)}" y2="${h}" stroke="rgba(244,247,242,0.4)" stroke-dasharray="3,2" stroke-width="1.2"/>
          <text x="${xScale(i).toFixed(1)}" y="${topPad - 6}" font-size="7.5" fill="rgba(244,247,242,0.65)" text-anchor="start" font-weight="700">${label}</text>
        `;
      }
      if (g.isGap) {
        return `
          <line x1="${xScale(i).toFixed(1)}" y1="${topPad}" x2="${xScale(i).toFixed(1)}" y2="${h}" stroke="var(--gold)" stroke-dasharray="2,2" stroke-width="1.2" opacity="0.55"/>
          <text x="${xScale(i).toFixed(1)}" y="${topPad - 6}" font-size="9" fill="var(--gold)" text-anchor="middle">✎</text>
        `;
      }
      return '';
    }).join('');

    // V10 (34/37): la vista PARTIDO se limpia — nada de mini-break, círculos de break ni
    // cierre de Tie break sobre la curva global. Esos símbolos se conservan SOLO en la
    // vista por Set (§36), donde el usuario ya está mirando un tramo puntual.
    const isMatchView = setFilter === 'match';
    // V11.3 (checkpoints de cambio de lado) — Americano es 1 solo set, así que su vista
    // PARTIDO ES el set completo: mostrar ahí los mismos checkpoints que en vista Set no
    // satura nada (hoy queda casi vacía, solo curva + resultado). Clásico (varios sets)
    // mantiene la vista PARTIDO limpia — los checkpoints solo aparecen al entrar a cada Set.
    const formatConfig = E.FORMATS[f.formatId];
    const isSingleSetFormat = !!(formatConfig && formatConfig.bestOfSets === 1);

    // Breaks realmente convertidos + cierre de Tie break con resultado (solo vista Set).
    const eventMarkers = isMatchView ? '' : games.map((g, i) => {
      if (g.isVirtualStart) return '';
      const x = xScale(i);
      let marks = '';
      if (g.isBreak) {
        const y = yScale(g.winner === 'A' ? g.indexA : g.indexB);
        marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="none" stroke="${g.winner === 'A' ? 'var(--team-a)' : 'var(--team-b)'}" stroke-width="2"/>`;
      }
      if (g.isTiebreakClose) {
        const y = yScale(g.winner === 'A' ? g.indexA : g.indexB);
        const tb = g.tiebreak;
        marks += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--gold)"/>`;
        if (tb) marks += `<text x="${x.toFixed(1)}" y="${(topPad - 6).toFixed(1)}" font-size="8" fill="var(--gold)" text-anchor="middle">TB ${tb.a}-${tb.b}</text>`;
      }
      return marks;
    }).join('');

    const specialNodesForFilter = setFilter === 'match' ? (evo.specialNodes || []) : (evo.specialNodes || []).filter((s) => s.setNumber === setFilter);

    // V10 (35): vista PARTIDO — reemplaza el rombo flotante por una línea vertical fina y
    // discreta con el color de quien tuvo el Match Point, etiquetada "MP" o "N MP" cuando
    // esa secuencia agrupó varios (§35). Set Point / Oro-Star / mini-break rutinarios NO
    // se muestran acá (§34) — solo lo verdaderamente decisivo del partido.
    const matchPointLines = isMatchView ? specialNodesForFilter
      .filter((s) => s.kind === 'match-point')
      .map((s) => {
        let posIdx = games.findIndex((g) => !g.isVirtualStart && g.matchTimeMs >= s.matchTimeMs);
        if (posIdx === -1) posIdx = games.length - 1;
        const x = xScale(Math.max(0, posIdx - 0.4));
        const color = s.team === 'A' ? 'var(--team-a)' : 'var(--team-b)';
        const label = (s.count && s.count > 1) ? `${s.count} MP` : 'MP';
        return `<line x1="${x.toFixed(1)}" y1="${topPad}" x2="${x.toFixed(1)}" y2="${h}" stroke="${color}" stroke-width="1.2" opacity="0.65"/>` +
          `<text x="${x.toFixed(1)}" y="${(topPad - 6).toFixed(1)}" font-size="7.5" fill="${color}" text-anchor="middle" font-weight="700">${label}</text>`;
      }).join('') : '';

    // Vista por Set: se conserva el detalle previo (rombo con Match/Set Point, Oro-Star) —
    // el usuario ya está mirando un tramo puntual y puede sostener más información sin que
    // el gráfico se sienta saturado (§36). V11 (§13.2): los mini-breaks de Tie break quedan
    // FUERA del dibujo — generaban un rombo + etiqueta "mini-break" por cada punto del
    // desempate, y con un TB largo se amontonaban y se pisaban entre sí (bug real reportado).
    // Siguen existiendo en los datos (cálculo interno, Momentos Clave); acá ya no se dibujan.
    const specialMarkers = isMatchView ? '' : specialNodesForFilter.filter((s) => s.kind !== 'minibreak').map((s) => {
        let posIdx = games.findIndex((g) => !g.isVirtualStart && g.matchTimeMs >= s.matchTimeMs);
        if (posIdx === -1) posIdx = games.length - 1;
        const x = xScale(Math.max(0, posIdx - 0.4));
        const y = yScale(s.team === 'A' ? s.indexA : s.indexB);
        const color = s.team === 'A' ? 'var(--team-a)' : 'var(--team-b)';
        const label = s.kind === 'match-point' ? ((s.count && s.count > 1) ? `${s.count} MP` : 'MP') : s.kind === 'set-point' ? 'SP' : (s.isGoldOrStar ? '★' : '');
        return `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="${color}" transform="rotate(45 ${x.toFixed(1)} ${y.toFixed(1)})" opacity="0.9"/>` +
          (label ? `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" font-size="6.5" fill="${color}" text-anchor="middle" font-weight="700">${label}</text>` : '');
      }).join('');

    // V11.3 — CHECKPOINTS DE CAMBIO DE LADO: en pádel se cambia de lado después del game 1,
    // 3, 5, 7... (el cambio tras el game 1 no tiene pausa, así que no se marca). Se usan esos
    // momentos naturales — no arbitrarios — como referencia temporal de la curva: una línea
    // fina y discreta con el marcador real de ESE momento, cada dos games a partir del
    // tercero (3, 5, 7, 9...). Nunca dentro del Tie break (se sigue representando solo con la
    // curva, sin ningún checkpoint ni mini-break). `withinSetGameCounter` cuenta games REALES
    // dentro del tramo mostrado — no el índice crudo del array, que puede arrancar corrido si
    // el nodo virtual de arranque (50/50) está presente (vista Set 1 y vista Partido en
    // Americano sí lo tienen; vista Set 2/3 no, al quedar filtrado fuera).
    // V11.4 (feedback real) — el "0-0" del arranque es siempre visible (ancla el comienzo de
    // la curva); en modo 'full' además se agrega el resultado del PRIMER game (1-0/0-1, para
    // ver de entrada hacia dónde empezó a moverse la curva) y se sigue con los checkpoints ya
    // existentes (3, 5, 7, 9...). En modo 'anchorOnly' (vista PARTIDO de un Clásico
    // multiset) solo se dibuja el "0-0" — el resto de los checkpoints vive en cada Set.
    function drawCheckpoint(x, label) {
      return `<line x1="${x.toFixed(1)}" y1="${topPad}" x2="${x.toFixed(1)}" y2="${h}" stroke="rgba(244,247,242,0.18)" stroke-width="1"/>` +
        `<text x="${x.toFixed(1)}" y="${h + 11}" font-size="7.5" fill="rgba(244,247,242,0.45)" text-anchor="middle">${label}</text>`;
    }
    function buildGameCheckpointsSvg(gamesArr, mode) {
      let svg = '';
      let withinSetGameCounter = 0;
      gamesArr.forEach((g, i) => {
        if (g.isVirtualStart) { svg += drawCheckpoint(xScale(i), '0-0'); return; }
        if (mode === 'anchorOnly') return;
        withinSetGameCounter += 1;
        if (g.isTiebreakClose) return;
        const isFirstGame = withinSetGameCounter === 1;
        const isOddCheckpoint = withinSetGameCounter >= 3 && withinSetGameCounter % 2 === 1;
        if (!isFirstGame && !isOddCheckpoint) return;
        svg += drawCheckpoint(xScale(i), `${g.gamesA}-${g.gamesB}`);
      });
      return svg;
    }

    // Etiqueta de set centrada dentro de su tramo + score de cierre.
    let setLabelsSvg = '';
    if (setFilter === 'match') {
      let segStartIdx = 0;
      games.forEach((g, i) => {
        if (g.isVirtualStart) return;
        if (g.closedSet || i === games.length - 1) {
          const midX = (xScale(segStartIdx) + xScale(i)) / 2;
          setLabelsSvg += `<text x="${midX.toFixed(1)}" y="${topPad - 8}" font-size="8" fill="rgba(244,247,242,0.4)" text-anchor="middle">SET ${g.setNumber}</text>`;
          if (g.closedSet && g.setResult) {
            const scoreStr = `${g.setResult.gamesA}–${g.setResult.gamesB}`;
            setLabelsSvg += `<line x1="${xScale(i).toFixed(1)}" y1="${topPad}" x2="${xScale(i).toFixed(1)}" y2="${h}" stroke="rgba(244,247,242,0.18)" stroke-width="1"/>`;
            setLabelsSvg += `<text x="${xScale(i).toFixed(1)}" y="${h + 11}" font-size="8" fill="rgba(244,247,242,0.5)" text-anchor="middle">${scoreStr}</text>`;
          }
          segStartIdx = i + 1;
        }
      });
      // Americano: la vista PARTIDO es el único set completo — los checkpoints aportan
      // lectura ahí (hoy queda casi vacía) sin saturar. Clásico se mantiene limpio: solo el
      // "0-0" inicial como referencia, nada de checkpoints por game (viven en cada Set).
      setLabelsSvg += buildGameCheckpointsSvg(games, isSingleSetFormat ? 'full' : 'anchorOnly');
    } else {
      setLabelsSvg += buildGameCheckpointsSvg(games, 'full');
    }

    const svg = `
      <svg viewBox="0 0 ${w} ${h + 14}" width="100%" height="${h + 14}" xmlns="http://www.w3.org/2000/svg">
        <line x1="${pad}" y1="${yScale(50).toFixed(1)}" x2="${w - pad}" y2="${yScale(50).toFixed(1)}" stroke="rgba(244,247,242,0.25)" stroke-width="1"/>
        ${setLabelsSvg}
        ${gapMarkers}
        ${pathA}
        ${pathB}
        ${eventMarkers}
        ${specialMarkers}
        ${matchPointLines}
      </svg>`;
    return { html: pillsHTML + svg, isError: false };
  }

  /** V9.2 (17) — leyenda compacta de los símbolos que pueden aparecer sobre la curva. Se
   *  muestra siempre igual (no se filtra según lo que efectivamente aparezca en cada
   *  partido) para mantener la implementación simple, tal como permite el consolidado. */
  function buildEvolutionSymbolsLegendHTML() {
    const circleBreak = '<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    const circleTb = '<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="var(--gold)"/></svg>';
    const diamond = '<svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" fill="var(--gold)" transform="rotate(45 5 5)"/></svg>';
    return `<span class="momentum-legend__symbols">
      <span class="momentum-legend__symbol">${circleBreak}break</span>
      <span class="momentum-legend__symbol">${circleTb}cierre TB</span>
      <span class="momentum-legend__symbol">${diamond}MP · SP · Oro/Star</span>
    </span>`;
  }

  /** V10 (34): en la vista PARTIDO la leyenda de símbolos (break/TB/rombo) ya no aplica —
   *  ese detalle solo aparece en la vista por Set, así que la leyenda se simplifica a los
   *  nombres de las parejas cuando se está mirando el partido completo. */
  function buildEvolutionLegendHTML(f, setFilter) {
    const nameA = S.teamLabel(f.players, 'A'), nameB = S.teamLabel(f.players, 'B');
    const symbols = setFilter === 'match' ? '' : buildEvolutionSymbolsLegendHTML();
    return `<span class="momentum-legend__item"><span class="momentum-legend__dot momentum-legend__dot--a"></span>${nameA}</span><span class="momentum-legend__item"><span class="momentum-legend__dot momentum-legend__dot--b"></span>${nameB}</span>${symbols}`;
  }

  /** V9: ya no es "% de los últimos N puntos" — es la posición competitiva de cada
   *  pareja en cada momento del partido (estructura del partido, situación del set
   *  actual y control del saque). Nunca se presenta como una probabilidad de ganar. */
  function buildEvolutionCopyText() {
    return 'Muestra la posición competitiva de cada pareja a lo largo del partido (sets, situación del set actual y control del saque) — no es una probabilidad de ganar.';
  }

  function renderEvolutionChart(f) {
    if (f.mode === 'games') { renderGamesEvolutionChart(f); return; }
    // V14 (§15): un partido cargado no tiene NINGÚN evento game a game que graficar (a
    // diferencia de Por Games, que sí aproxima Evolución porque esos eventos existen) — se
    // oculta el módulo COMPLETO (título+gráfico+leyenda), nunca un mensaje de "no disponible".
    if (f.mode === 'manual') { $('#analysis-momentum').hidden = true; return; }
    $('#analysis-momentum').hidden = false; // por si quedó oculto de ver un partido manual antes en la misma sesión
    renderSetFilterTabs('#momentum-set-filter', f, () => { renderStatsGrid(f); renderEvolutionChart(f); });
    const wrap = $('#analysis-momentum-chart');
    const legendWrap = $('#analysis-momentum-legend');
    const partialNote = $('#analysis-momentum-partial-note');
    $('#analysis-momentum-copy').textContent = buildEvolutionCopyText();

    if (f.baseline || f.coverageStartLabel) {
      partialNote.hidden = false;
      partialNote.textContent = `Registro desde ${f.coverageStartLabel || 'el punto donde empezó a registrarse el partido'}.`;
    } else {
      partialNote.hidden = true;
    }

    legendWrap.innerHTML = buildEvolutionLegendHTML(f, analysisSetFilter);
    wrap.innerHTML = buildEvolutionSvgHTML(f, analysisSetFilter).html;
  }

  /** V7 (97-108): HTML puro de la lista de Highlights, para pantalla y Compartir por igual. */
  function buildHighlightsListHTML(f) {
    return f.highlights.map((h) => {
      // V13 (§9): un Highlight de Por Games no tiene score de puntos que mostrar (nunca se
      // inventa) — el score de games ya se ve en "Set N · a-b", así que acá simplemente se omite.
      const scoreLabel = (h.score && h.score.gamesOnly) ? '' : (h.score.tiebreak ? `${h.score.a}-${h.score.b} (TB)` : highlightScoreLabel(h));
      const categoryLabel = h.category ? HIGHLIGHT_CATEGORY_LABELS[h.category] : null;
      return `<div class="highlight-row">
        <span class="highlight-row__time">⭐ ${formatClock(h.matchTimeMs)} · ${formatRealTime(h.timestamp, f.timeZone)}</span>
        <span class="highlight-row__meta">${categoryLabel ? categoryLabel + ' · ' : ''}Set ${h.set} · ${h.games.a}-${h.games.b}${scoreLabel ? ' · ' + scoreLabel : ''}${h.server ? ' · Saca ' + h.server.name : ''}</span>
      </div>`;
    }).join('');
  }

  function renderHighlightsSection(f) {
    const section = $('#analysis-highlights');
    if (!f.highlights.length) { section.hidden = true; return; }
    section.hidden = false;
    $('#analysis-highlights-list').innerHTML = buildHighlightsListHTML(f);
  }

  /** Bloque W — Momentos clave: inicio, finales de set, arranque de Tie break, Match Points
   *  salvados/convertidos, ajustes, final, y SOLO los breaks que realmente aportan historia
   *  (W2: cambian el liderazgo del set, ponen a servir por el set, o definen set/partido) —
   *  nunca todos los breaks. Usa `f.evolution.games` (calculado con el sacador real al
   *  finalizar) para saber qué games fueron breaks, en vez de intentar resolverlo de nuevo
   *  sin esa información (lo que antes hacía que Break Point nunca se detectara, siempre null). */
  /**
   * V9.2 (19-21) — Momentos Clave ahora consume el MISMO detector de acontecimientos que
   * Evolución (`f.evolution.moments`), en vez de tener su propia interpretación
   * independiente de los mismos hechos. Un mismo punto puede generar varios "moments"
   * simultáneos (p.ej. Punto de Oro + quiebre + fin de set + fin de partido) — se agrupan
   * por `matchTimeMs` y se narran como UN solo acontecimiento compuesto, nunca varias
   * líneas repetidas para el mismo punto (bug real: un Americano 6-4 donde el único
   * quiebre —que además cerraba el partido— no aparecía en Momentos Clave).
   *
   * La estructura básica (fin de set/partido, arranque de Tie break, ajustes) se sigue
   * derivando recorriendo los eventos reales con el motor puro (no necesita conocer el
   * saque), así que funciona igual para partidos guardados con cualquier versión de la
   * app. Los acontecimientos más ricos (quiebres, Match Points, Oro/Star, remontadas) se
   * agregan encima desde `f.evolution.moments` solo cuando están disponibles (V9+) — para
   * partidos guardados en versiones anteriores, Momentos Clave sigue mostrando la
   * estructura básica sin romperse ni inventar datos que no existen.
   */
  function buildFactsTimeline(f) {
    const format = E.FORMATS[f.formatId];
    const facts = [];
    // V6 fix (Bloque 77/78): si el registro arrancó a mitad de partido (`baseline`),
    // el estado inicial NO es 0-0 — hay que arrancar desde ahí para que tanto el
    // rótulo como el score de cada evento posterior (quiebres, fin de set, etc.) sea
    // el marcador REAL del partido, nunca uno relativo empezando de nuevo en 0-0.
    let state = f.baseline ? E.applyAdjustment(f.baseline) : E.createInitialEngineState();
    if (f.baseline) {
      const label = f.coverageStartLabel ? ` · ${f.coverageStartLabel}` : '';
      facts.push({ ms: 0, real: f.startedAt, label: `Inicio del registro${label}` });
    } else {
      facts.push({ ms: 0, real: f.startedAt, label: 'Inicio del partido' });
    }

    const structuralByMs = {};
    const tsByMs = {};
    f.events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        const beforeAdj = state;
        state = E.applyAdjustment(ev.newState);
        facts.push({ ms: ev.matchTimeMs, real: ev.timestamp, label: etbAdjustmentLabel(ev, beforeAdj, '✎ AJUSTE DE MARCADOR') });
        return;
      }
      tsByMs[ev.matchTimeMs] = ev.timestamp;
      const before = state;
      const modeForThisPoint = ev.tbMode || f.tiebreakMode || 'classic';
      state = E.applyPoint(state, ev.team, f.scoringSystem, format, modeForThisPoint);
      const wonSet = state.sets.length > before.sets.length;
      const wonMatch = state.matchWinner && !before.matchWinner;
      const enteredTb = state.inTiebreak && !before.inTiebreak;
      if (wonMatch) structuralByMs[ev.matchTimeMs] = { kind: 'match-finish', sets: state.sets.slice() };
      else if (wonSet) structuralByMs[ev.matchTimeMs] = { kind: 'set-finish', set: state.sets[state.sets.length - 1], setNumber: state.sets.length };
      else if (enteredTb) structuralByMs[ev.matchTimeMs] = { kind: 'tiebreak-start', scoreAfter: `${state.gamesA}-${state.gamesB}` };
    });

    const richMoments = (f.evolution && f.evolution.moments) || [];
    const richByMs = {};
    richMoments.forEach((m) => { (richByMs[m.matchTimeMs] = richByMs[m.matchTimeMs] || []).push(m); });

    const allMs = Array.from(new Set([...Object.keys(structuralByMs), ...Object.keys(richByMs)].map(Number))).sort((a, b) => a - b);
    allMs.forEach((ms) => {
      const label = buildCompositeMomentLabel(structuralByMs[ms] || null, richByMs[ms] || [], f);
      if (label) facts.push({ ms, real: tsByMs[ms], label });
    });

    f.highlights.forEach((h) => {
      const categoryLabel = h.category ? HIGHLIGHT_CATEGORY_LABELS[h.category] : null;
      facts.push({ ms: h.matchTimeMs, real: h.timestamp, label: `⭐ Highlight${categoryLabel ? ' · ' + categoryLabel : ''} · Set ${h.set} · ${h.games.a}-${h.games.b}` });
    });
    facts.sort((a, b) => a.ms - b.ms);
    return facts;
  }

  /** V9.2 (20) — compone UNA sola línea a partir de lo estructural (fin de set/partido,
   *  arranque de Tie break) y los "moments" ricos que hayan ocurrido en el MISMO punto
   *  (quiebre, Oro/Star, Match Point salvado, remontada completada). Devuelve `null`
   *  cuando no hay nada suficientemente relevante para mostrar en Momentos Clave (p.ej.
   *  un Set Point suelto, o un mini-break de Tie break aislado). */
  function buildCompositeMomentLabel(structural, richItems, f) {
    const has = (kind) => richItems.find((m) => m.kind === kind);
    const breakM = has('break');
    const goldWon = has('gold-point-won') || has('star-point-won');
    const mpSaved = has('match-point-saved');
    const comeback = has('comeback-completed');
    const teamNameOf = (team) => S.teamLabel(f.players, team);
    const prefix = goldWon ? (goldWon.kind === 'gold-point-won' ? 'Punto de Oro · ' : 'Star Point · ') : '';

    if (structural && structural.kind === 'match-finish') {
      const scoreStr = structural.sets.map(formatSetSegmentLabel).join(' · ');
      if (breakM) return `${prefix}${teamNameOf(breakM.team)} quiebra y cierra el partido → ${scoreStr}`;
      return `${prefix}🏆 Fin del partido · ${scoreStr}`;
    }
    if (structural && structural.kind === 'set-finish') {
      const s = structural.set;
      const scoreStr = `${s.gamesA}-${s.gamesB}${s.tiebreak ? ` (TB ${s.tiebreak.a}-${s.tiebreak.b})` : ''}`;
      if (breakM) return `${prefix}${teamNameOf(breakM.team)} quiebra y cierra el Set ${structural.setNumber} → ${scoreStr}`;
      return `${prefix}Fin del Set ${structural.setNumber} · ${scoreStr}`;
    }
    if (structural && structural.kind === 'tiebreak-start') {
      return `Arranca el Tie break (${structural.scoreAfter})`;
    }
    if (breakM) {
      return `${prefix}${teamNameOf(breakM.team)} quiebra → ${breakM.scoreAfter}`;
    }
    if (comeback) {
      return `${teamNameOf(comeback.team)} completan una remontada → ${comeback.scoreAfter}`;
    }
    if (mpSaved) {
      return `${teamNameOf(mpSaved.savedBy)} salva un Match Point de ${teamNameOf(mpSaved.team)}`;
    }
    // Set Point suelto, Oro/Star sin quiebre/cierre asociado, mini-break de Tie break, o
    // consolidación de break: ninguno aporta por sí solo a Momentos Clave (mismo criterio
    // de "menos ruido" que la Evolución, punto 16).
    return null;
  }

  /** V7 (97-108): HTML puro de Momentos Clave, para pantalla y Compartir por igual. */
  function buildKeyMomentsListHTML(f) {
    const facts = buildFactsTimeline(f);
    return facts.map((fact) => {
      const realTime = fact.real ? formatRealTime(fact.real, f.timeZone) : '';
      return `<div class="keymoment-row"><div class="keymoment-row__time">${formatClock(fact.ms)}${realTime ? ' · ' + realTime : ''}</div><div class="keymoment-row__label">${fact.label}</div></div>`;
    }).join('');
  }

  function renderKeyMoments(f) {
    // V14: sin eventos, Momentos Clave degeneraría a una sola línea trivial ("Inicio del
    // partido") — los pocos hechos disponibles ya están en el texto de BRAMU Intelligence,
    // así que se oculta el módulo entero en vez de mostrar una lista casi vacía (§14).
    if (f.mode === 'manual') { $('#analysis-keymoments').hidden = true; return; }
    $('#analysis-keymoments').hidden = false; // por si quedó oculto de ver un partido manual antes en la misma sesión
    $('#analysis-keymoments-list').innerHTML = f.mode === 'games' ? buildGamesKeyMomentsListHTML(f) : buildKeyMomentsListHTML(f);
  }

  /* ------------------------------------------------------------------ */
  /* TIMELINE COMPLETO — Bloque X. Bitácora agrupada por SET (X1) y dentro
     por GAME (X2), con tags discretos (X3), log de puntos legible (X4) y el
     bug del game-final-de-set mostrando 0-0 corregido (X5): el score de un
     game que cerró un set se toma de `state.sets[...]` (guardado ANTES del
     reset), nunca de `state.gamesA/gamesB` después de aplicarlo.           */
  /* ------------------------------------------------------------------ */
  function renderFullTimeline(f) {
    const format = E.FORMATS[f.formatId];
    const wrap = $('#timeline-full-list');
    wrap.innerHTML = '';

    // V6 fix (Bloque 79-85): si el partido arrancó con "Partido ya empezado", `f.baseline`
    // tiene los sets ya jugados (sin desarrollo conocido) + el estado exacto del set/game
    // en el que arrancó el registro real. Antes esto se ignoraba por completo y el Timeline
    // inventaba un "SET 1" desde 0-0 con games falsos (1-0, 2-0...) aunque el partido en
    // realidad iba, por ejemplo, 4-3. Ahora: los sets del baseline se muestran como resumen
    // cargado a mano (sin games), y el desarrollo punto a punto arranca desde el estado real.
    const baselineSets = f.baseline ? f.baseline.sets : [];
    if (baselineSets.length) {
      baselineSets.forEach((s, idx) => {
        const setDiv = document.createElement('div');
        setDiv.className = 'timeline-set timeline-set--manual';
        const scoreLabel = `${s.gamesA}–${s.gamesB}${s.tiebreak ? ` (TB ${s.tiebreak.a}–${s.tiebreak.b})` : ''}`;
        setDiv.innerHTML = `<div class="timeline-set__header timeline-set__header--static"><span>SET ${idx + 1} · ${scoreLabel}</span></div><div class="timeline-set__body" style="display:block;"><p class="coverage-note" style="margin:6px 0 0;">Resultado cargado manualmente</p></div>`;
        wrap.appendChild(setDiv);
      });
    }
    if (f.coverageStartLabel) {
      const note = document.createElement('p');
      note.className = 'coverage-note';
      note.textContent = `Registro detallado desde ${f.coverageStartLabel}`;
      wrap.appendChild(note);
    }

    const evoGames = (f.evolution && f.evolution.games) || [];
    let evoIdx = 0;

    let state = f.baseline ? E.applyAdjustment(f.baseline) : E.createInitialEngineState();
    // Set/game en el que arranca el registro real (para numerar el primer game con el
    // número que le corresponde de verdad, y marcarlo PARCIAL si empezó a mitad de game).
    const baselineSetNumber = f.baseline ? f.baseline.sets.length + 1 : null;
    const baselineGameOffset = f.baseline ? (f.baseline.gamesA || 0) + (f.baseline.gamesB || 0) : 0;
    const baselineIsMidGame = !!f.baseline && (f.baseline.inTiebreak
      ? ((f.baseline.tbA || 0) > 0 || (f.baseline.tbB || 0) > 0)
      : ((f.baseline.pointsA || 0) > 0 || (f.baseline.pointsB || 0) > 0));
    const baselineStartScoreLabel = f.baseline
      ? (f.baseline.inTiebreak ? `${f.baseline.tbA}-${f.baseline.tbB}` : gameScoreLabel(f.baseline.pointsA, f.baseline.pointsB, f.scoringSystem))
      : '';

    const setsGrouped = []; // [{ setNumber, games:[...], adjustmentsBefore:[...] }]
    function ensureSet(n) {
      let s = setsGrouped.find((x) => x.setNumber === n);
      if (!s) { s = { setNumber: n, games: [], items: [] }; setsGrouped.push(s); }
      return s;
    }

    let currentGamePoints = [];
    let gameContextTags = new Set();

    function flushGame(closeInfo) {
      if (!currentGamePoints.length) { currentGamePoints = []; gameContextTags = new Set(); return; }
      const setNum = closeInfo ? closeInfo.setNumber : (state.sets.length + 1);
      const setGroup = ensureSet(setNum);
      const priorGamesInSet = setGroup.games.filter((g) => !g.isAdjustment).length;
      const isFirstGameOfBaselineSet = setNum === baselineSetNumber && priorGamesInSet === 0;
      const isBaselineSet = setNum === baselineSetNumber;
      if (isFirstGameOfBaselineSet && baselineIsMidGame) gameContextTags.add('PARCIAL');
      // V9 (28): el offset del baseline (games ya jugados antes de arrancar el registro)
      // tiene que sumarse en TODOS los games de ese set, no solo en el primero — antes,
      // al pasar al segundo game registrado del set, `isFirstGameOfBaselineSet` ya daba
      // false y la numeración volvía a arrancar desde 1 (bug: "Game 2 · 5-3" en vez de
      // "Game 8 · 5-3" cuando el registro arrancó en 4-3).
      const gameNumber = priorGamesInSet + 1 + (isBaselineSet ? baselineGameOffset : 0);
      const tags = Array.from(gameContextTags);
      const scoreLabel = closeInfo && closeInfo.setResult
        ? `${closeInfo.setResult.gamesA}–${closeInfo.setResult.gamesB}${closeInfo.setResult.tiebreak ? ` (TB ${closeInfo.setResult.tiebreak.a}–${closeInfo.setResult.tiebreak.b})` : ''}`
        : (closeInfo ? closeInfo.runningScoreLabel : '');
      const partialNote = (isFirstGameOfBaselineSet && baselineIsMidGame) ? ` · Registro desde ${baselineStartScoreLabel}` : '';
      const game = {
        label: `Game ${gameNumber} · ${scoreLabel}${partialNote}`,
        points: currentGamePoints, tags,
      };
      setGroup.games.push(game);
      setGroup.items.push({ type: 'game', ref: game });
      currentGamePoints = [];
      gameContextTags = new Set();
    }

    f.events.forEach((ev) => {
      if (ev.type === 'adjustment') {
        flushGame(null);
        const beforeAdj = state;
        state = E.applyAdjustment(ev.newState);
        const setGroup = ensureSet(state.sets.length + 1);
        setGroup.items.push({ type: 'adjustment', label: etbAdjustmentLabel(ev, beforeAdj, '✎ Ajuste de marcador') });
        return;
      }
      const before = state;
      const modeForThisPoint = ev.tbMode || f.tiebreakMode || 'classic';
      const scoreBeforeLabel = before.inTiebreak ? `${before.tbA}-${before.tbB} (TB)` : gameScoreLabel(before.pointsA, before.pointsB, f.scoringSystem);
      const importance = E.detectPointImportance(before, f.scoringSystem, format, modeForThisPoint, null);
      const disp = before.inTiebreak ? null : E.formatPointsDisplay(before.pointsA, before.pointsB, f.scoringSystem);
      if (disp && disp.isGoldenPoint) gameContextTags.add('ORO');
      if (disp && disp.isStarPoint) gameContextTags.add('STAR');
      if (before.inTiebreak) gameContextTags.add('TB');
      if (importance.set) gameContextTags.add('SET POINT');
      if (importance.match) gameContextTags.add('MATCH POINT');

      state = E.applyPoint(state, ev.team, f.scoringSystem, format, modeForThisPoint);
      const scoreAfterLabel = state.inTiebreak ? `${state.tbA}-${state.tbB} (TB)` : gameScoreLabel(state.pointsA, state.pointsB, f.scoringSystem);
      const nameTeam = ev.team === 'A' ? S.teamLabel(f.players, 'A') : S.teamLabel(f.players, 'B');
      currentGamePoints.push({
        team: ev.team, teamName: nameTeam, matchTimeMs: ev.matchTimeMs, real: ev.timestamp,
        before: scoreBeforeLabel, after: scoreAfterLabel,
      });

      if (state.gameIndex > before.gameIndex) {
        // X5: si este punto cerró un SET, el score real queda en `state.sets[...]` — el motor
        // ya reseteó gamesA/gamesB a 0 para el próximo set, así que NUNCA se lee desde ahí.
        const closedSet = state.sets.length > before.sets.length;
        const evo = evoGames[evoIdx]; evoIdx += 1;
        if (evo && evo.isBreak) gameContextTags.add('BREAK');
        const closeInfo = closedSet
          ? { setNumber: state.sets.length, setResult: state.sets[state.sets.length - 1] }
          : { setNumber: state.sets.length + 1, runningScoreLabel: `${state.gamesA}-${state.gamesB}` };
        flushGame(closeInfo);
      }
    });
    flushGame(null);

    if (!setsGrouped.length) { wrap.innerHTML += '<p class="coverage-note">Sin puntos registrados.</p>'; return; }

    setsGrouped.forEach((setGroup) => {
      const setDur = f.stats.setDurations.find((d) => d.setNumber === setGroup.setNumber);
      const finishedSet = f.sets[setGroup.setNumber - 1];
      const setDiv = document.createElement('div');
      setDiv.className = 'timeline-set';
      const setHeader = document.createElement('div');
      setHeader.className = 'timeline-set__header';
      const setScoreLabel = finishedSet ? `${finishedSet.gamesA}–${finishedSet.gamesB}${finishedSet.tiebreak ? ` · TB ${finishedSet.tiebreak.a}–${finishedSet.tiebreak.b}` : ''}` : 'en curso';
      setHeader.innerHTML = `<span>SET ${setGroup.setNumber} · ${setScoreLabel}${setDur ? ` · ${formatDuration(setDur.ms)}` : ''}</span><span class="timeline-set__toggle">▾</span>`;
      setHeader.addEventListener('click', () => setDiv.classList.toggle('is-expanded'));
      const setBody = document.createElement('div');
      setBody.className = 'timeline-set__body';

      setGroup.items.forEach((item) => {
        if (item.type === 'adjustment') {
          const marker = document.createElement('div');
          marker.className = 'timeline-adjustment-marker';
          marker.textContent = item.label;
          setBody.appendChild(marker);
          return;
        }
        const g = item.ref;
        const div = document.createElement('div');
        div.className = 'timeline-game';
        const header = document.createElement('div');
        header.className = 'timeline-game__header';
        const tagsHTML = g.tags.map((t) => `<span class="timeline-tag timeline-tag--${t.replace(/\s+/g, '-')}">${t}</span>`).join('');
        header.innerHTML = `<span class="timeline-game__label">${g.label}</span><span class="timeline-game__tags">${tagsHTML}</span><span class="timeline-game__count">${g.points.length} pts ▾</span>`;
        header.addEventListener('click', () => div.classList.toggle('is-expanded'));
        const body = document.createElement('div');
        body.className = 'timeline-game__points';
        g.points.forEach((p) => {
          const row = document.createElement('div');
          row.className = 'timeline-point-row';
          row.innerHTML = `<span class="timeline-point-row__time">${formatClock(p.matchTimeMs)} · ${formatRealTime(p.real, f.timeZone)}</span>
            <span class="timeline-point-row__team" data-team="${p.team}">${p.teamName}</span>
            <span class="timeline-point-row__score">${p.before} → ${p.after}</span>`;
          body.appendChild(row);
        });
        div.appendChild(header); div.appendChild(body);
        setBody.appendChild(div);
      });

      setDiv.appendChild(setHeader); setDiv.appendChild(setBody);
      wrap.appendChild(setDiv);
    });
  }

  /** V13.3 (§13) — Timeline PROPIO para Por Games: antes reutilizaba `renderFullTimeline`
   *  (motor de puntos), que mostraba una progresión de puntos 0-15-30-40 FICTICIA — esos
   *  puntos nunca se registraron en este modo. Acá cada fila es un GAME real: número,
   *  marcador después de ese game, quién lo ganó, sacador y HOLD/BREAK si se conocen (nunca
   *  inventados), y los Highlights ubicados cronológicamente. Tramos de una corrección
   *  manual se marcan PARCIAL, nunca se rellenan con games inventados. */
  function renderGamesFullTimeline(f) {
    const wrap = $('#timeline-full-list');
    wrap.innerHTML = '';
    const evoGames = (f.evolution && f.evolution.games) || [];
    if (!evoGames.length) { wrap.innerHTML = '<p class="coverage-note">Sin games registrados.</p>'; return; }

    const setsGrouped = [];
    function ensureSet(n) {
      let s = setsGrouped.find((x) => x.setNumber === n);
      if (!s) { s = { setNumber: n, rows: [] }; setsGrouped.push(s); }
      return s;
    }
    evoGames.forEach((g) => { ensureSet(g.setNumber).rows.push({ type: g.adjustment ? 'adjustment' : 'game', matchTimeMs: g.matchTimeMs, g }); });
    // Highlights intercalados en su set, ordenados junto a los games por hora real — nunca
    // se les inventa un score de puntos (§9 del V13), solo se ubican en el momento correcto.
    (f.highlights || []).forEach((h) => {
      const categoryLabel = h.category ? HIGHLIGHT_CATEGORY_LABELS[h.category] : null;
      ensureSet(h.set).rows.push({ type: 'highlight', matchTimeMs: h.matchTimeMs, h, categoryLabel });
    });
    setsGrouped.forEach((sg) => sg.rows.sort((a, b) => a.matchTimeMs - b.matchTimeMs));

    if (!setsGrouped.length) { wrap.innerHTML = '<p class="coverage-note">Sin games registrados.</p>'; return; }

    setsGrouped.forEach((setGroup) => {
      const finishedSet = f.sets[setGroup.setNumber - 1];
      const setDiv = document.createElement('div');
      setDiv.className = 'timeline-set is-expanded'; // sin sub-nivel para expandir: cada game ya es la unidad mínima
      const setHeader = document.createElement('div');
      setHeader.className = 'timeline-set__header';
      const setScoreLabel = finishedSet ? formatSetSegmentLabel(finishedSet) : 'en curso';
      setHeader.innerHTML = `<span>SET ${setGroup.setNumber} · ${setScoreLabel}</span><span class="timeline-set__toggle">▾</span>`;
      setHeader.addEventListener('click', () => setDiv.classList.toggle('is-expanded'));
      const setBody = document.createElement('div');
      setBody.className = 'timeline-set__body';

      setGroup.rows.forEach((row) => {
        if (row.type === 'adjustment') {
          const marker = document.createElement('div');
          marker.className = 'timeline-adjustment-marker';
          marker.textContent = `✎ Ajuste de marcador · ${row.g.gamesA}-${row.g.gamesB}`;
          setBody.appendChild(marker);
          return;
        }
        if (row.type === 'highlight') {
          const h = row.h;
          const marker = document.createElement('div');
          marker.className = 'timeline-point-row';
          marker.innerHTML = `<span class="timeline-point-row__time">${formatClock(h.matchTimeMs)} · ${formatRealTime(h.timestamp, f.timeZone)}</span><span class="timeline-point-row__score">⭐ Highlight${row.categoryLabel ? ' · ' + row.categoryLabel : ''}</span>`;
          setBody.appendChild(marker);
          return;
        }
        const g = row.g;
        const div = document.createElement('div');
        div.className = 'timeline-game timeline-game--compact';
        const winnerName = g.winner ? S.teamLabel(f.players, g.winner) : null;
        const serverName = g.server ? playerName(f.players, g.server.id) : null;
        const tagsHTML = [];
        if (g.holdOrBreak === 'hold') tagsHTML.push('<span class="timeline-tag timeline-tag--HOLD">HOLD</span>');
        if (g.holdOrBreak === 'break') tagsHTML.push('<span class="timeline-tag timeline-tag--BREAK">BREAK</span>');
        if (g.partial) tagsHTML.push('<span class="timeline-tag timeline-tag--PARCIAL">PARCIAL</span>');
        const detailParts = [];
        if (winnerName) detailParts.push(`Ganó ${winnerName}`);
        if (serverName) detailParts.push(`Saque: ${serverName}`);
        const header = document.createElement('div');
        header.className = 'timeline-game__header';
        header.innerHTML = `<span class="timeline-game__label">Game ${g.index} · ${g.gamesA}-${g.gamesB}</span><span class="timeline-game__tags">${tagsHTML.join('')}</span>`;
        const detail = document.createElement('div');
        detail.className = 'timeline-point-row';
        detail.innerHTML = `<span class="timeline-point-row__time">${formatClock(g.matchTimeMs)} · ${formatRealTime(g.timestamp, f.timeZone)}</span><span class="timeline-point-row__score">${detailParts.join(' · ')}</span>`;
        div.appendChild(header); div.appendChild(detail);
        setBody.appendChild(div);
      });

      setDiv.appendChild(setHeader); setDiv.appendChild(setBody);
      wrap.appendChild(setDiv);
    });
  }

  function initTimelineScreen() { $('#timeline-back-btn').addEventListener('click', () => showView('analysis')); }

  function initAnalysisScreen() {
    // Etapa 4.2 (§10) — autoguardado al salir del campo, sobre el partido actualmente
    // mostrado en Análisis (analysisCurrent). Nunca crea un registro nuevo: si por algún
    // motivo ese partido ya no existe en el historial, Store.patchHistoryEntry no hace nada.
    $('#analysis-note-textarea').addEventListener('blur', () => {
      if (!analysisCurrent || analysisCurrent.mode !== 'manual') return;
      const value = $('#analysis-note-textarea').value.trim() || null;
      Store.patchHistoryEntry(analysisCurrent.matchId, { privateNote: value });
      analysisCurrent.privateNote = value; // refleja el cambio si se vuelve a abrir esta misma sesión
      // V02.3 (Bloque C, §7) — vuelve al estado de LECTURA dentro de la MISMA tarjeta
      // permanente (nunca oculta la tarjeta ni la reemplaza por un link aparte).
      renderAnalysisNoteDisplay(value || '');
      $('#analysis-note-textarea').hidden = true;
      $('#analysis-note-display').hidden = false;
    });
    // V02.3 (Bloque C, §7) — "la tarjeta completa es tocable": tocar el estado de lectura
    // revela el textarea real para editar (con o sin nota existente).
    $('#analysis-note-display').addEventListener('click', () => {
      $('#analysis-note-display').hidden = true;
      $('#analysis-note-textarea').hidden = false;
      $('#analysis-note-textarea').focus();
    });
    // V02.1 (§13/§15) — ya no existe una "Análisis" separada a la que volver: el Resumen es
    // la pantalla canónica única, así que "←" siempre sale hacia la procedencia real (nunca
    // hacia el marcador — un partido recién terminado no tiene a dónde volver ahí).
    $('#analysis-back-btn').addEventListener('click', () => {
      if (analysisOpenedFrom === 'history') { renderHistory(); showView('history'); }
      // Etapa 2 (Rama Jugador) — "Ver detalle" desde la tarjeta Último Partido del Home, o
      // un partido cargado manualmente recién guardado.
      else if (analysisOpenedFrom === 'player-home') { renderPlayerHome(); showView('player-home'); }
      else openPlayerHome(); // 'live' o cualquier otro caso: siempre es seguro ir al Home
    });
    // V02.1 (§13/§15) — Deshacer/Reanudar, relocalizados acá desde el viejo Resumen inmediato
    // (#view-summary, retirado): mismas acciones de siempre, mismas condiciones de visibilidad
    // (ver renderAnalysis).
    $('#analysis-undo-btn').addEventListener('click', () => { if (isGamesMode()) undoLastGame(); else undoLastPoint(); });
    $('#analysis-resume-btn').addEventListener('click', resumeMatch);
  }

  /* ------------------------------------------------------------------ */
  /* HISTORIAL — Etapa 4.1 (§3): pestañas de pertenencia (Todos/Mis partidos/
   * Observados) + chips de modo (Todos los modos/Cargados/Game por game/Punto
   * por punto), intersección de ambos. La clasificación y el filtrado en sí
   * son PH.filterHistoryByOwnership/filterHistoryByMode/filterHistoryCombined
   * (player-home.js, puras y testeadas) — acá solo se orquesta DOM/estado.  */
  /* ------------------------------------------------------------------ */
  const HISTORY_SCORING_LABELS = { golden: 'PUNTO DE ORO', starpoint: 'STAR POINT', classic: 'CON VENTAJA' };

  // Estado de los filtros — vive en memoria durante la sesión (§3.3: "conservar el filtro" al
  // editar/eliminar ya sale gratis de no resetear esto en cada render), nunca en localStorage:
  // no hay pedido de persistirlo entre reaperturas de la app.
  let historyOwnershipFilter = 'all'; // 'all' | 'mine' | 'observed'
  let historyModeFilter = 'all'; // 'all' | 'manual' | 'games' | 'complete'

  const HISTORY_TABS = [
    { key: 'all', label: 'Todos' },
    { key: 'mine', label: 'Mis partidos' },
    { key: 'observed', label: 'Observados' },
  ];
  const HISTORY_MODE_CHIPS = [
    { key: 'all', label: 'Todos los modos' },
    { key: 'manual', label: 'Cargados' },
    { key: 'games', label: 'Game por game' },
    { key: 'complete', label: 'Punto por punto' },
  ];
  // Mismas etiquetas que arriba, en minúscula, para componer el texto del estado vacío
  // ("No hay partidos en observados · game por game todavía") sin repetir el mapeo.
  const HISTORY_TAB_LABELS_LOWER = { mine: 'mis partidos', observed: 'observados' };
  const HISTORY_MODE_LABELS_LOWER = { manual: 'cargados', games: 'game por game', complete: 'punto por punto' };

  /** §3.1/§3.2 — pinta ambas filas de filtro con los conteos reales (los conteos de
   *  pertenencia SIEMPRE sobre el historial completo, sin aplicar el filtro de modo — cada
   *  fila informa su propia dimensión, no una intersección en vivo que confundiría cuando
   *  ambos filtros combinados dan 0 sin que ninguno de los dos, por separado, esté vacío). */
  function renderHistoryFilters(fullHistory) {
    const counts = PH.computeHistoryTabCounts(fullHistory, currentIdentity());
    const tabsWrap = $('#history-tabs');
    tabsWrap.innerHTML = HISTORY_TABS.map((t) => {
      const active = historyOwnershipFilter === t.key;
      return `<button type="button" class="history-tab${active ? ' is-active' : ''}" data-key="${t.key}" role="tab" aria-selected="${active}">${t.label} <span class="history-tab__count">${counts[t.key]}</span></button>`;
    }).join('');
    $all('#history-tabs .history-tab').forEach((btn) => {
      // V02.1 (§27) — tocar cualquiera de las 3 pestañas normales sale del filtro contextual
      // (mismo destino que "Quitar filtro" en la banda, ver más abajo).
      btn.addEventListener('click', () => { historyOwnershipFilter = btn.dataset.key; historyContextFilter = null; renderHistory(); });
    });

    // V02.1 (§25) — la fila de chips de modo se retira de la vista principal (competía con la
    // navegación por pestañas). La lógica de filtrado por modo se conserva intacta por si
    // sirve a futuro (PH.filterHistoryByMode/filterHistoryCombined), simplemente no se pinta
    // ni se ofrece ningún control para cambiarla — historyModeFilter queda fijo en 'all'.
    $('#history-mode-chips').hidden = true;

    // V02.1 (§27) — banda de filtro contextual, cuando Historial se abre desde una métrica del
    // Home (Racha actual/Efectividad). Vive por encima de las pestañas, siempre removible.
    const ctxWrap = $('#history-context-filter');
    if (historyContextFilter) {
      ctxWrap.hidden = false;
      $('#history-context-filter-label').textContent = `Filtrando: ${historyContextFilter.label}`;
    } else {
      ctxWrap.hidden = true;
    }
  }

  /** §3.3 — una lista vacía siempre explica el filtro activo y ofrece una salida: "Ver
   *  todos" si hay partidos en otro filtro, o "Registrar partido" si el historial entero
   *  está vacío (mismo destino que el "+" central — abre la hoja Registrar partido). */
  function renderHistoryEmptyState(totalCount) {
    const textEl = $('#history-empty-text');
    const actionEl = $('#history-empty-action');
    if (totalCount === 0) {
      textEl.textContent = 'Todavía no jugaste ningún partido.';
      actionEl.textContent = 'REGISTRAR PARTIDO';
      actionEl.onclick = () => openRegisterSheet();
      return;
    }
    const parts = [];
    if (historyOwnershipFilter !== 'all') parts.push(HISTORY_TAB_LABELS_LOWER[historyOwnershipFilter]);
    if (historyModeFilter !== 'all') parts.push(HISTORY_MODE_LABELS_LOWER[historyModeFilter]);
    textEl.textContent = parts.length
      ? `No hay partidos en ${parts.join(' · ')} todavía.`
      : 'No hay partidos para mostrar.';
    actionEl.textContent = 'VER TODOS';
    actionEl.onclick = () => { historyOwnershipFilter = 'all'; historyModeFilter = 'all'; renderHistory(); };
  }

  function renderHistory() {
    const fullHistory = Store.loadHistory();
    renderHistoryFilters(fullHistory);
    // Etapa 3 (Fase 1) — el Historial global también ordena por fecha REAL jugada, no por
    // orden de guardado. Etapa 4.1 (§3.3) — se ordena DESPUÉS de filtrar (mismo comparador),
    // así que el orden se conserva sin importar qué combinación de pestaña/modo esté activa.
    let list = PH.filterHistoryCombined(fullHistory, currentIdentity(), historyOwnershipFilter, historyModeFilter);
    // V02.1 (§27) — filtro contextual (Racha actual/Efectividad), aplicado DESPUÉS de las
    // pestañas normales, sobre el mismo conjunto ya ordenado — nunca un criterio recalculado
    // aparte que pudiera divergir del que ya muestran Home/Efectividad. V02.7 (§4): Efectividad
    // dejó de tener ventana de tiempo, así que este filtro ya no recorta por fecha tampoco.
    if (historyContextFilter && historyContextFilter.type === 'streak') {
      const ids = historyContextFilter.matchIds;
      list = list.filter((m) => ids.has(m.matchId));
    } else if (historyContextFilter && historyContextFilter.type === 'effectiveness') {
      const allowed = new Set(PH.filterMatchesWithDefinedResult(PH.filterMatchesForPlayer(fullHistory, currentIdentity()), currentIdentity()).map((m) => m.matchId));
      list = list.filter((m) => allowed.has(m.matchId));
    }
    const wrap = $('#history-list');
    wrap.innerHTML = '';
    const isEmpty = list.length === 0;
    $('#history-empty').hidden = !isEmpty;
    // V02.2 (Bloque G, §18) — transición corta/fluida al cambiar de pestaña (~200ms,
    // slide+fade), tanto para la lista como para el estado vacío.
    triggerHistoryContentAnim();
    if (isEmpty) { renderHistoryEmptyState(fullHistory.length); return; }
    list.forEach((m) => {
      const nameA = S.teamLabel(m.players, 'A'), nameB = S.teamLabel(m.players, 'B');
      // V8.2 (32): BUG de auditoría — antes usaba `sets.map(...).join(' · ') || currentPartial`,
      // así que en cuanto había AL MENOS un set terminado, el `||` nunca llegaba a mirar
      // `currentPartial` y el último set incompleto (partido finalizado manualmente a mitad
      // de un set) desaparecía del Historial. Ahora ambos se concatenan cuando corresponde:
      // sets terminados primero, y el set parcial al final marcado con "*".
      // V02.2 (Bloque D, §12) — mismo componente canónico que Confirmar partido/Último partido.
      const scoreStr = buildCanonicalScoreLineHTML(m.sets, m.currentPartial);
      // V02.9 (§4) — formato/sistema dejan de ir en una línea de subtítulo arriba (junto con el
      // modo de carga): se reubican como metadata inferior derecha, mismo criterio que Último
      // Partido (ver renderPlayerLastMatchCard) — Historial es su versión compacta, mismo
      // lenguaje visual.
      const formatLabel = (E.FORMATS[m.formatId] && E.FORMATS[m.formatId].label || '').toUpperCase();
      const scoringLabel = HISTORY_SCORING_LABELS[m.scoringSystem] || '';
      const item = document.createElement('div');
      item.className = 'history-item';
      // V02.1 (§26) — badge de resultado desde la perspectiva del jugador actual en partidos
      // propios; GANÓ junto al nombre de la pareja ganadora en Observados (nunca
      // VICTORIA/DERROTA ahí — el jugador actual no participa, no le corresponde).
      // V02.9 (§4) — vuelve a la palabra completa (era VIC/DER desde V02.1/§26): mismo criterio
      // que Último Partido en esta misma ronda (§3) — "evitar abreviaturas si el espacio
      // permite la palabra completa".
      // V02.9.1 (§3, feedback real) — la línea de jugadores coloreaba al equipo GANADOR
      // (`m.winnerTeam`) en TODOS los casos, incluidos los partidos propios — ahí ya quedaba
      // redundante con el badge VICTORIA/DERROTA de arriba (dos señales para el mismo dato) y
      // era parte de por qué la línea se sentía demasiado protagonista. Un primer paso pasó a
      // colorear la pareja PROPIA en vez de la ganadora.
      // V02.9.3 (feedback real) — paso final: SIN ningún color de énfasis en los nombres, ni al
      // ganador ni a la pareja propia — VICTORIA/DERROTA (o "GANÓ" en Observados, que sigue
      // existiendo como texto) ya comunica el resultado, una segunda señal de color era
      // redundante. Todos los participantes quedan con el mismo tratamiento neutro (ver
      // styles.css:.history-item__teams).
      const ownership = PH.classifyMatchOwnership(m, currentIdentity());
      let resultBadgeHTML = '';
      let wonTagA = '', wonTagB = '';
      if (ownership === 'mine') {
        const resultKind = PH.matchResultForPlayer(m, currentIdentity());
        if (resultKind === 'win') resultBadgeHTML = '<span class="history-item__result-badge history-item__result-badge--win">VICTORIA</span>';
        else if (resultKind === 'loss') resultBadgeHTML = '<span class="history-item__result-badge history-item__result-badge--loss">DERROTA</span>';
      } else if (m.winnerTeam === 'A') {
        wonTagA = '<span class="history-item__won-tag">GANÓ</span>';
      } else if (m.winnerTeam === 'B') {
        wonTagB = '<span class="history-item__won-tag">GANÓ</span>';
      }
      // Etapa 3 (Fase 1) — fecha REAL jugada, no cuándo se guardó (PH.getPlayedAt: playedAt
      // → startedAt → finishedAt). Nunca leer m.finishedAt directo para esto.
      const playedAt = PH.getPlayedAt(m);
      // V02.9 (§4) — tarjeta compacta de Último Partido: arriba fecha+resultado, resultado
      // (score) protagonista, abajo participantes (izquierda) + formato/sistema (derecha).
      // Sin "PARTIDO CARGADO"/"POR GAMES" (origen técnico del partido, sin jerarquía acá) ni X
      // de borrado directo (la eliminación vive ahora en Resumen, §5) — toda la tarjeta es un
      // único blanco de toque, como en Último Partido.
      item.innerHTML = `
        <div class="history-item__top-row">
          <div class="history-item__date">${formatRealDate(playedAt, m.timeZone)} · ${formatRealTime(playedAt, m.timeZone).slice(0, 5)}</div>
          ${resultBadgeHTML}
        </div>
        <div class="history-item__score">${scoreStr}</div>
        <div class="history-item__bottom-row">
          <div class="history-item__teams">${nameA}${wonTagA}<span class="vs-sep">vs</span>${nameB}${wonTagB}</div>
          ${(formatLabel || scoringLabel) ? `<div class="history-item__meta">
            ${formatLabel ? `<div class="history-item__meta-line">${formatLabel}</div>` : ''}
            ${scoringLabel ? `<div class="history-item__meta-line">${scoringLabel}</div>` : ''}
          </div>` : ''}
        </div>
        ${m.terminationType === 'manual' ? `<span class="history-item__badge">${m.terminationReasonLabel}</span>` : ''}
      `;
      item.addEventListener('click', () => openCanonicalResumen(m, 'history'));
      wrap.appendChild(item);
    });
  }

  /** V02.2 (Bloque G, §18) — retriggerea la animación de entrada (`requestAnimationFrame` +
   *  quitar/agregar la clase, para forzar un reflow real — si solo se agregara la clase de
   *  nuevo sin quitarla primero, un segundo cambio de pestaña seguido no volvería a animar). */
  function triggerHistoryContentAnim() {
    [$('#history-list'), $('#history-empty')].forEach((el) => {
      el.classList.remove('history-anim');
      void el.offsetWidth;
      el.classList.add('history-anim');
    });
  }

  /** V02.2 (Bloque G, §18) — swipe horizontal entre las tres pestañas (Todos/Mis partidos/
   *  Observados), sin interferir con el scroll vertical de la lista: se decide UNA sola vez
   *  por gesto (el primer desplazamiento claro) si es horizontal o vertical, y solo se actúa
   *  sobre los horizontales. Listeners pasivos (nunca preventDefault) — el scroll vertical
   *  nativo sigue funcionando igual que siempre. */
  function initHistorySwipe() {
    const scrollEl = document.querySelector('#view-history .analysis-scroll');
    if (!scrollEl) return;
    let startX = 0, startY = 0, tracking = false, axis = null; // axis: null | 'h' | 'v'
    scrollEl.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
      tracking = true; axis = null;
    }, { passive: true });
    scrollEl.addEventListener('touchmove', (e) => {
      if (!tracking || axis) return;
      const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
    }, { passive: true });
    scrollEl.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      if (axis !== 'h') return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 60) return;
      const idx = HISTORY_TABS.findIndex((t) => t.key === historyOwnershipFilter);
      const nextIdx = idx + (dx < 0 ? 1 : -1); // swipe a la izquierda -> pestaña siguiente
      if (nextIdx < 0 || nextIdx >= HISTORY_TABS.length) return;
      historyOwnershipFilter = HISTORY_TABS[nextIdx].key;
      historyContextFilter = null;
      renderHistory();
    }, { passive: true });
  }

  function initHistoryScreen() {
    $('#history-back-btn').addEventListener('click', () => {
      if (historyOpenedFrom === 'setup') showView('setup');
      else openPlayerHome();
    });
    // V02.1 (§27) — "Quitar filtro": vuelve a las pestañas normales sin perder navegación
    // (se queda en Historial, solo se retira el recorte contextual).
    $('#history-context-filter-clear').addEventListener('click', () => { historyContextFilter = null; renderHistory(); });
    initHistorySwipe();
  }

  /* ------------------------------------------------------------------ */
  /* RAMA JUGADOR — HOME DEL JUGADOR (Etapa 2)                            */
  /* Orquestación de DOM/navegación únicamente — el filtrado del historial, forma
   *  reciente, rachas, compañero/rival frecuente y el texto de "Tu momento" viven en
   *  player-home.js (PH), funciones puras sin DOM, mismo criterio de reparto que
   *  engine.js/stats.js (E/S) para el resto de la app. */
  /* ------------------------------------------------------------------ */
  let currentPlayerName = null;
  // V03.0 (§1) — id del Usuario con sesión activa, sincronizado junto a `currentPlayerName`
  // por `syncCurrentIdentityFromStore()`. Los call sites que resuelven "es mi partido" (Home,
  // Historial, Nivel BRAMU, Hitos, Efectividad, Racha, compañero/rival) pasan
  // `currentIdentity()` en vez del string suelto — ver regla de exclusividad de `userId` en
  // player-home.js (un userId ya estampado en un partido nunca cae a fallback por nombre).
  let currentUserId = null;
  // V02.8 (§1) — REEMPLAZA el criterio de V02.7: las microanimaciones de entrada (barra de
  // Nivel, Actividad, Efectividad) ahora se reproducen CADA VEZ que se entra o se vuelve al
  // Home, no solo la primera vez de la sesión (el flag booleano `homeEnteredThisSession` que
  // limitaba esto a una sola vez se retira). `renderPlayerHome()` solo se invoca en los
  // call-sites que efectivamente muestran la vista (`openPlayerHome()`, el tab "Inicio" de la
  // barra inferior, el volver desde Resumen) — nunca como refresco de fondo estando ya parado
  // en el Home — así que "cada render = una entrada real" ya es cierto sin necesitar ningún
  // flag para distinguir casos.
  // Auditoría funcional (§5) / V03.0 (§1) — "Cambiar jugador" no existe más — el flujo de
  // Acceso solo se abre para la PRIMERA identificación (nunca hay más de un call-site vivo con
  // un jugador ya identificado detrás). `afterIdentifyAction` deja que quien lo abre decida a
  // dónde seguir después de loguearse (por default, al Home) — lo usa, por ejemplo, "Cargar
  // partido jugado" para retomar la carga apenas el jugador se identifica (§3).
  let afterIdentifyAction = null;

  /** Relee `currentPlayerName`/`currentUserId` desde Store — único punto de sincronización
   *  entre la sesión persistida y las variables de módulo que el resto de este archivo
   *  consulta. Se llama en los mismos puntos que antes releían solo `currentPlayerName`
   *  (`openPlayerHome`, `openManualLoadScreen`, `renderPlayerHome`) más al completar login/
   *  signup. */
  function syncCurrentIdentityFromStore() {
    currentPlayerName = Store.loadCurrentPlayerName();
    const user = Store.getCurrentUser();
    currentUserId = user ? user.id : null;
  }

  /** `{name, userId}` — identidad de sesión lista para pasar a `PH.*` en vez del string suelto
   *  (ver regla de exclusividad de `userId` en player-home.js). */
  function currentIdentity() { return { name: currentPlayerName, userId: currentUserId }; }

  // Etapa 4.1 (§4): el Nivel BRAMU dejó de ser un valor fijo — ahora se DERIVA de
  // PH.computeLevelEvolution (player-home.js), la ÚNICA fuente de verdad que consumen por
  // igual la Tarjeta de jugador (Home) y la tarjeta "Evolución del Nivel BRAMU" (Perfil).
  // Sigue siendo una regla SIMULADA (§4.3 del consolidado), nunca el algoritmo oficial.

  /** `{ label, direction }` para pintar una variación con flecha semántica — mismo criterio
   *  en cualquier lugar que muestre un delta de nivel (Tarjeta de jugador, Perfil). */
  function formatLevelDelta(delta) {
    if (!delta) return { label: '—', direction: 'flat' };
    const sign = delta > 0 ? '↑' : '↓';
    return { label: `${sign} ${Math.abs(delta).toFixed(1)}`, direction: delta > 0 ? 'up' : 'down' };
  }

  // V02.4 (Bloque A, §3.2) — el cálculo de progreso de la barra (decimal DENTRO del nivel
  // entero actual, nunca la posición global en [LEVEL_MIN, LEVEL_MAX]) se movió a
  // PH.levelProgressPct (player-home.js): función pura, testeable en tests.html sin DOM.

  function openPlayerHome() {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderPlayerHome();
    showView('player-home');
  }

  /* ------------------------------------------------------------------ */
  /* V03.0 — ACCESO / CREAR CUENTA / INICIAR SESIÓN / PLAYER CARD          */
  /* Reemplaza al modal "¿Quién sos?". Mismos 3 puntos de entrada de antes */
  /* (openManualLoadScreen, openPlayerHome, renderPlayerHome) abren        */
  /* #view-access en vez del modal viejo — `afterIdentifyAction` se sigue  */
  /* usando igual para retomar el flujo original tras loguearse.           */
  /* ------------------------------------------------------------------ */

  function openAccessFlow(afterAction) {
    afterIdentifyAction = afterAction || null;
    showView('access');
  }

  function completeIdentifyAction() {
    const action = afterIdentifyAction;
    afterIdentifyAction = null;
    if (action) action(); else { renderPlayerHome(); showView('player-home'); }
  }

  function initAccessScreen() {
    $('#access-login-btn').addEventListener('click', () => {
      $('#login-email').value = '';
      $('#login-password').value = '';
      $('#login-error').hidden = true;
      showView('login');
    });
    $('#access-signup-btn').addEventListener('click', openSignupWizard);
    // V03.0.1 (§7, corrección del usuario) — reemplaza al viejo "Cancelar": entra directo al
    // registro en vivo SIN cuenta (mismo destino, 'setup', que ya usaba "Cancelar" — Setup no
    // lee `currentPlayerName` en ningún punto, arma nombres desde los campos de texto propios,
    // así que ya soportaba este caso). No queda vinculado a ningún userId
    // (identityStampedPlayers, más abajo, ya lo maneja) y no se persiste en Historial
    // compartido (ver finishMatch/finishMatchGames) para no arriesgar que se reclame por
    // coincidencia de nombre (consolidado §7).
    $('#access-guest-btn').addEventListener('click', () => {
      afterIdentifyAction = null;
      showView('setup');
    });
  }

  function initLoginScreen() {
    $('#login-back-btn').addEventListener('click', () => showView('access'));
    wirePasswordToggle('login-password', 'login-password-toggle');
    $('#login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const result = Store.loginWithEmail($('#login-email').value, $('#login-password').value);
      if (!result.ok) { $('#login-error').hidden = false; return; }
      $('#login-error').hidden = true;
      syncCurrentIdentityFromStore();
      completeIdentifyAction();
    });
    // V03.0.3.1 (§1) — "¿Olvidaste tu contraseña?": acción secundaria hacia el wizard de
    // recuperación (#view-forgot-password), sin afectar la sesión ni el intento de login.
    $('#login-forgot-btn').addEventListener('click', openForgotPasswordFlow);
  }

  /** V03.0.1 (§4/§5/§8) — ojo mostrar/ocultar contraseña, reusado en Login/Completar
   *  Acceso/Cambiar contraseña. Alterna type password↔text, nunca guarda el valor en otro
   *  lado ni cambia la validación.
   *  V03.0.2 (§9/§13) — reemplaza el ícono circular (◎, sin significado reconocible) por un
   *  ojo/ojo-tachado real: dos `<g>` dentro del mismo SVG, se alterna cuál queda `hidden`. */
  function wirePasswordToggle(inputId, btnId) {
    const input = $(`#${inputId}`);
    const btn = $(`#${btnId}`);
    if (!input || !btn) return;
    const eyeOpen = btn.querySelector('.eye-icon__open');
    const eyeOff = btn.querySelector('.eye-icon__off');
    btn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.classList.toggle('is-active', !showing);
      if (eyeOpen && eyeOff) { eyeOpen.hidden = !showing; eyeOff.hidden = showing; }
      btn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
  }

  /** V03.0.3.1 (§2/§3) — recuperación simulada de contraseña: 3 pasos en UNA sola vista
   *  (#view-forgot-password), mismo patrón que el wizard de signup (un `forgotPasswordStep`
   *  de módulo, sin pasar por showView entre pasos). El código fijo `123456` y la ausencia de
   *  envío real de email son la "simulación" — vive solo acá adentro, nunca en un texto de UI
   *  (consolidado §2 IMPORTANTE). Al guardar, `Store.updateUserAccount(user.id, {password})`
   *  es la ÚNICA escritura: mismo userId/email/username/displayName/foto/historial/Nivel
   *  BRAMU/notificaciones de siempre, ninguna otra cuenta se toca (regla crítica §3). */
  const FORGOT_PASSWORD_CODE = '123456';
  const FORGOT_PASSWORD_STEP_TITLES = { 1: 'RECUPERAR CONTRASEÑA', 2: 'INGRESÁ EL CÓDIGO', 3: 'NUEVA CONTRASEÑA' };
  let forgotPasswordStep = 1;
  let forgotPasswordUserId = null;
  let forgotPasswordEmail = '';
  // V03.0.3.2 (§2/§3) — mismo wizard, dos puntos de entrada: 'login' (sin sesión, arranca en
  // el email, como siempre) y 'session' (ya logueado, arranca directo en el código, nunca
  // pide email — usa Store.getCurrentUser() como cuenta objetivo). El origen decide el piso
  // del botón "atrás" (nunca vuelve a un paso 1 que para 'session' no existe) y el destino
  // final: 'login' vuelve a Login (regla ya existente); 'session' vuelve a MIS DATOS SIN pedir
  // login de nuevo — la sesión sigue siendo válida porque `userId` nunca cambia.
  let forgotPasswordOrigin = 'login';

  function resetForgotPasswordWizard(startStep) {
    forgotPasswordStep = startStep || 1;
    forgotPasswordUserId = null;
    forgotPasswordEmail = '';
    $('#forgot-password-form').reset();
    $('#forgot-password-email-error').hidden = true;
    $('#forgot-password-code-error').hidden = true;
    $('#forgot-password-new-error').hidden = true;
    updatePasswordRulesUI('', 'forgot-password-rules');
  }

  function renderForgotPasswordStep() {
    $all('#view-forgot-password .forgot-password-step').forEach((el) => { el.hidden = Number(el.dataset.step) !== forgotPasswordStep; });
    $('#forgot-password-step-title').textContent = FORGOT_PASSWORD_STEP_TITLES[forgotPasswordStep];
  }

  function openForgotPasswordFlow() {
    forgotPasswordOrigin = 'login';
    resetForgotPasswordWizard(1);
    renderForgotPasswordStep();
    showView('forgot-password');
  }

  /** V03.0.3.2 (§1/§2) — "¿No recordás tu contraseña?" desde Cambiar Contraseña: mismo wizard
   *  de recuperación, pero arranca en el paso 2 (código) usando la cuenta ya logueada — nunca
   *  pide email (consolidado §2). */
  function openForgotPasswordFromSession() {
    const user = Store.getCurrentUser();
    if (!user) { openForgotPasswordFlow(); return; }
    forgotPasswordOrigin = 'session';
    resetForgotPasswordWizard(2);
    forgotPasswordUserId = user.id;
    forgotPasswordEmail = user.email || '';
    renderForgotPasswordStep();
    showView('forgot-password');
  }

  function initForgotPasswordScreen() {
    $('#forgot-password-back-btn').addEventListener('click', () => {
      const floorStep = forgotPasswordOrigin === 'session' ? 2 : 1;
      if (forgotPasswordStep > floorStep) { forgotPasswordStep -= 1; renderForgotPasswordStep(); }
      else if (forgotPasswordOrigin === 'session') showView('change-password');
      else showView('login');
    });

    $('#forgot-password-email-submit').addEventListener('click', () => {
      const email = $('#forgot-password-email').value.trim();
      const user = Store.getUserByEmail(email);
      if (!user) { $('#forgot-password-email-error').hidden = false; return; }
      $('#forgot-password-email-error').hidden = true;
      forgotPasswordUserId = user.id;
      forgotPasswordEmail = email;
      forgotPasswordStep = 2;
      renderForgotPasswordStep();
    });

    $('#forgot-password-code-submit').addEventListener('click', () => {
      const code = $('#forgot-password-code').value.trim();
      if (code !== FORGOT_PASSWORD_CODE) { $('#forgot-password-code-error').hidden = false; return; }
      $('#forgot-password-code-error').hidden = true;
      forgotPasswordStep = 3;
      renderForgotPasswordStep();
    });

    wirePasswordToggle('forgot-password-new', 'forgot-password-new-toggle');
    wirePasswordToggle('forgot-password-repeat', 'forgot-password-repeat-toggle');
    $('#forgot-password-new').addEventListener('input', (e) => updatePasswordRulesUI(e.target.value, 'forgot-password-rules'));

    $('#forgot-password-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (forgotPasswordStep !== 3) return;
      const user = forgotPasswordUserId ? Store.getUserById(forgotPasswordUserId) : null;
      if (!user) { showView(forgotPasswordOrigin === 'session' ? 'profile' : 'login'); return; }
      const next = $('#forgot-password-new').value;
      const repeat = $('#forgot-password-repeat').value;
      const strength = PLI.checkPasswordStrength(next);
      let error = null;
      if (!strength.ok) error = 'La nueva contraseña todavía no cumple los requisitos.';
      else if (!PLI.passwordsMatch(next, repeat)) error = 'Las contraseñas no coinciden.';
      if (error) { $('#forgot-password-new-error').textContent = error; $('#forgot-password-new-error').hidden = false; return; }
      // Regla crítica (§3) — un único campo cambia: `password`. userId/email/username/
      // displayName/foto/historial/notificaciones quedan intactos porque nunca se tocan.
      Store.updateUserAccount(user.id, { password: next });
      if (forgotPasswordOrigin === 'session') {
        // V03.0.3.2 (§3) — la sesión sigue siendo válida (mismo userId, nunca se toca
        // SESSION/CURRENT_PLAYER): nunca se obliga a loguear de nuevo. Vuelve a MIS DATOS.
        showView('profile');
      } else {
        $('#login-email').value = forgotPasswordEmail;
        $('#login-password').value = '';
        $('#login-error').hidden = true;
        showView('login');
      }
      showToast('Contraseña actualizada');
    });
  }

  /** Toggle genérico de un `role="radiogroup"` de `.option-col`/`.option-pill` (mismo patrón
   *  que ya usa #scoring-options/#format-options en initSetupScreen) — evita repetirlo a mano
   *  en el wizard de signup y en la edición de Perfil, que necesitan el mismo control 2 veces
   *  cada uno (mano hábil, lado habitual). */
  function wireOptionGroup(containerId, onSelect) {
    $all(`#${containerId} .option-col`).forEach((btn) => {
      btn.addEventListener('click', () => {
        $all(`#${containerId} .option-col`).forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('is-selected');
        btn.setAttribute('aria-checked', 'true');
        onSelect(btn.dataset.value);
      });
    });
  }

  function resetOptionGroup(containerId) {
    $all(`#${containerId} .option-col`).forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-checked', 'false'); });
  }

  let signupStep = 1;
  let signupDraft = {};
  let signupPhotoDataUrl = null;

  // BRAMUlab_V03.2.1 (§5) — "CREAR ACCESO" → "CREAR CUENTA" en todo el flujo (nombre real de
  // la acción que el usuario reconoce, ver botón CREAR CUENTA en Bienvenida).
  const SIGNUP_STEP_TITLES = { 1: 'CREAR CUENTA', 2: 'TU IDENTIDAD', 3: 'TU PÁDEL' };

  function resetSignupWizard() {
    signupStep = 1;
    signupDraft = {};
    signupPhotoDataUrl = null;
    $('#signup-form').reset();
    $('#signup-avatar-img').hidden = true;
    $('#signup-avatar-initials').hidden = false;
    $('#signup-avatar-initials').textContent = '—';
    $('#signup-username-feedback').textContent = '';
    delete $('#signup-username').dataset.touched;
    resetOptionGroup('signup-hand-options');
    resetOptionGroup('signup-side-options');
  }

  function openSignupWizard() {
    resetSignupWizard();
    renderSignupStep();
    showView('signup');
  }

  function renderSignupStep() {
    $all('#signup-form .signup-step').forEach((el) => { el.hidden = Number(el.dataset.step) !== signupStep; });
    $all('.signup-progress__dot').forEach((dot) => {
      const n = Number(dot.dataset.stepDot);
      dot.classList.toggle('is-active', n === signupStep);
      dot.classList.toggle('is-done', n < signupStep);
    });
    $('#signup-step-title').textContent = SIGNUP_STEP_TITLES[signupStep];
    $('#signup-continue-btn').textContent = signupStep === 3 ? 'CREAR MI JUGADOR' : 'CONTINUAR';
    recomputeSignupStepValidity();
  }

  /** Pinta el checklist de reglas de contraseña en vivo (consolidado §2 Paso 1) — reusado por
   *  el wizard de signup y por "Completar acceso" (misma exigencia de fuerza en los dos). */
  function updatePasswordRulesUI(password, listId) {
    const strength = PLI.checkPasswordStrength(password);
    $all(`#${listId} li`).forEach((li) => { li.classList.toggle('is-met', !!strength[li.dataset.rule]); });
    return strength;
  }

  function recomputeSignupStepValidity() {
    let ok = false;
    if (signupStep === 1) {
      const email = $('#signup-email').value;
      const password = $('#signup-password').value;
      const repeat = $('#signup-password-repeat').value;
      const strength = updatePasswordRulesUI(password, 'signup-password-rules');
      ok = PLI.isValidEmail(email) && !PLI.isEmailTaken(email, Store.loadUsers()) && strength.ok && PLI.passwordsMatch(password, repeat);
    } else if (signupStep === 2) {
      const username = $('#signup-username').value;
      const displayName = $('#signup-display-name').value.trim();
      ok = !!$('#signup-first-name').value.trim() && !!displayName
        && PLI.isValidUsernameFormat(username) && !PLI.isUsernameTaken(username, Store.loadUsers());
    } else if (signupStep === 3) {
      ok = !!$('#signup-birthdate').value && !!$('#signup-gender').value
        && !!signupDraft.dominantHand && !!signupDraft.preferredSide && !!$('#signup-category').value;
    }
    $('#signup-continue-btn').disabled = !ok;
    return ok;
  }

  function renderUsernameFeedback(inputId, feedbackId, excludeUserId) {
    const username = $(`#${inputId}`).value.trim();
    const el = $(`#${feedbackId}`);
    if (!username) { el.textContent = ''; el.classList.remove('is-taken'); return; }
    if (!PLI.isValidUsernameFormat(username)) { el.textContent = 'Entre 3 y 20 caracteres, sin espacios.'; el.classList.add('is-taken'); return; }
    const taken = PLI.isUsernameTaken(username, Store.loadUsers(), excludeUserId);
    // V03.0.1 (§2) — feedback más claro (✓/!), pedido puntualmente para Editar Datos pero
    // esta función es compartida con el signup (step 2) — misma mejora ahí también,
    // consistencia justificada, sin lógica nueva.
    el.textContent = taken ? '! Ya está en uso' : '✓ Disponible';
    el.classList.toggle('is-taken', taken);
  }

  /** Consolidado §2 Paso 2 — mientras el usuario no haya tocado @usuario a mano, se le
   *  sugiere una variante libre a partir de nombre/apellido cada vez que esos cambian. Deja de
   *  sugerir apenas el usuario escribe algo ahí (se detecta con un flag simple en el propio
   *  input, sin variable de módulo aparte). */
  function maybeSuggestSignupUsername() {
    const input = $('#signup-username');
    if (input.dataset.touched === '1') return;
    input.value = PLI.suggestUsername($('#signup-first-name').value, $('#signup-last-name').value, Store.loadUsers());
    renderUsernameFeedback('signup-username', 'signup-username-feedback');
  }

  function setAvatarPreview(imgId, initialsId, dataUrl, fallbackName) {
    const img = $(`#${imgId}`), initials = $(`#${initialsId}`);
    if (dataUrl) { img.src = dataUrl; img.hidden = false; initials.hidden = true; }
    else { img.hidden = true; initials.hidden = false; initials.textContent = playerInitials(fallbackName || ''); }
  }

  /** Redimensiona una imagen elegida por el usuario antes de guardarla (foto de perfil /
   *  signup): nunca se guarda el archivo original completo en localStorage — un máximo de
   *  ~256px de lado más compresión JPEG evita inflar el storage con fotos de varios MB.
   *  Devuelve una Promise<string> (data URL) — se usa tanto en el signup como en Perfil. */
  function downscaleImageFileToDataUrl(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let { width, height } = img;
          if (width >= height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function initSignupWizard() {
    $('#signup-back-btn').addEventListener('click', () => {
      if (signupStep > 1) { signupStep -= 1; renderSignupStep(); } else showView('access');
    });
    ['signup-email', 'signup-password', 'signup-password-repeat'].forEach((id) => {
      $(`#${id}`).addEventListener('input', recomputeSignupStepValidity);
    });
    // V03.0.2 (§9/§11) — mismo componente de ojo mostrar/ocultar que Login/Completar
    // Acceso/Cambiar contraseña ("Signup donde corresponda").
    wirePasswordToggle('signup-password', 'signup-password-toggle');
    wirePasswordToggle('signup-password-repeat', 'signup-password-repeat-toggle');
    $('#signup-first-name').addEventListener('input', () => { maybeSuggestSignupUsername(); recomputeSignupStepValidity(); });
    $('#signup-last-name').addEventListener('input', () => { maybeSuggestSignupUsername(); recomputeSignupStepValidity(); });
    $('#signup-username').addEventListener('input', () => {
      $('#signup-username').dataset.touched = '1';
      renderUsernameFeedback('signup-username', 'signup-username-feedback');
      recomputeSignupStepValidity();
    });
    $('#signup-display-name').addEventListener('input', recomputeSignupStepValidity);
    ['signup-birthdate', 'signup-gender', 'signup-category'].forEach((id) => {
      $(`#${id}`).addEventListener('input', recomputeSignupStepValidity);
    });
    wireOptionGroup('signup-hand-options', (v) => { signupDraft.dominantHand = v; recomputeSignupStepValidity(); });
    wireOptionGroup('signup-side-options', (v) => { signupDraft.preferredSide = v; recomputeSignupStepValidity(); });

    $('#signup-avatar-edit-btn').addEventListener('click', () => $('#signup-avatar-input').click());
    $('#signup-avatar-input').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      signupPhotoDataUrl = await downscaleImageFileToDataUrl(file, 256, 0.7);
      setAvatarPreview('signup-avatar-img', 'signup-avatar-initials', signupPhotoDataUrl);
    });

    $('#signup-continue-btn').addEventListener('click', () => {
      if (!recomputeSignupStepValidity()) return;
      if (signupStep === 1) {
        signupDraft.email = $('#signup-email').value.trim();
        signupDraft.password = $('#signup-password').value;
        signupStep = 2;
        renderSignupStep();
      } else if (signupStep === 2) {
        signupDraft.firstName = $('#signup-first-name').value.trim();
        signupDraft.lastName = $('#signup-last-name').value.trim();
        signupDraft.username = $('#signup-username').value.trim();
        signupDraft.displayName = normalizePlayerName($('#signup-display-name').value);
        signupDraft.profilePhoto = signupPhotoDataUrl;
        signupStep = 3;
        renderSignupStep();
      } else {
        signupDraft.birthDate = $('#signup-birthdate').value;
        signupDraft.gender = $('#signup-gender').value;
        signupDraft.declaredCategory = $('#signup-category').value;
        // V03.1 (§4) — se declara por primera vez acá: queda fechada desde el arranque.
        signupDraft.declaredCategoryAt = new Date().toISOString();
        const user = Store.signUpAndLogin(signupDraft);
        syncCurrentIdentityFromStore();
        openPlayerCardScreen(user);
      }
    });
  }

  /** `birthDate` es un string "YYYY-MM-DD" plano (de `<input type="date">`), nunca un
   *  instante UTC — `new Date('2000-05-15')` lo interpretaría como medianoche UTC y, con
   *  `Intl.DateTimeFormat` en una zona horaria detrás de UTC (como Argentina), mostraría el
   *  día ANTERIOR. Mismo tipo de bug que ya se corrigió en la carga manual (V02.1/V02.5,
   *  ver ML.buildPlayedAtFromLocalFields) — acá se evita directamente construyendo la fecha
   *  en LOCAL a partir de las 3 partes, sin pasar nunca por un parseo UTC. */
  function formatBirthDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return '';
    const local = new Date(y, m - 1, d);
    try { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(local); }
    catch (e) { return dateStr; }
  }

  const HAND_LABELS = { derecha: 'Derecha', izquierda: 'Izquierda' };
  const SIDE_LABELS = { drive: 'Drive', reves: 'Revés', indiferente: 'Indiferente' };
  const CATEGORY_LABELS = { '1': '1ª', '2': '2ª', '3': '3ª', '4': '4ª', '5': '5ª', '6': '6ª', '7': '7ª', '8': '8ª', '9': '9ª', 'no-se': 'No sé mi categoría' };
  const GENDER_LABELS = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro', 'prefiero-no-decir': 'Prefiero no decir' };

  /** Consolidado §3 — "TU JUGADOR ESTÁ LISTO": momento de recompensa post-signup, nunca un
   *  alert genérico. Siempre muestra 0/5 CALIBRANDO (una cuenta recién creada nunca tiene
   *  partidos todavía) — no reusa PH.buildCalibrationStatus con datos reales a propósito, acá
   *  el estado es fijo por definición. */
  function openPlayerCardScreen(user) {
    setAvatarPreview('player-card-avatar-img', 'player-card-avatar-initials', user.profilePhoto, user.displayName);
    $('#player-card-name').textContent = user.displayName || '—';
    $('#player-card-handle').textContent = user.username ? `@${user.username}` : '—';
    const age = PLI.calculateAge(user.birthDate);
    $('#player-card-age').textContent = age === null ? '—' : String(age);
    $('#player-card-hand').textContent = HAND_LABELS[user.dominantHand] || '—';
    $('#player-card-side').textContent = SIDE_LABELS[user.preferredSide] || '—';
    $('#player-card-category').textContent = CATEGORY_LABELS[user.declaredCategory] || '—';
    showView('player-card');
  }

  function initPlayerCardScreen() {
    $('#player-card-enter-btn').addEventListener('click', () => { completeIdentifyAction(); });
  }

  /** V03.0 (§3) — completar acceso (agregar email+contraseña a la MISMA cuenta, nunca crea
   *  una segunda). Reusado desde Perfil y desde la advertencia de "Cerrar sesión".
   *  V03.0.1 (§4) — pasa de modal a pantalla completa (#view-complete-access), mismo shell
   *  que Editar Datos/Login. Nombre de función sin cambios a propósito (menor superficie de
   *  cambio) aunque ya no abre un modal. */
  function openCompleteAccessModal() {
    $('#complete-access-email').value = '';
    $('#complete-access-password').value = '';
    $('#complete-access-password-repeat').value = '';
    $('#complete-access-error').hidden = true;
    updatePasswordRulesUI('', 'complete-access-password-rules');
    showView('complete-access');
  }

  function initCompleteAccessModal() {
    $('#complete-access-password').addEventListener('input', (e) => updatePasswordRulesUI(e.target.value, 'complete-access-password-rules'));
    wirePasswordToggle('complete-access-password', 'complete-access-password-toggle');
    wirePasswordToggle('complete-access-password-repeat', 'complete-access-password-repeat-toggle');
    $('#complete-access-cancel').addEventListener('click', () => showView('profile'));
    $('#complete-access-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) { showView('profile'); return; }
      const email = $('#complete-access-email').value.trim();
      const password = $('#complete-access-password').value;
      const repeat = $('#complete-access-password-repeat').value;
      const strength = PLI.checkPasswordStrength(password);
      let error = null;
      if (!PLI.isValidEmail(email)) error = 'Ingresá un email válido.';
      else if (PLI.isEmailTaken(email, Store.loadUsers(), user.id)) error = 'Ese email ya está en uso.';
      else if (!strength.ok) error = 'La contraseña todavía no cumple los requisitos.';
      else if (!PLI.passwordsMatch(password, repeat)) error = 'Las contraseñas no coinciden.';
      if (error) { $('#complete-access-error').textContent = error; $('#complete-access-error').hidden = false; return; }
      Store.updateUserAccount(user.id, { email, password });
      Store.addNotification({
        userId: user.id, type: 'access_completed', category: 'positive',
        title: 'Acceso completado', body: 'Ya podés volver a entrar a este jugador cuando quieras.',
      });
      $('#logout-warning-modal').hidden = true;
      renderProfileView();
      renderNotificationsBadge();
      showView('profile');
      showToast('Acceso guardado');
    });
  }

  /** V03.0.1 (§5) — "Cambiar contraseña": nuevo, pantalla completa (#view-change-password).
   *  Prototipo local sin backend: compara la contraseña actual en texto plano, mismo criterio
   *  que Store.loginWithEmail (store.js) — el consolidado pide explícitamente no agregar
   *  cripto casera acá. Conserva mismo userId/sesión/historial: solo cambia `user.password`. */
  function openChangePasswordScreen() {
    $('#change-password-current').value = '';
    $('#change-password-new').value = '';
    $('#change-password-repeat').value = '';
    $('#change-password-error').hidden = true;
    updatePasswordRulesUI('', 'change-password-rules');
    showView('change-password');
  }

  function initChangePasswordScreen() {
    wirePasswordToggle('change-password-current', 'change-password-current-toggle');
    wirePasswordToggle('change-password-new', 'change-password-new-toggle');
    wirePasswordToggle('change-password-repeat', 'change-password-repeat-toggle');
    $('#change-password-new').addEventListener('input', (e) => updatePasswordRulesUI(e.target.value, 'change-password-rules'));
    $('#change-password-cancel').addEventListener('click', () => showView('profile'));
    // V03.0.3.2 (§1/§2) — camino B para quien no recuerda la actual: mismo wizard de
    // recuperación, arrancando directo en el código (sin pedir email de nuevo).
    $('#change-password-forgot-btn').addEventListener('click', openForgotPasswordFromSession);
    $('#change-password-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) { showView('profile'); return; }
      const current = $('#change-password-current').value;
      const next = $('#change-password-new').value;
      const repeat = $('#change-password-repeat').value;
      const strength = PLI.checkPasswordStrength(next);
      let error = null;
      if ((user.password || '') !== current) error = 'La contraseña actual no es correcta.';
      else if (!strength.ok) error = 'La nueva contraseña todavía no cumple los requisitos.';
      else if (!PLI.passwordsMatch(next, repeat)) error = 'Las contraseñas nuevas no coinciden.';
      if (error) { $('#change-password-error').textContent = error; $('#change-password-error').hidden = false; return; }
      Store.updateUserAccount(user.id, { password: next });
      Store.addNotification({
        userId: user.id, type: 'password_updated', category: 'info',
        title: 'Contraseña actualizada', body: 'Tu contraseña se cambió correctamente.',
      });
      renderNotificationsBadge();
      showView('profile');
      showToast('Contraseña actualizada');
    });
  }

  /** V03.0 (§3) — "Cerrar sesión": borra ÚNICAMENTE la sesión activa (Store.logoutSession —
   *  limpia SESSION + CURRENT_PLAYER), nunca el Historial, USERS ni los partidos guardados
   *  (son datos globales del dispositivo, no de la sesión). Si la cuenta todavía no tiene
   *  email, advierte con el modal fuerte de siempre — sin acceso completo no hay forma de
   *  volver a entrar a ESE jugador (un userId ya estampado en el historial es exclusivo de esa
   *  cuenta, nunca se "recupera" creando otra con el mismo nombre — ver player-home.js).
   *  V03.1 (§20) — si la cuenta SÍ tiene acceso completo, antes cerraba sesión con un solo
   *  toque; ahora pasa por una confirmación simple (#logout-confirm-modal) — "dejar de ser
   *  accidental" sin la estética de advertencia fuerte del caso de arriba (ese es un riesgo
   *  real de quedar afuera; este es solo evitar un toque de más). */
  function requestLogout() {
    const user = Store.getCurrentUser();
    if (user && !user.email) { $('#logout-warning-modal').hidden = false; return; }
    $('#logout-confirm-modal').hidden = false;
  }
  function doLogout() {
    Store.logoutSession();
    currentPlayerName = null;
    currentUserId = null;
    // V03.0.1 (§7) — antes iba a showView('setup'): como 'setup' está en BOTTOM_NAV_VIEWS,
    // la barra inferior reaparecía tras cerrar sesión y Historial/Ranking/Perfil quedaban
    // alcanzables (bug reportado en uso real). Ahora vuelve directo a "BIENVENIDO A BRAMU".
    openAccessFlow();
  }
  function initLogoutWarningModal() {
    $('#logout-warning-cancel-btn').addEventListener('click', () => { $('#logout-warning-modal').hidden = true; });
    $('#logout-warning-complete-btn').addEventListener('click', () => { $('#logout-warning-modal').hidden = true; openCompleteAccessModal(); });
    $('#logout-warning-confirm-btn').addEventListener('click', () => { $('#logout-warning-modal').hidden = true; doLogout(); });
  }
  function initLogoutConfirmModal() {
    $('#logout-confirm-cancel-btn').addEventListener('click', () => { $('#logout-confirm-modal').hidden = true; });
    $('#logout-confirm-btn').addEventListener('click', () => { $('#logout-confirm-modal').hidden = true; doLogout(); });
  }

  function playerInitials(name) {
    const parts = (name || '').trim().split(' ').filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /** Etapa 3 (Fase 2, §7) — franja de partido en curso: prioridad sobre Hitos/identidad,
   *  solo visible con un partido en vivo activo. No depende de qué jugador esté
   *  identificado (a diferencia del resto del Home) — un partido en curso es del
   *  dispositivo, igual que ya lo trata "partido en curso" en el resto de la app. */
  function renderActiveMatchBanner() {
    const summary = getActiveMatchSummary();
    const banner = $('#active-match-banner');
    if (!summary) { banner.hidden = true; return; }
    $('#active-match-banner-teams').textContent = `${summary.teamAName} vs ${summary.teamBName}`;
    $('#active-match-banner-meta').textContent = `${summary.scoreLabel} · ${summary.modeLabel}`;
    banner.hidden = false;
  }

  function renderPlayerHome() {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderActiveMatchBanner();
    renderNotificationsBadge();
    const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity());
    // V02.8 (§1) — se anima en CADA render (cada entrada/vuelta real al Home, ver comentario
    // en la declaración de `currentPlayerName` de más arriba), salvo `prefers-reduced-motion`.
    // Se sigue chequeando en JS (no solo vía el colapso de `--home-anim-*` a 1ms en CSS) porque
    // el stagger de Actividad usa `transition-delay` inline por barra — un valor que no depende
    // de ningún token CSS y igual introduciría un desfasaje perceptible entre barras si no se
    // corta acá directamente.
    const prefersReducedMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    const shouldAnimate = !prefersReducedMotion;

    renderPlayerHitos(matches);
    renderPlayerCard(matches, shouldAnimate);
    renderPlayerLastMatchCard(matches);
    $('#player-home-momento-text').textContent = PH.buildTuMomentoText(matches, currentIdentity());
    renderPlayerActivity(matches, shouldAnimate);
    renderPlayerEffectiveness(matches, shouldAnimate);
    renderPlayerWidgets(matches);
    // V02.1 (§23) — pie de autoría, mudado acá desde Configurar partido (naming oficial
    // "BRAMUlab", sin espacio — antes decía "BRAMU Lab" en el único lugar que faltaba).
    $('#player-home-footer').textContent = `BRAMUlab · Concepto y diseño por Sebastián Vila · ${Store.VERSION}`;
  }

  /** §5 — Hitos personales: como máximo 2, ocultos por completo si no hay ninguno
   *  justificado (PH.computeHitos ya decide eso; acá solo se pinta lo que devuelve). */
  function renderPlayerHitos(matches) {
    const hitos = PH.computeHitos(matches, currentIdentity());
    const wrap = $('#player-home-hitos');
    if (!hitos.length) { wrap.hidden = true; wrap.innerHTML = ''; return; }
    wrap.hidden = false;
    wrap.innerHTML = hitos.map((h) => `<span class="player-home-hitos__chip">${escapeHtml(h)}</span>`).join('');
  }

  /** §6 (Etapa 4) / §4.1 (Etapa 4.1) — Tarjeta de jugador: avatar/nombre/cantidad REAL de
   *  partidos + bloque Nivel BRAMU, ahora derivado de PH.computeLevelEvolution (nunca un
   *  valor fijo). La variación mostrada es la del ÚLTIMO PARTIDO (`lastDelta`), no el cambio
   *  acumulado — así lo pide el consolidado de Etapa 4.1 para esta tarjeta específicamente
   *  (Perfil, en cambio, muestra el cambio acumulado desde la base — ver renderProfileEvolution). */
  /** V02.1 (§19) — "@handle" provisional de interfaz: derivado del primer nombre del jugador
   *  actual, nunca hardcodeado ni parte de un sistema de cuentas real (§32 del consolidado —
   *  "@seba es solamente una representación provisional"). Sin diacríticos, minúscula, sin
   *  espacios: el mismo criterio informal de cualquier handle de usuario. */
  function buildPlayerHandle(name) {
    const first = (name || '').trim().split(' ')[0] || '';
    const stripped = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return '@' + stripped.toLowerCase();
  }

  /** V03.0 (§2/§4) — cuentas legacy migradas siguen viendo el número simulado de siempre, sin
   *  ningún cambio (consolidado §4: "no romper niveles ni datos existentes de usuarios de
   *  prueba"). Cuentas nuevas V03.0 nunca ven un número — la fórmula real todavía no existe —
   *  solo CALIBRANDO X/5 PARTIDOS o CALIBRACIÓN COMPLETA (PH.buildCalibrationStatus), de forma
   *  permanente en esta versión. */
  function isLegacyLevelAccount() {
    const user = Store.getCurrentUser();
    return !!(user && user.legacyMigrated);
  }

  function renderPlayerCard(matches, shouldAnimate) {
    $('#player-home-name').textContent = currentPlayerName;
    $('#player-home-handle').textContent = buildPlayerHandle(currentPlayerName);
    // V03.0.1 (§3) — bug: la foto ya persistía en Perfil/Editar Datos pero el Home seguía
    // mostrando siempre el ícono genérico porque `renderPlayerCard` nunca leía `profilePhoto`.
    // Misma fuente que el resto de la app (Store.getCurrentUser()), sin segunda fuente ni
    // almacenamiento nuevo.
    // V03.0.3 (§1) — fix definitivo: un solo atributo (`data-has-photo`) en el contenedor
    // decide en CSS qué capa se pinta (ver styles.css) — nunca dos `hidden` independientes
    // que puedan quedar desincronizados entre sí (la causa real del bug reportado tras
    // V03.0.2: dos escrituras separadas, sin ninguna garantía de quedar siempre en sync).
    const homeUser = Store.getCurrentUser();
    const homeAvatarImg = $('#player-home-avatar-img');
    const hasPhoto = !!(homeUser && homeUser.profilePhoto);
    $('#player-home-avatar').dataset.hasPhoto = String(hasPhoto);
    if (hasPhoto) homeAvatarImg.src = homeUser.profilePhoto;
    else homeAvatarImg.removeAttribute('src');
    const n = matches.length;
    $('#player-home-match-count').textContent = n === 1 ? '1 partido en tu historia' : `${n} partidos en tu historia`;
    // `matches` ya viene filtrado a los propios del jugador (PH.filterMatchesForPlayer) — es
    // exactamente la misma noción de "mine" que usa la evolución (§4.2: nunca un Observado).
    const evolution = PH.computeLevelEvolution(matches, currentIdentity());
    const levelSubEl = $('#player-home-level-sub');
    const barWrapEl = $('#player-home-level-bar-wrap');
    if (!isLegacyLevelAccount()) {
      const calib = PH.buildCalibrationStatus(evolution.consideredCount);
      $('#player-home-level-value').textContent = calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO';
      levelSubEl.hidden = calib.complete;
      levelSubEl.textContent = calib.complete ? '' : calib.progressText;
      barWrapEl.hidden = true;
      return;
    }
    barWrapEl.hidden = false;
    levelSubEl.hidden = true;
    $('#player-home-level-value').textContent = evolution.current.toFixed(1);
    const delta = formatLevelDelta(evolution.lastDelta);
    const deltaEl = $('#player-home-level-delta');
    deltaEl.textContent = delta.label;
    deltaEl.className = 'player-card__level-delta player-card__level-delta--' + delta.direction;
    const progressPct = PH.levelProgressPct(evolution.current);
    const barEl = $('#player-home-level-bar');
    // V02.8.1 (§1.2) — REEMPLAZA la técnica de V02.7/V02.8 (transición de `width` disparada por
    // "0% + reflow + valor final"): no se percibía con claridad en la prueba real. El ancho
    // final se asigna siempre directo (nunca en dos pasos); el crecimiento visible lo aporta la
    // animación `@keyframes` de `.player-card__bar-fill.is-animating` (`transform: scaleX(0→1)`,
    // ver styles.css). Se quita la clase antes de un reflow forzado y se vuelve a agregar para
    // que la animación se REINICIE en cada entrada al Home (agregar la misma clase sin sacarla
    // antes no dispara `@keyframes` de nuevo — es el mismo patrón estándar que usa cualquier
    // animación CSS retriggereable de esta app).
    barEl.style.width = progressPct + '%';
    barEl.classList.remove('is-animating');
    if (shouldAnimate) {
      void barEl.offsetWidth;
      barEl.classList.add('is-animating');
    }
    // V02.4 (Bloque A, §3.3) — la pastilla ↑/↓ vive SOBRE el punto alcanzado (ya no es hija del
    // relleno: es hermana dentro de .player-card__bar, con su propio `left`), recortada entre
    // 6% y 94% para que nunca choque contra ningún borde de la barra en los extremos (0%/100%).
    $('#player-home-level-delta').style.left = Math.min(94, Math.max(6, progressPct)) + '%';
  }

  /** §7 — Último partido: volanta de forma reciente (último indicador = este partido, con
   *  glow sutil de victoria/derrota) + fecha/hora/lugar arriba; resultado protagonista;
   *  parejas en secundario. Estado vacío: mismo flujo del botón central "+". El click de
   *  toda la tarjeta se resuelve en initPlayerHomeScreen() (ver más abajo), no acá — así no
   *  hace falta reasignar un listener nuevo en cada render. */
  function renderPlayerLastMatchCard(matches) {
    const card = $('#player-home-last-match-card');
    const body = $('#player-home-last-match-body');
    if (!matches.length) {
      card.classList.add('is-empty');
      body.innerHTML = `
        <div class="player-home-lastmatch__title">ÚLTIMO PARTIDO</div>
        <p class="coverage-note">Tu historia empieza con tu primer partido</p>
        <span class="player-home-lastmatch__cta">+ CARGAR PRIMER PARTIDO</span>
      `;
      return;
    }
    card.classList.remove('is-empty');
    const m = matches[0];
    const myTeam = PH.getPlayerTeam(m, currentIdentity());
    const partner = PH.getPartnerName(m, currentIdentity());
    const rivals = PH.getOpponentNames(m, currentIdentity());
    // V02.4 (Bloque B, §5) — marcador GRANDE exclusivo de esta tarjeta (buildLastMatchScoreHTML,
    // no el componente canónico compartido con Historial/Confirmar partido — ver comentario
    // en su definición).
    const scoreStr = buildLastMatchScoreHTML(m.sets, m.currentPartial);
    const scoreLabel = buildLastMatchScoreLabel(m.sets, m.currentPartial);
    const resultKind = !m.winnerTeam ? 'neutral' : (m.winnerTeam === myTeam ? 'win' : 'loss');
    // V02.9 (§3) — vuelve a la palabra completa VICTORIA/DERROTA (el consolidado la da por
    // "mantenida" en esta tarjeta; §20/V02.5 la había abreviado a VIC/DER, mismo criterio que
    // Historial — Historial vuelve también a la palabra completa en esta misma ronda, §4).
    const resultLabel = { win: 'VICTORIA', loss: 'DERROTA', neutral: 'SIN DEFINICIÓN' }[resultKind];
    // Etapa 3 (Fase 1) — fecha REAL jugada, no cuándo se guardó. §7 (Etapa 4) — formato exacto
    // "02SEP · 22:30"; sin hora cargada (timeKnown === false) no se inventa "00:00".
    const playedAt = PH.getPlayedAt(m);
    const dateStr = formatCompactPlayedDate(playedAt, m.timeZone);
    const timeStr = m.timeKnown === false ? '' : formatRealTime(playedAt, m.timeZone).slice(0, 5);
    const dateTimeStr = [dateStr, timeStr].filter(Boolean).join(' · ');
    const placeStr = (m.location && m.location.name) || '';

    const RESULT_LABEL = { win: 'Victoria', loss: 'Derrota', neutral: 'Sin definición' };
    // computeRecentForm viene del más reciente al más antiguo; se invierte para dibujar la
    // volanta en orden cronológico (izquierda=más antiguo → derecha=este partido, §7).
    // Etapa 4.2 (§11) — sin letra adentro: la forma y el color ya se entienden solos, con el
    // aria-label como alternativa accesible (nunca el color como única señal).
    const formOldestFirst = PH.computeRecentForm(matches, currentIdentity(), 5).slice().reverse();
    const formDotsHtml = formOldestFirst.map((f, i) => {
      const isCurrent = i === formOldestFirst.length - 1;
      const cls = `lastmatch-form-dot lastmatch-form-dot--${f.result}${isCurrent ? ' lastmatch-form-dot--current' : ''}`;
      return `<span class="${cls}" aria-label="${RESULT_LABEL[f.result]}"></span>`;
    }).join('');

    const teamAName = [currentPlayerName, partner].filter(Boolean).join(' / ') || '—';
    const teamBName = rivals.join(' / ') || '—';
    // V02.9 (§3) — metadata secundaria (formato + sistema de puntuación reales del partido),
    // abajo a la derecha, alineada con los participantes — nunca protagonista (por eso vive acá,
    // no en el título/badge de arriba). Mismos labels/fuente que usa Historial (E.FORMATS /
    // SCORING_SYSTEM_LABELS), así que "CLÁSICO"/"PUNTO DE ORO" es siempre el valor real del
    // partido, no un texto fijo.
    const lastMatchFormatLabel = ((E.FORMATS[m.formatId] && E.FORMATS[m.formatId].label) || '').toUpperCase();
    const lastMatchScoringLabel = SCORING_SYSTEM_LABELS[m.scoringSystem] || '';

    body.innerHTML = `
      <!-- V02.9.1 (§2) — encabezado pasa de 2 columnas (izquierda: forma+título+badge / derecha:
           fecha) a 2 líneas apiladas: línea 1 título+fecha, línea 2 forma+badge — la ubicación
           anterior del badge (compitiendo con el título en la misma fila angosta) no funcionaba. -->
      <div class="player-home-lastmatch__top">
        <div class="player-home-lastmatch__row1">
          <span class="player-home-lastmatch__title">ÚLTIMO PARTIDO</span>
          <div class="player-home-lastmatch__datetime">
            ${dateTimeStr ? `<div class="player-home-lastmatch__date">${dateTimeStr}</div>` : ''}
            ${placeStr ? `<div class="player-home-lastmatch__place">${escapeHtml(placeStr)}</div>` : ''}
          </div>
        </div>
        <div class="player-home-lastmatch__row2">
          <div class="player-home-lastmatch__form">${formDotsHtml}</div>
          <span class="player-home-lastmatch__badge player-home-lastmatch__badge--${resultKind}">${resultLabel}</span>
        </div>
      </div>
      <div class="player-home-lastmatch__score lastmatch-score" aria-label="${escapeHtml(scoreLabel)}">${scoreStr}</div>
      <!-- V02.4 (Bloque B, §6) — equipos en DOS líneas (propio, después rival con "vs" discreto)
           en vez de una sola línea comprimida — nunca compiten en tamaño/peso con el marcador
           de arriba. -->
      <div class="player-home-lastmatch__teamsrow">
        <div class="player-home-lastmatch__teams">
          <div class="player-home-lastmatch__teams-line">${escapeHtml(teamAName)}</div>
          <div class="player-home-lastmatch__teams-line"><span class="vs-sep">vs</span>${escapeHtml(teamBName)}</div>
        </div>
        ${(lastMatchFormatLabel || lastMatchScoringLabel) ? `<div class="player-home-lastmatch__meta">
          ${lastMatchFormatLabel ? `<div class="player-home-lastmatch__meta-line">${escapeHtml(lastMatchFormatLabel)}</div>` : ''}
          ${lastMatchScoringLabel ? `<div class="player-home-lastmatch__meta-line">${escapeHtml(lastMatchScoringLabel)}</div>` : ''}
        </div>` : ''}
        <span class="player-home-lastmatch__chevron" aria-hidden="true">›</span>
      </div>
    `;
  }

  /** §9 — Actividad: 4 bloques cronológicos (más antiguo→más reciente, izquierda→derecha).
   *  V02.4 (Bloque A, §2) — V02.3 había ido demasiado lejos corrigiendo el bug real (una
   *  derrota invisible, indistinguible de un período vacío): sacó el resultado por completo de
   *  Actividad y pintó TODO el volumen en celeste — pero Actividad debe comunicar dos cosas a
   *  la vez (cuánto se jugó Y cuánto se ganó/perdió), no una sola. Vuelve a ser una barra
   *  APILADA: la ALTURA total sigue representando el volumen del período relativo al máximo de
   *  los 4 (sin cambios respecto de V02.3, `heightPct` abajo), pero ahora se compone de dos
   *  segmentos — lima (victorias) y un tono oscuro/neutro con más presencia que el baseline
   *  vacío (derrotas, `--line-strong`, nunca celeste ni rojo) — vía PH.computeActivityBarSegments
   *  (función pura, testeada con los 4 casos del §10.1.5: incluye 1 derrota/0 victorias, que
   *  sigue dando `lossPct: 100`, nunca 0% de alto). */
  function renderPlayerActivity(matches, shouldAnimate) {
    const activity = PH.computeActivityWeeks4(matches, currentIdentity());
    const wrap = $('#player-home-activity-bars');
    const maxCount = Math.max(1, ...activity.buckets.map((b) => b.count));
    const heights = activity.buckets.map((b) => b.count ? Math.max(14, Math.round((b.count / maxCount) * 100)) : 6);
    // V02.8.2 (§1) — REEMPLAZA la técnica de V02.7/V02.8/V02.8.1: el patrón "0% + reflow + alto
    // final" dejó de animar en uso real (misma clase de fragilidad ya corregida en la barra de
    // Nivel en V02.8.1 — una transición no garantiza que el navegador pinte el 0% antes de
    // aplicar el valor final). El alto de cada barra se asigna siempre directo, nunca en dos
    // pasos; el crecimiento visible lo aporta `@keyframes activityBarGrow` (`transform:
    // scaleY(0→1)`, ver styles.css) aplicado vía la clase `.is-animating`, incluida desde el
    // HTML inicial de cada barra — no hace falta la danza de sacar/reflow/volver a poner la
    // clase que sí necesita la barra de Nivel, porque acá CADA barra es un elemento nuevo en
    // cada render (`wrap.innerHTML` las recrea siempre): un elemento que nace con la clase
    // arranca su animación solo. El stagger (100ms/barra) pasa de `transition-delay` a
    // `animation-delay`, mismo valor. Los segmentos ganados/derrotas internos van directo a su
    // proporción final: lo que anima es el volumen de la semana (alto total), no la composición
    // ganado/perdido dentro de ella.
    wrap.innerHTML = activity.buckets.map((b, i) => {
      const seg = PH.computeActivityBarSegments(b.count, b.wins, b.losses);
      const animClass = shouldAnimate ? ' is-animating' : '';
      return `<div class="activity-bar${animClass}" style="height:${heights[i]}%; animation-delay:${i * 100}ms;"><span class="activity-bar__win" style="height:${seg.winPct}%"></span><span class="activity-bar__loss" style="height:${seg.lossPct}%"></span></div>`;
    }).join('');
    // V02.7 (§3.3) — Actividad pasa de "últimos 30 días" a "últimas 4 semanas" (ver
    // PH.computeActivityWeeks4); el cálculo de ganados/perdidos dentro de cada semana no cambia.
    $('#player-home-activity-total').textContent = activity.total
      ? `${activity.total} ${activity.total === 1 ? 'partido' : 'partidos'} en las últimas 4 semanas`
      : 'Sin partidos en las últimas 4 semanas';
  }

  // V02.8.1 (§1.3) — duración de la animación de Efectividad como constante JS: Web Animations
  // API pide un número en ms, no una variable CSS (a diferencia de Nivel/Actividad, que siguen
  // animándose por CSS y sí pueden leer un token). Dentro del rango 900-1000ms pedido.
  const EFFECTIVENESS_ANIM_MS = 950;

  /** V02.8.1 (§1.3) — anima `stroke-dashoffset` de un círculo del donut de Efectividad con Web
   *  Animations API (`Element.animate`): técnica de "dibujado" estándar de un aro SVG (mismo
   *  `stroke-dasharray` CONSTANTE = circunferencia completa en los tres círculos, y el offset
   *  se anima desde "circunferencia completa" — nada visible — hasta "circunferencia menos el
   *  arco lleno" — el % real revelado). Se prefiere sobre la técnica anterior ("poner
   *  dasharray en 0 + forzar reflow + asignar el valor final", que dependía de una transición
   *  CSS registrando ese 0 como frame de partida) porque una animación de Web Animations API
   *  corre sobre su propia línea de tiempo explícita: no hay forma de que el navegador la
   *  "salte" sin pintar frames intermedios, que era exactamente el problema real reportado
   *  (ni Nivel ni Efectividad se percibían animando, ni en iPhone ni en desktop). El valor
   *  final (`toOffset`) se asigna siempre por `style` ANTES de animar, así el estado
   *  post-animación es idéntico tanto si `animate()` corre como si no (navegador sin soporte,
   *  progressive enhancement). Solo se llama cuando `shouldAnimate` ya es `true` (el chequeo de
   *  `prefers-reduced-motion` vive una sola vez en `renderPlayerHome`, no acá — mismo criterio
   *  que Nivel/Actividad). */
  function animateEffectivenessCircle(el, fromOffset, toOffset, ease) {
    el.style.strokeDashoffset = toOffset;
    if (typeof el.animate !== 'function') return;
    el.animate(
      [{ strokeDashoffset: fromOffset }, { strokeDashoffset: toOffset }],
      { duration: EFFECTIVENESS_ANIM_MS, easing: ease, fill: 'forwards' }
    );
  }

  /** V02.7 (§4) — Efectividad: donut con % de victorias sobre partidos CONSIDERADOS (con
   *  resultado definido) del historial COMPLETO del jugador — ya no una ventana de 30 días (ver
   *  PH.computeEffectivenessTotal).
   *  V02.8.1 (§2) — dos círculos concéntricos (trazo principal + halo, ver styles.css/index.html)
   *  que comparten radio/dasharray/dashoffset/animación exactos — nunca pueden desalinearse
   *  entre sí porque reciben las mismas llamadas a `animateEffectivenessCircle`.
   *  V02.9 (§1) — vuelve a ser UN SOLO halo (V02.8.1-8.3 habían llegado a dos, que apilados
   *  leían como un aro difuso — ver styles.css). */
  function renderPlayerEffectiveness(matches, shouldAnimate) {
    const eff = PH.computeEffectivenessTotal(matches, currentIdentity());
    const ring = $('#player-home-effectiveness-ring');
    const glow = $('#player-home-effectiveness-glow');
    const circles = [ring, glow];
    const circumference = 2 * Math.PI * 15.5;
    // `stroke-dasharray` es CONSTANTE (la circunferencia completa, un solo tramo "encendido"
    // tan largo como el círculo entero) — lo único que anima es `stroke-dashoffset`, nunca el
    // dasharray. Se fija siempre, incluso sin muestra, para que los tres círculos queden
    // geométricamente listos antes de decidir si hay algo que mostrar.
    circles.forEach((c) => { c.style.strokeDasharray = `${circumference}`; });
    if (eff.pct === null) {
      // Sin muestra: ni un punto residual del linecap redondeado — se oculta el trazo entero
      // (opacity, no display:none, para no desalinear el <svg>).
      circles.forEach((c) => { c.style.opacity = '0'; });
      $('#player-home-effectiveness-value').textContent = '—';
      $('#player-home-effectiveness-caption').textContent = 'Sin partidos considerados';
      return;
    }
    // V02.8.3 (feedback real) — bug encontrado acá: esta línea forzaba `opacity:1` inline en
    // TODOS los círculos por igual, incluido el/los halo(s) — que tienen su propia opacidad
    // baja definida en CSS (`.effectiveness-donut__glow`, ver styles.css). Un estilo inline
    // gana siempre sobre la regla de clase, así que el halo venía renderizando a opacidad
    // TOTAL desde que existe (V02.8.1), nunca a la opacidad sutil documentada. El trazo
    // principal sigue forzado a `1` (siempre opaco por diseño); el halo se limpia a `''` para
    // que su propia opacidad de CSS finalmente se aplique.
    ring.style.opacity = '1';
    glow.style.opacity = '';
    const filled = (eff.pct / 100) * circumference;
    const toOffset = circumference - filled;
    // V02.8.1 (§1.4) — en cada entrada o vuelta al Home (nunca solo la primera de la sesión,
    // ver `shouldAnimate` en renderPlayerHome), el arco se dibuja desde 0% (`fromOffset` =
    // circunferencia completa) hasta el % real; el número central se asigna directo, nunca
    // "cuenta" hacia arriba. Fuera de esa condición (reingreso sin animar, o
    // `prefers-reduced-motion`), el offset final se asigna directo sin pasar por `animate()`.
    // V02.8.1 (§1.3) — `--home-anim-ease` (`ease-out`), nunca `--motion-ease`: ver comentario
    // en styles.css:root — la curva compartida de la app resuelve casi todo el recorrido
    // visual en el primer 20-25% del tiempo transcurrido, exactamente lo que hacía
    // imperceptible el crecimiento real independientemente de la duración configurada.
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--home-anim-ease').trim() || 'ease-out';
    if (shouldAnimate) {
      circles.forEach((c) => animateEffectivenessCircle(c, circumference, toOffset, ease));
    } else {
      circles.forEach((c) => { c.style.strokeDashoffset = toOffset; });
    }
    $('#player-home-effectiveness-value').textContent = `${eff.pct}%`;
    // V02.6 (§7) — "22 de 32" no decía qué era cada número; el cálculo no cambia, solo el copy.
    $('#player-home-effectiveness-caption').textContent = `${eff.wins} ganados de ${eff.considered} jugados`;
  }

  /** V03.1 (§6/§7) — Efectividad como KPI protagonista de RENDIMIENTO en MI PERFIL: mismo
   *  componente donut que ya usa el Home (`.effectiveness-donut`, ver styles.css/
   *  animateEffectivenessCircle), reusado con ids propios y sin caption interna (Partidos
   *  jugados/ganados se muestran aparte en la columna vecina — nunca "14/18" duplicado acá,
   *  consolidado §7). Siempre anima al renderizar: a diferencia del Home, esta tarjeta solo se
   *  dibuja al abrir/cambiar de pestaña en Perfil, nunca en cada tick de una pantalla que ya
   *  está en foco, así que no hace falta la lógica de `shouldAnimate` por sesión del Home. */
  function renderProfileEffectivenessDonut(eff) {
    const ring = $('#mi-perfil-effectiveness-ring');
    const glow = $('#mi-perfil-effectiveness-glow');
    const circles = [ring, glow];
    const circumference = 2 * Math.PI * 15.5;
    circles.forEach((c) => { c.style.strokeDasharray = `${circumference}`; });
    if (eff.pct === null) {
      circles.forEach((c) => { c.style.opacity = '0'; });
      $('#mi-perfil-effectiveness-value').textContent = '—';
      return;
    }
    ring.style.opacity = '1';
    glow.style.opacity = '';
    const filled = (eff.pct / 100) * circumference;
    const toOffset = circumference - filled;
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--home-anim-ease').trim() || 'ease-out';
    circles.forEach((c) => animateEffectivenessCircle(c, circumference, toOffset, ease));
    $('#mi-perfil-effectiveness-value').textContent = `${eff.pct}%`;
  }

  /** §10 — Cuatro métricas pequeñas: Racha actual (consecutiva desde el partido más reciente,
   *  no la mejor histórica), Partidos totales (real, sin importar la muestra), Mejor
   *  compañero (mayor efectividad con muestra mínima de 3, no el más repetido) y Rival más
   *  enfrentado (sin cambios respecto a Etapa 2/3). */
  function renderPlayerWidgets(matches) {
    const streak = PH.computeCurrentStreak(matches, currentIdentity());
    const total = matches.length;
    const partner = PH.computeBestPartner(matches, currentIdentity());
    const rival = PH.computeMostFrequentRival(matches, currentIdentity());

    $('#widget-streak-value').textContent = streak.count > 0 ? String(streak.count) : '—';
    $('#widget-streak-caption').textContent = streak.count > 0 ? (streak.count === 1 ? 'victoria seguida' : 'victorias seguidas') : 'Sin racha en curso';

    $('#widget-total-value').textContent = String(total);
    $('#widget-total-caption').textContent = total === 1 ? 'partido registrado' : 'partidos registrados';

    $('#widget-partner-value').textContent = partner ? partner.name : '—';
    $('#widget-partner-caption').textContent = partner ? `${partner.pct}% · ${partner.count} ${partner.count === 1 ? 'partido' : 'partidos'}` : 'Sin datos suficientes';

    $('#widget-rival-value').textContent = rival ? rival.name : '—';
    $('#widget-rival-caption').textContent = rival ? `${rival.count} ${rival.count === 1 ? 'enfrentamiento' : 'enfrentamientos'}` : 'Sin datos suficientes';
  }

  /** §7 — toda la tarjeta de "Último partido" es tocable: un solo listener delegado (no uno
   *  nuevo por render) que decide el destino según haya o no partidos — abre Resumen/Detalle
   *  (Análisis) con el partido más reciente, o el mismo flujo del botón central "+" en el
   *  estado vacío. Relee el historial en el momento del click (no un `m` capturado en el
   *  render) para no quedar con una referencia vieja si el Home no se re-renderizó desde el
   *  último cambio. */
  function initPlayerHomeLastMatchCard() {
    $('#player-home-last-match-card').addEventListener('click', () => {
      const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity());
      if (!matches.length) { openManualLoadScreen('player-home'); return; }
      openCanonicalResumen(matches[0], 'player-home');
    });
  }

  /** V02.1 (§22) — navegación desde las métricas del Home. Racha/Efectividad abren Historial
   *  ya recortado al conjunto exacto que originó el número tocado; Compañero/Rival abren la
   *  vista de personas correspondiente. Actividad y Partidos totales deliberadamente NO
   *  tienen handler acá (§22: "mantener sin acción hasta definir qué detalle aporta valor"). */
  function initPlayerHomeMetricsNav() {
    $('#widget-streak-card').addEventListener('click', () => {
      const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity());
      const streakMatches = PH.computeCurrentStreakMatches(matches, currentIdentity());
      if (!streakMatches.length) return; // sin racha activa, no hay nada que filtrar
      const matchIds = new Set(streakMatches.map((m) => m.matchId));
      openHistoryScreen('player-home', { type: 'streak', matchIds, label: 'Racha actual' });
    });
    $('#player-home-effectiveness-card').addEventListener('click', () => {
      openHistoryScreen('player-home', { type: 'effectiveness', label: 'Efectividad' });
    });
    $('#widget-partner-card').addEventListener('click', () => openPersonListScreen('partners'));
    $('#widget-rival-card').addEventListener('click', () => openPersonListScreen('rivals'));
  }

  function initPlayerHomeScreen() {
    // V02.1 (§8) — el logo del Home es puramente identificatorio: antes navegaba a
    // Configurar partido, un acceso oculto y redundante con el "+" central.
    $('#active-match-banner').addEventListener('click', continueActiveMatch);
    initPlayerHomeLastMatchCard();
    initPlayerHomeMetricsNav();
    $('#player-home-bell-btn').addEventListener('click', openNotificationsScreen);
    // BRAMUlab_V03.5 (§4, Bloque 1) — acceso a RANKING BRAMU desde el header del Home.
    $('#player-home-ranking-btn').addEventListener('click', openRankingScreen);
    // V03.0.1 (§3) — tarjeta/nombre/foto del Home tappable → Perfil › MI PERFIL.
    const goToProfile = () => openProfileScreen('mi-perfil');
    $('#player-home-card').addEventListener('click', goToProfile);
    $('#player-home-card').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToProfile(); } });
    // BRAMUlab_V03.3 (§4) — "BUSCAR JUGADORES", al final del contenido principal del Home.
    $('#player-home-search-players-card').addEventListener('click', openPlayerSearchScreen);
  }

  /** V03.0.2 (§12) — Notificaciones: pantalla completa (reemplaza el popup "todavía no hay
   *  notificaciones" de Etapa 2). Modelo local por `userId` (Store.loadNotifications), nunca
   *  por nombre visible. Agrupación cronológica descendente: Hoy / Esta semana / Anteriores. */
  const NOTIF_CATEGORY_LABEL = { positive: 'Positivo', info: 'Informativo', pending: 'Pendiente', error: 'Error' };

  function renderNotificationsBadge() {
    const user = Store.getCurrentUser();
    const badge = $('#player-home-bell-badge');
    const count = user ? Store.countUnreadNotifications(user.id) : 0;
    badge.hidden = count === 0;
    badge.textContent = count > 9 ? '9+' : String(count);
  }

  function notifGroupLabel(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfCreatedDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const daysAgo = Math.round((startOfToday - startOfCreatedDay) / 86400000);
    if (daysAgo <= 0) return 'Hoy';
    if (daysAgo <= 7) return 'Esta semana';
    return 'Anteriores';
  }

  function renderNotificationsList() {
    const user = Store.getCurrentUser();
    const list = user ? Store.loadNotifications(user.id) : [];
    $('#notifications-empty').hidden = list.length > 0;
    if (!list.length) { $('#notifications-list').innerHTML = ''; return; }
    const groups = [];
    const groupIndex = {};
    list.forEach((n) => {
      const label = notifGroupLabel(n.createdAt);
      if (!(label in groupIndex)) { groupIndex[label] = groups.length; groups.push({ label, items: [] }); }
      groups[groupIndex[label]].items.push(n);
    });
    $('#notifications-list').innerHTML = groups.map((g) => `
      <div class="notif-group">
        <div class="notif-group__title">${g.label.toUpperCase()}</div>
        ${g.items.map((n) => `
          <button type="button" class="notif-item notif-item--${n.category} ${n.readAt ? '' : 'is-unread'}" data-id="${n.id}">
            <span class="notif-item__dot" aria-hidden="true"></span>
            <span class="notif-item__body">
              <span class="notif-item__title">${n.title}</span>
              <span class="notif-item__text">${n.body}</span>
              <span class="notif-item__time">${formatNotifTime(n.createdAt)}</span>
            </span>
          </button>
        `).join('')}
      </div>
    `).join('');
  }

  function formatNotifTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(d);
      return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(d);
    } catch (e) { return ''; }
  }

  function openNotificationsScreen() {
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderNotificationsList();
    showView('notifications');
  }

  function initNotificationsScreen() {
    $('#notifications-back-btn').addEventListener('click', () => openPlayerHome());
    $('#notifications-mark-all-btn').addEventListener('click', () => {
      const user = Store.getCurrentUser();
      if (!user) return;
      Store.markAllNotificationsRead(user.id);
      renderNotificationsList();
      renderNotificationsBadge();
    });
    $('#notifications-list').addEventListener('click', (e) => {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      const id = item.dataset.id;
      Store.markNotificationRead(id);
      item.classList.remove('is-unread');
      renderNotificationsBadge();
      const notif = Store.getCurrentUser() ? Store.loadNotifications(Store.getCurrentUser().id).find((n) => n.id === id) : null;
      if (notif && notif.action === 'profile') { openProfileScreen('mis-datos'); }
      else if (notif && notif.action === 'history') { openHistoryScreen('player-home'); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* BRAMUlab_V03.5 — RANKING BRAMU                                       */
  /* Bloque 1: estructura y navegación (tabs/selector/banda). Bloque 2:   */
  /* ranking establecido simulado — el cálculo puro (universo, orden,     */
  /* movimiento semanal, paginación, búsqueda) vive en ranking.js (RK);   */
  /* acá solo se orquesta DOM sobre lo que esas funciones devuelven,      */
  /* mismo criterio que Mis grupos/groups.js. Fuente funcional cerrada:   */
  /* docs/BRAMUlab/Ranking_BRAMU.md.                                      */
  /* ------------------------------------------------------------------ */
  const RANKING_SCOPE_TABS = [
    { key: 'mis-jugadores', label: 'Mis jugadores' },
    { key: 'local', label: 'Local' },
    { key: 'provincial', label: 'Provincial' },
    { key: 'pais', label: 'País' },
    { key: 'global', label: 'Global' },
  ];
  // Mismo criterio que historyOwnershipFilter (Historial): ámbito/tipo/banda viven en memoria
  // durante la sesión, sin resetear en cada apertura de la pantalla.
  // §6 — "Mis jugadores" abre por defecto durante el piloto.
  let rankingScopeFilter = 'mis-jugadores';
  let rankingTypeFilter = 'general'; // 'general' | 'nivel'
  let rankingBandFilter = 5; // banda inicial, ver rankingBandInitialized/renderRankingScreen
  let rankingBandInitialized = false;
  // Paginación/búsqueda, en cambio, SÍ arrancan de cero cada vez que se abre la pantalla o se
  // cambia de ámbito/tipo/banda (§12: entrar a una vista nueva siempre empieza por el bloque 1).
  let rankingLoadedBlocks = 1;
  let rankingSearchQuery = '';

  function renderRankingScopeTabs() {
    const wrap = $('#ranking-scope-tabs');
    wrap.innerHTML = RANKING_SCOPE_TABS.map((t) => {
      const active = rankingScopeFilter === t.key;
      return `<button type="button" class="history-tab${active ? ' is-active' : ''}" data-key="${t.key}" role="tab" aria-selected="${active}">${t.label}</button>`;
    }).join('');
    $all('#ranking-scope-tabs .history-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (rankingScopeFilter === btn.dataset.key) return;
        rankingScopeFilter = btn.dataset.key;
        renderRankingScopeTabs();
        onRankingFilterChanged();
      });
    });
  }

  // §7 — bandas fijas 1 a 10, misma clase visual que las chips de modo de Historial.
  function renderRankingBandChips() {
    const wrap = $('#ranking-band-chips');
    wrap.innerHTML = Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
      const active = rankingBandFilter === n;
      return `<button type="button" class="history-mode-chip${active ? ' is-active' : ''}" data-band="${n}" role="tab" aria-selected="${active}">Nivel ${n}</button>`;
    }).join('');
    $all('#ranking-band-chips .history-mode-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.band);
        if (rankingBandFilter === n) return;
        rankingBandFilter = n;
        renderRankingBandChips();
        onRankingFilterChanged();
      });
    });
  }

  function setRankingType(type) {
    rankingTypeFilter = type;
    $all('#ranking-type-selector .option-col').forEach((btn) => {
      const active = btn.dataset.value === type;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-checked', String(active));
    });
    $('#ranking-band-chips').hidden = type !== 'nivel';
  }

  /** Bloque 2 — universo/orden/movimiento de la combinación ámbito+tipo+banda ACTUALMENTE
   *  activa. El resto usa el universo mock determinístico de RK.buildScopeUniverseNames
   *  (§21: dataset simulado, claramente separable de una futura fuente real). El Nivel de
   *  CADA jugador —self incluido— es siempre PH.computeSimulatedJugadorLevel: Ranking nunca
   *  calcula ni modifica Nivel BRAMU, solo ordena lo que esa función ya devuelve.
   *
   *  `mis-jugadores`: Ranking_BRAMU.md §10.1 define el universo por jugadores con al menos un
   *  PARTIDO VALIDADO compartido — este prototipo todavía no tiene validación multiusuario
   *  real (ningún partido pasa por un estado "pendiente/validado/disputado", ver §16.2 del
   *  documento), así que no existe ese dato para leer. ML.computeRecentPlayers (partidos
   *  simplemente guardados, sin noción de validación) es la aproximación más cercana
   *  disponible hoy — es una SUSTITUCIÓN TEMPORAL de V03.5, no la regla final. Cuando exista
   *  backend con validación real, este universo debe reconstruirse a partir de los vínculos
   *  que esa validación produzca, no de esta función. */
  /** Bloque 3 — arma un participante SIN puesto (compañero de Mis jugadores calibrando o
   *  inactivo, §10.2): nunca pasa por RK.rankEntries (no tiene sentido ordenar algo sin
   *  posición). El Nivel mostrado es real (PH.computeSimulatedJugadorLevel) salvo en
   *  'sin-nivel', donde no existe todavía — mostrar cualquier número ahí sería inventarlo. */
  function buildUnrankedParticipant(name, history) {
    const status = RK.computeParticipantStatus(name, history);
    const level = status.key === 'sin-nivel' ? null : PH.computeSimulatedJugadorLevel(history, name);
    return { name, status, level };
  }

  function computeRankingView() {
    const scope = rankingScopeFilter;
    const isTerritorial = scope !== 'mis-jugadores';

    // §17/Bloque 3 — Global bloqueado: corta ACÁ, antes de armar ningún universo (nunca
    // simular un desbloqueo que el documento prohíbe expresamente).
    if (scope === 'global' && !RK.GLOBAL_UNLOCKED) {
      return { scope, isTerritorial, globalBlocked: true };
    }

    const history = Store.loadHistory();
    const user = Store.getCurrentUser();
    const selfStatus = RK.computeSelfStatus(user, history, isTerritorial);
    const myId = Store.normalizePlayerName(currentPlayerName);

    if (isTerritorial) {
      let allEntries = RK.buildRankingEntries(RK.buildScopeUniverseNames(scope), history, currentPlayerName, true);
      // Bloque 3 — solo CALIBRADO/RECALIBRANDO (acá: 'elegible') ocupa puesto (§6.2 regla 5).
      // Los mock territoriales son siempre elegibles por construcción; self se saca si no lo es.
      if (selfStatus.key !== 'elegible') allEntries = allEntries.filter((e) => !e.isMe);
      const universe = rankingTypeFilter === 'nivel' ? RK.bandFilter(allEntries, rankingBandFilter) : allEntries;
      const density = RK.computeTerritorialDensity(universe.length);
      if (density.level === 'insufficient') {
        return { scope, isTerritorial, selfStatus, density, totalCount: universe.length, ranked: [], movementMap: new Map(), myEntry: null, myId };
      }
      const ranked = RK.rankEntries(universe);
      const movementMap = RK.computeWeeklyMovement(universe);
      // Casos 4/7 — "fin de calibración"/"reingreso": self entra como Nuevo, nunca con una
      // variación calculada contra un corte que no lo incluía.
      if (selfStatus.isNew) movementMap.set(myId, { delta: null, label: 'Nuevo' });
      const myEntry = ranked.find((e) => e.id === myId) || null;
      return { scope, isTerritorial, selfStatus, density, ranked, movementMap, myEntry, myId, totalCount: ranked.length };
    }

    // Mis jugadores — cada compañero tiene SU PROPIO estado real (nunca el universo mock
    // territorial: acá todos son cuentas/partidos reales, ver ML.computeRecentPlayers).
    const names = ML.computeRecentPlayers(history, currentIdentity(), []);
    const participants = names.map((n) => ({ name: n, status: RK.computeParticipantStatus(n, history) }));
    const eligibleNames = participants.filter((p) => p.status.key === 'elegible').map((p) => p.name);
    const calibrandoNames = participants.filter((p) => p.status.key === 'sin-nivel' || p.status.key === 'calibrando').map((p) => p.name);
    const inactiveNames = participants.filter((p) => p.status.key === 'inactivo').map((p) => p.name);

    let allEntries = RK.buildRankingEntries(eligibleNames, history, currentPlayerName);
    if (selfStatus.key !== 'elegible') allEntries = allEntries.filter((e) => !e.isMe);
    const universe = rankingTypeFilter === 'nivel' ? RK.bandFilter(allEntries, rankingBandFilter) : allEntries;
    const density = RK.computeMisJugadoresDensity(universe.length);
    const ranked = density.level === 'empty' ? [] : RK.rankEntries(universe);
    const movementMap = density.level === 'established' ? RK.computeWeeklyMovement(universe) : new Map();
    if (selfStatus.isNew) movementMap.set(myId, { delta: null, label: 'Nuevo' });
    const myEntry = ranked.find((e) => e.id === myId) || null;

    return {
      scope, isTerritorial, selfStatus, density, ranked, movementMap, myEntry, myId,
      totalCount: universe.length,
      unrankedCalibrando: calibrandoNames.map((n) => buildUnrankedParticipant(n, history)),
      unrankedInactive: inactiveNames.map((n) => buildUnrankedParticipant(n, history)),
    };
  }

  function rankingContextLabel() {
    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === rankingScopeFilter) || {}).label || '';
    const typeLabel = rankingTypeFilter === 'nivel' ? `Nivel ${rankingBandFilter}` : 'General';
    return `${scopeLabel} · ${typeLabel}`;
  }

  /** Bloque 3 — acción del CTA de #ranking-state-card, guardada acá porque el botón se pinta
   *  de nuevo en cada render (siempre el mismo listener, ver initRankingScreen). */
  let rankingStateCtaAction = null;

  /** Bloque 3 (§19.3/Ranking_BRAMU.md §6.3) — copy de "estados propios": SIEMPRE en primera
   *  persona y privado (solo lo ve el propio usuario, nunca aparece en la fila de otro — "para
   *  terceros no exponer motivos privados de exclusión", pedido explícito del Bloque 3). */
  function selfStatusCopy(status, scopeLabel) {
    switch (status.key) {
      case 'opt-out':
        return { title: 'DESACTIVASTE EL RANKING', text: 'Desactivaste tu participación en el Ranking BRAMU. Podés reactivarla cuando quieras — tu Nivel BRAMU se mantiene igual.', cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos') };
      case 'perfil-privado':
        return { title: 'TU PERFIL ES PRIVADO', text: 'Con el perfil privado no ocupás posiciones en el Ranking BRAMU. Hacelo público para aparecer.', cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos') };
      case 'sin-nivel':
        return { title: 'TODAVÍA NO TENÉS NIVEL BRAMU', text: 'Jugá y guardá tu primer partido para que BRAMU empiece a calcular tu Nivel — recién ahí vas a poder ocupar una posición.', cta: 'IR AL INICIO', action: () => openPlayerHome() };
      case 'calibrando':
        return { title: 'CALIBRANDO', text: `${status.calib.progressText} · Todavía no ocupás una posición en el Ranking BRAMU.`, cta: null };
      case 'inactivo':
        return { title: 'SIN POSICIÓN POR INACTIVIDAD', text: 'Tu Nivel BRAMU se mantiene. Validá un nuevo partido para volver a aparecer.', cta: null };
      case 'sin-ubicacion':
        return { title: 'FALTA TU UBICACIÓN', text: `Elegí tu localidad principal de juego en MIS DATOS para aparecer en ${scopeLabel}.`, cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos') };
      default:
        return null;
    }
  }

  /** Ranking_BRAMU.md §11.2 — 0-4 elegibles: nunca publicar puestos, explicar cuántos faltan y
   *  ofrecer una salida (ámbito superior, o volver a General si la insuficiencia la causó el
   *  filtro de banda — Caso 10 del documento). */
  function territorialDensityCopy(view) {
    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === view.scope) || {}).label || '';
    const missing = view.density.missing;
    const text = `Hay ${view.totalCount} ${view.totalCount === 1 ? 'jugador elegible' : 'jugadores elegibles'} en ${scopeLabel}. Faltan ${missing} para habilitar la clasificación.`;
    if (rankingTypeFilter === 'nivel') {
      return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: 'VOLVER A GENERAL', action: () => { setRankingType('general'); onRankingFilterChanged(); } };
    }
    const NEXT_SCOPE = { local: 'provincial', provincial: 'pais' };
    const next = NEXT_SCOPE[view.scope];
    if (!next) return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: null };
    const nextLabel = (RANKING_SCOPE_TABS.find((t) => t.key === next) || {}).label || '';
    return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: `VER ${nextLabel.toUpperCase()}`, action: () => { rankingScopeFilter = next; renderRankingScopeTabs(); onRankingFilterChanged(); } };
  }

  /** Único punto de entrada para decidir si se muestra el contenido normal (Tu posición/Cerca
   *  tuyo/Clasificación) o una tarjeta de estado que lo reemplaza por completo — Global
   *  bloqueado > estado propio (privado, nunca visible para terceros) > densidad territorial
   *  insuficiente. Bloque 3, "estados de producto". */
  function renderRankingStateCard(view) {
    const globalBlocked = $('#ranking-global-blocked');
    const stateCard = $('#ranking-state-card');
    const normal = $('#ranking-normal-content');
    const helpBtn = $('#ranking-help-btn');

    if (view.globalBlocked) {
      globalBlocked.hidden = false;
      stateCard.hidden = true;
      normal.hidden = true;
      helpBtn.hidden = false;
      // Bloqueado: General/Por Nivel no tienen nada sobre qué actuar todavía.
      $('#ranking-type-selector').hidden = true;
      $('#ranking-band-chips').hidden = true;
      return;
    }
    $('#ranking-type-selector').hidden = false;
    if (rankingTypeFilter === 'nivel') $('#ranking-band-chips').hidden = false;
    globalBlocked.hidden = true;

    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === view.scope) || {}).label || '';
    let copy = selfStatusCopy(view.selfStatus, scopeLabel);
    if (!copy && view.isTerritorial && view.density.level === 'insufficient') copy = territorialDensityCopy(view);

    if (!copy) {
      stateCard.hidden = true;
      normal.hidden = false;
      helpBtn.hidden = false;
      return;
    }
    $('#ranking-state-title').textContent = copy.title;
    $('#ranking-state-text').textContent = copy.text;
    const cta = $('#ranking-state-cta');
    if (copy.cta) { cta.hidden = false; cta.textContent = copy.cta; rankingStateCtaAction = copy.action; }
    else { cta.hidden = true; rankingStateCtaAction = null; }
    stateCard.hidden = false;
    normal.hidden = true;
    helpBtn.hidden = false;
  }

  /** §9 — tarjeta compacta pero de alta jerarquía: puesto, denominador, Nivel BRAMU público,
   *  movimiento semanal simulado y contexto (mismo formato conceptual que el ejemplo del
   *  documento de versión: "#18 de 74 / Nivel BRAMU 5,4 / ↑3 esta semana / Local · General").
   *  Solo se llama cuando #ranking-normal-content está visible — renderRankingStateCard ya
   *  filtró self-no-elegible/densidad insuficiente/Global bloqueado antes de esto. */
  function renderRankingMyPosition(view) {
    const card = $('#ranking-my-position-card');
    const locateBtn = $('#ranking-locate-me-btn');
    if (!view.myEntry) { card.hidden = true; locateBtn.hidden = true; return; }
    card.hidden = false;

    // Ranking_BRAMU.md §10.2 — Mis jugadores con 1-2 elegibles: comparación simple, SIN "N de
    // total" ni movimiento semanal (no tiene sentido comparar contra un corte que tampoco
    // tenía puestos).
    if (!view.isTerritorial && view.density.level === 'simple') {
      card.innerHTML = `
        <div class="ranking-my-position__level">Nivel BRAMU <strong>${view.myEntry.level.toFixed(1)}</strong></div>
        <div class="ranking-my-position__context">Comparación entre ${view.totalCount} jugadores · Mis jugadores</div>
      `;
      locateBtn.hidden = true;
      return;
    }

    const mv = view.movementMap.get(view.myEntry.id) || { label: '—' };
    // §11.1 último inciso — 5-14 elegibles: "en formación", sin podio ni reconocimiento de
    // líder. Acá se limita a una etiqueta discreta junto al denominador, nunca un podio.
    const formingBadge = view.isTerritorial && view.density.level === 'forming'
      ? ' <span class="ranking-forming-badge">EN FORMACIÓN</span>' : '';
    card.innerHTML = `
      <div class="ranking-my-position__rank">
        <span class="ranking-my-position__pos">#${view.myEntry.position}</span>
        <span class="ranking-my-position__of">de ${view.totalCount}</span>${formingBadge}
      </div>
      <div class="ranking-my-position__level">Nivel BRAMU <strong>${view.myEntry.level.toFixed(1)}</strong></div>
      <div class="ranking-my-position__movement">${escapeHtml(mv.label)} esta semana</div>
      <div class="ranking-my-position__context">${escapeHtml(rankingContextLabel())}</div>
    `;
    locateBtn.hidden = false;
  }

  /** §11.1 — reutiliza EXACTAMENTE la fila de la tabla de Mis grupos (.group-table__row,
   *  buildGroupTableRowHTML en spíritu): posición, avatar, nombre + @usuario, contexto mínimo
   *  (localidad en Provincial/País/Global — Local/Mis jugadores no la necesitan, sería
   *  redundante) y Nivel BRAMU. Se agrega SOLO el indicador de movimiento semanal al lado —
   *  nunca efectividad/victorias/derrotas/rachas (§11.1, explícitamente prohibido en la fila).
   *  `showPosition:false` — Ranking_BRAMU.md §10.2, Mis jugadores con 1-2 elegibles: se
   *  muestran las filas pero SIN número de puesto ("comparación simple", nunca "1 de 2"). */
  function buildRankingRowHTML(entry, movementMap, opts) {
    const showPosition = !opts || opts.showPosition !== false;
    const mv = (movementMap && movementMap.get(entry.id)) || { label: '—' };
    const account = buildGroupRowAccount(entry.name);
    const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(entry.name);
    const caption = entry.locality ? `<span class="group-table__caption">${escapeHtml(entry.locality)}</span>` : '';
    const positionHTML = showPosition
      ? `<span class="group-table__position">${entry.position}</span>`
      : `<span class="group-table__position ranking-row__position--dash" aria-hidden="true">—</span>`;
    return `<button type="button" class="group-table__row ranking-row${entry.isMe ? ' is-me' : ''}" data-name="${escapeHtml(entry.name)}">
      ${positionHTML}
      ${buildGroupAvatarHTML(entry.name)}
      <span class="group-table__info">
        <span class="group-table__toprow">
          <span class="group-table__name">${escapeHtml(entry.name)}</span>
          <span class="group-table__handle">· ${escapeHtml(handle)}</span>
        </span>
        ${caption}
      </span>
      <span class="group-table__points">
        <span class="group-table__points-value">${entry.level.toFixed(1)}</span>
        <span class="group-table__points-label">NIVEL BRAMU</span>
      </span>
      ${showPosition ? `<span class="ranking-row__movement">${escapeHtml(mv.label)}</span>` : ''}
    </button>`;
  }

  /** Bloque 3 (Ranking_BRAMU.md §10.2) — compañero de Mis jugadores CALIBRANDO o INACTIVO:
   *  visible como vínculo, nunca con puesto numérico. Nivel BRAMU solo si ya existe una
   *  estimación real (calibrando/inactivo) — 'sin-nivel' no muestra ningún número. */
  function buildUnrankedRowHTML(p) {
    const account = buildGroupRowAccount(p.name);
    const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(p.name);
    const badge = p.status.key === 'calibrando' ? (p.status.calib.progressText || 'CALIBRANDO')
      : p.status.key === 'inactivo' ? 'SIN POSICIÓN POR INACTIVIDAD'
      : 'SIN NIVEL BRAMU';
    const levelHTML = p.level != null
      ? `<span class="group-table__points"><span class="group-table__points-value">${p.level.toFixed(1)}</span><span class="group-table__points-label">NIVEL BRAMU</span></span>`
      : '';
    return `<button type="button" class="group-table__row ranking-row" data-name="${escapeHtml(p.name)}">
      <span class="group-table__position ranking-row__position--dash" aria-hidden="true">—</span>
      ${buildGroupAvatarHTML(p.name)}
      <span class="group-table__info">
        <span class="group-table__toprow">
          <span class="group-table__name">${escapeHtml(p.name)}</span>
          <span class="group-table__handle">· ${escapeHtml(handle)}</span>
        </span>
        <span class="group-table__caption ranking-row__status-badge">${escapeHtml(badge)}</span>
      </span>
      ${levelHTML}
    </button>`;
  }

  /** §14 — misma regla que ya usa la tabla de Mis grupos (isOwnGroupTableRow): la fila propia
   *  abre MI PERFIL, cualquier otra abre el Perfil público existente — nunca una ficha nueva. */
  function wireRankingRowClicks(containerId) {
    $all(`#${containerId} .ranking-row`).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-me')) { openProfileScreen('mi-perfil'); return; }
        openPlayerPublicProfile(btn.dataset.name, 'ranking');
      });
    });
  }

  /** §10 — 2 puestos arriba / vos / 2 abajo, dentro del universo ACTUALMENTE filtrado (nunca
   *  un ranking aparte). Oculta en Mis jugadores con 1-2 elegibles (§10.2, "comparación
   *  simple" — con tan pocos jugadores ya se ven todos en Tu posición/Clasificación). */
  function renderRankingNearby(view) {
    const section = $('#ranking-nearby-section');
    const wrap = $('#ranking-nearby-list');
    if (!view.myEntry || (!view.isTerritorial && view.density.level === 'simple')) {
      section.hidden = true;
      wrap.innerHTML = '';
      return;
    }
    section.hidden = false;
    const nearby = RK.buildNearbyWindow(view.ranked, view.myEntry.id, 2);
    wrap.innerHTML = nearby.map((e) => buildRankingRowHTML(e, view.movementMap)).join('');
    wireRankingRowClicks('ranking-nearby-list');
  }

  /** id → "@usuario" (cuenta real) o el handle provisional derivado — mismo criterio que el
   *  resto de la app (buildGroupRowAccount/buildPlayerHandle), armado acá porque RK.filterEntriesBySearch
   *  es una función pura (sin Store) y necesita este mapa ya resuelto. */
  function rankingUsernameMap(entries) {
    const map = new Map();
    entries.forEach((e) => {
      const account = buildGroupRowAccount(e.name);
      map.set(e.id, account && account.username ? `@${account.username}` : buildPlayerHandle(e.name));
    });
    return map;
  }

  /** §11/§12/§13 — clasificación completa: con búsqueda activa se muestran TODOS los
   *  resultados que matchean (no tiene sentido paginarlos en bloques de 50, §13: "no modifica
   *  el cálculo del ranking"); sin búsqueda, se pagina en bloques de 50 (§12) — nunca cargar
   *  cientos de filas desde el inicio. Mis jugadores con 1-2 elegibles (§10.2): mismas filas,
   *  sin número de puesto. */
  function renderRankingClassification(view) {
    const showPosition = view.isTerritorial || view.density.level !== 'simple';
    $('#ranking-universe-count').textContent = showPosition
      ? `${view.totalCount} ${view.totalCount === 1 ? 'jugador elegible' : 'jugadores elegibles'}`
      : `Comparación entre ${view.totalCount} jugadores`;
    const wrap = $('#ranking-list');
    const empty = $('#ranking-list-empty');
    const loadMoreBtn = $('#ranking-load-more-btn');

    if (rankingSearchQuery) {
      const results = RK.filterEntriesBySearch(view.ranked, rankingSearchQuery, rankingUsernameMap(view.ranked));
      loadMoreBtn.hidden = true;
      const isEmpty = results.length === 0;
      wrap.hidden = isEmpty;
      empty.hidden = !isEmpty;
      if (isEmpty) { wrap.innerHTML = ''; $('#ranking-list-empty-text').textContent = `Sin resultados para “${rankingSearchQuery}”.`; return; }
      wrap.innerHTML = results.map((e) => buildRankingRowHTML(e, view.movementMap, { showPosition })).join('');
      wireRankingRowClicks('ranking-list');
      return;
    }

    const isEmpty = view.ranked.length === 0;
    wrap.hidden = isEmpty;
    empty.hidden = !isEmpty;
    loadMoreBtn.hidden = true;
    if (isEmpty) {
      wrap.innerHTML = '';
      $('#ranking-list-empty-text').textContent = rankingTypeFilter === 'nivel'
        ? `Todavía no hay jugadores elegibles en Nivel ${rankingBandFilter} acá.`
        : 'Todavía no hay jugadores elegibles en esta vista.';
      return;
    }
    if (!showPosition) {
      // §10.2 — comparación simple (1-2 elegibles): nunca son tantos como para paginar.
      wrap.innerHTML = view.ranked.map((e) => buildRankingRowHTML(e, view.movementMap, { showPosition: false })).join('');
      wireRankingRowClicks('ranking-list');
      return;
    }
    const visible = RK.paginate(view.ranked, rankingLoadedBlocks);
    wrap.innerHTML = visible.map((e) => buildRankingRowHTML(e, view.movementMap)).join('');
    wireRankingRowClicks('ranking-list');
    loadMoreBtn.hidden = visible.length >= view.ranked.length;
  }

  /** Bloque 3 — solo Mis jugadores: secciones CALIBRANDO/INACTIVOS, siempre sin puesto
   *  (§10.2). En cualquier otro ámbito quedan ocultas (el universo mock es siempre elegible). */
  function renderRankingUnrankedSections(view) {
    const calibrandoSection = $('#ranking-calibrando-section');
    const inactiveSection = $('#ranking-inactive-section');
    const calibrandoList = view.unrankedCalibrando || [];
    const inactiveList = view.unrankedInactive || [];
    calibrandoSection.hidden = calibrandoList.length === 0;
    inactiveSection.hidden = inactiveList.length === 0;
    if (calibrandoList.length) {
      $('#ranking-calibrando-list').innerHTML = calibrandoList.map(buildUnrankedRowHTML).join('');
      wireRankingRowClicks('ranking-calibrando-list');
    }
    if (inactiveList.length) {
      $('#ranking-inactive-list').innerHTML = inactiveList.map(buildUnrankedRowHTML).join('');
      wireRankingRowClicks('ranking-inactive-list');
    }
  }

  function renderRankingContent() {
    const view = computeRankingView();
    renderRankingStateCard(view);
    if (view.globalBlocked || $('#ranking-normal-content').hidden) return;
    renderRankingMyPosition(view);
    renderRankingNearby(view);
    renderRankingClassification(view);
    renderRankingUnrankedSections(view);
  }

  function onRankingFilterChanged() {
    rankingLoadedBlocks = 1;
    rankingSearchQuery = '';
    $('#ranking-search-input').value = '';
    renderRankingContent();
  }

  function onRankingSearchInput(value) {
    rankingSearchQuery = (value || '').trim();
    renderRankingClassification(computeRankingView());
  }

  /** §9 — "Verme en la clasificación": salta directo al bloque de 50 que contiene la posición
   *  del usuario (nunca obliga a tocar "cargar más" varias veces desde el puesto 1) y la
   *  resalta con scroll suave. Sale de cualquier búsqueda activa — el objetivo es ubicarse en
   *  la clasificación completa, no en un recorte de resultados que podría ni incluirla. */
  function locateMeInRanking() {
    const view = computeRankingView();
    if (!view.myEntry) return;
    rankingSearchQuery = '';
    $('#ranking-search-input').value = '';
    rankingLoadedBlocks = Math.max(rankingLoadedBlocks, RK.blockForPosition(view.myEntry.position));
    renderRankingClassification(view);
    requestAnimationFrame(() => {
      const el = $('#ranking-list .ranking-row.is-me');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function loadMoreRanking() {
    rankingLoadedBlocks += 1;
    renderRankingClassification(computeRankingView());
  }

  /** §7 — "por defecto se preselecciona la banda correspondiente al Nivel público del
   *  usuario": mismo Nivel simulado que ya usa el resto del prototipo (PH.computeSimulatedJugadorLevel),
   *  nunca una fórmula propia de Ranking. Se precarga UNA sola vez (primera apertura): si el
   *  usuario ya tocó el selector de banda, reabrir la pantalla no debe pisarle la elección. */
  function renderRankingScreen() {
    renderRankingScopeTabs();
    if (!rankingBandInitialized) {
      const level = PH.computeSimulatedJugadorLevel(Store.loadHistory(), currentPlayerName);
      rankingBandFilter = RK.bandForLevel(level);
      rankingBandInitialized = true;
    }
    renderRankingBandChips();
    setRankingType(rankingTypeFilter);
    rankingLoadedBlocks = 1;
    rankingSearchQuery = '';
    $('#ranking-search-input').value = '';
    renderRankingContent();
  }

  /** Bloque 3, §19 — mismo patrón abrir/cerrar que el resto de bottom sheets de la app
   *  (ver load-format-sheet/profile-location-sheet): scrim + clase `is-open` para la
   *  transición, cierra con la X, tocando el scrim o con Escape. */
  function openRankingHelpSheet() {
    $('#ranking-help-sheet-scrim').hidden = false;
    requestAnimationFrame(() => $('#ranking-help-sheet-scrim').classList.add('is-open'));
  }
  function closeRankingHelpSheet() {
    $('#ranking-help-sheet-scrim').classList.remove('is-open');
    $('#ranking-help-sheet-scrim').hidden = true;
  }

  function initRankingScreen() {
    // V03.0.3 (§7) — flecha restaurada, convive con la bottom nav; mismo criterio que el
    // resto de pantallas raíz (vuelve siempre a Home, sin origen especial).
    $('#ranking-back-btn').addEventListener('click', () => openPlayerHome());
    $all('#ranking-type-selector .option-col').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (rankingTypeFilter === btn.dataset.value) return;
        setRankingType(btn.dataset.value);
        onRankingFilterChanged();
      });
    });
    $('#ranking-locate-me-btn').addEventListener('click', locateMeInRanking);
    $('#ranking-load-more-btn').addEventListener('click', loadMoreRanking);
    $('#ranking-search-input').addEventListener('input', (e) => onRankingSearchInput(e.target.value));
    // Bloque 3 — CTA de #ranking-state-card: una sola acción guardada en rankingStateCtaAction,
    // reasignada en cada render (ver renderRankingStateCard/selfStatusCopy/territorialDensityCopy).
    $('#ranking-state-cta').addEventListener('click', () => { if (rankingStateCtaAction) rankingStateCtaAction(); });
    $('#ranking-help-btn').addEventListener('click', openRankingHelpSheet);
    $('#ranking-help-sheet-close').addEventListener('click', closeRankingHelpSheet);
    $('#ranking-help-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#ranking-help-sheet-scrim')) closeRankingHelpSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#ranking-help-sheet-scrim').hidden) closeRankingHelpSheet(); });
  }

  /* ------------------------------------------------------------------ */
  /* BRAMUlab_V03.4 — MIS GRUPOS                                          */
  /* Competencia privada, semanal, separada del Nivel BRAMU/Ranking BRAMU  */
  /* oficial (que no se implementa todavía — §1/§17 del consolidado). Todo */
  /* el cálculo (pertenencia, puntos, bonuses, tabla semanal, Race anual,  */
  /* BRAMU Intelligence grupal) vive en groups.js (`PG`, puro) — acá solo  */
  /* se orquesta DOM/navegación sobre lo que esas funciones devuelven,     */
  /* mismo criterio que el resto de la app.                                */
  /* ------------------------------------------------------------------ */
  let activeGroupId = null;
  let groupsActiveTab = 'actual'; // 'actual' | 'anterior' | 'race'
  let createGroupSelectedNames = []; // nombres normalizados elegidos en la hoja de selección
  let createGroupSheetMode = 'create'; // 'create' | 'add-members' (reutiliza la misma hoja)

  /** "MIS GRUPOS" es literalmente el subconjunto de `Store.loadGroups()` (lista GLOBAL, ver
   *  store.js) donde la identidad activa resuelve como miembro ACTIVO ahora mismo — mismo
   *  criterio de resolución (`userId` autoritativo, nombre como fallback) que el resto de la
   *  app usa para "es mío". */
  function myActiveGroups() {
    const ref = currentIdentity();
    const nowIso = new Date().toISOString();
    return Store.loadGroups().filter((g) => !!PG.findActiveMemberForPlayerRow(ref, g.members, nowIso));
  }

  function currentMemberOfGroup(group) {
    if (!group) return null;
    return PG.findActiveMemberForPlayerRow(currentIdentity(), group.members, new Date().toISOString());
  }

  function currentIsAdminOfGroup(group) {
    const mem = currentMemberOfGroup(group);
    return !!(mem && mem.isAdmin);
  }

  function openGroupsScreen() {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderGroupsScreen();
    showView('groups');
  }

  function renderGroupsScreen() {
    const groups = myActiveGroups();
    const isEmpty = groups.length === 0;
    $('#groups-empty').hidden = !isEmpty;
    $('#groups-content').hidden = isEmpty;
    if (isEmpty) { $('#groups-settings-btn').hidden = true; return; }
    if (!activeGroupId || !groups.some((g) => g.id === activeGroupId)) activeGroupId = groups[0].id;
    const activeGroup = Store.getGroupById(activeGroupId);
    // BRAMUlab_V03.4.2 (§1/§2) — un único selector "grupo activo ▾", siempre visible (incluso
    // con un solo grupo: también funciona como "acá estás parado"), reemplaza a los chips.
    $('#groups-current-selector-name').textContent = activeGroup ? activeGroup.name : '—';
    const isAdmin = currentIsAdminOfGroup(activeGroup);
    $('#groups-settings-btn').hidden = !isAdmin;
    // BRAMUlab_V03.4.1 (§7) — acción inequívoca "+ AGREGAR JUGADOR" al final del contenido
    // principal del grupo (además de Configuración) — nunca el header, que ya no tiene "+"
    // desde V03.4.2 (§2: esa acción se mudó entera al selector de arriba).
    $('#groups-add-member-btn').hidden = !isAdmin;
    renderActiveGroupPanels();
    setGroupsTab(groupsActiveTab);
  }

  /** BRAMUlab_V03.4.2 (§1) — hoja "MIS GRUPOS": todos los grupos del usuario (check en el
   *  activo) + "CREAR GRUPO" al final (mismo `.picker-sheet-option` para las filas de grupo
   *  que ya usa la hoja de selección genérica de MIS DATOS). Tocar un grupo cambia el activo y
   *  cierra; tocar "CREAR GRUPO" cierra esta hoja y abre la de siempre — un solo lugar
   *  resuelve cambiar Y crear, nunca dos acciones separadas. BRAMUlab_V03.4.5 (§1) — el label
   *  pierde el "+" inicial (quedaba redundante con el propio ícono/jerarquía del botón, ver
   *  styles.css `.btn-secondary--lime`); mismo estilo outline verde, sin cambios de tamaño,
   *  color, borde, padding ni ubicación.
   *  BRAMUlab_V03.4.4 (§2) — cada fila suma "· N jugadores" como segunda lectura (cuenta de
   *  miembros ACTIVOS del grupo, mismo criterio `PG.isMemberActiveAt` que ya usa
   *  renderGroupSettingsMembers — nunca cuenta a alguien que ya salió del grupo). §1 — "+ CREAR
   *  GRUPO" deja de ser texto suelto y pasa a `.btn-secondary--lime` (ver styles.css). */
  function renderGroupsSwitchList() {
    const groups = myActiveGroups();
    const nowIso = new Date().toISOString();
    const rows = groups.map((g) => {
      const active = g.id === activeGroupId;
      const memberCount = (g.members || []).filter((m) => PG.isMemberActiveAt(m, nowIso)).length;
      const memberLabel = memberCount === 1 ? '1 jugador' : `${memberCount} jugadores`;
      return `<button type="button" class="picker-sheet-option${active ? ' is-selected' : ''}" data-group-id="${escapeHtml(g.id)}">
        <span class="picker-sheet-option__text"><span class="picker-sheet-option__name">${escapeHtml(g.name)}</span><span class="picker-sheet-option__meta"> · ${memberLabel}</span></span>
        ${active ? '<span class="picker-sheet-option__check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
    $('#groups-switch-list').innerHTML = `${rows}<button type="button" class="btn-secondary btn-secondary--lime groups-switch-create-btn" id="groups-switch-create-btn">CREAR GRUPO</button>`;
    $all('#groups-switch-list .picker-sheet-option[data-group-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeGroupId = btn.dataset.groupId;
        closeGroupsSwitchSheet();
        renderGroupsScreen();
      });
    });
    $('#groups-switch-create-btn').addEventListener('click', () => {
      closeGroupsSwitchSheet();
      openCreateGroupSheet();
    });
  }
  function openGroupsSwitchSheet() {
    renderGroupsSwitchList();
    $('#groups-switch-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#groups-switch-sheet-scrim').classList.add('is-open'); });
  }
  function closeGroupsSwitchSheet() {
    const scrim = $('#groups-switch-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }

  function setGroupsTab(tab) {
    groupsActiveTab = ['actual', 'anterior', 'race'].indexOf(tab) !== -1 ? tab : 'actual';
    $all('#groups-view-tabs .history-tab').forEach((btn) => {
      const active = btn.dataset.view === groupsActiveTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    $('#groups-panel-actual').hidden = groupsActiveTab !== 'actual';
    $('#groups-panel-anterior').hidden = groupsActiveTab !== 'anterior';
    $('#groups-panel-race').hidden = groupsActiveTab !== 'race';
  }

  function renderGroupIntelligenceInto(listId, emptyId, insights) {
    const list = $(`#${listId}`);
    const empty = $(`#${emptyId}`);
    if (!insights.length) { list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    list.innerHTML = insights.map((text) => `<p class="groups-intel-item">${escapeHtml(text)}</p>`).join('');
  }

  /** BRAMUlab_V03.4.1 (§6) — bug real: la fila siempre mostraba la inicial, aunque el jugador
   *  tuviera una cuenta local real con foto de perfil cargada. Mismo criterio de búsqueda de
   *  cuenta que ya usa `renderPlayerPublicProfile` (por nombre visible normalizado — este
   *  prototipo no tiene más vínculo que ese entre "nombre en un partido" y "cuenta real"). */
  function buildGroupRowAccount(name) {
    return Store.loadUsers().find((u) => u && Store.normalizePlayerName(u.displayName) === Store.normalizePlayerName(name)) || null;
  }
  function buildGroupAvatarHTML(name) {
    const account = buildGroupRowAccount(name);
    if (account && account.profilePhoto) {
      return `<span class="person-list__avatar person-list__avatar--photo"><img src="${escapeHtml(account.profilePhoto)}" alt="" /></span>`;
    }
    return `<span class="person-list__avatar">${escapeHtml(playerInitials(name))}</span>`;
  }

  /** §11 — fila de la tabla principal: posición, avatar (foto real si existe, §6), nombre +
   *  `· @usuario` en la misma línea cuando entran (si no, el handle baja solo, ver
   *  `.group-table__toprow` en styles.css), segunda línea con partidos/V/D, y puntos grandes a
   *  la derecha. Nunca Nivel BRAMU/efectividad/mano/lado (§11 explícito). Tampoco la etiqueta
   *  ADMIN acá — §5 es tajante ("no mostrar privilegios administrativos como parte del ranking
   *  deportivo") y §5 mismo aclara que esa etiqueta discreta vive en Configuración, no en la
   *  tabla (ver renderGroupSettingsMembers). Tocar la fila abre el perfil público del jugador
   *  (§11, salvo la propia fila — ver isOwnGroupTableRow). */
  function buildGroupTableRowHTML(row) {
    const captionParts = [`${row.matchesCounted} ${row.matchesCounted === 1 ? 'partido' : 'partidos'}`];
    if (row.matchesCounted > 0) captionParts.push(`${row.wins} V`, `${row.losses} D`);
    const account = buildGroupRowAccount(row.name);
    const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(row.name);
    return `<button type="button" class="group-table__row${row.position === 1 && row.points > 0 ? ' group-table__row--top1' : ''}" data-name="${escapeHtml(row.name)}" data-user-id="${escapeHtml(row.userId || '')}">
      <span class="group-table__position">${row.position}</span>
      ${buildGroupAvatarHTML(row.name)}
      <span class="group-table__info">
        <span class="group-table__toprow">
          <span class="group-table__name">${escapeHtml(row.name)}</span>
          <span class="group-table__handle">· ${escapeHtml(handle)}</span>
        </span>
        <span class="group-table__caption">${captionParts.join(' · ')}</span>
      </span>
      <span class="group-table__points">
        <span class="group-table__points-value">${row.points}</span>
        <span class="group-table__points-label">PTS</span>
      </span>
    </button>`;
  }

  /** §11 — "tocar un jugador abre su perfil público". Para la propia fila (la identidad
   *  activa aparece en su propio grupo), el destino correcto es MI PERFIL, no el perfil
   *  público: `renderPlayerPublicProfile` busca partidos por NOMBRE plano
   *  (`PH.filterMatchesForPlayer(history, name)`), y un partido propio ya estampado con
   *  `userId` (regla de exclusividad de V03.0, ver player-home.js) nunca se encuentra por
   *  nombre solo — mostraría "0 partidos" para alguien con historial real. Antes de V03.4 esto
   *  nunca pasaba (Buscar Jugadores/JUGADORES excluyen siempre al propio jugador, ver
   *  ML.buildJugadorDirectory) — la tabla de un grupo es el primer lugar de la app donde la
   *  propia fila puede aparecer en una lista tocable. userId es autoritativo cuando existe
   *  (mismo criterio que el resto de la app); si la fila no tiene cuenta real, cae a comparar
   *  por nombre normalizado. */
  function isOwnGroupTableRow(name, userId) {
    const identity = currentIdentity();
    if (userId) return !!identity.userId && userId === identity.userId;
    return Store.normalizePlayerName(name) === Store.normalizePlayerName(identity.name);
  }

  function renderGroupTableInto(elId, emptyId, rows) {
    const wrap = $(`#${elId}`);
    const empty = $(`#${emptyId}`);
    const isEmpty = rows.length === 0;
    wrap.hidden = isEmpty;
    empty.hidden = !isEmpty;
    wrap.innerHTML = rows.map(buildGroupTableRowHTML).join('');
    $all(`#${elId} .group-table__row`).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isOwnGroupTableRow(btn.dataset.name, btn.dataset.userId)) { openProfileScreen('mi-perfil'); return; }
        openPlayerPublicProfile(btn.dataset.name, 'groups');
      });
    });
  }

  /** Arma ACTUAL/ANTERIOR/RACE ANUAL del grupo seleccionado en un solo lugar — las 3 pestañas
   *  se calculan siempre juntas (barato para el volumen de datos de este prototipo) para que
   *  cambiar de pestaña sea instantáneo, sin recalcular nada al tocarlas (ver setGroupsTab). */
  function renderActiveGroupPanels() {
    const group = Store.getGroupById(activeGroupId);
    if (!group) return;
    const fullHistory = Store.loadHistory();
    const now = new Date();
    const weekStart = PH.startOfWeekMonday(now);
    const prevWeekStart = new Date(weekStart.getTime() - PG.WEEK_MS);
    const prevPrevWeekStart = new Date(prevWeekStart.getTime() - PG.WEEK_MS);
    const year = now.getFullYear();

    const currentMatches = PG.computeMatchesForGroupInWeek(fullHistory, group, weekStart);
    const currentTable = PG.computeWeeklyTable(fullHistory, group, weekStart);
    const previousMatches = PG.computeMatchesForGroupInWeek(fullHistory, group, prevWeekStart);
    const previousTable = PG.computeWeeklyTable(fullHistory, group, prevWeekStart);
    const beforePreviousTable = PG.computeWeeklyTable(fullHistory, group, prevPrevWeekStart);
    const raceTable = PG.computeRaceAnual(fullHistory, group, year);

    // BRAMUlab_V03.4.2 (§4) — título fijo "BRAMU INTELLIGENCE" (en el HTML); acá solo se pinta
    // el nombre del grupo como segunda jerarquía, para que quede claro de QUÉ grupo está
    // hablando BRAMU sin repetir "EL MOMENTO" dos veces en la pantalla.
    $('#groups-intel-actual-title').textContent = group.name;
    $('#groups-intel-anterior-title').textContent = group.name;

    renderGroupIntelligenceInto('groups-intel-actual-list', 'groups-intel-actual-empty', PG.buildGroupIntelligence({
      currentTable, previousTable, raceTable, currentMatches, fullHistory,
    }));
    renderGroupTableInto('groups-table-actual', 'groups-table-actual-empty', currentTable);

    // ANTERIOR — misma función de BRAMU Intelligence, con el marco de la semana pasada como
    // "actual" (§12: "correspondiente a esa semana, si existe") y resultados ya congelados.
    renderGroupIntelligenceInto('groups-intel-anterior-list', 'groups-intel-anterior-empty', PG.buildGroupIntelligence({
      currentTable: previousTable, previousTable: beforePreviousTable, raceTable, currentMatches: previousMatches, fullHistory,
    }));
    renderGroupTableInto('groups-table-anterior', 'groups-table-anterior-empty', previousTable);

    $('#groups-race-year-label').textContent = `RACE ANUAL ${year}`;
    renderGroupTableInto('groups-table-race', 'groups-table-race-empty', raceTable);
  }

  function initGroupsScreen() {
    $('#groups-back-btn').addEventListener('click', () => openPlayerHome());
    $('#groups-settings-btn').addEventListener('click', openGroupSettingsScreen);
    $('#groups-add-member-btn').addEventListener('click', openAddMembersToGroupSheet);
    $('#groups-current-selector-btn').addEventListener('click', openGroupsSwitchSheet);
    $('#groups-switch-sheet-close').addEventListener('click', closeGroupsSwitchSheet);
    $('#groups-switch-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#groups-switch-sheet-scrim')) closeGroupsSwitchSheet(); });
    $all('#groups-view-tabs .history-tab').forEach((btn) => {
      btn.addEventListener('click', () => setGroupsTab(btn.dataset.view));
    });
    $('#groups-points-info-btn').addEventListener('click', openGroupPointsInfoSheet);
    $('#group-points-info-close').addEventListener('click', closeGroupPointsInfoSheet);
    $('#group-points-info-scrim').addEventListener('click', (e) => { if (e.target === $('#group-points-info-scrim')) closeGroupPointsInfoSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#group-points-info-scrim').hidden) closeGroupPointsInfoSheet();
      if (!$('#groups-switch-sheet-scrim').hidden) closeGroupsSwitchSheet();
    });
  }

  function openGroupPointsInfoSheet() {
    $('#group-points-info-scrim').hidden = false;
    requestAnimationFrame(() => { $('#group-points-info-scrim').classList.add('is-open'); });
  }
  function closeGroupPointsInfoSheet() {
    const scrim = $('#group-points-info-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }

  /* ---- Hoja "Crear grupo" / "Agregar jugadores" (misma hoja, dos modos) ---- */

  /** Fila de selección MÚLTIPLE — mismo componente único de fila que el resto de la app
   *  (`.player-row`, avatar/nombre/@usuario/Nivel BRAMU) más el círculo de check propio de
   *  esta variante (`.group-picker-row`, ver styles.css). Nunca un segundo componente de fila. */
  function buildGroupMemberPickerRowHTML(name, level, selected) {
    const levelText = Number.isFinite(level) ? level.toFixed(1) : '—';
    const checkSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l5 5L11 17 20 6"/></svg>';
    return `<button type="button" class="player-row group-picker-row${selected ? ' is-selected' : ''}" data-name="${escapeHtml(name)}">
      <span class="group-picker-row__check" aria-hidden="true">${checkSvg}</span>
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">${escapeHtml(buildPlayerHandle(name))}</span>
      </span>
      <span class="player-row__level">
        <span class="player-row__level-value">${levelText}</span>
        <span class="player-row__level-label">NIVEL BRAMU</span>
      </span>
    </button>`;
  }

  function updateCreateGroupSelectedCount() {
    const n = createGroupSelectedNames.length;
    $('#create-group-selected-count').textContent = n === 0
      ? 'Ningún jugador seleccionado todavía.'
      : `${n} ${n === 1 ? 'jugador seleccionado' : 'jugadores seleccionados'}.`;
  }

  /** Universo de candidatos: mismo directorio que Buscar Jugadores (§16: reutilizar el sistema
   *  de JUGADORES de V03.3, nunca inventar una segunda fuente). En modo "agregar jugadores" a
   *  un grupo ya existente, se excluyen los que ya son miembros activos (no tiene sentido
   *  ofrecer agregar a alguien que ya está). */
  function renderCreateGroupPlayerList(query) {
    const history = Store.loadHistory();
    const pool = ML.buildJugadorDirectory(history, Store.loadPlayerNames(), currentPlayerName);
    let candidates = pool;
    if (createGroupSheetMode === 'add-members') {
      const group = Store.getGroupById(activeGroupId);
      const nowIso = new Date().toISOString();
      const activeNames = new Set((group ? group.members : [])
        .filter((m) => PG.isMemberActiveAt(m, nowIso))
        .map((m) => Store.normalizePlayerName(m.name)));
      candidates = pool.filter((n) => !activeNames.has(Store.normalizePlayerName(n)));
    }
    const results = ML.filterPlayerCandidates(candidates, query, []);
    const wrap = $('#create-group-player-list');
    const isEmpty = results.length === 0;
    wrap.hidden = isEmpty;
    $('#create-group-player-empty').hidden = !isEmpty;
    wrap.innerHTML = results.map((n) => buildGroupMemberPickerRowHTML(
      n, PH.computeSimulatedJugadorLevel(history, n), createGroupSelectedNames.indexOf(Store.normalizePlayerName(n)) !== -1
    )).join('');
    $all('#create-group-player-list .group-picker-row').forEach((btn) => {
      btn.addEventListener('click', () => toggleCreateGroupSelection(btn.dataset.name));
    });
    updateCreateGroupSelectedCount();
  }

  function toggleCreateGroupSelection(name) {
    const norm = Store.normalizePlayerName(name);
    const idx = createGroupSelectedNames.indexOf(norm);
    if (idx === -1) createGroupSelectedNames.push(norm); else createGroupSelectedNames.splice(idx, 1);
    renderCreateGroupPlayerList($('#create-group-player-search').value);
  }

  function openCreateGroupSheetScrim() {
    $('#create-group-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#create-group-sheet-scrim').classList.add('is-open'); });
    $('#create-group-sheet-scroll').scrollTop = 0;
  }
  function closeCreateGroupSheet() {
    const scrim = $('#create-group-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }

  function openCreateGroupSheet() {
    createGroupSheetMode = 'create';
    createGroupSelectedNames = [];
    $('#create-group-name-field').hidden = false;
    $('#create-group-sheet-title').textContent = 'CREAR GRUPO';
    $('#create-group-players-label').textContent = 'Jugadores iniciales';
    $('#create-group-submit-btn').textContent = 'CREAR GRUPO';
    $('#create-group-name-input').value = '';
    $('#create-group-player-search').value = '';
    $('#create-group-error').hidden = true;
    renderCreateGroupPlayerList('');
    openCreateGroupSheetScrim();
  }

  /** §14 — "+ Agregar jugador" desde Configuración del grupo: misma hoja de selección
   *  múltiple de Crear grupo, sin el campo de nombre (el grupo ya tiene uno) y agregando
   *  directo al grupo seleccionado en vez de crear uno nuevo. */
  function openAddMembersToGroupSheet() {
    createGroupSheetMode = 'add-members';
    createGroupSelectedNames = [];
    $('#create-group-name-field').hidden = true;
    $('#create-group-sheet-title').textContent = 'AGREGAR JUGADORES';
    $('#create-group-players-label').textContent = 'Jugadores';
    $('#create-group-submit-btn').textContent = 'AGREGAR AL GRUPO';
    $('#create-group-player-search').value = '';
    $('#create-group-error').hidden = true;
    renderCreateGroupPlayerList('');
    openCreateGroupSheetScrim();
  }

  function submitCreateGroup() {
    if (createGroupSheetMode === 'add-members') {
      if (!createGroupSelectedNames.length) {
        $('#create-group-error').textContent = 'Elegí al menos un jugador.';
        $('#create-group-error').hidden = false;
        return;
      }
      const group = Store.getGroupById(activeGroupId);
      if (!group) { closeCreateGroupSheet(); return; }
      createGroupSelectedNames.forEach((n) => Store.addGroupMember(group.id, n));
      closeCreateGroupSheet();
      renderGroupSettingsMembers(Store.getGroupById(group.id));
      renderGroupsScreen();
      showToast('Jugadores agregados');
      return;
    }
    const name = $('#create-group-name-input').value.trim();
    if (!name) {
      $('#create-group-error').textContent = 'Ingresá un nombre para el grupo.';
      $('#create-group-error').hidden = false;
      return;
    }
    const user = Store.getCurrentUser();
    const group = Store.createGroup({
      name, creatorName: currentPlayerName, creatorUserId: user ? user.id : null,
      memberNames: createGroupSelectedNames,
    });
    closeCreateGroupSheet();
    activeGroupId = group.id;
    groupsActiveTab = 'actual';
    renderGroupsScreen();
    showToast('Grupo creado');
  }

  function initCreateGroupSheet() {
    // BRAMUlab_V03.4.2 (§2) — el header ya no tiene "+" (esa acción se mudó por completo a la
    // hoja "MIS GRUPOS", ver renderGroupsSwitchList) — el único punto de entrada directo que
    // queda es el estado vacío.
    $('#groups-empty-create-btn').addEventListener('click', openCreateGroupSheet);
    $('#create-group-sheet-close').addEventListener('click', closeCreateGroupSheet);
    $('#create-group-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#create-group-sheet-scrim')) closeCreateGroupSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#create-group-sheet-scrim').hidden) closeCreateGroupSheet(); });
    $('#create-group-player-search').addEventListener('input', (e) => renderCreateGroupPlayerList(e.target.value));
    $('#create-group-submit-btn').addEventListener('click', submitCreateGroup);
  }

  /* ---- Configuración del grupo (§14) — solo admins llegan acá (gear oculto si no). ---- */

  function openGroupSettingsScreen() {
    const group = Store.getGroupById(activeGroupId);
    if (!group || !currentIsAdminOfGroup(group)) return;
    $('#group-settings-name-display').textContent = group.name;
    $('#group-settings-name-display').hidden = false;
    $('#group-settings-name-input').hidden = true;
    renderGroupSettingsMembers(group);
    showView('group-settings');
  }

  /** BRAMUlab_V03.4.2 (§6) — reemplaza el botón grande "GUARDAR NOMBRE": tocar el lápiz
   *  alterna el nombre visible por un `<input>` en el mismo lugar; Enter o blur confirman,
   *  Escape cancela sin guardar (nunca pierde el nombre real por un blur accidental — si el
   *  campo queda vacío o sin cambios, simplemente vuelve a mostrar el nombre que ya estaba). */
  function enterGroupNameEditMode() {
    const group = Store.getGroupById(activeGroupId);
    if (!group) return;
    $('#group-settings-name-display').hidden = true;
    const input = $('#group-settings-name-input');
    input.hidden = false;
    input.value = group.name;
    input.focus();
    input.select();
  }
  function exitGroupNameEditMode(save) {
    const input = $('#group-settings-name-input');
    if (input.hidden) return; // ya se cerró (blur + Escape pueden disparar los dos en el mismo tick)
    const group = Store.getGroupById(activeGroupId);
    if (save && group) {
      const nextName = input.value.trim();
      if (nextName && nextName !== group.name) {
        Store.renameGroup(group.id, nextName);
        renderGroupsScreen();
        showToast('Nombre actualizado');
      }
    }
    const current = Store.getGroupById(activeGroupId);
    $('#group-settings-name-display').textContent = current ? current.name : (group ? group.name : '—');
    $('#group-settings-name-display').hidden = false;
    input.hidden = true;
  }

  /** BRAMUlab_V03.4.2 (§7) — "ELIMINAR GRUPO": nunca borra partidos (Store.deleteGroup solo
   *  saca al grupo de la lista, ver store.js) — vuelve a MIS GRUPOS, que se reacomoda solo
   *  (activeGroupId ya no matchea ningún grupo → renderGroupsScreen elige otro, o el estado
   *  vacío si no queda ninguno). */
  function handleDeleteGroup() {
    const group = Store.getGroupById(activeGroupId);
    if (!group) return;
    confirmAction(
      '¿Eliminar este grupo?',
      'Se eliminará el grupo para todos sus miembros. Esta acción no elimina los partidos de sus historiales.',
      () => {
        Store.deleteGroup(group.id);
        activeGroupId = null;
        showView('groups');
        renderGroupsScreen();
        showToast('Grupo eliminado');
      },
      null, 'Eliminar grupo', 'Cancelar', true
    );
  }

  /** §5 — cada fila de miembro con sus acciones de administrador inline. "Quitar admin"/
   *  "Quitar del grupo" quedan deshabilitadas (con explicación) sobre el único administrador
   *  activo — el guardrail real vive en Store (promoteGroupAdmin/demoteGroupAdmin/
   *  removeGroupMember, que devuelven `{ok:false}` igual si se intenta igual), esto es solo
   *  la señal visual para no dejar tocar un botón que de todos modos va a fallar. */
  function renderGroupSettingsMembers(group) {
    const nowIso = new Date().toISOString();
    const active = (group.members || []).filter((m) => PG.isMemberActiveAt(m, nowIso));
    const activeAdmins = active.filter((m) => m.isAdmin).length;
    const wrap = $('#group-settings-members-list');
    wrap.innerHTML = active.map((m) => {
      const isLastAdmin = m.isAdmin && activeAdmins === 1;
      const lastAdminAttrs = isLastAdmin ? ' disabled title="El grupo necesita al menos un administrador"' : '';
      return `<div class="group-settings-member" data-name="${escapeHtml(m.name)}">
        <span class="person-list__avatar">${escapeHtml(playerInitials(m.name))}</span>
        <span class="group-settings-member__info">
          <span class="group-settings-member__name">${escapeHtml(m.name)}${m.isAdmin ? '<span class="group-table__admin-tag">ADMIN</span>' : ''}</span>
        </span>
        <span class="group-settings-member__actions">
          ${m.isAdmin
            ? `<button type="button" class="link-btn" data-action="demote"${lastAdminAttrs}>Quitar admin</button>`
            : '<button type="button" class="link-btn" data-action="promote">Hacer admin</button>'}
          <button type="button" class="link-btn link-btn--danger" data-action="remove"${lastAdminAttrs}>Quitar del grupo</button>
        </span>
      </div>`;
    }).join('');
  }

  function handleGroupSettingsAction(action, name) {
    const group = Store.getGroupById(activeGroupId);
    if (!group) return;
    if (action === 'remove') {
      confirmAction(
        `¿Quitar a ${name} del grupo?`,
        'Sus resultados de semanas anteriores no se pierden.',
        () => {
          const r = Store.removeGroupMember(group.id, name);
          if (!r.ok) { showToast('El grupo necesita al menos un administrador.'); return; }
          renderGroupSettingsMembers(Store.getGroupById(group.id));
          renderGroupsScreen();
          showToast('Jugador quitado del grupo');
        },
        null, 'Quitar del grupo', 'Cancelar', true
      );
      return;
    }
    const result = action === 'promote' ? Store.promoteGroupAdmin(group.id, name)
      : action === 'demote' ? Store.demoteGroupAdmin(group.id, name) : null;
    if (result && !result.ok) { showToast('El grupo necesita al menos un administrador.'); return; }
    renderGroupSettingsMembers(Store.getGroupById(group.id));
    renderGroupsScreen();
  }

  function initGroupSettingsScreen() {
    $('#group-settings-back-btn').addEventListener('click', () => { renderGroupsScreen(); showView('groups'); });
    $('#group-settings-name-edit-btn').addEventListener('click', enterGroupNameEditMode);
    const nameInput = $('#group-settings-name-input');
    nameInput.addEventListener('blur', () => exitGroupNameEditMode(true));
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
      else if (e.key === 'Escape') { exitGroupNameEditMode(false); }
    });
    $('#group-settings-add-member-btn').addEventListener('click', openAddMembersToGroupSheet);
    $('#group-settings-members-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn || btn.disabled) return;
      const row = e.target.closest('.group-settings-member');
      handleGroupSettingsAction(btn.dataset.action, row.dataset.name);
    });
    $('#group-settings-delete-btn').addEventListener('click', handleDeleteGroup);
  }

  /* ------------------------------------------------------------------ */
  /* V02.1 (§22) — VISTAS "COMPAÑEROS" / "RIVALES"                        */
  /* Comparten estructura (person-list): avatar/inicial, nombre, partidos
   * juntos/enfrentados, victorias, derrotas, efectividad conjunta. Datos de
   * PH.computeTeammateBreakdown/computeRivalBreakdown (puras, player-home.js). */
  /* ------------------------------------------------------------------ */
  const PERSON_LIST_CONFIG = {
    partners: { title: 'COMPAÑEROS', countLabel: (n) => n === 1 ? '1 partido juntos' : `${n} partidos juntos` },
    rivals: { title: 'RIVALES', countLabel: (n) => n === 1 ? '1 enfrentamiento' : `${n} enfrentamientos` },
  };
  function openPersonListScreen(kind) {
    const cfg = PERSON_LIST_CONFIG[kind];
    $('#companions-title').textContent = cfg.title;
    const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity());
    const people = kind === 'partners' ? PH.computeTeammateBreakdown(matches, currentIdentity()) : PH.computeRivalBreakdown(matches, currentIdentity());
    const wrap = $('#companions-list');
    const isEmpty = people.length === 0;
    $('#companions-empty').hidden = !isEmpty;
    wrap.hidden = isEmpty;
    // V02.2 (Bloque H, §21) — resumen explícito en palabras completas (nunca "9V 2D") y la
    // efectividad SIEMPRE con su label debajo: nunca un "78%" suelto sin decir qué mide.
    wrap.innerHTML = people.map((p) => {
      const winsLabel = p.wins === 1 ? 'victoria' : 'victorias';
      const lossesLabel = p.losses === 1 ? 'derrota' : 'derrotas';
      return `
      <div class="person-list__item" data-name="${escapeHtml(p.name)}">
        <div class="person-list__avatar">${escapeHtml(playerInitials(p.name))}</div>
        <div class="person-list__info">
          <div class="person-list__name">${escapeHtml(p.name)}</div>
          <div class="person-list__caption">${cfg.countLabel(p.count)} · ${p.wins} ${winsLabel} · ${p.losses} ${lossesLabel}</div>
        </div>
        <div class="person-list__pct-wrap">
          <span class="person-list__pct">${p.pct === null ? '—' : p.pct + '%'}</span>
          <span class="person-list__pct-label">Efectividad</span>
        </div>
      </div>
    `;
    }).join('');
    // BRAMUlab_V03.3 (§10) — acceso #3 al perfil público: cada fila ya individualiza a UN
    // jugador real (nombre + récord conjunto), a diferencia de las tarjetas del Home que solo
    // muestran el mejor agregado — ver decisión documentada en el Informe.
    $all('#companions-list .person-list__item').forEach((el) => {
      el.addEventListener('click', () => openPlayerPublicProfile(el.dataset.name, 'companions'));
    });
    showView('companions');
  }
  function initCompanionsScreen() {
    $('#companions-back-btn').addEventListener('click', () => openPlayerHome());
  }

  /* ------------------------------------------------------------------ */
  /* BRAMUlab_V03.3 — SISTEMA DE JUGADORES                                */
  /* Primera experiencia de "jugadores" de BRAMU: buscar, ver el perfil    */
  /* público de otro jugador, agregarlo a una lista personal, y consultar  */
  /* esa lista desde Perfil. Sin amigos/seguidores/popularidad/mensajes    */
  /* (consolidado §1/§11) — la única relación es "agregado o no". Todo     */
  /* local/simulado (consolidado §9): reutiliza PH.filterMatchesForPlayer/ */
  /* computeEffectivenessTotal/computeBestWinStreakRange/computePeakLevel  */
  /* tal cual, con el NOMBRE del otro jugador en vez de la identidad       */
  /* propia — el mismo dato real que ya usan Home/MI PERFIL cuando ese     */
  /* jugador tiene partidos registrados en este dispositivo; si nunca      */
  /* jugó contra el usuario actual, PH.computeSimulatedJugadorLevel cae a  */
  /* un valor simulado pero determinístico (nunca "—", nunca al azar).     */
  /* ------------------------------------------------------------------ */

  /** §8 — lista JUGADORES dentro de Perfil: mismo componente de fila único que Buscar
   *  Jugadores/Elegir compañero-rival (buildPlayerRowHTML). Tocar una fila abre el perfil
   *  público de ese jugador. */
  /** Microparche V03.3.3 — buscador propio de JUGADORES: filtra SOLO entre los jugadores ya
   *  agregados por el usuario (nunca el universo completo, eso sigue siendo Buscar
   *  Jugadores/`ML.buildJugadorDirectory`) — reutiliza `ML.filterPlayerCandidates`, la misma
   *  función de substring normalizado que ya usan Buscar Jugadores y Elegir compañero/rival.
   *  Solo aparece si hay al menos un jugador agregado; con la lista vacía de entrada no hay
   *  nada que buscar todavía, se mantiene el estado vacío de siempre. */
  function renderJugadoresTab() {
    const user = Store.getCurrentUser();
    const allNames = user ? Store.loadAddedPlayers(user.id) : [];
    const hasAny = allNames.length > 0;
    $('#jugadores-search-wrap').hidden = !hasAny;
    $('#jugadores-empty').hidden = hasAny;
    if (!hasAny) {
      $('#jugadores-list').hidden = true;
      $('#jugadores-list').innerHTML = '';
      $('#jugadores-search-empty').hidden = true;
      return;
    }
    $('#jugadores-search-input').value = '';
    renderJugadoresList('');
  }

  function renderJugadoresList(query) {
    const user = Store.getCurrentUser();
    const allNames = user ? Store.loadAddedPlayers(user.id) : [];
    const history = Store.loadHistory();
    const filtered = ML.filterPlayerCandidates(allNames, query, []);
    const wrap = $('#jugadores-list');
    const isEmpty = filtered.length === 0;
    wrap.hidden = isEmpty;
    $('#jugadores-search-empty').hidden = !isEmpty;
    wrap.innerHTML = filtered.map((n) => buildPlayerRowHTML(n, PH.computeSimulatedJugadorLevel(history, n))).join('');
    $all('#jugadores-list .player-row').forEach((btn) => {
      btn.addEventListener('click', () => openPlayerPublicProfile(btn.dataset.name, 'jugadores-tab'));
    });
  }

  /** §5/§9 — universo completo de jugadores conocidos localmente (ML.buildJugadorDirectory,
   *  mismo criterio que ya usa el selector de compañero/rival), filtrado por `query` con
   *  ML.filterPlayerCandidates — query vacía muestra el directorio completo (sirve también
   *  como "explorar", no solo buscar).
   *  Microparche V03.3.2 (§1) — mismo patrón Recientes/Todos que ya usaba Elegir compañero/
   *  rival (ML.computeRecentPlayers), para que un nombre nunca aparezca sin explicación:
   *  "Recientes" son personas con las que ya se compartió cancha; "Todos" es el resto del
   *  universo conocido. Ambas etiquetas se ocultan mientras se busca (los resultados de una
   *  búsqueda ya se explican solos por el propio texto tecleado). */
  function renderPlayerSearchResults(query) {
    const history = Store.loadHistory();
    const pool = ML.buildJugadorDirectory(history, Store.loadPlayerNames(), currentPlayerName);
    const recentsSection = $('#player-search-recents-section');
    const recentsWrap = $('#player-search-recents');
    let recentNames = [];
    if (!query) {
      const recents = ML.computeRecentPlayers(history, currentIdentity(), []).slice(0, 12);
      recentNames = recents;
      if (recents.length) {
        recentsSection.hidden = false;
        recentsWrap.innerHTML = recents.map((n) => buildPlayerRowHTML(n, PH.computeSimulatedJugadorLevel(history, n))).join('');
        $all('#player-search-recents .player-row').forEach((btn) => {
          btn.addEventListener('click', () => openPlayerPublicProfile(btn.dataset.name, 'search'));
        });
      } else { recentsSection.hidden = true; recentsWrap.innerHTML = ''; }
    } else {
      recentsSection.hidden = true; recentsWrap.innerHTML = '';
    }

    const results = ML.filterPlayerCandidates(pool, query, query ? [] : recentNames);
    const listSection = $('#player-search-list-section');
    const wrap = $('#player-search-list');
    const isListEmpty = results.length === 0;
    listSection.hidden = isListEmpty;
    $('#player-search-list-label').hidden = !!query;
    wrap.innerHTML = results.map((n) => buildPlayerRowHTML(n, PH.computeSimulatedJugadorLevel(history, n))).join('');
    $all('#player-search-list .player-row').forEach((btn) => {
      btn.addEventListener('click', () => openPlayerPublicProfile(btn.dataset.name, 'search'));
    });

    $('#player-search-empty').hidden = !(isListEmpty && !recentNames.length);
  }

  /** §4/§5 — abre BUSCAR JUGADORES desde la tarjeta del Home. Mismo gate de sesión que el
   *  resto de las pantallas personales (openPlayerHome/openManualLoadScreen/openHistoryScreen). */
  function openPlayerSearchScreen() {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    $('#player-search-input').value = '';
    renderPlayerSearchResults('');
    showView('player-search');
    setTimeout(() => $('#player-search-input').focus(), 60);
  }

  function initPlayerSearchScreen() {
    $('#player-search-back-btn').addEventListener('click', () => openPlayerHome());
    $('#player-search-input').addEventListener('input', (e) => renderPlayerSearchResults(e.target.value));
  }

  /** §2.3 — mismo componente donut que Home/MI PERFIL (`.effectiveness-donut`), con ids
   *  propios — mismo criterio de "un render por pantalla" que ya separa
   *  renderPlayerEffectiveness (Home, animado) de renderProfileEffectivenessDonut (MI PERFIL,
   *  sin animar): esta tercera copia tampoco anima (se pinta al abrir el perfil, nunca en un
   *  tick de una pantalla ya en foco). */
  function renderPlayerPublicEffectivenessDonut(eff) {
    const ring = $('#player-public-effectiveness-ring');
    const glow = $('#player-public-effectiveness-glow');
    const circles = [ring, glow];
    const circumference = 2 * Math.PI * 15.5;
    circles.forEach((c) => { c.style.strokeDasharray = `${circumference}`; });
    if (eff.pct === null) {
      circles.forEach((c) => { c.style.opacity = '0'; });
      $('#player-public-effectiveness-value').textContent = '—';
      return;
    }
    ring.style.opacity = '1';
    glow.style.opacity = '';
    const filled = (eff.pct / 100) * circumference;
    const toOffset = circumference - filled;
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--home-anim-ease').trim() || 'ease-out';
    circles.forEach((c) => animateEffectivenessCircle(c, circumference, toOffset, ease));
    $('#player-public-effectiveness-value').textContent = `${eff.pct}%`;
  }

  /** §3 — AGREGAR JUGADOR/JUGADOR AGREGADO: reusa el sistema global de botones (§7 del
   *  consolidado de botones BRAMUlab_V03.2) — lima (`.btn-start`, acción principal) cuando
   *  todavía no está agregado, neutro (`.btn-secondary`) una vez agregado. Tocar de nuevo lo
   *  quita — sin confirmación: es una lista personal reversible, no una acción destructiva de
   *  datos de partido (consolidado §3: "sin crear un flujo complejo"). */
  /** Microparche V03.3 (§5) — "JUGADOR AGREGADO" ya no es un estado final (botón grande
   *  neutro): pasa a ser la acción para QUITARLO, con la misma jerarquía menor que ya usa
   *  "Eliminar partido" (`.analysis-delete-btn` — rojo, sin fondo/pastilla, claramente
   *  secundaria). AGREGAR sigue siendo `.btn-start` (acción principal positiva). */
  function renderPlayerPublicAddButton() {
    const user = Store.getCurrentUser();
    const btn = $('#player-public-add-btn');
    const added = !!(user && playerPublicName && Store.isPlayerAdded(user.id, playerPublicName));
    btn.textContent = added ? 'ELIMINAR DE JUGADORES' : 'AGREGAR JUGADOR';
    btn.classList.toggle('btn-start', !added);
    btn.classList.toggle('analysis-delete-btn', added);
  }

  let playerPublicName = null;
  let playerPublicOrigin = 'search'; // 'search' | 'jugadores-tab' | 'companions' — a dónde vuelve el back

  /** §2 — perfil público de `name`: identidad de solo lectura (sin tabs MI PERFIL/MIS DATOS,
   *  sin ningún dato privado) + rendimiento derivado del historial de este dispositivo. Si
   *  `name` corresponde a una cuenta local real (Store.loadUsers — poco común en este
   *  prototipo de un solo dispositivo, pero el modelo ya lo soporta), se muestran sus datos
   *  declarados reales (foto/edad/mano/lado); si es solo un nombre conocido por historial/
   *  selección manual, sin cuenta detrás, esos campos quedan en "—" — nunca inventados. */
  function renderPlayerPublicProfile() {
    const name = playerPublicName;
    if (!name) return;
    const history = Store.loadHistory();
    const account = Store.loadUsers().find((u) => u && Store.normalizePlayerName(u.displayName) === name);
    const username = account && account.username ? `@${account.username}` : buildPlayerHandle(name);

    // Microparche V03.3 (§3) — el título del header queda fijo ("PERFIL DE JUGADOR", en
    // index.html); el nombre visible sigue siendo protagonista dentro de la tarjeta de
    // identidad de abajo, nunca en el header.
    setAvatarPreview('player-public-avatar-img', 'player-public-avatar-initials', account && account.profilePhoto, name);
    $('#player-public-name').textContent = name;
    $('#player-public-username').textContent = username;

    const age = account ? PLI.calculateAge(account.birthDate) : null;
    $('#player-public-age').textContent = age !== null ? `${age} años` : '—';
    $('#player-public-hand').textContent = (account && HAND_LABELS[account.dominantHand]) || '—';
    $('#player-public-side').textContent = (account && SIDE_LABELS[account.preferredSide]) || '—';

    const level = PH.computeSimulatedJugadorLevel(history, name);
    $('#player-public-level-value').textContent = level.toFixed(1);

    const matches = PH.filterMatchesForPlayer(history, name);
    const eff = PH.computeEffectivenessTotal(matches, name);
    renderPlayerPublicEffectivenessDonut(eff);
    $('#player-public-played').textContent = String(matches.length);
    $('#player-public-won').textContent = String(eff.wins);

    const bestStreakRange = PH.computeBestWinStreakRange(matches, name);
    $('#player-public-best-streak').textContent = bestStreakRange ? `${bestStreakRange.count} ${bestStreakRange.count === 1 ? 'victoria' : 'victorias'}` : '—';
    $('#player-public-best-streak-range').hidden = !bestStreakRange;
    if (bestStreakRange) $('#player-public-best-streak-range').textContent = formatStreakRangeLabel(bestStreakRange.startDate, bestStreakRange.endDate);

    // Sin partidos considerados todavía, no hay ningún pico real que mostrar — el "mejor
    // nivel" trivialmente coincide con el actual (simulado), igual que le pasaría a cualquier
    // cuenta real sin historial: ACT, nunca una fecha inventada.
    const evolution = PH.computeLevelEvolution(history, name);
    const peak = evolution.consideredCount > 0 ? PH.computePeakLevel(evolution) : { value: level, isCurrent: true, date: null };
    $('#player-public-peak-level').textContent = peak.value.toFixed(1);
    $('#player-public-peak-level-context').textContent = peak.isCurrent ? 'ACT' : formatPeakLevelDate(peak.date);

    renderPlayerPublicAddButton();
  }

  /** §10 — accesos: Buscar jugadores, tab JUGADORES, filas de Compañeros/Rivales. `origin`
   *  decide a dónde vuelve el back (§10 no pide un histórico de navegación completo, solo que
   *  volver tenga sentido). */
  function openPlayerPublicProfile(name, origin) {
    const norm = Store.normalizePlayerName(name);
    if (!norm) return;
    playerPublicName = norm;
    playerPublicOrigin = origin || 'search';
    renderPlayerPublicProfile();
    showView('player-public');
  }

  function initPlayerPublicScreen() {
    $('#player-public-back-btn').addEventListener('click', () => {
      if (playerPublicOrigin === 'jugadores-tab') { openProfileScreen('jugadores'); return; }
      if (playerPublicOrigin === 'companions') { showView('companions'); return; }
      // BRAMUlab_V03.4 — fila de la tabla de un grupo: vuelve a MIS GRUPOS, nunca a Buscar
      // Jugadores (que ni siquiera es de dónde vino).
      if (playerPublicOrigin === 'groups') { showView('groups'); return; }
      // BRAMUlab_V03.5 (Bloque 2, §14) — fila del Ranking: vuelve al RANKING BRAMU, mismo
      // criterio que 'groups'. La pantalla no se re-renderiza (showView solo cambia
      // visibilidad) — banda/tipo/ámbito y el bloque ya cargado quedan tal cual estaban.
      if (playerPublicOrigin === 'ranking') { showView('ranking'); return; }
      showView('player-search');
    });
    // Microparche V03.3 (§4/§5) — feedback con el mismo toast chico de siempre, nunca un
    // modal: "Jugador agregado" (normal) / "Jugador eliminado" (variante roja, ver showToast).
    $('#player-public-add-btn').addEventListener('click', () => {
      const user = Store.getCurrentUser();
      if (!user || !playerPublicName) return;
      if (Store.isPlayerAdded(user.id, playerPublicName)) {
        Store.removePlayerFromList(user.id, playerPublicName);
        showToast('Jugador eliminado', undefined, 'danger');
      } else {
        Store.addPlayerToList(user.id, playerPublicName);
        showToast('Jugador agregado');
      }
      renderPlayerPublicAddButton();
    });
  }

  // V03.0.1 (§1) — nombres de pestaña como constante única (consolidado: "deben quedar
  // fáciles de cambiar posteriormente sin alterar lógica").
  // BRAMUlab_V03.3 (§8) — tercera pestaña JUGADORES (lista de agregados).
  const PROFILE_TAB_LABELS = { 'mi-perfil': 'MI PERFIL', 'mis-datos': 'MIS DATOS', jugadores: 'JUGADORES' };
  let profileActiveTab = 'mi-perfil';

  function setProfileTab(tab) {
    profileActiveTab = PROFILE_TAB_LABELS[tab] ? tab : 'mi-perfil';
    $('#profile-panel-mi-perfil').hidden = profileActiveTab !== 'mi-perfil';
    $('#profile-panel-mis-datos').hidden = profileActiveTab !== 'mis-datos';
    $('#profile-panel-jugadores').hidden = profileActiveTab !== 'jugadores';
    $('#profile-tab-mi-perfil').classList.toggle('is-active', profileActiveTab === 'mi-perfil');
    $('#profile-tab-mis-datos').classList.toggle('is-active', profileActiveTab === 'mis-datos');
    $('#profile-tab-jugadores').classList.toggle('is-active', profileActiveTab === 'jugadores');
    $('#profile-tab-mi-perfil').setAttribute('aria-selected', String(profileActiveTab === 'mi-perfil'));
    $('#profile-tab-mis-datos').setAttribute('aria-selected', String(profileActiveTab === 'mis-datos'));
    $('#profile-tab-jugadores').setAttribute('aria-selected', String(profileActiveTab === 'jugadores'));
  }

  /** V03.0.1 (§1) — Perfil pasa de una sola pantalla a 2 pestañas: MI PERFIL (ficha deportiva
   *  de lectura: avatar, nombre visible, @usuario, Nivel BRAMU/evolución, partidos,
   *  efectividad, racha) y MIS DATOS (identidad + datos personales/deportivos + acceso y
   *  seguridad). Toda la edición sigue viviendo en Editar Datos (nunca inline) — acá todo es
   *  de solo lectura. Nivel BRAMU/ranking/partidos/victorias/efectividad no son editables
   *  (consolidado §5 de V03.0, sin cambios). */
  function renderProfileView() {
    const user = Store.getCurrentUser();
    const name = Store.loadCurrentPlayerName();
    setAvatarPreview('profile-avatar-img', 'profile-avatar-initials', user && user.profilePhoto, name);
    $('#profile-display-name').textContent = (user && user.displayName) || name || '—';
    $('#profile-username').textContent = user && user.username ? `@${user.username}` : '—';
    const matches = name ? PH.filterMatchesForPlayer(Store.loadHistory(), currentIdentity()) : [];
    // V03.0.3 (§2) — "la cantidad de partidos puede salir de la cabecera y pasar al bloque de
    // estadísticas": #profile-match-count se retira de la cabecera, el conteo ahora vive en
    // #mi-perfil-played (bloque RENDIMIENTO, más abajo).

    // MI PERFIL — KPIs ya disponibles (misma fuente que el Home, nunca una segunda fórmula).
    // V03.1 (§6/§7) — Efectividad pasa de texto a donut protagonista (mismo componente visual
    // que la tarjeta de Efectividad del Home, ver renderProfileEffectivenessDonut); Partidos
    // jugados/ganados se muestran aparte, así que acá nunca se repite "14/18".
    const eff = PH.computeEffectivenessTotal(matches, currentIdentity());
    renderProfileEffectivenessDonut(eff);
    // V03.1 (§8/§10) — "principio de datos positivos": nunca un texto sobre la derrota (ni
    // siquiera "Sin racha en curso") — un simple "—" cuando no hay racha positiva en curso.
    const streak = PH.computeCurrentStreak(matches, currentIdentity());
    $('#profile-kpi-streak').textContent = streak.count > 0 ? `${streak.count} ${streak.count === 1 ? 'victoria seguida' : 'victorias seguidas'}` : '—';

    // V03.0.3 (§3) — "rendimiento ya calculable": jugados/ganados/mejor racha, misma fuente
    // que el resto de la app (PH.computeEffectivenessTotal ya cuenta ganados; computeBestWinStreak
    // ya existía —usado por Hitos— pero nunca se había expuesto en Perfil). Nunca una fórmula
    // nueva.
    $('#mi-perfil-played').textContent = String(matches.length);
    $('#mi-perfil-won').textContent = String(eff.wins);
    // V03.1 (§9) — "Mejor racha" suma contexto temporal breve (mes o rango de meses del tramo
    // real que definió esa racha) vía PH.computeBestWinStreakRange — mismo dato de siempre
    // (computeBestWinStreak), con su fecha real, nunca una fórmula nueva.
    const bestStreakRange = PH.computeBestWinStreakRange(matches, currentIdentity());
    $('#mi-perfil-best-streak').textContent = bestStreakRange ? `${bestStreakRange.count} ${bestStreakRange.count === 1 ? 'victoria' : 'victorias'}` : '—';
    $('#mi-perfil-best-streak-range').hidden = !bestStreakRange;
    if (bestStreakRange) $('#mi-perfil-best-streak-range').textContent = formatStreakRangeLabel(bestStreakRange.startDate, bestStreakRange.endDate);

    // MIS DATOS — Identidad (V03.1 §15: compacta, foto a la izquierda, nombre+apellido en UNA
    // línea — nombre y apellido siguen siendo 2 campos reales/editables por separado, ver
    // Editar Datos, solo se muestran juntos acá para ahorrar espacio vertical).
    const fullName = [user && user.firstName, user && user.lastName].filter(Boolean).join(' ');
    $('#profile-data-fullname').textContent = fullName || '—';
    $('#profile-data-username').textContent = user && user.username ? `@${user.username}` : '—';
    $('#profile-data-displayname').textContent = (user && user.displayName) || name || '—';
    setAvatarPreview('profile-data-avatar-img', 'profile-data-avatar-initials', user && user.profilePhoto, name);

    // MIS DATOS — Datos personales/deportivos (V03.1 §16: agrupado en filas compactas).
    const age = user ? PLI.calculateAge(user.birthDate) : null;
    $('#profile-birthdate').textContent = (user && user.birthDate) ? formatBirthDate(user.birthDate) : '—';
    $('#profile-age').textContent = age !== null ? `${age} años` : '—';
    $('#profile-gender').textContent = (user && GENDER_LABELS[user.gender]) || '—';
    $('#profile-hand').textContent = (user && HAND_LABELS[user.dominantHand]) || '—';
    $('#profile-side').textContent = (user && SIDE_LABELS[user.preferredSide]) || '—';
    // V03.1 (§4) — "Categoría declarada / 5ª · declarada el 08 SEP 26": categoría SOLO en MIS
    // DATOS (nunca en MI PERFIL, retirada de la ficha deportiva en §3), con su fecha real si
    // se conoce (cuentas ya existentes antes de esta ronda pueden tener categoría sin fecha —
    // se muestra solo la categoría en ese caso, nunca una fecha inventada).
    const categoryLabel = user && CATEGORY_LABELS[user.declaredCategory];
    const categoryDate = user && user.declaredCategoryAt ? formatDeclaredCategoryDate(user.declaredCategoryAt) : '';
    $('#profile-category').textContent = categoryLabel ? (categoryDate ? `${categoryLabel} · declarada el ${categoryDate}` : categoryLabel) : '—';
    // BRAMUlab_V03.4.1 (§9) — "Bella Vista, Buenos Aires", de solo lectura acá (se edita desde
    // Editar Datos). PLLocations.formatLocationLabel ya maneja el caso sin región.
    $('#profile-location').textContent = (user && user.locality) ? PLLocations.formatLocationLabel(user) : '—';

    // MI PERFIL — cabecera (V03.1 §2): Edad/Mano dominante/Lado habitual integrados en la
    // misma tarjeta de identidad, mismos 3 valores que arriba. La categoría NO se muestra acá
    // (§3): es un dato declarado privado, no identidad deportiva pública.
    $('#mi-perfil-age').textContent = age !== null ? `${age} años` : '—';
    $('#mi-perfil-hand').textContent = (user && HAND_LABELS[user.dominantHand]) || '—';
    $('#mi-perfil-side').textContent = (user && SIDE_LABELS[user.preferredSide]) || '—';

    // MIS DATOS — Acceso y seguridad.
    $('#profile-data-email').textContent = (user && user.email) || '—';
    const accessPending = !user || !user.email;
    $('#profile-access-pending').hidden = !accessPending;
    $('#profile-change-password-btn').hidden = accessPending;

    // V03.0.1 (§1) — aviso discreto "Completá tus datos": chequeo de presencia simple, sin
    // nueva lógica de negocio (nunca reemplaza al banner de acceso pendiente, que es sobre
    // email/contraseña, no sobre estos campos).
    const missing = [];
    if (user) {
      if (!user.firstName) missing.push('nombre');
      if (!user.birthDate) missing.push('fecha de nacimiento');
      if (!user.gender) missing.push('género');
      if (!user.dominantHand) missing.push('mano dominante');
      if (!user.preferredSide) missing.push('lado habitual');
      if (!user.declaredCategory) missing.push('categoría');
    }
    $('#profile-incomplete-banner').hidden = missing.length === 0;
    if (missing.length) {
      $('#profile-incomplete-text').textContent = `Todavía falta: ${missing.join(', ')}.`;
      // V03.0.2 (§12) — mismo chequeo de arriba, reusado para la notificación "perfil
      // incompleto" con deduplicación (addNotificationOnce: nunca una segunda mientras la
      // anterior siga sin leerse).
      Store.addNotificationOnce({
        userId: user.id, type: 'profile_incomplete', category: 'pending', dedupeKey: 'profile-incomplete',
        title: 'Tu perfil está incompleto', body: `Todavía falta: ${missing.join(', ')}.`, action: 'profile',
      });
      renderNotificationsBadge();
    }

    renderProfileEvolution(user);
    // BRAMUlab_V03.3 (§8) — JUGADORES: se renderiza siempre junto a las otras 2 pestañas
    // (mismo criterio que ya usa este función con MI PERFIL/MIS DATOS: las 3 se llenan al
    // abrir Perfil, setProfileTab solo alterna cuál queda visible).
    renderJugadoresTab();
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 4.1 (§4) — GRÁFICO DE EVOLUCIÓN DEL NIVEL BRAMU (Perfil)
   *  Consume PH.computeLevelEvolution (pura). El SVG se reconstruye entero en cada render
   *  (mismo patrón que el resto de los gráficos de la app — buildEvolutionSvgHTML/
   *  buildGamesEvolutionSvgHTML más arriba).
   *  V03.1 (§12) — línea limpia sin puntos ni interacción por partido: ya no hace falta
   *  guardar la última evolución renderizada para un detalle al tocar (retirado). */
  /* ------------------------------------------------------------------ */

  const LEVEL_CHART_WIDTH = 320;
  const LEVEL_CHART_HEIGHT = 180;
  const LEVEL_CHART_PAD_LEFT = 34;
  const LEVEL_CHART_PAD_RIGHT = 10;
  const LEVEL_CHART_PAD_TOP = 14;
  const LEVEL_CHART_PAD_BOTTOM = 22;
  // V03.1 (§14) — densidad adaptativa del eje X: "aproximadamente 4 a 8 referencias legibles"
  // (antes fijo en 5). La cantidad real de etiquetas mostradas sigue saliendo de
  // labelStep/isEdge más abajo — este es el techo.
  const LEVEL_CHART_MAX_X_LABELS = 7;

  /** V03.1.1 (§8) — formato de etiqueta del eje X según el rango real de fechas cubierto:
   *  rango corto/medio → fecha real día+mes ("08 SEP"); rango largo → solo mes ("SEP"). Nunca
   *  más "SEM X" (V03.1 lo usaba para ~1 mes; en uso real leía como un número inventado, sin
   *  relación directa con el calendario — se retira por completo, tal como pide el
   *  consolidado). El umbral de 200 días entre ambos formatos es el mismo que ya traía V03.1
   *  para el corte fecha/mes, reusado sin cambios. */
  function formatLevelAxisLabel(iso, spanDays) {
    if (spanDays <= 200) return formatAxisDayMonth(iso);
    return formatAxisMonthOnly(iso);
  }

  // V03.1 (§13) — rango Y adaptativo pero SIEMPRE en pasos de 0.25 (nunca un paso variable
  // como antes): 6 líneas de grilla (5 pasos = 1.25 de rango) cuando la serie real entra ahí
  // holgada; si la variación real es mayor, el rango crece en pasos de 0.25 hasta contenerla
  // (nunca aplasta la curva contra el borde). 0.25 es exacto en binario (IEEE754), así que la
  // aritmética de abajo no necesita redondeo de punto flotante.
  const LEVEL_Y_STEP = 0.25;
  const LEVEL_Y_MIN_LINES = 6;
  function computeLevelYAxis(levels) {
    const rawMin = Math.min(...levels);
    const rawMax = Math.max(...levels);
    const margin = LEVEL_Y_STEP; // medio paso de aire arriba/abajo antes de redondear a grilla
    let yMin = Math.floor((rawMin - margin) / LEVEL_Y_STEP) * LEVEL_Y_STEP;
    let yMax = Math.ceil((rawMax + margin) / LEVEL_Y_STEP) * LEVEL_Y_STEP;
    const minRange = LEVEL_Y_STEP * (LEVEL_Y_MIN_LINES - 1);
    if (yMax - yMin < minRange) {
      const padEach = Math.ceil(((minRange - (yMax - yMin)) / 2) / LEVEL_Y_STEP) * LEVEL_Y_STEP;
      yMin -= padEach;
      yMax = yMin + minRange;
    }
    return { yMin, yMax, step: LEVEL_Y_STEP };
  }

  /** §4.4 — línea temporal izquierda→derecha, un nivel mayor se dibuja más arriba.
   *  V03.0.2 (§6) — el `viewBox` es un ancho virtual FIJO (LEVEL_CHART_WIDTH) y el `<svg>` se
   *  renderiza a `width:100%` (ver .evolution-chart__svg) — siempre entra en el ancho
   *  disponible, sin importar cuántos partidos haya.
   *  V03.1 (§12) — "línea limpia, sin puntos, sin markers, sin tooltip por partido": se retiran
   *  los círculos por punto y toda interacción de click/teclado sobre ellos (ver
   *  initProfileScreen) — la lectura es SOLO la forma de la curva + los ejes. Con 1 solo punto
   *  no se dibuja ninguna línea (`coords.length > 1` — nunca "inventar una línea" con un solo
   *  dato real).
   *  BRAMUlab_V03.4.5 (§4) — BUG REAL en tablet: con un `viewBox` de ancho fijo (320) y el SVG
   *  renderizado a `width:100%`, un contenedor más ancho (tablet, ≥720px) escala TODO el
   *  sistema de coordenadas por igual — texto de ejes incluido, porque en SVG `font-size` vive
   *  en las mismas unidades del viewBox, no en píxeles reales. A 700px de contenedor eso es un
   *  factor ~2.2x: labels de 9px se veían de ~20px. `chartWidth` (medido en el DOM real, ver
   *  renderProfileEvolution) reemplaza la constante fija: el viewBox pasa a coincidir con el
   *  ancho renderizado real, así que la escala queda siempre ~1:1 y el texto no crece — el
   *  gráfico sí gana ancho real (más espacio entre puntos), la altura del viewBox no cambia. */
  function buildLevelEvolutionSvgHTML(evolution, chartWidth) {
    const points = evolution.points;
    if (!points.length) return '';
    const { yMin, yMax, step } = computeLevelYAxis(points.map((p) => p.level));
    const width = chartWidth || LEVEL_CHART_WIDTH;
    const plotW = width - LEVEL_CHART_PAD_LEFT - LEVEL_CHART_PAD_RIGHT;
    const plotH = LEVEL_CHART_HEIGHT - LEVEL_CHART_PAD_TOP - LEVEL_CHART_PAD_BOTTOM;
    const xAt = (i) => (points.length === 1 ? LEVEL_CHART_PAD_LEFT + plotW / 2 : LEVEL_CHART_PAD_LEFT + (i / (points.length - 1)) * plotW);
    const yAt = (level) => LEVEL_CHART_PAD_TOP + (1 - (level - yMin) / (yMax - yMin)) * plotH;

    // Eje Y: una línea de grilla por cada paso de 0.25 entre yMin y yMax (§13) — 2 decimales
    // en la etiqueta porque el paso ya no es siempre un múltiplo de 0.1 (6.25/6.75, etc.).
    const tickCount = Math.round((yMax - yMin) / step) + 1;
    const yValues = Array.from({ length: tickCount }, (_, i) => yMax - i * step);
    const gridHTML = yValues.map((value) => {
      const t = (yMax - value) / (yMax - yMin);
      const y = (LEVEL_CHART_PAD_TOP + t * plotH);
      return `<line x1="${LEVEL_CHART_PAD_LEFT}" y1="${y.toFixed(1)}" x2="${width}" y2="${y.toFixed(1)}" class="evolution-chart__grid" />`
        + `<text x="0" y="${y.toFixed(1)}" dy="3.5" class="evolution-chart__axis-label">${value.toFixed(2)}</text>`;
    }).join('');

    // Eje X: densidad adaptativa (§14), máximo LEVEL_CHART_MAX_X_LABELS etiquetas (siempre
    // incluye la primera y la última) — la densidad de la línea nunca se reduce, solo el texto.
    const firstDate = new Date(points[0].playedAt);
    const lastDate = new Date(points[points.length - 1].playedAt);
    const spanDays = Math.max(0, Math.round((lastDate - firstDate) / 86400000));
    const labelStep = Math.max(1, Math.ceil((points.length - 1) / (LEVEL_CHART_MAX_X_LABELS - 1)) || 1);
    // V03.1.1 (§8) — "sin repetir innecesariamente el mismo mes": si dos etiquetas
    // consecutivas mostradas caerían en el mismo texto (típico del rango "solo mes", donde
    // varios partidos comparten mes), se omite la repetida — salvo en los extremos (primero/
    // último), que siempre se muestran para anclar el rango visible aunque coincidan.
    let lastAxisLabel = null;
    const xLabelsHTML = points.map((p, i) => {
      const isEdge = i === 0 || i === points.length - 1;
      if (!isEdge && (i % labelStep !== 0)) return '';
      const text = formatLevelAxisLabel(p.playedAt, spanDays);
      if (!isEdge && text === lastAxisLabel) return '';
      lastAxisLabel = text;
      const x = xAt(i);
      const anchor = i === 0 ? 'start' : (i === points.length - 1 ? 'end' : 'middle');
      return `<text x="${x.toFixed(1)}" y="${LEVEL_CHART_HEIGHT}" class="evolution-chart__axis-label" text-anchor="${anchor}">${text}</text>`;
    }).join('');

    const coords = points.map((p, i) => [xAt(i), yAt(p.level)]);
    const pathD = coords.length > 1 ? 'M ' + coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') : '';
    const lineHTML = pathD ? `<path d="${pathD}" class="evolution-chart__line" fill="none" />` : '';

    return `<svg viewBox="0 0 ${width} ${LEVEL_CHART_HEIGHT}" class="evolution-chart__svg" preserveAspectRatio="xMidYMid meet">${gridHTML}${xLabelsHTML}${lineHTML}</svg>`;
  }

  /** V03.1.3 (§3) — "la línea debe dibujarse/progresar visualmente... breve y limpia...
   *  consistente con la animación de Efectividad": mismo truco de `stroke-dasharray`/
   *  `stroke-dashoffset` que ya usa `animateEffectivenessCircle` (acá sobre un `<path>` en vez
   *  de un `<circle>`, con `getTotalLength()` en vez de la circunferencia conocida), misma
   *  duración/curva (`EFFECTIVENESS_ANIM_MS`/`--home-anim-ease`) — nunca una animación nueva
   *  con su propio ritmo. Respeta `prefers-reduced-motion` (deja el trazo completo, sin
   *  animar). Sin puntos ni tooltips: la única interacción sigue siendo cero (§3, "no agregar
   *  puntos, tooltips ni interacción nueva"). */
  function animateEvolutionLine(pathEl) {
    if (!pathEl || typeof pathEl.getTotalLength !== 'function') return;
    let length;
    try { length = pathEl.getTotalLength(); } catch (e) { return; }
    if (!length) return;
    pathEl.style.strokeDasharray = `${length}`;
    pathEl.style.strokeDashoffset = '0';
    let prefersReducedMotion = false;
    try { prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* noop */ }
    if (prefersReducedMotion || typeof pathEl.animate !== 'function') return;
    const ease = getComputedStyle(document.documentElement).getPropertyValue('--home-anim-ease').trim() || 'ease-out';
    pathEl.animate(
      [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
      { duration: EFFECTIVENESS_ANIM_MS, easing: ease, fill: 'forwards' }
    );
  }

  /** V03.1.3 (§1) — "Mejor nivel BRAMU": mes+año abreviado del partido que alcanzó el pico
   *  (mismo criterio de fecha "contextual, no crítica" que formatDeclaredCategoryDate — Date
   *  local directa, sin partes con timezone). */
  function formatPeakLevelDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return `${COMPACT_MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    } catch (e) { return ''; }
  }

  /** §4.1 — resumen numérico + gráfico, simplificado (V03.1 §11): Nivel actual y cambio en
   *  los ÚLTIMOS 30 DÍAS (ya no "cambio acumulado desde la base", ni partidos considerados/
   *  mejor nivel — esos 2 últimos se retiran de esta cabecera por el pedido explícito de
   *  simplificación; sus cálculos siguen intactos y disponibles, solo dejan de mostrarse acá). */
  function renderProfileEvolution(user) {
    const history = Store.loadHistory();
    const evolution = PH.computeLevelEvolution(history, currentIdentity());

    // V03.0 (§2) — mismo gate que la Tarjeta de jugador del Home: cuentas legacy ven el
    // número simulado de siempre (sin cambios), cuentas nuevas V03.0 ven CALIBRANDO/
    // CALIBRACIÓN COMPLETA en vez de un gráfico numérico — la fórmula real todavía no existe.
    const isLegacy = !!(user && user.legacyMigrated);
    $('#evolution-numeric').hidden = !isLegacy;
    $('#evolution-calibration').hidden = isLegacy;
    // V03.1.3 (§1) — "Mejor nivel BRAMU" es otra lectura de la MISMA serie simulada. V03.1.4 —
    // se mudó DENTRO de #evolution-numeric (antes tarjeta propia en Rendimiento), así que
    // queda gateado gratis por el toggle de arriba — nunca necesitó su propio hidden.
    // V03.0.3 (§2) — cabecera de MI PERFIL (ficha deportiva): mismo gate y misma fuente que
    // la tarjeta del Home (nunca un número para cuentas en calibración).
    $('#mi-perfil-level-sub').hidden = isLegacy;
    if (!isLegacy) {
      const calib = PH.buildCalibrationStatus(evolution.consideredCount);
      $('#evolution-calibration-state').textContent = calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO';
      $('#evolution-calibration-progress').textContent = calib.complete ? '' : calib.progressText;
      $('#evolution-calibration-progress').hidden = calib.complete;
      $('#mi-perfil-level-value').textContent = calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO';
      $('#mi-perfil-level-sub').textContent = calib.complete ? '' : calib.progressText;
      $('#mi-perfil-level-sub').hidden = calib.complete;
      $('#mi-perfil-level-delta').className = 'player-card__level-delta player-card__level-delta--inline player-card__level-delta--flat';
      return;
    }

    $('#evolution-current-value').textContent = evolution.current.toFixed(1);
    // V03.1 (§11) — "Cambio últimos 30 días" reemplaza al cambio acumulado desde la base: si
    // dio 0 (nunca jugó en la ventana, o jugó pero volvió al mismo nivel), el valor pasa a "—"
    // y el label cambia a la frase completa pedida — nunca un "+0.0"/"↑0.0" ambiguo.
    const change30 = PH.computeLevelChangeLast30Days(evolution);
    const change = formatLevelDelta(change30);
    $('#evolution-change-value').textContent = change30 ? change.label : '—';
    $('#evolution-change-label').textContent = change30 ? 'Cambio últimos 30 días' : 'sin cambios en los últimos 30 días';

    $('#mi-perfil-level-value').textContent = evolution.current.toFixed(1);
    // V03.0.3.1 (§4) — cabecera de MI PERFIL muestra SOLO el Nivel BRAMU actual: se retira
    // "+X"/última subida/variación reciente de acá (siguen existiendo, sin cambios, en la
    // tarjeta del Home y en el detalle de Evolución más abajo — #evolution-change-value).
    $('#mi-perfil-level-delta').textContent = '';
    $('#mi-perfil-level-delta').className = 'player-card__level-delta player-card__level-delta--inline player-card__level-delta--flat';
    $('#mi-perfil-level-sub').hidden = true;

    // V03.1.3 (§1/§5) — "Mejor nivel BRAMU": pico histórico de la MISMA serie, nunca un
    // ranking contra otros usuarios. "ACT" cuando el pico coincide con el nivel actual;
    // si no, mes+año abreviado del partido que lo alcanzó (PH.computePeakLevel, pura).
    const peak = PH.computePeakLevel(evolution);
    $('#mi-perfil-peak-level').textContent = peak.value.toFixed(1);
    $('#mi-perfil-peak-level-context').textContent = peak.isCurrent ? 'ACT' : formatPeakLevelDate(peak.date);

    const wrap = $('#evolution-chart-wrap');
    if (!evolution.points.length) {
      wrap.innerHTML = '';
      $('#evolution-empty').hidden = false;
    } else {
      $('#evolution-empty').hidden = true;
      // BRAMUlab_V03.4.5 (§4) — ancho real del contenedor ANTES de insertar el SVG (todavía
      // vacío acá, así que medirlo no depende de su propio contenido) — ver comentario en
      // buildLevelEvolutionSvgHTML.
      // BRAMUlab_V03.4.6 — BUG REAL: `renderProfileView` (esta función lo llama) corre ANTES de
      // `showView('profile')` en los 3 call sites que existen (openProfileScreen, guardar en
      // Editar Datos, completar acceso) — en ese momento `#view-profile` todavía tiene `hidden`,
      // así que la medición de acá SIEMPRE daba 0 y el fallback de V03.4.5 caía de vuelta en
      // `LEVEL_CHART_WIDTH` (320), reproduciendo el bug de escala que esa ronda creía resuelto
      // (confirmado: el `getBoundingClientRect()` de un elemento dentro de un ancestro oculto
      // devuelve todo en 0). Un solo `requestAnimationFrame` alcanza — no cambia nada del orden
      // en los 3 call sites: para cuando el callback corre, `showView('profile')` ya se ejecutó
      // (mismo stack síncrono) y el layout real ya existe. Si el contenedor YA es visible en
      // el momento de este render (ej. `refreshAfterAvatarChange`, que nunca llama a `showView`
      // porque el usuario ya está parado en Perfil), se pinta de una sola vez, sin esperar un
      // frame de más.
      const paintChart = () => {
        const measuredWidth = Math.round(wrap.getBoundingClientRect().width);
        wrap.innerHTML = buildLevelEvolutionSvgHTML(evolution, measuredWidth || LEVEL_CHART_WIDTH);
        // V03.1.3 (§3) — animación sutil de entrada: la línea se dibuja progresivamente, mismo
        // mecanismo (Web Animations API sobre stroke-dashoffset) y misma duración/curva que la
        // Efectividad (EFFECTIVENESS_ANIM_MS/--home-anim-ease) — "consistente con la animación
        // de Efectividad" pedido por el consolidado. Sin puntos, sin tooltips: solo la curva.
        animateEvolutionLine(wrap.querySelector('.evolution-chart__line'));
      };
      if (wrap.getBoundingClientRect().width > 0) paintChart();
      else requestAnimationFrame(paintChart);
    }
  }

  /** V03.0.1 (§1/§7) — único punto de entrada a Perfil (bottom nav + tap al avatar del Home):
   *  gate interno igual a openPlayerHome/openManualLoadScreen (protección adicional, el
   *  ocultamiento visual de la barra ya lo maneja showView). `tab` abre directo en esa
   *  pestaña — MI PERFIL por defecto (consolidado §1: ícono Perfil y tap en el Home van
   *  ambos a MI PERFIL). */
  function openProfileScreen(tab) {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    setProfileTab(tab || 'mi-perfil');
    renderProfileView();
    showView('profile');
  }

  /** V03.0.1 (§7) — mismo gate, Ranking no tenía wrapper propio (solo showView('ranking')
   *  inline en initBottomNav) ni gate. */
  function openRankingScreen() {
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderRankingScreen();
    showView('ranking');
  }

  /** V03.0.3 (§2/§5) — foto editable directamente desde MI PERFIL y MIS DATOS (affordance
   *  chico, sin abrir el formulario completo de Editar Datos): tocar el avatar o su badge
   *  abre el selector de archivo, reusa exactamente `downscaleImageFileToDataUrl` (mismo
   *  upload+compresión que ya usa Editar Datos) y guarda directo con
   *  `Store.updateUserAccount` — un solo `profilePhoto` en toda la app, nunca una segunda
   *  fuente. Ambos puntos de entrada terminan en el mismo `refreshAfterAvatarChange`, así
   *  que MI PERFIL y MIS DATOS quedan sincronizados entre sí sin importar desde cuál se editó.
   *  V03.0.3.1 (§5) — "Quitar foto" se retira de estos dos puntos (control redundante); la
   *  foto sigue siendo reemplazable tocándola o vía el ícono cámara/lápiz. */
  function refreshAfterAvatarChange(toastMessage) {
    renderProfileView();
    showToast(toastMessage);
  }
  function wireInlineAvatarEdit(avatarId, fileInputId, editBtnId) {
    const avatar = $(`#${avatarId}`);
    const fileInput = $(`#${fileInputId}`);
    const editBtn = $(`#${editBtnId}`);
    const openPicker = () => fileInput.click();
    avatar.addEventListener('click', openPicker);
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); openPicker(); });
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const user = Store.getCurrentUser();
      if (!user) return;
      const dataUrl = await downscaleImageFileToDataUrl(file, 256, 0.7);
      Store.updateUserAccount(user.id, { profilePhoto: dataUrl });
      fileInput.value = '';
      refreshAfterAvatarChange('Foto actualizada');
    });
  }

  function initProfileScreen() {
    $('#profile-tab-mi-perfil').textContent = PROFILE_TAB_LABELS['mi-perfil'];
    $('#profile-tab-mis-datos').textContent = PROFILE_TAB_LABELS['mis-datos'];
    $('#profile-tab-jugadores').textContent = PROFILE_TAB_LABELS.jugadores;
    $('#profile-tab-mi-perfil').addEventListener('click', () => setProfileTab('mi-perfil'));
    $('#profile-tab-mis-datos').addEventListener('click', () => setProfileTab('mis-datos'));
    $('#profile-tab-jugadores').addEventListener('click', () => setProfileTab('jugadores'));
    // V03.0.3 (§7) — flecha restaurada, convive con la bottom nav.
    $('#profile-back-btn').addEventListener('click', () => openPlayerHome());
    $('#profile-logout-btn').addEventListener('click', requestLogout);
    $('#profile-complete-access-btn').addEventListener('click', openCompleteAccessModal);
    $('#profile-change-password-btn').addEventListener('click', openChangePasswordScreen);
    $('#profile-edit-btn').addEventListener('click', openProfileEditModal);
    wireInlineAvatarEdit('profile-avatar', 'mi-perfil-avatar-input', 'mi-perfil-avatar-edit-btn');
    wireInlineAvatarEdit('profile-data-avatar', 'mis-datos-avatar-input', 'mis-datos-avatar-edit-btn');
    // V03.1 (§12) — sin puntos por partido, sin interacción por punto: el gráfico ya no tiene
    // nada tocable (ver buildLevelEvolutionSvgHTML), así que este listener se retira entero.
    // BRAMUlab_V03.3 (§8) — estado vacío de JUGADORES: mismo patrón que #history-empty-action.
    $('#jugadores-empty-action').addEventListener('click', openPlayerSearchScreen);
    // Microparche V03.3.3 — buscador propio de JUGADORES (filtra solo la lista agregada).
    $('#jugadores-search-input').addEventListener('input', (e) => renderJugadoresList(e.target.value));
  }

  let profileEditPhotoDataUrl = null; // null = sin cambio; '' = "quitar foto" explícito
  let profileEditPhotoRemoved = false;
  // V03.0 — a nivel de módulo (no local a initProfileEditModal) para que openProfileEditModal
  // pueda RESETEARLAS en cada apertura: si quedaran como variables locales al inicializador,
  // un cambio de mano/lado seleccionado y cancelado sin guardar quedaría "pegado" la próxima
  // vez que se abre el modal, aunque la cuenta real no tenga ese campo cargado todavía.
  let profileEditHand = null;
  let profileEditSide = null;
  let profileEditGender = null; // V03.0.1 (§2) — mismo criterio que hand/side: género pasó de <select> a option-row.
  let profileEditCategory = null; // BRAMUlab_V03.4.1 (§10) — reemplaza al <select> nativo.
  let profileEditLocation = null; // BRAMUlab_V03.4.1 (§9) — { locality, region, country } | null.

  /** BRAMUlab_V03.4.1 (§10) — un único mapa para las 4 filas compactas de elección fija
   *  (Género/Mano dominante/Lado habitual/Categoría): mismas opciones/etiquetas de siempre
   *  (GENDER_LABELS/HAND_LABELS/SIDE_LABELS/CATEGORY_LABELS, sin cambios), la hoja
   *  `#profile-picker-sheet` se arma leyendo de acá — `openProfilePickerSheet` nunca
   *  necesita un caso especial por campo. get/set son closures sobre las variables de
   *  módulo de arriba (nunca se migran a un objeto: mínimo cambio de superficie, el resto de
   *  esta función ya las usa por nombre). */
  const PROFILE_PICKER_FIELDS = {
    gender: { title: 'GÉNERO', labels: GENDER_LABELS, rowValueId: 'profile-edit-gender-value', get: () => profileEditGender, set: (v) => { profileEditGender = v; } },
    hand: { title: 'MANO DOMINANTE', labels: HAND_LABELS, rowValueId: 'profile-edit-hand-value', get: () => profileEditHand, set: (v) => { profileEditHand = v; } },
    side: { title: 'LADO HABITUAL', labels: SIDE_LABELS, rowValueId: 'profile-edit-side-value', get: () => profileEditSide, set: (v) => { profileEditSide = v; } },
    category: { title: 'CATEGORÍA ACTUAL', labels: CATEGORY_LABELS, rowValueId: 'profile-edit-category-value', get: () => profileEditCategory, set: (v) => { profileEditCategory = v; } },
  };

  function updateProfileSelectRowDisplay(fieldKey) {
    const field = PROFILE_PICKER_FIELDS[fieldKey];
    const value = field.get();
    $(`#${field.rowValueId}`).textContent = value ? field.labels[value] : '—';
  }

  function updateProfileLocationRowDisplay() {
    $('#profile-edit-location-value').textContent = profileEditLocation ? PLLocations.formatLocationLabel(profileEditLocation) : '—';
  }

  /** V03.0 (§5) — abre la edición de Perfil precargada con los datos actuales del Usuario.
   *  Nunca edita inline la vista de Perfil — mismo patrón que el resto de la app.
   *  V03.0.1 (§2) — pasa de modal a pantalla completa (#view-edit-data). Nombre de función
   *  sin cambios a propósito (menor superficie de cambio) aunque ya no abre un modal. */
  function openProfileEditModal() {
    const user = Store.getCurrentUser();
    if (!user) return;
    profileEditPhotoDataUrl = null;
    profileEditPhotoRemoved = false;
    profileEditHand = user.dominantHand || null;
    profileEditSide = user.preferredSide || null;
    profileEditGender = user.gender || null;
    profileEditCategory = user.declaredCategory || null;
    profileEditLocation = user.locality ? { locality: user.locality, region: user.region || null, country: user.country || null } : null;
    setAvatarPreview('profile-edit-avatar-img', 'profile-edit-avatar-initials', user.profilePhoto, user.displayName);
    $('#profile-edit-avatar-remove-btn').hidden = !user.profilePhoto;
    $('#profile-edit-first-name').value = user.firstName || '';
    $('#profile-edit-last-name').value = user.lastName || '';
    $('#profile-edit-username').value = user.username || '';
    $('#profile-edit-username-feedback').textContent = '';
    $('#profile-edit-display-name').value = user.displayName || '';
    $('#profile-edit-birthdate').value = user.birthDate || '';
    updateProfileSelectRowDisplay('gender');
    updateProfileSelectRowDisplay('hand');
    updateProfileSelectRowDisplay('side');
    updateProfileSelectRowDisplay('category');
    updateProfileLocationRowDisplay();
    $('#profile-edit-error').hidden = true;
    showView('edit-data');
  }

  /** BRAMUlab_V03.4.1 (§10) — hoja única de selección, reutilizada para Género/Mano dominante/
   *  Lado habitual/Categoría (ver PROFILE_PICKER_FIELDS). Tocar una opción la selecciona Y
   *  cierra la hoja en el mismo toque — elección única, sin paso de "confirmar" aparte. */
  function openProfilePickerSheet(fieldKey) {
    const field = PROFILE_PICKER_FIELDS[fieldKey];
    const current = field.get();
    $('#profile-picker-sheet-title').textContent = field.title;
    $('#profile-picker-sheet-list').innerHTML = Object.keys(field.labels).map((key) => {
      const selected = key === current;
      return `<button type="button" class="picker-sheet-option${selected ? ' is-selected' : ''}" data-value="${escapeHtml(key)}">
        <span>${escapeHtml(field.labels[key])}</span>
        ${selected ? '<span class="picker-sheet-option__check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
    $all('#profile-picker-sheet-list .picker-sheet-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        field.set(btn.dataset.value);
        updateProfileSelectRowDisplay(fieldKey);
        closeProfilePickerSheet();
      });
    });
    $('#profile-picker-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#profile-picker-sheet-scrim').classList.add('is-open'); });
  }
  function closeProfilePickerSheet() {
    const scrim = $('#profile-picker-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }

  /** BRAMUlab_V03.4.2 (§8) — hoja "¿De dónde sos?": la fuente PRINCIPAL pasa a ser la API
   *  pública GeoRef (`PLLocations.searchLocationsRemote`, cubre toda Argentina); el dataset
   *  local de V03.4.1 queda como fallback MÍNIMO si la red falla — nunca como fuente primaria.
   *  Debounce de 300ms (nunca un fetch por tecla) + `AbortController` para descartar una
   *  respuesta vieja si el usuario ya tipeó algo más nuevo (nunca pinta resultados fuera de
   *  orden).
   *  BRAMUlab_V03.4.3 (§4) — la hoja arranca LIMPIA (ver `clearProfileLocationList`, usada al
   *  abrir y mientras hay menos de 2 caracteres): antes mostraba de entrada el dataset local
   *  completo como "para explorar", pero eso mezclaba justo la fuente que ahora es fallback
   *  con la experiencia normal de apertura — resultados recién aparecen cuando el usuario
   *  empieza a escribir de verdad. */
  let profileLocationSearchTimer = null;
  let profileLocationSearchController = null;

  /** Estado inicial / "todavía no escribiste lo suficiente" — DISTINTO de "buscaste y no había
   *  nada" (`#profile-location-empty`, que paintProfileLocationList sí puede mostrar): acá
   *  nunca se llegó a buscar, así que tampoco corresponde decir "Sin coincidencias". */
  function clearProfileLocationList() {
    const wrap = $('#profile-location-list');
    wrap.hidden = true;
    wrap.innerHTML = '';
    $('#profile-location-empty').hidden = true;
  }

  function paintProfileLocationList(results) {
    const wrap = $('#profile-location-list');
    const isEmpty = results.length === 0;
    wrap.hidden = isEmpty;
    $('#profile-location-empty').hidden = !isEmpty;
    wrap.innerHTML = results.map((loc) => {
      const label = PLLocations.formatLocationLabel(loc);
      const selected = !!profileEditLocation && profileEditLocation.locality === loc.locality && profileEditLocation.region === loc.region;
      return `<button type="button" class="picker-sheet-option${selected ? ' is-selected' : ''}" data-locality="${escapeHtml(loc.locality)}" data-region="${escapeHtml(loc.region || '')}" data-country="${escapeHtml(loc.country || '')}">
        <span>${escapeHtml(label)}</span>
        ${selected ? '<span class="picker-sheet-option__check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
    $all('#profile-location-list .picker-sheet-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        profileEditLocation = { locality: btn.dataset.locality, region: btn.dataset.region || null, country: btn.dataset.country || null };
        updateProfileLocationRowDisplay();
        closeProfileLocationSheet();
      });
    });
  }

  function setProfileLocationStatus(text) {
    const el = $('#profile-location-status');
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = text;
  }

  /** Único punto que decide qué mostrar según el largo de la búsqueda y el resultado real de
   *  GeoRef — nunca inventa una localidad ni oculta que está mostrando el fallback local. */
  async function searchProfileLocation(query) {
    const trimmed = (query || '').trim();
    if (profileLocationSearchController) profileLocationSearchController.abort();
    if (trimmed.length < 2) {
      setProfileLocationStatus('');
      clearProfileLocationList();
      return;
    }
    setProfileLocationStatus('Buscando…');
    profileLocationSearchController = new AbortController();
    const { signal } = profileLocationSearchController;
    try {
      const results = await PLLocations.searchLocationsRemote(trimmed, { signal });
      if (signal.aborted) return;
      setProfileLocationStatus('');
      paintProfileLocationList(results);
    } catch (err) {
      if (err && err.name === 'AbortError') return; // búsqueda vieja, cancelada por una más nueva
      setProfileLocationStatus('No pudimos conectar con el buscador. Mostrando resultados locales.');
      paintProfileLocationList(PLLocations.searchLocations(trimmed));
    }
  }

  function onProfileLocationSearchInput(query) {
    clearTimeout(profileLocationSearchTimer);
    profileLocationSearchTimer = setTimeout(() => searchProfileLocation(query), 300);
  }

  function openProfileLocationSheet() {
    $('#profile-location-search').value = '';
    setProfileLocationStatus('');
    clearProfileLocationList();
    $('#profile-location-sheet-scrim').hidden = false;
    requestAnimationFrame(() => { $('#profile-location-sheet-scrim').classList.add('is-open'); });
    setTimeout(() => $('#profile-location-search').focus(), 60);
  }
  function closeProfileLocationSheet() {
    clearTimeout(profileLocationSearchTimer);
    if (profileLocationSearchController) profileLocationSearchController.abort();
    const scrim = $('#profile-location-sheet-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
  }

  function initProfilePickerSheets() {
    $('#profile-edit-gender-row').addEventListener('click', () => openProfilePickerSheet('gender'));
    $('#profile-edit-hand-row').addEventListener('click', () => openProfilePickerSheet('hand'));
    $('#profile-edit-side-row').addEventListener('click', () => openProfilePickerSheet('side'));
    $('#profile-edit-category-row').addEventListener('click', () => openProfilePickerSheet('category'));
    $('#profile-picker-sheet-close').addEventListener('click', closeProfilePickerSheet);
    $('#profile-picker-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#profile-picker-sheet-scrim')) closeProfilePickerSheet(); });

    $('#profile-edit-location-row').addEventListener('click', openProfileLocationSheet);
    $('#profile-location-sheet-close').addEventListener('click', closeProfileLocationSheet);
    $('#profile-location-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#profile-location-sheet-scrim')) closeProfileLocationSheet(); });
    $('#profile-location-search').addEventListener('input', (e) => onProfileLocationSearchInput(e.target.value));

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#profile-picker-sheet-scrim').hidden) closeProfilePickerSheet();
      if (!$('#profile-location-sheet-scrim').hidden) closeProfileLocationSheet();
    });
  }

  function initProfileEditModal() {
    $('#profile-edit-username').addEventListener('input', () => {
      const user = Store.getCurrentUser();
      renderUsernameFeedback('profile-edit-username', 'profile-edit-username-feedback', user ? user.id : null);
    });

    $('#profile-edit-avatar-edit-btn').addEventListener('click', () => $('#profile-edit-avatar-input').click());
    $('#profile-edit-avatar-input').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      profileEditPhotoDataUrl = await downscaleImageFileToDataUrl(file, 256, 0.7);
      profileEditPhotoRemoved = false;
      setAvatarPreview('profile-edit-avatar-img', 'profile-edit-avatar-initials', profileEditPhotoDataUrl);
      $('#profile-edit-avatar-remove-btn').hidden = false;
    });
    $('#profile-edit-avatar-remove-btn').addEventListener('click', () => {
      profileEditPhotoDataUrl = null;
      profileEditPhotoRemoved = true;
      setAvatarPreview('profile-edit-avatar-img', 'profile-edit-avatar-initials', null, $('#profile-edit-display-name').value);
      $('#profile-edit-avatar-remove-btn').hidden = true;
    });

    $('#profile-edit-cancel').addEventListener('click', () => showView('profile'));
    $('#profile-edit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) { showView('profile'); return; }
      const username = $('#profile-edit-username').value.trim();
      const displayName = normalizePlayerName($('#profile-edit-display-name').value);
      const firstName = $('#profile-edit-first-name').value.trim();
      let error = null;
      if (!firstName) error = 'Ingresá al menos tu nombre.';
      else if (!displayName) error = 'El nombre visible no puede quedar vacío.';
      else if (!PLI.isValidUsernameFormat(username)) error = '@usuario: entre 3 y 20 caracteres, sin espacios.';
      else if (PLI.isUsernameTaken(username, Store.loadUsers(), user.id)) error = 'Ese @usuario ya está en uso.';
      if (error) { $('#profile-edit-error').textContent = error; $('#profile-edit-error').hidden = false; return; }

      // V03.1 (§4) — "fecha en la que fue declarada": se reestampa SOLO si el valor de
      // categoría cambia respecto al ya guardado. Guardar sin tocar el campo (o guardando
      // el mismo valor) conserva la fecha de declaración original.
      const nextCategory = profileEditCategory || null;
      const categoryChanged = nextCategory !== (user.declaredCategory || null);
      const patch = {
        firstName,
        lastName: $('#profile-edit-last-name').value.trim(),
        username,
        displayName,
        birthDate: $('#profile-edit-birthdate').value || null,
        gender: profileEditGender,
        dominantHand: profileEditHand,
        preferredSide: profileEditSide,
        declaredCategory: nextCategory,
        declaredCategoryAt: categoryChanged ? (nextCategory ? new Date().toISOString() : null) : (user.declaredCategoryAt || null),
        // BRAMUlab_V03.4.1 (§9) — `rankingLocalZone` nunca se toca desde acá (queda tal cual
        // estaba, `Store.updateUserAccount` solo mergea lo que sí se pasa en el patch).
        locality: profileEditLocation ? profileEditLocation.locality : null,
        region: profileEditLocation ? profileEditLocation.region : null,
        country: profileEditLocation ? profileEditLocation.country : null,
      };
      if (profileEditPhotoRemoved) patch.profilePhoto = null;
      else if (profileEditPhotoDataUrl) patch.profilePhoto = profileEditPhotoDataUrl;

      Store.updateUserAccount(user.id, patch);
      // V03.0 (§1) — cambiar el nombre visible YA NO desvincula el historial: los partidos que
      // ya tienen userId estampado siguen resolviendo por id (ver player-home.js). Se mantiene
      // CURRENT_PLAYER sincronizado solo por compatibilidad con los call sites que todavía
      // muestran ese string plano — nunca es la fuente de "es mío" desde V03.0.
      if (displayName) {
        Store.saveCurrentPlayerName(displayName);
        Store.rememberPlayerNames([displayName]);
      }
      syncCurrentIdentityFromStore();
      Store.addNotification({
        userId: user.id, type: 'profile_updated', category: 'info',
        title: 'Perfil actualizado', body: 'Guardaste cambios en tus datos.', action: 'profile',
      });
      renderProfileView();
      renderNotificationsBadge();
      showView('profile');
      showToast('Datos guardados');
    });
  }

  /* Etapa 2 (§4) — barra inferior fija: Inicio/Historial/+/Ranking/Perfil. Etapa 3 (Fase 2,
   *  §4/§8) — el "+" ahora abre la hoja "Registrar partido" (openRegisterSheet), que decide
   *  internamente su contenido según haya o no un partido en vivo activo; ya no abre
   *  Cargar partido jugado en forma directa (ese flujo sigue intacto, ahora un nivel adentro
   *  de la hoja). El atributo `data-nav="manual-load"` se deja igual a propósito — es solo
   *  un identificador interno, no cambia nada visible. */
  function initBottomNav() {
    $all('.bottom-nav__item[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'player-home') openPlayerHome();
        else if (target === 'history') openHistoryScreen('player-home');
        else if (target === 'manual-load') openRegisterSheet();
        else if (target === 'groups') openGroupsScreen();
        else if (target === 'profile') openProfileScreen('mi-perfil');
      });
    });
  }

  function updateBottomNavActive(viewName) {
    $all('.bottom-nav__item[data-nav]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.nav === viewName);
    });
  }

  /* ------------------------------------------------------------------ */
  /* COMPARTIR — V7 (Bloques 97-108 del consolidado).
     La exportación REUTILIZA los mismos componentes HTML/CSS de la propia
     app (los mismos builders que arman Resumen/Análisis en pantalla), en
     vez de redibujar una placa aparte con canvas nativo — así la imagen
     realmente se parece a BRAMU Lab. Se arma un DOM real, oculto fuera de
     pantalla, se convierte a SVG (foreignObject) y se rasteriza a PNG.
     Si el dispositivo no puede hacer esa conversión, se avisa con un error
     real (ver `shareResult`) — la vieja placa de respaldo dibujada a mano
     se eliminó en V8 a propósito, ver el comentario de `shareResult`.      */
  /* ------------------------------------------------------------------ */

  /** 99/100: arma el DOM (oculto) que se va a exportar, reutilizando exactamente los mismos
   *  builders que ya arman la pantalla — Resumen (99) o Análisis completo (100/108), con
   *  navegación/botones/tabs siempre excluidos. */
  function buildShareCaptureElement(f, kind) {
    const wrap = document.createElement('div');
    wrap.className = 'share-capture';

    const header = `<div class="share-capture__header"><span class="share-capture__brand"><span class="share-capture__brand-accent">BRAMU</span> <span class="share-capture__brand-sub">lab</span></span><span class="share-capture__kind">${kind === 'analisis' ? 'ANÁLISIS DEL PARTIDO' : 'RESUMEN DEL PARTIDO'}</span></div>`;
    // Etapa 3 (Fase 1) — fecha REAL jugada en la pieza compartida, no cuándo se guardó.
    const sharePlayedAt = PH.getPlayedAt(f);
    const footer = `<div class="share-capture__footer"><span>${formatRealDate(sharePlayedAt, f.timeZone)} · ${formatRealTime(sharePlayedAt, f.timeZone)}</span><span class="share-capture__brand-mini"><span class="share-capture__brand-mini-accent">BRAMU</span> lab</span></div>`;

    let body = '';
    if (kind === 'resumen') {
      // 99: misma composición que la pantalla de Resumen — ganador con color de equipo,
      // misma tarjeta de resultado, mismas estadísticas rápidas con barra y porcentaje.
      body = `<div class="share-capture__section">${buildWinnersBannerHTML(f)}${buildScoreCardHTML(f, { statsHTML: buildSummaryStatsHTML(f) })}${buildCoverageLegalHTML(f)}</div>`;
    } else {
      // 100/108: la vista PARTIDO completa de Análisis — resultado, BRAMU Intelligence
      // (el mismo texto ya generado, nunca uno nuevo), estadísticas, saque por jugador,
      // Evolución y Momentos Clave. Se excluyen tabs/links/botones (navegación).
      const stats = f.stats;
      body += `<div class="share-capture__section">${buildResultBlockHTML(f)}${buildCoverageLegalHTML(f)}</div>`;
      body += `<div class="share-capture__section"><h3 class="analysis-section__title">BRAMU INTELLIGENCE</h3><div class="intelligence-text">${(f.intelligence || '').split('\n\n').map((p) => `<p>${p}</p>`).join('')}</div></div>`;
      const legalText = buildStatsLegalText(stats);
      const partialNoteText = buildStatsPartialNoteText(stats);
      body += `<div class="share-capture__section"><h3 class="analysis-section__title">ESTADÍSTICAS</h3><div class="stats-grid">${buildStatsGridRowsHTML(f, stats)}</div>${legalText ? `<p class="coverage-note">${legalText}</p>` : ''}${partialNoteText ? `<p class="coverage-note">${partialNoteText}</p>` : ''}</div>`;
      const perPlayerHTML = buildPerPlayerServeRowsHTML(f, stats);
      if (perPlayerHTML) {
        body += `<div class="share-capture__section"><h4 class="analysis-subsection__title">SAQUE POR JUGADOR</h4><div>${perPlayerHTML}</div></div>`;
      }
      const evoShare = buildEvolutionSvgHTML(f, 'match');
      body += `<div class="share-capture__section"><h3 class="analysis-section__title">EVOLUCIÓN DEL PARTIDO</h3><div class="momentum-legend">${buildEvolutionLegendHTML(f, 'match')}</div><p class="coverage-note">${buildEvolutionCopyText()}</p>${evoShare.html}</div>`;
      if (f.highlights && f.highlights.length) {
        body += `<div class="share-capture__section"><h3 class="analysis-section__title">HIGHLIGHTS</h3>${buildHighlightsListHTML(f)}</div>`;
      }
      body += `<div class="share-capture__section"><h3 class="analysis-section__title">MOMENTOS CLAVE</h3><div class="keymoments-list">${buildKeyMomentsListHTML(f)}</div></div>`;
    }

    wrap.innerHTML = header + body + footer;
    // CORRECCIÓN (sección 11/40 de esta ronda): este nodo es el que se serializa TAL CUAL
    // dentro del SVG de exportación — por eso NUNCA puede llevar estilos de posicionamiento
    // u ocultamiento (position:fixed, left:-9999px, etc.). Ese era exactamente el bug: al
    // hacer `captureEl.outerHTML`, esos estilos viajaban adentro del SVG y el contenido
    // quedaba a -9999px también DENTRO del viewport exportado — una imagen en blanco (o,
    // si algo más fallaba en el camino, una caída silenciosa al respaldo viejo). El
    // ocultamiento fuera de pantalla ahora vive en un contenedor PADRE separado
    // (`buildShareImageBlob`), nunca en este nodo. Acá solo van estilos de layout/color.
    // BRAMUlab_V03.2 (§2) — BUG REAL: esta paleta quedó congelada desde antes de la migración
    // de tokens de V02.5/V02.6 (verde-negro heredado + verdes/celestes de equipo viejos, ver
    // comentario de arriba: "usar exactamente las mismas reglas visuales" — dejó de ser
    // cierto). La imagen compartida mostraba una marca distinta a la app real. Se reemplaza
    // por los valores ACTUALES de :root (styles.css) — azul noche + lima/azul BRAMU vigentes.
    wrap.style.cssText = 'width:540px; background:#050A12; display:block;'
      + '--ink:#050A12; --ink-soft:#09131F; --ink-softer:#0D1A2A; --paper:#F8FAFC;'
      + '--paper-dim:#9AA7B5; --paper-faint:#687482;'
      + '--team-a:#95FF19; --team-a-deep:#66B30F; --team-b:#199FFF; --team-b-deep:#0D6FCC;'
      + '--gold:#FFC93D; --star:#FFA93D; --danger:#FF5B61; --line:rgba(183,211,235,0.14);';
    return wrap;
  }

  let cachedShareStylesText = null;
  /** Trae el CSS real de la app (mismo origen, cacheado en el Service Worker) para que la
   *  imagen exportada use exactamente las mismas reglas visuales — nunca una hoja aparte.
   *  Si no se puede traer (p.ej. abierto con file://, sin servidor), se propaga el error para
   *  que `shareResult` lo informe (V8.2: ya NO hay fallback silencioso a ningún diseño
   *  alternativo — ver `shareResult`).
   *
   *  V8.2 (3-4): CORRECCIÓN de un bug real encontrado en auditoría. La regex anterior
   *  (`/@import[^;]+;/g`) asumía que el `@import` terminaba en el PRIMER ";" que
   *  encontrara, pero la propia URL de Google Fonts contiene ";" adentro (los pesos:
   *  `wght@500;700`). Eso cortaba la regla a la mitad y dejaba texto suelto e inválido
   *  (fragmentos de URL, "&" sueltos) flotando en el CSS que se inyecta después dentro
   *  del `<style>` del SVG.
   *  La nueva regex reconoce explícitamente la forma `@import url(...)` (o `@import "..."`)
   *  y consume TODO lo que hay dentro de `url(...)` como un bloque — sin importar cuántos
   *  ";" tenga adentro — antes de buscar el ";" que realmente cierra la sentencia. */
  function stripGoogleFontsImport(cssText) {
    let out = cssText.replace(/@import\s+(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*[^;]*;/g, '');
    // Red de seguridad (V8.2-44): si por algún motivo quedara un `@import` sin remover
    // (una forma de escritura no contemplada arriba), no lo dejamos pasar en silencio —
    // se elimina la línea completa como último recurso, nunca se ignora el problema.
    if (/@import/.test(out)) {
      out = out.split('\n').filter((line) => !/@import/.test(line)).join('\n');
    }
    return out;
  }
  async function fetchShareStylesText() {
    if (cachedShareStylesText) return cachedShareStylesText;
    const res = await fetch('styles.css');
    if (!res.ok) throw new Error('No se pudo obtener styles.css');
    let text = await res.text();
    if (!text) throw new Error('styles.css vacío');
    // El @import de Google Fonts puede bloquear/"manchar" el rasterizado en algunos
    // navegadores dentro de un SVG con foreignObject; los pesos ya están cargados por la
    // propia app en la página principal, así que no hace falta volver a importarlos acá.
    text = stripGoogleFontsImport(text);
    if (/@import/.test(text)) throw new Error('No se pudo eliminar por completo el @import de styles.css');
    cachedShareStylesText = text;
    return cachedShareStylesText;
  }

  /** V8.2 (4): escapa la secuencia literal "]]>" para que nunca pueda cerrar el bloque
   *  CDATA antes de tiempo (truco estándar de escapado de CDATA). En la práctica un CSS
   *  real casi nunca contiene esta secuencia, pero es una red de seguridad barata. */
  function escapeForCdata(text) {
    return text.split(']]>').join(']]]]><![CDATA[>');
  }

  function loadImageEl(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo rasterizar la imagen de Compartir (SVG inválido o bloqueado)'));
      img.src = src;
    });
  }

  /** V10 — Safari/iOS rasteriza de forma poco confiable un `<img>` apuntando a una URL
   *  `blob:` cuando el SVG contiene `foreignObject` (falla real reportada en iPhone: el
   *  toast de error de Compartir). Es un problema conocido de WebKit con esta técnica —
   *  el workaround estándar es convertir el Blob a una URI `data:` en base64 (FileReader
   *  maneja el UTF-8 correctamente, sin los problemas clásicos de btoa/encodeURIComponent
   *  a mano). Blob URLs siguen andando bien en Chrome/Firefox, así que este cambio no les
   *  afecta — solo hace más confiable el camino que hoy falla en Safari. */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo convertir el SVG de Compartir a data URI'));
      reader.readAsDataURL(blob);
    });
  }

  /** Arma el DOM real → SVG (foreignObject) → canvas → PNG. Lanza si el navegador no puede
   *  completar la conversión — el llamador (`shareResult`) nunca traga ese error en
   *  silencio, lo muestra como tal. */
  async function buildShareImageBlob(f, kind) {
    const captureEl = buildShareCaptureElement(f, kind);
    // CORRECCIÓN: el ocultamiento fuera de pantalla vive en un CONTENEDOR PADRE aparte —
    // nunca en `captureEl`, que es el único nodo cuyo marcado termina dentro del SVG
    // exportado. `width:0;height:0;overflow:hidden` en el host no afecta el ancho/alto real
    // de `captureEl` (tiene su propio `width:540px` explícito), solo evita que se vea en la
    // página mientras se mide y se serializa.
    const hiddenHost = document.createElement('div');
    hiddenHost.style.cssText = 'position:fixed; left:-9999px; top:0; width:0; height:0; overflow:hidden; pointer-events:none;';
    hiddenHost.appendChild(captureEl);
    document.body.appendChild(hiddenHost);
    try {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* seguir igual */ } }
      // V10: antes esperaba dos `requestAnimationFrame` para que el layout se asiente, pero
      // eso depende del bucle de repintado del navegador — se puede suspender indefinidamente
      // en pestañas/paneles no visibles o en ahorro de batería (posible causa real del error
      // de Compartir en iPhone). Leer `scrollHeight` ya fuerza un reflow SÍNCRONO por sí solo
      // (comportamiento estándar del DOM), así que no hace falta ningún frame de por medio —
      // un `setTimeout` mínimo alcanza como margen de seguridad y no depende de pintar nada.
      await new Promise((r) => setTimeout(r, 0));
      const cssWidth = 540;
      const cssHeight = Math.max(200, Math.ceil(captureEl.scrollHeight));
      if (!cssHeight || cssHeight < 50) throw new Error('El contenido a exportar midió una altura inválida (' + cssHeight + 'px)');
      const stylesText = await fetchShareStylesText();
      // XMLSerializer (no `outerHTML`) garantiza XML bien formado — escapa `&`/`<`/`>` sueltos
      // en nombres de jugadores u otro texto libre, algo que `outerHTML` NO garantiza y que
      // rompería el parseo del SVG (la imagen fallaría a cargar sin avisar por qué).
      const captureMarkup = new XMLSerializer().serializeToString(captureEl);
      // V8.2 (3-4): el CSS real puede traer caracteres XML crudos que NUNCA pasaron por el
      // escapado de XMLSerializer (ese solo protege `captureMarkup`, no `stylesText`) — por
      // ejemplo un "<" suelto dentro de un comentario CSS ("Break < Set < Match") o un "&"
      // suelto en una URL. Sin protección, cualquiera de los dos invalida el XML entero y
      // la imagen falla a cargar sin razón visible. Se envuelve en CDATA, que le dice al
      // parser XML "tratar todo esto como texto literal, no lo interpretes como markup".
      const safeStyles = escapeForCdata(stylesText);
      const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${cssWidth}" height="${cssHeight}">`
        + `<foreignObject x="0" y="0" width="${cssWidth}" height="${cssHeight}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${cssWidth}px;"><style type="text/css"><![CDATA[${safeStyles}]]></style>${captureMarkup}</div>`
        + `</foreignObject></svg>`;
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const svgDataUrl = await blobToDataURL(svgBlob);
      const img = await loadImageEl(svgDataUrl);
      // V10: `img.decode()` espera a que la imagen esté REALMENTE lista para dibujarse —
      // en Safari, `onload` puede disparar antes de que el contenido rasterizado del SVG
      // (con foreignObject) esté completamente decodificado, dejando un `drawImage` en
      // blanco sin ningún error visible. Si `decode()` no existe (navegador viejo), seguir
      // igual — `onload` ya disparó, es la mejor garantía disponible en ese caso.
      if (img.decode) { try { await img.decode(); } catch (e) { /* seguir con lo que haya */ } }
      const scale = 2; // 101: 1080px de ancho final (540 x 2)
      const canvas = document.createElement('canvas');
      canvas.width = cssWidth * scale;
      canvas.height = cssHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob() devolvió null'))), 'image/png');
      });
    } finally {
      hiddenHost.remove();
    }
  }

  function deliverShareBlob(blob, f) {
    const nameA = S.teamLabel(f.players, 'A'), nameB = S.teamLabel(f.players, 'B');
    const file = new File([blob], 'bramulab.png', { type: 'image/png' });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'BRAMU Lab', text: `${nameA} vs ${nameB}` }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'bramulab-resultado.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast('Imagen descargada');
    }
  }

  /** 103/104: fuente de datos SIEMPRE explícita — la resuelve quien llama a shareResult
   *  (Resumen en vivo → finishedSnapshot; Resumen histórico/Análisis → el snapshot abierto).
   *  V8 (7): la placa legacy dibujada a mano en canvas QUEDÓ ELIMINADA como salida normal.
   *  Antes, si la exportación DOM→SVG→PNG fallaba, se caía en silencio a un diseño no
   *  aprobado y el usuario terminaba con una imagen que "parecía" que Compartir había
   *  funcionado, pero con un diseño distinto al de la app. Ahora, si falla, se informa el
   *  error de verdad: el botón Compartir sigue disponible para reintentar, nunca se oculta
   *  ni se reemplaza por una versión distinta sin avisar. */
  async function shareResult(f, kind) {
    kind = kind === 'analisis' ? 'analisis' : 'resumen';
    if (!f) return;
    showToast('Generando imagen…');
    try {
      const blob = await buildShareImageBlob(f, kind);
      deliverShareBlob(blob, f);
    } catch (err) {
      // El error NUNCA se traga en silencio — queda en consola para poder diagnosticarlo.
      console.error('[BRAMU LAB] Compartir: la exportación DOM→SVG→PNG falló.', err);
      showToast('No se pudo generar la imagen para compartir. Probá de nuevo.', 4000);
    }
  }


  /* ------------------------------------------------------------------ */
  /* WIRING GENERAL                                                       */
  /* ------------------------------------------------------------------ */
  function initMatchInteractions() {
    $('#zone-a').addEventListener('click', () => { if (isGamesMode()) registerGameWin('A'); else registerPoint('A'); });
    $('#zone-b').addEventListener('click', () => { if (isGamesMode()) registerGameWin('B'); else registerPoint('B'); });
    $('#undo-btn').addEventListener('click', () => { if (isGamesMode()) undoLastGame(); else undoLastPoint(); });
    $('#highlight-btn').addEventListener('click', () => { if (isGamesMode()) saveHighlightGames(); else saveHighlight(); });
    $('#resume-btn').addEventListener('click', togglePause);
    $('#tiebreak-mode-select').addEventListener('change', (e) => {
      match.tiebreakMode = e.target.value;
      render();
    });
  }

  /** Correcciones postprueba de Fase 2 (§3.1) — pantalla predeterminada de arranque:
   *  - con un partido en vivo activo, reanuda directo (§6 de la fase original: "si la
   *    aplicación se cierra o recarga mientras se registra, al abrir nuevamente debe volver
   *    directamente a la misma pantalla" — reutiliza `continueActiveMatch()` tal cual, mismo
   *    camino que ya usan la franja/hoja/banner de Setup, cero estado nuevo);
   *  - sin partido activo, entra al Home del jugador — `openPlayerHome()` ya resuelve el
   *    caso "sin identidad todavía" (abre "¿Quién sos?" y, al completarlo, entra al Home).
   *  Antes de esta corrección la app siempre arrancaba en "Configurar partido" (`view-setup`),
   *  que ahora es una pantalla de acceso secundario (ver §3.1: solo se llega ahí desde
   *  "Registrar partido en vivo" en la hoja, o desde el link "Configurar partido" del Home). */
  function bootDefaultScreen() {
    const snap = Store.loadActiveMatch();
    if (snap && snap.match && !snap.finished) { continueActiveMatch(); return; }
    openPlayerHome();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // V03.0 (§8) — migración/bootstrap una sola vez, ANTES de cualquier init/render: si este
    // dispositivo ya tenía un jugador identificado antes de V03.0, queda logueado de
    // inmediato (nunca ve la pantalla de Acceso) con todo su historial ya vinculado por
    // userId. Nunca toca HISTORY/PLAYER_NAMES/ACTIVE_MATCH salvo agregar `userId` donde
    // corresponde (ver Store.migrateLegacyPlayerToUserIfNeeded).
    Store.migrateLegacyPlayerToUserIfNeeded();
    initSetupScreen();
    initMatchInteractions();
    initHighlightPopup();
    initMenu();
    initEditPlayersModal();
    initScoringSystemModal();
    initConfirmModal();
    initFinishModal();
    initEditModal();
    initQuickCorrectionModal();
    initAdjustModal();
    initServerCorrectionModal();
    initEtbModal();
    initGameTbModal();
    initGamesEditModal();
    initAnalysisScreen();
    initTimelineScreen();
    initHistoryScreen();
    initManualLoadScreen();
    initPlayerHomeScreen();
    initRankingScreen();
    initGroupsScreen();
    initCreateGroupSheet();
    initGroupSettingsScreen();
    initCompanionsScreen();
    initProfileScreen();
    initPlayerSearchScreen();
    initPlayerPublicScreen();
    initProfileEditModal();
    initProfilePickerSheets();
    initAccessScreen();
    initLoginScreen();
    initForgotPasswordScreen();
    initSignupWizard();
    initPlayerCardScreen();
    initCompleteAccessModal();
    initChangePasswordScreen();
    initNotificationsScreen();
    initLogoutWarningModal();
    initLogoutConfirmModal();
    initBottomNav();
    initRegisterSheet();
    initDiscardMatchModal();
    initMatchHeaderHomeLink();
    initDevTools();
    initUpdateCheck();
    bootDefaultScreen();
    registerServiceWorker();
  });

  /* ------------------------------------------------------------------ */
  /* PWA                                                                  */
  /* ------------------------------------------------------------------ */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline / file:// -> ignorar */ });
    }
  }

  /* ------------------------------------------------------------------ */
  /* V13.2 (§1) — WAKE LOCK: mantener la pantalla activa durante un partido en curso
   *  (Completo y Por Games por igual). Diagnóstico previo (V13.1 no tenía NINGÚN código de
   *  Wake Lock pese a lo que el reporte anterior daba a entender — el problema no era "el
   *  código no funciona", era que nunca se había implementado). Reglas:
   *  - se pide al entrar a la pantalla de partido (`enterMatchScreen`) y al reanudar uno
   *    finalizado manualmente o deshacer su cierre;
   *  - el sistema operativo libera el lock solo con pasar a background — eso es normal y
   *    esperado, no un error: al volver a foreground (`visibilitychange`), se vuelve a pedir
   *    automáticamente si el partido sigue activo;
   *  - se libera explícitamente al finalizar el partido o volver a Home;
   *  - si el navegador no soporta la API o el pedido falla, la app sigue funcionando igual —
   *    se registra en consola para debugging, nunca se le muestra un error al usuario. */
  /* ------------------------------------------------------------------ */
  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (wakeLockSentinel) return; // ya activo, no pedir dos veces
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        // Disparado tanto por `releaseWakeLock()` (abajo) como por el sistema operativo al
        // pasar a background — en ambos casos, solo hay que soltar la referencia; el
        // reintento (si corresponde) lo maneja el listener de `visibilitychange`.
        wakeLockSentinel = null;
      });
    } catch (e) {
      console.warn('[BRAMU LAB] No se pudo mantener la pantalla activa (Wake Lock no disponible o rechazado).', e);
      wakeLockSentinel = null;
    }
  }

  async function releaseWakeLock() {
    matchIsActive = false;
    if (!wakeLockSentinel) return;
    try { await wakeLockSentinel.release(); } catch (e) { /* noop — ya puede estar liberado */ }
    wakeLockSentinel = null;
  }

  /* ------------------------------------------------------------------ */
  /* V13.2 (§2) — CHEQUEO AUTOMÁTICO DE VERSIÓN: reemplaza la pulsación larga como mecanismo
   *  PRINCIPAL (esa queda como fallback manual, sin tocarla más — ver HERRAMIENTAS DE
   *  DESARROLLO más abajo). Se consulta `version.json` con `cache:'no-store'` — el service
   *  worker lo excluye explícitamente de su estrategia cache-first (ver sw.js) para que este
   *  chequeo nunca vea una copia vieja del propio archivo que existe para detectar eso. */
  /* ------------------------------------------------------------------ */
  async function checkForNewVersion() {
    try {
      const res = await fetch('version.json?_v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const remoteVersion = data && data.version;
      if (remoteVersion && remoteVersion !== Store.VERSION && remoteVersion !== dismissedUpdateVersion) {
        $('#update-available-text').textContent = `${remoteVersion} está disponible.`;
        $('#update-available-modal').dataset.version = remoteVersion;
        $('#update-available-modal').hidden = false;
      }
    } catch (e) {
      // offline, version.json no existe todavía en este deploy, o falló la red — nunca
      // molestar al usuario por esto, simplemente no se detectó actualización esta vez.
    }
  }

  function initUpdateCheck() {
    checkForNewVersion(); // §2: "al abrir BRAMU"
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      // §1: readquirir Wake Lock si el partido sigue activo (el SO lo libera en background).
      if (matchIsActive) requestWakeLock();
      // §2: "al volver a foreground" — nunca en cada render/click, ver arriba.
      checkForNewVersion();
    });
    $('#update-later-btn').addEventListener('click', () => {
      dismissedUpdateVersion = $('#update-available-modal').dataset.version || null;
      $('#update-available-modal').hidden = true;
    });
    $('#update-now-btn').addEventListener('click', forceUpdateApp);
  }

  /* ------------------------------------------------------------------ */
  /* V13.1 (§9) — HERRAMIENTAS DE DESARROLLO (discretas, fuera del flujo normal).
   *  Mantener presionado el logo de Home ~2s abre un modal chico con "Forzar
   *  actualización" — pensado para probar rápido en iPhone/PWA sin depender de un hard
   *  refresh de escritorio. Solo toca el service worker y la Cache Storage (los assets de
   *  la app); NUNCA localStorage — el partido en curso, el Historial y los nombres
   *  guardados quedan intactos. */
  /* ------------------------------------------------------------------ */
  const LONG_PRESS_MS = 1800;
  let longPressTimeoutId = null;

  function initDevTools() {
    const logo = $('#home-logo');
    const start = () => { clearTimeout(longPressTimeoutId); longPressTimeoutId = setTimeout(() => { $('#dev-tools-modal').hidden = false; }, LONG_PRESS_MS); };
    const cancel = () => clearTimeout(longPressTimeoutId);
    logo.addEventListener('pointerdown', start);
    logo.addEventListener('pointerup', cancel);
    logo.addEventListener('pointerleave', cancel);
    logo.addEventListener('pointercancel', cancel);
    logo.addEventListener('contextmenu', (e) => e.preventDefault()); // evita el menú de "guardar imagen" al mantener presionado

    $('#dev-tools-cancel').addEventListener('click', () => { $('#dev-tools-modal').hidden = true; });
    $('#dev-tools-modal').addEventListener('click', (e) => { if (e.target === $('#dev-tools-modal')) $('#dev-tools-modal').hidden = true; });
    $('#dev-tools-force-update').addEventListener('click', forceUpdateApp);
  }

  /** Busca versión nueva del service worker, limpia solo la Cache Storage de assets (nunca
   *  localStorage) y recarga con un query param propio para saltar también el caché HTTP
   *  normal del navegador — sin esto, en iPhone/Safari a veces `location.reload()` no
   *  alcanza para traer los archivos nuevos.
   *  V03.1.6 — esta misma función la disparan 2 botones (el de HERRAMIENTAS DE DESARROLLO y
   *  el "ACTUALIZAR" del cartel público de nueva versión — ver initUpdateCheck), pero solo
   *  deshabilitaba/renombraba el primero: quien tocaba el cartel público nunca veía ningún
   *  feedback de que el toque se había registrado (bug encontrado auditando el reporte de
   *  "el cartel vuelve a aparecer en loop" — no era la causa de ESE bug, pero es el mismo
   *  código y vale corregirlo de una vez). Ahora deshabilita cualquiera de los dos que exista
   *  en el DOM en este momento. */
  async function forceUpdateApp() {
    ['#dev-tools-force-update', '#update-now-btn'].forEach((sel) => {
      const btn = $(sel);
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = 'Actualizando…';
    });
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) { try { await r.update(); } catch (e) { /* noop */ } await r.unregister(); }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.warn('[BRAMU LAB] Forzar actualización: algo falló al limpiar caché/SW, se recarga igual.', e);
    }
    window.location.href = window.location.pathname + '?_fu=' + Date.now();
  }
})();
