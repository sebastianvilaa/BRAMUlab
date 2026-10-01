// BRAMUlab — Bloque 9B: mecanismo de backup LÓGICO ensayable (datos de `public` en JSON + checksum por tabla) y su restauración.
//
// ALCANCE HONESTO: esto demuestra el mecanismo lógico y las PROPIEDADES que importan (integridad, restauración sobre esquema
// limpio replayado, y qué pasa con las eliminaciones de cuentas). NO es un backup gestionado de Supabase: no cubre `auth.*`
// (usuarios/hashes), `storage.*` (objetos), Vault ni PITR; eso depende del plan/región REAL de Supabase y queda como gate externo.
// Funciona sobre cualquier cliente con `.query(sql, params)` (PGlite o `pg`).

import crypto from 'node:crypto';

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

export async function listPublicTables(db) {
  return (await db.query(`select c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`)).rows.map((r) => r.t);
}

const canonical = (rows) => JSON.stringify(rows.map((r) => JSON.stringify(r)).sort());
export const checksumRows = (rows) => crypto.createHash('sha256').update(canonical(rows)).digest('hex');

/** Vuelca todas las tablas de public. `checksums` permite verificar la restauración sin comparar fila a fila. */
export async function dumpPublicData(db) {
  const tables = {}; const checksums = {};
  for (const t of await listPublicTables(db)) {
    const rows = (await db.query(`select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) as r from public.${ident(t)} x`)).rows[0].r;
    tables[t] = rows; checksums[t] = checksumRows(rows);
  }
  return { format: 1, takenAt: new Date().toISOString(), scope: 'public-only (sin auth.*, storage.*, vault)', tables, checksums };
}

/** Restaura sobre una base con el esquema ya replayado (REEMPLAZA todo el contenido de `public`, incluidos los datos de referencia que
 *  sembraron las migraciones: el dump los trae). Desactiva triggers/FKs durante la carga
 *  (`session_replication_role = replica`: los triggers no deben re-disparar efectos al restaurar) y los reactiva siempre. */
export async function restorePublicData(db, dump) {
  if (!dump || dump.format !== 1) throw new Error('dump inválido');
  await db.exec(`set session_replication_role = replica`);
  try {
    const all = await listPublicTables(db);
    await db.exec(`truncate table ${all.map((t) => `public.${ident(t)}`).join(', ')} restart identity cascade`);
    for (const [t, rows] of Object.entries(dump.tables)) {
      if (!rows.length) continue;
      await db.query(`insert into public.${ident(t)} select * from jsonb_populate_recordset(null::public.${ident(t)}, $1::jsonb)`, [JSON.stringify(rows)]);
    }
  } finally { await db.exec(`set session_replication_role = origin`); }
  const after = await dumpPublicData(db);
  const mismatched = Object.keys(dump.checksums).filter((t) => dump.checksums[t] !== after.checksums[t]);
  return { ok: mismatched.length === 0, mismatched, tables: Object.keys(dump.tables).length, rows: Object.values(dump.tables).reduce((n, r) => n + r.length, 0) };
}

/** Libro de eliminaciones: player_ids de cuentas eliminadas. DEBE guardarse FUERA del backup (un backup anterior a una eliminación
 *  la "resucita"): permite re-aplicar las eliminaciones tras restaurar. Solo ids técnicos, sin PII. */
export async function exportDeletionLedger(db) {
  return (await db.query(`select distinct player_id from public.pilot_events where event_name = 'account_deleted' and player_id is not null order by 1`)).rows.map((r) => r.player_id);
}
