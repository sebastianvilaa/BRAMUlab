// BRAMUlab — h22: actualización/cache + jerarquía legal + perfil simplificado
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const store=fs.readFileSync(path.join(__dirname,'store.js'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(__dirname,'version.json'),'utf8'));
const sw=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');

test('bundle h22 sincronizado en cliente/version/SW',()=>{
  assert.match(store,/BUNDLE_VERSION = '04\.37-h22'/);
  assert.equal(version.bundle,'04.37-h22');
  assert.match(sw,/bramulab-v04-37-h22/);
  assert.match(html,/styles\.css\?v=04\.37-h22/);
});
test('consentimiento usa el tamaño de password rules',()=>{
  assert.match(css,/#view-signup \.field-checkbox-label,[\s\S]*font-size:11\.5px/);
});
test('categoría queda fuera de lectura y edición',()=>{
  assert.match(html,/id="profile-category-row" hidden/);
  assert.match(html,/id="profile-edit-category-row" hidden/);
  assert.match(css,/#profile-category-row,[\s\S]*#profile-edit-category-row[\s\S]*display:none !important/);
});
test('rama se oculta por defecto y se decide por género en JS',()=>{
  assert.match(html,/id="profile-edit-branch-row" hidden/);
  assert.match(app,/row\.hidden = !!inferred/);
  assert.match(app,/gender === 'femenino'\) return 'F'/);
  assert.match(app,/gender === 'masculino'\) return 'M'/);
});
