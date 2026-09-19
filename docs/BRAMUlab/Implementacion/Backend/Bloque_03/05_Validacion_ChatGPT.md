# Backend Bloque 3 — Validación ChatGPT posterior a implementación

**Fecha:** 19/09/2026  
**Estado:** scripts reales de Staging aprobados; validación funcional en la app bloqueada en confirmación de email. Bloque 3 sigue abierto.

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

## Criterio de cierre de Bloque 3

Evidencia real de Staging:

1. [x] ejecutar `verify-bloque2.mjs` sin modificar;
2. [x] ejecutar `verify-bloque3.mjs` sin modificar;
3. [x] ejecutar `verify-nivel-parity.mjs` sin modificar;
4. [ ] probar en Staging real:
   - alta completa con camino rápido;
   - alta completa con camino completo;
   - confirmación de email al final;
   - confirmación anticipada;
   - refresh/reanudación del borrador;
   - username ocupado/carrera;
   - llegada a Home solo con Nivel oficial.

Los scripts se ejecutaron desde la Mac de Sebastián con credenciales cargadas sin mostrarlas; sus resultados constan más abajo. La integración de Supabase en Work no exponía la `service_role` key y su terminal no tenía acceso de red a Supabase, bloqueos anteriores que no afectan la evidencia obtenida desde la Mac.

**No marcar Bloque 3 como CERRADO todavía.**

## Intento de validación real desde Work — 19/09/2026 (sin cierre)

- Se actualizó `staging` por fast-forward a `7a5e00c` antes de validar. No se modificaron los scripts, el producto, `main` ni BRAMUlive.
- Supabase `bramulab-staging` (`serxtivkfnptzurnvewg`) se observó `ACTIVE_HEALTHY`; las tres migraciones de Bloque 3 constan aplicadas y `officialize-onboarding` sigue `ACTIVE`, versión 1, con JWT requerido. No se reaplicó ni desplegó nada.
- La app `https://bramulab-git-staging-bramu-lab.vercel.app/` abre el acceso inicial. Su `/api/health` respondió `{"ok":true,"environment":"staging","supabase":"reachable"}`.
- **Scripts pendientes, no fallidos:** `verify-bloque2.mjs`, `verify-bloque3.mjs` y `verify-nivel-parity.mjs` no se ejecutaron contra Staging. El terminal no tiene `SUPABASE_SERVICE_ROLE_KEY`; la conexión Supabase disponible no expone esa credencial. La revisión automática bloqueó abrir/capturar la configuración de claves del dashboard por riesgo de exponer secretos. No se leyó, mostró ni copió ninguna clave secreta.
- **Flujos manuales pendientes:** alta desde cero, perfil mínimo, caminos rápido/completo, OTP final/anticipado, refresh/reanudación y llegada a Home. No se creó ninguna cuenta de prueba en este intento.

**Estado:** Bloque 3 sigue abierto. Hace falta un mecanismo aprobado para suministrar las credenciales al terminal sin mostrarlas en chat y acceso a un buzón de prueba para verificar el OTP real. Recién entonces corresponde ejecutar los tres scripts sin cambios y completar los flujos manuales.

### Continuación tras autorización explícita

Sebastián autorizó leer la credencial de Staging desde el dashboard y usarla solo en el proceso del terminal, sin mostrarla en el chat. Antes de acceder a ella se comprobó la conectividad del terminal con `https://serxtivkfnptzurnvewg.supabase.co/rest/v1/`: `curl` agotó el tiempo de espera de la conexión proxy (`HTTP 000`, `Proxy CONNECT aborted due to timeout`). La solicitud de acceso de red ampliado fue rechazada automáticamente por la política de este entorno. No se accedió a ninguna clave ni se ejecutó ningún script; el bloqueo actual es la red del terminal, además de la necesidad posterior de un buzón para OTP. No se hicieron cambios en Supabase ni en la app.

## Validación real desde la Mac de Sebastián — 19/09/2026 (sin cierre)

- Se actualizó la rama local `staging` por fast-forward hasta `1e3a9e2`, coincidente con `origin/staging`. Los dos elementos locales preexistentes sin seguimiento (`Referencias/` y `docs/identidad-visual/Logo.ai`) quedaron intactos y fuera de cualquier commit.
- La Mac tenía Node `v26.8.2` y acceso de red al proyecto Supabase (`GET /rest/v1/` sin autenticación: HTTP 401 esperado). Las claves de Staging se cargaron de forma oculta en variables de entorno de esa Terminal; no se mostraron ni se incorporaron al repositorio.
- Se ejecutaron, **sin modificar los scripts**, contra `bramulab-staging` (`serxtivkfnptzurnvewg`):
  - `node supabase/tests/verify-bloque2.mjs`: **BLOQUE 2 OK**; Auth/perfil/username/ubicación, RLS y limpieza de prueba informada por el script.
  - `node supabase/tests/verify-bloque3.mjs`: **BLOQUE 3 OK**; `level_states=PENDIENTE` tras confirmar email, perfil mínimo, RPC privada inaccesible con JWT de usuario, Edge Function rápida/completa, idempotencia, un único `initial_estimate`, username ocupado, RLS cruzada, `is_username_available` para `anon`; limpieza informada por el script.
  - `node supabase/tests/verify-nivel-parity.mjs`: **PARIDAD OK**; modo rápido y completo: `mu` y `confidence` de la Edge Function exactamente iguales a Node; limpieza informada por el script.
- La validación manual se intentó en `https://bramulab-git-staging-bramu-lab.vercel.app/` con una cuenta nueva y un correo accesible al usuario. Tras `CREAR CUENTA` → email/contraseña → `CONTINUAR`, Sebastián mostró la pantalla `CONFIRMÁ TU EMAIL`, sin evidencia todavía de haber pasado por `TU PERFIL`/Nivel. Se pidió confirmación expresa del recorrido exacto para descartar el botón de confirmación anticipada; no se recibió esa aclaración antes de detener esta ronda.
- En esa pantalla **no llegó ningún código** al buzón ni a spam; `Reenviar código` mostró el modal `código reenviado`, pero tampoco llegó correo. Al ingresar códigos arbitrarios, la interfaz mostró `el código venció, pedí uno nuevo`. Ese mensaje **no demuestra** que se haya enviado un OTP ni que haya vencido uno real. La confirmación y el resto del onboarding quedaron bloqueados.
- El `app.js` servido desde la URL de Staging contiene `SIGNUP_STEP_ORDER = [1, 2, 'verify']`; el handler en el código de `staging` avanza de acceso a `TU PERFIL` antes del OTP. La discrepancia con la captura del navegador de Sebastián podría depender de recursos almacenados localmente o de otra condición todavía no identificada; **causa no confirmada**. No se logró inspeccionar el deployment desde la integración de Vercel (sin equipos listados; consulta de URL devolvió 403). No se alteró la configuración.
- El navegador de Work rechazó automáticamente la solicitud de datos para el alta de prueba porque su petición describía el formulario de creación como inicio de sesión; no se creó ninguna cuenta desde ese navegador. Sebastián realizó el intento manual en su Mac.

**Resultado manual:** alta desde cero **bloqueada** en OTP; perfil mínimo, caminos rápido/completo, confirmación final/anticipada, refresh/reanudación y Home tras Nivel oficial **no verificados**. La cuenta iniciada en la prueba puede haber quedado sin confirmar; su estado y eventual limpieza quedan pendientes de comprobación. No se cambió código, producto, migraciones ni configuración. **No cerrar Bloque 3.**
