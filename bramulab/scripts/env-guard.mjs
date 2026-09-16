// Bloque 1 — Fundación de backend y entornos.
//
// Lógica pura de validación de configuración por entorno. No toca red ni
// filesystem: recibe variables ya leídas y devuelve si es seguro continuar.
// La separan de build-env.mjs para poder testearla sin Node de Vercel.

export const VALID_ENV_NAMES = ['development', 'staging', 'production'];

/**
 * @param {object} input
 * @param {string|undefined} input.envName - BRAMU_ENV_NAME declarado por quien despliega.
 * @param {string|undefined} input.supabaseUrl - SUPABASE_URL del proyecto a usar.
 * @param {string|undefined} input.supabaseAnonKey - SUPABASE_ANON_KEY del proyecto a usar.
 * @param {string|undefined} input.vercelEnv - VERCEL_ENV ("production" | "preview" | "development"), solo presente en builds de Vercel.
 * @param {boolean} input.isVercelBuild - true si process.env.VERCEL === "1".
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateEnv({ envName, supabaseUrl, supabaseAnonKey, vercelEnv, isVercelBuild }) {
  if (!envName) {
    return { ok: false, reason: 'Falta BRAMU_ENV_NAME.' };
  }
  if (!VALID_ENV_NAMES.includes(envName)) {
    return {
      ok: false,
      reason: `BRAMU_ENV_NAME="${envName}" no es válido. Debe ser uno de: ${VALID_ENV_NAMES.join(', ')}.`,
    };
  }
  if (!supabaseUrl) {
    return { ok: false, reason: 'Falta SUPABASE_URL.' };
  }
  if (!supabaseAnonKey) {
    return { ok: false, reason: 'Falta SUPABASE_ANON_KEY.' };
  }

  if (isVercelBuild) {
    const deployIsProduction = vercelEnv === 'production';
    const declaresProduction = envName === 'production';

    if (deployIsProduction && !declaresProduction) {
      return {
        ok: false,
        reason:
          `Vercel está desplegando a Production pero BRAMU_ENV_NAME="${envName}". ` +
          'Un deploy de Production nunca puede usar credenciales que no sean de Production.',
      };
    }
    if (!deployIsProduction && declaresProduction) {
      return {
        ok: false,
        reason:
          `Vercel está desplegando un entorno no-Production (VERCEL_ENV="${vercelEnv}") ` +
          'pero BRAMU_ENV_NAME="production". Staging/Development nunca pueden usar credenciales de Production.',
      };
    }
  }

  return { ok: true };
}
