# BRAMU Metrics — Decisión de privacidad V1

Fecha: 08/10/2026
Complemento a `BRAMU_Metrics.md` y `BRAMU_Metrics_UX_V1.md`.

## CONFIRMADO
- V1 se concentra en estadísticas agregadas, no fichas individuales de personas.
- No habilitar buscador de usuarios ni listado de actividad identificable.
- Permitir segmentaciones por localidad, cohorts, estados, Nivel y demás dimensiones sustentadas por datos; abstenerse u ocultar segmentos muy pequeños que permitan reidentificar personas.
- Mantener métricas verificables y los mismos contratos entre panel y consultas del chat.
- V1 sigue en fase de diseño/auditoría; no hay autorización para modificar Production ni BRAMUlive.

## PROPUESTO PARA REVISAR EN UX
- Comparación automática de períodos equivalentes activada por defecto y desactivable. No presentar métricas stock como flujos.
- Fechas 7/30/90 días e histórico, y rango manual en fase posterior.
- No inventar series históricas de actividad antes de la instalación de telemetría.

## PENDIENTE
- Umbral técnico de protección para grupos pequeños y especificación exacta de filtros cruzados.
- Definición de la portada definitiva según las capacidades confirmadas por auditoría técnica.
