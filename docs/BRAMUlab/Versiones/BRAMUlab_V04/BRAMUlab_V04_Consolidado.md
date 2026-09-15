# BRAMUlab_V04
## Consolidado — Nivel BRAMU

**Estado:** V04.6 implementada · el estimador inicial pasa de V1.4 a `nivel_inicial_v1_1` (Nivel_BRAMU_Formula_V1.5.md §3) — cuestionario/camino rápido nuevos, categoría como último paso con ajuste automático ±0.5 (el stepper manual de V04.4 queda retirado), medidor semicircular, coherencia, confianza variable, y 2 ayudas mínimas de modo laboratorio. Motor de partidos (`level.js`, `nivel_bramu_v1_0`) sin cambios.  
**Base cerrada:** `BRAMUlab_V03.10`  
**Objetivo de V04:** implementar Nivel BRAMU V1 de forma gradual, verificable y reversible, sin reabrir la definición conceptual ya cerrada.

---

## 0. Regla de trabajo de V04

V03 quedó cerrada en `BRAMUlab_V03.10`. No se reabre salvo una regresión concreta.

Nivel BRAMU ya fue resuelto conceptualmente en un Work especializado. Desarrollo no debe rediseñar la fórmula ni volver a discutir decisiones de producto cerradas.

Documentación vigente, en este orden de precedencia (normalizado en V04.6 — ver §15):

1. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
2. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
3. `docs/BRAMUlab/Nivel_BRAMU.md`
4. `docs/BRAMUlab/Nivel_BRAMU_Handoff_Cuestionario_V1.5.md`

Ante contradicción:
- manda `Nivel_BRAMU_Formula_V1.5.md` para fórmula, parámetros, elegibilidad, casos y simulaciones;
- manda `Nivel_BRAMU_Implementacion.md` para secuencia técnica, límites y definición de terminado;
- `Nivel_BRAMU.md` aporta contexto funcional y UX, pero no puede reabrir decisiones superadas por V1.5.

**Superado en V04.6:** `Nivel_BRAMU_Formula_V1.4.md` queda como antecedente histórico — sus §§3.1-3.7 (cuestionario/ajuste manual del estimador inicial) ya NO se usan para altas nuevas, reemplazados por `nivel_inicial_v1_1` (V1.5 §3). El resto de V1.4 (motor de partidos, elegibilidad, recalibración) sigue vigente sin cambios — V1.5 es una corrección acotada del estimador inicial, no una reescritura completa.

No mezclar esta versión con:
- Ranking BRAMU: ya implementado en V03;
- BRAMU Intelligence: futura versión;
- Backend/Infraestructura: futura versión, salvo dependencias estrictamente necesarias.

---

## 1. Deuda documental a normalizar antes de programar

Hay dos correcciones documentales mínimas ya identificadas.

### 1.1 `Nivel_BRAMU_Implementacion.md`

REEMPLAZAR las referencias antiguas del bloque de documentos fuente por los nombres vigentes:

- `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.4.md`
- `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
- `docs/BRAMUlab/Nivel_BRAMU.md`

No cambiar fórmula, reglas, parámetros ni alcance.

### 1.2 `Nivel_BRAMU.md`

ACTUALIZAR únicamente las frases heredadas de una etapa anterior que todavía indican que:
- la fórmula definitiva está pendiente;
- los parámetros están pendientes;
- la fórmula todavía debe diseñarse o simularse.

Esas frases deben quedar marcadas como contenido superado por `Nivel_BRAMU_Formula_V1.4.md`.

No reescribir la fórmula cerrada ni alterar decisiones funcionales.

---

## 2. Estado técnico heredado de V03.10

La app actual:

- no tiene backend real;
- persiste en `localStorage`;
- usa identidad estable por `userId` desde V03;
- tiene `store.js` como capa de persistencia;
- mantiene la lógica calculable en módulos JS puros, sin DOM;
- prueba los módulos puros desde `tests.html`;
- deja `app.js` principalmente como orquestador de UI;
- terminó V03.10 con 1060/1060 tests.

Archivos relevantes actuales:

- `bramulab/store.js`
- `bramulab/player-home.js`
- `bramulab/ranking.js`
- `bramulab/app.js`
- `bramulab/tests.html`
- `bramulab/index.html`
- `bramulab/sw.js`
- `bramulab/version.json`

### Nivel provisional heredado

V03 contiene lógica provisional/simulada de Nivel dentro de `player-home.js`.

Entre otras cosas existen:

- `LEVEL_BASE = 5.0`
- `LEVEL_MIN = 1.0`
- `LEVEL_MAX = 10.0`
- `computeLevelDeltaForMatch(...)`
- `computeLevelEvolution(...)`
- `computeSimulatedJugadorLevel(...)`
- lógica visual de calibración previa.

La regla provisional actual mueve el nivel por resultado con deltas simples (`±0.1` / `±0.2`) y también usa valores simulados por hash para jugadores sin historial.

Esa lógica fue correcta como prototipo de V03, pero NO es Nivel BRAMU V1.4.

V04 no debe borrarla ni reemplazarla de golpe. Primero debe construirse el motor real detrás de un feature flag, probarlo y recién en etapas posteriores decidir qué consumidores migran.

---

## 3. Diagnóstico de infraestructura

### Qué ya existe y permite empezar ahora

No hace falta esperar al backend para implementar la Etapa A.

Ya existen:
- identificadores `userId`;
- historial local estructurado;
- resultados de partidos;
- composición de parejas;
- fechas;
- formatos;
- módulos de lógica pura;
- arnés de tests;
- sistema de versionado de la app.

Esto alcanza para construir y verificar un motor determinístico aislado.

### Qué NO existe todavía y dependerá de etapas posteriores/backend

No existe aún infraestructura real multiusuario para:
- validación de un resultado por la pareja rival;
- invitaciones/reclamos reales entre cuentas de distintos dispositivos;
- sincronización central de ratings;
- persistencia compartida y autoridad única del estado de Nivel;
- idempotencia distribuida;
- validación remota de correcciones;
- datos completos de terceros fuera del dispositivo local.

Estas carencias NO bloquean Etapa A.

Deben diseñarse de forma que el modelo pueda migrar a backend más adelante sin cambiar la fórmula.

---

## 4. Orden de implementación aprobado como marco

La implementación debe hacerse por bloques. No implementar toda V04 en una sola entrega.

### Etapa A — Modelo + motor puro + parámetros + auditoría + feature flag

Primera etapa autorizable.

Sin cambios visibles de interfaz.

Debe dejar:
- modelo de estado de rating;
- contratos de entrada/salida;
- parámetros V1 centralizados;
- motor puro/determinístico;
- resultado auditable;
- precisión interna separada de redondeo público;
- versión `nivel_bramu_v1_0`;
- feature flag apagado;
- fixtures/tests ejecutables.

### Etapa B — Elegibilidad y calidad de evidencia

Posterior. Incluye invitados, disponibilidad, repetición, compañero, círculo, estados computables/excluidos/corregidos/anulados y reglas temporales.

### Etapa C — Alta, calibración y recalibración

Posterior. Cuestionario, nivel inicial, ajuste ±0.5, estados y cooldown.

### Etapa D — UI y explicaciones

Posterior. Home, Perfil, Perfil público, historial y explicación de variaciones.

### Etapa E — Validación integral y activación

Posterior. Fixtures completos, simulaciones, correcciones, idempotencia y activación controlada.

---

## 5. Arquitectura recomendada para Etapa A

La auditoría de Claude Code debe confirmar nombres y ubicación exacta antes de programar, pero la dirección preferida es:

### Nuevo módulo puro

AGREGAR un módulo dedicado, separado de `player-home.js`, por ejemplo:

`bramulab/level.js`

Responsabilidad:
- parámetros;
- tipos/shape documentado de entradas y salidas;
- funciones matemáticas puras;
- motor V1;
- códigos de auditoría;
- cero DOM;
- cero escritura directa a `localStorage`.

No incrustar la fórmula real dentro de `app.js`, `ranking.js` ni `player-home.js`.

### Persistencia

`store.js` deberá poder alojar, en una etapa controlada, el estado y los eventos de Nivel.

La auditoría debe proponer las claves exactas y estrategia de schema sin activar todavía cambios productivos.

### Tests

`tests.html` debe incorporar fixtures específicos de Nivel BRAMU sin depender de UI.

El motor tiene que poder probarse pasando objetos de entrada y comparando objetos de salida.

---

## 6. Afectación prevista

### Archivos probablemente afectados en Etapa A

- nuevo `bramulab/level.js`;
- `bramulab/tests.html`;
- `bramulab/index.html` únicamente para cargar el módulo, si corresponde;
- `bramulab/sw.js` si el nuevo asset debe quedar en caché;
- posiblemente `bramulab/store.js` para modelo/feature flag, pero sin conectar todavía el flujo productivo;
- versionado únicamente cuando exista una ronda de implementación aprobada.

### Archivos que NO deberían absorber la fórmula

- `ranking.js`
- `groups.js`
- `stats.js`
- `engine.js`

### Consumidores futuros, no Etapa A

- `player-home.js`
- `app.js`
- `ranking.js`

En Etapa A no deben migrarse a Nivel real.

### Pantallas futuras afectadas

No en Etapa A, pero más adelante:
- onboarding / creación de nivel;
- Home / Player Card;
- Mi Perfil;
- Perfil público;
- evolución de Nivel;
- historial/resumen cuando corresponda explicar incidencia;
- Ranking como consumidor del nivel consolidado.

Ranking nunca calcula Nivel.

---

## 7. Pruebas mínimas que debe permitir Etapa A

Antes de tocar UI el motor debe poder comprobar, como mínimo:

- misma entrada + misma versión = misma salida;
- límites 1.0000–10.0000;
- precisión interna a cuatro decimales;
- redondeo público independiente;
- nivel efectivo según confianza;
- fuerza de pareja;
- expectativa complementaria entre A/B;
- victoria nunca genera delta negativo;
- derrota nunca genera delta positivo;
- margen dentro del rango aprobado;
- factores de formato;
- K individual por confianza;
- factor de confianza rival;
- clamps máximos por estado;
- actualización de evidencia/confianza;
- inactividad sobre confianza efectiva sin bajar `mu`;
- snapshots suficientes para reconstruir el cálculo;
- `algorithm_version` presente en toda salida auditable.

Además deben incorporarse como fixtures los casos numéricos publicados en `Nivel_BRAMU_Formula_V1.4.md`.

---

## 8. Primera ronda para Claude Code — V04.0

### Objetivo

Hacer auditoría técnica real del repositorio, normalizar las dos deudas documentales indicadas y devolver el plan exacto para Etapa A.

### En esta ronda Claude Code DEBE

1. Leer completos:
   - `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.4.md`
   - `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
   - `docs/BRAMUlab/Nivel_BRAMU.md`
   - `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md`
   - `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`
   - este `BRAMUlab_V04_Consolidado.md`

2. Inspeccionar arquitectura actual, como mínimo:
   - `bramulab/store.js`
   - `bramulab/player-home.js`
   - `bramulab/ranking.js`
   - `bramulab/app.js`
   - `bramulab/tests.html`
   - `bramulab/index.html`
   - `bramulab/sw.js`
   - `bramulab/version.json`

3. Aplicar SOLO las dos normalizaciones documentales de §1.

4. No implementar todavía el motor ni ninguna funcionalidad de Nivel.

5. Entregar diagnóstico técnico concreto:
   - archivos exactos a agregar/modificar en Etapa A;
   - modelo de datos propuesto;
   - claves/localStorage provisionales si hicieran falta;
   - contrato de entrada/salida del motor;
   - ubicación de parámetros;
   - forma del feature flag;
   - convivencia temporal con el Nivel provisional de V03;
   - estrategia de tests y fixtures;
   - qué puede hacerse ahora sin backend;
   - qué debe quedar desacoplado para backend futuro;
   - riesgos reales de regresión.

6. Crear/actualizar:
   `docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`

El informe debe dejar registrado qué inspeccionó, qué corrigió documentalmente y cuál es el plan técnico recomendado.

### Prohibido en V04.0

- implementar Etapa A;
- cambiar la fórmula V1.4;
- cambiar UI;
- reemplazar el Nivel provisional vigente;
- conectar Ranking al motor nuevo;
- tocar BRAMU Intelligence;
- introducir backend;
- borrar lógica legacy/provisional que todavía usa la app;
- cambiar la versión pública de la app.

---

## 9. Gate para autorizar Etapa A

Etapa A solo se autoriza después de revisar el informe de V04.0 y confirmar que:

- la arquitectura propuesta respeta la separación de lógica pura;
- el nuevo motor puede coexistir apagado con V03;
- no obliga a backend;
- los fixtures cubren la fórmula normativa;
- el feature flag permite activar/desactivar sin migración irreversible;
- no hay decisiones de producto nuevas disfrazadas de decisiones técnicas.

Hasta entonces, V04 está iniciada pero sin implementación funcional.

---

## 10. V04.1 — Etapa A (implementada)

**Autorizado por Sebastián** sobre el diagnóstico de V04.0, con dos decisiones cerradas explícitamente en la autorización (no reabren nada de §1-§9, las precisan):

- **Diferir `store.js`:** Etapa A no persiste ningún estado real de Nivel BRAMU. El modelo de datos de §4.2 del Informe queda documentado como propuesta, no como código.
- **No conectar `level.js` a la app productiva todavía:** ni siquiera el feature flag se lee desde ningún consumidor — `app.js`/`player-home.js`/`ranking.js`/`index.html`/`sw.js`/`version.json` quedan intactos, y la versión pública de la app no cambia.

Lo implementado (arquitectura ya prevista en §5/§6, confirmada sin desvíos):

- `bramulab/level.js` — nuevo, motor puro. Contiene exactamente lo pedido en la autorización: parámetros V1 centralizados, `algorithm_version = 'nivel_bramu_v1_0'`, `NIVEL_BRAMU_V1_ENABLED = false` (constante de código, no Store), nivel efectivo, fuerza de pareja, expectativa, multiplicador de margen, los 5 factores de §7/§8/§8.1/§13 de la fórmula, K por confianza, factor de confianza rival, delta individual con topes por estado, evidencia y actualización de confianza, decay por inactividad, clamps 1.0000-10.0000, redondeo público separado del interno, y una función compuesta (`computeMatchUpdate`) que arma la salida auditable completa (snapshots, factores, deltas, `reasonCodes`, `algorithm_version`).
- No implementa elegibilidad/invitados/repetición-real/círculo-real/correcciones/estados de partido a partir de historial — esos valores entran como inputs ya calculados (contrato explícito en la cabecera del archivo), tal como pidió la autorización para Etapa B.
- `bramulab/tests.html` — `level.js` se carga SOLO acá (no en `index.html`), con 160 fixtures nuevos sobre el propio motor, sin `AFFECTED_KEYS` (módulo puro, sin `localStorage`).

**Resultado de tests:** 1060/1060 (baseline V03.10) + 160/160 nuevos = **1220/1220**, verificado corriendo el arnés real (no solo revisado el código) contra un servidor local (`python3 .claude/dev-server.py`), con todos los casos normativos de `Nivel_BRAMU_Formula_V1.4.md` §14 (18 simulaciones de partido único) dentro de la tolerancia ±0.01 pedida.

Detalle completo (derivación de los arquetipos de confianza usados para los fixtures, diferencias encontradas y lo que queda para Etapa B) en `BRAMUlab_V04_Informe.md` §"V04.1".

**No se avanzó a Etapa B** — sigue pendiente de autorización, gate en §4/§9 de este documento sin cambios.

---

## 11. V04.2 — Etapa B (implementada)

**Autorizado por Sebastián** sobre V04.1 ya cerrada y commiteada. Objetivo: "construir la capa pura que, a partir de un partido + historial + estados de jugadores, determine si ese partido puede aportar evidencia al Nivel BRAMU y arme correctamente el contexto que necesita `level.js`." Explícitamente sin conectar todavía a la UI ni reemplazar el Nivel provisional de V03, y sin tocar `store.js` (persistencia sigue diferida).

**Arquitectura:** `bramulab/level-context.js` (nuevo, 626 líneas), separado de `level.js` tal como recomendaba este documento — interpreta partido/historial/estados y arma el contexto; toda la matemática compartida (nivel efectivo, fuerza de pareja, factor de repetición/compañero) se delega a `Level.compute*` de `level.js`, nunca se reimplementa.

Implementado, siguiendo exactamente los 6 puntos de la autorización:

1. **Elegibilidad** — estados `computable`/`pendiente`/`excluido`/`corregido`/`anulado`/`duplicado`; formato válido, resultado incompleto/abandono/walkover excluidos, observado por espectador excluido, ventana de 30 días para partidos manuales (§12.2).
2. **Participantes e invitados** — disponibilidad 1.00/0.80/0.60 (§13), imputación exacta (promedio de niveles efectivos conocidos), invitados identificados aparte para que nunca reciban delta, confianza rival calculada solo con rivales reales cuando hay invitado.
3. **Repetición (180 días)** — `n_pair`/`n_r1`/`n_r2`/`n_companero` derivados del historial real, alimentando `Level.computeRepetitionFactor`/`computeCompanionFactor` sin duplicarlas.
4. **Círculo competitivo cerrado (§8.1)** — detección real de los 7 umbrales (20 partidos, concentración 80% en hasta 11 coparticipantes, grupo ≤12, amplitud ≤1.5, partido íntegramente dentro, rival no superior a 0.75).
5. **Contexto compuesto** — `buildLevelEngineContext`/`computeMatchLevelUpdate` transforman partido+historial+estados en el input exacto de `Level.computeMatchUpdate`, o devuelven `eligible:false` sin llamar al motor.
6. **Correcciones/anulaciones** — modeladas como estado y decisión de elegibilidad (`corregido`/`anulado`), sin construir persistencia ni reversión real — eso queda fuera de Etapa B, tal como se pidió.

**Resultado de tests:** 1220/1220 (baseline de V04.1) + 45/45 nuevos = **1265/1265**, corrido de verdad contra el arnés real.

**Diferencias/decisiones técnicas reales encontradas** (detalle completo en `BRAMUlab_V04_Informe.md` §"V04.2"): el modelo de datos real de hoy no tiene "mini sets" ni un `formatId` de "match tie-break" (`engine.js` solo define `classic`/`americano`) — se mapean con reglas explícitas y documentadas, no inventadas; el reparto de `n_pair`/`n_r1`/`n_r2` entre los 2 compañeros de una pareja no está unívocamente definido por la fórmula cuando difieren entre sí — se resolvió tomando el máximo (criterio conservador, documentado); se usó un truco algebraico exacto (no una aproximación) para que el invitado aporte a la fuerza de pareja exactamente su nivel imputado sin tocar `level.js`.

**No se tocó** `app.js`/`player-home.js`/`ranking.js`/`store.js`/`index.html`/`sw.js`/`version.json`, UI, cuestionario, calibración/recalibración (Etapa C), BRAMU Intelligence, backend ni la versión pública.

**No se avanzó a Etapa C.**

---

## 13. V04.4 — Etapa D, bloque 1 (implementada)

**Autorizado por Sebastián** sobre V04.3 ya cerrada y commiteada. Objetivo: primer bloque VISIBLE de Etapa D — recorrido completo Crear cuenta → cuestionario/camino rápido → resultado → ajuste → confirmar → CALIBRANDO real en Home/Perfil, probable de revisar visualmente antes de seguir. A diferencia de A/B/C, esta ronda SÍ toca `app.js`/`index.html`/`store.js`/`styles.css` (no estaban en la lista de "no tocar" de esta autorización) — con un requisito explícito y verificado: la versión pública `BRAMUlab_V03.10` debe seguir funcionando exactamente igual para cualquier usuario que no active el flag.

**Flag de vista previa:** `Store.isLevelV1PreviewEnabled()`, apagado por defecto, sin ningún camino de activación accidental — se prende únicamente manteniendo presionado el logo del Home (mismo gesto ya usado para "Herramientas de desarrollo"/Forzar actualización) y tocando el nuevo ítem "Nivel BRAMU V1 (preview)". Verificado explícitamente con el flag apagado: una cuenta nueva sigue viendo exactamente el mismo `CALIBRANDO · 0/5 PARTIDOS` sin número de siempre — cero diferencia de comportamiento.

**Implementado (con el flag prendido):**
- Onboarding nuevo en una sola vista (`#view-nivel-onboarding`, mismo patrón que `#view-signup`/`#view-forgot-password`): intro (elegir camino) → camino rápido (5 semillas de `level-calibration.js`) o cuestionario completo (7 pasos, una pregunta por pantalla, barra de progreso) → resultado (nivel + categoría + ajuste ±0.5 en vivo + confirmar). Cero fórmula propia en `app.js` — cada número sale de `LVC`/`LV`.
- Persistencia de PROTOTIPO explícita en `store.js` (`bramulab.levelV1State.v1`, dict por userId — mismo patrón que `ADDED_PLAYERS`): guarda exactamente lo que devuelve `LVC.buildInitialCalibrationState` (mu, confidence, evidenceUnits, state, ratedMatches, distinctOpponents, lastRatedAt, algorithm_version, origin completo con respuestas/bruto/ajuste/confirmado).
- Home (Player Card) y MI PERFIL reemplazan el Nivel simulado/provisional de V03 por el Nivel BRAMU V1 real cuando existe — nunca los dos a la vez. A diferencia del simulado (que nunca mostraba número mientras calibraba), V1 SÍ muestra el número real con el badge CALIBRANDO/CALIBRADO (punto ámbar/lima + texto, nunca solo color).
- Verificado a mano con el Browser tool (capturas en el Informe): 3 cuentas de prueba (camino completo con ajuste +0.5, camino rápido sin ajuste, y una cuenta con el flag apagado para confirmar que V03.10 no cambió), en desktop y mobile (375px), con persistencia confirmada tras recargar la página.

**Resultado de tests:** 1317/1317 (baseline de V04.3) + 21/21 nuevos = **1338/1338**. Los 21 fixtures nuevos cubren únicamente las piezas puras SIN DOM de esta ronda (persistencia de `store.js`, `LVC.categorizeLevel`) — el resto (onboarding, Home, MI PERFIL) es UI/DOM sin arnés automatizado posible, mismo límite documentado desde V01, verificado a mano.

**Bug real encontrado y corregido en esta misma ronda:** el bloque `#evolution-calibration` de MI PERFIL (reutilizado para mostrar CALIBRANDO) tenía una nota fija "BRAMU todavía no calculó tu Nivel — la fórmula real se define más adelante" — correcta para el simulado de V03, pero CONTRADICTORIA al mostrar un Nivel V1 real arriba (Consolidado §7: nunca dos verdades a la vez). Se agregó una nota separada para el caso V1, nunca se muestran las dos.

**No se tocó** `player-home.js`/`ranking.js`/`sw.js`/`version.json`, Ranking BRAMU, BRAMU Intelligence, perfil público, cálculo real de partidos, recalibración visual ni backend real.

**No se avanzó al siguiente bloque de Etapa D** (evolución por partidos reales, Ranking, perfil público, explicación de deltas, recalibración visual).

---

## 14. V04.5 — acceso al preview + versión pública visible (implementada)

**Nota de numeración:** esta ronda se llamó `V04.4.1` en el commit anterior. Sebastián definió que BRAMUlab no sigue usando subversiones de 3 niveles (`V04.4.1`, `V04.4.2`...) — a partir de acá la secuencia es plana: `V04.4`, `V04.5`, `V04.6`... Esta sección (y su equivalente en el Informe) quedan renombradas a `V04.5`; el contenido de las rondas anteriores (`V04.0` a `V04.4`, ya cerradas) no se reescribe.

**Pedido de Sebastián (2 correcciones sobre lo recién commiteado, antes de seguir probando):**

1. **Acceso al preview simplificado** — un ícono visible en la cabecera del Home, junto a Ranking/Notificaciones, que active/desactive el preview con un solo toque, funcionando en mouse Y touch, sin depender del long-press sobre el logo (que se conserva, pero deja de ser obligatorio). Identificación clara del estado activo (`V04.5 PREVIEW`).
2. **Versión/caché real** — la app seguía mostrando `BRAMUlab V03.10` y el ícono nuevo no llegaba a aparecer, señal de assets viejos servidos por el navegador/PWA. Aplicar el cuarteto de versionado ya establecido (Store.VERSION/`version.json`/`sw.js`/`?v=` de los assets) para que la versión que Sebastián desarrolla y prueba se identifique como `BRAMUlab V04.5` — `V03.10` queda como el tag estable anterior, ya cerrado, sin necesidad de seguir mostrándose.

**Implementado (parte 1, acceso):** ícono de matraz/laboratorio (`#player-home-lab-preview-btn`) en `.player-home-header__actions`, junto a Ranking/Notificaciones. Un toque activa/desactiva `Store.isLevelV1PreviewEnabled()` directamente (sin menú intermedio), con toast de confirmación ("ACTIVADO"/"DESACTIVADO") y el propio ícono se pinta lima mientras está prendido — visible sin abrir nada. El menú de Herramientas (long-press, conservado) muestra su título como "HERRAMIENTAS · V04.5 PREVIEW" mientras el preview está activo, o "HERRAMIENTAS" a secas si no — un único punto (`refreshLabPreviewUI`) sincroniza ícono + label del toggle + título del menú, sin importar desde cuál de los 2 lugares se cambió.

**Implementado (parte 2, versión pública):** bump real y coherente del cuarteto ya establecido desde V03.1.6 — `Store.VERSION`/`APP_VERSION` → `'BRAMUlab V04.5'`; `version.json` → `{"version":"BRAMUlab V04.5"}`; `sw.js` → `CACHE_NAME='bramulab-v04-5'` y los `?v=03.10` de `CORE_ASSETS` → `?v=04.5` (incluidos `level.js`/`level-context.js`/`level-calibration.js`, que habían quedado fuera de `CORE_ASSETS` en V04.4 porque todavía no había release); `index.html` → mismos `?v=04.5` en los 12 `<script>`/`<link>`. Los 4 lugares se movieron juntos, mismo criterio que cualquier bump anterior del proyecto — evita el bug de caché HTTP nativa ya documentado desde V03.1.6.

**No se tocó** el onboarding ni el diseño de Nivel BRAMU de V04.4 — cero cambios en `#view-nivel-onboarding`, `level.js`/`level-context.js`/`level-calibration.js` (contenido), ni en la lógica de gate de `initPlayerCardScreen`/`renderPlayerCard`/`renderProfileEvolution` (siguen leyendo exactamente el mismo flag). No se tocó Backend/Ranking/Intelligence.

**Resultado de tests:** 1338/1338 (baseline de V04.4) sin cambios — ninguna de las 2 correcciones agrega lógica pura nueva. Verificado además a mano con el Browser tool: la app ahora muestra `BRAMUlab V04.5` (footer del Home), el ícono de matraz aparece y activa/desactiva el preview correctamente en desktop y mobile, tras recarga de página (detalle en el Informe).

**No apareció ninguna contradicción ni decisión de producto nueva** — corrección de numeración y de infraestructura de versionado, ambas explícitamente autorizadas por Sebastián, commiteada directamente según la regla vigente.

---

## 12. V04.3 — Etapa C (implementada)

**Autorizado por Sebastián** sobre V04.2 ya cerrada y commiteada. Objetivo: implementar como lógica pura el ciclo completo estimación inicial → cuestionario rápido/completo → ajuste → calibración → transición a calibrado → recalibración. Sin UI, sin conectar a `store.js`/`app.js`/Ranking/historial real.

**Arquitectura:** `bramulab/level-calibration.js` (nuevo, 393 líneas), separado de `level.js`/`level-context.js` como recomendaba este documento — reutiliza `Level.STATES`, `Level.PARAMS.CONFIDENCE_ORIGIN_*` y `Level.clampLevel` en vez de duplicarlos.

Implementado, siguiendo los 7 puntos de la autorización:

1. **Cuestionario completo** — las 7 preguntas y pesos exactos de `Nivel_BRAMU_Formula_V1.4.md` §3.1/§3.5, `Q = Σ(w×q)`, `nivel = 1 + 7.5×Q`, rango bruto 1.0–8.5, confidence inicial 0.15.
2. **Camino rápido** — las 5 semillas exactas de §3.3, confidence inicial 0.10.
3. **Ajuste inicial** — único, ±0.5 en pasos de 0.1, resultado final limitado a 1.0–9.0, rechazo explícito (no clamp silencioso) de ajustes fuera de rango o de un segundo ajuste tras confirmar.
4. **Estado inicial** — `state=calibrando`, `mu`/`confidence`/`evidence_units`/`rated_matches`/`distinct_opponents`/`last_rated_at`/`algorithm_version` + `origin` con las respuestas como dato DECLARADO, nunca como hecho deportivo.
5. **Calibración** — transición CALIBRANDO→CALIBRADO solo con 5 partidos computables Y 3 rivales distintos a la vez (§10.2).
6. **Recalibración** — cooldown de 90 días desde la confirmación del cuestionario, `mu_provisional`/`confidence_provisional` con la fórmula exacta de §11.2, cierre con 3 partidos+2 rivales, ventana máxima de 120 días, expiración vuelve al consolidado sin perder trazabilidad (§11.3).
7. **Trazabilidad** — cada función devuelve origen, respuestas, nivel bruto/ajuste/confirmado, estado previo/posterior, fecha, `algorithm_version` y `reasonCodes`.

**Resultado de tests:** 1265/1265 (baseline de V04.2) + 52/52 nuevos = **1317/1317**, corrido de verdad contra el arnés real, sin fallos en la primera corrida.

**Contradicciones reales:** ninguna encontrada entre `Nivel_BRAMU_Formula_V1.4.md`, `Nivel_BRAMU_Implementacion.md` y `Nivel_BRAMU.md` para lo que exige esta etapa. Se documentan 2 inferencias (huecos que la fórmula no fija explícitamente, resueltos por la lectura más consistente, no contradicciones) en `BRAMUlab_V04_Informe.md` §"V04.3": el ajuste propio del cuestionario de recalibración reutiliza el mismo clamp 1.0–9.0 que el inicial, y "la última calibración o recalibración" (para el cómputo del cooldown) queda a criterio de quien integre el módulo en el futuro (sin historial propio en esta etapa).

**No se tocó** `app.js`/`player-home.js`/`ranking.js`/`store.js`/`index.html`/`sw.js`/`version.json`, UI, backend ni BRAMU Intelligence.

**No se avanzó a Etapa D.**

---

## 15. V04.6 — estimador inicial V1.1 (implementada)

**Autorizado por Sebastián** sobre V04.5 online. Objetivo: sustituir de forma acotada el estimador inicial V1.4 (cuestionario/ajuste manual de V04.3-V04.5) por `nivel_inicial_v1_1` (Nivel_BRAMU_Formula_V1.5.md §3), con su UX inmediata — sin tocar el motor de partidos, Ranking BRAMU ni BRAMU Intelligence.

**Diagnóstico previo (sin bloqueo real):** la prueba visual real de V04.4/V04.5 mostró que años/frecuencia/etiquetas competitivas abstractas podían inflar a amateurs experimentados sin evidencia técnica real — no era un bug de implementación (V04 reproducía V1.4 correctamente), sino un sesgo de la fórmula V1.4 en sí. V1.5 lo corrige separando capacidad (autoevaluación+técnica), contexto (años/frecuencia/entrenamiento, nunca suben `mu` directamente) y confiabilidad (confianza variable + coherencia).

**Reemplazado en `bramulab/level-calibration.js`:**
- El cuestionario ponderado de 7 preguntas (`Q = Σ(w×q)`, `1 + 7.5×Q`) por `computeFullEstimate` (`nivel_base = 0.65×autoevaluación + 0.35×técnica + modificador_entrenamiento`).
- El camino rápido conserva las mismas 5 anclas (2.0/4.0/5.5/7.0/8.5), pero la etiqueta superior pasa de "Competición" a "Profesional".
- La categoría deja de pedirse en el alta de cuenta (paso 3 del signup) y pasa a ser la ÚLTIMA pregunta de Nivel, compartida por los dos caminos, con ajuste automático `clamp(0.70×(referencia_categoria−nivel_base); ±0.5)` — nunca manual. El stepper ±0.5 de V04.4 queda retirado (`validateAdjustment` ya no exige múltiplos de 0.1: esa granularidad era del stepper, nunca una regla de la fórmula).
- Confianza de origen fija (0.15 completo / 0.10 rápido) por confianza variable (0.12/0.15/0.18 en el completo según puntos de contexto; 0.10 fijo en el rápido, con o sin categoría) y coherencia (`brecha ≥ 2.0` ofrece "Revisar respuestas"; si se confirma igual, confianza limitada a 0.10 — el nivel calculado nunca se penaliza).
- `LEVEL_CATEGORIES`/`categorizeLevel`: cortes actualizados (1.0-2.4/2.5-3.9/4.0-4.9/5.0-6.3/6.4-7.9/8.0-10.0) y etiqueta superior "Profesional".

**Conservado íntegro:** `bramulab/level.js` (motor `nivel_bramu_v1_0`, `PARAMS`, sin ninguna línea tocada), calibración (§10.2, 5 partidos+3 rivales) y recalibración (§11, cooldown 90 días/ancla 75-25/±0.5/ventana 120 días/cierre 3+2) — la primitiva genérica `confirmInitialLevel`/`validateAdjustment` sigue reutilizándose tal cual por la recalibración, solo se le quitó la exigencia de múltiplos de 0.1 (compartida, nunca una segunda implementación).

**Cuenta/perfil:** `TU PÁDEL`→`TU PERFIL`, `CREAR MI JUGADOR`→`CREAR MI PERFIL`, `TU JUGADOR ESTÁ LISTO`→`TU PERFIL ESTÁ LISTO` (evita lenguaje de "crear jugador"). Ubicación pasa de opcional a obligatoria en el alta (dato necesario para el mapa de categoría). Categoría se guarda en el MISMO campo `declaredCategory` de siempre, tanto si se responde en Nivel como si se edita luego desde Mis Datos — nunca dos categorías independientes. Género sigue sin tocarse esta ronda.

**UX nueva del resultado:** medidor semicircular 1-10 (`#nivel-gauge-*`, azul `--accent-cyan` existente del sistema BRAMU, nunca una paleta nueva ni gradiente rojo/verde) con número grande y categoría de comunicación debajo; "Tu estimación inicial" antes de responder categoría, "Tu punto de partida en BRAMU" después, con la aguja/arco animando el ajuste (nunca una animación ficticia si el ajuste es 0). Grilla de 11 chips para la categoría (1ª-9ª + "No compito" + "No estoy seguro"), ninguno preseleccionado ni destacado. Aviso de coherencia no acusatorio, con "Revisar respuestas" como alternativa a confirmar igual.

**Modo laboratorio (Handoff V04.6 §10):** dos ayudas mínimas en el menú de Herramientas (long-press sobre el logo de Home), visibles solo con el preview activado — "Crear usuario de prueba" (`Store.createUserAccount` sin email/contraseña + `saveSessionUserId` directo, sin pasar por el wizard) y "Resetear Nivel BRAMU" (`Store.resetLevelV1State`, nuevo: borra SOLO la entrada de `LEVEL_V1_STATE` del userId activo, reabre el onboarding — historial/estadísticas/red/jugadores/grupos quedan intactos). Ninguna migración productiva de estados preview V1.4 viejos: son datos ficticios de laboratorio, se resetean explícitamente.

**Bug real preexistente encontrado y corregido (bloqueaba esta misma ronda):** `#dev-tools-modal` vivía dentro de `#view-setup` desde V13.1 y nunca se movió cuando Home pasó a ser `#view-player-home` con su propio logo (`#player-home-logo`) — un `position:fixed` dentro de un ancestro `display:none` no se pinta, y además `initDevTools()` seguía escuchando en `#home-logo` (el logo de Setup, no el de Home). El long-press sobre el logo de Home nunca abría nada de verdad, en ninguna versión anterior. Se corrigió moviendo el modal afuera de cualquier `.view` (mismo lugar que `#update-available-modal`/`#scoring-system-modal`, ya corregidos así en V13.2/V13.3) y apuntando el listener a `#player-home-logo`. Sin este fix, los 2 botones nuevos de laboratorio de esta ronda habrían quedado inalcanzables.

**Categoría/ubicación después de confirmar Nivel:** una edición posterior nunca recalcula retroactivamente el nivel inicial ya confirmado (el Nivel inicial es una fotografía de origen; después evoluciona solo por las reglas del motor de partidos) — decisión registrada, sin FAQ todavía.

**Resultado de tests:** 1338/1338 (baseline de V04.5) − 2 fixtures del cuestionario V1.4 retirados (catálogo/pesos ya no existen) + 58 nuevos de V1.1 (anclas/modificadores, estimación completa/rápida, categoría/coherencia/confianza, confirmación, 4 fixtures obligatorios × 2 caminos, 8 perfiles de estrés §3.8, ajuste genérico sin múltiplos de 0.1, determinismo, `Store.resetLevelV1State`, `categorizeLevel` con los nuevos cortes) = **1394/1394**, corrido de verdad contra el arnés real.

**No se tocó** Ranking BRAMU, BRAMU Intelligence, Backend/autenticación real, ni la lógica competitiva posterior al nivel inicial (motor de partidos, invitados, círculo, inactividad — todos en `level.js`/`level-context.js`, sin una línea modificada).

**No se avanzó** a evolución por partidos reales más allá de lo ya existente, Ranking, perfil público ni BRAMU Intelligence. V04.6 queda online para revisión visual manual de Sebastián.
