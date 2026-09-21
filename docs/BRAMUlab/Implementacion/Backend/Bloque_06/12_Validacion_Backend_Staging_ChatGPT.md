# Backend Bloque 6 — Validación backend real en Staging

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD de código al iniciar la validación:** `7d343d9`  
**HEAD después de hotfixes backend:** `8d2b6d08fd5eaddead1858b17d4d7dd7c5886771`  
**Entorno:** Supabase `bramulab-staging`  
**Resultado:** **BACKEND/Fase A VERDE para avanzar a Fase B frontend/wiring. Bloque 6 todavía NO cerrado.**

## 1. Qué se hizo realmente en Staging

Se aplicaron las migraciones de Bloque 6 y se desplegaron las Edge Functions correspondientes en Supabase Staging.

Edge Functions activas:

- `create-or-attach-match` — redesplegada con hook B6;
- `officialize-match`;
- `propose-match-correction`;
- `respond-match-correction`;
- `resolve-identity-issue`;
- `admin-resolve-identity-issue`.

No se tocó `main`, Production ni BRAMUlive.

## 2. Hotfixes encontrados por la validación real

La validación contra PostgreSQL/Supabase real encontró cuatro problemas que no aparecían en la revisión estática final:

### H1 — permisos de helpers internos

Los helpers SECURITY DEFINER:

- `_bloque6_refresh_participant_fingerprint`;
- `_bloque6_revert_applied_result`;

habían heredado `EXECUTE` para `PUBLIC` por defecto de PostgreSQL.

**Corrección:** migración `20260921235000_bloque6_internal_helper_grants.sql`.

Resultado revalidado:

- `anon` → sin EXECUTE;
- `authenticated` → sin EXECUTE;
- `service_role` conserva las vías administrativas necesarias.

### H2 — ambigüedad PL/pgSQL en `get_notifications`

La RPC fallaba con:

`column reference "read_at" is ambiguous`

por colisión entre columnas de `RETURNS TABLE` y el subquery interno.

**Corrección:** referencias calificadas mediante `all_rows.read_at` / `all_rows.created_at`.

Migración hotfix:

`20260921235500_bloque6_fix_notifications_ambiguity.sql`.

### H3 — detección incorrecta del resultado aplicado existente

`officialize_match_validation` usaba:

`v_existing_applied IS NOT NULL`

sobre una variable composite. En PostgreSQL, un composite con algunos campos NULL puede hacer que esa condición no sea verdadera aunque la fila exista.

Efecto real detectado:

- la corrección quedaba autorizada;
- no se marcaba el resultado anterior como `reverted`;
- el INSERT del nuevo resultado chocaba con `match_level_results_one_applied_per_match`.

**Corrección:** comprobar existencia por PK:

`v_existing_applied.result_id IS NOT NULL`.

Migración hotfix:

`20260921235700_bloque6_fix_applied_result_detection.sql`.

### H4 — `max(uuid)` inexistente en PostgreSQL

`_bloque6_refresh_participant_fingerprint` intentaba obtener slots con `max(player_id)`, pero PostgreSQL no define `max(uuid)`.

El fallo aparecía al ejecutar `No participé`.

**Corrección:** leer cada slot directamente por:

- `match_id`;
- `team`;
- `position_in_team`.

Migración hotfix:

`20260921235800_bloque6_fix_fingerprint_uuid.sql`.

## 3. C-01…C-10 — evidencia final

### C-01 — diferencia neta sin pisar partidos posteriores

Cobertura dedicada en `bramulab/match-level-engine.test.mjs`.

Última corrida local de Claude previa a Staging:

- `node --test bramulab/match-level-engine.test.mjs` → **30/30 OK**.

Incluye explícitamente:

- partido posterior intercalado;
- preservación del efecto posterior;
- clamps 1.0 / 10.0;
- inactividad + corrección/reversión;
- baseline LIVE inmutable.

Los hotfixes posteriores fueron exclusivamente SQL y no modificaron este motor.

**Resultado:** PASS.

### C-02 — autoridad por pareja y guards de primera oficialización

Probado en Staging real:

- lado proponente intentando confirmar → `not_actionable_for_caller`;
- integrante del lado accionable → `confirmed`;
- partido quedó listo y fue oficializado;
- retry `initial` sobre validated → `already_validated`, sin duplicar ni reemplazar el resultado vigente;
- retry posterior a una corrección tampoco pudo volver a crear un `initial`.

**Resultado:** PASS.

### C-03 — no duplicar durante identidad open/unidentified

Probado en Staging real:

- con issue `open`, una nueva carga de los 4 IDs devolvió `identity_resolution_required` y el mismo `match_id`;
- con issue terminal `unidentified`, volvió a devolver `identity_resolution_required`;
- no se creó un segundo partido.

**Resultado:** PASS.

### C-04 — preservar orientación A/B tras reemplazo de identidad

Se resolvió una identidad usando un replacement UUID elegido para invertir el orden léxico que habría resultado de recalcular las parejas desde cero.

Luego se volvió a cargar el encuentro con las parejas y score desde la perspectiva del nuevo envío.

Resultado:

- convergió al mismo `match_id`;
- devolvió `already_validated`;
- no invirtió A/B;
- no interpretó el score como corrección nueva.

**Resultado:** PASS.

### C-05 — admin resolve staged y atómico

Probado en Staging real:

- usuario ajeno al partido → `not_a_participant`;
- `admin_force_resolve_identity_issue` en partido validated → `identity_resolved_authorized`;
- después de autorizar:
  - issue seguía `open`;
  - slot seguía NULL;
  - fingerprint seguía centinela;
  - Nivel seguía suspendido;
- operación final `identity_resolved`:
  - reasignó slot;
  - refrescó fingerprint;
  - reaplicó Nivel;
  - cerró issue;
  - dejó exactamente un resultado `applied`.

Permisos verificados:

- `anon` → no puede ejecutar admin;
- `authenticated` → no puede ejecutar admin;
- `service_role` → sí.

**Resultado:** PASS.

### C-06 — factores contextuales congelados

Cobertura dedicada en `match-level-engine.test.mjs`:

- `computeOfficializationResultFrozenContext`;
- repetición;
- compañero;
- círculo;
- disponibilidad;
- knownLevelsCount.

Última corrida local: **30/30 OK**.

Los hotfixes posteriores no tocaron este motor.

**Resultado:** PASS.

### C-07 — terminal `Jugador no identificado` no bloquea Confirmar

Probado en Staging real sobre un partido todavía pendiente:

1. se abrió issue de identidad;
2. se movió únicamente el deadline del fixture QA para simular el vencimiento de 7 días;
3. `resolve_identity_issue(... force_unidentified=true)` → `identity_unidentified`;
4. un jugador registrado del lado accionable confirmó → `confirmed`;
5. el partido fue oficializado con:
   - `status=validated`;
   - `eligible=false`;
   - slot sin `player_id`;
   - sin fabricar identidad;
   - sin efecto de Nivel.

**Resultado:** PASS.

### C-08 — tareas accionables de Notificaciones

Probado en Staging real:

- `pending_review` apareció para los dos integrantes registrados del lado accionable;
- después de resolver el estado desapareció;
- `correction_proposed` apareció solo para el lado respondiente;
- después de resolver la corrección desapareció y quedó la notificación informativa `correction_accepted`;
- `identity_questioned` desapareció al resolverse la incidencia.

El bug H2 de `get_notifications` fue detectado y corregido durante esta prueba.

**Resultado:** PASS.

### C-09 — reloj de inactividad desde cuestionario

Se verificó en Staging real que, al revertir el único partido computable por una incidencia de identidad:

- `rated_matches` volvió a 0;
- mu/confidence/evidence volvieron al baseline previo;
- `last_rated_at` NO quedó NULL;
- `last_rated_at` coincidió exactamente con `initial_estimate.created_at`.

Además, el motor tiene tests locales explícitos:

- día 59 → sin decay;
- día 60 → sin decay;
- >60 días → decay;
- round-trip de inactividad + partido + reversión.

**Resultado:** PASS.

### C-10 — corrección vencida desaparece lógicamente

Probado con fixture sintético:

1. se creó una corrección pendiente real;
2. la tarea `correction_proposed` apareció;
3. se movió `validated_at` del fixture a 4 días atrás;
4. `pending_correction_revision_id` siguió físicamente no-NULL;
5. `get_notifications` dejó de devolver la tarea.

Sin cron ni limpieza física anticipada.

**Resultado:** PASS.

## 4. Limpieza

Fixtures creados exclusivamente para esta QA:

- usuarios sintéticos `bramu-b6qa-sql-*`: 6;
- partidos: 2;
- submissions, level_events, notifications y pilot_events asociados.

Limpieza final verificada:

- usuarios QA restantes: **0**;
- partidos QA restantes: **0**;
- submissions QA restantes: **0**.

Durante la exploración se habilitó temporalmente la extensión PostgreSQL `http`; finalmente no fue necesaria para la validación y quedó eliminada.

`http_extension_installed = 0`.

## 5. Limitación explícita

No se ejecutó el archivo `supabase/tests/verify-bloque6.mjs` completo mediante sesiones JWT reales desde una terminal con `SUPABASE_SERVICE_ROLE_KEY`, porque este chat no expone ni debe pedir ese secreto.

En su lugar se ejecutaron directamente sobre Supabase Staging los casos críticos que ese verificador cubre, con fixtures sintéticos y las RPC reales ya migradas.

Las Edge Functions nuevas sí fueron desplegadas y aceptadas por Supabase Edge Runtime.

La validación de recorridos visuales/autenticados desde la app pertenece a **Fase B frontend/wiring + QA de navegador**.

## 6. Decisión de fase

**Backend / Fase A: VERDE.**

Esto autoriza avanzar a:

**Fase B — frontend/wiring de Bloque 6.**

Bloque 6 completo **NO queda cerrado todavía** porque la app actual aún no consume las operaciones B6 nuevas de forma completa. En particular, el código vigente de `app.js` todavía documenta que la corrección server-backed es “Bloque 6, todavía sin implementar”, y `auth.js` no contiene el wiring de las nuevas Edge Functions.

Próximo documento:

`13_Handoff_Fase_B_Claude.md`.
