# 92 — Handoff G1 a Work: Supabase hosted + emails reales + QA

**Fecha:** 01/10/2026  
**Entorno único:** Staging  
**Issue:** #21 sigue ABIERTO  
**No tocar:** main, Production, BRAMUlive.

## 0. Entrada

Leer:
1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Implementacion/Pre_Production/91_Gate_Central_G1_Pre_Work_01OCT.md`
3. `docs/BRAMUlab/Implementacion/Pre_Production/90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md`
4. `supabase/email-templates/README.md`
5. `supabase/email-templates/manifest.json`

Producto/diseño/copy están cerrados. No reabrirlos.

Central YA hizo:
- migración G1;
- verify SQL;
- deploy de `account-challenge`;
- redeploy de `delete-my-account`;
- permisos/advisors/regresión.

**NO repetir esas operaciones.**

## 1. Confirmación de entorno

Antes de escribir, confirmar visualmente que el proyecto es:

- nombre: `bramulab-staging`;
- ref: `serxtivkfnptzurnvewg`.

Si no coincide, NO modificar nada.

## 2. Secrets de Edge Functions

Configurar sin mostrar/copiar valores al chat:

Obligatorios:
- `BRAMU_CHALLENGE_PEPPER` — generar de forma segura, aleatoria, >=32 caracteres;
- `BRAMU_SMTP_USER`;
- `BRAMU_SMTP_PASS`;
- `BRAMU_SMTP_FROM`;
- `BRAMU_PUBLIC_BASE_URL`.

Opcionales/valores esperados:
- `BRAMU_SMTP_HOST=smtp.gmail.com`;
- `BRAMU_SMTP_PORT=465`;
- `BRAMU_SMTP_FROM_NAME=BRAMUlab`.

Objetivo: mismo Gmail SMTP/identidad que Auth; no agregar proveedor.

Si el App Password existente de SMTP aparece enmascarado y no puede recuperarse, NO pedirle a Sebastián que lo pegue en el chat. Navegar al flujo seguro para crear un App Password dedicado para Edge/Staging. Si Google exige login/OTP/presencia humana, detenerse solo en ese punto y pedir takeover/autorización; continuar automáticamente después.

## 3. URL estable/logo

Determinar un origen HTTPS estable de **Staging** que sirva anónimamente:

`<base>/icons/logo.png`

Debe responder 200 y ser PNG sin login, cookies, protección ni URL temporal.

Usar ese origen como:
- `BRAMU_PUBLIC_BASE_URL`;
- Site URL de Auth si corresponde al origen estable de la app Staging.

No modificar dominios de Production/main.

Si el origen Staging actual no puede servir el logo públicamente, resolver la alternativa mínima estable de Staging y documentarla antes de cambiar templates.

## 4. Hosted Auth — aplicar solo inventario V1

Usar Dashboard/Cloud Browser. El repo es la fuente, no reconstruir HTML manualmente.

Aplicar:

| Auth | Estado |
|---|---|
| Confirm signup | subject + `auth/confirmation.html` |
| Reset password | subject + `auth/recovery.html` |
| Change email | subject + `auth/email_change.html` **solo fallback** |
| Password changed notification | subject + HTML + **ON** |
| Email changed notification | **OFF** (#5 lo envía BRAMU custom) |
| Secure Email Change | **ON** |
| Email OTP | **6 dígitos / 3600 s** |
| Secure Password Change | mantener sin paso extra visible; no activar por reflejo |
| Otras security notifications | no activar |

No configurar Send Email Hook.

Verificar también, sin revelar secretos:
- custom SMTP activo;
- sender visible = BRAMUlab;
- From efectivo;
- soporte/Reply-To cuando sea observable.

## 5. QA real — una única pasada

Usar cuentas sintéticas/descartables de Staging. Preferir aliases controlados del inbox disponible para no requerir múltiples personas.

### A. Signup
- Email #1 llega con asunto exacto;
- OTP 6 dígitos/copiable;
- logo;
- confirmar OTP;
- onboarding se reanuda.

### B. Recovery + password notification
- Email #2 exacto;
- cambiar contraseña;
- Email #6 llega después;
- comprobar cierre de otra sesión si es viable con una segunda sesión.

### C. Cambio de email — CRÍTICO
- #3 al email actual, copy de cambio (nunca recovery);
- validar primer código;
- pedir nuevo email;
- #4 al nuevo;
- validar segundo código;
- el email cambia realmente;
- sesión actual continúa;
- otras sesiones se revocan;
- #5 llega al email anterior;
- **no aparece un tercer mail ni email_change nativo adicional**.

Hacer solo negativos de alto valor que no repitan tests ya cerrados: un código incorrecto y un reenvío inmediato (<60 s). No esperar 60 minutos para expiry: ya está cubierto por verify/unit tests.

### D. Eliminación — cuenta descartable
- #7 contextual, no recovery;
- verificar código;
- consecuencias visibles;
- eliminar;
- postcondiciones reales;
- cuenta no vuelve a iniciar;
- historial compartido preservado/anónimo según contrato;
- #8 solo después del éxito, sin soporte ni recuperación;
- no duplicado inesperado.

Usar el E2E existente si Work puede ejecutarlo; si no, recorrer UI + evidencia backend sin inventar cobertura.

### E. Render
Mínimo automatizable:
- Gmail web real;
- desktop y viewport mobile;
- dark mode;
- imágenes habilitadas y bloqueadas;
- sin overflow;
- código dominante/copiadle;
- logo proporcionado.

Si Apple Mail u Outlook reales no están disponibles en el entorno de Work, **no pedir una cadena de capturas**: marcarlos como único residual manual agrupado para Central/Sebastián al final. Continuar todo lo demás.

### F. Logs/red
- ninguna respuesta expone OTP/email innecesario;
- logs de Edge sin OTP/PII;
- sin 5xx funcionales;
- confirmar `account-challenge` y `delete-my-account` ACTIVE/JWT.

## 6. Qué hacer si aparece un problema

- Config/dashboard/render: resolver dentro de Work.
- Bug de código/backend que requiere commit: NO improvisar cambios grandes desde Dashboard. Documentar reproducción exacta y dejarlo para Central/Claude.
- Si una limitación obliga a cambiar el contrato humano: marcar `DECISIÓN ABIERTA`; continuar lo independiente.

## 7. Salida obligatoria

Guardar el informe final preferentemente en:

`docs/BRAMUlab/Implementacion/Pre_Production/93_Resultado_G1_Work_QA_01OCT.md`

Si Work no puede escribir al repo, guardarlo en Dropbox:

`/BRAMUlab/Temporales/BRAMUlab_Resultado_G1_Work_QA_01OCT2026.md`

El informe debe contener:
- cambios realizados en hosted Supabase;
- secrets configurados SOLO por nombre/existencia, nunca valores;
- Site URL/base logo elegida;
- sender/From verificados;
- resultado A–F;
- lista de emails realmente recibidos con asunto/destinatario relativo (sin OTP);
- cualquier duplicado/no esperado;
- residuales Apple Mail/Outlook si existieran;
- PASS/FAIL G1;
- incidentes reproducibles;
- DECISIONES ABIERTAS reales.

No cerrar Issue #21. Central hará el gate final y lo cerrará si corresponde.
