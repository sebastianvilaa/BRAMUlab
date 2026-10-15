// BRAMUlab Web — franja «Jugás. Lo cargás. Empieza a sumar.» (puente entre el hero y «Cómo funciona»).
// Ejecutar con: node --test bramulab-web/tests/puente.test.mjs
// Fija por texto lo que no debe retroceder: ubicación, relato legible sin animaciones, sin datos inventados, movimiento reducido,
// y que hero / tutorial / CTAs / SEO / BRAMU Metrics queden intactos.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
const html = read('public/index.html');
const css = read('public/css/puente.css');
const js = read('public/js/puente.js');
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

const section = html.slice(html.indexOf('<section class="bridge"'), html.indexOf('</section>', html.indexOf('<section class="bridge"')) + 10);

test('ubicación: inmediatamente debajo del hero y antes de «Cómo funciona» (que se conserva entero)', () => {
  const hero = html.indexOf('<section class="hero" id="inicio"');
  const heroEnd = html.indexOf('</section>', hero);
  const bridge = html.indexOf('<section class="bridge" id="puente"');
  const flow = html.indexOf('<section class="flow" id="como-funciona"');
  assert.ok(hero >= 0 && heroEnd < bridge && bridge < flow, 'hero → puente → cómo funciona');
  assert.equal(html.slice(heroEnd + 10, bridge).replace(/<!--[\s\S]*?-->/g, '').trim(), '', 'nada entre el hero y la franja');
  assert.match(html, /<h2 class="h2 h2--lines" id="flow-titulo">\s*<span>Jugaste\. Cargalo\.<\/span>/, 'el tutorial detallado sigue igual');
  assert.match(html, /href="#como-funciona"[^>]*>\s*Descubrí cómo funciona/, 'el ancla del hero sigue apuntando al tutorial');
});

test('relato: título y textos DEFINITIVOS (15/10) con texto real (se entiende sin animaciones)', () => {
  assert.match(section, /<h2 class="h2 bridge__title" id="bridge-titulo" data-reveal>Cada partido tiene una <span class="accent">historia\.<\/span><\/h2>/);
  const keys = [...section.matchAll(/<p class="bs__k">([^<]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['La jugás', 'La guardás', 'La descubrís']);
  const texts = [...section.matchAll(/<p class="bs__t">([^<]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(texts, ['Todo empieza en la cancha.', 'Registrás el resultado en BRAMUlab.', 'Tu historial y tus estadísticas te cuentan cómo venís jugando.']);
  assert.match(section, /<ol class="bridge__steps">/);
  assert.equal([...section.matchAll(/class="bs__vis" aria-hidden="true"/g)].length, 3, 'los dibujos son decorativos');
  assert.match(section, /id="puente" aria-labelledby="bridge-titulo"/);
});

test('veracidad: sin estadísticas, métricas de adopción ni promesas sobre Ranking/Nivel; sin aclaración inferior ni explicación de validación', () => {
  const text = section.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\d/, 'ningún número en el texto visible');
  assert.doesNotMatch(text, /ranking|nivel|puntos|usuarios|jugadores activos|%/i);
  assert.doesNotMatch(section, /Ilustración conceptual|bridge__note/, 'se retiró la aclaración inferior (decisión de Sebastián)');
  assert.doesNotMatch(css, /bridge__note/);
  assert.doesNotMatch(text, /valida|confirm/i, 'la validación se explica en la sección siguiente');
});

test('movimiento: base = estado final; animaciones solo con JS armado; reduced-motion sin pelota ni animaciones; sin propiedades de layout costosas', () => {
  assert.match(css, /\.bridge\.is-armed \.bs__vis[\s\S]*animation-play-state: paused/);
  assert.match(css, /\.bridge\.is-play \.bs__vis[\s\S]*animation-play-state: running/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.bridge__ball \{ display: none; \}\s*\.bridge\.is-armed \* \{ animation: none !important; \}/);
  assert.match(js, /if \(mq\.matches \|\| !\('IntersectionObserver' in window\)\) return;/, 'sin movimiento o sin IO: queda estático');
  assert.match(js, /classList\.add\('is-armed'\)/);
  const keyframes = css.split('/* Escritorio')[0].split('@keyframes').slice(1).join('\n'); // todo lo que está dentro de las @keyframes (previas al bloque de escritorio)
  assert.doesNotMatch(keyframes, /\b(width|height|margin|padding|top)\s*:/, 'solo transform/opacity/stroke/left del puntito');
  assert.match(css, /\.bridge \{[^}]*overflow: hidden/);
});

test('identidad: tokens existentes (lima/azul sobre azul noche), sin colores nuevos ni librerías', () => {
  const hexes = new Set((css.match(/#[0-9a-fA-F]{3,6}\b/g) || []).map((h) => h.toUpperCase()));
  assert.deepEqual([...hexes], ['#C9D3DE'], 'solo el refuerzo de alto contraste ya usado por la web');
  assert.doesNotMatch(js, /import |require\(|https?:\/\//);
});

test('integridad: hojas y scripts referenciados existen; hero, CTAs etiquetados y SEO intactos', () => {
  for (const f of ['public/css/puente.css', 'public/js/puente.js']) assert.ok(fs.existsSync(path.join(web, f)), f);
  assert.match(html, /<link rel="stylesheet" href="css\/puente\.css">/);
  assert.equal([...html.matchAll(/<script src="js\/puente\.js"><\/script>/g)].length, 1);
  assert.equal([...html.matchAll(/data-bramu-cta="/g)].map((m) => m.index).length >= 4, true);
  for (const cta of ['login', 'hero', 'instalacion', 'final']) assert.match(html, new RegExp(`data-bramu-cta="${cta}"`));
  assert.match(html, /<title>BRAMUlab · Donde vive tu pádel<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/bramulab\.com\/">/);
  assert.match(html, /<h1 class="hero__title" id="hero-titulo"/);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, 'un solo h1');
});

test('BRAMU Metrics intacto: un único script de medición, y la copia publicada es idéntica a la canónica', () => {
  assert.equal([...html.matchAll(/<script defer src="\/js\/web-metrics\.js"><\/script>/g)].length, 1);
  assert.equal(sha(read('public/js/web-metrics.js')), sha(read('js/web-metrics.js')), 'public/js/web-metrics.js == canónico');
  assert.match(read('public/js/web-metrics.js'), /app\.bramulab\.com/);
  assert.ok(fs.existsSync(path.join(web, 'api/metrics.js')));
});

test('cancha: VERTICAL con proporciones reales 10 × 20 m — red al centro, líneas de saque a 6,95 m de la red, línea central entre ellas', () => {
  const svg = section.slice(section.indexOf('<svg'), section.indexOf('</svg>'));
  const [x, y, w, h] = svg.match(/class="pv-line pv-wall" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/).slice(1).map(Number);
  assert.ok(h > w, 'vertical (más alta que ancha)');
  assert.equal(h / w, 2, 'largo : ancho = 2 : 1 (20 m × 10 m)');
  const netY = Number(svg.match(/pv-net" x1="\d+" y1="(\d+)"/)[1]);
  assert.equal(netY, y + h / 2, 'la red está justo en el centro del largo');
  const m = svg.match(/M(\d+) (\d+)h\d+M(\d+) (\d+)h\d+M(\d+) (\d+)v(\d+)/).slice(1).map(Number);
  const svcTop = m[1]; const svcBottom = m[3]; const centerX = m[4]; const centerY = m[5]; const centerLen = m[6];
  const mPerUnit = 20 / h;
  assert.ok(Math.abs((netY - svcTop) * mPerUnit - 6.95) < 0.2, 'línea de saque a ~6,95 m de la red (lado superior)');
  assert.ok(Math.abs((svcBottom - netY) * mPerUnit - 6.95) < 0.2, '… e inferior');
  assert.equal(centerY, svcTop, 'la línea central va de línea de saque a línea de saque');
  assert.equal(centerY + centerLen, svcBottom);
  assert.equal(centerX, x + w / 2, 'centrada');
  assert.ok(svg.includes('pv-fly'));
});

test('peloteo: la pelota cruza la red 4 veces (de un lado al otro), ~1 s por cruce, con altura propia y sombra', () => {
  const rally = css.slice(css.indexOf('@keyframes pv-rally'), css.indexOf('@keyframes pv-lob'));
  const ys = [...rally.matchAll(/translate\((-?\d+)(?:px)?, (-?\d+)(?:px)?\)/g)].map((m) => Number(m[2]));
  const sides = ys.map((v) => (v < -33 ? 'top' : 'bottom'));   // la red está a ~33 u. del fondo de la cancha
  let crossings = 0; for (let i = 1; i < sides.length; i += 1) if (sides[i] !== sides[i - 1]) crossings += 1;
  assert.equal(crossings, 4);
  const dur = Number(css.match(/\.pv-fly \{[^}]*--dur: ([\d.]+)s/)[1]);
  assert.ok(dur / crossings >= 0.9, `ritmo pausado: ${dur / crossings} s por cruce`);
  assert.match(css, /@keyframes pv-lob \{[\s\S]*scale\(1\.4\)/);
  assert.match(css, /@keyframes pv-shadow/);
});

/* ---- Bucles con pausa ---- */
function runPuente({ reduce, io = true }) {
  const classes = new Set(); const stageClasses = new Set(); const timers = []; let observer = null;
  const mk = (set) => ({ add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), contains: (c) => set.has(c) });
  const el = { classList: mk(classes), offsetWidth: 1 };
  const stage = { classList: mk(stageClasses) };
  const document = { getElementById: (id) => (id === 'puente' ? el : id === 'bridge-stage' ? stage : null), hidden: false, addEventListener() {} };
  const window = { matchMedia: () => ({ matches: reduce }) };
  if (io) window.IntersectionObserver = class { constructor(cb) { observer = cb; } observe() {} };
  const ctx = { window, document, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {}, IntersectionObserver: window.IntersectionObserver };
  ctx.globalThis = ctx;
  vm.runInNewContext(js, ctx);
  return { classes, stageClasses, timers, fire: (ratio) => observer([{ intersectionRatio: ratio }]) };
}

test('loop de la franja: secuencia → pausa ≈ 5 s → fundido → reinicio real; se suspende al salir de pantalla', () => {
  const r = runPuente({ reduce: false });
  assert.ok(r.classes.has('is-armed') && !r.classes.has('is-play'));
  r.fire(0.9);
  assert.ok(r.classes.has('is-play'), 'arranca al entrar en pantalla');
  const wait = r.timers[r.timers.length - 1].ms;
  assert.ok(wait >= 5500 + 4800 && wait <= 6100 + 5200, `secuencia + ~5 s de pausa (${wait} ms)`);
  r.timers[r.timers.length - 1].fn();
  assert.ok(r.stageClasses.has('is-fade'), 'fundido antes de reiniciar');
  r.timers[r.timers.length - 1].fn();
  assert.ok(r.classes.has('is-play') && r.classes.has('is-armed') && !r.stageClasses.has('is-fade'), 'reinicio: vuelve a correr');
  r.fire(0);
  assert.ok(!r.classes.has('is-play') && !r.stageClasses.has('is-fade'), 'fuera de pantalla: detenido');
  r.fire(0.9);           // vuelve: retoma desde cero
  for (let play = 1; play < 3; play += 1) { r.timers[r.timers.length - 1].fn(); r.timers[r.timers.length - 1].fn(); }   // 2.ª y 3.ª reproducción
  r.timers[r.timers.length - 1].fn();
  assert.ok(!r.stageClasses.has('is-fade') && r.classes.has('is-play'), 'tras la 3.ª vez no hay más fundido ni reinicio: queda en el estado final');
  const before = r.timers.length; r.fire(0.9);
  assert.equal(r.timers.length, before, 'sigue visible: no se vuelve a armar');
  r.fire(0); r.fire(0.9);
  assert.ok(r.classes.has('is-play') && r.timers.length > before, 'al salir y volver retoma desde cero');
  r.fire(0.9);
  assert.ok(r.classes.has('is-play'), 'vuelve a correr al regresar');
  assert.match(js, /el\.classList\.remove\('is-play', 'is-armed'\);\s*void el\.offsetWidth;\s*el\.classList\.add\('is-armed'\)/, 'reinicio real de las animaciones CSS');
  assert.match(js, /visibilitychange/);
});

test('movimiento reducido (y sin IntersectionObserver): la franja no se arma ni se repite; queda el estado final estático', () => {
  for (const opts of [{ reduce: true }, { reduce: false, io: false }]) {
    const r = runPuente(opts);
    assert.equal(r.classes.size, 0);
    assert.equal(r.timers.length, 0);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.bridge__ball \{ display: none; \}/);
});

test('tutorial «Cómo funciona»: las 4 demostraciones repiten en bucle (pausa ≈ 5 s, fundido, reinicio) y se detienen al desactivarse; movimiento reducido = estado final', () => {
  const demos = read('public/js/demos.js');
  assert.match(demos, /var LOOP_PAUSE = 5000, LOOP_FADE = 380, LOOP_MAX = 3;/);
  assert.match(demos, /if \(l\.n >= LOOP_MAX\) return;/, 'tope de 3 reproducciones por activación');
  assert.match(demos, /var SEQ_MS = \{ 1: 7800, 2: 6800, 3: 4300, 4: 9300 \};/);
  assert.match(demos, /function activate\(n\) \{[\s\S]*loopStop\(n\);[\s\S]*if \(reduced\(\)\) \{ d\.finish\(\); return; \}[\s\S]*loopPlay\(n\);/);
  assert.match(demos, /function deactivate\(n\) \{ loopStop\(n\);/);
  assert.match(demos, /function finish\(n\) \{ loopStop\(n\);/);
  assert.match(demos, /doc\.addEventListener\('visibilitychange'/, 'pestaña en segundo plano: se corta el ciclo');
  assert.match(read('public/css/demos.css'), /\.demo\.is-loopfade \{ opacity: 0 !important;/);
  // no se convierten en loops las demás animaciones (Home/Grupos/Nivel/Instalar siguen como estaban)
  for (const f of ['club.js', 'nivel.js', 'instalar.js']) assert.doesNotMatch(read(`public/js/${f}`), /LOOP_PAUSE|is-loopfade/);
});
