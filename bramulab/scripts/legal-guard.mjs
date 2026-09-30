// BRAMUlab — V04.20 (L3): guard de publicación de las páginas legales.
//
// Las páginas públicas (/terminos, /privacidad, /eliminar-cuenta) llevan datos que TODAVÍA no existen
// (nombre/domicilio del responsable, registro AAIP, proveedores y regiones reales, plazos de backups, fecha de
// vigencia) marcados con el formato literal `[[PENDIENTE_PRODUCCION:clave]]`. Staging los muestra tal cual (son
// visibles como pendientes). Production NO puede publicarse mientras quede alguno: build-env.mjs corta el build.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const LEGAL_PAGES = ['terminos/index.html', 'privacidad/index.html', 'eliminar-cuenta/index.html'];
const PLACEHOLDER_RE = /\[\[PENDIENTE_PRODUCCION:([a-z0-9_]+)\]\]/g;

/** Claves de placeholders pendientes en un HTML (únicas, en orden de aparición). */
export function findPendingPlaceholders(html) {
  const keys = [];
  for (const m of String(html || '').matchAll(PLACEHOLDER_RE)) if (!keys.includes(m[1])) keys.push(m[1]);
  return keys;
}

/** `{ok, missingFiles, pending: {archivo: [claves]}}` — ok solo si las 3 páginas existen y no tienen pendientes. */
export function checkLegalPagesReadyForProduction(baseDir) {
  const missingFiles = [];
  const pending = {};
  for (const rel of LEGAL_PAGES) {
    const file = path.join(baseDir, rel);
    if (!existsSync(file)) { missingFiles.push(rel); continue; }
    const keys = findPendingPlaceholders(readFileSync(file, 'utf8'));
    if (keys.length) pending[rel] = keys;
  }
  return { ok: missingFiles.length === 0 && Object.keys(pending).length === 0, missingFiles, pending };
}
