import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

test('h16: Reportar un error conserva sentence case visual aunque btn-secondary sea uppercase global', () => {
  assert.match(html, /id="b6-report-error-btn"[^>]*>Reportar un error<\/button>/);
  assert.match(css, /#b6-report-error-btn\s*\{[^}]*text-transform:\s*none;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*0\.01em;/s);
});

// El quartet de bundle/cache hardcodeado a "04.11-h16" quedó superseded por el de la ronda
// vigente — ver h17-visual-regression.test.mjs para el quartet de 04.11-h17.
