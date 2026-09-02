/* ==========================================================================
   BRAMU Lab — store.js (v9)
   Persistencia local (localStorage). Sin servidor, sin cuentas.
   Incluye schemaVersion simple: si encuentra datos de una versión anterior
   o incompleta, los ignora de forma segura en vez de romper la app.
   V9: las claves internas de localStorage se MANTIENEN tal cual (padellab.*)
   a propósito — cambiarlas perdería el historial y el partido en curso de
   quien actualice desde una versión anterior (consolidado V9, branding). */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 3;
  // V10 (44/97): único punto central del número de versión visible (footer). Cambiar
  // acá alcanza para toda la app — nunca duplicar el string de versión en otro archivo JS.
  const APP_VERSION = 'v14.1';
  const KEYS = {
    ACTIVE_MATCH: 'padellab.activeMatch.v1',
    HISTORY: 'padellab.history.v1',
    PLAYER_NAMES: 'padellab.playerNames.v1',
    // V13 (§2): última selección de modo de registro (Completo / Por games), recordada
    // para la próxima vez que se abre Home. No forma parte del schemaVersion del partido
    // en curso: es una preferencia de Home, no datos de un partido.
    RECORDING_MODE: 'padellab.recordingMode.v1',
    // Etapa 2 (Rama Jugador §3.2): jugador actual del dispositivo, elegido una sola vez.
    // Identidad por coincidencia de nombre normalizado — deuda deliberada de la beta (ver
    // Etapa 1 Análisis §F), no un sistema de cuentas.
    CURRENT_PLAYER: 'padellab.currentPlayerName.v1',
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
