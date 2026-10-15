// BRAMUlab — V04.49: composición final de la bienvenida con invitación + vista previa de WhatsApp de la app (misma imagen que la web).
// Ejecutar con: node --test bramulab/tests/v0449-bienvenida-invitado-og.test.mjs

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
const webHtml = fs.readFileSync(path.join(repo, 'bramulab-web', 'public', 'index.html'), 'utf8');

function fnBody(name) {
  const a = appJs.indexOf(`function ${name}(`); assert.ok(a >= 0, `function ${name}`);
  let depth = 0; let started = false;
  for (let i = a; i < appJs.length; i += 1) {
    if (appJs[i] === '{') { depth += 1; started = true; } else if (appJs[i] === '}') { depth -= 1; if (started && depth === 0) return appJs.slice(a, i + 1); }
  }
  throw new Error(`cuerpo de ${name}`);
}
const meta = (html, attr, key) => { const m = html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`)); return m && m[1]; };
const access = indexHtml.slice(indexHtml.indexOf('id="view-access"'), indexHtml.indexOf('</section>', indexHtml.indexOf('id="view-access"')));

/* ============================ Bienvenida con invitación ============================ */
test('orden del recorrido: logo+claim → titular+bajada → tarjeta → CREAR CUENTA → INICIAR SESIÓN → «¿Ya tenés BRAMUlab instalada?» (un solo botón, fuera de la tarjeta)', () => {
  const at = (s) => { const i = access.indexOf(s); assert.ok(i >= 0, s); return i; };
  const order = [at('class="access-logo"'), at('Donde vive tu pádel.'), at('id="access-invited-intro"'), at('id="access-invitation-card"'), at('id="access-login-btn"'), at('id="access-signup-btn"'), at('id="access-installed-btn"')];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const card = access.slice(access.indexOf('id="access-invitation-card"'), access.indexOf('id="access-backend-unavailable"'));
  assert.doesNotMatch(card, /access-installed-btn|instalada/, 'el enlace salió de la tarjeta');
  assert.equal([...indexHtml.matchAll(/id="access-installed-btn"/g)].length, 1, 'sin controles duplicados');
  assert.match(access, /<button type="button" id="access-installed-btn" class="access-installed-link" hidden>¿Ya tenés BRAMUlab instalada\?<\/button>/);
  assert.equal([...appJs.matchAll(/'#access-installed-btn'\)\.addEventListener/g)].length, 1, 'un solo handler');
  assert.match(fnBody('initInvitationImport'), /'#access-installed-btn'\)\.addEventListener\('click', openInviteInstalledSheet\)/, 'mismo comportamiento: abre la demostración + copiar');
});

test('enlace de «instalada»: solo con invitación pendiente, en el navegador y con el enlace no «no disponible»', () => {
  const body = fnBody('applyInvitationCardState');
  assert.match(body, /installed\.hidden = unavailable \|\| isStandaloneApp\(\) \|\| !\(Store\.loadClaimToken && Store\.loadClaimToken\(\)\)/);
  assert.match(fnBody('renderAccessInvitationCard'), /if \(invited\) refreshInvitationAvailability\(token\); else applyInvitationCardState\('unknown'\)/);
  assert.match(css, /\.access-installed-link\[hidden\]\{ display:none; \}/, 'el atributo hidden gana sobre display:flex');
});

test('titular con jerarquía intermedia y bajada SIEMPRE visible (sin la regla que la ocultaba en pantallas bajas)', () => {
  assert.match(access, /<p class="welcome-invited-intro__title">Tus partidos no terminan cuando salís de la cancha\.<\/p>\s*<p class="welcome-invited-intro__sub">Cargá tus resultados, descubrí tus estadísticas y competí con tus amigos\.<\/p>/);
  assert.doesNotMatch(css, /welcome-invited-intro__sub\{\s*display:\s*none/, 'se eliminó la ocultación de V04.48');
  assert.doesNotMatch(css, /max-height: ?700px\)\{[^}]*welcome-invited-intro/, 'ninguna regla de pantalla baja toca la bajada');
  const title = css.match(/\.welcome-invited-intro__title\{[^}]*font-size: clamp\((\d+)px, ([\d.]+)vw, (\d+)px\)/);
  assert.ok(title, 'tamaño fluido');
  assert.ok(Number(title[1]) >= 20 && Number(title[3]) <= 28, 'intermedio: bastante más que un subtítulo (≥20 px) y mucho menos que el hero de la web (36–72 px)');
  assert.match(css, /\.welcome-invited-intro__title\{[^}]*font-weight:800[^}]*line-height:1\.18/);
  const subPx = Number(css.match(/\.welcome-invited-intro__sub\{[^}]*font-size: ([\d.]+)px/)[1]);
  assert.ok(subPx >= 14, `la bajada no se achica de más (${subPx} px)`);
  assert.match(css, /\.welcome-invited-intro__sub\{[^}]*line-height:1\.45/);
});

test('distribución vertical: sin separador flexible entre la tarjeta y los botones; aire arriba/abajo; scroll natural; bienvenida habitual intacta', () => {
  assert.match(css, /#view-access\.is-invited \.welcome-spacer--mid\{ flex: 0 0 22px; min-height: 0; \}/);
  assert.match(css, /#view-access\.is-invited \.welcome-spacer\{ flex: 1 1 0; min-height: 12px; \}/);
  assert.match(css, /#view-access\.is-invited \.access-scroll::after\{ flex: \.6 1 0;/);
  // TODO lo nuevo está acotado a .is-invited (o al bloque de invitación): la bienvenida habitual no cambia
  const start = css.indexOf('/* Bienvenida con invitación (V04.49');
  const block = css.slice(start);
  for (const rule of block.split('\n').filter((l) => /^#view-access\./.test(l))) assert.match(rule, /#view-access\.is-invited/, rule.slice(0, 60));
  assert.match(css, /#view-access \.access-scroll, #view-legal-gate \.access-scroll[\s\S]*?\{\s*flex:1 1 auto; min-height:0; overflow-y:auto;/, 'el contenedor scrollea si no entra');
  assert.match(access, /<ul class="welcome-benefits"/, 'las 3 tarjetas siguen en el HTML');
  assert.match(access, /<button type="button" id="access-login-btn" class="btn-start">INICIAR SESIÓN<\/button>\s*<button type="button" id="access-signup-btn" class="btn-secondary">CREAR CUENTA<\/button>/);
});

test('flujo de invitaciones intacto: el token solo se lee; el único reclamo sigue siendo «SÍ, ESE SOY YO»', () => {
  for (const name of ['renderAccessInvitationCard', 'applyInvitationCardState']) assert.doesNotMatch(fnBody(name), /claimProvisionalPlayer|clearClaimToken|saveClaimToken/, name);
  assert.equal([...appJs.matchAll(/Auth\.claimProvisionalPlayer\(/g)].length, 1);
});

/* ============================ Vista previa de WhatsApp (OG) ============================ */
test('OG de la app: MISMA imagen pública de la web (URL absoluta, sin duplicar el archivo), en el HTML inicial (antes de cualquier script)', () => {
  const webImg = meta(webHtml, 'property', 'og:image');
  assert.equal(webImg, 'https://bramulab.com/assets/social/og-bramulab.jpg');
  assert.equal(meta(indexHtml, 'property', 'og:image'), webImg, 'la app reutiliza exactamente la URL de la web');
  assert.equal(meta(indexHtml, 'name', 'twitter:image'), webImg);
  assert.equal(meta(indexHtml, 'property', 'og:image:type'), 'image/jpeg');
  assert.equal(meta(indexHtml, 'property', 'og:image:width'), meta(webHtml, 'property', 'og:image:width'));
  assert.equal(meta(indexHtml, 'property', 'og:image:height'), meta(webHtml, 'property', 'og:image:height'));
  assert.equal(meta(indexHtml, 'property', 'og:image:width'), '1200'); assert.equal(meta(indexHtml, 'property', 'og:image:height'), '630');
  assert.equal(meta(indexHtml, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(meta(indexHtml, 'property', 'og:title'), 'BRAMUlab · Donde vive tu pádel');
  assert.equal(meta(indexHtml, 'property', 'og:site_name'), 'BRAMUlab');
  assert.ok(meta(indexHtml, 'property', 'og:description').length > 40 && meta(indexHtml, 'name', 'description'));
  assert.ok(meta(indexHtml, 'property', 'og:image:alt'));
  // en el HTML inicial: dentro de <head>, antes del primer <script> y de cualquier JS
  const head = indexHtml.slice(0, indexHtml.indexOf('</head>'));
  assert.ok(head.includes('og:image') && head.includes('twitter:image'));
  assert.ok(indexHtml.indexOf('og:image') < indexHtml.indexOf('<script'), 'no depende de JavaScript');
  assert.equal(fs.existsSync(path.join(root, 'assets', 'social')), false, 'no se duplica la imagen en la app');
  assert.equal(fs.readdirSync(path.join(root, 'assets')).filter((f) => /og-bramulab/.test(f)).length, 0);
});

test('OG de la app: declara SU propia URL (app.bramulab.com), distinta de la web; sin confundir los dos orígenes', () => {
  assert.equal(meta(indexHtml, 'property', 'og:url'), 'https://app.bramulab.com/');
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/app\.bramulab\.com\/" \/>/);
  assert.equal(meta(webHtml, 'property', 'og:url'), 'https://bramulab.com/', 'la web conserva la suya');
  assert.notEqual(meta(indexHtml, 'property', 'og:url'), meta(webHtml, 'property', 'og:url'));
  assert.equal([...indexHtml.matchAll(/<meta property="og:url"/g)].length, 1);
});

test('invitaciones personales intactas: el servicio bramulab-invite no cambió y sus metadatos dinámicos siguen siendo suyos', () => {
  const diff = execFileSync('git', ['diff', '--name-only', '17af0db', '--', 'bramulab-invite'], { cwd: repo, encoding: 'utf8' }).trim();
  assert.equal(diff, '', 'bramulab-invite sin cambios desde la web aprobada');
  assert.match(fs.readFileSync(path.join(repo, 'bramulab-invite', 'api', 'invitacion.js'), 'utf8'), /og:image/);
  assert.match(read('vercel.json'), /"source": "\/invitacion\/:token"/, 'la ruta de invitación de la app sigue redirigiendo a la captura');
  assert.match(read('sw.js'), /pathname\.indexOf\('\/invitacion\/'\) === 0/);
});

test('el build real (dist en carpeta temporal) publica las etiquetas OG intactas en el HTML inicial', async () => {
  const os = await import('node:os');
  const { buildDist } = await import(path.join(root, 'scripts', 'build-dist.mjs'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-og-'));
  try {
    buildDist({ srcDir: root, outDir: path.join(out, 'dist'), requireGenerated: false });
    const html = fs.readFileSync(path.join(out, 'dist', 'index.html'), 'utf8');
    for (const key of ['og:image', 'og:url', 'og:title', 'og:description', 'og:image:width', 'og:image:height', 'og:image:type']) assert.equal(meta(html, 'property', key), meta(indexHtml, 'property', key), key);
    for (const key of ['twitter:card', 'twitter:image', 'twitter:title']) assert.equal(meta(html, 'name', key), meta(indexHtml, 'name', key), key);
    assert.match(html, /<link rel="canonical" href="https:\/\/app\.bramulab\.com\/" \/>/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('versionado V04.49 en cuarteto + referencias ?v= y service worker', () => {
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.49', bundle: '04.49' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.49'/);
  assert.match(read('store.js'), /BUNDLE_VERSION = '04\.49'/);
  assert.match(read('sw.js'), /CACHE_NAME = 'bramulab-v04-49'/);
  assert.doesNotMatch(indexHtml, /\?v=04\.48/);
  assert.doesNotMatch(read('sw.js'), /\?v=04\.48/);
});
