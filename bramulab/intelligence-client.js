/* ==========================================================================
   BRAMU Lab — intelligence-client.js (Backend Bloque 8, Fase D)
   Único punto de contacto con la Edge Function server-side de BRAMU
   Intelligence real (`get-match-intelligence`).

   Mismo criterio EXACTO que match-validation.js/matches.js/auth.js: única
   bisagra de red para este dominio, reutiliza `PLAuth.isConfigured()`/
   `PLAuth.getClient()` (el MISMO backend, la misma sesión) — nunca expone
   ni pide SUPABASE_SERVICE_ROLE_KEY. El navegador manda como máximo el
   `matchId`: nunca elige ni envía un `playerId` (la función lo deriva de
   la sesión — handoff Bloque_08/15_Handoff_Fase_D_Claude.md §9).

   Este archivo NUNCA calcula BRAMU Intelligence por su cuenta ni importa
   los módulos puros de A/B/C/D — esos corren exclusivamente server-side
   dentro de la Edge Function. Acá solo se empaqueta la llamada y se
   normaliza la respuesta, igual que el resto de la familia de clientes. */
(function (global) {
  'use strict';

  const Auth = global.PLAuth;

  function isConfigured() {
    return !!(Auth && Auth.isConfigured());
  }

  function getClient() {
    return Auth ? Auth.getClient() : null;
  }

  /** Devuelve `{ok:true, output, regenerated}` con la salida ya renderizada (principal/
   *  secundarios/abstención/aprendizaje/"why") o `{ok:false, code}`. `code==='match_not_available'`
   *  cubre tanto "no participás" como "no existe" como "está oculto" — nunca distingue cuál, mismo
   *  criterio de no-filtración que `get_match_detail` (Bloque 5/6). */
  async function getMatchIntelligence(matchId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    if (!matchId) return { ok: false, code: 'missing_match_id' };
    const { data, error } = await c.functions.invoke('get-match-intelligence', { body: { matchId } });
    if (error) return { ok: false, code: (data && data.code) || error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  global.PLIntelligenceClient = {
    isConfigured,
    getMatchIntelligence,
  };
})(typeof window !== 'undefined' ? window : globalThis);
