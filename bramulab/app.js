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
  const Auth = window.PLAuth; // Backend Bloque 2 — Supabase Auth + RPCs de perfil real (auth.js)
  const Matches = window.PLMatches; // Backend Bloque 5 — create_or_attach_match/get_my_matches/etc. (matches.js)
  const MSync = window.PLMatchSync; // Backend Bloque 5 — traducción servidor->local + separación historial/estadísticas (match-sync.js)
  const MV = window.PLMatchValidation; // Backend Bloque 6 (Fase B) — Confirmar/corrección/identidad/notificaciones (match-validation.js)
  const IntelClient = window.PLIntelligenceClient; // Backend Bloque 8 (Fase D) — get-match-intelligence real y persistente (intelligence-client.js)
  const LV = window.PLLevel; // BRAMUlab_V04.1 (Etapa A) — motor puro de Nivel BRAMU, apagado (NIVEL_BRAMU_V1_ENABLED=false)
  const LVC = window.PLLevelCalibration; // BRAMUlab_V04.3 (Etapa C) — cuestionario/ajuste/calibración, fuente única del cálculo
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
  // BRAMUlive (2026-09-18) — se retira 'setup' de la lista: era la única vista de esta lista
  // que dependía del registro en vivo (configuración previa a un partido en vivo), separado
  // ahora a BRAMUlive. 'analysis'/'manual-load'/'match-saved' siguen acá: las usa la carga de
  // partido propio ya jugado.
  const BOTTOM_NAV_VIEWS = ['player-home', 'history', 'analysis', 'companions', 'ranking', 'profile', 'edit-data', 'complete-access', 'change-password', 'notifications', 'manual-load', 'match-saved', 'player-search', 'player-public', 'groups', 'group-settings'];

  function showView(name) {
    // BRAMUlive (2026-09-18) — se retiran 'setup'/'match'/'timeline': eran las tres vistas
    // exclusivas del registro en vivo (configuración previa, marcador y timeline completo),
    // separadas ahora a BRAMUlive como producto propio. 'analysis'/'manual-load'/'match-saved'
    // siguen acá — las usa la carga de partido propio ya jugado.
    ['analysis', 'history', 'manual-load', 'match-saved', 'player-home', 'ranking', 'profile', 'companions',
      'access', 'login', 'signup', 'player-card', 'edit-data', 'complete-access', 'change-password', 'forgot-password', 'notifications',
      'player-search', 'player-public', 'groups', 'group-settings',
      // BRAMUlab_V04.4 (Etapa D, bloque 1) — onboarding de Nivel BRAMU V1, solo detrás del flag.
      'nivel-onboarding']
      .forEach((v) => { $(`#view-${v}`).hidden = v !== name; });
    const nav = $('#bottom-nav');
    if (nav) {
      // V03.0.1 (§7) — mecanismo PRINCIPAL de "no exponer navegación personal sin sesión":
      // la barra inferior queda oculta en CUALQUIER vista mientras no haya sesión activa, no
      // solo en vistas fuera de BOTTOM_NAV_VIEWS. Se usa Store.getCurrentUser() (lectura
      // fresca) y NO la variable de módulo `currentPlayerName`: esa var solo se sincroniza en
      // puntos puntuales (openPlayerHome/openManualLoadScreen/renderPlayerHome/post-login).
      const showNav = BOTTOM_NAV_VIEWS.indexOf(name) !== -1 && !!Store.getCurrentUser();
      nav.hidden = !showNav;
      if (showNav) updateBottomNavActive(name);
      // V03.2 (§11) — alto real de la barra, medido en vivo (nunca adivinado): lo consumen
      // `.court-scroll`/`.load-keypad`/`.court-continue-wrap` (Carga manual/Confirmar
      // partido) vía `--bottomnav-h` para no quedar tapados por la nav cuando hay sesión.
      document.documentElement.style.setProperty('--bottomnav-h', showNav ? `${nav.offsetHeight}px` : '0px');
      if (name === 'manual-load') positionManualContinueBar();
    }
  }

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

  // Etapa 4.1 (§2.1) — Historial tiene un único punto de entrada real ahora: la barra
  // inferior/Home. `historyOpenedFrom` queda fijo en 'player-home' (antes también podía venir
  // de Configurar partido, vista del vivo retirada — ver Experiencia_Inicial.md §4.1).
  let historyOpenedFrom = 'player-home';
  // V02.1 (§27) — filtro contextual con el que se abrió Historial: null (normal) |
  // { type:'streak', matchIds:Set, label } | { type:'last30', label }. Vive en memoria de
  // sesión, igual criterio que el resto de los filtros de Historial (§3.3 de Etapa 4.1).
  let historyContextFilter = null;
  function openHistoryScreen(origin, contextFilter) {
    // V03.0.1 (§7) — gate interno (protección adicional, no sustituye el ocultamiento visual
    // de la barra inferior en showView): Historial es una pantalla personal, nunca debe
    // abrirse sin sesión. Mismo patrón que ya usan openPlayerHome/openManualLoadScreen.
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    historyOpenedFrom = 'player-home';
    historyContextFilter = contextFilter || null;
    // Ambos filtros contextuales son sobre partidos PROPIOS del jugador actual — forzar la
    // pestaña "Mis partidos" para que la lista mostrada sea inequívoca.
    if (historyContextFilter) historyOwnershipFilter = 'mine';
    renderHistory();
    showView('history');
    // Backend Bloque 5 — refresco "mejor esfuerzo" en segundo plano: la lista ya se pintó con
    // el cache local (nunca queda en blanco esperando la red); si el refresco trae novedades
    // (un partido nuevo cargado por un rival, una conformidad, un ocultamiento), se vuelve a
    // pintar sola cuando llega.
    if (isServerBackedSession()) refreshServerMatches().then(renderHistory);
  }

  function makeMatchId() { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Bloque B5: normaliza nombres al guardar — capitalización de palabras, sin pisar
   *  mayúsculas/minúsculas internas arbitrarias del usuario (nunca todo mayúsculas). */
  // Etapa 2 (Rama Jugador): movida a store.js (Store.normalizePlayerName) para que
  // player-home.js use exactamente el mismo criterio de normalización al filtrar el
  // historial por jugador. Se mantiene este wrapper para no tocar los ~10 call-sites
  // existentes en este archivo.
  function normalizePlayerName(raw) { return Store.normalizePlayerName(raw); }

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
  // Backend Bloque 5 (09_Resultado_Wiring_Frontend_Claude.md) — con sesión server-backed, cada
  // slot se resuelve por player_id real (nunca por nombre) — manualPlayers[slot] sigue siendo
  // el NOMBRE a mostrar (nada cambia en renderManualPlayerChip/renderManualPlayers), pero
  // manualPlayerIds[slot] es `{playerId, kind:'registered'|'provisional'}` cuando hay backend,
  // o `null` en el camino 100% local (nunca se usa ahí). Resuelto una sola vez al abrir la
  // pantalla (a1 = la sesión activa) o al elegir cada jugador (ver selectManualPlayer).
  let manualServerBacked = false;
  let manualPlayerIds = { a1: null, a2: null, b1: null, b2: null };
  // Idempotency key ESTABLE para el intento lógico actual — se genera una sola vez por carga
  // nueva y se reutiliza en cada reintento (automático o manual) del MISMO envío; una carga que
  // el usuario reabre y edita ANTES de que el servidor la haya aceptado genera una key nueva
  // (es, de verdad, un intento lógico distinto — 02_Analisis_Claude.md §5.5/§7).
  let manualSubmissionId = null;
  // localDraftId del outbox cuando se reabre un borrador todavía sync_pending/necesita_revision
  // para editarlo — null para una carga nueva o para un partido ya aceptado por el servidor.
  let manualOutboxDraftId = null;
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

  /** Backend Bloque 5 — equivalente por `player_id` de `manualExcludedNamesForSlot`: server-
   *  backed excluye por identidad real, nunca por nombre (dos jugadores reales pueden
   *  coincidir en nombre visible sin ser la misma persona). */
  function manualExcludedPlayerIdsForSlot(slot) {
    return ['a1', 'a2', 'b1', 'b2']
      .filter((s) => s !== slot)
      .map((s) => manualPlayerIds[s] && manualPlayerIds[s].playerId)
      .filter(Boolean);
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
  /** BRAMUlab_V03.6 (corrección post-QA real, prioridades 1/2) — MISMO bug de fondo encontrado
   *  en Perfil público, hallado también acá durante la investigación del contrato de identidad:
   *  estas filas compactas (Elegir compañero/rival, Buscar Jugadores, lista JUGADORES de
   *  Perfil) llamaban a `PH.computeSimulatedJugadorLevel` con el nombre plano (nunca
   *  `{name, userId}`), así que una cuenta real con partidos YA estampados caía al fallback por
   *  hash en vez de mostrar su Nivel real, y una cuenta real todavía en calibración recibía ese
   *  mismo hash como si fuera un dato real. Único punto de cálculo para estas filas: resuelve la
   *  cuenta real si existe (mismo criterio que renderPlayerPublicProfile) y aplica el mismo gate
   *  de calibración (`PH.isCalibratingRealAccount`) — `null` para una cuenta real en
   *  calibración (la fila compacta no tiene espacio para "CALIBRANDO X/5"; `buildPlayerRowHTML`
   *  ya muestra "—" para cualquier valor no numérico, mismo criterio de siempre), Nivel real
   *  para una cuenta real con historial o legacy, y el hash de siempre para nombres SIN cuenta
   *  real detrás (mock/territoriales, rivales conocidos solo por historial) — Ranking/Buscar
   *  Jugadores no pierden ningún mock. */
  function computePlayerRowLevel(history, name) {
    const account = Store.loadUsers().find((u) => u && Store.normalizePlayerName(u.displayName) === Store.normalizePlayerName(name));
    if (PH.isCalibratingRealAccount(account)) return null;
    return PH.computeSimulatedJugadorLevel(history, account ? { name, userId: account.id } : name);
  }

  /** BRAMUlab_V03.6 (hotfix — bug real §2) — "Mis jugadores" (y toda fila que pasa por acá)
   *  mostraba un @usuario FABRICADO desde el nombre (`buildPlayerHandle`) aunque el jugador
   *  tuviera una cuenta real vinculada con un @usuario propio distinto — la misma persona se
   *  veía con handles distintos en esta lista vs. su Perfil público (que sí resolvía la cuenta
   *  real, ver renderPlayerPublicProfile). Mismo criterio ya usado por Ranking/Mis Grupos
   *  (buildGroupRowAccount) — nunca inventar un handle cuando hay una cuenta real resoluble. */
  function buildPlayerRowHTML(name, level) {
    const levelText = Number.isFinite(level) ? level.toFixed(1) : '—';
    const account = buildGroupRowAccount(name);
    const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(name);
    return `<button type="button" class="player-row" data-name="${escapeHtml(name)}">
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">${escapeHtml(handle)}</span>
      </span>
      <span class="player-row__level">
        <span class="player-row__level-value">${levelText}</span>
        <span class="player-row__level-label">NIVEL BRAMU</span>
      </span>
    </button>`;
  }

  /** Backend Bloque 4 — variante de buildPlayerRowHTML para una fila YA resuelta por el
   *  servidor (`search_players`): nunca re-resuelve por nombre (`buildGroupRowAccount` solo
   *  conoce cuentas locales de ESTE dispositivo — nunca iba a encontrar a otra persona real,
   *  02_Analisis_Claude.md §5). `data-player-id` es lo que `openPlayerPublicProfile` necesita
   *  para pedir el perfil real vía `get_public_profile`, nunca por nombre. Nivel se muestra tal
   *  cual lo persiste Bloque 3 (número real desde el día 1, nunca "CALIBRANDO X/5" — ese
   *  placeholder es exclusivo del Nivel simulado local, ver renderPlayerPublicProfile). */
  function buildPlayerRowHTMLFromServerRow(row) {
    const name = row.display_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.username || 'Jugador';
    const levelText = (row.level_status && row.level_status !== 'PENDIENTE' && Number.isFinite(row.level_public)) ? row.level_public.toFixed(1) : '—';
    const handle = row.username ? `@${row.username}` : buildPlayerHandle(name);
    return `<button type="button" class="player-row" data-name="${escapeHtml(name)}" data-player-id="${escapeHtml(row.player_id)}">
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">${escapeHtml(handle)}</span>
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

  // Backend Bloque 5 (§4 de la revisión de Bloque 4, mismo criterio que
  // renderPlayerSearchResultsServerBacked) — debounce ~300ms SOLO para el camino server-backed,
  // que dispara una llamada de red por tecla; el camino local/legacy sigue filtrando en
  // memoria de forma síncrona, sin ningún cambio.
  let manualPlayerSheetDebounceId = null;

  function renderManualPlayerSheetContent(query) {
    if (manualServerBacked) {
      clearTimeout(manualPlayerSheetDebounceId);
      manualPlayerSheetDebounceId = setTimeout(() => renderManualPlayerSheetContentServerBacked(query), query ? 300 : 0);
      return;
    }
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
        recentsWrap.innerHTML = recents.map((n) => buildPlayerRowHTML(n, computePlayerRowLevel(history, n))).join('');
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
    let listHTML = matches.map((n) => buildPlayerRowHTML(n, computePlayerRowLevel(history, n))).join('');
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

  /** Backend Bloque 5 — fila de un invitado (identidad provisional) seleccionable en el sheet
   *  server-backed: creado por mí (`list_my_provisional_players`) o relacionado vía un partido
   *  compartido (`list_related_provisional_players`, Decisión #3 de 04_Revision_ChatGPT.md).
   *  Mismo componente `.player-row` que un jugador real, sin Nivel/@usuario (un invitado no
   *  tiene ninguno de los dos). */
  function buildProvisionalRowHTML(p) {
    const name = p.display_name || 'Invitado';
    return `<button type="button" class="player-row" data-name="${escapeHtml(name)}" data-player-id="${escapeHtml(p.player_id)}" data-kind="provisional">
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">Invitado</span>
      </span>
    </button>`;
  }

  /** Backend Bloque 5 (09_Resultado_Wiring_Frontend_Claude.md, punto 2) — variante server-
   *  backed del sheet de Elegir compañero/rival: los 4 lugares se resuelven SIEMPRE por
   *  `player_id` real, nunca por coincidencia de nombre. Invitados (provisionales) primero
   *  (universo chico, sin llamada por tecla); jugadores reales vía `search_players` recién con
   *  2+ caracteres (mismo mínimo que Buscar Jugadores/Bloque 4). "Agregar a…" crea una
   *  identidad provisional NUEVA — nunca reutiliza una existente por nombre parecido
   *  (Backend_Infraestructura.md §9.1: "nunca fusiona por nombre"). */
  async function renderManualPlayerSheetContentServerBacked(query) {
    const slot = manualActiveSheetSlot;
    if (!slot) return;
    const excludedIds = manualExcludedPlayerIdsForSlot(slot);
    const trimmed = (query || '').trim();

    $('#load-player-sheet-recents-section').hidden = true;
    $('#load-player-sheet-recents').innerHTML = '';
    $('#load-player-sheet-list-label').hidden = true;
    const listWrap = $('#load-player-sheet-list');

    const [relatedResult, myProvResult, searchResult] = await Promise.all([
      Matches.listRelatedProvisionalPlayers(),
      Auth.listMyProvisionalPlayers(),
      trimmed.length >= 2 ? Auth.searchPlayers(trimmed) : Promise.resolve({ ok: true, players: [] }),
    ]);

    // El sheet puede haber cambiado de slot/texto mientras esperaba estas 3 respuestas — una
    // respuesta tardía nunca debe pisar lo que el usuario ya está viendo ahora.
    if (manualActiveSheetSlot !== slot || (($('#load-player-sheet-search').value || '').trim()) !== trimmed) return;

    const provisionalById = new Map();
    (relatedResult.ok ? relatedResult.players : []).forEach((p) => provisionalById.set(p.player_id, p));
    (myProvResult.ok ? myProvResult.players : []).forEach((p) => { if (!provisionalById.has(p.player_id)) provisionalById.set(p.player_id, p); });
    const queryLower = normalizePlayerName(trimmed).toLocaleLowerCase('es');
    const provisionals = Array.from(provisionalById.values())
      .filter((p) => !excludedIds.includes(p.player_id))
      .filter((p) => !queryLower || normalizePlayerName(p.display_name || '').toLocaleLowerCase('es').includes(queryLower));

    const realRows = (searchResult.ok ? searchResult.players : []).filter((r) => !excludedIds.includes(r.player_id));

    let html = '';
    if (provisionals.length) {
      html += '<div class="load-player-sheet__list-label">INVITADOS</div>';
      html += provisionals.map(buildProvisionalRowHTML).join('');
    }
    if (realRows.length) html += realRows.map(buildPlayerRowHTMLFromServerRow).join('');
    const alreadyOffered = (n) => provisionals.some((p) => normalizePlayerName(p.display_name || '') === n)
      || realRows.some((r) => normalizePlayerName(r.display_name || '') === n);
    const canAdd = trimmed.length >= 2 && !alreadyOffered(normalizePlayerName(trimmed));
    if (canAdd) html += buildAddPlayerRowHTML(trimmed);

    listWrap.innerHTML = html || '<p class="load-player-sheet__empty">Escribí al menos 2 caracteres para buscar, o elegí un invitado.</p>';
    $all('#load-player-sheet-list .player-row[data-player-id]').forEach((btn) => {
      btn.addEventListener('click', () => selectManualPlayer(btn.dataset.name, btn.dataset.playerId, btn.dataset.kind));
    });
    if (canAdd) $('#load-player-sheet-add').addEventListener('click', () => createManualProvisionalAndSelect(trimmed));
  }

  /** Backend Bloque 4 — `create_provisional_player` SIEMPRE crea un UUID nuevo (nunca reutiliza
   *  por nombre, ver la migración de Bloque 4); acá es "agregar sin cuenta" dentro de la carga
   *  de un partido — Bloque 4 dejó explícitamente esta reutilización como responsabilidad de
   *  Bloque 5. */
  async function createManualProvisionalAndSelect(name) {
    const result = await Auth.createProvisionalPlayer(name);
    if (!result.ok) { showToast('No se pudo crear el invitado. Probá de nuevo.', 2600); return; }
    selectManualPlayer(result.player.display_name || name, result.player.player_id, 'provisional');
  }

  /** V02.2 (Bloque C, §9) — una persona no puede ocupar dos lugares en el mismo partido. La UI
   *  normal ya lo evita (RECIENTES/TODOS excluyen a quien ya está asignado, §8), pero esto es
   *  la fuente de verdad explícita: si de todos modos llega un nombre ya asignado, NO se cierra
   *  el sheet — se explica brevemente que ya participa y se deja elegir de nuevo.
   *  Backend Bloque 5 — `playerId`/`kind` opcionales: presentes en el camino server-backed
   *  (dedup por identidad real, nunca por nombre), ausentes en el camino local/legacy (sin
   *  ningún cambio de comportamiento ahí). */
  function selectManualPlayer(name, playerId, kind) {
    const slot = manualActiveSheetSlot;
    const norm = normalizePlayerName(name);
    if (!slot || !norm) return;
    if (manualServerBacked && playerId) {
      if (manualExcludedPlayerIdsForSlot(slot).includes(playerId)) {
        showToast(`${norm} ya participa en este partido.`);
        return;
      }
      manualPlayerIds[slot] = { playerId, kind: kind || 'registered' };
    } else {
      const excludedForDup = manualExcludedNamesForSlot(slot).concat([currentPlayerName]);
      if (ML.isDuplicatePlayerName(norm, excludedForDup)) {
        showToast(`${norm} ya participa en este partido.`);
        return;
      }
    }
    manualPlayers[slot] = norm;
    if (!manualServerBacked) Store.rememberPlayerNames([norm]);
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
      if (manualServerBacked) manualPlayerIds[slot] = null;
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
    if (manualServerBacked) {
      // Backend Bloque 5 — identidad real = player_id. Dos cuentas distintas pueden tener
      // exactamente el mismo display_name y siguen siendo personas distintas. La validación
      // legacy por nombre se conserva SOLO para el camino local.
      const ids = ['a1', 'a2', 'b1', 'b2'].map((slot) => manualPlayerIds[slot] && manualPlayerIds[slot].playerId);
      if (ids.some((id) => !id)) return { ok: false, reason: 'players-missing' };
      if (new Set(ids).size !== 4) return { ok: false, reason: 'players-duplicate' };

      // validateMatchDraft también valida resultado/formato/fecha. Le pasamos labels internos
      // inequívocos para reutilizar esa lógica sin volver a deduplicar por display_name.
      return ML.validateMatchDraft(
        ['__player_a1', '__player_a2', '__player_b1', '__player_b2'],
        manualSets,
        manualSelectedFormatId,
        $('#manual-date-input').value
      );
    }
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

    // Backend Bloque 5 — server-backed: los 4 lugares se resuelven por player_id real, nunca
    // por nombre. `editMatch` acá NUNCA es un partido server-backed YA aceptado por el servidor
    // (eso queda bloqueado en el propio botón "Editar partido" de Resumen — la corrección de un
    // partido ya cargado es Bloque 6): solo puede ser una carga nueva o un borrador de outbox
    // todavía sync_pending/necesita_revision.
    manualServerBacked = isServerBackedSession();
    if (manualServerBacked && editMatch && editMatch.serverBacked) {
      const byTeam = (team) => (editMatch.players || []).filter((p) => p && p.team === team);
      const teamA = byTeam('A'), teamB = byTeam('B');
      manualPlayerIds = {
        a1: { playerId: currentUserId, kind: 'registered' },
        a2: teamA[1] ? { playerId: teamA[1].userId, kind: null } : null,
        b1: teamB[0] ? { playerId: teamB[0].userId, kind: null } : null,
        b2: teamB[1] ? { playerId: teamB[1].userId, kind: null } : null,
      };
      // Reabrir un borrador todavía sin sincronizar para editarlo es, de verdad, un intento
      // lógico nuevo (02_Analisis_Claude.md §5.5/§7) — se genera una key nueva recién al
      // guardar, nunca acá (mientras el usuario solo mira/navega no hay ningún intento nuevo
      // todavía). `manualOutboxDraftId` identifica QUÉ entrada del outbox actualizar en vez de
      // crear una segunda.
      manualOutboxDraftId = editMatch.matchId;
      manualSubmissionId = null;
    } else if (manualServerBacked) {
      manualPlayerIds = { a1: { playerId: currentUserId, kind: 'registered' }, a2: null, b1: null, b2: null };
      manualOutboxDraftId = null;
      manualSubmissionId = Matches.genUuid();
    } else {
      manualPlayerIds = { a1: null, a2: null, b1: null, b2: null };
      manualOutboxDraftId = null;
      manualSubmissionId = null;
    }

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
      // Backend Bloque 5 — server-backed SIEMPRE pasa por la misma pantalla de Confirmar
      // partido (reutiliza la UX existente): "VER RESUMEN" ahí decide create-or-attach en vez
      // de `persistManualSnapshot` local, sin importar si esta carga es nueva o si se está
      // reeditando un borrador de outbox todavía sync_pending/necesita_revision (ver
      // initMatchSavedScreen).
      if (manualServerBacked || manualIsNewLoad) {
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

  /** Backend Bloque 5 (punto 3 del wiring) — arma el payload de `create_or_attach_match` desde
   *  el estado actual del formulario + `manualPlayerIds`, lo guarda en el outbox local ANTES
   *  de enviarlo (nunca al revés — un corte de red entre "armar" y "guardar" perdería la
   *  carga), y recién entonces llama a la Edge Function. `handleCreateOrAttachOutcome`
   *  interpreta la respuesta (mismo código que usa `retryMatchOutbox`, nunca duplicado). */
  async function submitManualMatchServerBacked(built, location) {
    const ids = ['a1', 'a2', 'b1', 'b2'].map((s) => manualPlayerIds[s] && manualPlayerIds[s].playerId);
    if (ids.some((id) => !id)) {
      showToast('Faltan jugadores por resolver — volvé a elegirlos.', 2800);
      showView('manual-load');
      return;
    }
    if (!manualSubmissionId) manualSubmissionId = Matches.genUuid();
    let reportedTimeZone = null;
    try { reportedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { /* offline-safe fallback */ }
    const payload = {
      pair1PlayerIds: [ids[0], ids[1]],
      pair2PlayerIds: [ids[2], ids[3]],
      rawSets: manualSets.filter(Boolean),
      formatId: manualSelectedFormatId,
      playedAtIso: built.iso,
      playedAtTimeKnown: built.timeKnown,
      reportedTimeZone,
      scoringSystem: manualSelectedScoring,
      locationName: location ? location.name : null,
      locationLat: location && Number.isFinite(location.lat) ? location.lat : null,
      locationLng: location && Number.isFinite(location.lng) ? location.lng : null,
    };
    const participantNames = {};
    ids.forEach((id, i) => { participantNames[id] = [manualPlayers.a1, manualPlayers.a2, manualPlayers.b1, manualPlayers.b2][i]; });

    const entryFields = {
      submissionId: manualSubmissionId,
      payload, participantNames,
      privateNote: manualExistingPrivateNote || null,
      state: 'sync_pending',
    };
    // Solo se pasa `localDraftId` cuando se está REEDITANDO un borrador de outbox ya existente
    // — Object.assign en Store.saveMatchOutboxEntry copiaría un `undefined` explícito por
    // encima del id generado por defecto si esta clave estuviera siempre presente.
    if (manualOutboxDraftId) entryFields.localDraftId = manualOutboxDraftId;
    const entry = Store.saveMatchOutboxEntry(entryFields);
    manualOutboxDraftId = entry.localDraftId;
    manualConfirmDraft = null;

    const result = await Matches.createOrAttach(Object.assign({ idempotencyKey: manualSubmissionId }, payload));
    await handleCreateOrAttachOutcome(entry, result, { silent: false });

    if (result && result.ok) return; // handleCreateOrAttachOutcome ya navegó al Resumen real.
    const code = result && result.code;
    if (code === 'ambiguous_candidates') return; // el modal de desambiguación ya está abierto.
    if (MATCH_BUSINESS_ERROR_CODES.has(code)) {
      // Error de negocio real: el toast ya se mostró — volver al formulario para corregir,
      // nunca dejar el partido "perdido" (Experiencia_Inicial.md §6.4, NECESITA REVISIÓN).
      showView('manual-load');
      return;
    }
    // Transitorio (sin conexión/servidor no disponible): mostrar igual un Resumen local con
    // estado PENDIENTE DE SINCRONIZACIÓN — nunca dejar al usuario "colgado" en Confirmar.
    const displayEntry = Store.getMatchOutboxEntry(entry.localDraftId) || entry;
    if (MSync) openCanonicalResumen(MSync.buildOutboxDisplayEntry(displayEntry), 'player-home');
    else openPlayerHome();
  }

  function initMatchSavedScreen() {
    // §10 — desde Confirmar se puede volver a corregir el resultado sin perder nada: los sets
    // y jugadores siguen intactos en memoria, la pantalla de carga los vuelve a mostrar tal
    // cual quedaron.
    $('#match-saved-back-btn').addEventListener('click', () => showView('manual-load'));
    $('#match-saved-view-summary').addEventListener('click', async () => {
      if (!manualConfirmDraft) return;
      // Vuelve a leer fecha/hora/lugar por si el usuario usó "Modificar" mientras estaba en
      // esta pantalla — nunca persiste el draft original a ciegas.
      const dateVal = $('#manual-date-input').value;
      const timeVal = $('#manual-time-input').value;
      const built = ML.buildPlayedAtFromLocalFields(dateVal, timeVal);
      const placeName = $('#manual-place-input').value.trim();
      const location = (placeName || manualCoords) ? Object.assign({ name: placeName }, manualCoords || {}) : null;

      if (manualServerBacked) {
        const btn = $('#match-saved-view-summary');
        btn.disabled = true;
        try { await submitManualMatchServerBacked(built, location); }
        finally { btn.disabled = false; }
        return;
      }

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
  /** Backend Bloque 5 (punto 6 del wiring) — texto de estado agregado a la línea de fecha del
   *  Resumen para un partido server-backed. Deliberadamente texto simple, sin badge/color
   *  nuevo (UX REVIEW pendiente, ver 09_Resultado_Wiring_Frontend_Claude.md): "matched_confirmed"
   *  y "matched_already_confirmed" siguen mostrando PENDIENTE DE VALIDACIÓN — Bloque 5 nunca
   *  marca `validated` (06_Revision_Pre_Staging_ChatGPT.md §1), así que la UI tampoco debe
   *  sugerir "Validado"/"Oficial" solo porque la pareja rival ya haya declarado lo mismo. */
  /** Backend Bloque 6 (Fase B) — ahora que existe Bloque 6, distingue identidad cuestionada/
   *  corrección propuesta/tu turno de un pendiente/validado genérico (Experiencia_Inicial.md
   *  §9.3: "el tratamiento visual distingue pendiente accionable de pendiente en espera").
   *  `hasOpenIdentityIssue` siempre tiene prioridad — sin importar el estado del partido, una
   *  identidad cuestionada es lo primero que hay que resolver. */
  function serverMatchStatusLabel(f) {
    if (!f.serverBacked) return '';
    if (f.status === 'sync_pending') return 'PENDIENTE DE SINCRONIZACIÓN';
    if (f.status === 'necesita_revision') return 'NECESITA REVISIÓN';
    if (f.status === 'expired') return 'VENCIDO — NO COMPUTA';
    if (f.status === 'annulled') return 'ANULADO';
    if (f.hasOpenIdentityIssue) return 'IDENTIDAD CUESTIONADA';
    if (f.status === 'validated') return f.pendingCorrectionRevisionId ? 'CORRECCIÓN PROPUESTA' : 'VALIDADO';
    if (f.isActionMine) return 'TU TURNO: CONFIRMAR';
    return 'PENDIENTE DE VALIDACIÓN'; // pending_validation, esperando a la otra pareja
  }

  /** Modificador de color del badge de Historial (§9.3): `action` (lima, mi pareja tiene que
   *  responder), `identity` (identidad cuestionada), `pending` (neutro — espera a la otra
   *  pareja, o un estado puramente informativo). Nunca naranja (reservado a CALIBRANDO). */
  function serverMatchStatusBadgeModifier(f) {
    if (!f.serverBacked) return '';
    if (f.hasOpenIdentityIssue) return 'identity';
    if (f.status === 'pending_validation' && f.isActionMine) return 'action';
    return 'pending';
  }

  /* ------------------------------------------------------------------ */
  /* Backend Bloque 6 (Fase B) — pendientes accionables/Confirmar/Proponer     */
  /* corrección/Responder corrección/No participé/identidad.                   */
  /* Ver docs/BRAMUlab/Implementacion/Backend/Bloque_06/13_Handoff_Fase_B_Claude.md. */
  /* ------------------------------------------------------------------ */

  // Proponer corrección — sheet activo.
  let b6CorrectionMatch = null; // f (forma local) del partido que se está corrigiendo
  let b6CorrectionSetCount = 0;
  // No participé — partido activo (para armar los 4 lugares del picker).
  let b6ReportIdentityMatch = null;
  // Resolver identidad — issue/slot activos + exclusión de duplicados para el picker.
  let b6IdentityResolveIssue = null; // {issueId, matchId, team, positionInTeam}
  let b6IdentityResolveExcludedIds = [];
  let b6IdentityResolveSearchTimer = null;
  let b6IdentityResolveRequestId = 0;

  /** `f.players` está ordenado A(1,2),B(1,2) — la posición dentro del equipo es el índice
   *  relativo DENTRO de ese equipo (mismo orden en el que get_match_detail/get_my_matches ya
   *  lo entregan, ver buildLocalPlayers en match-sync.js). */
  function b6PlayersOfTeam(f, team) {
    return (f.players || []).filter((p) => p && p.team === team);
  }
  function b6PlayerAt(f, team, positionInTeam) {
    return b6PlayersOfTeam(f, team)[positionInTeam - 1] || null;
  }
  function b6AllSlots(f) {
    const slots = [];
    ['A', 'B'].forEach((team) => {
      b6PlayersOfTeam(f, team).forEach((p, idx) => {
        slots.push({ team, positionInTeam: idx + 1, name: p.name || 'Por identificar', userId: p.userId || null });
      });
    });
    return slots;
  }

  /** Copia humana + severidad de los códigos de error de negocio que puede devolver cualquier
   *  RPC/Edge Function de Bloque 6 — mismo criterio que MATCH_BUSINESS_ERROR_MESSAGES de más
   *  abajo (Bloque 5), acá en su propio mapa porque el vocabulario de códigos es distinto. */
  const B6_ERROR_MESSAGES = {
    not_actionable_for_caller: 'Todavía no es tu turno — la acción es de la otra pareja.',
    match_expired: 'Este partido venció sin validarse a tiempo.',
    identity_issue_open: 'Primero hay que resolver la identidad cuestionada.',
    not_a_participant: 'No participás de este partido.',
    match_not_actionable: 'Este partido ya no admite esta acción.',
    correction_window_expired: 'La ventana para responder esta corrección ya venció.',
    correction_already_pending: 'Ya hay una corrección propuesta esperando respuesta.',
    cannot_respond_to_own_proposal: 'No podés responder tu propia propuesta — espera a la otra pareja.',
    no_pending_correction: 'No hay ninguna corrección pendiente para responder.',
    resolution_window_expired: 'La ventana de 7 días para identificar al jugador correcto ya venció.',
    resolution_window_not_expired: 'Todavía no venció la ventana de 7 días.',
    duplicate_participant: 'Esa persona ya participa en este partido.',
    provisional_not_selectable: 'Ese invitado no está relacionado con vos — no se puede elegir.',
    participant_not_found: 'No encontramos a ese jugador.',
    identity_issue_already_open: 'Ya hay una incidencia abierta para ese lugar.',
    identity_window_expired: 'La ventana de 10 días para cuestionar una identidad ya venció.',
    invalid_sets: 'El resultado cargado no es válido.',
  };
  function b6ErrorMessage(code) {
    return B6_ERROR_MESSAGES[code] || 'No se pudo completar la acción. Probá de nuevo.';
  }

  // Las ventanas se derivan client-side solo para NO ofrecer acciones vencidas; el servidor
  // sigue siendo la autoridad y vuelve a validarlas al ejecutar cada operación.
  function b6WindowStillOpen(baseIso, days) {
    if (!baseIso) return false;
    const t = new Date(baseIso).getTime();
    return Number.isFinite(t) && Date.now() <= t + days * 86400000;
  }
  function b6CorrectionWindowOpen(f) {
    return !!(f && f.status === 'validated' && b6WindowStillOpen(f.validatedAt, 3));
  }
  function b6IdentityReportWindowOpen(f) {
    if (!f) return false;
    if (f.status === 'pending_validation') return true;
    return f.status === 'validated' && b6WindowStillOpen(f.validatedAt, 10);
  }
  function b6IdentityIssueExpired(issue) {
    if (!issue || !issue.resolutionDeadlineAt) return false;
    const t = new Date(issue.resolutionDeadlineAt).getTime();
    return Number.isFinite(t) && Date.now() > t;
  }

  /** No hay cron para la ventana de 7 días de identidad: el estado terminal se materializa
   *  perezosamente al volver a abrir el partido. Es una transición automática del producto,
   *  no una decisión del usuario. La Edge Function ya garantiza la operación atómica tanto en
   *  pending como en validated. */
  async function materializeExpiredIdentityIssues(f) {
    const issues = Array.isArray(f && f.openIdentityIssues) ? f.openIdentityIssues : [];
    const expired = issues.filter(b6IdentityIssueExpired);
    if (!expired.length || !MV) return { match: f, changed: false };
    let changed = false;
    for (const issue of expired) {
      const result = await MV.resolveIdentityIssue(issue.issueId, { forceUnidentified: true });
      if (result && result.ok !== false) changed = true;
      else if (result && result.code !== 'already_resolved') {
        // Si el servidor no pudo materializarlo, se conserva la incidencia open y no se inventa
        // ningún estado terminal en cliente. Un reintento posterior sigue siendo seguro.
        return { match: f, changed: false };
      }
    }
    if (!changed) return { match: f, changed: false };
    await refreshServerMatches();
    const fresh = await Matches.getMatchDetail(f.matchId);
    if (!fresh.ok || !fresh.match) return { match: f, changed: true };
    return { match: MSync.translateServerMatchToLocalShape(fresh.match), changed: true };
  }

  /** "Refresco coherente" tras cualquier acción B6 exitosa (13_Handoff_Fase_B_Claude.md §7):
   *  cache de partidos, Nivel propio, badge/lista de notificaciones y, si el Resumen de ESTE
   *  partido sigue abierto, su bloque de acciones — todo server-backed, nunca lógica local. */
  async function afterB6Action(matchId) {
    await refreshServerMatches();
    if (Auth && Auth.isConfigured()) {
      const profile = await Auth.fetchOwnProfile();
      if (profile) { Store.cacheServerUser(profile); syncServerLevelState(profile); }
    }
    if (!$('#view-player-home').hidden) renderPlayerHome();
    if (!$('#view-history').hidden) renderHistory();
    if (!$('#view-notifications').hidden) renderNotificationsScreenServerBacked();
    else renderNotificationsBadge();
    if (matchId && !$('#view-analysis').hidden && analysisCurrent && analysisCurrent.matchId === matchId) {
      // Hotfix B6 — no alcanza con repintar el bloque de acciones sobre el snapshot viejo:
      // corrección aceptada e identidad resuelta cambian también marcador/participantes/meta.
      // Releer el detalle canónico y re-renderizar TODO el Resumen mantiene analysisCurrent y
      // todas sus superficies sincronizadas sin obligar a salir de la pantalla.
      const detail = await Matches.getMatchDetail(matchId);
      if (detail.ok && detail.match && analysisCurrent && analysisCurrent.matchId === matchId) {
        const fresh = MSync.refreshOpenAnalysisSnapshot(analysisCurrent, detail.match, matchId);
        if (fresh && fresh !== analysisCurrent) {
          renderAnalysis(fresh);
          return;
        }
      }
      // Fallback seguro ante una lectura transitoria fallida: al menos refrescar las acciones
      // con el comportamiento previo; el próximo refresh volverá a intentar el detalle completo.
      await renderB6Actions(analysisCurrent);
    }
  }

  /** Pinta el bloque de acciones B6 del Resumen con lo que YA se tiene (`f`, snapshot de lista
   *  o de la creación reciente) y, en paralelo, relee `get_match_detail` para refinarlo con el
   *  detalle completo (openIdentityIssues/actions/pendingCorrectionRevisionId con team/position,
   *  que `get_my_matches` no trae) — quién tiene la acción puede haber cambiado mientras el
   *  usuario miraba otra pantalla, nunca se confía en un snapshot viejo para decidir qué botón
   *  mostrar. */
  async function renderB6Actions(f) {
    const section = $('#analysis-b6-actions');
    if (!f || !f.serverBacked) { section.hidden = true; return; }
    section.hidden = false;
    paintB6Actions(f);
    if (!Matches || !Matches.isConfigured()) return;
    const result = await Matches.getMatchDetail(f.matchId);
    if (!result.ok || !result.match) return;
    // Pudo haberse navegado a otro partido mientras se esperaba esta respuesta.
    if (!analysisCurrent || analysisCurrent.matchId !== f.matchId) return;
    let detailed = MSync.translateServerMatchToLocalShape(result.match);
    const terminalized = await materializeExpiredIdentityIssues(detailed);
    if (!analysisCurrent || analysisCurrent.matchId !== f.matchId) return;
    detailed = terminalized.match;
    if (terminalized.changed) {
      // El slot pasó automáticamente a "Jugador no identificado": re-render completo para que
      // nombres, badges, stats computables y acciones se alineen con el estado recién persistido.
      renderAnalysis(detailed);
      return;
    }
    paintB6Actions(detailed);
  }

  function paintB6Actions(f) {
    b6ReportIdentityMatch = f;
    const banner = $('#b6-status-banner');
    const bannerText = $('#b6-status-banner-text');
    const confirmBlock = $('#b6-confirm-block');
    const identityBlock = $('#b6-identity-block');
    const identityList = $('#b6-identity-list');
    const proposeBlock = $('#b6-propose-correction-block');
    const reportBlock = $('#b6-report-identity-block');
    const respondBlock = $('#b6-respond-correction-block');
    const respondText = $('#b6-respond-correction-text');

    banner.hidden = true; banner.classList.remove('b6-banner--waiting');
    confirmBlock.hidden = true;
    identityBlock.hidden = true;
    proposeBlock.hidden = true;
    reportBlock.hidden = true;
    respondBlock.hidden = true;

    if (f.status === 'expired') {
      banner.hidden = false; banner.classList.add('b6-banner--waiting');
      bannerText.textContent = 'Este partido venció sin validarse a tiempo. Queda registrado, pero no computa para Nivel ni estadísticas oficiales.';
      return;
    }
    if (f.status === 'annulled') {
      banner.hidden = false; banner.classList.add('b6-banner--waiting');
      bannerText.textContent = 'Este partido fue anulado administrativamente.';
      return;
    }

    const openIssues = Array.isArray(f.openIdentityIssues) ? f.openIdentityIssues : [];
    // get_my_matches trae solo el booleano; get_match_detail trae además el array. En el primer
    // pintado no se debe ofrecer Confirmar/Corregir durante esos milisegundos de refinamiento.
    const hasOpenIdentity = !!f.hasOpenIdentityIssue || openIssues.length > 0;
    if (openIssues.length) {
      identityBlock.hidden = false;
      identityList.innerHTML = openIssues.map((issue) => {
        const slot = b6PlayerAt(f, issue.team, issue.positionInTeam);
        const label = slot && slot.userId ? (slot.name || 'Este lugar') : 'Por identificar';
        return `
          <div class="b6-identity-row">
            <span class="b6-identity-row__label">${escapeHtml(label)}<small>Identidad cuestionada</small></span>
            <button type="button" class="btn-mini" data-issue-id="${escapeHtml(issue.issueId)}" data-team="${escapeHtml(issue.team)}" data-position="${issue.positionInTeam}">RESOLVER</button>
          </div>`;
      }).join('');
      $all('#b6-identity-list [data-issue-id]').forEach((btn) => {
        btn.onclick = () => openIdentityResolveSheet({
          issueId: btn.dataset.issueId, matchId: f.matchId,
          team: btn.dataset.team, positionInTeam: Number(btn.dataset.position),
        }, f);
      });
    }

    if (f.status === 'pending_validation') {
      if (f.isActionMine && !hasOpenIdentity) {
        banner.hidden = false;
        bannerText.textContent = 'Te toca confirmar este resultado.';
        confirmBlock.hidden = false;
      } else if (f.actionSide && !hasOpenIdentity) {
        const waitingTeam = S.teamLabel(f.players, f.actionSide);
        banner.hidden = false; banner.classList.add('b6-banner--waiting');
        bannerText.textContent = `Esperando que ${waitingTeam} confirme este resultado.`;
      }
      reportBlock.hidden = !b6IdentityReportWindowOpen(f);
      proposeBlock.hidden = hasOpenIdentity; // sin los 4 IDs reales no hay revisión posible.
      return;
    }

    if (f.status === 'validated') {
      reportBlock.hidden = !b6IdentityReportWindowOpen(f);
      const correctionWindowOpen = b6CorrectionWindowOpen(f);
      // Un puntero físico puede seguir presente luego de los 3 días (C-10). Para UX solo existe
      // una corrección pendiente ACTIVA mientras la ventana siga vigente.
      const hasActiveCorrection = !!f.pendingCorrectionRevisionId && correctionWindowOpen;

      // Corrección pendiente: se deriva quién la propuso desde el último match_actions
      // 'revision_proposed' (get_match_detail#actions, solo disponible tras el refresco de
      // detalle — ver renderB6Actions) — la propia RPC ya impide una segunda propuesta mientras
      // haya una pendiente, así que la ÚLTIMA acción de ese tipo siempre corresponde a
      // `pendingCorrectionRevisionId` vigente.
      let proposedByTeam = null;
      if (hasActiveCorrection && Array.isArray(f.actionsRaw)) {
        const proposals = f.actionsRaw.filter((a) => a.actionType === 'revision_proposed');
        proposedByTeam = proposals.length ? proposals[proposals.length - 1].actingSide : null;
      }

      if (proposedByTeam && f.myTeam && proposedByTeam !== f.myTeam) {
        respondBlock.hidden = false;
        respondText.textContent = `${S.teamLabel(f.players, proposedByTeam)} propuso una corrección del resultado. ¿La aceptás?`;
        proposeBlock.hidden = true;
      } else if (proposedByTeam) {
        banner.hidden = false;
        bannerText.textContent = 'Tu propuesta de corrección está esperando respuesta de la otra pareja.';
        proposeBlock.hidden = true;
      } else if (!hasActiveCorrection) {
        if (!hasOpenIdentity) {
          banner.hidden = false;
          bannerText.textContent = 'Partido oficial.';
        }
        proposeBlock.hidden = hasOpenIdentity || !correctionWindowOpen;
      } else {
        // Existe una corrección ACTIVA pero `actionsRaw` todavía no llegó (primer pintado con
        // snapshot de lista): no se muestra ningún botón hasta conocer qué pareja la propuso.
        proposeBlock.hidden = true;
      }
    }
  }

  /* ---- Confirmar ---- */
  function initB6ConfirmButton() {
    $('#b6-confirm-btn').addEventListener('click', async () => {
      if (!analysisCurrent) return;
      const matchId = analysisCurrent.matchId;
      const btn = $('#b6-confirm-btn');
      btn.disabled = true;
      const result = await MV.officializeMatch(matchId);
      btn.disabled = false;
      if (!result || result.ok === false) { showToast(b6ErrorMessage(result && result.code), 2800); return; }
      showToast('Partido confirmado.');
      await afterB6Action(matchId);
    });
  }

  /* ---- No participé ---- */
  function openReportIdentityPicker() {
    const f = b6ReportIdentityMatch;
    if (!f) return;
    if (!b6IdentityReportWindowOpen(f)) {
      showToast('La ventana para corregir la identidad de este partido ya venció.', 2600);
      return;
    }
    const openIssues = Array.isArray(f.openIdentityIssues) ? f.openIdentityIssues : [];
    const blocked = new Set(openIssues.map((i) => `${i.team}:${i.positionInTeam}`));
    const slots = b6AllSlots(f).filter((s) => !blocked.has(`${s.team}:${s.positionInTeam}`));
    if (!slots.length) { showToast('No hay ningún lugar disponible para cuestionar.', 2400); return; }
    $('#report-identity-list').innerHTML = slots.map((s) => `
      <button type="button" class="b6-slot-option" data-team="${escapeHtml(s.team)}" data-position="${s.positionInTeam}">
        <span>${escapeHtml(s.name)}</span>
        <span class="b6-slot-option__team">Equipo ${s.team === 'A' ? '1' : '2'}</span>
      </button>`).join('');
    $all('#report-identity-list .b6-slot-option').forEach((btn) => {
      btn.onclick = () => {
        $('#report-identity-overlay').hidden = true;
        confirmReportIdentity(f.matchId, btn.dataset.team, Number(btn.dataset.position), btn.querySelector('span').textContent);
      };
    });
    $('#report-identity-overlay').hidden = false;
  }
  function confirmReportIdentity(matchId, team, positionInTeam, name) {
    confirmAction(
      '¿Confirmás que no participó?',
      `Vas a indicar que la identidad cargada para ${name} en este partido es incorrecta. El partido sigue existiendo — se va a pedir corregir quién ocupaba ese lugar.`,
      async () => {
        const result = await MV.reportIdentityIssue(matchId, team, positionInTeam, null);
        if (!result || result.ok === false) { showToast(b6ErrorMessage(result && result.code), 2800); return; }
        showToast('Identidad cuestionada.');
        await afterB6Action(matchId);
      },
      null, 'Sí, no participó', 'Cancelar', true
    );
  }

  /* ---- Resolver identidad ---- */
  function openIdentityResolveSheet(issue, f) {
    b6IdentityResolveIssue = issue;
    b6IdentityResolveExcludedIds = (f.players || []).map((p) => p.userId).filter(Boolean);
    $('#identity-resolve-search').value = '';
    renderIdentityResolveResults('');
    $('#identity-resolve-scrim').hidden = false;
    requestAnimationFrame(() => { $('#identity-resolve-scrim').classList.add('is-open'); });
  }
  function closeIdentityResolveSheet() {
    const scrim = $('#identity-resolve-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
    b6IdentityResolveIssue = null;
  }
  function buildIdentityResolveRowHTML(displayName, playerId, kind) {
    return `<button type="button" class="player-row" data-player-id="${escapeHtml(playerId)}" data-kind="${kind}">
      <span class="player-row__avatar">${escapeHtml(playerInitials(displayName))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(displayName)}</span>
        <span class="player-row__handle">${kind === 'provisional' ? 'Invitado' : ''}</span>
      </span>
    </button>`;
  }
  async function renderIdentityResolveResults(query) {
    const requestId = ++b6IdentityResolveRequestId;
    const trimmed = (query || '').trim();
    const excluded = b6IdentityResolveExcludedIds;
    const [relatedResult, myProvResult, searchResult] = await Promise.all([
      Matches.listRelatedProvisionalPlayers(),
      Auth.listMyProvisionalPlayers(),
      trimmed.length >= 2 ? Auth.searchPlayers(trimmed) : Promise.resolve({ ok: true, players: [] }),
    ]);
    if (requestId !== b6IdentityResolveRequestId) return; // respuesta tardía, el sheet ya cambió
    const provisionalById = new Map();
    (relatedResult.ok ? relatedResult.players : []).forEach((p) => provisionalById.set(p.player_id, p));
    (myProvResult.ok ? myProvResult.players : []).forEach((p) => { if (!provisionalById.has(p.player_id)) provisionalById.set(p.player_id, p); });
    const queryLower = trimmed.toLocaleLowerCase('es');
    const provisionals = Array.from(provisionalById.values())
      .filter((p) => !excluded.includes(p.player_id))
      .filter((p) => !queryLower || (p.display_name || '').toLocaleLowerCase('es').includes(queryLower));
    const realRows = (searchResult.ok ? searchResult.players : []).filter((r) => !excluded.includes(r.player_id));

    let html = '';
    if (provisionals.length) html += provisionals.map((p) => buildIdentityResolveRowHTML(p.display_name || 'Invitado', p.player_id, 'provisional')).join('');
    if (realRows.length) html += realRows.map((r) => buildIdentityResolveRowHTML(r.display_name || r.username || 'Jugador', r.player_id, 'registered')).join('');

    $('#identity-resolve-list').innerHTML = html;
    $('#identity-resolve-empty').hidden = !!html;
    $all('#identity-resolve-list .player-row').forEach((btn) => {
      btn.onclick = () => selectIdentityReplacement(btn.dataset.playerId, btn.querySelector('.player-row__name').textContent);
    });
  }
  async function createIdentityResolveProvisionalAndSelect(name) {
    const result = await Auth.createProvisionalPlayer(name);
    if (!result.ok) { showToast('No se pudo crear el invitado. Probá de nuevo.', 2600); return; }
    selectIdentityReplacement(result.player.player_id, result.player.display_name || name);
  }
  async function selectIdentityReplacement(playerId, displayName) {
    const issue = b6IdentityResolveIssue;
    if (!issue) return;
    closeIdentityResolveSheet();
    const result = await MV.resolveIdentityIssue(issue.issueId, { replacementPlayerId: playerId });
    if (!result || result.ok === false) { showToast(b6ErrorMessage(result && result.code), 2800); return; }
    showToast(`${displayName} queda como el jugador correcto.`);
    await afterB6Action(issue.matchId);
  }
  function initIdentityResolveSheet() {
    $('#identity-resolve-close').addEventListener('click', closeIdentityResolveSheet);
    $('#identity-resolve-scrim').addEventListener('click', (e) => { if (e.target === $('#identity-resolve-scrim')) closeIdentityResolveSheet(); });
    $('#identity-resolve-search').addEventListener('input', (e) => {
      clearTimeout(b6IdentityResolveSearchTimer);
      const value = e.target.value;
      b6IdentityResolveSearchTimer = setTimeout(() => renderIdentityResolveResults(value), 250);
    });
  }

  /* ---- Proponer corrección ---- */
  function openProposeCorrection(f) {
    b6CorrectionMatch = f;
    b6CorrectionSetCount = (f.sets || []).length || 1;
    const wrap = $('#propose-correction-sets');
    wrap.innerHTML = (f.sets || []).map((s, i) => `
      <div class="b6-correction-set">
        <span class="b6-correction-set__label">SET ${i + 1}</span>
        <input type="number" min="0" max="30" inputmode="numeric" data-set="${i}" data-side="a" value="${Number.isFinite(s.gamesA) ? s.gamesA : ''}" />
        <span class="b6-correction-set__sep">–</span>
        <input type="number" min="0" max="30" inputmode="numeric" data-set="${i}" data-side="b" value="${Number.isFinite(s.gamesB) ? s.gamesB : ''}" />
      </div>`).join('');
    $('#propose-correction-error').hidden = true;
    $('#propose-correction-scrim').hidden = false;
    requestAnimationFrame(() => { $('#propose-correction-scrim').classList.add('is-open'); });
  }
  function closeProposeCorrection() {
    const scrim = $('#propose-correction-scrim');
    scrim.classList.remove('is-open');
    setTimeout(() => { scrim.hidden = true; }, 220);
    b6CorrectionMatch = null;
  }
  async function submitProposeCorrection() {
    const f = b6CorrectionMatch;
    if (!f) return;
    if (f.status === 'validated' && !b6CorrectionWindowOpen(f)) {
      $('#propose-correction-error').textContent = 'La ventana de 3 días para corregir el resultado ya venció.';
      $('#propose-correction-error').hidden = false;
      return;
    }
    const format = E.FORMATS[f.formatId] || E.FORMATS.classic;
    const sets = [];
    for (let i = 0; i < b6CorrectionSetCount; i++) {
      const aInput = $(`#propose-correction-sets input[data-set="${i}"][data-side="a"]`);
      const bInput = $(`#propose-correction-sets input[data-set="${i}"][data-side="b"]`);
      const gamesA = Number(aInput.value), gamesB = Number(bInput.value);
      if (!Number.isFinite(gamesA) || !Number.isFinite(gamesB) || !E.isValidCompletedSetScore(gamesA, gamesB, format)) {
        $('#propose-correction-error').textContent = `El Set ${i + 1} no tiene un resultado válido.`;
        $('#propose-correction-error').hidden = false;
        return;
      }
      sets.push({ gamesA, gamesB, tiebreakA: null, tiebreakB: null });
    }
    $('#propose-correction-error').hidden = true;
    const btn = $('#propose-correction-submit');
    btn.disabled = true;
    let result;
    if (f.status === 'validated') {
      result = await MV.proposeMatchCorrection(f.matchId, sets);
    } else {
      // Pre-validación (Experiencia_Inicial.md §12.1): el "mecanismo de revisión vigente" es
      // el mismo create_or_attach_match de Bloque 5 — reenviar con los mismos 4 participantes
      // reales y el score corregido crea una nueva revisión y pasa la acción al otro lado. La
      // orientación A/B la resuelve el servidor desde match_participants ya almacenada (C-04),
      // nunca se recalcula acá — alcanza con mandar cada equipo con SUS propios games.
      const teamA = b6PlayersOfTeam(f, 'A'), teamB = b6PlayersOfTeam(f, 'B');
      result = await Matches.createOrAttach({
        pair1PlayerIds: [teamA[0] && teamA[0].userId, teamA[1] && teamA[1].userId],
        pair2PlayerIds: [teamB[0] && teamB[0].userId, teamB[1] && teamB[1].userId],
        rawSets: sets.map((s) => ({ a: s.gamesA, b: s.gamesB, tiebreakA: s.tiebreakA, tiebreakB: s.tiebreakB })),
        formatId: f.formatId,
        playedAtIso: f.playedAt,
        playedAtTimeKnown: f.timeKnown,
        reportedTimeZone: f.timeZone,
        scoringSystem: f.scoringSystem,
        locationName: f.location && f.location.name,
        locationLat: f.location && f.location.lat,
        locationLng: f.location && f.location.lng,
      });
    }
    btn.disabled = false;
    if (!result || result.ok === false) {
      $('#propose-correction-error').textContent = b6ErrorMessage(result && result.code);
      $('#propose-correction-error').hidden = false;
      return;
    }
    closeProposeCorrection();
    showToast('Corrección propuesta.');
    await afterB6Action(f.matchId);
  }
  function initProposeCorrectionSheet() {
    $('#propose-correction-close').addEventListener('click', closeProposeCorrection);
    $('#propose-correction-scrim').addEventListener('click', (e) => { if (e.target === $('#propose-correction-scrim')) closeProposeCorrection(); });
    $('#propose-correction-submit').addEventListener('click', submitProposeCorrection);
  }

  /* ---- Responder corrección ---- */
  function initB6RespondButtons() {
    $('#b6-respond-accept-btn').addEventListener('click', async () => {
      if (!analysisCurrent) return;
      const matchId = analysisCurrent.matchId;
      const result = await MV.respondMatchCorrection(matchId, true);
      if (!result || result.ok === false) { showToast(b6ErrorMessage(result && result.code), 2800); return; }
      showToast('Corrección aceptada.');
      await afterB6Action(matchId);
    });
    $('#b6-respond-reject-btn').addEventListener('click', () => {
      if (!analysisCurrent) return;
      const matchId = analysisCurrent.matchId;
      confirmAction(
        '¿Rechazar la corrección?',
        'El resultado oficial actual se mantiene sin cambios.',
        async () => {
          const result = await MV.respondMatchCorrection(matchId, false);
          if (!result || result.ok === false) { showToast(b6ErrorMessage(result && result.code), 2800); return; }
          showToast('Corrección rechazada.');
          await afterB6Action(matchId);
        },
        null, 'Rechazar', 'Cancelar', true
      );
    });
  }

  function initB6ActionsSection() {
    initB6ConfirmButton();
    initB6RespondButtons();
    initIdentityResolveSheet();
    initProposeCorrectionSheet();
    $('#b6-report-identity-btn').addEventListener('click', openReportIdentityPicker);
    $('#report-identity-cancel').addEventListener('click', () => { $('#report-identity-overlay').hidden = true; });
    $('#b6-propose-correction-btn').addEventListener('click', () => { if (analysisCurrent) openProposeCorrection(analysisCurrent); });
  }

  /** Un insight ya renderizado por PLIntelligencePresentation (principal o secundario) a HTML —
   *  "Por qué aparece" como `<details>` nativo (Backend Bloque 8 Fase D, handoff §7): factual,
   *  desplegable, sin IDs/scores/reasonCodes — eso ya lo garantizó el propio módulo de
   *  presentación, acá solo se pinta lo que llegó. */
  function buildIntelligenceInsightHTML(insight, isPrincipal) {
    const titleHTML = isPrincipal && insight.title
      ? `<h4 class="intelligence-insight__title">${escapeHtml(insight.title)}</h4>` : '';
    return `
      <div class="intelligence-insight ${isPrincipal ? 'intelligence-insight--principal' : 'intelligence-insight--secondary'}">
        ${titleHTML}
        <p class="intelligence-insight__body">${escapeHtml(insight.body)}</p>
        <details class="intelligence-why">
          <summary>Por qué aparece</summary>
          <p>${escapeHtml(insight.why)}</p>
        </details>
      </div>`;
  }

  /** `output` es la salida completa de `get-match-intelligence` (Backend Bloque 8 Fase D):
   *  `{abstention, learningMessage, fallbackMessage, principal, secondary}`. Nunca redacta ni
   *  recalcula nada acá — solo traduce a HTML lo que el servidor ya decidió y guardó. */
  function buildIntelligenceCardHTML(output) {
    if (!output) return '';
    if (output.abstention) {
      const message = output.learningMessage || output.fallbackMessage || 'Partido guardado.';
      return `<p class="intelligence-state">${escapeHtml(message)}</p>`;
    }
    const principalHTML = output.principal ? buildIntelligenceInsightHTML(output.principal, true) : '';
    const secondaryHTML = (output.secondary || []).map((i) => buildIntelligenceInsightHTML(i, false)).join('');
    return principalHTML + secondaryHTML;
  }

  /** BRAMU Intelligence V1 real y persistente (Backend Bloque 8, Fases A-D) — REEMPLAZA el
   *  contenido legacy `f.intelligence`/`S.generateManualIntelligence` como fuente de la tarjeta
   *  en el camino server-backed real (handoff Bloque_08/15_Handoff_Fase_D_Claude.md §10:
   *  "NO presentarlo como V1 en el camino real server-backed"). `f.intelligence` sigue
   *  existiendo solo como compatibilidad descriptiva legacy para otros consumidores
   *  (compartir/exportar) — nunca se mezcla con este camino.
   *
   *  Offline/outbox (§10): un partido todavía sin `matchId` real en el servidor
   *  (`sync_pending`/`necesita_revision`) nunca finge Intelligence histórica — muestra un
   *  estado breve y honesto hasta que la carga quede sincronizada.
   *
   *  Async seguro: mismo criterio exacto que `renderB6Actions` — tras el `await`, si el usuario
   *  ya navegó a otro partido, la respuesta tardía se descarta sin pintar nada. */
  async function renderIntelligenceCard(f) {
    const container = $('#analysis-intelligence-text');
    if (!f) { container.innerHTML = ''; return; }

    if (!f.serverBacked || f.status === 'sync_pending' || f.status === 'necesita_revision') {
      container.innerHTML = '<p class="intelligence-state">BRAMU Intelligence se completa cuando la carga quede sincronizada.</p>';
      return;
    }
    if (!IntelClient || !IntelClient.isConfigured()) {
      container.innerHTML = '<p class="intelligence-state">BRAMU Intelligence no está disponible en este momento.</p>';
      return;
    }

    container.innerHTML = '<p class="intelligence-state intelligence-state--loading">Cargando BRAMU Intelligence…</p>';
    const result = await IntelClient.getMatchIntelligence(f.matchId);
    if (!analysisCurrent || analysisCurrent.matchId !== f.matchId) return; // se navegó a otro partido mientras se esperaba

    if (!result || result.ok === false) {
      container.innerHTML = '<p class="intelligence-state">BRAMU Intelligence no está disponible en este momento.</p>';
      return;
    }
    container.innerHTML = buildIntelligenceCardHTML(result.output);
  }

  function renderAnalysis(f) {
    analysisCurrent = f;
    analysisSetFilter = 'match'; // Bloque S2/V5: siempre arranca en PARTIDO al abrir/cambiar de partido
    const statusLabel = serverMatchStatusLabel(f);
    $('#analysis-meta').textContent = buildMatchMetaLine(f) + (statusLabel ? ` · ${statusLabel}` : '');
    $('#analysis-result').innerHTML = buildResultBlockHTML(f);
    // Backend Bloque 6 (Fase B) — pendientes/Confirmar/corrección/identidad. Nunca bloquea el
    // resto del Resumen (stats/intelligence siguen con `f`): pinta lo que ya se tiene y refina
    // en paralelo con get_match_detail fresco (ver renderB6Actions).
    renderB6Actions(f);
    renderIntelligenceCard(f);
    const covNote = $('#analysis-coverage-note');
    const legalHTML = buildCoverageLegalHTML(f);
    if (legalHTML) { covNote.hidden = false; covNote.innerHTML = legalHTML; } else { covNote.hidden = true; covNote.innerHTML = ''; }

    renderStatsGrid(f);
    renderEvolutionChart(f);
    renderHighlightsSection(f);
    renderKeyMoments(f);

    $('#analysis-share-btn').onclick = () => shareResult(f, 'analisis');
    // Etapa 3 (Fase 3, §15) — segundo acceso a "Editar partido": desde el detalle del partido
    // (acá, Análisis — es el mismo destino al que ya lleva "VER DETALLE" del Último Partido
    // para cualquier modo). Solo para partidos cargados manualmente.
    // Backend Bloque 5 — un partido server-backed YA aceptado por el servidor (cualquier
    // estado salvo sync_pending/necesita_revision) no se puede reabrir para editar acá: la
    // corrección de un partido ya cargado usa Bloque 6 (Proponer corrección), ya conectado
    // server-side. Un borrador de outbox sigue siendo editable como siempre.
    const serverAlreadySynced = f.serverBacked && f.status !== 'sync_pending' && f.status !== 'necesita_revision';
    $('#analysis-edit-btn').hidden = f.mode !== 'manual' || serverAlreadySynced;
    $('#analysis-edit-btn').onclick = () => openManualLoadScreen('player-home', f);
    // Etapa 4.2 (§10) — sensaciones privadas: solo partidos CARGADOS, accesibles únicamente
    // desde este detalle (nunca en Home/Historial/Resumen/exportaciones).
    // V02.3 (Bloque C, §7) — tarjeta PERMANENTE: ya no se oculta según haya o no nota
    // guardada (eso reemplazaba la tarjeta entera por un link "+ Agregar nota" — ver
    // renderAnalysisNoteDisplay). Arranca siempre en modo LECTURA (textarea oculto) —
    // cambiar de partido nunca debe dejar el editor abierto del partido anterior.
    const deleteBtn = $('#analysis-delete-btn');
    if (f.serverBacked && (f.status === 'sync_pending' || f.status === 'necesita_revision')) {
      deleteBtn.textContent = 'DESCARTAR CARGA';
    } else if (f.serverBacked) {
      deleteBtn.textContent = 'OCULTAR PARTIDO';
    } else {
      deleteBtn.textContent = 'ELIMINAR PARTIDO';
    }

    const noteSection = $('#analysis-note-section');
    noteSection.hidden = f.mode !== 'manual';
    if (f.mode === 'manual') {
      $('#analysis-note-textarea').value = f.privateNote || '';
      $('#analysis-note-textarea').hidden = true;
      $('#analysis-note-display').hidden = false;
      renderAnalysisNoteDisplay(f.privateNote || '');
    }
    // Hotfix v1.2.1 (§2-3.1) — "VOLVER AL INICIO" es siempre el Home del jugador, sin importar
    // si este Análisis es el del partido recién cargado o uno viejo visto desde Historial.
    $('#analysis-home-btn').onclick = () => { openPlayerHome(); };
    // V02.9 (§5) — "Eliminar partido": acción deliberada al final del Resumen, con
    // confirmación. Backend Bloque 5 (punto 8 del wiring) bifurca en 3 caminos: local legacy
    // sigue eliminando de verdad (sin cambios); un borrador de outbox todavía sin sincronizar
    // se descarta (nunca llegó a existir en el servidor, no hay nada que "ocultar"); un
    // partido server-backed YA aceptado usa `hide_match_for_me` — NUNCA borra el partido
    // compartido, solo lo saca de MI vista (Backend_Infraestructura.md §8.8).
    $('#analysis-delete-btn').onclick = () => {
      if (f.serverBacked && (f.status === 'sync_pending' || f.status === 'necesita_revision')) {
        confirmAction(
          '¿Descartar esta carga?',
          'Todavía no se envió al servidor — se va a borrar de este dispositivo.',
          () => {
            Store.removeMatchOutboxEntry(f.matchId);
            showToast('Carga descartada');
            openPlayerHome();
          },
          null, 'Descartar', 'Cancelar', true
        );
        return;
      }
      if (f.serverBacked) {
        confirmAction(
          '¿Ocultar este partido de tu historial?',
          'Solo lo vas a dejar de ver vos — sigue existiendo para los demás participantes y no se borra ni se altera.',
          async () => {
            const result = await Matches.hideMatchForMe(f.matchId, true);
            if (!result || !result.ok) { showToast('No se pudo ocultar el partido — probá de nuevo.', 2800); return; }
            await refreshServerMatches();
            showToast('Partido oculto de tu historial');
            openPlayerHome();
          },
          null, 'Ocultar', 'Cancelar', true
        );
        return;
      }
      confirmAction(
        '¿Eliminar este partido?',
        'Se actualizarán tu historial y tus estadísticas.',
        () => {
          Store.removeFromHistory(f.matchId);
          showToast('Partido eliminado');
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

  function initAnalysisScreen() {
    // Etapa 4.2 (§10) — autoguardado al salir del campo, sobre el partido actualmente
    // mostrado en Análisis (analysisCurrent). Nunca crea un registro nuevo: si por algún
    // motivo ese partido ya no existe en el historial, Store.patchHistoryEntry no hace nada.
    $('#analysis-note-textarea').addEventListener('blur', async () => {
      if (!analysisCurrent || analysisCurrent.mode !== 'manual') return;
      const value = $('#analysis-note-textarea').value.trim() || null;
      const f = analysisCurrent;
      // Backend Bloque 5 (punto 9 del wiring) — un partido server-backed usa
      // `set_match_private_note` (o, si todavía es un borrador de outbox sin sincronizar,
      // actualiza el campo local del outbox) — nunca comparte esta nota con los demás
      // participantes (Backend_Infraestructura.md §5.1). Local legacy: sin cambios.
      if (f.serverBacked && (f.status === 'sync_pending' || f.status === 'necesita_revision')) {
        const entry = Store.getMatchOutboxEntry(f.matchId);
        if (entry) Store.saveMatchOutboxEntry(Object.assign({}, entry, { privateNote: value }));
      } else if (f.serverBacked) {
        await Matches.setMatchPrivateNote(f.matchId, value);
      } else {
        Store.patchHistoryEntry(f.matchId, { privateNote: value });
      }
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
      else openPlayerHome(); // 'live' o cualquier otro caso legado: siempre es seguro ir al Home
    });
  }

  /* ------------------------------------------------------------------ */
  /* HISTORIAL — Etapa 4.1 (§3): pestañas de pertenencia (Todos/Mis partidos) +
   * chips de modo (Todos los modos/Cargados/Game por game/Punto por punto),
   * intersección de ambos. La clasificación y el filtrado en sí son
   * PH.filterHistoryByOwnership/filterHistoryByMode/filterHistoryCombined
   * (player-home.js, puras y testeadas) — acá solo se orquesta DOM/estado.
   * BRAMUlive (2026-09-18) — se retira la pestaña "Observados": la separación
   * de productos cierra la categoría funcional de partido observado/espectador
   * en BRAMUlab (ver Experiencia_Inicial.md §4.1). PH.classifyMatchOwnership/
   * filterHistoryByOwnership NO se tocan (siguen sosteniendo "Mis partidos" y
   * cualquier entrada legacy de un dispositivo viejo sigue clasificando sin
   * romper, simplemente deja de tener una pestaña propia). */
  /* ------------------------------------------------------------------ */
  const HISTORY_SCORING_LABELS = { golden: 'PUNTO DE ORO', starpoint: 'STAR POINT', classic: 'CON VENTAJA' };

  // Estado de los filtros — vive en memoria durante la sesión (§3.3: "conservar el filtro" al
  // editar/eliminar ya sale gratis de no resetear esto en cada render), nunca en localStorage:
  // no hay pedido de persistirlo entre reaperturas de la app.
  let historyOwnershipFilter = 'all'; // 'all' | 'mine'
  let historyModeFilter = 'all'; // 'all' | 'manual' | 'games' | 'complete'

  const HISTORY_TABS = [
    { key: 'all', label: 'Todos' },
    { key: 'mine', label: 'Mis partidos' },
  ];
  const HISTORY_MODE_CHIPS = [
    { key: 'all', label: 'Todos los modos' },
    { key: 'manual', label: 'Cargados' },
    { key: 'games', label: 'Game por game' },
    { key: 'complete', label: 'Punto por punto' },
  ];
  // Misma etiqueta que arriba, en minúscula, para componer el texto del estado vacío
  // ("No hay partidos en mis partidos · game por game todavía") sin repetir el mapeo.
  const HISTORY_TAB_LABELS_LOWER = { mine: 'mis partidos' };
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
   *  todos" si hay partidos en otro filtro, o "Cargar primer partido" si el historial entero
   *  está vacío (mismo destino que el "+" central — Experiencia_Inicial.md §9.3). */
  function renderHistoryEmptyState(totalCount) {
    const textEl = $('#history-empty-text');
    const actionEl = $('#history-empty-action');
    if (totalCount === 0) {
      textEl.textContent = 'Todavía no tenés partidos.';
      actionEl.textContent = 'CARGAR PRIMER PARTIDO';
      actionEl.onclick = () => openManualLoadScreen('player-home');
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
    const fullHistory = getDisplayHistory();
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
      // Backend Bloque 5 (09_Resultado_Wiring_Frontend_Claude.md, §5) — el widget de Efectividad
      // del Home calcula su % sobre `getComputableHistory()` (nunca un partido server-backed
      // pendiente); este drill-down debe partir de la MISMA fuente para no mostrar acá un
      // conjunto más amplio (con pendientes) que el que realmente compuso ese porcentaje.
      const allowed = new Set(PH.filterMatchesWithDefinedResult(PH.filterMatchesForPlayer(getComputableHistory(), currentIdentity()), currentIdentity()).map((m) => m.matchId));
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
      const historyDateStr = formatRealDate(playedAt, m.timeZone);
      const historyTimeStr = m.timeKnown === false ? '' : formatRealTime(playedAt, m.timeZone).slice(0, 5);
      const historyDateTimeStr = [historyDateStr, historyTimeStr].filter(Boolean).join(' · ');
      item.innerHTML = `
        <div class="history-item__top-row">
          <div class="history-item__date">${historyDateTimeStr}</div>
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
        ${serverMatchStatusLabel(m) ? `<span class="history-item__badge history-item__badge--${serverMatchStatusBadgeModifier(m)}">${serverMatchStatusLabel(m)}</span>` : ''}
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

  /* ------------------------------------------------------------------ */
  /* Backend Bloque 5 — HISTORIAL EFECTIVO (09_Resultado_Wiring_Frontend_Claude.md)          */
  /* Único punto de entrada que combina historial local legacy + partidos server-backed
   * (cache de get_my_matches) + outbox local, en la MISMA forma que ya usa toda la app
   * (match-sync.js: PLMatchSync). Reemplaza los call-sites de `Store.loadHistory()` que
   * necesitan ver TODO (Historial, badges) o solo lo COMPUTABLE (estadísticas/agregaciones,
   * Home, Perfil, Ranking simulado, TU MOMENTO) — un partido server-backed pending/expired/
   * sync_pending NUNCA debe alimentar el segundo grupo (02_Analisis_Claude.md §8,
   * Backend_Infraestructura.md §8.5: "antes de validar no afecta Nivel ni estadísticas"). */
  /* ------------------------------------------------------------------ */

  /** ¿La sesión activa es una cuenta real con backend configurado? Único gate — mismo criterio
   *  que ya usan renderPlayerSearchResults/Bloque 4 (`Auth.isConfigured() && user.serverBacked`). */
  function isServerBackedSession() {
    const user = Store.getCurrentUser();
    return !!(Auth && Auth.isConfigured() && user && user.serverBacked);
  }

  /** Historial para MOSTRAR (Historial, badges, Home "Último partido"): incluye partidos
   *  server-backed en CUALQUIER estado (pending_validation/expired/validated) más el outbox
   *  local todavía sin resolver. Para una cuenta sin backend, es exactamente
   *  `Store.loadHistory()` de siempre — cero cambio de comportamiento. */
  function getDisplayHistory() {
    const localHistory = Store.loadHistory();
    if (!isServerBackedSession() || !MSync) return localHistory;
    const cache = Store.loadServerMatchesCache();
    return MSync.buildDisplayHistory({
      localHistory,
      serverRows: cache.matches,
      outboxEntries: Store.loadMatchOutbox(),
    });
  }

  /** Historial para ESTADÍSTICAS/AGREGACIONES (player-home.js/stats.js/groups.js): local
   *  legacy completo + SOLO partidos server-backed ya `validated` (hoy, ninguno — Bloque 5
   *  nunca escribe ese estado) — nunca outbox, nunca pending/expired server-backed. Todo
   *  call-site que alimenta Nivel/Efectividad/Racha/Compañero-Rival/Ranking simulado/TU
   *  MOMENTO debe usar ESTA función, nunca `getDisplayHistory()`. */
  function getComputableHistory() {
    const localHistory = Store.loadHistory();
    if (!isServerBackedSession() || !MSync) return localHistory;
    const cache = Store.loadServerMatchesCache();
    return MSync.buildComputableHistory({ localHistory, serverRows: cache.matches });
  }

  /** Refresca el cache local de `get_my_matches` (Store.saveServerMatchesCache) — "mejor
   *  esfuerzo": una falla de red deja el cache anterior intacto (nunca lo vacía), consistente
   *  con Backend_Infraestructura.md §7.2 ("caché de lectura... nunca autoridad"). Se llama al
   *  entrar a Home/Historial y después de cualquier create-or-attach/hide/nota exitosos —
   *  nunca en un intervalo de fondo (sin sobrearquitecturar). */
  async function refreshServerMatches() {
    if (!isServerBackedSession() || !Matches) return;
    // Pedimos también los ocultos para que un partido VALIDADO que el usuario esconda
    // siga alimentando sus efectos oficiales. La capa de display (match-sync.js) filtra
    // hidden para Home/Historial; la capa computable lo conserva.
    const result = await Matches.getMyMatches({ limit: 200, includeHidden: true });
    if (result.ok) Store.saveServerMatchesCache(result.matches);
  }

  /** Reintenta cada entrada `sync_pending` del outbox con su MISMA `submissionId` (idempotency
   *  key) — nunca genera una nueva para un reintento automático (02_Analisis_Claude.md §7). Se
   *  llama al arrancar la app (si hay sesión server-backed) y al recuperar conexión
   *  (`window.online`). Una entrada `necesita_revision` (error de negocio/ambigüedad ya
   *  informado) NO se reintenta sola — espera una decisión explícita del usuario. */
  async function retryMatchOutbox() {
    if (!isServerBackedSession() || !Matches) return;
    const pending = Store.loadMatchOutbox().filter((e) => e && e.state === 'sync_pending');
    for (const entry of pending) {
      // eslint-disable-next-line no-await-in-loop
      const result = await Matches.createOrAttach(Object.assign({ idempotencyKey: entry.submissionId }, entry.payload));
      // eslint-disable-next-line no-await-in-loop
      await handleCreateOrAttachOutcome(entry, result, { silent: true });
    }
  }

  window.addEventListener('online', () => { retryMatchOutbox(); });

  /** Códigos de error de NEGOCIO reales — el servidor procesó el envío y lo rechazó por un
   *  motivo de contenido que el usuario puede corregir. Cualquier código FUERA de este
   *  conjunto (red caída, `rate_limited`, error 5xx de la Edge Function, `unknown`) se trata
   *  como transitorio: la entrada del outbox permanece `sync_pending` y se reintenta sola
   *  (retryMatchOutbox) — nunca se le pide al usuario "corregir" un problema que no es suyo. */
  const MATCH_BUSINESS_ERROR_CODES = new Set([
    'duplicate_participant', 'not_a_participant', 'participant_not_found', 'provisional_not_selectable',
    'invalid_format', 'invalid_sets', 'pending_action_limit_reached', 'played_at_in_future', 'played_at_too_old',
    'disambiguation_match_id_invalid', 'idempotency_key_reused_with_different_payload',
    'validated_match_needs_bloque6_correction',
  ]);
  const MATCH_BUSINESS_ERROR_MESSAGES = {
    duplicate_participant: 'Hay un jugador repetido en el partido.',
    not_a_participant: 'Tenés que ser uno de los 4 jugadores del partido.',
    participant_not_found: 'Uno de los jugadores elegidos ya no está disponible.',
    provisional_not_selectable: 'Ese invitado no está disponible para vos todavía.',
    invalid_format: 'El formato del partido no es válido.',
    invalid_sets: 'El resultado cargado no es válido.',
    pending_action_limit_reached: 'Tenés 5 partidos pendientes de tu lado — resolvé alguno antes de cargar uno nuevo.',
    played_at_in_future: 'La fecha del partido no puede ser en el futuro.',
    played_at_too_old: 'Solo se pueden cargar partidos jugados hasta 14 días atrás.',
    disambiguation_match_id_invalid: 'Ese partido ya no está disponible para asociar esta carga.',
    idempotency_key_reused_with_different_payload: 'Este intento cambió — probá guardar de nuevo.',
    validated_match_needs_bloque6_correction: 'Ese partido ya quedó oficial — la corrección todavía no está disponible.',
  };

  /** Punto único de interpretación de la respuesta de `Matches.createOrAttach` (Bloque 5),
   *  compartido por el guardado interactivo y por `retryMatchOutbox` (reintento en segundo
   *  plano) — misma lógica, sin duplicarla. `opts.silent=true` (reintento automático) nunca
   *  navega ni interrumpe a un usuario que puede ni siquiera estar mirando la pantalla. */
  async function handleCreateOrAttachOutcome(entry, result, opts) {
    const silent = !!(opts && opts.silent);
    if (result && result.ok) {
      Store.removeMatchOutboxEntry(entry.localDraftId);
      await refreshServerMatches();
      if (!silent) {
        showToast('Partido guardado');
        await openServerMatchResumen(result.matchId);
      }
      return { ok: true };
    }

    const code = (result && result.code) || 'unknown';
    if (code === 'ambiguous_candidates') {
      Store.saveMatchOutboxEntry(Object.assign({}, entry, {
        state: 'necesita_revision',
        lastError: { code, candidates: (result && result.candidates) || [] },
      }));
      if (!silent) openAmbiguousMatchModal(entry, (result && result.candidates) || []);
      return { ok: false, code };
    }

    if (MATCH_BUSINESS_ERROR_CODES.has(code)) {
      Store.saveMatchOutboxEntry(Object.assign({}, entry, { state: 'necesita_revision', lastError: { code } }));
      if (!silent) showToast(MATCH_BUSINESS_ERROR_MESSAGES[code] || 'No se pudo guardar el partido.', 3200);
      return { ok: false, code };
    }

    // Transitorio (red/rate limit/error inesperado del servidor): la entrada sigue
    // sync_pending tal cual estaba — nunca se le suma un error para que el usuario "corrija".
    if (!silent) showToast('Sin conexión — el partido quedó guardado y se va a sincronizar solo.', 3200);
    return { ok: false, code, transient: true };
  }

  /** Abre el Resumen de un partido server-backed recién guardado/reconciliado — busca la fila
   *  ya traducida en el cache (recién refrescado por refreshServerMatches) para no depender de
   *  una segunda llamada de red. El cache incluye hidden a propósito para preservar efectos
   *  oficiales; un partido recién guardado nunca está oculto. Si por algún motivo no aparece,
   *  cae a Home en vez de romper la navegación. */
  async function openServerMatchResumen(matchId) {
    const cache = Store.loadServerMatchesCache();
    const row = (cache.matches || []).find((m) => m.matchId === matchId);
    if (row && MSync) {
      openCanonicalResumen(MSync.translateServerMatchToLocalShape(row), 'player-home');
      return;
    }
    openPlayerHome();
  }

  /* ------------------------------------------------------------------ */
  /* Backend Bloque 5 — DESAMBIGUACIÓN DE ENCUENTRO (create-or-attach)                       */
  /* Resolución funcional y mínima (UX REVIEW pendiente — ver
   * 09_Resultado_Wiring_Frontend_Claude.md): lista los candidatos que devolvió el backend y
   * deja elegir uno puntual o "Es otro partido". Cualquiera de las dos respuestas es un
   * intento lógico NUEVO (trae información que la carga original no tenía) — usa una
   * idempotencyKey nueva, nunca reutiliza la del intento ambiguo original. */
  /* ------------------------------------------------------------------ */
  let ambiguousMatchEntry = null;

  function closeAmbiguousMatchModal() {
    $('#ambiguous-match-overlay').hidden = true;
    ambiguousMatchEntry = null;
  }

  function openAmbiguousMatchModal(entry, candidates) {
    ambiguousMatchEntry = entry;
    const list = $('#ambiguous-match-list');
    list.innerHTML = (candidates || []).map((c) => {
      const label = `${formatRealDate(c.playedAt)} · ${formatRealTime(c.playedAt).slice(0, 5)} — ${(E.FORMATS[c.formatId] && E.FORMATS[c.formatId].label) || c.formatId}`;
      return `<button type="button" class="btn-secondary" data-match-id="${escapeHtml(c.matchId)}" style="width:100%;text-align:left;">${escapeHtml(label)}</button>`;
    }).join('');
    $all('#ambiguous-match-list button').forEach((btn) => {
      btn.addEventListener('click', () => resolveAmbiguousMatch(btn.dataset.matchId));
    });
    $('#ambiguous-match-overlay').hidden = false;
  }

  /** Responde a la ambigüedad con una elección puntual (`disambiguationMatchId`). Nueva
   *  idempotencyKey (§ arriba); `Store.saveMatchOutboxEntry` actualiza la MISMA entrada del
   *  outbox (mismo `localDraftId`) con la key nueva — nunca crea un segundo borrador local. */
  async function resolveAmbiguousMatch(chosenMatchId) {
    const entry = ambiguousMatchEntry;
    if (!entry) return;
    closeAmbiguousMatchModal();
    const newSubmissionId = Matches.genUuid();
    const updatedEntry = Store.saveMatchOutboxEntry(Object.assign({}, entry, { submissionId: newSubmissionId, state: 'sync_pending' }));
    const result = await Matches.createOrAttach(Object.assign({ idempotencyKey: newSubmissionId }, entry.payload, { disambiguationMatchId: chosenMatchId }));
    await handleCreateOrAttachOutcome(updatedEntry, result, { silent: false });
  }

  /** Responde a la ambigüedad indicando que es un encuentro genuinamente distinto
   *  (`disambiguationForceNew`) — misma mecánica de idempotencyKey nueva que resolveAmbiguousMatch. */
  async function forceNewFromAmbiguous() {
    const entry = ambiguousMatchEntry;
    if (!entry) return;
    closeAmbiguousMatchModal();
    const newSubmissionId = Matches.genUuid();
    const updatedEntry = Store.saveMatchOutboxEntry(Object.assign({}, entry, { submissionId: newSubmissionId, state: 'sync_pending' }));
    const result = await Matches.createOrAttach(Object.assign({ idempotencyKey: newSubmissionId }, entry.payload, { disambiguationForceNew: true }));
    await handleCreateOrAttachOutcome(updatedEntry, result, { silent: false });
  }

  function initAmbiguousMatchModal() {
    $('#ambiguous-match-cancel').addEventListener('click', closeAmbiguousMatchModal);
    $('#ambiguous-match-force-new').addEventListener('click', forceNewFromAmbiguous);
  }

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
    // BRAMUlab_V04.7 — bug real corregido: cualquier camino que intentara mostrar el Home
    // (login, "volver" del onboarding de Nivel, reanudar sesión) pasaba por acá sin verificar
    // si el Nivel BRAMU V1 obligatorio seguía pendiente. Único choke point: si está pendiente,
    // retoma "TU PERFIL ESTÁ LISTO" (nunca entra al Home) en vez de renderizarlo.
    const pendingUser = nivelOnboardingPendingUser();
    if (pendingUser) { openPlayerCardScreen(pendingUser); return; }
    renderPlayerHome();
    showView('player-home');
    // Backend Bloque 5 — mismo criterio "mejor esfuerzo" que openHistoryScreen: el Home ya se
    // pintó con el cache local, un refresco en segundo plano lo actualiza si hay novedades
    // (Último partido, pendientes) sin bloquear la navegación esperando la red.
    if (isServerBackedSession()) refreshServerMatches().then(renderPlayerHome);
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
    // BRAMUlab_V04.7 — pasa por openPlayerHome() (antes duplicaba renderPlayerHome+showView acá
    // mismo) para que el guard de Nivel BRAMU obligatorio (nivelOnboardingPendingUser) también
    // cubra este camino: login y "ENTRAR A BRAMU" con Nivel ya confirmado usan esta función.
    if (action) action(); else openPlayerHome();
  }

  function initAccessScreen() {
    $('#access-login-btn').addEventListener('click', () => {
      $('#login-email').value = '';
      $('#login-password').value = '';
      $('#login-error').hidden = true;
      showView('login');
    });
    $('#access-signup-btn').addEventListener('click', openSignupWizard);
    // BRAMUlab_V04.6 (corrección de acceso al laboratorio) — único punto de entrada real a
    // "Crear usuario de prueba": visible acá (hidden por defecto, ver refreshLabPreviewUI) en
    // vez de detrás del long-press descartado sobre el logo de Home. Mismo flujo de siempre
    // (createLabTestUserAndOpenOnboarding ya existía, solo cambia desde dónde se dispara).
    $('#access-create-test-user-btn').addEventListener('click', createLabTestUserAndOpenOnboarding);
  }

  const LOGIN_ERROR_TEXT = {
    invalid_credentials: 'Revisá tu email y contraseña.',
    email_not_confirmed: 'Todavía no confirmaste tu email — revisá tu casilla.',
    rate_limited: 'Demasiados intentos. Probá de nuevo en unos minutos.',
    not_configured: 'No se pudo conectar con el servidor. Probá de nuevo más tarde.',
    unknown: 'No pudimos iniciar sesión. Probá de nuevo.',
  };

  /** Backend Bloque 2 — con backend real configurado, el login pasa por Supabase (email/
   *  contraseña reales, Backend_Infraestructura.md §8.1.5) y el perfil se trae del servidor
   *  (Auth.fetchOwnProfile) para cachearlo con la misma forma que Store.createUserAccount —
   *  ver el comentario de auth.js. Si el perfil todavía está incompleto (verificó el email pero
   *  nunca terminó "TU PERFIL"), retoma ese paso en vez de entrar al Home. Sin backend
   *  configurado (desarrollo local), sigue el camino 100% local de siempre. */
  function initLoginScreen() {
    $('#login-back-btn').addEventListener('click', () => showView('access'));
    wirePasswordToggle('login-password', 'login-password-toggle');
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      if (!Auth.isConfigured()) {
        const result = Store.loginWithEmail(email, password);
        if (!result.ok) { $('#login-error').hidden = false; return; }
        $('#login-error').hidden = true;
        syncCurrentIdentityFromStore();
        completeIdentifyAction();
        return;
      }
      const submitBtn = $('#login-form button[type="submit"]');
      submitBtn.disabled = true;
      const result = await Auth.signInWithPassword(email, password);
      submitBtn.disabled = false;
      if (!result.ok) {
        $('#login-error').textContent = LOGIN_ERROR_TEXT[result.reason] || LOGIN_ERROR_TEXT.unknown;
        $('#login-error').hidden = false;
        return;
      }
      $('#login-error').hidden = true;
      await resumeServerSession({ afterLogin: true });
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
    $('#forgot-password-no-account').hidden = true;
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
    // Backend Bloque 2 — este camino salta directo al paso 2 (código), así que acá es donde
    // hay que disparar el envío real (el otro camino, #forgot-password-email-submit, lo hace
    // al tocar "ENVIAR CÓDIGO"). Best-effort: si falla, "REENVIAR" en el paso 2 lo reintenta.
    if (Auth.isConfigured()) Auth.sendRecoveryOtp(forgotPasswordEmail);
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

    $('#forgot-password-email-submit').addEventListener('click', async () => {
      const email = $('#forgot-password-email').value.trim();
      if (!Auth.isConfigured()) {
        const user = Store.getUserByEmail(email);
        // BRAMUlab_V03.6 (corrección post-QA real, prioridad 3) — antes este mensaje era un
        // callejón sin salida: "no encontramos una cuenta" sin ningún camino hacia adelante.
        // Agrega el CTA "CREAR CUENTA" debajo del mismo error, sin tocar ENVIAR CÓDIGO como
        // acción principal cuando el email sí existe.
        if (!user) { $('#forgot-password-email-error').hidden = false; $('#forgot-password-no-account').hidden = false; return; }
        $('#forgot-password-email-error').hidden = true;
        $('#forgot-password-no-account').hidden = true;
        forgotPasswordUserId = user.id;
        forgotPasswordEmail = email;
        forgotPasswordStep = 2;
        renderForgotPasswordStep();
        return;
      }
      // Backend Bloque 2 (Backend_Infraestructura.md §8.1.7) — "las respuestas no revelan si
      // un email existe": a diferencia del camino local de arriba, acá NUNCA se muestra "no
      // encontramos una cuenta" — Supabase responde igual exista o no la cuenta, así que
      // siempre se avanza al paso 2. Un error acá es de verdad (red caída, rate limit), no
      // "email no encontrado".
      const submitBtn = $('#forgot-password-email-submit');
      submitBtn.disabled = true;
      const result = await Auth.sendRecoveryOtp(email);
      submitBtn.disabled = false;
      if (!result.ok && result.reason === 'rate_limited') {
        $('#forgot-password-email-error').textContent = 'Demasiados intentos. Probá de nuevo en unos minutos.';
        $('#forgot-password-email-error').hidden = false;
        $('#forgot-password-no-account').hidden = true;
        return;
      }
      $('#forgot-password-email-error').hidden = true;
      $('#forgot-password-no-account').hidden = true;
      forgotPasswordEmail = email;
      forgotPasswordStep = 2;
      renderForgotPasswordStep();
    });

    $('#forgot-password-signup-btn').addEventListener('click', openSignupWizard);

    $('#forgot-password-resend-btn').addEventListener('click', async () => {
      const result = await Auth.sendRecoveryOtp(forgotPasswordEmail);
      showToast(result.ok ? 'Código reenviado' : 'No pudimos reenviar el código. Probá de nuevo.');
    });

    $('#forgot-password-code-submit').addEventListener('click', async () => {
      const code = $('#forgot-password-code').value.trim();
      if (!Auth.isConfigured()) {
        if (code !== FORGOT_PASSWORD_CODE) { $('#forgot-password-code-error').hidden = false; return; }
        $('#forgot-password-code-error').hidden = true;
        forgotPasswordStep = 3;
        renderForgotPasswordStep();
        return;
      }
      const submitBtn = $('#forgot-password-code-submit');
      submitBtn.disabled = true;
      const result = await Auth.verifyRecoveryOtp(forgotPasswordEmail, code);
      submitBtn.disabled = false;
      if (!result.ok) {
        $('#forgot-password-code-error').textContent = result.reason === 'code_expired' ? 'El código venció — pedí uno nuevo.' : 'Código incorrecto.';
        $('#forgot-password-code-error').hidden = false;
        return;
      }
      $('#forgot-password-code-error').hidden = true;
      forgotPasswordStep = 3;
      renderForgotPasswordStep();
    });

    wirePasswordToggle('forgot-password-new', 'forgot-password-new-toggle');
    wirePasswordToggle('forgot-password-repeat', 'forgot-password-repeat-toggle');
    $('#forgot-password-new').addEventListener('input', (e) => updatePasswordRulesUI(e.target.value, 'forgot-password-rules'));

    $('#forgot-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (forgotPasswordStep !== 3) return;
      const next = $('#forgot-password-new').value;
      const repeat = $('#forgot-password-repeat').value;
      const strength = PLI.checkPasswordStrength(next);
      let error = null;
      if (!strength.ok) error = 'La nueva contraseña todavía no cumple los requisitos.';
      else if (!PLI.passwordsMatch(next, repeat)) error = 'Las contraseñas no coinciden.';
      if (error) { $('#forgot-password-new-error').textContent = error; $('#forgot-password-new-error').hidden = false; return; }

      if (!Auth.isConfigured()) {
        const user = forgotPasswordUserId ? Store.getUserById(forgotPasswordUserId) : null;
        if (!user) { showView(forgotPasswordOrigin === 'session' ? 'profile' : 'login'); return; }
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
        return;
      }

      // Backend Bloque 2 — verifyRecoveryOtp (paso anterior) ya dejó una sesión real activa;
      // updateUser la usa directo, sin pedir la contraseña actual (es justamente el camino para
      // cuando no se la recuerda).
      const submitBtn = $('#forgot-password-form button[type="submit"]');
      submitBtn.disabled = true;
      const result = await Auth.updatePassword(next);
      submitBtn.disabled = false;
      if (!result.ok) {
        $('#forgot-password-new-error').textContent = 'No pudimos actualizar la contraseña. Probá de nuevo.';
        $('#forgot-password-new-error').hidden = false;
        return;
      }
      showToast('Contraseña actualizada');
      if (forgotPasswordOrigin === 'session') showView('profile');
      else await resumeServerSession({ afterLogin: true });
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
  // BRAMUlab_V04.8 (§4) — TU IDENTIDAD + TU PERFIL se fusionan en un solo paso "TU PERFIL"
  // (antes 2 y 3): el usuario completa un solo perfil, no una secuencia artificial de 3
  // pantallas. CREAR CUENTA sigue aparte (acceso: email/contraseña, no datos de perfil).
  // Backend Bloque 3 (Backend_Infraestructura.md §8.1, 03_Revision_ChatGPT.md §8) — 'verify'
  // pasa a ser el ÚLTIMO paso, no el segundo: la confirmación de email se DIFIERE hasta
  // después de perfil mínimo + Nivel BRAMU (ver openNivelOnboardingIntro/confirmNivelOnboarding
  // más abajo, que corren ENTRE el paso 2 y 'verify' desde una vista separada,
  // #view-nivel-onboarding). "TU PERFIL" pasa a ser el perfil MÍNIMO (nombre/apellido/
  // @usuario/términos) — rama competitiva/ubicación/datos secundarios se retiran de acá (no
  // bloquean Nivel/Home/primer partido, Experiencia_Inicial.md §2.2).
  const SIGNUP_STEP_TITLES = { 1: 'CREAR CUENTA', 2: 'TU PERFIL', verify: 'CONFIRMÁ TU EMAIL' };
  const SIGNUP_STEP_ORDER = [1, 2, 'verify'];

  // Backend Bloque 3 (03_Revision_ChatGPT.md §10) — sin sistema legal todavía: un string de
  // versión simple, alcanza para el soporte técnico pedido (terms_version/terms_accepted_at
  // server-side). Cambiar este valor es la única acción necesaria el día que haya términos
  // reales que versionar.
  const TERMS_VERSION = 'piloto_v1';

  // Backend Bloque 3 — distingue las 2 formas de llegar a #view-nivel-onboarding:
  //  'draft'   → alta real en curso, TODAVÍA sin cuenta confirmada: opera sobre `signupDraft`
  //              (nunca sobre Store.getCurrentUser(), que no existe todavía).
  //  'account' → cuenta YA existente (alta local sin backend, cuenta de laboratorio, o
  //              "Resetear Nivel BRAMU"): comportamiento IDÉNTICO al de antes de Bloque 3,
  //              opera sobre Store.getCurrentUser()/Store.saveLevelV1State.
  let nivelOnboardingContext = 'account';

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
    resetOptionGroup('signup-branch-options');
    $('#signup-verify-code').value = '';
    $('#signup-verify-error').hidden = true;
    // BRAMUlab_V04.6 — ubicación pasa a ser obligatoria del alta (ver Handoff V04.6 §4).
    // BRAMUlab_V04.9 (§3) — "Elegir ubicación" en vez de un simple "—": la fila ahora se ve
    // enmarcada como un campo real (ver #signup-location-row en styles.css), un placeholder
    // reconocible (en vez de un guion suelto) refuerza que hay que tocarla para elegir.
    // Nota Backend Bloque 3: estos campos (avatar/fecha/género/mano/lado/rama/ubicación) quedan
    // ocultos en el paso "TU PERFIL" (ver index.html) — se resetean igual por si en algún
    // momento se vuelven a mostrar, no aportan ni estorban mientras estén hidden.
    $('#signup-location-value').textContent = 'Elegir ubicación';
    $('#signup-terms-checkbox').checked = false;
  }

  /** BRAMUlab_V03.6 — mismo patrón que updateProfileLocationRowDisplay, para la fila de
   *  ubicación del paso 3 del alta (obligatoria desde V04.6, ver signup-location-row). */
  function updateSignupLocationRowDisplay() {
    $('#signup-location-value').textContent = signupDraft.location ? PLLocations.formatLocationLabel(signupDraft.location) : 'Elegir ubicación';
  }

  function openSignupWizard() {
    resetSignupWizard();
    renderSignupStep();
    showView('signup');
  }

  function renderSignupStep() {
    // dataset.step es siempre string ("1"/"verify"/"2") — comparar contra String(signupStep)
    // en vez de Number(...) porque 'verify' no es numérico (Number('verify') es NaN).
    $all('#signup-form .signup-step').forEach((el) => { el.hidden = el.dataset.step !== String(signupStep); });
    $('#signup-step-title').textContent = SIGNUP_STEP_TITLES[signupStep];
    // Backend Bloque 3 — paso 2 ("TU PERFIL") ya no crea la cuenta: solo guarda el perfil
    // mínimo en el borrador y sigue hacia Nivel BRAMU (ver el handler de abajo), así que su
    // botón vuelve a decir "CONTINUAR" en vez de "CREAR MI PERFIL".
    $('#signup-continue-btn').textContent = signupStep === 'verify' ? 'CONFIRMAR CÓDIGO' : 'CONTINUAR';
    // Backend Bloque 3 — "Confirmar email ahora" solo tiene sentido con backend real (sin
    // Auth.isConfigured() no existe ningún OTP que confirmar; el camino local crea la cuenta
    // en el mismo paso 2 de siempre). Se recalcula en cada render del paso 2, sin importar por
    // qué camino se llegó (flujo normal o resumeDraftFlow).
    if (signupStep === 2) $('#signup-verify-now-btn').hidden = !Auth.isConfigured();
    if (signupStep === 'verify') $('#signup-verify-email').textContent = signupDraft.email || 'tu email';
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
      // Backend Bloque 2 — con backend real, "email ya usado" lo decide Supabase al hacer
      // signUp (ver initSignupWizard: mapea 'email_taken'), no la lista local: esa lista local
      // solo tiene sentido en el camino sin backend (desarrollo local).
      const emailAvailable = Auth.isConfigured() || !PLI.isEmailTaken(email, Store.loadUsers());
      ok = PLI.isValidEmail(email) && emailAvailable && strength.ok && PLI.passwordsMatch(password, repeat);
    } else if (signupStep === 'verify') {
      ok = /^[0-9]{6}$/.test($('#signup-verify-code').value.trim());
    } else if (signupStep === 2) {
      // Backend Bloque 3 (Experiencia_Inicial.md §2.2, Backend_Infraestructura.md §8.2) —
      // "TU PERFIL" pasa a ser el perfil MÍNIMO: nombre + apellido + @usuario + términos.
      // Rama competitiva/ubicación/fecha de nacimiento/género/mano/lado/avatar/nombre visible
      // NO bloquean acá (Experiencia_Inicial.md §2.2: "no son obligatorios para terminar el
      // alta deportiva inicial") — se completan después desde Perfil. Sin backend real
      // (desarrollo local, camino sin cambios de Bloque 3) la cuenta local sigue necesitando
      // un @usuario único contra la lista local, igual que siempre.
      const username = $('#signup-username').value;
      const usernameAvailable = Auth.isConfigured() || !PLI.isUsernameTaken(username, Store.loadUsers());
      ok = !!$('#signup-first-name').value.trim() && !!$('#signup-last-name').value.trim()
        && PLI.isValidUsernameFormat(username) && !PLI.isUsernameReserved(username) && usernameAvailable
        && $('#signup-terms-checkbox').checked;
    }
    $('#signup-continue-btn').disabled = !ok;
    return ok;
  }

  // Backend Bloque 2 — token de carrera para el chequeo async de abajo: si el usuario sigue
  // tipeando, la respuesta de una consulta vieja al servidor nunca debe pisar el feedback de la
  // consulta más nueva (mismo problema que ya resuelve profileLocationSearchController con
  // AbortController para la búsqueda de ubicación, acá con un contador simple porque
  // is_username_available es una sola llamada RPC, no una búsqueda cancelable).
  let usernameFeedbackToken = 0;

  function renderUsernameFeedback(inputId, feedbackId, excludeUserId) {
    const username = $(`#${inputId}`).value.trim();
    const el = $(`#${feedbackId}`);
    usernameFeedbackToken += 1;
    if (!username) { el.textContent = ''; el.classList.remove('is-taken'); return; }
    if (!PLI.isValidUsernameFormat(username)) { el.textContent = 'Entre 3 y 24 caracteres: minúsculas, números, punto o guion bajo.'; el.classList.add('is-taken'); return; }
    if (PLI.isUsernameReserved(username)) { el.textContent = '! Ese @usuario no está disponible'; el.classList.add('is-taken'); return; }
    // Backend Bloque 2 — con backend real y sesión activa, la lista local (Store.loadUsers())
    // nunca tiene cuentas reales: el chequeo que importa es el del servidor (is_username_available,
    // ver más abajo). Sin sesión (paso 1/verify del alta todavía no terminaron) ni backend
    // configurado, sigue el chequeo local de siempre.
    const taken = PLI.isUsernameTaken(username, Store.loadUsers(), excludeUserId);
    el.textContent = taken ? '! Ya está en uso' : '✓ Disponible';
    el.classList.toggle('is-taken', taken);
    if (!taken && Auth.isConfigured()) {
      const token = usernameFeedbackToken;
      Auth.isUsernameAvailable(username).then((available) => {
        if (token !== usernameFeedbackToken || available === null) return; // hay una consulta más nueva, o falló la red
        el.textContent = available ? '✓ Disponible' : '! Ya está en uso';
        el.classList.toggle('is-taken', !available);
      });
    }
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

  /** BRAMUlab_V04.9 (§1) — iniciales reales en vivo mientras se completa Nombre/Apellido (ej.
   *  "Sebastián Vila" → "SV"), sin esperar a subir una foto: primera letra de cada campo, nunca
   *  `playerInitials` (pensado para UN string "nombre apellido" ya combinado, no 2 campos
   *  separados). Si ya hay una foto elegida, no pisa el preview (`setAvatarPreview` ya la
   *  muestra). Sin datos todavía, vuelve al mismo placeholder genérico de siempre ("—"). */
  function updateSignupAvatarInitials() {
    if (signupPhotoDataUrl) return;
    const first = $('#signup-first-name').value.trim();
    const last = $('#signup-last-name').value.trim();
    const initials = (first.charAt(0) + last.charAt(0)).toUpperCase();
    $('#signup-avatar-initials').textContent = initials || '—';
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

  const SIGNUP_VERIFY_ERROR_TEXT = {
    code_invalid: 'Código incorrecto.',
    code_expired: 'El código venció — pedí uno nuevo.',
    rate_limited: 'Demasiados intentos. Probá de nuevo en unos minutos.',
    not_configured: 'No se pudo conectar con el servidor. Probá de nuevo más tarde.',
    unknown: 'No pudimos confirmar el código. Probá de nuevo.',
  };
  const SIGNUP_STEP1_ERROR_TEXT = {
    email_taken: 'Ese email ya tiene una cuenta — iniciá sesión.',
    rate_limited: 'Demasiados intentos. Probá de nuevo en unos minutos.',
    not_configured: 'No se pudo conectar con el servidor. Probá de nuevo más tarde.',
    unknown: 'No pudimos crear la cuenta. Probá de nuevo.',
  };
  const COMPLETE_PROFILE_ERROR_TEXT = {
    username_invalid_format: 'Ese @usuario no tiene un formato válido.',
    username_reserved: 'Ese @usuario no está disponible.',
    username_taken: 'Ese @usuario ya está en uso.',
    username_locked: 'Tu @usuario ya quedó fijo y no se puede cambiar.',
    competitive_branch_invalid: 'Elegí tu rama competitiva.',
    location_required: 'Elegí tu ubicación.',
    not_configured: 'No se pudo conectar con el servidor. Probá de nuevo más tarde.',
    unknown: 'No pudimos guardar tu perfil. Probá de nuevo.',
  };

  function initSignupWizard() {
    $('#signup-back-btn').addEventListener('click', () => {
      const idx = SIGNUP_STEP_ORDER.indexOf(signupStep);
      if (idx > 0) { signupStep = SIGNUP_STEP_ORDER[idx - 1]; renderSignupStep(); } else showView('access');
    });
    ['signup-email', 'signup-password', 'signup-password-repeat'].forEach((id) => {
      $(`#${id}`).addEventListener('input', recomputeSignupStepValidity);
    });
    $('#signup-verify-code').addEventListener('input', recomputeSignupStepValidity);
    $('#signup-verify-resend-btn').addEventListener('click', async () => {
      const result = await Auth.resendSignupOtp(signupDraft.email);
      showToast(result.ok ? 'Código reenviado' : (SIGNUP_VERIFY_ERROR_TEXT[result.reason] || SIGNUP_VERIFY_ERROR_TEXT.unknown));
    });
    // V03.0.2 (§9/§11) — mismo componente de ojo mostrar/ocultar que Login/Completar
    // Acceso/Cambiar contraseña ("Signup donde corresponda").
    wirePasswordToggle('signup-password', 'signup-password-toggle');
    wirePasswordToggle('signup-password-repeat', 'signup-password-repeat-toggle');
    $('#signup-first-name').addEventListener('input', () => { maybeSuggestSignupUsername(); updateSignupAvatarInitials(); recomputeSignupStepValidity(); });
    $('#signup-last-name').addEventListener('input', () => { maybeSuggestSignupUsername(); updateSignupAvatarInitials(); recomputeSignupStepValidity(); });
    $('#signup-username').addEventListener('input', () => {
      $('#signup-username').dataset.touched = '1';
      renderUsernameFeedback('signup-username', 'signup-username-feedback');
      recomputeSignupStepValidity();
    });
    $('#signup-display-name').addEventListener('input', recomputeSignupStepValidity);
    ['signup-birthdate', 'signup-gender'].forEach((id) => {
      $(`#${id}`).addEventListener('input', recomputeSignupStepValidity);
    });
    // Backend Bloque 3 — checkbox de términos, único requisito nuevo del perfil mínimo.
    $('#signup-terms-checkbox').addEventListener('change', recomputeSignupStepValidity);
    wireOptionGroup('signup-hand-options', (v) => { signupDraft.dominantHand = v; recomputeSignupStepValidity(); });
    wireOptionGroup('signup-side-options', (v) => { signupDraft.preferredSide = v; recomputeSignupStepValidity(); });
    wireOptionGroup('signup-branch-options', (v) => { signupDraft.competitiveBranch = v; recomputeSignupStepValidity(); });
    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 4) — reutiliza la MISMA hoja de
    // búsqueda GeoRef que Editar Datos (openProfileLocationSheet, generalizada arriba), con un
    // target propio (signupDraft.location) en vez de duplicar sheet/búsqueda. Opcional: nunca
    // entra en recomputeSignupStepValidity.
    $('#signup-location-row').addEventListener('click', () => openProfileLocationSheet({
      get: () => signupDraft.location || null,
      set: (loc) => { signupDraft.location = loc; },
      onSelect: () => { updateSignupLocationRowDisplay(); recomputeSignupStepValidity(); },
    }));

    $('#signup-avatar-edit-btn').addEventListener('click', () => $('#signup-avatar-input').click());
    $('#signup-avatar-input').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      signupPhotoDataUrl = await downscaleImageFileToDataUrl(file, 256, 0.7);
      setAvatarPreview('signup-avatar-img', 'signup-avatar-initials', signupPhotoDataUrl);
    });

    // Backend Bloque 3 (Experiencia_Inicial.md §2.1) — acción secundaria "Confirmar email
    // ahora": el usuario puede resolver el OTP antes de terminar perfil mínimo + Nivel. Guarda
    // lo que ya haya en el paso 2 (puede estar incompleto) para no perderlo, y salta a
    // 'verify' sin pasar por el resto del flujo — al confirmar, resumeDraftFlow() decide sola
    // adónde seguir.
    $('#signup-verify-now-btn').addEventListener('click', () => {
      signupDraft.firstName = $('#signup-first-name').value.trim() || signupDraft.firstName || null;
      signupDraft.lastName = $('#signup-last-name').value.trim() || signupDraft.lastName || null;
      signupDraft.username = $('#signup-username').value.trim() || signupDraft.username || null;
      Store.saveSignupDraft(signupDraft);
      signupStep = 'verify';
      renderSignupStep();
    });

    $('#signup-continue-btn').addEventListener('click', async () => {
      const continueBtn = $('#signup-continue-btn');

      // Backend Bloque 4 hotfix (05_Revision_Post_Implementacion_ChatGPT.md §2) — si ya existe
      // una sesión válida para ESTE MISMO email, el OTP de esta alta ya se consumió con éxito
      // en un intento anterior (típicamente: runOfficializeAndEnter() se cortó por un fallo
      // TRANSITORIO del claim, ver esa función). Un código de un solo uso ya gastado nunca
      // puede volver a verificarse — pedirlo de nuevo llevaría a un error confuso
      // (code_invalid) en vez de al reintento real que el usuario necesita. Se salta directo a
      // resumeDraftFlow() (que reintenta runOfficializeAndEnter() completo, siempre seguro de
      // reintentar) ANTES de exigir un código con formato válido en el campo.
      if (signupStep === 'verify') {
        const existingSession = await Auth.getSession();
        const existingSessionEmail = existingSession && existingSession.user && existingSession.user.email
          ? existingSession.user.email.trim().toLowerCase() : null;
        const draftEmailForRetry = signupDraft.email ? signupDraft.email.trim().toLowerCase() : null;
        if (existingSession && existingSessionEmail && draftEmailForRetry && existingSessionEmail === draftEmailForRetry) {
          continueBtn.disabled = true;
          await resumeDraftFlow();
          continueBtn.disabled = false;
          return;
        }
      }

      if (!recomputeSignupStepValidity()) return;

      if (signupStep === 1) {
        signupDraft.email = $('#signup-email').value.trim();
        signupDraft.password = $('#signup-password').value;
        if (!Auth.isConfigured()) { signupStep = 2; renderSignupStep(); return; }
        continueBtn.disabled = true;
        const result = await Auth.signUp(signupDraft.email, signupDraft.password);
        continueBtn.disabled = false;
        if (!result.ok) {
          $('#signup-step1-error').textContent = SIGNUP_STEP1_ERROR_TEXT[result.reason] || SIGNUP_STEP1_ERROR_TEXT.unknown;
          $('#signup-step1-error').hidden = false;
          return;
        }
        $('#signup-step1-error').hidden = true;
        // Backend Bloque 3 (Experiencia_Inicial.md §2.1) — el código ya se envió (Auth.signUp
        // lo dispara), pero 'verify' pasa a ser el ÚLTIMO paso: se sigue directo a "TU
        // PERFIL" sin pedirlo todavía. El borrador se persiste para sobrevivir un refresh
        // antes de confirmar (caso A0).
        signupStep = 2;
        Store.saveSignupDraft(signupDraft);
        renderSignupStep();
        return;
      }

      if (signupStep === 'verify') {
        continueBtn.disabled = true;
        const result = await Auth.verifySignupOtp(signupDraft.email, $('#signup-verify-code').value.trim());
        continueBtn.disabled = false;
        if (!result.ok) {
          $('#signup-verify-error').textContent = SIGNUP_VERIFY_ERROR_TEXT[result.reason] || SIGNUP_VERIFY_ERROR_TEXT.unknown;
          $('#signup-verify-error').hidden = false;
          return;
        }
        $('#signup-verify-error').hidden = true;
        // Backend Bloque 3 (03_Revision_ChatGPT.md §8) — "email confirmado ≠ onboarding
        // terminado": nunca se asume Home acá. resumeDraftFlow() decide si falta perfil
        // mínimo, falta Nivel, o ya está todo listo para oficializar.
        continueBtn.disabled = true;
        await resumeDraftFlow();
        continueBtn.disabled = false;
        return;
      }

      // signupStep === 2 — perfil MÍNIMO (Backend Bloque 3, Experiencia_Inicial.md §2.2):
      // nombre + apellido + @usuario + términos, nada más. Rama competitiva/ubicación/datos
      // secundarios NO se piden acá (Experiencia_Inicial.md §2.2) — quedan para Perfil más
      // adelante. Nunca llama a Auth.completeProfile acá: eso pasa recién al oficializar
      // (runOfficializeAndEnter), después de confirmar el email, con el borrador ya completo.
      signupDraft.firstName = $('#signup-first-name').value.trim();
      signupDraft.lastName = $('#signup-last-name').value.trim();
      signupDraft.username = $('#signup-username').value.trim();
      // Sin "nombre visible" propio en el alta (Experiencia_Inicial.md §2.2: "BRAMU utiliza
      // el nombre ya ingresado como referencia inicial") — createUserAccount/complete_profile
      // ya saben usar el nombre de pila cuando displayName llega vacío/repetido.
      signupDraft.displayName = signupDraft.firstName;
      signupDraft.termsVersion = TERMS_VERSION;

      if (!Auth.isConfigured()) {
        const user = Store.signUpAndLogin(signupDraft);
        syncCurrentIdentityFromStore();
        openPlayerCardScreen(user);
        return;
      }

      Store.saveSignupDraft(signupDraft);
      nivelOnboardingContext = 'draft';
      openNivelOnboardingIntro();
    });
  }

  /** Backend Bloque 3 — pinta en el DOM del paso 2 lo que ya haya en `signupDraft`, para
   *  retomar el alta sin que el usuario tenga que retipear nombre/apellido/@usuario (A0:
   *  abandonó antes de confirmar el email, o confirmó temprano y todavía le falta el perfil). */
  function prefillSignupStep2Fields() {
    $('#signup-first-name').value = signupDraft.firstName || '';
    $('#signup-last-name').value = signupDraft.lastName || '';
    $('#signup-username').value = signupDraft.username || '';
    if (signupDraft.username) $('#signup-username').dataset.touched = '1';
    $('#signup-terms-checkbox').checked = !!signupDraft.termsVersion;
    updateSignupAvatarInitials();
    if (signupDraft.username) renderUsernameFeedback('signup-username', 'signup-username-feedback');
  }

  /** Backend Bloque 3 (03_Revision_ChatGPT.md §8) — único punto que decide "¿dónde sigue el
   *  alta en curso?" a partir de `signupDraft`: perfil mínimo incompleto -> paso 2; perfil listo
   *  pero Nivel sin confirmar -> Nivel BRAMU; los dos completos -> oficializa y entra a Home.
   *  Se llama tras CUALQUIER verificación de OTP exitosa (al final del flujo normal, o
   *  "Confirmar email ahora" adelantado) y al arrancar la app si queda un borrador sin
   *  terminar (bootWithServerSession/resumeServerSession). */
  async function resumeDraftFlow() {
    // `signupDraft.username` alcanza como criterio: solo se fija en el paso 2 después de que
    // recomputeSignupStepValidity ya exigió nombre/apellido/formato/términos (flujo normal), o
    // se siembra en resumeSignupProfileStep SOLO cuando el servidor confirma que complete_profile
    // ya corrió (`serverUser.username`) — en ambos casos implica perfil mínimo completo.
    if (!signupDraft.username) {
      signupStep = 2;
      prefillSignupStep2Fields();
      renderSignupStep();
      showView('signup');
      return;
    }
    if (!signupDraft.nivelState) {
      nivelOnboardingContext = 'draft';
      openNivelOnboardingIntro();
      return;
    }
    await runOfficializeAndEnter();
  }

  /** Backend Bloque 3 — comando idempotente completo: perfil mínimo (complete_profile) +
   *  oficialización de Nivel (Edge Function officialize-onboarding, motor JS compartido con
   *  el navegador — nunca recalculado acá). Cada paso es idempotente por su cuenta (ver la
   *  migración/la Edge Function), así que reintentar esta función entera tras cualquier error
   *  de red/timeout es siempre seguro. Si el @usuario quedó ocupado mientras tanto (carrera,
   *  03_Revision_ChatGPT.md §6), complete_profile revierte toda su transacción sin tocar
   *  Nivel: se conserva TODO el resto del borrador y solo se vuelve a pedir el @usuario. */
  async function runOfficializeAndEnter() {
    // Backend Bloque 4 (03_Revision_ChatGPT.md §2/Decisión 2) — "antes de complete_profile y
    // de oficializar Nivel, consumir el claim": este es el único punto donde una cuenta nueva
    // que llegó desde un link de reclamo (?claim=<token>, ver captureClaimTokenFromUrl) todavía
    // no tiene perfil oficializado, así que es el momento correcto (y el único) para intentar
    // adoptar la identidad provisional. Éxito o fracaso, el alta sigue su curso normal después
    // (nunca bloquea la creación de la cuenta por un token roto).
    const pendingClaimToken = Store.loadClaimToken();
    if (pendingClaimToken) {
      const claimResult = await Auth.claimProvisionalPlayer(pendingClaimToken);
      if (claimResult.ok) {
        Store.clearClaimToken();
        showToast('Reclamaste la invitación — tu historial ya quedó vinculado a tu cuenta.', 3200);
      } else if (claimResult.code !== 'not_configured') {
        // Códigos definitivos (03_Revision_ChatGPT.md §7 — nunca fusión automática): el token
        // no aplica más, reintentarlo no cambiaría nada — se limpia y el alta sigue su curso
        // normal SIN reclamo.
        const DEFINITIVE_CODES = ['claim_invalid', 'claim_expired', 'claim_already_used', 'account_already_registered', 'account_already_claimed_identity'];
        if (DEFINITIVE_CODES.includes(claimResult.code)) {
          Store.clearClaimToken();
          showToast('No pudimos vincular esa invitación. Tu cuenta se crea igual, normalmente.', 3600);
        } else {
          // Backend Bloque 4 hotfix (05_Revision_Post_Implementacion_ChatGPT.md §2) —
          // CORRECCIÓN OBLIGATORIA: un fallo TRANSITORIO (red, rate_limited, etc.) NUNCA puede
          // dejar avanzar a complete_profile/officializeLevel. Antes de este fix, el código
          // seguía de largo igual: terminaba de registrar la cuenta (P2), y en el próximo
          // intento el claim ya no podía adoptarse (account_already_registered) — conservar el
          // token no alcanzaba si el resto del flujo lo volvía inservible de todos modos. Acá
          // se corta ANTES de tocar perfil/Nivel: el token y el borrador quedan intactos.
          // Vía de reintento sin pedir un OTP nuevo: la sesión YA es válida en este punto
          // (nunca se llega hasta acá sin sesión), así que alcanza con volver a pasar por este
          // mismo flujo — el botón CONFIRMAR MI NIVEL/CONFIRMAR CÓDIGO de la pantalla a la que
          // se vuelve detecta la sesión ya activa y reintenta runOfficializeAndEnter()
          // directamente, sin consumir OTP (ver el chequeo de sesión agregado en el handler de
          // signup-continue-btn más abajo).
          showToast('No pudimos procesar tu invitación pendiente. Volvé a intentarlo en un momento (no hace falta un código nuevo).', 4000);
          signupStep = 'verify';
          renderSignupStep();
          showView('signup');
          return;
        }
      }
    }

    const completeResult = await Auth.completeProfile({
      username: signupDraft.username,
      firstName: signupDraft.firstName,
      lastName: signupDraft.lastName,
      displayName: signupDraft.displayName || signupDraft.firstName,
      termsVersion: signupDraft.termsVersion,
    });
    if (!completeResult.ok) {
      signupStep = 2;
      prefillSignupStep2Fields();
      renderSignupStep();
      showView('signup');
      const isUsernameIssue = ['username_taken', 'username_reserved', 'username_invalid_format'].includes(completeResult.code);
      if (isUsernameIssue) {
        const feedback = $('#signup-username-feedback');
        feedback.textContent = COMPLETE_PROFILE_ERROR_TEXT[completeResult.code] || COMPLETE_PROFILE_ERROR_TEXT.unknown;
        feedback.classList.add('is-taken');
      } else {
        $('#signup-step2-error').textContent = COMPLETE_PROFILE_ERROR_TEXT[completeResult.code] || COMPLETE_PROFILE_ERROR_TEXT.unknown;
        $('#signup-step2-error').hidden = false;
      }
      return;
    }

    const officialResult = await Auth.officializeLevel({
      mode: signupDraft.nivelPathType,
      quickSeedKey: signupDraft.nivelPathType === 'quick' ? signupDraft.nivelQuickSeedKey : undefined,
      quizAnswers: signupDraft.nivelPathType === 'full' ? signupDraft.nivelQuizAnswers : undefined,
    });
    if (!officialResult.ok) {
      // El borrador NO se toca: perfil mínimo ya quedó persistido (complete_profile es
      // idempotente), así que reintentar desde acá vuelve a llamarlo con el mismo username
      // (no-op) y reintenta solo la parte de Nivel que de verdad falló.
      showToast('No pudimos confirmar tu Nivel BRAMU. Probá de nuevo.', 3000);
      signupStep = 'verify';
      renderSignupStep();
      showView('signup');
      return;
    }

    Store.clearSignupDraft();
    signupDraft = {};
    const serverUser = await Auth.fetchOwnProfile();
    Store.cacheServerUser(serverUser);
    syncServerLevelState(serverUser);
    syncCurrentIdentityFromStore();
    completeIdentifyAction();
  }

  /** Backend Bloque 3 — cachea `user.levelState` (autoridad server-side) en la MISMA forma
   *  local que ya usa Store.loadLevelV1State, para que Home/Mi Perfil/Perfil público
   *  (currentLevelV1State y todo lo que ya lee esa clave) sigan funcionando SIN NINGÚN
   *  CAMBIO — mismo criterio que Store.cacheServerUser para el resto del perfil (ver cabecera
   *  de auth.js). PENDIENTE se sigue representando como ausencia de fila local (igual que
   *  siempre): nunca se cachea acá, solo CALIBRANDO/CALIBRADO/RECALIBRANDO en adelante. */
  function syncServerLevelState(user) {
    if (!user || !user.levelState || user.levelState.status === 'PENDIENTE') return;
    const STATE_MAP = { CALIBRANDO: LV.STATES.CALIBRATING, CALIBRADO: LV.STATES.CALIBRATED, RECALIBRANDO: LV.STATES.RECALIBRATING };
    Store.saveLevelV1State(user.id, {
      mu: user.levelState.mu,
      confidence: user.levelState.confidence,
      evidenceUnits: 0,
      state: STATE_MAP[user.levelState.status] || LV.STATES.CALIBRATING,
      ratedMatches: user.levelState.ratedMatches || 0,
      distinctOpponents: user.levelState.distinctOpponents || 0,
      lastRatedAt: null,
      algorithmVersion: user.levelState.algorithmVersion,
      origin: {
        type: user.levelState.questionnaireMode,
        questionnaireVersion: user.levelState.questionnaireVersion,
        categoryContextKey: user.levelState.categoryContextKey,
        declaredCategory: user.levelState.declaredCategory,
      },
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
  // BRAMUlab_V04.6 — 'no-compito' se agrega para la pregunta final de categoría de Nivel
  // BRAMU (§6 del Handoff V04.6): distinta de 'no-se' (no conozco mi categoría) — "no
  // compito" declara que directamente no juega torneos. Mismo mapa reusado por Editar Datos
  // (PROFILE_PICKER_FIELDS.category lee sus keys de acá, sin lista propia).
  const CATEGORY_LABELS = { '1': '1ª', '2': '2ª', '3': '3ª', '4': '4ª', '5': '5ª', '6': '6ª', '7': '7ª', '8': '8ª', '9': '9ª', 'no-se': 'No estoy seguro', 'no-compito': 'No compito' };
  const GENDER_LABELS = { femenino: 'Femenino', masculino: 'Masculino', otro: 'Otro', 'prefiero-no-decir': 'Prefiero no decir' };
  // Pre-Production P0.1C — mismos valores 'F'/'M' que ya usa el gate de Ranking
  // (#ranking-gate-branch-options), acá como mapa reusable para PROFILE_PICKER_FIELDS.branch.
  const BRANCH_LABELS = { F: 'Femenina', M: 'Masculina' };
  // BRAMUlab_V03.6 (§6) — mensaje prearmado único del deep link de WhatsApp: fijo, sin Nivel/
  // localidad/nombre completo/horario/cancha ni links extra (consolidado explícito).
  // BRAMUlab_V03.6 (corrección post-QA real, prioridad 6) — copy reemplazado a pedido: mismo
  // criterio de siempre (sin Nivel/localidad/nombre/horario/cancha/links extra).
  const WHATSAPP_CONTACT_MESSAGE = 'Hola, te encontré en BRAMUlab. ¿Estás para armar un partido de pádel?';

  /** Consolidado §3 — "TU JUGADOR ESTÁ LISTO": momento de recompensa post-signup, nunca un
   *  alert genérico.
   *  BRAMUlab_V04.7 — bug real corregido: esta pantalla mostraba siempre "CALIBRANDO · 0/5"
   *  aunque el Nivel BRAMU V1 todavía no existiera (con el preview activo, ENTRAR A BRAMU manda
   *  directo al onboarding obligatorio desde acá — ver initPlayerCardScreen). CALIBRANDO implica
   *  que ya hay un Nivel confirmado calibrando con partidos reales, algo falso en ese momento.
   *  Con `nivelOnboardingPending` en true se muestra un estado neutral ("PENDIENTE", sin
   *  progreso ni número inventado); una vez confirmado el Nivel (o con el preview apagado, donde
   *  no existe este onboarding y sigue vigente el Nivel simulado de siempre) se ve CALIBRANDO.
   *  BRAMUlab_V04.8 (§2) — la ficha pasa a reusar el mismo DOM/clases que la Tarjeta de jugador
   *  de Home/MI PERFIL (`.player-card__avatar`/`__info`/`__level*`, ver index.html): mismo
   *  criterio de foto (`data-has-photo`, igual que renderPlayerCard) — nunca un layout propio
   *  para esta pantalla. Edad/Mano/Lado se retiran de esta tarjeta (ya se ven/editan en Mis
   *  Datos): "esto es tu perfil en BRAMU", no una ficha de datos aparte.
   *  Esta pantalla nunca vuelve a mostrarse DESPUÉS de confirmar el Nivel BRAMU V1
   *  (confirmNivelOnboarding entra directo a BRAMU vía completeIdentifyAction, sin pasar por
   *  acá): el caso "no pendiente" solo ocurre con el preview apagado (producción sin Nivel V1
   *  todavía), siempre con la cuenta recién creada — mismo criterio legacy que Home usa para
   *  cuentas nuevas (PH.buildCalibrationStatus), nunca el badge de calibración real de Home.
   *  BRAMUlab_V04.10 (§4) — "todavía falta definir Nivel": título/CTA principal pasan a "YA
   *  CASI ESTAMOS"/"DEFINIR MI NIVEL" mientras `pending`, gateados por el MISMO flag de
   *  siempre — el caso "no pendiente" conserva el copy anterior, que sigue siendo el correcto
   *  para ese camino (sin ningún Nivel que definir). */
  function openPlayerCardScreen(user) {
    const hasPhoto = !!user.profilePhoto;
    $('#player-card-avatar').dataset.hasPhoto = String(hasPhoto);
    const avatarImg = $('#player-card-avatar-img');
    if (hasPhoto) avatarImg.src = user.profilePhoto; else avatarImg.removeAttribute('src');
    $('#player-card-name').textContent = user.displayName || '—';
    $('#player-card-handle').textContent = user.username ? `@${user.username}` : '—';
    const pending = nivelOnboardingPending(user);
    const levelSubEl = $('#player-card-level-sub');
    if (pending) {
      setLevelValueText('player-card-level-value', 'PENDIENTE', true);
      levelSubEl.hidden = true;
      levelSubEl.innerHTML = '';
    } else {
      setLevelValueText('player-card-level-value', 'CALIBRANDO', true);
      levelSubEl.hidden = false;
      levelSubEl.textContent = PH.buildCalibrationStatus(0).progressText;
    }
    $('#player-card-subtitle').textContent = pending
      ? 'Para poder jugar, primero creá tu Nivel BRAMU.'
      : 'Completá 5 partidos para conocer tu Nivel BRAMU.';
    // BRAMUlab_V04.10 (§4) — "todavía falta definir Nivel": título/CTA principal cambian SOLO
    // mientras el onboarding está pendiente (mismo `pending` de arriba) — con el preview
    // apagado (caso "no pendiente", default de producción hoy) no hay ningún Nivel que definir
    // acá, así que el copy de siempre sigue describiendo bien ese camino.
    $('#player-card-title').textContent = pending ? 'YA CASI ESTAMOS' : 'TU PERFIL ESTÁ LISTO';
    $('#player-card-enter-btn').textContent = pending ? 'DEFINIR MI NIVEL' : 'ENTRAR A BRAMU';
    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 4) — invitación simple, nunca bloquea
    // ni reemplaza ENTRAR A BRAMU, nunca menciona el Nivel BRAMU.
    // BRAMUlab_V04.9 (§4) — simplificado a solo WhatsApp: desde el Handoff V04.6 la ubicación es
    // obligatoria del alta (ya viene siempre completa acá), así que el único dato que puede
    // faltar en esta pantalla es el WhatsApp (sigue opcional) — se retira el composer genérico
    // "tu ubicación y/o tu WhatsApp" (dead code desde que ubicación dejó de ser opcional) por un
    // copy fijo, sin puntos rojos ni sistema de pendientes.
    const missingWhatsapp = !user.phone;
    $('#player-card-complete-hint').hidden = !missingWhatsapp;
    $('#player-card-complete-profile-btn').hidden = !missingWhatsapp;
    if (missingWhatsapp) $('#player-card-complete-hint').textContent = 'Podés completar tu WhatsApp más adelante desde Mi Perfil.';
    showView('player-card');
  }

  function initPlayerCardScreen() {
    // BRAMUlab_V04.4 (Etapa D, bloque 1) — único punto de entrada al onboarding de Nivel BRAMU
    // V1: solo tras un alta NUEVA (esta pantalla nunca aparece en Login, ver completeIdentifyAction
    // más abajo, que SÍ es compartida con Login y por eso no es donde ramificar), con el flag de
    // vista previa prendido y sin un estado V1 ya guardado para este usuario (nunca repite el
    // onboarding si ya existe, aunque el flag siga prendido — ej. crear una segunda cuenta).
    $('#player-card-enter-btn').addEventListener('click', () => {
      // BRAMUlab_V04.7 — mismo criterio de nivelOnboardingPending (antes reimplementado acá
      // mismo, ver openPlayerHome/nivelOnboardingPending para el resto de los puntos de entrada).
      if (nivelOnboardingPending(Store.getCurrentUser())) { nivelOnboardingContext = 'account'; openNivelOnboardingIntro(); return; }
      completeIdentifyAction();
    });
    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 4) — camino directo a Mis Datos, nunca
    // pasa por completeIdentifyAction (esa acción es específica de ENTRAR A BRAMU/reanudar un
    // partido pausado por pedir login, no aplica acá).
    $('#player-card-complete-profile-btn').addEventListener('click', () => openProfileScreen('mis-datos'));
  }

  /* ======================================================================
     BRAMUlab_V04.4 (Etapa D, bloque 1) — ONBOARDING DE NIVEL BRAMU V1
     Primer bloque visible de Etapa D, detrás de Store.isLevelV1PreviewEnabled().
     Esta sección es SOLO orquestación de UI: cero fórmula propia — cada número
     sale de LVC (level-calibration.js) o LV (level.js). No se conecta a
     partidos reales, Ranking, Perfil público ni BRAMU Intelligence (eso queda
     para el próximo bloque de Etapa D, ver Consolidado/Informe).
     ====================================================================== */

  let nivelStep = 'intro'; // 'intro' | 'quick' | 'quiz' | 'result'
  let nivelPathType = null; // 'quick' | 'full'
  let nivelQuizIndex = 0;
  let nivelQuizAnswers = {}; // {autoevaluacion, anos, entrenamiento, frecuencia, red, paredes} -> key
  let nivelRawResult = null; // LVC.computeFullEstimate() | LVC.computeQuickLevel()

  const NIVEL_STEP_TITLES = { intro: 'TU NIVEL BRAMU', quick: 'ELEGÍ TU NIVEL', quiz: 'TU NIVEL BRAMU', result: 'TU NIVEL BRAMU' };

  // §3.2/§3.5 — mismas 5 anclas de autoevaluación de la fórmula normativa, reutilizadas tal
  // cual para las descripciones de cada fila (nunca una segunda redacción suelta acá).
  const NIVEL_QUICK_SEED_COPY = [
    { key: 'iniciacion', title: 'Iniciación', desc: 'Estoy aprendiendo las reglas y los golpes básicos; me cuesta sostener el punto' },
    { key: 'intermedio', title: 'Intermedio', desc: 'Sostengo intercambios y tengo algunos recursos, pero todavía cometo errores frecuentes' },
    { key: 'intermedio_alto', title: 'Intermedio alto', desc: 'Construyo puntos y uso posiciones, paredes y juego en pareja, aunque bajo presión todavía cometo errores' },
    { key: 'avanzado', title: 'Avanzado', desc: 'Manejo ritmos, posiciones y distintos recursos con consistencia' },
    { key: 'profesional', title: 'Profesional', desc: 'Compito en categorías máximas o circuito profesional a alta velocidad y presión' },
  ];

  // Estimador inicial V1.2 — cuestionario completo de 6 preguntas. Se retira la pregunta
  // competitiva ligada a categoría porque la categoría local ya no interviene en el cálculo
  // inicial universal. Cada `id` sigue siendo una key explícita, nunca un índice posicional.
  const NIVEL_FULL_QUESTIONS = [
    { id: 'autoevaluacion', label: '¿Cómo describirías tu juego actual?', options: NIVEL_QUICK_SEED_COPY.map((o) => ({ key: o.key, title: o.title, desc: o.desc })) },
    { id: 'anos', label: '¿Hace cuánto jugás al pádel?', options: [
      { key: 'menos_1', title: 'Menos de un año' },
      { key: 'uno_a_cinco', title: 'Entre uno y cinco años' },
      { key: 'mas_5', title: 'Más de cinco años' },
    ] },
    { id: 'entrenamiento', label: '¿Qué experiencia tenés con clases o entrenamiento?', options: [
      { key: 'nunca', title: 'Nunca tomé clases' },
      { key: 'aisladas', title: 'Hice algunas clases o clínicas aisladas' },
      { key: 'sin_continuidad', title: 'Tomo clases de vez en cuando, sin continuidad' },
      { key: 'regular_pasado', title: 'Entrené regularmente durante una etapa, aunque actualmente no entreno' },
      { key: 'regular_actual', title: 'Entreno con regularidad actualmente' },
    ] },
    { id: 'frecuencia', label: 'En tus últimos tres meses activos, ¿con qué frecuencia jugaste?', options: [
      { key: 'esporadico', title: 'Juego esporádicamente o muy poco' },
      { key: 'una_a_tres_mes', title: 'Juego entre una y tres veces por mes' },
      { key: 'una_dos_semana', title: 'Juego una o dos veces por semana' },
      { key: 'tres_mas_semana', title: 'Juego tres veces por semana o más' },
    ] },
    { id: 'red', label: 'Cuando estás en la red, ¿qué opción te representa mejor?', options: [
      { key: 'a', title: 'Me cuesta subir, ubicarme y sostener la posición en la red' },
      { key: 'b', title: 'Resuelvo voleas simples, pero pierdo la red fácilmente cuando me presionan o me superan con un globo' },
      { key: 'c', title: 'Suelo sostener la red y ubicarme con mi compañero, aunque de vez en cuando me apuro y cometo errores no forzados' },
      { key: 'd', title: 'Uso voleas y bandejas para conservar la posición, elijo cuándo acelerar y minimizo los errores no forzados' },
      { key: 'e', title: 'Manejo distintos golpes, direcciones y ritmos incluso bajo presión; recupero la red con consistencia' },
    ] },
    { id: 'paredes', label: '¿Cómo te llevás con las paredes?', options: [
      { key: 'a', title: 'Intento jugar la pelota antes de la pared porque todavía me cuesta interpretar el rebote' },
      { key: 'b', title: 'Resuelvo rebotes simples de pared de fondo, pero a veces me ubico tarde o calculo mal la salida' },
      { key: 'c', title: 'Uso pared de fondo y lateral con naturalidad en situaciones habituales, pero las pelotas rápidas o profundas todavía me generan errores' },
      { key: 'd', title: 'Leo y resuelvo paredes simples y dobles, me ubico antes del rebote y mantengo el control incluso con velocidad' },
      { key: 'e', title: 'Anticipo rebotes complejos y utilizo las paredes con consistencia bajo presión' },
    ] },
  ];

  function openNivelOnboardingIntro() {
    nivelStep = 'intro';
    nivelPathType = null;
    nivelQuizIndex = 0;
    nivelQuizAnswers = {};
    nivelRawResult = null;
    renderNivelOnboardingStep();
    showView('nivel-onboarding');
  }

  function renderNivelOnboardingStep() {
    $('#nivel-onboarding-step-title').textContent = NIVEL_STEP_TITLES[nivelStep] || 'TU NIVEL BRAMU';
    $all('.nivel-step').forEach((el) => { el.hidden = el.dataset.step !== nivelStep; });
    // BRAMUlab_V04.7 — "intro"/"quick" centraban verticalmente (`.access-scroll--centered`,
    // retirada en V04.9 — "quedó demasiado centrada", revisión visual): todo el flujo de TU
    // NIVEL BRAMU queda anclado arriba, igual que el resto de la familia de acceso.
    if (nivelStep === 'quick') renderNivelQuickStep();
    else if (nivelStep === 'quiz') renderNivelQuizStep();
    else if (nivelStep === 'result') renderNivelResultStep();
  }

  function renderNivelQuickStep() {
    const list = $('#nivel-quick-list');
    list.innerHTML = NIVEL_QUICK_SEED_COPY.map((opt) => `
      <button type="button" class="nivel-answer-option" data-seed="${opt.key}">
        <span class="nivel-answer-option__title">${opt.title}</span>
        <span class="nivel-answer-option__desc">${opt.desc}</span>
      </button>
    `).join('');
    $all('#nivel-quick-list .nivel-answer-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const seed = LVC.computeQuickLevel(btn.dataset.seed);
        if (!seed) return;
        nivelPathType = 'quick';
        nivelRawResult = seed;
        nivelStep = 'result';
        renderNivelOnboardingStep();
      });
    });
  }

  function renderNivelQuizStep() {
    const question = NIVEL_FULL_QUESTIONS[nivelQuizIndex];
    const total = NIVEL_FULL_QUESTIONS.length;
    $('#nivel-quiz-progress-bar').style.width = Math.round(((nivelQuizIndex + 1) / total) * 100) + '%';
    $('#nivel-quiz-progress-label').textContent = `Pregunta ${nivelQuizIndex + 1} de ${total}`;
    $('#nivel-quiz-question-text').textContent = question.label;
    const selectedKey = nivelQuizAnswers[question.id];
    const list = $('#nivel-quiz-answer-list');
    list.innerHTML = question.options.map((opt) => `
      <button type="button" class="nivel-answer-option${opt.key === selectedKey ? ' is-selected' : ''}" data-key="${opt.key}">
        <span class="nivel-answer-option__title">${opt.title}</span>
        ${opt.desc ? `<span class="nivel-answer-option__desc">${opt.desc}</span>` : ''}
      </button>
    `).join('');
    const continueBtn = $('#nivel-quiz-continue-btn');
    continueBtn.disabled = !selectedKey;
    continueBtn.textContent = nivelQuizIndex === total - 1 ? 'VER MI NIVEL' : 'CONTINUAR';
    $all('#nivel-quiz-answer-list .nivel-answer-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        nivelQuizAnswers[question.id] = btn.dataset.key;
        renderNivelQuizStep();
      });
    });
  }

  // §7 del Handoff V04.6 — geometría del medidor semicircular 1-10 (compartida por el arco de
  // fondo ya dibujado en index.html y el arco/aguja que esta función recalcula).
  const NIVEL_GAUGE = Object.freeze({ cx: 110, cy: 112, r: 88, min: 1, max: 10 });

  function nivelGaugePoint(thetaDeg) {
    const rad = thetaDeg * Math.PI / 180;
    return { x: NIVEL_GAUGE.cx + NIVEL_GAUGE.r * Math.cos(rad), y: NIVEL_GAUGE.cy - NIVEL_GAUGE.r * Math.sin(rad) };
  }
  // v=1 -> 180° (izquierda), v=10 -> 0° (derecha), pasando por arriba (90°) en el medio.
  function nivelGaugeTheta(value) { return 180 * (NIVEL_GAUGE.max - value) / (NIVEL_GAUGE.max - NIVEL_GAUGE.min); }

  function nivelGaugeArcPath(fromValue, toValue) {
    const p1 = nivelGaugePoint(nivelGaugeTheta(fromValue));
    const p2 = nivelGaugePoint(nivelGaugeTheta(toValue));
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${NIVEL_GAUGE.r} ${NIVEL_GAUGE.r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  /** Único punto que mueve el arco del medidor — nunca redibuja `d` en otro lado. La transición
   *  suave al afinar por categoría (§7: "mover suavemente... desde la estimación inicial al
   *  valor afinado") la aporta la propia transición CSS de `.nivel-gauge__fill` (siempre activa).
   *  BRAMUlab_V04.9 (§7) — se retira el tick blanco (`.nivel-gauge__marker` de V04.7, ver
   *  index.html/styles.css): seguía sin funcionar y en valores altos salía del arco (revisión
   *  visual). El propio extremo redondeado del arco (`stroke-linecap:round`) ya indica la
   *  posición en la escala, sin agregar ningún reemplazo — el parámetro `animate` que solo
   *  controlaba la transición del tick queda sin ningún efecto y se retira de la firma. */
  function setNivelGaugeValue(value) {
    const v = Math.min(NIVEL_GAUGE.max, Math.max(NIVEL_GAUGE.min, value));
    $('#nivel-gauge-value-arc').setAttribute('d', nivelGaugeArcPath(NIVEL_GAUGE.min, v));
    $('#nivel-gauge-value').textContent = LV.roundPublicLevel(v).toFixed(1);
    $('#nivel-result-category').textContent = LVC.categorizeLevel(v).label;
  }

  function renderNivelResultStep() {
    // V1.2 — el resultado inicial es universal: no depende de país/rama/categoría local.
    // La coherencia sigue comparando autoevaluación vs. técnica en el camino completo.
    const universalStep = LVC.computeCategoryStep(nivelRawResult, null, null);
    $('#nivel-result-label').textContent = 'TU PUNTO DE PARTIDA EN BRAMU';
    $('#nivel-coherence-note').hidden = !universalStep.coherenceFlag;
    $('#nivel-confirm-btn').disabled = false;
    setNivelGaugeValue(universalStep.adjustedLevel);
  }

  /** Confirma el nivel inicial V1.2 universal. La categoría local ya no participa del alta
   *  ni del número: el navegador guarda solo la vista previa y el servidor recalcula la misma
   *  estimación desde las respuestas crudas antes de persistirla. */
  async function confirmNivelOnboarding() {
    if (!nivelRawResult) return;
    const confirmedAt = new Date().toISOString();
    const confirmResult = LVC.confirmInitialLevelV1_2(nivelRawResult, confirmedAt);
    const state = LVC.buildInitialCalibrationState(nivelPathType, confirmResult, nivelPathType === 'full' ? nivelQuizAnswers : null);

    if (nivelOnboardingContext === 'draft') {
      signupDraft.nivelPathType = nivelPathType;
      signupDraft.nivelQuickSeedKey = nivelPathType === 'quick' ? (nivelRawResult && nivelRawResult.seedKey) : null;
      signupDraft.nivelQuizAnswers = nivelPathType === 'full' ? nivelQuizAnswers : null;
      signupDraft.nivelState = state; // vista previa local únicamente — nunca la autoridad
      Store.saveSignupDraft(signupDraft);

      // Backend Bloque 3 — si el email ya se confirmó anticipadamente, Supabase dejó una
      // sesión persistida. En ese caso NO corresponde volver a pedir OTP: el borrador ya tiene
      // perfil mínimo + Nivel y puede ir directo al comando idempotente de oficialización.
      // La comparación de email evita usar por accidente una sesión de otra cuenta junto con
      // un borrador local viejo.
      const session = await Auth.getSession();
      const sessionEmail = session && session.user && session.user.email
        ? session.user.email.trim().toLowerCase()
        : null;
      const draftEmail = signupDraft.email ? signupDraft.email.trim().toLowerCase() : null;
      if (session && sessionEmail && draftEmail && sessionEmail === draftEmail) {
        await runOfficializeAndEnter();
        return;
      }

      signupStep = 'verify';
      renderSignupStep();
      showView('signup');
      return;
    }

    const user = Store.getCurrentUser();
    if (!user) return;
    Store.saveLevelV1State(user.id, state);
    completeIdentifyAction();
  }

  function initNivelOnboardingScreen() {
    $('#nivel-onboarding-back-btn').addEventListener('click', () => {
      if (nivelStep === 'result') { nivelStep = nivelPathType === 'full' ? 'quiz' : 'quick'; renderNivelOnboardingStep(); return; }
      if (nivelStep === 'quiz') {
        if (nivelQuizIndex > 0) { nivelQuizIndex -= 1; renderNivelOnboardingStep(); return; }
        nivelStep = 'intro'; renderNivelOnboardingStep(); return;
      }
      if (nivelStep === 'quick') { nivelStep = 'intro'; renderNivelOnboardingStep(); return; }
      // BRAMUlab_V04.7 — bug real corregido: 'intro' volvía llamando completeIdentifyAction(),
      // que mandaba directo al Home como si el onboarding hubiera terminado — el Nivel BRAMU
      // obligatorio quedaba sin crear y la app se podía usar igual. Ahora vuelve a "TU PERFIL
      // ESTÁ LISTO" (el onboarding sigue pendiente); openPlayerHome/nivelOnboardingPendingUser
      // bloquean cualquier otro camino que intente llegar al Home sin Nivel confirmado.
      // Backend Bloque 3 — en modo 'draft' (sin cuenta todavía) vuelve al paso 2 del alta en
      // vez de a openPlayerCardScreen/completeIdentifyAction (que necesitan una cuenta real).
      if (nivelOnboardingContext === 'draft') {
        signupStep = 2;
        prefillSignupStep2Fields();
        renderSignupStep();
        showView('signup');
        return;
      }
      const user = Store.getCurrentUser();
      if (user) { openPlayerCardScreen(user); } else { completeIdentifyAction(); }
    });

    $('#nivel-path-full-btn').addEventListener('click', () => {
      nivelPathType = 'full';
      nivelQuizIndex = 0;
      nivelQuizAnswers = {};
      nivelStep = 'quiz';
      renderNivelOnboardingStep();
    });
    $('#nivel-path-quick-btn').addEventListener('click', () => {
      nivelPathType = 'quick';
      nivelStep = 'quick';
      renderNivelOnboardingStep();
    });

    $('#nivel-quiz-continue-btn').addEventListener('click', () => {
      const total = NIVEL_FULL_QUESTIONS.length;
      if (nivelQuizIndex < total - 1) { nivelQuizIndex += 1; renderNivelOnboardingStep(); return; }
      nivelRawResult = LVC.computeFullEstimate(nivelQuizAnswers);
      nivelStep = 'result';
      renderNivelOnboardingStep();
    });

    $('#nivel-confirm-btn').addEventListener('click', confirmNivelOnboarding);
    // "Revisar respuestas" — vuelve a empezar la elección de camino (también es la acción que
    // ofrece el aviso de coherencia, §8 del Handoff V04.6); esta primera versión no reconstruye
    // las respuestas anteriores paso a paso.
    $('#nivel-review-btn').addEventListener('click', () => { openNivelOnboardingIntro(); });
  }

  /** `null` sin sesión o sin estado guardado — único punto de lectura del prototipo local
   *  (Store.loadLevelV1State) para que Home/Perfil compartan exactamente el mismo criterio de
   *  "¿existe un Nivel BRAMU V1 real para este usuario?". */
  function currentLevelV1State() {
    const user = Store.getCurrentUser();
    return user ? Store.loadLevelV1State(user.id) : null;
  }

  /** BRAMUlab_V04.7 — único criterio de "¿el onboarding obligatorio de Nivel BRAMU V1 sigue
   *  pendiente para este usuario?", reemplaza las 2 copias sueltas que existían (enter-btn de
   *  TU PERFIL ESTÁ LISTO y el bug de navegación del back-button). Detrás del mismo flag de
   *  siempre (Store.isLevelV1PreviewEnabled) y nunca para cuentas legacyMigrated (siguen con el
   *  Nivel simulado de V03, Consolidado §4: "no romper niveles de usuarios de prueba"). */
  function nivelOnboardingPending(user) {
    return !!(user && !user.legacyMigrated && Store.isLevelV1PreviewEnabled() && !Store.loadLevelV1State(user.id));
  }

  /** `user` con onboarding pendiente, o `null` — atajo para los guards que solo necesitan
   *  decidir si cortan el paso hacia el Home (openPlayerHome, único choke point real). */
  function nivelOnboardingPendingUser() {
    const user = Store.getCurrentUser();
    return nivelOnboardingPending(user) ? user : null;
  }

  /** Texto CALIBRANDO/CALIBRADO + progreso, reutilizado idéntico en Home y MI PERFIL — un
   *  solo lugar que decide esta redacción (Consolidado §"estado calibrando").
   *  BRAMUlab_V04.7 — el punto ámbar/lima flotante (`__dot`) se retira (revisión visual: "no
   *  ayuda"): el badge pasa a ser una píldora con fondo propio (ver `.level-v1-badge` en
   *  styles.css), el color de fondo ya comunica el estado sin necesitar un punto aparte. */
  function levelV1BadgeHTML(state) {
    const calibrated = state.state === LV.STATES.CALIBRATED;
    const label = calibrated ? 'NIVEL CALIBRADO' : `CALIBRANDO · ${state.ratedMatches} / ${LVC.PARAMS.CALIBRATION_MIN_MATCHES} PARTIDOS`;
    return `<span class="level-v1-badge${calibrated ? ' level-v1-badge--calibrated' : ''}">${label}</span>`;
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
    $('#change-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) { showView('profile'); return; }
      const current = $('#change-password-current').value;
      const next = $('#change-password-new').value;
      const repeat = $('#change-password-repeat').value;
      const strength = PLI.checkPasswordStrength(next);
      let error = null;
      // Backend Bloque 2 — para una cuenta real, `user.password` siempre es null (auth.js nunca
      // guarda la contraseña real, ver fetchOwnProfile): la comparación en texto plano de abajo
      // solo tiene sentido para el camino local sin backend. La verificación real de "contraseña
      // actual correcta" pasa por re-autenticar contra Supabase (más abajo).
      if (!user.serverBacked && (user.password || '') !== current) error = 'La contraseña actual no es correcta.';
      else if (!strength.ok) error = 'La nueva contraseña todavía no cumple los requisitos.';
      else if (!PLI.passwordsMatch(next, repeat)) error = 'Las contraseñas nuevas no coinciden.';
      if (error) { $('#change-password-error').textContent = error; $('#change-password-error').hidden = false; return; }

      if (!user.serverBacked) {
        Store.updateUserAccount(user.id, { password: next });
        Store.addNotification({
          userId: user.id, type: 'password_updated', category: 'info',
          title: 'Contraseña actualizada', body: 'Tu contraseña se cambió correctamente.',
        });
        renderNotificationsBadge();
        showView('profile');
        showToast('Contraseña actualizada');
        return;
      }

      const submitBtn = $('#change-password-form button[type="submit"]');
      submitBtn.disabled = true;
      // Re-autentica con la contraseña actual (única forma de confirmarla contra Supabase, que
      // no expone un endpoint de "verificar contraseña" aparte) antes de fijar la nueva.
      const reauth = await Auth.signInWithPassword(user.email, current);
      if (!reauth.ok) {
        submitBtn.disabled = false;
        $('#change-password-error').textContent = 'La contraseña actual no es correcta.';
        $('#change-password-error').hidden = false;
        return;
      }
      const result = await Auth.updatePassword(next);
      submitBtn.disabled = false;
      if (!result.ok) {
        $('#change-password-error').textContent = 'No pudimos actualizar la contraseña. Probá de nuevo.';
        $('#change-password-error').hidden = false;
        return;
      }
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
    // Backend Bloque 2 — best-effort: invalida la sesión real en Supabase (revoca el refresh
    // token) sin bloquear la salida local, que sigue siendo instantánea como siempre. Si falla
    // (sin red), la sesión del servidor igual expira sola; nunca deja a alguien "trabado" sin
    // poder cerrar sesión localmente por un problema de conexión.
    if (Auth.isConfigured()) Auth.signOut();
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

  /** BRAMUlab_V03.6 (cierre final, §4) — único punto que escribe el "Nivel BRAMU" grande de
   *  Home/MI PERFIL/Perfil público (mismas 3 clases compartidas, `.player-card__level-value`):
   *  bug real de desborde encontrado en QA — a 30px fijo, "CALIBRACIÓN COMPLETA" (21
   *  caracteres) desbordaba/comprimía la tarjeta, sobre todo en MI PERFIL/Perfil público, donde
   *  el bloque de Nivel tiene menos ancho disponible que en Home. `isText` agrega el modificador
   *  `--text` (tamaño reducido + wrap), reservado a los 2 estados de calibración; el Nivel
   *  numérico (siempre corto) sigue exactamente igual que antes. Solo tamaño/wrap — ninguna
   *  lógica de Nivel nueva. */
  function setLevelValueText(elId, text, isText) {
    const el = $(`#${elId}`);
    el.textContent = text;
    el.classList.toggle('player-card__level-value--text', !!isText);
  }

  function playerInitials(name) {
    const parts = (name || '').trim().split(' ').filter(Boolean);
    if (!parts.length) return '?';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /** Backend Bloque 6 (Fase B) — Experiencia_Inicial.md §9.1: superficie prioritaria cuando
   *  existe AL MENOS un pendiente accionable (isActionMine, server-backed, pending_validation).
   *  Un solo pendiente => copy puntual con el nombre de la pareja rival; más de uno => copy
   *  genérico que lleva a Historial (nunca elige arbitrariamente cuál mostrar). */
  function renderPlayerHomePendingBanner(displayMatches) {
    const banner = $('#player-home-pending-banner');
    const pending = (displayMatches || []).filter((m) => m.serverBacked && m.status === 'pending_validation' && m.isActionMine);
    if (!pending.length) { banner.hidden = true; banner.onclick = null; return; }
    banner.hidden = false;
    if (pending.length === 1) {
      const m = pending[0];
      const rivalTeam = m.myTeam === 'A' ? 'B' : 'A';
      const rivalNames = S.teamLabel(m.players, rivalTeam);
      $('#player-home-pending-banner-text').textContent = `${rivalNames || 'Tu rival'} registró un partido en el que participaste.`;
      $('#player-home-pending-banner-cta').textContent = 'REVISAR';
      banner.onclick = () => openCanonicalResumen(m, 'player-home');
    } else {
      $('#player-home-pending-banner-text').textContent = `Tenés ${pending.length} partidos esperando tu confirmación.`;
      $('#player-home-pending-banner-cta').textContent = 'VER PENDIENTES';
      banner.onclick = () => openHistoryScreen('player-home');
    }
  }

  function renderPlayerHome() {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderNotificationsBadge();
    // Backend Bloque 6 (Fase B) — refresco best-effort en segundo plano: el badge/banner ya
    // pintados con el cache anterior se actualizan solos apenas llega la respuesta, sin
    // bloquear el resto del render del Home.
    refreshB6Notifications().then(renderNotificationsBadge);
    // Backend Bloque 5 (09_Resultado_Wiring_Frontend_Claude.md, §5/§6) — Home separa dos
    // fuentes: `matches` (SOLO computable, para Nivel/Efectividad/Actividad/Hitos/Tu momento —
    // ningún partido pendiente puede alterar una métrica oficial) y `displayMatches` (incluye
    // server-backed pending/sync_pending/expired), reservada EXCLUSIVAMENTE para "Último
    // partido": Experiencia_Inicial.md §22.B exige que esa tarjeta muestre el partido pendiente
    // aunque "0 estadísticas oficiales" se deriven de él.
    const history = getComputableHistory();
    const matches = PH.filterMatchesForPlayer(history, currentIdentity());
    const displayHistory = getDisplayHistory();
    const displayMatches = PH.filterMatchesForPlayer(displayHistory, currentIdentity());
    // V02.8 (§1) — se anima en CADA render (cada entrada/vuelta real al Home, ver comentario
    // en la declaración de `currentPlayerName` de más arriba), salvo `prefers-reduced-motion`.
    // Se sigue chequeando en JS (no solo vía el colapso de `--home-anim-*` a 1ms en CSS) porque
    // el stagger de Actividad usa `transition-delay` inline por barra — un valor que no depende
    // de ningún token CSS y igual introduciría un desfasaje perceptible entre barras si no se
    // corta acá directamente.
    const prefersReducedMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    const shouldAnimate = !prefersReducedMotion;

    renderPlayerHomePendingBanner(displayMatches);
    renderPlayerHitos(matches);
    renderPlayerCard(matches, shouldAnimate);
    renderPlayerLastMatchCard(displayMatches, matches);
    // BRAMUlab_V03.8 (Ranking_BRAMU.md §13.6) — insight de Ranking (siempre ámbito Local, nunca
    // Nivel actual en vivo) como candidato más para TU MOMENTO, nunca una tarjeta territorial
    // completa nueva en Home. `null` cuando no hay cuenta/no es elegible/sin género/densidad
    // insuficiente — buildTuMomentoText ya sabe ignorarlo en ese caso.
    // Backend Bloque 7 (Fase 5) — cuenta serverBacked: pinta TU MOMENTO SIN el insight primero
    // (nunca bloquear el resto del Home por una RPC, handoff §10 — mismo criterio que
    // refreshB6Notifications arriba) y lo actualiza solo cuando get_home_ranking_insight
    // resuelve. `territory` no viaja en esa RPC (siempre ámbito Local del propio caller): se
    // usa la localidad ya cacheada de la cuenta, no un dato nuevo.
    const homeUser = Store.getCurrentUser();
    if (Auth.isConfigured() && homeUser && homeUser.serverBacked) {
      $('#player-home-momento-text').textContent = PH.buildTuMomentoText(matches, currentIdentity(), null);
      RK.getHomeRankingInsight().then((result) => {
        // Backend Bloque 8 (Fase E, Revisión Central E02): "no marcar como visto si la RPC
        // falla" — con `!result.ok` no hay insight ni milestone que evaluar, así que ya no hay
        // nada que marcar; el `return` temprano ya cumple ese requisito por construcción.
        if (!result.ok || !result.data || !result.data.hasPosition) return;
        const pos = result.data;
        const insight = {
          position: pos.position, total: pos.total, territory: homeUser.locality || '',
          isNew: !!(pos.movement && pos.movement.status === 'nuevo'),
          delta: pos.movement ? pos.movement.delta : null,
          // Backend Bloque 8 (Fase E) — todos estos campos solo existen una vez aplicada la
          // migración que los agrega a get_my_ranking_position (ver supabase/migrations/
          // 20260923190000_...); hasta entonces llegan `undefined` y
          // RK.classifyHomeRankingMilestone simplemente nunca dispara los hitos que dependen de
          // ellos ("primera entrada"/"nueva mejor posición"/"cambio de banda") — nunca se
          // inventa un valor.
          bestPositionBefore: pos.bestPositionBefore,
          // `pos.levelBand` es el ECO del filtro `p_level_band` que Home nunca pide (siempre
          // `null`) — la banda PROPIA del jugador viaja en `ownLevelBand` (Revisión Central Fase
          // E, E04/E08: se evita a propósito la ambigüedad de reusar el mismo nombre para dos
          // cosas distintas).
          levelPublic: pos.levelPublic, levelBand: pos.ownLevelBand,
          previousLevelPublic: pos.previousLevelPublic, previousLevelBand: pos.previousLevelBand,
          // Revisión Central Fase E, E02 — identidad del hito para la memoria de "ya mostrado"
          // (nunca se guarda posición/nivel como verdad deportiva, solo estos identificadores).
          editionId: pos.edition ? pos.edition.editionId : null,
          scopeType: pos.scopeType || 'local', scopeKey: pos.scopeKey || null,
        };
        // BRAMU_Intelligence.md §13.3 — un movimiento semanal (o un cambio de banda de Nivel)
        // solo es HITO dentro de TU MOMENTO si es material y verificable. Sin hito, el texto
        // conserva lo que ya pintó `buildTuMomentoText` más arriba (forma reciente/compañero/
        // actividad) — nunca se fuerza un mensaje de Ranking solo para llenar espacio.
        const milestone = RK.classifyHomeRankingMilestone(insight);
        if (!milestone) return;
        // E02 — el mismo hito (usuario + edición + scope + tipo) se muestra una sola vez: se
        // marca como visto SOLO después de pintarlo realmente, nunca antes.
        const milestoneKey = RK.buildRankingMilestoneKey(milestone);
        if (Store.hasSeenRankingMilestone(homeUser.id, milestoneKey)) return;
        insight.milestoneType = milestone.type;
        // Revisión Final Fase E, E07 — `buildTuMomentoText` tiene retornos tempranos (0/1/2
        // partidos) que ignoran el insight de Ranking: si el texto con el hito es idéntico al
        // texto sin él, el hito NO llegó a pintarse realmente, así que tampoco corresponde
        // marcarlo como visto (contradiría E02: "visto solo después de pintarlo realmente").
        const baseText = PH.buildTuMomentoText(matches, currentIdentity(), null);
        const textWithInsight = PH.buildTuMomentoText(matches, currentIdentity(), insight);
        if (textWithInsight === baseText) return;
        $('#player-home-momento-text').textContent = textWithInsight;
        Store.markRankingMilestoneSeen(homeUser.id, milestoneKey);
      });
    } else {
      const rankingInsight = RK.computeHomeRankingInsight(homeUser, history, new Date());
      $('#player-home-momento-text').textContent = PH.buildTuMomentoText(matches, currentIdentity(), rankingInsight);
    }
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
    // Backend Bloque 4 — una cuenta real/server-backed ya tiene un @usuario canónico.
    // Home todavía usaba el helper legacy buildPlayerHandle(nombre), pensado antes del sistema
    // de cuentas reales, y por eso podía mostrar @sebastian mientras Mi Perfil/Mis Datos
    // mostraban correctamente @sebas. Para cuentas con username se usa la misma fuente
    // autoritativa que Perfil; el fallback derivado se conserva SOLO para identidades
    // local/legacy sin username real.
    const homeUser = Store.getCurrentUser();
    $('#player-home-handle').textContent = homeUser && homeUser.username
      ? `@${homeUser.username}`
      : buildPlayerHandle(currentPlayerName);
    // V03.0.1 (§3) — bug: la foto ya persistía en Perfil/Editar Datos pero el Home seguía
    // mostrando siempre el ícono genérico porque `renderPlayerCard` nunca leía `profilePhoto`.
    // Misma fuente que el resto de la app (Store.getCurrentUser()), sin segunda fuente ni
    // almacenamiento nuevo.
    // V03.0.3 (§1) — fix definitivo: un solo atributo (`data-has-photo`) en el contenedor
    // decide en CSS qué capa se pinta (ver styles.css) — nunca dos `hidden` independientes
    // que puedan quedar desincronizados entre sí (la causa real del bug reportado tras
    // V03.0.2: dos escrituras separadas, sin ninguna garantía de quedar siempre en sync).
    const homeAvatarImg = $('#player-home-avatar-img');
    const hasPhoto = !!(homeUser && homeUser.profilePhoto);
    $('#player-home-avatar').dataset.hasPhoto = String(hasPhoto);
    if (hasPhoto) homeAvatarImg.src = homeUser.profilePhoto;
    else homeAvatarImg.removeAttribute('src');
    const n = matches.length;
    $('#player-home-match-count').textContent = n === 1 ? '1 partido en tu historia' : `${n} partidos en tu historia`;
    // `matches` ya viene filtrado a los propios del jugador (PH.filterMatchesForPlayer) — es
    // exactamente la misma noción de "mine" que usa la evolución (§4.2: nunca un Observado).
    const levelSubEl = $('#player-home-level-sub');
    const barWrapEl = $('#player-home-level-bar-wrap');
    // BRAMUlab_V04.9 (§11) — default seguro: solo el branch V1 CALIBRANDO de abajo la muestra,
    // así ningún otro estado (legacy/simulado, o un V1 recién reseteado desde el modo
    // laboratorio) puede dejarla visible por accidente de un render anterior.
    $('#player-home-calibration').hidden = true;
    // BRAMUlab_V04.4 (Etapa D, bloque 1) — si existe un Nivel BRAMU V1 real confirmado para
    // este usuario, REEMPLAZA al simulado/provisional de V03 en esta tarjeta (Consolidado §7:
    // nunca conviven dos verdades a la vez). A diferencia del simulado, V1 SÍ muestra un
    // número aunque siga CALIBRANDO — la estimación inicial ya es un dato real, no un
    // placeholder (Nivel_BRAMU.md §4.2). Sin evolución por partidos reales todavía (próximo
    // bloque de Etapa D): la barra de progreso de nivel queda oculta.
    const levelV1 = currentLevelV1State();
    if (levelV1) {
      barWrapEl.hidden = true;
      setLevelValueText('player-home-level-value', LV.roundPublicLevel(levelV1.mu).toFixed(1), false);
      // BRAMUlab_V04.9 (§10/§11) — CALIBRADO conserva la píldora chica de siempre en la columna
      // angosta (`.player-card__level-sub`, referencia buena de V04.8, nunca se toca);
      // CALIBRANDO pasa a la fila completa de abajo (`.player-card__calibration`) en vez de esa
      // píldora, que ahí se sentía grande y alteraba la composición (revisión visual).
      const calibrated = levelV1.state === LV.STATES.CALIBRATED;
      const calibEl = $('#player-home-calibration');
      if (calibrated) {
        levelSubEl.hidden = false;
        levelSubEl.innerHTML = levelV1BadgeHTML(levelV1);
        calibEl.hidden = true;
      } else {
        levelSubEl.hidden = true;
        levelSubEl.innerHTML = '';
        calibEl.hidden = false;
        $('#player-home-calibration-label').textContent = `CALIBRANDO · ${levelV1.ratedMatches} / ${LVC.PARAMS.CALIBRATION_MIN_MATCHES} PARTIDOS`;
        const calibPct = Math.min(100, (levelV1.ratedMatches / LVC.PARAMS.CALIBRATION_MIN_MATCHES) * 100);
        $('#player-home-calibration-bar-fill').style.width = calibPct + '%';
      }
      return;
    }
    const evolution = PH.computeLevelEvolution(matches, currentIdentity());
    if (!isLegacyLevelAccount()) {
      const calib = PH.buildCalibrationStatus(evolution.consideredCount);
      setLevelValueText('player-home-level-value', calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO', true);
      levelSubEl.hidden = calib.complete;
      levelSubEl.textContent = calib.complete ? '' : calib.progressText;
      barWrapEl.hidden = true;
      return;
    }
    barWrapEl.hidden = false;
    levelSubEl.hidden = true;
    setLevelValueText('player-home-level-value', evolution.current.toFixed(1), false);
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
  function renderPlayerLastMatchCard(matches, computableMatches) {
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
    // La tarjeta puede mostrar un partido pendiente, pero la forma reciente es una métrica:
    // se calcula SOLO con el historial computable. Un pending/sync_pending/expired no puede
    // agregar una victoria/derrota ni alterar la racha visual antes de validarse.
    // El glow "current" se usa únicamente si el partido que ocupa la tarjeta también es el
    // último partido computable; si la tarjeta muestra un pendiente, los dots quedan como
    // contexto histórico y ninguno se presenta falsamente como el partido actual.
    const formSource = Array.isArray(computableMatches) ? computableMatches : matches;
    const formOldestFirst = PH.computeRecentForm(formSource, currentIdentity(), 5).slice().reverse();
    const currentIsComputable = formSource.some((fm) => fm && fm.matchId === m.matchId);
    const formDotsHtml = formOldestFirst.map((f, i) => {
      const isCurrent = currentIsComputable && i === formOldestFirst.length - 1;
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
          ${serverMatchStatusLabel(m) ? `<span class="player-home-lastmatch__badge player-home-lastmatch__badge--status">${serverMatchStatusLabel(m)}</span>` : ''}
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
    const card = $('#player-home-activity-card');
    // Pre-Production P0.1 (Experiencia_Inicial.md §3.3) — Estado Cero (0 partidos oficiales)
    // oculta la tarjeta ENTERA, nunca un estado vacío tipo "Sin partidos en las últimas 4
    // semanas": esa leyenda sigue existiendo para el caso real de un jugador con historial
    // pero sin actividad reciente (matches.length>0), no para un jugador sin ningún partido.
    if (!matches.length) { card.hidden = true; return; }
    card.hidden = false;
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
    const card = $('#player-home-effectiveness-card');
    // Pre-Production P0.1 — Estado Cero oculta la tarjeta entera en vez de mostrar el donut
    // apagado + "Sin partidos considerados" (Experiencia_Inicial.md §3.3).
    if (!matches.length) { card.hidden = true; return; }
    card.hidden = false;
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
    const streakCard = $('#widget-streak-card');
    const totalCard = $('#widget-total-card');
    const partnerCard = $('#widget-partner-card');
    const rivalCard = $('#widget-rival-card');

    // Pre-Production P0.1 (Experiencia_Inicial.md §5.2/§5.4) — Racha + Partidos totales son
    // pareja visual: 0 partidos oficiales oculta las DOS tarjetas (nunca "Sin racha en curso"
    // sin ningún historial); desde el primer partido válido ambas aparecen juntas, incluida la
    // racha en estado neutro "—" cuando corresponda (eso sí es un dato real, no un placeholder).
    const showRachaTotal = matches.length > 0;
    streakCard.hidden = !showRachaTotal;
    totalCard.hidden = !showRachaTotal;
    if (showRachaTotal) {
      const streak = PH.computeCurrentStreak(matches, currentIdentity());
      const total = matches.length;
      $('#widget-streak-value').textContent = streak.count > 0 ? String(streak.count) : '—';
      $('#widget-streak-caption').textContent = streak.count > 0 ? (streak.count === 1 ? 'victoria seguida' : 'victorias seguidas') : 'Sin racha en curso';
      $('#widget-total-value').textContent = String(total);
      $('#widget-total-caption').textContent = total === 1 ? 'partido registrado' : 'partidos registrados';
    }

    // §5.3/§5.4 — Mejor compañero + Rival más enfrentado son pareja visual y solo aparecen
    // cuando AMBAS tarjetas producen un resultado legítimo según su propia regla (muestra
    // mínima, etc.): nunca una tarjeta huérfana ni "Sin datos suficientes" como placeholder.
    const partner = matches.length ? PH.computeBestPartner(matches, currentIdentity()) : null;
    const rival = matches.length ? PH.computeMostFrequentRival(matches, currentIdentity()) : null;
    const showPartnerRival = !!partner && !!rival;
    partnerCard.hidden = !showPartnerRival;
    rivalCard.hidden = !showPartnerRival;
    if (showPartnerRival) {
      $('#widget-partner-value').textContent = partner.name;
      $('#widget-partner-caption').textContent = `${partner.pct}% · ${partner.count} ${partner.count === 1 ? 'partido' : 'partidos'}`;
      $('#widget-rival-value').textContent = rival.name;
      $('#widget-rival-caption').textContent = `${rival.count} ${rival.count === 1 ? 'enfrentamiento' : 'enfrentamientos'}`;
    }
  }

  /** §7 — toda la tarjeta de "Último partido" es tocable: un solo listener delegado (no uno
   *  nuevo por render) que decide el destino según haya o no partidos — abre Resumen/Detalle
   *  (Análisis) con el partido más reciente, o el mismo flujo del botón central "+" en el
   *  estado vacío. Relee el historial en el momento del click (no un `m` capturado en el
   *  render) para no quedar con una referencia vieja si el Home no se re-renderizó desde el
   *  último cambio. */
  function initPlayerHomeLastMatchCard() {
    $('#player-home-last-match-card').addEventListener('click', () => {
      const matches = PH.filterMatchesForPlayer(getDisplayHistory(), currentIdentity());
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
      const matches = PH.filterMatchesForPlayer(getComputableHistory(), currentIdentity());
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
    initPlayerHomeLastMatchCard();
    initPlayerHomeMetricsNav();
    // Backend Bloque 6 (Fase B) — el onclick real se reasigna en cada render (depende de
    // cuántos pendientes haya, ver renderPlayerHomePendingBanner); acá solo se cablea el
    // teclado UNA vez, delegando al onclick vigente en el momento de la tecla.
    const pendingBanner = $('#player-home-pending-banner');
    pendingBanner.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (pendingBanner.onclick) pendingBanner.onclick(); }
    });
    $('#player-home-bell-btn').addEventListener('click', openNotificationsScreen);
    // BRAMUlab_V03.5 (§4, Bloque 1) — acceso a RANKING BRAMU desde el header del Home.
    $('#player-home-ranking-btn').addEventListener('click', openRankingScreen);
    // BRAMUlab_V04.5 — acceso directo mouse/touch al preview de Nivel BRAMU V1, ya no depende
    // del long-press sobre el logo (se conserva, pero deja de ser necesario).
    // BRAMUlab_V04.7 — con el preview YA activado, un toque abre HERRAMIENTAS (mismo modal que
    // el long-press, con "Resetear Nivel BRAMU" adentro) en vez de apagarlo directo: antes
    // "Resetear Nivel BRAMU" solo era alcanzable manteniendo presionado el logo ~2s (Handoff
    // V04.6 §10 solo había resuelto "Crear usuario de prueba"). Con el preview apagado, un toque
    // lo prende igual que antes (con su toast de siempre).
    $('#player-home-lab-preview-btn').addEventListener('click', () => {
      if (!Store.isLevelV1PreviewEnabled()) {
        setLevelV1Preview(true);
        showToast('Nivel BRAMU V1 preview: ACTIVADO', 2200);
        return;
      }
      refreshLabPreviewUI();
      $('#dev-tools-modal').hidden = false;
    });
    // V03.0.1 (§3) — tarjeta/nombre/foto del Home tappable → Perfil › MI PERFIL.
    const goToProfile = () => openProfileScreen('mi-perfil');
    $('#player-home-card').addEventListener('click', goToProfile);
    $('#player-home-card').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToProfile(); } });
    // BRAMUlab_V03.3 (§4) — "BUSCAR JUGADORES", al final del contenido principal del Home.
    $('#player-home-search-players-card').addEventListener('click', openPlayerSearchScreen);
  }

  /** V03.0.2 (§12) — Notificaciones: pantalla completa (reemplaza el popup "todavía no hay
   *  notificaciones" de Etapa 2). Modelo local por `userId` (Store.loadNotifications), nunca
   *  por nombre visible. Agrupación cronológica descendente: Hoy / Esta semana / Anteriores.
   *  Backend Bloque 6 (Fase B) — para una cuenta server-backed, se MEZCLA con `get_notifications`
   *  (tareas accionables derivadas + informativas persistidas, ver match-validation.js): la
   *  bandeja local sigue existiendo tal cual para eventos puramente de cuenta (acceso completado,
   *  contraseña cambiada) que nunca pasan por el servidor. */
  const NOTIF_CATEGORY_LABEL = { positive: 'Positivo', info: 'Informativo', pending: 'Pendiente', error: 'Error' };

  // Cache de get_notifications — se refresca en los puntos de entrada reales (Home, abrir la
  // bandeja, tras cualquier acción B6) y alimenta tanto el badge (síncrono) como la lista.
  let b6NotificationsCache = [];

  async function refreshB6Notifications() {
    if (!isServerBackedSession() || !MV) { b6NotificationsCache = []; return; }
    const result = await MV.getNotifications({ limit: 100 });
    if (result.ok) b6NotificationsCache = result.notifications;
  }

  const B6_NOTIF_COPY = {
    pending_review: { title: 'Partido pendiente', body: 'Tenés un partido esperando tu confirmación.', category: 'pending' },
    correction_proposed: { title: 'Corrección propuesta', body: 'Te proponen una corrección de resultado.', category: 'pending' },
    identity_questioned: { title: 'Identidad cuestionada', body: 'Hay una identidad cuestionada en uno de tus partidos.', category: 'pending' },
    match_validated: { title: 'Partido oficial', body: 'Tu partido ya quedó validado.', category: 'positive' },
    correction_accepted: { title: 'Corrección aceptada', body: 'Se aceptó una corrección de resultado.', category: 'info' },
    identity_resolved: { title: 'Identidad resuelta', body: 'Se resolvió una identidad cuestionada.', category: 'info' },
    identity_unidentified: { title: 'Jugador no identificado', body: 'Un lugar quedó como Jugador no identificado — el resultado se conserva.', category: 'info' },
    match_expired: { title: 'Partido vencido', body: 'Un partido venció sin validarse a tiempo.', category: 'error' },
    admin_action: { title: 'Acción administrativa', body: 'Un administrador realizó una acción sobre un partido tuyo.', category: 'info' },
  };
  /** Notificación server-backed (get_notifications) -> MISMA forma que un item local
   *  (Store.loadNotifications), para que renderNotificationsList/badge no necesiten dos
   *  caminos de render distintos. `source`/`type` extra: el click handler los usa para saber
   *  qué RPC llamar al marcar como leída (nunca la del otro origen). */
  function mapB6Notification(n) {
    const copy = B6_NOTIF_COPY[n.type] || { title: 'Notificación', body: '', category: 'info' };
    return {
      id: n.id, title: copy.title, body: copy.body, category: copy.category,
      createdAt: n.createdAt, readAt: n.readAt, matchId: n.matchId,
      source: 'server', type: n.type,
    };
  }

  function renderNotificationsBadge() {
    const user = Store.getCurrentUser();
    const localCount = user ? Store.countUnreadNotifications(user.id) : 0;
    const serverCount = b6NotificationsCache.filter((n) => !n.readAt).length;
    const count = localCount + serverCount;
    const badge = $('#player-home-bell-badge');
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
    const localList = user ? Store.loadNotifications(user.id) : [];
    // Bloque 6 — se derivan/traducen y se mezclan por fecha real, más reciente primero, sin
    // importar el origen (local vs. servidor son invisibles para quien lee la bandeja).
    const serverList = b6NotificationsCache.map(mapB6Notification);
    const list = localList.concat(serverList).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
          <button type="button" class="notif-item notif-item--${n.category} ${n.readAt ? '' : 'is-unread'}" data-id="${escapeHtml(n.id)}" data-source="${n.source || 'local'}" data-match-id="${n.matchId ? escapeHtml(n.matchId) : ''}">
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

  async function openNotificationsScreen() {
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderNotificationsList();
    showView('notifications');
    await refreshB6Notifications();
    // El usuario pudo haber navegado a otra pantalla mientras se esperaba la respuesta.
    if (!$('#view-notifications').hidden) { renderNotificationsList(); renderNotificationsBadge(); }
  }

  /** Re-pinta la bandeja YA ABIERTA con datos frescos — usada por afterB6Action (una acción B6
   *  puede resolver/crear una tarea mientras el usuario tiene la bandeja abierta). */
  async function renderNotificationsScreenServerBacked() {
    await refreshB6Notifications();
    renderNotificationsList();
    renderNotificationsBadge();
  }

  /** Abre el Resumen de un partido por id (click en una notificación ligada a `matchId`) — SIEMPRE
   *  relee get_match_detail, nunca asume un snapshot viejo. */
  async function openMatchById(matchId) {
    if (!matchId || !Matches) return;
    const result = await Matches.getMatchDetail(matchId);
    if (result.ok && result.match) openCanonicalResumen(MSync.translateServerMatchToLocalShape(result.match), 'player-home');
  }

  function initNotificationsScreen() {
    $('#notifications-back-btn').addEventListener('click', () => openPlayerHome());
    $('#notifications-mark-all-btn').addEventListener('click', async () => {
      const user = Store.getCurrentUser();
      if (user) Store.markAllNotificationsRead(user.id);
      // Bloque 6 — solo afecta las notificaciones PERSISTIDAS informativas (nunca las tareas
      // sintéticas: no tienen una fila real que marcar, get_notifications las sigue mostrando
      // hasta que el estado real se resuelva).
      if (isServerBackedSession() && MV) await MV.markAllNotificationsRead();
      await renderNotificationsScreenServerBacked();
    });
    $('#notifications-list').addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-item');
      if (!item) return;
      const id = item.dataset.id;
      const source = item.dataset.source;
      const matchId = item.dataset.matchId || null;
      if (source === 'server') {
        if (MV) await MV.markNotificationRead(id); // no-op silencioso para una tarea sintética
        const cached = b6NotificationsCache.find((n) => n.id === id);
        if (cached) cached.readAt = cached.readAt || new Date().toISOString();
        item.classList.remove('is-unread');
        renderNotificationsBadge();
        if (matchId) { await openMatchById(matchId); return; }
        return;
      }
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
  // BRAMUlab_V03.5.1 (§3) — orden Local/Provincial/País/Global/Mi red, Local por defecto (era
  // "Mis jugadores" primero) — §3.2 renombra "Mis jugadores" a "Mi red" (clave interna
  // 'mi-red', antes 'mis-jugadores': se renombra también acá para que el código no quede
  // desalineado del producto).
  const RANKING_SCOPE_TABS = [
    { key: 'local', label: 'Local' },
    { key: 'provincial', label: 'Provincial' },
    { key: 'pais', label: 'País' },
    { key: 'global', label: 'Global' },
    { key: 'mi-red', label: 'Mi red' },
  ];
  const RANKING_GENDER_LABELS = { masculino: 'Masculino', femenino: 'Femenino' };
  // Mismo criterio que historyOwnershipFilter (Historial): ámbito/género/banda viven en
  // memoria durante la sesión, sin resetear en cada apertura de la pantalla.
  let rankingScopeFilter = 'local';
  let rankingGenderFilter = 'masculino'; // se resuelve real la primera vez, ver rankingGenderInitialized
  let rankingGenderInitialized = false;
  let rankingBandFilter = null; // null = "Todos los niveles" (§5 — filtro, ya no un modo paralelo)
  // Paginación/búsqueda, en cambio, SÍ arrancan de cero cada vez que se abre la pantalla o se
  // cambia de ámbito/género/banda (§12: entrar a una vista nueva siempre empieza por el bloque 1).
  let rankingLoadedBlocks = 1;
  let rankingSearchQuery = '';
  let rankingSearchOpen = false;
  // Backend Bloque 7 (Fase 5) — `computeRankingView()` es async (RPCs reales); estos dos
  // cubren carreras entre renders superpuestos (cambiar de filtro/ámbito antes de que la
  // respuesta anterior vuelva — mismo criterio que renderPlayerSearchResultsServerBacked) y el
  // debounce de búsqueda server-backed (evitar una llamada por tecla, §10 del handoff).
  let rankingRequestToken = 0;
  let rankingSearchDebounceTimer = null;
  // Último `view` pintado — únicamente para que "Ocultos (N)" (Mi red server-backed) pueda leer
  // `hiddenRows` sin una llamada de red aparte (get_ranking_network no tiene un RPC propio de
  // "solo los ocultos"); nunca se usa como fuente de autoridad para volver a pintar la pantalla.
  let rankingLastView = null;

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

  /** §4 — género EFECTIVO para Ranking: el declarado en la cuenta si es masculino/femenino: si
   *  no lo declaró (u otro/prefiere no decir), cae a 'masculino' como default técnico neutro —
   *  nunca deja a self sin poder verse a sí mismo por falta de un dato opcional. */
  function rankingEffectiveGender(user) {
    const g = user && user.gender;
    return (g === 'masculino' || g === 'femenino') ? g : 'masculino';
  }

  function renderRankingGenderTrigger() {
    $('#ranking-gender-trigger').textContent = `${RANKING_GENDER_LABELS[rankingGenderFilter]} ▾`;
  }

  /** §4.2 — desplegable compacto reutilizando el picker sheet de Perfil (openProfilePickerSheet
   *  ya acepta un config crudo además de una key de PROFILE_PICKER_FIELDS, ver ahí). */
  function rankingGenderPickerConfig() {
    return {
      title: 'GÉNERO DEL RANKING',
      labels: RANKING_GENDER_LABELS,
      get: () => rankingGenderFilter,
      set: (v) => { rankingGenderFilter = v; },
      onSelect: () => { renderRankingGenderTrigger(); onRankingFilterChanged(); },
    };
  }

  /** BRAMUlab_V03.5.2 (§5) — "filtros/bandas dependientes de Ranking" deben usar el Nivel DEL
   *  CORTE semanal vigente, nunca el Nivel actual — así "Mi nivel · Nivel X" siempre nombra la
   *  misma banda en la que el usuario realmente aparece clasificado esta semana. */
  function rankingSelfBand() {
    const period = RK.computeRankingWeekPeriod(new Date());
    const snapshotHistory = RK.historySnapshotAsOf(getComputableHistory(), period.start);
    // currentIdentity() — nunca el nombre plano: ver el comentario de buildRankingEntries en
    // ranking.js sobre por qué un partido con userId estampado es invisible por nombre solo.
    const level = PH.computeSimulatedJugadorLevel(snapshotHistory, currentIdentity());
    return RK.bandForLevel(level);
  }

  function renderRankingBandTrigger() {
    $('#ranking-band-trigger').textContent = rankingBandFilter == null ? 'Todos los niveles ▾' : `Nivel ${rankingBandFilter} ▾`;
  }

  /** §5.1 — "Todos los niveles" (default) + "Mi nivel · Nivel X" (atajo, se resuelve a un
   *  número concreto al tocarlo — nunca queda como un estado dinámico "mi nivel" en curso) +
   *  Nivel 1-10. Misma lógica de bandas ya existente (RK.bandFilter), nunca una nueva. */
  function rankingBandPickerConfig() {
    const selfBand = rankingSelfBand();
    const labels = { todos: 'Todos los niveles', mi_nivel: `Mi nivel · Nivel ${selfBand}` };
    for (let n = 1; n <= 10; n++) labels['n' + n] = `Nivel ${n}`;
    return {
      title: 'NIVEL',
      labels,
      get: () => (rankingBandFilter == null ? 'todos' : 'n' + rankingBandFilter),
      set: (v) => {
        if (v === 'todos') rankingBandFilter = null;
        else if (v === 'mi_nivel') rankingBandFilter = selfBand;
        else rankingBandFilter = Number(v.slice(1));
      },
      onSelect: () => { renderRankingBandTrigger(); onRankingFilterChanged(); },
    };
  }

  /** Bloque 3 — arma un participante SIN puesto (compañero de Mi red calibrando o inactivo,
   *  §10.2): nunca pasa por RK.rankEntries (no tiene sentido ordenar algo sin posición). El
   *  Nivel mostrado es real (PH.computeSimulatedJugadorLevel) salvo en 'sin-nivel', donde no
   *  existe todavía — mostrar cualquier número ahí sería inventarlo. `nowDate` — corrección de
   *  cierre de V03.5.2: mismo corte que el resto de la edición vigente (`period.start`), nunca
   *  "ahora" en vivo. */
  function buildUnrankedParticipant(name, history, nowDate) {
    const status = RK.computeParticipantStatus(name, history, nowDate);
    // BRAMUlab_V03.6 (hotfix — bug real §1) — mismo contrato de identidad que buildRankingEntries
    // (ranking.js): un compañero de Mi red con cuenta real vinculada nunca debe caer al Nivel
    // simulado por hash — se resuelve su userId antes de calcular, nunca se cambia SI se
    // muestra un nivel acá (esa decisión, `status.key === 'sin-nivel'`, queda intacta).
    const account = buildGroupRowAccount(name);
    const identity = account ? { name, userId: account.id } : name;
    const level = status.key === 'sin-nivel' ? null : PH.computeSimulatedJugadorLevel(history, identity);
    return { name, status, level };
  }

  /* ====================================================================
     BACKEND BLOQUE 7 (Fase 5) — RANKING BRAMU REAL, SERVER-BACKED
     computeRankingView() (más abajo) es el único punto que decide entre esta variante y la
     local/mock (computeRankingViewLocal, renombrada de la función histórica sin tocar su
     cuerpo) — mismo criterio que playerPublicPlayerId && Auth.isConfigured() en
     renderPlayerPublicProfile: con backend real configurado Y una cuenta serverBacked, Ranking
     NUNCA cae a datos simulados (handoff Fase 5 §9); sin backend configurado (desarrollo local
     sin Supabase), computeRankingViewLocal sigue funcionando exactamente igual que siempre.
     El navegador nunca recalcula posición/empate/denominador/densidad/movimiento acá — todo
     sale tal cual de las RPCs de Fase 3 (RK.getRankingClassification/getMyRankingPosition/
     getRankingNetwork); esta capa solo TRADUCE esas respuestas al mismo shape de `view` que ya
     consumen renderRankingStateCard/renderRankingMyPosition/renderRankingClassification/
     renderRankingUnrankedSections/renderRankingHiddenButton, para no duplicar ni tocar esas
     funciones de render. ====================================================================== */

  /** Traduce `reasonCodes`/`isEligible`/`levelStatus` de get_my_ranking_position al mismo
   *  vocabulario de `status.key` que ya usa selfStatusCopy/RANKING_NON_BLOCKING_SELF_KEYS
   *  (local). `competitive_branch_missing`/`ranking_opt_in_false`/`location_missing` no
   *  deberían llegar hasta acá en la práctica — el gate de openRankingScreen ya los resuelve
   *  ANTES de entrar a la pantalla — pero se cubren igual por si los datos cambian entre el
   *  chequeo del gate y esta llamada (p. ej. otra pestaña). Sin `calib.progressText` numérico
   *  (la RPC no expone partidos/rivales distintos, solo `reasonCodes`): el texto de calibrando
   *  queda genérico acá, nunca un número inventado. */
  function buildServerSelfStatus(pos) {
    if (pos.isEligible) return { key: 'elegible' };
    const codes = pos.reasonCodes || [];
    if (codes.includes('account_inactive') || codes.includes('account_excluded')) return { key: 'perfil-privado' };
    if (codes.includes('location_missing')) return { key: 'sin-ubicacion' };
    if (codes.includes('inactive_180_days')) return { key: 'inactivo' };
    if (codes.includes('level_not_calibrated') || codes.includes('recalibrating_without_consolidated')) {
      return { key: 'calibrando', calib: { progressText: 'Todavía estás calibrando tu Nivel BRAMU.' } };
    }
    if (codes.includes('no_computable_activity') || !pos.levelPublic) {
      return { key: 'sin-nivel', calib: { progressText: '' } };
    }
    // competitive_branch_missing/ranking_opt_in_false u otro motivo no mapeado explícitamente:
    // nunca se inventa "elegible" — se trata como calibrando genérico (bloquea Tu posición,
    // nunca la clasificación de terceros debajo).
    return { key: 'calibrando', calib: { progressText: '' } };
  }

  /** Ámbitos territoriales (Local/Provincial/País/Global) server-backed. `get_ranking_classification`
   *  ya resuelve `scope_key` server-side (nunca un parámetro propio, handoff Fase 3 §4) y ya
   *  pagina/busca — este wrapper solo pide `rankingLoadedBlocks * BLOCK_SIZE` filas desde el
   *  principio (mismo criterio que RK.paginate local: recortar de 0 en cada render, nunca
   *  acumular estado de paginación aparte) o, con búsqueda activa, hasta el máximo que la RPC
   *  acepta (100) — igual que el buscador local, que nunca pagina resultados de búsqueda. */
  async function computeRankingViewServerBacked(user) {
    const scope = rankingScopeFilter;
    const isTerritorial = scope !== 'mi-red';
    const branch = rankingGenderFilter === 'femenino' ? 'F' : 'M';

    if (!isTerritorial) return computeRankingNetworkViewServerBacked(branch);

    const searchTerm = rankingSearchQuery || null;
    const limit = searchTerm ? 100 : rankingLoadedBlocks * RK.BLOCK_SIZE;
    const [classResult, posResult] = await Promise.all([
      RK.getRankingClassification(scope, branch, rankingBandFilter, searchTerm, limit, 0),
      RK.getMyRankingPosition(scope, rankingBandFilter),
    ]);
    if (!classResult.ok || !posResult.ok) {
      return { scope, isTerritorial, serverError: true, period: null, periodLabel: '' };
    }
    const cls = classResult.data;
    const pos = posResult.data;

    // Global bloqueado es DINÁMICO server-side (diversidad real de país), nunca la constante
    // fija RK.GLOBAL_UNLOCKED del prototipo local — corta ACÁ, antes de armar ningún estado
    // propio, mismo lugar que la rama local.
    if (scope === 'global' && cls.densityStatus === 'locked') {
      return { scope, isTerritorial, globalBlocked: true };
    }

    const myId = user.id;
    const movementMap = new Map();
    const ranked = (cls.rows || []).map((row) => {
      movementMap.set(row.playerId, RK.mapServerMovement(row.movement));
      return {
        id: row.playerId, playerId: row.playerId, name: row.displayName,
        username: row.username ? `@${row.username}` : null,
        level: row.levelPublic, isMe: row.playerId === myId,
        locality: scope !== 'local' ? row.location : null,
        position: row.position,
      };
    });
    if (pos.hasPosition) movementMap.set(myId, RK.mapServerMovement(pos.movement));

    const totalEligible = cls.totalEligible || 0;
    const density = { level: cls.densityStatus, missing: Math.max(0, 5 - totalEligible) };
    const selfStatus = buildServerSelfStatus(pos);
    const myEntry = pos.hasPosition ? { id: myId, level: pos.levelPublic, position: pos.position } : null;
    const periodLabel = cls.edition ? RK.formatServerPeriodLabel(cls.edition.periodStartAt, cls.edition.periodEndAt) : '';

    return {
      scope, isTerritorial, selfStatus, density, ranked, movementMap, myEntry, myId,
      totalCount: totalEligible, matchedTotal: cls.matchedTotal, period: cls.edition, periodLabel,
      serverMode: true,
    };
  }

  /** Mi red server-backed (`get_ranking_network`). La RPC no expone movimiento semanal por
   *  miembro (contrato de Fase 3 — solo la clasificación territorial lo trae) ni el motivo por
   *  el que un tercero no tiene puesto (privacidad, "no reason codes de terceros") — a
   *  diferencia de la variante local, acá no se distingue CALIBRANDO de INACTIVO por persona:
   *  todo miembro sin puesto (`row.position == null`) cae en un único bloque "SIN POSICIÓN",
   *  nunca una razón inventada. Ver 20_Resultado_Fase_5_Claude.md — limitación real documentada,
   *  no un bug de esta capa. */
  async function computeRankingNetworkViewServerBacked(branch) {
    const netResult = await RK.getRankingNetwork(branch);
    if (!netResult.ok) return { scope: 'mi-red', isTerritorial: false, serverError: true, period: null, periodLabel: '' };
    const net = netResult.data;
    const myId = currentUserId;
    const rows = net.rows || [];
    const total = net.total || 0;
    const densityLevel = total <= 0 ? 'empty' : (total <= 2 ? 'simple' : 'established');
    const density = { level: densityLevel };
    // §10.2 — 1-2 elegibles: "comparación simple", nunca "sin resultados" (position siempre
    // null server-side para ese caso, ver get_ranking_network — no filtra por eso). 3+: solo
    // las filas CON puesto van a `ranked`, el resto cae en `unpositioned` (sin distinguir
    // calibrando/inactivo — ver comentario de más abajo).
    const rankedSource = densityLevel === 'simple' ? rows : rows.filter((r) => r.position != null);
    const ranked = rankedSource.map((row) => ({
      id: row.playerId, playerId: row.playerId, name: row.displayName,
      username: row.username ? `@${row.username}` : null, level: row.levelPublic,
      isMe: !!row.isSelf, position: row.position,
    }));
    const unpositioned = densityLevel === 'simple' ? [] : rows.filter((r) => r.position == null && !r.isSelf).map((row) => ({
      id: row.playerId, playerId: row.playerId, name: row.displayName,
      username: row.username ? `@${row.username}` : null, level: row.levelPublic,
    }));
    const selfRow = rows.find((r) => r.isSelf) || null;
    // La RPC nunca expone elegibilidad/reason codes para Mi red (self incluido, tratado como
    // cualquier otro miembro) — sin puesto no hay forma honesta de distinguir calibrando de
    // inactivo acá. `myEntry` queda null y `selfStatus` usa una key sin copy propio (ver
    // selfStatusCopy/RANKING_NON_BLOCKING_SELF_KEYS): la tarjeta TU POSICIÓN simplemente no se
    // muestra, nunca un estado inventado. `density.level === 'simple'` (1-2 elegibles) sigue
    // mostrando a self dentro de la lista general (`ranked`), como a cualquier otro.
    const hasPosition = !!selfRow && selfRow.position != null;
    const myEntry = hasPosition ? { id: myId, level: selfRow.levelPublic, position: selfRow.position } : null;
    const selfStatus = { key: hasPosition ? 'elegible' : 'sin-posicion-red' };
    const periodLabel = net.edition ? RK.formatServerPeriodLabel(net.edition.periodStartAt, net.edition.periodEndAt) : '';

    return {
      scope: 'mi-red', isTerritorial: false, selfStatus, density, ranked, movementMap: new Map(), myEntry, myId,
      totalCount: total, unrankedCalibrando: unpositioned, unrankedInactive: [],
      hiddenCount: net.hiddenCount || 0, hiddenRows: net.hiddenRows || [],
      period: net.edition, periodLabel, serverMode: true,
      networkRowOpts: { showMovement: false },
    };
  }

  /** Bloque 2/3, refinado en V03.5.1 (§3/§4/§5) — universo/orden/movimiento de la combinación
   *  ámbito+género+banda ACTUALMENTE activa. El Nivel de CADA jugador —self incluido— es
   *  siempre PH.computeSimulatedJugadorLevel: Ranking nunca calcula ni modifica Nivel BRAMU,
   *  solo ordena lo que esa función ya devuelve. Género es SIEMPRE obligatorio (§4: "no
   *  mostrar ambos mezclados"), banda es un filtro opcional (§5, ya no un modo paralelo).
   *
   *  `mi-red` (antes "Mis jugadores"): §3.3 acota el universo a partidos COMPUTABLES de los
   *  últimos 180 días (RK.computeNetworkNames) — reemplaza a ML.computeRecentPlayers, que no
   *  filtraba por fecha ni por computabilidad y era, en sí misma, una sustitución temporal de
   *  "partido validado" (este prototipo no tiene validación multiusuario real todavía). */
  /** BRAMUlab_V03.5.2 (Ranking_BRAMU.md §4) — Ranking pasa de continuo a SEMANAL: el Nivel que
   *  ordena y se muestra dentro de Ranking es el consolidado al cierre del domingo anterior
   *  (`period`, calculado acá), nunca el Nivel actual — Home/Mi Perfil siguen mostrando el
   *  actual sin cambios. `historySnapshotAsOf` recorta el historial a lo que ya era computable
   *  ANTES de ese corte (por `createdAt`, no por `playedAt` — ver su comentario en ranking.js:
   *  así un partido del domingo a la noche cargado el lunes no reescribe la edición que ya
   *  cerró, entra en la siguiente, §4.3/Caso 2).
   *
   *  CORRECCIÓN DE CIERRE de esta misma ronda (dos puntos, ver reporte):
   *  1) `period` es la semana CALENDARIO que contiene "ahora" — sirve para el CORTE (todo lo
   *     registrado antes de `period.start` es "lo consolidado al cierre del domingo pasado").
   *     Pero la edición ACTIVA durante `period` no se identifica con ese rango: se identifica
   *     con la semana que la produjo, que es `previousPeriod` (la semana calendario ANTERIOR).
   *     Ejemplo del propio Ranking_BRAMU.md: durante Lun07–Dom13 se muestra la edición
   *     "Ranking semanal · Lun 31 ago — Dom 06 sep" — nunca "Lun 07 — Dom 13", que sería la
   *     semana todavía en curso. `periodLabel` usa `previousPeriod`, nunca `period`.
   *  2) La elegibilidad (selfStatus/estado de cada compañero de Mi red: calibrando, inactivo,
   *     elegible, sin-nivel) también queda CONGELADA al corte — se evalúa con
   *     `currentSnapshotHistory` y `period.start` como "ahora", igual que el Nivel. Si alguien
   *     termina de calibrarse o cruza 180 días de inactividad con un partido cuyo `createdAt`
   *     cae DESPUÉS del corte, ese cambio recién se refleja en la próxima edición — nunca
   *     altera la ya publicada. Ubicación y opt-in/privacidad son campos de cuenta SIN
   *     historial de cambios en este prototipo (no existe un `createdAt` de "cuándo cambiaste
   *     tu ubicación"): siguen leyéndose en vivo — versionarlos es una superficie nueva,
   *     explícitamente fuera de alcance de esta corrección (ver reporte, limitaciones). */
  function computeRankingViewLocal() {
    const scope = rankingScopeFilter;
    const isTerritorial = scope !== 'mi-red';

    // §17/Bloque 3 — Global bloqueado: corta ACÁ, antes de armar ningún universo (nunca
    // simular un desbloqueo que el documento prohíbe expresamente).
    if (scope === 'global' && !RK.GLOBAL_UNLOCKED) {
      return { scope, isTerritorial, globalBlocked: true };
    }

    const history = getComputableHistory();
    const user = Store.getCurrentUser();
    const myId = Store.normalizePlayerName(currentPlayerName);
    const selfGender = rankingEffectiveGender(user);

    const now = new Date();
    const period = RK.computeRankingWeekPeriod(now);
    const previousPeriod = RK.computePreviousRankingWeekPeriod(now);
    // El período que IDENTIFICA a la edición vigente es el que la produjo (previousPeriod),
    // nunca la semana calendario en curso (period) — ver comentario de la función.
    const periodLabel = RK.formatRankingWeekRangeLabel(previousPeriod);
    const currentSnapshotHistory = RK.historySnapshotAsOf(history, period.start);
    const previousSnapshotHistory = RK.historySnapshotAsOf(history, previousPeriod.start);
    // La elegibilidad propia queda congelada al mismo corte que el Nivel — nunca en vivo.
    const selfStatus = RK.computeSelfStatus(user, currentSnapshotHistory, isTerritorial, period.start);

    if (isTerritorial) {
      const names = RK.buildScopeUniverseNames(scope);
      // BRAMUlab_V03.7 (§8) — pool de localidades mock coherente con el ámbito mostrado (nunca
      // más "true" ciclando TODO locations.js sin importar Local/Provincial/País): Local =
      // únicamente la localidad exacta de `user`, Provincial = misma región/provincia (CABA y
      // Buenos Aires quedan siempre separadas), País = mismo país. Ver scopeLocalityPool en
      // ranking.js — corrige el bug real de geografía mezclada reportado en producción.
      const localityPool = RK.scopeLocalityPool(scope, user);
      let allEntries = RK.buildRankingEntries(names, currentSnapshotHistory, currentPlayerName, localityPool, selfGender, undefined, currentUserId);
      // Bloque 3 — solo CALIBRADO/RECALIBRANDO (acá: 'elegible') ocupa puesto (§6.2 regla 5).
      // Los mock territoriales son siempre elegibles por construcción; self se saca si no lo es.
      if (selfStatus.key !== 'elegible') allEntries = allEntries.filter((e) => !e.isMe);
      let universe = RK.filterByGender(allEntries, rankingGenderFilter);
      if (rankingBandFilter != null) universe = RK.bandFilter(universe, rankingBandFilter);
      const density = RK.computeTerritorialDensity(universe.length);
      if (density.level === 'insufficient') {
        return { scope, isTerritorial, selfStatus, density, totalCount: universe.length, ranked: [], movementMap: new Map(), myEntry: null, myId, period, periodLabel };
      }
      const ranked = RK.rankEntries(universe);

      // Edición anterior — mismo universo de nombres, Nivel leído al corte de la semana previa
      // (§5.1: "mismo universo/filtro cuando sea posible").
      let previousAllEntries = RK.buildRankingEntries(names, previousSnapshotHistory, currentPlayerName, localityPool, selfGender, undefined, currentUserId);
      if (selfStatus.key !== 'elegible') previousAllEntries = previousAllEntries.filter((e) => !e.isMe);
      let previousUniverse = RK.filterByGender(previousAllEntries, rankingGenderFilter);
      if (rankingBandFilter != null) previousUniverse = RK.bandFilter(previousUniverse, rankingBandFilter);
      const movementMap = RK.computeWeeklyMovement(universe, previousUniverse);
      // Casos 4/7 — "fin de calibración"/"reingreso": self entra como Nuevo, nunca con una
      // variación calculada contra un corte que no lo incluía.
      if (selfStatus.isNew) movementMap.set(myId, { delta: null, label: 'Nuevo' });
      const myEntry = ranked.find((e) => e.id === myId) || null;
      return { scope, isTerritorial, selfStatus, density, ranked, movementMap, myEntry, myId, totalCount: ranked.length, period, periodLabel };
    }

    // Mi red — cada compañero tiene SU PROPIO estado real (nunca el universo mock territorial:
    // acá todos son cuentas/partidos reales). §3.4 — nunca mezclar ocultos con la vista normal.
    // Universo Y estado (calibrando/inactivo/elegible) de cada compañero quedan congelados al
    // mismo corte que el Nivel (corrección de cierre de esta ronda): un compañero nuevo cuyo
    // primer partido compartido se cargó después del corte, o alguien que recién completó
    // calibración/cruzó inactividad con un partido posterior al corte, entra/sale recién en la
    // próxima edición — nunca en la ya publicada. Ocultar sigue siendo una preferencia ACTUAL
    // (nunca se snapshotea: si ocultás a alguien hoy, desaparece también de ediciones pasadas
    // que puedas volver a ver, es a propósito — ver V03.5.1 §3.4).
    const hiddenNames = user ? Store.loadHiddenNetworkPlayers(user.id) : [];
    const hiddenSet = new Set(hiddenNames.map((n) => Store.normalizePlayerName(n)));
    const rawNames = RK.computeNetworkNames(currentSnapshotHistory, currentIdentity(), period.start);
    const visibleNames = rawNames.filter((n) => !hiddenSet.has(Store.normalizePlayerName(n)));
    const participants = visibleNames.map((n) => ({ name: n, status: RK.computeParticipantStatus(n, currentSnapshotHistory, period.start) }));
    const eligibleNames = participants.filter((p) => p.status.key === 'elegible').map((p) => p.name);
    const calibrandoNames = participants.filter((p) => p.status.key === 'sin-nivel' || p.status.key === 'calibrando').map((p) => p.name);
    const inactiveNames = participants.filter((p) => p.status.key === 'inactivo').map((p) => p.name);

    let allEntries = RK.buildRankingEntries(eligibleNames, currentSnapshotHistory, currentPlayerName, false, selfGender, undefined, currentUserId);
    if (selfStatus.key !== 'elegible') allEntries = allEntries.filter((e) => !e.isMe);
    let universe = RK.filterByGender(allEntries, rankingGenderFilter);
    if (rankingBandFilter != null) universe = RK.bandFilter(universe, rankingBandFilter);
    const density = RK.computeNetworkDensity(universe.length);
    const ranked = density.level === 'empty' ? [] : RK.rankEntries(universe);

    let movementMap = new Map();
    if (density.level === 'established') {
      // Red de la semana anterior: mismo criterio de 180 días pero con el reloj y el
      // historial parados en el corte previo — así "Nuevo"/"↑/↓" comparan contra una red que
      // realmente existía en ese momento, no contra la red de hoy con Niveles viejos.
      const prevRawNames = RK.computeNetworkNames(previousSnapshotHistory, currentIdentity(), previousPeriod.start);
      const prevVisibleNames = prevRawNames.filter((n) => !hiddenSet.has(Store.normalizePlayerName(n)));
      const prevParticipants = prevVisibleNames.map((n) => ({ name: n, status: RK.computeParticipantStatus(n, previousSnapshotHistory, previousPeriod.start) }));
      const prevEligibleNames = prevParticipants.filter((p) => p.status.key === 'elegible').map((p) => p.name);
      let previousAllEntries = RK.buildRankingEntries(prevEligibleNames, previousSnapshotHistory, currentPlayerName, false, selfGender, undefined, currentUserId);
      if (selfStatus.key !== 'elegible') previousAllEntries = previousAllEntries.filter((e) => !e.isMe);
      let previousUniverse = RK.filterByGender(previousAllEntries, rankingGenderFilter);
      if (rankingBandFilter != null) previousUniverse = RK.bandFilter(previousUniverse, rankingBandFilter);
      movementMap = RK.computeWeeklyMovement(universe, previousUniverse);
    }
    if (selfStatus.isNew) movementMap.set(myId, { delta: null, label: 'Nuevo' });
    const myEntry = ranked.find((e) => e.id === myId) || null;

    return {
      scope, isTerritorial, selfStatus, density, ranked, movementMap, myEntry, myId,
      totalCount: universe.length,
      unrankedCalibrando: calibrandoNames.map((n) => buildUnrankedParticipant(n, currentSnapshotHistory, period.start)),
      unrankedInactive: inactiveNames.map((n) => buildUnrankedParticipant(n, currentSnapshotHistory, period.start)),
      hiddenCount: hiddenNames.length,
      period, periodLabel,
    };
  }

  /** Backend Bloque 7 (Fase 5) — único punto que decide entre datos reales (RPCs de Fase 3) y
   *  el prototipo local/mock: mismo criterio que `playerPublicPlayerId && Auth.isConfigured()`
   *  en `renderPlayerPublicProfile` — con backend configurado y una cuenta `serverBacked`,
   *  Ranking SIEMPRE consulta datos reales, nunca un fallback simulado (handoff Fase 5 §9). Sin
   *  backend configurado (desarrollo local) o con una cuenta legacy/local, el comportamiento
   *  histórico queda intacto. */
  async function computeRankingView() {
    const user = Store.getCurrentUser();
    if (Auth.isConfigured() && user && user.serverBacked) return computeRankingViewServerBacked(user);
    return computeRankingViewLocal();
  }

  function rankingContextLabel() {
    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === rankingScopeFilter) || {}).label || '';
    const genderLabel = RANKING_GENDER_LABELS[rankingGenderFilter];
    const bandLabel = rankingBandFilter != null ? ` · Nivel ${rankingBandFilter}` : '';
    return `${scopeLabel} · ${genderLabel}${bandLabel}`;
  }

  /** Bloque 3 — acción del CTA de #ranking-state-card, guardada acá porque el botón se pinta
   *  de nuevo en cada render (siempre el mismo listener, ver initRankingScreen). */
  let rankingStateCtaAction = null;

  /** Bloque 3 (§19.3/Ranking_BRAMU.md §6.3) — copy de "estados propios": SIEMPRE en primera
   *  persona y privado (solo lo ve el propio usuario, nunca aparece en la fila de otro — "para
   *  terceros no exponer motivos privados de exclusión", pedido explícito del Bloque 3).
   *  V03.5.1 (§10) — los CTA que van a Perfil pasan 'ranking' como origen para que el back de
   *  Mi Perfil/Mis Datos vuelva accá, no a Home. */
  function selfStatusCopy(status, scopeLabel) {
    switch (status.key) {
      case 'opt-out':
        return { title: 'DESACTIVASTE EL RANKING', text: 'Desactivaste tu participación en el Ranking BRAMU. Podés reactivarla cuando quieras — tu Nivel BRAMU se mantiene igual.', cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos', 'ranking') };
      case 'perfil-privado':
        return { title: 'TU PERFIL ES PRIVADO', text: 'Con el perfil privado no ocupás posiciones en el Ranking BRAMU. Hacelo público para aparecer.', cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos', 'ranking') };
      case 'sin-nivel':
        return { title: 'TODAVÍA NO TENÉS NIVEL BRAMU', text: 'Jugá y guardá tu primer partido para que BRAMU empiece a calcular tu Nivel — recién ahí vas a poder ocupar una posición.', cta: 'IR AL INICIO', action: () => openPlayerHome() };
      case 'calibrando':
        return { title: 'CALIBRANDO', text: `${status.calib.progressText} · Todavía no ocupás una posición en el Ranking BRAMU.`, cta: null };
      case 'inactivo':
        return { title: 'SIN POSICIÓN POR INACTIVIDAD', text: 'Tu Nivel BRAMU se mantiene. Validá un nuevo partido para volver a aparecer.', cta: null };
      case 'sin-ubicacion':
        return { title: 'FALTA TU UBICACIÓN', text: `Elegí tu localidad principal de juego en MIS DATOS para aparecer en ${scopeLabel}.`, cta: 'IR A MIS DATOS', action: () => openProfileScreen('mis-datos', 'ranking') };
      default:
        return null;
    }
  }

  /** Ranking_BRAMU.md §11.2 — 0-4 elegibles: nunca publicar puestos, explicar cuántos faltan y
   *  ofrecer una salida (ámbito superior, o volver a Todos los niveles si la insuficiencia la
   *  causó el filtro de banda — Caso 10 del documento). */
  function territorialDensityCopy(view) {
    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === view.scope) || {}).label || '';
    const missing = view.density.missing;
    const text = `Hay ${view.totalCount} ${view.totalCount === 1 ? 'jugador elegible' : 'jugadores elegibles'} en ${scopeLabel}. Faltan ${missing} para habilitar la clasificación.`;
    if (rankingBandFilter != null) {
      return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: 'VER TODOS LOS NIVELES', action: () => { rankingBandFilter = null; renderRankingBandTrigger(); onRankingFilterChanged(); } };
    }
    const NEXT_SCOPE = { local: 'provincial', provincial: 'pais' };
    const next = NEXT_SCOPE[view.scope];
    if (!next) return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: null };
    const nextLabel = (RANKING_SCOPE_TABS.find((t) => t.key === next) || {}).label || '';
    return { title: `${scopeLabel.toUpperCase()} EN FORMACIÓN`, text, cta: `VER ${nextLabel.toUpperCase()}`, action: () => { rankingScopeFilter = next; renderRankingScopeTabs(); onRankingFilterChanged(); } };
  }

  /** BRAMUlab_V03.6 (cierre final, §1) — estados donde self simplemente todavía no tiene una
   *  POSICIÓN OFICIAL (sin Nivel BRAMU, o calibrando) YA NO bloquean toda la clasificación —
   *  antes mezclaba dos cosas distintas ("tener o no Nivel" vs. "tener o no posición"), e
   *  impedía explorar Ranking a cualquier cuenta nueva. Ahora el mensaje correspondiente se
   *  muestra DENTRO de #ranking-normal-content, en el lugar de TU POSICIÓN (ver
   *  renderRankingMyPosition), y la clasificación/búsqueda/filtros siguen funcionando
   *  normalmente debajo — nunca se inventa un puesto ni un Nivel para self. Los demás estados
   *  (Ranking desactivado, perfil privado, inactivo, falta ubicación) siguen bloqueando igual
   *  que antes — son decisiones/datos faltantes, no "todavía sin posición". */
  const RANKING_NON_BLOCKING_SELF_KEYS = new Set(['sin-nivel', 'calibrando']);

  /** Único punto de entrada para decidir si se muestra el contenido normal (Tu posición +
   *  Clasificación) o una tarjeta de estado que lo reemplaza por completo — Global bloqueado >
   *  estado propio (privado, nunca visible para terceros) > densidad territorial insuficiente.
   *  Bloque 3, "estados de producto". */
  function renderRankingStateCard(view) {
    const globalBlocked = $('#ranking-global-blocked');
    const stateCard = $('#ranking-state-card');
    const normal = $('#ranking-normal-content');
    const filtersRow = $('#ranking-filters-row');
    const searchBtn = $('#ranking-search-toggle-btn');

    if (view.globalBlocked) {
      globalBlocked.hidden = false;
      stateCard.hidden = true;
      normal.hidden = true;
      // Bloqueado: género/nivel/búsqueda no tienen nada sobre qué actuar todavía.
      filtersRow.hidden = true;
      searchBtn.hidden = true;
      if (rankingSearchOpen) closeRankingSearch();
      return;
    }
    globalBlocked.hidden = true;
    filtersRow.hidden = false;
    searchBtn.hidden = false;

    const scopeLabel = (RANKING_SCOPE_TABS.find((t) => t.key === view.scope) || {}).label || '';
    const selfKey = view.selfStatus && view.selfStatus.key;
    const selfIsPending = RANKING_NON_BLOCKING_SELF_KEYS.has(selfKey);
    let copy = selfIsPending ? null : selfStatusCopy(view.selfStatus, scopeLabel);
    if (!copy && view.isTerritorial && view.density.level === 'insufficient') copy = territorialDensityCopy(view);

    if (!copy) {
      stateCard.hidden = true;
      normal.hidden = false;
      return;
    }
    $('#ranking-state-title').textContent = copy.title;
    $('#ranking-state-text').textContent = copy.text;
    const cta = $('#ranking-state-cta');
    if (copy.cta) { cta.hidden = false; cta.textContent = copy.cta; rankingStateCtaAction = copy.action; }
    else { cta.hidden = true; rankingStateCtaAction = null; }
    stateCard.hidden = false;
    normal.hidden = true;
  }

  /** §7 — TU POSICIÓN vive DENTRO de la tarjeta (lenguaje visual de Último partido: borde
   *  lima, jerarquía posición grande + Nivel BRAMU a la derecha), tarjeta completa interactiva
   *  (§8.2 — tocarla hace scroll suave a la fila propia, ver locateMeInRanking) y NUNCA sticky
   *  (§7.2). Solo se llama cuando #ranking-normal-content está visible — renderRankingStateCard
   *  ya filtró densidad insuficiente/Global bloqueado/estados propios bloqueantes (privado,
   *  desactivado, inactivo, sin ubicación) antes de esto. `sin-nivel`/`calibrando` YA NO se
   *  filtran ahí desde el cierre final de V03.6 — llegan hasta acá con `view.myEntry` null,
   *  manejados en la rama de abajo. */
  function renderRankingMyPosition(view) {
    const card = $('#ranking-my-position-card');
    if (!view.myEntry) {
      // BRAMUlab_V03.6 (cierre final, §1) — self sin Nivel/calibrando ya no bloquea toda la
      // clasificación (ver renderRankingStateCard) — acá, en el mismo lugar donde iría TU
      // POSICIÓN, se muestra un mensaje informativo en vez de ocultar la tarjeta entera. Nunca
      // un puesto ni un Nivel inventado; nunca clickeable (mismo <button>, pero
      // locateMeInRanking ya es un no-op sin myEntry).
      const selfKey = view.selfStatus && view.selfStatus.key;
      if (RANKING_NON_BLOCKING_SELF_KEYS.has(selfKey)) {
        card.hidden = false;
        card.classList.add('ranking-my-position--pending');
        card.innerHTML = `
          <span class="ranking-my-position__label">TODAVÍA NO TENÉS POSICIÓN EN EL RANKING</span>
          <p class="coverage-note ranking-my-position__pending-text">Podés explorar la clasificación mientras completás tu Nivel BRAMU. Cuando seas elegible, tu posición aparecerá acá.</p>
        `;
        return;
      }
      card.hidden = true;
      card.classList.remove('ranking-my-position--pending');
      return;
    }
    card.classList.remove('ranking-my-position--pending');
    card.hidden = false;

    // Ranking_BRAMU.md §10.2 — Mi red con 1-2 elegibles: comparación simple, SIN "N de total"
    // ni movimiento semanal (no tiene sentido comparar contra un corte que tampoco tenía
    // puestos). NUNCA inventar `#1 de 1` — la regla deportiva vigente no cambia acá.
    // BRAMUlab_V03.9 (§2) — BUG REAL de composición: el markup anterior (una sola línea "Nivel
    // BRAMU X" sin la fila `__main`/`__rank` que sí usa el caso general) dejaba el Nivel
    // "flotando" desbalanceado y decía "Comparación entre 1 jugadores" (singular roto). Ahora
    // reutiliza la MISMA estructura `__main`/`__rank`/`__level` del caso general (mismos
    // estilos, cero CSS nuevo) con "—" en la zona de puesto en vez de un número inventado, y
    // singular/plural correcto en el contexto.
    if (!view.isTerritorial && view.density.level === 'simple') {
      const count = view.totalCount;
      card.innerHTML = `
        <span class="ranking-my-position__label">TU POSICIÓN</span>
        <div class="ranking-my-position__main">
          <div class="ranking-my-position__rank">
            <span class="ranking-my-position__pos">—</span>
          </div>
          <div class="ranking-my-position__level">
            <span class="ranking-my-position__level-value">${view.myEntry.level.toFixed(1)}</span>
            <span class="ranking-my-position__level-label">NIVEL BRAMU</span>
          </div>
        </div>
        <div class="ranking-my-position__meta">Comparación simple · ${count} ${count === 1 ? 'jugador' : 'jugadores'} · Mi red</div>
      `;
      return;
    }

    const mv = view.movementMap.get(view.myEntry.id) || { label: '—' };
    // §11.1 último inciso — 5-14 elegibles: "en formación", sin podio ni reconocimiento de
    // líder. Acá se limita a una etiqueta discreta junto al denominador, nunca un podio.
    const formingBadge = view.isTerritorial && view.density.level === 'forming'
      ? ' <span class="ranking-forming-badge">EN FORMACIÓN</span>' : '';
    card.innerHTML = `
      <span class="ranking-my-position__label">TU POSICIÓN</span>
      <div class="ranking-my-position__main">
        <div class="ranking-my-position__rank">
          <span class="ranking-my-position__pos">#${view.myEntry.position}</span>
          <span class="ranking-my-position__of">de ${view.totalCount}</span>${formingBadge}
        </div>
        <div class="ranking-my-position__level">
          <span class="ranking-my-position__level-value">${view.myEntry.level.toFixed(1)}</span>
          <span class="ranking-my-position__level-label">NIVEL BRAMU</span>
        </div>
      </div>
      <div class="ranking-my-position__meta"><span class="ranking-my-position__movement ${rankingMovementClass(mv)}">${escapeHtml(rankingMovementLongLabel(mv))}</span> · ${escapeHtml(rankingContextLabel())}</div>
    `;
  }

  /** BRAMUlab_V03.6 (cierre final, §2) — color semántico del indicador de movimiento: sube =
   *  lima BRAMU, baja = rojo, sin cambio/"Nuevo" = neutro (tokens ya existentes, ninguno nuevo).
   *  Se basa en `mv.delta` (nunca en el texto): positivo = subió puestos, negativo = bajó,
   *  `null`/`0` (Nuevo/—) quedan neutros — mismo criterio que ya documenta §18 de este archivo
   *  ("nunca rojo/verde según la dirección" se refería a ANTES de este pedido explícito; ahora
   *  si corresponde). Colorea SOLO el indicador — nunca la fila entera. */
  function rankingMovementClass(mv) {
    if (mv.delta > 0) return 'is-up';
    if (mv.delta < 0) return 'is-down';
    return 'is-flat';
  }

  /** BRAMUlab_V03.5.2 (§4) — versión larga de la etiqueta de movimiento, preferida "cuando haya
   *  espacio" (acá sí lo hay: la tarjeta Tu posición ocupa el ancho completo). Nunca menciona
   *  "puntos" — Ranking BRAMU no tiene puntos propios (§3.2). */
  function rankingMovementLongLabel(mv) {
    if (mv.label === 'Nuevo') return 'Nuevo en esta clasificación';
    if (mv.label === '—') return 'Mismo puesto que la semana anterior';
    const n = Math.abs(mv.delta);
    return `${mv.delta > 0 ? '↑' : '↓'} ${n} ${n === 1 ? 'puesto' : 'puestos'} vs. semana anterior`;
  }

  /** §11.1 — reutiliza EXACTAMENTE la fila de la tabla de Mis grupos (.group-table__row,
   *  buildGroupTableRowHTML en spíritu): posición, avatar, nombre + @usuario, contexto mínimo
   *  (localidad en Provincial/País/Global — Local/Mi red no la necesitan, sería redundante) y
   *  Nivel BRAMU. Se agrega SOLO el indicador de movimiento semanal al lado — nunca
   *  efectividad/victorias/derrotas/rachas (§11.1, explícitamente prohibido en la fila).
   *  `showPosition:false` — Ranking_BRAMU.md §10.2, Mi red con 1-2 elegibles: se muestran las
   *  filas pero SIN número de puesto ("comparación simple", nunca "1 de 2").
   *  `hideAction:true` — V03.5.1 §3.4, solo Mi red: ícono "ocultar de Mi red" por fila (nunca
   *  en la propia). Vive DENTRO del botón de la fila como un `<span role="button">` con su
   *  propio `stopPropagation` (ver wireRankingRowClicks) — evitar anidar un <button> real
   *  dentro de otro <button>. */
  /** BRAMUlab_V03.6 (hotfix — bug real §3) — estructura ÚNICA de 3 renglones para toda fila de
   *  Ranking (nombre / @usuario / ubicación), reportada como inconsistente en la prueba real:
   *  antes nombre+`· @usuario` vivían en `.group-table__toprow` (flex-wrap), así que el handle
   *  quedaba en la MISMA línea o se caía a una propia según si el nombre era corto o largo —
   *  nunca decisión de diseño, un efecto colateral del ancho disponible. Ahora el handle es
   *  SIEMPRE su propio renglón (`.ranking-row__handle`, display:block) y se quita el "· " —
   *  separador que ya no hace falta al no compartir línea. Nunca toca `.group-table__toprow`
   *  en sí (la tabla de Mis Grupos la sigue usando tal cual, sin cambios). */
  function buildRankingRowHTML(entry, movementMap, opts) {
    const showPosition = !opts || opts.showPosition !== false;
    // Backend Bloque 7 (Fase 5) — showMovement:false (Mi red server-backed): get_ranking_network
    // no expone movimiento semanal por miembro (contrato de Fase 3), así que la fila nunca debe
    // mostrar un "—"/delta local que no viene de ningún cálculo real (ver
    // computeRankingNetworkViewServerBacked). En cualquier otro caso (default true), sin cambios.
    const showMovement = showPosition && (!opts || opts.showMovement !== false);
    const mv = (movementMap && movementMap.get(entry.id)) || { label: '—' };
    // Backend Bloque 7 (Fase 5) — filas server-backed ya traen el @usuario REAL de
    // get_ranking_classification/get_ranking_network (entry.username): nunca re-derivarlo de
    // Store local (que ni siquiera tiene esa cuenta cacheada) ni del handle placeholder que sí
    // corresponde al universo mock local.
    const account = entry.username ? null : buildGroupRowAccount(entry.name);
    const handle = entry.username || (account && account.username ? `@${account.username}` : buildPlayerHandle(entry.name));
    const caption = entry.locality ? `<span class="group-table__caption">${escapeHtml(entry.locality)}</span>` : '';
    const positionHTML = showPosition
      ? `<span class="group-table__position">${entry.position}</span>`
      : `<span class="group-table__position ranking-row__position--dash" aria-hidden="true">—</span>`;
    // playerId real (Bloque 7) → abre el Perfil público server-backed por id, nunca por nombre
    // (mismo criterio que search_players/get_public_profile en el resto de la app — ver
    // wireRankingRowClicks). Ausente en filas del universo mock local, sin cambios ahí.
    const playerIdAttr = entry.playerId ? ` data-player-id="${escapeHtml(entry.playerId)}"` : '';
    const hideHTML = (opts && opts.hideAction && !entry.isMe)
      ? `<span class="ranking-row__hide-btn" data-name="${escapeHtml(entry.name)}"${playerIdAttr} role="button" tabindex="0" aria-label="Ocultar de Mi red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.4 9.4 0 0 1 12 5c5 0 8.5 3.5 10 7-.6 1.3-1.5 2.6-2.6 3.7M6.3 6.3C4.2 7.7 2.6 9.6 2 12c.9 2 2.3 3.7 4 5"/></svg></span>`
      : '';
    return `<button type="button" class="group-table__row ranking-row${entry.isMe ? ' is-me' : ''}" data-name="${escapeHtml(entry.name)}"${playerIdAttr}>
      ${positionHTML}
      ${buildGroupAvatarHTML(entry.name)}
      <span class="group-table__info">
        <span class="group-table__name">${escapeHtml(entry.name)}</span>
        <span class="group-table__handle ranking-row__handle">${escapeHtml(handle)}</span>
        ${caption}
      </span>
      <span class="group-table__points">
        <span class="group-table__points-value">${entry.level.toFixed(1)}</span>
        <span class="group-table__points-label">NIVEL BRAMU</span>
      </span>
      ${showMovement ? `<span class="ranking-row__movement ${rankingMovementClass(mv)}">${escapeHtml(mv.label)}</span>` : ''}
      ${hideHTML}
    </button>`;
  }

  /** Bloque 3 (Ranking_BRAMU.md §10.2) — compañero de Mi red CALIBRANDO o INACTIVO: visible
   *  como vínculo, nunca con puesto numérico. Nivel BRAMU solo si ya existe una estimación
   *  real (calibrando/inactivo) — 'sin-nivel' no muestra ningún número. */
  function buildUnrankedRowHTML(p) {
    // Backend Bloque 7 (Fase 5) — get_ranking_network nunca expone POR QUÉ un tercero no tiene
    // puesto (privacidad: "sin reason codes de terceros", handoff Fase 3 §6): sin `p.status`
    // (fila server-backed, ver computeRankingNetworkViewServerBacked), el badge queda genérico,
    // nunca calibrando/inactivo inventado. Con `p.status` (universo local/mock), mismo criterio
    // de siempre.
    const account = p.username ? null : buildGroupRowAccount(p.name);
    const handle = p.username || (account && account.username ? `@${account.username}` : buildPlayerHandle(p.name));
    const badge = !p.status ? 'SIN POSICIÓN EN EL RANKING'
      : p.status.key === 'calibrando' ? (p.status.calib.progressText || 'CALIBRANDO')
      : p.status.key === 'inactivo' ? 'SIN POSICIÓN POR INACTIVIDAD'
      : 'SIN NIVEL BRAMU';
    const levelHTML = p.level != null
      ? `<span class="group-table__points"><span class="group-table__points-value">${p.level.toFixed(1)}</span><span class="group-table__points-label">NIVEL BRAMU</span></span>`
      : '';
    const playerIdAttr = p.playerId ? ` data-player-id="${escapeHtml(p.playerId)}"` : '';
    return `<button type="button" class="group-table__row ranking-row" data-name="${escapeHtml(p.name)}"${playerIdAttr}>
      <span class="group-table__position ranking-row__position--dash" aria-hidden="true">—</span>
      ${buildGroupAvatarHTML(p.name)}
      <span class="group-table__info">
        <span class="group-table__name">${escapeHtml(p.name)}</span>
        <span class="group-table__handle ranking-row__handle">${escapeHtml(handle)}</span>
        <span class="group-table__caption ranking-row__status-badge">${escapeHtml(badge)}</span>
      </span>
      ${levelHTML}
      <span class="ranking-row__hide-btn" data-name="${escapeHtml(p.name)}"${playerIdAttr} role="button" tabindex="0" aria-label="Ocultar de Mi red"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.4 9.4 0 0 1 12 5c5 0 8.5 3.5 10 7-.6 1.3-1.5 2.6-2.6 3.7M6.3 6.3C4.2 7.7 2.6 9.6 2 12c.9 2 2.3 3.7 4 5"/></svg></span>
    </button>`;
  }

  /** §14 — misma regla que ya usa la tabla de Mis grupos (isOwnGroupTableRow): la fila propia
   *  abre MI PERFIL, cualquier otra abre el Perfil público existente — nunca una ficha nueva.
   *  V03.5.1 (§10) — origen 'ranking' para que el back de Mi Perfil vuelva acá. El ícono de
   *  "ocultar" corta la propagación para no disparar también el click de la fila entera. */
  function wireRankingRowClicks(containerId) {
    $all(`#${containerId} .ranking-row`).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-me')) { openProfileScreen('mi-perfil', 'ranking'); return; }
        // Backend Bloque 7 (Fase 5) — con playerId real (fila server-backed), abre el Perfil
        // público POR ID (mismo criterio que search_players/get_public_profile — nunca por
        // nombre, que podría resolver a la cuenta equivocada u homónima). Sin playerId
        // (universo mock local), comportamiento histórico sin cambios.
        const playerId = btn.dataset.playerId;
        openPlayerPublicProfile(playerId ? { name: btn.dataset.name, playerId } : btn.dataset.name, 'ranking');
      });
    });
    $all(`#${containerId} .ranking-row__hide-btn`).forEach((span) => {
      const ref = span.dataset.playerId ? { name: span.dataset.name, playerId: span.dataset.playerId } : span.dataset.name;
      span.addEventListener('click', (e) => { e.stopPropagation(); hideNetworkPlayerAction(ref); });
      span.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); hideNetworkPlayerAction(ref); }
      });
    });
  }

  /** id → "@usuario" (cuenta real) o el handle provisional derivado — mismo criterio que el
   *  resto de la app (buildGroupRowAccount/buildPlayerHandle), armado acá porque RK.filterEntriesBySearch
   *  es una función pura (sin Store) y necesita este mapa ya resuelto. Backend Bloque 7 (Fase 5)
   *  — filas server-backed ya traen `entry.username` real, nunca se re-deriva de Store local. */
  function rankingUsernameMap(entries) {
    const map = new Map();
    entries.forEach((e) => {
      if (e.username) { map.set(e.id, e.username); return; }
      const account = buildGroupRowAccount(e.name);
      map.set(e.id, account && account.username ? `@${account.username}` : buildPlayerHandle(e.name));
    });
    return map;
  }

  /** §8.1/§11/§12/§13 — clasificación completa: arranca en #1 (nunca centrada en el usuario
   *  por defecto), con búsqueda activa se muestran TODOS los resultados que matchean (no tiene
   *  sentido paginarlos, §13: "no modifica el cálculo del ranking"); sin búsqueda, se pagina en
   *  bloques de 50 (§12/§8.4). Mi red con 1-2 elegibles (§10.2): mismas filas, sin puesto. */
  function renderRankingClassification(view) {
    const showPosition = view.isTerritorial || view.density.level !== 'simple';
    const rowOpts = Object.assign({ showPosition, hideAction: !view.isTerritorial }, view.networkRowOpts || null);
    $('#ranking-universe-count').textContent = showPosition
      ? `${view.totalCount} ${view.totalCount === 1 ? 'jugador elegible' : 'jugadores elegibles'}`
      : `Comparación entre ${view.totalCount} jugadores`;
    // BRAMUlab_V03.5.2 (§3/§13.5) — identificación de la edición semanal vigente, cerca de
    // CLASIFICACIÓN: "Ranking semanal · Lun 31 ago — Dom 06 sep". Nunca "Actualizado hoy" — el
    // Ranking ya no es continuo.
    $('#ranking-period-label').textContent = `Ranking semanal · ${view.periodLabel}`;
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
      wrap.innerHTML = results.map((e) => buildRankingRowHTML(e, view.movementMap, rowOpts)).join('');
      wireRankingRowClicks('ranking-list');
      return;
    }

    const isEmpty = view.ranked.length === 0;
    wrap.hidden = isEmpty;
    empty.hidden = !isEmpty;
    loadMoreBtn.hidden = true;
    if (isEmpty) {
      wrap.innerHTML = '';
      $('#ranking-list-empty-text').textContent = rankingBandFilter != null
        ? `Todavía no hay jugadores elegibles en Nivel ${rankingBandFilter} acá.`
        : 'Todavía no hay jugadores elegibles en esta vista.';
      return;
    }
    if (!showPosition) {
      // §10.2 — comparación simple (1-2 elegibles): nunca son tantos como para paginar.
      wrap.innerHTML = view.ranked.map((e) => buildRankingRowHTML(e, view.movementMap, rowOpts)).join('');
      wireRankingRowClicks('ranking-list');
      return;
    }
    const visible = RK.paginate(view.ranked, rankingLoadedBlocks);
    wrap.innerHTML = visible.map((e) => buildRankingRowHTML(e, view.movementMap, rowOpts)).join('');
    wireRankingRowClicks('ranking-list');
    // Backend Bloque 7 (Fase 5) — comparar contra `view.totalCount` (denominador real), nunca
    // `view.ranked.length`: en modo server-backed `ranked` YA es la página pedida al servidor
    // (a lo sumo `rankingLoadedBlocks * BLOCK_SIZE` filas, ver computeRankingViewServerBacked),
    // así que comparar contra su propio largo siempre daría "no hay más" aunque el servidor
    // tenga más elegibles para la siguiente página. En modo local `totalCount` ya es
    // exactamente `ranked.length` (sin cambios de comportamiento ahí).
    loadMoreBtn.hidden = visible.length >= view.totalCount;
  }

  /** Bloque 3 — solo Mi red: secciones CALIBRANDO/INACTIVOS, siempre sin puesto (§10.2). En
   *  cualquier otro ámbito quedan ocultas (el universo mock es siempre elegible). */
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

  /** V03.5.1 (§3.5) — utilidad "Ocultos (N)": solo visible en Mi red, solo con al menos un
   *  oculto (nunca mezclado al final de la clasificación normal). */
  function renderRankingHiddenButton(view) {
    const btn = $('#ranking-hidden-btn');
    const count = view.hiddenCount || 0;
    if (view.isTerritorial || count === 0) { btn.hidden = true; return; }
    btn.hidden = false;
    $('#ranking-hidden-count').textContent = String(count);
  }

  /** Backend Bloque 7 (Fase 5) — `computeRankingView()` ahora es async (RPCs reales en modo
   *  server-backed): `rankingRequestToken` descarta una respuesta tardía si el usuario ya
   *  cambió de filtro/ámbito/búsqueda antes de que esta terminara (mismo criterio que
   *  `renderPlayerSearchResultsServerBacked`) — nunca pinta un resultado viejo encima de un
   *  filtro nuevo. `serverError` (RPC realmente falló, nunca "sin datos todavía") muestra un
   *  estado real, nunca cae a mocks (handoff Fase 5 §9). */
  /** RPC realmente fallida (red, rate limit, error inesperado) — nunca "todavía sin edición
   *  publicada" (eso es un estado válido que resuelven view.density/view.selfStatus más abajo,
   *  no un error). Pinta directo el estado, sin pasar por renderRankingStateCard: esa función
   *  decide entre varios estados a partir de un `view` completo/coherente, y un error de red no
   *  tiene ninguno de los datos que esa lógica necesita. */
  function renderRankingErrorCard() {
    $('#ranking-global-blocked').hidden = true;
    $('#ranking-filters-row').hidden = false;
    $('#ranking-search-toggle-btn').hidden = false;
    $('#ranking-state-title').textContent = 'NO PUDIMOS CARGAR EL RANKING';
    $('#ranking-state-text').textContent = 'Probá de nuevo en un momento.';
    $('#ranking-state-cta').hidden = true;
    rankingStateCtaAction = null;
    $('#ranking-state-card').hidden = false;
    $('#ranking-normal-content').hidden = true;
  }

  async function renderRankingContent() {
    const myToken = ++rankingRequestToken;
    const view = await computeRankingView();
    if (myToken !== rankingRequestToken) return;
    rankingLastView = view;
    if (view.serverError) { renderRankingErrorCard(); return; }
    renderRankingStateCard(view);
    if (view.globalBlocked || $('#ranking-normal-content').hidden) return;
    renderRankingMyPosition(view);
    renderRankingClassification(view);
    renderRankingUnrankedSections(view);
    renderRankingHiddenButton(view);
  }

  function onRankingFilterChanged() {
    rankingLoadedBlocks = 1;
    rankingSearchQuery = '';
    $('#ranking-search-input').value = '';
    renderRankingContent();
  }

  /** Backend Bloque 7 (Fase 5) — en modo server-backed, `p_search` viaja a
   *  `get_ranking_classification` (búsqueda real, no solo sobre la página ya cargada); un
   *  debounce de 300ms (mismo valor que `onProfileLocationSearchInput`) evita una llamada por
   *  tecla. En modo local (mock/sin backend), sin cambios: sigue siendo instantáneo sobre datos
   *  ya en memoria. */
  function onRankingSearchInput(value) {
    rankingSearchQuery = (value || '').trim();
    clearTimeout(rankingSearchDebounceTimer);
    const user = Store.getCurrentUser();
    if (Auth.isConfigured() && user && user.serverBacked) {
      rankingSearchDebounceTimer = setTimeout(renderRankingContent, 300);
      return;
    }
    renderRankingContent();
  }

  /** §8.2 — tocar la tarjeta TU POSICIÓN salta directo al bloque de 50 que contiene la
   *  posición del usuario (nunca obliga a tocar "cargar más" varias veces desde el puesto 1) y
   *  la resalta con scroll suave, centrada cuando sea posible. Sale de cualquier búsqueda
   *  activa — el objetivo es ubicarse en la clasificación completa, no en un recorte de
   *  resultados que podría ni incluirla. Reemplaza el botón VERME EN LA CLASIFICACIÓN y el
   *  bloque CERCA TUYO de V03.5, ambos eliminados. */
  async function locateMeInRanking() {
    const view = rankingLastView || await computeRankingView();
    if (!view.myEntry) return;
    if (rankingSearchOpen) closeRankingSearch();
    const targetBlocks = RK.blockForPosition(view.myEntry.position);
    if (targetBlocks > rankingLoadedBlocks) {
      rankingLoadedBlocks = targetBlocks;
      await renderRankingContent();
    }
    requestAnimationFrame(() => {
      const el = $('#ranking-list .ranking-row.is-me');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function loadMoreRanking() {
    rankingLoadedBlocks += 1;
    renderRankingContent();
  }

  /** V03.5.1 (§6.1) — la lupa del header abre/cierra el buscador (ya no un bloque permanente).
   *  Reutiliza exactamente la misma lógica (RK.filterEntriesBySearch/onRankingSearchInput). */
  function openRankingSearch() {
    rankingSearchOpen = true;
    $('#ranking-search-bar').hidden = false;
    // BRAMUlab_V03.5.2 (§7) — lupa en lima mientras la búsqueda está activa/abierta.
    $('#ranking-search-toggle-btn').classList.add('is-active');
    setTimeout(() => $('#ranking-search-input').focus(), 60);
  }
  function closeRankingSearch() {
    rankingSearchOpen = false;
    $('#ranking-search-bar').hidden = true;
    $('#ranking-search-toggle-btn').classList.remove('is-active');
    rankingSearchQuery = '';
    $('#ranking-search-input').value = '';
    clearTimeout(rankingSearchDebounceTimer);
    renderRankingContent();
  }
  function toggleRankingSearch() { if (rankingSearchOpen) closeRankingSearch(); else openRankingSearch(); }

  /** V03.5.1 (§3.4/§3.5) — "Ocultar de Mi red": preferencia personal, nunca borra nada. `ref`
   *  acepta un nombre plano (universo local, `Store.hideNetworkPlayer`) o `{name, playerId}`
   *  (Backend Bloque 7 Fase 5 — fila server-backed, `set_ranking_network_hidden`, mismo criterio
   *  que `openPlayerPublicProfile`). Mismo toast breve que agregar/quitar de JUGADORES. */
  async function hideNetworkPlayerAction(ref) {
    const isRefObj = ref && typeof ref === 'object';
    const playerId = isRefObj ? ref.playerId : null;
    if (playerId && Auth.isConfigured()) {
      const result = await RK.setRankingNetworkHidden(playerId, true);
      if (!result.ok) { showToast('No pudimos ocultar a este jugador. Probá de nuevo.', 2600); return; }
      showToast('Oculto de Mi red');
      renderRankingContent();
      return;
    }
    const user = Store.getCurrentUser();
    if (!user) return;
    Store.hideNetworkPlayer(user.id, isRefObj ? ref.name : ref);
    showToast('Oculto de Mi red');
    renderRankingContent();
  }

  /** Backend Bloque 7 (Fase 5) — en modo server-backed lee `rankingLastView.hiddenRows`
   *  (get_ranking_network ya los trae, no existe un RPC propio de "solo los ocultos") en vez de
   *  `Store.loadHiddenNetworkPlayers`; restaurar llama `set_ranking_network_hidden(id, false)`.
   *  Modo local, sin cambios. */
  function renderRankingHiddenSheet() {
    const serverBackedNetwork = rankingLastView && rankingLastView.serverMode && !rankingLastView.isTerritorial;
    const list = $('#ranking-hidden-list');
    const empty = $('#ranking-hidden-empty');

    if (serverBackedNetwork) {
      const hiddenRows = rankingLastView.hiddenRows || [];
      if (!hiddenRows.length) { list.hidden = true; list.innerHTML = ''; empty.hidden = false; return; }
      empty.hidden = true;
      list.hidden = false;
      list.innerHTML = hiddenRows.map((row) => `<div class="group-table__row ranking-row ranking-row--static">
        ${buildGroupAvatarHTML(row.displayName)}
        <span class="group-table__info">
          <span class="group-table__name">${escapeHtml(row.displayName)}</span>
          <span class="group-table__handle ranking-row__handle">${escapeHtml(row.username ? `@${row.username}` : buildPlayerHandle(row.displayName))}</span>
        </span>
        <button type="button" class="btn-mini ranking-restore-btn" data-player-id="${escapeHtml(row.playerId)}">MOSTRAR</button>
      </div>`).join('');
      $all('#ranking-hidden-list .ranking-restore-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const result = await RK.setRankingNetworkHidden(btn.dataset.playerId, false);
          if (!result.ok) { showToast('No pudimos restaurar a este jugador. Probá de nuevo.', 2600); return; }
          showToast('De vuelta en Mi red');
          await renderRankingContent();
          renderRankingHiddenSheet();
        });
      });
      return;
    }

    const user = Store.getCurrentUser();
    const hidden = user ? Store.loadHiddenNetworkPlayers(user.id) : [];
    if (!hidden.length) { list.hidden = true; list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = hidden.map((name) => {
      const account = buildGroupRowAccount(name);
      const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(name);
      return `<div class="group-table__row ranking-row ranking-row--static">
        ${buildGroupAvatarHTML(name)}
        <span class="group-table__info">
          <span class="group-table__name">${escapeHtml(name)}</span>
          <span class="group-table__handle ranking-row__handle">${escapeHtml(handle)}</span>
        </span>
        <button type="button" class="btn-mini ranking-restore-btn" data-name="${escapeHtml(name)}">MOSTRAR</button>
      </div>`;
    }).join('');
    $all('#ranking-hidden-list .ranking-restore-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = Store.getCurrentUser();
        if (!u) return;
        Store.unhideNetworkPlayer(u.id, btn.dataset.name);
        showToast('De vuelta en Mi red');
        renderRankingHiddenSheet();
        renderRankingContent();
      });
    });
  }
  function openRankingHiddenSheet() {
    renderRankingHiddenSheet();
    $('#ranking-hidden-sheet-scrim').hidden = false;
    requestAnimationFrame(() => $('#ranking-hidden-sheet-scrim').classList.add('is-open'));
  }
  function closeRankingHiddenSheet() {
    $('#ranking-hidden-sheet-scrim').classList.remove('is-open');
    setTimeout(() => { $('#ranking-hidden-sheet-scrim').hidden = true; }, 220);
  }

  /** §8.3 — "↑ Ir al inicio": aparece solo lejos del inicio de la clasificación, smooth scroll
   *  hacia arriba DENTRO de la pantalla (nunca recarga). */
  function initRankingScrollTop() {
    const scrollEl = $('#ranking-scroll');
    const btn = $('#ranking-scrolltop-btn');
    scrollEl.addEventListener('scroll', () => { btn.hidden = scrollEl.scrollTop < 400; });
    btn.addEventListener('click', () => scrollEl.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /** §3.1/§4.1 — ámbito Local y género del usuario actual por defecto, precargados UNA sola
   *  vez (primera apertura): si el usuario ya tocó los desplegables, reabrir la pantalla no
   *  debe pisarle la elección — mismo criterio que ya usaba la banda en V03.5. */
  function renderRankingScreen() {
    renderRankingScopeTabs();
    if (!rankingGenderInitialized) {
      rankingGenderFilter = rankingEffectiveGender(Store.getCurrentUser());
      rankingGenderInitialized = true;
    }
    renderRankingGenderTrigger();
    renderRankingBandTrigger();
    if (rankingSearchOpen) closeRankingSearch();
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
    $('#ranking-my-position-card').addEventListener('click', locateMeInRanking);
    $('#ranking-gender-trigger').addEventListener('click', () => openProfilePickerSheet(rankingGenderPickerConfig()));
    $('#ranking-band-trigger').addEventListener('click', () => openProfilePickerSheet(rankingBandPickerConfig()));
    $('#ranking-search-toggle-btn').addEventListener('click', toggleRankingSearch);
    $('#ranking-search-close-btn').addEventListener('click', closeRankingSearch);
    $('#ranking-load-more-btn').addEventListener('click', loadMoreRanking);
    $('#ranking-search-input').addEventListener('input', (e) => onRankingSearchInput(e.target.value));
    // Bloque 3 — CTA de #ranking-state-card: una sola acción guardada en rankingStateCtaAction,
    // reasignada en cada render (ver renderRankingStateCard/selfStatusCopy/territorialDensityCopy).
    $('#ranking-state-cta').addEventListener('click', () => { if (rankingStateCtaAction) rankingStateCtaAction(); });
    $('#ranking-help-btn').addEventListener('click', openRankingHelpSheet);
    $('#ranking-help-sheet-close').addEventListener('click', closeRankingHelpSheet);
    $('#ranking-help-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#ranking-help-sheet-scrim')) closeRankingHelpSheet(); });
    $('#ranking-hidden-btn').addEventListener('click', openRankingHiddenSheet);
    $('#ranking-hidden-sheet-close').addEventListener('click', closeRankingHiddenSheet);
    $('#ranking-hidden-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#ranking-hidden-sheet-scrim')) closeRankingHiddenSheet(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#ranking-help-sheet-scrim').hidden) closeRankingHelpSheet();
      if (!$('#ranking-hidden-sheet-scrim').hidden) closeRankingHiddenSheet();
    });
    initRankingScrollTop();
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
    const fullHistory = getComputableHistory();
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
    // BRAMUlab_V03.6 (hotfix — bug real §2) — mismo criterio que buildPlayerRowHTML: @usuario
    // real si hay cuenta vinculada, nunca fabricado desde el nombre.
    const account = buildGroupRowAccount(name);
    const handle = account && account.username ? `@${account.username}` : buildPlayerHandle(name);
    return `<button type="button" class="player-row group-picker-row${selected ? ' is-selected' : ''}" data-name="${escapeHtml(name)}">
      <span class="group-picker-row__check" aria-hidden="true">${checkSvg}</span>
      <span class="player-row__avatar">${escapeHtml(playerInitials(name))}</span>
      <span class="player-row__info">
        <span class="player-row__name">${escapeHtml(name)}</span>
        <span class="player-row__handle">${escapeHtml(handle)}</span>
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
    const history = getDisplayHistory();
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
      n, computePlayerRowLevel(history, n), createGroupSelectedNames.indexOf(Store.normalizePlayerName(n)) !== -1
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
  /** BRAMUlab_V03.10 (§2) — identidad segura para una fila de Compañeros/Rivales. `p.userId`
   *  (agregado en player-home.js) es AUTORITATIVO Y EXCLUSIVO cuando existe (V03.0): resuelve
   *  por `Store.getUserById` directo, nunca por nombre — así dos cuentas reales con el mismo
   *  nombre visible jamás muestran el @username de la otra. Sin `userId` (registro legacy), cae
   *  al fallback de nombre ya existente en el proyecto (mismo criterio que
   *  `buildGroupRowAccount`), pero SOLO cuenta como resolución "segura" si hay EXACTAMENTE una
   *  cuenta real con ese nombre visible — con dos o más, la identidad es ambigua y se prefiere
   *  no mostrar nada antes que arriesgar el username equivocado (nunca inventa ni deriva un
   *  `@username` del nombre, a diferencia de `buildPlayerHandle`, que sí lo hace y por eso NO se
   *  usa acá). */
  function resolvePersonAccount(p) {
    if (p.userId) return Store.getUserById(p.userId);
    const norm = Store.normalizePlayerName(p.name);
    const candidates = Store.loadUsers().filter((u) => u && Store.normalizePlayerName(u.displayName) === norm);
    return candidates.length === 1 ? candidates[0] : null;
  }
  function openPersonListScreen(kind) {
    const cfg = PERSON_LIST_CONFIG[kind];
    $('#companions-title').textContent = cfg.title;
    const matches = PH.filterMatchesForPlayer(getComputableHistory(), currentIdentity());
    const people = kind === 'partners' ? PH.computeTeammateBreakdown(matches, currentIdentity()) : PH.computeRivalBreakdown(matches, currentIdentity());
    const wrap = $('#companions-list');
    const isEmpty = people.length === 0;
    $('#companions-empty').hidden = !isEmpty;
    wrap.hidden = isEmpty;
    // V02.2 (Bloque H, §21) — resumen explícito en palabras completas (nunca "9V 2D") y la
    // efectividad SIEMPRE con su label debajo: nunca un "78%" suelto sin decir qué mide.
    // BRAMUlab_V03.10 (§2) — `Nombre · @username` cuando hay cuenta real resoluble (mismos
    // tokens visuales que MIS GRUPOS: `.group-table__toprow`/`__name`/`__handle`, tomado como
    // referencia visual — sin rediseñar la tarjeta); solo el nombre cuando no la hay. Nunca un
    // `@username` inventado.
    wrap.innerHTML = people.map((p) => {
      const winsLabel = p.wins === 1 ? 'victoria' : 'victorias';
      const lossesLabel = p.losses === 1 ? 'derrota' : 'derrotas';
      const account = resolvePersonAccount(p);
      const handle = account && account.username ? `@${account.username}` : null;
      return `
      <div class="person-list__item" data-name="${escapeHtml(p.name)}">
        <div class="person-list__avatar">${escapeHtml(playerInitials(p.name))}</div>
        <div class="person-list__info">
          <div class="group-table__toprow">
            <span class="group-table__name">${escapeHtml(p.name)}</span>
            ${handle ? `<span class="group-table__handle">· ${escapeHtml(handle)}</span>` : ''}
          </div>
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
    const history = getComputableHistory();
    const filtered = ML.filterPlayerCandidates(allNames, query, []);
    const wrap = $('#jugadores-list');
    const isEmpty = filtered.length === 0;
    wrap.hidden = isEmpty;
    $('#jugadores-search-empty').hidden = !isEmpty;
    wrap.innerHTML = filtered.map((n) => buildPlayerRowHTML(n, computePlayerRowLevel(history, n))).join('');
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
    // Backend Bloque 4 (03_Revision_ChatGPT.md §6) — para una cuenta serverBacked, la
    // autoridad deja de ser el universo local (Store.loadHistory/loadPlayerNames): busca
    // cuentas reales vía search_players. El camino local/legacy queda IDÉNTICO para cualquier
    // otra cuenta (sin backend configurado, o cuenta local V03.0/legacy).
    const currentUser = Store.getCurrentUser();
    if (Auth.isConfigured() && currentUser && currentUser.serverBacked) {
      renderPlayerSearchResultsServerBacked(query);
      return;
    }
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
        recentsWrap.innerHTML = recents.map((n) => buildPlayerRowHTML(n, computePlayerRowLevel(history, n))).join('');
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
    wrap.innerHTML = results.map((n) => buildPlayerRowHTML(n, computePlayerRowLevel(history, n))).join('');
    $all('#player-search-list .player-row').forEach((btn) => {
      btn.addEventListener('click', () => openPlayerPublicProfile(btn.dataset.name, 'search'));
    });

    $('#player-search-empty').hidden = !(isListEmpty && !recentNames.length);
  }

  /** Backend Bloque 4 (03_Revision_ChatGPT.md §5/§6) — variante server-backed: resultados
   *  reales de `search_players` (nunca el universo local), identidad por `player_id`. Sin
   *  Recientes todavía (Decisión 5: sin `matches` compartidos reales — Bloque 5 — no existe una
   *  señal genuina de "con quién compartí cancha" para una cuenta real; se deja vacío/oculto,
   *  nunca tomado del historial local ni inventado). Query < 2 caracteres no llama a la red
   *  (mismo mínimo que ya exige la RPC del lado del servidor, §4 de la revisión). */
  async function renderPlayerSearchResultsServerBacked(query) {
    $('#player-search-recents-section').hidden = true;
    $('#player-search-recents').innerHTML = '';
    $('#player-search-list-label').hidden = true;
    const listSection = $('#player-search-list-section');
    const wrap = $('#player-search-list');
    const emptyEl = $('#player-search-empty');
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      listSection.hidden = true;
      wrap.innerHTML = '';
      emptyEl.hidden = !trimmed;
      emptyEl.textContent = trimmed ? 'Escribí al menos 2 caracteres.' : 'Sin coincidencias.';
      return;
    }
    const result = await Auth.searchPlayers(trimmed);
    // Backend Bloque 4 — si mientras esperaba la respuesta el usuario ya volvió a tipear (o
    // salió de la pantalla), esta respuesta puede llegar tarde. `player-search-input` es la
    // única fuente de verdad de "qué se está buscando ahora"; una respuesta para un query que
    // ya no coincide con el input actual se descarta en vez de pisar resultados más nuevos.
    if (($('#player-search-input').value || '').trim() !== trimmed) return;
    if (!result.ok) {
      listSection.hidden = true;
      wrap.innerHTML = '';
      emptyEl.hidden = false;
      emptyEl.textContent = 'No pudimos buscar en este momento. Probá de nuevo.';
      return;
    }
    const rows = result.players;
    const isEmpty = rows.length === 0;
    listSection.hidden = isEmpty;
    wrap.innerHTML = rows.map(buildPlayerRowHTMLFromServerRow).join('');
    $all('#player-search-list .player-row').forEach((btn) => {
      btn.addEventListener('click', () => openPlayerPublicProfile({ name: btn.dataset.name, playerId: btn.dataset.playerId }, 'search'));
    });
    emptyEl.hidden = !isEmpty;
    emptyEl.textContent = 'Sin coincidencias.';
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

  // Backend Bloque 4 (§4 de la revisión: "el frontend debe usar debounce de búsqueda ~300ms")
  // — SOLO para el camino server-backed, que dispara una llamada de red por tecla; el camino
  // local/legacy sigue filtrando en memoria de forma síncrona, sin ningún cambio.
  let playerSearchDebounceId = null;
  function initPlayerSearchScreen() {
    $('#player-search-back-btn').addEventListener('click', () => openPlayerHome());
    $('#player-search-input').addEventListener('input', (e) => {
      const value = e.target.value;
      const currentUser = Store.getCurrentUser();
      if (Auth.isConfigured() && currentUser && currentUser.serverBacked) {
        clearTimeout(playerSearchDebounceId);
        playerSearchDebounceId = setTimeout(() => renderPlayerSearchResults(value), 300);
        return;
      }
      renderPlayerSearchResults(value);
    });
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
  // Backend Bloque 4 — `player_id` real cuando el perfil se abrió desde un resultado
  // server-backed (search_players/get_public_profile); `null` para el camino local/legacy de
  // siempre (resolución por nombre, ver renderPlayerPublicProfile).
  let playerPublicPlayerId = null;
  let playerPublicOrigin = 'search'; // 'search' | 'jugadores-tab' | 'companions' — a dónde vuelve el back
  let playerPublicWhatsappPhone = null; // BRAMUlab_V03.6 (§5) — teléfono a contactar, solo mientras el botón está visible
  // BRAMUlab_V03.5.1 (§10) — mismo criterio que playerPublicOrigin, pero para Mi Perfil/Mis
  // Datos: null (default) vuelve a Home como siempre; 'ranking' vuelve a Ranking.
  let profileScreenOrigin = null;

  /** §2 — perfil público de `name`: identidad de solo lectura (sin tabs MI PERFIL/MIS DATOS,
   *  sin ningún dato privado) + rendimiento derivado del historial de este dispositivo. Si
   *  `name` corresponde a una cuenta local real (Store.loadUsers — poco común en este
   *  prototipo de un solo dispositivo, pero el modelo ya lo soporta), se muestran sus datos
   *  declarados reales (foto/edad/mano/lado); si es solo un nombre conocido por historial/
   *  selección manual, sin cuenta detrás, esos campos quedan en "—" — nunca inventados. */
  function renderPlayerPublicProfile() {
    const name = playerPublicName;
    if (!name) return;
    // Backend Bloque 4 (03_Revision_ChatGPT.md §6) — "para la UI server-backed, la identidad
    // pasa a ser player_id, no nombre": con un player_id real presente, nunca se re-resuelve
    // por nombre local (eso nunca iba a encontrar a otra persona real de Staging, ver
    // 02_Analisis_Claude.md §1). El camino local/legacy de abajo queda intacto.
    if (playerPublicPlayerId && Auth.isConfigured()) {
      renderPlayerPublicProfileServerBacked(playerPublicPlayerId, name);
      return;
    }
    // Micro-hotfix — renderPlayerPublicProfileServerBacked() oculta meta/Edad/Mano/Lado,
    // Efectividad, performance y AGREGAR JUGADOR (hotfix §4 de
    // 05_Revision_Post_Implementacion_ChatGPT.md); esos `hidden` quedaban pegados si después se
    // navegaba a un perfil LOCAL/legacy en la misma sesión, porque esta rama nunca los
    // restablecía (solo fijaba texto/valores, nunca visibilidad). Se restablece acá la
    // visibilidad original ANTES de que la lógica de siempre decida sus valores — la rama
    // server-backed de arriba no se toca.
    $('#player-public-meta-grid').hidden = false;
    $('#player-public-age').parentElement.hidden = false;
    $('#player-public-hand').parentElement.hidden = false;
    $('#player-public-side').parentElement.hidden = false;
    $('#player-public-effectiveness-card').hidden = false;
    $('#player-public-performance-row').hidden = false;
    $('#player-public-add-btn').hidden = false;
    const history = getComputableHistory();
    const account = Store.loadUsers().find((u) => u && Store.normalizePlayerName(u.displayName) === name);
    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 1) — BUG REAL: esta función consultaba
    // TODO el historial/Nivel pasando `name` (string plano) a player-home.js. Por la regla de
    // integridad de userId (V03.0 — findPlayerRow), una fila de partido YA estampada con
    // userId solo se encuentra buscando por ESE MISMO userId, nunca por nombre — así que
    // cualquier cuenta con partidos reales (todos estampados) aparecía con 0 partidos/0
    // ganados/racha vacía en su propio Perfil público, aunque Home mostrara su historial
    // completo. Mismo criterio que ya usa `currentIdentity()` para self: si hay una cuenta real
    // detrás del nombre, la identidad de consulta es `{name, userId}`, nunca el nombre solo.
    const identity = account ? { name, userId: account.id } : name;
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

    const matches = PH.filterMatchesForPlayer(history, identity);
    // Pre-Production P0.1 (Experiencia_Inicial.md §6) — con 0 partidos oficiales, Perfil
    // público oculta por completo Efectividad/jugados-ganados y la fila Mejor racha/Mejor
    // nivel BRAMU (nunca "0"/"—" mostrado como si fuera un dato real); nunca inventa una
    // posición de Ranking (eso ya lo garantiza renderRankingCardForAccount, sin cambios).
    const hasOfficialMatches = matches.length > 0;
    $('#player-public-effectiveness-card').hidden = !hasOfficialMatches;
    $('#player-public-performance-row').hidden = !hasOfficialMatches;
    if (hasOfficialMatches) {
      const eff = PH.computeEffectivenessTotal(matches, identity);
      renderPlayerPublicEffectivenessDonut(eff);
      $('#player-public-played').textContent = String(matches.length);
      $('#player-public-won').textContent = String(eff.wins);

      const bestStreakRange = PH.computeBestWinStreakRange(matches, identity);
      $('#player-public-best-streak').textContent = bestStreakRange ? `${bestStreakRange.count} ${bestStreakRange.count === 1 ? 'victoria' : 'victorias'}` : '—';
      $('#player-public-best-streak-range').hidden = !bestStreakRange;
      if (bestStreakRange) $('#player-public-best-streak-range').textContent = formatStreakRangeLabel(bestStreakRange.startDate, bestStreakRange.endDate);
    }

    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 2) — BUG REAL: una cuenta real (V03.0,
    // no legacy) sin partidos considerados todavía recibía acá un Nivel simulado por hash
    // (pensado EXCLUSIVAMENTE para jugadores mock/territoriales sin cuenta real detrás, §9 de
    // V03.3) como si fuera un dato real ("NIVEL BRAMU 6.8" para una cuenta 0/5). Mismo gate que
    // ya usa Home/MI PERFIL para self (`isLegacyLevelAccount`, ver renderPlayerCard/
    // renderProfileEvolution): una cuenta real no-legacy NUNCA ve un número de Nivel inventado,
    // solo CALIBRANDO/CALIBRACIÓN COMPLETA con su progreso — el fallback por hash queda
    // reservado exclusivamente a nombres SIN cuenta real detrás (jugadores mock/territoriales
    // de Ranking/Buscar Jugadores, rivales conocidos por historial pero nunca registrados),
    // que siguen viéndolo exactamente igual que antes.
    const evolution = PH.computeLevelEvolution(history, identity);
    const levelSubEl = $('#player-public-level-sub');
    if (PH.isCalibratingRealAccount(account)) {
      // BRAMUlab_V04.9 (§14) — BUG REAL detectado en V04.8: esta rama mostraba "CALIBRANDO · 0/5"
      // para cualquier cuenta real no-legacy, aunque esa persona TODAVÍA no hubiera confirmado su
      // Nivel BRAMU V1 (con el preview activo, el onboarding queda pendiente hasta que la propia
      // cuenta lo confirma — ver openPlayerCardScreen/nivelOnboardingPending). Mismo choke point
      // que ya usa self: `nivelOnboardingPending(account)` es válido acá tal cual (`account` ya
      // pasó `isCalibratingRealAccount`, que garantiza `!account.legacyMigrated`) — nunca inventa
      // un número ni un progreso antes de que la cuenta confirme su Nivel.
      if (nivelOnboardingPending(account)) {
        setLevelValueText('player-public-level-value', 'PENDIENTE', true);
        levelSubEl.hidden = true;
        levelSubEl.textContent = '';
      } else {
        const calib = PH.buildCalibrationStatus(evolution.consideredCount);
        setLevelValueText('player-public-level-value', calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO', true);
        levelSubEl.hidden = calib.complete;
        levelSubEl.textContent = calib.complete ? '' : calib.progressText;
      }
      // "Mejor nivel BRAMU" es otra lectura de la misma serie gateada — nunca un número mientras
      // la cuenta esté pendiente/en calibración (mismo criterio que Home/MI PERFIL, que
      // directamente ocultan esa tarjeta en ese caso).
      $('#player-public-peak-level').textContent = '—';
      $('#player-public-peak-level-context').textContent = '';
    } else {
      const level = PH.computeSimulatedJugadorLevel(history, identity);
      setLevelValueText('player-public-level-value', level.toFixed(1), false);
      levelSubEl.hidden = true;
      // Sin partidos considerados todavía, no hay ningún pico real que mostrar — el "mejor
      // nivel" trivialmente coincide con el actual (simulado), igual que le pasaría a cualquier
      // nombre mock sin historial: ACT, nunca una fecha inventada.
      const peak = evolution.consideredCount > 0 ? PH.computePeakLevel(evolution) : { value: level, isCurrent: true, date: null };
      $('#player-public-peak-level').textContent = peak.value.toFixed(1);
      $('#player-public-peak-level-context').textContent = peak.isCurrent ? 'ACT' : formatPeakLevelDate(peak.date);
    }

    renderPlayerPublicAddButton();
    // BRAMUlab_V03.6 (§5/§8) — botón visible SOLO con teléfono válido + consentimiento
    // explícito (PLIdentity.canContactViaWhatsApp, misma condición que usa el switch de Editar
    // Datos): sin cuenta real detrás (`account` null) nunca hay nada que mostrar. Nunca texto
    // ni placeholder cuando no corresponde (§5 — "no mostrar nada adicional").
    const canContact = PLI.canContactViaWhatsApp(account);
    $('#player-public-whatsapp-btn').hidden = !canContact;
    playerPublicWhatsappPhone = canContact ? account.phone : null;

    renderPlayerPublicRankingCard(account, history);
  }

  /** Backend Bloque 4 (03_Revision_ChatGPT.md §6, hotfix §4 de
   *  05_Revision_Post_Implementacion_ChatGPT.md) — variante server-backed: identidad real
   *  resuelta por `player_id` (`get_public_profile`), nunca por nombre local. Esta pantalla
   *  muestra SIEMPRE identidad + @usuario + Nivel/estado + mano/lado (si existen) — misma regla
   *  vigente que "con 0 partidos oficiales: identidad + Nivel/estado, sin estadísticas
   *  agregadas, evolución ni módulos vacíos".
   *  Pre-Production P0.1 (revisión central 24/09/2026) — Efectividad/jugados-ganados dejan de
   *  ocultarse de forma incondicional: `get_public_profile` ahora agrega `matches_played`/
   *  `matches_won` (partidos `status='validated'` con `winner_team` ya resuelto, ver migración
   *  20260924110000_bloque6_public_match_outcomes.sql) y esta función revela esa tarjeta cuando
   *  `matches_played>0`, igual que el camino local/legacy — nunca inventa datos ni muestra
   *  "0%"/"—" como si fueran evidencia real. `renderPlayerPublicEffectivenessDonut` es la MISMA
   *  función que ya usa esa rama local, nunca una segunda copia del donut.
   *  Siguen OCULTOS por completo (nunca un placeholder "—", fuera de alcance de esta corrección
   *  acotada — ver el informe): Edad (privada para otra persona real), Mejor racha/Mejor nivel
   *  BRAMU histórico (`#player-public-performance-row` pediría un agregado nuevo aparte, no
   *  cubierto por `matches_played`/`matches_won`). También se oculta AGREGAR JUGADOR: esa acción
   *  escribe la lista local histórica por NOMBRE (Store.addPlayerToList), la misma identidad-por-
   *  nombre que esta rama acaba de resolver correctamente por player_id — reintroducirla acá
   *  sería la misma regresión que Bloque 4 vino a corregir. El camino local/legacy
   *  (renderPlayerPublicProfile de arriba) conserva su UI anterior sin ningún cambio. */
  async function renderPlayerPublicProfileServerBacked(playerId, fallbackName) {
    setAvatarPreview('player-public-avatar-img', 'player-public-avatar-initials', null, fallbackName);
    $('#player-public-name').textContent = fallbackName;
    $('#player-public-username').textContent = buildPlayerHandle(fallbackName);
    setLevelValueText('player-public-level-value', '—', false);
    $('#player-public-level-sub').hidden = true;
    $('#player-public-age').parentElement.hidden = true;
    $('#player-public-hand').parentElement.hidden = true;
    $('#player-public-side').parentElement.hidden = true;
    $('#player-public-meta-grid').hidden = true; // se revela más abajo solo si hay mano/lado reales
    $('#player-public-effectiveness-card').hidden = true;
    $('#player-public-performance-row').hidden = true; // Mejor racha/Mejor nivel: fuera de alcance, ver comentario de arriba
    $('#player-public-ranking-card').hidden = true;
    $('#player-public-whatsapp-btn').hidden = true;
    playerPublicWhatsappPhone = null;
    $('#player-public-add-btn').hidden = true;

    const result = await Auth.getPublicProfile(playerId);
    // Si mientras esperaba la respuesta el usuario ya navegó a otro perfil, no pisar esa
    // pantalla con una respuesta tardía de esta.
    if (playerPublicPlayerId !== playerId) return;
    if (!result.ok || !result.profile) {
      showToast('No pudimos cargar este perfil.', 2600);
      return;
    }
    const p = result.profile;
    const name = p.display_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || fallbackName;
    playerPublicName = Store.normalizePlayerName(name);
    // Pre-Production P0.1C (revisión 2) — avatar_signed_url (URL firmada temporal, resuelta por
    // Auth.getPublicProfile a partir de la RUTA privada get_public_profile.avatar_url; el bucket
    // "avatars" es privado desde esta revisión, avatar_url ya no es una URL utilizable directo).
    setAvatarPreview('player-public-avatar-img', 'player-public-avatar-initials', p.avatar_signed_url || null, name);
    $('#player-public-name').textContent = name;
    $('#player-public-username').textContent = p.username ? `@${p.username}` : buildPlayerHandle(name);

    // Pre-Production P0.1C — whatsapp_phone ya viene filtrado server-side (get_public_profile
    // solo lo devuelve con allow_whatsapp_contact=true); PLI.isValidWhatsAppPhone acá es defensa
    // adicional, mismo criterio que el camino local (PLI.canContactViaWhatsApp), nunca una
    // segunda regla de validación.
    const canContact = PLI.isValidWhatsAppPhone(p.whatsapp_phone);
    $('#player-public-whatsapp-btn').hidden = !canContact;
    playerPublicWhatsappPhone = canContact ? p.whatsapp_phone : null;

    const hasHand = !!(p.dominant_hand && HAND_LABELS[p.dominant_hand]);
    const hasSide = !!(p.preferred_side && SIDE_LABELS[p.preferred_side]);
    $('#player-public-hand').parentElement.hidden = !hasHand;
    if (hasHand) $('#player-public-hand').textContent = HAND_LABELS[p.dominant_hand];
    $('#player-public-side').parentElement.hidden = !hasSide;
    if (hasSide) $('#player-public-side').textContent = SIDE_LABELS[p.preferred_side];
    $('#player-public-meta-grid').hidden = !(hasHand || hasSide); // Edad queda SIEMPRE oculta acá

    if (!p.level_status || p.level_status === 'PENDIENTE') {
      setLevelValueText('player-public-level-value', 'PENDIENTE', true);
    } else {
      const levelText = Number.isFinite(p.level_public) ? p.level_public.toFixed(1) : '—';
      setLevelValueText('player-public-level-value', levelText, false);
    }
    $('#player-public-level-sub').hidden = true;

    // Pre-Production P0.1 (revisión central 24/09/2026) — Efectividad/jugados-ganados con
    // evidencia oficial real (ver comentario de cabecera de esta función). `matchesPlayed`/
    // `matchesWon` son enteros agregados server-side, nunca partidos individuales — el mismo
    // cálculo de % que ya usa el camino local (Math.round(wins/considered*100), ver
    // PH.computeEffectivenessTotal) para no tener una segunda fórmula de redondeo.
    const matchesPlayed = Number.isFinite(p.matches_played) ? p.matches_played : 0;
    const matchesWon = Number.isFinite(p.matches_won) ? p.matches_won : 0;
    const hasOfficialMatches = matchesPlayed > 0;
    $('#player-public-effectiveness-card').hidden = !hasOfficialMatches;
    if (hasOfficialMatches) {
      renderPlayerPublicEffectivenessDonut({ pct: Math.round((matchesWon / matchesPlayed) * 100) });
      $('#player-public-played').textContent = String(matchesPlayed);
      $('#player-public-won').textContent = String(matchesWon);
    }
    // Backend Bloque 7 (Fase 5) — Ranking real ya existe (Fases 1-4 aplicadas/validadas en
    // Staging): la tarjeta que hasta acá quedaba forzada `hidden=true` arriba (comentario de
    // Bloque 4, "hasta Bloque 7") ya puede conectarse. Mismo guard de request obsoleta que el
    // resto de esta función — si mientras esperaba la respuesta el usuario navegó a otro
    // perfil, renderRankingCardForAccountServerBacked ni se llama.
    renderRankingCardForAccountServerBacked('player-public-ranking', playerId);
  }

  /** BRAMUlab_V03.7 (parte B) — separador de miles simple ("1.380"), convención argentina; el
   *  universo mock de este prototipo nunca llega a necesitarlo en la práctica (máximo unos
   *  cientos por ámbito) pero la tarjeta debe quedar lista para denominadores grandes. */
  function formatRankingDenominator(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function renderRankingCardScopeCol(idPrefix, scopeKey, scopeResult) {
    const pos = $(`#${idPrefix}-${scopeKey}-pos`);
    const denom = $(`#${idPrefix}-${scopeKey}-denom`);
    const territory = $(`#${idPrefix}-${scopeKey}-territory`);
    // Backend Bloque 7 (Fase 5) — get_profile_ranking_summary puede devolver un objeto de
    // ámbito NO null con `position: null` (fila congelada existe — p. ej. ubicación verificada
    // — pero sin puesto por densidad insuficiente/no elegible ese corte): mismo "—" que la
    // ausencia total de fila, nunca "#null".
    if (!scopeResult || scopeResult.position == null) { pos.textContent = '—'; denom.textContent = ''; territory.textContent = ''; return; }
    pos.textContent = `#${scopeResult.position}`;
    denom.textContent = `de ${formatRankingDenominator(scopeResult.total)}`;
    territory.textContent = scopeResult.territory || '';
  }

  /** BRAMUlab_V03.7 (parte B) / BRAMUlab_V03.8 (§3, Ranking_BRAMU.md §15.1) — tarjeta RANKING
   *  BRAMU compartida entre Perfil público (`idPrefix` = `'player-public-ranking'`) y Mi Perfil
   *  (`idPrefix` = `'mi-perfil-ranking'`): MISMA fuente/lógica para las dos
   *  (RK.computeProfileRankingSummary, ranking.js) — nunca una segunda implementación de
   *  Ranking, ver `renderPlayerPublicRankingCard`/`renderMiPerfilRankingCard` más abajo, que
   *  solo fijan el `idPrefix`. Puramente informativa (nunca clickeable, sin chevrons/hover de
   *  acción/navegación). Las posiciones se calculan respecto de la ubicación DE `account` (el
   *  jugador de ESE perfil), nunca de quien está mirando.
   *
   *  Sin cuenta real detrás del nombre (jugador mock/territorial de Buscar Jugadores/Ranking sin
   *  identidad registrada), la tarjeta se oculta por completo — nunca se inventa un Ranking
   *  oficial para una identidad no resuelta. Con cuenta real pero sin elegibilidad completa
   *  (calibrando, inactivo, sin ubicación, sin género declarado), se muestra un estado simple en
   *  vez de puestos inventados. */
  function renderRankingCardForAccount(idPrefix, account, history) {
    const card = $(`#${idPrefix}-card`);
    if (!account) { card.hidden = true; return; }
    card.hidden = false;
    const summary = RK.computeProfileRankingSummary(account, history, new Date());
    const eligible = summary.status.key === 'elegible' && !!summary.scopes;
    // §"DISEÑO DE LA TARJETA" (V03.7) — solo el rango de fechas a la derecha (sin el prefijo
    // "Ranking semanal ·" que sí usa la pantalla Ranking): más corto, entra junto al título en
    // una sola línea a 375px sin forzar el wrap de "RANKING BRAMU".
    $(`#${idPrefix}-period`).textContent = eligible ? summary.periodLabel : '';
    $(`#${idPrefix}-cols`).hidden = !eligible;
    const statusEl = $(`#${idPrefix}-status`);
    statusEl.hidden = eligible;
    if (!eligible) {
      statusEl.textContent = summary.status.key === 'calibrando' ? 'Completando calibración' : 'Todavía sin posición oficial';
      return;
    }
    renderRankingCardScopeCol(idPrefix, 'local', summary.scopes.local);
    renderRankingCardScopeCol(idPrefix, 'provincial', summary.scopes.provincial);
    renderRankingCardScopeCol(idPrefix, 'pais', summary.scopes.pais);
  }

  function renderPlayerPublicRankingCard(account, history) {
    renderRankingCardForAccount('player-public-ranking', account, history);
  }

  /** BRAMUlab_V03.8 (§3) — misma tarjeta también en Mi Perfil (perfil propio), llamada desde
   *  `renderProfileView`. `user`: `Store.getCurrentUser()` — `null` sin sesión (no debería
   *  ocurrir estando en Mi Perfil, pero `renderRankingCardForAccount` lo maneja igual: oculta la
   *  tarjeta). */
  function renderMiPerfilRankingCard(user, history) {
    if (Auth.isConfigured() && user && user.serverBacked) { renderRankingCardForAccountServerBacked('mi-perfil-ranking', user.id); return; }
    renderRankingCardForAccount('mi-perfil-ranking', user, history);
  }

  /** Backend Bloque 7 (Fase 5) — misma tarjeta (Perfil público y Mi Perfil, Ranking_BRAMU.md
   *  §15.1) sobre `get_profile_ranking_summary` real, para una cuenta `serverBacked`. Nunca
   *  toca RK.computeProfileRankingSummary (local/mock) — es la variante server-backed
   *  equivalente a `renderRankingCardForAccount`, reusa el mismo `renderRankingCardScopeCol`
   *  de siempre. Oculta la tarjeta por completo si la RPC falla o no hay `playerId` — nunca un
   *  estado inventado. */
  async function renderRankingCardForAccountServerBacked(idPrefix, playerId) {
    const card = $(`#${idPrefix}-card`);
    if (!playerId) { card.hidden = true; return; }
    const result = await RK.getProfileRankingSummary(playerId);
    if (!result.ok) { card.hidden = true; return; }
    const summary = result.data;
    card.hidden = false;
    const hasAnyScope = !!(summary.local || summary.provincial || summary.pais);
    $(`#${idPrefix}-period`).textContent = (hasAnyScope && summary.edition)
      ? RK.formatServerPeriodLabel(summary.edition.periodStartAt, summary.edition.periodEndAt) : '';
    $(`#${idPrefix}-cols`).hidden = !hasAnyScope;
    const statusEl = $(`#${idPrefix}-status`);
    statusEl.hidden = hasAnyScope;
    if (!hasAnyScope) { statusEl.textContent = 'Todavía sin posición oficial'; return; }
    const mapScope = (s) => (s ? { position: s.position, total: s.total, territory: s.location } : null);
    renderRankingCardScopeCol(idPrefix, 'local', mapScope(summary.local));
    renderRankingCardScopeCol(idPrefix, 'provincial', mapScope(summary.provincial));
    renderRankingCardScopeCol(idPrefix, 'pais', mapScope(summary.pais));
  }

  /** §10 — accesos: Buscar jugadores, tab JUGADORES, filas de Compañeros/Rivales. `origin`
   *  decide a dónde vuelve el back (§10 no pide un histórico de navegación completo, solo que
   *  volver tenga sentido). */
  function openPlayerPublicProfile(nameOrRef, origin) {
    // Backend Bloque 4 — acepta también `{name, playerId}` (mismo criterio que
    // `PH.filterMatchesForPlayer` ya acepta hace tiempo, ver 02_Analisis_Claude.md §5). Todo
    // call site existente sigue pasando un string plano (camino local/legacy, sin cambios).
    const isRef = nameOrRef && typeof nameOrRef === 'object';
    const name = isRef ? nameOrRef.name : nameOrRef;
    const norm = Store.normalizePlayerName(name);
    if (!norm) return;
    playerPublicName = norm;
    playerPublicPlayerId = isRef ? (nameOrRef.playerId || null) : null;
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
    // BRAMUlab_V03.6 (§6) — un solo toque abre WhatsApp con el mensaje prearmado; nunca un
    // modal de confirmación previo (consolidado §9: "después el contacto debe ser de un
    // toque"). `buildWhatsAppContactUrl` ya devuelve `null` si el teléfono no es válido —
    // defensivo, en la práctica el botón está oculto en ese caso.
    $('#player-public-whatsapp-btn').addEventListener('click', () => {
      const url = PLI.buildWhatsAppContactUrl(playerPublicWhatsappPhone, WHATSAPP_CONTACT_MESSAGE);
      if (url) window.open(url, '_blank', 'noopener');
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
    const matches = name ? PH.filterMatchesForPlayer(getComputableHistory(), currentIdentity()) : [];
    // V03.0.3 (§2) — "la cantidad de partidos puede salir de la cabecera y pasar al bloque de
    // estadísticas": #profile-match-count se retira de la cabecera, el conteo ahora vive en
    // #mi-perfil-played (bloque RENDIMIENTO, más abajo).

    // MI PERFIL — KPIs ya disponibles (misma fuente que el Home, nunca una segunda fórmula).
    // Pre-Production P0.1 (Experiencia_Inicial.md §5.6) — con 0 partidos oficiales, TODO el
    // bloque RENDIMIENTO (Efectividad/jugados/ganados/racha/mejor racha) se oculta por completo
    // en vez de mostrar ceros/"—" como si fueran datos reales; identidad/@usuario/Nivel inicial
    // (fuera de #profile-kpis) nunca se ocultan.
    $('#profile-kpis').hidden = matches.length === 0;
    if (matches.length > 0) {
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
    }

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
    // Pre-Production P0.1C (revisión 2) — para cuentas server-backed, "Categoría actual" muestra
    // profiles.current_category (declarativo, editable desde Editar Datos), NUNCA
    // level_states.declared_category (contexto histórico e inmutable de Nivel, ver auth.js). Las
    // cuentas locales/legacy no tienen ese split: siguen leyendo declaredCategory como siempre.
    const effectiveCategory = user && (user.serverBacked ? user.currentCategory : user.declaredCategory);
    const effectiveCategoryAt = user && (user.serverBacked ? user.currentCategoryAt : user.declaredCategoryAt);
    const categoryLabel = user && CATEGORY_LABELS[effectiveCategory];
    const categoryDate = effectiveCategoryAt ? formatDeclaredCategoryDate(effectiveCategoryAt) : '';
    $('#profile-category').textContent = categoryLabel ? (categoryDate ? `${categoryLabel} · declarada el ${categoryDate}` : categoryLabel) : '—';
    // BRAMUlab_V03.4.1 (§9) — "Bella Vista, Buenos Aires", de solo lectura acá (se edita desde
    // Editar Datos). PLLocations.formatLocationLabel ya maneja el caso sin región.
    $('#profile-location').textContent = (user && user.locality) ? PLLocations.formatLocationLabel(user) : '—';

    // BRAMUlab_V03.6 (§4) — CONTACTO: de solo lectura acá (mismo criterio que el resto de MIS
    // DATOS), la edición vive en Editar Datos.
    $('#profile-data-phone').textContent = (user && user.phone) || '—';
    $('#profile-data-whatsapp-status').textContent = (user && user.allowWhatsAppContact) ? 'Activado' : 'Desactivado';

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
      if (!(user.serverBacked ? user.currentCategory : user.declaredCategory)) missing.push('categoría');
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
    // BRAMUlab_V03.8 (§3, Ranking_BRAMU.md §15.1) — misma tarjeta RANKING BRAMU del Perfil
    // público, ahora también en Mi Perfil: debajo de Mejor racha/Evolución (donde vive "Mejor
    // nivel BRAMU" acá), misma fuente/lógica (RK.computeProfileRankingSummary vía
    // renderRankingCardForAccount) — nunca una segunda implementación de Ranking.
    renderMiPerfilRankingCard(user, getComputableHistory());
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
    // BRAMUlab_V04.4 (Etapa D, bloque 1) — mismo gate y misma fuente que renderPlayerCard:
    // Nivel BRAMU V1 real reemplaza al simulado/provisional en MI PERFIL, nunca convive con
    // él. Reutiliza el bloque `#evolution-calibration` existente (mismo lenguaje visual que ya
    // usan las cuentas V03 en calibración) en vez de crear un bloque paralelo — la diferencia
    // es que acá SÍ hay un número real (levelV1BadgeHTML/roundPublicLevel), no un placeholder.
    // BRAMUlab_V04.9 (§12) — default seguro, mismo criterio que renderPlayerCard: solo el
    // branch V1 CALIBRANDO de abajo la muestra.
    $('#mi-perfil-calibration').hidden = true;
    const levelV1 = currentLevelV1State();
    if (levelV1) {
      $('#evolution-numeric').hidden = true;
      $('#evolution-calibration').hidden = false;
      const isCalibrated = levelV1.state === LV.STATES.CALIBRATED;
      $('#evolution-calibration-state').textContent = isCalibrated ? 'NIVEL CALIBRADO' : 'CALIBRANDO';
      $('#evolution-calibration-progress').hidden = isCalibrated;
      $('#evolution-calibration-progress').textContent = isCalibrated ? '' : `${levelV1.ratedMatches} / ${LVC.PARAMS.CALIBRATION_MIN_MATCHES} PARTIDOS`;
      // BRAMUlab_V04.4 — nunca la nota del simulado (contradiría el número real de arriba).
      $('#evolution-calibration-note-simulado').hidden = true;
      $('#evolution-calibration-note-v1').hidden = false;
      setLevelValueText('mi-perfil-level-value', LV.roundPublicLevel(levelV1.mu).toFixed(1), false);
      // BRAMUlab_V04.9 (§10/§12) — mismo criterio que Home: CALIBRADO conserva la píldora chica
      // de siempre (`#mi-perfil-level-sub`, columna angosta); CALIBRANDO pasa a la fila completa
      // de calibración (`#mi-perfil-calibration`), nunca la píldora ahí.
      const calibEl = $('#mi-perfil-calibration');
      if (isCalibrated) {
        $('#mi-perfil-level-sub').hidden = false;
        $('#mi-perfil-level-sub').innerHTML = levelV1BadgeHTML(levelV1);
        calibEl.hidden = true;
      } else {
        $('#mi-perfil-level-sub').hidden = true;
        $('#mi-perfil-level-sub').innerHTML = '';
        calibEl.hidden = false;
        $('#mi-perfil-calibration-label').textContent = `CALIBRANDO · ${levelV1.ratedMatches} / ${LVC.PARAMS.CALIBRATION_MIN_MATCHES} PARTIDOS`;
        const calibPct = Math.min(100, (levelV1.ratedMatches / LVC.PARAMS.CALIBRATION_MIN_MATCHES) * 100);
        $('#mi-perfil-calibration-bar-fill').style.width = calibPct + '%';
      }
      $('#mi-perfil-level-delta').textContent = '';
      $('#mi-perfil-level-delta').className = 'player-card__level-delta player-card__level-delta--inline player-card__level-delta--flat';
      return;
    }
    $('#evolution-calibration-note-simulado').hidden = false;
    $('#evolution-calibration-note-v1').hidden = true;

    const history = getComputableHistory();
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
      setLevelValueText('mi-perfil-level-value', calib.complete ? 'CALIBRACIÓN COMPLETA' : 'CALIBRANDO', true);
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

    setLevelValueText('mi-perfil-level-value', evolution.current.toFixed(1), false);
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
   *  ambos a MI PERFIL). `origin` — BRAMUlab_V03.5.1 (§10): opcional, 'ranking' cuando se
   *  abre desde Ranking (fila propia o CTA de un estado) para que el back regrese ahí en vez
   *  de a Home — ver profileScreenOrigin/#profile-back-btn. Sin origin (todo el resto de la
   *  app, sin cambios) sigue yendo a Home como siempre. */
  function openProfileScreen(tab, origin) {
    syncCurrentIdentityFromStore();
    if (!currentPlayerName) { openAccessFlow(); return; }
    profileScreenOrigin = origin || null;
    setProfileTab(tab || 'mi-perfil');
    renderProfileView();
    showView('profile');
  }

  /** Backend Bloque 7 (Fase 5, corrección F5-C02 — Ranking_BRAMU.md §13.7.A, corrige la
   *  implementación original de Fase 5 que abría el modal ANTES de entrar a Ranking): para una
   *  cuenta real (`serverBacked`) con backend configurado, faltar localidad/rama competitiva
   *  NUNCA oculta la entrada a Ranking — la pantalla se renderiza y se muestra igual (ver
   *  `openRankingScreen`), y este overlay se superpone ENCIMA para atenuarla/bloquearla, con un
   *  modal simple (copy + CTA) como primer paso. Cuentas locales/legacy o sin backend
   *  configurado no tienen este gate — siguen con el estado `sin-ubicacion` histórico dentro de
   *  la propia pantalla (computeSelfStatus), que ya cubre ese caso para ese modelo (sin rama,
   *  que ahí no existe).
   *  Pre-Production P0.1B (24/09/2026) — Ranking pasa a participación automática: el gate ya NO
   *  pide `ranking_opt_in` (nunca existió un opt-in/opt-out ordinario en la UI real; el campo
   *  queda como compatibilidad legacy server-side, ver Ranking_BRAMU.md §"Actualización del 24
   *  de septiembre"). Solo rama y localidad son datos faltantes reales. */
  function rankingGateMissingFields(user) {
    const missing = [];
    if (!user.competitiveBranch) missing.push('branch');
    if (!user.locality) missing.push('location');
    return missing;
  }

  let rankingGateBranch = null;
  let rankingGateLocation = null;

  function updateRankingGateLocationRowDisplay() {
    $('#ranking-gate-location-value').textContent = rankingGateLocation ? PLLocations.formatLocationLabel(rankingGateLocation) : '—';
  }

  /** Corrección F5-C02 — alterna entre los dos pasos del MISMO overlay (nunca una pantalla
   *  nueva ni un segundo modal): `'intro'` es el estado simple obligatorio al abrir (copy + un
   *  único CTA, sin controles todavía — Ranking_BRAMU.md §13.7.A: "por delante aparece un modal
   *  simple"); `'form'` es el flujo de completado de los 3 datos, que el CTA de 'intro' revela. */
  function showRankingGateStep(step) {
    $('#ranking-gate-step-intro').hidden = step !== 'intro';
    $('#ranking-gate-step-form').hidden = step !== 'form';
  }

  /** Precarga con lo que la cuenta ya tenga (un usuario puede volver a este modal habiendo
   *  completado 2 de los 3 campos en un intento anterior fallido, p. ej. por cooldown de
   *  ubicación) — nunca arranca vacío si ya hay datos reales que reusar.
   *  Corrección F5-C01 — bug real reproducido contra Staging con rollback
   *  (B7_F5_GEOREF_ID_LOSS_REPRODUCED_ROLLBACK_OK, ver 21_Correccion_Fase_5_Claude.md): si la
   *  cuenta ya tenía una ubicación GeoRef verificada, `rankingGateLocation` DEBE incluir
   *  `provinceId`/`localityId` reales (ahora presentes en `Store.getCurrentUser()`, ver
   *  auth.js/fetchOwnProfile) — sin esto, guardar sin tocar el campo de ubicación reenviaba la
   *  misma localidad SIN los IDs GeoRef, y `complete_ranking_profile_data` la reinterpretaba
   *  como `source='manual'`/`verified_for_ranking=false`, degradando una ubicación ya verificada
   *  solo por completar rama/opt-in. */
  function openRankingGateModal() {
    const user = Store.getCurrentUser();
    rankingGateBranch = (user && (user.competitiveBranch === 'F' || user.competitiveBranch === 'M')) ? user.competitiveBranch : null;
    // Corrección F5-C01 — construcción extraída a RK.buildGateLocationFromUser (pura,
    // testeada): antes vivía inline acá SIN provinceId/localityId, ver su comentario en
    // ranking.js para el bug real que esto corrige.
    rankingGateLocation = RK.buildGateLocationFromUser(user);
    resetOptionGroup('ranking-gate-branch-options');
    if (rankingGateBranch) {
      const btn = $(`#ranking-gate-branch-options .option-col[data-value="${rankingGateBranch}"]`);
      if (btn) { btn.classList.add('is-selected'); btn.setAttribute('aria-checked', 'true'); }
    }
    updateRankingGateLocationRowDisplay();
    $('#ranking-gate-error').hidden = true;
    showRankingGateStep('intro');
    $('#ranking-gate-modal-scrim').hidden = false;
    requestAnimationFrame(() => $('#ranking-gate-modal-scrim').classList.add('is-open'));
  }
  function closeRankingGateModal() {
    $('#ranking-gate-modal-scrim').classList.remove('is-open');
    $('#ranking-gate-modal-scrim').hidden = true;
  }

  /** Códigos de excepción tal cual los levanta `complete_ranking_profile_data` (ver
   *  supabase/migrations/20260922140000_bloque7_fase2_ranking_calculation.sql) — mismo criterio
   *  que COMPLETE_PROFILE_ERROR_TEXT para complete_profile.
   *  Pre-Production P0.1B — `ranking_opt_in_required` nunca debería dispararse ya que
   *  `submitRankingGateModal` siempre envía `rankingOptIn: true` (no hay más UI de opt-in);
   *  el texto queda solo como fallback defensivo, igual que `no_player_for_session`/etc. */
  const RANKING_GATE_ERROR_TEXT = {
    ranking_opt_in_required: 'No pudimos guardar tus datos de Ranking. Probá de nuevo.',
    competitive_branch_invalid: 'Elegí tu rama competitiva.',
    location_required: 'Elegí tu localidad principal de juego.',
    location_change_cooldown: 'Ya cambiaste tu ubicación hace poco — vas a poder volver a cambiarla más adelante.',
    profile_incomplete: 'Completá primero tu perfil (nombre y @usuario) antes de entrar al Ranking.',
    no_profile_for_player: 'No pudimos encontrar tu perfil. Probá cerrar sesión y volver a entrar.',
    no_player_for_session: 'Tu sesión expiró. Volvé a iniciar sesión.',
    not_configured: 'No pudimos conectar con el servidor. Probá de nuevo.',
    unknown: 'No pudimos guardar tus datos de Ranking. Probá de nuevo.',
  };

  async function submitRankingGateModal() {
    const errorEl = $('#ranking-gate-error');
    if (!rankingGateBranch) { errorEl.textContent = RANKING_GATE_ERROR_TEXT.competitive_branch_invalid; errorEl.hidden = false; return; }
    if (!rankingGateLocation) { errorEl.textContent = RANKING_GATE_ERROR_TEXT.location_required; errorEl.hidden = false; return; }
    const btn = $('#ranking-gate-save-btn');
    btn.disabled = true;
    const result = await Auth.completeRankingProfileData({
      competitiveBranch: rankingGateBranch,
      // Pre-Production P0.1B — participación automática: ya no existe un toggle de opt-in en
      // la UI, se envía siempre `true` (ver rankingGateMissingFields/openRankingGateModal).
      rankingOptIn: true,
      location: rankingGateLocation,
    });
    btn.disabled = false;
    if (!result.ok) {
      errorEl.textContent = RANKING_GATE_ERROR_TEXT[result.code] || RANKING_GATE_ERROR_TEXT.unknown;
      errorEl.hidden = false;
      return;
    }
    // Mismo patrón que runOfficializeAndEnter/openProfileEditModal: recachear desde el servidor
    // antes de seguir, para que Store.getCurrentUser() ya refleje branch/opt-in/ubicación
    // recién guardados (rankingGateMissingFields ya no encuentra nada faltante en el próximo
    // intento, sin necesitar un logout/login).
    const serverUser = await Auth.fetchOwnProfile();
    if (serverUser) Store.cacheServerUser(serverUser);
    closeRankingGateModal();
    // Corrección F5-C02, punto 4 — Ranking ya estaba renderizado DETRÁS del overlay (nunca se
    // "entra" recién acá): solo hace falta refrescar su contenido con los datos ya completos,
    // nunca volver a llamar showView (ya estábamos en 'ranking').
    renderRankingContent();
  }

  function initRankingGateModal() {
    $('#ranking-gate-start-btn').addEventListener('click', () => showRankingGateStep('form'));
    // "AHORA NO"/"VOLVER" — nunca guardan nada parcial (rankingGateBranch/Location solo se
    // envían al servidor dentro de submitRankingGateModal): cerrar el overlay simplemente
    // revela la pantalla Ranking que ya estaba renderizada detrás, tal cual haya quedado
    // (bloqueada por su propio estado "faltan datos" hasta que el usuario complete el gate). El
    // back real (`#ranking-back-btn`, siempre a Home) sigue disponible ahí debajo sin cambios.
    // La clasificación debe permanecer bloqueada mientras falten datos (Ranking_BRAMU.md
    // §13.7.A). "AHORA NO" no desbloquea Ranking: sale de la pantalla y vuelve a Home.
    $('#ranking-gate-dismiss-btn').addEventListener('click', () => {
      closeRankingGateModal();
      openPlayerHome();
    });
    $('#ranking-gate-back-btn').addEventListener('click', () => showRankingGateStep('intro'));
    wireOptionGroup('ranking-gate-branch-options', (v) => { rankingGateBranch = v; });
    $('#ranking-gate-location-row').addEventListener('click', () => openProfileLocationSheet({
      get: () => rankingGateLocation,
      set: (loc) => { rankingGateLocation = loc; },
      onSelect: updateRankingGateLocationRowDisplay,
    }));
    $('#ranking-gate-save-btn').addEventListener('click', submitRankingGateModal);
  }

  /** V03.0.1 (§7) — mismo gate, Ranking no tenía wrapper propio (solo showView('ranking')
   *  inline en initBottomNav) ni gate.
   *  Corrección F5-C02 (Ranking_BRAMU.md §13.7.A) — la pantalla SIEMPRE se renderiza y se
   *  muestra primero (la entrada a Ranking permanece visible aunque falten datos, nunca se
   *  reemplaza por el modal): el gate se evalúa DESPUÉS y, si corresponde, abre el overlay
   *  encima de la pantalla ya visible — nunca antes, nunca en su lugar. */
  function openRankingScreen() {
    if (!currentPlayerName) { openAccessFlow(); return; }
    renderRankingScreen();
    showView('ranking');
    const user = Store.getCurrentUser();
    if (Auth.isConfigured() && user && user.serverBacked && rankingGateMissingFields(user).length) {
      openRankingGateModal();
    }
  }

  /** V03.0.3 (§2/§5) — foto editable directamente desde MI PERFIL y MIS DATOS.
   *  Pre-Production P0.1C hotfix (24/09/2026): el camino inline histórico guardaba SIEMPRE
   *  `profilePhoto` solo en Store/localStorage, incluso para cuentas server-backed. Por eso la
   *  foto parecía correcta hasta recargar y después desaparecía: nunca había llegado a Storage
   *  ni a profiles.avatar_url. Para cuentas reales, este mismo affordance ahora usa exactamente
   *  el contrato persistente de P0.1C (Storage privado + update_profile_avatar + refresh real
   *  desde servidor). El camino local/legacy conserva Store.updateUserAccount sin cambios. */
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

      try {
        const dataUrl = await downscaleImageFileToDataUrl(file, 256, 0.7);

        if (user.serverBacked && Auth.isConfigured()) {
          const blob = await (await fetch(dataUrl)).blob();
          const uploadResult = await Auth.uploadAvatar(user.id, blob);
          if (!uploadResult.ok) {
            showToast('No pudimos guardar la foto. Probá de nuevo.');
            return;
          }

          const avatarResult = await Auth.updateProfileAvatar(uploadResult.path);
          if (!avatarResult.ok) {
            showToast('No pudimos guardar la foto. Probá de nuevo.');
            return;
          }

          const serverUser = await Auth.fetchOwnProfile();
          if (!serverUser || !serverUser.profilePhoto) {
            showToast('La foto se subió, pero no pudimos volver a cargarla. Probá de nuevo.');
            return;
          }
          Store.cacheServerUser(serverUser);
          syncCurrentIdentityFromStore();
          refreshAfterAvatarChange('Foto actualizada');
          return;
        }

        Store.updateUserAccount(user.id, { profilePhoto: dataUrl });
        refreshAfterAvatarChange('Foto actualizada');
      } catch (err) {
        showToast('No pudimos guardar la foto. Probá de nuevo.');
      } finally {
        fileInput.value = '';
      }
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
    // BRAMUlab_V03.5.1 (§10) — bug corregido: Ranking → Mi Perfil → Back volvía a Home en vez
    // de a Ranking (a diferencia de Perfil público, que ya funcionaba bien). Mismo criterio
    // que playerPublicOrigin — no cambia el comportamiento normal (default sigue siendo Home).
    $('#profile-back-btn').addEventListener('click', () => {
      const origin = profileScreenOrigin;
      profileScreenOrigin = null;
      if (origin === 'ranking') { showView('ranking'); return; }
      openPlayerHome();
    });
    $('#profile-logout-btn').addEventListener('click', requestLogout);
    $('#profile-complete-access-btn').addEventListener('click', openCompleteAccessModal);
    $('#profile-change-password-btn').addEventListener('click', openChangePasswordScreen);
    $('#profile-edit-btn').addEventListener('click', openProfileEditModal);
    // BRAMUlab_V03.6 (corrección post-QA real, prioridad 5) — DATOS PERSONALES/DEPORTIVOS y
    // CONTACTO pasan a ser tarjetas tappables completas (mismo destino que el lápiz de
    // Identidad, `openProfileEditModal`): tocar cualquier dato de esas 2 tarjetas — WhatsApp,
    // ubicación, categoría, etc. — abre Editar Datos, no depende solo del ícono. `stopPropagation`
    // en el lápiz propio de cada tarjeta evita un segundo llamado redundante por burbujeo (mismo
    // click abriría la pantalla dos veces seguidas si no se corta acá).
    $('#mis-datos-personal-card').addEventListener('click', openProfileEditModal);
    $('#mis-datos-personal-edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openProfileEditModal(); });
    $('#mis-datos-contact-card').addEventListener('click', openProfileEditModal);
    $('#mis-datos-contact-edit-btn').addEventListener('click', (e) => { e.stopPropagation(); openProfileEditModal(); });
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
  let profileEditBranch = null; // Pre-Production P0.1C — 'F' | 'M' | null, mismo criterio de reset que hand/side/gender.
  let profileEditAllowWhatsApp = false; // BRAMUlab_V03.6 (§3) — `false` por defecto, mismo criterio de reset que hand/side/gender.

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
    // Pre-Production P0.1C — misma mecánica de hoja/fila que las 4 de arriba; el guardado real
    // (junto con ubicación) pasa por complete_ranking_profile_data, nunca por complete_profile
    // (ver submitServerBackedProfileEdit).
    branch: { title: 'RAMA COMPETITIVA', labels: BRANCH_LABELS, rowValueId: 'profile-edit-branch-value', get: () => profileEditBranch, set: (v) => { profileEditBranch = v; } },
  };

  function updateProfileSelectRowDisplay(fieldKey) {
    const field = PROFILE_PICKER_FIELDS[fieldKey];
    const value = field.get();
    $(`#${field.rowValueId}`).textContent = value ? field.labels[value] : '—';
  }

  function updateProfileLocationRowDisplay() {
    $('#profile-edit-location-value').textContent = profileEditLocation ? PLLocations.formatLocationLabel(profileEditLocation) : '—';
  }

  /** BRAMUlab_V03.6 (§4) — refleja `profileEditAllowWhatsApp` en el switch visual + a11y. */
  function updateProfileWhatsappToggleDisplay() {
    const btn = $('#profile-edit-whatsapp-toggle');
    btn.classList.toggle('is-on', profileEditAllowWhatsApp);
    btn.setAttribute('aria-checked', String(profileEditAllowWhatsApp));
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
    // Pre-Production P0.1C (revisión 2) — para server-backed, precarga profiles.current_category
    // (editable, ver submitServerBackedProfileEdit); las cuentas locales/legacy siguen usando
    // declaredCategory como siempre (sin ese split, ver auth.js).
    profileEditCategory = (user.serverBacked ? user.currentCategory : user.declaredCategory) || null;
    profileEditLocation = user.locality ? { locality: user.locality, region: user.region || null, country: user.country || null } : null;
    profileEditBranch = user.competitiveBranch || null;
    profileEditAllowWhatsApp = !!user.allowWhatsAppContact;
    $('#profile-edit-phone').value = user.phone || '';
    $('#profile-edit-whatsapp-hint').hidden = true;
    updateProfileWhatsappToggleDisplay();
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
    updateProfileSelectRowDisplay('branch');
    updateProfileLocationRowDisplay();
    // Pre-Production P0.1C — reemplaza el bloqueo general de Bloque 2 (guardado real ahora
    // conectado, ver submitServerBackedProfileEdit): para una cuenta server-backed, @usuario
    // queda fijo (username_locked server-side, Backend_Infraestructura.md §5.2 — nunca se ofrece
    // como editable si el servidor lo va a rechazar). Revisión 2 (24/09/2026) — Categoría actual
    // deja de estar bloqueada: pasa a editar profiles.current_category (dato declarativo propio
    // de Perfil, nunca level_states.declared_category — ver auth.js/submitServerBackedProfileEdit),
    // así que ya no hay motivo para deshabilitar esa fila. El resto de los campos ya era editable.
    const serverBacked = !!user.serverBacked;
    $('#profile-edit-username').disabled = serverBacked;
    $('#profile-edit-error').textContent = '';
    $('#profile-edit-error').hidden = true;
    $all('#profile-edit-form button[type="submit"]').forEach((btn) => { btn.disabled = false; btn.textContent = 'GUARDAR'; });
    showView('edit-data');
  }

  /** BRAMUlab_V03.4.1 (§10) — hoja única de selección, reutilizada para Género/Mano dominante/
   *  Lado habitual/Categoría (ver PROFILE_PICKER_FIELDS). Tocar una opción la selecciona Y
   *  cierra la hoja en el mismo toque — elección única, sin paso de "confirmar" aparte. */
  /** BRAMUlab_V03.5.1 (§4.2/§5.1) — generalizado para aceptar también un config crudo
   *  `{title,labels,get,set,onSelect}` además de una key de PROFILE_PICKER_FIELDS (uso
   *  original, sin cambios en sus 4 call sites): mismo sheet/DOM, mismo comportamiento — el
   *  desplegable compacto de género/nivel de Ranking reutiliza exactamente esto en vez de un
   *  picker nuevo. `onSelect`, si el config lo trae, reemplaza al
   *  `updateProfileSelectRowDisplay(fieldKey)` propio de Perfil (que no aplicaría a un config
   *  crudo sin `rowValueId`). */
  function openProfilePickerSheet(fieldKeyOrConfig) {
    const field = typeof fieldKeyOrConfig === 'string' ? PROFILE_PICKER_FIELDS[fieldKeyOrConfig] : fieldKeyOrConfig;
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
        if (field.onSelect) field.onSelect(); else updateProfileSelectRowDisplay(fieldKeyOrConfig);
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
    $('#profile-location-manual-trigger').hidden = true;
    hideProfileLocationManualForm();
  }

  /** BRAMUlab_V04.10 (§3) — "No encuentro mi ubicación": carga manual mínima (Localidad +
   *  Provincia) para cuando la búsqueda no encuentra nada, ubicación sigue siendo obligatoria.
   *  Reusa `PLLocations.buildManualLocation` (pura, testeada) — nunca arma el objeto acá. */
  function resetProfileLocationManualForm() {
    $('#profile-location-manual-locality').value = '';
    $('#profile-location-manual-region').value = '';
    $('#profile-location-manual-error').hidden = true;
  }
  function showProfileLocationManualForm() {
    resetProfileLocationManualForm();
    $('#profile-location-list').hidden = true;
    $('#profile-location-empty').hidden = true;
    $('#profile-location-manual-trigger').hidden = true;
    $('#profile-location-manual').hidden = false;
    setTimeout(() => $('#profile-location-manual-locality').focus(), 60);
  }
  function hideProfileLocationManualForm() {
    $('#profile-location-manual').hidden = true;
  }
  function submitProfileLocationManualForm() {
    const loc = PLLocations.buildManualLocation($('#profile-location-manual-locality').value, $('#profile-location-manual-region').value);
    if (!loc) {
      $('#profile-location-manual-error').textContent = 'Completá localidad y provincia.';
      $('#profile-location-manual-error').hidden = false;
      return;
    }
    activeLocationTarget.set(loc);
    activeLocationTarget.onSelect();
    closeProfileLocationSheet();
  }

  function paintProfileLocationList(results) {
    const wrap = $('#profile-location-list');
    const isEmpty = results.length === 0;
    wrap.hidden = isEmpty;
    $('#profile-location-empty').hidden = !isEmpty;
    $('#profile-location-manual-trigger').hidden = !isEmpty;
    hideProfileLocationManualForm();
    const current = activeLocationTarget.get();
    wrap.innerHTML = results.map((loc) => {
      const label = PLLocations.formatLocationLabel(loc);
      const selected = !!current && current.locality === loc.locality && current.region === loc.region;
      // Backend Bloque 2 — localityId/provinceId (GeoRef) viajan como data-* además de
      // locality/region/country, para que el click de abajo los pueda reconstruir: son lo único
      // que distingue una ubicación GeoRef real de una manual (ver find-or-create de
      // complete_profile en supabase/migrations/20260916180000_...sql).
      return `<button type="button" class="picker-sheet-option${selected ? ' is-selected' : ''}" data-locality="${escapeHtml(loc.locality)}" data-region="${escapeHtml(loc.region || '')}" data-country="${escapeHtml(loc.country || '')}" data-locality-id="${escapeHtml(loc.localityId || '')}" data-province-id="${escapeHtml(loc.provinceId || '')}">
        <span>${escapeHtml(label)}</span>
        ${selected ? '<span class="picker-sheet-option__check" aria-hidden="true">✓</span>' : ''}
      </button>`;
    }).join('');
    $all('#profile-location-list .picker-sheet-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeLocationTarget.set({
          locality: btn.dataset.locality, region: btn.dataset.region || null, country: btn.dataset.country || null,
          localityId: btn.dataset.localityId || null, provinceId: btn.dataset.provinceId || null,
        });
        activeLocationTarget.onSelect();
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

  // BRAMUlab_V03.6 (corrección post-QA real, prioridad 4) — target por defecto: Editar Datos
  // (`profileEditLocation`), único uso hasta esta ronda. `openProfileLocationSheet(config)`
  // ahora acepta un config crudo `{get,set,onSelect}` — mismo criterio ya usado por
  // `openProfilePickerSheet` para reutilizar UNA sola hoja en vez de duplicarla (acá, para que
  // el paso 3 del alta reutilice exactamente la misma hoja/búsqueda GeoRef sin copiar nada).
  let activeLocationTarget = { get: () => profileEditLocation, set: (loc) => { profileEditLocation = loc; }, onSelect: updateProfileLocationRowDisplay };

  function openProfileLocationSheet(config) {
    activeLocationTarget = config || { get: () => profileEditLocation, set: (loc) => { profileEditLocation = loc; }, onSelect: updateProfileLocationRowDisplay };
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
    $('#profile-edit-branch-row').addEventListener('click', () => openProfilePickerSheet('branch'));
    $('#profile-picker-sheet-close').addEventListener('click', closeProfilePickerSheet);
    $('#profile-picker-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#profile-picker-sheet-scrim')) closeProfilePickerSheet(); });

    // BRAMUlab_V03.6 — wrapper obligatorio: `openProfileLocationSheet` ahora acepta un
    // `config` opcional (ver arriba); pasarla directo como listener filtraría el propio evento
    // de click como si fuera ese config.
    $('#profile-edit-location-row').addEventListener('click', () => openProfileLocationSheet());
    $('#profile-location-sheet-close').addEventListener('click', closeProfileLocationSheet);
    $('#profile-location-sheet-scrim').addEventListener('click', (e) => { if (e.target === $('#profile-location-sheet-scrim')) closeProfileLocationSheet(); });
    $('#profile-location-search').addEventListener('input', (e) => onProfileLocationSearchInput(e.target.value));
    $('#profile-location-manual-trigger').addEventListener('click', showProfileLocationManualForm);
    $('#profile-location-manual-save').addEventListener('click', submitProfileLocationManualForm);

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#profile-picker-sheet-scrim').hidden) closeProfilePickerSheet();
      if (!$('#profile-location-sheet-scrim').hidden) closeProfileLocationSheet();
    });
  }

  /** Pre-Production P0.1C — errores de complete_contact_profile_data/update_profile_avatar en
   *  español. `location_change_cooldown`/`competitive_branch_invalid`/`location_required` de
   *  complete_ranking_profile_data reusan RANKING_GATE_ERROR_TEXT (mismos códigos exactos, ver
   *  el gate de Ranking) — nunca un segundo texto para el mismo código. */
  const PROFILE_CONTACT_AVATAR_ERROR_TEXT = {
    whatsapp_phone_invalid: 'Para permitir contacto por WhatsApp, cargá primero un número de WhatsApp válido.',
    avatar_path_invalid: 'No pudimos guardar la foto. Probá de nuevo.',
    current_category_invalid: 'Esa categoría no es válida. Probá de nuevo.',
    not_configured: 'No pudimos conectar con el servidor. Probá de nuevo.',
    unknown: 'No pudimos guardar ese dato. Probá de nuevo.',
  };

  /** Pre-Production P0.1C — camino real de guardado para cuentas server-backed. Reutiliza los
   *  contratos ya existentes (nunca un segundo sistema de Perfil):
   *  - complete_profile (Bloque 2/3): nombre/apellido/nombre visible/fecha/género/mano/lado.
   *    @usuario SIEMPRE se envía sin cambios (fijo, ver openProfileEditModal) — nunca dispara
   *    username_locked.
   *  - complete_ranking_profile_data (Bloque 7): rama + ubicación, SOLO si alguna de las dos
   *    cambió — misma RPC exacta que ya usa el gate de Ranking, con su mismo cooldown de 30
   *    días. Ambas viajan juntas porque la RPC siempre escribe las dos together (nunca una
   *    actualización parcial) — si falta la otra, se avisa sin bloquear el resto del guardado.
   *  - complete_contact_profile_data (NUEVA): teléfono + consentimiento WhatsApp, solo si alguno
   *    cambió.
   *  - Storage (avatars) + update_profile_avatar (NUEVA): solo si la foto cambió (nueva o
   *    quitada) — sube/borra el archivo real ANTES de persistir la referencia.
   *  Cada paso es independiente: un error en uno (p. ej. cooldown de ubicación) no impide que
   *  el resto de los cambios se guarde — nunca "todo o nada" por un solo campo, consistente con
   *  que cada RPC ya es su propia transacción atómica. Al final siempre se refresca el perfil
   *  real desde el servidor (nunca se confía en un cache optimista como única verdad, handoff
   *  §9). */
  async function submitServerBackedProfileEdit(user) {
    const displayName = normalizePlayerName($('#profile-edit-display-name').value);
    const firstName = $('#profile-edit-first-name').value.trim();
    const phone = $('#profile-edit-phone').value.trim();
    const errorEl = $('#profile-edit-error');
    errorEl.hidden = true;
    errorEl.textContent = '';

    if (!firstName) { errorEl.textContent = 'Ingresá al menos tu nombre.'; errorEl.hidden = false; return; }
    if (!displayName) { errorEl.textContent = 'El nombre visible no puede quedar vacío.'; errorEl.hidden = false; return; }
    if (profileEditAllowWhatsApp && !PLI.isValidWhatsAppPhone(phone)) {
      errorEl.textContent = 'Para permitir contacto por WhatsApp, cargá primero un número de WhatsApp válido.';
      errorEl.hidden = false;
      return;
    }

    const saveBtn = $all('#profile-edit-form button[type="submit"]')[0];
    $all('#profile-edit-form button[type="submit"]').forEach((btn) => { btn.disabled = true; });
    if (saveBtn) saveBtn.textContent = 'GUARDANDO…';

    const partialErrors = [];

    // 1) Núcleo de Perfil (complete_profile) — @usuario sin cambios, siempre.
    const coreResult = await Auth.completeProfile({
      username: user.username,
      firstName,
      lastName: $('#profile-edit-last-name').value.trim(),
      displayName,
      birthDate: $('#profile-edit-birthdate').value || null,
      gender: profileEditGender,
      dominantHand: profileEditHand,
      preferredSide: profileEditSide,
    });
    if (!coreResult.ok) {
      errorEl.textContent = COMPLETE_PROFILE_ERROR_TEXT[coreResult.code] || COMPLETE_PROFILE_ERROR_TEXT.unknown;
      errorEl.hidden = false;
      $all('#profile-edit-form button[type="submit"]').forEach((btn) => { btn.disabled = false; });
      if (saveBtn) saveBtn.textContent = 'GUARDAR';
      return;
    }

    // 2) Rama + ubicación (complete_ranking_profile_data) — solo si alguna cambió.
    const branchChanged = profileEditBranch !== (user.competitiveBranch || null);
    const locationChanged = JSON.stringify(profileEditLocation) !== JSON.stringify(
      user.locality ? { locality: user.locality, region: user.region || null, country: user.country || null } : null
    );
    if (branchChanged || locationChanged) {
      if (!profileEditBranch || !profileEditLocation) {
        partialErrors.push('Para cambiar rama competitiva o ubicación necesitás completar ambos datos (podés hacerlo también desde Ranking).');
      } else {
        const rankingResult = await Auth.completeRankingProfileData({ competitiveBranch: profileEditBranch, location: profileEditLocation });
        if (!rankingResult.ok) partialErrors.push(RANKING_GATE_ERROR_TEXT[rankingResult.code] || RANKING_GATE_ERROR_TEXT.unknown);
      }
    }

    // 3) Teléfono + consentimiento WhatsApp (complete_contact_profile_data) — solo si cambió.
    const phoneChanged = (phone || null) !== (user.phone || null);
    const whatsappChanged = profileEditAllowWhatsApp !== !!user.allowWhatsAppContact;
    if (phoneChanged || whatsappChanged) {
      const contactResult = await Auth.completeContactProfileData({ phone: phone || null, allowWhatsAppContact: profileEditAllowWhatsApp });
      if (!contactResult.ok) partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[contactResult.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
    }

    // 4) Categoría ACTUAL (update_current_category) — solo si cambió. Pre-Production P0.1C
    // (revisión 2): dato puramente declarativo de Perfil, deliberadamente separado de
    // level_states.declared_category (histórico/inmutable del onboarding, nunca se toca acá) —
    // nunca afecta mu/confidence/evidence_units ni recalcula Nivel.
    const categoryChanged = profileEditCategory !== (user.currentCategory || null);
    if (categoryChanged) {
      const categoryResult = await Auth.updateCurrentCategory(profileEditCategory);
      if (!categoryResult.ok) partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[categoryResult.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
    }

    // 5) Avatar (Storage + update_profile_avatar) — solo si cambió (nueva foto o "quitar foto").
    // Pre-Production P0.1C (revisión 2): uploadAvatar devuelve la RUTA cruda (bucket privado, no
    // hay URL pública) — update_profile_avatar persiste esa ruta tal cual.
    if (profileEditPhotoRemoved) {
      const cleanup = await Auth.removeAvatarFiles(user.id);
      if (cleanup.ok) {
        const avatarResult = await Auth.updateProfileAvatar(null);
        if (!avatarResult.ok) partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[avatarResult.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
      } else {
        partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[cleanup.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
      }
    } else if (profileEditPhotoDataUrl) {
      try {
        const blob = await (await fetch(profileEditPhotoDataUrl)).blob();
        const uploadResult = await Auth.uploadAvatar(user.id, blob);
        if (uploadResult.ok) {
          const avatarResult = await Auth.updateProfileAvatar(uploadResult.path);
          if (!avatarResult.ok) partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[avatarResult.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
        } else {
          partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT[uploadResult.code] || PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
        }
      } catch (err) {
        partialErrors.push(PROFILE_CONTACT_AVATAR_ERROR_TEXT.unknown);
      }
    }

    // Handoff §9 — "al éxito: refrescar perfil desde servidor" (siempre, haya habido errores
    // parciales o no: lo que sí se guardó debe reflejarse igual).
    const serverUser = await Auth.fetchOwnProfile();
    if (serverUser) Store.cacheServerUser(serverUser);
    syncCurrentIdentityFromStore();
    Store.addNotification({
      userId: user.id, type: 'profile_updated', category: 'info',
      title: 'Perfil actualizado', body: 'Guardaste cambios en tus datos.', action: 'profile',
    });
    renderProfileView();
    renderNotificationsBadge();
    showView('profile');
    $all('#profile-edit-form button[type="submit"]').forEach((btn) => { btn.disabled = false; });
    if (saveBtn) saveBtn.textContent = 'GUARDAR';
    showToast(partialErrors.length ? partialErrors[0] : 'Datos guardados');
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

    // BRAMUlab_V03.6 (§4/§8 caso C) — tocar el switch para ACTIVAR sin un teléfono válido
    // cargado todavía no lo enciende: queda apagado y avisa acá mismo, en vez de dejar que la
    // inconsistencia se descubra recién al tocar GUARDAR. Apagarlo siempre está permitido (§2 —
    // "el consentimiento puede revocarse", sin condición).
    $('#profile-edit-phone').addEventListener('input', () => { $('#profile-edit-whatsapp-hint').hidden = true; });
    $('#profile-edit-whatsapp-toggle').addEventListener('click', () => {
      if (!profileEditAllowWhatsApp && !PLI.isValidWhatsAppPhone($('#profile-edit-phone').value)) {
        $('#profile-edit-whatsapp-hint').textContent = 'Para activar el contacto, cargá primero un número de WhatsApp válido.';
        $('#profile-edit-whatsapp-hint').hidden = false;
        return;
      }
      profileEditAllowWhatsApp = !profileEditAllowWhatsApp;
      $('#profile-edit-whatsapp-hint').hidden = true;
      updateProfileWhatsappToggleDisplay();
    });

    $('#profile-edit-cancel').addEventListener('click', () => showView('profile'));
    $('#profile-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = Store.getCurrentUser();
      if (!user) { showView('profile'); return; }
      // Pre-Production P0.1C — cuenta real: persistencia server-side de verdad, nunca el caché
      // local (ver submitServerBackedProfileEdit). El resto de esta función (sin cambios) sigue
      // siendo exclusivo del camino local/legacy.
      if (user.serverBacked) { await submitServerBackedProfileEdit(user); return; }
      const username = $('#profile-edit-username').value.trim();
      const displayName = normalizePlayerName($('#profile-edit-display-name').value);
      const firstName = $('#profile-edit-first-name').value.trim();
      const phone = $('#profile-edit-phone').value.trim();
      let error = null;
      if (!firstName) error = 'Ingresá al menos tu nombre.';
      else if (!displayName) error = 'El nombre visible no puede quedar vacío.';
      else if (!PLI.isValidUsernameFormat(username)) error = '@usuario: entre 3 y 20 caracteres, sin espacios.';
      else if (PLI.isUsernameTaken(username, Store.loadUsers(), user.id)) error = 'Ese @usuario ya está en uso.';
      // BRAMUlab_V03.6 (§8 caso C) — red de seguridad además del bloqueo en el propio switch
      // (arriba): cubre el caso de activarlo con un teléfono válido y luego borrarlo/invalidarlo
      // sin volver a tocar el switch.
      else if (profileEditAllowWhatsApp && !PLI.isValidWhatsAppPhone(phone)) error = 'Para permitir contacto por WhatsApp, cargá primero un número de WhatsApp válido.';
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
        // BRAMUlab_V03.6 (§3) — se guarda tal cual lo tipeó el usuario (solo recortado): la
        // normalización a solo-dígitos (§7) es exclusiva del deep link, nunca del dato guardado
        // — así el usuario sigue viendo/editando su número en el formato que reconoce.
        phone: phone || null,
        allowWhatsAppContact: profileEditAllowWhatsApp,
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

  /* Etapa 2 (§4) — barra inferior fija: Inicio/Historial/+/Ranking/Perfil.
   *  BRAMUlive (2026-09-18) — el "+" vuelve a abrir Cargar partido jugado en forma directa, sin
   *  selector previo: la hoja "Registrar partido" (openRegisterSheet) que decidía entre modo en
   *  vivo y carga manual se retira junto con el registro en vivo, separado a BRAMUlive (ver
   *  Experiencia_Inicial.md §4.1). El atributo `data-nav="manual-load"` se deja igual a
   *  propósito — es solo un identificador interno, no cambia nada visible. */
  function initBottomNav() {
    $all('.bottom-nav__item[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav;
        if (target === 'player-home') openPlayerHome();
        else if (target === 'history') openHistoryScreen('player-home');
        else if (target === 'manual-load') openManualLoadScreen('player-home');
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

  /** BRAMUlive (2026-09-18) — pantalla predeterminada de arranque, ya sin registro en vivo
   *  (separado a BRAMUlive, ver Experiencia_Inicial.md §4.1). Antes reanudaba directo un
   *  partido en vivo activo (`continueActiveMatch`, vista `match` ya retirada) — ahora
   *  cualquier `activeMatch` que haya quedado guardado en `localStorage` de una versión
   *  anterior de esta app es estado incompatible: se limpia una sola vez acá, sin tocar
   *  Auth/Historial/otros datos locales, para no crashear intentando reanudar una vista
   *  que ya no existe. `openPlayerHome()` ya resuelve el caso "sin identidad todavía". */
  function bootDefaultScreen() {
    Store.clearActiveMatch();
    openPlayerHome();
  }

  /** Backend Bloque 3 — retoma el alta en curso para una cuenta que ya tiene sesión real pero
   *  todavía no terminó perfil mínimo + Nivel BRAMU (email confirmado antes de tiempo, o la
   *  app se cerró entre confirmar el email y oficializar del todo — 03_Revision_ChatGPT.md
   *  §8: "email confirmado ≠ onboarding terminado"). Si el borrador local del mismo
   *  dispositivo sigue disponible, se usa tal cual (resumeDraftFlow ya lo revisa); si se
   *  perdió (otro dispositivo, storage borrado) pero el servidor YA tiene perfil mínimo
   *  completo (`serverUser.username`), se siembra desde ahí para no hacer retipear datos que
   *  ya existen — nunca se inventa un @usuario ni se llama a complete_profile de nuevo acá. */
  function resumeSignupProfileStep(serverUser) {
    if (!signupDraft || typeof signupDraft !== 'object') signupDraft = {};
    signupDraft.email = serverUser.email || signupDraft.email || null;
    if (serverUser.username) {
      signupDraft.firstName = signupDraft.firstName || serverUser.firstName || null;
      signupDraft.lastName = signupDraft.lastName || serverUser.lastName || null;
      signupDraft.username = signupDraft.username || serverUser.username;
    }
    Store.saveSignupDraft(signupDraft);
    resumeDraftFlow();
  }

  /** Backend Bloque 2/3 — hidrata Store con el perfil real del servidor (Auth.fetchOwnProfile,
   *  misma forma que Store.createUserAccount, ver auth.js) y decide a dónde entrar. Bloque 3:
   *  perfil incompleto O Nivel todavía no oficializado (`levelState` ausente o PENDIENTE)
   *  retoma el alta (resumeSignupProfileStep -> resumeDraftFlow); solo con AMBOS completos
   *  sigue el camino de siempre — completeIdentifyAction() si viene de un login recién hecho,
   *  bootDefaultScreen() si viene de restaurar una sesión ya existente al abrir la app
   *  (Backend_Infraestructura.md §8.1: "el login acepta... entrar desde otro dispositivo"). */
  async function resumeServerSession(opts) {
    const options = opts || {};
    const serverUser = await Auth.fetchOwnProfile();
    if (!serverUser) {
      if (options.afterLogin) {
        $('#login-error').textContent = LOGIN_ERROR_TEXT.unknown;
        $('#login-error').hidden = false;
      } else {
        bootDefaultScreen();
      }
      return;
    }
    Store.cacheServerUser(serverUser);
    syncServerLevelState(serverUser);
    syncCurrentIdentityFromStore();
    const onboardingDone = !!serverUser.username && !!serverUser.levelState && serverUser.levelState.status !== 'PENDIENTE';
    if (!onboardingDone) { resumeSignupProfileStep(serverUser); return; }
    // Backend Bloque 4 (03_Revision_ChatGPT.md §7) — una cuenta que YA terminó su onboarding
    // nunca llega a runOfficializeAndEnter() (único lugar donde se consume un claim), así que
    // un token pendiente acá quedaría inválido para siempre sin este aviso explícito: "una
    // cuenta ya completa que intenta reclamar otra identidad no se fusiona automáticamente" —
    // se resuelve a mano durante el piloto, nunca en silencio.
    if (Store.loadClaimToken()) {
      Store.clearClaimToken();
      showToast('Esta cuenta ya tiene perfil — reclamar otra identidad se resuelve manualmente durante el piloto.', 3600);
    }
    // Backend Bloque 5 — reintento de outbox en segundo plano (nunca bloquea la navegación):
    // cubre tanto "recién logueado" como "recarga con sesión ya persistida" (ambos casos pasan
    // por acá), que es exactamente cuándo hace falta reconciliar cargas sync_pending que hayan
    // sobrevivido a un refresh/cierre de la app (02_Analisis_Claude.md §7).
    retryMatchOutbox();
    if (options.afterLogin) completeIdentifyAction(); else bootDefaultScreen();
  }

  /** Backend Bloque 4 — captura `?claim=<token>` de la URL de entrada (link de invitación/
   *  reclamo, Backend_Infraestructura.md §6.2/§9). Ranura única en este dispositivo/navegador
   *  (Store.saveClaimToken, mismo criterio que signupDraft) — se consume recién en
   *  runOfficializeAndEnter(), nunca acá. Se limpia de la URL con `history.replaceState` para
   *  no reprocesarlo en cada refresh (mismo motivo que ya evita eso el propio flujo de OTP).
   *  Esta PWA no tiene router: se lee una sola vez, al boot, antes de cualquier otra decisión
   *  de arranque. Sin backend configurado (desarrollo local sin Supabase) no hay nada que
   *  reclamar — se limpia la URL igual mismo, sin guardar el token. */
  function captureClaimTokenFromUrl() {
    let token = null;
    try {
      token = new URLSearchParams(window.location.search).get('claim');
    } catch (e) { token = null; }
    const cleanToken = token ? token.trim() : '';
    if (!cleanToken) return;

    // Nunca descartar el único ejemplar del token si el backend todavía no está disponible:
    // puede tratarse de una carga transitoria donde env.generated.js o Supabase todavía no
    // quedaron configurados. Mantener ?claim= permite que un reload vuelva a intentar.
    if (!Auth.isConfigured()) return;

    // Store.saveClaimToken devuelve si pudo persistir en localStorage. Store mantiene además
    // una copia volátil para esta misma página, pero si la persistencia falló NO limpiamos el
    // query param: así un reload no convierte una intención de claim en un alta normal.
    const persisted = Store.saveClaimToken(cleanToken);
    showToast('Vas a reclamar una invitación — iniciá sesión o creá tu cuenta para continuar.', 3600);
    if (!persisted) {
      console.warn('[BRAMU LAB] El claim quedó solo en memoria; se conserva ?claim= en la URL para no perderlo al recargar.');
      return;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('claim');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (e) { /* noop — navegador sin History API real (poco probable) */ }
  }

  /** Único punto de entrada al arranque (reemplaza el `bootDefaultScreen()` directo de antes):
   *  sin backend configurado (desarrollo local) o sin sesión activa, el arranque es IDÉNTICO al
   *  de siempre salvo que quede un borrador de alta sin terminar en este dispositivo (Backend
   *  Bloque 3, caso A0: abandonó antes de confirmar el email) — ahí retoma el paso exacto en
   *  vez de mostrar Acceso desde cero. Con una sesión real ya guardada por el navegador
   *  (Supabase persiste el token, `persistSession:true` en auth.js), la reconoce sin pedir
   *  login de nuevo — "entrar desde otro dispositivo"/entre recargas de
   *  Backend_Infraestructura.md §15 Bloque 2. */
  async function bootWithServerSession() {
    captureClaimTokenFromUrl();
    if (!Auth.isConfigured()) { bootDefaultScreen(); return; }
    const savedDraft = Store.loadSignupDraft();
    if (savedDraft) signupDraft = savedDraft;
    const session = await Auth.getSession();
    if (!session) {
      if (savedDraft && savedDraft.email) { await resumeDraftFlow(); return; }
      bootDefaultScreen();
      return;
    }
    await resumeServerSession({ afterLogin: false });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // V03.0 (§8) — migración/bootstrap una sola vez, ANTES de cualquier init/render: si este
    // dispositivo ya tenía un jugador identificado antes de V03.0, queda logueado de
    // inmediato (nunca ve la pantalla de Acceso) con todo su historial ya vinculado por
    // userId. Nunca toca HISTORY/PLAYER_NAMES/ACTIVE_MATCH salvo agregar `userId` donde
    // corresponde (ver Store.migrateLegacyPlayerToUserIfNeeded).
    Store.migrateLegacyPlayerToUserIfNeeded();
    initConfirmModal();
    initAmbiguousMatchModal();
    initB6ActionsSection();
    initAnalysisScreen();
    initHistoryScreen();
    initManualLoadScreen();
    initPlayerHomeScreen();
    initRankingScreen();
    initRankingGateModal();
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
    initNivelOnboardingScreen();
    initCompleteAccessModal();
    initChangePasswordScreen();
    initNotificationsScreen();
    initLogoutWarningModal();
    initLogoutConfirmModal();
    initBottomNav();
    initDevTools();
    initUpdateCheck();
    // BRAMUlab_V04.5 — refleja un preview ya prendido de una sesión anterior (el ícono del
    // header debe verse activo desde el primer render, no recién tras el próximo toggle).
    refreshLabPreviewUI();
    bootWithServerSession();
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

  /* ------------------------------------------------------------------ */
  /* Laboratorio integrado — Escenario 1A (05_Laboratorio_UX_Uso_Real.md §15.1): Home/Historial/
   * Notificaciones podían quedar "stale" indefinidamente si la PWA volvía a foreground con una
   * de esas pantallas ya abierta — el único refresco existente ocurría al ENTRAR a cada pantalla
   * (openPlayerHome/openHistoryScreen/openNotificationsScreen vía refreshServerMatches, y
   * openNotificationsScreen vía refreshB6Notifications), nunca al volver de background con la
   * pantalla ya montada. El backend ya tenía el dato correcto (get_my_matches/get_notifications
   * verificados server-side) — el problema era puramente de refresco del cliente.
   *
   * Reutiliza EXCLUSIVAMENTE los mecanismos ya existentes — mismas RPCs, mismos caches, mismas
   * funciones de render que ya usa el resto de la app (refreshServerMatches/refreshB6Notifications/
   * Auth.fetchOwnProfile/syncServerLevelState/renderPlayerHome/renderHistory/
   * renderNotificationsList/renderNotificationsBadge, el mismo set que ya compone
   * `afterB6Action` más arriba) — cero RPCs ni contratos nuevos. A diferencia de `afterB6Action`
   * (que solo refresca notificaciones si la bandeja ya está abierta, porque su disparador es
   * siempre una acción sobre UN partido puntual), acá se refrescan matches Y notificaciones
   * siempre, sin condicionar a qué pantalla esté visible — el disparador es "la app volvió a
   * primer plano", no una acción puntual, así que el badge de Home debe quedar correcto aunque
   * el usuario esté parado en Historial cuando llega la notificación. */
  /* ------------------------------------------------------------------ */
  let foregroundRefreshInFlight = false;
  let lastForegroundRefreshAt = 0;
  // Colapsa únicamente dos eventos `visibilitychange` casi simultáneos (p. ej. el navegador
  // disparándolo más de una vez en el mismo gesto) — nunca una ventana larga: el objetivo es
  // evitar llamadas duplicadas, no retrasar ni ocultar una actualización remota real después de
  // haber estado en background (ver la advertencia explícita del pedido de esta ronda).
  const FOREGROUND_REFRESH_MIN_GAP_MS = 2000;

  async function refreshServerStateOnForeground() {
    if (!isServerBackedSession()) return;
    if (foregroundRefreshInFlight) return;
    const now = Date.now();
    if (now - lastForegroundRefreshAt < FOREGROUND_REFRESH_MIN_GAP_MS) return;
    foregroundRefreshInFlight = true;
    lastForegroundRefreshAt = now;
    try {
      // Cada llamada ya es "mejor esfuerzo" por sí sola en el caso normal (ver sus propios
      // comentarios: una falla de RPC deja el cache anterior intacto, nunca lo vacía, y resuelve
      // en vez de rechazar). Se aísla cada paso en su propio try/catch de todos modos, para que
      // una falla realmente excepcional (p. ej. un error de red que sí llegue a rechazar la
      // promesa) en una de las tres nunca impida intentar las otras dos — "fallas PARCIALES de
      // red" (plural), no "la primera falla cancela el resto".
      try { await refreshServerMatches(); } catch (e) { /* best-effort — ver comentario de arriba */ }
      try { await refreshB6Notifications(); } catch (e) { /* best-effort — ver comentario de arriba */ }
      try {
        if (Auth && Auth.isConfigured()) {
          const profile = await Auth.fetchOwnProfile();
          if (profile) { Store.cacheServerUser(profile); syncServerLevelState(profile); }
        }
      } catch (e) { /* best-effort — ver comentario de arriba */ }
      // Repinta únicamente la superficie ACTUALMENTE visible — nunca una pantalla que el usuario
      // no está mirando. El badge de notificaciones vive dentro de #view-player-home (ver
      // index.html), así que solo tiene sentido re-pintarlo cuando Home es la vista visible;
      // renderPlayerHome ya lo hace como parte de su propio render.
      if (!$('#view-player-home').hidden) renderPlayerHome();
      if (!$('#view-history').hidden) renderHistory();
      if (!$('#view-notifications').hidden) { renderNotificationsList(); renderNotificationsBadge(); }
    } finally {
      foregroundRefreshInFlight = false;
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
      // Laboratorio integrado §15.1 — mismo evento de vuelta a foreground: refresca el estado
      // server-backed propio y repinta la pantalla que haya quedado abierta.
      refreshServerStateOnForeground();
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

  /** BRAMUlab_V04.5 — único punto que sincroniza TODO lo que refleja el estado del preview:
   *  el ícono del header del Home (mouse Y touch, sin depender del long-press), el label del
   *  toggle dentro de Herramientas, y el título del propio menú ("· V04.6 PREVIEW" cuando está
   *  prendido) — identificación clara de que se está probando esta versión, además del string
   *  de versión pública (Store.VERSION), ahora también "BRAMUlab V04.6" (ver store.js). Llamado
   *  al boot (para reflejar un estado ya guardado de una sesión anterior) y después de cada
   *  toggle, desde CUALQUIERA de los 2 lugares que lo cambian.
   *  BRAMUlab_V04.6 — también sincroniza acá "Resetear Nivel BRAMU" (Herramientas, cuenta ya
   *  logueada) y "CREAR USUARIO DE PRUEBA" (pantalla de acceso, corrección de esta ronda: el
   *  long-press quedó descartado como mecanismo de acceso al laboratorio — ver
   *  `#access-create-test-user-btn`) — ambos quedan `hidden` con el preview apagado, el flujo
   *  normal de acceso/Herramientas queda IGUAL que antes de V04.4.
   *  Backend Bloque 3 (03_Revision_ChatGPT.md §7) — "conservarlos, pero Production: ocultos
   *  para usuarios comunes. Development/Staging: siguen disponibles para pruebas internas."
   *  `isProductionEnv()` es la única condición nueva; nada se elimina del código. */
  function isProductionEnv() {
    return !!(window.__BRAMU_ENV__ && window.__BRAMU_ENV__.name === 'production');
  }

  function refreshLabPreviewUI() {
    const enabled = Store.isLevelV1PreviewEnabled();
    const production = isProductionEnv();
    const headerBtn = $('#player-home-lab-preview-btn');
    if (headerBtn) {
      headerBtn.hidden = production;
      headerBtn.classList.toggle('is-active', enabled);
    }
    const title = $('#dev-tools-title');
    if (title) title.textContent = enabled ? 'HERRAMIENTAS · V04.6 PREVIEW' : 'HERRAMIENTAS';
    const toggleBtn = $('#dev-tools-toggle-nivel-v1');
    if (toggleBtn) toggleBtn.textContent = `Nivel BRAMU V1 (preview): ${enabled ? 'ON' : 'OFF'}`;
    // Backend Bloque 3 (03_Revision_ChatGPT.md §7) — "no permitir que Resetear Nivel modifique
    // arbitrariamente un Nivel server-backed real": esa cuenta ya no usa LEVEL_V1_STATE local
    // como autoridad (ver syncServerLevelState), así que el botón queda oculto para ella
    // siempre, sin importar el preview.
    const resetNivelBtn = $('#dev-tools-reset-nivel');
    if (resetNivelBtn) {
      const currentUser = Store.getCurrentUser();
      resetNivelBtn.hidden = production || !enabled || !!(currentUser && currentUser.serverBacked);
    }
    const createTestUserBtn = $('#access-create-test-user-btn');
    if (createTestUserBtn) createTestUserBtn.hidden = production || !enabled;
    // Backend Bloque 4 — mismo gate que resetNivelBtn, pero AL REVÉS: esto solo tiene sentido
    // para una cuenta serverBacked real (crea filas reales en Supabase vía RPC), nunca para una
    // cuenta local de laboratorio.
    const createTestClaimBtn = $('#dev-tools-create-test-claim');
    if (createTestClaimBtn) {
      const currentUser = Store.getCurrentUser();
      createTestClaimBtn.hidden = production || !enabled || !(currentUser && currentUser.serverBacked);
    }
  }

  /** Activa/desactiva y sincroniza la UI en un solo lugar — usado tanto por el ícono nuevo del
   *  header (mouse/touch directo) como por el toggle de Herramientas (long-press, se conserva). */
  function setLevelV1Preview(enabled) {
    Store.setLevelV1PreviewEnabled(enabled);
    refreshLabPreviewUI();
  }

  let labTestUserCounter = 0;

  /** BRAMUlab_V04.6 — "Crear usuario de prueba": cuenta local temporal SIN mail/contraseña
   *  (nunca pasa por el wizard de alta ni sus validaciones), directo al flujo de "TU PERFIL
   *  ESTÁ LISTO" -> onboarding de Nivel BRAMU V1 (mismo camino que cualquier alta nueva con el
   *  preview activo, ver initPlayerCardScreen). País/género fijos en el piloto compatible
   *  (Argentina/masculino) para poder probar el camino CON mapa de categoría; se puede repetir
   *  tantas veces como haga falta, sin tocar la cuenta real. Disparada desde
   *  `#access-create-test-user-btn` (pantalla de acceso, corrección de esta ronda — ver
   *  initAccessScreen): el long-press sobre el logo de Home quedó descartado como mecanismo de
   *  acceso, esta función no cambió, solo desde dónde se llama. */
  function createLabTestUserAndOpenOnboarding() {
    labTestUserCounter += 1;
    const n = labTestUserCounter;
    const user = Store.createUserAccount({
      firstName: 'Jugador', lastName: `Prueba ${n}`, displayName: `Jugador de Prueba ${n}`,
      username: `pruebalab${Date.now().toString(36)}${n}`,
      birthDate: '1995-06-15', gender: 'masculino', dominantHand: 'derecha', preferredSide: 'drive',
      locality: 'Buenos Aires', region: 'Buenos Aires', country: 'Argentina',
    });
    Store.saveSessionUserId(user.id);
    Store.saveCurrentPlayerName(user.displayName);
    syncCurrentIdentityFromStore();
    showToast('Usuario de prueba creado', 2000);
    openPlayerCardScreen(user);
  }

  /** BRAMUlab_V04.6 — "Resetear Nivel BRAMU" (Handoff V04.6 §10.B): borra SOLO
   *  `Store.resetLevelV1State` de la cuenta activa (historial, estadísticas, red, jugadores y
   *  grupos quedan intactos, ver cabecera de esa función en store.js) y reabre directo el
   *  onboarding para poder regenerar el Nivel con `nivel_inicial_v1_2` sobre la misma base
   *  ficticia acumulada — nunca migra silenciosamente un origen `nivel_inicial_v1_0`/V1.4
   *  viejo (§10 in fine del Handoff). */
  function resetLevelV1ForLabAccount() {
    const user = Store.getCurrentUser();
    $('#dev-tools-modal').hidden = true;
    if (!user) { showToast('Iniciá sesión para resetear Nivel BRAMU', 2200); return; }
    // Backend Bloque 3 (03_Revision_ChatGPT.md §7) — defensa en profundidad además de ocultar
    // el botón en refreshLabPreviewUI: nunca borra nada para una cuenta server-backed real, ni
    // siquiera si algo lo dispara sin pasar por el botón (p. ej. una tecla vieja mapeada).
    if (user.serverBacked) { showToast('Esta cuenta usa Nivel BRAMU real del servidor — no se puede resetear desde acá', 2600); return; }
    const had = Store.resetLevelV1State(user.id);
    if (!had) { showToast('Esta cuenta no tenía un Nivel BRAMU V1 guardado', 2200); return; }
    showToast('Nivel BRAMU reseteado — historial y estadísticas intactos', 2400);
    nivelOnboardingContext = 'account';
    openNivelOnboardingIntro();
  }

  /** Backend Bloque 4 — "flujo habilitado para prueba" (03_Revision_ChatGPT.md §9, prueba
   *  manual de Staging): crea una identidad provisional real (create_provisional_player),
   *  genera su link de reclamo (create_claim_link) y lo copia al portapapeles. Existe SOLO
   *  como herramienta de laboratorio (mismo criterio que "Resetear Nivel BRAMU") — la UI de
   *  producto para invitar (reutilizar un invitado dentro de la carga de un partido) es
   *  responsabilidad de Bloque 5, fuera de alcance acá. */
  async function createTestProvisionalAndCopyClaimLink() {
    $('#dev-tools-modal').hidden = true;
    const user = Store.getCurrentUser();
    if (!Auth.isConfigured() || !user || !user.serverBacked) {
      showToast('Necesitás una cuenta real (backend configurado) para probar esto.', 2600);
      return;
    }
    const displayName = `Invitado de prueba ${Date.now().toString(36)}`;
    const createResult = await Auth.createProvisionalPlayer(displayName);
    if (!createResult.ok) { showToast(`No se pudo crear el invitado (${createResult.code}).`, 3000); return; }
    const linkResult = await Auth.createClaimLink(createResult.player.player_id);
    if (!linkResult.ok) { showToast(`No se pudo generar el link (${linkResult.code}).`, 3000); return; }
    const url = `${window.location.origin}${window.location.pathname}?claim=${linkResult.token}`;
    console.log('[BRAMU LAB] Link de reclamo de prueba:', url);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Link copiado — "${displayName}"`, 3200);
    } catch (e) {
      showToast('No se pudo copiar automático — el link quedó en la consola.', 3200);
    }
  }

  function initDevTools() {
    // BRAMUlab_V04.6 — corrección de un bug preexistente detectado al verificar esta ronda:
    // `#home-logo` (el ID que este selector usaba desde V13.1) vive dentro de `#view-setup`,
    // NUNCA dentro de `#view-player-home` — el logo real del Home tiene su PROPIO id
    // (`#player-home-logo`, ver index.html) desde el rediseño de Home. El long-press sobre el
    // logo de Home nunca estaba conectado a nada; se corrige acá porque bloqueaba llegar a los
    // 2 botones nuevos de laboratorio de esta ronda (§10 del Handoff V04.6) — no es un cambio
    // de alcance de Nivel BRAMU, es la única forma de que "Crear usuario de prueba"/"Resetear
    // Nivel BRAMU" sean alcanzables de verdad.
    const logo = $('#player-home-logo');
    // Backend Bloque 3 (03_Revision_ChatGPT.md §7) — en Production, mantener presionado el
    // logo ya no abre nada: sin este disparador NI el ícono de matraz (ver
    // refreshLabPreviewUI), el modal de Herramientas queda inalcanzable para un usuario común,
    // sin borrar el código para Development/Staging.
    const start = () => {
      if (isProductionEnv()) return;
      clearTimeout(longPressTimeoutId); longPressTimeoutId = setTimeout(() => { refreshLabPreviewUI(); $('#dev-tools-modal').hidden = false; }, LONG_PRESS_MS);
    };
    const cancel = () => clearTimeout(longPressTimeoutId);
    logo.addEventListener('pointerdown', start);
    logo.addEventListener('pointerup', cancel);
    logo.addEventListener('pointerleave', cancel);
    logo.addEventListener('pointercancel', cancel);
    logo.addEventListener('contextmenu', (e) => e.preventDefault()); // evita el menú de "guardar imagen" al mantener presionado

    $('#dev-tools-cancel').addEventListener('click', () => { $('#dev-tools-modal').hidden = true; });
    $('#dev-tools-modal').addEventListener('click', (e) => { if (e.target === $('#dev-tools-modal')) $('#dev-tools-modal').hidden = true; });
    $('#dev-tools-force-update').addEventListener('click', forceUpdateApp);
    $('#dev-tools-toggle-nivel-v1').addEventListener('click', () => { setLevelV1Preview(!Store.isLevelV1PreviewEnabled()); });
    $('#dev-tools-reset-nivel').addEventListener('click', resetLevelV1ForLabAccount);
    $('#dev-tools-create-test-claim').addEventListener('click', createTestProvisionalAndCopyClaimLink);
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
