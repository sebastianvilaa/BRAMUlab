// BRAMUlab — Fix P0 precisión (handoff 23 §7, "segundo hallazgo"): guarda de regresión para
// PLMatchValidation.invokeB6Function (bramulab/match-validation.js).
// Ejecutar con: node --test bramulab/tests/match-validation.test.mjs
//
// match-validation.js es un IIFE UMD que solo toca `global.PLAuth` en tiempo de LLAMADA (nunca
// en tiempo de carga, a diferencia de app.js) — se puede cargar tal cual en un contexto `vm`
// nuevo, mismo criterio que match-level-engine.test.mjs. `invokeB6Function` se testea
// directamente con un cliente Supabase fabricado (`c.functions.invoke`) que simula los 3
// contratos reales de supabase-js v2: éxito 2xx, `FunctionsHttpError` con un body JSON de
// negocio recuperable vía `error.context.json()`, y los casos donde ese body NO puede leerse
// (error de red/relay, o un body que no es JSON) — el fallback debe seguir siendo seguro.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)

function loadMatchValidation() {
  const sandbox = {};
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, 'match-validation.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'match-validation.js' });
  return sandbox.PLMatchValidation;
}

const MV = loadMatchValidation();

test('match-validation.js se carga y expone invokeB6Function', () => {
  assert.ok(MV && typeof MV.invokeB6Function === 'function');
});

/** Cliente Supabase fabricado — `c.functions.invoke` responde exactamente lo que el test le
 *  pide, sin ningún SDK real de por medio (mismo criterio que los clientes fabricados de
 *  auth.js en tests.html, QA26SEP-PLAYERS/MISJUGADORES). */
function fakeClient(invokeResult) {
  return { functions: { invoke: async () => invokeResult } };
}

// NOTA: los asserts comparan campo por campo (nunca assert.deepEqual/deepStrictEqual completo)
// porque match-validation.js corre en un vm.createContext propio (mismo criterio que match-
// level-engine.test.mjs) — un objeto {} que EL CÓDIGO DEL SANDBOX construye internamente vive
// en ese realm y falla deepStrictEqual contra un literal del realm principal por prototipo
// distinto, aunque el contenido sea idéntico. Comparar campo por campo evita ese falso negativo.

test('invokeB6Function: sin error, devuelve data tal cual (2xx normal)', async () => {
  const c = fakeClient({ data: { ok: true, code: 'officialized', matchId: 'm1' }, error: null });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'officialized');
  assert.equal(result.matchId, 'm1');
});

test('invokeB6Function: sin error pero data vacío/no-objeto -> {ok:false, code:"unknown"} (nunca undefined)', async () => {
  const c = fakeClient({ data: null, error: null });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'unknown');
});

test('invokeB6Function: FunctionsHttpError con body JSON de negocio real -> recupera el code real vía error.context.json(), nunca error.message genérico', async () => {
  // Reproduce el caso exacto del handoff §7: un 409 real con {ok:false, code:'match_expired'}
  // que supabase-js NO expone en `data` para una respuesta non-2xx — la Edge Function
  // efectivamente puso ese código en el body de la respuesta HTTP, no en `data`.
  const c = fakeClient({
    data: null,
    error: {
      name: 'FunctionsHttpError',
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ ok: false, code: 'match_expired' }) },
    },
  });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'match_expired', 'debe devolver el code REAL del body, nunca degradar a error.message');
});

test('invokeB6Function: FunctionsHttpError con body JSON de negocio -> también funciona para resolve-identity-issue/respond-match-correction/propose-match-correction (mismo helper, un solo parche)', async () => {
  const c = fakeClient({
    data: null,
    error: { name: 'FunctionsHttpError', message: 'non-2xx', context: { json: async () => ({ ok: false, code: 'identity_issue_not_open' }) } },
  });
  const result = await MV.invokeB6Function(c, 'resolve-identity-issue', { issueId: 'i1' });
  assert.equal(result.code, 'identity_issue_not_open');
});

test('invokeB6Function: error.context.json() rechaza (body no era JSON) -> fallback seguro a error.message, nunca propaga la excepción de parseo', async () => {
  const c = fakeClient({
    data: null,
    error: {
      name: 'FunctionsHttpError',
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } },
    },
  });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'Edge Function returned a non-2xx status code');
});

test('invokeB6Function: error sin context (FunctionsFetchError/error de red) -> fallback directo a error.message, nunca intenta leer .json()', async () => {
  const c = fakeClient({
    data: null,
    error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' },
  });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'Failed to send a request to the Edge Function');
});

test('invokeB6Function: body de negocio parseable pero SIN campo code -> no lo usa como si fuera de negocio, cae al fallback', async () => {
  const c = fakeClient({
    data: null,
    error: { name: 'FunctionsHttpError', message: 'non-2xx real', context: { json: async () => ({ some: 'unrelated shape' }) } },
  });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'non-2xx real');
});

test('invokeB6Function: nunca expone detail/hint del body de error al resultado devuelto', async () => {
  const c = fakeClient({
    data: null,
    error: {
      name: 'FunctionsHttpError', message: 'non-2xx',
      context: { json: async () => ({ ok: false, code: 'persist_failed', detail: 'duplicate key value violates unique constraint "xyz_pkey"' }) },
    },
  });
  const result = await MV.invokeB6Function(c, 'officialize-match', { matchId: 'm1' });
  // El helper no filtra el body de negocio real (eso ya viene sin detail/hint desde el servidor,
  // ver match-officialize-core.ts de la ronda anterior) — pero si algún día un caller viejo
  // todavía manda `detail`, este test documenta que NO es responsabilidad de este helper
  // censurarlo dos veces; lo que sí garantiza es que nunca se agrega uno nuevo desde
  // error.message/error.hint cuando el body sí trae un code real.
  assert.equal(result.code, 'persist_failed');
});

test('officializeMatch/proposeMatchCorrection/respondMatchCorrection/resolveIdentityIssue usan invokeB6Function (mismo helper, nunca 4 parches separados)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'match-validation.js'), 'utf8');
  ['officializeMatch', 'proposeMatchCorrection', 'respondMatchCorrection', 'resolveIdentityIssue'].forEach((fnName) => {
    const fnMatch = src.match(new RegExp(`async function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
    assert.ok(fnMatch, `no se encontró la función ${fnName}`);
    assert.match(fnMatch[0], /invokeB6Function\(/, `${fnName} debe llamar a invokeB6Function, no reimplementar el parseo de error`);
    assert.doesNotMatch(fnMatch[0], /c\.functions\.invoke\(/, `${fnName} no debe llamar a c.functions.invoke directo — eso es responsabilidad exclusiva de invokeB6Function`);
  });
});
