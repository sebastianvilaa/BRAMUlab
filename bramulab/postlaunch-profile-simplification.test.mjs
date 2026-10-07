// BRAMUlab — h21 post-lanzamiento: legal + perfil + rama
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
test('legal corto en las dos aceptaciones',()=>{assert.equal((html.match(/autorizo el tratamiento de mis datos por proveedores fuera de Argentina\./g)||[]).length,2);});
test('categoría oculta y fuera de incompleto',()=>{assert.match(html,/id="profile-edit-category-row" hidden/);const h=app.match(/function getProfileMissingFields\(user\)[\s\S]*?\n  \}/);assert.ok(h);assert.doesNotMatch(h[0],/categor/i);});
test('rama inferida desde género sin fusionar campos',()=>{assert.match(app,/gender === 'femenino'\) return 'F'/);assert.match(app,/gender === 'masculino'\) return 'M'/);assert.match(app,/rankingGateBranch = storedBranch \|\| inferredBranch/);});
