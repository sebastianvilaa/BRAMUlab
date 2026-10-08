# 90 — Resultado G1: implementación técnica del sistema de emails V1

> **Nota de mantenimiento (08/10/2026):** los documentos intermedios que este texto cita por nombre (handoffs, validaciones, gates, revisiones y manifests) se retiraron del árbol activo al consolidarse; siguen en Git: `git log --diff-filter=D --name-only -- docs/BRAMUlab/Implementacion/` y `git show <commit>^:<ruta>`.

**Fecha:** 01/10/2026 · **Issue:** #21 · **Rama:** `staging` · **HEAD de entrada:** `a7178a9` · **Bundle:** `04.20-h4` (versión pública sin cambio: V04.20)
**Contrato:** `89_Handoff_G1_Emails_Implementacion_01OCT.md` (producto/diseño/copy cerrados; no se tocó nada de eso).
**Decisiones abiertas:** **NINGUNA** — no apareció ninguna limitación que obligue a cambiar la experiencia aprobada.

## 0. Resumen ejecutivo

La parte versionada/técnica de G1 está **completa y probada en local** (base real replayada en PGlite + núcleos con dependencias inyectadas).
**Staging real NO fue modificado por esta ronda:** el entorno del agente no tiene credenciales de Supabase (ni CLI, ni MCP, ni variables), exactamente
igual que en rondas anteriores («la aplica Central»). Todo lo que sí se puede hacer sin credenciales quedó hecho y todo lo que falta quedó reducido a
**comandos exactos y una única pasada de Central/Work** (§7). No hay cambios en `main`, Production ni BRAMUlive.

## 1. Qué quedó implementado

| Área | Resultado |
|---|---|
| Desafíos sensibles server-side | Tabla server-only `account_challenges` + 10 RPC `service_role`. Propósitos cerrados `change_email_current` / `change_email_new` / `delete_account`. |
| Cambio de email (2 verificaciones) | `account-challenge` (Edge): #3 al email **actual** (derivado de Auth) → verificar → pedir email nuevo → #4 al nuevo → verificar → **recién ahí** `auth.admin.updateUserById({email, email_confirm:true})` → cerrar demás sesiones (`admin.signOut(jwt,'others')`) → #5 al email anterior. Sin tercer mensaje, sin `updateUser({email})`, sin recovery. |
| Eliminación | `delete-my-account` ahora exige la **prueba específica `delete_account`** (OTP #7 verificado ≤ 10 min). La reautenticación genérica (`amr` otp/recovery/magiclink/email_change) **ya no alcanza** (se eliminó `isRecentEmailReauth`). Motor P0.3 **intacto** (mismo `runAccountDeletion`/`verifyAccountDeleted`). |
| Email #8 | Se envía **solo** después de que la eliminación pasó `verifyAccountDeleted` (todas las postcondiciones). El email destino se captura del JWT/Auth **antes** de borrar. Claim atómico (un solo envío), reintentos acotados (3), un fallo SMTP **no** revierte la eliminación (`receipt:'failed'`). Purga total de `account_challenges` del usuario eliminado. |
| Sender SMTP | `_shared/mailer.ts`: Nodemailer **6.9.16 pinneado** (`npm:`), mismo Gmail SMTP vía secrets `BRAMU_SMTP_*`; sin proveedor nuevo, sin Send Email Hook. Multipart HTML + texto. `Reply-To` soporte. Sin `console` en el mailer; solo códigos de error del transporte. |
| Templates | Fuente única `_shared/email-templates.mjs` (8 emails, copy/asuntos exactos, Night Card, logo real). Generados: 4 HTML nativos (`auth/`), 8 previews, `manifest.json`. |
| Frontend | Solo integración (sin rediseño): `Auth.requestAccountChallenge/verifyAccountChallenge/completeEmailChange/refreshSession`; el flujo "Acceso y seguridad" usa los desafíos nuevos; botón "Reenviar código" también en el paso del email nuevo (misma clase `link-btn`). Estados: request / verify / expiry / resend (`retryAfterSeconds`) / intentos / `change_incomplete` (reintento idempotente). Recuperación real, signup y password-changed **no cambian**. |
| Hosted Auth (para Work) | `sync-auth-email-templates.mjs` (dry-run por defecto; `--check`; `--apply --env staging`) + tabla en `supabase/email-templates/README.md`. |

## 2. Native vs custom — decisión técnica y evidencia

- **Nativos (Supabase Auth + SMTP existente):** #1 `confirmation`, #2 `recovery`, #6 `password_changed_notification`. `email_change` se versiona con el diseño #4 solo como **fallback de plataforma**; el flujo BRAMU no depende de él.
- **Contextuales (Edge + SMTP compartido):** #3, #4, #5, #7, #8.
- **#5 (email cambiado): custom, y `email_changed_notification` nativo queda APAGADO.** Evidencia: no existe garantía verificable (sin acceso a Auth hosted desde acá) de que `auth.admin.updateUserById` dispare la notificación nativa; el handoff 89 §5.3 indica en ese caso preferir el envío custom con el switch nativo desactivado. Es el único camino que **garantiza exactamente un aviso**, con el contenido aprobado y enviado al email anterior capturado antes del cambio. **Work debe confirmar en QA** que el cambio por admin API no genera ningún mail nativo adicional (ver §8).
- **Secure Email Change** queda **activado** (el script lo fija): protege cualquier llamada directa a `/user` fuera del flujo BRAMU.

## 3. Migraciones

| Archivo | Aplicada a Staging |
|---|---|
| `supabase/migrations/20261001100000_g1_emails_account_challenges.sql` | **NO** (sin credenciales) — la aplica Central |

Contenido: tabla `account_challenges` (RLS activada **sin políticas**, `REVOKE ALL` a `public/anon/authenticated`, sin FK a Auth/players), `code_hash` HMAC (nunca el OTP), `expires_at = +60 min`, `resend_available_at = +60 s`, `attempts/max_attempts=5`, `verified/consumed/invalidated/receipt_claimed`; RPC `account_challenge_issue / _verify / _revoke`, `account_email_change_prepare / _finalize`, `account_delete_proof_check`, `account_receipt_claim / _release`, `account_challenge_scrub`, `account_challenges_purge_user` — todas `SECURITY DEFINER` + `search_path=public` + `REVOKE ALL ... FROM public, anon, authenticated` + `GRANT EXECUTE ... TO service_role` (sentencias explícitas por función, auditables por `audit-migration-grants.mjs`).
Reglas de negocio en SQL: reenvío ≥ 60 s por propósito, tope 5 envíos/hora y propósito, reenvío invalida lo previo del mismo propósito (reiniciar el primer paso invalida el segundo), segundo paso solo con el primero verificado y vigente, email nuevo normalizado/validado/distinto/no ocupado, GC oportunista a los 2 días.
Rate limit adicional por cuenta en la Edge (`consume_auth_rate_limit`): `account_challenge_request` 10/h, `account_challenge_verify` 30/h.

## 4. Edge Functions

| Función | Cambio | `verify_jwt` | Desplegada en Staging |
|---|---|---|---|
| `account-challenge` | **nueva** (request / verify / complete_email_change) | `true` | **NO** |
| `delete-my-account` | modificada (prueba `delete_account` + Email #8) | `true` | **NO** (la versión desplegada hoy sigue aceptando reauth genérica) |

Secrets necesarios: ver §7.3. `release-check` actualizado (nueva función, 9 funciones de usuario, único import remoto adicional permitido `npm:nodemailer@6.9.16`).

## 5. Tests y verifies

| Suite | Resultado |
|---|---|
| `bramulab/g1-emails.test.mjs` (nueva, 24 pruebas dirigidas, base real replayada) | **24/24 PASS** |
| `self-delete-core.test.mjs` (reescrita al contrato nuevo, 13) | **13/13 PASS** |
| `v0420-l2-l3.test.mjs` (flujo de cuenta reescrito para desafíos, 32) | **32/32 PASS** |
| Resto de `bramulab/*.test.mjs` + `_shared` + `scripts` (incl. 9A/9B ops, hardening, versión/SW) | PASS salvo 3 **preexistentes** (§6) |
| `tests.html` (navegador, servidor local) | 1560/1565 — las 5 fallas (`V034-*` de Grupos) son **idénticas en el baseline `a7178a9`** (comprobado con stash), ajenas a G1 |
| `release-check` completo (replay limpio ×3 ACL + ensayo operativo + builds + gates) | **PASS** |
| `supabase/tests/verify-g1-emails-account-challenges.sql` (nuevo; transaccional con ROLLBACK) | PASS sobre base replayada (ACL `open`, el peor caso); además `verify-clean-room` lo ejecuta en los 3 escenarios de ACL |

Cobertura dirigida (riesgos del 89 §10): aislamiento de propósito · A no consume el desafío de B (mismo código; hash atado a usuario) · destino/email actual siempre server-side (body con `email/to/userId/previousEmail` ⇒ 400) · `change_email_new` bloqueado sin current verificado (y `complete_email_change` tampoco puede saltearlo) · eliminación bloqueada sin `delete_account` (no verificado / otro propósito / vencido) · expiración 60 min · uso único · 5 intentos · resend ≥ 60 s y tope/h · rate limit del endpoint · OTP solo hash (HMAC atado a propósito+usuario; ni en filas, respuestas ni logs) · cambio efectivo solo tras las dos verificaciones · revocación de otras sesiones (y fallback informado) · #5 idempotente aun con reintentos **concurrentes** · cambio a medias reintentable · #8 solo tras postcondiciones, un fallo del motor no lo envía y el reintento con la misma prueba sí (una sola vez) · fallo SMTP no revierte · purga total · tabla/RPC server-only (también `permission denied` real como `authenticated`/`anon`) · templates: asunto/categoría/copy exactos y en orden (HTML y texto), footer estándar vs #8 mínimo, único emoji en #1, logo PNG real, sin flex/grid/webfonts/scripts, código como texto copiable, escape de valores dinámicos, nativos versionados == generados · sin secretos / sin Production / sin BRAMUlive / sin hosts reales · signup y recovery nativos intactos en el cliente.

## 6. Correcciones y hallazgos de la ronda

1. **Brecha cerrada:** `delete-my-account` aceptaba como prueba cualquier OTP/recovery reciente (incluso uno pedido para recuperar contraseña). Ahora exige el desafío `delete_account`.
2. **Dependencia eliminada:** el cambio de email del cliente dependía de `updateUser({email})` + Secure Email Change (tercer mensaje inevitable). Reemplazado por flujo server-side.
3. `e2e-delete-my-account.mjs` actualizado al flujo nuevo (negativo `delete_challenge_required`; `send-otp` ahora pide el desafío #7; `delete --otp` lo verifica antes de eliminar; el #8 llega al inbox de la cuenta descartable).
4. Auditoría de grants (`audit-migration-grants.mjs`) no entiende grants en bucle `DO $$`: se escribieron sentencias explícitas por función (detectado por `prebloque9-hardening.test.mjs` antes de tocar nada).
5. **Preexistentes, NO tocados (fuera de alcance, fallan igual en `a7178a9`):** Node: `h19-B` (`computeHomePendingCarouselItems`, ventana de corrección 3 días), `h21-9` (`classifyHistoryStatusTab`), `h23` (copy "PARTIDO POR VALIDAR"); `tests.html`: 5 × `V034-TOP3/ANTERIOR/RACE` (Grupos). Recomendado: ronda propia de Home/Historial/Grupos; no bloquean G1.

## 7. Estado real de Staging y qué falta (Central/Work, UNA pasada)

### 7.1 Estado
- Repo remoto `origin/staging`: contiene todo lo versionado (un commit).
- **Supabase Staging: sin cambios** (migración no aplicada, funciones no desplegadas, secrets no cargados, config hosted sin tocar).
- **Vercel Staging:** el push de `staging` despliega el frontend nuevo (`04.20-h4`). Hasta que 7.2 esté hecho, en Staging "Cambiar email" y "Eliminar mi cuenta" fallan limpio (mensaje genérico; eliminación bloqueada = fail-closed). Signup/recovery/login no se ven afectados. Orden recomendado para Central: 7.2 → 7.3 → 7.4 inmediatamente después del push.

### 7.2 Central — aplicar (en este orden)
1. Aplicar `supabase/migrations/20261001100000_g1_emails_account_challenges.sql` y correr `supabase/tests/verify-g1-emails-account-challenges.sql` (debe terminar sin excepción) + advisors (no debería aparecer nada nuevo: tabla con RLS sin políticas es el patrón server-only ya usado).
2. Desplegar `account-challenge` (`verify_jwt=true`) y **redesplegar** `delete-my-account` (`verify_jwt=true`).
3. Cargar secrets (sección 7.3) — Work, sin pasarlos por chat.
4. Opcional: `audit-live-grants.sql` para confirmar las 10 RPC solo `service_role`.

### 7.3 Work — secrets de Edge Functions (solo comprobar que existan; nunca revelarlos)
`BRAMU_CHALLENGE_PEPPER` (≥ 32 caracteres aleatorios) · `BRAMU_SMTP_USER` · `BRAMU_SMTP_PASS` (App Password de Gmail) · `BRAMU_SMTP_FROM` (dirección remitente efectiva; la misma identidad que usa Auth) · `BRAMU_PUBLIC_BASE_URL` (https, origen estable de BRAMUlab Staging que sirve `/icons/logo.png`) · opcionales `BRAMU_SMTP_HOST` (`smtp.gmail.com`), `BRAMU_SMTP_PORT` (`465`), `BRAMU_SMTP_FROM_NAME` (`BRAMUlab`). Sin ellos las funciones responden `challenge_not_configured` / `mailer_not_configured` (503) y no envían nada.

### 7.4 Work — configuración hosted de Supabase Auth (Staging)
Opción A (reproducible): `node supabase/scripts/sync-auth-email-templates.mjs` (dry-run) → `--check` → `--apply --env staging` con `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PROJECT_REF` en el entorno. Opción B: Dashboard → Authentication → Emails.

| Template Auth | Asunto | HTML | Estado |
|---|---|---|---|
| Confirm signup | Confirmá tu cuenta en BRAMUlab | `auth/confirmation.html` | pegar |
| Reset password | Recuperá tu contraseña en BRAMUlab | `auth/recovery.html` | pegar |
| Change email (fallback) | Confirmá tu nuevo email en BRAMUlab | `auth/email_change.html` | pegar |
| Password changed notification | La contraseña de tu cuenta fue cambiada | `auth/password_changed_notification.html` | pegar + **ON** |
| Email changed notification | — | — | **OFF** (el #5 es custom) |
| Secure email change | — | — | **ON** |
| OTP | — | — | 6 dígitos / 3600 s |

Además: **Site URL** de Auth = origen estable de Staging (sin barra final; los nativos arman el logo como `{{ .SiteURL }}/icons/logo.png`); SMTP personalizado de Gmail ya activo (no tocar). Nota: los nombres de claves de la Management API (`mailer_*`) están escritos de la documentación; si el PATCH rechaza alguno, el script falla con HTTP 400 y se aplica por Dashboard (los HTML/asuntos no cambian).

### 7.5 Verificación de logo (Work)
`curl -I <BRAMU_PUBLIC_BASE_URL>/icons/logo.png` **anónimo** debe devolver 200 `image/png` (cuidado con Vercel Deployment Protection en Staging y con URLs efímeras de deployment).

## 8. Plan concreto de QA real posterior (Work, una sola pasada, cuenta descartable)

1. **Signup**: llega #1 (asunto, render móvil y desktop, código copiable, logo) → confirmar.
2. **Recovery**: pedir → llega #2 → nueva contraseña → llega #6 y se cierran otras sesiones (probar con 2 sesiones).
3. **Cambio de email**: Acceso y seguridad → llega **#3 al email actual** → código → ingresar email nuevo → llega **#4 al nuevo** → código → email cambiado, sesión actual sigue, **otra sesión cae**, llega **#5 al email anterior** y **ningún otro mail** (confirmar que no hay mail nativo extra por el cambio admin ni por Secure Email Change ⇒ valida §2). Probar: código incorrecto ×5, reenvío < 60 s, vencimiento, email ocupado, email igual.
4. **Eliminación** (cuenta descartable): llega **#7** (código en color danger, consecuencias) → código → pantalla de consecuencias → eliminar → pantalla final → llega **#8** (sin soporte). Con `supabase/scripts/e2e-delete-my-account.mjs` (negatives automáticos + un gate humano de OTP).
5. Render en Gmail web/iOS/Android (+ modo oscuro forzado del cliente): fondo, contraste del código, logo, degradación sin imágenes.
6. Que ninguna respuesta de red del navegador ni log de Edge muestre OTP o emails (revisar Network y logs de las funciones).

## 9. Límites declarados (honestos, ninguno cambia la experiencia aprobada)

- **No verificado contra Supabase real:** migración, despliegue, secrets, SMTP real, render en clientes de correo, que `updateUserById` con `email_confirm:true` no dispare mails nativos (diseñado para no depender de ello), `admin.signOut(jwt,'others')` contra GoTrue real. Todo cubierto por el plan §8.
- **#5 y #8 son "como máximo una vez" con reintentos dentro de la llamada:** si el SMTP está caído durante todos los reintentos, el cambio/eliminación igual vale, la respuesta informa `notice/receipt:'failed'` y se registra solo el código; no hay re-envío en background (no se diseñó una plataforma de messaging). Si Work ve fallas reales en QA, la extensión natural es una cola mínima.
- Gmail SMTP tiene tope diario (~500 mensajes): suficiente para el lanzamiento inicial; revisar al crecer (ya es una decisión de infraestructura listada en `Backend_Infraestructura.md`).
- La Edge solo normaliza con `lower/trim` (igual que Auth); no valida existencia real del dominio.

## 10. DECISIONES ABIERTAS

**Ninguna.**
