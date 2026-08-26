\# BRAMU LAB — CONSOLIDADO V10  
\#\# BRAMU Intelligence \+ Evolución \+ Highlights rápidos

Este documento define el alcance completo de \*\*BRAMU Lab V10\*\*.

La base de trabajo es la \*\*V9.2 actualmente validada\*\*.

V10 no busca rehacer la aplicación ni incorporar funciones grandes ajenas al producto actual. El objetivo principal es llevar \*\*BRAMU Intelligence\*\* a un nivel mucho más alto de interpretación del partido, aprovechando correctamente toda la información que ya registra BRAMU.

La prioridad absoluta de esta versión es:

\> Transformar los datos registrados durante el partido en una lectura posterior que realmente cuente la historia del encuentro.

El usuario tiene que terminar un partido y sentir curiosidad por leer qué interpretó BRAMU.

No queremos un resumen estadístico.

Queremos una crónica objetiva, contextual y deportiva.

\---

\# 1\. PRINCIPIO GENERAL DE V10

No modificar áreas que ya funcionan correctamente sin una razón concreta.

Preservar todo el comportamiento validado de V9.2:

\- creación de partidos;  
\- equipos y jugadores;  
\- marcador;  
\- Punto de Oro;  
\- Star Point;  
\- Con Ventaja;  
\- formato Clásico;  
\- formato Americano;  
\- Tie breaks;  
\- alternancia de saque;  
\- edición/corrección;  
\- Quick Correction;  
\- edición de Tie break;  
\- Highlights actuales;  
\- finalización manual/automática;  
\- partidos parciales;  
\- historial;  
\- estadísticas;  
\- timeline;  
\- Momentos Clave;  
\- persistencia local;  
\- compatibilidad con partidos anteriores;  
\- PWA;  
\- cualquier comportamiento no mencionado expresamente para modificar en este documento.

No convertir V10 en una refactorización general del proyecto salvo que exista una instrucción técnica separada surgida del proceso de optimización.

La especificación funcional de este documento debe mantenerse aunque cambie la organización técnica de los archivos.

\---

\# 2\. OBJETIVO PRINCIPAL: BRAMU INTELLIGENCE

\#\# Qué debe ser

BRAMU Intelligence debe comportarse como:

\> Un tercer observador que vio todo el partido y, cuando termina, puede explicar qué pasó, cómo cambió el encuentro y qué terminó definiéndolo.

La sensación buscada al leerlo es:

\> “Sí. Fue exactamente así el partido.”

No:

\> “Me está leyendo las estadísticas.”

La información debe ser objetiva y estar respaldada por acciones realmente registradas.

No inventar explicaciones psicológicas, tácticas o técnicas que BRAMU no pueda medir.

\---

\# 3\. NUEVA ARQUITECTURA CONCEPTUAL DE INTELLIGENCE

La lógica de generación debe evolucionar hacia:

\*\*DATOS → HECHOS → RELACIONES → CONTEXTO → CLASIFICACIÓN → STORY RANKING → EVIDENCIAS → SUPRESIÓN → PLAN NARRATIVO → TEXTO\*\*

Evitar la lógica simplificada:

\*\*dato interesante → frase\*\*

La construcción recomendada es:

\#\#\# 3.1 MATCH FACTS

Extraer hechos objetivos sin interpretación.

Ejemplos:

\- resultado;  
\- secuencia de games;  
\- puntos;  
\- servicio;  
\- holds;  
\- breaks;  
\- contra-breaks;  
\- Break Points;  
\- Set Points;  
\- Match Points;  
\- Punto de Oro;  
\- Star Point;  
\- Deuce/Ventaja;  
\- Tie breaks;  
\- mini-breaks;  
\- rachas;  
\- duración;  
\- puntos totales;  
\- cobertura parcial;  
\- momento cronológico de cada acontecimiento.

\#\#\# 3.2 MATCH RELATIONS

Relacionar acontecimientos.

Ejemplos:

\- break → hold;  
\- break → contra-break;  
\- déficit → recuperación;  
\- ventaja → pérdida de ventaja;  
\- Match Point → salvado → victoria;  
\- Match Point → salvado → derrota;  
\- break tardío → cierre;  
\- remontada → igualdad;  
\- igualdad → nueva ventaja;  
\- Tie break → cambio de control.

\#\#\# 3.3 MATCH CLASSIFICATION

Detectar diferentes historias candidatas del partido.

Un mismo partido puede tener varias clasificaciones simultáneas.

Ejemplo interno:

\`REMONTADA\`  
\`MATCH\_POINT\_SAVED\`  
\`TIE\_BREAK\_DECISIVO\`  
\`DOMINIO\_TERCER\_SET\`

No son etiquetas visibles para el usuario.

Sirven para entender el partido.

\#\#\# 3.4 STORY RANKING

Elegir cuál es la historia principal y cuáles son elementos secundarios.

No intentar contar todo con la misma importancia.

\#\#\# 3.5 EVIDENCE SELECTION

Seleccionar únicamente estadísticas que ayuden a:

\- explicar;  
\- reforzar;  
\- contextualizar;  
\- revelar una contradicción interesante.

\#\#\# 3.6 SUPPRESSION

Eliminar estadísticas correctas pero irrelevantes.

Callarse información también es una decisión de Intelligence.

\#\#\# 3.7 NARRATIVE PLAN

Determinar:

\- cuántos párrafos necesita el partido;  
\- qué función cumple cada uno;  
\- qué secuencias deben narrarse;  
\- qué hechos deben omitirse.

\#\#\# 3.8 LANGUAGE REALIZATION

Convertir el plan narrativo en lenguaje natural, evitando frases repetitivas o excesivamente mecánicas.

\---

\# 4\. REGLA CENTRAL: EL RESULTADO NO DEFINE LA HISTORIA

Dos partidos con idéntico resultado pueden haber sido completamente diferentes.

Ejemplo:

\#\# Caso A

\`5–0 → 5–3 → 6–3\`

Puede existir dominio claro durante gran parte del set y una reacción tardía.

\#\# Caso B

\`1–1 → 2–2 → 3–3 → 4–3 → break → 6–3\`

Fue un partido parejo que se rompió al final.

Por lo tanto:

\> Nunca clasificar “dominio”, “paridad” o “remontada” mirando únicamente el resultado final.

La secuencia mediante la cual se construyó el resultado es fundamental.

Regla adicional:

\> Nunca haber estado por debajo no equivale a haber dominado de principio a fin.

\---

\# 5\. LOS GANADORES Y LA HISTORIA

Mantener este principio:

\> El resultado final cambia el significado de algunos acontecimientos, pero no puede reescribir lo que realmente ocurrió.

Ejemplo:

Una pareja salva dos Match Points.

Si después gana:

puede formar parte central de una remontada.

Si después pierde:

sigue siendo un acontecimiento importante, pero la historia es diferente.

El desenlace modifica la interpretación.

No borra la cronología.

\---

\# 6\. TAXONOMÍA DE HISTORIAS

Las categorías pueden coexistir.

Debe existir una historia principal y diferentes capas secundarias.

\---

\#\# 6.1 DOMINIO CLARO

Una pareja controla prácticamente todo el encuentro.

Indicadores posibles combinados:

\- ventaja amplia construida temprano;  
\- ventaja mantenida;  
\- varios breaks;  
\- pocos games cedidos;  
\- rival con pocas oportunidades reales;  
\- servicio sólido;  
\- diferencia significativa de puntos;  
\- ausencia de recuperación estructural del rival.

Ejemplo prototipo:

\`6–0 · 6–1\`

Frases posibles:

\- “dominaron el partido de principio a fin”;  
\- “marcaron diferencias desde el comienzo”;  
\- “tomaron rápidamente el control”;  
\- “no permitieron que el rival volviera a meterse en el partido”.

No detectar dominio simplemente porque un set terminó 6–3.

\---

\#\# 6.2 PARTIDO PAREJO

Gran parte del encuentro transcurre sin ventajas estructurales claras.

Ejemplos:

\- sucesión prolongada de holds;  
\- diferencia máxima pequeña;  
\- breaks recuperados;  
\- sets que permanecen abiertos hasta fases tardías;  
\- Tie break sin dominio previo.

La paridad debe surgir de la estructura global.

Nunca inferirla de una estadística secundaria aislada.

Ejemplo incorrecto:

Partido 6–0 / 6–1 pero Punto de Oro 2–1.

No decir:

\> “El partido estuvo muy parejo.”

\---

\#\# 6.3 PARTIDO DEFINIDO POR UN DETALLE

La estructura permanece pareja y un acontecimiento tardío termina inclinando el encuentro.

Ejemplo:

todos sostienen servicio hasta 4–3 / 4–4 / 5–4 y aparece el único break.

Narrativa posible:

\> “El partido se mantuvo parejo durante gran parte del encuentro y se rompió recién…”

Un break en Punto de Oro puede ser el momento principal si realmente modifica una situación hasta entonces equilibrada.

\---

\#\# 6.4 REMONTADA COMPLETA

Una pareja queda en una desventaja significativa, recupera el terreno perdido y finalmente gana.

Puede ocurrir:

\- dentro de un set;  
\- dentro de un Tie break;  
\- a nivel global del partido.

Ejemplo:

\`1–4 → 4–4 → victoria\`

No llamar “remontada” automáticamente a cualquier partido en el que el ganador perdió el primer set.

Analizar si existió además una recuperación significativa dentro de la evolución competitiva.

\---

\#\# 6.5 REMONTADA INCOMPLETA

Una pareja recupera una desventaja importante pero finalmente pierde.

Ejemplo:

\`1–5 → 5–5 → 5–7\`

La recuperación merece reconocimiento.

No presentar como remontada exitosa.

\---

\#\# 6.6 PARTIDO QUE SE ESCAPA

Una pareja llega realmente cerca de ganar y termina perdiendo esa posición.

Ejemplos:

\- gana primer set;  
\- tiene Match Point en el segundo;  
\- no convierte;  
\- pierde segundo y tercer set.

La oportunidad de cierre debe formar parte importante de la historia.

No reducir el relato a:

\> “B remontó.”

También ocurrió:

\> “A estuvo a un punto de ganar el partido.”

\---

\#\# 6.7 “SE AGARRARON AL PARTIDO”

Uso reservado.

Solo utilizar cuando una pareja:

1\. enfrenta uno o más Match Points;  
2\. los salva;  
3\. termina ganando el partido.

Ejemplo válido:

\> “se agarraron al partido, salvaron el Match Point y terminaron dándolo vuelta.”

Si salvan MP pero después pierden:

usar:

\- “se mantuvieron con vida”;  
\- “consiguieron prolongar el encuentro”;  
\- “salvaron el Match Point”;  
\- “lograron estirar el partido”.

No usar “se agarraron al partido” con sentido victorioso.

\---

\#\# 6.8 CAMBIO DE DOMINIO

El control del encuentro cambia claramente entre diferentes tramos.

Ejemplo:

\`6–1 · 1–6 · tercer set abierto\`

Narrar:

1\. quién arrancó mejor;  
2\. cómo respondió el rival;  
3\. cómo se resolvió finalmente.

Las estadísticas complementan.

No reemplazan la historia.

\---

\#\# 6.9 PRESIÓN SIN CONVERSIÓN

Una pareja genera oportunidades reiteradamente pero no consigue modificar suficientemente el marcador.

Ejemplo:

A: \`0/15 BP\`

B: \`1/1 BP\`

Narrativa:

\> A generó mucha presión desde la devolución pero no pudo aprovechar ninguna de sus oportunidades. B tuvo una sola oportunidad y la convirtió.

No interpretar muchos Break Points como dominio automático.

\---

\#\# 6.10 VICTORIA POR EFECTIVIDAD

Una pareja genera menos oportunidades pero aprovecha mucho mejor las que obtiene.

Ejemplo:

A \`2/14\`

B \`2/3\`

Mismos breaks.

B fue mucho más eficiente.

Puede ser una evidencia central si esa eficiencia explica realmente el resultado.

\---

\#\# 6.11 GANADOR CON MENOS PUNTOS

Si el ganador finaliza con menos puntos totales que el rival, puede existir una contradicción narrativamente interesante.

No mencionarlo siempre.

Evaluar magnitud.

Una diferencia 88–86 probablemente sea irrelevante.

Una diferencia significativamente mayor puede ayudar a explicar que una pareja fue más efectiva en momentos estructuralmente importantes.

Nunca traducir automáticamente eso a:

\- fortaleza mental;  
\- carácter;  
\- nervios;  
\- mejor actitud.

\---

\#\# 6.12 TIE BREAK DECISIVO

Cuando el desempate concentra una parte importante de la resolución.

Analizar:

\- ventaja alcanzada;  
\- mini-breaks;  
\- recuperación;  
\- Set Points;  
\- Match Points;  
\- cambio de control;  
\- resultado.

Los mini-breaks pueden utilizarse internamente para interpretar.

No es necesario narrarlos todos.

\---

\#\# 6.13 SETS RADICALMENTE DIFERENTES

Ejemplo:

\`6–1 · 1–6\`

Esto debe reconocerse como una transformación clara del partido.

No limitarse a enumerar los resultados.

\---

\#\# 6.14 FINAL COMPLETAMENTE ABIERTO

Partidos donde la diferencia real aparece muy tarde.

Especialmente útiles para:

\- break tardío;  
\- Tie break;  
\- Punto de Oro;  
\- Star Point;  
\- Match Point.

\---

\# 7\. VARIAS HISTORIAS, UNA HISTORIA PRINCIPAL

Un partido puede activar simultáneamente:

\- remontada;  
\- Match Point salvado;  
\- Tie break decisivo;  
\- dominio posterior.

Ejemplo:

\`6–3 · 6–7 (6–8) · 2–6\`

Historia global:

\*\*remontada / cambio de partido\*\*

Momento bisagra:

\*\*Match Point salvado \+ Tie break\*\*

Desenlace:

\*\*dominio del ganador en el tercer set\*\*

BRAMU Intelligence debe poder contar las tres capas.

No elegir arbitrariamente una y eliminar las demás.

\---

\# 8\. DOMINANCIA E IMPORTANCIA SON DIFERENTES

Cada acontecimiento tiene al menos dos dimensiones.

\#\# DOMINANCIA

Qué tan contundentemente se ganó un game, tramo o secuencia.

Ejemplo:

break en 0–40.

Puede ser un game de enorme superioridad.

\#\# IMPORTANCIA / LEVERAGE

Cuánto cambia ese acontecimiento la situación competitiva.

Ejemplo:

Punto de Oro en 4–4 del tercer set que produce break.

Puede ser mucho más importante que un break aplastante ocurrido en 0–0.

Regla:

\> Un acontecimiento puede ser muy dominante y poco decisivo, o muy ajustado y extremadamente importante.

\---

\# 9\. CONTEXTO DEL MARCADOR

El mismo acontecimiento cambia de significado según el momento.

Break en:

\`0–0 → 1–0\`

es importante.

Break en:

\`4–4 → 5–4\`

tiene leverage mucho mayor.

Break en:

\`5–5 → 6–5\`

puede dejar a una pareja sirviendo para partido.

Lo mismo sucede con los holds.

Hold rutinario en 1–1:

normalmente no merece narrativa.

Hold después de break en 5–4:

puede cerrar un set.

Hold salvando múltiples BP:

puede formar parte de una secuencia de presión relevante.

\---

\# 10\. PRESSURE STATES

BRAMU debe utilizar internamente estados de presión aunque todavía no exista BP/SP/MP.

Ejemplos al saque:

\- 0–30;  
\- 15–30;  
\- 30–30;  
\- 0–40;  
\- 15–40;  
\- 30–40;  
\- Deuce;  
\- Ventaja rival.

No narrar automáticamente cada situación.

Sirven para detectar tendencias.

Ejemplo:

Una pareja cae repetidamente 0–30 al saque pero logra sostener todos sus games.

Puede respaldar:

\> “tuvo que defender su servicio en varias oportunidades.”

Un único 0–30 aislado no merece una frase.

\---

\# 11\. RELACIONES ENTRE EVENTOS

BRAMU debe interpretar secuencias, no eventos individuales.

\#\# BREAK → HOLD

Puede significar consolidación.

\#\# BREAK → CONTRA-BREAK

La ventaja desaparece rápidamente.

No describir el primer break como un cambio consolidado de partido.

\#\# 1–4 → 4–4

Recuperación completa de una desventaja estructural.

\#\# 5–3 \+ MATCH POINT PERDIDO → 5–4

La pareja todavía conserva una posición muy favorable.

No producir una caída exagerada inmediata en Evolución.

\#\# 5–3 → 5–5

La ventaja estructural desaparece.

\#\# 5–5 → 5–6

Puede existir cambio real de control.

\#\# BREAK TARDÍO → HOLD FINAL

Puede ser una secuencia decisiva.

\---

\# 12\. MATCH POINT, SET POINT Y PUNTOS DECISIVOS

El nombre reglamentario del punto no determina automáticamente su importancia narrativa.

Contexto manda.

Ejemplo:

\`6–0 · 5–0 · 40–0\`

El Match Point es simplemente el cierre de un partido completamente dominado.

No presentarlo como:

\> “el momento que cambió el encuentro.”

En cambio:

Tie break 6–5 después de un partido cerrado:

Match Point puede ser uno de los acontecimientos centrales.

\---

\# 13\. PUNTO DE ORO Y STAR POINT

No narrar automáticamente estadísticas agregadas.

Ejemplo:

\`1/2 vs 1/2\`

normalmente irrelevante.

Ejemplo:

\`2/3 vs 1/3\`

tampoco significa automáticamente paridad.

Narrar Oro/Star cuando:

1\. el punto produjo una modificación estructural importante;  
2\. existe una tendencia extraordinaria.

Ejemplo:

\`4–4 → Punto de Oro → break\`

puede ser central.

Ejemplo extraordinario:

A gana \`5/5 Oro\`.

B gana \`0/5\`.

Puede formar parte importante de la explicación del partido.

No convertir un Oro tardío en “momento decisivo” si una pareja ya dominaba claramente el encuentro.

\---

\# 14\. BREAK POINTS — REGLA DEFINITIVA

Jerarquía narrativa:

\*\*BREAKS CONSEGUIDOS \> EFICIENCIA \> OPORTUNIDADES GENERADAS\*\*

Ejemplo:

A \`2/8\`

B \`1/4\`

A consiguió más breaks.

Ambos tienen 25% de conversión.

Puede decir:

\> “A consiguió dos quiebres contra uno y además generó más oportunidades.”

No decir:

\> “A fue más eficiente.”

Ejemplo:

A \`3/9\`

B \`2/3\`

A consiguió más breaks.

B fue mucho más eficiente.

Ambas cosas pueden coexistir.

\---

\# 15\. 0/0

Regla absoluta.

\`0/0\` significa:

\*\*no existieron oportunidades.\*\*

No significa:

\- mala eficiencia;  
\- menor efectividad;  
\- fracaso de conversión.

Nunca decir:

\> “convirtieron 0 de 0.”

\> “fueron menos efectivos con 0/0.”

Puede decirse cuando aporta:

\> “No llegaron a disponer de una oportunidad de quiebre.”

Ejemplo dominante:

Una pareja gana 6–0 / 6–1 y el rival termina 0/0 BP.

Puede reforzar el dominio.

En otros partidos puede omitirse.

\---

\# 16\. MAGNITUD DE LAS DIFERENCIAS

Eliminar comparaciones binarias del tipo:

\`A \> B \= muchas más\`.

Crear gradaciones.

Ejemplo conceptual:

\`7 vs 6\`

→ cifras prácticamente similares / apenas una más.

\`9 vs 6\`

→ más oportunidades.

\`9 vs 3\`

→ claramente más oportunidades.

\`16 vs 2\`

→ muchas más oportunidades.

\`16 vs 0\`

→ diferencia enorme de presión generada.

Aplicar esta lógica a:

\- Break Points;  
\- puntos totales;  
\- games;  
\- breaks;  
\- conversión;  
\- rachas;  
\- otros conteos comparables.

Los umbrales exactos pueden calibrarse con tests.

No usar adjetivos exagerados ante diferencias mínimas.

\---

\# 17\. ESTADÍSTICAS COMO EVIDENCIA, NO COMO OBLIGACIÓN

Una estadística entra al texto únicamente cuando:

\- explica;  
\- refuerza;  
\- contextualiza;  
\- revela una contradicción interesante.

Ejemplo:

En un partido:

\`6–3 · 6–7 · 2–6\`

con:

\- break;  
\- contra-break;  
\- Tie break;  
\- Match Point salvado;  
\- dominio en tercero;

una comparación como:

\`3/5 BP vs 2/3\`

puede ser completamente innecesaria.

La secuencia cronológica ya cuenta mejor el encuentro.

\---

\# 18\. REGLA DE SUPRESIÓN

BRAMU Intelligence debe tener permiso explícito para \*\*no mencionar estadísticas disponibles\*\*.

No existe obligación de comentar:

\- Break Points;  
\- Punto de Oro;  
\- Star Point;  
\- rachas;  
\- puntos totales;  
\- saque;  
\- set más parejo;  
\- duración;  
\- diferencia máxima;

si no aportan a la historia principal.

Una buena crónica puede utilizar cero estadísticas agregadas.

\---

\# 19\. PROFUNDIDAD ADAPTABLE

La longitud del análisis depende de la riqueza narrativa.

No fijar una longitud artificial.

\#\# PARTIDO SIMPLE

Ejemplo:

\`6–0 · 6–1\`

Puede resolverse muy bien en uno o dos párrafos.

\#\# PARTIDO PAREJO CON MOMENTO CLAVE

Habitualmente dos párrafos.

\#\# PARTIDO RICO

Tres párrafos son completamente válidos.

Ejemplo:

\- tres sets;  
\- break/contra-break;  
\- Tie break;  
\- Match Point salvado;  
\- cambio de dominio;  
\- tercer set diferente.

Debe existir suficiente espacio para contar la película.

Regla:

\> La longitud sigue a la historia, no a la cantidad de estadísticas disponibles.

\---

\# 20\. NARRATIVE PLANNER

No aplicar rígidamente siempre la misma estructura.

Pero como modelo general:

\#\# PÁRRAFO 1 — PELÍCULA GENERAL

Quién comenzó mejor.

Cómo se desarrollaron los primeros tramos.

Cómo se estructuró el partido.

\#\# PÁRRAFO 2 — BISAGRA

Momento o secuencia que realmente cambia el encuentro.

Ejemplos:

\- remontada;  
\- break decisivo;  
\- Tie break;  
\- Match Point salvado;  
\- contra-break;  
\- igualdad recuperada.

\#\# PÁRRAFO 3 — DESENLACE

Cómo se consolidó el resultado.

Agregar estadísticas únicamente si realmente explican o refuerzan lo anterior.

\---

\# 21\. EJEMPLO DE CALIDAD OBJETIVO

Partido:

\`Agustín/Jona 6–3 · 6–7 · 2–6 Edu/Gusti\`

Segundo set:

\- break y contra-break;  
\- Tie break;  
\- Edu/Gusti llegan 5–2;  
\- Agustín/Jona meten tres puntos consecutivos;  
\- Agustín/Jona tienen Match Point 6–5;  
\- Edu/Gusti salvan;  
\- Edu/Gusti ganan TB 8–6.

Tercer set:

Edu/Gusti dominan 6–2.

Calidad objetivo aproximada:

\> \*\*Agustín y Jona arrancaron mejor y se llevaron el primer set 6–3. El segundo fue mucho más cerrado: hubo un quiebre por lado y ninguna pareja consiguió despegarse, por lo que todo terminó definiéndose en el Tie break.\*\*  
\>  
\> \*\*Ahí Edu y Gusti llegaron a ponerse 5–2, pero Agustín y Jona reaccionaron con tres puntos consecutivos y tuvieron Match Point con 6–5. Edu y Gusti se agarraron al partido, salvaron esa oportunidad y terminaron quedándose con el desempate 8–6.\*\*  
\>  
\> \*\*Después del empate en sets, el tercer parcial tuvo otro desarrollo. Edu y Gusti consiguieron dos quiebres, tomaron una ventaja amplia y terminaron cerrando 6–2. Agustín y Jona alcanzaron a salvar un Match Point antes del final, pero no pudieron volver a meterse en el set.\*\*

No copiar literalmente siempre este texto.

Representa el estándar narrativo deseado.

\---

\# 22\. EJEMPLO: PARTIDO PAREJO QUE SE ROMPE TARDE

Secuencia aproximada:

\- todos sostienen servicio;  
\- llegan 4–3;  
\- aparece el único break;  
\- break en Punto de Oro;  
\- ganador sostiene y cierra 6–3.

No decir:

\> “dominaron de principio a fin.”

Lectura esperada:

\> El partido se mantuvo parejo durante gran parte del encuentro. Ninguna pareja consiguió romper el servicio rival hasta el tramo final, cuando el Punto de Oro produjo el único quiebre del partido. Después sostuvieron el saque para cerrar.

Si además nunca perdieron servicio:

puede agregarse:

\> “No cedieron su servicio en todo el encuentro.”

\---

\# 23\. EJEMPLO: DOMINIO 6–0 / 6–1

Lectura esperada:

\> dominaron de principio a fin.

Puede reforzarse con:

\- varios breaks;  
\- ausencia de breaks sufridos;  
\- alto porcentaje de games de saque ganados;  
\- clara diferencia de puntos.

No narrar como acontecimiento decisivo un Punto de Oro ocurrido en 4–1 del segundo set si el partido ya estaba ampliamente controlado.

Evitar frases como:

\> “apenas cedieron un game”

si puede confundirse con “cedieron el servicio”.

Preferir:

\> “solo perdieron un game en el segundo set.”

Y, si corresponde:

\> “No cedieron su servicio en todo el partido.”

\---

\# 24\. VOCABULARIO PERMITIDO

BRAMU puede utilizar cuando los datos lo justifican:

\- arrancaron mejor;  
\- comenzaron mejor;  
\- tomaron la iniciativa;  
\- tomaron ventaja;  
\- marcaron diferencias;  
\- sostuvieron el servicio;  
\- no cedieron el servicio;  
\- quebraron;  
\- consiguieron el quiebre;  
\- recuperaron el break;  
\- contraquebraron;  
\- consolidaron la ventaja;  
\- reaccionaron;  
\- respondieron;  
\- recuperaron terreno;  
\- volvieron a meterse en el set;  
\- llegaron nuevamente a la igualdad;  
\- remontaron;  
\- se mantuvieron con vida;  
\- se agarraron al partido;  
\- estuvieron a un punto de cerrar;  
\- dejaron escapar una ventaja;  
\- cambiaron el desarrollo;  
\- cambiaron el partido;  
\- fueron más eficientes;  
\- generaron más presión;  
\- presionaron desde la devolución;  
\- les costó cerrar;  
\- consiguieron sostener la ventaja;  
\- terminaron imponiéndose;  
\- cerraron el partido.

Variar lenguaje para evitar sensación de templates repetidos.

\---

\# 25\. LENGUAJE PROHIBIDO / NO MEDIBLE

Evitar inferencias psicológicas:

\- fortaleza mental;  
\- debilidad mental;  
\- nervios;  
\- miedo;  
\- confianza;  
\- desconcentración;  
\- actitud;  
\- carácter;  
\- pecho frío;  
\- “se achicaron”;  
\- “no bajaron los brazos” como afirmación psicológica;  
\- cansancio;  
\- presión emocional.

Evitar clichés sin respaldo:

\- “dejaron todo”;  
\- “fue una batalla”;  
\- “demostraron carácter”.

Se puede describir el comportamiento observable que podría producir esas interpretaciones.

Ejemplo:

En vez de:

\> “mostraron mucha fortaleza mental.”

usar:

\> “salvaron tres Match Points y terminaron ganando el partido.”

\---

\# 26\. DATOS TÉCNICOS NO DISPONIBLES

No inventar:

\- winners;  
\- errores no forzados;  
\- smash;  
\- bandeja;  
\- víbora;  
\- x3/x4;  
\- juego en la red;  
\- táctica de nevera;  
\- primer/segundo saque;  
\- velocidad;  
\- calidad técnica individual;

salvo que en el futuro BRAMU realmente registre esos datos.

\---

\# 27\. SCORE ORIENTADO EN PROSA

El marcador interno puede almacenarse siempre A–B.

La narración debe orientarse a la pareja protagonista.

Ejemplo:

Score interno:

A 4–6 B.

Si la frase habla de B:

\> “ganaron el set 6–4.”

No:

\> “ganaron 4–6.”

Aplicar a:

\- sets;  
\- games;  
\- Tie breaks;  
\- parciales;  
\- secuencias.

Revisar posibles ramas residuales de V9.2 donde todavía pueda quedar orientación incorrecta.

\---

\# 28\. COBERTURA PARCIAL

Si el partido comenzó a registrarse tarde:

distinguir entre:

\#\#\# DATOS ESTRUCTURALES CONOCIDOS

Ejemplo:

primer set cargado manualmente 6–4.

Se puede decir:

\> “A ganó el primer set 6–4.”

\#\#\# DATOS DETALLADOS NO REGISTRADOS

No inventar:

\- breaks;  
\- saque;  
\- oportunidades;  
\- rachas;  
\- comportamiento detallado del set.

Si el registro comienza durante el partido y luego continúa hasta el final:

evitar frases artificiales como:

\> “hasta donde llega el registro…”

cuando estamos narrando una parte que efectivamente sí está registrada hasta el cierre.

\---

\# 29\. INTELLIGENCE Y DATOS INDIVIDUALES

BRAMU Intelligence V10 sigue siendo principalmente análisis por pareja.

No inventar rendimiento individual cuando la información registrada no permite separar objetivamente la contribución de cada jugador.

Los datos de servicio individual pueden utilizarse solo donde sean realmente válidos y estén respaldados por el registro.

No convertirlos en perfiles individuales generales.

\---

\# 30\. BRAMU INTELLIGENCE Y HIGHLIGHTS

Las nuevas categorías manuales de Highlight NO son estadísticas deportivas objetivas.

No utilizar un Highlight etiquetado como “Smash / X3” para afirmar:

\> “Jona dominó con el smash.”

Los Highlights sirven para:

\- localizar momentos;  
\- video futuro;  
\- recuerdos;  
\- Momentos Clave.

Inicialmente no deben alimentar conclusiones deportivas de BRAMU Intelligence.

\---

\# 31\. EVOLUCIÓN DEL PARTIDO — PRINCIPIO

La curva debe representar:

\> La posición competitiva de cada pareja en cada momento.

No representa:

\- porcentaje de los últimos puntos;  
\- simple volumen de puntos;  
\- probabilidad exacta de victoria.

Debe reflejar:

\- marcador;  
\- breaks;  
\- recuperación de ventajas;  
\- contexto;  
\- leverage;  
\- Match Points;  
\- Tie breaks;  
\- cambios estructurales.

No cada punto perdido debe provocar una caída.

\---

\# 32\. EVOLUCIÓN — MATCH POINT

Ejemplo:

A está 5–3 y tiene Match Point.

Pierde el MP.

Sigue 5–3.

No corresponde una caída brusca.

La erosión debe aparecer progresivamente cuando la situación competitiva realmente cambia:

\`5–3 → 5–4 → 5–5 → 5–6 → 5–7\`

El Match Point perdido puede representar un pequeño cambio.

No un precipicio.

\---

\# 33\. EVOLUCIÓN — TRANSICIÓN ENTRE SETS

V9.2 redujo significativamente una caída artificial entre sets, pero todavía puede existir una pérdida excesiva de valor al comenzar un nuevo parcial.

Refinar si corresponde.

Ejemplo observado en simulaciones:

después de ganar ampliamente el primer set, el valor no debería caer de manera fuerte simplemente porque comenzó el segundo.

La nueva unidad de set debe introducir incertidumbre razonable.

No borrar el contexto acumulado del partido.

\---

\# 34\. EVOLUCIÓN V10 — SIMPLIFICAR VISTA PARTIDO

\#\# REEMPLAZAR / SIMPLIFICAR

En la vista global \*\*PARTIDO\*\* conservar:

\- curva Equipo A;  
\- curva Equipo B;  
\- separadores de sets;  
\- resultado de cada set;  
\- Highlight si ya corresponde al diseño actual y no genera ruido;  
\- Match Points relevantes de forma muy discreta.

Eliminar de la vista Partido:

\- mini-break markers;  
\- símbolos de cada break;  
\- iconos de cierre TB;  
\- estrellas;  
\- rombos;  
\- Oro/Star rutinarios;  
\- exceso de nodos;  
\- leyenda compleja de símbolos si deja de ser necesaria.

La curva debe contar la película sin necesitar una explicación visual permanente.

\---

\# 35\. MATCH POINT EN EVOLUCIÓN

\#\# REEMPLAZAR

Evitar el rombo/punto flotante actual como principal solución.

Preferir:

\*\*línea vertical fina y discreta\*\*

con texto:

\`MP\`

o:

\`2 MP\`

\`3 MP\`

según corresponda.

Utilizar el color de la pareja que tuvo el Match Point.

La marca debe localizar cronológicamente el acontecimiento sin competir visualmente con las curvas.

No crear múltiples líneas casi juntas para Match Points consecutivos que pertenezcan a una misma secuencia.

Agrupar cuando corresponda.

\---

\# 36\. EVOLUCIÓN — VISTA POR SET

En:

\- SET 1;  
\- SET 2;  
\- SET 3;

se puede conservar mayor nivel de detalle porque el usuario está observando un tramo específico.

Evaluar mostrar discretamente:

\- break;  
\- contra-break;  
\- consolidación relevante.

No mostrar automáticamente todo.

Si la visualización queda más clara sin esos símbolos, priorizar limpieza.

La vista Partido debe ser claramente más limpia que la vista Set.

\---

\# 37\. MINI-BREAKS DE TIE BREAK

Los mini-breaks son útiles internamente para calcular contexto y evolución.

En la vista global del gráfico:

\#\# ELIMINAR

los indicadores visuales individuales de mini-break.

Generan ruido y dificultan la lectura.

El Tie break puede reflejarse mediante la propia evolución de las curvas y acontecimientos realmente extraordinarios como Match Points.

\---

\# 38\. MOMENTOS CLAVE

Momentos Clave tiene una función diferente de Evolución.

Debe permanecer más rico.

Su función es servir como registro cronológico de acontecimientos útiles.

Puede contener:

\- break;  
\- contra-break;  
\- Oro decisivo;  
\- Star decisivo;  
\- Tie break;  
\- Match Point;  
\- Match Point salvado;  
\- Set Point relevante;  
\- cierre de set;  
\- cierre de partido;  
\- Highlights;  
\- timestamp.

No simplificarlo al nivel del gráfico.

\---

\# 39\. EVENTOS COMPUESTOS EN MOMENTOS CLAVE

Cuando un mismo punto produce varias condiciones:

ejemplo:

\- Punto de Oro;  
\- Break Point;  
\- break;  
\- 5–4;

no generar cuatro entradas independientes.

Preferir una entrada compuesta.

Ejemplo:

\> \`Punto de Oro · Edu/Gusti quiebran → 5–4\`

Mantener la mejora introducida en V9.2.

\---

\# 40\. HIGHLIGHT RÁPIDO — NUEVA FUNCIÓN V10

\#\# AGREGAR

Actualmente Highlight funciona como toggle/marca rápida.

Mantener la velocidad de uso.

Nuevo comportamiento:

\#\#\# PASO 1

El usuario toca:

\`Highlight\`

El Highlight debe registrarse \*\*inmediatamente\*\*.

No esperar una segunda confirmación.

\#\#\# PASO 2

Inmediatamente aparece un popup pequeño, rápido y no invasivo.

Opciones:

\- \`Smash / X3\`  
\- \`Dejada\`  
\- \`Recuperación\`  
\- \`Puntazo\`

Layout recomendado:

2 × 2\.

Botones grandes y rápidos.

\#\#\# PASO 3A — ELIGE OPCIÓN

Si toca una categoría:

guardar:

\`Highlight \+ categoría\`

Cerrar popup inmediatamente.

Volver al marcador.

\#\#\# PASO 3B — NO HACE NADA

Después de aproximadamente \*\*3–4 segundos\*\*:

el popup desaparece automáticamente.

El Highlight queda registrado como Highlight genérico.

\#\#\# PASO 3C — TOCA FUERA

Si toca cualquier zona fuera del popup:

cerrarlo inmediatamente.

No cancelar el Highlight.

Conservar Highlight genérico.

Volver al uso normal del marcador.

\---

\# 41\. INDICADOR TEMPORAL DEL POPUP

\#\# AGREGAR

El popup debe incluir un pequeño indicador visual de tiempo restante.

Referencia conceptual:

\- aro de progreso;  
\- pequeño reloj circular;  
\- countdown visual;  
\- similar a interfaces que muestran cuánto falta para cerrar automáticamente.

No necesita mostrar números.

Debe comunicar visualmente:

\> “esto va a desaparecer solo en unos segundos”.

El indicador se vacía o completa progresivamente durante los 3–4 segundos.

No debe distraer más que las cuatro opciones.

\---

\# 42\. HIGHLIGHTS EN MOMENTOS CLAVE

Un Highlight clasificado debe poder aparecer como:

\- \`Highlight · Smash / X3\`  
\- \`Highlight · Dejada\`  
\- \`Highlight · Recuperación\`  
\- \`Highlight · Puntazo\`

Un Highlight sin selección:

\- \`Highlight\`

Mantener timestamp.

Esto debe preparar BRAMU para una futura integración con video.

No implementar video en V10.

\---

\# 43\. FINALIDAD FUTURA DE HIGHLIGHTS

La categoría puede ser útil para localizar rápidamente en video situaciones donde:

\- el valor estuvo en la jugada;  
\- no necesariamente en la importancia del marcador.

Ejemplo:

un gran punto ocurrido 15–15 dentro de un 6–0 / 6–1 puede ser irrelevante para BRAMU Intelligence pero excelente como clip de video.

Por eso:

\*\*Highlight ≠ Momento decisivo del partido.\*\*

Son conceptos independientes.

\---

\# 44\. FOOTER / VERSIÓN

\#\# AGREGAR

Footer:

\`BRAMU Lab · Concepto y diseño por Julián Sebastián · v10\`

Idealmente gestionar la versión desde una constante o único punto central del proyecto.

Objetivo:

en futuras versiones cambiar el número una sola vez.

No duplicar strings de versión innecesariamente.

\---

\# 45\. AJUSTES V9.2 A ABSORBER EN V10

No crear V9.3.

Resolver dentro de V10 cuando corresponda:

\#\#\# 45.1 MAGNITUD DE COMPARACIONES

Evitar:

\`7 BP vs 6 BP \= muchas más oportunidades\`

Implementar gradación semántica.

\#\#\# 45.2 EVOLUCIÓN ENTRE SETS

Refinar cualquier caída residual artificial al empezar un nuevo set.

\#\#\# 45.3 NODOS ESPECIALES

Eliminar/simplificar Oro/Star/mini-break y otros nodos que generen ruido.

\#\#\# 45.4 SCORE ORIENTATION

Revisar ramas poco frecuentes para garantizar que la prosa siempre muestre el marcador desde la perspectiva del protagonista.

\---

\# 46\. CASOS DE PRUEBA OBLIGATORIOS

Crear una batería sintética de tests.

No depender exclusivamente de partidos manuales.

Los tests deben comprobar:

1\. hechos;  
2\. clasificación;  
3\. story ranking;  
4\. texto esperado conceptualmente;  
5\. frases prohibidas;  
6\. Evolución cuando corresponda.

\---

\# 47\. TEST — DOMINIO TOTAL

Resultado:

\`6–0 · 6–0\`

Esperado:

\- dominio claro;  
\- no falso momento decisivo tardío;  
\- estadísticas únicamente como evidencia.

Prohibido:

\- “partido parejo”;  
\- “se definió por…” ante un evento tardío irrelevante.

\---

\# 48\. TEST — 6–0 / 6–1

Esperado:

\- “dominaron de principio a fin” si la secuencia realmente lo demuestra;  
\- ningún servicio cedido si corresponde;  
\- breaks correctamente interpretados;  
\- 0/0 correctamente tratado.

Prohibido:

\- paridad por Oro/Star;  
\- evento final presentado como bisagra si la diferencia estaba construida mucho antes.

\---

\# 49\. TEST — MISMO 6–3, HISTORIA DIFERENTE A

Secuencia:

\`5–0 → 5–3 → 6–3\`

Esperado:

\- dominio inicial;  
\- reacción del rival;  
\- cierre.

\---

\# 50\. TEST — MISMO 6–3, HISTORIA DIFERENTE B

Secuencia:

\`1–1 → 2–2 → 3–3 → 4–3 → break → 6–3\`

Esperado:

\- partido parejo;  
\- quiebre tardío;  
\- diferencia construida al final.

Prohibido:

\> “dominaron de principio a fin.”

\---

\# 51\. TEST — ÚNICO BREAK 6–4

Todos sostienen durante gran parte del set.

Único break define.

Esperado:

\- partido parejo;  
\- diferencia tardía;  
\- único quiebre como elemento central.

\---

\# 52\. TEST — SIN BREAKS \+ TIE BREAK

Todos mantienen servicio.

Tie break decide.

Esperado:

\- paridad estructural;  
\- no dominio por puntos totales;  
\- importancia del desempate.

\---

\# 53\. TEST — PRESIÓN SIN CONVERSIÓN

A:

\`0/15 BP\`

B:

\`1/1 BP\`

Esperado:

\- A generó mucha presión;  
\- A no pudo convertir;  
\- B aprovechó su única oportunidad.

Prohibido:

\- “A dominó” únicamente por BP;  
\- “B fue más eficiente que 0/0” si fuera otro caso.

\---

\# 54\. TEST — EFICIENCIA

A:

\`3/9\`

B:

\`2/3\`

Esperado:

\- A consiguió más breaks;  
\- B tuvo mejor conversión.

Prohibido:

\> “A aprovechó mejor sus oportunidades.”

\---

\# 55\. TEST — DIFERENCIA MÍNIMA

BP:

\`7 vs 6\`

Prohibido:

\> “muchas más oportunidades.”

Esperado:

\- cifras similares;  
\- apenas una más;  
\- o directamente omitir comparación.

\---

\# 56\. TEST — DIFERENCIA GRANDE

BP:

\`9 vs 3\`

Puede utilizar:

\- “claramente más oportunidades”;  
\- “generó mucha más presión”.

Calibrar semántica.

\---

\# 57\. TEST — 0/0

A:

\`2/5\`

B:

\`0/0\`

Esperado:

\- B no tuvo oportunidades si es relevante.

Prohibido:

\- comparar eficiencia de B;  
\- “0 de 0”.

\---

\# 58\. TEST — REMONTADA 1–4

\`1–4 → 4–4 → victoria\`

Esperado:

\- recuperación real;  
\- cambio de dinámica;  
\- victoria posterior.

\---

\# 59\. TEST — REMONTADA INCOMPLETA

\`1–4 → 4–4 → derrota\`

Esperado:

\- recuperación;  
\- volvió al partido;  
\- finalmente no pudo completarla.

No llamarla remontada victoriosa.

\---

\# 60\. TEST — PARTIDO QUE SE ESCAPA

A:

\- gana primer set;  
\- tiene MP en segundo;  
\- pierde segundo;  
\- pierde tercero.

Esperado:

\- A estuvo a un punto de ganar;  
\- B salva MP;  
\- describir desenlace posterior.

\---

\# 61\. TEST — “SE AGARRARON AL PARTIDO”

B:

\- enfrenta MP;  
\- salva;  
\- gana partido.

Puede decir:

\> “se agarraron al partido.”

Mismo caso pero B termina perdiendo:

Prohibido usar esa construcción con sentido de remontada exitosa.

\---

\# 62\. TEST — GANADOR CON MENOS PUNTOS

B gana con diferencia significativa en puntos totales a favor de A.

Esperado:

mencionar contradicción solo si realmente agrega explicación.

No deducir psicología.

\---

\# 63\. TEST — ORO 5/5

A gana todos los Puntos de Oro.

Puede ser una evidencia importante si ayudaron a definir el partido.

\---

\# 64\. TEST — ORO EQUILIBRADO EN PALIZA

Partido:

\`6–0 · 6–1\`

Oro:

\`2–1\`

Prohibido:

\> “Estuvo muy parejo.”

\---

\# 65\. TEST — BREAK \+ CONTRA-BREAK

Esperado:

interpretar la relación.

No presentar el primer break como ventaja consolidada.

\---

\# 66\. TEST — BREAK \+ HOLD

Puede detectar consolidación cuando sea importante.

No narrar mecánicamente cada consolidación.

\---

\# 67\. TEST — CAMBIO DE DOMINIO

\`6–1 · 1–6 · tercer set\`

Esperado:

\- A comenzó dominando;  
\- B respondió;  
\- tercer set determina.

\---

\# 68\. TEST — MATCH POINT CON VENTAJA TODAVÍA AMPLIA

A:

\`5–3 \+ MP\`

pierde el MP.

Sigue 5–3.

Evolución:

no caída brusca.

Narrativa:

MP puede ser importante si luego el partido cambia.

Si A gana tranquilamente 6–3 después:

no sobreinterpretarlo.

\---

\# 69\. TEST — MATCH POINT → REMONTADA

\`5–3 MP → 5–4 → 5–5 → 5–6 → 5–7\`

Esperado:

la pérdida de control debe aparecer progresivamente.

No atribuir el vuelco exclusivamente al instante exacto del MP perdido.

\---

\# 70\. TEST — TIE BREAK \+ MP SALVADO \+ TERCER SET

Referencia:

\`6–3 · 6–7 (6–8) · 2–6\`

Segundo:

\- break/contra-break;  
\- TB;  
\- B 5–2;  
\- A 6–5 MP;  
\- B salva;  
\- B gana 8–6.

Tercero:

B gana 6–2.

Esperado:

aproximadamente tres párrafos.

Historia:

1\. A arranca mejor.  
2\. segundo cerrado;  
3\. TB \+ MP como bisagra;  
4\. B domina tercero.

Prohibido resumir todo como:

\> “B empezó perdiendo y se repuso.”

\---

\# 71\. TEST — EDICIÓN DE TIE BREAK

Mantener comportamiento validado en V9.2.

Editar score interno del TB durante el partido.

Continuar.

Esperado:

\- no marcar partido como parcial;  
\- no mostrar “ajuste manual” incorrectamente;  
\- estadísticas continúan coherentes.

\---

\# 72\. TEST — PARTIDO PARCIAL

Comenzar registro con sets/games previos cargados.

Esperado:

\- estructura conocida correctamente narrada;  
\- detalle solo sobre segmento registrado;  
\- no inventar eventos anteriores.

\---

\# 73\. TEST — FINALIZACIÓN MANUAL

Mantener comportamiento existente.

Resultado parcial correctamente representado.

No inventar ganador cuando no corresponde.

\---

\# 74\. CRITERIOS DE ACEPTACIÓN DE BRAMU INTELLIGENCE

La pregunta principal ya no es solo:

\> “¿Los números son correctos?”

Eso es obligatorio.

La prueba importante es:

\> \*\*¿Una persona que vio el partido reconoce en el texto la película que acaba de ver?\*\*

Segunda pregunta:

\> \*\*¿El texto está mencionando información cierta pero irrelevante que distrae de lo importante?\*\*

Si la respuesta es sí:

la selección narrativa todavía necesita mejorar.

\---

\# 75\. REGLAS DE REDACCIÓN

Evitar que todos los análisis tengan exactamente la misma estructura lingüística.

Crear bancos de expresiones por función narrativa.

Ejemplo:

\#\# ARRANQUE

\- arrancaron mejor;  
\- comenzaron imponiendo condiciones;  
\- tomaron rápidamente la ventaja;  
\- fueron los primeros en marcar diferencias.

\#\# RESPUESTA

\- respondieron;  
\- reaccionaron;  
\- recuperaron terreno;  
\- lograron volver al partido;  
\- equilibraron el desarrollo.

\#\# QUIEBRE

\- consiguieron el primer quiebre;  
\- encontraron el break;  
\- lograron romper el servicio rival;  
\- aprovecharon la oportunidad al resto.

\#\# CIERRE

\- sostuvieron la ventaja;  
\- cerraron el set;  
\- terminaron imponiéndose;  
\- no dejaron escapar la oportunidad.

No elegir variantes aleatoriamente sin contexto.

La frase debe seguir siendo semánticamente correcta.

\---

\# 76\. EVITAR REPETICIONES

No repetir excesivamente:

\- “partido”;  
\- “quiebre”;  
\- nombres completos de los cuatro jugadores en cada oración;  
\- marcador completo;  
\- “terminaron”;  
\- “consiguieron”.

Alternar de manera natural:

\- pareja;  
\- nombres;  
\- ellos;  
\- equipo;  
\- la dupla;

siempre que no genere ambigüedad.

\---

\# 77\. NO SOBREDRAMATIZAR

La crónica debe ser interesante.

No sensacionalista.

Evitar convertir un partido amateur normal en una narración exagerada.

La riqueza debe surgir de los acontecimientos reales.

\---

\# 78\. NO SER INSULSO

El extremo contrario también es un error.

Partidos con mucha historia no pueden terminar resumidos en dos frases genéricas.

Ejemplo incorrecto:

\> “Edu y Gusti empezaron perdiendo el primer set pero se recuperaron y ganaron el partido.”

Aunque sea verdadero, desperdicia:

\- Tie break;  
\- MP salvado;  
\- break/contra-break;  
\- cambio de dominio;  
\- tercer set.

La profundidad debe ser proporcional al partido.

\---

\# 79\. RELACIÓN ENTRE MATCH STORY, INTELLIGENCE, EVOLUCIÓN Y MOMENTOS CLAVE

Idealmente las tres funciones deben compartir una misma capa factual.

\*\*MATCH STORY / FACTS\*\*

verdad estructurada del partido.

De ahí derivan:

\#\#\# BRAMU INTELLIGENCE

interpreta la historia.

\#\#\# EVOLUCIÓN

visualiza la posición competitiva.

\#\#\# MOMENTOS CLAVE

enumera eventos cronológicos localizables.

No deberían existir tres interpretaciones incompatibles de un mismo acontecimiento.

\---

\# 80\. NO IMPLEMENTAR IA EXTERNA

BRAMU Intelligence V10 debe continuar funcionando localmente y de forma determinística.

No integrar:

\- OpenAI;  
\- Claude API;  
\- Gemini;  
\- servicios pagos;  
\- llamadas externas de generación de texto.

El objetivo es maximizar el motor local.

La posibilidad de una capa generativa futura queda fuera de V10.

\---

\# 81\. NO AÑADIR FUNCIONES AJENAS AL ALCANCE

No incorporar en V10:

\- login;  
\- cuentas;  
\- nube;  
\- monetización;  
\- planes pagos;  
\- publicidad;  
\- ranking de jugadores;  
\- perfiles complejos;  
\- estadísticas técnicas individuales inventadas;  
\- video;  
\- edición de video;  
\- social;  
\- torneos;  
\- matchmaking;  
\- backend;  
\- arquitectura empresarial.

V10 está enfocada.

\---

\# 82\. PRIORIDAD DE IMPLEMENTACIÓN

Orden recomendado:

\#\# BLOQUE A — BRAMU INTELLIGENCE

Máxima prioridad.

Implementar:

\- Facts;  
\- Relations;  
\- Classifications;  
\- Story Ranking;  
\- Evidence;  
\- Suppression;  
\- Narrative Planner;  
\- Language.

\#\# BLOQUE B — TESTS DE INTELLIGENCE

Crear batería sintética y validar casos.

No confiar únicamente en test manual.

\#\# BLOQUE C — EVOLUCIÓN

Mantener lógica que ya funciona y aplicar refinamientos/contexto necesarios.

Simplificar visualmente.

\#\# BLOQUE D — HIGHLIGHT RÁPIDO

Función pequeña y aislada.

\#\# BLOQUE E — FOOTER / VERSIONADO

Detalle final.

\---

\# 83\. ESTRATEGIA TÉCNICA

Antes de editar:

1\. inspeccionar completamente la base V9.2;  
2\. entender dónde viven actualmente:  
   \- estadísticas;  
   \- Match Story;  
   \- Intelligence;  
   \- Evolución;  
   \- Momentos Clave;  
   \- Highlight;  
3\. identificar dependencias;  
4\. preservar contratos existentes.

No hacer reemplazos masivos innecesarios.

Cuando una función existente pueda evolucionar:

\*\*FUSIONAR / REFACTORIZAR LOCALMENTE\*\*

antes que duplicar lógica paralela.

Evitar dos motores distintos interpretando el mismo partido.

\---

\# 84\. MODULARIDAD

La decisión sobre una eventual modularización general del proyecto puede surgir del flujo de optimización previo a Claude.

Este consolidado define el comportamiento.

Si se decide modularizar, una estructura conceptual posible sería separar responsabilidades similares a:

\- match facts;  
\- match relations;  
\- classification;  
\- story ranking;  
\- narrative;  
\- evolution;  
\- view/UI.

Pero NO realizar una reestructuración grande únicamente porque aparece sugerida aquí.

Priorizar:

1\. estabilidad;  
2\. claridad;  
3\. tests;  
4\. comportamiento V10.

\---

\# 85\. NO ROMPER V9.2

Hacer regresión sobre funciones ya validadas.

Especial atención a:

\- Punto de Oro;  
\- Star Point;  
\- Advantage;  
\- Americano 5–5 TB;  
\- Clásico 6–6 TB;  
\- Tie break muere en 7;  
\- Tie break a 15;  
\- server rotation;  
\- Quick Correction;  
\- TB correction;  
\- partidos parciales;  
\- timeline;  
\- history;  
\- old localStorage;  
\- Match Story;  
\- manual finish.

\---

\# 86\. PERSISTENCIA

No romper las claves existentes de localStorage únicamente por el cambio de marca o versión.

Si actualmente existen claves históricas con denominación anterior, conservar compatibilidad.

Los partidos guardados anteriormente deben seguir disponibles.

\---

\# 87\. CACHE / PWA

Actualizar correctamente la versión de cache de V10 si corresponde.

Evitar que la PWA siga sirviendo JS/CSS de V9.2 después de instalar la nueva versión.

Mantener manifest y funcionamiento offline existente.

\---

\# 88\. SHARE

No dedicar trabajo a corregir problemas específicos de Share cuando la aplicación corre mediante \`file://\`.

Existe una limitación conocida relacionada con \`fetch(styles.css)\` bajo \`file://\`.

El comportamiento real deberá evaluarse sobre servidor local / GitHub Pages.

No convertir eso en un blocker de V10.

\---

\# 89\. TESTING AUTOMÁTICO

Además de syntax checks, crear tests unitarios o harness sintético donde resulte posible.

Especialmente para:

\- clasificación;  
\- score orientation;  
\- BP semantics;  
\- magnitudes;  
\- story ranking;  
\- suppression;  
\- MP saved;  
\- comeback;  
\- dominance;  
\- close match;  
\- partial coverage.

Idealmente cada bug narrativo relevante encontrado a partir de ahora debe generar un nuevo test de regresión.

\---

\# 90\. TESTING MANUAL FINAL

Después de automatizados, realizar pruebas manuales mínimas sobre:

\#\#\# CASO 1

Partido parejo \+ único break tardío.

\#\#\# CASO 2

6–0 / 6–1.

\#\#\# CASO 3

Tres sets \+ TB \+ MP salvado \+ cambio de dominio.

\#\#\# CASO 4

Partido sin breaks \+ TB.

\#\#\# CASO 5

Partido parcial.

\#\#\# CASO 6

Highlight rápido.

\---

\# 91\. RESULTADO ESPERADO DE HIGHLIGHT RÁPIDO

Validar:

1\. tocar Highlight lo registra inmediatamente;  
2\. aparece popup;  
3\. elegir categoría la guarda;  
4\. popup se cierra;  
5\. si no se elige nada desaparece solo;  
6\. queda Highlight genérico;  
7\. tocar afuera lo cierra;  
8\. Highlight no se pierde;  
9\. aro/reloj progresa correctamente;  
10\. marcador sigue siendo rápido de usar.

\---

\# 92\. RESULTADO ESPERADO DE EVOLUCIÓN

Vista Partido:

\- limpia;  
\- legible;  
\- dos curvas protagonistas;  
\- sets claros;  
\- MPs discretos;  
\- sin contaminación de mini-breaks/símbolos.

Vista Set:

\- puede mostrar algo más de detalle;  
\- nunca sacrificar legibilidad.

La película visual debe coincidir con BRAMU Intelligence.

\---

\# 93\. RESULTADO ESPERADO DE MOMENTOS CLAVE

Mantener riqueza cronológica.

Los eventos deben ser:

\- útiles;  
\- localizables;  
\- sin duplicaciones absurdas;  
\- con Highlights correctamente etiquetados.

Pensar esta sección como futura puerta hacia video.

\---

\# 94\. RESULTADO ESPERADO DE BRAMU INTELLIGENCE

Al terminar un partido complejo:

el usuario debe sentir:

\> “Quiero leer qué dijo BRAMU de este partido.”

No:

\> “Ya sé lo que dice: perdí el primero y después gané.”

Esto es parte central del valor diferencial del producto.

\---

\# 95\. PRINCIPIO FINAL

La mejor versión de BRAMU Intelligence no es la que menciona más datos.

Es la que identifica correctamente:

\- qué pasó;  
\- cuándo cambió;  
\- por qué ese cambio fue relevante;  
\- cómo terminó construyéndose el resultado;

y lo cuenta con suficiente riqueza para que el jugador reconozca el partido que acaba de vivir.

\*\*BRAMU no debe leer estadísticas.    
Debe interpretar el partido.\*\*

\---

\# 96\. ENTREGA ESPERADA

Al finalizar la implementación:

1\. entregar el proyecto completo funcional;  
2\. indicar claramente qué archivos fueron modificados;  
3\. resumir los cambios realizados;  
4\. indicar tests ejecutados;  
5\. informar cualquier decisión técnica relevante;  
6\. informar cualquier punto de esta especificación que no haya podido implementarse exactamente;  
7\. no ocultar limitaciones;  
8\. no declarar éxito únicamente porque no existen errores de sintaxis.

La aceptación depende principalmente del comportamiento observado.

\---

\# 97\. VERSIÓN OBJETIVO

Versión final:

\*\*BRAMU Lab V10\*\*

Footer:

\*\*BRAMU Lab · Concepto y diseño por Julián Sebastián · v10\*\*

Esta versión debe convertirse en la nueva base estable para las primeras pruebas más serias del producto.  
