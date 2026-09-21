# Backend Bloque 6 — Revisión central adicional antes de Staging

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `acf44ebb59c29b5ce847e58643b70bc9e78a767a`  
**Resultado:** **NO DESPLEGAR todavía a Supabase Staging**

Claude corrigió correctamente los 13 puntos de `06_Revision_Fase_A_ChatGPT.md`, pero una segunda revisión estática del estado resultante encontró **7 bloqueantes técnicos adicionales**. No son decisiones nuevas de producto.

No aplicar migraciones ni desplegar Edge Functions hasta resolverlos.

---

## B6-B-01 — Inactividad + reversión de confidence todavía no es reversible exactamente

### Problema

En `bramulab/match-level-engine.js#computeLevelStateUpdates`, para la primera aplicación de un partido tras inactividad:

1. se obtiene una `confidenceBaseForApply` ya reducida por inactividad;
2. se persiste `confidenceBefore = confidenceBaseForApply`;
3. una reversión futura resta `confidenceAfter - confidenceBefore`.

Ejemplo conceptual:

- confidence persistida antes del partido: 0.80;
- por inactividad la confidence efectiva usada por fórmula baja a 0.62;
- tras el partido queda 0.67;
- la fila guarda before=0.62 / after=0.67;
- revertir devuelve 0.62, no 0.80.

Después `last_rated_at` vuelve a una fecha anterior y el próximo partido puede volver a aplicar decay sobre 0.62, generando doble decay.

### Corrección requerida

Separar claramente:

- `formula_confidence_before`: confidence efectiva/decay usada por la fórmula;
- `confidence_before`: confidence LIVE persistida antes del efecto completo de este partido;
- `confidence_after`: confidence final persistida luego del partido.

La reversión exacta debe restaurar el valor LIVE previo.

Para correcciones del mismo partido:

- reutilizar el mismo `formula_confidence_before` inmutable;
- revertir primero el efecto LIVE anterior;
- calcular el nuevo `confidence_after` desde esa referencia de fórmula;
- persistir before/after LIVE que permitan volver a revertir exactamente.

Agregar un test obligatorio:

> partido tras >60d de inactividad → aplicar → revertir → confidence cruda original restaurada → `last_rated_at` anterior restaurado → siguiente partido aplica decay exactamente una vez.

---

## B6-B-02 — `get_player_level_state_as_of` puede devolver un estado roto después de una reversión

### Problema

La RPC actual toma el último `level_events` previo al cutoff y, para todo evento no `initial_estimate`, intenta leer:

- `muAfter`;
- `confidenceAfter`;
- `evidenceUnitsAfter`;
- `statusAfter`.

Pero `_bloque6_revert_applied_result` hoy escribe eventos `match_correction_reversal` con solo:

`{ revertedResultId }`

Si una reversión pura es el último evento antes del cutoff, la reconstrucción histórica devuelve campos NULL y un jugador real puede terminar tratado como invitado/sin Nivel.

### Corrección requerida

- Todo evento que cambie estado debe guardar el estado post-evento completo:
  - `muAfter`;
  - `confidenceAfter`;
  - `evidenceUnitsAfter`;
  - `statusAfter`;
  - `lastRatedAtAfter`.
- `get_player_level_state_as_of` debe considerar únicamente:
  - `initial_estimate`; o
  - eventos con snapshot post-evento completo.
- Debe devolver también `lastRatedAt`.
- Usar semántica estrictamente anterior al cutoff: preferir `created_at < p_cutoff`.
- Para un participante recién incorporado por corrección de identidad:
  - reconstruir su estado histórico;
  - aplicar la regla de inactividad usando su `lastRatedAt` histórico y la fecha del partido;
  - nunca usar directamente su confidence histórica cruda como si ya fuera efectiva.

---

## B6-B-03 — Reemplazo de identidad pre-validación no respeta autoridad por pareja ni revisiones append-only

### Problema

Para un partido `pending_validation`, `resolve_identity_issue` hoy:

- actualiza `match_participants.player_id`;
- cierra la incidencia;
- escribe una acción.

Pero NO:

- crea una revisión append-only;
- deja conforme a la pareja que hizo la corrección;
- pasa la acción a la pareja contraria;
- referencia una nueva revisión.

Esto contradice `Experiencia_Inicial.md` §§7, 11, 12 y 13.

Además, Bloque 5 decide la conformidad rival comparando `caller_team` con `current_revision.proposed_by_team`; por lo tanto, cambiar solamente `action_side` no alcanza.

### Corrección requerida

Al resolver identidad con el partido todavía pendiente:

1. exigir `validation_deadline_at > now()`;
2. identificar el equipo actual del actor;
3. crear una nueva `match_revisions`:
   - `source='proposed_correction'`;
   - `proposed_by_player_id=actor`;
   - `proposed_by_team=equipo actor`;
   - mismo `played_at`;
4. copiar los sets de la revisión vigente a la nueva revisión;
5. reemplazar el participante;
6. poner `matches.current_revision_id` en la nueva revisión;
7. poner `action_side` en la pareja contraria;
8. NO reiniciar `validation_deadline_at`;
9. registrar acción vinculada a la nueva revisión;
10. actualizar fingerprint (ver B6-B-04).

El partido sigue `pending_validation`.

---

## B6-B-04 — `participant_fingerprint` queda obsoleto al corregir identidad

### Problema

Bloque 5 deduplica por:

- cuatro `player_id`;
- composición exacta de parejas;
- fingerprint canónico SHA-256.

Bloque 6 modifica `match_participants`, pero nunca actualiza `matches.participant_fingerprint`.

Consecuencias posibles:

- una carga posterior con los participantes correctos puede crear un duplicado;
- una carga con la identidad incorrecta vieja todavía puede adjuntarse al partido.

### Corrección requerida

Crear un helper server-side único, por ejemplo:

`_bloque6_refresh_participant_fingerprint(match_id)`

Regla:

- con cuatro `player_id` no nulos, calcular EXACTAMENTE el mismo fingerprint que Bloque 5:
  - ordenar IDs dentro de cada pareja;
  - ordenar ambas parejas;
  - `sha256(pairA|pairB)` con `extensions.digest`;
- con algún slot NULL, usar un fingerprint centinela determinístico y único por `match_id`, imposible de coincidir con una carga normal de cuatro IDs.

Invocarlo atómicamente:

- al abrir una incidencia y convertir un slot a NULL;
- al resolver identidad pre-validación;
- al resolver identidad post-validación;
- al materializar `Jugador no identificado`;
- en la vía administrativa de reemplazo.

No modificar el algoritmo de Bloque 5: reutilizar exactamente su convención.

---

## B6-B-05 — Falta autorización suficiente para resolver una incidencia y validación del reemplazo

### Problema

`resolve_identity_issue` verifica que exista un usuario/player para el JWT, pero no exige que ese actor siga siendo participante del partido.

Conocer un `issue_id` no debe alcanzar para resolver una incidencia.

Además, el reemplazo solo se chequea contra duplicidad dentro del partido; falta validar existencia/actividad y la regla de provisionales de Bloque 4.

### Corrección requerida

Para el camino normal autenticado:

- exigir que el caller sea un participante actual del partido;
- replacement:
  - debe existir;
  - debe estar activo;
  - no puede duplicar un participante ya presente;
- si es provisional:
  - debe haber sido creado por el caller; **o**
  - debe haber compartido previamente un partido con el caller;
- si es registered, puede seleccionarse normalmente según las reglas vigentes.

La vía administrativa service_role sigue separada.

Agregar tests de autorización negativa.

---

## B6-B-06 — `distinct_opponents` se recalcula antes de persistir el reemplazo post-validación

### Problema

En `officialize_match_validation`, el loop de actualización de `level_states` calcula `distinct_opponents` consultando `match_participants`.

Pero para `identity_resolved`, el nuevo participante se escribe DESPUÉS de ese loop.

Entonces los contadores pueden calcularse con el slot todavía NULL/viejo.

### Corrección requerida

Dentro de la MISMA transacción:

1. validar todos los guards/stale checks;
2. para `identity_resolved`, actualizar el slot con el reemplazo **antes** de recalcular `rated_matches/distinct_opponents`;
3. actualizar fingerprint;
4. persistir/reprocesar Nivel;
5. cerrar la incidencia y enlazar `reapplied_result_id` al final.

Si algo falla, PostgreSQL revierte toda la transacción.

Para `identity_unidentified`, mantener slot NULL + fingerprint centinela.

---

## B6-B-07 — El deadline fijo de 30 días no se respeta en rutas de identidad pendientes

### Problema

Un partido puede seguir físicamente con `status='pending_validation'` aunque su deadline ya haya vencido de forma lógica.

Hoy:

- `report_identity_issue` permite abrir incidencia sobre ese partido;
- `resolve_identity_issue` permite resolverla.

Pero `Experiencia_Inicial.md` §11 define que después de 30 días:

- deja de ser accionable;
- queda expirado/no validado;
- no se reactiva automáticamente;
- una corrección nunca reinicia la ventana.

### Corrección requerida

En rutas pre-validación:

- exigir `validation_deadline_at > now()`;
- si venció, devolver `match_expired` o equivalente;
- nunca resetear/recrear el deadline.

Esto aplica tanto al reporte como a la resolución de identidad pendiente.

---

## Ajustes secundarios recomendados

Si son baratos y seguros durante esta corrección:

1. En `_bloque6_revert_applied_result`, bloquear/iterar jugadores en orden determinístico por `player_id` para reducir riesgo de deadlock.
2. Mejorar el reintento idempotente de `respond-match-correction` si la corrección ya fue aceptada, siempre que no complique el contrato.
3. Mantener el fingerprint centinela mientras exista un slot no identificado/open.

No ampliar alcance más allá de esto.

---

## Tests mínimos adicionales

Agregar cobertura dirigida, sin repetir suites irrelevantes:

1. inactivity >60d → apply → reverse → raw confidence original;
2. siguiente partido después de esa reversión aplica decay una sola vez;
3. `get_player_level_state_as_of` después de reversión pura devuelve estado completo;
4. identidad nueva reconstruye estado histórico + inactivity correctamente;
5. identidad pendiente crea nueva revisión append-only y pasa acción al lado contrario;
6. identidad pendiente no reinicia deadline;
7. identidad pendiente vencida no puede reportarse ni resolverse;
8. fingerprint cambia a centinela con slot NULL;
9. fingerprint vuelve al hash canónico exacto al resolver con 4 IDs;
10. una carga con los nuevos participantes converge al mismo `match_id`;
11. una carga con la identidad vieja ya no puede adjuntarse;
12. usuario ajeno al partido no puede resolver incidencia;
13. provisional no relacionado no puede usarse como reemplazo;
14. provisional relacionado sí puede usarse;
15. `distinct_opponents` usa el reemplazo correcto en la misma transacción;
16. post-validation identity resolution sigue siendo atómica.

No hace falta volver a correr `tests.html` si no se toca ningún archivo cargado por esa suite.

---

## Alcance operativo

### SÍ

- corregir las migraciones B6 originales porque todavía no fueron aplicadas;
- modificar motor/orquestador/Edge Functions B6;
- modificar `verify-bloque6.mjs`;
- tests locales dirigidos;
- node checks;
- commit/push únicamente a `staging`.

### NO

- Supabase real;
- Vercel;
- main;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence;
- UI/UX final.

---

## Resultado esperado

No hay ninguna DECISIÓN ABIERTA de producto.

Al finalizar debe quedar:

- implementación corregida;
- tests locales verdes;
- un único informe breve de corrección;
- respuesta final de Claude corta, sin repetir el informe.

Después ChatGPT central revisará el diff y recién entonces aplicará migraciones/Edge Functions en Supabase Staging.
