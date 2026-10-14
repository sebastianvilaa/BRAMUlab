/* BRAMUlab web — Vercel Function para un contador agregado. Nodo server-side.
 * Entorno futuro del proyecto WEB (no de la app): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * WEB_METRICS_ALLOWED_ORIGIN=https://bramulab.com
 * Nunca exponer esas claves en JS público. Rechazar peticiones hasta configurar el entorno.
 */
'use strict';
const EVENT_TYPES = new Set(['view', 'click']);
const SOURCES = new Set(['hero', 'login', 'instalacion', 'final', 'other']);

module.exports = async function webMetricsHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  const allowed = process.env.WEB_METRICS_ALLOWED_ORIGIN || '';
  const origin = String(req.headers.origin || '');
  // Same-origin del navegador. Es un control básico anti-uso accidental, NO identidad ni
  // anti-bot infalible: las cabeceras pueden falsificarse desde clientes no-browser.
  if (!allowed || origin !== allowed) return res.status(403).end();
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!/^https:\/\//.test(url) || !key) return res.status(503).end();
  let body;
  try {
    const raw = req.body && typeof req.body === 'object' ? req.body : JSON.parse(String(req.body || ''));
    body = raw && !Array.isArray(raw) ? raw : null;
  } catch (_) { return res.status(400).end(); }
  if (!body || Object.keys(body).length !== 2 || !EVENT_TYPES.has(body.event)
      || (body.event === 'view' && body.source !== 'page')
      || (body.event === 'click' && !SOURCES.has(body.source))) return res.status(400).end();
  try {
    const upstream = await fetch(url.replace(/\/$/, '') + '/rest/v1/rpc/web_analytics_increment', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event_type: body.event, p_source: body.source }),
      signal: AbortSignal.timeout(3000)
    });
    if (!upstream.ok) return res.status(503).end();
    return res.status(204).end();
  } catch (_) { return res.status(503).end(); }
};
