# Reporte BRAMU Lab V12 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora
y el repositorio) para que Sebastián se lo pase a ChatGPT como contexto. Tiene las mismas
dos partes que los reportes de V10 y V11: **cómo se trabajó** (para juzgar el método) y
**qué se hizo en la app** (para juzgar el resultado contra el Consolidado V12). Es la
continuación de esos reportes — no repite las definiciones básicas (Claude Code, repo,
commit, etc.), solo lo que cambió en esta ronda.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [c5f2189](https://github.com/sebastianvilaa/BRAMUlab/commit/c5f2189)
**Tag:** `v12`

---

## PARTE 1 — Cómo se trabajó

### De dónde nació esta ronda

A diferencia de V10/V11 (que respondían a un documento armado con ChatGPT pensando en
funcionalidad), el Consolidado V12 nació de la **primera prueba real en cancha** de BRAMU
Lab. Ninguno de los tres problemas que resuelve esta ronda (perder el hilo del tanteador,
equivocarse de sacador, terminar un set por tiempo de cancha) es una idea de producto —
son los tres momentos concretos en los que la app no supo qué hacer mientras alguien la
usaba jugando de verdad. El propio documento lo dice explícito: *"cuando BRAMU no sabe
exactamente qué ocurrió, debe registrar honestamente lo que sí sabe en vez de inventar lo
que falta."* Esa frase terminó siendo el criterio de diseño de toda la ronda, no solo una
declaración de intenciones.

### Lo que se hizo, en orden

1. Se leyó el Consolidado V12.md completo (~1170 líneas) y se investigó a fondo el estado
   real del código (`engine.js`, `app.js`, `stats.js`) **antes** de proponer nada — el
   propio documento lo pide explícitamente en su última sección. Ese paso encontró algo
   importante: **ya existía en el motor un mecanismo de "reemplazo de estado completo"**
   (`applyAdjustment`) que sostiene hoy el editor completo de marcador ("Editar"). Buena
   parte de V12 se pudo construir reutilizando y extendiendo ese mecanismo en vez de crear
   uno nuevo — evitando así tocar el motor de scoring reglamentario, que el Consolidado
   pide explícitamente no tocar salvo necesidad real.
2. Con ese mapa, se armó un plan de implementación en **5 pasadas** (mismo criterio de
   "pocas pasadas decisivas" que en V10) y se lo presenté a Sebastián para aprobación antes
   de escribir código: (1) header + Highlight, bajo riesgo; (2) Ajustar + progresión del
   game, con sus tests; (3) corregir sacador + auditoría de estadísticas, con sus tests;
   (4) Tie break extraordinario — la pasada de mayor riesgo, porque toca la rama
   compartida del motor de puntaje — con sus tests; (5) regresión final, verificación
   manual, versión y entrega.
3. Al diseñar la pasada 3 (sacador) apareció un problema real de diseño que el plan
   original no resolvía del todo: `recordServerAnswer` (la función que ya existía)
   recalcula la rotación de **todo el set** con una fórmula pareja — corregir el sacador
   del game actual con esa función tal cual contaminaría también games anteriores del
   mismo set, justo lo que el Consolidado prohíbe explícitamente (§5.3). Se diseñó un
   mecanismo de "snapshot congelado": la primera corrección dentro de un set guarda una
   foto de cómo se resolvía todo *antes* de esa corrección, y cualquier consulta a un game
   anterior a la corrección se resuelve contra esa foto — nunca contra la fórmula ya
   corregida. Un partido sin ninguna corrección de sacador se comporta exactamente igual
   que antes de V12 (cero riesgo de regresión para el caso común).
4. Al construir los tests de la pasada 4 (Tie break extraordinario) ese mismo mecanismo
   reveló una laguna real: mi primera versión de la corrección de sacador solo servía para
   "jugador equivocado, mismo equipo" — pero "¿Quién comienza sacando?" al arrancar un Tie
   break extraordinario puede elegir a un jugador de **cualquier equipo**, sin relación con
   la rotación previa (así lo pide el propio §11). La corrección original escribía en el
   "casillero" equivocado y nunca se resolvía. Se corrigió haciendo que la corrección de
   sacador también pueda sobreescribir a qué equipo le toca sacar desde ese punto en
   adelante — lo encontraron los tests de motor, antes de tocar una sola línea de interfaz.
5. Se escribieron los tests de cada pasada de riesgo **antes o junto con** el código (no
   después) — 54 aserciones nuevas, una por cada Caso A-N que el propio Consolidado exige
   en sus secciones 15-17. Corrieron en verde de punta a punta: **166/166 tests**.
6. Se levantó un servidor local temporal y se jugaron partidos completos a mano en el
   navegador (no solo simulados): Ajustar en los tres sistemas de puntuación, cambio de
   sacador con puntos ya jugados, el flujo completo de Resolver con Tie break extraordinario
   (selección de modalidad personalizada, elección de sacador, cambio de objetivo en vivo,
   cierre del set), y verificación visual en celular, tablet horizontal y escritorio.
7. Esa verificación manual encontró un bug real que los tests de motor no podían ver (era
   puramente de la interfaz): al elegir "Otro" en el selector de Tie break extraordinario,
   el valor por defecto no se reseteaba bien si antes se había elegido un preset — quedaba
   pegado al target del preset anterior en vez de proponer 12. Se corrigió al toque.
8. Se hizo commit, push directo a `main`, y se taggeó `v12`. Se confirmó con `curl` directo
   contra GitHub Pages (y revisando el build de GitHub Actions) que la versión pública
   realmente sirve el código nuevo antes de dar la ronda por terminada.

### Decisiones de alcance que valen la pena que ChatGPT revise

Ninguna de estas contradice el Consolidado, pero son lugares donde se interpretó una
zona gris o se acotó deliberadamente el alcance:

- **Corregir sacador cubre "jugador equivocado, mismo equipo"** como mecanismo principal
  (el caso real descripto en §5.1). Una corrección de equipo completo en un game normal
  sigue resolviéndose con Editar — el propio §5.3 da esa licencia explícitamente ("para
  correcciones históricas más profundas sigue existiendo EDITAR").
- **"Datos parciales por ajuste manual"** (§3.3) se muestra como una nota puntual en las
  dos filas de estadísticas que un ajuste podría realmente fabricar (Break Points y Racha
  máxima) — no como un banner de página completa cubriendo estadísticas que ese ajuste ni
  siquiera afecta.
- **AJUSTAR solo está disponible fuera de un Tie break** y con el partido sin terminar
  (igual límite que ya tenía la Corrección Rápida existente) — dentro de un Tie break sigue
  existiendo Editar. Mismo criterio para la corrección de sacador por tap: durante un Tie
  break normal la rotación se resuelve punto a punto dentro del propio desempate, un caso
  más ambiguo que preferí seguir cubriendo con Editar en vez de una solución a medias.
- **El fix de la auditoría equipo/individual (§6) se extendió, de regalo, al banner de
  Break Point en vivo** del marcador — mismo bug, misma línea de código, un cambio de una
  palabra. Es un gesto más allá de la letra literal de esa sección (que habla de pantallas
  de estadísticas), pero exactamente en su espíritu.
- **La narrativa de BRAMU Intelligence para el Tie break extraordinario** se agrega como un
  párrafo aparte al final del relato, en vez de integrarse dentro del motor cronológico de
  3 sets (protegido explícitamente en la sección 19, "no tocar salvo regresión real"). La
  consecuencia práctica: en un partido con dominio muy marcado, la frase principal puede
  leerse un poco desconectada de la aclaración del Tie break extraordinario que viene
  después. Es un detalle de pulido narrativo, nunca un dato falso — el texto nunca dice
  6-6/7-6 si no ocurrió, y siempre aclara que fue una decisión extraordinaria.
- El bug preexistente de `scoreAfter` (documentado en el propio Consolidado, sección 21)
  **no se tocó**, tal como pide el documento — el código nuevo de Evolución para el Tie
  break extraordinario no confía en ese campo en el caso límite conocido.

---

## PARTE 2 — Qué se hizo en la app (contra el Consolidado V12)

### Resumen ejecutivo

Los tres pedidos del documento (recuperar rápido un tanteador perdido, corregir un sacador
mal elegido, resolver un set sin fabricar games) están resueltos de punta a punta: motor,
interfaz y narrativa. Ninguna funcionalidad nueva de "modo de juego" (eso queda para más
adelante, sección 20 del Consolidado) — es la misma app de siempre, hecha más honesta con
lo que realmente pasó en la cancha.

### AJUSTAR (sección 2) ✅

Nuevo botón en la fila de herramientas: `DESHACER · AJUSTAR · HIGHLIGHT · EDITAR`. Al
tocarlo, un popup compacto deja elegir el tanteador actual del game — 0/15/30/40 por
equipo, o los estados especiales de Punto de Oro / Con Ventaja (Deuce/Ventaja) / Star Point
(los 5 niveles: Deuce 1, 1ª ventaja, Deuce 2, 2ª ventaja, Star Point), usando exactamente
la lógica real del motor (nunca un estado inventado en paralelo). La selección se marca con
el color de cada equipo — nunca el dorado que usa Editar, para no confundir los dos
mecanismos. Elegir 40-40 en Punto de Oro entra directo al estado correspondiente, sin pedir
una acción adicional.

### Datos parciales — no inventar secuencias (sección 3) ✅

Cuando un ajuste queda dentro del mismo game y avanza (nunca hacia atrás), BRAMU conserva
el total de puntos ganados por cada equipo — es el único dato que no depende de conocer el
orden real de los puntos salteados. Todo lo demás del tramo (Break Points, rachas,
secuencia, sacador) se deja genuinamente en blanco, nunca fabricado. Las dos filas de
estadísticas que un ajuste podría contaminar (Break Points, Racha máxima) muestran la nota
"Datos parciales por ajuste manual" cuando corresponde.

### Progresión del game (sección 4) ✅

Fila de puntitos entre el marcador y el indicador de saque: cada punto real en el color de
su equipo, y un círculo vacío por cada tramo que quedó como ajuste manual (orden
desconocido) — nunca se dibuja un punto de color donde no se sabe qué pasó. Muestra hasta
12 eventos recientes.

### Corregir sacador actual (sección 5) ✅

Tocar el nombre del jugador en el marcador compacto (el mismo indicador que ya existía,
sin agregar otro botón) abre "¿Quién está sacando?". Si ya hay puntos jugados en el game,
pide confirmación explícita ("Los puntos registrados se reasignarán al sacador correcto")
antes de aplicar el cambio — y los reasigna de verdad, sin tocar el sacador de games
anteriores del mismo set (ver el mecanismo de "snapshot congelado" en la Parte 1).

### Auditoría equipo vs. individual (sección 6) ✅

Se encontró y corrigió un bug real, no solo se auditó: cuando se conocía qué **equipo**
estaba al servicio pero no el jugador individual, las estadísticas de **pareja** (breaks,
games de saque ganados/perdidos, % de saque) se descartaban igual — un error de una línea
de código repetido en 4 lugares distintos de `stats.js`. Ahora esas estadísticas de equipo
sobreviven; solo se pierden (correctamente) las que dependen realmente del jugador
individual.

### Header del partido (sección 7) ✅

Línea única en la pantalla de partido en vivo: `BRAMU · FORMATO · SISTEMA · TIEMPO` —
comprime el tamaño en celulares angostos sin ocultar información.

### Highlight — feedback + Blooper (sección 8) ✅

Elegir una categoría de Highlight ahora da un flash verde de confirmación (distinto del
dorado de "Highlight guardado" y del lima del Equipo A). "Dejada" se reemplazó por
"Blooper" como categoría — los highlights viejos guardados como "Dejada" se siguen
mostrando correctamente con esa etiqueta.

### Resolver con Tie break extraordinario (secciones 9-14) ✅

La pieza más grande de la ronda. Disponible desde el menú (☰), solo cuando el game actual
está en 0-0 (tal como pide §9.3). Al elegirlo:

1. Selector de modalidad: los 3 presets del documento (Clásico · a 7, Muere en 7, Tie
   break a 15) más "Otro", con objetivo personalizado y elección entre "Diferencia de 2" /
   "Muere en X" (la etiqueta se actualiza sola con el número elegido).
2. Pregunta obligatoria "¿Quién comienza sacando?" — nunca continúa la rotación previa
   automáticamente, exactamente como pide §11.
3. El Tie break arranca en 0-0, **sin fabricar el game "vacío"** que la app venía
   mostrando — el marcador de games se queda tal cual estaba (5-5, 4-3, lo que sea).
4. Mientras el Tie break está en curso, su definición actual se muestra como una etiqueta
   tocable ("TB A 10 · +2") que abre "Editar definición" — permite subir el objetivo en
   vivo sin perder nada de lo ya jugado (puntos, servicio, orden), pero nunca bajarlo por
   debajo de lo que ya se jugó (probado explícitamente: con 8-4 en el TB, bajar a 7 se
   rechaza).
5. Al cerrarse, el set queda guardado con el score real de games más el resultado del Tie
   break (ej. "5-5 · TB 10-7") — nunca convertido en un 6-5 o 7-6 que no ocurrió.
6. BRAMU Intelligence narra explícitamente la decisión: *"Con el set decisivo 5-5,
   decidieron resolverlo mediante un Tie break a 10 — lo ganaron [pareja] 10-7."* — nunca
   lo presenta como un Tie break reglamentario a 6-6.
7. Evolución marca el arranque del Tie break extraordinario como una transición conocida
   (no como un hueco de datos), y el partido no queda marcado como "datos parciales" solo
   por haberlo usado — es una decisión deliberada e informada, no una ambigüedad.

### Lo que no se tocó, tal como pide el documento (sección 19)

Scoring reglamentario existente (Clásico/Americano, Punto de Oro/Con Ventaja/Star Point,
Tie breaks normales), el Narrative Planner y la composición cronológica de V11.14+ salvo el
agregado puntual de la sección 14.1, la fórmula matemática de Evolución, el bug conocido de
`scoreAfter`, Compartir, perfiles, ranking. No se detectó ninguna regresión que ameritara
tocar algo de esta lista.

### Tests automáticos ejecutados y resultado

`tests.html` (en el navegador, sin Node — no está instalado en esta máquina): **166/166
tests en verde**. 54 son nuevos de esta ronda — uno por cada Caso A-N que exige el propio
Consolidado (secciones 15, 16 y 17), cubriendo Ajustar en los tres sistemas de puntuación,
corrección de sacador antes/después de puntos jugados, y el Tie break extraordinario de
punta a punta (arranque, cierre, cambio de objetivo en vivo, rechazo de bajar el objetivo,
elección de sacador de cualquier equipo, narrativa final).

### Pruebas manuales realizadas

Partidos completos jugados a mano en el navegador: Ajustar en Punto de Oro/Con Ventaja/Star
Point, cambio de sacador con puntos ya jugados, el flujo completo de Tie break
extraordinario (selección personalizada, elección de sacador, edición de definición en
vivo, cierre y resumen final con BRAMU Intelligence), y verificación visual en celular
(375px), tablet horizontal (1024×768) y escritorio.

### Qué probar mejor en la próxima ronda (sugerencia de Claude Code)

1. Usar Ajustar, corregir sacador y Resolver con Tie break en partidos reales de Sebastián
   — todo lo de esta ronda se probó jugando a mano en el navegador, pero no en cancha
   todavía.
2. Prestar atención a cómo se lee BRAMU Intelligence en un partido con Tie break
   extraordinario y dominio muy marcado en algún set — la nota de la sección 14.1 se agrega
   al final del relato y puede leerse un poco separada del resto (ver Parte 1).
3. Si en algún momento se retoma la deuda técnica del `scoreAfter` (sección 21 del
   Consolidado): el código nuevo de esta ronda ya evita confiar en ese campo para el caso
   límite del Tie break extraordinario, pero no lo corrige de raíz — sigue pendiente.

---

## Sobre la próxima ronda

Mismo mecanismo de siempre: un solo Consolidado activo por ronda, dejado en la carpeta de
Dropbox, avisándole a Claude Code el nombre del archivo para arrancar.
