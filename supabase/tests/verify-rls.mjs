#!/usr/bin/env node
// BRAMUlab — Bloque 1: verificación de RLS contra un proyecto Supabase REAL.
//
// Esto NO es parte de la suite local (tests.html ni node --test). Necesita
// red y las credenciales de un proyecto Supabase real con las migraciones
// 20260916120000_bloque1_environment_guard_and_identity_seed.sql y
// 20260916150000_bloque1_grant_app_config_select.sql aplicadas, en ese orden.
// Pensado para correr contra Staging antes de dar Bloque 1 por cerrado.
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=xxxx \
//   node supabase/tests/verify-rls.mjs
//
// Qué comprueba:
//   - lectura anónima de "players" -> vacía o rechazada
//   - escritura anónima en "players" -> rechazada
//   - lectura anónima de "app_config" -> permitida (única tabla con GRANT + política pública de lectura)
//
// Nota conceptual: GRANT y RLS son capas separadas en Postgres. "players" no
// tiene GRANT ni policy, así que un intento anónimo puede fallar por
// cualquiera de las dos razones (permission denied a nivel de tabla, o RLS
// sin policy) — ambas se ven desde afuera como "denegado" (vacío en un
// select, 401/403 en un insert), que es exactamente lo que expectDenied()
// verifica. No hace falta distinguir cuál de las dos capas lo bloqueó.
//
// SUPABASE_ANON_KEY actualmente contiene la Publishable Key nueva de Supabase
// (prefijo sb_publishable_...), no un JWT legacy "anon". Va SOLO en el header
// `apikey`: mandarla también como `Authorization: Bearer <key>` no es un JWT
// válido y PostgREST responde 401 en vez de aplicar RLS normalmente.

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el entorno de esta terminal.');
  console.error('Ejemplo: SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=xxxx node supabase/tests/verify-rls.mjs');
  process.exit(1);
}

const headers = { apikey: anonKey };

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
  expectDenied('lectura anónima de players debe volver vacía o rechazada', 'players?select=player_id'),
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
