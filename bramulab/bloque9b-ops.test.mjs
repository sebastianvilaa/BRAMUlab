// BRAMUlab — Bloque 9B: ensayo operativo no destructivo (export, operación/recuperación, backup lógico) + preflight.
// node --test bramulab/bloque9b-ops.test.mjs   (usa PGlite: requiere `npm ci` en supabase/scripts)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runOpsRehearsal } from '../supabase/scripts/ops-rehearsal.mjs';
import { buildPreflight, preflightMarkdown, EXTERNAL_GATES, edgeServiceAuthChecks, runAll } from '../supabase/scripts/release-check.mjs';
import { checksumRows } from '../supabase/scripts/logical-backup.mjs';
import { replay } from '../supabase/scripts/replay-migrations.mjs';
import { seedOpsFixtures, IDS } from '../supabase/scripts/ops-fixtures.mjs';
import { makePgliteAdminClient } from '../supabase/scripts/pglite-admin-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readRepo = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

let rehearsal;
test('ensayo operativo A/B/C completo: todas las comprobaciones pasan', { timeout: 300000 }, async () => {
  rehearsal = await runOpsRehearsal();
  const failed = rehearsal.sections.flatMap((s) => s.items.filter((i) => !i.ok).map((i) => `${s.id}: ${i.name} :: ${i.detail}`));
  assert.deepEqual(failed, []);
  assert.deepEqual(rehearsal.sections.map((s) => s.id), ['A', 'B', 'C']);
  assert.ok(rehearsal.sections.find((s) => s.id === 'A').items.length >= 18);
  assert.ok(rehearsal.sections.find((s) => s.id === 'B').items.length >= 28);
  assert.ok(rehearsal.sections.find((s) => s.id === 'C').items.length >= 9);
});

test('A: el generador interno SIN envoltorio filtraba ids de terceros (por eso existe la redacción) y solo service_role lo ejecuta', { timeout: 120000 }, async () => {
  const r = await replay({ acl: 'observed' });
  const fx = await seedOpsFixtures(r.db);
  const client = makePgliteAdminClient(r.db);
  const raw = (await client.rpc('_admin_export_player_data_raw', { p_player_id: fx.pid.A })).data;
  assert.ok(JSON.stringify(raw).includes(fx.pid.B), 'regresión demostrada: el generador crudo contiene el player_id de B (actorPlayerId)');
  const wrapped = (await client.rpc('admin_export_player_data', { p_player_id: fx.pid.A })).data;
  assert.ok(!JSON.stringify(wrapped).includes(fx.pid.B));
  assert.equal(wrapped.account.playerId, fx.pid.A, 'el id del titular se conserva');
  const sql = readRepo('supabase/migrations/20261001080000_bloque9b_export_third_party_redaction.sql');
  assert.match(sql, /revoke all on function public\._admin_export_player_data_raw\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.admin_export_player_data\(uuid\) to service_role/);
});

test('C: el checksum no depende del orden de filas y detecta cualquier cambio', () => {
  const a = [{ id: 1, x: 'a' }, { id: 2, x: 'b' }];
  assert.equal(checksumRows(a), checksumRows([...a].reverse()));
  assert.notEqual(checksumRows(a), checksumRows([{ id: 1, x: 'a' }, { id: 2, x: 'c' }]));
});

test('D: el preflight separa PASS automático de gates externos y NUNCA marca un gate externo como cerrado', () => {
  const ok = buildPreflight([{ name: 's1', items: [{ ok: true }, { ok: true }] }]);
  assert.equal(ok.automatic.ok, true);
  assert.match(ok.verdict, /AUTOMÁTICO: PASS/);
  assert.ok(ok.externalGates.length === 4 && ok.externalGates.every((g) => g.status === 'PENDIENTE EXTERNO'));
  const bad = buildPreflight([{ name: 's1', items: [{ ok: true }, { ok: false }] }]);
  assert.equal(bad.automatic.ok, false);
  assert.match(bad.verdict, /FAIL/);
  assert.deepEqual(EXTERNAL_GATES.map((g) => g.id), ['G1', 'G2', 'G3', 'G4']);
  const md = preflightMarkdown(ok);
  EXTERNAL_GATES.forEach((g) => assert.ok(md.includes(g.id) && md.includes(g.owner.split(' ')[0])));
  assert.ok(/NO es un backup gestionado de Supabase/.test(EXTERNAL_GATES.find((g) => g.id === 'G4').automaticEvidence));
  assert.ok(/Comunicaciones/.test(EXTERNAL_GATES[0].name) && /OTP/.test(EXTERNAL_GATES[1].name) && /Production/.test(EXTERNAL_GATES[2].name));
});

test('D: regresiones 9A conservadas — Edge service-to-service y PG17 MAINTAIN dentro del mismo preflight', () => {
  assert.deepEqual(edgeServiceAuthChecks().filter((c) => !c.ok), []);
  const cr = readRepo('supabase/scripts/verify-clean-room.mjs');
  assert.match(cr, /MAINTAIN/);
});

test('D: release-check completo (con replay y ensayo operativo) PASA y el preflight lista los 4 gates pendientes', { timeout: 400000 }, async () => {
  const r = await runAll({ replay: true, ops: true, log: () => {} });
  assert.equal(r.ok, true, JSON.stringify(r.sections.flatMap((s) => s.items.filter((i) => !i.ok))));
  assert.equal(r.preflight.automatic.ok, true);
  assert.equal(r.preflight.externalGates.length, 4);
  assert.ok(r.sections.some((s) => /ensayo operativo A/.test(s.name)) && r.sections.some((s) => /ensayo operativo C/.test(s.name)));
});

test('Runbook: cada procedimiento tiene comando, evidencia previa y criterio de éxito; forward-fix vs rollback explícitos; backup sin afirmar lo no probado', () => {
  const rb = readRepo('docs/BRAMUlab/Runbook_Operacion_y_Salida.md');
  for (const h of ['Procedimientos verificados', 'Forward-fix vs rollback', 'Backup', 'Preflight']) assert.match(rb, new RegExp(h));
  assert.match(rb, /npm run ops-rehearsal|ops-rehearsal\.mjs/);
  assert.match(rb, /forward-fix/i);
  assert.match(rb, /NO se probó un backup gestionado de Supabase|no se probó un backup gestionado/i);
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sbp_[a-z0-9]{20,}/.test(rb));
});
