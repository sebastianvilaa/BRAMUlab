// BRAMUlab V04.50-h1 — guía de contraseña del registro (sin claves reales ni backend).
// node --test bramulab/tests/v0450-h1-signup-password-guidance.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = fs.readFileSync(path.join(root, 'bramulab/app.js'), 'utf8');
const identity = fs.readFileSync(path.join(root, 'bramulab/player-identity.js'), 'utf8');
const markup = fs.readFileSync(path.join(root, 'bramulab/index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'bramulab/styles.css'), 'utf8');
const scope = {};
vm.runInNewContext(identity, scope);
const PLI = scope.PLIdentity;

function classList() {
  const values = new Set();
  return {
    toggle(k, v) { if (v) values.add(k); else values.delete(k); },
    contains(k) { return values.has(k); },
  };
}

function buildGate() {
  const elements = new Map();
  const ruleIds = ['hasMinLength', 'hasUpper', 'hasLower', 'hasNumber', 'hasSymbol'];
  const lis = ruleIds.map((id) => ({ dataset: { rule: id }, classList: classList() }));
  function $(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', disabled: false, textContent: '', classList: classList(), attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      handlers: {},
      addEventListener(k, fn) { this.handlers[k] = fn; },
    });
    return elements.get(id);
  }
  function $all(id) {
    assert.equal(id, '#signup-password-rules li');
    return lis;
  }

  const i = app.indexOf('  function syncSignupPasswordGate(strength) {');
  const j = app.indexOf('  function recomputeSignupStepValidity()', i);
  assert.ok(i >= 0 && j > i);
  const gateSource = app.slice(i, j);

  // Ejecutar la función REAL extraída del código, sin inyectar DOM de producción.
  const gate = new Function('deps', 'with (deps) { let signupPasswordWarning = false; '
    + gateSource + '; return { syncSignupPasswordGate, warn: () => { signupPasswordWarning = true; } }; }')({
    $, $all,
  });
  return { gate, $, lis, PLI };
}

test('El símbolo debe ser signo real, no una letra acentuada ni un espacio', () => {
  for (const weak of ['Sebastián123', 'Sebastian123 ', 'Sebastián123 ', 'SeBa1234ñ']) {
    const result = PLI.checkPasswordStrength(weak);
    assert.equal(result.hasSymbol, false, weak);
    assert.equal(result.ok, false, weak);
  }
  for (const symbol of ['!', '+', '-', '.', ',', '*', '@']) {
    assert.equal(PLI.checkPasswordStrength('Sebastian123' + symbol).ok, true, symbol);
  }
});

test('No habilita repetir hasta cumplir todas las reglas', () => {
  const { gate, $, PLI } = buildGate();
  gate.syncSignupPasswordGate(PLI.checkPasswordStrength('Sebastián123'));
  assert.equal($('#signup-password-repeat').disabled, true);
  assert.equal($('#signup-password-repeat-toggle').disabled, true);
  assert.equal($('#signup-password-repeat-field').classList.contains('is-locked'), true);
  assert.equal($('#signup-password-rules').classList.contains('has-missing'), false);
  assert.equal($('#signup-password').attributes['aria-invalid'], 'false');
});

test('Al intentar avanzar marca SOLO los requisitos pendientes en rojo', () => {
  const { gate, $, lis, PLI } = buildGate();
  gate.warn();
  gate.syncSignupPasswordGate(PLI.checkPasswordStrength('Sebastián123'));
  assert.deepEqual(lis.filter((li) => li.classList.contains('is-missing')).map((li) => li.dataset.rule), ['hasSymbol']);
  assert.equal($('#signup-password').classList.contains('is-invalid'), true);
  assert.equal($('#signup-password').attributes['aria-invalid'], 'true');
  assert.equal($('#signup-password-guidance').classList.contains('is-error'), true);
  assert.match($('#signup-password-guidance').textContent, /marcado en rojo/);
});

test('Al agregar un símbolo habilita repetir, limpia el rojo y muestra el éxito', () => {
  const { gate, $, lis, PLI } = buildGate();
  gate.warn();
  gate.syncSignupPasswordGate(PLI.checkPasswordStrength('Sebastián123'));
  gate.syncSignupPasswordGate(PLI.checkPasswordStrength('Sebastián123*'));
  assert.equal($('#signup-password-repeat').disabled, false);
  assert.equal($('#signup-password-repeat-toggle').disabled, false);
  assert.equal($('#signup-password-repeat-field').classList.contains('is-locked'), false);
  assert.deepEqual(lis.filter((li) => li.classList.contains('is-missing')), []);
  assert.equal($('#signup-password').attributes['aria-invalid'], 'false');
  assert.equal($('#signup-password-guidance').textContent, 'Listo. Ahora repetí la contraseña.');
});

test('La lista está antes de repetir y los ejemplos no afectan las otras pantallas', () => {
  const start = markup.indexOf('<div class="signup-step" data-step="1">');
  const end = markup.indexOf('<!-- L1 (V04.19', start);
  const step = markup.slice(start, end);
  assert.ok(step.indexOf('id="signup-password-rules"') < step.indexOf('id="signup-password-repeat"'));
  assert.match(step, /Un símbolo \(por ejemplo: ! \+ - \. , \*\)/);
  assert.match(step, /id="signup-password-repeat"[^>]*disabled/);
  assert.match(step, /id="signup-password-guidance" role="status"/);
  assert.match(styles, /#signup-password-rules li\.is-missing/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(app, /signupPasswordWarning = false/);
  assert.match(app, /addEventListener\('blur', \(\) => \{/);
  assert.match(app, /#signup-password-repeat-field'\)\.addEventListener\('pointerdown'/);
  assert.match(app, /syncSignupPasswordGate\(strength\);/);
});
