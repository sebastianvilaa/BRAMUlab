# BRAMUlab Metrics — documentos (PUBLICADO Y APROBADO)

Consola administrativa privada de BRAMUlab (`/admin/metrics`). **Estado vigente: publicada en Production y aprobada por Sebastián el 14/10/2026** (commit `425fc5b`; detalle en `BRAMU_Metrics.md` y en el README de docs). Ya no está en desarrollo: los cambios futuros nacen en Staging. Se conservan estos documentos, sus decisiones históricas y las referencias técnicas que el código cita.

Orden de lectura:
1. [`BRAMU_Metrics.md`](BRAMU_Metrics.md) — producto (fuente maestra).
2. Marco confirmado: [`BRAMU_Metrics_UX_V1.md`](BRAMU_Metrics_UX_V1.md) · [`BRAMU_Metrics_Privacidad_V1.md`](BRAMU_Metrics_Privacidad_V1.md) · [`BRAMU_Metrics_Comparaciones_V1.md`](BRAMU_Metrics_Comparaciones_V1.md).
3. [`BRAMU_Metrics_Auditoria_V1.md`](BRAMU_Metrics_Auditoria_V1.md) → [`BRAMU_Metrics_Auditoria_Tecnica_V1.md`](BRAMU_Metrics_Auditoria_Tecnica_V1.md) — fuentes, definiciones y consultas validadas.
4. Plan y resultado de implementación (F1–F3): **permanecen en** [`../Implementacion/Post_Lanzamiento/`](../Implementacion/Post_Lanzamiento/) (`148_Plan_Implementacion_…` y `149_Resultado_…`), porque el código (`auth.js`, `admin-metrics`, migraciones) los cita por esa ruta.

Código y pruebas: `bramulab/admin/metrics/`, `bramulab/metrics-*.test.mjs`, `supabase/functions/admin-metrics/`, `supabase/functions/_shared/{admin-metrics,metrics-*}`, migraciones `2026100811*`.

Nota de rutas: los comentarios del código que citan `docs/BRAMUlab/BRAMU_Metrics_*.md` se refieren a los archivos de esta carpeta (se movieron el 08/10/2026 sin cambiar su contenido).

**Antecedentes de octubre (Staging; superados por la publicación del 14/10/2026 — no son pendientes actuales).** Estado (08/10/2026): F1–F3 aplicadas/desplegadas en Staging; cierre de F3 y pendientes vivos en `149_…` §7; **F4 implementada en el repo** (alcance `148_…` §11; resultado y checklist de Central `149_…` §8; migración `20261008120000` pendiente de aplicar). D8 (días completos hasta ayer) confirmada: ver `BRAMU_Metrics_Comparaciones_V1.md`. Production no autorizada.

**Explorar (F6, 08/10/2026; antecedente):** implementado en el repo (`04.37-h31`); diseño `148_…` §12, resultado y checklist de Central `149_…` §10; migración `20261008130000` y redeploy de `admin-metrics` pendientes. Decisiones abiertas D9–D11.

**Mejoras visuales y UX (14/10/2026):** ícono propio, «Hoy · parcial», tablero de Inicio, tarjetas Web y pulido móvil; **publicadas en Production y aprobadas el 14/10/2026**. Alcance, procedimiento de publicación y reversión (referencia) en `BRAMU_Metrics.md`.
