# BRAMUlab — documentación activa

Este README es el **mapa de autoridad documental** de BRAMUlab. Antes de investigar el árbol completo, empezar acá y leer **solo la fuente maestra del sistema involucrado**. El índice de todo el repositorio está en [`../../INDICE.md`](../../INDICE.md); BRAMUlive tiene su propia carpeta (`docs/BRAMUlive/`) y no se mezcla.

- `Metodo_Trabajo.md` — guía operativa de coordinación de agentes, commits, pruebas, deploys y **orden documental** (leer antes de coordinar una ronda).
- `Identidad_Visual.md` — fuente maestra de identidad visual (logo/isotipo/icono aprobados, paleta, tipografía, reglas de uso). Moodboards y referencias no son autoridad.
- `Operacion_Vercel_Staging_Production.md` — deploy a Production, alias de Staging y **datos reales de infraestructura de Production**.

---

## 1. Estado actual (08/10/2026)

| Frente | Estado |
|---|---|
| **Producto** | BRAMUlab **V04.37**. Backend Bloques 1–8, Pre-Bloque 9, 9A/9B, G1–G3 y todos los frentes P0 de salida **cerrados**. |
| **Production** | **ACTIVA desde el 07/10/2026** en `https://app.bramulab.com`, con bundle `04.37-h26` (commit `f1ad7d1b`, deployment `dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp`). Primeros usuarios reales ya dentro. Infraestructura, legal y AAIP: `Operacion_Vercel_Staging_Production.md`. |
| **Staging** | Taller activo: bundle `04.37-h29` (consola de métricas, no promovido, invisible para jugadores). Todo cambio nace acá. |
| **Pendientes reales** | Seguimiento del expediente AAIP, smoke humano mínimo de Production, decisión de backups (G4), QA humano de la fecha de nacimiento en Android, y el frente independiente de repositorio público/GitHub Pages. Detalle: `Pre_Production.md` §2. Ideas futuras y riesgos conocidos: `BRAMUlab_Backlog.md`. |
| **BRAMU Metrics** | **EN CURSO — protegido** (ver §3). |

Historia por ronda (V04.11 – V04.37): `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`, sección «registro consolidado de rondas».

## 1.1 Testing y lanzamiento inicial — definición vigente

BRAMU no tiene una cohorte de usuarios “piloto” ni una base real descartable.

- **Testing** = Development/Staging, Sebastián y datos de prueba. Pueden existir usuarios sintéticos, partidos inventados, resets, QA y limpieza.
- **Lanzamiento inicial** = comienza cuando se abre Production y entra el primer usuario real.
- Desde ese momento las cuentas, partidos, historial, Nivel, grupos, validaciones y demás datos reales son permanentes y deben conservar continuidad entre versiones.
- Los primeros usuarios pueden ser amigos de Sebastián por una cuestión de difusión, pero son **usuarios reales**, no testers.
- Difusión limitada, ausencia de campañas o falta de publicación en stores no convierten esa etapa en un piloto.

Regla operativa para cualquier agente:

> **Cuando entra el primer usuario real en Production, BRAMU ya empezó.**

Los nombres técnicos históricos como `pilot_events` pueden conservarse si renombrarlos exige cambios de código o migraciones; ese nombre no define una etapa de producto.

---


---

## 2. Fuentes maestras vigentes

Una fuente maestra por sistema. Si una ronda cambia un sistema, **se actualiza su fuente maestra** (no se agrega otro documento al lado).

| Sistema | Fuente maestra | Estado |
|---|---|---|
| **Nivel BRAMU** | `Nivel_BRAMU.md` (única fuente) | V1.3 cerrado; vigente en Production (V04.37) |
| **Ranking BRAMU** | `Ranking_BRAMU.md` | V1 de producto/UX + backend/frontend real cerrados; snapshot semanal server-backed, sin fallback a mocks |
| **Cargar partido / Historial** | `Cargar_Partido.md` | Flujo vigente (modo resultado, Fecha/Hora/Lugar, V04.27) |
| **Experiencia inicial, identidad, ciclo de partido** | `Experiencia_Inicial.md` → `Backend_Infraestructura.md` (contrato técnico) | Cerrada: Estado Cero, validación por parejas, correcciones, pendientes, invitados/recuperados |
| **Grupos BRAMU** | `Grupos_BRAMU.md` | Server-backed; top 2 / Americano; QA integral cerrada |
| **BRAMU Intelligence** | `BRAMU_Intelligence.md` → `BRAMU_Intelligence_Implementacion.md` | V1 A–E cerrada; F generativa opcional y no bloqueante |
| **Backend / Infraestructura** | `Backend_Infraestructura.md` → `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Bloques 1–8 y Pre-Production cerrados; operación en `Runbook_Operacion_y_Salida.md` |
| **Privacidad / Legal** | `Privacidad_Legal.md` | Cerrada y publicada; resta el número definitivo de AAIP |
| **Identidad visual** | `Identidad_Visual.md` (+ `Marca/`) | Vigente |
| **Salida a Production** | `Pre_Production.md` | Cerrada el 07/10/2026; conserva pendientes y reglas «no reabrir» |
| **Método de trabajo** | `Metodo_Trabajo.md` | Vigente |
| **BRAMU Metrics** | `BRAMU_Metrics.md` y su cadena (§3) | En curso, protegida |
| **Backlog futuro** | `BRAMUlab_Backlog.md` | Solo ideas futuras no autorizadas y riesgos conocidos |

### Nivel BRAMU — fuente única

`Nivel_BRAMU.md` contiene toda la definición vigente: escala y estados, onboarding V1.3, fórmula inicial, calibración y recalibración, motor de partidos, confiabilidad, invitados, persistencia/versionado, UX, tratamiento de cuentas existentes y evidencia de cierre. No hay documentos de fórmula ni de implementación aparte.

- Estimador inicial: `nivel_inicial_v1_3` (`questionnaire_mode = full`).
- Motor de partidos: `nivel_bramu_v1_0`, sin cambios.
- Las cuentas V1.1/V1.2 existentes conservaron su Nivel; no se recalcularon.
- Los documentos de Nivel anteriores y los handoffs de V1.3 fueron retirados del árbol; su historia vive en Git.

### Ranking semanal

Ranking BRAMU vigente es **semanal**. Nivel puede cambiar partido a partido, pero la posición de Ranking cambia al publicarse una nueva edición semanal. Cualquier texto histórico de Intelligence que hable de movimiento de puesto “al procesar el evento actual” se interpreta bajo esta regla vigente.

---


---

## 3. BRAMU Metrics — EN CURSO (protegida)

Consola administrativa privada de BRAMUlab. **No reorganizar, consolidar, retirar ni reubicar ningún archivo de Metrics mientras esté en desarrollo** (`BRAMU_Metrics*.md`, `Implementacion/Post_Lanzamiento/148_*` y `149_*`, `bramulab/admin/metrics/`, `bramulab/metrics-*.test.mjs`, migraciones/Edge `metrics`/`admin-metrics`).

- BRAMU Metrics (consola privada `/admin/metrics`; F1 presencia, F2 núcleo protegido y F3 dashboard implementados en repo; F4–F6 sin implementar): `BRAMU_Metrics.md` (producto; marco confirmado en `BRAMU_Metrics_UX_V1.md`, `_Privacidad_V1.md` y `_Comparaciones_V1.md`) → `BRAMU_Metrics_Auditoria_V1.md` → `BRAMU_Metrics_Auditoria_Tecnica_V1.md` (fuentes, definiciones, consultas validadas) → `Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md` (arquitectura y fases).

**Staging h29 (08/10/2026, NO promovido; invisible):** BRAMU Metrics V1 F3 — consola privada `/admin/metrics` (Inicio, Usuarios, Partidos, detalle de KPI; comparación con período anterior; acceso autorizado solo por el backend). `sw.js` deja pasar `/admin/*` a la red, `vercel.json` agrega headers `noindex`/`no-store` y el robots de Production excluye `/admin/`; el fixture de QA solo se publica en Staging. Sin cambios en la app ni en lógica deportiva. QA de Central: `Implementacion/Post_Lanzamiento/149_Resultado_Metrics_V1_F1_F2_08OCT.md` §6.

**Staging h28 (08/10/2026, NO promovido; invisible):** BRAMU Metrics V1 F1 — la app registra, de forma best-effort, un día de presencia por jugador (`register_app_presence`, solo al reanudar sesión real y al volver a primer plano; sin cambios visibles ni de lógica deportiva). Requiere la migración `20261008100000` aplicada por Central; hasta entonces la llamada falla en silencio. F2 (núcleo protegido de métricas + Edge `admin-metrics`) vive solo en `supabase/`. Detalle y checklist de Central: `Implementacion/Post_Lanzamiento/149_Resultado_Metrics_V1_F1_F2_08OCT.md`.

---

## 4. Cómo está organizado `docs/BRAMUlab`

| Dónde | Qué contiene | Autoridad |
|---|---|---|
| **Raíz** | Fuentes maestras (tabla §2), Runbook, Operación Vercel, Backlog y Metrics | **Sí** |
| `Marca/` | SVG maestros aprobados, derivados y generador (los lee el código y los tests) | Sí (marca) |
| `Versiones/` | Registro histórico por versión mayor (`..._Consolidado` = decisiones/pedidos, `..._Informe` = implementación real) y el Informe de Backend (cadena de la fuente maestra de Backend) | Trazabilidad |
| `Implementacion/Backend/` | Cierres formales de los Bloques 3–8 | Evidencia |
| `Implementacion/Pre_Production/` | Evidencia técnica que se conserva: seguridad (138–139), hardening y ensayos operativos (82, 84, 87), emails G1 (90), cierres 122 y 146 | Evidencia |
| `Implementacion/Post_Lanzamiento/` | Solo Metrics (148–149) | Metrics |
| `Auditorias/` | Auditoría de convergencia Nivel/Ranking (07/10/2026) y sus simulaciones reproducibles | Estudio vigente, sin decisión tomada |
| `Referencias/` | Material de contexto (moodboard, evaluación de IA generativa); no reemplaza una fuente maestra | Contexto |

**Regla de poda.** Un handoff, plan, revisión, gate, hotfix o resultado **consumido** se retira del árbol cuando su contenido ya está en la fuente maestra (o en el registro de rondas). Git es la memoria histórica: para recuperar un documento retirado, `git log --diff-filter=D --name-only -- docs/` y luego `git show <commit>^:<ruta>`. No existe `Archivo/` ni `Backup/` dentro del repositorio: no duplicar la historia. Los comentarios de código y los textos históricos que citan documentos retirados se resuelven con ese mismo comando; **no se editan por eso** (tocar `bramulab/` dispara builds).

**Dropbox** (originales de diseño, referencias visuales y material privado no versionado) está descrito en `Metodo_Trabajo.md`, «Higiene documental».

---

## 5. Regla de lectura para Claude Code / desarrollo

1. Leer este README.
2. Identificar el sistema afectado (§2 o §7).
3. Leer únicamente su fuente maestra vigente.
4. Si hace falta historia de implementación, ir a la sección concreta del Informe de la versión (nunca cargarlo entero).
5. No usar documentos retirados ni material histórico como autoridad cuando contradigan una fuente maestra.
6. No iniciar una auditoría general porque cambió una ruta o existe una referencia histórica.
7. Si aparece una contradicción material que las precedencias de este README no resuelven, reportarla antes de programar.

## 6. Regla de versionado

Desde V04 la numeración de rondas es plana:

`V04.1`, `V04.2`, `V04.3` ... `V04.9`, `V04.10`.

No usar subversiones tipo `V04.9.1`.

**Versión pública vs. bundle técnico (regla vigente desde V04.12):**

- `APP_VERSION` (`store.js`) y `version.json.version` son la versión pública que ve el usuario en el aviso "BRAMUlab V04.x está disponible." Nunca se muestra el sufijo `hN`.
- `BUNDLE_VERSION`, `version.json.bundle`, `CACHE_NAME` y todos los `?v=` (index.html y `CORE_ASSETS` de `sw.js`) llevan el bundle técnico `04.x-hN`.
- **Toda ronda VISIBLE distribuida para instalación/revisión incrementa `V04.x`** y reinicia el sufijo (`04.12-h1`).
- Un hotfix puramente técnico/invisible puede conservar `APP_VERSION` y mover solo `hN`.

Una nueva versión mayor crea una nueva carpeta dentro de `Versiones/`. Una ronda menor dentro de la misma versión no crea otra carpeta mayor.

---

---

## 7. Qué leer según el pedido

- **“Nivel BRAMU”** → este README + `Nivel_BRAMU.md`.
- **“Ranking”** → `Ranking_BRAMU.md` + `Nivel_BRAMU.md` solo donde Ranking dependa de Nivel.
- **“Grupos / Race / puntos de grupo”** → `Grupos_BRAMU.md`.
- **“Cargar partido / ingreso de resultado / Fecha-Hora-Lugar”** → `Cargar_Partido.md`.
- **“BRAMU Intelligence”** → `BRAMU_Intelligence.md` + `BRAMU_Intelligence_Implementacion.md`.
- **“Experiencia inicial / validación / correcciones / pendientes / invitados”** → `Experiencia_Inicial.md` + `Backend_Infraestructura.md` solo para el contrato server-side.
- **“Backend / producción / cuentas reales / staging”** → `Backend_Infraestructura.md` + la sección del bloque correspondiente en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`; operación y deploy: `Runbook_Operacion_y_Salida.md` y `Operacion_Vercel_Staging_Production.md`.
- **“Privacidad / legal / AAIP / eliminación de cuenta”** → `Privacidad_Legal.md` + la sección «Production» de `Operacion_Vercel_Staging_Production.md`.
- **“BRAMU Metrics / métricas / dashboard admin”** → `BRAMU_Metrics.md` + `BRAMU_Metrics_Auditoria_Tecnica_V1.md` + el plan `148_…` (estado: auditoría, plan, F1 y F2 en repo — ver `149_…`; panel sin implementar; Production no autorizada).
- **“Qué falta / ideas futuras / riesgos conocidos”** → `BRAMUlab_Backlog.md` y `Pre_Production.md` §2.
- **“Qué pasó en una versión anterior”** → `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
