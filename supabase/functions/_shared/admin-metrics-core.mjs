// BRAMU Metrics V1 · F2 — decisión de negocio de la Edge Function `admin-metrics` (sin I/O: todo se inyecta; se prueba en Node).
// Orden NO negociable: JWT válido -> administrador autorizado en servidor -> rate limit -> validación del body -> RPC fija.
// La identidad sale SIEMPRE del JWT; el body jamás elige jugador, función ni SQL. Respuesta de «no autorizado» idéntica para
// cuenta común, administrador revocado o inexistente (sin oráculo de existencia).

/** Sección -> función SQL. MAPA FIJO: nunca se concatena un nombre que venga del cliente. */
export const SECTION_FUNCTIONS = Object.freeze({
  overview: 'metrics_overview',
  users: 'metrics_users',
  matches: 'metrics_matches',
  activation: 'metrics_activation',
  community: 'metrics_community',
  usage: 'metrics_usage',
});
/** `custom` queda reservado: la UI de rango manual llega en una fase posterior (BRAMU_Metrics_UX_V1.md). */
export const RANGES = Object.freeze(['7d', '30d', '90d', 'all']);
const BODY_KEYS = new Set(['section', 'range', 'compare', 'includeInternal']);
/** F6 — Explorar. Modos del MISMO endpoint y MISMA autorización: `{catalog:true}` o `{metric, range?, compare?, includeInternal?, filter?:{id,value}}`.
 *  El cliente nunca envía SQL, tablas ni columnas: solo un id del catálogo (el SQL lo valida contra `_metrics_catalog`) y, opcionalmente,
 *  UN filtro declarado para ese indicador (el SQL lo valida contra `_metrics_explore_spec`). */
const EXPLORE_KEYS = new Set(['metric', 'range', 'compare', 'includeInternal', 'filter']);
const METRIC_ID = /^[a-z]+\.[a-z0-9_]{1,48}$/;
const FILTER_ID = /^[a-z_]{1,24}$/;
/** Códigos de negocio que el SQL devuelve con ok:false y que se traducen a 400 (todo lo demás sigue siendo 500 genérico). */
export const EXPLORE_CLIENT_ERRORS = Object.freeze(['invalid_metric', 'invalid_filter', 'invalid_filter_value']);

export function validateMetricsBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'invalid_payload' };
  for (const k of Object.keys(body)) if (!BODY_KEYS.has(k)) return { ok: false, code: 'invalid_payload' };
  if (typeof body.section !== 'string' || !Object.prototype.hasOwnProperty.call(SECTION_FUNCTIONS, body.section)) return { ok: false, code: 'invalid_section' };
  const range = body.range === undefined ? '30d' : body.range;
  if (range === 'custom') return { ok: false, code: 'range_not_supported' };
  if (typeof range !== 'string' || !RANGES.includes(range)) return { ok: false, code: 'invalid_range' };
  if (body.compare !== undefined && typeof body.compare !== 'boolean') return { ok: false, code: 'invalid_payload' };
  if (body.includeInternal !== undefined && typeof body.includeInternal !== 'boolean') return { ok: false, code: 'invalid_payload' };
  return {
    ok: true,
    section: body.section,
    fn: SECTION_FUNCTIONS[body.section],
    args: { p_range: range, p_compare: body.compare === undefined ? true : body.compare, p_include_internal: body.includeInternal === true },
  };
}

export function validateExploreBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, code: 'invalid_payload' };
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'catalog') {
    return body.catalog === true ? { ok: true, mode: 'catalog', fn: 'metrics_explore_catalog', args: {} } : { ok: false, code: 'invalid_payload' };
  }
  for (const k of keys) if (!EXPLORE_KEYS.has(k)) return { ok: false, code: 'invalid_payload' };
  if (typeof body.metric !== 'string' || body.metric.length > 64 || !METRIC_ID.test(body.metric)) return { ok: false, code: 'invalid_metric' };
  const range = body.range === undefined ? '30d' : body.range;
  if (range === 'custom') return { ok: false, code: 'range_not_supported' };
  if (typeof range !== 'string' || !RANGES.includes(range)) return { ok: false, code: 'invalid_range' };
  if (body.compare !== undefined && typeof body.compare !== 'boolean') return { ok: false, code: 'invalid_payload' };
  if (body.includeInternal !== undefined && typeof body.includeInternal !== 'boolean') return { ok: false, code: 'invalid_payload' };
  let filter = null; let value = null;
  if (body.filter !== undefined && body.filter !== null) {
    const f = body.filter;
    if (typeof f !== 'object' || Array.isArray(f) || Object.keys(f).some((k) => k !== 'id' && k !== 'value')) return { ok: false, code: 'invalid_filter' };
    if (typeof f.id !== 'string' || !FILTER_ID.test(f.id)) return { ok: false, code: 'invalid_filter' };
    // el valor es texto libre acotado: nunca se concatena en SQL, solo se compara con las opciones que el propio SQL calcula
    if (typeof f.value !== 'string' || f.value.length < 1 || f.value.length > 120 || /[\u0000-\u001f\u007f]/.test(f.value)) return { ok: false, code: 'invalid_filter_value' };
    filter = f.id; value = f.value;
  }
  return {
    ok: true, mode: 'metric', fn: 'metrics_explore',
    args: { p_metric: body.metric, p_range: range, p_compare: body.compare === undefined ? true : body.compare, p_include_internal: body.includeInternal === true, p_filter: filter, p_value: value },
  };
}

/** Elige el modo por la forma del body (section => panel; metric/catalog => Explorar). Mezclar modos es inválido. */
export function validateAnyBody(body) {
  if (body && typeof body === 'object' && !Array.isArray(body) && ('metric' in body || 'catalog' in body)) {
    if ('section' in body) return { ok: false, code: 'invalid_payload' };
    return validateExploreBody(body);
  }
  return validateMetricsBody(body);
}

/**
 * @param {object} d  { jwt, body, getUser(jwt)->{id}|null, isAdmin(authUserId)->boolean, withinRateLimit(authUserId)->boolean,
 *                      callSection(fn, args)->{data,error}, log?(code) }
 * @returns {{status:number, body:object}}
 */
export async function handleAdminMetrics(d) {
  const log = d.log || (() => {});
  if (!d.jwt) return { status: 401, body: { ok: false, code: 'missing_authorization' } };

  let user = null;
  try { user = await d.getUser(d.jwt); } catch { user = null; }
  if (!user || !user.id) return { status: 401, body: { ok: false, code: 'invalid_session' } };

  let admin = false;
  try { admin = (await d.isAdmin(user.id)) === true; } catch { admin = false; }
  if (!admin) {
    log('denied');
    return { status: 403, body: { ok: false, code: 'forbidden' } };
  }

  let allowed = true;
  try { allowed = (await d.withinRateLimit(user.id)) !== false; } catch { allowed = true; }
  if (!allowed) return { status: 429, body: { ok: false, code: 'rate_limited' } };

  const v = validateAnyBody(d.body);
  if (!v.ok) return { status: 400, body: { ok: false, code: v.code } };

  let res;
  try { res = await d.callSection(v.fn, v.args); } catch { res = { data: null, error: { message: 'exception' } }; }
  if (res && !res.error && res.data && res.data.ok === false && v.mode === 'metric' && EXPLORE_CLIENT_ERRORS.includes(res.data.code)) {
    log('rejected');
    return { status: 400, body: { ok: false, code: res.data.code } };
  }
  if (!res || res.error || !res.data || res.data.ok !== true) {
    log('failed');
    return { status: 500, body: { ok: false, code: 'metrics_failed' } };
  }
  log('served');
  return { status: 200, body: res.data };
}
