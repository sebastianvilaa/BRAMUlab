# BRAMUlab — Cierre · Ronda UX funcional 25/09 (clasificación de eventos)

**Rama:** `staging`
**Fecha:** 25/09/2026
**HEAD revisado por central:** `3dee37f`
**Handoff de origen:** `13_Handoff_Implementacion_Ronda_UX_25SEP.md` §G/§I

Ronda correctiva final sobre `15_Correccion_Revision_Central_Ronda_UX_Funcional.md`. Central ya aplicó y verificó `preprod_ux_correction_revision_diff` contra Supabase Staging real (migración confirmada, `verify-preprod-ux-correction-revision-diff.sql` sin excepciones, `previousRevisionSets`/`pendingCorrectionSets` confirmados, permisos correctos, 0 fixtures remanentes) — **esta ronda no toca backend, migraciones ni Supabase**, exactamente como se indicó.

---

## Causa

`paintB6Actions` usaba `currentRevisionNumber > 1` como clasificador de "hay una corrección de resultado pendiente". Eso es incorrecto: el flujo de identidad incorrecta pre-validación (`resolve_identity_issue`/`admin_force_resolve_identity_issue`, ya probado en Laboratorio §15.12) **también** crea una nueva `match_revision` — copia los mismos sets, reemplaza al participante, mueve `current_revision_id` y registra `match_actions.action_type = 'participant_replaced'`. Un reemplazo de identidad como el de Pablito (§15.12) podía terminar con `currentRevisionNumber > 1` sin que existiera ninguna corrección de resultado real, y el receptor recibía falsamente "Se propuso una corrección…" + CTA `ACEPTAR CORRECCIÓN` — exactamente la contradicción que handoff 13 §I prohíbe ("creación ≠ corrección ≠ identidad").

## Corrección

**`bramulab/match-load.js#classifyPendingRevisionEvent(actionsRaw)`** (nueva, pura, exportada en `PLMatchLoad`): clasifica el evento que originó la revisión vigente de un partido `pending_validation` mirando `actionsRaw` (ya ordenadas cronológicamente por `get_match_detail`) desde el final — el **último** evento relevante gana, nunca el número de revisión:

- sin evento relevante (`created` solo, o `actionsRaw` ausente — snapshot de `get_my_matches` sin detalle todavía) → `'original'`;
- último relevante `'revision_proposed'` → `'result_correction'`;
- último relevante `'participant_replaced'` → `'identity_replacement'`.

Acciones no relevantes intercaladas (`confirmed`, `declared_again_same_side`, `identity_questioned`, etc.) nunca rompen la clasificación. Una corrección vieja seguida de un reemplazo clasifica como reemplazo; un reemplazo viejo seguido de una corrección clasifica como corrección — siempre gana el evento más reciente.

`bramulab/app.js#paintB6Actions` reemplaza `isCorrectionPending` (booleano, basado en `currentRevisionNumber`) por `pendingEventType = ML.classifyPendingRevisionEvent(f.actionsRaw)`, con 3 ramas explícitas tanto para el lado que debe actuar como para el lado que espera.

### Actor para reemplazo de identidad

Nueva función `b6ParticipantReplacedActorName(f)` (app.js), deliberadamente **sin** el fallback a la pareja genérica que sí tiene `b6RevisionProposerName` (sin tocar esa función, sigue igual para `result_correction`): busca la última acción `participant_replaced`, resuelve `actorPlayerId` contra `f.players`. `null` si no puede resolverse con certeza — el copy queda neutro, sin nombrar a nadie, nunca inventa un actor.

---

## UX resultante

| Caso | Copy (lado que actúa) | CTA | Diff | Copy (lado que espera) |
|---|---|---|---|---|
| **Carga normal** (`original`) | `Te toca confirmar este resultado.` | `CONFIRMAR PARTIDO` | — | `Esperando que {pareja} confirme este resultado.` |
| **Corrección de resultado** (`result_correction`) | `{Actor} propuso una corrección en este partido. Revisá el resultado actualizado antes de aceptar.` | `ACEPTAR CORRECCIÓN` | `previousRevisionSets → sets` | `Corrección enviada. Esperando que {pareja} la acepte.` |
| **Reemplazo de identidad** (`identity_replacement`) | `{Actor} corrigió un participante de este partido. Revisalo antes de confirmar.` (o neutro sin actor) | `CONFIRMAR PARTIDO` | ninguno | `Participante corregido. Esperando que {pareja} confirme el partido.` |

No se identifica visualmente qué slot cambió en un reemplazo (ampliaría backend, fuera de esta mini-ronda, como se indicó). El objetivo cumplido es que el tipo de evento nunca se mienta.

La rama `validated` (post-validación) **no se tocó**: `pending_correction_revision_id` es un puntero exclusivo de `propose_post_validation_correction` (resultado), nunca de identidad post-validación (que usa `match_identity_issues`, un mecanismo completamente separado, ya expuesto vía `openIdentityIssues`) — no existía ambigüedad ahí, confirmado por lectura de código antes de descartar un cambio.

---

## Recientes — defensa pequeña

`bramulab/app.js#renderManualPlayerSheetContentServerBacked`: si `Matches.listRelatedProvisionalPlayers()` **o** `Auth.listMyProvisionalPlayers()` devuelven `ok:false`, RECIENTES no se renderiza en esa carga del sheet (`provisionalById` queda incompleto, sin forma confiable de excluir invitados). INVITADOS/búsqueda siguen manejando sus propios estados de error sin cambios. Sin RPC nueva, sin retry.

Sin test dirigido para esta defensa puntual: vive enteramente en la orquestación de `app.js` (sin cobertura unitaria por diseño, ver rondas anteriores) — agregar uno exigiría extraer la condición a un módulo puro solo para testear un `if` de una línea, lo que sería sobrearquitectura para el tamaño real del cambio. Verificado por lectura de código y por el boot smoke test.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/match-load.js` | `ML.classifyPendingRevisionEvent` (nueva, pura) |
| `bramulab/app.js` | `paintB6Actions` reemplaza `isCorrectionPending` por la clasificación real; `b6ParticipantReplacedActorName` (nueva); defensa de RECIENTES ante fallo de provisionales |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h4` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h4` |
| `bramulab/version.json` | `bundle` → `04.11-h4` |
| `bramulab/index.html` | bump de `?v=` en todos los `<script src>`/`<link>` |
| `bramulab/tests.html` | 10 aserciones nuevas `EVT-CLASS ·` |

Sin cambios en backend, migraciones, Supabase, `bramulive/`, `main`, Production, Mis grupos, responsive, Nivel, Ranking, Notificaciones completas, carrusel visual ni Historial no-visto.

---

## Tests

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS**.
- `bramulab/tests.html` → **1506/1506 PASS** (1496 previas + 10 `EVT-CLASS ·` nuevas): sin `actionsRaw` ⇒ `original`; carga original; último relevante `revision_proposed` ⇒ `result_correction`; último relevante `participant_replaced` ⇒ `identity_replacement`; corrección vieja + reemplazo después ⇒ gana el reemplazo; reemplazo viejo + corrección después ⇒ gana la corrección; acciones irrelevantes intercaladas no rompen la clasificación (2 variantes); el escenario de Laboratorio §15.12 nunca clasifica como `result_correction`; una corrección real nunca clasifica como `identity_replacement`.
- Boot smoke test: `index.html` con bundle `04.11-h4`, todos los módulos 200 OK, mismo único 404 preexistente (`env.generated.js`, esperado sin Supabase configurado en este entorno local).

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h3` → **`04.11-h4`**.
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Sin QA visual real de los 3 casos | `classifyPendingRevisionEvent` está cubierta por 10 tests puros, pero el copy/CTA resultante nunca se vio en pantalla contra un reemplazo de identidad real en Staging | Pendiente de QA (Work/iPhone), mismo motivo ya documentado en las dos rondas anteriores — sin acceso a Staging desde este sandbox |
| Reemplazo sin identificar visualmente el slot cambiado | Por diseño de esta mini-ronda (evitar ampliar backend) — el usuario sabe que "alguien corrigió un participante" pero no cuál exactamente antes de abrir el Resumen completo | Aceptado explícitamente en las instrucciones de esta ronda; el Resumen ya muestra los 4 participantes reales debajo |
| Defensa de RECIENTES sin test dirigido | Vive en `app.js`, sin cobertura unitaria por diseño | Verificado por lectura de código + boot smoke; no se justifica extraer un módulo nuevo para un `if` de una línea |

---

## Decisiones abiertas

Ninguna decisión de producto nueva.

---

## Qué debe revisar ChatGPT central

HEAD de `staging` (diff + este documento). Si queda limpio, autorizar la Ronda 2 visual del handoff 13.

No se pidió nada a Sebastián. Frenado después del push.
