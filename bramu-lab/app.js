/* ==========================================================================
   BRAMU Lab — app.js (v9)
   ========================================================================== */
(function () {
  'use strict';
  const E = window.PLEngine;
  const S = window.PLStats;
  const Store = window.PLStore;
  const $ = (sel) => document.querySelector(sel);
  const $all = (sel) => Array.from(document.querySelectorAll(sel));

  /* ------------------------------------------------------------------ */
  /* ESTADO GLOBAL                                                        */
  /* ------------------------------------------------------------------ */
  let match = null;
  let pointEvents = [];
  let highlights = [];
  let serverKnowledge = null;
  let manualFinish = null; // { reason, reasonLabel, declaredWinner } | null
  let finishedSnapshot = null;

  const timer = { startedAt: null, pausedAt: null, totalPausedMs: 0, intervalId: null };

  let lastServerPromptCtx = null;
  let pendingConfirmAccept = null;
  let selectedFinishReason = 'tiempo';
  let selectedFinishWinner = 'none';
  let analysisOpenedFrom = 'setup'; // 'live' | 'history' | 'setup'
  let currentHistoryContext = null; // matchId visto en Análisis cuando viene del Historial
  let analysisCurrent = null; // snapshot mostrado actualmente en Análisis (Bloque P: VER RESUMEN)
  let analysisSetFilter = 'match'; // 'match' | 1 | 2 | 3 — selector compartido Estadísticas/Evolución (S2/V5)
  let summaryViewSource = 'live'; // 'live' | 'analysis' — de dónde se abrió el Resumen (Bloque P/AA1)

  function currentFormat() { return E.FORMATS[match.formatId]; }

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

  function showView(name) {
    ['setup', 'match', 'analysis', 'history', 'timeline'].forEach((v) => { $(`#view-${v}`).hidden = v !== name; });
    if (name !== 'match') $('#view-summary').hidden = true;
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
      match, pointEvents, highlights, serverKnowledge, manualFinish,
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

  const SCORING_HINTS = {
    starpoint: 'Dos ventajas y luego punto decisivo',
    golden: 'Punto decisivo en 40–40',
    classic: 'Deuce + ventaja',
  };

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
    $('#open-history-btn').addEventListener('click', () => { renderHistory(); showView('history'); });
    $('#continue-match-btn').addEventListener('click', continueActiveMatch);

    refreshKnownPlayersDatalist();
    checkForActiveMatch();
  }

  function refreshKnownPlayersDatalist() {
    const dl = $('#known-players');
    dl.innerHTML = '';
    Store.loadPlayerNames().forEach((n) => { const opt = document.createElement('option'); opt.value = n; dl.appendChild(opt); });
  }

  function checkForActiveMatch() {
    const snap = Store.loadActiveMatch();
    if (snap && snap.match && !snap.finished) {
      const state = E.computeStateFromEvents(snap.pointEvents, snap.match.scoringSystem, E.FORMATS[snap.match.formatId], snap.match.tiebreakMode, snap.match.baseline);
      $('#continue-banner-detail').textContent = `Set ${state.sets.length + 1} · ${state.gamesA}-${state.gamesB}`;
      $('#continue-banner').hidden = false;
    } else {
      $('#continue-banner').hidden = true;
    }
  }

  function makeMatchId() { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Bloque B5: normaliza nombres al guardar — capitalización de palabras, sin pisar
   *  mayúsculas/minúsculas internas arbitrarias del usuario (nunca todo mayúsculas). */
  function normalizePlayerName(raw) {
    const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return trimmed;
    return trimmed.split(' ').map((word) => {
      if (!word) return word;
      return word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es');
    }).join(' ');
  }

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
    if (timer.pausedAt) { $('#pause-overlay').hidden = false; } else { startTimerLoop(); }
    render();
    autosave();
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
    const servingTeam = serverInfo.resolved ? serverInfo.team : null;

    // Modalidades de TB todavía compatibles con lo realmente jugado (V5 — G3/G4).
    let availableTbModes = null;
    if (state.inTiebreak) {
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
    renderScoreboard(state, ctx.disp);
    renderServerPrompt(state, serverInfo);
    renderZonePlayers(state, serverInfo);

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
    render();
    showToast('Partido reanudado');
  }

  // V10 (42) — etiquetas visibles de las categorías opcionales de Highlight.
  const HIGHLIGHT_CATEGORY_LABELS = { smash: 'Smash / X3', dejada: 'Dejada', recuperacion: 'Recuperación', puntazo: 'Puntazo' };
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
        closeHighlightPopup();
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
  /* MENÚ                                                                 */
  /* ------------------------------------------------------------------ */
  function initMenu() {
    $('#menu-btn').addEventListener('click', () => { updateMenuPauseLabel(); $('#menu-overlay').hidden = false; });
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

  function goHome() {
    stopTimerLoop();
    Store.clearActiveMatch();
    match = null;
    $('#pause-overlay').hidden = true;
    $('#view-summary').hidden = true;
    checkForActiveMatch();
    showView('setup');
  }

  /* ------------------------------------------------------------------ */
  /* CONFIRMACIÓN GENÉRICA                                                */
  /* ------------------------------------------------------------------ */
  function confirmAction(title, text, onAccept) {
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    pendingConfirmAccept = onAccept;
    $('#confirm-overlay').hidden = false;
  }
  function initConfirmModal() {
    $('#confirm-cancel').addEventListener('click', () => { $('#confirm-overlay').hidden = true; pendingConfirmAccept = null; });
    $('#confirm-accept').addEventListener('click', () => {
      $('#confirm-overlay').hidden = true;
      const fn = pendingConfirmAccept; pendingConfirmAccept = null;
      if (fn) fn();
    });
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
  /* FIN DE PARTIDO — resumen inmediato                                   */
  /* ------------------------------------------------------------------ */
  function finishMatch(state, manual) {
    stopTimerLoop();
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
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      timeZone: match.timeZone,
      finishedAt: new Date().toISOString(),
      players: match.players,
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

  /* ------------------------------------------------------------------ */
  /* COMPONENTE DE RESULTADO TIPO TV (V5 — reutilizado en Resumen/Análisis, Bloque Q) */
  /* ------------------------------------------------------------------ */

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
        return `<span class="result-card__set ${mine > theirs ? 'result-card__set--win' : 'result-card__set--lose'}">${mine}</span>`;
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
      const cells = f.stats.setDurations.map((d) => `<span class="result-card__duration-cell">${formatDuration(d.ms)}</span>`).join('');
      const pad = f.currentPartial ? '<span class="result-card__duration-cell"></span>' : '';
      durationsHTML = `<div class="result-card__durations">${cells}${pad}</div>`;
    }

    let footerHTML = '';
    if (f.terminationType === 'manual') {
      footerHTML = `<div class="result-card__footer"><span>Finalizado manualmente</span><span>${f.terminationReasonLabel}</span></div>`;
      footerHTML += `<div class="result-card__incomplete-note">* Set incompleto al momento de finalizar</div>`;
    }

    const durLabel = (isDurationUnknownStart(f) ? 'Tiempo registrado' : 'Duración total') + ' · ' + formatDuration(f.durationMs);
    const statsBlockHTML = opts.statsHTML ? `<div class="result-card__divider"></div><div class="result-card__stats">${opts.statsHTML}</div>` : '';

    return `<div class="result-card">
      ${durationsHTML}
      ${cellsForTeam('A')}
      ${cellsForTeam('B')}
      ${footerHTML}
      ${statsBlockHTML}
      <p class="result-card__duration-total">${durLabel}</p>
    </div>`;
  }

  /** Componente de resultado usado en Análisis (score + duración; las estadísticas completas
   *  viven en su propia sección más abajo, así que acá NO se fusionan). */
  function buildResultBlockHTML(f) { return buildWinnersBannerHTML(f) + buildScoreCardHTML(f); }

  /** V6 (21-27): tarjeta única del Resumen del partido — fusiona resultado + duración por set +
   *  estadísticas rápidas + duración total en UN solo componente visual grande. */
  function buildSummaryCardHTML(f) {
    return buildWinnersBannerHTML(f) + buildScoreCardHTML(f, { statsHTML: buildSummaryStatsHTML(f) });
  }

  /** Bloque N: legal de datos parciales — se muestra solo cuando corresponde (nunca en partido completo sin ajustes). */
  function buildCoverageLegalHTML(f) {
    if (f.stats && f.stats.hasAdjustments) {
      return '<p class="coverage-note">Marcador ajustado manualmente · Estadísticas basadas en puntos registrados</p>';
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
    $('#summary-result-slot').innerHTML = buildSummaryCardHTML(f);
    $('#summary-legal').innerHTML = buildCoverageLegalHTML(f);
    $('#summary-undo-btn').hidden = !isLiveMatch || f.terminationType !== 'automatic';
    $('#summary-resume-btn').hidden = !isLiveMatch || f.terminationType !== 'manual';
    $('#summary-back-btn').hidden = isLiveMatch;
    $('#summary-new-btn').hidden = !isLiveMatch;
  }

  function initSummaryScreen() {
    $('#summary-new-btn').addEventListener('click', () => {
      Store.clearActiveMatch();
      match = null;
      checkForActiveMatch();
      showView('setup');
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
    $('#summary-undo-btn').addEventListener('click', undoLastPoint);
    $('#summary-resume-btn').addEventListener('click', resumeMatch);
    $('#summary-back-btn').addEventListener('click', () => { renderAnalysis(analysisCurrent); showView('analysis'); });
  }

  /* ------------------------------------------------------------------ */
  /* ANÁLISIS COMPLETO                                                    */
  /* ------------------------------------------------------------------ */
  function renderAnalysis(f) {
    analysisCurrent = f;
    analysisSetFilter = 'match'; // Bloque S2/V5: siempre arranca en PARTIDO al abrir/cambiar de partido
    $('#analysis-result').innerHTML = buildResultBlockHTML(f);
    $('#analysis-intelligence-text').innerHTML = f.intelligence.split('\n\n').map((p) => `<p>${p}</p>`).join('');
    const covNote = $('#analysis-coverage-note');
    const legalHTML = buildCoverageLegalHTML(f);
    if (legalHTML) { covNote.hidden = false; covNote.innerHTML = legalHTML; } else { covNote.hidden = true; covNote.innerHTML = ''; }

    renderStatsGrid(f);
    renderEvolutionChart(f);
    renderHighlightsSection(f);
    renderKeyMoments(f);

    $('#analysis-full-timeline-btn').onclick = () => { renderFullTimeline(f); showView('timeline'); };
    $('#analysis-share-btn').onclick = () => shareResult(f, 'analisis');
    // V11 (§16.2): cierra el recorrido sin obligar al usuario a volver con la flecha. Solo
    // navega — nunca Store.clearActiveMatch(), porque Análisis puede abrirse tanto desde el
    // partido recién terminado como desde el Historial de un partido viejo, y en ese segundo
    // caso podría haber un partido EN VIVO distinto todavía activo que no hay que borrar.
    $('#analysis-home-btn').onclick = () => { checkForActiveMatch(); showView('setup'); };
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

    const bpA = stats.breakPoints.A, bpB = stats.breakPoints.B;
    if (serverGap) {
      rowsHTML.push(dashRowHTML('Break points'));
    } else {
      const bpPctA = bpA.opportunities ? (bpA.converted / bpA.opportunities) * 100 : 0;
      const bpPctB = bpB.opportunities ? (bpB.converted / bpB.opportunities) * 100 : 0;
      rowsHTML.push(mirrorBarRowHTML('Break points', S.fmtOpp(stats.breakPoints, 'A'), S.fmtOpp(stats.breakPoints, 'B'), bpPctA, bpPctB, false));
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
    rowsHTML.push(noBarRowHTML('Racha máxima de puntos', stats.maxStreak.A, stats.maxStreak.B));
    return rowsHTML.join('');
  }

  function buildStatsLegalText(stats) {
    const serverGap = !stats.hasServerInfo;
    if (serverGap) return 'No se pudo determinar el saque en este tramo: las métricas que dependen de él no están disponibles (—).';
    if (!stats.serverFullyKnown) return 'El saque no se conoce en todos los puntos de este tramo: estas métricas son parciales.';
    return '';
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

  function renderStatsGrid(f) {
    renderSetFilterTabs('#stats-set-filter', f, () => { renderStatsGrid(f); renderEvolutionChart(f); });
    const stats = statsForCurrentFilter(f);
    $('#analysis-stats-grid').innerHTML = buildStatsGridRowsHTML(f, stats);

    // T2: UNA sola aclaración general, no repetida en cada fila.
    const legalEl = $('#analysis-stats-legal');
    const legalText = buildStatsLegalText(stats);
    legalEl.hidden = !legalText;
    legalEl.textContent = legalText;

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
    const games = setFilter === 'match' ? allGames : allGames.filter((g) => g.setNumber === setFilter);
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
    function buildGameCheckpointsSvg(gamesArr) {
      let svg = '';
      let withinSetGameCounter = 0;
      gamesArr.forEach((g, i) => {
        if (g.isVirtualStart) return;
        withinSetGameCounter += 1;
        if (g.isTiebreakClose) return;
        if (withinSetGameCounter < 3 || withinSetGameCounter % 2 !== 1) return;
        const x = xScale(i);
        svg += `<line x1="${x.toFixed(1)}" y1="${topPad}" x2="${x.toFixed(1)}" y2="${h}" stroke="rgba(244,247,242,0.18)" stroke-width="1"/>`;
        svg += `<text x="${x.toFixed(1)}" y="${h + 11}" font-size="7.5" fill="rgba(244,247,242,0.45)" text-anchor="middle">${g.gamesA}-${g.gamesB}</text>`;
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
      // lectura ahí (hoy queda casi vacía) sin saturar. Clásico se mantiene limpio.
      if (isSingleSetFormat) setLabelsSvg += buildGameCheckpointsSvg(games);
    } else {
      setLabelsSvg += buildGameCheckpointsSvg(games);
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
      const scoreLabel = h.score.tiebreak ? `${h.score.a}-${h.score.b} (TB)` : highlightScoreLabel(h);
      const categoryLabel = h.category ? HIGHLIGHT_CATEGORY_LABELS[h.category] : null;
      return `<div class="highlight-row">
        <span class="highlight-row__time">⭐ ${formatClock(h.matchTimeMs)} · ${formatRealTime(h.timestamp, f.timeZone)}</span>
        <span class="highlight-row__meta">${categoryLabel ? categoryLabel + ' · ' : ''}Set ${h.set} · ${h.games.a}-${h.games.b} · ${scoreLabel}${h.server ? ' · Saca ' + h.server.name : ''}</span>
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
        state = E.applyAdjustment(ev.newState);
        facts.push({ ms: ev.matchTimeMs, real: ev.timestamp, label: `✎ AJUSTE DE MARCADOR · ${ev.scoreBeforeLabel} → ${ev.scoreAfterLabel}` });
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
      const scoreStr = structural.sets.map((s) => `${s.gamesA}-${s.gamesB}`).join(' · ');
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
    $('#analysis-keymoments-list').innerHTML = buildKeyMomentsListHTML(f);
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
        state = E.applyAdjustment(ev.newState);
        const setGroup = ensureSet(state.sets.length + 1);
        setGroup.items.push({ type: 'adjustment', label: `✎ Ajuste de marcador · ${ev.scoreBeforeLabel} → ${ev.scoreAfterLabel}` });
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

  function initTimelineScreen() { $('#timeline-back-btn').addEventListener('click', () => showView('analysis')); }

  function initAnalysisScreen() {
    $('#analysis-back-btn').addEventListener('click', () => {
      if (analysisOpenedFrom === 'live' && finishedSnapshot) { $('#view-summary').hidden = false; showView('match'); }
      else if (analysisOpenedFrom === 'history') { renderHistory(); showView('history'); }
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
  /* HISTORIAL                                                            */
  /* ------------------------------------------------------------------ */
  const HISTORY_SCORING_LABELS = { golden: 'PUNTO DE ORO', starpoint: 'STAR POINT', classic: 'CON VENTAJA' };

  function renderHistory() {
    const list = Store.loadHistory();
    const wrap = $('#history-list');
    wrap.innerHTML = '';
    $('#history-empty').hidden = list.length > 0;
    list.forEach((m) => {
      const nameA = S.teamLabel(m.players, 'A'), nameB = S.teamLabel(m.players, 'B');
      // V8.2 (32): BUG de auditoría — antes usaba `sets.map(...).join(' · ') || currentPartial`,
      // así que en cuanto había AL MENOS un set terminado, el `||` nunca llegaba a mirar
      // `currentPartial` y el último set incompleto (partido finalizado manualmente a mitad
      // de un set) desaparecía del Historial. Ahora ambos se concatenan cuando corresponde:
      // sets terminados primero, y el set parcial al final marcado con "*".
      const finishedSetsStr = m.sets.map((s) => `${s.gamesA}-${s.gamesB}`).join(' · ');
      const partialSetStr = m.currentPartial ? `${m.currentPartial.gamesA}-${m.currentPartial.gamesB}*` : '';
      const scoreStr = [finishedSetsStr, partialSetStr].filter(Boolean).join(' · ') || 'sin sets';
      const formatLabel = (E.FORMATS[m.formatId] && E.FORMATS[m.formatId].label || '').toUpperCase();
      const scoringLabel = HISTORY_SCORING_LABELS[m.scoringSystem] || '';
      const subtitleStr = [formatLabel, scoringLabel].filter(Boolean).join(' · ');
      const item = document.createElement('div');
      item.className = 'history-item';
      // V7 (45-46-107-112): mismo criterio cromático que Resumen/Análisis — el ganador se
      // destaca con el color de SU equipo (LIMA/AZUL), nunca dorado (reservado para Oro/Star).
      const winnerBadgeA = m.winnerTeam === 'A' ? ' history-item__winner history-item__winner--a' : '';
      const winnerBadgeB = m.winnerTeam === 'B' ? ' history-item__winner history-item__winner--b' : '';
      // V7 (109-111): nuevo orden — fecha → formato/método → jugadores → resultado → duración.
      item.innerHTML = `
        <div class="history-item__row">
          <div class="history-item__main">
            <div class="history-item__date">${formatRealDate(m.finishedAt, m.timeZone)} · ${formatRealTime(m.finishedAt, m.timeZone).slice(0, 5)}</div>
            ${subtitleStr ? `<div class="history-item__subtitle">${subtitleStr}</div>` : ''}
            <div class="history-item__teams"><span class="${winnerBadgeA}">${nameA}</span><span class="vs-sep">vs</span><span class="${winnerBadgeB}">${nameB}</span></div>
            <div class="history-item__score">${scoreStr}</div>
            <div class="history-item__meta"><span>${formatDuration(m.durationMs)}</span></div>
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
  function initHistoryScreen() { $('#history-back-btn').addEventListener('click', () => showView('setup')); }

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
    const footer = `<div class="share-capture__footer"><span>${formatRealDate(f.finishedAt, f.timeZone)} · ${formatRealTime(f.finishedAt, f.timeZone)}</span><span class="share-capture__brand-mini"><span class="share-capture__brand-mini-accent">BRAMU</span> lab</span></div>`;

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
      body += `<div class="share-capture__section"><h3 class="analysis-section__title">ESTADÍSTICAS</h3><div class="stats-grid">${buildStatsGridRowsHTML(f, stats)}</div>${legalText ? `<p class="coverage-note">${legalText}</p>` : ''}</div>`;
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
    $('#zone-a').addEventListener('click', () => registerPoint('A'));
    $('#zone-b').addEventListener('click', () => registerPoint('B'));
    $('#undo-btn').addEventListener('click', undoLastPoint);
    $('#highlight-btn').addEventListener('click', saveHighlight);
    $('#resume-btn').addEventListener('click', togglePause);
    $('#tiebreak-mode-select').addEventListener('change', (e) => {
      match.tiebreakMode = e.target.value;
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSetupScreen();
    initMatchInteractions();
    initHighlightPopup();
    initMenu();
    initConfirmModal();
    initFinishModal();
    initEditModal();
    initQuickCorrectionModal();
    initSummaryScreen();
    initAnalysisScreen();
    initTimelineScreen();
    initHistoryScreen();
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
})();
