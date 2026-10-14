// V04.41 — Representación compacta del token de invitación (SIN crear un segundo token ni reducir su seguridad).
// El token real son 32 bytes aleatorios guardados como 64 hex (256 bits); en el enlace viaja como base64url (43 caracteres), que es una
// recodificación LOSSLESS de esos mismos 32 bytes. La base solo conoce el hex: acá se vuelve a él. También se aceptan los 64 hex (enlaces
// anteriores). Cualquier otro formato → null (nunca se adivina ni se completa).

export const HEX_RE = /^[0-9a-f]{64}$/;
const B64URL_RE = /^[A-Za-z0-9_-]{43}$/;

export function hexToCode(hex) {
  if (!HEX_RE.test(String(hex || ''))) return null;
  return Buffer.from(hex, 'hex').toString('base64url');
}

/** Código del enlace (43 base64url o 64 hex) → token hex en minúsculas, o null. Canónico: el base64url debe recodificar idéntico (sin bits sobrantes). */
export function codeToHex(code) {
  const c = String(code || '');
  if (HEX_RE.test(c.toLowerCase()) && c.length === 64) return c.toLowerCase();
  if (!B64URL_RE.test(c)) return null;
  const buf = Buffer.from(c, 'base64url');
  if (buf.length !== 32 || buf.toString('base64url') !== c) return null;
  return buf.toString('hex');
}
