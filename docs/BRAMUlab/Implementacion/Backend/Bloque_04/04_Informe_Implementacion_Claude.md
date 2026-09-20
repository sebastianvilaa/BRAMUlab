# Backend Bloque 4 — Informe de implementación (Claude)
## Jugadores, búsqueda e invitados provisionales

**Fecha:** 20/09/2026 (implementación) — actualizado 20/09/2026 con el hotfix post-revisión y un
micro-hotfix visual posterior
**Rama:** `staging`, HEAD de partida `4d74393` (incluye `03_Revision_ChatGPT.md`); hotfix sobre
`10cd0cf` (incluye `05_Revision_Post_Implementacion_ChatGPT.md`); micro-hotfix sobre `b09b150`
**Estado:** implementado en código y migración local, con el hotfix post-revisión y el
micro-hotfix visual plegados. **NO aplicado a Supabase real** (Staging/Producción) —
instrucción explícita de las tres rondas. `main` y BRAMUlive no fueron tocados.

Este informe documenta la implementación de Bloque 4 siguiendo exactamente
`03_Revision_ChatGPT.md` (que tiene precedencia sobre `02_Analisis_Claude.md` donde difieren), el
hotfix acotado de `05_Revision_Post_Implementacion_ChatGPT.md` (§1.7), y un micro-hotfix visual
posterior (§1.8) aplicados antes de tocar Supabase Staging.

---

## 0. Reconfirmación de baseline (antes de tocar código)

- `git fetch` + `git merge --ff-only origin/staging` → `4d74393` (incluye el handoff, el
  análisis y la revisión de ChatGPT).
- Suite local (`bramulab/tests.html`, corrida en el navegador real, no por grep):
  **1408/1408 tests OK — todo verde**, antes y después de los cambios de este bloque (`tests.html`
  no cubre `app.js`, así que esta cifra no cambia por el trabajo de este bloque — confirma que
  no se rompió nada de `engine.js`/`stats.js`/`level*.js`/`store.js`).
- `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`: **no configuradas** en esta
  terminal (mismo estado que rondas anteriores) — coherente con la instrucción de esta ronda de
  no tocar Supabase real; `verify-bloque4.mjs` queda escrito pero no pudo ejecutarse contra
  Staging (ver §3).

---

## 1. Qué se implementó

### 1.1 Migración SQL — `supabase/migrations/20260920120000_bloque4_jugadores_busqueda_provisional.sql`

Una sola migración nueva, aditiva, sin tocar el comportamiento de Bloques 1-3:

- `pgcrypto` (Decisión 3): `create extension if not exists ... with schema extensions` —
  idempotente, Staging ya la tiene instalada según la revisión.
- `pilot_events`: se agrega `'provisional_claimed'` al `CHECK` de `event_name` (necesario para
  poder emitirlo desde el claim).
- `provisional_claims`: hash del token (nunca el crudo), estado
  `pending|claimed|expired|revoked`, expiración a 30 días (Decisión 1), índice único parcial
  "un solo link `pending` por provisional". RLS habilitada, **cero políticas** (deny-by-default
  total, igual que `pilot_events`/`reserved_usernames`).
- `api_rate_limits` + `consume_rate_limit(...)`: contador server-only por
  `player_id + acción + ventana fija`, usado desde cada RPC pública (Decisión 4 — "NO se aprueba
  omitir rate limiting"). Sin infraestructura externa (nada de Redis/Edge rate limiter).
- `search_players(p_query, p_limit)`: `authenticated` únicamente, columnas declaradas
  explícitas (nunca `select *`), excluye provisionales, cuentas sin perfil completo y al propio
  caller, query < 2 caracteres devuelve vacío, límite server-side fijo de 25 filas, rate limit
  30 req/60s.
- `get_public_profile(p_player_id)`: mismas exclusiones/columnas que `search_players` +
  localidad. 0 filas para provisional/inexistente/perfil incompleto.
- `create_provisional_player(p_display_name)`: **corrección obligatoria de la revisión (§3)**
  aplicada tal cual — SIEMPRE un UUID nuevo, sin ningún tipo de deduplicación por nombre, ni
  siquiera dentro del mismo creador.
- `list_my_provisional_players()`: **corrección obligatoria de la revisión (§4)** aplicada tal
  cual — RPC acotada en vez de una policy de SELECT directo sobre `players` (que hubiera
  expuesto `auth_user_id` de una identidad ya reclamada).
- `create_claim_link(p_provisional_player_id)`: genera/rota el token (256 bits vía
  `pgcrypto.gen_random_bytes`, hash sha256 vía `pgcrypto.digest`), devuelto crudo una sola vez;
  rotar invalida (`revoked`) cualquier `pending` anterior.
- `claim_provisional_player(p_token)`: consumo atómico (`for update` sobre la fila del claim).
  **Corrección obligatoria de la revisión (§5)** aplicada tal cual — `pilot_events` se
  **reasigna, nunca se borra** (no tiene `ON DELETE CASCADE`, y `signup_completed` es evidencia
  válida del alta). Extendí el mismo criterio, por seguridad, a cualquier fila donde la cuenta
  que reclama pudiera figurar como creadora (`players.created_by_player_id`,
  `provisional_claims.created_by_player_id`) para que el `DELETE` de la cuenta vacía nunca
  falle por una referencia huérfana — no estaba explícitamente pedido, pero es la misma lógica
  aplicada de forma consistente y evita una falla de integridad referencial real.
  También agregué un chequeo no pedido explícitamente pero necesario para la corrección: si la
  cuenta que reclama YA adoptó una identidad reclamada antes (encadenar un segundo claim sin
  haber terminado nunca `complete_profile`), se rechaza con `account_already_claimed_identity`
  — mismo criterio de "segunda identidad se resuelve a mano" que ya aplica a una cuenta con
  perfil completo (§7 de la revisión / Backend_Infraestructura.md §9.2/§15.5).

### 1.2 `bramulab/auth.js`

Seis wrappers nuevos, mismo patrón que el resto del archivo (`{ok, ...}` / `{ok:false, code}`):
`searchPlayers`, `getPublicProfile`, `createProvisionalPlayer`, `listMyProvisionalPlayers`,
`createClaimLink`, `claimProvisionalPlayer`.

### 1.3 `bramulab/store.js`

`KEYS.CLAIM_TOKEN` (ranura única, mismo criterio que `SIGNUP_DRAFT`) +
`loadClaimToken`/`saveClaimToken`/`clearClaimToken`.

### 1.4 `bramulab/app.js` — integración mínima, gateada por `Auth.isConfigured()` + `serverBacked`

- `captureClaimTokenFromUrl()`: lee `?claim=<token>` al boot, lo guarda en la ranura única y
  limpia la URL (`history.replaceState`) — llamado al inicio de `bootWithServerSession()`.
- `runOfficializeAndEnter()`: si hay un token pendiente, lo consume ANTES de
  `complete_profile`/`officializeLevel` (Decisión 2 — "antes de persistir/oficializar el
  onboarding en servidor"). Éxito o fracaso, el alta sigue su curso normal después (un token
  roto nunca bloquea crear la cuenta). Códigos definitivos (`claim_invalid`, `claim_expired`,
  `claim_already_used`, `account_already_registered`, `account_already_claimed_identity`)
  limpian el token; cualquier otro código (red, `rate_limited`) lo conserva para reintentar la
  próxima vez que se llegue a esta función (siempre segura de reintentar, ver su comentario de
  cabecera existente desde Bloque 3).
- `resumeServerSession(...)`: si el onboarding YA está terminado y queda un token pendiente
  (única vía en la que nunca se llegaría a `runOfficializeAndEnter()`), se avisa explícitamente
  ("esta cuenta ya tiene perfil — reclamar otra identidad se resuelve manualmente durante el
  piloto") y se limpia el token — nunca se ignora en silencio.
- `renderPlayerSearchResults`/`renderPlayerSearchResultsServerBacked`: para una cuenta
  `serverBacked`, la búsqueda pasa a `Auth.searchPlayers` (real, autoritativa) en vez de
  `ML.buildJugadorDirectory` (local). Recientes queda oculto (Decisión 5 — sin `matches` reales
  todavía no hay señal genuina de "con quién compartí cancha"). Debounce de ~300 ms solo en este
  camino (§4 de la revisión); el camino local/legacy queda sin ningún cambio.
- `buildPlayerRowHTMLFromServerRow`: fila ya resuelta por el servidor (nunca vuelve a resolver
  por nombre, a diferencia de `buildPlayerRowHTML`/`buildGroupRowAccount`).
- `openPlayerPublicProfile`/`renderPlayerPublicProfile`/`renderPlayerPublicProfileServerBacked`:
  acepta también `{name, playerId}` (mismo criterio que `PH.filterMatchesForPlayer`). Con
  `playerId` + backend configurado, resuelve vía `get_public_profile` — identidad por
  `player_id`, nunca por nombre. Edad NUNCA se muestra (privada para otra persona real) ni la
  tarjeta de Ranking (corre sobre el Ranking simulado LOCAL, sin sentido para otra cuenta real
  todavía). Partidos/efectividad/racha quedan en 0/vacío honesto — sin `matches` compartidos
  reales (Bloque 5), este dispositivo nunca tiene datos reales de encuentros con una cuenta
  recién encontrada por búsqueda.
- Todos los call sites existentes de `openPlayerPublicProfile` (Ranking, Mis Grupos,
  Compañeros, tab JUGADORES, resultados/recientes locales de Buscar Jugadores) siguen pasando un
  string plano — comportamiento local/legacy sin ningún cambio.
- Herramienta de laboratorio nueva (`#dev-tools-create-test-claim`, oculta en Production, solo
  visible con el preview activado y para una cuenta `serverBacked`): crea una provisional de
  prueba + su link de reclamo y lo copia al portapapeles — es el "flujo habilitado para prueba"
  que pide la prueba manual de Staging (§9 de la revisión), sin construir una pantalla de
  producto nueva. La UI de producto para reutilizar/invitar un jugador dentro de la carga de un
  partido pertenece a Bloque 5 (Decisión 6 — no se adelanta).
- **Fuera de esta integración, sin tocar (Decisión 6):** pestaña JUGADORES
  (`Store.loadAddedPlayers`), selector de participantes de "Cargar partido jugado"
  (`selectManualPlayer`, "agregar sin cuenta").

### 1.5 Bump de versión (`index.html`/`sw.js`)

`-h8` → `-h9` (mismo patrón de siempre: `Store.VERSION`/`version.json` siguen en
"BRAMUlab V04.10" — es un bloque de Backend, no una ronda de Nivel BRAMU).

**Bug real encontrado y corregido de paso** (`bramulab/sw.js`, línea del `CACHE_NAME`): un
`\n` **literal** (texto, no salto de línea real) dejaba `const CACHE_NAME = 'bramulab-v04-10-h8';`
adentro del comentario `//` anterior, así que esa declaración NUNCA se ejecutaba como código —
`CACHE_NAME` quedaba indefinida y cualquier referencia (`install`/`activate`/`fetch` del propio
`sw.js`) iba a lanzar `ReferenceError` en tiempo de ejecución, rompiendo el caching offline-first
por completo. Se corrigió porque bumpear el sufijo exigía tocar esa misma línea de todos modos.

### 1.6 Tests nuevos — `supabase/tests/verify-bloque4.mjs`

Mismo formato/estilo que `verify-bloque2.mjs`/`verify-bloque3.mjs`. Cubre punto por punto el
criterio de validación de `03_Revision_ChatGPT.md §9`:

- seguridad: las 6 RPCs nuevas rechazan `anon`; `provisional_claims` no es legible por `anon`;
- búsqueda: coincidencia por `@usuario`, el caller nunca aparece en sus propios resultados,
  query corta devuelve vacío, shape sin campos privados;
- provisionales: mismo nombre + mismo creador → IDs distintos (nunca se fusiona); nunca
  aparecen en `search_players`/`get_public_profile`; `list_my_provisional_players` las lista;
- rotación de link (el anterior queda muerto);
- claim feliz: `pilot_events` (`signup_completed`) preservado y reasignado, `provisional_claimed`
  registrado, el `player_id` adoptado es el de la provisional (nunca uno nuevo), `complete_profile`/
  `officialize-onboarding` funcionan después sin cambios sobre ese ID;
- token ya usado, token vencido (forzado vía `service_role` para no esperar 30 días reales),
  cuenta ya registrada intentando reclamar (`account_already_registered`);
- concurrencia real: dos reclamos simultáneos del mismo token, exactamente uno gana;
- rate limiting real: 35 búsquedas seguidas → al menos una `rate_limited`, nunca más de 30
  exitosas en la ventana.

No se modificaron `verify-bloque2.mjs` ni `verify-bloque3.mjs`.

---

## 1.7 Hotfix post-implementación — `05_Revision_Post_Implementacion_ChatGPT.md`

Revisión de código/migración/tests detectó 4 problemas antes de tocar Supabase Staging. Se
corrigieron los 4, acotados a lo pedido, editando **en el lugar** la migración
`20260920120000_...sql` (nunca se llegó a aplicar en ningún entorno, así que no hizo falta un
archivo de follow-up separado — a diferencia de los hotfixes de Bloque 3, que sí corrigen una
migración ya viva).

**§1 — Búsqueda: anti-enumeración incompleta.** `search_players` armaba
`'%' || p_query || '%'` y usaba `ilike`: una query de `%%`/`__` actuaba como wildcard SQL real y
podía devolver el universo entero pese al mínimo de 2 caracteres. Corregido: coincidencia por
substring **literal** vía `position(lower(query) in lower(campo)) > 0` (nunca interpreta
`%`/`_` como patrón); acepta un `@` inicial (`@sebastian` encuentra el username `sebastian`,
recalculando el mínimo de 2 caracteres ÚTILES sobre el texto ya sin el `@`); longitud máxima de
40 caracteres (query absurdamente larga → vacío controlado, igual que una corta).

**§2 — Claim: un fallo transitorio podía destruir la posibilidad de reclamar.** En
`runOfficializeAndEnter()`, si `claimProvisionalPlayer()` fallaba por algo transitorio (red,
`rate_limited`), el código conservaba el token pero **igual seguía** hacia
`complete_profile`/`officializeLevel` — terminaba de registrar la cuenta, y en el próximo
intento el claim ya no podía adoptarse (`account_already_registered`): conservar el token no
alcanzaba si el resto del flujo lo volvía inservible de todos modos. Corregido: un código
NO-definitivo corta la función ANTES de tocar perfil/Nivel (token y borrador quedan intactos) y
muestra un aviso. Vía de reintento sin OTP nuevo: el handler de `#signup-continue-btn` para
`signupStep === 'verify'` ahora chequea PRIMERO si ya existe una sesión válida para el mismo
email del borrador — si la hay (el OTP de esa alta ya se consumió con éxito en el intento
anterior), salta directo a `resumeDraftFlow()` (que reintenta `runOfficializeAndEnter()`
completo) en vez de exigir/consumir un código de un solo uso ya gastado.

**§3 — Rate limiting del claim: los intentos inválidos no quedaban contados.**
`claim_provisional_player` llamaba a `consume_rate_limit` pero después usaba `raise exception`
para `claim_invalid`/`claim_expired`/`claim_already_used`/`account_already_registered` — en
Postgres, una excepción sin capturar aborta TODA la transacción de la función, revirtiendo
también el incremento del contador ya ejecutado. Corregido: **cambio de contrato** —
`claim_provisional_player` ahora devuelve `jsonb` (`{ok, code, player_id}`) para todos los
errores de negocio esperables (incluido el propio `rate_limited` del claim, por consistencia
interna de la función) en vez de `raise exception` + `public.players`. `no_player_for_session`
sigue siendo una excepción real (violación de invariante de sesión, no un resultado de negocio
esperable — mismo criterio que el resto de RPCs del archivo). Actualizado `Auth.
claimProvisionalPlayer` (auth.js) para interpretar el nuevo shape; `app.js` no necesitó cambios
adicionales más allá de los de §2 (ya usaba `claimResult.ok`/`.code`).

**§5 — validaciones de payload.** Longitud máxima de `p_display_name` en
`create_provisional_player` (40 caracteres, `display_name_too_long`); formato del token de
claim (64 hex — sha256 de 32 bytes) validado **después** de `consume_rate_limit`, para que un
token con formato inválido cuente igual como intento real (mismo motivo que §3).

**§4 — Perfil público server-backed mostraba módulos vacíos y una acción local por nombre.**
`renderPlayerPublicProfileServerBacked` mantenía "Edad" visible con `—`, dejaba visibles
Efectividad/Partidos/Mejor racha sin datos reales, usaba el Nivel actual como "Mejor nivel
BRAMU histórico" (no es un máximo comprobado), y mantenía `AGREGAR JUGADOR` visible (escribe la
lista local histórica por **nombre** — la misma identidad-por-nombre que esta rama acababa de
resolver correctamente por `player_id`). Corregido: se ocultan por completo (nunca un
placeholder) Edad, la tarjeta de Efectividad/Partidos, la fila Mejor racha/Mejor nivel BRAMU, y
`AGREGAR JUGADOR` (se dejó de llamar a `renderPlayerPublicAddButton()` en esta rama). Mano/Lado
se muestran solo si existen (se ocultan individualmente si no); el contenedor de esos 3
mini-stats (`#player-public-meta-grid`, nuevo id en `index.html`) se oculta entero si ninguno
queda visible. Ranking sigue oculto (ya estaba correcto). Se agregaron 3 `id` nuevos en
`index.html` (`player-public-meta-grid`, `player-public-effectiveness-card`,
`player-public-performance-row`) — sin ningún otro cambio de markup/CSS, así que el camino
local/legacy es visualmente idéntico (los `id` no tienen reglas propias).

**Lo que NO se tocó (§6 de la revisión), confirmado:** token 30 días, pgcrypto, UUID nuevo por
provisional, nunca fusionar por nombre, `list_my_provisional_players` en vez de abrir `players`,
preservación/reasignación de `pilot_events`, claim antes de persistir perfil/Nivel, Recientes
oculto hasta Bloque 5, JUGADORES/carga manual fuera de alcance, el fix de `sw.js` (ya estaba
hecho de la ronda anterior), `main`/BRAMUlive/Supabase remoto/Vercel sin tocar.

**Hotfix §2 no es automatizable con `verify-bloque4.mjs`:** es lógica de orquestación de
`app.js` (cuándo llamar `complete_profile`/`officializeLevel`), no de las RPCs de Postgres —
`app.js` no tiene cobertura de tests automatizados en este proyecto (convención existente, no
introducida acá). Se verificó por inspección de código (el `return` que faltaba, ahora
presente) + trazando a mano los dos puntos de entrada reales (`confirmNivelOnboarding`
early-session shortcut y el botón `#signup-continue-btn` en `signupStep==='verify'`).

---

## 1.8 Micro-hotfix visual — estado de Perfil público no se restablecía al camino local/legacy

**Problema real detectado:** `renderPlayerPublicProfileServerBacked()` oculta correctamente
(`hidden = true`) `#player-public-meta-grid` (y Edad/Mano/Lado dentro), `#player-public-
effectiveness-card`, `#player-public-performance-row` y `#player-public-add-btn` — pero
`renderPlayerPublicProfile()` (rama local/legacy) nunca los restablecía a `hidden = false`: solo
fijaba texto/valores, nunca visibilidad. Si en la misma sesión se visitaba primero un perfil
server-backed y DESPUÉS uno local/legacy, ese segundo perfil quedaba con esos módulos ocultos
sin motivo (arrastrando el estado del anterior).

**Corrección:** al entrar a la rama local/legacy de `renderPlayerPublicProfile()` (después del
`return` temprano de la rama server-backed, antes de que la lógica local existente calcule sus
valores), se restablece explícitamente `hidden = false` sobre los 5 elementos de arriba. La
lógica local de siempre sigue decidiendo sus valores exactamente igual que antes — no se tocó
ni una línea de la rama server-backed ni de la lógica de cálculo local.

**Verificado en el navegador real** (no analítico): se simuló el estado "recién oculto por un
perfil server-backed" fijando `hidden = true` a mano en los 5 elementos vía consola, y se abrió
el perfil público local de un jugador conocido (`Rival De Prueba`, sembrado con
`Store.rememberPlayerNames`) — los 5 elementos volvieron a `hidden = false` y se vieron con sus
valores reales (Edad/Mano/Lado en "—" por no tener cuenta detrás, EFECTIVIDAD, Mejor racha/
Mejor nivel BRAMU y AGREGAR JUGADOR, los 4 visibles). Suite local (`tests.html`) reconfirmada en
**1408/1408 OK** después del cambio.

---

## 2. Tests y verificación

| Verificación | Resultado |
|---|---|
| `bramulab/tests.html` (navegador real, no grep) | **1408/1408 OK** (antes de la implementación, después de la implementación, después del hotfix, y después del micro-hotfix visual) |
| `index.html` cargado en el dev server local, consola sin errores nuevos | OK (único 404 preexistente: `env.generated.js`, esperado sin backend configurado localmente) |
| `?claim=<token>` en la URL: se limpia la URL, no guarda el token sin backend configurado | OK (verificado en el navegador) |
| Selectores DOM nuevos del hotfix §4 (`player-public-meta-grid`/`-effectiveness-card`/`-performance-row`, jerarquía `.mini-stat` esperada) | OK, verificado por consola en el navegador real |
| Micro-hotfix §1.8: perfil público local restablece visibilidad tras simular un estado oculto por la rama server-backed | OK, verificado en el navegador real de punta a punta (ver §1.8) |
| `node --check` sobre los archivos JS tocados en total (`app.js`, `auth.js`, `store.js`, `sw.js`, `verify-bloque4.mjs`) | OK, sin errores de sintaxis |
| `verify-bloque4.mjs` contra Supabase Staging | **NO ejecutado** — sin `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` en esta terminal, y la instrucción explícita de las tres rondas es no aplicar nada a Supabase real todavía (la migración necesita estar aplicada para que el script tenga algo que probar) |
| `verify-bloque2.mjs`/`verify-bloque3.mjs` | No re-ejecutados en esta ronda (sin cambios de código que los afecten; sin credenciales tampoco) |
| Hotfix §2 (claim transitorio no avanza a complete_profile/officializeLevel) | Verificado por inspección de código (no automatizable: es lógica de `app.js`, sin cobertura de tests en este proyecto) |
| `verify-bloque4.mjs`: 2 tests RLS nuevos (`authenticated` no lee `provisional_claims`/`api_rate_limits` directo) | Agregados, `node --check` OK; no ejecutados contra Staging (ver arriba) |

---

## 3. Checklist contra `03_Revision_ChatGPT.md`

| Punto de la revisión | Estado |
|---|---|
| §2 Decisión 1 — 30 días, rotación libre | Implementado tal cual |
| §2 Decisión 2 — bootstrap duplicado en `claim_provisional_player`, claim antes de persistir/oficializar | Implementado tal cual |
| §2 Decisión 3 — `pgcrypto` idempotente con schema `extensions` | Implementado tal cual |
| §2 Decisión 4 — rate limiting mínimo real (no se omite) | Implementado (`api_rate_limits` + `consume_rate_limit`, valores de la revisión) |
| §2 Decisión 5 — Recientes vacío/oculto para server-backed | Implementado |
| §2 Decisión 6 — JUGADORES/carga manual sin tocar | Respetado, sin ningún cambio en esos caminos |
| §3 — nunca reutilizar provisional por nombre | Implementado (`create_provisional_player` siempre UUID nuevo) |
| §4 — nunca policy de SELECT directo sobre `players` | Implementado (`list_my_provisional_players` en su lugar) |
| §5 — preservar `pilot_events` durante el claim | Implementado (reasignación, nunca borrado) + extendido a otras FKs de la cuenta que reclama |
| §6 — búsqueda/perfil público autenticado, columnas declaradas, sin privados | Implementado |
| §7 — política de claim del piloto (segunda identidad se resuelve a mano) | Implementado (`account_already_registered` + `account_already_claimed_identity`) |
| §8 — qué implementar en esta ronda | Todo lo listado quedó implementado; nada de lo no autorizado (partidos reales, Ranking, fusiones autoservicio, BRAMUlive) fue tocado |
| §9 — criterio de validación | Cubierto en `verify-bloque4.mjs` + prueba manual de laboratorio (§1.4); pendiente de correr contra Staging real |

### Checklist contra `05_Revision_Post_Implementacion_ChatGPT.md`

| Punto de la revisión | Estado |
|---|---|
| §1 — búsqueda literal, `@usuario`, longitud máxima | Implementado (`position(...)`, strip de `@`, cap de 40) |
| §2 — fallo transitorio de claim no avanza a complete_profile/oficialización | Implementado (`return` agregado en `runOfficializeAndEnter`) + vía de reintento sin OTP nuevo |
| §3 — rate limit del claim cuenta intentos inválidos | Implementado (contrato `jsonb`, sin `raise exception` para errores de negocio) |
| §4 — perfil público server-backed sin módulos vacíos ni acción local por nombre | Implementado (oculta Edad/Efectividad/Partidos/Mejor racha/Mejor nivel histórico/Agregar Jugador; mano/lado condicionales) |
| §5 — validaciones de longitud/formato | Implementado (`p_query` 40, `p_display_name` 40, token 64 hex post-cuota) |
| §6 — qué NO cambiar | Respetado en su totalidad |
| §7 — validación requerida (`verify-bloque4.mjs` actualizado, suite local, `node --check`) | Cumplido |

---

## 4. Observaciones no bloqueantes

- El chequeo de "P2 sin onboarding empezado" en `claim_provisional_player` no se limita a
  `profiles.username is null` (perfil completo): también rechaza si `level_states.status` de la
  cuenta que reclama ya dejó de ser `PENDIENTE`. Esto cubre un caso límite que la revisión no
  mencionó explícitamente (llamar a la Edge Function de oficialización de Nivel sin haber
  llamado nunca a `complete_profile`, fuera del orden normal de la UI) — sin este chequeo
  adicional, un claim en ese escenario borraría en cascada un `level_events` ya oficializado.
- La herramienta de laboratorio "Crear invitado de prueba + copiar link" es deliberadamente un
  atajo de desarrollo (mismo criterio que "Resetear Nivel BRAMU"), no un flujo de producto. La
  UI real de invitación (crear/reutilizar un provisional al armar un partido) es de Bloque 5.
- `canonical_player_id` (Backend_Infraestructura.md §6.1) no se usa ni se toca — es un mecanismo
  administrativo distinto, reservado para el futuro.
- El hotfix §3 pedía el cambio de contrato específicamente para los errores de negocio
  (`claim_invalid`/`claim_expired`/`claim_already_used`/`account_already_registered`/
  `account_already_claimed_identity`). Extendí el mismo criterio al propio `rate_limited` DE
  `claim_provisional_player` (no al de `search_players`/`get_public_profile`/
  `create_provisional_player`/`create_claim_link`, que la revisión explícitamente dijo que
  podían mantener su excepción de siempre): con TODOS los caminos de esa única función
  devolviendo el mismo shape `jsonb`, `Auth.claimProvisionalPlayer`/`app.js` no necesitan
  distinguir "excepción HTTP" de "resultado de negocio" para esa RPC en particular — una
  simplificación interna, no un cambio de alcance.

---

## 5. Qué falta para cerrar Bloque 4 (acción de Sebastián)

1. Aplicar `supabase/migrations/20260920120000_bloque4_jugadores_busqueda_provisional.sql` en
   Supabase Staging (`supabase db push` o el flujo que ya se usó en Bloques 1-3).
2. Correr `node supabase/tests/verify-bloque4.mjs` contra Staging (variables de entorno en la
   terminal, nunca pegadas en el chat) y confirmar que los tres verificadores (`verify-bloque2`,
   `verify-bloque3`, `verify-bloque4`) siguen en verde.
3. Generar `bramulab/env.generated.js`/desplegar a Vercel Preview (o el entorno que corresponda)
   para poder probar el flujo real en el navegador con backend configurado.
4. Prueba manual de Staging (§10 de `03_Revision_ChatGPT.md`, detallada en
   `02_Analisis_Claude.md §10`): dos cuentas reales, búsqueda cruzada, crear provisional +
   link (con la herramienta de laboratorio), reclamarlo desde incógnito, confirmar que el
   segundo uso del link falla, terminar el onboarding de Nivel sobre la cuenta reclamada, y un
   smoke test de que signup/login normales sin `?claim=` siguen exactamente igual.
5. Recién con eso en verde, cerrar Bloque 4 (documento de cierre, mismo criterio que
   `12_Cierre_Bloque_03.md`).

---

## 6. Commits

- Implementación original de Bloque 4: `77455c5` (rama `staging`).
- Hotfix post-revisión (§1.7): `b09b150` (rama `staging`).
- Micro-hotfix visual (§1.8, este documento): ver el commit indicado en la respuesta de esta
  ronda en el chat (mensaje + hash), rama `staging`, sin tocar `main` ni BRAMUlive.
