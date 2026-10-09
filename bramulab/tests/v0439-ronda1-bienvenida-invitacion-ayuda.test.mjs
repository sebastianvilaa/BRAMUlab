// BRAMUlab V04.39 · Ronda 1 post-lanzamiento — Bienvenida, invitación genérica y Ayuda.
// Ejecutar con: node --test bramulab/tests/v0439-ronda1-bienvenida-invitacion-ayuda.test.mjs
// app.js es un IIFE sin DOM aislable: guardas ESTÁTICAS sobre el código/HTML/CSS + ejecución de las funciones puras extraídas.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const css = read('styles.css');
const appJs = read('app.js');
const sw = read('sw.js');

const section = (id) => {
  const start = html.indexOf(`<section id="${id}"`);
  assert.ok(start !== -1, `no existe #${id}`);
  return html.slice(start, html.indexOf('</section>', start));
};
function fnBody(name) {
  const m = appJs.match(new RegExp(`\\n  (?:async )?function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(m, `no se encontró ${name}`);
  const from = m.index + m[0].length;
  return appJs.slice(from, appJs.indexOf('\n  }\n', from));
}

// ---------------------------------------------------------------- 1. Bienvenida
test('Bienvenida: logo original, claim, 3 beneficios y los 2 botones reales con su jerarquía', () => {
  const v = section('view-access');
  assert.match(v, /<img class="access-logo" src="icons\/logo\.svg" alt="BRAMUlab" \/>/, 'logo maestro intacto');
  assert.match(v, /Donde vive<br>tu <span class="welcome-claim__accent">pádel\.<\/span>/);
  for (const t of ['Cargá tus partidos', 'Competí con tus amigos', 'Construí tu Nivel BRAMU']) assert.ok(v.includes(`>${t}<`), t);
  assert.match(v, /PÁDEL AMATEUR/, 'debe decir de entrada que es pádel amateur');
  assert.match(v, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>/);
  assert.match(v, /<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
  assert.ok(v.indexOf('access-login-btn') < v.indexOf('access-signup-btn'), 'INICIAR SESIÓN primero (principal)');
});

test('Bienvenida: NO agrega aceptación legal automática ni toca registro/OTP/auth', () => {
  const v = section('view-access');
  assert.doesNotMatch(v, /Al continuar aceptás/i);
  assert.doesNotMatch(v, /Términos|Privacidad|data-legal-doc/);
  assert.match(section('view-signup'), /data-legal-doc/, 'el consentimiento real sigue en el alta');
});

test('Bienvenida: la foto es una capa provisoria que se reemplaza cambiando solo una variable CSS', () => {
  const v = section('view-access');
  assert.match(v, /class="welcome-hero" aria-hidden="true"/);
  assert.match(css, /#view-access\{[^}]*--welcome-hero-image: url\('assets\/bienvenida-hero\.jpg\?v=[\d.]+-h\d+'\)/);
  assert.match(css, /--welcome-hero-pos:/);
  assert.match(css, /\.welcome-hero__photo\{[^}]*var\(--welcome-hero-image\)/);
  assert.match(css, /\.welcome-hero::after\{[^}]*linear-gradient/, 'degradés listos para la foto definitiva');
  assert.match(sw, /\.\/assets\/bienvenida-hero\.jpg\?v=/, 'el recurso está en el precache');
  assert.ok(fs.statSync(path.join(root, 'assets/bienvenida-hero.jpg')).size > 50000, 'existe el recurso provisorio');
});

test('Bienvenida: móviles chicos entran y se pueden desplazar (scroller propio + compactación en pantallas bajas)', () => {
  assert.match(css, /#view-access \.access-scroll, #view-legal-gate \.access-scroll[^{]*\{[^}]*overflow-y:auto/);
  assert.match(css, /@media \(max-height: 600px\)\{[^}]*\.welcome-claim/);
  assert.match(css, /@media \(max-width: 340px\)/);
  assert.match(css, /\.welcome-claim\{[^}]*clamp\(/);
  assert.match(css, /#view-access \.access-scroll::before, #view-access \.access-scroll::after\{ flex:0 0 0; \}/);
});

// ---------------------------------------------------------------- 2. Invitación genérica
test('Invitación genérica: vive en BUSCAR JUGADORES, con el copy pedido, y es distinta de la invitación personal', () => {
  const v = section('view-player-search');
  assert.match(v, /id="player-search-invite"[^>]*hidden/, 'oculta por defecto');
  assert.match(v, /¿NO ESTÁ EN BRAMU\?/);
  assert.match(v, /id="player-search-invite-btn"[^>]*>INVITAR A BRAMU</);
  assert.match(v, /id="player-search-invite-copy-btn"/);
  assert.doesNotMatch(v.replace(/<!--[\s\S]*?-->/g, '').replace(/invite-sheet__feedback/g, ''), /invite-sheet|claim/i, 'no reutiliza el circuito de invitación personal (solo el estilo del feedback)');
});

test('Invitación genérica: mensaje humano con el enlace general y sin token ni datos personales', () => {
  const m = appJs.match(/const GENERIC_INVITE_URL = '([^']+)';/);
  assert.equal(m && m[1], 'https://app.bramulab.com');
  const msg = new Function(`const GENERIC_INVITE_URL=${JSON.stringify(m[1])}; return (function(){${fnBody('buildGenericInviteMessage')}})();`)();
  assert.ok(msg.includes('https://app.bramulab.com'));
  assert.ok(msg.length < 220, 'breve');
  assert.match(msg, /BRAMUlab/);
  assert.match(msg, /pádel amateur/);
  assert.doesNotMatch(msg, /\?|token|claim/i);
});

test('Invitación genérica: solo aparece con una búsqueda terminada sin cuentas reales (nunca ante un error)', () => {
  const body = fnBody('renderPlayerSearchResultsServerBacked');
  const visibleCalls = [...body.matchAll(/setGenericInviteVisible\(([^)]*)\)/g)].map((x) => x[1]);
  assert.deepEqual(visibleCalls, ['false', 'isEmpty'], 'se oculta al empezar y solo se muestra con isEmpty en el camino exitoso');
  const errIdx = body.indexOf('if (!result.ok)');
  const showIdx = body.indexOf('setGenericInviteVisible(isEmpty)');
  assert.ok(errIdx !== -1 && showIdx > errIdx, 'el camino de error retorna antes de mostrarla');
  assert.match(body.slice(errIdx, showIdx), /return;/);
  assert.match(appJs, /player-search-input'\)\.addEventListener\('input'[\s\S]{0,400}setGenericInviteVisible\(false\)/, 'se retira al seguir escribiendo');
});

test('Invitación genérica: menú nativo primero, copia como alternativa con feedback, cancelar no es error', () => {
  const share = fnBody('shareGenericInvite');
  assert.match(share, /typeof navigator\.share === 'function'/);
  assert.match(share, /navigator\.share\(\{ text: message \}\)/);
  assert.match(share, /AbortError/);
  assert.ok(share.indexOf('navigator.share') < share.indexOf('copyGenericInviteMessage'), 'compartir antes que copiar');
  assert.ok(!/await [^\n]*\n[^\n]*navigator\.share/.test(share.split('navigator.share')[0]), 'sin await previo: conserva el gesto del usuario');
  const copy = fnBody('copyGenericInviteMessage');
  assert.match(copy, /navigator\.clipboard\.writeText\(message\)/);
  assert.match(copy, /Mensaje copiado\. Pegalo en WhatsApp\./);
  assert.match(copy, /Copiá el mensaje y pegalo en WhatsApp\./, 'copia manual si el portapapeles falla');
});

test('Invitación genérica: sin tokens, tablas, RPC ni seguimiento; el circuito de invitación personal queda intacto', () => {
  const block = appJs.slice(appJs.indexOf('V04.39 · Ronda 1 — INVITACIÓN GENÉRICA'), appJs.indexOf('/** §4/§5 — abre BUSCAR JUGADORES'));
  assert.ok(block.length > 500);
  assert.doesNotMatch(block, /Auth\.|\.rpc\(|createClaimLink|createInviteUrl|Store\.|localStorage|fetch\(/);
  for (const k of ['async function createInviteUrl(', 'async function copyInviteLink()', 'function handlePendingInvitation(', 'const INVITE_LINK_ERROR_TEXT']) assert.ok(appJs.includes(k), k);
  assert.match(html, /id="invite-sheet-copy-btn"[^>]*>COPIAR INVITACIÓN</);
});

// ---------------------------------------------------------------- 3. Ayuda
test('Ayuda: se llega desde Configuración, vuelve a Configuración y no tiene bottom nav', () => {
  assert.match(section('view-settings'), /id="settings-help-row"[^>]*><span class="settings-row__label">Preguntas frecuentes</);
  assert.match(appJs, /\$\('#settings-help-row'\)\.addEventListener\('click', \(\) => showView\('help'\)\)/);
  assert.match(appJs, /\$\('#help-back-btn'\)\.addEventListener\('click', openSettings\)/);
  assert.match(appJs, /'legal-doc', 'help',/, 'registrada en showView');
  const nav = appJs.match(/const BOTTOM_NAV_VIEWS = \[([^\]]*)\]/)[1];
  assert.ok(!nav.includes("'help'"));
  assert.match(css, /#view-help, #view-legal-doc\{\s*height:100vh/);
  assert.match(css, /#view-help \.access-scroll\{/);
});

test('Ayuda: 5 preguntas pedidas, textos con las reglas vigentes y sin tutorial/carrusel', () => {
  const v = section('view-help');
  const qs = [...v.matchAll(/<summary class="help-faq__q"><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(qs, ['¿Qué es BRAMU?', '¿Cómo cargo un partido ya jugado?', '¿Qué es el Nivel BRAMU?', '¿Qué es el Ranking BRAMU?', '¿Cómo funcionan los Grupos?']);
  // reglas: carga retroactiva 14 d, validación de UN rival, 30 d; Nivel 1,0–10,0 y calibración 5 partidos/3 rivales; Ranking semanal (lunes);
  // Grupos 3 de 4, 2 mejores partidos, Race anual, sin tocar Nivel/Ranking.
  for (const frag of ['hasta 14 días atrás', 'uno de los dos rivales', '30 días', '1,0 a 10,0', '5 partidos validados contra al menos 3 rivales distintos',
    'Cada lunes se publica', 'Nivel calibrado', '3 de los 4 jugadores', '2 mejores partidos', 'Race anual', 'no modifican tu Nivel ni tu Ranking']) assert.ok(v.includes(frag), frag);
  assert.doesNotMatch(v, /<script|carousel|carrusel|tutorial|siguiente/i);
  assert.doesNotMatch(v, /puntos propios|Ranking BRAMU tiene puntos/);
});

// ---------------------------------------------------------------- límites de la ronda
test('Límites: nada de descubrimiento social, landing ni RPC nuevas en esta ronda', () => {
  for (const k of ['Gente que quizás conozcas', 'Jugadores de tu zona', 'discover_players', 'suggest_players']) {
    assert.ok(!html.includes(k) && !appJs.includes(k), k);
  }
});
