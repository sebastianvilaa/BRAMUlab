# BRAMU Metrics V1 — Comparaciones automáticas

Fecha: 08/10/2026. Estado: CONFIRMADO por Sebastián.

Complementa `BRAMU_Metrics.md`, `BRAMU_Metrics_UX_V1.md` y `BRAMU_Metrics_Privacidad_V1.md`.

- Comparar por defecto el período seleccionado contra el inmediatamente anterior de igual duración, con opción visible para desactivar.
- Mostrar variaciones absolutas y porcentuales cuando sean matemáticamente significativas. Sin porcentaje engañoso cuando el denominador anterior sea cero.
- En gráficos, superponer los dos períodos con identificación inequívoca de series y fechas.
- Distinguir métricas acumuladas de métricas de flujo: para cuentas totales mostrar saldo actual y crecimiento/altas comparables, no tratar stock como flujo.
- En series incompletas, cohortes inmaduras o actividad no instrumentada, mostrar `No disponible`/`Sin datos suficientes`, no inventar crecimiento.
- Mantener acceso privado del administrador y lectura de Production solo después de aprobación explícita de despliegue. Staging es el entorno exclusivo de desarrollo.

Con esta decisión queda cerrado el marco funcional inicial de Metrics V1. La siguiente fase es revisar la auditoría técnica de Claude Code antes de implementación.

## Actualización D8 — días completos hasta ayer (CONFIRMADA por Sebastián, 08/10/2026)
- Los períodos 7 / 30 / 90 días e Histórico **terminan a las 00:00 de hoy (hora de Buenos Aires)**: incluyen solo **días completos, hasta ayer**. El período anterior son los N días completos inmediatamente previos, de **igual longitud**. Así el día en curso, incompleto, no distorsiona las variaciones.
- Alcanza a períodos, comparaciones, series, etiquetas («09/09 – 07/10», nunca «hoy») y a DAU/WAU/MAU (el «día» es el último día completo, ayer).
- **La actividad de hoy se muestra aparte**, rotulada «HOY · PARCIAL · hasta las HH:MM» (altas, partidos cargados/validados y jugadores activos), y **nunca** entra en períodos ni comparaciones. Si la presencia no está instrumentada, dice «Todavía no medible» (no 0).
- Los **saldos al corte** (cuentas, grupos, membresías, invitaciones abiertas) siguen siendo el estado actual y se rotulan «Saldo al corte». Los ratios que son **foto del estado actual** (perfiles completos, localidad, Nivel calibrado, elegibilidad para Ranking) **no se comparan** contra el período previo (marca `snapshot`).
- Implementación: migración `20261008120000_metrics_f4_d8_comunidad.sql` (`_metrics_window`, `_metrics_today`).
