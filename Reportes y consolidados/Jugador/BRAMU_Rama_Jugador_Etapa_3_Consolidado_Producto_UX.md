# BRAMU Lab — Rama Jugador
## Etapa 3: consolidado de producto, UX y preparación técnica

**Estado del documento:** especificación para análisis y planificación.  
**Instrucción inmediata para Claude:** leer este documento, inspeccionar el repositorio y devolver un plan detallado. **No implementar, no editar código, no commitear y no hacer push hasta recibir aprobación.**

---

## 1. Objetivo de esta etapa

La Rama Jugador debe empezar a expresar el concepto central de BRAMU:

> **Dónde vive tu pádel.**

El loop principal buscado es:

1. El jugador carga su partido de forma simple.
2. BRAMU actualiza su historia con la fecha real del encuentro.
3. El Home muestra su identidad, su último partido, su momento y patrones básicos.
4. El usuario puede volver al partido, revisarlo o cargar el siguiente.

BRAMU Intelligence es una consecuencia valiosa de los datos disponibles, no el centro de esta experiencia.

Esta etapa debe resolver estructura, comportamiento, jerarquía y datos. La renovación global de colores, tipografías e iconografía queda para una etapa visual posterior.

---

# IMPLEMENTAR AHORA

> Los puntos siguientes describen el alcance funcional y estructural deseado. Claude debe primero convertirlos en un plan por fases y detectar dependencias, riesgos y conflictos con el código actual.

## 2. Separar la versión pública del marcador y la Rama Jugador

### Problema

La URL actual fue compartida con amigos para que prueben la versión potente del marcador. La Rama Jugador ya empezó a publicarse sobre esa misma ruta, por lo que las pruebas nuevas pueden quedar visibles y arruinar la sorpresa.

### Resultado requerido

- La URL ya compartida debe quedar congelada con la última versión estable del marcador anterior a la Rama Jugador.
- La Rama Jugador debe continuar en una ruta nueva, privada por desconocimiento del enlace durante el desarrollo.
- Ambas versiones podrán reunificarse más adelante, pero por ahora deben convivir sin interferirse.

### Plan técnico que Claude debe proponer

1. Identificar con precisión el último commit estable del marcador que se quiere conservar en la URL anterior.
2. Preservar primero el estado actual de la Rama Jugador en una nueva carpeta/ruta, por ejemplo `bramu-player/` o un nombre equivalente justificado.
3. Restaurar únicamente la ruta anterior del marcador al commit estable identificado, sin perder el trabajo nuevo.
4. Separar PWA y caché entre ambas rutas:
   - `manifest` e identificador;
   - `start_url` y `scope`;
   - service worker y alcance;
   - nombres/versiones de caché.
5. Separar el almacenamiento de la Rama Jugador. `localStorage` se comparte por origen aunque cambie la ruta, por lo que las claves nuevas no deben contaminar los datos del marcador anterior.
6. Explicar cómo se probarán ambas URLs antes del despliegue.

**No ejecutar esta separación hasta que el plan, el commit elegido y las rutas sean aprobados.**

---

## 3. Corregir la semántica de fecha

### Problema comprobado

El Home y el Historial pueden considerar como “último” el último partido guardado, aunque su fecha de juego sea anterior. También se observó que el Historial puede mostrar la fecha de carga en lugar de la fecha declarada por el usuario.

### Regla

- `playedAt`: fecha y hora real en que se jugó el partido.
- `createdAt`: momento técnico en que se guardó en BRAMU.
- “Último partido”, Forma Reciente, Tu Momento, rachas y orden del Historial deben usar `playedAt`.
- `createdAt` no debe alterar la historia deportiva.
- Ante igualdad exacta de `playedAt`, utilizar un desempate determinístico documentado.

### Compatibilidad

Claude debe proponer cómo interpretar partidos históricos que no tengan todavía un `playedAt` explícito, sin romper el historial existente.

### Prueba imprescindible

1. Cargar un partido de hoy.
2. Después cargar uno de ayer.
3. El partido de hoy debe seguir siendo Último Partido y el orden de la forma reciente no debe cambiar incorrectamente.

---

## 4. Acceso central para registrar

La barra inferior conserva por ahora sus cinco accesos actuales:

- Inicio;
- Historial;
- botón central `+`;
- Ranking;
- Perfil.

Los nombres y accesos podrán revisarse más adelante. En esta etapa no se reemplaza Ranking por Grupos.

### Nuevo comportamiento del `+`

El botón abre una hoja de acciones con este orden:

1. **Cargar mi partido jugado** — opción principal y de uso habitual.
2. **Registrar partido en vivo** — abre la selección del modo existente:
   - Completo;
   - Por Games.

No agregar “Estoy jugando / Estoy mirando”. En el producto futuro, el registro en vivo se interpreta como un registro realizado por un espectador. El marcador completo y Por Games existentes deben conservar su funcionamiento.

---

## 5. Rediseñar “Cargar partido jugado”

La pantalla actual ocupa demasiado espacio antes de llegar al resultado. La nueva experiencia debe sentirse como completar un marcador, no como llenar un formulario largo.

### 5.1 Estructura general

- Cabecera enfocada con volver + `CARGAR PARTIDO JUGADO`.
- Sin barra inferior durante el flujo.
- Marcador visible en la parte superior mientras se cargan los datos.
- Dos equipos en filas y hasta tres sets en columnas.
- Los jugadores de cada pareja se muestran de forma compacta dentro de su fila.
- Separador visual sobrio entre Equipo A y Equipo B, inspirado en la tabla del Resumen actual.

### 5.2 Jugadores

- El jugador identificado ocupa automáticamente el primer lugar del Equipo A.
- Debe verse su nombre real (`Seba`, `Sebastián`, etc.), no el texto genérico `Vos`.
- Ese lugar no es editable desde este flujo.
- Se eligen compañero y dos rivales.

#### Selector beta

Al tocar un lugar de jugador se abre una hoja inferior con:

1. sugeridos recientes en desplazamiento horizontal, con avatar o iniciales y nombre corto;
2. un único buscador que filtra mientras se escribe;
3. coincidencias de nombres ya conocidos localmente;
4. opción final `Agregar “[nombre]” como jugador sin cuenta`.

Reglas:

- priorizar jugadores usados recientemente;
- excluir al usuario actual y a los jugadores ya seleccionados;
- no exigir que la otra persona tenga una cuenta;
- reutilizar los datos locales existentes y no construir todavía backend, amigos ni búsqueda real por `@usuario`.

La interacción toma como referencia el patrón conocido de transferencia de Mercado Pago, sin copiar su estética.

### 5.3 Formato y sistema de puntuación

Reemplazar los bloques grandes por una sola línea compacta, por ejemplo:

`Clásico · Mejor de 3 · Punto de Oro  ›`

Al tocarla se abre una hoja o modal que reutiliza las opciones existentes de:

- Clásico / Americano;
- Star Point / Punto de Oro / Con Ventaja.

No duplicar la lógica existente. Mantener los defaults actuales acordados para la carga habitual.

### 5.4 Carga del resultado

- Cada número del marcador es una celda individual.
- Al tocar una celda aparece un panel numérico propio, inspirado en la disposición del teclado telefónico:

  `1 2 3`  
  `4 5 6`  
  `7 8 9`  
  `borrar 0 siguiente`

- El marcador permanece visible arriba y la celda activa queda claramente indicada.
- En un set normal, 0–7 están activos; 8 y 9 pueden permanecer visibles pero deshabilitados.
- En contextos de tie-break/súper tie-break, se habilitan todos los números y la carga admite más de un dígito.
- En sets normales, una selección puede avanzar automáticamente a la celda contigua.
- En tie-break, se usa `Siguiente`, porque un `1` puede convertirse en `10`, `11`, `12`, etc.
- El tercer set aparece automáticamente cuando los dos primeros dejan el partido 1–1.
- Un tie-break de set se registra como `7–6` o `6–7`; sus puntos internos no cuentan como games. El detalle exacto del tie-break puede quedar para una mejora posterior si complejiza esta etapa.

### 5.5 Validación del resultado

En esta etapa solo se cargan resultados compatibles con el formato elegido.

- No permitir guardar un partido incompleto o imposible.
- Explicar el problema específico; evitar mensajes genéricos.
- El botón Guardar permanece deshabilitado mientras falten datos o el resultado sea inválido.
- No implementar todavía Partido Libre, amistosos con formatos arbitrarios ni partidos interrumpidos.

Claude debe reutilizar o aislar reglas puras y cubrirlas con tests; no distribuir validaciones frágiles directamente por el DOM.

### 5.6 Fecha, hora y lugar

- Fecha y hora visibles debajo del marcador.
- Default: momento actual, siempre editable.
- Lugar o club: opcional.
- El guardado debe persistir esta fecha/hora como `playedAt`.

### 5.7 Salida y regreso

- Volver cierra primero cualquier teclado/hoja abierta.
- Si no hay cambios, vuelve al Home.
- Si hay cambios sin guardar, pregunta `¿Salir sin guardar?`.

### 5.8 Guardado y Resumen

La acción final es **Guardar partido**. Después del guardado:

- abrir un Resumen de lectura, como comprobación final de lo cargado;
- mostrar victoria/derrota, resultado completo, jugadores, fecha, hora, lugar, formato, sets y games disponibles;
- mostrar una devolución breve de BRAMU Intelligence solo cuando sea factual con esos datos;
- no enviar a una pantalla separada de Análisis si únicamente repite información débil;
- ofrecer `Volver a Mi pádel` y `Editar partido`.

Editar debe reabrir la misma pantalla con los datos precargados. También debe quedar accesible desde el detalle del partido.

---

## 6. Reorganizar el Home del jugador

Orden acordado:

1. Hitos personales.
2. Tarjeta de jugador.
3. Último partido.
4. Tu Momento.
5. Actividad + Efectividad.
6. Métricas pequeñas.

### 6.1 Hitos personales

- Franja horizontal desplazable.
- No son misiones genéricas ni botones promocionales.
- Deben contar algo específico de la historia del usuario.
- Ejemplos válidos:
  - `Una victoria más para igualar tu mejor racha`;
  - `Ganaste 3 de los últimos 4 con Matu`;
  - `Este es tu período más activo`.
- Mostrar únicamente hitos que puedan justificarse con el historial disponible.
- Si no hay información suficiente, usar un estado inicial honesto o no mostrar la franja.

### 6.2 Tarjeta de jugador

Nombre interno del componente: **Tarjeta de jugador**. Una futura versión pública podrá llamarse **Ficha del jugador**.

Estructura visual elegida, basada en la alternativa 3 revisada:

- avatar más grande; por ahora puede usar iniciales y debe admitir una foto futura;
- nombre visible limpio;
- cantidad real de partidos en la historia;
- bloque `NIVEL BRAMU` a la derecha;
- nivel grande de demostración, por ejemplo `5.3`;
- cambio compacto con flecha semántica, por ejemplo `↑ 0.2`, sin el texto `En ascenso`;
- barra de progreso a todo el ancho útil;
- no mostrar Categoría, Ranking global, Tendencia ni el badge `DATOS DEMO · BETA`;
- no mostrar los cinco resultados recientes en esta tarjeta.

Como todavía no existe un algoritmo real, Nivel y variación deben quedar centralizados como datos demo reemplazables y no fingir un cálculo. El número real de partidos sí debe derivarse del historial.

No implementar todavía:

- cuenta real;
- `@username` único;
- QR funcional;
- edición de perfil completa;
- pantalla detallada de Nivel BRAMU.

La estructura futura debe poder incorporar `@username` y un ícono de QR sin rehacer la tarjeta.

### 6.3 Último partido

La jerarquía toma como referencia la claridad de VIBERO, sin copiar su diseño.

Contenido:

- parte superior izquierda: cinco indicadores compactos de resultados recientes;
- el partido actual es el último indicador a la derecha;
- ese indicador puede tener un glow/pulso verde o rojo muy sutil, usando como referencia la animación existente de Punto de Oro/Star Point;
- parte superior derecha: fecha real con formato exacto `02SEP · 22:30`;
- lugar en una segunda línea si fue cargado;
- título `ÚLTIMO PARTIDO`;
- etiqueta pequeña `VICTORIA` o `DERROTA`;
- resultado como dato protagonista: `6–1 · 0–6 · 6–4`;
- parejas en texto secundario: `Seba / Matu` y `Esteban / Gusti`;
- chevron discreto;
- toda la tarjeta abre Resumen/Detalle.

Eliminar de esta tarjeta:

- `PARTIDO CARGADO`;
- link separado `VER DETALLE`;
- información redundante.

#### Estado vacío

- título `ÚLTIMO PARTIDO`;
- texto `Tu historia empieza con tu primer partido`;
- acción `+ CARGAR PRIMER PARTIDO`;
- la tarjeta completa puede iniciar el mismo flujo del botón central;
- no mostrar indicadores de forma antes de que exista historia.

### 6.4 Tu Momento

- Mantenerlo como relato breve y determinístico de la historia reciente.
- No inventar patrones.
- Diferenciarlo de los Hitos: el hito es puntual; Tu Momento resume una situación más completa.
- Como máximo combinar dos datos fuertes, siguiendo el criterio actual.

### 6.5 Actividad y Efectividad

Dos tarjetas de mayor jerarquía visual:

#### Actividad

- partidos válidos jugados en una ventana móvil de últimos 30 días, no mes calendario;
- cuatro bloques/barras cronológicos que resuman ese período;
- altura o extensión representa cantidad de partidos;
- porción lima representa victorias y porción apagada derrotas;
- aclarar qué sucede con resultados neutrales o partidos futuros sin validación cuando ese modelo exista.

#### Efectividad

- porcentaje de victorias sobre partidos considerados durante los últimos 30 días;
- representación circular/donut;
- número grande y muestra: `67% · 6 de 9`;
- estado vacío honesto si no hay partidos.

### 6.6 Métricas pequeñas

Cuatro tarjetas:

1. Racha actual.
2. Partidos totales registrados en la historia.
3. Mejor compañero histórico, con mínimo de muestra aproximado de 3 partidos, porcentaje y cantidad.
4. Rival más enfrentado histórico.

Responsive:

- móvil: grilla 2×2;
- tablet/desktop: una fila de cuatro;
- Actividad y Efectividad deben conservar mayor peso que estas métricas.

### 6.7 Eliminar o reemplazar componentes actuales

- Eliminar la tarjeta independiente Forma Reciente; sus indicadores pasan a Último Partido.
- Reemplazar Partidos Este Mes por Actividad de últimos 30 días.
- Reemplazar Mejor Racha por Racha Actual dentro de las métricas pequeñas.
- Mantener el valor de compañero y rival, mejorando su contenido.

---

## 7. Historial: corrección inmediata y preparación

### Implementar ahora

- Ordenar siempre por `playedAt` descendente.
- Mantener una única línea temporal.
- Asegurar que el detalle del partido muestre la fecha real jugada.
- No inventar todavía autores, validaciones o estados que no existen en el modelo actual.

### Preparar visualmente sin sobreconstruir

La referencia de pestañas horizontales de Mercado Pago puede utilizarse más adelante como componente de filtro. La futura propuesta es:

- Todos;
- Mis partidos;
- Observados;
- Pendientes, con contador.

La modalidad Resultado / Por Games / Completo será un filtro secundario, no una pestaña principal.

No implementar ahora pestañas vacías o ficticias si todavía no existen registros observados y validaciones.

---

## 8. Criterios visuales para construir esta etapa

### Qué sí debe influir ahora

- Construir los componentes nuevos con clases reutilizables y roles semánticos.
- Evitar nuevos colores hardcodeados: usar variables o aliases semánticos.
- Evitar sumar nuevos emojis del sistema como iconos de interfaz.
- Reutilizar el lenguaje de SVG existente cuando sea suficiente.
- Definir roles tipográficos y de espaciado para los componentes nuevos, aunque la escala global se formalice después.
- Reservar el glow solo para estados realmente importantes.
- Mantener la estructura desacoplada de la paleta para poder aplicar el rediseño global sin rehacer HTML/JS.

### Qué no debe modificarse todavía

- No aplicar todavía una paleta global nueva.
- No cambiar todavía Oswald/Manrope por Inter, Archivo u otra familia.
- No redibujar ahora todo el sistema de iconos.
- No unificar de manera masiva radios, sombras y espaciados del CSS existente.
- No aplicar el moodboard a todas las pantallas.

### Dirección visual futura acordada para continuar explorando

El documento `BRAMU_Direccion_Visual_Moodboard_Analisis.md` funciona como guía atmosférica, no como especificación ejecutable.

La dirección más compatible con lo conversado es una mezcla de:

- **B — Arena/Túnel:** base casi negra con matiz azul, premium y contenida;
- **A — Cancha nocturna:** azul como estructura, reflejo y fuente de luz;
- verde lima eléctrico como único foco de acción, inspirado en la pelota.

Por ahora se descarta incorporar un tercer acento cálido permanente. La calidez de BRAMU debe aparecer primero mediante contenido humano, recuerdos, fotografías y lenguaje, no necesariamente mediante coral/naranja.

Pendientes de la futura etapa visual:

- cerrar valores HEX;
- separar color de interfaz de colores Equipo A/Equipo B;
- comparar Inter y Archivo en pantallas reales;
- unificar escalas tipográficas, radios, espaciado y scrims;
- reemplazar emojis por un sistema coherente;
- explorar el `rastro/pulso de evolución` como firma propia;
- diseñar spotlight, memoria y momentos sin caer en gamer/sci-fi.

---

# DOCUMENTAR PARA FUTURO — NO IMPLEMENTAR AHORA

## 9. Autor, participantes y validación

Claude debe leer también `BRAMU_Backlog_Futuro_Validacion_Partidos.md` como contexto arquitectónico. No debe construir todavía estas funciones.

Principios ya definidos:

- quien registra un partido no necesariamente lo juega;
- un partido cargado por un participante queda pendiente hasta que confirme al menos un rival;
- alcanza con un participante por equipo para la validación social habitual;
- las correcciones llevan nota y generan una nueva confirmación;
- un registro realizado por un espectador es Observado e informativo;
- un Observado nunca altera Nivel BRAMU, ranking, efectividad, rachas ni estadísticas oficiales;
- `Los de afuera son de palo` puede convertirse en microcopy explicativa;
- Nivel BRAMU usa participantes, resultado final, fecha, formato y validación, no puntos/breaks/highlights;
- rankings con premios necesitarán una capa adicional de validación mediante club, torneo u organizador.

Estados futuros:

- Pendiente;
- Validado;
- Disputado;
- Observado.

Claude debe evitar decisiones incompatibles con esta dirección, pero no debe agregar campos ficticios o lógica muerta sin justificarlo en el plan.

## 10. Nivel BRAMU

- Menor número de categoría significa mayor nivel.
- Ejemplo de progreso: `6.9 → 6.8 → … → 6.0 → 5.9 → …`.
- La categoría declarada podrá ser la semilla inicial del Nivel.
- El algoritmo futuro deberá comparar la fuerza combinada de ambas parejas, mover más ante resultados inesperados y limitar el movimiento por partido.
- La cantidad de partidos no hace mejor al jugador; aumenta la confianza de la estimación.
- No implementar algoritmo, ranking ni pantalla detallada en esta etapa.

## 11. Funciones futuras estacionadas

- cuentas, autenticación y base de datos;
- display name separado de `@username` único;
- QR y asociación retrospectiva de invitados;
- amigos, jugadores recientes y perfiles públicos;
- grupos privados y rankings por grupo/zona/país;
- rankings con premios;
- Partido Libre y resultados excepcionales;
- gráfico completo de evolución del jugador;
- personalización y reordenamiento del Home;
- widgets configurables;
- integración con smartwatch, calorías, pulsaciones y distancia;
- fotos y recuerdos asociados a partidos;
- validación por clubes, torneos u organizadores.

---

# NO TOCAR

## 12. Protección del producto existente

- No modificar el motor de puntuación del marcador en vivo.
- No alterar la lógica probada de Completo y Por Games salvo el nuevo punto de acceso previo.
- No reescribir BRAMU Intelligence del marcador completo.
- No romper compatibilidad con el historial existente.
- No borrar datos locales durante una migración.
- No rediseñar globalmente Resumen, Análisis o partido en vivo en esta etapa.
- No introducir backend, servicios externos ni dependencias pesadas.
- No hacer commit ni push hasta que Sebastián pruebe y apruebe.

---

## 13. Pruebas y criterios de aceptación

El plan debe contemplar tests unitarios para toda función pura nueva y verificación manual mobile/tablet.

Casos mínimos:

1. Identificar el commit exacto que preservará la URL antigua.
2. Verificar que las dos rutas/PWA/cachés/storage no se interfieran.
3. El `+` ofrece primero Cargar mi partido y después Registrar en vivo.
4. Registrar en vivo conserva Completo y Por Games sin regresiones.
5. La carga manual abre con el jugador actual fijo y visible por su nombre.
6. El selector no permite duplicar jugadores.
7. Un 1–1 habilita el tercer set.
8. Resultados imposibles no se guardan y explican el error.
9. Fecha y hora elegidas persisten como fecha jugada.
10. Cargar hoy y después ayer mantiene hoy como Último Partido.
11. Forma, Hitos, Actividad y Efectividad usan fecha real.
12. Guardar abre Resumen; Editar vuelve precargado; Volver regresa al Home actualizado.
13. Home vacío y Home con 1, 3 y 5+ partidos muestran estados honestos.
14. Las métricas no inventan patrones con muestras insuficientes.
15. El Historial mantiene compatibilidad y orden por fecha real.
16. El partido en vivo continúa funcionando sin barra inferior superpuesta.
17. La suite completa preexistente sigue en verde.

---

## 14. Entrega solicitada a Claude antes de programar

Claude debe responder con:

1. diagnóstico breve del estado actual;
2. commit propuesto para congelar la URL anterior y evidencia de por qué;
3. propuesta de ruta/nombre para la Rama Jugador;
4. plan dividido en fases pequeñas y testeables;
5. archivos que se crearían o modificarían por fase;
6. estrategia de compatibilidad/migración de fechas e historial;
7. estrategia de separación de PWA, service worker, caché y storage;
8. estrategia de componentes para no duplicar DOM/CSS/lógica;
9. riesgos y decisiones todavía ambiguas;
10. plan de tests automáticos y pruebas manuales;
11. confirmación explícita de que todavía no modificó código.

Después de revisar ese plan se decidirá qué fases implementar y en qué orden.

