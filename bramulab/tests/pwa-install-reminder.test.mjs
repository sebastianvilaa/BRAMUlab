// BRAMUlab — instalación PWA: recurrencia por dispositivo (07OCT26)
// Ejecutar con: node --test bramulab/tests/pwa-install-reminder.test.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

test('pre-login queda limitado a 2 apariciones por visita y volver al punto cero usa el mismo modal', () => {
  assert.match(appJs, /INSTALL_PROMPT_PRELOGIN_MAX\s*=\s*2/);
  assert.match(appJs, /installPromptPreloginShowsThisVisit\s*>=\s*INSTALL_PROMPT_PRELOGIN_MAX/);
  assert.match(appJs, /function returnToAccessRootForInstallPrompt\(\)/);
  assert.match(appJs, /login-back-btn'[\s\S]{0,180}returnToAccessRootForInstallPrompt/);
});

test('solo el descarte en Home inicia el contador real', () => {
  assert.match(appJs, /if \(installPromptContext === 'home'\) recordHomeInstallDismissal\(\)/);
  assert.match(appJs, /openInstallPromptSheet\('access'\)/);
  assert.match(appJs, /openInstallPromptSheet\('home'\)/);
});

test('1.ª y 2.ª negativas esperan 24 h; desde la 3.ª esperan 7 días', () => {
  assert.match(appJs, /INSTALL_PROMPT_DAY_MS\s*=\s*24 \* 60 \* 60 \* 1000/);
  assert.match(appJs, /INSTALL_PROMPT_WEEK_MS\s*=\s*7 \* INSTALL_PROMPT_DAY_MS/);
  assert.match(appJs, /dismissals >= 3 \? INSTALL_PROMPT_WEEK_MS : INSTALL_PROMPT_DAY_MS/);
});

test('la recurrencia vive en localStorage del dispositivo/navegador y standalone nunca muestra el prompt', () => {
  assert.match(appJs, /bramulab_install_prompt_reminder_v1/);
  assert.match(appJs, /window\.localStorage\.setItem\(INSTALL_PROMPT_REMINDER_KEY/);
  assert.match(appJs, /isStandaloneApp\(\)/);
  assert.match(appJs, /clearInstallReminderState\(\)/);
});
