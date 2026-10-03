// BRAMUlab — V04.29-h2: Postgres REAL (proceso aparte, N conexiones) para probar concurrencia de verdad.
// PGlite es de UNA sola conexión, así que no puede ejercitar carreras entre transacciones. Este arnés levanta un Postgres real efímero con
// el paquete `embedded-postgres` (+ `pg`), replaya TODAS las migraciones con el mismo shim de plataforma que replay-migrations.mjs y
// entrega conexiones independientes. NO es dependencia del repo: si los paquetes no están instalados, `loadRealPg()` devuelve null y los
// tests de concurrencia real se omiten (con aviso). Para correrlos:
//   mkdir -p /tmp/bramu-pg && cd /tmp/bramu-pg && npm init -y && npm install embedded-postgres pg
//   (si npm no corre el postinstall: node node_modules/@embedded-postgres/<plataforma>/scripts/hydrate-symlinks.js)
//   BRAMU_PG_MODULES=/tmp/bramu-pg/node_modules node --test supabase/scripts/real-pg-concurrency.test.mjs
// Nunca se conecta a Supabase ni a ningún servidor existente: el cluster vive en un directorio temporal y se destruye al terminar.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createRequire } from 'node:module';
import { PLATFORM_SHIM_SQL, ACL_SCENARIOS, adaptMigration, listMigrations, MIGRATIONS_DIR } from './replay-migrations.mjs';

const SHIM_TAIL = `create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$;`;

function tryRequire(spec) {
  const candidates = [];
  if (process.env.BRAMU_PG_MODULES) candidates.push(path.join(process.env.BRAMU_PG_MODULES, 'noop.js'));
  candidates.push(import.meta.url.replace('file://', ''));
  for (const base of candidates) {
    try { return createRequire(base)(spec); } catch { /* siguiente */ }
  }
  return null;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on('error', reject);
  });
}

/** @returns {Promise<null | {connect: () => Promise<any>, stop: () => Promise<void>, admin: any}>} */
export async function loadRealPg({ log = () => {} } = {}) {
  const EmbeddedMod = tryRequire('embedded-postgres');
  const pgMod = tryRequire('pg');
  if (!EmbeddedMod || !pgMod) return null;
  const EmbeddedPostgres = EmbeddedMod.default || EmbeddedMod;
  const { Client } = pgMod;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bramu-realpg-'));
  const port = await freePort();
  const ep = new EmbeddedPostgres({ databaseDir: path.join(dir, 'data'), user: 'postgres', password: 'pw', port, persistent: false, onLog: () => {}, onError: () => {} });
  await ep.initialise();
  await ep.start();
  const conn = () => new Client({ host: '127.0.0.1', port, user: 'postgres', password: 'pw', database: 'postgres' });
  const admin = conn();
  await admin.connect();
  await admin.query(PLATFORM_SHIM_SQL);
  await admin.query(ACL_SCENARIOS.observed);
  await admin.query(SHIM_TAIL);
  const skip = (process.env.BRAMU_EXCLUDE_MIGRATIONS || '').split(',').filter(Boolean); // solo para demostrar la falla previa a un fix
  for (const f of listMigrations().filter((x) => !skip.some((k) => x.includes(k)))) {
    try { await admin.query(adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))); log(`  ok ${f}`); }
    catch (e) { await ep.stop(); throw new Error(`migración ${f}: ${e.message}`); }
  }
  await admin.query(`insert into public.app_config (id, environment) values (1, 'staging')`);
  const clients = [admin];
  return {
    admin,
    async connect() { const c = conn(); await c.connect(); clients.push(c); return c; },
    async stop() { for (const c of clients) { try { await c.end(); } catch { /* ya cerrado */ } } await ep.stop(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
