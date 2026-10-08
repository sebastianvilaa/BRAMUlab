# BRAMU Metrics — documentos (EN DESARROLLO)

Consola administrativa privada de BRAMUlab (`/admin/metrics`). **Protegida mientras esté en desarrollo:** no consolidar, retirar ni modificar el contenido de estos documentos ni de su implementación.

Orden de lectura:
1. [`BRAMU_Metrics.md`](BRAMU_Metrics.md) — producto (fuente maestra).
2. Marco confirmado: [`BRAMU_Metrics_UX_V1.md`](BRAMU_Metrics_UX_V1.md) · [`BRAMU_Metrics_Privacidad_V1.md`](BRAMU_Metrics_Privacidad_V1.md) · [`BRAMU_Metrics_Comparaciones_V1.md`](BRAMU_Metrics_Comparaciones_V1.md).
3. [`BRAMU_Metrics_Auditoria_V1.md`](BRAMU_Metrics_Auditoria_V1.md) → [`BRAMU_Metrics_Auditoria_Tecnica_V1.md`](BRAMU_Metrics_Auditoria_Tecnica_V1.md) — fuentes, definiciones y consultas validadas.
4. Plan y resultado de implementación (F1–F3): **permanecen en** [`../Implementacion/Post_Lanzamiento/`](../Implementacion/Post_Lanzamiento/) (`148_Plan_Implementacion_…` y `149_Resultado_…`), porque el código protegido (`auth.js`, `admin-metrics`, migraciones) los cita por esa ruta.

Código y pruebas: `bramulab/admin/metrics/`, `bramulab/metrics-*.test.mjs`, `supabase/functions/admin-metrics/`, `supabase/functions/_shared/{admin-metrics,metrics-*}`, migraciones `2026100811*`.

Nota de rutas: los comentarios del código que citan `docs/BRAMUlab/BRAMU_Metrics_*.md` se refieren a los archivos de esta carpeta (se movieron el 08/10/2026 sin cambiar su contenido).

**Estado (08/10/2026):** F1–F3 aplicadas/desplegadas en Staging; cierre de F3 y pendientes vivos en `149_…` §7; alcance mínimo de F4 en `148_…` §11. Production no autorizada.
