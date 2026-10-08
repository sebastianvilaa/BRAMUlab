// BRAMUlab — Bloque 9A: CHECK REPRODUCIBLE de release. Un solo comando, sin credenciales ni red, que recorre todo lo
// automatizable antes de un deploy (Staging hoy, Production mañana) y emite un manifest derivado.
//
//   node supabase/scripts/release-check.mjs [--no-replay] [--no-ops] [--manifest salida.json] [--preflight-md salida.md]
//   (exit 0 solo si TODO lo AUTOMÁTICO pasa; los gates externos se listan aparte como PENDIENTE y nunca se dan por cerrados)
//
// Secciones: nombres de migración · hardcodes prohibidos · Edge Functions (imports/verify_jwt) · bundle cliente
// (service-role fuera, laboratorio) · guardas de build (Staging válido, Production corta por legal, credenciales cruzadas)
// · versión/Service Worker · replay limpio en 3 escenarios de ACL (verify-clean-room.mjs).
// Bloque 9B: + ensayo operativo (ops-rehearsal.mjs: exportación, eliminación con fallos/retry, anulación, cleanup, rate limits, backup
// lógico) + regresiones PG17 MAINTAIN / Edge service-to-service + PREFLIGHT que separa PASS automático de gates externos.
// Reutiliza: env-guard.mjs, legal-guard.mjs, audit-migration-grants.mjs, replay-migrations.mjs, verify-clean-room.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listMigrations, checkMigrationNames, MIGRATIONS_DIR } from './replay-migrations.mjs';
import { buildDist, DIST_FILES, DIST_DIRS } from '../../bramulab/scripts/build-dist.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** verify_jwt ESPERADO por Edge Function (se contrasta con el despliegue real en Staging/Production). */
export const EXPECTED_VERIFY_JWT = {
  'officialize-onboarding': true, 'create-or-attach-match': true, 'officialize-match': true, 'propose-match-correction': true,
  'respond-match-correction': true, 'resolve-identity-issue': true, 'get-match-intelligence': true, 'delete-my-account': true, 'account-challenge': true,
  // V04.29 — replay de Nivel de una recuperación de identidad (JWT del usuario; el target siempre es el player de la sesión).
  'process-identity-recovery': true,
  // BRAMU Metrics V1 (F2) — panel privado /admin/metrics: JWT de usuario + autorización de administrador en servidor (metrics_admins).
  'admin-metrics': true,
  // service-to-service: autenticación propia; el gateway no exige JWT de usuario.
  'admin-resolve-identity-issue': false, 'cleanup-abandoned-signups': false,
};
/** Únicos imports remotos permitidos en Edge Functions (G1: + nodemailer con versión EXACTA, para el SMTP compartido). */
export const ALLOWED_REMOTE_IMPORTS = new Set(['https://esm.sh/@supabase/supabase-js@2', 'npm:nodemailer@6.9.16']);

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n').filter(Boolean);
}
const isBinary = (f) => /\.(png|jpe?g|ico|svg|webp|woff2?|lock)$/i.test(f) || f.endsWith('package-lock.json');
const isTestish = (f) => /(^|\/)tests?\//.test(f) || /\.test\.mjs$/.test(f) || /(^|\/)tests\.html$/.test(f) || /^supabase\/tests\//.test(f);

/* ---------- 1. hardcodes prohibidos ---------- */
export const FORBIDDEN = [
  { id: 'supabase-project-ref', re: /\b[a-z]{20}\.supabase\.co\b/, scope: 'all' },
  { id: 'jwt-literal', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/, scope: 'all' },
  { id: 'supabase-secret-key', re: /\b(sbp_[a-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{10,})/, scope: 'all' },
  { id: 'publishable-key-real', re: /sb_publishable_[A-Za-z0-9]{20,}/, scope: 'all' },
  { id: 'service-role-literal', re: /SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"\s]{20,}['"]/, scope: 'all' },
  { id: 'vercel-host-in-source', re: /[a-z0-9-]+\.vercel\.app/, scope: 'source' },
  { id: 'github-pages-host', re: /[a-z0-9-]+\.github\.io/, scope: 'source' },
  { id: 'staging-environment-seed', re: /insert\s+into\s+public\.app_config[^;]*'(staging|production)'/i, scope: 'source', pathRe: /^supabase\/(migrations|functions)\// },
];
/** Archivos cuyo PROPÓSITO es sembrar violaciones para probar este escáner: se excluyen de su propio escaneo. */
export const SCANNER_FIXTURE_FILES = new Set(['bramulab/bloque9a-release.test.mjs', 'bramulab/bloque9b-ops.test.mjs']);
const EMAIL_ALLOWED = /^(bramulab@gmail\.com)$|@example\.(test|com)$|@x\.test$|@test\.com$/i;
export function scanHardcodes(files = trackedFiles(), root = REPO) {
  const findings = [];
  for (const f of files) {
    if (isBinary(f) || SCANNER_FIXTURE_FILES.has(f) || f.startsWith('docs/') || f.startsWith('Referencias/') || f.startsWith('Temporales/')) continue;
    let txt; try { txt = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    const source = !isTestish(f);
    // Los hosts/seeds de entorno solo importan en CÓDIGO ejecutable: los comentarios históricos no cuentan.
    const code = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1').replace(/^\s*--.*$/, '')).join('\n');
    for (const r of FORBIDDEN) {
      if (r.scope === 'source' && !source) continue;
      if (r.pathRe && !r.pathRe.test(f)) continue;
      const m = (r.scope === 'source' ? code : txt).match(r.re);
      if (m) findings.push({ id: r.id, file: f, sample: m[0].slice(0, 60) });
    }
    if (source && /\.(js|mjs|ts|html|sql|json|webmanifest)$/.test(f)) {
      for (const m of txt.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g)) {
        if (/^(@supabase|@electric)/.test(m[0]) || /@\d/.test(m[0]) || EMAIL_ALLOWED.test(m[0]) || /\.(js|css|png|mjs)$/.test(m[0])) continue;
        if (/^[a-z_]+@[a-z_]+$/.test(m[0])) continue;
        findings.push({ id: 'email-literal', file: f, sample: m[0] });
      }
      if (/\.sql$/.test(f) && f.startsWith('supabase/migrations/')) {
        const code = txt.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
        const uu = code.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/);
        if (uu) findings.push({ id: 'uuid-fixture-in-migration', file: f, sample: uu[0] });
      }
    }
  }
  return findings;
}

/* ---------- 2. Edge Functions ---------- */
export function edgeFunctions(root = REPO) {
  const base = path.join(root, 'supabase/functions');
  const fns = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== '_shared').map((d) => d.name).sort();
  const out = [];
  for (const fn of fns) {
    const entry = path.join(base, fn, 'index.ts');
    const problems = []; const closure = new Set(); const remote = new Set();
    const visit = (file) => {
      if (closure.has(file)) return;
      let real; try { real = fs.realpathSync(file); } catch { problems.push(`falta ${path.relative(root, file)}`); return; }
      closure.add(file);
      const src = fs.readFileSync(real, 'utf8');
      if (/SERVICE_ROLE_KEY\s*=\s*['"]/.test(src) || /eyJ[A-Za-z0-9_-]{20,}/.test(src)) problems.push(`secreto literal en ${path.relative(root, file)}`);
      for (const m of src.matchAll(/^\s*(?:import|export)\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/gm)) {
        const spec = m[1];
        if (/^https?:\/\//.test(spec) || spec.startsWith('npm:')) { remote.add(spec); if (!ALLOWED_REMOTE_IMPORTS.has(spec)) problems.push(`import remoto no permitido: ${spec}`); continue; }
        if (spec.startsWith('.')) visit(path.resolve(path.dirname(file), spec));
        else if (!spec.startsWith('node:')) problems.push(`import no resuelto: ${spec}`);
      }
    };
    if (!fs.existsSync(entry)) problems.push('sin index.ts'); else visit(entry);
    const src = fs.existsSync(entry) ? fs.readFileSync(entry, 'utf8') : '';
    const envNames = [...new Set([...src.matchAll(/Deno\.env\.get\('([A-Z_]+)'\)/g)].map((m) => m[1]))];
    const hash = sha(Buffer.concat([...closure].sort().map((f) => fs.readFileSync(fs.realpathSync(f)))));
    out.push({ name: fn, verifyJwtExpected: EXPECTED_VERIFY_JWT[fn], files: [...closure].map((f) => path.relative(root, f)).sort(), remoteImports: [...remote], env: envNames, bundleHash: hash, problems });
  }
  return out;
}

/* ---------- 3. guardas de build (en una copia temporal; build-env escribe junto a sí mismo) ---------- */
export function buildGuards() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-build-'));
  const copy = path.join(tmp, 'bramulab');
  fs.cpSync(path.join(REPO, 'bramulab'), copy, { recursive: true, filter: (s) => !s.includes('node_modules') });
  const run = (env) => {
    const e = { PATH: process.env.PATH, ...env };
    const r = spawnSync(process.execPath, ['scripts/build-env.mjs'], { cwd: copy, env: e, encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const SB = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_example_not_real' };
  const add = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
  const stg = run({ BRAMU_ENV_NAME: 'staging', ...SB });
  add('build Staging válido (exit 0)', stg.code === 0, stg.out.trim().split('\n').pop());
  const gen = fs.existsSync(path.join(copy, 'env.generated.js')) ? fs.readFileSync(path.join(copy, 'env.generated.js'), 'utf8') : '';
  add('env.generated.js solo trae name/supabaseUrl/supabaseAnonKey', /name: "staging"/.test(gen) && !/service|SERVICE|secret/i.test(gen) && (gen.match(/^\s+[a-zA-Z]+:/gm) || []).length === 3, gen.replace(/\n/g, ' ').slice(0, 120));
  add('robots de Staging = no-index', /Disallow: \//.test(fs.readFileSync(path.join(copy, 'robots.generated.txt'), 'utf8')));
  const prod = run({ BRAMU_ENV_NAME: 'production', ...SB });
  add('build Production con placeholders legales FALLA a propósito (exit 1, por la razón esperada)', prod.code === 1 && /páginas legales tienen datos pendientes/.test(prod.out) && /nombre_legal_responsable/.test(prod.out), prod.out.split('\n').slice(0, 2).join(' | '));
  add('el build Production fallido no deja env.generated.js de Production', !/production/.test(fs.existsSync(path.join(copy, 'env.generated.js')) ? fs.readFileSync(path.join(copy, 'env.generated.js'), 'utf8') : ''));
  const cross1 = run({ VERCEL: '1', VERCEL_ENV: 'production', BRAMU_ENV_NAME: 'staging', ...SB });
  add('Vercel Production con credenciales de Staging FALLA', cross1.code === 1 && /Production/.test(cross1.out), cross1.out.split('\n')[0]);
  const cross2 = run({ VERCEL: '1', VERCEL_ENV: 'preview', BRAMU_ENV_NAME: 'production', ...SB });
  add('Vercel Preview/Staging con credenciales de Production FALLA', cross2.code === 1, cross2.out.split('\n')[0]);
  add('sin BRAMU_ENV_NAME FALLA', run({ ...SB }).code === 1);
  add('sin SUPABASE_URL FALLA', run({ BRAMU_ENV_NAME: 'staging', SUPABASE_ANON_KEY: 'k' }).code === 1);
  add('sin SUPABASE_ANON_KEY FALLA', run({ BRAMU_ENV_NAME: 'staging', SUPABASE_URL: 'https://example.supabase.co' }).code === 1);
  // Production con páginas legales completas (simuladas en la copia) SÍ construye y indexa
  for (const p of ['terminos', 'privacidad', 'eliminar-cuenta']) fs.writeFileSync(path.join(copy, p, 'index.html'), '<p>final</p>');
  const prodOk = run({ BRAMU_ENV_NAME: 'production', ...SB });
  add('build Production con páginas legales sin pendientes (simuladas en la copia) construye y es indexable', prodOk.code === 0 && /Allow: \//.test(fs.readFileSync(path.join(copy, 'robots.generated.txt'), 'utf8')), prodOk.out.trim().split('\n').pop());
  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}

/* ---------- 4. bundle cliente / laboratorio / versión ---------- */
export function clientChecks(root = REPO) {
  const results = []; const add = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
  const dir = path.join(root, 'bramulab');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
  const local = scripts.map((s) => s.split('?')[0]).filter((s) => s !== 'env.generated.js');
  add('todos los scripts locales de index.html existen', local.every((s) => fs.existsSync(path.join(dir, s))), local.filter((s) => !fs.existsSync(path.join(dir, s))).join(','));
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  const leaks = [];
  for (const s of [...new Set(local), 'sw.js']) {
    const code = stripComments(fs.readFileSync(path.join(dir, s), 'utf8'));
    if (/service_role|SERVICE_ROLE|sb_secret|SUPABASE_SERVICE/.test(code)) leaks.push(s);
  }
  add('la service role no aparece en ningún script cliente ni en el SW (código, sin comentarios)', leaks.length === 0, leaks.join(','));
  const cdnTags = html.match(/<script src="https?:[^"]+"[^>]*>/g) || [];
  add('el único CDN externo es supabase-js (anon), con versión EXACTA y SRI (hardening 139)', cdnTags.length === 1 && /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@\d+\.\d+\.\d+\/dist\/umd\/supabase\.js"/.test(cdnTags[0]) && /integrity="sha384-[A-Za-z0-9+/]{64}"/.test(cdnTags[0]) && /crossorigin="anonymous"/.test(cdnTags[0]), cdnTags[0] || '');
  add('el navegador NO carga el motor dinámico de Nivel (ni level.js, ni level-context.js, ni match-level-engine.js; sí level-public.js)', !/<script src="(level|level-context|match-level-engine)\.js/.test(html) && /<script src="level-public\.js/.test(html));
  const distTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-dist-'));
  const dist = buildDist({ srcDir: dir, outDir: path.join(distTmp, 'dist'), requireGenerated: false });
  const leaked = dist.files.filter((f) => /\.test\.mjs$|^tests\.html$|^scripts\/|^api\/|^\.env|^vercel\.json$|^level(-context)?\.js$|^match-level-engine\.js$|^intelligence-(context|claims|editorial|official|presentation)\.js$/.test(f));
  const allowed = new Set([...DIST_FILES, 'env.generated.js', 'robots.generated.txt']);
  const outsideAllowlist = dist.files.filter((f) => !allowed.has(f) && !DIST_DIRS.some((d) => f.startsWith(d + '/')));
  add('dist/ se arma solo por allowlist, sin tests/scripts/.env.example/motor de Nivel y con todo lo referenciado', dist.problems.length === 0 && leaked.length === 0 && outsideAllowlist.length === 0, [...dist.problems, ...leaked, ...outsideAllowlist].join(','));
  fs.rmSync(distTmp, { recursive: true, force: true });
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8'); const store = fs.readFileSync(path.join(dir, 'store.js'), 'utf8');
  const ver = JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8'));
  const bundle = (store.match(/BUNDLE_VERSION = '([^']+)'/) || [])[1];
  add('bundle coherente: store.js = version.json = CACHE_NAME = ?v= de index.html y SW', bundle === ver.bundle && sw.includes(`CACHE_NAME = 'bramulab-v${bundle.replace(/[.]/g, '-').replace('-h', '-h')}'`) && (html.match(/\?v=([0-9.]+-h\d+)/g) || []).every((x) => x === `?v=${bundle}`) && (sw.match(/\?v=([0-9.]+-h\d+)/g) || []).every((x) => x === `?v=${bundle}`), `bundle ${bundle}`);
  add('env.generated.js no se precachea (SW: siempre red/no-store)', !/\.\/env\.generated\.js/.test(sw.slice(sw.indexOf('CORE_ASSETS'), sw.indexOf('];', sw.indexOf('CORE_ASSETS')))) && /env\.generated\.js[\s\S]{0,120}no-store/.test(sw));
  const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  add('laboratorio/cuentas de prueba/Herramientas bloqueados en Production a nivel de handler y de store', /function createLabTestUserAndOpenOnboarding\(\) \{\s*if \(isProductionEnv\(\)\) return;/.test(app) && /function resetLevelV1ForLabAccount\(\) \{\s*if \(isProductionEnv\(\)\) return;/.test(app) && /function setLevelV1Preview\(enabled\) \{[^}]*isProductionEnv\(\)/.test(app) && /isProductionBuild\(\) && safeGet\(KEYS\.LEVEL_V1_PREVIEW\)|!isProductionBuild\(\) && safeGet/.test(store) && /if \(isProductionEnv\(\)\) return;\s*\n\s*clearTimeout\(longPressTimeoutId\)/.test(app));
  add('modo local (cuentas en localStorage) solo en desarrollo explícito: fail-closed en host desplegado', /resolveBackendMode/.test(fs.readFileSync(path.join(dir, 'auth.js'), 'utf8')));
  return results;
}

/* ---------- 5. Edge service-to-service (regresión 9A) ---------- */
export function edgeServiceAuthChecks(root = REPO) {
  const read = (f) => fs.readFileSync(path.join(root, 'supabase/functions', f, 'index.ts'), 'utf8');
  const results = []; const add = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail });
  const admin = read('admin-resolve-identity-issue');
  add('admin-resolve-identity-issue: verify_jwt=false esperado y exige internamente la service role EXACTA (403 si no coincide)', EXPECTED_VERIFY_JWT['admin-resolve-identity-issue'] === false && /token !== SUPABASE_SERVICE_ROLE_KEY[\s\S]{0,80}403|!token \|\| token !== SUPABASE_SERVICE_ROLE_KEY/.test(admin));
  const cleanup = read('cleanup-abandoned-signups');
  add('cleanup-abandoned-signups: verify_jwt=false y autentica con service role exacta O secreto de Vault verificado por RPC; 403 en otro caso', EXPECTED_VERIFY_JWT['cleanup-abandoned-signups'] === false && /token === SUPABASE_SERVICE_ROLE_KEY/.test(cleanup) && /verify_cleanup_cron_secret/.test(cleanup) && /code: 'forbidden' \}, 403/.test(cleanup));
  const userFns = Object.entries(EXPECTED_VERIFY_JWT).filter(([, v]) => v === true).map(([k]) => k);
  add('las 11 funciones orientadas a usuario: verify_jwt=true y validan el JWT con getUser (nunca confían en el body)', userFns.length === 11 && userFns.every((f) => /auth\.getUser\(/.test(read(f))), userFns.join(','));
  return results;
}

/* ---------- 6. gates externos (NUNCA se marcan como PASS automático) ---------- */
export const EXTERNAL_GATES = [
  { id: 'G1', name: 'Comunicaciones / Auth-email', owner: 'Central (aplicar migración + Edge Functions) + Work (config hosted, secrets, QA real)', pending: 'Aplicar la migración 20261001100000 y desplegar account-challenge + delete-my-account en Staging; sincronizar templates/switches nativos (sync-auth-email-templates.mjs); cargar secrets BRAMU_* sin revelarlos; recepción/render real de los 8 emails.', automaticEvidence: 'Implementación técnica completa con tests (desafíos server-side, 2 verificaciones, delete_account, #8 tras postcondiciones, templates exactos == generados, replay limpio ×3 ACL). El ENVÍO real por SMTP y el render en clientes de correo no son verificables acá.', closesWith: 'QA real en Staging con emails reales: signup, recovery, cambio de email (#3→#4→#5), password changed (#6), eliminación (#7→#8) con una cuenta descartable.' },
  { id: 'G2', name: 'Browser / OTP humano', owner: 'Work (browser) + Sebastián (OTP de cuenta descartable)', pending: 'QA visual corto de Legal/Acceso y E2E destructivo real de eliminación.', automaticEvidence: 'Eliminación completa ensayada con fallos/retry sobre base efímera; harness e2e-delete-my-account.mjs (prepare/negatives automáticos) listo.', closesWith: 'send-otp → delete --otp → verify → cleanup sobre una cuenta descartable de Staging.' },
  { id: 'G3', name: 'Autorización de Production', owner: 'Sebastián', pending: 'Crear proyecto Supabase Production, replay real, variables Vercel, Edge Functions, cron, smoke y apertura; datos legales reales ([[PENDIENTE_PRODUCCION:*]]), AAIP/RNBDP; origen público estable de la app y, con él, BRAMU_EMAIL_LOGO_BASE (logo de emails Auth fuera de raw.githubusercontent) + BRAMU_PUBLIC_BASE_URL de las Edge (hardening 139).', automaticEvidence: 'release-check completo, build Production bloqueado por placeholders, replay limpio ×3 ACL, checklist en Runbook Parte B.', closesWith: 'Autorización explícita de Sebastián + datos reales; luego Runbook Parte B paso a paso.' },
  { id: 'G4', name: 'Plan real de backups de Supabase', owner: 'Sebastián (decisión de plan/región) + Central (prueba)', pending: 'Elegir plan/región/retención/PITR y probar una restauración GESTIONADA (incluye auth.*, storage.*, Vault).', automaticEvidence: 'Backup lógico de public ensayado (checksums, restauración sobre esquema limpio, resurrección de eliminaciones y su procedimiento). NO es un backup gestionado de Supabase.', closesWith: 'Decisión de plan + restauración de un backup gestionado a un proyecto efímero + re-aplicación del libro de eliminaciones.' },
];

export function buildPreflight(sections) {
  const auto = sections.map((s) => ({ section: s.name, total: s.items.length, failed: s.items.filter((i) => !i.ok).length }));
  const failed = auto.reduce((n, a) => n + a.failed, 0);
  return { automatic: { ok: failed === 0, failedChecks: failed, totalChecks: auto.reduce((n, a) => n + a.total, 0), bySection: auto }, externalGates: EXTERNAL_GATES.map((g) => ({ ...g, status: 'PENDIENTE EXTERNO' })),
    verdict: failed === 0 ? `AUTOMÁTICO: PASS · ${EXTERNAL_GATES.length} gates externos PENDIENTES (no bloquean la ronda técnica; bloquean abrir Production)` : `AUTOMÁTICO: FAIL (${failed} chequeos)` };
}

export function preflightMarkdown(pf) {
  return ['# Preflight operativo', '', `**${pf.verdict}**`, '', '## Automático', '', '| sección | chequeos | fallan |', '|---|---|---|', ...pf.automatic.bySection.map((a) => `| ${a.section} | ${a.total} | ${a.failed} |`), '', '## Gates externos (no automatizables)', '', ...pf.externalGates.flatMap((g) => [`### ${g.id} — ${g.name} — ${g.status}`, `- Responsable: ${g.owner}`, `- Pendiente: ${g.pending}`, `- Evidencia automática disponible: ${g.automaticEvidence}`, `- Se cierra con: ${g.closesWith}`, ''])].join('\n');
}

/* ---------- orquestación ---------- */
export async function runAll({ replay = true, ops = true, log = console.log } = {}) {
  const sections = []; const add = (name, items) => { sections.push({ name, items }); };
  const mig = listMigrations();
  add('migraciones', [{ name: `${mig.length} archivos, formato AAAAMMDDHHMMSS_nombre.sql, versiones únicas`, ok: checkMigrationNames(mig).length === 0, detail: checkMigrationNames(mig).join('; ') }]);
  const hc = scanHardcodes();
  add('hardcodes prohibidos', [{ name: 'sin project refs/JWT/keys/hosts/emails/seeds de entorno/UUID de fixtures en código fuente', ok: hc.length === 0, detail: hc.map((h) => `${h.id}@${h.file}:${h.sample}`).join('; ') }]);
  const ef = edgeFunctions();
  add('edge functions', [
    ...ef.map((f) => ({ name: `${f.name}: ${f.files.length} archivos resueltos · verify_jwt esperado=${f.verifyJwtExpected} · env=${f.env.join(',')}`, ok: f.problems.length === 0 && f.verifyJwtExpected !== undefined, detail: f.problems.join('; ') || (f.verifyJwtExpected === undefined ? 'sin verify_jwt declarado' : '') })),
    { name: 'cada función del repo tiene verify_jwt declarado y viceversa', ok: ef.map((f) => f.name).sort().join() === Object.keys(EXPECTED_VERIFY_JWT).sort().join(), detail: '' },
  ]);
  add('cliente', clientChecks());
  add('guardas de build', buildGuards());
  add('regresión 9A: Edge service-to-service', edgeServiceAuthChecks());
  let manifest = { generatedBy: 'release-check.mjs', migrations: mig.map((f) => ({ file: f, sha256: sha(fs.readFileSync(path.join(MIGRATIONS_DIR, f))) })), edgeFunctions: ef.map((f) => ({ name: f.name, verifyJwt: f.verifyJwtExpected, bundleHash: f.bundleHash, files: f.files })), version: JSON.parse(fs.readFileSync(path.join(REPO, 'bramulab/version.json'), 'utf8')) };
  if (replay) {
    const { ACL_SCENARIOS } = await import('./replay-migrations.mjs');
    const { verifyScenario } = await import('./verify-clean-room.mjs');
    const items = [];
    for (const acl of Object.keys(ACL_SCENARIOS)) {
      const rep = await verifyScenario(acl, { withVerifies: acl === 'observed' });
      const bad = [...rep.checks, ...(rep.smoke || [])].filter((c) => !c.ok);
      items.push({ name: `replay limpio ACL=${acl}: ${rep.migrations} migraciones, ${rep.checks.length + (rep.smoke || []).length} chequeos de estado inicial/privilegios/humo`, ok: rep.replayOk && bad.length === 0 && (!rep.verifies || rep.verifies.failed.length === 0), detail: rep.failedMigration ? `${rep.failedMigration.file}: ${rep.failedMigration.error}` : bad.map((b) => `${b.name} :: ${b.detail}`).join('; ') });
      if (rep.verifies) { manifest.repoVerifiesOnCleanRoom = { passed: rep.verifies.passed.length, needStagingData: rep.verifies.needsStagingData, notEvaluableInEngine: rep.verifies.notEvaluable.map((x) => x.file), failed: rep.verifies.failed }; }
    }
    add('replay limpio', items);
  }
  if (ops) {
    const { runOpsRehearsal } = await import('./ops-rehearsal.mjs');
    const r = await runOpsRehearsal();
    for (const sec of r.sections) add(`ensayo operativo ${sec.id} — ${sec.name}`, sec.items);
  }
  const preflight = buildPreflight(sections);
  manifest = { ...manifest, preflight };
  let ok = true;
  for (const s of sections) {
    log(`\n== ${s.name}`);
    for (const i of s.items) { log(`  ${i.ok ? '✔' : '✖'} ${i.name}${i.ok || !i.detail ? '' : `\n      ${i.detail}`}`); if (!i.ok) ok = false; }
  }
  log(`\n== PREFLIGHT\n  ${preflight.verdict}`);
  preflight.externalGates.forEach((g) => log(`  · ${g.id} ${g.name}: ${g.status} (${g.owner})`));
  return { ok, sections, manifest, preflight };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await runAll({ replay: !process.argv.includes('--no-replay'), ops: !process.argv.includes('--no-ops') });
  const pi = process.argv.indexOf('--preflight-md');
  if (pi > 0) fs.writeFileSync(process.argv[pi + 1], preflightMarkdown(r.preflight) + '\n');
  const mi = process.argv.indexOf('--manifest');
  if (mi > 0) fs.writeFileSync(process.argv[mi + 1], JSON.stringify(r.manifest, null, 2) + '\n');
  console.log(r.ok ? '\n[release-check] PASS' : '\n[release-check] FAIL');
  process.exit(r.ok ? 0 : 1);
}
