#!/usr/bin/env node
// BRAMUlab — Bloque 1: verificación de RLS contra un proyecto Supabase REAL.
//
// Esto NO es parte de la suite local (tests.html ni node --test). Necesita
// red y las credenciales de un proyecto Supabase real con la migración
// 20260916120000_bloque1_environment_guard_and_identity_seed.sql aplicada.
// Pensado para correr contra Staging antes de dar Bloque 1 por cerrado.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   node supabase/tests/verify-rls.mjs
//
// Qué comprueba:
//   - lectura anónima de "players" -> vacía (RLS sin política de select deniega filas)
//   - escritura anónima en "players" -> rechazada
//   - lectura anónima de "app_config" -> permitida (única tabla con política pública de lectura)

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx node supabase/tests/verify-rls.mjs');
  process.exit(1);
}

const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

async function expectDenied(label, path, init) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers, ...init });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // respuesta sin cuerpo JSON (por ejemplo 401/403 planos) — no es un problema acá
  }
  const emptySelect = res.ok && Array.isArray(body) && body.length === 0;
  const rejected = res.status === 401 || res.status === 403;
  const denied = emptySelect || rejected;
  console.log(`${denied ? 'OK   ' : 'FALLA'} ${label} -> status ${res.status}`);
  return denied;
}

async function expectAllowed(label, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers });
  const allowed = res.ok;
  console.log(`${allowed ? 'OK   ' : 'FALLA'} ${label} -> status ${res.status}`);
  return allowed;
}

const checks = [
  expectDenied('lectura anónima de players debe volver vacía', 'players?select=player_id'),
  expectDenied('escritura anónima en players debe ser rechazada', 'players', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ display_name: 'rls-test-should-fail' }),
  }),
  expectAllowed('lectura pública de app_config debe funcionar', 'app_config?select=environment'),
];

const results = await Promise.all(checks);
const allPassed = results.every(Boolean);

console.log('');
console.log(allPassed ? 'RLS OK: deny-by-default se cumple.' : 'RLS: hay fallas — revisar políticas antes de cerrar Bloque 1.');
process.exit(allPassed ? 0 : 1);
