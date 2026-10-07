// BRAMUlab — h26: claim del splash de instalación + selector de fecha de nacimiento en Android
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');

test('el claim del splash de instalación es una afirmación: "Donde vive tu pádel" (sin tilde)',()=>{
  assert.match(html,/install-prompt__app-sub">Donde vive tu pádel</);
  assert.doesNotMatch(html,/Dónde vive tu pádel/);
});

test('fecha de nacimiento: Registro y Editar datos siguen siendo <input type="date"> nativos (iPhone intacto)',()=>{
  assert.match(html,/id="signup-birthdate"[^>]*type="date"/);
  assert.match(html,/id="profile-edit-birthdate"[^>]*type="date"/);
});

test('fecha de nacimiento: showPicker solo en Android, con detección de soporte y sin romper si falla',()=>{
  const fn=app.slice(app.indexOf('function wireAndroidNativeDatePicker'),app.indexOf('function initSignupWizard'));
  assert.match(fn,/\/Android\/i\.test\(navigator\.userAgent/);
  assert.match(fn,/'showPicker' in HTMLInputElement\.prototype/);
  assert.match(fn,/try \{ el\.showPicker\(\); \} catch/);
  assert.match(app,/wireAndroidNativeDatePicker\(\['signup-birthdate', 'profile-edit-birthdate'\]\)/);
  // no toca validación ni almacenamiento: el helper no lee ni escribe el valor
  assert.doesNotMatch(fn,/\.value|birthDate|Store\./);
});
