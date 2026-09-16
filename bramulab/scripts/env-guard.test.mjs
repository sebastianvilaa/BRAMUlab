// Bloque 1 — pruebas locales de la guarda ambiental (sin red, sin filesystem).
// Ejecutar con: node --test bramulab/scripts/env-guard.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from './env-guard.mjs';

const base = {
  envName: 'staging',
  supabaseUrl: 'https://example-staging.supabase.co',
  supabaseAnonKey: 'anon-key-staging',
  vercelEnv: 'preview',
  isVercelBuild: true,
};

test('falla si falta BRAMU_ENV_NAME', () => {
  const result = validateEnv({ ...base, envName: undefined });
  assert.equal(result.ok, false);
});

test('falla si BRAMU_ENV_NAME no es un valor válido', () => {
  const result = validateEnv({ ...base, envName: 'produccion' });
  assert.equal(result.ok, false);
});

test('falla si falta SUPABASE_URL', () => {
  const result = validateEnv({ ...base, supabaseUrl: undefined });
  assert.equal(result.ok, false);
});

test('falla si falta SUPABASE_ANON_KEY', () => {
  const result = validateEnv({ ...base, supabaseAnonKey: undefined });
  assert.equal(result.ok, false);
});

test('permite Development local sin VERCEL_ENV (no es build de Vercel)', () => {
  const result = validateEnv({
    envName: 'development',
    supabaseUrl: 'https://example-dev.supabase.co',
    supabaseAnonKey: 'anon-key-dev',
    vercelEnv: undefined,
    isVercelBuild: false,
  });
  assert.equal(result.ok, true);
});

test('permite Production real: VERCEL_ENV=production + BRAMU_ENV_NAME=production', () => {
  const result = validateEnv({
    ...base,
    envName: 'production',
    supabaseUrl: 'https://example-prod.supabase.co',
    supabaseAnonKey: 'anon-key-prod',
    vercelEnv: 'production',
  });
  assert.equal(result.ok, true);
});

test('permite Staging real: VERCEL_ENV=preview + BRAMU_ENV_NAME=staging', () => {
  const result = validateEnv(base);
  assert.equal(result.ok, true);
});

test('bloquea Production de Vercel usando credenciales que no son de Production', () => {
  const result = validateEnv({
    ...base,
    envName: 'staging',
    vercelEnv: 'production',
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Production nunca puede usar credenciales/);
});

test('bloquea un deploy no-Production (preview/staging) usando credenciales de Production', () => {
  const result = validateEnv({
    ...base,
    envName: 'production',
    vercelEnv: 'preview',
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /nunca pueden usar credenciales de Production/);
});

test('fuera de Vercel (isVercelBuild=false) no cruza VERCEL_ENV aunque venga distinto', () => {
  const result = validateEnv({
    envName: 'production',
    supabaseUrl: 'https://example-prod.supabase.co',
    supabaseAnonKey: 'anon-key-prod',
    vercelEnv: 'preview',
    isVercelBuild: false,
  });
  assert.equal(result.ok, true);
});
