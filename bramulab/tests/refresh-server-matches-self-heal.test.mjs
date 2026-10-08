// BRAMUlab — Hotfix 27/09/2026 (handoff 37, self-healing de readyForValidation): guarda de
// regresión para la orquestación real dentro de refreshServerMatches (app.js).
// Ejecutar con: node --test bramulab/tests/refresh-server-matches-self-heal.test.mjs
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea — no es
// ejecutable en un `vm` sandbox (mismo límite documentado en b6-identity-resolve-sheet.test.mjs/
// login-resume-session.test.mjs). El comportamiento dinámico de detección de candidatos y de
// invocación a officializeMatch ya está cubierto de punta a punta en match-self-heal.test.mjs
// (el módulo puro real que refreshServerMatches consume, no un mock de él). Esta prueba es una
// guarda ESTÁTICA sobre el código fuente que confirma exactamente los 2 casos que dependen de
// la orquestación (no del cálculo puro):
//   #6 del handoff — éxito provoca una sola relectura canónica, sin volver a invocar el
//      self-heal sobre esa relectura (nunca recursivo, nunca polling);
//   #8 del handoff — el self-heal nunca dispara un toast de acción manual.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

/** Extrae el cuerpo de una función `async function <name>(...) {` hasta su `  }` de cierre en
 *  la misma columna (2 espacios) — mismo mecanismo que login-resume-session.test.mjs. */
function extractAsyncFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  async function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "async function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

test('SH está declarado como alias de window.PLMatchSelfHeal (match-self-heal.js)', () => {
  assert.match(appJs, /const SH = window\.PLMatchSelfHeal;/);
});

test('selfHealInFlightMatchIds es un Set persistido a nivel de módulo (guardia entre refrescos superpuestos)', () => {
  assert.match(appJs, /const selfHealInFlightMatchIds = new Set\(\);/);
});

test('refreshServerMatches invoca SH.runSelfHeal EXACTAMENTE una vez por corrida (nunca recursivo)', () => {
  const body = extractAsyncFunctionBody(appJs, 'refreshServerMatches');
  const matches = body.match(/SH\.runSelfHeal\(/g) || [];
  assert.equal(matches.length, 1, 'debe existir una única invocación a SH.runSelfHeal dentro de refreshServerMatches');
});

test('refreshServerMatches solo relee (Matches.getMyMatches) una vez más, y esa relectura queda gateada por healed.healedAny', () => {
  const body = extractAsyncFunctionBody(appJs, 'refreshServerMatches');
  const getMyMatchesCalls = body.match(/Matches\.getMyMatches\(/g) || [];
  assert.equal(getMyMatchesCalls.length, 2, 'debe haber exactamente 2 lecturas posibles: la inicial y, como máximo, una relectura post self-heal');

  const gateMatch = body.match(/if\s*\(healed\.healedAny\)\s*\{([\s\S]*?)\n\s*\}/);
  assert.ok(gateMatch, 'debe existir un guard explícito "if (healed.healedAny) { ... }"');
  assert.match(gateMatch[1], /Matches\.getMyMatches\(/, 'la segunda lectura debe vivir DENTRO del guard de healedAny, nunca incondicional');

  // La relectura post self-heal nunca debe volver a pasar por SH.runSelfHeal (self-heal
  // desactivado para esa reentrada, paso 5 del handoff) — ya lo confirma el test anterior
  // (una sola invocación total a SH.runSelfHeal en toda la función), pero se refuerza acá
  // buscando que el bloque de la relectura no contenga su propia llamada a runSelfHeal.
  assert.doesNotMatch(gateMatch[1], /runSelfHeal/, 'la relectura canónica no debe volver a invocar el self-heal');
});

test('refreshServerMatches nunca muestra un toast (el self-heal es silencioso, nunca "Partido confirmado" automático)', () => {
  const body = extractAsyncFunctionBody(appJs, 'refreshServerMatches');
  assert.doesNotMatch(body, /showToast\(/, 'un refresco (manual o self-heal) no debe disparar ningún toast de acción');
});
