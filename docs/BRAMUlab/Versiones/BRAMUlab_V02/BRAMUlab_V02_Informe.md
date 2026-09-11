# BRAMUlab_V02
## Informe — qué se implementó, verificó y corrigió

**Tipo de documento:** informe retrospectivo (síntesis documental de informes ya cerrados, no una verificación nueva).
**Fecha de esta síntesis:** 10/09/2026.
**Estado actual de la app:** tag `BRAMUlab_V02.9.3`, commit `9653c748f2ce2e789de1eda9079c63dd9f8f60c4`. Última rama de trabajo cerrada: V02.9.3 (ajustes finales de Historial y Último partido).
**Cómo leer este documento:** cada sección corresponde a una ronda ya implementada y publicada. El detalle completo (matrices requisito→implementación, capturas, verificación manual paso a paso) vivía en el informe original de cada ronda (citado por nombre en cada sección) — esos originales ya se borraron del repositorio una vez confirmado que este resumen no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).

---

## 0. Arquitectura vigente al cierre de la línea V02 (acumulada, no por versión)

**Tokens CSS centralizados** (`styles.css:root`), valores finales tras 16 rondas de afinación:
- Color: `--brand-lime:#95FF19` (identidad/acción/progreso — nunca color de equipo), `--accent-cyan:#199FFF` (funciona conceptualmente como "azul BRAMU", token sin renombrar por compatibilidad), `--team-a: var(--brand-lime)`, `--team-b: var(--accent-cyan)` (magenta salió del sistema de equipos en V02.5), `--text:#F8FAFC` (nunca blanco puro `#FFFFFF`), `--bg/--bg-deep/--surface-1/2/3`, `--line/--line-strong/--scrim`.
- Radios: 7 familias reales y coherentes — circular `50%`, pill `999px`, control chico `8-10px`, superficie tocable `12px` (`14px` como escalón intermedio real), tarjeta estándar `var(--radius-card)` = 16px, hero `var(--radius-hero)` = 18px, sheet/modal `20px`. Normalizados en V02.8 los casos verificables 1:1 (literales que coincidían por casualidad con los tokens).
- Motion: `--motion-base/--motion-fast/--motion-ease` (curva `cubic-bezier(0.32,0.72,0,1)`, agresiva — resuelve ~95-100% del recorrido en el primer 20-25% del tiempo, adecuada para feedback de UI pero NO para animaciones de entrada) más `--home-anim-level/--home-anim-activity/--home-anim-effectiveness` (duración) y `--home-anim-ease: ease-out` (curva dedicada, introducida en V02.8.1 tras diagnosticar por qué las animaciones de entrada del Home no se percibían). Todos colapsan a `1ms` bajo `prefers-reduced-motion`.
- Fondo: `--bg-gradient-app` (token compartido desde V02.7) aplicado a Historial/Ranking/Perfil/Compañeros-Rivales/Carga manual/Confirmar partido/Resumen/Setup (Setup se sumó recién en V02.8); el Home mantiene su propio degradé bespoke, más intenso arriba, como "pantalla ancla".
- Regla de bordes (documentada por la auditoría de V02.8, no cambiada): **fila de lista → sin borde**, solo fondo; **tarjeta autónoma → borde 1px `var(--line)`**, salvo razón jerárquica real (selección, pertenencia de equipo).

**Componentes/patrones establecidos:**
- Marcador canónico compartido (Historial/Confirmar partido) construido con separadores **geométricos** (`inline-flex`, barras/puntos `background:currentColor`), no glifos tipográficos — desde V02.6, con `aria-label` de texto completo para accesibilidad. La tarjeta "Último partido" del Home usa su PROPIO builder (`buildLastMatchScoreHTML`), deliberadamente separado del canónico desde V02.4, para poder tener un tratamiento tipográfico distinto sin arrastrar cambios a Historial/Confirmar.
- Filas de equipo en Confirmar partido/Resumen sobre **CSS grid** (`minmax(0,1fr) auto` + columnas de set de ancho fijo) desde V02.6 — reemplaza un layout flex que rompía la alineación de columnas con nombres de equipo de longitud muy distinta.
- "Último partido" es el **componente madre** de la representación visual de un partido jugado; desde V02.9, Historial es explícitamente su clon compacto (mismas 4 zonas: header con fecha/hora+badge, resultado protagonista, participantes abajo-izquierda, formato/sistema abajo-derecha).
- Sistema de sheets con 3 alturas nombradas: compacto (`~35%`, Registrar partido, sin tocar desde V02.4), alto (`~70-75%`, selector de jugador, desde V02.5), y el modal centrado genérico (`.overlay`).
- Animaciones de entrada al Home (Nivel/Actividad/Efectividad) se re-disparan en **cada** entrada o vuelta (decisión final de V02.8, revirtiendo la de "una vez por sesión" que V02.7 había tomado); implementadas con técnicas robustas por elemento — `@keyframes` sobre `transform:scaleX/scaleY` para Nivel/Actividad, Web Animations API sobre `stroke-dashoffset` para Efectividad — tras descartar la técnica original "0 + reflow + valor final" por depender de que el navegador registre un frame intermedio, algo que no siempre ocurre.

**Sin arnés de test para DOM/`app.js`** en ningún punto de esta línea (mismo criterio heredado de V01) — `tests.html` solo carga `engine.js`/`stats.js`/`store.js`/`player-home.js`/`match-load.js`. Toda la verificación de UI/animaciones/layout se hizo a mano contra `.claude/dev-server.py`, con técnicas cada vez más rigurosas (computed styles → `MutationObserver` → `getAnimations()`/scrubbing determinístico → muestreo atómico en tiempo real) a medida que rondas sucesivas revelaron que las verificaciones anteriores no habían sido suficientes.

---

## 1. Sistema visual integral — V02 base

**Fuente:** `BRAMUlab_V02_Informe.md`. Commit de implementación `91a79f8`. Tag técnico: creado inicialmente como `v3.0` (numeración paralela) y **corregido a `BRAMUlab_V02`** durante el "Ajuste visual de cierre 01" (mismo commit `91a79f8`, ver §1.1) — desde entonces ninguna ronda de esta línea volvió a crear tags `vN.N`.

Reemplazo global de tokens: Oswald+Manrope→Inter (vía `@import` de Google Fonts, no `.woff2` local — desvío justificado, mismo mecanismo ya probado que usaba la app); paleta centralizada con las variables viejas (`--ink`, `--paper`, etc.) conservadas como **alias** de las nuevas para no reescribir ~1600 líneas de `styles.css` referencia por referencia; la paleta `--court-*` (marcador/carga manual) fusionada del mismo modo.

**La reclasificación de color no fue un find-and-replace ciego.** En el código anterior, lima (`--team-a`) cumplía doble función — color real de Equipo A y acento genérico de identidad/acción en Home/Historial/Perfil. Se auditó línea por línea cada uso de `var(--team-a)`/`var(--team-b)` y sus literales `rgba(...)` asociados: **~32 usos genuinamente de equipo** quedaron en los tokens de equipo (ahora azul/magenta); **~38 usos que en realidad eran acento de marca** se reclasificaron a `var(--brand-lime)` (conservando el HEX exacto que ya tenían). Caso verificado a mano: el chip "vos" fijo de Equipo A en carga manual se mantuvo en azul (es equipo, no identidad), pese a estar en la misma zona que otros acentos. Dorado se conservó para Punto de Oro y — por decisión de criterio documentada — también para Star Point y Tie break (misma familia semántica de "punto decisivo"); todo lo demás que usaba dorado genérico pasó a lima.

Iconografía: reemplazo por SVG lineal del menú del partido en vivo, las 14 apariciones del botón cerrar (un solo `replace_all`), el indicador de saque (de 🎾 a un punto lima), el placeholder de Ranking y el ícono del popup de Highlight. **Deliberadamente sin tocar:** emojis dentro de texto GENERADO por BRAMU Intelligence/Timeline (contenido editorial dinámico, no iconografía de interfaz).

Versión visible: `Store.VERSION`/`version.json`/footer → **"BRAMUlab V02"** (texto de producto con espacio). `sw.js` `CACHE_NAME` → `bramulab-v02`.

**Verificación:** 483/483 tests (sin cambios — solo el string `APP_VERSION`). Verificación manual de las 10 pantallas pedidas por el consolidado en 402×874, con un partido cargado de punta a punta. **Limitación de entorno:** el sandbox de esta sesión no pudo registrar el Service Worker (`navigator.serviceWorker.register` fallaba pese a que `fetch('sw.js')` respondía 200) — la verificación real de "se ofrece y aplica la actualización" se hizo después de publicar, contra producción, confirmando el modal de actualización y el flujo completo funcionando.

**Desvíos justificados:** (1) Inter vía CDN, no `.woff2` local — el consolidado lo dejaba como preferencia, no obligación. (2) Dorado extendido a Star Point/Tie break. (3) Emoji en texto generado sin tocar. (4) No se persiguió la unificación completa de radios/letter-spacing más allá de lo explícitamente pedido (esa deuda quedó documentada y fue el origen de la Auditoría de V02.8).

### 1.1 Ajuste visual de cierre 01

**Fuente:** sección dentro de `BRAMUlab_V02_Informe.md`. Commit `320d2c2`.

**Tag técnico corregido:** se verificó primero (`gh api repos/.../pages`) que GitHub Pages depende solo del push a `main`, nunca de tags; se eliminó el tag `v3.0` (local y remoto) y se creó `BRAMUlab_V02` apuntando al mismo commit `91a79f8`.

**Jerarquía tipográfica fusionada de verdad:** ~20 clases con `font-family` pero sin `font-weight` explícito (heredaban 400 del navegador pese a tamaños grandes) se auditaron y se les asignó peso según la escala del consolidado: 800 para resultados/números hero (`.player-home-lastmatch__score`, `.court-score__value`, `.player-card__level-value`), 700 para métricas protagonistas/títulos/CTA, 600 para subtítulos, 500 para nombres/metadatos.

**El bug más importante de la ronda:** el síntoma reportado — la segunda opción del sheet "Registrar partido" tapada por la barra inferior — **no era un problema de z-index**. Investigando con `getComputedStyle`, se descubrió que `--court-surface` devolvía **string vacío**: el bloque `:root{...}` completo que definía los 8 tokens `--court-*`/`--sheet-duration-*` nunca aparecía en `document.styleSheets[0].cssRules` pese a estar bien formado en el archivo fuente. **Causa raíz:** un comentario CSS inmediatamente anterior contenía la secuencia literal `--motion-*/--motion-ease` (sin espacio) — el `*/` ahí adentro cerraba el comentario antes de lo previsto, y todo el texto suelto siguiente se interpretaba como CSS inválido, haciendo que el parser descartara en silencio el bloque `:root{...}` completo que venía después. Esto dejaba **todo el sistema de tokens `--court-*` fusionado en V02 silenciosamente inactivo en producción desde su publicación**, sin ningún error de consola — afectando no solo el sheet "Registrar partido" sino "Elegir jugador", "Formato y puntuación" y buena parte de la pantalla de carga manual. Fix de una línea: agregar el espacio faltante.

**Consecuencia de publicación:** dado que `sw.js` no cambiaba de bytes en esta ronda, ningún cliente con la caché `bramulab-v02` ya instalada iba a detectar el service worker nuevo por sí solo — se subió igual el `CACHE_NAME` técnico a `bramulab-v02-1` (sin cambiar la versión visible), estableciendo el patrón de "bump técnico de caché" que se repitió en cada ronda siguiente de esta línea.

**Recomposición de "Último partido":** volanta+título+badge agrupados en un único bloque a la izquierda con fecha/hora/lugar a la derecha (antes en filas separadas); resultado a 36px/800/tabular; chevron movido de la fila del título a la fila de parejas; línea de acento de 2px en el borde superior (lima en victoria, coral en derrota).

**Desvío observado, no corregido (quedó anotado para revisión futura):** un partido cargado con "Ahora" quedó con `playedAt` un día calendario por delante de `createdAt` — no se investigó por estar `match-load.js` explícitamente fuera de alcance de esta ronda. Este sería exactamente el bug que V02.1 (§1 de este informe) encontraría y corregiría a fondo poco después.

**Tests:** 483/483 (sin cambios).

---

## 2. BRAMUlab V02.1 — corrección funcional, UX y terminación visual

**Fuente:** `BRAMUlab_V02.1_Informe.md`. Base: `de00f8c`, tag `BRAMUlab_V02`. Tag de esta ronda: `BRAMUlab_V02.1` (commit `77f54c5`, derivado de la cita en el informe de V02.2 que lo usa como base).

**Bug real #1 — el que motivó la ronda: "11 partidos cargados hoy, Actividad solo contaba 3".** Se auditaron primero `computeActivity30d`/`computeEffectiveness30d` (correctas, operan sobre timestamps absolutos) — el bug no estaba ahí. Estaba en el **prefill de carga manual**: `now.toISOString().slice(0,10)` (fecha en UTC) combinado con `getHours()/getMinutes()` (hora LOCAL). Durante la ventana horaria en la que el calendario UTC ya rotó pero el local no (Argentina UTC-3, aprox. 21:00-23:59), esa mezcla producía un `playedAt` hasta 24h en el futuro — no un detalle cosmético, un instante genuinamente futuro que el guard `age<0` de las funciones de cómputo excluía en silencio. **Reproducido en consola:** hora local `23:30` → `toISOString()` devuelve `2026-09-05T02:30:00.000Z`, escribiendo `"2026-09-05"` en el campo fecha mientras `getHours()` mostraba `23:30`. **Fix:** `localDateInputValue(d)`/`localTimeInputValue(d)` nuevas, siempre con getters locales, reemplazando tanto el prefill de "Ahora" como el fallback de edición (que también usaba `toISOString()`). Ningún registro histórico necesitó migración — el bug estaba en la ESCRITURA de partidos nuevos, nunca en la lectura.

**Bug real #2 — tie-break sin poder superar 7.** El síntoma reportado tenía causa más profunda que un techo numérico: `applyGameTbStepper` exigía que **cada toque individual** produjera, por sí solo, un resultado FINAL válido — desde el default `7-5`, literalmente ningún botón hacía nada. **Fix:** el stepper ahora suma/resta libremente (sin techo artificial); la validación real se hace UNA VEZ al confirmar, con `E.isValidFinalTiebreakScore(a,b,cfg)` nueva en `engine.js`. Verificado llegando a **10-8** tocando "+" alternadamente (antes, imposible).

**Bug real #3 — mensaje contradictorio del set decisivo.** El mensaje "falta definir el tercer set" podía seguir visible con el Set 3 ya válido, porque `manualSets[2]` seguía `null` hasta el toque explícito en CONTINUAR. Se resolvió como efecto directo del avance automático (Bloque B): con el Set 3 confirmándose en el mismo instante en que se completa, la ventana de contradicción desaparece.

**Otros arreglos:** logo del Home dejó de navegar (`showView('setup')` eliminado); `Store.isPlaceholderPlayerName` excluye "Jugador 1"–"4"/"Vos" del selector sin tocar partidos históricos.

**Rediseño estructural — Confirmar→Guardar→Resumen.** Reemplaza `Partido guardado`/`Resumen inmediato` (`#view-summary`)/`Análisis` por un flujo de dos pasos. `#view-match-saved` se repropone como PRE-guardado ("CONFIRMAR PARTIDO"); `finalizeManualContinue()` ya no persiste directo — arma el snapshot y recién al tocar GUARDAR llama `Store.upsertHistory` **una sola vez** (confirmado con `loadHistory().length` antes/después). `#view-analysis` pasa a ser la única pantalla de detalle para las 3 procedencias (vivo/manual/Historial), retitulada "RESUMEN DEL PARTIDO". **Eliminado por completo:** `#view-summary` y sus funciones (`renderSummary`, `buildSummaryCardHTML`, etc.). **Barrido de seguridad:** se encontraron y corrigieron 3 referencias sobrantes a `$('#view-summary')`/`$('#summary-*')` en `showView()`/`resetMatch()`/`discardActiveMatchState()` que habrían lanzado `TypeError`.

**Bug real en BRAMU Intelligence.** `generateManualIntelligence` clasificaba TODO partido "ganó-perdió-ganó" como "parejo" sin mirar el margen real de cada set — `6–1 · 1–6 · 6–0` (dominio alternado, cierre contundente) se narraba como "desarrollo parejo". **Fix:** `classifyWonLostWonPattern(sets)` nueva, clasifica por margen real (`isSetMarginClose`). Los 5 casos textuales del consolidado quedaron cubiertos por tests automatizados.

**Bug de CSS heredado.** `.overlay` tenía `background: rgba(11,18,17,0.92)` hardcodeado — exactamente el HEX del viejo `--ink` verde-negro pre-V02, nunca migrado por ser un literal, no una variable. Reemplazado por `var(--scrim)`. Además `.overlay` tenía `z-index:30`, por DEBAJO de `.bottom-nav` (`z-index:35`) — subido a 36.

**Home:** destacados de chip a carrusel de tarjetas; avatar reemplazado por silueta SVG genérica + `@handle` derivado del nombre (nunca hardcodeado, nunca una foto real); nuevas vistas Compañeros/Rivales (`PH.computeTeammateBreakdown`/`computeRivalBreakdown`, puras, excluyen placeholders y observados); filtro contextual de Historial desde Racha/Efectividad.

**Tests:** 349 (Etapa 2, herencia de V01) → esta ronda cierra en **523/523** (483 + 40 nuevos, 4 bloques: V02.1-TB tie-break, V02.1-PH placeholders, V02.1-M racha/compañeros/rivales/30 días, V02.1-BI narrativa). Durante la escritura de tests se corrigieron 4 errores de DATOS DE PRUEBA (no de código): un supuesto incorrecto de techo de tie-break con `winTarget` menor, una cuenta de días mal hecha a mano, y un `winnerTeam` invertido en el caso de remontada.

**Nota de proceso:** la verificación visual/táctil completa se hizo con Service Worker/caché limpiados antes de cada verificación relevante — lección ya repetida desde V01 y que se mantuvo como práctica estándar en toda esta línea.

---

## 3. BRAMUlab V02.2 — corrección UX y terminación visual

**Fuente:** `BRAMUlab_V02.2_Informe.md`. Commit de implementación `ab98131d27372bf994ae4b8f81357cf10b050733`. Tag `BRAMUlab_V02.2`.

**Bug real: RECIENTES/TODOS duplicaban personas.** `renderManualPlayerSheetContent` armaba `TODOS` con una lista de exclusión que nunca incluía a quienes ya se mostraban en `RECIENTES` — cualquier persona con historial compartido aparecía dos veces en la misma pantalla. **Fix:** se guarda `recentNames` (vacía si hay búsqueda activa) y se agrega a la exclusión de `TODOS`. Verificado con test automático (`V02.2-SEL`) que reproduce el escenario exacto.

**Decisiones de diseño documentadas:**
- **Ganadores movidos DENTRO de la tarjeta de resultado** — revierte explícitamente una decisión mucho más antigua ("Bloque M1: el ganador vive FUERA de la tarjeta de score"); el consolidado V02.2 prevalece por instrucción expresa.
- Sets/Games ganados pasan a calcularse desde `f.sets` (siempre disponible) en vez de solo para partidos cargados, eliminando la fila duplicada "Games ganados" que ya existía en la grilla de Por Games.
- Nota privada colapsable en Resumen en vez de ocultarla sin alternativa — ocultarla por completo habría eliminado la única forma de agregarle nota a un partido ya guardado; se agregó un link discreto "+ Agregar nota privada" que revela el editor real.
- Corrección de guion hyphen-minus→en dash en `formatSetSegmentLabel` (el resto de la app ya usaba en dash consistentemente).
- Auto-avance completo hasta CONFIRMAR PARTIDO (`setTimeout` de 320ms) con el botón CONTINUAR conservado como red de seguridad para 2 casos no-interactivos (reabrir un partido completo, o un cambio de formato que deja el resultado ya válido).

**Implementado además:** tarjetas EQUIPO A/EQUIPO B compactas reemplazando los 4 pills; sheet "Registrar partido" con las 2 opciones en igual jerarquía; avance automático de foco/set completo (selección secuencial Compañero→Rival1→Rival2→teclado, foco A→B, set→set→Confirmar); marcador canónico único (`buildCanonicalScoreLineHTML`) reutilizado en Historial/Confirmar/Último partido; Historial con pestañas reales (superficie propia); naming sin "BETA".

**Tests:** **535/535** (523 + 12 nuevos: V02.2-SEL 7 casos selector, V02.2-SET 5 casos avance automático).

**Nota sobre alcance de tests:** documentado explícitamente (y repetido en todos los informes siguientes) que `tests.html` nunca carga `app.js` — la orquestación de UI (secuencias automáticas, apertura de teclado, swipe) no es unit-testeable en este arnés, se verifica exclusivamente con recorrido manual.

**Limitaciones honestas declaradas:** el panel del navegador quedó oculto del lado del cliente durante la sesión, impidiendo clicks por coordenadas — se dispararon los mismos eventos DOM que un toque real (`element.click()`, eventos `input` reales). El swipe de Historial no se pudo ejercitar de punta a punta (requiere secuencia táctil real) — verificado por revisión de código. Capturas no se pudieron guardar como archivos (limitación de herramientas de la sesión, no del alcance del pedido) — documentadas por descripción exacta de cada verificación en su lugar.

---

## 4. BRAMUlab V02.3 — ajuste acotado de carga manual y métricas del Home

**Fuente:** `BRAMUlab_V02.3_Informe.md`. Commit `28e994454aded5278976c5cc6dcc02240bcb9321`. Tag `BRAMUlab_V02.3`.

**Bug real: Actividad — la derrota nunca tenía relleno propio.** La altura del bloque exterior SÍ era proporcional a la cantidad de partidos, pero el único color visible (`--brand-lime`) vivía en una capa interna (`.activity-bar__win`) cuya altura era `wins/count` — con cero victorias, esa capa quedaba en 0% y lo único pintado era un fondo casi transparente, indistinguible de un período vacío. **Fix:** se elimina la capa `__win`; todo bloque con `count>0` recibe `.is-active`, pintando el bloque ENTERO en celeste (`--team-a`) sin importar la mezcla de resultados. *(Nota: esta implementación "todo celeste" sería, a su vez, declarada explícitamente "una interpretación incorrecta" por V02.4 — ver §5.)*

**Bug real: hora en 24h — el problema era el `<input type="time">` nativo, no el dato.** El valor interno siempre fue 24h; lo que se veía mal era el RENDERIZADO nativo del control, que en iOS/Safari sigue el idioma/región del dispositivo, no el `lang="es"` del documento. **Fix:** Hora deja de ser `<input type="time">` y pasa a un campo de texto enmascarado (`maskManualTimeInput`/`normalizeManualTimeOnBlur`), lo que además resolvió como efecto colateral la diferencia de tamaño/baseline entre Fecha y Hora (antes con chrome interno distinto).

**Hallazgo de proceso:** al escribir el test de "un observado no suma actividad propia" se descubrió que NINGUNA función de `player-home.js` filtra participación por su cuenta — todas asumen que `matches` ya viene filtrado por `PH.filterMatchesForPlayer` (el único punto real de la app que decide propio/observado). No era un bug de producción (`app.js:renderPlayerHome` siempre filtraba correctamente) — se corrigió el TEST para ejercitar el camino real.

**Otros cambios:** color contextual del selector (celeste Compañero/Equipo A, magenta Rival/Equipo B) reutilizando variables existentes; pausa deliberada tras el último set ("Resultado válido" + único CONTINUAR, en vez del auto-avance directo a Confirmar que V02.2 había introducido); Confirmar partido recompuesto reutilizando la tarjeta deportiva del Resumen; sheet Fecha/Hora/Lugar con columnas simétricas; tarjeta permanente de Notas "NOTAS DEL PARTIDO · SOLO VOS" (reemplaza el link colapsable de V02.2).

**Tests:** **548/548** (535 + 13: V02.3-ACT 7 casos, V02.3-EFE 6 casos).

**Desvío de entorno:** el registro EN VIVO del Service Worker falló en esta sesión puntual con "unknown error fetching the script" — el archivo servido confirmó el `CACHE_NAME` correcto vía `curl`; documentado como limitación de sesión, no defecto de la app (mismo mecanismo ya validado en V02.2).

---

## 5. BRAMUlab V02.4 — ajuste visual corto

**Fuente:** `BRAMUlab_V02.4_Informe.md`. Commit `86e9a945a820b3ca4a2ac662eb6aa926a3853186`. Tag `BRAMUlab_V02.4`.

**Corrección explícita de V02.3:** "la implementación V02.3 con todas las barras celestes fue una interpretación incorrecta y debe reemplazarse" (cita textual del consolidado). Actividad vuelve a ser **barra apilada**: lima=victorias, gris-azulado (`--line-strong`)=derrotas, vía nueva función pura `PH.computeActivityBarSegments`, con leyenda "Ganados"/"Derrotas".

**Bug real: barra de Nivel BRAMU con posición global, no progreso decimal.** El cálculo anterior representaba la posición del nivel en el rango `[LEVEL_MIN, LEVEL_MAX]` completo, no el avance decimal dentro del nivel entero actual — 6.2 podía mostrar más de la mitad de la barra. **Fix:** `PH.levelProgressPct` nueva, con aritmética ENTERA (`Math.round(level*10)` módulo 10) para evitar el error de precisión flotante de restar decimales (`6.3-6` en JS puede dar `0.29999999999999982`). Casos exactos verificados: 6.0→0%, 6.2→20%, 6.3→30%, 6.9→90%, 7.0→0% (nuevo nivel).

**Último partido:** Surface 3 + borde lima completo (se retira el acento lateral); marcador propio (`buildLastMatchScoreHTML`, deliberadamente separado del componente canónico compartido para no arrastrar el cambio a Historial/Confirmar) a 44px con `clamp()` para anchos chicos; separador de sets blanco/900 a 0.75em; guion interior en `span` propio, 0.65em/peso 500 (nunca hereda el 900 de los números); equipos en dos líneas.

**Ajuste fino de última hora en Partido completo:** el primer intento de agrandar las pastillas SET 1/2/3 (padding `9px 16px`) dio 73×62px, más de 20% por encima de la referencia — se revirtió el padding a `7px 14px` y se dejó crecer SOLO la tipografía, dando 69×57px, más ajustado al objetivo.

**Sheet compacto:** nueva clase reutilizable `.bottom-sheet--compact` (`clamp(280px,35dvh,340px)`) aplicada a "Registrar partido" — medido en vivo en 305.9px sobre 874px (35% exacto).

**Tests:** **558/558** (548 + 10: V02.4-NIVEL 6 casos, V02.4-ACT-SEG 4 casos).

---

## 6. BRAMUlab V02.5 — integración visual + UX de carga manual y resumen

**Fuente:** `BRAMUlab_V02.5_Informe.md`. Commit `e85de14f2177e699ba17eb3356c43a3664359f88`. Tag `BRAMUlab_V02.5`.

**Investigación de fechas (obligatoria antes de tocar UI):** se confirmó que el fix de V02.1 (`localDateInputValue`/`localTimeInputValue`) seguía vigente y correcto — no había bug nuevo ni reintroducido. **Conclusión:** los partidos con fecha rara que veía el usuario eran datos VIEJOS, cargados ANTES del fix de V02.1, nunca migrados con retroactividad — decisión correcta entonces y ahora, sin migrar nada ("no inventar migraciones"). **Endurecimiento igual aplicado:** se extrajo `ML.buildPlayedAtFromLocalFields(dateVal,timeVal)` (pura, construye el instante por componentes numéricos, nunca por concatenación de string), reemplazando 3 call-sites duplicados. **Efecto colateral corregido de paso:** "Modificar" sobre un partido ya guardado no actualizaba el campo `timeZone` del registro (solo la creación lo hacía) — corregido por prolijidad, sin impacto práctico en un único dispositivo sin cambio de huso.

**Hallazgo real: 24 reglas con colores de equipo hardcodeados en RGB** que no habrían heredado el cambio de la nueva dupla cromática por no pasar por `var()` — sweep completo de los literales (`45,156,255`/`255,62,165`/`200,255,61`/`50,215,255`/`51,166,255`, este último un typo de paleta preexistente) al nuevo RGB.

**Hallazgo real: "Partidos totales" desalineado del resto de KPIs.** Era la única de las 4 tarjetas de "Tu historial" sin el wrapper `.pastilla__title-row` (que aporta la altura del chevron en las otras 3), dejando su dato principal arrancando en una Y distinta. Corregido agregando el wrapper.

**Hallazgo real: ícono de Historial indistinguible.** Dibujaba la manecilla como un sub-path UNIDO (mismo color) al círculo sólido — sin contraste posible, se veía como una mancha lisa. Reemplazado por trazo (círculo+manecillas).

**Hallazgo real: Hora siempre 8px más abajo que Fecha.** `.field + .field{margin-top:8px}` (pensada para formularios apilados) alcanzaba también a Fecha/Hora por ser hermanos ADYACENTES en el DOM, aunque visualmente en una fila flex — corregido anulando el margin dentro de `.manual-datetime-row`.

**Hallazgo real: hueco grande entre nombre y resultado en el Resumen.** `.result-card__name{flex:1}` + `justify-content:space-between` empujaban el marcador al borde derecho de la tarjeta con nombres cortos. **Fix:** `flex:0 1 auto;max-width:62%` + `justify-content:flex-start` (esto sería, a su vez, la semilla de la regresión de columnas que V02.6 tendría que corregir con grid — ver §7).

**Rediseño del selector de jugador:** sheet `.bottom-sheet--tall` (72dvh, categoría nueva, nunca confundida con `.bottom-sheet--compact`), campo de búsqueda completo con foco CONTEXTUAL verde/azul (decisión documentada: el consolidado pedía "azul BRAMU" fijo, se interpretó como el color del rol activo, preservando el sistema ya aprobado de V02.3 en vez de aplanarlo), filas `.player-row` con avatar+nombre+`@handle` compartidas por RECIENTES y TODOS.

**Nueva dupla cromática:** `--brand-lime:#95FF19`/`--accent-cyan:#19BAFF`, `--team-a/b` como alias directos, magenta retirado del sistema de equipos. `--court-surface`/`--court-surface-2` redefinidos SOLO dentro de `.view--court` (no en `:root`) para no aclarar de más todos los sheets que comparten esas variables.

**Guardado sin fricción:** Notas deja de ser paso obligatorio — se elimina la tarjeta de notas completa de `view-match-saved`; guardar va directo a Resumen. Textos técnicos ("PARTIDO CARGADO", "los datos viven en este dispositivo") retirados del Resumen (no de Historial, que sí los conserva).

**Tests:** **565/565** (558 + 7: V02.5-FECHA, round-trip de `buildPlayedAtFromLocalFields` incluyendo el caso 23:30 del bug histórico de V02.1, bordes de año nuevo/fin de año).

---

## 7. BRAMUlab V02.6 — corrección visual + regresiones de layout

**Fuente:** `BRAMUlab_V02.6_Informe.md`. Commit `59a978e4677f62e2741bda4ecb828475be9bfd22`. Tag `BRAMUlab_V02.6`.

**Prioridad crítica — causa exacta de la regresión de Confirmar partido/Resumen.** V02.5 había armado `.result-card__row` como flex (`justify-content:flex-start`, nombre `flex:0 1 auto;max-width:62%`, sets `flex:none` después) para pegar el resultado al nombre. El problema no anticipado: en flex, el bloque de sets arranca justo después de donde termina la caja del nombre — con "Equipo A" corto ("Yo") y "Equipo B" largo, cada fila tenía un ancho de nombre distinto, así que las columnas de set de una fila NO quedaban alineadas con las de la otra. **Fix:** grid de 2 columnas (`minmax(0,1fr) auto`), con `.result-card__sets` fijando cada set en un track de ancho FIJO (`grid-auto-columns:28px`, 32px en Confirmar) — el ancho de la columna `auto` ya no depende del nombre, solo del número de sets, así que arranca en la misma X en ambas filas sin importar el largo del nombre. Sets/Games ganados: columnas laterales de `auto` (variable según dígitos) a `44px` fijos, con `min-height:44px`.

**Implementación final del score dash/dot — dejar de depender del glifo.** V02.5 había compensado con `vertical-align:middle`, pero seguía siendo una aproximación tipográfica imperfecta a distintos tamaños de `clamp()`. **Solución:** `buildLastMatchScoreHTML` arma cada número en su propio `<span>`, y el guion/punto como `<span>` VACÍOS (`aria-hidden`) que son barras/puntos geométricos reales (`background:currentColor`). El contenedor pasa a `inline-flex;align-items:center` — el centrado es de LAYOUT, no de tipografía. Se agregó `buildLastMatchScoreLabel` (texto plano equivalente) como `aria-label`, ya que los separadores dejaron de llevar un carácter anunciable.

**Sistema cromático:** azul `#19BAFF`→`#199FFF` arrastrando toda la familia (deep, focus, glows, sombras) + sweep de 11 hardcodes RGB equivalentes que habían quedado de V02.5 (mismo patrón de hallazgo que esa ronda tuvo con el verde); `--text` → `#F8FAFC`.

**Otros ajustes:** degradé del Home con tope más oscuro (`#08121E`, antes `--surface-2` demasiado claro); glow leve en Actividad/Efectividad/Último partido (sin engrosar el borde a 2px); tarjeta de insight con borde completo azul + glow (antes borde lateral de 3px); menos aire muerto entre la barra de Nivel y el conteo de partidos (margin-top redundante retirado); "Tu momento" con más peso/contraste; copy de Efectividad → "22 ganados de 32 jugados"; botón "Agregar sin cuenta" de relleno a outlined; sheet Fecha/Hora/Lugar con tipografía un escalón más chica y más aire.

**Tests:** **565/565** (sin cambios — ronda mayormente CSS/copy, sin lógica pura nueva).

---

## 8. BRAMUlab V02.7 — afinación visual + dinámica de Home + unificación de fondos

**Fuente:** `BRAMUlab_V02.7_Informe.md`. Commit `f7896315dc264118c4f35e9c24e893d2b579deb6`. Tag `BRAMUlab_V02.7`.

**Fondo unificado:** nuevo token `--bg-gradient-app` (mismos 3 stops que el Home pero con `--surface-1`) aplicado a Historial/Ranking/Perfil/Compañeros-Rivales/Resumen (`.view--analysis, .view--history`) y a Carga manual/Confirmar partido (`.view--court`) — Home mantiene su propio degradé, verificado con computed style idéntico byte a byte entre las 6 pantallas.

**Actividad — cambio de modelo temporal, con bug real encontrado y corregido antes de publicar.** Nueva `startOfWeekMonday(date)` (medianoche LOCAL del lunes de la semana, usando getters locales — mismo criterio "fecha siempre local" desde V02.1/V02.5) y `computeActivityWeeks4(matches, playerName, nowDate)`. **Bug:** la primera versión armaba el array `[3,2,1,0].map(...)` (ya en orden correcto) y le aplicaba un `.reverse()` de más — la semana ACTUAL caía en el índice 0 (izquierda) en vez del 3 (derecha), exactamente al revés de lo pedido. **Detectado por los tests nuevos (`V02.7-ACT`, 3 fallos) antes de cualquier validación visual** — se quitó el `.reverse()` sobrante.

**Bug real / hallazgo de contradicción: Efectividad NO era histórica total pese a decírselo así.** El consolidado pedía "mantener Efectividad como histórica total... si ya es ese comportamiento" — no lo era: `computeEffectiveness30d` (vigente desde V02.1 hasta V02.6) SÍ recortaba a los últimos 30 días (`if (age<0||age>THIRTY_DAYS_MS) return`), confirmado en código y por el propio test `V02.3-EFE · un partido de 31 días no modifica el porcentaje` (que se volvía exactamente lo OPUESTO de lo correcto y se eliminó). Autorizado explícitamente por el propio consolidado ("lógica histórica de Efectividad salvo confirmar que sea total"), se reemplazó por `computeEffectivenessTotal(matches, playerName)`, sin ventana de tiempo. **Consecuencia necesaria no prevista explícitamente pero indispensable:** el drill-through de Efectividad (Home→Historial) pasó de `filterMatchesWithin30d` a `filterMatchesWithDefinedResult` para no dejar una inconsistencia entre lo que el % mostraba y lo que el filtro abría.

**Decisión de implementación sobre reentrada:** entre "limitar a la primera entrada" o "duración corta al reingresar" (ambas ofrecidas por el consolidado), se eligió un flag de sesión `homeEnteredThisSession` — más simple de razonar. **Esta decisión sería explícitamente revertida por V02.8** (ver §9): el consolidado siguiente pidió que las animaciones corrieran en CADA entrada, no solo la primera de la sesión.

**Microanimaciones de entrada:** Nivel (`transition:width` con reflow forzado), Actividad (`transition:height` + `transition-delay` inline por índice), Efectividad (reutiliza la `transition:stroke-dasharray` ya existente). Doble capa de `prefers-reduced-motion`: colapso CSS de `--motion-base/fast` a 1ms + chequeo JS explícito (necesario porque el stagger de Actividad usa `transition-delay` inline, que no depende de esas variables).

**Tests:** **571/571** — 565 preexistentes + 12 nuevos `V02.7-ACT` (semanas calendario) + 4 nuevos `V02.7-EFE` (efectividad total) + adaptaciones de `V02.1-M`/`V02.3-ACT`/`V02.3-EFE` a la nueva función/ventana, con 1 test eliminado por quedar exactamente contradicho por el nuevo comportamiento (ver arriba).

**Limitación de entorno documentada:** no fue posible emular `prefers-reduced-motion:reduce` con las herramientas de esta sesión — verificado por lectura de código (doble capa) en vez de captura en vivo.

---

## 9. BRAMUlab V02.8 — cierre de la etapa de afinación visual

**Fuente:** `BRAMUlab_V02.8_Informe.md`, más `BRAMUlab_V02.8_Consolidado.md` y `BRAMUlab_V02.8_Auditoria_Visual_CSS.md` como documentos de referencia. Commit `fe8c6be4443d44059b739fe2c74e625e33d52987`. Tag `BRAMUlab_V02.8`.

**Reversión explícita de la decisión de V02.7 sobre reentrada:** se retira el flag `homeEnteredThisSession` — `shouldAnimate` pasa a recalcularse en cada llamada a `renderPlayerHome()`. Se encontraron además 2 call-sites reales que rompían esto silenciosamente: los botones "Volver" de Ranking y Perfil llamaban `showView('player-home')` directo (sin re-render) en vez de `openPlayerHome()` — corregidos para usar la función que sí re-renderiza.

**Bug real: glow de Efectividad rectangular.** El `drop-shadow` de V02.7 generaba una percepción rectangular/cuadrada (un filtro rasterizado por bounding box, no por forma) y en iPhone casi no se veía. **Fix:** segundo `<circle>` (`.effectiveness-donut__glow`) dibujado DETRÁS del trazo principal en el mismo SVG, mismo `cx/cy/r`, trazo más grueso (7px vs 3px), opacidad baja (.45), `filter:blur(2.5px)` — un blur sobre una forma YA trazada sigue la curva, nunca encuadra en un rectángulo. Verificado por computed style: `stroke-dasharray` del glow idéntico al del trazo principal en todo momento.

**Radios normalizados (casos verificables 1:1, sin homogeneizar familias):** `.court-team-card__player` 11px→12px; 6 literales `16px` migrados a `var(--radius-card)`; 2 literales `18px` migrados a `var(--radius-hero)`.

**Limpieza CSS segura:** eliminado el duplicado exacto `.status-banner`/`.band-seg` (bloque "V5", 19 líneas, byte-idéntico al bloque "V7" que lo sucedía y ya ganaba la cascada). Eliminadas ~85 líneas de CSS muerto de la vieja pantalla "Resumen inmediato" (`.view--summary`, `.summary-card*`, `.summary-stats`, `.summary-actions` — la pantalla fue retirada en V02.1 y el CSS nunca se limpió), confirmado por grep sin referencias activas; se conservó `.summary-undo-btn` (reutilizada en Resumen).

**`.overlay--highlight` corregido** de `rgba(11,18,17,0.55)` (negro-verdoso pre-V02, el mismo bug que V02.1 §28 ya había corregido en el resto de overlays pero que había quedado fuera de aquel barrido porque este popup no usa la clase base `.overlay`) a `var(--scrim)`.

**`.overlay__title`** de `letter-spacing:0.1em` a `0.03em` para toda la familia de ~18 modales (Notificaciones, Pausa, Finalizar partido, ¿Quién sos?, etc.) — no solo el caso puntual reportado.

**Setup finalmente recibe `--bg-gradient-app`** — última pantalla funcional que quedaba con el `--ink` plano heredado.

**Resumen — ritmo vertical:** `.analysis-meta{margin-bottom}` 4px→14px; `.analysis-section{margin-bottom}` 26px→12px (16px vía overrides puntuales por ID antes de Momentos clave y de Notas privadas, únicos 2 puntos con "cambio real de bloque").

**Decisión sobre una tensión aparente:** el consolidado lista "carga manual"/"Confirmar partido" en su categoría general de "mantener sin cambios" (§14), pero pide puntualmente 2 cambios dentro de esas mismas pantallas (texto del botón "Agregar sin cuenta", radio de `.court-team-card__player`). Resuelto como el patrón normal "regla general + excepción explícita nombrada" — no una contradicción real.

**Arquitectura CSS:** decisión explícita de NO modularizar (2122 líneas, sin síntomas de guerra de especificidad, casi sin `!important`) — reevaluar a las 2500-3000 líneas o al sumar una feature grande.

**Tests:** **571/571** (sin cambios — ronda de CSS/wiring de animación, sin lógica pura nueva). Verificación empírica con `MutationObserver({attributeOldValue:true})` confirmó la secuencia `valor final→0→valor final` en una SEGUNDA entrada al Home (Home→Ranking→Volver), probando que la reentrada sí re-anima.

---

## 10. BRAMUlab V02.8.1 — calibración visual (7 puntos)

**Fuente:** `BRAMUlab_V02.8.1_Informe.md` (sin Consolidado propio — instrucciones dadas directamente en el chat). Commit `0851022c89874e4375cf31beaac8d034d15c1450`. Tag `BRAMUlab_V02.8.1`.

**Hallazgo técnico no anticipado: la curva de easing, no solo la duración, era la causa de que las animaciones no se percibieran.** Con `--home-anim-level`/`--home-anim-effectiveness` ya en 550-750ms, Nivel y Efectividad seguían sin percibirse. Investigado estirando la duración a 4000ms de forma temporal y midiendo `scaleX`/`stroke-dashoffset` real en checkpoints: con `--motion-ease` (`cubic-bezier(0.32,0.72,0,1)`, la curva compartida de sheets/tabs/hover), el recorrido visual llegaba a ~95-100% dentro del primer 20-25% del tiempo — a cualquier duración configurada, la parte perceptible ocurría en los primeros ~150-200ms. **Fix:** `--home-anim-ease:ease-out` nueva, exclusiva de las 3 animaciones de entrada, sin tocar `--motion-ease` (que sigue gobernando el resto de la UI). Repetido el experimento con `ease-out`: crecimiento genuinamente repartido a lo largo de toda la duración (`scaleX` 0→0.395→0.698→0.915→1.0 en checkpoints de 1/2/3/5s sobre 4000ms).

**Nivel BRAMU — técnica reemplazada.** De transición de `width` (frágil, depende de que el navegador registre un frame en 0% antes de animar) a `@keyframes playerLevelBarGrow` sobre `transform:scaleX()` con `transform-origin:left center`, disparada por clase `.is-animating` con reflow forzado. **Verificación determinística** (`Animation.currentTime` scrubbing, inmune a throttling): `scaleX` midió `0.000→0.378→0.685→0.907→1.000` en fracciones 0/0.25/0.5/0.75/1 — crecimiento monótono a lo largo de toda la duración.

**Efectividad — técnica reemplazada.** Web Animations API (`Element.animate()`) sobre `stroke-dashoffset`, con `stroke-dasharray` CONSTANTE en los tres círculos. El valor final se asigna SIEMPRE por `style` antes de animar (progressive enhancement). **Verificación en tiempo real** (una ejecución atómica sin cortes): `stroke-dashoffset` pasó por `97.3894→81.9993→60.1402→43.2435→33.2503→32.1385` (exacto para 67%) en checkpoints de una versión de prueba a 4000ms.

**Glow de Efectividad, otra vez rediseñado:** se elimina CUALQUIER `filter` (el de V02.8 seguía usando `blur()`); dos halos nuevos sin filtro (`glow-inner` 5px/.22, `glow-outer` 8px/.10) que comparten `stroke-dasharray`/`stroke-dashoffset` con el trazo principal, imposibilitando estructuralmente el efecto "caja".

**Pulso de Último partido** recalibrado a un punto intermedio entre V02.7 (muy sutil) y V02.8 (muy fuerte): reposo `0 0 18px rgba(149,255,25,.12)` → pico `0 0 25px rgba(149,255,25,.24)`.

**Hito:** `flex-basis` 86%→70% (móvil)/60%→48% (≥480px) + `min-height:2.8em` para favorecer wrap natural a 2 líneas sin salto manual — verificado con un hito real de 46 caracteres (alto medido 70px).

**Botones de Resumen** igualados (min-height 46px, mismo radio/padding) vía regla acotada a `#analysis-share-section`, sin tocar `.btn-secondary`/`.btn-start` de base.

**CTA "Agregar sin cuenta":** borde de color completo → `var(--court-line)` neutro; el contexto de equipo se reduce a un dot de 8px antes del texto; texto sigue blanco. Cambio técnico de paso: `renderManualPlayerSheetContent` pasa de `textContent` a `innerHTML` con `escapeHtml` sobre el nombre tipeado (necesario para insertar el dot).

**Limitación de entorno con hallazgo temprano no resuelto todavía:** `getAnimations()` devolvió una lista vacía para Actividad en este entorno de sesión — señal de la misma fragilidad de técnica que en V02.8.2 SÍ se manifestaría como regresión real. Como el usuario confirmó en dispositivo real que Actividad seguía animando, se dejó sin tocar por instrucción explícita, dejando la observación registrada.

**Tests:** **571/571** (sin cambios).

---

## 11. BRAMUlab V02.8.2 — calibración visual (5 puntos)

**Fuente:** `BRAMUlab_V02.8.2_Informe.md` (sin Consolidado propio). Commit `a71d2f5ee14daf73e2f662acf7286bd635936201`. Tag `BRAMUlab_V02.8.2`.

**Regresión real: Actividad dejó de animar.** Causa: la MISMA clase de fragilidad ya corregida en V02.8.1 para Nivel/Efectividad ("0 + reflow + valor final" depende de que el navegador efectivamente PINTE el frame en 0, no solo lo calcule) — en V02.8.1 Actividad todavía se percibía en la prueba real, así que se había dejado sin tocar; la señal temprana de `getAnimations()` vacío (documentada en el informe anterior) resultó ser la advertencia correcta. **Fix:** mismo patrón que Nivel — `@keyframes activityBarGrow` sobre `transform:scaleY(0→1)`, más simple de aplicar porque cada barra es un elemento NUEVO en cada render (la clase viaja incluida desde el HTML, sin necesitar la danza de sacar/reflow/volver a poner). Verificado: `getAnimations()` ahora devuelve exactamente 1 `Animation` por barra (antes 0).

**Efectividad, estado estático refinado.** La animación ya funcionaba; el problema era que el estado FINAL se veía "tosco/pesado" con brillo casi imperceptible. **Insight del ajuste:** no era falta de opacidad — dos halos apilados (5px/.22 + 8px/.10 sobre un trazo de 3px, los tres centrados en la misma línea) sumaban un degradado escalonado de grosor que LEÍA como un aro borroso. Se afinaron a la vez trazo (3px→2.5px) y halos (interno 4px/.30, externo 6px/.18) — angostar y subir opacidad a la vez evita que el conjunto se vea más ancho.

**Hito** reducido ~15% más (70%→60% móvil, 48%→40% desktop).

**Tracking del botón "ACTUALIZAR" del aviso de actualización.** Diagnóstico primero, no asumido: `.overlay__title` de ese modal YA estaba en 0.03em (fijado en V02.8) — el elemento realmente desalineado era el botón `#update-now-btn`, que hereda `.btn-start{letter-spacing:0.08em}`, un valor nunca tocado por las correcciones de tracking anteriores (que solo tocaron `.overlay__title`). Fix acotado por ID, sin tocar la clase compartida `.btn-start` (que sigue en 0.08em en Setup/Resumen/otros overlays, fuera de alcance).

**Sin cambios confirmados:** Último partido, botones de Resumen, CTA "jugador sin cuenta".

**Tests:** **571/571** (sin cambios).

---

## 12. BRAMUlab V02.8.3 — corrección puntual de Efectividad

**Fuente:** `BRAMUlab_V02.8.3_Informe.md` (sin Consolidado propio). Commit `db00447a4411339c232314a9aa2399275e839b0a`. Tag `BRAMUlab_V02.8.3`.

**Bug real, no solo un ajuste de valores: `renderPlayerEffectiveness` forzaba `style.opacity='1'` inline sobre los TRES círculos del donut por igual** — incluidos los dos halos, que tenían su propia opacidad baja definida en CSS. Un estilo inline siempre gana sobre una regla de clase: **los halos venían renderizando a opacidad TOTAL desde que existen (V02.8.1)**, nunca a la opacidad sutil que describían los informes de V02.8.1/V02.8.2 — el "brillo bajo" documentado en esas rondas nunca llegó a verse así en pantalla. Esta es la causa real de que el ring se sintiera pesado pese a dos rondas previas de ajuste de valores.

**Fix:** trazo principal sigue forzado a `opacity:1` (siempre opaco por diseño); los dos halos se limpian a `style.opacity=''` en vez de `'1'`, dejando que su opacidad de CSS se aplique de verdad. Con el bug corregido, se recalibraron los valores DESDE CERO (los de V02.8.2 no eran representativos, elegidos con el bug activo): trazo principal/aro de fondo 2.5px→**1.5px**; halo interno 4px/.30→**2.5px/.38**; halo externo 6px/.18→**3.5px/.24**.

**Verificado:** `getComputedStyle` de los halos ahora informa `opacity:0.38`/`0.24` (antes del fix, informaba `1` sin importar qué se pusiera en CSS).

**Tests:** **571/571** (sin cambios — ~15 líneas entre `app.js`/`styles.css`).

---

## 13. BRAMUlab V02.9 — refinamiento visual/UX de cinco componentes

**Fuente:** `BRAMUlab_V02.9_Informe.md`. Commit `f19c0207d2e5bef9ce74a70e2a19733f0a8a809b`. Tag `BRAMUlab_V02.9`.

**Efectividad, otra vez.** Aun sin ningún `filter`, DOS halos apilados (2.5px/.38 + 3.5px/.24 sobre un trazo de 1.5px, todos centrados en la misma línea) producían un degradado escalonado de grosor/opacidad que LEÍA como un aro borroso — el problema visual era real incluso sin blur de por medio. Se retira un halo entero: queda el trazo (1.5px, sin cambios) + UN único refuerzo (2.2px, opacidad 0.16).

**Alta de jugador sin cuenta — rediseño completo.** Se retira el botón CTA de ancho completo; nueva `buildAddPlayerRowHTML` genera una fila `.player-row.player-row--add` (MISMO componente que una fila de jugador real) con ícono circular persona+ (SVG, sin iniciales) y texto `Agregar a "X"` (sin la coletilla "como jugador sin cuenta") como ÚLTIMO elemento de la lista de búsqueda, después de los jugadores reales — conviven en una sola lista. "Sin coincidencias" solo aparece cuando NI hay jugadores reales NI se puede ofrecer el alta.

**Contradicción real detectada y resuelta: badge de Último partido.** El consolidado daba por sentado que el badge superior ya decía `VICTORIA`/`DERROTA` completo ("mantener... en zona superior") — el código real lo tenía ABREVIADO a `VIC`/`DER` desde V02.5 (§20 de ese informe). Como el propio §4 de este MISMO consolidado pide explícitamente la palabra completa para Historial y el principio rector de la ronda es que ambos compartan lenguaje, dejar Último partido abreviado mientras Historial usa la palabra completa habría creado la inconsistencia opuesta a la buscada — se corrige también acá (`VIC`→`VICTORIA`, `DER`→`DERROTA`), documentado explícitamente como discrepancia resuelta a favor de la coherencia que el propio documento pide.

**Último partido — metadata agregada:** formato/sistema reales (`E.FORMATS[...].label`/`SCORING_SYSTEM_LABELS[...]`) en dos líneas, zona inferior derecha, mismos datos que consume Historial.

**Historial rediseñado como clon compacto de Último partido:** las mismas 4 zonas (top-row fecha/hora+badge completo, score protagonista, bottom-row teams+meta). Se retira la línea de subtítulo completa junto con "PARTIDO CARGADO" — y también "POR GAMES" (mode==='games'), porque ninguno de los dos tiene equivalente en el componente madre. Se retira el botón `.history-item__delete` (✕) y el wrapper `.history-item__main` — la tarjeta vuelve a ser un solo bloque con un solo listener de click a Resumen. Funciones `deleteHistoryEntry`/`showUndoToast` eliminadas por quedar sin llamador.

**Resumen — Eliminar partido.** Nuevo botón `#analysis-delete-btn` (estilo mínimo, texto apagado) al final de `#analysis-share-section`. Reutiliza el modal de confirmación GENÉRICO ya existente (`confirmAction`/`#confirm-overlay`) extendido con parámetros opcionales `acceptLabel`/`cancelLabel` (sin afectar a los 5 llamadores previos que no los pasan). Llama a `Store.removeFromHistory(matchId)` (misma función que ya usaba la X retirada de Historial).

**Tests:** **571/571** (sin cambios — ronda entera de DOM/CSS).

---

## 14. BRAMUlab V02.9.1 — micro-ajuste visual (3 puntos)

**Fuente:** `BRAMUlab_V02.9.1_Informe.md` (sin Consolidado propio). Commit `0d2f6c82b0c3e58812495e49b6dcc00868e3656e`. Tag `BRAMUlab_V02.9.1`.

**Efectividad:** trazo principal/aro de fondo 1.5px→**2px**; halo escalado en la misma proporción (2.2px→2.7px) para conservar el margen relativo (~0.35px por lado) — si se hubiera dejado en 2.2px, el trazo más grueso lo habría tapado casi por completo. Opacidad del halo sin cambios (0.16).

**Último partido:** `.player-home-lastmatch__top` pasa de layout de 2 columnas a 2 FILAS apiladas: fila 1 (título+fecha/hora), fila 2 (forma+badge). Se retira la clase `.player-home-lastmatch__heading` (sustituida por las 2 filas).

**Historial — cambio de criterio de color, no solo de peso.** `.history-item__teams` baja de peso 800 a 700 + color `--paper-dim` como base. Más importante: en partidos PROPIOS, se deja de colorear al equipo GANADOR (`m.winnerTeam`, redundante con el badge de arriba) y pasa a colorearse la pareja PROPIA (`PH.getPlayerTeam`) — sigue "destacada" pero ya no duplica la señal del badge. Verificado con 2 partidos reales contra los mismos rivales (uno ganado, uno perdido): en AMBAS cards la pareja propia queda en lima/azul, confirmando que el color sigue a "propia", no al ganador. En Observados (sin badge propio) se mantiene sin cambios, coloreando al ganador junto con "GANÓ".

**Tests:** **571/571** (sin cambios).

---

## 15. BRAMUlab V02.9.2 — ajuste de un valor

**Fuente:** `BRAMUlab_V02.9.2_Informe.md` (sin Consolidado propio — Sebastián probó el valor en vivo con el inspector de Chrome sobre la app publicada). Commit `c9bbbd0a10a871560dc1c8d863765e98a7eb540a`. Tag `BRAMUlab_V02.9.2`.

Trazo principal del donut de Efectividad 2px→**3px**; halo reescalado en la misma proporción (2.7px→3.7px, mismo margen relativo de ~0.35px por lado); opacidad del halo sin cambios (0.16) — el pedido era pura presencia del trazo, no del brillo.

**Tests:** **571/571** (sin cambios — un solo valor de CSS).

---

## 16. BRAMUlab V02.9.3 — dos ajustes finales

**Fuente:** `BRAMUlab_V02.9.3_Informe.md` (sin Consolidado propio). Commit `9653c748f2ce2e789de1eda9079c63dd9f8f60c4`. Tag `BRAMUlab_V02.9.3`.

**Historial — jerarquía final: se retira TODO color de énfasis.** Ni al equipo ganador (ya sin uso desde V02.9.1) ni a la pareja propia (la variante que sí seguía activa desde V02.9.1) — el badge `VICTORIA`/`DERROTA`/"GANÓ" ya comunica el resultado, una segunda señal de color en los nombres quedaba redundante. Se retiran las clases `.history-item__winner--a/-b` y `.history-item__mine--a/-b` de CSS y su cálculo en `app.js`. En paralelo, `.history-item__score` sube de 20px a **30px** (el dato más grande de la card, sin ambigüedad) y `.history-item__teams` baja a 13px/500 (antes 14px/700). Verificado con 2 partidos reales (uno ganado, uno perdido) contra los mismos rivales: ambas cards con el mismo tratamiento neutro en los nombres, sin distinción alguna entre sí.

**Último partido:** `.player-home-lastmatch__row1` (título+fecha, la línea 1 introducida en V02.9.1) baja su `margin-bottom` de 10px a **3px**, acercándola a la línea 2 — se leen como un solo encabezado compacto.

**Tests:** **571/571** (sin cambios).

---

## 17. Contradicciones entre rondas — cómo se resolvieron

Repaso explícito de los casos donde una ronda contradijo o revirtió una decisión previa, señalados por transparencia (cada uno ya fue resuelto dentro de su propia ronda, listados acá como antecedente):

1. **Actividad, dos veces reinterpretada.** V02.3 pintó todo el volumen en celeste sólido; V02.4 declaró esa lectura "una interpretación incorrecta" y la revirtió a barra apilada lima/oscuro (victorias/derrotas). V02.5 además invirtió el ORDEN del apilado (victorias abajo, antes arriba). V02.7 cambió el MODELO temporal completo (de ventana rolling de 30 días a 4 semanas calendario lunes-domingo). Cada cambio está documentado y justificado en su propia ronda; no quedó ambigüedad — el estado final es el de V02.7 en adelante.
2. **Efectividad, ventana temporal.** Vigente como cálculo de 30 días desde V02.1 hasta V02.6 (con tests que verificaban explícitamente "un partido de 31 días NO modifica el porcentaje"). V02.7 la reemplazó por histórica total, encontrando que el consolidado anterior YA asumía (incorrectamente) que ya era total — se documentó como hallazgo real, no como cambio de opinión, y el test viejo se eliminó por quedar exactamente contradicho.
3. **Badge de resultado, abreviado vs. completo.** V02.1/V02.2 introducen `VIC`/`DER` para Historial y Último partido. V02.9 revierte a `VICTORIA`/`DERROTA` completo en AMBOS componentes, citando su propio criterio de "evitar abreviaturas si el espacio permite la palabra completa" y notando explícitamente que el consolidado de esa ronda daba por sentado (incorrectamente) que Último partido ya estaba completo.
4. **Color de énfasis en los nombres de Historial — tres etapas.** Originalmente coloreaba al equipo GANADOR. V02.9.1 lo cambió a colorear a la pareja PROPIA (evitar redundancia con el badge). V02.9.3 removió TODO color de énfasis (ni ganador ni propia) — decisión final, con el resultado (30px) como único protagonista.
5. **Reentrada de animaciones del Home — una vez por sesión vs. siempre.** V02.7 decidió, entre dos opciones que el propio consolidado ofrecía, un flag de sesión ("una vez"). V02.8 pidió explícitamente que corrieran en CADA entrada — revirtiendo esa elección, y de paso encontrando 2 call-sites (los botones "Volver" de Ranking/Perfil) que ni siquiera re-renderizaban.
6. **Glow/halo de Efectividad — la saga más larga de la línea.** V02.6 introdujo un `drop-shadow` casi invisible; V02.7 lo hizo más visible; V02.8 lo reemplazó por 2 círculos concéntricos con `filter:blur()` (para evitar el efecto "caja" del drop-shadow); V02.8.1 eliminó el filtro por completo (2 halos sin blur); V02.8.2 afinó proporciones; **V02.8.3 encontró el bug real** (opacidad de los halos forzada a 1 por un `style.opacity='1'` inline que ganaba sobre cualquier valor de CSS, activo desde V02.8.1) y recién ahí los valores de halo tuvieron efecto real; V02.9 encontró que incluso sin filtro, DOS halos apilados seguían leyendo como "borroso" por el degradado de grosor/opacidad, y quedó en UN solo halo; V02.9.1/V02.9.2 subieron el trazo principal en dos pasos más (1.5px→2px→3px) tras pruebas en vivo de Sebastián con el inspector de Chrome. El estado final (V02.9.2 en adelante) es: trazo 3px, un halo de 3.7px/opacidad 0.16, sin ningún filtro.
7. **Notas del partido — de paso obligatorio a opcional posterior.** V02.1 las incluía como campo dentro de "Confirmar partido" (antes de guardar). V02.2/V02.3 fueron variando su presentación (link colapsable → tarjeta permanente). V02.5 las sacó por completo del camino obligatorio de guardado, moviéndolas a un ítem opcional dentro del Resumen, ya con guardado directo. Este es el estado vigente.

---

## 18. PWA — patrón de versionado (constante en las 16 rondas)

Cada ronda siguió el mismo patrón, sin excepciones: `Store.VERSION`/`version.json` actualizados al nombre de versión visible ("BRAMUlab V02.X"), y `sw.js`/`CACHE_NAME` con un bump técnico — incluso en rondas donde `sw.js` no cambiaba de bytes, porque sin ese bump un cliente con la caché vieja ya instalada nunca detecta el service worker nuevo por sí solo (lección aprendida explícitamente durante el "Ajuste visual de cierre 01" de V02 base, y repetida sin excepción desde entonces). El tag técnico de git para cada ronda sigue el naming oficial `BRAMUlab_V02[.N[.N]]`, nunca una numeración paralela `vN.N` — regla establecida tras el error de nombrado del tag `v3.0` en la publicación original de V02 base, corregido en el mismo "Ajuste visual de cierre 01".

---

## Estado al cierre

BRAMUlab_V02 cierra en **V02.9.3** (tag `BRAMUlab_V02.9.3`, commit `9653c748f2ce2e789de1eda9079c63dd9f8f60c4`), con **571/571 tests** verdes desde V02.7 en adelante. Ninguna ronda de esta línea tocó `engine.js` (reglas deportivas) más allá de la función pura `isValidFinalTiebreakScore` (V02.1) ni el motor de `stats.js`/BRAMU Intelligence más allá de `classifyWonLostWonPattern` (V02.1) — ambas agregadas, nunca reemplazando lógica existente. `styles.css` permanece como un único archivo (decisión explícita de no modularizar hasta señales concretas, fijada en V02.8). El siguiente bloque de producto anunciado explícitamente al cierre de V02.8 es el **rediseño funcional de Historial** (distinto del alineamiento puramente visual que V02.9 ya le dio con Último partido).

Los documentos originales de cada ronda (citados arriba por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Informe no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).
