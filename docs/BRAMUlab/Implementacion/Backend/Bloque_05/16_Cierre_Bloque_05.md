# Backend Bloque 5 — Cierre formal

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**Bundle final:** `04.10-h15`  
**HEAD funcional validado:** `02dafa1`  
**HEAD documental previo al cierre:** `b543078` o superior  
**Estado:** **CERRADO en Staging**

## 1. Alcance cerrado

Backend Bloque 5 deja operativo el ciclo de **carga de partidos ya jugados + historial compartido pendiente**, todavía sin oficialización de resultados.

Quedó implementado y validado:

- modelo server-side de partidos, participantes, sets, revisiones, acciones, estado privado y submissions idempotentes;
- carga retroactiva máxima de 14 días;
- `pending_validation` como estado server-backed inicial;
- deadline fijo de 30 días;
- create-or-attach estructurado por identidades reales, parejas, fecha/hora y formato;
- deduplicación sin matching por nombre;
- convergencia de cargas coincidentes en un único `match_id`;
- ambigüedad explícita, sin fusiones silenciosas;
- idempotencia y protección de concurrencia;
- reutilización de provisionales relacionados por el mismo `player_id`;
- límite personal de 5 pendientes accionables que bloquea solo iniciar una carga nueva;
- expiración lógica;
- historial server-backed;
- outbox local + `sync_pending` + retry conservando la misma idempotency key;
- ocultamiento individual sin borrar el partido compartido;
- nota privada por usuario;
- separación estricta entre historial visible y partidos computables;
- pending/sync_pending/expired fuera de Nivel, estadísticas y métricas oficiales;
- integración real en Home, Historial, Resumen y selector de jugadores;
- soporte de jugadores reales homónimos por identidad (`player_id`), nunca por display name.

## 2. Qué NO hace Bloque 5

Bloque 5 **no oficializa** partidos.

Aunque la pareja rival cargue el mismo resultado:

- el partido sigue `pending_validation`;
- puede quedar `readyForValidation=true`;
- no se escribe `validated_at`;
- no se dispara `match_validated`;
- no afecta Nivel ni estadísticas oficiales.

La oficialización atómica, correcciones y efectos pertenecen a **Bloque 6**.

## 3. Backend real validado en Supabase Staging

Migraciones de Bloque 5 aplicadas:

- `bloque5_matches_core`;
- `bloque5_rpcs_read`;
- `bloque5_create_or_attach_rpc`;
- `bloque5_defer_submission_fk`;
- `bloque5_conformity_guard`;
- `bloque5_feed_metadata`.

Edge Function desplegada:

- `create-or-attach-match` — ACTIVE, JWT requerido.

La validación real contra Postgres Staging cubrió:

- create-or-attach;
- misma pareja / pareja rival;
- una sola conformidad por pareja;
- ausencia de efectos de Nivel;
- idempotencia secuencial y concurrente;
- concurrencia por fingerprint;
- provisionales relacionadas;
- ambigüedad;
- desambiguación temporal;
- límite de 5 pendientes;
- hide / nota privada / expiración;
- RLS y lectura RPC-only.

Evidencia: `08_Validacion_Backend_Staging_ChatGPT.md`.

## 4. Frontend y pruebas

El wiring final quedó en bundle `04.10-h15`.

Suite local final:

- **1448/1448 OK**;
- 0 fallas;
- 0 errores de consola;
- `node --check` limpio en `app.js`, `store.js`, `matches.js`, `match-sync.js`.

El camino local/legacy continúa funcionando y no se migró automáticamente al backend.

## 5. QA real de navegador

Primera QA real de Work:

- carga server-backed → PASS;
- persistencia / refresh → PASS;
- partido pendiente visible → PASS;
- pendiente fuera de métricas oficiales → PASS;
- nota privada → PASS;
- ocultamiento personal → PASS;
- detectó dos bugs reales:
  - homónimos tratados como duplicados;
  - hora desconocida mostrada como `00:00`;
- detectó dos mejoras UX:
  - estado pendiente faltaba en Último partido;
  - botón decía Eliminar aunque la acción era Ocultar.

Los cuatro puntos fueron corregidos y la revalidación dirigida sobre `04.10-h15` dio:

1. usuarios reales homónimos → **PASS**;
2. hora desconocida sin `00:00` → **PASS**;
3. Último partido con `PENDIENTE DE VALIDACIÓN` → **PASS**;
4. acción server-backed `OCULTAR PARTIDO` → **PASS**.

No surgieron bugs nuevos.

Evidencia:

- `12_Validacion_Navegador_Work.md`;
- `13_Correcciones_QA_Work_ChatGPT.md`;
- `15_Revalidacion_Dirigida_Work.md`.

## 6. Cobertura no repetida deliberadamente

No se repitieron en navegador escenarios que ya tenían evidencia suficiente:

- carrera de idempotencia;
- concurrencia;
- RLS;
- ambigüedad;
- límite de pendientes;
- segundo participante;
- offline real.

El navegador de Work no ofrecía simulación offline fiable. El comportamiento `sync_pending`/outbox quedó cubierto por la implementación y suite local, sin fingir una desconexión manual.

Esta limitación no bloquea el cierre de Bloque 5.

## 7. Limpieza QA

Al cierre se eliminaron de forma controlada los dos partidos creados exclusivamente por Work:

- `f41041e8-2ff0-4530-8c9a-2d2841b57d5f` — `QA B5 Work`;
- `3985f88f-7bc6-489a-a823-56c8a5a8a2c2` — `QA B5 Work h15`.

Antes de borrarlos se verificó que ambos seguían:

- `pending_validation`;
- con una única acción `created`;
- sin validación ni efectos oficiales.

También se limpiaron sus submissions, revisiones, sets, participantes, estado privado y eventos QA asociados.

Resultado final:

- fixtures QA de Bloque 5 restantes: **0**;
- submissions QA asociadas restantes: **0**.

Las cuentas QA preservadas de Bloques anteriores no se eliminaron.

## 8. Decisión de cierre

Los criterios de terminado de Bloque 5 están cubiertos con evidencia suficiente y sin bloqueos abiertos.

**Backend Bloque 5 queda formalmente CERRADO en Staging.**

### Próximo bloque

El siguiente bloque del roadmap es:

**Bloque 6 — Validación y actualización oficial**

Incluye, entre otras cosas:

- `Confirmar`;
- `Proponer corrección`;
- `No participé`;
- autoridad por pareja;
- oficialización atómica;
- actualización de Nivel/calibración/estadísticas;
- correcciones y reproceso idempotente;
- incidencias de identidad.

**No iniciar Bloque 6 automáticamente.** Debe arrancar con un handoff específico y revisión de las fuentes maestras vigentes.

## 9. Entornos

- `staging`: tocado y validado.
- `main`: NO tocado.
- Production: NO tocada.
- BRAMUlive: NO tocado.
