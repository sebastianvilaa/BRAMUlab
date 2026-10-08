// BRAMUlab — h25: revisión preventiva de scroll (vistas de acceso sin scroller, hojas y modales sin tope de alto)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');

const ACCESS=['access','legal-gate','login','forgot-password','signup','player-card','account-flow','account-deleted'];

test('toda vista .view--access queda acotada al viewport y con scroller interno',()=>{
  // Todas las vistas de la familia: o bien estaban cubiertas antes de h25, o bien entran en la regla h25.
  const covered=new Set([
    ...ACCESS,'group-settings','edit-data','complete-access','change-password','nivel-onboarding',
    'settings','settings-email','settings-delete','settings-copy','settings-contact','legal-doc'
  ]);
  const declared=[...html.matchAll(/id="view-([a-z-]+)" class="view view--access"/g)].map((m)=>m[1]);
  assert.ok(declared.length>=19);
  for(const v of declared) assert.ok(covered.has(v),`vista view--access sin cobertura de scroll: ${v}`);
  const block=css.slice(css.indexOf('07OCT26 h25'));
  for(const v of ACCESS){
    assert.match(block,new RegExp(`#view-${v}\\b`),`h25 no acota #view-${v}`);
    assert.match(block,new RegExp(`#view-${v} \\.access-scroll`),`h25 no da scroll a #view-${v}`);
  }
  assert.match(block,/height:100dvh;\s*min-height:0;\s*max-height:100dvh;\s*overflow:hidden;/);
  assert.match(block,/overflow-y:auto;[^}]*overscroll-behavior:contain/);
});

test('Acceso y Reaceptación legal ya no centran con justify-content:center dentro del scroller (recortaba el borde superior)',()=>{
  const block=css.slice(css.indexOf('07OCT26 h25'));
  assert.match(block,/#view-access \.access-scroll, #view-legal-gate \.access-scroll\{ justify-content:flex-start; \}/);
  assert.match(block,/#view-legal-gate \.access-logo\{ margin-top:auto; \}/);
});

test('hojas y modales tienen tope de alto genérico sin pisar los topes propios (:where) y no bloquean su propio scroll',()=>{
  assert.match(css,/:where\(\.bottom-sheet\)\{ max-height: calc\(100dvh - 12px - var\(--safe-top, 0px\)\); overflow-y:auto;/);
  assert.match(css,/:where\(\.overlay__card\)\{ max-height: calc\(100dvh - 40px\); overflow-y:auto;/);
  assert.match(css,/\.bottom-sheet\{ touch-action:pan-y; \}/);
  assert.match(css,/#install-prompt-sheet\{ overflow-x:hidden; overflow-y:auto; \}/);
});
