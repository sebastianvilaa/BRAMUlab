// BRAMUlab V04.37-h27 — el icono instalado de Staging es la variante azul ST; Production conserva el icono oficial.
// Regla: el icono lo decide el ENTORNO del bundle (env.generated.js, escrito por build-env.mjs), nunca el commit/rama.
// Ejecutar con: node --test bramulab/tests/icon-staging-h27.test.mjs
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDist, detectIconVariant, STAGING_ICON_FILES, STAGING_ICONS_DIR, DIST_DIRS } from '../scripts/build-dist.mjs';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const REPO = path.resolve(__dirname, '..');
const MARCA = path.join(REPO, 'docs', 'BRAMUlab', 'Identidad_Visual', 'Marca');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const rd = (...p) => fs.readFileSync(path.join(...p));
const walk = (dir) => fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => f.split(path.sep).join('/')).sort();
const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const ATI = /rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-icon-st-'));
const official = buildDist({ srcDir: __dirname, outDir: path.join(tmp, 'dist-official'), requireGenerated: false });
const staging = buildDist({ srcDir: __dirname, outDir: path.join(tmp, 'dist-staging'), requireGenerated: false, iconVariant: 'staging' });
const dOff = path.join(tmp, 'dist-official');
const dSt = path.join(tmp, 'dist-staging');

test('ST-1) masters ST sanitizados en docs/BRAMUlab/Identidad_Visual/Marca (sin metadata, azul #199fff, mismo viewBox) y derivados ST con tamaños exactos', () => {
  for (const f of ['BRAMUlab-IconoApp-ST.svg', 'BRAMUlab-Isotipo-ST.svg']) {
    const svg = fs.readFileSync(path.join(MARCA, f), 'utf8');
    assert.ok(!/<metadata|xpacket|xmpmeta|c2pa|cai-manifests/i.test(svg), `${f}: sin metadata`);
    assert.match(svg, /viewBox="0 0 1080 1080"/);
    assert.match(svg, /fill: #199fff/);
  }
  const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'icon-512-maskable.png': 512, 'apple-touch-icon.png': 180, 'favicon-64.png': 64 };
  assert.deepEqual(fs.readdirSync(path.join(__dirname, STAGING_ICONS_DIR)).sort(), Object.keys(sizes).sort());
  assert.deepEqual([...STAGING_ICON_FILES].sort(), Object.keys(sizes).sort());
  for (const [f, n] of Object.entries(sizes)) assert.deepEqual(pngSize(path.join(__dirname, STAGING_ICONS_DIR, f)), [n, n], f);
  for (const f of STAGING_ICON_FILES) assert.notEqual(sha(rd(__dirname, STAGING_ICONS_DIR, f)), sha(rd(__dirname, 'icons', f)), `${f}: ST != oficial`);
});

test('ST-2) el source oficial NO cambia: icons/ y el apple-touch incrustado siguen siendo el icono oficial; icons-staging no está en la allowlist', () => {
  const html = rd(__dirname, 'index.html').toString('utf8');
  const m = html.match(ATI);
  assert.ok(m && Buffer.from(m[1], 'base64').equals(rd(__dirname, 'icons', 'apple-touch-icon.png')));
  assert.ok(!DIST_DIRS.includes(STAGING_ICONS_DIR));
  assert.ok(!/icons-staging/.test(rd(__dirname, 'manifest.webmanifest', ).toString('utf8') + rd(__dirname, 'sw.js', ).toString('utf8') + html));
});

test('ST-3) build de Production/oficial: iconos, apple-touch y manifest idénticos al source oficial; cero rastro de ST', () => {
  assert.deepEqual(official.problems, []);
  for (const f of STAGING_ICON_FILES) assert.ok(rd(dOff, 'icons', f).equals(rd(__dirname, 'icons', f)), `${f} oficial`);
  const m = rd(dOff, 'index.html').toString('utf8').match(ATI);
  assert.ok(m && Buffer.from(m[1], 'base64').equals(rd(__dirname, 'icons', 'apple-touch-icon.png')));
  assert.equal(rd(dOff, 'manifest.webmanifest').toString('utf8').includes('-st"'), false);
  assert.ok(!official.files.some((f) => f.startsWith(STAGING_ICONS_DIR)), 'dist de Production no incluye icons-staging/');
  const stHashes = new Set(STAGING_ICON_FILES.map((f) => sha(rd(__dirname, STAGING_ICONS_DIR, f))));
  for (const f of official.files) assert.ok(!stHashes.has(sha(rd(dOff, f))), `${f}: no puede ser un archivo ST`);
  const stB64 = rd(__dirname, STAGING_ICONS_DIR, 'apple-touch-icon.png').toString('base64');
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js']) assert.ok(!rd(dOff, f).toString('utf8').includes(stB64.slice(0, 200)), f);
});

test('ST-4) build de Staging: iconos PWA/favicon/apple-touch ST, URLs del manifest marcadas, resto del bundle idéntico al de Production', () => {
  assert.deepEqual(staging.problems, []);
  for (const f of STAGING_ICON_FILES) assert.ok(rd(dSt, 'icons', f).equals(rd(__dirname, STAGING_ICONS_DIR, f)), `${f} ST`);
  const m = rd(dSt, 'index.html').toString('utf8').match(ATI);
  assert.ok(m && Buffer.from(m[1], 'base64').equals(rd(__dirname, STAGING_ICONS_DIR, 'apple-touch-icon.png')));
  const man = JSON.parse(rd(dSt, 'manifest.webmanifest').toString('utf8'));
  assert.equal(man.icons.length, 3);
  for (const ic of man.icons) assert.match(ic.src, /^icons\/[a-z0-9-]+\.png\?v=\d\d\.\d\d-h\d+-st$/);
  // BRAMU Metrics F3: el fixture de QA (datos inventados) viaja SOLO en Staging; todo lo demás es la misma lista de archivos.
  assert.deepEqual(staging.files.filter((f) => f !== 'admin/metrics/qa-fixture.js'), official.files, 'misma lista de archivos');
  assert.ok(staging.files.includes('admin/metrics/qa-fixture.js') && !official.files.includes('admin/metrics/qa-fixture.js'));
  const changed = official.files.filter((f) => !rd(dOff, f).equals(rd(dSt, f)));
  assert.deepEqual(changed, ['icons/apple-touch-icon.png', 'icons/favicon-64.png', 'icons/icon-192.png', 'icons/icon-512-maskable.png', 'icons/icon-512.png', 'index.html', 'manifest.webmanifest']);
  // index.html solo difiere en el base64 del apple-touch-icon
  const norm = (t) => t.replace(ATI, 'ATI');
  assert.equal(norm(rd(dOff, 'index.html').toString('utf8')), norm(rd(dSt, 'index.html').toString('utf8')));
  // el logo/isotipos dentro de la app no cambian
  assert.ok(rd(dSt, 'icons', 'logo.svg').equals(rd(dOff, 'icons', 'logo.svg')) && rd(dSt, 'icons', 'logo.png').equals(rd(dOff, 'icons', 'logo.png')));
});

test('ST-5) bundle sincronizado (h1 vigente) (cache-busting de iconos para instalaciones existentes)', () => {
  const html = rd(__dirname, 'index.html').toString('utf8');
  assert.match(html, /icons\/favicon-64\.png\?v=04\.38-h1/);
  assert.equal(JSON.parse(rd(__dirname, 'version.json', ).toString('utf8')).bundle, '04.38-h1');
  assert.match(rd(__dirname, 'sw.js').toString('utf8'), /bramulab-v04-38-h1/);
});

/* ======================= Selección por ENTORNO (lo que decide Vercel), no por commit ======================= */

const copySrc = (dest) => fs.cpSync(__dirname, dest, { recursive: true, filter: (s) => !/[\\/](dist|node_modules)$/.test(s) && !/env\.generated\.js$|robots\.generated\.txt$/.test(s) });
const envFile = (name) => `window.__BRAMU_ENV__ = Object.freeze({\n  name: ${JSON.stringify(name)},\n  supabaseUrl: "https://x.supabase.co",\n  supabaseAnonKey: "k",\n});\n`;

test('ST-6) detectIconVariant: solo env "staging" elige ST; production, development, ausente o desconocido = oficial', () => {
  const d = fs.mkdtempSync(path.join(tmp, 'det-'));
  assert.equal(detectIconVariant(d), 'official');
  for (const [name, want] of [['staging', 'staging'], ['production', 'official'], ['development', 'official'], ['otro', 'official']]) {
    fs.writeFileSync(path.join(d, 'env.generated.js'), envFile(name));
    assert.equal(detectIconVariant(d), want, name);
  }
});

test('ST-7) mismo commit, dos entornos: el build real (CLI) de Staging lleva ST y el de Production lleva el oficial; Production + ST aborta', () => {
  const run = (name, extraEnv = {}) => {
    const d = fs.mkdtempSync(path.join(tmp, `cli-${name}-`));
    copySrc(d);
    fs.writeFileSync(path.join(d, 'env.generated.js'), envFile(name));
    fs.writeFileSync(path.join(d, 'robots.generated.txt'), 'User-agent: *\n');
    const env = { PATH: process.env.PATH, ...extraEnv };
    try { execFileSync('node', ['scripts/build-dist.mjs'], { cwd: d, env, encoding: 'utf8', stdio: 'pipe' }); return { ok: true, dist: path.join(d, 'dist') }; }
    catch (e) { return { ok: false, err: String(e.stderr) }; }
  };
  const st = run('staging', { VERCEL: '1', VERCEL_ENV: 'preview' });
  const pr = run('production', { VERCEL: '1', VERCEL_ENV: 'production' });
  assert.ok(st.ok && pr.ok);
  for (const f of STAGING_ICON_FILES) {
    assert.ok(rd(st.dist, 'icons', f).equals(rd(__dirname, STAGING_ICONS_DIR, f)), `staging ${f}`);
    assert.ok(rd(pr.dist, 'icons', f).equals(rd(__dirname, 'icons', f)), `production ${f}`);
  }
  const bad = run('staging', { VERCEL: '1', VERCEL_ENV: 'production' });
  assert.equal(bad.ok, false);
  assert.match(bad.err, /Production nunca puede llevar el icono de Staging/);
});

test('ST-8) si falta un icono ST, el build de Staging se detiene (no cae silenciosamente al oficial)', () => {
  const d = fs.mkdtempSync(path.join(tmp, 'miss-'));
  copySrc(d);
  fs.rmSync(path.join(d, STAGING_ICONS_DIR, 'icon-192.png'));
  const r = buildDist({ srcDir: d, outDir: path.join(d, 'dist'), requireGenerated: false, iconVariant: 'staging' });
  assert.ok(r.problems.some((p) => /icons-staging\/icon-192\.png/.test(p)));
});

test('ST-cleanup', () => { fs.rmSync(tmp, { recursive: true, force: true }); });
