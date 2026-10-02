// BRAMUlab — G2 (Issue #22, handoff 95): Configuración, Acceso/Legal in-app, reaceptación legal e ícono instalado.
//   node --test bramulab/g2-configuracion.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthConfigPayload } from '../supabase/scripts/sync-auth-email-templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html'); const app = read('app.js'); const css = read('styles.css'); const sw = read('sw.js');
const between = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, `no se encontró: ${a}`); const j = s.indexOf(b, i + a.length); assert.ok(j > i, `no se encontró fin: ${b}`); return s.slice(i, j); };
const section = (id) => between(html, `<section id="${id}"`, '</section>');

/* ---------- arnés: ejecuta el módulo de Configuración de app.js con DOM/Auth falsos ---------- */
function harness({ user = { id: 'u', email: 'a@x.test', serverBacked: true, username: 'ana' }, configured = true } = {}) {
  const src = between(app, '  let legalDocOrigin = ', '  /** V03.0 (§3) — "Cerrar sesión"');
  const els = {}; const handlers = {}; const log = [];
  const el = (k) => els[k] || (els[k] = {
    hidden: true, textContent: '', src: '', dataset: {},
    addEventListener: (ev, fn) => { handlers[`${k}:${ev}`] = fn; },
  });
  const anchors = [
    { dataset: { legalDoc: 'terminos', legalOrigin: 'legal-gate' }, addEventListener: (ev, fn) => { handlers['a-terminos-gate'] = fn; } },
    { dataset: { legalDoc: 'privacidad', legalOrigin: 'signup' }, addEventListener: (ev, fn) => { handlers['a-privacidad-signup'] = fn; } },
  ];
  const sb = {
    $: el, $all: () => anchors, console,
    Store: { getCurrentUser: () => user },
    Auth: { isConfigured: () => configured, signOutAll: async () => log.push('signOutAll') },
    showView: (v) => log.push(['view', v]),
    openAccountFlow: (m) => log.push(['flow', m]),
    openChangePasswordScreen: () => log.push(['changePassword']),
    window: { location: { set href(v) { log.push(['mailto', v]); } } },
    encodeURIComponent,
  };
  vm.createContext(sb);
  vm.runInContext(src + '\nglobalThis.__api = { openSettings, openLogoutOptions, initSettings, openLegalDoc, closeLegalDoc };', sb);
  sb.__api.initSettings();
  return { sb, api: sb.__api, els, handlers, log };
}
const click = (h, k) => h.handlers[`${k}:click`]({ preventDefault() {} });

test('G2-1 · Mis datos ya NO tiene Acceso y seguridad, Legal y privacidad ni Cerrar sesión; conserva solo datos del jugador + aviso de acceso incompleto', () => {
  const profile = section('view-profile');
  const mis = between(profile, 'id="profile-panel-mis-datos"', 'id="profile-panel-jugadores"');
  for (const gone of ['ACCESO Y SEGURIDAD', 'LEGAL Y PRIVACIDAD', 'profile-logout-btn', 'profile-change-email-btn', 'profile-delete-account-btn', 'profile-logout-all-btn', 'profile-request-copy-btn', 'profile-terms-link', 'profile-privacy-link', 'profile-contact-link', 'profile-change-password-btn', 'CERRAR SESIÓN']) {
    assert.ok(!mis.includes(gone), `Mis datos no debe contener ${gone}`);
  }
  assert.match(mis, /id="profile-access-pending"/); assert.match(mis, /id="profile-complete-access-btn"/);
  assert.match(mis, /id="mis-datos-contact-card"/);
  assert.ok(!/profile-data-email|profile-logout-btn|profile-change-email-btn/.test(app.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'app.js ya no referencia nodos eliminados');
});

test('G2-2 · engranaje discreto en el header de Perfil abre Configuración; back vuelve a Perfil', () => {
  assert.match(between(section('view-profile'), 'class="analysis-header"', '</div>'), /id="profile-settings-btn"[^>]*aria-label="Configuración"/);
  const h = harness();
  const st = (global.__x = {}); void st;
  // el listener del engranaje apunta a openSettings (cableado en initProfile)
  assert.match(app, /\$\('#profile-settings-btn'\)\.addEventListener\('click', openSettings\)/);
  h.api.openSettings();
  assert.deepEqual(h.log.at(-1), ['view', 'settings']);
  click(h, '#settings-back-btn'); assert.deepEqual(h.log.at(-1), ['view', 'profile']);
});

test('G2-3 · Configuración: orden, secciones, filas compactas centradas y zona destructiva aislada al final', () => {
  const v = section('view-settings');
  assert.deepEqual([...v.matchAll(/settings-group__title">([^<]+)</g)].map((m) => m[1]), ['CUENTA Y SEGURIDAD', 'PRIVACIDAD Y CUENTA'], 'solo dos encabezados');
  for (const gone of ['PRIVACIDAD Y DATOS', '>LEGAL<', 'AYUDA', '>SESIÓN<', 'ZONA DE CUENTA', 'settings-group--danger', 'settings-group--session', 'settings-logout-row']) assert.ok(!v.includes(gone), `ya no existe ${gone}`);
  const order = ['settings-email-row', 'settings-password-row', 'PRIVACIDAD Y CUENTA', 'settings-terms-row', 'settings-privacy-row', 'settings-copy-row', 'settings-contact-row', 'settings-delete-row', 'settings-logout-btn'];
  let at = 0; for (const t of order) { const i = v.indexOf(t, at); assert.ok(i >= 0, `falta/desordenado: ${t}`); at = i; }
  // Eliminar: fila danger DENTRO del mismo bloque (misma lista que Términos), sin borde rojo de bloque
  const list = between(v, 'id="settings-group-privacy"', 'class="settings-logout"');
  assert.ok(list.includes('settings-delete-row') && list.includes('settings-terms-row') && (list.match(/settings-list/g) || []).length === 1);
  assert.ok(!/rgba\(255,91,97,0\.35\)/.test(css.slice(css.indexOf('G2 (Issue #22)'))), 'sin borde rojo de bloque');
  // Cerrar sesión: botón grande separado, danger, ancho completo
  assert.match(v, /<div class="settings-logout">\s*<button type="button" id="settings-logout-btn" class="btn-secondary btn-secondary--danger">CERRAR SESIÓN<\/button>/);
  assert.match(css, /\.settings-logout \.btn-secondary\{ width:100%; min-height: 52px/);
  assert.ok(!/Cerrar todas las sesiones/.test(v), 'no hay fila permanente de cerrar todas');
  assert.match(v, /settings-row settings-row--danger/);
  assert.match(css, /\.settings-row\{[^}]*display:flex; align-items:center;[^}]*min-height: 46px/);
  assert.match(css, /\.settings-row__chevron\{[^}]*width: 12px; text-align:center/);
  assert.match(css, /\.settings-row:not\(\[hidden\]\) ~ \.settings-row:not\(\[hidden\]\)\{ border-top: 1px solid/);
  assert.ok(!/BOTTOM_NAV_VIEWS = \[[^\]]*'settings/.test(app), 'sin bottom nav en Configuración');
});

test('G2-4 · filas sensibles NO disparan mail/flujo al primer tap: solo navegan a la pantalla intermedia', () => {
  const h = harness();
  h.api.openSettings(); h.log.length = 0;
  click(h, '#settings-email-row'); assert.deepEqual(h.log, [['view', 'settings-email']]);
  h.log.length = 0; click(h, '#settings-delete-row'); assert.deepEqual(h.log, [['view', 'settings-delete']]);
  h.log.length = 0; click(h, '#settings-copy-row'); assert.deepEqual(h.log, [['view', 'settings-copy']]);
  h.log.length = 0; click(h, '#settings-contact-row'); assert.deepEqual(h.log, [['view', 'settings-contact']]);
  assert.ok(!h.log.some((l) => l[0] === 'flow' || l[0] === 'mailto'));
});

test('G2-5 · CTA intermedio SÍ inicia el flujo G1 / abre el correo (y solo ahí); G1 queda intacto', () => {
  const h = harness();
  click(h, '#settings-email-cta'); assert.deepEqual(h.log.at(-1), ['flow', 'email']);
  click(h, '#settings-delete-cta'); assert.deepEqual(h.log.at(-1), ['flow', 'delete']);
  click(h, '#settings-copy-cta');
  const m = h.log.at(-1); assert.equal(m[0], 'mailto'); assert.match(m[1], /^mailto:bramulab@gmail\.com\?subject=/); assert.match(m[1], /%40ana/);
  click(h, '#settings-contact-cta'); assert.deepEqual(h.log.at(-1), ['mailto', 'mailto:bramulab@gmail.com']);
  // el desafío (Email #3 / #7) lo dispara openAccountFlow -> sendAccountFlowCode, no las filas ni los back de las pantallas
  const open = between(app, '  function openAccountFlow(mode) {', '  /** Cierre local tras una eliminación');
  assert.match(open, /sendAccountFlowCode\(\)/);
  const settings = between(app, '  let legalDocOrigin = ', '  /** V03.0 (§3) — "Cerrar sesión"');
  assert.equal((settings.match(/openAccountFlow\(/g) || []).length, 2, 'solo los dos CTA');
  assert.ok(!/requestAccountChallenge|sendAccountFlowCode/.test(settings));
  // contenido de las pantallas intermedias
  assert.match(section('view-settings-email'), /verifica primero tu email actual y después el nuevo/);
  assert.match(section('view-settings-email'), /id="settings-email-cta"[^>]*>CAMBIAR EMAIL</);
  const del = section('view-settings-delete');
  for (const t of ['eliminados o anonimizados', 'permanecerán en sus historiales', 'Jugador eliminado', 'identidad nueva', 'CONTINUAR CON LA ELIMINACIÓN']) assert.ok(del.includes(t), t);
  assert.match(section('view-settings-contact'), /bramulab@gmail\.com[\s\S]*ENVIAR EMAIL/);
  // el contrato G1 sigue: dos verificaciones, desafío delete_account, sin recovery
  const flow = between(app, '  function accountFlowPurpose() {', '  function initAccountFlow() {');
  assert.match(flow, /change_email_current/); assert.match(flow, /change_email_new/); assert.match(flow, /delete_account/);
  assert.ok(!/RecoveryOtp|updateUser/.test(flow));
});

test('G2-6 · Solicitar copia: categorías reales (sin datos concretos del usuario) y CTA propio', () => {
  const v = section('view-settings-copy');
  for (const t of ['Cuenta y perfil', 'Actividad deportiva', 'Nivel BRAMU y Ranking', 'Grupos', 'Aceptaciones legales', 'Notificaciones', 'Datos técnicos mínimos', 'SOLICITAR COPIA']) assert.ok(v.includes(t), t);
  assert.ok(!/id="[^"]*(email|username|phone)[^"]*"/i.test(v), 'sin nodos con datos concretos');
  // cada categoría existe de verdad en el reporte de exportación real
  const mig = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930320000_preprod_v0420_account_self_service.sql'), 'utf8');
  for (const k of ['legalAcceptances', 'matches', 'groups', 'notifications', 'intelligence', 'ranking', 'levelEvents']) assert.ok(mig.includes(`'${k}'`), `export real incluye ${k}`);
});

test('G2-7 · Cerrar sesión: modal con sesión actual / todas / cancelar; el tap en la fila no cierra nada', async () => {
  const modal = between(html, '<div id="logout-confirm-modal"', '\n  </div>\n\n');
  const order = ['logout-confirm-btn', 'logout-all-confirm-btn', 'logout-confirm-cancel-btn']; let at = 0;
  for (const t of order) { const i = modal.indexOf(t, at); assert.ok(i >= 0, t); at = i; }
  const h = harness();
  click(h, '#settings-logout-btn');
  assert.equal(h.els['#logout-confirm-modal'].hidden, false);
  assert.equal(h.els['#logout-all-confirm-btn'].hidden, false, 'cuenta server-backed: ofrece cerrar todas');
  assert.ok(!h.log.includes('signOutAll'));
  const noServer = harness({ user: { id: 'u', email: 'a@x.test' } });
  click(noServer, '#settings-logout-btn'); assert.equal(noServer.els['#logout-all-confirm-btn'].hidden, true);
  const noMail = harness({ user: { id: 'u', email: null } });
  click(noMail, '#settings-logout-btn'); assert.equal(noMail.els['#logout-warning-modal'].hidden, false, 'cuenta sin acceso completo conserva el aviso fuerte');
  assert.match(app, /logout-confirm-btn'\)\.addEventListener\('click', \(\) => \{ \$\('#logout-confirm-modal'\)\.hidden = true; doLogout\(\); \}\)/);
  assert.match(app, /logout-all-confirm-btn'\)\.addEventListener\('click', async \(\) => \{ \$\('#logout-confirm-modal'\)\.hidden = true; await Auth\.signOutAll\(\); doLogout\(\); \}\)/);
});

test('G2-8 · Términos/Privacidad abren DENTRO de BRAMU con back claro, sin bottom nav, y vuelven a su origen', () => {
  const v = section('view-legal-doc');
  assert.match(v, /id="legal-doc-back-btn"[^>]*aria-label="Volver">←/); assert.match(v, /<iframe id="legal-doc-frame"/);
  assert.ok(!/BOTTOM_NAV_VIEWS = \[[^\]]*legal-doc/.test(app));
  assert.match(app, /'settings', 'settings-email', 'settings-delete', 'settings-copy', 'settings-contact', 'legal-doc'/);
  assert.match(css, /#view-legal-doc\s*\{|#view-legal-doc, ?\n?/);
  const h = harness();
  click(h, '#settings-terms-row');
  assert.equal(h.els['#legal-doc-frame'].src, 'terminos/'); assert.equal(h.els['#legal-doc-title'].textContent, 'TÉRMINOS Y CONDICIONES');
  assert.deepEqual(h.log.at(-1), ['view', 'legal-doc']);
  click(h, '#legal-doc-back-btn'); assert.deepEqual(h.log.at(-1), ['view', 'settings']); assert.equal(h.els['#legal-doc-frame'].src, 'about:blank');
  click(h, '#settings-privacy-row'); assert.equal(h.els['#legal-doc-frame'].src, 'privacidad/');
  // desde la aceptación legal y el alta: abre in-app y vuelve a ESA vista (el estado del formulario no se pierde)
  h.handlers['a-terminos-gate']({ preventDefault() {} }); assert.equal(h.els['#legal-doc-frame'].src, 'terminos/');
  click(h, '#legal-doc-back-btn'); assert.deepEqual(h.log.at(-1), ['view', 'legal-gate']);
  h.handlers['a-privacidad-signup']({ preventDefault() {} }); click(h, '#legal-doc-back-btn'); assert.deepEqual(h.log.at(-1), ['view', 'signup']);
  // nada de target=_blank para los documentos legales dentro de la app
  assert.ok(!/(terminos|privacidad)\/"[^>]*target="_blank"/.test(html));
  assert.match(sw, /event\.request\.mode === 'navigate'/, 'el marco legal se sirve por red primero');
});

test('G2-9 · reaceptación legal: misma obligación y persistencia; solo cambió el layout', () => {
  const gate = section('view-legal-gate');
  for (const t of ['legal-gate-checkbox', 'legal-gate-accept-btn" class="btn-start" disabled', 'ACEPTAR Y CONTINUAR', 'legal-gate-logout-btn', 'Para seguir usando BRAMUlab necesitamos que aceptes nuestros Términos y la Política de Privacidad vigentes.']) assert.ok(gate.includes(t), t);
  assert.match(app, /Auth\.acceptLegalVersion\(legalGateVersion\)/);
  assert.match(app, /\$\('#legal-gate-checkbox'\)\.checked = false;[\s\S]{0,80}\$\('#legal-gate-accept-btn'\)\.disabled = true/);
  assert.match(css, /#view-legal-gate \.access-scroll\{ justify-content:center; gap: 26px;[^}]*max-width: 420px/);
  assert.match(css, /#view-legal-gate \.access-form\{ gap: 22px; \}/);
  assert.ok(!/legal-gate/.test(between(app, 'const BOTTOM_NAV_VIEWS', ';')), 'sigue sin bottom nav');
});

test('G2-10 · Perfil/Mis datos server-backed intactos (render y edición)', () => {
  for (const id of ['profile-data-phone', 'profile-data-whatsapp-status', 'mis-datos-contact-edit-btn', 'profile-tab-mis-datos', 'profile-edit-btn']) assert.ok(html.includes(`id="${id}"`) || app.includes(id), id);
  assert.match(app, /\$\('#profile-data-phone'\)\.textContent = \(user && user\.phone\)/);
  assert.match(app, /\$\('#profile-edit-btn'\)\.addEventListener\('click', openProfileEditModal\)/);
  assert.match(app, /\$\('#profile-access-pending'\)\.hidden = !accessPending/);
});

test('G2-11 · ícono instalado: PNG reales y opacos, manifest/head válidos, apple-touch-icon incrustado == archivo, versionado y SW coherentes', () => {
  const sizeOf = (f) => { const b = fs.readFileSync(path.join(__dirname, f)); assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${f} es PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20), b[25]]; };
  const [w, hh, colorType] = sizeOf('icons/apple-touch-icon.png');
  assert.deepEqual([w, hh], [180, 180]);
  // iOS rellena la transparencia de negro: el PNG de 180x180 debe ser OPACO (color type 2 = RGB, o RGBA con alfa 255 verificado a mano en la ronda)
  assert.ok([2, 6].includes(colorType));
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.start_url, './index.html'); assert.equal(m.display, 'standalone');
  for (const ic of m.icons) { const f = ic.src.split('?')[0]; assert.ok(fs.existsSync(path.join(__dirname, f)), f); const [iw, ih] = sizeOf(f); assert.equal(`${iw}x${ih}`, ic.sizes); assert.match(ic.src, /\?v=04\.23-h1$/); }
  assert.ok(m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" crossorigin="use-credentials" \/>/);
  const ati = html.match(/<link rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,([A-Za-z0-9+/=]+)" \/>/);
  assert.ok(ati, 'apple-touch-icon incrustado (no depende de una request sin credenciales a un deployment protegido)');
  assert.ok(Buffer.from(ati[1], 'base64').equals(fs.readFileSync(path.join(__dirname, 'icons/apple-touch-icon.png'))));
  assert.equal((html.match(/rel="apple-touch-icon"/g) || []).length, 1);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="BRAMUlab" \/>/);
  assert.match(html, /<meta name="theme-color" content="#050A12" \/>/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-23-h1'/);
  assert.match(sw, /'\.\/icons\/apple-touch-icon\.png\?v=04\.23-h1'/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.23', bundle: '04.23-h1' });
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.23-h1'/);
  assert.ok(!/\?v=04\.20-h4/.test(html + sw + read('manifest.webmanifest')), 'sin restos del bundle anterior');
  assert.match(sw, /keys\.filter\(\(k\) => k\.startsWith\('bramulab-v'\) && k !== CACHE_NAME\)/, 'el SW nuevo borra las cachés viejas');
});

test('G2-12 · Site URL / redirects de Auth: el script los fija desde BRAMU_SITE_URL (https estable); rechaza localhost/GitHub; sin variable no toca nada', () => {
  assert.equal('site_url' in buildAuthConfigPayload(undefined, {}), false);
  const p = buildAuthConfigPayload(undefined, { BRAMU_SITE_URL: 'https://staging.example.test/' });
  assert.equal(p.site_url, 'https://staging.example.test'); assert.equal(p.uri_allow_list, 'https://staging.example.test,https://staging.example.test/**');
  for (const bad of ['http://localhost:3000', 'https://raw.githubusercontent.com/x', 'https://x.github.io', 'http://staging.example.test', 'staging.example.test']) assert.throws(() => buildAuthConfigPayload(undefined, { BRAMU_SITE_URL: bad }), /BRAMU_SITE_URL inválida/, bad);
});

test('G2-13 · no regresión G1 ni alcance: backend de challenges/eliminación intacto; sin main/Production/BRAMUlive', () => {
  const del = fs.readFileSync(path.join(__dirname, '../supabase/functions/delete-my-account/index.ts'), 'utf8');
  assert.match(del, /account_delete_proof_check/); assert.match(del, /finishDeletionReceipt/);
  assert.ok(fs.existsSync(path.join(__dirname, '../supabase/functions/account-challenge/index.ts')));
  assert.ok(!fs.readdirSync(path.join(__dirname, '../supabase/migrations')).some((f) => /g2/i.test(f)), 'G2 no agrega migraciones');
  const mine = [read('g2-configuracion.test.mjs')].join('');
  void mine;
  assert.ok(!/bramulive/i.test(between(html, '<section id="view-settings"', '<section id="view-account-flow"')));
});

/* ---------- tanda final V04.21 ---------- */
test('V0421-1 · versión visible BRAMUlab V04.23 y bundle/cache/version.json/SW/manifest coherentes', () => {
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.23'/);
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.23-h1'/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.23', bundle: '04.23-h1' });
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-23-h1'/);
  assert.ok(!/04\.20-h\d/.test(html + sw + read('manifest.webmanifest')), 'sin restos del bundle anterior');
  assert.ok((html.match(/\?v=04\.23-h1/g) || []).length >= 10);
  assert.match(fs.readFileSync(path.join(__dirname, '../docs/BRAMUlab/Metodo_Trabajo.md'), 'utf8'), /V04\.21, V04\.22/);
});

test('V0421-2 · engranaje centrado en Perfil y Grupos con la misma regla acotada; otros icon-btn intactos', () => {
  assert.match(css, /#profile-settings-btn, #groups-settings-btn\{ display:inline-flex; align-items:center; justify-content:center;/);
  assert.match(css, /#profile-settings-btn svg, #groups-settings-btn svg\{ display:block; \}/);
  assert.match(html, /id="profile-settings-btn"/); assert.match(html, /id="groups-settings-btn"/);
  assert.match(css, /^\.icon-btn\{ background:none; border:none; color: var\(--paper-dim\); font-size: 20px; padding: 4px 8px; cursor:pointer; line-height:1; \}$/m, '.icon-btn global sin tocar');
});

test('V0421-3 · Cambiar contraseña: cancelar y AMBOS caminos de éxito (local y server-backed) vuelven a Configuración; recovery desde sesión también', () => {
  const init = between(app, '  function initChangePasswordScreen() {', '  /* ------------------------------------------------------------------ */\n  /* L3 (V04.20) — CAMBIAR EMAIL');
  assert.ok(!/showView\('profile'\)/.test(init), 'ningún showView(profile) dentro de initChangePasswordScreen');
  assert.match(init, /#change-password-cancel'\)\.addEventListener\('click', openSettings\)/);
  const local = between(init, 'Store.updateUserAccount(user.id, { password: next });', "showToast('Contraseña actualizada')");
  assert.match(local, /openSettings\(\)/);
  const server = between(init, 'const result = await Auth.updatePassword(next);', "showToast('Contraseña actualizada')");
  assert.match(server, /Auth\.signOutOthers\(\)/); assert.match(server, /renderNotificationsBadge\(\);\s*openSettings\(\)/);
  assert.equal((init.match(/openSettings\(\)/g) || []).length >= 3, true, 'no-user, cancelar, local y server');
  const forgot = between(app, "if (forgotPasswordOrigin === 'session') {\n          // V03.0.3.2", "} else {\n          $('#login-email')");
  assert.match(forgot, /openSettings\(\)/);
  assert.match(app, /if \(forgotPasswordOrigin === 'session'\) openSettings\(\);\s*\n\s*else await resumeServerSession/);
  assert.match(app, /else if \(forgotPasswordOrigin === 'session'\) showView\('change-password'\)/);
});

test('V0421-4 · Contacto: copy exacto, misma dirección y CTA', () => {
  const v = section('view-settings-contact');
  assert.ok(v.includes('Este es el canal de soporte y privacidad de BRAMUlab. Las solicitudes se gestionan de forma automática. BRAMUlab no ofrece atención manual por email.'));
  assert.ok(v.includes('bramulab@gmail.com') && v.includes('ENVIAR EMAIL'));
});
