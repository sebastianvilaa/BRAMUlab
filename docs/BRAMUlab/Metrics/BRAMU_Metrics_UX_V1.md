# BRAMU Metrics V1 — Diseño funcional: paneles + explorador

Fecha: 08/10/2026. Estado: decisiones UX confirmadas por Sebastián. Complementa `BRAMU_Metrics.md` y `BRAMU_Metrics_Auditoria_V1.md`. No autoriza ejecución en Production.

## Confirmado
- Identidad visual: **oscuro deportivo**, sobrio y analítico, consistente con `Identidad_Visual.md` vigente. No tomar colores del wireframe conceptual como tokens oficiales.
- Dos modos complementarios: **paneles preparados** para consultar lo esencial sin configuración; **Explorar** para construir consultas con filtros y comparaciones.
- Todo KPI o gráfico preparado deberá poder abrir su vista de análisis detallada con la misma definición de la métrica.
- Mobile responsive y escritorio; prioridad a legibilidad, interacción rápida y acceso directo, no tablas microscópicas.
- El primer entregable útil puede incluir paneles preparados; **explorador libre es parte del rumbo confirmado**, pero se construye gradualmente encima de métricas fiables, sin motor SQL arbitrario ni constructor complejo prematuro.

## Arquitectura UX sugerida
### Inicio
Filtros globales 7/30/90 días, histórico y luego rango personalizado; fecha/hora de última actualización y comparación con período anterior, indicando métricas totales (stock) vs flujos de intervalo. KPI: registrados actuales, altas, activos (cuando instrumentados), partidos cargados, validados, grupos. Evolución de usuarios y partidos; activación; retención solo tras eventos disponibles.

### Vistas preparadas
- Usuarios: registrados/nuevos/activos, localidades, segmentos con protección para cohortes reducidas.
- Partidos: creados/jugados/validados, estados, autores vs participantes, validación, anulaciones.
- Activación: registrado → Nivel → primer partido (creador vs participante separados) → 3/5 partidos; retorno.
- Comunidad: grupos, Nivel, Ranking oficiales.
- Uso: eventos medidos, adopción de funciones y retención según instrumentación real.

### Explorar (V1 incremental)
Controles principales: métrica (catálogo de métricas auditadas) + rango + comparación período previo. Vista de serie temporal o barras según naturaleza de la métrica, total y variación; definición y denominador accesibles.
Filtros futuros según naturaleza: localidad, estado de partido, rama competitiva, estado de Nivel; nunca habilitar filtros que induzcan falsos cruces.
Al cambiar la métrica, resetear filtros incompatibles explícitamente. Estados: carga, sin registros, no instrumentada, no disponible, error.

## Normas de producto
- No mezclar cuentas reales y jugadores provisionales; ni fecha de carga vs fecha jugada.
- En V1 NO exponer SQL libre al navegador ni registros individuales por defecto.
- No hacer rankings individuales de uso o paneles identificables salvo nueva decisión y revisión de privacidad.
- No llamar usuario activo a un login; DAU/WAU/MAU requieren evento de actividad auténtica y una fecha de inicio de captura.
- Retención no disponible para cohortes inmaduras.
- El chat puede consultar Supabase en solo lectura y usar las mismas definiciones. Es una vía distinta al login del panel.
- Fase inicial de desarrollo en Staging con datos de Staging o datos simulados identificados para QA. Lectura de Production para métricas reales solo por vía autorizada; no mezclar entornos.

## Estado del diseño
UX y estructura general: CONFIRMADOS.
Tokens finales, layout definitivo, formatos exactos de gráficos y microinteracciones: A DISEÑAR.
Ejecución técnica: pendiente de auditoría de Claude Code; no repetirla.
