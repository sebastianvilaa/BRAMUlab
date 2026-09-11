# BRAMUlab_V02
## Consolidado — qué se especificó

**Tipo de documento:** consolidado retrospectivo (síntesis documental, no una ronda nueva de implementación).
**Fecha de esta síntesis:** 10/09/2026.
**Cubre:** todo lo pedido para el rediseño visual integral de BRAMUlab, desde el consolidado maestro de sistema visual (V02 base) hasta el último micro-ajuste publicado (V02.9.3).
**Por qué existe este documento:** la línea V02 se extendió en 16 rondas de trabajo (una base + 15 subversiones), cada una con su propio Consolidado y/o Informe sueltos — algunas rondas cortas se documentaron solo dentro del Informe, sin Consolidado propio. Este documento junta, en un solo lugar y en orden cronológico, qué se pidió implementar en cada ronda — la fuente de "qué se implementó realmente" es [`BRAMUlab_V02_Informe.md`](BRAMUlab_V02_Informe.md). Los documentos originales de cada ronda (citados abajo por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Consolidado no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).

---

## 0. Qué es BRAMUlab_V02

El rediseño visual integral de la aplicación de jugador (`bramulab/`) sobre la base funcional ya cerrada en [`BRAMUlab_V01`](../BRAMUlab_V01/BRAMUlab_V01_Consolidado.md) (hoy en v2.2.1). El encargo original es explícito: reemplazar el sistema cromático, tipográfico y de componentes de punta a punta, **conservando** persistencia, modelos de datos, reglas de partido, validaciones y navegación funcional ya verificadas. No es una reescritura de lógica — es, ronda tras ronda, una afinación cada vez más fina del mismo sistema visual, sin volver a tocar el motor de partido ni BRAMU Intelligence salvo por su presentación.

---

## 1. Sistema visual integral (V02 base)

**Fuente:** `BRAMUlab_V02_Consolidado.md`

Documento fundacional del rediseño. Pedía reemplazar de punta a punta:

- **Tipografía:** Oswald + Manrope → **Inter** (400 a 900), `tabular-nums` en resultados/horarios/porcentajes, mayúsculas reservadas a volantas chicas.
- **Roles cromáticos** (semánticos, no intercambiables): azul noche casi negro para ambiente/superficies; **azul intenso = Equipo A**; **magenta chicle = Equipo B**; **verde lima eléctrico = identidad BRAMU/acción/progreso** (nunca color de equipo); cian = microacento técnico secundario; dorado = excepción exclusiva de Punto de Oro; coral = error/derrota. Incluía una paleta CSS inicial punto de partida (`--bg-deep`, `--surface-1/2/3`, `--brand-lime`, `--team-a/b`, etc.).
- **Sistema base:** fondo azul noche unificado (Home/Historial/Perfil, antes negro-verdoso), tarjetas con radios 16px (hero 18px), glow lima solo en CTA/logro (nunca permanente en todas las tarjetas), iconografía SVG lineal reemplazando emojis, botones con jerarquía primario/secundario/terciario, motion 160-240ms.
- **Aplicación pantalla por pantalla:** header y barra inferior (5 ítems, `+` central en lima), sheet "Registrar partido" (rediseño completo), Home (tarjeta hero "Último partido" con jerarquía inspirada en VIBERO sin copiarlo, "Tu momento" con icono propio, Actividad/Efectividad como métricas destacadas), Historial (pestañas + chips de modo), Carga manual de partido jugado (pantalla centrada en el resultado, no formulario administrativo; teclado con validación preventiva; guardado en dos etapas con enriquecimiento posterior no bloqueante), Resumen (sección "BRAMU Intelligence" con superficie propia), Ranking/Perfil (mismo sistema, sin inventar contenido), Partido en vivo (fusionar paleta, sin rediseño estructural — explícitamente diferido).
- **Explícitamente fuera de alcance:** rediseño estructural del marcador en vivo, backend/autenticación real, usuarios/amigos/grupos, ranking competitivo real, Dynamic Island, rebranding del logo.
- **Criterios de aceptación** (13 puntos) y **verificación obligatoria** (funcional + 10 capturas comparables en 402×874) antes de publicar, más la instrucción de versionar el producto como texto visible **"BRAMUlab V02"** (con espacio, distinto de la convención de archivos `BRAMUlab_V02`).

### 1.1 Ajuste visual de cierre 01

**Fuente:** sin Consolidado propio — pedido dado directamente y documentado dentro de `BRAMUlab_V02_Informe.md` (sección "Ajuste visual de cierre 01").

Pasada acotada de terminación sobre la V02 recién publicada: corregir el tag técnico de git (ver §"naming" en el Informe), fusionar de verdad la jerarquía de pesos de Inter (~20 clases con `font-family` pero sin `font-weight` explícito), recomponer la tarjeta "Último partido" (agrupar volanta+título+badge, mover el chevron a la fila de parejas) y reemplazar el ícono de "Tu momento" por una pelota de pádel lineal propia.

---

## 2. BRAMUlab V02.1 — corrección funcional, UX y terminación visual

**Fuente:** `BRAMUlab_V02.1_Consolidado.md`

Ronda grande organizada en 9 bloques (A a I), NO un rediseño nuevo — corrección sobre la V02 publicada:

- **Bloque A (prioritario):** corregir Actividad/Efectividad de 30 días (un caso real de iPhone con 11 partidos del mismo día donde Actividad solo contaba 3), corregir semántica de fecha "Ahora" (sospecha de corrimiento UTC), corregir tie-break por games que no admitía resultados como 10–8, corregir un mensaje de validación contradictorio en el set decisivo, quitar el logo del Home como elemento clickeable, excluir jugadores placeholder (`Jugador 1`–`4`, `Vos`) del selector.
- **Bloque B:** reemplazar el botón `CONTINUAR` redundante entre sets por avance automático; recomponer el sheet "Formato y puntuación" (altura, aire, áreas táctiles de 48px); unificar el sistema de botones (primario lima / secundario azul noche / terciario texto).
- **Bloque C:** reemplazar el recorrido de tres pantallas que se pisaban (`Partido guardado`/`Resumen`/`Análisis`) por un único flujo `Confirmar partido → Guardar → Resumen del partido`; ajustar jerarquía de BRAMU Intelligence; corregir sus reglas narrativas (ejemplo dado: `6–1 · 1–6 · 6–0` no debía narrarse como "parejo").
- **Bloque D:** recomponer los destacados/Hitos superiores del Home (de chips angostos a carrusel de tarjetas), la tarjeta de perfil (avatar genérico, `@usuario` provisional, Nivel BRAMU más protagonista), "Último partido" (badges `VIC`/`DER`, separadores atenuados), agregar navegación desde métricas (Racha actual y Efectividad abren Historial filtrado; Mejor compañero y Rival más enfrentado abren vistas nuevas **Compañeros**/**Rivales**), mover el pie de autoría al Home.
- **Bloque E:** simplificar Historial a tres pestañas reales (`Todos`/`Mis partidos`/`Observados`, con contador), agregar badges `VIC`/`DER`/`GANÓ`, soportar filtros contextuales abiertos desde el Home.
- **Bloque F:** corregir el overlay verde-musgo heredado de Notificaciones y auditar todos los sheets/modales por el mismo bug.
- **Bloques G-I:** conservar Inter (solo ajustar jerarquía de pesos), preservar datos existentes sin migraciones destructivas, batería de tests y pruebas manuales exhaustivas.

---

## 3. BRAMUlab V02.2 — corrección UX y terminación visual

**Fuente:** `BRAMUlab_V02.2_Consolidado.md`

12 bloques (A-L) sobre decisiones de V02.1 que "quedaron aplicadas de forma parcial, literal o inconsistente" — explícitamente sin sumar funciones de negocio nuevas:

- Mantener la barra inferior en TODAS las vistas secundarias (Resumen, Compañeros, Rivales, Ranking, Perfil, configuración inicial de ambos modos en vivo), ocultándola solo durante tareas inmersivas reales.
- El botón `+` como único punto de acceso — quitar "Cargar partido jugado" de las configuraciones en vivo.
- Recomponer el sheet "Registrar partido" con sus dos opciones en **igual jerarquía visual** (nunca una en lima sobre la otra).
- Reemplazar los 4 pills chicos de jugadores en carga manual por tarjetas `EQUIPO A`/`EQUIPO B` compactas con acento celeste/magenta.
- Rediseñar el selector de compañero/rival: sin duplicar personas entre `RECIENTES` y `TODOS`, con avance automático Compañero→Rival 1→Rival 2→primer resultado, y prevención de duplicados con aviso.
- Automatizar la carga de sets de punta a punta (foco automático entre campos A/B, avance automático entre sets, apertura sola de CONFIRMAR PARTIDO al definir el partido).
- Fusionar el marcador en un único componente canónico (en dash, punto secundario) reutilizado en Último partido/Confirmar/Resumen/Historial.
- Fusionar resultado y estadísticas en una sola tarjeta en el Resumen (antes separadas); BRAMU Intelligence y Notas con sus labels dentro de la propia tarjeta.
- Historial con pestañas reales (superficie propia, no subrayado).
- Quitar `BETA` del naming de los modos en vivo y renombrarlos a "REGISTRO POR GAMES"/"REGISTRO PUNTO A PUNTO".
- Auditoría transversal de superficies/bordes/radios/alturas, con criterio explícito de reutilizar un set corto de componentes en vez de resolver cada pantalla con una combinación nueva.

---

## 4. BRAMUlab V02.3 — ajuste acotado de carga manual y métricas del Home

**Fuente:** `BRAMUlab_V02.3_Consolidado.md`

Ronda deliberadamente chica, cuatro áreas únicamente:

1. **Color contextual del selector:** Compañero/Equipo A en celeste, Rival 1/2/Equipo B en magenta — aplicado a foco de búsqueda, halo de selección y acción de alta sin cuenta, sin pintar nombres completos.
2. **Cierre del último set:** el avance automático entre sets debía seguir funcionando, pero el valor que define el partido NO debía sacar inmediatamente al usuario — debía pausar en "Resultado válido" con un único botón CONTINUAR, y recomponer Confirmar partido reutilizando la lógica visual deportiva del Resumen (Ganadores + filas por equipo). El sheet Fecha/Hora/Lugar debía quedar con Fecha y Hora perfectamente simétricas, formato 24 horas siempre.
3. **Notas en el Resumen:** reemplazar el enlace "Agregar nota privada" por una tarjeta permanente `NOTAS DEL PARTIDO · SOLO VOS`, tocable completa.
4. **Actividad/Efectividad:** corregir la lectura visual de Actividad (una derrota no debía verse indistinguible de un período vacío) y verificar/blindar el cálculo de ambas métricas con casos mínimos exactos (2/10/18/26/31 días; 2 victorias+1 derrota=67%; jugador en Equipo B; observados excluidos).

Explícitamente fuera de alcance: Historial, tarjeta Último partido (se ajustaría "después mediante Inspector"), botones del Resumen, BRAMU Intelligence, Ranking/Perfil, modos en vivo.

---

## 5. BRAMUlab V02.4 — ajuste visual corto

**Fuente:** `BRAMUlab_V02.4_Consolidado.md`

Cuatro bloques (A-D), acotados y sin auditoría general:

- **Actividad:** volver a verde lima (la implementación celeste de V02.3 se declara explícitamente "una interpretación incorrecta"), representar simultáneamente volumen y resultado con una barra apilada — segmento verde=victorias, segmento oscuro=derrotas, altura total relativa al período de mayor actividad. Agregar leyenda pequeña.
- **Nivel BRAMU:** la barra debía representar únicamente el progreso decimal dentro del nivel entero actual (6.2→20%, no una posición global), con casos exactos obligatorios (6.0→0%, 6.9→90%, 7.0→0% de nuevo).
- **Tarjeta Último partido:** más presencia (Surface 3 + borde lima completo, sin acento lateral), marcador a 44px con `line-height:1`, separador entre sets más visible (0.75em, blanco, peso 900), guion interior liviano (span separado, 0.65em/peso 500, sin heredar el peso 900 de los números), equipos en dos líneas.
- **Sheets:** llevar "Registrar partido" a ~35% de altura (categoría reutilizable `.bottom-sheet--compact`); agrandar 15-20% las pastillas SET 1/2/3 de Partido completo.

---

## 6. BRAMUlab V02.5 — integración visual + UX de carga manual y resumen

**Fuente:** `BRAMUlab_V02.5_Consolidado.md`

Ronda grande en 4 bloques (A-D), con instrucción explícita de investigar antes de tocar código:

- **Bloque A:** mantener Inter pero normalizar tracking (0.03em de referencia para labels chicos, sin reemplazo ciego); **nueva dupla cromática** `--brand-lime:#95FF19` / `--accent-cyan:#19BAFF` con `--team-a`/`--team-b` como alias directos — **el magenta sale del sistema de equipos** (Equipo A verde, Equipo B azul, decisión que reemplaza la de V02 base); degradé sutil exclusivo del Home; invertir el orden de Actividad (victorias abajo, derrotas arriba); centrar ópticamente punto/guion del marcador; unificar geometría de los 4 KPIs de "Tu historial"; reemplazar el ícono ambiguo de Historial.
- **Bloque B:** investigar primero la causa de fechas incorrectas reportadas por el usuario (sin asumir que era solo visual, sin migrar datos históricos sin evidencia); dar a la fila fecha/hora la misma jerarquía visual que formato/reglas; ordenar el sheet Fecha/Hora/Lugar; **rediseño importante del selector de jugador** (bottom sheet a 70-75% de altura, campo de búsqueda completo, filas verticales con avatar+Nombre+`@usuario`, referencia Mercado Pago sin copiar su identidad); dar más profundidad/parentesco visual con el Home a la pantalla de carga de sets, sin tocar su flujo funcional.
- **Bloque C:** sacar Notas del camino obligatorio de guardado (guardar debía ir directo al Resumen); rediseñar la tarjeta de notas como `🔒 NOTAS PRIVADAS` sin "SOLO VOS" ni texto técnico; compactar la composición nombre↔resultado del Resumen; mantener Sets/Games ganados en filas tipo broadcast (decisión confirmada: NO mini-KPIs).
- **Bloque D:** BRAMU Intelligence explícitamente fuera de alcance; sheet inicial "Registrar partido" sin cambios (altura V02.4 se consideraba suficiente).

---

## 7. BRAMUlab V02.6 — corrección visual + regresiones de layout

**Fuente:** `BRAMUlab_V02.6_Consolidado.md`

Ronda de afinación con **prioridad crítica explícita** en una regresión: Confirmar partido y Resumen habían perdido alineación de columnas de set entre las dos filas de equipo tras V02.5 — el consolidado pedía resolverlo con grid estable, no con márgenes manuales.

Además: refinar el azul BRAMU (`#19BAFF`→`#199FFF`, arrastrando toda la familia), ajustar `--text` a `#F8FAFC` (nunca blanco puro), oscurecer la zona superior del degradé del Home, sumar glow MUY sutil localizado (Actividad, Efectividad, Último partido — sin volverse neón), dar a la tarjeta de insight superior un borde completo azul + glow, compactar el aire muerto bajo la barra de Nivel, subir el contraste de "Tu momento", cambiar el copy de Efectividad a "22 ganados de 32 jugados", convertir el botón "Agregar jugador sin cuenta" en acción secundaria/outlined, dar más aire al sheet Fecha/Hora/Lugar sin agrandar tipografía, y — el punto técnico más exigente — **dejar de depender del glifo tipográfico** para el guion/punto del marcador de Último partido, reemplazándolos por elementos geométricos (`inline-flex`, barras/puntos con `background:currentColor`) que comparten el eje óptico de los números en vez del baseline de la fuente.

---

## 8. BRAMUlab V02.7 — afinación visual + dinámica de Home + unificación de fondos

**Fuente:** `BRAMUlab_V02.7_Consolidado.md`

Cuatro frentes:

1. **Fondo global:** el degradé del Home de V02.6 pasa a ser LA referencia visual del sistema — fusionarlo (una versión un escalón menos intensa) en Historial, Ranking, Perfil, Carga manual, Confirmar partido y Resumen, sin tocar el degradé propio del Home.
2. **Limpieza de títulos:** eliminar los labels "ÚLTIMOS 30 DÍAS" y "TU HISTORIAL" del Home (sin reemplazarlos).
3. **Actividad — cambio de modelo temporal:** reemplazar la ventana rolling de 30 días por **4 semanas calendario (lunes a domingo)**, con la semana actual siempre a la derecha y las anteriores corriéndose a la izquierda cada lunes. Requería tests de lógica temporal nueva (cruce de mes, cruce de año, transición domingo→lunes).
4. **Efectividad — decisión de mantenerla histórica total** (a diferencia de Actividad): "Actividad = presente reciente; Efectividad = balance acumulado del historial registrado". El consolidado pedía "mantener el cálculo histórico actual **si ya es ese comportamiento**" — instrucción condicional que resultó no cumplirse en el código real (ver Informe, hallazgo real).
5. **Microanimaciones de entrada** al Home (Nivel/Actividad/Efectividad, cada una creciendo desde 0) con `prefers-reduced-motion` respetado, dejando a criterio de implementación si se repiten en cada reingreso o solo la primera vez de la sesión.
6. Glow de Efectividad más visible (el de V02.6 "prácticamente no se percibe"); pulso muy sutil en el borde de Último partido; texto principal del hito superior en azul BRAMU.

---

## 9. BRAMUlab V02.8 — cierre de la etapa de afinación visual

**Fuente:** `BRAMUlab_V02.8_Consolidado.md`, fundamentado en `BRAMUlab_V02.8_Auditoria_Visual_CSS.md` (auditoría de solo lectura previa, sin implementación).

**La auditoría** (2122 líneas de `styles.css` revisadas) concluyó que el sistema visual estaba "más ordenado de lo que su tamaño hace sospechar" — paleta cerrada, tokens usados consistentemente, casi sin `!important` — pero encontró **9 inconsistencias concretas verificables** y **3 piezas de CSS muerto**, priorizadas: overlay de Highlight con el negro-verdoso pre-V02 (bug de la misma familia que V02.1 ya había corregido en el resto de overlays, pero que quedó afuera de aquel barrido); un bloque `.status-banner`/`.band-seg` duplicado letra por letra (residuo de un rediseño V5 nunca reemplazado por el V7 posterior); el ritmo vertical de Resumen (26px parejo entre 8 bloques muy distintos, sin jerarquía) como causa más probable de "se siente con demasiado aire"; Setup como única pantalla funcional que había quedado fuera de la unificación de fondo de V02.7; el tracking de `.overlay__title` (0.1em) desalineado del resto del sistema (0.03em domina en 12 componentes); un radio huérfano de 11px; ~85 líneas de CSS muerto de la vieja pantalla "Resumen inmediato"; y dos hallazgos de "bajo riesgo pero baja urgencia" (literales 16px/18px que coinciden por casualidad con `--radius-card`/`--radius-hero` sin usar el token, y un "blanco de overlay" `rgba(244,247,242,X)` nunca migrado a variable). La auditoría **recomendó explícitamente NO modularizar** `styles.css` todavía (sin síntomas reales que lo justifiquen), reevaluar a las 2500-3000 líneas.

**El Consolidado de V02.8** ejecuta las recomendaciones priorizadas de la auditoría, más:

- Microanimaciones del Home deben correr **cada vez** que se entra o se vuelve (instrucción que reemplaza/corrige la decisión de "una vez por sesión" que V02.7 había tomado por su cuenta).
- Reemplazar el glow de Efectividad (el `drop-shadow` de V02.7 "genera una percepción rectangular/cuadrada, en iPhone casi no se ve") por un segundo arco duplicado detrás del trazo principal.
- Subir un escalón la intensidad del pulso de Último partido (el de V02.7 era "demasiado sutil").
- Reemplazar la tarjeta de hito por una variante CSS exacta y cerrada (fondo, borde, glow, tipografía, texto blanco — no azul).
- Bajar `.overlay__title` a 0.03em para toda la familia de ~18 modales, no solo Notificaciones.
- "Agregar jugador sin cuenta": mantener fondo/borde contextual pero pasar el texto a blanco (`var(--text)`).
- Normalización SEGURA de radios (solo casos verificables 1:1, sin homogeneizar las 7 familias entre sí).
- No tocar bordes de Historial (queda para "el próximo bloque de producto: Historial").
- Limpieza seguro de CSS muerto/duplicado; mantener un solo `styles.css`, sin modularizar.

---

## 10. BRAMUlab V02.8.1 — calibración visual (7 puntos)

**Fuente:** sin Consolidado propio — instrucciones detalladas dadas directamente en el chat, documentadas dentro de `BRAMUlab_V02.8.1_Informe.md`.

Corrección corta sobre puntos detectados en la prueba real de V02.8, ya publicado: (1) Actividad — mantener la técnica, más lenta/perceptible (~700-800ms, stagger ~90-110ms); (2) Nivel BRAMU — crecimiento horizontal CLARAMENTE perceptible vía `transform:scaleX()`, no solo `width` en dos pasos; (3) Efectividad — arco dibujándose desde 0 de forma robusta, sin depender solo de "0 + reflow + valor final"; (4) mantener re-disparo en cada entrada/vuelta con `prefers-reduced-motion` respetado; (5) glow de Efectividad — eliminar CUALQUIER filtro (blur/drop-shadow), halo con círculos/strokes concéntricos, interno ~5px/.20-.25 y externo ~8px/.08-.12; (6) hito — mantener estilo aprobado pero ajustar ancho para favorecer wrap natural a 2 líneas sin salto manual; (7) botones de Resumen — mismo ancho/alto/radio entre "Editar partido" y "Volver al inicio"; y ajuste de jerarquía del CTA "Agregar jugador sin cuenta" (buscador protagonista, CTA secundario con borde neutro).

---

## 11. BRAMUlab V02.8.2 — calibración visual (5 puntos)

**Fuente:** sin Consolidado propio — instrucciones directas en el chat, documentadas en `BRAMUlab_V02.8.2_Informe.md`.

Cinco correcciones puntuales sobre lo publicado en V02.8.1: (1) Actividad dejó de animar (regresión real, a recuperar); (2) Efectividad — la animación ya funciona, pero el estado FINAL se ve tosco/pesado con brillo casi imperceptible, refinar sin volver al cuadrado/glow incorrecto; (3) Último partido — mantener sin cambios; (4) hito — reducir ~15% el ancho visual; (5) normalizar el tracking del botón "ACTUALIZAR" del aviso de actualización, alineado con el resto de overlays ya corregidos en V02.8 — y confirmación explícita de que botones de Resumen y CTA "jugador sin cuenta" quedan sin tocar.

---

## 12. BRAMUlab V02.8.3 — corrección puntual de Efectividad

**Fuente:** sin Consolidado propio — feedback directo en el chat ("todo bien salvo el grosor del verde de Efectividad, sigue estando muy grande"), documentado en `BRAMUlab_V02.8.3_Informe.md`.

Pedido de un único ajuste: reducir el grosor percibido del aro de Efectividad. Nada más del sistema debía tocarse.

---

## 13. BRAMUlab V02.9 — refinamiento visual/UX de cinco componentes

**Fuente:** `BRAMUlab_V02.9_Consolidado.md`

Ronda corta y concreta sobre cinco puntos ya revisados en uso real:

1. **Efectividad:** el último ajuste dejó el halo "demasiado difuso" — volver a una solución limpia y nítida, eliminando cualquier halo que genere sensación de desenfoque (a lo sumo un segundo stroke fino, nunca dos).
2. **Agregar jugador sin cuenta:** reemplazar el CTA grande por una fila contextual integrada al listado de búsqueda (`[ícono persona+] Agregar a "X" [chevron opcional]`), sin borde protagonista de color, sin la coletilla "como jugador sin cuenta".
3. **Último partido:** NO rediseñar — mantener la esencia ya aprobada, pero AGREGAR en la zona inferior derecha, alineada con los participantes, el formato/sistema reales en dos líneas (ej. `CLÁSICO`/`PUNTO DE ORO`).
4. **Historial:** convertir sus tarjetas en una **versión compacta de Último partido** (mismo lenguaje, mismo orden de lectura, menor altura/densidad): zona superior fecha/hora + `VICTORIA`/`DERROTA` completo (explícitamente "evitar abreviaturas si el espacio permite la palabra completa"), zona principal resultado protagonista, zona inferior izquierda pareja propia/vs/rivales, zona inferior derecha formato/sistema; eliminar "PARTIDO CARGADO" y la X de borrado directo.
5. **Resumen:** mover la eliminación del partido a una acción deliberada y secundaria al final, con confirmación (`¿Eliminar este partido? / Se actualizarán tu historial y tus estadísticas.`).

Fuera de alcance: cuentas reales, login, backend, ranking BRAMU, validación entre jugadores, propiedad compartida de partidos, Player Card, rediseño completo de Resumen/Ranking/Perfil.

---

## 14. BRAMUlab V02.9.1 — micro-ajuste visual (3 puntos)

**Fuente:** sin Consolidado propio — instrucciones directas en el chat, documentadas en `BRAMUlab_V02.9.1_Informe.md`.

Tres detalles finos detectados en la revisión de V02.9: (1) Efectividad — el aro quedó demasiado fino, engrosar apenas el trazo principal sin volverlo pesado ni difuso; (2) Último partido — reordenar el encabezado en 2 líneas (línea 1: título+fecha/hora; línea 2: forma+badge de resultado); (3) Historial — bajar la jerarquía de la línea de jugadores (menos peso/contraste que el resultado), la pareja propia puede seguir destacada pero más sutil, los rivales más suaves.

---

## 15. BRAMUlab V02.9.2 — ajuste de un valor

**Fuente:** sin Consolidado propio — Sebastián probó el valor en vivo con el inspector de Chrome sobre la app publicada y confirmó que un trazo más grueso se veía mejor, documentado en `BRAMUlab_V02.9.2_Informe.md`.

Un único pedido: subir el trazo principal del donut de Efectividad un paso más.

---

## 16. BRAMUlab V02.9.3 — dos ajustes finales

**Fuente:** sin Consolidado propio — feedback directo tras probar valores en vivo con el inspector de Chrome, documentado en `BRAMUlab_V02.9.3_Informe.md`.

Dos pedidos puntuales: (1) Historial — cerrar de una vez la jerarquía (resultado claramente protagonista, nombres de jugadores neutros, sin ningún color de énfasis en ninguno de los dos equipos); (2) Último partido — compactar aún más el encabezado de dos líneas introducido en V02.9.1.

---

## Estado al cierre de este consolidado

**BRAMUlab_V02 está hoy en V02.9.3** (tag `BRAMUlab_V02.9.3`), con el sistema visual integral cerrado en 16 rondas sucesivas de afinación desde la base de V02. El detalle de qué se implementó realmente, con verificaciones, bugs encontrados/corregidos, contradicciones entre rondas y sus resoluciones, está en [`BRAMUlab_V02_Informe.md`](BRAMUlab_V02_Informe.md).

**Qué queda explícitamente pendiente / fuera de alcance de toda la línea BRAMUlab_V02**, repetido de forma consistente en los consolidados:

- Rediseño **funcional** de Historial (distinto de su lenguaje visual, ya alineado con Último partido desde V02.9) — anunciado explícitamente como "el próximo bloque de producto" al cierre de V02.8.
- Rediseño estructural definitivo del marcador en vivo — diferido desde el consolidado original de V02 base.
- Base de datos/backend real, cuentas de usuario reales, ranking competitivo real, validación de partidos entre rivales, perfiles sociales/amigos, Player Card.
- Modularización de `styles.css` (decisión explícita de V02.8: revisar recién a las 2500-3000 líneas o si se suma una feature grande).
- BRAMU Intelligence sin cambios de motor/contenido en ninguna ronda de esta línea — solo su presentación.
- Ver [`BRAMUlab_Backlog.md`](../../BRAMUlab_Backlog.md) para el resto del backlog de producto no tocado por esta línea.

Los documentos originales de cada ronda (citados arriba por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Consolidado no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).
