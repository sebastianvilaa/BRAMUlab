# BRAMUlab V02.7 — Consolidado de implementación

**Fecha:** 05/09/2026  
**Base obligatoria:** BRAMUlab V02.6 publicada  
**Tipo de ronda:** afinación visual + dinámica de Home + unificación de fondos  
**Objetivo:** consolidar el lenguaje visual actual de BRAMU sin reabrir decisiones ya cerradas, mejorar la lectura temporal de Actividad, introducir microanimaciones suaves en los indicadores principales y extender la identidad visual del Home al resto de las pantallas.

---

## 0. Instrucciones de trabajo

1. Trabajar sobre el estado actual publicado de V02.6.
2. Leer este consolidado completo antes de tocar código.
3. Implementar toda V02.7 en una sola ronda.
4. No rediseñar el Home desde cero. El Home actual de V02.6 es la referencia visual aprobada.
5. No modificar BRAMU Intelligence.
6. No introducir backend, base de datos, perfiles sociales reales, ranking real ni cambios estructurales de arquitectura.
7. Mantener Inter y la paleta actual confirmada: verde BRAMU `#95FF19`, azul BRAMU `#199FFF`, texto principal `#F8FAFC`.
8. No cambiar reglas deportivas ni flujo funcional de carga manual salvo lo estrictamente necesario para aplicar el fondo común.
9. Mantener accesibilidad y `prefers-reduced-motion` para todas las nuevas animaciones.
10. Ejecutar tests existentes y agregar tests solo donde haya lógica temporal nueva real.

---

# 1. Fondo global — convertir el Home actual en referencia del sistema

## Decisión confirmada

**MANTENER exactamente el fondo actual del Home de V02.6.**

No volver a ajustar colores, stops ni intensidad del degradé del Home en esta ronda.

Ese tratamiento pasa a ser la referencia visual de BRAMU.

## Implementación

**FUSIONAR** el mismo lenguaje de fondo en las vistas principales que hoy se sienten más planas o negras:

- Historial
- Ranking
- Perfil
- Carga manual de partido / pantalla de set
- Confirmar partido
- Resumen del partido

Criterio:

- misma familia navy/degradada;
- misma identidad cromática;
- puede bajar levemente la intensidad en pantallas funcionales para preservar lectura;
- no crear un gradiente diferente por pantalla;
- evitar fondos planos negros si rompen continuidad visual;
- no tocar el fondo del Home aprobado.

Idealmente resolver desde una clase/token de fondo reutilizable y no duplicar reglas independientes.

---

# 2. Limpieza de títulos del Home

## 2.1 Eliminar “ÚLTIMOS 30 DÍAS”

**ELIMINAR** el label/separador `ÚLTIMOS 30 DÍAS` que aparece entre “Tu momento” y Actividad/Efectividad.

Motivo: “Tu momento”, Actividad y Efectividad funcionan mejor como un bloque continuo de lectura del estado del jugador.

No reemplazarlo por otro título de sección.

## 2.2 Eliminar “TU HISTORIAL”

**ELIMINAR** el label `TU HISTORIAL` que antecede a los KPIs:

- Racha actual
- Partidos totales
- Mejor compañero
- Rival más enfrentado

Las tarjetas ya explican el contenido por sí solas.

Ajustar márgenes para que la eliminación no deje huecos verticales artificiales.

---

# 3. Actividad — cambiar de rolling 30 días a últimas 4 semanas

Este punto sí implica lógica temporal nueva y debe quedar bien definido.

## 3.1 Nuevo modelo temporal

**REEMPLAZAR** la lectura actual “últimos 30 días” por **últimas 4 semanas**.

Cada barra representa una semana calendario:

- semana de **lunes a domingo**;
- siempre se muestran 4 semanas;
- la **semana más reciente / semana actual debe estar siempre a la derecha**;
- las semanas anteriores se ordenan cronológicamente hacia la izquierda.

Orden visual:

```text
semana -3 | semana -2 | semana -1 | semana actual
```

Cuando comienza un nuevo lunes:

- nace una nueva semana a la derecha;
- las otras tres se desplazan una posición hacia la izquierda;
- sale la semana más antigua.

No usar una ventana rolling de 28 o 30 días; usar semanas calendario lunes-domingo.

## 3.2 Datos por semana

Dentro de cada semana mantener la lógica ya validada:

- victorias en verde abajo;
- derrotas en neutro/oscuro arriba;
- altura total relativa al volumen de partidos de esa semana.

No cambiar la semántica de ganados/perdidos.

## 3.3 Copy

**REEMPLAZAR** cualquier copy que diga:

- `últimos 30 días`
- `X partidos en los últimos 30 días`

por:

- `X partidos en las últimas 4 semanas`

No agregar un nuevo título de sección arriba de Actividad.

## 3.4 Tests

Agregar tests de lógica temporal que validen al menos:

- semana comienza lunes y termina domingo;
- semana actual siempre termina en la barra derecha;
- transición domingo→lunes corre correctamente las 4 barras;
- cambio de mes no rompe agrupación;
- cambio de año no rompe agrupación;
- partidos de una misma semana caen en el mismo bucket;
- la semana más antigua sale al entrar una nueva.

Preferir función pura para construir los 4 buckets semanales.

---

# 4. Efectividad — mantener histórica total

## Decisión

**MANTENER Efectividad como métrica histórica total**, no limitarla a las últimas 4 semanas.

Esto la diferencia conceptualmente de Actividad:

- Actividad = presente reciente / últimas 4 semanas.
- Efectividad = balance acumulado del historial registrado.

Mantener el cálculo histórico actual si ya es ese comportamiento.

Mantener copy explícito del estilo:

`22 ganados de 33 jugados`

No agregar “últimas 4 semanas” en Efectividad.

---

# 5. Glow de Efectividad — hacerlo visible pero sutil

En V02.6 se agregó un glow al aro de Efectividad, pero visualmente prácticamente no se percibe.

**AJUSTAR** para que exista de forma perceptible sin convertirse en neón fuerte.

Objetivo:

- aro verde levemente “encendido”;
- más visible que V02.6;
- claramente menos intenso que el botón central `+`;
- sin contaminar el texto ni el fondo de la tarjeta.

Puede resolverse con `drop-shadow`/`filter` o sombra equivalente sobre el stroke verde.

Validar en pantalla real de móvil, no solo en DevTools.

---

# 6. Microanimaciones de entrada

Agregar movimiento suave al cargar/entrar al Home para que la app gane dinamismo deportivo sin sentirse decorativa o lenta.

## 6.1 Nivel BRAMU

La barra de Nivel debe:

- arrancar visualmente desde 0;
- crecer horizontalmente hasta el porcentaje real del nivel;
- duración breve y suave;
- el valor final debe ser idéntico al actual.

La animación no cambia cálculo ni datos.

## 6.2 Actividad

Las 4 barras semanales deben:

- crecer verticalmente desde 0 hasta su altura final;
- mantener ganados abajo / derrotas arriba;
- poder usar un pequeño stagger entre barras de izquierda a derecha si mejora la lectura;
- duración total corta.

La animación debe respetar el orden cronológico visual: semana más antigua izquierda → semana actual derecha.

## 6.3 Efectividad

El donut debe:

- comenzar vacío;
- completar el arco hasta el porcentaje real;
- terminar exactamente en el valor calculado;
- mantener el número central visible y estable.

No animar el número contando si agrega complejidad innecesaria; el foco es el arco.

## 6.4 Cuándo animar

Animar:

- al cargar la app y entrar al Home;
- al volver al Home desde otra vista, solo si no resulta molesto.

Preferencia de producto: no repetir de manera agresiva cada vez que el usuario hace un micro-navegación. Si es necesario, limitar la animación a la primera entrada de la sesión o usar una duración muy corta al reingresar.

Claude puede elegir la opción técnicamente más limpia y documentarla en el informe.

## 6.5 Reduced motion

Con `prefers-reduced-motion: reduce`:

- no animar crecimiento;
- mostrar directamente el estado final;
- no ejecutar pulsos decorativos.

---

# 7. Último partido — pulso muy sutil del borde

La tarjeta de Último partido de V02.6 tiene un glow que funciona y se mantiene.

**AGREGAR** un micro-pulso / “latido” extremadamente sutil al borde verde y/o glow.

Criterio:

- no agrandar la tarjeta;
- no cambiar el grosor del borde de forma visible;
- no hacer un blink;
- no usar escalado del componente completo;
- variar apenas intensidad/opacidad del glow o del borde;
- ritmo lento y discreto;
- debe poder pasar desapercibido si el usuario no presta atención.

Ejemplo conceptual:

- estado base 100%;
- sube muy levemente intensidad;
- vuelve a base;
- pausa;
- repite.

El efecto debe sentirse “vivo”, no urgente.

Desactivar con `prefers-reduced-motion`.

---

# 8. Tarjeta superior de Hito / Insight

Actualmente la tarjeta superior se diferencia por borde azul completo + glow, pero el texto principal sigue blanco.

**REEMPLAZAR** el color del texto principal del hito por azul BRAMU `#199FFF`.

Mantener:

- borde azul;
- glow actual;
- fondo oscuro;
- hasta dos líneas de contenido.

No agregar carrusel, navegación ni más tarjetas en esta ronda.

No colorear textos secundarios si eso reduce legibilidad; el cambio solicitado es el mensaje principal.

---

# 9. Lo que NO debe cambiar

No modificar:

- fondo actual del Home;
- verde BRAMU `#95FF19`;
- azul BRAMU `#199FFF`;
- texto principal `#F8FAFC`;
- Inter;
- layout corregido de Confirmar partido / Resumen de V02.6;
- separadores geométricos dash/dot del score de Último partido;
- selector de jugador;
- flujo de carga manual;
- fecha/hora/lugar;
- BRAMU Intelligence;
- notas privadas;
- reglas deportivas;
- ranking real;
- backend/base de datos;
- perfiles sociales;
- lógica de Nivel BRAMU salvo su animación visual;
- lógica histórica de Efectividad salvo confirmar que sea total.

---

# 10. Criterios de aceptación

## Fondo

- Home se ve exactamente como V02.6 en fondo.
- Historial, Ranking, Perfil, carga manual, Confirmar y Resumen comparten la misma familia visual de fondo.
- No aparecen vistas principales con negro plano que rompa identidad.

## Home

- No aparece `ÚLTIMOS 30 DÍAS`.
- No aparece `TU HISTORIAL`.
- “Tu momento”, Actividad y Efectividad quedan más próximos visualmente.
- KPIs no dejan hueco por haber eliminado su encabezado.

## Actividad

- Muestra 4 semanas calendario lunes-domingo.
- Semana actual siempre a la derecha.
- Semanas viejas se ordenan hacia la izquierda.
- Cada lunes entra nueva semana por derecha y sale la más antigua por izquierda.
- Copy dice `últimas 4 semanas`.
- Ganados/perdidos conservan semántica actual.

## Efectividad

- Sigue siendo histórica total.
- Copy sigue siendo explícito (`X ganados de Y jugados`).
- Glow es visible pero sutil.

## Animaciones

- Nivel crece horizontalmente al valor final.
- Actividad crece verticalmente a sus alturas finales.
- Efectividad completa el donut hasta el porcentaje final.
- Animaciones son cortas, suaves y no bloquean interacción.
- `prefers-reduced-motion` muestra estado final sin animación.

## Último partido

- Mantiene glow V02.6.
- Tiene pulso extremadamente sutil.
- No cambia layout ni grosor visual del borde.
- Dash/dot siguen perfectamente centrados.

## Hito

- Texto principal usa `#199FFF`.
- Borde/glow azul se mantiene.
- No se agregan nuevas funciones.

---

# 11. Validación automática y visual

1. Ejecutar batería completa de tests.
2. Agregar tests específicos para lógica de últimas 4 semanas.
3. Validar 402px y 360px.
4. Revisar visualmente:
   - Home completo;
   - Actividad en cambio de semana;
   - Efectividad con glow;
   - animaciones de Nivel/Actividad/Efectividad;
   - pulso de Último partido;
   - tarjeta de hito azul;
   - Historial;
   - Ranking;
   - Perfil;
   - carga manual;
   - Resumen.
5. No generar capturas redundantes; documentar solo las necesarias.

---

# 12. Versión, publicación e informe

1. Actualizar versión visible y técnica a `BRAMUlab V02.7`.
2. Actualizar `version.json`, `Store.VERSION` y caché de Service Worker según patrón actual.
3. Ejecutar tests completos.
4. Publicar en GitHub Pages.
5. Crear `BRAMUlab_V02.7_Informe.md` en esta misma carpeta.
6. El informe debe incluir:
   - requisito → implementación → archivo/función → prueba;
   - función usada para buckets semanales;
   - criterio exacto de lunes-domingo;
   - decisión sobre cuándo repetir animaciones al volver al Home;
   - tratamiento de `prefers-reduced-motion`;
   - total de tests;
   - validación visual;
   - commit/tag/publicación final.

---

# 13. Principio de esta ronda

V02.7 no busca sumar producto nuevo. Busca que BRAMU se sienta más coherente, más viva y más deportiva.

El movimiento debe reforzar la lectura de datos, no distraer. El fondo debe unificar la identidad, no competir con las tarjetas. Y Actividad debe representar exactamente lo que muestra: cuatro semanas reales, con la semana actual siempre a la derecha.
