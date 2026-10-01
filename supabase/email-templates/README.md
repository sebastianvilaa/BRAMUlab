# Emails V1 — templates versionados (G1, Issue #21)

Fuente única del copy, asuntos y diseño **BRAMU Night Card** de los 8 emails de V1:
[`../functions/_shared/email-templates.mjs`](../functions/_shared/email-templates.mjs). Los archivos de esta carpeta se **generan** de ahí
(`node supabase/scripts/build-email-templates.mjs`) y un test falla si se desincronizan (`--check`). El Dashboard de Supabase **no** es fuente de copy.

| # | Email | Asunto | Mecanismo | Archivo |
|---|-------|--------|-----------|---------|
| 1 | Confirmación de cuenta | Confirmá tu cuenta en BRAMUlab | **Auth nativo** `confirmation` | `auth/confirmation.html` |
| 2 | Recuperación de contraseña | Recuperá tu contraseña en BRAMUlab | **Auth nativo** `recovery` | `auth/recovery.html` |
| 3 | Confirmar cambio de email (email actual) | Confirmá el cambio de email en BRAMUlab | **Edge Function** `account-challenge` + SMTP compartido | `previews/03-…` |
| 4 | Confirmar email nuevo | Confirmá tu nuevo email en BRAMUlab | **Edge Function** (el flujo BRAMU no usa el template nativo `email_change`; se versiona igual como fallback de plataforma) | `previews/04-…`, `auth/email_change.html` |
| 5 | Email cambiado (al email anterior) | El email de tu cuenta fue cambiado | **Edge Function** (nativo `email_changed_notification` queda **apagado**: no duplicar) | `previews/05-…` |
| 6 | Contraseña cambiada | La contraseña de tu cuenta fue cambiada | **Auth nativo** `password_changed_notification` | `auth/password_changed_notification.html` |
| 7 | Confirmar eliminación | Confirmá la eliminación de tu cuenta | **Edge Function** `account-challenge` (propósito `delete_account`) | `previews/07-…` |
| 8 | Cuenta eliminada (comprobante) | Tu cuenta de BRAMUlab fue eliminada | **Edge Function** `delete-my-account`, solo tras postcondiciones OK | `previews/08-…` |

- `auth/*.html`: HTML **standalone** con `{{ .Token }}` de Supabase Auth. En Staging, como Vercel permanece protegido, el logo real
  (`bramulab/icons/logo.png`) usa el asset público fijado a commit `https://raw.githubusercontent.com/sebastianvilaa/BRAMUlab/0a639d67325f880a651418867ccb62b9e880b797/bramulab/icons/logo.png`. Esto **no** cambia la Site URL ni los redirects de Auth. Antes de Production se reemplaza por el origen público definitivo si corresponde.
- `previews/*.html`: los 8 emails renderizados con datos de ejemplo (código `123456`) para revisar el render sin enviar nada. Abrirlos desde el repo (el logo es relativo).
- `manifest.json`: template → mecanismo, asunto, archivo, hash y claves de configuración hosted. **Email #4 aparece en `custom` (flujo BRAMU real) y también en `native` (fallback `email_change` de plataforma); no son dos envíos del flujo normal.** El manifest registra también la base exacta del logo usada por hosted Staging.

## Sincronizar con Supabase hosted (Staging) — Work

```bash
node supabase/scripts/sync-auth-email-templates.mjs                     # dry-run: imprime el payload, sin red
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node supabase/scripts/sync-auth-email-templates.mjs --check
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node supabase/scripts/sync-auth-email-templates.mjs --apply --env staging
```

El token y el ref salen **solo** del entorno (nunca argumentos ni repo). Fija: asuntos + HTML de los 4 templates nativos,
`password_changed_notification` ON, `email_changed_notification` **OFF**, Secure Email Change **ON**, OTP de 6 dígitos / 3600 s. No toca SMTP.
Alternativa manual (Dashboard → Authentication → Emails): pegar cada `auth/*.html` y su asunto de la tabla; mismas tres configuraciones.

## Secrets de Edge Functions (Staging) — nombres, nunca valores

`BRAMU_CHALLENGE_PEPPER` (≥ 32 caracteres aleatorios; HMAC del OTP) · `BRAMU_SMTP_USER` · `BRAMU_SMTP_PASS` · `BRAMU_SMTP_FROM` · `BRAMU_PUBLIC_BASE_URL` (https, origen estable que sirve `/icons/logo.png`) ·
opcionales `BRAMU_SMTP_HOST` (default `smtp.gmail.com`) · `BRAMU_SMTP_PORT` (default `465`) · `BRAMU_SMTP_FROM_NAME` (default `BRAMUlab`).
Sin alguno de los obligatorios, las Edge Functions responden `mailer_not_configured`/`challenge_not_configured` (no envían ni inventan nada).
