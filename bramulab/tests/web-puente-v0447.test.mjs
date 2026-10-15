// BRAMUlab Web — franja «Jugás. Lo cargás. Empieza a sumar.» (puente entre el hero y «Cómo funciona»).
// Ejecutar con: node --test bramulab/tests/web-puente-v0447.test.mjs
// Fija por texto lo que no debe retroceder: ubicación, relato legible sin animaciones, sin datos inventados, movimiento reducido,
// y que hero / tutorial / CTAs / SEO / BRAMU Metrics queden intactos.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'bramulab-web');
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

test('relato: título aprobado y los tres momentos con texto real (se entiende sin animaciones)', () => {
  assert.match(section, /<h2 class="h2 bridge__title" id="bridge-titulo" data-reveal>Jugás\. Lo cargás\. <span class="accent">Empieza a sumar\.<\/span><\/h2>/);
  const keys = [...section.matchAll(/<p class="bs__k">([^<]+)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['Jugaste', 'Lo cargás', 'Empieza a contar']);
  assert.match(section, /<ol class="bridge__steps">/);
  assert.equal([...section.matchAll(/class="bs__vis" aria-hidden="true"/g)].length, 3, 'los dibujos son decorativos');
  assert.match(section, /id="puente" aria-labelledby="bridge-titulo"/);
});

test('veracidad: sin estadísticas, métricas de adopción ni promesas sobre Ranking/Nivel; la validación no se promete automática', () => {
  const text = section.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\d/, 'ningún número en el texto visible');
  assert.doesNotMatch(text, /ranking|nivel|puntos|usuarios|jugadores activos|%/i);
  assert.match(text, /al confirmarse/, 'las estadísticas llegan cuando el partido se confirma');
  assert.match(text, /Ilustración conceptual: no muestra datos de jugadores reales\./);
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
