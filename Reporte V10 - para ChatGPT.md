# Reporte BRAMU Lab V10 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabajó directamente sobre la
computadora y el repositorio) para que Sebastián se lo pase a ChatGPT como contexto.
Tiene dos partes bien separadas: **cómo se trabajó** (para juzgar el método) y
**qué se hizo en la app** (para juzgar el resultado contra el Consolidado V10).

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab

---

## PARTE 1 — Cómo se trabajó (lo técnico: Claude Code, GitHub, el método)

### Qué es cada cosa, en criollo

- **Claude Code**: es un asistente de IA que corre directo en la terminal de la
  computadora. A diferencia de ChatGPT (que solo chatea), Claude Code puede leer y
  escribir archivos reales, ejecutar comandos, abrir un navegador para probar la
  app visualmente, y subir cambios a Internet. Todo lo que se describe abajo lo hizo
  directamente sobre los archivos del proyecto, no fueron instrucciones que alguien
  copió a mano.
- **Repositorio (repo)**: la carpeta del proyecto, pero guardada en GitHub con
  historial completo de cambios. Se llama `BRAMUlab`, cuenta `sebastianvilaa`
  (la configuró el hermano de Sebastián).
- **Rama / branch**: una copia de trabajo paralela a la versión "oficial" (llamada
  `main`). Sirve para probar cosas sin tocar todavía lo que ya funciona.
- **Commit**: un "guardado con nombre" de un conjunto de cambios, con una
  descripción de qué se hizo y por qué.
- **Pull Request (PR)**: una propuesta formal de "juntar" una rama con `main`.
  Permite revisar el diff antes de aceptarlo.
- **Merge**: el acto de aceptar esa propuesta y juntar los cambios a `main`.
- **GitHub Pages**: hosting gratuito de GitHub. Si está activado, cualquier cambio
  que llegue a `main` se publica solo, sin pasos extra, en una URL fija.

### Estado inicial encontrado

La carpeta `bramu-lab/` (la app en sí: HTML + CSS + JavaScript puro, sin frameworks,
sin paso de "build" — son archivos que corren directo en el navegador) existía en la
Mac de Sebastián pero **no estaba subida a GitHub todavía**. El repo en GitHub
solo tenía un commit inicial vacío.

### Lo que se hizo, en orden

1. **Se analizó la app existente** (v9.2) leyendo el código para entender qué ya
   estaba resuelto antes de tocar nada — esto importa porque la V9.2 resultó ser
   bastante más madura de lo esperado: ya tenía buena parte de la lógica narrativa
   que pedía el Consolidado V10, solo que sin pulir.
2. **Se armó un servidor local** para poder ver y probar la app en un navegador
   real (no alcanza con abrir el archivo HTML directo por restricciones de
   seguridad del navegador). Ahí se hizo la primera demo en vivo.
3. **Se subió el código a GitHub** por primera vez: se creó una rama, un commit,
   y un Pull Request. Hubo que autenticar `git`/`gh` (las herramientas que hablan
   con GitHub) porque la computadora no tenía credenciales guardadas — esto se
   resolvió con un login por navegador, una sola vez.
4. **Se leyó el Consolidado V10.md completo** (el documento de ~2650 líneas con
   la especificación) y se armó un plan de 4 "toques" de desarrollo, en vez de ir
   sección por sección (el documento tiene 97 secciones numeradas). La idea del
   agrupamiento fue minimizar la cantidad de idas y vueltas necesarias, sin perder
   control sobre el riesgo de romper algo que ya andaba bien.
5. Se ejecutaron los 4 toques (detalle completo en la Parte 2), verificando en el
   navegador después de cada uno.
6. Se armó una **batería de tests automáticos** (26 casos) que corre en el propio
   navegador — no se instaló Node.js porque no estaba disponible en la máquina, así
   que en vez de forzar esa dependencia se optó por un archivo `tests.html` que
   usa el mismo motor de la app. Esto **encontró un bug real** antes de publicarlo
   (ver Parte 2).
7. Se hizo un commit con todos los cambios de V10, se subió (push), se aceptó el
   Pull Request (merge a `main`), y se activó GitHub Pages.
8. **El repo se pasó de privado a público** — fue necesario para que GitHub Pages
   gratis funcione (el plan gratuito de GitHub no permite Pages en repos privados).
   Esto se confirmó con Sebastián antes de hacerlo. Implica que el código fuente
   queda visible para cualquiera que tenga el link del repo — no hay nada sensible
   en el código (es solo la lógica de la app de marcador), pero es un cambio real
   de visibilidad que vale la pena que quede documentado acá.

### Sobre "menos toques posible" — ¿se optimizó?

Sebastián pidió explícitamente minimizar la cantidad de "toques" (pasadas de
desarrollo) para llegar a la V10. La decisión fue agrupar así:

| Toque | Contenido | Por qué se agrupó así |
|---|---|---|
| 1 | Versión centralizada + footer + caché PWA + Highlight rápido | Cambios chicos e independientes entre sí — se resuelven juntos sin agregar riesgo |
| 2 | Limpieza visual del gráfico de Evolución | Cambio autocontenido, no toca la lógica de texto |
| 3 | Motor de BRAMU Intelligence + batería de tests | El núcleo del pedido — se hizo junto con los tests para que cada cambio se autoverifique en el momento, sin depender de ida y vuelta con Sebastián para confirmar que no se rompió nada |
| 4 | Regresión + control de calidad manual | Cierre, antes de entregar |

**Evaluación honesta del método** (para que ChatGPT opine si esto fue lo correcto):

- Lo que salió bien: agrupar el toque 3 (el más grande y riesgoso) *junto* con la
  batería de tests fue la decisión más valiosa — permitió detectar un bug real de
  clasificación narrativa (ver Parte 2) sin necesitar que Sebastián probara a mano
  decenas de partidos. El agrupamiento por "bloques" también respetó el orden de
  prioridad que el propio Consolidado V10 pedía (sección 82: Intelligence primero).
- Lo que es discutible / se podría cuestionar: no se cubrieron automáticamente los
  25 casos de test que el documento originalmente pedía uno por uno — se
  priorizaron ~26 tests propios, elegidos por relevancia respecto a lo que
  realmente se tocó, en vez de una cobertura literal 1 a 1 del documento. Es una
  decisión de costo/beneficio razonable, pero es una simplificación real, no un
  100% del pedido original de testing.
- Otra simplificación: quedó explícitamente afuera la sección de "variedad de
  lenguaje" (bancos de sinónimos, sección 75-76 del documento) para no arriesgar
  romper alguna frase ya validada. Es una decisión conservadora, no un olvido.

---

## PARTE 2 — Qué se hizo en la app (contra el Consolidado V10)

### Resumen ejecutivo

La V9.2 ya traía bastante de lo que pedía el documento (el motor de "historias"
con ranking por peso, la detección de dominio, la orientación de marcador hacia
el protagonista, Momentos Clave). El trabajo de V10 fue **extender y corregir**,
no reescribir. Se entregaron los 5 bloques que el documento marcaba como
prioridad (sección 82), en este estado:

### Bloque A — BRAMU Intelligence (máxima prioridad según el documento) ✅ parcial

Implementado:
- **Gradación de magnitud** en comparaciones (Break Points, oportunidades):
  antes decía "generó más chances" siempre igual; ahora distingue "apenas una
  más" / "algo más" / "claramente más" / "muchas más" según la diferencia real
  — tal como pedía la sección 16/45.1 del documento, con los mismos ejemplos
  numéricos (7 vs 6, 9 vs 3, 16 vs 2, 16 vs 0).
- **Historia nueva: "Tie break decisivo sin quiebres"** (sección 6.12) — antes
  un partido sin ningún quiebre, decidido por tie break, no tenía una lectura
  narrativa propia; ahora sí.
- **Corrección de orientación de marcador** (sección 27/45.4): en partidos sin
  ganador todavía (parciales, en curso), el resumen de sets podía mostrar el
  marcador al revés (ej. "4-6" en vez de "6-4" cuando ganó el equipo B). Corregido.
- **Bug real encontrado y corregido**: el clasificador de "dominio claro" podía
  etiquetar un 6-3 con un solo quiebre en un set parejo como "dominaron de
  principio a fin" — exactamente el caso que la sección 6.1 del documento
  prohíbe explícitamente ("No detectar dominio simplemente porque un set
  terminó 6-3"). Lo detectó la batería de tests, no una revisión manual.

No implementado / dejado afuera a propósito:
- **Bancos de variantes de lenguaje** (sección 75-76): rotación de sinónimos
  para palabras repetidas ("consiguieron", "terminaron"). Se evaluó y se decidió
  no tocarlo en esta ronda para no arriesgar romper alguna plantilla de texto ya
  validada — las ~15 plantillas existentes tienen bastante redacción a mano.
- Algunas categorías de la taxonomía (sección 6, ej. 6.6 "partido que se
  escapa", 6.9 "presión sin conversión" como categoría con nombre propio) se
  cubren con mecanismos ya existentes (menciones de Match Points salvados,
  interpretación de Break Points) en vez de tener su propia historia dedicada
  con nombre. Cubre el contenido factual pedido, pero no es una implementación
  literal 1 a 1 de cada categoría nombrada.

### Bloque B — Tests de Intelligence ✅ (con alcance reducido, ver Parte 1)

Se armó `bramu-lab/tests.html` — corre en el navegador, sin dependencias.
26 tests, **26/26 en verde** al momento de la entrega. Cubre: gradación de
magnitud, interpretación de Break Points (incluida la regla del 0/0), casos de
dominio total, casos de "mismo resultado, historia distinta" (secciones 49/50
del documento), tie break decisivo, orientación de marcador.

No cubre automáticamente: los 25 casos de test originales uno por uno
(quedaron los de mayor relevancia respecto a lo efectivamente tocado).

### Bloque C — Evolución (gráfico del partido) ✅

- Vista Partido: se sacaron los símbolos de mini-break, círculos de quiebre y
  cierre de tie break — quedó solo la curva, los separadores de set, y el
  resultado de cada set.
- Match Point: reemplazado el rombo flotante por una línea vertical discreta con
  etiqueta "MP" o "N MP" (agrupa varios Match Points seguidos de la misma
  secuencia en una sola marca, como pedía la sección 35).
- Vista por Set: mantiene todo el detalle anterior sin cambios (sección 36).

### Bloque D — Highlight rápido ✅

Comportamiento completo pedido en las secciones 40-43: tocar "Highlight" lo
guarda al instante (no espera nada), aparece un popup chico no invasivo con 4
categorías (Smash/X3, Dejada, Recuperación, Puntazo) en grilla 2x2, con un aro
de progreso que muestra visualmente cuánto falta para el cierre automático
(3.5 segundos). Si tocás afuera se cierra sin cancelar el highlight. Las
categorías quedan visibles en la lista de Highlights y en Momentos Clave.

### Bloque E — Footer / versión ✅

Número de versión centralizado en un solo lugar del código (`v10`), footer
actualizado, caché de la PWA (para que funcione offline) actualizada a
`bramulab-v10` para que nadie quede viendo una versión vieja guardada en su
celular.

### Qué probar mejor en la próxima ronda (sugerencia de Claude Code)

1. Jugar partidos completos a mano en los modos que no se re-verificaron manualmente
   esta vez: **Americano**, **Con Ventaja**, **Star Point**, corrección de tie
   break en vivo, y finalización manual.
2. Leer el texto de BRAMU Intelligence en 3-4 partidos reales (no simulados) de
   Sebastián y compararlo contra su propio recuerdo del partido — es el test
   más importante según la sección 74 del documento ("¿una persona que vio el
   partido reconoce la película?"), y todavía no se hizo con partidos reales,
   solo con partidos simulados por Claude Code.
3. Si en algún momento se quiere invertir el tiempo, cerrar los bancos de
   variantes de lenguaje (75-76) que quedaron afuera.

---

## Sobre la próxima ronda (10.2 vs 11)

El criterio de Sebastián (pocos cambios → 10.2, cambios grandes → 11) es
razonable y es el estándar habitual. Sugerencia: no importa tanto el número en
sí como que **haya un solo Consolidado activo por ronda** — si en el camino
aparece feedback suelto (capturas, mensajes de WhatsApp, etc.), conviene
juntarlo todo en el MD antes de avisar que está listo, en vez de mandarlo en
partes.

El mecanismo para arrancar la próxima ronda es exactamente el que Sebastián
describió: dejar el archivo `.md` con el consolidado nuevo en la misma carpeta
de Dropbox donde ya está `Consolidado V10.md` (Finder → Dropbox → Otros
Trabajos → BRAMUlab → BRAMUlab), y avisarle a Claude Code el nombre del archivo
para que arranque.
