# Backend Bloque 7 — Validación central de Fase 3 en Staging

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**HEAD funcional validado:** `451459fa9c8a96e4bf7c4bcd905f692b966354e4`  
**Proyecto:** Supabase `bramulab-staging`  
**Resultado:** **FASE 3 VALIDADA Y APLICADA EN STAGING**

## 1. Qué implementa Fase 3

Capa server-side de lectura de Ranking sobre los snapshots de Fase 2:

- `get_current_ranking_edition()`;
- `get_ranking_classification(...)`;
- `get_my_ranking_position(...)`;
- `get_ranking_network(...)`;
- `set_ranking_network_hidden(...)`;
- `get_profile_ranking_summary(...)`;
- `get_home_ranking_insight()`;
- tabla personal `ranking_network_hidden`;
- helpers internos de scope, edición anterior y movimiento.

El cliente no puede enviar un territorio arbitrario: Local/Provincial/País se resuelven desde el snapshot propio/objetivo y Global usa `GLOBAL`.

## 2. Primera revisión central

La migración original de Claude no compiló contra PostgreSQL real:

`syntax error at or near "position"`

Causa: `position` se usó como nombre de salida sin escapar dentro de `RETURNS TABLE`.

Después de corregir provisionalmente ese punto, el runner mostró que los parámetros `smallint` de filtro de Nivel tampoco eran prácticos para llamadas SQL/RPC con enteros.

La revisión central amplió la prueba y encontró huecos concretos de contrato antes de aplicar nada.

## 3. Correcciones absorbidas por ChatGPT central

Como Fase 3 todavía no se había aplicado a ningún entorno, se corrigió la misma migración/runner, sin hotfixes.

### 3.1 Compilación / contrato RPC

- salida interna `position` → `rank_position`;
- filtros de Nivel públicos/internos usan `integer`;
- validación explícita de banda 1–10.

### 3.2 Movimiento semanal

- comparación solo contra la edición de la semana inmediatamente anterior;
- si falta una semana, el estado es `Nuevo`, no delta contra una edición vieja;
- cada fila pública de clasificación devuelve también su movimiento semanal;
- cambio de territorio/banda sigue rompiendo comparabilidad.

### 3.3 Búsqueda/paginación

`get_ranking_classification` devuelve además `matchedTotal` para poder paginar una búsqueda sin confundir coincidencias con el total de la clasificación.

### 3.4 Estado propio sin posición

`get_my_ranking_position` conserva para el caller:

- Nivel del corte;
- estado de Nivel;
- elegibilidad;
- reason codes propios;
- movimiento/contexto;

aunque no tenga posición oficial o no pertenezca al filtro activo.

No expone reason codes de terceros.

### 3.5 Mi red

Se corrigieron varios puntos:

- cutoff real = cierre de la edición, no `period_start_at`;
- un partido de los últimos 7 días de la semana sí pertenece a la edición correspondiente;
- la relación se reconstruye as-of-cutoff usando `computed_at/reverted_at` del resultado de Nivel, por lo que una validación/corrección posterior no reescribe Mi red histórica;
- `p_competitive_branch = NULL` usa la rama propia del caller, nunca mezcla M/F;
- el selector explícito M/F sigue disponible;
- `total` es el denominador elegible real;
- `visibleCount` distingue miembros visibles totales;
- `hiddenRows` devuelve los jugadores ocultos necesarios para implementar `Ocultos (N)` y restauración;
- ocultar/restaurar sigue siendo solo presentación personal.

### 3.6 Perfil

El resumen territorial devuelve también contexto congelado de territorio/scope para que la tarjeta de Perfil no tenga que reconstruirlo en cliente.

## 4. Validación real antes de aplicar

Migración corregida + runner completo, ejecutados desde el repo dentro de `BEGIN/ROLLBACK`:

`B7_F3_REPO_DRYRUN_OK`

Cobertura dirigida incluye:

- scopes propios;
- ramas M/F;
- filtro de Nivel y empate;
- búsqueda/matchedTotal;
- movimiento en filas;
- movimiento de Tu posición;
- cambio de banda;
- semana faltante → Nuevo;
- Global locked;
- Mi red 180 días al cutoff;
- partido dentro de los últimos 7 días de la edición;
- selector M/F en Mi red;
- ocultar/restaurar + hiddenRows;
- Perfil del jugador objetivo;
- no exposición de columnas privadas;
- privilegios públicos/internos.

## 5. Aplicación y revalidación

La migración `20260922150000_bloque7_fase3_read_rpcs.sql` se aplicó a Supabase Staging.

Runner post-aplicación:

`BLOQUE 7 FASE 3 OK — rollback limpio`

Verificación adicional con el estado real actual —todavía sin edición publicada—:

`B7_F3_NO_EDITION_OK`

Resultado actual:

- `ranking_editions`: 0;
- `ranking_rows`: 0;
- `ranking_network_hidden`: 0.

No quedó ningún fixture.

## 6. Seguridad

Verificado post-aplicación:

- RPCs públicas de Ranking: authenticated = sí, anon = no;
- helpers internos: authenticated = no;
- `ranking_network_hidden`: sin SELECT directo para authenticated;
- `service_role`: DELETE permitido para hide/restore, UPDATE no;
- RLS deny-by-default en la tabla personal.

Los avisos de advisor sobre SECURITY DEFINER autenticadas son esperados para estas RPCs: es el contrato explícito de acceso. No apareció una exposición anon nueva.

## 7. Estado

**Fase 3 queda CERRADA dentro de Bloque 7.**

Bloque 7 completo sigue EN CURSO.

Siguiente paso:

**Fase 4 — publicación automática semanal con pg_cron.**

Todavía NO:

- frontend real;
- eliminación de mocks;
- Production.
