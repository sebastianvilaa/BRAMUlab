# BRAMUlab_V04
## Consolidado — Nivel BRAMU

**Estado:** V04.1 (Etapa A) implementada · motor puro sin conectar a la app productiva  
**Base cerrada:** `BRAMUlab_V03.10`  
**Objetivo de V04:** implementar Nivel BRAMU V1 de forma gradual, verificable y reversible, sin reabrir la definición conceptual ya cerrada.

---

## 0. Regla de trabajo de V04

V03 quedó cerrada en `BRAMUlab_V03.10`. No se reabre salvo una regresión concreta.

Nivel BRAMU ya fue resuelto conceptualmente en un Work especializado. Desarrollo no debe rediseñar la fórmula ni volver a discutir decisiones de producto cerradas.

Documentación vigente, en este orden de precedencia:

1. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.4.md`
2. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
3. `docs/BRAMUlab/Nivel_BRAMU.md`

Ante contradicción:
- manda `Nivel_BRAMU_Formula_V1.4.md` para fórmula, parámetros, elegibilidad, casos y simulaciones;
- manda `Nivel_BRAMU_Implementacion.md` para secuencia técnica, límites y definición de terminado;
- `Nivel_BRAMU.md` aporta contexto funcional y UX, pero no puede reabrir decisiones superadas por V1.4.

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
