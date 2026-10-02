// BRAMUlab — V04.20 (Pre-Production grande, Issue #16): L2 (owner-scoped + WhatsApp on-demand), L3 técnico
// (páginas legales, Acceso y seguridad, eliminación autoservicio, acceso/copia) y cierre operativo de L1 (cron seguro).
// node --test bramulab/v0420-l2-l3.test.mjs
// Backend: supabase/tests/verify-preprod-v0420-*.sql (BEGIN/ROLLBACK, los corre Central en Staging).
// Núcleos server-side: supabase/functions/_shared/{self-delete-core,abandoned-signups-core}.test.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const readRepo = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const appJs = read('app.js');
const authJs = read('auth.js');
const storeJs = read('store.js');
const indexHtml = read('index.html');
const plain = (x) => JSON.parse(JSON.stringify(x));

function between(src, start, end) {
  const a = src.indexOf(start); assert.ok(a >= 0, `no se encontró: ${start.slice(0, 60)}`);
  const b = src.indexOf(end, a + start.length); assert.ok(b >= 0, `no se encontró fin: ${end.slice(0, 60)}`);
  return src.slice(a, b);
}
function makeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; }
function loadStore(local = makeStorage()) {
  const sb = { console, localStorage: local, Date, JSON, Math, Object, Array, String, Number, Map, Set, Promise, setTimeout, clearTimeout };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(storeJs, sb);
  return { Store: sb.PLStore || sb.Store, local };
}
function loadAuth(supabaseLib, env = { name: 'staging', supabaseUrl: 'https://x.test', supabaseAnonKey: 'k' }) {
  const sb = { console, Object, Array, String, Number, Promise, JSON, Math, location: { hostname: 'x.vercel.app' }, __BRAMU_ENV__: env, supabase: supabaseLib };
  sb.window = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(authJs, sb);
  return sb.PLAuth;
}
const asUser = (Store, id, extra = {}) => Store.cacheServerUser(Object.assign({ id, email: `${id}@x.test`, displayName: id, serverBacked: true }, extra));

/* ================= L2 — owner-scoped ================= */
test('L2: outbox / cache de partidos / cambios no vistos están AISLADOS por cuenta (A nunca ve lo de B)', () => {
  const { Store } = loadStore();
  asUser(Store, 'pA');
  Store.saveMatchOutboxEntry({ localDraftId: 'dA', state: 'sync_pending', payload: { secret: 'de A' } });
  Store.saveServerMatchesCache([{ matchId: 'mA' }]);
  Store.addHistoryUnseenChanges(['mA']);
  asUser(Store, 'pB');
  assert.deepEqual(plain(Store.loadMatchOutbox()), []);
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), []);
  assert.deepEqual(plain(Store.loadHistoryUnseenChanges()), []);
  assert.equal(Store.getMatchOutboxEntry('dA'), null);
  Store.saveMatchOutboxEntry({ localDraftId: 'dB', state: 'sync_pending' });
  asUser(Store, 'pA');
  assert.deepEqual(plain(Store.loadMatchOutbox()).map((e) => e.localDraftId), ['dA'], 'A conserva lo suyo y solo lo suyo');
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), [{ matchId: 'mA' }]);
  assert.deepEqual(plain(Store.loadHistoryUnseenChanges()), ['mA']);
});

test('L2: los formatos legacy GLOBALES (v1) se invalidan y borran al cargar el store (no se atribuyen a nadie)', () => {
  const local = makeStorage();
  local.setItem('bramulab.matchOutbox.v1', JSON.stringify([{ localDraftId: 'viejo', payload: { pii: 1 } }]));
  local.setItem('bramulab.serverMatchesCache.v1', JSON.stringify({ matches: [{ matchId: 'x' }] }));
  local.setItem('bramulab.historyUnseenChanges.v1', JSON.stringify(['x']));
  const { Store } = loadStore(local);
  ['bramulab.matchOutbox.v1', 'bramulab.serverMatchesCache.v1', 'bramulab.historyUnseenChanges.v1'].forEach((k) => assert.equal(local.getItem(k), null, k));
  asUser(Store, 'pA');
  assert.deepEqual(plain(Store.loadMatchOutbox()), []);
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), []);
});

test('L2: cerrar sesión purga caches re-descargables del dueño pero CONSERVA su outbox sin enviar (aislada por dueño)', () => {
  const { Store } = loadStore();
  asUser(Store, 'pA');
  Store.saveMatchOutboxEntry({ localDraftId: 'dA', state: 'sync_pending' });
  Store.saveServerMatchesCache([{ matchId: 'mA' }]);
  Store.addHistoryUnseenChanges(['mA']);
  Store.logoutSession();
  asUser(Store, 'pA');
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), [], 'cache purgado al logout');
  assert.deepEqual(plain(Store.loadHistoryUnseenChanges()), []);
  assert.deepEqual(plain(Store.loadMatchOutbox()).map((e) => e.localDraftId), ['dA'], 'trabajo no enviado se conserva');
});

test('L2: cambio de cuenta sin logout explícito tampoco filtra datos (aislamiento por dueño activo)', () => {
  const { Store } = loadStore();
  asUser(Store, 'pA'); Store.saveServerMatchesCache([{ matchId: 'mA' }]);
  asUser(Store, 'pB');
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), []);
});

test('L3: purgeOwnerLocalData elimina TODO rastro privado del dueño (outbox, caches, cuenta, sesión, notificaciones, historial) y NADA de otra cuenta', () => {
  const { Store, local } = loadStore();
  asUser(Store, 'pA'); asUser(Store, 'pB');
  for (const id of ['pA', 'pB']) {
    asUser(Store, id);
    Store.saveMatchOutboxEntry({ localDraftId: `d_${id}`, state: 'sync_pending' });
    Store.saveServerMatchesCache([{ matchId: `m_${id}` }]);
    Store.addHistoryUnseenChanges([`m_${id}`]);
    Store.addNotification({ userId: id, type: 'x', category: 'info', title: 't', body: 'b' });
    Store.addPlayerToList(id, 'Jugador Uno');
  }
  local.setItem('bramulab.history.v1', JSON.stringify([{ id: 1, userId: 'pA' }, { id: 2, userId: 'pB' }]));
  local.setItem('bramulab.signupDraft.v1', JSON.stringify({ email: 'a@x.test' }));
  asUser(Store, 'pA');
  assert.equal(Store.purgeOwnerLocalData('pA'), true);
  assert.equal(Store.getCurrentUser(), null, 'sesión cerrada');
  assert.ok(!JSON.parse(local.getItem('bramulab.users.v1')).some((u) => u.id === 'pA'), 'cuenta A fuera de USERS');
  assert.deepEqual(JSON.parse(local.getItem('bramulab.history.v1')).map((m) => m.userId), ['pB']);
  assert.equal(local.getItem('bramulab.signupDraft.v1'), null);
  assert.deepEqual(plain(Store.loadNotifications('pA')), []);
  assert.deepEqual(plain(Store.loadAddedPlayers('pA')), []);
  // B intacto
  asUser(Store, 'pB');
  assert.deepEqual(plain(Store.loadMatchOutbox()).map((e) => e.localDraftId), ['d_pB']);
  assert.deepEqual(plain(Store.loadServerMatchesCache().matches), [{ matchId: 'm_pB' }]);
  assert.deepEqual(plain(Store.loadHistoryUnseenChanges()), ['m_pB']);
  assert.equal(Store.loadNotifications('pB').length, 1);
  assert.equal(Store.loadAddedPlayers('pB').length, 1);
  assert.equal(Store.purgeOwnerLocalData(null), false);
});

test('L2: el esquema owner-scoped no deja claves globales del dispositivo para los 3 stores', () => {
  ['MATCH_OUTBOX', 'SERVER_MATCHES_CACHE', 'HISTORY_UNSEEN_CHANGES'].forEach((k) => assert.match(storeJs, new RegExp(`${k}: 'bramulab\\.[A-Za-z]+\\.v2'`), k));
  assert.ok(!/safeSet\(KEYS\.(MATCH_OUTBOX|SERVER_MATCHES_CACHE|HISTORY_UNSEEN_CHANGES)/.test(storeJs), 'nada escribe estos stores sin scope');
});

/* ================= L2 — WhatsApp on-demand ================= */
test('WhatsApp: app.js ya no lee whatsapp_phone del perfil público; solo whatsapp_contact_available', () => {
  assert.ok(!/p\.whatsapp_phone|\.whatsapp_phone\b/.test(appJs.replace(/\/\/.*$/gm, '')), 'sin lectura de whatsapp_phone en código');
  assert.match(appJs, /p\.whatsapp_contact_available === true/);
});

test('WhatsApp: el número se pide SOLO al tocar; se abre con el número recién obtenido; consentimiento revocado => aviso y botón oculto', async () => {
  const code = between(appJs, "$('#player-public-whatsapp-btn').addEventListener('click', async () => {", "\n  // V03.0.1 (§1) — nombres de pestaña");
  const handler = code.slice(code.indexOf('async () => {'), code.lastIndexOf('});'));
  function run({ result, local = null, target = 'pB', popup = true }) {
    const opened = []; const toasts = [];
    const btn = { disabled: false, hidden: false };
    const sb = {
      $: () => btn, playerPublicWhatsappPhone: local, playerPublicWhatsappTargetId: target,
      PLI: { buildWhatsAppContactUrl: (ph) => (ph ? `https://wa.me/${ph.replace(/\D/g, '')}` : null) },
      WHATSAPP_CONTACT_MESSAGE: 'hola',
      Auth: { getWhatsAppContact: async (id) => { sb.asked = (sb.asked || []).concat(id); return result; } },
      showToast: (m) => toasts.push(m),
      window: { open: (...a) => { opened.push(['open', ...a]); return popup ? { location: { replace: (u) => opened.push(['replace', u]) }, close: () => opened.push(['close']) } : null; }, location: { set href(v) { opened.push(['href', v]); } } },
    };
    vm.createContext(sb);
    vm.runInContext(`async function __h(){ ${handler.replace(/^async \(\) => \{/, '')} }`, sb);
    return { go: () => sb.__h(), opened, toasts, btn, sb };
  }
  const ok = run({ result: { ok: true, phone: '+5491122334455' } });
  assert.equal(ok.sb.asked, undefined, 'nada se pide al abrir el perfil (solo al tocar)');
  await ok.go();
  assert.deepEqual(ok.sb.asked, ['pB']);
  assert.deepEqual(ok.opened, [['open', 'about:blank', '_blank'], ['replace', 'https://wa.me/5491122334455']]);
  const revoked = run({ result: { ok: false, code: 'unavailable' } });
  await revoked.go();
  assert.ok(revoked.opened.some((o) => o[0] === 'close'));
  assert.equal(revoked.btn.hidden, true);
  assert.equal(revoked.toasts.length, 1);
  const limited = run({ result: { ok: false, code: 'rate_limited' } });
  await limited.go();
  assert.equal(limited.btn.hidden, false, 'rate limit no oculta el botón');
  const blocked = run({ result: { ok: true, phone: '+5491100000000' }, popup: false });
  await blocked.go();
  assert.ok(blocked.opened.some((o) => o[0] === 'href'), 'sin popup => navega en la misma pestaña');
  const none = run({ result: { ok: true, phone: 'x' }, target: null });
  await none.go();
  assert.equal(none.sb.asked, undefined, 'sin target no hay llamada');
});

test('WhatsApp: Auth.getWhatsAppContact mapea el contrato y no expone el teléfono en otros casos', async () => {
  const mk = (resp) => loadAuth({ createClient: () => ({ rpc: async () => resp }) });
  assert.deepEqual(plain(await mk({ data: { ok: true, phone: '+54911' }, error: null }).getWhatsAppContact('p')), { ok: true, phone: '+54911' });
  assert.deepEqual(plain(await mk({ data: { ok: false, code: 'unavailable' }, error: null }).getWhatsAppContact('p')), { ok: false, code: 'unavailable' });
  assert.equal((await mk({ data: null, error: { message: 'rate_limited' } }).getWhatsAppContact('p')).code, 'rate_limited');
  assert.equal((await mk({ data: { ok: true }, error: null }).getWhatsAppContact('p')).ok, false, 'respuesta sin phone => no disponible');
});

test('WhatsApp (migración): get_public_profile sin teléfono; get_whatsapp_contact authenticated + rate limit + consentimiento vigente', () => {
  const sql = readRepo('supabase/migrations/20260930300000_preprod_v0420_whatsapp_on_demand.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.ok(!/then pr\.phone/.test(code) && !/whatsapp_phone/.test(code.replace(/'[^']*'/g, '')), 'get_public_profile ya no devuelve el número');
  assert.match(code, /whatsapp_contact_available boolean/);
  assert.match(code, /pr\.allow_whatsapp_contact and pr\.phone is not null/);
  assert.match(code, /consume_rate_limit\(v_caller, 'get_whatsapp_contact', 10, 60\)/);
  assert.match(code, /and pr\.allow_whatsapp_contact\s+and pr\.phone is not null/);
  assert.match(code, /grant execute on function public\.get_whatsapp_contact\(uuid\) to authenticated/);
  assert.match(code, /revoke all on function public\.get_whatsapp_contact\(uuid\) from anon/);
  assert.match(code, /drop function if exists public\.get_public_profile\(uuid\)/);
});

/* ================= L1 operativo — cron seguro ================= */
test('Cron: secreto aleatorio generado server-side en Vault; ningún secreto en repo ni dependencia de la service role key', () => {
  const sql = readRepo('supabase/migrations/20260930310000_preprod_v0420_cleanup_cron_secret.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.match(code, /vault\.create_secret\(\s*replace\(gen_random_uuid\(\)::text \|\| gen_random_uuid\(\)::text/);
  assert.match(code, /decrypted_secret from vault\.decrypted_secrets where name = 'cleanup_abandoned_signups_cron_secret'/);
  assert.match(code, /cron\.schedule\('cleanup-abandoned-signups', '17 \* \* \* \*'/);
  assert.match(code, /invalid_function_url/);
  assert.match(code, /perform cron\.unschedule\(jobid\) from cron\.job where jobname = 'cleanup-abandoned-signups'/, 'idempotente');
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(sql), 'sin JWT/keys en el repo');
  ['ensure_cleanup_cron_secret()', 'verify_cleanup_cron_secret(text)', 'schedule_cleanup_abandoned_signups(text)', 'unschedule_cleanup_abandoned_signups()'].forEach((sig) => {
    assert.match(code, new RegExp(`revoke all on function public\\.${sig.replace(/[()]/g, '\\$&')} from public, anon, authenticated`));
    assert.match(code, new RegExp(`grant execute on function public\\.${sig.replace(/[()]/g, '\\$&')} to service_role`));
  });
  assert.ok(!fs.existsSync(path.join(__dirname, '../supabase/scripts/schedule-cleanup-abandoned-signups.sql')), 'el script manual con service key fue retirado');
});

test('Cron: la Edge Function acepta la service key O el secreto del cron validado por RPC; 403 en otro caso; sin borrar confirmados', () => {
  const edge = readRepo('supabase/functions/cleanup-abandoned-signups/index.ts');
  assert.match(edge, /token === SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /req\.headers\.get\('x-cron-secret'\)/);
  assert.match(edge, /rpc\('verify_cleanup_cron_secret'/);
  assert.match(edge, /if \(!authorized\) return jsonResponse\(\{ ok: false, code: 'forbidden' \}, 403\)/);
  assert.match(edge, /cleanupAbandonedSignups/);
  const core = readRepo('supabase/functions/_shared/abandoned-signups-core.mjs');
  assert.match(core, /if \(user\.email_confirmed_at \|\| user\.phone_confirmed_at \|\| user\.last_sign_in_at\) return false;/);
});

/* ================= L3 — páginas legales ================= */
const PAGES = { terminos: 'Términos y Condiciones', privacidad: 'Política de Privacidad', 'eliminar-cuenta': 'Eliminar mi cuenta' };
test('Legal: las 3 páginas públicas existen, se leen sin sesión ni JS, con versión, vigencia pendiente, contacto y enlaces cruzados', () => {
  for (const [slug, title] of Object.entries(PAGES)) {
    const html = read(`${slug}/index.html`);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, new RegExp(`<title>${title} · BRAMUlab</title>`));
    assert.ok(!/<script/i.test(html), `${slug}: sin JavaScript`);
    assert.match(html, /data-legal-version="legal_v1"/);
    assert.match(html, /Versión legal <strong>legal_v1<\/strong>/);
    assert.match(html, /\[\[PENDIENTE_PRODUCCION:fecha_vigencia\]\]/);
    assert.match(html, /mailto:bramulab@gmail\.com/);
    ['/terminos/', '/privacidad/', '/eliminar-cuenta/'].forEach((p) => assert.match(html, new RegExp(`href="${p}"`), `${slug} enlaza ${p}`));
  }
});

test('Legal: la versión de las páginas coincide con la versión vigente sembrada en la migración L1', () => {
  const sql = readRepo('supabase/migrations/20260930280000_preprod_l1_legal_acceptance_abandoned_signups.sql');
  assert.match(sql, /insert into public\.legal_versions \(legal_version\) values \('legal_v1'\)/);
  assert.match(sql, /legal_version text not null default 'legal_v1'/);
});

test('Legal: alineadas con la fuente maestra — SIN 13+/parental; eliminación autoservicio por OTP; acceso/copia por email; Jugador eliminado', () => {
  const all = Object.keys(PAGES).map((s) => read(`${s}/index.html`)).join('\n');
  assert.ok(!/13 años|mayor de 13|menores de 13|autorizaci[oó]n parental|adulto responsable|responsabilidad parental/i.test(all), 'sin restricción 13+ ni flujo parental');
  const terms = read('terminos/index.html'); const priv = read('privacidad/index.html'); const del = read('eliminar-cuenta/index.html');
  assert.match(terms + priv, /no impone por decisión de producto una edad mínima/);
  assert.match(del, /Mi perfil → Mis datos → Acceso y seguridad → Eliminar mi cuenta/);
  assert.match(del, /código/);
  assert.match(del, /Jugador eliminado/);
  assert.match(del, /sin período de arrepentimiento|no hay un período de arrepentimiento/);
  assert.match(priv, /Solicitar copia de mis datos/);
  assert.match(terms, /24 horas/);
  assert.match(terms, /sin aviso previo/);
  assert.ok(!/TERMS_VERSION|piloto_v1|versión piloto/i.test(all));
  assert.ok(!/\[DATO A COMPLETAR\]|\[DECISIÓN ABIERTA\]|\[VERIFICACIÓN OPERATIVA\]/.test(all), 'sin marcas de borrador viejas');
});

test('Legal: los datos desconocidos usan SOLO el formato guardado [[PENDIENTE_PRODUCCION:clave]] (nunca inventados)', () => {
  const all = Object.keys(PAGES).map((s) => read(`${s}/index.html`)).join('\n');
  const keys = [...new Set([...all.matchAll(/\[\[PENDIENTE_PRODUCCION:([a-z0-9_]+)\]\]/g)].map((m) => m[1]))].sort();
  assert.deepEqual(keys, ['domicilio_responsable', 'fecha_vigencia', 'nombre_legal_responsable', 'plazos_backups_logs', 'proveedor_base_datos_y_auth_region', 'proveedor_email_transaccional', 'proveedor_hosting_region', 'registro_aaip_rnbdp', 'transferencias_internacionales']);
  assert.ok(!/CUIT\s*[:=]?\s*\d|CUIL\s*[:=]?\s*\d|\b\d{2}-\d{8}-\d\b/.test(all), 'sin CUIT/CUIL inventados');
  assert.ok(!/us-east|sa-east|eu-west|Frankfurt|São Paulo/i.test(all), 'sin regiones inventadas');
});

test('Legal: enlaces desde alta, gate de reaceptación, Acceso y seguridad y flujo de eliminación (sin login)', () => {
  assert.equal((indexHtml.match(/href="terminos\/"/g) || []).length >= 2, true, 'alta + gate (G2: en Configuración se abre in-app)');
  assert.equal((indexHtml.match(/href="privacidad\/"/g) || []).length >= 2, true);
  assert.match(indexHtml, /id="settings-terms-row"/);
  assert.match(indexHtml, /id="settings-copy-row"/);
  assert.match(indexHtml, /href="eliminar-cuenta\/"/);
  const gate = between(indexHtml, 'id="view-legal-gate"', '</section>');
  assert.match(gate, /href="terminos\/"/); assert.match(gate, /href="privacidad\/"/);
  assert.match(gate, /legal-gate-logout-btn/);
});

/* ================= L3 — Acceso y seguridad ================= */
test('Sesiones: Cerrar sesión es LOCAL (bug latente: signOut() sin scope era GLOBAL); others/global explícitos', async () => {
  const calls = [];
  const Auth = loadAuth({ createClient: () => ({ auth: { signOut: async (a) => { calls.push(plain(a)); return { error: null }; } } }) });
  await Auth.signOut(); await Auth.signOutCurrent(); await Auth.signOutOthers(); await Auth.signOutAll(); await Auth.signOut('raro');
  assert.deepEqual(calls, [{ scope: 'local' }, { scope: 'local' }, { scope: 'others' }, { scope: 'global' }, { scope: 'local' }]);
});

test('Sesiones: eventos sensibles (cambio de contraseña, recuperación, cambio de email) cierran las DEMÁS sesiones', () => {
  const change = between(appJs, "const result = await Auth.updatePassword(next);\n      submitBtn.disabled = false;\n      if (!result.ok) {\n        $('#change-password-error')", "openSettings(); // G2: se llega desde Configuración\n      showToast('Contraseña actualizada');");
  assert.match(change, /Auth\.signOutOthers\(\)/);
  const forgot = between(appJs, "$('#forgot-password-new-error').textContent = 'No pudimos actualizar la contraseña. Probá de nuevo.';", 'else await resumeServerSession({ afterLogin: true });');
  assert.match(forgot, /Auth\.signOutOthers\(\)/);
  assert.match(between(appJs, "if (accountFlow.step === 'email-code') {", "if (accountFlow.step === 'confirm-delete')"), /Auth\.signOutOthers\(\)/);
  assert.match(between(appJs, "$('#logout-all-confirm-btn').addEventListener", '\n'), /Auth\.signOutAll\(\)/);
});

test('Configuración: filas sensibles solo para cuentas con backend real y email; sin listado de dispositivos', () => {
  const i0 = appJs.indexOf('  function openSettings() {');
  const r = appJs.slice(i0, i0 + 900);
  assert.match(r, /settings-email-row'\)\.hidden = !settingsServerAccess\(\)/);
  assert.match(r, /settings-delete-row'\)\.hidden = !settingsServerAccess\(\)/);
  assert.match(appJs, /user\.serverBacked && user\.email && Auth\.isConfigured\(\)/);
  assert.ok(!/dispositivos activos|lista de sesiones|IP de|ubicaci[oó]n de inicio/i.test(indexHtml), 'sin listado avanzado de dispositivos');
});

function runAccountFlow({ step, mode = 'email', values = {}, auth = {}, user = { id: 'pA', email: 'a@x.test' }, deletionAttempted = false, newEmail = null, emailVerified = false }) {
  const src = between(appJs, '  function accountFlowPurpose() {', '  async function sendAccountFlowCode() {') + between(appJs, '  async function onAccountFlowPrimary() {', '  function initAccountFlow() {');
  const els = {};
  const el = (k) => els[k] || (els[k] = { value: values[k] || '', hidden: true, disabled: false, textContent: '', classList: { toggle() {}, add() {}, remove() {} } });
  const log = [];
  const sb = {
    $: el, $all: () => [], PLI: { isValidEmail: (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) },
    accountFlow: { mode, step, newEmail, deletionAttempted, emailVerified },
    Store: { getCurrentUser: () => user, cacheServerUser: (u) => log.push(['cache', u.email]) },
    Auth: Object.assign({
      verifyAccountChallenge: async (p) => { log.push(['verify', p]); return { ok: true, othersSignedOut: true }; },
      requestAccountChallenge: async (p, o) => { log.push(['request', p, o && o.newEmail]); return { ok: true }; },
      completeEmailChange: async () => { log.push(['complete']); return { ok: true, othersSignedOut: true }; },
      refreshSession: async () => ({ ok: true }),
      signOutOthers: () => log.push(['signOutOthers']), fetchOwnProfile: async () => ({ email: 'nuevo@x.test' }),
      deleteMyAccount: async () => ({ ok: true }),
    }, auth),
    ACCOUNT_FLOW_ERRORS: { delete_challenge_required: 'DC' },
    accountFlowShowError: (m) => log.push(['error', m]), renderAccountFlowStep: () => log.push(['render', sb.accountFlow.step]),
    recomputeAccountFlowValidity: () => true, sendAccountFlowCode: () => log.push(['sendCode']),
    syncCurrentIdentityFromStore: () => {}, openProfileScreen: (t) => log.push(['profile', t]), showToast: (m) => log.push(['toast', m]), showView: (v) => log.push(['view', v]),
    finishAccountDeletion: (id) => log.push(['finish', id]), openSettings: () => log.push(['profile', 'settings']), console,
  };
  vm.createContext(sb);
  vm.runInContext(src + '\nglobalThis.__go = onAccountFlowPrimary;', sb);
  return { go: () => sb.__go(), log, sb, els };
}

test('Cambiar email (G1): DOS verificaciones server-side — código del email ACTUAL → email nuevo distinto → código del NUEVO; el servidor cambia y cierra otras sesiones', async () => {
  let t = runAccountFlow({ step: 'code', values: { '#account-flow-code': '123456' } });
  await t.go(); assert.equal(t.sb.accountFlow.step, 'new-email');
  assert.deepEqual(t.log.filter((l) => l[0] === 'verify'), [['verify', 'change_email_current']], 'propósito del primer código = email ACTUAL');
  t = runAccountFlow({ step: 'new-email', values: { '#account-flow-new-email': 'a@x.test' } });
  await t.go(); assert.ok(t.log.some((l) => l[0] === 'error'), 'mismo email rechazado');
  assert.ok(!t.log.some((l) => l[0] === 'request'), 'ni siquiera se pide el desafío');
  t = runAccountFlow({ step: 'new-email', values: { '#account-flow-new-email': 'invalido' } });
  await t.go(); assert.ok(t.log.some((l) => l[0] === 'error'));
  t = runAccountFlow({ step: 'new-email', values: { '#account-flow-new-email': 'nuevo@x.test' } });
  await t.go();
  assert.deepEqual(t.log.filter((l) => l[0] === 'request'), [['request', 'change_email_new', 'nuevo@x.test']]);
  assert.equal(t.sb.accountFlow.step, 'email-code'); assert.equal(t.sb.accountFlow.newEmail, 'nuevo@x.test');
  // el cliente NUNCA manda el email actual: solo purpose (+ newEmail del paso 2)
  t = runAccountFlow({ step: 'new-email', values: { '#account-flow-new-email': 'nuevo@x.test' }, auth: { requestAccountChallenge: async (p, o) => { t.args = [p, Object.keys(o || {})]; return { ok: true }; } } });
  await t.go(); assert.deepEqual(t.args, ['change_email_new', ['newEmail']]);
  // paso 2 bloqueado por el servidor (primer código no verificado/vencido) => vuelve al primer código
  t = runAccountFlow({ step: 'new-email', values: { '#account-flow-new-email': 'nuevo@x.test' }, auth: { requestAccountChallenge: async () => ({ ok: false, reason: 'current_verification_required' }) } });
  await t.go(); assert.equal(t.sb.accountFlow.step, 'code');
  // segundo código OK: el servidor ya cerró las otras sesiones => el cliente NO las cierra de nuevo; refresca cuenta
  t = runAccountFlow({ step: 'email-code', newEmail: 'nuevo@x.test', values: { '#account-flow-email-code': '654321' } });
  await t.go();
  assert.deepEqual(t.log.filter((l) => ['verify', 'cache', 'profile'].includes(l[0])).map((l) => l[0]), ['verify', 'cache', 'profile']);
  assert.ok(!t.log.some((l) => l[0] === 'signOutOthers'));
  // el servidor no pudo cerrar otras sesiones => fallback del cliente
  t = runAccountFlow({ step: 'email-code', newEmail: 'nuevo@x.test', values: { '#account-flow-email-code': '654321' }, auth: { verifyAccountChallenge: async () => ({ ok: true, othersSignedOut: false }) } });
  await t.go(); assert.ok(t.log.some((l) => l[0] === 'signOutOthers'));
  // código inválido: nada cambia
  t = runAccountFlow({ step: 'email-code', newEmail: 'nuevo@x.test', values: { '#account-flow-email-code': '000000' }, auth: { verifyAccountChallenge: async () => ({ ok: false, reason: 'code_invalid' }) } });
  await t.go();
  assert.ok(!t.log.some((l) => ['signOutOthers', 'cache', 'profile'].includes(l[0])) && t.log.some((l) => l[0] === 'error'), 'código inválido: nada cambia');
  // cambio a medias en el servidor: el reintento usa complete_email_change (sin volver a pedir el código)
  t = runAccountFlow({ step: 'email-code', newEmail: 'nuevo@x.test', values: { '#account-flow-email-code': '654321' }, auth: { verifyAccountChallenge: async () => ({ ok: false, reason: 'change_incomplete', retryable: true }) } });
  await t.go(); assert.equal(t.sb.accountFlow.emailVerified, true);
  t = runAccountFlow({ step: 'email-code', newEmail: 'nuevo@x.test', emailVerified: true, values: {} });
  await t.go(); assert.ok(t.log.some((l) => l[0] === 'complete')); assert.ok(t.log.some((l) => l[0] === 'profile'));
  t = runAccountFlow({ step: 'code', values: { '#account-flow-code': '111111' }, auth: { verifyAccountChallenge: async () => ({ ok: false, reason: 'code_invalid' }) } });
  await t.go(); assert.equal(t.sb.accountFlow.step, 'code');
  // propósito por paso
  assert.equal(runAccountFlow({ step: 'email-code', mode: 'email' }).sb.accountFlowPurpose(), 'change_email_new');
  assert.equal(runAccountFlow({ step: 'code', mode: 'email' }).sb.accountFlowPurpose(), 'change_email_current');
  assert.equal(runAccountFlow({ step: 'code', mode: 'delete' }).sb.accountFlowPurpose(), 'delete_account');
});

test('Eliminar cuenta: exige verificar el código ANTES de habilitar la confirmación; el éxito purga y cierra; nunca por escribir "ELIMINAR"', async () => {
  let t = runAccountFlow({ mode: 'delete', step: 'code', values: { '#account-flow-code': '123456' } });
  await t.go(); assert.equal(t.sb.accountFlow.step, 'confirm-delete');
  assert.deepEqual(t.log.filter((l) => l[0] === 'verify'), [['verify', 'delete_account']], 'desafío específico delete_account (no recovery)');
  t = runAccountFlow({ mode: 'delete', step: 'confirm-delete' });
  await t.go();
  assert.deepEqual(t.log.filter((l) => l[0] === 'finish'), [['finish', 'pA']]);
  assert.ok(!/escrib[ií] ["«“]?ELIMINAR/i.test(indexHtml + appJs), 'no se usa "escribí ELIMINAR"');
});

test('Eliminar cuenta: prueba delete_account faltante/vencida (o reauth legado) => vuelve al código; fallo parcial => mensaje de reintento seguro; reintento con cuenta ya inexistente => cierra como eliminada', async () => {
  let t = runAccountFlow({ mode: 'delete', step: 'confirm-delete', auth: { deleteMyAccount: async () => ({ ok: false, code: 'delete_challenge_required' }) } });
  await t.go();
  assert.equal(t.sb.accountFlow.step, 'code'); assert.ok(t.log.some((l) => l[0] === 'sendCode')); assert.ok(!t.log.some((l) => l[0] === 'finish'));
  t = runAccountFlow({ mode: 'delete', step: 'confirm-delete', auth: { deleteMyAccount: async () => ({ ok: false, code: 'deletion_incomplete', retryable: true }) } });
  await t.go();
  assert.ok(!t.log.some((l) => l[0] === 'finish')); assert.equal(t.sb.accountFlow.deletionAttempted, true);
  assert.ok(t.log.some((l) => l[0] === 'error' && /reintentar/.test(l[1])));
  t = runAccountFlow({ mode: 'delete', step: 'confirm-delete', deletionAttempted: true, auth: { deleteMyAccount: async () => ({ ok: false, status: 401, code: 'invalid_session' }) } });
  await t.go();
  assert.deepEqual(t.log.filter((l) => l[0] === 'finish'), [['finish', 'pA']]);
  t = runAccountFlow({ mode: 'delete', step: 'confirm-delete', deletionAttempted: false, auth: { deleteMyAccount: async () => ({ ok: false, status: 401, code: 'invalid_session' }) } });
  await t.go();
  assert.ok(!t.log.some((l) => l[0] === 'finish'), 'un 401 en el PRIMER intento no es una eliminación cumplida');
});

test('Eliminar cuenta: finishAccountDeletion purga caches/outbox del dueño, cierra sesión y muestra la pantalla final neutra', () => {
  const { Store } = loadStore();
  asUser(Store, 'pA'); Store.saveMatchOutboxEntry({ localDraftId: 'd', state: 'sync_pending' }); Store.saveServerMatchesCache([{ matchId: 'm' }]);
  const src = between(appJs, '  function finishAccountDeletion(ownerId) {', '  async function onAccountFlowPrimary');
  const log = [];
  const sb = { Auth: { signOutCurrent: () => log.push('signOut') }, Store, currentPlayerName: 'x', currentUserId: 'pA', afterIdentifyAction: () => {}, accountFlow: {}, showView: (v) => log.push(['view', v]) };
  vm.createContext(sb); vm.runInContext(src + '\nglobalThis.__f = finishAccountDeletion;', sb);
  sb.__f('pA');
  assert.deepEqual(log, ['signOut', ['view', 'account-deleted']]);
  assert.equal(Store.getCurrentUser(), null);
  asUser(Store, 'pA');
  assert.deepEqual(plain(Store.loadMatchOutbox()), []);
  const final = between(indexHtml, 'id="view-account-deleted"', '</section>');
  assert.match(final, /Tu cuenta fue eliminada/);
  assert.ok(!/@|data-|username|email/i.test(final.replace(/alt="BRAMUlab"/, '')), 'pantalla final sin datos personales');
});

test('Auth.deleteMyAccount: invoca la Edge Function con body {confirm:true} únicamente (nunca player_id/email) y mapea errores', async () => {
  const invoked = [];
  const mk = (resp) => loadAuth({ createClient: () => ({ functions: { invoke: async (name, opts) => { invoked.push([name, plain(opts)]); return resp; } } }) });
  assert.equal((await mk({ data: { ok: true, postconditions: { authDeleted: true } }, error: null }).deleteMyAccount()).ok, true);
  assert.deepEqual(invoked[0], ['delete-my-account', { body: { confirm: true } }]);
  const fail = await mk({ data: null, error: { message: 'x', context: { status: 403, json: async () => ({ ok: false, code: 'delete_challenge_required' }) } } }).deleteMyAccount();
  assert.deepEqual(plain(fail), { ok: false, code: 'delete_challenge_required', retryable: false, status: 403 });
  const partial = await mk({ data: null, error: { message: 'x', context: { status: 500, json: async () => ({ ok: false, code: 'deletion_incomplete', retryable: true }) } } }).deleteMyAccount();
  assert.equal(partial.retryable, true);
});

test('Auth (G1): requestAccountChallenge / verifyAccountChallenge / completeEmailChange invocan SOLO account-challenge; nunca mandan el email actual ni ids', async () => {
  const invoked = [];
  const mk = (resp) => loadAuth({ createClient: () => ({ functions: { invoke: async (name, opts) => { invoked.push([name, plain(opts)]); return resp; } } }) });
  const ok = mk({ data: { ok: true, expiresInSeconds: 3600 }, error: null });
  assert.equal((await ok.requestAccountChallenge('change_email_current')).ok, true);
  assert.equal((await ok.requestAccountChallenge('change_email_new', { newEmail: 'n@x.test' })).ok, true);
  assert.equal((await ok.requestAccountChallenge('delete_account', { newEmail: 'colado@x.test' })).ok, true);
  assert.equal((await ok.verifyAccountChallenge('change_email_new', '123456')).ok, true);
  assert.equal((await ok.completeEmailChange()).ok, true);
  assert.deepEqual(invoked.map((i) => i[0]), Array(5).fill('account-challenge'));
  assert.deepEqual(invoked.map((i) => i[1].body), [
    { action: 'request', purpose: 'change_email_current' },
    { action: 'request', purpose: 'change_email_new', newEmail: 'n@x.test' },
    { action: 'request', purpose: 'delete_account' }, // newEmail ignorado fuera de change_email_new
    { action: 'verify', purpose: 'change_email_new', code: '123456' },
    { action: 'complete_email_change' },
  ]);
  const err = await mk({ data: null, error: { message: 'x', context: { status: 429, json: async () => ({ ok: false, code: 'resend_too_soon', retryAfterSeconds: 42 }) } } }).requestAccountChallenge('change_email_current');
  assert.deepEqual(plain(err), { ok: false, reason: 'resend_too_soon', retryAfterSeconds: 42, retryable: false, status: 429 });
  const taken = await mk({ data: null, error: { message: 'x', context: { status: 409, json: async () => ({ ok: false, code: 'email_taken' }) } } }).requestAccountChallenge('change_email_new', { newEmail: 'n@x.test' });
  assert.equal(taken.reason, 'email_taken');
  assert.ok(!/updateUser\(\{ ?email|verifyOtp\(\{[^}]*email_change/.test(read('auth.js')), 'el cliente ya no usa el flujo nativo updateUser({email})/email_change');
  assert.ok(!/verifyRecoveryOtp|sendRecoveryOtp/.test(between(appJs, '  function accountFlowPurpose() {', '  function initAccountFlow() {')), 'cambio de email/eliminación ya no reutilizan recovery');
});

/* ================= L3 — Edge Function y acceso/copia ================= */
test('delete-my-account (Edge): JWT de sesión, identidad server-side, motor compartido; el body no decide nada', () => {
  const edge = readRepo('supabase/functions/delete-my-account/index.ts');
  assert.match(edge, /handleSelfDeletion/);
  assert.match(edge, /runAccountDeletion\(admin, playerId/);
  assert.match(edge, /resolve_player_for_account_deletion/);
  assert.match(edge, /admin\.auth\.getUser\(token\)/);
  assert.ok(!/body\.(player_?[iI]d|email|userId)/.test(edge.replace(/\/\/.*$/gm, '')), 'nunca lee identidad del body');
  assert.ok(!/from\(['"]players['"]\)\.(delete|update)/.test(edge), 'no hay un segundo motor de borrado en la función');
  const script = readRepo('supabase/scripts/admin-delete-player-account.mjs');
  assert.match(script, /from '\.\.\/functions\/_shared\/account-deletion-core\.mjs'/);
});

test('Acceso/copia: RPC solo service_role, datos propios, sin internals; script CLI resuelve @usuario/uuid y falla limpio', async () => {
  const sql = readRepo('supabase/migrations/20260930320000_preprod_v0420_account_self_service.sql');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  assert.match(code, /grant execute on function public\.admin_export_player_data\(uuid\) to service_role/);
  assert.match(code, /revoke all on function public\.admin_export_player_data\(uuid\) from public, anon, authenticated/);
  assert.ok(!/memory_after|'audit'|encrypted_password|api_rate_limits/.test(code.replace(/--.*$/gm, '')), 'sin internals');
  assert.ok(!/player_id', mp\.player_id|'playerId', mp\./.test(code), 'participantes sin ids');
  assert.match(code, /'isMe', mp\.player_id = p_player_id/);
  const { exportPlayerData, resolvePlayerRef } = await import('../supabase/scripts/admin-export-player-data.mjs');
  const admin = (rpcData, profRow) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profRow, error: null }) }) }) }),
    rpc: async (n, a) => ({ data: rpcData(n, a), error: null }),
  });
  assert.deepEqual({ ...(await resolvePlayerRef(admin(), '11111111-2222-3333-4444-555555555555')) }, { ok: true, playerId: '11111111-2222-3333-4444-555555555555' });
  assert.equal((await resolvePlayerRef(admin(null, { player_id: 'pid' }), '@Ana_01')).playerId, 'pid');
  assert.equal((await resolvePlayerRef(admin(null, null), '@ana_01')).code, 'player_not_found');
  assert.equal((await resolvePlayerRef(admin(), 'x; drop table')).code, 'invalid_reference');
  const PID = '11111111-2222-3333-4444-555555555555';
  const full = { ok: true, report: {}, account: { playerId: PID }, profile: {}, legalAcceptances: [], levelEvents: [], matches: [], ranking: [], groups: [], notifications: [], intelligence: [], purposesAndRecipients: {} };
  const ok = await exportPlayerData(admin(() => full, null), PID);
  assert.equal(ok.ok, true);
  const partial = await exportPlayerData(admin(() => ({ ok: true, account: {} }), null), PID);
  assert.equal(partial.code, 'report_invalid', 'Bloque 9B: un informe incompleto es un fallo, no un resultado parcial');
  const gone = await exportPlayerData(admin(() => ({ ok: false, code: 'account_deleted' }), null), '11111111-2222-3333-4444-555555555555');
  assert.deepEqual({ ...gone }, { ok: false, code: 'account_deleted' });
});

test('E2E harness: sin OTP automático, solo opera sobre cuentas e2e_*, negativos automáticos y un único gate humano', async () => {
  const src = readRepo('supabase/scripts/e2e-delete-my-account.mjs');
  assert.match(src, /acc\.username\.startsWith\('e2e_'\)/);
  assert.match(src, /'send-otp'/);
  assert.match(src, /delete_challenge_required/);
  assert.match(src, /invalid_payload/);
  assert.ok(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"]/.test(src), 'sin credenciales');
  const m = await import('../supabase/scripts/e2e-delete-my-account.mjs');
  const r = m.makeReporter(); r.check('a', true); r.check('b', false, 'x');
  assert.equal(r.ok, false); assert.equal(r.checks.length, 2);
});

test('Comunicaciones: esta ronda NO toca plantillas/copy de emails de Supabase', () => {
  const files = ['app.js', 'auth.js', 'index.html'];
  assert.ok(files.every((f) => !/email_templates|mailer_templates|\[auth\.email\.template/.test(read(f))));
  assert.ok(!fs.existsSync(path.join(__dirname, '../supabase/templates')));
});

test('Regresión: login/signup/recovery/onboarding conservan sus contratos (aceptación L1, fail-closed, reanudación)', () => {
  assert.match(appJs, /Auth\.signUp\(email, \$\('#signup-password'\)\.value, legal\.legalVersion\)/);
  assert.match(appJs, /if \(await enforceLegalGate\(\(\) => resumeServerSession\(options\)\)\) return;/);
  assert.match(appJs, /const SIGNUP_STEP_ORDER = \[1, 2, 'verify'\]/);
  assert.match(appJs, /Auth\.isBackendUnavailable\(\)/);
});

test('Versión: V04.24 / 04.24-h1 coherentes', () => {
  assert.match(storeJs, /APP_VERSION = 'BRAMUlab V04\.24'/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\.24-h1'/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.24', bundle: '04.24-h1' });
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-24-h1'/);
});
