# BRAMUlab — Experiencia inicial y progresión temprana

**Estado:** consolidado de producto y UX.  
**Fecha:** 17 de septiembre de 2026.  
**Objetivo:** definir cómo se comporta BRAMU desde que un usuario termina su alta y estimador de Nivel hasta que empieza a construir historial real, incluyendo Home Estado Cero, aparición progresiva de módulos, partidos pendientes, validación por parejas e identidades provisionales.

> Este documento no rediseña Nivel BRAMU, Ranking BRAMU ni el roadmap de Backend/Infraestructura. Consolida decisiones de experiencia y explicita los puntos que Backend debe soportar para implementarlas.

---

## 1. Fuentes vigentes revisadas

La revisión de consistencia se realizó contra la documentación actual y antecedentes relevantes:

- `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
- `docs/BRAMUlab/Nivel_BRAMU.md`
- `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
- `docs/BRAMUlab/Ranking_BRAMU.md`
- `docs/BRAMUlab/BRAMU_Intelligence.md`
- `docs/BRAMUlab/Backend_Infraestructura.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md`
- `BRAMUlab_Backlog.md` como antecedente conceptual de validación.

### Resultado general de la revisión

La experiencia definida en este documento es consistente con:

- calibración de Nivel: 5 partidos computables + 3 rivales diferentes;
- separación entre Nivel y progresión visual de Home;
- Ranking solo para jugadores elegibles/calibrados;
- invitados como identidades provisionales persistentes;
- asociación explícita de identidades, nunca por coincidencia de nombre;
- ventana temporal de 30 días para que una participación pendiente pueda quedar resuelta y computable;
- partidos pendientes/expirados visibles en historial pero sin efectos oficiales;
- carrusel superior de Home ya existente como superficie de destacados temporales;
- `TU MOMENTO` como superficie liviana, no como BRAMU Intelligence completa.

El 17/09/2026 se cerró la alineación conceptual del ciclo de partido con Backend/Infraestructura. Este documento define la experiencia de validación/corrección y `Backend_Infraestructura.md` traduce esas reglas a autoridad server-side, revisiones, deadlines y efectos oficiales.

---

## 2. Principio rector

La experiencia inicial no es un onboarding adicional ni una versión mutilada de la aplicación.

> **La Home se va formando con el jugador.**

BRAMU utiliza la misma estructura real de Home y adapta:

- qué módulos aparecen;
- qué módulos todavía no tienen sentido;
- qué acción recibe protagonismo;
- qué información temporal necesita atención;
- qué mensaje explica el momento actual.

No se muestran módulos vacíos, porcentajes sin valor, tarjetas bloqueadas ni listas de funciones que todavía no pueden utilizarse.

Criterio de producto:

> **Personalizada para el caso del jugador, no recortada.**

---

## 3. Home Estado Cero

### 3.1 Definición

Home Estado Cero es la Home real de un usuario que terminó su cuenta y estimador, pero todavía no posee ningún partido **válido/oficial** en su historial deportivo.

No es una pantalla de bienvenida que desaparece una vez vista.

Permanece mientras no exista un primer partido válido, aunque puedan existir partidos cargados y pendientes de validación.

### 3.2 Qué se muestra

#### A. Carrusel de destacados

Se conserva el carrusel superior existente.

No tiene contenido obligatorio por el solo hecho de ser usuario nuevo. Se utiliza únicamente cuando existe información temporal relevante.

Ejemplo prioritario: partido pendiente que requiere una acción del usuario o de su pareja.

#### B. Identidad + Nivel BRAMU

Se conserva la tarjeta existente de identidad:

- foto/avatar;
- nombre;
- `@usuario` cuando corresponda;
- Nivel BRAMU estimado;
- `CALIBRANDO · 0/5`.

No crear un módulo nuevo para completar foto o perfil. Tocar la identidad/foto continúa llevando a Perfil, donde los datos ya son editables.

La tarjeta debe mantener su estructura también con nombres largos. El nombre nunca debe empujar o desplazar el bloque de Nivel; debe permanecer en una línea y truncarse con ellipsis si no entra.

#### C. Último partido / Cargar primer partido

Mientras no exista ningún partido cargado asociado al usuario:

- la tarjeta existente se utiliza como **Cargar primer partido**;
- es la acción principal de Home Estado Cero.

Si ya existe un partido cargado pero pendiente:

- deja de mostrarse `Cargar primer partido` como si nunca hubiera ocurrido nada;
- la tarjeta muestra el partido real y su estado `PENDIENTE DE VALIDACIÓN` o equivalente.

El primer partido del jugador puede haber sido cargado por él, por su compañero o por un rival. Lo importante es cuándo pasa a ser válido/oficial.

#### D. TU MOMENTO

`TU MOMENTO` permanece, pero en Estado Cero cambia de función.

No debe repetir el CTA `Cargar primer partido` que ya existe inmediatamente arriba.

Debe explicar la promesa de valor de manera breve: cada partido empieza a construir información real sobre la actividad del jugador.

Copy conceptual de referencia, no definitivo:

> **Con cada partido, tu Home va a empezar a mostrar cómo venís jugando, con quién rendís mejor y cómo evoluciona tu actividad.**

Puede utilizarse una segunda línea breve con voz BRAMU, siempre subordinada a la explicación concreta.

Ejemplo posible:

> Cargá partidos. El resto se va armando solo.

No introducir acá una explicación de BRAMU Intelligence como producto separado.

#### E. Buscar jugadores

Se conserva la función actual de **Buscar jugadores**.

Su función no cambia: busca jugadores reales.

Puede recibir un copy contextual un poco más útil en Estado Cero, pero no debe convertirse en una función de recuperación de identidades provisionales o partidos previos.

### 3.3 Qué desaparece completamente en Estado Cero

No mostrar:

- Actividad vacía;
- Efectividad vacía;
- Racha actual vacía;
- Partidos totales = 0 como estadística protagonista;
- Mejor compañero vacío;
- Rival más enfrentado vacío;
- Evolución sin historial;
- Último partido vacío;
- BRAMU Intelligence sin evidencia;
- tarjetas grises/deshabilitadas;
- candados;
- sucesión de mensajes `todavía no hay datos`.

La Home simplemente es más corta porque todavía tiene menos cosas que contar.

---

## 4. Acción principal de Estado Cero

La acción principal es **registrar el primer partido**.

No compiten con ella:

- completar WhatsApp;
- subir foto;
- conocer Ranking;
- descubrir funciones;
- tutoriales generales.

Si existe un partido pendiente que el usuario debe resolver, esa acción puede superar temporalmente en urgencia a `Cargar primer partido` mediante el carrusel destacado, pero no transforma la Home en una pantalla de alerta.

---

## 5. Progresión de Home después del primer partido válido

No se crean estados rígidos del tipo `Home de 1 partido`, `Home de 3 partidos` o `Home de 5 partidos`.

Cada módulo se gana su lugar cuando ya puede mostrar información legítima.

### 5.1 Desde el primer partido válido

Pueden aparecer:

- Último partido real;
- Actividad;
- Efectividad;
- Racha actual + Partidos totales como bloque visual;
- TU MOMENTO adaptado al nuevo momento;
- Buscar jugadores.

La Efectividad puede mostrarse desde el primer partido porque el denominador deja clara la muestra (`1 de 1`, `0 de 1`). Es un dato descriptivo, no una conclusión sobre la calidad del jugador.

### 5.2 Racha actual + Partidos totales

Funcionan como pareja visual y no deben romper la grilla.

La tarjeta de Racha representa la lógica positiva vigente de Home:

- una derrota corta la racha positiva;
- cuando no existe racha positiva activa, muestra estado neutro `—`;
- no se elimina la tarjeta por haber perdido;
- no se usa esta tarjeta para mostrar una racha de derrotas.

La lectura narrativa de secuencias negativas pertenece a otras superficies cuando exista evidencia suficiente; no a esta tarjeta.

### 5.3 Mejor compañero + Rival más enfrentado

Funcionan como pareja visual.

No se muestran simplemente porque exista un partido.

El bloque aparece cuando **ambas tarjetas** pueden producir un resultado legítimo según sus reglas reales, sin seleccionar artificialmente un ganador de una comparación inexistente o empatada.

Ejemplos:

- jugar un único partido con Matu no convierte a Matu automáticamente en `Mejor compañero`;
- si todos los partidos registrados fueron siempre con el mismo compañero, todavía no existe una comparación real entre compañeros;
- `Rival más enfrentado` no debe elegir arbitrariamente a uno de dos rivales empatados solo para llenar el espacio.

### 5.4 Regla general de layout

Los módulos estadísticos emparejados mantienen siempre la composición visual.

> **0, 2 o 4 tarjetas. Nunca 1 ni 3.**

No debe existir un cuadrado vacío ni una tarjeta huérfana por falta de elegibilidad de su pareja visual.

### 5.5 Los 5 partidos no desbloquean la Home

La progresión de información y la progresión de Nivel son independientes.

Nivel continúa `CALIBRANDO` hasta cumplir simultáneamente:

- 5 partidos computables;
- 3 rivales diferentes computables.

Si el quinto partido cumple ambas condiciones, pasa a `CALIBRADO` al finalizar/procesarse ese partido. No espera un sexto.

Los módulos de Home pueden haber empezado a aparecer mucho antes.

---

## 6. Partidos pendientes y Home

Un partido pendiente puede existir y ser visible aunque todavía no alimente estadísticas oficiales.

### 6.1 0 válidos + ningún partido cargado

Home Estado Cero estándar:

- Cargar primer partido.

### 6.2 0 válidos + el usuario o su pareja ya cargaron un partido

- sigue teniendo 0 partidos oficiales;
- `Último partido` muestra ese encuentro real;
- se informa `PENDIENTE DE VALIDACIÓN`;
- no aparece nuevamente `Cargar primer partido` como si no hubiera actividad;
- todavía no se habilitan estadísticas oficiales derivadas de ese encuentro.

### 6.3 0 válidos + otra pareja cargó un partido que el usuario debe revisar

- continúa en Estado Cero para estadísticas;
- aparece un destacado accionable en el carrusel superior;
- aparece también en Notificaciones;
- al validarse y convertirse en oficial, puede transformarse inmediatamente en su primer partido válido y Home empieza a formarse.

---


## 7. Principio de validación: se juega en equipo, se valida en equipo

BRAMU valida por **pareja de ese partido**, no mediante cuatro aprobaciones individuales ni mediante parejas permanentes.

Ejemplo:

`Seba + Matu vs Lucho + Agus`

Si Seba carga el partido:

1. Seba/Matu quedan considerados conformes con la revisión que Seba envió.
2. Lucho y Agus reciben la solicitud de revisión.
3. Alcanza con que **uno de los dos rivales** confirme.
4. Si Lucho confirma, Agus ya no tiene ninguna acción pendiente.
5. El partido queda oficial/validado.

La validación del compañero del autor no reemplaza la confirmación rival.

### 7.1 Acciones de revisión

La jerarquía UX es deliberada:

- **Confirmar** — acción primaria;
- **Proponer corrección** — acción secundaria;
- **No participé** — acción excepcional, de baja jerarquía visual, disponible cuando la identidad asociada es incorrecta.

`No participé` nunca debe presentarse al mismo nivel visual que `Confirmar`.

### 7.2 Regla de representación por pareja

Quien propone o acepta una revisión actúa en representación de su pareja para esa versión del partido.

Por lo tanto:

- una acción de un integrante resuelve la tarea para su compañero;
- quien propone una nueva revisión deja a su pareja considerada conforme con esa revisión;
- la acción pasa a la pareja contraria;
- la pareja puede ser distinta en cada partido: el sistema no supone compañeros fijos.

Este criterio reduce burocracia y aumenta la probabilidad de resolución aunque uno de los cuatro jugadores use poco la aplicación.

---


## 8. Pendiente accionable

No todos los partidos `pendientes` significan que el usuario tenga algo que hacer.

### 8.1 Pendiente accionable

Es un partido todavía no oficial donde **actualmente la pareja del usuario debe responder**.

Ejemplos:

- la pareja rival cargó el partido y falta confirmación de este lado;
- la otra pareja propuso una corrección y este lado debe aceptar o responder.

El concepto es personal y atraviesa todos los compañeros/rivales del usuario. No presupone que juegue siempre con la misma pareja.

### 8.2 Pendiente no accionable

El usuario o su pareja ya hicieron lo necesario y ahora esperan a la otra pareja.

Ejemplo:

- Seba cargó un partido y está esperando que Lucho o Agus lo revise.

No debe tratarse visualmente como una tarea urgente que Seba pueda resolver.

### 8.3 Incidencias post-validación

Las correcciones o incidencias de identidad abiertas **después de que un partido ya quedó oficial** deben mostrarse y resolverse, pero no forman parte del contador de pendientes accionables usado para bloquear nuevas cargas.

---

## 9. Superficies de pendientes

### 9.1 Carrusel destacado de Home

Cuando existe un pendiente accionable, el carrusel superior es la superficie prioritaria.

Tratamiento:

- identidad visual lima/verde BRAMU más intensa que un destacado informativo común;
- puede utilizar un `latido` o pulso breve/sutil para comunicar acción pendiente;
- respetar `prefers-reduced-motion`;
- no usar naranja como color principal, porque el naranja ya pertenece semánticamente a `CALIBRANDO`;
- CTA claro hacia el partido.

Ejemplo conceptual:

**PARTIDO PENDIENTE**  
Seba registró un partido en el que participaste.  
`REVISAR`

El copy puede variar de manera controlada, pero nunca debe ocultar qué ocurrió ni qué acción falta.

### 9.2 Notificaciones

El mismo pendiente debe existir también en Notificaciones.

Carrusel y campana no son redundantes:

- Home lo pone enfrente cuando es relevante;
- Notificaciones conserva la tarea hasta resolverla.

Cuando otro integrante de la pareja resuelve la tarea, desaparece para ambos.

### 9.3 Historial / Pendientes

Los partidos pendientes permanecen accesibles desde Historial con estado visible.

Debe existir una forma clara de revisar el conjunto de pendientes sin depender exclusivamente de Home o de una notificación antigua.

---


## 10. Máximo de pendientes accionables antes de nuevas cargas

Se fija la siguiente regla de producto:

> **Con 5 partidos pendientes accionables, el usuario no puede iniciar una nueva carga propia hasta resolver al menos uno.**

El límite es **por usuario**, sumando todos los partidos donde su lado tiene la acción, aunque haya jugado cada uno con compañeros distintos.

### No cuentan para este límite

- partidos que el propio usuario o su pareja cargaron y están esperando respuesta rival;
- partidos donde el usuario ya respondió y ahora la acción corresponde al otro lado;
- correcciones/incidencias abiertas sobre partidos que ya habían quedado validados.

### Sí cuentan

- partidos no oficiales donde la pareja del usuario tiene la acción pendiente.

Si el compañero de ese partido resuelve uno, queda resuelto para ambos y baja el contador correspondiente.

El límite no bloquea la cuenta ni impide recibir nuevos partidos creados por otros jugadores. Por eso un usuario puede eventualmente visualizar más de cinco pendientes recibidos; la restricción afecta únicamente su capacidad de **seguir iniciando cargas mientras ignora tareas que le corresponden**.

Si en una pareja solo existe un usuario registrado y el compañero es provisional/invitado, ese usuario es quien puede actuar por su lado. Si el provisional reclama luego su identidad mientras el partido sigue pendiente, también adquiere capacidad de responder por esa pareja.

La resolución debe ser extremadamente simple y rápida. La regla existe para ordenar tareas, no para castigar el uso frecuente de BRAMU.

---


## 11. Ventanas temporales antes de la validación

### 11.1 Carga retroactiva: 14 días

Un usuario puede registrar un partido jugado hasta **14 días antes** del momento de carga.

No se permiten cargas normales de partidos con fecha de juego anterior a ese límite.

La fecha se valida server-side para evitar que el cliente pueda eludir la regla.

### 11.2 Pendiente de validación: 30 días

Una vez cargado, un partido que todavía no quedó oficial dispone de **30 días desde la carga original** para quedar correctamente asociado y validado.

Reglas:

- el reloj se mide con autoridad server-side;
- una corrección no reinicia el plazo;
- una contrapropuesta tampoco reinicia el plazo;
- el partido puede intercambiar revisiones dentro de la misma ventana;
- al entrar en la última semana, BRAMU debe advertir que el plazo está por vencer;
- si al cumplirse los 30 días continúa sin resolverse, pasa a `EXPIRADO / NO VALIDADO` o equivalente.

### 11.3 Partido expirado

- no se borra;
- permanece en Historial con estado claro;
- deja de ser una tarea accionable;
- no cuenta como partido oficial;
- no modifica Nivel ni calibración;
- no modifica Efectividad, rachas, compañeros/rivales ni otras estadísticas oficiales;
- no afecta Ranking;
- no se reactiva automáticamente por una asociación o reclamo posterior.

Copy conceptual de última semana:

> **Quedan 7 días para resolver este partido.**  
> Si no se valida antes del vencimiento, quedará registrado pero no computará.

---


## 12. Correcciones entre parejas

La corrección debe pensarse como una conversación entre dos parejas, no entre cuatro usuarios independientes.

### 12.1 Mientras el partido todavía está pendiente

Cualquiera de los cuatro participantes puede proponer una corrección, incluso quien realizó la carga original o su compañero.

La corrección puede abarcar:

- resultado/sets;
- participantes;
- fecha u otro dato editable del partido cuando corresponda.

Ejemplo:

1. Seba carga `Seba + Matu vs Lucho + Agus`.
2. Lucho detecta un error y propone una nueva revisión.
3. Lucho/Agus quedan considerados conformes con esa revisión.
4. La acción pasa a Seba/Matu.
5. Cualquiera de ellos puede confirmarla o volver a modificar algo.
6. Si vuelven a modificar un dato, la acción pasa nuevamente al otro lado.

No se fija un límite numérico de intercambios. La protección contra una discusión infinita es la ventana fija de 30 días.

### 12.2 Revisión y concurrencia

Cada modificación crea una **nueva revisión append-only**. Nunca se pisa silenciosamente la anterior.

Debe quedar registrado:

- quién modificó;
- cuándo;
- qué campos cambiaron;
- qué revisión quedó propuesta/aceptada.

Mientras una revisión está siendo resuelta, el servidor debe evitar que dos acciones simultáneas creen versiones incompatibles. La primera acción válida contra la versión vigente gana; una acción sobre una versión vieja debe pedir recarga y mostrar el estado actualizado.

### 12.3 Corrección normal después de validar

Una vez que el partido quedó oficial existe una ventana corta de **3 días desde `validated_at`** para que cualquiera de los participantes detecte y proponga una corrección normal.

Durante esa revisión:

- la última versión validada **sigue siendo la versión oficial**;
- el partido no desaparece del historial ni deja de contar por el solo hecho de existir una propuesta;
- la propuesta representa a la pareja que la realizó;
- la otra pareja debe aceptarla para convertirla en nueva versión oficial;
- si se acepta, Backend recalcula de forma atómica los efectos que dependan del cambio;
- si no se acepta dentro de la ventana, permanece firme la última versión oficial;
- una corrección no reinicia los 3 días.

Después de esa ventana ya no puede discutirse por autoservicio un resultado normal.

### 12.4 Historial de modificaciones

El detalle/resumen del partido debe conservar una sección de baja jerarquía visual, al final, tipo **Modificaciones**.

Debe poder mostrar, de forma compacta:

- cantidad de modificaciones;
- actor;
- fecha/hora;
- tipo de cambio;
- resumen de qué cambió.

Es trazabilidad, no contenido protagonista de la experiencia.

---


## 13. `No participé` y participantes incorrectos

`No participé` no equivale a rechazar el partido ni a desconocer un resultado.

Significa:

> La identidad asociada a uno de los cuatro lugares del partido es incorrecta.

### 13.1 Antes de que el partido sea oficial

Si Lucho indica `No participé`:

- el partido continúa pendiente;
- Lucho queda señalado como identidad incorrecta para ese lugar;
- Seba, Matu y Agus reciben la incidencia;
- cualquiera de los participantes habilitados puede corregir quién ocupaba realmente ese lugar.

La persona correcta puede ser:

- otro usuario registrado;
- una identidad provisional/invitado.

La corrección vuelve a aplicar la regla de pareja.

Ejemplo:

- Lucho dice que no participó;
- Agus reemplaza a Lucho por Pedro;
- Agus/Pedro quedan conformes con esa nueva revisión;
- Seba o Matu deben confirmarla.

Si la corrección la hubiera realizado Seba, la acción habría quedado del lado de Agus/Pedro.

### 13.2 La identidad incorrecta puede detectarla cualquier participante

No es obligatorio que el propio jugador mal asociado sea quien lo denuncie.

Durante la ventana habilitada, cualquiera de los participantes puede advertir que uno de los nombres cargados no corresponde a quien realmente jugó.

Esto cubre el caso de una identidad seleccionada por error que ni siquiera utiliza BRAMU.

### 13.3 Partido ya validado: ventana especial de identidad

Después de validar, la corrección normal cierra a los 3 días, pero una incidencia de identidad mantiene una ventana más amplia de **10 días desde `validated_at`**.

Durante esos 10 días:

- cualquier participante puede informar que una de las identidades cargadas no corresponde;
- el jugador afectado puede usar `No participé`;
- esto **no reabre** la posibilidad de discutir el resultado una vez vencidos los 3 días;
- el partido conserva su resultado oficial mientras se resuelve la identidad;
- la UI puede mostrar un estado conceptual tipo `PARTICIPACIÓN CUESTIONADA` o equivalente.

Una edición semanal de Ranking que ya fue publicada nunca se reescribe por esta incidencia.

### 13.4 Si no se identifica inmediatamente al cuarto jugador

Un error de identidad **no invalida automáticamente un partido real**.

Si se sabe que la persona asociada era incorrecta pero todavía no se sabe quién era la correcta:

- el lugar queda como participante por identificar;
- no se debe mantener pegado el partido a la persona incorrecta;
- no se fabrica una identidad real para forzar el dato;
- el resultado del partido puede seguir conservándose como registro oficial;
- los efectos que dependan de conocer correctamente esa identidad deben respetar las reglas de Nivel/Backend y recalcularse cuando corresponda.

Si finalmente el jugador real nunca se identifica, el partido puede conservar un lugar tipo `Jugador no identificado` sin convertir por eso el encuentro en inexistente.

**Pendiente de cierre menor:** definir el plazo exacto adicional para completar esa identidad una vez abierta la incidencia. La referencia evaluada es una ventana corta desde el reporte, pero todavía no se fija numéricamente en este documento.

---


## 14. Autor del registro y trazabilidad

BRAMU debe conservar siempre como datos distintos:

- quién registró/cargó el partido;
- quiénes participaron;
- quién propuso cada modificación;
- quién confirmó cada revisión.

El autor original no cambia aunque luego otra persona valide o corrija.

### Superficies

**Confirmado:**

- Notificación: debe nombrar quién cargó o quién realizó la acción relevante.
- Resumen/detalle del partido: debe mostrar de forma sutil quién lo cargó.
- Al final del Resumen/detalle debe existir acceso al historial de modificaciones cuando las haya.

**A validar visualmente:**

- Historial compacto: mostrar el autor únicamente si entra sin agregar ruido; el dato debe seguir disponible al abrir el partido aunque no se repita en cada fila compacta.

Ejemplos de notificación:

- `Seba cargó un partido en el que participaste.`
- `Matu confirmó el partido.`
- `Lucho propuso una corrección en el partido.`
- `Agus indicó que un participante no corresponde.`

---


## 15. Invitados, identidades provisionales y reclamo de actividad

### 15.1 Regla vigente

Un invitado no es texto suelto dentro de un partido.

Es una **identidad provisional persistente** con `player_id` propio.

Puede:

- participar de múltiples partidos;
- reaparecer para usuarios relacionados;
- acumular historial derivado;
- ser reclamada posteriormente por una cuenta real.

No recibe Nivel permanente ni posición competitiva mientras continúe como identidad provisional.

### 15.2 No aparece en búsqueda global

`Buscar jugadores` busca cuentas reales.

Una identidad provisional:

- no aparece libremente en la búsqueda global;
- puede reaparecer en contextos relacionados como recientes/red/partidos cuando corresponda.

Por eso **Buscar jugadores no se convierte en `Recuperar actividad`**.

### 15.3 Reclamo explícito

La asociación nunca se realiza porque nombre y apellido coincidan.

El reclamo se produce mediante una acción explícita, inicialmente mediante el link/token de invitación/reclamo asociado a esa identidad provisional.

El link pertenece a la identidad provisional, no a un partido aislado.

Al reclamarla correctamente:

- la cuenta toma ese `player_id`;
- obtiene los partidos históricos ya vinculados a esa identidad;
- si un partido sigue pendiente y dentro de su ventana, el nuevo usuario adquiere capacidad de actuar por su pareja;
- los partidos ya vencidos permanecen como historial y no se reactivan automáticamente;
- un partido ya oficial no se reabre por el solo hecho del claim: aplican las mismas ventanas post-validación que para cualquier participante.

### 15.4 Cuenta nueva creada sin link de reclamo

BRAMU no debe detectar automáticamente una identidad provisional porque el nombre sea parecido.

Por lo tanto, una cuenta recién creada normalmente **no recibe mágicamente un partido para reclamar** solo porque exista un provisional con el mismo nombre.

Para relacionarlos debe existir una acción explícita de reclamo/invitación.

### 15.5 Duplicados durante el piloto

Si una cuenta necesita reclamar una segunda identidad provisional o existen duplicados de la misma persona, el piloto puede resolverlo administrativamente.

No se construye todavía una interfaz autoservicio compleja de fusiones de identidades.

### 15.6 Regla temporal

La participación provisional respeta el deadline propio de cada partido.

Un reclamo posterior puede recuperar el historial de esa identidad, pero **no reactiva automáticamente partidos ya expirados**.

---


## 16. Alineación con Backend/Infraestructura

La contradicción anterior entre `validar/rechazar` y el modelo de revisión por parejas queda **resuelta conceptualmente**.

La regla vigente de producto es:

- `Confirmar`;
- `Proponer corrección`;
- `No participé` / identidad incorrecta;
- turnos de acción por pareja;
- revisiones append-only;
- carga retroactiva máxima de 14 días;
- deadline fijo de 30 días para un partido que nunca llegó a oficializarse;
- 3 días post-validación para correcciones normales;
- 10 días post-validación para incidencias de identidad;
- límite personal de 5 pendientes accionables antes de iniciar una carga nueva;
- Ranking semanal publicado inmutable frente a correcciones posteriores.

`Backend_Infraestructura.md` debe implementar estas reglas con autoridad server-side, idempotencia, control de concurrencia, auditoría y recomputación de efectos oficiales.

Esto **no cambia** la arquitectura Supabase/Vercel ni obliga a rehacer Bloques 1–2.

El mayor impacto empieza en:

- Bloque 4: claims de identidades provisionales y capacidad de actuar;
- Bloque 5: partidos, revisiones, deadlines, action-side e historial;
- Bloque 6: confirmación, correcciones, incidencias de identidad y actualización oficial.

### Detalle de claim provisional

- reclamar una identidad puede asociar su historial;
- la elegibilidad de cada partido conserva su propio deadline/estado;
- un partido expirado no vuelve a computar porque la identidad se reclame después;
- no existe matching automático por nombre.

---

## 17. Datos incompletos de Perfil

Home Estado Cero no se transforma en checklist de cuenta.

Foto, WhatsApp y demás datos viven en Perfil / Mis datos.

### Propuesta a evaluar

Notificaciones puede recordar datos relevantes que falten, por ejemplo WhatsApp, si completar ese dato aporta una función concreta.

Ejemplo conceptual:

> Completá tu WhatsApp para que otros jugadores puedan contactarte y organizar partidos con vos.

No convertir esto en tarjeta permanente de Home ni bloquear la experiencia por un dato secundario.

---

## 18. Recordatorio por WhatsApp

**Propuesta, no decisión cerrada.**

En el futuro cercano puede evaluarse una acción `Recordar por WhatsApp` desde un partido que está esperando validación rival.

Comportamiento deseado:

- compartir un enlace directo/deep link al partido;
- quien lo recibe abre BRAMU directamente en el partido correspondiente;
- facilita el mensaje humano `acordate de validar este partido` sin obligar a buscarlo manualmente.

No es necesaria para cerrar la experiencia inicial ni para el backend mínimo.

---

## 19. Tutorial general

No se implementa un tutorial/video de recorrido general en esta etapa.

BRAMU debe poder entenderse por la propia interfaz.

Si una función concreta demuestra confusión en pruebas reales, se resuelve con ayuda contextual puntual en ese lugar.

---

## 20. TU MOMENTO durante la progresión inicial

`TU MOMENTO` funciona como costura narrativa liviana entre los estados de Home.

### Estado Cero

Explica qué se va a construir con la actividad.

### Primeros partidos

Puede reconocer hitos simples y verdaderos sin fingir análisis profundo.

Ejemplo conceptual:

> Primer partido registrado. Tu Nivel sigue calibrando y tu historia ya empezó a tomar forma.

### Con más historial

Continúa respetando la lógica existente de `TU MOMENTO` y no se convierte en BRAMU Intelligence completa.

Ranking solo puede aparecer ahí como insight puntual cuando las reglas de Ranking lo permitan; no se duplica una tarjeta territorial en Home.

---

## 21. Microcopy y tono

La voz puede utilizar ocasionalmente metáforas de pádel, siempre después de una explicación directa.

Ejemplo de acompañamiento válido:

> Tranqui. No quieras definir el punto en la primera pelota.

No utilizar como explicación principal:

> BRAMU necesita verte jugar.

Puede interpretarse como filmación, seguimiento físico u observación externa.

Copy directo recomendado como base:

> Tu Nivel inicial es estimado. Registrá partidos para que BRAMU pueda ajustarlo con resultados reales.

Los textos definitivos deben cerrarse al momento de trabajar la pantalla visual, sin alterar las reglas de este documento.

---


## 22. Casos límite consolidados

### A. Usuario termina estimador y no hizo nada

Home Estado Cero estándar.

### B. Usuario cargó su primer partido pero nadie rival lo validó

- Último partido muestra el partido pendiente;
- 0 estadísticas oficiales derivadas de ese encuentro;
- espera rival;
- no cuenta como pendiente accionable para bloquear nuevas cargas.

### C. Otro jugador cargó el primer partido del usuario

Si la identidad ya está correctamente vinculada a la cuenta:

- destacado accionable + notificación;
- cualquiera de los dos integrantes de su pareja puede resolver;
- si se valida, puede convertirse inmediatamente en el primer partido oficial.

### D. Existe un provisional con el mismo nombre que el usuario nuevo

No hacer nada automáticamente.

Solo un reclamo explícito puede vincularlo.

### E. Una pareja nunca valida un partido cargado por el usuario

- permanece pendiente hasta 30 días desde la carga original;
- no bloquea las cargas propias del autor por depender de terceros;
- al vencer expira, permanece en historial y no computa.

### F. Usuario acumula 5 tareas que dependen de su lado

- pueden corresponder a cinco compañeros distintos;
- puede navegar y usar BRAMU;
- no puede iniciar otra carga propia hasta resolver al menos una;
- el compañero del partido puede resolver y liberar la restricción;
- otros jugadores todavía pueden cargar partidos en los que participe.

### G. Una pareja propone correcciones una y otra vez antes de validar

- no existe contador artificial de intercambios;
- el deadline original no se reinicia;
- al cumplirse 30 días sin acuerdo, expira y no computa.

### H. Partido validado y un compañero detecta un resultado mal cargado

- dispone de 3 días desde la validación;
- propone una nueva revisión;
- la versión oficial anterior sigue vigente mientras espera aceptación;
- si la otra pareja acepta, se convierte en la nueva versión oficial y se recalculan efectos.

### I. Partido validado y al día 5 se detecta una identidad incorrecta

- el resultado normal ya no puede discutirse si vencieron los 3 días;
- todavía puede abrirse una incidencia de identidad hasta el día 10;
- la persona incorrecta deja de ser tratada como participante correcto;
- los demás pueden reemplazarla por un usuario real o provisional;
- el Ranking semanal ya publicado no se reescribe.

### J. Se sabe que un jugador cargado era incorrecto pero nadie identifica al real

- el partido no se borra ni se convierte automáticamente en inexistente;
- el slot queda por identificar;
- no se fabrica una identidad;
- el plazo exacto adicional de resolución queda como decisión menor pendiente.

### K. Partido expirado y luego el invitado reclama su identidad

- el historial puede quedar vinculado a la identidad reclamada;
- el partido no vuelve a ser computable automáticamente.

### L. Intento de cargar un partido de más de 14 días

- la carga normal se rechaza server-side;
- no se crea un pendiente nuevo.

---


## 23. Decisiones confirmadas

- Home Estado Cero es la Home real, no onboarding.
- No crear una Home nueva.
- No mostrar estadísticas vacías.
- Identidad + Nivel permanecen.
- `Cargar primer partido` es el CTA principal cuando realmente no existe actividad cargada.
- `TU MOMENTO` genera expectativa y explica valor; no repite el CTA.
- `Buscar jugadores` conserva su función real.
- Datos secundarios de Perfil no ocupan Home.
- No tutorial general.
- Home se forma módulo por módulo según legitimidad del dato.
- Efectividad y Actividad pueden aparecer desde el primer partido válido.
- Grilla estadística: 0/2/4, nunca 1/3.
- `Mejor compañero + Rival más enfrentado` aparecen juntos cuando ambos tienen información legítima.
- Nivel se calibra con 5 computables + 3 rivales diferentes.
- Validación por parejas; una confirmación de la pareja contraria alcanza.
- La pareja es contextual a cada partido, no un equipo permanente.
- `Confirmar` es primario; `Proponer corrección` secundario; `No participé` excepcional.
- Cualquiera de los cuatro puede proponer una corrección mientras el partido siga pendiente.
- Quien modifica una revisión representa a su pareja y pasa la acción al otro lado.
- Autor y participantes son entidades distintas.
- Todas las revisiones quedan auditadas; no se pisan silenciosamente.
- El detalle del partido muestra de forma discreta su historial de modificaciones.
- Pendiente accionable = la acción está del lado de la pareja del usuario.
- El límite de pendientes es personal y suma partidos con cualquier compañero.
- Con 5 pendientes accionables, el usuario debe resolver al menos uno antes de iniciar otra carga.
- Pendientes esperando a terceros no cuentan para ese límite.
- Incidencias post-validación no cuentan para ese límite.
- Se pueden cargar partidos jugados hasta 14 días atrás.
- Un partido nunca validado tiene una ventana fija de 30 días desde la carga original.
- Correcciones pre-validación no reinician ese reloj.
- Expirado permanece en historial pero no computa ninguna estadística oficial, Nivel ni Ranking.
- Un partido validado admite corrección normal durante 3 días desde `validated_at`.
- La versión oficial anterior sigue vigente mientras una corrección post-validación está pendiente.
- Una incidencia de identidad puede abrirse hasta 10 días desde `validated_at`.
- Cualquier participante puede detectar que una identidad cargada es incorrecta.
- `No participé` corrige identidad; no rechaza el partido.
- Un error de identidad no invalida automáticamente un partido real.
- Identidades provisionales son persistentes y se reclaman explícitamente.
- Un claim pendiente puede habilitar al nuevo usuario a actuar por su pareja.
- Un claim posterior no reabre automáticamente un partido oficial o expirado.
- Nunca hacer matching automático por nombre.
- Ranking BRAMU publicado es un snapshot semanal inmutable; las correcciones posteriores impactan hacia adelante.

---


## 24. Propuestas todavía no cerradas

- copy definitivo de Estado Cero y TU MOMENTO;
- intensidad/motion exacto del destacado accionable;
- mostrar o no autor del partido en cada fila compacta de Historial;
- copy definitivo para el estado conceptual `PARTICIPACIÓN CUESTIONADA`;
- plazo exacto adicional para identificar al jugador correcto una vez abierta una incidencia de identidad;
- representación visual definitiva de `Jugador no identificado`;
- nivel de detalle exacto del before/after dentro de `Modificaciones`;
- recordatorio de datos incompletos mediante Notificaciones;
- `Recordar por WhatsApp` con deep link;
- tratamiento administrativo de duplicados/reclamo de segunda identidad durante el piloto, más allá de la resolución manual ya prevista.

Ninguno de estos puntos modifica la arquitectura general ni reabre las reglas 14/30/3/10 ya confirmadas.

---


## 25. Qué debe validarse con usuarios reales

- que Home Estado Cero se perciba viva y no vacía;
- que el usuario entienda que el Nivel es estimado y se está calibrando;
- que `Cargar primer partido` sea obvio sin tutorial;
- que `Confirmar / Proponer corrección / No participé` tenga una jerarquía inequívoca;
- que el usuario entienda un pendiente accionable y pueda resolverlo muy rápido;
- que el límite de 5 pendientes no produzca abandono o confusión;
- que las ventanas post-validación sean comprensibles sin llenar la interfaz de fechas;
- que el historial de modificaciones dé confianza sin agregar ruido;
- que una incidencia de identidad se entienda como corrección de participante y no como anulación automática;
- que la progresión de módulos se perciba natural;
- que los copies de TU MOMENTO generen expectativa sin prometer análisis que todavía no existe;
- que el tratamiento lima de pendientes llame la atención sin volverse molesto.

---

## 26. Criterio de implementación

No rehacer componentes que ya funcionan.

Prioridad:

1. reutilizar Home, Player Card, Último partido, carrusel, TU MOMENTO, métricas y Buscar jugadores existentes;
2. cambiar reglas de visibilidad y jerarquía;
3. agregar estados únicamente donde el backend real los necesita;
4. preservar el layout y la identidad visual actual;
5. probar la experiencia con usuarios reales antes de sumar funciones adicionales.

> La mejor primera experiencia no es la que explica todo BRAMU. Es la que hace que el usuario entienda dónde está, qué puede hacer ahora y empiece a generar datos reales sin sentir que entró a una aplicación vacía.

