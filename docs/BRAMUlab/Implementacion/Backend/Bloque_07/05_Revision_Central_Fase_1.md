# Backend Bloque 7 — Revisión central de Fase 1

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Base revisada:** `207ccb11266fedd8e983024440be01cee847bf54`  
**Estado:** **Fase 1 NO apta todavía para aplicar a Supabase.** Las migraciones compilan con rollback, pero requieren correcciones acotadas.

## 1. Validación real ejecutada por ChatGPT central

Se tomaron exactamente estas migraciones del HEAD revisado:

- `20260922100000_bloque7_ranking_schema.sql`
- `20260922110000_bloque7_ranking_profile_data.sql`

Se ejecutaron juntas contra Supabase Staging real dentro de:

`BEGIN ... ROLLBACK`

Resultado:

- ambas migraciones **compilan** sobre el esquema real;
- no quedó ninguna tabla/columna/función de Bloque 7 persistida;
- verificación posterior confirmó Staging limpio.

Después se ejecutaron dos dry-runs adicionales, también transaccionales, para comprobar seguridad e inmutabilidad.

Esos dry-runs encontraron problemas reales.

## 2. F1-C01 — SECURITY DEFINER nueva queda ejecutable por PUBLIC

`complete_ranking_profile_data(...)` hace:

- `GRANT EXECUTE ... TO authenticated`;

pero no hace antes:

- `REVOKE EXECUTE ... FROM PUBLIC/anon`.

PostgreSQL otorga EXECUTE a PUBLIC por defecto al crear funciones.

El dry-run real contra Staging confirmó:

`PUBLIC_EXECUTE_PRESENT`

Este patrón ya produjo un bug de seguridad en Bloque 6 y no debe repetirse.

### Corrección obligatoria

Después de crear la función:

- revocar explícitamente EXECUTE de `PUBLIC` y `anon`;
- otorgar únicamente a `authenticated` y, si el contrato técnico lo necesita, `service_role`.

Agregar verificación automática específica.

## 3. F1-C02 — Las tablas declaradas “append-only/inmutables” permiten UPDATE/DELETE a service_role

Las migraciones dicen que:

- `ranking_editions` es inmutable;
- `ranking_rows` es append-only;
- `location_change_events` es append-only.

Pero otorgan explícitamente:

`SELECT, INSERT, UPDATE, DELETE TO service_role`.

Además el proyecto tiene default privileges previos que conceden CRUD a `service_role`.

El dry-run real confirmó:

`APPEND_ONLY_TABLES_MUTABLE_BY_SERVICE_ROLE`

### Corrección obligatoria

Después de crear las tablas:

- revocar explícitamente UPDATE/DELETE de `service_role` sobre:
  - `ranking_editions`;
  - `ranking_rows`;
  - `location_change_events`;
- dejar únicamente los permisos mínimos realmente necesarios.

La función de publicación futura puede operar como `SECURITY DEFINER`/owner sin convertir a service_role en una vía normal de mutación histórica.

La limpieza de fixtures en Staging puede hacerse excepcionalmente por owner/SQL controlado; no debe debilitar el contrato productivo.

## 4. F1-C03 — El cooldown de ubicación puede saltarse usando complete_profile

La nueva migración declara `complete_ranking_profile_data` como vía específica para ubicación/rama/opt-in, pero la función existente:

`public.complete_profile(...)`

sigue:

- ejecutable por `authenticated`;
- pudiendo escribir `competitive_branch`;
- pudiendo escribir `location_id`;
- sin aplicar el cooldown de 30 días;
- sin escribir `location_change_events`.

Por lo tanto un cliente autenticado puede evitar el contrato nuevo llamando a la RPC vieja.

Esto viola la condición server-authoritative del cooldown/auditoría.

### Corrección obligatoria

Hacer el hardening mínimo compatible con el flujo vigente:

- una vez que el perfil mínimo ya existe, los cambios de ubicación/rama destinados a Ranking deben pasar por `complete_ranking_profile_data`;
- `complete_profile` no puede seguir siendo una vía alternativa para cambiar una ubicación ya establecida o completar datos de Ranking fuera del contrato nuevo.

Claude debe inspeccionar los llamados/tests reales de `complete_profile` antes de elegir la variante exacta, para no romper onboarding/reintentos ya cerrados.

Preferir el cambio más pequeño que:

1. preserve el onboarding vigente;
2. preserve reintentos/idempotencia existentes;
3. impida cambiar/sobrescribir ubicación competitiva por fuera de la RPC nueva;
4. no obligue a rediseñar Bloque 2/3.

Agregar tests concretos de bypass/cooldown.

## 5. F1-C04 — Falta serialización ante dos cambios concurrentes de ubicación

`complete_ranking_profile_data` lee el perfil sin `FOR UPDATE`.

Dos llamadas concurrentes pueden:

1. leer el mismo `location_effective_from`;
2. superar ambas el mismo guard;
3. escribir dos cambios distintos;
4. generar dos eventos.

Para una regla de cooldown server-side esto no es aceptable.

### Corrección obligatoria

Bloquear la fila del perfil durante la decisión/mutación:

- `SELECT ... FOR UPDATE` o mecanismo equivalente;
- toda la verificación de cooldown + UPDATE + evento dentro de la misma transacción.

Agregar prueba de contrato/concurrencia si el runner lo permite; como mínimo, verificación SQL dirigida.

## 6. F1-C05 — Constraints de ranking_rows deben expresar lo que documentan

Hay varios invariantes documentados que hoy no están garantizados por DB.

Corregir de forma acotada:

- `eligibility_reason_codes` debe ser siempre JSON array;
- si `is_eligible=false`, debe existir al menos un motivo;
- si `is_eligible=true`, no debe quedar un motivo de exclusión residual;
- `position` y `tie_group`, cuando existan, deben ser positivos;
- si el diseño mantiene `tie_group = position`, imponerlo realmente con CHECK;
- `total_eligible >= 0`;
- Nivel público/interno, si no son NULL, dentro de la escala válida de BRAMU.

No convertir esto en una colección enorme de constraints; solo los invariantes ya declarados por el propio contrato.

## 7. F1-C06 — Un jugador no puede pertenecer a dos scopes propios del mismo tipo en una edición

El unique actual es:

`(edition_id, scope_type, scope_key, player_id)`

Eso permite que, por un bug de cálculo, el mismo jugador quede dos veces en `local` con dos `scope_key` distintos dentro de la misma edición.

V1 no tiene `Explorar rankings`: Local/Provincial/País son los ámbitos PROPIOS del jugador congelados en el corte.

### Corrección obligatoria

En `ranking_rows`, la unicidad individual debe impedir más de una fila del mismo `scope_type` por jugador/edición.

Preferencia:

`UNIQUE (edition_id, scope_type, player_id)`

`scope_key` sigue existiendo para agrupar las filas del universo.

Si existe un caso real que invalide esta restricción, documentarlo antes de descartarla.

## 8. F1-C07 — Backfill de location_effective_from: no declarar exactitud que no puede probarse universalmente

En Staging real, todas las cuentas actuales tienen `location_id = NULL`, así que el UPDATE de backfill no modifica ninguna fila hoy.

Por lo tanto este punto NO bloquea Staging.

Sin embargo el comentario de la migración afirma que `profiles.updated_at` es “exactamente” el instante de la única fijación de ubicación. Esa afirmación no queda garantizada como contrato general: `updated_at` también cambia al reescribir otros campos mediante `complete_profile`.

### Corrección

No inventar precisión histórica.

Como Production todavía no tiene usuarios, la migración productiva podrá nacer con este campo antes del primer uso real.

Para cualquier entorno preexistente con ubicación, usar una estrategia conservadora explícita y documentada; no afirmar que un timestamp genérico es históricamente exacto si no puede demostrarse.

## 9. Lo que SÍ queda aprobado de Fase 1

Se mantienen:

- `ranking_editions`;
- `ranking_rows` como snapshot persistido;
- candidatos no elegibles + reason codes;
- IDs canónicos de ubicación;
- `location_change_events`;
- `profiles.location_effective_from`;
- `players.ranking_excluded` mínimo server-side;
- RPC dedicada de datos de Ranking;
- RLS deny-by-default;
- Mi red no materializada;
- no frontend / no cron / no Fase 2 todavía.

## 10. Estado de Supabase tras la revisión

**No se aplicó ninguna migración de Bloque 7.**

Verificación posterior real:

- `public.ranking_editions`: no existe;
- `public.ranking_rows`: no existe;
- `public.location_change_events`: no existe;
- `profiles.location_effective_from`: no existe;
- `players.ranking_excluded`: no existe.

Staging quedó exactamente sin cambios persistentes de Fase 1.

## 11. Próximo paso

Claude debe corregir únicamente F1-C01…F1-C07 en las migraciones de Fase 1 y actualizar el resultado documental.

Todavía:

- NO aplicar Supabase;
- NO empezar Fase 2;
- NO cron;
- NO frontend.

Después ChatGPT central repetirá:

1. compilación real con rollback;
2. checks de PUBLIC EXECUTE;
3. checks de permisos append-only;
4. prueba dirigida del cooldown/bypass;
5. recién entonces decidirá si se aplican las migraciones a Staging.
