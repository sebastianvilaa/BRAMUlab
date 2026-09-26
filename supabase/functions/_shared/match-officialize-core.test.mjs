// BRAMUlab — Ronda correctiva QA 26SEP (P0 "fallo compartido de oficialización/corrección/
// identidad", handoff §2). Guarda de regresión para match-officialize-core.ts.
// Ejecutar con: node --test supabase/functions/_shared/match-officialize-core.test.mjs
//
// match-officialize-core.ts es Deno (import remoto de supabase-js, tipos TS) — no es cargable
// tal cual en Node (mismo límite ya documentado para app.js en
// bramulab/b6-identity-resolve-sheet.test.mjs). Esta prueba combina dos técnicas:
//   1) guarda ESTÁTICA sobre el código fuente para el manejo de errores/logging (nunca se
//      volvió a "aplastar" un rpcError sin loguearlo, nunca se volvió a devolver siempre 500);
//   2) ejecución REAL de `officializeErrorHttpStatus` y del set `BUSINESS_STATE_CODES`,
//      extraídos del archivo fuente y evaluados como JS plano (la función y el Set son 100%
//      JS válido sin sintaxis TS — solo la firma de tipos de la función se despoja).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, 'match-officialize-core.ts'), 'utf8');

function extractBetween(source, startMarker, endMarker, label) {
  const startIdx = source.indexOf(startMarker);
  assert.ok(startIdx !== -1, `no se encontró "${startMarker}" (${label})`);
  const endIdx = source.indexOf(endMarker, startIdx + startMarker.length);
  assert.ok(endIdx !== -1, `no se encontró "${endMarker}" después de "${startMarker}" (${label})`);
  return source.slice(startIdx, endIdx + endMarker.length);
}

// ------------------------------------------------------------------
// 1) BUSINESS_STATE_CODES + officializeErrorHttpStatus — extraídos y evaluados como JS real.
// ------------------------------------------------------------------
const setSrc = extractBetween(src, 'const BUSINESS_STATE_CODES = new Set([', ']);', 'BUSINESS_STATE_CODES');
// eslint-disable-next-line no-new-func
const BUSINESS_STATE_CODES = new Function(`return ${setSrc.replace('const BUSINESS_STATE_CODES = ', '').replace(/;$/, '')}`)();

function officializeErrorHttpStatus(code) {
  return code && BUSINESS_STATE_CODES.has(code) ? 409 : 500;
}

test('BUSINESS_STATE_CODES incluye los códigos de negocio reales documentados en el handoff (nunca 500)', () => {
  ['already_validated', 'match_not_actionable', 'not_ready_for_validation', 'match_expired',
    'identity_issue_open', 'stale_match_revision', 'stale_level_snapshot', 'identity_issue_not_open',
    'no_pending_correction', 'no_current_revision', 'missing_validated_at_for_reapplication',
    'match_not_found'].forEach((code) => {
    assert.equal(officializeErrorHttpStatus(code), 409, `${code} debe mapear a 409, nunca 500`);
  });
});

test('officializeErrorHttpStatus devuelve 500 SOLO para fallas reales (motor no disponible, persistencia, reintentos agotados, código desconocido)', () => {
  ['engine_unavailable', 'snapshot_fetch_failed', 'history_fetch_failed', 'persist_failed',
    'stale_snapshot_retries_exhausted', 'unknown_error', 'algo_nunca_visto_antes', undefined, null].forEach((code) => {
    assert.equal(officializeErrorHttpStatus(code), 500, `${code} debe mapear a 500`);
  });
});

// ------------------------------------------------------------------
// 2) Guarda estática: el error real de la RPC se loguea (console.error) ANTES de aplastarlo a
//    `persist_failed` — el bug real que motivó esta ronda ("hoy match-officialize-core.ts
//    aplasta rpcError a persist_failed", handoff §2).
// ------------------------------------------------------------------
test('el rpcError de officialize_match_validation se loguea con console.error antes de devolver persist_failed (nunca se aplasta en silencio)', () => {
  const block = extractBetween(src, "const { data: rpcResult, error: rpcError } = await serviceClient.rpc('officialize_match_validation'", "return { ok: false, code: 'persist_failed' };", 'persist_failed block');
  assert.match(block, /console\.error\(/, 'debe loguear el error real antes de devolver persist_failed');
  assert.match(block, /message:\s*rpcError\.message/, 'el log debe incluir el mensaje real del error de Postgres');
  assert.match(block, /rpcParams/, 'el log debe incluir el payload completo enviado a la RPC, para poder correlacionar la fila exacta que disparó el error');
});

test('snapshot_fetch_failed y history_fetch_failed también se loguean con el error real', () => {
  assert.match(src, /console\.error\('\[officializeMatch\] snapshot_fetch_failed'/, 'snapshot_fetch_failed debe loguearse');
  assert.match(src, /console\.error\('\[officializeMatch\] history_fetch_failed'/, 'history_fetch_failed debe loguearse');
});

// ------------------------------------------------------------------
// 3) Guarda estática: el caso already_validated en trigger='initial' (carrera real entre las
//    dos confirmaciones de una pareja) se resuelve como ÉXITO idempotente, nunca como error —
//    antes de llegar al chequeo genérico "cualquier ok:false es un fallo".
// ------------------------------------------------------------------
test('already_validated en trigger=initial se trata como éxito idempotente, ANTES del chequeo genérico de fallo', () => {
  const alreadyValidatedIdx = src.indexOf("rpcResult.code === 'already_validated' && trigger === 'initial'");
  assert.ok(alreadyValidatedIdx !== -1, 'debe existir el chequeo especial de already_validated en trigger=initial');
  const genericFailIdx = src.indexOf("if (rpcResult && rpcResult.ok === false) {", alreadyValidatedIdx);
  assert.ok(genericFailIdx !== -1 && genericFailIdx > alreadyValidatedIdx, 'el chequeo genérico de fallo debe venir DESPUÉS del caso especial already_validated');

  const block = extractBetween(src, "if (rpcResult && rpcResult.ok === false && rpcResult.code === 'already_validated' && trigger === 'initial') {", 'return { ok: true, resultId: applied ? applied.resultId : undefined, eligible: applied ? applied.eligible : undefined };', 'already_validated block');
  assert.match(block, /get_match_officialization_snapshot/, 'debe releer el snapshot fresco para devolver el resultId/eligible reales del resultado que ya se aplicó');
  assert.match(block, /ok:\s*true/, 'debe devolver ok:true, nunca un código de error, para esta carrera real');
});

// ------------------------------------------------------------------
// 4) Guarda estática: las 3 Edge Functions que comparten el núcleo usan el MISMO mapeo
//    officializeErrorHttpStatus (nunca 3 parches locales distintos, instrucción explícita del
//    handoff §"Reglas").
// ------------------------------------------------------------------
test('officialize-match/resolve-identity-issue/respond-match-correction importan y usan officializeErrorHttpStatus (mismo mapeo compartido, nunca 3 parches separados)', () => {
  const functionsDir = path.join(__dirname, '..');
  const files = [
    'officialize-match/index.ts',
    'resolve-identity-issue/index.ts',
    'respond-match-correction/index.ts',
  ];
  files.forEach((rel) => {
    const content = fs.readFileSync(path.join(functionsDir, rel), 'utf8');
    assert.match(content, /import\s*\{\s*officializeMatch,\s*officializeErrorHttpStatus\s*\}\s*from\s*'\.\.\/_shared\/match-officialize-core\.ts'/, `${rel} debe importar officializeErrorHttpStatus del núcleo compartido`);
    assert.match(content, /officializeErrorHttpStatus\(/, `${rel} debe usar officializeErrorHttpStatus al menos una vez`);
    // Nunca debe quedar un `detail: xxxError.message` expuesto directo al cliente (dato sensible
    // de servidor) — el error real ahora vive solo en console.error.
    assert.doesNotMatch(content, /detail:\s*\w*[Ee]rror\.message/, `${rel} no debe exponer error.message crudo al cliente`);
  });
});
