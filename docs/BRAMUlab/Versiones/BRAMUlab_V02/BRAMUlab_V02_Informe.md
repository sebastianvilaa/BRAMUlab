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
- Verificación post-deploy contra `https://sebastianvilaa.github.io/BRAMUlab/bramulab/`: [completar tras confirmar propagación — ver mensaje de cierre].

---

## 10. Qué no se tocó (confirmado)

Persistencia, modelos de datos, reglas de partido (`engine.js`), estadísticas y BRAMU Intelligence (`stats.js`), validaciones de carga manual (`match-load.js`), agregaciones del Home/Historial (`player-home.js`), esquema de `localStorage` (`store.js`, salvo el string de versión), navegación funcional, y la estructura del marcador en vivo (explícitamente fuera de alcance — solo se le fusionó la paleta). Nada de Base de datos, cuentas, ranking real, validación entre rivales ni procesamiento de notas privadas — todo eso sigue en `BRAMUlab_Backlog.md`, sin tocar.
