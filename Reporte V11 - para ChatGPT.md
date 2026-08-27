# Reporte BRAMU Lab V11 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora
y el repositorio) para que Sebastián se lo pase a ChatGPT como contexto. Tiene las mismas
dos partes que el reporte de V10: **cómo se trabajó** (para juzgar el método) y **qué se
hizo en la app** (para juzgar el resultado contra el Consolidado V11). Si ChatGPT ya tiene
el reporte de V10, esto es la continuación — no repite las definiciones básicas (Claude
Code, repo, commit, etc.), solo lo que cambió en esta ronda.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [e373328](https://github.com/sebastianvilaa/BRAMUlab/commit/e373328)
**Tag:** `v11`

---

## PARTE 1 — Cómo se trabajó

### Estado inicial encontrado

La V10 en producción ya traía bastante más resuelto de lo que el propio Consolidado V11
daba por sentado. `stats.js` ya tenía una arquitectura real de "historias" (candidatas a
ser la trama principal, cada una con un peso/prioridad, de donde se eligen las 1-2 más
relevantes) en vez de una plantilla de frases sueltas — el Consolidado V11 pedía construir
un "Narrative Planner" como si arrancara de cero, pero en la práctica ya existía la mitad
del armazón. El trabajo real de V11 fue **extender y corregir ese motor**, no reescribirlo
de cero — igual que ya había pasado en V10 con la V9.2.

### Lo que se hizo, en orden

1. Se leyó el Consolidado V11.md completo (~1800 líneas) y el reporte técnico/producto de
   V10, para no repetir contexto ni perder de vista qué ya estaba resuelto.
2. Se usó un sub-agente de exploración para mapear en qué archivo y función vive cada
   pieza relevante (BRAMU Intelligence, cálculo de Break Points, Tie break, footer,
   configuración, tests) antes de tocar nada — evita reinterpretar el código a ciegas.
3. Se leyó `stats.js` línea por línea (no solo el mapa del punto 2) para confirmar o
   descartar cada bug que el Consolidado V11 daba como "real". Esto encontró algo
   importante: **los bugs de la sección 2 del Consolidado (Break Points en 0, orientación
   de marcador) existían literalmente en el código, con el mismo patrón que los ejemplos
   del documento** — no eran hipotéticos, estaban ahí. También encontró un bug que el
   Consolidado no menciona explícitamente: varias frases de comparación de Break Points
   usaban el verbo en singular ("consiguió") con una pareja como sujeto, en vez de plural
   ("consiguieron") — la misma familia de bug que pide la sección 2.3, pero en un lugar
   distinto al que el documento señala.
4. Se corrigieron esos bugs y se reescribió el motor de remontadas para que reconozca en
   **qué set concreto** ocurrió la remontada (antes solo se enriquecía con Match
   Points/Tie break si esa remontada coincidía con el último set del partido — el caso
   patrón del propio Consolidado, 6-3 · 6-7 · 2-6, caía exactamente en ese agujero).
5. Se corrigieron las estadísticas de Tie break (sección 12) y se hicieron los ajustes de
   UI pedidos (orden de configuración, popup de Highlight, gráfico de Evolución, botones
   post-partido, footer/versión).
6. Se amplió `tests.html` con 33 aserciones nuevas, incluida una simulación punto por
   punto del caso patrón completo del Consolidado (6-3 · 6-7 · 2-6, con los 3 Match Points
   salvados y el Tie break reales) para verificar que el texto generado cubre los tres
   actos. Los 59 tests corren en verde (no hay Node en esta máquina, así que corren en el
   navegador, mismo mecanismo que V10).
7. Se levantó un servidor local temporal para poder correr `tests.html` y probar la app
   real en un navegador (jugando un partido completo a mano: selección de saque,
   Highlight, cierre del partido, Resumen, Análisis, Estadísticas, Evolución, Momentos
   Clave) antes de dar la ronda por terminada.
8. Se hizo un commit, se subió (push) directo a `main`, y se taggeó `v11`.

### Diferencia de método respecto a V10 (para que ChatGPT opine)

- **Sin rama ni Pull Request esta vez.** V10 usó rama + PR porque era la primera subida
  del código al repo y tenía sentido revisar el diff completo antes de aceptarlo. En V11
  se trabajó y se subió directo sobre `main`. Es más rápido y, dado que Sebastián no
  revisa diffs de código él mismo (interactúa solo por chat), no cambia lo que él
  experimenta — pero es una simplificación real del proceso, no un olvido. Vale la pena
  que quede documentado por si en algún momento se prefiere volver al esquema con PR
  (por ejemplo, si en el futuro alguien más además de Sebastián toca el repo).
- **Sin "toques" numerados formales.** V10 se planificó explícitamente en 4 bloques
  agrupados antes de arrancar a programar. V11 se ejecutó como una sola pasada continua,
  ordenada por la propia prioridad que marca el Consolidado (sección 0: BRAMU Intelligence
  primero) — investigar → corregir los bugs de la sección 2 → el núcleo del Narrative
  Planner (sección 3) → Tie break (12) → UI (13-19) → tests (20) → verificación manual.
  Funcionó bien acá porque el alcance real terminó concentrado casi todo en un solo
  archivo (`stats.js`) con un patrón de bug muy claro y verificable con tests — el
  costo/beneficio de parar a planificar en bloques separados era menor que en V10, que
  tocaba mucha más superficie de la app a la vez.
- **Bug real fuera de lo que pedía el documento.** El problema de concordancia gramatical
  en singular (punto 3 de arriba) no estaba en los ejemplos del Consolidado — apareció al
  leer el código con atención mientras se corregía otra cosa cercana. Vale la pena
  mencionarlo porque es la clase de bug que una lectura superficial (guiada solo por los
  ejemplos del documento) se puede llegar a pasar por alto.
- **Verificación con caché de GitHub Pages.** Después de subir y taggear, la app pública
  tardó unos minutos en reflejar los cambios (caché del CDN de GitHub Pages, no del
  Service Worker de la propia app) — se confirmó con `curl` directo al origen que el
  contenido correcto ya estaba publicado antes de dar la tarea por terminada, aunque el
  navegador tardara un rato más en mostrarlo. No es nada para corregir, solo una demora
  normal de propagación.

---

## PARTE 2 — Qué se hizo en la app (contra el Consolidado V11)

### Resumen ejecutivo

El objetivo principal del documento (sección 0) era llevar BRAMU Intelligence al nivel que
no había alcanzado en V10: menos estadística suelta, más crónica cronológica real. Eso se
cumplió con cambios concretos y verificables (no solo "se sintió mejor a ojo"): 5 bugs
reales corregidos con test de regresión cada uno, y una reescritura puntual del motor de
remontadas para que no pierda actos de la película. Lo que quedó explícitamente afuera es
el sistema de puntaje de "incidencia/leverage" de doble eje (secciones 4-5) — se explica
por qué más abajo.

### Núcleo — Narrative Planner (secciones 1-3) ✅

- **Caso patrón del Consolidado resuelto** (6-3 · 6-7 · 2-6, sección 3.4): antes, si la
  remontada con Match Points salvados y Tie break ocurría en un set que NO era el último
  del partido, esos hechos se perdían por completo — el motor solo los adjuntaba cuando
  coincidían con el último set. Ahora identifica en qué set concreto pasó y busca ahí los
  Match Points salvados reales (reusando los mismos datos que ya alimentan Evolución y
  Momentos Clave, nunca una segunda interpretación de los mismos hechos).
- **Cobertura de los tres actos** (sección 3.1): se agregó un resumen del/de los set(s)
  anterior(es) a la remontada ("apertura") cuando corresponde, y un párrafo de cierre con
  datos reales del último set (quiebres si se conoce el saque, marcador siempre orientado)
  cuando ese set quedó fuera de la historia principal — para que un partido a tres sets
  con desarrollos distintos no pierda ni el primero ni el tercero.
- Texto de ejemplo generado por la simulación de test del caso patrón (para que se vea la
  calidad real, no una descripción):

  > *Ana y Bea se quedaron con el primer set 6-3. Cruz y Dan protagonizaron una gran
  > remontada en el Set 2. Estuvieron 1-5 abajo y salvaron 3 Match Points de Ana y Bea
  > antes de llevar el set al Tie break, donde terminaron imponiéndose 7-5. [...]*
  >
  > *El último set tuvo otro desarrollo: Cruz y Dan consiguieron 2 quiebres y cerraron 6-2.*

### Correcciones obligatorias de V10 (sección 2) ✅ — bugs reales confirmados en el código

- **§2.1 (BP 0 vs 0):** confirmado el bug tal cual lo describe el documento — con 0/3 vs
  0/5, el motor podía decir "fueron mucho más contundentes y consiguieron 0 quiebres".
  Corregido: ahora narra presión sin conversión, nunca contundencia sobre una conversión
  de cero.
- **§2.2 (misma eficiencia, distintas oportunidades):** confirmado — 3/9 y 2/6 son la
  misma tasa (33%), pero el código podía decir "aprovechó mejor" igual. Corregido.
- **§2.3 (concordancia gramatical):** encontrado un caso adicional no listado en el
  documento (ver Parte 1) — corregido junto con los de arriba.
- **§2.4 (orientación de marcador):** confirmado el bug en la rama de remontada — el
  cierre de un set ganado podía mostrarse con el orden crudo (p.ej. "ganarlo 6-7" narrando
  al equipo que en realidad ganó 7-6). Corregido en todas las ramas narrativas
  involucradas, con test de regresión dedicado.
- **§2.5 (redundancia):** confirmado — un Tie break narrado como historia principal podía
  repetirse después en el párrafo de cierre por duración. Corregido con una marca interna
  que evita la doble mención.

### Break Points — reglas definitivas (sección 8) ✅

Cubierto como parte de la reescritura de §2.1/§2.2. Se simplificó además la función que
interpreta Break Points: había dos ramas separadas (una en la historia principal, otra en
el párrafo secundario) con guardas ligeramente distintas entre sí — esa duplicación era
justamente la raíz del bug de "0 quiebres". Ahora hay una sola función, usada en los dos
lugares.

### Key Points / Incidencia competitiva — doble eje (secciones 4-6) ❌ no implementado

Esta es la limitación más importante de la ronda, dicha sin vueltas: el Consolidado pide
un sistema de puntaje interno (`importanceScore`/`leverageScore`) que combine dominancia
del game con importancia competitiva, para ayudar al Narrative Planner a decidir qué
contar. No se construyó. Motivo: el sistema de "historias" con peso que ya existe cumple
la misma función práctica (ordenar candidatas narrativas por relevancia), y construir un
motor de puntaje por punto completamente nuevo — que además el propio documento dice que
no hace falta mostrarle al usuario — era el tipo de trabajo que suena sofisticado pero no
iba a cambiar ningún texto que un test pudiera verificar, distinto de los otros arreglos.
Se priorizó terminar bien los bugs concretos y el Narrative Planner en vez de arrancar esa
pieza nueva a medias. Ejemplos puntuales que dependen de este motor y quedaron sin cubrir:
hold 40-0 vs. hold salvando 0-40 (§4.3), Oro temprano vs. Oro tardío (§5.2).

### Tie break en saque/resto (sección 12) ✅

Antes el Tie break se excluía por completo de puntos ganados al saque/al resto (por
equipo y por jugador), aunque los puntos totales sí lo incluían — eso rompía la igualdad
`saque + resto = total` que el propio Consolidado usa como ejemplo de la inconsistencia.
Corregido: el TB ahora aporta a saque/resto (cada punto de TB tiene un sacador conocido
por la rotación interna del desempate), pero sigue sin aportar a games de saque ganados ni
a Break Points/breaks, tal como pide la sección 12.2. Verificado con test de regresión que
chequea la igualdad exacta.

### Evolución del partido — vista SET (sección 13) ✅

- Se sacó el rombo + etiqueta "mini-break" que se dibujaba por cada punto de mini-break
  del Tie break — con un TB largo se amontonaban y se pisaban entre sí. El dato interno
  sigue existiendo (Momentos Clave lo sigue usando), solo dejó de dibujarse.
- Se agregaron marcas discretas (tick + marcador chico) por cada game de la vista Set,
  para poder ubicar aproximadamente el 1-0/2-0/3-1... con solo mirar el gráfico, sin
  escribir los scores grandes.
- La vista PARTIDO (aprobada en V10, sección 13.1) no se tocó.

### Highlight rápido (sección 14) ✅ parcial

- **14.1 (posición del popup):** corregido — antes quedaba pegado abajo, ahora centrado.
- **14.2 (bug "Z1"):** se revisó el código a fondo y **no se encontró ningún rastro de ese
  bug** — Highlights y Momentos Clave ya mostraban correctamente "Highlight" cuando no hay
  categoría elegida, sin ningún código interno tipo "Z1" expuesto. Puede que ya se haya
  corregido en algún momento de V10 sin quedar documentado, o que el Consolidado lo haya
  anotado como precaución. No hizo falta ningún cambio acá.
- **14.3 (toque exterior que "come" un punto):** no se tocó, tal como pide explícitamente
  el documento ("no modificar automáticamente sin test... evaluar si se siente molesto en
  uso real"). Queda pendiente de que Sebastián lo pruebe jugando de verdad.

### Configuración, navegación, footer (secciones 15-16, 19) ✅

Orden Formato→Sistema de puntuación, renombrado "Método" → "Sistema" de puntuación,
"NUEVO PARTIDO" → "VOLVER AL INICIO" (más preciso, ese botón siempre volvía al inicio, no
armaba un partido nuevo), el mismo botón agregado también en Análisis junto a Compartir,
footer/versión/caché de la PWA actualizados a v11.

### Lo que queda igual, tal como pide el documento

Momentos Clave (§17), Compartir (§18) y la vista PARTIDO de Evolución (§13.1) están
explícitamente aprobados en el Consolidado ("no rediseñar") y no se tocaron. Tampoco se
tocó nada de motor de score, reglas de Punto de Oro/Star/Con Ventaja, rotación de saque,
Quick Correction, ni persistencia — la sección 23 del documento los marca como fuera de
alcance salvo regresión detectada, y no se detectó ninguna.

### Tests automáticos ejecutados y resultado

`tests.html` (en el navegador, sin Node — no está instalado en esta máquina): **59/59
tests en verde**. 33 son nuevos de esta ronda, cubren cada bug corregido arriba más una
simulación punto por punto del caso patrón completo del Consolidado.

### Pruebas manuales realizadas

Partido completo jugado a mano en el navegador (selección de jugadores y sistema de
puntuación, selección de saque, un Highlight sin categoría elegida, cierre del partido,
pantallas de Resumen y Análisis, Estadísticas, Evolución, Momentos Clave, botones nuevos).
No se jugó a mano un partido con Tie break real ni en modo Americano/Con Ventaja — esas
rutas quedaron cubiertas solo por los tests automáticos y la lectura del código, no por
juego real.

### Qué probar mejor en la próxima ronda (sugerencia de Claude Code)

1. Jugar un partido real con Tie break (para ver la vista Set de Evolución sin el ruido de
   mini-break, con las marcas nuevas por game) y otro en Americano/Con Ventaja — no se
   verificaron a mano esta vez.
2. Usar la app en 2-3 partidos reales de Sebastián y leer el BRAMU Intelligence resultante
   contra su propio recuerdo del partido — sigue siendo, como en V10, el test más
   importante y el que todavía no se hizo con partidos reales (solo simulados).
3. Prestar atención al toque exterior del popup de Highlight (§14.3) en uso real — si
   "come" un punto, avisar para resolverlo en la próxima ronda.
4. Si en algún momento se quiere invertir el tiempo: el sistema de doble eje de
   dominancia/leverage (§4-5) que quedó afuera esta vez.

---

## Sobre la próxima ronda

Mismo mecanismo de siempre: un solo Consolidado activo por ronda, dejado en la carpeta de
Dropbox, avisándole a Claude Code el nombre del archivo para arrancar.
