# BRAMUlab V02.5 — Consolidado de implementación

**Fecha:** 04/09/2026  
**Base obligatoria:** BRAMUlab V02.4 publicada  
**Tipo de ronda:** integración visual + UX de carga manual y resumen  
**Objetivo:** llevar la experiencia completa de carga manual y resumen al nivel visual que ya alcanzó el Home, consolidar la nueva dupla cromática BRAMU, corregir inconsistencias detectadas en V02.4 y limpiar pasos/textos que hoy agregan fricción.

---

## 0. Instrucciones de trabajo

1. Trabajar sobre el estado actual publicado de V02.4. No reconstruir pantallas desde cero ni reabrir decisiones que ya funcionan.
2. Implementar **todo V02.5 en una sola ronda**, pero avanzar internamente por los bloques A → B → C → D para reducir regresiones.
3. Leer este consolidado completo antes de tocar código.
4. Si hace falta contexto técnico, consultar `BRAMUlab_V02.4_Informe.md` y, solo si es necesario, `BRAMUlab_V02.3_Informe.md`. No releer documentación histórica completa.
5. La tipografía **Inter ya es la tipografía oficial actual y se mantiene**. No reemplazarla ni reimportar otra familia. El trabajo tipográfico de esta ronda es únicamente de tracking, jerarquías, pesos y consistencia.
6. No introducir colores sueltos por componente. La nueva identidad cromática debe resolverse desde tokens semánticos compartidos.
7. No cambiar reglas deportivas, motor de estadísticas, BRAMU Intelligence ni modos de registro en vivo.
8. No borrar datos, no cambiar el esquema de `localStorage` salvo que la investigación de fechas detecte un bug real que requiera corrección compatible, y no usar `localStorage.clear()`.
9. Antes de modificar lógica de fechas, **investigar primero** la causa de partidos existentes con fechas aparentemente incorrectas. No asumir que el problema es solo visual.
10. Mantener tests existentes verdes y sumar tests donde se toque lógica pura.

---

# 1. Resultado esperado

Al finalizar V02.5:

- BRAMU conserva Inter como sistema tipográfico, con tracking menos excesivo en labels pequeños.
- La paleta deja de sentirse “oscuro + lima amarillento + celeste/magenta” y pasa a una identidad más coherente: navy oscuro + verde deportivo + azul eléctrico.
- Home gana profundidad con un degradé sutil y corrige pequeñas inconsistencias de Actividad, Último partido, KPIs e iconografía.
- Equipo A pasa a verde BRAMU y Equipo B a azul BRAMU; magenta sale del sistema de equipos actual.
- El selector de jugadores se vuelve mucho más claro, jerárquico y cómodo sin convertirse en pantalla completa.
- Fecha, hora y lugar quedan ordenados y visualmente consistentes.
- La pantalla de carga de sets conserva el flujo actual, pero gana parentesco visual con Home.
- Guardar un partido manual deja de obligar a pasar por Notas.
- Resumen manual queda más limpio, deportivo y compacto, conservando la lectura en filas de sets/games ganados.
- BRAMU Intelligence queda intacto y explícitamente fuera de alcance.

---

# BLOQUE A — SISTEMA VISUAL + HOME

## 2. Tipografía — mantener Inter y normalizar tracking

### 2.1 Familia

- **MANTENER Inter** como `--font-display` y `--font-body`.
- No cambiar el logo gráfico `BRAMUlab`; el logo no depende de esta decisión tipográfica.
- No incorporar SF Pro, Instrument Sans, Onest, Albert Sans ni ninguna otra familia probada.

### 2.2 Tracking

Problema detectado: algunos labels/títulos pequeños usan tracking demasiado abierto y, en otros casos, ciertos textos se sienten algo empastados por combinación de peso + tracking.

Regla de esta ronda:

- Tomar **`0.03em` como referencia general para labels pequeños en mayúsculas**, en vez de valores de `0.06em`, `0.08em`, `0.12em` o superiores cuando no exista una razón visual concreta.
- **No hacer un reemplazo global ciego** de todos los `letter-spacing`.
- Mantener tracking más amplio únicamente donde tenga función real de identidad/legibilidad (por ejemplo micro-labels extremadamente pequeños o componentes que ya se vean correctamente).
- Revisar especialmente Home, navegación inferior, headers de sheets, labels de equipos y Resumen.

Objetivo: mejorar lectura y respiración sin “abrir Inter” artificialmente.

---

## 3. Sistema cromático V02.5

### 3.1 Nueva dupla principal

Actualizar los tokens semánticos, no colores aislados.

Valores base confirmados para probar e implementar en esta ronda:

```css
--brand-lime: #95FF19;
--accent-cyan: #19BAFF;
```

Aunque el token existente se llame `--accent-cyan`, conceptualmente pasa a funcionar como **azul eléctrico BRAMU**. No es obligatorio renombrar el token si hacerlo rompe referencias; priorizar compatibilidad.

### 3.2 Variantes profundas y aliases

No dejar variantes viejas de la paleta anterior. Ajustar la familia completa:

```css
--brand-lime: #95FF19;
--brand-lime-deep: #66B30F;   /* referencia; ajustar mínimamente si hace falta contraste */

--accent-cyan: #19BAFF;

--team-a: var(--brand-lime);
--team-a-deep: var(--brand-lime-deep);

--team-b: var(--accent-cyan);
--team-b-deep: #0A87BD;       /* referencia; ajustar mínimamente si hace falta contraste */

--success: var(--brand-lime);
```

Criterio principal: si Claude necesita afinar `deep` para estados hover/pressed/contraste, puede moverlos levemente, pero deben permanecer dentro de la misma familia cromática y documentarlo.

### 3.3 Lo que NO cambia

Mantener roles semánticos propios:

- `--gold`
- `--star`
- `--danger`
- `--confirm-green`

No convertirlos en aliases de la dupla verde/azul.

### 3.4 Magenta

- El magenta deja de ser color de Equipo B en la experiencia actual.
- No usar magenta como tercer acento decorativo en V02.5.
- Si existen referencias heredadas a `--team-b` que automáticamente pasan a azul por token, validar visualmente que el cambio sea correcto.

---

## 4. Fondo del Home — más profundidad, sin look sci-fi

Problema: el Home actual funciona, pero el fondo general se siente demasiado plano.

Implementar un degradé **muy sutil**:

- parte superior: navy algo más azul / más presente;
- progresión hacia abajo: navy más profundo y oscuro;
- no llegar a azul Francia como masa de fondo;
- no usar glow fuerte ni aspecto “galaxia”.

La intención es que el usuario perciba más profundidad y atmósfera deportiva sin notar un “efecto especial”.

Puede resolverse con gradiente sobre los tokens actuales o una regla específica del Home. No es necesario redefinir toda la escala `--surface-*` salvo que una pequeña corrección sea imprescindible para coherencia.

---

## 5. Actividad — orden vertical de segmentos

La lógica de V02.4 es correcta y se mantiene.

Corregir únicamente el orden visual del apilado:

- **victorias verde lima abajo**;
- **derrotas oscuro/neutro arriba**.

Mantener:

- alturas relativas por volumen;
- cuatro períodos;
- leyenda;
- diferenciación derrota vs. período vacío;
- uso de `playedAt`.

No reabrir el cálculo temporal ni los tests ya validados.

---

## 6. Último partido — separadores del score

La tarjeta general de V02.4 se mantiene.

Problemas observados:

- el punto entre sets queda demasiado bajo;
- el punto debería ser más visible;
- el guion dentro del set también cae demasiado respecto del eje óptico de los números.

Ajuste:

- mantener `6–3 · 2–6 · 6–3`;
- mantener el guion liviano como elemento separado;
- **alinear ópticamente el guion al centro vertical de los números**, sin depender del baseline natural de la fuente;
- aumentar el tamaño del punto separador respecto de V02.4;
- **centrar ópticamente el punto entre los bloques de set**;
- conservar el punto blanco y con peso fuerte;
- evitar que el ajuste modifique Historial/Confirmar partido si esos componentes usan otro builder compartido.

Validar en 360 px y 402 px sin overflow.

---

## 7. KPIs de “Tu historial”

Tarjetas afectadas:

- Racha actual
- Partidos totales
- Mejor compañero
- Rival más enfrentado

La estructura conceptual actual es correcta:

```text
LABEL pequeño / muted
DATO principal grande / blanco
detalle secundario
```

No convertirlas en tarjetas con título blanco como Actividad/Efectividad.

Corregir:

- misma altura real;
- mismo padding vertical/horizontal;
- mismo baseline de labels;
- mismo inicio del dato principal;
- mismo espacio dato → detalle;
- chevrons alineados donde existan.

No colorear cada dato principal de un color distinto. Mantenerlos blancos; usar verde/azul solo en microacentos funcionales si ya existe una razón visual clara.

---

## 8. Icono de Historial

El icono actual de Historial es ambiguo.

**REEMPLAZAR** por un icono inequívoco de historial, preferentemente:

- reloj con flecha / history;
- o reloj simple coherente con el set iconográfico existente.

Debe leerse a tamaño de navegación inferior sin parecer pelota/hoja.

No modificar posiciones ni estructura de la bottom nav.

---

# BLOQUE B — CARGA MANUAL: FECHA, JUGADORES Y SET

## 9. Investigación obligatoria — fechas incorrectas

El usuario detectó varios partidos cargados con fechas que parecen incorrectas.

Antes de rediseñar o modificar lógica:

1. Revisar cómo se construye y guarda `playedAt` en carga manual.
2. Revisar qué ocurre al editar fecha/hora.
3. Revisar parsing/formateo local vs. UTC/timezone.
4. Revisar si el problema puede venir de:
   - fecha por defecto;
   - edición;
   - serialización;
   - timezone;
   - orden de guardado;
   - datos históricos ya contaminados.
5. No corregir datos históricos automáticamente sin evidencia.

Si existe bug reproducible:

- corregirlo de forma compatible;
- agregar test específico;
- documentar causa y alcance en Informe V02.5.

Si no existe bug reproducible y los datos antiguos parecen haber sido cargados manualmente con otra fecha, documentarlo y no inventar migraciones.

---

## 10. Fila editable de formato y fila editable de fecha/hora

En la pantalla de carga manual hoy existe una buena jerarquía para:

`Clásico · Mejor de 3 · Punto de Oro   >`

La línea:

`Hoy · 20:20                         Modificar`

queda demasiado tímida y debe tratarse como otra configuración del partido.

### Ajuste

- Dar a fecha/hora un **tratamiento visual equivalente** al bloque de formato/reglas.
- Ambos representan configuraciones editables y deben tener jerarquía equivalente.
- Mantener contenido breve.
- Puede conservar `Modificar` o usar chevron según sistema existente, pero ambos bloques deben sentirse de la misma familia.

No agregar pasos nuevos.

---

## 11. Sheet “Fecha, hora y lugar”

No necesita más funciones; necesita orden y consistencia.

### 11.1 Fecha y hora

Construir dos campos hermanos con la misma geometría:

```text
FECHA               HORA
04/09/2026          20:20
```

- mismos labels;
- mismo baseline;
- misma altura de control;
- misma tipografía;
- mismos paddings;
- iconos alineados;
- no permitir que Hora quede visualmente corrida respecto de Fecha.

### 11.2 Lugar

Debajo:

```text
LUGAR
Nombre del lugar o club (opcional)
```

Mantener `Usar mi ubicación` como acción secundaria, discreta y coherente.

### 11.3 CTA

Mantener `LISTO` como acción principal.

No convertir este sheet en pantalla completa.

---

## 12. Selector de jugador — rediseño importante

Aplica a elegir compañero y rivales.

Referencia conceptual validada: patrón de selección de destinatario tipo Mercado Pago, adaptado a BRAMU.

### 12.1 Formato general

- Mantener **bottom sheet**, no pantalla completa.
- Llevarlo aproximadamente a **70–75% de la altura útil** en móvil estándar.
- Debe sentirse amplio, navegable y con jerarquía, no un selector técnico comprimido.
- Usar una categoría/tamaño reusable de sheet si el sistema lo permite; no hardcodear una altura aislada sin criterio.

### 12.2 Buscar jugador

REEMPLAZAR la línea de input actual por un campo de búsqueda completo:

- contenedor delimitado;
- icono de búsqueda si encaja con sistema;
- placeholder `Buscar jugador...`;
- altura táctil cómoda;
- foco claro con azul BRAMU.

### 12.3 Sugeridos / recientes

Mostrar jugadores en lista vertical, no como fila de círculos apretados.

Cada persona debe tener tres niveles claros:

1. avatar/foto algo mayor;
2. **Nombre Apellido** en peso fuerte;
3. `@usuario` debajo en estilo secundario.

Ejemplo:

```text
[avatar]  Mateo González
          @matu
```

Objetivo: preparar la interfaz para el futuro en el que pueden existir varios “Matu”, “Gusti”, etc.

### 12.4 Jugadores sin cuenta

Mantener la función actual:

`Agregar “Sebasti” como jugador sin cuenta`

Debe seguir apareciendo cuando no hay coincidencias.

No romper la lógica existente de guardado de nombres libres.

### 12.5 Menú de tres puntos

No implementar todavía `⋯` con acciones ficticias.

Queda como evolución futura posible para:

- ver perfil;
- agregar a favoritos;
- dejar de sugerir;
- otras acciones sociales.

No mostrar controles que no hagan nada.

---

## 13. Pantalla de carga del set / Partido completo

### 13.1 Flujo

**NO modificar el flujo funcional.**

El flujo actual de:

- elegir jugadores;
- cargar resultado del set;
- validar;
- continuar;

funciona y se mantiene.

### 13.2 Problema visual

La pantalla se siente más oscura, plana y desconectada del Home:

- demasiadas superficies oscuras casi iguales;
- tarjetas, botones y fondo se empastan;
- el magenta se siente ajeno al sistema;
- falta profundidad y parentesco con el nuevo lenguaje BRAMU.

### 13.3 Ajuste visual

- aplicar nueva semántica: **Equipo A = verde BRAMU / Equipo B = azul BRAMU**;
- mejorar diferencia entre fondo, surface principal y surface interactiva;
- sumar aire donde ayude a jerarquía, sin alargar innecesariamente la pantalla;
- resultado del set debe seguir siendo el centro visual;
- formato/reglas y fecha/hora deben usar el tratamiento consistente definido arriba;
- mantener las pastillas `SET 1/2/3` ampliadas en V02.4;
- mantener keypad, validación y lógica deportiva.

Objetivo: que parezca la misma app que el Home, no una herramienta separada.

---

# BLOQUE C — GUARDADO, NOTAS Y RESUMEN MANUAL

## 14. Sacar Notas del camino obligatorio

Problema: después de terminar de cargar el resultado, obligar al usuario a pasar por Notas agrega un paso que no aporta al flujo principal.

### Nueva regla

Al completar el partido manual:

```text
resultado completo → Guardar/Continuar → Resumen del partido
```

No interponer una pantalla/paso obligatorio de Notas.

Mantener la posibilidad de escribir notas, pero moverla al Resumen.

---

## 15. Notas privadas en Resumen

Incorporar/ajustar la tarjeta de notas dentro del Resumen:

```text
🔒 NOTAS PRIVADAS
Agregar una nota
```

- El candado ya comunica privacidad.
- Eliminar texto redundante `SOLO VOS`.
- Eliminar mensajes técnicos como `los datos viven en este dispositivo` de esta tarjeta/pantalla.
- Mantener edición/guardado de la nota si ya existe.
- No definir todavía usos adicionales de la nota en análisis, perfil o Intelligence.

La nota debe ser opcional y posterior al guardado.

---

## 16. Limpiar textos técnicos del Resumen

Eliminar del Resumen manual:

- `PARTIDO CARGADO` del encabezado/meta superior;
- `Partido cargado manualmente: solo se conoce el resultado final...` o equivalente.

Estos textos describen el funcionamiento interno de BRAMU, no el partido del usuario.

Mantener fecha, hora, formato y sistema cuando aporten contexto deportivo.

---

## 17. Resultado y nombres — compactar composición

Problema actual: hay demasiado espacio horizontal/visual entre nombres de equipos y scores en el bloque principal.

Ajustar:

- acercar visualmente nombre y resultado;
- conservar clara separación entre equipo propio y rival;
- mantener jerarquía del ganador;
- evitar huecos que parezcan errores de layout;
- priorizar lectura deportiva compacta.

No convertir el resumen en una tabla pesada.

---

## 18. Sets ganados / Games ganados — mantener filas

Decisión confirmada: **NO usar mini-KPIs en paralelo**.

Mantener estructura tipo broadcast/deportiva en filas:

```text
2        SETS GANADOS        1
14       GAMES GANADOS      12
```

- Equipo propio a la izquierda.
- Concepto centrado.
- Rival a la derecha.
- Mantener color semántico por equipo: A verde, B azul.
- Mejorar alineación, separación y legibilidad.
- Puede recuperar la gramática visual del resumen antiguo validado, adaptada al sistema actual.

No mostrar estadísticas que no existen en carga manual (puntos, breaks, puntos de oro, etc.).

---

## 19. BRAMU Intelligence en Resumen

**FUERA DE ALCANCE DE V02.5.**

- No reescribir contenido.
- No cambiar motor.
- No inventar nuevos insights.
- No intentar “mejorarlo un poco” dentro de esta ronda.

Solo garantizar que los cambios de layout alrededor no lo rompan.

BRAMU Intelligence será una ronda específica posterior, diferenciando análisis según riqueza de datos disponible.

---

# BLOQUE D — CONSISTENCIA, REGRESIONES Y VALIDACIÓN

## 20. Bottom sheet inicial “Registrar partido”

El sheet que aparece al tocar `+` con:

- `Cargar mi partido jugado`
- `Registrar partido en vivo`

**NO se modifica en V02.5**.

La altura compacta de ~35% implementada en V02.4 se considera suficiente por ahora.

No confundir este sheet con el selector de jugadores, que sí crece a ~70–75%.

---

## 21. Fuera de alcance general

No modificar en V02.5:

- BRAMU Intelligence / motor de análisis.
- Reglas deportivas.
- Registro en vivo por games o punto a punto.
- Ranking.
- Perfil salvo efectos colaterales estrictamente necesarios de color/iconografía global.
- Notificaciones.
- Historial como pantalla, salvo icono de navegación y cambios derivados automáticamente de tokens compartidos.
- Cálculos de Nivel BRAMU.
- Cálculo de Actividad más allá del orden visual de segmentos.
- Cálculo de Efectividad.
- Cálculo de “Tu momento”.
- Esquema de datos, salvo corrección compatible de bug de fecha demostrada.
- Monetización, social/favoritos/perfiles públicos.

---

## 22. Validación automática

1. Ejecutar batería completa existente y mantener todo verde.
2. Mantener tests V02.3/V02.4 de Actividad y Nivel sin cambios salvo necesidad real.
3. Si se detecta bug de fecha:
   - agregar test reproducible de creación/edición de `playedAt`;
   - incluir timezone/local date si fue parte de la causa.
4. Si se extrae lógica pura nueva para seleccionar/ordenar sugeridos, probar sin DOM.
5. No agregar tests cosméticos sin valor; para layout usar validación visual/DOM computado.

---

## 23. Revisión visual mínima

Validar en móvil de referencia (~390–402 px) y, donde pueda existir overflow, también ~360 px.

Capturas/chequeos recomendados:

1. Home completo: degradé, Actividad invertida, Último partido, KPIs, navegación.
2. Pantalla de carga manual con Equipo A/B y bloques editables de formato + fecha/hora.
3. Selector de compañero con lista de sugeridos/recientes y estado de búsqueda sin coincidencias.
4. Sheet Fecha, hora y lugar.
5. Resumen manual con score, filas Sets/Games y Notas privadas.

Máximo sugerido: 5 capturas útiles. No hacer auditoría visual exhaustiva de toda la app si DOM/estilos computados alcanzan.

---

## 24. Criterios de aceptación

### Sistema visual

- Inter sigue siendo la única familia UI principal.
- No se introduce SF Pro ni otra webfont.
- Labels revisados dejan de usar tracking exagerado sin razón; `0.03em` funciona como referencia.
- `--brand-lime` es `#95FF19`.
- `--accent-cyan` es `#19BAFF`.
- Familia `deep`, equipos y `success` quedan alineados con esos colores.
- No existe magenta como color operativo de Equipo B.
- Equipo A se representa en verde y Equipo B en azul.
- Home tiene más profundidad, pero no look galaxia/tech.

### Home

- Actividad muestra verde abajo y derrotas arriba.
- Último partido tiene punto y guion ópticamente centrados.
- Punto entre sets es claramente visible y mayor que en V02.4.
- KPIs de Tu historial tienen geometría consistente.
- Icono de Historial se entiende como historial/reloj.

### Carga manual

- La causa de fechas incorrectas queda investigada y documentada.
- Si existe bug reproducible, queda corregido y testeado.
- Fecha/hora en pantalla principal tiene jerarquía equivalente a formato/reglas.
- Sheet Fecha/Hora/Lugar alinea correctamente fecha y hora.
- Selector de jugador ocupa ~70–75% y usa campo de búsqueda completo.
- Sugeridos/recientes aparecen en lista vertical con avatar + Nombre Apellido + @usuario.
- “Agregar X como jugador sin cuenta” sigue funcionando.
- Pantalla de set conserva el flujo y mejora profundidad/consistencia visual.

### Guardado y Resumen

- Notas ya no bloquean el guardado.
- Guardar lleva directamente al Resumen.
- Notas aparecen como opcionales dentro del Resumen con candado.
- No aparece `SOLO VOS` ni `los datos viven en este dispositivo` en esa tarjeta.
- No aparece `PARTIDO CARGADO` ni la explicación técnica sobre carga manual.
- Sets ganados y Games ganados siguen en filas izquierda/centro/derecha.
- No se inventan estadísticas no registradas.
- BRAMU Intelligence queda funcionalmente intacto.

### Regresión

- No se rompen carga manual, guardado, edición de fecha/hora, historial, navegación ni resumen.
- No se altera la lógica deportiva.
- Bottom sheet inicial Registrar partido sigue con la altura V02.4.

---

## 25. Versión, publicación e informe

1. Actualizar versión visible y técnica a `BRAMUlab V02.5`.
2. Actualizar `version.json`, `Store.VERSION` y nombre de caché del Service Worker según patrón existente.
3. Ejecutar batería completa de tests.
4. Verificar criterios de aceptación de este documento.
5. Publicar en GitHub Pages siguiendo el flujo actual.
6. Crear `BRAMUlab_V02.5_Informe.md` en esta misma carpeta.
7. El informe debe incluir:
   - matriz requisito → implementación → archivo/función → prueba;
   - tokens cromáticos finales efectivamente usados;
   - causa del problema de fechas, si se encontró;
   - cualquier desvío justificado respecto de valores de referencia;
   - total de tests;
   - validación visual realizada;
   - commit/tag/publicación final.

---

# 26. Principio de esta ronda

V02.5 no busca sumar funciones nuevas. Busca que lo que ya funciona se sienta como un único producto.

El Home marcó una dirección visual más madura; la carga manual y el Resumen deben alcanzar ese mismo nivel sin agregar pasos, complejidad ni estadísticas falsas.

**Prioridad:** coherencia, lectura, velocidad y sensación de app terminada.
