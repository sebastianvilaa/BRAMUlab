# BRAMUlab V02.2 — Consolidado de corrección UX y terminación visual

## 1. Estado y propósito

Este documento define la corrección inmediata posterior a `BRAMUlab V02.1`.

V02.1 mejoró la lógica y el recorrido general, pero varias decisiones visuales y de interacción del consolidado anterior quedaron aplicadas de forma parcial, literal o inconsistente. V02.2 no debe sumar funcionalidades de negocio nuevas: debe terminar correctamente la experiencia ya definida y eliminar fricción.

El resultado esperado es una app que se sienta diseñada como un sistema único, no como pantallas resueltas por separado.

## 2. Fuente de verdad y lectura obligatoria

Leer antes de implementar:

1. `BRAMUlab_V02.1_Consolidado.md` — intención original.
2. `BRAMUlab_V02.1_Informe.md` — implementación real y verificaciones.
3. Este documento — fuente de verdad para V02.2 y corrección de cualquier contradicción anterior.

Ante una contradicción, prevalece este consolidado.

## 3. Criterio de implementación

- No limitarse a copiar literalmente cada comentario: resolver el sistema visual y el flujo completo.
- Reutilizar componentes, estilos y comportamientos; no crear variantes casi iguales para cada pantalla.
- No considerar terminada una corrección porque “existe”: debe verse, leerse y comportarse correctamente en computadora e iPhone.
- Conservar datos existentes y compatibilidad con partidos ya guardados.
- No borrar `localStorage`, no cambiar esquemas sin migración y no alterar reglas deportivas fuera de alcance.
- Usar Inter con pesos jerarquizados; evitar que todo se vea pesado.

---

# BLOQUE A — SISTEMA GLOBAL DE NAVEGACIÓN

## 4. REEMPLAZAR la navegación incompleta de vistas secundarias

La barra inferior global se pierde actualmente en varias pantallas y deja al usuario encerrado en recorridos de “volver”.

Mantener visible la navegación inferior de cinco posiciones en:

- Home;
- Historial;
- Resumen del partido;
- Compañeros;
- Rivales;
- Ranking;
- Perfil;
- configuración inicial de registro por games;
- configuración inicial de registro punto por punto.

Ocultarla únicamente durante una tarea inmersiva en curso:

- carga de resultados de sets;
- partido en vivo ya iniciado;
- edición activa de un partido;
- sheets o modales abiertos.

En esos casos debe existir una salida clara mediante back/cancelar y, si hay datos sin guardar, confirmación antes de abandonar.

### Reglas visuales

- Misma altura, safe area, iconos, estados activos y posición en todas las vistas.
- No montar contenido debajo de la barra.
- Un sheet/modal debe bloquear la barra y quedar por encima de ella.
- La flecha del header vuelve un nivel; la barra inferior cambia de sección global.

## 5. REEMPLAZAR destinos redundantes

- El botón central `+` es el único punto global para elegir entre carga manual y registro en vivo.
- Eliminar `Cargar partido jugado` de las pantallas de configuración por games y punto por punto.
- No duplicar accesos que mezclen dos recorridos una vez elegido el modo.

---

# BLOQUE B — SHEET “REGISTRAR PARTIDO”

## 6. RECOMPONER por completo el sheet

El sheet actual mantiene una jerarquía incorrecta: `Cargar mi partido jugado` aparece como opción principal en lima y `Registrar partido en vivo` como opción secundaria, aunque ambas son destinos equivalentes.

### Estructura obligatoria

1. Handle centrado.
2. Título `REGISTRAR PARTIDO` centrado respecto del sheet completo.
3. Botón cerrar alineado a la derecha sin desplazar ópticamente el título.
4. Dos opciones apiladas con exactamente la misma jerarquía:
   - `Cargar mi partido jugado`;
   - `Registrar partido en vivo`.

### Tratamiento de las dos opciones

- Misma altura, ancho, fondo, borde, peso tipográfico y área táctil.
- No usar lima sólida ni borde lima para privilegiar una sobre la otra.
- Usar superficie azul noche, borde neutro visible, texto blanco y un chevron o icono secundario coherente.
- El feedback presionado puede usar un acento breve lima, sin convertir una opción en principal permanente.
- Altura mínima recomendada: 56 px.
- Separación suficiente entre ambas para que se lean como dos decisiones equivalentes.
- El sheet debe tener aire superior e inferior, respetar safe area y no sentirse “petizo”.

---

# BLOQUE C — CARGA MANUAL: EQUIPOS Y SELECCIÓN DE JUGADORES

## 7. REEMPLAZAR los cuatro pills pequeños por composición de equipos

La fila actual `Seba / + Compañero / + Rival 1 / + Rival 2` es demasiado pequeña y usa líneas celeste/magenta sin suficiente estructura.

Adoptar en la carga manual la misma lógica visual validada en la configuración en vivo:

- tarjeta `EQUIPO A` con acento celeste;
- tarjeta `EQUIPO B` con acento magenta;
- separador `VS` entre ambas;
- `Seba` precargado como Jugador 1 de Equipo A;
- espacios claros para compañero y dos rivales.

### Ajuste para no ocupar toda la pantalla

- Reutilizar el lenguaje visual de las tarjetas en vivo, pero crear una variante compacta para la carga manual.
- Usar borde general neutro y un acento lateral de color; no dejar solamente una línea inferior de color.
- Cada jugador debe tener un área táctil mínima de 52 px.
- Nombre blanco/alto contraste; placeholder gris secundario.
- El color identifica equipo, no reemplaza la legibilidad.

## 8. REEMPLAZAR el selector de compañero/rival

El selector actual duplica personas: muestra accesos rápidos arriba y vuelve a listar las mismas personas abajo. Además, nombres y filas tienen poca jerarquía.

### Estado inicial

- Título contextual centrado: `ELEGIR COMPAÑERO`, `ELEGIR RIVAL 1` o `ELEGIR RIVAL 2`.
- Buscador de altura cómoda, superficie definida y placeholder `Buscar jugador…`.
- Sección `RECIENTES` con accesos rápidos horizontales de avatar/inicial + nombre.
- Sección `TODOS` debajo, excluyendo a quienes ya aparecen en `RECIENTES`.
- No repetir una misma persona simultáneamente arriba y abajo.
- Excluir al jugador actual, jugadores ya asignados al partido y placeholders del sistema.

### Estado de búsqueda

- Al escribir, ocultar `RECIENTES` y mostrar únicamente coincidencias.
- Filas de 56–64 px, nombre claramente legible y área táctil completa.
- Si no hay coincidencias, ofrecer `Agregar “[nombre]” como jugador sin cuenta` con tratamiento secundario claro.
- No mostrar una lista comprimida con tipografía diminuta.

### Selección y avance automático

Al elegir una persona:

1. Completar el rol actual.
2. Cerrar o transformar el sheet sin volver a la pantalla para pedir otro toque.
3. Abrir automáticamente el siguiente rol vacío:
   - Compañero → Rival 1;
   - Rival 1 → Rival 2;
   - Rival 2 → primer resultado del Set 1.

El usuario puede cerrar el sheet para interrumpir la secuencia y tocar cualquier jugador ya elegido para modificarlo.

## 9. AGREGAR prevención de duplicados

- Una persona no puede ocupar dos lugares en el mismo partido.
- Al seleccionar un jugador ya asignado, no cerrar el sheet: explicar brevemente que ya participa.
- Mantener la posibilidad de crear jugadores sin cuenta.

---

# BLOQUE D — CARGA DE SETS Y AUTOMATIZACIÓN

## 10. REEMPLAZAR los toques redundantes entre campos y sets

La carga debe funcionar como una secuencia continua:

1. Al terminar la selección de Rival 2, activar automáticamente el resultado de Equipo A del Set 1 y abrir el teclado numérico.
2. Al confirmar el primer valor, pasar automáticamente al valor de Equipo B.
3. Al ingresar un set válido:
   - guardar el set en memoria;
   - avanzar automáticamente al set siguiente si el partido continúa;
   - dejar activo el primer campo del nuevo set y mantener/abrir el teclado.
4. Si el set define el partido, abrir `CONFIRMAR PARTIDO`.

No exigir:

- volver a tocar el marcador para empezar el set siguiente;
- un botón `CONTINUAR` entre sets;
- seleccionar manualmente el segundo campo después de cargar el primero.

### Excepciones

- Si el resultado todavía es incompleto o inválido, no avanzar.
- Mostrar el motivo sin bloquear estados intermedios necesarios para ingresar tie-breaks como 10–8.
- Permitir volver y editar sets anteriores.

## 11. RECOMPONER la cabecera de cada set

- Mostrar las tarjetas compactas de Equipo A y Equipo B como contexto estable.
- Resultado activo centrado y dominante.
- Resultados de sets anteriores centrados, legibles y secundarios.
- Evitar que selector de jugadores, resultado, formato y fecha compitan en el mismo nivel visual.

## 12. FUSIONAR el formato visual del marcador

Crear un único componente tipográfico para resultados y reutilizarlo en:

- Último partido;
- Confirmar partido;
- Resumen;
- Historial;
- carga de sets cuando corresponda.

Formato canónico:

```text
6–2 · 5–7 · 6–4
```

### Reglas

- Usar el mismo guion/en dash que hoy se ve correctamente en `CONFIRMAR PARTIDO`.
- No mezclar hyphen, en dash, slash ni separadores diferentes entre pantallas.
- Punto separador más pequeño y gris secundario.
- Números y guion del set en el mismo blanco, peso y alineación.
- Kerning y espacios ópticos revisados; el punto no debe quedar pegado al guion.
- En Home puede reducirse el tamaño, pero no cambiar la construcción.

---

# BLOQUE E — FORMATO, FECHA Y CONFIRMACIÓN

## 13. RECOMPONER “Formato y puntuación” con verificación visual real

La implementación anterior cumplió medidas mínimas, pero no resolvió la percepción de un sheet bajo y apretado.

- Título centrado.
- Más altura útil y padding lateral/vertical consistente.
- Separación clara entre `FORMATO DE PARTIDO` y `SISTEMA DE PUNTUACIÓN`.
- Opciones equivalentes con misma altura y baseline.
- Selección marcada mediante superficie levemente teñida + borde lima; no solo texto verde.
- Botón `LISTO` centrado horizontalmente, integrado al sheet y con ancho coherente; no pegado abajo ni aislado.
- Revisar el resultado en `402 × 874` con y sin teclado.
- No aprobarlo únicamente por cumplir 48 px: debe verse equilibrado.

## 14. AJUSTAR “Confirmar partido”

La estructura general actual queda aprobada. Aplicar estas correcciones:

- Mantener `CONFIRMAR PARTIDO`, estado, resultado, equipos y `GUARDAR PARTIDO`.
- Fecha y hora en blanco o blanco secundario de alto contraste; el gris actual pierde legibilidad.
- `Modificar` como acción terciaria discreta, sin competir con la metadata.
- Integrar el label `NOTAS · SOLO VOS` dentro del mismo contenedor visual del campo de notas, como encabezado interno.
- Mantener el placeholder dentro del textarea con menor jerarquía.
- No repetir label por fuera y caja desconectada por debajo.
- Conservar `GUARDAR PARTIDO` como acción principal lima.

---

# BLOQUE F — RESUMEN ÚNICO DEL PARTIDO

## 15. FUSIONAR resultado y estadísticas en una sola tarjeta

La pantalla actual separa demasiado el marcador de `SETS GANADOS` y `GAMES GANADOS`, cortando una misma lectura deportiva.

Crear una única tarjeta principal que incluya:

1. Ganadores.
2. Filas de Equipo A y Equipo B con marcador por sets.
3. Divisor interno.
4. Sets ganados de ambos equipos.
5. Games ganados de ambos equipos.

Las estadísticas deben quedar inmediatamente relacionadas con el resultado, como en el resumen anterior validado. No crear una sección `ESTADÍSTICAS` flotando lejos del marcador.

## 16. RECOMPONER las tarjetas de contenido

### BRAMU Intelligence

- El label `BRAMU INTELLIGENCE` debe vivir dentro de su misma tarjeta.
- Incluir también dentro de la tarjeta la bajada y el texto analítico.
- No dejar título/bajada flotando por fuera y el contenido en otra pastilla.
- Label lima pequeño; bajada secundaria; cuerpo Inter 400/500 con buen interlineado.

### Notas privadas

- Mostrar la tarjeta solamente si existe una nota guardada.
- Label `NOTAS · SOLO VOS` dentro de la tarjeta.
- No mostrar un textarea vacío en modo lectura.
- Si se permite editar desde allí, explicitar el estado de edición; de lo contrario, editar mediante `EDITAR PARTIDO`.

## 17. REEMPLAZAR la salida del resumen

- Incorporar la barra inferior global en el Resumen.
- Eliminar el gran botón lima `VOLVER AL INICIO` si duplica la acción Inicio de la barra.
- Mantener `EDITAR PARTIDO` como acción secundaria discreta y de ancho coherente con el contenido.
- Mantener el logo BRAMUlab como cierre visual antes del espacio de la navegación inferior.
- El back del header vuelve al origen real: Historial si se abrió desde Historial; pantalla anterior si proviene de guardado. Inicio siempre está disponible en la barra.

---

# BLOQUE G — HISTORIAL

## 18. REEMPLAZAR el subrayado por pestañas reales

La V02.1 dejó los textos `Todos / Mis partidos / Observados`, pero visualmente continúan siendo una navegación subrayada. No refleja la referencia de Mercado Pago ni genera una superficie activa clara.

Implementar únicamente estas tres pestañas:

```text
Todos | Mis partidos | Observados
```

### Comportamiento visual

- La pestaña activa debe sentirse como una solapa unida a la superficie del listado.
- Usar fondo/superficie, esquinas superiores y profundidad sutil; no solamente una línea lima debajo.
- Las inactivas quedan integradas al header, con contraste secundario.
- Mantener cantidad junto al nombre sin convertir el número en acento dominante.
- Transición corta y fluida entre pestañas (aprox. 180–220 ms).
- Al cambiar, mover el contenido con slide corto o combinación slide/fade coherente.
- Permitir swipe horizontal entre las tres vistas si no interfiere con el scroll vertical.
- Conservar posición de la barra inferior y safe area.

### Contenido

- `Todos`: propios + observados.
- `Mis partidos`: participa el jugador actual.
- `Observados`: no participa el jugador actual.
- No reintroducir la fila `Todos los modos / Cargados / Game por game / Punto por punto`.
- Mantener badges `VIC/DER` en partidos propios y ganador claro en observados.

## 19. VERIFICAR filtros contextuales

- Racha actual abre únicamente los partidos de la racha vigente y muestra el filtro activo.
- Efectividad abre exactamente los partidos de los últimos 30 días usados en el cálculo.
- Quitar el filtro devuelve a la pestaña correspondiente sin perder la navegación.

---

# BLOQUE H — HOME Y VISTAS DE COMPAÑEROS/RIVALES

## 20. AJUSTAR “Último partido”

- Sustituir su marcador por el componente canónico de §12.
- Conservar resultado como primer nivel.
- Mantener `VIC/DER` compacto junto a `ÚLTIMO PARTIDO`.
- Mantener acento lateral, sin línea superior ni degradado.
- Revisar espacios para que el badge no comprima el título.

## 21. RECOMPONER Compañeros y Rivales

Las listas actuales son funcionales, pero parecen una salida de datos aislada y pierden la navegación global.

- Agregar barra inferior global.
- Mantener header con back y título.
- Cada fila debe mostrar una jerarquía inequívoca:
  - avatar/inicial;
  - nombre;
  - resumen explícito: `9 partidos · 7 victorias · 2 derrotas` o `16 enfrentamientos · 9 victorias · 7 derrotas`;
  - efectividad como cifra secundaria destacada con label o contexto suficiente.
- No presentar `78%` o `56%` como número suelto sin que quede claro qué mide.
- Unificar altura, padding, alineación y ancho de las tarjetas.
- Si una fila no abre ningún detalle, no usar chevron ni apariencia engañosa de botón.
- Mantener las reglas de orden y exclusión ya implementadas en V02.1.

## 22. CONSERVAR por ahora “Tu momento”

No rediseñar todavía su algoritmo narrativo en V02.2. Registrar para revisión posterior cualquier frase que se perciba extraña, pero no ampliar el alcance de esta corrección.

Verificar solamente que sus conteos provengan de los cinco partidos cronológicamente más recientes y que no reaparezca el problema UTC/local ya corregido.

---

# BLOQUE I — REGISTRO POR GAMES Y PUNTO A PUNTO

## 23. REEMPLAZAR el header de modo

- Eliminar `BETA` de `MODO POR GAMES`.
- Usar naming estable: `REGISTRO POR GAMES` y `REGISTRO PUNTO A PUNTO`.
- No presentar el modo como selector desplegable si al tocarlo no aporta una elección clara.
- Si se conserva un selector de modo, debe abrir una elección explícita entre ambos modos y mantener igual jerarquía.

## 24. CONSERVAR la composición de equipos validada

Las tarjetas grandes `EQUIPO A / EQUIPO B` con `VS` quedan aprobadas como lenguaje base.

- Mantener estructura, acentos celeste/magenta y campos de dos jugadores.
- Reutilizar este patrón en carga manual mediante su variante compacta (§7).
- No volver a pills pequeños con subrayados de color.

## 25. RECOMPONER navegación de configuración

- Mostrar la barra inferior mientras el partido todavía no comenzó.
- Al tocar `EMPEZAR PARTIDO`, entrar al modo inmersivo y ocultar la barra.
- Eliminar el enlace `Cargar partido jugado` de ambas configuraciones.
- Mantener formato, puntuación y botón principal.

---

# BLOQUE J — AUDITORÍA VISUAL TRANSVERSAL

## 26. FUSIONAR superficies, bordes y radios

Definir y reutilizar un conjunto corto de componentes:

- tarjeta principal;
- tarjeta compacta;
- fila interactiva;
- botón principal;
- botón secundario;
- acción terciaria;
- chip/estado;
- sheet;
- pestaña;
- marcador.

No resolver cada pantalla con una combinación nueva de borde, radio, altura y color.

### Colores

- Lima: acción principal, selección o estado positivo; no borde ornamental repetido.
- Celeste/magenta: identidad de equipos y acentos controlados.
- Coral: derrota/alerta, sin invadir superficies.
- Azul noche: superficies.
- Grises: metadata y separadores, siempre con contraste suficiente.

### Tipografía

- Inter 400/500 para cuerpo y metadata.
- 600/700 para títulos y nombres.
- 700/800 solo para resultados y cifras protagonistas.
- Evitar mayúsculas pesadas en bloques largos.
- Usar números tabulares en resultados y porcentajes.

## 27. AUDITAR alturas y alineaciones

Revisar en conjunto:

- títulos centrados aunque exista botón cerrar;
- botones equivalentes con alturas equivalentes;
- filas táctiles mínimas de 52–56 px cuando contienen personas o destinos;
- metadata con contraste real en iPhone;
- cards sin grandes vacíos internos ni bloques amontonados;
- contenido no tapado por bottom nav, teclado o safe area;
- overlays oscuros neutros, sin verde musgo.

---

# BLOQUE K — DATOS Y CORRECCIONES FUNCIONALES

## 28. PRESERVAR datos y perspectiva

- No borrar ni reinicializar partidos existentes.
- Mantener `currentPlayerName`, jugadores creados, notas privadas y partidos observados.
- `VIC/DER`, racha, efectividad, compañeros y rivales siempre se calculan desde la perspectiva del jugador actual.
- La corrección de fecha local debe aplicarse a nuevos registros.
- Documentar explícitamente si los registros ya guardados con timestamps futuros no se migran.

## 29. NO AMPLIAR el alcance

No implementar en V02.2:

- nuevas funciones sociales;
- cuentas reales o sincronización en nube;
- explicación del Nivel BRAMU;
- rediseño profundo de `Tu momento`;
- desarrollo del Ranking;
- nuevas estadísticas no derivables de los datos actuales;
- ideas de `Conversiones futuras y backlog`.

---

# BLOQUE L — VERIFICACIÓN Y ENTREGA

## 30. Tests automáticos obligatorios

Conservar los 523 tests existentes y agregar pruebas para:

- selección secuencial Compañero → Rival 1 → Rival 2;
- exclusión de duplicados en selector;
- listas `RECIENTES` y `TODOS` sin personas repetidas;
- foco automático Equipo A → Equipo B;
- avance Set 1 → Set 2 → decisivo sin toques redundantes;
- tie-break 10–8 durante la secuencia automática;
- marcador canónico igual en Home, Confirmar, Resumen e Historial;
- barra inferior presente/ausente según §4;
- back del Resumen según origen;
- pestañas Todos/Mis/Observados y filtros contextuales;
- ausencia de `BETA` y de `Cargar partido jugado` en configuración en vivo.

## 31. Prueba manual obligatoria

Ejecutar el recorrido completo en desktop y viewport iPhone `402 × 874`:

1. Home → `+`.
2. Verificar título centrado y dos opciones iguales.
3. Carga manual.
4. Elegir compañero y rivales sin duplicados ni toques de regreso.
5. Cargar `6–2 · 5–7 · 10–8` comprobando foco y avance automáticos.
6. Abrir Formato y puntuación con y sin teclado.
7. Confirmar partido; revisar metadata y Notas integradas.
8. Guardar; revisar tarjeta única de resultado/estadísticas y tarjeta de BRAMU Intelligence.
9. Usar barra inferior desde Resumen.
10. Cambiar las tres pestañas del Historial y comprobar transición.
11. Abrir Compañeros y Rivales; comprobar navegación y significado de porcentajes.
12. Abrir registro por games y punto a punto; comprobar navegación, naming y ausencia de accesos duplicados.

No sustituir esta prueba por inspección de DOM o tests unitarios.

## 32. Capturas obligatorias

Guardar evidencia visual de:

- sheet Registrar partido;
- equipos compactos de carga manual;
- selector inicial y búsqueda;
- Set 1 y Set 2;
- Formato y puntuación;
- Confirmar partido;
- Resumen completo;
- Historial en cada pestaña;
- Compañeros;
- Rivales;
- configuración por games;
- configuración punto a punto.

Las capturas deben quedar en una carpeta de evidencia de V02.2 o enumeradas con rutas exactas en el informe. No alcanza con describirlas sin conservarlas.

## 33. PWA, versión y publicación

Al completar y verificar:

- actualizar versión visible a `BRAMUlab V02.2`;
- actualizar `version.json` y cache/versionado del service worker;
- comprobar el flujo de actualización sobre una instalación que tenga V02.1;
- publicar en GitHub Pages;
- crear tag `BRAMUlab_V02.2`;
- registrar el hash exacto del commit en el informe, no remitir solamente al historial;
- actualizar README y changelog vigente;
- no crear una carpeta `BRAMUlab_V02.2`: consolidado e informe pertenecen a `BRAMUlab_V02`.

## 34. Informe final

Crear:

```text
docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02.2_Informe.md
```

Debe incluir:

- matriz requisito → implementación → archivo/función → prueba;
- decisiones visuales tomadas;
- desvíos y justificación;
- tests automáticos con cantidad exacta;
- recorrido manual realizado;
- rutas de las capturas;
- commit exacto;
- tag;
- URL publicada;
- estado del update PWA;
- cualquier limitación pendiente.

## 35. Criterio de aceptación

V02.2 se considera terminada solamente si:

- las dos opciones de Registrar partido tienen la misma jerarquía;
- los equipos manuales ya no son cuatro pills pequeños;
- el selector no duplica jugadores;
- la selección avanza sola entre los tres roles;
- la carga avanza sola entre campos y sets;
- el resultado usa una única construcción visual en toda la app;
- resultado y estadísticas conviven en una tarjeta;
- BRAMU Intelligence y Notas tienen labels dentro de sus tarjetas;
- Historial se percibe como pestañas reales, no textos subrayados;
- Resumen, Compañeros, Rivales y configuraciones iniciales conservan navegación global;
- `BETA` y el acceso duplicado a carga manual desaparecieron;
- no hay datos borrados ni regresiones en registro por games o punto a punto;
- existe evidencia visual guardada y el informe identifica commit/tag/publicación.

## 36. Autorización de ejecución

Claude queda autorizado a implementar, probar, documentar, versionar y publicar V02.2 sin pedir confirmación intermedia, siempre que respete este alcance y no borre datos ni documentos.

