# BRAMU Lab — Brief de dirección de marca y diseño
## Documento de foco, para retomar la conversación con ChatGPT

Este documento no es un análisis nuevo — es un **resumen ordenado de todo lo ya hablado y ya decidido** hasta ahora sobre el rebranding visual de BRAMU, para que quien lo lea (ChatGPT u otra persona) entre directo al tema sin repreguntar lo ya charlado. Incluye tanto lo conceptual (moodboard, atmósfera, referencias) como lo factual (cómo está hecho el diseño hoy, en código, ahora mismo).

---

## 1. Qué es BRAMU, en una línea

App de pádel que registra partidos y construye **la historia personal del jugador**: su momento, su evolución, sus compañeros, sus rivales, sus rachas. Tagline de encuadre para este trabajo de marca: **"Donde vive tu pádel."** No es una app de transmisión de torneos ni un dashboard genérico de estadísticas — es el archivo/bitácora de un jugador real.

Contexto de origen (por si hace falta explicarlo): la construyó Sebastián en una semana, jugando pádel amateur con su grupo de amigos, porque no sabía el resultado de un partido que estaba mirando. Hoy la sigue construyendo con Claude Code, por etapas.

---

## 2. Qué se está pidiendo puntualmente en este hilo (alcance del trabajo de diseño)

- **No es un rediseño desde cero.** Es un **refresh** sobre la base ya construida: se quiere reusar lo que funciona y mejorar puntualmente.
- Ejes concretos que Sebastián nombró explícitamente:
  - **Tipografía** — cambiarla.
  - **Tarjetas** — revisar cómo se están usando hoy.
  - **Destacados** (highlights/widgets tipo "mejor racha", "compañero frecuente", etc.) — revisar su tratamiento visual.
  - **Jerarquía de color** — primarios, secundarios, acentos: hoy no está claramente definida como sistema, se fue armando de forma orgánica.
- **Diagnóstico explícito del estado actual (palabras textuales de Sebastián):** la app hoy se siente **"muy genérica, muy inteligencia artificial, muy cloud"**. El objetivo es acercarla al mundo real del pádel, que se sienta propia y no una plantilla de producto SaaS genérica.
- Esto es parte de un objetivo más amplio de **rebranding de la marca y de la app** (no solo la interfaz — también cómo se presenta la marca BRAMU en general).

**Importante — separación de hilos de trabajo:** Sebastián lleva este tema de diseño en un chat de Claude dedicado, separado del chat donde avanza la app por etapas/versiones numeradas (Consolidados). Este documento es un puente entre ese trabajo y la conversación en paralelo con ChatGPT — no asumir que ChatGPT ya conoce el resto del desarrollo funcional de la app.

---

## 3. Referencia de atmósfera: moodboard de Premier Padel

Se analizaron 14 fotos reales de Premier Padel (torneo profesional de pádel) como referencia de **atmósfera**, explícitamente **no para copiar** el estilo de Premier Padel ni de otras apps (VIBERO, etc.), sino como fuente de inspiración de clima visual. Ya existe un análisis completo y detallado de este moodboard en el archivo hermano `BRAMU_Direccion_Visual_Moodboard_Analisis.md` (mismo directorio). Resumen de lo más importante de ese análisis:

### Concepto
Arena nocturna: entorno y gradas oscuras, cancha y luces azules, la pelota verde lima como único punto de máxima atención — trasladable a las acciones principales de BRAMU. Reflejos y bordes finos, resplandores controlados. **Riesgo explícito a evitar:** que se vuelva estética "gamer", futurista genérica o excesivamente tecnológica (esto conecta directo con la queja de "muy IA, muy cloud").

### ADN visual del moodboard (resumen)
- Un solo campo cromático dominante (azul saturado bañando todo), no mezcla de colores compitiendo.
- Vacío oscuro real alrededor de un núcleo luminoso (gradas negras, cancha iluminada).
- Un único acento de alta saturación — la pelota lima — que nunca compite con nada más.
- Blanco como color "humano": el que porta la información legible (jugadores, marcador, texto).
- Geometría dura como estructura (líneas de cancha, red, trusses de luz), no como decoración.
- Luz direccional y volumétrica (focos reales, halos), nunca un fondo azul plano.
- Un único momento cálido/íntimo en todo el set (confeti + fotos polaroid post-partido) — pista de que hay un costado emocional/de recuerdo detrás de la frialdad de la "arena", que conecta con la idea de BRAMU como historia personal.

### Traducción a capas de UI (ya explorado, resumen)
- **Azul** = atmósfera/estructura constante (fondos, superficies, info secundaria).
- **Verde lima** = acento único de acción, uso deliberadamente minoritario (<10% del peso visual) — igual que la pelota en cancha.
- **Blanco** = el jugador, el dato, lo legible.
- **Glow/resplandor**: reservado solo para lo que lo merece (en vivo, racha activa, logro nuevo) — nunca parejo en todos los bordes/tarjetas.
- **Bordes**: finos, precisos, tipo línea de cancha.
- **Tipografía**: presencia fuerte solo en números/momentos hero (marcador, streaks), sin itálica agresiva tipo HUD de videojuego en el resto.

### Tres direcciones de paleta ya exploradas (orientativas, ninguna cerrada)
- **A) "Cancha nocturna"** — azul fiel al broadcast, fondo `#0A1220`, superficie `#101B30`, lima `#C6F135`.
- **B) "Arena/túnel"** — más negro, azul como luz puntual no como relleno, fondo `#05070B`, lima `#B8FF3D`.
- **C) "Medianoche cálida"** — base fría + un acento cálido puntual (`#FF8A5C`) para hitos/momentos personales, la que más identidad propia aporta (conecta con la foto de confeti/polaroids).

### Qué evitar (para no caer en gamer/sci-fi genérico)
Multi-neón simultáneo (rosa+cian+violeta a la vez), glow parejo en todos los bordes, patrones de circuitos/hexágonos/grillas futuristas, tipografía itálica agresiva tipo HUD en todos lados, negro puro + líneas neón (estética "setup gamer"), glassmorphism/blur en todas las superficies, cliché de app fitness azul+naranja.

### Cómo diferenciarse (identidad propia de BRAMU, no copiar Premier Padel)
Premier Padel es la transmisión de un evento; BRAMU es el archivo personal de un jugador. Ideas ya anotadas: un "spotlight" propio sobre el jugador (no sobre el marcador), un "rastro"/línea lima que represente la evolución personal en el tiempo como firma visual propia, menos vocabulario de "transmisión/sponsors" y más de "diario/bitácora personal", una calidez puntual y deliberada que Premier Padel no tiene.

*(El documento completo tiene, además, la lista extendida de Hacer/No hacer y el detalle capa por capa — fondos, tarjetas, bordes, iconografía, tipografía — con más profundidad que este resumen.)*

---

## 4. Auditoría del diseño actual real (código, hoy — `bramulab/styles.css` e `index.html`)

Esto es lo que existe **hoy en producción**, no una propuesta — sirve como línea de base concreta para el refresh, en vez de imaginar cómo está hecha la app.

### Colores definidos hoy (`:root` en `styles.css`)
```
--ink:          #0B1211   (fondo base — negro con matiz verdoso, no azul)
--ink-soft:     #10201D   (superficie de tarjeta)
--ink-softer:   #16281F   (superficie secundaria/chips)
--paper:        #F4F7F2   (texto/blanco principal)
--paper-dim:    rgba(244,247,242,0.56)   (texto secundario)
--paper-faint:  rgba(244,247,242,0.30)   (texto terciario/deshabilitado)
--team-a:       #C8FF3D   (verde lima — color del "Equipo A" en un partido)
--team-a-deep:  #7FBF14
--team-b:       #33A6FF   (azul — color del "Equipo B" en un partido)
--team-b-deep:  #1E6FBF
--gold:         #FFC93D   (dorado — usado hoy como color de marca/branding y CTA principal)
--star:         #FFA93D
--danger:       #FF5B54
--confirm-green:#2ECC71
--line:         rgba(244,247,242,0.10)   (bordes de tarjeta, muy sutiles)
```

Dato clave: **la pantalla de partido en vivo (marcador/cancha) ya usa una paleta azul oscura separada**, distinta del resto de la app:
```
--court-bg:       #060B14
--court-surface:  #0D1626
--court-surface-2:#142238
```
Es decir: **el "azul cancha nocturna" del moodboard ya existe parcialmente en la app**, pero solo en la vista de partido en vivo — el resto de la app (Home, Historial, Perfil) usa un fondo negro-verdoso distinto, no azul. Esto genera una inconsistencia visual entre secciones que puede ser parte de por qué la app no se siente cohesiva.

### Rol real que cumple cada color hoy
- **Verde lima (`--team-a`) y azul (`--team-b`)** ya existen en la app — pero **no** como el sistema "azul = atmósfera / lima = acento único" del moodboard. Hoy son literalmente los colores de "Equipo A" vs. "Equipo B" dentro de un partido (para diferenciar dos parejas en el marcador), nada más. Se usan también en glows puntuales (`box-shadow` de color) cuando un equipo gana un set/partido — ahí sí hay ya un uso de "glow que se gana", parecido a lo que propone el moodboard.
- **Dorado (`--gold`)** es hoy, de hecho, **el color de marca/acento principal real**: se usa en el botón principal (CTA "empezar"), en el logo/nombre "BRAMU" en las capturas para compartir, en títulos de sección, en el marcador de modo de juego. Es un color premium/trofeo — no tiene relación directa con el pádel ni con el moodboard azul+lima. Es probablemente una de las piezas que más "genérico/no-propio" aporta hoy, porque no cuenta ninguna historia particular de BRAMU ni de pádel.

### Tipografía hoy
```
--font-display: 'Oswald', 'Arial Narrow', system-ui, sans-serif;
--font-body:    'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```
`Oswald` (condensada, mayúsculas con tracking amplio) se usa de forma extremadamente extendida — no solo en números/marcador (uso "hero" razonable), sino también en casi todos los títulos de sección, labels, botones y hasta textos de UI menores. Es una fuente condensada muy común en plantillas de producto/dashboards en general (no es exclusiva ni evocativa del pádel) — el uso tan extendido de esta tipografía en TODO (no solo en momentos "hero") es probablemente otra causa concreta de la sensación "genérica".

### Tarjetas y superficies hoy
`border-radius` entre 12px y 16px, fondo `--ink-soft`/`--ink-softer`, borde de 1–1.5px con `--line` (blanco al 10% de opacidad) — conceptualmente ya bastante alineado con la idea del moodboard de "borde fino, superficie que se distingue por luz y no por sombra dura". El `box-shadow` casi no se usa como sombra tradicional; se usa mayormente como **glow de color** puntual (halo de 10px en el color del equipo, pulsos animados al ganar set/partido). Esta base ya es compatible con el lenguaje de "resplandor reservado para lo que lo merece" del moodboard — es más una cuestión de extender y ordenar el sistema que de inventarlo de cero.

### Marca / logo
Nombre: **BRAMU Lab**. Existe un logo (`icons/logo.png`) usado en el splash de carga, header y footer, además de set de íconos PWA (favicon, apple-touch-icon, maskable). `theme-color` del navegador está seteado en `#0B1211` (el negro-verdoso base). Footer de la app dice: *"BRAMU Lab · Concepto y diseño por Sebastián Vila"*.

---

## 5. Diagnóstico: de dónde viene probablemente la sensación "genérico / muy IA / muy cloud"

Cruzando el pedido de Sebastián con la auditoría del código, hay pistas concretas (no solo una sensación difusa):

1. **El acento de marca real hoy es dorado**, un color "premium genérico" (trofeo/medalla) sin conexión con pádel ni con la identidad que se está buscando — no cuenta ninguna historia propia.
2. **Inconsistencia entre secciones**: la vista de partido en vivo ya tiene una paleta azul-oscura tipo "cancha nocturna", pero el resto de la app (Home, Historial) usa un negro-verdoso distinto — la app no tiene un clima visual único y reconocible de punta a punta.
3. **Una sola tipografía condensada (Oswald) aplicada casi a todo**, incluso a texto de UI que no es "hero" — es un recurso tipográfico muy común en dashboards/SaaS genéricos, no algo que un jugador de pádel asociaría con la cancha.
4. **Verde lima y azul ya existen, pero atados a "Equipo A / Equipo B"**, no como sistema de identidad de marca (atmósfera + acento) — hay una oportunidad de reusar estos colores que YA están en la app, resignificándolos, en vez de introducir colores nuevos.
5. El sistema de tarjetas/glow ya tiene buenos huesos (bordes finos, glow reservado) — el problema no es la base técnica, es que **no hay una narrativa de marca detrás de las decisiones de color/tipografía actuales**, se fueron sumando de forma funcional (equipo A, equipo B, un dorado "bonito" para CTA) sin pensarlas como sistema.

---

## 6. Qué está decidido y qué sigue abierto

**Decidido / acordado hasta ahora:**
- Es un refresh, no un rediseño desde cero.
- La atmósfera de referencia es "arena nocturna" (azul + lima), inspirada en Premier Padel pero sin copiarlo.
- Hay que evitar activamente la deriva "gamer/sci-fi/tech genérico".
- BRAMU debe diferenciarse por ser un archivo personal, no una transmisión de evento.

**Todavía abierto (nada de esto está cerrado):**
- Cuál de las 3 direcciones de paleta (o una mezcla) se adopta.
- Qué pasa con el dorado actual: ¿se elimina como acento de marca, se reserva para otra cosa (logros/hitos, tal como sugiere la dirección "C"), o se mantiene en paralelo al lima?
- Si el azul "cancha nocturna" que hoy solo vive en el marcador en vivo se extiende a toda la app, o se queda como distintivo exclusivo de "estás jugando ahora".
- Qué tipografía nueva reemplaza o convive con Oswald/Manrope.
- Cómo se rediseñan puntualmente las tarjetas y los "destacados" (widgets tipo racha, compañero frecuente, etc.) bajo el nuevo sistema.
- Nada de esto se aplicó todavía al código — todo el trabajo hasta ahora es conceptual/de referencia.

---

## 7. Para qué sirve este documento

Sebastián está retomando esta conversación con ChatGPT para enfocar el rebranding y sintió que se estaba dispersando. La idea es que este documento (junto con `BRAMU_Direccion_Visual_Moodboard_Analisis.md`) sirva como memoria compartida: de dónde se partió, qué se exploró, qué existe hoy en la app realmente, y qué preguntas concretas quedan abiertas — para que la próxima ronda de conversación (acá o con ChatGPT) empiece por una decisión concreta de la sección 6, no por repetir el análisis desde cero.
