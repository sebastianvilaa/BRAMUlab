// BRAMUlab V04.40-h2 — minúsculas automáticas en @usuario.
// node --test bramulab/tests/v0440-username-lowercase.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(base, 'app.js'), 'utf8');
const identity = fs.readFileSync(path.join(base, 'player-identity.js'), 'utf8');
const context = {};
vm.runInNewContext(identity, context);
const PLI = context.PLIdentity;

const marker = '  function normalizeUsernameField(input) {';
const start = app.indexOf(marker);
assert.ok(start >= 0, 'existe normalización compartida');
const end = app.indexOf('\n  }', start);
assert.ok(end > start, 'función de normalización completa');
const fn = app.slice(start, end + '\n  }'.length);

function normalizeTyped(value, selectionStart = value.length, active = true) {
  const input = {
    value, selectionStart, selectionEnd: selectionStart,
    setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; },
  };
  vm.runInNewContext(fn + '\nnormalizeUsernameField(input);', {
    input, document: { activeElement: active ? input : null },
  });
  return input;
}

test('Mayúsculas en @usuario se convierten sin mostrar error de formato', () => {
  const input = normalizeTyped('JuanPerez_5');
  assert.equal(input.value, 'juanperez_5');
  assert.equal(PLI.isValidUsernameFormat(input.value), true);
});

test('Respeta el cursor al tipear dentro del @usuario', () => {
  const input = normalizeTyped('abCdef', 3);
  assert.equal(input.value, 'abcdef');
  assert.equal(input.selectionStart, 3);
  assert.equal(input.selectionEnd, 3);
});

test('No transforma silenciosamente caracteres inválidos, reservados ni colisiones', () => {
  assert.equal(normalizeTyped('JOSE Ñ').value, 'jose ñ');
  assert.equal(PLI.isValidUsernameFormat(normalizeTyped('JOSE Ñ').value), false);
  assert.equal(PLI.isUsernameReserved(normalizeTyped('ADMIN').value), true);
  assert.equal(PLI.isUsernameTaken('JUAN', [{ id: 'otro', username: 'juan' }]), true);
});

test('Signup y edición usan el mismo feedback que normaliza antes de validar', () => {
  const start = app.indexOf('  function renderUsernameFeedback(inputId, feedbackId, excludeUserId) {');
  const fb = app.slice(start, start + 480);
  assert.match(fb, /normalizeUsernameField\(input\);[\s\S]*?input\.value\.trim\(\)/);
  assert.match(app, /renderUsernameFeedback\('signup-username', 'signup-username-feedback'\)/);
  assert.match(app, /renderUsernameFeedback\('profile-edit-username', 'profile-edit-username-feedback'/);
  assert.match(app, /signupDraft\.username = \$\('#signup-username'\)\.value\.trim\(\)\.toLowerCase\(\)/);
  assert.match(app, /if \(signupDraft\.username\) signupDraft\.username = signupDraft\.username\.trim\(\)\.toLowerCase\(\)/);
  assert.match(app, /const username = \$\('#profile-edit-username'\)\.value\.trim\(\)\.toLowerCase\(\)/);
});

test('No desbloquea edición de @usuario en cuentas reales: sigue protegido en servidor', () => {
  assert.match(app, /\$\('#profile-edit-username'\)\.disabled = serverBacked;/);
  assert.match(app, /if \(user\.serverBacked\) \{ await submitServerBackedProfileEdit\(user\); return; \}/);
});
