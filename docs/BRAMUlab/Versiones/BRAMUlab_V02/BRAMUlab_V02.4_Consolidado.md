# BRAMUlab V02.4 — Consolidado de implementación

**Fecha:** 04/09/2026  
**Base obligatoria:** BRAMUlab V02.3 publicada  
**Tipo de ronda:** ajuste visual corto y acotado  
**Objetivo:** corregir la lectura de Actividad y Nivel BRAMU, terminar la jerarquía visual de Último partido y normalizar dos tamaños del flujo de carga manual.

---

## 0. Instrucciones de trabajo

1. Trabajar sobre el estado actual de V02.3. No reconstruir pantallas ni reabrir decisiones cerradas.
2. Leer este consolidado completo antes de modificar código.
3. Si hace falta contexto técnico, consultar `BRAMUlab_V02.3_Informe.md`. No releer toda la documentación histórica.
4. Mantener los cambios dentro de los cuatro bloques definidos acá.
5. No introducir valores aislados sin sistema: crear o reutilizar tokens/clases compartidas para tipografía, tamaños de sheet y pastillas deportivas.
6. No hacer una auditoría visual de toda la aplicación. La validación de esta ronda debe limitarse a los puntos indicados en §10.
7. No borrar datos, no cambiar el esquema de `localStorage` y no usar `localStorage.clear()`.

---

## 1. Resultado esperado

Al finalizar V02.4:

- Actividad vuelve a usar verde lima y permite leer simultáneamente cuánto se jugó y cuántos partidos se ganaron o perdieron por período.
- La barra de Nivel BRAMU representa el avance decimal dentro del nivel entero actual.
- La tarjeta Último partido gana presencia y tiene un marcador más limpio, sin el guion tipográficamente pesado actual.
- El sheet Registrar partido deja de verse excesivamente corto y bajo.
- Las pastillas de sets en Partido completo se leen con mayor claridad.

---

# BLOQUE A — HOME: ACTIVIDAD Y NIVEL BRAMU

## 2. Actividad: significado y representación correctos

### 2.1 Qué tiene que comunicar

La tarjeta Actividad debe permitir entender dos cosas al mismo tiempo:

1. cuánto jugó la persona en cada uno de los últimos cuatro períodos semanales;
2. cuántos de esos partidos fueron victorias y cuántos derrotas.

No utilizar celeste en este gráfico. La implementación V02.3 con todas las barras celestes fue una interpretación incorrecta y debe reemplazarse.

### 2.2 Estructura temporal

- Mostrar exactamente cuatro barras.
- Orden de izquierda a derecha: período más antiguo → período actual.
- Mantener la lógica temporal ya probada en V02.3 para los cuatro tramos del rango de 30 días, salvo que exista una forma ya implementada y segura de expresarlos como cuatro semanas equivalentes sin perder partidos del rango.
- La interfaz debe dejar claro que se comparan las últimas cuatro semanas/períodos semanales.
- No ordenar por fecha de carga: usar `playedAt`, como ya quedó validado.
- Los partidos observados y los partidos futuros no cuentan como actividad propia.

### 2.3 Gráfico apilado

Cada barra es una semana/período y funciona como barra apilada:

- **Altura total de la barra:** cantidad total de partidos jugados en ese período, relativa al período con mayor actividad entre los cuatro.
- **Segmento verde lima:** cantidad de victorias.
- **Segmento oscuro/neutro:** cantidad de derrotas.

Fórmula conceptual:

```text
altura total = partidos del período / máximo de partidos de los 4 períodos
segmento verde = victorias del período / partidos del período
segmento oscuro = derrotas del período / partidos del período
```

Ejemplo: si la semana más activa tuvo 4 partidos y se ganaron 3, su barra llega al 100% de altura y se compone de 75% verde + 25% oscuro. Si otra semana tuvo 2 partidos y se ganó 1, su barra llega al 50% de altura y se compone de 50% verde + 50% oscuro.

### 2.4 Estados que no deben confundirse

- Una semana con derrotas pero sin victorias debe mostrar una barra oscura claramente visible con la altura que corresponda.
- Una semana sin partidos debe mostrar únicamente el estado base/vacío mínimo.
- La superficie oscura de una derrota no puede confundirse con una semana vacía. Usar contraste, borde o tono suficiente para diferenciarlas dentro del sistema oscuro existente.
- No usar el verde para representar volumen total: el verde representa victorias dentro del volumen.

### 2.5 Referencia visual

Agregar una leyenda pequeña y discreta dentro de la tarjeta:

- punto/segmento lima: `Ganados`;
- punto/segmento oscuro: `Derrotas`.

La leyenda no debe competir con el total “X partidos en los últimos 30 días”.

## 3. Barra de Nivel BRAMU

### 3.1 Problema actual

La longitud de la barra no responde de forma comprensible al número visible. Por ejemplo, un nivel 6.2 no debe aparecer con más de la mitad del recorrido completo.

### 3.2 Regla nueva

La barra representa solamente el progreso decimal entre el nivel entero actual y el siguiente entero.

```text
progreso = parte decimal del nivel × 100
```

Casos obligatorios:

- 6.0 → 0%;
- 6.2 → 20%;
- 6.3 → 30%;
- 6.9 → 90%;
- 7.0 → 0%, porque comienza un nuevo nivel entero.

Evitar errores de precisión flotante al calcular el porcentaje. El resultado visual debe quedar limitado entre 0% y 100%.

### 3.3 Indicador de variación

- Mantener la pastilla `↑ 0.1` / `↓ 0.1`.
- Ubicarla sobre el punto alcanzado por el progreso actual, no en una posición independiente del nivel.
- En 0%, acomodarla sin que salga de la barra ni choque con el borde izquierdo.
- En valores cercanos a 100%, acomodarla sin desbordar por la derecha.
- El color de la barra continúa siendo verde lima.

---

# BLOQUE B — TARJETA ÚLTIMO PARTIDO

## 4. Jerarquía general de la tarjeta

La tarjeta debe destacarse un poco más que las tarjetas secundarias del Home, sin convertirse en un bloque estridente.

### 4.1 Superficie y borde

- Fondo: `Surface 3` del sistema actual.
- Borde completo: 1 px verde lima.
- Eliminar la línea/acento vertical del borde izquierdo.
- No agregar un segundo acento cyan.
- El borde lima destaca que es el contenido principal; el badge `VIC`/`DER` sigue siendo el responsable de comunicar el resultado.

### 4.2 Altura

- Darle un poco más de altura que en V02.3.
- Lograrlo mediante padding coherente y la información de equipos en dos líneas; no fijar una altura rígida que pueda cortar contenido.
- Mantener el comportamiento responsive en anchos pequeños.

## 5. Marcador principal

### 5.1 Números

- Tamaño objetivo: `44px` en el ancho móvil de referencia.
- `line-height: 1`.
- `letter-spacing: 0.02em`.
- Mantener el peso fuerte de los números.
- Crear/reutilizar un token o clase de marcador grande; no dejar estos valores como estilos aislados difíciles de reutilizar.

Si en anchos realmente pequeños 44 px provoca overflow, usar un `clamp()` que preserve 44 px en 390–402 px y reduzca solo lo indispensable por debajo de ese ancho.

### 5.2 Separador entre sets

El punto que separa sets debe ser más visible:

- tamaño relativo: `0.75em`;
- color blanco;
- peso `900`.

### 5.3 Separador dentro de cada set

En V02.4 se mantiene el guion deportivo `–`; no utilizar `/` todavía.

El problema no es la convención sino el peso que hereda de la tipografía del marcador. Por eso:

- construir cada set como un pequeño grupo con número, guion y número;
- convertir el guion en un `span`/elemento separado;
- tamaño aproximado del guion: `0.65em` respecto del marcador;
- peso aproximado: `500`;
- ajustar espaciado para que no se pegue a los números;
- no permitir que herede el peso `900` de los números.

Si el guion sigue viéndose pesado con esos valores, afinar tamaño/peso dentro de esa misma dirección. No cambiar automáticamente a slash sin documentarlo.

## 6. Equipos en dos líneas

Debajo del resultado, reemplazar la línea única comprimida por dos líneas:

```text
Seba / Eduardo
vs Esteban / Matu
```

- Primera línea: equipo propio.
- Segunda línea: `vs` discreto + equipo rival.
- Mantener tipografía secundaria y buen contraste.
- Evitar que los nombres compitan con el marcador.
- No aumentar el `line-height` general a 1.5 para resolver el problema: las dos líneas deben aportar aire y lectura de manera controlada.

---

# BLOQUE C — SISTEMA DE BOTTOM SHEETS

## 7. Registrar partido: altura compacta compartida

### 7.1 Problema

El sheet `REGISTRAR PARTIDO` de V02.3 ocupa aproximadamente 26% de la altura útil y queda demasiado corto y pegado al borde inferior.

### 7.2 Ajuste

- Llevar el sheet compacto a aproximadamente 35% de la altura útil en un viewport móvil estándar.
- Referencia técnica sugerida: token/clase compartida del estilo `--sheet-height-compact` o `.bottom-sheet--compact`, con `clamp()` para evitar problemas en pantallas muy bajas o muy altas.
- Referencia aproximada: `clamp(280px, 35dvh, 340px)`. Ajustar si el sistema existente requiere otros límites, conservando la proporción visual buscada.
- No definir una altura exclusiva y arbitraria para este único sheet.
- Esta ronda debe crear una categoría reutilizable para sheets compactos equivalentes.

### 7.3 Contenido

- Mantener el título centrado.
- Mantener `Cargar mi partido jugado` y `Registrar partido en vivo` con exactamente la misma jerarquía visual.
- Mantener las flechas y el cierre.
- Distribuir el aire vertical de forma equilibrada; no acumular todo el contenido contra el borde inferior.
- No modificar el flujo de navegación de estos botones.

---

# BLOQUE D — PARTIDO COMPLETO

## 8. Pastillas de sets confirmados

En la pantalla `PARTIDO COMPLETO`, las tres pastillas `SET 1`, `SET 2`, `SET 3` se perciben pequeñas respecto del resto de la composición.

### 8.1 Ajuste

- Aumentar aproximadamente entre 15% y 20% su tamaño visual.
- Dar prioridad al crecimiento del resultado numérico.
- Referencia esperada: ancho mínimo cercano a 58–62 px y altura cercana a 46–50 px, adaptado al sistema existente.
- Aumentar de forma proporcional padding, label `SET X` y resultado.
- Mantener las tres pastillas en una sola fila y centradas en anchos móviles de 360 px o más.
- Mantener su capacidad de editar sets si hoy son interactivas.
- No modificar la pausa `Resultado válido`, el botón `CONTINUAR` ni la lógica del último set.

---

## 9. Fuera de alcance

No modificar en V02.4:

- Historial ni sus pestañas.
- Resumen del partido, BRAMU Intelligence o tarjeta de notas.
- Selector de compañero/rivales y su avance automático.
- Pantalla Confirmar partido y sheet Fecha, hora y lugar.
- Ranking, Perfil, notificaciones o navegación general.
- Registro en vivo por games o punto a punto.
- Reglas deportivas, estadísticas o motor de análisis.
- Cálculo base de Efectividad, salvo regresión causada por este trabajo.
- Contenido de “Tu momento”.
- Esquema de datos o migraciones.

---

## 10. Validación acotada

### 10.1 Tests automáticos

1. Ejecutar la batería existente completa.
2. Mantener todos los tests verdes.
3. Agregar tests específicos para la función de progreso del nivel con 6.0, 6.2, 6.3, 6.9 y 7.0.
4. Mantener los tests temporales de Actividad V02.3.
5. Si se extrae una función pura para construir segmentos apilados, probar:
   - 4 partidos, 3 victorias y 1 derrota;
   - 2 partidos, 1 victoria y 1 derrota;
   - 1 partido, 0 victorias y 1 derrota;
   - 0 partidos.

### 10.2 Revisión visual mínima

No recorrer ni capturar toda la aplicación. Revisar solamente:

1. Home con cuatro períodos que tengan distintos volúmenes y mezcla de victorias/derrotas.
2. Barra de nivel en 6.0, 6.3, 6.9 y 7.0.
3. Último partido con dos y tres sets, en anchos aproximados de 360 px y 402 px.
4. Sheet Registrar partido y pantalla Partido completo.

Máximo sugerido: cuatro capturas útiles, una por punto. Si una comprobación puede resolverse con DOM, estilos computados o tests, no generar capturas adicionales.

### 10.3 Criterios de aceptación

- No existe ninguna barra celeste dentro de Actividad.
- Una derrota semanal es visible aunque haya cero victorias.
- Una semana vacía no se confunde con una semana de derrotas.
- El nivel 6.3 llena aproximadamente 30%, no 60% ni otro valor global.
- El nivel 7.0 reinicia el recorrido.
- La tarjeta Último partido usa Surface 3, borde lima completo y no tiene línea lateral.
- El marcador llega a 44 px en el viewport móvil de referencia sin overflow.
- Los puntos blancos separan sets y el guion interior se ve más liviano que los números.
- Los equipos aparecen en dos líneas.
- Registrar partido ocupa aproximadamente 35% de la altura y conserva acciones equivalentes.
- Las tres pastillas de sets son mayores y siguen entrando en una fila.
- No hay regresiones funcionales en carga manual, guardado, resumen o navegación.

---

## 11. Versión, publicación e informe

1. Actualizar la versión visible y técnica a `BRAMUlab V02.4`.
2. Actualizar `version.json`, `Store.VERSION` y el nombre de caché del Service Worker siguiendo el patrón existente.
3. Ejecutar tests y publicar en GitHub Pages.
4. Crear commit y tag `BRAMUlab_V02.4` siguiendo la convención del repositorio.
5. Actualizar README/changelog únicamente donde corresponda por versión.
6. Crear `BRAMUlab_V02.4_Informe.md` en la misma carpeta:

   `docs/BRAMUlab/Versiones/BRAMUlab_V02/`

7. No crear una carpeta nueva para V02.4.

El informe debe incluir:

- matriz requisito → implementación → archivo/función → prueba;
- decisiones o desvíos justificados;
- resultado de tests;
- cuatro validaciones visuales acotadas;
- commit, tag y URL publicada;
- lista explícita de pantallas/sistemas no modificados.

---

## 12. Definición de terminado

V02.4 está terminada cuando los cuatro bloques de este documento están implementados, la batería completa está verde, la publicación muestra `BRAMUlab V02.4` y el informe quedó guardado dentro de la carpeta existente de Versión 02.
