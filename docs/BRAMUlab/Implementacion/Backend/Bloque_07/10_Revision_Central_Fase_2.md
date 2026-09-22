# Backend Bloque 7 — Revisión central de Fase 2

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Base revisada:** `10b690c7b5e50c97d2374237dec2bb72c27345b1`  
**Estado:** **Fase 2 NO apta todavía para aplicar a Supabase.** La migración compila, pero la prueba transaccional real falla y hay varios desajustes concretos con el contrato maestro.

## 1. Validación real ejecutada

Se tomó exactamente:

- `supabase/migrations/20260922140000_bloque7_fase2_ranking_calculation.sql`
- `supabase/tests/verify-bloque7-fase2.sql`

y se ejecutaron contra Supabase Staging real dentro de una transacción con `ROLLBACK`.

Resultado del runner:

`insufficient_density_wrong`

No quedó ninguna migración de Fase 2 aplicada ni ningún fixture persistente.

Además se hizo una prueba dirigida con los datos reales actuales de Staging:

- perfiles registrados con username: **7**;
- filas de Ranking creadas por `compute_ranking_edition`: **0**;
- filas Global creadas: **0**.

Esto reveló un bug independiente del fallo del runner.

## 2. F2-C01 — Candidatos sin ubicación desaparecen antes de poder auditarse

En `compute_ranking_edition` la ubicación as-of se obtiene con:

`CROSS JOIN LATERAL (... location_change_events ... LIMIT 1)`

Si el jugador nunca tuvo ubicación, la subquery devuelve 0 filas y el jugador desaparece completamente de `_b7_candidates`.

Consecuencia real hoy en Staging:

- hay 7 perfiles registrados;
- ninguno tiene ubicación;
- la función produce 0 filas, ni siquiera Global;
- por lo tanto nunca aparece `location_missing`.

Esto contradice el contrato ya cerrado de Fase 1: candidatos no elegibles relevantes + motivo no son opcionales, y el propio handoff de Fase 2 exige auditabilidad sin inventar un scope territorial.

### Corrección obligatoria

Usar un join que preserve al candidato cuando no existe evento de ubicación, por ejemplo:

`LEFT JOIN LATERAL (...) loc_hist ON true`

Luego:

- Local/Provincial/País siguen sin crearse sin ubicación canónica;
- Global sí conserva la fila del candidato con `location_missing`.

Agregar prueba explícita que lo compruebe.

## 3. F2-C02 — Masculino y Femenino están mezclados en una única clasificación

`Ranking_BRAMU.md §11` y regla 22 establecen que la rama competitiva separa Masculino/Femenino.

La implementación actual calcula:

- `total_eligible`;
- `RANK()`;
- densidad;
- desbloqueo Global;

agrupando por territorio, pero **sin particionar por `competitive_branch`**.

Eso significa que una jugadora puede alterar:

- denominador;
- puesto;
- densidad;
- desbloqueo Global

de la clasificación Masculina, y viceversa.

### Corrección obligatoria

Toda autoridad competitiva de Fase 2 debe calcularse por:

**scope + scope_key + competitive_branch**

sin crear un snapshot separado ni cambiar el esquema conceptual.

En particular:

- conteo elegible territorial → por rama;
- `RANK()` territorial → partition también por rama;
- Global → conteo/posición/desbloqueo por rama;
- dos países de ramas diferentes NO desbloquean mutuamente Global.

Las filas no elegibles con rama conocida deben conservar su rama congelada.

Agregar casos de prueba cruzados M/F para demostrar que una rama no altera la otra.

## 4. F2-C03 — ranking_profile_effective_from no reconstruye el estado as-of-cutoff

La columna propuesta:

`profiles.ranking_profile_effective_from`

se actualiza en **cada** llamada exitosa de `complete_ranking_profile_data`, incluso si el usuario reenvía exactamente los mismos datos.

Problemas:

1. si el jugador tenía rama/opt-in válidos antes del cutoff y reenvía los mismos datos después del cutoff pero antes de materializar la edición, queda falsamente excluido con `profile_data_changed_after_cutoff`;
2. si realmente cambia rama u opt-in después del cutoff, el sistema sabe que hubo un cambio, pero **no conserva el valor anterior**, así que no puede reconstruir cómo estaba al corte;
3. una sola fecha no es historial.

El handoff exigía reconstrucción real as-of-cutoff, no una exclusión conservadora cuando el dato vigente cambió después.

### Corrección obligatoria

Como Fase 2 todavía NO fue aplicada, corregir la migración actual en lugar de agregar capas de compatibilidad innecesarias.

Implementar el contrato histórico mínimo para **rama + ranking_opt_in**, preferentemente una tabla append-only server-only, por ejemplo:

`ranking_profile_events`

que conserve al menos:

- player_id;
- competitive_branch;
- ranking_opt_in;
- effective_at de servidor.

Reglas:

- primera escritura real → evento inicial;
- cambio real de rama u opt-in → nuevo evento;
- reenvío idéntico → NO crea un evento nuevo;
- ubicación sigue usando `location_change_events`, que ya resuelve su propio historial;
- `compute_ranking_edition` toma el último estado de rama/opt-in con `effective_at <= cutoff`;
- si no existe estado para ese cutoff, queda no elegible con motivo real, sin usar el valor LIVE.

No hace falta crear una arquitectura genérica de eventos.

La columna `ranking_profile_effective_from` puede eliminarse de esta migración si deja de aportar valor; todavía no existe en Supabase.

## 5. F2-C04 — RECALIBRANDO usa mal la fecha de última actividad

La regla vigente dice:

- mientras RECALIBRANDO, Ranking conserva el último **Nivel consolidado**;
- el jugador puede jugar los partidos computables necesarios para cerrar la recalibración;
- inactividad se mide por la última actividad computable real.

El helper actual toma de la última fila CALIBRADO anterior:

- Nivel consolidado: correcto;
- `lastComputableAt`: incorrecto.

Eso puede marcar a alguien como inactivo aunque haya jugado recientemente durante RECALIBRANDO.

### Corrección obligatoria

Para RECALIBRANDO:

- `levelInternal`, `levelPublic`, y la versión del nivel consolidado → del último CALIBRADO anterior;
- `lastComputableAt` → del estado LIVE as-of-cutoff (`v_live->>'lastRatedAt'`), es decir, la actividad computable más reciente aunque el Nivel usado siga siendo el consolidado anterior.

Agregar prueba: consolidado >180 días atrás + partido computable reciente en RECALIBRANDO → sigue elegible por actividad y usa el Nivel consolidado antiguo.

## 6. F2-C05 — Global locked guarda total_eligible=0 aunque existan elegibles

Cuando Global está bloqueado por existir un solo país, la implementación inserta:

`total_eligible = 0`

para todas las filas Global.

Eso no representa la verdad del snapshot. El contrato mínimo exige guardar **total elegible**; “locked” describe por qué no publica posiciones, no convierte mágicamente la cantidad de elegibles en cero.

### Corrección obligatoria

Mientras Global esté locked:

- `position/tie_group = NULL`;
- `density_status = 'locked'`;
- `total_eligible` = cantidad REAL de elegibles de esa rama en Global.

Además el lock/desbloqueo debe evaluarse por rama (F2-C02).

## 7. F2-C06 — El runner actual es internamente contradictorio

El primer fallo real:

`insufficient_density_wrong`

proviene de un supuesto incorrecto del propio test.

El runner declara que Bella Vista tiene solo 2 elegibles (`bv_a` y `bv_b`), pero en el mismo fixture crea `recalib_ok_1` y más adelante exige correctamente que sea:

- `RECALIBRANDO`;
- con consolidado previo;
- **elegible**.

Por lo tanto el denominador esperado de 2 ya es falso incluso antes de corregir la separación por rama.

Además el runner:

- mezcla M/F en sus expectativas;
- no detecta el bug de `CROSS JOIN LATERAL` porque falla antes;
- no prueba que un reenvío idéntico posterior al cutoff preserve el estado histórico;
- no prueba actividad reciente durante RECALIBRANDO;
- no comprueba `total_eligible` real de Global locked.

### Corrección obligatoria

Rehacer únicamente las expectativas/fixtures necesarias del runner para que pruebe el contrato real.

Debe cubrir explícitamente:

- candidato sin ubicación → fila Global + `location_missing`;
- rama M/F independiente en puesto, denominador y densidad;
- Global lock/desbloqueo independiente por rama;
- reenvío idéntico después del cutoff no altera reconstrucción histórica;
- cambio real de rama/opt-in después del cutoff mantiene correctamente el valor anterior para esa edición;
- RECALIBRANDO usa consolidado para Nivel pero actividad LIVE para los 180 días;
- Global locked conserva total elegible real.

## 8. F2-C07 — Estado de cuenta/integridad as-of-cutoff

El análisis reconoce que `is_active` y `ranking_excluded` se leen LIVE porque hoy no existe RPC que los modifique.

Eso es aceptable solo como condición actual de Staging, pero no debe confundirse con reconstrucción histórica.

Antes de cerrar Fase 2:

- documentar explícitamente la limitación;
- confirmar que hoy no existe ningún writer real;
- no inventar historial retroactivo;
- dejar establecido que cualquier futura vía que modifique esos campos deberá registrar effective-time antes de Production.

No hace falta crear ahora un sistema administrativo que no existe. Este punto no debe sobrearquitectarse.

## 9. Lo que sí queda aprobado

Se mantiene la dirección de:

- `compute_ranking_edition(cutoff)`;
- cutoff lunes 00:00 Buenos Aires;
- atomicidad en una sola transacción;
- idempotencia por edición;
- snapshot persistido;
- no recalcular Nivel;
- helper de Nivel as-of;
- último consolidado para RECALIBRANDO;
- Local/Provincial/País solo con ubicación canónica;
- Global como scope auditable;
- 0–4 / 5–14 / 15+;
- empate de competición;
- función server-only;
- runner SQL con rollback;
- sin cron, frontend ni Fase 3 todavía.

## 10. Estado de Supabase

**Fase 2 NO fue aplicada.**

Las pruebas centrales se ejecutaron con rollback.

Supabase Staging conserva únicamente Fase 1 de Bloque 7.

## 11. Próximo paso

Claude debe corregir exclusivamente F2-C01…F2-C07.

Como `20260922140000_bloque7_fase2_ranking_calculation.sql` todavía NO fue aplicada a ningún entorno:

**REEMPLAZAR/corregir esa migración en lugar de agregar migraciones de parche pre-aplicación.**

Actualizar también:

- `supabase/tests/verify-bloque7-fase2.sql`;
- documentación con un nuevo `11_Correccion_Fase_2_Claude.md`.

Todavía NO:

- aplicar Supabase;
- empezar Fase 3;
- pg_cron;
- frontend;
- main/Production/BRAMUlive.
