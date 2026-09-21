# Backend Bloque 6 — Handoff QA real de navegador para Work

**Fecha:** 21/09/2026  
**Repositorio:** `sebastianvilaa/BRAMUlab`  
**Rama:** `staging`  
**HEAD esperado:** `a5f2a547e48cd2118ac31e120166d6709af7f433` o superior  
**Bundle esperado:** `04.10-h16`  
**Objetivo:** validar en navegador real la Fase B de Bloque 6 ya implementada y revisada.

## 1. Contexto obligatorio

Leer completo, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Implementacion/Backend/Bloque_06/12_Validacion_Backend_Staging_ChatGPT.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_06/14_Resultado_Fase_B_Claude.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_06/15_Revision_Central_Fase_B_ChatGPT.md`
5. sección vigente de Bloque 6 en `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`

No releer toda la historia de Bloque 6 ni repetir QA backend ya cerrada.

## 2. Alcance de esta ronda

Esta es **QA de navegador**, no desarrollo.

Validar únicamente que el frontend real de Staging consume correctamente el backend B6 ya validado.

No modificar:

- código;
- migraciones;
- Supabase/configuración;
- Vercel/configuración;
- `main`;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence;
- Bloque 7.

Si aparece un bug:

1. documentar reproducción exacta;
2. continuar todos los casos que no dependan de ese bug;
3. NO improvisar una solución ni cambiar producto.

## 3. Sesión y cuentas

- Reutilizar la sesión/browser de Staging que ya exista si sigue disponible.
- Si hacen falta más cuentas de QA, crearlas por el flujo normal de la app únicamente.
- No pedir contraseñas, tokens, service-role keys ni secretos.
- Si un OTP/autenticación exige intervención humana real, detener solo ese punto y agrupar la solicitud; continuar todo lo demás posible.
- Los usuarios/partidos de esta ronda son datos de prueba de Staging, nunca Production.

## 4. Verificación inicial obligatoria

Antes de probar flujos B6:

1. confirmar que se está en **Staging**, no Production;
2. confirmar que el frontend cargado corresponde al bundle **04.10-h16**;
3. confirmar que `match-validation.js?v=04.10-h16` está siendo servido/cargado;
4. si el navegador conserva un h15 viejo, refrescar/limpiar únicamente el cache del Preview de Staging de forma segura y volver a comprobar.

No tocar datos de usuario para resolver caché.

## 5. Casos dirigidos

### A. Autoridad por pareja / Confirmar

Crear o reutilizar un partido pendiente con dos parejas registradas.

Verificar:

- el lado que cargó/propuso NO ve `Confirmar` como acción propia;
- los dos integrantes del lado accionable reciben la tarea;
- Home muestra pendiente accionable solo para el lado que debe actuar;
- Historial distingue `TU TURNO: CONFIRMAR` del pendiente en espera;
- uno de los dos integrantes del lado accionable confirma;
- el compañero deja de tener la tarea sin necesidad de actuar;
- el partido queda validado;
- Home/Historial/Resumen se refrescan sin duplicar partido ni efecto.

### B. Corrección post-validación

Sobre un partido validado dentro de la ventana normal:

1. un participante propone un score corregido;
2. su pareja queda en espera;
3. el lado contrario ve la tarea `correction_proposed`;
4. verificar un camino de **aceptar**;
5. si es viable con un segundo fixture, verificar un camino de **rechazar**.

Comprobar:

- la versión anterior sigue oficial mientras espera respuesta;
- al aceptar, el resultado visible cambia una sola vez;
- al rechazar, el resultado oficial anterior se mantiene;
- la tarea desaparece para ambos integrantes del lado respondiente;
- queda la notificación informativa correspondiente;
- no aparecen botones de corrección duplicados.

No intentar simular tres días esperando ni alterar fechas desde herramientas administrativas: C-10 y la ventana server-side ya están cubiertos en backend. Solo verificar que una pantalla real dentro de ventana se comporta bien.

### C. `No participé` / identidad

Sobre un partido apto para reportar identidad:

1. abrir `No participé`;
2. comprobar jerarquía visual secundaria/excepcional respecto de `Confirmar`;
3. seleccionar un slot;
4. confirmar la incidencia.

Verificar luego:

- el slot pasa a `Por identificar`;
- aparece `IDENTIDAD CUESTIONADA`;
- Notificaciones muestra la tarea correspondiente;
- el partido sigue existiendo;
- no aparece como rechazado/anulado;
- los derivados personales que dependen de identidad no deben seguir usando ese partido mientras la incidencia está abierta.

Resolver la incidencia con un jugador registrado o provisional válido:

- el slot queda con la identidad correcta;
- desaparece la tarea;
- el partido mantiene continuidad;
- Home/Historial/Nivel/Resumen refrescan correctamente.

No simular 7 días manualmente ni modificar timestamps. El camino terminal `Jugador no identificado` ya está cubierto en backend y revisión central; solo probarlo en navegador si ya existe naturalmente un fixture apto.

### D. Notificaciones

Verificar con casos A–C:

- `pending_review`;
- `correction_proposed`;
- `identity_questioned`;
- informativas posteriores como `match_validated`, `correction_accepted`, `identity_resolved` cuando correspondan.

Comprobar:

- una tarea sintética no desaparece por marcarla como leída;
- desaparece al resolverse el estado real;
- tocar una notificación ligada a partido abre el partido correcto;
- badge de campana se actualiza sin recargar toda la app;
- `Marcar todas como leídas` solo afecta informativas persistidas, no tareas todavía accionables.

### E. Regresiones focales de Bloque 5

No repetir toda la QA de B5.

Solo comprobar durante los mismos recorridos:

- partido sin hora no vuelve a mostrar `00:00`;
- partido server-backed sigue mostrando `OCULTAR PARTIDO`, nunca `ELIMINAR PARTIDO`;
- jugadores reales homónimos siguen siendo identidades distintas si aparece ese caso naturalmente;
- no aparece un segundo `match_id` por reintentos normales de UI.

## 6. Qué NO repetir

No repetir:

- SQL/RLS;
- concurrencia backend;
- idempotencia de RPC por carreras;
- C-01/C-06 matemáticos;
- clamps;
- inactividad;
- seguridad service-role/admin;
- anti-duplicado con slot NULL a nivel SQL;
- tests locales 1448/1448 o 30/30.

Ya tienen evidencia suficiente.

## 7. Limpieza

Al terminar:

- eliminar/ocultar los partidos creados exclusivamente para QA si existe un camino seguro ya autorizado;
- no borrar cuentas reales previas de Sebastián;
- si se crean cuentas de QA nuevas y no existe camino seguro de borrado desde la app, listar exactamente sus usernames/emails y partidos para que ChatGPT central haga la limpieza;
- no usar Supabase Dashboard/manual SQL desde Work.

## 8. Resultado esperado

Crear si Work tiene acceso de escritura al repo:

`docs/BRAMUlab/Implementacion/Backend/Bloque_06/17_Validacion_Navegador_Work.md`

Si no puede escribir el repo, devolver el contenido completo listo para que ChatGPT central lo guarde.

El resultado debe incluir:

- URL/Preview probado;
- bundle confirmado;
- cuentas/roles usados;
- tabla corta de casos PASS/FAIL;
- bugs con reproducción exacta;
- fixtures pendientes de limpieza;
- conclusión:
  - `BLOQUE 6 APTO PARA CIERRE`, o
  - `BLOQUE 6 NO APTO PARA CIERRE` + bloqueantes concretos.

No iniciar Bloque 7.
