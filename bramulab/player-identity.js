/* ==========================================================================
   BRAMU Lab — player-identity.js (V03.0)
   Validación de cuenta: email, contraseña, @usuario, edad. Funciones puras,
   sin DOM y sin dependencia de PLStore — reciben listas (usuarios existentes)
   como parámetro en vez de leer storage directamente, mismo criterio que ya
   usa match-load.js (isDuplicatePlayerName recibe `existingNames`, no lee
   Store). Esto evita un problema de orden de carga: como este módulo no
   depende de store.js, puede cargarse en cualquier posición del <script> list
   sin que importe si va antes o después.

   Nada acá resuelve "es mi partido" ni toca `players[]`/`userId` de un
   partido — esa es responsabilidad de player-home.js (resolución de
   pertenencia) y store.js (estampado/backfill). Este módulo es exclusivamente
   sobre la CUENTA (email/contraseña/usuario/edad), consolidado §2/§7.
   ========================================================================== */
(function (global) {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_MIN_LENGTH = 8;

  function isValidEmail(email) {
    return EMAIL_RE.test((email || '').trim());
  }

  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  /** Consolidado §2 Paso 1 — "mayúscula, minúscula, número, símbolo y longitud mínima
   *  razonable". `PASSWORD_MIN_LENGTH` es una constante exportada a propósito (decisión
   *  documentada del Informe: 8 caracteres, valor fácil de cambiar sin tocar la lógica). */
  function checkPasswordStrength(password) {
    const p = password || '';
    const hasUpper = /[A-ZÁÉÍÓÚÑ]/.test(p);
    const hasLower = /[a-záéíóúñ]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSymbol = /[^A-Za-z0-9]/.test(p);
    const hasMinLength = p.length >= PASSWORD_MIN_LENGTH;
    return {
      hasUpper, hasLower, hasNumber, hasSymbol, hasMinLength,
      ok: hasUpper && hasLower && hasNumber && hasSymbol && hasMinLength,
    };
  }

  function passwordsMatch(password, repeat) {
    return !!password && password === repeat;
  }

  /** Quita acentos, pasa a minúscula, colapsa cualquier cosa que no sea [a-z0-9] en un solo
   *  guión, y recorta guiones al inicio/final — mismo criterio de "un solo string normalizado
   *  y determinístico" que ya usa Store.normalizePlayerName para nombres, aplicado acá a
   *  @usuario. Nunca deja el string vacío silenciosamente: si no queda nada usable, cae a
   *  'jugador' (igual que el fallback ya documentado en el bootstrap de migración). */
  function slugifyUsername(base) {
    const slug = (base || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '');
    return slug || 'jugador';
  }

  function isValidUsernameFormat(username) {
    const u = (username || '').replace(/^@/, '');
    return /^[a-z0-9-]{3,20}$/.test(u);
  }

  function isUsernameTaken(username, users, excludeUserId) {
    const target = (username || '').trim().toLowerCase().replace(/^@/, '');
    if (!target) return false;
    return (users || []).some((u) => u && u.id !== excludeUserId
      && (u.username || '').trim().toLowerCase() === target);
  }

  function isEmailTaken(email, users, excludeUserId) {
    const target = normalizeEmail(email);
    if (!target) return false;
    return (users || []).some((u) => u && u.id !== excludeUserId
      && normalizeEmail(u.email) === target);
  }

  /** Primer slug libre a partir de nombre/apellido: 'base', 'base-1', 'base-2'… — usado para
   *  proponer un @usuario mientras el campo sigue "sin tocar" por el usuario (consolidado §2
   *  "sugerir variantes... solo si no complica la ronda"). Nunca devuelve un slug ya tomado. */
  function suggestUsername(firstName, lastName, users) {
    const base = slugifyUsername([firstName, lastName].filter(Boolean).join('-') || firstName || lastName);
    if (!isUsernameTaken(base, users)) return base;
    let n = 1;
    while (isUsernameTaken(`${base}-${n}`, users)) n += 1;
    return `${base}-${n}`;
  }

  /** Edad en años cumplidos a partir de una fecha de nacimiento "YYYY-MM-DD" (el formato de
   *  `<input type="date">`), contra `nowDate` (por defecto la fecha real — parámetro opcional
   *  solo para poder testear de forma determinística, mismo patrón que ya usa
   *  PH.computeActivityWeeks4(matches, playerName, nowDate)). `null` si `birthDateIso` está
   *  ausente o es inválida — nunca inventa una edad. Construye la fecha con los 3 componentes
   *  en LOCAL en vez de `new Date(birthDateIso)`: ese parseo interpreta "YYYY-MM-DD" como
   *  medianoche UTC, y en una zona horaria detrás de UTC (como Argentina) `.getDate()` sobre
   *  esa fecha devuelve el día ANTERIOR — el mismo tipo de bug de mezcla UTC/local ya corregido
   *  en la carga manual (V02.1/V02.5), acá evitado desde el origen. */
  function calculateAge(birthDateIso, nowDate) {
    if (!birthDateIso) return null;
    const parts = String(birthDateIso).split('-').map(Number);
    const [by, bm, bd] = parts;
    if (!by || !bm || !bd) return null;
    const birth = new Date(by, bm - 1, bd);
    if (Number.isNaN(birth.getTime())) return null;
    const now = nowDate || new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
    return age;
  }

  // BRAMUlab_V03.6 (§7) — normalización mínima de teléfono para el deep link de WhatsApp:
  // suficiente para prototipo, nunca una librería de telefonía internacional completa. Quita
  // espacios/guiones/paréntesis/el prefijo `+`, deja solo dígitos — la MISMA normalización
  // sirve para validar (largo razonable) y para armar `wa.me` (que exige solo dígitos).
  const WHATSAPP_PHONE_MIN_DIGITS = 8;
  const WHATSAPP_PHONE_MAX_DIGITS = 15;

  function normalizePhoneForWhatsApp(phone) {
    const digits = (phone || '').replace(/\D+/g, '');
    return digits || null;
  }

  /** Validación simple (§7): impide activar el contacto con un campo vacío o claramente
   *  inválido, sin resolver telefonía internacional real (sin distinguir código de país). */
  function isValidWhatsAppPhone(phone) {
    const digits = normalizePhoneForWhatsApp(phone);
    return !!digits && digits.length >= WHATSAPP_PHONE_MIN_DIGITS && digits.length <= WHATSAPP_PHONE_MAX_DIGITS;
  }

  /** §2/§8 — único punto que decide si corresponde mostrar "Contactar por WhatsApp": exige
   *  AMBAS condiciones (consentimiento explícito + teléfono válido), nunca infiere una a partir
   *  de la otra. `user` acepta cualquier objeto con `phone`/`allowWhatsAppContact` (el Usuario
   *  real de Store, o un fixture de test). */
  function canContactViaWhatsApp(user) {
    return !!(user && user.allowWhatsAppContact && isValidWhatsAppPhone(user.phone));
  }

  /** §6 — deep link `wa.me` con el mensaje prearmado, URL-encoded. `null` si el teléfono no es
   *  válido (nunca arma una URL a medias que abriría WhatsApp sin destinatario). */
  function buildWhatsAppContactUrl(phone, message) {
    if (!isValidWhatsAppPhone(phone)) return null;
    return `https://wa.me/${normalizePhoneForWhatsApp(phone)}?text=${encodeURIComponent(message || '')}`;
  }

  global.PLIdentity = {
    isValidEmail, normalizeEmail,
    PASSWORD_MIN_LENGTH, checkPasswordStrength, passwordsMatch,
    slugifyUsername, isValidUsernameFormat, isUsernameTaken, isEmailTaken, suggestUsername,
    calculateAge,
    normalizePhoneForWhatsApp, isValidWhatsAppPhone, canContactViaWhatsApp, buildWhatsAppContactUrl,
  };
})(typeof window !== 'undefined' ? window : globalThis);
