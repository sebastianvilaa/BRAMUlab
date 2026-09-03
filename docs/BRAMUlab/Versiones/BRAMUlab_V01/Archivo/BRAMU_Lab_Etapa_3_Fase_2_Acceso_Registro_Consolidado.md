# BRAMU Lab
## Etapa 3 — Fase 2: acceso central de registro y partido en curso

**Estado:** AUTORIZADO PARA IMPLEMENTAR  
**Fecha:** 02 de septiembre de 2026  
**Aplicación afectada:** BRAMU Lab, carpeta `bramulab/`  
**Aplicación protegida:** BRAMU Lab Partidos, carpeta `bramulab-partidos/`

**Contexto obligatorio:**

- `docs/bramulab/consolidados/BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`
- `docs/bramulab/consolidados/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md`
- `docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Informe.md`

---

## 1. Forma de trabajo

- Sebastián funciona como intermediario entre ChatGPT y Claude.
- Claude debe ejecutar esta fase completa y producir un informe autosuficiente.
- Resolver de manera conservadora las dudas técnicas menores y documentarlas.
- Si aparece una decisión que modifica materialmente producto, historial o compatibilidad, detener esa parte y documentar el bloqueo con alternativas.
- No avanzar a la Fase 3.
- No rediseñar todavía “Cargar mi partido jugado”.
- No modificar BRAMU Lab Partidos.

---

## 2. Estado de partida

La Fase 1 quedó terminada en el commit:

`39cb821 — BRAMU Lab — Etapa 3, Fase 1: semántica de fecha del partido`

Línea base:

- 364/364 tests en verde.
- BRAMU Lab desplegado en:
  `https://sebastianvilaa.github.io/BRAMUlab/bramulab/`
- BRAMU Lab Partidos congelado en:
  `https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/`
- almacenamiento, PWA y caché separados;
- motor Completo y Por Games existentes protegidos;
- carga manual existente protegida funcionalmente.

Claude debe verificar la línea base antes de modificar.

---

## 3. Objetivo

Convertir el botón central `+` en un acceso claro y escalable para:

1. cargar un partido ya jugado;
2. registrar un partido en vivo;
3. elegir Game por game o Punto por punto;
4. detectar y continuar un partido en vivo activo;
5. evitar descartes accidentales;
6. mostrar un partido activo en el Home;
7. establecer las primeras bases reutilizables de movimiento.

Esta fase modifica el acceso y la navegación. No rediseña las pantallas internas existentes de carga o marcador.

---

## 4. Botón “+” sin partido en curso

Al tocar `+`, abrir una hoja inferior con título:

**Registrar partido**

Opciones, en este orden:

### Cargar mi partido jugado

- Acción principal.
- Utilizar el verde lima de acción.
- Abre el flujo manual existente sin rediseñarlo.
- No cambiar sus reglas, campos ni guardado en esta fase.

### Registrar partido en vivo

- Acción secundaria neutral.
- Abre un segundo nivel dentro de la misma hoja.

### Segundo nivel

Título contextual de registro en vivo y flecha de volver.

Opciones, en este orden:

1. **Game por game**
2. **Punto por punto**

Correspondencia:

- Game por game abre el modo existente Por Games.
- Punto por punto abre el modo existente Completo.

Reglas:

- no preseleccionar;
- no mostrar “Recomendado”;
- no agregar “Más ágil”, “Más detallado” ni párrafos descriptivos;
- cada tarjeta completa es tocable;
- no alterar la lógica interna de los modos existentes.

---

## 5. Comportamiento de la hoja

- Aparece desde abajo.
- Fondo oscurecido mediante scrim reutilizable.
- Cierre por deslizamiento hacia abajo.
- Cierre tocando el fondo.
- Cierre mediante cruz.
- Escape en tablet/escritorio.
- Bloquear interacción con la barra inferior mientras está abierta.
- Mantener foco accesible dentro de la hoja cuando corresponda.
- Restaurar el foco al botón `+` al cerrar.
- El segundo nivel usa una transición lateral breve más fade.
- Volver regresa al nivel anterior sin cerrar la hoja completa.
- No usar emojis como iconos.
- Reutilizar SVG o lenguaje iconográfico existente.

---

## 6. Partido en curso

### Definición

Se considera partido en curso únicamente un registro en vivo:

- Game por game;
- Punto por punto.

“Cargar mi partido jugado” no crea un partido en curso.

### Interrupción o cierre de la app

Verificar y preservar el comportamiento persistente existente:

- si la aplicación se cierra o recarga mientras se registra;
- al abrir nuevamente debe volver directamente a la misma pantalla;
- debe conservar jugadores, score, game/punto, sacador, modo y estado.

No agregar pantalla de recuperación.

Si el comportamiento actual no cumple esto, corregirlo dentro de esta fase sin modificar el motor de puntuación.

### Navegación intencional al Home

Cuando el usuario vuelve intencionalmente al Home:

- no descartar el partido;
- mantener intacto el estado;
- mostrar la franja de partido en curso;
- permitir continuar desde la franja;
- permitir continuar desde el botón `+`.

No introducir barra inferior dentro de la pantalla del partido en vivo si hoy está protegida por el flujo de juego.

---

## 7. Franja de partido en curso en el Home

Ubicación:

- inmediatamente debajo de la cabecera;
- por encima de Hitos y del resto del contenido;
- únicamente cuando existe un partido en vivo activo.

Contenido:

- etiqueta **PARTIDO EN CURSO**;
- jugadores o parejas;
- resultado parcial;
- modo visible como Game por game o Punto por punto;
- acción **Continuar**;
- toda la franja es tocable.

Comportamiento:

- abre directamente el marcador activo;
- no reinicia ni transforma el partido;
- desaparece cuando el partido se finaliza o se descarta;
- no aparece por una carga manual sin guardar.

Visual:

- una sola acción lima;
- indicador o borde con latido sutil;
- no usar rojo;
- no convertirla en una tarjeta grande que desplace excesivamente el Home;
- crear clases reutilizables pensando en el futuro rediseño del Home.

---

## 8. Botón “+” con partido en curso

Al tocar `+`, la hoja muestra:

### Tarjeta contextual principal

- estado **PARTIDO EN CURSO**;
- jugadores;
- score parcial;
- modo;
- acción **Continuar partido**;
- toda la tarjeta tocable;
- acción lima principal.

### Acción secundaria

**Registrar partido nuevo**

Debe ser neutral y no destructiva visualmente en esta instancia.

No mostrar “Descartar partido” como opción permanente.

---

## 9. Confirmación de descarte

Al tocar **Registrar partido nuevo**, abrir una confirmación:

**Hay un partido en curso**

“Si registrás un partido nuevo, el partido actual se cerrará y su progreso no quedará guardado en el historial.”

Acciones:

1. **Volver al partido**
   - acción segura;
   - acción principal;
   - vuelve directamente al marcador activo.

2. **Descartar y registrar uno nuevo**
   - acción destructiva;
   - utilizar rojo únicamente aquí.

Reglas:

- no borrar nada antes de la confirmación;
- si se cancela, el estado permanece idéntico;
- si se confirma, eliminar únicamente el partido activo;
- no crear registro inconcluso en el Historial;
- luego mostrar las opciones habituales:
  - Cargar mi partido jugado;
  - Registrar partido en vivo.

---

## 10. Salida de “Cargar mi partido jugado”

Mantener el flujo simple:

- no tratarlo como partido en curso;
- si no existen cambios, volver sale directamente;
- si existen datos ingresados, preguntar:
  **¿Salir sin guardar?**
- confirmar descarta los datos;
- cancelar vuelve al formulario;
- no guardar borradores persistentes;
- no mostrar la franja de partido en curso.

Si este comportamiento ya existe, verificarlo y no reescribirlo innecesariamente.

---

## 11. Movimiento

Implementar únicamente las bases necesarias para esta fase:

### Desplazamiento

- entrada y salida de hojas inferiores;
- cambio lateral/fade entre primer y segundo nivel;
- sensación rápida, controlada y cercana al comportamiento nativo;
- elasticidad mínima.

### Latido

- indicador del partido en curso;
- lento y discreto;
- verde lima;
- no debe distraer del resto del Home.

### Rebote

- documentarlo y preparar tokens si corresponde;
- no crear una animación decorativa sin una confirmación significativa donde utilizarla;
- su primera aplicación completa puede esperar al guardado exitoso de la Fase 3.

### Accesibilidad

- respetar `prefers-reduced-motion`;
- con movimiento reducido, usar fades sencillos;
- evitar loops llamativos;
- centralizar duraciones y curvas en variables reutilizables.

Los valores iniciales pueden seguir rangos móviles habituales y deben ajustarse mediante inspección visual. No convertir los milisegundos en una decisión de producto rígida.

---

## 12. Jerarquía visual y tipográfica

No ejecutar todavía el rediseño visual general.

En los componentes nuevos:

- una única acción lima por contexto;
- títulos y acciones en mayúscula/minúscula con peso fuerte;
- estados o volantas pequeñas pueden usar mayúsculas;
- textos secundarios en Regular;
- no cambiar globalmente Oswald/Manrope;
- no incorporar todavía Archivo o Inter;
- no agregar colores hardcodeados: usar variables o aliases semánticos;
- estructura desacoplada de la paleta futura.

---

## 13. Actualización de versión, PWA y caché

La Fase 1 detectó que dispositivos que ya habían visitado BRAMU Lab podían seguir viendo 349 tests por conservar `bramulab-v1` en caché.

En esta fase se autoriza expresamente actualizar únicamente la versión de BRAMU Lab:

- establecer una versión coherente `v1.1` en todas las superficies pertinentes;
- actualizar `version.json`;
- actualizar el nombre de caché de `bramulab/`;
- conservar el filtro que solo elimina cachés de la familia BRAMU Lab;
- verificar que una instalación existente detecta la actualización;
- verificar el popup o mecanismo de actualización existente;
- verificar la herramienta “Forzar actualización”;
- confirmar que el nuevo deploy entrega los archivos de Fase 1 y Fase 2;
- no tocar manifest, versión, caché ni service worker de `bramulab-partidos/`.

Claude debe inspeccionar las fuentes reales de versión antes de editar y mantenerlas consistentes.

---

## 14. Protección de alcance

No implementar:

- rediseño del formulario Cargar mi partido jugado;
- selector nuevo de jugadores;
- teclado numérico;
- Resumen nuevo;
- Edición nueva;
- reorganización completa del Home;
- Tarjeta de jugador nueva;
- Último partido nuevo;
- Actividad/Efectividad;
- pestañas de Historial;
- Nivel BRAMU;
- ranking;
- perfiles;
- base de datos;
- validación social;
- Isla Dinámica;
- aplicación nativa;
- Fase 3.

No modificar:

- motor de puntuación;
- reglas de Completo;
- reglas de Por Games;
- BRAMU Intelligence existente;
- `bramulab-partidos/`;
- datos locales históricos salvo la acción explícita de descartar el partido activo confirmada por el usuario.

---

## 15. Tests obligatorios

Claude debe agregar tests puros donde la arquitectura lo permita y verificar manualmente el DOM/interacción cuando no exista arnés.

Casos mínimos:

1. Sin partido activo, el `+` muestra Cargar mi partido jugado primero.
2. Registrar partido en vivo abre el segundo nivel.
3. Game por game abre Por Games.
4. Punto por punto abre Completo.
5. No existe opción preseleccionada.
6. Cerrar por cruz, fondo, gesto y Escape no modifica estado.
7. Con partido activo, la hoja muestra la tarjeta contextual.
8. Continuar vuelve exactamente al marcador activo.
9. Navegar al Home conserva el partido.
10. La franja refleja jugadores, score y modo.
11. Cancelar descarte conserva todo.
12. Confirmar descarte elimina solo el activo y no crea Historial.
13. Después del descarte aparecen las dos opciones de registro.
14. Una carga manual no activa la franja.
15. Salir de carga manual con cambios pide confirmación.
16. Cerrar/recargar la app durante Game por game reanuda el estado exacto.
17. Cerrar/recargar durante Punto por punto reanuda el estado exacto.
18. Completo y Por Games continúan funcionando sin regresiones.
19. `prefers-reduced-motion` elimina las animaciones expresivas.
20. Una instalación con caché anterior recibe o puede forzar `v1.1`.
21. La suite completa anterior de 364 tests sigue en verde.

---

## 16. Verificación manual

Probar en:

- viewport móvil similar a iPhone;
- viewport tablet;
- navegador de escritorio;
- instalación o navegador que ya hubiera visitado BRAMU Lab;
- navegador limpio.

Verificar:

- jerarquía de la hoja;
- alcance táctil;
- foco;
- scroll;
- scrim;
- movimientos;
- legibilidad;
- franja con nombres largos;
- score de uno, dos y tres sets;
- ambos modos;
- persistencia tras recarga;
- actualización de versión;
- ausencia de cambios en BRAMU Lab Partidos.

---

## 17. Commit, push y despliegue

Si todos los tests quedan en verde:

1. crear un único commit claro para la Fase 2;
2. incluir este consolidado y el informe final;
3. hacer push a `main`;
4. esperar GitHub Pages;
5. verificar BRAMU Lab en producción;
6. comprobar versión `v1.1`;
7. comprobar que BRAMU Lab Partidos sigue intacto;
8. no avanzar a la Fase 3.

Si aparece una regresión no resuelta, no hacer push y documentar el bloqueo.

---

## 18. Informe obligatorio

Crear:

`docs/bramulab/informes/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Informe.md`

Debe incluir:

1. diagnóstico inicial;
2. archivos modificados;
3. estructura de componentes;
4. comportamiento del `+` sin partido activo;
5. comportamiento con partido activo;
6. persistencia y reanudación;
7. descarte confirmado;
8. tratamiento de carga manual;
9. movimiento y accesibilidad;
10. actualización a `v1.1`;
11. tests agregados y resultados;
12. verificaciones manuales;
13. confirmación de que BRAMU Lab Partidos no cambió;
14. hash y mensaje del commit;
15. push y despliegue;
16. URL y versión verificadas;
17. decisiones, desvíos, riesgos o deuda;
18. confirmación explícita de que no avanzó a la Fase 3.

El informe debe ser autosuficiente para que ChatGPT pueda auditar el trabajo leyendo únicamente ese archivo.
