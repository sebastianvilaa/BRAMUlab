# BRAMU Lab — Etapa 4.1

## v2.1 · Historial filtrable y evolución personal simulada

**Estado:** especificación lista para implementación.
**Base obligatoria:** BRAMU Lab v2.0, commit 9fcad8ca7221148268c4bcb7aa3b075f7cbd03d6, tag v2.0.
**Aplicación autorizada:** bramulab/ únicamente.
**Aplicación congelada:** bramulab-partidos/ v14. No tocar ningún archivo, versión, caché, manifest ni service worker de esa aplicación.

## 1. Objetivo

Convertir la versión v2.0 ya publicada en una beta más fácil de recorrer y evaluar:

1. Corregir dos inconsistencias verificadas externamente en producción.
2. Darle al Historial pestañas y filtros horizontales que trabajen con estados reales.
3. Reemplazar el Nivel BRAMU fijo por una evolución personal simulada, derivada de los partidos cargados localmente.
4. Mantener todos los flujos funcionales de v2.0 sin regresiones.

Esto sigue siendo una beta local. No pretende resolver todavía el nivel oficial ni la validación entre jugadores.

## 2. Hallazgos externos de v2.0 que deben corregirse primero

### 2.1. Regreso desde Historial

En producción, el botón Volver del Historial lleva a la pantalla tradicional Configurar partido. Desde la navegación del jugador debe volver al Home Mi pádel.

Regla:

- Si Historial se abrió desde la barra inferior o desde el Home, Volver lleva al Home.
- Si todavía existe otro punto de entrada heredado que necesite regresar a Configurar partido, conservar el origen explícitamente. No adivinarlo por estado visual.
- Inicio de la barra inferior siempre lleva al Home.
- Recargar la app con identidad y sin partido activo sigue entrando al Home.

### 2.2. Ancho real de hojas y selectores

La revisión externa midió 480 px en producción para Registrar partido y Elegir jugador en un viewport de escritorio/tablet, aunque el informe de v2.0 declara 640 px. Es la misma sensación de modal angosto que señaló Sebastián.

Regla:

- En móvil: hoja inferior a todo el ancho disponible de la aplicación.
- En tablet y escritorio: el panel debe coincidir con el ancho útil del shell principal de BRAMU Lab, hasta 768 px, centrado.
- No dejar topes heredados de 480 px ni una excepción que vuelva a angostar el selector de jugadores.
- Aplicar el mismo criterio a Registrar partido, Registrar en vivo, Elegir jugador y los selectores equivalentes.
- Mantener esquinas superiores, scrim, cierre por cruz, toque exterior y gesto cuando corresponda.
- Verificar el ancho con getBoundingClientRect, no solo visualmente.

## 3. Historial con pestañas y filtros horizontales

### 3.1. Primera fila: pertenencia del partido

Usar una fila horizontal desplazable, sin salto de línea:

- Todos
- Mis partidos
- Observados

No mostrar Pendientes todavía. Ese estado se incorporará cuando exista el modelo real de invitación y validación; una pestaña vacía o simulada generaría una promesa falsa.

Clasificación:

- Mis partidos: el jugador actual aparece entre los cuatro participantes.
- Observados: el partido fue registrado en este dispositivo, pero el jugador actual no aparece entre los participantes.
- Todos: unión de ambos.

Mostrar cantidad real junto a cada etiqueta si no ensucia la lectura, por ejemplo Todos 9. El conteo debe responder a los datos, no ser fijo.

### 3.2. Segunda fila: modo de registro

Debajo de la primera fila, usar chips horizontales como filtro secundario:

- Todos los modos
- Cargados
- Game por game
- Punto por punto

El resultado visible es la intersección de la pestaña primaria y el chip secundario.

Usar la información real ya guardada por cada partido. No inferir el modo por la cantidad de eventos si existe un campo canónico.

### 3.3. Comportamiento

- Estado inicial: Todos + Todos los modos.
- Mantener orden descendente por playedAt completo, independientemente del orden de carga.
- Al editar o eliminar, conservar el filtro si sigue siendo válido y actualizar conteos.
- Una lista vacía debe explicar el filtro activo y ofrecer una salida clara: Ver todos o Registrar partido según corresponda.
- La fila se desplaza horizontalmente con el dedo y debe dejar entrever que hay más opciones.
- No usar un carrusel automático.
- El elemento activo debe distinguirse por forma, peso y color, no solo por color.
- En tablet y escritorio conservar el mismo patrón horizontal dentro del ancho de contenido.
- Toda la tarjeta del partido sigue abriendo el detalle. El control eliminar no debe disparar también la apertura.

## 4. Evolución personal simulada

### 4.1. Ubicación y lenguaje

Agregar en Perfil una tarjeta llamada EVOLUCIÓN DEL NIVEL BRAMU, debajo de la identidad principal.

Debe llevar una etiqueta visible SIMULADO · BETA. No llamarlo ranking, categoría oficial ni nivel validado.

La tarjeta de jugador del Home debe consumir el mismo cálculo para mostrar:

- nivel actual;
- variación del último partido;
- progreso visual coherente.

Eliminar el valor fijo 5.3 / ↑ 0.2 como fuente de verdad. No almacenar una segunda evolución paralela.

### 4.2. Fuente de datos

- Solo partidos terminados en los que participa el jugador actual.
- En esta beta, los partidos manuales cargados por el propio usuario sí cuentan aunque todavía no exista validación rival.
- Los partidos Observados no modifican el nivel.
- Los partidos incompletos, abandonados o sin ganador definido no modifican el nivel.
- Ordenar cronológicamente por playedAt ascendente antes de calcular.
- Editar o eliminar un partido obliga a recalcular toda la serie de manera determinista.
- El nivel es derivado: no guardar puntos acumulados independientes que puedan desincronizarse del historial.

### 4.3. Regla provisional para probar la interfaz

Punto de partida: 5.0.

En esta simulación, un número mayor significa mejor nivel. La regla no intenta ser el algoritmo definitivo:

- Victoria en dos sets: +0.2.
- Victoria necesitando un tercer set: +0.1.
- Derrota en dos sets: -0.2.
- Derrota en tres sets: -0.1.
- Partido Americano terminado: +0.1 por victoria y -0.1 por derrota.
- Redondear cada paso a un decimal.
- Limitar el valor entre 1.0 y 10.0.

Centralizar la regla en constantes y funciones puras para reemplazarla después sin reescribir la interfaz.

### 4.4. Gráfico

- Línea temporal de izquierda a derecha.
- Eje horizontal: partidos por fecha.
- Eje vertical: Nivel BRAMU.
- Un nivel mayor se dibuja más arriba.
- Línea lima sobre fondo oscuro, grilla secundaria tenue y puntos seleccionables.
- El último punto puede tener el pulso sutil ya definido en el sistema de movimiento.
- Al tocar un punto: fecha, resultado, victoria o derrota, rivales y nivel resultante.
- Con cero partidos: estado vacío honesto y nivel base 5.0.
- Con un partido: un punto visible; no inventar una línea.
- Con muchos partidos: desplazamiento horizontal o densidad adaptativa, sin volver ilegibles las fechas.
- El rango vertical puede adaptarse a los datos con margen visual, pero el tooltip conserva el valor exacto.
- Respetar prefers-reduced-motion.

### 4.5. Resumen numérico

Dentro de la tarjeta mostrar, sin recargarla:

- Nivel actual.
- Cambio acumulado desde 5.0.
- Cantidad de partidos considerados.

No agregar predicciones, percentiles ni posición nacional.

## 5. Datos locales y compatibilidad

- Conservar el localStorage actual y sus claves.
- No migrar ni borrar partidos existentes.
- El cálculo nuevo debe tolerar registros viejos sin hora, lugar o modo explícito.
- No compartir datos con bramulab-partidos/.
- No introducir backend, login ni sincronización entre dispositivos.
- Aclarar en estados vacíos o de ayuda que los datos viven en este dispositivo.

## 6. Pruebas mínimas obligatorias

### Funciones puras

- Clasificación Mis partidos / Observados.
- Intersección de pestaña y modo.
- Conteos por pestaña.
- Orden por playedAt.
- Evolución con victorias y derrotas en dos y tres sets.
- Americano.
- Exclusión de observados e incompletos.
- Recálculo tras editar y eliminar.
- Cero y un partido.
- Redondeo y límites 1.0–10.0.

### Integración

- Volver desde Historial abierto por barra inferior regresa al Home.
- Inicio siempre regresa al Home.
- Los paneles activos miden el ancho esperado en 390, 834 y 1366 px.
- Elegir jugador no queda limitado a 480 px.
- Cambiar filtros no altera ni duplica datos.
- Abrir, editar y eliminar funcionan desde una lista filtrada.
- Home, Perfil e Historial muestran el mismo nivel derivado.
- Punto por punto y Game por game no sufren regresiones.
- Resumen continúa sin Compartir visible.
- Actualización PWA funciona desde v2.0 a v2.1.
- Suite completa en verde y consola sin errores propios.

## 7. Fuera de alcance

- Algoritmo oficial de Nivel BRAMU.
- Ranking real.
- Base de datos, cuentas y sincronización.
- Amigos, grupos y comunidades.
- Validación por rivales y estado Pendiente.
- Dynamic Island, Live Activities y pantalla bloqueada.
- Rediseño visual integral.
- Personalización de tarjetas.
- Cambios en BRAMU Lab Partidos v14.

## 8. Criterios de aceptación

1. Los dos hallazgos de v2.0 quedan corregidos y demostrados con mediciones.
2. Historial permite filtrar por pertenencia y modo con datos reales.
3. No aparece Pendientes antes de existir su modelo.
4. La evolución responde de inmediato a guardar, editar y eliminar partidos.
5. Home y Perfil usan una única fuente derivada de nivel.
6. La serie es reproducible a partir del historial.
7. Los datos anteriores permanecen intactos.
8. Mobile, tablet y escritorio son utilizables.
9. No hay regresiones en carga manual ni registro en vivo.
10. bramulab-partidos/ permanece byte a byte fuera del cambio.
11. Se publica como v2.1 solo después de pruebas completas.
12. El informe final permite revisión externa sin depender del chat.

## 9. Entrega esperada de Claude

- Implementar en una rama de trabajo o con un commit de base claramente identificado.
- Ejecutar pruebas automáticas y manuales en los tres viewports.
- Publicar únicamente cuando todo esté verde.
- Commit y tag v2.1.
- Crear el informe BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Informe.md dentro de docs/bramulab/informes/.
- Informar archivos modificados, fórmula aplicada, resultados de pruebas, commit, tag, deploy, URLs y confirmación explícita de que bramulab-partidos/ no fue tocada.
- Dejar cualquier duda o decisión técnica en el informe para que ChatGPT pueda revisarla; Sebastián actúa como intermediario y no necesita resolver detalles técnicos.
