# Backend Bloque 4 — Análisis y planificación (Claude)
## Jugadores, búsqueda e invitados provisionales

**Fecha:** 19/09/2026
**Rama:** `staging`, HEAD de partida `9156e65e`
**Estado:** ANÁLISIS/PLANIFICACIÓN únicamente — nada de esto se implementó. No se tocó código, no se creó ninguna migración, no se tocó Supabase/Vercel, no se tocó `main` ni BRAMUlive.

Este documento responde exactamente a los 12 puntos pedidos en `01_Handoff_Inicio_Bloque_04.md` §8.

---

## 1. Estado del código actual relevante

### Backend (Supabase, ya cerrado en Bloques 1–3)

- `public.players`: `player_id`, `type ('registered'|'provisional')`, `auth_user_id` (nullable, **unique**), `display_name`, `is_active`, `created_by_player_id` (ya existe, agregada en Bloque 2 **explícitamente reservada para Bloque 4** — el comentario de esa migración dice literalmente "reservado para invitados/provisionales de Bloque 4"), timestamps. RLS: única policy `players_select_own` (`auth_user_id = auth.uid()`) — nadie puede leer la fila de otro todavía, ni siquiera una provisional.
- `public.profiles`: 1:1 con `players` para cuentas registradas, con `terms_version`/`terms_accepted_at` agregados en Bloque 3. RLS: única policy `profiles_select_own`. Cero políticas de insert/update/delete para el cliente — toda escritura pasa por `complete_profile` (SECURITY DEFINER).
- `public.level_states`/`level_events` (Bloque 3): estado/historial de Nivel BRAMU, con `PENDIENTE` explícito. RLS: select-own únicamente.
- `handle_email_confirmed()` (trigger sobre `auth.users`): al confirmarse el email, crea idempotentemente `players`(registered) + `profiles`(vacío) + `level_states`(PENDIENTE) + `pilot_events('signup_completed')`.
- `complete_profile`/`is_username_available`/`officialize_level_onboarding`: únicas vías de escritura de perfil/Nivel, todas `SECURITY DEFINER`, todas resuelven `player_id` dinámicamente desde `auth.uid()` (o desde `p_auth_user_id`, en el caso de la RPC privada llamada por la Edge Function) — **nunca reciben un `player_id` explícito del cliente**. Esto importa mucho para el diseño de claim (§6): una vez que un `player_id` queda con el `auth_user_id` correcto, estas tres funciones lo "adoptan" automáticamente, sin necesitar ningún cambio.
- No existe todavía `provisional_claims`, ninguna función de búsqueda, ninguna función de creación/claim de provisional, ni ninguna Edge Function nueva.
- `rls_auto_enable()`: encontré esta función mencionada en `20260919153500_bloque3_security_grants.sql` (le revoca EXECUTE a todos los roles de cliente) pero **no está definida en ninguna migración versionada** — parece una función que Supabase generó/Sebastián creó a mano fuera del control de versiones (posiblemente ligada al Advisor de Supabase). No es bloqueante para Bloque 4, pero lo dejo anotado: no la toco ni la asumo en el diseño.

### Frontend (`bramulab/`)

Hallazgo central de esta auditoría: **toda la UI de "Buscar jugadores" y "Perfil público" está construida sobre nombres normalizados como identidad, nunca sobre `player_id`**, y arma su universo enteramente desde `localStorage` de este dispositivo:

- `renderPlayerSearchResults(query)` (`app.js:6678`) arma el universo con `ML.buildJugadorDirectory(Store.loadHistory(), Store.loadPlayerNames(), currentPlayerName)` — nombres que aparecieron alguna vez en el historial de ESTE dispositivo o que se recordaron manualmente. Cero red, cero backend.
- `openPlayerPublicProfile(name, origin)` (`app.js:6950`) y `renderPlayerPublicProfile()` (`app.js:6784`) resuelven una cuenta real buscando `Store.loadUsers().find(u => normalizePlayerName(u.displayName) === name)` — es decir, solo encuentran una cuenta si esa cuenta existe **en la lista local de este mismo dispositivo** (la propia, una cuenta legacy, o quien haya iniciado sesión alguna vez en este navegador). Nunca puede resolver a otra persona real de Staging.
- `buildPlayerRowHTML(name, level)` (`app.js:543`) y `computePlayerRowLevel(history, name)` (`app.js:531`) repiten el mismo patrón de resolución por nombre (`buildGroupRowAccount`, `app.js:6100`) para decidir handle/Nivel de cada fila.
- La carga manual ("Cargar partido jugado") permite agregar un nombre libre a la lista local (`selectManualPlayer` → `Store.rememberPlayerNames([norm])`, `app.js:637-653`) — sin ningún concepto de `player_id`, ligado 100% a la creación futura del partido (Bloque 5).
- **Precedente ya existente y reutilizable**: `groups.js` (Mis Grupos) ya resuelve miembros con la forma híbrida `{name, userId|null}` (`groups.js:14,67,77,289,302`) — un miembro puede estar ligado a un `userId` real o ser solo texto. `PH.filterMatchesForPlayer`/`PH.resolveIdentityRef` (player-home.js) **ya aceptan esa misma forma híbrida** (`{name, userId}` o string plano) desde V03.0. Esto es clave para el diseño de integración (§5): el patrón "identidad con o sin cuenta real" ya existe en la base de código, Bloque 4 lo extiende, no lo inventa.
- `Store.loadAddedPlayers`/`addPlayerToList` ("JUGADORES", V03.3): lista personal de nombres agregados, keyed por `user.id` pero con nombres planos adentro — mismo patrón, menor prioridad, no es parte del alcance confirmado de Bloque 4 (nota en §5).
- `auth.js` ya tiene el patrón exacto a seguir para nuevas llamadas server-side: `PLAuth.isConfigured()` como única bisagra, wrappers finos que llaman RPCs con nombres explícitos y devuelven `{ok, ...}` o `{ok:false, code}`.

**Conclusión de esta sección:** no hay que "conectar" la búsqueda a un backend que ya habla el mismo idioma — hay que enseñarle a esa UI a resolver identidades por `player_id` cuando hay backend real, preservando el camino 100% local intacto cuando no lo hay. El detalle está en §5.

---

## 2. Propuesta de arquitectura mínima para Bloque 4

Mismo criterio que Bloque 3: **sin Edge Functions nuevas**. A diferencia de Bloque 3 (que necesitaba reutilizar el motor JS de Nivel, imposible de replicar fielmente en SQL), todo lo que pide Bloque 4 es manipulación de filas + generación/hash de un token aleatorio — **Postgres puro alcanza** (`pgcrypto` para `gen_random_bytes`/`digest`, ya un estándar en proyectos Supabase). Agregar una Edge Function acá sería infraestructura innecesaria.

Arquitectura: **RPCs `SECURITY DEFINER`** (mismo patrón que `complete_profile`/`officialize_level_onboarding`), nunca vistas ni tablas abiertas directamente:

- `search_players(p_query text, p_limit int)` — búsqueda pública acotada.
- `get_public_profile(p_player_id uuid)` — perfil público de un jugador puntual.
- `create_or_reuse_provisional_player(p_display_name text)` — crea o reutiliza (por creador) una identidad provisional.
- `create_claim_link(p_provisional_player_id uuid)` — genera (o rota) el link de reclamo de una provisional propia.
- `claim_provisional_player(p_token text)` — consume el token y funde la identidad provisional en la cuenta que reclama.

Una sola migración nueva (`supabase/migrations/<timestamp>_bloque4_jugadores_busqueda_provisional.sql`), aditiva, sin tocar el comportamiento de Bloques 1–3.

---

## 3. Tablas/columnas/índices/RPCs estrictamente necesarias

### Nuevo: `provisional_claims`

```
claim_id               uuid PK default gen_random_uuid()
provisional_player_id  uuid NOT NULL FK -> players(player_id) ON DELETE CASCADE
token_hash             text NOT NULL UNIQUE   -- sha256(token), pgcrypto digest()
status                 text NOT NULL DEFAULT 'pending' CHECK IN ('pending','claimed','expired','revoked')
created_by_player_id   uuid NOT NULL FK -> players(player_id)
created_at             timestamptz NOT NULL DEFAULT now()
expires_at             timestamptz NOT NULL
claimed_at             timestamptz
claimed_by_player_id   uuid FK -> players(player_id)
```

Índice único parcial adicional recomendado: `unique (provisional_player_id) where status = 'pending'` — impone a nivel de base que solo puede existir **un link activo por identidad a la vez** (§6.2 del documento maestro: "un único link de invitación/reclamo por identidad"); `create_claim_link` expira cualquier `pending` anterior antes de crear uno nuevo, así que esta constraint es defensa en profundidad, no el mecanismo principal.

RLS: habilitada, **cero políticas** (deny-by-default total, mismo criterio que `reserved_usernames`/`pilot_events`). El hash del token y los metadatos de claim nunca son legibles directo desde el cliente — únicamente a través de las RPCs de abajo.

### `players` — sin columnas nuevas

`type`, `auth_user_id`, `display_name`, `created_by_player_id` ya alcanzan. Nueva policy:

```
players_select_created_by_me: for select using (
  created_by_player_id in (select player_id from players where auth_user_id = auth.uid())
)
```

Esto permite a un usuario ver **las provisionales que él mismo creó** (para poder listarlas/gestionarlas), sin abrir lectura de provisionales ajenas — cumple §10.2 ("puede leer identidades provisionales solo si está relacionado con ellas mediante un partido o las creó").

### `profiles`/`level_states` de una provisional — ninguna fila

Una provisional **no** recibe fila de `profiles` ni `level_states` al crearse (no tiene username, no tiene Nivel — igual que dice §9.1: "no se pide teléfono, email, DNI ni apellido"). Recién las recibe en el momento del claim (ver §6), replicando exactamente lo que ya hace `handle_email_confirmed` para un alta normal.

### RPCs (todas `SECURITY DEFINER`, `set search_path = public`)

| RPC | Grant | Qué hace |
|---|---|---|
| `search_players(p_query text, p_limit int default 20)` | `authenticated` únicamente | Devuelve filas compactas (`player_id, username, display_name, first_name, last_name, competitive_branch, dominant_hand, preferred_side, level_public, level_status`) de `players type='registered'` join `profiles`/`level_states`, filtrando `username/display_name/first_name/last_name ILIKE`, excluyendo al propio caller, con `p_limit` acotado server-side a un máximo fijo (ej. 25) sin importar lo que pida el cliente, y `p_query` con longitud mínima (ej. 2 caracteres) — si no la cumple, devuelve vacío en vez de todo el universo (mitigación simple de enumeración, §10.4). |
| `get_public_profile(p_player_id uuid)` | `authenticated` | Igual que arriba pero para un solo `player_id`, con más campos (los que ya muestra Perfil público hoy salvo los privados — ver §4). Devuelve 0 filas si el `player_id` es `provisional` o no existe — nunca confirma/niega existencia de una provisional por este camino. |
| `create_or_reuse_provisional_player(p_display_name text)` | `authenticated` | Si el caller ya creó una provisional con el mismo nombre normalizado, la reutiliza; si no, crea una nueva `players(type='provisional', created_by_player_id=caller, display_name=...)`. |
| `create_claim_link(p_provisional_player_id uuid)` | `authenticated` | Verifica que el caller sea `created_by_player_id` de esa provisional; expira cualquier claim `pending` anterior de esa misma provisional; genera un token con `gen_random_bytes(32)` (pgcrypto), guarda `digest(token,'sha256')` como `token_hash`, `expires_at = now() + <duración recomendada, ver §12>`; devuelve el token **crudo** una sola vez (nunca más recuperable). |
| `claim_provisional_player(p_token text)` | `authenticated` | Ver diseño completo en §6. |

**Extensión nueva necesaria:** `create extension if not exists pgcrypto;` — estándar en Supabase, de bajo riesgo, reversible. Lo marco como punto a confirmar (no lo asumo silenciosamente) porque es infraestructura nueva, aunque mínima.

**Opcional, no bloqueante:** agregar `'provisional_claimed'` al `check` de `pilot_events.event_name` para medir conversión de invitaciones — útil para el piloto, no imprescindible para que Bloque 4 funcione.

---

## 4. Políticas RLS y límites de datos públicos

Regla general (igual que Bloque 2/3): **no abrir `profiles`/`level_states` con una policy nueva de "leer cualquiera"**. Toda la superficie pública pasa por las RPCs de arriba, que deciden explícitamente qué columnas devuelven — así el límite de datos públicos vive en **una sola función auditable**, no en una policy de RLS que después alguien podría reinterpretar.

Campos que `search_players`/`get_public_profile` SÍ devuelven (según Backend_Infraestructura.md §5.1, "visibles para autenticados"): `username`, `display_name`, `first_name`, `last_name`, `avatar_url` (hoy siempre null, Bloque 2 no implementó Storage todavía), `competitive_branch`, `dominant_hand`, `preferred_side`, Nivel público (`round(mu,1)`), estado de Nivel (`PENDIENTE`/`CALIBRANDO`/`CALIBRADO`/`RECALIBRANDO`), progreso de calibración (`rated_matches`/`distinct_opponents`), localidad (label, no el `location_id` interno).

Campos que **nunca** salen de estas RPCs (§5.1 "privados"): email, `birth_date` exacto (ni siquiera la edad calculada — revela casi lo mismo), género personal, `auth_user_id`/cualquier identificador de Auth, `terms_version`/`terms_accepted_at`, `mu` interno sin redondear.

Nota importante: `round(mu, 1)` acá es **solo formato de presentación** de un valor ya oficial (persistido por Bloque 3), no un recálculo de la fórmula — no reabre el principio "el motor vive en un solo lugar" de Bloque 3, que aplica a **calcular** Nivel, no a redondearlo para mostrarlo.

Anti-enumeración (§10.4, "razonable" para un piloto de 10–20 personas, sin construir infraestructura nueva):
- `search_players` exige `authenticated` (nunca `anon`), longitud mínima de query, y un tope duro de filas server-side.
- `create_claim_link`/`claim_provisional_player` dependen de un token de 256 bits — fuerza bruta no es práctica.
- Un contador de intentos por usuario/IP (rate limiting real) **no lo recomiendo construir en este bloque**: es infraestructura nueva (tabla de contadores + función de guard) para una escala de 10–20 usuarios donde el riesgo real es bajo. Lo marco como decisión a confirmar en §11, con la opción de agregarlo más adelante si el piloto muestra abuso.

---

## 5. Integración mínima con la UI existente

Reutilizar la UI actual, **no duplicarla**, adaptando 3 puntos concretos:

1. **`renderPlayerSearchResults(query)`**: si `Auth.isConfigured()` (cuenta `serverBacked`), reemplazar `ML.buildJugadorDirectory(...)` por una llamada a `Auth.searchPlayers(query)` (wrapper nuevo en `auth.js`, mismo patrón que `isUsernameAvailable`). El camino sin backend queda exactamente igual.
2. **`buildPlayerRowHTML`/`computePlayerRowLevel`**: ambas resuelven hoy la cuenta buscando por nombre en `Store.loadUsers()` — eso nunca va a encontrar a otra persona real. Necesitan una variante que reciba la fila **ya resuelta por el servidor** (`{name, handle, levelText, playerId}`) en vez de re-resolver localmente. Propongo una función hermana (`buildPlayerRowHTMLFromServerRow(row)`) en vez de complicar la función existente con una rama condicional — más simple de leer y de testear por separado.
3. **`openPlayerPublicProfile`/`renderPlayerPublicProfile`**: extender la firma para aceptar `{name, playerId}` además de un string plano (mismo criterio que `PH.filterMatchesForPlayer` ya acepta hace tiempo). Con `playerId` presente y backend configurado, `renderPlayerPublicProfile` llama `Auth.getPublicProfile(playerId)` en vez de `Store.loadUsers().find(...)`. Dos ajustes de contenido necesarios en esa rama:
   - **Ocultar "edad"** (el campo de perfil público hoy la calcula desde `birth_date`, que es privado — no debe mostrarse para otra persona real).
   - **Ocultar la tarjeta de Ranking** (`renderPlayerPublicRankingCard`) para una cuenta real ajena: esa tarjeta corre sobre el Ranking simulado local (`RK.computeProfileRankingSummary`), que no tiene sentido ni datos reales para otra persona hasta Bloque 7.

Nada de esto rompe el camino local/legacy existente: son ramas nuevas gateadas por `Auth.isConfigured()` + la presencia de `playerId`, igual que ya hace todo el código de Bloque 2/3 en `app.js`.

**Fuera de esta integración mínima (mencionado, no resuelto en Bloque 4):** la pestaña "JUGADORES" (`Store.loadAddedPlayers`, nombres planos) y el "agregar jugador libre" de la carga manual siguen siendo 100% locales — tocarlos de fondo es trabajo de Bloque 5 (carga de partidos), no de este bloque.

---

## 6. Estrategia para provisionales y claim

### Crear/reutilizar

`create_or_reuse_provisional_player`: dedup **solo contra las provisionales que el mismo creador ya generó** (`created_by_player_id` + nombre normalizado) — nunca contra el universo global. Esto es intencional: fusionar por nombre entre creadores distintos violaría "nombres iguales NUNCA se fusionan automáticamente" (handoff §3); acá el "match" es literalmente la misma persona (el creador) reintentando la misma acción, no una heurística de identidad.

### El problema difícil: preservar el mismo `player_id` sin romper `auth_user_id unique`

Cuando alguien reclama, la cuenta que se está registrando en ese momento **ya tiene** un `player_id` propio (P2) creado automáticamente por el trigger de Bloque 3 en cuanto confirma su email — y la identidad provisional (P1) es la que necesita terminar siendo "la cuenta". No pueden coexistir dos filas de `players` con el mismo `auth_user_id` (constraint existente, no se toca).

**Diseño propuesto — reclamo ANTES de terminar el onboarding de Bloque 3, nunca después:**

1. La persona abre el link de reclamo (`?claim=<token>`, ver §6 "Entrada por link" más abajo) y se registra normalmente (email + contraseña, Bloque 3 sin cambios). El trigger crea su P2 (`players`+`profiles` vacío +`level_states` PENDIENTE) exactamente como siempre.
2. Apenas confirma el email (mismo punto donde hoy `resumeDraftFlow` decide el siguiente paso), si hay un token de claim pendiente en el borrador local, el cliente llama **primero** a `claim_provisional_player(token)` — **antes** de perfil mínimo/Nivel.
3. `claim_provisional_player`, en una sola transacción:
   - bloquea la fila de `provisional_claims` (`for update`), confirma `status='pending'` y `expires_at > now()` (si no, `claim_invalid_or_expired`);
   - confirma que el `player_id` del caller (P2) es un alta **recién creada sin perfil todavía** (`profiles.username is null`) — si el caller ya tiene un perfil completo, `account_already_registered` (política explícita de "reclamar una segunda identidad se resuelve a mano", §9.2/§15.5, nunca automático);
   - borra `pilot_events` de P2 y borra la fila `players` de P2 (cascada a su `profiles`/`level_states` vacíos — no hay nada de valor que perder, se creó hace segundos);
   - actualiza P1: `auth_user_id = <el del caller>`, `type='registered'`;
   - **inserta en P1** las mismas 2 filas que el trigger de Bloque 3 ya sabe insertar: `profiles(player_id)` vacío y `level_states(player_id, status='PENDIENTE')` — P1 nunca pasó por el trigger, necesita el mismo bootstrap;
   - marca el claim `status='claimed'`, `claimed_at=now()`, `claimed_by_player_id=P1`;
   - devuelve el `player_id` adoptado (P1).
4. El cliente sigue el flujo de Bloque 3 **sin ningún otro cambio**: `complete_profile`/`officialize_level_onboarding` resuelven `player_id` dinámicamente desde `auth.uid()`, que ahora apunta a P1 — cero código nuevo ahí.

**Por qué "antes, nunca después":** si se permitiera reclamar con un perfil ya completo, habría que migrar `profiles`/`level_states` ya poblados de P2 a P1 — una fusión de verdad, exactamente lo que §9.2 dice que "no se construye todavía". Exigir que el claim ocurra en la ventana en la que P2 todavía está vacío evita ese problema por completo, sin sacrificar ningún caso de uso real (nadie tiene motivo para terminar de crear una cuenta normal y DESPUÉS decidir reclamar una identidad ajena).

**Decisión a confirmar (no la until resolví yo solo):** el bootstrap de `profiles`+`level_states` para P1 (paso 3) duplica 4 líneas que también existen en `handle_email_confirmed`. Dos caminos:
- (a) duplicarlas dentro de `claim_provisional_player` (cero cambios sobre el trigger de Bloque 3, algo de repetición);
- (b) extraer un helper interno (`bootstrap_confirmed_identity(player_id)`) que ambas funciones llamen — evita la repetición, pero técnicamente es un `CREATE OR REPLACE` sobre el trigger de Bloque 3 (mismo comportamiento, otro cuerpo).
Recomiendo (a) por default, dado el pedido explícito de "no reabrir Bloques 1–3 salvo regresión concreta" — pero lo dejo para tu confirmación porque es exactamente el tipo de decisión que el handoff pide no tomar en silencio.

### Entrada por link (3 casos)

- **URL:** `?claim=<token>` como query param (esta PWA no tiene router, así que se lee en el boot de `app.js`, se guarda con una clave local nueva de una sola ranura — mismo patrón que `SIGNUP_DRAFT` de Bloque 3 — y se limpia de la URL con `history.replaceState` para no reprocesarlo en un refresh).
- **Ya con sesión, perfil completo:** mensaje explicando que esa cuenta ya tiene perfil y que reclamar una segunda identidad se resuelve a mano durante el piloto (nunca automático).
- **Ya con sesión, perfil incompleto (raro):** puede reclamar directo, mismo `claim_provisional_player`.
- **Necesita login:** pantalla de login con aviso de a quién va a reclamar; después de loguear, mismo chequeo de perfil completo/incompleto.
- **Necesita registrarse:** wizard de Bloque 3 normal, con el token viajando en el borrador local hasta el punto descrito arriba (paso 2).

Esto es un **único punto de integración aditivo** con el flujo de Bloque 3 (una llamada nueva, condicional a que exista un token pendiente) — nunca cambia el comportamiento para quien no llega desde un link de reclamo.

### Recientes/red (§6.E del handoff)

Sin `matches` reales todavía, no existe una señal genuina de "con quién compartí cancha" para una cuenta real. Recomiendo que, para cuentas `serverBacked`, la sección "Recientes" de Buscar Jugadores quede simplemente vacía/oculta (Estado Cero, nunca inventada) hasta que Bloque 5 dé partidos reales — exactamente lo que pide el handoff ("explicitarla como contrato preparado... en vez de inventar datos"). El camino local/legacy (histórico de este dispositivo) sigue mostrando sus "Recientes" de siempre, sin tocarlo.

---

## 7. Qué puede validarse en Bloque 4 sin partidos reales, y qué queda como contrato para Bloque 5

**Validable ahora:**
- búsqueda real devuelve cuentas reales, nunca provisionales, con los campos públicos correctos;
- crear una provisional, generar su link, reclamarlo desde una cuenta nueva, terminar el alta normal sobre el `player_id` adoptado;
- una provisional nunca aparece en `search_players`;
- un `player_id` de provisional se mantiene estable (no cambia) al ser reclamado — el `UPDATE` es sobre la misma fila, nunca un `player_id` nuevo;
- duplicados/segunda identidad rechazados según política manual del piloto.

**Queda como contrato para Bloque 5 (no se puede demostrar hasta que existan `matches`):**
- "al reclamar una identidad todavía vinculada a un partido pendiente, habilitación inmediata para actuar por la pareja correspondiente" (handoff §3): el diseño de arriba GARANTIZA que el `player_id` no cambia con el claim, así que cualquier `match_participants.player_id` que Bloque 5 cree apuntando a una provisional sigue siendo válido después de un claim posterior, sin ningún trabajo adicional — pero esto solo se puede demostrar funcionalmente cuando `matches` exista;
- "recientes/red relacionada" derivada de partidos compartidos;
- estadísticas/historial acumulado de una identidad provisional.

No hay que adelantar nada de Bloque 5 para dejar esto preparado: alcanza con que `player_id` sea estable, que ya lo es por diseño.

---

## 8. Riesgos/regresiones sobre Bloques 1–3

| Riesgo | Mitigación |
|---|---|
| La nueva policy `players_select_created_by_me` amplía la lectura de `players` — podría, mal escrita, filtrar de más | Probarla explícitamente en `verify-bloque4.mjs` con casos permitidos y prohibidos (RLS), y re-correr `verify-bloque2.mjs` sin modificar para confirmar que `players_select_own` no cambió de comportamiento |
| `claim_provisional_player` borra una fila de `players`/`profiles`/`level_states`/`pilot_events` recién creada por el trigger de Bloque 3 | Solo borra P2 si su perfil sigue vacío (chequeado explícitamente); nunca toca una cuenta con perfil ya completo |
| Duplicar (o refactorizar) el bootstrap de `profiles`/`level_states` que hoy vive solo en `handle_email_confirmed` | Ver la decisión explícita de §6 — cualquiera de las 2 opciones mantiene el comportamiento de Bloque 3 sin cambios observables |
| `search_players`/`get_public_profile` mal acotadas podrían filtrar campos privados (`birth_date`, `gender`, `terms_*`) | La función declara explícitamente cada columna que devuelve (nunca `select *`); test automático que verifica el shape exacto de la respuesta |
| Nueva extensión `pgcrypto` | Estándar de Supabase, de solo lectura de aleatoriedad/hash — no afecta ninguna tabla ni política existente |

No veo ningún riesgo que obligue a tocar `complete_profile`, `officialize_level_onboarding`, `handle_email_confirmed` (más allá de la decisión puntual de §6) ni ninguna tabla de Bloque 1–2.

---

## 9. Tests automáticos necesarios

**RLS/seguridad:**
- `anon` no puede llamar ninguna RPC nueva (`search_players`, `get_public_profile`, `create_or_reuse_provisional_player`, `create_claim_link`, `claim_provisional_player`);
- `anon`/`authenticated` no pueden leer `provisional_claims` directo;
- un usuario puede leer las provisionales que él creó, no las de otro (`players_select_created_by_me`);
- una provisional nunca aparece en `search_players` ni en `get_public_profile`.

**Búsqueda:**
- coincidencia por `@usuario`, nombre, apellido, display name;
- el caller nunca aparece en sus propios resultados;
- query corta (< mínimo) devuelve vacío, no todo el universo;
- el límite server-side se respeta aunque el cliente pida más;
- el shape de la respuesta no incluye ningún campo privado.

**Provisional/claim:**
- crear dos veces con el mismo nombre desde el mismo creador reutiliza la misma fila;
- crear desde creadores distintos con el mismo nombre da filas distintas (nunca fusiona);
- reclamo feliz: token válido → `player_id` adoptado es el de la provisional, P2 desaparece, `complete_profile`/`officialize_level_onboarding` funcionan después sin cambios;
- token vencido rechazado;
- token ya usado rechazado en el segundo intento;
- dos reclamos simultáneos del mismo token: solo uno gana (test de concurrencia real, mismo patrón `for update` que ya usa `officialize_level_onboarding`);
- cuenta con perfil ya completo intentando reclamar → rechazada explícitamente.

**Regresión:**
- `verify-bloque2.mjs` y `verify-bloque3.mjs` sin modificar, ambos en verde después de aplicar la migración de Bloque 4.

**Nuevo script:** `supabase/tests/verify-bloque4.mjs`, mismo formato/estilo que los anteriores (mismo manejo de credenciales, misma limpieza verificando `.ok` en cada borrado).

---

## 10. Prueba manual de Staging propuesta

1. Dos cuentas reales nuevas (A y B) por el flujo normal de signup.
2. Desde A: buscar a B por `@usuario` parcial y por nombre — confirmar que aparece con los campos públicos correctos y sin ningún dato privado visible en la respuesta de red (inspeccionar el payload, no solo la UI).
3. Desde A: crear una provisional "Invitado Piloto", generar el link de reclamo, copiar el token.
4. Abrir el link en una sesión sin cuenta (incógnito): confirmar que aparece el aviso "vas a reclamar a Invitado Piloto", completar signup + OTP, confirmar que termina con el `player_id` original de la provisional (verificable con un diagnóstico tipo `diagnose-bloque2-user.mjs`, o revisando que no haya un `player_id` extra huérfano para ese `auth_user_id`).
5. Intentar reutilizar el mismo link ya usado → debe rechazarse.
6. Terminar el onboarding de Nivel BRAMU de esa cuenta reclamada con total normalidad (perfil mínimo + Nivel + confirmación) para confirmar que Bloque 3 sigue funcionando igual sobre el `player_id` adoptado.
7. Smoke test de que signup/login/recuperación normales (sin ningún `?claim=`) siguen exactamente igual que antes.

---

## 11. Contradicciones y puntos de interpretación

No encontré una contradicción real entre `Backend_Infraestructura.md` y `Experiencia_Inicial.md` — son consistentes entre sí. Sí hay 2 puntos de interpretación que prefiero dejar explícitos en vez de decidirlos solo:

1. **`canonical_player_id`** (§6.1) está reservada para "una unificación administrativa futura" — un mecanismo DISTINTO del claim que diseñé acá (que sí funde/borra filas). Mi diseño no usa ni depende de esa columna; la dejo intacta para lo que sea que Bloque 9 (endurecimiento) o una herramienta de administración futura decida hacer con duplicados reales entre cuentas YA registradas. Lo marco para que quede claro que son dos mecanismos distintos, no que uno reemplaza al otro.
2. **"Recientes/red" definida como derivada de partidos** (§9.4/§8.4.5): ambos documentos atan explícitamente "reaparecer" a partidos compartidos, que no existen hasta Bloque 5. Interpreté que, mientras tanto, la única relación real que Bloque 4 puede ofrecer es "provisionales que yo mismo creé" — y que esto NO debe mostrarse bajo la etiqueta "Recientes" (que ya tiene un significado específico en la UI local) sino, si acaso, en un lugar propio ("jugadores que invité"). Esto es una interpretación razonable, no una regla escrita explícitamente en los documentos — la marco para confirmación.

---

## 12. Recomendación sobre duración del token de claim

**Recomiendo 30 días**, con rotación libre en cualquier momento (`create_claim_link` puede volver a llamarse cuantas veces haga falta, invalidando el anterior).

Por qué: el caso de uso es "invitar a un compañero de pádel a sumarse", compartido por WhatsApp — no es un flujo de seguridad sensible tipo recuperación de contraseña (ahí 60 minutos tiene sentido porque el riesgo de una cuenta comprometida es alto y la expectativa de uso es inmediata). Acá:
- **riesgo de un token robado/filtrado:** bajo — en el peor caso alguien reclama una identidad provisional sin datos sensibles (nombre + estadísticas de pádel), y el propio documento ya prevé que los duplicados/reclamos incorrectos se resuelven a mano durante el piloto;
- **expectativa de uso real:** una invitación social puede tardar días en abrirse (la persona no tiene apuro, puede estar de viaje, puede decidirlo el fin de semana);
- un plazo corto (ej. 24–72h) generaría fricción real (el creador tendría que acordarse de regenerar y reenviar el link) sin reducir un riesgo que ya es bajo.

30 días es también consistente con la única otra ventana temporal "larga" que el producto ya usa (30 días para que un partido pendiente se resuelva, `Backend_Infraestructura.md` §5.5) — mismo orden de magnitud para "tiempo razonable para que alguien actúe". Queda pendiente tu confirmación explícita, tal como pide el handoff.

---

## Resumen de decisiones que necesitan aprobación antes de implementar

1. Duración del token de claim: **30 días** (recomendado) — confirmar o ajustar.
2. Bootstrap de `profiles`/`level_states` en el claim: duplicar 4 líneas dentro de `claim_provisional_player` (recomendado, no toca Bloque 3) vs. extraer un helper compartido con `handle_email_confirmed` (evita duplicación, sí toca el cuerpo del trigger).
3. Habilitar la extensión `pgcrypto` (estándar, de bajo riesgo) para generación/hash de tokens.
4. No construir rate limiting dedicado (tabla de contadores) para búsqueda/claims en este bloque — confiar en: `authenticated`-only, longitud mínima de query, límite duro de resultados, y alta entropía del token. Confirmar que esto es "razonable" para el piloto o si se prefiere algo más.
5. "Recientes" queda vacío/oculto para cuentas reales hasta Bloque 5 (nunca inventado) — confirmar que esto es aceptable para el producto en esta ronda.
6. No tocar todavía la pestaña "JUGADORES" (`Store.loadAddedPlayers`) ni el "agregar jugador libre" de la carga manual — quedan explícitamente fuera de esta ronda.
