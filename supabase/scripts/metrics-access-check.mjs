// BRAMU Metrics V1 — VERIFICADOR DE ACCESO Y DENEGACIÓN contra un entorno REAL (Staging o Production). Lo corre una persona con sus
// propias credenciales, EN SU TERMINAL: las credenciales viven en variables de entorno, nunca se imprimen y nunca pasan por un chat.
//
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon pública> \
//   ADMIN_EMAIL=… ADMIN_PASSWORD=…   (la cuenta administradora)        \
//   COMMON_EMAIL=… COMMON_PASSWORD=… (una cuenta común, NO admin)       \
//   SITE_URL=https://app.bramulab.com                                   \
//   node supabase/scripts/metrics-access-check.mjs --target production
//
//   --target staging|production   entorno esperado (debe coincidir con `meta.environment` de las respuestas)
//   --allow-presence-write        también prueba `register_app_presence` (ESCRIBE una fila de presencia de la cuenta usada); por defecto NO se escribe
//
// Qué prueba (todo de solo lectura salvo --allow-presence-write):
//   1. Sin credenciales / con la anon key / con un token inválido: 401 en la Edge.
//   2. Cuenta COMÚN: 403 `forbidden` IDÉNTICO para catálogo, secciones, Explorador y cuerpos inválidos (sin oráculo).
//   3. Cuenta ADMINISTRADORA: 200 en las 6 secciones × 4 períodos, catálogo (55), Explorador; 400 con cuerpos inválidos; entorno correcto;
//      sin UUID ni emails en ninguna respuesta; `Cache-Control: no-store`.
//   4. PostgREST DIRECTO con la cuenta común y con anon: no ejecuta ninguna función de métricas y no lee las tablas protegidas.
//   5. Sitio (opcional): `/admin/metrics/` con noindex + no-store, robots.txt, y en Production NO existe el fixture de QA.
// Sale con código 1 si algo FALLA. Lo que no se pudo ejecutar figura como OMITIDA (nunca como aprobada).

const SECTIONS = ['overview', 'users', 'matches', 'activation', 'community', 'usage'];
const RANGES = ['7d', '30d', '90d', 'all'];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;

export async function runChecks({ fetch: f = globalThis.fetch, env, target, allowPresenceWrite = false, log = () => {} }) {
  const results = [];
  const add = (name, status, detail = '') => { results.push({ name, status, detail }); log(`${status.padEnd(6)} ${name}${detail ? ' — ' + detail : ''}`); };
  const url = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY;
  if (!url || !anon) { add('configuración', 'FALLA', 'faltan SUPABASE_URL / SUPABASE_ANON_KEY'); return results; }
  const edge = `${url}/functions/v1/admin-metrics`;

  const call = async (token, body, { apikey = anon } = {}) => {
    const headers = { 'Content-Type': 'application/json', apikey };
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await f(edge, { method: 'POST', headers, body: JSON.stringify(body) });
    let json = null; const text = await r.text(); try { json = JSON.parse(text); } catch { /* no JSON */ }
    return { status: r.status, json, text, headers: r.headers };
  };
  const signIn = async (email, password) => {
    const r = await f(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anon }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => null);
    return r.ok && j && j.access_token ? j.access_token : null;
  };
  const signOut = async (token) => { try { await f(`${url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}` } }); } catch { /* best effort */ } };

  // ---- 1. sin sesión ----
  const nA = await call(null, { catalog: true }, {}); add('1a sin Authorization → 401', nA.status === 401 ? 'OK' : 'FALLA', `HTTP ${nA.status}`);
  const nB = await call(anon, { catalog: true }); add('1b con la anon key como Bearer → 401', nB.status === 401 ? 'OK' : 'FALLA', `HTTP ${nB.status}`);
  const nC = await call('abc.def.ghi', { catalog: true }); add('1c con un token inválido → 401', nC.status === 401 ? 'OK' : 'FALLA', `HTTP ${nC.status}`);

  // ---- 2. cuenta común ----
  let common = null; let admin = null;
  try {
    if (env.COMMON_EMAIL && env.COMMON_PASSWORD) common = await signIn(env.COMMON_EMAIL, env.COMMON_PASSWORD);
    if (!common) add('2 cuenta común', 'OMITIDA', 'sin COMMON_EMAIL/COMMON_PASSWORD o no pudo iniciar sesión');
    else {
      const bodies = [{ catalog: true }, { section: 'overview' }, { metric: 'users.signups' }, { metric: 'no.existe', filter: { id: 'x', value: 'y' } }, { foo: 1 }, { section: 'users', range: 'custom' }];
      const outs = []; let ok = true;
      for (const b of bodies) { const r = await call(common, b); outs.push(`${r.status}|${r.text}`); if (r.status !== 403 || !r.json || r.json.code !== 'forbidden') ok = false; }
      add('2a cuenta común → 403 `forbidden` en catálogo, secciones, Explorador y cuerpos inválidos', ok ? 'OK' : 'FALLA', ok ? '' : outs.map((o) => o.slice(0, 40)).join(' · '));
      add('2b las respuestas 403 son idénticas (no se puede sondear)', new Set(outs).size === 1 ? 'OK' : 'FALLA');
    }
  } finally { /* el cierre de sesión se hace al final */ }

  // ---- 3. administradora ----
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) admin = await signIn(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  if (!admin) add('3 cuenta administradora', 'OMITIDA', 'sin ADMIN_EMAIL/ADMIN_PASSWORD o no pudo iniciar sesión');
  else {
    let fails = []; let leak = false; let envOk = true; let noStore = true;
    for (const s of SECTIONS) for (const range of RANGES) {
      const r = await call(admin, { section: s, range, compare: range !== 'all' });
      if (r.status !== 200 || !r.json || r.json.ok !== true) fails.push(`${s}/${range}:${r.status}`);
      else { if (r.json.meta && r.json.meta.environment !== target) envOk = false; if (UUID.test(r.text) || EMAIL.test(r.text)) leak = true; if (!/no-store/i.test(r.headers.get('cache-control') || '')) noStore = false; }
    }
    add('3a 6 secciones × 4 períodos → 200 (administradora)', fails.length ? 'FALLA' : 'OK', fails.slice(0, 5).join(', '));
    add(`3b meta.environment = ${target} en todas`, envOk ? 'OK' : 'FALLA');
    add('3c sin UUID ni emails en ninguna respuesta', leak ? 'FALLA' : 'OK');
    add('3d Cache-Control: no-store', noStore ? 'OK' : 'FALLA');
    const cat = await call(admin, { catalog: true });
    add('3e catálogo del Explorador (55 indicadores)', cat.status === 200 && cat.json && cat.json.catalog && cat.json.catalog.length === 55 ? 'OK' : 'FALLA', `HTTP ${cat.status}, ${cat.json && cat.json.catalog ? cat.json.catalog.length : '?'} indicadores`);
    let exFails = [];
    if (cat.json && cat.json.catalog) for (const e of cat.json.catalog) { const r = await call(admin, { metric: e.id, range: '30d' }); if (r.status !== 200 || !r.json || r.json.ok !== true || UUID.test(r.text) || EMAIL.test(r.text)) exFails.push(e.id); }
    add('3f Explorador: los 55 indicadores responden 200 sin datos personales', exFails.length ? 'FALLA' : 'OK', exFails.slice(0, 5).join(', '));
    const bad = [[{ metric: 'no.existe' }, 400, 'invalid_metric'], [{ metric: 'users.signups', filter: { id: 'platform', value: 'ios' } }, 400, 'invalid_filter'],
      [{ section: 'users', range: 'custom' }, 400, 'range_not_supported'], [{ section: 'users', extra: 1 }, 400, 'invalid_payload'], [{ section: 'users', metric: 'users.signups' }, 400, 'invalid_payload'],
      [{ metric: 'users.signups', range: '1d' }, 400, 'invalid_range']];
    let bf = [];
    for (const [b, st, code] of bad) { const r = await call(admin, b); if (r.status !== st || !r.json || r.json.code !== code) bf.push(`${code}:${r.status}`); }
    add('3g cuerpos inválidos → 400 con código acotado', bf.length ? 'FALLA' : 'OK', bf.join(', '));
  }

  // ---- 4. PostgREST directo ----
  const rest = async (token, method, p, body) => {
    const headers = { apikey: anon, 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`;
    const r = await f(`${url}/rest/v1/${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* */ }
    return { status: r.status, json: j, text: t };
  };
  for (const [label, token] of [['anon', null], ['cuenta común', common]]) {
    if (label !== 'anon' && !token) { add(`4 PostgREST directo (${label})`, 'OMITIDA', 'sin sesión de cuenta común'); continue; }
    const t = token || anon;
    let bad = [];
    for (const fn of ['metrics_overview', 'metrics_is_admin', 'metrics_explore', 'metrics_explore_catalog', '_metrics_catalog']) {
      const r = await rest(t, 'POST', `rpc/${fn}`, fn === 'metrics_is_admin' ? { p_auth_user_id: '00000000-0000-0000-0000-000000000000' } : fn === 'metrics_explore' ? { p_metric: 'users.signups' } : {});
      if (r.status === 200) bad.push(`${fn}:200`);
    }
    for (const tb of ['metrics_admins', 'metrics_internal_players', 'player_activity_days', 'pilot_events']) {
      const r = await rest(t, 'GET', `${tb}?select=*&limit=1`);
      if (r.status === 200 && Array.isArray(r.json) && r.json.length > 0) bad.push(`${tb}:filas`);
    }
    add(`4 PostgREST directo (${label}): ninguna función de métricas ejecutable y ninguna tabla protegida legible`, bad.length ? 'FALLA' : 'OK', bad.join(', '));
  }
  {
    const r = await rest(null, 'POST', 'rpc/register_app_presence', { p_display_mode: 'browser', p_platform: 'ios', p_app_bundle: null });
    add('4b register_app_presence sin sesión (anon) → denegado', r.status !== 200 ? 'OK' : 'FALLA', `HTTP ${r.status}`);
    if (allowPresenceWrite && common) {
      const w = await rest(common, 'POST', 'rpc/register_app_presence', { p_display_mode: 'browser', p_platform: 'desktop', p_app_bundle: null });
      add('4c register_app_presence con sesión → ok (escribe SOLO la fila propia)', w.status === 200 && w.json && w.json.ok === true ? 'OK' : 'FALLA', `HTTP ${w.status}`);
    } else add('4c register_app_presence con sesión (escritura)', 'OMITIDA', 'requiere --allow-presence-write');
  }

  // ---- 5. sitio ----
  const site = String(env.SITE_URL || '').replace(/\/+$/, '');
  if (!site) add('5 sitio', 'OMITIDA', 'sin SITE_URL');
  else {
    const page = await f(`${site}/admin/metrics/`, { redirect: 'manual' });
    if (page.status !== 200) add('5a /admin/metrics/ responde 200', 'FALLA', `HTTP ${page.status} (¿Vercel Authentication?)`);
    else {
      add('5a /admin/metrics/ responde 200', 'OK');
      add('5b /admin/metrics/: X-Robots-Tag noindex y Cache-Control no-store', /noindex/i.test(page.headers.get('x-robots-tag') || '') && /no-store/i.test(page.headers.get('cache-control') || '') ? 'OK' : 'FALLA');
      const rb = await (await f(`${site}/robots.txt`)).text();
      add('5c robots.txt', (target === 'production' ? /Disallow:\s*\/admin\//.test(rb) && /Allow:\s*\//.test(rb) : /Disallow:\s*\/\s*$/m.test(rb)) ? 'OK' : 'FALLA', rb.replace(/\s+/g, ' ').slice(0, 80));
      const fx = await f(`${site}/admin/metrics/qa-fixture.js`);
      add('5d el fixture de QA ' + (target === 'production' ? 'NO está publicado' : '(Staging: puede estar)'), target === 'production' ? (fx.status === 404 ? 'OK' : 'FALLA') : 'OK', `HTTP ${fx.status}`);
      const v = await (await f(`${site}/version.json?x=${Date.now()}`)).json().catch(() => null);
      add('5e version.json', v && v.bundle ? 'OK' : 'FALLA', v ? `bundle ${v.bundle}` : '');
    }
  }
  if (common) await signOut(common);
  if (admin) await signOut(admin);
  return results;
}

export const summarize = (results) => ({ ok: results.filter((r) => r.status === 'OK').length, fail: results.filter((r) => r.status === 'FALLA').length, skipped: results.filter((r) => r.status === 'OMITIDA').length });

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--target');
  const target = ti >= 0 ? args[ti + 1] : null;
  if (!['staging', 'production'].includes(target)) { console.error('Falta --target staging|production'); process.exit(2); }
  const results = await runChecks({ env: process.env, target, allowPresenceWrite: args.includes('--allow-presence-write'), log: (l) => console.log(l) });
  const s = summarize(results);
  console.log(`\nRESUMEN: ${s.ok} OK · ${s.fail} FALLAN · ${s.skipped} OMITIDAS (no ejecutadas: NO cuentan como aprobadas)`);
  process.exit(s.fail ? 1 : 0);
}
