# BRAMUlab V02.8 — Auditoría Visual y de CSS

**Tipo de documento:** auditoría de solo lectura, sin implementación.
**Base auditada:** `bramulab/styles.css` (2122 líneas) tal como quedó publicado en V02.7.
**Commit de referencia:** `f789631` (última modificación real de `styles.css`) / `HEAD` en el momento de esta auditoría: `cf031d8`.
**Archivos revisados:** `bramulab/styles.css`, `bramulab/index.html`, `bramulab/app.js`, `bramulab/player-home.js`, `bramulab/match-load.js` (solo lectura, para entender dónde se usa cada clase).
**No se modificó ni se publicó nada.** No se tocó BRAMU Intelligence ni lógica funcional.

---

## 1. Resumen ejecutivo

El sistema visual de BRAMUlab está **más ordenado de lo que su tamaño hace sospechar**: usa tokens de color de forma consistente (`--brand-lime`, `--accent-cyan`, `--team-a/b`, `--surface-*`), tiene una paleta cerrada y un criterio cromático real (verde = Equipo A / acción, azul = Equipo B, dorado = solo Punto de Oro/Star Point, rojo = solo destructivo). El historial de comentarios en el propio CSS (más de 200 bloques) demuestra que casi todos los cambios fueron decisiones deliberadas, no accidentes.

Dicho esto, la auditoría encontró **9 inconsistencias concretas y verificables** (no apreciaciones subjetivas) que valen la pena resolver, y **3 piezas de CSS muerto** que se pueden borrar sin ningún riesgo. Los hallazgos más importantes:

1. **El título de "NOTIFICACIONES" no es un caso aislado**: es uno de ~18 modales que comparten `.overlay__title` (20px, tracking 0.1em, color lima), un valor que quedó desalineado del resto del sistema de títulos de la app, que converge casi unánimemente en **0.03em** (`.bottom-sheet__title`, `.pastilla__title`, `.analysis-header__title`, `.court-header__status`, etc.). No es que Notificaciones esté "rota" — es que hay dos familias de título (overlay vs. sheet) y una quedó vieja.
2. **Bug real heredado, no corregido del todo**: `.overlay--highlight` (el popup de clasificar un Highlight) todavía usa `rgba(11,18,17,0.55)` — el negro-verdoso **previo a BRAMUlab_V02**, exactamente el mismo bug que V02.1 (§28) ya había encontrado y corregido en *todos los demás* overlays genéricos reemplazándolo por `--scrim`. Este quedó afuera del barrido.
3. **"Agregar jugador sin cuenta" con texto verde/azul es intencional**, documentado en el propio V02.6 (§8) como decisión consciente (de CTA rellena a outline con texto del color de equipo). No es un accidente — pero vale la pena una decisión explícita en V02.8 sobre si se mantiene.
4. **El ritmo vertical de Resumen (26px entre CADA bloque, sin excepción) es la causa más probable de "se siente con demasiado aire"**: Home late a 12px entre tarjetas y Historial a 10px; Resumen aplica 26px por igual a una tarjeta de resultado grande, una nota corta y un grupo de botones — sin jerarquía.
5. **Setup ("Configurar partido") quedó afuera de la unificación de fondo de V02.7**: Historial, Ranking, Perfil, Carga manual, Confirmar partido y Resumen ya comparten `--bg-gradient-app`; Setup sigue sobre el `--ink` plano que V02.7 buscaba eliminar en toda la app funcional.
6. Existen ~85 líneas de **CSS muerto** (`.view--summary`, `.summary-card*`, `.summary-stats`, `.summary-actions`): la pantalla que estilaban fue retirada en V02.1 y nunca se borró el CSS.
7. Un bloque de `.status-banner` está **duplicado letra por letra** (líneas 400 y 421): sobrevivió de un rediseño anterior (V5) que un rediseño posterior (V7) debía reemplazar, no sumar.

**¿Recomiendo modularizar el CSS ahora?** No. Ver §8 de este informe — el archivo es grande pero está sano (bajo acoplamiento real, casi sin `!important`, casi sin overrides en cascada peleados). Modularizar en V02.8 agrega riesgo de romper algo en un momento en que el objetivo es cerrar versión, sin un beneficio proporcional todavía. Es candidato claro para post-V02.8, cuando el archivo pase ~2500-3000 líneas o cuando se sume una feature grande.

---

## 2. Inventario real de tokens y valores usados

### 2.1 Radios de borde (`border-radius`)

Conteo real de declaraciones en `styles.css` (811 reglas en total, ~102 declaran `border-radius`):

| Valor | Usos | Familia / rol real | Ejemplos |
|---|---|---|---|
| `50%` | 19 | Circular — avatares, puntos, botones de cierre redondos | `.player-card__avatar`, `.person-list__avatar`, `.overlay__close-x`, `.team-dot`, `.bottom-sheet__close` |
| `999px` | 24 | Pill — chips, badges, botones de acción secundaria, tracks de progreso | `.btn-mini`, `.history-mode-chip`, `.set-filter-tabs__btn`, `.bar-stat-row__bar`, `.court-saved-result__badge` |
| `4–8px` | 9 | Micro-controles cuadrados (celdas de marcador, selects, steppers) | `.scoreboard__cell` (6px), `.stepper-btn` (8px), `.edit-select` (8px), `.activity-bar` (5px), `.game-progression__dot`(4px) |
| `10px` | 13 | Filas funcionales compactas (stats, filas de barra, headers de acordeón, teclado) | `.bar-stat-row`, `.stat-row`, `.player-serve-row`, `.timeline-game__header`, `.load-keypad__key`, `.point-track__stop` |
| `11px` | **1 (atípico)** | — | `.court-team-card__player` (línea 1856) |
| `12px` | 9 | Superficie tocable estándar / fila de lista | `.option-col`, `.history-item`, `.person-list__item`, `.active-match-banner`, `.court-meta-line`, `.load-format-line`, `.player-search-field`, `.player-row` |
| `14px` | 10 | Tarjeta intermedia / sheet compacto | `.option-pill`, `.btn-secondary`, `.menu-sheet`, `.timeline-set`, `.sheet-option`, `.court-team-card`, `.court-note`, `.player-home-hitos__chip` |
| `16px` (literal) | 6 | Tarjeta estándar — **mismo valor que el token `--radius-card`, pero sin usarlo** | `.team-block`, `.btn-start`, `.result-card`, `.pastilla`, `.sheet-active-card`, y responsive de `.bottom-nav` (20px, ver abajo) |
| `var(--radius-card)` (16px) | 2 | Tarjeta estándar (vía token) | `.intelligence-card`, `#summary-manual-intelligence` |
| `18px` (literal) | 2 | Tarjeta protagonista — **mismo valor que `--radius-hero`, sin usarlo** | `.highlight-popup__card`, `.court-current-set` |
| `var(--radius-hero)` (18px) | 1 | Tarjeta protagonista (vía token) | `.player-home-lastmatch` (única tarjeta hero del Home) |
| `20px` / `20px 20px 0 0` | 4 | Modal grande / sheet inferior | `.overlay__card`, `.bottom-sheet`, `.bottom-sheet` responsive en `.bottom-nav` (desktop) |
| `0` | 1 | Deliberadamente sin radio (se funde con la tarjeta contenedora) | `.court-note__textarea` |

**Lectura:** el sistema de radios **ya existe conceptualmente** en 5 escalones reales (circular / pill / control chico ~4-10px / superficie tocable ~11-14px / tarjeta ~16-18px / modal ~20px) y es coherente. El problema no es que "hay demasiados radios", es que:
- Los dos radios más importantes (`--radius-card`, `--radius-hero`) **existen como token pero se usan como token solo 3 de 11 veces** — el resto son literales `16px`/`18px` sueltos que casualmente coinciden.
- Hay un valor huérfano real: `11px` en `.court-team-card__player` (línea 1856), a un pixel de los `12px` que usa el resto de la familia "superficie tocable".

### 2.2 Espaciado (gaps, márgenes, padding)

**Ritmo vertical "lista de bloques"** — la misma necesidad (separar tarjetas/secciones repetidas dentro de una vista con scroll) resuelta con 3 valores distintos según la pantalla:

| Pantalla | Mecanismo | Valor | Línea |
|---|---|---|---|
| Home (`.pastilla`) | `margin-bottom` | **12px** | `styles.css:1312` |
| Historial / Compañeros-Rivales (`.history-list`, `.person-list`) | `gap` (flex) | **10px** | `styles.css:1046`, `1055` |
| Resumen (`.analysis-section`, 8 secciones distintas) | `margin-bottom` | **26px** | `styles.css:825` |

26px es **más del doble** que los otros dos, y se aplica *idéntico* a una tarjeta de resultado grande, una tarjeta de BRAMU Intelligence, la nota privada y el grupo de botones finales — sin relación con el tamaño o peso de cada bloque. Ver hallazgo #C en §3.

**Padding interno de tarjeta**, por familia (consistente dentro de cada una):
- Tarjetas estándar (`.pastilla`, `.result-card`, `.intelligence-card`): `14–16px` vertical, `16–18px` horizontal — coherente.
- Filas compactas (`.bar-stat-row`, `.stat-row`): `10px 12px` — coherente.
- Superficies de Carga manual/Confirmar (`.court-meta-line`, `.load-format-line`, `.court-team-card`): `12px 14px` — coherente entre sí.

**Valores gemelos que podrían unificarse (bajo impacto):**
- `.court-meta-line{ margin: 4px 0 8px }` vs `.load-format-line{ margin: 4px 0 10px }` (`styles.css:1922`, `1937`) — dos componentes visualmente equivalentes (líneas editables de metadata en la misma pantalla) con 8px vs 10px de margen inferior.
- Line-height de texto de lectura: `1.4` (`.player-home-hitos__chip`), `1.5` (`.pastilla-momento__text`), `1.6` (`.intelligence-text p`) — tres valores cercanos para el mismo rol ("párrafo corto legible"), probablemente deriva orgánica más que 3 decisiones distintas.
- Tracking de micro-labels en mayúscula (9-11px): valores 0.03 / 0.04 / 0.05 / 0.06 / 0.07 / 0.08em conviven sin un patrón claro de por qué cada uno eligió el suyo (`styles.css:672,783,811,934,1068,1077,1751,1781,1882,1891`). Ninguno rompe nada, pero es más granularidad de la que el ojo puede distinguir.

**"96px" del despeje de la barra inferior** se repite como número suelto en 4 lugares (`styles.css:165, 588, 1295, 1307`) — siempre igual (sin deriva), pero no está en un token. Si el alto real de `.bottom-nav` cambia algún día, hay que recordar actualizar los 4 lugares a mano.

### 2.3 Bordes

El sistema tiene una regla implícita, real y coherente en el 90% de los casos:

- **"Fila" (ítem repetido de una lista)** → solo fondo, **sin borde**: `.history-item`, `.person-list__item`, `.stat-row`, `.bar-stat-row`, `.timeline-game__header`, `.player-serve-row`, `.highlight-row`.
- **"Tarjeta" (bloque de contenido autónomo)** → fondo + **borde 1px neutro** (`var(--line)`): `.pastilla`, `.result-card`, `.intelligence-card`, `.court-team-card`, `.court-current-set`, `.court-score`, `.sheet-active-card` (verde, ver abajo).
- **Borde de color con función jerárquica real** (nunca decorativo — siempre "esto es del Equipo A/B" o "esto está seleccionado/activo"):
  - Verde `--team-a`/`--brand-lime`: `.team-block`, `.team-block__label` dot, selección activa (`.option-col.is-selected`, `.option-pill.is-selected`, `.server-radio.is-selected`, `.court-score.is-active`), tarjeta hero del Home, "agregar jugador sin cuenta" en contexto Equipo A.
  - Azul `--team-b`/`--accent-cyan`: `.team-block--b`, mismas variantes de selección con `data-team="B"`, "agregar jugador sin cuenta" en contexto Rival, badge de Evolución del Nivel BRAMU (`SIMULADO · BETA`).
- **Excepción real y aislada, no intencional**: `.court-team-card__player` (línea 1854) usa borde neutro incluso para su variante `--fixed` (jugador ya confirmado, verde por fondo/texto) — el borde ahí NO sigue el color de equipo, solo el fondo/texto sí. Menor, pero rompe la regla "el color de borde indica pertenencia" en un solo lugar.

**Único caso donde el color de un borde parece accidental en vez de jerárquico**: ninguno detectado más allá del punto anterior — el resto del sistema de bordes de color está bien justificado por estado (selección) o pertenencia (equipo).

**La zona gris real** (ni bug ni sistema, zona intermedia): `.history-item` y `.person-list__item` se ven visualmente como tarjetas (esquinas redondeadas, contenido autocontenido, tocables individualmente) pero siguen la regla de "fila" (sin borde). Es el único punto donde la regla fila/tarjeta no es obvia a simple vista — ver hallazgo D en §3/§4.

### 2.4 Superficies y fondos

| Pantalla | Fondo | Fuente |
|---|---|---|
| Home (`#view-player-home`) | Degradé propio, hardcodeado: `linear-gradient(180deg, #08121E 0%, var(--bg) 45%, var(--bg-deep) 100%)` | `styles.css:155` |
| Historial / Ranking / Perfil / Compañeros-Rivales / Resumen / Timeline (`.view--analysis`, `.view--history`) | `var(--bg-gradient-app)` (token compartido desde V02.7) | `styles.css:820` |
| Carga manual / Confirmar partido (`.view--court`) | `var(--bg-gradient-app)` (mismo token, alineado en V02.7 §1) | `styles.css:1818` |
| **Setup / Configurar partido (`.view--setup`)** | **Sin override — hereda `html,body{background:var(--ink)}` plano** | `styles.css:133-135`, `163-167` |
| Partido en vivo (`.view--match`) | Atmósfera propia por diseño (pantalla de control táctil, no de lectura — documentado en `styles.css:1151`) | `styles.css:325` y siguientes |

Setup es la única pantalla "funcional" que quedó fuera de la unificación de fondo de V02.7 — sigue viéndose plana/negra, exactamente el problema que el comentario de `--bg-gradient-app` (líneas 19-26) describe haber resuelto para el resto de la app.

**Colores "casi-superficie" hardcodeados que no pasan por la escala `--surface-*`:**
- `#050C0A` en `.scoreboard` (línea 364) — a un paso de `--bg-deep` (#03070D) pero no es el mismo valor.
- `#05100E` mencionado en un comentario (línea 1144) como fondo ya corregido de una vieja versión de `.view--summary` — hoy vive en CSS muerto (ver §3).
- `rgba(244,247,242,X)` — **21 apariciones**, un "blanco" de overlay hardcodeado que no coincide con el token real de texto (`--text: #F8FAFC` = `rgb(248,250,252)`). Es el "blanco de sistema" de facto para fondos tenues (`.scoreboard__cell`, `.edit-chip`, tracks de `.bar-stat-row`, `.activity-bar`, `.momentum-untracked-pill`, tags de `.timeline-tag`, `.evolution-chart__grid`, etc.) pero nunca se migró a un token cuando se definió la paleta actual.

### 2.5 Tipografía — títulos y encabezados

Familia real de "título de sección/encabezado" por tracking (`letter-spacing`), con conteo de usos:

| Tracking | Casos | Rol |
|---|---|---|
| **0.03em** | 12 | **El valor dominante real** — `.bottom-sheet__title`, `.pastilla__title`, `.analysis-header__title`, `.analysis-section__title`, `.court-header__status`, `.court-header__status--saved`, `.timeline-set__header--static`, `.summary-card__title` (CSS muerto), `.player-home-lastmatch__title`, `.load-player-sheet__section-label`, `.manual-field-label`, `.match-header__mode` |
| 0.1em | **1 familia (~18 instancias de HTML)** | `.overlay__title` — Notificaciones, Pausa, Finalizar partido, Corregir marcador, Ajustar marcador, ¿Quién sos?, Sistema de puntuación, etc. |
| 0.12em | 1 | `.setup-section__title` |
| 0.04–0.08em | 10 | Micro-labels chicos (9-11px), no compiten con los títulos, ver §2.2 |

**Confirmado en el código:** "NOTIFICACIONES" (`index.html:1303`) usa exactamente la misma clase `.overlay__title` que otros ~17 modales (Pausa, Finalizar partido, Corregir marcador, Corrección rápida, Ajustar marcador, ¿Quién está sacando?, Tie break, Ajustar games, Editar jugadores, Resolver con Tie break, Hay una nueva versión, Sistema de puntuación, ¿Quién sos?, Hay un partido en curso). **No es un caso puntual mal tipeado** — es un valor de sistema (20px, tracking 0.1em, color `--brand-lime`) que quedó de una época anterior del diseño y nunca se realineó con el tracking 0.03em que terminó ganando en el resto de la app (sheets, headers, cards).

"ELEGIR JUGADOR" (título dinámico que cambia a "ELEGIR COMPAÑERO"/"ELEGIR RIVAL" vía JS, `app.js:595`) usa `.bottom-sheet__title` — 14px, tracking 0.03em, color blanco. Comparado con `.overlay__title`: **6px más chico, 3.3x menos tracking, y color distinto** (lima vs. blanco). Son familias de componente distintas a propósito (modal centrado vs. hoja inferior), pero conceptualmente ambas cumplen el mismo rol — "encabezado de superficie modal" — y hoy leen como dos sistemas tipográficos distintos en vez de dos variantes de uno solo.

**Mayúsculas:** el 90% de los títulos "de sistema" van en mayúscula, pero por convención de contenido (el HTML se tipea en caps), no porque `.overlay__title` fuerce `text-transform:uppercase` — la regla no existe. `#confirm-title` (usado por `confirmAction()`, `app.js:2904`) es la única instancia dinámica y **consistentemente** usa oración/pregunta normal ("¿Salir sin guardar?", "Reiniciar partido", "¿Confirmar?") en vez de mayúscula. Es una distinción de contenido real y consistente (label fijo vs. pregunta de confirmación) pero **no está garantizada por CSS** — depende de que cada desarrollador seguido recuerde tipear en mayúscula los labels fijos.

**Font-size de "números protagonistas"** (marcadores/puntajes/porcentajes), de mayor a menor jerarquía: `clamp(56,24vh,124px)` (marcador en vivo) → `clamp(36,11.3vw,44px)` (score del último partido, Home) → `52px` (marcador de Carga manual) → `30px` (Nivel BRAMU) → `22px`/`21px`/`20px` (resultado de sets, Resumen/Historial) → `17px` (fila de estadística) → `16px` (donut de efectividad). Es una escala descendente real y con sentido (a mayor protagonismo de pantalla, mayor tamaño), pero **no está documentada como escala** — cada valor es literal, sin relación matemática explícita ni tokens, lo que hace fácil que una futura tarjeta nueva elija un tamaño arbitrario en vez de reusar uno de estos 7 escalones ya existentes.

### 2.6 Sombras y glows

| Grupo | Valores | Rol |
|---|---|---|
| Glow decorativo permanente (lima) | `0 0 8px rgba(149,255,25,.16)` (barra de actividad), `0 0 6px rgba(149,255,25,.45)` (aro de efectividad), `0 0 14/16/22px rgba(...,.10-.20)` (hito destacado, tarjeta hero) | Da "vida" sutil, documentado explícitamente como "nunca neón" en varios comentarios (V02.6 §3.1/§3.2) |
| Glow de pulso de equipo (banda de estado) | 9 keyframes distintos (`teamBannerPulse{A,B,Both}`, `...Set{A,B,Both}`, `...Match{A,B,Both}`) | Jerárquico real: intensidad crece Break < Set < Match, a propósito |
| Sombra de elevación de contenedor ancho (desktop) | `0 0 60px rgba(0,0,0,0.5)` repetida 4 veces (`.view--match`, `.view--analysis/.view--history`, `.view--court`, versión landscape de `.view--match`) | Consistente — mismo valor en las 4, ninguna deriva |
| Sombra de botón CTA lima | `0 10px 24px rgba(149,255,25,0.22)` (`.btn-start`), `0 8px 20px rgba(149,255,25,0.22)` (`.court-continue-btn`), `0 6px 16px rgba(149,255,25,0.4)` (FAB) | Misma familia, 3 intensidades distintas para 3 pesos de botón distintos (CTA de formulario / CTA de carga manual / FAB flotante) — parece jerarquía real, no duplicado |
| Sombra de tab activa | `0 -3px 10px rgba(0,0,0,0.16)` (`.history-tab.is-active`) | Único uso, sin conflicto |
| `filter: drop-shadow` | Splash (`.app-splash__b`, frozen/no tocar), aro de efectividad (`.effectiveness-donut__fill`) | Dos usos, sin superposición |
| `text-shadow` | `.team-zone__score` (glow del marcador en vivo, verde/azul, 34px), Punto de Oro/Star (40px, `!important`) | Coherente — jerarquía de "cuanto más especial el punto, más glow" |

**No se encontraron sombras duplicadas problemáticas.** El único patrón que vale la pena simplificar (no visualmente, sí en el código) son los 9 keyframes de pulso de banda: son variaciones del mismo patrón (`brightness` + `box-shadow` en 0%/50%/100%) repetidas para cada combinación de equipo × nivel de escalada, en vez de un solo keyframe parametrizado con variables CSS. No es un problema visual — es mantenibilidad (ver §8).

---

## 3. Inconsistencias encontradas (verificadas en código, priorizadas)

### 🔴 Prioridad alta

**A. `.overlay--highlight` usa el negro-verdoso pre-V02, no `--scrim`** — `styles.css:641`
```css
.overlay--highlight{ background: rgba(11,18,17,0.55); ... }
```
Es el mismo bug exacto que V02.1 (§28, comentario en `styles.css:597-601`) encontró y corrigió en *todos* los overlays genéricos, reemplazándolo por `--scrim` (`rgba(1,5,10,0.78)`). Este caso puntual (el popup de clasificar un Highlight) no usa la clase base `.overlay`, así que quedó fuera de aquel barrido. Hoy el popup de Highlight tiene un tinte de fondo sutilmente distinto (verdoso) al resto de los overlays de la app (azul noche).

**B. Duplicado exacto de `.status-banner`** — `styles.css:400` y `styles.css:421`
Dos bloques de regla **idénticos carácter por carácter** (mismo `display`, `padding`, `font`, `background`, `border-bottom`). El bloque de la línea 421 (comentado como "V7") debía reemplazar al de la línea 400 ("V5"), no convivir con él. Cascada-wise no rompe nada (el segundo gana, siendo idéntico), pero es ruido puro: 7 líneas sin ningún efecto. Mismo patrón con `.band-seg`(407/428) y `.band-seg--team::before`(409/435, con opacidad 0.55 vs 0.6 — el primero queda muerto).

**C. Ritmo vertical de Resumen sin jerarquía (26px parejo entre 8 bloques muy distintos)** — `styles.css:825`
```css
.analysis-section{ margin-bottom: 26px; }
```
Se aplica idéntico entre: tarjeta de resultado (grande, con su propio padding interno de 16-18px) → BRAMU Intelligence → Estadísticas → Evolución → Momentos clave → Notas privadas (tarjeta chica) → grupo de botones (Compartir/Editar/Volver). Es, con alta probabilidad, la causa concreta de la percepción "hoy se percibe demasiado espacio entre bloques" que describe el pedido (caso C). Comparado con Home (12px entre tarjetas) y Historial (10px entre ítems), 26px es 2.2× a 2.6× más — sin que ningún bloque de Resumen sea deliberadamente "más importante" que el resto salvo el resultado en sí.

**D. Línea de fecha/formato pegada a la primera tarjeta (4px), el resto separado a 26px** — `styles.css:602` + `styles.css:825`
```css
.analysis-meta{ margin: 0 0 4px; ... }      /* fecha/formato */
.analysis-section{ margin-bottom: 26px; }    /* separa TODO el resto */
```
Es la asimetría contraria a la anterior: mientras cada bloque de Resumen respira 26px, el único elemento que debería tener aire de "encabezado de pantalla" (fecha/formato antes del resultado) tiene solo 4px — 6.5× menos que el resto de los espacios de la misma pantalla.

### 🟠 Prioridad media

**E. Setup quedó fuera de la unificación de fondo de V02.7** — `styles.css:163-167`
`.view--setup` no tiene ningún `background` propio, así que hereda el `--ink` plano de `html,body`. Historial, Ranking, Perfil, Carga manual, Confirmar partido y Resumen ya migraron a `--bg-gradient-app` en V02.7; Home tiene su propio degradé. Setup es la única pantalla funcional que hoy se ve "plana/negra" — el efecto exacto que V02.7 buscó eliminar (ver comentario `styles.css:19-26`).

**F. Radio huérfano de 1px: `.court-team-card__player` en 11px** — `styles.css:1856`
Toda la familia de "superficie tocable" (opciones, filas de lista, chips grandes) usa 12px o 14px. Este único componente usa 11px — indistinguible a simple vista del resto, pero rompe la consistencia matemática del sistema sin ninguna razón visible en los comentarios.

**G. `--radius-card` / `--radius-hero` existen pero se usan como literal la mayoría de las veces**
`--radius-card` (16px): usado como token 2 veces, como literal `16px` 6 veces más (`.team-block`, `.btn-start`, `.result-card`, `.pastilla`, `.sheet-active-card`). `--radius-hero` (18px): usado como token 1 vez, como literal `18px` 2 veces más (`.highlight-popup__card`, `.court-current-set`). Hoy coinciden en valor por casualidad de mantenimiento manual, no por referencia real — si alguna vez se decide ajustar `--radius-card`, 6 de 8 usos no se actualizarían solos.

**H. "Blanco de overlay" hardcodeado (`rgba(244,247,242,X)`, 21 usos) nunca migrado a token**
No coincide con `--text` (#F8FAFC = 248,250,252). Es un remanente de la paleta anterior a la unificación de V02.5/V02.6 (ambas rondas hicieron "barridos de RGB hardcodeado" según sus propios comentarios) que sobrevivió específicamente en este valor porque se usa siempre como *fondo tenue*, no como texto — por eso no saltó a la vista en los barridos anteriores, que se enfocaron en textos/acentos.

**I. CSS muerto: la vieja pantalla "Resumen inmediato" (`.view--summary`) — ~15 líneas**
`styles.css:726-745` (`.view--summary`, `.summary-undo-btn` es la excepción viva — se reutiliza en Resumen, ver `index.html:599-600` — pero `.summary-card`, `.summary-card__title`, `.summary-card__meta`, `.summary-card__reason`, `.summary-stats`, `.summary-actions`, más su regla responsive en `styles.css:1174`) no tienen ningún elemento HTML que las use — la pantalla que estilaban fue retirada en V02.1 (§13/§15) y el CSS nunca se limpió.

### 🟡 Prioridad baja (pulido, no urgente)

**J. Texto verde/azul en "Agregar jugador sin cuenta" — decisión ya tomada, pero vale revalidar**
`styles.css:2039-2040`. Es intencional y está documentado (V02.6 §8): se cambió a propósito de CTA rellena a texto/borde del color de equipo. El pedido de esta ronda (caso B) sugiere que hoy, viéndolo de nuevo, podría sentirse "demasiado teñido" para una acción secundaria. No es un bug — es una decisión de V02.6 que quizás valga la pena reabrir con una mirada fresca en V02.8 (ver §6).

**K. Micro-variaciones sin impacto visible real**: `.court-team-card__player` con borde siempre neutro incluso en su variante `--fixed` (verde por fondo/texto); `margin-bottom` de `.court-meta-line`(8px) vs `.load-format-line`(10px); line-height 1.4/1.5/1.6 en tres textos de lectura corta; 6 valores de tracking distintos (0.03-0.08em) en micro-labels de 9-11px.

---

## 4. Diferencias que conviene mantener (no normalizar)

- **Home (`.pastilla`, radio 16px, borde 1px) vs. Historial/Compañeros (`.history-item`/`.person-list__item`, radio 12px, sin borde):** son dos familias de componente con roles distintos — Home es un *dashboard de widgets* con identidad propia por tarjeta; Historial es una *lista de registros homogéneos*. La ausencia de borde en filas de lista (vs. tarjetas con borde) es, de hecho, la regla general de todo el sistema (ver §2.3) — Historial la sigue correctamente. Lo único ambiguo es que *visualmente* estas filas leen como tarjetas por su radio 12px + padding generoso; aun así, no hay evidencia de que igualarlas a Home sea mejor — son conceptos distintos y **no deberían normalizarse solo por parecido superficial**.
- **`.view--match` con atmósfera propia** (fondo, tipografía de números, glows de equipo): es, por diseño explícito (`styles.css:1151`), la única pantalla de control táctil en tiempo real, no de lectura — su lenguaje visual más intenso (glows de pulso, colores a pantalla completa en Punto de Oro/Star) está justificado y no debería diluirse para parecerse al resto.
- **Jerarquía de tamaño de "números protagonistas"** (marcador en vivo > score del Home > marcador de carga manual > resultado de Resumen/Historial > estadísticas): es una escala real y con sentido, no una inconsistencia — ver §2.5. Conviene documentarla como escala (§5.5), no aplanarla a un solo tamaño.
- **Intensidad de glow creciente en la banda de estado** (Break < Set < Match Point): documentada y correcta — no es "3 glows random", es jerarquía de urgencia.
- **`#confirm-title` en oración/pregunta vs. el resto de `.overlay__title` en mayúscula**: distinción de contenido real y consistente en el código actual (confirmaciones dinámicas vs. labels fijos) — mantenerla, pero considerar reforzarla por CSS en vez de por convención humana (ver §6).
- **Fondo propio del Home** (`#view-player-home`, degradé bespoke con `#08121E`) distinto de `--bg-gradient-app`: documentado a propósito en V02.6/V02.7 como "un escalón más intenso arriba" para que el Home se sienta la pantalla ancla — no es una inconsistencia, es la única excepción declarada explícitamente y con razón visual (contraste con las tarjetas que arrancan pegadas al header).

---

## 5. Propuesta de sistema visual normalizado

No es una propuesta de "todo igual" — es nombrar y afirmar el sistema de variantes que **ya existe** en la práctica, para que las próximas pantallas lo reusen en vez de inventar valores nuevos por al lado.

### 5.1 Radios (afirmar 5 escalones, ya reales)
1. **Circular** — `50%` (avatares, dots, cierres redondos).
2. **Pill** — `999px` (badges, chips, botones secundarios pequeños, tracks).
3. **Control chico** — `8px` (steppers, selects, celdas de marcador). Consolidar el disperso 4-10px de esta familia hacia 8/10px según ya predomina.
4. **Superficie tocable** — `12px` (filas de lista, opciones, líneas de metadata). Corregir el huérfano de 11px (`.court-team-card__player`) a 12px.
5. **Tarjeta estándar** — `var(--radius-card)` = 16px. Migrar los 6 usos literales a la variable.
6. **Tarjeta protagonista** — `var(--radius-hero)` = 18px. Migrar los 2 usos literales a la variable.
7. **Modal/sheet grande** — `20px` (esquinas superiores en sheets, `.overlay__card`).

(La familia "14px" — `.option-pill`, `.sheet-option`, `.court-team-card`, `.court-note`, `.menu-sheet` — funciona bien como escalón intermedio real entre 12 y 16; no requiere cambios, solo reconocerla como el 4.5° escalón válido.)

### 5.2 Spacing (afirmar, no igualar a la fuerza)
- **Ritmo de "lista de tarjetas repetidas"**: mantener 10-12px como familia (Historial 10px, Home 12px son intercambiables sin pérdida de significado — se puede dejar así o unificar a uno solo, es indistinto).
- **Ritmo de "secciones de una pantalla de detalle" (Resumen)**: bajar de 26px a un valor en la misma familia que el resto (12-16px), y **dejar de aplicarlo parejo**: la tarjeta de Resultado (el bloque más importante) puede llevar más aire debajo (ej. 20px) que Notas privadas → grupo de botones (ej. 12px). Jerarquía de espaciado, no un solo número para 8 casos distintos.
- **Encabezado de pantalla → primer bloque de contenido**: fijar un valor único para "aire bajo el título/meta de una vista" (ej. 12-16px) y usarlo tanto en `.analysis-meta` (hoy 4px) como en cualquier encabezado equivalente.
- Tokenizar el `96px` de despeje de `.bottom-nav` (ej. `--bottom-nav-clearance`) para no repetirlo suelto en 4 lugares.

### 5.3 Bordes (afirmar la regla fila/tarjeta, ya real)
- **Fila de lista → sin borde**, solo fondo.
- **Tarjeta autónoma → borde 1px `var(--line)`**, salvo que tenga una razón jerárquica (selección, pertenencia de equipo, estado activo) para llevar borde de color.
- Documentar esta regla explícitamente en el propio CSS (un comentario en el bloque de `:root`) para que la próxima tarjeta nueva la siga a propósito, no por casualidad.
- Decidir, no dejar ambiguo: si Historial/Compañeros-Rivales deben seguir siendo "filas" (sin borde) o pasar a "tarjeta" — cualquiera de las dos es válida, pero hoy es una decisión implícita, no explícita.

### 5.4 Superficies
- Cerrar el caso de Setup: darle `--bg-gradient-app` como el resto de la app funcional (ver recomendación en §6) — sacaría la última pantalla plana que queda.
- Migrar `rgba(244,247,242,X)` a una variable propia (ej. `--overlay-tint` o reusar `--text` con opacidad) para que el "blanco de fondo tenue" de la app sea *un* valor, no un literal repetido 21 veces.

### 5.5 Tipografía
- Declarar 0.03em como el tracking oficial de "título de superficie" (sheet/card/header) y migrar `.overlay__title` a ese valor — o, si se prefiere mantener el modal centrado como una familia visualmente más "grande" a propósito, bajar su tracking a algo cercano (0.04-0.05em) sin llegar a 0.1em, que hoy es un salto de 3x sin justificación de diseño documentada.
- Documentar (como comentario o como tabla, no necesariamente como variables CSS) la escala de tamaños de "número protagonista" descrita en §2.5, para que la próxima tarjeta con un número grande elija uno de los 7 escalones existentes en vez de un valor nuevo.
- Reforzar por CSS (no solo por convención) la distinción mayúscula-label vs. oración-pregunta en títulos de overlay, si se quiere que sea confiable a futuro.

### 5.6 Glows
- Mantener el sistema actual tal cual (está bien pensado y documentado). Único cambio sugerido: refactorizar los 9 keyframes de pulso de banda a 1-2 keyframes parametrizados con `custom properties` (color/intensidad como variable), por mantenibilidad de código — sin cambiar el resultado visual.

---

## 6. Recomendaciones concretas para V02.8

Priorizadas por impacto visual real vs. esfuerzo de implementación (todas son cambios acotados, de bajo riesgo, sin tocar lógica):

1. **Corregir `.overlay--highlight`** → reemplazar `rgba(11,18,17,0.55)` por `var(--scrim)` (hallazgo A). Un cambio de una línea, mismo criterio ya aplicado en V02.1.
2. **Borrar el `.status-banner`/`.band-seg` duplicado** de la línea 421-435 en favor del de 400-410 (hallazgo B), o viceversa — son idénticos, cualquiera de los dos se puede eliminar sin efecto visible.
3. **Rehacer el ritmo vertical de Resumen** (hallazgos C y D): bajar `.analysis-section{ margin-bottom }` de 26px a un valor acorde al resto de la app, y darle aire real a `.analysis-meta` antes de la primera tarjeta.
4. **Definir el título del modal Notificaciones/overlays genéricos** (el pedido original de esta ronda): alinear `.overlay__title` con el tracking 0.03em que domina el resto del sistema, o bajarlo a un valor intermedio si se quiere conservar cierta diferencia deliberada con los títulos de sheet.
5. **Dar fondo a Setup** (hallazgo E): sumar `--bg-gradient-app` a `.view--setup` para terminar la unificación que V02.7 dejó pendiente en esa única pantalla.
6. **Decisión sobre "Agregar jugador sin cuenta"** (hallazgo J): confirmar si el texto verde/azul se mantiene (documentado, intencional) o se vuelve a blanco con borde de color — es una decisión de diseño, no una corrección técnica.
7. **Limpiar el CSS muerto de `.view--summary`** (hallazgo I) — sin riesgo, nada lo usa.
8. **Corregir el radio huérfano de `.court-team-card__player`** de 11px a 12px (hallazgo F).

Los hallazgos G y H (migrar literales a `--radius-card`/`--radius-hero`, tokenizar el blanco de overlay) son de bajo riesgo pero tocan muchas líneas dispersas — se pueden incluir en V02.8 si hay tiempo, o pasar a la lista de "después" sin urgencia, ya que hoy no producen ningún efecto visual incorrecto (solo fragilidad futura).

---

## 7. Recomendaciones para después de V02.8

- Migrar los 8 literales `16px`/`18px` que coinciden con `--radius-card`/`--radius-hero` a la variable real (hallazgo G) — trabajo mecánico, sin apuro.
- Migrar `rgba(244,247,242,X)` (21 usos) a un token propio (hallazgo H).
- Refactorizar los 9 keyframes de pulso de banda de equipo a una versión parametrizada (mantenibilidad de código, no cambio visual).
- Tokenizar el `96px` de despeje de `.bottom-nav`.
- Revisar si Historial/Compañeros-Rivales deben pasar de "fila sin borde" a "tarjeta con borde" — no es urgente, es una decisión de identidad visual que puede esperar a que haya una razón de producto para tocar esa pantalla igual.
- Reforzar por CSS la convención mayúscula/oración de títulos de overlay.
- Si en algún momento se agrega una nueva pantalla de lectura larga (tipo Resumen/Historial), reusar la escala de spacing definida en §5.2 en vez de definir una nueva.

---

## 8. Evaluación de arquitectura CSS y consumo/mantenibilidad

**Tamaño actual:** 2122 líneas, ~811 reglas, 40 selectores por ID, 21 media queries, 20 `@keyframes`, solo 3 usos de `!important`, y 201 bloques de comentario (prácticamente 1 comentario cada 10 líneas de código).

**Lo que está sano:**
- Casi no hay `!important` (3 en todo el archivo, y los 3 justificados — sobrescribir color/text-shadow de Punto de Oro por encima del color de equipo, un caso legítimo de máxima prioridad visual).
- Los pocos casos de "regla más específica declarada después a propósito" están documentados explícitamente en el propio CSS como advertencia para no reordenar por accidente (ej. `styles.css:1624-1630`, `1679-1687`) — señal de un equipo/asistente consciente del problema de cascada, no de caos.
- El uso de tokens de color es alto y consistente; el 90% de los colores pasan por variables.
- Los selectores por ID (40) son en su mayoría justificados: excepciones puntuales de una pantalla específica sobre un componente compartido (ej. `#adjust-body .point-track__stop.is-selected` para dar color de equipo en vez de dorado solo dentro de Ajustar) — es acoplamiento, pero acotado y documentado, no un patrón descontrolado.

**Lo que pesa:**
- El archivo es **monolítico**: una sola hoja de estilos para ~9 pantallas + overlays + sheets + tema de partido en vivo. Encontrar una regla exige buscar por nombre de clase, no por ubicación.
- 201 comentarios (excelente para trazabilidad histórica) también significan que **el archivo real de "solo CSS" es más chico de lo que aparenta** — probablemente ~1600-1700 líneas de reglas puras — pero igual sigue siendo un solo archivo grande.
- Existen ~85 líneas de CSS confirmado muerto (§3, hallazgo I) — señal de que nada barre el archivo periódicamente para retirar lo que las features retiradas dejan atrás.
- El duplicado exacto de `.status-banner` (hallazgo B) es evidencia de que, al menos una vez, un rediseño completo de un bloque se sumó en vez de reemplazar al anterior.

**¿Conviene modularizar ahora (V02.8)?**

**No.** Razones concretas:
1. El archivo, pese a su tamaño, **no muestra los síntomas que la modularización resuelve**: no hay guerra de especificidad, casi no hay `!important`, los overrides de cascada están documentados y son deliberados. Partirlo en archivos no arregla ninguno de los 9 hallazgos reales de esta auditoría — todos son valores puntuales, no un problema de organización de archivo.
2. Dividir en `tokens/base/layout/components/views/utilities` significa decidir, para cada una de las ~811 reglas, en qué balde entra — con reglas que hoy mezclan layout+color+tipografía en una sola declaración (como casi todo este archivo), esa clasificación no es mecánica, es trabajo de diseño de arquitectura. Hacerlo en la misma ronda que se busca *cerrar* una versión introduce riesgo de romper algo (un selector que dependía de su posición en la cascada) justo cuando el objetivo es estabilidad.
3. El beneficio real de modularizar (más fácil de navegar, menos scroll, ownership más claro por carpeta) todavía no compensa el costo, porque **hoy un solo desarrollador/asistente edita todo el archivo** — el dolor de "20 personas pisándose el archivo" que la modularización resuelve en equipos grandes no aplica acá.

**¿Cuándo sí conviene?** Cuando pase alguna de estas señales, lo que hace sentido esperar sea alrededor de V03 o cuando se sume una feature grande nueva (torneos, cuentas reales, ranking):
- El archivo supera ~2500-3000 líneas.
- Aparece una segunda persona (o un segundo asistente en paralelo) editando CSS regularmente.
- Se repite un bug de "esta regla ganaba por orden de aparición, no por especificidad" más de una vez (hoy pasó 2 veces documentadas, ambas ya resueltas y con comentario de advertencia).

**Estructura propuesta para ese momento** (no implementar ahora, solo dejar planteada):
```
styles/
  tokens.css        → todo el :root actual (colores, radios, motion, safe-area)
  base.css          → reset, html/body, tipografía global, keyframes compartidos
  layout.css        → .view--*, anchos responsive, grid de partido en vivo
  components/
    cards.css        → .pastilla, .result-card, .intelligence-card, .court-*-card
    buttons.css       → .btn-*, .sheet-option, .court-continue-btn
    overlays.css      → .overlay*, .bottom-sheet*, .menu-sheet
    lists.css        → .history-item, .person-list, .timeline-*
    forms.css        → .field, .team-block, .option-*, .edit-*
  views/
    home.css, match.css, analysis-history.css, court-load.css, setup.css
  utilities.css     → clases chicas de una sola declaración, helpers
```
Riesgo de hacerlo ahora: alto para el beneficio actual. Riesgo de postergarlo: bajo, siempre que se seleccione un punto de corte razonable (alguna de las señales de arriba) en vez de dejarlo crecer indefinidamente sin revisar.

---

## Anexo — referencias de línea citadas en este informe

Todas las citas usan `bramulab/styles.css:N` salvo que se indique otro archivo. Líneas verificadas contra el commit `f789631` (última modificación real de `styles.css`, integrada en V02.7).
