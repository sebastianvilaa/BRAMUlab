// BRAMUlab — SUPERFICIE DE PROMOCIÓN: «¿qué cambia para los jugadores si publico este SHA en Production?».
//
//   node bramulab/scripts/promotion-surface.mjs <SHA_PRODUCTION_ACTUAL> [<SHA_A_PUBLICAR> = HEAD] [--expect app.js,auth.js,sw.js,admin/]
//
// Construye `dist/` (la ÚNICA carpeta que Vercel publica) con el build de PRODUCTION (iconos oficiales, sin fixture de QA) para ambos commits y
// compara archivo por archivo, normalizando solo los marcadores de versión del bundle (`04.37-hNN`). Sale con código 1 si cambia algún archivo
// que NO figure en --expect (por defecto: el conjunto que Metrics toca). Es la prueba de que se promociona Metrics SIN arrastrar cambios ajenos.
// Solo lee Git: no hace red, no despliega, no toca ningún entorno.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
export const DEFAULT_EXPECT = Object.freeze(['app.js', 'auth.js', 'sw.js', 'store.js', 'index.html', 'styles.css', 'version.json', 'admin/']);
const VERSION_TOKENS = [/04\.\d{2}-h\d+/g, /04-\d{2}-h\d+/g];

export const normalizeVersion = (text) => VERSION_TOKENS.reduce((t, re) => t.replace(re, '<BUNDLE>'), text);

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base)); else out.push(path.relative(base, p));
  }
  return out.sort();
}

export async function buildProductionDist(sha, work) {
  const src = path.join(work, `src-${sha.slice(0, 8)}`); fs.mkdirSync(src, { recursive: true });
  const tar = execFileSync('git', ['-C', REPO, 'archive', sha, 'bramulab'], { maxBuffer: 1 << 30 });
  execFileSync('tar', ['-x', '-C', src], { input: tar });
  const mod = await import(pathToFileURL(path.join(src, 'bramulab', 'scripts', 'build-dist.mjs')).href);
  const out = path.join(work, `dist-${sha.slice(0, 8)}`);
  const r = mod.buildDist({ outDir: out, requireGenerated: false, iconVariant: 'official' });
  if (r.problems.length) throw new Error(`build de ${sha}: ${r.problems.join('; ')}`);
  return out;
}

export function compareDists(a, b) {
  const fa = walk(a); const fb = walk(b);
  const all = [...new Set([...fa, ...fb])].sort();
  const changes = [];
  for (const f of all) {
    const ina = fa.includes(f); const inb = fb.includes(f);
    if (!ina) { changes.push({ file: f, kind: 'nuevo' }); continue; }
    if (!inb) { changes.push({ file: f, kind: 'eliminado' }); continue; }
    const ba = fs.readFileSync(path.join(a, f)); const bb = fs.readFileSync(path.join(b, f));
    if (ba.equals(bb)) continue;
    const ta = normalizeVersion(ba.toString('latin1')); const tb = normalizeVersion(bb.toString('latin1'));
    changes.push({ file: f, kind: ta === tb ? 'solo versión' : 'contenido' });
  }
  return changes;
}

export function evaluate(changes, expect = DEFAULT_EXPECT) {
  const allowed = (f) => expect.some((e) => (e.endsWith('/') ? f.startsWith(e) : f === e));
  return { unexpected: changes.filter((c) => !allowed(c.file)), expected: changes.filter((c) => allowed(c.file)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const ei = process.argv.indexOf('--expect');
  const expect = ei >= 0 ? process.argv[ei + 1].split(',') : DEFAULT_EXPECT;
  const base = args[0]; const head = args[1] || 'HEAD';
  if (!base) { console.error('Uso: node bramulab/scripts/promotion-surface.mjs <SHA_PRODUCTION_ACTUAL> [<SHA_A_PUBLICAR>] [--expect a,b,dir/]'); process.exit(2); }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-surface-'));
  try {
    const a = await buildProductionDist(base, work); const b = await buildProductionDist(head, work);
    const changes = compareDists(a, b);
    const { unexpected, expected } = evaluate(changes, expect);
    console.log(`dist de Production: ${walk(a).length} archivos (actual) → ${walk(b).length} (a publicar)`);
    for (const c of expected) console.log(`  cambia (esperado)   ${c.file}  [${c.kind}]`);
    for (const c of unexpected) console.log(`  CAMBIA (INESPERADO) ${c.file}  [${c.kind}]`);
    console.log(unexpected.length ? `\nFALLA: ${unexpected.length} archivo(s) fuera de lo esperado.` : '\nOK: solo cambia lo esperado.');
    process.exit(unexpected.length ? 1 : 0);
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
