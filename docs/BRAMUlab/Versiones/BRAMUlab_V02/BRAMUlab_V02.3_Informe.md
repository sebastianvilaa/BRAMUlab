# BRAMUlab V02.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 04/09/2026.
**Base:** BRAMUlab V02.2 (commit `ab98131`, tag `BRAMUlab_V02.2`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.3_Consolidado.md` — ajuste ACOTADO sobre V02.2: color contextual del selector de rivales (Bloque A), pausa del último set + recomposición de Confirmar partido + sheet Fecha/hora/lugar (Bloque B), tarjeta permanente de notas en el Resumen (Bloque C), y lectura visual de Actividad + blindaje de Efectividad (Bloque D). Por instrucción explícita del consolidado, no se releyó documentación histórica ni se auditó de nuevo toda la aplicación — se usó V02.2 como base y el Informe V02.2 solo para ubicar archivos/funciones.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

| # | Requisito (bloque/§) | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Bloque A §3 — Compañero celeste, Rival 1/Rival 2 magenta en foco de búsqueda, avatar reciente, tinte de selección y alta sin cuenta | `#load-player-sheet` recibe la clase `.is-context-rival` según el slot; overrides de `--team-a`/`--team-b` (sin colores nuevos) | `app.js:openManualPlayerSheet`, `styles.css:.load-player-sheet.is-context-rival *` | Manual + captura (ELEGIR RIVAL 1 en magenta, ELEGIR COMPAÑERO en celeste) |
| 2 | Bloque B §4 — el set que define el partido ya NO abre Confirmar partido solo; pausa con "Resultado válido" + CONTINUAR único | Se quita el `setTimeout(() => finalizeManualContinue(), 320)`; el hint "Resultado válido" se reubica dentro de `#court-continue-wrap` y se muestra cuando `manualDecided` | `app.js:commitCurrentManualSetIfValid`, `updateManualContinueState`; `index.html` (hint reubicado) | Manual + captura: tras 6-4 el partido queda en pausa; CONFIRMAR PARTIDO solo abre al tocar CONTINUAR |
| 3 | Bloque B §5 — Confirmar partido reutiliza la tarjeta deportiva del Resumen (GANADORES + fila por equipo), sin marcador suelto ni Sets/Games ganados | `openConfirmMatchScreen` arma `buildScoreCardHTML(snapshot, {winnersHTML: buildWinnersBannerHTML(snapshot)})` (sin `statsHTML`) dentro de `#match-saved-result-card`; números de set agrandados vía `.court-saved-result-card` | `app.js:openConfirmMatchScreen`; `index.html`/`styles.css:.court-saved-result-card` | Manual + captura |
| 4 | Bloque B §6 — Fecha y Hora con el mismo cuerpo visual, 24 horas siempre, íconos parejos, "Borrar hora" discreto sin romper la fila, "Usar mi ubicación" secundaria | Hora pasa de `<input type="time">` nativo a texto enmascarado 24h (`maskManualTimeInput`/`normalizeManualTimeOnBlur`); labels con ícono calendario/reloj; "Borrar hora" como ícono `×` superpuesto al campo; `#manual-location-btn` con estilo secundario compacto + ícono; placeholder de Lugar actualizado | `app.js:initManualDateTimeFields` y funciones nuevas; `index.html`/`styles.css` (sheet Fecha/hora/lugar) | Manual + captura; masking verificado programáticamente (ver §5) |
| 5 | Bloque C §7 — tarjeta permanente "NOTAS DEL PARTIDO · SOLO VOS" en el Resumen, tocable completa, sin link aparte | `#analysis-note-card` deja de ocultarse según haya nota; nuevo `#analysis-note-display` (estado de lectura, con placeholder "Tocá para agregar una nota") tocable, revela `#analysis-note-textarea` para editar; mismo autoguardado en blur | `app.js:renderAnalysis`, `renderAnalysisNoteDisplay`, `initAnalysisScreen`; `index.html`/`styles.css:.court-note__display` | Manual + captura (vacía y con nota) |
| 6 | Bloque D §8 — Actividad representa volumen total (celeste), nunca codifica victorias/derrotas | `renderPlayerActivity` deja de dibujar `.activity-bar__win` (solo victorias); todo bloque con `count > 0` recibe `.is-active` (celeste sólido) | `app.js:renderPlayerActivity`; `styles.css:.activity-bar.is-active` | Test automático `V02.3-ACT` + manual/captura (derrota visible, 4 barras equivalentes) |
| 7 | Bloque D §9 — verificar cálculo temporal (2/10/18/26/31 días, playedAt, sin observados, sin futuros) | Sin cambios de lógica: `PH.computeActivity30d` ya era correcta (confirmado, no reescrita) | `player-home.js:computeActivity30d` (sin cambios) | Test automático `V02.3-ACT` (5 casos) |
| 8 | Bloque D §10 — verificar y blindar Efectividad (perspectiva Equipo B, observados, ventana de 30 días) | Sin cambios de lógica: `PH.computeEffectiveness30d` ya era correcta (confirmado, no reescrita) | `player-home.js:computeEffectiveness30d` (sin cambios) | Test automático `V02.3-EFE` (6 casos) |
| 9 | Versión/PWA | `Store.VERSION`/`version.json` → `"BRAMUlab V02.3"`; `sw.js` `CACHE_NAME` → `bramulab-v02-3` | `store.js`, `version.json`, `sw.js` | Verificado a nivel de archivo servido (ver §7) |

---

## 2. Hallazgos reales durante la implementación

### 2.1 Actividad: la derrota nunca tenía relleno propio (Bloque D, §8)

El consolidado describía el síntoma ("una derrota puede quedar representada solamente por una superficie oscura casi indistinguible del estado vacío") como algo a corregir, no solo a verificar. Al leer `renderPlayerActivity` se confirmó la causa exacta:

```js
const winPct = b.count ? Math.round((b.wins / b.count) * 100) : 0;
return `<div class="activity-bar" style="height:${heightPct}%"><span class="activity-bar__win" style="height:${winPct}%"></span></div>`;
```

La altura del bloque (`heightPct`, la barra exterior) sí era proporcional a la cantidad de partidos — pero el ÚNICO color visible (`--brand-lime`) vivía en `.activity-bar__win`, una capa interna cuya altura era `wins/count`. Con cero victorias, esa capa quedaba en 0%, y lo único pintado era el fondo casi transparente (`rgba(244,247,242,0.08)`) de `.activity-bar` — indistinguible en la práctica de un período realmente vacío (6% de alto con el mismo fondo).

**Fix:** se elimina por completo la capa `.activity-bar__win` (esa codificación de resultado ya es trabajo exclusivo de Efectividad); todo bloque con `count > 0` recibe la clase `.is-active`, que pinta el bloque ENTERO en celeste (`--team-a`) sin importar cuántas de esas victorias/derrotas haya. Verificado con un historial sintético de 2 victorias + 2 derrotas en 4 períodos distintos: las 4 barras quedan visualmente equivalentes (ver captura, §6).

### 2.2 Hora en 24h: el bug real era el `<input type="time">` nativo, no el dato (Bloque B, §6)

El valor interno de un `<input type="time">` siempre es 24h (`HH:MM`) — eso nunca estuvo mal. Lo que el consolidado describe ("2:50 p. m." en vez de "14:50") es el **renderizado nativo** del control, que en iOS/Safari sigue el idioma/región configurado en el dispositivo, no el `lang="es"` del documento ni nada controlable desde HTML/CSS. En un dispositivo con región en inglés, el mismo valor `"14:50"` se muestra "2:50 PM" sin que la app pueda evitarlo con el input nativo.

**Fix:** Hora deja de ser `<input type="time">` y pasa a ser un campo de texto enmascarado (`maskManualTimeInput` inserta el `:` mientras se tipea; `normalizeManualTimeOnBlur` recorta a rangos válidos 00-23/00-59 y rellena con ceros, o limpia si quedó incompleto). Esto además resolvió, como efecto colateral necesario, la diferencia de "tamaño, baseline y estilo" entre Fecha y Hora: al compartir literalmente la misma clase `.field__input` con el mismo cuerpo (antes Fecha era nativo y Hora también pero con chrome interno distinto), ambas quedan pixel-a-pixel equivalentes.

### 2.3 `computeActivity30d`/`computeEffectiveness30d` no filtran participación por sí mismas

Al escribir el test `V02.3-ACT` para "un observado no suma actividad propia" pasando un partido observado directo a `PH.computeActivity30d`, el test falló: el partido se contó igual (`total` pasó de 4 a 5). Investigado, esto no es un bug: **ninguna** función de `player-home.js` filtra participación por su cuenta — todas asumen que `matches` ya viene filtrado por `PH.filterMatchesForPlayer` (el único punto real de la app que decide "propio vs. observado", usado por `renderPlayerHome`). El test se corrigió para ejercitar el mismo camino real (`filterMatchesForPlayer` antes de `computeActivity30d`) en vez de saltearlo — el comportamiento de la app en producción siempre fue correcto, ver `app.js:renderPlayerHome`.

---

## 3. Decisiones tomadas

- **Título de la tarjeta de notas también actualizado en Confirmar partido:** el consolidado (Bloque C, §7) solo pide el nuevo título "NOTAS DEL PARTIDO · SOLO VOS" en el Resumen, pero la misma tarjeta `.court-note` se reutiliza visualmente en Confirmar partido (Bloque B, §5) con el título viejo "NOTAS · SOLO VOS". Se actualizó también ahí por consistencia visual directa entre dos pantallas que esta misma ronda está recomponiendo — no es una pantalla fuera de alcance, es la superficie de notas que el propio Bloque B ya toca.
- **Ícono de "Borrar hora" en vez de línea de texto:** el consolidado pide "sin romper la altura de la fila". El link de bloque anterior (`Borrar hora` debajo del campo) sí la rompía (la columna Hora quedaba más alta que Fecha). Se convirtió en un ícono `×` superpuesto DENTRO del campo, visible solo cuando hay una hora cargada — layout invariante entre ambas columnas.
- **No se tocó `type="date"`:** el consolidado no describe ningún síntoma sobre el formato de fecha (solo de hora), y convertir también Fecha a un selector propio es una superficie mucho mayor (calendario custom) fuera de una ronda acotada. Se igualó su cuerpo visual (altura explícita, mismo label con ícono) sin tocar el mecanismo nativo.

---

## 4. Tests automáticos (§12)

**548/548 tests OK — todo verde** (`tests.html`), 535 preexistentes + 13 nuevos en tres bloques:

- **V02.3-ACT** (7 casos) — cálculo temporal de Actividad: partidos a 2/10/18/26 días caen en 4 períodos distintos (uno cada uno) y el de 31 días queda excluido; no depende del orden de carga; usa `playedAt` y nunca `createdAt`; un `playedAt` futuro no se cuenta; un observado (filtrado vía `PH.filterMatchesForPlayer`, el camino real) no suma actividad propia; un período con una sola derrota sigue teniendo `count > 0` (relleno visible) sin sumar victorias.
- **V02.3-EFE** (6 casos) — Efectividad: 2 victorias + 1 derrota → 67% y 2 de 3; 1 victoria + 3 derrotas → 25% y 1 de 4; jugador en Equipo B calculado con la perspectiva correcta (no invertida); un observado no modifica el porcentaje; un partido de 31 días no modifica el porcentaje.

**Nota sobre alcance — Bloque B §4 (detención hasta CONTINUAR):** mismo criterio ya documentado en el Informe V02.2 (§4 de esa matriz): `tests.html` carga únicamente `engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`, nunca `app.js`. El cambio de este requisito es la AUSENCIA de un efecto de UI (se quita un `setTimeout` en `app.js`) y no introduce ninguna función pura nueva en `match-load.js` — no hay nada unit-testeable en este arnés sin DOM. Se verificó en vivo contra el dev server (ver §5): documentado ahí paso a paso, con el estado exacto del DOM en cada punto.

---

## 5. Recorrido manual (§13)

Ejecutado en vivo contra `.claude/dev-server.py` (`http://localhost:4173`), viewport emulado **402×874** (iPhone 16 Pro). El panel del navegador quedó oculto del lado del cliente durante buena parte de la sesión (misma limitación ya documentada en el Informe V02.2) — la interacción se hizo disparando los mismos eventos DOM que un toque real (`element.click()`, eventos `input`/`blur` reales), verificando el estado resultante por lectura de DOM; en los tramos donde el panel SÍ estuvo visible se tomaron capturas reales (ver §6).

1. **Selector ELEGIR RIVAL 1** — sheet con foco de búsqueda en magenta y botón "Agregar 'Gastón' como jugador sin cuenta" en magenta; texto principal blanco, ningún nombre pintado de magenta. Confirmado por captura.
2. **Selector ELEGIR COMPAÑERO** (mismo flujo, slot `a2`) — mismo sheet, ahora en celeste (foco de búsqueda y botón de alta). Confirmado por captura — contraste directo con el punto 1.
3. **Carga de `6-3 · 4-6 · 6-2`** — al cerrar el Set 3 (6-2, partido decidido): teclado cerrado, Set 3 visible en el marcador acumulado, header "PARTIDO COMPLETO", texto lima "Resultado válido" y un único botón CONTINUAR habilitado — la pantalla NO navegó sola (confirmado esperando 1.2s adicionales sin cambio de vista). Confirmado por captura.
4. **CONTINUAR → Confirmar partido** — solo navega al tocar el botón. Header "CONFIRMAR PARTIDO", badge VICTORIA, tarjeta única con GANADORES ("Sebastián / Matías" en celeste), fila Equipo A (celeste) y fila Equipo B (magenta) con los 3 sets, sin marcador grande suelto y sin Sets/Games ganados. Confirmado por captura.
5. **Sheet Fecha, hora y lugar** — FECHA y HORA con el mismo label (ícono + texto, mismo tamaño), HORA en 24h ("15:32") con ícono `×` de borrado superpuesto al campo (nunca una línea aparte), LUGAR a ancho completo con el placeholder nuevo, "Usar mi ubicación" como píldora secundaria compacta con ícono, LISTO como única acción lima, título centrado. Confirmado por captura.
6. **Masking de Hora (programático, sin DOM visible)** — `"9"`→`"9"`, `"93"`→`"93"`, `"930"`→`"93:0"` mientras se tipea; en blur: `"1450"`→`"14:50"`, `"2575"`→`"23:59"` (clamp), `"1"`→`""` (incompleto se limpia). El ícono "Borrar hora" aparece solo con valor cargado y lo vacía al tocarlo.
7. **GUARDAR PARTIDO → Resumen** — tarjeta "NOTAS DEL PARTIDO · SOLO VOS" siempre visible con "Tocá para agregar una nota"; al tocarla se revela el textarea enfocado; se escribió una nota, blur guardó (`Store.patchHistoryEntry` verificado contra `localStorage` directamente) y volvió al estado de lectura mostrando el texto guardado. EDITAR PARTIDO, VOLVER AL INICIO, BRAMU Intelligence y barra inferior, intactos. Confirmado por captura.
8. **Home con Actividad de prueba** — historial sintético con partidos propios a 2 (victoria), 10 (**derrota**), 18 (victoria) y 26 (**derrota**) días; el de 31 días (victoria) sembrado a propósito para confirmar exclusión. Resultado: 4 barras celestes equivalentes (100% de alto cada una, incluidas las dos derrotas — visibles igual que las victorias), "4 partidos en los últimos 30 días" (el de 31 días correctamente excluido), Efectividad "50% · 2 de 4". Confirmado por captura y por `getComputedStyle` (`rgb(45, 156, 255)` = `--team-a` en las 4 barras).
9. **Historial / Último partido** (fuera de alcance) — revisados sin cambios: marcador canónico, badges VIC/DER, colores de equipo. Confirmado por captura, sin regresión.
10. **Consola del navegador** — sin errores de aplicación en ningún punto del recorrido (los dos `[error] An unknown error occurred when fetching the script` observados corresponden al intento de registrar el Service Worker en este entorno de sesión, ver §7 — no a `app.js`/`styles.css`/`index.html`).

---

## 6. Capturas (§13)

Se guardaron 6 capturas reales durante los tramos en que el panel del navegador estuvo visible del lado del cliente:

1. Selector ELEGIR RIVAL 1 — foco/alta en magenta.
2. Selector ELEGIR COMPAÑERO — foco/alta en celeste (contraste directo con la 1).
3. Pausa "Resultado válido" tras el set decisivo (Set 3 visible, CONTINUAR único).
4. Confirmar partido + sheet Fecha, hora y lugar (misma captura, sheet abierto sobre la pantalla).
5. Resumen con la tarjeta de Notas vacía ("Tocá para agregar una nota").
6. Home con las 4 barras de Actividad (incluidas 2 derrotas, visibles en celeste) y Efectividad 50%.

**Limitación honesta:** al igual que en V02.2, el panel quedó oculto del lado del cliente en algunos tramos de la sesión — durante esos tramos `computer{screenshot}` y `getComputedStyle` devolvían valores congelados (la página no compone frames mientras el panel está oculto). Se usó lectura de DOM (`classList`, `textContent`, `.matches()`) como evidencia sustituta en esos tramos, y capturas reales en los tramos donde el panel sí estuvo visible (listadas arriba) — nunca se afirmó una verificación visual que no se haya podido producir realmente.

---

## 7. PWA, versión y publicación (§14)

- `Store.VERSION`: `"BRAMUlab V02.2"` → **`"BRAMUlab V02.3"`**.
- `version.json`: actualizado en paralelo (mismo valor) — verificado servido (`curl http://localhost:4173/version.json`).
- `sw.js`: `CACHE_NAME` `bramulab-v02-2` → **`bramulab-v02-3`** — mismo bump técnico de siempre; verificado a nivel de archivo servido (`curl http://localhost:4173/sw.js | grep CACHE_NAME`).
- **Desvío declarado:** el registro EN VIVO del Service Worker (`navigator.serviceWorker.register`) falló en esta sesión del entorno de verificación con `"An unknown error occurred when fetching the script"`, independientemente del código (el archivo `sw.js` en sí no cambió de mecanismo, solo el string `CACHE_NAME` — mismo patrón ya validado en V02.2, donde sí registró con éxito). No se pudo reproducir el registro exitoso en esta sesión puntual; se documenta como limitación de este entorno de verificación, no como un defecto de la app.

---

## 8. Publicación

- **Commit de implementación (código):** `28e994454aded5278976c5cc6dcc02240bcb9321` — mensaje `"BRAMUlab V02.3 · color contextual, pausa de carga manual y Actividad/Efectividad sobre V02.2"`.
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 9. Hash exacto y tag (registro final)

- Commit de implementación (código): `28e994454aded5278976c5cc6dcc02240bcb9321`.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: ver el commit inmediatamente posterior a este archivo en el historial de `main`.
- Tag `BRAMUlab_V02.3` apunta al commit que deja registrados ambos hashes de arriba (un commit no puede citar su propio hash) — el código funcional completo de V02.3 es íntegramente el de `28e9944`; el commit que sostiene el tag no modifica ningún archivo de `bramulab/`.

---

## 10. Desvíos justificados

1. **Service Worker no verificado en vivo en esta sesión** — ver §7; el archivo servido confirma el `CACHE_NAME` correcto, pero el registro real del navegador falló por una limitación puntual de este entorno de sesión, no reproducible al mecanismo en sí (sin cambios respecto de V02.2, ya validado ahí).
2. **Bloque B §4 sin test automático dedicado** — ver §4; es un cambio de orquestación de UI (ausencia de un `setTimeout`) sin lógica pura nueva que testear en el arnés actual (`tests.html` nunca carga `app.js`, mismo criterio documentado en el Informe V02.2). Verificado en vivo con evidencia de DOM paso a paso (§5, punto 3).
3. **Capturas parciales, no de todo el recorrido** — ver §6; el panel quedó oculto del lado del cliente en varios tramos de la sesión. Se documentó cada tramo sin panel visible con el detalle exacto verificado por DOM, igual criterio que V02.2.

---

## 11. Qué no se tocó (confirmado)

Historial y sus pestañas, tarjeta Último partido, botones EDITAR PARTIDO/VOLVER AL INICIO del Resumen, BRAMU Intelligence, Ranking, Perfil y navegación general, registro por games y punto a punto, reglas deportivas (`engine.js`, sin cambios), estadísticas (`stats.js`, sin cambios), lógica pura de carga manual (`match-load.js`, sin cambios), lógica pura de Actividad/Efectividad (`player-home.js`, sin cambios — verificada, no reescrita), esquema de `localStorage` (sin migración, sin `localStorage.clear()`). No se creó una carpeta `V02.3` — este informe vive en `Versiones/BRAMUlab_V02/`, junto al resto de la subversión.
