# BRAMUlab — Handoff sistema visual unificado Home / Historial / Resumen post-h20

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline de partida:** BRAMUlab V04.11 / bundle `04.11-h20`  
**Estado:** LISTO PARA IMPLEMENTAR EN UNA ÚNICA TANDA  
**Objetivo de bundle:** `04.11-h21`

Este handoff reemplaza como especificación activa a los ajustes visuales parciales anteriores sobre Home/Historial/Resumen. No releer Laboratorio ni reconstruir decisiones viejas: todo lo vigente para esta ronda está acá.

No tocar main, Production, BRAMUlive ni Mis grupos.

---

# 1. Principio de sistema

Dejar de resolver cada estado como parche independiente.

Home, Último partido, Historial y Resumen deben compartir el mismo lenguaje:

- **ámbar** = algo todavía está pendiente / requiere resolución;
- **verde** = victoria o aceptación/confirmación positiva;
- **rojo** = derrota o acción de error;
- resultado deportivo y estado operativo son capas distintas;
- un partido todavía pendiente NO se vuelve verde solo porque tenga un CTA positivo;
- estructura visual estable: cambia copy/color/acción, no el componente entero.

Validar un partido nuevo y responder una corrección son dos variantes de la misma familia: decidir sobre un resultado.

---

# 2. Home — carrusel superior

## Recuperar la intención correcta

El carrusel superior contiene:
1. acciones que requieren respuesta;
2. estados de espera relevantes;
3. insights contextuales cortos tipo `Ganaste 2 de tus últimos 3 con Matu`.

**TU MOMENTO NO pertenece al carrusel.**
Debe volver a su lugar anterior debajo de Último partido.

## Formato

Tomar como referencia exacta de tamaño la tarjeta celeste histórica:
`Ganaste 2 de tus últimos 3 con Matu.`

Todas las slides del carrusel deben:
- tener esa misma altura;
- tener ancho parcial, NO ocupar todo el viewport;
- dejar ver parte de la siguiente tarjeta para comunicar que hay carrusel;
- usar misma geometría;
- cambiar solo acento/color/contenido.

No apilar tarjetas del carrusel verticalmente.

## Prioridad

Mantener el criterio ya existente:
1. lo que requiere acción del usuario;
2. correcciones abiertas / esperas relevantes;
3. insights/tips cotidianos.

No duplicar TU MOMENTO dentro del carrusel.

## Copy

Partido por confirmar:
- título: `PARTIDO POR CONFIRMAR`;
- texto específico con actor real cuando esté disponible.

Corrección en Home:
- si la lista liviana no permite saber honestamente quién propuso, mantener copy neutral;
- no inventar actor.

Estados de espera:
- copy específico y humano.

---

# 3. Home — Último partido: sistema único de estados

Mantener la geometría ya conseguida:

**Renglón 1**
- Último partido izquierda;
- fecha/hora derecha.

**Renglón 2**
- forma + Victoria/Derrota izquierda;
- estado operativo derecha.

Aplicar a TODOS los estados:
- Confirmar partido;
- Esperando validación;
- Corrección pendiente/abierta;
- identidad cuestionada;
- otros estados reales.

Reglas:
- sin tercera línea;
- sin pills que aumenten altura;
- sin bajar los puntos de forma;
- texto compacto;
- estado pendiente siempre con acento ámbar.

`CONFIRMAR PARTIDO` debe verse ámbar, no verde.
`ESPERANDO VALIDACIÓN` ámbar.
`CORRECCIÓN...` ámbar.

La victoria/derrota conserva su propio verde/rojo como dato deportivo.

---

# 4. Home — Nivel BRAMU

La animación de entrada de la barra volvió en h19/h20 y debe conservarse.

Además recuperar el indicador de **delta real del último cambio de Nivel** cuando exista evidencia:

- subida: `↑ 0.1` (ejemplo);
- bajada: equivalente negativo;
- sin cambio real disponible: no mostrar nada.

Usar únicamente datos reales existentes de Nivel / level events. No fabricar ni inferir un delta.

La referencia visual es el componente histórico que mostraba el delta sobre/junto a la barra.

No tocar fórmula ni cálculo del Nivel.

---

# 5. Resumen — metadata superior

Unificar la cabecera en DOS líneas.

## Línea 1 — autoría / estado

Ejemplo oficial:
`Cargado por Esteban · Confirmado por Seba`

Pendiente:
`Cargado por Esteban · Por confirmar`

Si corresponde actor-relativo y existe dato real:
`Cargado por Esteban · Te toca confirmar`

Todo en un mismo lenguaje tipográfico; no tres estilos distintos.

## Línea 2 — fecha + partido

Formato:
`27 SEP 26 · 20:28 · Clásico · Punto de Oro`

Reglas:
- fecha corta `DD MMM AA`;
- mes abreviado en mayúsculas;
- hora `HH:MM`;
- `Clásico` / `Punto de Oro` en sentence/title case, NO todo en mayúsculas;
- mismo tamaño/color secundario para toda la línea.

---

# 6. Resumen — partido nuevo pendiente de validación

Resultado todavía provisional:
- tarjeta con acento/borde ámbar;
- no tratarlo como oficial cerrado.

El estado `Te toca confirmar este resultado` no debe quedar como caja huérfana afuera.
Debe integrarse dentro de la tarjeta provisional, en jerarquía secundaria.

## Acciones para quien debe responder

Fila de dos botones del mismo tamaño:

**izquierda:** `Reportar un error`  
**derecha:** `Confirmar resultado`

Criterio:
- acción afirmativa a la derecha;
- error/cancelación a la izquierda;
- misma altura/ancho;
- confirmar con acento verde pero sin convertir todo el estado en verde;
- reportar error con acento rojo discreto;
- sentence case.

No usar un CTA lima macizo gigante.

## Para quien cargó el partido

Dentro de la misma tarjeta:
`Esperando que Seba / Gusti confirme este resultado.`

Texto más chico/secundario.
No mostrar acciones de confirmación propias.

---

# 7. Resumen — corrección sobre partido ya oficial

La tarjeta de corrección sigue siendo una única unidad:
1. título;
2. resultado propuesto;
3. explicación humana;
4. estado de espera o acciones;
5. Reportar un error cuando corresponda.

Mantener borde/glow ámbar sutil.

Eliminar textos redundantes/diff técnico.

## Acciones para quien debe decidir

Primera fila, dos botones iguales:

**izquierda:** `Mantener resultado actual`  
**derecha:** `Aceptar corrección`

Debajo:
`Reportar un error` ancho completo.

Reglas:
- aceptar a la derecha;
- aceptar: borde/texto verde, fondo oscuro/transparente;
- mantener actual: neutro;
- Reportar un error: rojo suave;
- todos sentence case;
- no usar `Rechazar`.

`Mantener resultado actual` significa exactamente: la propuesta nueva no se acepta y se conserva el resultado oficial vigente.

## Para quien propuso

No mostrar aceptar/mantener.
Integrar dentro de la tarjeta:
`Esperando respuesta de la otra pareja.`

---

# 8. Resumen — partido ya oficial sin pendiente

Limpiar el fondo de pantalla.

## Sacar
- botón grande `VOLVER AL INICIO` (redundante con bottom nav);
- `OCULTAR PARTIDO` del Resumen.

## Reportar un error
Moverlo al final del contenido principal del partido:
- después de Intelligence / Notas privadas;
- antes del logo/cierre final;
- secundario, rojo suave.

El logo BRAMUlab al fondo se conserva.

---

# 9. Historial — pestañas visibles

Recuperar el patrón de pestañas que BRAMU ya tuvo, ahora con categorías útiles:

1. `Todos`
2. `Pendientes`
3. `Victorias`
4. `Derrotas`
5. `Ocultos`

Mostrar conteo al lado de cada etiqueta cuando exista, siguiendo el patrón histórico.

Si cinco tabs no entran cómodamente:
- fila horizontal desplazable;
- no reducir tipografía hasta hacerla ilegible;
- conservar estado activo claro.

## Semántica

### Todos
- partidos visibles del historial;
- incluye propios y observados si hoy forman parte del historial general;
- NO incluye ocultos.

### Pendientes
Partidos visibles con estado operativo todavía no cerrado:
- pending_validation;
- corrección activa abierta;
- estados reales equivalentes que ya expone la app y requieren acción o espera de otra parte.

No inventar pendientes nuevos.

### Victorias
- solo partidos propios;
- resultado oficial/validado;
- victoria desde la perspectiva del usuario;
- NO incluir pendientes.

### Derrotas
- solo partidos propios;
- resultado oficial/validado;
- derrota desde la perspectiva del usuario;
- NO incluir pendientes.

### Ocultos
- partidos que el usuario ya ocultó mediante el mecanismo existente;
- no cambiar semántica ni backend;
- siguen existiendo para demás participantes y siguen conservando sus efectos deportivos oficiales según el contrato actual.

Los observados pueden seguir apareciendo en `Todos`; no necesitan pestaña propia en esta ronda.

---

# 10. Historial — ocultar / volver a mostrar

NO crear backend nuevo.

Reutilizar el mecanismo existente `hide_match_for_me`.

## Visible

Tap corto sobre tarjeta:
- abre Resumen como hoy.

Long press sobre tarjeta:
- abre acción contextual simple para `Ocultar partido`;
- usa la confirmación/semántica actual;
- no borra ni altera el partido compartido.

## Pestaña Ocultos

Mostrar los partidos ocultos que ya llegan en la lectura con includeHidden.

Long press:
- acción `Volver a mostrar`;
- reutilizar el mismo mecanismo actual con hidden=false.

No poner `Ocultar partido` en Resumen.

Implementar long press sin interferir con scroll/tap:
- cancelar long press si el dedo se desplaza;
- evitar abrir Resumen al soltar después de un long press;
- mantener accesibilidad razonable; si long press no es viable en desktop, ofrecer equivalente contextual simple (click derecho o menú visible discreto) sin introducir una gran UI nueva.

---

# 11. Historial — badges / estado

Alinear lenguaje con el sistema general:

- pendientes → ámbar;
- victoria oficial → verde;
- derrota oficial → rojo.

Evitar pills/etiquetas contradictorias o dobles si un estado operativo ya explica mejor la situación.

Para correcciones:
- si el contrato liviano no permite distinguir honestamente quién propuso, no inventar actor;
- usar copy neutral verdadero en Historial hasta que exista dato.

No abrir backend solo para mejorar ese copy en esta ronda.

---

# 12. Colores / jerarquía — regla única

**Ámbar:** todavía falta resolver/confirmar/corregir.  
**Verde:** victoria confirmada o acción afirmativa.  
**Rojo:** derrota confirmada o acción de error.  
**Neutro:** mantener estado actual / información secundaria.

No mezclar estado operativo con resultado deportivo.

---

# 13. Fuera de alcance

NO tocar:
- Mis grupos;
- backend/Supabase;
- main;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence lógica/datos;
- fórmula de Nivel;
- lógica de ocultar partido;
- semántica compartida de los partidos.

Mis grupos será una ronda propia después.

---

# 14. Implementación / pruebas

Ronda visual + presentación sobre lógica ya existente.

Antes de editar:
- revisar implementación actual h20;
- reutilizar helpers/contratos existentes;
- no duplicar lógica de filtros si ya existe;
- investigar delta de Nivel contra datos reales/historia antes de restaurarlo.

Pruebas focales:
- carrusel: Tu Momento fuera + tamaño/estructura única;
- estados Último partido ámbar y misma geometría;
- metadata Resumen;
- acciones validación/corrección y orden izquierda/derecha;
- eliminación de Volver al inicio/Ocultar partido del Resumen;
- tabs Historial;
- filtros Pendientes/Victorias/Derrotas/Ocultos;
- ocultar/desocultar reutilizando contrato actual;
- delta Nivel solo con dato real;
- bundle/cache;
- smoke boot.

No declarar PASS visual por tests.

Hacer una única tanda, un único commit/push/deploy intencional si no aparece un bloqueo real.

---

# 15. Entrega

Crear:
`docs/BRAMUlab/Implementacion/Pre_Production/60_Resultado_Sistema_Visual_Unificado_h21_27SEP.md`

Incluir breve:
- cambios;
- cualquier desvío;
- investigación delta Nivel;
- tests;
- commit;
- deploy.

No pedir QA intermedio a Sebastián.

Terminar exactamente con:

`PENDIENTE DE REVISIÓN VISUAL DIRECTA DE SEBASTIÁN`
