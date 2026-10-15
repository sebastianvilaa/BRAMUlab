// BRAMUlab — V04.50: UNA sola bienvenida universal. Con invitación pendiente se agrega ÚNICAMENTE una cuarta tarjeta; las variantes de V04.48/V04.49 se descartaron.
// Ejecutar con: node --test bramulab/tests/v0450-bienvenida-universal.test.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const appJs = read('app.js');
const indexHtml = read('index.html');
const css = read('styles.css');
const access = indexHtml.slice(indexHtml.indexOf('id="view-access"'), indexHtml.indexOf('</section>', indexHtml.indexOf('id="view-access"')));

function fnBody(name) {
  const a = appJs.indexOf(`function ${name}(`); assert.ok(a >= 0, `function ${name}`);
  let depth = 0; let started = false;
  for (let i = a; i < appJs.length; i += 1) {
    if (appJs[i] === '{') { depth += 1; started = true; } else if (appJs[i] === '}') { depth -= 1; if (started && depth === 0) return appJs.slice(a, i + 1); }
  }
  throw new Error(`cuerpo de ${name}`);
}

test('la bienvenida es IDÉNTICA a la anterior a V04.48 (HTML) salvo la cuarta tarjeta de invitación', () => {
  const before = execFileSync('git', ['show', '17af0db:bramulab/index.html'], { cwd: repo, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const view = (h) => { const a = h.indexOf('id="view-access"'); return h.slice(a, h.indexOf('</section>', a)); };
  const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ');
  const card = (h) => h.replace(/<div class="invitation-card"[\s\S]*?<\/button>\s*<\/div>/, '');
  assert.equal(strip(card(view(indexHtml))), strip(card(view(before))), 'todo lo demás (logo, claim, 3 tarjetas, botones, avisos) es exactamente lo original');
});

test('en TODOS los casos: logo + claim, las 3 tarjetas originales y los botones originales (INICIAR SESIÓN lima, CREAR CUENTA oscuro) hacia el pie', () => {
  assert.match(access, /class="access-logo"/);
  assert.match(access, /<h1 class="welcome-claim">Donde vive tu pádel\.<\/h1>/);
  assert.deepEqual([...access.matchAll(/class="welcome-benefit__title">([^<]+)</g)].map((m) => m[1]), ['Cargá tus partidos', 'Competí con tus amigos', 'Construí tu Nivel BRAMU']);
  assert.match(access, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>\s*<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
  assert.match(access, /<div class="welcome-spacer welcome-spacer--mid" aria-hidden="true"><\/div>\s*<div class="access-actions">/, 'separador flexible que mantiene los botones hacia el pie');
  assert.match(css, /\.welcome-spacer\{ flex: 1 1 0; min-height: 8px; \}/);
  assert.match(css, /\.welcome-spacer--mid\{ flex-grow: 1\.15; min-height: 18px; \}/);
});

test('descartado: sin titular/bajada en la bienvenida, sin variante .is-invited, sin inversión de botones ni reglas de distribución propias', () => {
  assert.doesNotMatch(access, /Tus partidos no terminan|Cargá tus resultados, descubrí|access-invited-intro|welcome-invited-intro/);
  assert.doesNotMatch(css, /is-invited|welcome-invited-intro|access-installed-link/);
  assert.doesNotMatch(appJs, /is-invited|access-invited-intro|welcome-invited/);
  const body = fnBody('renderAccessInvitationCard');
  assert.doesNotMatch(body, /classList\.toggle\('btn-(start|secondary)'|view\.classList|intro\./);
  assert.doesNotMatch(css, /#view-access[^{]*#access-(signup|login)-btn\{ order/);
  // los textos siguen perteneciendo a la web pública
  const web = fs.readFileSync(path.join(repo, 'bramulab-web', 'public', 'index.html'), 'utf8');
  assert.match(web, /Tus partidos <em>no terminan<\/em> cuando salís de la cancha\./);
  assert.match(web, /Cargá tus resultados, descubrí tus estadísticas y competí con tus amigos\./);
});

test('SOLO con invitación pendiente: cuarta tarjeta debajo de las tres, con su estado, y el enlace de «instalada» DENTRO de ella (mismo botón y handler)', () => {
  const a = (s) => { const i = access.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = [a('class="welcome-benefits"'), a('id="access-invitation-card"'), a('id="access-backend-unavailable"'), a('class="access-actions"')];
  assert.deepEqual(order, [...order].sort((x, y) => x - y), 'debajo de las tres tarjetas y antes de los botones');
  const card = access.slice(access.indexOf('id="access-invitation-card"'), access.indexOf('id="access-backend-unavailable"'));
  assert.match(card, /id="access-invitation-card" hidden>/, 'oculta por defecto: la bienvenida sin invitación no cambia');
  assert.match(card, /id="access-invitation-title">Te invitaron a BRAMUlab</);
  assert.match(card, /Hay un partido esperando para sumarse a tu historial\. Entrá y confirmá si jugaste para recuperarlo\./);
  assert.match(card, /id="access-installed-btn" class="invitation-card__link">¿Ya tenés BRAMUlab instalada\?<\/button>/);
  assert.equal([...indexHtml.matchAll(/id="access-installed-btn"/g)].length, 1, 'sin controles duplicados');
  assert.equal([...appJs.matchAll(/'#access-installed-btn'\)\.addEventListener/g)].length, 1, 'un solo handler');
  assert.match(fnBody('initInvitationImport'), /'#access-installed-btn'\)\.addEventListener\('click', openInviteInstalledSheet\)/);
  assert.match(fnBody('renderAccessInvitationCard'), /card\.hidden = !token/);
  assert.match(fnBody('renderAccessInvitationCard'), /if \(token\) refreshInvitationAvailability\(token\); else applyInvitationCardState\('unknown'\)/);
});

test('la tarjeta conserva el tratamiento mejorado pero integrado al sistema de tarjetas (mismo radio/superficie translúcida que las de beneficios) y los estados no disponible', () => {
  const rule = css.match(/#view-access \.invitation-card\{([^}]*)\}/)[1];
  assert.match(rule, /border-radius: 12px/);
  assert.match(rule, /background: rgba\(4,9,16,\.58\)/, 'misma superficie que .welcome-benefit');
  assert.match(rule, /border:1px solid rgba\(149,255,25,\.42\)/, 'acento lima de la invitación');
  assert.match(css, /\.invitation-card__icon\{[^}]*width:36px; height:36px; border-radius:11px/, 'mismo ícono que las tarjetas');
  assert.match(css, /\.invitation-card\.is-unavailable \.invitation-card__title\{ color: var\(--paper\); \}/);
  const apply = fnBody('applyInvitationCardState');
  assert.match(apply, /unavailable \? INVITATION_CARD_TEXT\.unavailableTitle/);
  assert.match(apply, /installed\.hidden = unavailable \|\| isStandaloneApp\(\)/, 'oculto si no está disponible o la app ya está instalada');
  assert.match(appJs, /unavailableTitle: 'Esta invitación ya no está disponible'/);
});

test('lo aprobado no se tocó: copiar/pegar, token (solo lectura acá), Open Graph, menú, Ayuda y autoguardado', () => {
  for (const name of ['renderAccessInvitationCard', 'applyInvitationCardState', 'refreshInvitationAvailability']) assert.doesNotMatch(fnBody(name), /claimProvisionalPlayer|clearClaimToken|saveClaimToken/, name);
  assert.equal([...appJs.matchAll(/Auth\.claimProvisionalPlayer\(/g)].length, 1);
  assert.match(indexHtml, /<meta property="og:image" content="https:\/\/bramulab\.com\/assets\/social\/og-bramulab\.jpg" \/>/);
  assert.match(indexHtml, /<meta property="og:url" content="https:\/\/app\.bramulab\.com\/" \/>/);
  for (const fn of ['openLabTools', 'filterHelp', 'runProfileAutosave', 'copyPendingInvitationLink', 'importPastedInvitation']) assert.ok(appJs.includes(`function ${fn}(`), fn);
  const diff = execFileSync('git', ['diff', '--name-only', '17af0db', '--', 'bramulab-web', 'bramulab-invite', 'supabase'], { cwd: repo, encoding: 'utf8' }).trim();
  assert.equal(diff, '', 'web pública, invitaciones y Supabase sin cambios');
});

test('versionado V04.50 en cuarteto + referencias ?v= y service worker', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.50', bundle: '04.50' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.50'/);
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.50'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-50'/);
  assert.doesNotMatch(indexHtml, /\?v=04\.49/);
  assert.doesNotMatch(read('sw.js'), /\?v=04\.49/);
});
