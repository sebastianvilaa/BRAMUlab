# Reporte BRAMUlab V03.5.2 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora y
el repositorio) para que Sebastián se lo pase a ChatGPT como contexto operativo de esta ronda.
No repite la especificación completa — eso vive en `BRAMUlab_V03.5.2.md` y en la definición
normativa `Ranking_BRAMU.md`, ambos en esta misma carpeta/`docs/BRAMUlab/` — solo resume qué
se hizo realmente, cómo cambió respecto de lo pedido, y en qué estado quedó publicado.

**Nota de esta actualización:** Sebastián revisó la primera versión de este reporte con
ChatGPT y volvieron dos discrepancias conceptuales reales contra `Ranking_BRAMU.md`. Se
corrigieron dentro de esta misma versión (sin abrir V03.5.3) — el detalle está en la §4.2
(Bugs) y reemplaza lo que este reporte decía antes sobre "elegibilidad en vivo". Después de
publicar esa corrección apareció un **bug bloqueante real en producción** (Ranking no abría
para cuentas sin partidos considerados) — corregido como hotfix, ver §4.3.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [`707ec77`](https://github.com/sebastianvilaa/BRAMUlab/commit/707ec77) (hotfix bloqueante) sobre [`ec7f35c`](https://github.com/sebastianvilaa/BRAMUlab/commit/ec7f35cf7bc47a073a5a3746892e2e6b58d09343) (corrección de cierre) sobre [`dd4055a`](https://github.com/sebastianvilaa/BRAMUlab/commit/dd4055af36a8220a0e91786e60a36e65c9d25dac)/[`4037cd1`](https://github.com/sebastianvilaa/BRAMUlab/commit/4037cd1842858a4c59e6074131304202e5257d99) (implementación inicial)
**Tag:** `BRAMUlab_V03.5.2` (mismo tag, movido a `707ec77` — ver §8)
**Base:** `BRAMUlab_V03.5.1`
**Documentos fuente:** `docs/BRAMUlab/Ranking_BRAMU.md` (normativo, revisión 11/09/2026) +
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.5.2.md` (operativo de esta ronda, con su
cierre técnico en el §19)

---

## 1. Qué se implementó realmente

Los dos bloques pedidos, sin recortes de alcance:

### Bloque 1 — Ranking BRAMU semanal

- **Ranking BRAMU pasa de continuo a semanal.** Nivel BRAMU sigue siendo dinámico (cambia
  partido a partido); Ranking se publica una vez por semana: lunes 00:00:00 a domingo
  23:59:59, hora de Buenos Aires (offset fijo -03:00 — Argentina no usa horario de verano
  desde 2009, así que un offset fijo es exacto para este V1).
- **Snapshot semanal simulado** (`RK.computeRankingWeekPeriod`/`historySnapshotAsOf` en
  `ranking.js`): recorta el historial a lo que ya era computable ANTES del corte — usando
  `createdAt` ("cuándo se guardó el registro"), nunca `playedAt` ("cuándo se jugó"), así un
  partido del domingo a la noche cargado el lunes no reescribe la edición recién publicada
  (Caso 2 del documento normativo).
- **Nivel del corte, no el actual**, en Tu posición, fila propia, resto de filas y
  filtros/bandas. Home/Perfil siguen mostrando el Nivel actual sin cambios.
- **Elegibilidad congelada al mismo corte** (calibrando/inactivo/elegible, universo de Mi
  red) — no solo el número de Nivel. Ver §4, corrección de cierre.
- **Identificación de la edición** visible junto a CLASIFICACIÓN: la semana YA CERRADA que
  produjo la edición vigente, nunca la semana calendario en curso. Ejemplo real: mientras se
  transita Lun 07–Dom 13 se muestra `Ranking semanal · Lun 31 ago — Dom 06 sep`. Nunca
  "Actualizado hoy".
- **Movimiento semanal real**: se reemplazó el jitter simulado de V03.5/V03.5.1 (una
  "semana anterior" ficticia con el mismo universo, solo re-nivelado al azar) por una
  comparación real entre dos ediciones — la actual y la anterior, recalculadas ambas contra
  su propio corte. Flechas "↑ N"/"↓ N" (con espacio, nunca puntos) y "Nuevo" cuando no hay
  comparación válida anterior.
- **Ayuda actualizada** con la cadencia semanal, la diferencia Nivel/Ranking, el significado
  de las flechas y la recomendación de cargar el partido apenas termina — sin tono punitivo.

### Bloque 2 — Microajustes UX de la prueba real

- **Lupa activa**: lima mientras la búsqueda está abierta, vuelve a neutro al cerrarla.
- **Bottom sheets responsive**: en desktop, el patrón compartido (`.sheet-scrim`/
  `.bottom-sheet`, usado por los ~11 sheets de la app) centra el panel en vez de anclarlo
  abajo, con las 4 esquinas redondeadas, y `.bottom-sheet--compact` (Registrar partido) deja
  de forzar una altura mínima pensada en mobile — ya no queda "flotando" con aire vacío. El
  selector de género/nivel del Ranking además usa un ancho propio más angosto en desktop
  (dejó de verse "petiso" en una lista corta de 2-3 opciones).
- **Copy de Mis grupos**: `Actual`/`Anterior` → `Semana actual`/`Semana pasada` (Race anual
  sin cambios), sin tocar lógica.

---

## 2. Qué cambió respecto de V03.5.1

V03.5.1 tenía un Ranking continuo: cualquier cambio de Nivel se reflejaba de inmediato en
posición y comparación semanal (esa comparación, además, era un jitter simulado — nunca una
edición anterior real). V03.5.2 reemplaza ese modelo por publicación semanal real, tal como
lo autoriza y pide `Ranking_BRAMU.md` en su revisión del 11/09/2026. La lógica de Nivel BRAMU,
la fórmula de calibración, los ámbitos, Mi red y el resto de la estructura de V03.5.1 quedan
intactos — este documento no reabre esas decisiones.

---

## 3. Adaptaciones respecto del documento

- **"Quedó computable" se mide por `createdAt`, no por `playedAt`.** El prototipo ya tenía
  ese dato desde V03.0 (fecha de procesamiento vs. fecha efectiva) — se reutilizó tal cual,
  sin inventar un campo nuevo para satisfacer el Caso 2 del documento. Esta misma idea
  terminó siendo también el mecanismo para congelar elegibilidad, no solo Nivel (§4).
- **Sin snapshot persistido en `Store`.** `historySnapshotAsOf` recalculado en cada render da
  siempre el mismo resultado mientras no entren partidos nuevos con `createdAt` anterior al
  corte — es funcionalmente un snapshot real sin necesitar una clave de almacenamiento nueva
  ni lógica de invalidación. Queda aislado en dos funciones puras, listas para reemplazarse
  por un snapshot real de backend el día que exista.
- **Mi red de la edición anterior** se recalcula con el reloj y el historial parados en el
  corte previo, para comparar contra una red que realmente existía en ese momento.
- **Ubicación y opt-in/privacidad no quedan congelados** — son campos de cuenta sin historial
  de cambios en este prototipo (no existe un `createdAt` de "cuándo cambiaste tu ubicación").
  Congelarlos exigiría versionar esos campos, una superficie nueva y explícitamente fuera de
  alcance de esta ronda (ver §10, limitaciones). Afecta poco en la práctica: opt-in/privacidad
  no son alcanzables desde la UI todavía, y el universo mock de Local no distingue localidades
  reales (solo importa si tenés alguna declarada o no).

---

## 4. Bugs encontrados y corregidos

### 4.1 Bug de identidad de self (encontrado durante la implementación inicial)

**Real y preexistente de V03.5/V03.5.1**, no introducido en esta ronda pero encontrado al
verificar rigurosamente el Nivel del corte: `computeRankingView` pasaba el nombre plano de
self (`currentPlayerName`, string) a `RK.buildRankingEntries`, nunca `currentIdentity()`
(`{name, userId}`). Por la regla de integridad de `userId` ya vigente desde V03.0, una fila
de partido con `userId` estampado solo es hallable pasando ese mismo `userId` — nunca por
nombre, aunque coincida exacto. En cuanto self jugaba su primer partido (que estampa `userId`
automáticamente), Ranking dejaba de encontrarle ningún partido real y le mostraba el mismo
Nivel simulado por hash que un jugador mock territorial, en vez de su evolución real. Un
número plausible que nunca se notó a simple vista en rondas anteriores porque nada lo cruzaba
contra el Nivel real de Home/Perfil.

Corregido con un parámetro opcional (`selfUserId`) en `buildRankingEntries`, sin romper
compatibilidad con callers/tests que no lo pasan. 3 tests nuevos cubren el caso.

### 4.2 Corrección de cierre — dos discrepancias conceptuales (encontradas al revisar con ChatGPT)

Sebastián revisó la primera versión de esta ronda con ChatGPT y volvieron dos discrepancias
reales contra `Ranking_BRAMU.md`, corregidas antes de dar la ronda por cerrada:

**Punto 1 — período mostrado.** La primera implementación identificaba la edición vigente con
la semana calendario EN CURSO (`period`, la que contiene "ahora"). Esa variable seguía siendo
correcta para el CORTE de Nivel (todo lo registrado antes de `period.start` es "lo consolidado
al cierre del domingo pasado"), pero la edición vigente en sí se identifica con la semana YA
CERRADA que la produjo — la semana calendario ANTERIOR (`previousPeriod`, que ya existía y se
usaba correctamente para el movimiento). Corregido cambiando una sola línea: `periodLabel`
ahora se arma con `previousPeriod`, nunca con `period`. El corte de Nivel no cambió — ya
estaba bien.

**Punto 2 — elegibilidad también debía congelarse.** La primera implementación evaluaba
calibración, inactividad y el universo de Mi red EN VIVO (historial completo, "ahora" real),
congelando solo el Nivel de quien ya fuera elegible — una simplificación que este mismo
reporte documentaba como "adaptación". Sebastián marcó que eso no era correcto: el snapshot
semanal tiene que ser estable en su totalidad, no solo en el número de Nivel. Corregido
reutilizando el MISMO mecanismo ya construido para el Nivel (`historySnapshotAsOf` + el corte
como "ahora"), sin agregar ningún dato ni infraestructura nueva: `computeSelfStatus`,
`computeParticipantStatus` (para cada compañero de Mi red) y `computeNetworkNames` para la
edición vigente ahora reciben `currentSnapshotHistory` y `period.start`, en vez de historial
completo y "ahora" real. Si alguien completa calibración o cruza 180 días de inactividad con
un partido cuyo `createdAt` cae después del corte, ese cambio impacta recién en la próxima
edición — nunca en la ya publicada.

Ambos puntos se verificaron con datos de prueba concretos: un jugador con 5 partidos
computables donde el 5º (el que completaba calibración) tenía `createdAt` posterior al corte
seguía mostrando "Calibrando 4/5" en la edición vigente, y solo pasaba a "Elegible" al
evaluarlo en vivo — exactamente el comportamiento esperado.

6 tests nuevos cubren ambos puntos (`V0352-PERIODO-CORREGIDO` ×2, `V0352-ELEGIBILIDAD` ×4),
incluida una aserción que reproduce el ejemplo numérico exacto de la corrección.

### 4.3 Bug bloqueante en producción (hotfix, encontrado después de publicar la corrección de cierre)

Sebastián reportó que desde Home, tocar el botón de Ranking no abría la pantalla, con
`Uncaught TypeError: (raw || "").replace is not a function` en consola (stack:
`normalizePlayerName` ← `computeSimulatedJugadorLevel` ← `buildRankingEntries` ←
`computeRankingView`).

**Causa exacta:** `PH.computeSimulatedJugadorLevel(history, playerName)` acepta `playerName`
como string O como `{name, userId}` en su camino principal (`computeLevelEvolution`, que ya
resuelve ambos tipos internamente) — pero su rama de *fallback* (cuando el jugador tiene 0
partidos considerados en el `history` recibido) llamaba `Store.normalizePlayerName(playerName)`
directo, sin resolver el ref primero. `Store.normalizePlayerName` siempre esperó un string
(hace `.replace()` sobre él) — correctamente, es su contrato de siempre y lo usa toda la app.
El bug real estaba en `computeSimulatedJugadorLevel`: su propio fallback no respetaba el mismo
contrato de identidad que su camino principal.

Este fallback nunca se había ejecutado con un objeto porque, hasta el fix de identidad de esta
misma versión (§4.1), nadie llamaba a esta función con un ref de objeto. Desde que
`buildRankingEntries`/`rankingSelfBand` empezaron a pasar `{name, userId}` para self (para
corregir el bug de identidad), cualquier cuenta con **0 partidos considerados en el historial
recibido** — una cuenta recién creada, o una cuyo único partido quedó fuera del snapshot
semanal vigente tras la corrección de cierre (§4.2) — disparaba el fallback con un objeto y
explotaba. Bloqueante: pasa para cualquier usuario nuevo que toque Ranking antes de jugar su
primer partido.

**Corrección:** una línea, en el punto exacto del contrato roto — `resolveIdentityRef(playerName).name`
antes de pasarlo a `Store.normalizePlayerName`, reutilizando la misma utilidad de resolución de
identidad que ya usa el resto de `player-home.js` (nunca un parche defensivo en
`normalizePlayerName`, que estaba bien). Preserva intacta la lógica de `selfUserId`/identidad
de V03.5.2.

5 tests nuevos (`V0352-HOTFIX`) cubren el caso: el fallback con ref de objeto y 0 partidos ya
no explota y devuelve el Nivel simulado por hash; con historial real estampado por `userId`
sigue devolviendo la evolución real (nunca el hash); y una reproducción exacta del stack
reportado vía `RK.buildRankingEntries` con self sin partidos.

---

## 5. Decisiones UX materializadas

- El movimiento semanal real (ya no jitter) hace que jugadores mock puedan subir/bajar
  puestos sin haber jugado, cuando el Nivel real de self cambia de posición relativa —
  exactamente el Caso 4 del documento normativo, observado espontáneamente durante el QA de
  esta ronda con datos de prueba.
- El ancho angosto del selector de género/nivel en desktop se resolvió como un modificador
  propio (no el ancho genérico de 768px que usan sheets con más contenido, como la ayuda de
  Ranking o Elegir jugador) — mismo criterio visual que un menú de opciones nativo.

---

## 6. Tests agregados y resultado final

29 aserciones nuevas en `ranking.js`/`tests.html`, todas sobre lógica pura nueva:

- período semanal (lunes 00:00:00 a domingo 23:59:59.999, Buenos Aires) — 9 aserciones;
- snapshot por `createdAt`, incluido el Caso 2 (jugado antes del corte, cargado después) — 4;
- Nivel del corte vs. Nivel actual (un partido posterior al corte no lo mueve) — 2;
- movimiento entre dos ediciones reales, incluida la corrección de "Nuevo" (antes "—", bug
  nunca visible porque el universo "anterior" simulado de V03.5.1 era siempre el mismo set de
  ids que el actual) — 5;
- bug de identidad de self (`selfUserId`) — 3;
- corrección de cierre: período mostrado (la edición activa nunca coincide con la semana
  calendario en curso, y coincide exactamente con el ejemplo "Lun 31 ago — Dom 06 sep") — 2;
- corrección de cierre: elegibilidad congelada (calibración completada e inactividad cruzada
  DESPUÉS del corte no alteran la edición vigente, solo la siguiente) — 4;
- hotfix bloqueante: ref de objeto con 0 partidos considerados no explota, sigue devolviendo
  la evolución real cuando el historial sí tiene partidos, y reproducción exacta del stack
  reportado vía `RK.buildRankingEntries` — 5.

Además se ajustaron 2 aserciones ya existentes a la nueva firma de `computeWeeklyMovement`
(dos universos, no uno) — sin sumar al total, solo corregidas en su lugar.

**Resultado final: 947/947 tests OK** (913 antes de esta ronda + 34 nuevas). El hotfix toca
`PH.computeSimulatedJugadorLevel` (lógica compartida — la usa también Buscar Jugadores, Mis
grupos y Perfil público), así que se corrió la suite completa después de aplicarlo, sin
regresiones en ningún otro lugar que dependa de esa función.

---

## 7. QA realizado

Mobile (375px), tablet (768px) y desktop, con una cuenta y partidos sembrados a propósito
(algunos antes del corte vigente, uno cargado después del corte para probar el Caso 2, y una
edición anterior real con nivel más bajo para poder ver movimiento real). Tras la corrección
de cierre, se revisaron específicamente las superficies afectadas por ambos puntos:

- período semanal visible con el formato correcto, y verificado numéricamente que muestra la
  semana YA CERRADA (no la semana calendario en curso) en Local, tablet y desktop;
- un jugador con calibración recién completada por un partido cargado después del corte
  siguió mostrando "Calibrando 4/5" en la edición vigente — confirmado en vivo, no solo en
  tests — y pasó a "Elegible" al agregar un partido con `createdAt` anterior al corte;
- Mi red con el mismo criterio (universo y calibración por compañero, congelados al corte);
- Nivel del corte distinto del Nivel actual cuando corresponde (verificado con números
  concretos, no solo visualmente);
- movimiento real entre ediciones, incluida una fila mock bajando un puesto sin haber jugado;
- lupa en lima mientras la búsqueda está abierta, neutra al cerrarla;
- selector de género/nivel y Registrar partido en desktop: centrados, sin aire vacío,
  esquinas redondeadas — ya no "flotando";
- el mismo ajuste de sheets verificado también en un sheet con más contenido (ayuda de
  Ranking, variante `--tall`) para confirmar que no rompe nada fuera de lo pedido;
- ayuda actualizada con el copy nuevo;
- Mis grupos con "Semana actual"/"Semana pasada";
- regresión rápida: Mi Perfil con back a Ranking (heredado de V03.5.1, intacto), bottom nav,
  Historial, Home.
- sin errores de consola nuevos, ni en local ni verificado luego en producción.

**Verificación específica del hotfix** (mobile): cuenta nueva con 0 partidos → Home muestra
"CALIBRANDO 0/5" correctamente → tocar el ícono de Ranking del header abre la pantalla sin
excepción (antes tiraba `TypeError` y la pantalla no abría) → muestra el estado "Todavía no
tenés Nivel BRAMU" (correcto para 0 partidos) → volver con la flecha regresa a Home
correctamente. Repetido con la cuenta de prueba con historial real de la corrección anterior:
Nivel del corte sigue mostrando el mismo valor (5.6) y el mismo período — el hotfix no tocó el
camino que ya andaba bien.

---

## 8. Commit, tag, push, deploy

Tres commits en esta ronda: [`dd4055a`](https://github.com/sebastianvilaa/BRAMUlab/commit/dd4055af36a8220a0e91786e60a36e65c9d25dac)/[`4037cd1`](https://github.com/sebastianvilaa/BRAMUlab/commit/4037cd1842858a4c59e6074131304202e5257d99)
(implementación inicial), [`ec7f35c`](https://github.com/sebastianvilaa/BRAMUlab/commit/ec7f35cf7bc47a073a5a3746892e2e6b58d09343)
(corrección de cierre) y [`707ec77`](https://github.com/sebastianvilaa/BRAMUlab/commit/707ec77)
(hotfix bloqueante) — staging explícito en cada uno de solo los archivos tocados, excluyendo
siempre el mismo trabajo paralelo no relacionado (`BRAMU_Intelligence*`, `Referencias/`,
`Backup/`, `Logo.ai`, y el reporte de V03.5.1 sin commitear a pedido de Sebastián). El tag
`BRAMUlab_V03.5.2` se movió una segunda vez, ahora a `707ec77` — sigue siendo la misma versión,
nunca se abrió `V03.5.3`. Push a `origin/main` y al tag (force-push del tag, ya documentado
como flujo aceptado para corregir un release). Deploy de GitHub Pages verificado en producción
antes de dar el hotfix por publicado.

---

## 9. URL publicada

https://sebastianvilaa.github.io/BRAMUlab/bramulab/

---

## 10. Limitaciones conocidas

- Género y Nivel de jugadores mock territoriales siguen siendo simulaciones determinísticas
  por nombre, no datos reales (igual que en V03.5/V03.5.1).
- El snapshot semanal es una función pura recalculada en cada render, nunca un valor
  persistido — funcionalmente equivalente a un snapshot real mientras el historial no cambie
  retroactivamente con partidos de `createdAt` anterior al corte, pero sin auditoría histórica
  de ediciones más allá de la actual y la anterior (el documento reserva esa auditabilidad
  completa para el contrato de backend real, fuera de alcance de este prototipo).
- **Ubicación y opt-in/privacidad no están versionados**: un cambio ahí impacta de inmediato
  en la clasificación en vez de esperar a la próxima edición, a diferencia de calibración/
  inactividad/Nivel (que sí quedan congelados desde la corrección de cierre, §4.2). Afecta
  poco en la práctica por las mismas razones ya explicadas en §3.

---

## 11. Deuda / puntos para la próxima prueba visual

- Confirmar en uso real (no solo datos sembrados) que el movimiento semanal se siente
  creíble semana a semana, con cuentas reales jugando en paralelo.
- Revisar si conviene mostrar explícitamente "Nivel actual: X" al lado del Nivel del corte en
  algún lugar de Ranking, para reforzar la diferencia — el documento solo pide que la ayuda lo
  explique, no un indicador visual adicional, así que no se agregó nada por ahora.
- Con selectores/sheets en pantallas intermedias (720-900px aprox.), confirmar que el ancho
  angosto del picker de género/nivel se sigue sintiendo proporcionado y no demasiado angosto.
- Si en algún momento se decide versionar ubicación/opt-in/privacidad (para que también
  respeten el corte semanal), es una superficie nueva — no algo para resolver "de paso" en un
  microajuste futuro.

---

## 12. Estado de cierre de Ranking BRAMU

**Ranking sigue sin cerrarse definitivamente dentro de V03.** Esta publicación (con su
corrección de cierre incluida) es la segunda ronda de refinamiento (V03.5.1 → V03.5.2), no el
cierre de la función. Sebastián va a hacer una última prueba visual/real después del deploy;
según lo que encuentre, puede pedir `V03.5.3` o microajustes puntuales. No se avanza a Nivel
BRAMU real (V04) ni a ninguna versión nueva sin instrucción explícita.
