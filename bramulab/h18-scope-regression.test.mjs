import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

test('h18: solo CORRECCIÓN PENDIENTE se muda a row2; otros estados conservan el badge bajo fecha/hora', () => {
  assert.match(app, /const correctionStatusHTML = hasActiveCorrectionOnLastMatch/);
  assert.match(app, /const otherStatusText = hasActiveCorrectionOnLastMatch \? '' : serverMatchStatusLabel\(m\)/);
  assert.match(app, /player-home-lastmatch__badge-slot/);
  assert.match(app, /player-home-lastmatch__status-slot[^\n]*\$\{correctionStatusHTML\}/);
  assert.match(css, /\.player-home-lastmatch__badge-slot\{[^}]*justify-content:\s*flex-end/);
});

test('h18: bundle/cache quartet alineado', () => {
  assert.match(html, /app\.js\?v=04\.11-h18/);
  assert.match(html, /styles\.css\?v=04\.11-h18/);
  assert.match(store, /BUNDLE_VERSION = '04\.11-h18'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-11-h18'/);
  assert.match(version, /"bundle":\s*"04\.11-h18"/);
});
