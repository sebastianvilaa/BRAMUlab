// node --test bramulab/scripts/legal-guard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPendingPlaceholders, checkLegalPagesReadyForProduction, LEGAL_PAGES } from '../scripts/legal-guard.mjs';

const BRAMULAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('findPendingPlaceholders detecta claves únicas', () => {
  assert.deepEqual(findPendingPlaceholders('a [[PENDIENTE_PRODUCCION:x_1]] b [[PENDIENTE_PRODUCCION:x_1]] [[PENDIENTE_PRODUCCION:y]]'), ['x_1', 'y']);
  assert.deepEqual(findPendingPlaceholders('texto final sin pendientes'), []);
  assert.deepEqual(findPendingPlaceholders(null), []);
});

test('las páginas legales REALES del repo todavía tienen pendientes => Production NO puede publicarlas', () => {
  const r = checkLegalPagesReadyForProduction(BRAMULAB);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingFiles, []);
  assert.ok(r.pending['terminos/index.html'].includes('nombre_legal_responsable'));
  assert.ok(r.pending['privacidad/index.html'].includes('registro_aaip_rnbdp'));
  assert.ok(r.pending['eliminar-cuenta/index.html'].includes('plazos_backups_logs'));
});

test('con todas las páginas sin pendientes el guard pasa; con una faltante falla', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
  for (const rel of LEGAL_PAGES) { fs.mkdirSync(path.join(dir, path.dirname(rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), '<p>final</p>'); }
  assert.equal(checkLegalPagesReadyForProduction(dir).ok, true);
  fs.rmSync(path.join(dir, LEGAL_PAGES[1]));
  const r = checkLegalPagesReadyForProduction(dir);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingFiles, [LEGAL_PAGES[1]]);
});

test('build-env.mjs invoca el guard SOLO para production y corta con exit 1', () => {
  const src = fs.readFileSync(path.join(BRAMULAB, 'scripts/build-env.mjs'), 'utf8');
  assert.match(src, /if \(envName === 'production'\) \{[\s\S]*checkLegalPagesReadyForProduction[\s\S]*process\.exit\(1\)/);
});
