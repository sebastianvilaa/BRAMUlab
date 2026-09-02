# BRAMU Lab — Consolidado V12.1 Express

## OBJETIVO

V12.1 es una **microcorrección urgente** sobre V12 antes de avanzar al modo `Registro por Games · Beta`.

No abrir nuevas funciones grandes.

Corregir solamente los problemas detectados en la primera prueba manual de V12, priorizando:

1. lógica correcta de `RESOLVER CON TIE BREAK`;
2. ubicación estable de la progresión de puntos;
3. pequeños ajustes visuales de bajo riesgo;
4. mantener intacto todo lo que ya funciona.

Base: **V12**.

---

# 1. REEMPLAZAR — SEMÁNTICA DE “RESOLVER CON TIE BREAK”

## Problema detectado

En V12, al elegir `RESOLVER CON TIE BREAK` con un partido todavía abierto, el Tie break termina pero la app continúa luego con un nuevo set normal.

Eso contradice la intención real de la acción.

Si el usuario elige explícitamente:

**RESOLVER CON TIE BREAK**

está diciendo:

> “No vamos a continuar el partido normal. Vamos a resolver el encuentro con este Tie break.”

Por lo tanto, al finalizar ese TB, **el partido debe terminar siempre**.

---

## Nueva regla confirmada

`RESOLVER CON TIE BREAK` crea un **segmento extraordinario decisivo del partido**.

No debe considerarse un game normal ni integrarse artificialmente dentro del set incompleto.

Ejemplo real de prueba:

- Set 1: Seba / Matu ganan 6-3.
- Set 2: queda 4-4.
- Los jugadores deciden resolver el encuentro con un TB a 10.
- Gusti / Esteban ganan el TB 10-8.

Resultado conceptual:

**6-3 · 4-4 · TB 8-10**

o visualmente equivalente según la orientación existente de Equipo A/B.

El tercer segmento es un **TB decisivo extraordinario**, no un tercer set reglamentario.

Debe quedar visualmente identificado como `TB`.

---

## Consecuencias

Al terminar el Tie break extraordinario:

- finalizar inmediatamente el partido;
- NO iniciar un tercer set normal;
- NO preguntar quién saca para continuar;
- NO incrementar games del set incompleto;
- NO convertir 4-4 en 5-4;
- NO convertir 4-4 en 6-4 / 7-6;
- NO fabricar un set reglamentario;
- NO fabricar holds, breaks o games adicionales.

El score previo queda exactamente como ocurrió.

El TB aparece como un segmento decisivo separado.

---

## Ganador del partido

El ganador del Tie break extraordinario es el **ganador del partido**.

Esto aplica aunque el partido normal haya quedado interrumpido antes de completar la estructura reglamentaria de sets.

La acción `RESOLVER CON TIE BREAK` representa un acuerdo extraordinario entre jugadores para definir el encuentro.

---

## Resumen / Historial

Mostrar el resultado de manera honesta.

Ejemplo:

- Set 1: `6-3`
- Set 2: `4-4`
- TB decisivo: `8-10`

No etiquetar obligatoriamente el TB como “Set 3”.

Preferencia:

**TB**

Debe entenderse visualmente como un tercer segmento del resultado, pero no como un set reglamentario.

---

## BRAMU Intelligence

Debe entender que este TB **cerró y decidió el partido**.

Ejemplo conceptual:

> Con el segundo set 4-4, decidieron resolver el partido mediante un Tie break a 10. Gusti y Esteban se impusieron 10-8 y se quedaron con el encuentro.

NO decir:

- que el TB resolvió únicamente el set si luego no hubo más juego;
- que el partido quedó empatado;
- que comenzó un tercer set;
- que ocurrió un 5-4 / 6-4 / 7-6 ficticio.

Mantener intacto el Narrative Planner general; hacer únicamente la adaptación necesaria para este cierre extraordinario.

---

# 2. CORREGIR — PROGRESIÓN DE PUNTOS

## Problema detectado

La progresión actual cambia de ubicación según aparecen banners como:

- Set Point;
- Match Point;
- Tie Break;
- otros estados.

En algunos momentos queda muy arriba y en otros termina perdida debajo de todo el marcador.

La idea funciona; la ubicación no.

---

## Nueva ubicación confirmada

Mover la progresión a una **franja propia y estable inmediatamente arriba de la fila de herramientas**:

`● ● ○ ● ●`

---

`DESHACER · AJUSTAR · HIGHLIGHT · EDITAR`

Debe:

- estar centrada;
- ocupar una barra propia;
- permanecer siempre en el mismo lugar;
- no moverse cuando aparece Set Point / Match Point / banners;
- ser ligeramente más visible que ahora;
- conservar máximo aproximado de 12 eventos recientes;
- mantener colores Team A / Team B;
- mantener círculo vacío para tramo de `AJUSTAR`.

---

## Tie breaks

La progresión debe seguir siendo visible durante:

- games normales;
- Tie breaks reglamentarios;
- Tie break extraordinario.

En TB debe mostrar la progresión de puntos del desempate actual.

`AJUSTAR` puede seguir deshabilitado dentro del TB según V12; eso no implica ocultar la progresión.

---

# 3. REEMPLAZAR — MARCA DEL HEADER

## Problema detectado

El header muestra texto simple:

`BRAMU`

pero el proyecto ya posee identidad/logo definitivo `BRAMUlab`.

---

## Cambio

Usar el **asset de logo BRAMUlab ya existente dentro del proyecto**.

No recrear el logo con texto CSS si existe el PNG/SVG/asset correcto.

Mantener el resto del header:

**LOGO · FORMATO · SISTEMA · TIEMPO**

Debe seguir siendo compacto y secundario respecto del marcador.

---

# 4. AJUSTAR — “DATOS PARCIALES POR AJUSTE MANUAL”

## Problema detectado

La frase completa dentro de las tarjetas de estadísticas hace que Break Points / Racha máxima tengan diferente altura respecto del resto.

Funcionalmente está bien, visualmente rompe la grilla.

---

## Nueva solución

En las métricas afectadas usar un asterisco:

- `BREAK POINTS *`
- `RACHA MÁXIMA DE PUNTOS *`

Luego, una sola aclaración discreta debajo del bloque correspondiente:

`* Datos parciales por ajuste manual`

Mostrar la nota solamente cuando realmente exista al menos una métrica parcial.

No repetir el texto dentro de cada tarjeta.

No cambiar qué métricas se consideran parciales; solo cambiar la presentación visual.

---

# 5. AJUSTAR — SELECTOR DE TIE BREAK EXTRAORDINARIO

## Problema visual

Las cuatro tarjetas no tienen una estructura visual uniforme.

En especial `Tie break clásico` muestra una segunda línea con `7`, generando alturas/composiciones diferentes y algunos controles quedan demasiado pegados.

---

## Cambio

Uniformar las cuatro opciones:

- `Tie break clásico`
- `Muere en 7`
- `Tie break a 15`
- `Otro`

Todas deben:

- tener igual altura;
- igual padding;
- alineación consistente;
- mismo peso visual.

Eliminar la aclaración suelta `7` debajo de `Tie break clásico`.

La lógica del preset clásico sigue siendo a 7 con diferencia de 2.

Para `Otro`, mantener:

- selector de objetivo;
- `Diferencia de 2`;
- `Muere en X`.

Revisar gaps/márgenes para que controles y botones no queden pegados.

No rediseñar el flujo completo.

---

# 6. NO TOCAR AHORA — EVOLUCIÓN

## Problema detectado

Cuando se usa `AJUSTAR` dentro de un mismo game, Evolución puede mostrar un corte/gap visual demasiado grande.

Conceptualmente ese gap exagera la incertidumbre:

- se conoce el estado anterior;
- se conoce el estado posterior;
- solo se desconoce el orden exacto de algunos puntos dentro del mismo game.

La tendencia global del partido no debería verse interrumpida como si faltara un tramo completo.

---

## Decisión V12.1

**NO CORREGIR AHORA.**

Dejar documentado para una ronda posterior.

Dirección conceptual futura:

- mantener continuidad visual entre estados conocidos;
- indicar el ajuste de forma discreta;
- no representar unos pocos puntos desconocidos como un gran agujero temporal.

No tocar la fórmula matemática de Evolución en esta microversión.

---

# 7. NO TOCAR

Salvo que una corrección anterior lo requiera directamente:

- scoring reglamentario;
- Punto de Oro;
- Con Ventaja;
- Star Point;
- Tie breaks reglamentarios;
- Ajustar y su lógica de datos parciales;
- corrección de sacador;
- auditoría equipo/individual;
- Highlight;
- fórmulas de estadísticas;
- fórmula de Evolución;
- bug conocido `scoreAfter`;
- Compartir;
- perfiles;
- ranking;
- cualquier modo nuevo de registro.

Especialmente:

**NO empezar todavía Registro por Games dentro de este trabajo.**

V12.1 debe quedar cerrada primero.

---

# 8. PRUEBA CRÍTICA OBLIGATORIA

Reproducir exactamente este caso:

### Partido
Clásico · Punto de Oro.

### Desarrollo
- Set 1: Equipo A gana `6-3`.
- Set 2: llega a `4-4`.
- Game actual: `0-0`.
- Elegir `RESOLVER CON TIE BREAK`.
- Elegir `Otro`.
- Target: `10`.
- Regla: `Diferencia de 2`.
- Elegir cualquier jugador como primer sacador.
- Equipo B gana el TB `10-8`.

### Resultado esperado
- el partido termina inmediatamente;
- NO aparece tercer set normal;
- NO pregunta nuevo sacador para continuar;
- score regular permanece `6-3 · 4-4`;
- se agrega segmento `TB 8-10`;
- ganador del partido: Equipo B;
- Resumen muestra correctamente el TB decisivo;
- Historial muestra correctamente el TB decisivo;
- BRAMU Intelligence dice que el partido fue resuelto mediante ese TB;
- no aparecen games, holds o breaks ficticios.

---

# 9. REGRESIONES MÍNIMAS

Además del caso crítico:

### Caso A
Mismo escenario, pero Equipo A gana el TB.

Debe terminar inmediatamente y Equipo A debe ser ganador.

### Caso B
Tie break reglamentario normal a 6-6.

Debe comportarse exactamente como antes.

### Caso C
Partido reglamentario normal sin TB extraordinario.

Debe comportarse exactamente como V12.

### Caso D
Progresión de puntos con Set Point visible.

La barra no cambia de posición.

### Caso E
Progresión durante TB extraordinario.

Debe seguir visible en su barra fija.

### Caso F
Ajuste manual.

Las métricas parciales muestran `*` y una única nota explicativa; no aumentan la altura individual de las tarjetas.

---

# 10. ENTREGA

Implementar esta ronda como:

**V12.1**

Antes de cerrar:

1. correr toda la batería existente de V12;
2. agregar los tests mínimos necesarios para esta nueva semántica;
3. verificar que los 166 tests anteriores sigan verdes o actualizar únicamente aquellos cuya expectativa cambió legítimamente por la nueva regla;
4. prueba manual rápida en tablet horizontal y celular;
5. commit + push + tag/versionado según el flujo actual;
6. confirmar GitHub Pages;
7. entregar reporte corto para Sebastián/ChatGPT.

---

# PRINCIPIO FINAL

`RESOLVER CON TIE BREAK` no significa:

> “agregar un Tie break al set y después seguir jugando”.

Significa:

> **“terminamos el formato normal acá y este Tie break decide el partido”.**

El marcador previo queda intacto y el Tie break se guarda como un segmento decisivo extraordinario.

V12.1 debe corregir eso, ordenar los pequeños problemas visuales detectados y no abrir ninguna otra rama de producto.
