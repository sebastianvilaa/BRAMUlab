# BRAMU Lab
## Etapa 3 — Adenda de Producto y UX

**Estado:** decisiones consolidadas para conservar y distribuir por fases  
**Fecha:** 02 de septiembre de 2026  
**Documento base al que complementa:** `BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`

---

## 1. Propósito

Esta adenda conserva las decisiones de producto y UX surgidas después del consolidado general de la Etapa 3. No reemplaza los documentos anteriores: los complementa.

Las decisiones se separan expresamente entre:

- implementación inmediata o próxima;
- dirección visual que debe preparar la arquitectura actual;
- backlog futuro que no debe implementarse todavía.

Claude debe usar esta adenda como contexto general. La autorización concreta para programar continúa llegando mediante consolidados específicos de cada fase.

---

## 2. Flujo del botón central “+”

### Sin partido en curso

Al tocar el botón central `+`, se abre una hoja inferior con título:

**Registrar partido**

Orden de opciones:

1. **Cargar mi partido jugado**
2. **Registrar partido en vivo**

La primera es la acción principal y habitual.

Al tocar **Registrar partido en vivo**, la misma hoja pasa a un segundo nivel con dos opciones, en este orden:

1. **Game por game**
2. **Punto por punto**

Correspondencia interna:

- Game por game = modo actualmente denominado Por Games.
- Punto por punto = modo actualmente denominado Completo.

No mostrar ninguno preseleccionado, recomendado ni superior al otro. Cada modalidad responde a una necesidad diferente.

Las etiquetas visibles “Game por game” y “Punto por punto” son suficientes. No agregar “Más ágil”, “Más detallado” ni explicaciones redundantes en esta primera versión.

### Comportamiento de la hoja

- Entra desde abajo.
- Puede cerrarse deslizando hacia abajo.
- Puede cerrarse tocando el fondo.
- Puede cerrarse con una cruz.
- En tablet/escritorio también debe responder a Escape.
- La barra inferior no debe responder mientras la hoja está abierta.
- El segundo nivel utiliza flecha para volver sin cerrar toda la hoja.
- La transición interna debe ser más breve que la entrada de la hoja.

---

## 3. Partido en curso

### Qué se considera partido en curso

Únicamente un partido que se está registrando en vivo:

- Game por game;
- Punto por punto.

La pantalla “Cargar mi partido jugado” no se considera partido en curso. Es un formulario breve de carga posterior.

### Cierre o interrupción de la aplicación

Si la aplicación se cierra, recarga o interrumpe mientras se registra en vivo, al abrirla nuevamente debe volver directamente a la misma pantalla:

- mismos jugadores;
- mismo resultado;
- mismo game o punto;
- mismo sacador;
- mismo modo;
- mismo estado general.

No mostrar una pantalla intermedia de recuperación.

### Navegación intencional al Home

Si el usuario vuelve intencionalmente al Home, el partido no se descarta.

En la parte superior del Home, con prioridad sobre Hitos, aparece una franja compacta:

- estado **PARTIDO EN CURSO**;
- jugadores o parejas;
- resultado parcial;
- modo de registro;
- acción **Continuar**;
- toda la franja es tocable.

La franja usa el verde lima intenso de acción y un latido muy sutil. No debe competir con otras tarjetas ni sentirse como una alerta de error.

### Botón “+” cuando existe un partido en curso

Al tocar `+`:

1. Mostrar una tarjeta contextual destacada del partido activo:
   - jugadores;
   - resultado parcial;
   - modo;
   - acción **Continuar partido**.
2. Debajo, mostrar una única acción neutral:
   - **Registrar partido nuevo**.

No mostrar “Descartar” como opción permanente en la hoja principal.

### Registrar un partido nuevo

Al tocar **Registrar partido nuevo**, mostrar una confirmación clara:

**Hay un partido en curso**

“Si registrás un partido nuevo, el partido actual se cerrará y su progreso no quedará guardado en el historial.”

Acciones:

- **Volver al partido** — acción segura y principal.
- **Descartar y registrar uno nuevo** — acción destructiva.

El descarte ocurre únicamente después de la confirmación. Luego se muestran las opciones habituales:

- Cargar mi partido jugado;
- Registrar partido en vivo.

---

## 4. Salida de “Cargar mi partido jugado”

Es un flujo corto y no genera un “partido en curso”.

- Si no hay cambios, volver sale directamente.
- Si existen datos ingresados sin guardar, preguntar:
  **¿Salir sin guardar?**
- Al confirmar, los datos se descartan.
- No mostrar franja de partido activo en el Home.
- No construir todavía un sistema persistente de borradores para esta pantalla.

---

## 5. Principios de movimiento de BRAMU

Se identificaron tres movimientos que pueden transformarse en parte del sistema gráfico general:

### Rebote

Inspirado en el pique de una pelota de pádel. Una trayectoria breve desciende, impacta y sale formando una “V” o un tilde.

Uso futuro:

- partido guardado;
- jugador agregado;
- confirmaciones importantes;
- estados de éxito.

No llenar la app de pelotas literales ni utilizarlo en cada toque. Debe ser una firma poco frecuente.

### Latido

Glow o respiración muy sutil para estados realmente activos:

- partido en curso;
- último resultado destacado;
- Punto de Oro o Star Point;
- información viva.

Debe ser lento y discreto, no una animación permanente llamativa.

### Desplazamiento

Movimiento funcional para:

- hojas inferiores;
- cambios de nivel dentro de una hoja;
- transiciones entre estados relacionados.

Debe sentirse nativo, rápido y controlado, con elasticidad mínima.

### Criterios transversales

- Los tiempos exactos no son una decisión de producto cerrada: se ajustarán visualmente con valores habituales de aplicaciones móviles.
- Respetar `prefers-reduced-motion`.
- Con movimiento reducido, reemplazar desplazamientos expresivos por fades simples.
- No agregar animación si no explica estado, jerarquía o continuidad.
- Implementar variables o tokens reutilizables, no duraciones arbitrarias repetidas.

---

## 6. Regla cromática de acciones

Debe existir una sola acción lima principal por pantalla, hoja o confirmación.

Ejemplos:

- Sin partido activo: **Cargar mi partido jugado** es la acción lima.
- Con partido activo: **Continuar partido** es la acción lima.
- En una advertencia: **Volver al partido** es la acción segura principal.
- El rojo se reserva para la confirmación destructiva final.
- **Registrar partido nuevo** permanece neutral antes de la advertencia.

---

## 7. Tipografía y jerarquía

La aplicación actual utiliza Oswald y Manrope. Todavía no se autorizó reemplazarlas globalmente.

Dirección futura a comparar sobre pantallas reales:

- Archivo;
- Inter.

Criterio inicial:

- mayúsculas para volantas, estados y etiquetas pequeñas:
  - PARTIDO EN CURSO;
  - ÚLTIMO PARTIDO;
  - NIVEL BRAMU;
- mayúscula/minúscula con peso Bold para títulos y acciones:
  - Registrar partido;
  - Continuar partido;
  - Cargar mi partido jugado;
- Regular para explicaciones y textos secundarios;
- evaluar Light únicamente si mantiene legibilidad sobre fondo oscuro y en pantallas pequeñas.

La comparación tipográfica debe realizarse sobre componentes reales, especialmente:

- Tarjeta de jugador;
- Último partido;
- hoja Registrar partido.

---

## 8. Etapa visual futura

El rediseño visual global debe comenzar cuando estén funcionalmente resueltos:

1. acceso y registro;
2. carga de partido jugado;
3. Resumen y Edición;
4. Home y tarjetas;
5. Historial.

No duplicar toda la aplicación para comparar estilos. Mantener una única lógica funcional y evaluar dos apariencias sobre los mismos componentes y datos:

- diseño actual;
- propuesta visual.

La alternativa puede implementarse mediante un tema, modo de previsualización o selector temporal. No crear dos productos funcionales divergentes.

La etapa visual abarcará:

- tipografía;
- paleta;
- tarjetas;
- radios;
- sombras;
- espaciado;
- iconografía;
- rebote, latido y desplazamiento;
- rastro o pulso de evolución.

---

## 9. Backlog futuro

“Futuro” significa repositorio de ideas sin autorización ni fecha, no ideas descartadas.

Ideas mencionadas:

- base de datos;
- cuentas;
- amigos;
- ranking;
- grupos privados;
- validación de partidos;
- Isla Dinámica;
- Live Activities en pantalla bloqueada;
- aplicación nativa;
- smartwatch;
- distancia recorrida;
- calorías;
- pulsaciones;
- personalización del Home;
- widgets;
- fotos y recuerdos;
- Partido Libre.

La Isla Dinámica y la pantalla bloqueada requieren una futura aplicación iOS con ActivityKit/Live Activities. No son posibles directamente desde la PWA actual.

Cuando el núcleo funcional esté probado, ordenar el backlog mediante una Matriz de Impacto vs. Esfuerzo y registrar además:

- problema que resuelve;
- dependencias;
- alcance de usuarios;
- validación previa necesaria;
- estado: estacionada, evaluando, próxima, implementada o descartada.

---

## 10. Pruebas reales inmediatas

Durante el 02 y 03 de septiembre de 2026 se prevén nuevas pruebas reales como espectador usando Game por game.

Objetivo:

- comprobar si se puede mirar y conversar sin que registrar se convierta en trabajo;
- observar olvidos o correcciones de games;
- evaluar claridad del marcador;
- detectar información faltante;
- revisar la utilidad del Resumen y BRAMU Intelligence con datos reducidos;
- comparar con la primera prueba real punto por punto del 27 de agosto de 2026.

Estas pruebas no validan todavía Nivel BRAMU, ranking ni historia oficial del usuario. Sebastián no jugará durante aproximadamente seis meses por recuperación de hombro, por lo que los escenarios personales se simularán mientras tanto.

---

## 11. Regla documental

- Este archivo preserva decisiones complementarias.
- Cada fase ejecutable debe tener su propio consolidado.
- Claude no debe implementar todo este documento de una vez.
- Las ideas futuras no deben convertirse en código o campos muertos.
- Los informes posteriores deben ser autosuficientes para que ChatGPT pueda revisarlos directamente desde Dropbox.
