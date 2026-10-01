// BRAMUlab — Pre-Bloque 9: rate limit por cuenta para Edge Functions (reusa consume_rate_limit vía la RPC
// service_role `consume_auth_rate_limit`, que resuelve el player server-side). Devuelve `true` si la llamada puede
// seguir. Ante un fallo de infraestructura del propio limitador se deja pasar (fail-open) y se registra el hecho
// sin datos personales: el límite es una defensa anti-abuso, no una autorización — la autorización real ya
// ocurrió (JWT verificado) y la RPC de negocio sigue validando todo.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function withinRateLimit(
  supabaseUrl: string,
  serviceRoleKey: string,
  authUserId: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc('consume_auth_rate_limit', {
      p_auth_user_id: authUserId,
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    if (error) { console.error('[rate-limit] limiter_error', action); return true; }
    return data !== false;
  } catch (_e) {
    console.error('[rate-limit] limiter_unavailable', action);
    return true;
  }
}
