# QA visual — Invitados / Identidad / Recuperación V04.29-h2

**Fecha:** 03/10/2026
**Rama:** `staging`
**HEAD funcional:** `50675a8331a12eb1db8f6ca4055097990d36d9df`
**Resultado:** BLOQUEADO POR ACCESO. No es PASS ni FAIL del flujo de duplicados. Gate técnico 120 permanece PASS; gate visual pendiente.

## Evidencia realmente obtenida

- Leídos README, Método de Trabajo, 119 y 120.
- Deployment Vercel `dpl_Ab8f2g8ohmxwEF3Y46wgG1We8Lmq`: Ready, Preview, rama staging, commit funcional esperado.
- App real accesible en `https://bramulab-i6z5hx1qb-bramu-lab.vercel.app/` y dominio habitual `https://bramulab-git-staging-bramu-lab.vercel.app/`.
- Pantalla de acceso renderizada con logo y acciones Iniciar sesión / Crear cuenta. Sin sesión BRAMU previa.
- Se realizó un único intento de login mediante el formulario seguro browserAuth, sin leer ni conservar credenciales.

## Bloqueo observado

**Paso:** acceso previo a preparar/reutilizar fixture.
**Esperado:** sesión autenticada de Staging para preparar el caso y recorrerlo.
**Obtenido:** la app mostró `No pudimos iniciar sesión. Probá de nuevo.` y permaneció en login. Tras navegar explícitamente al origen, volvió a la pantalla de acceso sin sesión.
**Clasificación:** bloqueo funcional de acceso del navegador de QA; causa no determinada. No demuestra regresión de duplicados ni permite atribuir el error a credenciales.
**Consola/red:** no verificadas. La lectura de consola fue impedida por la protección nativa del documento con credenciales; no se inspeccionaron valores, tokens ni requests de autenticación. No afirmar ausencia de 4xx/5xx.

## Alcance no recorrido

Fixture: ninguno creado o modificado. Pasos 1–11 del flujo solicitado: no ejecutados. No se verificaron modal, copy pendiente, respuesta de pareja contraria, resolución, ausencia de fantasmas, ni viewport móvil/iPhone.

## Continuación

Resolver acceso mediante control manual del mismo navegador de Work y retomar únicamente el gate visual definido en 120. Antes de declararlo PASS, preparar fixture histórico >3 días y recorrer SAME → corrección pendiente → aceptar o rechazar desde la otra pareja.

No se cambió código, migraciones, Supabase, main, Production ni BRAMUlive. No se actualiza documentación de estado a cerrado.
