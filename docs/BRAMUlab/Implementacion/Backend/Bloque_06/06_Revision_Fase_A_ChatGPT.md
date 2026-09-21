# Backend Bloque 6 — Revisión central de Fase A

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `a4aee98`  
**Resultado:** **NO APLICAR todavía a Supabase Staging**  
**Motivo:** la arquitectura general sigue aprobada, pero la revisión estática encontró bloqueos reales de consistencia/atomicidad que deben corregirse antes de ejecutar las migraciones.

---

## 1. Resumen

La Fase A de Claude avanzó bien y reutiliza correctamente:

- motor de Nivel compartido;
- `match-sync.js` como adaptador principal;
- patrón Edge Function → JS compartido → RPC privada;
- revisiones append-only;
- idempotencia y locks heredados de Bloques 3–5;
- reversión de partido completo ante incidencia de identidad;
- separación display/computable de Bloque 5;
- regla 30 días desde `played_at` para Nivel;
- notificaciones internas;
- comando administrativo mínimo.

No se encontró una decisión de producto nueva que requiera a Sebastián.

Sí aparecieron fallos técnicos que, si se desplegaran tal como están, harían fallar la oficialización real o podrían dejar estado deportivo/Nivel inconsistente.

Por eso **no se aplicó ninguna migración de Bloque 6 ni se desplegó ninguna Edge Function nueva**.

---

## 2. BLOQUEANTES — corregir antes de tocar Supabase real

### B6-A-01 — `level_events` no acepta los eventos nuevos tal como se insertan

En Staging real, heredado de Bloque 3:

- `level_events.questionnaire_version` es NOT NULL;
- `level_events.questionnaire_mode` es NOT NULL.

Las RPCs nuevas insertan eventos de partido sin esos campos.

Resultado si se despliega así:

> la primera oficialización/corrección que intente escribir `match_delta` / reversión / reaplicación fallará por NOT NULL.

**Corrección:**

En la migración de Bloque 6 que amplía `level_events`:

- quitar NOT NULL de `questionnaire_version`;
- quitar NOT NULL de `questionnaire_mode`;
- mantenerlos obligatorios conceptualmente solo para `initial_estimate`;
- agregar/verificar un CHECK que preserve esa invariancia si conviene.

---

### B6-A-02 — los parámetros JSONB de la rutina compartida se envían como strings JSON

En `match-officialize-core.ts` hoy se llama a la RPC con:

- `JSON.stringify(reasonCodes)`;
- `JSON.stringify(resultPlayers)`;
- `JSON.stringify(levelStateUpdates)`.

Pero los parámetros PostgreSQL son `jsonb`.

Eso envía un JSON string/scalar, no el array JSON esperado por:

`jsonb_array_elements(...)`

Resultado probable:

> `cannot extract elements from a scalar`.

**Corrección:**

Pasar arrays/objetos JS directamente a Supabase RPC:

- `p_reason_codes: reasonCodes`;
- `p_result_players: resultPlayers`;
- `p_level_state_updates: levelStateUpdates`.

Agregar test real que obligue a recorrer al menos un `jsonb_array_elements`.

---

### B6-A-03 — reversión de `confidence` incompleta

`_bloque6_revert_applied_result` revierte:

- `mu`;
- `evidence_units`;
- rated_matches;
- distinct_opponents;

pero **no actualiza `confidence`**.

Eso deja un estado imposible: evidencia revertida con confianza todavía aumentada por el partido retirado.

Debe quedar cubierto tanto en:

- incidencia de identidad;
- anulación administrativa;
- cualquier reversión pura futura.

---

### B6-A-04 — reversión de `mu` usa `delta_capped`, que no siempre es el movimiento realmente aplicado

Hoy se hace:

`mu_actual - delta_capped`

Eso falla en los bordes 1.0 / 10.0.

Ejemplo conceptual:

- mu = 9.95;
- delta_capped = +0.20;
- mu_after real = 10.00 por clamp;
- movimiento efectivamente aplicado = +0.05, no +0.20.

La reversión exacta debe usar:

`mu_after - mu_before`

persistido en `match_level_result_players`.

Lo mismo aplica al cálculo de diferencia neta en `match-level-engine.js`:

- old movement = `old.muAfter - old.muBefore`;
- new movement = `new.muAfter - new.muBefore`.

No usar `deltaCapped` como sinónimo de movimiento aplicado.

Agregar tests explícitos en límite inferior y superior.

---

### B6-A-05 — la regla de inactividad de Nivel V1.5 todavía no está integrada en el camino server-backed

La fórmula vigente §10.3 exige:

- 0–60 días: sin cambio;
- después: reducir **confidence efectiva**;
- usar esa confianza efectiva como base del próximo partido;
- `mu` no baja por inactividad.

Hoy:

- `get_match_officialization_snapshot` no entrega `last_rated_at`;
- `buildPlayerStatesDict` usa `confidence` almacenada directamente;
- `computeEffectiveConfidenceAfterInactivity` nunca se llama en la oficialización real;
- `officialize_match_validation` escribe `last_rated_at = now()`, no la fecha deportiva correspondiente.

Por lo tanto el backend real todavía no cumple V1.5 en este punto.

**Corrección mínima:**

1. transportar `lastRatedAt` al motor;
2. calcular confidence efectiva a la fecha del partido;
3. usarla en el input deportivo;
4. actualizar `last_rated_at` coherentemente con actividad computable real;
5. al revertir el último partido computable, reconstruir el último `played_at` de los resultados aplicados restantes.

Además, la lógica de confianza post-partido/corrección debe respetar la regla especial de inactividad: no asumir que `confidence` puede reconstruirse siempre únicamente desde `confidence_origin + evidence_units` una vez que existió decay.

Este punto requiere una corrección técnica cuidadosa y tests específicos.

---

### B6-A-06 — confirmación explícita usa todos los sets de todas las revisiones

En `officialize-match/index.ts`, el camino `Confirmar` consulta:

`match_sets where match_id = ...`

sin filtrar por la revisión vigente.

Si el partido tuvo una propuesta/corrección pre-validación, el endpoint puede mezclar sets de varias revisiones al reconstruir la conformidad.

**Corrección:**

Reconstruir exclusivamente:

- `current_revision_id`;
- su `revision_number`;
- los sets de ESA revisión.

Preferir reutilizar el snapshot consolidado ya existente antes que hacer consultas paralelas.

---

### B6-A-07 — falta protección contra oficializar una revisión stale

`officialize_match_validation` bloquea la fila de `matches`, pero no verifica de forma suficiente que `p_revision_id` siga siendo la revisión correcta para el trigger correspondiente.

La protección de snapshots de Nivel no reemplaza la protección del snapshot del partido.

**Corrección:**

Bajo lock:

- `initial`: exigir revisión vigente esperada;
- `correction_accepted`: exigir que `pending_correction_revision_id = p_revision_id`;
- identidad/reaplicación: exigir la revisión oficial correspondiente.

Ante mismatch:

`stale_match_revision`

sin escribir nada.

La Edge Function puede releer/reintentar solo cuando tenga sentido.

---

### B6-A-08 — aceptación de corrección post-validación NO es atómica con Nivel

Flujo actual:

1. `respond_post_validation_correction` mueve `current_revision_id` y limpia `pending_correction_revision_id`;
2. termina esa transacción;
3. Edge Function calcula Nivel;
4. otra RPC revierte/reaplica.

Si falla 3 o 4:

- el resultado oficial ya cambió;
- Nivel/snapshots/reasonCodes pueden seguir correspondiendo a la revisión anterior.

Esto contradice el contrato de Bloque 6:

> revisión oficial + Nivel + calibración + snapshots + reasonCodes deben quedar coherentes atómicamente.

**Corrección recomendada:**

- la RPC de respuesta solo AUTORIZA la aceptación y devuelve la revisión pendiente; no la oficializa todavía;
- la rutina JS calcula contra esa revisión objetivo;
- `officialize_match_validation(trigger=correction_accepted)`, en UNA transacción:
  - verifica que esa siga siendo la revisión pendiente;
  - revierte/reaplica Nivel;
  - mueve `current_revision_id`;
  - limpia `pending_correction_revision_id`;
  - escribe acciones/notificaciones.

Un único commit de DB deja la corrección oficial completa.

---

### B6-A-09 — resolución de identidad post-validación tiene una ventana de inconsistencia similar

Abrir una incidencia está bien encaminado:

- retira slot;
- revierte el partido completo;
- todo dentro de la misma operación.

Pero resolverla hoy hace:

1. reasigna el participante y marca issue `resolved`;
2. termina esa transacción;
3. recién después intenta reaplicar Nivel desde Edge.

Si falla el recálculo:

- la identidad aparece resuelta;
- el resultado sigue oficial;
- el efecto de Nivel puede seguir suspendido;
- `reapplied_result_id` no queda cerrado por el núcleo actual.

No necesariamente corrompe un Nivel previo —porque al abrir ya se revirtió—, pero sí deja un estado incompleto que actualmente no tiene reconciliación garantizada.

**Corrección:**

Hacer la resolución validada como operación staged/finalizable o atómica con la reaplicación.

Como mínimo debe existir una marca server-side inequívoca de `pending_recompute` y un reintento idempotente real.

Preferencia: misma filosofía que B6-A-08, finalización dentro de la transacción que aplica el nuevo resultado.

---

### B6-A-10 — `officialize-match` no es idempotente desde el endpoint

El script `verify-bloque6.mjs` espera:

> volver a llamar `officialize-match` sobre un partido ya validado → OK idempotente.

Pero la Edge Function hoy corta antes:

`status !== pending_validation => match_not_actionable`

Eso contradice el contrato y el propio test.

**Corrección:**

Si ya está `validated` y existe el resultado aplicado correspondiente:

- devolver OK idempotente;
- nunca duplicar efectos.

---

## 3. CORRECCIONES DE CONSISTENCIA DE NIVEL

### B6-A-11 — `distinct_opponents` no debe excluir automáticamente rivales provisionales

La fórmula V1.5 exige para calibrar:

- 5 partidos computables;
- 3 rivales diferentes computables.

Un partido puede ser computable con un rival sin Nivel gracias a imputación.

El modelo de identidad ya garantiza que un provisional tiene `player_id` persistente.

Por lo tanto, para diversidad:

- un rival provisional identificado por `player_id` SÍ es un rival diferente;
- un slot `NULL / no identificado` NO puede contar como identidad distinta.

La implementación actual deriva rivales únicamente desde `match_level_result_players`, que contiene solo jugadores con Nivel real. Eso puede impedir calibración aunque existan tres rivales reales/provisionales diferentes en partidos computables.

**Corrección:**

Contar rivales por `match_participants.player_id` de partidos con resultado de Nivel aplicado/elegible, usando el lado opuesto al jugador.

Esto no otorga Nivel al provisional; solo reconoce diversidad de rivales.

---

### B6-A-12 — estado `CALIBRADO` no debe forzarse monotónico si desaparece evidencia oficial

Las fuentes maestras definen `CALIBRADO` porque **existen**:

- 5 partidos computables;
- 3 rivales distintos.

Una corrección/anulación/incidencia puede retirar evidencia.

No existe en las fuentes una regla que diga que, una vez alcanzado, el estado queda irreversible aunque los partidos que lo sustentaban dejen de computar.

Por lo tanto:

- para `CALIBRANDO/CALIBRADO` normal, derivar el estado de la evidencia oficial vigente;
- si cae por debajo de 5/3, volver a `CALIBRANDO`;
- `RECALIBRANDO` conserva su semántica propia y no debe mezclarse con esta regla.

No es una nueva decisión de producto: es aplicar literalmente la definición vigente del estado.

---

### B6-A-13 — `last_rated_at` debe representar actividad deportiva computable, no hora de escritura

La fórmula lo define como:

> última actividad que afectó nivel.

Para un partido cargado retroactivamente, `now()` puede estar hasta 14 días desplazado de la actividad real y afecta el decay futuro.

Usar `played_at` de la actividad computable y, ante reversión, recalcular el máximo `played_at` de los resultados todavía aplicados.

---

## 4. Tests que faltan antes de despliegue

Agregar o reforzar:

1. evento `match_delta` puede insertarse con questionnaire fields nulos;
2. params JSONB llegan como arrays reales;
3. reversión restaura `confidence` exactamente;
4. mu cerca de 1.0 y 10.0 revierte por movimiento aplicado real;
5. inactividad:
   - 59 días;
   - 60 días;
   - >60 días;
   - partido de regreso usa confidence efectiva;
   - post-partido no “recupera de golpe” confidence anterior;
6. corrección después de un partido con inactivity decay;
7. Confirmar con más de una revisión pre-validación usa SOLO la revisión vigente;
8. stale revision no escribe;
9. aceptación de corrección es atómica: fallo de cálculo/persistencia no mueve revisión oficial;
10. resolución de identidad no queda “resolved” sin resultado de Nivel finalizado;
11. retry de `officialize-match` sobre validated es idempotente;
12. tres rivales provisionales distintos pueden satisfacer diversidad si los partidos son computables;
13. slot no identificado no cuenta como rival;
14. anular/corregir evidencia puede devolver CALIBRADO → CALIBRANDO;
15. `last_rated_at` se recompone al revertir el último partido;
16. hidden validated continúa computando en estadísticas/Nivel.

---

## 5. Qué NO hace falta cambiar

Se mantienen aprobados:

- `match_level_results` + tabla hija normalizada;
- `match_identity_issues`;
- `notifications`;
- slots `player_id=NULL`;
- motor JS compartido;
- uso de `match-sync.js` como traductor;
- ventana Nivel 30 días desde `played_at`;
- reversión de partido completo al abrir incidencia;
- bloqueo corrección mientras identidad está abierta;
- admin service_role-only sin panel;
- lazy expiration sin cron;
- no tocar Ranking/Intelligence;
- no tocar BRAMUlive.

---

## 6. Estado operativo

**Supabase Staging real NO fue modificado por esta Fase A.**

La revisión central solamente:

- leyó el repo;
- inspeccionó el esquema real actual de Staging;
- verificó contratos y constraints heredados;
- detectó los bloqueos anteriores antes de aplicar cualquier DDL.

Esto es el resultado deseable de la revisión previa: los problemas se encontraron con el backend real todavía intacto.

---

## 7. Próximo paso

Corregir estos puntos en el MISMO chat de Claude Code de Bloque 6 cuando vuelva a estar disponible.

No abrir otro chat.

Claude debe:

1. leer este documento completo;
2. corregir implementación + tests;
3. ejecutar toda la batería local;
4. commit/push solo a `staging`;
5. detenerse.

Después ChatGPT central:

1. revisa el nuevo diff;
2. recién entonces aplica migraciones a Supabase Staging;
3. despliega Edge Functions;
4. ejecuta validación backend real;
5. autoriza Fase B/frontend únicamente con el core en verde.

No hace falta ninguna intervención de producto de Sebastián antes de ese punto.
