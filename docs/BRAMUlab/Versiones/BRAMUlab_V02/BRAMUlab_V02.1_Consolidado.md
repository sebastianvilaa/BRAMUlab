# BRAMUlab V02.1 — Consolidado de corrección funcional, UX y terminación visual

## 1. Propósito de esta versión

BRAMUlab V02.1 es una versión de corrección y consolidación sobre la base visual publicada en BRAMUlab V02.

El objetivo es resolver problemas funcionales detectados durante pruebas reales, eliminar recorridos duplicados, mejorar la jerarquía de las pantallas principales y convertir varias métricas del Home en accesos útiles.

No es un rediseño total ni una nueva etapa conceptual. Debe conservarse todo lo que ya funciona y corregirse únicamente lo indicado en este documento.

## 2. Fuentes de verdad obligatorias

Antes de modificar código, leer:

- `docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md`
- el estado funcional real del repositorio y los tests vigentes.

Este documento pasa a ser la fuente de implementación de BRAMUlab V02.1.

Guardar los documentos de esta subversión dentro de la carpeta existente de la versión mayor V02:

```text
docs/BRAMUlab/Versiones/BRAMUlab_V02/
├── BRAMUlab_V02_Consolidado.md
├── BRAMUlab_V02_Informe.md
├── BRAMUlab_V02.1_Consolidado.md
└── BRAMUlab_V02.1_Informe.md
```

No crear una carpeta independiente para V02.1. Las futuras subversiones V02.2, V02.3, etc. deben seguir el mismo criterio dentro de `BRAMUlab_V02`. Crear una carpeta nueva únicamente al pasar a una versión mayor, como `BRAMUlab_V03`.

No crear adendas, hotfixes ni otros MD independientes para esta tarea. El informe debe reunir implementación, pruebas, capturas, correcciones y desvíos.

## 3. Principios generales

- Conservar Inter durante toda esta versión. No cambiar la familia tipográfica todavía.
- Ajustar pesos, tamaños, interlineados y contraste antes de evaluar otra tipografía.
- Conservar los roles cromáticos definidos en V02:
  - azul/celeste para Equipo A y acentos secundarios;
  - magenta para Equipo B;
  - lima para identidad, acciones principales y estados positivos;
  - dorado exclusivamente para Punto de Oro.
- No agregar la palabra ni la etiqueta `BETA` a Nivel BRAMU.
- No modificar reglas, modelos de datos o recorridos que no estén expresamente incluidos.
- No convertir este ajuste en una reescritura general del proyecto.
- Mantener foco mobile-first y verificar especialmente en iPhone 16 Pro, `402 × 874`.

---

# BLOQUE A — CORRECCIONES FUNCIONALES PRIORITARIAS

## 4. CORREGIR Actividad y Efectividad de los últimos 30 días

Se detectó un error real en iPhone:

- el dispositivo mostraba `11 partidos en tu historia`;
- los 11 partidos habían sido cargados ese mismo día;
- Actividad mostraba solamente `3 partidos en los últimos 30 días`;
- Efectividad calculaba `2 de 3`.

Esto no se explica por la persistencia local independiente entre dispositivos. Dentro de ese mismo iPhone, los 11 registros debían computar dentro de los últimos 30 días.

### Requerimientos

- Auditar cómo se guardan, migran y comparan las fechas en iPhone/Safari y escritorio.
- Corregir cualquier mezcla entre fecha local, UTC, strings `YYYY-MM-DD`, timestamps y registros anteriores.
- El filtro debe incluir todos los partidos cuya fecha real local esté dentro de los últimos 30 días.
- Efectividad debe calcularse sobre exactamente el mismo conjunto temporal que Actividad.
- Fórmula: victorias del jugador actual / partidos propios disputados en el período.
- Los partidos observados no deben alterar la efectividad personal.
- Si un registro antiguo tiene una fecha válida en otro formato, migrarlo o interpretarlo sin perderlo.
- No modificar silenciosamente el día elegido por el usuario.

### Gráfico de Actividad

- Verificar que sus barras se construyan con fechas reales y no con orden de carga.
- Mantenerlo no interactivo en V02.1.
- Dividir el período de 30 días en cuatro tramos cronológicos consistentes y documentar en el código qué representa cada barra.
- La altura debe representar cantidad de partidos del tramo respecto del tramo con mayor actividad.
- Un tramo con cero partidos debe verse vacío, pero continuar siendo identificable.

### Pruebas mínimas

- 11 partidos cargados hoy en iPhone: Actividad debe mostrar 11.
- 11 partidos cargados hoy con 7 victorias: Efectividad debe mostrar `64%` y `7 de 11`.
- Partidos exactamente en el límite del período.
- Cambio de mes y de año.
- Fechas creadas con “Ahora”.
- Fechas elegidas manualmente.
- Registros anteriores a V02 que todavía sean válidos.
- Diferencia de zona horaria entre UTC y hora local sin corrimiento de día.

## 5. CORREGIR fecha “Ahora” y presentación temporal

Existe un antecedente de posible corrimiento de un día por UTC.

- Guardar y mostrar la fecha elegida en hora local.
- Evitar que `Ahora` cambie de día al serializar o volver a abrir el partido.
- Reemplazar presentaciones redundantes como `Ahora · Hoy · 01:07`.
- Durante la carga puede mostrarse `Hoy · 01:07`.
- En el partido ya guardado debe mostrarse la fecha y hora reales con el formato vigente de la app.
- `Modificar` debe perder protagonismo y funcionar como acción secundaria compacta.

## 6. CORREGIR tie-break en registro por games

En un set terminado `7–6`, la carga del tie-break actualmente impide ingresar valores superiores a 7. Esto invalida resultados reales como `10–8`.

### Regla

Para un tie-break estándar:

- el ganador debe alcanzar al menos 7 puntos;
- debe existir una diferencia mínima de 2;
- no debe existir un máximo artificial.

Ejemplos válidos:

- `7–0`
- `7–5`
- `8–6`
- `10–8`
- `16–14`

Ejemplos inválidos:

- `7–6`
- `8–7`
- cualquier resultado sin diferencia de dos.

Si otro formato configurado utiliza un super tie-break con objetivo diferente, conservar su regla específica y no mezclarla con el tie-break estándar.

Agregar tests de validación, persistencia, edición y visualización para resultados superiores a 7.

## 7. CORREGIR validación contradictoria del set decisivo

En una prueba apareció el mensaje:

> Con 1 set para cada equipo, falta definir el tercer set.

aunque el tercer set ya mostraba un `6–4` válido.

- El mensaje debe desaparecer tan pronto el tercer set sea válido.
- Un partido al mejor de tres con resultados `6–2 · 5–7 · 6–4` debe poder continuar a confirmación sin advertencias.
- Revisar que cambiar formato o puntuación no deje validaciones visuales obsoletas.

## 8. CORREGIR el logo clickeable del Home

- Tocar o hacer clic en el logo de BRAMUlab dentro del Home no debe abrir Cargar partido, el marcador ni ninguna otra pantalla.
- El logo debe ser puramente identificatorio.
- El botón central `+` continúa siendo el acceso para registrar un partido.

## 9. CORREGIR jugadores genéricos en el selector

El selector de compañero/rivales muestra entradas como:

- `Jugador 1`
- `Jugador 2`
- `Jugador 3`
- `Jugador 4`

Esas etiquetas son placeholders del sistema y no deben incorporarse al directorio de jugadores ni aparecer como contactos elegibles.

- Excluir nombres vacíos, `Vos` y placeholders genéricos.
- Conservar jugadores reales ya guardados.
- Mantener la posibilidad de agregar un jugador sin cuenta desde la búsqueda.
- No borrar partidos históricos por limpiar el selector.

---

# BLOQUE B — RECORRIDO DE CARGA MANUAL

## 10. REEMPLAZAR el avance redundante entre sets

Actualmente, después de ingresar un resultado válido, aparece un botón adicional `CONTINUAR`. La acción resulta redundante porque el usuario ya terminó la carga con el teclado numérico.

### Nuevo comportamiento

- Al completar y aceptar un resultado válido, avanzar automáticamente al set siguiente.
- No exigir un segundo toque en `CONTINUAR` entre Set 1, Set 2 y set decisivo.
- Mantener una transición breve y clara, sin demoras innecesarias.
- El usuario debe poder volver atrás y corregir un set anterior.
- Al finalizar el set que define el partido, pasar a la pantalla `CONFIRMAR PARTIDO`; no guardar automáticamente.

### Resultado del set anterior

- Mostrar el resultado ya cargado centrado sobre el nuevo set.
- Aumentar levemente su tamaño y legibilidad.
- Conservarlo como referencia secundaria, sin competir con el set activo.

## 11. RECOMPONER “Formato y puntuación”

El sheet actual se percibe bajo, apretado y con controles de alturas inconsistentes.

- Aumentar la altura útil del sheet.
- Dar más aire vertical entre `Formato de partido` y `Sistema de puntuación`.
- Garantizar áreas táctiles mínimas de 48 px.
- Igualar la altura visual de opciones equivalentes.
- Hacer coherentes la fila de formato y la fila de fecha/hora.
- Mantener el borde lima para indicar una selección, no como sustituto de una acción principal.
- Centrar el botón `LISTO`.
- Integrarlo al mismo sistema de botones del resto de la aplicación.
- Evitar que quede demasiado abajo o aislado.
- Verificar safe area y teclado en iPhone.

## 12. UNIFICAR el sistema de botones

### Acción principal

- Fondo lima sólido.
- Texto oscuro de alto contraste.
- Usar para acciones como `GUARDAR PARTIDO` y `VOLVER AL INICIO`.

### Acción secundaria

- Superficie azul noche u oscura.
- Borde discreto y texto claro.
- Usar para `EDITAR PARTIDO` y acciones equivalentes.

### Acción terciaria

- Enlace de texto sin caja dominante.
- Usar para volver, cancelar o modificar datos secundarios cuando corresponda.

No usar un botón de borde lima como acción principal. Los chips y filtros seleccionados sí pueden utilizar borde o acento lima.

---

# BLOQUE C — CONFIRMACIÓN, RESUMEN Y BRAMU INTELLIGENCE

## 13. REEMPLAZAR el recorrido posterior a la carga

Actualmente conviven tres instancias que se pisan entre sí:

- `Partido guardado`;
- `Resumen del partido`;
- `Análisis del partido`.

Además existen enlaces circulares como `Ver resumen` y `Volver a análisis`.

El nuevo recorrido debe tener solamente dos momentos con funciones distintas:

```text
Finalización de sets
→ Confirmar partido
→ Guardar partido
→ Resumen del partido
```

## 14. AGREGAR/RECOMPONER pantalla “Confirmar partido”

Esta pantalla aparece antes de persistir definitivamente el partido.

Debe mostrar, en este orden:

1. Título `CONFIRMAR PARTIDO`.
2. Estado contextual:
   - en un partido propio: `VICTORIA` o `DERROTA`;
   - en un partido observado: `RESULTADO FINAL`.
3. Ganadores identificados explícitamente por sus nombres.
4. Resultado completo.
5. Fecha, hora y lugar cuando exista.
6. Acción secundaria compacta `Modificar`.
7. Campo opcional `NOTAS`.
8. Botón principal `GUARDAR PARTIDO`.

### Notas

- Usar únicamente el label `NOTAS`.
- No mostrar el ejemplo actual sobre globo y voleas.
- No duplicar ni cambiar el modelo `privateNote` existente.
- Conservar su persistencia privada local.

### Guardado

Al tocar `GUARDAR PARTIDO`:

- persistir el partido una sola vez;
- mostrar una confirmación breve `Partido guardado` mediante toast, feedback o transición;
- abrir automáticamente el único `RESUMEN DEL PARTIDO`.

No dejar al usuario detenido en una pantalla vacía de “Partido guardado”.

## 15. FUSIONAR Resumen y Análisis en una única pantalla permanente

Eliminar como pantalla independiente `ANÁLISIS DEL PARTIDO`.

Eliminar:

- `Ver resumen`;
- `Volver a análisis`;
- cualquier navegación circular entre dos representaciones del mismo partido.

### El único “Resumen del partido” debe incluir

1. Título `RESUMEN DEL PARTIDO`.
2. Metadata compacta: fecha, hora, formato, puntuación y tipo de registro.
3. Ganadores.
4. Marcador por sets con colores de equipo.
5. Sets ganados.
6. Games ganados.
7. Bloque de BRAMU Intelligence.
8. Notas privadas, solo si existe contenido.
9. `EDITAR PARTIDO` como acción secundaria discreta.
10. `VOLVER AL INICIO` como acción principal lima.
11. Logo BRAMUlab como cierre visual.

La navegación desde Historial debe abrir esta misma pantalla canónica.

## 16. AJUSTAR jerarquía de BRAMU Intelligence

El bloque actual compite con el título y el marcador por exceso de peso tipográfico.

- Mantener `BRAMU INTELLIGENCE` como label pequeño en lima.
- Reducir peso del cuerpo a Inter 400/500.
- Mejorar interlineado y separación entre párrafos.
- Evitar que todo el análisis aparezca en negrita.
- Conservar contraste suficiente en exteriores.
- No agrandar innecesariamente el título.

## 17. CORREGIR reglas narrativas de BRAMU Intelligence

Se detectó este caso incorrecto:

- Resultado: `6–1 · 1–6 · 6–0`.
- Texto generado: “se llevaron el partido tras un desarrollo parejo”.

Ese partido tuvo alternancia de dominio, pero no un desarrollo parejo.

### Reglas

- No usar “desarrollo parejo” solamente porque el partido llegó a tres sets.
- Diferenciar:
  - partido parejo;
  - partido cambiante o de dominio alternado;
  - remontada;
  - victoria dominante;
  - set decisivo ajustado;
  - set decisivo amplio.
- Todas las afirmaciones deben derivar del resultado disponible.
- En carga manual por sets no inventar desarrollo punto a punto.

### Casos mínimos de prueba

- `6–1 · 1–6 · 6–0`: dominio alternado, cierre contundente; no “parejo”.
- `7–6 · 6–7 · 7–6`: partido extremadamente parejo.
- `6–0 · 6–0`: victoria dominante.
- `2–6 · 6–4 · 6–3`: remontada.
- `6–2 · 5–7 · 6–4`: partido competitivo con set decisivo ajustado.

Verificar también que la identificación de set más parejo y mayor diferencia sea matemáticamente correcta.

---

# BLOQUE D — HOME

## 18. RECOMPONER los destacados superiores

Los destacados actuales son demasiado bajos y angostos; el texto queda cortado y no se perciben como información importante.

- Convertirlos en un carrusel horizontal de tarjetas compactas, pero legibles.
- Mostrar una tarjeta completa y un pequeño indicio de la siguiente.
- Dar más altura y padding que a los chips actuales.
- Permitir leer la frase sin corte prematuro.
- Incorporar el celeste existente como borde fino, acento lateral o detalle jerárquico.
- No crear un nuevo color fuera del sistema V02.
- Evitar autoplay agresivo.
- Mantener swipe/touch y scroll horizontal.

## 19. RECOMPONER la tarjeta de perfil

### Identidad

- Sustituir temporalmente la inicial por un avatar genérico local.
- No usar la fotografía real de Sebastián ni depender de un servicio externo.
- Mostrar `Seba` como nombre principal.
- Mostrar `@seba` debajo del nombre como usuario provisional de interfaz.
- No crear todavía un sistema real de cuentas por este placeholder.

### Nivel BRAMU

- Dar mayor tamaño y protagonismo al valor, por ejemplo `5.4`.
- Mantener el label `NIVEL BRAMU`.
- No agregar `BETA`.
- No agregar por ahora explicación ni modal informativo.
- Relacionar visualmente la variación `+0.1` con la barra de progreso.
- Puede mostrarse al extremo de la barra o como último segmento diferenciado si el cálculo permite representarlo fielmente.
- No simular una proporción falsa.
- Mover `15 partidos en tu historia` debajo de la barra.

## 20. RECOMPONER “Último partido”

- Eliminar el degradado si no aporta legibilidad; usar una superficie azul noche consistente.
- Mover la línea de acento desde la parte superior hacia un lateral, preferentemente el izquierdo.
- Lima para victoria y coral contenido para derrota.
- Evitar glow permanente.
- Colocar el badge compacto junto a `ÚLTIMO PARTIDO`.
- En contexto compacto usar `VIC` y `DER` para liberar espacio.
- Fecha y lugar continúan alineados a la derecha.
- Mantener el resultado como primer nivel de lectura.
- Mantener el formato deportivo con guion/en dash:

```text
6–2 · 5–7 · 6–1
```

- Hacer los puntos separadores más pequeños y en gris secundario.
- Los separadores no deben tener el mismo peso ni color que los números.
- Verificar que “Último partido” se determine por fecha/hora real del encuentro y no por orden de carga.

## 21. REORDENAR las métricas del Home

Crear dos grupos visuales para evitar una jerarquía accidental.

### Últimos 30 días

- Actividad.
- Efectividad.

### Tu historial

- Racha actual.
- Partidos totales.
- Mejor compañero.
- Rival más enfrentado.

Unificar criterios de:

- títulos;
- color de títulos;
- métricas protagonistas;
- subtítulos;
- padding;
- bordes;
- estados táctiles.

La diferencia entre tarjetas grandes y compactas debe sentirse intencional.

## 22. AGREGAR navegación desde métricas

Solo las tarjetas con destino real deben parecer interactivas. Agregar chevron, feedback táctil o indicación equivalente únicamente donde corresponda.

### Racha actual

- Al tocar, abrir Historial filtrado a los partidos que componen la racha vigente.
- Si la racha actual es de 5 victorias, mostrar esos 5 partidos consecutivos más recientes hasta la primera derrota anterior.
- Si es una racha de derrotas, aplicar la misma lógica.
- Mostrar el filtro activo y permitir volver a `Todos`.

### Efectividad

- Al tocar, abrir Historial filtrado a los últimos 30 días.
- El conjunto mostrado debe ser exactamente el usado para calcular el porcentaje.
- Mostrar con claridad cuáles fueron victorias y cuáles derrotas.

### Mejor compañero

- Al tocar, abrir una nueva vista `COMPAÑEROS`.
- Listar todos los compañeros reales con los que jugó el jugador actual.
- Mostrar por persona:
  - avatar/inicial;
  - nombre;
  - partidos juntos;
  - victorias;
  - derrotas;
  - efectividad conjunta.
- Ordenar inicialmente por cantidad de partidos compartidos, de mayor a menor.
- En empate, ordenar por victorias y luego alfabéticamente.
- No incluir partidos observados ni placeholders.

### Rival más enfrentado

- Al tocar, abrir una nueva vista `RIVALES`.
- Tratar a cada rival como persona individual, no solamente como pareja rival.
- Mostrar por rival:
  - avatar/inicial;
  - nombre;
  - enfrentamientos;
  - victorias del jugador actual;
  - derrotas del jugador actual;
  - efectividad frente a ese rival.
- Ordenar por cantidad de enfrentamientos, de mayor a menor.
- En empate, ordenar por victorias y luego alfabéticamente.
- No incluir partidos observados ni placeholders.

### Sin navegación en V02.1

- `Actividad`: mantener sin acción hasta definir qué detalle aporta valor.
- `Partidos totales`: mantener sin acción porque Historial ya cumple esa función general.

No darles chevron ni apariencia de botón.

## 23. MOVER el pie de autoría al Home

Mover el pie actual de la pantalla de configuración del marcador al final del contenido del Home, debajo de las métricas.

Usar exactamente:

```text
BRAMUlab · Concepto y diseño por Sebastián Vila · BRAMUlab V02.1
```

- Debe ser discreto y secundario.
- Debe quedar por encima del espacio reservado a la navegación inferior.
- Eliminarlo de la configuración de partido y de cualquier lugar duplicado.
- Mantener el naming exacto `BRAMUlab`.

## 24. CONSERVAR “Tu momento” en esta pasada

- No reescribir todavía su sistema de insights.
- Conservar su contenido y funcionamiento, salvo correcciones necesarias por fechas o datos.
- Mantener el ícono de pelota ya implementado.
- La revisión profunda de sus frases queda fuera de V02.1.

---

# BLOQUE E — HISTORIAL

## 25. REEMPLAZAR la navegación principal del Historial

Usar como referencia de comportamiento la captura aportada de Mercado Pago, sin copiar su identidad visual, colores ni componentes literalmente.

### Pestañas principales

Dejar solamente:

```text
Todos | Mis partidos | Observados
```

- `Todos`: combina partidos propios y observados.
- `Mis partidos`: partidos en los que participa el jugador actual.
- `Observados`: partidos registrados desde afuera en los que no participa el jugador actual.
- Mostrar cantidad junto a cada pestaña cuando exista.
- La pestaña activa debe integrarse visualmente con la superficie del listado, como una solapa.
- Permitir desplazamiento horizontal solo si el viewport lo requiere.
- Mantener áreas táctiles cómodas.

### Quitar de la vista principal

Retirar la segunda fila visible:

- `Todos los modos`;
- `Cargados`;
- `Game por game`;
- `Punto por punto`.

No es necesario destruir la lógica de filtrado si sirve internamente, pero no debe competir con la navegación principal en V02.1.

## 26. AGREGAR estados de resultado en cada partido

En `Mis partidos` y en los partidos propios de `Todos`:

- mostrar badge compacto `VIC` o `DER`;
- calcularlo desde la perspectiva del jugador actual;
- no depender solamente del color de los nombres o del resultado.

En `Observados`:

- no usar `VIC/DER`, porque el usuario no participa;
- identificar claramente la pareja ganadora mediante un badge `GANÓ` o una indicación equivalente asociada a sus nombres.

Conservar colores de Equipo A y Equipo B para lectura del enfrentamiento.

## 27. SOPORTAR filtros abiertos desde el Home

Historial debe poder abrirse con un filtro contextual:

- `Racha actual`.
- `Últimos 30 días`.

El usuario debe ver qué filtro está activo, poder quitarlo y volver a las pestañas normales sin perder navegación.

---

# BLOQUE F — MODALES, SUPERFICIES Y TRANSPARENCIAS

## 28. CORREGIR Notificaciones

La apertura de Notificaciones todavía aplica un fondo/overlay verde musgo heredado del sistema anterior.

- Reemplazarlo por overlay oscuro neutro, sin dominante verde.
- Mantener el modal en azul noche.
- Verificar contraste del título, mensaje y botón `Cerrar`.
- Evitar transparencias que permitan competir al contenido del Home.
- La barra inferior no debe quedar interactiva por encima del modal.

## 29. AUDITAR sheets y modales

Revisar:

- Registrar partido.
- Elegir compañero/rival.
- Formato y puntuación.
- Fecha y hora.
- Notificaciones.
- Cualquier confirmación de borrado o edición.

### Criterios

- Overlay oscuro neutro y consistente.
- Superficie opaca azul noche.
- Sin verde musgo heredado.
- Z-index correcto.
- Safe area inferior.
- Contenido completamente visible en `402 × 874`.
- Barra inferior bloqueada cuando corresponde.
- Teclado de iPhone sin tapar acciones necesarias.

---

# BLOQUE G — TIPOGRAFÍA Y TERMINACIÓN VISUAL

## 30. CONSERVAR Inter y corregir su uso

Inter ya carga correctamente en iPhone después de la actualización.

- No cambiar de familia en V02.1.
- Verificar que se sirva localmente o de forma fiable en PWA.
- Mantener fallback razonable.
- Ajustar la jerarquía para evitar que todos los elementos parezcan igualmente pesados.

### Orientación de pesos

- Resultados y cifras protagonistas: 700/800.
- Títulos principales: 700.
- Títulos de tarjetas: 600/700.
- Nombres y metadatos: 500.
- Texto de cuerpo: 400.
- Texto de BRAMU Intelligence: 400/500.

Usar números tabulares donde corresponda.

## 31. CONSERVAR sin cambios estructurales

- Marcador en vivo.
- Equipos azul y magenta.
- Registro punto por punto, salvo regresiones detectadas.
- Registro por games, excepto tie-break y correcciones indicadas.
- Evolución, salvo ajustes menores de coherencia visual.
- Ranking actual como placeholder.
- Perfil y cierre de sesión.
- `privateNote` y su persistencia.
- Modelos de partidos existentes.
- Navegación inferior ya validada.
- Reglas deportivas no mencionadas en este consolidado.

---

# BLOQUE H — DATOS, COMPATIBILIDAD Y SEGURIDAD

## 32. PRESERVAR los datos existentes

- No borrar partidos cargados durante las pruebas.
- No reiniciar `localStorage` como solución.
- Implementar migraciones compatibles si las fechas o estructuras antiguas lo requieren.
- No duplicar partidos al confirmar, editar o volver desde Resumen.
- Mantener separación local entre dispositivos; V02.1 no incorpora sincronización ni cuentas reales.
- `@seba` es solamente una representación provisional de interfaz.

## 33. RESULTADOS Y PERSPECTIVA DEL JUGADOR

- Resolver siempre la identidad mediante el jugador actual real, no mediante el texto visible `Vos`.
- En partidos propios, calcular victoria/derrota desde su pareja.
- En partidos observados, no atribuirle victoria ni derrota al usuario.
- Compañeros y rivales deben derivarse únicamente de partidos propios.
- Normalizar comparaciones de nombres de manera segura sin fusionar por error personas distintas.

---

# BLOQUE I — VERIFICACIÓN, CAPTURAS Y ENTREGA

## 34. Tests automáticos

- Ejecutar la suite completa existente.
- No reducir cobertura ni eliminar tests para lograr aprobación.
- Agregar tests para:
  - últimos 30 días;
  - zona horaria y `Ahora`;
  - efectividad;
  - barras de actividad;
  - tie-break superior a 7;
  - validación del tercer set;
  - avance automático entre sets;
  - confirmación y guardado único;
  - resumen canónico;
  - eliminación del recorrido circular;
  - tabs de Historial;
  - badges VIC/DER;
  - filtro de racha;
  - filtro de 30 días;
  - agregación de compañeros;
  - agregación de rivales;
  - exclusión de placeholders y partidos observados;
  - logo no interactivo.

## 35. Pruebas funcionales obligatorias

1. Cargar un partido propio `6–2 · 5–7 · 6–4`.
2. Confirmar avance automático entre sets.
3. Verificar que no aparezca la advertencia incorrecta del tercer set.
4. Completar Confirmar partido, escribir una nota y guardar.
5. Comprobar una sola persistencia.
6. Abrir el único Resumen y verificar nota, análisis, Editar y Volver al inicio.
7. Abrir el mismo partido desde Historial y llegar al mismo Resumen.
8. Cargar un set `7–6` con tie-break `10–8`.
9. Editarlo y volver a abrirlo sin pérdida de datos.
10. Crear 11 partidos con fecha de hoy y verificar Actividad/Efectividad.
11. Probar Historial en Todos, Mis partidos y Observados.
12. Probar Racha actual y Efectividad desde el Home.
13. Verificar listados de Compañeros y Rivales.
14. Abrir todos los sheets con teclado visible en iPhone.
15. Abrir Notificaciones y verificar overlay neutro.
16. Tocar el logo del Home y confirmar que no navega.

## 36. Capturas obligatorias

Generar y revisar capturas reales en viewport iPhone 16 Pro `402 × 874` de:

1. Home: destacados y perfil.
2. Home: Último partido.
3. Home: métricas y pie.
4. Registrar partido.
5. Carga manual de Set 1.
6. Set siguiente después del avance automático.
7. Formato y puntuación.
8. Confirmar partido.
9. Resumen único.
10. Historial con pestañas.
11. Historial filtrado por racha.
12. Historial filtrado a 30 días.
13. Compañeros.
14. Rivales.
15. Notificaciones.

Revisar además las pantallas clave en escritorio para detectar desbordes, pero no rediseñar una aplicación desktop independiente.

## 37. PWA y publicación

- Verificar actualización del service worker y caché.
- Confirmar que Inter y los estilos nuevos carguen en iPhone después de actualizar.
- Evitar que el usuario quede en una versión visual híbrida.
- Actualizar la versión visible a `BRAMUlab V02.1`.
- Usar el naming oficial `BRAMUlab_V02.1` para la versión/tag; no volver a numeraciones paralelas como `v3.0`.
- Publicar únicamente después de aprobar tests y capturas.

## 38. Informe final

Crear:

```text
docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02.1_Informe.md
```

Debe indicar:

- cambios implementados;
- archivos funcionales modificados;
- migraciones realizadas;
- tests ejecutados y resultado;
- capturas generadas y ubicación;
- verificación en iPhone y escritorio;
- commit o commits;
- tag;
- estado del deploy;
- cualquier desvío respecto de este consolidado y su justificación.

No crear documentación adicional fuera del consolidado y el informe de la versión.

## 39. Orden de prioridad

1. Integridad de datos, fechas, Actividad y Efectividad.
2. Tie-break y validaciones deportivas.
3. Nuevo flujo Confirmar → Guardar → Resumen único.
4. Historial y filtros.
5. Navegación de métricas y nuevas vistas Compañeros/Rivales.
6. Home y jerarquía visual.
7. Sheets, transparencias y notificaciones.
8. Terminación tipográfica.
9. Capturas, documentación y publicación.

## 40. Autorización de ejecución

Implementar BRAMUlab V02.1 completa sin solicitar confirmaciones intermedias.

Detenerse solamente si aparece una contradicción que implique:

- perder datos existentes;
- cambiar una regla deportiva no definida;
- modificar el modelo funcional de una manera incompatible;
- introducir una dependencia externa o un sistema de cuentas no autorizado.

Ante una decisión puramente visual menor, resolver con criterio dentro del sistema V02 y documentarla en el informe.
