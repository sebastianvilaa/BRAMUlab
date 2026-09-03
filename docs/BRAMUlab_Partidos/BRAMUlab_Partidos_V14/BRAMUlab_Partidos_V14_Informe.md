# Reporte BRAMU Lab V14 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto.
Mismas dos partes que los reportes anteriores: **cómo se trabajó** y **qué se hizo en la
app**. Es la continuación de esos reportes — no repite las definiciones básicas.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [5c46337](https://github.com/sebastianvilaa/BRAMUlab/commit/5c46337)
**Tag:** `v14`

---

## PARTE 1 — Cómo se trabajó

### De dónde nació esta ronda

V14 no es un ajuste sobre lo que ya existía — el propio Consolidado lo dice: abre una
etapa nueva. Hasta V13.4, BRAMU solo sabía de partidos que se registraban EN VIVO
(Completo o Por Games). La pregunta de V14 es otra: ¿puedo cargar un partido que ya jugué,
en pocos segundos, y que la app igual me devuelva algo interesante? La vara para medir el
resultado no es cuántos campos tiene la pantalla nueva — es si registrar un partido viejo
se siente "rápido, completo y útil", como pide el propio documento.

### Lo que se hizo, en orden

1. **Mapeo de arquitectura antes de programar, en dos pasadas** (no una sola): primero una
   exploración a fondo de `index.html`/`app.js`/`store.js`/`stats.js`/`tests.html` para
   entender cómo Completo y Por Games ya conviven hoy (el campo `mode` del partido, y el
   patrón repetido de "si el modo es X, usar esta función; si no, la de siempre" en cada
   pantalla). Después, una segunda pasada que **releyó el código real línea por línea** para
   confirmar o corregir ese mapa antes de tocar nada — y encontró varias cosas que el primer
   mapeo no había visto: que los sets no tienen un campo "número de set" (la posición en la
   lista ya cumple esa función), que `terminationType:'manual'` ya significaba algo
   distinto ("partido cortado antes de tiempo desde el menú ☰") y no debía confundirse con
   el nuevo "partido cargado", y que un botón de Timeline se hubiera quedado sin comportamiento
   definido para el modo nuevo. Encontrar esto ANTES de escribir código evitó tener que
   deshacer trabajo después.
2. **Corrección de un dato de partida antes de arrancar**: al presentar el plan, Sebastián
   pidió confirmar el número real de tests de la versión anterior (V13.4) antes de seguir —
   la memoria de sesiones anteriores decía 212/212, un número que en realidad correspondía a
   V13 (antes de que V13.1-V13.4 agregaran más casos). Se verificó en vivo, en el navegador,
   contra el commit exacto de V13.4: **295/295**. El plan se corrigió con ese dato antes de
   tocar una sola línea de código — la regla que quedó explícita fue que ningún test vigente
   de V13.4 se podía borrar o relajar sin una razón documentada.
3. Con el plan ya revisado y aprobado, se ejecutó en 4 pasadas, en el orden de menor a mayor
   riesgo: (1) un arreglo visual aislado y sin relación (ver más abajo); (2) la pantalla
   nueva completa con su validación, sin todavía guardar nada (para poder probar la
   interacción sin arriesgar el resto de la app); (3) el modelo de datos, el guardado real y
   los ~8 puntos del código donde Resumen/Análisis/Historial deciden qué mostrar según el
   modo del partido — la parte de más riesgo, hecha junto con su propia batería de tests;
   (4) regresión completa, prueba manual en navegador, versión y entrega.
4. **Verificación real, no solo de lectura de código**: se levantó un servidor local liviano
   (Python, sin depender de Node — este Mac sigue sin tenerlo) y se cargaron partidos de
   verdad en el navegador: sets corridos, remontada a 3 sets, revelado del tercer set solo
   cuando corresponde, Americano (confirmando que nunca ofrece un 7-5, solo hasta 6-5),
   Cancelar, y el partido resultante abierto en Resumen, Análisis e Historial.
5. Esa verificación encontró **un bug real antes de que llegara a Sebastián** (detalle en
   Parte 2) — se corrigió en el momento, no quedó para una ronda futura.
6. Se corrió la batería de tests existente (295 casos de V9 a V13.4, sin modificarlos) para
   confirmar cero regresiones, y se agregaron 28 tests nuevos específicos de esta carga
   manual. Total final: **323/323 verde**, confirmado dos veces en un servidor recién
   levantado (para descartar que el navegador estuviera mostrando una versión vieja
   guardada en caché — pasó una vez durante el desarrollo y se detectó a tiempo).

### Una decisión que vale la pena que Sebastián entienda

Por Games (V13) sí puede mostrar un gráfico de Evolución, aunque más simple que el de
Completo, porque ese modo registra cada game a medida que se juega — el dato existe, solo
que es menos detallado. Un partido **cargado** es distinto: no hay ningún evento intermedio,
solo el resultado final de cada set. Por eso Evolución y Momentos Clave no se muestran
"vacíos" ni con un aviso de "no disponible" — se **ocultan directamente**. Mostrar un
gráfico sin nada que graficar no es informar con honestidad, es ruido. La misma lógica
aplica al selector de resultado: en vez de un campo de texto libre, cada set se carga con
un selector que solo ofrece scores reales y posibles (6-3, 7-5, 7-6, etc.) — reutilizando
el mismo validador que ya usaba el editor de Por Games, así que un resultado imposible no
se puede ni siquiera seleccionar, sin necesidad de escribir una validación nueva desde cero.

---

## PARTE 2 — Qué se hizo en la app

### CARGAR PARTIDO JUGADO — lo esencial

- **Nueva acción en Home**, separada de "Empezar partido" (no es un tercer modo de
  registro en vivo — es otro flujo): un link discreto debajo del botón principal.
- **Misma pantalla de siempre, extendida**: tarjetas de Equipo A/B, Formato de partido,
  Sistema de puntuación — idénticas a las de arrancar un partido en vivo.
- **Resultado**: un selector por set con scores reales según el formato (Clásico hasta
  7-6/7-5, Americano hasta 6-5 — nunca 7-5, porque el Tie break de Americano dispara en
  5-5). El tercer set solo aparece si el partido no quedó decidido en los primeros dos.
  Nunca pide secuencia de games, puntos, ni quién sacó.
- **Detalles del partido**: fecha obligatoria (hoy por defecto), hora opcional y realmente
  borrable, lugar opcional con un botón de "usar mi ubicación" — si el celular rechaza el
  permiso o no lo tiene, no rompe nada ni bloquea guardar, simplemente se puede escribir el
  lugar a mano. No hay ningún servicio que adivine el nombre del club solo con GPS — se
  guardan coordenadas, el nombre lo escribe quien carga el partido.
- **Se guarda en el MISMO Historial** que Completo y Por Games, con una etiqueta discreta
  ("PARTIDO CARGADO") — no hay una base de datos separada.
- **Resumen/Análisis muestran solo lo que el dato real sostiene**: ganador, resultado por
  set, sets y games ganados. Se ocultan (no vacíos, directamente ocultos): duración,
  Evolución, Momentos Clave y el botón de Timeline completo — ninguno de esos existe para
  un partido del que solo se conoce el resultado final.
- **BRAMU Intelligence propia y más chica**: solo puede decir ganador, sets corridos o
  remontada (perdió el primer set y ganó los siguientes), cuál fue el set más parejo y
  cuál el de mayor diferencia, y si el set decisivo se definió ajustado. Nunca inventa
  quiebres, rachas de game, ni nada que dependa de haber visto el partido punto a punto.

### Micro-polish de V13.4 resuelto de paso

El texto central de la franja de arriba durante el partido en vivo ("PUNTO DE ORO",
"DEUCE", etc.) se veía corrido hacia la izquierda cuando "CAMBIAR" estaba visible al lado.
Corregido: ahora el texto queda centrado contra el ancho total de la franja, y "CAMBIAR"
queda anclado a la derecha sin desplazarlo. Sin tocar ninguna lógica de puntuación.

### Bug real encontrado y corregido durante el desarrollo (nunca llegó a producción)

El botón "↩ Deshacer último punto" del Resumen se calcula hoy con una condición que, sin
un chequeo extra, también se hubiera cumplido para un partido recién cargado — mostrando
un botón que, al tocarlo, hubiera intentado deshacer un punto de un partido que nunca se
jugó en vivo dentro de la app (rompiendo o sin hacer nada coherente). Se agregó el chequeo
que faltaba antes de que esto llegara a probarse en cancha.

### Diferencias respecto del Consolidado (deliberadas, documentadas)

- **Momentos Clave se oculta por completo** para un partido cargado, en vez de mostrar una
  versión mínima con solo "fin de set". El Consolidado no lo pide explícitamente de una
  forma u otra — se optó por ocultarlo porque los pocos hechos disponibles ya están dentro
  del texto de BRAMU Intelligence, y una segunda lista casi vacía al lado no agrega
  información, solo ocupa lugar.
- El resto de la ronda sigue el Consolidado al pie de la letra — no hubo otros apartamientos
  relevantes.

### Tests finales

- **295/295** tests previos (V9 a V13.4, sin modificar) — cero regresiones, verificados en
  vivo contra el commit exacto de V13.4 antes de arrancar (no asumidos de memoria).
- **28 tests nuevos**: los 4 casos con motor que pide el Consolidado (Clásico 2 sets,
  remontada a 3 sets, Tie break reglamentario, Americano), más validaciones de que la
  narración nunca inventa detalles de Tie break ni menciona quiebres/puntos/rachas.
- **Total: 323/323 verde.**
- Los casos que dependen de la pantalla (hora vacía, geolocalización rechazada, Historial
  con partidos de los tres tipos conviviendo) no se pueden probar con el motor puro — se
  verificaron a mano en el navegador: guardar sin hora ni lugar funciona, rechazar la
  ubicación no bloquea ni rompe nada, y un partido Completo/Por Games/Cargado conviven en
  el mismo Historial mostrando cada uno solo lo que le corresponde.

### Puntos recomendados para probar en la práctica

1. **Cargar de memoria un partido real jugado hace poco** — ¿el resultado final "se siente
   completo", o falta algún dato que en el momento parecía importante?
2. **Probar la ubicación desde el celular real** (no desde una compu) — el comportamiento
   de permisos de geolocalización varía más entre navegadores móviles.
3. **Historial mixto con partidos reales** — jugar uno en vivo (Completo o Por Games) y
   cargar otro ya jugado, y ver si conviven con naturalidad en la misma lista.
4. El detalle chico del centrado de "CAMBIAR" — confirmar que ahora se ve bien en el
   celular real, no solo en la comprobación de escritorio.
