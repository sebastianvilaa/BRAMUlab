/* ==========================================================================
   BRAMU Lab — matches.js (Backend Bloque 5)
   Único punto de contacto con las RPCs/Edge Function de partidos compartidos
   (`create_or_attach_match`, `get_my_matches`, `get_match_detail`,
   `hide_match_for_me`, `set_match_private_note`, `get_pending_action_count`,
   `list_related_provisional_players` — ver
   supabase/migrations/20260920{180000,190000,200000}_bloque5_*.sql y
   supabase/functions/create-or-attach-match/index.ts).

   Mismo criterio exacto que auth.js (Bloque 2): este módulo es la ÚNICA
   bisagra de red para el dominio de partidos — reutiliza `PLAuth.isConfigured()`/
   `PLAuth.getClient()` en vez de duplicar la detección de backend/cliente
   Supabase (es el MISMO backend, la misma sesión). Sin backend configurado,
   `isConfigured()` devuelve `false` y ningún llamador de este archivo debería
   ejecutarse — la carga 100% local (match-load.js + Store.upsertHistory)
   sigue intacta, sin ningún cambio, para esa cuenta.

   Backend real validado contra Supabase Staging (ver
   docs/BRAMUlab/Implementacion/Backend/Bloque_05/08_Validacion_Backend_Staging_ChatGPT.md).
   Wiring de frontend cableado en app.js desde
   09_Resultado_Wiring_Frontend_Claude.md — ver ese documento para el flujo
   completo (selector server-backed, outbox, historial compartido).
   ========================================================================== */
(function (global) {
  'use strict';

  const Auth = global.PLAuth;

  function isConfigured() {
    return !!(Auth && Auth.isConfigured());
  }

  function getClient() {
    return Auth ? Auth.getClient() : null;
  }

  /** UUID v4 simple para `idempotencyKey`/`localDraftId` — sin dependencias externas. Usa
   *  `crypto.randomUUID()` cuando existe (todos los navegadores relevantes del piloto lo
   *  soportan); fallback manual solo por si corre en un contexto sin `crypto` real (nunca
   *  debería pasar en producción, pero evita romper si algún test headless no lo expone). */
  function genUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Crea o adjunta un partido compartido (RPC `create_or_attach_match`, vía la Edge Function
   *  `create-or-attach-match` — nunca se llama la RPC directo desde el cliente, no está
   *  otorgada a `authenticated`). `payload` en camelCase (mismo vocabulario que el resto del
   *  módulo): `{ idempotencyKey?, pair1PlayerIds:[id,id], pair2PlayerIds:[id,id],
   *  rawSets:[{a,b},...], formatId, playedAtIso, playedAtTimeKnown, reportedTimeZone?,
   *  scoringSystem?, locationName?, locationLat?, locationLng?, disambiguationMatchId?,
   *  disambiguationForceNew? }`. Si no se manda `idempotencyKey`, se genera una nueva — el
   *  llamador (outbox de store.js) es quien debe conservarla para reintentar el MISMO intento
   *  lógico sin duplicar (02_Analisis_Claude.md §5.5/§7). Devuelve el `jsonb` de la RPC tal
   *  cual: `{ok:true, code:'created'|'matched_confirmed'|'matched_same_side'|'matched_revised'|
   *  'already_validated', matchId, status, actionSide?}` o `{ok:false, code, candidates?}`. */
  async function createOrAttach(payload) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const p = payload || {};
    const body = {
      idempotencyKey: p.idempotencyKey || genUuid(),
      pair1PlayerIds: p.pair1PlayerIds,
      pair2PlayerIds: p.pair2PlayerIds,
      rawSets: p.rawSets,
      formatId: p.formatId,
      playedAtIso: p.playedAtIso,
      playedAtTimeKnown: !!p.playedAtTimeKnown,
      reportedTimeZone: p.reportedTimeZone || null,
      scoringSystem: p.scoringSystem || null,
      locationName: p.locationName || null,
      locationLat: Number.isFinite(p.locationLat) ? p.locationLat : null,
      locationLng: Number.isFinite(p.locationLng) ? p.locationLng : null,
      disambiguationMatchId: p.disambiguationMatchId || null,
      disambiguationForceNew: !!p.disambiguationForceNew,
    };
    const { data, error } = await c.functions.invoke('create-or-attach-match', { body });
    if (error) return classifyInvokeError(data, error);
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** V04.30 (B2) — distingue los tres orígenes de un fallo de `functions.invoke`, que antes se
   *  colapsaban en "Sin conexión":
   *   - negocio (HTTP 4xx/409 con `{code}` en el body, ej. `invalid_sets`): se devuelve el body tal cual;
   *   - servidor (HTTP 5xx, ej. `persist_failed`): `{ok:false, code, serverError:true}` — el servidor
   *     respondió, así que NO es "sin conexión";
   *   - red real (`FunctionsFetchError`, sin Response): `{ok:false, code:'network_error', offline:true}`.
   *  supabase-js v2 solo expone el body de una respuesta non-2xx vía `error.context.json()`. */
  async function classifyInvokeError(data, error) {
    const ctx = error && error.context;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
    if (ctx && typeof ctx.json === 'function') {
      let body = null;
      try { body = await ctx.json(); } catch (_e) { body = null; }
      const code = (body && typeof body === 'object' && body.code) || (data && data.code) || null;
      if (status !== null && status >= 500) return { ok: false, code: code || 'server_error', serverError: true };
      if (code) return Object.assign({}, body && typeof body === 'object' ? body : { ok: false, code }, { httpStatus: status });
      return { ok: false, code: 'server_error', serverError: true };
    }
    if (data && data.code) return { ok: false, code: data.code };
    return { ok: false, code: 'network_error', offline: true };
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /** V04.30 (B2) — un borrador local de outbox (`m_...`) NO es un match_id del servidor: nunca debe
   *  viajar a una RPC que espera UUID (22P02). */
  function isServerMatchId(id) { return typeof id === 'string' && UUID_RE.test(id); }

  /** `get_my_matches` es `returns table(...)`: PostgREST devuelve sus columnas en snake_case
   *  (`match_id`, `played_at`, ...), a diferencia de `get_match_detail` (un único `jsonb` que
   *  la propia RPC ya arma en camelCase). Se normaliza acá, en la ÚNICA frontera de red del
   *  dominio de partidos, para que todo lo que vive más allá de este archivo (match-sync.js,
   *  app.js) hable siempre el mismo vocabulario camelCase sin importar de qué RPC vino el dato. */
  function normalizeMyMatchesRow(row) {
    return {
      matchId: row.match_id,
      status: row.status,
      playedAt: row.played_at,
      playedAtTimeKnown: row.played_at_time_known,
      reportedTimeZone: row.reported_time_zone,
      formatId: row.format_id,
      scoringSystem: row.scoring_system,
      locationName: row.location_name,
      locationLat: row.location_lat,
      locationLng: row.location_lng,
      myTeam: row.my_team,
      actionSide: row.action_side,
      isActionMine: row.is_action_mine,
      readyForValidation: row.ready_for_validation,
      createdByPlayerId: row.created_by_player_id,
      validatedAt: row.validated_at,
      validationDeadlineAt: row.validation_deadline_at,
      hidden: row.hidden,
      privateNote: row.private_note,
      participants: row.participants,
      sets: row.sets,
      // Backend Bloque 6 (Fase B) — extensión de get_my_matches (03_Plan_Implementacion_
      // Claude.md, ver 20260921220000_bloque6_read_rpcs.sql): distingue "corrección propuesta"/
      // "identidad cuestionada" de un pendiente accionable normal, sin tocar ningún campo previo.
      pendingCorrectionRevisionId: row.pending_correction_revision_id || null,
      // V04.29-h2 — 'duplicate' = la corrección pendiente nació de reconciliar un posible duplicado tras vincular una identidad: no vence a los 3 días.
      pendingCorrectionOrigin: row.pending_correction_origin || null,
      hasOpenIdentityIssue: !!row.has_open_identity_issue,
    };
  }

  /** Feed de partidos del caller (RPC `get_my_matches`). `opts.limit`/`opts.includeHidden`
   *  opcionales. Devuelve `{ok:true, matches:[...]}`, ya normalizado a camelCase (ver
   *  `normalizeMyMatchesRow`), o `{ok:false, code}`. */
  async function getMyMatches(opts) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const o = opts || {};
    const { data, error } = await c.rpc('get_my_matches', {
      p_limit: o.limit || 50,
      p_include_hidden: !!o.includeHidden,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, matches: (Array.isArray(data) ? data : []).map(normalizeMyMatchesRow) };
  }

  /** Detalle completo de un partido (RPC `get_match_detail`). `null` (dentro de `{ok:true}`)
   *  si el caller no participa o el `matchId` no existe — nunca confirma ni niega cuál de los
   *  dos casos es (mismo criterio que `get_public_profile` en Bloque 4). */
  async function getMatchDetail(matchId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    if (!isServerMatchId(matchId)) return { ok: false, code: 'invalid_match_id' };
    const { data, error } = await c.rpc('get_match_detail', { p_match_id: matchId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, match: data || null };
  }

  /** Oculta/muestra un partido en el historial personal (RPC `hide_match_for_me`). NUNCA borra
   *  el partido compartido ni sus efectos oficiales — ver Backend_Infraestructura.md §8.8. */
  async function hideMatchForMe(matchId, hidden) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    if (!isServerMatchId(matchId)) return { ok: false, code: 'invalid_match_id' };
    const { data, error } = await c.rpc('hide_match_for_me', { p_match_id: matchId, p_hidden: hidden !== false });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** V04.36 — "Anular carga": el AUTOR retira su carga pendiente (RPC `annul_my_match_submission`). El servidor decide la
   *  elegibilidad (autor + pending + nadie más la reconoció) y es idempotente; NUNCA se infiere en cliente. Devuelve
   *  `{ok:true, code:'annulled'|'already_annulled'}` o `{ok:false, code}` (`not_author`, `not_pending`, `recognized_by_other`,
   *  `match_not_found`). No genera notificaciones ni efectos deportivos. */
  async function annulMySubmission(matchId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    if (!isServerMatchId(matchId)) return { ok: false, code: 'invalid_match_id' };
    const { data, error } = await c.rpc('annul_my_match_submission', { p_match_id: matchId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Nota privada por partido (RPC `set_match_private_note`) — dato privado, nunca compartido
   *  con los demás participantes. */
  async function setMatchPrivateNote(matchId, note) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    if (!isServerMatchId(matchId)) return { ok: false, code: 'invalid_match_id' };
    const { data, error } = await c.rpc('set_match_private_note', { p_match_id: matchId, p_note: note || null });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Contador personal de pendientes accionables + límite (RPC `get_pending_action_count`,
   *  Experiencia_Inicial.md §10). El mismo límite se re-verifica dentro de
   *  `create_or_attach_match` antes de intentar cualquier carga nueva — esta llamada es solo
   *  para que la UI muestre el estado sin intentar cargar. */
  async function getPendingActionCount() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_pending_action_count');
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return { ok: true, count: data.count, limit: data.limit, blocked: data.blocked };
  }

  /** Provisionales seleccionables por el caller para un partido nuevo (RPC
   *  `list_related_provisional_players`, Decisión #3 de 04_Revision_ChatGPT.md): las creadas
   *  por el caller MÁS las que ya compartieron un partido con él. Nunca las expone
   *  globalmente (no reemplaza `Auth.searchPlayers`) ni fusiona por nombre. */
  async function listRelatedProvisionalPlayers() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('list_related_provisional_players');
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, players: Array.isArray(data) ? data : [] };
  }

  global.PLMatches = {
    isConfigured, getClient, genUuid,
    createOrAttach, getMyMatches, getMatchDetail, isServerMatchId,
    hideMatchForMe, annulMySubmission, setMatchPrivateNote,
    getPendingActionCount, listRelatedProvisionalPlayers,
  };
})(typeof window !== 'undefined' ? window : globalThis);
