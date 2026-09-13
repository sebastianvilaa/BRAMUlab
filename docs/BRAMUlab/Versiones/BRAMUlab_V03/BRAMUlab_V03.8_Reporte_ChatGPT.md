# Reporte BRAMUlab V03.8 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto
operativo de esta ronda. No repite la especificación completa — eso vive en
`BRAMUlab_V03.8.md` y en el handoff `BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`, en esta misma
carpeta — solo resume qué se hizo realmente, cómo se adaptó a la arquitectura existente, y en
qué estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit:** [`abb2cd3`](https://github.com/sebastianvilaa/BRAMUlab/commit/abb2cd3)
**Tag:** `BRAMUlab_V03.8`
**Base:** `BRAMUlab_V03.7` (commit `24dc7b8`)
**Documentos fuente:** `BRAMUlab_V03.8_Handoff_Cierre_Ranking.md` (spec de esta ronda),
`BRAMUlab_V03.8.md` (versión concisa)

---

## 1. Actualización normativa realizada

`docs/BRAMUlab/Ranking_BRAMU.md` se actualizó ANTES de tocar código, con estos agregados
(ninguno rediseña una decisión ya cerrada — todos son cierres/formalizaciones nuevas):

- **§8.6 (nueva) — Explorar rankings**: definición conceptual de una función futura y separada
  ("¿cómo está el Ranking en otra ciudad, provincia o país?"), explícitamente fuera de V1
  mientras BRAMU tenga poca densidad. Solo documentado — cero código.
- **§13.3 (extendida) — Tarjeta Tu posición**: se agregó el comportamiento cerrado de "contexto
  cercano" (scroll si la fila ya está cargada; cargar la ventana mínima necesaria y llevar ahí
  si no lo está; dejar vecinos visibles) — nunca un ámbito/filtro/pantalla nuevos.
- **§13.6 (nueva) — Home vía Tu momento**: Home nunca duplica la clasificación territorial
  completa; Ranking puede aportar un insight puntual dentro de `TU MOMENTO`, con las 4
  variantes de copy (movimiento positivo/negativo, Nuevo, sin movimiento no fuerza mensaje).
- **§15.1 (nueva) — Tarjeta territorial semanal en Perfil (público y propio)**: registrada como
  superficie oficial de Ranking en los dos lugares, misma fuente/lógica, snapshot del jugador
  del perfil, no clickeable, sin puestos inventados.
- **§19/§22 actualizadas**: 4 reglas nuevas + 3 decisiones cerradas + 1 ítem de "fuera de
  alcance V1" (Explorar rankings), reflejando lo de arriba.
- Fecha de actualización → 13 de septiembre de 2026, con nota explícita de que esta revisión no
  cambia ninguna regla de cálculo/elegibilidad/snapshot (solo cierra UX).

## 2. Cómo se reutilizó la tarjeta en Mi Perfil

Se refactorizó el par de funciones que V03.7 había escrito solo para Perfil público:

- `renderProfileRankingScopeCol(prefix, scopeResult)` → `renderRankingCardScopeCol(idPrefix,
  scopeKey, scopeResult)` (genérica).
- `renderPlayerPublicRankingCard(account, history)` → ahora es un wrapper de una función común
  nueva, `renderRankingCardForAccount(idPrefix, account, history)`, que hace TODO el trabajo
  (ocultar sin cuenta real, resolver `RK.computeProfileRankingSummary`, pintar estado simple o
  las 3 columnas) parametrizado por el prefijo de IDs del DOM.
- `renderPlayerPublicRankingCard` y la nueva `renderMiPerfilRankingCard` solo fijan el
  `idPrefix` (`'player-public-ranking'` / `'mi-perfil-ranking'`) y delegan — **cero lógica de
  Ranking duplicada**, exactamente el mismo `RK.computeProfileRankingSummary` de V03.7.
- Markup nuevo en `index.html`: bloque idéntico al de Perfil público (mismas clases
  `.profile-ranking-card*`), con IDs `mi-perfil-ranking-*`, insertado en MI PERFIL después de
  "Evolución del Nivel BRAMU" (donde vive "Mejor nivel BRAMU" en ese tab — Mi Perfil no tiene
  una tarjeta suelta "Mejor nivel BRAMU" como Perfil público, así que la ubicación más fiel a
  "debajo de Mejor racha/Mejor nivel BRAMU" es después de esa tarjeta de Evolución).
- Llamada agregada en `renderProfileView()`, justo después de `renderProfileEvolution(user)`.

## 3. Ajuste visual (jerarquía tipográfica)

En `styles.css`, sobre las clases compartidas por las dos tarjetas:

- `.profile-ranking-card__pos`: 17px → **22px** (`line-height:1.1` para no sumar alto).
- `.profile-ranking-card__denom`: 11px → 10px.
- `.profile-ranking-card__territory`: 11px → 10px.
- `.profile-ranking-card__col`: `gap` 2px → 1px (compensa la línea más alta del puesto).

Mismo ajuste, automáticamente, en Perfil público y Mi Perfil (clase compartida). Verificado a
375px y 768px en ambas pantallas — sin desbordes, tarjeta sin crecer de alto perceptiblemente.

## 4. Comportamiento final de "TU POSICIÓN"

**Hallazgo del audit de código:** `locateMeInRanking` (app.js, ya existente desde una ronda
anterior — comentario interno la referencia como "§8.2") **ya implementaba** exactamente el
comportamiento pedido:

1. calcula `RK.blockForPosition(myEntry.position)` y sube `rankingLoadedBlocks` a ese valor si
   hace falta (carga la ventana necesaria para que la fila propia quede renderizada);
2. vuelve a pintar la clasificación;
3. en el siguiente frame, hace `scrollIntoView({behavior:'smooth', block:'center'})` sobre la
   fila propia — que queda centrada, con vecinos inmediatos visibles arriba y abajo;
4. sale de cualquier búsqueda activa antes de todo esto; nunca toca scope/género/filtro de
   Nivel.

**Decisión tomada:** no se modificó ese código. Se formalizó en `Ranking_BRAMU.md` §13.3 y se
verificó con QA real en vivo (ver §9) en vez de reescribir una pieza que ya funcionaba —
siguiendo el pedido explícito de "no rediseñar decisiones ya cerradas" y la cláusula de escape
del handoff sobre no introducir una arquitectura de paginación nueva. Único matiz documentado:
`RK.paginate` siempre carga desde el bloque 1 hasta el bloque que contiene la posición propia
(nunca una "ventana aislada" en el medio) — para el tamaño de universo de este prototipo (cientos
de filas, nunca miles) esto es barato y es la solución más simple que preserva la intención.

## 5. Integración exacta en TU MOMENTO

Nueva pieza de dominio, `RK.computeHomeRankingInsight(account, history, nowDate)`
(`ranking.js`): siempre ámbito **Local** (nunca "elige" el ámbito más favorable), reutiliza
`computeSelfStatus`/`computeScopePosition` (las mismas piezas de V03.7) — la única cuenta nueva
es el delta entre la edición vigente y la anterior (`previous.position - current.position`,
la misma resta que ya usa `computeWeeklyMovement` internamente). Devuelve `null` sin cuenta, sin
elegibilidad completa, sin género declarado o sin densidad suficiente — nunca inventa una
posición para poder mostrar algo en Home.

Nueva pieza de presentación, `PH.buildRankingMomentoClause(insight)` (`player-home.js`): da el
texto exacto pedido por la normativa (`Entraste al Ranking de X: #P de T` / `#P de T en X · ↑ N
esta semana` / `#P de T en X · ↓ N esta semana`), o `null` sin movimiento real.

**Cómo se integró sin crear un motor editorial nuevo:** `PH.buildTuMomentoText` ya tenía un
mecanismo de prioridad (hasta 2 "clauses" evaluadas en orden, unidas con ". "). Se agregó
Ranking como UN candidato más dentro de ese MISMO mecanismo, con esta prioridad decidida en
esta ronda (no especificada al detalle por el handoff, documentada acá para que Producto la
confirme o ajuste):

**forma reciente (existente) > Ranking semanal Local (nuevo) > compañero frecuente (existente)
> actividad del mes (existente)**

Razón: forma reciente sigue siendo la lectura más personal (no se la desplaza). Ranking se
prioriza por encima de compañero/actividad porque es información con vigencia semanal (se
vuelve irrelevante en la próxima edición), a diferencia de "tu compañero más frecuente" o
"partidos este mes", que no caducan. El cupo total sigue siendo 2 — si Ranking entra, puede
desplazar a compañero/mes (nunca a forma reciente). Sin `rankingInsight` (parámetro opcional),
el comportamiento es **byte a byte** el mismo que antes de V03.8 (test de compatibilidad hacia
atrás incluido). `renderPlayerHome` (`app.js`) calcula el insight con
`RK.computeHomeRankingInsight(Store.getCurrentUser(), history, new Date())` y se lo pasa a
`PH.buildTuMomentoText` como 3er argumento.

## 6. Archivos tocados

- `docs/BRAMUlab/Ranking_BRAMU.md` — actualización normativa (§1).
- `bramulab/ranking.js` — `computeHomeRankingInsight` (nueva, exportada).
- `bramulab/player-home.js` — `buildRankingMomentoClause` (nueva, exportada);
  `buildTuMomentoText` acepta `rankingInsight` opcional.
- `bramulab/app.js` — `renderRankingCardForAccount`/`renderRankingCardScopeCol` (genéricas,
  reemplazan las versiones V03.7 ligadas solo a Perfil público); `renderMiPerfilRankingCard`
  (nueva); `renderProfileView` la llama; `renderPlayerHome` calcula e inyecta el insight de
  Ranking en `TU MOMENTO`.
- `bramulab/index.html` — markup de la tarjeta en Mi Perfil; cache-bust `?v=03.8` en los 11
  scripts/estilo propios.
- `bramulab/styles.css` — ajuste tipográfico de `.profile-ranking-card__*` (§3).
- `bramulab/store.js` — `APP_VERSION` → `BRAMUlab V03.8`.
- `bramulab/version.json` — `"BRAMUlab V03.8"`.
- `bramulab/sw.js` — `CACHE_NAME` → `bramulab-v03-8`; `CORE_ASSETS` con `?v=03.8`.
- `bramulab/tests.html` — 23 tests focales nuevos.

No se tocó ningún archivo de Nivel BRAMU, BRAMU Intelligence, backend, validación de partidos,
notificaciones, WhatsApp, login, Mis grupos, registro de partidos, ni nada del selector
geográfico/Explorar rankings (no implementado, solo documentado).

## 7. Tests focales

`bramulab/tests.html`, un solo bloque nuevo (23 aserciones):

- **Mi Perfil / misma fuente**: jugador elegible → Local/Provincia/País con posición+total+
  territorio; `periodLabel` coincide con la edición semanal vigente de la pantalla Ranking;
  llamar dos veces a `RK.computeProfileRankingSummary` con los mismos datos da un resultado
  IDÉNTICO (mismo JSON) — la garantía formal de "misma lógica" entre Mi Perfil y Perfil
  público, ya que ambas llaman literalmente a la misma función; calibrando/no elegible →
  `scopes: null`.
- **TU POSICIÓN (contrato puro)**: posición dentro del primer bloque no necesita cargar más;
  posición fuera del bloque inicial queda incluida al recalcular `RK.blockForPosition`/
  `RK.paginate`; posición justo en el borde de un bloque (50) se resuelve bien; el bloque
  calculado deja vecinos inmediatos visibles (índice ni al principio ni al final del array
  paginado).
- **TU MOMENTO**: `buildRankingMomentoClause` para `null`/Nuevo/positivo/negativo/sin
  movimiento/sin dato comparable; `buildTuMomentoText` con forma reciente + Ranking (ambos
  presentes, forma reciente nunca desplazada); sin forma reciente, Ranking ocupa la 1ª
  prioridad disponible y compite por el cupo de 2 (desplaza a "actividad del mes" cuando
  compañero también califica); sin `rankingInsight` → comportamiento IDÉNTICO a antes de
  V03.8 (compatibilidad hacia atrás); sin movimiento → no desplaza al compañero frecuente.
- **`RK.computeHomeRankingInsight`**: cuenta recién calibrada → `isNew:true`/`delta:null`/
  territorio correcto; calibrando → `null`; elegible sin género declarado → `null`.

Durante el desarrollo se encontraron y corrigieron 2 bugs de TEST propios (no de producto): (1)
un nombre de cuenta de prueba con mayúscula interna ("MiPerfil") caía en el mismo problema de
`normalizePlayerName` ya documentado en V03.7 ("QA"→"Qa") — se renombró a "Perfil"; (2) una
aserción de regex sensible a mayúsculas no consideraba que `capitalizeFirst` capitaliza la
primera letra del texto combinado.

## 8. Suite completa

**1043/1043 tests OK** (1020 de V03.7 + 23 nuevas), corrida una sola vez al final.

## 9. QA manual (mobile 375px primero)

Con 3 cuentas de prueba reales fabricadas por consola (mismo criterio de rondas anteriores):

- **Mi Perfil, cuenta elegible** (Bella Vista/Buenos Aires/Argentina, recién calibrada):
  tarjeta "RANKING BRAMU" visible debajo de Evolución, período correcto, `#3 de 21`/`#18 de
  65`/`#59 de 152` con el puesto claramente más grande que antes.
- **Perfil público, misma cuenta**: mismo ajuste visual, mismos números, WhatsApp/AGREGAR
  JUGADOR intactos.
- **Cuenta calibrando**: "RANKING BRAMU / Completando calibración" en Perfil público — sin
  puestos inventados.
- **Ranking, ámbito País** (cuenta en posición #59 de 152, fuera del primer bloque de 50):
  tocar `TU POSICIÓN` cargó el bloque 2 y centró la vista exactamente en la fila propia
  (resaltada, "Nuevo"), con las filas #55–58 arriba y #60–62 abajo visibles — scope/filtros
  sin cambios.
- **Home**: `TU MOMENTO` mostró "Venís de ganar 5 de tus últimos 5 partidos. Entraste al
  Ranking de Bella Vista: #3 de 21." — sin ninguna tarjeta territorial nueva/duplicada en Home.
- **Tablet (768px)**: tarjeta de Mi Perfil sin desbordes, período no envuelve.

## 10. Commit, tag, cache-bust, deploy

- **Commit:** [`abb2cd3`](https://github.com/sebastianvilaa/BRAMUlab/commit/abb2cd3) — incluye
  únicamente los archivos de este frente. No se tocaron los archivos ya modificados/sin
  seguimiento de otros frentes presentes en `git status` al empezar (`BRAMU_Intelligence.md`,
  `Referencias/`, `Backup/`, `BRAMU_Intelligence_IA_Generativa_...md`,
  `BRAMU_Ranking_Handoff_Exploracion_Geografica.md`, `BRAMUlab_V03.5.1_Reporte_ChatGPT.md`,
  `Logo.ai`) — quedan intactos. El propio handoff de esta ronda
  (`BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`) tampoco se agregó al commit (mismo criterio que
  V03.7: los documentos de entrada del usuario no se versionan automáticamente).
- **Tag:** `BRAMUlab_V03.8`, en el mismo commit.
- **Cache-bust:** `03.8` (sin sufijo `-h`, versión nueva) — `CACHE_NAME`/`CORE_ASSETS` (`sw.js`)
  y los 11 `?v=` de `index.html`.
- **Deploy:** push a `origin/main` + tag; GitHub Pages completó en unos segundos. Verificado en
  el origen: `version.json` responde `"BRAMUlab V03.8"`, `index.html` sirve `?v=03.8`.
- **Verificación funcional en producción real:** cuenta descartable (`Prod Check V038`, Bella
  Vista/Buenos Aires/Argentina, recién calibrada) confirmó el footer "BRAMUlab V03.8", `TU
  MOMENTO` mostrando "Entraste al Ranking de Bella Vista: #3 de 21", y la tarjeta de Mi Perfil
  con los mismos datos (`#3 de 21`, territorio "Bella Vista", período correcto). Cuenta
  eliminada (`localStorage.clear()`) al terminar.

## 11. Problemas o decisiones pendientes reales

- **Prioridad de Ranking dentro de TU MOMENTO** (§5): el handoff no fijó un orden exacto entre
  Ranking y compañero/actividad del mes. Se decidió Ranking > compañero/mes (por ser
  información con vigencia semanal) pero nunca por encima de forma reciente. Es una decisión de
  producto razonable pero no explícitamente cerrada antes — queda documentada acá para
  confirmación o ajuste.
- **"TU POSICIÓN" con universos muy grandes**: la solución vigente (cargar todos los bloques
  desde el 1 hasta el que contiene la posición propia) es barata para el tamaño actual de este
  prototipo pero no sería la elegida para un universo de miles de filas — quedaría, en ese
  escenario futuro, como trabajo de backend/paginado real, no de este prototipo.
- Ninguna limitación nueva de datos/identidad — se mantiene la ya conocida de
  localStorage/multi-cuenta (documentada desde V03.6), sin cambios en esta ronda.

**Próximo paso:** esta ronda cierra el frente UX de Ranking BRAMU pedido para V03.8. No se
avanza a V04. La siguiente decisión la toma ChatGPT después de auditar este reporte.
