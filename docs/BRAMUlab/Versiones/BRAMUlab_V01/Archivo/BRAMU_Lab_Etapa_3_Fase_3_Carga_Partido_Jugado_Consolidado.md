# BRAMU Lab — Etapa 3 · Fase 3
## Rediseño funcional de «Cargar mi partido jugado»

**Estado:** AUTORIZADO PARA IMPLEMENTAR  
**Fecha:** 02 SEP 2026  
**Aplicación:** BRAMU Lab principal (`bramulab/`)  
**Versión de partida:** v1.2.1  
**Versión objetivo:** v1.3  
**Base técnica verificada:** commit `2ec46aa2173d2fd5e8b70a9fdab72b2fc84263be` · 382/382 tests OK  
**Aplicación protegida:** BRAMU Lab Partidos (`bramulab-partidos/`) permanece congelada en v14.

---

## 1. Propósito

Reemplazar la carga manual actual por una experiencia compacta y clara que se sienta como **completar un marcador**, no como llenar un formulario largo.

Esta Fase 3 cubre el flujo completo de «Cargar mi partido jugado»:

- estructura del marcador;
- selección local de jugadores;
- ingreso del resultado;
- validación;
- formato y sistema de puntuación;
- fecha, hora y lugar;
- guardado;
- resumen de lectura;
- edición posterior.

Debe implementarse internamente en las subfases 3a–3e, pero publicarse solamente cuando el flujo completo sea funcional y la suite esté verde. No exponer en producción una pantalla incompleta.

---

## 2. Documentos de contexto y precedencia

Leer antes de programar:

1. Este consolidado específico.
2. `docs/bramulab/informes/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Informe.md`
3. `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md`
4. `docs/bramulab/consolidados/BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`
5. `docs/bramulab/informes/BRAMU_Rama_Jugador_Etapa_3_Plan_y_Reorganizacion.md`

Precedencia ante diferencias:

1. este consolidado;
2. estado real documentado en v1.2.1;
3. adenda;
4. consolidado maestro;
5. plan técnico original.

El plan técnico original utiliza nombres de rutas anteriores como `bramu-player/`. No restaurarlos. La aplicación activa y canónica es actualmente `bramulab/`.

No repetir la separación de aplicaciones, la reorganización documental, la semántica de fecha ni la Fase 2: ya están terminadas.

---

## 3. Alcance exacto

### Implementar ahora

1. Nueva pantalla completa «Cargar partido jugado».
2. Jugador actual fijo como primer integrante del Equipo A.
3. Selector local para compañero y rivales.
4. Marcador de hasta tres sets.
5. Teclado numérico propio.
6. Validación pura y explicaciones específicas.
7. Selector compacto de formato y sistema de puntuación.
8. Fecha, hora y lugar opcional.
9. Guardado compatible con el historial existente.
10. Resumen posterior a la carga.
11. Edición con todos los datos precargados.
12. Salida segura con confirmación cuando existan cambios.

### No implementar ahora

- reorganización del Home y sus tarjetas;
- rediseño del Historial;
- pestañas o filtros futuros;
- cuentas, autenticación o base de datos;
- amigos, perfiles públicos o búsqueda real por usuario;
- validación social de partidos;
- ranking o Nivel BRAMU;
- Partido Libre o resultados arbitrarios;
- rediseño visual global;
- cambio global de tipografías o paleta;
- cambios en el marcador en vivo;
- cambios en BRAMU Intelligence del modo Punto por punto;
- funciones de BRAMU Lab Partidos.

---

## 4. Estrategia de ejecución

Trabajar localmente en cinco subfases. Después de cada una:

- ejecutar los tests relevantes;
- revisar regresiones;
- mantener el código en estado recuperable;
- continuar solamente si está verde.

No hacer push ni publicar una versión parcial. El push a `main` se realiza al finalizar 3e, con todo el flujo verificado como v1.3.

Subfases:

- **3a:** estructura y jerarquía de la pantalla.
- **3b:** selector local de jugadores.
- **3c:** teclado numérico y validación de resultados.
- **3d:** formato, sistema, fecha, hora y lugar.
- **3e:** guardado, Resumen, edición y navegación final.

No generar cinco informes. Entregar un único informe autocontenido final, detallando el resultado de cada subfase.

---

# SUBFASE 3A — ESTRUCTURA

## 5. Pantalla y jerarquía

La pantalla reemplaza visual y funcionalmente la carga manual actual.

### Cabecera

- Flecha para volver.
- Título: **Cargar partido jugado**.
- Sin barra inferior durante este flujo.
- No usar «Inicio» para referirse a Configurar partido.

### Marcador

El marcador debe permanecer como elemento central y visible mientras se cargan los datos.

Estructura:

- dos filas: Equipo A y Equipo B;
- jugadores compactos dentro de cada fila;
- hasta tres sets en columnas;
- cada resultado es una celda individual;
- separador sobrio entre los equipos;
- inspiración estructural en la tabla del Resumen existente, sin copiarla literalmente;
- responsive para iPhone y tablet/escritorio;
- evitar scroll innecesario antes de llegar al resultado.

Los componentes nuevos deben tener clases reutilizables y roles semánticos, preparados para el rediseño visual posterior.

No aplicar todavía una nueva identidad visual general.

---

# SUBFASE 3B — JUGADORES

## 6. Jugador actual

- El jugador identificado en el dispositivo ocupa automáticamente Jugador 1 del Equipo A.
- Mostrar su nombre real y visible: «Seba», «Sebastián», etc.
- No mostrar el texto genérico «Vos».
- Ese lugar queda fijo y no se edita desde esta pantalla.
- Si por una inconsistencia técnica no existe identidad, resolver primero la identificación y regresar al flujo sin perder contexto.

## 7. Compañero y rivales

Deben seleccionarse:

- compañero del Equipo A;
- Jugador 1 del Equipo B;
- Jugador 2 del Equipo B.

Al tocar un lugar vacío se abre una hoja inferior.

### Contenido de la hoja

1. Jugadores recientes, priorizados por uso, en desplazamiento horizontal.
2. Buscador único que filtra mientras se escribe.
3. Coincidencias de jugadores conocidos localmente.
4. Acción final: **Agregar “[nombre]” como jugador sin cuenta**.

### Reglas

- Reutilizar los nombres y datos locales existentes.
- No construir backend, amigos ni búsqueda real por `@usuario`.
- No exigir cuenta a ningún jugador.
- Excluir:
  - al usuario actual;
  - jugadores ya elegidos en cualquiera de los otros lugares.
- No permitir duplicados aunque cambien mayúsculas, minúsculas o espacios.
- Al agregar un jugador sin cuenta, normalizar el nombre mediante la función canónica existente y recordarlo localmente.
- Permitir reemplazar o quitar compañero/rivales antes de guardar.
- Cerrar la hoja con cruz, fondo, Escape y gesto donde ya exista soporte reutilizable.
- Una ausencia real de gesto táctil solo puede quedar como prueba pendiente para el gesto; los botones, búsqueda y selección deben probarse en navegador mediante clics.

La referencia funcional es el patrón de seleccionar un destinatario de Mercado Pago: recientes + búsqueda + alta simple. No copiar su estética.

---

# SUBFASE 3C — RESULTADO Y VALIDACIÓN

## 8. Teclado numérico propio

Al tocar una celda de resultado, abrir un panel numérico propio:

`1 2 3`  
`4 5 6`  
`7 8 9`  
`borrar 0 siguiente`

Reglas:

- el marcador continúa visible;
- la celda activa queda claramente destacada;
- en un set normal se habilitan 0–7;
- 8 y 9 pueden permanecer visibles pero deshabilitados;
- en tie-break o súper tie-break se habilitan todos los números;
- los valores de más de un dígito deben poder completarse;
- en sets normales, una selección puede avanzar automáticamente a la celda contigua;
- en tie-break se utiliza **Siguiente**, porque `1` puede transformarse en `10`, `11`, etc.;
- Volver cierra primero el teclado antes de intentar salir de toda la pantalla;
- debe poder corregirse cualquier celda antes de guardar.

No invocar el teclado nativo del teléfono como experiencia principal para el resultado.

## 9. Aparición del tercer set

- Mostrar inicialmente los dos primeros sets.
- El tercer set aparece cuando los dos primeros dejan el partido 1–1.
- Si una corrección elimina el 1–1, limpiar de forma segura cualquier valor del tercer set que ya no corresponda, con una decisión explícita y testeada.
- Nunca guardar valores invisibles o huérfanos.

## 10. Validación

Solo permitir resultados completos y posibles para el formato seleccionado.

- Reutilizar las reglas reglamentarias existentes, especialmente `E.isValidCompletedSetScore` o la fuente de verdad equivalente.
- No distribuir reglas deportivas directamente por eventos DOM.
- Aislar la validación en funciones puras y testeables.
- No habilitar Guardar mientras falten jugadores, fecha o resultado válido.
- Explicar el problema concreto cerca del marcador:
  - falta completar un set;
  - resultado imposible;
  - falta definir el tercer set;
  - jugador duplicado;
  - otro caso específico.
- No usar solamente «Hay un error».
- Un tie-break de set puede cargarse como `7-6` o `6-7`; no exigir sus puntos internos en esta versión.
- No implementar resultados interrumpidos, parciales ni formatos libres.

La validación debe contemplar Clásico y Americano según las reglas ya disponibles en el motor actual, sin inventar formatos nuevos.

---

# SUBFASE 3D — CONTEXTO DEL PARTIDO

## 11. Formato y sistema de puntuación

Reemplazar los bloques grandes de configuración por una línea compacta, por ejemplo:

**Clásico · Mejor de 3 · Punto de Oro ›**

Al tocarla, abrir una hoja o modal reutilizando las opciones y lógica existentes:

- Clásico / Americano;
- Star Point / Punto de Oro / Con Ventaja.

Reglas:

- no duplicar el motor ni las reglas;
- mantener los defaults actuales de la carga habitual;
- si cambiar el formato invalida datos ya cargados, explicarlo y pedir confirmación antes de limpiar lo incompatible;
- la interfaz puede adaptar la cantidad o naturaleza de sets según el formato real existente.

## 12. Fecha, hora y lugar

Debajo del marcador:

- fecha;
- hora;
- lugar o club opcional.

Reglas:

- fecha y hora por defecto: momento actual;
- ambas editables;
- persistir la combinación como `playedAt`;
- persistir por separado `createdAt` como momento técnico de guardado, siguiendo la semántica ya implementada;
- lugar opcional, sin autocompletado remoto ni base de clubes;
- conservar compatibilidad con registros históricos sin estos campos;
- no usar `finishedAt` para alterar la historia deportiva.

---

# SUBFASE 3E — GUARDADO, RESUMEN Y EDICIÓN

## 13. Guardar partido

Acción final: **Guardar partido**.

- Una sola acción lima principal en esta superficie.
- Deshabilitada mientras el formulario no sea válido.
- Evitar doble guardado por toques repetidos.
- Crear o actualizar el registro una sola vez mediante una identidad estable.
- Conservar compatibilidad con el historial y agregaciones actuales.
- Un partido cargado manualmente no es «Partido en curso».
- No debe generar la franja activa ni mezclarse con el snapshot del marcador en vivo.

## 14. Resumen de lectura posterior

Después de guardar, abrir un Resumen que funcione como comprobación final.

Mostrar:

- victoria o derrota desde la perspectiva del jugador actual;
- resultado completo;
- jugadores y parejas;
- fecha;
- hora;
- lugar, si fue cargado;
- formato;
- sistema de puntuación;
- sets y games disponibles.

BRAMU Intelligence:

- incluir únicamente una devolución breve y factual que pueda inferirse del resultado;
- no inventar puntos, breaks, saques, dominio, remontadas internas ni estadísticas ausentes;
- no abrir una pantalla de Análisis separada si solo repetiría información débil.

Acciones:

- **Volver a Mi pádel** → abre el Home con las tarjetas y el partido reflejado en «Último partido».
- **Editar partido** → reabre esta misma pantalla completa con todos los datos precargados.

No usar «Volver al inicio» para abrir Configurar partido.

## 15. Edición

La edición debe poder iniciarse:

- inmediatamente desde el Resumen;
- desde el detalle del partido, si ese acceso ya existe o corresponde integrarlo dentro del alcance actual.

Debe precargar:

- jugadores;
- resultado;
- formato;
- sistema;
- fecha;
- hora;
- lugar.

Al guardar una edición:

- actualizar el registro existente;
- no duplicarlo;
- recalcular las tarjetas actuales que dependan del historial;
- volver al Resumen actualizado;
- conservar `createdAt` original o documentar con precisión la decisión si existe un campo técnico de actualización;
- mantener `playedAt` según lo que el usuario haya elegido.

## 16. Salida sin guardar

- Si no hubo cambios, Volver regresa directamente al Home.
- Si existen cambios, preguntar **¿Salir sin guardar?**
- Acción segura principal: continuar editando.
- Acción destructiva: salir sin guardar.
- Si hay teclado, selector o modal abierto, Volver cierra primero esa capa.
- No crear borradores persistentes.
- No afectar un eventual partido en vivo que pudiera existir salvo que el producto ya impida correctamente superponer ambos flujos; documentar el comportamiento real.

---

## 17. Reglas visuales y de movimiento

Aplicar solamente al flujo nuevo:

- una acción lima principal por superficie;
- rojo solo para confirmación destructiva final;
- mayúsculas para volantas/estados pequeños;
- títulos y acciones en mayúscula/minúscula con peso fuerte;
- cuerpo en Regular;
- usar los tokens de movimiento ya creados;
- desplazamiento breve para hojas;
- latido únicamente si comunica un estado vivo real;
- no sumar emojis como iconos;
- reutilizar SVG o iconos coherentes existentes;
- respetar `prefers-reduced-motion`;
- no cambiar todavía Oswald/Manrope;
- no aplicar todavía la futura combinación Arena/Túnel + Cancha nocturna;
- no rediseñar otras pantallas.

---

## 18. Protección del producto existente

No modificar, salvo necesidad estrictamente aditiva y documentada:

- motor de puntuación en vivo;
- lógica probada de Game por game;
- lógica probada de Punto por punto;
- BRAMU Intelligence del partido completo;
- recuperación del partido activo;
- botón central `+`;
- Home actual;
- Historial actual;
- Resumen/Análisis del partido en vivo;
- namespace de almacenamiento;
- BRAMU Lab Partidos.

Si se necesita compartir una función pura del motor, reutilizarla. No copiar una segunda versión de la regla.

---

## 19. Pruebas automáticas

La línea base es 382/382. Toda función pura nueva debe tener pruebas permanentes.

Cobertura mínima:

### Jugadores

- exclusión del usuario actual;
- exclusión de seleccionados;
- búsqueda normalizada;
- no duplicados;
- alta local sin cuenta;
- nombres con espacios, mayúsculas y acentos.

### Resultado

- victoria 2–0;
- victoria 2–1;
- derrota 0–2;
- derrota 1–2;
- tercer set visible solo con 1–1;
- 7–6 / 6–7;
- resultados imposibles;
- partido incompleto;
- Americano según las reglas existentes;
- cambio de formato con datos incompatibles;
- valores de más de un dígito cuando correspondan;
- limpieza de tercer set huérfano.

### Fechas y persistencia

- `playedAt` usa fecha/hora elegidas;
- `createdAt` usa momento de guardado;
- edición mantiene identidad estable;
- edición no duplica historial;
- último partido se ordena por `playedAt`.

No falsificar tests DOM dentro de `tests.html` si no representan el comportamiento real. Para funciones puras, sí agregar tests unitarios.

---

## 20. Pruebas de interfaz en navegador

Claude debe probar mediante interacción real de navegador —clics, escritura y selección— todos los botones y recorridos. La ausencia de dispositivo táctil no es una limitación válida para controles clicables.

Casos mínimos:

1. Abrir `+` → Cargar mi partido jugado.
2. Jugador actual fijo y visible.
3. Elegir compañero y dos rivales.
4. Buscar y agregar un jugador sin cuenta.
5. Confirmar que no se permiten duplicados.
6. Cargar un 2–0.
7. Cargar un 2–1 y ver aparecer el tercer set.
8. Corregir una celda.
9. Cambiar formato/sistema.
10. Editar fecha, hora y lugar.
11. Intentar guardar un resultado inválido y leer el mensaje específico.
12. Guardar uno válido.
13. Ver el Resumen.
14. Volver a Mi pádel y comprobar «Último partido».
15. Editar desde Resumen, guardar y confirmar que no se duplica.
16. Salir sin cambios.
17. Intentar salir con cambios y cancelar/confirmar.
18. Recargar la app y comprobar persistencia.
19. Confirmar que Game por game y Punto por punto siguen funcionando.
20. Confirmar que un partido en vivo activo se recupera.
21. Responsive en ancho iPhone y tablet/escritorio.
22. Teclado mediante mouse y teclado físico donde corresponda.
23. Escape, fondo y cruz en hojas/modales.
24. Consola sin errores.

Solo deben quedar para iPhone real:

- sensación y tamaño táctil;
- gesto real de deslizar;
- teclado/comportamientos específicos de iOS;
- instalación PWA, background/foreground y caché;
- evaluación visual humana final.

Si el proyecto no posee todavía un arnés E2E, no presentar eso como imposibilidad de probar botones: realizar y documentar las pruebas de navegador. Puede proponerse un arnés futuro sin agregar dependencias pesadas en esta fase.

---

## 21. Versionado, commit y despliegue

Al completar todo el flujo:

- `APP_VERSION`: v1.3;
- `version.json`: v1.3;
- caché del service worker: v1.3;
- mantener el aviso de actualización;
- no utilizar «V18», «V19» ni numeraciones paralelas.

Formato recomendado del commit:

`BRAMU Lab v1.3 · rediseño Cargar partido jugado`

Antes del push:

- suite completa verde;
- pruebas de interfaz realizadas;
- diff revisado;
- cero archivos modificados en `bramulab-partidos/`;
- ninguna funcionalidad futura introducida como código muerto.

Después del push:

- confirmar build de GitHub Pages;
- ejecutar los tests en producción;
- verificar versión real;
- limpiar solamente los datos de prueba creados por Claude, sin tocar datos reales del usuario.

---

## 22. Informe final

Crear:

`docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Informe.md`

Debe ser autocontenido e incluir:

- diagnóstico inicial breve;
- implementación de cada subfase 3a–3e;
- archivos creados y modificados;
- arquitectura de funciones puras;
- reglas de validación reutilizadas;
- decisiones técnicas menores;
- tests agregados y total;
- pruebas de interfaz, una por una;
- compatibilidad con historial y partido activo;
- edición y prevención de duplicados;
- versión, caché, commit, push y despliegue;
- confirmación de BRAMU Lab Partidos intacta;
- desviaciones justificadas;
- validaciones concretas pendientes en iPhone.

No comenzar la Fase 4.

---

## 23. Criterio de cierre

La Fase 3 queda cerrada cuando el usuario puede:

1. entrar desde `+`;
2. verse fijo en Equipo A;
3. elegir tres jugadores locales sin duplicados;
4. cargar un resultado válido mediante el marcador;
5. definir formato, fecha, hora y lugar;
6. guardar;
7. comprobar los datos en el Resumen;
8. volver a Mi pádel y ver el partido;
9. editarlo sin duplicarlo;
10. salir de manera segura;
11. seguir usando ambos modos en vivo sin regresiones.

Solo entonces BRAMU Lab se publica como v1.3 y queda habilitado el inicio de la Fase 4.
