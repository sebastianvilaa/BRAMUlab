/* ==========================================================================
   BRAMU Lab — match-validation.js (Backend Bloque 6 — Fase B)
   Único punto de contacto con las Edge Functions/RPCs de validación oficial:
   Confirmar, Proponer corrección, Responder corrección, No participé/
   identidad, Notificaciones (ver
   docs/BRAMUlab/Implementacion/Backend/Bloque_06/13_Handoff_Fase_B_Claude.md).

   Mismo criterio EXACTO que auth.js/matches.js: única bisagra de red para
   este dominio, reutiliza `PLAuth.isConfigured()`/`PLAuth.getClient()` (el
   MISMO backend, la misma sesión) — nunca expone ni pide
   SUPABASE_SERVICE_ROLE_KEY. `admin-resolve-identity-issue` (SOLO
   alcanzable con esa key) queda deliberadamente FUERA de este archivo: no
   hay panel administrativo en la app (13_Handoff_Fase_B_Claude.md §5).

   Backend ya validado contra Supabase Staging real — ver
   12_Validacion_Backend_Staging_ChatGPT.md. Este archivo NUNCA reimplementa
   ninguna regla de negocio (ventanas de tiempo, autoridad por pareja,
   elegibilidad de Nivel): esas viven exclusivamente server-side; acá solo
   se empaquetan/traducen los parámetros y se normaliza la respuesta. */
(function (global) {
  'use strict';

  const Auth = global.PLAuth;

  function isConfigured() {
    return !!(Auth && Auth.isConfigured());
  }

  function getClient() {
    return Auth ? Auth.getClient() : null;
  }

  /** Confirmar (RPC B6 nativa `confirm_match_validation` vía la Edge Function
   *  `officialize-match`, C-02 de 10_Revision_Final_Pre_Staging_ChatGPT.md): exige autoridad
   *  real de pareja (action_side === equipo del caller) bajo lock — nunca un hack local, nunca
   *  reconstruye create_or_attach_match. Idempotente sobre un partido ya `validated`
   *  (B6-A-10): reintentar nunca duplica ni reemplaza el resultado vigente. Devuelve el jsonb
   *  tal cual: `{ok:true, code:'officialized'|'already_validated'|'confirmed_not_ready', matchId,
   *  resultId?, eligible?}` o `{ok:false, code}`. */
  async function officializeMatch(matchId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.functions.invoke('officialize-match', { body: { matchId } });
    if (error) return { ok: false, code: (data && data.code) || error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Proponer corrección de RESULTADO (Edge Function `propose-match-correction`) — pre o
   *  post-validación según el estado real del partido, la propia Edge Function/RPC decide cuál
   *  mecanismo aplica (revisión vigente vs. ventana de 3 días). `sets`:
   *  `[{gamesA,gamesB,tiebreakA?,tiebreakB?}, ...]`, MISMA orientación A/B que ya usa este
   *  partido (nunca se recalcula acá — server-side tampoco la recalcula por orden léxico,
   *  C-04). Nunca modifica participantes/identidad — eso es `reportIdentityIssue`/
   *  `resolveIdentityIssue`. */
  async function proposeMatchCorrection(matchId, sets) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.functions.invoke('propose-match-correction', { body: { matchId, sets } });
    if (error) return { ok: false, code: (data && data.code) || error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Responder una corrección post-validación pendiente (Edge Function
   *  `respond-match-correction`). `accept=false` rechaza (mutación directa, sin Nivel
   *  involucrado); `accept=true` acepta y reaplica Nivel atómicamente (B6-A-08) del lado del
   *  servidor — este archivo nunca calcula ni asume el resultado. */
  async function respondMatchCorrection(matchId, accept) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.functions.invoke('respond-match-correction', { body: { matchId, accept: !!accept } });
    if (error) return { ok: false, code: (data && data.code) || error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** "No participé" / identidad incorrecta (RPC `report_identity_issue`, alcanzable DIRECTO por
   *  `authenticated` vía `auth.uid()` — sin Edge Function de por medio, no hay cálculo del motor
   *  involucrado en abrir la incidencia, ver la migración). Respeta la ventana vigente
   *  (10 días post-validación / deadline de 30 días pre-validación) del lado del servidor —
   *  nunca se valida acá. `team`: 'A'|'B', `positionInTeam`: 1|2. */
  async function reportIdentityIssue(matchId, team, positionInTeam, reason) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('report_identity_issue', {
      p_match_id: matchId, p_team: team, p_position_in_team: positionInTeam, p_reason: reason || null,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Resolver una incidencia de identidad (Edge Function `resolve-identity-issue`) con un
   *  reemplazo real (`replacementPlayerId`, registrado o provisional seleccionable — la propia
   *  RPC valida la relación, B6-B-05) o materializando el vencimiento de 7 días
   *  (`forceUnidentified:true`, solo si la ventana ya venció — la RPC lo verifica). Nunca
   *  fabrica una identidad del lado del cliente. */
  async function resolveIdentityIssue(issueId, opts) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const o = opts || {};
    const body = { issueId };
    if (o.forceUnidentified) body.forceUnidentified = true;
    else body.replacementPlayerId = o.replacementPlayerId;
    const { data, error } = await c.functions.invoke('resolve-identity-issue', { body });
    if (error) return { ok: false, code: (data && data.code) || error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Bandeja de notificaciones del caller (RPC `get_notifications`) — YA incluye, del lado del
   *  servidor, tanto tareas accionables DERIVADAS en lectura (`pending_review`/
   *  `correction_proposed`/`identity_questioned`, C-08/C-10: desaparecen solas al resolverse,
   *  nunca marcables como leídas) como notificaciones persistidas informativas. `opts.limit`/
   *  `opts.onlyUnread` opcionales. */
  async function getNotifications(opts) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const o = opts || {};
    const { data, error } = await c.rpc('get_notifications', {
      p_limit: o.limit || 50,
      p_only_unread: !!o.onlyUnread,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return {
      ok: true,
      notifications: (Array.isArray(data) ? data : []).map((n) => ({
        id: n.notification_id,
        type: n.type,
        matchId: n.match_id,
        payload: n.payload || {},
        createdAt: n.created_at,
        readAt: n.read_at,
      })),
    };
  }

  /** Marca UNA notificación PERSISTIDA como leída (RPC `mark_notification_read`) — una tarea
   *  sintética (pending_review/correction_proposed/identity_questioned) nunca tiene una fila
   *  real que esta RPC pueda actualizar: llamarla con ese id es un no-op silencioso del lado del
   *  servidor (mismo criterio server-side, ver get_notifications). */
  async function markNotificationRead(notificationId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('mark_notification_read', { p_notification_id: notificationId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return data || { ok: true, updated: false };
  }

  async function markAllNotificationsRead() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('mark_all_notifications_read');
    if (error) return { ok: false, code: error.message || 'unknown' };
    return data || { ok: true, updated: 0 };
  }

  global.PLMatchValidation = {
    isConfigured, getClient,
    officializeMatch, proposeMatchCorrection, respondMatchCorrection,
    reportIdentityIssue, resolveIdentityIssue,
    getNotifications, markNotificationRead, markAllNotificationsRead,
  };
})(typeof window !== 'undefined' ? window : globalThis);
