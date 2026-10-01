// BRAMUlab — G1 Emails V1: sincroniza los templates/asuntos NATIVOS de Supabase Auth (versionados en supabase/email-templates/)
// con la configuración HOSTED de un proyecto, vía Management API. Pensado para la pasada de Work en STAGING.
//
//   node supabase/scripts/sync-auth-email-templates.mjs                 # DRY-RUN (default): imprime qué cambiaría; no usa red
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node supabase/scripts/sync-auth-email-templates.mjs --check       # GET y compara con lo versionado (no escribe)
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node supabase/scripts/sync-auth-email-templates.mjs --apply --env staging   # PATCH
//
// El token y el ref SOLO por variables de entorno (nunca argumentos, nunca logs, nunca repo). --apply exige `--env staging`
// explícito. Switches que fija: password changed notification ON, email changed notification OFF (el aviso #5 es custom,
// ver 90), Secure Email Change ON, OTP de 6 dígitos con 3600 s. NO toca SMTP ni otros templates fuera del inventario V1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OUT_DIR, HOSTED_KEYS } from './build-email-templates.mjs';
import { EMAIL_TEMPLATES } from '../functions/_shared/email-templates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
void HERE;

/** Payload exacto del PATCH /v1/projects/{ref}/config/auth. */
export function buildAuthConfigPayload(dir = OUT_DIR) {
  const payload = {};
  for (const tpl of Object.values(EMAIL_TEMPLATES)) {
    if (!tpl.native) continue;
    const keys = HOSTED_KEYS[tpl.native];
    payload[keys.subject] = tpl.subject;
    payload[keys.content] = fs.readFileSync(path.join(dir, 'auth', `${tpl.native}.html`), 'utf8');
    if (keys.enabled) payload[keys.enabled] = true;
  }
  payload.mailer_notifications_email_changed_enabled = false; // el aviso #5 lo envía la Edge Function (no duplicar)
  payload.mailer_secure_email_change_enabled = true; // defensa del proyecto ante updateUser({email}) directo
  payload.mailer_otp_exp = 3600;
  payload.mailer_otp_length = 6;
  return payload;
}

const summarize = (payload) => Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, typeof v === 'string' && v.length > 80 ? `<${v.length} chars>` : v]));

async function api(method, ref, token, body) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Management API ${method} -> HTTP ${res.status}`);
  return method === 'GET' ? res.json() : null;
}

export function diffAgainst(payload, hosted) {
  return Object.keys(payload).filter((k) => hosted[k] !== payload[k]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const payload = buildAuthConfigPayload();
  const token = process.env.SUPABASE_ACCESS_TOKEN; const ref = process.env.SUPABASE_PROJECT_REF;
  if (args.includes('--apply') || args.includes('--check')) {
    if (!token || !ref) { console.error('Faltan SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF en el entorno.'); process.exit(2); }
    if (args.includes('--apply')) {
      if (args[args.indexOf('--env') + 1] !== 'staging') { console.error('--apply exige `--env staging` (esta ronda es solo Staging).'); process.exit(2); }
      await api('PATCH', ref, token, payload);
      const after = diffAgainst(payload, await api('GET', ref, token));
      console.log(after.length ? `[sync] aplicado, pero difieren: ${after.join(', ')}` : '[sync] aplicado y verificado: hosted == versionado');
      process.exit(after.length ? 1 : 0);
    }
    const d = diffAgainst(payload, await api('GET', ref, token));
    console.log(d.length ? `[check] DIFIEREN: ${d.join(', ')}` : '[check] OK: hosted == versionado');
    process.exit(d.length ? 1 : 0);
  }
  console.log('[dry-run] PATCH /config/auth con:');
  console.log(JSON.stringify(summarize(payload), null, 2));
}
