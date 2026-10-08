// BRAMUlab — Bloque 9A: pruebas del replay limpio y del check de release. node --test bramulab/tests/bloque9a-release.test.mjs
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMigrationNames, replay, adaptMigration } from '../../supabase/scripts/replay-migrations.mjs';
import { checkCleanState, verifyScenario } from '../../supabase/scripts/verify-clean-room.mjs';
import { scanHardcodes, edgeFunctions, clientChecks, buildGuards, runAll, EXPECTED_VERIFY_JWT } from '../../supabase/scripts/release-check.mjs';

const __dirname = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // raíz de bramulab/ (las pruebas viven en bramulab/tests/)
const mk = (files) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')); for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); } return d; };

test('migraciones: nombres válidos, versiones únicas; un duplicado o nombre inválido se detecta', () => {
  assert.deepEqual(checkMigrationNames(['20260101000000_a.sql', '20260101000001_b.sql']), []);
  assert.match(checkMigrationNames(['20260101000000_a.sql', '20260101000000_b.sql'])[0], /duplicada/);
  assert.match(checkMigrationNames(['2026_x.sql'])[0], /inválido/);
  assert.deepEqual(checkMigrationNames(fs.readdirSync(path.join(__dirname, '../supabase/migrations')).filter((f) => f.endsWith('.sql'))), []);
});

test('replay limpio: TODAS las migraciones aplican desde una base vacía y el estado inicial es el de una Production nueva (3 escenarios de ACL)', { timeout: 120000 }, async () => {
  for (const acl of ['strict', 'observed', 'open']) {
    const rep = await verifyScenario(acl, { withVerifies: acl === 'observed' });
    assert.equal(rep.replayOk, true, `${acl}: ${rep.failedMigration && rep.failedMigration.error}`);
    const bad = [...rep.checks, ...rep.smoke].filter((c) => !c.ok);
    assert.deepEqual(bad.map((b) => `${b.name}::${b.detail}`), [], acl);
    if (rep.verifies) assert.deepEqual(rep.verifies.failed, [], 'los verifies SQL autocontenidos del repo pasan sobre la base replayada');
  }
});

test('el replay detecta una migración fuera de orden (regresión real: hardening 232000 antes de 280000)', async () => {
  const { PGlite } = await import(pathToFileURL(path.join(__dirname, '../supabase/scripts/node_modules/@electric-sql/pglite/dist/index.js')).href);
  const db = new PGlite();
  await assert.rejects(db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930232000_preprod_l1_legal_acceptance_hardening.sql'), 'utf8').replace(/do \$\$[\s\S]*?end \$\$;/, 'alter function public.legal_acceptances_reject_mutation() set search_path = public;')));
  // y la versión vigente (condicional) es no-op sobre una base vacía
  await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260930232000_preprod_l1_legal_acceptance_hardening.sql'), 'utf8'));
});

test('la línea base de privilegios TIENE DIENTES: sin ella, un proyecto con defaults abiertos queda expuesto y el chequeo lo detecta', { timeout: 120000 }, async () => {
  const r = await replay({ acl: 'open', exclude: ['bloque9a_baseline_privileges'] });
  assert.equal(r.ok, true);
  const bad = (await checkCleanState(r.db)).filter((c) => !c.ok).map((c) => c.name);
  assert.ok(bad.some((n) => /INSERT\/UPDATE\/DELETE/.test(n)), 'DML directo expuesto');
  assert.ok(bad.some((n) => /MAINTAIN/.test(n)), 'MAINTAIN directo expuesto en PG17');
  assert.ok(bad.some((n) => /anon solo/.test(n)), 'anon expuesto');
  assert.ok(bad.some((n) => /administrativa|interna/.test(n)), 'RPC internas expuestas a authenticated');
});

test('hardcodes: el escáner detecta project ref, JWT, key, host, email y UUID de fixture (y respeta comentarios/tests/allowlist)', () => {
  const root = mk({
    'bramulab/a.js': "const u = 'https://abcdefghijklmnopqrst.supabase.co'; // ok\nconst t = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk';\nconst e = 'qa@gmail.com'; const h = 'foo.vercel.app';",
    'bramulab/b.js': "// host viejo foo.github.io solo en comentario\nconst ok = 'bramulab@gmail.com';",
    'supabase/migrations/20260101000000_x.sql': "insert into public.app_config (id, environment) values (1, 'staging');\ninsert into t values ('11111111-2222-3333-4444-555555555555');",
    'bramulab/tests/x.test.mjs': "const k = 'foo.vercel.app';",
  });
  const f = scanHardcodes(['bramulab/a.js', 'bramulab/b.js', 'supabase/migrations/20260101000000_x.sql', 'bramulab/tests/x.test.mjs'], root);
  const ids = f.map((x) => x.id).sort();
  for (const id of ['supabase-project-ref', 'jwt-literal', 'vercel-host-in-source', 'email-literal', 'staging-environment-seed', 'uuid-fixture-in-migration']) assert.ok(ids.includes(id), id);
  assert.ok(!f.some((x) => x.file === 'bramulab/b.js'), 'comentarios y allowlist no se marcan');
  assert.ok(!f.some((x) => x.file === 'bramulab/tests/x.test.mjs'), 'los tests pueden usar fakes de host');
});

test('hardcodes: el repo real está limpio', () => { assert.deepEqual(scanHardcodes(), []); });

test('Edge Functions: imports resueltos recursivamente; falta de archivo, import remoto no permitido y secreto literal se detectan', () => {
  const root = mk({
    'supabase/functions/ok/index.ts': "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';\nimport { x } from '../_shared/a.ts';",
    'supabase/functions/_shared/a.ts': "import './b.js';",
    'supabase/functions/_shared/b.js': 'export {};',
    'supabase/functions/bad/index.ts': "import { x } from '../_shared/missing.ts';\nimport y from 'https://evil.example/x.ts';\nconst K = SUPABASE_SERVICE_ROLE_KEY = 'abcdefghijklmnopqrstuvwxyz';",
  });
  const ef = edgeFunctions(root);
  assert.deepEqual(ef.find((f) => f.name === 'ok').problems, []);
  assert.equal(ef.find((f) => f.name === 'ok').files.length, 3);
  const bad = ef.find((f) => f.name === 'bad').problems.join('|');
  assert.match(bad, /falta/); assert.match(bad, /import remoto no permitido/); assert.match(bad, /secreto literal/);
});

test('Edge Functions reales: imports resueltos; admin-resolve y cleanup usan auth propia (verify_jwt=false), las de usuario=true', () => {
  const ef = edgeFunctions();
  assert.deepEqual(ef.flatMap((f) => f.problems.map((p) => `${f.name}: ${p}`)), []);
  assert.deepEqual(ef.map((f) => f.name).sort(), Object.keys(EXPECTED_VERIFY_JWT).sort());
  assert.equal(EXPECTED_VERIFY_JWT['cleanup-abandoned-signups'], false);
  assert.equal(EXPECTED_VERIFY_JWT['admin-resolve-identity-issue'], false);
  assert.ok(Object.entries(EXPECTED_VERIFY_JWT)
    .filter(([k]) => !['cleanup-abandoned-signups', 'admin-resolve-identity-issue'].includes(k))
    .every(([, v]) => v === true));
  const dm = ef.find((f) => f.name === 'delete-my-account');
  assert.ok(dm.files.includes('supabase/functions/_shared/account-deletion-core.mjs') && dm.files.includes('supabase/functions/_shared/self-delete-core.mjs'));
});

test('bundle cliente y laboratorio: service role fuera, laboratorio bloqueado en Production, versión coherente', () => {
  assert.deepEqual(clientChecks().filter((c) => !c.ok), []);
});

function loadStore(env) {
  const store = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
  const m = new Map();
  const sb = { console, localStorage: { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }, Date, JSON, Math, Object, Array, String, Number, Map, Set, Promise, setTimeout, clearTimeout };
  if (env) sb.__BRAMU_ENV__ = env;
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb); vm.runInContext(store, sb);
  return sb.PLStore || sb.Store;
}
test('laboratorio: el flag de preview persistido en localStorage NO se respeta en Production (sí en Staging/dev)', () => {
  for (const [env, expected] of [[{ name: 'production' }, false], [{ name: 'staging' }, true], [undefined, true]]) {
    const S = loadStore(env);
    S.setLevelV1PreviewEnabled(true);
    assert.equal(S.isLevelV1PreviewEnabled(), expected, JSON.stringify(env));
  }
});

test('guardas de build: Staging válido; Production con placeholders legales FALLA a propósito; credenciales cruzadas y variables faltantes fallan', { timeout: 60000 }, () => {
  const res = buildGuards();
  assert.deepEqual(res.filter((r) => !r.ok), []);
  assert.ok(res.length >= 10);
});

test('release-check completo (sin replay: ya cubierto arriba) pasa y produce un manifest con hash por migración y por bundle de Edge Function', { timeout: 120000 }, async () => {
  const r = await runAll({ replay: false, log: () => {} });
  assert.equal(r.ok, true, JSON.stringify(r.sections.flatMap((s) => s.items.filter((i) => !i.ok))));
  assert.equal(r.manifest.migrations.length, fs.readdirSync(path.join(__dirname, '../supabase/migrations')).filter((f) => f.endsWith('.sql')).length);
  assert.ok(r.manifest.migrations.every((m) => /^[0-9a-f]{16}$/.test(m.sha256)));
  assert.ok(r.manifest.edgeFunctions.every((f) => /^[0-9a-f]{16}$/.test(f.bundleHash)));
});

test('la lista explícita de authenticated de la migración baseline coincide EXACTAMENTE con la superficie RPC que dejan las migraciones previas', { timeout: 120000 }, async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261001060000_bloque9a_baseline_privileges.sql'), 'utf8');
  const listed = [...sql.matchAll(/^grant execute on function (public\.[a-z0-9_]+\([^)]*\)) to authenticated;$/gm)].map((m) => m[1].replace(/\s/g, '')).sort();
  assert.ok(listed.length >= 58);
  assert.equal(new Set(listed).size, listed.length, 'sin duplicados');
  // La baseline fija la superficie que dejan las migraciones ANTERIORES a ella; toda RPC de cliente posterior trae su propio
  // GRANT EXECUTE ... TO authenticated (contrato documentado en la cabecera de la baseline) y no entra en esta lista.
  const baselineFile = '20261001060000_bloque9a_baseline_privileges.sql';
  const later = fs.readdirSync(path.join(__dirname, '../supabase/migrations')).filter((f) => f.endsWith('.sql') && f > baselineFile);
  const r = await replay({ acl: 'observed', exclude: ['bloque9a_baseline_privileges', ...later] });
  const rows = (await r.db.query(`select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and has_function_privilege('authenticated',p.oid,'EXECUTE')`)).rows;
  const live = rows.map((x) => `public.${x.sig}`.replace(/^public\.public\./, 'public.').replace(/\s/g, '')).sort();
  assert.deepEqual(listed, live);
});
