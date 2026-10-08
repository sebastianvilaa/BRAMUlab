// BRAMUlab — pruebas de la herramienta «superficie de promoción» (bramulab/scripts/promotion-surface.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVersion, compareDists, evaluate, DEFAULT_EXPECT } from '../scripts/promotion-surface.mjs';

const mk = (files) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-')); for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); } return d; };

test('la normalización solo borra marcadores de versión del bundle, nada más', () => {
  assert.equal(normalizeVersion("styles.css?v=04.37-h26 bramulab-v04-37-h26 04.12-h1"), 'styles.css?v=<BUNDLE> bramulab-v<BUNDLE> <BUNDLE>');
  assert.equal(normalizeVersion('const x = 1; // 04.37'), 'const x = 1; // 04.37');
});

test('compareDists distingue «solo versión», «contenido», nuevos y eliminados', () => {
  const a = mk({ 'a.js': 'v 04.37-h26', 'b.js': 'x', 'c.js': 'c', 'gone.js': 'g' });
  const b = mk({ 'a.js': 'v 04.37-h31', 'b.js': 'y', 'c.js': 'c', 'admin/m.js': 'n' });
  const r = Object.fromEntries(compareDists(a, b).map((c) => [c.file, c.kind]));
  assert.deepEqual(r, { 'a.js': 'solo versión', 'b.js': 'contenido', 'admin/m.js': 'nuevo', 'gone.js': 'eliminado' });
});

test('evaluate marca como INESPERADO todo lo que no está en la lista permitida (carpetas con «/»)', () => {
  const ch = [{ file: 'auth.js', kind: 'contenido' }, { file: 'admin/metrics/metrics.js', kind: 'nuevo' }, { file: 'groups.js', kind: 'contenido' }, { file: 'styles.css', kind: 'contenido' }];
  const e = evaluate(ch, DEFAULT_EXPECT);
  assert.deepEqual(e.unexpected.map((c) => c.file), ['groups.js', 'styles.css']);
  assert.deepEqual(e.expected.map((c) => c.file), ['auth.js', 'admin/metrics/metrics.js']);
  assert.equal(evaluate([], DEFAULT_EXPECT).unexpected.length, 0);
});
