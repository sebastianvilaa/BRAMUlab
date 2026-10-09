// BRAMUlab — h24: scroll del onboarding de Nivel (+ guarda el bundle vigente)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const store=fs.readFileSync(path.join(__dirname,'store.js'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(__dirname,'version.json'),'utf8'));
const sw=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8');

test('Nivel queda acotado al viewport y su contenido scrollea',()=>{
  assert.match(css,/#view-nivel-onboarding\{[\s\S]*height:100dvh;[\s\S]*overflow:hidden;/);
  assert.match(css,/#view-nivel-onboarding \.access-scroll\{[\s\S]*overflow-y:auto;[\s\S]*-webkit-overflow-scrolling:touch;/);
});
test('bundle h24 queda sincronizado',()=>{
  assert.match(html,/styles\.css\?v=04\.39-h5/);
  assert.match(store,/BUNDLE_VERSION = '04\.39-h5'/);
  assert.equal(version.bundle,'04.39-h5');
  assert.match(sw,/bramulab-v04-39-h5/);
});
