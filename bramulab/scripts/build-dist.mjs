// BRAMUlab — Hardening de exposición (138 §5.4): arma `bramulab/dist/`, la ÚNICA carpeta que Vercel publica.
//
//   node scripts/build-dist.mjs            (Build Command de Vercel: `node scripts/build-env.mjs && node scripts/build-dist.mjs`)
//
// Qué hace:
//   1. Copia por ALLOWLIST (lista explícita de abajo) solo lo que el navegador necesita. Todo lo demás de `bramulab/`
//      (tests.html, *.test.mjs, scripts/, api/, .env.example, vercel.json, el motor dinámico de Nivel `level.js` /
//      `level-context.js` / `match-level-engine.js`, los módulos server-side de Intelligence…) NO se publica.
//   2. En la COPIA retira los comentarios de LÍNEA COMPLETA (JS `//` y `/* */`, CSS `/* */`, HTML `<!-- -->`): historia de
//      versiones, handoffs, causas de bugs. Nunca toca comentarios al final de una línea de código ni el código. NO minifica
//      y NO es un mecanismo de seguridad (todo JS/HTML/CSS entregado al cliente es inspeccionable): es higiene + peso.
//   3. Verifica sintaxis de cada JS resultante (vm.Script, sin ejecutarlo) y que todo lo que `index.html`, el manifest y el
//      Service Worker referencian exista en `dist/`.
//
// El source mantenible de `bramulab/` NO se modifica jamás. `dist/` está en .gitignore. Sin dependencias ni bundler.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BRAMULAB_DIR = path.resolve(HERE, '..');
export const DIST_DIR = path.join(BRAMULAB_DIR, 'dist');

/** Archivos sueltos que llegan al navegador (JS en el orden en que los carga index.html). */
export const DIST_FILES = Object.freeze([
  'index.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'version.json',
  'engine.js', 'stats.js', 'store.js',
  'level-public.js', 'level-calibration.js',
  'player-home.js', 'match-load.js', 'player-identity.js', 'groups.js', 'locations.js', 'ranking.js',
  'auth.js', 'matches.js', 'match-sync.js', 'match-validation.js', 'match-self-heal.js', 'intelligence-client.js',
  'app.js',
]);
/** Archivos que genera `build-env.mjs` junto al source (se copian tal cual, sin tocar su contenido). */
export const DIST_GENERATED = Object.freeze(['env.generated.js', 'robots.generated.txt']);
/** Directorios completos de assets/páginas públicas. */
export const DIST_DIRS = Object.freeze(['icons', 'assets', 'privacidad', 'terminos', 'eliminar-cuenta', 'admin']);
/** BRAMU Metrics (F3): fixture de QA con datos inventados. Solo se publica en un build de Staging; en cualquier otro entorno se retira de dist/. */
export const QA_FIXTURE_FILE = 'admin/metrics/qa-fixture.js';

/* ------------------------------------------------------------------ */
/* Icono por entorno (Staging = variante azul ST; Production y el resto = icono oficial) */
/* ------------------------------------------------------------------ */

/** Carpeta FUERA de la allowlist: sus archivos solo llegan a `dist/` en un build de Staging (pisan a `icons/` con el mismo nombre). */
export const STAGING_ICONS_DIR = 'icons-staging';
export const STAGING_ICON_FILES = Object.freeze(['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png', 'favicon-64.png']);
const APPLE_TOUCH_RE = /(rel="apple-touch-icon" sizes="180x180" href="data:image\/png;base64,)([A-Za-z0-9+/=]+)(")/;

/** `staging` solo si el entorno horneado en el bundle (`env.generated.js`, que escribe build-env.mjs) se llama `staging`. */
export function detectIconVariant(srcDir = BRAMULAB_DIR) {
  const f = path.join(srcDir, 'env.generated.js');
  if (!fs.existsSync(f)) return 'official';
  const m = fs.readFileSync(f, 'utf8').match(/\bname:\s*"([^"]*)"/);
  return m && m[1] === 'staging' ? 'staging' : 'official';
}

/** Pisa en `dist/` los iconos PWA/favicon/apple-touch con los ST y marca sus URLs del manifest (`?v=<bundle>-st`). Devuelve problemas. */
function applyStagingIcons(srcDir, outDir) {
  const problems = [];
  for (const f of STAGING_ICON_FILES) {
    const from = path.join(srcDir, STAGING_ICONS_DIR, f);
    if (!fs.existsSync(from)) { problems.push(`falta ${STAGING_ICONS_DIR}/${f} (icono de Staging)`); continue; }
    fs.copyFileSync(from, path.join(outDir, 'icons', f));
  }
  if (problems.length) return problems;
  const htmlFile = path.join(outDir, 'index.html');
  const html = fs.readFileSync(htmlFile, 'utf8');
  if (!APPLE_TOUCH_RE.test(html)) problems.push('index.html: no se encontró el apple-touch-icon incrustado para reemplazar');
  else {
    const b64 = fs.readFileSync(path.join(srcDir, STAGING_ICONS_DIR, 'apple-touch-icon.png')).toString('base64');
    fs.writeFileSync(htmlFile, html.replace(APPLE_TOUCH_RE, (_, a, __, c) => a + b64 + c), 'utf8');
  }
  const manFile = path.join(outDir, 'manifest.webmanifest');
  const man = fs.readFileSync(manFile, 'utf8');
  const next = man.replace(/(icons\/[A-Za-z0-9-]+\.png\?v=[^"]+?)"/g, '$1-st"');
  if (next === man) problems.push('manifest.webmanifest: no se encontraron iconos para marcar como ST');
  else fs.writeFileSync(manFile, next, 'utf8');
  return problems;
}

/* ------------------------------------------------------------------ */
/* Detección de comentarios (tokenizador, no regex ciega: respeta strings, templates, regex) */
/* ------------------------------------------------------------------ */

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'delete', 'void', 'in', 'of', 'instanceof', 'new', 'else', 'do', 'throw', 'yield', 'await']);
const REGEX_AFTER = '(,=:[!&|?{};+-*%<>~^';
const isWordChar = (c) => /[A-Za-z0-9_$]/.test(c);

/** [inicio, fin) de cada comentario JS del código. */
export function findJsComments(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  const skipString = (q) => {
    i++;
    while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    i++;
  };
  const skipRegex = () => {
    i++;
    let inClass = false;
    while (i < n) {
      const d = src[i];
      if (d === '\\') { i += 2; continue; }
      if (d === '[') inClass = true;
      else if (d === ']') inClass = false;
      else if (d === '/' && !inClass) break;
      else if (d === '\n') break;
      i++;
    }
    i++;
    while (i < n && /[A-Za-z]/.test(src[i])) i++;
  };
  const scanTemplate = () => {
    i++; // backtick de apertura
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') { i += 2; scanCode(true); i++; continue; }
      i++;
    }
  };
  // Consume código; si `inExpr`, termina al llegar a la `}` que cierra la expresión de un template (i queda en ella).
  const scanCode = (inExpr) => {
    let depth = 0;
    let prev = '';
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') { const j = src.indexOf('\n', i); const e = j < 0 ? n : j; out.push([i, e]); i = e; continue; }
      if (c === '/' && d === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out.push([i, e]); i = e; continue; }
      if (c === '"' || c === '\'') { skipString(c); prev = 'a'; continue; }
      if (c === '`') { scanTemplate(); prev = 'a'; continue; }
      if (c === '/') {
        if (prev === '' || prev === 'K' || (prev.length === 1 && REGEX_AFTER.includes(prev))) { skipRegex(); prev = 'a'; continue; }
        prev = '/'; i++; continue;
      }
      if (inExpr) {
        if (c === '{') depth++;
        else if (c === '}') { if (depth === 0) return; depth--; }
      }
      if (/\s/.test(c)) { i++; continue; }
      if (isWordChar(c)) {
        const s = i;
        while (i < n && isWordChar(src[i])) i++;
        prev = KEYWORDS_BEFORE_REGEX.has(src.slice(s, i)) ? 'K' : 'a';
        continue;
      }
      prev = c; i++;
    }
  };
  scanCode(false);
  return out;
}

/** [inicio, fin) de cada comentario CSS (respeta strings, p. ej. url("data:…")). */
export function findCssComments(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === '\'') { i++; while (i < n && src[i] !== c) { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); const e = j < 0 ? n : j + 2; out.push([i, e]); i = e; continue; }
    i++;
  }
  return out;
}

/** Comentarios que NUNCA se retiran: licencias/`/*!`. */
const isPreserved = (text) => /^\/\*!/.test(text) || /@license|@preserve/.test(text);

/** Rangos [ls, le+1) de las líneas que contienen SOLO un comentario (nada de código antes ni después). */
function wholeLineRanges(src, comments) {
  const n = src.length;
  const ranges = [];
  for (const [s, e] of comments) {
    if (isPreserved(src.slice(s, e))) continue;
    const ls = src.lastIndexOf('\n', s - 1) + 1;
    let le = src.indexOf('\n', e);
    if (le < 0) le = n;
    if (src.slice(ls, s).trim() !== '' || src.slice(e, le).trim() !== '') continue;
    ranges.push([ls, Math.min(le + 1, n)]);
  }
  return ranges;
}

function applyRemovals(src, ranges) {
  if (!ranges.length) return src;
  ranges.sort((a, b) => a[0] - b[0]);
  let out = '';
  let last = 0;
  for (const [s, e] of ranges) {
    if (s < last) { if (e > last) last = e; continue; }
    out += src.slice(last, s);
    last = e;
  }
  return out + src.slice(last);
}

export function stripJs(src) { return applyRemovals(src, wholeLineRanges(src, findJsComments(src))); }
export function stripCss(src) { return applyRemovals(src, wholeLineRanges(src, findCssComments(src))); }

/** HTML: `<!-- -->` de línea completa + el JS/CSS inline con sus propias reglas. Los condicionales `<!--[if` se conservan. */
export function stripHtml(src) {
  const ranges = [];
  const re = /<!--[\s\S]*?-->|<script\b([^>]*)>([\s\S]*?)<\/script>|<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(src))) {
    const t = m[0];
    if (t.startsWith('<!--')) {
      if (/^<!--\[if/i.test(t)) continue;
      const s = m.index; const e = s + t.length;
      const ls = src.lastIndexOf('\n', s - 1) + 1;
      let le = src.indexOf('\n', e); if (le < 0) le = src.length;
      if (src.slice(ls, s).trim() === '' && src.slice(e, le).trim() === '') ranges.push([ls, Math.min(le + 1, src.length)]);
    } else if (/^<script/i.test(t)) {
      if (/\bsrc\s*=/.test(m[1] || '') || !(m[2] || '').trim()) continue;
      const off = m.index + t.indexOf('>') + 1;
      for (const r of wholeLineRanges(src, findJsComments(m[2]).map(([s, e]) => [s + off, e + off]))) ranges.push(r);
    } else {
      const off = m.index + t.indexOf('>') + 1;
      for (const r of wholeLineRanges(src, findCssComments(m[3]).map(([s, e]) => [s + off, e + off]))) ranges.push(r);
    }
  }
  return applyRemovals(src, ranges);
}

const STRIPPERS = { '.js': stripJs, '.css': stripCss, '.html': stripHtml };

/* ------------------------------------------------------------------ */
/* Armado de dist/ */
/* ------------------------------------------------------------------ */

function copyDirFiltered(srcDir, outDir, onFile) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (ent.name === '.DS_Store') continue;
    const s = path.join(srcDir, ent.name); const o = path.join(outDir, ent.name);
    if (ent.isDirectory()) copyDirFiltered(s, o, onFile);
    else onFile(s, o);
  }
}

/**
 * Construye `outDir` desde `srcDir`. Devuelve { files:[rutas relativas ordenadas], stats }.
 * `iconVariant`: 'official' (default; Production/Development y todos los tests) o 'staging' (iconos ST). La CLI lo decide por el entorno del bundle.
 * @param {{srcDir?:string,outDir?:string,strip?:boolean,requireGenerated?:boolean,iconVariant?:'official'|'staging'}} [opts]
 */
export function buildDist(opts = {}) {
  const srcDir = opts.srcDir || BRAMULAB_DIR;
  const outDir = opts.outDir || path.join(srcDir, 'dist');
  const strip = opts.strip !== false;
  const requireGenerated = opts.requireGenerated !== false;
  const iconVariant = opts.iconVariant === 'staging' ? 'staging' : 'official';
  const problems = [];

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const stats = { bytesIn: 0, bytesOut: 0, files: 0 };

  const emit = (rel, { raw = false } = {}) => {
    const abs = path.join(srcDir, rel);
    if (!fs.existsSync(abs)) { problems.push(`falta ${rel}`); return; }
    const buf = fs.readFileSync(abs);
    const ext = path.extname(rel).toLowerCase();
    let out = buf;
    if (!raw && strip && STRIPPERS[ext]) {
      const text = buf.toString('utf8');
      const stripped = STRIPPERS[ext](text);
      if (ext === '.js') {
        try { new vm.Script(stripped, { filename: rel }); } catch (e) { problems.push(`JS inválido tras retirar comentarios: ${rel} (${e.message})`); }
      }
      out = Buffer.from(stripped, 'utf8');
    }
    const dst = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, out);
    stats.bytesIn += buf.length; stats.bytesOut += out.length; stats.files++;
  };

  for (const f of DIST_FILES) emit(f);
  for (const f of DIST_GENERATED) {
    if (fs.existsSync(path.join(srcDir, f))) emit(f, { raw: true });
    else if (requireGenerated) problems.push(`falta ${f}: correr scripts/build-env.mjs antes de build-dist.mjs`);
  }
  for (const d of DIST_DIRS) {
    const abs = path.join(srcDir, d);
    if (!fs.existsSync(abs)) { problems.push(`falta directorio ${d}/`); continue; }
    copyDirFiltered(abs, path.join(outDir, d), (s, o) => {
      const rel = path.relative(srcDir, s);
      const ext = path.extname(rel).toLowerCase();
      if (STRIPPERS[ext]) emit(rel); // páginas legales (index.html): también sin comentarios internos
      else { fs.mkdirSync(path.dirname(o), { recursive: true }); fs.copyFileSync(s, o); stats.files++; }
    });
  }

  if (iconVariant === 'staging') problems.push(...applyStagingIcons(srcDir, outDir));
  if (iconVariant !== 'staging') fs.rmSync(path.join(outDir, QA_FIXTURE_FILE), { force: true });

  const files = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs); else files.push(path.relative(outDir, abs).split(path.sep).join('/'));
    }
  })(outDir);
  files.sort();

  problems.push(...verifyDist(outDir, { skipGenerated: !requireGenerated }));
  return { files, stats, problems };
}

/** Todo lo que index.html / manifest / SW referencian como archivo local debe existir en dist. */
export function verifyDist(outDir, { skipGenerated = false } = {}) {
  const problems = [];
  const exists = (rel) => {
    const clean = rel.split('?')[0].replace(/^\.\//, '');
    return (skipGenerated && DIST_GENERATED.includes(clean)) || fs.existsSync(path.join(outDir, clean));
  };
  const read = (rel) => (fs.existsSync(path.join(outDir, rel)) ? fs.readFileSync(path.join(outDir, rel), 'utf8') : '');
  const html = read('index.html');
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u) || /^(about|data):/.test(u)) continue;
    if (!exists(u)) problems.push(`index.html referencia ${u} y no está en dist/`);
  }
  for (const m of html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u) || /^(about|data):/.test(u)) continue;
    if (!exists(u)) problems.push(`index.html referencia ${u.slice(0, 80)} y no está en dist/`);
  }
  // BRAMU Metrics (F3): la consola privada referencia sus archivos con rutas absolutas; todos deben existir en dist/.
  const admin = read('admin/metrics/index.html');
  if (!admin) problems.push('falta admin/metrics/index.html en dist/');
  for (const m of admin.matchAll(/(?:<script[^>]+src|<link[^>]+href|<img[^>]+src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:)?\/\//.test(u) || /^(about|data):/.test(u)) continue;
    if (!exists(u.replace(/^\//, ''))) problems.push(`admin/metrics/index.html referencia ${u} y no está en dist/`);
  }
  try {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    for (const ic of manifest.icons || []) if (!exists(ic.src)) problems.push(`manifest referencia ${ic.src} y no está en dist/`);
  } catch (e) { problems.push('manifest.webmanifest ilegible en dist/'); }
  const sw = read('sw.js');
  const start = sw.indexOf('CORE_ASSETS = [');
  if (start < 0) problems.push('sw.js sin CORE_ASSETS en dist/');
  else {
    const block = sw.slice(start, sw.indexOf('];', start));
    for (const m of block.matchAll(/'([^']+)'/g)) if (m[1] !== './' && !exists(m[1])) problems.push(`CORE_ASSETS referencia ${m[1]} y no está en dist/`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const iconVariant = detectIconVariant();
  if (iconVariant === 'staging' && process.env.VERCEL_ENV === 'production') {
    console.error('[build-dist] Build detenido: un deploy de Production nunca puede llevar el icono de Staging.');
    process.exit(1);
  }
  const { files, stats, problems } = buildDist({ iconVariant });
  if (problems.length) {
    console.error('[build-dist] Build detenido:\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
  console.log(`[build-dist] OK — ${files.length} archivos en dist/ (${stats.bytesIn} B fuente -> ${stats.bytesOut} B). Iconos: ${iconVariant === 'staging' ? 'ST (Staging)' : 'oficiales'}.`);
}
