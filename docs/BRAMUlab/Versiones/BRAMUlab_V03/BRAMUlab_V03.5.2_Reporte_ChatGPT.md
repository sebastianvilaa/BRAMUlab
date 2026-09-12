# Reporte BRAMUlab V03.5.2 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora y
el repositorio) para que Sebastián se lo pase a ChatGPT como contexto operativo de esta ronda.
No repite la especificación completa — eso vive en `BRAMUlab_V03.5.2.md` y en la definición
normativa `Ranking_BRAMU.md`, ambos en esta misma carpeta/`docs/BRAMUlab/` — solo resume qué
se hizo realmente, cómo cambió respecto de lo pedido, y en qué estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [`dd4055a`](https://github.com/sebastianvilaa/BRAMUlab/commit/dd4055af36a8220a0e91786e60a36e65c9d25dac)
**Tag:** `BRAMUlab_V03.5.2`
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
- **Identificación de la edición** visible junto a CLASIFICACIÓN: `Ranking semanal · Lun 07
  sep — Dom 13 sep`. Nunca "Actualizado hoy".
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
  sin inventar un campo nuevo para satisfacer el Caso 2 del documento.
- **Sin snapshot persistido en `Store`.** `historySnapshotAsOf` recalculado en cada render da
  siempre el mismo resultado mientras no entren partidos nuevos con `createdAt` anterior al
  corte — es funcionalmente un snapshot real sin necesitar una clave de almacenamiento nueva
  ni lógica de invalidación. Queda aislado en dos funciones puras, listas para reemplazarse
  por un snapshot real de backend el día que exista.
- **La elegibilidad propia (Sin Nivel/Calibrando/Inactivo/etc.) se evalúa en vivo**, no contra
  el corte — el documento pide congelar el NÚMERO y el PUESTO de quien ya es elegible, no el
  gatillo de elegibilidad en sí. Congelar también la elegibilidad hubiera exigido reconstruir
  el estado de calibración "tal como era hace una semana" para cada jugador, una complejidad
  no pedida explícitamente.
- **Mi red de la edición anterior** se recalcula con el reloj y el historial parados en el
  corte previo, para comparar contra una red que realmente existía en ese momento.

---

## 4. Bugs encontrados y corregidos

**Uno real y preexistente de V03.5/V03.5.1**, no introducido en esta ronda pero encontrado al
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

23 aserciones nuevas en `ranking.js`/`tests.html`, todas sobre lógica pura nueva:

- período semanal (lunes 00:00:00 a domingo 23:59:59.999, Buenos Aires) — 9 aserciones;
- snapshot por `createdAt`, incluido el Caso 2 (jugado antes del corte, cargado después) — 4;
- Nivel del corte vs. Nivel actual (un partido posterior al corte no lo mueve) — 2;
- movimiento entre dos ediciones reales, incluida la corrección de "Nuevo" (antes "—", bug
  nunca visible porque el universo "anterior" simulado de V03.5.1 era siempre el mismo set de
  ids que el actual) — 5;
- bug de identidad de self (`selfUserId`) — 3.

**Resultado final: 936/936 tests OK** (913 previos + estos 23 nuevos). Además se ajustaron 2
aserciones ya existentes a la nueva firma de `computeWeeklyMovement` (dos universos, no uno) —
sin sumar al total, solo corregidas en su lugar. Corrida una sola vez después de aplicar el
bump de versión, sin regresiones.

---

## 7. QA realizado

Mobile (375px), tablet (768px) y desktop, con una cuenta y partidos sembrados a propósito
(algunos antes del corte vigente, uno cargado después del corte para probar el Caso 2, y una
edición anterior real con nivel más bajo para poder ver movimiento real):

- período semanal visible y con el formato correcto;
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

---

## 8. Commit, tag, push, deploy

Commit [`dd4055a`](https://github.com/sebastianvilaa/BRAMUlab/commit/dd4055af36a8220a0e91786e60a36e65c9d25dac),
staging explícito de solo los archivos de esta ronda (excluyendo a propósito trabajo paralelo
no relacionado que ya estaba sin commitear en el repo: `BRAMU_Intelligence*`, `Referencias/`,
`Backup/`, `Logo.ai`, y el reporte para ChatGPT de V03.5.1, que Sebastián había pedido dejar
sin commitear). Tag `BRAMUlab_V03.5.2`. Push a `origin/main` y al tag. Deploy de GitHub Pages
verificado antes de dar la ronda por publicada.

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

---

## 11. Deuda / puntos para la próxima prueba visual

- Confirmar en uso real (no solo datos sembrados) que el movimiento semanal se siente
  creíble semana a semana, con cuentas reales jugando en paralelo.
- Revisar si conviene mostrar explícitamente "Nivel actual: X" al lado del Nivel del corte en
  algún lugar de Ranking, para reforzar la diferencia — el documento solo pide que la ayuda lo
  explique, no un indicador visual adicional, así que no se agregó nada por ahora.
- Con selectores/sheets en pantallas intermedias (720-900px aprox.), confirmar que el ancho
  angosto del picker de género/nivel se sigue sintiendo proporcionado y no demasiado angosto.

---

## 12. Estado de cierre de Ranking BRAMU

**Ranking sigue sin cerrarse definitivamente dentro de V03.** Esta publicación es la segunda
ronda de refinamiento (V03.5.1 → V03.5.2), no el cierre de la función. Sebastián va a hacer
una última prueba visual/real después del deploy; según lo que encuentre, puede pedir
`V03.5.3` o microajustes puntuales. No se avanza a Nivel BRAMU real (V04) ni a ninguna versión
nueva sin instrucción explícita.
