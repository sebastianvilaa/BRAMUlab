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
