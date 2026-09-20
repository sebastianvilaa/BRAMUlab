/* ==========================================================================
   BRAMU Lab — auth.js (Backend Bloque 2)
   Único punto de contacto con Supabase Auth + las RPCs de perfil real
   (complete_profile/is_username_available, ver
   supabase/migrations/20260916180000_bloque2_auth_profile_username_location.sql).

   Reemplaza, para las cuentas reales, al sistema de cuentas 100% local de
   store.js (V03.0, ver comentario al inicio de store.js) — pero NO lo borra:
   ese bloque sigue existiendo para desarrollo local sin backend, cuentas
   legacy migradas y "crear usuario de prueba" del laboratorio (ver
   Store.createUserAccount/migrateLegacyPlayerToUserIfNeeded), que nunca
   tocan Supabase. `PLAuth.isConfigured()` es la única bisagra: si no hay
   backend real configurado (`window.__BRAMU_ENV__`, generado por
   bramulab/scripts/build-env.mjs — Bloque 1), el resto de la app sigue
   funcionando exactamente igual que hoy.

   `fetchOwnProfile()` arma un objeto con la MISMA forma que
   Store.createUserAccount para poder cachearlo con Store.cacheServerUser y
   que el resto de la app (Home, Grupos, Notificaciones, Ranking simulado,
   etc. — todos leen Store.getCurrentUser() de forma síncrona) siga
   funcionando sin ningún cambio: el "userId" que usan pasa a ser el
   player_id real de Supabase en vez de un id local `u_...`, pero para esos
   módulos sigue siendo un string opaco que identifica la cuenta.

   Campos que Backend_Infraestructura.md §6.1 NO define para `profiles`
   (teléfono/WhatsApp, avatar real, categoría declarada/Nivel) quedan en
   null/false acá: no se inventa una columna que el documento maestro no
   pidió. Ver el Informe de Bloque 2 para el detalle de qué falta y por qué. */
(function (global) {
  'use strict';

  let client = null;

  function isConfigured() {
    const env = global.__BRAMU_ENV__;
    return !!(env && env.supabaseUrl && env.supabaseAnonKey && global.supabase && global.supabase.createClient);
  }

  function getClient() {
    if (client) return client;
    if (!isConfigured()) return null;
    const env = global.__BRAMU_ENV__;
    client = global.supabase.createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // La confirmación de alta y la recuperación de contraseña usan un
        // código de 6 dígitos tipeado a mano (mismo patrón que ya existía
        // en #view-forgot-password), nunca un link con token en la URL —
        // así que nunca hay nada que "detectar" en location.hash/search.
        detectSessionInUrl: false,
      },
    });
    return client;
  }

  function mapAuthError(error) {
    if (!error) return null;
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return 'invalid_credentials';
    if (msg.includes('email not confirmed')) return 'email_not_confirmed';
    if (msg.includes('already registered') || msg.includes('user already registered')) return 'email_taken';
    if (msg.includes('token has expired') || msg.includes('otp expired')) return 'code_expired';
    if (msg.includes('invalid') && msg.includes('otp')) return 'code_invalid';
    if (msg.includes('token') && msg.includes('invalid')) return 'code_invalid';
    if (msg.includes('rate limit')) return 'rate_limited';
    return 'unknown';
  }

  async function signUp(email, password) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    // Supabase puede devolver un user obfuscado sin error si el email ya existe.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, reason: 'email_taken' };
    }
    return { ok: true, user: data.user };
  }

  /** Confirma el alta con el código de 6 dígitos del email ("Confirm signup"
   *  con `{{ .Token }}` en la plantilla — configuración manual pendiente,
   *  ver el Informe de Bloque 2). Establece sesión igual que un login. */
  async function verifySignupOtp(email, token) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true, session: data.session };
  }

  async function resendSignupOtp(email) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { error } = await c.auth.resend({ type: 'signup', email });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true };
  }

  async function signInWithPassword(email, password) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true, session: data.session };
  }

  async function signOut() {
    const c = getClient();
    if (!c) return { ok: true }; // nada que cerrar del lado del servidor
    const { error } = await c.auth.signOut();
    return { ok: !error };
  }

  async function getSession() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return (data && data.session) || null;
  }

  /** "Olvidé mi contraseña" — envía el código de 6 dígitos (misma nota que
   *  verifySignupOtp: depende de la plantilla "Reset Password" con
   *  `{{ .Token }}` en vez del link por defecto). */
  async function sendRecoveryOtp(email) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { error } = await c.auth.resetPasswordForEmail(email);
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true };
  }

  async function verifyRecoveryOtp(email, token) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true, session: data.session };
  }

  /** Requiere sesión activa — la deja `verifyRecoveryOtp` (recuperación) o
   *  ya la tenía el usuario (cambiar contraseña logueado). */
  async function updatePassword(password) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { error } = await c.auth.updateUser({ password });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    return { ok: true };
  }

  const COUNTRY_LABELS = { AR: 'Argentina' };

  /** Arma el objeto "user" con la MISMA forma que Store.createUserAccount —
   *  ver el comentario de cabecera. `null` si no hay sesión o el trigger
   *  todavía no corrió (no debería pasar: solo hay sesión tras confirmar el
   *  email, momento en el que el trigger de la migración ya insertó la fila).
   *  Backend Bloque 3 — además trae `level_states` (puede no existir todavía si el trigger
   *  corrió pero `level_states` no se creó por algún motivo excepcional; PENDIENTE es el
   *  default real del backend desde Bloque 3, ver la migración). `levelState` queda `null`
   *  solo en ese caso excepcional, nunca se inventa un estado. */
  async function fetchOwnProfile() {
    const c = getClient();
    if (!c) return null;
    const [{ data: userData, error: userError }, { data: profileRows, error: profileError }, { data: levelRows, error: levelError }] = await Promise.all([
      c.auth.getUser(),
      c.from('profiles').select('*, locations(province_label, locality_label, display_label, verified_for_ranking)'),
      c.from('level_states').select('*'),
    ]);
    if (userError || !userData || !userData.user) return null;
    if (profileError || !Array.isArray(profileRows) || !profileRows.length) return null;
    const profile = profileRows[0];
    const location = profile.locations || null;
    const levelState = (!levelError && Array.isArray(levelRows) && levelRows.length) ? levelRows[0] : null;
    const now = new Date().toISOString();
    return {
      id: profile.player_id,
      email: userData.user.email || null,
      password: null,
      username: profile.username || null,
      firstName: profile.first_name || null,
      lastName: profile.last_name || null,
      displayName: profile.display_name || null,
      birthDate: profile.birth_date || null,
      gender: profile.gender || null,
      dominantHand: profile.dominant_hand || null,
      preferredSide: profile.preferred_side || null,
      competitiveBranch: profile.competitive_branch || null,
      // Backend Bloque 3 — Nivel BRAMU ya es productivo: declaredCategory viene de
      // level_states (única fuente, nunca un segundo campo independiente en profiles).
      declaredCategory: levelState ? levelState.declared_category || null : null,
      declaredCategoryAt: levelState ? levelState.updated_at || null : null,
      // Backend Bloque 3 — estado oficial de Nivel BRAMU server-side. `null` únicamente en el
      // caso excepcional de que el trigger no haya podido crear la fila (nunca se inventa un
      // PENDIENTE local acá): app.js decide qué hacer con eso (retomar el borrador).
      levelState: levelState ? {
        status: levelState.status,
        mu: levelState.mu,
        confidence: levelState.confidence,
        ratedMatches: levelState.rated_matches,
        distinctOpponents: levelState.distinct_opponents,
        declaredCategory: levelState.declared_category,
        categoryContextKey: levelState.category_context_key,
        algorithmVersion: levelState.algorithm_version,
        questionnaireVersion: levelState.questionnaire_version,
        questionnaireMode: levelState.questionnaire_mode,
      } : null,
      // Avatar real necesita Supabase Storage — no está en el alcance de
      // Bloque 2 (Backend_Infraestructura.md §4.1 no lo incluye todavía).
      profilePhoto: null,
      locality: location ? location.locality_label : null,
      region: location ? location.province_label : null,
      country: location ? COUNTRY_LABELS.AR : null,
      rankingLocalZone: null,
      // Backend_Infraestructura.md §6.1 no define columnas de teléfono/
      // WhatsApp para `profiles` todavía — queda en null/false hasta que un
      // bloque futuro (o una actualización del documento maestro) las
      // agregue; nunca se inventa una columna nueva sin esa decisión.
      phone: null,
      allowWhatsAppContact: false,
      legacyMigrated: false,
      createdAt: profile.created_at || now,
      updatedAt: profile.updated_at || now,
      // Marca interna (no la usa store.js): permite a app.js distinguir una
      // cuenta real de Supabase de una cuenta local V03.0, por ejemplo para
      // no ofrecerle nunca "Completar acceso" (ya tiene email real).
      serverBacked: true,
    };
  }

  async function isUsernameAvailable(username) {
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.rpc('is_username_available', { p_username: username });
    if (error) return null;
    return !!data;
  }

  /** `fields` en camelCase (mismo vocabulario que signupDraft/store.js) —
   *  esta función traduce a los parámetros con nombre de la RPC. Devuelve
   *  `{ok:false, code}` con el código de excepción tal cual lo levanta
   *  complete_profile (username_locked/username_taken/... — ver la
   *  migración) para que app.js decida el mensaje en español. */
  async function completeProfile(fields) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const location = fields.location || {};
    const { data, error } = await c.rpc('complete_profile', {
      p_username: fields.username,
      p_first_name: fields.firstName || null,
      p_last_name: fields.lastName || null,
      p_display_name: fields.displayName,
      p_birth_date: fields.birthDate || null,
      p_gender: fields.gender || null,
      p_dominant_hand: fields.dominantHand || null,
      p_preferred_side: fields.preferredSide || null,
      p_competitive_branch: fields.competitiveBranch || null,
      p_location_country_code: 'AR',
      p_location_province_label: location.region || null,
      p_location_locality_label: location.locality || null,
      p_location_georef_province_id: location.provinceId || null,
      p_location_georef_locality_id: location.localityId || null,
      // Backend Bloque 3 (03_Revision_ChatGPT.md §10) — solo se manda cuando el borrador
      // realmente tiene una versión de términos aceptada; complete_profile conserva la
      // anterior si no se manda ninguna (coalesce, ver la migración).
      p_terms_version: fields.termsVersion || null,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, profile: data };
  }

  /** Backend Bloque 3 — llama a la Edge Function `officialize-onboarding` (motor JS
   *  compartido con el navegador, ver supabase/functions/officialize-onboarding/index.ts),
   *  única vía real de oficializar Nivel BRAMU server-side. `client.functions.invoke` adjunta
   *  solo el access token de la sesión ACTIVA (nunca uno viejo ni el de otra cuenta) — por
   *  eso esta función, a diferencia de completeProfile/isUsernameAvailable, exige sesión real
   *  (requiere el email ya confirmado: no hay sesión antes de eso, ver cabecera del archivo).
   *  `payload` viaja tal cual a la función — respuestas CRUDAS del cuestionario, nunca un
   *  Nivel ya calculado acá (la Edge Function es la que corre el motor con autoridad). */
  async function officializeLevel(payload) {
    const c = getClient();
    if (!c) return { ok: false, error: 'not_configured' };
    const { data, error } = await c.functions.invoke('officialize-onboarding', { body: payload });
    if (error) return { ok: false, error: (data && data.error) || error.message || 'unknown' };
    if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'unknown' };
    return { ok: true, levelState: data.levelState };
  }

  /** Backend Bloque 4 — búsqueda pública acotada de cuentas registradas (RPC `search_players`,
   *  ver la migración `20260920120000_bloque4_jugadores_busqueda_provisional.sql`).
   *  `authenticated` únicamente: solo tiene sentido llamarla con una cuenta `serverBacked` ya
   *  con sesión real (mismo criterio que el resto de este archivo — `isConfigured()` es la
   *  única bisagra). Devuelve `{ok:true, players:[...]}` con la forma exacta que ya declara la
   *  RPC (snake_case tal cual, `app.js` traduce a la forma que usa la UI) o `{ok:false, code}`
   *  con el código de excepción tal cual lo levanta la función (`rate_limited`, etc.). */
  async function searchPlayers(query, limit) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('search_players', { p_query: query, p_limit: limit || 20 });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, players: Array.isArray(data) ? data : [] };
  }

  /** Backend Bloque 4 — perfil público de un `player_id` puntual (RPC `get_public_profile`).
   *  `null` (nunca un objeto vacío) si la RPC no devolvió fila — provisional, inexistente o
   *  perfil todavía sin completar, ver la migración. */
  async function getPublicProfile(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_public_profile', { p_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    const row = Array.isArray(data) && data.length ? data[0] : null;
    return { ok: true, profile: row };
  }

  /** Backend Bloque 4 — crea SIEMPRE una nueva identidad provisional (RPC
   *  `create_provisional_player`, nunca reutiliza por nombre — ver 03_Revision_ChatGPT.md §3
   *  de Bloque 4). Reutilizar una ya existente es responsabilidad de Bloque 5 (selección
   *  explícita por `player_id`, ver `listMyProvisionalPlayers`). */
  async function createProvisionalPlayer(displayName) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('create_provisional_player', { p_display_name: displayName });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, player: data };
  }

  /** Backend Bloque 4 — provisionales creadas por la cuenta activa, todavía no reclamadas (RPC
   *  `list_my_provisional_players` — nunca una lectura directa de `players`, ver la migración). */
  async function listMyProvisionalPlayers() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('list_my_provisional_players');
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, players: Array.isArray(data) ? data : [] };
  }

  /** Backend Bloque 4 — genera/rota el link de reclamo de una provisional propia (RPC
   *  `create_claim_link`). Devuelve el token CRUDO una sola vez (`{ok:true, token}`) — nunca
   *  más recuperable después de esta llamada (la base solo guarda su hash). */
  async function createClaimLink(provisionalPlayerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('create_claim_link', { p_provisional_player_id: provisionalPlayerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, token: data };
  }

  /** Backend Bloque 4 — consume un token de reclamo (RPC `claim_provisional_player`). Debe
   *  llamarse con sesión real ya activa, ANTES de `completeProfile`/`officializeLevel` para esa
   *  misma cuenta (03_Revision_ChatGPT.md §2/Decisión 2 — ver `app.js runOfficializeAndEnter`).
   *  `{ok:false, code}` con el código de excepción tal cual lo levanta la función
   *  (`claim_invalid`/`claim_expired`/`claim_already_used`/`account_already_registered`/
   *  `account_already_claimed_identity`/`rate_limited`) para que `app.js` decida el mensaje. */
  async function claimProvisionalPlayer(token) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('claim_provisional_player', { p_token: token });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, player: data };
  }

  global.PLAuth = {
    isConfigured, getClient,
    signUp, verifySignupOtp, resendSignupOtp,
    signInWithPassword, signOut, getSession,
    sendRecoveryOtp, verifyRecoveryOtp, updatePassword,
    fetchOwnProfile, isUsernameAvailable, completeProfile, officializeLevel,
    searchPlayers, getPublicProfile, createProvisionalPlayer, listMyProvisionalPlayers,
    createClaimLink, claimProvisionalPlayer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
