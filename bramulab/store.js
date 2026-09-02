/* ==========================================================================
   BRAMU Lab — store.js
   Persistencia local (localStorage). Sin servidor, sin cuentas.
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
  // Único punto central del número de versión visible (footer). Cambiar acá alcanza para
  // toda la app — nunca duplicar el string de versión en otro archivo JS. Esquema propio de
  // BRAMU Lab (vN), separado del versionado del marcador congelado (BRAMU Lab Partidos).
  const APP_VERSION = 'v1.2';
  const KEYS = {
    ACTIVE_MATCH: 'bramulab.activeMatch.v1',
    HISTORY: 'bramulab.history.v1',
    PLAYER_NAMES: 'bramulab.playerNames.v1',
    // Última selección de modo de registro (Completo / Por games), recordada para la
    // próxima vez que se abre Home. No forma parte del schemaVersion del partido en curso:
    // es una preferencia de Home, no datos de un partido.
    RECORDING_MODE: 'bramulab.recordingMode.v1',
    // Jugador actual del dispositivo, elegido una sola vez. Identidad por coincidencia de
    // nombre normalizado — deuda deliberada de la beta (ver Etapa 1 Análisis §F), no un
    // sistema de cuentas.
    CURRENT_PLAYER: 'bramulab.currentPlayerName.v1',
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

  global.PLStore = {
    SCHEMA_VERSION,
    VERSION: APP_VERSION,
    saveActiveMatch, loadActiveMatch, clearActiveMatch,
    loadHistory, upsertHistory, removeFromHistory, getHistoryEntry,
    loadPlayerNames, rememberPlayerNames,
    loadRecordingMode, saveRecordingMode,
    normalizePlayerName, loadCurrentPlayerName, saveCurrentPlayerName, clearCurrentPlayerName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
