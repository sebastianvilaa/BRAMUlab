# BRAMUlab — Ronda correctiva post-QA 26SEP

**Rama:** `staging`
**Fecha:** 26/09/2026
**HEAD base (aprobado por central):** `fb34b14`
**Origen:** handoff "BRAMUlab — RONDA CORRECTIVA POST-QA 26SEP", a partir de §15.24 de `05_Laboratorio_UX_Uso_Real.md` ("Mapa de pendientes tras QA final 04.11-h7").

No se reabrió el Laboratorio ni se repitieron pruebas ya evidenciadas por Sebastián — esta ronda corrige directamente los 6 puntos ya reportados, en el orden de prioridad del handoff. Nota de numeración: el handoff pedía `21_...md`; el siguiente número real disponible en este directorio es `20` (no existe un `20_` previo) — se usó ese.

---

## 1. Login — falso onboarding de Nivel (P0)

### Causa real

`Auth.fetchOwnProfile()` (`auth.js`) lee `profiles` + `level_states` en paralelo. Si la lectura de `level_states` fallaba de forma transitoria (red/RPC), la función igual devolvía un usuario válido con `levelState: null` — **exactamente la misma forma** que una cuenta genuinamente sin Nivel. `resumeServerSession()` (`app.js`) no tenía forma de distinguir "no hay level_state" de "no lo pudimos leer", así que una cuenta ya oficializada (ej. `@seba_qa`, CALIBRADO real en Staging) podía terminar en `resumeSignupProfileStep()/resumeDraftFlow()` como si fuera una cuenta nueva — el síntoma real reportado ("entra al onboarding, sale y reingresa, entra bien").

### Fix

- `auth.js#fetchOwnProfile`: agrega `levelStateReadFailed: !!levelError` al objeto devuelto — `true` **solo** cuando la query a `level_states` erroró, nunca cuando la fila genuinamente no existe (0 filas sin error sigue siendo el caso excepcional ya documentado: trigger que no corrió).
- `app.js#resumeServerSession`: si `levelStateReadFailed`, reintenta `fetchOwnProfile()` **una vez** (blip transitorio típico); si sigue fallando, trata la sesión como "no pudimos leer el perfil" (mismo camino que `!serverUser`: error de login o `bootDefaultScreen()` con el cache local existente) — **nunca** llama a `resumeSignupProfileStep`/toca `signupDraft` por una falla de lectura. Una cuenta realmente `PENDIENTE` (sin error, sin fila) sigue retomando el onboarding exactamente igual que antes.
- Mismo criterio para login manual y restauración de sesión — ambos pasan por `resumeServerSession`.

Solución pequeña y acotada: no se reescribió `Auth`, solo se agregó el flag y el guard.

---

## 2. Resumen — alineación real en iPhone (REABIERTO)

### Causa real

El fix de V02.6 convertía `.result-card__row` en un grid **por fila** — dos grids independientes (uno por equipo) dentro de `.result-card`, cada uno resolviendo su propia columna `auto` a partir de su propio contenido. Con el mismo número de sets en ambos equipos (siempre el caso) los dos anchos coinciden en la práctica, pero nada en la especificación de CSS Grid garantiza que dos grids **distintos** redondeen igual ese track en todos los motores — no se pudo reproducir el corrimiento píxel a píxel en Chromium en este sandbox, pero la estructura en sí era la parte frágil que el handoff pedía inspeccionar ("grid/flex anidado").

### Fix

`.result-card__row` pasa a `display:contents`: las dos filas (nombre + sets de cada equipo) quedan como hijos **directos** de un único grid real, `.result-card__rows` (`grid-template-columns: minmax(0,1fr) auto`). Ahora hay **una sola** resolución de columnas para ambas filas — estructuralmente imposible que diverjan, en vez de depender de que dos grids independientes coincidan por casualidad de contenido simétrico. El padding/borde entre equipos (que vivía en `.result-card__row`, sin caja propia con `display:contents`) se movió a las celdas (`.result-card__name`/`.result-card__sets`, borde-top solo en las de `data-team="B"`).

Sin cambios de layout/diseño del Resumen — mismo look exacto, verificado con captura del render real (2 sets, 3 sets, 3 sets con Tie break) contra `styles.css` real.

---

## 3. Corrección de resultado — paridad visual con Cargar partido

### Estado previo

Ronda 1 ya compartía el validador (`ML.validateMatchSets`/`ML.isThirdSetVisible`) pero la interacción seguía siendo una grilla de `<input type="number">` — se sentía como "otra herramienta", no como "editar el resultado que ya cargué".

### Fix

El editor de corrección (`#propose-correction-scrim`) reemplaza la grilla de inputs por la **misma composición visual** de Cargar partido: marcador acumulado (`.court-accumulated`) + set en edición con números grandes tocables (`.court-current-set`/`.court-score`) + teclado numérico dedicado (reutiliza las clases `.load-keypad__grid`/`.load-keypad__key`, sin el `position:fixed` de pantalla completa — el editor vive en una hoja, no en una vista propia).

El **estado de orquestación** (`b6Correction*` en `app.js`) es un espejo deliberadamente más simple del de Cargar partido (`manual*`): mismo patrón tap→teclado→auto-avance→set siguiente, mismas funciones puras reutilizadas (`ML.canExtendSetDigits`, `ML.computeValidNextDigits`, `ML.resolveActiveSetIndex`, `ML.isThirdSetVisible`, `E.isValidCompletedSetScore`) — nunca una segunda gramática de resultado. No se copió la lógica de selección de jugadores de Cargar partido (no aplica: acá los 4 participantes ya están fijos).

Sin cambios en: revisiones append-only, ventanas de corrección, aceptación de corrección, contrato backend (`MV.proposeMatchCorrection`/`Matches.createOrAttach` intactos).

---

## 4. Fila compacta server-backed de jugador

### Causa real

- **Buscar Jugadores**: `search_players` nunca seleccionó `profiles.avatar_url` (a diferencia de `get_public_profile`, que sí lo agregó en P0.1C) — no era una foto perdida, era una columna que la RPC nunca trajo.
- **RECIENTES** (Cargar partido): la única fuente era el historial local (`match-sync.js`), que solo aporta `{player_id, nombre}` — nunca username/Nivel/avatar server-backed.

### Fix

- Migración `20260927120000_preprod_ux_players_compact.sql`: `search_players` suma `avatar_url`; nueva RPC batch `get_players_compact(p_player_ids uuid[])` (mismas exclusiones que `search_players`/`get_public_profile`: registrado, activo, con username; tope 50 ids).
- `auth.js`: `searchPlayers` y la nueva `getPlayersCompact` resuelven **todos** los avatares del lote con **una sola** llamada `createSignedUrls` (nunca `createSignedUrl` por fila) — nueva `resolveAvatarUrlsBatch`.
- `app.js`: nueva función única `buildCompactPlayerRowHTML(p)` — reemplaza `buildPlayerRowHTMLFromServerRow` y `buildRecentRealPlayerRowHTML` (retirada). Avatar real con fallback a iniciales (`data-has-photo`, mismo patrón que `.player-card__avatar` de Home/Perfil); username/Nivel reales o `—` honesto, nunca inventados. RECIENTES ahora llama `Auth.getPlayersCompact` **una vez** con los `player_id` ya conocidos y quita el subtítulo redundante "Jugaron juntos antes".
- `styles.css`: `.player-row__avatar` gana el interruptor `data-has-photo`/`.player-row__avatar-img`, reutilizando el mismo patrón ya usado en `.player-card__avatar` — cero clases nuevas de layout.

---

## 5. Mis Jugadores / Agregar Jugador — server-backed real

### Producto (confirmado por el handoff)

Lista privada personal, unilateral (el otro jugador nunca se entera), reversible, sin afectar Nivel/Ranking/Mi red, solo jugadores registrados reales, sin auto-agregado, orden más-reciente-primero.

### Backend

Migración `20260927130000_preprod_ux_mis_jugadores.sql`:
- Tabla `player_saved_players` (`owner_player_id`, `saved_player_id`, `created_at`, PK compuesta, `check` anti auto-agregado). RLS habilitada, **cero políticas** (deny-by-default, mismo patrón que `players` desde Bloque 1) — todo acceso vía RPC `SECURITY DEFINER`.
- `save_player(p_saved_player_id)` — idempotente, `{ok:false, code:cannot_save_self|player_not_found}` para los 2 casos de negocio esperables (nunca excepción sin capturar).
- `remove_saved_player(p_saved_player_id)` — idempotente, siempre `{ok:true}`.
- `list_saved_players()` — más reciente primero; mismas exclusiones aplicadas **en la lectura** (un jugador guardado que luego se dio de baja/quedó inactivo deja de listarse, pero la relación **no se borra sola**).
- `is_player_saved(p_player_id)` — lookup liviano por índice para Perfil público.

### Frontend

- Pestaña JUGADORES vuelve a mostrarse para cuentas server-backed (`renderJugadoresTabServerBacked`, cache local para que el buscador de la pestaña filtre en memoria, sin una llamada por tecla).
- AGREGAR JUGADOR vuelve a Perfil público server-backed (`Auth.isPlayerSaved` en paralelo con `Auth.getPublicProfile`, mismo `Promise.all`); si ya estaba agregado, la misma fila se convierte en "ELIMINAR DE JUGADORES" (mismo patrón visual que el camino legacy).
- Ambos caminos usan `buildCompactPlayerRowHTML` (punto 4) y abren Perfil público **por `player_id`**.
- El camino local/legacy (`Store.loadAddedPlayers`/`addPlayerToList`/`removePlayerFromList`, por nombre) queda **completamente intacto** — nunca se migran ni se leen esos datos desde el camino server-backed; ambos coexisten, cada cuenta usa el suyo según `user.serverBacked`.

---

## 6. Notificaciones — título por evento

`B6_NOTIF_COPY` (`app.js`) — solo los títulos que describían el **estado normal** del partido en vez del **evento**:

| type | título anterior | título nuevo |
|---|---|---|
| `match_validated` | "Partido oficial" | **"Resultado confirmado"** |
| `identity_questioned` | "Identidad cuestionada" | **"Participante cuestionado"** |
| `identity_resolved` | "Identidad resuelta" | **"Participante corregido"** |
| `identity_unidentified` | "Jugador no identificado" | **"Participante no identificado"** (consistencia de vocabulario con los 2 anteriores) |

`pending_review`/`correction_proposed`/`correction_accepted`/`match_expired`/`admin_action` ya describían el evento — sin cambios. El body (actor/rivales/score/contexto h7), `selfCaused`, read/unread y el click al partido **no se tocaron**.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/auth.js` | `fetchOwnProfile` (`levelStateReadFailed`), `searchPlayers`/nueva `getPlayersCompact` (avatar batch), nuevas `savePlayer`/`removeSavedPlayer`/`listSavedPlayers`/`isPlayerSaved`, nueva `resolveAvatarUrlsBatch`, `__resetClientForTests` (hook de test) |
| `bramulab/app.js` | `resumeServerSession` (retry+guard), `buildScoreCardHTML` (`.result-card__rows`), editor de corrección reescrito (`b6Correction*`), `buildCompactPlayerRowHTML` (nueva, reemplaza 2 funciones), RECIENTES/Buscar Jugadores/JUGADORES/Perfil público server-backed usan la fila compacta, `B6_NOTIF_COPY` (4 títulos) |
| `bramulab/index.html` | markup del editor de corrección (marcador+teclado en vez de inputs), bump `?v=` en todos los `<script>`/`<link>` |
| `bramulab/styles.css` | `.result-card__rows`/`.result-card__row{display:contents}` (Resumen), `.b6-correction-keypad` (reemplaza `.b6-correction-set`), `.player-row__avatar[data-has-photo]` |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h8` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h8` |
| `bramulab/version.json` | `bundle` → `04.11-h8` |
| `bramulab/tests.html` | 8 + 12 + 10 aserciones nuevas (`QA26SEP-LOGIN`/`QA26SEP-PLAYERS`/`QA26SEP-MISJUGADORES`) |
| `bramulab/login-resume-session.test.mjs` | Nuevo — guarda estática de `resumeServerSession` |
| `supabase/migrations/20260927120000_preprod_ux_players_compact.sql` | Nueva — `search_players` +avatar, `get_players_compact` |
| `supabase/migrations/20260927130000_preprod_ux_mis_jugadores.sql` | Nueva — tabla + 4 RPCs de Mis Jugadores |
| `supabase/tests/verify-preprod-ux-players-compact.sql` | Nueva — verify transaccional (A-G) |
| `supabase/tests/verify-preprod-ux-mis-jugadores.sql` | Nueva — verify transaccional (A-I) |

Sin cambios en: Mis grupos, responsive escritorio, Realtime/polling, ubicación de Ocultar partido, metadata compacta de Cargar partido, legal/P0.2, eliminación/P0.3, fórmula de Nivel, reglas de Ranking, BRAMUlive, `main`/Production.

---

## Migraciones pendientes de aplicar

Ninguna aplicada desde esta sesión (sin Supabase CLI/credenciales en este sandbox, igual que todas las rondas anteriores):

1. **`20260927120000_preprod_ux_players_compact.sql`** — `search_players` gana una columna (`avatar_url`, aditivo); `get_players_compact` es 100% nueva. Rollback: `drop function public.get_players_compact(uuid[]);` y revertir `search_players` a la definición de Bloque 4 si hiciera falta. Verify: `verify-preprod-ux-players-compact.sql` (casos A-G).
2. **`20260927130000_preprod_ux_mis_jugadores.sql`** — tabla nueva + 4 RPCs nuevas, sin tocar ninguna tabla/RPC existente. Rollback: `drop table public.player_saved_players cascade;` (las 4 funciones se van con `cascade` si dependen de la tabla, o `drop function` explícito de las 4). Verify: `verify-preprod-ux-mis-jugadores.sql` (casos A-I).

Orden sugerido: 1 antes que 2 (2 no depende de 1, pero mantiene el orden cronológico de esta ronda).

---

## Tests

- `node --test bramulab/*.test.mjs` → **247/247 PASS** (incluye el archivo nuevo `login-resume-session.test.mjs`).
- `bramulab/tests.html` → **1564/1564 PASS** (1534 previas + 30 nuevas: 8 `QA26SEP-LOGIN` + 12 `QA26SEP-PLAYERS` + 10 `QA26SEP-MISJUGADORES`).
- Boot smoke test: `index.html` con bundle `04.11-h8`, sin errores de consola nuevos (único 404 preexistente: `env.generated.js`, esperado sin backend configurado).
- Verificación visual dirigida (sin backend real disponible en este sandbox — ver limitación abajo):
  - Resumen: capturas reales del render (2 sets, 3 sets, 3 sets + TB) contra `styles.css`/`app.js` reales, confirmando `.result-card__rows` como grid único y coordenadas idénticas antes/después.
  - Editor de corrección: inyección del markup real en el DOM con `styles.css` real — coincide visualmente con Cargar partido (marcador acumulado, set en edición, teclado con teclas deshabilitadas por `ML.computeValidNextDigits`).
  - Fila compacta: inyección de una fila con avatar real + una sin avatar — foto redonda recortada vs. iniciales, exactamente como se especificó.
  - JUGADORES (camino local/legacy): flujo completo real (crear cuenta local → Perfil → pestaña JUGADORES → estado vacío → BUSCAR JUGADORES), sin regresión.
- **No cubierto por tests automáticos ni por este sandbox** (ver "Riesgos residuales"): todo el camino server-backed real de los puntos 1, 4 y 5 (requiere Supabase Staging real — sin backend configurado en este entorno de desarrollo, `Auth.isConfigured()` es `false`).

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h7` → **`04.11-h8`** (único bump de esta ronda).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, los 19 `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS` (19 entradas).

---

## Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Las 2 migraciones nunca corrieron contra Postgres real | Sin Supabase CLI/credenciales en este sandbox (igual que todas las rondas anteriores) — ambas están cubiertas por verify transaccional (A-G/A-I), pero eso no reemplaza una corrida real | Central aplica ambas contra Staging y corre los 2 verify antes de que Sebastián valide |
| Fix del falso onboarding sin reproducción real del blip de red | El bug se corrigió por inspección de código + tests que simulan `levelStateReadFailed`, pero no se pudo forzar una falla de red real contra Supabase Staging desde este sandbox para confirmar el síntoma original y su desaparición | Central/Sebastián: login real repetido varias veces sobre una cuenta ya oficializada, idealmente con red inestable (modo avión intermitente) |
| Alineación de Resumen: fix estructural, no reproducción del bug original | El corrimiento reportado en iPhone/Safari nunca se pudo reproducir píxel a píxel en Chromium en este sandbox — el fix (grid único en vez de dos independientes) es la corrección estructuralmente correcta para la clase de bug descripta, pero no hay confirmación directa de que el bug ERA exactamente esa causa | Sebastián: revisión visual corta en iPhone real sobre 2 sets, 3 sets y un partido con Tie break |
| Camino server-backed de Mis Jugadores/fila compacta sin QA de navegador real | Todo lo construido sobre `Auth.isConfigured()===true` (RPCs reales) se probó con un cliente Supabase fabricado (tests unitarios) y con inyección de DOM aislada (visual) — nunca contra Staging real, porque este sandbox no tiene backend configurado | Central aplica las migraciones y hace una pasada corta de navegador contra Staging antes de que Sebastián valide |
| Corrección de resultado: sin QA de navegador real del flujo completo | El editor nuevo se verificó visualmente (inyección de DOM) y por revisión de código línea a línea contra el original de Cargar partido, pero nunca se ejercitó de punta a punta (abrir un partido real pending/validated → cambiar 2↔3 sets → enviar) porque ese flujo exige un partido server-backed real | Central/Work: un ciclo corto de corrección real (2→3 y 3→2) contra Staging |

---

## Qué quedó fuera (según §7 del handoff, sin cambios)

Mis grupos, responsive escritorio, Realtime/polling, nueva ubicación de "Ocultar partido", metadata compacta de Cargar partido sin layout cerrado, legal/P0.2, eliminación/P0.3, fórmula de Nivel, reglas de Ranking, BRAMUlive, `main`, Production. Perfil QA (edad/género/localidad) tampoco se tocó — no apareció naturalmente al trabajar en los contratos de jugador de esta ronda.

---

## Decisiones técnicas menores resueltas sin marcar como abiertas

- Nombre de archivo de este documento: `20_...md` en vez del `21_...md` que pedía el handoff (el `20` real era el siguiente número libre; no existía un `20_` previo en el directorio).
- Nombre de tabla: se mantuvo `player_saved_players` tal como lo proponía el handoff — no se encontró un nombre mejor dado el patrón ya usado por el resto del esquema (`match_*`, `player_*`).
- Título de `identity_unidentified` ("Participante no identificado"): no estaba en la lista explícita de 5 títulos del handoff, pero cae directamente bajo "equivalentes honestos para los demás eventos reales" — se ajustó por consistencia de vocabulario con `identity_questioned`/`identity_resolved` (los 3 pasan a decir "Participante", nunca mezclar "Identidad"/"Jugador").

Ninguna decisión de producto nueva quedó abierta — todo lo resuelto encaja dentro del criterio ya dado por el handoff.

---

## Qué debe revisar Central

1. HEAD de `staging` (diff completo + este documento).
2. Aplicar `20260927120000_preprod_ux_players_compact.sql` y `20260927130000_preprod_ux_mis_jugadores.sql` contra Staging, en ese orden, y correr sus 2 verify transaccionales.
3. Deploy a Staging (Vercel) con bundle `04.11-h8`.
4. Pasada corta de navegador contra Staging real: login repetido de una cuenta oficializada (punto 1), Resumen en iPhone real (punto 2), corrección de resultado 2↔3 sets (punto 3), Buscar Jugadores/RECIENTES/Mis Jugadores con avatar real (puntos 4-5), títulos de Notificaciones (punto 6).
5. Si todo queda limpio, Sebastián hace una validación física corta **solo de lo corregido** — no se pide repetir el Laboratorio completo.
