// BRAMUlab — G1 Emails V1 (handoff 89): FUENTE ÚNICA de copy, asuntos y diseño "BRAMU Night Card" de los 8 emails.
//
// Módulo PURO (sin Node/Deno APIs): lo importan
//   * las Edge Functions (emails contextuales #3 #4 #5 #7 #8 -> `renderEmail(id, { mode: 'custom', ... })`), y
//   * supabase/scripts/build-email-templates.mjs, que genera los HTML standalone de los emails NATIVOS de Supabase Auth
//     (#1 confirmation, #2 recovery, #4 email_change de plataforma, #6 password_changed_notification) en
//     supabase/email-templates/ con variables Go-template (`{{ .Token }}`, `{{ .SiteURL }}`). Un test compara lo versionado
//     contra lo generado: el repo —no el Dashboard— es la fuente del copy.
//
// Copy y asuntos: EXACTOS del handoff 89 §2. No reabrir. Email-safe: tablas + estilos inline, sin flex/grid/webfonts, una columna
// de ~560 px, el código es TEXTO HTML real (copiable), degradación segura si no carga el logo (alt estilizado sobre fondo oscuro).

export const BRAND = {
  name: 'BRAMUlab',
  tagline: 'Donde vive tu pádel.',
  supportEmail: 'bramulab@gmail.com',
  logoPath: '/icons/logo.png', // bramulab/icons/logo.png servido en la raíz del sitio
};

export const TOKENS = {
  outer: '#03070D', bg: '#050A12', surface1: '#09131F', surface2: '#0D1A2A', surface3: '#112238',
  text: '#F8FAFC', secondary: '#9AA7B5', muted: '#687482', lime: '#95FF19', limeDeep: '#66B30F', blue: '#199FFF', danger: '#FF5B61',
};

const FONT = 'Inter, Arial, Helvetica, sans-serif';
const EXPIRY = 'El código vence en 60 minutos.';

/** Plantillas. `blocks` se renderiza en orden; tipos: p (párrafo), strong (párrafo destacado), code, note (nota tenue),
 *  ul (viñetas), kv (etiqueta + valor), expiry. `native`: nombre del template de Supabase Auth (null = solo contextual). */
export const EMAIL_TEMPLATES = {
  1: {
    id: 1, key: 'confirmation', category: 'CUENTA', native: 'confirmation', codeTone: 'lime', footer: 'standard',
    subject: 'Confirmá tu cuenta en BRAMUlab',
    title: 'Confirmá tu cuenta',
    blocks: [
      { t: 'p', v: 'Este es tu código para terminar de crear tu cuenta en BRAMUlab.' },
      { t: 'code' },
      { t: 'expiry' },
      { t: 'p', v: 'Ingresalo en BRAMUlab y listo.' },
      { t: 'p', v: 'Nos vemos en la cancha. 🎾' },
      { t: 'note', v: 'Si no fuiste vos quien inició este registro, podés ignorar este email.' },
    ],
  },
  2: {
    id: 2, key: 'recovery', category: 'ACCESO', native: 'recovery', codeTone: 'lime', footer: 'standard',
    subject: 'Recuperá tu contraseña en BRAMUlab',
    title: 'Recuperá tu contraseña',
    blocks: [
      { t: 'p', v: 'Recibimos una solicitud para cambiar la contraseña de tu cuenta.' },
      { t: 'p', v: 'Usá este código para continuar:' },
      { t: 'code' },
      { t: 'expiry' },
      { t: 'p', v: 'Ingresalo en BRAMUlab y elegí una nueva contraseña.' },
      { t: 'note', v: 'Si no pediste este cambio, podés ignorar este email. Tu contraseña actual seguirá funcionando.' },
    ],
  },
  3: {
    id: 3, key: 'change_email_current', category: 'SEGURIDAD', native: null, codeTone: 'lime', footer: 'standard',
    subject: 'Confirmá el cambio de email en BRAMUlab',
    title: 'Confirmá el cambio de email',
    blocks: [
      { t: 'p', v: 'Pediste cambiar el email asociado a tu cuenta de BRAMUlab.' },
      { t: 'p', v: 'Antes de continuar, necesitamos confirmar que fuiste vos.' },
      { t: 'code' },
      { t: 'expiry' },
      { t: 'p', v: 'Ingresalo en BRAMUlab para continuar con el cambio.' },
      { t: 'note', v: 'Si no solicitaste modificar tu email, no ingreses el código y contactanos.' },
    ],
  },
  4: {
    id: 4, key: 'change_email_new', category: 'CUENTA', native: 'email_change', codeTone: 'lime', footer: 'standard',
    subject: 'Confirmá tu nuevo email en BRAMUlab',
    title: 'Confirmá tu nuevo email',
    blocks: [
      { t: 'p', v: 'Ya casi terminamos el cambio.' },
      { t: 'p', v: 'Usá este código para confirmar que esta es la nueva dirección que querés asociar a tu cuenta de BRAMUlab.' },
      { t: 'code' },
      { t: 'expiry' },
      { t: 'p', v: 'Ingresalo en BRAMUlab para completar el cambio.' },
      { t: 'note', v: 'Si no reconocés esta solicitud, no ingreses el código y contactanos.' },
    ],
  },
  5: {
    id: 5, key: 'email_changed', category: 'SEGURIDAD', native: null, codeTone: null, footer: 'standard',
    subject: 'El email de tu cuenta fue cambiado',
    title: 'Tu email fue cambiado',
    blocks: [
      { t: 'p', v: 'El email asociado a tu cuenta de BRAMUlab fue actualizado.' },
      { t: 'kv', label: 'Email anterior', value: 'previousEmail' },
      { t: 'kv', label: 'Email nuevo', value: 'newEmail' },
      { t: 'p', v: 'Si fuiste vos, no tenés que hacer nada.' },
      { t: 'note', v: 'Si no reconocés este cambio, contactanos cuanto antes.' },
    ],
  },
  6: {
    id: 6, key: 'password_changed', category: 'SEGURIDAD', native: 'password_changed_notification', codeTone: null, footer: 'standard',
    subject: 'La contraseña de tu cuenta fue cambiada',
    title: 'Tu contraseña fue cambiada',
    blocks: [
      { t: 'p', v: 'La contraseña de tu cuenta de BRAMUlab fue actualizada correctamente.' },
      { t: 'p', v: 'Si fuiste vos, no tenés que hacer nada.' },
      { t: 'note', v: 'Si no reconocés este cambio, recuperá tu contraseña y contactanos cuanto antes.' },
    ],
  },
  7: {
    id: 7, key: 'delete_account', category: 'CUENTA', native: null, codeTone: 'danger', footer: 'standard',
    subject: 'Confirmá la eliminación de tu cuenta',
    title: 'Confirmá la eliminación de tu cuenta',
    blocks: [
      { t: 'p', v: 'Estás por eliminar definitivamente tu cuenta de BRAMUlab.' },
      { t: 'p', v: 'Usá este código para confirmar la acción:' },
      { t: 'code' },
      { t: 'expiry' },
      { t: 'p', v: 'Antes de continuar, tené en cuenta que:' },
      { t: 'ul', v: [
        'tu cuenta y tus datos personales activos serán eliminados o anonimizados según corresponda;',
        'los partidos compartidos con otros jugadores permanecerán en sus historiales;',
        'tu identidad en esos registros pasará a mostrarse como Jugador eliminado;',
        'si volvés a registrarte en BRAMUlab, empezarás con una identidad nueva.',
      ] },
      { t: 'strong', v: 'La eliminación es definitiva.' },
      { t: 'note', v: 'Si no fuiste vos quien inició esta acción, no ingreses el código y contactanos.' },
    ],
  },
  8: {
    id: 8, key: 'account_deleted', category: 'CUENTA', native: null, codeTone: null, footer: 'minimal',
    subject: 'Tu cuenta de BRAMUlab fue eliminada',
    title: 'Tu cuenta fue eliminada',
    blocks: [
      { t: 'p', v: 'La eliminación de tu cuenta de BRAMUlab se completó correctamente.' },
      { t: 'p', v: 'La acción es definitiva y la cuenta ya no puede recuperarse.' },
      { t: 'p', v: 'No necesitás hacer nada más.' },
    ],
  },
};

/** Mapa template Auth nativo -> id de email (#1 #2 #4 #6). */
export const NATIVE_TEMPLATES = Object.fromEntries(Object.values(EMAIL_TEMPLATES).filter((t) => t.native).map((t) => [t.native, t.id]));

export const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Variables Go-template de Supabase Auth para el modo `native`. */
export const NATIVE_VARS = { code: '{{ .Token }}', logoBase: '{{ .SiteURL }}' };

function renderBlock(b, tpl, ctx) {
  const T = TOKENS;
  switch (b.t) {
    case 'p':
      return `<tr><td style="padding:0 0 14px 0;font-family:${FONT};font-size:16px;line-height:24px;color:${T.text};">${escapeHtml(b.v)}</td></tr>`;
    case 'strong':
      return `<tr><td style="padding:2px 0 14px 0;font-family:${FONT};font-size:16px;line-height:24px;font-weight:bold;color:${T.text};">${escapeHtml(b.v)}</td></tr>`;
    case 'note':
      return `<tr><td style="padding:6px 0 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${T.secondary};">${escapeHtml(b.v)}</td></tr>`;
    case 'expiry':
      return `<tr><td align="center" style="padding:0 0 16px 0;font-family:${FONT};font-size:14px;line-height:20px;color:${T.secondary};">${escapeHtml(EXPIRY)}</td></tr>`;
    case 'ul': {
      const items = b.v.map((li) => `<tr><td width="18" valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${T.secondary};">&bull;</td><td valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${T.secondary};">${escapeHtml(li)}</td></tr>`).join('');
      return `<tr><td style="padding:0 0 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${items}</table></td></tr>`;
    }
    case 'kv': {
      const value = ctx[b.value] == null ? '' : ctx[b.value];
      return `<tr><td style="padding:0 0 12px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.surface2}" style="background-color:${T.surface2};border:1px solid ${T.surface3};border-radius:12px;"><tr><td style="padding:12px 16px;"><div style="font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1px;text-transform:uppercase;color:${T.muted};">${escapeHtml(b.label)}</div><div style="padding-top:4px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:bold;color:${T.text};word-break:break-all;">${escapeHtml(value)}</div></td></tr></table></td></tr>`;
    }
    case 'code': {
      const tone = tpl.codeTone === 'danger' ? T.danger : T.lime;
      // El código va como ÚNICO nodo de texto (sin espacios ni <span> por dígito): se copia/pega entero.
      return `<tr><td style="padding:6px 0 14px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.surface3}" style="background-color:${T.surface3};border:1px solid ${tone};border-radius:14px;"><tr><td align="center" style="padding:20px 8px;font-family:${FONT};font-size:38px;line-height:44px;font-weight:bold;letter-spacing:10px;color:${tone};"><span style="color:${tone};">${ctx.code}</span></td></tr></table></td></tr>`;
    }
    default:
      return '';
  }
}

function renderFooter(tpl) {
  const T = TOKENS;
  const brand = `<div style="font-family:${FONT};font-size:13px;line-height:20px;color:${T.secondary};"><strong style="color:${T.text};">${BRAND.name}</strong> &middot; ${escapeHtml(BRAND.tagline)}</div>`;
  if (tpl.footer === 'minimal') {
    return `<tr><td align="center" style="padding:20px 24px 28px 24px;">${brand}</td></tr>`;
  }
  const help = `<div style="padding-top:6px;font-family:${FONT};font-size:12px;line-height:18px;color:${T.muted};">&iquest;Necesit&aacute;s ayuda? &middot; <a href="mailto:${BRAND.supportEmail}" style="color:${T.blue};text-decoration:none;">${BRAND.supportEmail}</a></div>`;
  return `<tr><td align="center" style="padding:20px 24px 28px 24px;">${brand}${help}</td></tr>`;
}

/**
 * HTML completo de un email.
 * @param {number} id  1..8
 * @param {{mode?:'custom'|'native', code?:string, previousEmail?:string, newEmail?:string, baseUrl?:string}} [opts]
 *   native: usa `{{ .Token }}` y `{{ .SiteURL }}` (Go-template de Supabase Auth). custom: valores reales (escapados).
 */
export function renderEmail(id, opts = {}) {
  const tpl = EMAIL_TEMPLATES[id];
  if (!tpl) throw new Error(`template de email desconocido: ${id}`);
  const T = TOKENS;
  const mode = opts.mode === 'native' ? 'native' : 'custom';
  const base = mode === 'native' ? NATIVE_VARS.logoBase : String(opts.baseUrl || '').replace(/\/+$/, '');
  const ctx = {
    code: mode === 'native' ? NATIVE_VARS.code : escapeHtml(opts.code),
    previousEmail: opts.previousEmail, newEmail: opts.newEmail,
  };
  if (tpl.codeTone && mode === 'custom' && !/^[0-9]{6}$/.test(String(opts.code || ''))) throw new Error('el código del email debe ser de 6 dígitos');
  if (id === 5 && mode === 'custom' && (!opts.previousEmail || !opts.newEmail)) throw new Error('el email #5 requiere previousEmail y newEmail');
  const logoSrc = `${base}${BRAND.logoPath}`;
  // Logo REAL (bramulab/icons/logo.png, 915x139): altura 30 px, proporción intacta (ancho ~198). alt estilizado = degradación segura.
  const logo = `<img src="${logoSrc}" alt="${BRAND.name}" height="30" style="display:block;height:30px;width:auto;max-width:200px;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:20px;line-height:30px;font-weight:bold;color:${T.lime};" />`;
  const body = tpl.blocks.map((b) => renderBlock(b, tpl, ctx)).join('');
  const accent = tpl.codeTone === 'danger' ? T.danger : T.lime;
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(tpl.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${T.outer};" bgcolor="${T.outer}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.outer}" style="background-color:${T.outer};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.bg}" style="width:100%;max-width:560px;background-color:${T.bg};border-radius:20px;">
<tr><td style="padding:28px 28px 0 28px;">${logo}</td></tr>
<tr><td style="padding:16px 28px 0 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="3" bgcolor="${accent}" style="height:3px;line-height:3px;font-size:3px;background-color:${accent};border-radius:2px;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding:20px 20px 0 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${T.surface1}" style="background-color:${T.surface1};border:1px solid ${T.surface3};border-radius:16px;">
<tr><td style="padding:24px 24px 10px 24px;">
<div style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:2px;color:${accent};">${escapeHtml(tpl.category)}</div>
<div style="padding-top:8px;font-family:${FONT};font-size:26px;line-height:32px;font-weight:bold;color:${T.text};">${escapeHtml(tpl.title)}</div>
</td></tr>
<tr><td style="padding:12px 24px 22px 24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table></td></tr>
</table>
</td></tr>
${renderFooter(tpl)}
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/** Versión texto plano (multipart/alternative) — misma información, sin diseño. */
export function renderEmailText(id, opts = {}) {
  const tpl = EMAIL_TEMPLATES[id];
  if (!tpl) throw new Error(`template de email desconocido: ${id}`);
  const mode = opts.mode === 'native' ? 'native' : 'custom';
  const code = mode === 'native' ? NATIVE_VARS.code : String(opts.code || '');
  const lines = [tpl.title, ''];
  for (const b of tpl.blocks) {
    if (b.t === 'code') lines.push(code, '');
    else if (b.t === 'expiry') lines.push(EXPIRY, '');
    else if (b.t === 'ul') { b.v.forEach((li) => lines.push(`- ${li}`)); lines.push(''); }
    else if (b.t === 'kv') lines.push(`${b.label}`, String(opts[b.value] || ''), '');
    else lines.push(b.v, '');
  }
  lines.push(tpl.footer === 'minimal' ? `${BRAND.name} · ${BRAND.tagline}` : `${BRAND.name} · ${BRAND.tagline}\n¿Necesitás ayuda? · ${BRAND.supportEmail}`);
  return lines.join('\n');
}

export const subjectFor = (id) => {
  const tpl = EMAIL_TEMPLATES[id];
  if (!tpl) throw new Error(`template de email desconocido: ${id}`);
  return tpl.subject;
};
