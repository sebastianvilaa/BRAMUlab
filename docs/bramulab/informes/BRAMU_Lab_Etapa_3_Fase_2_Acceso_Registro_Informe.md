# BRAMU Lab
## Etapa 3 — Fase 2: acceso central de registro y partido en curso
### Informe de implementación

**Estado:** IMPLEMENTADO Y VERIFICADO
**Fecha:** 02 de septiembre de 2026
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/` (sin cambios — ver §13)
**Documentos base:** `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Consolidado.md` (autorización ejecutable) y `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md` (contexto vinculante)

Este informe es autosuficiente: documenta diagnóstico, decisiones, archivos, tests, verificación manual y despliegue sin necesitar el historial de chat operativo.

---

## 1. Diagnóstico inicial

Línea base verificada antes de tocar nada: commit `39cb821` (Fase 1), 364/364 tests en verde, BRAMU Lab y BRAMU Lab Partidos desplegados y con almacenamiento/PWA/caché separados (confirmado en el informe de Fase 1).

Relevamiento del código existente antes de programar:

- El botón `+` de la barra inferior (`data-nav="manual-load"`) abría directamente "Cargar partido jugado" (`openManualLoadScreen`), sin ninguna noción de "partido en curso" ni alternativa para registrar en vivo desde ahí.
- Existía una franja de "partido en curso" (`#continue-banner`), pero solo dentro de `view-setup` (el flujo tradicional) — el Home del jugador (`view-player-home`) no tenía ninguna. Se decidió **no tocarla**: sigue funcionando igual que siempre para quien entra por Setup, y es independiente de la franja nueva del Home (ver §17).
- La app **no reanudaba automáticamente** un partido en vivo al recargar — siempre arrancaba en Setup y hacía falta tocar "CONTINUAR" a mano. El consolidado (§6) autoriza corregir esto explícitamente.
- No existía ninguna salida **no destructiva** desde la pantalla de partido en vivo hacia el Home: la única salida era ☰ → "Volver al inicio", que descarta el partido. Hacía falta agregar una.
- El modal de confirmación genérico (`#confirm-overlay`) vivía **anidado dentro de `#view-match`**, el mismo defecto que V13.2/V13.3 ya habían corregido para otros dos modales ("Hay una nueva versión" / "Sistema de puntuación"): al quedar `view-match` con `display:none` en cualquier otra vista, un overlay `position:fixed` anidado ahí no se pinta. Sus dos usos existentes (Reiniciar partido / Volver al inicio) nunca lo habían notado porque solo se disparan estando ya dentro del partido — pero la Fase 2 necesitaba reutilizarlo desde "Cargar partido jugado" (§10), alcanzable fuera de `view-match`. Corregido moviéndolo al bloque de overlays globales (ver §8).

---

## 2. Archivos modificados

| Archivo | Cambio |
|---|---|
| `bramulab/index.html` | Nueva hoja "Registrar partido" (`#register-sheet-scrim`), modal de descarte (`#discard-match-modal`), franja de partido en curso en el Home (`#active-match-banner`), reubicación de `#confirm-overlay`, `id` nuevo en el logo del header de partido (`#match-header-logo-btn`). |
| `bramulab/styles.css` | Tokens de movimiento (`--sheet-duration-*`, `--sheet-ease`), componentes `.sheet-scrim`/`.bottom-sheet`/`.sheet-option`/`.sheet-active-card`, `.active-match-banner`, `.btn-secondary--danger`, `cursor:pointer` en el logo del header de partido. |
| `bramulab/player-home.js` | `registerModeLabel(mode)` y `summarizeActiveMatchSnapshot(snap)` — única lógica pura de la fase (ver §11). |
| `bramulab/app.js` | Toda la orquestación: `getActiveMatchSummary`, hoja (`openRegisterSheet`/`showRegisterSheetLevel`/cierre animado e instantáneo/swipe/Escape), franja (`renderActiveMatchBanner`), descarte (`discardActiveMatchState` extraído de `goHome`, `initDiscardMatchModal`), salida de carga manual con confirmación (`exitManualLoadScreen`, dirty-tracking), reanudación automática (`tryAutoResumeActiveMatch`), tap del logo del header (`initMatchHeaderHomeLink`). |
| `bramulab/store.js` | `APP_VERSION`: `'v1'` → `'v1.1'`. |
| `bramulab/sw.js` | `CACHE_NAME`: `'bramulab-v1'` → `'bramulab-v1.1'` (el filtro de limpieza `startsWith('bramulab-v')` ya cubre el nombre nuevo sin cambios). |
| `bramulab/version.json` | `"version": "v1.1"`. |
| `bramulab/tests.html` | 9 tests nuevos (`registerModeLabel`/`summarizeActiveMatchSnapshot`) — ver §11. |

`bramulab-partidos/` — **cero archivos tocados** (ver §13).

---

## 3. Estructura de componentes

**Hoja "Registrar partido"** (`#register-sheet-scrim` → `#register-sheet`): vive fuera de cualquier `<section class="view">`, igual que el toast — así abre igual desde Inicio/Historial/Ranking/Perfil (todas las vistas con barra inferior). Tres niveles, mutuamente excluyentes vía `hidden`:

- `#register-sheet-active` — con partido en curso (§8 del consolidado): tarjeta contextual tocable + "Registrar partido nuevo".
- `#register-sheet-level1` — sin partido en curso (§4): "Cargar mi partido jugado" (lima/principal) + "Registrar partido en vivo".
- `#register-sheet-level2` — elegir modo en vivo: "Game por game" / "Punto por punto", ninguno preseleccionado ni destacado (ambos con la misma clase neutral `.sheet-option`, a diferencia de nivel 1 donde `.sheet-option--primary` marca la acción lima).

`openRegisterSheet()` decide el nivel inicial consultando `getActiveMatchSummary()` (app.js) → `PH.summarizeActiveMatchSnapshot()` (player-home.js, pura). `showRegisterSheetLevel(level, {animate})` maneja la transición entre niveles.

**Franja del Home** (`#active-match-banner`): un solo `<button>` (toda la franja es tocable por construcción, sin envolver un botón interno), primer hijo de `.player-home-scroll`, antes de la tarjeta de identidad — prioridad sobre Hitos/resto del contenido, tal como pide §7. `renderActiveMatchBanner()` se llama desde `renderPlayerHome()`.

**Confirmación de descarte** (`#discard-match-modal`): modal dedicado, no reutiliza `#confirm-overlay` — ahí los roles de los botones están invertidos respecto a la convención genérica (la acción segura es la principal/lima-gold, la destructiva es roja), algo que el modal genérico no modela.

**Reutilización explícita, sin reescribir:** "Cargar mi partido jugado" (`openManualLoadScreen`) y el arranque de partido en vivo (`view-setup` con `selectedRecordingMode` preseteado) son exactamente los flujos existentes — la hoja solo decide *cuál* abrir, nunca cómo funcionan por dentro.

---

## 4. Comportamiento del "+" sin partido activo

Verificado manualmente (navegador, ver §12): tocar `+` abre la hoja con "REGISTRAR PARTIDO", "Cargar mi partido jugado" en lima arriba, "Registrar partido en vivo" neutral abajo. Tocar esta última desliza a un segundo nivel con flecha de volver, título "REGISTRAR EN VIVO" y "Game por game"/"Punto por punto" sin preselección. Cada opción de modo:

- fija `selectedRecordingMode` y lo persiste (`Store.saveRecordingMode`, mismo mecanismo que el selector del header — Etapa 2 §3.1, sin duplicar lógica);
- actualiza la etiqueta del header (`updateModeSelectButtonLabel`);
- cierra la hoja y navega a `view-setup`, el formulario de siempre, ya con el modo correcto — sin selector de jugadores nuevo (§14).

"Cargar mi partido jugado" cierra la hoja y abre `openManualLoadScreen('player-home')` sin ningún cambio a ese flujo.

Cierre: cruz (los 3 niveles), tocar el fondo (scrim), deslizar hacia abajo (`pointerdown/move/up` sobre `.bottom-sheet`, con umbral de 80px, ignorando el gesto si arranca sobre un control) y Escape (listener global, solo actúa si la hoja está abierta). Los cuatro métodos se probaron manualmente y ninguno modifica ningún estado (no hay "Cancelar"/"Guardar" involucrado en cerrar la hoja).

---

## 5. Comportamiento con partido activo

Con un partido en vivo guardado (`Store.loadActiveMatch()` no nulo y no finalizado), la hoja abre directamente en el nivel "activo": tarjeta contextual con jugadores/parejas, resultado parcial, modo y "CONTINUAR PARTIDO" (lima, toda la tarjeta tocable), y debajo "Registrar partido nuevo" en estilo neutral — nunca "Descartar" como opción permanente, tal como exige §8.

Tocar la tarjeta cierra la hoja y llama a `continueActiveMatch()` (la misma función que ya usaba `#continue-match-btn` en Setup) — vuelve exactamente al marcador activo, sin reinterpretar ni reconstruir nada.

---

## 6. Persistencia y reanudación

Se agregó `tryAutoResumeActiveMatch()`, llamado al final de `DOMContentLoaded`: si hay un partido en vivo guardado y no finalizado, llama a `continueActiveMatch()` de inmediato — la app arranca directo en el marcador, sin pantalla intermedia. Antes de esta fase la app siempre arrancaba en Setup.

Verificado manualmente (no hay arnés para DOM): se jugaron puntos/games en **ambos modos** (Punto por punto y Game por game), se recargó la página por completo (`navigate force`) y en los dos casos la app volvió exactamente al mismo marcador — mismo resultado, mismo sacador, mismo cronómetro corriendo (siguió sumando tiempo real, no se reinició). Ver capturas/registro en §12.

**Navegación intencional al Home (nueva):** se agregó `id="match-header-logo-btn"` al logo del header de partido y un handler que llama a `openPlayerHome()` — mismo criterio que `#home-logo`/`#player-home-logo` ya usan en el resto de la app (tap en el logo = navegación, no un botón nuevo). A diferencia de ☰ → "Volver al inicio" (destructivo), esta navegación **no descarta nada**: `match`/`pointEvents`/timer siguen en memoria, el partido sigue autosalvado en `Store`. Antes de esta fase no existía ninguna forma no destructiva de salir del marcador — se agregó porque, sin ella, la franja y la hoja contextual (con auto-reanudación activa) nunca serían alcanzables desde un partido en curso.

---

## 7. Descarte confirmado

Al tocar "Registrar partido nuevo" con un partido activo: la hoja se cierra **sin animación** (`closeRegisterSheetInstant`, ver §17 sobre por qué) y se abre `#discard-match-modal` con el texto exacto del consolidado ("HAY UN PARTIDO EN CURSO" / "Si registrás un partido nuevo…"). "VOLVER AL PARTIDO" (lima/gold, principal) llama a `continueActiveMatch()` directo. "DESCARTAR Y REGISTRAR UNO NUEVO" (rojo, único uso del rojo en toda la fase) llama a `discardActiveMatchState()` — función extraída de `goHome()` que limpia timer/Wake Lock/`Store.clearActiveMatch()`/estado en memoria, **sin tocar el Historial** — y después vuelve a abrir la hoja (`openRegisterSheet()`), que al no encontrar partido activo abre en nivel 1 con las dos opciones habituales, tal como pide §9.

Verificado manualmente: cancelar el descarte conserva el partido intacto (score, timer corriendo); confirmarlo hace desaparecer la franja del Home, no agrega ninguna entrada al Historial ("Último partido" sigue en "Todavía no cargaste ningún partido"), y reabre la hoja en nivel 1.

---

## 8. Tratamiento de carga manual

"Cargar mi partido jugado" **nunca** se trata como partido en curso (no pasa por `Store.saveActiveMatch`, no activa la franja — confirmado manualmente: cargar/abandonar esta pantalla nunca hace aparecer `#active-match-banner`).

Se agregó "¿Salir sin guardar?" (§10, no existía antes): un flag `manualLoadDirty`, en `false` al abrir la pantalla, se marca `true` ante **cualquier interacción** con el formulario (inputs de texto, selects de resultado, fecha/hora, botones de formato/sistema de puntuación, borrar hora) — deliberadamente conservador: aunque el valor final coincida con el default, tocar algo cuenta como "hay datos ingresados", para nunca descartar en silencio algo que el usuario sí tocó. `exitManualLoadScreen()` (usada tanto por el botón "←" como por "Cancelar") sale directo si no hay cambios, o pregunta "¿Salir sin guardar?" si los hay, reutilizando `confirmAction()`/`#confirm-overlay` — lo que motivó la reubicación de ese modal (§1).

Verificado manualmente: sin tocar nada, "←"/"Cancelar" salen directo; escribiendo un nombre y tocando "←", aparece la confirmación; "Confirmar" descarta y vuelve al origen correcto (Home del jugador o Setup, según desde dónde se abrió — lógica preexistente de Etapa 2, sin cambios).

---

## 9. Movimiento y accesibilidad

Tokens centralizados en `:root` (`--sheet-duration-enter: 260ms`, `--sheet-duration-level: 160ms`, `--sheet-ease`), nunca duraciones sueltas repetidas. Bajo `prefers-reduced-motion: reduce`, ambos tokens colapsan a `1ms` y la animación de cambio de nivel (`sheetLevelIn`, fade + desplazamiento lateral de 10px) se reemplaza por `sheetLevelFadeIn` (fade puro, sin desplazamiento) — verificado por inspección de código: no hay una segunda fuente de verdad para las duraciones, y el reemplazo de "desplazamiento expresivo" por "fade simple" que pide §11 está resuelto vía dos `@keyframes` distintos, no un `if` en JS.

La franja del Home tiene un latido sutil (`activeMatchPulse`, glow de `box-shadow` a 2.4s, `ease-in-out infinite`) que se anula completamente bajo `prefers-reduced-motion` (`animation:none`).

No se pudo emular `prefers-reduced-motion` en vivo con las herramientas de navegador disponibles en esta sesión (no hay control expuesto para ese media feature, a diferencia de tamaño de viewport o esquema de color) — la verificación de este punto fue por **inspección de código** (confirmando que las reglas CSS existen, apuntan a las variables correctas y no hay animación expresiva sin su contraparte de fade), no por prueba visual en vivo. Si Sebastián quiere confirmarlo visualmente, alcanza con activar "Reducir movimiento" en el sistema operativo y volver a abrir la hoja o generar un partido en curso.

Accesibilidad adicional: la hoja usa `role="dialog"`/`aria-modal="true"`, restaura el foco al elemento que la abrió al cerrarse (`closeRegisterSheet`), y la barra inferior queda cubierta (no respondible) mientras la hoja está abierta — esto último es gratis por el z-index del scrim (36) por encima de `.bottom-nav` (35), verificado manualmente: mientras la hoja está abierta, tocar la barra inferior no navega a ningún lado.

---

## 10. Actualización a v1.1

Se inspeccionaron las tres fuentes reales antes de tocarlas (`store.js` §`APP_VERSION`, `sw.js` §`CACHE_NAME`, `version.json`) y se actualizaron juntas a `v1.1`, consistente con lo que ya exige el comentario existente en `sw.js` ("deben actualizarse juntos en cada release"). El filtro de limpieza de cachés (`k.startsWith('bramulab-v') && k !== CACHE_NAME`) no necesitó cambios: ya cubre cualquier `bramulab-v*` futuro sin volver a matchear `bramulab-partidos-*`.

Verificado localmente: el footer de Setup y `version.json` muestran `v1.1` de forma consistente (`window.PLStore.VERSION === (await fetch('version.json')).version`, confirmado `true`). La detección de actualización en un dispositivo con `v1` ya cacheado (popup "HAY UNA NUEVA VERSIÓN DE BRAMU" / herramienta "Forzar actualización") usa el mismo mecanismo que ya se verificó y documentó en el informe de Fase 1 (`checkForNewVersion`, sin cambios de código en esta fase) — se reconfirmará en producción después del despliegue (ver §16), igual que se hizo entonces.

---

## 11. Tests agregados y resultados

La Fase 2 es, por naturaleza, casi enteramente de navegación/DOM (hoja, franja, descarte, reanudación) — no hay mucho que extraer como lógica pura más allá de una pieza genuina: **qué mostrar** para un partido en curso (nombres, score, modo), que sí se separó en `player-home.js` para poder testearla sin DOM:

- `PH.registerModeLabel(mode)` — mapeo único `games` → "Game por game" / `complete` → "Punto por punto" (antes hubiera quedado como un ternario repetido en la franja y en la tarjeta de la hoja).
- `PH.summarizeActiveMatchSnapshot(snap)` — arma `{teamAName, teamBName, modeLabel, scoreLabel}` a partir de un snapshot con la misma forma que `Store.saveActiveMatch`, reutilizando `engine.js` (`computeStateFromEvents`/`computeGameStateFromEvents`) como única fuente del estado — nunca reinterpreta puntos/games por su cuenta.

9 tests nuevos en `bramulab/tests.html`: 3 sobre `registerModeLabel` (games/complete/desconocido-nunca-undefined), 2 defensivos sobre `summarizeActiveMatchSnapshot` (null/sin match), 4 sobre el cómputo real (parejas, modo y "Set 1 · 0-0" en Completo y en Por Games con cero eventos).

**Resultado: 373/373 tests en verde** (364 de la línea base + 9 nuevos), confirmado localmente vía el servidor de desarrollo (`python3 .claude/dev-server.py`) sirviendo `bramulab/` en `http://localhost:4173`, cero casos en `.case.fail`. Satisface el ítem 21 de §15 (la suite completa anterior sigue en verde) y agrega cobertura real a la única pieza pura de la fase.

El resto de los 21 casos de §15 (1-20) son de interacción/DOM y se verificaron manualmente — no existe arnés de pruebas de integración en este proyecto (limitación documentada desde antes de esta fase). Ver §12 para el detalle de qué se probó y cómo.

---

## 12. Verificaciones manuales

Todo lo siguiente se probó en el navegador contra el servidor de desarrollo local, sirviendo exactamente el contenido de `bramulab/` (no una copia):

**Escritorio (viewport ancho, ~1280×720):**
- `+` sin partido activo → nivel 1 → "Registrar partido en vivo" → nivel 2 → "Game por game" → aterriza en Setup con "MODO POR GAMES · BETA" ya seleccionado (test §15-3).
- Mismo camino con "Punto por punto" → "MODO COMPLETO" (test §15-4).
- Partido Por Games jugado unos puntos → tap en el logo del header → Home muestra la franja con jugadores/score/modo correctos, sin descartar nada (§15-9/§15-10).
- `+` con partido activo → tarjeta contextual correcta (§15-7) → "VOLVER AL PARTIDO" tras abrir el modal de descarte conserva todo, incluido el cronómetro corriendo (§15-11).
- `+` → "Registrar partido nuevo" → "DESCARTAR Y REGISTRAR UNO NUEVO" → franja desaparece, no se crea entrada de Historial, hoja reabre en nivel 1 (§15-12/§15-13).
- Cerrar la hoja con Escape no modifica nada (§15-6, parcial — ver abajo cruz/fondo/gesto).
- Reubicación de `#confirm-overlay`: se confirmó que su uso **preexistente** (☰ → "Volver al inicio") sigue funcionando igual, ahora también correctamente disponible desde "Cargar partido jugado" para "¿Salir sin guardar?" (§15-15), incluyendo el caso "sin cambios sale directo" y "con cambios pregunta".
- Reanudación automática: partido Completo y partido Por Games, cada uno jugado un poco y recargado con `navigate force` — ambos vuelven exactamente al mismo estado, cronómetro incluido (§15-16/§15-17).
- Partido Por Games llevado hasta "Finalizar partido" con ganador declarado manualmente → Resumen se genera correctamente (motor de puntuación sin regresiones, §15-18) y, al volver al Home, "Último partido" refleja correctamente que ese partido no involucró al jugador identificado (filtro existente, sin cambios).
- Consola del navegador sin errores en ningún punto de las pruebas anteriores.

**Cierre de la hoja por cruz y por tocar el fondo:** verificados en las primeras rondas de esta misma sesión de pruebas (antes de las capturas de arriba), sin efectos sobre el estado.

**Deslizar hacia abajo (gesto):** implementado con `pointerdown/move/up` y umbral de 80px; el mecanismo se revisó por código e interacción con el mouse (equivalente a un puntero), sin poder simular un gesto táctil real de deslizamiento con las herramientas de esta sesión — riesgo bajo porque reutiliza los mismos manejadores de puntero que ya usa el resto de la app (drag del summary, etc.) y no toca ningún estado hasta pasar el umbral.

**Mobile (375×812) y Tablet (768×1024):** a mitad de la verificación, el panel visual del navegador quedó oculto del lado del host (fuera de mi control) y las acciones de clic/captura basadas en renderizado dejaron de responder. Para no dejar estos dos anchos sin verificar, se confirmaron por inspección estructural directa (DOM/`getComputedStyle`/`getBoundingClientRect`, sin depender de que la animación corra — los navegadores suspenden `requestAnimationFrame` en pestañas ocultas, así que se forzó el estado "abierto" para medir el layout final):
- 375px: sin desborde horizontal (`body.scrollWidth === innerWidth`), la hoja ocupa el ancho completo con márgenes de 19px, los dos botones del nivel 1 miden 337×54.5px (objetivo táctil amplio), la cruz de cerrar 28×28px.
- 375px, franja con nombres largos ("Bartolomé Fernández-Larrañaga", "Cristopherson"): el texto **envuelve** en vez de desbordar, la franja crece en alto (156px) en vez de cortar contenido — satisface §15-10/§16 "franja con nombres largos".
- 768px: la hoja se centra con `max-width:480px` (igual que ya hace `.bottom-nav` en ese mismo breakpoint), sin desborde horizontal.
- Reanudación automática también confirmada a 375px (recarga completa con un partido activo sembrado, aterriza directo en el marcador).

Esto es una verificación real pero **parcial** respecto a lo pedido en §16 (confirma layout/estructura, no un vistazo visual humano ni una interacción táctil real en esos dos anchos). Se documenta como tal, no como equivalente a la prueba completa hecha en escritorio.

**Navegador limpio vs. con caché previa:** no se pudo simular un dispositivo con `bramulab-v1` ya cacheado dentro de esta sesión de verificación local (el servidor de desarrollo no registra Service Worker de la misma forma que GitHub Pages en producción); este punto se verifica en producción después del despliegue, con el mismo método que ya usó Fase 1 (ver §10 y §16).

---

## 13. Confirmación de que BRAMU Lab Partidos no cambió

`git status --porcelain` antes de este commit muestra únicamente archivos bajo `bramulab/` (más los dos documentos de consolidado nuevos en `docs/`) — **cero archivos bajo `bramulab-partidos/`** aparecen modificados, agregados ni eliminados. Confirmado también manualmente: no se abrió, editó ni desplegó ningún archivo de esa carpeta durante esta fase.

---

## 14. Hash y mensaje del commit

`__PENDING_COMMIT_HASH__` — se completa después de confirmar el commit (ver política de este proyecto: el hash no puede conocerse antes de crear el commit).

Mensaje: `V15 · Etapa 3, Fase 2 (BRAMU Lab): acceso central de registro y partido en curso`.

---

## 15. Push y despliegue

`__PENDING_DEPLOY_STATUS__` — se completa tras el push y la verificación de GitHub Pages.

---

## 16. URL y versión verificadas

`__PENDING_PRODUCTION_VERIFICATION__` — se completa tras el despliegue: URL de BRAMU Lab, versión `v1.1` visible en producción, confirmación de que BRAMU Lab Partidos sigue intacto en su propia URL, y (si es posible reproducir) verificación de detección de actualización en un navegador con `v1` cacheado.

---

## 17. Decisiones, desvíos, riesgos o deuda

Decisiones técnicas menores resueltas de forma conservadora, sin escalar (por instrucción §1):

1. **`#confirm-overlay` reubicado fuera de `#view-match`.** Mismo defecto de anidamiento que V13.2/V13.3 ya habían corregido para otros dos modales; nunca antes notado porque sus únicos dos usos previos solo se disparaban dentro del partido. Se movió al bloque de overlays globales (junto a `#update-available-modal`) sin cambiar su comportamiento ni sus call sites existentes — verificado que ☰ → "Volver al inicio"/"Reiniciar partido" siguen funcionando igual.
2. **Cierre instantáneo (sin animación) de la hoja al abrir la confirmación de descarte.** Encadenar la animación normal de cierre (260ms) con la apertura del modal de descarte hacía que, durante la transición, el scrim de la hoja (z-index 36) quedara visualmente por encima del modal de confirmación (z-index 30, el de `.overlay`) — dos capas "modales" compitiendo. Se resolvió cerrando la hoja sin animación solo en esa transición puntual (`closeRegisterSheetInstant`); el resto de las transiciones (hacia el marcador, hacia Setup, hacia Cargar partido jugado) sí usan el cierre animado normal, porque ahí no hay una segunda capa modal esperando debajo.
3. **`goHome()` refactorizado, extrayendo `discardActiveMatchState()`.** Necesario para reutilizar exactamente la misma lógica de descarte desde la confirmación de la hoja (que, a diferencia de `goHome()`, no vuelve a Setup sino que reabre la hoja donde estaba). Comportamiento de `goHome()` sin cambios — mismo código, solo dividido en dos funciones.
4. **`manualLoadDirty` se marca ante cualquier interacción, no solo si el valor final difiere del default.** Interpretación deliberadamente conservadora de "existen datos ingresados" (§10): nunca se arriesga a descartar en silencio algo que el usuario tocó, al costo menor de preguntar alguna vez de más (p. ej. si el usuario cambia una opción y la vuelve a dejar igual).
5. **El logo del header de partido en vivo ahora navega al Home sin descartar** — no estaba pedido literalmente en el consolidado, pero es **necesario** para que la franja y la hoja contextual (con la reanudación automática ya activa) sean alcanzables desde un partido en curso: antes no existía ninguna salida no destructiva desde ahí. Bajo riesgo: es puramente navegación (no toca `match`/`pointEvents`/Historial), mismo patrón ya usado por `#home-logo`/`#player-home-logo`.
6. **`checkForActiveMatch()` (la franja vieja de `view-setup`, de la Fase 0) se dejó completamente intacta**, en vez de unificarla con `PH.summarizeActiveMatchSnapshot`. Ambas franjas (la vieja de Setup y la nueva del Home) conviven sin conflicto — se decidió no tocar código ya verificado en producción sin necesidad real, aunque implica que la lógica de "leer el estado de un partido activo" está en dos lugares con formas ligeramente distintas (una es un string simple "Set N · a-b", la otra un objeto con parejas/modo). Riesgo bajo, documentado como posible unificación futura si se rediseña el Home.
7. **Riesgo/deuda — verificación mobile/tablet parcial** (ver §12): el panel del navegador quedó oculto a mitad de sesión por una causa fuera de mi control, y la verificación de esos dos anchos terminó siendo estructural (DOM/CSS computado) en vez de visual/táctil completa. Recomendación: que Sebastián haga una pasada rápida en su teléfono real antes de dar la fase por cerrada del todo, aunque el riesgo es bajo (mismos componentes/CSS que ya se probaron completos en escritorio, con medidas de layout confirmadas en ambos anchos).
8. **Riesgo/deuda — `prefers-reduced-motion` verificado solo por código**, no en vivo (sin herramienta disponible en esta sesión para emular ese media feature). Bajo riesgo: la regla CSS es simple y directa (dos bloques `@media`, sin lógica condicional en JS).
9. **Sin desvíos del alcance protegido (§14):** no se tocó el formulario de Cargar partido jugado, no hay selector de jugadores nuevo, no se tocó el motor de puntuación, Resumen, Análisis, Historial, Nivel BRAMU, ranking, perfiles ni `bramulab-partidos/`.

---

## 18. Confirmación de no avance a la Fase 3

Esta fase se detiene acá. No se implementó nada del rediseño visual general, ni de Fase 3, ni de ningún ítem de la lista de protección de alcance (§14 del consolidado). El siguiente paso, cuando corresponda, requiere un nuevo consolidado específico.
