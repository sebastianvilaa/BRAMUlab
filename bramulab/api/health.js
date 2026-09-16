// Bloque 1 — Fundación de backend y entornos.
//
// Health check mínimo: confirma que ESTE deploy (Development/Staging/Production)
// puede hablar con SU backend de Supabase y que ese backend se declara a sí
// mismo como el entorno correcto (tabla app_config, ver
// supabase/migrations/20260916120000_bloque1_environment_guard_and_identity_seed.sql).
//
// No usa el SDK de Supabase para no agregar dependencias: llama directo a la
// API REST (PostgREST) con la anon key. Nunca lee SUPABASE_SERVICE_ROLE_KEY.
//
// GET /api/health

export default async function handler(req, res) {
  const envName = process.env.BRAMU_ENV_NAME;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!envName || !supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      ok: false,
      error: 'missing_env_vars',
      detail: 'Faltan BRAMU_ENV_NAME, SUPABASE_URL o SUPABASE_ANON_KEY en este deploy.',
    });
  }

  let response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/app_config?select=environment,updated_at&limit=1`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: 'supabase_unreachable',
      detail: String(err && err.message ? err.message : err),
    });
  }

  if (!response.ok) {
    return res.status(502).json({
      ok: false,
      error: 'supabase_rest_error',
      status: response.status,
    });
  }

  let rows;
  try {
    rows = await response.json();
  } catch {
    return res.status(502).json({ ok: false, error: 'supabase_invalid_response' });
  }

  const row = Array.isArray(rows) ? rows[0] : null;

  if (!row || !row.environment) {
    return res.status(500).json({
      ok: false,
      error: 'app_config_not_seeded',
      detail: 'El proyecto Supabase conectado todavía no tiene la fila de app_config con su entorno declarado.',
      expectedEnvironment: envName,
    });
  }

  if (row.environment !== envName) {
    return res.status(500).json({
      ok: false,
      error: 'environment_mismatch',
      detail: 'Este deploy declara un entorno distinto al del proyecto Supabase al que está conectado. Revisar variables cruzadas.',
      expectedEnvironment: envName,
      supabaseDeclaredEnvironment: row.environment,
    });
  }

  return res.status(200).json({
    ok: true,
    environment: envName,
    supabase: 'reachable',
    supabaseConfigUpdatedAt: row.updated_at,
  });
}
