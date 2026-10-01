# 89 — Handoff G1: implementación técnica del sistema de emails V1

**Fecha:** 01/10/2026  
**Entorno:** exclusivamente `staging`  
**Estado de producto/diseño/copy:** **CERRADO / APROBADO**  
**Decisiones humanas abiertas:** **NINGUNA**  
**Issue operativo:** G1 Comunicaciones/Auth-email  
**NO tocar:** `main`, Production, BRAMUlive.

## 0. Fuentes y autoridad

Leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md`
4. `docs/BRAMUlab/Backend_Infraestructura.md`
5. `docs/BRAMUlab/Privacidad_Legal.md`
6. este handoff.

El contrato humano final proviene de:
`/BRAMUlab/Temporales/BRAMUlab_Handoff_Comunicaciones_Emails_Final_01OCT2026.md`

No reabrir diseño/copy. Este documento traslada al repo lo necesario para implementar.

## 1. Contrato de producto innegociable

V1 tiene **8 emails**:

1. confirmación de cuenta;
2. recuperación de contraseña;
3. confirmación desde email actual para cambio de email;
4. confirmación del email nuevo;
5. aviso de email cambiado;
6. aviso de contraseña cambiada;
7. confirmación contextual de eliminación;
8. comprobante final de cuenta eliminada.

### Flujos

**Registro:** `signUp` → Email #1 → OTP signup de 6 dígitos. El usuario puede confirmarlo al final del onboarding o con “Confirmar email ahora”.

**Recuperación:** Email #2 → OTP recovery → nueva contraseña → cerrar demás sesiones → Email #6.

**Cambio de email:** exactamente **2 verificaciones visibles**:
- Email #3 al email actual;
- después de validarlo se ingresa/solicita email nuevo;
- Email #4 al nuevo;
- después de validarlo se cambia realmente el email;
- cerrar demás sesiones;
- Email #5 al email anterior.
No third challenge. No recovery copy. No link como vía principal.

**Eliminación:** Email #7 contextual → OTP 6 dígitos específico de `delete_account` → consecuencias visibles → `delete-my-account` → éxito real/postcondiciones → Email #8. El #8 solo se manda después de éxito real y no ofrece recuperación/soporte.

Códigos: **6 dígitos / 60 minutos**. Reenvío actual: mínimo 60 s.

## 2. Copy exacto

### Email 1 — Confirmación de cuenta
**Subject:** `Confirmá tu cuenta en BRAMUlab` · **Categoría:** `CUENTA`

> Confirmá tu cuenta  
> Este es tu código para terminar de crear tu cuenta en BRAMUlab.  
> [CÓDIGO]  
> El código vence en 60 minutos.  
> Ingresalo en BRAMUlab y listo.  
> Nos vemos en la cancha. 🎾  
> Si no fuiste vos quien inició este registro, podés ignorar este email.

Footer: BRAMUlab · Donde vive tu pádel. · ¿Necesitás ayuda? · bramulab@gmail.com

### Email 2 — Recuperación
**Subject:** `Recuperá tu contraseña en BRAMUlab` · **Categoría:** `ACCESO`

> Recuperá tu contraseña  
> Recibimos una solicitud para cambiar la contraseña de tu cuenta.  
> Usá este código para continuar:  
> [CÓDIGO]  
> El código vence en 60 minutos.  
> Ingresalo en BRAMUlab y elegí una nueva contraseña.  
> Si no pediste este cambio, podés ignorar este email. Tu contraseña actual seguirá funcionando.

Footer estándar con soporte.

### Email 3 — Email actual
**Subject:** `Confirmá el cambio de email en BRAMUlab` · **Categoría:** `SEGURIDAD`

> Confirmá el cambio de email  
> Pediste cambiar el email asociado a tu cuenta de BRAMUlab.  
> Antes de continuar, necesitamos confirmar que fuiste vos.  
> [CÓDIGO]  
> El código vence en 60 minutos.  
> Ingresalo en BRAMUlab para continuar con el cambio.  
> Si no solicitaste modificar tu email, no ingreses el código y contactanos.

Footer estándar con soporte.

### Email 4 — Email nuevo
**Subject:** `Confirmá tu nuevo email en BRAMUlab` · **Categoría:** `CUENTA`

> Confirmá tu nuevo email  
> Ya casi terminamos el cambio.  
> Usá este código para confirmar que esta es la nueva dirección que querés asociar a tu cuenta de BRAMUlab.  
> [CÓDIGO]  
> El código vence en 60 minutos.  
> Ingresalo en BRAMUlab para completar el cambio.  
> Si no reconocés esta solicitud, no ingreses el código y contactanos.

Footer estándar con soporte.

### Email 5 — Email cambiado
**Subject:** `El email de tu cuenta fue cambiado` · **Categoría:** `SEGURIDAD`

> Tu email fue cambiado  
> El email asociado a tu cuenta de BRAMUlab fue actualizado.  
> Email anterior  
> [EMAIL ANTERIOR]  
> Email nuevo  
> [EMAIL NUEVO]  
> Si fuiste vos, no tenés que hacer nada.  
> Si no reconocés este cambio, contactanos cuanto antes.

Footer estándar con soporte.

### Email 6 — Contraseña cambiada
**Subject:** `La contraseña de tu cuenta fue cambiada` · **Categoría:** `SEGURIDAD`

> Tu contraseña fue cambiada  
> La contraseña de tu cuenta de BRAMUlab fue actualizada correctamente.  
> Si fuiste vos, no tenés que hacer nada.  
> Si no reconocés este cambio, recuperá tu contraseña y contactanos cuanto antes.

Footer estándar con soporte.

### Email 7 — Eliminar cuenta
**Subject:** `Confirmá la eliminación de tu cuenta` · **Categoría:** `CUENTA`

> Confirmá la eliminación de tu cuenta  
> Estás por eliminar definitivamente tu cuenta de BRAMUlab.  
> Usá este código para confirmar la acción:  
> [CÓDIGO]  
> El código vence en 60 minutos.  
> Antes de continuar, tené en cuenta que:  
> - tu cuenta y tus datos personales activos serán eliminados o anonimizados según corresponda;  
> - los partidos compartidos con otros jugadores permanecerán en sus historiales;  
> - tu identidad en esos registros pasará a mostrarse como Jugador eliminado;  
> - si volvés a registrarte en BRAMUlab, empezarás con una identidad nueva.  
> La eliminación es definitiva.  
> Si no fuiste vos quien inició esta acción, no ingreses el código y contactanos.

Footer estándar con soporte.

### Email 8 — Cuenta eliminada
**Subject:** `Tu cuenta de BRAMUlab fue eliminada` · **Categoría:** `CUENTA`

> Tu cuenta fue eliminada  
> La eliminación de tu cuenta de BRAMUlab se completó correctamente.  
> La acción es definitiva y la cuenta ya no puede recuperarse.  
> No necesitás hacer nada más.

Footer SOLO: BRAMUlab · Donde vive tu pádel.  
No soporte, no “si no fuiste vos”, no promesa de recuperación.

## 3. Visual — BRAMU Night Card

Email-safe, mobile-first, una columna, tabla central ~560 px.

Tokens:
- exterior `#03070D`;
- fondo `#050A12`;
- surface1 `#09131F`;
- surface2 `#0D1A2A`;
- surface3 `#112238`;
- texto `#F8FAFC`;
- secundario `#9AA7B5`;
- tenue `#687482`;
- lima `#95FF19`;
- lima profundo `#66B30F`;
- azul `#199FFF`;
- danger `#FF5B61`.

Fuente: `Inter, Arial, Helvetica, sans-serif`, sin depender de webfont.

Logo real obligatorio: `bramulab/icons/logo.png`; altura objetivo 28–32 px, proporción intacta, `alt="BRAMUlab"`. Debe usarse por URL HTTPS pública estable. No reconstruir el wordmark.

Código OTP: texto HTML real, copiable, centrado, bloque propio, ~36–40 px desktop, tracking visible. Normal=lima; eliminación=danger medido.

No CTA protagonista. No Instagram. Único emoji V1: 🎾 en Email #1.

Elementos decorativos de cancha abstracta pueden degradar; nunca son esenciales. No flex/grid como base. Inline styles y tablas.

## 4. Estado técnico de entrada

Actualmente:
- Email #1 / signup nativo existe pero copy/asunto básicos;
- recovery nativo se usa para recuperación, cambio de email actual y eliminación;
- cambio de email actual llama `verifyRecoveryOtp`, luego `updateUser({email})`, luego `verifyOtp(type=email_change)`;
- `delete-my-account` acepta cualquier reauth de email reciente <=10 min (`otp/recovery/magiclink/email_change`);
- no existe Email #8;
- password_changed y email_changed notifications estaban desactivadas en la auditoría;
- Secure Email Change estaba activado;
- SMTP personalizado Gmail estaba activo;
- templates finales no están versionados en repo.

No rehacer eliminación P0.3 ni Auth general: FUSIONAR.

## 5. Decisión técnica Central para esta ronda

Implementar de forma simple y segura, sin Send Email Hook global ni proveedor nuevo.

### 5.1 Native Auth emails
Mantener Supabase Auth + SMTP actual para:
- Email #1 `confirmation`;
- Email #2 `recovery`;
- Email #6 `password_changed_notification`.

Versionar templates/asuntos en repo y dejar lista su sincronización con hosted Staging.

`email_change` puede versionarse con el diseño/copy #4 como fallback de plataforma, pero el flujo BRAMU no debe depender de él.

### 5.2 Contextuales BRAMU
Agregar un sender SMTP compartido en Edge Functions, reutilizando el **mismo Gmail SMTP** de Staging mediante secretos del entorno (nunca repo/chat).

Usarlo para:
- #3 current email;
- #4 new email;
- #5 changed notice;
- #7 delete challenge;
- #8 deletion receipt.

Supabase mantiene su custom SMTP nativo para emails Auth; el mailer Edge comparte proveedor/identidad visual, no un proveedor nuevo.

### 5.3 Cambio de email
**NO** usar el `updateUser({email})` actual en el flujo BRAMU porque Secure Email Change nativo no permite expresar la secuencia aprobada sin riesgo de tercer mensaje.

Implementar desafío server-side:
1. request `change_email_current`; target derivado del usuario autenticado, nunca del body;
2. OTP #3;
3. verify server-side y marcar challenge;
4. recién ahí permitir solicitar `change_email_new` con newEmail;
5. validar/normalizar newEmail y verificar que sea diferente/no ocupado;
6. OTP #4 a newEmail;
7. verify;
8. Edge Function hace `auth.admin.updateUserById` con email confirmado;
9. cerrar demás sesiones según contrato;
10. Email #5 al email anterior.

**Secure Email Change debe permanecer activado** como defensa para cualquier llamada directa al endpoint Auth fuera del flujo BRAMU; el flujo BRAMU no depende de ese endpoint para cambiar el email.

La notificación nativa `email_changed_notification` NO debe duplicar #5. Si admin update dispara esa notificación, usarla y no enviar custom; si no existe garantía verificable, preferir envío custom y dejar el switch nativo desactivado. Documentar la decisión con evidencia de QA.

### 5.4 Eliminación
Agregar desafío server-side `delete_account`:
- target email derivado del JWT/Auth;
- OTP #7;
- 60 min;
- un solo uso;
- rate limit;
- no user_metadata como autoridad;
- el verify debe dejar una prueba server-side específica de `delete_account`.

Modificar `delete-my-account` para requerir esa prueba específica y reciente, además de las defensas ya existentes que sigan aportando.

Capturar el email de destino server-side antes de borrar Auth. Email #8 debe enviarse **solo después de postcondiciones de eliminación exitosas**.

Hacer el envío #8 idempotente/reintentable en la forma mínima razonable. No diseñar una plataforma genérica de messaging.

## 6. Desafíos sensibles — requisitos de seguridad

Preferir una tabla server-only/RLS deny-by-default o equivalente. Ningún acceso cliente directo.

Propósitos explícitos:
- `change_email_current`;
- `change_email_new`;
- `delete_account`.

Requisitos:
- `auth_user_id` resuelto por JWT;
- email actual resuelto server-side;
- newEmail solo aceptado en la etapa correspondiente y después de current verificado;
- OTP criptográficamente aleatorio de 6 dígitos;
- guardar solo hash seguro, nunca OTP plano;
- expiración 60 min;
- máximo de intentos razonable;
- resend/rate limit >=60 s y reutilizar infraestructura de rate limit si encaja;
- invalidar desafíos anteriores del mismo propósito al reenviar;
- consumo único;
- no logs con OTP/email;
- service_role nunca en cliente;
- no usar user_metadata para autorización.

## 7. Sender SMTP Edge

Reutilizar SMTP Gmail existente mediante secrets del entorno, por ejemplo nombres explícitos `BRAMU_SMTP_*`. Nunca hardcodear secretos.

Preferir dependencia pinneada y soportada por Supabase Edge. Existe ejemplo oficial de SMTP con Nodemailer; si se usa, fijar versión exacta y cubrir error de transporte.

Datos del remitente:
- display name: `BRAMUlab`;
- soporte: `bramulab@gmail.com`;
- host observado: `smtp.gmail.com`;
- puerto observado: `465`.

No inventar username/from efectivo si Work todavía no lo verificó: los secrets/config reales se terminan de cargar en la pasada de Work.

## 8. Templates versionados

AGREGAR una carpeta clara, por ejemplo `supabase/email-templates/`, con:
- README/manifest;
- HTML final standalone de los emails nativos;
- HTML/renderers para los custom;
- subjects exactos;
- variables requeridas;
- mapping template_id → mecanismo;
- instrucciones de sincronización hosted Staging.

No dejar a Supabase Dashboard como única fuente de copy.

Logo: usar una URL absoluta del asset real. Para Staging puede resolverse a un asset estático del deployment/alias de BRAMUlab, pero debe comprobarse que responde anónimamente y que no es una URL efímera de un deployment puntual.

## 9. Frontend

FUSIONAR con UX existente; no rediseñar pantallas.

Cambiar solamente la integración:
- recuperación real sigue usando Email #2;
- cambio email deja de reutilizar recovery;
- eliminación deja de reutilizar recovery;
- manejar estados request/verify/expiry/resend/error de los desafíos nuevos;
- tras cambio de email refrescar sesión/perfil y cerrar otras sesiones;
- tras eliminación mantener purga local/pantalla final vigentes.

No cambiar copy de emails ni consecuencias aprobadas.

## 10. Tests / verifies obligatorios antes de tocar Staging

Cubrir:
- challenge purpose isolation;
- usuario A no puede verificar/consumir B;
- target actual nunca viene del body;
- change_email_new bloqueado sin current verificado;
- delete bloqueado sin challenge `delete_account`;
- expirado/reusado/intentos;
- rate limit/resend;
- no OTP/email en logs/respuestas;
- admin email update solo después de ambas verificaciones;
- Email #8 solo tras deletion postconditions OK;
- idempotencia mínima de #5/#8;
- regresión recuperación real;
- regresión signup;
- regresión delete P0.3;
- templates contienen subject/copy exactos;
- no secretos/Production/BRAMUlive.

Una sola ronda grande. No QA visual de mail clients todavía: eso es Work posterior.

## 11. Staging

Después de tests:
- aplicar migraciones solo en Supabase Staging;
- desplegar Edge Functions necesarias;
- NO modificar hosted templates/config Auth desde Claude si no tiene acceso seguro: dejar manifest exacto para Work;
- advisors;
- verifies;
- Vercel staging si frontend cambia.

No main/Production.

## 12. Salida

Guardar:
`docs/BRAMUlab/Implementacion/Pre_Production/90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md`

Debe separar:
- qué implementó código/backend;
- migraciones;
- Edge Functions;
- templates versionados;
- tests;
- qué aplicó a Staging;
- qué queda exclusivamente para Work (hosted Auth templates/settings, secrets SMTP si faltan, recepción/render);
- cualquier limitación real.

Si aparece una limitación que obliga a CAMBIAR el contrato de producto, marcar `DECISIÓN ABIERTA`; si no, resolver técnicamente y seguir.
