# BRAMUlab — documentación

Naming activo del proyecto (usar siempre exactamente así):

- `BRAMUlab_Partidos_V##` — el producto anterior (marcador congelado, `bramulab-partidos/` en el código). Documentación en [`../BRAMUlab_Partidos/`](../BRAMUlab_Partidos/).
- `BRAMUlab_V01` — la primera aplicación integral (`bramulab/` en el código). Todo lo desarrollado hasta el hotfix v2.2.1.
- `BRAMUlab_V02` — sistema visual integral (base) más sus subversiones de corrección `BRAMUlab_V02.1`, `V02.2`... — todas viven en la MISMA carpeta `Versiones/BRAMUlab_V02/`, nunca una carpeta nueva por subversión. Solo un cambio de versión MAYOR (`BRAMUlab_V03`) crea una carpeta nueva.
- `BRAMUlab_V03` — identidad real del jugador (cuenta local, Player Card, Perfil editable) sobre la misma base visual/funcional de V02.9.3. Vive en [`Versiones/BRAMUlab_V03/`](Versiones/BRAMUlab_V03/).

No se usa "Jugador", "Legacy", "Etapa", "Fase", "Plan" ni fechas en el naming activo. Documentos con esos nombres existieron (consolidados/informes de cada ronda de desarrollo) pero se borraron del repositorio una vez que su contenido quedó resumido en el Consolidado/Informe de cada versión y en `BRAMUlab_Backlog.md` — siguen recuperables del historial de git (commit `990df66`, el último que todavía los incluye) si hiciera falta el texto original de alguno.

## Versión funcional actual: BRAMUlab_V03.4.1

La app publicada hoy se identifica en producto como **"BRAMUlab V03.4.1"** (footer del Home/badge de versión) — tag técnico de git `BRAMUlab_V03.4.1`. Microparche sobre V03.4 (Mis grupos): corrige un bug real de empates (dos jugadores con el mismo puntaje ahora comparten posición, tanto en la tabla como en BRAMU Intelligence — nunca más un "líder"/"segundo" inventado), ajusta jerarquía visual (selector de grupos vs. tabs de contenido, nombre del grupo en Intelligence, spacing, botones a ancho estándar, foto real en la tabla), y agrega el campo de ubicación pendiente en MIS DATOS ("¿De dónde sos?", preparado para el futuro Ranking BRAMU local — todavía no implementado) más selectores compactos para Género/Mano/Lado/Categoría. Nuevo módulo puro `locations.js`.

| Qué necesitás | Documento |
|---|---|
| Qué se pidió en V03.4.1 (microparche: empates, jerarquía, ubicación) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.4.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.4.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.4.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.4.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.4.1_Informe.md) |

**Rondas anteriores:**

| Qué necesitás | Documento |
|---|---|
| Qué se especificó en V03.4 (Mis grupos) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.4_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.4_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.4 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.4_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.4_Informe.md) |
| Qué se especificó en V03.3.3 (buscador dentro de JUGADORES) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.3_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.3_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.3.3 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.3_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.3_Informe.md) |
| Qué se especificó en V03.3.2 (título Recientes/Todos + bug real corregido) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.3.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.2_Informe.md) |
| Qué se especificó en V03.3.1 (microparche: Home, fila de jugador, Perfil público) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.3.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3.1_Informe.md) |
| Qué se especificó en V03.3 (perfil público, búsqueda y sistema de jugadores) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.3 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.3_Informe.md) |
| Qué se especificó en V03.2.2 (microparche visual: acceso, login, confirmar partido) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.2.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2.2_Informe.md) |
| Qué se especificó en V03.2.1 (corrección visual de acceso, botones y carga manual tras QA en producción) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.2.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Informe.md) |
| Qué se especificó en V03.2 (auditoría y normalización del sistema visual transversal: acceso, splash, botones, modales, navegación inferior) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Informe.md) |

**Rondas anteriores de V03, sin cambios de arquitectura desde entonces:**

| Qué necesitás | Documento |
|---|---|
| Qué se especificó en V03.1.6 (corrección del loop infinito de actualización) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.6_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.6_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.6 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.6_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.6_Informe.md) |
| Qué se especificó en V03.1.5 (corrección de línea en la tarjeta de Evolución) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.5_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.5_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.5 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.5_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.5_Informe.md) |
| Qué se especificó en V03.1.4 (ajuste de composición en Evolución + ritmo vertical) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.4_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.4_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.4 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.4_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.4_Informe.md) |
| Qué se especificó en V03.1.3 (microparche final de MI PERFIL) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.3_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.3_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.3 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.3_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.3_Informe.md) |
| Qué se especificó en V03.1.2 (microparche de composición en Perfil) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.2_Informe.md) |
| Qué se especificó en V03.1.1 (pulido de MI PERFIL + simplificación de MIS DATOS) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Informe.md) |
| Qué se especificó en V03.1 (rediseño de MI PERFIL + compactación de MIS DATOS) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.1_Informe.md) |
| Qué se especificó en V03.0.3.2 (recuperación desde sesión + tabs de modo) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0.3.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.2_Informe.md) |
| Qué se especificó en V03.0.3.1 (recuperación simulada de contraseña + ajustes menores) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0.3.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3.1_Informe.md) |
| Qué se especificó en V03.0.3 (Perfil deportivo, acceso público y correcciones visuales) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0.3 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Informe.md) |
| Qué se especificó en V03.0.2 (sistema visual transversal, Perfil y Notificaciones) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0.2 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Informe.md) |
| Qué se especificó en V03.0.1 (refinamiento UX de Perfil, Acceso y sesión) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0.1 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Informe.md) |

**Base (V03.0):**

| Qué necesitás | Documento |
|---|---|
| Qué se especificó en V03.0 (identidad del jugador: cuenta local, Player Card, Perfil editable, calibración de Nivel BRAMU) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V03.0 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Informe.md) |

**Base visual (V02.9.3), sin cambios en esta ronda:**

| Qué necesitás | Documento |
|---|---|
| Qué se especificó en V02 (sistema visual integral, base) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md) (incluye al final la sección "Ajuste visual de cierre 01") |
| Qué se especificó en V02.1 (corrección funcional, UX y terminación visual) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.1_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.1_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.1 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.1_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.1_Informe.md) |
| Qué se especificó en V02.2 (corrección de UX y terminación visual sobre V02.1) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.2_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.2_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.2 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.2_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.2_Informe.md) |
| Qué se especificó en V02.3 (ajuste acotado: color contextual del selector, pausa final de carga manual + Confirmar partido, notas del Resumen, Actividad/Efectividad del Home) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.3 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Informe.md) |
| Qué se especificó en V02.4 (ajuste visual acotado: Actividad apilada + Nivel BRAMU del Home, jerarquía de Último partido, sheet Registrar partido compacto, pastillas de sets de Partido completo) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.4 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Informe.md) |
| Qué se especificó en V02.5 (integración visual + UX: nueva dupla cromática verde/azul BRAMU, rediseño del selector de jugador, fecha/hora con jerarquía real, Notas ya no bloquea el guardado, Resumen manual compacto) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.5_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.5_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.5 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.5_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.5_Informe.md) |
| Qué se especificó en V02.6 (corrección visual + regresión crítica: grilla estable de Confirmar partido/Resumen, azul BRAMU más eléctrico, glow leve en Home, marcador de Último partido con dash/dot geométricos) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.6_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.6_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.6 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.6_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.6_Informe.md) |
| Qué se especificó en V02.7 (afinación visual: fondo unificado en toda la app, Actividad por semanas calendario en vez de 30 días, Efectividad histórica total, microanimaciones de entrada al Home, pulso sutil de Último partido) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.7_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.7_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.7 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.7_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.7_Informe.md) |
| Qué se especificó en V02.8 (auditoría visual + corrección de inconsistencias verificadas: microanimaciones del Home en cada entrada, glow de Efectividad sin caja, pulso de Último partido, hito azul con texto blanco, tracking de títulos de overlay, CTA de jugador sin cuenta, ritmo de Resumen, fondo de Setup, limpieza CSS segura) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.8 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Informe.md) |
| Auditoría visual y de CSS que fundamenta las correcciones de V02.8 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Auditoria_Visual_CSS.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Auditoria_Visual_CSS.md) |
| Qué se implementó, verificó y corrigió en V02.8.1 (corrección corta de calibración visual sobre la prueba real de V02.8: técnica de animación del Home reforzada, halo de Efectividad sin filtros, pulso intermedio de Último partido, hito a dos líneas, botones de Resumen parejos, CTA de jugador sin cuenta secundario) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8.1_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8.1_Informe.md) |
| Qué se implementó, verificó y corrigió en V02.8.2 (calibración muy puntual sobre V02.8.1: recupera la animación de Actividad — regresión real, técnica reemplazada por la misma de Nivel BRAMU —, refina el estado estático de Efectividad, achica el hito ~15%, normaliza el tracking del botón del aviso de actualización) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8.2_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8.2_Informe.md) |
| Qué se implementó, verificó y corrigió en V02.8.3 (corrección puntual del donut de Efectividad: bug real encontrado — `opacity:1` inline pisaba la opacidad de los halos definida en CSS desde V02.8.1 — más recalibración de trazo/halos ahora que la opacidad correcta se aplica de verdad) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.8.3_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.8.3_Informe.md) |
| Qué se especificó en V02.9 (refinamiento corto: Efectividad vuelve a un aro nítido sin halos apilados, "agregar jugador sin cuenta" pasa de CTA grande a fila contextual de búsqueda, Último partido/Historial muestran formato+sistema real del partido, Historial se vuelve versión compacta de Último partido sin "PARTIDO CARGADO"/X, Resumen suma "Eliminar partido" con confirmación) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.9_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.9_Consolidado.md) |
| Qué se implementó, verificó y corrigió en V02.9 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.9_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.9_Informe.md) |
| Qué se implementó, verificó y corrigió en V02.9.1 (micro-ronda: trazo de Efectividad más presente, encabezado de Último partido en 2 líneas, jerarquía de participantes en Historial bajada frente al resultado) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.9.1_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.9.1_Informe.md) |
| Qué se implementó, verificó y corrigió en V02.9.2 (ajuste puntual de un solo valor: trazo de Efectividad 2px→3px, probado en vivo con el inspector de Chrome) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.9.2_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.9.2_Informe.md) |
| Qué se implementó, verificó y corrigió en V02.9.3 (Historial sin color de énfasis en jugadores — ni ganador ni pareja propia —, resultado a 30px como dato protagonista, encabezado de Último partido más compacto; todo probado en vivo con el inspector de Chrome) — **el estado real de la app hoy**. Sin `Consolidado` propio: origen en feedback directo en el chat, documentado en este mismo Informe | [`Versiones/BRAMUlab_V02/BRAMUlab_V02.9.3_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02.9.3_Informe.md) |

**Si vas a seguir desarrollando BRAMUlab_V02.9.3, leé el Informe de V02.9.3 primero** (es el estado real de la app hoy), después el de V02.9.2/V02.9.1/V02.9/V02.8.3/V02.8.2/V02.8.1/V02.8/V02.7/V02.6/V02.5/V02.4/V02.3/V02.2/V02.1/V02 si hace falta contexto de una decisión visual más vieja que V02.9.3 no tocó.

## Versión anterior: BRAMUlab_V01

Toda la lógica funcional (partidos, historial, Home, BRAMU Intelligence) sigue siendo la de V01 — V02 solo le cambió el sistema visual encima. Para entender esa lógica (no el aspecto visual actual, que ya quedó superado):

| Qué necesitás | Documento |
|---|---|
| Qué se especificó, en orden, desde el origen hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md) |
| Qué se implementó, verificó y corrigió hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md) |

Los documentos originales de cada Etapa/Fase/hotfix (citados por nombre dentro del Consolidado/Informe de arriba) ya no están en el repositorio — se borraron una vez confirmado que no quedaba nada sin resumir; recuperables del historial de git (commit `990df66`).

## Backlog

**Documento vivo.** [`BRAMUlab_Backlog.md`](BRAMUlab_Backlog.md) es el único lugar donde viven las ideas futuras del proyecto (validación de partidos, cuentas/ranking, notificaciones, smartwatch, fotos/recuerdos, motion, etc.) — nada de esto está autorizado para implementar todavía. Cuando Sebastián piense una idea nueva con ChatGPT, el flujo es: revisar primero este archivo para no chocar con o duplicar algo ya pensado, y agregarla acá — nunca dejarla suelta en un documento de ronda que después se borra.

## Referencias

Documentación visual y auditorías todavía útiles como contexto, pero que no son consolidados de implementación ni deben confundirse con uno: [`Referencias/`](Referencias/) (moodboard de dirección visual, brief para ChatGPT, auditoría visual pre-V02 del código).

## Qué leer, según lo que te pidan

- **"Seguí desarrollando BRAMU Lab / la app / lo de siempre"** → estás en `BRAMUlab_V03.0` (es la versión publicada hoy). Leé su Informe arriba para el estado real actual (identidad/cuenta), el Informe de V02.9.3 para el sistema visual que no cambió, y el Informe/Consolidado de V01 para la lógica funcional de base (partidos, historial, BRAMU Intelligence).
- **Cualquier pedido de ajuste visual, funcional o de UX puntual sobre Home/Historial/partidos** → sigue siendo sobre `BRAMUlab_V02` (subversión `V02.9.3`), no sobre V01 ni V03. Una futura ronda de corrección sobre identidad/cuenta se documenta como `BRAMUlab_V03.1` (misma carpeta `Versiones/BRAMUlab_V03/`); sobre el resto de la app, sigue siendo `BRAMUlab_V02.10`/`V02.9.4` dentro de `Versiones/BRAMUlab_V02/` — nunca una carpeta nueva salvo cambio de versión mayor.
- **"¿Qué falta / qué es lo próximo?"** → `BRAMUlab_Backlog.md`.
- **Cualquier documento que diga "Etapa", "Fase", "rama jugador" o "BRAMU Lab" (con espacio)** es histórico — ya no existe en el repositorio (se borró una vez resumido en el Consolidado/Informe/Backlog correspondiente), pero es recuperable del historial de git si hiciera falta.
