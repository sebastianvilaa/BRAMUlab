/* ==========================================================================
   BRAMU Lab — store.js
   Persistencia local (localStorage). Sin servidor real, sin backend, sin
   Supabase/Firebase — pero desde V03.0 SÍ hay un sistema de cuentas local
   (prototipo): ver KEYS.USERS/KEYS.SESSION más abajo. Sigue sin haber
   autenticación real ni sincronización entre dispositivos.
   Incluye schemaVersion simple: si encuentra datos de una versión anterior
   o incompleta, los ignora de forma segura en vez de romper la app.

   Reorganización de aplicaciones — esta app vive en su propia ruta (bramulab/)
   pero comparte origen real (sebastianvilaa.github.io) con el marcador
   congelado BRAMU Lab Partidos (bramulab-partidos/), y localStorage es por
   origen, no por ruta. Por decisión explícita, el almacenamiento queda
   COMPLETAMENTE separado: namespace de claves `bramulab.*`, distinto del
   `padellab.*` que usa el marcador congelado — esta app arranca limpia, sin
   ver ni tocar nunca los datos de bramulab-partidos/. No hay sincronización
   ni migración automática entre ambas — si en algún momento se decide
   importar historial viejo, es un paso manual y explícito, no algo que este
   archivo haga solo. */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 3;
  // Único punto central del número de versión visible (footer + chequeo de actualización).
  // Cambiar acá alcanza para toda la app — nunca duplicar el string de versión en otro
  // archivo JS. BRAMUlab_V02 (docs/BRAMUlab/Versiones/BRAMUlab_V02/): la versión visible de
  // producto pasa a ser un nombre, no un tag semver — los tags técnicos tipo "v2.2.1" quedan
  // como historial de BRAMUlab_V01 (ver git tags), separados del versionado del marcador
  // congelado (BRAMU Lab Partidos).
  const APP_VERSION = 'BRAMUlab V03.1.2';
  const KEYS = {
    ACTIVE_MATCH: 'bramulab.activeMatch.v1',
    HISTORY: 'bramulab.history.v1',
    PLAYER_NAMES: 'bramulab.playerNames.v1',
    // Última selección de modo de registro (Completo / Por games), recordada para la
    // próxima vez que se abre Home. No forma parte del schemaVersion del partido en curso:
    // es una preferencia de Home, no datos de un partido.
    RECORDING_MODE: 'bramulab.recordingMode.v1',
    // Jugador actual del dispositivo — desde V03.0 este valor es un DERIVADO del usuario con
    // sesión activa (KEYS.SESSION), mantenido por compatibilidad: los ~20 sitios de
    // player-home.js/app.js que todavía leen este string plano (para mostrarlo, o como
    // fallback de nombre en partidos legacy sin userId) siguen funcionando sin cambios. Ya NO
    // es la fuente de verdad de "es mi partido" — ver KEYS.USERS/stampPlayersWithUserId más
    // abajo. Identidad por coincidencia de nombre normalizado — deuda deliberada de la beta
    // (ver Etapa 1 Análisis §F), ahora reforzada con userId para los partidos nuevos.
    CURRENT_PLAYER: 'bramulab.currentPlayerName.v1',
    // V03.0 (§7/§8 del consolidado) — cuentas locales de prototipo y sesión activa. Ver
    // createUserAccount/loginWithEmail/logoutSession más abajo.
    USERS: 'bramulab.users.v1',
    SESSION: 'bramulab.session.v1',
    // V03.0.2 (§12) — notificaciones locales, por userId (nunca por nombre visible, para no
    // mezclar cuentas locales distintas con el mismo nombre). Sin backend: es un historial de
    // actividad reconstruido a partir de eventos que YA ocurren en la app (ver
    // Store.addNotification*, llamado desde app.js).
    NOTIFICATIONS: 'bramulab.notifications.v1',
  };

  function safeGet(key) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { console.warn('PLStore: no se pudo leer', key, e); return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('PLStore: no se pudo guardar', key, e); return false; }
  }
  function safeRemove(key) { try { localStorage.removeItem(key); } catch (e) { /* noop */ } }

  function saveActiveMatch(snapshot) {
    return safeSet(KEYS.ACTIVE_MATCH, Object.assign({ schemaVersion: SCHEMA_VERSION }, snapshot));
  }
  function loadActiveMatch() {
    const snap = safeGet(KEYS.ACTIVE_MATCH);
    if (!snap) return null;
    if (snap.schemaVersion !== SCHEMA_VERSION) {
      // Versión incompatible: no intentamos migrar automáticamente un partido
      // en curso (podría tener forma distinta); lo descartamos de forma segura.
      console.warn('PLStore: activeMatch con schemaVersion distinto, se descarta.');
      safeRemove(KEYS.ACTIVE_MATCH);
      return null;
    }
    if (!snap.match || !snap.match.id) return null;
    return snap;
  }
  function clearActiveMatch() { safeRemove(KEYS.ACTIVE_MATCH); }

  function loadHistory() {
    const raw = safeGet(KEYS.HISTORY) || [];
    // Filtra entradas incompatibles/corruptas en vez de romper la app.
    return raw.filter((m) => m && m.matchId && m.players && m.finishedAt);
  }

  /** Inserta o actualiza un partido en el historial usando `matchId` como clave estable.
   *  Nunca duplica: si ya existe una entrada con el mismo matchId, la reemplaza. */
  function upsertHistory(entry) {
    const list = loadHistory().filter((m) => m.matchId !== entry.matchId);
    list.unshift(Object.assign({ schemaVersion: SCHEMA_VERSION }, entry));
    safeSet(KEYS.HISTORY, list.slice(0, 200));
  }

  /** Quita una entrada del historial por matchId (usado al reanudar un partido finalizado manualmente). */
  function removeFromHistory(matchId) {
    const list = loadHistory().filter((m) => m.matchId !== matchId);
    safeSet(KEYS.HISTORY, list);
  }

  function getHistoryEntry(matchId) { return loadHistory().find((m) => m.matchId === matchId) || null; }

  /** Etapa 4.2 (§9/§10) — actualiza SOLO los campos de `patch` en un partido ya guardado
   *  (fecha/hora/lugar desde "Modificar", o la nota privada), preservando todo lo demás tal
   *  cual estaba. No-op si el matchId no existe todavía — nunca crea un registro nuevo por
   *  accidente (eso sigue siendo trabajo exclusivo de upsertHistory con un finishedSnapshot
   *  completo). */
  function patchHistoryEntry(matchId, patch) {
    const entry = getHistoryEntry(matchId);
    if (!entry) return false;
    upsertHistory(Object.assign({}, entry, patch));
    return true;
  }

  function loadRecordingMode() { const m = safeGet(KEYS.RECORDING_MODE); return m === 'games' ? 'games' : 'complete'; }
  function saveRecordingMode(mode) { safeSet(KEYS.RECORDING_MODE, mode === 'games' ? 'games' : 'complete'); }

  /** Etapa 2 (Rama Jugador §3.2/9/10): normaliza un nombre de jugador (espacios colapsados,
   *  Title Case en español). Único punto de verdad — app.js (setup/carga manual/Home del
   *  jugador) y player-home.js (filtrado del historial) lo usan por igual, para que el
   *  mismo nombre escrito en distintas pantallas siempre coincida como el mismo string. */
  function normalizePlayerName(raw) {
    const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
    if (!trimmed) return trimmed;
    return trimmed.split(' ').map((word) => {
      if (!word) return word;
      return word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es');
    }).join(' ');
  }

  /** V02.1 (§9) — placeholders del sistema (los defaults de Configurar partido cuando el
   *  usuario deja un campo vacío, más "Vos") que NUNCA deben ofrecerse como sugerencia
   *  reutilizable en el selector de compañero/rivales de la carga manual. No borra nada del
   *  historial ni de los nombres recordados — el partido histórico que use uno de estos
   *  nombres sigue intacto, solo deja de aparecer como candidato para un partido NUEVO. */
  const GENERIC_PLACEHOLDER_NAMES = new Set(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4', 'Vos']);
  function isPlaceholderPlayerName(name) {
    const norm = normalizePlayerName(name);
    return !norm || GENERIC_PLACEHOLDER_NAMES.has(norm);
  }

  function loadCurrentPlayerName() { return safeGet(KEYS.CURRENT_PLAYER) || null; }
  function saveCurrentPlayerName(name) {
    const n = normalizePlayerName(name);
    if (!n) return false;
    return safeSet(KEYS.CURRENT_PLAYER, n);
  }
  /** Auditoría funcional §5 — "Cerrar sesión": borra SOLO el jugador actual. Nunca toca
   *  Historial ni partido en curso (otras claves, otra capa de datos por completo). */
  function clearCurrentPlayerName() { safeRemove(KEYS.CURRENT_PLAYER); }

  function loadPlayerNames() { return safeGet(KEYS.PLAYER_NAMES) || []; }
  function rememberPlayerNames(names) {
    const known = loadPlayerNames();
    names.forEach((n) => { const trimmed = (n || '').trim(); if (trimmed && !known.includes(trimmed)) known.push(trimmed); });
    safeSet(KEYS.PLAYER_NAMES, known.slice(-100));
  }

  /* ------------------------------------------------------------------ */
  /* V03.0 — CUENTAS LOCALES (prototipo)                                  */
  /* Consolidado §7/§11: NO backend, NO Supabase/Firebase, NO auth real.   */
  /* Todo vive en localStorage, en texto plano, explícitamente marcado    */
  /* como prototipo — ver el comentario sobre `password` en               */
  /* createUserAccount. NUNCA agregar acá una "criptografía casera" como   */
  /* parche: si algún día hace falta seguridad real, este bloque entero    */
  /* se reemplaza por Auth real (consolidado §7 lo pide explícitamente).   */
  /* ------------------------------------------------------------------ */

  function loadUsers() { return safeGet(KEYS.USERS) || []; }
  function saveUsersList(list) { safeSet(KEYS.USERS, (list || []).slice(0, 100)); }

  function getUserById(id) {
    if (!id) return null;
    return loadUsers().find((u) => u && u.id === id) || null;
  }
  function getUserByEmail(email) {
    const target = (email || '').trim().toLowerCase();
    if (!target) return null;
    return loadUsers().find((u) => u && (u.email || '').trim().toLowerCase() === target) || null;
  }
  function getUserByUsername(username) {
    const target = (username || '').trim().toLowerCase().replace(/^@/, '');
    if (!target) return null;
    return loadUsers().find((u) => u && (u.username || '').trim().toLowerCase() === target) || null;
  }

  function genUserId() { return 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** Crea y persiste un Usuario local nuevo (consolidado §7 — campos mínimos esperados).
   *  `password` es TEXTO PLANO — esto es un prototipo local explícitamente autorizado así
   *  (consolidado §7 "Seguridad/arquitectura"): nunca se transmite a ningún servidor (no
   *  existe ninguno), pero tampoco hay que confundirlo con una solución segura — en cuanto
   *  exista Auth real, este campo se elimina por completo, nunca se "mejora" con una
   *  criptografía casera hecha acá adentro. */
  function createUserAccount(fields) {
    const now = new Date().toISOString();
    const user = {
      id: genUserId(),
      email: fields.email || null,
      password: fields.password || null,
      username: fields.username || null,
      firstName: fields.firstName || null,
      lastName: fields.lastName || null,
      displayName: fields.displayName || fields.firstName || null,
      birthDate: fields.birthDate || null,
      gender: fields.gender || null,
      dominantHand: fields.dominantHand || null,
      preferredSide: fields.preferredSide || null,
      declaredCategory: fields.declaredCategory || null,
      // V03.1 (§4) — fecha en la que se declaró la categoría actual (no una auditoría de
      // cambios, solo "desde cuándo vale la que está guardada ahora"). Se estampa junto con
      // `declaredCategory` en el signup y se REESTAMPA solo si el valor cambia en Editar Datos
      // (ver openProfileEditModal/submit) — nunca por abrir/guardar sin tocar el campo.
      declaredCategoryAt: fields.declaredCategoryAt || null,
      profilePhoto: fields.profilePhoto || null,
      legacyMigrated: !!fields.legacyMigrated,
      createdAt: now,
      updatedAt: now,
    };
    const list = loadUsers();
    list.push(user);
    saveUsersList(list);
    return user;
  }

  function updateUserAccount(id, patch) {
    const list = loadUsers();
    const idx = list.findIndex((u) => u && u.id === id);
    if (idx === -1) return null;
    const updated = Object.assign({}, list[idx], patch, { id: list[idx].id, updatedAt: new Date().toISOString() });
    list[idx] = updated;
    saveUsersList(list);
    return updated;
  }

  function loadSession() { return safeGet(KEYS.SESSION); }
  function saveSessionUserId(userId) { safeSet(KEYS.SESSION, { userId }); }
  function clearSession() { safeRemove(KEYS.SESSION); }
  function getCurrentUser() {
    const session = loadSession();
    if (!session || !session.userId) return null;
    return getUserById(session.userId);
  }

  /** Alta + inicio de sesión en una sola operación. Mantiene CURRENT_PLAYER sincronizado con
   *  el displayName EXACTO de la cuenta — es lo que permite que los ~20 sitios que todavía
   *  leen ese string plano (player-home.js/app.js) sigan funcionando sin ningún cambio. */
  function signUpAndLogin(fields) {
    const user = createUserAccount(fields);
    saveSessionUserId(user.id);
    if (user.displayName) {
      saveCurrentPlayerName(user.displayName);
      rememberPlayerNames([user.displayName]);
    }
    return user;
  }

  /** `{ok:true,user}` o `{ok:false, reason:'not-found'|'wrong-password'}`. Nunca distingue
   *  esos dos casos en la UI (mensaje genérico) — evitar dar pistas de qué emails existen no
   *  es el objetivo acá (prototipo local, sin backend que pueda enumerarse), pero tampoco
   *  aporta nada distinguirlo, así que la función lo deja disponible sin que la UI lo use. */
  function loginWithEmail(email, password) {
    const user = getUserByEmail(email);
    if (!user) return { ok: false, reason: 'not-found' };
    if ((user.password || '') !== (password || '')) return { ok: false, reason: 'wrong-password' };
    saveSessionUserId(user.id);
    if (user.displayName) {
      saveCurrentPlayerName(user.displayName);
      rememberPlayerNames([user.displayName]);
    }
    return { ok: true, user };
  }

  /** Auditoría funcional §5 / consolidado §6 — "Cerrar sesión": borra ÚNICAMENTE la sesión
   *  activa y el CURRENT_PLAYER derivado. Nunca toca HISTORY/PLAYER_NAMES/ACTIVE_MATCH ni la
   *  lista de USERS — son datos globales del dispositivo, no de la sesión. */
  function logoutSession() {
    clearSession();
    clearCurrentPlayerName();
  }

  /** Tagea con `userId` al jugador de `players` cuyo nombre normalizado coincide con `name` —
   *  usado al finalizar un partido nuevo (en vivo o carga manual) para que ese partido quede
   *  vinculado por id, no solo por nombre (ver regla de integridad más abajo). Nunca asigna el
   *  mismo userId a más de un jugador del mismo partido: si hay más de un candidato SIN userId
   *  todavía que coincide por nombre (nombres visibles duplicados dentro del mismo partido —
   *  ambigüedad real), no tagea a ninguno en vez de adivinar. Nunca reestampa un jugador que ya
   *  tiene userId (de esta cuenta o de otra) — un userId ya puesto es definitivo. Pura: no lee
   *  ni escribe storage, devuelve un array nuevo (o el mismo `players` sin tocar si no hubo
   *  match único). */
  function stampPlayersWithUserId(players, name, userId) {
    const list = players || [];
    if (!userId) return list;
    const target = normalizePlayerName(name);
    if (!target) return list;
    const candidates = list.filter((p) => p && p.name === target && !p.userId);
    if (candidates.length !== 1) return list;
    const chosen = candidates[0];
    return list.map((p) => (p === chosen ? Object.assign({}, p, { userId }) : p));
  }

  /** Migración/backfill (consolidado §8) — recorre TODO `HISTORY` una sola vez y aplica
   *  exactamente el mismo criterio que `stampPlayersWithUserId` (candidato único sin userId
   *  todavía) a cada partido existente, para que los partidos ya jugados por `legacyName`
   *  queden vinculados por `userId` igual que los nuevos. Devuelve la cantidad de partidos
   *  modificados. Solo reescribe HISTORY si hubo al menos un cambio real (evita un `safeSet`
   *  innecesario). Un partido con nombres visibles duplicados y ambigüedad real queda intacto,
   *  igual que en `stampPlayersWithUserId` — nunca tagea al azar. */
  function backfillHistoryUserId(legacyName, userId) {
    const target = normalizePlayerName(legacyName);
    if (!target || !userId) return 0;
    let changed = 0;
    const list = loadHistory().map((entry) => {
      if (!entry || !Array.isArray(entry.players)) return entry;
      const candidates = entry.players.filter((p) => p && p.name === target && !p.userId);
      if (candidates.length !== 1) return entry;
      changed += 1;
      const chosen = candidates[0];
      return Object.assign({}, entry, {
        players: entry.players.map((p) => (p === chosen ? Object.assign({}, p, { userId }) : p)),
      });
    });
    if (changed) safeSet(KEYS.HISTORY, list);
    return changed;
  }

  /** Bootstrap de migración (consolidado §8), una sola vez e idempotente: si este dispositivo
   *  ya tenía un jugador identificado ANTES de V03.0 (CURRENT_PLAYER con datos) y todavía no
   *  existe ninguna cuenta (USERS vacío), crea automáticamente UNA cuenta local a partir de
   *  ese nombre exacto (nunca re-tipeado ni re-normalizado por otra vía), la marca
   *  `legacyMigrated:true` (sin email/password — "acceso pendiente de completar", ver Perfil),
   *  la deja logueada de inmediato, y vincula por `userId` todo el historial existente que
   *  coincida con ese nombre. Nunca toca PLAYER_NAMES/ACTIVE_MATCH. Devuelve el usuario creado,
   *  o `null` si no había nada que migrar o ya se había migrado antes. */
  function migrateLegacyPlayerToUserIfNeeded() {
    if (loadUsers().length) return null;
    const legacyName = loadCurrentPlayerName();
    if (!legacyName) return null;
    // `global.PLIdentity` (player-identity.js) ya está cargado para cuando esta función
    // efectivamente se INVOCA (siempre desde app.js en DOMContentLoaded, después de que los
    // 6 <script> ya corrieron) aunque store.js se declare antes en el HTML — las referencias
    // dentro de un cuerpo de función solo se resuelven al llamarla, nunca al definirla. Guard
    // defensivo por si algún día se llama en un contexto sin ese módulo cargado (ej. un test
    // aislado): cae a 'jugador' igual que el propio slugifyUsername haría.
    const PLIdentity = global.PLIdentity;
    const username = PLIdentity ? PLIdentity.suggestUsername(legacyName, '', loadUsers()) : 'jugador';
    const user = createUserAccount({
      displayName: legacyName,
      firstName: legacyName.split(' ')[0] || legacyName,
      username,
      legacyMigrated: true,
    });
    saveSessionUserId(user.id);
    backfillHistoryUserId(legacyName, user.id);
    return user;
  }

  /* ------------------------------------------------------------------ */
  /* V03.0.2 (§12) — NOTIFICACIONES LOCALES                                */
  /* Primer modelo, sin backend: cada registro pertenece a un userId       */
  /* exacto. Solo se generan eventos respaldados por acciones/datos reales */
  /* que ya existen (nunca notificaciones sociales/de otros usuarios).     */
  /* ------------------------------------------------------------------ */

  function loadAllNotifications() { return safeGet(KEYS.NOTIFICATIONS) || []; }

  /** Notificaciones de UN usuario, más recientes primero. `userId` es obligatorio — sin él
   *  devuelve `[]` en vez de listar todo (nunca mezclar entre cuentas locales por accidente). */
  function loadNotifications(userId) {
    if (!userId) return [];
    return loadAllNotifications()
      .filter((n) => n && n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function genNotificationId() { return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /** `category` ∈ 'positive' | 'info' | 'pending' | 'error' — decide el color (lima/azul/
   *  ámbar/rojo), nunca el `type` textual libre. `dedupeKey` es opcional, lo usa
   *  `addNotificationOnce` (perfil incompleto) para no repetir el mismo aviso mientras siga
   *  sin leerse. */
  function addNotification(fields) {
    if (!fields || !fields.userId) return null;
    const notif = {
      id: genNotificationId(),
      userId: fields.userId,
      type: fields.type || 'info',
      category: fields.category || 'info',
      title: fields.title || '',
      body: fields.body || '',
      createdAt: fields.createdAt || new Date().toISOString(),
      readAt: null,
      action: fields.action || null,
      dedupeKey: fields.dedupeKey || null,
    };
    const list = loadAllNotifications();
    list.unshift(notif);
    safeSet(KEYS.NOTIFICATIONS, list.slice(0, 300));
    return notif;
  }

  /** Igual que `addNotification`, pero si ya existe una notificación NO LEÍDA del mismo
   *  usuario con el mismo `dedupeKey`, no crea una segunda — devuelve la existente. Usado por
   *  "perfil incompleto" (consolidado §12: "con deduplicación") para no repetir el mismo aviso
   *  en cada guardado mientras el perfil siga incompleto. */
  function addNotificationOnce(fields) {
    if (!fields || !fields.userId || !fields.dedupeKey) return addNotification(fields);
    const existing = loadAllNotifications().find((n) => n && n.userId === fields.userId && n.dedupeKey === fields.dedupeKey && !n.readAt);
    if (existing) return existing;
    return addNotification(fields);
  }

  function markNotificationRead(id) {
    const list = loadAllNotifications();
    const idx = list.findIndex((n) => n && n.id === id);
    if (idx === -1) return false;
    list[idx] = Object.assign({}, list[idx], { readAt: new Date().toISOString() });
    safeSet(KEYS.NOTIFICATIONS, list);
    return true;
  }

  /** Devuelve cuántas quedaron marcadas (0 si no había ninguna sin leer de ese usuario). */
  function markAllNotificationsRead(userId) {
    if (!userId) return 0;
    let count = 0;
    const now = new Date().toISOString();
    const updated = loadAllNotifications().map((n) => {
      if (n && n.userId === userId && !n.readAt) { count += 1; return Object.assign({}, n, { readAt: now }); }
      return n;
    });
    if (count) safeSet(KEYS.NOTIFICATIONS, updated);
    return count;
  }

  function countUnreadNotifications(userId) {
    return loadNotifications(userId).filter((n) => !n.readAt).length;
  }

  global.PLStore = {
    SCHEMA_VERSION,
    VERSION: APP_VERSION,
    saveActiveMatch, loadActiveMatch, clearActiveMatch,
    loadHistory, upsertHistory, removeFromHistory, getHistoryEntry, patchHistoryEntry,
    loadPlayerNames, rememberPlayerNames,
    loadRecordingMode, saveRecordingMode,
    normalizePlayerName, isPlaceholderPlayerName, loadCurrentPlayerName, saveCurrentPlayerName, clearCurrentPlayerName,
    // V03.0 — cuentas locales
    loadUsers, getUserById, getUserByEmail, getUserByUsername,
    createUserAccount, updateUserAccount,
    loadSession, saveSessionUserId, clearSession, getCurrentUser,
    signUpAndLogin, loginWithEmail, logoutSession,
    stampPlayersWithUserId, backfillHistoryUserId, migrateLegacyPlayerToUserIfNeeded,
    // V03.0.2 — notificaciones locales
    loadNotifications, addNotification, addNotificationOnce,
    markNotificationRead, markAllNotificationsRead, countUnreadNotifications,
  };
})(typeof window !== 'undefined' ? window : globalThis);
