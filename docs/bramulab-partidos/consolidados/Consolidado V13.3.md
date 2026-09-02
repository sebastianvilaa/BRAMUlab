# BRAMU — Consolidado V13.3

## OBJETIVO

Base actual: **V13.2**.

V13.3 debe cerrar la arquitectura narrativa de **BRAMU Intelligence** y corregir dos problemas detectados durante las simulaciones:

1. estadísticas por set que no respetan correctamente quién comenzó sacando ese set;
2. Timeline de Por Games que reutiliza la arquitectura visual de Completo y termina mostrando puntos ficticios.

Además, se incorpora una mejora de UX para poder **corregir el sistema de puntuación durante un partido** sin reescribir el pasado ni agregar fricción innecesaria.

Esta versión NO abre perfiles, backend, torneos, Pro ni carga de partidos históricos.

---

# 1. REHACER / MEJORAR — ARQUITECTURA NARRATIVA DE BRAMU INTELLIGENCE

## Principio

La mejora NO consiste en sumar sinónimos o más plantillas.

BRAMU Intelligence debe intentar responder:

> **¿Qué fue lo más importante que pasó en este partido y en cada set?**

Arquitectura conceptual:

**DATOS → HECHOS → EVENTOS → JERARQUÍA → RELACIONES → HISTORIA → EVIDENCIA ESTADÍSTICA → REDACCIÓN**

La redacción viene después de haber decidido correctamente qué hechos merecen ser contados.

---

## 1.1 Aplicar a ambos modos

Esta arquitectura debe ser compartida por:

- **Modo Completo**
- **Por Games**

La diferencia es únicamente la cantidad de evidencia disponible.

### Por Games puede usar

- resultado;
- score por set;
- secuencia real de games;
- holds;
- breaks;
- quién comenzó sacando cada set;
- rachas de games;
- ventajas máximas;
- desventajas remontadas;
- igualdades;
- 5-5;
- Tie Break;
- cierres con break;
- cambios de dominio;
- stats por set/partido.

### Completo además puede usar

- secuencia punto a punto;
- Break Points;
- Match Points;
- puntos decisivos;
- holds bajo presión;
- puntos salvados;
- Star Point / Punto de Oro / Ventaja;
- cualquier hecho ya validado por el motor Completo.

No inventar datos individuales si no existen.

---

# 2. HECHOS CANDIDATOS Y JERARQUÍA

Antes de redactar cada set, detectar todos los hechos candidatos.

Ejemplos:

- remontada real;
- ventaja perdida;
- racha fuerte;
- igualdad prolongada;
- primera ruptura del partido;
- break decisivo;
- break para cerrar set;
- break para cerrar partido;
- break + confirmación;
- reacción después de perder un set;
- set dominado desde temprano;
- diferencia que aparece tarde;
- 5-5;
- Tie Break;
- cambio de líder;
- cierre de varios games consecutivos;
- set decisivo;
- diferencia entre la historia de un set y el siguiente.

Luego jerarquizarlos.

## Regla

Un hecho fuerte debe ganar frente a uno genérico.

Ejemplo:

`1-3 → 6-3` con 5 games consecutivos

debe tener prioridad sobre:

`3-3 → 6-3`.

El 3-3 puede ser verdadero, pero no es la historia principal.

---

# 3. VALIDACIÓN DURA DE EVENTOS

Cualquier frase que utilice relaciones temporales debe coincidir exactamente con la secuencia registrada.

Frases como:

- “desde ahí”;
- “a partir del 4-4”;
- “encadenaron 5 games”;
- “ganaron los últimos 3”;
- “confirmaron el quiebre”;

deben estar matemáticamente respaldadas por los eventos reales.

No permitir contradicciones como:

> “Se mantuvieron hasta 4-4 y desde ahí ganaron 5 games para cerrar 6-4.”

Si una racha fue `1-4 → 6-4`, el origen de la racha es 1-4.

La redacción deportiva puede ser flexible.

La cronología factual no.

---

# 4. HISTORIA POR SET, NO PLANTILLA POR SET

Mantener la idea de analizar cronológicamente cada set, pero sin obligar a que todos tengan el mismo peso o longitud.

Un set puede necesitar:

- una frase;
- un párrafo;
- más desarrollo si contiene la historia principal.

El set decisivo, una remontada, un TB o un cambio fuerte de dominio pueden recibir más espacio.

No imponer simetría artificial entre sets.

---

# 5. PRESENTACIÓN → CAMBIO → DESENLACE

Cuando haya suficiente información, cada set puede construirse como una pequeña crónica:

1. **cómo comenzó / qué equilibrio existía;**
2. **qué cambió;**
3. **cómo terminó.**

No es obligatorio usar siempre estas tres etapas, pero sirve como guía narrativa.

Ejemplo válido:

> El partido arrancó muy parejo y ninguno logró quebrar durante los primeros nueve games. Con 5-4, Seba y Matu consiguieron la primera ruptura y cerraron el set 6-4.

Ejemplo de remontada:

> Gusti y Esteban se pusieron 3-1 en el segundo, pero desde ahí Seba y Matu ganaron cinco games consecutivos, dieron vuelta el parcial y cerraron el partido 6-3.

---

# 6. CONTAR TAMBIÉN AL EQUIPO QUE PIERDE CUANDO APORTA HISTORIA

No narrar siempre únicamente lo que hizo el ganador.

Si el equipo perdedor:

- se puso 4-1;
- reaccionó;
- cortó una racha;
- llevó el set a 5-5;
- obligó a un TB;
- recuperó un break;
- tomó una ventaja relevante;

ese hecho puede formar parte de la historia aunque luego pierda.

Ejemplo:

> Seba y Matu se pusieron 3-0. Gusti y Esteban cortaron la primera racha manteniendo su saque para el 3-1, pero no alcanzó: Seba y Matu ganaron los tres games siguientes y cerraron 6-1.

No narrar games irrelevantes por obligación.

---

# 7. RELACIONES ENTRE SETS

BRAMU debe intentar relacionar los sets cuando exista evidencia.

Relaciones posibles:

- respuesta después de perder un set;
- revancha inmediata;
- mismo patrón;
- patrón diferente;
- diferencia que aparece antes;
- diferencia que aparece después;
- aumento/disminución del dominio;
- tercer set más equilibrado;
- cambio completo de historia.

## Importante

No decir “siguió un patrón parecido” solo porque el mismo equipo ganó ambos sets.

La **forma del set** tiene que ser realmente parecida.

Ejemplo:

- Set 1: igualdad hasta 4-4 + cierre 2 games.
- Set 2: 1-3 abajo + racha de 5.

Los resultados pueden ser parecidos.

Las historias NO.

---

# 8. VOZ DEPORTIVA: INTERPRETACIÓN SEGURA

BRAMU puede sonar más como una crónica deportiva y menos como una planilla.

Permitido, si los datos lo respaldan:

- “el partido arrancó parejo”;
- “reaccionaron”;
- “tomaron la primera ventaja”;
- “cambiaron la tendencia”;
- “abrieron una diferencia”;
- “forzaron un tercer set”;
- “estiraron el partido”;
- “cerraron con mayor margen”;
- “el segundo tuvo otra historia”;
- “la diferencia apareció antes”;
- “el quiebre abrió el set”;
- “confirmaron el break”;
- “cortaron la racha”.

Evitar psicología no medida:

- “se pusieron nerviosos”;
- “ganaron confianza”;
- “sintieron el golpe”;
- “se soltaron”;
- “demostraron experiencia”;
- “supieron manejar la presión”.

Regla:

**interpretación deportiva sí; estados mentales inventados no.**

---

# 9. ESTADÍSTICAS COMO EVIDENCIA, NO INVENTARIO

Las estadísticas ya aparecen visualmente debajo.

Intelligence no debe repetirlas como una lista.

Usarlas solo si:

- refuerzan una conclusión;
- explican una diferencia;
- agregan algo que la cronología sola no muestra.

Ejemplo:

> La diferencia también apareció con el saque: Seba y Matu sostuvieron el 90% de sus games de servicio, frente al 67% de Gusti y Esteban.

O:

> El margen final también se reflejó en los quiebres: 5 contra 2.

No agregar un tercer párrafo estadístico si el partido ya quedó suficientemente explicado.

---

# 10. BENCHMARK NARRATIVO A — 6-4 · 6-3

## Secuencia controlada

### Set 1
Llegar 4-4.

Luego A gana:
- 5-4;
- 6-4.

Hecho principal:
- igualdad hasta 4-4;
- dos games finales;
- si la secuencia de saque lo confirma, primer break del partido / break para cerrar.

### Set 2
A:
- 1-0.

B:
- 1-1;
- 1-2;
- 1-3.

A gana cinco consecutivos:
- 2-3;
- 3-3;
- 4-3;
- 5-3;
- 6-3.

Hecho principal:
- B estuvo 3-1 arriba;
- A reaccionó;
- A ganó 5 games consecutivos;
- remontó el set;
- cerró el partido.

## Esperado

NO:

> “Llegaron 3-3 y después se despegaron.”

Sí capturar la remontada `1-3 → 6-3`.

No decir que ambos sets tuvieron un patrón parecido.

---

# 11. BENCHMARK NARRATIVO B — 4-6 · 6-1 · 6-3

Parejas:

**Seba / Matu vs Gusti / Esteban**

## Set 1

Seba/Matu llegan a estar:
**4-1**

Luego Gusti/Esteban ganan:
**5 games consecutivos**

y cierran:
**6-4**

Hecho principal:
- A arrancó mejor;
- B reaccionó desde 1-4;
- B ganó cinco seguidos;
- dio vuelta el set.

## Set 2

Seba/Matu:
**3-0**

Gusti/Esteban:
**3-1**

Seba/Matu:
**4-1 → 5-1 → 6-1**

Hechos:
- respuesta fuerte después de perder el primero;
- 3-0 temprano;
- B corta la racha para 3-1;
- A no permite una remontada;
- 6-1;
- fuerza tercer set.

Si stats reales lo respaldan:
- A mantuvo todos sus games de saque;
- consiguió dos breaks.

## Set 3

Llega:
**2-2**

A consigue break:
**3-2**

A confirma:
**4-2**

B:
**4-3**

A:
**5-3**

A vuelve a quebrar:
**6-3**

Hechos:
- equilibrio hasta 2-2;
- break abre diferencia;
- break confirmado;
- ventaja conservada;
- break final para cerrar partido.

## Lectura orientativa

No copiar como plantilla, pero la Intelligence debería acercarse conceptualmente a:

> Seba y Matu arrancaron mejor y llegaron a estar 4-1 en el primer set. Gusti y Esteban reaccionaron desde ahí, ganaron cinco games consecutivos y dieron vuelta el parcial para llevárselo 6-4.

> La respuesta llegó enseguida. Seba y Matu tomaron una ventaja de 3-0 en el segundo. Gusti y Esteban cortaron la primera racha para el 3-1, pero no alcanzó: Seba y Matu ganaron los tres siguientes y cerraron un contundente 6-1 para llevar el partido al tercero.

> El decisivo se mantuvo equilibrado hasta el 2-2. Ahí Seba y Matu consiguieron el quiebre que abrió la primera diferencia, lo confirmaron para ponerse 4-2 y conservaron la ventaja. Con 5-3 volvieron a quebrar y cerraron el partido 6-3.

---

# 12. CORREGIR — ESTADÍSTICAS POR SET Y SACADOR INICIAL

## Bug detectado

En el partido benchmark:

**4-6 · 6-1 · 6-3**

La vista `PARTIDO` muestra correctamente:

- Games: 16-10
- Games de saque ganados: 11/13 vs 8/13
- Breaks: 5 vs 2

Pero Set 3 mostraba incorrectamente:

- Games de saque ganados: 2/5 vs 0/4
- Breaks: 4 vs 3

La suma de stats por set no coincide con el total del partido.

## Causa probable

La vista por set parece reconstruir el servicio asumiendo un sacador/equipo inicial incorrecto, en lugar de respetar quién comenzó sacando realmente ese set.

BRAMU ya pregunta quién saca al comenzar cada set.

Ese dato debe ser la fuente de verdad.

## Regla de arquitectura

Cada game debe conservar la identidad/equipo que estaba sacando en ese momento.

Las vistas:

- SET 1;
- SET 2;
- SET 3;
- PARTIDO;

deben agregar los mismos eventos base.

No reconstruir de forma independiente con supuestos diferentes.

## Invariantes obligatorios

Para todo partido:

**Breaks Set1 + Set2 + Set3 = Breaks Partido**

**Holds Set1 + Set2 + Set3 = Holds Partido**

**Games Set1 + Set2 + Set3 = Games Partido**

Los denominadores de `games de saque` también deben sumar correctamente.

Agregar tests que fallen si estas identidades no se cumplen.

---

# 13. CORREGIR — TIMELINE POR GAMES

## Problema

El Timeline de un partido registrado Por Games reutiliza actualmente la presentación de Modo Completo.

Eso produce visualizaciones como:

`0-0 → 15-0 → 15-15 → 30-15...`

aunque esos puntos jamás fueron registrados.

No es solamente un problema visual.

Está presentando información ficticia.

## Mantener arquitectura de datos si sirve

Se puede reutilizar infraestructura interna si resulta útil.

Pero la visualización debe respetar el nivel de datos disponible.

## Timeline Completo

Mantener:

**Set → Game → puntos reales registrados**

## Timeline Por Games

Debe mostrar:

**Set → Game 1 → Game 2 → Game 3...**

Para cada game mostrar, según disponibilidad:

- número de game;
- ganador;
- marcador después del game;
- equipo/jugador al saque si se conoce;
- HOLD o BREAK;
- hora/minuto si ya existe;
- Highlight asociado si corresponde.

Ejemplo:

**Game 5 · 4-1**  
Seba / Matu  
Saca: Gusti  
BREAK

No mostrar:

- 15;
- 30;
- 40;
- Deuce;
- ventajas;

porque no fueron registrados.

## Datos parciales

Si un tramo fue corregido manualmente y no se conoce la secuencia:

marcarlo como parcial/desconocido.

No inventar games intermedios.

---

# 14. MEJORAR — CAMBIAR SISTEMA DE PUNTUACIÓN DURANTE EL PARTIDO

## Contexto real

En un torneo se puede comenzar a registrar suponiendo Punto de Oro y descubrir más adelante que el partido se está jugando:

- Con Ventaja;
- Star Point.

No queremos rehacer el partido ni añadir popups invasivos.

---

# 15. CONFIGURACIÓN INICIAL

Mantener:

**PUNTO DE ORO seleccionado por defecto**

en ambos modos.

No cambiar este comportamiento.

El usuario que conoce el sistema puede elegir:

- STAR POINT;
- PUNTO DE ORO;
- CON VENTAJA;

antes de iniciar.

---

# 16. POR GAMES — SISTEMA DE PUNTUACIÓN COMO METADATA

En Por Games, el sistema no altera la lógica del marcador.

Por lo tanto:

desde el menú `☰` agregar:

**SISTEMA DE PUNTUACIÓN**

Al tocar:

abrir el mismo selector visual de la configuración inicial:

### STAR POINT
2 ventajas y luego punto decisivo

### PUNTO DE ORO
Punto decisivo en 40-40

### CON VENTAJA
Deuce y ventaja

Se puede cambiar durante cualquier momento del partido.

Solo cambia metadata.

No recalcular games, stats ni eventos.

---

# 17. COMPLETO — CAMBIO DESDE MENÚ EN ESTADOS NORMALES

En estados normales:

- 0-0;
- 15-15;
- 30-15;
- 40-30;
- etc.

NO mostrar botones extras en la cancha.

El sistema puede modificarse desde:

`☰ → SISTEMA DE PUNTUACIÓN`

mientras el cambio todavía sea seguro.

---

# 18. COMPLETO — ACCIÓN CONTEXTUAL EN ESTADOS DONDE IMPORTA

Cuando el game entra en un estado donde el sistema de puntuación se vuelve relevante:

- Punto de Oro;
- Deuce;
- Ventaja;
- Deuce 2 / estado equivalente Star;

mostrar en la barra contextual del estado actual:

**CAMBIAR**

Ubicación:
al lado del texto que ya indica:

- PUNTO DE ORO;
- DEUCE;
- VENTAJA;
- etc.

Usar **CAMBIAR**, no `EDITAR`.

La acción es cambiar el sistema, no editar el score.

## Al tocar CAMBIAR

Abrir popup con los mismos tres botones/globitos que existen en configuración:

- STAR POINT;
- PUNTO DE ORO;
- CON VENTAJA.

Mantener estética y explicación existentes.

No inventar un cuarto selector.

---

# 19. REGLA DE SEGURIDAD DEL CAMBIO

Se puede cambiar el sistema solamente mientras el estado real registrado todavía sea compatible con el sistema nuevo.

Principio:

> **Permitir corregir mientras todavía no se haya generado una consecuencia irreversible con la regla actual.**

Ejemplo:

Si estamos en 40-40 bajo Punto de Oro:

se puede tocar `CAMBIAR` antes de registrar el punto decisivo.

Una vez que BRAMU utilizó ese punto para cerrar el game:

no transformar retrospectivamente ese game en Star/Ventaja.

Si el usuario se equivocó después:

usar las herramientas existentes de corrección del marcador.

No construir un traductor retrospectivo entre sistemas.

## Star Point vs Con Ventaja

Mientras ambas reglas compartan el mismo estado registrado:

permitir cambiar entre ellas.

Cuando la secuencia ya haya divergido y el game se haya resuelto bajo una regla concreta:

bloquear el cambio para ese pasado.

Mantener la lógica simple y segura.

---

# 20. NO TOCAR

No abrir en V13.3:

- Cargar partido ya jugado;
- perfiles;
- usuarios;
- contraseñas;
- backend;
- BRAMU Torneos;
- BRAMU Pro;
- ranking;
- grupos;
- compartir;
- nuevo rediseño general;
- modo Sets;
- monetización.

No modificar comportamiento aprobado de:

- Wake Lock;
- actualización automática V13.2;
- Editar jugadores V13.2;
- engine de scoring salvo lo estrictamente necesario para permitir cambio seguro de sistema;
- TB normal;
- TB extraordinario;
- Ajustar;
- Editar;
- Deshacer;
- Highlights.

---

# 21. PRUEBAS OBLIGATORIAS

## A — Intelligence 6-4 · 6-3

Usar la secuencia benchmark.

Validar:

- 4-4 → 6-4 = 2 games;
- 1-3 → 6-3 = 5 games;
- detectar remontada;
- no llamar “patrón parecido” a historias distintas;
- no inventar psicología.

## B — Intelligence 4-6 · 6-1 · 6-3

Validar:

- 4-1 → 4-6 como remontada de B;
- segundo set 3-0 → 3-1 → 6-1;
- tercer set 2-2 → break → confirmación → break final;
- párrafos con peso distinto según la riqueza de cada set;
- relación entre sets;
- estadísticas solo si aportan.

## C — Completo mantiene profundidad

Usar al menos un partido Completo existente de regresión.

Validar que la nueva arquitectura:

- no elimine hechos de break points;
- no elimine Match Points;
- no elimine holds bajo presión;
- no degrade cronología;
- no invente hechos.

La capa narrativa común debe poder usar evidencia adicional de Completo.

## D — Stats por set

Partido 3 sets con distintos equipos comenzando el saque.

Validar:

- holds;
- breaks;
- denominadores de saque;
- suma de sets = partido.

## E — Timeline Por Games

Registrar partido Por Games.

Esperado:

- Game 1, Game 2, Game 3...
- marcador real después de cada game;
- ganador;
- servicio/HOLD/BREAK si conocido.

Nunca:

- 15;
- 30;
- 40;
- Deuce ficticio.

## F — Cambiar sistema Por Games

Iniciar con Punto de Oro.

A mitad del partido:

`☰ → SISTEMA DE PUNTUACIÓN → STAR POINT`

Esperado:

- score intacto;
- stats intactas;
- eventos intactos;
- metadata actualizada.

## G — Cambiar sistema Completo antes de divergencia

Iniciar Punto de Oro.

Llegar 40-40 sin registrar el siguiente punto.

Debe aparecer:

**CAMBIAR**

Cambiar a Con Ventaja.

Esperado:

- mismo score;
- continúa correctamente como Deuce/Ventaja;
- no se pierde información.

## H — Cambio desde menú

Durante 30-15:

`☰ → SISTEMA DE PUNTUACIÓN`

Cambiar sistema.

Esperado:

- score intacto;
- engine usa nueva regla cuando sea necesaria.

## I — Bloqueo después de consecuencia irreversible

Cerrar un game usando Punto de Oro.

No permitir que un cambio posterior reinterprete silenciosamente ese game como Star/Ventaja.

El pasado queda intacto.

---

# 22. REGRESIÓN

Correr suite completa.

Mantener verdes V12, V13, V13.1 y V13.2.

Agregar tests para:

- jerarquización narrativa;
- validación de rachas;
- relación entre sets;
- stats por set;
- Timeline Games;
- cambio de sistema;
- preservación de score al cambiar metadata;
- bloqueo seguro después de divergencia.

---

# 23. ENTREGA

Implementar como:

**V13.3**

Al terminar:

1. correr regresión completa;
2. prueba manual;
3. commit;
4. push;
5. tag `v13.3`;
6. confirmar GitHub Pages;
7. entregar reporte para Sebastián/ChatGPT.

El reporte debe explicar:

- qué cambió en la arquitectura de BRAMU Intelligence;
- cómo prioriza hechos;
- cómo evita contradicciones de rachas;
- causa del bug de stats por set;
- cómo quedó Timeline Por Games;
- cómo funciona `Sistema de puntuación`;
- cuándo aparece `CAMBIAR`;
- cuándo se bloquea el cambio;
- tests finales.

---

# PRINCIPIO FINAL

V13.3 debe acercar BRAMU Intelligence a esta sensación:

> **“Alguien vio mi partido y me contó qué pasó.”**

No:

> **“Una plantilla leyó el resultado.”**

La creatividad narrativa nunca puede estar por encima de la verdad de los datos.
