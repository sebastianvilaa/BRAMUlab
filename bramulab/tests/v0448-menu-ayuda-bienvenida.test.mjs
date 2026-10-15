// BRAMUlab — V04.48: pulido de V04.47 — menú con acentos selectivos y «Herramientas de prueba» (solo Staging), Ayuda con buscador instantáneo y FAQ de
// invitaciones, y bienvenida compacta cuando se llega con una invitación.
// Ejecutar con: node --test bramulab/tests/v0448-menu-ayuda-bienvenida.test.mjs
// app.js vive dentro de un cierre (sin cobertura unitaria por diseño): se prueban por texto los contratos, y la lógica pura del buscador con el código real extraído.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');
const authJs = read('auth.js');

function section(id) { const a = indexHtml.indexOf(`id="${id}"`); assert.ok(a >= 0, id); return indexHtml.slice(a, indexHtml.indexOf('</section>', a)); }
function fnBody(name) {
  const a = appJs.indexOf(`function ${name}(`); assert.ok(a >= 0, `function ${name}`);
  let depth = 0; let started = false;
  for (let i = a; i < appJs.length; i += 1) {
    if (appJs[i] === '{') { depth += 1; started = true; } else if (appJs[i] === '}') { depth -= 1; if (started && depth === 0) return appJs.slice(a, i + 1); }
  }
  throw new Error(`cuerpo de ${name}`);
}

/* ============================ Menú ============================ */
test('menú: orden final 1-6 (Editar, Mis jugadores, Invitación, Ayuda, Herramientas de prueba, Cerrar sesión al pie) agrupado y con acentos SELECTIVOS', () => {
  const groups = appJs.match(/const APP_MENU_GROUPS = \[([\s\S]*?)\n  \];/)[1];
  const labels = [...groups.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Editar mi perfil', 'Mis jugadores', '¿Recibiste una invitación?', 'Ayuda', 'Herramientas de prueba']);
  const tones = [...groups.matchAll(/tone: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(tones, ['blue', 'blue', 'lime', 'dim', 'dim'], 'azul para lo personal, lima SOLO la invitación, neutro el resto');
  assert.equal(tones.filter((t) => t === 'lime').length, 1);
  assert.match(appJs, /const APP_MENU_FOOTER_ITEMS = \[\{ id: 'logout', label: 'Cerrar sesión', icon: APP_MENU_ICONS\.logout, secondary: true \}\]/);
  assert.match(css, /\.app-menu__icon\.is-blue\{ color: var\(--accent-cyan\)/);
  assert.match(css, /\.app-menu__icon\.is-lime\{ color: var\(--brand-lime\)/);
  assert.match(css, /\.app-menu__group\{[^}]*border-radius: 18px/, 'agrupaciones con superficie propia');
  assert.match(css, /\.app-menu__item \+ \.app-menu__item\{ border-top: 1px solid var\(--line\); \}/, 'separadores discretos');
  assert.match(css, /\.app-menu\{[^}]*radial-gradient[^}]*linear-gradient/, 'más profundidad que el panel plano anterior');
});

test('herramientas de prueba: el ítem existe SOLO fuera de Production (no se dibuja ni responde); el matraz del encabezado desapareció', () => {
  const group = appJs.match(/const APP_MENU_GROUPS = \[([\s\S]*?)\n  \];/)[1];
  assert.match(group, /id: 'lab', label: 'Herramientas de prueba'[^}]*staging: true/);
  const markup = fnBody('appMenuMarkup');
  assert.match(markup, /!it\.staging \|\| \(!demo && !isProductionEnv\(\)\)/, 'solo Staging/Development; nunca en la demo pública');
  assert.match(fnBody('openLabTools'), /if \(isProductionEnv\(\)\) return;/, 'guarda del handler, igual que el resto del laboratorio');
  assert.match(fnBody('openLabTools'), /\$\('#dev-tools-modal'\)\.hidden = false/, 'abre el MISMO modal de Herramientas');
  assert.match(fnBody('onAppMenuAction'), /id === 'lab'\) openLabTools\(\)/);
  assert.doesNotMatch(indexHtml, /id="player-home-lab-preview-btn"/);
  assert.doesNotMatch(appJs, /player-home-lab-preview-btn/);
  // protecciones existentes intactas
  assert.match(appJs, /function isProductionEnv\(\) \{\s*return !!\(window\.__BRAMU_ENV__ && window\.__BRAMU_ENV__\.name === 'production'\);/);
  assert.match(fnBody('setLevelV1Preview'), /if \(isProductionEnv\(\)\) \{ Store\.setLevelV1PreviewEnabled\(false\)/);
  assert.match(fnBody('refreshLabPreviewUI'), /resetNivelBtn\.hidden = production \|\| !enabled/);
  assert.match(fnBody('createLabTestUserAndOpenOnboarding'), /isProductionEnv\(\)\) return;/);
  assert.match(fnBody('initDevTools'), /dev-tools-force-update[\s\S]*dev-tools-toggle-nivel-v1[\s\S]*dev-tools-reset-nivel[\s\S]*dev-tools-create-test-claim/, 'las herramientas existentes siguen conectadas');
});

test('menú: la microdemostración de la invitación usa los accesos reales pero nunca Herramientas de prueba; el menú y sus gestos siguen igual', () => {
  assert.match(fnBody('initAppMenu'), /const demoMarkup = appMenuMarkup\(\{ demo: true \}\)/);
  assert.match(fnBody('initAppMenu'), /invite-installed-demo-menu'\)\.innerHTML = .*demoMarkup\.list.*demoMarkup\.footer/);
  for (const re of [/addEventListener\('touchstart'/, /e\.key === 'Escape' && appMenuOpen/, /#app-menu-scrim'\)\.addEventListener\('click'/]) assert.match(fnBody('initAppMenu'), re);
  assert.match(fnBody('showView'), /appMenuOpen && name !== 'player-home'\) closeAppMenu\(\{ immediate: true \}\)/);
});

/* ============================ Ayuda ============================ */
test('Ayuda: buscador arriba de las preguntas (sin red), con borrar y estado sin resultados; tres preguntas de invitaciones en su categoría', () => {
  const help = section('view-help');
  assert.ok(help.indexOf('id="help-search-input"') < help.indexOf('CONOCÉ BRAMU'), 'el campo va arriba de las preguntas');
  assert.match(help, /<input id="help-search-input"[^>]*type="search"[^>]*aria-label="Buscar en la ayuda"/);
  assert.match(help, /id="help-search-clear"[^>]*aria-label="Borrar búsqueda"[^>]*hidden/);
  assert.match(help, /id="help-search-empty"[^>]*role="status"[^>]*hidden>No encontramos preguntas con esa búsqueda\./);
  const cats = [...help.matchAll(/settings-group__title">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(cats, ['CONOCÉ BRAMU', 'TUS PARTIDOS', 'INVITACIONES', 'GRUPOS', 'TU NIVEL Y RANKING']);
  const inv = help.slice(help.indexOf('INVITACIONES</div>'), help.indexOf('GRUPOS</div>'));
  const qs = [...inv.matchAll(/<summary class="help-faq__q"><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.equal(qs.length, 3);
  assert.match(qs[0], /invito a alguien que todavía no tiene cuenta/);
  assert.match(qs[1], /recibí una invitación/);
  assert.match(qs[2], /Safari/);
  // copy basado en el circuito real (nombres exactos de botones/pantallas)
  for (const t of ['Invitar a', 'Enviar por WhatsApp', 'Sí, ese soy yo', 'No, no soy yo', '¿Ya tenés BRAMUlab instalada?', 'Copiar invitación', '¿Recibiste una invitación?', 'Buscar jugadores']) assert.ok(inv.includes(t), t);
  assert.doesNotMatch(fnBody('filterHelp') + fnBody('initHelpSearch') + fnBody('resetHelpSearch'), /fetch\(|Auth\.|rpc\(/, 'sin llamadas al servidor');
});

test('buscador: lógica real (extraída de app.js) — sin mayúsculas ni acentos, título + respuesta, categorías vacías ocultas, vuelve la lista al borrar', () => {
  const norm = appJs.slice(appJs.indexOf('  function normalizeSearchText'), appJs.indexOf('  let helpSearchIndex = null;'));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(norm + '\nthis.normalizeSearchText = normalizeSearchText;', ctx);
  const n = ctx.normalizeSearchText;
  assert.equal(n('  ¿Cómo  INVITO?  '), '¿como invito?');
  assert.equal(n('Invitación'), 'invitacion');
  assert.equal(n('PÁDEL'), 'padel');
  // modelo mínimo del filtro con los mismos pasos que filterHelp
  const items = [
    { cat: 'A', text: n('¿Cómo cargo un partido? Si alguno no tiene cuenta, podés agregarlo como invitado.') },
    { cat: 'B', text: n('¿Qué hago si recibí una invitación? Abrí el enlace.') },
    { cat: 'C', text: n('¿Cómo funcionan los Grupos? Tabla semanal.') },
  ];
  const run = (q) => { const t = n(q).split(' ').filter(Boolean); const vis = items.filter((it) => t.every((x) => it.text.includes(x))); return { vis: vis.length, cats: [...new Set(vis.map((v) => v.cat))] }; };
  assert.deepEqual(run('inv'), { vis: 2, cats: ['A', 'B'] }, 'desde 3 letras: título y respuesta');
  assert.equal(run('INVITACIÓN').vis, 1);
  assert.equal(run('semanal').vis, 1, 'busca en el contenido de la respuesta');
  assert.equal(run('grupos tabla').vis, 1, 'todas las palabras deben aparecer');
  assert.equal(run('zzz').vis, 0);
  assert.equal(run('').vis, 3, 'sin texto: lista completa');
  const body = fnBody('filterHelp');
  assert.match(body, /it\.el\.hidden = !match/);
  assert.match(body, /cat\.hidden = !cat\.querySelector\('\.help-faq__item:not\(\[hidden\]\)'\)/, 'categoría sin preguntas visibles: oculta');
  assert.match(body, /help-search-empty'\)\.hidden = !\(filtering && visible === 0\)/);
  assert.match(fnBody('initHelpSearch'), /addEventListener\('input', \(\) => filterHelp\(input\.value\)\)/, 'tiempo real, desde el primer carácter');
  assert.match(fnBody('initHelpSearch'), /help-search-clear'\)\.addEventListener\('click', \(\) => \{ resetHelpSearch\(\); input\.focus\(\)/);
  assert.match(fnBody('openHelpScreen'), /resetHelpSearch\(\)/, 'al abrir Ayuda la búsqueda empieza limpia');
  assert.match(css, /\.help-faq__item\[hidden\], \.help-cat\[hidden\]\{ display:none !important; \}/);
});

/* ============================ Bienvenida con invitación ============================ */
test('bienvenida con invitación: logo + claim + titular/bajada de la web y tarjeta protagonista; las 3 tarjetas solo se retiran con invitación (composición final: v0449)', () => {
  const access = section('view-access');
  assert.match(access, /<h1 class="welcome-claim">Donde vive tu pádel\.<\/h1>/);
  assert.match(access, /id="access-invited-intro"[^>]*hidden>\s*<p class="welcome-invited-intro__title">Tus partidos no terminan cuando salís de la cancha\.<\/p>\s*<p class="welcome-invited-intro__sub">Cargá tus resultados, descubrí tus estadísticas y competí con tus amigos\.<\/p>/);
  assert.match(access, /id="access-invitation-title">Te invitaron a BRAMUlab</);
  assert.match(access, /Hay un partido esperando para sumarse a tu historial\. Entrá y confirmá si jugaste para recuperarlo\./);
  assert.equal([...access.matchAll(/class="welcome-benefit /g)].length, 3);
  assert.match(css, /#view-access\.is-invited \.welcome-benefits\{ display:none; \}/);
  assert.match(css, /\.welcome-invited-intro\{ display:none;/, 'sin invitación el bloque nuevo no se ve');
});

test('bienvenida con invitación: se activa solo con token pendiente; CREAR CUENTA principal, INICIAR SESIÓN visible; mismos botones y handlers (sin duplicar auth)', () => {
  const body = fnBody('renderAccessInvitationCard');
  assert.match(body, /const token = Store\.loadClaimToken && Store\.loadClaimToken\(\);\s*const invited = !!token;/);
  assert.match(body, /view\.classList\.toggle\('is-invited', invited\)/);
  assert.match(body, /intro\.hidden = !invited/);
  assert.match(body, /signup\.classList\.toggle\('btn-start', invited\)[\s\S]*login\.classList\.toggle\('btn-secondary', invited\)/);
  assert.equal([...indexHtml.matchAll(/id="access-signup-btn"/g)].length, 1, 'un solo botón de crear cuenta (no se duplica el HTML)');
  assert.equal([...indexHtml.matchAll(/id="access-login-btn"/g)].length, 1);
  assert.match(css, /#view-access\.is-invited #access-signup-btn\{ order: 1; \}\s*#view-access\.is-invited #access-login-btn\{ order: 2; \}/);
  assert.match(fnBody('initAccessScreen'), /access-login-btn[\s\S]*access-signup-btn'\)\.addEventListener\('click', openSignupWizard\)/);
  // la bienvenida habitual no se toca: INICIAR SESIÓN btn-start / CREAR CUENTA btn-secondary en el HTML base
  assert.match(indexHtml, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>\s*<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
});

test('estado real del enlace: usa la RPC pública ya existente (solo lee ok), nunca afirma de más; inválido/vencido/usado cambia el mensaje', () => {
  assert.match(authJs, /async function getInvitationAvailability\(token\)[\s\S]*c\.rpc\('get_invitation_card'/);
  assert.match(authJs, /return data\.ok === true \? 'available' : 'unavailable';/);
  assert.match(authJs, /if \(error \|\| !data \|\| typeof data !== 'object'\) return 'unknown';/, 'error de red/RPC → unknown (mensaje por defecto)');
  assert.match(authJs, /createClaimLink, claimProvisionalPlayer, previewClaimLink, getInvitationAvailability,/);
  const body = fnBody('refreshInvitationAvailability');
  assert.match(body, /if \(state === 'unknown'\) return;/, 'unknown no se cachea ni cambia nada');
  assert.match(body, /Store\.loadClaimToken\(\) === token/, 'no pisa la tarjeta si el token cambió mientras tanto');
  const apply = fnBody('applyInvitationCardState');
  assert.match(apply, /unavailable \? INVITATION_CARD_TEXT\.unavailableTitle/);
  assert.match(apply, /installed\.hidden = unavailable \|\| isStandaloneApp\(\)/);
  assert.match(appJs, /unavailableTitle: 'Esta invitación ya no está disponible'/);
  // ninguna migración nueva: la RPC es la de V04.41
  assert.ok(fs.existsSync(path.join(root, '..', 'supabase', 'migrations', '20261014190000_v0441_invitation_public_card.sql')));
});

test('continuidad segura del token: la bienvenida solo LEE el token; ni mostrar la tarjeta ni importar reclaman nada', () => {
  for (const name of ['renderAccessInvitationCard', 'applyInvitationCardState', 'refreshInvitationAvailability', 'filterHelp', 'openLabTools']) {
    assert.doesNotMatch(fnBody(name), /claimProvisionalPlayer|clearClaimToken|saveClaimToken/, `${name} no toca el token`);
  }
  assert.equal([...appJs.matchAll(/Auth\.claimProvisionalPlayer\(/g)].length, 1, 'el único reclamo sigue siendo SÍ, ESE SOY YO');
  assert.match(fnBody('importPastedInvitation'), /handlePendingInvitation\(\{ onboardingDone: true \}\)/);
  assert.match(fnBody('captureClaimTokenFromUrl'), /Store\.saveClaimToken\(cleanToken\)/);
});

test('autoguardado de Editar datos: sin regresiones (misma API y disparadores)', () => {
  for (const fn of ['runProfileAutosave', 'leaveProfileEdit', 'profileAutosaveOnExit', 'saveServerBackedProfile']) assert.ok(appJs.includes(`function ${fn}(`), fn);
  assert.match(appJs, /const PROFILE_AUTOSAVE_DEBOUNCE_MS = 1100/);
  assert.doesNotMatch(indexHtml.slice(indexHtml.indexOf('id="view-edit-data"'), indexHtml.indexOf('</section>', indexHtml.indexOf('id="view-edit-data"'))), /type="submit"/);
});

/* ============================ Versionado ============================ */
test('versionado: V04.48 fue superada por V04.49 (ver v0449); el cuarteto sigue sincronizado', () => {
  const v = JSON.parse(read('version.json'));
  assert.match(v.version, /^BRAMUlab V04\.4[89]$/);
  assert.ok(read('store.js').includes(`'${v.version}'`) && read('store.js').includes(`'${v.bundle}'`));
  assert.ok(read('sw.js').includes(`bramulab-v${v.bundle.replace('.', '-')}`));
});
