// BRAMUlab Metrics · Web: seguridad de admin, contrato sin perfiles y captura de clics.
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateMetricsBody, handleAdminMetrics } from '../../supabase/functions/_shared/admin-metrics-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Sección Web en whitelist fija con rangos admitidos y rechazo de payload malicioso', () => {
  const r = validateMetricsBody({ section: 'web', range: '30d' });
  assert.equal(r.ok, true); assert.equal(r.fn, 'metrics_web');
  assert.equal(validateMetricsBody({ section: 'web', range: '42d' }).ok, false);
  assert.equal(validateMetricsBody({ section: 'web', sql: 'select * from players' }).ok, false);
});

test('Usuario no administrador no puede consultar Web', async () => {
  let reached = false;
  const res = await handleAdminMetrics({
    jwt: 'mock', body: { section: 'web' },
    getUser: async () => ({ id: 'test' }), isAdmin: async () => false,
    withinRateLimit: async () => true,
    callSection: async () => { reached = true; return { data: { ok: true } }; },
  });
  assert.equal(res.status, 403); assert.equal(reached, false);
});

test('Solo administrador puede leer agregados y no se cambia el control de identidad', async () => {
  const res = await handleAdminMetrics({
    jwt: 'mock', body: { section: 'web', range: '7d' },
    getUser: async () => ({ id: 'test' }), isAdmin: async () => true,
    withinRateLimit: async () => true,
    callSection: async (fn, args) => {
      assert.equal(fn, 'metrics_web'); assert.equal(args.p_range, '7d');
      return { data: { ok: true, web: { instrumented: false } } };
    },
  });
  assert.equal(res.status, 200);
});

test('DB evita acceso anónimo y persiste solo día, evento, origen, total', () => {
  const sql = read('supabase/migrations/20261013220000_web_public_daily_analytics.sql');
  assert.match(sql, /revoke all on public\.web_analytics_daily from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.metrics_web\(text,boolean,boolean\) from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.web_analytics_increment\(text,text\) from public, anon, authenticated/);
  assert.match(sql, /primary key \(day, event_type, source\)/);
  assert.doesNotMatch(sql, /\b(cookie|ip_address|auth_user_id|player_id|email)\s+text\b/i);
});

test('Web pública deja el enlace original y registra solo eventos mínimos', () => {
  const script = read('bramulab-web/js/web-metrics.js');
  const endpoint = read('bramulab-web/api/metrics.js');
  assert.match(script, /navigator\.sendBeacon/);
  assert.match(script, /u\.origin !== APP_URL/);
  assert.match(script, /dataSet|dataset\.bramuCta/);
  assert.match(endpoint, /WEB_METRICS_ALLOWED_ORIGIN/);
  assert.match(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(endpoint, /web_analytics_increment/);
  assert.doesNotMatch(script, /window\.localStorage|document\.cookie|fingerprint\(/);
});
