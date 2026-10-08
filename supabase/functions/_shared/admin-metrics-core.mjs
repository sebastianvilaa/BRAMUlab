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

  const v = validateMetricsBody(d.body);
  if (!v.ok) return { status: 400, body: { ok: false, code: v.code } };

  let res;
  try { res = await d.callSection(v.fn, v.args); } catch { res = { data: null, error: { message: 'exception' } }; }
  if (!res || res.error || !res.data || res.data.ok !== true) {
    log('failed');
    return { status: 500, body: { ok: false, code: 'metrics_failed' } };
  }
  log('served');
  return { status: 200, body: res.data };
}
