# BRAMUlab V02.9
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.8.3 (commit `db00447`, tag `BRAMUlab_V02.8.3`).
**Documento de referencia:** `BRAMUlab_V02.9_Consolidado.md` (esta misma carpeta).
**Estado:** publicado en producción.

Esta ronda implementa completo `BRAMUlab_V02.9_Consolidado.md` — cinco ajustes puntuales sobre componentes ya en uso real (Efectividad, alta de jugador sin cuenta, Último partido, Historial, Resumen), sin abrir cuentas reales, ranking, backend, validaciones multiusuario, Player Card ni rediseños de Perfil/Ranking. No se encontró ninguna contradicción real entre el consolidado y el código vigente que impidiera implementarlo tal como está escrito — sí una discrepancia menor entre lo que el consolidado da por sentado y el estado real del código (ver nota en el ítem 3 de la matriz), resuelta a favor de la coherencia visual explícita que pide el propio documento.

---

## 1. Matriz requisito → implementación → archivo/función → prueba

### Home — Efectividad, aro nítido (§1)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 1 | Mantener verde BRAMU fuerte y la animación existente; eliminar blur/difuminado/cualquier halo que se sienta desenfocado; stroke principal fino y definido; a lo sumo UN segundo stroke apenas más ancho y de opacidad muy baja, perfectamente nítido, sin filtros; evitar que el aro quede grueso o pesado | El mecanismo de V02.8.1-V02.8.3 (tres círculos concéntricos — trazo + 2 halos — sin ningún `filter`) ya no usaba blur, pero los dos halos apilados (2.5px/.38 + 3.5px/.24 sobre un trazo de 1.5px, los tres centrados en la misma línea) producían un degradado escalonado de grosor/opacidad que LEÍA como un aro borroso, aunque técnicamente no hubiera ningún filtro de por medio — el problema visual que el consolidado describe es real incluso sin blur. Se retira un halo entero: queda el trazo principal (1.5px, sin cambios) + un único refuerzo (2.2px, apenas más ancho, opacidad 0.16). Mismo mecanismo de círculos concéntricos, mismo `stroke-dasharray`/`stroke-dashoffset`, misma animación por Web Animations API — nada de eso se tocó | `index.html` (se retira el `<circle>` `glow-outer`), `styles.css:.effectiveness-donut__glow` (reemplaza a `__glow-inner`/`__glow-outer`), `app.js:renderPlayerEffectiveness` | **Computed style real**: `getComputedStyle` confirma `ring{opacity:1, stroke-width:1.5px, filter:none}` y `glow{opacity:0.16, stroke-width:2.2px, filter:none}`. **Visual real** (402px/375px, partido cargado con 100% de efectividad): aro fino y nítido, sin ningún indicio de degradado/borrosidad, brillo apenas perceptible alrededor del trazo. Animación (`shouldAnimate`) sin cambios de código — sigue corriendo en cada entrada al Home |

### Cargar partido — alta de jugador sin cuenta (§2)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 2 | Reemplazar el CTA grande por una fila contextual dentro del listado de búsqueda; jugadores existentes siguen filtrando normal; formato `[ícono persona +] Agregar a "X" [chevron opcional]`; sin borde protagonista de color; fila consistente con los resultados; ícono circular de persona+ a la izquierda; texto principal blanco; sin "Sin coincidencias" si no aporta; sin el texto "como jugador sin cuenta"; debe sentirse distinta de un usuario ya existente | Se retira el botón `#load-player-sheet-add` como CTA de ancho completo fuera de la lista (`.sheet-option--primary`, borde de color, texto "Agregar 'X' como jugador sin cuenta"). Nueva función `buildAddPlayerRowHTML` genera una fila `.player-row.player-row--add` — MISMO componente que una fila de jugador real — con un ícono circular propio (persona + "+", SVG en trazo, sin iniciales) y el texto `Agregar a "X"` (comillas tipográficas, sin la coletilla "como jugador sin cuenta"). Esta fila se agrega como ÚLTIMO elemento del propio `#load-player-sheet-list`, después de los jugadores reales que matcheen la búsqueda — conviven en una sola lista. El acento de equipo (verde Compañero / azul Rival) que antes vivía en un punto chico sobre el CTA ahora tiñe el ícono. "Sin coincidencias" solo se muestra cuando NI hay jugadores reales NI se puede ofrecer el alta (nombre vacío o ya duplicado en el partido) | `app.js:buildAddPlayerRowHTML`, `renderManualPlayerSheetContent`, `initManualPlayerSheet` (se retira el listener estático); `index.html` (se retira el `<button>` estático); `styles.css` (se retira `#load-player-sheet-add.sheet-option--primary`/`.sheet-add-player-dot`, se agrega `.player-row__avatar--add`) | **Manual, extremo a extremo**: sheet "Elegir compañero" con query vacía → "Sin coincidencias." (sin alta posible); query "Fernan" (sin jugadores previos) → aparece únicamente la fila "Agregar a 'Fernan'" con ícono verde, se toca y el jugador queda asignado al slot; sheet "Elegir rival" con la misma query → mismo comportamiento con ícono azul. **Caso mixto**: con "Fernan" ya conocido, query "Fer" muestra la fila real "Fernan" (avatar con inicial, @usuario) SEGUIDA de "Agregar a 'Fer'" (ícono persona+) — ambas conviven sin error, orden correcto, sin duplicar listeners |

### Home — Último partido, formato/sistema (§3)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 3 | No rediseñar; mantener forma/fecha/hora/badge de resultado en zona superior/resultado protagonista/participantes abajo-izquierda/tratamiento general; agregar en la zona inferior derecha, alineada con los participantes, formato y sistema reales en dos líneas (ej. CLÁSICO / PUNTO DE ORO); no mover el badge de resultado, no volver protagonista la metadata, no rehacer tamaños | El consolidado da por "mantenido" que el badge superior ya dice `VICTORIA`/`DERROTA` completo — el código real lo tenía abreviado a `VIC`/`DER` desde V02.5 (§20). Como el propio §4 de este mismo consolidado pide explícitamente la palabra completa para Historial ("evitar abreviaturas si el espacio permite la palabra completa") y el principio rector de toda la ronda es que Historial sea el mismo lenguaje visual que Último partido, dejar Último partido abreviado mientras Historial usa la palabra completa habría creado la inconsistencia opuesta a la que pide la ronda — se corrige también acá (`VIC`→`VICTORIA`, `DER`→`DERROTA`). El formato (`E.FORMATS[m.formatId].label`, mayúsculas) y el sistema de puntuación (`SCORING_SYSTEM_LABELS[m.scoringSystem]`, ya en mayúsculas) se agregan como `<div class="player-home-lastmatch__meta">` de dos líneas dentro de `.teamsrow`, entre los equipos y el chevron — mismos datos/fuente que usa Historial, nunca un texto fijo | `app.js:renderPlayerLastMatchCard` (nuevo `resultLabel` completo + `lastMatchFormatLabel`/`lastMatchScoringLabel`); `styles.css:.player-home-lastmatch__meta/__meta-line` | **Manual**: partido Clásico/Punto de Oro cargado → tarjeta muestra "VICTORIA" completo arriba, "6-0 · 6-0" protagonista, "Seba / Fernan vs Gusti / Esteban" abajo-izquierda, "CLÁSICO" / "PUNTO DE ORO" abajo-derecha, chevron visible (confirmado por `getBoundingClientRect`, dentro del ancho de la tarjeta). Sin overflow horizontal nuevo en 375px (`document.body.scrollWidth === window.innerWidth`) |

### Historial — tarjetas de partido (§4)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 4 | Tarjeta como versión compacta de Último partido: arriba fecha/hora + VICTORIA o DERROTA completo; resultado protagonista; abajo-izquierda pareja propia/vs/rivales; abajo-derecha formato/sistema en dos líneas; sin "PARTIDO CARGADO" ni X de borrado; tap sigue abriendo Resumen; card más compacta pero mismo ADN visual | `renderHistory` reordena el markup de cada `.history-item` en las mismas 4 zonas que Último partido (top-row → score → bottom-row con teams+meta). El badge de resultado pasa de `VIC`/`DER` a `VICTORIA`/`DERROTA` completo. Formato/sistema (antes en una línea de "subtítulo" arriba, junto con el modo de carga) se reubican como `.history-item__meta` abajo a la derecha — mismos `E.FORMATS`/`HISTORY_SCORING_LABELS` que antes. Se retira la línea de subtítulo completa: junto con "PARTIDO CARGADO" (mode==='manual') se retira también "POR GAMES" (mode==='games') — ninguno de los dos tiene equivalente en Último partido, que es la referencia explícita de esta ronda, así que mantener cualquiera de los dos habría dejado un elemento sin contraparte en el componente "madre". Se retira el botón `.history-item__delete` (✕) y el wrapper `.history-item__main`: la tarjeta entera vuelve a ser un solo bloque con un solo listener de click a Resumen (antes dividido para dejarle lugar al botón de borrado). La duración del partido (antes mostrada en `.history-item__meta`, reutilizada ahora para el formato/sistema) también se retira de la card — Último partido tampoco la muestra. El badge de terminación manual (ej. "Abandono") se conserva, sin instrucción de sacarlo | `app.js:renderHistory` (reescrita), funciones `deleteHistoryEntry`/`showUndoToast` eliminadas por quedar sin ningún llamador; `styles.css:.history-item*` (reescrito), `.toast__undo-btn` eliminada por quedar sin uso | **Manual**: Historial con 1 partido cargado muestra la tarjeta con las 4 zonas correctas, sin "PARTIDO CARGADO" ni X, `CLÁSICO`/`PUNTO DE ORO` abajo a la derecha. Tap en cualquier parte de la tarjeta abre "RESUMEN DEL PARTIDO" (confirmado leyendo `.analysis-header__title` tras el click). **571/571 tests siguen en verde** — ninguna función pura tocada |

### Resumen — Eliminar partido (§5)

| # | Requisito | Implementación | Archivo/función | Prueba |
|---|---|---|---|---|
| 5 | Acción deliberada y secundaria al final del Resumen; confirmación con el mensaje exacto sugerido y acciones Cancelar/Eliminar; eliminación completa del registro (sin lógica multiusuario) | Nuevo botón `#analysis-delete-btn` (`.link-btn`, texto "Eliminar partido"), último elemento de `#analysis-share-section`, después de "VOLVER AL INICIO" — estilo mínimo (texto apagado, sin fondo/borde), solo insinúa rojo en `:active`, mismo criterio que tenía la X de Historial retirada en esta ronda. Reutiliza el modal de confirmación genérico ya existente (`confirmAction`/`#confirm-overlay`, el mismo de "Reiniciar partido"/"Volver al inicio") en vez de construir un modal nuevo — se le agregan dos parámetros opcionales (`acceptLabel`/`cancelLabel`) para que el botón de aceptar diga "Eliminar" en vez del "Confirmar" genérico, sin afectar a ninguno de los 5 llamadores previos (que no los pasan). Al confirmar: `Store.removeFromHistory(matchId)` (misma función que ya usaba la X retirada de Historial), toast "Partido eliminado", y navegación a Home — Home/Historial/Efectividad/Nivel BRAMU se recalculan solos en el siguiente render porque siempre leen `Store.loadHistory()`, nunca un historial paralelo | `index.html` (nuevo botón), `app.js:confirmAction` (firma extendida), `app.js:renderAnalysis` (wiring del botón) | **Manual, extremo a extremo**: Resumen de un partido recién cargado → scroll al final → "Eliminar partido" (visible, discreto) → tap → modal "¿Eliminar este partido?" / "Se actualizarán tu historial y tus estadísticas." con "Cancelar"/"Eliminar" → Cancelar cierra sin efecto (verificado) → reintentado con Eliminar: navega a Home, "0 partidos en tu historia", Último partido vuelve al estado vacío, Nivel BRAMU vuelve a 5.0, Efectividad vuelve a "Sin partidos considerados", Historial queda vacío |

---

## 2. Verificación visual real

1. **Efectividad**: computed style (`opacity`/`stroke-width`/`filter`) de los dos círculos confirmó los valores exactos del CSS, no solo lo declarado — más una comparación visual a 100% de efectividad (375px) contra la descripción del problema reportado (aro difuso): resultado fino y nítido.
2. **Alta de jugador sin cuenta**: recorrido completo en el flujo real "Cargar mi partido jugado" (no un fixture aislado) — 4 jugadores nuevos agregados exclusivamente a través de la fila "Agregar a…", en ambos contextos de color (Compañero/verde, Rival/azul), más el caso mixto con un jugador real y una fila de alta conviviendo en la misma búsqueda.
3. **Último partido / Historial**: partido real de prueba (Seba/Fernan 6-0 6-0 vs Gusti/Esteban, Clásico · Punto de Oro) cargado de punta a punta por la UI (selección de jugadores → resultado → guardar), confirmando ambas tarjetas con los datos reales, sin overflow horizontal (`document.body.scrollWidth === window.innerWidth` en 375px) y sin errores de consola atribuibles a esta ronda.
4. **Resumen**: eliminación real ejecutada sobre ese mismo partido de prueba, confirmando el efecto en cascada sobre Home/Historial (no un mock de `Store.removeFromHistory`).

**Limitación de entorno, documentada sin acomodar la evidencia:** las herramientas de captura de esta sesión no soportan recorte de región (`zoom` devuelve la captura completa) ni Full Disk Access hacia esta carpeta de Dropbox para el servidor de previsualización propio del proyecto (mismo tipo de restricción de sandbox ya documentado en V02.2) — se sirvió `bramulab/` con el mismo `.claude/dev-server.py` lanzado por Bash en segundo plano y se navegó el panel a `http://localhost:4173` directo, y la verificación visual de detalle (nitidez del aro) se apoyó en `getComputedStyle` además de la captura completa.

---

## 3. Tests automáticos

**571/571 tests OK — todo verde** (`tests.html`), sin cambios respecto de la base V02.8.3. Ningún test nuevo ni afectado: la ronda entera es DOM/CSS (`app.js`, `index.html`, `styles.css`) — ninguno de los archivos que carga la batería (`engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`) tiene cambios de lógica, salvo el string `APP_VERSION` de `store.js`.

---

## 4. Validación visual — mobile (375px)

- Efectividad: sigue animando en cada entrada al Home; estado final fino y nítido, sin blur ni degradado escalonado.
- Alta de jugador sin cuenta: fila integrada al listado, ícono contextual (verde/azul), sin CTA de ancho completo, sin "Sin coincidencias" redundante.
- Último partido: diseño/jerarquía sin cambios; VICTORIA/DERROTA completo arriba; CLÁSICO/PUNTO DE ORO abajo a la derecha, alineado con los participantes; chevron conservado.
- Historial: tarjeta compacta, mismas 4 zonas que Último partido, sin "PARTIDO CARGADO"/X; tap abre Resumen.
- Resumen: "Eliminar partido" al final, discreto; confirmación con el texto exacto pedido; borrado real actualiza Home/Historial/estadísticas.
- Sin overflow horizontal nuevo en ninguna de las pantallas tocadas.

---

## 5. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.8.3"` → **`"BRAMUlab V02.9"`**.
- `version.json`: actualizado en paralelo (mismo valor).
- `sw.js`: `CACHE_NAME` `bramulab-v02-8-3` → **`bramulab-v02-9`**.
- **Commit de implementación (código):** `f19c0207d2e5bef9ce74a70e2a19733f0a8a809b`.
- **Push:** a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 6. Hash exacto y tag

- Commit de implementación (código): `f19c0207d2e5bef9ce74a70e2a19733f0a8a809b`.
- Commit de este informe: `be20da01a4b92138b26fe8c75f8739562f7cdcf9`.
- Tag `BRAMUlab_V02.9` apuntará al commit inmediatamente posterior a este, que registra ambos hashes de arriba — el código funcional completo de V02.9 es íntegramente el del primer commit; ese commit siguiente no modifica ningún archivo de `bramulab/`.

---

## 7. Qué no se tocó

Nivel BRAMU, Actividad, Tu Momento, métricas pequeñas del Home, BRAMU Intelligence, Ranking, Perfil, Compañeros/Rivales, arquitectura CSS (`styles.css` sigue siendo un solo archivo), lógica funcional de partidos/estadísticas, cuentas reales, login/registro, backend, ranking BRAMU, validación de resultados entre jugadores, propiedad compartida de partidos, Player Card — todo fuera de alcance explícito de esta ronda (§6 del consolidado).
