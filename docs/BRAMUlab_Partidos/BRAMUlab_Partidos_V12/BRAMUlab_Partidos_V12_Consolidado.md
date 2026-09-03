# BRAMU Lab — Consolidado V12

## PROPÓSITO DEL DOCUMENTO

Este documento define el alcance cerrado de **BRAMU Lab V12**.

Base actual: **V11.16**.

V12 nace directamente de la primera prueba real en cancha. El objetivo NO es agregar un nuevo modo de registro ni expandir funcionalidades sociales. El objetivo es hacer que el registro completo punto por punto se comporte correctamente frente a situaciones normales del uso amateur real:

- distracciones;
- necesidad de recuperar rápidamente el tanteador;
- errores de sacador;
- decisiones informales de los jugadores;
- definiciones extraordinarias por Tie break;
- necesidad de feedback visual claro.

### Principio de V12

> **Hacer que el registro completo sobreviva a una cancha real sin obligar al usuario a falsear datos.**

La app debe adaptarse a lo que realmente ocurrió.

Nunca fabricar puntos, games, breaks, holds o secuencias para hacer encajar el partido dentro de una estructura reglamentaria que no sucedió.

---

# 1. DECISIONES CONFIRMADAS

## 1.1 Mantener el registro completo actual

V12 sigue trabajando sobre el modo actual:

**registro punto por punto / máximo detalle.**

NO agregar todavía:

- registro por games;
- registro solo por sets;
- perfiles;
- ranking;
- BRAMU Intelligence “Contame más”;
- BRAMU Intelligence en vivo;
- funciones profesionales de tagging.

Esas líneas quedan fuera de alcance de V12.

---

# 2. AGREGAR — AJUSTAR MARCADOR

## 2.1 Problema real detectado

Durante un partido real, el usuario puede distraerse.

Ejemplo:

- el tanteador estaba 15-0;
- el usuario deja de mirar unos segundos;
- escucha que ahora van 40-30;
- hoy puede tocar varias veces los botones hasta alcanzar visualmente 40-30.

El resultado visible termina correcto, pero la secuencia interna queda contaminada porque la app interpreta un orden de puntos que puede no haber ocurrido.

Eso puede fabricar falsamente:

- Break Points;
- rachas;
- presión;
- secuencias;
- momentos decisivos;
- hechos usados por BRAMU Intelligence.

Esto debe evitarse.

---

## 2.2 Nueva acción rápida

AGREGAR una acción:

**AJUSTAR**

Debe convivir con las herramientas actuales.

Conceptualmente, la fila de herramientas pasa a contener:

**DESHACER · AJUSTAR · HIGHLIGHT · EDITAR**

No eliminar ni reemplazar `EDITAR`.

### Diferencia conceptual

**EDITAR**
= corregir eventos ya registrados / trabajar sobre el historial existente.

**AJUSTAR**
= “me perdí parte del game; conozco el tanteador actual pero no necesariamente la secuencia que llevó hasta ahí”.

---

## 2.3 UX de Ajustar

Al tocar `AJUSTAR`, abrir un popup compacto sobre el marcador.

Ejemplo para Punto de Oro:

### Equipo A
`0 · 15 · 30 · 40`

### Equipo B
`0 · 15 · 30 · 40`

El usuario selecciona un valor para cada equipo.

Luego confirma y vuelve inmediatamente al partido.

### Feedback visual

Cuando se selecciona un valor:

- debe quedar visualmente marcado;
- usar preferentemente el color correspondiente al equipo;
- no confundir este feedback con el verde semántico de confirmación de otras acciones.

El usuario debe entender instantáneamente qué valor seleccionó para cada pareja.

---

## 2.4 Punto de Oro

Si el usuario selecciona:

**40-40**

en un partido con Punto de Oro:

la app debe entrar correctamente en estado de:

**PUNTO DE ORO**

No pedir una acción adicional.

---

## 2.5 Con Ventaja

El popup de Ajustar debe contemplar estados que no pueden expresarse únicamente mediante 0/15/30/40.

Debe permitir seleccionar correctamente:

- DEUCE;
- VENTAJA EQUIPO A;
- VENTAJA EQUIPO B.

No diseñar Ajustar únicamente para Punto de Oro.

---

## 2.6 Star Point

El popup debe contemplar los estados reales del sistema Star Point implementado en BRAMU.

Debe ser posible ajustar al estado correspondiente de:

- DEUCE 1;
- 1ª VENTAJA A/B;
- DEUCE 2;
- 2ª VENTAJA A/B;
- STAR POINT.

Usar exactamente la lógica real del motor actual.

No crear estados paralelos.

---

# 3. DATOS PARCIALES — NO INVENTAR SECUENCIAS

## 3.1 Regla fundamental

Cuando el usuario usa `AJUSTAR`, BRAMU conoce el nuevo estado del marcador.

Puede NO conocer el orden exacto de los puntos intermedios.

Ejemplo:

`15-0 → AJUSTAR → 40-30`

Sabemos que el score actual es 40-30.

No necesariamente sabemos en qué orden se jugaron los puntos omitidos.

### NO FABRICAR

No fabricar a partir del tramo desconocido:

- Break Points;
- Set Points;
- Match Points;
- Puntos de Oro intermedios;
- Star Points intermedios;
- rachas;
- cambios de dominio;
- secuencias;
- hechos para Momentos Clave;
- hechos para BRAMU Intelligence;
- progresión punto a punto falsa.

---

## 3.2 Conservar lo que sí sea demostrable

No descartar toda la información solo porque existe un tramo parcial.

Si matemáticamente puede saberse con certeza un dato, conservarlo.

Ejemplo:

si el cambio de score permite saber cuántos puntos adicionales ganó cada equipo sin ambigüedad, esos totales pueden mantenerse.

Si el sistema de puntuación genera ambigüedad —por ejemplo Deuce/Ventaja repetidos no registrados—:

NO inventar el número de puntos.

Marcar la métrica correspondiente como parcial.

---

## 3.3 Datos parciales

Cuando una estadística quede afectada por uno o más Ajustes manuales, permitir indicar de forma discreta:

**Datos parciales por ajuste manual**

No llenar toda la pantalla de advertencias.

Aplicar la indicación solamente a métricas realmente afectadas.

---

# 4. AGREGAR — PROGRESIÓN DEL GAME

## 4.1 Objetivo

Mostrar visualmente la progresión reciente del game.

Sirve para:

- entender rápidamente quién viene ganando puntos consecutivos;
- recordar cómo se desarrolló el game;
- funcionar como control de carga;
- detectar posibles errores mientras se anota.

---

## 4.2 Representación

Usar pequeños círculos/puntos.

- Team A → color Team A;
- Team B → color Team B.

Ejemplo conceptual:

`● ● ● ● ●`

No usar texto innecesario.

---

## 4.3 Ubicación

La progresión pertenece a ambos equipos.

Ubicarla en una zona central del marcador, preferentemente:

- centrada;
- por encima o cerca de la zona central del score;
- sin competir con puntos/games/sets;
- suficientemente visible para consulta rápida.

Claude puede resolver el detalle responsive respetando este principio.

---

## 4.4 Ajustes manuales

Si hubo un `AJUSTAR` y se desconoce el orden de un tramo:

NO dibujar puntos coloreados inventados.

Representar esa discontinuidad con:

**un círculo vacío / solo borde**

Ejemplo conceptual:

`● ● ○ ● ●`

El círculo vacío significa:

> existe un tramo corregido cuyo orden exacto no está registrado.

No hace falta mostrar una explicación permanente en el marcador.

---

## 4.5 Games muy largos

Evitar una fila infinita.

Mostrar una cantidad razonable de eventos recientes.

Referencia inicial:

**últimos 10–12 eventos visuales**

si el espacio no permite mostrar todos.

Priorizar los más recientes.

---

# 5. CORREGIR — SACADOR ACTUAL

## 5.1 Problema real

Durante la prueba en cancha se seleccionó por error al jugador que estaba sacando.

La app no ofrecía una forma suficientemente clara de corregirlo.

Un error de sacador contamina:

- puntos al saque;
- puntos al resto;
- estadísticas individuales;
- secuencia futura de servicio.

Debe poder corregirse inmediatamente.

---

## 5.2 UX recomendada

No agregar otro botón grande a la fila de herramientas.

Hacer interactivo el indicador de saque ya existente.

Preferencia:

**tocar la pelota / indicador del sacador actual / nombre directamente asociado al saque.**

Al tocar:

### ¿Quién está sacando?

Mostrar los cuatro jugadores.

Elegir el correcto.

---

## 5.3 Si ya existen puntos en el game

Si se cambia el sacador con puntos ya registrados en el game:

- reasignar esos puntos al sacador correcto cuando corresponda;
- recalcular correctamente las estadísticas afectadas;
- recalcular la rotación futura a partir del sacador corregido.

Puede mostrarse una confirmación breve:

> Cambiar sacador de este game.  
> Los puntos registrados se reasignarán al sacador correcto.

No tocar automáticamente sacadores de games anteriores.

Para correcciones históricas más profundas sigue existiendo `EDITAR`.

---

# 6. AUDITAR — SACADOR INDIVIDUAL VS EQUIPO AL SERVICIO

## 6.1 Regla de datos

Separar claramente:

**A. No sabemos qué jugador individual está sacando.**

de:

**B. No sabemos qué pareja/equipo tiene el servicio.**

Si BRAMU conoce qué equipo está al servicio pero no el jugador individual:

NO descartar métricas válidas de pareja.

Todavía pueden existir, según el caso:

- games de saque del equipo;
- games sostenidos;
- breaks sufridos;
- breaks conseguidos por el rival;
- estadísticas de servicio de pareja;
- secuencias break → hold a nivel de equipos.

Solo deben perderse o marcarse como parciales las métricas que dependan realmente del jugador individual.

Auditar el cálculo actual para evitar descartar datos válidos de equipo.

---

# 7. HEADER DEL PARTIDO

## 7.1 Problema

Durante el uso real faltaba contexto visible de:

- qué formato se estaba jugando;
- qué sistema de puntuación estaba activo;
- la propia marca BRAMU.

También las fotos de cancha deberían identificar claramente qué aplicación se está utilizando.

---

## 7.2 AGREGAR

En la pantalla de partido en vivo, mostrar en una sola línea:

**LOGO / MARCA · FORMATO · SISTEMA DE PUNTUACIÓN · TIEMPO**

Ejemplos conceptuales:

`[BRAMU] · AMERICANO · PUNTO DE ORO · 42:18`

`[BRAMU] · CLÁSICO · STAR POINT · 1:14:32`

---

## 7.3 Responsive

Mantener una sola línea cuando el espacio lo permita.

En celular:

- compactar tamaño;
- reducir gaps;
- abreviar visualmente si es realmente necesario;

pero no eliminar silenciosamente información esencial.

Prioridad:

1. marca;
2. formato;
3. sistema;
4. tiempo.

No debe robar protagonismo al tanteador.

---

# 8. HIGHLIGHT — FEEDBACK + BLOOPER

## 8.1 Feedback de confirmación

Cuando el usuario selecciona una categoría de Highlight:

dar feedback inmediato de que quedó registrada.

Usar un:

**verde semántico de confirmación**

distinto del lima del Team A.

Ejemplo conceptual:

- botón seleccionado cambia temporalmente a verde;
- opcionalmente check breve;
- luego el popup se cierra / vuelve al estado correspondiente.

El objetivo es eliminar la duda:

> “¿Lo toqué bien?”

---

## 8.2 REEMPLAZAR categoría

Reemplazar:

**Dejada**

por:

**Blooper**

Categorías V12:

- Smash / X3
- Recuperación
- Puntazo
- Blooper

### Motivo

En pádel amateur, Blooper representa una categoría frecuente, reconocible y divertida que hoy no existe.

Una dejada destacada puede entrar razonablemente dentro de `Puntazo`.

No ampliar todavía a 6 categorías.

No agregar una quinta o sexta opción en V12.

---

# 9. AGREGAR — RESOLVER CON TIE BREAK

## 9.1 Problema real de cancha

Los partidos amateur suelen estar condicionados por el tiempo de reserva.

Caso real:

- una pareja gana el primer set;
- el segundo llega 5-5;
- se cumple el tiempo;
- los jugadores deciden resolver ese set mediante un Tie break.

Hoy, para poder registrarlo, el usuario tuvo que fabricar games 40-0 hasta llegar falsamente a 6-6.

Eso no puede ser necesario.

BRAMU debe registrar lo que realmente ocurrió.

---

## 9.2 Nueva acción

Mantener `FINALIZAR PARTIDO` tal como existe actualmente.

NO rehacerlo.

Ya permite finalizar en cualquier score e indicar motivo como:

- acuerdo;
- tiempo;
- lesión;
- etc.

AGREGAR una acción paralela:

**RESOLVER CON TIE BREAK**

---

## 9.3 Solo entre games

En V12, `RESOLVER CON TIE BREAK` debe estar disponible únicamente cuando el game actual está:

**0-0**

Es decir:

- terminó el game anterior;
- el siguiente game todavía no comenzó.

No resolver en V12 el caso 30-15 / 40-30 / game incompleto.

En el uso amateur real, si se termina el tiempo durante un game, normalmente se termina ese game antes de decidir una definición extraordinaria.

---

## 9.4 Game pendiente 0-0

Si el score está 5-5 y la app ya preparó visualmente el game 11 en 0-0:

ese game todavía NO fue jugado.

Al seleccionar `RESOLVER CON TIE BREAK`:

- descartar/cancelar ese game vacío pendiente;
- mantener el marcador histórico real en 5-5;
- no sumar un game;
- no sumar un hold;
- no sumar un break;
- no crear puntos;
- no crear eventos falsos;
- iniciar la definición extraordinaria.

Lo mismo si el score real era:

- 2-2;
- 4-3;
- 5-4;
- etc.

No forzar 6-6.

---

# 10. SELECTOR DEL TIE BREAK EXTRAORDINARIO

## 10.1 Opciones iniciales

Al elegir `RESOLVER CON TIE BREAK`, mostrar:

- **Tie break clásico · a 7**
- **Muere en 7**
- **Tie break a 15**
- **Otro**

No es necesario agregar en V12 un preset específico “Súper Tie break a 10” si `Otro` permite configurarlo fácilmente.

---

## 10.2 Opción Otro

Si el usuario selecciona `Otro`:

mostrar:

### Jugar a:
`[ 12 ]`

y seleccionar regla:

- **Diferencia de 2**
- **Muere en 12**

Default:

**Diferencia de 2**

La etiqueta “Muere en X” debe reflejar automáticamente el objetivo seleccionado.

Ejemplo:

si `X = 10`:

**Muere en 10**

---

# 11. SACADOR DEL TIE BREAK EXTRAORDINARIO

Al iniciar un Tie break extraordinario:

NO continuar automáticamente la rotación previa.

Preguntar siempre:

## ¿Quién comienza sacando?

Mostrar los cuatro jugadores.

El usuario elige.

Esto es obligatorio porque la definición extraordinaria puede haber sido acordada informalmente y la rotación previa no necesariamente aplica.

A partir de esa elección:

usar la lógica correcta de rotación de saque de Tie break.

---

# 12. MODIFICAR OBJETIVO DURANTE EL TIE BREAK

## 12.1 Caso realista

Los jugadores pueden empezar un TB con un objetivo y modificarlo durante el juego.

Ejemplo:

- empiezan a 10;
- van 8-0;
- deciden extenderlo a 20.

BRAMU debe permitirlo.

---

## 12.2 UX

Durante un Tie break extraordinario mostrar de forma visible la definición actual.

Ejemplos:

**TB A 10 · +2**

**TB A 15 · MUERE**

Esta etiqueta debe ser interactiva o tener un acceso claro a:

**EDITAR DEFINICIÓN**

---

## 12.3 Restricciones

Permitir aumentar el objetivo.

NO permitir reducir el objetivo a un valor:

- igual al score actual;
- inferior al score actual;
- que implique que el Tie break ya debería haber terminado retroactivamente.

Ejemplo:

si van 8-4:

permitir pasar de 10 a 12 / 15 / 20.

No permitir bajar a 7.

Permitir cambiar entre:

- Diferencia de 2;
- Muere en X;

siempre que la nueva condición no implique un cierre retroactivo incoherente.

Preservar:

- puntos registrados;
- orden;
- sacador;
- timeline;
- estadísticas válidas.

---

# 13. CÓMO GUARDAR EL RESULTADO EXTRAORDINARIO

## 13.1 No falsear games

Si el score normal estaba:

**5-5**

y el TB extraordinario termina:

**10-7**

guardar conceptualmente:

**5-5 · TB 10-7**

NO convertirlo artificialmente en:

- 7-6;
- 6-5;
- otro score de games que no ocurrió.

---

## 13.2 Otro ejemplo

Si estaban:

**4-3**

y resuelven con:

**TB 12-10**

guardar:

**4-3 · TB 12-10**

El ganador del Tie break recibe la definición extraordinaria del set/partido según corresponda, pero el marcador de games queda intacto.

---

# 14. IMPACTO DEL TIE BREAK EXTRAORDINARIO

La definición debe quedar correctamente representada en:

- Resumen;
- Historial;
- Momentos Clave;
- Evolución;
- BRAMU Intelligence;
- estadísticas que puedan calcularse válidamente.

---

## 14.1 BRAMU Intelligence

Debe poder narrar de forma explícita que fue una decisión extraordinaria.

Ejemplo conceptual:

> Con el segundo set 5-5 y el tiempo de cancha cumplido, decidieron resolverlo mediante un Tie break a 10.

Después puede narrar el desarrollo real del TB.

No presentarlo como un Tie break reglamentario a 6-6 si eso no ocurrió.

---

## 14.2 Evolución

NO fabricar games hasta llegar a 6-6.

En la curva:

- conservar el score real previo;
- marcar de forma discreta el inicio de la definición extraordinaria;
- etiqueta sugerida: `TB`;
- continuar la curva con los puntos reales del Tie break.

No rediseñar el motor matemático de Evolución en esta ronda.

---

# 15. PRUEBAS OBLIGATORIAS — AJUSTAR

Agregar tests/regresiones para:

### Caso A
Punto de Oro:

`15-0 → AJUSTAR → 40-30`

Verificar:

- score correcto;
- no fabricar BP;
- no fabricar racha;
- no fabricar secuencia;
- métricas seguras conservadas;
- métricas ambiguas marcadas/parciales.

### Caso B
Punto de Oro:

AJUSTAR directamente a:

`40-40`

Debe activar correctamente:

**PUNTO DE ORO**

### Caso C
Con Ventaja:

Ajustar a:

- DEUCE;
- VENTAJA A;
- VENTAJA B.

### Caso D
Star Point:

Ajustar a estados especiales:

- DEUCE 1;
- ventaja correspondiente;
- DEUCE 2;
- segunda ventaja;
- STAR POINT.

### Caso E
Dos Ajustes manuales dentro del mismo game.

No fabricar secuencias entre ellos.

---

# 16. PRUEBAS OBLIGATORIAS — SACADOR

### Caso F
Cambiar sacador antes del primer punto del game.

### Caso G
Cambiar sacador después de varios puntos.

Verificar:

- reasignación correcta;
- estadísticas individuales;
- estadísticas de equipo;
- rotación futura.

### Caso H
Sacador individual desconocido pero equipo al servicio conocido.

Verificar que no se descarten métricas válidas de pareja.

---

# 17. PRUEBAS OBLIGATORIAS — TIE BREAK EXTRAORDINARIO

### Caso I
Score 5-5, game nuevo 0-0.

Seleccionar:

**RESOLVER CON TIE BREAK**

Verificar:

- sigue existiendo 5-5 como score real;
- no aparece game 11 ficticio;
- no se suma hold/break;
- comienza TB correctamente.

### Caso J
Score 4-3.

Resolver con:

**Otro → a 10 → diferencia de 2**

Verificar resultado:

`4-3 · TB ...`

sin fabricar games.

### Caso K
TB a 10.

Cambiar durante el juego a:

**a 15**

Verificar que se conserven puntos, servicio y timeline.

### Caso L
Van 8-4.

Intentar bajar objetivo a 7.

Debe impedirse.

### Caso M
Elegir nuevo sacador al comenzar el TB extraordinario.

Verificar rotación posterior.

### Caso N
TB extraordinario después de terminar por tiempo / decisión de cancha.

BRAMU Intelligence debe describir correctamente el contexto sin inventar 6-6.

---

# 18. PRUEBAS MANUALES DE UX

Además de tests automáticos, validar manualmente en:

- celular vertical;
- tablet horizontal;
- desktop.

Especialmente:

1. fila `DESHACER · AJUSTAR · HIGHLIGHT · EDITAR`;
2. tamaño táctil;
3. popup de Ajustar;
4. claridad de valores seleccionados;
5. progresión central;
6. cambio de sacador tocando indicador;
7. header en una línea;
8. Highlight Blooper;
9. feedback verde semántico;
10. flujo completo Resolver con Tie break;
11. modificar objetivo durante TB.

Priorizar uso real sobre simetría perfecta del layout.

---

# 19. NO TOCAR EN V12

Salvo regresión real detectada:

- scoring reglamentario existente;
- Clásico;
- Americano;
- Punto de Oro;
- Con Ventaja;
- Star Point;
- Tie breaks normales ya implementados;
- Narrative Planner actual de BRAMU Intelligence;
- composición cronológica V11.14+;
- lógica de paridad;
- hold bajo presión;
- Highlight como evento subjetivo que NO alimenta estadísticas objetivas;
- Historial salvo adaptación necesaria para TB extraordinario;
- fórmula matemática de Evolución;
- responsive aprobado de V11.x;
- Compartir;
- perfiles;
- ranking.

---

# 20. FUTURO / FUERA DE SCOPE

No implementar ahora.

## Registro por Games

Concepto futuro:

**Registro por Games / seguimiento relajado**

para seguir un partido sin estar pendiente de cada punto.

Se diseñará como un modo de registro independiente, no como parche de V12.

---

## Registro por Sets / resultado

Modo todavía más simple para guardar partidos sin detalle game por game.

---

## BRAMU Intelligence — Contame más

Segunda capa opcional para profundizar:

- partido completo;
- set específico;
- momentos decisivos.

---

## BRAMU Intelligence en vivo

Posible función futura:

**¿Cómo viene el partido?**

Debe mostrarse sin abandonar el marcador, probablemente mediante popup/modal.

---

## Perfiles / nivel / ranking

Línea futura de producto social/competitivo.

No iniciar hasta tener suficientemente maduros los diferentes niveles de registro.

---

## Rama profesional / broadcast / scout

Producto potencial separado.

Podría reutilizar la base de BRAMU, agregando tagging profesional:

- smash;
- volea;
- error no forzado;
- winner;
- bandeja;
- etc.

No mezclar este flujo con BRAMU amateur.

---

## Compartir

Pendiente de revisión futura específica.

Dato visual ya detectado:

**la pieza compartida debería incorporar correctamente el logo/marca BRAMU.**

No corregirlo dentro de V12 porque Compartir tiene otros puntos que conviene revisar juntos en una ronda propia.

---

# 21. DEUDA TÉCNICA CONOCIDA — EVOLUCIÓN

Recordatorio para futuras rondas:

Existe un bug preexistente en el campo interno:

`scoreAfter`

cuando el mismo punto que produce un break también cierra el set.

En ese caso límite puede resetearse incorrectamente a `0-0` porque el motor prepara el contador para el set siguiente.

Actualmente V11.16 lo esquiva para la narrativa usando otra fuente de verdad.

V12 NO debe aprovechar `scoreAfter` como fuente confiable en ese caso límite.

No corregir el motor de Evolución salvo que sea necesario para implementar correctamente el TB extraordinario o aparezca una regresión visible.

---

# 22. CRITERIOS DE CALIDAD DE V12

V12 está terminada cuando:

1. el usuario puede recuperar rápidamente un score que perdió de vista sin fabricar secuencias;
2. BRAMU diferencia datos conocidos de datos parciales;
3. un ajuste manual no genera BP/MP/SP/rachas ficticias;
4. puede corregirse el sacador actual de forma intuitiva;
5. las estadísticas de equipo sobreviven cuando siguen siendo válidas;
6. la progresión del game refleja honestamente datos completos y tramos desconocidos;
7. el header muestra marca + formato + sistema + tiempo;
8. Highlight confirma visualmente el registro;
9. Blooper reemplaza Dejada;
10. un partido puede resolverse con un Tie break extraordinario sin falsear games;
11. el TB extraordinario puede tener objetivo personalizado;
12. se pregunta quién comienza sacando;
13. el objetivo puede aumentarse durante el TB sin corromper lo ya registrado;
14. Resumen/Historial/Evolución/Intelligence representan correctamente esa definición;
15. no aparecen regresiones en los sistemas que ya estaban aprobados.

---

# 23. ENTREGA ESPERADA DE CLAUDE CODE

Antes de implementar:

1. leer este Consolidado completo;
2. revisar el estado real del repo V11.16;
3. identificar qué partes ya existen total o parcialmente;
4. NO reescribir funciones que ya resuelven correctamente el problema;
5. devolver un plan breve de implementación;
6. señalar cualquier contradicción técnica real antes de tocar código.

Después:

1. implementar V12 sobre la misma base;
2. agregar tests de regresión;
3. correr la batería completa;
4. probar manualmente los flujos nuevos;
5. verificar celular/tablet/desktop;
6. actualizar versión/caché/footer correspondiente;
7. commit + push + tag;
8. confirmar propagación en GitHub Pages;
9. entregar un reporte para Sebastián/ChatGPT explicando:
   - qué se hizo;
   - qué no se hizo;
   - cualquier decisión técnica diferente al Consolidado;
   - bugs encontrados durante la implementación;
   - cantidad final de tests y resultado.

---

# PRINCIPIO FINAL

V12 no busca agregar espectacularidad.

Busca confiabilidad.

En cancha, el usuario se distrae, se equivoca, corrige, cambia una decisión y juega con reglas acordadas sobre la marcha.

BRAMU debe poder acompañar esa realidad sin transformar una corrección humana en datos falsos.

> **Cuando BRAMU no sabe exactamente qué ocurrió, debe registrar honestamente lo que sí sabe en vez de inventar lo que falta.**
