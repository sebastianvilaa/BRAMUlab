import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

test('h15: comentarios HTML dentro del template de Ultimo partido no contienen backticks crudos', () => {
  const start = appJs.indexOf('function renderPlayerLastMatchCard');
  const end = appJs.indexOf('/** §9 — Actividad', start);
  assert.ok(start >= 0 && end > start, 'debe localizar renderPlayerLastMatchCard');
  const region = appJs.slice(start, end);
  // Auditoría Central h16 -> h17 — BUG REAL en esta misma guarda: `[\\s\\S]` (doble backslash)
  // es una clase de caracteres literal {\, s, S}, no "cualquier carácter" — nunca matcheaba un
  // comentario HTML real (con espacios/letras normales), así que `comments` quedaba SIEMPRE en
  // `[]` y el assert de abajo pasaba en falso, sin comprobar nada. `[\s\S]` (un solo backslash)
  // es el escape correcto para "cualquier carácter incluyendo saltos de línea" en JS.
  const comments = region.match(/<!--[\s\S]*?-->/g) || [];
  const offenders = comments.filter((comment) => comment.includes('`'));
  assert.deepEqual(offenders, [], 'un backtick crudo en un comentario HTML dentro del template puede cerrar el template literal y ejecutarse como JS');
});

// El quartet de bundle/cache hardcodeado a "04.11-h15" quedó superseded por el de la ronda
// vigente (ver h17-visual-regression.test.mjs) — cada ronda de bundle define su propio test de
// quartet contra el bundle QUE esa ronda produce, nunca uno fijo de una ronda ya pasada (además,
// esta versión tenía un bug real de escaping: `\\.`/`\\?` con doble backslash nunca podía matchear
// el HTML/JS real, así que fallaba desde el día uno, no solo por quedar desactualizada).
