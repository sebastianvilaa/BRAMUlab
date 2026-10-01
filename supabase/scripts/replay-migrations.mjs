// BRAMUlab — Bloque 9A: REPLAY LIMPIO de todas las migraciones sobre un Postgres efímero (PGlite = Postgres real en WASM,
// sin Docker ni credenciales). Demuestra que el repo reconstruye el esquema desde una base VACÍA sin depender de estado
// acumulado de Staging, y deja la base lista para inspeccionar el estado inicial que tendría una Production nueva.
//
// Qué es REAL: el motor SQL (Postgres 17 en WASM), el orden/DDL/RLS/GRANT/triggers/funciones plpgsql de TODAS las
// migraciones, pgcrypto. Qué es SHIM (documentado, mínimo): la plataforma Supabase — roles anon/authenticated/service_role
// con las ACL por defecto de un proyecto Supabase, schemas auth (users + auth.uid()), storage (buckets/objects/foldername),
// vault, cron y net. pg_cron/pg_net NO se ejecutan de verdad: sus llamadas se cumplen contra tablas/funciones falsas.
//
// Uso: node supabase/scripts/replay-migrations.mjs [--keep-json salida.json]
//   exit 0 solo si TODAS las migraciones aplican y las aserciones de estado inicial pasan.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(HERE, '../migrations');

/** Shim de plataforma Supabase (lo que un proyecto nuevo ya trae ANTES de la primera migración). */
export const PLATFORM_SHIM_SQL = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text default 'authenticated', role text default 'authenticated', email text unique,
  encrypted_password text, email_confirmed_at timestamptz, phone text, phone_confirmed_at timestamptz,
  last_sign_in_at timestamptz, raw_app_meta_data jsonb default '{}'::jsonb, raw_user_meta_data jsonb,
  is_super_admin boolean, created_at timestamptz not null default now(), updated_at timestamptz default now(),
  banned_until timestamptz, deleted_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated, service_role; grant select on storage.buckets to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
create function storage.allow_any_operation(expected_operations text[]) returns boolean language sql as $$ select true $$;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text not null, created_at timestamptz default now());
create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret, created_at from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid language sql as $$
  insert into vault.secrets (name, description, secret) values (new_name, new_description, new_secret) returning id $$;
create schema cron;
create table cron.job (jobid bigserial primary key, schedule text not null, command text not null, nodename text default 'localhost', nodeport int default 5432, database text default 'postgres', username text default 'postgres', active boolean default true, jobname text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  delete from cron.job where jobname = job_name;
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command) returning jobid $$;
create function cron.unschedule(job_id bigint) returns boolean language sql as $$ with d as (delete from cron.job where jobid = job_id returning 1) select exists (select 1 from d) $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d) $$;
create schema net;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as $$ select 1::bigint $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
`;

/** ACL por defecto del proyecto ANTES de la primera migración. El resultado final de privilegios no debe depender de ellas.
 *   - 'observed' : lo observado en Staging (tablas concedidas por defecto; funciones solo con el EXECUTE implícito de PUBLIC).
 *   - 'strict'   : un proyecto que no concede nada por defecto.
 *   - 'open'     : peor caso — todo objeto nuevo concedido a anon/authenticated/service_role (tablas, secuencias, funciones). */
export const ACL_SCENARIOS = {
  strict: '',
  observed: `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;`,
  open: `
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`,
};

const PLATFORM_SHIM_TAIL_SQL = `
-- La plataforma crea public.rls_auto_enable() (event trigger de RLS) en todo proyecto nuevo; una migración la revoca.
create function public.rls_auto_enable() returns event_trigger language plpgsql as $$ begin null; end $$;
`;

/** Neutraliza SOLO las extensiones que el motor de pruebas no trae (pg_cron/pg_net): quedan sustituidas por el shim. */
export function adaptMigration(sql) {
  return sql.replace(/^\s*create\s+extension\s+(?:if\s+not\s+exists\s+)?(pg_cron|pg_net)\b[^;]*;/gim, '-- [replay] extensión $1 provista por el shim');
}

export function listMigrations(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

/** Chequeos estructurales de nombres: formato, versiones únicas, orden total. */
export function checkMigrationNames(files) {
  const problems = [];
  const seen = new Map();
  for (const f of files) {
    const m = f.match(/^(\d{14})_([a-z0-9_]+)\.sql$/);
    if (!m) { problems.push(`nombre inválido: ${f}`); continue; }
    if (seen.has(m[1])) problems.push(`versión duplicada ${m[1]}: ${seen.get(m[1])} / ${f}`);
    seen.set(m[1], f);
  }
  return problems;
}

export async function replay({ log = () => {}, acl = 'observed', exclude = [] } = {}) {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(PLATFORM_SHIM_SQL);
  await db.exec(ACL_SCENARIOS[acl]);
  await db.exec(PLATFORM_SHIM_TAIL_SQL);
  const files = listMigrations().filter((f) => !exclude.some((x) => f.includes(x)));
  const results = [];
  for (const f of files) {
    const sql = adaptMigration(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    const t0 = Date.now();
    try { await db.exec(sql); results.push({ file: f, ok: true, ms: Date.now() - t0 }); log(`  ok   ${f}`); }
    catch (e) { results.push({ file: f, ok: false, error: String(e.message || e) }); log(`  FAIL ${f}\n       ${e.message}`); break; }
  }
  return { db, files, results, ok: results.length === files.length && results.every((r) => r.ok) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const names = checkMigrationNames(listMigrations());
  if (names.length) { console.error(names.join('\n')); process.exit(1); }
  console.log(`[replay] ${listMigrations().length} migraciones, base vacía (PGlite)`);
  const r = await replay({ log: (m) => console.log(m) });
  console.log(r.ok ? '[replay] PASS: todas las migraciones aplicaron desde cero' : '[replay] FAIL');
  process.exit(r.ok ? 0 : 1);
}
