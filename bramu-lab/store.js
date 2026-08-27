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
  const APP_VERSION = 'v11.2';
  const KEYS = {
    ACTIVE_MATCH: 'padellab.activeMatch.v1',
    HISTORY: 'padellab.history.v1',
    PLAYER_NAMES: 'padellab.playerNames.v1',
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
