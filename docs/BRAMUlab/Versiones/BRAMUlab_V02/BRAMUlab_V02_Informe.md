# BRAMUlab_V02
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 03/09/2026.
**Base:** BRAMUlab_V01 en `v2.2.1` (commit `910975f`).
**Commit de implementación:** `91a79f8`. **Tag:** `v3.0` (el tag técnico sigue la numeración de git existente — v1.1…v2.2.1 — separado del naming visible de producto, que a partir de esta ronda es "BRAMUlab V02", no un número de versión; ver §5 de este informe).
**Estado:** publicado en producción.

---

## 1. Correcciones documentales previas (commit `a3f4907`)

Antes de implementar se aplicaron las 4 correcciones puntuales pedidas al `BRAMUlab_V02_Consolidado.md`: `privateNote` reclasificado de AGREGAR a CONSERVAR Y FUSIONAR (ya existía desde V01, solo se rediseña su presentación); "Entrega esperada" ahora apunta a `BRAMUlab_V01_Informe.md` en vez de "revisar informes de v2.2/v2.2.1"; versión visible fijada como texto de producto "BRAMUlab V02"; deliverable de este informe con ruta explícita. Detalle completo del diff en el propio consolidado.

---

## 2. Qué se reemplazó globalmente (tokens)

**Tipografía.** `Oswald` + `Manrope` → **Inter** (pesos 400–900) como única familia, cargada por `@import` de Google Fonts (mismo mecanismo que ya usaba la app — ver desvío justificado en §7). `--font-display` y `--font-body` se mantuvieron como nombres de variable para no reescribir ~40 referencias existentes; ambas apuntan a Inter ahora.

**Paleta.** Se centró en `:root` (`styles.css`) el set de tokens que pide el consolidado (`--bg-deep/--bg/--surface-1/2/3`, `--text/--text-dim/--text-faint`, `--brand-lime/--brand-lime-deep/--accent-cyan`, `--team-a/--team-a-deep/--team-b/--team-b-deep`, `--line/--line-strong/--scrim`, `--radius-card/--radius-hero/--radius-control/--radius-pill`, `--motion-fast/--motion-base/--motion-ease`). Los nombres de variable **viejos** (`--ink`, `--ink-soft`, `--ink-softer`, `--paper`, `--paper-dim`, `--paper-faint`) se conservaron como **alias** apuntando a los nuevos valores (`--ink: var(--bg)`, etc.) — decisión técnica explícita: la mayoría de las ~1600 líneas de `styles.css` ya usaba estas variables de forma consistente, así que redirigir su valor cambia la paleta de casi toda la app sin tener que tocar cada regla una por una. La paleta `--court-*` (marcador/carga manual, Etapa 4.2) se fusionó del mismo modo: dejó de tener valores propios y ahora es alias del sistema global (`--court-bg: var(--bg)`, etc.), cumpliendo el pedido de FUSIONAR sin reescribir sus ~40 usos.

**Motion.** `--sheet-duration-enter/--sheet-duration-level/--sheet-ease` (ya existentes, usados por todas las hojas inferiores) pasaron a ser alias de los nuevos `--motion-base/--motion-fast/--motion-ease`, evitando dos sistemas de timing paralelos.

---

## 3. Reclasificación de color — la parte que no era un simple find-and-replace

Repintar `--team-a`/`--team-b` a azul/magenta de forma ciega habría roto la app: en el código anterior, **lima (`--team-a`) cumplía doble función** — color real de Equipo A en el marcador/estadísticas, y acento genérico de "acción/identidad/progreso" en el Home/Historial/Perfil (nav activo, barra de progreso del Nivel BRAMU, donut de efectividad, badges de victoria, etc., todos escritos como `var(--team-a)` porque lima ya era, de hecho, el único acento fuerte de la app). El consolidado separa esos dos roles explícitamente (§2.2, §2.4), así que se auditó **línea por línea** cada uso de `var(--team-a)`/`var(--team-b)` y de sus literales `rgba(200,255,61,…)`/`rgba(51,166,255,…)` asociados (glows, gradientes) en `styles.css`, y se clasificó cada uno:

- **~32 usos genuinamente de equipo** (setup, marcador en vivo, banda de estado, editores Ajustar/Corrección rápida, `result-card`, estadísticas comparativas, Timeline, Historial ganador, y los jugadores de "Tu equipo"/"Rivales" en carga manual) → quedaron en `var(--team-a)`/`var(--team-b)`, que ahora resuelven a azul/magenta.
- **~38 usos que en realidad eran acento de marca** (nav inferior activo, tarjeta de perfil, barra de Nivel BRAMU, Actividad/Efectividad, badges de victoria/racha, hoja "Registrar partido", banner de partido en curso, teclado numérico, evolución del Nivel BRAMU en Perfil, wordmark de Compartir) → reclasificados a `var(--brand-lime)`, que conserva el HEX exacto que ya tenían (`#C8FF3D`), así que no hubo que tocar los literales `rgba(200,255,61,…)` de esos casos — solo el nombre de variable.
- Los `rgba(...)` de **glow que sí eran de equipo** (ej. el brillo del `team-zone` al marcar punto, los `@keyframes teamBannerPulseSetA/B`/`MatchA/B`) se recalcularon al nuevo RGB de azul/magenta (`45,156,255` / `255,62,165`).
- Caso particular verificado a mano: `.load-player-chip--fixed` (el chip "vos" fijo en Equipo A dentro de carga manual) se mantuvo en azul, no lima — es Equipo A, no un acento de identidad, aunque superficialmente parecía candidato a lima por estar en la misma zona que otros acentos.

**Dorado** se auditó con el mismo criterio: se conservó únicamente para Punto de Oro, y — por decisión de criterio, documentada acá para que se pueda objetar si no es la lectura correcta — también para **Star Point** y **Tie break**, tratándolos como la misma familia semántica de "punto/definición decisiva" que Punto de Oro (mismo tratamiento visual que ya tenían, sin fusionarlos entre sí). Todo lo demás que usaba dorado como acento genérico se pasó a lima: `btn-start` (CTA principal de Setup), `btn-mini`, el FAB "+" de la barra inferior, `overlay__title` (título de ~15 modales genéricos — Editar, Ajustar, Corrección rápida, "¿Quién sos?", etc.), selecciones de formato/puntuación, highlight popup, badges de Historial, y el wordmark de marca en las capturas de Compartir. La tarjeta "SIMULADO · BETA" de Perfil (evolución del Nivel BRAMU) se pasó a **cian** en vez de lima — no es Punto de Oro ni una acción, es información secundaria/disclaimer, que es exactamente el rol que el consolidado define para `--accent-cyan` (§2.2).

---

## 4. Iconografía

Reemplazados por SVG de trazo propio (1.75–2px, mismo lenguaje): el menú ☰ del partido en vivo, las 14 apariciones del botón cerrar ✕ (overlays y hojas inferiores — un único `replace_all` porque las 14 comparten estructura idéntica), el indicador de "quién saca" (antes 🎾, ahora un punto lima de 5-6px, mismo lenguaje que los demás indicadores de la app en vez de un emoji nuevo), el ícono del placeholder de Ranking (antes 🏆) y el ícono del anillo del popup de Highlight (antes ⭐).

**Deliberadamente sin tocar:** los emoji que aparecen dentro de *texto generado* por BRAMU Intelligence/Timeline (`⭐ Highlight guardado`, `🏆 Fin del partido…`, `✎ Ajuste de marcador`, anotaciones del gráfico de Evolución, etc., todos en `app.js`) y el prefijo 🎾 en el listado de "sugerido" del selector de sacador. Son contenido editorial generado dinámicamente, no iconografía de interfaz — tocarlos implica editar la lógica de generación de texto en `app.js`/`stats.js`, fuera del alcance de un consolidado que dice explícitamente "conservá toda la lógica funcional validada" y "no rediseñes la estructura del marcador en vivo". Si Sebastián lo prefiere, es un ajuste concreto y acotado para una ronda futura.

---

## 5. Versión visible de producto

`Store.VERSION`/`version.json`/footer pasan de `v2.2.1` a **"BRAMUlab V02"** (texto de producto, con espacio — distinto de `BRAMUlab_V02`, que es la convención de nombrado de archivos/documentos). El mecanismo de chequeo de actualización (`checkForNewVersion()` en `app.js`) compara este string por igualdad estricta contra `version.json`, así que el mensaje "X está disponible" ahora lee naturalmente "BRAMUlab V02 está disponible." El tag técnico de git para este commit es `v3.0` (continúa la numeración interna existente — v1.1 → v2.2.1 — que es historial técnico de BRAMUlab_V01/V02, no el naming visible).

`sw.js`: `CACHE_NAME` pasa de `bramulab-v2.2.1` a `bramulab-v02` (clave de caché, no necesita ser el string humano completo).

---

## 6. Otros cambios visuales explícitos del consolidado

- **Tarjeta "Último partido" del Home** pasa a tratamiento hero real (§4.3): superficie con degradado propio (`linear-gradient` de `--surface-2` a `--bg-deep`) y radio 18px (`--radius-hero`), en vez de compartir el fondo plano `--surface-1` del resto de las tarjetas — antes de este cambio, al fusionar `--court-surface` con la paleta global, esta tarjeta habría quedado visualmente idéntica a cualquier otra `.pastilla`, perdiendo la jerarquía "pieza principal del Home" que pide el consolidado.
- **BRAMU Intelligence** deja de ser un párrafo colgado (§4.6): en Análisis, el `<h3>` existente suma un ícono propio (SVG) y una frase de encuadre nueva ("Una lectura objetiva de lo que pasó en la cancha, no una planilla de estadísticas."), y el texto vive dentro de una superficie con borde/fondo propio. En Resumen (partido cargado manualmente), mismo tratamiento resuelto solo con CSS (`::before` + superficie) para no tocar el JS que ya hace `.hidden = true/false` sobre ese párrafo puntual.
- **Banda de estado por equipo** (`status-banner--team-a/b`, Break/Set/Match point): el texto hardcodeado `#0C1400`/`#041420` (pensado para el lima/celeste viejos) pasa a `var(--text)` (blanco) — más legible sobre los nuevos azul/magenta, que son menos claros que el lima original.

---

## 7. Desvíos justificados

1. **Fuente Inter vía Google Fonts CDN, no `.woff2` local.** El consolidado lo dejaba como "preferencia técnica", no obligación. Se mantuvo el mismo mecanismo (`@import`) que ya usaba la app para Oswald/Manrope — es el patrón ya probado en producción, y empaquetar el archivo variable local implicaba descargar y versionar un binario sin poder verificar su integridad/subsetting en este entorno. Si en algún momento se prioriza que la PWA cargue tipografía 100% offline, es un cambio acotado para una ronda aparte.
2. **Dorado extendido a Star Point/Tie break**, no solo a "Punto de Oro" en sentido literal — ver razonamiento en §3.
3. **Emoji dentro de texto generado (BRAMU Intelligence/Timeline) sin tocar** — ver razonamiento en §4.
4. **No se persiguió la unificación completa de radios/letter-spacing** que señala la auditoría visual pre-V02 (6 radios de tarjeta distintos, 18 valores de letter-spacing) más allá de lo que el consolidado pide explícitamente (radio base 16px/hero 18px como escala de referencia, uppercase reservado a volantas chicas). La mayoría del uppercase existente ya era en microlabels pequeños, que ya califica como "volanta" — no se encontró una violación grande de ese criterio que ameritara una pasada componente por componente con el presupuesto de esta ronda.

---

## 8. Verificación

**Tests automatizados:** 483/483 verdes, sin cambios (`tests.html`) — ninguna función pura de `engine.js`/`stats.js`/`player-home.js`/`match-load.js`/`store.js` fue tocada, solo el string `APP_VERSION` (sin lógica dependiente de su formato).

**Verificación manual**, viewport 402×874 (iPhone 16 Pro), `.claude/dev-server.py` local con un jugador identificado y un partido cargado manualmente de principio a fin (creación de 2 jugadores invitados, entrada de resultado con teclado incluyendo la validación preventiva del hotfix v2.2.1 — confirmada intacta: el teclado seguía deshabilitando dígitos imposibles según el valor ya cargado del rival), más un partido en vivo iniciado desde cero para revisar marcador/menú/banda de estado:

1. Home completo — pantalla capturada.
2. Sheet "Registrar partido" — capturada.
3. Carga manual sin teclado (resultado ya cargado) — capturada.
4. Carga manual con teclado abierto — capturada.
5. Selector de jugador (hoja "Elegir compañero", con validación de nombre duplicado intacta) — capturada.
6. Formato y puntuación — capturada.
7. Historial con pestañas y filtros (partido recién cargado, "Todos"/"Mis partidos"/"Observados" con conteos correctos) — capturada.
8. Resumen con BRAMU Intelligence (nueva superficie editorial) — capturada.
9. Partido en vivo, incluido el menú ☰ (ícono nuevo, banda "CAMBIAR", indicador de saque como punto lima) — capturada.
10. Ranking/Perfil (estado vacío de Ranking con ícono nuevo; Perfil con evolución del Nivel BRAMU y badge cian) — capturada.

Las diez se revisaron como conjunto: ninguna quedó con lenguaje verde-negro/dorado del sistema anterior ni se sintió "otra app" al pasar de una a otra.

**Persistencia:** recargando `index.html` después de cargar el partido manual, `bramulab.history.v1` seguía con la entrada guardada y la app reabrió directamente sobre el partido en vivo que había quedado activo (comportamiento correcto de `bootDefaultScreen()`/auto-resume, sin tocar).

**Actualización PWA — limitación de entorno, no de código.** El navegador de verificación de este entorno (sandbox de Claude Code) **no pudo registrar el service worker** (`navigator.serviceWorker.register('sw.js')` devuelve "unknown error fetching the script" pese a que un `fetch('sw.js')` directo responde 200 con el `Content-Type` correcto) — es una restricción del entorno de previsualización, no un problema de `sw.js` (no se tocó su lógica de cacheo, solo `CACHE_NAME`). Por este motivo, la verificación real de "se ofrece y aplica la actualización" se hizo después de publicar, contra la URL de producción — ver §9.

---

## 9. Publicación

- Commit de correcciones documentales: `a3f4907`.
- Commit de implementación: `91a79f8` — *"BRAMUlab V02 · sistema visual integral"*.
- Tag: `v3.0`.
- Push a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages.
- Verificación post-deploy contra `https://sebastianvilaa.github.io/BRAMUlab/bramulab/`: confirmado GitHub Actions "pages build and deployment" verde. Un cliente con el bundle viejo (`v2.2.1`, service worker de producción ya registrado de antes) mostró correctamente el modal "Hay una nueva versión de BRAMU / BRAMUlab V02 está disponible.", y tocar ACTUALIZAR recargó con el sistema visual nuevo aplicado (footer pasó a "BRAMUlab V02", fondo/paleta actualizados) — el flujo de actualización PWA funciona de punta a punta en producción real, cerrando la limitación de sandbox de §8.

---

## 10. Qué no se tocó (confirmado)

Persistencia, modelos de datos, reglas de partido (`engine.js`), estadísticas y BRAMU Intelligence (`stats.js`), validaciones de carga manual (`match-load.js`), agregaciones del Home/Historial (`player-home.js`), esquema de `localStorage` (`store.js`, salvo el string de versión), navegación funcional, y la estructura del marcador en vivo (explícitamente fuera de alcance — solo se le fusionó la paleta). Nada de Base de datos, cuentas, ranking real, validación entre rivales ni procesamiento de notas privadas — todo eso sigue en `BRAMUlab_Backlog.md`, sin tocar.

---

## Ajuste visual de cierre 01

**Fecha:** 04/09/2026.
**Base:** este mismo BRAMUlab_V02 (commit `91a79f8`, tag técnico corregido más abajo).
**Commit de implementación:** `320d2c2`.
**Estado:** publicado en producción.

Pasada acotada de jerarquía tipográfica y terminación visual pedida por Sebastián sobre la versión ya publicada de BRAMUlab_V02 — no reabre el sistema visual ni cambia la familia tipográfica, solo corrige ejecución.

### 1. Tag técnico corregido

El tag `v3.0` (creado al publicar BRAMUlab_V02) reintroducía una numeración paralela (`v3.0`) que contradice el naming documental fijado en la reorganización del 03/09/2026 (`BRAMUlab_V01`/`BRAMUlab_V02`/`BRAMUlab_Partidos_V##`; ver memoria `project_bramu_lab_naming_reorg`). Se verificó primero que GitHub Pages no depende de tags — `gh api repos/sebastianvilaa/BRAMUlab/pages` confirma `source: {branch: "main", path: "/"}`, `build_type: "legacy"` — el deploy sale del push a `main`, nunca de un tag. Se eliminó el tag `v3.0` (local y remoto) y se creó `BRAMUlab_V02` apuntando al mismo commit `91a79f8` que ya tenía. La versión visible de producto sigue siendo el texto "BRAMUlab V02" (sin guion bajo), sin cambios — la corrección es solo del tag técnico de git. En adelante, ninguna ronda de BRAMUlab debe volver a crear tags `vN.N`.

### 2. Fusión de la jerarquía tipográfica de Inter

Inter ya estaba cargada desde la implementación de BRAMUlab_V02, pero ~20 clases que usan `var(--font-display)`/`var(--font-body)` para datos protagonistas nunca declaraban `font-weight` — heredaban el peso por defecto del navegador (400), indistinguibles de un texto de cuerpo pese al tamaño grande. Se auditó cada regla con `font-family` sin `font-weight` en `styles.css` y se asignó peso según la escala del consolidado (§2.1), construyendo contraste entre niveles en vez de subir todo por igual:

- **800** (resultados/números hero): `.player-home-lastmatch__score` (resultado de Último partido, antes 400), `.court-score__value` (resultado durante la carga, 52px, antes 400), `.court-saved-result__score` (pantalla "Partido guardado"), `.player-card__level-value` (Nivel BRAMU).
- **700** (métricas protagonistas/títulos/CTA): `.result-card__set` (resultado del Resumen), `.effectiveness-donut__value` y `.pastilla-widget__value` (porcentajes y métricas — racha, partidos totales, efectividad), `.evolution-summary__value` (Perfil), `.overlay__title`, `.summary-card__title`, `.analysis-header__title`, `.analysis-section__title`, `.pastilla__title` (labels de tarjeta: TU MOMENTO, ACTIVIDAD, EFECTIVIDAD…), `.bottom-sheet__title`, `.court-header__status`/`--saved`, `.court-accumulated__set-score`, `.load-keypad__key` (dígitos del teclado numérico).
- **600**: `.analysis-subsection__title` (nivel de título más chico que `.analysis-section__title`, para no igualar dos jerarquías distintas al mismo peso).
- **500** (nombres y metadatos): `.player-card__name`, `.pastilla-identity__name`, `.player-home-lastmatch__date`/`__place`, `.sheet-active-card__teams`, `.active-match-banner__teams`, y el modificador `.pastilla-widget__value--text` (mejor compañero/rival frecuente — son nombres de persona, no números, así que quedan explícitamente más livianos que `.pastilla-widget__value` base aunque compartan la clase padre).

Se agregó `font-variant-numeric: tabular-nums` a los números que no lo tenían (`.player-card__level-value`, `.effectiveness-donut__value`, `.pastilla-widget__value`, `.result-card__set`, `.evolution-summary__value`, `.player-home-lastmatch__date`).

### 3. Recomposición de "Último partido"

La primera línea de la tarjeta ahora agrupa forma reciente + "ÚLTIMO PARTIDO" + badge Victoria/Derrota como un único bloque a la izquierda (`.player-home-lastmatch__heading`, nueva), con fecha/hora/lugar a la derecha — antes la volanta de forma vivía en una fila y el título+badge en otra. El resultado pasa a 36px/Inter 800/tabular (antes 34px sin peso explícito), con un tope de 32px por debajo de 360px de viewport. Las parejas bajan a 13px/500 con más separación alrededor de "vs" (`margin` de 6px a 8px), y el chevron se movió de la fila del título a la fila de parejas, alineado con ella en vez de quedar flotando arriba (`.player-home-lastmatch__teamsrow`, nueva). La tarjeta gana padding (16px → 20px/18px), el degradado se oscurece (`--surface-2` → `--surface-1` como punto de partida) y se agregó una línea de acento de 2px en el borde superior — lima en victoria, coral en derrota, vía las clases `.player-home-lastmatch--win`/`--loss` que `renderPlayerLastMatchCard()` aplica y remueve en cada render según `resultKind` (sin acento en estado vacío o "sin definición").

### 4. Ícono de "Tu momento"

El path SVG relleno anterior (una estrella de 4 puntas simplificada) se reemplazó por una pelota de pádel lineal propia (círculo + dos arcos de costura), en el mismo lenguaje de trazo (~1.8px, sin relleno) que el resto de la iconografía SVG de la app — antes era el único ícono "sólido" del sistema. Tamaño 20px, color lima, sin glow.

### 5. El bug real detrás del sheet "Registrar partido"

Este fue el hallazgo más importante de la ronda. El síntoma reportado — la segunda opción del sheet ("Registrar partido en vivo") tapada por la barra inferior en producción — **no era un problema de z-index ni de orden de capas**: `.sheet-scrim` ya tenía `z-index: 36`, por encima de `.bottom-nav` (`z-index: 35`), y geométricamente el sheet ya llegaba hasta el borde inferior real del viewport.

Verificado con la app corriendo en `.claude/dev-server.py`: `getComputedStyle(document.documentElement).getPropertyValue('--court-surface')` devolvía **string vacío** — la variable no existía. Rastreando por qué, el `:root{ --sheet-duration-enter: var(--motion-base); ...; --court-bg: var(--bg); --court-surface: var(--surface-1); ... }` completo (la sección "Movimiento (§11 / Adenda §5)") nunca aparecía en `document.styleSheets[0].cssRules` pese a estar presente, bien formado y con llaves balanceadas en el archivo fuente. La causa: el comentario inmediatamente anterior contenía la secuencia literal `--motion-*/--motion-ease` (sin espacio) — el `*/` ahí adentro cierra el comentario CSS antes de lo previsto. Todo el texto suelto que sigue (`-motion-ease definidos en :root...`) pasa a interpretarse como CSS real; al no ser un selector válido, el parser descarta en silencio el bloque `:root{...}` completo que viene después, incluidas TODAS sus declaraciones. Reproducido de forma aislada inyectando el fragmento exacto en un `<style>` nuevo: 0 reglas útiles parseadas hasta corregir el espacio.

Ese bloque descartado definía `--court-bg`, `--court-surface`, `--court-surface-2`, `--court-line`, `--court-text-dim`, `--court-text-faint`, `--court-glow` y `--sheet-duration-enter`/`--sheet-duration-level`/`--sheet-ease` — es decir, **todo el sistema de tokens `--court-*` fusionado en BRAMUlab_V02 (§6 del consolidado) estaba silenciosamente inactivo en producción desde su publicación**, sin ningún error de consola (los `var()` con variable inválida simplemente caen al valor inicial de la propiedad). Esto dejaba transparente no solo el sheet "Registrar partido", sino también "Elegir jugador", "Formato y puntuación" y buena parte de la superficie de la pantalla de carga manual (`.court-players`, `.court-current-set`, `.load-keypad`, etc.) — todas consumían `var(--court-surface)`/`var(--court-line)` que resolvían a inválido.

Fix de una línea: agregar un espacio (`--motion-* y --motion-ease` en vez de `--motion-*/--motion-ease`) para que el comentario cierre donde corresponde. Verificado post-fix: los 8 tokens `--court-*`/`--sheet-duration-*` resuelven correctamente, el sheet queda opaco y cubre la barra inferior por completo (confirmado con `document.elementFromPoint()` sobre la zona de superposición: devuelve `#register-sheet`, nunca un elemento de `.bottom-nav`), y la pantalla de carga manual — que antes de este hallazgo nunca se había visto con su fondo real — se ve con la superficie "cancha nocturna" que el consolidado pedía desde el principio.

**Nota sobre verificación con el service worker activo:** durante esta ronda se confirmó (otra vez) que `sw.js` cachea agresivamente (`cache.addAll` + cache-first) y que un simple recargo no alcanza para ver un cambio de CSS — hace falta `unregister()` + `caches.delete()` antes de recargar, en cada iteración. Ya estaba documentado en memoria de rondas anteriores; se repite acá porque este hallazgo específico habría sido imposible de detectar sin descartar primero la caché como explicación alternativa.

### 6. Verificación

**Tests automatizados:** 483/483 verdes, sin cambios (`tests.html`) — ninguna función pura fue tocada, solo CSS, el markup de `renderPlayerLastMatchCard()` y el ícono SVG estático de "Tu momento".

**Consola:** sin errores en ninguna de las pantallas revisadas.

**Verificación manual**, viewport 402×874, con dos partidos reales cargados de punta a punta por el flujo de carga manual (creación de jugadores invitados, selector "Elegir compañero"/"Elegir rival", entrada de resultado con teclado, formato Clásico/Punto de Oro) más un partido de prueba sintético con derrota (insertado vía `PLStore.upsertHistory` en consola para poder ver el estado "Derrota" sin tener que jugar un partido perdedor real; removido con `PLStore.removeFromHistory` antes de terminar):

1. Home completo, con partido real cargado — pastilla de jugador, Último partido, Tu momento, Actividad/Efectividad, métricas chicas.
2. Último partido en victoria — acento lima, badge lima, jerarquía de resultado confirmada con `getComputedStyle` (800/36px) además de visualmente.
3. Último partido en derrota (partido sintético) — acento coral, badge coral, delta de Nivel BRAMU en coral, sin regresión en el resto de la tarjeta.
4. Sheet "Registrar partido" en 402×874 — ambas opciones completamente visibles y opacas, sin superposición de la barra inferior; áreas táctiles medidas con `getBoundingClientRect()`: 55px de alto cada una (≥48px). Verificado también en escritorio (1280×900): sheet centrado con ancho máximo, mismo resultado.
5. Sheet "Elegir jugador" (compañero y rival) — mismo fix de fondo, confirmado opaco.
6. Carga manual: pantalla de resultado por set (teclado numérico, dígitos ahora en 700), pantalla "Partido guardado" (resultado en 800/40px), formulario de jugadores con paleta azul/magenta intacta.
7. Resumen/Análisis del partido cargado — BRAMU Intelligence, tarjeta de resultado con sets en 700, "SETS GANADOS"/"GAMES GANADOS" sin cambios de layout.
8. Historial con pestañas y filtros — sin regresiones, conteos correctos (Todos/Mis partidos/Observados).
9. Perfil — nombre en 500, Evolución del Nivel BRAMU con valores en 700, badge "SIMULADO · BETA" intacto.
10. Ranking — estado vacío sin cambios.

Las diez capturas se revisaron como conjunto: ninguna volvió a mostrar fondos transparentes ni texto liviano en un dato protagonista.

### 7. Desvío observado, no corregido (fuera de alcance de esta ronda)

Durante la verificación se notó que un partido cargado manualmente con "Ahora" quedó con `playedAt` un día calendario por delante de `createdAt` (p. ej. partido creado 04/09 21:27 con `playedAt` guardado como 05/09 00:25 UTC). No se investigó ni se tocó — está dentro de `match-load.js`, explícitamente conservado en esta ronda (§6 del consolidado: "no modificar... estructura de la carga manual"). Queda anotado acá para que Sebastián decida si amerita una ronda de investigación aparte; no afectó ninguna de las verificaciones de esta pasada porque el ordenamiento de Último partido/Historial sigue siendo consistente con el valor guardado, solo que ese valor podría no ser el esperado.

### 8. Publicación

- Commit de implementación: `320d2c2` — *"BRAMUlab V02 · ajuste visual de cierre 01"*.
- Tag técnico corregido: `BRAMUlab_V02` (reemplaza a `v3.0`, eliminado de local y remoto), mismo commit `91a79f8`.
- Push a `main` en `sebastianvilaa/BRAMUlab` → despliegue automático en GitHub Pages (confirmado que el deploy depende solo de `main`, no de tags — ver §1).
- Este mismo commit de documentación cierra la ronda.
