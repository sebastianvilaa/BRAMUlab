# BRAMU LAB — CONSOLIDADO V11
## Implementación sobre la V10 actual

> Archivo de implementación para Claude Code.
> Trabajar sobre el proyecto local/repo actual de BRAMU Lab.
> No reconstruir la aplicación desde cero ni reexplicar contexto ya presente en el proyecto.
> Antes de editar, inspeccionar el estado actual de V10 y preparar un plan de ejecución.
> Implementar todo lo marcado como **CONFIRMADO**, corregir regresiones, ejecutar pruebas y dejar el proyecto listo para testeo real.

---

# 0. OBJETIVO DE V11

V11 tiene un objetivo principal y varios ajustes secundarios.

El objetivo principal es llevar **BRAMU Intelligence** al nivel que todavía no alcanzó en V10:

> BRAMU Intelligence debe dejar de resumir estadísticas y pasar a construir una crónica objetiva, personal y suficientemente rica como para que, después de registrar un partido de 60–120 minutos, el usuario sienta que valió la pena cargarlo y quiera leer qué interpretó BRAMU.

La V10 mejoró mucho:

- Evolución del partido;
- Highlights rápidos;
- Momentos Clave;
- gradación de algunas comparaciones;
- clasificación de algunos escenarios;
- versión/cache;
- publicación online.

Pero el testeo real de V10 confirmó que el núcleo narrativo sigue siendo demasiado corto y que todavía existen bugs lógicos/semánticos en BRAMU Intelligence.

V11 debe concentrarse principalmente en resolver eso.

---

# 1. DECISIONES CONFIRMADAS

## 1.1 BRAMU Intelligence es el diferencial principal

BRAMU Intelligence debe sentirse como:

> Un tercer observador que vio el partido completo y puede explicar qué pasó, cómo cambió, qué momentos tuvieron verdadero peso y cómo terminó construyéndose el resultado.

No debe sentirse como:

> una tabla convertida en frases.

Debe usar los nombres reales de los jugadores de forma natural.

Ejemplo:

- “Seba y Matu arrancaron mejor…”
- “Gusti y Esteban reaccionaron…”
- “Edu y Jona encontraron el quiebre…”

Evitar abusar de “Equipo A / Equipo B” en la prosa final si los nombres están disponibles.

La personalización mediante nombres forma parte importante del valor del producto.

---

## 1.2 La historia manda sobre las estadísticas

Orden conceptual obligatorio:

**DATOS**
→ **HECHOS**
→ **RELACIONES**
→ **CONTEXTO**
→ **CLASIFICACIÓN**
→ **PUNTOS / SECUENCIAS DE ALTA INCIDENCIA**
→ **STORY RANKING**
→ **EVIDENCIAS**
→ **SUPRESIÓN**
→ **NARRATIVE PLAN**
→ **TEXTO**

No generar el texto mediante:

`dato interesante → frase`.

Las estadísticas son evidencia.

No son la historia.

---

## 1.3 El resultado final no define por sí solo la historia

Ejemplo:

### Caso A

`5–0 → 5–3 → 6–3`

Puede existir dominio claro inicial + reacción tardía.

### Caso B

`1–1 → 2–2 → 3–3 → 4–3 → break → 6–3`

Es un partido parejo que se rompe al final.

Mismo resultado.

Historia diferente.

Regla:

> “Nunca estuvo por debajo” no equivale a “dominó de principio a fin”.

La secuencia del marcador puede **vetar** una clasificación de dominio aunque el reparto de puntos sea favorable.

---

## 1.4 Los ganadores condicionan la interpretación, pero no reescriben la cronología

Si una pareja salva Match Points y finalmente gana:

puede hablarse de remontada / “se agarraron al partido”.

Si salva los mismos Match Points y termina perdiendo:

la secuencia sigue siendo importante, pero la historia es diferente.

Regla:

> El desenlace cambia el significado de los acontecimientos, pero no puede borrar lo que realmente ocurrió.

---

# 2. CORRECCIONES OBLIGATORIAS DE V10

## 2.1 BUG GRAVE — Break Points con 0 conversiones de ambos lados

Caso real detectado:

- A: `0/3 BP`
- B: `0/5 BP`

V10 llegó a decir:

> “Seba y Matu fueron mucho más contundentes y consiguieron 0 quiebres en 3 oportunidades.”

Esto es incorrecto y destruye credibilidad.

### REEMPLAZAR

Si ambos equipos tuvieron oportunidades pero ambos convierten `0`:

- nunca hablar de “más contundente”;
- nunca hablar de “mejor eficiencia”;
- nunca comparar conversiones como si hubiese diferencia;
- nunca escribir “consiguió 0 quiebres” como evidencia positiva.

Narrativa válida si aporta:

> “Ambas parejas tuvieron oportunidades al resto, pero ninguna consiguió quebrar.”

Si existe diferencia relevante de cantidad:

> “Gusti y Esteban generaron algo más de presión desde la devolución, con cinco oportunidades frente a tres, aunque ninguno de los dos equipos consiguió convertir un Break Point.”

---

## 2.2 Eficiencia igual con distinto número de oportunidades

Ejemplo:

- A `3/9`
- B `2/6`

Ambos convierten `33%`.

No decir:

> “A aprovechó mejor sus oportunidades.”

Puede decirse:

- A consiguió más breaks;
- A generó más oportunidades;

pero **no** mejor eficiencia.

Agregar test de regresión específico.

---

## 2.3 Concordancia gramatical de parejas

Bug real:

> “Seba y Matu generó…”

Corregir todas las ramas equivalentes.

Con sujeto formado por dos jugadores:

- generaron;
- consiguieron;
- aprovecharon;
- convirtieron;
- cerraron;
- salvaron;
- etc.

Auditar plantillas similares.

---

## 2.4 Score orientado en la prosa

Bug real detectado en V10:

> “Estuvieron 1-5 abajo y lo dieron vuelta para ganarlo 6-7.”

Hablando de la pareja ganadora del set, debe ser:

> “Estuvieron 1–5 abajo y lo dieron vuelta para ganarlo 7–6.”

Usar el helper de orientación en **todas** las ramas narrativas.

No concatenar `gamesA-gamesB` directamente cuando la frase está escrita desde la perspectiva del Equipo B.

Agregar regresión automática.

---

## 2.5 Evitar redundancia narrativa

Caso V10:

> “La definición pasó por el Tie break, que Gusti y Esteban ganaron 7-3.”

y después:

> “Terminaron cerrando el Tie break final 7-3.”

No repetir el mismo hecho salvo que el segundo uso agregue nueva información.

La fase de **Suppression** debe eliminar:

- repetición del score;
- repetición del mismo Tie break;
- dos frases que expresan el mismo cierre;
- estadísticas que vuelven a contar una secuencia ya explicada.

---

# 3. NUEVO NÚCLEO DE V11 — NARRATIVE PLANNER REAL

V10 todavía selecciona historias interesantes, pero no construye con suficiente profundidad la película completa.

V11 debe incorporar un **Narrative Planner cronológico real**.

---

## 3.1 Cobertura mínima de la película

Antes de redactar, dividir el partido conceptualmente en:

1. **APERTURA / PRIMER ACTO**
2. **BISAGRA / CAMBIO**
3. **DESENLACE**

En partidos a tres sets con desarrollos claramente distintos:

> no omitir un set relevante solo porque otra historia obtuvo más peso.

Ejemplo real de V10:

`6–3 · 6–7 · 2–6`

La narración omitió prácticamente:

- el primer set;
- el dominio/superioridad del ganador en el tercer set.

Eso no debe volver a ocurrir.

---

## 3.2 Longitud adaptable, pero más generosa

BRAMU Intelligence NO debe tener una longitud fija.

### Partido simple

Ejemplo:

`6–0 · 6–0`

Objetivo aproximado:

- 1–2 párrafos;
- ~80–140 palabras si hay poca historia.

### Partido intermedio

Ejemplo:

set parejo + único break tardío.

Objetivo aproximado:

- 2 párrafos;
- ~120–180 palabras.

### Partido rico

Ejemplo:

- tres sets;
- cambios de dominio;
- break/contra-break;
- ventaja grande recuperada;
- Match Points;
- Tie break;
- tercer set diferente.

Objetivo aproximado:

- 3 párrafos;
- ~180–280 palabras.

Estos rangos NO son límites rígidos.

La regla es:

> Si el partido tuvo mucha historia, BRAMU debe permitirse contarla.

Un partido de una hora y media no puede quedar resumido en dos frases genéricas si existen datos suficientes para una crónica rica.

---

## 3.3 Estructura recomendada de un partido rico

### Párrafo 1 — Cómo empezó y cómo se construyó la primera ventaja

Ejemplo:

> “Seba y Matu arrancaron mejor y se llevaron el primer set 6–3…”

### Párrafo 2 — El tramo bisagra

Ejemplo:

> “En el segundo llegaron a ponerse 5–1, pero Gusti y Esteban recuperaron los dos quiebres…”

Luego:

- Match Points;
- Tie break;
- recuperación;
- cambio de control.

### Párrafo 3 — Desenlace + evidencia útil

Ejemplo:

> “El tercero tuvo otro desarrollo…”

Y recién después, si aporta:

- puntos totales;
- efectividad;
- BP;
- SP;
- MP;
- Oro/Star.

---

## 3.4 Caso patrón obligatorio

Caso probado manualmente:

`Seba/Matu 6–3 · 6–7 · 2–6 Gusti/Esteban`

Desarrollo relevante:

- Seba/Matu ganan el primer set 6–3;
- en el segundo llegan aproximadamente a 5–1;
- Gusti/Esteban recuperan la desventaja;
- Seba/Matu vuelven a quedar en posición de cerrar;
- disponen de 3 Match Points;
- Gusti/Esteban salvan los 3;
- llegan al Tie break;
- Gusti/Esteban ganan el TB con claridad;
- en el tercer set Gusti/Esteban consiguen dos quiebres y ganan 6–2.

La salida debe cubrir los tres actos.

Calidad objetivo aproximada:

> **Seba y Matu arrancaron mejor y se llevaron el primer set 6–3. En el segundo ampliaron todavía más la ventaja y llegaron a ponerse 5–1, pero Gusti y Esteban recuperaron terreno, devolvieron los quiebres y consiguieron volver a emparejar el parcial.**
>
> **Seba y Matu volvieron a quedar en posición de cerrar y dispusieron de tres Match Points, pero Gusti y Esteban salvaron los tres y llevaron el set al Tie break. Ahí terminaron inclinando el desempate a su favor y mandaron el partido al tercero.**
>
> **El último set ya tuvo otro desarrollo: Gusti y Esteban consiguieron dos quiebres, tomaron rápidamente la ventaja y terminaron cerrando 6–2. Aunque el reparto global de puntos fue relativamente parejo, fueron más efectivos en los momentos que terminaron modificando el marcador.**

No copiar literalmente siempre.

Usar como estándar de riqueza.

---

# 4. BRAMU KEY POINTS / INCIDENCIA COMPETITIVA

V11 debe profundizar el concepto ya iniciado en el Playbook.

No copiar fórmulas propietarias de Padel Intelligence.

Construir una lógica propia utilizando únicamente datos que BRAMU realmente registra.

Objetivo:

> detectar qué puntos y secuencias tuvieron mayor incidencia competitiva en el partido.

---

## 4.1 Dos ejes independientes

Cada tramo/evento debe poder evaluarse al menos en dos dimensiones:

### A. DOMINANCIA DEL GAME / SECUENCIA

Qué tan contundente fue dentro de ese game.

Ejemplo:

- hold 40–0;
- break 0–40.

### B. IMPORTANCIA / LEVERAGE EN EL PARTIDO

Cuánto podía cambiar la posición competitiva del partido.

Ejemplo:

- break en 0–0 del primer set;
- break en 4–4 del tercero.

No son lo mismo.

Un break 0–40 temprano puede ser más dominante.

Un Oro peleado en 4–4 del tercero puede ser mucho más importante.

---

## 4.2 Presión antes del Break Point

Estados relevantes que BRAMU ya conoce:

- 0–30;
- 15–30;
- 30–30;
- 0–40;
- 15–40;
- 30–40;
- Deuce;
- Ventaja;
- Punto de Oro;
- Star Point;
- Set Point;
- Match Point.

No narrar cada uno.

Usarlos para medir presión y construir contexto.

---

## 4.3 Mismo resultado, distinta dificultad

Comparar:

### Hold A

Servidor gana 40–0.

### Hold B

Servidor empieza 0–40, salva tres Break Points y finalmente sostiene.

Ambos cuentan como:

`1 game de saque ganado`.

Pero competitivamente no significan lo mismo.

BRAMU debe poder reconocer:

> “Tuvieron que defender tres oportunidades de quiebre antes de sostener el servicio.”

No convertir esto en psicología.

No decir:

- “mostraron fortaleza mental”;
- “tuvieron nervios”;
- “demostraron carácter”.

Describir el hecho observable.

---

# 5. PROPUESTA OPERATIVA DE SCORE DE INCIDENCIA

Implementar una métrica interna determinística.

No mostrar necesariamente el número al usuario.

Puede llamarse internamente, por ejemplo:

`importanceScore`
o
`leverageScore`.

Objetivo:

ordenar acontecimientos y ayudar al Narrative Planner.

---

## 5.1 Base del punto

Asignar una base según estado competitivo del punto.

No es una probabilidad de ganar.

Es prioridad narrativa/contextual.

Referencia inicial para calibración:

- punto rutinario temprano: `5–10`
- 30–30 / 15–30 / 0–30: `15–25`
- Break Point: `30–45`
- Punto de Oro / Star decisivo: `35–50`
- Set Point: `45–60`
- Match Point: `60–75`

No congelar estos valores como dogma.

Ajustar mediante tests.

---

## 5.2 Contexto del game/set

Sumar importancia si el marcador está avanzado o muy cerrado.

Ejemplos:

- 0–0 primer set: ajuste pequeño;
- 4–4: ajuste alto;
- 5–5: ajuste alto;
- final set: ajuste adicional;
- game que deja sirviendo para set/partido: ajuste alto.

---

## 5.3 Impacto estructural del resultado del punto

Aumentar peso cuando el punto:

- genera un break;
- evita un break;
- produce contra-break;
- completa remontada;
- iguala un set tras desventaja importante;
- deja a una pareja sirviendo para set;
- deja a una pareja sirviendo para partido;
- cierra set;
- cierra partido;
- salva Match Point;
- convierte Match Point.

---

## 5.4 Relación con la secuencia

No evaluar puntos completamente aislados.

Ejemplos:

### `1–4 → 4–4`

La llegada a 4–4 vale más por completar la recuperación.

### `5–3 + MP perdido → 5–4`

Perder el MP no debe generar un “precipicio” inmediato.

La posición sigue siendo favorable.

### `5–3 → 5–4 → 5–5 → 5–6`

La erosión de la ventaja es progresiva.

### break → contra-break

El primer break pierde parte de su valor narrativo si se devuelve inmediatamente.

### break → hold

Puede representar consolidación.

---

# 6. KEY SEQUENCES — AGRUPAR, NO LLENAR DE EVENTOS

BRAMU debe poder agrupar puntos de alta incidencia en una **secuencia significativa**.

Ejemplo:

- 5–1;
- recuperación a 5–5;
- nuevo break;
- 3 MP;
- salvados;
- TB.

No convertirlo en diez frases aisladas.

Crear una relación narrativa:

> “recuperaron dos quiebres, volvieron al partido, salvaron tres Match Points y forzaron el Tie break.”

La secuencia puede tener más peso que cualquier estadística agregada.

---

# 7. TAXONOMÍA DE HISTORIAS A SOPORTAR

No es obligatorio exponer estos nombres al usuario.

Sí deben existir como conceptos detectables.

---

## 7.1 Dominio claro

Debe requerir evidencia estructural.

No clasificar por resultado final aislado ni por porcentaje de puntos aislado.

La secuencia puede vetar “de principio a fin”.

---

## 7.2 Partido parejo

Indicadores:

- holds prolongados;
- diferencias pequeñas;
- breaks recuperados;
- set abierto hasta tramo tardío;
- TB sin dominio previo.

---

## 7.3 Partido definido por un detalle

Partido estructuralmente parejo hasta evento tardío:

- único break;
- Oro decisivo;
- Star decisivo;
- TB.

---

## 7.4 Remontada completa

Déficit real → recuperación → victoria.

---

## 7.5 Remontada incompleta

Déficit → recuperación importante → derrota.

---

## 7.6 Partido que se escapa

Una pareja llega realmente cerca de cerrar y termina perdiendo.

Especialmente:

- gana primer set;
- tiene MP;
- pierde segundo;
- pierde tercero.

---

## 7.7 “Se agarraron al partido”

Usar solo si:

1. enfrentan MP;
2. lo/s salvan;
3. finalmente ganan.

Si salvan MP y pierden:

- “se mantuvieron con vida”;
- “estiraron el partido”.

---

## 7.8 Cambio de dominio

Ejemplo:

`6–1 · 1–6 · tercer set`.

---

## 7.9 Presión sin conversión

Muchos BP / estados de presión, pocos o ningún break.

No confundir presión con dominio.

---

## 7.10 Victoria por efectividad

Menos oportunidades, mejor conversión, cuando eso realmente explica el resultado.

---

## 7.11 Ganador con menos puntos

Mencionar solo cuando la contradicción es significativa.

No por diferencias mínimas.

---

## 7.12 Tie break decisivo sin breaks

Caso real V10:

- 5–5;
- ningún break;
- TB 7–3.

Historia correcta:

> “Nadie consiguió quebrar y la diferencia apareció recién en el Tie break.”

No repetir dos veces el TB.

---

# 8. BREAK POINTS — REGLAS DEFINITIVAS

Prioridad:

**BREAKS CONSEGUIDOS**
→ **EFICIENCIA**
→ **OPORTUNIDADES GENERADAS**

Pero nunca forzar las tres.

---

## 8.1 Ambos 0

Ejemplo:

`0/5 vs 0/3`

Narrar:

- presión;
- oportunidades;
- ausencia de conversión.

No eficiencia.

---

## 8.2 Mismos breaks, eficiencia distinta

Ejemplo:

`2/14 vs 2/3`

Puede decirse:

> “Con los mismos dos quiebres, B necesitó muchas menos oportunidades para conseguirlos.”

---

## 8.3 Más breaks, menor eficiencia

Ejemplo:

`3/9 vs 2/3`

Debe poder decir simultáneamente:

- A consiguió más breaks;
- B fue más eficiente.

No confundir ambas dimensiones.

---

## 8.4 Diferencias de magnitud

Mantener gradación semántica.

Referencia:

- `7 vs 6` → similares / apenas una más / omitir;
- `9 vs 6` → más;
- `9 vs 3` → claramente más;
- `16 vs 2` → muchas más;
- `16 vs 0` → diferencia enorme de presión.

Evitar adjetivos exagerados por diferencias pequeñas.

---

# 9. EVIDENCE SELECTION — QUÉ ESTADÍSTICAS ENTRAN

Una estadística solo entra a BRAMU Intelligence si:

- explica;
- refuerza;
- contextualiza;
- contradice de manera interesante.

No porque exista.

---

## 9.1 Caso real de tres sets

Resultado:

`6–3 · 6–7 · 2–6`

Datos aproximados del test:

- puntos totales: `48% vs 52%`;
- saque/resto relativamente parejos;
- Set Points: `1/4 vs 2/2`;
- Match Points: `0/3 vs 1/1`;
- Oro: `1/3 vs 2/3`;
- BP: `4/7 vs 5/5`.

Lectura:

El reparto global fue relativamente parejo.

La diferencia apareció más en la efectividad de puntos de cierre y en cómo se resolvieron secuencias importantes.

No convertir automáticamente todos esos datos en una lista.

Elegir uno o dos si realmente mejoran el cierre de la crónica.

---

# 10. SUPPRESSION — QUÉ CALLAR

BRAMU debe poder omitir:

- rachas irrelevantes;
- Oro equilibrado;
- BP poco explicativos;
- porcentaje de puntos cercano si no agrega nada;
- duración;
- “set más parejo”;
- estadísticas que repiten la cronología.

Regla:

> Callarse una estadística puede mejorar la inteligencia del análisis.

---

# 11. LENGUAJE

## 11.1 Permitido

Cuando los datos lo justifican:

- arrancaron mejor;
- tomaron la iniciativa;
- marcaron diferencias;
- sostuvieron;
- quebraron;
- recuperaron el break;
- contraquebraron;
- consolidaron;
- reaccionaron;
- recuperaron terreno;
- volvieron al partido;
- se mantuvieron con vida;
- se agarraron al partido;
- estuvieron a un punto de cerrar;
- les costó cerrar;
- generaron presión;
- fueron más efectivos;
- se impusieron en el tramo final.

---

## 11.2 Prohibido / no medible

No inferir:

- fortaleza mental;
- debilidad mental;
- nervios;
- miedo;
- confianza;
- carácter;
- desconcentración;
- cansancio;
- “pecho frío”;
- “se achicaron”;
- “no bajaron los brazos” como psicología.

Describir hechos.

Ejemplo:

NO:

> “demostraron carácter”.

SÍ:

> “salvaron tres Match Points y terminaron ganando.”

---

## 11.3 Variación de lenguaje

V10 dejó afuera los bancos de variantes.

V11 debe mejorar esto sin romper precisión.

Crear variantes por función narrativa:

### Inicio

- arrancaron mejor;
- comenzaron mejor;
- tomaron primero la ventaja;
- marcaron las primeras diferencias.

### Reacción

- respondieron;
- reaccionaron;
- recuperaron terreno;
- volvieron a meterse en el set;
- consiguieron igualar el desarrollo.

### Break

- consiguieron el quiebre;
- encontraron el break;
- quebraron el servicio rival;
- aprovecharon la oportunidad al resto.

### Cierre

- sostuvieron la ventaja;
- cerraron el set;
- terminaron imponiéndose;
- aprovecharon la oportunidad para cerrar.

No elegir sinónimos aleatoriamente si cambian el significado.

---

# 12. ESTADÍSTICAS DE TIE BREAK — DECISIÓN CERRADA

V10 excluye los puntos de Tie break de algunas métricas de saque/resto.

Eso produce una inconsistencia visible.

Caso real:

Seba/Matu:

- puntos totales: `33`;
- al saque: `20`;
- al resto: `10`;
- faltaban `3` puntos, exactamente sus puntos ganados en TB.

Gusti/Esteban:

- puntos totales: `34`;
- al saque: `20`;
- al resto: `7`;
- faltaban `7`, exactamente los puntos ganados en TB.

---

## 12.1 INCLUIR Tie break en:

### Puntos ganados totales

Ya se incluyen.

Mantener.

### Puntos ganados al saque

**INCLUIR.**

Cada punto de TB tiene un sacador conocido.

### Puntos ganados al resto

**INCLUIR.**

Cada punto de TB tiene una pareja restando.

### Saque por jugador — puntos

**INCLUIR.**

Si Seba sacó puntos durante el TB, esos puntos deben formar parte de:

`puntos ganados / puntos sacados`.

### Set Points

**INCLUIR** si ocurren durante el TB.

### Match Points

**INCLUIR** si ocurren durante el TB.

---

## 12.2 NO incluir Tie break en:

### Games de saque ganados

**NO INCLUIR.**

El TB no es un game de saque completo de una pareja/jugador.

El servicio se alterna dentro del desempate.

### Break Points / breaks

**NO INCLUIR.**

Los mini-breaks de TB no son Break Points normales.

Mantenerlos separados internamente.

---

## 12.3 Consistencia esperada

Después del cambio:

para cada pareja:

`puntos ganados al saque + puntos ganados al resto = puntos totales ganados`

Esto debe ser verificable en tests.

---

# 13. EVOLUCIÓN DEL PARTIDO

## 13.1 Vista PARTIDO — APROBADA

No rediseñar.

La V10 quedó bien.

Mantener:

- dos curvas;
- separadores de sets;
- scores;
- Match Points mediante línea vertical fina;
- `MP`, `2 MP`, `3 MP`, etc.;
- lectura limpia.

No reintroducir:

- mini-break labels;
- círculos de break;
- ruido visual;
- símbolos innecesarios.

La marca `N MP` queda aprobada por ahora.

---

## 13.2 Vista SET — CORREGIR

En V10 sigue mostrando demasiados elementos durante TB.

### ELIMINAR visualmente

- labels repetidos de `mini-break`;
- acumulación de textos;
- símbolos que se pisan.

Los mini-breaks pueden seguir existiendo internamente para cálculo.

---

## 13.3 Lectura por games en vista SET

AGREGAR / MEJORAR discretamente la lectura temporal de los games.

Objetivo:

que mirando Set 2 se pueda localizar aproximadamente:

`1–0 / 2–0 / 3–1 / 4–1 / 5–1 / ...`

No hace falta escribir todos los scores grandes.

Opciones válidas:

- pequeños ticks;
- nodos neutros;
- marcas discretas;
- líneas mínimas.

Prioridad:

**legibilidad > cantidad de información.**

No ensuciar el gráfico.

---

# 14. HIGHLIGHT RÁPIDO

La función general V10 queda aprobada.

Mantener:

- registro inmediato;
- popup 2×2;
- Smash / X3;
- Dejada;
- Recuperación;
- Puntazo;
- cierre automático ~3.5 s;
- aro de tiempo;
- tocar afuera cierra sin borrar el Highlight.

---

## 14.1 CORREGIR posición del popup

En V10 aparece demasiado abajo.

### CAMBIAR

Ubicar el cuadro aproximadamente en el centro visual de la pantalla.

No bloquear más de lo necesario.

Mantener buena lectura del marcador.

---

## 14.2 BUG — Highlight genérico en lista de Highlights

Si el usuario no selecciona categoría:

en la sección `HIGHLIGHTS` V10 puede mostrar un valor incorrecto como `Z1`.

### CORREGIR

Debe mostrar:

`Highlight`

En Momentos Clave ya se muestra correctamente.

Mantener ese comportamiento.

---

## 14.3 UX del toque exterior

Revisar manualmente:

- Highlight;
- aparece popup;
- usuario intenta tocar inmediatamente una zona de puntuación.

El primer toque exterior hoy puede cerrar el popup pero no registrar el punto.

No modificar automáticamente sin test.

Evaluar si se siente molesto en uso real.

Si no molesta, mantener.

Si se confirma que “come” un punto/gesto natural, resolver en V11 sin comprometer seguridad del marcador.

---

# 15. CONFIGURACIÓN DEL PARTIDO

## 15.1 Orden

### REORDENAR

Primero:

**FORMATO DE PARTIDO**

Después:

**SISTEMA DE PUNTUACIÓN**

La lectura natural buscada es:

> “Clásico con Punto de Oro.”

o:

> “Americano con Star Point.”

---

## 15.2 Terminología

### REEMPLAZAR

`Método de puntuación`

por:

`Sistema de puntuación`

Mantener:

`Formato de partido`

No eliminar ese título.

---

# 16. NAVEGACIÓN POST PARTIDO

## 16.1 Resumen

El botón amarillo actual:

`NUEVO PARTIDO`

si en realidad vuelve al home, resulta ambiguo.

### REEMPLAZAR POR

`VOLVER AL INICIO`

No usar:

`FINALIZAR PARTIDO`

porque el partido ya terminó.

---

## 16.2 Análisis

Debajo de:

`COMPARTIR`

### AGREGAR

`VOLVER AL INICIO`

Objetivo:

cerrar el recorrido sin obligar al usuario a volver con la flecha.

---

# 17. MOMENTOS CLAVE

La V10 queda aprobada en esta sección.

No rediseñar.

Mantener:

- timestamps;
- breaks;
- contra-breaks;
- Oro/Star decisivos;
- TB;
- MP salvados;
- cierres;
- Highlights;
- eventos compuestos.

Partidos sin acontecimientos especiales pueden tener Momentos Clave breves.

No rellenar artificialmente.

---

# 18. COMPARTIR

La función volvió a funcionar online y queda aprobada para V11.

No rehacerla.

La imagen larga actual puede mantenerse.

---

## FUTURO, NO IMPLEMENTAR EN V11

Posible separación:

- `Compartir resumen` → pieza corta;
- `Exportar análisis completo` → pieza larga actual.

No implementar ahora.

---

# 19. FOOTER / AUTORÍA

Texto correcto definitivo:

`BRAMU Lab · Concepto y diseño por Sebastián Vila · v11`

No usar:

`Julián Sebastián`.

Mantener la versión centralizada en un único lugar.

Actualizar:

- footer;
- constante;
- cache PWA;

según arquitectura actual.

---

# 20. TESTS AUTOMÁTICOS OBLIGATORIOS V11

Ampliar `tests.html` o el harness que corresponda.

Cada bug nuevo debe convertirse en regresión.

---

## 20.1 Break Points 0 vs 0

`0/5 vs 0/3`

Esperado:

- nadie quebró;
- no comparar eficiencia;
- no “más contundente”.

Prohibido:

> “consiguió 0 quiebres.”

---

## 20.2 Eficiencia igual

`3/9 vs 2/6`

Esperado:

- 3 vs 2 breaks si corresponde;
- misma eficiencia.

Prohibido:

> “aprovechó mejor”.

---

## 20.3 Presión sin conversión

`0/15 vs 1/1`

Esperado:

- A generó enorme presión;
- A no convirtió;
- B consiguió el único break con su oportunidad.

No confundir presión con dominio global.

---

## 20.4 6–3 estructuralmente parejo pero con diferencia de puntos

Construir caso:

- holds hasta tramo tardío;
- un solo break;
- resultado 6–3;
- ganador obtiene >62% de puntos por holds muy cómodos;
- rival gana sus holds ajustados.

Esperado:

- NO “dominó de principio a fin”;
- reconocer estructura pareja hasta break tardío.

Este test debe impedir que porcentaje de puntos + margen final anulen la cronología.

---

## 20.5 6–3 con dominio real

Secuencia:

`5–0 → 5–3 → 6–3`

Puede hablar de dominio inicial + reacción tardía.

Diferenciar del test anterior.

---

## 20.6 6–0 / 6–1

Esperado:

- dominio claro si la secuencia lo respalda;
- no falso momento decisivo tardío;
- 0/0 tratado correctamente.

---

## 20.7 Tres sets + MP salvados + cambio de dominio

Caso patrón:

`6–3 · 6–7 · 2–6`

Esperado:

- mencionar primer set;
- narrar recuperación segundo;
- narrar MP;
- narrar TB;
- narrar tercero;
- 3 párrafos aprox. si la historia lo amerita.

Prohibido:

> “Empezaron perdiendo y se repusieron para ganar.”

como resumen casi completo.

---

## 20.8 Partido que se escapa

- A gana primero;
- A tiene MP segundo;
- B salva;
- B gana segundo y tercero.

Esperado:

- A estuvo a un punto de ganar;
- B salva y cambia el partido;
- desenlace posterior.

---

## 20.9 Match Point salvado pero derrota

B salva MP.

Después B pierde.

Prohibido usar:

> “se agarraron al partido”

con sentido de remontada victoriosa.

---

## 20.10 Remontada completa

`1–4 → 4–4 → victoria`

---

## 20.11 Remontada incompleta

`1–4 → 4–4 → derrota`

---

## 20.12 Hold 40–0 vs hold salvando 0–40

Mismo resultado estructural:

hold.

Diferente presión.

Esperado:

el segundo puede generar evidencia narrativa de servicio defendido.

No psicología.

---

## 20.13 Oro temprano vs Oro tardío

Comparar:

- Oro en 0–0 primer set;
- Oro en 4–4 del set decisivo.

El segundo debe tener mayor leverage narrativo.

---

## 20.14 Tie break sin breaks

Americano:

`5–5 → TB 7–3`

Esperado:

- partido estructuralmente parejo;
- nadie quebró;
- diferencia aparece en TB.

No repetir dos veces el score del TB.

---

## 20.15 Ganador con menos puntos

Solo mencionar si la diferencia es significativa.

---

## 20.16 Puntos de Tie break en saque/resto

Test con TB conocido.

Verificar:

`saque + resto = total de puntos ganados`

para cada pareja.

---

## 20.17 Saque individual con TB

Verificar que los puntos sacados por cada jugador durante el TB se incorporan a:

`puntos ganados / puntos sacados`.

---

## 20.18 Games de saque y TB

Verificar que un TB NO incrementa:

`games de saque ganados`.

---

## 20.19 Set Point / Match Point en TB

Verificar que sí se contabilizan correctamente.

---

## 20.20 Score orientation

Equipo B gana set:

score interno A–B `6–7`.

Texto desde B:

`ganaron 7–6`.

Nunca:

`ganaron 6–7`.

---

## 20.21 Highlight genérico

Registrar Highlight.

No elegir categoría.

Esperado:

- Highlights: `Highlight`;
- Momentos Clave: `Highlight`.

Nunca:

`Z1` u otro identificador interno.

---

# 21. PRUEBAS MANUALES MÍNIMAS

Después de tests automáticos:

### 1. Partido parejo + break tardío

Validar Intelligence.

### 2. 6–0 / 6–1

Validar dominio.

### 3. Tres sets + MP salvados

Validar profundidad del Narrative Planner.

### 4. Americano sin breaks + TB

Validar presión sin conversión y TB.

### 5. Highlight rápido

Validar popup centrado, categorías y genérico.

### 6. Tie break

Validar estadísticas de saque/resto.

### 7. Vista Set

Validar eliminación de mini-break labels y lectura por games.

### 8. Navegación post partido

Validar `VOLVER AL INICIO`.

---

# 22. CRITERIO DE CALIDAD DE BRAMU INTELLIGENCE

Antes de dar V11 por terminada, responder:

### Pregunta 1

> ¿Una persona que vio el partido reconoce la película que acaba de ver?

### Pregunta 2

> ¿El texto cuenta el principio, la bisagra y el desenlace cuando esos tres actos existen?

### Pregunta 3

> ¿Hay alguna frase estadísticamente cierta pero narrativamente irrelevante que distrae?

### Pregunta 4

> ¿Hay alguna frase que destruya credibilidad por contradicción lógica?

Ejemplos inaceptables:

- “fueron más contundentes y consiguieron 0 quiebres”;
- “ganaron 6–7” hablando del ganador;
- “dominaron de principio a fin” en un partido parejo hasta 4–3;
- “muchas más oportunidades” en 7 vs 6.

### Pregunta 5

> ¿El análisis tiene suficiente profundidad para justificar que el usuario registró el partido completo?

Esto es un criterio central de producto.

---

# 23. QUÉ NO TOCAR

Salvo regresión detectada:

- motor de score;
- reglas de Punto de Oro;
- Star Point;
- Con Ventaja;
- Clásico;
- Americano;
- Tie break modes;
- rotación de saque;
- Quick Correction;
- edición de TB;
- partidos parciales;
- historial;
- persistencia/localStorage;
- PWA/offline;
- Momentos Clave;
- Evolución vista Partido;
- Share actual.

No convertir V11 en una refactorización general.

Refactorizar únicamente donde sea necesario para implementar el Narrative Planner y evitar lógica duplicada.

---

# 24. FUERA DE SCOPE / FUTURO

NO implementar en V11:

- IA externa / APIs pagas;
- perfiles completos;
- ranking;
- monetización;
- cuentas;
- nube;
- backend;
- video;
- edición automática de clips;
- estadísticas técnicas individuales no registradas;
- Contribution Score copiado de terceros;
- fórmula propietaria de Padel Intelligence;
- “Compartir resumen” corto separado del export completo;
- análisis psicológico.

---

# 25. PRINCIPIO FINAL DE V11

V11 no debe intentar “sonar inteligente”.

Debe **entender mejor el partido**.

La información necesaria ya existe en gran parte dentro del registro punto a punto.

El salto debe venir de:

- contexto;
- incidencia;
- relación entre acontecimientos;
- cronología;
- selección;
- supresión;
- profundidad narrativa.

La meta es que el usuario termine un partido y piense:

> “Quiero ver qué dijo BRAMU de lo que acaba de pasar.”

Y al leerlo:

> “Sí. Este fue mi partido.”

---

# 26. ENTREGA ESPERADA DE CLAUDE CODE

Al terminar:

1. implementar todos los puntos confirmados de este archivo;
2. indicar archivos modificados;
3. resumir cambios;
4. informar tests automáticos ejecutados y resultado;
5. informar pruebas manuales realizadas;
6. indicar cualquier punto no implementado exactamente y por qué;
7. no ocultar limitaciones;
8. no declarar completada V11 solo por ausencia de errores de sintaxis;
9. actualizar versión/cache a V11;
10. dejar el proyecto listo para testeo en la URL pública.

Versión objetivo:

**BRAMU Lab v11**

Footer:

**BRAMU Lab · Concepto y diseño por Sebastián Vila · v11**
