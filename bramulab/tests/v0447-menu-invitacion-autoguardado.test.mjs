// BRAMUlab — V04.47: menú general (☰), invitación recibida por WhatsApp → app instalada (copiar / pegar / importar) y guardado automático de Editar datos.
// Ejecutar con: node --test bramulab/tests/v0447-menu-invitacion-autoguardado.test.mjs
// El controlador de autoguardado y el menú viven dentro del cierre de app.js (sin cobertura unitaria por diseño): acá se prueban las piezas puras con el código
// real (PLIdentity) y se fijan por texto los contratos que no deben retroceder. El comportamiento (carreras, fallo, reintento, salida) se verificó en navegador.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');

function loadPLI() {
  const ctx = { Buffer, URL, URLSearchParams };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('player-identity.js'), ctx);
  return ctx.PLIdentity;
}
const PLI = loadPLI();
const HEX = crypto.randomBytes(32).toString('hex');
const CODE = Buffer.from(HEX, 'hex').toString('base64url'); // 43 caracteres: el mismo recodificado del enlace oficial

function section(id) { const a = indexHtml.indexOf(`id="${id}"`); assert.ok(a >= 0, id); return indexHtml.slice(a, indexHtml.indexOf('</section>', a)); }
function fnBody(name) {
  const a = appJs.indexOf(`function ${name}(`); assert.ok(a >= 0, `function ${name}`);
  let depth = 0; let started = false;
  for (let i = a; i < appJs.length; i += 1) {
    if (appJs[i] === '{') { depth += 1; started = true; } else if (appJs[i] === '}') { depth -= 1; if (started && depth === 0) return appJs.slice(a, i + 1); }
  }
  throw new Error(`cuerpo de ${name}`);
}

/* ============================ Enlace de invitación (puro) ============================ */
test('código ↔ hex: recodificación sin pérdida (43 base64url ↔ 64 hex), idéntica a la del servicio bramulab-invite', () => {
  assert.equal(PLI.hexToInvitationCode(HEX), CODE);
  assert.equal(PLI.invitationCodeToHex(CODE), HEX);
  assert.equal(PLI.invitationCodeToHex(HEX), HEX);
  assert.equal(PLI.invitationCodeToHex(HEX.toUpperCase()), HEX);
  assert.equal(PLI.hexToInvitationCode('xyz'), null);
});

test('código inválido: largo incorrecto, caracteres ajenos o base64url NO canónico (bits sobrantes) → null (nunca se adivina)', () => {
  for (const bad of ['', 'abc', CODE.slice(1), CODE + 'A', CODE.slice(0, 42) + '!', HEX.slice(1), HEX + '0']) assert.equal(PLI.invitationCodeToHex(bad), null, bad);
  // el último carácter de un base64url de 32 bytes solo puede llevar 2 bits útiles: otro carácter con los mismos 32 bytes no es canónico
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const alt = CODE.slice(0, 42) + B64[(B64.indexOf(CODE[42]) & ~3) | 1];
  assert.equal(PLI.invitationCodeToHex(alt), null);
});

test('parseInvitationLink: acepta el enlace oficial compartido, dentro del mensaje completo de WhatsApp, con puntuación final y con el alias legado /i/', () => {
  const msg = `¡Buenas! Nuestro partido ya está cargado en BRAMUlab. Te dejo el link acá 👇\nhttps://bramulab.com/invitacion/${CODE}`;
  assert.deepEqual({ ...PLI.parseInvitationLink(msg) }, { ok: true, token: HEX });
  assert.equal(PLI.parseInvitationLink(`mirá https://bramulab.com/invitacion/${CODE}.`).token, HEX);
  assert.equal(PLI.parseInvitationLink(`https://www.bramulab.com/invitacion/${CODE}/`).token, HEX);
  assert.equal(PLI.parseInvitationLink(`https://bramulab.com/i/${CODE}`).token, HEX);
  assert.equal(PLI.parseInvitationLink(`https://bramulab.com/invitacion/${HEX}`).token, HEX, 'enlaces anteriores con 64 hex');
});

test('parseInvitationLink: acepta el enlace de captura de la app (?claim=) y el origen de Staging solo si el entorno lo declara', () => {
  assert.equal(PLI.parseInvitationLink(`https://app.bramulab.com/?claim=${HEX}`).token, HEX);
  assert.deepEqual({ ...PLI.parseInvitationLink(`https://bramu-i.vercel.app/invitacion/${CODE}`) }, { ok: false, code: 'foreign_host' });
  assert.equal(PLI.parseInvitationLink(`https://bramu-i.vercel.app/invitacion/${CODE}`, ['bramu-i.vercel.app']).token, HEX);
  assert.equal(PLI.parseInvitationLink(`http://localhost:4173/invitacion/${CODE}`).token, HEX, 'desarrollo local');
});

test('parseInvitationLink: rechaza hosts ajenos (incluidos dominios engañosos), http no local, texto sin enlace y vacíos', () => {
  for (const url of [
    `https://evil.com/invitacion/${CODE}`,
    `https://bramulab.com.evil.com/invitacion/${CODE}`,
    `https://evilbramulab.com/invitacion/${CODE}`,
    `https://bramulab.com@evil.com/invitacion/${CODE}`,
  ]) assert.deepEqual({ ...PLI.parseInvitationLink(url) }, { ok: false, code: 'foreign_host' }, url);
  assert.deepEqual({ ...PLI.parseInvitationLink(`http://bramulab.com/invitacion/${CODE}`) }, { ok: false, code: 'not_invitation' }, 'http no local nunca');
  assert.deepEqual({ ...PLI.parseInvitationLink('hola, ¿cómo andás?') }, { ok: false, code: 'not_invitation' });
  assert.deepEqual({ ...PLI.parseInvitationLink('https://bramulab.com/') }, { ok: false, code: 'not_invitation' });
  assert.deepEqual({ ...PLI.parseInvitationLink('https://bramulab.com/invitacion/corto') }, { ok: false, code: 'not_invitation' });
  assert.deepEqual({ ...PLI.parseInvitationLink('   ') }, { ok: false, code: 'empty' });
  assert.deepEqual({ ...PLI.parseInvitationLink(null) }, { ok: false, code: 'empty' });
});

test('parseInvitationLink: un código suelto vale solo si el texto ES el código; un enlace ajeno válido no se rescata como código', () => {
  assert.equal(PLI.parseInvitationLink(CODE).token, HEX);
  assert.equal(PLI.parseInvitationLink(`  ${HEX}\n`).token, HEX);
  assert.equal(PLI.parseInvitationLink(`el código es ${CODE}`).ok, false);
});

/* ============================ Menú general ============================ */
test('menú: ☰ al final del encabezado del Home, Ayuda ya no está en el encabezado y se conservan Ranking y Notificaciones', () => {
  const home = section('view-player-home');
  const header = home.slice(0, home.indexOf('analysis-scroll'));
  assert.match(header, /id="app-menu-btn"[^>]*aria-expanded="false"[^>]*aria-controls="app-menu"|id="app-menu-btn"[^>]*aria-controls="app-menu"[^>]*aria-expanded="false"/);
  assert.ok(header.indexOf('player-home-ranking-btn') < header.indexOf('player-home-bell-btn') && header.indexOf('player-home-bell-btn') < header.indexOf('app-menu-btn'), '☰ a la derecha de todo');
  assert.doesNotMatch(header, /player-home-help-btn/);
  assert.match(header, /app-menu-btn__bars[\s\S]*<i><\/i><i><\/i><i><\/i>/, 'tres líneas');
});

test('menú: ítems en el orden aprobado (V04.48: agrupados), Cerrar sesión aparte y secundario, mismos íconos para el panel y la demostración', () => {
  const groups = appJs.match(/const APP_MENU_GROUPS = \[([\s\S]*?)\n  \];/)[1];
  assert.deepEqual([...groups.matchAll(/label: '([^']+)'/g)].map((m) => m[1]), ['Editar mi perfil', 'Mis jugadores', '¿Recibiste una invitación?', 'Ayuda', 'Herramientas de prueba']);
  assert.match(appJs, /const APP_MENU_FOOTER_ITEMS = \[\{ id: 'logout', label: 'Cerrar sesión', icon: APP_MENU_ICONS\.logout, secondary: true \}\]/);
  assert.match(fnBody('initAppMenu'), /\$\('#app-menu-list'\)\.innerHTML = markup\.list/);
  assert.match(fnBody('initAppMenu'), /#invite-installed-demo-menu'\)\.innerHTML = .*demoMarkup\.list.*demoMarkup\.footer/, 'la demo usa los ítems reales del menú');
});

test('menú: cada ítem lleva a la función existente (sin pantallas nuevas) y Editar mi perfil vuelve al Home', () => {
  const act = fnBody('onAppMenuAction');
  assert.match(act, /id === 'edit-profile'\) \{ profileEditReturnView = 'home'; openProfileEditModal\(\); \}/);
  assert.match(act, /id === 'players'\) openProfileScreen\('jugadores'\)/);
  assert.match(act, /id === 'invitation'\) openInvitePasteSheet\(\)/);
  assert.match(act, /id === 'help'\) openHelpScreen\(\)/);
  assert.match(act, /id === 'logout'\) openLogoutOptions\(\)/, 'cerrar sesión reutiliza el modal de opciones existente');
  assert.match(fnBody('leaveProfileEdit'), /back === 'home'\) \{ openPlayerHome\(\); return; \}/);
  assert.match(appJs, /\$\('#help-back-btn'\)\.addEventListener\('click', \(\) => openPlayerHome\(\)\)/);
});

test('menú: se cierra por ☰/X, por el fondo, con Escape, arrastrando hacia la derecha y en cualquier cambio de pantalla; el ☰ se transforma en X', () => {
  const init = fnBody('initAppMenu');
  assert.match(init, /\$\('#app-menu-scrim'\)\.addEventListener\('click', \(\) => closeAppMenu\(\)\)/);
  assert.match(init, /e\.key === 'Escape' && appMenuOpen/);
  assert.match(init, /touchstart[\s\S]*touchmove[\s\S]*touchend[\s\S]*touchcancel/);
  assert.match(init, /d\.dx > 80 \|\| velocity > 0\.55/);
  assert.match(appJs, /function showView\(name\) \{[\s\S]{0,400}if \(appMenuOpen && name !== 'player-home'\) closeAppMenu\(\{ immediate: true \}\)/);
  assert.match(fnBody('setAppMenuButtonState'), /classList\.toggle\('is-open', open\)[\s\S]*aria-expanded[\s\S]*Cerrar menú/);
  assert.match(css, /\.app-menu-btn\.is-open \.app-menu-btn__bars i:nth-child\(1\)\{ transform: translateY\(6px\) rotate\(45deg\)/);
  assert.match(css, /\.app-menu-btn\.is-open \.app-menu-btn__bars i:nth-child\(3\)\{ transform: translateY\(-6px\) rotate\(-45deg\)/);
});

test('menú: el panel nace DEBAJO del encabezado (no tapa el ☰/X ni los íconos), sobre la barra inferior y con reduced-motion', () => {
  assert.match(css, /\.app-menu\{ position:fixed; top: var\(--app-menu-top, 64px\); right:0; bottom:0; z-index: 38;/);
  assert.match(css, /\.app-menu-scrim\{ position:fixed; left:0; right:0; bottom:0; top: var\(--app-menu-top, 64px\); z-index: 37;/);
  assert.match(fnBody('positionAppMenu'), /getBoundingClientRect\(\)\.bottom/);
  const nav = Number(css.match(/\.bottom-nav\{[^}]*z-index: ?(\d+)/)?.[1] || css.match(/position: fixed; left:0; right:0; bottom:0; z-index: (\d+);/)[1]);
  assert.ok(nav < 37, 'la barra inferior queda por debajo del panel');
  const rm = css.slice(css.indexOf('V04.47 — MENÚ GENERAL'));
  assert.match(rm, /@media \(prefers-reduced-motion: reduce\)\{[^@]*\.app-menu[^@]*\}/);
});

/* ============================ Invitación recibida por WhatsApp ============================ */
test('navegador: «¿Ya tenés BRAMUlab instalada?» es una acción SECUNDARIA dentro de la tarjeta de invitación (V04.50: vuelve a su lugar); los botones de acceso no cambian y se oculta dentro de la app instalada', () => {
  const card = indexHtml.slice(indexHtml.indexOf('id="access-invitation-card"'), indexHtml.indexOf('id="access-backend-unavailable"'));
  assert.match(card, /id="access-installed-btn" class="invitation-card__link">¿Ya tenés BRAMUlab instalada\?<\/button>/);
  assert.match(indexHtml, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>\s*<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
  assert.match(fnBody('applyInvitationCardState'), /installed\.hidden = unavailable \|\| isStandaloneApp\(\)/);
});

test('hoja «¿Ya tenés BRAMUlab instalada?»: los 4 pasos aprobados, microdemostración con los componentes reales y COPIAR INVITACIÓN', () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('id="invite-installed-scrim"'), indexHtml.indexOf('id="invite-paste-scrim"') > indexHtml.indexOf('id="invite-installed-scrim"') ? indexHtml.length : indexHtml.length);
  const steps = [...sheet.matchAll(/<li>([^<]+)<\/li>/g)].map((m) => m[1]).slice(0, 4);
  assert.deepEqual(steps, ['Copiá esta invitación.', 'Abrí BRAMUlab desde el ícono de tu celular.', 'Tocá el menú y elegí «¿Recibiste una invitación?».', 'Pegá la invitación para continuar.']);
  assert.match(sheet, /id="invite-installed-demo"[^>]*aria-hidden="true"/);
  assert.match(sheet, /class="app-menu-btn__bars mdemo__bars"/, 'las líneas de la demo son las del ☰ real');
  assert.match(sheet, /COPIAR INVITACIÓN/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\{\s*\.mdemo \*\{ animation:none !important; \}/);
});

test('copiar invitación: copia el enlace completo de la invitación pendiente (mismo token), anima mensaje → tilde → «Invitación copiada», con respaldo manual', () => {
  const body = fnBody('copyPendingInvitationLink');
  assert.match(body, /Store\.loadClaimToken\(\)/);
  assert.match(body, /buildInviteLinkUrl\(token\)/, 'enlace corto oficial recodificado desde el token ya capturado');
  assert.match(body, /copyInviteText\(url\)/, 'reutiliza la copia existente (ClipboardItem → writeText)');
  assert.match(body, /classList\.add\('is-copied'\)[\s\S]*Invitación copiada/);
  assert.match(body, /invite-copy-manual[\s\S]*box\.value = url[\s\S]*box\.select\(\)/, 'si el portapapeles falla: el enlace queda seleccionable');
  assert.match(css, /\.invite-copy-btn\.is-copied \.invite-copy-btn__ico-ok\{ opacity:1; transform: scale\(1\) rotate\(0\); \}/);
});

test('app instalada: pegar/importar valida el circuito legítimo y entra al flujo EXISTENTE; nunca reclama por sí solo ni escribe un código a mano', () => {
  const imp = fnBody('importPastedInvitation');
  assert.match(imp, /PLI\.parseInvitationLink\(text, inviteAllowedHosts\(\)\)/);
  assert.match(imp, /Store\.saveClaimToken\(parsed\.token\)/);
  assert.match(imp, /handlePendingInvitation\(\{ onboardingDone: true \}\)/);
  for (const name of ['importPastedInvitation', 'pasteInvitationFromClipboard', 'initInvitationImport', 'openInvitePasteSheet']) {
    assert.doesNotMatch(fnBody(name), /claimProvisionalPlayer|clearClaimToken\(\)\s*;\s*Auth\./, `${name} no reclama`);
  }
  // la única vinculación sigue siendo SÍ, ESE SOY YO dentro de askInvitationConfirmation
  assert.equal([...appJs.matchAll(/Auth\.claimProvisionalPlayer\(/g)].length, 1);
  assert.match(fnBody('askInvitationConfirmation'), /Auth\.claimProvisionalPlayer\(token\)/);
  assert.match(fnBody('pasteInvitationFromClipboard'), /navigator\.clipboard\.readText\(\)/, 'lectura por acción explícita del usuario');
  assert.match(fnBody('pasteInvitationFromClipboard'), /showInvitePasteManual\(/, 'si la lectura falla/está bloqueada: campo manual');
  assert.match(fnBody('importPastedInvitation'), /showInvitePasteManual\(INVITE_PASTE_ERROR_TEXT/);
  const hosts = fnBody('inviteAllowedHosts');
  assert.match(hosts, /window\.location\.hostname/);
  assert.match(hosts, /__BRAMU_ENV__[\s\S]*inviteBase/);
});

test('hoja de pegado: PEGAR INVITACIÓN primero, campo manual solo cuando hace falta, aviso de que pegar no vincula nada', () => {
  const sheet = indexHtml.slice(indexHtml.indexOf('id="invite-paste-scrim"'), indexHtml.indexOf('id="invite-installed-scrim"'));
  assert.ok(sheet.indexOf('PEGAR INVITACIÓN') < sheet.indexOf('id="invite-paste-input"'));
  assert.match(sheet, /id="invite-paste-manual" class="invite-paste__manual" hidden/);
  assert.match(sheet, /Pegar la invitación no vincula nada por sí solo/);
  assert.match(sheet, /id="invite-paste-error"[^>]*role="alert"/);
});

test('el circuito V04.46 no se toca: el servicio de invitación, la captura ?claim= y el mensaje compartido siguen idénticos', () => {
  assert.match(fnBody('captureClaimTokenFromUrl'), /Store\.saveClaimToken\(cleanToken\)/);
  assert.match(appJs, /function buildInviteMessage\(url\)/);
  assert.match(fnBody('handlePendingInvitation'), /Auth\.previewClaimLink\(token\)/, 'vista previa segura (no consume) antes de preguntar');
  assert.match(fnBody('askInvitationConfirmation'), /¿JUGASTE ESTE PARTIDO\?/);
  assert.match(read('sw.js'), /pathname\.indexOf\('\/invitacion\/'\) === 0/);
});

/* ============================ Guardado automático ============================ */
test('Editar datos: sin botón GUARDAR; «Nombre visible» pasa a «Apodo» (copy; el campo y las reglas siguen igual)', () => {
  const edit = section('view-edit-data');
  assert.doesNotMatch(edit, /GUARDAR|type="submit"/);
  assert.match(edit, /<label class="field-label" for="profile-edit-display-name">Apodo<\/label>/);
  assert.match(edit, /id="profile-edit-display-name"/, 'mismo campo/columna: solo cambia el copy');
  assert.doesNotMatch(indexHtml, /Nombre visible|Nombre para mostrar/);
  assert.match(indexHtml, /<span class="profile-field__label">Apodo<\/span>/);
  assert.match(edit, /id="profile-edit-autosave"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('autoguardado: guarda al salir del campo, con Enter, al elegir una opción/ubicación/foto/WhatsApp y al salir; un debounce evita una solicitud por tecla', () => {
  const init = fnBody('initProfileEditModal');
  assert.match(init, /\['first-name', 'last-name', 'username', 'display-name', 'phone'\]\.forEach/);
  assert.match(init, /addEventListener\('input', \(\) => \{ profileAutosave\.leaveWarned = false; scheduleProfileAutosave\(\); \}\)/);
  assert.match(init, /addEventListener\('blur', \(\) => runProfileAutosave\(\{ final: true \}\)\)/);
  assert.match(init, /e\.key === 'Enter'\) \{ e\.preventDefault\(\); input\.blur\(\)/);
  assert.match(init, /\$\('#profile-edit-whatsapp-toggle'\)[\s\S]*scheduleProfileAutosave\(0\)/);
  assert.match(init, /profileEditPhotoRemoved = true;[\s\S]*scheduleProfileAutosave\(0\)/);
  assert.match(appJs, /const PROFILE_AUTOSAVE_DEBOUNCE_MS = 1100/);
  assert.match(appJs, /if \(typeof fieldKeyOrConfig === 'string' && !\$\('#view-edit-data'\)\.hidden\) scheduleProfileAutosave\(0\)/);
  assert.match(appJs, /onSelect: \(\) => \{ updateProfileLocationRowDisplay\(\); scheduleProfileAutosave\(0\); \}/);
  assert.match(init, /visibilitychange[\s\S]*profileAutosaveOnExit\(\)/);
  assert.match(init, /pagehide/);
});

test('autoguardado: una sola solicitud a la vez, el cambio que llega en vuelo se re-lee después (sin pisar ni duplicar) y un intento fallido no se reintenta en bucle', () => {
  const run = fnBody('runProfileAutosave');
  assert.match(run, /if \(profileAutosave\.inflight\) \{ profileAutosave\.rerun = true; return profileAutosave\.inflight; \}/);
  assert.match(run, /const form = readProfileEditForm\(\);\s*const sig = profileEditFormSignature\(form\)/, 'copia del formulario tomada al iniciar');
  assert.match(run, /if \(sig === profileAutosave\.lastSig\)/, 'sin cambios no hay solicitud');
  assert.match(run, /sig === profileAutosave\.failedSig && !o\.force/);
  assert.match(run, /\.finally\(\(\) => \{\s*profileAutosave\.inflight = null;\s*if \(profileAutosave\.rerun\) \{ profileAutosave\.rerun = false; runProfileAutosave\(\{ final: true \}\); \}/);
  // tras un rechazo parcial, «lo guardado» se calcula desde lo ENVIADO, no desde el formulario actual (bug real encontrado en la verificación)
  assert.match(run, /profileAutosave\.lastSig = profileEditFormSignature\(profileAutosave\.lastForm\)/);
  assert.match(run, /revertedProfileForm\(form, result\.reverted, fresh\)/);
});

test('autoguardado: confirmación con tilde SOLO cuando el servidor confirmó; si falla, avisa, conserva los datos y ofrece reintentar', () => {
  const run = fnBody('runProfileAutosave');
  assert.match(run, /if \(result\.ok\) \{[\s\S]*setProfileAutosaveStatus\('saved', 'Guardado'\)/);
  assert.match(run, /profileAutosave\.draft = \{ userId: user\.id, form \}/, 'borrador pendiente');
  assert.match(run, /setProfileAutosaveStatus\('error', 'No se guardó'\)/);
  assert.match(appJs, /id="profile-edit-autosave-retry"|\$\('#profile-edit-autosave-retry'\)\.addEventListener\('click'/);
  assert.match(fnBody('retryPendingProfileDraft'), /saveServerBackedProfile\(user, d\.form\)/);
  assert.match(appJs, /window\.addEventListener\('online', retryPendingProfileDraft\)/);
  assert.match(fnBody('openProfileEditModal'), /profileAutosave\.draft[\s\S]*scheduleProfileAutosave\(0\)/, 'al reabrir se recuperan y reintentan');
  assert.match(css, /\.autosave-status\[data-state="saved"\] \.autosave-status__icon::after\{ content:"✓"/);
});

test('autoguardado: nunca se pierde el último campo — la flecha espera el guardado y cualquier otra salida lo vacía en segundo plano', () => {
  const leave = fnBody('leaveProfileEdit');
  assert.match(leave, /await profileAutosave\.inflight/);
  assert.match(leave, /runProfileAutosave\(\{ final: true \}\)/);
  assert.match(leave, /leaveWarned/, 'salir con algo sin guardar avisa una vez');
  assert.match(appJs, /if \(editView && !editView\.hidden && name !== 'edit-data'\) profileAutosaveOnExit\(\)/);
  assert.match(fnBody('profileAutosaveOnExit'), /active\.blur\(\)/);
});

test('autoguardado: respeta reglas existentes — @usuario fijo en cuentas reales, mismas RPC por separado, ubicación/rama solo si se tocaron, y sin autosave en operaciones sensibles', () => {
  assert.match(appJs, /\$\('#profile-edit-username'\)\.disabled = serverBacked;/);
  const save = fnBody('saveServerBackedProfile');
  assert.match(save, /username: user\.username, firstName: form\.firstName/, '@usuario siempre el guardado');
  for (const rpc of ['Auth.completeProfile(', 'Auth.completeRankingProfileData(', 'Auth.completeContactProfileData(', 'Auth.updateCurrentCategory(', 'Auth.updateProfileAvatar(']) assert.ok(save.includes(rpc), rpc);
  assert.match(save, /rankingTouched = !o\.baseline \|\|/);
  assert.match(save, /El apodo no puede quedar vacío\./);
  const autosaveCode = appJs.slice(appJs.indexOf('/* ---- V04.47 — GUARDADO AUTOMÁTICO'), appJs.indexOf('function initProfileEditModal'));
  assert.doesNotMatch(autosaveCode, /deleteMyAccount|requestAccountChallenge|changePassword|updatePassword|signOut/, 'cambio de credenciales / eliminación de cuenta nunca son autosave');
});

/* ============================ Versionado ============================ */
test('versionado: V04.47 fue superada (ver v0448/v0449); el cuarteto sigue sincronizado', () => {
  const v = JSON.parse(read('version.json'));
  assert.match(v.version, /^BRAMUlab V04\.(4[789]|50)$/);
  assert.ok(read('store.js').includes(`'${v.version}'`) && read('store.js').includes(`'${v.bundle}'`));
  assert.ok(read('sw.js').includes(`bramulab-v${v.bundle.replace('.', '-')}`));
});
