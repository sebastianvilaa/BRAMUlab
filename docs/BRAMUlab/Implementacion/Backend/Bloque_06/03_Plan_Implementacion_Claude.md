# Backend Bloque 6 — Plan de implementación (Claude Code)

**Fecha:** 21/09/2026
**Rama:** `staging`
**Depende de:** `02_Analisis_Claude.md` (mismo directorio)
**Estado:** propuesta de plan. **Implementación NO autorizada todavía** — pendiente de revisión de ChatGPT central.

---

## 0. Antes de escribir código

Las dos DECISIONES ABIERTAS de `02_Analisis_Claude.md` §6 deberían resolverse (o aceptarse explícitamente la recomendación) antes del Checkpoint 2, porque cambian el contrato exacto de `officialize_match_validation` y de `resolve_identity_issue`. No bloquean el Checkpoint 1 (esquema), que es neutral respecto de ambas.

---

## 1. AGREGAR

### 1.1 Tablas nuevas

| Tabla | Motivo |
|---|---|
| `match_level_results` | Snapshot reproducible del efecto de Nivel por partido/revisión (§3.3 del análisis). Necesaria para reversión exacta y para no recalcular repetición/compañero/círculo sobre el historial actual al revertir. |
| `match_identity_issues` | Ciclo de vida de una incidencia de identidad por slot (`open`/`resolved`/`unidentified`), con su propio reloj de 7 días. Nunca una fila fantasma en `players`. |
| `notifications` | Bandeja interna server-backed. Contrato de campos ya cerrado en `Backend_Infraestructura.md` §6.7. |

### 1.2 RPCs nuevas (todas `SECURITY DEFINER`, deny-by-default salvo GRANT explícito)

| RPC | Alcanzable por | Necesita Edge Function (motor JS) |
|---|---|---|
| `officialize_match_validation` | `service_role` | Sí — `officialize-match` |
| `propose_post_validation_correction` | `service_role` | Sí — `propose-match-correction` |
| `respond_post_validation_correction` (aceptar) | `service_role` | Sí, si acepta (recalcula) — reusa la rutina compartida de `officialize-match` |
| `respond_post_validation_correction` (rechazar/expiración lógica) | — | No — expiración calculada en lectura, sin escritura |
| `report_identity_issue` | `authenticated` directo | No (abrir la incidencia y revertir el efecto previo no necesita el motor — revertir usa el `match_level_results` ya calculado, no recalcula nada nuevo) |
| `resolve_identity_issue` | `service_role` si el partido está `validated` (recalcula); si sigue `pending_validation`, RPC directa a `authenticated` (solo reemplaza el slot, sin efecto de Nivel todavía) | Solo en el caso `validated` — `resolve-identity-issue` |
| `get_notifications` | `authenticated` | No |
| `mark_notification_read` | `authenticated` | No |
| `admin_annul_match` | `service_role` exclusivo | No (revertir reusa lo ya calculado) |
| `admin_force_resolve` | `service_role` exclusivo | Solo si fuerza una reaplicación de Nivel |

### 1.3 Edge Functions nuevas

- `officialize-match` — contiene la **rutina compartida de oficialización** (fetch snapshot + historial 180 días + adaptación + `PLLevelContext.computeMatchLevelUpdate` + llamada a `officialize_match_validation`). Es el único lugar donde vive esa rutina; `create-or-attach-match` la invoca internamente (ver §2.1), no la duplica.
- `propose-match-correction` — revalida `new_sets` con `engine.js`/`match-load.js` (mismo patrón que `create-or-attach-match`), llama a `propose_post_validation_correction`.
- `respond-match-correction` — si `accept=true`, reusa la rutina compartida de `officialize-match` en modo "corrección" (revierte + reaplica); si `accept=false`, delega a la RPC directa (sin motor).
- `resolve-identity-issue` — solo se invoca cuando el partido corregido está `validated` (reusa la rutina compartida en modo "corrección por identidad"). Si el partido sigue `pending_validation`, el cliente llama directo a la RPC `resolve_identity_issue` sin pasar por Edge Function.

### 1.4 Columnas nuevas sobre tablas existentes (ver también §2 Fusionar)

- `matches.pending_correction_revision_id` (uuid, nullable) — revisión propuesta post-validación en espera, sin mover `current_revision_id` hasta que se acepte.
- `level_events.match_id` (uuid, nullable) y `level_events.match_level_result_id` (uuid, nullable) — trazabilidad de cada delta hasta el partido que lo originó.

### 1.5 Scripts / administración

- `supabase/tests/verify-bloque6.mjs` — mismo patrón que `verify-bloque{2,3,4,5}.mjs`: corre contra Staging real, valida los caminos de §7 del análisis.
- Un script local (`supabase/tests/admin-annul-match.mjs` o similar) que invoca `admin_annul_match`/`admin_force_resolve` con la `service role key`, para uso manual de Sebastián/administración — nunca desde la app.

### 1.6 Frontend (wiring, reutilizando pantallas existentes — Experiencia_Inicial.md §26)

- Detalle del partido: 3 acciones (`Confirmar`/`Proponer corrección`/`No participé`) con la jerarquía visual ya definida (primaria/secundaria/excepcional), reutilizando la pantalla de detalle de Bloque 5.
- Home/Historial: badge nuevo para "corrección propuesta" e "identidad cuestionada", distinto de "pendiente accionable"/"pendiente en espera" ya existentes.
- Notificaciones: cambiar la fuente de datos de la pantalla ya existente de local a `get_notifications`.
- Sección "Modificaciones" del detalle (ya prevista por Bloque 5 vía `match_actions`): sin cambios de diseño, solo nuevos `action_type` que ya van a aparecer ahí automáticamente.

---

## 2. FUSIONAR (extender código/esquema ya existente, sin reabrir su diseño)

| Qué | Cómo |
|---|---|
| `create-or-attach-match` (Edge Function) | Agregado acotado al final: si el resultado de `create_or_attach_match` trae `readyForValidation: true`, invocar internamente la rutina compartida de oficialización antes de responder al cliente. **No se toca la lógica de deduplicación/concurrencia/idempotencia ya validada.** |
| `matches.status` CHECK | Ya incluye `validated`/`annulled` — sin cambio de esquema, solo empieza a escribirse. |
| `matches.validated_at`, `annulled_at`, `annulment_reason` | Columnas ya reservadas por Bloque 5 — empiezan a escribirse, sin migración de columna nueva. |
| `match_actions.action_type` CHECK | Ya incluye `validated`, `identity_questioned`, `participant_replaced`, `correction_timeout_resolved`, `annulled` — sin emisor hasta ahora. Se agregan, como únicos valores nuevos del CHECK, `correction_accepted` y `participant_unidentified` (no cubiertos por los 5 ya reservados). |
| `level_events.event_type` CHECK | Se agregan `match_delta`, `match_correction_reversal`, `match_correction_reapply` — exactamente los que el comentario de la migración de Bloque 3 dejó anticipados. |
| `match_participants.player_id` | Ya nullable — Bloque 6 es quien primero lo pone en `NULL` (slot "por identificar") y quien primero lo reasigna (reemplazo de participante). Sin cambio de esquema. |
| `compute_pending_action_count` | **Sin cambios** — ya excluye correctamente todo lo que no sea `pending_validation` con `action_side` propio (verificado en el análisis, no es una suposición). |
| `get_my_matches` / `get_match_detail` | Se extiende el `jsonb`/las columnas devueltas para incluir `pendingCorrectionRevisionId`, `openIdentityIssue` (resumen mínimo) y, para `get_my_matches`, un filtro opcional `p_only_validated` que alimenta a `stats.js` (§3.7 del análisis) sin crear una RPC nueva paralela. |
| Pantalla de Notificaciones (`app.js`) | Cambia la fuente de datos; la estructura visual/lista ya existente no se rediseña. |

---

## 3. REEMPLAZAR

**Ninguno.** No hay ningún componente de Bloques 1–5 que este plan necesite reemplazar o descartar. Todo lo que Bloque 6 necesita, o ya existe (motor de Nivel, patrón Edge+RPC, columnas reservadas), o se agrega de forma aditiva. Esto es consistente con que Bloques 1–5 están formalmente cerrados y no se reabren.

---

## 4. NO TOCAR

Explícito, por instrucción de esta ronda y por diseño del plan:

- código de la aplicación (`bramulab/*.js`, `index.html`, `styles.css`) — recién en los checkpoints de wiring, y ninguno de ellos corre en esta ronda de análisis;
- ninguna migración SQL existente (`supabase/migrations/2026091*`, `2026092*`);
- Supabase (Staging ni ningún otro proyecto);
- Vercel;
- rama `main`;
- Production;
- BRAMUlive;
- Ranking (Bloque 7 — no se implementa ranking real, solo se preserva la regla de inmutabilidad semanal ya citada por el handoff);
- BRAMU Intelligence / Bloque 8;
- `create_or_attach_match` más allá del agregado puntual descrito en §2 (su lógica de deduplicación/concurrencia/idempotencia no se reabre);
- `level.js`/`level-calibration.js`/`level-context.js`/`engine.js` — el motor matemático no se modifica; Bloque 6 solo lo **llama** con datos server-side adaptados.

---

## 5. Orden de implementación y checkpoints

Cada checkpoint es chico, desplegable en Staging y verificable antes de empezar el siguiente — mismo criterio que ya usaron Bloques 1–5.

### Checkpoint 1 — Esquema base de Bloque 6

**Incluye:** las 3 tablas nuevas (§1.1), las 2 columnas nuevas (§1.4), los nuevos valores de CHECK (§2), RLS deny-by-default en las 3 tablas nuevas (mismo criterio que las 7 tablas de Bloque 5: cero política de SELECT/INSERT/UPDATE/DELETE para `authenticated`/`anon`, lectura exclusivamente vía RPC `SECURITY DEFINER`).

**Terminado cuando:** migración aplica limpio en Staging; `verify-rls.mjs` (o su equivalente extendido) confirma deny-by-default en las 3 tablas nuevas; ninguna tabla/columna existente cambia de comportamiento; suite local y `verify-bloque{2,3,4,5}.mjs` siguen en verde (nada de esto debería tocarlos, es la primera señal de que el checkpoint no tuvo efectos colaterales).

### Checkpoint 2 — Oficialización atómica (núcleo del bloque)

**Incluye:** `officialize_match_validation`, Edge Function `officialize-match` con la rutina compartida completa (fetch + historial 180 días + adaptador Supabase→`level-context.js` + cálculo + escritura con lock/verificación optimista), y el agregado en `create-or-attach-match` que la invoca cuando `readyForValidation=true`.

**Terminado cuando:** los dos caminos de oficialización (`Confirmar` y segunda carga coincidente) producen exactamente el mismo efecto sobre `level_states`/`level_events`/`match_level_results`; reintento de la Edge Function no duplica; dos partidos con jugador compartido oficializados en paralelo no pierden ningún delta ni hacen deadlock; los 4 casos de disponibilidad (4/4, 3/4, 2/4 por pareja, 2/4 misma pareja→no computa) dan el resultado esperado sobre datos reales de Supabase.

### Checkpoint 3 — Corrección post-validación

**Incluye:** `matches.pending_correction_revision_id`, `propose_post_validation_correction` + Edge Function, `respond_post_validation_correction` + Edge Function (camino aceptar, reusa Checkpoint 2), rechazo/expiración lógica en lectura.

**Terminado cuando:** una corrección propuesta dentro de 3 días y aceptada revierte+reaplica exactamente; fuera de 3 días se rechaza sin tocar `level_states`; mientras la propuesta está pendiente, la versión oficial anterior sigue siendo la que cuenta para historial/estadísticas.

### Checkpoint 4 — Incidencias de identidad

**Incluye:** `match_identity_issues`, `report_identity_issue`, `resolve_identity_issue` (con y sin motor según el estado del partido), expiración lógica a los 7 días, manejo del slot "por identificar"/"Jugador no identificado" en `match_participants`.

**Terminado cuando:** `No participé` pre y post-validación funciona con la regla 10+7 exacta; el jugador incorrecto deja de recibir efecto en la misma operación en que se abre la incidencia; resolver dentro de la ventana usa el snapshot correcto (según cómo se resuelva la Decisión Abierta #2); vencida la ventana sin resolución, el slot queda `Jugador no identificado` sin escritura extra y sin volver a ser accionable.

### Checkpoint 5 — Estadísticas oficiales

**Incluye:** extensión de `get_my_matches` (`p_only_validated`), wiring de `stats.js` para consumir esa fuente en vez de `localStorage` para las superficies oficiales (Perfil, Mi Perfil, Perfil público, Home post-primer-partido).

**Terminado cuando:** Efectividad/Racha/Evolución/Mejor compañero/Rival más enfrentado usan exclusivamente partidos `validated`; una corrección/anulación se refleja en la siguiente lectura sin ningún job ni caché a invalidar a mano.

### Checkpoint 6 — Notificaciones internas

**Incluye:** tabla `notifications`, escritura desde cada RPC de negocio de los Checkpoints 2–4, `get_notifications`/`mark_notification_read`, wiring de la pantalla ya existente.

**Terminado cuando:** cada evento de la lista de `Backend_Infraestructura.md` §6.7 (carga, confirmación, corrección propuesta/aceptada, identidad cuestionada, partido validado/expirado) aparece en la bandeja del jugador correspondiente; sin push, solo bandeja interna.

### Checkpoint 7 — Comando administrativo mínimo

**Incluye:** `admin_annul_match`, `admin_force_resolve`, script local de invocación.

**Terminado cuando:** ambas RPC son inalcanzables con un JWT de usuario normal (verificado, no asumido); una anulación revierte el efecto de Nivel si el partido estaba `validated`; queda auditoría completa (actor + motivo) en `match_actions`.

### Checkpoint 8 — Wiring frontend completo de superficies

**Incluye:** las 3 acciones en el detalle del partido, badges nuevos en Home/Historial, contador personal sin cambios (ya correcto), sección Modificaciones alimentada con los `action_type` nuevos.

**Terminado cuando:** un usuario puede completar de punta a punta, en la UI real, los flujos de Confirmar/Proponer corrección/No participé pre y post-validación, sin tocar ninguna pantalla que no necesitaba cambiar (criterio de `Experiencia_Inicial.md` §26: no rehacer componentes que ya funcionan).

### Checkpoint 9 — Verificación real en Staging y cierre

**Incluye:** `verify-bloque6.mjs` contra Supabase Staging real cubriendo la lista completa de `02_Analisis_Claude.md` §7; regresión completa de `verify-bloque{2,3,4,5}.mjs`; suite local completa (baseline a preservar: 1448/1448 más los tests nuevos de Bloque 6); QA de navegador dirigida sobre los mismos casos límite que Bloques 3/5 ya usaron como criterio de cierre.

**Terminado cuando:** todos los criterios de "Terminado cuando" de `Backend_Infraestructura.md` §15 Bloque 6 están cubiertos con evidencia real (no simulada) contra Staging, y se documenta el cierre formal (`Cierre_Bloque_06.md`, mismo formato que `Bloque_05/16_Cierre_Bloque_05.md`).

---

## 6. Riesgos de implementación por checkpoint (complemento de §4 del análisis)

- **Checkpoint 2** es el de mayor riesgo real: si el adaptador Supabase→`level-context.js` (Riesgo 1 del análisis) tiene un error sutil, puede producir un delta matemáticamente válido pero basado en datos de contexto incorrectos (repetición/círculo mal detectados) sin que ningún test de esquema lo note. Mitigación: fixtures de este checkpoint deben cruzar explícitamente contra los casos ya cerrados de `Nivel_BRAMU_Formula_V1.5.md` §14, armados con datos que pasen primero por `create_or_attach_match` real (no construidos a mano en la forma local vieja).
- **Checkpoint 3** depende de que Checkpoint 2 ya tenga la reversión exacta funcionando — no debe empezarse antes.
- **Checkpoint 4** comparte el mismo mecanismo de reversión que Checkpoint 3; el riesgo real (Riesgo 4 del análisis: identidad + corrección simultáneas) se mitiga serializando ambos flujos por el mismo lock de `level_states`, ya diseñado en Checkpoint 2 — no hace falta un mecanismo nuevo, solo no violar esa serialización al implementar Checkpoint 4.
- **Checkpoint 8** es el único con superficie de UI nueva — debe probarse con Browser real contra Staging (mismo criterio que Bloques 3 y 5), no darse por cerrado solo con suite local.

---

*Fin del plan. Pendiente de autorización de implementación por ChatGPT central.*
