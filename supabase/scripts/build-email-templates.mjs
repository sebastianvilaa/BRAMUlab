// BRAMUlab — G1 Emails V1: genera (o verifica) los artefactos versionados de supabase/email-templates/ desde la fuente única
// supabase/functions/_shared/email-templates.mjs.
//
//   node supabase/scripts/build-email-templates.mjs           # escribe auth/*.html, previews/*.html y manifest.json
//   node supabase/scripts/build-email-templates.mjs --check   # exit 1 si lo versionado difiere de lo generado (drift)
//
// auth/*.html   -> HTML standalone de los emails NATIVOS de Supabase Auth (`{{ .Token }}` cuando corresponde; logo público versionado de Staging).
// previews/*.html -> los 8 emails con código/emails de ejemplo, para revisar el render sin enviar nada (logo relativo al repo).
// manifest.json -> template -> mecanismo, asunto, archivo, hash, claves de configuración hosted. Sin secretos ni hosts reales.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EMAIL_TEMPLATES, NATIVE_VARS, renderEmail } from '../functions/_shared/email-templates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT_DIR = path.resolve(HERE, '../email-templates');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Claves del PATCH /v1/projects/{ref}/config/auth (Management API) por template nativo. */
export const HOSTED_KEYS = {
  confirmation: { subject: 'mailer_subjects_confirmation', content: 'mailer_templates_confirmation_content' },
  recovery: { subject: 'mailer_subjects_recovery', content: 'mailer_templates_recovery_content' },
  email_change: { subject: 'mailer_subjects_email_change', content: 'mailer_templates_email_change_content' },
  password_changed_notification: {
    enabled: 'mailer_notifications_password_changed_enabled',
    subject: 'mailer_subjects_password_changed_notification',
    content: 'mailer_templates_password_changed_notification_content',
  },
};

/** Devuelve { relativePath: contenido } de TODO lo generado. */
export function generate() {
  const files = {};
  const manifest = { generatedFrom: 'supabase/functions/_shared/email-templates.mjs', hostedStaging: { logoBase: NATIVE_VARS.logoBase, note: 'Logo real público fijado a commit; Site URL/Auth redirects se configuran aparte.' }, native: [], custom: [] };
  for (const tpl of Object.values(EMAIL_TEMPLATES)) {
    const nn = String(tpl.id).padStart(2, '0');
    files[`previews/${nn}-${tpl.key}.html`] = renderEmail(tpl.id, {
      mode: 'custom', code: '123456', previousEmail: 'anterior@example.test', newEmail: 'nuevo@example.test', baseUrl: '../../../bramulab',
    });
    if (tpl.native) {
      const html = renderEmail(tpl.id, { mode: 'native' });
      files[`auth/${tpl.native}.html`] = html;
      manifest.native.push({
        emailId: tpl.id, authTemplate: tpl.native, subject: tpl.subject, file: `auth/${tpl.native}.html`, sha256: sha(html),
        hostedKeys: HOSTED_KEYS[tpl.native], variables: tpl.native === 'password_changed_notification' ? [] : ['{{ .Token }}'],
        note: tpl.native === 'email_change'
          ? 'Fallback de plataforma: el flujo BRAMU NO depende de este template (el cambio de email es server-side).'
          : undefined,
      });
    }
    // #4 vive en DOS planos a propósito: el flujo BRAMU lo envía por Edge+SMTP, mientras
    // `email_change` queda versionado solo como fallback defensivo de la plataforma.
    if ([3, 4, 5, 7, 8].includes(tpl.id)) {
      manifest.custom.push({ emailId: tpl.id, key: tpl.key, subject: tpl.subject, mechanism: 'Edge Function + SMTP compartido (BRAMU_SMTP_*)', renderer: 'renderEmail(id, { mode: "custom" })' });
    }
  }
  files['manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
  return files;
}

export function writeAll(dir = OUT_DIR) {
  const files = generate();
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return Object.keys(files);
}

export function checkAll(dir = OUT_DIR) {
  const problems = [];
  const files = generate();
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) problems.push(`falta ${rel}`);
    else if (fs.readFileSync(abs, 'utf8') !== content) problems.push(`desactualizado ${rel} (correr build-email-templates.mjs)`);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) {
    const problems = checkAll();
    if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
    console.log('[email-templates] OK: lo versionado coincide con lo generado');
  } else {
    console.log(writeAll().map((f) => `  escribió ${f}`).join('\n'));
  }
}
