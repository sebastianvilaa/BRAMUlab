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
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_SECTIONS = { report: 'object', account: 'object', profile: 'object', legalAcceptances: 'array', levelEvents: 'array', matches: 'array', ranking: 'array', groups: 'array', notifications: 'array', intelligence: 'array', purposesAndRecipients: 'object' };
const SECRET_KEY_RE = /(encrypted_?password|password|secret|token|memory_after|^audit$|service_?role|api_?key)/i;
const THIRD_PARTY_KEY_RE = /(player_?ids?|user_?id|auth_?user_?id)$/i;

/** Defensa en profundidad del lado cliente: aun si el backend fallara, NO se escribe un informe que (a) esté incompleto,
 *  (b) contenga claves de secretos/internals o (c) referencie ids de otras personas. Devuelve la lista de problemas. */
export function validateReport(report, ownPlayerId) {
  const problems = [];
  if (!report || typeof report !== 'object') return ['informe vacío'];
  for (const [k, t] of Object.entries(REQUIRED_SECTIONS)) {
    const v = report[k];
    if (t === 'array' ? !Array.isArray(v) : !(v && typeof v === 'object' && !Array.isArray(v))) problems.push(`sección faltante o inválida: ${k}`);
  }
  if (report.account && report.account.playerId !== ownPlayerId) problems.push('account.playerId no coincide con el titular solicitado');
  const walk = (node, trail) => {
    if (Array.isArray(node)) node.forEach((x, i) => walk(x, `${trail}[${i}]`));
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (SECRET_KEY_RE.test(k)) problems.push(`clave de secreto/interna en ${trail}.${k}`);
        if (THIRD_PARTY_KEY_RE.test(k) && !(typeof v === 'string' && v === ownPlayerId)) problems.push(`referencia a otra persona en ${trail}.${k}`);
        walk(v, `${trail}.${k}`);
      }
    }
  };
  walk(report, '$');
  return problems;
}

const isTransient = (msg) => /fetch|network|timeout|timed out|econn|enotfound|socket|temporar|unavailable|\b5\d\d\b/i.test(String(msg || ''));
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/** Escritura ATÓMICA con permisos 0600: archivo temporal exclusivo en el mismo directorio + rename. Nunca deja un informe parcial
 *  (ante un fallo se borra el temporal) y NO pisa un archivo existente salvo `force` (un archivo previo puede tener permisos laxos). */
export function writeReportAtomic(file, content, { force = false } = {}) {
  const dir = path.dirname(path.resolve(file));
  if (fs.existsSync(file) && !force) return { ok: false, code: 'output_exists' };
  const tmp = path.join(dir, `.${path.basename(file)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, file);
    fs.chmodSync(file, 0o600);
    return { ok: true };
  } catch (e) {
    try { if (fd !== undefined) fs.closeSync(fd); } catch { /* ya cerrado */ }
    try { fs.rmSync(tmp, { force: true }); } catch { /* sin temporal */ }
    return { ok: false, code: 'write_failed', error: e.code || String(e.message) };
  }
}

/** Resuelve `@usuario` → player_id (solo lectura) o valida un UUID. */
export async function resolvePlayerRef(supabaseAdmin, ref) {
  const raw = String(ref || '').trim();
  if (UUID_RE.test(raw)) return { ok: true, playerId: raw.toLowerCase() };
  const username = raw.replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return { ok: false, code: 'invalid_reference' };
  const { data, error } = await supabaseAdmin.from('profiles').select('player_id').eq('username', username).maybeSingle();
  if (error) return { ok: false, code: 'lookup_failed' };
  if (!data) return { ok: false, code: 'player_not_found' };
  return { ok: true, playerId: data.player_id };
}

/** Reintenta SOLO errores transitorios de transporte (3 intentos); los códigos de negocio (account_deleted, player_not_found…) son
 *  definitivos. Valida el informe antes de devolverlo: un informe inválido es un FALLO, nunca un resultado parcial. */
export async function exportPlayerData(supabaseAdmin, ref, { retries = 3, sleep = sleepMs } = {}) {
  const resolved = await resolvePlayerRef(supabaseAdmin, ref);
  if (!resolved.ok) return resolved;
  let last;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const { data, error } = await supabaseAdmin.rpc('admin_export_player_data', { p_player_id: resolved.playerId });
    if (error) {
      last = { ok: false, code: 'rpc_failed', error: error.message, attempts: attempt };
      if (isTransient(error.message) && attempt < retries) { await sleep(200 * 2 ** (attempt - 1)); continue; }
      return last;
    }
    if (!data || data.ok !== true) return { ok: false, code: (data && data.code) || 'unknown' };
    const problems = validateReport(data, resolved.playerId);
    if (problems.length) return { ok: false, code: 'report_invalid', problems };
    return { ok: true, report: data, attempts: attempt };
  }
  return last;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const force = process.argv.includes('--force');
  const [ref, outFile] = args;
  if (!ref) { console.error('Uso: node admin-export-player-data.mjs <playerId | @usuario> [salida.json] [--force]'); process.exit(1); }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await exportPlayerData(admin, ref);
  if (!result.ok) { console.error(`[export] FALLÓ: ${result.code}${result.problems ? ` (${result.problems.length} problema(s); no se escribió nada)` : ''}`); process.exit(1); }
  const json = JSON.stringify(result.report, null, 2);
  if (outFile) {
    const w = writeReportAtomic(outFile, json, { force });
    if (!w.ok) { console.error(`[export] FALLÓ al escribir: ${w.code}${w.code === 'output_exists' ? ' (usar --force para reemplazar)' : ''}`); process.exit(1); }
    console.error(`[export] informe escrito en ${outFile} (permisos 0600)`);
  } else { console.log(json); }
  process.exit(0);
}
