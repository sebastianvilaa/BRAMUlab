# Backend Bloque 6 — Revisión final pre-Staging

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `76cfccf392abbdb48e8e65cbaca1dbd283a7ea89`  
**Resultado:** **NO DESPLEGAR todavía a Supabase Staging**

Claude corrigió correctamente los puntos B6-B-01 a B6-B-07 de `08_Revision_Central_Adicional.md`.

Además, ChatGPT central ejecutó las **8 migraciones actuales de Bloque 6 contra el esquema real de Supabase Staging dentro de una única transacción `BEGIN ... ROLLBACK`**. La secuencia SQL compiló completa y sin errores de dependencias. Después se verificó que ninguna migración B6 quedó aplicada: el último migration real sigue siendo Bloque 5.

Esta revisión final encontró problemas funcionales adicionales que no aparecen en una simple compilación SQL. No son decisiones nuevas de producto.

---

## C-01 — Corrección/reaplicación todavía puede pisar efectos de partidos posteriores

### Problema

`match-level-engine.js#computeLevelStateUpdates` revierte el efecto anterior y luego aplica el resultado nuevo, pero todavía mezcla:

- el snapshot histórico usado por la fórmula;
- el estado LIVE actual, que puede incluir partidos posteriores.

Casos problemáticos:

1. **confidence**: `confidenceAfterApply = newP.confidenceAfter` es un valor absoluto calculado desde el snapshot histórico. Si después del partido original el jugador disputó otros partidos, asignar ese valor directamente borra la confianza ganada posteriormente.

2. **mu cerca del clamp 1/10**: sumar `newP.deltaCapped` al LIVE revertido no equivale necesariamente a aplicar el nuevo efecto real del partido.

Ejemplo:
- snapshot original `mu=9.95`;
- delta calculado `+0.20`;
- efecto real original/nuevo tras clamp = `+0.05`;
- si luego el estado LIVE cambió por otros partidos, sumar nuevamente `+0.20` altera esos efectos posteriores.

Esto contradice Nivel V1.5 §12.3:

> revertir exactamente el efecto anterior + recalcular con los mismos snapshots previos + aplicar solamente la diferencia neta, sin cascada.

### Corrección requerida

Persistir y reutilizar dos referencias distintas por jugador:

1. **snapshot de fórmula** inmutable:
   - `formula_mu_before`;
   - `formula_confidence_before`;
   - `formula_state`;

2. **baseline LIVE original del partido**:
   - `original_live_mu_before`;
   - `original_live_confidence_before`;
   - `original_live_evidence_units_before`.

Para un resultado nuevo:

- `new_mu_effect = new_formula_mu_after - original_live_mu_before`;
- `new_confidence_effect = new_formula_confidence_after - original_live_confidence_before`;
- `new_evidence_effect = new_formula_evidence_after - original_live_evidence_before`;

y luego:

- `final_live = current_live - old_applied_effect + new_effect`.

El efecto posterior de otros partidos debe permanecer intacto.

Para un participante incorporado por corrección de identidad:

- reconstruir su estado RAW histórico inmediatamente anterior a la oficialización original;
- usar ese estado como baseline LIVE original;
- aplicar decay solamente a la referencia de fórmula;
- aplicar el efecto neto contra su estado LIVE actual.

### Tests obligatorios

- corregir un partido antiguo después de que el jugador disputó otro partido: el segundo efecto queda intacto;
- resolver identidad después de un partido posterior: los efectos posteriores quedan intactos;
- corrección con `mu` cerca de 1.0 y 10.0;
- inactividad + partido + partido posterior + corrección/reversión: round-trip exacto.

---

## C-02 — `Confirmar` puede saltarse autoridad por pareja y faltan guards server-side

### Problema

En `officialize-match/index.ts`:

- si `action_side === callerTeam`, registra la conformidad;
- pero si `action_side` pertenece a la OTRA pareja, el flujo actual puede caer igualmente en `officializeMatch(..., 'initial')`.

Eso permitiría que el lado que ya propuso la revisión intente oficializar sin la conformidad rival.

Además, el núcleo SQL todavía necesita defensa en profundidad para:

- deadline de 30 días vencido;
- incidencia de identidad abierta;
- partido pendiente no realmente listo.

### Corrección requerida

Preferencia: crear una **confirmación B6 nativa por pareja** y dejar de reconstruir un `create_or_attach_match` para el botón Confirmar.

La operación debe:

1. verificar caller participante;
2. bloquear match;
3. exigir `status='pending_validation'`;
4. exigir `validation_deadline_at > now()`;
5. exigir revisión esperada vigente;
6. exigir que `action_side = caller_team`;
7. exigir que no exista incidencia de identidad `open`;
8. insertar una única acción `confirmed`;
9. dejar `action_side=NULL`;
10. devolver `readyForValidation=true`;
11. invocar el mismo núcleo único de oficialización.

Si `action_side` pertenece a la otra pareja: rechazar `not_actionable`/equivalente.

En `officialize_match_validation(trigger='initial')`, bajo lock:

- permitir primera oficialización solo si `action_side IS NULL`;
- deadline vigente;
- no open identity issue;
- revisión correcta;
- composición admisible;
- si ya está `validated`, solo permitir retorno idempotente de un resultado inicial ya existente; nunca crear uno nuevo.

### Tests obligatorios

- lado proponente no puede validar antes que el rival;
- caller del lado accionable confirma y oficializa;
- pending + `action_side=NULL` + deadline vencido NO oficializa;
- open identity issue NO oficializa;
- retry sobre validated sigue siendo idempotente.

---

## C-03 — Fingerprint centinela no evita duplicados durante una incidencia de identidad

### Problema

Cuando un slot queda NULL, `_bloque6_refresh_participant_fingerprint` cambia el fingerprint a:

`bloque6_unidentified:<match_id>`

Eso evita una coincidencia falsa, pero B5 busca candidatos por igualdad exacta de fingerprint.

Por lo tanto una carga normal con cuatro IDs:

- no coincide con el centinela;
- encuentra 0 candidatos;
- puede crear un segundo `match_id`.

Puede ocurrir tanto con:

- los participantes correctos;
- la identidad incorrecta anterior.

### Corrección requerida

Antes de CREAR un partido nuevo en `create_or_attach_match`, agregar guard B6-aware:

- buscar partidos temporalmente/formato compatibles con slot `NULL` y una incidencia `open` o terminal `unidentified`;
- comparar los tres participantes conocidos + estructura de pareja disponible;
- si existe coincidencia inequívoca, **NO crear** otro partido;
- devolver código explícito, por ejemplo `identity_resolution_required`, con `matchId`;
- si existen varios candidatos plausibles, devolver ambigüedad; nunca fusionar a ciegas.

El estado terminal `Jugador no identificado` tampoco debe permitir duplicar silenciosamente el encuentro.

### Tests obligatorios

- carga con los cuatro IDs correctos mientras issue=open no crea duplicado;
- carga con la identidad vieja tampoco crea duplicado;
- issue terminal `unidentified` tampoco crea duplicado;
- ambigüedad entre dos candidatos no fusiona.

---

## C-04 — Un reemplazo de identidad puede invertir el orden léxico de parejas y romper attach/score

### Problema

Bloque 5 define A/B al crear un partido mediante orden léxico de las pair keys.

Después de un reemplazo de identidad:

- las etiquetas A/B almacenadas deben permanecer estables;
- pero el nuevo `player_id` puede cambiar cuál pair key sería lexicográficamente menor si se recalculara desde cero.

`create_or_attach_match` hoy recalcula la orientación desde los IDs del nuevo envío antes de comparar score/caller_team.

El fingerprint unordered puede coincidir correctamente, pero la orientación A/B puede quedar invertida frente al match ya existente.

### Corrección requerida

Para el camino **attach a un candidato existente**:

- no inferir A/B nuevamente por orden léxico;
- mapear pair1/pair2 del envío contra los `match_participants` YA almacenados;
- derivar desde esa comparación:
  - cuál pair enviada es team A;
  - caller_team;
  - orientación del score.

El orden léxico se mantiene exclusivamente para:

- crear un partido NUEVO;
- producir el fingerprint canónico.

No reescribir las etiquetas A/B de un match existente.

### Test obligatorio

Elegir un replacement player_id que provoque flip del orden léxico de parejas y demostrar que una carga posterior:

- converge al mismo match;
- orienta score correctamente;
- confirma el lado correcto.

---

## C-05 — `admin_force_resolve_identity_issue` es insegura/incompleta para partidos validados

### Problema

La RPC administrativa actual:

1. cambia participante;
2. cierra issue;
3. devuelve `needsRecompute=true`.

Pero no existe una orquestación administrativa que ejecute después el motor JS.

Peor: una vez cerrado el issue, `officialize_match_validation(trigger='identity_resolved')` exige que siga `open`, por lo que el camino normal ya no puede finalizarlo.

Un fallo/interrupción puede dejar:

- identidad resuelta;
- Nivel todavía suspendido;
- sin camino idempotente seguro para completar.

### Corrección requerida

Para match `validated`:

- la vía admin debe ser **staged**, igual que la resolución normal;
- primero autoriza el override (ignorando 7 días, con actor+motivo);
- NO muta participante ni cierra issue todavía;
- ejecuta shared core con el replacement;
- la transacción final:
  - reasigna slot;
  - refresca fingerprint;
  - reaplica Nivel;
  - cierra issue;
  - guarda actor/motivo de admin.

Implementación mínima aceptable:

- script/Edge orchestration exclusivamente service-role para agentes autorizados;
- sin panel;
- Sebastián nunca manipula secrets.

Para pending puede mantenerse más simple, pero debe conservar revisión/auditoría/fingerprint coherentes.

### Tests obligatorios

- admin resolve validated termina issue+participante+Nivel coherentes;
- fallo simulado antes de finalización deja issue `open` y no un estado parcial;
- usuario normal no puede ejecutar la vía admin.

---

## C-06 — Corrección de score vuelve a calcular factores contextuales que deberían quedar congelados

### Problema

Para `correction_accepted`, `match-officialize-core.ts` vuelve a leer historial actual y reconstruye:

- repetición;
- compañero;
- círculo competitivo;
- disponibilidad/contexto.

Pero una corrección de resultado debe usar los **mismos snapshots/inputs previos** del partido original.

Si después del partido original se corrigió/anuló otro encuentro histórico, recalcular esos factores durante una corrección de score puede cambiar el peso del partido por una razón ajena al score.

### Corrección requerida

Exponer desde el primer resultado del partido y congelar para `correction_accepted`:

- `repetition_factor_a/b`;
- `companion_factor_a/b`;
- `availability_factor` (composición no cambia);
- `known_levels_count`;
- `circle_factor` original por jugador;
- cualquier otro input contextual que no dependa del score.

Durante score-only correction:

- mismos player formula snapshots;
- mismos factores contextuales;
- solo recalcular lo que realmente cambia por score/resultado:
  - ganador;
  - margen;
  - deltas resultantes.

Una corrección de identidad sí puede recalcular lo dependiente de la nueva composición, siempre en el marco temporal original.

### Test obligatorio

Modificar/anular historial anterior después de la oficialización original y luego corregir solo el score: los factores contextuales del partido corregido permanecen idénticos a los originales.

---

## C-07 — `Jugador no identificado` terminal pre-validación no puede confirmarse

### Problema

Después de 7 días, un slot puede quedar legítimamente:

`Jugador no identificado`

con `player_id=NULL`.

El producto establece que esto no invalida automáticamente el encuentro.

Sin embargo el endpoint `officialize-match` actual reconstruye un `create_or_attach_match` y rechaza si cualquiera de los cuatro slots no tiene player_id:

`unidentified_slot_present`

Eso deja al partido sin camino normal para alcanzar oficial aunque la incidencia ya haya terminado.

### Corrección requerida

La confirmación B6 nativa propuesta en C-02 debe permitir:

- incidencia ya terminal `unidentified` (NO open);
- caller identificado del lado accionable;
- confirmación de la revisión vigente por pareja;
- oficialización posterior con el motor de Nivel.

El motor ya posee reglas V1.5 para faltante de Nivel/identidad:

- si sigue siendo computable, aplica Level a quienes corresponda;
- si no, el partido puede quedar oficial sin efecto de Nivel.

No fabricar identidad.

### Tests obligatorios

- issue prevalidation vence → terminal unidentified;
- integrante registrado del lado accionable confirma;
- match queda validated;
- si cumple V1.5 computa con disponibilidad reducida;
- si no cumple, queda oficial con `eligible=false`.

---

## C-08 — La bandeja de Notificaciones no implementa todavía las tareas accionables reales

### Problema

Existe la tabla `notifications`, pero no existe producción real de `pending_review` para el partido pendiente inicial.

Además, las filas persistidas tipo:

- `correction_proposed`;
- `identity_questioned`;

no desaparecen automáticamente cuando el compañero resuelve la tarea.

La fuente maestra define:

- el pendiente accionable debe existir también en Notificaciones;
- se conserva mientras haya tarea;
- cuando uno de los integrantes de la pareja la resuelve, desaparece para ambos.

### Corrección recomendada — simple para piloto

Derivar las **tareas accionables en lectura** dentro de `get_notifications`, en lugar de persistirlas como mensajes históricos.

Unir:

### A. tareas sintéticas actuales

1. `pending_review`
   - match pending;
   - deadline vigente;
   - caller team = action_side.

2. `correction_proposed`
   - match validated;
   - corrección pendiente;
   - caller pertenece al lado que debe responder;
   - ventana de 3 días vigente.

3. `identity_questioned`
   - incidencia open;
   - caller es participante habilitado.

Estas tareas:

- desaparecen automáticamente al resolverse el estado;
- aparecen para ambos integrantes registrados de la pareja correspondiente;
- no pueden eliminarse prematuramente simplemente marcándolas como leídas.

### B. notificaciones persistidas informativas

Conservar tabla para:

- match_validated;
- correction_accepted/rejected si corresponde;
- identity_resolved/unidentified;
- admin_action;
- otros eventos ya consumados.

Evitar duplicar una misma tarea como sintética + persistida.

El payload sintético debe contener lo mínimo para la UI:

- matchId;
- actor relevante si existe;
- revisionId / issueId cuando corresponda.

### Tests obligatorios

- pending inicial aparece para ambos integrantes del lado accionable;
- uno confirma → desaparece para ambos;
- correction task aparece al lado respondiente y desaparece al resolver;
- identity task desaparece al resolver;
- ninguna incidencia/corrección post-validación entra en el límite de 5 pendientes de carga.

---

## C-09 — El Nivel inicial no inicia el reloj de inactividad

### Problema

Bloque 3 deja `level_states.last_rated_at = NULL` después del cuestionario.

B6 interpreta NULL como:

> no hay decay posible todavía.

Entonces un usuario puede crear su Nivel inicial, no jugar durante meses y recién después disputar su primer partido sin ninguna reducción de confidence por inactividad.

Eso contradice Nivel V1.5 §10.3.

### Corrección requerida dentro de migraciones B6

No modificar la migración histórica ya aplicada de Bloque 3.

En una migración B6:

1. backfill para estados ya inicializados:
   - si `last_rated_at IS NULL`;
   - tomar `level_events.initial_estimate.created_at`;

2. extender `officialize_level_onboarding` desde B6 para que nuevos Nivel iniciales guarden:
   - `last_rated_at = now()` al oficializar el cuestionario;

3. en `get_player_level_state_as_of`, para `initial_estimate` devolver:
   - `lastRatedAt = level_event.created_at`.

El cuestionario es el primer instante que establece un estado de Nivel; desde allí comienza el reloj de incertidumbre.

### Tests obligatorios

- primer partido a día 59: sin decay;
- primer partido después de día 60: decay correcto;
- decay aplicado una sola vez.

---

## C-10 — Corrección pendiente vencida debe desaparecer lógicamente

### Problema

`pending_correction_revision_id` puede continuar físicamente no-NULL después de los 3 días hasta que alguien intente responder.

No debe seguir mostrándose como tarea activa.

### Corrección

Resolver dentro de C-08 sin cron:

- las tareas sintéticas solo existen mientras `validated_at + 3 days > now()`;
- las lecturas de match pueden exponer `hasActiveCorrection` derivado, o la Fase B puede interpretar el deadline;
- no materializar un cron solo por esto.

---

# Validación ya realizada por ChatGPT central

Antes de esta revisión:

- las 8 migraciones B6 actuales fueron ejecutadas contra **Supabase Staging real** dentro de:
  - `BEGIN`;
  - migraciones 1→8;
  - `ROLLBACK`;
- la secuencia compiló completa sin errores;
- se verificó después que **ninguna** migración B6 quedó registrada ni persistida;
- el esquema real sigue cerrado en Bloque 5.

Por lo tanto la próxima ronda NO necesita gastar tiempo intentando demostrar nuevamente sintaxis básica SQL offline.

Debe concentrarse en los problemas funcionales C-01 a C-09; C-10 se resuelve junto con C-08.

---

# Alcance operativo de la próxima corrección

## SÍ

- editar migraciones B6 originales aún no aplicadas;
- tocar `match-level-engine.js`;
- tocar shared core / Edge Functions B6;
- tocar de forma acotada la lógica de attach de Bloque 5 únicamente para C-03/C-04;
- agregar RPC B6 de confirmación por pareja;
- implementar orquestación admin mínima segura;
- corregir notifications derivadas;
- ampliar `verify-bloque6.mjs`;
- tests locales dirigidos;
- commit/push solo a `staging`.

## NO

- aplicar Supabase real;
- desplegar Edge Functions;
- Vercel;
- main;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence;
- UI/UX final;
- reabrir decisiones de producto ya cerradas.

---

# Resultado esperado

No hay ninguna DECISIÓN ABIERTA de producto.

Después de esta corrección:

1. tests locales dirigidos verdes;
2. un único informe breve de resultado;
3. respuesta final corta;
4. detenerse.

ChatGPT central hará una revisión enfocada de C-01…C-10 y, si queda verde, recién entonces:

- aplicará migraciones en Supabase Staging;
- desplegará Edge Functions;
- ejecutará verificación backend real;
- revalidará regresión de Bloque 5;
- limpiará fixtures de QA;
- autorizará Fase B/frontend.
