import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

test('h20: carrusel usa copy neutral para corrección cuando el actor no está disponible', () => {
  assert.match(app, /label = 'CORRECCIÓN ABIERTA'/);
  assert.match(app, /Hay una corrección abierta en este partido\. Revisá el detalle\./);
  assert.doesNotMatch(app, /La otra pareja propuso una corrección\. Revisá el resultado\./);
});

// El quartet de bundle/cache hardcodeado a "04.11-h20" quedó superseded por el de la ronda
// vigente — ver h21-sistema-visual-unificado.test.mjs para el quartet de 04.11-h21.
