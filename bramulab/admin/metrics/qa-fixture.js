/* BRAMU Metrics V1 · F3 — FIXTURE DE QA. Datos INVENTADOS para revisar la interfaz sin backend: NO son datos de ningún entorno.
 * Solo se publica en builds de Staging (build-dist.mjs lo retira en cualquier otro entorno) y metrics.js solo lo carga con ?qa=1 fuera de
 * Production. Cada pantalla muestra el banner «DATOS DE PRUEBA (QA) · NO PRODUCTION». El catálogo es copia EXACTA del de la migración
 * 20261008110000 (un test falla si divergen); los valores son arbitrarios pero respetan el contrato real (availability, delta, previous).
 *
 * Estados forzables: ?qa=1&qastate=empty | nopresence | error | forbidden | nosession | loading | sparse
 */
(function (g) {
  'use strict';
  var CATALOG = [
    {"id": "users.registered_now", "section": "users", "label": "Cuentas registradas", "kind": "stock", "definition": "Cuentas con email confirmado, activas y no eliminadas, al corte", "population": "players registrados, is_active, sin deleted_at"},
    {"id": "users.signups", "section": "users", "label": "Altas", "kind": "flow", "definition": "Cuentas que confirmaron el email en la ventana (brutas: incluye las luego eliminadas)", "population": "players registrados con created_at en la ventana"},
    {"id": "users.guests_open", "section": "users", "label": "Invitados vigentes", "kind": "stock", "definition": "Jugadores provisionales que no fueron recuperados en una cuenta", "population": "players provisionales sin recovered_into_player_id ni deleted_at"},
    {"id": "users.profile_complete", "section": "users", "label": "Perfiles completos", "kind": "stock", "definition": "Cuentas actuales con @usuario definido", "population": "cuentas registradas actuales"},
    {"id": "users.profile_complete_rate", "section": "users", "label": "Perfiles completos (%)", "kind": "ratio", "minN": 5, "definition": "Perfiles completos sobre cuentas actuales", "population": "cuentas registradas actuales"},
    {"id": "users.with_location_rate", "section": "users", "label": "Con localidad declarada (%)", "kind": "ratio", "minN": 5, "definition": "Cuentas actuales con localidad declarada (sin localidad no equivale a otra localidad)", "population": "cuentas registradas actuales"},
    {"id": "matches.created", "section": "matches", "label": "Partidos cargados", "kind": "flow", "definition": "Partidos creados en la ventana, en cualquier estado (hecho operativo, incluye anulados)", "population": "matches con created_at en la ventana"},
    {"id": "matches.real", "section": "matches", "label": "Partidos reales cargados", "kind": "flow", "definition": "Partidos creados en la ventana que no fueron anulados", "population": "matches con created_at en la ventana y status distinto de annulled"},
    {"id": "matches.annulled", "section": "matches", "label": "Partidos anulados", "kind": "flow", "definition": "Partidos creados en la ventana que hoy están anulados (duplicado, carga retirada o administrativa)", "population": "matches con created_at en la ventana y status annulled"},
    {"id": "matches.validated", "section": "matches", "label": "Partidos validados", "kind": "flow", "definition": "Partidos cuya validación ocurrió dentro de la ventana", "population": "matches validated con validated_at en la ventana"},
    {"id": "matches.pending_validable", "section": "matches", "label": "Pendientes validables", "kind": "stock", "definition": "Cargados en la ventana, plazo vigente y ambas parejas con al menos una cuenta registrada", "population": "cohorte de la ventana, estado al corte"},
    {"id": "matches.pending_waiting_counterpart", "section": "matches", "label": "Pendientes esperando contraparte", "kind": "stock", "definition": "Cargados en la ventana, plazo vigente y una pareja sin cuentas registradas (no se validan solos)", "population": "cohorte de la ventana, estado al corte"},
    {"id": "matches.expired_derived", "section": "matches", "label": "Vencidos sin validar", "kind": "stock", "definition": "Pendientes cuyo plazo venció (estado derivado: el servidor no escribe expired)", "population": "cohorte de la ventana, estado al corte"},
    {"id": "matches.validation_rate_closed", "section": "matches", "label": "Validados entre validables con plazo cerrado (%)", "kind": "ratio", "minN": 5, "definition": "Validados / (validados + vencidos con ambas parejas con cuenta), cohorte de la ventana", "population": "cohorte de la ventana con plazo cerrado"},
    {"id": "matches.validation_p50_hours", "section": "matches", "label": "Mediana de validación (h)", "kind": "duration", "minN": 5, "definition": "Horas entre carga y validación", "population": "validados con validated_at en la ventana"},
    {"id": "matches.validation_p90_hours", "section": "matches", "label": "P90 de validación (h)", "kind": "duration", "minN": 5, "definition": "Percentil 90 de horas entre carga y validación", "population": "validados con validated_at en la ventana"},
    {"id": "matches.authors", "section": "matches", "label": "Autores únicos", "kind": "flow", "definition": "Jugadores distintos que cargaron al menos un partido real", "population": "matches reales con created_at en la ventana"},
    {"id": "matches.registered_participants", "section": "matches", "label": "Participantes con cuenta", "kind": "flow", "definition": "Cuentas registradas distintas que participaron en partidos reales", "population": "matches reales con created_at en la ventana"},
    {"id": "activation.cohort", "section": "activation", "label": "Cohorte madura de altas", "kind": "flow", "definition": "Altas de la ventana con al menos 7 días de antigüedad (las más recientes todavía no tuvieron tiempo de activarse)", "population": "players registrados con alta en la ventana y antigüedad mayor o igual a 7 días"},
    {"id": "activation.cohort_immature", "section": "activation", "label": "Altas todavía inmaduras", "kind": "flow", "definition": "Altas de la ventana con menos de 7 días: no entran en los porcentajes", "population": "players registrados con alta en la ventana y antigüedad menor a 7 días"},
    {"id": "activation.level_initial", "section": "activation", "label": "Completó Nivel inicial (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con estimador inicial confirmado", "population": "cohorte madura"},
    {"id": "activation.loaded_first", "section": "activation", "label": "Cargó su 1.er partido (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura que cargó al menos un partido real (autor)", "population": "cohorte madura"},
    {"id": "activation.participated_first", "section": "activation", "label": "Participó en un partido (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con al menos un partido real como participante (autor o no)", "population": "cohorte madura"},
    {"id": "activation.participated_validated", "section": "activation", "label": "Participó en un partido validado (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con al menos un partido validado como participante", "population": "cohorte madura"},
    {"id": "activation.third_match", "section": "activation", "label": "Llegó al 3.er partido (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con 3 o más partidos reales como participante", "population": "cohorte madura"},
    {"id": "activation.fifth_match", "section": "activation", "label": "Llegó al 5.º partido (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con 5 o más partidos reales como participante", "population": "cohorte madura"},
    {"id": "activation.returned_other_week", "section": "activation", "label": "Volvió con una acción otra semana (%)", "kind": "ratio", "minN": 5, "definition": "Cohorte madura con una acción de usuario registrada en una semana BA posterior a la de su alta (proxy retroactivo; la presencia exacta está en Uso)", "population": "cohorte madura"},
    {"id": "activation.median_days_to_first_load", "section": "activation", "label": "Días del alta a la 1.ª carga (mediana)", "kind": "duration", "minN": 5, "definition": "Mediana de días entre el alta y el primer partido real cargado", "population": "cohorte madura que cargó"},
    {"id": "community.groups_active", "section": "community", "label": "Grupos vigentes", "kind": "stock", "definition": "Grupos con estado activo al corte", "population": "groups status active"},
    {"id": "community.groups_created", "section": "community", "label": "Grupos creados", "kind": "flow", "definition": "Grupos creados en la ventana (incluye los luego eliminados)", "population": "groups con created_at en la ventana"},
    {"id": "community.memberships_active", "section": "community", "label": "Membresías activas", "kind": "stock", "definition": "Pertenencias vigentes a grupos vigentes de cuentas no eliminadas", "population": "group_memberships sin left_at en grupos activos"},
    {"id": "community.invites_created", "section": "community", "label": "Invitaciones creadas", "kind": "flow", "definition": "Enlaces de invitación generados en la ventana", "population": "provisional_claims con created_at en la ventana"},
    {"id": "community.invites_claimed", "section": "community", "label": "Invitaciones canjeadas", "kind": "flow", "definition": "Invitaciones canjeadas dentro de la ventana", "population": "provisional_claims claimed con claimed_at en la ventana"},
    {"id": "community.invites_open", "section": "community", "label": "Invitaciones abiertas", "kind": "stock", "definition": "Pendientes con vencimiento futuro al corte", "population": "provisional_claims pending no vencidos"},
    {"id": "community.invites_expired", "section": "community", "label": "Invitaciones vencidas sin canjear", "kind": "stock", "definition": "Pendientes con vencimiento pasado (derivado: el estado expired solo se escribe al intentar canjear)", "population": "provisional_claims pending vencidos"},
    {"id": "community.invite_conversion", "section": "community", "label": "Invitaciones canjeadas (%)", "kind": "ratio", "minN": 5, "definition": "Canjeadas / (canjeadas + vencidas sin canjear), de las creadas en la ventana", "population": "invitaciones de la ventana ya resueltas"},
    {"id": "community.ranking_editions", "section": "community", "label": "Ediciones de Ranking publicadas", "kind": "flow", "definition": "Ediciones semanales publicadas en la ventana", "population": "ranking_editions con published_at en la ventana"},
    {"id": "usage.dau", "section": "usage", "label": "Activos del día (abrieron la app)", "kind": "flow", "definition": "Jugadores distintos con presencia en el último día de la ventana (apertura real autenticada, no último login)", "population": "player_activity_days del día"},
    {"id": "usage.wau", "section": "usage", "label": "Activos 7 días", "kind": "flow", "definition": "Jugadores distintos con presencia en los últimos 7 días (no se suman DAU)", "population": "player_activity_days de 7 días"},
    {"id": "usage.mau", "section": "usage", "label": "Activos 30 días", "kind": "flow", "definition": "Jugadores distintos con presencia en los últimos 30 días", "population": "player_activity_days de 30 días"},
    {"id": "usage.dau_avg", "section": "usage", "label": "Promedio diario de activos", "kind": "flow", "definition": "Promedio de activos por día dentro de la ventana, desde que hay presencia", "population": "días con presencia instrumentada"},
    {"id": "usage.standalone_share", "section": "usage", "label": "Uso desde la app instalada (%)", "kind": "ratio", "minN": 5, "definition": "Días de presencia abiertos en modo app instalada. Es uso, NO instalaciones", "population": "días de presencia de la ventana"},
    {"id": "usage.wau_with_action", "section": "usage", "label": "Con acción 7 días", "kind": "flow", "definition": "Jugadores distintos con una acción de usuario registrada en 7 días (retroactivo; no es presencia)", "population": "acciones de usuario persistidas"},
    {"id": "usage.mau_with_action", "section": "usage", "label": "Con acción 30 días", "kind": "flow", "definition": "Jugadores distintos con una acción de usuario registrada en 30 días (retroactivo; no es presencia)", "population": "acciones de usuario persistidas"},
    {"id": "usage.ret_w1", "section": "usage", "label": "Retención semanal W1 (%)", "kind": "ratio", "minN": 5, "definition": "Altas con presencia en la semana BA siguiente a la de su alta (solo cohortes maduras y posteriores al inicio de la presencia)", "population": "altas de la ventana con semana objetivo completa"},
    {"id": "usage.ret_w4", "section": "usage", "label": "Retención semanal W4 (%)", "kind": "ratio", "minN": 5, "definition": "Altas con presencia en la 4.ª semana BA posterior a la de su alta", "population": "altas de la ventana con semana objetivo completa"},
    {"id": "usage.ret_d1", "section": "usage", "label": "Retención D1 (%)", "kind": "ratio", "minN": 5, "definition": "Altas con presencia exactamente al día siguiente", "population": "altas de la ventana con el día objetivo completo"},
    {"id": "usage.ret_d7", "section": "usage", "label": "Retención D7 (%)", "kind": "ratio", "minN": 5, "definition": "Altas con presencia exactamente 7 días después", "population": "altas de la ventana con el día objetivo completo"},
    {"id": "usage.ret_d30", "section": "usage", "label": "Retención D30 (%)", "kind": "ratio", "minN": 5, "definition": "Altas con presencia exactamente 30 días después", "population": "altas de la ventana con el día objetivo completo"}
  ];
  var BY_ID = {}; CATALOG.forEach(function (e) { BY_ID[e.id] = e; });
  var FACTOR = { '7d': 0.3, '30d': 1, '90d': 2.6, all: 3.4 };
  var DAYS = { '7d': 7, '30d': 30, '90d': 90, all: 200 };
  var MIN_N = 5;

  /* id: [valor, n, valorPrevio, nPrevio, extras]  (valores para la ventana de 30 días) */
  var BASE = {
    'users.registered_now': [38, 38], 'users.signups': [12, null, 9], 'users.guests_open': [17], 'users.profile_complete': [35],
    'users.profile_complete_rate': [0.92, 38, 0.9, 33], 'users.with_location_rate': [0.74, 38, 0.7, 33],
    'matches.created': [46, null, 31], 'matches.real': [41, null, 28], 'matches.annulled': [5, null, 3], 'matches.validated': [29, null, 18],
    'matches.pending_validable': [4], 'matches.pending_waiting_counterpart': [5], 'matches.expired_derived': [3],
    'matches.validation_rate_closed': [0.9, 32, 0.78, 23], 'matches.validation_p50_hours': [9.5, 29, 14.2, 18], 'matches.validation_p90_hours': [41, 29, 52, 18],
    'matches.authors': [17, null, 12], 'matches.registered_participants': [33, null, 24],
    'activation.cohort': [19], 'activation.cohort_immature': [3],
    'activation.level_initial': [0.84, 19, 0.8, 14], 'activation.loaded_first': [0.47, 19, 0.43, 14], 'activation.participated_first': [0.79, 19, 0.71, 14],
    'activation.participated_validated': [0.68, 19, 0.57, 14], 'activation.third_match': [0.42, 19, 0.36, 14], 'activation.fifth_match': [0.21, 19, 0.14, 14],
    'activation.returned_other_week': [0.53, 19, 0.5, 14], 'activation.median_days_to_first_load': [4.5, 4, 6, 3],
    'community.groups_active': [6], 'community.groups_created': [2, null, 1], 'community.memberships_active': [31], 'community.invites_created': [14, null, 9],
    'community.invites_claimed': [6, null, 4], 'community.invites_open': [5], 'community.invites_expired': [3], 'community.invite_conversion': [0.67, 9, 0.6, 5],
    'community.ranking_editions': [4, null, 4],
    'usage.dau': [4, null, 3], 'usage.wau': [14, null, 11], 'usage.mau': [27, null, 22], 'usage.dau_avg': [5.2, 10, 4.1, 8], 'usage.standalone_share': [0.58, 61, 0.52, 44],
    'usage.wau_with_action': [12, null, 10], 'usage.mau_with_action': [26, null, 20],
    'usage.ret_w1': ['immature'], 'usage.ret_w4': ['immature'], 'usage.ret_d1': [0.4, 3, null, 0], 'usage.ret_d7': ['immature'], 'usage.ret_d30': ['immature']
  };
  var PRESENCE_ID = /^usage\.(dau|wau|mau|dau_avg|standalone_share|ret_)/;

  function ymd(d) { return d.toISOString().slice(0, 10); }
  function baToday() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return new Date(parts + 'T00:00:00Z');
  }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  function mondayOf(d) { var wd = (d.getUTCDay() + 6) % 7; return addDays(d, -wd); }
  function isoAtBaMidnight(d) { return ymd(d) + 'T03:00:00.000Z'; }

  function windows(range) {
    var today = baToday(); var n = DAYS[range];
    var from = addDays(today, -(n - 1));
    var w = { range: range, from: isoAtBaMidnight(from), to: new Date().toISOString(), days: n, granularity: n <= 45 ? 'day' : 'week_ba', fromD: from, today: today };
    if (range === 'all') { w.prevFrom = null; w.prevTo = null; } else { w.prevFrom = isoAtBaMidnight(addDays(from, -n)); w.prevTo = isoAtBaMidnight(from); w.prevFromD = addDays(from, -n); }
    return w;
  }

  function weights(len, seed) {
    var out = []; for (var i = 0; i < len; i += 1) out.push(1 + Math.abs(Math.sin((i + 1) * (seed + 1.3))) * 3 + (i % 7 === 5 || i % 7 === 6 ? 1.2 : 0));
    return out;
  }
  function distribute(total, ws) {
    var sum = ws.reduce(function (a, b) { return a + b; }, 0) || 1; var raw = ws.map(function (x) { return (x / sum) * total; });
    var out = raw.map(Math.floor); var rest = total - out.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (r, i) { return [r - Math.floor(r), i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, rest).forEach(function (p) { out[p[1]] += 1; });
    return out;
  }
  function buckets(startD, endD, gran) {
    var out = []; var d = gran === 'week_ba' ? mondayOf(startD) : startD;
    while (d.getTime() <= endD.getTime()) { out.push(ymd(d)); d = addDays(d, gran === 'week_ba' ? 7 : 1); }
    return out;
  }
  function series(w, total, prevTotal, seed, compare, empty) {
    var cur = buckets(w.fromD, w.today, w.granularity);
    var cv = distribute(empty ? 0 : total, weights(cur.length, seed));
    var res = { granularity: w.granularity, current: cur.map(function (s, i) { return { start: s, value: cv[i] }; }), previous: null };
    if (compare && w.prevFrom) {
      var pe = addDays(w.fromD, -1); var prev = buckets(w.prevFromD, pe, w.granularity);
      var pv = distribute(empty ? 0 : prevTotal, weights(prev.length, seed + 4));
      res.previous = prev.map(function (s, i) { return { start: s, value: pv[i] }; });
    }
    return res;
  }

  function scaleVal(entry, id, f, isPrev) {
    var b = BASE[id]; var kind = entry.kind;
    var v = isPrev ? b[2] : b[0]; var n = isPrev ? b[3] : b[1];
    if (isPrev && kind === 'stock') return { v: b[0], n: b[0] };
    if (v === 'immature') return { v: null, a: 'immature' };
    if (v === undefined || v === null) return null;
    if (kind === 'flow') return { v: Math.round(v * f) };
    if (kind === 'stock') return { v: v, n: v };
    return { v: v, n: n == null ? null : Math.max(0, Math.round(n * f)) };
  }

  function build(entry, cur, prev, compare) {
    var minN = entry.minN; var kind = entry.kind;
    function avail(x) {
      if (!x) return null;
      if (x.a) return x.a;
      if (minN && (x.n == null || x.n < minN)) return 'insufficient_sample';
      if (kind === 'flow' && !x.v) return 'no_evidence';
      return 'ok';
    }
    var ca = avail(cur); var pa = avail(prev);
    var delta = { abs: null, pct: null, note: 'sin_comparacion' };
    if (compare && prev) {
      if (kind === 'stock') delta.note = 'stock_sin_comparacion';
      else if (['ok', 'no_evidence'].indexOf(ca) < 0 || ['ok', 'no_evidence'].indexOf(pa) < 0 || cur.v == null || prev.v == null) delta.note = 'sin_datos_suficientes';
      else if (kind === 'ratio') { delta.abs = Math.round((cur.v - prev.v) * 1000) / 10; delta.note = 'puntos_porcentuales'; }
      else { delta.abs = Math.round((cur.v - prev.v) * 100) / 100; if (prev.v > 0) { delta.pct = Math.round(((cur.v - prev.v) / prev.v) * 1000) / 10; delta.note = null; } else delta.note = 'base_previa_cero'; }
      if (delta.note === null) delta.note = null;
    }
    var hide = ['insufficient_sample', 'not_instrumented', 'immature'].indexOf(ca) >= 0;
    return {
      id: entry.id, label: entry.label, kind: kind, definition: entry.definition, population: entry.population,
      value: hide ? null : cur.v, count: hide || kind !== 'ratio' || cur.n == null ? null : Math.round(cur.v * cur.n), n: cur.n == null ? null : cur.n,
      previous: compare && prev ? { value: ['ok', 'no_evidence'].indexOf(pa) >= 0 ? prev.v : null, n: prev.n == null ? null : prev.n, availability: pa } : null,
      delta: delta, availability: ca, since: cur.since || null
    };
  }

  function kpisFor(sectionName, w, compare, st) {
    var f = FACTOR[w.range]; var out = [];
    var presenceSince = st === 'nopresence' ? null : ymd(addDays(w.today, -9));
    CATALOG.forEach(function (e) {
      if (e.section !== sectionName) return;
      var cur = scaleVal(e, e.id, f, false); var prev = compare && w.prevFrom ? scaleVal(e, e.id, f, true) : null;
      if (st === 'empty') {
        cur = e.kind === 'flow' ? { v: 0 } : e.kind === 'stock' ? { v: 0, n: 0 } : { v: null, n: 0 };
        prev = prev ? Object.assign({}, cur) : null;
      }
      if (st === 'sparse') { if (e.kind === 'ratio' || e.kind === 'duration') { cur = Object.assign({}, cur, { n: 2 }); } }
      if (PRESENCE_ID.test(e.id) && !(cur && cur.a === 'immature')) {
        if (!presenceSince) { cur = { v: null, a: 'not_instrumented' }; prev = prev ? { v: null, a: 'not_instrumented' } : null; }
        else {
          cur = Object.assign({}, cur, { a: cur.a || (e.minN && (cur.n == null || cur.n < e.minN) ? 'insufficient_sample' : 'ok'), since: presenceSince });
          if (prev) prev = { v: null, a: 'not_instrumented' };
        }
      }
      out.push(build(e, cur, prev, compare));
    });
    return out;
  }

  function meta(w, compare, internal, st) {
    var hasPrev = !!w.prevFrom;
    return {
      environment: 'qa', catalogVersion: 'metrics_v1-qa', generatedAt: new Date().toISOString(), asOf: new Date().toISOString(), tz: 'America/Argentina/Buenos_Aires',
      range: w.range, compare: compare && hasPrev, window: [w.from, w.to], previousWindow: hasPrev ? [w.prevFrom, w.prevTo] : null, granularity: w.granularity,
      presenceSince: st === 'nopresence' ? null : addDays(w.today, -9).toISOString(), includeInternal: !!internal, internalExcluded: internal ? 0 : 2, minCell: 5
    };
  }

  function respond(body, st) {
    var range = body.range || '30d'; var compare = body.compare !== false; var w = windows(range); var f = FACTOR[range]; var empty = st === 'empty';
    var cmp = compare && !!w.prevFrom;
    var sec = body.section;
    var res = { ok: true, section: sec, meta: meta(w, compare, body.includeInternal, st), kpis: [], series: {}, breakdowns: {} };
    var sig = function () { return series(w, Math.round(12 * f), Math.round(9 * f), 1, cmp, empty); };
    var created = function () { return series(w, Math.round(46 * f), Math.round(31 * f), 2, cmp, empty); };
    var active = function () { return series(w, Math.round(14 * f), Math.round(11 * f), 5, cmp, empty || st === 'nopresence'); };
    if (sec === 'overview') {
      var ids = ['users.registered_now', 'users.signups', 'usage.wau', 'matches.created', 'matches.validated', 'community.groups_active'];
      var all = [].concat(kpisFor('users', w, cmp, st), kpisFor('matches', w, cmp, st), kpisFor('usage', w, cmp, st), kpisFor('community', w, cmp, st));
      res.kpis = ids.map(function (id) { return all.filter(function (k) { return k.id === id; })[0]; });
      var fids = ['activation.cohort', 'activation.level_initial', 'activation.loaded_first', 'activation.participated_first', 'activation.participated_validated', 'activation.third_match', 'activation.fifth_match'];
      var act = kpisFor('activation', w, cmp, st);
      res.funnel = fids.map(function (id) { return act.filter(function (k) { return k.id === id; })[0]; });
      res.series = { signups: sig(), matches_created: created(), active_players: active() };
      delete res.breakdowns;
    } else {
      res.kpis = kpisFor(sec, w, cmp, st);
      if (sec === 'users') {
        res.series = { signups: sig() };
        res.breakdowns = { location: empty ? { items: [], suppressed: true, minCell: 5 } : { items: [{ label: 'Bella Vista, Buenos Aires', n: 14 }, { label: 'San Miguel, Buenos Aires', n: 9 }, { label: 'Otros (n<5)', n: 15 }], suppressed: false, minCell: 5 } };
      } else if (sec === 'matches') {
        res.series = { created: created(), played: series(w, Math.round(44 * f), Math.round(30 * f), 3, cmp, empty), validated: series(w, Math.round(29 * f), Math.round(18 * f), 4, cmp, empty) };
        res.breakdowns = { status: { suppressed: false, items: empty ? [] : [{ label: 'annulled_admin', n: 1 }, { label: 'annulled_author_retracted', n: 1 }, { label: 'annulled_duplicate', n: 3 }, { label: 'expired_derived', n: 3 }, { label: 'pending', n: 9 }, { label: 'validated', n: 29 }] } };
      } else if (sec === 'usage') {
        res.series = { active_players: active() };
        res.breakdowns = { platform: { items: [], suppressed: true, minCell: 5 }, bundle: { items: [], suppressed: true, minCell: 5 } };
      } else if (sec === 'community') {
        res.breakdowns = { level_status: { items: [], suppressed: true, minCell: 5 } };
      } else { res.breakdowns = {}; }
    }
    return res;
  }

  g.PLMetricsQaFixture = {
    CATALOG: CATALOG,
    get: function (body, st) {
      var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      if (st === 'loading') return new Promise(function () {});
      return sleep(350).then(function () {
        if (st === 'error') { var e = new Error('network'); e.kind = 'network'; throw e; }
        if (st === 'forbidden') { var f = new Error('forbidden'); f.kind = 'forbidden'; f.status = 403; throw f; }
        return respond(body || {}, st || '');
      });
    },
    respond: respond,
    __build: build
  };
})(typeof window !== 'undefined' ? window : globalThis);
