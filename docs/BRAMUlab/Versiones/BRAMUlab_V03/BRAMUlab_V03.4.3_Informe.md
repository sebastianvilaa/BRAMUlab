# BRAMUlab V03.4.3 — Informe (ajustes finales de cierre)

Ronda de cierre, puramente visual/UX — cero cambios de lógica (puntos, bonuses, empates,
regla 3 de 4, top 3, Race anual, admins, búsqueda GeoRef todos intactos).

## 1. Tabs de MIS GRUPOS — mayúscula sostenida (§1)

Las tabs ACTUAL/ANTERIOR/RACE ANUAL ya compartían el componente `.history-tab` con Historial
desde V03.4.2 (mismo contenedor `.history-filters` desde ese mismo microparche), pero el texto
estaba escrito en mayúscula sostenida directo en el HTML — `.history-tab` no tiene ningún
`text-transform`, así que el texto se ve tal cual se escribe. Historial nunca tuvo ese
problema porque sus labels (`Todos`/`Mis partidos`/`Observados`) siempre estuvieron en
minúscula/mayúscula inicial. Fix: los 3 `<button>` pasan a `Actual`/`Anterior`/`Race anual`.

## 2. Espaciado en MIS GRUPOS (§2)

Bug real: la tarjeta de BRAMU Intelligence quedaba pegada a la línea inferior de
`.history-filters` (esa línea no traía ningún margen propio, y `.groups-panel` tampoco). Fix:
`margin-top: 12px` en `.groups-panel` — mismo ritmo estándar entre bloques ya documentado en el
Home (V02.8 §7: "12px como ritmo estándar entre bloques del mismo peso").

## 3. Modales de doble acción horizontal — tipografía (§3)

`.overlay__actions` (el contenedor por defecto, SIN el modificador `--stacked`) ya ordenaba sus
botones lado a lado — eso no cambió. Lo que se ajustó fue el tamaño: los botones dentro de ese
contenedor bajan de 14px a 12px vía un selector acotado,
`.overlay__actions:not(.overlay__actions--stacked) > button`, que **nunca toca**
`.btn-start`/`.btn-secondary` en sí (siguen en 14px en todo el resto de la app, incluidos los
overlays apilados como "Cerrar sesión"/el popup de actualización). Aplica automáticamente a
los ~11 modales que ya usaban el contenedor plano (Finalizar partido, Ajustar marcador,
Eliminar partido, Eliminar grupo, etc.) — ningún cambio de markup por pantalla, un solo punto
de ajuste. Verificado: "Eliminar grupo" en 12px, "Cerrar sesión" (apilado) se queda en 14px.

## 4. Ubicación — hoja limpia al abrir (§4)

`openProfileLocationSheet()` ya no pinta el dataset local completo al abrir (eso mezclaba la
fuente que en V03.4.2 pasó a ser solo fallback con la experiencia normal de apertura). Nueva
función `clearProfileLocationList()` — vacía la lista y oculta tanto el contenedor como "Sin
coincidencias" (un estado explícitamente DISTINTO de "no hay resultados": acá directamente
todavía no se buscó nada). Se usa al abrir la hoja y mientras el campo tiene menos de 2
caracteres. Resultados aparecen recién cuando el usuario escribe lo suficiente — misma lógica
de guardado/búsqueda con GeoRef de V03.4.2, sin tocar `searchLocationsRemote` ni el fallback
local ante error de red.

## 5. QA manual (mobile 375px + desktop 1200px)

Tabs en minúscula/mayúscula inicial, comparadas visualmente contra Historial · espacio visible
entre tabs y tarjeta de Intelligence · modal "Eliminar grupo" con botones a 12px
(`getComputedStyle` confirmó `12px` en ambos botones) · modal apilado ("Cerrar sesión")
confirmado sin cambios (`14px`) · hoja de ubicación abre completamente vacía (sin lista, sin
"Sin coincidencias", sin mensaje de estado) · escribir "bella vista" sigue trayendo los 4
resultados reales de GeoRef sin cambios en el comportamiento de búsqueda.

## 6. Tests

Sin tests nuevos — los 4 puntos son texto/CSS/orden de render, no lógica nueva (criterio
explícito de la ronda: "tests focales solo para lógica nueva"). **Suite completa, una sola
corrida al cierre: 828/828 OK** (sin cambios respecto a V03.4.2 — ninguna función pura se
tocó).

## 7. Versionado

`Store.VERSION`: `BRAMUlab V03.4.3`. Quartet completo: `version.json`, `sw.js` (`CACHE_NAME` +
`CORE_ASSETS`), `index.html` (`?v=03.4.3`).

## 8. Commit / tag / deploy

Tag `BRAMUlab_V03.4.3`. Push a `main` → GitHub Pages redeploya automáticamente
(https://sebastianvilaa.github.io/BRAMUlab/bramulab/).
