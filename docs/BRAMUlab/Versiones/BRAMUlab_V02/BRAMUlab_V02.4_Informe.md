# BRAMUlab V02.4
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 04/09/2026.
**Base:** BRAMUlab V02.3 (commit `28e9944`, tag `BRAMUlab_V02.3`).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.4_Consolidado.md` — ajuste visual corto y acotado sobre V02.3: lectura correcta de Actividad y Nivel BRAMU (Bloque A), jerarquía de la tarjeta Último partido (Bloque B), altura compacta compartida del sheet Registrar partido (Bloque C) y pastillas de sets de Partido completo (Bloque D). Por instrucción explícita del consolidado, se trabajó sobre el estado actual de V02.3 sin reabrir decisiones cerradas ni releer documentación histórica — solo se consultó `BRAMUlab_V02.3_Informe.md` para ubicar archivos/funciones.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

| # | Requisito (bloque/§) | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Bloque A §2 — Actividad vuelve a ser barra APILADA (lima=victorias, oscuro/neutro=derrotas), sin celeste, con leyenda | `renderPlayerActivity` deja de pintar todo el volumen en celeste (`.is-active`/`--team-a`, retirado); cada barra apila dos `<span>` (`.activity-bar__win` lima, `.activity-bar__loss` `--line-strong`) vía la nueva función pura `PH.computeActivityBarSegments`; leyenda "Ganados"/"Derrotas" agregada entre el gráfico y el total | `app.js:renderPlayerActivity`; `player-home.js:computeActivityBarSegments`; `index.html`/`styles.css:.activity-bar__win/__loss/.activity-legend*` | Test automático `V02.4-ACT-SEG` (4 casos) + manual/captura |
| 2 | Bloque A §3 — la barra de Nivel BRAMU representa el progreso decimal DENTRO del nivel entero actual (6.2→20%, no >50%) | Nueva función pura `PH.levelProgressPct` (aritmética entera vía módulo 10, sin resta de floats) reemplaza el cálculo anterior en `app.js` (posición global en `[LEVEL_MIN, LEVEL_MAX]` — el bug real); la pastilla ↑/↓ pasa a ser hermana del relleno, con `left` propio recortado 6-94% | `player-home.js:levelProgressPct`; `app.js:renderPlayerCard`; `index.html`/`styles.css:.player-card__level-delta` | Test automático `V02.4-NIVEL` (6 casos: 6.0/6.2/6.3/6.9/7.0 + rango 0-100) + manual/captura |
| 3 | Bloque B §4 — Último partido: Surface 3, borde completo 1px lima, sin línea de acento izquierda | Se retiran `::before` y las clases `--win`/`--loss` del card (el badge VIC/DER ya comunica el resultado); `background: var(--surface-3)`, `border-color: var(--brand-lime)` fijo, padding simétrico | `app.js:renderPlayerLastMatchCard` (ya no aplica clases de resultado al card); `styles.css:.player-home-lastmatch` | Manual + captura |
| 4 | Bloque B §5 — marcador a 44px (clamp 390-402px), punto separador blanco/900, guion interior liviano (span propio, nunca peso 900) | Nueva función `buildLastMatchScoreHTML`, EXCLUSIVA de esta tarjeta (nunca toca `buildCanonicalScoreLineHTML`/`formatSetSegmentLabel`, compartidas con Historial/Confirmar partido — fuera de alcance); token `.lastmatch-score` | `app.js:buildLastMatchScoreHTML`; `styles.css:.lastmatch-score*` | Manual + captura + estilos computados (360px y 402px) |
| 5 | Bloque B §6 — equipos en dos líneas (propio, luego "vs" + rival) | `renderPlayerLastMatchCard` arma dos `<div class="player-home-lastmatch__teams-line">` en vez de una línea comprimida | `app.js:renderPlayerLastMatchCard`; `styles.css:.player-home-lastmatch__teams-line` | Manual + captura |
| 6 | Bloque C §7 — Registrar partido ocupa ~35% de la altura útil, categoría reutilizable | Nueva clase `.bottom-sheet--compact` (`min-height: clamp(280px, 35dvh, 340px)`), aplicada a `#register-sheet`; el nivel visible se estira y centra su contenido (aire repartido, no todo contra el borde) | `index.html` (`#register-sheet`); `styles.css:.bottom-sheet--compact` | Manual + captura + medición en vivo (`getBoundingClientRect`) |
| 7 | Bloque D §8 — pastillas SET 1/2/3 de Partido completo ~15-20% más grandes, prioridad al resultado numérico | `.court-accumulated__set-score` 18px→22px (+22%), `.court-accumulated__set-label` 9px→10px (+11%), `min-width`/`min-height` explícitos | `styles.css:.court-accumulated__set*` | Manual + captura + medición en vivo |
| 8 | Versión/PWA | `Store.VERSION`/`version.json` → `"BRAMUlab V02.4"`; `sw.js` `CACHE_NAME` → `bramulab-v02-4` | `store.js`, `version.json`, `sw.js` | Verificado en vivo (footer del Home) y a nivel de archivo servido |

---

## 2. Decisiones y desvíos justificados

- **Nueva función `buildLastMatchScoreHTML`, no una modificación de `buildCanonicalScoreLineHTML`:** el consolidado (§5.3) pide que el guion interior de CADA set en Último partido sea un `<span>` propio con peso/tamaño distintos de los números — algo que el componente canónico compartido (usado también por Historial y Confirmar partido, ambos EXPLÍCITAMENTE fuera de alcance en esta ronda, §9) nunca soportó ni debía empezar a soportar ahora. Reescribir el compartido habría arrastrado el cambio a esas dos pantallas sin que el consolidado lo pidiera. Se creó un segundo builder, exclusivo de esta tarjeta, documentado en ambos lugares del código para que una futura ronda no confunda cuál usar dónde.
- **Pastillas de Partido completo: se ajustó el padding a último momento.** Con el padding aumentado en un primer intento (`9px 16px`) las pastillas midieron 73×62px en vivo — más de 20% por encima del tamaño de referencia (58-62×46-50px). Se volvió el padding al valor de V02.3 (`7px 14px`) y se dejó que el crecimiento salga SOLO de la tipografía (como pide §8.1: "dar prioridad al crecimiento del resultado numérico"); el resultado en vivo quedó en 69×57px — más cerca de la referencia, con el resultado numérico (22px, +22%) creciendo más que el label (10px, +11%), tal como se pidió.
- **`levelProgressPct` se movió de `app.js` a `player-home.js`:** el consolidado (§10.1.3) pide tests específicos para esta función con los 5 casos exactos, pero `tests.html` nunca carga `app.js` (no expone funciones al `window`, mismo criterio de siempre). Se relocalizó como función PURA en `player-home.js` (mismo patrón que `computeActivity30d`/`computeEffectiveness30d`), exportada vía `PLPlayerHome`, para que quedara testeable sin DOM.
- **Precisión flotante evitada con aritmética entera:** en vez de `nivel - Math.floor(nivel)` (que en JS puede dar `0.29999999999999982` para `6.3 - 6`), `levelProgressPct` redondea el nivel a DÉCIMOS como entero (`Math.round(level * 10)`) y toma el resto módulo 10 — nunca resta decimales entre sí.

---

## 3. Tests automáticos (§10.1)

**558/558 tests OK — todo verde** (`tests.html`), 548 preexistentes (535 de V02.2 + 13 de V02.3) + 10 nuevos:

- **V02.4-NIVEL** (6 casos) — `PH.levelProgressPct`: 6.0→0%, 6.2→20%, 6.3→30%, 6.9→90%, 7.0→0% (arranca un nivel nuevo), y el resultado siempre queda entre 0 y 100 para un conjunto de niveles arbitrarios (incluye casos con más de un decimal de posible error de precisión flotante).
- **V02.4-ACT-SEG** (4 casos) — `PH.computeActivityBarSegments`, los 4 casos exactos pedidos por el consolidado: 4 partidos/3V/1D → 75%/25%; 2 partidos/1V/1D → 50%/50%; 1 partido/0V/1D → 0%/100% (el caso clave: la derrota nunca queda en 0% de alto); 0 partidos → ambos segmentos en 0.

Los tests temporales de Actividad de V02.3 (`V02.3-ACT`, cálculo de los 4 períodos de 30 días) se mantuvieron sin tocar, tal como pide §10.1.4 — la lógica de `computeActivity30d` no cambió en esta ronda.

---

## 4. Verificación visual acotada (§10.2)

Ejecutada en vivo contra `.claude/dev-server.py` (`http://localhost:4173`), viewport emulado móvil. Historial sintético sembrado con 7 partidos propios repartidos en 4 períodos con volúmenes y mezclas de resultado distintas (incluido un período con UNA SOLA derrota, el caso crítico de esta ronda).

1. **Home — Actividad con 4 períodos de volumen y mezcla distintos** (402×874): las 4 barras muestran alturas distintas (33%/100%/33%/67%) y cada una compone lima (victorias) + gris-azulado `--line-strong` (derrotas) según su propia proporción; el período con 1 derrota y 0 victorias se ve como una barra oscura CLARAMENTE visible (33% de alto), nunca confundida con un período vacío. Leyenda "● Ganados · ● Derrotas" visible bajo el gráfico, sin competir con el texto "7 partidos en los últimos 30 días". Ninguna barra celeste. Confirmado por captura.
2. **Barra de Nivel BRAMU en 6.0/6.3/6.9/7.0**: en 5.0 (nivel real del historial sembrado) la barra queda prácticamente en 0% con la pastilla "↑0.1" contenida dentro del track (sin chocar el borde izquierdo) — confirmado por captura. Forzado a 6.9 (90%) vía DOM: el relleno llega al 90% y la pastilla queda pegada a ese punto sin desbordar el borde derecho — confirmado por captura. Los 5 valores exactos (6.0/6.2/6.3/6.9/7.0) están además blindados por el test automático `V02.4-NIVEL`.
3. **Último partido con 2 y 3 sets, en 360px y 402px**: a 402px el marcador mide exactamente 44px (`getComputedStyle` del span de set) con el punto separador blanco/peso 900 y el guion interior a 0.65em/peso 500; a 360px el marcador reduce a 40.68px (dentro del clamp, la tarjeta no desborda el viewport — `cardOverflowsViewport: false`). Equipos en dos líneas ("Sebastián / Eduardo" / "vs Esteban / Matu"). Borde lima completo (`rgb(200,255,61)`, 1px en los 4 lados) y fondo Surface 3 (`rgb(17,34,56)`), sin línea de acento izquierda. El caso de 3 sets se confirmó por captura (402px); el de 2 sets se confirmó leyendo el HTML generado (`buildLastMatchScoreHTML`) sin necesidad de una captura adicional.
4. **Sheet Registrar partido y Partido completo**: el sheet mide 305.9px de alto sobre un viewport de 874px — exactamente 35% — con el título centrado y las dos opciones ("Cargar mi partido jugado"/"Registrar partido en vivo") con la misma jerarquía, repartidas con aire equilibrado en vez de pegadas al borde inferior. Confirmado por captura. Las tres pastillas SET 1/2/3 de Partido completo miden 69×57px (antes, con la tipografía de V02.3, notablemente más chicas), en una sola fila centrada; "Resultado válido" + CONTINUAR (fuera de alcance) siguen intactos. Confirmado por captura.

**Total: 4 capturas** (Home con Actividad+Nivel+Último partido en una sola captura combinada, Nivel BRAMU al 90% como segunda captura de refuerzo, sheet Registrar partido, Partido completo) — dentro del máximo sugerido, sin recorrer el resto de la aplicación.

**Regresión (fuera de alcance, verificado sin capturas adicionales):** Historial (7 ítems, marcador canónico sin cambios), Resumen del partido (tarjeta de notas permanente y BRAMU Intelligence intactos) — sin errores de consola de aplicación en ningún punto del recorrido (los `[error] An unknown error occurred when fetching the script` observados son el registro de Service Worker fallando en este entorno de sesión puntual, no un error de `app.js`/`styles.css`/`index.html` — mismo desvío ya documentado en el Informe V02.3).

---

## 5. Criterios de aceptación (§10.3)

- ✅ No existe ninguna barra celeste dentro de Actividad.
- ✅ Una derrota semanal es visible aunque haya cero victorias (33% de alto, `--line-strong`).
- ✅ Una semana vacía no se confunde con una semana de derrotas (baseline `rgba(...,0.08)` vs. `--line-strong`, ~3× más opaco).
- ✅ El nivel 6.3 llena aproximadamente 30% (test automático + verificado en vivo).
- ✅ El nivel 7.0 reinicia el recorrido (0%).
- ✅ Último partido usa Surface 3, borde lima completo, sin línea lateral.
- ✅ El marcador llega a 44px en 402px sin overflow (`cardOverflowsViewport: false`).
- ✅ Punto separador blanco/900; guion interior más liviano (0.65em/500) que los números (800).
- ✅ Equipos en dos líneas.
- ✅ Registrar partido ocupa 35% exacto de la altura útil, mismas acciones de siempre.
- ✅ Las tres pastillas de sets son mayores (69×57px vs. las de V02.3) y siguen en una fila.
- ✅ Sin regresiones en carga manual, guardado, resumen o navegación (verificado; ver §4).

---

## 6. PWA, versión y publicación (§11)

- `Store.VERSION`: `"BRAMUlab V02.3"` → **`"BRAMUlab V02.4"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-3` → **`bramulab-v02-4`** — mismo bump técnico de siempre.
- **Commit de implementación (código):** `86e9a945a820b3ca4a2ac662eb6aa926a3853186` — mensaje `"BRAMUlab V02.4 · Actividad apilada, Nivel BRAMU, jerarquía de Último partido y sheets compactos"`.
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag (registro final)

- Commit de implementación (código): `86e9a945a820b3ca4a2ac662eb6aa926a3853186`.
- Commit de este informe (matriz, tests, recorrido) y del README actualizado: `464ae8d7e8f45d0d01e1cc7fbf74e359698f7320`.
- Tag `BRAMUlab_V02.4` apunta al commit inmediatamente posterior a este, que registra ambos hashes de arriba (un commit no puede citar su propio hash) — el código funcional completo de V02.4 es íntegramente el de `86e9a94`; ese tercer commit no modifica ningún archivo de `bramulab/`.

---

## 8. Qué no se tocó (confirmado, §9 del consolidado)

Historial y sus pestañas, Resumen del partido (BRAMU Intelligence y tarjeta de notas), selector de compañero/rivales y su avance automático (color contextual de V02.3 intacto), pantalla Confirmar partido y sheet Fecha/hora/lugar, Ranking, Perfil, notificaciones y navegación general, registro en vivo por games/punto a punto, reglas deportivas/estadísticas/motor de análisis (`engine.js`/`stats.js` sin cambios), cálculo base de Efectividad (`computeEffectiveness30d`, sin cambios — solo se le sumó el token de progreso de Nivel al lado, sin tocarla), contenido de "Tu momento", esquema de `localStorage` (sin migraciones, sin `localStorage.clear()`). No se creó una carpeta `V02.4` — este informe vive en `Versiones/BRAMUlab_V02/`, junto al resto de la subversión.
