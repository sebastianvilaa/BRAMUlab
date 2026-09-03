# BRAMU Lab — Etapa 4
## v2.0 · Experiencia integral del jugador

**Estado:** especificación cerrada y autorizada para implementación completa  
**Fecha:** 03 de septiembre de 2026  
**Aplicación activa:** `bramulab/`  
**Versión de partida:** v1.3.1  
**Versión objetivo:** v2.0  
**Aplicación protegida:** `bramulab-partidos/` v14 — no tocar

---

## 0. Instrucción ejecutiva para Claude

Esta etapa cambia el método de trabajo anterior.

Hasta v1.3.1 se implementaron piezas funcionales pequeñas y se pidió a Sebastián que probara entregas intermedias. El resultado fue una experiencia difícil de evaluar: el Home beta viejo convivía con flujos nuevos y no quedaba claro qué era definitivo, qué era provisional y qué todavía no había entrado.

En esta etapa se debe construir y entregar **un conjunto coherente**.

Claude puede dividir internamente el trabajo en subfases, hacer commits locales y verificar cada bloque, pero:

- no debe publicar versiones intermedias;
- no debe pedirle a Sebastián que pruebe piezas aisladas;
- no debe detenerse después de presentar un plan;
- debe implementar todo el alcance de este documento;
- solo debe interrumpir si encuentra un bloqueo real, una contradicción que pueda causar pérdida de datos o un riesgo para `bramulab-partidos/`;
- ante decisiones menores de composición visual, debe elegir la opción más coherente con estas reglas, documentarla y continuar;
- al finalizar debe probar el recorrido completo, publicar v2.0 y dejar un informe autosuficiente para revisión externa de ChatGPT.

**Esta instrucción autoriza código, tests, commit, tag, push y publicación final de v2.0**, una vez completados y verificados todos los bloques. No autoriza avanzar a funciones futuras fuera de alcance.

---

## 1. Documentos que se deben leer antes de tocar código

Leer completos, como contexto acumulativo:

1. `docs/bramulab/consolidados/BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`
2. `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md`
3. `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Consolidado.md`
4. `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Consolidado.md`
5. `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Consolidado.md`
6. `docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Informe.md`
7. `docs/bramulab/informes/BRAMU_Lab_v1.3.1_Hotfix_Transicion_Post_Guardado_Informe.md`
8. `docs/bramulab/backlog-futuro/BRAMU_Direccion_Visual_Moodboard_Analisis.md`, únicamente como dirección atmosférica, no como orden de rediseño global.
9. `docs/bramulab/backlog-futuro/BRAMU_Backlog_Futuro_Validacion_Partidos.md`, únicamente para no tomar decisiones incompatibles con el futuro.

En caso de contradicción, este documento contiene la decisión más reciente para la Etapa 4.

---

## 2. Objetivo de producto

Transformar la Rama Jugador actual en la primera experiencia integral y reconocible de **BRAMU Lab**.

La versión debe permitir que Sebastián abra la aplicación y entienda, sin contexto técnico:

- quién es dentro de BRAMU;
- cuánto sabe BRAMU de su historia;
- cuál fue su último partido;
- cuál es su momento reciente;
- cuánta actividad tuvo;
- cuál es su efectividad;
- cuáles son sus primeras métricas personales;
- cómo cargar un partido jugado;
- cómo registrar un partido en vivo;
- cómo continuar un partido en curso.

Principio rector:

> Registrar un partido es la causa. El Home muestra las consecuencias.

La v2.0 no es todavía el rediseño visual definitivo de toda la marca, pero sí debe sentirse como una sola aplicación y no como una suma de prototipos.

---

## 3. Regla de entrada y significado de “Inicio”

El Home real de BRAMU Lab es la pantalla de tarjetas del jugador.

Al abrir la app:

1. Si existe un partido en vivo activo, reabrir directamente ese partido en el punto exacto donde quedó.
2. Si no existe partido activo y ya hay jugador identificado, abrir el Home del jugador.
3. Si no hay jugador identificado, abrir la identificación simple y después el Home.

`Inicio`, `Home` y `Mi pádel` deben resolver al mismo destino: la pantalla de tarjetas.

La pantalla tradicional de configuración del marcador no es el Home. Se accede a ella únicamente después de elegir un modo de registro en vivo.

En el header del Home:

- mantener la marca BRAMU Lab;
- mantener la campana a la derecha;
- eliminar el acceso redundante `Configurar partido` del Home;
- no usar emojis del sistema como iconos definitivos.

---

## 4. Arquitectura final del Home v2.0

Orden obligatorio:

1. Hitos personales, solo cuando exista algo justificable.
2. Tarjeta de jugador.
3. Último partido.
4. Tu Momento.
5. Actividad + Efectividad.
6. Cuatro métricas pequeñas.

Eliminar la tarjeta independiente `Forma reciente`.

El Home debe refrescarse inmediatamente después de:

- guardar un partido;
- editar un partido;
- borrar un partido;
- cambiar de jugador;
- volver desde un partido finalizado.

Todas las tarjetas históricas deben usar `playedAt`, nunca el orden de guardado. Ante igualdad exacta de `playedAt`, usar un desempate determinístico documentado, preferentemente `createdAt` y luego `matchId`.

---

## 5. Hitos personales

Franja horizontal desplazable ubicada arriba de la tarjeta del jugador.

No son misiones genéricas, promociones ni consejos técnicos. Son observaciones breves justificadas por la historia real.

Ejemplos:

- `Una victoria más para igualar tu mejor racha`;
- `Ganaste 3 de los últimos 4 con Matu`;
- `Este es tu período más activo`.

Reglas:

- mostrar como máximo pocos hitos fuertes;
- no repetir el contenido de Tu Momento;
- no inventar patrones con muestras pequeñas;
- si no existe un hito real, ocultar la franja o usar un único estado inicial honesto;
- no convertirla en un carrusel promocional.

---

## 6. Tarjeta de jugador

Nombre interno definitivo del componente: **Tarjeta de jugador**.

Debe reemplazar por completo la tarjeta beta actual de categoría/ranking/tendencia.

### Contenido actual

- avatar claramente más grande; por ahora puede usar iniciales, pero la estructura debe admitir una foto futura;
- nombre visible limpio;
- cantidad real de partidos de ese jugador en la historia;
- bloque `NIVEL BRAMU` a la derecha;
- nivel grande de demostración centralizado, por ejemplo `5.3`;
- variación compacta, por ejemplo `↑ 0.2`, sin texto redundante;
- barra de progreso a todo el ancho útil.

### Eliminar

- Categoría;
- Ranking global;
- Tendencia;
- badge `DATOS DEMO · BETA`;
- últimos cinco resultados dentro de esta tarjeta.

### Semántica

La cantidad de partidos no representa cuán bueno es el jugador. Representa cuánto sabe BRAMU de él y, por lo tanto, cuánta confianza puede tener la estimación futura.

El nivel y la variación siguen siendo datos demo reemplazables. No improvisar un algoritmo.

### Preparación futura sin fingir funciones

El nombre visible será distinto del futuro `@username` único. Como todavía no existen cuentas reales, no fabricar un usuario falso.

La estructura debe poder incorporar `@username` y un icono QR en el futuro, pero v2.0 no debe mostrar un control muerto ni generar un QR ficticio.

No implementar todavía la pantalla detallada del Nivel BRAMU. La tarjeta puede estar preparada semánticamente para volverse interactiva después.

---

## 7. Último partido

Debe ser una de las tarjetas principales y tomar de VIBERO únicamente su claridad y jerarquía informativa.

### Jerarquía

- resultado completo por sets como dato protagonista;
- título `ÚLTIMO PARTIDO`;
- etiqueta compacta `VICTORIA` o `DERROTA` junto al título;
- parejas en información secundaria;
- cinco indicadores de resultados recientes en la parte superior izquierda, integrados como volanta;
- fecha y hora arriba a la derecha;
- lugar debajo de la fecha, únicamente si existe;
- chevron discreto;
- toda la tarjeta es tocable y abre Resumen/Detalle;
- no usar un link separado `VER DETALLE`.

Formato exacto de fecha:

`02SEP · 22:30`

Reglas:

- día siempre con dos dígitos;
- mes con tres letras mayúsculas y sin separador: `02SEP`;
- hora de turno en formato 24 horas cuando sea conocida;
- si la hora no fue cargada, no inventar `00:00`;
- el último indicador es el partido mostrado y puede tener un glow/latido verde o rojo muy sutil;
- la animación debe tomar como referencia la sutileza de Punto de Oro/Star Point, sin parpadeo ni efecto gamer;
- color no puede ser la única señal accesible.

Eliminar:

- `PARTIDO CARGADO`;
- tarjeta independiente `Forma reciente`;
- texto duplicado;
- acciones pequeñas sueltas.

### Estado vacío

- título `ÚLTIMO PARTIDO`;
- texto `Tu historia empieza con tu primer partido`;
- acción `+ CARGAR PRIMER PARTIDO`;
- la tarjeta completa puede iniciar el mismo flujo del botón central;
- no mostrar cinco indicadores vacíos.

### Prueba lógica obligatoria

Cargar un partido de hoy y después uno de ayer. El de hoy debe seguir siendo Último partido. Editar la fecha debe actualizar inmediatamente el orden del Home y del Historial.

---

## 8. Tu Momento

Mantener como relato breve, determinístico y humano.

- máximo dos señales fuertes;
- sin API de IA;
- sin consejos técnicos de golpes;
- sin repetir literalmente Hitos, Actividad o Efectividad;
- no dramatizar derrotas;
- con uno o dos partidos, reconocer que la historia empieza sin extraer conclusiones;
- con más información, resumir constancia, forma o relaciones recurrentes.

---

## 9. Actividad y Efectividad

Son dos tarjetas de mayor jerarquía que las métricas pequeñas.

### Actividad

- ventana móvil de últimos 30 días, no mes calendario;
- cuatro bloques o barras cronológicas que resuman el período;
- extensión/altura representa cantidad de partidos;
- porción lima representa victorias y porción apagada derrotas;
- mostrar muestra total;
- estado vacío honesto;
- no llamar `Partidos este mes`.

### Efectividad

- porcentaje de victorias sobre partidos considerados en los últimos 30 días;
- visual circular/donut;
- valor grande y muestra, por ejemplo `67% · 6 de 9`;
- estado vacío honesto;
- no calcular porcentajes engañosos cuando no hay muestra.

Los partidos futuros clasificados como Observados no deben alimentar estas métricas, pero no implementar todavía esos estados.

---

## 10. Métricas pequeñas

Cuatro tarjetas:

1. Racha actual.
2. Partidos totales registrados en la historia del jugador.
3. Mejor compañero histórico, con muestra mínima aproximada de tres partidos, porcentaje y cantidad.
4. Rival más enfrentado histórico.

Responsive:

- móvil: grilla 2×2;
- tablet/escritorio: una fila de cuatro;
- Actividad y Efectividad deben conservar mayor peso visual.

No fabricar conclusiones cuando falta muestra.

---

## 11. Navegación inferior y botón central

Mantener por ahora:

1. Inicio.
2. Historial.
3. `+` central.
4. Ranking.
5. Perfil.

Los destinos Ranking y Perfil pueden conservar el alcance funcional actual; no desarrollar todavía sus productos completos.

La barra:

- no aparece durante carga manual ni registro en vivo;
- no aparece encima del Resumen;
- respeta safe-area;
- no tapa contenido;
- usa iconos SVG coherentes, no círculos genéricos ni emojis;
- mantiene el `+` como acción principal.

---

## 12. Sistema de hojas inferiores

Unificar como componente el comportamiento de:

- `Registrar partido`;
- segundo nivel `Registrar en vivo`;
- elegir jugador;
- elegir formato y puntuación;
- notificaciones vacías cuando corresponda.

### Comportamiento y calidad

- entrar desde abajo;
- apoyarse visualmente en el borde inferior;
- ocupar todo el ancho útil de la aplicación en celular;
- en tablet/escritorio respetar el ancho de BRAMU Lab y quedar centrada, sin parecer una cajita flotante angosta;
- scrim correcto;
- drag handle discreto;
- cierre por gesto hacia abajo, toque exterior, cruz y Escape en escritorio;
- animación breve y natural;
- barra inferior sin interacción mientras la hoja está abierta;
- no copiar la estética de Mercado Pago, pero sí su claridad, familiaridad y jerarquía.

La captura actual del selector de jugadores se considera **funcional pero visualmente no aprobada**: es demasiado angosta y se percibe como un modal genérico separado de la aplicación.

---

## 13. Hoja “Registrar partido”

Sin partido en curso:

1. `Cargar mi partido jugado` — acción principal.
2. `Registrar partido en vivo`.

Segundo nivel de `Registrar partido en vivo`:

1. `Game por game`.
2. `Punto por punto`.

No agregar explicaciones redundantes ni marcar un modo como recomendado.

Con partido en curso:

1. tarjeta compacta con `PARTIDO EN CURSO`, parejas y resultado parcial completo;
2. acción `CONTINUAR` alineada a la derecha;
3. acción secundaria `Registrar partido nuevo`.

Si se elige registrar otro partido, advertir que el partido activo se cerrará y no se guardará. No descartarlo silenciosamente.

---

## 14. Franja de partido en curso en el Home

Cuando el usuario vuelve intencionalmente al Home durante un registro en vivo, mostrar una franja compacta arriba del resto del contenido.

- `PARTIDO EN CURSO` debe aparecer una sola vez;
- parejas o jugadores;
- marcador parcial completo, incluyendo sets anteriores y set actual cuando corresponda;
- modo `Game por game` o `Punto por punto`;
- `CONTINUAR` a la derecha;
- borde/acento lima eléctrico y latido mínimo;
- toda la franja puede ser tocable;
- no convertirla en una tarjeta gigante.

Cerrar y reabrir la app con partido activo debe volver directamente al marcador, sin pantalla intermedia de recuperación.

---

## 15. Cargar partido jugado — refinamiento visual sin cambiar la lógica aprobada

La lógica funcional de v1.3.1 queda preservada:

- jugador actual fijo;
- compañero y dos rivales;
- recientes, búsqueda y jugador sin cuenta;
- resultado por sets;
- validaciones;
- tercer set contextual;
- fecha, hora y lugar;
- formato compacto;
- Guardar → Resumen → Editar;
- edición sin duplicado.

### Selector de jugadores

Aplicar el sistema de hoja inferior del §12. Mantener recientes, buscador, lista y `Agregar como jugador sin cuenta`, pero mejorar jerarquía, espaciado, scroll, estados vacíos y ancho.

### Marcador

- debe sentirse como completar un resultado, no como un formulario administrativo;
- mantener equipos y sets legibles de un vistazo;
- evitar campos visualmente parecidos a inputs de texto comunes;
- destacar con claridad la celda activa;
- conservar colores semánticos de ambos equipos sin introducir una nueva paleta global.

### Teclado de resultado

El teclado actual es funcional pero **no está aprobado visualmente**. Se percibe grande, pesado y genérico.

Refinar la interacción existente sin alterar las reglas de validación:

- panel apoyado abajo;
- ancho completo en celular;
- ancho más contenido y centrado en tablet/escritorio, sin teclas gigantes;
- menor peso vertical, espacios más ajustados y jerarquía clara;
- indicar arriba qué set/equipo se está editando;
- `Borrar` y `Siguiente` deben leerse como acciones secundarias;
- usar foco propio accesible de BRAMU; eliminar el aro azul genérico del navegador sin eliminar la accesibilidad de teclado;
- conservar 0–7 activos y 8–9 deshabilitados en sets normales;
- conservar entrada de más de un dígito cuando el formato lo permita;
- conservar avance lógico entre celdas;
- no abrir el teclado nativo del dispositivo además del panel propio.

Si para evitar un diseño arbitrario Claude necesita elegir entre variantes menores, debe privilegiar: marcador visible, una mano, pocos toques y poco peso visual. Documentar la decisión; no detener el desarrollo para pedirle a Sebastián que diseñe el teclado desde cero.

---

## 16. Resumen posterior al guardado

Para un partido cargado manualmente:

- mostrar resultado, parejas, fecha, hora, lugar, formato, sets y games derivables;
- mantener devolución breve y factual de BRAMU Intelligence;
- mantener `EDITAR PARTIDO`;
- mantener `VOLVER AL INICIO` o reemplazar el texto por `VOLVER A MI PÁDEL` si resulta más coherente, siempre con destino al Home;
- eliminar `COMPARTIR` de esta pantalla.

En v2.0, eliminar también la acción visible `COMPARTIR` del Resumen activo general. La capacidad técnica puede conservarse sin exposición si se reutilizará más adelante, pero la acción no debe aparecer hasta definir un contexto de compartir más claro.

Después de guardar o editar:

- cerrar teclado y hojas;
- ocultar carga manual;
- mostrar únicamente el Resumen sobre un Home limpio;
- al volver, el Home ya debe reflejar la modificación.

---

## 17. Iconografía, tipografía y movimiento de esta versión

No aplicar todavía el moodboard como rediseño global, pero sí eliminar la sensación de prototipo en las superficies nuevas.

### Iconografía

- reemplazar campana emoji y emojis de interfaz del Home por SVG coherentes;
- un mismo grosor de trazo, caja y tamaño óptico;
- estados activos/inactivos consistentes;
- no incorporar una librería pesada.

### Tipografía

- conservar por ahora las familias existentes;
- Oswald para etiquetas/resultados que necesiten carácter;
- Manrope para lectura y controles;
- no usar mayúsculas en todos los textos indiscriminadamente;
- reservar mayúsculas para etiquetas cortas y estados;
- asegurar contraste y legibilidad antes que estilo.

### Movimiento

Definir tokens reutilizables de duración/easing, evitando valores dispersos.

Aplicar en esta etapa:

- entrada/salida de hojas inferiores;
- transición interna de niveles;
- glow/latido mínimo del último resultado y partido en curso;
- microrespuesta de botones y celdas.

Respetar `prefers-reduced-motion`.

La idea futura del pique de pelota que se transforma en tilde queda documentada como posible firma del sistema, pero no es obligatoria en v2.0.

---

## 18. Historial

En esta etapa:

- ordenar por `playedAt` descendente;
- mantener una única línea temporal;
- reflejar ediciones sin duplicar;
- usar fecha real jugada;
- mantener compatibilidad con partidos `manual`, `games` y `complete`;
- permitir abrir el detalle existente;
- no mezclar todavía autores o validaciones inexistentes.

No implementar todavía las pestañas `Todos / Mis partidos / Observados / Pendientes`. Preparar los componentes para poder incorporarlas cuando existan esos estados reales.

---

## 19. Estados del Home que deben quedar terminados

1. Sin partidos.
2. Un partido.
3. Dos o tres partidos.
4. Cinco o más partidos.
5. Mezcla de victorias y derrotas.
6. Partidos con y sin hora.
7. Partidos con y sin lugar.
8. Nombres cortos y nombres largos.
9. Partido a dos sets y a tres sets.
10. Partido cargado hoy después de haber cargado uno de ayer.
11. Partido activo en vivo con Home visitado intencionalmente.
12. Cambio de jugador actual.

Ningún estado debe mostrar datos demo como si fueran reales ni dejar huecos visuales rotos.

---

## 20. Arquitectura y preservación

- Preservar `player-home.js`, `match-load.js`, `store.js` y módulos existentes como fuentes de lógica pura.
- No seguir inflando `app.js` si una agregación o regla puede vivir de forma testeable en su módulo correspondiente.
- Reutilizar componentes de hoja, icono, tarjeta y métricas; no copiar bloques con ligeras diferencias.
- No introducir framework nuevo ni dependencia pesada.
- No borrar, migrar destructivamente ni reiniciar el historial local.
- Mantener las claves `bramuplayer.*` y su compatibilidad.
- Conservar v1.3.1 como punto de rollback mediante su commit/tag existente.
- Actualizar manifest, cache, service worker y `version.json` de `bramulab/` para v2.0.
- No tocar ningún archivo dentro de `bramulab-partidos/`.
- Las cachés de ambas aplicaciones deben seguir aisladas.
- No borrar cachés de la familia de BRAMU Lab Partidos durante pruebas.

---

## 21. Fuera de alcance — documentar, no implementar

- backend y base de datos;
- cuentas, autenticación y contraseña;
- nombre visible separado de `@username` real;
- QR funcional;
- amigos y perfiles públicos;
- validación entre participantes;
- estados Pendiente, Validado, Disputado y Observado;
- impacto oficial de partidos en Nivel o ranking;
- algoritmo real de Nivel BRAMU;
- ranking real, grupos, zonas, país o premios;
- pestañas avanzadas del Historial;
- Partido Libre y resultados excepcionales;
- gráfico completo de evolución;
- consejos técnicos personalizados;
- personalización/reordenamiento de widgets;
- smartwatch, Dynamic Island y pantalla bloqueada;
- fotos, recuerdos y contenido social;
- rediseño global del marcador completo y Por Games;
- cambio global de paleta o tipografías;
- monetización.

Principio futuro que la arquitectura no debe impedir: un partido registrado por un espectador es informativo y nunca afecta estadísticas oficiales; un partido declarado por participantes necesitará al menos confirmación rival.

---

## 22. Estrategia de trabajo y publicación

Claude debe:

1. inspeccionar el estado de v1.3.1 y confirmar el commit/tag de partida;
2. presentar un plan interno breve dividido en bloques, pero continuar sin esperar aprobación;
3. implementar localmente todos los bloques de esta especificación;
4. ejecutar tests después de cada bloque;
5. hacer una revisión integrada al final;
6. corregir sus propios hallazgos antes de publicar;
7. publicar una sola entrega visible: v2.0;
8. verificar GitHub Pages en producción real;
9. generar informe MD autosuficiente;
10. no avanzar a Etapa 5.

Puede usar varios commits descriptivos durante el trabajo. El tag final `v2.0` debe señalar exactamente el commit desplegado.

---

## 23. Pruebas obligatorias

### Automáticas

- mantener toda la suite existente en verde;
- agregar tests unitarios para agregaciones nuevas de Home;
- cubrir orden por `playedAt` y desempate;
- cubrir Actividad de 30 días;
- cubrir Efectividad;
- cubrir racha actual;
- cubrir mejor compañero con muestra mínima;
- cubrir forma reciente integrada;
- cubrir Hitos determinísticos;
- cubrir pluralización y estados vacíos;
- no declarar cubiertas transiciones DOM que el harness actual no ejecuta.

### Navegador real

Probar con datos sintéticos aislados, sin tocar los datos personales de Sebastián:

- móvil aproximado 390×844;
- tablet aproximada 834×1112;
- escritorio aproximado 1366×768;
- standalone/PWA cuando el entorno lo permita.

Recorrido mínimo:

1. Entrada sin identidad → identificación → Home vacío.
2. `+` → Cargar mi partido jugado.
3. Elegir tres jugadores sin duplicados.
4. Cargar partido a dos sets.
5. Guardar con teclado abierto.
6. Resumen limpio, sin Compartir.
7. Editar, cambiar resultado y guardar sin duplicar.
8. Home actualizado.
9. Cargar hoy y luego ayer; comprobar orden.
10. Cargar tercer set.
11. Revisar estados de 1, 3 y 5+ partidos.
12. Abrir Historial y volver.
13. Iniciar Game por game, volver intencionalmente al Home y continuar desde la franja.
14. Cerrar/reabrir con partido activo y comprobar recuperación directa.
15. Abrir todas las hojas inferiores y comprobar ancho, cierre y Escape.
16. Revisar teclado compacto y foco accesible.
17. Revisar safe-area y barra inferior.
18. Revisar consola sin errores propios de la app.
19. Confirmar versión, manifest, service worker y caché.
20. Confirmar que `bramulab-partidos/` continúa en v14 y sin archivos modificados.

Si una prueba visual no puede automatizarse, documentar el estado exacto del DOM y la comprobación manual realizada. No usar la ausencia de pantalla táctil como impedimento para probar botones, hojas, navegación y layout.

---

## 24. Criterios de aceptación de v2.0

La versión solo está lista cuando:

1. Abrir BRAMU Lab lleva al Home correcto.
2. El Home ya no muestra la composición beta vieja.
3. La tarjeta de jugador responde a la nueva jerarquía.
4. Forma reciente dejó de ser una tarjeta independiente.
5. Último partido muestra el partido correcto y tiene la jerarquía definida.
6. Actividad, Efectividad y las cuatro métricas usan datos reales.
7. Hitos y Tu Momento no inventan.
8. Las hojas inferiores se sienten parte de una misma aplicación.
9. El selector de jugadores no aparece como modal angosto desconectado.
10. El teclado dejó de verse como un bloque genérico sobredimensionado.
11. El Resumen no muestra Compartir.
12. Guardar y editar actualizan Home e Historial sin duplicados.
13. El partido en curso se recupera y se representa correctamente.
14. La iconografía del Home no depende de emojis.
15. Mobile, tablet y escritorio son utilizables.
16. No hay regresiones en Punto por punto ni Game por game.
17. La suite está en verde y la consola no presenta errores propios.
18. La actualización PWA ofrece y carga v2.0.
19. BRAMU Lab Partidos v14 permanece intacta.

---

## 25. Entrega e informe

Guardar el informe final en:

`docs/bramulab/informes/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Informe.md`

Debe incluir:

1. resumen ejecutivo;
2. comparación “antes v1.3.1 / después v2.0”;
3. archivos creados y modificados;
4. componentes eliminados, fusionados y reemplazados;
5. decisiones visuales tomadas;
6. reglas de datos implementadas;
7. tests automáticos y resultado;
8. pruebas manuales por viewport;
9. comprobación de los 19 criterios de aceptación;
10. limitaciones reales y deuda técnica;
11. commit final y tag v2.0;
12. estado del deploy de GitHub Pages;
13. URLs verificadas;
14. confirmación explícita de que `bramulab-partidos/` quedó intacta;
15. instrucciones de prueba para Sebastián, limitadas a un recorrido grande y concreto de no más de 10 minutos.

La entrega debe terminar indicando claramente si v2.0 está lista para revisión externa de ChatGPT. No declarar la Etapa 4 cerrada por cuenta propia: ChatGPT revisará el informe, el código y la producción; luego Sebastián evaluará la experiencia completa.

