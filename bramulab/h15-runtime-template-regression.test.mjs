import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const storeJs = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const swJs = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const versionJson = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

test('h15: comentarios HTML dentro del template de Ultimo partido no contienen backticks crudos', () => {
  const start = appJs.indexOf('function renderPlayerLastMatchCard');
  const end = appJs.indexOf('/** §9 — Actividad', start);
  assert.ok(start >= 0 && end > start, 'debe localizar renderPlayerLastMatchCard');
  const region = appJs.slice(start, end);
  const comments = region.match(/<!--[\\s\\S]*?-->/g) || [];
  const offenders = comments.filter((comment) => comment.includes('`'));
  assert.deepEqual(offenders, [], 'un backtick crudo en un comentario HTML dentro del template puede cerrar el template literal y ejecutarse como JS');
});

test('h15: bundle/cache quartet queda alineado', () => {
  assert.match(indexHtml, /app\\.js\\?v=04\\.11-h15/);
  assert.match(storeJs, /BUNDLE_VERSION = '04\\.11-h15'/);
  assert.match(swJs, /CACHE_NAME = 'bramulab-v04-11-h15'/);
  assert.match(swJs, /app\\.js\\?v=04\\.11-h15/);
  assert.match(versionJson, /"bundle": "04\\.11-h15"/);
});
