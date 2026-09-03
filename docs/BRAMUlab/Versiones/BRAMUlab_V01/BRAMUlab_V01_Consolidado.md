# BRAMUlab_V01
## Consolidado — qué se especificó

**Tipo de documento:** consolidado retrospectivo (síntesis documental, no una ronda nueva de implementación).
**Fecha de esta síntesis:** 03/09/2026.
**Cubre:** todo lo pedido para la app integral de jugador, desde el documento de contexto original hasta el hotfix v2.2.1 (estado actual).
**Por qué existe este documento:** hasta ahora, cada ronda de trabajo (Etapa/Fase/hotfix) tuvo su propio consolidado suelto. Este documento junta, en un solo lugar y en orden, qué se pidió implementar en cada ronda — la fuente de "qué se implementó realmente" es [`BRAMUlab_V01_Informe.md`](BRAMUlab_V01_Informe.md). Los documentos originales de cada ronda no se borraron: están preservados en [`Archivo/`](Archivo/) y se referencian abajo.

---

## 0. Qué es BRAMUlab_V01

Todo el desarrollo de la experiencia integral de jugador —Home, Historial, Perfil, carga manual de partidos, navegación, evolución del Nivel BRAMU, partido en curso y su integración con el marcador— hecho hasta hoy en la carpeta de código `bramulab/`. Es la aplicación en desarrollo activo, distinta del producto anterior congelado `BRAMUlab_Partidos_V##` (carpeta de código `bramulab-partidos/`, marcador completo, sin más cambios funcionales).

Nota de linaje de nombres: este trabajo se llamó, en distintos momentos, "Rama Jugador", "BRAMU Lab" y (brevemente, en un informe interno nunca comiteado) `bramu-player`. Todo eso es hoy `BRAMUlab_V01`. La carpeta de código sigue llamándose `bramulab/` (no se tocó código en esta reorganización documental).

---

## 1. Origen y encargo inicial

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Etapa_1_Contexto.md`](Archivo/BRAMU_Rama_Jugador_Etapa_1_Contexto.md)

Pedido original: expandir BRAMU Lab de "registrar un partido" a "construir y mostrar el historial de pádel de un jugador" — un nuevo Home centrado en el jugador (résumé, forma reciente, rachas, compañeros/rivales habituales, BRAMU Intelligence leyendo el historial en vez de un solo partido), como capa agregada sobre la app existente, no una reescritura. Concepto: "BRAMU — Donde vive tu pádel" / "Cada partido suma a tu historia."

---

## 2. El consolidado maestro (origen de casi todo lo que vino después)

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`](Archivo/BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md)

Documento de ~530 líneas, explícitamente de análisis y planificación primero ("no implementar... hasta recibir aprobación"), con dos bloques:

**Bloque "implementar ahora" (se ejecutó, en distintas rondas posteriores):**
1. Separar la app del marcador público de la nueva rama jugador en rutas/PWAs independientes.
2. Corregir la semántica de fecha (`playedAt` real vs. `createdAt`/hora técnica de guardado).
3. Rediseñar el acceso vía botón `+` (hoja de opciones).
4. Rediseño completo de "Cargar partido jugado" (teclado numérico, selector de jugador, validación, guardado en dos etapas).
5. Reorganización completa del Home (Hitos, Tarjeta de jugador, Último partido, Tu Momento, Actividad/Efectividad, métricas).
6. Orden de Historial + preparación de futuras pestañas.

**Bloque "documentar para el futuro — no implementar todavía" (sigue sin implementarse, ver [`BRAMUlab_Backlog.md`](../../BRAMUlab_Backlog.md)):** máquina de estados de validación de partido (Pendiente/Validado/Disputado/Observado).

Este documento es el origen de trabajo que terminó repartido en varias rondas posteriores (§3 a §8 de este consolidado) — no todo se implementó de una vez, y el ítem 4 en particular se pidió recién y se construyó de verdad casi una versión entera después, con un alcance bastante más grande que el original.

---

## 3. Separación de apps (Fase 0)

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Etapa_3_Plan_y_Reorganizacion.md`](Archivo/BRAMU_Rama_Jugador_Etapa_3_Plan_y_Reorganizacion.md) (Plan 1) y su ejecución en [`Archivo/BRAMU_Rama_Jugador_Etapa_3_Fase_0_Informe.md`](Archivo/BRAMU_Rama_Jugador_Etapa_3_Fase_0_Informe.md)

Congelar el marcador público en el tag `v14` como app separada, y crear una segunda app/ruta para la nueva rama jugador, con almacenamiento y manifest propios. (Nombres internos de esa época — `bramu-lab`/`bramu-player`, claves `padellab.*`/`bramuplayer.*` — luego pasaron a los nombres de carpeta actuales `bramulab-partidos`/`bramulab`, sin que quedara documentado el paso exacto del cambio.)

---

## 4. Etapa 2 — Home Beta (primera versión jugable)

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md`](Archivo/BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md)

Primera implementación autorizada y acotada del Home de jugador: pantallas nuevas (`view-player-home`, `view-ranking` placeholder, `view-profile` mínima), navegación inferior de 5 ítems, menú compacto en Setup, modal "¿Quién sos?" para identificarse, y navegación contextual para "Cargar partido jugado" según el punto de entrada.

## 4.1. Corrección funcional post-Etapa 2

**Fuentes:** [`Archivo/BRAMU_Rama_Jugador_Auditoria_Funcional.md`](Archivo/BRAMU_Rama_Jugador_Auditoria_Funcional.md) (auditoría) y [`Archivo/BRAMU_Rama_Jugador_Correccion_Funcional.md`](Archivo/BRAMU_Rama_Jugador_Correccion_Funcional.md) (corrección)

Corregir que el Jugador 1 no estaba vinculado a `currentPlayerName`, por lo que un partido autocargado podía no aparecer en el propio Home de quien lo cargó.

---

## 5. Etapa 3 — semántica de fecha, acceso, y correcciones post-prueba

**Fase 1 — Semántica de fecha.** Fuente: [`Archivo/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Consolidado.md). Distinguir `playedAt` (fecha real del partido) de `createdAt` (hora técnica de guardado), con función pura única y cadena de fallback `playedAt ?? startedAt ?? finishedAt`. Prohibía tocar `bramulab-partidos/` o avanzar de fase.

**Fase 2 — Acceso y registro.** Fuente: [`Archivo/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Consolidado.md). Convertir el botón `+` en una hoja inferior de opciones ("Cargar mi partido jugado" vs. "Registrar partido en vivo" → Game por game / Punto por punto), detección de partido en curso, banner no destructivo en Home, confirmación de descarte, auto-resume al recargar. Autorizaba subir la versión visible a **v1.1**.

**Fase 2 — Correcciones post-prueba.** Fuente: [`Archivo/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Consolidado.md). Cuatro ajustes tras probar en iPhone real: bootear siempre en Home (no en Configurar partido), banner de partido en curso más compacto/horizontal, marcador parcial mostrando todos los sets ya jugados (no solo el actual), y des-duplicar el título "PARTIDO EN CURSO" en la hoja. Apuntaba a **v1.2**.

**Adenda de producto/UX.** Fuente: [`Archivo/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md`](Archivo/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md). Documento de contexto (no ejecutable por sí mismo) que amplía el consolidado maestro: tres "principios de movimiento" de marca (Rebote/Latido/Desplazamiento) para un futuro sistema de motion design, regla de "un solo acento lima por pantalla", comparación pendiente Archivo vs. Inter para tipografía, la puerta de "esperar a que lo funcional esté cerrado antes del rediseño visual", y el backlog completo de futuro (BD, cuentas, ranking, Isla Dinámica, etc.) como explícitamente no-implementar-todavía.

**Hotfix v1.2.1.** Fuente: [`Archivo/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Consolidado.md`](Archivo/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Consolidado.md). Un solo hallazgo de prueba en iPhone: "Volver al inicio" tras terminar un partido abría Configurar partido en vez de Home. Define nombres canónicos de pantalla y establece la regla, vigente desde entonces, de que los mensajes de commit sigan la versión real de la app (no numeraciones paralelas tipo "V16"/"V17").

---

## 6. Etapa 3 Fase 3 — Rediseño de "Cargar partido jugado" (v1.3)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Consolidado.md)

Reemplazar el formulario largo de carga manual (4 campos de texto libre + selects) por una pantalla estilo marcador: Jugador 1 fijo (siempre el jugador actual), selector de rival/compañero en hoja inferior (recientes + búsqueda + invitado), teclado numérico fijo para el resultado, línea compacta de formato/puntuación, y guardado/edición reutilizando la pantalla de Resumen. Incluye edición de partidos ya cargados desde el Resumen y desde Análisis.

---

## 7. Etapa 4 — Home integral (v2.0)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Consolidado.md)

Reconstrucción completa del Home, en una sola pasada autorizada sin publicaciones intermedias: banner de partido en curso (si aplica) → Hitos personales (máx. 2, ocultos si ninguno aplica) → Tarjeta de jugador (avatar, nombre, cantidad real de partidos, bloque demo de Nivel BRAMU) → Último partido (racha + fecha compacta + lugar + resultado + equipos) → Tu Momento → fila Actividad+Efectividad (ventana móvil de 30 días) → 4 tarjetas de métricas pequeñas (racha actual, partidos totales, mejor compañero, rival más enfrentado). Retiraba la pastilla de identidad vieja (categoría/ranking/tendencia demo), y ocultaba (sin borrar) el botón COMPARTIR de Resumen.

## 7.1. Hotfix v1.3.1

**Fuente:** informe únicamente, sin consolidado separado — ver [`Archivo/BRAMU_Lab_v1.3.1_Hotfix_Transicion_Post_Guardado_Informe.md`](Archivo/BRAMU_Lab_v1.3.1_Hotfix_Transicion_Post_Guardado_Informe.md). Reaccionaba a una revisión externa (ChatGPT) de v1.3 en producción: reabrir una celda de set ya cargada dejaba el teclado numérico abierto y tapando el Resumen tras guardar.

---

## 8. Etapa 4.1 — Historial y evolución (v2.1)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Consolidado.md) + guía de datos simulados en [`Archivo/BRAMU_Lab_v2_Prueba_Guiada_Datos_Simulados.md`](Archivo/BRAMU_Lab_v2_Prueba_Guiada_Datos_Simulados.md)

Disparada por una revisión externa de v2.0 en producción que encontró dos bugs reales. Pedía: filtros de Historial por propiedad (Todos/Mis partidos/Observados) y por modo (Todos los modos/Cargados/Game por game/Punto por punto); y una evolución simulada del Nivel BRAMU (reemplazando el valor fijo demo `5.3`) con regla explícitamente provisional y aislada para reemplazo futuro, mostrada tanto en el Home como en una nueva tarjeta de Perfil con gráfico de línea. Incluía un ejemplo numérico exacto de 8 partidos para verificación.

---

## 9. Etapa 4.2 — Carga manual y jerarquía visual (v2.2)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Consolidado.md`](Archivo/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Consolidado.md)

Este es el punto donde el ítem 4 del consolidado maestro (§2 arriba) finalmente se construye a fondo, con un alcance bastante más grande que el original: reescritura de "Cargar mi partido jugado" de formulario administrativo a flujo centrado en el marcador, con jerarquía de lectura inspirada en VIBERO (resultado > estado > nombres > formato/fecha > acciones secundarias, sin copiar colores ni UI de VIBERO); marcador compacto que se arma set por set con sets pasados editables; teclado numérico BRAMU con validación **preventiva** (deshabilitar dígitos imposibles antes de confirmar, no solo bloquear después); guardado en dos etapas (guardar de inmediato al confirmar el resultado, luego una pantalla liviana de "enriquecimiento" para fecha/hora/lugar + nota privada opcional, sin un segundo botón Guardar); campo `privateNote` (solo personal, nunca en superficies compartidas/públicas).

## 9.1. Hotfix v2.2.1

**Fuente:** informe únicamente, sin consolidado separado — reacción directa a revisión externa (ChatGPT) del v2.2 recién publicado, ver [`BRAMUlab_V01_Informe.md`](BRAMUlab_V01_Informe.md) §9 y [`Archivo/BRAMU_Lab_v2.2.1_Hotfix_Teclado_y_Compartir_Informe.md`](Archivo/BRAMU_Lab_v2.2.1_Hotfix_Teclado_y_Compartir_Informe.md). Dos hallazgos: la validación preventiva del teclado no conocía el valor ya cargado del equipo contrario (permitía combinaciones imposibles como "2-3"), y el botón COMPARTIR seguía visible en Análisis pese a estar oculto en Resumen desde v2.0.

---

## 10. Estado al cierre de este consolidado

**BRAMUlab_V01 está hoy en v2.2.1** (tag `v2.2.1`, commit `910975f`), con la Etapa 4.2 cerrada y sin ninguna ronda nueva autorizada todavía. El detalle de qué se implementó realmente, con verificaciones, bugs encontrados/corregidos y desvíos justificados, está en [`BRAMUlab_V01_Informe.md`](BRAMUlab_V01_Informe.md).

**Qué queda explícitamente pendiente / fuera de alcance de BRAMUlab_V01**, repetido de forma consistente en todos los consolidados de esta línea: rediseño visual integral (→ es exactamente el objeto de [`BRAMUlab_V02`](../BRAMUlab_V02/BRAMUlab_V02_Consolidado.md)), base de datos/backend real, cuentas de usuario reales, ranking competitivo, y la máquina de estados de validación de partidos (Pendiente/Validado/Disputado/Observado) — ver [`BRAMUlab_Backlog.md`](../../BRAMUlab_Backlog.md).
