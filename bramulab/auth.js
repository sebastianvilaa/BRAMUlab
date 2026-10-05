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

   Pre-Production P0.1C (24/09/2026) — teléfono/WhatsApp/avatar ya tienen columna real
   (`profiles.phone`/`allow_whatsapp_contact`/`avatar_url`, ver migración
   20260924130000_preprod_p01c_profile_editable.sql) y viajan acá igual que cualquier otro campo
   de `profiles` (el `select('*')` de abajo ya los trae). `level_states.declared_category` (Nivel)
   sigue siendo de solo lectura — se escribe una única vez en `officialize_level_onboarding`, nunca
   desde Perfil.

   Revisión 2 (misma fecha, antes de aplicar nada en Staging): el bucket "avatars" pasó a ser
   PRIVADO (Backend_Infraestructura.md §5.1 — nunca un objeto público de Internet). `avatar_url`
   ahora es una RUTA de Storage, no una URL: `resolveAvatarUrl()` la resuelve a una URL firmada
   temporal (24h) con la sesión real del usuario, recién al necesitar renderizarla — nunca se
   persiste esa URL firmada, se resuelve de nuevo en cada `fetchOwnProfile`/`getPublicProfile`.
   También se separó la categoría en dos campos reales: `profiles.current_category` (declarativo,
   editable libremente desde Perfil, sin ningún efecto sobre Nivel) vs.
   `level_states.declared_category` (contexto histórico e inmutable del onboarding, sigue de solo
   lectura acá). */
(function (global) {
  'use strict';

  let client = null;

  function isConfigured() {
    const env = global.__BRAMU_ENV__;
    return !!(env && env.supabaseUrl && env.supabaseAnonKey && global.supabase && global.supabase.createClient);
  }

  /** L1 (V04.19) — FAIL-CLOSED. Decide si la app puede operar contra Supabase, en modo local de
   *  desarrollo explícito, o si el backend no está disponible.
   *    'server'     → Auth/Supabase configurado (caso normal de Staging/Production).
   *    'local-dev'  → SIN Supabase y SOLO en un host de desarrollo local (localhost/127.0.0.1/[::1]/
   *                   *.localhost/*.test, o file://) y sin un entorno staging/production declarado. Es
   *                   una herramienta explícita de desarrollo, nunca un fallback.
   *    'unavailable'→ cualquier otro caso sin backend (host desplegado, o env staging/production
   *                   declarado pero sin credenciales/librería): NO se crean ni continúan cuentas
   *                   locales en silencio.
   *  Pura (recibe todo por parámetro) para poder probarla sin DOM. */
  function resolveBackendMode(env, hasSupabaseLib, hostname) {
    const configured = !!(env && env.supabaseUrl && env.supabaseAnonKey && hasSupabaseLib);
    if (configured) return 'server';
    const envName = env && env.name ? String(env.name).toLowerCase() : '';
    if (envName === 'staging' || envName === 'production') return 'unavailable';
    const host = String(hostname || '').toLowerCase();
    const isLocalHost = host === '' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1'
      || host.endsWith('.localhost') || host.endsWith('.test');
    return isLocalHost ? 'local-dev' : 'unavailable';
  }

  // Pre-Bloque 9 — separación de entornos en runtime: `app_config.environment` (fila única que declara a qué
  // proyecto Supabase pertenece la base) DEBE coincidir con `__BRAMU_ENV__.name` del build. Si no coincide
  // (credenciales cruzadas, env.generated.js viejo/ajeno) el backend se trata como NO disponible (fail-closed).
  let environmentMismatch = false;
  async function verifyBackendEnvironment() {
    const c = getClient();
    const env = global.__BRAMU_ENV__;
    if (!c || !env || !env.name) return { ok: true, skipped: true };
    try {
      const { data, error } = await c.from('app_config').select('environment').eq('id', 1).maybeSingle();
      if (error || !data) return { ok: true, skipped: true }; // sin lectura no se puede afirmar nada: no bloquea
      environmentMismatch = data.environment !== env.name;
      return { ok: !environmentMismatch, declared: env.name, actual: data.environment };
    } catch (e) {
      return { ok: true, skipped: true };
    }
  }

  function getBackendMode() {
    if (environmentMismatch) return 'unavailable';
    const hostname = global.location && global.location.hostname;
    return resolveBackendMode(global.__BRAMU_ENV__, !!(global.supabase && global.supabase.createClient), hostname);
  }

  /** true → el código local (cuentas en localStorage) puede usarse: SOLO desarrollo local explícito. */
  function isLocalDevFallbackAllowed() { return getBackendMode() === 'local-dev'; }
  /** true → hay que frenar (alta/login/recuperación) y avisar; nunca continuar en local. */
  function isBackendUnavailable() { return getBackendMode() === 'unavailable'; }

  /** Solo para tests.html — `client` (abajo) es un singleton lazy real, correcto en producción
   *  (una sola conexión Supabase por carga de página) pero un estorbo para un arnés que necesita
   *  ejercitar el wrapper REAL de este archivo (no un stub de PLAuth entero) contra varios
   *  clientes Supabase FABRICADOS distintos en la misma página (ronda correctiva QA 26SEP, tests
   *  QA26SEP-LOGIN). Nunca se llama fuera de tests.html. */
  function __resetClientForTests() {
    client = null;
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

  const LEGAL_VERSION_RE = /^[a-z0-9_.-]{1,40}$/;

  /** L1 (V04.19) — lee la versión legal VIGENTE del servidor (`app_config.legal_version`, pública de
   *  solo lectura). NUNCA se inventa en el frontend: si no se puede leer, `{ok:false}` y el alta no
   *  avanza (no hay cómo aceptar "una versión" que el servidor no declaró). */
  async function getCurrentLegalVersion() {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    try {
      const { data, error } = await c.from('app_config').select('legal_version').eq('id', 1).maybeSingle();
      if (error || !data || !LEGAL_VERSION_RE.test(String(data.legal_version || ''))) return { ok: false, reason: 'legal_version_unavailable' };
      return { ok: true, legalVersion: data.legal_version };
    } catch (e) {
      return { ok: false, reason: 'legal_version_unavailable' };
    }
  }

  /** L1 (V04.19) — `legalVersion` es OBLIGATORIO: sin una versión legal válida (la que el usuario
   *  aceptó en pantalla) NO se llama a Supabase Auth, así que nunca nace un usuario Auth sin
   *  aceptación previa. La versión viaja como metadata (`legal_version`); la evidencia autoritativa
   *  la registra el servidor al confirmar el email (handle_email_confirmed). */
  async function signUp(email, password, legalVersion) {
    if (typeof legalVersion !== 'string' || !LEGAL_VERSION_RE.test(legalVersion)) {
      return { ok: false, reason: 'legal_acceptance_required' };
    }
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.auth.signUp({ email, password, options: { data: { legal_version: legalVersion } } });
    if (error) return { ok: false, reason: mapAuthError(error), raw: error.message };
    // Supabase puede devolver un user obfuscado sin error si el email ya existe.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, reason: 'email_taken' };
    }
    return { ok: true, user: data.user };
  }

  /** Estado legal del jugador autenticado (RPC get_my_legal_status). `{ok:false}` ante error de
   *  red/servidor: el gate de reaceptación NO bloquea por una lectura fallida (la exigencia dura
   *  vive server-side, en complete_profile). */
  async function getMyLegalStatus() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_my_legal_status');
    if (error || !data) return { ok: false, code: (error && error.message) || 'unknown' };
    return {
      ok: true,
      currentVersion: data.currentVersion,
      acceptedCurrent: !!data.acceptedCurrent,
      latestAcceptedVersion: data.latestAcceptedVersion || null,
      requiresAcceptance: !!data.requiresAcceptance,
    };
  }

  /** Reaceptación explícita (RPC accept_legal_version) — solo la versión vigente, append-only. */
  async function acceptLegalVersion(version) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('accept_legal_version', { p_version: version });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, legalVersion: data.legalVersion, acceptedAt: data.acceptedAt, alreadyAccepted: !!data.alreadyAccepted };
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

  /** L3 (V04.20) — supabase-js `signOut()` SIN argumento es scope GLOBAL (cierra TODAS las sesiones del
   *  usuario). Bug latente de "Cerrar sesión": ahora el default es 'local' (solo esta sesión). Alcances:
   *    'local'  → sesión actual (Cerrar sesión, ghost session)
   *    'others' → todas las DEMÁS (tras cambio de contraseña/recuperación/email)
   *    'global' → todas (Cerrar todas las sesiones) */
  async function signOut(scope) {
    const c = getClient();
    if (!c) return { ok: true }; // nada que cerrar del lado del servidor
    const { error } = await c.auth.signOut({ scope: scope === 'others' || scope === 'global' ? scope : 'local' });
    return { ok: !error };
  }
  const signOutCurrent = () => signOut('local');
  const signOutOthers = () => signOut('others');
  const signOutAll = () => signOut('global');

  /** G1 — tras un cambio de email hecho en el servidor, el JWT de ESTA sesión todavía trae el email viejo: se refresca (best-effort). */
  async function refreshSession() {
    const c = getClient();
    if (!c || !c.auth || typeof c.auth.refreshSession !== 'function') return { ok: true };
    try { const { error } = await c.auth.refreshSession(); return { ok: !error }; } catch (e) { return { ok: false }; }
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

  /** G1 (Emails V1) — desafíos sensibles SERVER-SIDE (Edge Function `account-challenge`, JWT de la sesión activa). El body NUNCA
   *  lleva el email actual ni ids: el destino lo deriva el servidor desde Auth. Devuelve { ok:true, ...estado } o
   *  { ok:false, reason, retryAfterSeconds?, retryable?, status }. `reason` usa los mismos códigos que el resto del cliente
   *  (code_invalid, code_expired, rate_limited, email_taken, same_email, invalid_email, ...). */
  async function invokeAccountChallenge(payload) {
    const c = getClient();
    if (!c) return { ok: false, reason: 'not_configured' };
    const { data, error } = await c.functions.invoke('account-challenge', { body: payload });
    let out = data;
    if (error && !out && error.context && typeof error.context.json === 'function') {
      try { out = await error.context.json(); } catch (e) { out = null; }
    }
    if (out && out.ok === true) return Object.assign({}, out);
    const status = error && error.context && error.context.status;
    const code = (out && out.code) || 'unknown';
    // too_many_attempts / resend_too_soon / send_failed ... se pasan tal cual; la UI decide el texto.
    return { ok: false, reason: code === 'invalid_payload' ? 'unknown' : code, retryAfterSeconds: (out && out.retryAfterSeconds) || null, retryable: !!(out && out.retryable), status: status || null };
  }
  /** purpose: 'change_email_current' | 'delete_account' | 'change_email_new' (este último con { newEmail }). */
  function requestAccountChallenge(purpose, opts) {
    const body = { action: 'request', purpose };
    if (purpose === 'change_email_new') body.newEmail = opts && opts.newEmail;
    return invokeAccountChallenge(body);
  }
  /** Verifica el código. Para 'change_email_new' el servidor, tras las DOS verificaciones, cambia el email y cierra las demás sesiones. */
  function verifyAccountChallenge(purpose, code) {
    return invokeAccountChallenge({ action: 'verify', purpose, code });
  }
  /** Reintento idempotente de un cambio de email que quedó a medias en el servidor. */
  function completeEmailChange() {
    return invokeAccountChallenge({ action: 'complete_email_change' });
  }

  /** L3 (V04.20) — eliminación de cuenta AUTOSERVICIO: invoca la Edge Function `delete-my-account`
   *  (JWT de la sesión ACTIVA; el body NUNCA lleva player_id/email). Requiere haber verificado un OTP del
   *  prueba específica `delete_account` (requestAccountChallenge + verifyAccountChallenge, G1). `retryable` indica que el reintento es seguro. */
  async function deleteMyAccount() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.functions.invoke('delete-my-account', { body: { confirm: true } });
    let payload = data;
    if (error && !payload && error.context && typeof error.context.json === 'function') {
      try { payload = await error.context.json(); } catch (e) { payload = null; }
    }
    if (payload && payload.ok === true) return { ok: true, postconditions: payload.postconditions || {} };
    const status = error && error.context && error.context.status;
    return { ok: false, code: (payload && payload.code) || 'unknown', retryable: !!(payload && payload.retryable), status: status || null };
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
      // Corrección F5-C01 (bug real reproducido contra Staging,
      // B7_F5_GEOREF_ID_LOSS_REPRODUCED_ROLLBACK_OK — ver
      // 21_Correccion_Fase_5_Claude.md): country_code/georef_province_id/georef_locality_id
      // ahora viajan en el mismo `select` — sin esto, el gate de Ranking (openRankingGateModal)
      // no tenía forma de reenviar los IDs GeoRef de una ubicación ya verificada al guardar solo
      // rama/opt-in, y complete_ranking_profile_data la reinterpretaba como manual/no verificada.
      c.from('profiles').select('*, locations(country_code, province_label, locality_label, display_label, verified_for_ranking, georef_province_id, georef_locality_id)'),
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
      // Backend Bloque 7 (Fase 5) — gate "Completar datos para Ranking" (Ranking_BRAMU.md
      // §13.7): estos dos campos ya viajaban en las mismas filas de arriba (`profiles.*` trae
      // `ranking_opt_in`, el `select` de `locations` ya pedía `verified_for_ranking`) pero
      // fetchOwnProfile nunca los copiaba al objeto cacheado — sin esto, app.js no tenía forma
      // de saber si falta completar el gate sin depender de que ya exista una edición publicada
      // (get_my_ranking_position solo devuelve reasonCodes cuando SÍ hay edición).
      rankingOptIn: profile.ranking_opt_in === true,
      locationVerifiedForRanking: location ? !!location.verified_for_ranking : false,
      // Backend Bloque 3 — categoría HISTÓRICA e inmutable del onboarding de Nivel, viene de
      // level_states (única fuente, nunca un segundo campo independiente en profiles). Solo
      // lectura acá — nunca se reescribe desde Perfil (ver currentCategory más abajo para la
      // categoría ACTUAL, esa sí editable).
      declaredCategory: levelState ? levelState.declared_category || null : null,
      declaredCategoryAt: levelState ? levelState.updated_at || null : null,
      // Ronda correctiva QA 26SEP — distingue "no hay level_state" (`levelError` falso, fila
      // realmente ausente: caso excepcional del trigger, ver comentario de abajo) de "falló la
      // LECTURA" (`levelError` truthy: red/RPC caída, nada dice que el server no tenga Nivel
      // real). `levelState` queda `null` en AMBOS casos por compatibilidad con el resto de este
      // objeto, pero solo este flag le permite a app.js#resumeServerSession no confundir una
      // falla parcial/transitoria con una cuenta nueva — nunca debe derivar a onboarding por
      // esto (§15.24 "Login — falso retorno al onboarding de Nivel").
      levelStateReadFailed: !!levelError,
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
      // Pre-Production P0.1C (revisión 2) — profile.avatar_url guarda una RUTA de Storage
      // (bucket privado "avatars"), escrita exclusivamente por update_profile_avatar. Se
      // resuelve acá mismo a una URL firmada temporal (resolveAvatarUrl) para que Home/Mi
      // Perfil/Editar Datos sigan renderizando `profilePhoto` de forma síncrona, sin cambios.
      // `null` mientras no se subió ninguna foto (o si la resolución falla — no bloquea el login).
      profilePhoto: await resolveAvatarUrl(profile.avatar_url),
      // Pre-Production P0.1C (revisión 2) — categoría ACTUAL declarada en Perfil, separada a
      // propósito de declaredCategory (arriba): esta SÍ es editable libremente desde Editar
      // Datos (updateCurrentCategory) y nunca afecta a Nivel BRAMU.
      currentCategory: profile.current_category || null,
      currentCategoryAt: profile.current_category_at || null,
      locality: location ? location.locality_label : null,
      region: location ? location.province_label : null,
      country: location ? COUNTRY_LABELS.AR : null,
      // Corrección F5-C01 — IDs GeoRef reales de la ubicación ya guardada (nunca reconstruidos
      // a partir de los labels, que no alcanzan para identificar la misma fila de `locations`
      // que ya existe server-side). `null` en una ubicación cargada manualmente (sin GeoRef
      // detrás) — ahí `complete_ranking_profile_data` ya trata `source='manual'` correctamente.
      locationCountryCode: location ? (location.country_code || null) : null,
      locationGeorefProvinceId: location ? (location.georef_province_id || null) : null,
      locationGeorefLocalityId: location ? (location.georef_locality_id || null) : null,
      rankingLocalZone: null,
      // Pre-Production P0.1C — reales, escritos exclusivamente por
      // complete_contact_profile_data. phone privado (nunca expuesto a otro jugador salvo el
      // caso filtrado de get_public_profile#whatsapp_phone); allowWhatsAppContact es el
      // consentimiento explícito, `false` por defecto.
      phone: profile.phone || null,
      allowWhatsAppContact: profile.allow_whatsapp_contact === true,
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
      // L1 (V04.19) — el servidor ya NO usa este valor: la evidencia legal sale de legal_acceptances
      // (registrada al confirmar el email) y complete_profile exige que exista. Se mantiene el
      // parámetro por compatibilidad de firma; el cliente no es autoridad de la versión aceptada.
      p_terms_version: null,
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
   *  con el código de excepción tal cual lo levanta la función (`rate_limited`, etc.).
   *  Ronda correctiva QA 26SEP (§15.24 "Fila compacta server-backed de jugador") — la RPC ahora
   *  suma `avatar_url` (ver migración `20260927120000_preprod_ux_players_compact.sql`); acá se
   *  agrega `avatar_signed_url` a cada fila con UNA sola llamada batch a Storage
   *  (`resolveAvatarUrlsBatch`, nunca una `resolveAvatarUrl` por fila — el bug real reportado en
   *  el Laboratorio era justo eso: la búsqueda mostraba inicial aunque el Perfil público de la
   *  misma persona sí tuviera foto, porque esta RPC nunca traía `avatar_url` en absoluto). */
  async function searchPlayers(query, limit) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('search_players', { p_query: query, p_limit: limit || 20 });
    if (error) return { ok: false, code: error.message || 'unknown' };
    const players = Array.isArray(data) ? data : [];
    const signedByPath = await resolveAvatarUrlsBatch(players.map((p) => p.avatar_url));
    players.forEach((p) => { p.avatar_signed_url = p.avatar_url ? (signedByPath.get(p.avatar_url) || null) : null; });
    return { ok: true, players };
  }

  /** Ronda correctiva QA 26SEP (§15.24 "Fila compacta server-backed de jugador") — batch de
   *  identidad/Nivel/avatar por `player_id`s YA conocidos por el caller (RPC
   *  `get_players_compact`, ver la migración `20260927120000_preprod_ux_players_compact.sql`).
   *  NUNCA para descubrir jugadores nuevos por texto libre — eso sigue siendo `searchPlayers`.
   *  Pensada para RECIENTES (hoy solo trae `{player_id, nombre}` del historial local, sin
   *  username/Nivel/avatar — ver player-home.js#computeRecentRealPlayers) y reutilizable tal
   *  cual para Mis Jugadores. UNA sola llamada de red + UNA sola llamada batch a Storage para
   *  TODOS los avatares — nunca N `get_public_profile`/`resolveAvatarUrl` por fila (instrucción
   *  explícita del handoff). Devuelve `{ok:true, players: Map<player_id, fila>}`: un `player_id`
   *  ausente del Map significa que no es (ya) una cuenta registrada activa visible — el llamador
   *  decide el fallback honesto, nunca se inventa username/Nivel para esa fila. */
  async function getPlayersCompact(playerIds) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const ids = Array.from(new Set((playerIds || []).filter(Boolean)));
    if (!ids.length) return { ok: true, players: new Map() };
    const { data, error } = await c.rpc('get_players_compact', { p_player_ids: ids });
    if (error) return { ok: false, code: error.message || 'unknown' };
    const rows = Array.isArray(data) ? data : [];
    const signedByPath = await resolveAvatarUrlsBatch(rows.map((r) => r.avatar_url));
    const players = new Map();
    rows.forEach((r) => {
      players.set(r.player_id, {
        playerId: r.player_id,
        username: r.username || null,
        displayName: r.display_name || null,
        levelStatus: r.level_status || null,
        levelPublic: Number.isFinite(r.level_public) ? r.level_public : null,
        avatarSignedUrl: r.avatar_url ? (signedByPath.get(r.avatar_url) || null) : null,
      });
    });
    return { ok: true, players };
  }

  /** Ronda correctiva QA 26SEP (§15.24 punto 5 "Mis Jugadores / Agregar Jugador — terminar
   *  migración server-backed") — agrega `playerId` a la lista privada del caller (RPC
   *  `save_player`, ver migración `20260927130000_preprod_ux_mis_jugadores.sql`). Idempotente.
   *  `{ok:false, code}` con el código de negocio tal cual lo devuelve la RPC
   *  (`cannot_save_self`/`player_not_found`) — nunca una excepción para estos casos esperables,
   *  mismo criterio que `claimProvisionalPlayer`. */
  async function savePlayer(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('save_player', { p_saved_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    if (!data.ok) return { ok: false, code: data.code || 'unknown' };
    return { ok: true };
  }

  /** Ronda correctiva QA 26SEP — quita `playerId` de la lista privada del caller (RPC
   *  `remove_saved_player`). Idempotente: `{ok:true}` incluso si no estaba guardado. */
  async function removeSavedPlayer(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('remove_saved_player', { p_saved_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object' || !data.ok) return { ok: false, code: 'unknown' };
    return { ok: true };
  }

  /** Ronda correctiva QA 26SEP — lista privada completa del caller (RPC `list_saved_players`,
   *  más reciente primero), con los avatares resueltos en UNA sola llamada batch — mismo
   *  criterio/forma que `getPlayersCompact`, nunca N llamadas por fila. `{ok:true, players:[...]}`
   *  en el mismo orden que devuelve la RPC (ya viene ordenada server-side). */
  async function listSavedPlayers() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('list_saved_players');
    if (error) return { ok: false, code: error.message || 'unknown' };
    const rows = Array.isArray(data) ? data : [];
    const signedByPath = await resolveAvatarUrlsBatch(rows.map((r) => r.avatar_url));
    const players = rows.map((r) => ({
      playerId: r.player_id,
      username: r.username || null,
      displayName: r.display_name || null,
      levelStatus: r.level_status || null,
      levelPublic: Number.isFinite(r.level_public) ? r.level_public : null,
      avatarSignedUrl: r.avatar_url ? (signedByPath.get(r.avatar_url) || null) : null,
    }));
    return { ok: true, players };
  }

  /** Ronda correctiva QA 26SEP — `{ok:true, saved:boolean}` real (RPC `is_player_saved`) para que
   *  Perfil público decida AGREGAR JUGADOR vs. la acción de quitar, sin traer la lista completa. */
  async function isPlayerSaved(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('is_player_saved', { p_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, saved: data === true };
  }

  /** Backend Bloque 4 — perfil público de un `player_id` puntual (RPC `get_public_profile`).
   *  `null` (nunca un objeto vacío) si la RPC no devolvió fila — provisional, inexistente o
   *  perfil todavía sin completar, ver la migración. Pre-Production P0.1C (revisión 2) — agrega
   *  `avatar_signed_url` (URL firmada temporal, resuelta acá mismo a partir de la RUTA cruda
   *  `row.avatar_url`) para que app.js pueda renderizar el avatar de OTRO jugador; nunca expone
   *  la ruta cruda como si fuera una URL utilizable. */
  async function getPublicProfile(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_public_profile', { p_player_id: playerId });
    if (error) return { ok: false, code: error.message || 'unknown' };
    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (row) row.avatar_signed_url = await resolveAvatarUrl(row.avatar_url);
    return { ok: true, profile: row };
  }

  /** L2 (V04.20) — teléfono de WhatsApp de UN jugador, ON-DEMAND (RPC `get_whatsapp_contact`): solo si su
   *  consentimiento sigue activo en este instante. El resultado NO se cachea ni se persiste acá. */
  async function getWhatsAppContact(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_whatsapp_contact', { p_player_id: playerId });
    if (error) return { ok: false, code: String(error.message || '').includes('rate_limited') ? 'rate_limited' : 'unknown' };
    if (!data || data.ok !== true || typeof data.phone !== 'string') return { ok: false, code: 'unavailable' };
    return { ok: true, phone: data.phone };
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
  async function createClaimLink(provisionalPlayerId, sourceMatchId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    // V04.33 — `sourceMatchId` (opcional): el partido desde el que se invita; el servidor lo valida y, si no es coherente, lo ignora.
    const args = { p_provisional_player_id: provisionalPlayerId };
    if (sourceMatchId) args.p_source_match_id = sourceMatchId;
    let { data, error } = await c.rpc('create_claim_link', args);
    // Orden de despliegue: si el servidor todavía no tiene la firma con `p_source_match_id` (migración V04.33 sin aplicar), se reintenta SIN el
    // contexto — el origen es solo informativo y nunca debe impedir generar la invitación.
    if (error && sourceMatchId && /could not find the function|PGRST202|p_source_match_id/i.test(`${error.code || ''} ${error.message || ''}`)) {
      ({ data, error } = await c.rpc('create_claim_link', { p_provisional_player_id: provisionalPlayerId }));
    }
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, token: data };
  }

  /** V04.29 — "SOY YO": vincula la identidad provisional del link a la cuenta de la sesión (RPC `claim_provisional_player`,
   *  alta nueva O cuenta ya completa). La cuenta CONSERVA su player_id (la provisional se reasocia hacia ella; ver
   *  `20261003110000_g3_identity_recovery_core.sql`). Contrato jsonb: `{ok:true, recoveryId, matchCount, levelPending,
   *  duplicateCandidates, idempotentReturn?}` o `{ok:false, code, conflicts?}` (`claim_invalid`/`claim_expired`/`claim_revoked`/
   *  `claim_already_used`/`identity_conflict`/`rate_limited`/`account_not_eligible`). Un `error` real (red, sesión) se mapea a
   *  `{ok:false, code}` igual — app.js decide si es definitivo o transitorio. */
  async function claimProvisionalPlayer(token) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('claim_provisional_player', { p_token: token });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    if (!data.ok) return { ok: false, code: data.code || 'unknown', conflicts: Array.isArray(data.conflicts) ? data.conflicts : [] };
    return {
      ok: true, recoveryId: data.recoveryId, matchCount: Number(data.matchCount) || 0, levelPending: data.levelPending === true,
      duplicateCandidates: Number(data.duplicateCandidates) || 0, idempotentReturn: data.idempotentReturn === true,
    };
  }

  /** V04.29 — vista previa de una invitación SIN consumirla (RPC `preview_claim_link`): `{ok:true, displayName}` o
   *  `{ok:false, code}`. Solo con sesión real. Es lo que alimenta "¿Sos {nombre}?" — NO SOY YO nunca llama a nada más. */
  async function previewClaimLink(token) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('preview_claim_link', { p_token: token });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    if (!data.ok) return { ok: false, code: data.code || 'unknown' };
    // V04.30 — contexto para "¿Sos {nombre}?": cantidad de partidos y UN partido fuente compacto (cargador, parejas, score, fecha).
    return {
      ok: true, displayName: data.displayName || 'Jugador',
      matchCount: Number(data.matchCount) || 0,
      // V04.33 — `sourceIsOrigin`: el partido mostrado es el que originó la invitación (no el más reciente); sus participantes traen
      // `username`/`avatarPath` (ruta de Storage) de las cuentas registradas.
      sourceIsOrigin: !!data.sourceIsOrigin,
      sourceMatch: data.sourceMatch && typeof data.sourceMatch === 'object' ? data.sourceMatch : null,
    };
  }

  /** V04.33 — lotes de recuperación COMPLETADOS del propio caller dentro de la ventana especial de visibilidad (RPC
   *  `get_my_recent_recoveries`, 30 días por defecto). El servidor es la única autoridad de la ventana: vencida, el lote deja de
   *  listarse (los partidos NO salen del historial). `{ok:true, recoveries:[{recoveryId, sourceName, matchIds, recoveredAt}]}`. */
  async function getMyRecentRecoveries(days) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_my_recent_recoveries', { p_days: days || 30 });
    if (error || !data || typeof data !== 'object' || !data.ok) return { ok: false, code: (data && data.code) || (error && error.message) || 'unknown' };
    const recoveries = (Array.isArray(data.recoveries) ? data.recoveries : []).map((r) => ({
      recoveryId: r.recoveryId, sourceName: r.sourceName || 'Jugador',
      matchIds: Array.isArray(r.matchIds) ? r.matchIds : [], recoveredAt: r.recoveredAt || null,
    }));
    return { ok: true, recoveries };
  }

  /** V04.30 — ids de los partidos que recuperó UNA vinculación propia (RPC `get_my_recovered_match_ids`, solo el target la lee). */
  async function getRecoveredMatchIds(recoveryId) {
    const c = getClient();
    if (!c || !recoveryId) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_my_recovered_match_ids', { p_recovery_id: recoveryId });
    if (error || !data || typeof data !== 'object' || !data.ok) return { ok: false, code: (data && data.code) || (error && error.message) || 'unknown' };
    return { ok: true, matchIds: Array.isArray(data.matchIds) ? data.matchIds : [], sourceName: data.sourceName || 'Jugador' };
  }

  /** V04.29 — contadores mínimos del caller (RPC `get_my_identity_recovery_status`): recuperaciones con Nivel pendiente y
   *  posibles partidos duplicados abiertos. */
  async function getIdentityRecoveryStatus() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('get_my_identity_recovery_status');
    if (error || !data || typeof data !== 'object') return { ok: false, code: (error && error.message) || 'unknown' };
    return { ok: true, pendingLevelRecoveries: Number(data.pendingLevelRecoveries) || 0, openDuplicateCandidates: Number(data.openDuplicateCandidates) || 0 };
  }

  /** V04.29 — pide a la Edge `process-identity-recovery` que aplique el Nivel recuperado (idempotente/reanudable; el servidor
   *  decide el jugador desde el JWT). `{ok:true, results:[{status}]}`; status `pending_level` = todavía sin Nivel base. */
  async function processIdentityRecovery() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.functions.invoke('process-identity-recovery', { body: {} });
    if (error || !data || data.ok === false) return { ok: false, code: (data && data.code) || (error && error.message) || 'unknown' };
    return { ok: true, results: Array.isArray(data.results) ? data.results : [] };
  }

  /** V04.29 — posibles partidos duplicados abiertos para la persona recuperada (RPC `list_my_duplicate_match_candidates`). */
  async function listDuplicateMatchCandidates() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('list_my_duplicate_match_candidates');
    if (error || !data || typeof data !== 'object' || data.ok === false) return { ok: false, code: (data && data.code) || (error && error.message) || 'unknown' };
    return { ok: true, candidates: Array.isArray(data.candidates) ? data.candidates : [] };
  }

  /** V04.29 — "SÍ, ES EL MISMO" (`same`) / "NO, SON DOS PARTIDOS DISTINTOS" (`different`) (RPC `resolve_duplicate_match_candidate`).
   *  `{ok:true, ...resolution}` o `{ok:false, code}` (`candidate_not_found`/`candidate_stale`/`already_resolved`/`rate_limited`). */
  async function resolveDuplicateMatchCandidate(candidateId, decision) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('resolve_duplicate_match_candidate', { p_candidate_id: candidateId, p_decision: decision });
    if (error) return { ok: false, code: error.message || 'unknown' };
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    return data;
  }

  /** Backend Bloque 7 (Fase 5) — única vía de escritura de localidad deportiva/rama
   *  competitiva/`ranking_opt_in` (RPC `complete_ranking_profile_data`, ver
   *  supabase/migrations/20260922140000_bloque7_fase2_ranking_calculation.sql). Nunca reutiliza
   *  `completeProfile` (handoff Fase 5 §6: "No reutilizar complete_profile"). `location`: mismo
   *  shape `{region, locality, provinceId, localityId}` que ya usa `completeProfile` — GeoRef
   *  presente → ubicación verificada; ausente → manual (`verified_for_ranking=false`).
   *  `{ok:false, code}` con el código de excepción tal cual lo levanta la RPC
   *  (ranking_opt_in_required/competitive_branch_invalid/location_required/
   *  location_change_cooldown/profile_incomplete/no_profile_for_player) para que app.js decida
   *  el mensaje en español — mismo criterio que completeProfile. */
  async function completeRankingProfileData(fields) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const location = fields.location || {};
    const { data, error } = await c.rpc('complete_ranking_profile_data', {
      p_competitive_branch: fields.competitiveBranch || null,
      p_ranking_opt_in: fields.rankingOptIn === true,
      p_location_country_code: 'AR',
      p_location_province_label: location.region || null,
      p_location_locality_label: location.locality || null,
      p_location_georef_province_id: location.provinceId || null,
      p_location_georef_locality_id: location.localityId || null,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, profile: data };
  }

  /** Pre-Production P0.1C — única vía de escritura de phone/allowWhatsAppContact (RPC
   *  `complete_contact_profile_data`, ver migración 20260924130000_preprod_p01c_profile_
   *  editable.sql). Mismo criterio de `{ok:false,code}` que completeProfile/
   *  completeRankingProfileData — app.js decide el mensaje en español
   *  (whatsapp_phone_invalid/no_profile_for_player/no_player_for_session). */
  async function completeContactProfileData(fields) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('complete_contact_profile_data', {
      p_phone: fields.phone || null,
      p_allow_whatsapp_contact: fields.allowWhatsAppContact === true,
    });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, profile: data };
  }

  /** Pre-Production P0.1C (revisión 2) — persiste la RUTA de avatar YA subida a Storage (RPC
   *  `update_profile_avatar`). `avatarPath: null` quita la foto. Nunca sube el archivo por acá —
   *  ver `uploadAvatar`/`removeAvatarFiles` para la subida real. El parámetro es una ruta pura
   *  ("{playerId}/archivo.jpg"), nunca una URL — el bucket es privado, no existe URL pública. */
  async function updateProfileAvatar(avatarPath) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('update_profile_avatar', { p_avatar_path: avatarPath || null });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, profile: data };
  }

  /** Pre-Production P0.1C (revisión 2) — única vía de escritura de la categoría ACTUAL de
   *  Perfil (RPC `update_current_category`, ver migración). Nunca toca level_states/Nivel BRAMU
   *  — deliberadamente separada de declaredCategory (solo lectura, ver fetchOwnProfile). */
  async function updateCurrentCategory(currentCategory) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data, error } = await c.rpc('update_current_category', { p_current_category: currentCategory || null });
    if (error) return { ok: false, code: error.message || 'unknown' };
    return { ok: true, profile: data };
  }

  const AVATAR_BUCKET = 'avatars';
  const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

  /** Pre-Production P0.1C (revisión 2) — resuelve una RUTA de Storage del bucket privado
   *  "avatars" a una URL firmada temporal (24h) usando la sesión real de la cuenta activa
   *  (`createSignedUrl` exige la policy `avatars_select_authenticated` — cualquier usuario
   *  autenticado, nunca anónimo). `null` si no hay ruta, si no hay sesión configurada, o si la
   *  resolución falla (nunca bloquea el resto del perfil por un avatar irresoluble). Nunca se
   *  persiste el resultado — se vuelve a resolver en cada `fetchOwnProfile`/`getPublicProfile`. */
  async function resolveAvatarUrl(avatarPath) {
    if (!avatarPath) return null;
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.storage.from(AVATAR_BUCKET).createSignedUrl(avatarPath, AVATAR_SIGNED_URL_TTL_SECONDS);
    if (error || !data || !data.signedUrl) return null;
    return data.signedUrl;
  }

  /** Ronda correctiva QA 26SEP (§15.24) — variante BATCH de `resolveAvatarUrl`: UNA sola llamada
   *  `createSignedUrls` (plural, del SDK de Storage) para N rutas, en vez de N llamadas
   *  `createSignedUrl` sueltas — usada por `searchPlayers`/`getPlayersCompact` para nunca firmar
   *  avatares fila por fila. Devuelve un `Map<ruta, urlFirmada>`; una ruta que no pudo firmarse
   *  (error puntual del SDK, fila sin `avatar_url`) simplemente no entra al Map — el llamador cae
   *  al mismo fallback de iniciales que cualquier avatar ausente, nunca bloquea el resto del
   *  lote. `[]`/`null`/sin sesión configurada -> Map vacío, nunca lanza. */
  async function resolveAvatarUrlsBatch(avatarPaths) {
    const map = new Map();
    const uniquePaths = Array.from(new Set((avatarPaths || []).filter(Boolean)));
    if (!uniquePaths.length) return map;
    const c = getClient();
    if (!c) return map;
    const { data, error } = await c.storage.from(AVATAR_BUCKET).createSignedUrls(uniquePaths, AVATAR_SIGNED_URL_TTL_SECONDS);
    if (error || !Array.isArray(data)) return map;
    data.forEach((entry) => {
      if (entry && entry.signedUrl && !entry.error) map.set(entry.path, entry.signedUrl);
    });
    return map;
  }

  /** Pre-Production P0.1C — borra cualquier archivo YA subido en la carpeta propia
   *  ({playerId}/*, bucket avatars) antes de subir uno nuevo o al quitar la foto — nunca se
   *  acumulan archivos huérfanos de subidas anteriores. RLS de storage.objects ya restringe
   *  list()/remove() a la carpeta propia (defensa real); acá solo se usa esa carpeta porque es
   *  la única que la sesión puede listar. `{ok:true}` incluso si la carpeta ya estaba vacía. */
  async function removeAvatarFiles(playerId) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data: existing, error: listError } = await c.storage.from(AVATAR_BUCKET).list(playerId);
    if (listError) return { ok: false, code: listError.message || 'unknown' };
    if (Array.isArray(existing) && existing.length) {
      const paths = existing.map((f) => `${playerId}/${f.name}`);
      const { error: removeError } = await c.storage.from(AVATAR_BUCKET).remove(paths);
      if (removeError) return { ok: false, code: removeError.message || 'unknown' };
    }
    return { ok: true };
  }

  /** Pre-Production P0.1C (revisión 2) — sube `blob` (siempre JPEG ya redimensionado por
   *  downscaleImageFileToDataUrl, ver app.js) a `{playerId}/{timestamp}.jpg` dentro del bucket
   *  privado avatars, después de limpiar cualquier archivo previo del mismo jugador
   *  (removeAvatarFiles). Devuelve la RUTA cruda (nunca una URL — el bucket es privado, no existe
   *  `getPublicUrl` válida) para persistir después vía `updateProfileAvatar`; el llamador
   *  (app.js) resuelve una vista previa con `resolveAvatarUrl` si necesita mostrarla antes de
   *  guardar. La subida en sí ya está protegida por la política RLS `avatars_insert_own`
   *  (carpeta = player_id propio) — esta función nunca podría subir a la carpeta de otro
   *  jugador aunque quisiera. */
  async function uploadAvatar(playerId, blob) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const cleanup = await removeAvatarFiles(playerId);
    if (!cleanup.ok) return cleanup;
    const path = `${playerId}/${Date.now()}.jpg`;
    const { error: uploadError } = await c.storage.from(AVATAR_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (uploadError) return { ok: false, code: uploadError.message || 'unknown' };
    return { ok: true, path };
  }

  /* ---- Grupos BRAMU · Fase B1 — cliente server-backed (RPCs de la migración
   *  20260928120000_preprod_grupos_fase_a_backend_compartido.sql). Sin lógica deportiva: solo
   *  transporte. `{ok:true, ...payload}` con el payload de la RPC tal cual (camelCase ya lo trae
   *  el servidor), o `{ok:false, code}` con el código de negocio (`group_not_found`, `not_admin`,
   *  `last_admin`, `invalid_name`, `player_not_found`, `target_not_member`, `too_many_members`) o
   *  el error de transporte/sesión (`rate_limited`, `no_player_for_session`, `network_error`...).
   *  Nunca lanza. Nunca usa service-role (`getClient()` es siempre la sesión del usuario). ---- */
  async function groupsRpc(name, params) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    let res;
    try { res = await c.rpc(name, params || {}); } catch (e) { return { ok: false, code: 'network_error' }; }
    if (res.error) return { ok: false, code: res.error.message || 'unknown' };
    const data = res.data;
    if (!data || typeof data !== 'object') return { ok: false, code: 'unknown' };
    if (!data.ok) return { ok: false, code: data.code || 'unknown' };
    return data;
  }
  const listMyGroups = () => groupsRpc('list_my_groups');
  const getGroupDetail = (groupId) => groupsRpc('get_group_detail', { p_group_id: groupId });
  const createGroup = (name, memberPlayerIds) => groupsRpc('create_group', { p_name: name, p_member_player_ids: memberPlayerIds || [] });
  const renameGroup = (groupId, name) => groupsRpc('rename_group', { p_group_id: groupId, p_name: name });
  const addGroupMember = (groupId, playerId) => groupsRpc('add_group_member', { p_group_id: groupId, p_player_id: playerId });
  const removeGroupMember = (groupId, playerId) => groupsRpc('remove_group_member', { p_group_id: groupId, p_player_id: playerId });
  const promoteGroupAdmin = (groupId, playerId) => groupsRpc('promote_group_admin', { p_group_id: groupId, p_player_id: playerId });
  const demoteGroupAdmin = (groupId, playerId) => groupsRpc('demote_group_admin', { p_group_id: groupId, p_player_id: playerId });
  /** V04.16 (Issue #7) — último cambio REAL de Nivel del caller (match_level_result_players vigente). `delta:null` = sin evidencia. */
  async function getMyLastLevelDelta() {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    let res;
    try { res = await c.rpc('get_my_last_level_delta'); } catch (e) { return { ok: false, code: 'network_error' }; }
    if (res.error || !res.data || res.data.ok !== true) return { ok: false, code: (res.error && res.error.message) || 'unknown' };
    const d = res.data.delta;
    return { ok: true, delta: (d === null || d === undefined || !Number.isFinite(Number(d))) ? null : Number(d) };
  }
  const deleteGroup = (groupId) => groupsRpc('delete_group', { p_group_id: groupId });
  /** §26.5 — "Salir del grupo" (cualquier miembro; guardrails de último admin/único miembro del lado servidor). */
  const leaveGroup = (groupId) => groupsRpc('leave_group', { p_group_id: groupId });
  const getGroupCompetitionData = (groupId, from, to) => groupsRpc('get_group_competition_data', { p_group_id: groupId, p_from: from || null, p_to: to || null });
  /** B2b (handoff 79 §A) — RPC resumida del lobby (Fase B2a, `get_groups_lobby`): un solo
   *  viaje de red para TODOS los grupos activos del caller, cada uno con members/weekMatches en
   *  la MISMA forma que `getGroupDetail`/`getGroupCompetitionData` — nunca N llamadas por
   *  grupo. `weekFrom`/`weekTo` deben construirse con `PG.weekStartBA` (B2a) del lado del
   *  llamador, nunca con el huso local del dispositivo. */
  const getGroupsLobby = (weekFrom, weekTo) => groupsRpc('get_groups_lobby', { p_week_from: weekFrom || null, p_week_to: weekTo || null });

  /* ---- Grupos BRAMU · B2c — foto de grupo server-backed (migración
   *  20260930120000_preprod_grupos_b2c_group_photo.sql). Bucket PRIVADO `group-photos`, ruta
   *  `{group_id}/{timestamp}.jpg`, RLS por membresía (solo miembros activos leen, solo admins
   *  escriben). La URL firmada NUNCA se persiste (ni DB ni localStorage) y vive solo 10 minutos:
   *  una URL ya emitida es un bearer URL que quitar a un miembro no puede revocar
   *  retroactivamente, así que el TTL corto acota esa ventana (a propósito NO se copia el TTL de
   *  24h del avatar, que es otro contrato). ---- */
  const GROUP_PHOTO_BUCKET = 'group-photos';
  const GROUP_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 10;

  async function resolveGroupPhotoUrl(photoPath) {
    if (!photoPath) return null;
    const c = getClient();
    if (!c) return null;
    const { data, error } = await c.storage.from(GROUP_PHOTO_BUCKET).createSignedUrl(photoPath, GROUP_PHOTO_SIGNED_URL_TTL_SECONDS);
    if (error || !data || !data.signedUrl) return null;
    return data.signedUrl;
  }

  /** Variante BATCH (UNA llamada `createSignedUrls` para todas las tarjetas del lobby, nunca una
   *  firma por grupo). `Map<ruta, urlFirmada>`; una ruta que no se pudo firmar simplemente no
   *  entra al Map (el llamador cae al fallback de iniciales). Nunca lanza. */
  async function resolveGroupPhotoUrlsBatch(photoPaths) {
    const map = new Map();
    const uniquePaths = Array.from(new Set((photoPaths || []).filter(Boolean)));
    if (!uniquePaths.length) return map;
    const c = getClient();
    if (!c) return map;
    let res;
    try { res = await c.storage.from(GROUP_PHOTO_BUCKET).createSignedUrls(uniquePaths, GROUP_PHOTO_SIGNED_URL_TTL_SECONDS); } catch (e) { return map; }
    if (!res || res.error || !Array.isArray(res.data)) return map;
    res.data.forEach((entry) => {
      if (entry && entry.signedUrl && !entry.error) map.set(entry.path, entry.signedUrl);
    });
    return map;
  }

  /** Borra los archivos de `{groupId}/` salvo `keepPath` (best-effort de quien llama: un fallo
   *  de cleanup NUNCA revierte una mutación de DB ya confirmada). Sin `keepPath` limpia toda la
   *  carpeta (quitar foto / grupo eliminado). `{ok:true}` incluso con la carpeta vacía. */
  async function removeGroupPhotoFiles(groupId, keepPath) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const { data: existing, error: listError } = await c.storage.from(GROUP_PHOTO_BUCKET).list(groupId);
    if (listError) return { ok: false, code: listError.message || 'unknown' };
    const paths = (Array.isArray(existing) ? existing : []).map((f) => `${groupId}/${f.name}`).filter((p) => p !== keepPath);
    if (paths.length) {
      const { error: removeError } = await c.storage.from(GROUP_PHOTO_BUCKET).remove(paths);
      if (removeError) return { ok: false, code: removeError.message || 'unknown' };
    }
    return { ok: true };
  }

  /** Sube `blob` (JPEG ya redimensionado) a una ruta NUEVA. NO borra nada: el orden seguro de
   *  reemplazo lo orquesta `changeGroupPhoto` (a diferencia del avatar, que borra primero). */
  async function uploadGroupPhoto(groupId, blob) {
    const c = getClient();
    if (!c) return { ok: false, code: 'not_configured' };
    const path = `${groupId}/${Date.now()}.jpg`;
    const { error: uploadError } = await c.storage.from(GROUP_PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) return { ok: false, code: uploadError.message || 'unknown' };
    return { ok: true, path };
  }

  const updateGroupPhoto = (groupId, photoPath) => groupsRpc('update_group_photo', { p_group_id: groupId, p_photo_path: photoPath || null });

  /** Reemplazo SEGURO (revisión técnica Central):
   *   1) subir el archivo NUEVO a una ruta nueva — si falla, la foto vieja sigue intacta;
   *   2) `update_group_photo(newPath)` — si falla, se borra el archivo nuevo (best-effort) y se
   *      conserva la vieja;
   *   3) recién con el RPC OK se borra el archivo viejo (best-effort: `cleanupOk:false` no
   *      cambia `ok:true`, la DB y la foto nueva ya quedaron correctas). */
  async function changeGroupPhoto(groupId, blob, oldPhotoPath) {
    const up = await uploadGroupPhoto(groupId, blob);
    if (!up.ok) return { ok: false, step: 'upload', code: up.code };
    const upd = await updateGroupPhoto(groupId, up.path);
    if (!upd.ok) {
      const c = getClient();
      if (c) { try { await c.storage.from(GROUP_PHOTO_BUCKET).remove([up.path]); } catch (e) { /* best-effort */ } }
      return { ok: false, step: 'rpc', code: upd.code };
    }
    let cleanupOk = true;
    if (oldPhotoPath && oldPhotoPath !== up.path) {
      try { cleanupOk = (await removeGroupPhotoFiles(groupId, up.path)).ok; } catch (e) { cleanupOk = false; }
    }
    return { ok: true, path: up.path, group: upd.group, cleanupOk };
  }

  /** Quitar foto: RPC con null primero (la UI vuelve a iniciales de inmediato) y recién después
   *  el cleanup best-effort de la carpeta. */
  async function removeGroupPhoto(groupId) {
    const upd = await updateGroupPhoto(groupId, null);
    if (!upd.ok) return { ok: false, step: 'rpc', code: upd.code };
    let cleanupOk = true;
    try { cleanupOk = (await removeGroupPhotoFiles(groupId)).ok; } catch (e) { cleanupOk = false; }
    return { ok: true, group: upd.group, cleanupOk };
  }

  global.PLAuth = {
    isConfigured, getClient, __resetClientForTests,
    resolveBackendMode, getBackendMode, verifyBackendEnvironment, isLocalDevFallbackAllowed, isBackendUnavailable,
    getCurrentLegalVersion, getMyLegalStatus, acceptLegalVersion,
    signUp, verifySignupOtp, resendSignupOtp,
    signInWithPassword, signOut, signOutCurrent, signOutOthers, signOutAll, getSession,
    refreshSession, requestAccountChallenge, verifyAccountChallenge, completeEmailChange, deleteMyAccount,
    sendRecoveryOtp, verifyRecoveryOtp, updatePassword,
    fetchOwnProfile, isUsernameAvailable, completeProfile, officializeLevel,
    searchPlayers, getPlayersCompact, getPublicProfile, getWhatsAppContact, createProvisionalPlayer, listMyProvisionalPlayers,
    createClaimLink, claimProvisionalPlayer, previewClaimLink, getRecoveredMatchIds, getMyRecentRecoveries, getIdentityRecoveryStatus, processIdentityRecovery,
    listDuplicateMatchCandidates, resolveDuplicateMatchCandidate, completeRankingProfileData,
    completeContactProfileData, updateProfileAvatar, uploadAvatar, removeAvatarFiles,
    updateCurrentCategory, resolveAvatarUrl, resolveAvatarUrlsBatch,
    savePlayer, removeSavedPlayer, listSavedPlayers, isPlayerSaved,
    listMyGroups, getGroupDetail, createGroup, renameGroup, addGroupMember, removeGroupMember,
    promoteGroupAdmin, demoteGroupAdmin, deleteGroup, leaveGroup, getMyLastLevelDelta, getGroupCompetitionData, getGroupsLobby,
    GROUP_PHOTO_SIGNED_URL_TTL_SECONDS, resolveGroupPhotoUrl, resolveGroupPhotoUrlsBatch, removeGroupPhotoFiles,
    uploadGroupPhoto, updateGroupPhoto, changeGroupPhoto, removeGroupPhoto,
  };
})(typeof window !== 'undefined' ? window : globalThis);
