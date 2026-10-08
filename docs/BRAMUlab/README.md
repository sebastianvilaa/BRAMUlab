# BRAMUlab — documentación activa

Este README es el **punto de entrada y mapa de autoridad documental** de BRAMUlab. Empezar acá y leer **solo la fuente maestra del sistema involucrado**. El índice del repositorio completo está en [`../../INDICE.md`](../../INDICE.md); BRAMUlive tiene su propia carpeta (`docs/BRAMUlive/`) y no se mezcla.

## Cómo está organizada la documentación

| Carpeta | Qué contiene | Qué es |
|---|---|---|
| **`README.md`** y **`Metodo_Trabajo.md`** (esta carpeta) | Estado vigente y reglas de trabajo, commits, pruebas, deploys y orden documental | Entrada |
| **[`Producto/`](Producto/)** | Qué hace BRAMUlab: Nivel, Ranking, Grupos, Cargar partido, Experiencia inicial (ciclo de partido, historial, invitados), BRAMU Intelligence, Emails y el Backlog | **Fuentes maestras** |
| **[`Metrics/`](Metrics/)** | BRAMU Metrics (consola administrativa, **en desarrollo**) | Fuentes maestras de Metrics |
| **[`Operacion/`](Operacion/)** | Backend e infraestructura, operación y runbook, Vercel/Production, privacidad y legal, salida a Production | **Fuentes maestras** |
| **[`Identidad_Visual/`](Identidad_Visual/)** | Identidad visual y `Marca/` (SVG maestros que usa la app) | **Fuente maestra** |
| **[`Implementacion/`](Implementacion/)** | Evidencia técnica que todavía se justifica conservar (cierres de Backend, seguridad, ensayos operativos, emails G1) | Evidencia |
| **[`Versiones/`](Versiones/)** | Historia: mapa histórico consolidado + registro por versión | Trazabilidad |
| **[`Auditorias/`](Auditorias/)** | Estudio de convergencia Nivel/Ranking con sus simulaciones (scripts que importan el motor de `bramulab/`, por eso no se mueven) | Estudio vigente |

---

## 1. Estado actual (08/10/2026)

| Frente | Estado |
|---|---|
| **Producto** | BRAMUlab **V04.37**. Backend Bloques 1–8, Pre-Bloque 9, 9A/9B, G1–G3 y todos los frentes P0 de salida **cerrados**. |
| **Production** | **ACTIVA desde el 07/10/2026** en `https://app.bramulab.com`, con bundle `04.37-h26` (commit `f1ad7d1b`, deployment `dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp`). Primeros usuarios reales ya dentro. Infraestructura, legal y AAIP: `Operacion/Operacion_Vercel_Staging_Production.md`. |
| **Staging** | Taller activo: bundle `04.37-h30` (consola de métricas F4, no promovido, invisible para jugadores). Todo cambio nace acá. |
| **Pendientes reales** | Seguimiento del expediente AAIP, smoke humano mínimo de Production, decisión de backups (G4), QA humano de la fecha de nacimiento en Android, y el frente independiente de repositorio público/GitHub Pages. Detalle: `Operacion/Pre_Production.md` §2. Ideas futuras y riesgos conocidos: `Producto/BRAMUlab_Backlog.md`. |
| **BRAMU Metrics** | **EN CURSO — protegido** (ver §3). |

Historia por ronda (V04.11 – V04.37): `Versiones/README.md` (mapa) y `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`, sección «registro consolidado de rondas».

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
| **Nivel BRAMU** | [`Producto/Nivel_BRAMU.md`](Producto/Nivel_BRAMU.md) (única fuente) | V1.3 cerrado; vigente en Production (V04.37) |
| **Ranking BRAMU** | [`Producto/Ranking_BRAMU.md`](Producto/Ranking_BRAMU.md) | V1 de producto/UX + backend/frontend real cerrados; snapshot semanal server-backed, sin fallback a mocks |
| **Grupos BRAMU** | [`Producto/Grupos_BRAMU.md`](Producto/Grupos_BRAMU.md) | Server-backed; top 2 / Americano; QA integral cerrada |
| **Partidos** (cargar, validar, corregir, historial, pendientes) | [`Producto/Cargar_Partido.md`](Producto/Cargar_Partido.md) (el flujo de carga) · [`Producto/Experiencia_Inicial.md`](Producto/Experiencia_Inicial.md) (ciclo del partido, historial, invitados/recuperados; contrato técnico en `Operacion/Backend_Infraestructura.md`) | Cerrados |
| **Experiencia inicial** (Estado Cero, Perfil progresivo) | [`Producto/Experiencia_Inicial.md`](Producto/Experiencia_Inicial.md) | Cerrada |
| **BRAMU Intelligence** | [`Producto/BRAMU_Intelligence.md`](Producto/BRAMU_Intelligence.md) → [`BRAMU_Intelligence_Implementacion.md`](Producto/BRAMU_Intelligence_Implementacion.md) | V1 A–E cerrada; F generativa opcional y no bloqueante |
| **Emails** | [`Producto/Comunicaciones_Emails.md`](Producto/Comunicaciones_Emails.md) (copy y HTML en `supabase/email-templates/`) | Cerrado e implementado (G1) |
| **BRAMU Metrics** | [`Metrics/BRAMU_Metrics.md`](Metrics/BRAMU_Metrics.md) y su cadena (§3) | En curso, protegida |
| **Backend / Infraestructura** | [`Operacion/Backend_Infraestructura.md`](Operacion/Backend_Infraestructura.md) → `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Bloques 1–8 y Pre-Production cerrados |
| **Operación y deploy** | [`Operacion/Runbook_Operacion_y_Salida.md`](Operacion/Runbook_Operacion_y_Salida.md) · [`Operacion/Operacion_Vercel_Staging_Production.md`](Operacion/Operacion_Vercel_Staging_Production.md) | Vigentes |
| **Privacidad / Legal** | [`Operacion/Privacidad_Legal.md`](Operacion/Privacidad_Legal.md) | Cerrada y publicada; resta el número definitivo de AAIP |
| **Salida a Production** | [`Operacion/Pre_Production.md`](Operacion/Pre_Production.md) | Cerrada el 07/10/2026; conserva pendientes y reglas «no reabrir» |
| **Identidad visual** | [`Identidad_Visual/Identidad_Visual.md`](Identidad_Visual/Identidad_Visual.md) (+ [`Marca/`](Identidad_Visual/Marca/)) | Vigente |
| **Método de trabajo** | [`Metodo_Trabajo.md`](Metodo_Trabajo.md) | Vigente |
| **BRAMUlive** | [`../BRAMUlive/BRAMUlive.md`](../BRAMUlive/BRAMUlive.md) | Producto separado; no se toca en rondas de BRAMUlab |
| **Backlog futuro** | [`Producto/BRAMUlab_Backlog.md`](Producto/BRAMUlab_Backlog.md) | Solo ideas futuras no autorizadas y riesgos conocidos |

### Nivel BRAMU — fuente única

`Producto/Nivel_BRAMU.md` contiene toda la definición vigente: escala y estados, onboarding V1.3, fórmula inicial, calibración y recalibración, motor de partidos, confiabilidad, invitados, persistencia/versionado, UX, tratamiento de cuentas existentes y evidencia de cierre. No hay documentos de fórmula ni de implementación aparte.

- Estimador inicial: `nivel_inicial_v1_3` (`questionnaire_mode = full`).
- Motor de partidos: `nivel_bramu_v1_0`, sin cambios.
- Las cuentas V1.1/V1.2 existentes conservaron su Nivel; no se recalcularon.
- Los documentos de Nivel anteriores y los handoffs de V1.3 fueron retirados del árbol; su historia vive en Git.

### Ranking semanal

Ranking BRAMU vigente es **semanal**. Nivel puede cambiar partido a partido, pero la posición de Ranking cambia al publicarse una nueva edición semanal. Cualquier texto histórico de Intelligence que hable de movimiento de puesto “al procesar el evento actual” se interpreta bajo esta regla vigente.

---

---

## 3. BRAMU Metrics — EN CURSO (protegida)

Consola administrativa privada de BRAMUlab. Sus documentos están juntos en [`Metrics/`](Metrics/) (índice propio: [`Metrics/README.md`](Metrics/README.md)); el plan y el resultado de implementación (`148_*`, `149_*`) **permanecen en `Implementacion/Post_Lanzamiento/`** porque el código protegido los cita por esa ruta. **No consolidar, retirar ni modificar el contenido de Metrics mientras esté en desarrollo** (`bramulab/admin/metrics/`, `bramulab/metrics-*.test.mjs`, migraciones/Edge `metrics`/`admin-metrics`).

- BRAMU Metrics (consola privada `/admin/metrics`; F1 presencia, F2 núcleo protegido y F3 dashboard aplicados/desplegados en **Staging**; **F4 (Activación, Comunidad, Uso; D8 días completos) implementada en el repo, con su migración pendiente de aplicar por Central**; F5–F6 sin implementar): `Metrics/BRAMU_Metrics.md` (producto; marco confirmado en `BRAMU_Metrics_UX_V1.md`, `_Privacidad_V1.md` y `_Comparaciones_V1.md`) → `BRAMU_Metrics_Auditoria_V1.md` → `BRAMU_Metrics_Auditoria_Tecnica_V1.md` (fuentes, definiciones, consultas validadas) → `Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md` (arquitectura y fases).

**Staging h29 (08/10/2026, NO promovido; invisible):** BRAMU Metrics V1 F3 — consola privada `/admin/metrics` (Inicio, Usuarios, Partidos, detalle de KPI; comparación con período anterior; acceso autorizado solo por el backend). `sw.js` deja pasar `/admin/*` a la red, `vercel.json` agrega headers `noindex`/`no-store` y el robots de Production excluye `/admin/`; el fixture de QA solo se publica en Staging. Sin cambios en la app ni en lógica deportiva. QA de Central: `Implementacion/Post_Lanzamiento/149_Resultado_Metrics_V1_F1_F2_08OCT.md` §6.

**Cierre de F3 (08/10/2026):** código y pruebas locales cerrados (70/70 de Metrics; base del repo sin cambios); concordancia de Inicio y acceso administrativo confirmados por Central. **Pendiente de ejecución humana** (necesita sesiones reales de `@seba_qa` y de una cuenta común, y una sesión de Vercel porque el preview de Staging está tras Vercel Authentication): negativos 401/403, concordancia de Usuarios/Partidos, headers/robots, presencia, iPhone/Android — lista exacta en `149_…` §7.4. **F4** (Activación, Comunidad —Grupos · Nivel · Ranking—, Uso/retención; **D8 confirmada: comparaciones con días completos, hasta ayer, y «hoy» parcial aparte**): implementada el 08/10/2026 (`04.37-h30`; alcance en `148_…` §11, resultado y checklist de Central en `149_…` §8). Reutiliza el backend (31 de los 49 KPIs ya existían), +6 KPIs `community.*` sin captura nueva y sin redeploy del Edge; **falta aplicar `20261008120000` en Staging y verificar**. **Lo más urgente de Metrics: la presencia diaria todavía NO se captura en Production** (decisiones D3 → D1, `148_…` §11.5).

**Staging h28 (08/10/2026, NO promovido; invisible):** BRAMU Metrics V1 F1 — la app registra, de forma best-effort, un día de presencia por jugador (`register_app_presence`, solo al reanudar sesión real y al volver a primer plano; sin cambios visibles ni de lógica deportiva). Requiere la migración `20261008100000` aplicada por Central; hasta entonces la llamada falla en silencio. F2 (núcleo protegido de métricas + Edge `admin-metrics`) vive solo en `supabase/`. Detalle y checklist de Central: `Implementacion/Post_Lanzamiento/149_Resultado_Metrics_V1_F1_F2_08OCT.md`.

---

## 4. Reglas de orden

- **Poda.** Un handoff, plan, revisión, gate, hotfix o resultado **consumido** se retira del árbol cuando su contenido ya está en la fuente maestra (o en el registro de rondas). Git es la memoria histórica: `git log --diff-filter=D --name-only -- docs/` y luego `git show <commit>^:<ruta>`. No existen `Archivo/` ni `Backup/` en el repositorio. Los comentarios del código que citan `docs/BRAMUlab/<Documento>.md` se refieren al mismo documento, hoy dentro de `Producto/`, `Operacion/`, `Metrics/` o `Identidad_Visual/` (se encuentra por nombre); **no se editan por eso** (tocar `bramulab/` dispara builds).
- **Raíz de `docs/BRAMUlab/`:** solo `README.md`, `Metodo_Trabajo.md` y las carpetas de la tabla de arriba (lo verifica `node docs/check-docs.mjs`). Un documento nuevo va a la carpeta de su función; no se agregan documentos sueltos en la raíz.
- **Dropbox** (originales de diseño, referencias visuales y material privado no versionado): `Metodo_Trabajo.md`, «Higiene documental».

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

- **“Nivel BRAMU”** → este README + `Producto/Nivel_BRAMU.md`.
- **“Ranking”** → `Producto/Ranking_BRAMU.md` + `Nivel_BRAMU.md` solo donde Ranking dependa de Nivel.
- **“Grupos / Race / puntos de grupo”** → `Producto/Grupos_BRAMU.md`.
- **“Partidos: cargar / validar / corregir / historial”** → `Producto/Cargar_Partido.md` + `Producto/Experiencia_Inicial.md` (+ `Operacion/Backend_Infraestructura.md` solo para el contrato server-side).
- **“Experiencia inicial / Estado Cero / invitados”** → `Producto/Experiencia_Inicial.md`.
- **“BRAMU Intelligence”** → `Producto/BRAMU_Intelligence.md` + `BRAMU_Intelligence_Implementacion.md`.
- **“Emails / comunicaciones”** → `Producto/Comunicaciones_Emails.md`.
- **“BRAMU Metrics / métricas / dashboard admin”** → `Metrics/README.md` → `Metrics/BRAMU_Metrics.md` + `BRAMU_Metrics_Auditoria_Tecnica_V1.md` + el plan `Implementacion/Post_Lanzamiento/148_…` (estado: ver `149_…`; Production no autorizada).
- **“Backend / producción / cuentas reales / staging”** → `Operacion/Backend_Infraestructura.md` + la sección del bloque en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`; operación y deploy: `Operacion/Runbook_Operacion_y_Salida.md` y `Operacion/Operacion_Vercel_Staging_Production.md`.
- **“Privacidad / legal / AAIP / eliminación de cuenta”** → `Operacion/Privacidad_Legal.md` + la sección «Production» de `Operacion/Operacion_Vercel_Staging_Production.md`.
- **“Identidad visual / logo / marca”** → `Identidad_Visual/Identidad_Visual.md` (+ `Marca/`).
- **“BRAMUlive”** → `../BRAMUlive/BRAMUlive.md`.
- **“Qué falta / ideas futuras / riesgos conocidos”** → `Producto/BRAMUlab_Backlog.md` y `Operacion/Pre_Production.md` §2.
- **“Qué pasó en una versión anterior”** → `Versiones/README.md` y luego `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
