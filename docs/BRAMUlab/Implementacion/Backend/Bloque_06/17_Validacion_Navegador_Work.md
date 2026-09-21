# 17 — Validación de navegador Work — Backend Bloque 6

**Fecha:** 2026-09-21  
**Entorno:** Vercel Preview/Staging  
**URL:** https://bramulab-git-staging-bramu-lab.vercel.app/  
**Commit validado:** `ef16ebdbaab708d76a7051fee2fee2e48c6b5d57`  
**Bundle validado:** `04.10-h16`  
**Backend:** Staging (sin cambios manuales)  
**Resultado:** **BLOQUE 6 NO APTO PARA CIERRE**

## Alcance y cuentas

La QA se ejecutó únicamente por navegador, sin modificar código, Supabase, Vercel ni configuración.

Se utilizaron dos cuentas registradas accesibles:

- `@claim_mualea_20`
- `@sebas`

También se utilizaron como participantes registrados, sin iniciar sesión en ellos:

- `@sebastian_test_2_vila`
- `@sebastian_test_3_vila`
- `@sebastian_prueba_vila`

## Datos QA creados

1. Partido 21/09/2026 14:59:
   - equipo A: `@claim_mualea_20` / `@sebas`
   - equipo B: `@sebastian_test_2_vila` / `@sebastian_test_3_vila`
   - resultado: 6–3 / 6–4
   - estado final: **PENDIENTE DE VALIDACIÓN**
   - queda pendiente de limpieza.

2. Partido 21/09/2026 15:17:
   - equipo A inicial: `@claim_mualea_20` / `@sebastian_test_2_vila`
   - equipo B: `@sebas` / `@sebastian_test_3_vila`
   - resultado inicial: 6–2 / 6–1
   - corrección aceptada: 6–2 / 6–3
   - identidad cuestionada: slot inicial de `@sebastian_test_2_vila`
   - identidad resuelta con: `@sebastian_prueba_vila`
   - estado final: **VALIDADO**
   - queda pendiente de limpieza.

## Resultados

### A. Autoridad por pareja / confirmación

**PASS parcial**

- El proponente `@claim_mualea_20` no vio acción de confirmar.
- Su compañero `@sebas`, en el primer fixture, tampoco vio acción ni tarea de confirmar.
- En el segundo fixture, `@sebas` quedó del lado accionable y vio:
  - tarjeta de Home **PARTIDO PENDIENTE**;
  - estado **TU TURNO: CONFIRMAR**;
  - notificación sintética **Partido pendiente**;
  - acción **CONFIRMAR PARTIDO**.
- “Marcar todas como leídas” eliminó el no leído informativo, pero mantuvo la tarea accionable y el badge pasó de 2 a 1 sin recargar toda la aplicación.
- Al confirmar, la tarea desapareció, Home pasó a **VALIDADO**, Nivel/derivados se actualizaron y una recarga completa no creó duplicados.

**BLOQUEADO parcial**

No hubo acceso autenticado a `@sebastian_test_3_vila`, por lo que no se pudo demostrar en navegador que ambos integrantes del lado accionable recibían la misma tarea ni que la tarea desaparecía también para el segundo integrante después de la acción de su compañero.

### B. Corrección posterior a validación

**PASS con incidencia visual**

- `@sebas` propuso cambiar el segundo set de 6–1 a 6–3.
- Mientras esperaba respuesta, el resultado oficial permaneció 6–2 / 6–1.
- `@claim_mualea_20`, integrante de la otra pareja, recibió tarea **Corrección propuesta**.
- La notificación abrió el partido correcto.
- Se aceptó la corrección una sola vez.
- Historial y Home mostraron después 6–2 / 6–3.
- La tarea accionable desapareció y quedó la notificación informativa **Corrección aceptada**.
- No apareció un segundo botón o duplicado de corrección.
- El camino de rechazo no se repitió porque el handoff lo dejaba condicionado a disponer de un segundo fixture razonable.

### C. “No participé” / identidad cuestionada

**PASS funcional con incidencia visual**

- La acción secundaria estuvo disponible junto al flujo principal.
- Se seleccionó el slot de `@sebastian_test_2_vila` y se confirmó el incidente.
- El partido persistió y pasó a:
  - **IDENTIDAD CUESTIONADA**;
  - slot **Por identificar**;
  - tarea de notificación **Identidad cuestionada**.
- Mientras el incidente estuvo abierto, el partido dejó de alimentar los derivados personales: la cuenta pasó temporalmente de 1 a 0 partidos y volvió a 5.5.
- Se resolvió con el jugador registrado `@sebastian_prueba_vila`.
- La tarea desapareció, apareció la informativa **Identidad resuelta**, el partido volvió a **VALIDADO** y Home recuperó 1 partido, Nivel 5.6 y el marcador corregido.
- Historial, Home y la continuidad del partido quedaron correctos.

### D. Notificaciones

**PASS**

Se observaron los tipos reales:

- `pending_review` — Partido pendiente;
- `correction_proposed` — Corrección propuesta;
- `identity_questioned` — Identidad cuestionada;
- informativas — Partido oficial, Corrección aceptada, Identidad resuelta.

Comprobaciones:

- una tarea sintética no desapareció al marcar todo como leído;
- desapareció únicamente al resolverse el estado;
- las notificaciones accionables abrieron el partido correcto;
- el badge cambió sin recarga completa;
- después de resolver quedaron solo notificaciones informativas.

### E. Regresiones focalizadas de Bloque 5

**PASS**

- Los partidos mostraron hora real; no apareció `00:00`.
- El partido server-backed mostró **OCULTAR PARTIDO**, no “ELIMINAR PARTIDO”.
- La recarga completa mantuvo exactamente dos fixtures, sin duplicar el partido validado.
- No apareció un caso natural adicional de homónimos que justificara repetir esa prueba.

## Incidencia reproducible

### Resumen del partido no se refresca inmediatamente tras mutaciones

**Severidad propuesta:** media; bloquea el cierre del criterio explícito de refresco del Resumen.

#### Reproducción 1 — corrección aceptada

1. Abrir un partido VALIDADO.
2. Desde una pareja proponer 6–2 / 6–3 sobre el resultado oficial 6–2 / 6–1.
3. Entrar con un miembro de la pareja que responde.
4. Pulsar **ACEPTAR**.
5. Esperar la respuesta exitosa.

**Observado:**

- aparece el estado/toast “Corrección aceptada”;
- las acciones cambian como si el partido ya estuviera resuelto;
- pero el mismo Resumen conserva momentáneamente el encabezado **CORRECCIÓN PROPUESTA** y el marcador anterior 6–2 / 6–1.

Al salir a Historial, el dato correcto aparece como **VALIDADO — 6–2 / 6–3**. Al volver al Resumen, también queda correcto.

#### Reproducción 2 — identidad resuelta

1. Cuestionar un slot de un partido VALIDADO.
2. Resolverlo con un jugador registrado.
3. Esperar la respuesta exitosa.

**Observado:**

- aparece el estado/toast que confirma al jugador correcto;
- pero el mismo Resumen conserva momentáneamente **IDENTIDAD CUESTIONADA** y **Por identificar**.

Al navegar a Home, el partido aparece correctamente **VALIDADO** con el reemplazo y los derivados restaurados.

Esto indica que la persistencia y las proyecciones backend funcionan, pero el modelo renderizado del Resumen no se invalida/relee inmediatamente después de aceptar una corrección o resolver una identidad.

## Consola / red

No se observaron errores de aplicación asociados a las operaciones. Los únicos errores de consola visibles correspondieron a la extensión del navegador de automatización al enviar metadata; no provenían del origen de BRAMUlab.

## Evidencia visual

Se capturó Home de `@sebas` después de corrección e identidad resueltas: partido VALIDADO 6–2 / 6–3, Nivel 5.4 y un partido computado.

## Conclusión

**BLOQUE 6 NO APTO PARA CIERRE**

Bloqueantes concretos:

1. el Resumen del partido queda visualmente obsoleto después de aceptar una corrección y después de resolver una identidad, hasta navegar fuera de la pantalla;
2. falta evidencia real de navegador del segundo integrante del lado accionable, porque no hubo acceso autenticado a esa tercera cuenta.

No se inició Bloque 7.
