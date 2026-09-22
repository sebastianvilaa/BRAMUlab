// BRAMUlab — Bloque 6 (hotfix Resumen): guarda de regresión para la apertura/cierre visual de
// `#identity-resolve-scrim` (18_Handoff_Revalidacion_Hotfix_Resumen_Work.md, Caso 2 BLOQUEADO) y
// de `#propose-correction-scrim` (mismo patrón incompleto, encontrado por inspección de código
// durante ese hotfix — 19_Handoff_Revalidacion_Hotfix_Identidad_Work.md, nota final).
// Ejecutar con: node --test bramulab/b6-identity-resolve-sheet.test.mjs
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea (fetch de
// `env.generated.js`, `addEventListener('DOMContentLoaded', ...)`, etc.) — no es cargable en un
// `vm` sandbox como los módulos compartidos de match-level-engine.test.mjs (sin DOM real, sin
// backend, no hay forma segura de ejecutarlo aislado). Por eso esta prueba es una guarda
// ESTÁTICA sobre el código fuente, no una ejecución: extrae el cuerpo exacto de cada par
// open/close y confirma que siguen el mismo patrón `hidden` + `is-open` que el resto de los
// ~11 sheets de `.sheet-scrim` (ver `load-player-sheet-scrim` en el mismo archivo) — el bug real
// era que el scrim solo alternaba `hidden`, sin agregar/quitar `is-open`, así que quedaba en el
// DOM con `opacity:0` y la hoja desplazada fuera de pantalla (`transform: translateY(100%)`, CSS
// en styles.css).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

/** Extrae el cuerpo de una función declarada como `  function <name>(...) {` hasta su `  }`
 *  de cierre en la misma columna (2 espacios) — mismo estilo de indentación que el resto de
 *  las funciones top-level de la IIFE en todo este archivo. */
function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

test('openIdentityResolveSheet quita hidden y agrega is-open (mismo patrón que los demás .sheet-scrim)', () => {
  const body = extractFunctionBody(appJs, 'openIdentityResolveSheet');
  assert.match(body, /#identity-resolve-scrim['"]\)\.hidden = false/, 'debe quitar hidden del scrim');
  assert.match(body, /identity-resolve-scrim['"]\)\.classList\.add\(['"]is-open['"]\)/, 'debe agregar la clase is-open — sin esto el scrim queda con opacity:0 y la hoja fuera de pantalla (translateY)');
});

test('closeIdentityResolveSheet quita is-open antes de volver a poner hidden', () => {
  const body = extractFunctionBody(appJs, 'closeIdentityResolveSheet');
  assert.match(body, /classList\.remove\(['"]is-open['"]\)/, 'debe quitar la clase is-open al cerrar');
  assert.match(body, /hidden = true/, 'debe volver a ocultar el scrim tras la transición');
  const removeIdx = body.indexOf("classList.remove('is-open')");
  const hiddenIdx = body.indexOf('hidden = true');
  assert.ok(removeIdx !== -1 && hiddenIdx !== -1 && removeIdx < hiddenIdx, 'is-open debe quitarse ANTES de ocultar (para que la transición de cierre sea visible, mismo orden que load-player-sheet-scrim)');
});

test('openProposeCorrection quita hidden y agrega is-open (mismo patrón que los demás .sheet-scrim)', () => {
  const body = extractFunctionBody(appJs, 'openProposeCorrection');
  assert.match(body, /#propose-correction-scrim['"]\)\.hidden = false/, 'debe quitar hidden del scrim');
  assert.match(body, /propose-correction-scrim['"]\)\.classList\.add\(['"]is-open['"]\)/, 'debe agregar la clase is-open — sin esto el scrim queda con opacity:0 y la hoja fuera de pantalla (translateY)');
});

test('closeProposeCorrection quita is-open antes de volver a poner hidden', () => {
  const body = extractFunctionBody(appJs, 'closeProposeCorrection');
  assert.match(body, /classList\.remove\(['"]is-open['"]\)/, 'debe quitar la clase is-open al cerrar');
  assert.match(body, /hidden = true/, 'debe volver a ocultar el scrim tras la transición');
  const removeIdx = body.indexOf("classList.remove('is-open')");
  const hiddenIdx = body.indexOf('hidden = true');
  assert.ok(removeIdx !== -1 && hiddenIdx !== -1 && removeIdx < hiddenIdx, 'is-open debe quitarse ANTES de ocultar (para que la transición de cierre sea visible, mismo orden que load-player-sheet-scrim)');
});
