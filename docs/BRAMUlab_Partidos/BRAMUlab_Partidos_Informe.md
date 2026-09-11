# BRAMUlab_Partidos
## Informe — qué se implementó, verificó y corrigió

**Tipo de documento:** informe retrospectivo (síntesis documental de informes ya cerrados, no una verificación nueva).
**Fecha de esta síntesis:** 10/09/2026.
**Estado final de la app:** commit `5c46337`, tag `v14` — producto congelado, sin ninguna ronda nueva autorizada desde entonces.
**Cómo leer este documento:** cada sección corresponde a una ronda ya implementada y publicada. El detalle completo (archivos tocados, capturas, verificación manual paso a paso) vivía en el informe original de cada ronda (citado por nombre en cada sección) — esos originales, junto con los consolidados que los motivaron, ya no están en este repositorio; se borraron una vez confirmado que este resumen no perdía nada relevante y siguen recuperables del historial de git (commit `40c82bc` o anterior).

---

## 0. Arquitectura vigente al cierre (acumulada, no por versión)

Toda la línea corre en JavaScript puro sobre la carpeta de código `bramulab-partidos/`, sin framework ni paso de build, publicada en GitHub Pages (`https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/`) desde el mismo repositorio `https://github.com/sebastianvilaa/BRAMUlab` — el repo se pasó de privado a público en V10 porque GitHub Pages gratuito no funciona sobre repos privados.

- **`engine.js`** — motor de scoring reglamentario: Clásico/Americano, Punto de Oro/Star Point/Con Ventaja, Tie breaks normales, rotación de saque, Quick Correction. Extendido en V12 reutilizando un mecanismo preexistente de "reemplazo de estado completo" (`applyAdjustment`, que ya sostenía el editor de marcador) para construir `AJUSTAR` y el Tie break extraordinario sin tocar el motor reglamentario. Extendido en V13 con un **motor paralelo y más simple** para el modo Por Games (`applyGameWin` / `applyGameTiebreak` / `applyExtraordinaryGameTiebreak`), construido así deliberadamente porque el motor de puntos existente resultó "entrelazado con la lógica de puntos" y no se prestaba a simplemente "apagar" el conteo interno — el motor nuevo reutiliza todo lo agnóstico de puntos (formatos, validadores reglamentarios, resolución de sacador) sin duplicar el motor de Completo.
- **`stats.js`** — BRAMU Intelligence y estadísticas. Ya traía, antes de V11, una arquitectura de "historias" candidatas con peso/prioridad (no una plantilla de frases sueltas) — el trabajo de V10-V13.3 fue extender y corregir ese motor, no reescribirlo. Con V13.3 se formaliza explícitamente la arquitectura **DATOS → HECHOS → EVENTOS → JERARQUÍA → RELACIONES → HISTORIA → EVIDENCIA → REDACCIÓN**, compartida entre Completo y Por Games (que difieren solo en cuánta evidencia hay disponible). Por Games (V13) y los partidos cargados manualmente (V14) usan cada uno su propio generador de texto, más corto, que solo afirma lo que sus datos reales sostienen — nunca comparten motor con Completo para no arriesgar inventar hechos a nivel de punto que esos modos no tienen.
- **Highlight rápido** (módulo nuevo de V10): categorías evolucionaron de Smash/X3-Dejada-Recuperación-Puntazo (V10) a Smash/X3-Recuperación-Puntazo-Blooper (V12, reemplazando Dejada).
- **Evolución del partido** (gráfico): vista Partido y vista Set con reglas propias por versión (detalladas en las secciones de cada ronda); Por Games (V13) tiene su propio gráfico más simple (un nodo por game); los partidos cargados manualmente (V14) **no tienen** gráfico de Evolución — se oculta el módulo entero en vez de mostrarlo vacío.
- **`tests.html`** — único arnés de test de toda la línea, corre en el navegador (no hay Node.js instalado en la máquina de desarrollo en ningún momento de esta línea). El conteo de tests creció así a lo largo de la línea: 26 (V10) → 59 (núcleo de V11) → 82 (tras V11.1-V11.13) → 166 (V12) → 212 (V13) → 270 (V13.3) → 295 (V13.4) → **323 (V14, cifra final)**. Como se detalla en la nota de cierre (§6), estos números no encadenan de forma perfectamente lineal entre rondas documentadas, lo cual es evidencia indirecta de rondas intermedias reales cuyos informes no sobrevivieron en este repositorio.
- Este motor de marcador y estadísticas —`engine.js`/`stats.js`— fue después **reusado sin cambios** como base de BRAMUlab_V01, según registra explícitamente `BRAMUlab_V01_Informe.md` (§0): "motor del marcador y estadísticas del producto anterior, reusados sin cambios".

---

## 1. V10 — BRAMU Intelligence extendida, Evolución simplificada, Highlight rápido

**Fuente:** `BRAMUlab_Partidos_V10_Informe.md`. El informe original no registra un hash de commit específico (el formato de "Commit de esta ronda" recién aparece a partir del informe de V11) — se sabe que el trabajo se hizo en una rama con Pull Request (primera subida del código a GitHub), se mergeó a `main`, y se activó GitHub Pages sobre el repo ya vuelto público.

Implementado: gradación de magnitud en comparaciones de Break Points/oportunidades (7 vs 6 ≈ "apenas una más" hasta 16 vs 0 ≈ "diferencia enorme"); nueva historia narrativa "Tie break decisivo sin quiebres"; corrección de orientación de marcador en resúmenes de sets sin ganador definido todavía; Evolución con vista Partido limpia (sin mini-break markers ni círculos de quiebre) y Match Point como línea vertical "MP"/"N MP"; Highlight rápido completo (registro inmediato, popup 2×2, aro de progreso de 3.5s, cierre sin cancelar al tocar afuera); footer/versión centralizados en `v10`, caché de PWA actualizada a `bramulab-v10`.

**Bug real encontrado y corregido antes de publicar** (lo encontró la batería de tests, no una revisión manual): el clasificador de "dominio claro" podía etiquetar un `6-3` con un solo quiebre en un set parejo como "dominaron de principio a fin" — exactamente el caso que la propia sección 6.1 del Consolidado prohíbe ("no detectar dominio simplemente porque un set terminó 6-3").

Dejado explícitamente afuera, documentado como decisión de alcance y no como olvido: los bancos de variantes de lenguaje (para no arriesgar romper las ~15 plantillas de texto ya validadas) y una cobertura automática 1 a 1 de los ~25 casos de test que pedía el documento original (se priorizaron 26 tests propios por relevancia). **Tests: 26/26.**

---

## 2. V11 — Narrative Planner real, correcciones de BP/orientación/redundancia, Key Points diferido

**Fuente:** `BRAMUlab_Partidos_V11_Informe.md`. Commit `e373328`, tag `v11`.

La investigación previa a programar confirmó, línea por línea en `stats.js`, que **todos los bugs de la sección 2 del Consolidado existían literalmente en el código** (no eran hipotéticos): Break Points 0 vs 0 narrados como "más contundente"; misma eficiencia con distinta cantidad de oportunidades narrada como "aprovechó mejor"; orientación de marcador cruda en la rama de remontada (podía decir "ganarlo 6-7" hablando de quien en realidad ganó 7-6); redundancia de un Tie break narrado dos veces. Los cinco se corrigieron, más un sexto bug de concordancia gramatical en singular ("Seba y Matu generó...") que **no estaba en los ejemplos del propio Consolidado** — apareció al leer el código con atención mientras se corregía algo cercano.

Se reescribió el motor de remontadas para reconocer en qué **set concreto** ocurrió una remontada con Match Points salvados y Tie break — antes solo se adjuntaban esos hechos si coincidían con el último set del partido, y el caso patrón del propio Consolidado (`6-3 · 6-7 · 2-6`) caía exactamente en ese agujero, perdiendo el primer y el tercer set de la narración. Se simplificó además la función de interpretación de Break Points: existían dos ramas separadas (historia principal / párrafo secundario) con guardas ligeramente distintas — esa duplicación era la raíz del bug de "0 quiebres"; quedó una sola función usada en ambos lugares.

Estadísticas de Tie break corregidas para saque/resto/individual (antes se excluían del todo, rompiendo la igualdad `saque + resto = total`), sin aportar a games de saque ni a Break Points/breaks. Evolución vista Set: se sacó el rombo+etiqueta de mini-break (se amontonaban en un TB largo) y se agregaron marcas discretas por game. Highlight: reposicionado el popup al centro; el bug "Z1" que el Consolidado pedía revisar **no se encontró en el código** — Highlights y Momentos Clave ya mostraban "Highlight" correctamente sin categoría, sin rastro de ningún identificador interno expuesto. Configuración reordenada (Formato→Sistema), renombrada a "Sistema de puntuación". Navegación post partido: "NUEVO PARTIDO"→"VOLVER AL INICIO", agregado también en Análisis. Footer actualizado a "Sebastián Vila" (corrigiendo el "Julián Sebastián" que había pedido y llevado V10).

**Explícitamente no implementado, con motivo documentado**: el sistema de doble eje de dominancia/leverage (`importanceScore`) de las secciones 4-5 — el sistema de "historias" con peso que ya existía cumplía la misma función práctica de ordenar candidatas narrativas, y construir un motor de puntaje por punto nuevo no iba a cambiar ningún texto verificable por test, a diferencia de los otros arreglos. Quedaron sin cubrir por esto: hold 40-0 vs. hold salvando 0-40 (§4.3) y Oro temprano vs. tardío (§5.2) — **hasta esta ronda**; el primero se resolvió parcialmente en V11.2 (ver abajo).

**Tests: 59/59** (33 nuevos), incluida una simulación punto por punto del caso patrón completo del Consolidado.

### V11.1 a V11.13 — feedback real de cancha (13 subidas chicas, sin documento de especificación propio)

A diferencia de la ronda anterior, esta parte del Informe de V11 no responde a un Consolidado escrito — nace de Sebastián probando la app jugando partidos reales y mirándola en el inspector de Chrome simulando tablet/desktop. Se hizo en 13 subidas (`v11.1` a `v11.13`), cada una con su propio commit y tag.

**BRAMU Intelligence** (v11.2, v11.4): se agregaron los 4 bancos de sinónimos por función narrativa que V11 había dejado afuera (Inicio/Reacción/Quiebre/Cierre), elegidos determinísticamente a partir de datos reales del partido (nunca al azar); se agregó la señal puntual de "hold bajo presión" (sostener el propio saque salvando 2+ Break Points seguidos) sin construir el motor genérico de leverage que se había dejado afuera en V11. **Bug real** encontrado jugando (Americano, 5-5 sin quiebres, definido en Tie break): BRAMU solo decía "ganaron el Tie break 7-3" sin contar la paridad real ni el desarrollo del TB — dos causas: el hold bajo presión (agregado un día antes) le tapaba el lugar protagónico al resumen de Break Points, y el TB se narraba siempre como resultado final, nunca como secuencia con forma propia. Corregido moviendo el hold bajo presión a un párrafo secundario garantizado y narrando el desarrollo real del TB cuando hay una separación clara.

**Evolución** (v11.3, v11.4, v11.13): los ticks de "cada game" en vista Set se reemplazaron por checkpoints en los cambios de lado reales del pádel (games 3, 5, 7, 9...), con ancla inicial en 0-0. **Bug real** (reproducido con medidas exactas): el SVG tenía `height:auto` en CSS, que con un `viewBox` calcula el alto a partir del ancho renderizado — invisible en contenedores angostos, pero con los anchos de escritorio nuevos de esta misma ronda el alto se disparó a ~612px cuando debía ser 184px. Corregido fijando el alto por CSS.

**Layout responsive en tablet/desktop** (la mayor parte de esta ronda, v11.1 y v11.5-v11.13): marcador en vivo con las dos zonas de saque lado a lado en horizontal (tope de 1100px); **bug real** de inconsistencia de fondo (`#05100E` vs. `var(--ink)`, dos colores oscuros casi iguales usados en pantallas distintas) unificado a un solo color; sistema de dos anchos para escritorio/tablet (560px pantallas cortas tipo formulario, 768px pantallas largas de lectura — se probó y se revirtió un tercer escalón de 1100px por inconsistencia visual contra Inicio); Inicio rearmado lado a lado en horizontal; **bug real de flexbox** en Resumen (`align-items:center` en un contenedor con scroll recortaba el borde superior en tablet horizontal cuando el contenido no entraba) corregido con `margin:auto`.

**Tests: 82/82** al cierre de esta sub-ronda, con test de regresión para cada bug de `stats.js` de esta parte (los cambios de CSS/layout se verificaron a mano, midiendo anchos/altos reales por JavaScript, en al menos 3 tamaños de pantalla).

---

## 3. V12 — Ajustar, corrección de sacador, Tie break extraordinario

**Fuente:** `BRAMUlab_Partidos_V12_Informe.md`. Commit `c5f2189`, tag `v12`.

La investigación previa encontró que ya existía en el motor un mecanismo de "reemplazo de estado completo" (`applyAdjustment`, base del editor de marcador) — se reutilizó y extendió para `AJUSTAR` y el Tie break extraordinario en vez de crear un mecanismo nuevo, evitando tocar el motor de scoring reglamentario. Plan ejecutado en 5 pasadas, aprobado por Sebastián antes de escribir código.

**Bug de diseño encontrado antes de escribir la interfaz** (pasada 3, corrección de sacador): la función existente `recordServerAnswer` recalculaba la rotación de **todo el set** con una fórmula pareja — usarla tal cual para corregir el sacador del game actual habría contaminado también games anteriores del mismo set, justo lo que el Consolidado prohíbe (§5.3). Se diseñó un mecanismo de "snapshot congelado": la primera corrección dentro de un set guarda una foto de cómo se resolvía todo *antes* de esa corrección, y cualquier consulta a un game anterior se resuelve contra esa foto, nunca contra la fórmula ya corregida — un partido sin correcciones se comporta exactamente igual que antes de V12.

**Segundo bug de diseño encontrado al construir los tests** (pasada 4, Tie break extraordinario): la primera versión de la corrección de sacador solo servía para "jugador equivocado, mismo equipo", pero "¿Quién comienza sacando?" al iniciar un TB extraordinario puede elegir a un jugador de **cualquier equipo** (§11 del Consolidado) — la corrección original escribía en el "casillero" equivocado y nunca se resolvía. Se corrigió permitiendo que la corrección de sacador también reasigne a qué equipo le toca sacar desde ese punto — lo encontraron los tests de motor, antes de tocar la interfaz.

**Bug real encontrado en verificación manual** (no detectable por tests de motor, puramente de interfaz): al elegir "Otro" en el selector de Tie break extraordinario, el valor por defecto no se reseteaba si antes se había elegido un preset — quedaba pegado al target anterior en vez de proponer 12. Corregido al toque.

**Bug real encontrado y corregido en la auditoría equipo/individual** (§6 del Consolidado): cuando se conocía el equipo al servicio pero no el jugador individual, las estadísticas de **pareja** (breaks, games de saque, % de saque) se descartaban igual — un error de una línea de código repetido en 4 lugares de `stats.js`. Corregido; se extendió, "de regalo" (mismo bug, misma línea, un cambio de una palabra), al banner de Break Point en vivo del marcador, aunque el Consolidado hablaba solo de pantallas de estadísticas.

Decisiones de alcance documentadas: corregir sacador cubre "jugador equivocado, mismo equipo" como mecanismo principal (una corrección de equipo completo sigue yendo por Editar, con licencia explícita del propio §5.3); AJUSTAR y la corrección de sacador por tap quedan deshabilitados dentro de un Tie break (se sigue usando Editar ahí); la narrativa del TB extraordinario se agrega como párrafo aparte al final (en vez de integrarse en el motor cronológico de 3 sets, protegido explícitamente); el bug conocido de `scoreAfter` (documentado en el propio Consolidado, §21) **no se tocó**, tal como se pedía.

**Tests: 166/166** (54 nuevos, uno por cada Caso A-N que exige el Consolidado).

---

## 3.1 V12.1 Express — sin Informe propio en este repositorio

**Fuente:** solo sobrevive `BRAMUlab_Partidos_V12.1_Express_Consolidado.md`; no existe en este repositorio un Informe separado que documente commit, tag, bugs encontrados o tests de esta ronda específica.

No se puede afirmar con la misma precisión que en las demás secciones qué se implementó exactamente ni con qué desvíos. Sí hay evidencia indirecta fuerte de que la ronda se ejecutó: el Consolidado de V13 toma como base explícita "V12.2 cerrada y validada manualmente" (un nombre de versión distinto al de este documento — ver nota de cierre, §6), y el conteo de tests salta de 166 (cierre de V12) a 186 (base declarada por el Informe de V13 antes de sus 26 tests nuevos) — una diferencia de 20 tests que es consistente con que esta ronda (o una sucesora no documentada, "V12.2") efectivamente se implementó con su propia batería de regresión, aunque el reporte detallado no sobrevive en este repositorio.

---

## 4. V13 — Modo Por Games · BETA

**Fuente:** `BRAMUlab_Partidos_V13_Informe.md`. Commit `41ae5ae`, tag `v13`.

El mapeo de arquitectura previo confirmó que el motor de puntos existente estaba "entrelazado con la lógica de puntos" y no se prestaba a simplemente apagar el conteo interno — se construyó un **motor paralelo y más simple** (`applyGameWin`/`applyGameTiebreak`/`applyExtraordinaryGameTiebreak` en `engine.js`) que reutiliza todo lo agnóstico de puntos (formatos, validadores, resolución de sacador, `isValidTiebreakScore`) sin duplicar ni tocar el motor de Completo. Plan de 4 pasadas ejecutado de punta a punta con autorización ya dada.

**Dos bugs reales encontrados en verificación manual, antes de llegar a Sebastián**: (1) **remontada falsa al perder un set** — si una pareja perdía un set estando muy abajo (ej. 0-6) y el set siguiente arrancaba en 0-0, el cálculo de "mayor desventaja remontada" contaba eso como si hubieran remontado 6 games, y BRAMU Intelligence llegó a decir "recuperaron terreno después de estar 6 games abajo" sin que fuera cierto — corregido para que un set nuevo resetee el contador sin acreditar ninguna remontada; (2) **"Games ganados" se quedaba corto tras una corrección manual** — si se usaba Ajustar Games, el total de "games ganados" en el Resumen no contaba los games que la corrección había absorbido de una sola vez (mostraba 3 cuando el marcador ya decía 4) — corregido leyendo siempre el total del marcador final (dato matemáticamente seguro, §11 del Consolidado), nunca de una cuenta evento por evento que una corrección puede dejar corta.

Diferencias deliberadas respecto del Consolidado, documentadas: "Ajustar Games" y "Editar marcador completo" se implementaron como un solo modal con revelado progresivo, no dos pantallas separadas; "partido ya empezado" (arrancar Por Games a mitad de un partido real) no se implementó, por no estar entre los 25 criterios de cierre; Compartir no se adaptó a Por Games (excluido explícitamente por el Consolidado, §31) — si se intenta desde un partido Por Games, falla de forma segura con aviso, sin datos inventados; desglose de saque individual (no por pareja) tampoco se agregó, por no estar entre los criterios de cierre.

**Tests: 212/212** (186 previos sin modificar + 26 nuevos, cubriendo los Casos A/B/C/F/G/H/I/J/N del Consolidado, los dos bugs reales, y que Evolución no fabrica el tramo intermedio de una corrección).

---

## 4.1 V13.2 — sin Informe propio en este repositorio

**Fuente:** solo sobrevive `BRAMUlab_Partidos_V13.2_Consolidado.md`; no existe en este repositorio un Informe separado para esta ronda, ni tampoco ningún documento (Consolidado o Informe) con el nombre "V13.1", pese a que el propio Consolidado de V13.2 declara "V13.1" como su base.

No es posible documentar con precisión, desde este repositorio, la causa técnica exacta del bug de Wake Lock, el mecanismo final de detección de versión, ni los bugs reales encontrados durante la implementación de esta ronda — esa información se perdió junto con el informe original. Hay evidencia indirecta de implementación real: el Informe de V13.3 (§"Bug real encontrado en el camino") menciona explícitamente que los modales de "Hay una nueva versión" (introducido en V13.2) y "Sistema de puntuación" convivían mal por estar anidados dentro de la sección de Home, lo que confirma que la actualización automática de V13.2 efectivamente se construyó y se usaba en producción. El conteo de tests también sube de 212 (cierre de V13) a 262 (base declarada por el Informe de V13.3 antes de sus 8 tests nuevos) — un salto de 50 tests consistente con la implementación real de V13.1 y V13.2, aunque no se pueda separar cuánto correspondió a cada una sin los informes originales.

---

## 4.2 V13.3 — arquitectura narrativa, bug de stats por set, Timeline Por Games, sistema de puntuación en vivo (primera versión)

**Fuente:** `BRAMUlab_Partidos_V13.3_Informe.md`. Commit `4c86355`, tag `v13.3`.

**BRAMU Intelligence (Por Games)** — dos correcciones de fondo: (1) el código anterior buscaba "el último empate" del set para contar la racha de cierre, lo cual es una contradicción real cuando la racha decisiva arranca **abajo** en el marcador, no empatada (el propio Consolidado lo señala: "si una racha fue 1-4 → 6-4, el origen es 1-4"). Se reescribió para buscar la racha de cierre real (la corrida más larga contando hacia atrás desde el último game) y reportar el score exacto de origen, sea empate o déficit — esto además permite distinguir una remontada real (arrancó abajo) de un set simplemente parejo (arrancó empatado), verificado con los dos benchmarks exactos del Consolidado. (2) Se agregó reconocimiento de cuando el equipo que pierde "corta" una racha de apertura aunque después no le alcance (benchmark B del Consolidado, reproducido casi palabra por palabra). **Límite honesto documentado**: el Set 3 del benchmark B (parejo hasta 2-2, con un quiebre que abre diferencia y otro que cierra) no se llegó a armar como la mini-crónica de tres actos que imaginaba el Consolidado — cae a una descripción genérica correcta pero menos rica, sin inventar nada falso; queda anotado para una ronda futura. **Completo no se tocó**: ya usaba su propio mecanismo (`computeSetGameDeficits`) que no tenía este bug.

**Bug real de estadísticas por set — causa encontrada**: con el benchmark `4-6 · 6-1 · 6-3`, el Set 3 mostraba holds/breaks incorrectos porque, al aislar las estadísticas de UN set, el código volvía a reproducir esos eventos desde cero — tanto "en qué set estamos" como "qué número de game global es este" (usado para la paridad de quién saca) quedaban mal en cuanto el saque inicial de ese set difería del de Set 1. Corregido pasándole el punto de partida real (número de set + número de game global) en vez de asumir que siempre arranca en cero; se agregó un test que verifica la identidad `suma de breaks/holds/games por set = total del partido`.

**Timeline Por Games**: reescrito para mostrar cada fila como un game real (`Game 3 · 2-1 · HOLD · Ganó ... · Saque: ...`) con Highlights intercalados por hora real y tramos de corrección manual marcados como parciales — antes mostraba una progresión de puntos (`0-15-30-40`) que nunca se registró en este modo.

**Sistema de puntuación en vivo (primera implementación de esta ronda, luego reemplazada por V13.4)**: en Por Games, metadata pura cambiable en cualquier momento desde el menú. En Completo, se implementó guardando **el sistema vigente en cada punto individual** — la idea era que, como cada punto ya jugado conserva su propia regla para siempre, cambiar el sistema hacia adelante nunca podría reinterpretar retroactivamente un game ya cerrado, así que (en el razonamiento de esta ronda) "nunca hacía falta bloquearlo". Verificado en vivo: a 40-40 con Punto de Oro, cambiar a Con Ventaja dejaba correctamente "VENTAJA" sin inventar que el game había terminado.

**Bug real encontrado en el camino**: los modales de "Hay una nueva versión" (V13.2) y "Sistema de puntuación" vivían dentro de la sección de Home, que la app oculta apenas arranca un partido — un modal con posición fija no se pinta si algún ancestro está oculto, así que ninguno de los dos se veía nunca durante un partido en vivo. Se movieron junto al toast global.

**Tests: 270/270** (262 previos sin modificar + 8 nuevos: los dos benchmarks narrativos exactos, las invariantes de estadísticas por set, y tres casos de seguridad del cambio de sistema en Completo).

---

## 4.3 V13.4 — hotfix: sistema único de partido, reemplazando el modelo "regla por punto" de V13.3

**Fuente:** `BRAMUlab_Partidos_V13.4_Informe.md`. Commit `f03c2ef`, tag `v13.4`.

**Contradicción real entre rondas consecutivas, documentada explícitamente en vez de resuelta en silencio**: la prueba manual de V13.3 encontró que su propio diseño de "regla por punto" (§4.2 de este informe) permitía terminar un mismo partido con games jugados bajo Punto de Oro, otros bajo Star Point y otros bajo Con Ventaja — un partido "híbrido" que el producto no debe permitir. V13.4 **reemplazó por completo** esa lógica: el sistema de puntuación pasó a ser una única propiedad del partido (`match.scoringSystem`), no algo que cada punto recuerda por separado. Esto no es un error de esta síntesis ni una elección entre dos versiones contradictorias del mismo hecho — es la secuencia real: una ronda construyó un diseño con sus propios tests, la siguiente lo revirtió explícitamente por una consecuencia de producto inaceptable detectada en el uso real.

**Cómo decide si un cambio es seguro**: antes de reproducir el game en curso bajo el sistema nuevo, se comprueba si en algún punto anterior de ese mismo game el sistema nuevo ya lo habría dado por terminado; si nunca lo hubiera cerrado antes, el cambio es seguro y las opciones incompatibles quedan **deshabilitadas** (visibles pero no tocables) en el selector, nunca ocultas sin explicación. **Cuándo se bloquea definitivamente**: en cuanto se cierra el primer game que llegó a 40-40 (el primer game donde el sistema realmente decidió algo), queda fijo para el resto del partido, ni desde "CAMBIAR" ni desde el menú ☰ — un game ganado 4-0/4-1/4-2 nunca cuenta como "sensible" porque ahí los tres sistemas se comportan igual. **Cómo evita estadísticas híbridas**: al ser un único sistema por partido, un partido con Punto de Oro nunca puede tener Star Points registrados (y viceversa) de forma automática, sin necesitar validación extra.

Otros ajustes de esta ronda: "CAMBIAR" reubicado dentro de la franja contextual junto al texto central (antes suelto debajo de Deshacer/Ajustar/Highlight/Editar), agregando que la franja muestre "VENTAJA" como texto (antes quedaba vacía en ese momento) para que "CAMBIAR" tenga dónde anclarse; popup de actualización con "ACTUALIZAR" arriba y "MÁS TARDE" abajo (antes lado a lado); corrección narrativa Por Games para no confundir una desventaja de 1 game causada por el orden de saque con una reacción/remontada real (comparando contra quién sacaba cada game); escala de lenguaje de porcentaje de saque corregida (un 5/10 = 50% ya no puede describirse como "casi todos"; si el % propio no alcanza para hablar de dominio, el comentario se omite directamente).

**Tests: 295/295** (270 previos + 25 nuevos/reescritos): se reemplazaron los 3 casos de V13.3 que probaban el modelo viejo por 3 nuevos sobre el modelo actual (partido híbrido imposible, corrección segura en 40-40, compatibilidad Star↔Ventaja), se sumaron casos para las dos correcciones narrativas y la escala de porcentajes, y se corrigió un test de una ronda anterior que —sin que nadie lo hubiera notado— dependía del mismo bug de orden de saque que esta ronda vino a arreglar.

---

## 5. V14 — Cargar partido jugado

**Fuente:** `BRAMUlab_Partidos_V14_Informe.md`. Commit `5c46337`, tag `v14` — **estado final de la línea**.

El mapeo de arquitectura se hizo en dos pasadas (no una): la primera exploración general, y una segunda relectura línea por línea que corrigió el primer mapa en varios puntos — los sets no tienen campo "número de set" (la posición en la lista ya cumple esa función), `terminationType:'manual'` ya significaba algo distinto ("partido cortado antes de tiempo desde el menú ☰", no confundir con el nuevo "partido cargado"), y un botón de Timeline se habría quedado sin comportamiento definido para el modo nuevo si no se detectaba antes. Antes de programar, Sebastián pidió confirmar en vivo el número real de tests de V13.4 —la memoria de sesiones anteriores decía 212/212, un número que en realidad correspondía a V13, antes de que V13.1-V13.4 agregaran más casos—; se verificó contra el commit exacto de V13.4: **295/295**, y el plan se corrigió con ese dato antes de tocar código.

**Decisión de arquitectura documentada**: Por Games (V13) sí muestra un gráfico de Evolución, aunque más simple que el de Completo, porque ese modo registra cada game a medida que se juega — el dato existe, solo que es menos detallado. Un partido **cargado** es distinto: no hay ningún evento intermedio, solo el resultado final de cada set. Por eso Evolución y Momentos Clave no se muestran "vacíos" ni con aviso de "no disponible" — se **ocultan directamente**, porque mostrar un gráfico sin nada que graficar no es informar con honestidad, es ruido. El selector de resultado por set reutiliza el mismo validador que ya usaba el editor de Por Games (scores reales y posibles según formato — Clásico hasta 7-6/7-5, Americano hasta 6-5, nunca 7-5 porque el TB de Americano dispara en 5-5), así que un resultado imposible no se puede ni seleccionar.

**Bug real encontrado y corregido durante el desarrollo, antes de llegar a producción**: el botón "↩ Deshacer último punto" del Resumen se calculaba con una condición que, sin un chequeo extra, también se hubiera cumplido para un partido recién cargado — mostrando un botón que, al tocarlo, habría intentado deshacer un punto de un partido que nunca se jugó en vivo dentro de la app. Se agregó el chequeo de origen que faltaba.

Implementado: nueva acción "Cargar partido jugado" en Home (link discreto, separado de "Empezar partido"); misma pantalla de configuración reutilizada al 100% (Equipos, Formato, Sistema); selector de resultado por set con scores válidos, tercer set solo si corresponde; Detalles del partido (fecha obligatoria, hora opcional y borrable, lugar opcional con geolocalización que nunca bloquea el guardado si se rechaza — solo se guardan coordenadas, sin reverse geocoding); guardado en el mismo Historial con etiqueta discreta "PARTIDO CARGADO"; Resumen/Análisis mostrando solo lo que el dato real sostiene (ganador, resultado por set, sets y games ganados), ocultando duración/Evolución/Momentos Clave/Timeline completo; BRAMU Intelligence propia y más chica (ganador, sets corridos o remontada a nivel de sets, set más parejo/de mayor diferencia, si el decisivo fue ajustado) sin inventar nunca quiebres, rachas de game, ni nada que dependa de haber visto el partido punto a punto. Resuelto de paso el micro-polish pendiente de V13.4 (centrado del texto de la franja contextual cuando aparece "CAMBIAR" al lado).

**Diferencia deliberada respecto del Consolidado, documentada**: Momentos Clave se oculta por completo (en vez de mostrar una versión mínima con solo "fin de set" como podía interpretarse del documento) porque los pocos hechos disponibles ya están dentro del texto de BRAMU Intelligence, y una segunda lista casi vacía al lado no agrega información.

**Tests: 323/323** (295 previos sin modificar, verificados en vivo contra el commit exacto de V13.4 antes de arrancar, + 28 nuevos: los 4 casos con motor que pide el Consolidado —Clásico 2 sets, remontada a 3 sets, Tie break reglamentario, Americano— más validaciones de que la narración nunca inventa detalles de TB ni menciona quiebres/puntos/rachas). Los casos que dependen de la pantalla (hora vacía, geolocalización rechazada, Historial mixto) se verificaron a mano en el navegador, no con el motor puro.

---

## 6. Estado al cierre

BRAMUlab_Partidos terminó su desarrollo funcional en **V14** (commit `5c46337`, tag `v14`), con **323/323 tests** en verde, sin ninguna ronda nueva autorizada desde entonces. La línea completa —desde V10 hasta V14— sumó, según los informes que sí sobreviven en este repositorio, al menos 7 bugs reales de BRAMU Intelligence corregidos antes o durante producción, 4 bugs reales de motor/estadísticas (rotación de sacador, remontada falsa por cambio de set, stats por set con sacador inicial incorrecto, games ganados cortos tras corrección), y una reversión completa de arquitectura documentada explícitamente entre V13.3 y V13.4 (sistema de puntuación por punto → sistema único por partido).

**Notas de proceso — gaps de documentación señalados en vez de rellenados**, para que quede constancia en vez de una síntesis que aparente más completitud de la que hay:

- **V11.14 a V11.16**: el Consolidado de V12 declara su base como "V11.16" y menciona explícitamente "composición cronológica V11.14+" como algo a no tocar, pero el Informe de V11 solo documenta hasta `v11.13`. Hubo al menos 3 tags más (`v11.14`, `v11.15`, `v11.16`) con trabajo real —el salto de tests de 82 (fin de v11.13) a 112 implícitos antes de los 54 nuevos de V12 (166 total) es consistente con eso— sin informe que lo describa en este repositorio.
- **"V12.2" vs. V12.1 Express**: el Consolidado de V13 toma como base "V12.2 cerrada y validada manualmente", pero el único documento de esa sub-ronda que sobrevive se llama V12.1 Express, y no hay Informe ni Consolidado con el nombre "V12.2" en este repositorio (ver §3.1 arriba).
- **V13.1**: referenciado como base explícita en el Consolidado de V13.2, pero no existe ningún documento V13.1 —ni Consolidado ni Informe— en este repositorio (ver §4.1 arriba).
- Ninguno de estos gaps se rellenó con suposiciones: donde la evidencia indirecta (cifras de test, referencias cruzadas de rondas posteriores) permite confirmar que el trabajo ocurrió, se dice así explícitamente; donde no hay evidencia de qué se hizo exactamente, se deja constancia de que no se sabe, en vez de inventarlo.

Los documentos originales de cada ronda (citados arriba por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Informe no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).
