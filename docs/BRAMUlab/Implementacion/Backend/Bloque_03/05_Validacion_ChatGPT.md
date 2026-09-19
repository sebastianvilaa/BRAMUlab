# Backend Bloque 3 — Validación ChatGPT posterior a implementación

**Fecha:** 19/09/2026  
**Estado:** implementación aplicada parcialmente en Supabase Staging; cierre final todavía pendiente de verificaciones E2E.

## Qué se verificó y aplicó

1. Se revisó el informe de Claude `04_Informe_Implementacion_Claude.md` y el commit de implementación `aefda847`.
2. La primera aplicación de `20260919120000_bloque3_nivel_persistente.sql` falló de forma transaccional porque PostgreSQL detectó `complete_profile` ambiguo: agregar `p_terms_version` con `CREATE OR REPLACE` había creado una sobrecarga en vez de reemplazar la firma anterior.
3. Se corrigió la migración fuente para eliminar explícitamente la firma vieja antes de crear la nueva de 15 parámetros. Commit: `6c20fc0`.
4. La migración `bloque3_nivel_persistente` se aplicó correctamente en `bramulab-staging`.
5. Se desplegó la Edge Function `officialize-onboarding` en Staging. Quedó `ACTIVE`, versión 1, con JWT requerido.
   - Para el deploy vía integración de Supabase se empaquetaron los archivos canónicos `bramulab/level.js` y `bramulab/level-calibration.js` como dependencias de `_shared`; no se creó una segunda fuente matemática en el repo.
6. Supabase Advisor detectó permisos `EXECUTE` implícitos por `PUBLIC` en funciones `SECURITY DEFINER`.
   - Se agregó/aplicó `20260919153500_bloque3_security_grants.sql`.
   - Commit: `c0b9dab`.
   - Contrato resultante:
     - `complete_profile`: solo `authenticated`.
     - `handle_email_confirmed`: no invocable por clientes.
     - `rls_auto_enable`: no invocable por clientes.
     - `is_username_available`: `anon` + `authenticated` deliberadamente.
     - `officialize_level_onboarding`: solo `service_role`.
7. Se detectó que las cuentas confirmadas antes de Bloque 3 no recibían `level_states`, porque el trigger nuevo solo actúa en futuras confirmaciones. Esto impedía oficializar Nivel para la cuenta real creada durante Bloque 2.
   - Se agregó/aplicó `20260919154500_bloque3_backfill_level_states.sql`.
   - Commit: `223e21c`.
   - Resultado en Staging al aplicar: 1 player existente / 1 `level_state` / 1 `PENDIENTE`.

## Estado estructural confirmado en Staging

- `profiles.terms_version` y `profiles.terms_accepted_at`: presentes.
- `level_states`: presente, RLS activo.
- `level_events`: presente, RLS activo.
- `level_states.status`: incluye `PENDIENTE/CALIBRANDO/CALIBRADO/RECALIBRANDO`.
- Edge Function `officialize-onboarding`: ACTIVE.
- Migraciones registradas:
  - `bloque3_nivel_persistente`
  - `bloque3_security_grants`
  - `bloque3_backfill_level_states`

## Advisors

Los warnings de `complete_profile`, `handle_email_confirmed` y `rls_auto_enable` quedaron corregidos.

Permanecen:
- `is_username_available` como SECURITY DEFINER ejecutable por `anon/authenticated`: **intencional por decisión de Bloque 3** para comprobar disponibilidad antes de confirmar email.
- leaked password protection deshabilitado: configuración de Auth preexistente, fuera del alcance del cierre funcional de Bloque 3.
- avisos de performance/RLS initplan e índices de FK: no bloqueantes para este bloque; revisar en hardening.

## Qué falta para cerrar Bloque 3

Todavía falta evidencia real E2E:

1. ejecutar `verify-bloque2.mjs` sin modificar;
2. ejecutar `verify-bloque3.mjs`;
3. ejecutar `verify-nivel-parity.mjs`;
4. probar en Staging real:
   - alta completa con camino rápido;
   - alta completa con camino completo;
   - confirmación de email al final;
   - confirmación anticipada;
   - refresh/reanudación del borrador;
   - username ocupado/carrera;
   - llegada a Home solo con Nivel oficial.

La integración de Supabase usada por ChatGPT no expone la `service_role` key, por lo que los scripts Node que requieren Admin/Auth no pueden ejecutarse desde esta sesión sin recurrir a otro entorno autorizado. El próximo paso recomendado es ChatGPT Work, usando la sesión autenticada del dashboard de Supabase de Staging y sin mostrar/copiar secretos al chat.

**No marcar Bloque 3 como CERRADO todavía.**

## Intento de validación real desde Work — 19/09/2026 (sin cierre)

- Se actualizó `staging` por fast-forward a `7a5e00c` antes de validar. No se modificaron los scripts, el producto, `main` ni BRAMUlive.
- Supabase `bramulab-staging` (`serxtivkfnptzurnvewg`) se observó `ACTIVE_HEALTHY`; las tres migraciones de Bloque 3 constan aplicadas y `officialize-onboarding` sigue `ACTIVE`, versión 1, con JWT requerido. No se reaplicó ni desplegó nada.
- La app `https://bramulab-git-staging-bramu-lab.vercel.app/` abre el acceso inicial. Su `/api/health` respondió `{"ok":true,"environment":"staging","supabase":"reachable"}`.
- **Scripts pendientes, no fallidos:** `verify-bloque2.mjs`, `verify-bloque3.mjs` y `verify-nivel-parity.mjs` no se ejecutaron contra Staging. El terminal no tiene `SUPABASE_SERVICE_ROLE_KEY`; la conexión Supabase disponible no expone esa credencial. La revisión automática bloqueó abrir/capturar la configuración de claves del dashboard por riesgo de exponer secretos. No se leyó, mostró ni copió ninguna clave secreta.
- **Flujos manuales pendientes:** alta desde cero, perfil mínimo, caminos rápido/completo, OTP final/anticipado, refresh/reanudación y llegada a Home. No se creó ninguna cuenta de prueba en este intento.

**Estado:** Bloque 3 sigue abierto. Hace falta un mecanismo aprobado para suministrar las credenciales al terminal sin mostrarlas en chat y acceso a un buzón de prueba para verificar el OTP real. Recién entonces corresponde ejecutar los tres scripts sin cambios y completar los flujos manuales.
