// BRAMUlab — Ronda correctiva QA 26SEP: guarda de regresión para el falso onboarding al login
// (§15.24 "Login — falso retorno al onboarding de Nivel" de
// docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md).
// Ejecutar con: node --test bramulab/login-resume-session.test.mjs
//
// El bug real: Auth.fetchOwnProfile() (auth.js) devolvía un usuario válido con
// `levelState:null` tanto si level_states no existía de verdad como si la LECTURA de esa tabla
// fallaba de forma transitoria (red/RPC caída) — app.js#resumeServerSession no podía distinguir
// los dos casos y mandaba una cuenta YA oficializada de vuelta al onboarding
// (resumeSignupProfileStep -> resumeDraftFlow), como si fuera una cuenta nueva.
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea — no es
// ejecutable en un `vm` sandbox (mismo límite documentado en b6-identity-resolve-sheet.test.mjs).
// Esta prueba es una guarda ESTÁTICA sobre el código fuente: confirma que resumeServerSession
// revisa `levelStateReadFailed` y corta ANTES de tocar signupDraft/Store.cacheServerUser cuando
// la lectura falló — el comportamiento dinámico real de fetchOwnProfile() (auth.js, sí cargado
// en tests.html) está cubierto por los tests QA26SEP-LOGIN en tests.html.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const authJs = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

/** Extrae el cuerpo de una función `async function <name>(...) {` hasta su `  }` de cierre en
 *  la misma columna (2 espacios) — mismo mecanismo que b6-identity-resolve-sheet.test.mjs,
 *  adaptado a `async function` (resumeServerSession lo es). */
function extractAsyncFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  async function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "async function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

test('auth.js fetchOwnProfile expone levelStateReadFailed (contrato que resumeServerSession necesita para distinguir falla de ausencia real)', () => {
  assert.match(authJs, /levelStateReadFailed:\s*!!levelError/, 'fetchOwnProfile debe derivar levelStateReadFailed del error real de la query a level_states, nunca inventarlo');
});

test('resumeServerSession corta ANTES de cachear/onboarding cuando levelStateReadFailed (nunca falso onboarding por una falla transitoria)', () => {
  const body = extractAsyncFunctionBody(appJs, 'resumeServerSession');

  assert.match(body, /serverUser\.levelStateReadFailed/, 'debe revisar levelStateReadFailed en algún punto');

  const guardMatch = body.match(/if\s*\(!serverUser \|\| serverUser\.levelStateReadFailed\)\s*\{/);
  assert.ok(guardMatch, 'debe existir un guard temprano "if (!serverUser || serverUser.levelStateReadFailed)"');

  const cacheIdx = body.indexOf('Store.cacheServerUser(serverUser)');
  assert.ok(cacheIdx !== -1, 'debe seguir cacheando el usuario en el camino feliz');
  assert.ok(guardMatch.index < cacheIdx, 'el guard de falla debe ejecutarse ANTES de Store.cacheServerUser — nunca cachear un perfil con lectura de Nivel fallida');

  const onboardingIdx = body.indexOf('resumeSignupProfileStep(serverUser)');
  assert.ok(onboardingIdx !== -1, 'debe seguir existiendo el camino real de onboarding incompleto');
  assert.ok(guardMatch.index < onboardingIdx, 'el guard de falla debe ejecutarse ANTES de poder llegar a resumeSignupProfileStep — una falla de lectura nunca debe derivar a onboarding');

  // El guard debe intentar un reintento antes de rendirse (mejor esfuerzo ante un blip
  // transitorio) — nunca debe rendirse en el primer intento sin más.
  const firstFetchIdx = body.indexOf('await Auth.fetchOwnProfile()');
  const retryIdx = body.indexOf('await Auth.fetchOwnProfile()', firstFetchIdx + 1);
  assert.ok(retryIdx !== -1 && retryIdx < guardMatch.index, 'debe reintentar fetchOwnProfile() una vez cuando levelStateReadFailed, antes del guard final');
});
