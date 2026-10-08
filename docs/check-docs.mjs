#!/usr/bin/env node
// Chequeo de higiene documental de BRAMU (Metodo_Trabajo.md, «Higiene documental»).
//   node docs/check-docs.mjs
// Sale con código 1 si encuentra un error; las advertencias no cortan.
// Solo lee: no modifica nada. Vive en docs/ (fuera de bramulab/ y bramulive/) para no disparar builds.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execSync('git ls-files docs INDICE.md', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
const exists = new Set(tracked);
const errors = [];
const warnings = [];

// 1) Carpetas prohibidas: la historia vive en Git, no en Archivo/ ni Backup/.
for (const f of tracked) {
  if (/^docs\/BRAMUlab\/(Archivo|Backup)\//.test(f)) errors.push(`carpeta prohibida (usar Git): ${f}`);
}

// 2) Nombres tipo final_v2 / copia / old.
const BAD_NAME = /(final_final|final[_-]?v\d|_v\d+_final|_copia|_old(\.|_)|_backup|\(\d\)\.)/i;
for (const f of tracked) {
  if (BAD_NAME.test(path.basename(f))) errors.push(`nombre de versión improvisada: ${f}`);
}

// 3) README como mapa corto.
const README = 'docs/BRAMUlab/README.md';
const readmeBytes = fs.statSync(path.join(REPO, README)).size;
if (readmeBytes > 16 * 1024) errors.push(`${README} pesa ${(readmeBytes / 1024).toFixed(1)} KB (> 16 KB): el estado va en la tabla, la narrativa por ronda en el Informe de la versión`);

// 4) Referencias a archivos desde documentos vigentes (todo .md de docs/ salvo el registro histórico de Versiones/).
// Histórico/evidencia: citan por nombre documentos intermedios que se retiraron a propósito (nota de mantenimiento en cada uno).
const isHistorical = (f) => f.startsWith('docs/BRAMUlab/Versiones/') || f.startsWith('docs/BRAMUlive/') || f.startsWith('docs/BRAMUlab/Implementacion/');
const active = tracked.filter((f) => f.endsWith('.md') && !isHistorical(f));
const REF = /([A-Za-z0-9_.\-/]*[A-Za-z0-9_\-]+\.(?:md|json|mjs|svg|html))/g;
const cited = new Set();
function resolves(from, ref) {
  const cands = [ref, path.join(path.dirname(from), ref), path.join('docs/BRAMUlab', ref), path.join('docs', ref)].map((p) => path.normalize(p));
  return cands.find((c) => exists.has(c) || fs.existsSync(path.join(REPO, c))) || (ref.includes('/') ? tracked.find((t) => t.endsWith('/' + ref)) : undefined);
}
const allMd = tracked.filter((f) => f.endsWith('.md'));
for (const f of allMd) {
  const text = fs.readFileSync(path.join(REPO, f), 'utf8');
  // Texto entre ``` se ignora (ejemplos de comandos), y las rutas con comodines o placeholders también.
  const body = text.replace(/```[\s\S]*?```/g, '');
  body.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(REF)) {
      const ref = m[1].replace(/^\.\//, '');
      if (/[*<>…]|\.\.\./.test(ref) || /^https?:/.test(ref)) continue;
      if (/^_/.test(ref) || path.basename(ref).length < 6 || ref === 'LEEME.md') continue;   // abreviaturas («_UX_V1.md»), `p.md` de ejemplos y el LEEME de Dropbox
      if (!/\//.test(ref) && !/\.md$/.test(ref)) continue;     // un nombre suelto solo cuenta si es .md
      if (!/\.md$/.test(ref) && !/^(docs|Implementacion|Versiones|Marca|Auditorias|Referencias)\//.test(ref)) continue;
      // Nota: citas a documentos retirados dentro de una nota de mantenimiento o del registro de rondas son históricas.
      if (/retirad|Git|git log|git show/i.test(line)) continue;
      const hit = resolves(f, ref);
      if (hit) cited.add(hit);
      else if (/^[A-Za-z0-9_\-]+\.md$/.test(ref) && tracked.some((t) => path.basename(t) === ref)) cited.add(tracked.find((t) => path.basename(t) === ref));
      else if (!isHistorical(f)) errors.push(`${f}:${i + 1} referencia rota -> ${ref}`);
    }
  });
}

// 5) Documentos de Implementacion/ que ninguna fuente vigente cita (candidatos a poda).
for (const f of tracked) {
  if (!f.startsWith('docs/BRAMUlab/Implementacion/') || !f.endsWith('.md')) continue;
  if (path.basename(f) === 'README.md') continue;
  if (!cited.has(f)) warnings.push(`sin cita desde una fuente vigente (¿poda?): ${f.replace('docs/BRAMUlab/', '')}`);
}

console.log(`docs/check-docs: ${tracked.length} archivos versionados, README ${(readmeBytes / 1024).toFixed(1)} KB`);
for (const w of warnings) console.log(`  AVISO  ${w}`);
for (const e of errors) console.log(`  ERROR  ${e}`);
console.log(errors.length ? `\nFALLA: ${errors.length} error(es), ${warnings.length} aviso(s)` : `\nOK: 0 errores, ${warnings.length} aviso(s)`);
process.exit(errors.length ? 1 : 0);
