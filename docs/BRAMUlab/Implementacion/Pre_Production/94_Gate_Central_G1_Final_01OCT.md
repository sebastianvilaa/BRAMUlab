# 94 — Gate Central final G1 Emails/Auth V1

**Fecha:** 01/10/2026  
**Issue:** #21  
**Resultado:** **PASS / CERRADO EN STAGING**.

## Qué se demostró realmente

Backend/config:
- migración G1 aplicada;
- challenge table/RPCs con permisos server-only;
- `account-challenge` y `delete-my-account` ACTIVE + JWT;
- secrets Edge configurados sin exponer valores;
- Gmail SMTP real operativo;
- templates/asuntos hosted aplicados;
- password-changed ON;
- email-changed nativo OFF;
- Secure Email Change ON;
- OTP 6 dígitos / 3600 s.

Recepción real:
1. #1 Confirmación — recibido y OTP validado.
2. #2 Recovery — recibido y contraseña cambiada.
3. #3 Cambio de email / actual — recibido.
4. #4 Cambio de email / nuevo — recibido.
5. #5 Email cambiado — recibido en el email anterior.
6. #6 Contraseña cambiada — recibido después del cambio.
7. #7 Eliminación — recibido con contexto de eliminación.
8. #8 Cuenta eliminada — recibido solo tras éxito real.

Flujos críticos:
- cambio de email = **exactamente 2 verificaciones visibles**, sin tercer mail nativo inesperado;
- recuperación = #2 → cambio real → #6;
- eliminación = sin `delete_account` válido bloquea; con challenge válido elimina y recién después manda #8;
- revocación de otra sesión observada;
- negativos reales: OTP incorrecto y resend inmediato;
- las cuentas descartables de Work se limpiaron con el flujo propio;
- gate final: `account_challenges` = 0 residuos.

## Logo / hosted drift

Work mantuvo Vercel Staging protegido, decisión correcta.

Hosted usó el logo real desde:
`https://raw.githubusercontent.com/sebastianvilaa/BRAMUlab/0a639d67325f880a651418867ccb62b9e880b797/bramulab/icons/logo.png`

Central sincronizó esa misma base en la fuente versionada y regenerables del repo. No se usa GitHub como Site URL ni como redirect de Auth.

## Observaciones que NO bloquean G1

Work marcó cobertura browser/visual parcial. Se separa correctamente:

- reanudación/onboarding en UI;
- navegación real de cambio de email/eliminación;
- purga local del navegador;
- mobile real / bloqueo efectivo de imágenes / Apple Mail / Outlook;
- captura integral de Network/logs;
- fixture de partido compartido/avatar para eliminación.

Estos puntos pertenecen al **G2 de navegador/Acceso/Legal** o a residuales manuales agrupados, no al contrato funcional del sistema de emails que ya quedó probado.

La observación de dos emails de confirmación en el primer alta no se reprodujo en el alta final; se conserva como observación, no como bug confirmado.

## Site URL

Work observó la Site URL hosted en `http://localhost:3000`. Los flujos OTP de G1 no dependen de links y funcionaron, pero esa configuración no debe quedar así antes de salida.

**REEMPLAZAR en G2**, después de definir la UX de Acceso/Legal:
- Site URL → origen correcto de BRAMUlab Staging;
- redirects permitidos coherentes;
- luego QA browser real sobre la UI definitiva.

No abrir Vercel Staging públicamente para resolverlo.

## Cierre

**G1 / Issue #21 puede cerrarse.**

Siguiente orden:
1. Sebastián revisa UX de `Legal y privacidad` + `Acceso y seguridad`;
2. Central consolida esas decisiones;
3. se ejecuta G2 browser/OTP sobre la UI definitiva, incluyendo Site URL/redirects;
4. recién después se evalúan G3 Production y G4 backup gestionado.

No se tocó main, Production ni BRAMUlive.
