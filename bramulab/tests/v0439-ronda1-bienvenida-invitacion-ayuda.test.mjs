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
  assert.match(v, /<h1 class="welcome-claim">Donde vive tu pádel\.<\/h1>/);
  assert.doesNotMatch(v, /welcome-claim__accent/, 'h5: sin verde en «pádel» (no compite con «lab»)');
  for (const t of ['Cargá tus partidos', 'Competí con tus amigos', 'Construí tu Nivel BRAMU']) assert.ok(v.includes(`>${t}<`), t);
  // h4: logo + claim = una unidad; sin píldora ni bajada repetida; una línea de apoyo por tarjeta con acentos de ícono variados
  assert.doesNotMatch(v, /PÁDEL AMATEUR|welcome-pill|welcome-sub|welcome-intro/);
  assert.doesNotMatch(v, /Cargá tus partidos\. Competí con tus amigos/);
  assert.match(v, /<div class="welcome-brand">\s*<img class="access-logo" src="icons\/logo\.svg" alt="BRAMUlab" \/>\s*<h1 class="welcome-claim">/);
  for (const t of ['Guardá tus resultados y construí tu historial.', 'Compará partidos, rivales y grupos de forma simple.', 'Tu nivel evoluciona a medida que jugás.']) assert.ok(v.includes(`>${t}<`), t);
  assert.deepEqual([...v.matchAll(/welcome-benefit--(lime|blue|gold)/g)].map((m) => m[1]), ['lime', 'blue', 'gold']);
  const wb = css.slice(css.indexOf('.welcome-benefit{'), css.indexOf('.welcome-benefit__icon{'));
  assert.doesNotMatch(wb, /border-left/, 'sin líneas verticales de color en las tarjetas');
  assert.match(wb, /background: rgba\(4,9,16,\.58\)/, 'h5: tarjetas más oscuras e integradas a la foto');
  assert.ok(v.indexOf('welcome-spacer') < v.indexOf('welcome-brand') && v.indexOf('welcome-spacer--mid') < v.indexOf('access-login-btn') && v.indexOf('welcome-benefits') < v.indexOf('welcome-spacer--mid'), 'aire arriba, bloque central, aire que deja ver la cancha, botones al pie');
  const claimCss = css.match(/\.welcome-claim\{[^}]*font-size: ([\d.]+)px/);
  assert.ok(claimCss && Number(claimCss[1]) <= 16, 'el claim es una bajada de marca chica');
  assert.match(v, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>/);
  assert.match(v, /<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
  assert.match(css, /#view-access \.access-actions \.btn-secondary\{[^}]*rgba\(5,10,18/, 'CREAR CUENTA más discreto');
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

test('Bienvenida: foto vertical en móvil y foto horizontal propia en pantallas anchas (sin estirar)', () => {
  assert.match(css, /--welcome-hero-image-desktop: url\('assets\/bienvenida-hero-desktop\.jpg\?v=[\d.]+-h\d+'\)/);
  assert.match(css, /@media \(min-aspect-ratio: 1\/1\)\{\s*#view-access\{ --welcome-hero-image: var\(--welcome-hero-image-desktop\)/);
  assert.match(css, /@media \(min-aspect-ratio: 1\/1\)\{[\s\S]*?radial-gradient/, 'viñeta detrás de la columna central');
  assert.match(sw, /\.\/assets\/bienvenida-hero-desktop\.jpg\?v=/);
  assert.ok(fs.statSync(path.join(root, 'assets/bienvenida-hero-desktop.jpg')).size > 50000);
  const jpgSize = (f) => { const b = fs.readFileSync(path.join(root, f)); let i = 2; while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); } };
  const mob = jpgSize('assets/bienvenida-hero.jpg'), desk = jpgSize('assets/bienvenida-hero-desktop.jpg');
  assert.ok(mob.h > mob.w, 'la de móvil es vertical');
  assert.ok(desk.w > desk.h, 'la de escritorio es horizontal');
});

test('Bienvenida: móviles chicos entran y se pueden desplazar (scroller propio + compactación en pantallas bajas)', () => {
  assert.match(css, /#view-access \.access-scroll, #view-legal-gate \.access-scroll[^{]*\{[^}]*overflow-y:auto/);
  assert.match(css, /@media \(max-height: 640px\)\{[\s\S]*?\.welcome-brand/);
  assert.match(css, /@media \(max-width: 340px\)/);
  assert.match(css, /#view-access \.access-scroll::before, #view-access \.access-scroll::after\{ flex:0 0 0; \}/);
  assert.match(css, /\.welcome-spacer--mid\{[^}]*min-height: 18px/);
});

// ---------------------------------------------------------------- 2. Invitación genérica
test('Invitación genérica: vive en BUSCAR JUGADORES, con el copy pedido, y es distinta de la invitación personal', () => {
  const v = section('view-player-search');
  assert.match(v, /id="player-search-invite"[^>]*hidden/, 'oculta por defecto');
  assert.match(v, /¿NO LO ENCONTRASTE\?/);
  assert.match(v, /Invitalo a BRAMUlab para que también pueda registrar sus partidos y compartir esta experiencia con vos\./);
  assert.match(v, /id="player-search-invite-btn"[^>]*>COMPARTIR INVITACIÓN</);
  assert.match(v, /id="player-search-invite-copy-btn"[^>]*>Copiar mensaje</);
  assert.doesNotMatch(v, /NO ESTÁ EN BRAMU|INVITAR A BRAMU/);
  assert.doesNotMatch(v.replace(/<!--[\s\S]*?-->/g, '').replace(/invite-sheet__feedback/g, ''), /invite-sheet|claim/i, 'no reutiliza el circuito de invitación personal (solo el estilo del feedback)');
});

test('Invitación genérica: mensaje humano con el enlace general y sin token ni datos personales', () => {
  const m = appJs.match(/const GENERIC_INVITE_URL = '([^']+)';/);
  assert.equal(m && m[1], 'https://app.bramulab.com');
  const msg = new Function(`const GENERIC_INVITE_URL=${JSON.stringify(m[1])}; return (function(){${fnBody('buildGenericInviteMessage')}})();`)();
  assert.ok(msg.includes('https://app.bramulab.com'));
  const approved = [
    'Che, ¿te sumás a BRAMUlab? 🎾',
    '',
    'Estoy usando esta app para ir guardando los partidos de pádel que jugamos. Nos queda todo el historial, cada uno va construyendo su Nivel BRAMU y también podemos competir en grupos entre amigos.',
    '',
    'Te paso el link para que te hagas tu cuenta:',
    'https://app.bramulab.com',
    '',
    'Y si querés dejarla instalada en el celu, es fácil:',
    '📱 iPhone: abrí el link en Safari, tocá Compartir y elegí Agregar a Inicio.',
    '📱 Android: abrilo en Chrome, tocá el menú ⋮ y elegí Instalar app (o Agregar a la pantalla principal).',
  ].join('\n');
  assert.equal(msg, approved, 'el mensaje compartido es EXACTAMENTE el aprobado');
  assert.doesNotMatch(msg, /token|claim|\?claim=/i);
  // instrucciones = las de la guía real de instalación de la app (Compartir → «Agregar a Inicio»)
  assert.ok(html.includes('Elegí “Agregar a Inicio”') && html.includes('Tocá Compartir'), 'la guía de instalación real usa esos mismos pasos');
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
test('Ayuda: se abre con el «?» del header del Home, vuelve al Home, no está duplicada en Configuración y no tiene bottom nav', () => {
  const home = section('view-player-home');
  assert.match(home, /id="player-home-help-btn"[^>]*aria-label="Ayuda y preguntas frecuentes"[^>]*>\s*<span class="ranking-help-icon-btn__circle" aria-hidden="true">\?<\/span>/);
  assert.ok(home.indexOf('player-home-help-btn') < home.indexOf('player-home-ranking-btn') && home.indexOf('player-home-ranking-btn') < home.indexOf('player-home-bell-btn'), 'h5: orden Ayuda → Ranking → Notificaciones');
  assert.match(appJs, /\$\('#player-home-help-btn'\)\.addEventListener\('click', openHelpScreen\)/);
  assert.match(appJs, /\$\('#help-back-btn'\)\.addEventListener\('click', \(\) => openPlayerHome\(\)\)/);
  assert.match(fnBody('openHelpScreen'), /showView\('help'\)/);
  assert.match(fnBody('openHelpScreen'), /getCurrentUser\(\)/, 'mismo gate de sesión');
  assert.doesNotMatch(section('view-settings'), /help|Preguntas frecuentes|AYUDA/, 'sin acceso duplicado en Configuración');
  assert.doesNotMatch(appJs, /settings-help-row/);
  assert.match(appJs, /'legal-doc', 'help',/, 'registrada en showView');
  const nav = appJs.match(/const BOTTOM_NAV_VIEWS = \[([^\]]*)\]/)[1];
  assert.ok(!nav.includes("'help'"));
  assert.match(css, /#view-help, #view-legal-doc\{\s*height:100vh/);
  assert.match(css, /#view-help \.access-scroll\{/);
  assert.match(css, /\.player-home-help\{[^}]*min-width:40px; min-height:40px/);
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
