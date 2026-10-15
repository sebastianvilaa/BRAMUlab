// BRAMUlab — V04.49: vista previa de WhatsApp de la app (misma imagen que la web). (La bienvenida compacta de V04.48/V04.49 se DESCARTÓ en V04.50: ver v0450.)
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

test('versionado: V04.49 fue superada por V04.50 (ver v0450); el cuarteto sigue sincronizado', () => {
  const v = JSON.parse(read('version.json'));
  assert.match(v.version, /^BRAMUlab V04\.(49|50)$/);
  assert.ok(read('store.js').includes(`'${v.version}'`) && read('store.js').includes(`'${v.bundle}'`));
  assert.ok(read('sw.js').includes(`bramulab-v${v.bundle.replace('.', '-')}`));
});
