# BRAMUlab V03.7 — Cierre de geografía del Ranking + Ranking BRAMU en Perfil público

**Estado:** implementada y publicada.
**Base:** BRAMUlab V03.6 (commit `53e068f`, tag `BRAMUlab_V03.6`, 1003/1003 tests).
**Fuente normativa:** `docs/BRAMUlab/Ranking_BRAMU.md` (§8 ámbitos, §4 snapshot semanal).
**Objetivo:** frente acotado de cierre de V03 — corregir un bug real de geografía en el Ranking y agregar una tarjeta informativa de Ranking BRAMU al Perfil público. No abre V04, no toca Nivel BRAMU/BRAMU Intelligence/backend.

---

## 1. Objetivo

A. **Geografía del Ranking** — Local/Provincial/País mezclaban jugadores de localidades y
provincias sin relación con el ámbito mostrado (bug real reportado en producción: un usuario de
Bella Vista veía Villa Urquiza/Villa Devoto en Local, y CABA/Córdoba en Provincial).

B. **Ranking BRAMU en Perfil público** — agregar una tarjeta informativa (Local/Provincia/País
del corte semanal vigente) debajo de "Mejor racha"/"Mejor nivel BRAMU", calculada siempre sobre
la ubicación del jugador cuyo perfil se está viendo.

## 2. Decisiones

- **Comparación jerárquica, nunca por substring**: el pool de localidades mock de cada ámbito se
  arma comparando campos estructurados exactos (`country`/`region`/`locality`), nunca texto
  parcial. `CABA` y `Buenos Aires` son valores de `region` distintos en `locations.js` — nunca se
  tratan como equivalentes.
- **Local** = únicamente la localidad exacta del usuario. **Provincial** = mismo `country` +
  `region`. **País** = mismo `country` (en este dataset, 100% Argentina, por eso mezcla
  provincias libremente). **Global**/**Mi red** sin cambios.
- **Sin selector de otra ubicación** en esta ronda (ver Ranking_BRAMU.md, idea futura fuera de
  alcance).
- **La tarjeta de Perfil público reutiliza la fuente/snapshot semanal existente** (misma que usa
  la pantalla Ranking) — no se creó una segunda lógica de Ranking ni se recalcula desde el Nivel
  actual en vivo.
- **Las posiciones se calculan sobre la ubicación DEL JUGADOR DEL PERFIL**, nunca de quien mira.
- **Nunca se inventa una posición oficial**: sin cuenta real detrás del nombre, la tarjeta se
  oculta por completo; con cuenta real pero sin elegibilidad completa (calibrando, sin género
  declarado, etc.) se muestra un estado simple ("Completando calibración" / "Todavía sin
  posición oficial") en vez de puestos.
- **Tarjeta puramente informativa**: sin chevrons, sin hover de acción, sin navegación.

## 3. Alcance

- `bramulab/ranking.js`: `scopeLocalityPool` (pool coherente por ámbito), `buildRankingEntries`
  acepta ahora un pool en vez de un booleano fijo, `computeProfileRankingSummary` (resumen para
  la tarjeta de Perfil público).
- `bramulab/app.js`: `computeRankingView` pasa el pool correcto por ámbito; nueva tarjeta en
  `renderPlayerPublicProfile`.
- `bramulab/index.html` / `bramulab/styles.css`: markup y estilos de la tarjeta RANKING BRAMU.
- Tests focales nuevos en `bramulab/tests.html` (geografía + Perfil público).

## 4. Fuera de alcance

Nivel BRAMU, cuestionario, calibración real, BRAMU Intelligence, backend, validación de
partidos, notificaciones, WhatsApp, login, Mis grupos, registro de partidos, selector de otra
ubicación/"explorar otra ubicación" (queda como idea futura, no programada), y la limitación
conocida de localStorage/multi-cuenta (partidos "Observados" cruzados entre cuentas del mismo
navegador) — se resuelve con el futuro modelo multiusuario/backend.

## 5. QA esperado

Mobile 375px primero: Local muestra solo la localidad del usuario; Provincial nunca muestra CABA
ni Córdoba para un usuario de Provincia de Buenos Aires; País mezcla provincias reales; cuenta
sin posición sigue viendo la clasificación completa (V03.6); Perfil público de un jugador
elegible muestra las 3 columnas con período y territorio correctos y no es clickeable; Perfil de
un jugador calibrando/sin cuenta real no muestra posiciones inventadas. Chequeo rápido en
tablet/desktop sin desbordes.
