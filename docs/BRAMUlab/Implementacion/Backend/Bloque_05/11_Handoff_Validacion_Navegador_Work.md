# Backend Bloque 5 — Handoff a ChatGPT Work para validación real de navegador

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**HEAD de referencia:** `1c1f5d57f8df302a01421839b9cdc5971a4f58a9` o superior  
**Bundle esperado:** `04.10-h14`

## Objetivo

Validar en el **Vercel Staging real**, desde navegador, el wiring frontend de Bloque 5 ya implementado y el backend real ya aplicado en Supabase Staging.

Esta ronda NO es una ronda de desarrollo.

No tocar código, Supabase, migraciones, main, Production, BRAMUlive ni Bloque 6.

Si se encuentra un bug, documentarlo con reproducción precisa y continuar todas las pruebas que no dependan de ese bug.

---

## Leer antes

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Implementacion/Backend/Bloque_05/08_Validacion_Backend_Staging_ChatGPT.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_05/09_Resultado_Wiring_Frontend_Claude.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_05/10_Revision_Wiring_ChatGPT.md`

No releer la investigación histórica grande de Bloque 5.

---

## 1. Entorno correcto

Abrir exclusivamente la Preview/Staging de BRAMUlab asociada a la rama `staging`.

Confirmar:

- que el deployment corresponde al HEAD de referencia o a uno superior;
- que carga el bundle `04.10-h14`;
- que NO es Production;
- que la aplicación inicia sin errores bloqueantes de consola.

No modificar configuración de Vercel.

---

## 2. Sesión

Preferir una sesión real ya existente.

Si hace falta autenticarse:

- usar una cuenta QA existente o la sesión existente del usuario;
- NO crear una cuenta nueva solo para esta prueba si no es indispensable;
- NO resetear contraseñas;
- NO pedir contraseñas, service-role keys ni secretos al usuario;
- si aparece un OTP que requiere presencia humana, detenerse solo en ese punto y pedir al usuario que lo escriba directamente en la interfaz.

Nunca borrar ni modificar destructivamente `@sebas`.

Identidades QA conocidas y preservables del Bloque 4, si sirven como participantes:

- `@claimb4h11`
- `@normalb4h11`
- `@claim_mualea_20`

No asumir que las tres aparecen en búsqueda: usar únicamente las que la aplicación realmente ofrezca como seleccionables.

---

## 3. Baseline visual antes del partido

Antes de crear nada, registrar en el informe:

- estado de Nivel mostrado;
- progreso de calibración/rated matches si está visible;
- Efectividad / Racha / Partidos totales si existen;
- cuál es el Último partido actual;
- cantidad de filas visibles en Historial.

No hace falta capturar números irrelevantes. El objetivo es comprobar después que un partido pendiente NO altere estadísticas oficiales.

---

## 4. Carga server-backed real

Desde el `+` / **Cargar mi partido**:

1. confirmar que el jugador actual ocupa su lugar correctamente;
2. abrir selección de compañero/rivales;
3. probar búsqueda de al menos un jugador real existente;
4. confirmar que los resultados reales muestran identidad coherente;
5. completar cuatro participantes server-backed.

Preferir jugadores QA existentes. Si no alcanza, se puede usar un provisional ya relacionado.

Solo si no existe ningún provisional utilizable y hace falta para completar el partido, crear uno desde la propia UI con un nombre inequívocamente QA y registrarlo en el informe para limpieza posterior.

Nunca crear/fusionar por coincidencia de nombre.

### Datos del partido

Usar:

- fecha dentro de los últimos 14 días;
- un horario/fecha suficientemente inequívocos para evitar chocar con pruebas anteriores;
- formato Clásico;
- resultado válido, por ejemplo 6–2 / 6–4;
- lugar de prueba identificable, por ejemplo `QA B5 Work`.

Si la UI lo permite sin romper el flujo, **borrar la hora** antes de guardar para comprobar el caso `playedAtTimeKnown=false`.

---

## 5. Resultado inmediato obligatorio

Después de guardar:

Confirmar:

- no se pierde la carga;
- aparece un único partido;
- estado visible: **PENDIENTE DE VALIDACIÓN**;
- nunca aparece `VALIDADO`, `OFICIAL` ni equivalente;
- resultado, cuatro jugadores, fecha y lugar son correctos;
- si la hora se dejó vacía, NO aparece una hora inventada;
- el partido aparece en Historial;
- el Home puede mostrarlo como Último partido.

---

## 6. Regla más importante: pendiente visible, pero no computable

Comparar contra el baseline previo.

El partido pendiente NO debe modificar:

- Nivel BRAMU;
- progreso/rated matches;
- Efectividad;
- Racha;
- Partidos totales oficiales;
- Mejor compañero/Rival más enfrentado;
- Ranking;
- cualquier otra métrica oficial.

Si el Home muestra dots/forma reciente junto al Último partido, el pendiente NO debe sumar una victoria/derrota nueva a esa forma.

Esto es PASS aunque el partido sí sea visible como Último partido e Historial.

---

## 7. Persistencia después de navegación/refresh

Sin limpiar storage:

- navegar fuera del partido;
- volver a Home;
- ir a Historial;
- hacer refresh/reabrir la Preview si es seguro.

Confirmar que el partido server-backed sigue apareciendo una sola vez y conserva:

- participantes;
- score;
- estado;
- fecha;
- lugar;
- condición de hora conocida/desconocida.

No limpiar localStorage ni datos del navegador para esta prueba.

---

## 8. Nota privada

Abrir el detalle del partido.

Agregar una nota privada QA.

Salir y volver a entrar al partido.

Confirmar que:

- la nota persiste;
- no aparece como dato compartido del partido ni mezclada con jugadores/resultado.

No hace falta comprobarla desde otra cuenta si eso exige crear/resetear credenciales.

---

## 9. Ocultar para mí — HACER AL FINAL

Como última acción sobre ese partido:

usar **Ocultar este partido de tu historial**.

Confirmar:

- desaparece de Historial personal;
- deja de ocupar Último partido si era el último visible;
- no aparece nuevamente después de refresh.

No interpretar esto como borrado compartido.

ChatGPT central podrá comprobar luego en Supabase que el `match_id` sigue existiendo y, si hace falta, limpiar el fixture QA.

---

## 10. Pruebas que NO hay que forzar en navegador

No gastar tiempo montando escenarios artificiales para:

- concurrencia simultánea;
- ambigüedad de dos candidatos;
- carrera de idempotencia;
- quinto/sexto pendiente;
- RLS;
- expiración de 30 días.

Ya están cubiertos con pruebas reales de backend y tests específicos.

### Offline

Si el navegador de Work permite simular offline de forma simple y fiable, validar una vez:

- guardar offline;
- ver `PENDIENTE DE SINCRONIZACIÓN`;
- volver online;
- confirmar sincronización sin duplicado.

Si la herramienta no ofrece un offline real confiable, marcar `NO EJECUTADO — limitación de navegador`. No inventar una simulación.

### Segundo participante

Si Work ya dispone legítimamente de una segunda sesión QA autenticable sin resetear credenciales, puede confirmar que el mismo partido aparece para otro participante.

Si no, NO crear/resetear cuentas para forzarlo: la convergencia y shared history ya fueron validadas contra Postgres real.

---

## 11. Evaluación UX

Registrar únicamente problemas reales que vea un usuario:

- selector de jugadores confuso;
- estado pendiente poco claro;
- badge que parezca error/logro cuando no corresponde;
- copy demasiado técnico;
- pantalla de desambiguación si aparece naturalmente;
- jerarquía visual rara;
- comportamiento de Home Estado Cero.

No rediseñar desde Work.

Marcar cada observación como:

- `BUG`
- `UX REVIEW`
- `OK`

---

## 12. Evidencia y reporte

Si Work dispone de acceso de escritura al repo/GitHub, crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_05/12_Validacion_Navegador_Work.md`

y commit/push únicamente a `staging`.

Si no puede escribir el repo, devolver el informe completo en el chat para que ChatGPT central lo consolide.

El informe debe incluir:

- URL/deployment probado;
- commit/deployment asociado;
- cuenta usada (solo username, nunca email/secretos);
- match_id creado si se puede obtener sin romper la UX;
- PASS/FAIL por secciones 1–9;
- offline ejecutado o no;
- segundo participante ejecutado o no;
- bugs;
- UX REVIEW;
- datos QA creados que deban limpiarse;
- confirmación de que no se tocó Production/main/BRAMUlive/Bloque 6.

Al terminar, detenerse.