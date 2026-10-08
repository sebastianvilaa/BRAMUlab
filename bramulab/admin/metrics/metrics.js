/* BRAMU Metrics V1 · F3 — consola privada /admin/metrics.
 *
 * Página estática SIN datos: todo sale de la Edge Function `admin-metrics`, que verifica el JWT y autoriza al administrador EN SERVIDOR
 * (lista metrics_admins por UUID). Nada de acá decide quién es administrador: ni el @usuario, ni el email, ni el nombre.
 * Contrato real del backend: docs/BRAMUlab/Metrics/BRAMU_Metrics_Auditoria_Tecnica_V1.md §4 y Implementacion/Post_Lanzamiento/149_*.md (F4: 148 §11).
 *
 * Reglas que este archivo respeta:
 *   - nunca inventa datos: sin respuesta del servidor no hay números (los estados no medibles se rotulan, jamás se muestran como 0);
 *   - solo agregados: no existe ninguna vista por jugador;
 *   - el DOM se arma con textContent/createElement (nada de innerHTML con datos del servidor);
 *   - los datos no se guardan en storage: solo preferencias (período, comparar, incluir internas);
 *   - D8 (días completos): los períodos terminan AYER; lo de hoy se muestra aparte, rotulado «parcial», y nunca entra en comparaciones;
 *   - el modo `?qa=1` (fixture rotulado «NO PRODUCTION») solo existe fuera de Production y el fixture ni se publica en ese build.
 */
(function (global) {
  'use strict';

  const TZ = 'America/Argentina/Buenos_Aires';
  const NBSP = ' ';
  const PREF_KEY = 'bramu_metrics_prefs';
  const CACHE_TTL_MS = 60 * 1000;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const RANGES = [
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: '90d', label: '90 días' },
    { id: 'all', label: 'Histórico' },
  ];
  const VIEWS = [
    { id: 'inicio', label: 'Inicio', section: 'overview', hash: '#/' },
    { id: 'usuarios', label: 'Usuarios', section: 'users', hash: '#/usuarios' },
    { id: 'partidos', label: 'Partidos', section: 'matches', hash: '#/partidos' },
    { id: 'activacion', label: 'Activación', section: 'activation', hash: '#/activacion' },
    { id: 'comunidad', label: 'Comunidad', section: 'community', hash: '#/comunidad' },
    { id: 'uso', label: 'Uso', section: 'usage', hash: '#/uso' },
  ];
  const SECTION_OF_PREFIX = { users: 'users', matches: 'matches', activation: 'activation', community: 'community', usage: 'usage' };

  /* Qué dirección es «buena» solo cuando el producto lo define; el resto se muestra en azul neutro (sin juicio). */
  const GOOD_UP = new Set(['users.signups', 'matches.created', 'matches.real', 'matches.validated', 'matches.validation_rate_closed', 'matches.authors',
    'matches.registered_participants', 'usage.dau', 'usage.wau', 'usage.mau', 'usage.dau_avg', 'usage.wau_with_action', 'usage.mau_with_action',
    'usage.ret_w1', 'usage.ret_w4', 'usage.ret_d1', 'usage.ret_d7', 'usage.ret_d30',
    'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.third_match',
    'activation.fifth_match', 'activation.returned_other_week',
    'community.groups_created', 'community.groups_with_match', 'community.invites_created', 'community.invites_claimed', 'community.invite_conversion']);
  const GOOD_DOWN = new Set(['matches.annulled', 'matches.expired_derived', 'matches.validation_p50_hours', 'matches.validation_p90_hours', 'activation.median_days_to_first_load']);

  /* Gráficos con serie temporal: KPI -> [clave en `series` de su sección]. */
  const KPI_SERIES = {
    'users.signups': { section: 'users', key: 'signups', title: 'Altas por ' },
    'matches.created': { section: 'matches', key: 'created', title: 'Partidos cargados por ' },
    'matches.validated': { section: 'matches', key: 'validated', title: 'Partidos validados por ' },
    'community.groups_created': { section: 'community', key: 'groups_created', title: 'Grupos creados por ' },
    'community.invites_created': { section: 'community', key: 'invites_created', title: 'Invitaciones creadas por ' },
    'usage.dau': { section: 'usage', key: 'active_players', title: 'Jugadores activos por ' },
  };

  const STATUS_LABELS = {
    validated: ['Validados', ''],
    pending: ['Pendientes (plazo vigente)', 'blue'],
    expired_derived: ['Vencidos sin validar', 'amber'],
    annulled_duplicate: ['Anulados · duplicado', 'dim'],
    annulled_author_retracted: ['Anulados · carga retirada', 'dim'],
    annulled_admin: ['Anulados · administrativo', 'dim'],
  };
  const LEVEL_LABELS = { PENDIENTE: ['Pendiente', 'dim'], CALIBRANDO: ['Calibrando', 'blue'], CALIBRADO: ['Calibrado', ''], RECALIBRANDO: ['Recalibrando', 'amber'] };
  const SIZE_LABELS = { size_1: ['1 integrante', 'dim'], size_2_3: ['2–3 integrantes', ''], size_4_6: ['4–6 integrantes', ''], size_7_plus: ['7 o más integrantes', ''] };
  const DENSITY_LABELS = { insufficient: ['Insuficiente (0–4 elegibles)', 'dim'], forming: ['En formación (5–14)', 'blue'], established: ['Consolidado (15 o más)', ''] };
  const PLATFORM_LABELS = { ios: ['iPhone / iPad', ''], android: ['Android', 'blue'], desktop: ['Escritorio', 'amber'], other: ['Otra', 'dim'] };
  const ORDERS = {
    level: ['PENDIENTE', 'CALIBRANDO', 'CALIBRADO', 'RECALIBRANDO'],
    size: ['size_1', 'size_2_3', 'size_4_6', 'size_7_plus'],
    density: ['insufficient', 'forming', 'established'],
  };
  const FUNNEL_IDS = ['activation.cohort', 'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated',
    'activation.third_match', 'activation.fifth_match'];
  const RANKING_WAIT = /^community\.ranking_(days_since_edition|eligible_players|eligibility_rate)$/;
  const FUNNEL_LABELS = {
    'activation.level_initial': 'Completó el Nivel inicial',
    'activation.loaded_first': 'Cargó su primer partido',
    'activation.participated_first': 'Participó en un partido',
    'activation.participated_validated': 'Participó en un partido validado',
    'activation.third_match': 'Llegó al 3.er partido',
    'activation.fifth_match': 'Llegó al 5.º partido',
  };

  /* ====================================================================== */
  /* Funciones PURAS (probadas en Node)                                      */
  /* ====================================================================== */

  function fmtNum(v, maxDec) {
    if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return '—';
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: maxDec == null ? 0 : maxDec, useGrouping: true }).format(v);
  }

  function formatValue(kpi, v) {
    if (v === null || v === undefined || typeof v !== 'number' || !isFinite(v)) return '—';
    const id = (kpi && kpi.id) || '';
    if (kpi && kpi.kind === 'ratio') return fmtNum(v * 100, 1) + NBSP + '%';
    if (/_hours$/.test(id)) return fmtNum(v, 1) + NBSP + 'h';
    if (/_days(_|$)/.test(id)) return fmtNum(v, 1) + NBSP + 'días';
    if (id === 'usage.dau_avg') return fmtNum(v, 1);
    return fmtNum(v, Number.isInteger(v) ? 0 : 1);
  }

  function toneFor(id, sign) {
    if (sign === 0) return 'flat';
    if (GOOD_UP.has(id)) return sign > 0 ? 'good' : 'bad';
    if (GOOD_DOWN.has(id)) return sign < 0 ? 'good' : 'bad';
    return 'neutral';
  }

  /** Vista de la variación contra el período anterior. `null` = no mostrar nada (comparación apagada o sin período previo). */
  function deltaView(kpi, compareOn) {
    if (!compareOn || !kpi || !kpi.delta) return null;
    const d = kpi.delta;
    if (d.note === 'sin_comparacion') return null;
    if (d.note === 'stock_sin_comparacion') return { tone: 'info', arrow: '', text: 'Saldo al corte', sub: null };
    if (d.note === 'sin_datos_suficientes') return { tone: 'info', arrow: '', text: 'Sin datos suficientes para comparar', sub: null };
    if (d.abs === null || d.abs === undefined) return null;
    const sign = d.abs > 0 ? 1 : d.abs < 0 ? -1 : 0;
    if (sign === 0) return { tone: 'flat', arrow: '', text: 'Sin cambios', sub: null };
    const arrow = sign > 0 ? '▲' : sign < 0 ? '▼' : '•';
    let unit = '';
    if (d.note === 'puntos_porcentuales') unit = NBSP + 'pp';
    else if (/_hours$/.test(kpi.id)) unit = NBSP + 'h';
    let text = (sign > 0 ? '+' : sign < 0 ? '−' : '') + fmtNum(Math.abs(d.abs), 1) + unit;
    if (d.pct !== null && d.pct !== undefined) text += ' · ' + (d.pct > 0 ? '+' : d.pct < 0 ? '−' : '') + fmtNum(Math.abs(d.pct), 1) + NBSP + '%';
    const sub = d.note === 'base_previa_cero' ? 'sin base previa (0)' : null;
    return { tone: toneFor(kpi.id, sign), arrow, text, sub };
  }

  function previousText(kpi, compareOn) {
    if (!compareOn || !kpi || !kpi.previous) return null;
    if (kpi.kind === 'stock' || kpi.snapshot) return null;
    const p = kpi.previous;
    if (p.value === null || p.value === undefined) return 'Anterior: sin datos';
    return 'Anterior: ' + formatValue(kpi, p.value);
  }

  function fmtDayMonth(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}` : '—';
  }

  function availabilityView(kpi, meta) {
    const min = (meta && meta.minCell) || 5;
    switch (kpi && kpi.availability) {
      case 'no_evidence':
        if (kpi.id && RANKING_WAIT.test(kpi.id)) return { tone: 'none', text: 'Todavía no se publicó ninguna edición de Ranking' };
        return { tone: 'none', text: 'Sin registros en el período' };
      case 'insufficient_sample': return { tone: 'sample', text: 'Muestra insuficiente' + (kpi.n !== null && kpi.n !== undefined ? ` · n = ${fmtNum(kpi.n)}` : '') + ` (mínimo ${min})` };
      case 'not_instrumented': return { tone: 'wait', text: 'Todavía no medible' + (kpi.since ? ` · captura desde ${fmtDayMonth(kpi.since)}` : ' · sin fecha de inicio de captura') };
      case 'immature': return { tone: 'wait', text: 'Cohortes todavía inmaduras' };
      default:
        if (kpi && kpi.since) return { tone: 'partial', text: `Captura parcial · desde ${fmtDayMonth(kpi.since)}` };
        return null;
    }
  }

  /** Fecha/hora BA de un instante ISO. */
  function fmtBA(iso, opts) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('es-AR', Object.assign({ timeZone: TZ }, opts || { day: '2-digit', month: '2-digit' })).format(d);
  }

  /** Fecha BA (AAAA-MM-DD) de un instante ISO. */
  function baDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }

  /** «01/10 – 07/10»: días COMPLETOS (D8). El fin de la ventana es exclusivo (las 00:00 de hoy, o donde empieza la actual): se muestra el último día incluido. */
  function windowLabel(win) {
    if (!win || win.length < 2) return '—';
    const start = baDate(win[0]);
    const end = baDate(new Date(new Date(win[1]).getTime() - 1).toISOString());
    if (!start || !end || end < start) return 'sin días completos todavía';
    return `${fmtDayMonth(start)} – ${fmtDayMonth(end)}`;
  }

  /** «Hoy (parcial)»: actividad del día en curso, aparte de todo período y de toda comparación. `keys` = qué mostrar. null si el servidor no la mandó. */
  const TODAY_FIELDS = {
    signups: 'Altas', matchesCreated: 'Partidos cargados', matchesValidated: 'Partidos validados', activePlayers: 'Jugadores activos',
  };
  function todayView(today, keys) {
    if (!today || typeof today !== 'object') return null;
    const items = (keys || []).filter((k) => TODAY_FIELDS[k]).map((k) => {
      const v = today[k];
      if (k === 'activePlayers' && (v === null || v === undefined)) return { key: k, label: TODAY_FIELDS[k], text: 'Todavía no medible', pending: true };
      return { key: k, label: TODAY_FIELDS[k], text: fmtNum(v), pending: false };
    });
    return { items, upTo: today.asOf ? fmtBA(today.asOf, { hour: '2-digit', minute: '2-digit', hour12: false }) : null, date: today.date || null };
  }

  function seriesFor(kpiId, data) {
    const m = KPI_SERIES[kpiId];
    if (!m || !data || !data.series || !data.series[m.key]) return null;
    return { def: m, series: data.series[m.key] };
  }

  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  function dateLabelFor(start, granularity) {
    return (granularity === 'week_ba' ? 'Semana del ' : '') + fmtDayMonth(start);
  }

  /** Geometría del gráfico. `series` = { granularity, current:[{start,value}], previous:[…]|null }. */
  function chartModel(series, opts) {
    const o = opts || {};
    const W = 640; const H = 230; const pad = { l: 38, r: 10, t: 12, b: 28 };
    const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
    const cur = (series && series.current) || [];
    const prev = o.compare && series && Array.isArray(series.previous) ? series.previous : null;
    const gran = (series && series.granularity) || 'day';
    const vals = cur.map((p) => p.value).concat(prev ? prev.map((p) => p.value) : []);
    const maxV = vals.length ? Math.max.apply(null, vals) : 0;
    const total = cur.reduce((a, p) => a + p.value, 0) + (prev ? prev.reduce((a, p) => a + p.value, 0) : 0);
    const empty = cur.length === 0 || total === 0;
    const step = Math.max(1, niceStep(Math.max(maxV, 1) / 4)); // series de conteos: ticks enteros
    const ymax = Math.max(step * Math.ceil(Math.max(maxV, 1) / step), step);
    const y = (v) => pad.t + ih - (v / ymax) * ih;
    const yTicks = [];
    for (let v = 0; v <= ymax + 1e-9; v += step) yTicks.push({ v, y: y(v) });
    const n = cur.length;
    /* Conteos por día o por semana: siempre barras (una línea sobre días con 0-2 eventos miente continuidad). */
    const bars = true;
    const slot = n ? iw / n : iw;
    const xAt = (i) => (bars ? pad.l + slot * (i + 0.5) : pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1)));
    const barW = Math.max(2, Math.min(34, slot * (prev ? 0.4 : 0.64)));
    const curPts = cur.map((p, i) => ({ i, x: xAt(i), y: y(p.value), v: p.value, start: p.start }));
    const prevPts = prev ? prev.slice(0, n || prev.length).map((p, i) => ({ i, x: xAt(i), y: y(p.value), v: p.value, start: p.start })) : null;
    const labelIdx = [];
    if (n) {
      const want = Math.min(n, W < 700 ? 5 : 7);
      for (let k = 0; k < want; k += 1) labelIdx.push(want === 1 ? 0 : Math.round((k * (n - 1)) / (want - 1)));
    }
    const xLabels = Array.from(new Set(labelIdx)).map((i) => ({ x: xAt(i), text: fmtDayMonth(cur[i].start) }));
    return { W, H, pad, iw, ih, kind: 'bars', granularity: gran, ymax, yTicks, y, curPts, prevPts, barW, slot, xLabels, empty, total, baseY: y(0) };
  }

  function parseHash(hash) {
    const h = String(hash || '').replace(/^#\/?/, '');
    if (h === '' || h === 'inicio') return { view: 'inicio' };
    if (h === 'usuarios') return { view: 'usuarios' };
    if (h === 'partidos') return { view: 'partidos' };
    if (h === 'activacion') return { view: 'activacion' };
    if (h === 'comunidad') return { view: 'comunidad' };
    if (h === 'uso') return { view: 'uso' };
    const m = /^kpi\/([a-z_]+\.[a-z0-9_]+)$/.exec(h);
    if (m && SECTION_OF_PREFIX[m[1].split('.')[0]]) return { view: 'kpi', kpiId: m[1] };
    return { view: 'inicio' };
  }

  function apiErrorKind(status, hasError) {
    if (status === 401) return 'session';
    if (status === 403) return 'forbidden';
    if (status === 429) return 'rate';
    if (status === 400) return 'bad';
    if (status && status >= 500) return 'server';
    return hasError ? 'network' : 'server';
  }

  function qaAllowed(env, hostname) {
    if (env && typeof env.name === 'string') return env.name === 'staging' || env.name === 'development';
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(String(hostname || ''));
  }

  const pure = { fmtNum, formatValue, toneFor, deltaView, previousText, availabilityView, fmtDayMonth, fmtBA, baDate, windowLabel, todayView, seriesFor, niceStep, chartModel, parseHash, apiErrorKind, qaAllowed, dateLabelFor,
    RANGES, VIEWS, KPI_SERIES, GOOD_UP, GOOD_DOWN, TODAY_FIELDS, FUNNEL_IDS };

  /* ====================================================================== */
  /* Interfaz (solo con DOM)                                                 */
  /* ====================================================================== */

  if (typeof document === 'undefined' || global.__MX_NO_BOOT__) { global.PLMetricsAdmin = pure; return; }
  global.PLMetricsAdmin = pure;

  const $ = (id) => document.getElementById(id);
  function h(tag, props, kids) {
    const e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach((k) => {
        const v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    [].concat(kids || []).forEach((c) => { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(tag, attrs, kids) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach((k) => { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, String(attrs[k])); });
    [].concat(kids || []).forEach((c) => { if (c) e.appendChild(c); });
    return e;
  }

  const params = new URLSearchParams(global.location.search);
  const env = global.__BRAMU_ENV__ || null;
  const QA = params.get('qa') === '1' && qaAllowed(env, global.location.hostname);
  const QA_STATE = params.get('qastate') || '';

  const S = { range: '30d', compare: true, internal: false, route: { view: 'inicio' }, lastTab: 'inicio', data: null, seq: 0, meta: null };
  const cache = new Map();
  let client = null;

  function loadPrefs() {
    try {
      const p = JSON.parse(global.localStorage.getItem(PREF_KEY) || '{}');
      if (RANGES.some((r) => r.id === p.range)) S.range = p.range;
      if (typeof p.compare === 'boolean') S.compare = p.compare;
      if (typeof p.internal === 'boolean') S.internal = p.internal;
    } catch (e) { /* storage bloqueado o JSON inválido: se usan los defaults */ }
  }
  function savePrefs() {
    try { global.localStorage.setItem(PREF_KEY, JSON.stringify({ range: S.range, compare: S.compare, internal: S.internal })); } catch (e) { /* noop */ }
  }

  /* ---------- Gate (acceso / errores globales) ---------- */
  function showGate(kind, detail) {
    const g = $('mx-gate'); g.textContent = '';
    $('mx-app').hidden = true; $('mx-refresh').hidden = true; $('mx-updated').textContent = '';
    const cfg = {
      config: { icon: '!', bad: true, title: 'Backend no configurado', text: 'Este despliegue no tiene un proyecto Supabase configurado, así que no hay datos que mostrar.', btn: null },
      nosession: { icon: '🔒', title: 'Iniciá sesión en BRAMUlab', text: 'Esta consola es privada. Entrá a BRAMUlab con tu cuenta y volvé a esta dirección.', btn: ['Ir a BRAMUlab', '/'] },
      session: { icon: '⏱', title: 'Tu sesión venció', text: 'Volvé a iniciar sesión en BRAMUlab y reabrí esta consola.', btn: ['Ir a BRAMUlab', '/'] },
      forbidden: { icon: '⛔', bad: true, title: 'Acceso no autorizado', text: 'Esta consola es privada y tu cuenta no tiene acceso.', btn: ['Volver a BRAMUlab', '/'] },
      env: { icon: '!', bad: true, title: 'Entorno inconsistente', text: 'El servidor respondió con datos de otro entorno. Por seguridad no se muestran.', btn: null },
      qaoff: { icon: '!', bad: true, title: 'Modo QA no disponible', text: 'El fixture de prueba no existe en este build.', btn: null },
    }[kind];
    g.appendChild(h('div', { class: 'mx-gate__icon' + (cfg.bad ? ' mx-gate__icon--bad' : ''), 'aria-hidden': 'true', text: cfg.icon }));
    g.appendChild(h('h1', { text: cfg.title }));
    g.appendChild(h('p', { text: detail || cfg.text }));
    if (cfg.btn) g.appendChild(h('a', { class: 'mx-btn mx-btn--primary', href: cfg.btn[1], text: cfg.btn[0] }));
    g.hidden = false;
    const live = $('mx-view'); if (live) live.setAttribute('aria-busy', 'false');
  }
  function hideGate() { $('mx-gate').hidden = true; $('mx-app').hidden = false; $('mx-refresh').hidden = false; }

  function setEnvBanner(meta) {
    const b = $('mx-env');
    let cls = ''; let text = '';
    if (QA) { cls = 'qa'; text = 'DATOS DE PRUEBA (QA) · NO PRODUCTION · no son datos reales'; }
    else if (env && env.name === 'staging') { cls = 'staging'; text = 'STAGING · datos de prueba · no son datos de Production'; }
    else if (env && env.name === 'production') { cls = 'production'; text = 'PRODUCTION · datos reales'; }
    else if (env) { cls = 'staging'; text = `${String(env.name).toUpperCase()} · entorno de desarrollo`; }
    b.className = 'mx-env' + (cls ? ` mx-env--${cls}` : '');
    b.textContent = text; b.hidden = !text;
  }

  /* ---------- Acceso a datos ---------- */
  function apiError(status, code, cause) {
    const e = new Error(code || 'api_error');
    e.kind = apiErrorKind(status, !!cause); e.status = status || null; e.code = code || null;
    return e;
  }
  async function callServer(body) {
    if (QA) return global.PLMetricsQaFixture.get(body, QA_STATE);
    const res = await client.functions.invoke('admin-metrics', { body });
    if (res.error) {
      let out = null; let status = null;
      const ctx = res.error.context;
      if (ctx) { status = ctx.status || null; if (typeof ctx.json === 'function') { try { out = await ctx.json(); } catch (e) { out = null; } } }
      throw apiError(status, out && out.code, res.error);
    }
    if (!res.data || res.data.ok !== true) throw apiError(null, res.data && res.data.code);
    return res.data;
  }
  function cacheKey(section) { return [section, S.range, S.compare, S.internal].join('|'); }
  async function getSection(section, force) {
    const k = cacheKey(section);
    const c = cache.get(k);
    if (!force && c && Date.now() - c.at < CACHE_TTL_MS) return c.data;
    const data = await callServer({ section, range: S.range, compare: S.compare, includeInternal: S.internal });
    if (!QA && (!data.meta || !env || data.meta.environment !== env.name)) throw Object.assign(new Error('env_mismatch'), { kind: 'env' });
    cache.set(k, { at: Date.now(), data });
    return data;
  }

  /* ---------- Componentes ---------- */
  function deltaChip(kpi) {
    const d = deltaView(kpi, S.compare);
    if (!d) return null;
    return h('span', { class: `mx-chip mx-chip--${d.tone}` }, [d.arrow ? `${d.arrow} ` : '', d.text, d.sub ? h('span', { text: ` · ${d.sub}` }) : null]);
  }
  function stateLine(kpi, meta) {
    const a = availabilityView(kpi, meta);
    return a ? h('div', { class: `mx-state mx-state--${a.tone}`, text: a.text }) : null;
  }
  function valueNode(kpi) {
    const shown = kpi.availability === 'insufficient_sample' || kpi.availability === 'not_instrumented' || kpi.availability === 'immature';
    const txt = shown ? '—' : formatValue(kpi, kpi.value);
    return h('div', { class: 'mx-card__value' + (shown ? ' is-empty' : '') }, txt);
  }
  function kpiCard(kpi, meta, hero) {
    const prev = previousText(kpi, S.compare);
    return h('a', { class: 'mx-card' + (hero ? ' mx-card--hero' : ''), href: `#/kpi/${kpi.id}`, 'aria-label': `${kpi.label}: ver detalle` }, [
      h('span', { class: 'mx-card__chev', 'aria-hidden': 'true', text: '›' }),
      h('div', { class: 'mx-card__label', text: kpi.label }),
      valueNode(kpi),
      deltaChip(kpi),
      prev ? h('div', { class: 'mx-prev', text: prev }) : null,
      stateLine(kpi, meta),
    ]);
  }
  function skeletonView() {
    const grid = h('div', { class: 'mx-grid' }, [1, 2, 3, 4, 5, 6, 7, 8].map(() => h('div', { class: 'mx-skel' })));
    return h('div', null, [h('div', { class: 'mx-h', text: 'Cargando…' }), grid, h('div', { class: 'mx-h' }), h('div', { class: 'mx-grid mx-grid--charts' }, [h('div', { class: 'mx-skel mx-skel--chart' }), h('div', { class: 'mx-skel mx-skel--chart' })])]);
  }
  function panel(title, sub, body, note) {
    return h('section', { class: 'mx-panel' }, [h('h3', { class: 'mx-panel__title', text: title }), sub ? h('p', { class: 'mx-panel__sub', text: sub }) : null, body, note ? h('p', { class: 'mx-note', text: note }) : null]);
  }

  /* ---------- Gráfico SVG ---------- */
  function chart(series, opts) {
    const o = opts || {};
    const m = chartModel(series, { compare: S.compare });
    const meta = o.meta || {};
    if (m.empty) return h('div', { class: 'mx-empty', text: S.compare && series && series.previous ? 'Sin registros en este período ni en el anterior.' : 'Sin registros en este período.' });
    const root = svg('svg', { viewBox: `0 0 ${m.W} ${m.H}`, role: 'img', 'aria-label': `${o.title || 'Serie'}: total ${fmtNum(series.current.reduce((a, p) => a + p.value, 0))} en el período actual` });
    const axis = svg('g', { class: 'mx-axis' });
    m.yTicks.forEach((t) => {
      axis.appendChild(svg('line', { class: 'mx-grid-line', x1: m.pad.l, x2: m.W - m.pad.r, y1: t.y, y2: t.y }));
      axis.appendChild(svg('text', { x: m.pad.l - 8, y: t.y + 4, 'text-anchor': 'end' }, [document.createTextNode(fmtNum(t.v))]));
    });
    m.xLabels.forEach((l) => { const t = svg('text', { x: l.x, y: m.H - 8, 'text-anchor': 'middle' }); t.textContent = l.text; axis.appendChild(t); });
    root.appendChild(axis);
    m.curPts.forEach((p, i) => {
      const pp = m.prevPts && m.prevPts[i];
      const cx = m.prevPts ? p.x - m.barW - 1 : p.x - m.barW / 2;
      root.appendChild(svg('rect', { class: 'mx-bar-cur', x: cx, y: p.y, width: m.barW, height: Math.max(0, m.baseY - p.y), rx: 3 }));
      if (pp) root.appendChild(svg('rect', { class: 'mx-bar-prev', x: p.x + 1, y: pp.y, width: m.barW, height: Math.max(0, m.baseY - pp.y), rx: 3 }));
    });
    const guide = svg('line', { class: 'mx-guide', y1: m.pad.t, y2: m.baseY, x1: 0, x2: 0, visibility: 'hidden' });
    root.appendChild(guide);
    const hit = svg('rect', { x: m.pad.l, y: m.pad.t, width: m.iw, height: m.ih, fill: 'transparent' });
    root.appendChild(hit);

    const tip = $('mx-tip');
    const idxFrom = (clientX) => {
      const r = root.getBoundingClientRect();
      const xv = ((clientX - r.left) * m.W) / r.width;
      const i = Math.floor((xv - m.pad.l) / m.slot);
      return Math.max(0, Math.min(m.curPts.length - 1, i));
    };
    const show = (ev) => {
      const i = idxFrom(ev.clientX);
      const p = m.curPts[i]; const pp = m.prevPts && m.prevPts[i];
      guide.setAttribute('x1', p.x); guide.setAttribute('x2', p.x); guide.setAttribute('visibility', 'visible');
      tip.textContent = '';
      tip.appendChild(h('b', { text: dateLabelFor(p.start, m.granularity) }));
      tip.appendChild(h('div', null, [h('span', { text: 'Actual' }), h('span', { text: fmtNum(p.v) })]));
      if (pp) tip.appendChild(h('div', null, [h('span', { text: `Anterior · ${dateLabelFor(pp.start, m.granularity)}` }), h('span', { text: fmtNum(pp.v) })]));
      tip.hidden = false;
      const w = tip.offsetWidth; const hh = tip.offsetHeight;
      tip.style.left = `${Math.max(8, Math.min(global.innerWidth - w - 8, ev.clientX + 14))}px`;
      tip.style.top = `${Math.max(8, ev.clientY - hh - 14)}px`;
    };
    const hide = () => { guide.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide); hit.addEventListener('pointercancel', hide);

    const legend = h('div', { class: 'mx-legend' }, [
      h('span', null, [h('i', { class: 'mx-dot' }), `Actual${meta.window ? ' · ' + windowLabel(meta.window) : ''}`]),
      S.compare && series.previous ? h('span', null, [h('i', { class: 'mx-dot mx-dot--prev' }), `Anterior${meta.previousWindow ? ' · ' + windowLabel(meta.previousWindow) : ''}`]) : null,
    ]);
    return h('div', { class: 'mx-chart' }, [root, legend]);
  }

  function hbars(rawItems, opts) {
    const o = opts || {};
    const items = o.order ? rawItems.slice().sort((a, b) => {
      const ia = o.order.indexOf(a.label); const ib = o.order.indexOf(b.label);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }) : rawItems;
    const total = items.reduce((a, i) => a + i.n, 0) || 1;
    return h('div', { class: 'mx-hbars' }, items.map((it) => {
      const [label, tone] = o.labelFn ? o.labelFn(it.label) : (o.labels && o.labels[it.label] ? o.labels[it.label] : [it.label, '']);
      return h('div', { class: 'mx-hrow' }, [
        h('span', { class: 'mx-hrow__label', text: label }),
        h('span', { class: 'mx-hrow__val' }, [fmtNum(it.n), h('small', { text: `${fmtNum((it.n / total) * 100, 0)}${NBSP}%` })]),
        h('div', { class: 'mx-hrow__track' }, h('div', { class: 'mx-hrow__fill' + (tone ? ` mx-hrow__fill--${tone}` : ''), style: `width:${Math.max(2, (it.n / total) * 100).toFixed(1)}%` })),
      ]);
    }));
  }

  function breakdownPanel(title, sub, bd, opts) {
    if (!bd) return panel(title, sub, h('div', { class: 'mx-empty', text: 'Sin datos.' }));
    const o = opts || {};
    const unit = o.unit || 'personas';
    if (bd.suppressed) return panel(title, sub, h('div', { class: 'mx-empty', text: o.suppressedText || `Sin desglose: hay menos de ${bd.minCell || 5} ${unit} por segmento. Protegemos la privacidad: no se muestran grupos tan chicos.` }));
    if (!bd.items.length) return panel(title, sub, h('div', { class: 'mx-empty', text: o.emptyText || 'Sin registros en este período.' }));
    const note = o.note || (bd.minCell ? `Los segmentos con menos de ${bd.minCell} ${unit} se agrupan en «Otros» para proteger la privacidad.` : null);
    return panel(title, sub, hbars(bd.items, o), note);
  }

  function chartPanel(title, sub, series, opts) {
    const gran = series && series.granularity === 'week_ba' ? 'semana' : 'día';
    const weekly = series && series.granularity === 'week_ba' ? '; las semanas de los extremos pueden estar incompletas' : '';
    return panel(title, sub || (series ? `Por ${gran} (hora de Buenos Aires, días completos hasta ayer${weekly})` : null), series ? chart(series, opts) : h('div', { class: 'mx-empty', text: 'Sin datos.' }), opts && opts.note);
  }

  /** «Hoy · parcial» (D8): lo de hoy va aparte, rotulado, y no participa de períodos ni de comparaciones. */
  function todayPanel(data, keys) {
    const v = todayView(data && data.today, keys);
    if (!v || !v.items.length) return null;
    return h('section', { class: 'mx-panel mx-today' }, [
      h('div', { class: 'mx-today__head' }, [
        h('span', { class: 'mx-today__badge', text: 'HOY · PARCIAL' }),
        h('span', { class: 'mx-today__upto', text: v.upTo ? `hasta las ${v.upTo}` : '' }),
      ]),
      h('div', { class: 'mx-today__items' }, v.items.map((it) => h('div', { class: 'mx-today__item' }, [
        h('div', { class: 'mx-today__label', text: it.label }),
        h('div', { class: 'mx-today__value' + (it.pending ? ' is-empty' : ''), text: it.text }),
      ]))),
      h('p', { class: 'mx-note', text: 'El día en curso todavía no terminó: no entra en los períodos ni en las comparaciones de arriba.' }),
    ]);
  }

  function section(title, kids) { return [h('div', { class: 'mx-h', text: title })].concat(kids); }
  /** Encabezado de un SISTEMA (Grupos / Nivel / Ranking): borde de color propio para no mezclarlos. */
  function systemSection(sys, title, kids) { return [h('div', { class: `mx-h mx-h--sys mx-h--${sys}`, text: title })].concat(kids); }
  function cardGrid(kpis, meta, cls, hero) { return h('div', { class: 'mx-grid' + (cls ? ` ${cls}` : '') }, kpis.map((k) => kpiCard(k, meta, hero))); }
  function pick(data, ids) { return ids.map((id) => data.kpis.find((k) => k.id === id)).filter(Boolean); }

  /* ---------- Vistas ---------- */
  function viewInicio(data) {
    const meta = data.meta; const out = [];
    out.push(...section('Indicadores clave', cardGrid(data.kpis, meta, 'mx-grid--6', true)));
    const sig = data.series && data.series.signups; const mc = data.series && data.series.matches_created; const act = data.series && data.series.active_players;
    const presenceOn = !!meta.presenceSince;
    const actNode = presenceOn
      ? chartPanel('Jugadores activos (abrieron la app)', null, act, { meta, title: 'Jugadores activos', note: `Presencia medida desde ${fmtBA(meta.presenceSince, { day: '2-digit', month: '2-digit', year: 'numeric' })}. Antes de esa fecha no hay dato: no se estima.` })
      : panel('Jugadores activos (abrieron la app)', null, h('div', { class: 'mx-empty', text: 'Todavía no medible: la presencia diaria recién empieza a registrarse cuando la captura está activa en este entorno. No se estima hacia atrás.' }));
    const tp = todayPanel(data, ['signups', 'matchesCreated', 'activePlayers']);
    if (tp) out.push(...section('Hoy', tp));
    out.push(...section('Evolución', h('div', { class: 'mx-grid mx-grid--charts' }, [
      chartPanel('Altas', null, sig, { meta, title: 'Altas' }),
      chartPanel('Partidos cargados', null, mc, { meta, title: 'Partidos cargados' }),
      actNode,
    ])));
    out.push(...section('Activación de las altas', funnelPanel(data.funnel || [], meta)));
    out.push(...section('Estado de la recolección', factsPanel(meta)));
    return h('div', null, out);
  }

  function funnelPanel(funnel, meta) {
    const cohort = funnel.find((k) => k.id === 'activation.cohort');
    const rows = funnel.filter((k) => k.id !== 'activation.cohort');
    if (!cohort || cohort.value === 0 || cohort.value === null) {
      return panel('Del alta al 5.º partido', 'Altas con al menos 7 días de antigüedad', h('div', { class: 'mx-empty', text: 'Todavía no hay altas maduras en este período para medir la activación.' }));
    }
    const body = h('div', { class: 'mx-hbars' }, rows.map((k) => {
      const lack = k.availability === 'insufficient_sample' || k.availability === 'not_instrumented' || k.availability === 'immature';
      return h('div', { class: 'mx-hrow' }, [
        h('span', { class: 'mx-hrow__label', text: FUNNEL_LABELS[k.id] || k.label }),
        h('span', { class: 'mx-hrow__val', text: lack ? '—' : formatValue(k, k.value) }),
        h('div', { class: 'mx-hrow__track' }, h('div', lack ? { class: 'mx-hrow__fill mx-hrow__fill--hatch' } : { class: 'mx-hrow__fill', style: `width:${Math.max(2, (k.value || 0) * 100).toFixed(1)}%` })),
        lack ? h('span', { class: 'mx-hrow__why', text: (availabilityView(k, meta) || {}).text || '' }) : (k.count != null ? h('span', { class: 'mx-hrow__why', text: `${fmtNum(k.count)} de ${fmtNum(k.n)} altas` }) : null),
      ]);
    }));
    return panel('Del alta al 5.º partido', `${fmtNum(cohort.value)} altas con al menos 7 días de antigüedad`, body,
      'Las altas más recientes todavía no tuvieron tiempo de activarse y no entran en los porcentajes.');
  }

  function factsPanel(meta) {
    const win = meta.window ? windowLabel(meta.window) : '—';
    const facts = [
      ['Entorno', QA ? 'QA (datos de prueba)' : String(meta.environment || '—')],
      ['Período actual', win],
      ['Período anterior', S.compare && meta.previousWindow ? windowLabel(meta.previousWindow) : (S.compare ? 'No aplica (histórico)' : 'Comparación apagada')],
      ['Criterio de días', 'Días completos, hasta ayer'],
      ['Hoy', 'Parcial: se muestra aparte'],
      ['Corte de datos', fmtBA(meta.asOf, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
      ['Presencia diaria', meta.presenceSince ? `desde ${fmtBA(meta.presenceSince, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'sin captura todavía'],
      ['Cuentas internas', meta.includeInternal ? 'incluidas' : (meta.internalExcluded ? `${fmtNum(meta.internalExcluded)} excluidas` : 'ninguna configurada')],
      ['Privacidad', `segmentos < ${meta.minCell || 5} personas se agrupan`],
      ['Zona horaria', 'Buenos Aires · semanas lun–dom'],
    ];
    return h('section', { class: 'mx-panel' }, h('dl', { class: 'mx-facts' }, facts.map(([k, v]) => h('div', null, [h('dt', { text: k }), h('dd', { text: v })]))));
  }

  function viewUsuarios(data) {
    const meta = data.meta; const out = [];
    out.push(...section('Cuentas', cardGrid(data.kpis, meta, '', false)));
    const tpU = todayPanel(data, ['signups']);
    if (tpU) out.push(...section('Hoy', tpU));
    out.push(...section('Evolución y perfil', h('div', { class: 'mx-grid mx-grid--charts' }, [
      chartPanel('Altas', null, data.series && data.series.signups, { meta, title: 'Altas', note: 'Altas brutas: incluyen cuentas que luego se eliminaron.' }),
      breakdownPanel('Localidad declarada', 'Cuentas actuales · «sin localidad» no equivale a otra localidad', data.breakdowns && data.breakdowns.location),
    ])));
    return h('div', null, out);
  }

  function viewPartidos(data) {
    const meta = data.meta; const out = [];
    out.push(...section('Volumen', cardGrid(pick(data, ['matches.created', 'matches.real', 'matches.annulled', 'matches.validated']), meta, '', false)));
    out.push(...section('Pendientes y vencidos (estado al corte)', cardGrid(pick(data, ['matches.pending_validable', 'matches.pending_waiting_counterpart', 'matches.expired_derived']), meta, '', false)));
    out.push(...section('Validación', cardGrid(pick(data, ['matches.validation_rate_closed', 'matches.validation_p50_hours', 'matches.validation_p90_hours']), meta, '', false)));
    out.push(...section('Participación', cardGrid(pick(data, ['matches.authors', 'matches.registered_participants']), meta, '', false)));
    const ser = data.series || {};
    const tpM = todayPanel(data, ['matchesCreated', 'matchesValidated']);
    if (tpM) out.push(...section('Hoy', tpM));
    out.push(...section('Evolución', h('div', { class: 'mx-grid mx-grid--charts' }, [
      chartPanel('Partidos cargados', 'Fecha en que se registraron', ser.created, { meta, title: 'Partidos cargados', note: 'Fecha de carga: cuándo se registró el partido en BRAMU.' }),
      chartPanel('Partidos jugados', 'Fecha en que se jugaron (sin anulados)', ser.played, { meta, title: 'Partidos jugados', note: 'Los últimos 14 días pueden crecer: la carga retroactiva admite hasta 14 días.' }),
      chartPanel('Partidos validados', 'Fecha de validación', ser.validated, { meta, title: 'Partidos validados' }),
      breakdownPanel('Estado de los partidos cargados', 'Cargados en el período, estado al corte', data.breakdowns && data.breakdowns.status, { labels: STATUS_LABELS }),
    ])));
    return h('div', null, out);
  }

  function viewActivacion(data) {
    const meta = data.meta; const out = [];
    out.push(...section('Cohorte', cardGrid(pick(data, ['activation.cohort', 'activation.cohort_immature']), meta, '', false)));
    out.push(...section('Del alta al 5.º partido', funnelPanel(pick(data, FUNNEL_IDS), meta)));
    out.push(...section('Primeros pasos', cardGrid(pick(data, ['activation.level_initial']), meta, '', false)));
    out.push(...section('Primer partido', [
      cardGrid(pick(data, ['activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.median_days_to_first_load']), meta, '', false),
      h('p', { class: 'mx-note', text: '«Cargó» cuenta a quienes registraron un partido; «Participó» incluye a quienes jugaron un partido que cargó otra persona. Son pasos distintos.' }),
    ]));
    out.push(...section('Participación', cardGrid(pick(data, ['activation.third_match', 'activation.fifth_match']), meta, '', false)));
    out.push(...section('Retorno', [
      cardGrid(pick(data, ['activation.returned_other_week']), meta, '', false),
      h('p', { class: 'mx-note', text: 'Retorno = una acción registrada en una semana posterior a la del alta (indicio retroactivo). La retención medida con presencia diaria está en Uso.' }),
    ]));
    return h('div', null, out);
  }

  function viewComunidad(data) {
    const meta = data.meta; const out = []; const ser = data.series || {}; const bd = data.breakdowns || {};
    out.push(...systemSection('grupos', 'Grupos BRAMU', [
      cardGrid(pick(data, ['community.groups_active', 'community.groups_created', 'community.groups_with_match', 'community.groups_avg_members', 'community.memberships_active']), meta, '', false),
      h('div', { class: 'mx-grid mx-grid--charts', style: 'margin-top:12px' }, [
        chartPanel('Grupos creados', null, ser.groups_created, { meta, title: 'Grupos creados' }),
        breakdownPanel('Grupos por tamaño', 'Grupos vigentes según sus integrantes actuales', bd.group_size, { labels: SIZE_LABELS, order: ORDERS.size, unit: 'grupos' }),
      ]),
    ]));
    out.push(...systemSection('nivel', 'Nivel BRAMU', [
      cardGrid(pick(data, ['community.level_calibrated_share']), meta, '', false),
      h('div', { class: 'mx-grid mx-grid--charts', style: 'margin-top:12px' }, [
        breakdownPanel('Estado del Nivel', 'Cuentas actuales según su calibración', bd.level_status, { labels: LEVEL_LABELS, order: ORDERS.level }),
        breakdownPanel('Distribución por banda', 'Jugadores CALIBRADOS de la última edición de Ranking (banda 1–10)', bd.level_band, {
          labelFn: (l) => [/^band_(\d+)$/.test(l) ? `Banda ${l.slice(5)}` : l, ''],
          order: Array.from({ length: 10 }, (_, i) => `band_${i + 1}`),
          suppressedText: `Sin distribución: hace falta un mínimo de ${(bd.level_band && bd.level_band.minCell) || 10} jugadores con Nivel calibrado en la última edición. Protegemos la privacidad.`,
          emptyText: 'Todavía no hay una edición de Ranking publicada.',
        }),
      ]),
    ]));
    out.push(...systemSection('ranking', 'Ranking BRAMU', [
      cardGrid(pick(data, ['community.ranking_editions', 'community.ranking_days_since_edition', 'community.ranking_eligible_players', 'community.ranking_eligibility_rate']), meta, '', false),
      h('div', { class: 'mx-grid mx-grid--charts', style: 'margin-top:12px' }, [
        breakdownPanel('Universos locales por densidad', 'Última edición publicada; cada universo es una localidad, no personas', bd.ranking_density, {
          labels: DENSITY_LABELS, order: ORDERS.density, unit: 'universos',
          note: 'Se cuentan universos (localidades), no personas. «En formación» muestra «N de total» sin podio; «Consolidado» publica puestos.',
          emptyText: 'Todavía no hay una edición de Ranking publicada.',
        }),
      ]),
    ]));
    out.push(...section('Invitaciones a jugadores sin cuenta', [
      cardGrid(pick(data, ['community.invites_created', 'community.invites_claimed', 'community.invites_open', 'community.invites_expired', 'community.invite_conversion']), meta, '', false),
      h('div', { class: 'mx-grid mx-grid--charts', style: 'margin-top:12px' }, [chartPanel('Invitaciones creadas', null, ser.invites_created, { meta, title: 'Invitaciones creadas' })]),
    ]));
    return h('div', null, out);
  }

  function viewUso(data) {
    const meta = data.meta; const out = []; const ser = data.series || {}; const bd = data.breakdowns || {};
    const presenceOn = !!meta.presenceSince;
    if (!presenceOn) {
      out.push(...section('Presencia diaria', h('section', { class: 'mx-panel' }, h('div', { class: 'mx-empty', text: 'Todavía no medible: la presencia diaria recién empieza a registrarse cuando la captura está activa en este entorno. Nada se estima hacia atrás; los indicadores de abajo muestran desde cuándo se miden.' }))));
    }
    out.push(...section('Actividad (abrieron la app)', cardGrid(pick(data, ['usage.dau', 'usage.wau', 'usage.mau', 'usage.dau_avg']), meta, '', false)));
    const tpUso = todayPanel(data, ['activePlayers']);
    if (tpUso) out.push(...section('Hoy', tpUso));
    out.push(...section('Evolución', h('div', { class: 'mx-grid mx-grid--charts' }, [
      presenceOn
        ? chartPanel('Jugadores activos por día', null, ser.active_players, { meta, title: 'Jugadores activos', note: `Presencia medida desde ${fmtBA(meta.presenceSince, { day: '2-digit', month: '2-digit', year: 'numeric' })}. Antes de esa fecha no hay dato: no se estima.` })
        : panel('Jugadores activos por día', null, h('div', { class: 'mx-empty', text: 'Todavía no medible.' })),
    ])));
    out.push(...section('Retención', [
      cardGrid(pick(data, ['usage.ret_w1', 'usage.ret_w4', 'usage.ret_d1', 'usage.ret_d7', 'usage.ret_d30']), meta, '', false),
      h('p', { class: 'mx-note', text: 'Se calcula sobre altas posteriores al inicio de la captura y con la ventana objetivo ya completa; las cohortes más recientes aparecen como «inmaduras». La lectura principal es semanal (W1, W4).' }),
    ]));
    out.push(...section('Instalación y versiones', [
      cardGrid(pick(data, ['usage.standalone_share']), meta, '', false),
      h('div', { class: 'mx-grid mx-grid--charts', style: 'margin-top:12px' }, [
        breakdownPanel('Plataforma', 'Última presencia de cada jugador en los 7 días hasta el último día completo', bd.platform, { labels: PLATFORM_LABELS }),
        breakdownPanel('Versión de la app', 'Versión con la que abrió cada jugador por última vez', bd.bundle, {}),
      ]),
      h('p', { class: 'mx-note', text: '«Uso desde la app instalada» mide aperturas en modo instalado: no son instalaciones.' }),
    ]));
    out.push(...section('Acciones registradas (retroactivo)', [
      cardGrid(pick(data, ['usage.wau_with_action', 'usage.mau_with_action']), meta, '', false),
      h('p', { class: 'mx-note', text: 'Jugadores con una acción persistida (cargar, validar, grupos, Nivel). No es presencia: sirve para mirar hacia atrás, antes de que existiera la captura.' }),
    ]));
    out.push(...section('Estado de la recolección', factsPanel(meta)));
    return h('div', null, out);
  }

  function viewKpi(id, data) {
    const kpi = data.kpis.find((k) => k.id === id);
    const back = h('a', { class: 'mx-back', href: VIEWS.find((v) => v.id === S.lastTab).hash }, '‹ Volver');
    if (!kpi) return h('div', null, [back, h('div', { class: 'mx-empty', text: 'Este indicador no existe en la versión actual del catálogo.' })]);
    const meta = data.meta; const delta = deltaChip(kpi); const prev = previousText(kpi, S.compare);
    const shown = kpi.availability === 'insufficient_sample' || kpi.availability === 'not_instrumented' || kpi.availability === 'immature';
    const kinds = { stock: 'Saldo al corte', flow: 'Flujo del período', ratio: 'Proporción', duration: 'Duración' };
    const s = seriesFor(id, data);
    const nodes = [back,
      h('div', { class: 'mx-detail__head' }, [h('h1', { class: 'mx-detail__title', text: kpi.label }), h('span', { class: 'mx-kind', text: (kinds[kpi.kind] || kpi.kind) + (kpi.snapshot ? ' · foto del estado actual' : '') })]),
      h('div', { class: 'mx-detail__value' }, [h('span', { class: 'big' + (shown ? ' is-empty' : ''), text: shown ? '—' : formatValue(kpi, kpi.value) }), delta, prev ? h('span', { class: 'mx-prev', text: prev }) : null]),
      stateLine(kpi, meta) ? h('div', { style: 'margin-bottom:16px' }, stateLine(kpi, meta)) : null,
    ];
    if (s) {
      nodes.push(chartPanel(s.def.title + (s.series.granularity === 'week_ba' ? 'semana' : 'día'), null, s.series, { meta, title: kpi.label }));
      nodes.push(h('details', { class: 'mx-details mx-panel' }, [h('summary', { text: 'Ver datos del gráfico' }), dataTable(s.series)]));
    } else {
      nodes.push(h('div', { class: 'mx-panel' }, h('p', { class: 'mx-note', style: 'margin:0', text: 'Este indicador es un valor puntual del período: en esta versión no tiene serie temporal propia.' })));
    }
    nodes.push(h('div', { class: 'mx-h', text: 'Cómo se calcula' }));
    nodes.push(h('section', { class: 'mx-panel' }, h('dl', { class: 'mx-dl' }, [
      h('div', null, [h('dt', { text: 'Definición' }), h('dd', { text: kpi.definition })]),
      h('div', null, [h('dt', { text: 'Población' }), h('dd', { text: kpi.population })]),
      h('div', null, [h('dt', { text: 'Muestra (n)' }), h('dd', { text: kpi.n === null || kpi.n === undefined ? 'No aplica' : fmtNum(kpi.n) })]),
    ])));
    nodes.push(h('p', { class: 'mx-note', text: `Período actual: ${windowLabel(meta.window)} (días completos)` + (S.compare && meta.previousWindow ? ` · anterior: ${windowLabel(meta.previousWindow)}` : '') + '. Solo agregados; no hay datos individuales.' }));
    return h('div', null, nodes);
  }

  function dataTable(series) {
    const prev = S.compare && series.previous;
    const head = h('tr', null, [h('th', { text: series.granularity === 'week_ba' ? 'Semana' : 'Día' }), h('th', { text: 'Actual' }), prev ? h('th', { text: 'Anterior' }) : null]);
    const rows = series.current.map((p, i) => h('tr', null, [h('td', { text: fmtDayMonth(p.start) }), h('td', { text: fmtNum(p.value) }), prev ? h('td', { text: prev[i] ? `${fmtNum(prev[i].value)} (${fmtDayMonth(prev[i].start)})` : '—' }) : null]));
    return h('div', { class: 'mx-scroll' }, h('table', { class: 'mx-table' }, [h('thead', null, head), h('tbody', null, rows)]));
  }

  /* ---------- Orquestación ---------- */
  function renderControls() {
    const rg = $('mx-range'); rg.textContent = '';
    RANGES.forEach((r) => rg.appendChild(h('button', { type: 'button', 'aria-pressed': String(S.range === r.id), text: r.label, onclick: () => { if (S.range !== r.id) { S.range = r.id; savePrefs(); renderControls(); load(false); } } })));
    $('mx-compare').checked = S.compare; $('mx-internal').checked = S.internal;
    const tabs = $('mx-tabs'); tabs.textContent = '';
    const active = S.route.view === 'kpi' ? S.lastTab : S.route.view;
    VIEWS.forEach((v) => tabs.appendChild(h('a', { href: v.hash, 'aria-current': v.id === active ? 'page' : null, text: v.label })));
  }
  function renderWindowLine(meta) {
    const w = $('mx-window'); w.textContent = '';
    if (!meta) return;
    w.appendChild(h('i', { class: 'mx-dot' }));
    w.appendChild(document.createTextNode('Actual '));
    w.appendChild(h('b', { text: windowLabel(meta.window) }));
    if (S.compare && meta.previousWindow) {
      w.appendChild(h('i', { class: 'mx-dot mx-dot--prev' }));
      w.appendChild(document.createTextNode('Anterior '));
      w.appendChild(h('b', { text: windowLabel(meta.previousWindow) }));
    } else if (S.compare) {
      w.appendChild(document.createTextNode(' · sin período anterior (histórico)'));
    }
    w.appendChild(document.createTextNode(' · días completos, hasta ayer'));
  }

  function errorView(err) {
    const msgs = {
      network: ['No pudimos conectar', 'Revisá tu conexión e intentá de nuevo.'],
      server: ['El servidor no pudo calcular las métricas', 'Es un problema nuestro, no tuyo. Probá de nuevo en unos segundos.'],
      rate: ['Demasiados pedidos seguidos', 'Esperá un minuto y actualizá.'],
      bad: ['Pedido inválido', 'La consola envió una consulta que el servidor no acepta. Recargá la página.'],
    };
    const [t, p] = msgs[err.kind] || msgs.server;
    return h('div', { class: 'mx-error', role: 'alert' }, [h('h2', { text: t }), h('p', { text: p }), h('button', { class: 'mx-btn', type: 'button', onclick: () => load(true), text: 'Reintentar' })]);
  }

  async function load(force) {
    const seq = (S.seq += 1);
    const view = $('mx-view'); view.setAttribute('aria-busy', 'true');
    const route = S.route;
    const sectionName = route.view === 'kpi' ? SECTION_OF_PREFIX[route.kpiId.split('.')[0]] : VIEWS.find((v) => v.id === route.view).section;
    const hadData = cache.has(cacheKey(sectionName));
    if (!hadData || force) { view.textContent = ''; view.appendChild(skeletonView()); }
    $('mx-refresh').classList.add('is-spinning');
    try {
      const data = await getSection(sectionName, !!force);
      if (seq !== S.seq) return;
      S.meta = data.meta; setEnvBanner(data.meta);
      renderWindowLine(data.meta);
      $('mx-updated').textContent = `Actualizado ${fmtBA(data.meta.generatedAt, { hour: '2-digit', minute: '2-digit' })}`;
      view.textContent = '';
      const RENDER = { inicio: viewInicio, usuarios: viewUsuarios, partidos: viewPartidos, activacion: viewActivacion, comunidad: viewComunidad, uso: viewUso };
      view.appendChild(route.view === 'kpi' ? viewKpi(route.kpiId, data) : RENDER[route.view](data));
      global.scrollTo(0, 0);
    } catch (err) {
      if (seq !== S.seq) return;
      if (err.kind === 'session') return showGate('session');
      if (err.kind === 'forbidden') return showGate('forbidden');
      if (err.kind === 'env') return showGate('env');
      view.textContent = ''; view.appendChild(errorView(err));
    } finally {
      if (seq === S.seq) { view.setAttribute('aria-busy', 'false'); $('mx-refresh').classList.remove('is-spinning'); }
    }
  }

  function onRoute() {
    const r = parseHash(global.location.hash);
    if (r.view !== 'kpi') S.lastTab = r.view;
    S.route = r;
    renderControls();
    if (!$('mx-app').hidden) load(false);
  }

  function wireControls() {
    $('mx-compare').addEventListener('change', (e) => { S.compare = e.target.checked; savePrefs(); load(false); });
    $('mx-internal').addEventListener('change', (e) => { S.internal = e.target.checked; savePrefs(); load(false); });
    $('mx-refresh').addEventListener('click', () => load(true));
    global.addEventListener('hashchange', onRoute);
  }

  function startApp() {
    loadPrefs(); wireControls(); hideGate(); setEnvBanner(null);
    const r = parseHash(global.location.hash); S.route = r; if (r.view !== 'kpi') S.lastTab = r.view;
    renderControls(); load(false);
  }

  async function boot() {
    if (QA) {
      if (QA_STATE === 'nosession') { setEnvBanner(null); return showGate('nosession'); }
      await new Promise((resolve) => {
        const sc = document.createElement('script'); sc.src = '/admin/metrics/qa-fixture.js';
        sc.onload = resolve; sc.onerror = resolve; document.head.appendChild(sc);
      });
      if (!global.PLMetricsQaFixture) { setEnvBanner(null); return showGate('qaoff'); }
      return startApp();
    }
    if (!env || !env.supabaseUrl || !env.supabaseAnonKey || !global.supabase || !global.supabase.createClient) { setEnvBanner(null); return showGate('config'); }
    setEnvBanner(null);
    client = global.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    let session = null;
    try { session = (await client.auth.getSession()).data.session; } catch (e) { session = null; }
    if (!session) return showGate('nosession');
    client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') showGate('session'); });
    startApp();
  }

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
