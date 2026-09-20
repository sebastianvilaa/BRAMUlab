# Backend Bloque 5 — Plan de implementación
## Partidos compartidos e historial

**Fecha:** 20/09/2026
**Rama:** `staging`
**Depende de:** `02_Analisis_Claude.md` (arquitectura, modelo de datos, decisiones abiertas) — este documento no repite el razonamiento, solo lo secuencia en pasos ejecutables.

Este documento es una receta para la próxima ronda de implementación. No se escribió ninguna migración, ninguna Edge Function, ni se tocó ningún archivo de `bramulab/*.js` en esta ronda — todo lo de acá es la referencia que la próxima ronda debería seguir, no algo ya hecho.

**Antes de empezar a implementar:** las 4 Decisiones Abiertas de `02_Analisis_Claude.md` §13 deberían tener respuesta de Sebastián/ChatGPT (o, para las que tienen recomendación clara y bajo riesgo — #1, #4 — se puede arrancar con la recomendación y ajustar después con una migración chica si hace falta, ya que ninguna de las dos afecta el esquema, solo constantes/lógica interna). La #2 y #3 sí conviene cerrarlas antes de escribir la RPC de create-or-attach, porque cambian ramas de código, no solo un número.

---

## 1. Orden exacto de archivos

### Fase A — Esquema (Supabase, Development primero, luego Staging)

1. `supabase/migrations/<timestamp>_bloque5_matches_core.sql`
   - Crea `matches`, `match_participants`, `match_sets`, `match_revisions`, `match_submissions`, `match_actions`, `match_user_state` (en ese orden, porque hay FKs entre ellas: `match_revisions` referencia `match_submissions`; `matches.current_revision_id` se agrega con un `ALTER TABLE` después de crear `match_revisions`, o se deja la columna sin FK físico documentando la relación lógica si se prefiere evitar la referencia circular — recomiendo la segunda opción para simplicidad: **sin FK físico** en `matches.current_revision_id`, solo `uuid NULL` con un comentario SQL explicando la relación lógica; la integridad la garantiza el hecho de que solo `create_or_attach_match` escribe ambas tablas dentro de la misma transacción).
   - RLS `enable row level security` en las 7 tablas, deny-by-default.
   - Policies de `select` (participante del partido / propia fila en `match_user_state`) — ver la tabla completa de RLS en `02_Analisis_Claude.md` §10.
   - `grant select on <cada tabla> to authenticated` — **no saltear este paso**, es el error ya cometido 2 veces en este proyecto (Bloque 1 §13, Bloque 2 Informe §Bug real).
   - `grant select, insert, update on matches, match_participants, match_sets, match_revisions, match_actions, match_submissions to service_role`.
   - Índices: `matches(participant_fingerprint, format_id, status)`, `matches(played_at)`, `match_participants(player_id)`.
   - Sin seeds, sin datos de prueba en esta migración.

2. `supabase/migrations/<timestamp>_bloque5_rpcs_read.sql`
   - `get_my_matches`, `get_match_detail`, `get_pending_action_count`, `hide_match_for_me`, `set_match_private_note` (o plegar la nota dentro de `hide_match_for_me` con un parámetro opcional — ver §3 más abajo), `list_related_provisional_players` (si se adopta la Decisión #3-A).
   - Todas `SECURITY DEFINER`, `grant execute ... to authenticated` (nunca `anon`).

3. `supabase/migrations/<timestamp>_bloque5_create_or_attach_rpc.sql`
   - `create_or_attach_match` — `SECURITY DEFINER`, `grant execute ... to service_role` únicamente (nunca `authenticated`/`anon`, mismo criterio que `officialize_level_onboarding`).
   - Helper interno `compute_pending_action_count(p_player_id uuid)` (no otorgado a `authenticated`, lo usa tanto la RPC pública `get_pending_action_count` como `create_or_attach_match` internamente).

Separar esta migración de la anterior es deliberado: es la pieza más compleja y la más probable de necesitar un hotfix rápido después de la primera prueba real (mismo patrón que Bloque 4, que terminó con 2 migraciones + hotfixes plegados). Mantenerla aislada facilita corregirla sin re-tocar las RPCs de lectura ya probadas.

### Fase B — Edge Function

4. `supabase/functions/create-or-attach-match/index.ts`
   - Verifica JWT (mismo patrón que `officialize-onboarding/index.ts`).
   - Recibe el payload crudo (participantes por `player_id`, sets crudos `{a,b}` por set, `formatId`, `playedAt` local ya convertido a ISO por el cliente, `timeKnown`, `timeZone`, `location`, `idempotencyKey`, `disambiguation?`).
   - Llama a `Engine.FORMATS`/`Engine.isValidCompletedSetScore` (symlink, ver Fase D) para revalidar formato + score de cada set — nunca confía en un `winnerTeam` que mande el cliente.
   - Llama a `create_or_attach_match` con la service role key, pasando los sets ya normalizados + el `winner_pair` ya calculado.
   - Devuelve el `jsonb` de la RPC tal cual, sin transformarlo (igual que `officialize-onboarding` hace con `officialize_level_onboarding`).

5. `supabase/functions/_shared/engine.js` → symlink real a `bramulab/engine.js` (mismo mecanismo ya usado para `level.js`/`level-calibration.js` — **nunca una copia manual**).

### Fase C — Refactor mínimo de código compartido (antes de la Edge Function, en realidad — ver nota)

> Nota de secuencia: aunque esté numerado después de la Fase B arriba, **conviene hacer este paso ANTES de escribir el `index.ts` de la Edge Function**, porque el `index.ts` va a importar la función nueva.

6. `bramulab/match-load.js` — extraer de `validateMatchDraft` (líneas ~262-304 actuales) una función nueva `validateMatchSets(rawSets, formatId)` que recibe los sets ya recortados (`activeSets`) y el formato, y devuelve `{ok:true, sets, winnerTeam} | {ok:false, reason}` — exactamente la misma lógica que hoy vive inline, sin cambiar ningún comportamiento visible en el navegador. `validateMatchDraft` pasa a llamar a esta función nueva para esa parte, en vez de duplicar el código. Exportar `validateMatchSets` en `global.PLMatchLoad`.
   - Correr `tests.html` después de este refactor puntual — debe seguir en 1408/1408 exacto, es un refactor sin cambio de comportamiento.

### Fase D — Frontend nuevo

7. `bramulab/matches.js` (nuevo módulo, mismo formato que `auth.js`):
   - `PLMatches.isConfigured()` — espejo de `Auth.isConfigured()`.
   - `PLMatches.createOrAttach(payload)` — arma el `idempotencyKey` si no viene, llama la Edge Function con la sesión activa, devuelve el `jsonb` de respuesta.
   - `PLMatches.getMyMatches(...)`, `getMatchDetail(matchId)`, `hideMatchForMe(matchId, hidden)`, `setPrivateNote(matchId, note)`, `getPendingActionCount()`, `listRelatedProvisionalPlayers()` (si aplica).
   - Ninguna persistencia local acá — eso vive en `store.js` (punto siguiente). `matches.js` es puro cliente de red, igual que `auth.js`.

8. `bramulab/store.js` — agregar (nunca tocar lo existente):
   - `KEYS.MATCH_OUTBOX = 'bramulab.matchOutbox.v1'` + `loadMatchOutbox/saveMatchOutboxEntry/removeMatchOutboxEntry`.
   - `KEYS.SERVER_MATCHES_CACHE = 'bramulab.serverMatchesCache.v1'` (cache de lectura de `get_my_matches`, con timestamp de última sincronización — nunca autoridad, solo para que Home/Historial no queden en blanco mientras se resuelve la llamada de red).
   - Ninguna función existente cambia de firma.

9. `bramulab/app.js` — el cambio más grande de esta fase, en el siguiente orden interno:
   1. Nueva función `getEffectiveHistory()` — un único choke point que reemplaza los ~17 call sites de `Store.loadHistory()` (grep exacto antes de tocar nada: `grep -n "Store.loadHistory()" bramulab/app.js`). Devuelve el array combinado (legacy local + servidor traducido + outbox traducido), usando la forma común descrita en `02_Analisis_Claude.md` §8.1.
   2. Reemplazar los call sites uno por uno por `getEffectiveHistory()` — hacerlo en un commit separado del resto, para poder confirmar con `tests.html` que ningún flujo existente (Home, Historial, stats, groups) cambió de comportamiento para una cuenta sin backend, antes de tocar nada del flujo de guardado.
   3. `buildManualMatchSnapshot`/`finalizeManualContinue`/`persistManualSnapshot` — bifurcar: si `Matches.isConfigured()` y hay sesión real, resolver participantes por `player_id` (nuevo selector, punto 4) y llamar `Matches.createOrAttach(...)` en vez de `Store.upsertHistory` directo; manejar cada código de resultado (`created`/`matched_*`/`ambiguous_candidates`/errores) con su pantalla correspondiente. El camino sin backend queda exactamente igual que hoy.
   4. Selector de participantes: reemplazar `computeRecentPlayers`/`computeAllKnownPlayers`/`filterPlayerCandidates` (namespace local por texto) por una versión que, cuando hay backend, resuelve contra `search_players` + `list_related_provisional_players`/`list_my_provisional_players` + `create_provisional_player` (Bloque 4, sin cambios) — devolviendo siempre `{playerId, displayName}`, nunca solo un string. El camino sin backend sigue usando las funciones actuales de `match-load.js` sin cambios.
   5. Botón "Eliminar partido" (`.analysis-delete-btn`, línea ~1886): bifurcar por `f.serverBacked` — local sigue llamando `Store.removeFromHistory`; server-backed llama `Matches.hideMatchForMe(f.matchId, true)`. Revisar copy del botón/modal de confirmación si hace falta un texto distinto para "ocultar" vs. "eliminar" (Backend_Infraestructura §8.8 es explícito: nunca debe parecer un borrado real).
   6. Outbox: al arrancar la app y al recuperar conexión (reusar el punto donde la app ya detecta reconexión, si existe algo hoy — si no existe, agregar un listener simple de `online`), reintentar cada entrada de `bramulab.matchOutbox.v1` con su `submissionId` guardada.

10. `bramulab/index.html`:
    - `<script src="matches.js?v=...">` (agregar al lado de `auth.js`).
    - Markup nuevo mínimo para la pantalla de desambiguación ("¿Es el mismo partido?") — reutilizar la infraestructura genérica de `confirmAction`/modal ya existente en vez de construir un componente nuevo, salvo que la lista de candidatos necesite más de 1-2 líneas por opción (en cuyo caso un sheet simple, mismo patrón visual que `#manual-player-sheet`).

11. `bramulab/sw.js` — bump de versión siguiendo el patrón QUARTET ya establecido (memoria del repo, V03.1.6): `CACHE_NAME`, `?v=` de cada `<script>` tocado en `index.html`, y **`bramulab/store.js: APP_VERSION`** si corresponde a una ronda de producto visible (Backend/Infraestructura históricamente NO incrementa `APP_VERSION`, ver Bloque 2 Informe §1 "`Store.VERSION`/`version.json` NO cambian... esto es un bloque de Backend/Infraestructura, no una ronda nueva de Nivel BRAMU" — mismo criterio para Bloque 5). Agregar `matches.js` a `CORE_ASSETS`.

### Fase E — Tests

12. `supabase/tests/verify-bloque5.mjs` — ver matriz completa en §3 de este documento.

---

## 2. Migraciones previstas (resumen, sin SQL final)

| Archivo | Contenido | Depende de |
|---|---|---|
| `<ts>_bloque5_matches_core.sql` | 7 tablas, RLS, GRANTs, índices | Bloque 1-4 aplicadas |
| `<ts>_bloque5_rpcs_read.sql` | `get_my_matches`, `get_match_detail`, `get_pending_action_count`, `hide_match_for_me`, `set_match_private_note`, `list_related_provisional_players` | `matches_core` |
| `<ts>_bloque5_create_or_attach_rpc.sql` | `create_or_attach_match`, helper `compute_pending_action_count` | `matches_core` |

Ningún hotfix se anticipa por escrito — la experiencia de Bloque 4 (2 rondas de revisión antes de aplicar) sugiere que la primera versión de `create_or_attach_match` probablemente necesite al menos 1 ajuste después de la primera corrida real de `verify-bloque5.mjs`; eso es exactamente por lo que esa RPC vive en su propia migración, separada.

---

## 3. Matriz de `verify-bloque5.mjs`

Mismo estilo que `verify-bloque4.mjs` (fetch directo a REST/RPC, cuentas reales via Admin API, limpieza en 2 fases por dependencias FK). Casos, en el orden recomendado de implementación (los primeros son los que más rápido detectan un problema de esquema/RLS antes de invertir tiempo en la lógica de create-or-attach):

**Seguridad/RLS (primero — igual criterio que Bloque 4)**
1. `anon` no puede llamar `create_or_attach_match`, `get_my_matches`, `get_match_detail`, `hide_match_for_me`, `get_pending_action_count`.
2. `authenticated` no puede leer `match_submissions` directo (tabla REST).
3. Un usuario no participante no puede leer el detalle de un partido ajeno (`get_match_detail` devuelve vacío, no error).

**Camino feliz simple**
4. Partido normal con 4 cuentas registradas — 1 carga, `status=pending_validation`, `action_side` correcto.
5. Registrado + provisional — provisional ocupa un slot, la carga funciona igual.
6. Misma provisional en 2 partidos distintos — mismo `player_id` en ambos `match_participants` (el test literal pedido por Bloque 4/5).
7. Claim posterior de esa provisional conserva la relación en ambos partidos sin migrar ninguna fila.

**Ventanas de tiempo**
8. Carga con `played_at` de hace 20 días → rechazada (`played_at_too_old`).
9. Carga con `played_at` en el futuro → rechazada (`played_at_in_future`).

**Idempotencia**
10. Reintento exacto (misma `idempotencyKey`, mismo payload) → mismo `match_id`, sin fila nueva en `matches`.
11. Mismo `idempotencyKey`, payload distinto → `idempotency_key_reused_with_different_payload`.

**Deduplicación**
12. Dos cuentas cargan independientemente el mismo encuentro (mismos 4 `player_id`, mismo score, formato compatible) → un único `match_id`, segundo resultado `matched_confirmed`, `status=validated`.
13. Carrera concurrente (`Promise.all` de las 2 cargas anteriores en simultáneo, mismo patrón que el test de concurrencia de claim en Bloque 4) → un único `match_id`, sin fila duplicada.
14. Equipos A/B invertidos entre las dos cargas (cada cargador se puso a sí mismo como "Equipo A") pero es el mismo encuentro → igual se reconoce como el mismo `match_id`, score normalizado correctamente.
15. Score diferente en la segunda carga (mismos 4, misma ventana) → no crea partido nuevo; crea una revisión nueva sobre el existente (`matched_revised`), `action_side` pasa al lado que cargó primero.
16. Candidato ambiguo (mismos 4 jugadores, 2 partidos pendientes en ventana compatible) → `ambiguous_candidates`, ningún merge automático; reenvío con `disambiguation` resuelve al candidato correcto.

**Efectos oficiales**
17. Un partido `pending_validation` no aparece en ningún cálculo de `level_states` (verificación negativa: `level_states` del jugador no cambia tras la carga).

**Historial y visibilidad**
18. El partido es visible en `get_my_matches` para los 4 participantes.
19. No es visible para una 5ª cuenta sin relación.
20. `hide_match_for_me` oculta para quien lo pide sin afectar `get_my_matches` de los otros 3.

**Pendientes**
21. `validation_deadline_at` queda fijo en `created_at + 30 días` exactos tras la carga.
22. `get_pending_action_count` refleja correctamente un partido con `action_side` del lado del jugador consultado, y NO cuenta uno donde su lado ya "declaró" (creador/redeclaración del mismo lado).
23. Con 5 pendientes accionables acumulados, una 6ª carga nueva es rechazada con `pending_action_limit_reached` — y una carga que en realidad SE ADJUNTA a un partido existente (no crea uno nuevo) también respeta el mismo bloqueo (se evalúa antes de saber si va a crear o adjuntar).

**Limpieza**
24. Cleanup en 2 fases (dependencias antes que padres) — mismo patrón que `verify-bloque4.mjs`: borrar `match_actions`/`match_sets`/`match_revisions`/`match_submissions`/`match_user_state`/`match_participants` antes que `matches`; borrar `matches` antes que los `players`/cuentas de Auth creadas para el test.

### Qué se prueba automáticamente vs. qué necesita navegador real

**Automatizable (Node, contra Supabase Staging real, sin navegador)**: los 24 casos de arriba — son todos llamadas HTTP a RPC/REST, igual que `verify-bloque4.mjs`.

**Necesita navegador real (Vercel Preview de Staging, manual o vía las herramientas de preview)**:
- Carga offline real (cortar la red del dispositivo, confirmar `PENDIENTE DE SINCRONIZACIÓN`, reconectar, confirmar que sincroniza sin duplicar) — un `fetch` directo no reproduce fielmente el comportamiento de Service Worker/`localStorage` del navegador real.
- La pantalla de desambiguación ("¿Es el mismo partido?") — su existencia y claridad visual, no la lógica de backend que ya cubre el caso 16.
- Que "Eliminar partido" en un partido server-backed efectivamente oculte y no borre, verificado también desde la cuenta del OTRO participante (confirmar que sigue viendo el partido).
- Regresión visual: que una cuenta sin backend (`Auth.isConfigured()===false`) siga viendo Historial/Home exactamente igual que antes de este bloque.

---

## 4. Secuencia de validación recomendada

1. Aplicar `matches_core` en Development (o un proyecto Supabase descartable) → correr un smoke test manual mínimo por SQL Editor (insertar una fila de cada tabla a mano, confirmar constraints).
2. Aplicar `rpcs_read` + `create_or_attach_rpc` en el mismo entorno → correr `verify-bloque5.mjs` completo ahí primero (nunca directo en Staging, mismo criterio que el resto del proyecto: `04_Procedimiento de migraciones` del Informe general).
3. Recién con `verify-bloque5.mjs` en verde en Development, aplicar las 3 migraciones en Staging real, desplegar la Edge Function en Staging, y correr `verify-bloque5.mjs` contra Staging.
4. Validación manual en el navegador real de Staging (los 4 puntos del final de §3) — con al menos 2 cuentas reales distintas (2 dispositivos o 2 navegadores/perfiles), igual que la validación final de Bloque 2/4.
5. Confirmar que la suite local (`tests.html`) sigue en el mismo número (o superior, si se agregaron tests unitarios nuevos para `validateMatchSets` extraído) — nunca menor.

---

## 5. Qué puede hacerse en una sola ronda vs. dónde conviene parar

**Puede hacerse en una sola ronda de implementación** (sin necesitar aprobación intermedia de Sebastián):
- Fase A completa (las 3 migraciones) + Fase B (Edge Function) + Fase C (refactor de `match-load.js`) — es todo código/SQL nuevo, sin tocar ningún flujo visible todavía.
- `verify-bloque5.mjs` completo, corrido contra Development.

**Conviene parar y mostrar resultado antes de seguir:**
- Después de tener `verify-bloque5.mjs` en verde contra Development, ANTES de aplicar nada en Staging real — es el mismo punto de pausa que ya usó Bloque 4 (revisión de arquitectura antes de aplicar).
- Después de aplicar en Staging pero ANTES de empezar la Fase D (frontend) — el frontend es la parte con más superficie de regresión visual (Home/Historial ya funcionan hoy para cuentas locales) y conviene confirmar que el backend se comporta como se espera contra Staging real antes de tocar `app.js`.
- Antes de cambiar el comportamiento del botón "Eliminar partido" — es un cambio de comportamiento visible que amerita una confirmación explícita, no solo un test verde.

**Necesita intervención manual de Sebastián en algún momento:**
- Aplicar las 3 migraciones en Supabase Staging real (mismo procedimiento manual ya usado en Bloques 1-4: pegar en SQL Editor o `supabase db push`).
- Desplegar la Edge Function `create-or-attach-match` en Staging.
- Correr `verify-bloque5.mjs` contra Staging real con las credenciales de ese proyecto (nunca compartidas en el chat).
- Validación manual final con 2 cuentas reales en 2 dispositivos/navegadores.
- Decidir las 4 Decisiones Abiertas de `02_Analisis_Claude.md` §13 (o confirmar las recomendaciones para arrancar).

---

## 6. Notas para quien implemente (evitar repetir errores ya conocidos del repo)

- **GRANT + RLS son capas separadas** — cada tabla nueva necesita las dos cosas, ninguna alcanza sola (Bloque 1 §13, Bloque 2 Informe).
- **Errores de negocio esperables → `jsonb {ok:false,...}` con `return`, nunca `raise exception`** — una excepción revierte toda la transacción, incluido cualquier contador ya incrementado (lección de Bloque 4 hotfix §3).
- **Nunca reimplementar en SQL una regla que ya vive en JS compartido** — usar symlinks reales (`ln -s`), nunca copiar el archivo (lección de Bloque 3).
- **Bump de versión en cuarteto** al tocar `index.html`/`sw.js`: `CACHE_NAME`, cada `?v=` de script, y confirmar si corresponde tocar `store.js: APP_VERSION` (para Backend/Infraestructura, históricamente no) — memoria del repo V03.1.6, causa real de un bug de actualización infinita.
- **`node --check` + `tests.html` (1408/1408) antes y después de cualquier refactor de un archivo compartido** (`match-load.js` en la Fase C) — confirmar que el número no bajó antes de seguir.
- **Nunca migrar automáticamente historial local viejo a `matches`** — Backend_Infraestructura §2 ya lo descarta explícitamente para todo el prototipo, no es una decisión nueva de Bloque 5.
