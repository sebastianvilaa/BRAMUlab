// `/i/{código}/og.png` → imagen de la invitación. Con un enlace válido: el partido real; con cualquier otro caso (inválido, vencido, rotado,
// usado, RPC sin responder, error de render): la tarjeta de MARCA, con 200 y el mismo formato (el bot nunca ve un error ni aprende por qué).
import { codeToHex } from './_lib/token.js';
import { fetchCard, renderCardPng, brandPng } from './_lib/card.js';

export default async function handler(req, res) {
  const hex = codeToHex((req.query && req.query.c) || '');
  let png = null;
  if (hex) {
    const card = await fetchCard(hex);
    if (card) {
      try { png = await renderCardPng(card); } catch (e) {
        // el motivo queda en los logs de la función; nunca incluye el token ni datos del partido
        console.error('invitacion-og: render falló →', e && e.message ? e.message : String(e));
      }
    }
  }
  if (!png) png = brandPng();
  if (!png) { res.status(404).end(); return; }
  res.setHeader('Content-Type', 'image/png');
  // Un enlace personal no se guarda en cachés compartidas (si se rota o se usa, la imagen deja de salir).
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.status(200).end(png);
}
