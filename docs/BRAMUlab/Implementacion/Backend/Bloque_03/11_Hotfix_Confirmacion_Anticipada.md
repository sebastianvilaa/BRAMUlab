# BRAMUlab — Hotfix confirmación anticipada + Nivel
## Backend Bloque 3
**Fecha:** 19/09/2026  
**Estado:** implementado en `staging`; validación manual pendiente.

## Bug

Una cuenta podía confirmar el email anticipadamente, volver a `TU PERFIL`, completar perfil + Nivel y, al tocar `CONFIRMAR MI NIVEL`, volver a caer en el paso OTP aunque la sesión Supabase siguiera válida.

## Causa

`confirmNivelOnboarding()` guardaba correctamente el borrador de Nivel, pero en contexto `draft` hacía siempre:

`signupStep = 'verify'`

sin consultar si ya existía una sesión válida creada por la confirmación anticipada.

La restauración después de refresh sí reconocía la sesión, pero al confirmar el Nivel esta función la ignoraba y forzaba nuevamente la pantalla OTP.

## Hotfix

En `bramulab/app.js`:

- `confirmNivelOnboarding()` pasa a ser async;
- después de persistir el borrador consulta `Auth.getSession()`;
- verifica que el email de la sesión coincida con `signupDraft.email`;
- si coincide, ejecuta directamente `runOfficializeAndEnter()`;
- si no hay sesión válida/coincidente, conserva el flujo normal hacia `verify`.

No se modifica Supabase, migraciones, Edge Functions, motor de Nivel ni BRAMUlive.

## Cache

Se actualiza el bundle de `04.10-h7` a `04.10-h8` en `index.html` y `sw.js`, y `CACHE_NAME` pasa a `bramulab-v04-10-h8`.

`Store.VERSION` y `version.json` siguen en `BRAMUlab V04.10`.

## Validación pendiente

Repetir únicamente el tramo abierto de la cuenta de prueba 2:

1. cargar Staging con el bundle h8;
2. llegar al resultado de Nivel con la cuenta cuyo email ya está confirmado;
3. tocar `CONFIRMAR MI NIVEL`;
4. debe oficializar y entrar a Home sin pedir OTP;
5. luego verificar en backend `CALIBRANDO 0/5`, un único `initial_estimate` y `nivel_inicial_v1_2`.

Bloque 3 sigue abierto hasta completar el resto de la checklist del handoff.
