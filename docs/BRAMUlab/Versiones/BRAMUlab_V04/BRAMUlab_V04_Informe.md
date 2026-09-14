# BRAMUlab_V04
## Informe — V04.0 (diagnóstico) + V04.1 (Etapa A) + V04.2 (Etapa B) + V04.3 (Etapa C) + V04.4 (Etapa D, bloque 1)

**Estado:** V04.0 cerrada (diagnóstico). V04.1/V04.2/V04.3 (motor puro, elegibilidad/invitados/repetición/círculo, cuestionario/ajuste/calibración/recalibración) implementadas, ninguna conectada a la app productiva. V04.4 es la primera ronda con UI real — detrás de un flag apagado por defecto, la app productiva (`BRAMUlab_V03.10`) sigue funcionando exactamente igual para cualquier usuario que no lo active. Cada ronda se agrega como sección nueva al final, sin reabrir las anteriores.
**Fecha:** V04.0 el 14/09/2026 · V04.1 el 14/09/2026 · V04.2 el 14/09/2026 · V04.3 el 14/09/2026 · V04.4 el 14/09/2026 (mismo día, rondas separadas, cada una autorizada explícitamente por Sebastián sobre la anterior ya cerrada).
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
