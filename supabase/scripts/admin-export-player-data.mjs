// BRAMUlab — V04.20 (L3): informe estandarizado de ACCESO/COPIA de datos propios (Privacidad_Legal.md §2).
//
// Flujo V1: la persona lo pide por email (bramulab@gmail.com); un operador corre este script con el @usuario o el
// player_id y le responde con el JSON (sin exportación autoservicio). SOLO lectura, service_role, vía la RPC
// `admin_export_player_data` (que ya redacta a terceros: de los demás participantes solo el nombre mostrado en ese
// partido; sin secretos ni auditoría interna).
//
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node admin-export-player-data.mjs <playerId | @usuario> [salida.json]
// Nunca commitear credenciales ni informes generados (contienen datos personales reales).

import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resuelve `@usuario` → player_id (solo lectura) o valida un UUID. */
export async function resolvePlayerRef(supabaseAdmin, ref) {
  const raw = String(ref || '').trim();
  if (UUID_RE.test(raw)) return { ok: true, playerId: raw };
  const username = raw.replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return { ok: false, code: 'invalid_reference' };
  const { data, error } = await supabaseAdmin.from('profiles').select('player_id').eq('username', username).maybeSingle();
  if (error) return { ok: false, code: 'lookup_failed' };
  if (!data) return { ok: false, code: 'player_not_found' };
  return { ok: true, playerId: data.player_id };
}

export async function exportPlayerData(supabaseAdmin, ref) {
  const resolved = await resolvePlayerRef(supabaseAdmin, ref);
  if (!resolved.ok) return resolved;
  const { data, error } = await supabaseAdmin.rpc('admin_export_player_data', { p_player_id: resolved.playerId });
  if (error) return { ok: false, code: 'rpc_failed', error: error.message };
  if (!data || data.ok !== true) return { ok: false, code: (data && data.code) || 'unknown' };
  return { ok: true, report: data };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = process.argv[2];
  const outFile = process.argv[3];
  if (!ref) { console.error('Uso: node admin-export-player-data.mjs <playerId | @usuario> [salida.json]'); process.exit(1); }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await exportPlayerData(admin, ref);
  if (!result.ok) { console.error(`[export] FALLÓ: ${result.code}`); process.exit(1); }
  const json = JSON.stringify(result.report, null, 2);
  if (outFile) { writeFileSync(outFile, json, { mode: 0o600 }); console.error(`[export] informe escrito en ${outFile}`); } else { console.log(json); }
  process.exit(0);
}
