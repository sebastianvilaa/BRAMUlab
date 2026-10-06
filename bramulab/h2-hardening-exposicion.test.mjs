// BRAMUlab V04.36 / 04.36-h1 — Hardening de exposición/IP (handoff 138 §5.4 + hallazgo Central de Issue #28).
// Qué prueba: (1) el navegador ya no recibe el motor dinámico de Nivel; (2) `level-public.js` no puede divergir de `level.js`;
// (3) el motor sigue disponible para server/Edge/tests sin cambios; (4) `dist/` = solo allowlist, sin comentarios internos;
// (5) el stripper no rompe código; (6) logo de emails configurable sin cambiar el default; (7) supabase-js fijado con SRI.
// Ejecutar con: node --test bramulab/h2-hardening-exposicion.test.mjs
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDist, verifyDist, stripJs, stripCss, stripHtml, findJsComments, DIST_FILES, DIST_DIRS, DIST_GENERATED,
} from './scripts/build-dist.mjs';
import { resolveNativeLogoBase, DEFAULT_NATIVE_LOGO_BASE, renderEmail } from '../supabase/functions/_shared/email-templates.mjs';
import { generate, writeAll, checkAll } from '../supabase/scripts/build-email-templates.mjs';
import { buildAuthConfigPayload } from '../supabase/scripts/sync-auth-email-templates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('index.html');
const plain = (x) => JSON.parse(JSON.stringify(x));

function loadInto(files, extra = {}) {
  const sb = Object.assign({ localStorage: { getItem: () => null, setItem() {}, removeItem() {} } }, extra);
  sb.window = sb; vm.createContext(sb);
  files.forEach((f) => vm.runInContext(read(f), sb, { filename: f }));
  return sb;
}

/** dist/ armado una sola vez desde el árbol real (sin env.generated.js: el build real lo genera build-env.mjs). */
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-h2-'));
const distDir = path.join(tmpRoot, 'dist');
const built = buildDist({ srcDir: __dirname, outDir: distDir, requireGenerated: false });
test.after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

const localScripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^(https?:|about:)/.test(s)).map((s) => s.split('?')[0]);
const ENGINE_MARKERS = [
  'EXPECTATION_DIVISOR', 'computeMatchUpdate', 'computeExpectation', 'computePairStrength', 'computeMarginMultiplier', 'MARGIN_DOMINANCE_FLOOR',
  'K_BASE', 'OPPONENT_FACTOR_BASE', 'REPETITION_PAIR_WEIGHT', 'COMPANION_FLOOR', 'CIRCLE_FACTOR_CLOSED', 'AVAILABILITY_FACTORS',
  'DELTA_CAP_CALIBRATED', 'INACTIVITY_HALFLIFE_DAYS', 'computeEffectiveConfidenceAfterInactivity', 'CONFIDENCE_EVIDENCE_DIVISOR',
];

/* ======================= A. MOTOR DINÁMICO — fuera del navegador ======================= */

test('A1) index.html ya no carga level.js / level-context.js / match-level-engine.js; carga level-public.js antes de level-calibration.js', () => {
  assert.ok(!localScripts.some((s) => /^(level|level-context|match-level-engine)\.js$/.test(s)), localScripts.join(','));
  const iPub = localScripts.indexOf('level-public.js');
  assert.ok(iPub > localScripts.indexOf('store.js'));
  assert.ok(iPub < localScripts.indexOf('level-calibration.js') && localScripts.indexOf('level-calibration.js') < localScripts.indexOf('app.js'));
});

test('A2) el SW tampoco precachea el motor: CORE_ASSETS tiene level-public.js y level-calibration.js, no level.js ni level-context.js', () => {
  const sw = read('sw.js');
  const block = sw.slice(sw.indexOf('CORE_ASSETS = ['), sw.indexOf('];', sw.indexOf('CORE_ASSETS = [')));
  assert.match(block, /'\.\/level-public\.js\?v=04\.36-h1'/);
  assert.match(block, /'\.\/level-calibration\.js\?v=04\.36-h1'/);
  assert.doesNotMatch(block, /level\.js|level-context\.js|match-level-engine/);
});

test('A3) cargando EXACTAMENTE los scripts del navegador (menos app.js, que es DOM), PLLevel solo trae las 4 primitivas públicas', () => {
  const noApp = localScripts.filter((s) => s !== 'env.generated.js' && s !== 'app.js');
  const sb = loadInto(noApp, { navigator: { onLine: true }, location: { search: '', hash: '', href: 'https://x.test/' }, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] } });
  assert.deepEqual(Object.keys(sb.PLLevel).sort(), ['ALGORITHM_VERSION', 'STATES', 'clampLevel', 'roundPublicLevel']);
  assert.equal(sb.PLLevel.PARAMS, undefined);
  assert.equal(sb.PLLevel.computeMatchUpdate, undefined);
  assert.equal(sb.PLLevelContext, undefined);
  assert.equal(sb.PLMatchLevelEngine, undefined);
  assert.ok(sb.PLLevelCalibration && typeof sb.PLLevelCalibration.computeInitialEstimateV13 === 'function'); // el estimador V1.3 sigue client-side
});

test('A4) ningún archivo de dist/ contiene parámetros ni funciones del motor dinámico (control positivo: level.js sí los contiene)', () => {
  const engineSrc = read('level.js') + read('level-context.js');
  for (const m of ENGINE_MARKERS) assert.ok(engineSrc.includes(m), `control positivo: ${m} debe existir en el motor`);
  const offenders = [];
  for (const f of built.files) {
    if (/\.(png|jpe?g|svg)$/i.test(f)) continue;
    const txt = fs.readFileSync(path.join(distDir, f), 'utf8');
    for (const m of ENGINE_MARKERS) if (txt.includes(m)) offenders.push(`${f}:${m}`);
  }
  assert.deepEqual(offenders, []);
});

test('A5) level-public.js no puede divergir de level.js: mismas constantes y mismo comportamiento (batería de valores)', () => {
  const full = loadInto(['level.js']).PLLevel;
  const pub = loadInto(['level-public.js']).PLLevel;
  assert.equal(pub.ALGORITHM_VERSION, full.ALGORITHM_VERSION);
  assert.deepEqual(plain(pub.STATES), plain(full.STATES));
  const values = [0, -0, 0.04, 0.05, 0.049999, 0.95, 1, 1.00004, 1.00005, 4.4444, 5.55, 5.65, 9.99995, 10, 10.5, 11, -3, 123.456, NaN, Infinity, -Infinity];
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let i = 0; i < 3000; i += 1) values.push(rnd() * 14 - 2);
  for (const v of values) {
    assert.ok(Object.is(pub.roundPublicLevel(v), full.roundPublicLevel(v)), `roundPublicLevel(${v})`);
    assert.ok(Object.is(pub.clampLevel(v), full.clampLevel(v)), `clampLevel(${v})`);
  }
});

test('A6) paridad de calibración: level-calibration.js da resultados idénticos sobre level-public.js que sobre level.js completo', () => {
  const a = loadInto(['level.js', 'level-calibration.js']);
  const b = loadInto(['level-public.js', 'level-calibration.js']);
  const grid = [[0, 0, 0, 0, 0], [9, 9, 9, 9, 9], [6, 6, 6, 6, 6], [2, 5, 3, 7, 4], [4, 4, 5, 5, 6], [8, 1, 9, 0, 5]];
  for (const g of grid) {
    const ea = a.PLLevelCalibration.computeInitialEstimateV13(g); const eb = b.PLLevelCalibration.computeInitialEstimateV13(g);
    assert.deepEqual(plain(eb), plain(ea));
    assert.deepEqual(plain(b.PLLevelCalibration.confirmInitialLevelV13(eb, 'x')), plain(a.PLLevelCalibration.confirmInitialLevelV13(ea, 'x')));
    assert.deepEqual(
      plain(b.PLLevelCalibration.buildInitialCalibrationState('full', b.PLLevelCalibration.confirmInitialLevelV13(eb, 'x'), eb.positions)),
      plain(a.PLLevelCalibration.buildInitialCalibrationState('full', a.PLLevelCalibration.confirmInitialLevelV13(ea, 'x'), ea.positions)),
    );
  }
  for (const [rated, rivals] of [[5, 3], [5, 2], [4, 3], [0, 0], [9, 9]]) {
    assert.deepEqual(
      plain(b.PLLevelCalibration.computeCalibrationTransition({ state: b.PLLevel.STATES.CALIBRATING }, rated, rivals)),
      plain(a.PLLevelCalibration.computeCalibrationTransition({ state: a.PLLevel.STATES.CALIBRATING }, rated, rivals)),
    );
  }
});

test('A7) el motor completo sigue intacto y disponible para server/Edge/tests: level.js sin cambios (SHA pineado), mismo archivo vía symlink _shared', () => {
  const h = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, f))).digest('hex');
  assert.equal(h('level.js'), '12aa1dbe49deae59642ed185767af2e0dda5a01c18e33cc5728c82148fff6050');
  assert.equal(h('match-level-engine.js'), 'a5677f73e73af9adf6cd5231953d4364422ca24254243d0fe9101d854c6bda74');
  const shared = path.join(REPO, 'supabase', 'functions', '_shared');
  for (const f of ['level.js', 'level-context.js', 'level-calibration.js', 'match-level-engine.js']) {
    assert.equal(fs.realpathSync(path.join(shared, f)), fs.realpathSync(path.join(__dirname, f)), f);
  }
  const full = loadInto(['level.js']).PLLevel;
  for (const k of ['PARAMS', 'computeMatchUpdate', 'computeExpectation', 'computePairStrength', 'computeEffectiveLevel']) assert.ok(full[k], k);
  // Las Edge Functions siguen importando el motor completo (no el público).
  const edge = fs.readFileSync(path.join(shared, 'match-officialize-core.ts'), 'utf8');
  assert.match(edge, /import '\.\.\/_shared\/level\.js';/);
  assert.match(edge, /import '\.\.\/_shared\/level-context\.js';/);
  // level-public.js NO se importa desde ninguna Edge Function (sería pisar PLLevel completo con el público).
  const edgeFiles = execFileSync('git', ['ls-files', 'supabase/functions'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter((f) => /\.(ts|mjs|js)$/.test(f));
  for (const f of edgeFiles) assert.doesNotMatch(fs.readFileSync(path.join(REPO, f), 'utf8'), /level-public/);
});

/* ======================= B. dist/ — allowlist y limpieza ======================= */

test('B1) vercel.json publica solo dist/ y lo construye después de build-env; dist/ está ignorado por Git', () => {
  const v = JSON.parse(read('vercel.json'));
  assert.equal(v.outputDirectory, 'dist');
  assert.match(v.buildCommand, /node scripts\/build-env\.mjs && node scripts\/build-dist\.mjs/);
  assert.deepEqual(v.rewrites, [{ source: '/robots.txt', destination: '/robots.generated.txt' }]);
  assert.match(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8'), /^bramulab\/dist\/$/m);
  assert.equal(execFileSync('git', ['ls-files', 'bramulab/dist'], { cwd: REPO, encoding: 'utf8' }).trim(), '');
});

test('B2) dist/ contiene EXACTAMENTE la allowlist (más los generados si existen) y nada más', () => {
  assert.deepEqual(built.problems, []);
  const expected = new Set([...DIST_FILES]);
  const extra = built.files.filter((f) => !expected.has(f) && !DIST_DIRS.some((d) => f.startsWith(d + '/')) && !DIST_GENERATED.includes(f));
  assert.deepEqual(extra, []);
  for (const f of DIST_FILES) assert.ok(built.files.includes(f), `falta ${f}`);
  for (const d of DIST_DIRS) assert.ok(built.files.some((f) => f.startsWith(d + '/')), `falta ${d}/`);
  // La allowlist cubre todos los scripts que carga index.html.
  for (const s of localScripts) assert.ok(s === 'env.generated.js' || DIST_FILES.includes(s), s);
});

test('B3) dist/ NO contiene tests, tests.html, scripts de dev/release, api, .env.example, vercel.json ni módulos server-side', () => {
  const banned = /\.test\.mjs$|(^|\/)tests\.html$|^scripts\/|^api\/|(^|\/)\.env|^vercel\.json$|^level\.js$|^level-context\.js$|^match-level-engine\.js$|^intelligence-(context|claims|editorial|official|presentation)\.js$|\.map$|DS_Store/;
  assert.deepEqual(built.files.filter((f) => banned.test(f)), []);
  assert.ok(fs.existsSync(path.join(__dirname, 'tests.html')) && fs.existsSync(path.join(__dirname, 'level.js'))); // siguen en el source
});

test('B4) todo JS de dist/ es sintácticamente válido y todo lo que index.html/manifest/SW referencian existe', () => {
  for (const f of built.files.filter((x) => x.endsWith('.js'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(distDir, f), 'utf8'), { filename: f }), f);
  }
  assert.deepEqual(verifyDist(distDir, { skipGenerated: true }), []);
});

test('B5) versionado coherente dentro de dist/: store.js = version.json = CACHE_NAME = ?v= de index.html y CORE_ASSETS', () => {
  const d = (f) => fs.readFileSync(path.join(distDir, f), 'utf8');
  const ver = JSON.parse(d('version.json'));
  assert.deepEqual(ver, { version: 'BRAMUlab V04.36', bundle: '04.36-h1' });
  assert.match(d('store.js'), /BUNDLE_VERSION = '04\.36-h1'/);
  assert.match(d('store.js'), /APP_VERSION = 'BRAMUlab V04\.36'/);
  assert.match(d('sw.js'), /CACHE_NAME = 'bramulab-v04-36-h1'/);
  const versions = new Set([...d('index.html').matchAll(/\?v=([0-9.]+-h\d+)/g)].map((m) => m[1]));
  const swV = new Set([...d('sw.js').matchAll(/\?v=([0-9.]+-h\d+)/g)].map((m) => m[1]));
  const manV = new Set([...d('manifest.webmanifest').matchAll(/\?v=([0-9.]+-h\d+)/g)].map((m) => m[1]));
  for (const s of [versions, swV, manV]) assert.deepEqual([...s], ['04.36-h1']);
  assert.equal(JSON.stringify(Object.keys(ver)), '["version","bundle"]');
});

test('B6) dist/ no trae comentarios internos de proceso, pero conserva el código y los strings intactos', () => {
  const banned = /handoff|ChatGPT|Claude|Central\b|Sebasti[aá]n|docs\/BRAMUlab|Issue #\d|Pre_Production/i;
  let linesWithHits = 0;
  for (const f of ['index.html', 'sw.js', 'store.js', 'engine.js', 'level-public.js', 'level-calibration.js']) {
    const txt = fs.readFileSync(path.join(distDir, f), 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (/^(\/\/|\/\*|\*|<!--)/.test(t) && banned.test(t)) linesWithHits++;
    }
  }
  assert.equal(linesWithHits, 0);
  const srcBytes = built.stats.bytesIn; const outBytes = built.stats.bytesOut;
  assert.ok(outBytes < srcBytes * 0.7, `dist debería pesar bastante menos que el source (${outBytes} vs ${srcBytes})`);
  // Un comentario FINAL de línea (código real) sobrevive: no se toca nada que no sea comentario de línea completa.
  assert.match(fs.readFileSync(path.join(distDir, 'sw.js'), 'utf8'), /\.catch\(\(\) => \{ \/\* si algún asset falla, no bloquear la instalación \*\/ \}\)/);
});

test('B7) cada JS/CSS/HTML de dist/ = source menos SOLO líneas de comentario (cada tramo quitado arranca en un comentario; subsecuencia exacta; idempotente)', () => {
  for (const f of built.files.filter((x) => /\.(js|css|html)$/.test(x))) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n');
    const out = fs.readFileSync(path.join(distDir, f), 'utf8').split('\n');
    let j = 0; const removed = [];
    for (let i = 0; i < src.length; i += 1) {
      if (j < out.length && src[i] === out[j]) { j += 1; } else { removed.push(i); }
    }
    assert.equal(j, out.length, `${f}: dist no es subsecuencia del source`);
    let prev = -2;
    for (const i of removed) {
      if (i !== prev + 1) { // inicio de un tramo quitado
        const t = src[i].trim();
        assert.ok(/^(\/\/|\/\*|<!--)/.test(t), `${f}:${i + 1} se quitó una línea que no abre un comentario: ${t.slice(0, 40)}`);
      }
      prev = i;
    }
  }
  const dd = (f) => fs.readFileSync(path.join(distDir, f), 'utf8');
  assert.equal(stripJs(dd('app.js')), dd('app.js'));
  assert.equal(stripCss(dd('styles.css')), dd('styles.css'));
  assert.equal(stripHtml(dd('index.html')), dd('index.html'));
});

test('B8) stripper: quita solo comentarios de línea completa y respeta strings, templates, regex, división, CSS url() y condicionales', () => {
  const js = [
    '// comentario de línea completa',
    "const a = 'http://x.test/*no*/';  // final de línea: se conserva",
    '/* bloque',
    '   multilínea */',
    'const b = `',
    '// esto es TEXTO de un template, no un comentario',
    '/* tampoco esto */',
    '${a}`;',
    'const re = /\\/\\*|\\/\\//g; const d = a / 2 / 3;',
    "const q = \"/* en string */\";",
    '/*! licencia preservada */',
    'let x = 1; /* inline: se conserva */ let y = 2;',
    'const t2 = `${ /* dentro de expr */ 1 }` + `${`// anidado`}`;',
    '  // otro comentario indentado',
    'end();',
  ].join('\n');
  const out = stripJs(js);
  assert.equal(out, [
    "const a = 'http://x.test/*no*/';  // final de línea: se conserva",
    'const b = `',
    '// esto es TEXTO de un template, no un comentario',
    '/* tampoco esto */',
    '${a}`;',
    'const re = /\\/\\*|\\/\\//g; const d = a / 2 / 3;',
    "const q = \"/* en string */\";",
    '/*! licencia preservada */',
    'let x = 1; /* inline: se conserva */ let y = 2;',
    'const t2 = `${ /* dentro de expr */ 1 }` + `${`// anidado`}`;',
    'end();',
  ].join('\n'));
  assert.doesNotThrow(() => new vm.Script(out));
  assert.ok(findJsComments(js).length >= 6);
  const css = ['/* cabecera */', '.a{background:url("data:image/svg+xml,%3Csvg /* no */ %3E")}', '.b{color:red} /* final */', '  /* otro */', '.c{}'].join('\n');
  assert.equal(stripCss(css), ['.a{background:url("data:image/svg+xml,%3Csvg /* no */ %3E")}', '.b{color:red} /* final */', '.c{}'].join('\n'));
  const h = ['<!-- cabecera', '     multilínea -->', '<p>hola</p> <!-- final -->', '<!--[if IE]><p>ie</p><![endif]-->', '<!-- con <script src="x.js"></script> adentro -->', '<script>', '// js inline', 'var z = 1;', '</script>'].join('\n');
  assert.equal(stripHtml(h), ['<p>hola</p> <!-- final -->', '<!--[if IE]><p>ie</p><![endif]-->', '<script>', 'var z = 1;', '</script>'].join('\n'));
});

test('B9) el build NO modifica el source de bramulab/ (solo escribe en outDir) y falla si falta un archivo de la allowlist', () => {
  const before = crypto.createHash('sha256').update(read('app.js') + read('index.html')).digest('hex');
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-h2b-'));
  try {
    buildDist({ srcDir: __dirname, outDir: path.join(t, 'dist'), requireGenerated: false });
    assert.equal(crypto.createHash('sha256').update(read('app.js') + read('index.html')).digest('hex'), before);
    const partial = path.join(t, 'src'); fs.mkdirSync(partial);
    fs.writeFileSync(path.join(partial, 'index.html'), '<html></html>');
    const r = buildDist({ srcDir: partial, outDir: path.join(t, 'dist2'), requireGenerated: false });
    assert.ok(r.problems.some((p) => /^falta /.test(p)));
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
});

/* ======================= C. logo de emails — configurable, default intacto ======================= */

test('C1) resolveNativeLogoBase: sin valor conserva el default vigente; valida origen https y rechaza repo/GitHub/localhost', () => {
  assert.equal(resolveNativeLogoBase(undefined), DEFAULT_NATIVE_LOGO_BASE);
  assert.equal(resolveNativeLogoBase(''), DEFAULT_NATIVE_LOGO_BASE);
  assert.equal(resolveNativeLogoBase('https://app.example.test/'), 'https://app.example.test');
  assert.equal(resolveNativeLogoBase('https://app.example.test:8443'), 'https://app.example.test:8443');
  for (const bad of ['http://app.example.test', 'https://app.example.test/ruta', 'https://app.example.test?x=1', 'https://u:p@app.example.test', 'https://raw.githubusercontent.com/x/y',
    'https://user.github.io', 'https://github.com/x', 'https://localhost:3000', 'https://127.0.0.1', 'app.example.test', 'ftp://x.test']) {
    assert.throws(() => resolveNativeLogoBase(bad), /BRAMU_EMAIL_LOGO_BASE/, bad);
  }
});

test('C2) sin BRAMU_EMAIL_LOGO_BASE las plantillas, previews y manifest quedan EXACTAMENTE como están versionadas (Staging no cambia)', () => {
  assert.deepEqual(checkAll(undefined, {}), []);
  const files = generate({});
  for (const t of ['confirmation', 'recovery', 'email_change', 'password_changed_notification']) {
    assert.ok(files[`auth/${t}.html`].includes(`${DEFAULT_NATIVE_LOGO_BASE}/icons/logo.png`), t);
  }
});

test('C3) con BRAMU_EMAIL_LOGO_BASE las 4 plantillas Auth usan el origen nuevo y ninguna menciona raw.githubusercontent; custom no cambia', () => {
  const env = { BRAMU_EMAIL_LOGO_BASE: 'https://app.example.test' };
  const files = generate(env);
  const natives = ['confirmation', 'recovery', 'email_change', 'password_changed_notification'];
  for (const t of natives) {
    const h = files[`auth/${t}.html`];
    assert.ok(h.includes('https://app.example.test/icons/logo.png'), t);
    assert.ok(!/raw\.githubusercontent|github\.io/.test(h), t);
  }
  assert.equal(JSON.parse(files['manifest.json']).hostedStaging.logoBase, 'https://app.example.test');
  assert.deepEqual(Object.keys(files).filter((k) => k.startsWith('previews/')).sort(), Object.keys(generate({})).filter((k) => k.startsWith('previews/')).sort());
  assert.equal(files['previews/08-account_deleted.html'], generate({})['previews/08-account_deleted.html']);
  // El render custom (Edge) sigue usando SU base (BRAMU_PUBLIC_BASE_URL) y no el logo nativo.
  const custom = renderEmail(8, { mode: 'custom', baseUrl: 'https://edge.example.test', logoBase: 'https://otro.example.test' });
  assert.ok(custom.includes('https://edge.example.test/icons/logo.png') && !custom.includes('otro.example.test'));
});

test('C4) sync-auth-email-templates se niega a sincronizar plantillas generadas con otro logo y acepta las regeneradas', () => {
  const env = { BRAMU_EMAIL_LOGO_BASE: 'https://app.example.test' };
  const stale = path.join(REPO, 'supabase', 'email-templates');
  assert.throws(() => buildAuthConfigPayload(stale, env), /desactualizadas respecto de BRAMU_EMAIL_LOGO_BASE/);
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-h2c-'));
  try {
    writeAll(t, env);
    const payload = buildAuthConfigPayload(t, env);
    assert.ok(payload.mailer_templates_confirmation_content.includes('https://app.example.test/icons/logo.png'));
    assert.throws(() => buildAuthConfigPayload(t, { BRAMU_EMAIL_LOGO_BASE: 'https://raw.githubusercontent.com/x' }), /BRAMU_EMAIL_LOGO_BASE/);
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  assert.ok(buildAuthConfigPayload(stale, {}).mailer_templates_confirmation_content.includes(DEFAULT_NATIVE_LOGO_BASE)); // sin variable: igual que hoy
});

/* ======================= D. supply chain — supabase-js fijado + SRI ======================= */

test('D1) supabase-js: versión EXACTA + SRI sha384 + crossorigin anonymous; ningún @2 flotante; dist/ conserva el tag', () => {
  const tag = html.match(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]+"[^>]*>/g);
  assert.equal(tag.length, 1);
  assert.match(tag[0], /supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js"/);
  assert.match(tag[0], /integrity="sha384-[A-Za-z0-9+/]{64}"/);
  assert.match(tag[0], /crossorigin="anonymous"/);
  assert.doesNotMatch(html, /supabase-js@2["/]/);
  assert.equal(fs.readFileSync(path.join(distDir, 'index.html'), 'utf8').match(/<script src="https:\/\/cdn\.jsdelivr\.net[^"]+"[^>]*>/g)[0], tag[0]);
  // El hash es de 48 bytes (sha384) en base64.
  assert.equal(Buffer.from(tag[0].match(/sha384-([A-Za-z0-9+/]{64})/)[1], 'base64').length, 48);
});
