import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8');

test('h16: Reportar un error conserva sentence case visual aunque btn-secondary sea uppercase global', () => {
  assert.match(html, /id="b6-report-error-btn"[^>]*>Reportar un error<\/button>/);
  assert.match(css, /#b6-report-error-btn\s*\{[^}]*text-transform:\s*none;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.01em;/s);
});

test('h16: bundle/cache quartet alineado', () => {
  assert.match(html, /app\.js\?v=04\.11-h16/);
  assert.match(store, /BUNDLE_VERSION = '04\.11-h16'/);
  assert.match(sw, /CACHE_NAME = 'bramulab-v04-11-h16'/);
  assert.match(sw, /styles\.css\?v=04\.11-h16/);
  assert.match(version, /"bundle": "04\.11-h16"/);
});
