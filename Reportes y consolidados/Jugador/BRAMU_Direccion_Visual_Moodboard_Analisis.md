# BRAMU Lab — Dirección visual futura
## Análisis del moodboard (arena nocturna / Premier Padel como referencia atmosférica)

Documento exploratorio, no ejecutable. No define una paleta cerrada ni componentes finales — es la base de discusión para acordar hacia dónde va la identidad visual de BRAMU antes de tocar ningún diseño de pantalla.

**Concepto guía:** *"Donde vive tu pádel."* BRAMU no es la transmisión de un torneo — es el archivo personal de un jugador: sus partidos, su momento, su evolución, sus compañeros, sus rivales, sus rachas. El moodboard de Premier Padel se usa como referencia de **atmósfera** (arena nocturna, cancha y luces azules, pelota lima como foco), no como estilo a copiar.

**Material analizado:** 14 fotos de Premier Padel/pádel profesional que dejaste en `Referencias visuales/` — tomas de cancha en juego, arena vacía con luces azules, detalle de pelota y red, túnel de entrada de jugadores, y una imagen de confeti + fotos polaroid post-partido. (Descarté una captura suelta que no correspondía al moodboard — una barra de reacciones/colores de video, sin relación con pádel.)

---

## 1. ADN visual común del moodboard

Mirando las 14 imágenes en conjunto, hay un patrón que se repite con muy poca variación:

- **Un solo campo cromático dominante.** Casi todo el entorno (piso, aire, gradas) es una misma familia de azul saturado. No hay mezcla de colores compitiendo — hay *un* azul que baña todo.
- **Vacío oscuro alrededor de un núcleo luminoso.** Las gradas vacías, el techo, los pasillos son negro/azul casi negro. La luz se concentra en la cancha y en las fuentes de luz (focos, tubos LED). El contraste no es "todo brillante" — es oscuridad real con un punto de luz intencional.
- **Un único acento de alta saturación: la pelota lima.** En las fotos donde aparece, es literalmente el objeto más saturado del cuadro. Todo lo demás (azul, blanco, negro) es comparativamente sobrio. La pelota no compite con nada — está sola en su categoría de color.
- **Blanco como color humano.** Los jugadores visten blanco o tonos muy claros casi siempre. El blanco es el que porta la información legible (marcador, texto, líneas de cancha) sobre el fondo azul/negro.
- **Geometría dura como estructura, no como decoración.** Líneas de cancha, red, rejas, trusses de iluminación — todas son líneas rectas, finas, funcionales. Dan ritmo y profundidad sin ser "gráficas".
- **Luz direccional y volumétrica, no plana.** Los focos se ven *como focos* (halos, conos de luz, degradés desde la fuente). No es un fondo azul liso — es luz que viene de algún lado y se apaga hacia los bordes.
- **Vidrio y reflejos sutiles.** Los paredones de cristal de la cancha agregan una capa de reflejo/transparencia discreta, sin ser el protagonista.
- **Vacío como señal de escala y seriedad.** Las gradas vacías (sin público) comunican "el escenario está listo" — hay una cualidad de expectativa/profesionalismo incluso sin gente.
- **Un momento de calidez humana, aparte.** La imagen del confeti + polaroids (rosa y azul, fotos físicas de jugadores abrazados) es la única nota cálida/íntima del set. Contrasta fuerte con el resto: sugiere que atrás de la estética fría de "arena" hay un costado emocional/de recuerdo — que conecta directo con lo que BRAMU quiere ser (historia personal, no solo transmisión).

---

## 2. Palabras clave de la atmósfera

**Nocturna · Contenida · Enfocada · Imponente pero íntima · Precisa · Expectante · Premium · Fría en superficie, cálida en el fondo · Escenario listo · Vacío elegante · Pulso (el glow azul respira, no grita) · Memoria.**

Si hay que resumirlo en una frase: *tensión silenciosa antes del punto* — no es la euforia de un festival de luces, es la calma cargada de un escenario profesional a oscuras, con un solo punto de foco.

---

## 3. Cómo trasladar esa atmósfera a una interfaz digital

### Fondos
Negro-azulado profundo, no negro puro (el negro puro sin matiz se siente "modo oscuro genérico", no "arena"). Un degradé sutil de vacío hacia luz — más oscuro en los bordes/extremos de la pantalla, con una insinuación de resplandor azul hacia donde está el contenido importante (como el foco cayendo sobre la cancha). El fondo es atmósfera, no protagonista: nunca debería competir con el contenido en blanco.

### Tarjetas y superficies
Un paso de claridad por encima del fondo, no una caja con sombra dura. En las fotos, la "superficie" nunca se separa por sombra — se separa por diferencia de luz. Las tarjetas de BRAMU podrían funcionar igual: superficie apenas más clara que el fondo, sin sombras pesadas tipo material design.

### Bordes
Finos, precisos, casi como líneas de cancha — 1px, con un tono azul-gris apenas más claro que la superficie. No todos los bordes deberían brillar: el glow se reserva (ver iluminación). El borde por defecto es sobrio; solo se "enciende" cuando el elemento lo amerita.

### Iluminación y glows
Este es el punto donde más disciplina hay que tener. En el moodboard, el glow es *escaso y con propósito* — ilumina la cancha, no las gradas. Trasladado a UI: el resplandor se reserva para lo que realmente importa (un partido en vivo, una racha activa, un logro nuevo, la acción principal de la pantalla). Si todo brilla, nada brilla — y ahí es donde la estética se cae hacia "gamer". El glow debería sentirse como un foco de estadio, no como un borde neón permanente.

### Jerarquía de color
Azul = atmósfera y estructura (fondo, superficies, información secundaria). Lima = el único acento de acción, reservado casi como recompensa visual (igual que la pelota en cancha: un solo objeto, nunca decorado de más). Blanco = el jugador, el dato, el texto — lo humano y legible, siempre la capa de mayor contraste y prioridad de lectura.

### Iconografía
Líneas simples, geométricas, con terminaciones levemente suavizadas (ni angulosas tipo sci-fi, ni redondeadas tipo app genérica de bienestar). Inspirados en elementos reales de la cancha (línea de saque, red, trayectoria de pelota) reducidos a su forma mínima — no en iconografía de gaming (nada de escudos, rayos, hexágonos).

### Tipografía
Una familia con presencia para números y momentos "hero" (marcador, streaks, hitos) — con carácter de gráfica deportiva pero sin itálica agresiva tipo HUD de videojuego — combinada con una tipografía neutra y muy legible para el resto (historial, estadísticas, texto de Intelligence). El protagonismo tipográfico se reserva para números grandes (partidos jugados, rachas, resultado), no para títulos gritados por todos lados.

### Uso del verde lima y del azul
Azul: mayoritario, es el "clima" de toda la app — se lo ve en casi todas las pantallas, pero en tonos moderados, nunca todo saturado al mismo tiempo. Lima: minoritario a propósito (pensarlo como <10% del peso visual de cualquier pantalla) — reservado para lo accionable y lo distintivo: botón principal, "vos" en un gráfico con rivales, una racha activa, un récord personal. La regla del moodboard aplica literal: si la pelota fuera del tamaño de la cancha, dejaría de funcionar como foco.

---

## 4. Tres exploraciones de roles cromáticos (orientativas, no definitivas)

Tres sistemas posibles, cada uno con una personalidad distinta. Ninguno es "la" paleta todavía — sirven para elegir dirección antes de cerrar valores exactos.

### A) "Cancha nocturna" — la más fiel al broadcast azul
La opción más cercana literalmente a las fotos: azul como protagonista de fondo, casi tan saturado como en cancha.

| Rol | HEX orientativo |
|---|---|
| Fondo base | `#0A1220` |
| Superficie / tarjeta | `#101B30` |
| Borde sutil | `#1E3354` |
| Azul estructura/secundario | `#1656D9` |
| Azul glow / resplandor | `#2F7FFF` |
| Verde lima (acento único) | `#C6F135` |
| Texto primario | `#F5F7FA` |
| Texto secundario | `#8996AD` |

### B) "Arena / túnel" — más negro, azul como luz, no como relleno
Versión con más oscuridad de base (como el túnel de entrada o las gradas vacías) donde el azul aparece como fuente de luz puntual, no como color de fondo dominante. Se siente más "premium/cine" que "transmisión deportiva".

| Rol | HEX orientativo |
|---|---|
| Fondo base | `#05070B` |
| Superficie / tarjeta | `#0D1117` |
| Borde sutil | `#22262E` |
| Azul foco/glow | `#3B82F6` |
| Verde lima (acento único) | `#B8FF3D` |
| Texto primario | `#EDEFF3` |
| Texto secundario | `#7A8494` |

### C) "Medianoche cálida" — la más propia de BRAMU
Parte de la misma base fría, pero con un matiz apenas cálido en los neutros (conectando con la foto de confeti/polaroids: el costado humano/memoria del moodboard) y un acento cálido de uso muy puntual, no deportivo-broadcast sino personal — para notificaciones, hitos o "momentos" (nunca para acciones de cancha).

| Rol | HEX orientativo |
|---|---|
| Fondo base | `#0E1420` |
| Superficie / tarjeta | `#161D2C` |
| Azul acento | `#2C63FF` |
| Verde lima (acento de acción) | `#CFFF4D` |
| Cálido puntual (hitos/momentos, uso mínimo) | `#FF8A5C` |
| Texto primario (blanco cálido) | `#F2F0EA` |
| Texto secundario | `#8D93A6` |

*(Las tres comparten la misma lógica: azul = clima, lima = foco único de acción, blanco = el jugador/el dato. Difieren en cuánto negro puro vs. azul hay en la base, y si se permite o no un tercer acento cálido para lo emocional/memoria.)*

---

## 5. Qué evitar para no caer en gamer / sci-fi / tech genérico

- **Multi-neón simultáneo.** Rosa + cian + violeta a la vez (aunque aparece en 1-2 fotos del túnel de entrada) es la receta más rápida para leerse "setup gamer". El moodboard funciona porque es *un* color dominante, no una fiesta de neones.
- **Glow en todos los bordes/tarjetas por igual.** Resplandor ambiental constante = estética RGB de periférico gamer. El glow tiene que ganárselo cada elemento, no venir por defecto.
- **Patrones decorativos de circuitos, hexágonos, grillas futuristas.** Nada de esto aparece en el moodboard real — es un agregado que mete "sci-fi genérico" donde no corresponde.
- **Tipografía itálica/condensada agresiva en todos lados.** Sirve para un titular puntual tipo "NEXT ROUND", no como tipografía de cuerpo o de toda la navegación — eso empuja a estética HUD de videojuego.
- **Negro puro + líneas neón finas por todos lados.** Es el look de "monitor gamer en la oscuridad", no el de una arena profesional real.
- **Glassmorphism / blur en cada superficie.** Un recurso, no un sistema — usado en todas las tarjetas se vuelve genérico-tech de 2021.
- **Efectos de movimiento tipo glitch, scanlines, aberración cromática.** Eso es lenguaje cyberpunk, no deportivo.
- **El cliché "app deportiva" azul+naranja.** Muchas apps de fitness ya usan esa combinación — apoyarse solo en azul+lima+blanco con disciplina es lo que da identidad, no una tercera familia de color compitiendo.

---

## 6. Qué le puede dar identidad propia a BRAMU (sin copiar a Premier Padel ni a VIBERO)

- **Premier Padel es la transmisión del evento. BRAMU es el archivo personal del jugador.** Esa diferencia de propósito es la base de la diferenciación: el moodboard presta la *atmósfera* (arena, luces, foco), pero la cámara de BRAMU no debería sentirse como una cámara de TV siguiendo un torneo — debería sentirse como el propio jugador mirando su historia.
- **El motivo "recuerdo/memoria" (foto de confeti + polaroids) es un ángulo que Premier Padel no explota** — ellos son espectáculo en vivo, no archivo emocional. BRAMU sí es archivo emocional: eso podría traducirse en un lenguaje visual propio para "momentos" (una foto de un partido importante, un hito, una racha) con un tratamiento distinto al resto de la UI (más íntimo, menos "broadcast").
- **Un "foco" propio sobre el jugador, no sobre el marcador.** Así como la pelota lima es el punto de atención en cancha, BRAMU podría tener un tratamiento de foco/spotlight reservado para el jugador mismo (su foto, su nombre, su racha activa) — reforzando "tu pádel" en vez de "el resultado del torneo".
- **Un "rastro" de evolución como firma visual.** Ya que BRAMU trata sobre evolución en el tiempo (rachas, forma reciente, historial), una línea/trazo lima delgado que representa el recorrido del jugador (una especie de "forma" o "pulso" personal) podría convertirse en un elemento reconocible propio — algo que ni Premier Padel ni una app de scoreboard genérica tienen, porque ellas no narran una trayectoria individual.
- **Menos "sponsors y transmisión", más "vos".** Nada de logos de patrocinadores, marcadores tipo TV, marcas de cámara — la referencia visual (oscuridad, azul, foco lima) se mantiene, pero el vocabulario de "evento retransmitido" desaparece a favor de un vocabulario de "diario/bitácora personal".
- **Una calidez puntual y deliberada** (ver paleta C) que Premier Padel no tiene — porque ellos son 100% espectáculo frío de alto rendimiento, y BRAMU es también un lugar donde vivir recuerdos con amigos.

---

## 7. Hacer / No hacer

**Hacer**
- Usar el azul como atmósfera constante y el verde lima como foco único de acción.
- Dejar vacío oscuro real en las pantallas en vez de llenar todo de color o de tarjetas.
- Reservar el resplandor (glow) para lo que realmente lo merece: en vivo, racha activa, logro nuevo.
- Priorizar contraste y legibilidad (blanco sobre azul oscuro) por sobre cualquier efecto decorativo.
- Construir una firma propia: el "rastro"/línea de evolución personal, el spotlight sobre el jugador, el tratamiento de "momentos/recuerdos".
- Mantener la geometría (líneas finas, bordes precisos) como estructura, inspirada en la cancha real.

**No hacer**
- No combinar múltiples neones (rosa + cian + violeta) a la vez.
- No poner glow o brillo parejo en todos los bordes y tarjetas.
- No usar patrones de circuitos, hexágonos o grillas futuristas como decoración.
- No usar tipografía itálica agresiva tipo HUD de videojuego fuera de un titular puntual.
- No caer en negro puro + líneas neón por todos lados (estética "setup gamer").
- No copiar el vocabulario de "transmisión de torneo" (marcadores tipo TV, sponsors, gráfica de cámara) — BRAMU no retransmite un evento, guarda una historia.

---

## Próximo paso sugerido

Este documento no define nada todavía — es insumo para conversar. Cuando quieras avanzar, el siguiente paso natural sería elegir (o mezclar) una de las tres exploraciones de la sección 4 como punto de partida, y recién ahí pasar a bocetar cómo se ve esto en una pantalla real (por ejemplo, la Home del jugador que ya existe). No se tocó código ni el repositorio para este análisis.
