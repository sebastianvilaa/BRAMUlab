# BRAMUlab V03.1.4 — Ajuste de composición en Evolución + ritmo vertical de Perfil

## Objetivo

Feedback directo del usuario mirando la V03.1.3 ya publicada en vivo: la tarjeta suelta de
"Mejor nivel BRAMU" no quedó bien, el espaciado entre tarjetas de MI PERFIL/MIS DATOS no es
uniforme, y el donut de Efectividad quedó demasiado grande. Ronda corta de corrección, sin
abrir funciones nuevas.

Consolidado transcripto del mensaje del usuario (no un documento formal):

> Estaba viendo puntualmente cómo quedó la tarjeta de mejor nivel Bramu, y la verdad es que no
> me gusta cómo queda. Me gustaría ese mismo dato meterlo directamente dentro de la tarjeta de
> evolución del nivel, cosa de poner nivel actual, después poner el mejor nivel y después poner
> el cambio en los últimos treinta días. Oh, no, perdón, no va a quedar bien ahí. Tendríamos que
> poner nivel actual, cambio en los últimos treinta días y después a la derecha, anclado a la
> derecha, debería quedar el mejor nivel de Bravo. Entonces te quedan los dos datos a la
> izquierda y el otro a la derecha, ahí abajo el gráfico.
>
> Eso por un lado. Y después por el otro, estoy viendo los espacios que hay entre las tarjetas
> y veo que no son los mismos. Me gustaría que sean todos los mismos espacios. Tomaría de
> referencia el Home que sabemos que está bien como para mantener esa misma diferencia entre
> espacios. Veo que la tarjeta de efectividad junto con la tarjeta del perfil de arriba tienen
> más espacio que con las de victorias, por ejemplo.
>
> Y por último, el gráfico de efectividad quedó demasiado grande y la tarjeta hace que se vaya
> muy grande. Lo achicaría un pelín. No sé cuánto, pero un poquitito.

## ALCANCE

### 1. MOVER — "Mejor nivel BRAMU" a la tarjeta de Evolución
- Eliminar la tarjeta propia de "Mejor nivel BRAMU" en el bloque de Rendimiento.
- Integrarlo dentro de la tarjeta "Evolución del Nivel BRAMU": Nivel actual y Cambio últimos 30
  días agrupados a la izquierda (sin cambios entre sí), "Mejor nivel BRAMU" anclado a la
  derecha.

### 2. UNIFICAR — espaciado vertical de MI PERFIL y MIS DATOS
- Todos los espacios entre tarjetas deben ser iguales.
- Tomar el espaciado de Home como referencia (ya validado).

### 3. ACHICAR — donut de Efectividad
- Reducir un poco el tamaño del donut/tarjeta de Efectividad (agrandado en V03.1.3), sin volver
  al tamaño original.

## NO TOCAR

Fórmulas de Efectividad/rachas/Nivel BRAMU, eje X/Y de Evolución, MIS DATOS (contenido),
Acceso y seguridad, Cerrar sesión, Home, Historial, Ranking, Notificaciones, Login, backend.

## FORMA DE TRABAJO

Implementar directamente, validar mobile/desktop, correr la suite completa una sola vez,
generar informe, commit, tag, push, deploy — mismo criterio de las rondas anteriores.
