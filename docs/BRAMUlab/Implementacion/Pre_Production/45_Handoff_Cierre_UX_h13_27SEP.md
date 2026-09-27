# BRAMUlab — Handoff de cierre UX tras QA físico h13

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline observada:** BRAMUlab V04.11 / bundle `04.11-h13`  
**Origen:** QA físico de Sebastián sobre iPhone + escritorio, después de `44_Revision_Central_Final_h13_27SEP.md`.

## 0. Regla de esta ronda

**FRENAR el Laboratorio. No pedir más re-demostraciones a Sebastián hasta completar esta ronda y hacer revisión central VISUAL contra esta especificación.**

Esta ronda existe porque varios puntos ya hablados/documentados fueron considerados PASS por código pero no quedaron como se esperaba en el dispositivo real.

A partir de ahora, para estos puntos:

- no alcanza con comprobar que exista una clase CSS, un badge o un bloque en DOM;
- no alcanza con tests verdes;
- Central debe comparar el resultado final contra los criterios visuales/semánticos de este documento;
- si algo no se implementa, debe quedar escrito explícitamente antes de volver a pedir QA humano;
- no reinterpretar pedidos confirmados.

## 1. Nivel BRAMU — barra de progreso real

**Clasificación:** YA DEFINIDO / IMPLEMENTACIÓN INCORRECTA.

La barra debajo del Nivel NO es una barra de “cantidad de partidos” ni una barra que pueda quedar llena en un Nivel entero.

Comportamiento visual esperado:

- representa el progreso decimal dentro del entero actual;
- ejemplo: Nivel 5.8 → barra aproximadamente al 80%;
- Nivel 6.0 → barra vacía/al inicio;
- Nivel 6.1 → aproximadamente 10%;
- mantener el indicador de variación real de Nivel cuando exista evidencia real, por ejemplo `↑ 0.2` / `↓ 0.2`;
- si no existe un delta real calculable, ocultar el chip; no inventarlo.

**NO TOCAR:** fórmula de Nivel.

**Aceptar solo si:** 6.0 ya no aparece con la barra llena y el componente recupera el comportamiento visual histórico correcto.

## 2. Home — Último partido con corrección activa

**Clasificación:** UX / VISUAL.

Problemas visibles en h13:

- el estado de corrección desplaza verticalmente la línea de forma/VICTORIA-DERROTA;
- el badge actual pesa demasiado como “pastilla” y rompe la composición;
- el estado no debe deformar el layout del resultado.

Dirección:

- VICTORIA/DERROTA y la secuencia de forma deben conservar siempre la misma posición;
- fecha/hora arriba a la derecha;
- estado de revisión debajo de fecha/hora;
- usar un tratamiento ámbar discreto pero visible;
- preferir un copy corto del tipo `CORRECCIÓN PENDIENTE` antes que una píldora grande que empuje el resto;
- el acento/borde ámbar puede marcar que el partido no está en estado normal/cerrado;
- no alterar el score oficial mientras la corrección no sea aceptada.

**Aceptar solo si:** activar/desactivar una corrección no mueve la línea de forma ni VICTORIA/DERROTA.

## 3. Resumen de partido — grilla del resultado

**Clasificación:** BUG VISUAL REABIERTO.

La alineación sigue rota en h13.

Problema:

- la separación entre las dos parejas y los games se construye visualmente como fragmentos;
- la línea divisoria no se lee como una única fila/grilla;
- nombres y resultados quedan cortados/desalineados.

Dirección técnica/visual:

- tratar cada pareja como una fila única;
- columna izquierda = pareja;
- columna derecha = games de todos los sets;
- divisor entre filas debe atravesar coherentemente el bloque, no ser dos líneas independientes que se desfasen;
- ambas filas deben compartir alturas, baseline y espaciado;
- funcionar igual con 2 y 3 sets.

**Aceptar solo si:** en iPhone y escritorio las dos parejas se leen como una misma tabla deportiva limpia, sin cortes ópticos.

## 4. Corrección post-validación — comparación oficial vs propuesta

**Clasificación:** UX / VISUAL — dirección ya confirmada, implementación todavía insuficiente.

Mantener la regla de producto:

- mientras la otra pareja no acepte, la última versión validada sigue siendo oficial;
- la propuesta NO reemplaza todavía la verdad oficial;
- pero la propuesta abierta es el evento principal que necesita atención.

### Composición

- centrar los rótulos `RESULTADO OFICIAL ACTUAL` y `CORRECCIÓN PROPUESTA`;
- conservar dos bloques claramente diferenciados;
- ambos bloques deben usar exactamente la misma grilla de resultado corregida del punto 3;
- la propuesta debe tener peso visual suficiente, sin parecer un apéndice.

### Explicación humana del cambio

No dejar solo un delta técnico tipo:

`Set 2: 6–0 → 6–4`

Usar copy contextual dentro/asociado al bloque de propuesta, por ejemplo:

`Esteban indica que el segundo set fue 6–4, no 6–0.`

Si cambia más de un set, resumir los cambios relevantes de forma natural y breve.

### Acciones

- `Aceptar corrección` y `Rechazar` deben tener la misma altura y una composición equilibrada;
- aceptar = primario;
- rechazar = secundario;
- no dejar dos botones que parezcan de componentes/tamaños distintos.

**Aceptar solo si:** una persona entiende sin esfuerzo qué está oficial, qué propone la otra pareja, qué cambia y qué acción toma.

## 5. Reportar un error

**Clasificación:** UX / VISUAL.

### CTA en Resumen

- usar sentence case: `Reportar un error`;
- mantenerlo secundario;
- borde/texto rojo suave es válido;
- evitar todo mayúsculas si genera peso excesivo.

### Selector “¿Qué está mal?”

Las opciones no deben sentirse como dos tarjetas pesadas metidas dentro de otra tarjeta.

Dirección:

- sheet único;
- opciones más livianas;
- puede usarse lista + divisor;
- mantener:
  - `El resultado`
  - `Un participante`
- cada opción con explicación corta, sin exceso de cajas.

## 6. Identidad incorrecta — flujo continuo

**Clasificación:** UX / PRODUCTO ya confirmado.

Al confirmar que una identidad cargada es incorrecta:

- no terminar el flujo con un toast y obligar a volver a tocar `Resolver`;
- abrir inmediatamente `¿Sabés quién jugó?`;
- ofrecer búsqueda de reemplazo;
- ofrecer también `No sé · dejar Por identificar`.

### Confirmación previa

Evitar copy raro como `¿Confirmás que no participó?`.

Preferencia:

`¿Seguro que no fue Lucho?`

con acción clara para confirmar/cancelar.

### Búsqueda de reemplazo

Usar SIEMPRE el patrón canónico de jugador:

- avatar real cuando exista;
- nombre;
- `@usuario`;
- Nivel BRAMU real;
- Recientes cuando corresponda.

No crear una variante reducida diferente para este sheet.

## 7. Patrón único de jugador en toda la app

**Clasificación:** BUG DE COHERENCIA / IMPLEMENTACIÓN INCOMPLETA.

Buscar jugadores ya muestra el patrón correcto y debe ser la referencia.

Un mismo jugador no puede verse de tres maneras distintas según desde dónde se entra.

Unificar en:

- Buscar jugadores;
- selector de compañero/rival;
- reemplazo de identidad;
- Compañeros;
- Rivales;
- Mis Jugadores;
- Perfil público.

Regla:

- misma identidad por `player_id`;
- mismo avatar;
- mismo `@usuario`;
- mismo Nivel;
- mismo Perfil público final.

No navegar por nombre plano ni abrir perfiles legacy alternativos.

## 8. Mi Perfil → Jugadores

**Clasificación:** UX / PRODUCTO — decisión nueva confirmada en QA h13.

No usar una pantalla vacía con botón `BUSCAR JUGADORES` que lleva a otra pantalla de búsqueda.

Nueva dirección:

- la pestaña `JUGADORES` contiene siempre arriba el campo `Buscar en tus jugadores…` / búsqueda;
- debajo se listan los jugadores agregados;
- si todavía no hay jugadores, mostrar estado vacío breve debajo del buscador;
- desde el mismo espacio se debe poder buscar/agregar sin un paso intermedio innecesario.

La búsqueda global puede abrirse/activarse desde ese mismo patrón sin duplicar una pantalla vacía previa.

## 9. Cargar partido — metadata arriba de los equipos

**Clasificación:** YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA.

h13 sigue mostrando formato y fecha/hora debajo de Equipo A/B.

Debe quedar ANTES de seleccionar jugadores:

1. header `CARGAR PARTIDO`;
2. bloque compacto de metadata;
3. Equipo A;
4. Equipo B;
5. sets.

Metadata:

- formato;
- cantidad de sets;
- sistema de puntuación;
- fecha/hora;
- editable antes de empezar a cargar el score;
- no duplicar más abajo.

En móvil puede resolver en una o dos líneas compactas, pero siempre arriba de Equipo A.

## 10. Historial — “Necesita revisión” y carga no sincronizada

**Clasificación:** UX / COPY + posible estado funcional a aclarar.

Problema actual:

- una tarjeta puede mostrar `NECESITA REVISIÓN`;
- al abrirla, no explica qué necesita revisión;
- aparece `Descartar carga` con texto sobre “todavía no se envió al servidor” sin dejar claro qué está ocurriendo ni cuándo/reintenta.

Dirección:

- el estado debe nombrar el problema real;
- si es `sync_pending`/carga local no sincronizada, no llamarlo genéricamente `Necesita revisión`;
- mostrar un banner contextual del tipo:
  - `Este partido todavía no se sincronizó con BRAMU.`
  - acción primaria `Reintentar` cuando corresponda;
  - secundaria/destructiva `Descartar carga`;
- explicar que descartar elimina únicamente esa carga local pendiente;
- no dejar al usuario adivinando si el partido existe o no en servidor.

No modificar la lógica offline/idempotente vigente sin revisar su fuente maestra.

## 11. Notificaciones — lenguaje de pádel, no lenguaje técnico

**Clasificación:** UX / COPY.

Los títulos actuales comunican técnicamente el workflow, pero no suenan como producto deportivo:

- `propuso una corrección`;
- `aceptó la corrección`;
- `resolvió un participante`;
- `cuestionó un participante`.

Cambiar a lenguaje humano y concreto.

Dirección de copy:

- corrección propuesta: `Esteban reportó un resultado distinto` / `Esteban quiere corregir el resultado`;
- aceptada: `Esteban confirmó el nuevo resultado`;
- identidad cuestionada: `Seba indicó que [Nombre] no jugó`;
- identidad resuelta: `Esteban indicó quién jugó`;
- validación normal: `Esteban confirmó tu partido`.

Debajo:
- rivales/parejas relevantes;
- score;
- fecha si suma contexto.

Evitar repetir en título y cuerpo la misma idea.

## 12. Puntos que hoy se consideran PASS / NO REABRIR sin regresión

- búsqueda global de jugadores: estructura base avatar + nombre + @usuario + Nivel se ve correcta;
- botón central `+`: presencia/centrado general mejoró; no reabrir salvo anomalía concreta;
- navegación principal;
- borde de Último partido por victoria/derrota cuando NO hay estado especial;
- self-healing h11;
- backend de validación ya cerrado;
- BRAMUlive fuera de alcance;
- Mis grupos fuera de esta ronda.

## 13. Gate obligatorio antes de volver a Sebastián

Claude puede implementar, pero **Central no debe volver a declarar “apto para Laboratorio” solo por tests/código**.

Antes de devolver la app al QA humano, Central debe revisar:

1. cada punto 1–11 de este documento;
2. comparar visualmente Home, Resumen, Corrección, Cargar partido, Historial, Notificaciones y Jugadores;
3. usar viewport móvil y desktop;
4. verificar criterios de aceptación literales;
5. documentar qué quedó exactamente implementado;
6. listar cualquier punto que NO quedó igual a lo pedido.

Solo después generar nueva baseline.

## 14. Prioridad

**P0 visual/funcional de esta ronda**
- grilla del Resumen;
- comparación oficial/propuesta + botones;
- metadata arriba en Cargar partido;
- estado de sync/revisión comprensible;
- identidad canónica/patrón de jugador.

**P1 UX antes de invitar amigos**
- barra de Nivel correcta;
- Último partido con corrección sin deformación;
- Jugadores con búsqueda directa;
- copies de notificaciones;
- Reportar error;
- flujo continuo de identidad.

No ampliar a Mis grupos, responsive general ni funciones nuevas durante esta corrección.
