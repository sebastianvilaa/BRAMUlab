# BRAMUlab V02.3 — Ajuste acotado de carga manual y métricas del Home

## 1. Propósito

Esta es una ronda pequeña sobre V02.2. Debe corregir únicamente cuatro áreas:

1. color contextual al elegir rivales;
2. cierre del último set, Confirmar partido y edición de fecha/hora/lugar;
3. presentación de Notas en el Resumen;
4. lectura de Actividad y verificación de Efectividad.

No convertir esta ronda en una nueva auditoría general.

## 2. Lectura mínima

- Usar la V02.2 publicada como base.
- Leer este documento completo.
- Consultar BRAMUlab_V02.2_Informe.md solo para ubicar funciones y archivos afectados.
- No releer documentación histórica salvo bloqueo técnico real.

Este documento prevalece para V02.3.

---

# BLOQUE A — COLOR CONTEXTUAL EN EL SELECTOR

## 3. AJUSTAR el selector según el equipo

En ELEGIR RIVAL 1 y ELEGIR RIVAL 2, los accesos rápidos, el buscador y los estados activos conservan demasiado lenguaje celeste y se mezclan con el equipo propio.

Regla:

- Compañero / Equipo A: acento celeste.
- Rival 1 y Rival 2 / Equipo B: acento magenta.

En contexto de rival, usar magenta de forma controlada en:

- indicador de foco del buscador;
- borde o halo del avatar seleccionado o presionado;
- check o indicador de selección;
- acento de la acción para agregar un jugador sin cuenta.

No pintar nombres ni textos completos de magenta. El texto principal continúa blanco. El color debe orientar el rol, no dominar la pantalla.

Reutilizar las variables existentes de Equipo A y Equipo B; no crear colores nuevos.

---

# BLOQUE B — ÚLTIMO SET Y CONFIRMACIÓN

## 4. REEMPLAZAR el avance automático al finalizar el partido

El avance automático debe continuar funcionando entre Set 1, Set 2 y el set decisivo. Sin embargo, el último valor que define el partido no debe sacar inmediatamente al usuario de la pantalla.

Cuando el resultado final sea válido:

1. cerrar el teclado numérico;
2. mantener visible el último set completo;
3. mostrar el estado Resultado válido;
4. conservar accesibles Formato y Fecha, hora y lugar;
5. mostrar un único botón principal CONTINUAR;
6. recién al tocarlo abrir CONFIRMAR PARTIDO.

Esto crea una pausa deliberada para revisar o corregir el último set y modificar fecha/hora/lugar antes de continuar.

No reintroducir CONTINUAR entre sets: se usa solamente cuando el partido ya quedó definido.

## 5. RECOMPONER la tarjeta principal de Confirmar partido

La pantalla actual muestra un resultado grande suelto. Debe reutilizar la lógica visual deportiva del Resumen.

Estructura:

1. Header CONFIRMAR PARTIDO.
2. Badge VICTORIA o DERROTA.
3. Tarjeta de resultado con:
   - label GANADORES;
   - nombres de la pareja ganadora;
   - fila Equipo A con sus resultados;
   - fila Equipo B con sus resultados;
   - color celeste y magenta por equipo.
4. Tarjeta compacta de fecha, hora y lugar con acción Modificar.
5. Tarjeta de Notas.
6. Botón principal GUARDAR PARTIDO.

Reutilizar el mismo componente del Resumen, pero con números de set ligeramente más grandes para que el marcador conserve protagonismo.

No repetir el marcador como una línea grande por fuera de la tarjeta. No agregar Sets ganados ni Games ganados en esta confirmación.

## 6. RECOMPONER Fecha, hora y lugar

El sheet actual tiene diferencias evidentes de tamaño, baseline y estilo entre Fecha y Hora.

Fecha y hora:

- dos columnas equivalentes;
- mismos labels, tipografía, tamaño, peso y altura de campo;
- Fecha y Hora con el mismo cuerpo visual;
- formato de 24 horas en toda la app: 14:50, no 2:50 p. m.;
- íconos de calendario y reloj del mismo tamaño y alineación;
- Borrar hora como acción terciaria discreta, sin romper la altura de la fila.

Lugar:

- campo a ancho completo con la misma altura y superficie;
- placeholder Nombre del lugar o club (opcional);
- Usar mi ubicación pasa a ser una acción secundaria compacta con icono, no una acción lima protagonista.

Cierre:

- botón LISTO como única acción principal lima;
- título centrado;
- altura ajustada al contenido;
- safe area correcta en iPhone.

---

# BLOQUE C — NOTAS EN EL RESUMEN

## 7. REEMPLAZAR Agregar nota privada por una tarjeta permanente

El enlace actual queda perdido entre BRAMU Intelligence y los botones finales.

En el Resumen debe existir siempre una tarjeta con el título:

NOTAS DEL PARTIDO · SOLO VOS

Sin nota:

- mostrar la tarjeta vacía con el estado Tocá para agregar una nota;
- la tarjeta completa es tocable;
- no mostrar un enlace independiente Agregar nota privada.

Con nota:

- mostrar el texto guardado dentro de la misma tarjeta;
- permitir tocar la tarjeta para editar;
- mantener la persistencia privada existente.

Decisión confirmada: conservar sin cambios el botón ancho EDITAR PARTIDO, el botón lima VOLVER AL INICIO y la barra inferior global. La convivencia queda aprobada por el usuario.

---

# BLOQUE D — ACTIVIDAD Y EFECTIVIDAD

## 8. CORREGIR la lectura visual de Actividad

La altura de cada barra debe representar la cantidad total de partidos del período, independientemente de si fueron victorias o derrotas.

Actualmente una derrota puede quedar representada solamente por una superficie oscura casi indistinguible del estado vacío. Esto hace parecer que el partido viejo no existe.

Nuevo tratamiento:

- las cuatro barras mantienen el orden cronológico existente, más antiguo a la izquierda;
- toda barra con uno o más partidos debe tener un relleno visible;
- usar celeste para el volumen total de actividad;
- no usar la Actividad para codificar victorias: la Efectividad ya cumple esa función;
- una barra vacía conserva únicamente el baseline oscuro;
- mantener altura proporcional a la cantidad de partidos;
- si los cuatro períodos tienen un partido, deben verse cuatro barras activas equivalentes.

No cambiar la ventana temporal sin antes verificar el cálculo existente.

## 9. VERIFICAR el cálculo temporal de Actividad

Probar con partidos propios a:

- 2 días;
- 10 días;
- 18 días;
- 26 días;
- 31 días.

Resultado esperado:

- los primeros cuatro en cuatro períodos distintos;
- el de 31 días excluido;
- usar playedAt, no fecha de creación ni orden de carga;
- excluir observados y partidos donde no participa el jugador actual;
- respetar hora local y excluir timestamps futuros.

Si la lógica pura ya produce este resultado, no reescribirla: corregir solamente la representación visual.

## 10. VERIFICAR y blindar Efectividad

La Efectividad de los últimos 30 días debe ser:

victorias propias / partidos propios con resultado definido

Reglas:

- usar exactamente la misma ventana temporal y el mismo conjunto que abre el filtro Últimos 30 días del Historial;
- excluir observados;
- excluir partidos sin ganador definido;
- calcular desde la perspectiva del jugador actual, aunque figure en Equipo B;
- mostrar porcentaje redondeado y relación X de Y;
- partidos anteriores a 30 días no afectan el cálculo;
- no modificar el diseño del donut salvo necesidad funcional.

Casos mínimos:

- 2 victorias + 1 derrota = 67% y 2 de 3;
- 1 victoria + 3 derrotas = 25% y 1 de 4;
- el jugador en Equipo B debe calcularse correctamente;
- un observado no modifica el porcentaje;
- un partido de 31 días no modifica el porcentaje.

---

# BLOQUE E — FUERA DE ALCANCE

## 11. CONSERVAR sin cambios

- Historial y sus pestañas: la mejora actual se acepta provisionalmente.
- Tarjeta Último partido: se ajustará después mediante Inspector con indicaciones exactas del usuario.
- Botones EDITAR PARTIDO y VOLVER AL INICIO del Resumen.
- BRAMU Intelligence.
- Ranking, Perfil y navegación general.
- Registro por games y punto a punto.
- Reglas deportivas.
- Backlog y funciones futuras.
- Datos existentes y esquema de localStorage.

No aprovechar esta ronda para mejorar otras pantallas.

---

# BLOQUE F — VALIDACIÓN ACOTADA Y ENTREGA

## 12. Tests

- Ejecutar toda la batería existente.
- Agregar solamente tests para:
  - detención después del set final hasta tocar CONTINUAR;
  - Actividad con 2, 10, 18, 26 y 31 días;
  - Actividad visible para derrotas;
  - Efectividad y perspectiva de Equipo B;
  - exclusión de observados y partidos fuera de ventana.

## 13. Verificación visual mínima

No hacer capturas paso a paso ni una auditoría de toda la aplicación.

Revisar únicamente:

1. Selector ELEGIR RIVAL con acento magenta.
2. CONFIRMAR PARTIDO y sheet FECHA, HORA Y LUGAR.
3. Resumen con tarjeta de Notas vacía.
4. Home con cuatro períodos de Actividad alimentados por fechas de prueba.

Guardar capturas solo si la herramienta ya lo permite sin incorporar dependencias ni trabajo adicional. Si no, documentar la revisión brevemente.

## 14. Versión y documentación

Al finalizar:

- versión visible BRAMUlab V02.3;
- actualizar version.json y caché del service worker;
- publicar en GitHub Pages;
- crear tag BRAMUlab_V02.3;
- actualizar README;
- registrar el cambio en el changelog único si ya existe;
- crear BRAMUlab_V02.3_Informe.md en esta misma carpeta;
- incluir commit exacto, tag, tests y URL publicada.

No crear una carpeta V02.3.

## 15. Autorización

Claude queda autorizado a implementar y publicar esta ronda sin pedir confirmaciones intermedias, siempre que respete estrictamente el alcance reducido y no borre datos ni documentación.
