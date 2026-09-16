# BRAMUlab_V04
## Informe — V04.0 (diagnóstico) + V04.1 (Etapa A) + V04.2 (Etapa B) + V04.3 (Etapa C) + V04.4 (Etapa D, bloque 1) + V04.5 (acceso al preview + versión pública) + V04.6 (estimador inicial V1.1)

**Estado:** V04.0 cerrada (diagnóstico). V04.1/V04.2/V04.3 (motor puro, elegibilidad/invitados/repetición/círculo, cuestionario/ajuste/calibración/recalibración) implementadas, ninguna conectada a la app productiva. V04.4 es la primera ronda con UI real, detrás de un flag. V04.5 simplifica el acceso a ese flag (ícono de header) y bumpea la versión pública visible — la app que Sebastián desarrolla y prueba ahora se identifica como `BRAMUlab V04.5` (`V03.10` queda como tag estable anterior, cerrado). Cada ronda se agrega como sección nueva al final, sin reabrir las anteriores. A partir de V04.5 la numeración es plana (`V04.4`, `V04.5`, `V04.6`...) — sin más subversiones de 3 niveles tipo `V04.4.1`.
**Fecha:** V04.0 el 14/09/2026 · V04.1 el 14/09/2026 · V04.2 el 14/09/2026 · V04.3 el 14/09/2026 · V04.4 el 14/09/2026 · V04.5 el 14/09/2026 (mismo día, rondas separadas, cada una autorizada explícitamente por Sebastián sobre la anterior ya cerrada).
**Base:** `BRAMUlab_V03.10` (sin regresiones detectadas ni reabiertas).
**Objetivo de V04.0:** el definido en `BRAMUlab_V04_Consolidado.md` §8 — auditoría técnica real, dos normalizaciones documentales, plan exacto para Etapa A. Nada más.

---

## 0. Resumen ejecutivo

Se leyeron completos los 6 documentos pedidos, se aplicaron las 2 normalizaciones documentales de §1 del Consolidado (ninguna otra), y se auditó el código real de los 8 archivos listados en §8.2 (más `app.js` con grep dirigido, dado su tamaño — 10.650 líneas). No se escribió ni se modificó ningún archivo de `bramulab/` (código de producto). No se tocó UI, versión pública, `Ranking`, `BRAMU Intelligence` ni Backend.

**Conclusión corta:** no hay bloqueo técnico real para autorizar Etapa A. Hay un único punto de alcance a confirmar antes de programarla (§8 de este informe) — no es una decisión de producto, es una elección de secuencia técnica.

---

## 1. Documentación leída (completa)

1. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.4.md` (fórmula normativa, 847 líneas).
2. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md` (handoff de desarrollo, 202 líneas).
3. `docs/BRAMUlab/Nivel_BRAMU.md` (consolidado funcional base, 494 líneas).
4. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md` (qué se pidió en V03, 234 líneas).
5. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md` (qué se implementó realmente en V03 — leído en profundidad su §0 "Arquitectura vigente" y las secciones con detalle de `store.js`/`player-home.js`).
6. `docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md` (esta ronda).

---

## 2. Normalización documental aplicada (§1 del Consolidado — solo estas dos)

### 2.1 `Nivel_BRAMU_Implementacion.md` §2 "Documentos fuente"

**Antes** apuntaba a 3 nombres de archivo que ya no existen en el repositorio (`docs/bramulab/Nivel_BRAMU_Formula_V1_4_Cerrada.md`, `docs/bramulab/Nivel_BRAMU_Consolidado_Base.md`, `docs/bramulab/Nivel_BRAMU_Handoff_Desarrollo_V1.md`).

**Después:** reemplazados por los 3 nombres vigentes, en el mismo orden de precedencia que fija `BRAMUlab_V04_Consolidado.md` §0 (Formula_V1.4 → Implementacion → Nivel_BRAMU.md), con la descripción de cada uno tomada textualmente de esa misma fuente. No se tocó ninguna palabra de fórmula, regla, parámetro ni alcance — solo los 3 nombres de archivo y su orden.

### 2.2 `Nivel_BRAMU.md` — frases heredadas de "fórmula pendiente"

Se identificaron y marcaron 4 lugares donde el documento todavía afirmaba que la fórmula/parámetros estaban por diseñar o simular (contenido correcto cuando se escribió, superado desde que `Nivel_BRAMU_Formula_V1.4.md` cerró la fórmula):

| Ubicación | Qué decía | Qué se hizo |
|---|---|---|
| Cabecera (`Estado`) | "No implementar la fórmula definitiva sin resolver los parámetros marcados como pendientes." | Se agregó una nota explícita debajo, sin borrar la frase original, aclarando que la fórmula y los parámetros ya están cerrados en `Nivel_BRAMU_Formula_V1.4.md`. |
| §8 (intro) | "La fórmula exacta todavía debe diseñarse y simularse." | Frase tachada (`~~...~~`) con nota de superado, seguida de la lista de comportamientos ya fijados (esa lista sigue siendo válida, no se tocó). |
| §16 (sección completa) | Título "Parámetros todavía pendientes de simulación" + 12 parámetros listados como abiertos | Título anotado como superado + nota explicando que los 12 ya se resolvieron en la fórmula V1.4 (versión `nivel_bramu_v1_0`). La lista original se conserva completa como registro histórico de qué estaba abierto antes del cierre. |
| §17 (sección completa) | "Próximo paso recomendado" con 6 pasos hacia una fórmula todavía no diseñada | Título anotado como superado + nota indicando que ese camino ya se recorrió y cuál es la secuencia vigente (`Nivel_BRAMU_Implementacion.md`, Etapas A-E). Los 6 pasos originales se conservan sin editar. |

Ninguna decisión funcional/UX de `Nivel_BRAMU.md` (estados, cuestionario, recalibración, superficies, contrato de backend) fue alterada — solo se marcó como superado lo que hablaba específicamente de la fórmula/parámetros como no resueltos.

### Observación NO corregida (fuera del alcance autorizado de esta ronda)

`Nivel_BRAMU.md` §17, paso 2, dice literalmente: *"Cruzar el contrato de datos con el consolidado de backend V04."* Esa numeración es la vieja (de antes de la reorganización de nombres del 03/09/2026, documentada en memoria): en ese momento `V04` significaba Backend. Con la numeración vigente, `V04` es esta misma línea (Nivel BRAMU) y Backend es `V06`. No se corrigió porque el Consolidado de esta ronda autoriza exactamente 2 normalizaciones (§1.1 y §1.2) y esta no es ninguna de las dos — queda registrada acá para una futura pasada documental, no se tocó el archivo por esto.

---

## 3. Auditoría técnica del estado actual

### 3.1 `store.js` (761 líneas)

- `SCHEMA_VERSION = 3` (sin cambios desde V03.0), `APP_VERSION = 'BRAMUlab V03.10'`.
- Persistencia 100% `localStorage`, sin backend. Patrón `KEYS` centralizado + `safeGet`/`safeSet`/`safeRemove` (nunca acceso directo a `localStorage` fuera de estas 3 funciones).
- Dos patrones de aislamiento ya establecidos y reutilizables para un futuro estado de Nivel:
  - **Array global no aislado por usuario** (como `HISTORY`, `GROUPS`): para entidades compartidas entre jugadores.
  - **Dict por `userId`** (como `ADDED_PLAYERS`, `HIDDEN_NETWORK_PLAYERS`): para datos personales de cada cuenta, evitando reescanear un array completo.
- `password` en texto plano, documentado y aceptado explícitamente como prototipo — sin relación con Nivel BRAMU, mencionado solo como referencia de que este archivo ya convive con deuda técnica documentada a propósito.
- No existe ningún mecanismo de *feature flag* en todo el archivo (ni en el resto del repo — se verificó por grep). Habrá que crearlo desde cero.

### 3.2 `player-home.js` (911 líneas) — Nivel BRAMU provisional (§2 del Consolidado, confirmado)

Bloque `V03.0` / Etapa 4.1, líneas 686-909, confirmado tal cual lo describe el Consolidado:

- `LEVEL_BASE = 5.0`, `LEVEL_MIN = 1.0`, `LEVEL_MAX = 10.0`.
- `isMatchConsideredForLevel(match, playerName)` — partido terminado, con ganador, `regulationCompleted !== false`, el jugador participó.
- `computeLevelDeltaForMatch(match, playerName)` — delta fijo `±0.1`/`±0.2` según formato (Americano o super-tercer-set = `±0.1`; resto `±0.2`). **No tiene relación matemática con la fórmula V1.4** (no hay expectativa, no hay confianza, no hay factores) — es un contador de racha simple.
- `computeLevelEvolution(history, playerName)` — recalcula SIEMPRE desde cero (nunca incremental), recorre orden cronológico ascendente, aplica cada delta y clampea a `[1.0, 10.0]` en cada paso. Devuelve `{ base, points[], current, changeFromBase, consideredCount, lastDelta }`.
- `computeSimulatedJugadorLevel(history, playerName)` — si el jugador tiene partidos considerados, devuelve `evolution.current`; si no, un valor determinístico por **hash del nombre** en el rango `[3.0, 7.5]` (nunca aleatorio, nunca el mismo para dos nombres distintos, pero tampoco ninguna estimación real).
- `buildCalibrationStatus(consideredCount)` — umbral fijo `CALIBRATION_THRESHOLD = 5` (sin la condición de "3 rivales distintos" de la fórmula V1.4 — esa condición adicional la agrega `ranking.js` por su cuenta, ver 3.3).
- `isCalibratingRealAccount(account)` — gate que fuerza estado CALIBRANDO (nunca un número) para toda cuenta real sin `legacyMigrated`, independientemente de cuántos partidos tenga.

Todas estas funciones están exportadas en `global.PLPlayerHome` y consumidas directamente por `ranking.js` y `app.js` (ver 3.3/3.4). **Ninguna se toca en Etapa A.**

### 3.3 `ranking.js` (798 líneas)

Confirma textualmente lo que dice su propio comentario de cabecera: nunca calcula ni modifica Nivel BRAMU, siempre lee `PH.computeSimulatedJugadorLevel`/`PH.computeLevelEvolution`. Punto notable para el futuro reemplazo: la función `sortNudge` (líneas 364-390) inyecta un decimal falso estable por jugador para desempatar el orden del ranking mock, porque el nivel simulado actual solo tiene 1 decimal real y con cientos de jugadores mock produce empates masivos. El propio comentario del código ya dice que esa función debe eliminarse por completo (nunca adaptarse) el día que exista el Nivel BRAMU real con sus 4 decimales de precisión interna — coincide exactamente con lo que la fórmula V1.4 define (`mu` a cuatro decimales). Esto es una confirmación útil: **la arquitectura de Ranking ya está preparada, sin que nadie lo haya pedido para V04, para el día en que el motor real exista** — no hace falta ningún cambio en `ranking.js` para Etapa A.

`buildCalibrationProgress`/`computeParticipantStatus` (líneas 554-613) ya implementan la condición real de la fórmula V1.4 ("5 computables Y 3 rivales distintos"), aunque hoy corren sobre el nivel simulado — es lógica de elegibilidad, no de cálculo de nivel, y coincide conceptualmente con lo que Etapa B deberá formalizar sobre el motor real.

### 3.4 `app.js` (10.650 líneas) — puntos de consumo confirmados por grep dirigido

`app.js` nunca calcula Nivel por su cuenta: siempre llama a `PH.computeLevelEvolution` o `PH.computeSimulatedJugadorLevel`. Puntos de consumo relevantes (no exhaustivo, pero cubre todas las superficies que muestran Nivel hoy):

- `computePlayerRowLevel(history, name)` (~línea 740) — único punto de cálculo para la fila compacta de jugador reutilizada en Elegir compañero/rival, Buscar Jugadores y JUGADORES de Perfil.
- Notificación de "Nivel BRAMU cambió" tras guardar un partido (~línea 4258-4265) — compara `computeLevelEvolution` antes/después, solo para cuentas legacy.
- Home / Player Card y MI PERFIL — Evolución del Nivel, gráfico SVG, "cambio últimos 30 días", "Mejor nivel BRAMU" (~líneas 6971, 9148, 9430-9603).
- Perfil público (~línea 7508, 7550-7556) — mismo criterio, con el mismo gate de calibración que Home.

**Ninguno de estos puntos se toca en Etapa A.**

### 3.5 `tests.html` (5.231 líneas)

Arnés propio, no un framework de terceros: un único `<script>` con una IIFE `async`, que carga los módulos puros vía `<script src="...">` (mismo orden que `index.html`, sin `app.js`) y expone `assert(name, cond, detail)` / `record(...)`. Cada bloque de test que toca `localStorage` sigue el mismo patrón manual: `AFFECTED_KEYS` (snapshot antes, `resetAffectedKeys()` durante, restaurar al final) — nunca un mock de storage. El resumen final (`passCount/failCount`) se pinta en el DOM; no hay exit code de proceso ni integración CI — correrlo significa abrir el archivo y mirar el resumen. Baseline actual: **1060/1060** (confirmado en V03_Informe.md).

Un módulo puro nuevo (`level.js`) se integra agregando su `<script src="level.js">` en la misma lista de carga (antes de `app.js`, que `tests.html` ni siquiera carga) y un bloque de fixtures nuevo con el mismo patrón `assert(...)`. Como el motor de Etapa A es puro (sin `localStorage`), sus fixtures **no necesitan `AFFECTED_KEYS`** — primer módulo del proyecto en esa situación tan limpia.

### 3.6 `index.html` (2.910 líneas)

Carga de módulos al final del `<body>`, todos con `?v=03.10` (cuarteto de versionado desde V03.1.6 — ver memoria `V03.1.6`): `engine.js → stats.js → store.js → player-home.js → match-load.js → player-identity.js → groups.js → locations.js → ranking.js → app.js`. Un `level.js` nuevo deberá agregarse a esta lista **con el mismo sufijo `?v=X`** que tenga la versión pública vigente en el momento en que se agregue — nunca sin query string (esa fue exactamente la causa raíz del bug de V03.1.6).

### 3.7 `sw.js` (132 líneas)

`CACHE_NAME = 'bramulab-v03-10'` + `CORE_ASSETS` (lista de assets pre-cacheados, con los mismos `?v=03.10`). Regla de cuarteto: `Store.VERSION`/`APP_VERSION`, `version.json`, `sw.js` (`CACHE_NAME` + `CORE_ASSETS`) e `index.html` (`?v=X`) deben moverse juntos en cualquier release real. **En V04.0 no se tocó ninguno de los 4** — no hubo release.

### 3.8 `version.json`

Un solo campo: `{ "version": "BRAMUlab V03.10" }`. Sin cambios.

---

## 4. Plan técnico propuesto para Etapa A

### 4.1 Archivos a agregar/modificar

| Archivo | Acción | Motivo |
|---|---|---|
| `bramulab/level.js` | **Nuevo** | Motor puro V1 (parámetros, funciones matemáticas, contrato de entrada/salida, códigos de auditoría). Cero DOM, cero `localStorage`. |
| `bramulab/tests.html` | Modificar | Agregar `<script src="level.js">` a la lista de carga + un bloque nuevo de fixtures (mismo patrón `assert`). |
| `bramulab/index.html` | Modificar | Agregar `<script src="level.js?v=X">` a la lista de módulos, mismo sufijo de versión vigente al momento de implementar. |
| `bramulab/sw.js` | Modificar (solo si `level.js` se agrega a `CORE_ASSETS`) | Si se decide precachearlo desde ya, exige bump de `CACHE_NAME` + entrada en `CORE_ASSETS` — ver 4.6. |
| `bramulab/store.js` | **No modificar en Etapa A** (recomendación — ver §8) | El motor puro no necesita persistir nada para cumplir su "salida esperada" (Implementacion.md §5: "cálculo ejecutable mediante pruebas"). |

**Sin cambios** en `player-home.js`, `ranking.js`, `app.js`, `groups.js`, `stats.js`, `engine.js`, `match-load.js`, `player-identity.js`, `locations.js` — confirmado, ninguno de estos archivos necesita tocarse para que Etapa A cumpla su objetivo.

### 4.2 Modelo de datos propuesto (dentro de `level.js`, como *shapes* documentados, no persistidos todavía)

**Estado de rating de un jugador** (Formula_V1.4 §2 + Implementacion.md §5 Etapa A):

```
{
  mu: number,              // 1.0000–10.0000, 4 decimales internos
  confidence: number,      // 0.00–0.95
  evidenceUnits: number,   // acumulado ponderado, >= 0
  state: 'sin_estimacion' | 'calibrando' | 'calibrado' | 'recalibrando',
  ratedMatches: number,
  distinctOpponents: number,
  lastRatedAt: string | null,   // ISO
  algorithmVersion: 'nivel_bramu_v1_0',
}
```

**Registro auditable de UN cálculo de partido** (Formula_V1.4 §19 + Implementacion.md §4):

```
{
  matchId: string,
  algorithmVersion: 'nivel_bramu_v1_0',
  computedAt: string,          // ISO
  snapshotsBefore: [ {playerId, mu, confidence}, ... ],  // los 4 participantes
  expectationA: number,
  factors: { margin, format, repetition, companion, circle, availability, opponent },
  perPlayerDelta: [ {playerId, delta, kUsed}, ... ],   // sin redondear
  snapshotsAfter: [ {playerId, mu, confidence, evidenceUnits}, ... ],
  reasonCodes: string[],
}
```

### 4.3 Claves de `localStorage` provisionales

**Ninguna se activa en Etapa A.** Se documentan como propuesta para cuando (en una etapa posterior) haga falta persistir de verdad:

- `bramulab.levelState.v1` — dict por `userId` (mismo patrón que `ADDED_PLAYERS`/`HIDDEN_NETWORK_PLAYERS`), un estado de rating por jugador.
- `bramulab.levelEvents.v1` — array global append-only (mismo patrón que `HISTORY`, con el mismo tope de longitud que ya usa esa clave) para el log de eventos inmutable que pide `Nivel_BRAMU.md` §13.3.

No se crean todavía en `store.js` — quedan documentadas acá para que Etapa B (o la etapa que efectivamente conecte persistencia) no tenga que inventar el esquema desde cero.

### 4.4 Contrato de entrada/salida del motor

Función principal propuesta:

```
Level.computeMatchUpdate(input) -> output
```

`input`: los 4 niveles/confianzas efectivos antes del partido, equipos, resultado (sets/games), `formatId`, contadores de repetición (`n_pair`, `n_r1`, `n_r2`), contador de compañero (`n_companero`), flag de círculo competitivo cerrado, cantidad de niveles conocidos (4/3/2), confianza promedio de la pareja rival.

`output`: expectativa previa, cada factor aplicado por separado (auditable individualmente — nunca solo el producto final), delta sin redondear por jugador, confianza posterior por jugador, códigos de razón, `algorithm_version`.

Funciones puras internas (una por sección de la fórmula, para que cada una tenga su propio fixture aislado): `computeEffectiveLevel`, `computeTeamStrength`, `computeExpectation`, `computeMarginMultiplier`, `computeFormatFactor`, `computeRepetitionFactor`, `computeCompanionFactor`, `computeCircleFactor`, `computeAvailabilityFactor`, `computeK`, `computeOpponentFactor`, `computeDelta`, `computeConfidenceAfter`, `applyInactivityDecay`. Precisión interna a 4 decimales en todo el pipeline; `roundPublicLevel(mu)` como única función que redondea a 1 decimal, usada exclusivamente por la capa de presentación (nunca dentro del propio motor).

### 4.5 Ubicación de parámetros

Un único objeto `PARAMS` centralizado al inicio de `level.js` (no un archivo separado — un solo módulo nuevo es más simple de auditar en Etapa A, mismo criterio de "pocas piezas" que ya usa el resto del proyecto). Debe incluir, tal cual la fórmula V1.4: rango de escala (1.0–10.0), divisor de expectativa (1.5), pesos de margen (0.45/0.55) y su rango (0.90–1.15), tabla de factores de formato, constantes de repetición (0.10 / 0.025 / piso 0.45) y de compañero (0.05 / piso 0.60), factor de círculo (0.45), factores de disponibilidad (1.00/0.80/0.60), factor de rival (0.55/0.45), constantes de confianza (`b` 0.15/0.10, techo 0.95, divisor 5.5), inactividad (60 días de gracia, semivida 240 días, piso 0.15), topes por estado (±0.50/±0.35), `algorithm_version = 'nivel_bramu_v1_0'`.

### 4.6 Forma del feature flag

Recomendación: una constante de código dentro de `level.js` (`const NIVEL_BRAMU_V1_ENABLED = false;`), **no** una clave de `localStorage` ni un toggle expuesto en ninguna pantalla. Motivo: hoy no hay backend ni configuración remota — un flag en `Store` sería alcanzable por cualquiera que abra la consola del navegador, y el Consolidado exige explícitamente "apagado" y "sin exposición general". Una constante de código convierte la futura activación en un cambio de una sola línea, explícito y revisable en un commit — no en un estado que pueda quedar prendido por accidente en el dispositivo de alguien. Si en el futuro hace falta activarlo gradualmente por usuario (rollout controlado, Etapa E), ese es el momento de mover el flag a una clave de `Store`, no antes.

### 4.7 Convivencia temporal con el Nivel provisional de V03

`level.js` se agrega, se prueba con fixtures, y **nada lo llama todavía** desde `app.js`/`player-home.js`/`ranking.js`. El Nivel provisional simulado de V03 (§3.2 de este informe) sigue siendo el único que ve la UI, sin ningún cambio de comportamiento. El feature flag en `false` no tiene ningún efecto observable en esta etapa porque ningún consumidor lo lee todavía — su único trabajo hoy es dejar preparado el punto exacto donde, en una etapa futura, se decidirá explícitamente activar la migración (nunca de forma implícita).

### 4.8 Estrategia de tests y fixtures

- Nuevo bloque en `tests.html`, mismo patrón `assert(name, cond, detail)`, sin `AFFECTED_KEYS` (motor puro, sin storage).
- Fixtures a portar directamente de la fórmula normativa: la tabla completa de 18 simulaciones de partido único (Formula_V1.4 §14) y las 3 simulaciones longitudinales (§15), con tolerancia ±0.01 (mismo criterio que define Implementacion.md §5 Etapa E, aplicado ya en Etapa A como primer gate de corrección).
- Tests de límites explícitos: victoria nunca delta negativo, derrota nunca delta positivo, clamp 1.0000–10.0000, expectativa complementaria entre A/B, disponibilidad 1.00/0.80/0.60, topes ±0.50 (calibrando/recalibrando) y ±0.35 (calibrado), `algorithm_version` presente en toda salida.

### 4.9 Qué puede hacerse ahora sin backend

Todo el motor puro es computable hoy: `userId` estable, historial estructurado, resultados por sets/games, composición de parejas, fechas reales, formatos, arnés de tests — exactamente lo que dice el Consolidado §3. Etapa A no necesita ningún dato que no exista ya en el dispositivo local.

### 4.10 Qué debe quedar desacoplado para backend futuro

El contrato de `Level.computeMatchUpdate(input)` recibe únicamente objetos planos (niveles/confianzas/contadores) — nunca llama a `Store` ni a `localStorage` directamente. Eso ya garantiza, por diseño, que el día que exista backend real, lo único que cambia es **quién** llama al motor y **de dónde** vienen esos objetos de entrada (hoy: `player-home.js` leyendo `localStorage`; mañana: una capa de servidor) — el motor en sí no se toca. Quedan explícitamente fuera de Etapa A (dependen de infraestructura multiusuario real, según §3 del Consolidado): validación de resultado por la pareja rival, invitaciones/reclamos entre cuentas de distintos dispositivos, sincronización central, idempotencia distribuida.

### 4.11 Riesgos reales de regresión

- **Ninguno sobre código existente**, si Etapa A se limita estrictamente a un archivo nuevo sin consumidores. El riesgo real no es técnico sino de disciplina de alcance: la tentación de "ya que estamos, conectamos un llamado condicional al flag" en `player-home.js` sería exactamente la migración que el Consolidado prohíbe en esta etapa.
- **Versionado:** si `level.js` se agrega a `index.html`/`CORE_ASSETS` de `sw.js`, corresponde bump de cuarteto (lección de V03.1.6) aunque el archivo no tenga todavía ningún efecto funcional — un `<script>` nuevo sin `?v=X` puede quedar servido por caché HTTP vieja. Decisión a tomar en el momento de implementar Etapa A, no ahora.
- **Conteo de tests:** el baseline es 1060/1060 (V03.10). Los fixtures nuevos deben sumar sobre ese número, nunca reemplazarlo ni resetear el conteo.

---

## 5. Checklist de lo prohibido en V04.0 (confirmación explícita)

- [x] No se implementó Etapa A (ningún archivo de código nuevo o modificado).
- [x] No se cambió la fórmula V1.4 (ni una palabra).
- [x] No se cambió UI.
- [x] No se reemplazó el Nivel provisional vigente (`player-home.js` intacto).
- [x] No se conectó Ranking al motor nuevo (no existe motor nuevo todavía).
- [x] No se tocó `BRAMU Intelligence` (se detectó trabajo en curso no relacionado — `docs/BRAMUlab/BRAMU_Intelligence.md` modificado y `BRAMU_Intelligence_Implementacion.md` nuevo, ambos fuera del alcance de esta ronda — no se abrieron ni se editaron).
- [x] No se introdujo backend.
- [x] No se borró lógica legacy/provisional.
- [x] No se cambió la versión pública de la app (`store.js`/`version.json`/`sw.js` sin tocar).

---

## 6. Bloqueos reales para autorizar Etapa A

**Ninguno técnico.**

Un único punto de alcance a confirmar, que no es una decisión de producto sino de secuencia técnica: el Consolidado (§5/§6) menciona que `store.js` "posiblemente" se vea afectado en Etapa A para modelo/feature flag. Este informe recomienda **diferir cualquier cambio a `store.js`** hasta que exista un consumidor real que necesite persistir estado de Nivel (Etapa B en adelante) — porque la "salida esperada" de Etapa A, tal como la define `Nivel_BRAMU_Implementacion.md` §5, es únicamente "cálculo ejecutable mediante pruebas", que el motor puro cumple sin escribir nada en `localStorage`. Si se prefiere dejar el modelo de persistencia ya armado (aunque desconectado) desde Etapa A, es una alternativa válida — solo se señala como punto a confirmar antes de programar, no como bloqueo.

---

## 7. Próximo paso

Si se autoriza Etapa A con este plan, la implementación se limita a: `bramulab/level.js` nuevo (motor puro + parámetros + contrato + auditoría), su carga en `index.html`/`tests.html`, sus fixtures, y el feature flag apagado como constante de código — sin tocar ningún otro archivo de producto ni la versión pública. Etapas B en adelante quedan para rondas futuras, cada una con su propio gate.

---

# V04.1 — Etapa A (implementada)

**Autorización:** Sebastián autorizó Etapa A sobre este mismo diagnóstico, con 2 decisiones cerradas explícitas: **diferir `store.js`** (sin persistencia real todavía) y **no conectar `level.js` a la app productiva** (ni siquiera el flag, desde ningún consumidor). Ajuste de alcance recibido: `app.js`, `player-home.js`, `ranking.js`, `store.js`, `index.html`, `sw.js`, `version.json` y la versión pública quedan explícitamente fuera de esta ronda.

## V04.1.1 Qué se implementó

**`bramulab/level.js` (nuevo, 488 líneas).** Motor puro, sin DOM ni `localStorage`, exactamente el contrato propuesto en §4.4 de este informe con un ajuste real encontrado al programarlo (ver §V04.1.3): expone

- `PARAMS` — objeto único congelado (`Object.freeze`) con todos los parámetros V1 citando su sección de origen en `Nivel_BRAMU_Formula_V1.4.md` (§2, §4.1, §5, §6.1, §7, §8, §8.1, §9, §10.2, §10.3, §13).
- `ALGORITHM_VERSION = 'nivel_bramu_v1_0'`, `NIVEL_BRAMU_V1_ENABLED = false` (constante de código, no Store — decisión de §4.6 de este mismo informe, confirmada al autorizar V04.1).
- Funciones puras, una por pieza de la fórmula: `computeEffectiveLevel`, `computePairStrength`, `computeExpectation`, `computeMarginMultiplier`, `computeFormatFactor`, `computeRepetitionFactor`, `computeCompanionFactor`, `computeCircleFactor`, `computeAvailabilityFactor`, `computeK`, `computeOpponentFactor`, `deltaCapForState`, `computePlayerDelta`, `computeEvidenceQuality`, `computeConfidenceFromEvidence`, `computeConfidenceAfterMatch`, `computeEffectiveConfidenceAfterInactivity`, `roundPublicLevel`, `clampLevel`.
- `computeMatchUpdate(input)` — función compuesta que arma la salida auditable completa de UN partido (los 4 jugadores): `algorithmVersion`, `teamStrength`, `expectation` (complementaria exacta A+B=1), `margin`, `formatFactor`, `availabilityFactor`, `rivalPairConfidenceAvg`, `reasonCodes[]`, y por jugador `muBefore/effectiveLevel/k/opponentFactor/circleFactor/deltaRaw/deltaCapped/capApplied/deltaPublic/evidenceQuality/muAfter/muAfterPublic/confidenceAfter`.
- Contrato explícito (cabecera del archivo y de `computeMatchUpdate`): `repetitionFactor`/`companionFactor` (por equipo) y `circleFactors` (por jugador) entran como valores YA CALCULADOS — Etapa A no deriva ninguno de los tres desde historial real, tal como pidió la autorización.

**`bramulab/tests.html` (modificado).** `<script src="level.js">` agregado únicamente en la lista de carga del arnés de tests (no en `index.html`), con un comentario explícito de por qué. Se agregó un helper `closeEnough(actual, expected, tol)` (tolerancia ±0.01 por defecto) junto al `assert` existente, y una batería nueva de 160 fixtures organizados en bloques temáticos (uno por pieza de la fórmula) más la batería completa de `Nivel_BRAMU_Formula_V1.4.md` §14.

## V04.1.2 Tests: antes/después

| | Cantidad |
|---|---:|
| Baseline (`BRAMUlab_V03.10`, sin tocar) | 1060/1060 |
| Fixtures nuevos de Nivel BRAMU | 160/160 |
| **Total, corrido de verdad contra el arnés real** | **1220/1220** |

Verificado levantando `python3 .claude/dev-server.py` (el mismo script del repo) y corriendo `tests.html` en el navegador — no solo revisado el código. Apareció 1 fallo real en la primera corrida (detallado en §V04.1.3, corregido antes de este informe) — la segunda corrida ya dio 1220/1220 limpio.

## V04.1.3 Fixtures normativos validados y diferencia real encontrada

**Tabla exacta, sin ambigüedad (una por pieza aislada de la fórmula):** nivel efectivo (ejemplos §4.1: `8.0/0.90→7.70`, `8.0/0.15→5.45`), expectativa (tabla §5 completa: diff 0/0.5/1.0/2.0/3.0 → 50/68/82/96/99%), factor de formato (tabla §7 completa), factor de repetición (tabla §8 completa, primero a quinto encuentro), factor de compañero (tabla §8 completa), factor de círculo (§8.1, los 2 valores), disponibilidad (tabla §13 completa), K por confianza y factor de confianza rival (fórmulas §9 en varios puntos), **confianza desde evidencia (tabla §10.2 completa: evidencia 0/1/3/5/10/15 → 15/28/49/63/82/90%)**, decay por inactividad (§10.3: gracia de 60 días, semivida exacta de 240 días verificada en el punto donde da exactamente la mitad), clamps 1.0000–10.0000, redondeo público vs. interno, topes ±0.50/±0.35 por estado, invariante de signo (victoria nunca negativo / derrota nunca positivo, verificado con 100 combinaciones de confianza×expectativa×factores en sus extremos), determinismo (misma entrada + misma versión = misma salida, comparación `JSON.stringify` byte a byte), `algorithm_version` presente, flag apagado.

**Batería compuesta — `Nivel_BRAMU_Formula_V1.4.md` §14 (18 simulaciones de partido único):** las 18 filas de la tabla, con tolerancia ±0.01, **todas dentro de tolerancia** (diferencia real máxima observada: 0.0093, en el caso "amplio" entre parejas 5.0 estables).

**Diferencia real encontrada — merece registrarse, no es un bug de código:** la tabla §14 no dice con qué nivel de confianza calcula cada arquetipo ("estables"/"nuevos"), solo los deltas resultantes. Para poder programar los 18 fixtures hubo que reconstruir esos dos valores por prueba numérica contra la propia tabla:

- **Confianza "estable" = 0.80.** Con este valor, 16 de las 18 filas (todas menos las 2 que involucran el arquetipo "nuevo") reproducen el delta documentado con una diferencia menor a 0.005 — prácticamente exacto, muy por debajo de la tolerancia ±0.01 pedida. También reproduce exactamente los porcentajes de expectativa de las filas 4-7 (23%/77%/8%/92%).
- **Confianza "nuevo" = 0.15** (la confiabilidad inicial de cuestionario completo, ya documentada en §3.2 — no un valor inventado). Con este valor, las 4 filas que involucran el arquetipo "nuevo" quedan dentro de ±0.01 (diferencia máxima 0.0054).

Ningún parámetro de `PARAMS` tuvo que ajustarse para lograr este encaje — la fórmula tal cual está escrita en `Nivel_BRAMU_Formula_V1.4.md` reproduce la tabla §14 completa con estos dos arquetipos de confianza. Se documenta acá porque el propio documento normativo no fija ese dato explícitamente en todas las filas (sí lo hace en la fila 16, "compañeros con confianza 20%/90%", que se usó tal cual sin necesidad de reconstruir nada).

**No se intentó reproducir §15 (simulaciones longitudinales) numéricamente.** Esas 3 secuencias (jugador subestimado/sobreestimado/alternado) dependen partido a partido de datos que el documento no fija (score exacto de cada partido, perfil del compañero en un juego de dobles) — inventar esos valores para forzar el encaje habría sido fabricar un dato no normativo, contrario al principio que la propia fórmula repite varias veces ("nunca inventar valores faltantes", §13). Queda como pendiente explícito, no como fixture fabricado. Si en el futuro se quiere esta cobertura, hace falta que producto fije esos supuestos (formato/score/compañero de cada partido de la secuencia) antes de programarla.

**El fallo real de la primera corrida** fue un error propio en un fixture, no del motor: un caso de "margen en el piso" usaba un score cuyo dominio (0.575) en realidad quedaba por encima del piso de la fórmula (0.55), así que el motor devolvía correctamente 0.9179 en vez del 0.90 que el fixture esperaba — corregido cambiando el score del fixture a uno que sí cae exactamente en el piso (dominio 0.50). El motor nunca estuvo mal; el fixture sí.

## V04.1.4 Riesgos / pendientes para Etapa B

- Etapa B deberá construir la integración histórica real que hoy `level.js` recibe como input ya resuelto: detección de círculo competitivo cerrado, conteo real de repetición de rivales/compañero desde el historial, reglas de elegibilidad/invitados/estados de partido, imputación de niveles faltantes (§13 de la fórmula).
- `store.js` sigue sin ningún modelo de persistencia de Nivel BRAMU — la propuesta de claves (`bramulab.levelState.v1`/`bramulab.levelEvents.v1`) de §4.3 de este informe sigue siendo solo eso, una propuesta, confirmada como diferida.
- Las simulaciones longitudinales de §15 de la fórmula quedan sin fixture — ver §V04.1.3. No bloquea Etapa B, pero si Etapa C/E necesitan esa cobertura, alguien deberá fijar los supuestos de cada secuencia primero.
- `level.js` no fue cargado nunca desde `index.html`: no hay riesgo de cuarteto de versionado en esta ronda (no aplica, no hubo release), pero cuando SÍ se conecte a producción, va a hacer falta el bump completo (`Store.VERSION`/`version.json`/`sw.js`/`?v=X`) — mismo criterio que el resto del proyecto desde V03.1.6.

## V04.1.5 No se avanzó a Etapa B

Confirmado — ningún archivo de integración histórica, persistencia ni UI fue tocado. El gate de §9 de `BRAMUlab_V04_Consolidado.md` sigue vigente sin cambios para autorizar la próxima etapa.

---

# V04.2 — Etapa B (implementada)

**Autorización:** Sebastián autorizó Etapa B sobre V04.1 ya cerrada y commiteada, con el objetivo textual de "construir la capa pura que, a partir de un partido + historial + estados de jugadores, determine si ese partido puede aportar evidencia al Nivel BRAMU y arme correctamente el contexto que necesita `level.js`" — sin conectar a UI, sin tocar `store.js` salvo bloqueo técnico real (no hubo ninguno), y modelando corrección/anulación solo como estado/decisión, sin persistencia ni reversión real.

## V04.2.1 Qué se implementó

**`bramulab/level-context.js` (nuevo, 626 líneas).** Módulo puro, separado de `level.js` como recomendaba el Consolidado: interpreta partido/historial/estados de jugadores y arma el CONTEXTO — nunca reimplementa una fórmula matemática de `level.js`, siempre delega (`Level.computeEffectiveLevel`, `Level.computePairStrength`, `Level.computeRepetitionFactor`, `Level.computeCompanionFactor`, `Level.computeAvailabilityFactor`, `Level.computeMatchUpdate`).

Modelo de datos: el archivo documenta en su propia cabecera, con precisión, qué campos son REALES en `match`/`sets`/`players` hoy (verificados contra `store.js`/`engine.js`/`player-home.js`, sin inventar nada) y cuáles son 2 campos FORWARD-COMPATIBLE que todavía no existen en ningún partido real (`validationState`, `recordedByParticipant`) — con default exacto al comportamiento real de hoy cuando faltan (todo partido local se trata como `validado`, y siempre `recordedByParticipant:true`, porque hoy es estructuralmente imposible cargar un partido como espectador — `app.js` ya lo dice: "en la carga manual, el jugador actual siempre es Equipo A").

**Funciones expuestas (`window.PLLevelContext`):**

- **Elegibilidad:** `computeMatchStatus(match, options)` → uno de `MATCH_STATUS` (`computable`/`pendiente`/`excluido`/`corregido`/`anulado`/`duplicado`) + `reasonCodes`. `options.alreadyComputedMatchIds` (un `Set`) es el único mecanismo de "duplicado" posible sin backend — idempotencia local por `matchId`.
- **Formato/margen:** `detectFormatKey(match)`, `computeMarginScoreInputs(match, winnerTeam)` — traducen el partido real al contrato exacto de `level.js`.
- **Invitados:** `resolvePlayerRating`, `computeAvailabilityContext`, `buildGuestEngineInput`.
- **Repetición:** `computeIndividualRepetitionCounts`, `computeCompanionCount`, `computeTeamRepetitionFactors`.
- **Círculo:** `computeClosedCircleContext`.
- **Compuestas:** `buildLevelEngineContext` (arma el input, nunca llama al motor) y `computeMatchLevelUpdate` (arma el input, y SOLO si `eligible:true` llama a `Level.computeMatchUpdate`).

**`bramulab/tests.html` (modificado).** `<script src="level-context.js">` agregado únicamente en el arnés de tests (después de `level.js`, mismo criterio de "solo ahí" que Etapa A), con 45 fixtures nuevos organizados en 7 bloques temáticos.

## V04.2.2 Tests: antes/después

| | Cantidad |
|---|---:|
| Baseline (V04.1, sin tocar) | 1220/1220 |
| Fixtures nuevos de Etapa B | 45/45 |
| **Total, corrido de verdad contra el arnés real** | **1265/1265** |

Apareció 1 fallo real en la primera corrida (detallado en §V04.2.3, corregido antes de este informe) — la segunda corrida ya dio 1265/1265 limpio.

## V04.2.3 Bug real encontrado y corregido (no un fixture mal escrito, esta vez sí el código)

`computeAvailabilityContext` chequeaba PRIMERO la condición genérica "sin nivel conocido en alguna pareja" (`knownA===0 || knownB===0`) y DESPUÉS la condición específica "2 conocidos en la misma pareja" (`knownLevelsCount===2 && (knownA===2||knownB===2)`). Matemáticamente, cualquier entrada que cumple la segunda condición (2 conocidos concentrados en un equipo) SIEMPRE cumple también la primera (el otro equipo tiene 0) — así que, en ese orden, la condición específica quedaba inalcanzable (código muerto): el motivo reportado siempre era el genérico, nunca el específico. Corregido invirtiendo el orden (la condición específica se evalúa primero) — el comportamiento de elegibilidad (excluir el partido) era correcto desde el principio; lo que estaba mal era CUÁL de los dos `reasonCodes` se reportaba, dato que sí importa para la auditoría/explicación (§18 de la fórmula).

## V04.2.4 Decisiones técnicas reales (zona gris de la fórmula, no bugs)

**1. Formato real hoy vs. taxonomía de la fórmula (§7).** `engine.js` solo define 2 formatos: `classic` (bestOfSets 3) y `americano` (bestOfSets 1) — no existe "mini sets a cuatro games" ni un `formatId` propio de "match tie-break" en todo el código real (ni en `engine.js` ni en `match-load.js`, que reutiliza los mismos `Engine.FORMATS`). Mapeo implementado, explícito y documentado en la cabecera del archivo:
- `classic` → `'bestOf3'` (1.00), SALVO que el último de 3 sets tenga `extraordinary:true` (el único rastro real hoy de un match tie-break, generado por `applyExtraordinaryGameTiebreak` en `engine.js`) → `'twoSetsPlusMatchTiebreak'` (0.90).
- `americano` → `'shortSingleSet'` (0.65) — el formato corto más cercano de la fórmula a un partido de 1 solo set; no hay ninguna mención textual de "Americano" en `Nivel_BRAMU_Formula_V1.4.md`, así que esta equivalencia es una interpretación de esta ronda, no un dato normativo.
- `'miniSets'` (0.80) de la fórmula **no tiene hoy ningún camino real que lo produzca** — brecha real entre producto y fórmula, documentada, no resuelta (no hay ningún formato de 4 games en la app).

**2. `n_pair`/`n_r1`/`n_r2` cuando los 2 compañeros tienen historiales distintos entre sí (§8).** La fórmula describe estos 3 contadores "de la pareja" sin fijar qué hacer si, contra los mismos 2 rivales de HOY, cada compañero tiene un conteo distinto en los últimos 180 días (por ejemplo, si no siempre jugaron juntos). Se resolvió calculando los 3 contadores para cada compañero por separado y tomando el MÁXIMO de cada uno entre ambos — el criterio más conservador (nunca subestima cuánta repetición hay realmente), consistente con el resto de la fórmula, que en todos sus mecanismos ya penaliza el farming y nunca lo premia. `n_companero` no tuvo esta ambigüedad: es simétrico por construcción (cuántas veces A y B jugaron juntos es el mismo número visto desde cualquiera de los dos).

**3. Invitado: cómo alimentar su fuerza de pareja a `level.js` sin tocarlo.** `level.js` (Etapa A, cerrado) siempre calcula `computeEffectiveLevel(mu, confidence)` internamente para los 4 jugadores — no hay forma de "inyectarle" directamente un nivel efectivo ya imputado. Se resolvió con un truco algebraico EXACTO (no una aproximación): dado el nivel efectivo imputado `E` (§13: promedio de los niveles efectivos conocidos) y la confianza `c` del compañero real conocido (mismo valor que además deja exactamente correcta `confianza_pareja_rival` para el equipo rival, §9), se despeja `mu_sintético = 5 + (E − 5) / c`. Al pasar `(mu_sintético, c)` por `computeEffectiveLevel`, el resultado es matemáticamente idéntico a `E`. Este `mu` sintético es una construcción puramente interna para alimentar el motor — nunca se expone como "nivel del invitado" (la salida real y correcta para mostrar/auditar es `imputedEffectiveLevel`, verificado en los fixtures `LVX-INVITADO`).

**4. Grupo del círculo: cuál de varios prefijos válidos usar (§8.1).** Cuando más de un tamaño de grupo (de 1 a 11 coparticipantes) alcanza el 80% de concentración, se usa el MÁS CHICO que ya lo alcanza — el grupo mínimo necesario, nunca inflado con gente que no hace falta para la concentración (más defendible para el chequeo de amplitud, que se vuelve más estricto cuantas más personas se sumen sin necesidad).

**5. Ventana del círculo: partidos previos, no el partido actual.** El "círculo preexistente" (20+ partidos, concentración, amplitud) se calcula SOLO con partidos ANTERIORES al que se está evaluando — nunca el propio partido influye en su propia clasificación (evita un razonamiento circular). El partido actual se chequea DESPUÉS, por separado, contra ese círculo ya establecido.

## V04.2.5 Riesgos / pendientes para Etapa C+

- La brecha real de formato (`miniSets` sin camino de producción) queda documentada — si en el futuro se agrega un formato corto real a `engine.js`, `detectFormatKey` va a necesitar una regla nueva.
- El criterio de MÁXIMO para `n_pair`/`n_r1`/`n_r2` entre compañeros es una decisión técnica razonable pero no normativa — si producto quiere fijar un criterio distinto (por ejemplo, promedio), es un cambio acotado a `computeTeamRepetitionFactors`.
- `store.js` sigue sin ningún modelo de persistencia — `playerStates`/`history`/`options.alreadyComputedMatchIds` siguen siendo inputs explícitos que un futuro integrador (Etapa C o backend) deberá poblar desde datos reales.
- `corregido`/`anulado` quedan modelados como estado — la reversión/recálculo real de §12.3 (revertir el delta anterior, recalcular con los mismos snapshots, aplicar solo la diferencia neta) sigue sin construirse, tal como pidió esta ronda.

## V04.2.6 No se avanzó a Etapa C

Confirmado — cuestionario, calibración/recalibración inicial, UI, y cualquier conexión a `app.js`/`player-home.js`/`ranking.js` quedan fuera de esta ronda.

---

# V04.3 — Etapa C (implementada)

**Autorización:** Sebastián autorizó Etapa C sobre V04.2 ya cerrada y commiteada — ciclo completo estimación inicial/cuestionario/ajuste/calibración/recalibración, como lógica pura y testeable, sin UI ni conexión a `store.js`/`app.js`/Ranking/historial real.

## V04.3.1 Qué se implementó

**`bramulab/level-calibration.js` (nuevo, 393 líneas).** Reutiliza `Level.STATES`, `Level.PARAMS.CONFIDENCE_ORIGIN_QUESTIONNAIRE_FULL/QUICK` y `Level.clampLevel` de `level.js` — ninguna constante ni fórmula de Etapa A se reimplementa.

- **`FULL_QUESTIONNAIRE`** — array de 7 preguntas con `id`, `weight`, `label` y sus `options` (`label`+`value`) en el orden y con los pesos exactos de `Nivel_BRAMU_Formula_V1.4.md` §3.1/§3.5 (30/15/10/10/15/10/10, suma exacta 1.00).
- **`computeFullQuestionnaireRaw(answerIndices)`** — `Q = Σ(w×q)`; `nivel = 1 + 7.5×Q`; devuelve `{raw, q, answers}` con las respuestas resueltas (índice + valor) para auditoría.
- **`QUICK_SEEDS`** + `computeQuickLevel(seedKey)` — las 5 semillas exactas de §3.3.
- **`validateAdjustment`/`confirmInitialLevel`** — valida `|ajuste|≤0.5` y múltiplo de 0.1 ANTES de aplicar (rechazo explícito, nunca clamp silencioso), calcula `confirmedLevel = clamp(raw+ajuste, 1.0, 9.0)`, y rechaza SIEMPRE un segundo ajuste (`alreadyConfirmed`).
- **`buildInitialCalibrationState(originType, confirmResult, questionnaireAnswers)`** — arma el estado `{mu, confidence, evidenceUnits:0, state:'calibrando', ratedMatches:0, distinctOpponents:0, lastRatedAt:null, algorithmVersion, origin}`; `confidence` = `CONFIDENCE_ORIGIN_QUESTIONNAIRE_QUICK` (0.10) o `_FULL` (0.15) según `originType`.
- **`computeCalibrationTransition(currentState, ratedMatches, distinctOpponents)`** — CALIBRANDO→CALIBRADO solo con AMBAS condiciones (5 partidos, 3 rivales) — nunca solo cantidad de partidos.
- **`computeRecalibrationEligibility`/`startRecalibration`/`confirmRecalibrationQuestionnaire`/`computeRecalibrationClosure`** — cooldown de 90 días, `mu_provisional`/`confidence_provisional` con la fórmula exacta de §11.2, cierre con 3 partidos+2 rivales dentro de una ventana de 120 días, expiración con reversión al consolidado y trazabilidad conservada (`recalibrationExpired`).

**`bramulab/tests.html` (modificado).** `<script src="level-calibration.js">` agregado únicamente en el arnés de tests, con 52 fixtures nuevos en 7 bloques.

## V04.3.2 Tests: antes/después

| | Cantidad |
|---|---:|
| Baseline (V04.2, sin tocar) | 1265/1265 |
| Fixtures nuevos de Etapa C | 52/52 |
| **Total, corrido de verdad contra el arnés real** | **1317/1317** |

Sin fallos en la primera corrida — a diferencia de V04.1/V04.2, esta ronda no encontró ningún bug real de código ni de fixture.

## V04.3.3 Los 6 perfiles sintéticos (§3.4) — cómo se verificaron

`Nivel_BRAMU_Formula_V1.4.md` §3.4 publica, para cada perfil, el resultado AGREGADO (bruto + "rango tras ajuste") pero nunca las 7 respuestas originales que lo produjeron — no hay ninguna forma de reconstruir el combo exacto sin inventar datos que la fórmula no publica. Se construyó, para cada perfil, un conjunto de respuestas narrativamente consistente con su descripción (por ejemplo "Avanzado amateur" con opciones altas pero no todas máximas) y se verificó que el bruto resultante cae DENTRO del propio "rango tras ajuste" que la fórmula ya define para ese perfil (bruto±0.5, clampeado en los bordes de la escala) — es el mismo margen que el producto acepta como corrección válida para esa persona, no una tolerancia inventada por este arnés. Los 6 perfiles pasaron con los siguientes brutos calculados (todos dentro de su rango publicado): Principiante total 1.3375 (rango 1.00–1.88), Inicial recreativo 2.93125 (2.11–3.11), Intermedio en formación 4.7125 (4.01–5.01), Intermedio consolidado 5.96875 (5.54–6.54), Avanzado amateur 7.00 (6.74–7.74), Competición 8.50 exacto (8.00–9.00, coincide con el bruto publicado porque es el caso de todas las respuestas al máximo).

## V04.3.4 Contradicciones — ninguna real; 2 inferencias documentadas (no bloqueantes)

Se revisaron específicamente `Nivel_BRAMU_Formula_V1.4.md` §3/§11, `Nivel_BRAMU_Implementacion.md` (Etapa C) y `Nivel_BRAMU.md` §4-§6 buscando una contradicción real. No se encontró ninguna — el único punto que en una primera lectura pareció tensionar (`Nivel_BRAMU.md` §4.4 llama "recomendación inicial, a probar" a los 3 partidos/2 rivales de cierre de recalibración, mientras `Nivel_BRAMU_Formula_V1.4.md` §11.3 lo fija como regla cerrada) NO es una contradicción: los números coinciden exactamente (3 y 2) — `Nivel_BRAMU.md` es simplemente el documento anterior al cierre de fórmula, y ya está marcado como tal desde la normalización de V04.0.

Dos huecos que la fórmula no fija EXPLÍCITAMENTE, resueltos por la lectura más consistente con el resto del documento (no contradicciones, decisiones técnicas menores):

1. **Clamp del ajuste propio del cuestionario de recalibración.** §11.1 dice "repetir cuestionario completo... permitir un ajuste acotado" sin repetir el rango 1.0–9.0 que sí fija §3.2 para la calibración inicial. `confirmRecalibrationQuestionnaire` reutiliza literalmente `confirmInitialLevel` (mismo mecanismo, mismo clamp) — es la única lectura consistente con "repetir cuestionario completo", no una decisión de producto nueva.
2. **Qué cuenta como "la última calibración o recalibración"** para calcular el cooldown de 90 días (`Nivel_BRAMU.md` §6.1). Este módulo no guarda historial de recalibraciones — `computeRecalibrationEligibility` recibe `lastConfirmationAt` como parámetro explícito; decidir CUÁL es esa fecha (inicial vs. la recalibración más reciente) queda para quien integre este módulo con persistencia real (Etapa D+ o backend), exactamente como Etapa A/B ya delegaron sus propios inputs.

## V04.3.5 Riesgos / pendientes para Etapa D+

- Ningún dato se persiste — `store.js` sigue sin ningún modelo de Nivel BRAMU real. Etapa D (UI/explicaciones) o una etapa de integración deberá decidir dónde vive el estado entre sesiones.
- La detección de "quién es la última calibración/recalibración" (inferencia 2 arriba) queda abierta para quien conecte este módulo a datos reales.
- Los 6 perfiles sintéticos se verificaron por rango, no por reconstrucción exacta — si en algún momento aparecen las 7 respuestas originales de cada perfil (por ejemplo en una revisión futura de la fórmula), valdría la pena reemplazar estos fixtures por los exactos.

## V04.3.6 No se avanzó a Etapa D

Confirmado — UI, explicaciones de producto, y cualquier conexión a `app.js`/`player-home.js`/`ranking.js`/`store.js` quedan fuera de esta ronda.

---

# V04.4 — Etapa D, bloque 1 (implementada)

**Autorización:** Sebastián autorizó el PRIMER BLOQUE VISIBLE de Etapa D sobre V04.3 ya cerrada y commiteada — el recorrido completo Crear cuenta → cuestionario/ajuste → CALIBRANDO real en Home/Perfil, para revisión visual antes de seguir. A diferencia de A/B/C, esta autorización SÍ permite tocar `app.js`/`index.html`/`store.js` (no estaban en su lista de "no tocar"), con la condición explícita de no romper ni activar nada para la versión pública.

## V04.4.1 Cómo abrir/probar exactamente esta experiencia

1. Levantar el server local (`python3 .claude/dev-server.py`, puerto 4173) y abrir `index.html`.
2. En cualquier pantalla donde se vea el wordmark BRAMU Lab arriba a la izquierda (ej. Configurar partido), **mantener presionado el logo ~1.8 segundos** — se abre el menú "HERRAMIENTAS" ya existente (el mismo de "Forzar actualización").
3. Tocar **"Nivel BRAMU V1 (preview): OFF"** — pasa a "ON". Es un flag de DISPOSITIVO (`localStorage`, no por cuenta): queda prendido hasta que alguien vuelva a tocarlo.
4. Crear una cuenta nueva (CREAR CUENTA → completar los 3 pasos de siempre). Al tocar **ENTRAR A BRAMU** en "TU JUGADOR ESTÁ LISTO", en vez de ir directo a Home ahora entra al onboarding nuevo: elegir camino → responder → ver resultado → ajustar (opcional) → CONFIRMAR MI NIVEL. Al confirmar, entra a Home mostrando el Nivel real en estado CALIBRANDO.
5. Para volver a ver el comportamiento de siempre (sin onboarding), repetir el paso 2-3 y dejarlo en OFF — una cuenta nueva vuelve a ver exactamente lo de V03.10 (CALIBRANDO sin número).

Nota: el flag es por dispositivo/navegador (no por cuenta) — con el flag prendido, CUALQUIER cuenta nueva ve el onboarding; una cuenta que ya tiene un Nivel V1 guardado nunca lo repite (aunque el flag siga prendido).

## V04.4.2 Qué se implementó

**`bramulab/store.js` (modificado, +40 líneas).** Persistencia de PROTOTIPO explícita (comentada como tal en el código, nunca presentada como el esquema definitivo de backend): `KEYS.LEVEL_V1_STATE` (`bramulab.levelV1State.v1`, dict por `userId`, mismo patrón que `ADDED_PLAYERS`) y `KEYS.LEVEL_V1_PREVIEW` (`bramulab.levelV1PreviewEnabled.v1`, booleano de dispositivo). Funciones: `loadLevelV1State`/`saveLevelV1State`/`isLevelV1PreviewEnabled`/`setLevelV1PreviewEnabled`. `saveLevelV1State` guarda EXACTAMENTE lo que devuelve `LVC.buildInitialCalibrationState` — `store.js` no interpreta ni transforma ese objeto.

**`bramulab/level-calibration.js` (modificado, +23 líneas).** Se agregó `categorizeLevel(level)` — categorías de comunicación de §3.7 (Iniciación/Recreativo/Intermedio/Intermedio alto/Avanzado/Competición), la única pieza de cálculo/presentación que faltaba para el resultado del onboarding. Sigue siendo Etapa C's dominio (fórmula ya normativa), no una lógica nueva de UI.

**`bramulab/index.html` (modificado, +85 líneas).**
- 3 `<script>` nuevos (`level.js`/`level-context.js`/`level-calibration.js`) agregados a la app productiva por primera vez, con el mismo `?v=03.10` que el resto — inertes para cualquier usuario real (`NIVEL_BRAMU_V1_ENABLED` sigue en `false`, y nada los llama sin el flag).
- Un ítem nuevo en el menú oculto de Herramientas de desarrollo (`#dev-tools-toggle-nivel-v1`).
- Una vista nueva, `#view-nivel-onboarding`, con el mismo patrón "un solo `showView`, pasos internos con `data-step`" que ya usan `#view-signup`/`#view-forgot-password`: intro, camino rápido, cuestionario (reutilizado para las 7 preguntas), resultado.
- Una nota nueva en el bloque `#evolution-calibration` de MI PERFIL (`#evolution-calibration-note-v1`) para no contradecir al simulado (ver bug real, V04.4.4).

**`bramulab/styles.css` (modificado, +73 líneas).** Un bloque nuevo de CSS reutilizando tokens existentes (`--ink-soft`/`--line`/`--radius-card` de `.pastilla`, `--brand-lime`, `--gold`, `--paper*`) — ningún color ni tipografía nuevos: tarjetas de camino (`.nivel-path-card`), lista de respuestas (`.nivel-answer-list`/`.nivel-answer-option`), progreso del cuestionario (`.nivel-quiz-progress`), tarjeta de resultado (`.nivel-result-card`), stepper de ajuste (`.nivel-adjust`), y la insignia CALIBRANDO/CALIBRADO (`.level-v1-badge`, punto ámbar/lima + texto — nunca solo color).

**`bramulab/app.js` (modificado, +267 líneas).**
- Bloque nuevo "ONBOARDING DE NIVEL BRAMU V1": estado de módulo (`nivelStep`/`nivelPathType`/`nivelQuizIndex`/`nivelQuizAnswers`/`nivelRawResult`/`nivelAdjustment`), render por paso, handlers de navegación/selección/ajuste, y `confirmNivelOnboarding()` (llama a `LVC.confirmInitialLevel` + `LVC.buildInitialCalibrationState`, guarda con `Store.saveLevelV1State`, entra a BRAMU con `completeIdentifyAction()` — el mismo mecanismo que ya usa Login).
- `initPlayerCardScreen()`: el botón ENTRAR A BRAMU ahora ramifica al onboarding SOLO si el flag está prendido Y no hay un Nivel V1 ya guardado para ese usuario — Login nunca pasa por acá (¡`completeIdentifyAction` es compartida con Login, por eso la ramificación vive en el botón del Player Card, no ahí!).
- `renderPlayerCard` (Home) y `renderProfileEvolution` (MI PERFIL): gate nuevo al principio de cada función — si existe un Nivel V1 real (`currentLevelV1State()`), lo muestra (número real + badge CALIBRANDO/CALIBRADO) y `return` antes de llegar al camino simulado de V03, que queda 100% intacto y sin tocar para cualquier cuenta sin Nivel V1.
- `initDevTools()`: wiring del toggle + refresco de su label cada vez que se abre el menú (nunca desincronizado).

## V04.4.3 Verificación visual real (Browser tool, no solo código)

Se crearon 3 cuentas de prueba reales y se navegó el flujo completo con capturas en cada paso:

1. **Cuestionario completo + ajuste.** Las 7 preguntas una por una (progreso 1/7…7/7 correcto), resultado bruto 4.9 ("Intermedio"), ajuste hasta +0.5 (tope respetado, botón "+" se deshabilita exactamente en el límite), confirmado en 5.4. Home y MI PERFIL mostraron "5.4 · CALIBRANDO · 0/5 PARTIDOS" con el punto ámbar (`rgb(255,201,61)` = `--gold`, verificado por `getComputedStyle`). Persistió correctamente tras recargar la página (localStorage).
2. **Camino rápido, sin ajuste, en mobile (375px).** Semilla "Avanzado" → 7.0 exacto, confirmado sin tocar el ajuste, Home mostró "7.0 · CALIBRANDO · 0/5 PARTIDOS" — probado en viewport mobile de punta a punta (intro, lista de semillas, resultado, Home), todo legible y sin desbordes.
3. **Flag apagado (control).** Cuenta nueva con el flag en OFF: ENTRAR A BRAMU fue DIRECTO a Home mostrando "CALIBRANDO · 0/5 PARTIDOS" sin ningún número — bit a bit el mismo comportamiento que `BRAMUlab_V03.10` documentado desde V03.0.

`localStorage['bramulab.levelV1State.v1']` confirmado con las 2 cuentas guardadas, aisladas por `userId`, con `origin` completo (rawLevel/adjustment/confirmedLevel/questionnaireAnswers/confirmedAt para la cuenta completa; seedKey implícito vía `type:'quick'` para la rápida), `algorithmVersion:'nivel_bramu_v1_0'`, `confidence` 0.15 (completo) / 0.10 (rápido) — exactamente los valores que exige Etapa C.

## V04.4.4 Bug real encontrado y corregido en esta misma ronda

Al integrar el bloque `#evolution-calibration` de MI PERFIL (reutilizado tal cual para mostrar CALIBRANDO), apareció una contradicción visual real: ese bloque ya traía una nota fija — *"BRAMU todavía no calculó tu Nivel — la fórmula real se define más adelante"* — correcta para el simulado de V03 (que nunca calcula nada real), pero **directamente contradictoria** con el número real de Nivel BRAMU V1 mostrado arriba en la misma pantalla. Corregido agregando una segunda nota (`#evolution-calibration-note-v1`) con el texto correcto para V1, mutuamente excluyente con la del simulado — exactamente la regla que pide el Consolidado §7 ("no pueden convivir visualmente dos verdades distintas"), aplicada acá de forma literal a un caso real que el propio desarrollo de esta ronda produjo.

## V04.4.5 Tests: antes/después

| | Cantidad |
|---|---:|
| Baseline (V04.3, sin tocar) | 1317/1317 |
| Fixtures nuevos (persistencia `store.js` + `LVC.categorizeLevel`) | 21/21 |
| **Total, corrido de verdad contra el arnés real** | **1338/1338** |

Los 21 fixtures nuevos cubren únicamente las 2 piezas puras sin DOM que esta ronda agregó (persistencia de prototipo y categorización) — el resto (onboarding, integración Home/MI PERFIL) es UI/DOM, sin arnés automatizado posible (mismo límite de `app.js` documentado desde V01), verificado a mano con capturas reales (§V04.4.3). No se duplicó ningún fixture matemático de V04.1-V04.3.

## V04.4.6 Contradicciones/decisiones — ninguna bloqueante

No apareció ninguna contradicción real entre `Nivel_BRAMU_Formula_V1.4.md`/`Nivel_BRAMU_Implementacion.md`/`Nivel_BRAMU.md` para lo que exige este bloque — el único hallazgo real fue el bug de copy de §V04.4.4, ya corregido. Una decisión de implementación (no de producto) documentada: "Revisar respuestas" en la pantalla de resultado reinicia la elección de camino desde el intro, en vez de reconstruir las respuestas anteriores in-place — simplificación deliberada para esta primera ronda visible, consistente con "no implementar toda Etapa D de una sola vez"; si se pide edición in-place, es un cambio acotado a `renderNivelOnboardingStep`/`nivelQuizAnswers`.

## V04.4.7 Riesgos / pendientes para el próximo bloque de Etapa D

- Evolución por partidos reales, Ranking, perfil público, explicación de deltas y recalibración visual quedan explícitamente para la próxima ronda (no se tocó `player-home.js`/`ranking.js`).
- El flag de vista previa vive en `localStorage` del dispositivo — cuando este bloque se dé por aprobado y se decida activar Nivel BRAMU V1 de verdad, hace falta una decisión explícita de producto sobre cómo migrar (activar para todos, gradual, etc.) — no resuelto acá a propósito.
- La persistencia sigue siendo prototipo (`store.js`) — la arquitectura definitiva de backend sigue sin diseñarse, tal como pedía esta ronda.

## V04.4.8 No se avanzó al siguiente bloque de Etapa D

Confirmado.

---

# V04.5 — acceso al preview + versión pública visible (implementada)

**Nota de numeración:** esta ronda se commiteó con el nombre `V04.4.1`. Sebastián corrigió: BRAMUlab deja de usar subversiones de 3 niveles — de acá en más la secuencia es `V04.4`, `V04.5`, `V04.6`... Esta sección queda renombrada a `V04.5` (con sus subsecciones `V04.4.1.1-.5` → `V04.5.1-.5`); el contenido de rondas anteriores ya cerradas (`V04.0`-`V04.4`) no se reescribe, incluida la numeración interna `V04.4.1`-`V04.4.8` de la sección de arriba, que es de un `V04.4` distinto (sus propias subsecciones, no una ronda separada) y no cambia.

**Pedido:** Sebastián, revisando la UI de V04.4, pidió 2 correcciones antes de seguir probando: (1) simplificar cómo se activa/desactiva el preview con un ícono visible en la cabecera, mouse y touch, sin depender del long-press oculto; (2) corregir que la app seguía mostrando `BRAMUlab V03.10` y el ícono nuevo ni llegaba a verse — señal de assets viejos servidos por caché — aplicando el cuarteto de versionado ya establecido para que la versión de desarrollo se identifique como `BRAMUlab V04.5` (V03.10 queda como tag estable anterior, ya cerrado). Explícito: no tocar el onboarding ni el diseño de Nivel todavía, no avanzar funcionalmente.

## V04.5.1 Qué se implementó

**Parte 1 — acceso al preview:**
- **`bramulab/index.html` (+11 líneas).** Botón nuevo `#player-home-lab-preview-btn` en `.player-home-header__actions` (mismo lugar que Ranking/Notificaciones), con un ícono SVG de matraz (neck + body, mismo `fill:currentColor` que los otros 2 íconos del header). `#dev-tools-title` ganó un `id` para poder actualizarse dinámicamente.
- **`bramulab/styles.css` (+6 líneas).** `.player-home-lab-preview__icon` (mismo tamaño/color que Ranking/Notificaciones) y `.player-home-lab-preview.is-active{color:var(--brand-lime)}` — el ícono se pinta lima solo mientras el preview está prendido.
- **`bramulab/app.js` (+27 líneas, neto).** `refreshLabPreviewUI()` — único punto que sincroniza los 3 lugares que reflejan el estado (clase `is-active` del ícono del header, texto de `#dev-tools-title`, label del toggle dentro de Herramientas). `setLevelV1Preview(enabled)` — único punto de escritura (`Store.setLevelV1PreviewEnabled` + `refreshLabPreviewUI()`), usado tanto por el ícono nuevo como por el toggle de Herramientas (conservado, sin cambios de comportamiento). Click del ícono: toggle directo + `showToast('Nivel BRAMU V1 preview: ACTIVADO/DESACTIVADO', 2200)`. `refreshLabPreviewUI()` se llama también una vez al boot, para que un preview ya prendido de una sesión anterior se vea activo desde el primer render.

**Parte 2 — versión pública/caché, cuarteto completo:**
- **`bramulab/store.js`** — `APP_VERSION` (`Store.VERSION`): `'BRAMUlab V03.10'` → `'BRAMUlab V04.5'`.
- **`bramulab/version.json`** — `{"version":"BRAMUlab V03.10"}` → `{"version":"BRAMUlab V04.5"}`.
- **`bramulab/sw.js`** — `CACHE_NAME`: `'bramulab-v03-10'` → `'bramulab-v04-5'`; los 11 `?v=03.10` de `CORE_ASSETS` → `?v=04.5`; se agregaron `level.js`/`level-context.js`/`level-calibration.js` a `CORE_ASSETS` (habían quedado afuera en V04.4 porque todavía no había release real — esta es la primera).
- **`bramulab/index.html`** — los 12 `?v=03.10` (`<link>` de `styles.css` + los 11 `<script>`) → `?v=04.5`.
- 2 comentarios que habían quedado desactualizados por el bump se corrigieron en el mismo cambio: uno en `store.js` (describía el flag de preview en términos de "la versión pública sigue mostrando V03.10", ya no es así — el string de versión ahora es independiente del flag) y uno en `app.js` (la nota de `refreshLabPreviewUI` comparaba contra `BRAMUlab V03.10`, que ya no es lo que se muestra).

## V04.5.2 Verificación real (Browser tool)

- **Versión visible:** `Store.VERSION` y el footer del Home (`#player-home-footer`) confirmados mostrando `BRAMUlab V04.5` — capturado con screenshot.
- **Ícono presente:** confirmado visualmente en el header del Home, junto a Ranking/Notificaciones, en desktop y mobile (375px).
- **Desktop, mouse:** click en el ícono → pasa de gris a lima, toast "Nivel BRAMU V1 preview: ACTIVADO", recarga de página → sigue lima (persistencia + sync de boot). `dev-tools-title`/label del toggle confirmados sincronizados vía inspección directa del DOM (`"HERRAMIENTAS · V04.5 PREVIEW"` / `"Nivel BRAMU V1 (preview): ON"`).
- **Mobile (375px), touch:** mismo ícono, mismo tap → toggle a OFF confirmado visualmente (ícono vuelve a gris).
- **Preview OFF → V03.10 (comportamiento heredado):** sin cambios — es la MISMA lectura de `Store.isLevelV1PreviewEnabled()` que ya gateaba `initPlayerCardScreen`; el string de versión ya no depende de este flag (bump es global).
- **Preview ON → flujo V04.4 disponible:** el gate de `initPlayerCardScreen` sigue leyendo exactamente el mismo flag que ahora el ícono escribe.
- **Sin assets viejos:** confirmado por `read_network_requests` que los 12 archivos se sirven con `?v=04.5` y devuelven 200; consola sin errores nuevos (el único error presente — fetch de `sw.js` — es una limitación ya conocida del entorno sandbox de preview, no relacionada con este cambio).

## V04.5.3 Tests

Sin fixtures nuevos. Ninguna de las 2 correcciones introduce lógica pura nueva: la parte 1 reutiliza `Store.isLevelV1PreviewEnabled`/`setLevelV1PreviewEnabled` (ya cubiertos por los 21 fixtures de V04.4); la parte 2 son strings de configuración (versión/caché), sin rama de lógica que fixturar. Baseline verificado sin cambios: **1338/1338**.

## V04.5.4 Contradicciones / decisiones de producto

Ninguna. Corrección de numeración documental + infraestructura de versionado, ambas explícitamente pedidas y autorizadas por Sebastián — commiteada directamente según la regla vigente.

## V04.5.5 No se avanzó funcionalmente

Confirmado — onboarding y diseño de Nivel BRAMU sin cambios; no se tocó Backend/Ranking/Intelligence.

---

# V04.6 — estimador inicial V1.1 (implementada)

**Fuentes leídas completas esta ronda:** `Nivel_BRAMU_Handoff_Cuestionario_V1.5.md`, `BRAMUlab_V04.6_Handoff.md`; `Nivel_BRAMU_Formula_V1.5.md` §3 completo (anclas, contexto/categoría, confiabilidad/coherencia, cuestionario, camino rápido, resultado, perfiles §3.8). No se releyó V03 ni se auditó el repositorio de nuevo — ahorro de contexto explícito pedido para esta ronda.

**Diagnóstico:** sin bloqueo real de producto. V04 reproducía V1.4 correctamente; el sesgo (años/frecuencia/etiquetas inflando el nivel) era de la fórmula V1.4 en sí, ya corregido por V1.5 §3. Se avanzó directo a implementación en la misma intervención, según lo pedido.

## V04.6.1 Qué se implementó

**`bramulab/level-calibration.js` (reescrito, motor de estimación inicial):**
- Anclas/modificadores nuevos: `ANCHOR_AUTOEVALUACION` (5, "Profesional" en vez de "Competición"), `ANCHOR_TECNICA` (A-E), `TRAINING_MODIFIERS` (5), `COMPETITION_MODIFIERS` (5), `YEARS_POINTS`/`FREQUENCY_POINTS` (puntos de contexto), `CATEGORY_CONTEXT_MAPS.ar_masculino_v1` (9 anclas piloto), `CATEGORY_NEUTRAL_KEYS` (`no-compito`/`no-se`).
- Funciones nuevas: `computeTechnicalAnchor`, `computeFullEstimate` (nivel_base, sin categoría), `computeQuickLevel` (mismas 5 anclas, sin ancla técnica), `computeCategoryAdjustment`/`computeCategoryStep` (referencia + ajuste ±0.5 + coherencia + confianza natural), `confirmInitialLevelV1_1` (aplica el cap de confianza a 0.10 solo si `coherenceFlag && confirmDespiteCoherence`, nunca penaliza el nivel).
- `buildInitialCalibrationState` simplificada: la confianza sale directo de `confirmResult.origin.confidenceOrigin` (ya variable), nunca vuelve a decidirla por tipo de camino.
- `validateAdjustment`/`confirmInitialLevel` (genéricas) se CONSERVAN, reutilizadas solo por la recalibración — se les quitó la exigencia de múltiplos de 0.1 (era del stepper manual retirado, nunca de la fórmula).
- `LEVEL_CATEGORIES`/`categorizeLevel`: cortes 1.0-2.4/2.5-3.9/4.0-4.9/5.0-6.3/6.4-7.9/8.0-10.0, etiqueta superior "Profesional".
- Calibración (§10.2) y recalibración (§11) copiadas sin ninguna modificación funcional.
- `bramulab/level.js` — **cero líneas tocadas** (motor `nivel_bramu_v1_0`/`PARAMS` intactos; verificado con `grep`/diff mental línea por línea antes de cerrar la ronda).

**`bramulab/store.js`:** `APP_VERSION` → `'BRAMUlab V04.6'`; función nueva `resetLevelV1State(userId)` (borra solo esa entrada de `LEVEL_V1_STATE`, para el modo laboratorio).

**`bramulab/app.js`:**
- Bloque completo de onboarding reescrito: `NIVEL_FULL_QUESTIONS` (7 preguntas V1.1 con las keys exactas que espera `LVC`), `NIVEL_CATEGORY_OPTIONS` (11 chips, reusa `CATEGORY_LABELS`), medidor (`nivelGaugeTheta`/`nivelGaugeArcPath`/`setNivelGaugeValue` — geometría del semicírculo, animación vía CSS transition), `selectNivelCategory`/`renderNivelResultStep` (categoría en la MISMA pantalla que el medidor, debajo), `confirmNivelOnboarding` (usa `confirmInitialLevelV1_1` + persiste `declaredCategory`/`declaredCategoryAt` en la cuenta, mismo campo de siempre).
- Signup paso 3: quitado `#signup-category` de la validación/guardado (`TU PÁDEL`→`TU PERFIL`, `CREAR MI JUGADOR`→`CREAR MI PERFIL`); ubicación pasa a obligatoria (`recomputeSignupStepValidity` exige `signupDraft.location`).
- `CATEGORY_LABELS`: agregado `'no-compito'` y renombrado `'no-se'` de "No sé mi categoría" a "No estoy seguro" (mismo mapa que ya lee Editar Datos vía `PROFILE_PICKER_FIELDS.category` — la opción nueva aparece ahí gratis, sin tocar esa pantalla).
- `openPlayerCardScreen`: quitada la línea que pintaba `#player-card-category` (la categoría ya no existe en ese punto del flujo).
- `refreshLabPreviewUI`: ahora también muestra/oculta `#dev-tools-create-test-user`/`#dev-tools-reset-nivel`; título del menú → `"· V04.6 PREVIEW"`.
- Funciones nuevas `createLabTestUserAndOpenOnboarding` (`Store.createUserAccount` sin email/password + `saveSessionUserId` directo) y `resetLevelV1ForLabAccount` (`Store.resetLevelV1State` + reabre el onboarding).
- **`initDevTools` — corrección de bug preexistente (ver V04.6.4):** el selector pasa de `$('#home-logo')` a `$('#player-home-logo')`.

**`bramulab/index.html`:** signup paso 3 sin `<select id="signup-category">`, ubicación sin "(opcional)"; `#view-player-card` sin la fila "Categoría"; `#view-nivel-onboarding` con el medidor SVG (`.nivel-gauge*`) + grilla de categoría + aviso de coherencia, reemplazando `.nivel-result-card`/`.nivel-adjust` (stepper); `#dev-tools-modal` **movido** afuera de `#view-setup` (ver V04.6.4), con los 2 botones nuevos `hidden` por defecto; 14 `?v=04.5` → `?v=04.6`.

**`bramulab/styles.css`:** bloque `.nivel-result-card`/`.nivel-adjust*` reemplazado por `.nivel-gauge*`/`.nivel-category-*`/`.nivel-coherence-note` (azul `--accent-cyan` para el medidor, nunca una paleta nueva).

**`bramulab/sw.js`:** `CACHE_NAME` → `'bramulab-v04-6'`; los 14 `?v=04.5` de `CORE_ASSETS` → `?v=04.6`. **`bramulab/version.json`** → `{"version":"BRAMUlab V04.6"}`.

## V04.6.2 Verificación visual real (Browser tool, mobile 375px)

Recorrido end-to-end completo, con inspección directa del estado persistido en cada paso (no solo screenshots):
- **Alta nueva:** paso 3 sin Categoría, ubicación obligatoria (botón deshabilitado hasta elegir localidad real vía GeoRef), `TU PERFIL`/`CREAR MI PERFIL`/`TU PERFIL ESTÁ LISTO` confirmados, sin fila Categoría en la ficha.
- **Camino completo:** 7 preguntas con las descripciones exactas de §3.5, progreso `Pregunta N de 7`, resultado con medidor mostrando `5.7` "Intermedio alto" ("TU ESTIMACIÓN INICIAL"), categoría `4ª` → medidor anima a `6.1` ("TU PUNTO DE PARTIDA EN BRAMU") — estado persistido verificado byte a byte: `confirmedLevel:6.1102, baseLevel:5.6675, categoryReference:6.3, categoryAdjustment:0.4427, confidenceOrigin:0.18, coherenceFlag:false, questionnaireVersion:'nivel_inicial_v1_1'` — coincide EXACTO con el fixture "Esteban" (6.11).
- **Camino rápido + "No compito":** `Avanzado` (7.0) → categoría "No compito" → medidor NO se mueve (ajuste 0, sin animación ficticia), confirma `mu:7, confidence:0.1, declaredCategory:'no-compito'` — y el MISMO valor se refleja en Home y MI PERFIL.
- **Coherencia:** `Avanzado`+red B+paredes B+nunca entrenó+`dificil`+categoría `6ª` → medidor a `5.1`, aviso "Algunas respuestas describen niveles diferentes. ¿Querés revisarlas?" visible (no acusatorio), confirmar sin revisar → `confirmedLevel:5.1` (SIN penalizar) pero `confidence:0.1` (limitada) — coincide exacto con el perfil de estrés "Autodeclarado avanzado" (§3.8: 5.1).
- **Modo laboratorio:** long-press sobre el logo de Home abre el menú con los 2 botones nuevos visibles (preview ya activo); "Crear usuario de prueba" crea una cuenta sin email/contraseña y entra directo a onboarding; "Resetear Nivel BRAMU" borra el estado y reabre el onboarding, confirmado que NO toca `bramulab.history.v1`/`bramulab.users.v1`.
- **Responsive:** las 4 pantallas (intro, quiz, resultado+medidor+categoría+coherencia, Home/Perfil) se ven completas y utilizables a 375px, sin overflow ni bloques partidos.

## V04.6.3 Bug real preexistente encontrado y corregido (bloqueaba esta misma ronda)

Al verificar el long-press sobre el logo de Home para llegar a los 2 botones nuevos de laboratorio, el modal nunca aparecía. Investigado con `getBoundingClientRect`/DOM: `#dev-tools-modal` (agregado en V13.1) quedó adentro de `#view-setup` desde siempre, y nunca se movió cuando Home pasó a tener su propia vista (`#view-player-home`) con su propio logo (`#player-home-logo`, distinto de `#home-logo`, que sigue viviendo en Setup). Dos problemas independientes, misma causa raíz:
1. `initDevTools()` escuchaba `pointerdown` en `#home-logo` (el logo de Setup, invisible desde Home) — el long-press sobre el logo real de Home nunca disparaba nada.
2. Aunque se disparara, el modal (`position:fixed` dentro de un ancestro `display:none`) nunca se pintaría — MISMA clase de bug que V13.2/V13.3 ya corrigieron para `#update-available-modal`/`#scoring-system-modal` (comentario explícito en `index.html` documentando ese fix anterior).

Corregido: `initDevTools` ahora escucha en `#player-home-logo`; `#dev-tools-modal` se movió afuera de cualquier `.view`, junto a los otros 2 modales globales. Verificado con un `pointerdown` sintético + espera >1.8s: el menú aparece con los 2 botones nuevos visibles y funcionales. Sin este fix, "Crear usuario de prueba"/"Resetear Nivel BRAMU" habrían quedado inalcanzables — se corrige porque bloqueaba el propio alcance de V04.6, no por ir a auditar el resto de la app.

## V04.6.4 Tests: antes/después

**Antes (V04.5):** 1338/1338.
**Después (V04.6):** **1394/1394**, corrido de verdad contra el arnés real (dos fallos reales en la primera corrida, ambos por una construcción de fixture propia con puntos de confianza mal contados — corregidos, no eran bugs del motor; confirmado re-verificando el mismo combo con `LVC.computeCategoryStep` directo en el Browser tool antes y después del fix).

Se retiraron los fixtures del catálogo/pesos del cuestionario V1.4 (2, ya no aplican — la función que probaban no existe más) y se agregaron 58 nuevos: anclas/modificadores/mapa de categoría, ancla técnica, estimación completa/rápida (incl. `null` defensivo por respuesta faltante), categoría (mapa piloto/sin mapa/clave neutral/límite ±0.5/camino rápido sin modificador competitivo), coherencia (brecha exacta 2.0 inclusive/justo debajo/confianza por puntos 0.12-0.15-0.18 con saturación), confirmación V1.1 (questionnaireVersion, cap de confianza sin penalizar el nivel, trazabilidad completa, redondeo público), los 4 fixtures obligatorios × 2 caminos (Esteban/Seba/Lucho/Agustín, tolerancia ±0.01), los 8 perfiles de estrés de §3.8 (regresión exacta sobre combos propios, documentado que la fórmula no publica las respuestas originales — mismo criterio ya usado para los perfiles de V1.4 en V04.3), ajuste genérico sin múltiplos de 0.1, determinismo V1.1, `Store.resetLevelV1State` (incluida la verificación explícita de que Historial/Usuarios no se tocan), y `categorizeLevel` con los cortes/etiqueta nuevos. Calibración y recalibración (§10.2/§11) se dejaron BYTE A BYTE como estaban — cero cambios, siguen verdes.

## V04.6.5 Contradicciones / decisiones — ninguna bloqueante

- **`categoryContextKey` (qué determina "mapa compatible"):** la Fórmula V1.5 define el mapa piloto pero no dice explícitamente cómo detectar el contexto del jugador. Se resolvió con la lectura más consistente con "piloto argentino masculino": `país==='Argentina' && género==='masculino'` (hoy toda ubicación de la app es Argentina vía GeoRef, así que en la práctica es solo un chequeo de género) — cualquier otro caso queda sin mapa, categoría se guarda igual con ajuste 0. No es una equivalencia rígida nueva, es la puerta de entrada al mapa ya definido.
- **8 perfiles de estrés (§3.8):** la fórmula publica el resultado aproximado (1 decimal) de cada escenario, no las 7 respuestas que lo produjeron — se construyeron respuestas narrativamente consistentes con cada descripción (ver V04.6.1) y se fijó como fixture el resultado EXACTO que el motor devuelve para ese combo propio, no el número redondeado del documento (5 de los 8 coinciden exacto o casi exacto con la Fórmula; los otros 3 quedan dentro de ~0.1, documentado inline en cada assert). Mismo criterio de honestidad ya aplicado a los perfiles de V1.4 en V04.3 — nunca se inventó una precisión que no existe.

## V04.6.6 Riesgos / deuda relevante

- Los perfiles de estrés de §3.8 son una aproximación cualitativa (ver V04.6.5), no una reproducción exacta — si en el futuro la Fórmula publica las 7 respuestas originales de cada perfil, conviene reemplazar esos fixtures por los reales.
- El modo laboratorio no migra estados `nivel_bramu_v1_0`/origen V1.4 viejos que pudieran existir en cuentas de prueba de rondas anteriores — quedarían con `questionnaireVersion` ausente/vieja hasta que se resetee explícitamente esa cuenta (comportamiento a propósito, ver Handoff V04.6 §10 in fine).
- Ubicación ahora obligatoria en el alta: cualquier cuenta creada ANTES de V04.6 sin ubicación sigue sin ella (no se migra retroactivamente) — solo afecta a altas nuevas de acá en adelante.

## V04.6.7 Versionado y despliegue

Cuarteto completo bumpeado en la misma ronda: `Store.VERSION`/`version.json`/`sw.js` (`CACHE_NAME` + 14 `CORE_ASSETS`)/`index.html` (14 `?v=`) → `BRAMUlab V04.6`. Commit y push a `origin/main` en esta misma intervención (ver mensaje de commit); deploy de GitHub Pages a verificar después del push.

## V04.6.8 No se avanzó

Confirmado — no se tocó Ranking BRAMU, BRAMU Intelligence ni Backend/autenticación real; no se avanzó a evolución por partidos reales más allá de lo ya existente. V04.6 queda online para la revisión visual manual de Sebastián.

---

# V04.7 — corrección visual/UX de onboarding y Nivel BRAMU (implementada)

**Fuentes leídas esta ronda:** `Nivel_BRAMU_Formula_V1.5.md`, `Nivel_BRAMU_Handoff_Cuestionario_V1.5.md`, `BRAMUlab_V04_Informe.md` (este archivo, §V04.6). No se releyó V03 ni se repitieron auditorías generales — ronda acotada a diagnóstico + implementación en la misma intervención, pedido explícito de Sebastián.

**Diagnóstico (breve, sin bloqueo real):** la batería de problemas reportada tras la revisión visual manual de V04.6 es real y está toda dentro de `bramulab/app.js` (orquestación de vistas), `bramulab/index.html` (markup) y `bramulab/styles.css` — ningún archivo de Nivel BRAMU (`level.js`, `level-context.js`, `level-calibration.js`) necesita tocarse. El bug de navegación reportado también es real y puntual: una sola llamada mal ubicada (`app.js`, back-button de "intro"). Se avanzó directo a implementación en la misma intervención.

## V04.7.1 Bug de navegación — Nivel obligatorio (corregido)

**Causa raíz:** el handler del back-button en el paso "intro" del onboarding de Nivel llamaba `completeIdentifyAction()` — la MISMA función que se usa cuando el onboarding ya terminó — sin verificar si el usuario tenía un Nivel BRAMU V1 confirmado. `completeIdentifyAction()` sin una acción pendiente simplemente mostraba el Home. Ningún otro punto de entrada al Home (`openPlayerHome`, login) verificaba tampoco si el onboarding obligatorio seguía pendiente.

**Corrección — un único choke point, reutilizado en todos los caminos:**
- `nivelOnboardingPending(user)` (nueva, `app.js`): `true` solo si el preview está activo, la cuenta no es `legacyMigrated` y no existe `LEVEL_V1_STATE` guardado para ese `userId` — mismo criterio que ya usaba el botón ENTRAR A BRAMU, ahora en un solo lugar.
- `nivelOnboardingPendingUser()` (nueva): atajo para los guards que solo necesitan cortar el paso al Home.
- `openPlayerHome()`: si `nivelOnboardingPendingUser()` devuelve una cuenta, abre "TU PERFIL ESTÁ LISTO" en vez de renderizar el Home. Es el único punto real de entrada al Home (header, banner de partido activo, "volver" de Ranking/Grupos/Notificaciones/Buscar jugadores, tab Inicio, boot con sesión activa — todos pasan por acá).
- `completeIdentifyAction()`: su rama por defecto (sin acción pendiente) ahora llama `openPlayerHome()` en vez de duplicar `renderPlayerHome()+showView('player-home')` — así el guard también cubre login y "ENTRAR A BRAMU" con Nivel ya confirmado.
- Back-button de "intro": en vez de `completeIdentifyAction()`, vuelve a `openPlayerCardScreen(user)` ("TU PERFIL ESTÁ LISTO") — el onboarding queda pendiente, nunca se abandona hacia el Home.

**Verificado en vivo** (Browser tool, cuenta de laboratorio sin `LEVEL_V1_STATE`, preview activo): recargar la app con el onboarding sin terminar redirige a "TU PERFIL ESTÁ LISTO" (nunca al Home); tocar la flecha atrás en "intro" hace lo mismo (confirmado leyendo `document.querySelector('.view:not([hidden])').id` tras el click, no solo por screenshot); no se generan loops (ENTRAR A BRAMU desde ahí vuelve a abrir el onboarding, igual que siempre).

## V04.7.2 Estado "PENDIENTE" antes de confirmar Nivel

"TU PERFIL ESTÁ LISTO" mostraba siempre `CALIBRANDO` + `0 / 5 PARTIDOS` — una afirmación falsa cuando, con el preview activo, el Nivel BRAMU todavía no existe (el onboarding recién se abre al tocar ENTRAR A BRAMU). Se agregaron ids (`#player-card-level-state`, `#player-card-level-progress`, `#player-card-subtitle`) y `openPlayerCardScreen` ahora decide con el mismo `nivelOnboardingPending(user)`: pendiente → `NIVEL BRAMU` / `PENDIENTE` (fila de progreso oculta, sin inventar ningún número) y subtítulo "Para poder jugar, primero creá tu Nivel BRAMU."; no pendiente (preview apagado, cuenta legacy, o Nivel ya confirmado desde otro camino) → el `CALIBRANDO · 0/5 PARTIDOS` de siempre.

## V04.7.3 Medidor rediseñado

**Problema:** la aguja (`<line>` de pivote a casi el borde del arco, `x1/y1=110,112 → x2/y2=110,34`) se pisaba visualmente con el número central (`.nivel-gauge__value`, posicionado cerca del mismo pivote) — confirmado midiendo ambos elementos con `getBoundingClientRect` antes de tocar nada.

**Rediseño (index.html + styles.css, CERO cambios en la fórmula ni en `setNivelGaugeValue`'s matemática):**
- La `<line>` pasa de pivote→casi-arco a un tick corto que vive únicamente SOBRE el arco (`x1/y1=110,15 → x2/y2=110,33`, mismo `transform-origin: 110px 112px`) — la MISMA fórmula de rotación (`rotate(20×v−110, cx, cy)`) sigue aplicándose sin tocar una línea de JS; solo cambia la geometría del elemento que se rota.
- `.nivel-gauge__pivot` (círculo central) se retira — ya no hace falta ningún elemento en el centro.
- El número gana protagonismo: 40px→48px, reposicionado con `top:58%` (antes `bottom:6px`) para centrarlo mejor en el hueco del semicírculo.
- Se conserva: semicírculo, escala 1-10, azul `--accent-cyan` existente (nunca una paleta nueva), categoría de comunicación debajo, animación CSS al ajustar por categoría (`transition: transform` en el marcador, `transition: d` en el arco relleno — ninguno de los dos se tocó).

**Verificado en vivo:** cuestionario completo → estimación inicial `3.0` (Recreativo), categoría `5ª` → animación visible hacia `2.2` (Iniciación), el marcador nunca entra en la zona del número en ningún valor de la escala 1-10 (verificado en los extremos y en el punto medio).

## V04.7.4 Jerarquía y espaciado — onboarding, Home, MI PERFIL

- **"TU NIVEL BRAMU" pegada arriba:** los pasos cortos ("intro"/"quick") se sentían pegados arriba comparados con Login/Bienvenida. Nueva clase `.access-scroll--centered` (mismo `justify-content:center` que ya usaba `#view-access`), alternada por JS en `renderNivelOnboardingStep()` según el paso — "quiz"/"resultado" siguen ancladas arriba (necesitan scroll, son más largas). Mismo tratamiento aplicado a `#view-player-card` (TU PERFIL ESTÁ LISTO, siempre corta).
- **CTA "CONFIRMAR MI NIVEL" corrido a la izquierda:** bug real de CSS, no de composición — `.btn-start` sin el modificador `--overlay` es un contenedor flex (`display:flex`) dentro de un padre NO-flex (`.nivel-step`, `display:block`); un contenedor flex en flujo normal calcula su ancho por `fit-content`, no por "llenar el disponible" (a diferencia de un `<div>` común) — quedaba angosto (~60% del ancho) y pegado a la izquierda. Confirmado con `getComputedStyle` antes de tocar nada. Corregido agregando `.btn-start--overlay` (mismo modificador que ya usa `#signup-continue-btn`).
- **"Revisar respuestas" pegado al botón:** sin margen propio y corrido a la izquierda (mismo motivo: `<button>` es `inline-block` por default UA, se posiciona con el `text-align` que herede). Se le da `display:block; width:fit-content; margin:16px auto 0` — separado, centrado, angosto (nunca compite visualmente con el CTA).
- **"UNA ÚLTIMA PREGUNTA..." débil / pregunta pegada / chips juntos:** el volante gana tamaño (11px→12px) y un `margin-bottom` propio; la pregunta gana aire arriba y abajo; los chips de categoría ganan `gap` (8px→10px) y padding (8px 14px→10px 16px) para sentirse más táctiles; el card del medidor gana padding/margen.
- **CTA del cuestionario ("CONTINUAR") sin transición al activarse:** se agrega `opacity` a la `transition` base de `.btn-start` (global, sin cambiar ningún valor de opacidad) — el salto disabled→enabled ahora se percibe como una transición suave, no un cambio abrupto.
- **Tarjeta de Nivel de Home/MI PERFIL apretada:** `.player-card__level` (mismas clases, compartidas por Home y MI PERFIL — una sola corrección aplica a las dos pantallas, ver index.html) competía por ancho con nombre/foto en la misma fila (`max-width:46%`, `text-align:right`) y podía leerse partida. Pasa a `flex-basis:100%` (mismo truco que `.player-card__bar`/`.player-card__count` ya usaban) — fila propia de ancho completo, separador (`border-top`) igual al patrón ya usado por `.pastilla-identity__meta`, número más grande (30px→32px), texto alineado a la izquierda. La insignia `CALIBRANDO`/`CALIBRADO` (`.level-v1-badge`) pasa de "punto de color + texto" a una píldora con fondo propio — el punto ámbar/lima flotante se retira (el color de fondo ya es la señal gráfica).
- **Logo ausente en "TU PERFIL ESTÁ LISTO":** única pantalla de la familia de acceso sin `.brand-logo--access` (Login/Crear cuenta/TU NIVEL BRAMU/etc. sí lo tienen) — agregado, mismo tratamiento.

**No tocado a propósito:** contenido/copys del cuestionario y las 5 opciones del camino rápido (sin cambios salvo el ya reportado en V04.6), matemática/anclas/pesos, orden de los bloques de la pantalla de resultado (ya coincidía con lo pedido).

## V04.7.5 Modo laboratorio

"Crear usuario de prueba" ya vivía en la pantalla de acceso desde V04.6 (sin long-press). "Resetear Nivel BRAMU" seguía siendo alcanzable SOLO mediante el long-press de 1.8s sobre el logo de Home — el ícono de matraz del header (`#player-home-lab-preview-btn`) togueleaba directo el flag (V04.5) pero nunca abría el menú con el resto de las herramientas. Ahora: con el preview YA activo, un toque abre HERRAMIENTAS (el mismo modal del long-press, con "Resetear Nivel BRAMU" visible) en vez de apagar el flag directo; con el preview apagado, un toque lo prende igual que antes (mismo toast). El long-press legacy se conserva (no molesta) pero deja de ser necesario para ninguna de las 2 acciones.

**Verificado en vivo:** con preview activo, un toque en el ícono abre el menú (`dev-tools-modal.hidden === false`, sin esperar 1.8s); "Resetear Nivel BRAMU" borra el estado, muestra el toast y reabre el onboarding; el back-button desde ahí vuelve a "TU PERFIL ESTÁ LISTO" con `PENDIENTE" (no a Home) — cierra el círculo con V04.7.1.

## V04.7.6 Responsive

Verificado en vivo con el Browser tool en 375px (mobile) y desktop (~800px): onboarding (intro/quick/quiz/resultado+medidor+categoría), Home (player card), MI PERFIL — sin overflow horizontal, sin botones fuera de eje, sin elementos superpuestos, número del medidor nunca pisado por el marcador en ningún valor de la escala. La pantalla "TODAVÍA NO COMPLETASTE TU ACCESO" (cierre de sesión de usuario temporal) se revisó en código (no rediseño, solo verificación pedida): ya usa `.btn-start--overlay`/`.btn-secondary` de ancho completo, tres acciones correctamente cableadas (`openCompleteAccessModal`/`doLogout`/cerrar modal) — sin cambios necesarios.

## V04.7.7 Archivos tocados

`bramulab/app.js`, `bramulab/index.html`, `bramulab/styles.css`, `bramulab/store.js` (`APP_VERSION`), `bramulab/sw.js` (`CACHE_NAME` + 14 `?v=`), `bramulab/version.json`. `bramulab/level.js`/`level-context.js`/`level-calibration.js`/`tests.html`: **cero líneas tocadas**.

## V04.7.8 Tests

Sin fixtures nuevos: ninguna corrección de esta ronda es lógica pura — son bugs de orquestación de vistas (`app.js`) y de CSS, sobre una capa que el arnés de `tests.html` no ejerce (no carga `app.js`, mismo límite documentado desde V04.4: "el resto [onboarding, Home, MI PERFIL] es UI/DOM sin arnés automatizado posible, verificado a mano"). El guard de navegación, el estado PENDIENTE, la consistencia Home/MI PERFIL y el modo laboratorio se verificaron en vivo con el Browser tool (detalle en cada sección de arriba), no con fixtures nuevos.

**Resultado:** **1394/1394**, sin cambios respecto al baseline de V04.6, todo verde — corrido de verdad contra el arnés real antes y después del bump de versión.

## V04.7.9 Contradicciones / decisiones de producto

Ninguna bloqueante. Una decisión de alcance registrada: el ícono de matraz del header deja de togueleear el flag OFF con un toque cuando el preview ya está activo (ahora abre HERRAMIENTAS, donde sí se puede apagar) — cambio menor de interacción, necesario para eliminar la dependencia práctica del long-press pedida explícitamente; el toque para ACTIVAR desde OFF no cambió.

## V04.7.10 Riesgos / deuda relevante

- Ninguna deuda nueva. El único cambio de interacción (matraz con preview activo → abre menú en vez de apagar directo) es intencional y está documentado en V04.7.5/V04.7.9.

## V04.7.11 Versionado y despliegue

Cuarteto completo bumpeado en la misma ronda: `Store.VERSION`/`version.json`/`sw.js` (`CACHE_NAME` + 14 `CORE_ASSETS`)/`index.html` (14 `?v=`) → `BRAMUlab V04.7`. Commit y push a `origin/main` en esta misma intervención; deploy de GitHub Pages a verificar después del push.

## V04.7.12 No se avanzó

Confirmado — no se tocó la Fórmula V1.5, `level.js`, `nivel_bramu_v1_0`, `nivel_inicial_v1_1`, Ranking BRAMU, BRAMU Intelligence ni Backend/autenticación real. V04.7 queda online para una nueva revisión visual de Sebastián.

# V04.8 — corrección de regresiones visuales de V04.7 + simplificación del onboarding (implementada)

**Fuentes leídas esta ronda:** `Nivel_BRAMU_Formula_V1.5.md`, `BRAMUlab_V04_Informe.md` (este archivo, §V04.7), `BRAMUlab_V04_Consolidado.md`. No se releyó V03 ni se repitió auditoría general — ronda acotada, pedido explícito de Sebastián: "recuperar una base visual coherente antes de seguir con la revisión manual", sin reabrir Nivel BRAMU V1.5.

**Diagnóstico (breve, sin bloqueo real):** revisando el diff exacto de V04.7 (`git show`), la regresión de la tarjeta de jugador y el centrado vertical de "TU PERFIL ESTÁ LISTO" resultaron ser 2 reglas CSS puntuales agregadas esa ronda (`.player-card__level{flex-basis:100%;...}` y `#view-player-card .access-scroll{justify-content:center}`) — revertibles sin tocar `level.js`/`level-context.js`/`level-calibration.js`. El resto del pedido (fusión de pasos del alta, header centrado, copy del CTA) es UX/CSS/orquestación de `app.js`, mismo criterio de siempre.

## V04.8.1 Regresión de la tarjeta de jugador (revertida)

`.player-card__level` (compartida por Home, MI PERFIL y Perfil público — misma clase, 3 pantallas) vuelve a su composición anterior a V04.7: `flex:none; max-width:46%; text-align:right`, en la MISMA fila que avatar+nombre+@usuario (antes: `flex-basis:100%` + `border-top`, propia fila completa). Los estados PENDIENTE/CALIBRANDO/CALIBRADO se siguen resolviendo dentro de este mismo bloque angosto (`.player-card__level-sub`), sin ninguna rama nueva de layout. Verificado en vivo con 3 cuentas reales: una cuenta con Nivel `PENDIENTE` recién creada, una cuenta `CALIBRANDO · 0/5` recién confirmada, y una cuenta **`legacyMigrated` con 6 partidos reales fabricados** (recipe de [[project_bramu_lab_v03_4_6_qa_findings]] adaptada: `Store.createUserAccount({legacyMigrated:true})` + 6 `Store.upsertHistory(...)` vía consola) — la tarjeta "clásica" con barra de progreso + variación + partidos totales sigue intacta en Home y MI PERFIL.

## V04.8.2 "TU PERFIL ESTÁ LISTO" comparte identidad con Home/MI PERFIL

La ficha de `#view-player-card` deja de tener su propio esqueleto centrado (`.ficha-deportiva__avatar`/`__name`/`__handle`/`__stats`/`__level*`, retirados) y pasa a reusar literalmente el DOM/clases de `.player-card` (avatar+nombre+@usuario a la izquierda, NIVEL BRAMU arriba a la derecha) agregando `player-card` como segunda clase sobre `.ficha-deportiva` (que ahora solo aporta el marco distintivo: borde con glow lima, fondo propio). Edad/Mano/Lado se retiran de esta tarjeta (ya se ven y editan en Mis Datos) — la ficha ya no es una "tarjeta de datos" aparte, es la misma identidad que después aparece en BRAMU.

## V04.8.3 Estado PENDIENTE — confirmado correcto, sin CALIBRANDO antes de crear Nivel

Verificado en vivo: una cuenta recién creada (antes de tocar ENTRAR A BRAMU) muestra `NIVEL BRAMU` / `PENDIENTE`, nunca `CALIBRANDO · 0/5`; recién después de confirmar el Nivel en el onboarding aparece `CALIBRANDO · 0/5` en Home. Como Home/MI PERFIL nunca son alcanzables con el onboarding pendiente (choke point `openPlayerHome`, V04.7.1) y `confirmNivelOnboarding()` entra directo a Home sin volver a mostrar "TU PERFIL ESTÁ LISTO", la única pantalla que necesitaba la lógica PENDIENTE era esta — ya la tenía desde V04.7.2, ahora reescrita sobre el DOM nuevo de §V04.8.2 sin cambiar el criterio (`nivelOnboardingPending(user)`).

## V04.8.4 Onboarding fusionado: TU IDENTIDAD + TU PERFIL → TU PERFIL

El alta pasa de 3 pasos (`CREAR CUENTA` → `TU IDENTIDAD` → `TU PERFIL`) a 2 (`CREAR CUENTA` → `TU PERFIL`): los campos de los antiguos pasos 2 y 3 (foto, nombre, apellido, @usuario, nombre visible, fecha de nacimiento, género, mano hábil, lado habitual, ubicación — mismo orden de siempre) quedan en una sola pantalla con scroll, título `TU PERFIL`, CTA final `CREAR MI PERFIL`. Se retiran los puntitos de progreso de 3 pasos (`.signup-progress`, pedido explícito: "no usar indicadores de pasos para este bloque") — con 2 pasos reales no aportaban nada. `CREAR CUENTA` (email/contraseña) sigue siendo su propio paso: es acceso de cuenta, no dato de perfil deportivo (mismo criterio que ya separa WhatsApp/email de esta pantalla). Sin cambios de validación: los mismos campos exigidos de siempre, solo evaluados juntos.

## V04.8.5 Header compartido — título centrado en la familia de acceso

`.view--access .analysis-header` pasa de `flex` (título `flex:1 1 auto`, quedaba pegado a la flecha) a un grid de 3 columnas simétricas (`1fr auto 1fr`): el título queda centrado respecto del ANCHO TOTAL de la barra, no del espacio libre restante. Acotado a `.view--access` (Login, Crear cuenta/TU PERFIL, TU NIVEL BRAMU, Editar Datos, Completar Acceso, Cambiar contraseña, Configuración del grupo) — Home/Historial/Ranking/Notificaciones/Perfil (`.view--history`) quedan afuera a propósito: tienen botones propios a la derecha del título que un centrado simétrico rompería, y no estaban en el pedido. "TU PERFIL ESTÁ LISTO" gana un header nuevo (mismo patrón, sin flecha — no hay a dónde volver desde un alta recién creada).

## V04.8.6 "TU PERFIL ESTÁ LISTO" — anclada arriba (revierte el centrado vertical de V04.7)

Se retira `#view-player-card .access-scroll{justify-content:center}` (agregado en V04.7). La pantalla vuelve a la estructura pedida: header → logo → tarjeta → copy → CTA → acción secundaria, ancladas arriba como Login, sin todo el bloque flotando en el centro.

## V04.8.7 Copy del botón secundario — "COMPLETAR PERFIL" → "IR A MIS DATOS"

Con el perfil ya creado, "COMPLETAR PERFIL" debajo de "TU PERFIL ESTÁ LISTO" era contradictorio. El botón (visible solo si falta ubicación o WhatsApp, sin cambios de lógica) pasa a decir "IR A MIS DATOS" — mismo texto que ya usa esta app para el mismo destino (ver el CTA equivalente de Ranking en `app.js`, `openProfileScreen('mis-datos')`). Se descartó reusar el texto "COMPLETAR ACCESO": esa denominación ya existe en esta misma app con un significado distinto (agregar email/contraseña a una cuenta invitada, `#profile-complete-access-btn` en Mis Datos) — reusarla acá hubiera creado ambigüedad, no coherencia.

## V04.8.8 Responsive

Verificado en vivo con el Browser tool en 375px (mobile): formulario `TU PERFIL` fusionado (scroll completo, sin cortes ni superposición), `TU PERFIL ESTÁ LISTO` (anclada arriba, header centrado, tarjeta compacta), tarjeta de Home y de MI PERFIL (avatar+nombre+Nivel en una sola fila, barra/badge sin desalinear). Headers de `CREAR CUENTA`/`TU PERFIL`/`TU NIVEL BRAMU`/`ELEGÍ TU NIVEL` confirmados centrados tanto en mobile como en desktop angosto (~800px).

## V04.8.9 Archivos tocados

`bramulab/app.js`, `bramulab/index.html`, `bramulab/styles.css`, `bramulab/store.js` (`APP_VERSION`), `bramulab/sw.js` (`CACHE_NAME`), `bramulab/version.json`. `bramulab/level.js`/`level-context.js`/`level-calibration.js`/`tests.html`: **cero líneas tocadas**.

## V04.8.10 Tests

Sin fixtures nuevos: todas las correcciones de esta ronda son CSS/orquestación de `app.js` (mismo límite de siempre, `tests.html` no carga `app.js`). Verificado en vivo con el Browser tool (detalle por sección arriba), incluyendo una cuenta `legacyMigrated` con historial real fabricada para esta ronda (§V04.8.1) — la única forma de ver la tarjeta clásica con datos reales sin esperar 5 partidos jugados a mano.

**Resultado:** **1394/1394**, sin cambios respecto al baseline de V04.7, todo verde — corrido antes y después del bump de versión.

## V04.8.11 Contradicciones / decisiones de producto

Ninguna bloqueante. Una simplificación de alcance respecto a la ficha original: se retiran Edad/Mano/Lado de "TU PERFIL ESTÁ LISTO" (§V04.8.2) — el pedido no los incluía entre los elementos a compartir con Home/MI PERFIL, y esos datos ya son visibles/editables en Mis Datos.

## V04.8.12 Riesgos / deuda relevante

- Se observó (sin corregir, fuera de alcance de esta ronda) que el Perfil público de OTRO jugador que todavía no confirmó su Nivel BRAMU muestra `CALIBRANDO · 0/5` en vez de un estado neutral — el mismo problema de fondo que V04.7.2/V04.8.3 resuelven para el propio flujo de alta, visto desde Buscar Jugadores/Perfil público. No estaba en la lista de superficies pedida ("TU PERFIL ESTÁ LISTO; Home; MI PERFIL") — queda anotado para una ronda futura, no se tocó `renderPlayerPublicProfile` en esta.

## V04.8.13 Versionado y despliegue

Cuarteto completo bumpeado en la misma ronda: `Store.VERSION`/`version.json`/`sw.js` (`CACHE_NAME`)/`index.html` (14 `?v=`) → `BRAMUlab V04.8`. Commit y push a `origin/main` en esta misma intervención; deploy de GitHub Pages a verificar después del push.

## V04.8.14 No se avanzó

Confirmado — no se tocó la Fórmula V1.5, `level.js`, `level-context.js`, `level-calibration.js`, `nivel_bramu_v1_0`, `nivel_inicial_v1_1`, cuestionario, camino rápido, mapa de categorías, medidor de Nivel, Ranking BRAMU, BRAMU Intelligence ni Backend. V04.8 queda online para revisión visual de Sebastián.

# V04.9 — pulido visual de onboarding, Nivel y estado CALIBRANDO (implementada)

**Fuentes leídas esta ronda:** solo la sección V04.8 de este mismo Informe + búsqueda dirigida en `app.js`/`index.html`/`styles.css` sobre los selectores/funciones involucrados. No se releyó V03, la Fórmula V1.5 completa ni se reabrió la matemática de Nivel (pedido explícito de Sebastián, ronda quirúrgica sobre lo ya revisado a mano en V04.8).

## V04.9.1 TU PERFIL — foto + Nombre/Apellido/@usuario agrupados

La foto (antes centrada arriba, `.signup-avatar-upload` a 84px con `margin:auto`) pasa a vivir en una fila propia (`.signup-identity-row`) junto con Nombre/Apellido/@usuario apilados a su derecha (`.signup-identity-fields`) — mismo lenguaje que ya usa `.pastilla-identity` en MI PERFIL/Perfil público (avatar chico integrado en la fila, nunca solo). El avatar baja de 84px a 64px para convivir con los 3 campos de texto en el ancho del formulario. Nombre visible sigue siendo su propio campo de ancho completo debajo, sin cambios de orden.

**Iniciales en vivo:** nueva `updateSignupAvatarInitials()`, cableada al `input` de Nombre/Apellido (mismos listeners que ya disparaban `maybeSuggestSignupUsername`): sin foto, el avatar muestra la primera letra de Nombre + primera letra de Apellido en mayúsculas ("Sebastián" + "Vila" → "SV"), actualizándose en cada tecla; sin datos todavía, el placeholder de siempre ("—"); con foto elegida, la foto reemplaza a las iniciales (`setAvatarPreview`, sin cambios). Verificado en vivo.

Fecha de nacimiento + Género pasan a la misma fila (`.signup-row-2col`, `flex` a partir de 480px, apiladas antes) y ambos ganan label propio (`.field--labeled`, antes el género solo tenía su placeholder "Género" dentro del `<select>` — ahora dice "Elegir" con el label arriba, igual que el resto de los campos). Mano hábil/Lado habitual y Ubicación no cambian de posición ni de comportamiento — solo ganan el ajuste visual de las 2 secciones siguientes.

## V04.9.2 Mano hábil / Lado habitual — botones más livianos

`#signup-hand-options .option-col, #signup-side-options .option-col` (scoped por ID, nunca la regla base `.option-col` — compartida con los selectores de sistema de puntuación de otras pantallas): `min-height` 48px→40px, `padding` 12px→9px, `font-size` 12px→11px, `font-weight` 800→700. Siguen siendo botones (no dropdown), mismo estado `is-selected` de siempre.

## V04.9.3 Ubicación — fila enmarcada como campo real

`#signup-location-row` era la ÚNICA fila de su lista (`.profile-select-rows`, a diferencia de Editar Datos que tiene 5 y por eso ya se ve enmarcada por los `border-top` intermedios) — `.profile-select-row:first-child` le sacaba el borde de siempre, dejándola sin ningún borde ("texto suelto con un guion debajo"). Gana un borde propio (`border-bottom: 2px solid`, mismo lenguaje que `.field__input`) scoped por ID — `.profile-select-row` base no se toca, Editar Datos sigue igual. El placeholder pasa de "—" a "Elegir ubicación" (`resetSignupWizard`/`updateSignupLocationRowDisplay`) — más reconocible como acción, no como dato vacío. Ubicación sigue obligatoria, mismo buscador GeoRef de siempre.

## V04.9.4 "TU PERFIL ESTÁ LISTO" — copy de WhatsApp fijo

Con ubicación obligatoria desde el Handoff V04.6, el composer genérico "podés completar tu ubicación y/o tu WhatsApp" de `openPlayerCardScreen` era dead code por el lado de ubicación (siempre completa a esta altura) — se simplifica a un copy fijo, WhatsApp-only: **"Podés completar tu WhatsApp más adelante desde Mi Perfil."**, visible únicamente si todavía no hay teléfono cargado. Sin puntos rojos ni sistema de pendientes (pedido explícito). Estructura de la pantalla sin cambios.

## V04.9.5 Intro de Nivel — anclada arriba

Se retira `.access-scroll--centered` (agregada en V04.7 para los pasos "intro"/"quick", nunca revertida): el toggle en `renderNivelOnboardingStep()` se elimina en vez de dejarlo sin uso, y la regla CSS correspondiente se retira del stylesheet. Todo el flujo de TU NIVEL BRAMU (intro → quick/quiz → resultado) queda anclado arriba, igual que el resto de la familia de acceso — nunca más "todo el bloque flotando en el centro vertical".

## V04.9.6 Cuestionario — legibilidad de las opciones

`.nivel-answer-option__title` (el texto de cada respuesta, compartido por el camino rápido y las 7 preguntas completas): `font-size` 13px→14px, `font-weight` 700→500, `line-height` agregado en 1.3. `.nivel-answer-list` gana `gap` 8px→10px; `.nivel-answer-option` gana un poco de padding vertical (12px→13px). Sin cambios de preguntas, respuestas ni autoavance. Verificado en vivo, 375px: las 7 preguntas (incluidas las de 5 opciones con texto largo) se leen holgadas, sin superposición ni overflow.

## V04.9.7 Medidor — se retira el tick blanco

`.nivel-gauge__marker`/`#nivel-gauge-needle` (tick corto agregado en V04.7 sobre el arco) se retira por completo, sin reemplazo — index.html pierde el `<line>`, `setNivelGaugeValue()` pierde las 2 líneas que lo rotaban (y el parámetro `animate`, que solo controlaba la transición de ESE elemento y queda sin ningún efecto una vez retirado — se retira de la firma junto con el resto en vez de dejarlo como dead code, mismos 2 call sites actualizados). El propio extremo redondeado del arco azul (`stroke-linecap:round` en `.nivel-gauge__fill`, sin cambios) pasa a ser el único indicador de posición en la escala. Se conservan intactos: semicírculo, track oscuro, arco azul, animación del arco al cambiar el valor, número, categoría.

## V04.9.8 Medidor — número y categoría con más protagonismo

Sin el tick compitiendo visualmente: `.nivel-gauge__value` 48px→62px (`top` sin cambios, 60% — ya dejaba margen de sobra respecto del arco, verificado en vivo que el número no lo toca en ningún valor 1-10); `.nivel-gauge-card__category` 13px→16px. Sin cambios de color/familia tipográfica.

## V04.9.9 Resultado + categoría

Sin rediseño — la pantalla hereda directo los ajustes de §V04.9.7/§V04.9.8 (medidor sin marcador, número/categoría más grandes) y de §V04.9.6 (nada acá, esta pantalla no tiene lista de respuestas). Medidor, explicación, última pregunta de categoría, chips, aviso de coherencia, CONFIRMAR MI NIVEL y Revisar respuestas siguen exactamente en su lugar.

## V04.9.10 Tarjeta Home/MI PERFIL — CALIBRANDO en fila completa, CALIBRADO sin cambios

La píldora `.level-v1-badge` ("CALIBRANDO · X / 5 PARTIDOS") vivía dentro de `.player-card__level-sub`, en la columna angosta de siempre (`.player-card__level`, `max-width:46%`, la composición de referencia recuperada en V04.8) — ahí se sentía grande y alteraba la composición. Se separan los 2 estados:

- **CALIBRADO:** sin cambios — sigue mostrando la píldora chica de siempre en `.player-card__level-sub`, mismo lugar, mismo tamaño. `NIVEL BRAMU` + número nunca se mueven de la columna derecha de la fila superior.
- **CALIBRANDO:** nueva fila de ancho completo (`.player-card__calibration`, `flex-basis:100%`, mismo lugar que ocupa `.player-card__bar` para cuentas legacy calibradas) con label ámbar ("CALIBRANDO · X / 5 PARTIDOS") + una barra fina de progreso 0→5 (`.player-card__calibration-bar`). `.player-card__level-sub` queda oculto en este estado — nunca conviven las 2 formas de mostrar calibración.

Compartido tal cual por Home (`renderPlayerCard`) y MI PERFIL (`renderProfileEvolution`) — mismas clases CSS, mismo criterio de cuál rama usar (`levelV1.state === LV.STATES.CALIBRATED`), "hablan el mismo lenguaje" como pedía la ronda. Cada función arranca ocultando su bloque de calibración por default (antes de cualquier branch) para que ningún otro estado (legacy, simulado, o un Nivel V1 recién reseteado desde el modo laboratorio) pueda dejarlo visible por un render anterior.

## V04.9.11 CALIBRADO (cuenta legacy) — sin regresión

La tarjeta clásica (barra + variación + partidos totales, cuentas `legacyMigrated`) no pasa por ninguno de los branches tocados en §V04.9.10 — verificado en vivo con una cuenta `legacyMigrated` fabricada por consola (mismo recipe de V04.8.1): sigue mostrando `NIVEL BRAMU` + número simulado + barra clásica, sin ningún cambio de altura ni de geometría.

## V04.9.12 Perfil público — PENDIENTE antes de confirmar Nivel (deuda de V04.8 cerrada)

Bug real anotado como deuda en §V04.8.12: `renderPlayerPublicProfile` mostraba `CALIBRANDO · 0/5` para CUALQUIER cuenta real no-legacy con el preview de Nivel V1 activo, aunque esa persona todavía no hubiera confirmado su propio Nivel (`PH.isCalibratingRealAccount(account)` no distinguía "sin Nivel V1 guardado todavía" de "con Nivel V1 guardado, calibrando"). Corregido reusando el mismo choke point que ya usa self (`nivelOnboardingPending(account)` — válido acá tal cual, `account` ya pasó `isCalibratingRealAccount` que garantiza `!legacyMigrated`): antes de confirmar Nivel se ve `PENDIENTE`, después `CALIBRANDO · X/5` (con el progreso real, nunca inventado). `isCalibratingRealAccount`/`buildCalibrationStatus` (player-home.js) no se tocaron — todo el fix vive en `app.js`, en el call site.

**Verificado en vivo:** 2 cuentas reales fabricadas por consola (`Store.createUserAccount` + agregadas a `PLAYER_NAMES` para aparecer en Buscar Jugadores) — una sin Nivel V1 guardado (→ `PENDIENTE`, "Mejor nivel BRAMU" en `—`) y una con `Store.saveLevelV1State(...)` guardado (→ `CALIBRANDO`, progreso real derivado del historial de partidos, `0/5` porque la cuenta fabricada no tiene partidos reales — mismo criterio de siempre, nunca un número inventado).

## V04.9.13 Responsive

Verificado en vivo con el Browser tool en 375px (mobile) y desktop angosto (600-700px): TU PERFIL (foto+campos agrupados, fecha+género en fila desde 480px), cuestionario (7 preguntas), resultado/medidor, Home CALIBRANDO, Home CALIBRADO (legacy), MI PERFIL CALIBRANDO. Sin overflow, sin texto superpuesto, sin cambios de layout entre estados CALIBRANDO/CALIBRADO (misma altura de tarjeta, geometría idéntica salvo la fila de calibración que reemplaza a la barra clásica).

## V04.9.14 Archivos tocados

`bramulab/app.js`, `bramulab/index.html`, `bramulab/styles.css`, `bramulab/store.js` (`APP_VERSION`), `bramulab/sw.js` (`CACHE_NAME` + 14 `CORE_ASSETS`, quedaban en `?v=04.7` desde V04.8 — corregido de paso), `bramulab/version.json`. `bramulab/level.js`/`level-context.js`/`level-calibration.js`/`tests.html`: **cero líneas tocadas**.

## V04.9.15 Tests

Sin fixtures nuevos — el fix de Perfil público (§V04.9.12) reusa una función pura ya testeada (`nivelOnboardingPending`, sin cambios) en un nuevo call site de `app.js`, capa sin arnés automatizado (mismo límite documentado desde V04.4). Verificado en vivo con el Browser tool (detalle por sección arriba).

**Resultado:** **1394/1394**, sin cambios respecto al baseline de V04.8, todo verde — corrido antes y después del bump de versión.

## V04.9.16 Contradicciones / decisiones de producto

Ninguna bloqueante. Una decisión de scope tomada en el momento: `setNivelGaugeValue` pierde su parámetro `animate` (quedaba sin ningún efecto una vez retirado el tick que controlaba) en vez de dejarlo como dead code — mismo criterio ya aplicado en V04.8 ("una rama que nunca se ejecuta es peor que no tener rama").

## V04.9.17 Riesgos / deuda relevante

Ninguna deuda nueva detectada. La deuda de V04.8.12 (Perfil público con `CALIBRANDO · 0/5` antes de confirmar Nivel) queda cerrada en esta ronda (§V04.9.12).

## V04.9.18 Versionado y despliegue

Cuarteto completo bumpeado en la misma ronda: `Store.APP_VERSION`/`version.json`/`sw.js` (`CACHE_NAME` + 14 `CORE_ASSETS`)/`index.html` (14 `?v=`) → `BRAMUlab V04.9`. Commit y push a `origin/main` en esta misma intervención; deploy de GitHub Pages a verificar después del push.

## V04.9.19 No se avanzó

Confirmado — no se tocó la Fórmula V1.5, `level.js`, `level-context.js`, `level-calibration.js`, `nivel_bramu_v1_0`, `nivel_inicial_v1_1`, pesos, anclas, categoría, lógica matemática, Ranking BRAMU, BRAMU Intelligence ni Backend. Header centrado de V04.8 sin cambios, TU PERFIL sigue siendo un único paso (sin volver a dividirse), sin autoavance agregado, sin sistema de notificaciones por datos incompletos. V04.9 queda online para revisión visual de Sebastián.
