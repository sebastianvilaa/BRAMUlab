/* ==========================================================================
   BRAMU Lab — app.js (v9)
   ========================================================================== */
(function () {
  'use strict';
  const E = window.PLEngine;
  const S = window.PLStats;
  const Store = window.PLStore;
  const PH = window.PLPlayerHome; // Etapa 2 (Rama Jugador) — agregación pura del Home del jugador
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
  let summaryViewSource = 'live'; // 'live' | 'analysis' — de dónde se abrió el Resumen (Bloque P/AA1)

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
  let toastTimeoutId = null;
  let undoToastTimeoutId = null;
  function showToast(message, durationMs) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
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
    return s.extraordinary && s.tiebreak
      ? `${s.gamesA}-${s.gamesB} · TB ${s.tiebreak.a}-${s.tiebreak.b}`
      : `${s.gamesA}-${s.gamesB}`;
  }

  // Etapa 2 (Rama Jugador §4) — vistas donde la barra inferior debe estar presente. Fuera de
  // esta lista (partido en vivo, setup, resumen, análisis, timeline) la barra se oculta para
  // no competir con el control-bar del marcador ni con las cabeceras propias ya existentes.
  // Etapa 3 (Fase 3, §5) — "Cargar partido jugado" ya no muestra la barra inferior: es un
  // flujo corto y enfocado, no una pantalla principal de navegación (antes sí la mostraba,
  // remanente de cuando ese formulario era más largo).
  const BOTTOM_NAV_VIEWS = ['player-home', 'history', 'ranking', 'profile'];

  function showView(name) {
    ['setup', 'match', 'analysis', 'history', 'timeline', 'manual-load', 'match-saved', 'player-home', 'ranking', 'profile']
      .forEach((v) => { $(`#view-${v}`).hidden = v !== name; });
    if (name !== 'match') $('#view-summary').hidden = true;
    const nav = $('#bottom-nav');
    if (nav) {
      const showNav = BOTTOM_NAV_VIEWS.indexOf(name) !== -1;
      nav.hidden = !showNav;
      if (showNav) updateBottomNavActive(name);
    }
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

  const RECORDING_MODE_LABELS = { complete: 'MODO COMPLETO', games: 'MODO POR GAMES · BETA' };

  const SCORING_HINTS = {
    starpoint: 'Dos ventajas y luego punto decisivo',
    golden: 'Punto decisivo en 40–40',
    classic: 'Deuce + ventaja',
  };

  // V12 (§7): etiquetas del sistema de puntuación para el header de partido en vivo.
  const SCORING_SYSTEM_LABELS = { starpoint: 'STAR POINT', golden: 'PUNTO DE ORO', classic: 'CON VENTAJA' };

  function initSetupScreen() {
    // V10 (44/97): el número de versión sale de PLStore.VERSION (único punto central) —
    // cambiarlo ahí alcanza para actualizar el footer sin tocar más archivos.
    const footerEl = $('#setup-footer');
    if (footerEl) footerEl.textContent = `BRAMU Lab · Concepto y diseño por Sebastián Vila · ${Store.VERSION}`;
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

  /* V13 (§2): selector de modo de registro (Completo / Por games) con lógica tipo web —
   *  se recuerda la última elección (Store.loadRecordingMode) para la próxima vez que se
   *  abre Home. Etapa 2 (Rama Jugador §3.1): el trigger visible ahora es #header-menu-btn
   *  (abre el menú compacto), no un botón propio — #mode-select-menu en sí no cambia. */
  function initModeSelector() {
    selectedRecordingMode = Store.loadRecordingMode();
    updateModeSelectButtonLabel();
    $('#mode-select-cancel').addEventListener('click', () => { $('#mode-select-menu').hidden = true; });
    $('#mode-select-menu').addEventListener('click', (e) => { if (e.target === $('#mode-select-menu')) $('#mode-select-menu').hidden = true; });
    $all('#mode-select-menu [data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRecordingMode = btn.dataset.mode;
        Store.saveRecordingMode(selectedRecordingMode);
        updateModeSelectButtonLabel();
        $('#mode-select-menu').hidden = true;
      });
    });
  }
  function updateModeSelectButtonLabel() {
    const label = RECORDING_MODE_LABELS[selectedRecordingMode] || RECORDING_MODE_LABELS.complete;
    $('#header-menu-btn').textContent = label + ' ▾';
    $('#header-menu-mode-value').textContent = label;
  }

  /* Etapa 2 (Rama Jugador §3.1) — menú compacto del header de Home: reúne Mi pádel /
   *  Historial / Modo de registro en un solo lugar, reutilizando overlay/menu-sheet. */
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
    $('#header-menu-mode').addEventListener('click', () => { $('#header-menu').hidden = true; $('#mode-select-menu').hidden = false; });
  }

  // Etapa 4.1 (§2.1) — a diferencia del resto de la navegación del jugador (donde "volver"
  // siempre es el Home), Historial tiene DOS puntos de entrada reales: la barra inferior/Home
  // (mayoría de los casos) y el menú de la pantalla tradicional Configurar partido (heredado,
  // §4.4 de la Etapa 2). `historyOpenedFrom` guarda cuál fue, para que Volver regrese
  // exactamente a donde corresponde — nunca se infiere por `match`/`currentPlayerName` u otro
  // estado visual, que podría dar el mismo resultado en ambos casos.
  let historyOpenedFrom = 'player-home';
  function openHistoryScreen(origin) {
    historyOpenedFrom = origin === 'setup' ? 'setup' : 'player-home';
    renderHistory();
    showView('history');
  }

  function refreshKnownPlayersDatalist() {
    const dl = $('#known-players');
    dl.innerHTML = '';
    Store.loadPlayerNames().forEach((n) => { const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt); });
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
    const nameEl = el.querySelector('.load-player-chip__name');
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
    renderManualPlayerSheetContent('');
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

  function renderManualPlayerSheetContent(query) {
    const slot = manualActiveSheetSlot;
    if (!slot) return;
    const excluded = manualExcludedNamesForSlot(slot);
    const history = Store.loadHistory();
    const recentsWrap = $('#load-player-sheet-recents');
    if (!query) {
      const recents = ML.computeRecentPlayers(history, currentPlayerName, excluded).slice(0, 12);
      if (recents.length) {
        recentsWrap.hidden = false;
        recentsWrap.innerHTML = recents.map((n) => `
          <button type="button" class="load-player-sheet__recent" data-name="${escapeHtml(n)}">
            <span class="load-player-sheet__recent-avatar">${escapeHtml(playerInitials(n))}</span>
            <span class="load-player-sheet__recent-name">${escapeHtml(n)}</span>
          </button>`).join('');
        $all('#load-player-sheet-recents .load-player-sheet__recent').forEach((btn) => {
          btn.addEventListener('click', () => selectManualPlayer(btn.dataset.name));
        });
      } else { recentsWrap.hidden = true; recentsWrap.innerHTML = ''; }
    } else {
      recentsWrap.hidden = true; recentsWrap.innerHTML = '';
    }

    const pool = ML.computeAllKnownPlayers(history, Store.loadPlayerNames());
    const matches = ML.filterPlayerCandidates(pool, query, excluded.concat([currentPlayerName]));
    const listWrap = $('#load-player-sheet-list');
    listWrap.innerHTML = matches.length
      ? matches.map((n) => `<button type="button" class="load-player-sheet__item" data-name="${escapeHtml(n)}">${escapeHtml(n)}</button>`).join('')
      : '<p class="load-player-sheet__empty">Sin coincidencias.</p>';
    $all('#load-player-sheet-list .load-player-sheet__item').forEach((btn) => {
      btn.addEventListener('click', () => selectManualPlayer(btn.dataset.name));
    });

    const addBtn = $('#load-player-sheet-add');
    const trimmed = normalizePlayerName(query);
    const canAdd = !!trimmed && !ML.isDuplicatePlayerName(trimmed, excluded.concat([currentPlayerName]));
    if (canAdd) { addBtn.hidden = false; addBtn.textContent = `Agregar "${trimmed}" como jugador sin cuenta`; }
    else { addBtn.hidden = true; addBtn.textContent = ''; }
  }

  function selectManualPlayer(name) {
    const slot = manualActiveSheetSlot;
    const norm = normalizePlayerName(name);
    if (!slot || !norm) return;
    manualPlayers[slot] = norm;
    Store.rememberPlayerNames([norm]);
    markManualLoadDirty();
    renderManualPlayers();
    renderManualScoreboard();
    closeManualPlayerSheet();
  }

  function initManualPlayerSheet() {
    $('#load-player-sheet-close').addEventListener('click', closeManualPlayerSheet);
    $('#load-player-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#load-player-sheet-scrim')) closeManualPlayerSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#load-player-sheet-scrim').hidden) closeManualPlayerSheet(); });
    $('#load-player-sheet-search').addEventListener('input', (e) => renderManualPlayerSheetContent(e.target.value));
    $('#load-player-sheet-add').addEventListener('click', () => selectManualPlayer($('#load-player-sheet-search').value));
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

  /** §6.1 — estado contextual del header: qué set se está cargando, o que el partido ya
   *  quedó completo (justo antes de guardar). */
  function manualStateLabel(format) {
    if (manualDecided) return 'PARTIDO COMPLETO';
    if (format.bestOfSets === 1) return 'RESULTADO';
    return manualActiveSetIndex === 2 ? 'SET DECISIVO' : `SET ${manualActiveSetIndex + 1}`;
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
  function updateManualContinueState(format) {
    const btn = $('#manual-continue-btn');
    if (manualDecided) {
      btn.disabled = false;
      btn.textContent = 'GUARDAR PARTIDO';
      $('#court-current-set-hint').hidden = true;
      return;
    }
    const s = manualDraftSet;
    const valid = Number.isFinite(s.a) && Number.isFinite(s.b) && E.isValidCompletedSetScore(s.a, s.b, format);
    btn.disabled = !valid;
    btn.textContent = 'CONTINUAR';
    $('#court-current-set-hint').hidden = !valid;
  }

  function renderManualScoreboard() {
    const format = E.FORMATS[manualSelectedFormatId];
    $('#manual-load-status').textContent = manualStateLabel(format);
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
   *  pantalla cuando está cerrado — medido en vivo, no un alto fijo adivinado. */
  function positionManualContinueBar() {
    const wrap = $('#court-continue-wrap');
    const keypad = $('#load-keypad');
    if (!wrap || !keypad) return;
    wrap.style.bottom = keypad.hidden ? '0px' : `${keypad.offsetHeight}px`;
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
  function advanceDraftSide() {
    if (manualDraftActiveTeam === 'A') { openManualKeypad('B'); return; }
    closeManualKeypadPanel();
    renderManualScoreboard();
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
      renderManualScoreboard();
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
    $('#manual-continue-btn').addEventListener('click', attemptManualContinue);
  }

  /** §6.3/§8.1 — CONTINUAR: confirma el set en edición (con confirmación previa si eso deja
   *  huérfano un Set 3 ya cargado — §6.2) y avanza al siguiente, o guarda el partido cuando ya
   *  no queda ningún set más que pedir (ML.resolveActiveSetIndex === null). Misma acción,
   *  cualquiera sea el rótulo visible del botón en ese momento. */
  function attemptManualContinue() {
    if (manualDecided) { finalizeManualContinue(); return; }
    if (manualKeypadOpen) commitDraftDigits();
    const format = E.FORMATS[manualSelectedFormatId];
    if (!Number.isFinite(manualDraftSet.a) || !Number.isFinite(manualDraftSet.b)) return;
    if (!E.isValidCompletedSetScore(manualDraftSet.a, manualDraftSet.b, format)) return;

    const applyConfirm = () => {
      manualSets[manualActiveSetIndex] = { a: manualDraftSet.a, b: manualDraftSet.b };
      if (manualActiveSetIndex === 0 || manualActiveSetIndex === 1) pruneOrphanThirdSet();
      markManualLoadDirty();
      const next = ML.resolveActiveSetIndex(manualSets, format);
      if (next === null) {
        manualDecided = true;
        closeManualKeypadPanel();
        renderManualScoreboard();
        finalizeManualContinue();
      } else {
        manualActiveSetIndex = next;
        const existing = manualSets[next];
        manualDraftSet = existing ? { a: existing.a, b: existing.b } : { a: undefined, b: undefined };
        manualDraftActiveTeam = 'A';
        closeManualKeypadPanel();
        renderManualScoreboard();
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
          () => { closeManualKeypadPanel(); renderManualScoreboard(); }
        );
        return;
      }
    }
    applyConfirm();
  }

  /** §9: si Set 1 y Set 2 ya están completos y dejaron de sumar 1-1, cualquier valor que
   *  hubiera quedado en el Set 3 pasó a ser huérfano — se limpia acá. La confirmación previa
   *  (cuando ese Set 3 ya tenía un resultado CARGADO) vive en attemptManualContinue; acá se
   *  cubre además el caso silencioso de siempre (Set 3 todavía vacío, nada que perder). */
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
    const dateTimePart = isDefault
      ? (timeVal ? `Ahora · Hoy · ${timeVal}` : 'Ahora · Hoy')
      : [formatCompactPlayedDate(`${dateVal}T${timeVal || '00:00'}`, undefined), timeVal].filter(Boolean).join(' · ');
    return placeVal ? `${dateTimePart} · ${placeVal}` : dateTimePart;
  }
  function renderManualMetaLine() {
    const text = computeManualMetaLineText();
    const a = $('#manual-meta-line-text'); if (a) a.textContent = text;
    const b = $('#match-saved-meta-text'); if (b) b.textContent = text;
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
    const timeKnown = !!timeVal;
    const startedAtDate = new Date(`${dateVal}T${timeVal || '00:00'}`);
    const placeName = $('#manual-place-input').value.trim();
    const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;
    Store.patchHistoryEntry(manualEditingMatchId, {
      playedAt: startedAtDate.toISOString(),
      startedAt: startedAtDate.toISOString(),
      timeKnown,
      location: location || null,
    });
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
    $('#manual-time-input').addEventListener('input', () => { markManualLoadDirty(); renderManualMetaLine(); });
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
    confirmAction('¿Salir sin guardar?', 'Los datos que ingresaste todavía no se guardaron.', () => { manualLoadDirty = false; goBack(); });
  }

  /** Abre la pantalla para cargar un partido nuevo (`editMatch` ausente) o para editar uno ya
   *  guardado (`editMatch` = la entrada completa del Historial — §15). §6: TODA entrada a esta
   *  pantalla requiere identidad — Jugador 1 del Equipo A siempre es `currentPlayerName`, fijo,
   *  sin importar desde dónde se abrió. Si falta identidad, se resuelve primero y se retoma el
   *  flujo sin perder contexto. */
  function openManualLoadScreen(origin, editMatch) {
    manualLoadOrigin = origin === 'setup' ? 'setup' : 'player-home';
    currentPlayerName = Store.loadCurrentPlayerName();
    if (!currentPlayerName) { openPlayerIdentifyModal(() => openManualLoadScreen(origin, editMatch)); return; }

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
      const partner = teamA.find((p) => p.name !== currentPlayerName) || teamA[1] || null;
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
      } catch (e) { $('#manual-date-input').value = baseDateObj.toISOString().slice(0, 10); }
      const timeKnown = editMatch.timeKnown !== false;
      if (timeKnown) {
        try { $('#manual-time-input').value = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone }).format(baseDateObj); }
        catch (e) { $('#manual-time-input').value = baseDateObj.toISOString().slice(11, 16); }
      } else {
        $('#manual-time-input').value = '';
      }
      $('#manual-place-input').value = (editMatch.location && editMatch.location.name) || '';
    } else {
      const now = new Date();
      $('#manual-date-input').value = now.toISOString().slice(0, 10);
      $('#manual-time-input').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
  function finalizeManualContinue() {
    manualSaveAttempted = true;
    const draft = recomputeManualValidation();
    if (!draft.ok) return;
    attemptSaveManualMatch(draft);
  }

  function attemptSaveManualMatch(draft) {
    if (manualSaveInFlight) return;
    manualSaveInFlight = true;
    $('#manual-continue-btn').disabled = true;
    closeAllManualOverlays();
    try { saveManualMatch(draft); }
    finally { manualSaveInFlight = false; }
  }

  function saveManualMatch(draft) {
    const players = [
      { id: 0, team: 'A', name: manualPlayers.a1 },
      { id: 1, team: 'A', name: manualPlayers.a2 },
      { id: 2, team: 'B', name: manualPlayers.b1 },
      { id: 3, team: 'B', name: manualPlayers.b2 },
    ];
    const dateVal = $('#manual-date-input').value;
    const timeVal = $('#manual-time-input').value; // '' si el usuario la borró — nunca se completa sola
    const timeKnown = !!timeVal;
    const startedAtDate = new Date(`${dateVal}T${timeVal || '00:00'}`);
    let timeZone = 'UTC';
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { /* offline-safe fallback */ }
    const placeName = $('#manual-place-input').value.trim();
    const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;

    Store.rememberPlayerNames(players.map((p) => p.name));
    finishMatchManual(players, draft.sets, draft.winnerTeam, manualSelectedFormatId, manualSelectedScoring, startedAtDate, timeZone, timeKnown, location, manualEditingMatchId, manualEditingCreatedAt, manualExistingPrivateNote);
  }

  /** Crea o ACTUALIZA (si `editingMatchId` viene informado — §15) un partido cargado. Nunca
   *  toca timer/Wake Lock/Store.clearActiveMatch (no hay partido activo real involucrado), y
   *  usa los generadores de stats/Intelligence dedicados a carga manual (solo hechos
   *  derivables del resultado final por set). `Store.upsertHistory` ya dedupe por matchId, así
   *  que reusar el mismo id en una edición actualiza el registro existente sin duplicarlo.
   *  Etapa 4.2 (§8): una carga NUEVA sigue a Partido guardado (Momento 2, enriquecimiento
   *  opcional); reeditar un partido que ya existía va directo al Resumen, como ya hacía —
   *  la pantalla de "recién guardado" es específicamente la primera confirmación (§8.2), no
   *  tiene sentido repetirla en cada reedición posterior. */
  function finishMatchManual(players, sets, winnerTeam, formatId, scoringSystem, startedAtDate, timeZone, timeKnown, location, editingMatchId, editingCreatedAt, existingPrivateNote) {
    const format = E.FORMATS[formatId];
    const matchCtx = { players, format };
    const stats = S.computeManualStats(sets, matchCtx);
    const intelligence = S.generateManualIntelligence(stats, matchCtx, sets, winnerTeam, { manual: false });

    finishedSnapshot = {
      matchId: editingMatchId || makeMatchId(),
      // §15: una edición conserva el `createdAt` original — solo un alta nueva usa "ahora".
      createdAt: editingCreatedAt || new Date().toISOString(),
      // Etapa 3 (Fase 1, §5.1) — playedAt es la fecha/hora que el usuario eligió a mano en
      // el formulario (startedAtDate), no el momento en que se toca "Guardar". Nunca se
      // repite esta lógica en otro lugar: PH.getPlayedAt() es la única fuente de verdad
      // para leer "cuándo se jugó" en el resto de la app.
      playedAt: startedAtDate.toISOString(),
      startedAt: startedAtDate.toISOString(),
      timeZone,
      finishedAt: new Date().toISOString(),
      players,
      mode: 'manual',
      scoringSystem,
      formatId,
      tiebreakMode: null,
      baseline: null,
      sets,
      currentPartial: null,
      winnerTeam,
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
      privateNote: existingPrivateNote || null,
    };

    Store.upsertHistory(finishedSnapshot);
    manualLoadDirty = false;
    const wasNewLoad = manualIsNewLoad;
    // A partir de acá "Modificar" y la nota privada patchean ESTE registro, exista o no ya
    // desde antes de este guardado.
    manualEditingMatchId = finishedSnapshot.matchId;
    manualEditingCreatedAt = finishedSnapshot.createdAt;

    if (wasNewLoad) {
      openMatchSavedScreen(finishedSnapshot);
    } else {
      renderSummary();
      showView('player-home');
      $('#bottom-nav').hidden = true;
      $('#view-summary').hidden = false;
    }
  }

  /* ---- Partido guardado — Etapa 4.2 (§8.2) ---- */

  function openMatchSavedScreen(f) {
    const myTeam = 'A'; // en la carga manual, el jugador actual siempre es Equipo A
    const resultKind = !f.winnerTeam ? 'neutral' : (f.winnerTeam === myTeam ? 'win' : 'loss');
    const resultLabel = { win: 'VICTORIA', loss: 'DERROTA', neutral: 'SIN DEFINICIÓN' }[resultKind];
    const badge = $('#match-saved-badge');
    badge.textContent = resultLabel;
    badge.className = 'court-saved-result__badge court-saved-result__badge--' + resultKind;
    $('#match-saved-score').textContent = f.sets.map(formatSetSegmentLabel).join(' · ');
    const teamAName = f.players.filter((p) => p.team === 'A').map((p) => p.name).join(' / ');
    const teamBName = f.players.filter((p) => p.team === 'B').map((p) => p.name).join(' / ');
    $('#match-saved-teams').textContent = `${teamAName} vs ${teamBName}`;
    $('#match-saved-note').value = f.privateNote || '';
    renderManualMetaLine();
    showView('match-saved');
  }

  function initMatchSavedScreen() {
    $('#match-saved-note').addEventListener('blur', () => {
      if (!manualEditingMatchId) return;
      Store.patchHistoryEntry(manualEditingMatchId, { privateNote: $('#match-saved-note').value.trim() || null });
    });
    $('#match-saved-view-summary').addEventListener('click', () => {
      const f = (manualEditingMatchId && Store.getHistoryEntry(manualEditingMatchId)) || finishedSnapshot;
      // f nunca es === finishedSnapshot (se relee de Store para reflejar nota/lugar recién
      // editados acá), así que renderSummary lo trataría como 'analysis' de todos modos; lo
      // marcamos explícito y dejamos analysisCurrent/analysisOpenedFrom listos para que "←"
      // en Resumen pueda abrir Análisis de este mismo partido en vez de crashear con
      // analysisCurrent todavía null (nunca se pasó por Análisis antes de llegar acá).
      analysisCurrent = f;
      analysisOpenedFrom = 'player-home';
      renderSummary(f, 'analysis');
      showView('player-home');
      $('#bottom-nav').hidden = true;
      $('#view-summary').hidden = false;
    });
    $('#match-saved-home-btn').addEventListener('click', () => openPlayerHome());
  }

  function initManualLoadScreen() {
    $('#load-played-match-btn').addEventListener('click', () => openManualLoadScreen('setup'));
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
    $('#view-summary').hidden = true;
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

  /** ¿(a,b) es un resultado FINAL válido de Tie break (alguien acaba de ganar, exacto) para
   *  este objetivo? A diferencia de `E.isValidTiebreakScore` (que también acepta scores "en
   *  curso"), acá solo interesa un resultado ya cerrado — no se registra un TB a medio jugar. */
  function isValidFinalTbScore(a, b, cfg) {
    const aWins = E.tiebreakIsWon(a, b, cfg) && !E.tiebreakIsWon(a - 1, b, cfg);
    const bWins = E.tiebreakIsWon(b, a, cfg) && !E.tiebreakIsWon(b - 1, a, cfg);
    return aWins || bWins;
  }

  function applyGameTbStepper(field, delta) {
    const cfg = { winTarget: gameTbDraft.winTarget, requireDiff2: gameTbDraft.requireDiff2 };
    let a = gameTbDraft.scoreA, b = gameTbDraft.scoreB;
    if (!gameTbDraft.scoreKnown) {
      a = gameTbDraft.team === 'A' ? cfg.winTarget : Math.max(0, cfg.winTarget - 2);
      b = gameTbDraft.team === 'B' ? cfg.winTarget : Math.max(0, cfg.winTarget - 2);
    } else if (field === 'gtb-a') { a += delta; } else { b += delta; }
    if (a < 0 || b < 0) return;
    if (!isValidFinalTbScore(a, b, cfg)) return;
    const winnerWon = gameTbDraft.team === 'A' ? (a > b) : (b > a);
    if (!winnerWon) return; // el ganador elegido en el paso 1 tiene que seguir siendo quien ganó
    gameTbDraft.scoreA = a; gameTbDraft.scoreB = b; gameTbDraft.scoreKnown = true;
    renderGameTbModal();
  }

  function confirmGameTbModal(omit) {
    if (!gameTbDraft || !gameTbDraft.team) return;
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
    $('#view-summary').hidden = true;
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
    $('#view-summary').hidden = true;
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
    $('#view-summary').hidden = true;
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
    $('#view-summary').hidden = true;
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
  function confirmAction(title, text, onAccept, onCancel) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
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
      players: match.players,
      mode: match.mode || 'complete',
      scoringSystem: match.scoringSystem,
      formatId: match.formatId,
      tiebreakMode: match.tiebreakMode,
      // V6 — antes NO se guardaba el baseline en el snapshot: Timeline y Momentos Clave
      // recalculaban todo desde 0-0 ignorando que el partido pudo haber arrancado a mitad
      // de un "Partido ya empezado" (bug: SET 1 inventado, games 1-0/2-0 falsos, score
      // relativo en vez del real). Guardarlo acá es lo que permite reconstruir el estado
      // correcto más adelante, incluso reabriendo el partido desde Historial otro día.
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

    Store.upsertHistory(finishedSnapshot);
    Store.clearActiveMatch();
    renderSummary();
    $('#view-summary').hidden = false;
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
      players: match.players,
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

    Store.upsertHistory(finishedSnapshot);
    Store.clearActiveMatch();
    renderSummary();
    $('#view-summary').hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* COMPONENTE DE RESULTADO TIPO TV (V5 — reutilizado en Resumen/Análisis, Bloque Q) */
  /* ------------------------------------------------------------------ */

  /** V13 (§20/§26/§27) — línea de metadata discreta para Resumen/Análisis/Historial:
   *  fecha · hora · formato · sistema · modo. Se aplica a partidos vivos recién terminados
   *  y a partidos reabiertos desde Historial (ambos comparten la misma forma de snapshot),
   *  y también a Completo (no solo a Por Games) — mejora pedida por igual para los dos. */
  function buildMatchMetaLine(f) {
    const dateStr = formatRealDate(f.startedAt || f.createdAt, f.timeZone);
    // V14 (§8): la Hora es opcional en un partido cargado — si el usuario la dejó vacía,
    // nunca se muestra una hora inventada (nunca "00:00" a secas).
    const timeStr = (f.mode === 'manual' && f.timeKnown === false) ? null : formatRealTime(f.startedAt || f.createdAt, f.timeZone).slice(0, 5);
    const formatLabel = (E.FORMATS[f.formatId] && E.FORMATS[f.formatId].label || '').toUpperCase();
    const scoringLabel = HISTORY_SCORING_LABELS[f.scoringSystem] || '';
    const modeLabel = f.mode === 'games' ? 'POR GAMES' : f.mode === 'manual' ? 'PARTIDO CARGADO' : null;
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

    return `<div class="result-card">
      ${durationsHTML}
      ${cellsForTeam('A')}
      ${cellsForTeam('B')}
      ${footerHTML}
      ${statsBlockHTML}
      ${durLabel ? `<p class="result-card__duration-total">${durLabel}</p>` : ''}
    </div>`;
  }

  /** Componente de resultado usado en Análisis (score + duración; las estadísticas completas
   *  viven en su propia sección más abajo, así que acá NO se fusionan). */
  function buildResultBlockHTML(f) { return buildWinnersBannerHTML(f) + buildScoreCardHTML(f); }

  /** V6 (21-27): tarjeta única del Resumen del partido — fusiona resultado + duración por set +
   *  estadísticas rápidas + duración total en UN solo componente visual grande. */
  function buildSummaryCardHTML(f) {
    const statsHTML = f.mode === 'games' ? buildGamesSummaryStatsHTML(f) : f.mode === 'manual' ? buildManualSummaryStatsHTML(f) : buildSummaryStatsHTML(f);
    return buildWinnersBannerHTML(f) + buildScoreCardHTML(f, { statsHTML });
  }

  /** V14 (§14) — métricas del Resumen para un partido cargado manualmente: SOLO sets/games
   *  ganados — ni siquiera games de saque/breaks (eso ya requiere saber quién sacaba en cada
   *  game, algo que la carga manual nunca pregunta). Más reducido todavía que Por Games. */
  function buildManualSummaryStatsHTML(f) {
    const st = f.stats;
    const rows = [
      { a: st.setsWonA, label: 'SETS GANADOS', b: st.setsWonB },
      { a: st.gamesA, label: 'GAMES GANADOS', b: st.gamesB },
    ];
    return rows.map((r) => `<div class="summary-stat-row"><span class="summary-stat-row__a">${r.a}</span><span class="summary-stat-row__label">${r.label}</span><span class="summary-stat-row__b">${r.b}</span></div>`).join('');
  }

  /** V13 (§20-21) — métricas del Resumen en Por Games: games ganados, games de saque
   *  ganados, breaks, racha máxima de games. Nunca puntos/Oro/BP/SP/MP (no existen en este
   *  modo) — a diferencia de `buildHeadlineRows`, no hay que filtrar nada condicionalmente
   *  porque el set de métricas ya es, por diseño, el único compatible. */
  function buildGamesSummaryStatsHTML(f) {
    const st = f.stats;
    const rows = [
      { a: st.gamesA, label: 'GAMES GANADOS', b: st.gamesB },
      { a: `${st.serviceGames.wonA}/${st.serviceGames.wonA + st.serviceGames.lostA}`, label: 'GAMES DE SAQUE GANADOS', b: `${st.serviceGames.wonB}/${st.serviceGames.wonB + st.serviceGames.lostB}` },
      { a: st.breaksA, label: 'BREAKS', b: st.breaksB },
      { a: st.maxGameStreakA, label: 'RACHA MÁXIMA DE GAMES', b: st.maxGameStreakB },
    ];
    return rows.map((r, i) => {
      // V13: a diferencia de "Puntos ganados" (Completo), acá no tiene sentido mostrar un
      // desglose "% + pts" — son games, no puntos — así que la barra muestra la cantidad
      // directamente como dato principal (pctPrimary=false).
      if (i === 0) return sharedBarRowHTML(r.label, r.a, r.b, Number(r.a) || 0, Number(r.b) || 0, false, false);
      return `<div class="summary-stat-row"><span class="summary-stat-row__a">${r.a}</span><span class="summary-stat-row__label">${r.label}</span><span class="summary-stat-row__b">${r.b}</span></div>`;
    }).join('');
  }

  /** Bloque N: legal de datos parciales — se muestra solo cuando corresponde (nunca en partido completo sin ajustes). */
  function buildCoverageLegalHTML(f) {
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

  /** Bloque P/AA1: el Resumen ahora puede abrirse tanto para el partido recién finalizado
   *  (live) como para cualquier partido histórico visto desde Análisis. `f` es el snapshot a
   *  mostrar; `source` determina si tiene sentido ofrecer Deshacer/Reanudar/Nuevo partido
   *  (solo si es el partido activo real) o solo un botón para volver a Análisis.
   *  V6 (21-23): título "RESUMEN DEL PARTIDO" y tarjeta única fusionada (buildSummaryCardHTML). */
  function renderSummary(f, source) {
    f = f || finishedSnapshot;
    summaryViewSource = source || 'live';
    const isLiveMatch = summaryViewSource === 'live' && f === finishedSnapshot;

    $('#summary-reason').hidden = true; // la razón ahora vive dentro del result-card
    $('#summary-meta').textContent = buildMatchMetaLine(f);
    $('#summary-result-slot').innerHTML = buildSummaryCardHTML(f);
    $('#summary-legal').innerHTML = buildCoverageLegalHTML(f);
    // V14: un partido cargado nunca tuvo puntos/games EN VIVO que deshacer — sin este guard,
    // "Deshacer último punto" quedaría visible y tocable sobre un `match`/`pointEvents` que
    // nunca existieron para este partido (crashearía o no haría nada coherente).
    $('#summary-undo-btn').hidden = !isLiveMatch || f.terminationType !== 'automatic' || f.mode === 'manual';
    $('#summary-resume-btn').hidden = !isLiveMatch || f.terminationType !== 'manual';
    $('#summary-back-btn').hidden = isLiveMatch;
    $('#summary-new-btn').hidden = !isLiveMatch;

    // Etapa 3 (Fase 3, §14) — un partido CARGADO manualmente no abre Análisis desde acá (solo
    // repetiría, más pobre, lo que ya muestra esta misma tarjeta): en su lugar, una devolución
    // breve de BRAMU Intelligence (la de stats.js YA es corta/factual por diseño, se reutiliza
    // tal cual) y el acceso directo a "Editar partido" — nunca los dos botones a la vez.
    const isManual = f.mode === 'manual';
    $('#summary-analysis-btn').hidden = isManual;
    $('#summary-edit-btn').hidden = !isManual;
    $('#summary-manual-intelligence').hidden = !isManual;
    if (isManual) $('#summary-manual-intelligence').textContent = f.intelligence;
  }

  function initSummaryScreen() {
    $('#summary-new-btn').addEventListener('click', () => {
      Store.clearActiveMatch();
      match = null;
      checkForActiveMatch();
      // Hotfix v1.2.1 (§2-3.1) — "VOLVER AL INICIO" es siempre el Home del jugador, sin
      // importar el modo (Completo/Por Games/manual) ni desde dónde se abrió esta pantalla.
      // Antes solo pasaba por acá un partido manual cargado desde el Home; cualquier otro
      // caso caía en `showView('setup')` — la causa del hotfix.
      openPlayerHome();
    });
    $('#summary-analysis-btn').addEventListener('click', () => {
      // V6 — bug crítico corregido: antes se priorizaba `analysisCurrent` (que puede
      // haber quedado en memoria de un partido anterior visto en Análisis) por sobre
      // el partido recién finalizado. Si este Resumen es el del partido EN VIVO que
      // acaba de terminar, el snapshot recién finalizado (`finishedSnapshot`) es
      // SIEMPRE la fuente de verdad, nunca un análisis viejo en memoria.
      const f = summaryViewSource === 'live' ? finishedSnapshot : analysisCurrent;
      analysisOpenedFrom = summaryViewSource === 'analysis' ? analysisOpenedFrom : 'live';
      renderAnalysis(f);
      showView('analysis');
    });
    // V7 (103-104): el Resumen recién finalizado SIEMPRE comparte `finishedSnapshot` — nunca
    // un análisis viejo que pueda haber quedado en memoria de otro partido visto antes. El
    // Resumen histórico (abierto desde Análisis/Historial) comparte el snapshot que se le
    // pasó a este Resumen. Mismo criterio que ya usa "Ver análisis" un poco más arriba.
    $('#summary-share-btn').addEventListener('click', () => {
      const f = summaryViewSource === 'live' ? finishedSnapshot : analysisCurrent;
      shareResult(f, 'resumen');
    });
    $('#summary-undo-btn').addEventListener('click', () => { if (isGamesMode()) undoLastGame(); else undoLastPoint(); });
    $('#summary-resume-btn').addEventListener('click', resumeMatch);
    $('#summary-back-btn').addEventListener('click', () => { renderAnalysis(analysisCurrent); showView('analysis'); });
    // Etapa 3 (Fase 3, §15) — "Editar partido" reabre la MISMA pantalla de carga, con todos
    // los datos precargados (mismo criterio de fuente que "Ver análisis"/"Compartir" un poco
    // más arriba: finishedSnapshot si este Resumen es el del partido recién guardado, o el
    // snapshot que ya se estaba viendo si se llegó acá desde Análisis/Historial).
    $('#summary-edit-btn').addEventListener('click', () => {
      const f = summaryViewSource === 'live' ? finishedSnapshot : analysisCurrent;
      openManualLoadScreen('player-home', f);
    });
  }

  /* ------------------------------------------------------------------ */
  /* ANÁLISIS COMPLETO                                                    */
  /* ------------------------------------------------------------------ */
  function renderAnalysis(f) {
    analysisCurrent = f;
    analysisSetFilter = 'match'; // Bloque S2/V5: siempre arranca en PARTIDO al abrir/cambiar de partido
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
    const noteSection = $('#analysis-note-section');
    noteSection.hidden = f.mode !== 'manual';
    if (f.mode === 'manual') $('#analysis-note-textarea').value = f.privateNote || '';
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
    rowsHTML.push(sharedBarRowHTML('Games ganados', stats.gamesA, stats.gamesB, stats.gamesA, stats.gamesB, false, false));
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

  /** V14 (§14) — grilla de Análisis para un partido cargado: SOLO sets/games ganados, sin
   *  selector por set (no hay desglose punto/game a game que filtrar, solo el resultado
   *  final ya visible arriba en la tarjeta de resultado). */
  function renderManualStatsGrid(f) {
    $('#stats-set-filter').innerHTML = '';
    const st = f.stats;
    $('#analysis-stats-grid').innerHTML = `
      <div class="summary-stat-row"><span class="summary-stat-row__a">${st.setsWonA}</span><span class="summary-stat-row__label">SETS GANADOS</span><span class="summary-stat-row__b">${st.setsWonB}</span></div>
      <div class="summary-stat-row"><span class="summary-stat-row__a">${st.gamesA}</span><span class="summary-stat-row__label">GAMES GANADOS</span><span class="summary-stat-row__b">${st.gamesB}</span></div>
    `;
    $('#analysis-stats-legal').hidden = false;
    $('#analysis-stats-legal').textContent = 'Partido cargado manualmente: solo se conoce el resultado final por set, sin desarrollo punto a punto.';
    $('#analysis-stats-partial-note').hidden = true;
    $('#analysis-per-player-serve').hidden = true;
  }

  function renderStatsGrid(f) {
    if (f.mode === 'games') { renderGamesStatsGrid(f); return; }
    if (f.mode === 'manual') { renderManualStatsGrid(f); return; }
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
    });
    $('#analysis-back-btn').addEventListener('click', () => {
      if (analysisOpenedFrom === 'live' && finishedSnapshot) { $('#view-summary').hidden = false; showView('match'); }
      else if (analysisOpenedFrom === 'history') { renderHistory(); showView('history'); }
      // Etapa 2 (Rama Jugador) — "Ver detalle" desde la tarjeta Último Partido del Home.
      else if (analysisOpenedFrom === 'player-home') { renderPlayerHome(); showView('player-home'); }
      else showView('setup');
    });
    // Bloque P: VER RESUMEN — especialmente importante entrando desde Historial, donde tocar
    // un partido abre Análisis directo (AA1) y hasta ahora no había forma de ver su Resumen.
    $('#analysis-summary-btn').addEventListener('click', () => {
      const f = analysisCurrent;
      if (!f) return;
      const source = (f === finishedSnapshot && analysisOpenedFrom === 'live') ? 'live' : 'analysis';
      renderSummary(f, source);
      // El Resumen es un overlay de posición fija: no hace falta cambiar de vista de fondo.
      $('#view-summary').hidden = false;
    });
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
    const counts = PH.computeHistoryTabCounts(fullHistory, currentPlayerName);
    const tabsWrap = $('#history-tabs');
    tabsWrap.innerHTML = HISTORY_TABS.map((t) => {
      const active = historyOwnershipFilter === t.key;
      return `<button type="button" class="history-tab${active ? ' is-active' : ''}" data-key="${t.key}" role="tab" aria-selected="${active}">${t.label} <span class="history-tab__count">${counts[t.key]}</span></button>`;
    }).join('');
    $all('#history-tabs .history-tab').forEach((btn) => {
      btn.addEventListener('click', () => { historyOwnershipFilter = btn.dataset.key; renderHistory(); });
    });

    const chipsWrap = $('#history-mode-chips');
    chipsWrap.innerHTML = HISTORY_MODE_CHIPS.map((c) => {
      const active = historyModeFilter === c.key;
      return `<button type="button" class="history-mode-chip${active ? ' is-active' : ''}" data-key="${c.key}" role="tab" aria-selected="${active}">${c.label}</button>`;
    }).join('');
    $all('#history-mode-chips .history-mode-chip').forEach((btn) => {
      btn.addEventListener('click', () => { historyModeFilter = btn.dataset.key; renderHistory(); });
    });
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
    const list = PH.filterHistoryCombined(fullHistory, currentPlayerName, historyOwnershipFilter, historyModeFilter);
    const wrap = $('#history-list');
    wrap.innerHTML = '';
    const isEmpty = list.length === 0;
    $('#history-empty').hidden = !isEmpty;
    if (isEmpty) { renderHistoryEmptyState(fullHistory.length); return; }
    list.forEach((m) => {
      const nameA = S.teamLabel(m.players, 'A'), nameB = S.teamLabel(m.players, 'B');
      // V8.2 (32): BUG de auditoría — antes usaba `sets.map(...).join(' · ') || currentPartial`,
      // así que en cuanto había AL MENOS un set terminado, el `||` nunca llegaba a mirar
      // `currentPartial` y el último set incompleto (partido finalizado manualmente a mitad
      // de un set) desaparecía del Historial. Ahora ambos se concatenan cuando corresponde:
      // sets terminados primero, y el set parcial al final marcado con "*".
      const finishedSetsStr = m.sets.map(formatSetSegmentLabel).join(' · ');
      const partialSetStr = m.currentPartial ? `${m.currentPartial.gamesA}-${m.currentPartial.gamesB}*` : '';
      const scoreStr = [finishedSetsStr, partialSetStr].filter(Boolean).join(' · ') || 'sin sets';
      const formatLabel = (E.FORMATS[m.formatId] && E.FORMATS[m.formatId].label || '').toUpperCase();
      const scoringLabel = HISTORY_SCORING_LABELS[m.scoringSystem] || '';
      // V13 (§26) / V14: distingue Por Games y partidos cargados manualmente de Completo.
      const modeLabel = m.mode === 'games' ? 'POR GAMES' : m.mode === 'manual' ? 'PARTIDO CARGADO' : null;
      const subtitleStr = [formatLabel, scoringLabel, modeLabel].filter(Boolean).join(' · ');
      const item = document.createElement('div');
      item.className = 'history-item';
      // V7 (45-46-107-112): mismo criterio cromático que Resumen/Análisis — el ganador se
      // destaca con el color de SU equipo (LIMA/AZUL), nunca dorado (reservado para Oro/Star).
      const winnerBadgeA = m.winnerTeam === 'A' ? ' history-item__winner history-item__winner--a' : '';
      const winnerBadgeB = m.winnerTeam === 'B' ? ' history-item__winner history-item__winner--b' : '';
      // Etapa 3 (Fase 1) — fecha REAL jugada, no cuándo se guardó (PH.getPlayedAt: playedAt
      // → startedAt → finishedAt). Nunca leer m.finishedAt directo para esto.
      const playedAt = PH.getPlayedAt(m);
      // V7 (109-111): nuevo orden — fecha → formato/método → jugadores → resultado → duración.
      item.innerHTML = `
        <div class="history-item__row">
          <div class="history-item__main">
            <div class="history-item__date">${formatRealDate(playedAt, m.timeZone)} · ${formatRealTime(playedAt, m.timeZone).slice(0, 5)}</div>
            ${subtitleStr ? `<div class="history-item__subtitle">${subtitleStr}</div>` : ''}
            <div class="history-item__teams"><span class="${winnerBadgeA}">${nameA}</span><span class="vs-sep">vs</span><span class="${winnerBadgeB}">${nameB}</span></div>
            <div class="history-item__score">${scoreStr}</div>
            <div class="history-item__meta">${m.mode === 'manual' ? '' : `<span>${formatDuration(m.durationMs)}</span>`}</div>
            ${m.terminationType === 'manual' ? `<span class="history-item__badge">${m.terminationReasonLabel}</span>` : ''}
          </div>
          <button type="button" class="history-item__delete" aria-label="Eliminar partido">✕</button>
        </div>
      `;
      item.querySelector('.history-item__main').addEventListener('click', () => { analysisOpenedFrom = 'history'; renderAnalysis(m); showView('analysis'); });
      item.querySelector('.history-item__delete').addEventListener('click', (e) => { e.stopPropagation(); deleteHistoryEntry(m); });
      wrap.appendChild(item);
    });
  }

  /** Elimina un partido del historial con posibilidad de deshacer (toast temporal). */
  function deleteHistoryEntry(entry) {
    Store.removeFromHistory(entry.matchId);
    renderHistory();
    showUndoToast('Partido eliminado', () => { Store.upsertHistory(entry); renderHistory(); });
  }

  function showUndoToast(message, onUndo) {
    const toast = $('#toast');
    toast.innerHTML = '';
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button'; undoBtn.className = 'toast__undo-btn'; undoBtn.textContent = 'DESHACER';
    undoBtn.addEventListener('click', () => { onUndo(); toast.classList.remove('is-visible'); clearTimeout(undoToastTimeoutId); });
    toast.appendChild(undoBtn);
    toast.classList.add('is-visible');
    clearTimeout(undoToastTimeoutId);
    clearTimeout(toastTimeoutId);
    undoToastTimeoutId = setTimeout(() => toast.classList.remove('is-visible'), 4500);
  }
  function initHistoryScreen() {
    $('#history-back-btn').addEventListener('click', () => {
      if (historyOpenedFrom === 'setup') showView('setup');
      else openPlayerHome();
    });
  }

  /* ------------------------------------------------------------------ */
  /* RAMA JUGADOR — HOME DEL JUGADOR (Etapa 2)                            */
  /* Orquestación de DOM/navegación únicamente — el filtrado del historial, forma
   *  reciente, rachas, compañero/rival frecuente y el texto de "Tu momento" viven en
   *  player-home.js (PH), funciones puras sin DOM, mismo criterio de reparto que
   *  engine.js/stats.js (E/S) para el resto de la app. */
  /* ------------------------------------------------------------------ */
  let currentPlayerName = null;
  // Auditoría funcional (§5): "Cambiar jugador" no existe más — el modal "¿Quién sos?" solo se
  // abre para la PRIMERA identificación (nunca hay más de un call-site vivo con un jugador ya
  // identificado detrás). `afterIdentifyAction` deja que quien lo abre decida a dónde seguir
  // después de guardar el nombre (por default, al Home) — lo usa, por ejemplo, "Cargar partido
  // jugado" para retomar la carga apenas el jugador se identifica (§3).
  let afterIdentifyAction = null;

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

  /** Progreso visual de la barra: posición de `level` dentro del rango completo [1.0, 10.0]
   *  (PH.LEVEL_MIN/LEVEL_MAX) — nunca un porcentaje decorativo suelto. */
  function levelProgressPct(level) {
    return Math.round(((level - PH.LEVEL_MIN) / (PH.LEVEL_MAX - PH.LEVEL_MIN)) * 100);
  }

  function openPlayerHome() {
    currentPlayerName = Store.loadCurrentPlayerName();
    if (!currentPlayerName) { openPlayerIdentifyModal(); return; }
    renderPlayerHome();
    showView('player-home');
  }

  function openPlayerIdentifyModal(afterAction) {
    afterIdentifyAction = afterAction || null;
    $('#player-identify-input').value = '';
    $('#player-identify-error').hidden = true;
    $('#player-identify-modal').hidden = false;
  }

  function initPlayerIdentifyModal() {
    $('#player-identify-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = normalizePlayerName($('#player-identify-input').value);
      if (!name) { $('#player-identify-error').hidden = false; return; }
      Store.saveCurrentPlayerName(name);
      Store.rememberPlayerNames([name]);
      currentPlayerName = name;
      $('#player-identify-modal').hidden = true;
      const action = afterIdentifyAction;
      afterIdentifyAction = null;
      if (action) action(); else { renderPlayerHome(); showView('player-home'); }
    });
    $('#player-identify-cancel').addEventListener('click', () => {
      $('#player-identify-modal').hidden = true;
      afterIdentifyAction = null;
      // Sin jugador identificado todavía no hay Home (ni carga de partido) que mostrar, así
      // que no lo dejamos varado con el modal cerrado y nada detrás — vuelve a la pantalla
      // actual. Este modal solo se abre sin jugador identificado (ver comentario arriba).
      if (!currentPlayerName) showView('setup');
    });
  }

  // Auditoría funcional (§5) — "Cerrar sesión": borra ÚNICAMENTE el jugador actual, nunca el
  // Historial ni los partidos guardados (son datos globales del dispositivo, no del jugador).
  // Vuelve a la pantalla tradicional; la próxima vez que se entre a "Mi pádel" va a pedir
  // "¿Quién sos?" de nuevo, porque currentPlayerName ya no existe.
  function logoutCurrentPlayer() {
    Store.clearCurrentPlayerName();
    currentPlayerName = null;
    showView('setup');
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
    currentPlayerName = Store.loadCurrentPlayerName();
    if (!currentPlayerName) { openPlayerIdentifyModal(); return; }
    renderActiveMatchBanner();
    const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentPlayerName);

    renderPlayerHitos(matches);
    renderPlayerCard(matches);
    renderPlayerLastMatchCard(matches);
    $('#player-home-momento-text').textContent = PH.buildTuMomentoText(matches, currentPlayerName);
    renderPlayerActivity(matches);
    renderPlayerEffectiveness(matches);
    renderPlayerWidgets(matches);
  }

  /** §5 — Hitos personales: como máximo 2, ocultos por completo si no hay ninguno
   *  justificado (PH.computeHitos ya decide eso; acá solo se pinta lo que devuelve). */
  function renderPlayerHitos(matches) {
    const hitos = PH.computeHitos(matches, currentPlayerName);
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
  function renderPlayerCard(matches) {
    $('#player-home-avatar').textContent = playerInitials(currentPlayerName);
    $('#player-home-name').textContent = currentPlayerName;
    const n = matches.length;
    $('#player-home-match-count').textContent = n === 1 ? '1 partido en tu historia' : `${n} partidos en tu historia`;
    // `matches` ya viene filtrado a los propios del jugador (PH.filterMatchesForPlayer) — es
    // exactamente la misma noción de "mine" que usa la evolución (§4.2: nunca un Observado).
    const evolution = PH.computeLevelEvolution(matches, currentPlayerName);
    $('#player-home-level-value').textContent = evolution.current.toFixed(1);
    const delta = formatLevelDelta(evolution.lastDelta);
    const deltaEl = $('#player-home-level-delta');
    deltaEl.textContent = delta.label;
    deltaEl.className = 'player-card__level-delta player-card__level-delta--' + delta.direction;
    $('#player-home-level-bar').style.width = levelProgressPct(evolution.current) + '%';
  }

  /** §7 — Último partido: volanta de forma reciente (último indicador = este partido, con
   *  glow sutil de victoria/derrota) + fecha/hora/lugar arriba; resultado protagonista;
   *  parejas en secundario. Estado vacío: mismo flujo del botón central "+". El click de
   *  toda la tarjeta se resuelve en initPlayerHomeScreen() (ver más abajo), no acá — así no
   *  hace falta reasignar un listener nuevo en cada render. */
  function renderPlayerLastMatchCard(matches) {
    const card = $('#player-home-last-match-card');
    const body = $('#player-home-last-match-body');
    // Ajuste visual de cierre 01 (§3) — línea de acento fina (lima/coral) según resultado:
    // se resetea siempre primero, se vuelve a aplicar más abajo solo si hay partido con
    // ganador definido.
    card.classList.remove('player-home-lastmatch--win', 'player-home-lastmatch--loss');
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
    const myTeam = PH.getPlayerTeam(m, currentPlayerName);
    const partner = PH.getPartnerName(m, currentPlayerName);
    const rivals = PH.getOpponentNames(m, currentPlayerName);
    const finishedSetsStr = m.sets.map(formatSetSegmentLabel).join(' · ');
    const partialSetStr = m.currentPartial ? `${m.currentPartial.gamesA}-${m.currentPartial.gamesB}*` : '';
    const scoreStr = [finishedSetsStr, partialSetStr].filter(Boolean).join(' · ') || 'sin sets';
    const resultKind = !m.winnerTeam ? 'neutral' : (m.winnerTeam === myTeam ? 'win' : 'loss');
    const resultLabel = { win: 'VICTORIA', loss: 'DERROTA', neutral: 'SIN DEFINICIÓN' }[resultKind];
    if (resultKind === 'win' || resultKind === 'loss') card.classList.add('player-home-lastmatch--' + resultKind);
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
    const formOldestFirst = PH.computeRecentForm(matches, currentPlayerName, 5).slice().reverse();
    const formDotsHtml = formOldestFirst.map((f, i) => {
      const isCurrent = i === formOldestFirst.length - 1;
      const cls = `lastmatch-form-dot lastmatch-form-dot--${f.result}${isCurrent ? ' lastmatch-form-dot--current' : ''}`;
      return `<span class="${cls}" aria-label="${RESULT_LABEL[f.result]}"></span>`;
    }).join('');

    const teamAName = [currentPlayerName, partner].filter(Boolean).join(' / ') || '—';
    const teamBName = rivals.join(' / ') || '—';

    body.innerHTML = `
      <div class="player-home-lastmatch__top">
        <div class="player-home-lastmatch__heading">
          <div class="player-home-lastmatch__form">${formDotsHtml}</div>
          <span class="player-home-lastmatch__title">ÚLTIMO PARTIDO</span>
          <span class="player-home-lastmatch__badge player-home-lastmatch__badge--${resultKind}">${resultLabel}</span>
        </div>
        <div class="player-home-lastmatch__datetime">
          ${dateTimeStr ? `<div class="player-home-lastmatch__date">${dateTimeStr}</div>` : ''}
          ${placeStr ? `<div class="player-home-lastmatch__place">${escapeHtml(placeStr)}</div>` : ''}
        </div>
      </div>
      <div class="player-home-lastmatch__score">${scoreStr}</div>
      <div class="player-home-lastmatch__teamsrow">
        <div class="player-home-lastmatch__teams">${escapeHtml(teamAName)}<span class="vs-sep">vs</span>${escapeHtml(teamBName)}</div>
        <span class="player-home-lastmatch__chevron" aria-hidden="true">›</span>
      </div>
    `;
  }

  /** §9 — Actividad: 4 bloques cronológicos (más antiguo→más reciente, izquierda→derecha);
   *  la altura de cada bloque representa cantidad de partidos y, dentro de cada uno, la
   *  porción lima (abajo) son las victorias — el resto de la altura queda con el fondo
   *  apagado del propio bloque, sin dibujar la derrota como una capa aparte. */
  function renderPlayerActivity(matches) {
    const activity = PH.computeActivity30d(matches, currentPlayerName);
    const wrap = $('#player-home-activity-bars');
    const maxCount = Math.max(1, ...activity.buckets.map((b) => b.count));
    wrap.innerHTML = activity.buckets.map((b) => {
      const heightPct = b.count ? Math.max(14, Math.round((b.count / maxCount) * 100)) : 6;
      const winPct = b.count ? Math.round((b.wins / b.count) * 100) : 0;
      return `<div class="activity-bar" style="height:${heightPct}%"><span class="activity-bar__win" style="height:${winPct}%"></span></div>`;
    }).join('');
    $('#player-home-activity-total').textContent = activity.total
      ? `${activity.total} ${activity.total === 1 ? 'partido' : 'partidos'} en los últimos 30 días`
      : 'Sin partidos en los últimos 30 días';
  }

  /** §9 — Efectividad: donut con % de victorias sobre partidos CONSIDERADOS (con resultado
   *  definido) en los últimos 30 días. Mismo mecanismo de anillo que el popup de Highlight
   *  (stroke-dasharray sobre la circunferencia real del círculo, r=15.5). */
  function renderPlayerEffectiveness(matches) {
    const eff = PH.computeEffectiveness30d(matches, currentPlayerName);
    const ring = $('#player-home-effectiveness-ring');
    const circumference = 2 * Math.PI * 15.5;
    if (eff.pct === null) {
      // Sin muestra: ni un punto residual del linecap redondeado con dasharray "0" — se oculta
      // el trazo entero (opacity, no display:none, para no desalinear el <svg>).
      ring.style.opacity = '0';
      $('#player-home-effectiveness-value').textContent = '—';
      $('#player-home-effectiveness-caption').textContent = 'Sin partidos considerados';
      return;
    }
    ring.style.opacity = '1';
    const filled = (eff.pct / 100) * circumference;
    ring.style.strokeDasharray = `${filled} ${circumference}`;
    $('#player-home-effectiveness-value').textContent = `${eff.pct}%`;
    $('#player-home-effectiveness-caption').textContent = `${eff.wins} de ${eff.considered}`;
  }

  /** §10 — Cuatro métricas pequeñas: Racha actual (consecutiva desde el partido más reciente,
   *  no la mejor histórica), Partidos totales (real, sin importar la muestra), Mejor
   *  compañero (mayor efectividad con muestra mínima de 3, no el más repetido) y Rival más
   *  enfrentado (sin cambios respecto a Etapa 2/3). */
  function renderPlayerWidgets(matches) {
    const streak = PH.computeCurrentStreak(matches, currentPlayerName);
    const total = matches.length;
    const partner = PH.computeBestPartner(matches, currentPlayerName);
    const rival = PH.computeMostFrequentRival(matches, currentPlayerName);

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
      const matches = PH.filterMatchesForPlayer(Store.loadHistory(), currentPlayerName);
      if (!matches.length) { openManualLoadScreen('player-home'); return; }
      analysisOpenedFrom = 'player-home';
      renderAnalysis(matches[0]);
      showView('analysis');
    });
  }

  function initPlayerHomeScreen() {
    $('#player-home-logo').addEventListener('click', () => showView('setup'));
    $('#active-match-banner').addEventListener('click', continueActiveMatch);
    initPlayerHomeLastMatchCard();
    initPlayerIdentifyModal();
    initNotificationsModal();
  }

  function initNotificationsModal() {
    $('#player-home-bell-btn').addEventListener('click', () => { $('#notifications-modal').hidden = false; });
    $('#notifications-close').addEventListener('click', () => { $('#notifications-modal').hidden = true; });
    $('#notifications-modal').addEventListener('click', (e) => { if (e.target === $('#notifications-modal')) $('#notifications-modal').hidden = true; });
  }

  function initRankingScreen() {
    $('#ranking-back-btn').addEventListener('click', () => showView('player-home'));
  }

  function renderProfileView() {
    const name = Store.loadCurrentPlayerName();
    $('#profile-name').textContent = name || '—';
    const count = name ? PH.filterMatchesForPlayer(Store.loadHistory(), name).length : 0;
    $('#profile-match-count').textContent = count === 1 ? '1 partido cargado' : `${count} partidos cargados`;
    renderProfileEvolution();
  }

  /* ------------------------------------------------------------------ */
  /* ETAPA 4.1 (§4) — GRÁFICO DE EVOLUCIÓN DEL NIVEL BRAMU (Perfil)
   *  Consume PH.computeLevelEvolution (pura). El SVG se reconstruye entero en cada render
   *  (mismo patrón que el resto de los gráficos de la app — buildEvolutionSvgHTML/
   *  buildGamesEvolutionSvgHTML más arriba), con delegación de click/teclado en un único
   *  listener sobre el contenedor (ver initProfileScreen) en vez de uno por punto. */
  /* ------------------------------------------------------------------ */
  let profileEvolutionData = null; // último PH.computeLevelEvolution renderizado — lo usa el detalle de punto

  const LEVEL_CHART_HEIGHT = 160;
  const LEVEL_CHART_PAD_X = 26;
  const LEVEL_CHART_PAD_TOP = 16;
  const LEVEL_CHART_PAD_BOTTOM = 26;
  const LEVEL_CHART_POINT_SPACING = 56;
  const LEVEL_CHART_MIN_WIDTH = 300;

  /** §4.4 — línea temporal izquierda→derecha, un nivel mayor se dibuja más arriba. El rango
   *  vertical se adapta a los datos reales (con margen visual) en vez de fijarse siempre a
   *  [1,10] — a la escala de esta regla simulada (movimientos de 0.1/0.2), un rango fijo de
   *  9 puntos aplastaría cualquier variación real a una línea casi recta. Con más partidos de
   *  los que entran cómodos en el ancho visible, el SVG crece de ancho intrínseco (spacing
   *  fijo por punto) dentro de un contenedor con scroll horizontal — nunca aprieta los puntos
   *  hasta volver las fechas ilegibles (§4.4). Con 1 solo punto no se dibuja ninguna línea
   *  (`coords.length > 1` — nunca "inventar una línea" con un solo dato real). */
  function buildLevelEvolutionSvgHTML(evolution) {
    const points = evolution.points;
    if (!points.length) return '';
    const levels = points.map((p) => p.level);
    const rawMin = Math.min(evolution.base, ...levels);
    const rawMax = Math.max(evolution.base, ...levels);
    const span = Math.max(0.4, rawMax - rawMin);
    const pad = Math.max(0.2, span * 0.25);
    const yMin = rawMin - pad, yMax = rawMax + pad;
    const width = Math.max(LEVEL_CHART_MIN_WIDTH, LEVEL_CHART_PAD_X * 2 + (points.length - 1) * LEVEL_CHART_POINT_SPACING);
    const plotW = width - LEVEL_CHART_PAD_X * 2;
    const plotH = LEVEL_CHART_HEIGHT - LEVEL_CHART_PAD_TOP - LEVEL_CHART_PAD_BOTTOM;
    const xAt = (i) => (points.length === 1 ? width / 2 : LEVEL_CHART_PAD_X + (i / (points.length - 1)) * plotW);
    const yAt = (level) => LEVEL_CHART_PAD_TOP + (1 - (level - yMin) / (yMax - yMin)) * plotH;

    const gridHTML = [0, 0.5, 1].map((t) => {
      const y = (LEVEL_CHART_PAD_TOP + t * plotH).toFixed(1);
      return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" class="evolution-chart__grid" />`;
    }).join('');

    const coords = points.map((p, i) => [xAt(i), yAt(p.level)]);
    const pathD = coords.length > 1 ? 'M ' + coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ') : '';
    const lineHTML = pathD ? `<path d="${pathD}" class="evolution-chart__line" fill="none" />` : '';

    const lastIdx = points.length - 1;
    const dotsHTML = coords.map(([x, y], i) => {
      const isLast = i === lastIdx;
      const cls = 'evolution-chart__dot' + (isLast ? ' evolution-chart__dot--current' : '');
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isLast ? 5 : 3.5}" class="${cls}" data-index="${i}" tabindex="0" role="button" aria-label="Partido ${i + 1} de ${points.length}, nivel ${points[i].level.toFixed(1)}"></circle>`;
    }).join('');

    return `<svg viewBox="0 0 ${width} ${LEVEL_CHART_HEIGHT}" width="${width}" height="${LEVEL_CHART_HEIGHT}" class="evolution-chart__svg">${gridHTML}${lineHTML}${dotsHTML}</svg>`;
  }

  /** §4.4 — "Al tocar un punto: fecha, resultado, victoria o derrota, rivales y nivel
   *  resultante." Texto plano dentro de la misma tarjeta, sin abrir nada nuevo. */
  function showLevelPointDetail(evolution, index) {
    const p = evolution.points[index];
    const el = $('#evolution-point-detail');
    if (!p) { el.hidden = true; return; }
    const resultLabel = p.result === 'win' ? 'Victoria' : 'Derrota';
    const rivalsStr = p.rivals.join(' / ') || '—';
    el.hidden = false;
    el.textContent = `${formatRealDate(p.playedAt)} · ${resultLabel} vs ${rivalsStr} · Nivel ${p.level.toFixed(1)}`;
  }

  /** §4.1/§4.5 — resumen numérico + gráfico. Nivel actual y "variación del último partido"
   *  van en la Tarjeta de jugador del Home (renderPlayerCard); acá van los 3 datos propios de
   *  esta tarjeta: nivel actual, CAMBIO ACUMULADO desde la base (no el último movimiento) y
   *  cantidad de partidos considerados — nunca predicciones ni percentiles (§4.5). */
  function renderProfileEvolution() {
    const history = Store.loadHistory();
    const evolution = PH.computeLevelEvolution(history, currentPlayerName);
    profileEvolutionData = evolution;

    $('#evolution-current-value').textContent = evolution.current.toFixed(1);
    const change = formatLevelDelta(evolution.changeFromBase);
    $('#evolution-change-value').textContent = evolution.consideredCount ? change.label : '—';
    $('#evolution-count-value').textContent = String(evolution.consideredCount);
    $('#evolution-point-detail').hidden = true;

    const wrap = $('#evolution-chart-wrap');
    if (!evolution.points.length) {
      wrap.innerHTML = '';
      $('#evolution-empty').hidden = false;
    } else {
      $('#evolution-empty').hidden = true;
      wrap.innerHTML = buildLevelEvolutionSvgHTML(evolution);
    }
  }

  function initProfileScreen() {
    $('#profile-back-btn').addEventListener('click', () => showView('player-home'));
    $('#profile-logout-btn').addEventListener('click', logoutCurrentPlayer);
    const chartWrap = $('#evolution-chart-wrap');
    chartWrap.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-index]');
      if (!dot || !profileEvolutionData) return;
      showLevelPointDetail(profileEvolutionData, Number(dot.dataset.index));
    });
    chartWrap.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const dot = e.target.closest('[data-index]');
      if (!dot || !profileEvolutionData) return;
      e.preventDefault();
      showLevelPointDetail(profileEvolutionData, Number(dot.dataset.index));
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
        else if (target === 'ranking') showView('ranking');
        else if (target === 'profile') { renderProfileView(); showView('profile'); }
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
    wrap.style.cssText = 'width:540px; background:#0B1211; display:block;'
      + '--ink:#0B1211; --ink-soft:#10201D; --ink-softer:#16281F; --paper:#F4F7F2;'
      + '--paper-dim:rgba(244,247,242,0.56); --paper-faint:rgba(244,247,242,0.30);'
      + '--team-a:#C8FF3D; --team-a-deep:#7FBF14; --team-b:#33A6FF; --team-b-deep:#1E6FBF;'
      + '--gold:#FFC93D; --star:#FFA93D; --danger:#FF5B54; --line:rgba(244,247,242,0.10);';
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
    initSummaryScreen();
    initAnalysisScreen();
    initTimelineScreen();
    initHistoryScreen();
    initManualLoadScreen();
    initPlayerHomeScreen();
    initRankingScreen();
    initProfileScreen();
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
   *  alcanza para traer los archivos nuevos. */
  async function forceUpdateApp() {
    $('#dev-tools-force-update').disabled = true;
    $('#dev-tools-force-update').textContent = 'Actualizando…';
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
