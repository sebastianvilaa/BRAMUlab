// BRAMUlab — G1 Emails V1 (handoff 89 §5.2/§7): sender SMTP COMPARTIDO de los emails contextuales (#3 #4 #5 #7 #8).
// Reutiliza el MISMO Gmail SMTP que Supabase Auth usa para sus emails nativos (ningún proveedor nuevo). Las credenciales viven
// SOLO en secrets de Edge Functions — nunca en repo/código/logs:
//   BRAMU_SMTP_HOST (default smtp.gmail.com) · BRAMU_SMTP_PORT (default 465) · BRAMU_SMTP_USER · BRAMU_SMTP_PASS
//   BRAMU_SMTP_FROM (dirección remitente efectiva; la carga Work) · BRAMU_SMTP_FROM_NAME (default BRAMUlab)
//   BRAMU_PUBLIC_BASE_URL (base del sitio de Staging que sirve /icons/logo.png; https estable, no una URL efímera de deployment)
// Si falta algo => 'mailer_not_configured' (la request falla de forma limpia; nada se inventa).
// Dependencia pinneada (versión exacta) y soportada por Supabase Edge (ejemplo oficial SMTP con Nodemailer).
import nodemailer from 'npm:nodemailer@6.9.16';
import { renderEmail, renderEmailText, subjectFor, BRAND } from './email-templates.mjs';

export type MailRequest = { emailId: number; to: string; code?: string; previousEmail?: string; newEmail?: string };
export type MailResult = { ok: boolean; code?: string };

export function mailerConfig() {
  const user = Deno.env.get('BRAMU_SMTP_USER') || '';
  const pass = Deno.env.get('BRAMU_SMTP_PASS') || '';
  const from = Deno.env.get('BRAMU_SMTP_FROM') || '';
  const baseUrl = (Deno.env.get('BRAMU_PUBLIC_BASE_URL') || '').replace(/\/+$/, '');
  if (!user || !pass || !from || !/^https:\/\//.test(baseUrl)) return null;
  const port = Number(Deno.env.get('BRAMU_SMTP_PORT') || '465');
  return {
    host: Deno.env.get('BRAMU_SMTP_HOST') || 'smtp.gmail.com', port, secure: port === 465, user, pass, from,
    fromName: Deno.env.get('BRAMU_SMTP_FROM_NAME') || BRAND.name, baseUrl,
  };
}

export async function sendBramuEmail(req: MailRequest): Promise<MailResult> {
  const cfg = mailerConfig();
  if (!cfg) return { ok: false, code: 'mailer_not_configured' };
  try {
    const opts = { mode: 'custom' as const, code: req.code, previousEmail: req.previousEmail, newEmail: req.newEmail, baseUrl: cfg.baseUrl };
    const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
    await transport.sendMail({
      from: { name: cfg.fromName, address: cfg.from },
      to: req.to,
      replyTo: BRAND.supportEmail,
      subject: subjectFor(req.emailId),
      html: renderEmail(req.emailId, opts),
      text: renderEmailText(req.emailId, opts),
    });
    return { ok: true };
  } catch (e) {
    // Solo el código del transporte: el mensaje del error puede traer direcciones/host.
    // deno-lint-ignore no-explicit-any
    return { ok: false, code: String((e as any)?.code || 'transport_error').slice(0, 40) };
  }
}
