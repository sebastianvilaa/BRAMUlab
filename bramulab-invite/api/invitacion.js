// `/invitacion/{código}` → página del enlace personal de invitación. Dos públicos con el mismo HTML:
//   · bots de vista previa (WhatsApp, iMessage, Telegram…): leen los metadatos Open Graph — título/frase genéricos (sin nombres ni resultados) e
//     imagen `/invitacion/{código}/og.png` (el partido real si el enlace es válido; si no, la tarjeta de marca);
//   · personas: el script las lleva a la app (`BRAMU_APP_URL/?claim={token}`), que ya captura la invitación (localStorage → login/alta →
//     «¿JUGASTE ESTE PARTIDO?»). La app de Staging sigue protegida por Vercel Authentication: este servicio solo redirige.
// Esta función NO consulta datos. El token aparece solo en la URL de la imagen y en el destino de la redirección (la misma credencial del enlace).
import { codeToHex } from './_lib/token.js';

const APP_URL_RE = /^https:\/\/[a-z0-9][a-z0-9.-]*(:\d{1,5})?$/;

export function resolveOrigin(host) {
  const h = String(host || '').toLowerCase().split(',')[0].trim();
  if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.vercel\.app$/.test(h)) return `https://${h}`;
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(h)) return `http://${h}`;
  if (/^[a-z0-9][a-z0-9.-]*\.bramulab\.com$/.test(h)) return `https://${h}`;
  return null;
}

/** Destino de las personas. `appUrl` viene de BRAMU_APP_URL (servidor); solo https y sin ruta. Sin token válido → raíz de la app. */
export function buildTarget(appUrl, hex) {
  if (!APP_URL_RE.test(String(appUrl || ''))) return null;
  return hex ? `${appUrl}/?claim=${hex}` : `${appUrl}/`;
}

export function buildInvitationHtml({ origin, code, hex, appUrl }) {
  const title = 'Te invitaron a BRAMUlab';
  const description = 'Entrá, identificá tu lugar y recuperá tus partidos en tu historial.';
  const image = hex ? `${origin}/invitacion/${code}/og.png` : `${origin}/invitacion/x/og.png`;
  const target = buildTarget(appUrl, hex);
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#050A12">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="BRAMUlab">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${esc(origin)}/">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Resultado del partido al que te invitaron a BRAMUlab">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${esc(image)}">
<style>html,body{margin:0;background:#050A12;color:#F8FAFC;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center}a{color:#95FF19;font-weight:700}p{margin:0;color:#9AA7B5}</style>
</head>
<body>
<main>
<strong>BRAMUlab</strong>
<p>${target ? 'Abriendo tu invitación…' : 'Esta invitación no está disponible.'}</p>
${target ? `<p><a id="go" href="${esc(target)}">Continuar</a></p>` : ''}
</main>
${target ? `<script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')});</script>` : ''}
</body>
</html>
`;
}

export default function handler(req, res) {
  const origin = resolveOrigin(req.headers['x-forwarded-host'] || req.headers.host);
  const code = String((req.query && req.query.c) || '');
  const hex = codeToHex(code);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!origin) { res.status(404).send('Not found'); return; }
  res.status(200).send(buildInvitationHtml({ origin, code: hex ? code : '', hex, appUrl: process.env.BRAMU_APP_URL }));
}
