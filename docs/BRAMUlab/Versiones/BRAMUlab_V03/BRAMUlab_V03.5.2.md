# BRAMUlab V03.5.2 — Cierre UX + Ranking semanal

**Estado:** LISTA PARA IMPLEMENTAR Y VALIDAR VISUALMENTE  
**Base:** BRAMUlab V03.5.1 publicada  
**Fuente funcional vigente de Ranking:** `docs/BRAMUlab/Ranking_BRAMU.md`  
**Documento operativo anterior:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.5.1.md`

---

## 1. Objetivo de esta iteración

V03.5.2 es una ronda corta y focalizada.

No busca rediseñar Ranking ni abrir nuevos frentes. Tiene dos objetivos:

1. **Alinear la implementación con la nueva definición funcional de Ranking BRAMU semanal.**
2. **Resolver microajustes de UX detectados en la prueba real de V03.5.1.**

Ranking BRAMU V1 ya no debe comportarse como una clasificación continua en vivo.

La nueva fuente normativa es `docs/BRAMUlab/Ranking_BRAMU.md`, donde quedó cerrada la nueva cadencia semanal.

---

## 2. Cambio funcional principal — Ranking semanal

### 2.1 Regla vigente

Nivel BRAMU y Ranking BRAMU tienen cadencias distintas:

- **Nivel BRAMU** es dinámico y puede cambiar después de cada partido computable y validado.
- **Ranking BRAMU** se publica una vez por semana.

Semana V1:

- inicio: lunes `00:00:00`
- cierre: domingo `23:59:59`
- timezone: `America/Argentina/Buenos_Aires`

El lunes se publica una nueva edición usando el Nivel BRAMU consolidado que cada jugador tenía al cierre del domingo.

Durante toda esa semana:

- el puesto publicado permanece estable;
- el Nivel mostrado dentro de Ranking debe ser el **Nivel del corte semanal**;
- el Nivel actual del jugador puede seguir cambiando en Home/Perfil.

### 2.2 No recalcular Ranking en vivo

No actualizar la clasificación cada vez que cambia un Nivel durante la semana.

Ejemplo:

- Ranking publicado el lunes: Seba #18 con Nivel 5,3.
- El jueves juega y su Nivel actual pasa a 5,5.
- Home/Perfil puede mostrar 5,5.
- Ranking sigue mostrando #18 y Nivel 5,3 hasta la próxima publicación semanal.

### 2.3 Partidos cargados/validados tarde

Para afectar una edición semanal, el partido debe quedar computable y validado antes del cierre.

Un partido jugado el domingo por la noche pero cargado o validado el lunes:

- sí puede modificar el Nivel actual;
- no debe reescribir el Ranking ya publicado;
- impacta en la edición siguiente.

No implementar retroactividad ordinaria sobre snapshots semanales publicados.

---

## 3. Identificación visible de la edición

La pantalla debe dejar claro qué semana representa el Ranking visible.

Cerca de `CLASIFICACIÓN` mostrar una línea secundaria de contexto.

Formato recomendado:

`CLASIFICACIÓN · 21 jugadores elegibles`

`Ranking semanal · Lun 31 ago — Dom 06 sep`

Usar formato corto y deportivo:

- día: `Lun`, `Mar`, `Mié`, etc.
- día del mes: dos dígitos cuando corresponda
- mes: tres letras

No usar `Actualizado hoy`.

La idea es que el usuario entienda inmediatamente que está viendo una **edición semanal cerrada**.

---

## 4. Movimiento semanal — flechas

La flecha expresa **puestos en el Ranking**, nunca puntos.

Reglas:

- `↑ 4` = subió 4 puestos respecto de la edición semanal anterior.
- `↓ 2` = bajó 2 puestos.
- `—` = mantuvo el mismo puesto.
- `Nuevo` = no existe comparación válida anterior.

Cuando haya espacio, preferir:

`↑ 4 puestos vs. semana anterior`

En superficies compactas puede mantenerse `↑ 4`, siempre que la ayuda explique que son posiciones.

No usar lenguaje de “puntos” porque Ranking BRAMU V1 no tiene puntos propios.

---

## 5. Nivel mostrado dentro de Ranking

Dentro de Ranking debe mostrarse el **Nivel del corte semanal**, no necesariamente el Nivel actual.

Esto aplica a:

- tarjeta `TU POSICIÓN`;
- fila propia;
- filas del resto de jugadores;
- filtros/bandas si dependen del snapshot.

La clasificación y el Nivel que muestra deben contar la misma historia.

Evitar inconsistencias como mostrar un Nivel actual que ya no corresponde al orden congelado de esa edición.

---

## 6. Ayuda “Cómo funciona el Ranking”

Actualizar el contenido del `?` para explicar de forma simple:

### 6.1 Cadencia

> **¿Cuándo se actualiza el Ranking?**  
> Cada lunes se publica una nueva edición con los Niveles consolidados al cierre del domingo.

### 6.2 Diferencia entre Nivel y Ranking

> **¿Por qué mi Nivel actual puede ser distinto?**  
> Tu Nivel BRAMU puede cambiar durante la semana. El Ranking conserva el Nivel que tenías al último cierre semanal hasta la próxima publicación.

### 6.3 Flechas

> **¿Qué significa ↑ 4?**  
> Que subiste 4 puestos respecto de la edición semanal anterior.

### 6.4 Carga de partidos

> **Cargá el partido cuando termina.**  
> Así el resultado puede validarse a tiempo, actualizar tu Nivel y entrar en el próximo Ranking semanal.

La explicación debe ser breve, clara y sin tono punitivo.

---

## 7. Microajuste — lupa activa

En V03.5.1 el buscador funciona correctamente.

Ajuste visual:

- cuando la búsqueda está activa/abierta, el icono de lupa debe mostrarse en **verde lima**;
- al cerrar/desactivar la búsqueda, debe volver al estado neutro.

No modificar la lógica actual de búsqueda salvo lo necesario para reflejar correctamente el estado activo.

---

## 8. Microajuste — bottom sheets / selectores

Problema detectado:

- selectores simples como género pueden verse demasiado pequeños o “petisos”;
- `Registrar partido` funciona bien en iPhone, pero en desktop puede sentirse flotando con demasiado aire y una composición poco natural.

No imponer una altura fija universal.

### 8.1 Objetivo

Definir un comportamiento responsive coherente para bottom sheets/selectores:

- en mobile: anclados abajo y cómodos para interacción táctil;
- en pantallas grandes: evitar que parezcan una bandeja demasiado pequeña perdida en el medio;
- mantener un mínimo visual de padding/aire suficiente;
- no agregar altura vacía artificial cuando hay pocas opciones.

### 8.2 Alcance

Revisar al menos:

- selector de género del Ranking;
- selector de Nivel del Ranking;
- patrón usado por `Registrar partido`.

Aplicar el ajuste mínimo coherente al componente/patrón compartido si existe.

No rediseñar todos los modales de la app.

---

## 9. Microajuste — copy Mis grupos

Actualmente:

`Actual | Anterior | Race anual`

Cambiar a:

`Semana actual | Semana pasada | Race anual`

Motivo: `Actual` y `Anterior` son ambiguos sin contexto.

No modificar lógica de Mis grupos, solo copy.

---

## 10. Mantener intacto lo que ya funciona

No tocar salvo necesidad técnica directa:

- orden de ámbitos: Local / Provincial / País / Global / Mi red;
- Local como default;
- Mi red 180 días;
- ocultar/restaurar;
- filtro de género;
- filtro de Nivel;
- tarjeta Tu posición;
- salto a fila propia;
- clasificación desde #1;
- paginación de 50;
- botón `↑ Ir al inicio`;
- back Ranking → Mi Perfil → Ranking;
- contraste de tabs;
- modal de nueva versión;
- búsqueda por lupa;
- ayuda por `?`.

---

## 11. Estados a preservar

Deben seguir funcionando:

- Sin Nivel;
- Calibrando;
- Calibrado;
- Recalibrando;
- Inactivo;
- Nuevo/reingreso;
- sin ubicación;
- opt-out/perfil privado;
- densidad 0–4;
- densidad 5–14;
- densidad 15+;
- Global bloqueado;
- bandas sin resultados;
- Mi red con jugadores calibrando/inactivos;
- empates exactos.

---

## 12. Simulación / prototipo

Todavía no hay backend real.

Por lo tanto, implementar el concepto de Ranking semanal de forma consistente dentro del prototipo actual.

Objetivo del prototipo:

- simular una edición semanal estable;
- mostrar Nivel del corte;
- mostrar período semanal;
- mostrar movimiento contra edición anterior;
- evitar que un nuevo partido de prueba cambie inmediatamente la clasificación vigente si conceptualmente ya pertenece a la siguiente edición.

No inventar una arquitectura compleja.

Aislar cualquier mock/snapshot simulado de forma clara para que pueda reemplazarse en backend real.

---

## 13. Tests

Agregar tests solo donde haya lógica real nueva.

Prioridad:

- cálculo de período semanal;
- snapshot/corte de Ranking;
- Nivel del corte vs. Nivel actual;
- movimiento entre ediciones;
- partido computable después del cierre → siguiente edición;
- preservación de estados existentes.

No agregar tests artificiales de CSS/markup.

Correr:

1. tests focales durante implementación;
2. suite completa una sola vez al final.

---

## 14. QA

Prioridad:

### Mobile 320–375
- período semanal visible;
- Nivel del corte;
- movimiento;
- lupa activa en lima;
- selectores;
- bottom sheets;
- ayuda;
- Mi red;
- Tu posición;
- Ir al inicio.

### Tablet
- layout;
- selectores;
- bottom sheets;
- línea de período.

### Desktop
- revisar especialmente comportamiento de bottom sheets;
- evitar sensación de “flotando perdido”;
- verificar que `Registrar partido` y selectores simples conserven jerarquía.

### Regresión rápida
- Home;
- Historial;
- Mis grupos;
- Perfil;
- Perfil público;
- marcador;
- Resumen;
- bottom nav.

---

## 15. Qué NO hacer

No implementar:

- backend real;
- cron/worker real;
- timezone internacional;
- puntos de Ranking;
- Race BRAMU;
- torneos;
- matchmaking;
- BRAMU Intelligence;
- Nivel BRAMU real V04;
- WhatsApp;
- rediseño de Home;
- rediseño de Perfil;
- refactor grande sin necesidad.

---

## 16. Documentación

Al terminar:

1. actualizar este documento con cualquier adaptación real de implementación;
2. no modificar `Ranking_BRAMU.md` salvo que aparezca una contradicción técnica real;
3. no tocar documentos de BRAMU Intelligence;
4. no consolidar todavía toda V03.

---

## 17. REPORTE PARA CHATGPT — OBLIGATORIO

A partir de esta ronda, cada implementación debe cerrar con un reporte puente para ChatGPT.

Crear:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.5.2_Reporte_ChatGPT.md`

Debe incluir:

- qué se implementó realmente;
- adaptaciones respecto del documento;
- bugs encontrados/corregidos;
- decisiones UX materializadas;
- tests agregados;
- resultado final de tests;
- QA realizado;
- commit;
- tag;
- push/deploy;
- URL publicada;
- limitaciones conocidas;
- deuda/puntos para prueba visual;
- confirmación de si Ranking queda cerrado o todavía requiere revisión.

Este reporte es obligatorio aunque el resumen también se entregue en el chat.

---

## 18. Cierre esperado

Si QA y tests quedan verdes:

- bump a `BRAMUlab V03.5.2`;
- commit;
- tag `BRAMUlab_V03.5.2`;
- push;
- deploy en GitHub Pages;
- verificar producción;
- crear el reporte para ChatGPT.

La publicación NO implica automáticamente el cierre definitivo de Ranking.

Sebastián hará una última prueba visual/real.

No avanzar a Nivel BRAMU ni a otra versión sin instrucción explícita.

---

## 19. Cierre de V03.5.2

**Tag:** `BRAMUlab_V03.5.2`. **Base:** BRAMUlab_V03.5.1. **Tests finales:** 936/936 (933 previos + 3 nuevos del bug real de identidad, ver §19.3).

### 19.1 Qué quedó implementado

Los dos bloques completos, sin recortes de alcance:

- **Ranking semanal simulado**: `RK.computeRankingWeekPeriod`/`computePreviousRankingWeekPeriod` (lunes 00:00:00 a domingo 23:59:59.999, `America/Argentina/Buenos_Aires`, offset fijo -03:00) + `RK.historySnapshotAsOf` (recorta el historial por `createdAt`, nunca `playedAt` — ver §19.2). Tu posición, fila propia, el resto de filas y los filtros/bandas usan el Nivel de ese corte, nunca el actual. Identificación de edición visible junto a CLASIFICACIÓN (`Ranking semanal · Lun 07 sep — Dom 13 sep`). Movimiento semanal recalculado comparando dos ediciones reales (ya no un jitter simulado) — flechas "↑ N"/"↓ N puestos" (con espacio) y "Nuevo" cuando no hay comparación anterior válida.
- **Ayuda actualizada** con cadencia semanal, diferencia Nivel/Ranking, significado de las flechas y la recomendación de cargar el partido al terminar.
- **Lupa activa**: lima mientras la búsqueda está abierta, neutra al cerrarla.
- **Bottom sheets responsive**: en desktop (≥720px), el patrón compartido `.sheet-scrim`/`.bottom-sheet` centra el panel (en vez de anclarlo abajo) con bordes redondeados en las 4 esquinas, y `.bottom-sheet--compact` deja de forzar una altura mínima pensada en mobile — alcanza a los ~11 sheets de la app sin rediseñar ninguno. El selector de género/nivel del Ranking (`#profile-picker-sheet`) además usa un ancho propio más angosto en desktop, evitando la sensación de "petiso" en una lista de 2-3 opciones.
- **Copy de Mis grupos**: `Actual`/`Anterior` → `Semana actual`/`Semana pasada` (Race anual sin cambios), sin tocar lógica.

### 19.2 Adaptaciones reales respecto del documento

- **"Quedó computable" se mide por `createdAt`, no por `playedAt`.** El documento (§4.3/Caso 2) pide que un partido jugado antes del cierre pero cargado después no afecte la edición ya publicada. El prototipo ya tenía exactamente ese dato desde V03.0 (`createdAt` = momento en que el registro se guarda, distinto de `playedAt` = fecha efectiva elegida por el usuario) — se reutilizó tal cual, sin inventar un campo nuevo.
- **Sin snapshot persistido.** Se descartó guardar un objeto "snapshot" en `Store` porque no hace falta: `historySnapshotAsOf(history, period.start)` recalculado en cada render da SIEMPRE el mismo resultado mientras `history` no cambie con `createdAt` anterior al corte — que es exactamente la garantía de estabilidad semanal que pide el documento, sin agregar una clave nueva de almacenamiento ni lógica de invalidación. Queda aislado en dos funciones puras (`computeRankingWeekPeriod`/`historySnapshotAsOf`) listas para reemplazarse por un snapshot real de backend.
- **La elegibilidad propia (Sin Nivel/Calibrando/Inactivo/etc.) sigue evaluándose en vivo**, con el historial completo y "ahora" real — el documento pide congelar el NÚMERO y el PUESTO de quien ya es elegible, no el gatillo de elegibilidad en sí. Congelar también la elegibilidad habría exigido reconstruir el estado de calibración "tal como era hace una semana" para cada jugador, una complejidad no pedida explícitamente y fuera de lo que un prototipo simulado necesita.
- **Mi red de la edición anterior** se recalcula con `computeNetworkNames`/`computeParticipantStatus` pasando el historial y el reloj parados en el corte previo — así "Nuevo"/"↑/↓" comparan contra una red que realmente existía en ese momento (y no la red de hoy con Niveles viejos).

### 19.3 Bug real encontrado y corregido durante esta ronda

Al verificar rigurosamente que el Nivel del corte coincidiera con la evolución real de self (necesario para poder testear el snapshot con confianza), apareció un bug real y **preexistente** de V03.5/V03.5.1: `computeRankingView` pasaba el nombre plano de self (`currentPlayerName`, string) a `RK.buildRankingEntries`, nunca `currentIdentity()` (`{name, userId}`). Por la regla de integridad de `userId` ya vigente desde V03.0 (`PH.findPlayerRow`), una fila de partido con `userId` estampado **solo** es hallable pasando ese mismo `userId` — nunca por nombre, aunque coincida exacto. Como resultado, en cuanto self jugaba su primer partido (que estampa `userId` automáticamente), Ranking dejaba de encontrarle NINGÚN partido real y le mostraba el mismo Nivel simulado por hash que un jugador mock territorial, en vez de su evolución real — un número plausible (rango 3,0–7,5, igual que cualquier otro) que nunca se notó a simple vista en las rondas anteriores porque nada lo cruzaba contra el Nivel real de Home/Perfil.

Corregido agregando un parámetro opcional `selfUserId` a `RK.buildRankingEntries` (arma `{name, userId}` solo para las líneas que calculan el Nivel de self; `Store.normalizePlayerName` sigue recibiendo siempre el string) y pasándolo desde los 4 call sites de Ranking más `rankingSelfBand`. Compatibilidad hacia atrás intacta: sin el parámetro (código/tests viejos), el comportamiento es idéntico al de antes. 3 tests nuevos (`V0352-IDENTIDAD`) cubren el caso.

### 19.4 QA realizado

Mobile (375px), tablet (768px) y desktop, con una cuenta y partidos sembrados a propósito (algunos antes del corte vigente, uno cargado después para probar el Caso 2, y una edición anterior real para el movimiento): período semanal visible y correcto, Nivel del corte distinto del Nivel actual cuando corresponde, movimiento real entre ediciones (incluida una fila mock bajando un puesto sin haber jugado — Caso 4 del documento, se dio espontáneamente con los datos de prueba), lupa activa/inactiva, selector de género/nivel y Registrar partido en desktop (ya no "flotando"), ayuda actualizada, Mi Perfil con back a Ranking (heredado de V03.5.1, sin regresión), Mis grupos con el copy nuevo. Sin errores de consola nuevos.

### 19.5 Limitaciones conocidas

- Igual que en V03.5.1: género y Nivel de jugadores mock territoriales siguen siendo simulaciones determinísticas por nombre, no datos reales.
- El snapshot semanal es una función pura recalculada en cada render (nunca un valor persistido) — funcionalmente equivalente a un snapshot real mientras `history` no cambie retroactivamente, pero no hay auditoría histórica de ediciones pasadas más allá de la semana actual y la anterior (el documento reserva esa auditabilidad completa para el contrato de backend real, §17.4, explícitamente fuera de alcance de este prototipo).
- Esta publicación **no cierra Ranking dentro de V03** — sigue sujeta a la prueba real de Sebastián, ver §18.
