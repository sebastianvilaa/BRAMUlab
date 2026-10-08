import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// SUPERSEDIDO en el sistema visual unificado h21 (doc 59, puntos 6/7/8): "Reportar un error" ya
// no usa `.btn-secondary`/`.btn-secondary--danger` (que forzaba mayúsculas, de ahí el override
// puntual que este test verificaba) — pasa a `.b6-correction-choice--report`, que nunca fuerza
// mayúsculas para empezar. Ver h21-sistema-visual-unificado.test.mjs para la guarda vigente.
test('h16/h21: Reportar un error sigue en sentence case (nunca todo mayúsculas)', () => {
  assert.match(html, /id="b6-report-error-btn"[^>]*>Reportar un error<\/button>/);
  const rule = css.match(/\.b6-correction-choice\{([^}]*)\}/);
  assert.ok(rule, 'debe existir la clase base compartida por Reportar un error/Confirmar/Aceptar/Mantener');
  assert.doesNotMatch(rule[1], /text-transform/, 'la clase base nunca debe forzar mayúsculas');
});

// El quartet de bundle/cache hardcodeado a "04.11-h16" quedó superseded por el de la ronda
// vigente — ver h17-visual-regression.test.mjs para el quartet de 04.11-h17.
