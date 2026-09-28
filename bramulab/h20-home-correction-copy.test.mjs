import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

test('h20: carrusel usa copy neutral para corrección cuando el actor no está disponible', () => {
  assert.match(app, /label = 'CORRECCIÓN ABIERTA'/);
  assert.match(app, /Hay una corrección abierta en este partido\. Revisá el detalle\./);
  assert.doesNotMatch(app, /La otra pareja propuso una corrección\. Revisá el resultado\./);
});

test('h20: bundle/cache alineado', () => {
  assert.match(html, /app\.js\?v=04\.11-h20/);
  assert.match(store, /BUNDLE_VERSION = '04\.11-h20'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-11-h20'/);
  assert.match(version, /"bundle":\s*"04\.11-h20"/);
});
