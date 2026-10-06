// BRAMUlab V04.36 — identidad visual final: masters SVG aprobados, derivados coherentes, limpieza de la identidad anterior.
// Fuente: docs/BRAMUlab/Identidad_Visual.md. Ejecutar con: node --test bramulab/v0436-identidad-visual.test.mjs
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDist } from './scripts/build-dist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const MARCA = path.join(REPO, 'docs', 'BRAMUlab', 'Marca');
const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);

/** Decodificador mínimo de PNG 8 bits (RGB/RGBA, sin entrelazado): lo justo para verificar píxeles de los derivados. */
function decodePng(file) {
  const b = fs.readFileSync(file);
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${file} es PNG`);
  const w = b.readUInt32BE(16); const h = b.readUInt32BE(20); const depth = b[24]; const ct = b[25];
  assert.equal(depth, 8); assert.ok(ct === 2 || ct === 6, `color type ${ct}`); assert.equal(b[28], 0, 'sin entrelazado');
  const bpp = ct === 6 ? 4 : 3; const idat = [];
  for (let o = 8; o < b.length;) { const len = b.readUInt32BE(o); const type = b.toString('latin1', o + 4, o + 8); if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * bpp; const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0; const up = y > 0 ? out[(y - 1) * stride + x] : 0; const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c; const pa = Math.abs(p - a); const pb = Math.abs(p - up); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : (pb <= pc ? up : c); }
      out[y * stride + x] = v & 255;
    }
  }
  const px = (x, y) => { const i = y * stride + x * bpp; return { r: out[i], g: out[i + 1], b: out[i + 2], a: bpp === 4 ? out[i + 3] : 255 }; };
  return { w, h, ct, px };
}

/* ======================= Masters ======================= */

test('V0436-1) los 3 SVG maestros están en docs/BRAMUlab/Marca/, sin metadata de Adobe/C2PA, y su contenido está fijado por hash', () => {
  const pinned = {
    'BRAMUlab-Logo.svg': 'c2ff7a3247e169f2c7caa5c78f8685bc7b8c20b69ec2373142b2bd84acb95357',
    'BRAMUlab-Isotipo.svg': '78a9117b58223da322b8b56f2a8a840c2ff776744ec046de8543ae3980c5ddec',
    'BRAMUlab-IconoApp.svg': '1c923bab725243e57b08806d17bf76d7cac6ec7c865b6bf736e587f3e00ec1c8',
  };
  for (const [f, h] of Object.entries(pinned)) {
    const file = path.join(MARCA, f);
    assert.ok(fs.existsSync(file), f);
    assert.equal(sha(file), h, `${f}: un master solo cambia con una decisión explícita de marca (actualizar este hash a propósito)`);
    const svg = fs.readFileSync(file, 'utf8');
    assert.ok(!/<metadata|xpacket|xmpmeta|c2pa|cai-manifests/i.test(svg), `${f}: sin metadata`);
    assert.match(svg, /viewBox="0 0 1080 (1080|250)"/);
  }
  assert.match(fs.readFileSync(path.join(MARCA, 'BRAMUlab-Logo.svg'), 'utf8'), /fill: #95ff19/); // lima aprobado, sin variantes heredadas
  assert.ok(fs.existsSync(path.join(MARCA, 'generar-derivados.html')) && fs.existsSync(path.join(MARCA, 'README.md')));
});

test('V0436-2) logo.svg de la app = master con solo viewBox/tamaño recortados (ningún path, color ni filtro cambia)', () => {
  const master = fs.readFileSync(path.join(MARCA, 'BRAMUlab-Logo.svg'), 'utf8');
  const app = read('icons/logo.svg');
  const norm = (t) => t.replace(/viewBox="[^"]*"( width="\d+" height="\d+")?/, 'VB');
  assert.equal(norm(app), norm(master));
  const vb = app.match(/viewBox="([\d. ]+)" width="(\d+)" height="(\d+)"/);
  assert.ok(vb, 'viewBox + tamaño intrínseco');
  const [x, y, w, h] = vb[1].split(' ').map(Number);
  assert.ok(Math.abs(w / h - 915 / 139) < 0.02, `proporción histórica del logo (${(w / h).toFixed(3)})`);
  assert.ok(x < 65 && y < 57.3 && x + w > 1015 && y + h > 192.7, 'el recorte contiene todo el trazo (65,57.3)–(1015,192.7)');
});

/* ======================= Derivados PWA / emails ======================= */

test('V0436-3) iconos PWA: tamaños exactos, OPACOS, fondo azul noche BRAMU y la B lima en el centro; favicon y maskable coherentes', () => {
  const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'icon-512-maskable.png': 512, 'apple-touch-icon.png': 180, 'favicon-64.png': 64 };
  for (const [f, n] of Object.entries(sizes)) {
    const img = decodePng(path.join(__dirname, 'icons', f));
    assert.deepEqual([img.w, img.h], [n, n], f);
    for (const [x, y] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1], [n >> 1, 1], [1, n >> 1], [n >> 1, n >> 1]]) assert.equal(img.px(x, y).a, 255, `${f}: opaco en (${x},${y})`);
    const corner = img.px(2, 2);
    assert.ok(corner.r < 30 && corner.g < 40 && corner.b < 60 && corner.b > corner.r, `${f}: esquina azul noche (${corner.r},${corner.g},${corner.b})`);
  }
  // La B lima (#95FF19) está presente en cada derivado (más grande en el favicon recortado que en el lienzo completo).
  const limeRatio = (f) => { const img = decodePng(path.join(__dirname, 'icons', f)); let k = 0; for (let y = 0; y < img.h; y += 1) for (let x = 0; x < img.w; x += 1) { const p = img.px(x, y); if (p.g > 220 && p.r > 120 && p.r < 175 && p.b < 60) k += 1; } return k / (img.w * img.h); };
  const full = limeRatio('icon-512.png'); const mask = limeRatio('icon-512-maskable.png'); const fav = limeRatio('favicon-64.png');
  assert.ok(full > 0.12 && full < 0.35, `B lima en el icono (${full.toFixed(3)})`);
  assert.ok(mask < full * 0.8, 'el maskable reduce la B (safe area 80 %)');
  assert.ok(fav > full, 'el favicon recorta cerca de la B');
  // Idéntico al icono 512 salvo escala: 192 y 180 conservan la misma proporción de lima.
  assert.ok(Math.abs(limeRatio('icon-192.png') - full) < 0.02 && Math.abs(limeRatio('apple-touch-icon.png') - full) < 0.02);
});

test('V0436-4) logo.png (derivado SOLO para emails) corresponde al logo NUEVO: transparente, blanco + lima, proporción histórica; sigue en /icons/logo.png', () => {
  const img = decodePng(path.join(__dirname, 'icons', 'logo.png'));
  assert.equal(img.ct, 6);
  assert.ok(Math.abs(img.w / img.h - 915 / 139) < 0.02, `proporción ${(img.w / img.h).toFixed(3)}: el email fija height 30 + max-width 200 y no se deforma`);
  assert.equal(img.px(0, 0).a, 0, 'fondo transparente');
  let white = 0; let lime = 0;
  for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w; x += 2) { const p = img.px(x, y); if (p.a > 250 && p.r > 240 && p.g > 240 && p.b > 240) white += 1; if (p.a > 250 && p.g > 240 && p.r > 130 && p.r < 170 && p.b < 40) lime += 1; }
  assert.ok(white > 2000 && lime > 400, `BRAMU blanco (${white}) + lab lima (${lime})`);
  // La mancha lima está en la mitad DERECHA ("lab") y el blanco domina la izquierda ("BRAMU").
  let limeLeft = 0; for (let y = 0; y < img.h; y += 2) for (let x = 0; x < img.w / 2; x += 2) { const p = img.px(x, y); if (p.a > 250 && p.g > 240 && p.b < 40) limeLeft += 1; }
  assert.ok(limeLeft < lime * 0.05);
  assert.equal(JSON.parse(fs.readFileSync(path.join(REPO, 'supabase/email-templates/manifest.json'), 'utf8')).native.length, 4);
});

/* ======================= Superficies de la app ======================= */

test('V0436-5) logo nuevo (SVG) en splash, acceso, headers y footer; ningún <img> usa ya el PNG; manifest/SW/apple-touch/favicon coherentes', () => {
  const html = read('index.html');
  const imgs = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((s) => /^icons\//.test(s));
  assert.ok(imgs.length >= 13, `logos en la app (${imgs.length})`);
  assert.deepEqual([...new Set(imgs)], ['icons/logo.svg']);
  assert.match(html, /<div id="app-splash"[^>]*>\s*<img class="app-splash__logo" src="icons\/logo\.svg"/);
  for (const cls of ['access-logo', 'brand-logo brand-logo--access', 'brand-logo brand-logo--header', 'brand-logo brand-logo--footer']) assert.ok(html.includes(`class="${cls}" src="icons/logo.svg"`) || html.includes(`id="player-home-logo" class="${cls}" src="icons/logo.svg"`), cls);
  const sw = read('sw.js');
  const block = sw.slice(sw.indexOf('CORE_ASSETS = ['), sw.indexOf('];', sw.indexOf('CORE_ASSETS = [')));
  assert.match(block, /'\.\/icons\/logo\.svg\?v=04\.36-h1'/);
  assert.doesNotMatch(block, /logo\.png|splash-b/);
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.deepEqual(m.icons.map((i) => [i.src.split('?')[0], i.sizes, i.purpose]), [['icons/icon-192.png', '192x192', 'any'], ['icons/icon-512.png', '512x512', 'any'], ['icons/icon-512-maskable.png', '512x512', 'maskable']]);
  assert.equal(m.background_color, '#050A12'); assert.equal(m.theme_color, '#050A12');
  const ati = html.match(/rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
  assert.ok(ati && Buffer.from(ati[1], 'base64').equals(fs.readFileSync(path.join(__dirname, 'icons', 'apple-touch-icon.png'))), 'apple-touch incrustado == archivo nuevo');
  assert.match(html, /rel="icon" href="icons\/favicon-64\.png\?v=04\.36-h1"/);
  assert.deepEqual(JSON.parse(read('version.json')), { version: 'BRAMUlab V04.36', bundle: '04.36-h1' });
  assert.match(read('store.js'), /APP_VERSION = 'BRAMUlab V04\.36'/); assert.match(read('store.js'), /BUNDLE_VERSION = '04\.36-h1'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-36-h1'/);
});

test('V0436-6) el logo SVG se dimensiona por altura/ancho en cada superficie (CSS existente) y el splash sigue protagonista', () => {
  const css = read('styles.css');
  assert.match(css, /\.app-splash__logo\{ width: 260px; height: auto; opacity: 1; \}/);
  assert.match(css, /\.brand-logo--header\{ height: 24px; width: auto; \}/);
  assert.match(css, /\.brand-logo--footer\{ height: 18px; width: auto;/);
  assert.match(css, /\.brand-logo--access\{ height: 30px; width: auto;/);
  assert.match(css, /\.access-logo\{ width: 240px; height:auto;/);
  assert.match(css, /--brand-lime: #95FF19;/); assert.match(css, /--bg: #050A12;/); assert.match(css, /--accent-cyan: #199FFF;/); assert.match(css, /--text: #F8FAFC;/);
});

/* ======================= Limpieza de la identidad anterior ======================= */

test('V0436-7) la identidad vieja se retiró: sin docs/identidad-visual, sin PNG históricos, sin generador viejo, sin Premier Padel, sin splash-b', () => {
  assert.ok(!fs.existsSync(path.join(REPO, 'docs', 'identidad-visual')));
  assert.ok(!fs.existsSync(path.join(__dirname, 'icons', 'splash-b.png')));
  const bad = tracked.filter((f) => fs.existsSync(path.join(REPO, f)) && (/identidad-visual\//.test(f) || /generar-iconos-pwa/.test(f) || /icono2?\.png$/i.test(f) || /Sistema Grafico/i.test(f) || /premier/i.test(f) && /\.(png|jpe?g)$/i.test(f)));
  assert.deepEqual(bad, []);
  assert.deepEqual(fs.readdirSync(path.join(__dirname, 'icons')).sort(), ['apple-touch-icon.png', 'favicon-64.png', 'icon-192.png', 'icon-512-maskable.png', 'icon-512.png', 'logo.png', 'logo.svg', 'padel-court-example.svg']);
});

test('V0436-8) sin referencias ACTIVAS a assets viejos: ni en el artefacto publicado (dist) ni en el código/tooling del repo', () => {
  const old = new RegExp(['splash-b', 'icono2', 'identidad-' + 'visual', 'BRAMULab icono', 'BRAMULab Logo', 'BRAMULab Sistema', 'generar-iconos-pwa', 'referencias-' + 'premier'].join('|'));
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-v0436-'));
  try {
    const r = buildDist({ srcDir: __dirname, outDir: path.join(t, 'dist'), requireGenerated: false });
    assert.deepEqual(r.problems, []);
    const hits = r.files.filter((f) => !/\.(png|jpe?g)$/i.test(f) && old.test(fs.readFileSync(path.join(t, 'dist', f), 'utf8')));
    assert.deepEqual(hits, [], 'dist sin referencias a assets viejos');
    assert.ok(r.files.includes('icons/logo.svg') && r.files.includes('icons/logo.png') && r.files.includes('icons/padel-court-example.svg'));
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  const self = path.basename(fileURLToPath(import.meta.url));
  const offenders = tracked.filter((f) => fs.existsSync(path.join(REPO, f)) && /^(bramulab|supabase|\.claude)\//.test(f) && !/\.(png|jpe?g|ai|ico)$/i.test(f) && !f.endsWith(self) && !/h2-hardening|build-dist|v0417-cierre-final/.test(f)
    && old.test(fs.readFileSync(path.join(REPO, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*|<!--)/.test(l)).join('\n')));
  assert.deepEqual(offenders, []);
  assert.ok(!/identidad-visual/.test(fs.readFileSync(path.join(REPO, 'INDICE.md'), 'utf8')));
});

test('V0436-9) bramulab/icons/padel-court-example.svg no se tocó y sigue publicado y precacheado', () => {
  assert.equal(sha(path.join(__dirname, 'icons', 'padel-court-example.svg')), 'b832bd7a58de401c53008b29d6995198cd9450508c89670ecfee065c794a380b');
  assert.match(read('sw.js'), /'\.\/icons\/padel-court-example\.svg'/);
  assert.match(read('app.js'), /photoUrl: 'icons\/padel-court-example\.svg'/);
});

test('V0436-10) hardening 139 no retrocede: dist sigue siendo la salida, el motor de Nivel sigue fuera del navegador y supabase-js sigue fijado con SRI', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.equal(v.outputDirectory, 'dist'); assert.match(v.buildCommand, /build-env\.mjs && node scripts\/build-dist\.mjs/);
  const html = read('index.html');
  assert.doesNotMatch(html, /<script src="(level|level-context|match-level-engine)\.js/);
  assert.match(html, /<script src="level-public\.js\?v=04\.36-h1"><\/script>/);
  assert.match(html, /supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js" integrity="sha384-[A-Za-z0-9+/]{64}" crossorigin="anonymous"/);
  assert.equal(execFileSync('git', ['ls-files', 'bramulab/dist'], { cwd: REPO, encoding: 'utf8' }).trim(), '');
});
