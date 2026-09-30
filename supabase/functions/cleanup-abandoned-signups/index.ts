// BRAMUlab — V04.19 (L1): limpieza automática de altas abandonadas > 24 h (Privacidad_Legal.md §4).
//
// Server-only: EXIGE la service role key EXACTA en Authorization (mismo criterio que
// admin-resolve-identity-issue) — nunca un JWT de usuario, nunca alcanzable desde el cliente. Pensada para
// invocarse por Supabase Cron (pg_cron + pg_net) cada hora; ver supabase/scripts/schedule-cleanup-abandoned-signups.sql.
//
// La selección y la liberación de @usuario viven en SQL (list_abandoned_signups / release_abandoned_signup_username);
// el borrado del usuario Auth se hace SIEMPRE por la Auth Admin API (nunca DELETE directo sobre auth.users). La
// lógica de decisión está en ../_shared/abandoned-signups-core.mjs (testeada en Node con fakes).
//
// Solo registra un resumen operativo (contadores); nunca emails ni ids.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanupAbandonedSignups } from '../_shared/abandoned-signups-core.mjs';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, code: 'method_not_allowed' }, 405);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== SUPABASE_SERVICE_ROLE_KEY) return jsonResponse({ ok: false, code: 'forbidden' }, 403);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const summary = await cleanupAbandonedSignups({
      listCandidates: async (limit: number) => {
        const { data, error } = await admin.rpc('list_abandoned_signups', { p_min_age: '24 hours', p_limit: limit });
        if (error) throw new Error('list_failed');
        return data || [];
      },
      releaseUsername: async (userId: string) => {
        const { data, error } = await admin.rpc('release_abandoned_signup_username', { p_user_id: userId, p_min_age: '24 hours' });
        if (error) throw new Error('release_failed');
        return data;
      },
      getAuthUser: async (userId: string) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) {
          if ((error as { status?: number }).status === 404 || /not found/i.test(error.message || '')) return null;
          throw new Error('get_user_failed');
        }
        return data?.user || null;
      },
      deleteAuthUser: async (userId: string) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (!error) return { ok: true };
        if ((error as { status?: number }).status === 404 || /not found/i.test(error.message || '')) return { ok: false, notFound: true };
        return { ok: false };
      },
    });
    console.log('[cleanup-abandoned-signups]', JSON.stringify(summary));
    return jsonResponse({ ok: true, summary });
  } catch (_e) {
    console.error('[cleanup-abandoned-signups] failed');
    return jsonResponse({ ok: false, code: 'cleanup_failed' }, 500);
  }
});
