// V04.41 — Enlace personal de invitación: `{origen}/invitacion/{token}`.
//
// Vercel reescribe `/invitacion/:token` hacia esta función (ver vercel.json). Hace dos cosas, ninguna consulta datos:
//   1. Para los bots de vista previa (WhatsApp, iMessage, Telegram…) devuelve HTML con metadatos Open Graph: título y frase
//      genéricos (sin nombres ni resultados) e imagen `/invitacion/{token}/og.png`, que genera api/invitacion-og.mjs con el
//      partido real SOLO si el enlace es válido (si no, esa ruta cae a la tarjeta de marca). `og:url` apunta a la raíz.
//   2. Para una persona, el mismo HTML redirige en el navegador a `/?claim={token}`, que es la captura que la app ya
//      implementa (localStorage + login/alta). El script lee el token de la propia URL (location.pathname).
// El token solo aparece en la URL de la imagen (la misma credencial que el enlace compartido, con el mismo vencimiento/rotación) y nunca en texto visible.
//
// El origen de las URLs absolutas (og:image) sale del Host del propio pedido, validado contra una lista cerrada: así
// Staging apunta a Staging y Production a app.bramulab.com sin variables nuevas.

const PRODUCTION_ORIGIN = 'https://app.bramulab.com';
const OG_IMAGE_PATH = '/assets/invitacion-og.png';
const OG_VERSION = '1';

export function resolveOrigin(host) {
  const h = String(host || '').toLowerCase().split(',')[0].trim();
  if (h === 'app.bramulab.com') return PRODUCTION_ORIGIN;
  // Despliegues/alias de Vercel del propio proyecto (Staging incluido). Nunca un host arbitrario.
  if (/^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(h)) return `https://${h}`;
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(h)) return `http://${h}`;
  return PRODUCTION_ORIGIN;
}

export function buildInvitationHtml(origin, token) {
  const title = 'Te invitaron a BRAMUlab';
  const description = 'Entrá, identificá tu lugar y recuperá tus partidos en tu historial.';
  const valid = /^[0-9a-f]{64}$/.test(String(token || ''));
  // Enlace válido → la imagen dinámica con el partido real (cae sola a la de marca si el enlace ya no sirve); sin token → la de marca.
  const image = valid ? `${origin}/invitacion/${token}/og.png` : `${origin}${OG_IMAGE_PATH}?v=${OG_VERSION}`;
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
<meta property="og:url" content="${origin}/">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Resultado del partido al que te invitaron a BRAMUlab">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<style>html,body{margin:0;background:#050A12;color:#F8FAFC;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}main{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center}a{color:#95FF19;font-weight:700}p{margin:0;color:#9AA7B5}</style>
</head>
<body>
<main>
<strong>BRAMUlab</strong>
<p>Abriendo tu invitación…</p>
<p><a id="go" href="/">Continuar</a></p>
</main>
<script>
(function () {
  // El token vive solo en la URL del navegador (nunca en este HTML). Se acepta únicamente el formato real (64 hex).
  var m = /^\\/invitacion\\/([0-9a-fA-F]{64})\\/?$/.exec(location.pathname);
  var target = m ? '/?claim=' + m[1].toLowerCase() : '/';
  document.getElementById('go').setAttribute('href', target);
  location.replace(target);
})();
</script>
<noscript><p>Para abrir tu invitación continuá desde <a href="/">BRAMUlab</a>.</p></noscript>
</body>
</html>
`;
}

export default function handler(req, res) {
  const origin = resolveOrigin(req.headers['x-forwarded-host'] || req.headers.host);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Un enlace personal no se guarda en cachés compartidas ni se reenvía como referrer a terceros.
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  const raw = (req.query && req.query.t) || '';
  res.status(200).send(buildInvitationHtml(origin, String(raw).toLowerCase()));
}
