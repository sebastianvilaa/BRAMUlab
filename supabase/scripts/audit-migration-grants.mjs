// BRAMUlab — Pre-Bloque 9: inventario ESTÁTICO de grants de funciones `public` a partir de las migraciones del repo
// (estado final aproximado por función: último CREATE + REVOKE/GRANT acumulados). Complementa — no reemplaza — la
// consulta viva supabase/tests/audit-live-grants.sql que Central corre contra Staging real.
//
// Clasifica cada función SECURITY DEFINER según quién puede ejecutarla:
//   anon-exec   → ejecutable sin sesión (solo permitido en ALLOWED_ANON)
//   auth-exec   → ejecutable por cualquier usuario autenticado (su autorización interna debe verificarse)
//   server-only → ni anon ni authenticated (service_role / interno)
// Uso: node supabase/scripts/audit-migration-grants.mjs [--json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** Funciones ejecutables por anon A PROPÓSITO (decisión de producto documentada). */
export const ALLOWED_ANON = new Set(['is_username_available']);
/** Helpers `authenticated` A PROPÓSITO: las usan políticas RLS de Storage evaluadas como el usuario. */
export const ALLOWED_AUTH_INTERNAL = new Set(['_group_photo_can_cleanup', '_group_photo_can_delete', '_group_photo_can_read', '_group_photo_can_write', '_group_photo_folder_group_id']);

export function inventory(dir = MIG_DIR) {
  const funcs = new Map();
  const grants = new Map();
  const fresh = () => ({ public: true, anon: null, authenticated: null });
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*returns\s+([\s\S]{0,400}?)\bas\b/gi)) {
      const name = m[1].toLowerCase();
      const header = (m[0] + sql.slice(m.index + m[0].length, m.index + m[0].length + 200)).toLowerCase();
      funcs.set(name, { secdef: /security\s+definer/.test(header), trigger: /^\s*trigger\b/i.test(m[3]), file });
      if (!grants.has(name)) grants.set(name, fresh());
    }
    for (const m of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?public\.(\w+)/gi)) grants.set(m[1].toLowerCase(), fresh());
    for (const m of sql.matchAll(/(revoke|grant)\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+public\.(\w+)\s*\([^)]*\)\s+(?:from|to)\s+([^;]+);/gi)) {
      const act = m[1].toLowerCase(); const name = m[2].toLowerCase();
      if (!grants.has(name)) grants.set(name, fresh());
      const g = grants.get(name);
      for (const r of m[3].split(',').map((x) => x.trim().toLowerCase())) {
        if (!['public', 'anon', 'authenticated'].includes(r)) continue;
        g[r] = act === 'grant';
      }
    }
  }
  const rows = [];
  for (const [name, f] of [...funcs.entries()].sort()) {
    const g = grants.get(name) || fresh();
    const anon = g.anon === true || (g.public && g.anon !== false);
    const auth = g.authenticated === true || (g.public && g.authenticated !== false);
    rows.push({ name, secdef: f.secdef, trigger: f.trigger, file: f.file, exposure: anon ? 'anon-exec' : auth ? 'auth-exec' : 'server-only' });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = inventory();
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const c = {}; rows.forEach((r) => { const k = `${r.secdef ? 'secdef' : 'invoker'}/${r.exposure}`; c[k] = (c[k] || 0) + 1; });
    console.log(`${rows.length} funciones`, c);
    rows.filter((r) => r.secdef && (r.exposure === 'anon-exec' || (r.exposure === 'auth-exec' && (r.trigger || r.name.startsWith('_') || r.name.startsWith('admin_'))))).forEach((r) => console.log(' revisar:', r.exposure, r.name));
  }
}
