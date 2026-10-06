# 130 — Resultado · Rediseño de Recuperados + validación rápida + Partidos pendientes (V04.33)

**Fecha:** 05/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.33** · bundle **04.33-h1** · **Base:** `e06fcab` · **HEAD final:** el commit de esta ronda (`git log -1`; el hash se informa al cerrar).
**Fuente de alcance:** handoff `129_Handoff_Rediseno_Recuperados_Pendientes_V0433_05OCT.md` + Issue #29. **No se tocó** `main`, Production, BRAMUlive, la fórmula de Nivel, Ranking publicado/histórico, Grupos, Legal, Team A/B canónicos del backend ni la deduplicación ya cerrada.
**Estado:** implementado y probado **localmente** (suite + replay limpio de migraciones + verificación en navegador contra un mock de Supabase). La migración **no está aplicada** en Staging (sin credenciales en este entorno): la aplica Central. **No hay Edge Functions nuevas ni redeploys.**

## 1. Qué cambió (producto)

| Punto del handoff | Resultado |
|---|---|
| `SÍ, SOY YO` = recuperación automática | Se eliminó la revisión obligatoria partido por partido (`SÍ, LO JUGUÉ`/`NO, NO LO JUGUÉ`, `TERMINAR REVISIÓN`, tarjeta de Home `REVISÁ TUS PARTIDOS RECUPERADOS`). La mecánica del vínculo en servidor **no cambió**. |
| `¿SOS X?` enriquecido | Muestra el **partido que originó la invitación**, parejas con foto/nombre/`@usuario`, identidad invitada resaltada, score orientado desde su pareja y `+ N partidos más asociados a X`. `NO, NO SOY YO` intacto (no consume el link). |
| Pantalla full-screen post-claim | `RECUPERAMOS N PARTIDOS` (sin barra inferior). Accionables = los `POR VALIDAR` del lote, **todos** en scroll con validación rápida; `VER LOS N RECUPERADOS`; `OMITIR` siempre disponible; sin accionables → `ENTRAR A BRAMU`. Gate de 5 no aplica al claim. |
| `Historial > Recuperados` | Pestaña temporal tras `Todos`, **30 días** desde la recuperación, ventana **fijada por el servidor**. Al vencer desaparece la pestaña; los partidos siguen en `Todos`. Las cards `POR VALIDAR` del lote usan la validación rápida (y quedan como card normal ya validadas). |
| Notificación al reclamante | `RECUPERAMOS N PARTIDOS` / `Los partidos que estaban registrados como X ya están en tu historial.`; al tocarla abre `Historial > Recuperados`. La del invitador (`identity_claimed`) se conserva. |
| Validación rápida (componente único) | `buildQuickMatchCard` sirve a Pendientes, Recuperados y la pantalla post-claim. `REPORTAR UN ERROR` (outline rojo, izq.) / `VALIDAR PARTIDO` (verde, der.); cuerpo abre el Resumen y al volver se restaura lista (pestaña + scroll). Feedback `✓ PARTIDO VALIDADO` inline ~0,9 s (sin modal, borde nunca verde), contracción y las demás suben; error real conserva la card; anti doble tap. |
| `Historial > Pendientes` | 3 secciones: `POR VALIDAR` → `POR RESOLVER` → `ESPERANDO VALIDACIÓN` (sin acciones ni párrafo redundante). Contadores/secciones/estado vacío se actualizan sin repintar la lista. |
| Home | Carrusel superior **solo accionable**; `ESPERANDO VALIDACIÓN` fuera. Card ancha `PARTIDOS PENDIENTES` (ámbar, 3 columnas, antes de `BUSCAR JUGADORES`, oculta con total 0) → `Historial > Pendientes`. |
| Gate de 5 | Misma regla; `VER PARTIDOS PENDIENTES` abre la lista con validación rápida: validar uno ⇒ queda en 4 ⇒ puede cargar. |
| Lenguaje | `POR VALIDAR` / `ESPERANDO VALIDACIÓN` / `POR RESOLVER` / `JUGADOR POR IDENTIFICAR` reemplazan `TU TURNO: CONFIRMAR`, `IDENTIDAD CUESTIONADA` y `PENDIENTE DE VALIDACIÓN` (UI; enums/estados internos intactos). |

## 2. ¿Hacía falta backend? Qué se reutilizó y qué se agregó

Se inspeccionó el modelo antes de agregar nada (criterio §14 del handoff):

- **Fecha/lote de recuperación:** ya existía (`player_identity_recoveries.completed_at` + `recovered_match_ids`) → **sin tabla nueva**; solo una RPC de lectura.
- **POR VALIDAR / POR RESOLVER / ESPERANDO:** ya derivables del cliente desde `get_my_matches` (`isActionMine`, `hasOpenIdentityIssue`, corrección activa) → **sin estado nuevo ni RPC**. Una única función pura (`PH.classifyPendingCategory`) alimenta Home, Historial y el gate.
- **Partido origen de la invitación:** **no** existía (`create_claim_link` no recordaba el partido; la vista previa mostraba el más reciente) → cambio mínimo.
- **Notificación al reclamante:** no existía → trigger mínimo.

Migración **forward-only y aditiva** `supabase/migrations/20261005200000_v0433_recuperados_pendientes.sql`:

1. `provisional_claims.source_match_id` (nullable, `on delete set null`) + `create_claim_link(uuid, uuid default null)` (se reemplaza la firma vieja con `drop function`, no overload, para no dejar la llamada por nombre ambigua; ACL idénticas: `authenticated`, sin `anon`). El origen se valida (invitador **y** provisional figuran en él, no anulado); si no es coherente se ignora **sin fallar**.
2. `preview_claim_link`: usa el origen si sigue vigente, si no cae al más reciente; devuelve `sourceIsOrigin`, `@usuario` y **ruta** de avatar solo de cuentas registradas activas, `isInvitee` por lugar y `matchCount`. Sigue sin exponer ids de partido ni de terceros.
3. `get_my_recent_recoveries(p_days default 30)`: lotes `completed` del propio caller dentro de la ventana (solo el target los lee).
4. `identity_recovered`: tipo agregado al `notifications_type_check` + trigger `AFTER INSERT/UPDATE OF status` sobre `player_identity_recoveries` (solo al target, solo con ≥1 partido, idempotente). `claim_provisional_player` **no se modificó**.

**Para aplicar (Central):** correr la migración en Staging y luego `supabase/tests/verify-v0433-recuperados-pendientes.sql` (BEGIN/ROLLBACK). **Orden de despliegue tolerante:** si el frontend se despliega antes que la migración, `createClaimLink` detecta que la firma con `p_source_match_id` no existe y **reintenta sin el origen** (el link se genera igual; solo falta el contexto), y la pestaña `Recuperados`/la notificación simplemente no aparecen hasta aplicarla. Aun así, conviene aplicarla antes de la QA humana.

## 3. Pruebas

| Prueba | Resultado |
|---|---|
| Node `bramulab/*.test.mjs` | **839 tests · 838 pass · 1 fail** (ver abajo). Baseline previo: 826 · 823 pass · 3 fail. |
| Nuevo `v0433-recuperados-pendientes.test.mjs` | **19/19**: derivación de categorías, buckets/contadores, carrusel sin espera, card de Home (ejecutada con DOM mínimo), copy unificado, validación rápida **ejecutando `qvValidate` real** (match exacto, ✓ inline sin toast, refresco→contracción, doble tap = 1 sola oficialización, error real conserva la card, `confirmed_not_ready` no finge éxito), anatomía/borde, navegación Resumen↔lista, secciones y gate (5→4), pestaña Recuperados (existe solo dentro de la ventana; el historial no cambia), pantalla post-claim (footer 1/5/8 accionables, OMITIR), `¿SOS X?` (HTML ejecutado), invitación con origen, notificación (`mapB6Notification` ejecutada), migración estática, regresión Team A/B. |
| `tests.html` (navegador) | 1496/1504 — **mismos 8 fallos `V034-*` que HEAD** (1495/1503), dependientes de la fecha (semana actual de Grupos); no tocados. Se actualizó 1 bloque (carrusel sin espera). |
| Backend: replay limpio de migraciones (PGlite, ACL strict/observed/open) | PASS (81 migraciones, 35 chequeos ×3); `release-check` PASS. |
| Backend: `verify-v0433-recuperados-pendientes.sql` (PGlite) | PASS: origen coherente/incoherente/anulado, preview con origen vs más reciente, `@usuario`/avatar sin ids, notificación solo al reclamante e idempotente, `get_my_recent_recoveries` (solo target, ventana 30 d, dato intacto al vencer), ACL, sin overload viejo. |
| `verify-g3-identity-recovery.sql` (regresión identidad/claim) | PASS (actualizado: `sourceIsOrigin` en L5 y firma nueva en el chequeo de ACL). |
| `supabase/functions/_shared` + `supabase/scripts` tests | 98 · 92 pass · 6 skipped (sin cambios). |
| Verificación visual/E2E en navegador | App real (`index.html`) contra un **mock** de Supabase (temporal, borrado): Home con card `2/2/1` y carrusel sin espera; Pendientes en 3 secciones; validar ⇒ `✓` ⇒ contracción ⇒ pestaña 5→4; error mockeado conserva la card; Resumen↔lista (scroll y pestaña restaurados); `REPORTAR UN ERROR` abre el selector del Resumen; pestaña Recuperados; notificación abre Recuperados; pantalla post-claim (1 accionable → validar → `ENTRAR A BRAMU`, intención limpiada); modal `¿SOS MARIANO?` con partido de origen. |

**Único fallo de Node: `h23`** (`h19-visual-final-adjustment.test.mjs`, "flujo inicial dice VALIDAR…"). **Preexistente** (falla igual en `e06fcab`): asserta copy que ya no existe en el código (`PARTIDO POR VALIDAR</p>`, `Revisalo y validá el partido.`). No se tocó por no ser regresión de esta ronda. Los otros 2 fallos del baseline (`h19-B`, `h21-9`) eran un bug de test/código (`now instanceof Date` entre realms `vm` caía al reloj real): se corrigió con duck-typing en `hasActiveCorrectionWindow`.

## 4. Archivos

- Frontend: `bramulab/app.js`, `player-home.js`, `auth.js`, `index.html`, `styles.css`; versionado `store.js`, `version.json`, `sw.js`, `manifest.webmanifest`, `tests.html`.
- Backend: `supabase/migrations/20261005200000_v0433_recuperados_pendientes.sql`; `supabase/tests/verify-v0433-recuperados-pendientes.sql` (nuevo) y ajuste menor de `verify-g3-identity-recovery.sql`.
- Tests: nuevo `v0433-recuperados-pendientes.test.mjs`; actualizados los que fijaban la revisión por partido o el copy viejo (`v0430`, `v0431`, `v0429`, `h17`, `h19`, `h20`, `h21`) + sustitución mecánica de versión en los de versionado.
- Docs: `README.md`, `Experiencia_Inicial.md` (§15.4), `Implementacion/Pre_Production/README.md`, este informe.

## 5. DECISIONES ABIERTAS / criterios tomados (no bloquean)

1. **`POR RESOLVER` incluye toda incidencia de identidad abierta** y toda corrección activa, aunque `get_my_matches` no distingue quién puede actuar (mismo límite que ya tenía el carrusel). Quien propuso una corrección también ve `POR RESOLVER`; el detalle real (aceptar/rechazar vs. espera) sigue resolviéndose en el Resumen.
2. **La pantalla post-claim lista solo `POR VALIDAR`** del lote como "necesitan tu respuesta" (los `POR RESOLVER` quedan en `Pendientes`/Home). Si Producto quiere sumarlos, es un cambio acotado en `recoveredActionableRows`.
3. **Links de invitación anteriores a V04.33** no tienen origen: `¿SOS X?` cae al partido más reciente con el copy anterior (`X registró este partido con ese nombre`). El origen solo queda guardado para links nuevos generados desde `INVITAR` en el Resumen.
4. **Posición de la pestaña `Recuperados`:** justo después de `Todos` (visibilidad especial). Fácil de mover.
5. **Las cards de validación rápida no ofrecen el long-press de ocultar** de la lista normal (se puede ocultar desde `Todos`/`Recuperados`).
6. **Gate vs. card de Home:** el gate de 5 sigue contando lo que cuenta el servidor (`pending_validation` donde me toca, incluso si además tiene una incidencia de identidad abierta), mientras que la card de Home/Pendientes clasifica ese caso como `POR RESOLVER`. Resolver la identidad también libera el gate; no se tocó la regla server-side.
7. El texto de la línea de meta del Resumen pasó de `Pendiente de validación` a `Por validar` / `Esperando validación` según quién deba actuar.

## 6. Qué NO se verificó

- **Staging real:** la migración no está aplicada; nada se probó contra el Supabase real ni con un claim real de punta a punta (el mock cubre UI/lógica de cliente, no RLS/triggers reales; esos corrieron en PGlite).
- **iPhone físico / PWA instalada** (animación de contracción, scroll, safe-area de la pantalla completa) y **Service Worker real** (el pane no registra SW).
- Avatares reales firmados en `¿SOS X?` (se probó el fallback de iniciales y el cableado; la firma por lote es el mismo `resolveAvatarUrlsBatch` ya usado en otras pantallas).

## 7. QA humano mínimo restante (handoff §15)

1. Un claim real con 2–3 partidos: modal enriquecido (partido de origen) + pantalla `RECUPERAMOS N PARTIDOS`.
2. Un partido ya validado entra sin pregunta individual (y se refleja en el historial).
3. Un pendiente accionable se valida desde la card rápida y desaparece.
4. Home: card `PARTIDOS PENDIENTES` + destacados superiores solo accionables.
5. `Historial > Pendientes`: secciones y copies; gate de 5 → validar uno → vuelve a 4.
6. `Historial > Recuperados` visible + notificación abre Recuperados.
7. Humo móvil de scroll/animación.


## 8. Gate Central en Staging — 05/10/2026

Central revisó la entrega y completó el backend pendiente sobre **Supabase Staging**:

- migración `20261005200000_v0433_recuperados_pendientes.sql` aplicada con éxito;
- migration history registra `v0433_recuperados_pendientes`;
- verificación transaccional `verify-v0433-recuperados-pendientes.sql`: **PASS / V04.33 verify OK**;
- verificados en Staging real:
  - `provisional_claims.source_match_id`;
  - `create_claim_link(uuid, uuid)`;
  - `get_my_recent_recoveries(integer)`;
  - trigger `player_identity_recoveries_notify_target`;
  - constraint de notificaciones con `identity_recovered`.
- deploy Vercel del commit funcional `3c7d80ad32ba4831aadc1b860dee7dde907706ee`: **SUCCESS**.

**Gate técnico Central: PASS.** No se detectó un bloqueo técnico nuevo en la revisión. Resta únicamente el QA humano corto definido en §7; no repetir la batería histórica de Invitados.

Production sigue prohibida.
