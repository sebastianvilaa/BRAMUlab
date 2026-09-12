# Reporte BRAMUlab V03.7 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto
operativo de esta ronda. No repite la especificación completa — eso vive en
`BRAMUlab_V03.7.md`, en esta misma carpeta — solo resume qué se hizo realmente, cómo se adaptó
a la arquitectura existente, y en qué estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit:** [`24dc7b8`](https://github.com/sebastianvilaa/BRAMUlab/commit/24dc7b8)
**Tag:** `BRAMUlab_V03.7`
**Base:** `BRAMUlab_V03.6` (commit `53e068f`)
**Documento fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.7.md`

---

## 1. A — Causa real del bug geográfico

`ranking.js` arma el universo mock de cada ámbito territorial con `buildScopeUniverseNames`
(solo nombres) y le asigna una localidad de exhibición vía `mockLocalityAt`. Esa función
**ciclaba siempre sobre el dataset completo de `locations.js` (~180 localidades de TODA
Argentina), sin importar qué ámbito se estaba mostrando** — Local, Provincial y País leían
exactamente el mismo pool. Con eso:

- **Local** (que debería ser una única localidad) mostraba una localidad distinta por fila,
  cicladas del dataset completo — de ahí que un usuario de Bella Vista viera Villa
  Urquiza/Villa Devoto/Villa del Parque mezcladas.
- **Provincial** (que debería excluir CABA y otras provincias) incluía barrios de CABA y
  ciudades de Córdoba, Santa Fe, etc., porque nunca se filtraba por provincia.

No era un problema de agrupamiento de localidades "cercanas" ni de texto: era la ausencia total
de un filtro por ámbito en esa función.

## 2. Solución

Nueva función pura `scopeLocalityPool(scopeKey, userLoc)` en `ranking.js`: arma el pool de
localidades del que puede samplear `mockLocalityAt`, coherente con el ámbito, **comparando
siempre campos estructurados exactos** (`country`/`region`/`locality`), nunca substring ni
coincidencia parcial:

- `local` → pool de una sola localidad: la exacta de `userLoc`.
- `provincial` → localidades de `locations.js` con el mismo `country` **y** `region` que
  `userLoc`. El dataset de `locations.js` ya guarda `CABA` y `Buenos Aires` como valores de
  `region` **distintos** (no hay que "separarlos": ya lo estaban a nivel de dato, el bug era que
  `mockLocalityAt` nunca leía ese campo). Sin `region` en `userLoc`, cae al dataset completo
  (nunca rompe el ámbito por falta de dato).
- `pais` → localidades con el mismo `country` (en este prototipo, el dataset es 100% Argentina,
  así que equivale al dataset completo — por diseño, ahí es correcto mezclar provincias).
- `global` (o sin `userLoc.country`) → sin cambios, el dataset completo.

`buildRankingEntries` (mismo archivo) pasa a aceptar en su parámetro `assignMockLocality` tanto
el booleano legacy (`true`/`false`, compatibilidad con tests existentes y con "Mi red", que
nunca asigna localidad mock) como un **array ya filtrado** por `scopeLocalityPool` — resuelto
por un helper nuevo, `resolveMockLocalityPool`. `app.js` (`computeRankingView`) ahora calcula
`RK.scopeLocalityPool(scope, user)` una vez por render y lo pasa en vez de `true` a los dos
`buildRankingEntries` (edición vigente y edición anterior, para el movimiento semanal). Ningún
cambio de comportamiento en Global, Mi red, elegibilidad, densidad, paginación, búsqueda ni
movimiento semanal.

## 3. Cómo quedaron Local/Provincial/País

- **Local**: todas las filas mock comparten la localidad/provincia/país exactos del usuario
  (confirmado en producción: 20 filas, todas "Bella Vista, Buenos Aires" para un usuario de
  Bella Vista).
- **Provincial**: todas las filas son de la misma provincia/estado que el usuario; nunca
  aparecen filas de otra provincia ni de CABA cuando el usuario es de Provincia de Buenos Aires
  (verificado: 0 ocurrencias de "CABA"/"Córdoba" en el universo generado).
- **País**: mezcla libremente provincias del mismo país (verificado: Buenos Aires + CABA +
  Córdoba conviviendo en las mismas filas).
- **Global**/**Mi red**: sin cambios de lógica ni de comportamiento.

## 4. Cómo se construyó la tarjeta de Perfil público

Nueva función pura `computeProfileRankingSummary(account, history, nowDate)` en `ranking.js`:

1. Calcula el período/corte semanal con las mismas funciones que ya usa la pantalla Ranking
   (`computeRankingWeekPeriod`/`computePreviousRankingWeekPeriod`/`formatRankingWeekRangeLabel`/
   `historySnapshotAsOf`) — la edición "vigente" es la anterior (`previousPeriod`), igual
   criterio que `computeRankingView` en `app.js`.
2. Reutiliza `computeSelfStatus` (ya existente, Bloque 3 de V03.5) para decidir elegibilidad de
   la cuenta — la misma función que decide si el usuario actual tiene posición, aplicada acá a
   `account` (la cuenta del perfil que se está mirando, no necesariamente el usuario logueado).
3. Si es elegible y tiene género declarado, calcula las 3 posiciones con una función interna
   nueva (`computeScopePosition`) que arma el universo EXACTAMENTE igual que `computeRankingView`:
   `buildScopeUniverseNames` + `scopeLocalityPool(scope, account)` + `buildRankingEntries` +
   `filterByGender` + `computeTerritorialDensity` + `rankEntries` — nunca una fórmula nueva de
   Ranking.
4. Devuelve `{ periodLabel, status, scopes: { local, provincial, pais } }`, cada `scopes.X` con
   `{ position, total, territory }` o `null` si el ámbito no alcanza densidad suficiente.

`app.js` (`renderPlayerPublicRankingCard`, llamada desde `renderPlayerPublicProfile`) solo pinta
lo que esa función devuelve: si no hay `account` real detrás del nombre, oculta la tarjeta por
completo; si `status.key !== 'elegible'` (o falta género declarado), muestra el header con un
estado simple ("Completando calibración" para `calibrando`, "Todavía sin posición oficial" para
cualquier otro caso no elegible — sin-nivel, inactivo, sin ubicación, sin género); si es
elegible, pinta las 3 columnas (posición, "de {total}", territorio) y el rango de fechas de la
edición vigente en el header, a la derecha del título.

Markup nuevo en `index.html` (`#player-public-ranking-card`, debajo de "Mejor racha"/"Mejor
nivel BRAMU", antes de los botones de WhatsApp/Agregar jugador) y estilos nuevos en `styles.css`
(`.profile-ranking-card*`) reutilizando tokens existentes (`--paper`/`--paper-dim`/
`--paper-faint`, `.pastilla`/`.pastilla__title-row` tal cual) — sin sombras ni colores nuevos.
La tarjeta es puramente informativa: sin chevrons, sin hover de acción, sin `<button>`/`<a>`.

**Ajuste durante el QA visual:** la primera versión mostraba `Ranking semanal · {rango}` en el
header (mismo prefijo que usa la pantalla Ranking), pero a 375px ese texto competía con
"RANKING BRAMU" y forzaba el título a 2 líneas. Se acortó a solo el rango de fechas (`Lun 31 ago
— Dom 06 sep`, sin el prefijo) — el header ya dice "RANKING BRAMU", el prefijo era redundante —
y se agregó `white-space:nowrap` al título de esta tarjeta. Con eso título y período conviven en
una sola línea a 375px.

## 5. Fuente del snapshot semanal utilizado

La tarjeta **no** recalcula nada desde el Nivel actual en vivo: usa las mismas funciones de
snapshot que ya existían para la pantalla Ranking (`historySnapshotAsOf` sobre
`computeRankingWeekPeriod`), y el mismo criterio de "edición vigente = semana calendario
anterior" que ya usa `computeRankingView`. Test focal que lo confirma: recalcular el universo
Local "a mano" con las mismas piezas (`buildScopeUniverseNames`/`scopeLocalityPool`/
`buildRankingEntries`/`filterByGender`/`rankEntries`) da exactamente el mismo total que devuelve
`computeProfileRankingSummary`.

## 6. Tratamiento de calibrando / no elegible / sin cuenta real

- **Cuenta real calibrando** (o cualquier estado no elegible: sin-nivel, inactivo, sin
  ubicación, opt-out, perfil-privado): la tarjeta se muestra pero sin las 3 columnas — solo un
  texto de estado. `calibrando` → "Completando calibración"; cualquier otro no-elegible →
  "Todavía sin posición oficial". Nunca un `#` inventado.
- **Cuenta real elegible pero sin género declarado**: aunque `computeSelfStatus` la marque
  `elegible` (esa función no mira género), `computeProfileRankingSummary` la trata igual que "no
  elegible" para esta tarjeta — el Ranking nunca clasifica a nadie sin género resoluble en
  ninguna de las dos ramas (regla ya vigente desde V03.5.1), así que tampoco le inventa una
  posición acá.
- **Jugador sin cuenta real** (nombre mock/territorial de Ranking o de Buscar Jugadores, rival
  conocido solo por historial): decisión tomada — **ocultar la tarjeta por completo** en vez de
  mostrar un estado. Es la opción más simple y la preferencia explícita del pedido ("NO mostrar
  datos oficiales ficticios"); mostrar "sin posición oficial" en decenas de filas mock de Ranking
  habría sido ruido sin valor informativo. Verificado en producción abriendo el Perfil público de
  un nombre mock del Ranking (Tomás Aguirre): la tarjeta no aparece en absoluto.

## 7. Archivos tocados

- `bramulab/ranking.js` — `scopeLocalityPool`, `resolveMockLocalityPool`, `mockLocalityAt` ahora
  recibe un pool en vez de ciclar `PLLoc.LOCATIONS` fijo, `computeScopePosition` (interna),
  `computeProfileRankingSummary` (nueva, exportada).
- `bramulab/app.js` — `computeRankingView` calcula y pasa `scopeLocalityPool` por ámbito;
  `renderPlayerPublicProfile` llama a la nueva `renderPlayerPublicRankingCard`;
  `renderProfileRankingScopeCol`/`formatRankingDenominator` (helpers de pintado, sin lógica de
  Ranking).
- `bramulab/index.html` — markup de `#player-public-ranking-card`; cache-bust `?v=03.7` en los
  11 scripts/estilo propios.
- `bramulab/styles.css` — estilos `.profile-ranking-card*`.
- `bramulab/store.js` — `APP_VERSION` → `BRAMUlab V03.7`.
- `bramulab/version.json` — `"BRAMUlab V03.7"`.
- `bramulab/sw.js` — `CACHE_NAME` → `bramulab-v03-7`; `CORE_ASSETS` con `?v=03.7`.
- `bramulab/tests.html` — 17 tests focales nuevos (geografía + Perfil público).

No se tocó ningún archivo de Nivel BRAMU, BRAMU Intelligence, backend, validación de partidos,
notificaciones, WhatsApp, login, Mis grupos ni registro de partidos.

## 8. Tests

**Focales durante el desarrollo** (`bramulab/tests.html`, bloques `V037-GEO` y `V037-PERFIL`,
17 aserciones):

- `scopeLocalityPool`: Local da un pool de una sola localidad; Provincial nunca incluye CABA ni
  Córdoba e incluye varias localidades reales de Provincia de Buenos Aires; País mezcla Buenos
  Aires + CABA + Córdoba.
- `buildRankingEntries` end-to-end con cada pool: Local → todas las filas mock son "Bella Vista,
  Buenos Aires"; Provincial → ninguna fila es de CABA/Córdoba; País → mezcla real de provincias.
- Mi red (`assignMockLocality:false`) sigue sin asignar localidad mock — comportamiento
  anterior intacto.
- Self con cuenta real conserva su ubicación REAL, nunca la mock del ámbito que está mirando.
- `computeProfileRankingSummary`: jugador elegible da `status:'elegible'` + 3 scopes completos
  con posición/total/territorio propios (del jugador del perfil, nunca de quien mira); período
  mostrado coincide exactamente con `formatRankingWeekRangeLabel(computePreviousRankingWeekPeriod(...))`
  (la misma fuente que usa la pantalla Ranking); el total de Local coincide con recalcularlo a
  mano por el mismo camino; jugador calibrando → `scopes: null`; jugador elegible sin género
  declarado → `scopes: null`.

**Suite completa, una sola vez al final** (se toca Ranking, módulo compartido): **1020/1020
tests OK** (1003 de V03.6 + 17 nuevas). Se encontró y corrigió un bug de test propio durante el
desarrollo (la aserción de "Local" no excluía la entrada de `self`, que nunca recibe localidad
mock por diseño — no era un bug de producto).

## 9. QA manual (mobile 375px)

Hecho contra el dev server local con 2 cuentas de prueba reales fabricadas por consola
(`Store.signUpAndLogin`/`Store.createUserAccount`/`Store.upsertHistory`, mismo criterio que
rondas anteriores) para poder ver la tarjeta con datos reales sin jugar partidos manualmente:

- **Local (usuario de Bella Vista):** las 20 filas visibles son "Bella Vista, Buenos Aires" —
  ninguna otra localidad mezclada.
- **Provincial:** 0 ocurrencias de "CABA"/"Córdoba" en el texto de la clasificación cargada;
  localidades reales de Provincia de Buenos Aires (Haedo, Tolosa, Avellaneda, etc.).
- **País:** ocurrencias de "CABA" y "Córdoba" conviviendo con "Buenos Aires" en las mismas filas
  — mezcla válida confirmada.
- **Cuenta sin posición:** aviso "TODAVÍA NO TENÉS POSICIÓN EN EL RANKING" arriba, clasificación
  completa igual de visible debajo, geografía correcta (comportamiento de V03.6 intacto).
- **Perfil público, jugador elegible** (cuenta real con 5 partidos/3 rivales, Rosario/Santa Fe):
  tarjeta "RANKING BRAMU" con período "Lun 31 ago — Dom 06 sep" a la derecha del título (una sola
  línea), 3 columnas LOCAL/PROVINCIA/PAÍS con `#7 de 25 · Rosario`, `#22 de 73 · Santa Fe`, `#57
  de 178 · Argentina` — sin chevrons, sin hover de acción, no clickeable.
- **Perfil público, jugador calibrando** (cuenta real, 1 partido): tarjeta visible con
  "Completando calibración", sin columnas ni puestos.
- **Perfil público, jugador sin cuenta real** (nombre mock del Ranking territorial): tarjeta
  ausente por completo.
- **Tablet (768px):** mismo Perfil público del jugador elegible — 3 columnas entran limpiamente,
  sin desbordes, período a la derecha del título sin envolver.

## 10. Suite completa

1020/1020 (ver §8).

## 11. Commit, tag, cache-bust, deploy

- **Commit:** [`24dc7b8`](https://github.com/sebastianvilaa/BRAMUlab/commit/24dc7b8) — incluye
  únicamente los archivos de este frente (`ranking.js`, `app.js`, `index.html`, `styles.css`,
  `sw.js`, `store.js`, `version.json`, `tests.html`, `BRAMUlab_V03.7.md`). No se agregaron al
  commit los archivos ya modificados/sin seguimiento de otro frente que estaban presentes en
  `git status` al empezar (`BRAMU_Intelligence.md`, `Referencias/`,
  `BRAMU_Intelligence_Implementacion.md`, `Backup/`, `BRAMU_Intelligence_IA_Generativa_...md`,
  `BRAMUlab_V03.5.1_Reporte_ChatGPT.md`, `Logo.ai`) — quedan intactos, sin tocar, tal como
  estaban.
- **Tag:** `BRAMUlab_V03.7`, en el mismo commit.
- **Cache-bust:** `03.7` (sin sufijo `-h`, versión nueva) — `CACHE_NAME`/`CORE_ASSETS` (`sw.js`)
  y los 11 `?v=` de `index.html` (`styles.css` + 10 scripts propios).
- **Deploy:** push a `origin/main` + tag; GitHub Pages (`pages-build-deployment`) completó en
  ~35s. Verificado en el origen: `version.json` responde `"BRAMUlab V03.7"`, `index.html` sirve
  `?v=03.7` en sus scripts, y el edge de CDN (Fastly) ya devolvía el contenido nuevo sin demora
  perceptible esta vez (`x-cache: HIT` con `age: 5`, ya sobre el nuevo `index.html`) — a
  diferencia de V03.6, no hizo falta esperar propagación de CDN.
- **Verificación funcional en producción real:** cuenta descartable nueva (`Prod Check V037`,
  Bella Vista/Buenos Aires/Argentina) confirmó Local mostrando exclusivamente "Bella Vista,
  Buenos Aires" en las 20 filas de la clasificación. Footer de la app muestra
  "BRAMUlab V03.7". La cuenta de prueba se eliminó (`localStorage.clear()`) al terminar — no
  quedó dato de prueba en el navegador de verificación.

## 12. Limitaciones reales pendientes

Ninguna nueva. Se mantiene la limitación ya documentada de V03.6: usando varias cuentas en el
mismo navegador/localStorage, una cuenta nueva puede ver partidos ya existentes en el storage
como "Observados" aunque "Mis partidos" sea 0 — requiere el futuro modelo multiusuario/backend
(participación real ligada por `userId`, nunca por coincidencia de nombre en `localStorage`
compartido). No se tocó Nivel BRAMU, BRAMU Intelligence, calibración real ni backend en esta
ronda.

**Próximo paso:** esta ronda cierra el frente acotado pedido para V03.7. No se avanza a V04. La
siguiente decisión la toma ChatGPT después de auditar este reporte.
