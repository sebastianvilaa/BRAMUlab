# Backend Bloque 7 — Resultado de Fase 5 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `f0e73ff3e2ce93b84332c640465489c359b4e8b4` (`19_Handoff_Fase_5_Claude.md`).
**Alcance ejecutado:** frontend real de Ranking conectado a las RPCs de Fase 3, gate "Completar datos para Ranking", tarjetas de Perfil/Home server-backed, retiro del fallback productivo a mocks, tests, bump de bundle/service worker. **No se tocó backend/Supabase, `pg_cron`, Vercel, `main`, Production ni BRAMUlive.** No se empezó BRAMU Intelligence. No se inició QA de navegador contra Staging real (queda para ChatGPT central, tal como pide el handoff §"No hacer"/final).

---

## 1. Archivos principales

- `bramulab/ranking.js` — nueva sección de wrappers RPC server-backed (`isRemoteConfigured`, `getCurrentRankingEdition`, `getRankingClassification`, `getMyRankingPosition`, `getRankingNetwork`, `setRankingNetworkHidden`, `getProfileRankingSummary`, `getHomeRankingInsight`) + `mapServerMovement`/`formatServerPeriodLabel` (puras). El universo mock/orden/movimiento local (`buildScopeUniverseNames`, `rankEntries`, `computeWeeklyMovement`, etc.) **no se tocó ni se borró** — ver §5.
- `bramulab/auth.js` — `completeRankingProfileData(fields)` (RPC `complete_ranking_profile_data`, nunca reutiliza `completeProfile`); `fetchOwnProfile()` ahora copia `rankingOptIn`/`locationVerifiedForRanking` al objeto cacheado (ya viajaban en el mismo `select`, solo no se leían).
- `bramulab/app.js` — pieza más grande de la ronda:
  - `computeRankingView()` pasa a ser el único punto de decisión (`Auth.isConfigured() && user.serverBacked` → `computeRankingViewServerBacked`/`computeRankingNetworkViewServerBacked`; si no, `computeRankingViewLocal`, la función histórica renombrada sin tocar su cuerpo);
  - `buildServerSelfStatus` traduce `reasonCodes`/`isEligible` al mismo vocabulario de `selfStatusCopy`;
  - `renderRankingContent`/`onRankingFilterChanged`/`onRankingSearchInput`/`locateMeInRanking`/`loadMoreRanking`/`closeRankingSearch` pasan a async con `rankingRequestToken` (descarta respuestas tardías) y debounce de 300ms en la búsqueda server-backed;
  - `buildRankingRowHTML`/`buildUnrankedRowHTML`/`wireRankingRowClicks`/`rankingUsernameMap` aceptan filas server-backed (`username`/`playerId` reales, `showMovement:false` para Mi red) sin romper el camino local;
  - gate "Completar datos para Ranking" (`rankingGateMissingFields`, `openRankingGateModal`, `submitRankingGateModal`, `initRankingGateModal`) antes de `openRankingScreen()`;
  - `renderRankingCardForAccountServerBacked` (Perfil público + Mi Perfil) y el insight de Home (`TU MOMENTO`) en modo server-backed, con actualización en segundo plano (mismo patrón que `refreshB6Notifications`).
- `bramulab/index.html` — `#ranking-gate-modal-scrim` (modal bloqueante nuevo, reutiliza `.overlay`/`.option-row`/`.profile-select-row`/`.toggle-switch`, **cero CSS nuevo**); `#player-public-ranking-card` deja de forzarse `hidden=true` en el camino server-backed.
- `bramulab/sw.js` — `CACHE_NAME` y `CORE_ASSETS` de `-h19` a `-h20`.
- `bramulab/tests.html` — 21 tests nuevos (`B7F5-RPC`/`B7F5-PURE`) para los wrappers de `ranking.js`.

---

## 2. RPCs conectadas

Las 7 de lectura (Fase 3) + `complete_ranking_profile_data` (Fase 1/2), todas vía los wrappers de `ranking.js`/`auth.js` — nunca una llamada `.rpc()` cruda desde `app.js`, mismo patrón que `auth.js`/`matches.js`/`match-validation.js`. El navegador nunca recalcula posición, empate, denominador, densidad ni movimiento: todo sale tal cual de la respuesta (`_bloque7_scope_rows`/`_bloque7_compute_movement` ya lo resuelven server-side).

`scope_key` nunca viaja como parámetro del cliente (handoff Fase 3 §4, respetado tal cual): el wrapper de `getRankingClassification` solo manda `scope_type`.

Global bloqueado pasa de ser una constante fija (`RK.GLOBAL_UNLOCKED`, prototipo local) a una lectura real de `densityStatus === 'locked'` devuelta por `get_ranking_classification`.

---

## 3. Gate "Completar datos para Ranking"

Implementado exactamente como pide Ranking_BRAMU.md §13.7.A: modal bloqueante ANTES de `showView('ranking')` (nunca dentro de la pantalla), gatea sobre los 3 campos (`competitiveBranch`, `rankingOptIn === true`, `locality`) leídos del `Store.getCurrentUser()` ya cacheado — sin necesitar que exista una edición publicada todavía (a diferencia de `get_my_ranking_position`, que solo expone `reasonCodes` cuando SÍ hay edición; ver §7, esto era necesario porque Staging hoy no tiene ninguna edición real). Persiste exclusivamente vía `complete_ranking_profile_data` (nunca `complete_profile`). Al guardar, recachea el perfil (`fetchOwnProfile` + `cacheServerUser`) antes de entrar a Ranking, para que el gate no vuelva a dispararse en el mismo intento.

Solo aplica a cuentas `serverBacked` con `Auth.isConfigured()`. Cuentas locales/legacy conservan el `sin-ubicacion` histórico dentro de la pantalla (ese modelo no tiene `competitiveBranch`/`rankingOptIn` reales).

Se agregó una acción "VOLVER" (no pedida explícitamente por el handoff, pero necesaria: ningún otro modal de la app deja al usuario sin salida — mismo criterio que `#update-available-modal`). Vuelve a Home; el gate se reevalúa la próxima vez que se toque Ranking.

---

## 4. Estado del mock — sin fallback productivo

`Auth.isConfigured()` es la bisagra única, mismo criterio que el resto del repo (`playerPublicPlayerId && Auth.isConfigured()` en Perfil público, etc.). Con backend configurado y una cuenta `serverBacked` (el único caso posible en Staging/Production — toda cuenta real creada vía el flujo de alta real queda `serverBacked: true`), Ranking **siempre** consulta RPCs reales; si una falla, se muestra un estado de error real (`renderRankingErrorCard`), nunca datos inventados.

El universo mock/local (`ranking.js`, sin tocar) sigue existiendo **exclusivamente** para desarrollo sin backend configurado (`Auth.isConfigured() === false`) — un estado que no puede ocurrir en Staging/Production real. Esto es la variante explícitamente permitida por el handoff §9 ("datos demo solo pueden quedar aislados... si ya existe un mecanismo claro y no puede filtrarse a Staging/Production") — se prefirió conservarlo en vez de borrar ~500 líneas y ~1300 líneas de tests ya existentes y verdes, reduciendo el riesgo de esta ronda sin comprometer la regla real (cero mock en producción).

---

## 5. Qué NO se replicó 1:1 — limitaciones reales documentadas

- **Mi red no tiene movimiento semanal por miembro.** `get_ranking_network` (Fase 3) no lo calcula — contrato de backend, no un bug de esta capa. Las filas de Mi red server-backed nunca muestran badge de movimiento (`showMovement:false`), en vez de inventar un "—" que se leería como "mismo puesto".
- **Mi red no distingue CALIBRANDO de INACTIVO por persona.** La RPC no expone `reasonCodes` de terceros (privacidad, handoff Fase 3 §6). Todo miembro sin puesto cae en un único badge genérico "SIN POSICIÓN EN EL RANKING".
- **"Comparación simple" (1-2 elegibles) de Mi red no arma la mini-tarjeta "Tu posición" en modo server-backed** — sin `position` numérico ni reason codes no hay forma honesta de confirmar que self es uno de esos 1-2 elegibles (podría estar afuera). Self sigue apareciendo en la lista general igual.
- **Copy de "calibrando" genérico en modo server-backed** (`buildServerSelfStatus`): sin partidos/rivales distintos numéricos expuestos por `get_my_ranking_position`, el texto no repite "N PARTIDOS · M / 3 RIVALES" como el prototipo local — dice "Todavía estás calibrando tu Nivel BRAMU."

Ninguna de estas simplificaciones inventa datos: todas optan por menos detalle antes que un dato no respaldado por la RPC.

---

## 6. Tests

- `tests.html`: **1471/1471 — todo verde** (1450 preexistentes + 21 nuevos, corridos en un navegador real contra un servidor estático local — no Staging, no Supabase real).
- 21 tests nuevos (`B7F5-RPC`/`B7F5-PURE`): sin `PLAuth` (entorno real de este harness — `auth.js` no se carga en `tests.html`, mismo criterio ya vigente para `matches.js`/`match-validation.js`) las 7 RPCs nunca lanzan y devuelven `{ok:false, code:'not_configured'}`; con un cliente Supabase fabricado dentro del propio test (mock local, restaurado en `finally`), se verificó mapeo exacto de parámetros para cada RPC (incluido `p_level_band: null` nunca `0`/`undefined`, `p_limit` cayendo al default 50) y passthrough sin recálculo de la respuesta; más los 2 casos de `mapServerMovement`/`formatServerPeriodLabel` (funciones puras).
- `app.js` sigue sin cobertura unitaria por diseño (convención ya vigente del repo, ver `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`) — el gate, `computeRankingViewServerBacked` y las tarjetas server-backed no tienen test unitario; se verificaron manualmente (ver §7).
- No se corrió ningún test contra Supabase/Staging real.

---

## 7. Validación manual realizada (local, sin backend real)

Levantado un servidor estático local (`python3 -m http.server`, sin `env.generated.js` — `Auth.isConfigured()` naturalmente `false`) y verificado en el navegador:

- la app carga sin errores nuevos en consola (el único 404 preexistente es `env.generated.js`, esperable sin backend configurado);
- una cuenta local con historial real abre Ranking, filtros, búsqueda y todo el camino mock/local exactamente como antes — cero regresión visual/funcional;
- forzando `Auth.isConfigured()` y `user.serverBacked` a `true` por consola (sin credenciales reales, solo para ejercitar el gate): el modal "Completá tus datos para el Ranking" abre bloqueando Ranking, la rama competitiva selecciona, la fila de ubicación abre la hoja GeoRef real y persiste la selección (`Bella Vista, Buenos Aires`), el switch de opt-in cambia de estado, "GUARDAR Y CONTINUAR" intenta la RPC real y — sin cliente Supabase real detrás — muestra el error `not_configured` correctamente en vez de fallar en silencio; "VOLVER" cierra el modal limpio y vuelve a Home.

No se declara ningún resultado como validado contra Supabase/Vercel Staging real — eso queda para ChatGPT central, consistente con el resto de Bloque 7 y con la instrucción explícita de no iniciar QA de navegador por cuenta propia.

---

## 8. Bundle / Service Worker

`CACHE_NAME` y las 18 entradas de `CORE_ASSETS` con `?v=` pasan de `04.10-h19` a `04.10-h20` en `sw.js` e `index.html`, en lockstep (verificado: 0 referencias residuales a `h19` en ninguno de los dos archivos). `Store.VERSION`/`version.json` quedan sin cambios en `"BRAMUlab V04.10"` (Backend/Infraestructura no usa la numeración V04.x). `styles.css` no se tocó — el modal nuevo reutiliza clases ya existentes (`.overlay`, `.option-row`/`.option-col`, `.profile-select-row`, `.profile-toggle-row`/`.toggle-switch`, `.setup-section`), cero CSS nuevo.

---

## 9. Bloqueos reales

Ninguno que impida la entrega. Limitación de alcance explícita: sin credenciales/CLI de Supabase en esta sesión (mismo punto que Fase 4), no fue posible ejercitar las RPCs reales contra Staging — solo el mapeo de parámetros/contrato (tests con cliente fabricado) y la UI del gate (con `Auth` parcheado localmente, sin red real). ChatGPT central debe validar contra Staging real: que las 8 RPCs responden con datos reales, que el gate persiste correctamente en `profiles`/`ranking_profile_events`, y que Perfil público/Mi Perfil/Home muestran las tarjetas server-backed con una cuenta real ya calibrada.

---

## 10. DECISIÓN ABIERTA

Ninguna decisión de producto pendiente — `Ranking_BRAMU.md` + `19_Handoff_Fase_5_Claude.md` resolvían todo lo necesario. Dos simplificaciones de implementación quedaron documentadas en §5 (no son decisiones de producto: son consecuencia directa de lo que las RPCs de Fase 3 exponen hoy) — si central quiere cerrar esos gaps (movimiento en Mi red, distinguir calibrando/inactivo de terceros), requeriría extender el contrato de `get_ranking_network`, fuera de alcance de esta fase.

---

**Fin de Fase 5. No se tocó Supabase/Vercel/main/Production/BRAMUlive. No se empezó Intelligence. No se inició QA de navegador contra Staging.**
