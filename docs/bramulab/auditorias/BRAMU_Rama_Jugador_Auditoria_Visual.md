# BRAMU Lab — Rama Jugador
## Auditoría visual: inventario completo del sistema gráfico actual

Análisis únicamente, organizado para una revisión de diseño (no solo técnica). No se propone ninguna estética nueva ni se modificó ningún valor — todo lo que sigue es lo que existe hoy en `bramu-lab/styles.css` (1114 líneas), `index.html` y el HTML generado por `app.js`.

---

## A. Colores

Todos los colores "de sistema" viven en `:root` (`styles.css:6-27`). La frecuencia es la cantidad de líneas de CSS que usan `var(--x)`; no incluye usos dentro de `app.js` (HTML/SVG generado dinámicamente), que se listan aparte.

### A.1 — Paleta con variable (la base del sistema)

| Muestra (nombre descriptivo) | HEX / valor | Variable CSS | Dónde se usa | Frecuencia (líneas) |
|---|---|---|---|---|
| Negro verdoso — fondo base | `#0B1211` | `--ink` | Fondo de `html,body`, marcador en vivo, scoreboard, splash | 14 |
| Verde oscuro — superficie de tarjeta | `#10201D` | `--ink-soft` | Fondo de tarjetas: `team-block`, `pastilla`, `history-item`, `overlay__card`, `menu-sheet`, `stat-row`, etc. | 21 |
| Verde oscuro claro — superficie secundaria | `#16281F` | `--ink-softer` | Inputs/chips (`stepper-btn`, `edit-select`, `edit-chip`), fondo de opciones no seleccionadas | 14 |
| Blanco hueso — texto principal | `#F4F7F2` | `--paper` | Color de texto por defecto (`body`), títulos, valores destacados | 35 directas + base de `paper-dim`/`paper-faint` |
| Blanco hueso 56% — texto secundario | `rgba(244,247,242,0.56)` | `--paper-dim` | Microtextos, labels, subtítulos — el color de texto más usado del sistema | 62 |
| Blanco hueso 30% — texto terciario | `rgba(244,247,242,0.30)` | `--paper-faint` | Textos deshabilitados/menos importantes, placeholders de iconos | 19 |
| Lima — Equipo A / acento primario | `#C8FF3D` | `--team-a` | Equipo A en todo el marcador/estadísticas, ítem activo de la barra inferior, foco de inputs | 36 |
| Lima oscuro (variante) | `#7FBF14` | `--team-a-deep` | **Definida pero sin uso real en `styles.css`** — ver Inconsistencias (E) | 0 |
| Celeste — Equipo B | `#33A6FF` | `--team-b` | Equipo B en todo el marcador/estadísticas | 29 |
| Celeste oscuro (variante) | `#1E6FBF` | `--team-b-deep` | Borde de acento en un único lugar + color de texto de "Deshacer" en el toast | 2 |
| Dorado — acción principal | `#FFC93D` | `--gold` | Botones primarios (`btn-start`, `btn-mini`, FAB "+"), Punto de Oro, títulos de overlay | 35 |
| Naranja dorado — Star Point | `#FFA93D` | `--star` | Solo el sistema de puntuación "Star Point" (banner, glow) | 3 |
| Rojo coral — error / derrota / eliminar | `#FF5B54` | `--danger` | Botón eliminar en Historial, derrota en Forma Reciente, mensajes de error | 6 |
| Verde confirmación | `#2ECC71` | `--confirm-green` | Un solo uso: estado "confirmado" del popup de Highlight | 1 |
| Línea sutil (borde estándar) | `rgba(244,247,242,0.10)` | `--line` | Borde de prácticamente todas las tarjetas/inputs/separadores | 49 |

### A.2 — Colores usados fuera de variable (hardcodeados)

Estos NO están en `:root`; aparecen como literales sueltos en distintos puntos del archivo.

| Muestra (nombre descriptivo) | HEX / valor | Dónde aparece | Repeticiones |
|---|---|---|---|
| Negro cálido — texto sobre dorado | `#1A1400` | `btn-mini`, `btn-start`, banners Punto de Oro/Star Point, FAB "+" de la barra inferior | 5 |
| Negro verdoso — variante A del fondo casi-negro | `#050907` | Splash de arranque (gradiente) | 1 |
| Negro verdoso — variante B del fondo casi-negro | `#050C0A` | Fondo del scoreboard en vivo | 1 |
| Negro verdoso — variante C del fondo casi-negro | `#05100E` | `view--summary` (según su propio comentario en el código, es "un tris distinto" de `--ink` a propósito) | 1 |
| Negro — texto sobre banner Equipo A | `#0C1400` | Banner de estado cuando domina Equipo A | 1 |
| Negro azulado — texto sobre banner Equipo B | `#041420` | Banner de estado cuando domina Equipo B | 1 |
| Verde muy oscuro — texto sobre verde confirmación | `#06210F` | Highlight confirmado | 1 |
| Rojo claro — variante de danger sin token | `#FF8A84` | Etiqueta "BREAK" del timeline | 1 |

**Lectura para diseño:** hay 3 negros casi idénticos (`--ink` `#0B1211`, `#050907`, `#050C0A`, `#05100E`) haciendo el mismo trabajo en distintos lugares, y el color "texto sobre dorado" (`#1A1400`) se repite 5 veces como literal en vez de ser una variable — es el candidato más claro a tokenizar.

### A.3 — Transparencias recurrentes (`rgba(...)`)

79 apariciones de `rgba()` en el archivo. La gran mayoría son variantes de opacidad de los colores de la tabla A.1 (glows, sombras, fondos de estado "seleccionado") escritas como tripleta literal en vez de una función de opacidad sobre la variable — por ejemplo `rgba(255,201,61,0.10)` en vez de una forma de expresar "dorado al 10%". Es un patrón consistente en todo el archivo (no es algo que la Rama Jugador haya introducido distinto), pero significa que cualquier retoque de un color base requeriría revisar manualmente todas sus variantes de opacidad.

---

## B. Tipografía

Dos familias, ambas por Google Fonts (`styles.css:4`):

| Variable | Familia | Fallback | Uso previsto |
|---|---|---|---|
| `--font-display` | Oswald (500, 700) | Arial Narrow, system-ui | Números, títulos, marcador — la voz "de marca" |
| `--font-body` | Manrope (500, 700, 800) | -apple-system, Segoe UI | Texto de cuerpo — es el default de `html,body`, así que la mayoría de los elementos la heredan sin declararla explícitamente |

`var(--font-display)` se declara explícitamente 39 veces; `var(--font-body)` solo 5 veces (porque ya es la heredada por defecto).

**No existe una escala tipográfica formal.** No hay variables de tamaño de fuente ni de peso — cada regla define su propio `font-size`/`font-weight` en píxeles/número directo. Catálogo completo de valores en uso:

| Tamaño | Nº de reglas | Peso(s) que acompañan | Ejemplos de uso / función |
|---|---|---|---|
| 8–9px | 6 | 700, 800 | Microlabels extremos (footer, sub-badges) |
| 10px | 15 | 700, 800 | Labels de control-bar, chips de stat |
| 11px | 27 | 700, 800 | Microlabels/uppercase generalizados (el tamaño más común para "etiqueta") |
| 12px | 30 | 700, 800 | Texto secundario general, botones `link-btn`/`btn-mini` |
| 13px | 26 | 700, 800 | Texto de cuerpo estándar en overlays y tarjetas |
| 14px | 12 | 700 | Inputs, algunos botones secundarios |
| 15–16px | 16 | 700 | Valores destacados medianos, campo de nombre de jugador |
| 17–18px | 6 | 700 | `btn-start`, títulos de tarjeta de identidad |
| 20px | 6 | 700 | Títulos de overlay (`overlay__title`) |
| 22px | 3 | — | Título de Resumen, marcador de Último partido |
| 26px | 2 | 800 | Título del splash / FAB "+" |
| 32px | 1 | — | Ícono de placeholder de Ranking |

**Interlineado (`line-height`):** casi nunca se declara explícitamente (solo 8 reglas en todo el archivo lo hacen), con valores `1`, `1.1`, `1.5` y `1.6` sin relación aparente entre sí — el resto del texto usa el line-height por defecto del navegador.

**Mayúsculas:** `text-transform: uppercase` aparece 26 veces (labels, microtítulos, botones tipo pill) — es un patrón fuerte y consistente. `lowercase` aparece 2 veces, ambas en el wordmark ("lab" en minúscula dentro de "BRAMU*lab*") — uso intencional de marca, no inconsistencia.

**Letter-spacing:** 18 valores distintos en uso (de `0.01em` a `0.18em`), sin agrupar en una escala — los más frecuentes son `0.06em` (17 veces) y `0.08em` (9 veces), que funcionan de facto como el "letter-spacing estándar" para texto en mayúsculas, pero conviven con muchas variantes cercanas (`0.05em`, `0.04em`, `0.03em`, `0.02em`, `0.01em`) que probablemente podrían unificarse.

### Función de cada estilo tipográfico (lectura de diseño)

| Función | Familia | Tamaño típico | Peso | Mayúsculas | Dónde |
|---|---|---|---|---|---|
| Número/marcador protagonista | Display | 22–26px+ (marcador en vivo llega a tamaños mucho mayores, fuera de esta tabla por ser específico de `team-zone__score`) | 700–800 | No | Scoreboard, resultado de partido |
| Título de tarjeta/overlay | Display | 18–22px | 700 | Sí | `overlay__title`, títulos de sección, `pastilla__title` |
| Botón primario | Display | 17px | 700 | Sí (vía texto en mayúsculas, no siempre `text-transform`) | `btn-start` |
| Microlabel / etiqueta | Body | 9–11px | 700–800 | Sí | Labels de stat, `pastilla__microlabel`, headers de sección |
| Texto de cuerpo / descripción | Body | 12–13px | 500–700 | No | Párrafos de overlay, Tu Momento, textos de ayuda |
| Botón secundario / link | Body | 12–14px | 700–800 | Variable | `link-btn`, `btn-secondary`, `btn-mini` |

---

## C. Componentes

### C.1 — Botones

No existe una clase base común (`.btn`) — cada familia de botón es independiente, con su propio radio, tamaño y color, aunque varias comparten intención visual ("acción primaria").

| Componente | Definido en | Radio | Fondo | Texto | Tamaño fuente | Estados definidos |
|---|---|---|---|---|---|---|
| `.btn-start` (acción principal) | `styles.css:171` | 16px | `--gold` | `#1A1400` | 17px, display | `:active` (scale 0.98), `:disabled` (opacity 0.4) |
| `.btn-mini` (acción secundaria destacada, pill) | `styles.css:95` | 999px | `--gold` | `#1A1400` | 12px, body | Sin estados propios definidos |
| `.btn-secondary` | `styles.css:181` | 14px | `--ink-softer` | `--paper` | 13px | Sin estados propios; contiene una **declaración duplicada** (ver E) |
| `.link-btn` (texto con subrayado) | `styles.css:103` | — | transparente | `--paper-dim` | 13px | Sin estados propios |
| `.icon-btn` (ícono suelto, texto/emoji) | `styles.css:223` | — | transparente | `--paper-dim` | 20px | Sin estados propios |
| `.option-pill` / `.option-col` (selector tipo radio) | `styles.css:137,149` | Pill/redondeado | `--ink-soft` / `--ink-softer` | variable | variable | `.is-selected`, `.is-disabled`, `.is-disabled.is-selected` |
| `.control-btn` (marcador en vivo) | `styles.css:437` | — | transparente | `--paper-dim` | 10px label | `:active`, `:disabled`, `--flash` |
| `.stepper-btn` (+/− en editores) | `styles.css:531` | 8px | `--ink-softer` | `--paper` | 18px | `:disabled` |
| `.bottom-nav__item` / `--fab` (Rama Jugador) | `styles.css:1096,1103` | Circular (FAB) | transparente / `--gold` | `--paper-faint` / `#1A1400` | 10px / 26px | `.is-active`, `:active` (solo en el FAB) |

**Lectura de diseño:** hay al menos 3 radios distintos usados para "botón redondeado" (14px, 16px, 999px) sin relación explícita entre sí, y dos familias distintas de "botón dorado" (`btn-start` y `btn-mini`) que no comparten definición pese a ser visualmente la misma intención (acción principal).

### C.2 — Tarjetas / superficies

Todas comparten el mismo fondo (`--ink-soft`) y borde (`1px solid --line`), pero cada una define su propio radio de forma independiente — no hay una clase "tarjeta" base.

| Componente | Definido en | Radio | Padding | Uso |
|---|---|---|---|---|
| `.pastilla` (Rama Jugador) | `styles.css:1027` | 16px | 16px | Todas las tarjetas del Home del jugador |
| `.team-block` | `styles.css:107` | 16px | 14px 16px 16px | Bloques Equipo A/B del setup |
| `.history-item` | `styles.css:857` | 12px | 14px 8px 14px 16px | Filas del Historial |
| `.stat-row` | `styles.css:779` | 10px | 10px 12px | Filas de estadística en Análisis |
| `.menu-sheet` | `styles.css:490` | 14px | (por `.menu-item`) | Menús desplegables (☰, header-menu, mode-select) |
| `.overlay__card` | `styles.css:473` | 20px | 24px 22px | Todos los modales genéricos |
| `.highlight-popup__card` | `styles.css:508` | 18px | 16px | Popup de Highlight |

**Lectura de diseño:** 6 radios distintos (10, 12, 14, 16, 18, 20px) para el mismo concepto visual de "superficie oscura elevada" — es la inconsistencia más visible del sistema de tarjetas.

### C.3 — Campos de formulario

Un solo patrón (`.field__input`, `styles.css:120`): fondo transparente, borde inferior de 2px (`--line`), sin borde en los otros 3 lados — un estilo tipo "input de línea", no "input con caja". Foco: cambia el color del borde inferior a `--team-a` (o `--team-b` dentro de `.team-block--b`). Es el único patrón de campo de texto en toda la app — usado igual en setup, carga manual e identificación de jugador. No hay estado de error visual en el input en sí (los errores se muestran como texto aparte, `.edit-error`/`.coverage-note`).

### C.4 — Navegación

| Elemento | Definido en | Notas |
|---|---|---|
| Header de `view-setup` (wordmark + menú) | `styles.css:82` en adelante | Layout simple, sin fondo propio |
| Header de Análisis/Historial/Timeline (`.analysis-header`) | `styles.css:665` | Con borde inferior, ícono "←" de texto |
| Header del Home del jugador (`.player-home-header`) | Sección Rama Jugador | Layout análogo pero clase propia, no reutiliza `.analysis-header` |
| Barra inferior (`.bottom-nav`) | Sección Rama Jugador | Nueva, 5 ítems + FAB central |
| Control-bar del marcador en vivo | `styles.css:433` | Conceptualmente la "barra inferior" del partido en vivo — visualmente emparentada con `.bottom-nav` (misma idea: iconos + label chico) pero son dos sistemas de iconos separados (ver D.4) |

### C.5 — Modales y menús

Dos patrones conviven:
- **`.overlay` centrado** (`overlay__card`): modales de confirmación/edición — Editar marcador, Ajustar, Sistema de puntuación, "¿Quién sos?", notificaciones.
- **`.overlay--menu` anclado arriba a la derecha** (`menu-sheet`): menús tipo dropdown — ☰ del partido en vivo, selector de modo, header-menu nuevo del Home.

Ambos comparten fondo semitransparente sobre toda la pantalla, pero con opacidades distintas (`rgba(11,18,17,0.92)` para overlay centrado, `rgba(0,0,0,0.4)` para el menú anclado, `rgba(11,18,17,0.55)` para el popup de Highlight) — 3 fondos de "scrim" distintos para la misma función (oscurecer detrás de un overlay).

### C.6 — Estados generales observados

| Estado | Cómo se expresa | Consistencia |
|---|---|---|
| Seleccionado | Borde/fondo `--gold`, o color de equipo | Consistente dentro de cada familia, pero cada familia lo implementa distinto |
| Activo (bottom-nav) | `color: var(--team-a)` | Nuevo, un solo lugar |
| Presionado (`:active`) | `transform: scale(...)` (0.94–0.98 según componente) | Presente en la mayoría de los botones, con escalas ligeramente distintas |
| Deshabilitado | `opacity` (0.3–0.4 según componente) + `cursor:not-allowed` | Consistente en el criterio, no en el valor exacto de opacity |
| Foco (inputs) | Cambio de color de borde | Solo en `.field__input`; otros campos (`.edit-select`) no tienen estado de foco visual propio más allá del default del navegador |

---

## D. Espaciado y forma

### D.1 — Border-radius

12 valores distintos en uso, sin variable ni escala: `1px, 4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 999px` (`999px` es, de hecho, el más repetido — 14 veces — como atajo para "pill"/circular).

### D.2 — Bordes

Casi todo usa `1px solid var(--line)` (23 veces), pero conviven `1.5px` (7 veces, en inputs y chips de tarjetas) y un `4px` (borde-acento de `team-block`, y el borde del FAB nuevo de la barra inferior) — tres grosores de borde para funciones distintas (borde estándar, borde de input, borde de acento), que es razonable como categorías pero no está explícito en ningún token.

### D.3 — Sombras (`box-shadow`)

~19 reglas con `box-shadow`, todas con valores literales (sin variable de "elevación"). Se agrupan en tres familias funcionales:
- **Glow de estado activo/dorado**: `0 10px 24px rgba(255,201,61,0.22)` (botón primario), `0 4px 18px rgba(255,201,61,0.45)` (banner Punto de Oro) — mismo color, distinto blur/spread según el componente.
- **Pulso de dominio de set/partido**: 6 `@keyframes` con sombras de color de equipo en distintas intensidades (`teamBannerPulseSetA/B/Both`, `teamBannerPulseMatchA/B/Both`) — mucha repetición de la misma forma de sombra con solo el color y la intensidad cambiando.
- **Elevación de contenedor** en pantallas anchas (tablet/desktop): `0 0 60px rgba(0,0,0,0.5)` — reutilizado igual en 3 breakpoints distintos.

### D.4 — Espaciado (padding/margin)

No hay una escala de espaciado formal (sin variables `--space-*`). Los valores de `padding` en uso van de `2px` a `24px` en más de 25 combinaciones distintas; `margin-bottom` tiene al menos 12 valores distintos (`2, 4, 6, 8, 10, 12, 14, 16, 22, 26px`). La mayoría son múltiplos de 2, lo que sugiere una grilla implícita de 2px, pero no está formalizada ni documentada en el código.

### D.5 — Iconos y emojis (inconsistencia de sistema)

Dos sistemas de "ícono" conviven sin unificar:
1. **SVG dibujado a mano**, `viewBox="0 0 24 24"`, `fill: currentColor` vía clase (`.control-btn__icon` a 22×22px, `.bottom-nav__icon` a 21×21px — un 1px de diferencia entre los dos únicos sets de íconos SVG que existen). Son 8 íconos en total: 4 del control-bar del partido en vivo (Deshacer/Ajustar/Highlight/Editar) y 4 de la barra inferior nueva (Inicio/Historial/Ranking/Perfil), más el anillo de progreso del popup de Highlight.
2. **Caracteres Unicode/emoji nativos del sistema operativo**: ☰ (menú), ✕ (cerrar, se repite igual en 9 modales distintos), 🎾 (saque), 🏆 (fin de partido / Tie break / placeholder de Ranking), ⭐/★ (highlight/momentos clave, dos glifos de estrella distintos usados en contextos similares), ✎ (ajuste manual), 🔔 (notificaciones, nuevo), ✨ (Tu Momento, nuevo).

El segundo grupo depende de la fuente de emoji del sistema operativo/navegador de cada usuario — su grosor de trazo, color y proporciones no tienen relación garantizada con el primer grupo (SVG con trazo y color definidos por la app). Es la inconsistencia visual más transversal del inventario: convive en casi cada pantalla de la app.

---

## E. Inconsistencias (resumen consolidado)

| # | Inconsistencia | Evidencia | Alcance |
|---|---|---|---|
| 1 | Tres negros casi idénticos haciendo de "fondo casi-negro" (`--ink`, `#050907`, `#050C0A`, `#05100E`) | A.2 | Splash, scoreboard, resumen |
| 2 | `#1A1400` ("texto sobre dorado") repetido como literal 5 veces, nunca tokenizado | A.2 | Todo botón/banner dorado |
| 3 | `--team-a-deep` definida en `:root` pero sin ningún uso real en `styles.css` | A.1 | Token muerto |
| 4 | Sin escala tipográfica: 20 tamaños de fuente distintos, sin variables | B | Todo el archivo |
| 5 | `line-height` casi nunca declarado, y cuando lo está, sin relación entre valores (`1`, `1.1`, `1.5`, `1.6`) | B | Puntual |
| 6 | 18 valores de `letter-spacing` distintos donde 2-3 alcanzarían | B | Todo el archivo |
| 7 | 3+ radios distintos para "botón redondeado" (14/16/999px) sin relación | C.1 | Botones primarios/secundarios |
| 8 | 6 radios distintos para "tarjeta oscura" (10/12/14/16/18/20px) | C.2 | Todas las superficies |
| 9 | Dos familias de "botón dorado de acción" (`btn-start`, `btn-mini`) totalmente independientes | C.1 | Acciones principales |
| 10 | 3 opacidades de scrim distintas para la misma función (fondo de overlay) | C.5 | Modales/menús |
| 11 | `.btn-secondary` tiene una declaración de propiedades duplicada línea por línea (código muerto, no un bug visible) | `styles.css:181-183` | Solo ese bloque |
| 12 | Bordes de 1px, 1.5px y 4px conviviendo sin una regla explícita de cuándo usar cada uno | D.2 | Inputs, chips, acentos |
| 13 | Sin escala de espaciado: más de 25 combinaciones de padding, 12 de margin-bottom | D.4 | Todo el archivo |
| 14 | Dos sets de íconos SVG con tamaños base distintos (22px vs 21px) | D.5 | Control-bar vs. barra inferior |
| 15 | Emojis del sistema operativo mezclados con SVG dibujado a mano como "ícono de la app" | D.5 | Transversal — casi toda pantalla |
| 16 | Dos glifos de estrella distintos (⭐ y ★) usados en contextos visualmente similares (highlight vs. momentos clave) | D.5 | Highlights / Momentos Clave |
| 17 | El header del Home del jugador (`.player-home-header`) no reutiliza `.analysis-header`, pese a resolver el mismo problema visual | C.4 | Home del jugador |

---

## F. Qué puede modificarse globalmente vs. qué requiere cambios particulares

### F.1 — Cambios globales (tocar la variable/token alcanza para toda la app)

- Cualquiera de los 15 colores ya tokenizados en `:root` (tabla A.1) — cambiarlos ahí se propaga solo, sin tocar HTML ni JS.
- Las dos familias tipográficas (`--font-display`/`--font-body`) — cambiar la fuente importada y la variable alcanza.
- El criterio de mayúsculas/letter-spacing en microlabels, si se decide formalizar una única combinación (hoy son ~5 valores intercambiables candidatos a converger en 1-2).
- El fondo/borde de "superficie oscura" (`--ink-soft` + `--line`) — es consistente, cambiarlo ahí ya alcanza para todas las tarjetas listadas en C.2, aunque el radio de cada una seguiría siendo particular (ver F.2).
- El scrim de fondo de overlays, si se decide unificar las 3 opacidades en una sola.

### F.2 — Cambios que requieren tocar cada componente por separado

- **Radios**: no hay una variable de radio; unificar "tarjeta" o "botón" implica editar cada clase de la tabla C.1/C.2 una por una.
- **Tamaños de fuente y espaciado**: al no existir escalas, cualquier intento de estandarizar implica revisar y decidir, regla por regla, cuál de los valores actuales "gana".
- **Los dos sistemas de ícono** (SVG vs. emoji): unificarlos no es un cambio de token — implica decidir un lenguaje de ícono único y volver a dibujar/reemplazar cada emoji uno por uno (☰, ✕, 🎾, 🏆, ⭐/★, ✎, 🔔, ✨).
- **El color hardcodeado `#1A1400`**: antes de poder volverlo variable hay que confirmar que las 5 apariciones realmente deben ser el mismo valor (parecen serlo, pero no está garantizado por el código).
- **Los tres negros casi-iguales** (`--ink` y sus 3 variantes literales): unificarlos requiere revisar si la diferencia era intencional en cada caso (el propio código dice que sí, al menos para `view--summary`) antes de fusionarlos.
- **`--team-a-deep`**: al no usarse, decidir si se elimina o se le busca un uso es una decisión de contenido, no de token.
- **Sombras de "pulso" por equipo/set/partido**: son 6 `@keyframes` casi idénticas con solo el color/intensidad cambiando — consolidarlas en un patrón reutilizable (p. ej. con custom properties dentro del keyframe) es un cambio de estructura, no de valor.
