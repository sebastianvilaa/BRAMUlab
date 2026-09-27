// BRAMUlab — Hotfix 27/09/2026 (handoff 37, self-healing de readyForValidation): guarda de
// regresión para bramulab/match-self-heal.js.
// Ejecutar con: node --test bramulab/match-self-heal.test.mjs
//
// match-self-heal.js es un IIFE UMD puro (sin red ni DOM propios, `officializeMatch` se recibe
// como dependencia) — se carga tal cual en un `vm.createContext` nuevo, mismo criterio que
// match-validation.test.mjs/match-level-engine.test.mjs. Cubre los 8 casos mínimos obligatorios
// del handoff §5 salvo el #6 (una sola relectura canónica) y el #8 (sin toast manual), que
// dependen de la orquestación real dentro de refreshServerMatches (app.js) y se cubren por
// separado en refresh-server-matches-self-heal.test.mjs (guarda estática sobre el código
// fuente, mismo mecanismo que login-resume-session.test.mjs).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSelfHeal() {
  const sandbox = {};
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, 'match-self-heal.js'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'match-self-heal.js' });
  return sandbox.PLMatchSelfHeal;
}

const SH = loadSelfHeal();

function candidate(overrides) {
  return Object.assign({
    matchId: 'm1',
    status: 'pending_validation',
    readyForValidation: true,
    hasOpenIdentityIssue: false,
  }, overrides);
}

test('match-self-heal.js se carga y expone runSelfHeal/isSelfHealCandidate/findSelfHealCandidateIds', () => {
  assert.ok(SH && typeof SH.runSelfHeal === 'function');
  assert.ok(typeof SH.isSelfHealCandidate === 'function');
  assert.ok(typeof SH.findSelfHealCandidateIds === 'function');
});

// Caso #1 del handoff.
test('pending_validation + readyForValidation=true dispara exactamente una invocación a officializeMatch', async () => {
  let calls = 0;
  const inFlight = new Set();
  const result = await SH.runSelfHeal([candidate()], {
    officializeMatch: async (matchId) => { calls += 1; assert.equal(matchId, 'm1'); return { ok: true, code: 'officialized', matchId }; },
    inFlightMatchIds: inFlight,
  });
  assert.equal(calls, 1);
  assert.equal(result.healedAny, true);
  // NOTA: nunca assert.deepEqual/deepStrictEqual sobre un array que el CÓDIGO DEL SANDBOX (vm)
  // construyó internamente — mismo criterio que match-validation.test.mjs: falla por prototipo
  // de Array distinto (otro realm) aunque el contenido sea idéntico. Se compara campo por campo.
  assert.equal(result.healedMatchIds.length, 1);
  assert.equal(result.healedMatchIds[0], 'm1');
  assert.equal(inFlight.size, 0, 'la guardia debe liberarse al terminar el intento');
});

// Caso #2 del handoff.
test('pending_validation + readyForValidation=false no dispara nada', async () => {
  let calls = 0;
  const result = await SH.runSelfHeal([candidate({ readyForValidation: false })], {
    officializeMatch: async () => { calls += 1; return { ok: true }; },
    inFlightMatchIds: new Set(),
  });
  assert.equal(calls, 0);
  assert.equal(result.healedAny, false);
  assert.equal(result.healedMatchIds.length, 0);
});

// Caso #3 del handoff.
test('una fila validated no dispara nada (aunque readyForValidation venga true)', async () => {
  let calls = 0;
  const result = await SH.runSelfHeal([candidate({ status: 'validated' })], {
    officializeMatch: async () => { calls += 1; return { ok: true }; },
    inFlightMatchIds: new Set(),
  });
  assert.equal(calls, 0);
  assert.equal(result.healedAny, false);
});

// Caso #4 del handoff.
test('una fila con identidad abierta no dispara self-heal', async () => {
  let calls = 0;
  const result = await SH.runSelfHeal([candidate({ hasOpenIdentityIssue: true })], {
    officializeMatch: async () => { calls += 1; return { ok: true }; },
    inFlightMatchIds: new Set(),
  });
  assert.equal(calls, 0);
  assert.equal(result.healedAny, false);
});

// Caso #5 del handoff — fallo de negocio ({ok:false}).
test('fallo de negocio del intento automático no crea loop ni segunda llamada en el mismo ciclo', async () => {
  let calls = 0;
  const inFlight = new Set();
  const result = await SH.runSelfHeal([candidate()], {
    officializeMatch: async (matchId) => { calls += 1; return { ok: false, code: 'officialize_failed', matchId }; },
    inFlightMatchIds: inFlight,
  });
  assert.equal(calls, 1);
  assert.equal(result.healedAny, false);
  assert.equal(result.healedMatchIds.length, 0);
  assert.equal(inFlight.size, 0, 'la guardia debe liberarse incluso ante un fallo de negocio');
});

// Caso #5 del handoff — excepción real (red caída), nunca debe propagarse ni colgar la promesa.
test('una excepción del intento automático se contiene (nunca se propaga, nunca cuelga la guardia)', async () => {
  let calls = 0;
  const inFlight = new Set();
  const result = await SH.runSelfHeal([candidate()], {
    officializeMatch: async () => { calls += 1; throw new Error('network down'); },
    inFlightMatchIds: inFlight,
  });
  assert.equal(calls, 1);
  assert.equal(result.healedAny, false);
  assert.equal(inFlight.size, 0);
});

// Caso #7 del handoff.
test('dos runSelfHeal concurrentes para el mismo matchId no duplican la oficialización', async () => {
  const inFlight = new Set();
  let calls = 0;
  let resolveOfficialize;
  const officializeMatch = (matchId) => {
    calls += 1;
    return new Promise((resolve) => { resolveOfficialize = resolve; }).then(() => ({ ok: true, code: 'officialized', matchId }));
  };
  const matches = [candidate()];

  // Sin ningún `await` entre estas dos líneas: reproduce el peor caso de refrescos superpuestos
  // (ver comentario de runSelfHeal en match-self-heal.js sobre por qué el check-and-add
  // síncrono alcanza igual aunque las dos corridas reales lleguen en ticks distintos).
  const p1 = SH.runSelfHeal(matches, { officializeMatch, inFlightMatchIds: inFlight });
  const p2 = SH.runSelfHeal(matches, { officializeMatch, inFlightMatchIds: inFlight });

  assert.equal(calls, 1, 'la segunda corrida no debe llamar a officializeMatch mientras la primera sigue en vuelo');
  resolveOfficialize();
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(calls, 1);
  assert.equal(r1.healedAny, true);
  assert.equal(r2.healedAny, false, 'la corrida que encontró el matchId ya en vuelo no debe reportarlo como sanado');
});

test('isSelfHealCandidate/findSelfHealCandidateIds: acepta undefined/null/no-array sin lanzar', () => {
  assert.equal(SH.isSelfHealCandidate(null), false);
  assert.equal(SH.isSelfHealCandidate(undefined), false);
  assert.equal(SH.findSelfHealCandidateIds(null).length, 0);
  assert.equal(SH.findSelfHealCandidateIds(undefined).length, 0);
  assert.equal(SH.findSelfHealCandidateIds([]).length, 0);
});
