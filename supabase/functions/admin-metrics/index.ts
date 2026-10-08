// BRAMUlab — BRAMU Metrics V1 (F2): lectura agregada para el panel privado /admin/metrics.
//
// Ver docs/BRAMUlab/Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md §3 y §5.1.
// La decisión de negocio vive en ../_shared/admin-metrics-core.mjs (probada en Node con fakes).
//
// Contrato:
//   POST  Authorization: Bearer <JWT de la sesión del administrador>
//   body: { section: overview|users|matches|activation|community|usage, range?: 7d|30d|90d|all, compare?: boolean, includeInternal?: boolean }
//   F6 Explorar (mismo endpoint, misma autorización): body { catalog: true } o { metric, range?, compare?, includeInternal?, filter?: {id, value} } -> metrics_explore_catalog / metrics_explore
//     (catálogo cerrado; el filtro es un id declarado + valor acotado que SOLO se compara con las opciones que el SQL calcula; nunca SQL, tablas ni columnas del cliente).
//   * JWT verificado (verify_jwt=true y además auth.getUser acá); el jugador/administrador sale SIEMPRE del JWT, nunca del body;
//   * autorización en servidor en CADA llamada: UUID en public.metrics_admins sin revocar (RPC metrics_is_admin) -> 403 genérico idéntico;
//   * rate limit por cuenta (60/min) DESPUÉS de autorizar; body validado DESPUÉS (un no-admin no puede sondear la validación);
//   * la sección se mapea a una función SQL FIJA (metrics_*, ejecutables solo por service_role): sin SQL libre, sin nombres del cliente;
//   * solo agregados: ninguna respuesta trae UUID/email/@usuario/nombre; Cache-Control: no-store.
// Se despliega con verify_jwt=true. NO expone la service role al navegador: la usa solo acá, dentro de Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handleAdminMetrics } from '../_shared/admin-metrics-core.mjs';
import { withinRateLimit } from '../_shared/rate-limit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const { status, body: out } = await handleAdminMetrics({
      jwt,
      body,
      // Verifica el JWT con el cliente ANON (nunca con la service role para esto), igual que las demás funciones de usuario.
      getUser: async (token: string) => {
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data, error } = await userClient.auth.getUser(token);
        return error || !data?.user ? null : { id: data.user.id };
      },
      isAdmin: async (authUserId: string) => {
        const { data, error } = await admin.rpc('metrics_is_admin', { p_auth_user_id: authUserId });
        return !error && data === true;
      },
      withinRateLimit: (authUserId: string) => withinRateLimit(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, authUserId, 'edge_admin_metrics', 60, 60),
      callSection: (fn: string, args: Record<string, unknown>) => admin.rpc(fn, args),
      log: (code: string) => console.error(`[admin-metrics] ${code}`),
    });
    return jsonResponse(out, status);
  } catch (_e) {
    console.error('[admin-metrics] unexpected failure');
    return jsonResponse({ ok: false, code: 'metrics_failed' }, 500);
  }
});
