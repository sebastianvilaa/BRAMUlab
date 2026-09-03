# BRAMU Lab — Consolidado V13

## OBJETIVO

Base actual: **V12.2 cerrada y validada manualmente**.

V13 incorpora un segundo modo de registro:

**POR GAMES · BETA**

La hipótesis a probar es concreta:

> **¿Puede BRAMU registrar un partido con un toque por game y seguir devolviendo un resumen, estadísticas, Evolución y BRAMU Intelligence suficientemente interesantes como para que valga la pena usarlo?**

La razón de este modo nace de la primera prueba real en cancha: el registro punto por punto devuelve información atractiva, pero exige demasiada atención para alguien que también quiere mirar el partido, hablar con amigos, usar el celular y distraerse.

Principio de V13:

> **Menos carga para registrar, sin inventar precisión que no existe.**

---

# 1. MODOS DE REGISTRO

Mantener el modo actual:

**COMPLETO**

Conceptualmente:

> Punto por punto · máximo detalle.

Agregar:

**POR GAMES · BETA**

Conceptualmente:

> Seguimiento relajado · un toque por game.

No reemplazar ni degradar el modo Completo.

---

# 2. SELECTOR DE MODO EN HOME

En la navegación superior de Home usar una lógica tipo web:

**HISTORIAL · MODO COMPLETO ▾**

No usar dos puntos en el texto.

Al tocar el selector:

- Completo
- Por games · BETA

Default inicial:

**MODO COMPLETO**

Si el usuario elige `POR GAMES · BETA`, recordar esa selección para la próxima vez que vuelva a Home.

Una vez iniciado un partido, el modo queda bloqueado.

No permitir durante V13:

- Completo → Por Games;
- Por Games → Completo;
- mezcla de granularidades dentro del mismo partido.

---

# 3. CONFIGURACIÓN DEL PARTIDO

La configuración sigue siendo la misma en ambos modos:

- cuatro jugadores;
- parejas;
- formato;
- sistema de puntuación;
- primer sacador.

Mantener:

- CLÁSICO;
- AMERICANO;
- Punto de Oro;
- Star Point;
- Con Ventaja.

En `POR GAMES`, el sistema de puntuación describe las reglas del partido, pero BRAMU no observa los puntos internos del game.

Por lo tanto no puede calcular cuántos Puntos de Oro, Deuce, Star Points, etc. ocurrieron.

No eliminarlos de la configuración.

---

# 4. PANTALLA EN VIVO — POR GAMES

Conservar la estructura visual base del marcador actual:

- dos grandes áreas;
- Team A / Team B;
- colores actuales;
- marcador compacto superior;
- sacador visible;
- header;
- menú;
- barra inferior.

No diseñar otra pantalla desde cero.

En modo `POR GAMES`, tocar el área grande de una pareja significa:

> **ESA PAREJA GANÓ EL GAME**

No recorrer 0/15/30/40.

El score grande representa directamente games:

`0 → 1 → 2 → 3 → 4 → 5 → 6...`

Cada toque debe:

1. registrar ganador del game;
2. actualizar marcador;
3. detectar hold/break cuando sea posible;
4. avanzar rotación de saque;
5. actualizar set/partido;
6. alimentar Evolución;
7. alimentar estadísticas compatibles;
8. alimentar BRAMU Intelligence.

El header debe identificar claramente:

**POR GAMES · BETA**

sin robar protagonismo al marcador.

---

# 5. SACADOR, HOLD Y BREAK

Mantener la selección del primer sacador y la rotación actual game por game.

Si gana el game la pareja que estaba sacando:

**HOLD**

Si gana el game la pareja que estaba restando:

**BREAK**

No pedir al usuario que etiquete el game.

Debe calcularse automáticamente.

---

# 6. AVISOS DURANTE EL PARTIDO

En modo Games no mostrar lenguaje de puntos que BRAMU no conoce.

NO mostrar:

- SET POINT;
- MATCH POINT;
- BREAK POINT.

Si ganar el próximo game cierra el set:

**GAME PARA EL SET**

Si ese mismo game cierra el partido:

**GAME PARA EL PARTIDO**

Priorizar `GAME PARA EL PARTIDO` cuando corresponda.

Ejemplos Clásico:

- 5-0 → Game para el set;
- 5-4 → Game para el set;
- 5-5 → nada;
- 6-5 → Game para el set;
- si la pareja además ya ganó el primer set → Game para el partido.

En Americano, como el set es el partido, usar `GAME PARA EL PARTIDO` cuando corresponda.

---

# 7. BARRA DE HERRAMIENTAS — POR GAMES

En modo Completo mantener la barra actual.

En `POR GAMES · BETA` usar:

**DESHACER · HIGHLIGHT · EDITAR**

No mostrar `AJUSTAR`.

Motivo:

En modo Games, `EDITAR` debe cubrir la corrección rápida del score y la edición profunda.

---

# 8. DESHACER

Debe revertir el último game registrado y todas sus consecuencias.

Ejemplo:

score correcto:

`3-3`

se registra por error game para B:

`3-4`

DESHACER → volver a:

`3-3`

También revertir:

- hold/break;
- rotación;
- racha;
- Evolución;
- estadísticas;
- estados de set/partido.

---

# 9. HIGHLIGHT

Mantener Highlight en modo Games.

Categorías actuales:

- Smash / X3
- Recuperación
- Puntazo
- Blooper

Highlight sigue siendo subjetivo y NO debe convertirse en estadística objetiva.

En modo Games guardar el contexto disponible:

- timestamp/minuto;
- set;
- score de games;
- sacador conocido;
- categoría.

Ejemplo conceptual:

`37:42 · Set 2 · 4-4 · sacaba Fran · Puntazo`

No inventar score de puntos.

---

# 10. EDITAR — MODO POR GAMES

Reutilizar la filosofía y estructura del editor actual, adaptada al nuevo nivel de información.

Al tocar `EDITAR`, ofrecer primero una corrección rápida:

## AJUSTAR GAMES

Equipo A:

`0 · 1 · 2 · 3 · 4 · 5 · 6`

Equipo B:

`0 · 1 · 2 · 3 · 4 · 5 · 6`

Adaptar el rango si el estado/regla requiere otro valor válido.

Debajo mantener:

**EDITAR MARCADOR COMPLETO**

para correcciones más profundas.

---

# 11. CORRECCIÓN MANUAL — NO INVENTAR SECUENCIAS

Caso real:

BRAMU tenía:

`3-2`

El usuario se distrae y luego descubre que van:

`4-3`

BRAMU sabe con certeza:

- el score actual es 4-3;
- se jugaron dos games más;
- Equipo A ganó un game adicional;
- Equipo B ganó un game adicional.

Pero NO sabe necesariamente el orden.

Podría haber ocurrido:

`3-2 → 4-2 → 4-3`

O:

`3-2 → 3-3 → 4-3`

Ese orden cambia:

- holds;
- breaks;
- contra-breaks;
- rachas;
- cambios de dominio;
- lectura narrativa.

Regla:

> **Guardar el marcador correcto sin fabricar la secuencia intermedia.**

Conservar cuando sea matemáticamente seguro:

- games totales;
- score actual;
- sets ya cerrados;
- duración;
- contexto temporal.

Marcar como parcial cuando dependa del orden desconocido:

- holds;
- breaks;
- rachas;
- cambios de dominio;
- máxima ventaja dentro del tramo;
- remontadas;
- secuencia de saque;
- narrativa derivada del orden.

---

# 12. DATOS PARCIALES

Usar la solución visual ya validada en V12.2.

En la métrica afectada:

`BREAKS *`

`RACHA MÁXIMA DE GAMES *`

etc.

Y una sola nota:

`* Datos parciales por corrección manual`

No crear banners grandes.

No marcar como parcial una métrica completamente conocida.

---

# 13. EVOLUCIÓN Y CORRECCIONES

En modo Games, Evolución se alimenta game por game.

Cuando todos los games fueron registrados, la secuencia es limpia:

`0-0 → 1-0 → 1-1 → 2-1 → 3-1...`

Si ocurre una corrección:

`3-2 → corrección → 4-3`

Evolución debe llegar correctamente a `4-3`, pero NO fabricar el punto intermedio.

Marcar ese tramo de forma discreta como parcial/orden desconocido.

No rediseñar la fórmula global de Evolución en esta ronda.

---

# 14. TIE BREAK REGLAMENTARIO — POR GAMES

En modo Games NO registrar punto por punto el Tie break.

Cuando el reglamento dispara un TB, abrir un flujo simple.

## Paso 1 — ganador obligatorio

### ¿Quién ganó el Tie break?

- Equipo A
- Equipo B

## Paso 2 — resultado interno opcional

### ¿Sabés el resultado del Tie break?

Permitir cargar, por ejemplo:

- 7-4;
- 7-5;
- 9-7;
- etc.

También ofrecer:

**OMITIR**

Si se omite el score interno, BRAMU igual conoce quién ganó el TB, el set y el partido si corresponde.

No inventar el resultado interno.

---

# 15. SCORE DEL SET CON TB REGLAMENTARIO

Aunque el score interno del TB sea desconocido, el score reglamentario del set sí es conocido.

Ejemplo Clásico:

- Set 1: Seba/Matu 6-0.
- Set 2: 6-6.
- Seba/Matu ganan el TB.
- El usuario omite resultado interno.

Resultado:

**6-0 · 7-6**

No mostrar `6-6 · TB ?` para un TB reglamentario.

Si se conoce el score interno, conservarlo como detalle adicional para Historial/Intelligence.

---

# 16. AMERICANO — POR GAMES

Respetar exactamente la lógica actual de Americano:

- un set;
- gana 6-0...6-4;
- en 5-5 va directo a TB;
- quien gana el TB cierra 6-5.

En modo Games:

- llegar a 5-5;
- preguntar ganador del TB;
- resultado interno opcional;
- guardar 6-5 para la pareja ganadora.

No registrar puntos del TB uno por uno.

---

# 17. RESOLVER CON TIE BREAK EXTRAORDINARIO

Mantener la función validada en V12.2.

No confundir un TB reglamentario con `RESOLVER CON TIE BREAK`.

En `POR GAMES`, adaptar el flujo al nivel relajado:

1. elegir modalidad/objetivo según la lógica existente;
2. registrar ganador obligatorio;
3. score interno opcional;
4. cerrar el partido;
5. mantener score regular previo intacto;
6. mostrar TB como segmento decisivo extraordinario.

Ejemplo con score conocido:

`6-3 · 4-4 · TB 10-8`

Si se omite el score interno, mantener el segmento TB identificado y el ganador correcto, sin inventar el resultado.

---

# 18. EDITAR JUGADORES

AGREGAR al menú ☰:

**EDITAR JUGADORES**

No usar el tap sobre el indicador de saque para editar nombres.

Mantener separadas las intenciones:

- tocar indicador de saque → corregir sacador;
- menú → Editar jugadores.

Flujo:

`Jugador 1 ✎`
`Jugador 2 ✎`
`Fran ✎`
`Jugador 4 ✎`

Editar texto → Guardar → volver al partido.

Cambiar un nombre NO crea un jugador nuevo.

Internamente debe seguir siendo el mismo ID.

Ejemplo:

`Jugador 4 → Marcos`

Después del cambio, usar `Marcos` retroactivamente en toda la presentación:

- marcador;
- Resumen;
- Análisis;
- estadísticas;
- BRAMU Intelligence;
- Historial;
- Highlights.

No mezclar `Jugador 4` en hechos anteriores y `Marcos` en posteriores.

---

# 19. SALIR DE LA APP Y VOLVER

El comportamiento actual de partido en curso ya existe y funciona.

V13 no debe romperlo.

Prueba real esperada:

1. registrar game;
2. salir a WhatsApp;
3. volver;
4. registrar otro;
5. abrir Instagram;
6. bloquear celular;
7. volver a BRAMU.

Debe conservar:

- partido;
- modo;
- score;
- sets;
- reloj;
- sacador;
- rotación;
- Highlights;
- historial del partido en curso.

No reiniciar ni duplicar eventos.

---

# 20. RESUMEN — POR GAMES

Mantener la estructura visual actual del Resumen.

No crear una nueva pantalla.

## Metadata

Agregar contexto visible y discreto:

- fecha;
- hora;
- formato;
- sistema de puntuación;
- tipo de registro.

Referencia:

`29 AGO 2026 · 18:42 · CLÁSICO · PUNTO DE ORO · POR GAMES`

Aplicar también cuando se abre desde Historial.

## Métricas principales

Mostrar:

### Games ganados

Cantidad total por pareja.

### Games de saque ganados

Ejemplo:

`8/10 games`

### Breaks

Games ganados al resto.

No agregar además “Games ganados al resto”, porque sería duplicar Breaks.

### Racha máxima de games

Mayor cantidad de games consecutivos ganados.

### Duración total

Mantener.

---

# 21. NO MOSTRAR EN RESUMEN POR GAMES

No mostrar:

- puntos ganados;
- puntos al saque;
- puntos al resto;
- Puntos de Oro;
- Break Points;
- Set Points;
- Match Points;
- racha máxima de puntos;
- estadísticas individuales basadas en puntos.

No llenar con ceros ni “sin datos”.

Usar únicamente métricas compatibles con el modo.

---

# 22. ANÁLISIS / ESTADÍSTICAS — POR GAMES

Mantener pestañas:

**PARTIDO · SET 1 · SET 2 · SET 3**

según corresponda.

Métricas base:

- Games ganados;
- Games de saque ganados;
- Breaks;
- Racha máxima de games.

Agregar:

## Máxima ventaja alcanzada

Definición:

> Mayor diferencia de games que una pareja llegó a tener a favor dentro del tramo analizado.

Ejemplo:

4-1 → **+3 games**

## Mayor desventaja remontada

Definición:

> Mayor déficit de games desde el que una pareja consiguió volver a igualar el marcador o ponerse por delante.

Ejemplo:

`1-4 → 4-4`

Resultado:

**remontó 3 games**

Si:

`1-4 → 3-4 → pierde 3-6`

NO decir que remontó 3.

Se acercó, pero no completó la remontada.

Esta métrica NO es simplemente la máxima ventaja rival invertida.

---

# 23. BRAMU INTELLIGENCE — POR GAMES

Crear/usar una lógica narrativa específica basada en la información realmente disponible.

La unidad narrativa principal es:

**la secuencia de games.**

Puede analizar:

- quién arrancó mejor;
- ventaja máxima;
- racha máxima de games;
- mayor desventaja remontada;
- breaks;
- holds;
- break + hold;
- cambios de dominio;
- recuperaciones de igualdad;
- quién pasó de estar abajo a estar arriba;
- qué set fue más parejo;
- diferencias entre sets;
- game que generó una ventaja decisiva;
- tramo final del set;
- TB reglamentario;
- TB extraordinario;
- resultado final;
- duración si aporta contexto.

Ejemplo conceptual, solo si los datos lo respaldan:

> Fran y Marcos arrancaron mejor y construyeron una ventaja de tres games en el primer set. La otra pareja reaccionó con cuatro games consecutivos y pasó de estar 1-4 a ponerse 5-4. El segundo set fue mucho más parejo y se resolvió recién en el Tie break, que Fran y Marcos ganaron para cerrar el partido.

No usar este texto como plantilla fija.

---

# 24. BRAMU INTELLIGENCE — NO INVENTAR

En modo Games NO afirmar:

- quién ganó más puntos;
- quién fue mejor en Puntos de Oro;
- cantidad/eficiencia de Break Points;
- Set Points salvados;
- Match Points salvados;
- rachas de puntos;
- rendimiento individual por puntos;
- presión basada en 15/30/40;
- secuencias internas de un game.

Si existe un tramo corregido manualmente con orden desconocido, no usarlo para afirmar:

- rachas;
- remontadas;
- break + hold;
- cambios de dominio;
- secuencia concreta.

Sí puede usar score conocido antes/después y games totales matemáticamente seguros.

---

# 25. EVOLUCIÓN — POR GAMES

Mantener Evolución como pieza importante.

Su fuente debe ser la secuencia de games registrados.

No cambiar el significado general de la curva.

Adaptar la lectura para eventos de game y respetar tramos parciales cuando existan correcciones manuales.

---

# 26. HISTORIAL

Los partidos `POR GAMES` deben guardarse normalmente.

Deben poder distinguirse de `COMPLETO`.

Mostrar de forma discreta:

**POR GAMES**

Al abrir un partido, mostrar:

- fecha;
- hora;
- formato;
- sistema;
- modo.

---

# 27. FECHA Y HORA

Guardar fecha/hora real de forma consistente.

La mejora nace de un problema detectado al abrir partidos viejos: hoy puede verse quién ganó y el resultado, pero no cuándo se jugó.

Aplicar metadata a Resumen y Análisis y, si es sencillo sin regresiones, también a partidos del modo Completo.

---

# 28. MODO COMPLETO — NO REGRESIONES

V13 agrega un modo; no debe romper el existente.

Probar que siguen funcionando:

- scoring punto por punto;
- Ajustar;
- progresión;
- Highlights;
- Editar;
- corrección de sacador;
- TB reglamentario;
- Resolver con TB extraordinario;
- Resumen;
- Análisis;
- Intelligence;
- Evolución;
- Historial.

---

# 29. PRUEBAS OBLIGATORIAS

## Caso A — Clásico normal

Modo Por Games.

Registrar partido 6-3 · 6-4.

Verificar sets, games, rotación, holds, breaks, resumen e Intelligence.

## Caso B — Break

Saca Equipo A.

Gana Equipo B.

Debe registrar Break B automáticamente.

## Caso C — Hold

Saca Equipo A.

Gana Equipo A.

Debe registrar Hold A.

## Caso D — Game para el set

Score 5-3.

Mostrar `GAME PARA EL SET`.

No mostrar Set Point.

## Caso E — Game para el partido

Equipo A ya ganó Set 1.

Set 2 en 5-4.

Mostrar `GAME PARA EL PARTIDO`.

## Caso F — TB reglamentario con score conocido

Clásico 6-6.

Equipo B gana TB 7-4.

Set final 6-7.

Guardar además detalle interno del TB.

## Caso G — TB reglamentario sin score interno

Clásico 6-6.

Equipo A gana TB.

Usuario omite score interno.

Set final 7-6.

No inventar score del TB.

## Caso H — Americano

Llegar a 5-5.

Equipo B gana TB.

Resultado final 5-6.

Score interno opcional.

## Caso I — Deshacer

3-3 → registrar game erróneo para B → 3-4 → DESHACER → 3-3.

Revertir también rotación/stats/Evolución.

## Caso J — Corrección manual

3-2 → EDITAR → 4-3.

Verificar:

- score correcto;
- games totales seguros;
- no inventar orden;
- no inventar holds/breaks;
- no inventar racha;
- métricas afectadas parciales;
- Evolución llega a 4-3 con tramo parcial.

## Caso K — Editar jugador

Iniciar con `Jugador 4`.

Registrar varios games.

Editar a `Marcos`.

Verificar marcador, Resumen, Análisis, Intelligence, Historial y eventos anteriores con `Marcos`.

## Caso L — Persistencia

Registrar games → salir → volver → bloquear → volver → usar otra app → volver.

Conservar todo exactamente.

## Caso M — Highlight

Registrar Highlight en Set 2 · 4-4.

Guardar timestamp, set, game score, categoría y contexto disponible.

No inventar puntos.

## Caso N — TB extraordinario en modo Games

Score 4-4.

`RESOLVER CON TIE BREAK`.

Ganador obligatorio.

Score interno opcional.

Cerrar partido y representar TB honestamente.

---

# 30. PRUEBA REAL DE PRODUCTO

V13 existe para probarse en una situación de cancha real y distraída.

Preguntas principales:

1. ¿Pude seguir el partido sin sentir que estaba trabajando?
2. ¿Con qué frecuencia perdí games o tuve que corregir?
3. ¿Pude salir del celular/app y volver sin perder el hilo?
4. ¿Highlight apareció naturalmente o siguió siendo una carga?
5. ¿El Resumen fue suficientemente interesante?
6. ¿BRAMU Intelligence contó una historia útil aun sin puntos?
7. ¿La menor carga de registro compensa la pérdida de estadísticas?

No optimizar el producto antes de tener esta respuesta real.

---

# 31. NO IMPLEMENTAR EN V13

No agregar ahora:

- registro solo por sets;
- cambio de modo durante el partido;
- mezcla de puntos y games;
- perfiles;
- ranking;
- red social;
- monetización;
- BRAMU Intelligence “Contame más”;
- Intelligence en vivo;
- tagging profesional;
- estadísticas de golpes;
- rama broadcast/Scout;
- rediseño completo de Evolución;
- rediseño profundo de progresión;
- overhaul de Compartir.

---

# 32. NO TOCAR SIN NECESIDAD

Partir de V12.2.

Mantener:

- lógica reglamentaria existente;
- motor de scoring Completo;
- narrativa del modo Completo;
- Resolución extraordinaria V12.2;
- bug conocido `scoreAfter` salvo necesidad real;
- estilos aprobados;
- Historial existente;
- assets;
- flujo de versionado/cache actual.

Agregar `POR GAMES` de manera encapsulada para minimizar regresiones.

---

# 33. CRITERIOS DE CIERRE DE V13

V13 queda lista para prueba real cuando:

1. se puede elegir Completo / Por Games desde Home;
2. recuerda última selección;
3. el modo queda bloqueado al empezar;
4. un toque registra un game;
5. rotación de saque funciona;
6. hold/break se calculan automáticamente;
7. Game para el Set/Partido usa lenguaje correcto;
8. Deshacer revierte game y consecuencias;
9. Highlight funciona con contexto de games;
10. Editar permite corrección rápida;
11. las correcciones no inventan secuencias;
12. Editar jugadores funciona retroactivamente;
13. TB reglamentario pregunta ganador;
14. resultado interno del TB es opcional;
15. score reglamentario del set queda correcto aunque se omita el score interno;
16. Americano funciona;
17. TB extraordinario se adapta al modo relajado;
18. Resumen muestra métricas de games;
19. Análisis usa métricas de games;
20. Intelligence no usa datos de puntos inexistentes;
21. Evolución funciona game por game;
22. Historial identifica el modo;
23. fecha/hora/contexto aparecen al abrir partidos;
24. salir y volver no pierde el partido;
25. modo Completo no sufre regresiones.

---

# 34. ENTREGA ESPERADA DE CLAUDE CODE

Antes de implementar:

1. leer este Consolidado completo;
2. revisar el estado real de V12.2;
3. identificar qué mecanismos existentes pueden reutilizarse;
4. evitar duplicar engine/scoring si puede agregarse una capa de registro por games;
5. presentar plan de implementación;
6. señalar contradicciones reales antes de programar.

Durante la implementación:

- trabajar por bloques;
- escribir tests junto a la lógica de riesgo;
- no esperar al final para probar TB, edición y persistencia.

Al cerrar:

1. correr regresión completa;
2. agregar tests específicos de Por Games;
3. prueba manual desktop/tablet/celular;
4. verificar persistencia real al salir/volver;
5. actualizar versión/cache;
6. commit;
7. push;
8. tag;
9. confirmar GitHub Pages;
10. entregar reporte para Sebastián/ChatGPT con:
   - qué se implementó;
   - qué se reutilizó;
   - decisiones técnicas;
   - diferencias respecto del Consolidado;
   - bugs encontrados;
   - tests finales y resultado;
   - puntos recomendados para probar en cancha.

---

# PRINCIPIO FINAL

El éxito de `POR GAMES · BETA` no se mide por cuántas estadísticas conserva.

Se mide por si logra este equilibrio:

> **registrar casi sin esfuerzo y aun así recibir algo interesante al final.**

Si una estadística requiere inventar información que el usuario no registró:

**no existe.**

Si una conclusión puede derivarse honestamente de games, servicio, score, tiempo y secuencia:

**BRAMU debe aprovecharla al máximo.**

V13 es una prueba de producto, no una expansión por cantidad de funciones.
