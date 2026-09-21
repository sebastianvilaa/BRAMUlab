# Backend Bloque 6 — Plan de implementación (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**Depende de:** `02_Analisis_Claude.md` (mismo directorio)
**Revisión central:** `04_Revision_ChatGPT.md` — **APROBADO CON AJUSTES OBLIGATORIOS**, incorporados en esta versión del plan.
**Estado:** plan de Fase A (implementación técnica en `staging`, sin aplicar a Supabase real). No queda ninguna decisión de producto pendiente antes de implementar (`04_Revision_ChatGPT.md` §13).

---

## 0. Qué cambia respecto de la versión anterior de este plan

- Las dos decisiones abiertas quedaron resueltas (ver `02_Analisis_Claude.md` §6) — ya no bloquean ningún checkpoint.
- `match_level_results` se diseña **normalizada** (tabla de cabecera + tabla hija por jugador), no como un único `jsonb`, para poder derivar `rated_matches`/`distinct_opponents` por consulta directa en vez de contadores incrementales.
- Se agrega `evidence_units`/`confidence_origin` a `level_states` (Riesgo 6 del análisis) — necesario para que la reversión de `confidence` sea exacta.
- El adaptador Supabase → `level-context.js` es mucho más chico de lo estimado: `bramulab/match-sync.js` (Bloque 5) ya hace la mayor parte de esa traducción y se reutiliza tal cual.
- La reversión de una incidencia de identidad es de **partido completo**, no de un jugador — cambia el diseño de `report_identity_issue`/`resolve_identity_issue`.
- El vencimiento de una incidencia (7 días) y los avisos temporales de notificaciones se **materializan de forma idempotente** en la primera lectura/acción posterior, no quedan como estado puramente derivado.
- La rutina compartida de oficialización se extrae como **módulo `.ts` importado**, nunca una llamada HTTP Edge→Edge.
- Checkpoint de estadísticas: se elimina — no hace falta ningún cambio, `buildComputableHistory` ya está wireada y va a empezar a incluir partidos `validated` solos.
- El comando administrativo es explícitamente para uso de un agente/entorno autorizado, no para que Sebastián maneje una `service role key`.

---

## 1. AGREGAR

### 1.1 Tablas nuevas

| Tabla | Motivo |
|---|---|
| `match_level_results` | Cabecera de un cálculo de Nivel para un partido/revisión: factores de equipo, `reasonCodes`, versión de algoritmo, `effect_status` (`applied`/`reverted`), encadenada a la que revierte/reemplaza. |
| `match_level_result_players` | Una fila por jugador **conocido** afectado por ese resultado (invitados/no identificados nunca tienen fila): snapshot antes/después, delta, factores individuales. Permite calcular `rated_matches`/`distinct_opponents` por consulta directa, sin contadores incrementales que puedan desincronizarse con una reversión. |
| `match_identity_issues` | Ciclo de vida de una incidencia de identidad por slot (`open`/`resolved`/`unidentified`), con su propio reloj de 7 días. |
| `notifications` | Bandeja interna server-backed (contrato ya cerrado en `Backend_Infraestructura.md` §6.7). |

### 1.2 Columnas nuevas sobre tablas existentes

- `level_states.evidence_units numeric not null default 0` — evidencia acumulada ponderada (§2/§10 de la fórmula), necesaria para revertir `confidence` con diferencia neta en vez de aproximarla.
- `level_states.confidence_origin numeric` — la `b` de origen (camino rápido/completo) que la fórmula usa como base de `confidence = b + (0.95-b)(1-exp(-evidence_units/5.5))`. Backfill seguro desde `confidence` actual (a evidencia 0, `confidence == b`).
- `matches.pending_correction_revision_id uuid` (nullable, sin FK físico — mismo criterio que `current_revision_id`) — revisión propuesta post-validación en espera, sin mover `current_revision_id` hasta que se acepte.
- `level_events.match_id uuid` (nullable, FK a `matches`) y `level_events.match_level_result_id uuid` (nullable, FK a `match_level_results`) — trazabilidad de cada delta hasta el partido que lo originó.

### 1.3 Extensiones de CHECK sobre columnas existentes

- `match_actions.action_type` — se agregan `correction_accepted` y `participant_unidentified` (los 5 valores que Bloque 5 ya había reservado — `validated`, `identity_questioned`, `participant_replaced`, `correction_timeout_resolved`, `annulled` — no alcanzan para distinguir "corrección post-validación aceptada" y "slot terminado sin identificar" de las demás transiciones).
- `level_events.event_type` — se agregan `match_delta`, `match_correction_reversal`, `match_correction_reapply`, `identity_reassignment_delta` — exactamente los que el comentario de la migración de Bloque 3 dejó anticipados.

### 1.4 RPCs nuevas (todas `SECURITY DEFINER`, deny-by-default salvo GRANT explícito)

| RPC | Alcanzable por | Motor JS (vía Edge Function) |
|---|---|---|
| `get_player_match_history_for_level_engine(player_ids uuid[])` | `service_role` | No (solo lectura) |
| `officialize_match_validation(...)` | `service_role` | Sí — es quien la llama |
| `propose_post_validation_correction(...)` | `service_role` | Sí (revalida sets) |
| `respond_post_validation_correction(match_id, accept)` | `service_role` | Solo si `accept=true` (la Edge Function llama después a la rutina compartida) |
| `report_identity_issue(match_id, team, position, reason)` | `authenticated` directo | No — revertir usa `match_level_results` ya calculado |
| `resolve_identity_issue(issue_id, replacement_player_id \| force_unidentified)` | `service_role` si el partido está `validated` (recalcula); `authenticated` directo si sigue `pending_validation` | Solo en el caso `validated` |
| `get_notifications()` / `mark_notification_read(id)` | `authenticated` | No |
| `admin_annul_match(match_id, actor_label, reason)` | `service_role` exclusivo | No |
| `admin_force_resolve(...)` | `service_role` exclusivo | Solo si fuerza una reaplicación |

### 1.5 Módulos JS compartidos nuevos (pure, cero DOM/localStorage — mismo criterio que `level.js`/`level-context.js`)

- `bramulab/match-level-engine.js` (Etapa C de Nivel BRAMU): ventana de 30 días desde `played_at`, mapeo `level_states.status` ↔ `Level.STATES`, reconstrucción determinística de "estado de un jugador a una fecha" (orden `(created_at, event_id)`), referencia sintética única para un slot no identificado, y el cálculo de **diferencia neta** por jugador entre un resultado anterior y uno nuevo (revert+reapply). Es el único código nuevo que faltaba: la traducción de forma Supabase→local ya la resuelve `match-sync.js` (Bloque 5), y la matemática de Nivel (incluida repetición/compañero/círculo) ya la resuelve `level.js`/`level-context.js`.

### 1.6 Símlinks nuevos hacia Edge Functions (mismo mecanismo que los 4 ya existentes)

- `supabase/functions/_shared/level-context.js` → `bramulab/level-context.js` (no estaba symlinkeado — Bloque 3/5 no lo necesitaban).
- `supabase/functions/_shared/match-sync.js` → `bramulab/match-sync.js`.
- `supabase/functions/_shared/match-level-engine.js` → `bramulab/match-level-engine.js`.

### 1.7 Módulo compartido de orquestación (Deno/TS, no symlink — vive directamente en `_shared/`)

- `supabase/functions/_shared/match-officialize-core.ts` — la rutina única de oficialización: fetch (match/participantes/revisión/sets/`level_states`/historial), adaptación (reusa `PLMatchSync`/`PLLevelContext`/`PLMatchLevelEngine`), cálculo, y llamada a `officialize_match_validation` con reintento acotado ante `stale_level_snapshot`. Se **importa**, nunca se llama por HTTP, desde `officialize-match`, `respond-match-correction`, `resolve-identity-issue` y el agregado en `create-or-attach-match`.

### 1.8 Edge Functions nuevas

- `officialize-match` — expone la rutina compartida para el trigger `Confirmar` explícito.
- `propose-match-correction` — revalida `new_sets` con `engine.js`/`match-load.js`, llama a `propose_post_validation_correction`.
- `respond-match-correction` — llama a `respond_post_validation_correction`; si acepta, invoca la rutina compartida en modo corrección.
- `resolve-identity-issue` — llama a `resolve_identity_issue`; si el partido está `validated` (resolución normal o vencimiento materializado), invoca la rutina compartida.

### 1.9 Scripts / tests

- `bramulab/match-level-engine.test.mjs` — `node --test`, mismo patrón que `env-guard.test.mjs`, carga los módulos compartidos vía `vm` (mismo mecanismo que `verify-nivel-parity.mjs`) para no envolverlos en ningún formato de módulo distinto al que ya usa `index.html`.
- `supabase/tests/verify-bloque6.mjs` — mismo patrón que `verify-bloque{2,3,4,5}.mjs`, contra Staging real. Se entrega el código; **no se ejecuta esta ronda** (no hay migraciones aplicadas ni Edge Functions desplegadas todavía).

---

## 2. FUSIONAR (extender código/esquema ya existente, sin reabrir su diseño)

| Qué | Cómo |
|---|---|
| `officialize_level_onboarding` (RPC, Bloque 3) | Agregado mínimo: además de lo que ya persiste, guarda `confidence_origin = p_confidence` y `evidence_units = 0` en el mismo `UPDATE`. Sin cambio de firma, sin cambio de comportamiento observable para Bloque 3. |
| `create-or-attach-match` (Edge Function) | Agregado acotado al final: si el resultado de `create_or_attach_match` trae `readyForValidation: true`, importa e invoca la rutina compartida de `match-officialize-core.ts` antes de responder al cliente. **No se toca la lógica de deduplicación/concurrencia/idempotencia ya validada.** |
| `matches.status` CHECK | Ya incluye `validated`/`annulled` — sin cambio de esquema, solo empieza a escribirse. |
| `matches.validated_at`, `annulled_at`, `annulment_reason` | Columnas ya reservadas por Bloque 5 — empiezan a escribirse, sin migración de columna nueva. |
| `match_participants.player_id` | Ya nullable — Bloque 6 es quien primero lo pone en `NULL` (slot no identificado) y quien primero lo reasigna. Sin cambio de esquema. |
| `get_my_matches` / `get_match_detail` | Se extiende el resultado con `pendingCorrectionRevisionId` y un resumen mínimo de incidencia de identidad abierta (`openIdentityIssue`), para que Home/Historial puedan mostrar los badges nuevos. **No se toca el filtro de `hidden` existente ni se agrega ningún parámetro que reduzca lo que ya devuelve.** |
| `compute_pending_action_count` | **Sin cambios** — ya excluye correctamente todo lo que no sea `pending_validation` con `action_side` propio (verificado en el análisis). |
| `bramulab/match-sync.js` | **Sin cambios de comportamiento** — es la pieza que Bloque 6 reutiliza tal cual, tanto client-side (ya wireada) como, por su forma pura sin DOM, symlinkeada server-side para construir el `engineInput`. |

---

## 3. REEMPLAZAR

**Ninguno.** Confirmado tras la revisión central: nada de Bloques 1–5 se descarta o reabre. Todo lo nuevo es aditivo sobre el esquema/motor ya cerrado.

---

## 4. NO TOCAR

- `bramulab/level.js` / `level-calibration.js` / `level-context.js` / `engine.js` / `match-load.js` / `match-sync.js` (bodies) — el motor y el traductor ya cerrados; Bloque 6 los **llama**, no los reescribe.
- lógica interna de `create_or_attach_match` más allá del agregado puntual descrito en §2.
- ninguna migración SQL existente (`20260916*`…`20260921033000`).
- frontend de pantalla (`index.html`, `styles.css`, wiring de botones/vistas en `app.js`) — es Fase B, explícitamente fuera de esta ronda.
- Supabase real (ninguna migración de esta ronda se aplica), Vercel, `main`, Production, BRAMUlive, Ranking, Intelligence.

---

## 5. Checkpoints internos (control técnico propio, no 9 handoffs)

Fase A se ejecuta de punta a punta sin pedir aprobación entre checkpoints, salvo que aparezca una decisión abierta nueva y material, un bloqueo técnico real, o una autorización sensible — ninguno de los tres apareció durante esta implementación (ver cierre).

1. **Esquema base** — tablas nuevas, columnas nuevas, CHECKs extendidos, RLS deny-by-default, símlinks.
2. **Módulo JS compartido `match-level-engine.js`** — ventana de 30 días, mapeo de estados, reconstrucción histórica determinística, diferencia neta. Testeado localmente con `node --test` antes de tocar SQL/Edge Functions que dependan de él.
3. **`officialize_match_validation` + `match-officialize-core.ts` + `officialize-match`** — núcleo de oficialización atómica (primera validación).
4. **Agregado en `create-or-attach-match`** — segundo trigger de oficialización, mismo núcleo.
5. **Corrección post-validación** — `propose_post_validation_correction`, `respond_post_validation_correction`, Edge Functions asociadas.
6. **Incidencias de identidad** — `match_identity_issues`, `report_identity_issue`, `resolve_identity_issue`, materialización idempotente del vencimiento.
7. **Notificaciones** — tabla + RPCs de lectura/escritura + emisión desde cada RPC de negocio de los checkpoints 3–6.
8. **Comando administrativo** — `admin_annul_match`, `admin_force_resolve`.
9. **Lecturas extendidas** — `get_my_matches`/`get_match_detail` con los campos nuevos.
10. **Verificación local completa** — `node --check` en todo lo nuevo/tocado, `node --test` del motor, redacción de `verify-bloque6.mjs` (sin ejecutar contra Staging real).

No hay checkpoint de "estadísticas oficiales": confirmado en el análisis que no requiere ningún cambio nuevo (§3.7).

---

## 6. Qué queda para Fase central / Fase B (fuera de esta ronda)

- aplicar las migraciones nuevas a Supabase Staging real y desplegar las Edge Functions nuevas/modificadas;
- correr `verify-bloque6.mjs` contra Staging real;
- extender `bramulab/matches.js` con wrappers cliente de las nuevas RPCs y wirear los botones/pantallas reales (`Confirmar`/`Proponer corrección`/`No participé`, badges de Home/Historial, pantalla de Notificaciones) — Fase B explícita, no esta ronda;
- QA de navegador real dirigida sobre los recorridos nuevos.

---

*Fin del plan. Fase A ejecutada según este documento — ver el cierre de la ronda para el detalle de archivos y resultado de las verificaciones locales.*
