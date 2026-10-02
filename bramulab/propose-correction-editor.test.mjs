// BRAMUlab — Ronda correctiva Laboratorio h11 (§P2 "bug funcional del editor de corrección de
// sets", docs/BRAMUlab/Implementacion/Pre_Production/40_Handoff_Ronda_Correctiva_Laboratorio_h11_27SEP.md).
// Ejecutar con: node --test bramulab/propose-correction-editor.test.mjs
//
// Bug real reportado en el Laboratorio físico (05_Laboratorio_UX_Uso_Real.md §15.33):
//   Caso A — set existente 2-6, se modifica solo el lado "2" a "3": la UI muestra 3-6, pero
//            ENVIAR CORRECCIÓN no habilitaba hasta volver a tocar manualmente el 6.
//   Caso B — set existente 3-6, se quiere invertir a 6-4 editando PRIMERO el lado que tenía 3:
//            el dígito "6" aparecía deshabilitado en el teclado porque el lado contrario todavía
//            tenía el 6 viejo.
// Causa real: `updateProposeCorrectionKeypadKeysState`/`advanceProposeCorrectionDraftSide` (y sus
// mellizas `updateManualKeypadKeysState`/`advanceDraftSide` de Cargar partido, mismo bug) siempre
// trataban el valor YA CARGADO del lado contrario como una restricción dura/definitiva, aunque
// ese valor fuera el viejo de ANTES de esta pasada de edición (reapertura de un set ya completo).
//
// app.js es un único IIFE que asume `document`/`window` reales desde la primera línea — no es
// ejecutable en un `vm` sandbox (mismo límite documentado en b6-identity-resolve-sheet.test.mjs/
// login-resume-session.test.mjs). Esta prueba combina dos capas:
//   1) una guarda ESTÁTICA sobre el código fuente de app.js: confirma que el fix
//      (`b6CorrectionSideEntered`/`manualSideEntered`) sigue presente y en el orden correcto;
//   2) una simulación DINÁMICA del mismo algoritmo (idéntico, línea por línea, al de app.js) que
//      SÍ puede ejecutarse fuera del DOM, contra las funciones puras reales de match-load.js/
//      engine.js (`ML.computeValidNextDigits`/`ML.canExtendSetDigits`/`E.isValidCompletedSetScore`,
//      sin ningún doble/mock) — reproduce los dos casos reportados y una regresión de alta nueva.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

function extractFunctionBody(source, name) {
  const startMatch = source.match(new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n`));
  assert.ok(startMatch, `no se encontró "function ${name}(...)" en app.js`);
  const bodyStart = startMatch.index + startMatch[0].length;
  const closeIdx = source.indexOf('\n  }\n', bodyStart);
  assert.ok(closeIdx !== -1, `no se encontró el cierre de ${name} en app.js`);
  return source.slice(bodyStart, closeIdx);
}

/* ---- Capa 1: guarda estática sobre app.js (Proponer corrección + Cargar partido, mellizas) ---- */

for (const [prefix, sideEnteredVar] of [['Propose', 'b6CorrectionSideEntered'], ['', 'manualSideEntered']]) {
  const advanceFn = prefix ? 'advanceProposeCorrectionDraftSide' : 'advanceDraftSide';
  const keysFn = prefix ? 'updateProposeCorrectionKeypadKeysState' : 'updateManualKeypadKeysState';
  const commitDigitsFn = prefix ? 'commitProposeCorrectionDraftDigits' : 'commitDraftDigits';

  test(`${advanceFn} ya NO fuerza siempre abrir el otro lado tras completar el activo — solo cuando el otro lado no tiene valor`, () => {
    const body = extractFunctionBody(appJs, advanceFn);
    // Propose (corrección) conserva la regla h11 por valor real; Cargar partido pasa en V04.25 a "otro lado ya
    // (re)ingresado en esta pasada" (la unidad de edición es el set completo).
    const re = prefix ? /if\s*\(!Number\.isFinite\(/ : /if \(!manualSideEntered\[otherSide\]\)/;
    assert.match(body, re, `${advanceFn} debe decidir según el estado del otro lado, no según qué lado está activo`);
    assert.doesNotMatch(body, /if\s*\(\w+ === 'A'\)\s*\{\s*open\w*Keypad\('B'\); return; \}/, `${advanceFn} no debe volver a la versión vieja (siempre abre B si el activo es A)`);
  });

  test(`${keysFn} solo usa el valor del otro lado como restricción si ya fue reafirmado en esta edición (${sideEnteredVar})`, () => {
    const body = extractFunctionBody(appJs, keysFn);
    assert.match(body, new RegExp(`${sideEnteredVar}\\[otherSide\\] \\? \\w*Draft\\w*\\[otherSide\\] : undefined`), `${keysFn} debe leer ${sideEnteredVar} antes de fijar otherValue`);
  });

  test(`${commitDigitsFn} marca el lado como reafirmado (${sideEnteredVar}) al confirmar sus dígitos`, () => {
    const body = extractFunctionBody(appJs, commitDigitsFn);
    assert.match(body, new RegExp(`${sideEnteredVar}\\[`), `${commitDigitsFn} debe marcar ${sideEnteredVar} para el lado que acaba de confirmar`);
  });
}

test('reopenProposeCorrectionSet resetea b6CorrectionSideEntered al reabrir un set ya cargado', () => {
  const body = extractFunctionBody(appJs, 'reopenProposeCorrectionSet');
  assert.match(body, /b6CorrectionSideEntered = \{ a: false, b: false \}/, 'reabrir un set debe tratar ambos lados como "todavía no reafirmados en esta pasada"');
});

test('reopenManualSet resetea manualSideEntered al reabrir un set ya cargado', () => {
  const body = extractFunctionBody(appJs, 'reopenManualSet');
  assert.match(body, /manualSideEntered = \{ a: false, b: false \}/, 'reabrir un set debe tratar ambos lados como "todavía no reafirmados en esta pasada"');
});

/* ---- Capa 2: simulación dinámica contra las funciones puras REALES de match-load.js/engine.js ---- */

function loadPureModules() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), sandbox, { filename: 'engine.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'match-load.js'), 'utf8'), sandbox, { filename: 'match-load.js' });
  return { E: sandbox.PLEngine, ML: sandbox.PLMatchLoad };
}

const { E, ML } = loadPureModules();
const format = E.FORMATS.classic;

/** Reproduce, función por función, el algoritmo de app.js tras el fix (nombres de variables
 *  deliberadamente alineados con b6Correction.../manual... de app.js para que un lector pueda
 *  comparar ambos lado a lado). */
function makeEditor() {
  const st = { draftSet: { a: undefined, b: undefined }, sideEntered: { a: false, b: false }, activeTeam: 'A', keypadOpen: false, keypadDigits: '', decided: false };
  function allowedDigitsNow() {
    const otherSide = st.activeTeam === 'A' ? 'b' : 'a';
    const otherValue = st.sideEntered[otherSide] ? st.draftSet[otherSide] : undefined;
    return new Set(ML.computeValidNextDigits('', format, otherValue));
  }
  function openKeypad(team) { if (st.keypadOpen) commitDigits(); st.activeTeam = team; st.keypadOpen = true; st.keypadDigits = ''; }
  function commitDigits() {
    if (!st.keypadOpen || !st.keypadDigits) return;
    st.draftSet[st.activeTeam === 'A' ? 'a' : 'b'] = Number(st.keypadDigits);
    st.sideEntered[st.activeTeam === 'A' ? 'a' : 'b'] = true;
    st.keypadDigits = '';
  }
  function closeKeypad() { commitDigits(); st.keypadOpen = false; st.keypadDigits = ''; }
  function commitSetIfValid() {
    if (st.decided) return;
    if (!Number.isFinite(st.draftSet.a) || !Number.isFinite(st.draftSet.b)) return;
    if (!E.isValidCompletedSetScore(st.draftSet.a, st.draftSet.b, format)) return;
    st.decided = true;
  }
  function advanceSide() {
    const otherSide = st.activeTeam === 'A' ? 'b' : 'a';
    if (!Number.isFinite(st.draftSet[otherSide])) { openKeypad(otherSide === 'a' ? 'A' : 'B'); return; }
    closeKeypad();
    commitSetIfValid();
  }
  function pressKey(key) {
    const otherSide = st.activeTeam === 'A' ? 'b' : 'a';
    const otherValue = st.sideEntered[otherSide] ? st.draftSet[otherSide] : undefined;
    assert.ok(allowedDigitsNow().has(key), `dígito ${key} debería estar habilitado para el lado ${st.activeTeam} (otherValue=${otherValue})`);
    st.keypadDigits += key;
    if (!ML.canExtendSetDigits(st.keypadDigits, format, otherValue)) { commitDigits(); advanceSide(); return; }
  }
  function reopen(existing) { st.decided = false; st.draftSet = existing ? { a: existing.a, b: existing.b } : { a: undefined, b: undefined }; st.sideEntered = { a: false, b: false }; st.activeTeam = 'A'; st.keypadOpen = false; }
  return { st, allowedDigitsNow, openKeypad, pressKey, reopen };
}

test('Caso A del Laboratorio (§15.33): reabrir 2-6 y tocar solo el lado A (2->3) habilita CTA sin re-tocar el 6', () => {
  const ed = makeEditor();
  ed.reopen({ a: 2, b: 6 });
  ed.openKeypad('A');
  ed.pressKey('3');
  assert.equal(ed.st.draftSet.a, 3);
  assert.equal(ed.st.draftSet.b, 6, 'el lado no tocado conserva su valor existente');
  assert.equal(ed.st.decided, true, 'el set debe darse por completo sin exigir re-tocar el lado ya válido');
});

test('Caso B del Laboratorio (§15.33): reabrir 3-6 e invertir a 6-4 empezando por el lado que tenía 3', () => {
  const ed = makeEditor();
  ed.reopen({ a: 3, b: 6 });
  ed.openKeypad('A'); // el lado que tenía "3"
  assert.ok(ed.allowedDigitsNow().has('6'), '"6" debe estar habilitado aunque el lado contrario todavía tenga el 6 viejo');
  ed.pressKey('6'); // par transitorio 6-6 (inválido) — no debe decidir todavía
  assert.equal(ed.st.decided, false);
  ed.openKeypad('B');
  assert.ok(ed.allowedDigitsNow().has('4'), '"4" debe estar habilitado para B una vez que A quedó fijado en 6 esta sesión');
  ed.pressKey('4');
  assert.equal(ed.st.draftSet.a, 6);
  assert.equal(ed.st.draftSet.b, 4);
  assert.equal(ed.st.decided, true);
});

test('regresión: alta nueva de cero (sin valores previos) sigue avanzando A -> B automáticamente', () => {
  const ed = makeEditor();
  ed.reopen(null);
  ed.openKeypad('A');
  ed.pressKey('6');
  assert.equal(ed.st.decided, false, 'con B todavía vacío, no debe decidir solo');
  assert.equal(ed.st.keypadOpen, true);
  assert.equal(ed.st.activeTeam, 'B', 'debe auto-abrir el teclado del lado B, igual que antes del fix');
  ed.pressKey('4');
  assert.equal(ed.st.decided, true);
});

test('regresión: un score final inválido real (ganar por solo 1 game sin tiebreak) sigue bloqueado una vez que el otro lado quedó reafirmado', () => {
  assert.equal(E.isValidCompletedSetScore(6, 5, format), false, 'precondición: 6-5 debe ser inválido en Clásico (hace falta 2 de diferencia, o tiebreak en 7-6)');
  const ed = makeEditor();
  ed.reopen({ a: 6, b: 3 });
  ed.openKeypad('A');
  ed.pressKey('6'); // reafirma A=6 EN ESTA sesión -> a partir de acá sí es una restricción real para B
  ed.openKeypad('B');
  const allowed = ed.allowedDigitsNow();
  assert.ok(!allowed.has('5'), 'tests mínimos #4 del handoff: con A=6 ya reafirmado, "5" no debe ofrecerse como cierre válido para B (6-5 no es un score real)');
});
