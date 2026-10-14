# BRAMUlab — documentación activa

Este README es el **punto de entrada y mapa de autoridad documental** de BRAMUlab. Empezar acá y leer **solo la fuente maestra del sistema involucrado**. El índice del repositorio completo está en [`../../INDICE.md`](../../INDICE.md); BRAMUlive tiene su propia carpeta (`docs/BRAMUlive/`) y no se mezcla.

## Cómo está organizada la documentación

| Carpeta | Qué contiene | Qué es |
|---|---|---|
| **`README.md`** y **`Metodo_Trabajo.md`** (esta carpeta) | Estado vigente y reglas de trabajo, commits, pruebas, deploys y orden documental | Entrada |
| **[`Producto/`](Producto/)** | Qué hace BRAMUlab: Nivel, Ranking, Grupos, Cargar partido, Experiencia inicial (ciclo de partido, historial, invitados), BRAMU Intelligence, Emails y el Backlog | **Fuentes maestras** |
| **[`Metrics/`](Metrics/)** | BRAMUlab Metrics (consola administrativa privada, **publicada y aprobada**) | Fuentes maestras de Metrics |
| **[`Operacion/`](Operacion/)** | Backend e infraestructura, operación y runbook, Vercel/Production, privacidad y legal, salida a Production | **Fuentes maestras** |
| **[`Identidad_Visual/`](Identidad_Visual/)** | Identidad visual y `Marca/` (SVG maestros que usa la app) | **Fuente maestra** |
| **[`Implementacion/`](Implementacion/)** | Evidencia técnica que todavía se justifica conservar (cierres de Backend, seguridad, ensayos operativos, emails G1) | Evidencia |
| **[`Versiones/`](Versiones/)** | Historia: mapa histórico consolidado + registro por versión | Trazabilidad |
| **[`Auditorias/`](Auditorias/)** | Estudio de convergencia Nivel/Ranking con sus simulaciones (scripts que importan el motor de `bramulab/`, por eso no se mueven) | Estudio vigente |

---

## 14/10/2026 — V04.41 → V04.44 · Invitación a jugadores sin cuenta (Staging; sin publicar)

Pop-up corto con **microhistoria** del partido real (cargado → invitación compartida → recuperado), `ENVIAR POR WHATSAPP` + «Compartir de otra manera», mensaje único aprobado, enlace corto (mismo token en base64url) y tarjeta de vista previa con el partido real. Versión visible simple: **V04.44** (sin sufijos `h1/h2`; V04.43 = ícono de WhatsApp + tarjeta recompuesta; V04.44 = transición legible de la animación y logotipo proporcionado en la tarjeta). La vista previa pública la sirve el servicio auxiliar `bramu-i` (carpeta `bramulab-invite/`; Staging está protegido). Dirección definitiva decidida: `bramulab.com/invitacion/{código}` (pendiente de publicar). **Production, `main` y BRAMUlive intactos.** Fuentes: `Producto/Experiencia_Inicial.md` §30; `Operacion/Backend_Infraestructura.md` §9.2; `Operacion/Privacidad_Legal.md` §21; `Operacion/Operacion_Vercel_Staging_Production.md` («Servicio auxiliar `bramu-i`»).

---

## 14/10/2026 — BRAMUlab Metrics: nueva UX/UI PUBLICADA en Production

Con autorización expresa se publicó el commit `425fc5b` en Vercel Production (`dpl_FfSp5UGuhQaxfqaTsuaVfNbS58HP`, READY, alias `app.bramulab.com` verificado): Inicio prioriza registrados, activos y partidos cargados con Hoy parcial + 7 días completos; ícono, Web y controles simplificados. Sin cambios de backend, Supabase, `main` ni BRAMUlive. **Revisión visual y funcional en Production aprobada expresamente por Sebastián («listo quedó ok»).** Comparación independiente de hashes HTTP no verificada desde esta sesión. Detalle y reversión: `Metrics/BRAMU_Metrics.md`.

---

## 14/10/2026 — BRAMU Metrics Web ACTIVO en Production (estado vigente)

**Autorizado por Sebastián.** Mide solo **visitas a `bramulab.com`** (cada apertura, recargas incluidas; no son personas únicas) y **clics hacia la entrada de `app.bramulab.com`** (`/` o `/index.html`; Términos y Privacidad no cuentan), como contadores diarios agregados en `public.web_analytics_daily`, sin IP, cookies, IDs ni historial individual. No cambia nada de cuentas, jugadores, partidos, Nivel ni Ranking.

**Qué se hizo en Production (14/10/2026):**
- **Supabase Production** (`bgnnnfbdywefftvoqiss`): migración `20261013220000_web_public_daily_analytics` aplicada en una transacción (tabla con RLS, `anon`/`authenticated` sin acceso, RPC solo `service_role`; registrada en `schema_migrations`). Antes y después: 8 perfiles, 3 partidos, 1 administrador. Edge Function `admin-metrics` **v2** (`verify_jwt=true`): el código de Production era idéntico a `a7456908` y solo se agregó la ruta `web → metrics_web`; sin sesión responde 401.
- **App (proyecto Vercel `bramulab`)**: hotfix administrativo sobre `04.40-h3` (commit `a7456908`), deployment `dpl_EgQRqW8zFqx1FPZmvEXX9KmqNaSq`, alias `app.bramulab.com`. **Solo dos archivos cambiaron**: `admin/metrics/metrics.js` (pestaña «Web», commit `13b3c8c`) y `privacidad/index.html` (información sobre la medición web). De 31 archivos servidos, los demás conservan el mismo hash. La versión sigue siendo `04.40-h3`. Se desplegó desde una copia del commit por la CLI de Vercel (sin push ni merge a `main`).
- **Web (proyecto Vercel `bramulab-web`)**: variables **solo de servidor** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_METRICS_ALLOWED_ORIGIN=https://bramulab.com` (Production; no hay valores en archivos ni en el chat); `web-metrics.js` v1.1 activado en `bramulab.com`, deployment `dpl_emRfBF96jkFZNPFCnApuiPpm2JBm`. Antes, el lanzamiento de la web fue `dpl_4v5EbqYZKBeRTU5HzBiL9qA4dvgb`.

**Inicio de la medición:** 14/10/2026 (la primera fila de `web_analytics_daily` es de ese día, hora de Buenos Aires).

**Prueba real:** una visita y un clic al CTA del hero desde `bramulab.com`, más un clic en «Términos» (no contó). Resultado en Production: 1 vista (`page`) y 1 clic (`hero`) del 14/10; `metrics_web` los devuelve como «hoy parcial». **Esos dos eventos de prueba quedan incluidos en el contador** (no se borraron).

**Lectura desde el panel (verificada el 14/10/2026 con sesión de administrador):** la pestaña «Web» renderiza; los períodos 7/30/90 días terminan ayer y hoy muestran 0, y «Hoy · parcial» mostró **4 visitas · 1 clic**, igual a la tabla de Production (`view/page` = 4, `click/hero` = 1). Las 3 visitas adicionales a la de la prueba provienen de otras aperturas de `bramulab.com` durante la verificación (no se pueden atribuir a personas); todo el conteo del 14/10 incluye esas aperturas de prueba.

**Pendiente / decisión abierta:** la actualización informativa de la Política (misma versión `legal_v2`, sin reaceptación) fue evaluada internamente como cambio no material; **la validación legal humana y, si corresponde, la regularización ante la AAIP siguen abiertas** (ver `Operacion/Privacidad_Legal.md` §20).

---

## 13/10/2026 — Hotfix de homónimos `04.40-h3` PUBLICADO en Production (estado vigente)

Se corrigió el selector de compañero/rivales en Cargar partido: una coincidencia exacta de nombre con una cuenta registrada **o una identidad provisional** no oculta «Agregar a “nombre”». Si ya existe otra persona con ese nombre, la acción identifica «Otra persona sin cuenta». Se conserva la selección por `player_id`, sin fusionar identidades ni asignar dos lugares al mismo `player_id`. Cinco pruebas de regresión ejecutadas satisfactoriamente contra el código de Staging; backend de creación provisional inspeccionado en **Staging y Production** (siempre crea un UUID; sin matching por nombre). Sin migraciones ni escrituras en bases de datos.

**Release exacta:** BRAMUlab V04.40 / `04.40-h3`, commit `a74569081a5b08db9659a37c824ca3b763d2b816`, deployment Vercel Production `dpl_C94TxYd6QSr6tHx4dSZeZ7nmbZNK` **READY**, alias `app.bramulab.com` verificado; Staging independiente `dpl_BfNRhP7A5QcWJhd4JKpQhCQXyeYX` **READY**. La verificación es funcional con dobles controlados y de infraestructura; no se ejecutó un recorrido interactivo real de iPhone/Production. `main` y BRAMUlive sin cambios. Fuente maestra: `Producto/Cargar_Partido.md` §2.2.

---

## 11/10/2026 — Hotfix `04.40-h2` PUBLICADO en Production (antecedente histórico)

Con autorización del responsable, se corrigió en frontend la escritura de `@usuario`: las mayúsculas se convierten inmediatamente a minúsculas en los campos editables del registro y de edición local, conservando el cursor. Los borradores de alta anteriores se normalizan antes de oficializar. Los caracteres inválidos, nombres reservados y duplicados siguen bloqueados; el `@usuario` de cuentas reales continúa fijo tras registrarse. **Sin cambio de esquema, fórmula deportiva, datos reales ni identidad ya consolidada.** Se verificó la función pura de normalización, sus reglas básicas de formato/colisiones y el build de Staging `READY`. **Frontend Production `04.40-h2`:** SHA exacto `e1b22230c22ae4b8b1ee39e6ab5354e1ba4a8762`, deployment Vercel `dpl_4SQXhpmtKoWkFtikSFcwPUwvaSoK` `READY`, alias `app.bramulab.com` comprobado. Staging separado en `dpl_Fx2h3e9cLMm5MaZd69WJq9m9h6BK`. No se realizó una nueva prueba de navegador real; no hay cambios en `main`, Supabase, BRAMUlive ni en la Política. Contrato vigente: `Operacion/Backend_Infraestructura.md` §5.2.

---

## 10/10/2026 — V04.40 PUBLICADA en Production (antecedente histórico)

Con autorización expresa de Sebastián, se publicó BRAMUlab **V04.40 / bundle `04.40-h1`** desde SHA de código **`e5d3e6a60e2ff4dd9aa1b4259350afdb2d6f9677`** (incluye la aclaración informativa en Política `legal_v2`). Deployment Vercel Production **`dpl_FXFXcfkp92KMNNWBikhPiZc6BPZm`** READY y alias **`app.bramulab.com`** verificado. En Supabase **Production** se aplicó la migración **`discovery_get_player_discovery`**; acceso a RPC exclusivamente para `authenticated`, nunca `anon`; 7 jugadores y 1 partido preservados en verificación. Sin nueva aceptación legal, sin modificación de `main` ni BRAMUlive. Staging mantiene alias independiente. La compatibilidad exacta de la finalidad con la constancia AAIP sigue pendiente de cotejo documental; no presentar el trámite como aprobado. Fuente maestra: `Operacion/Privacidad_Legal.md` §19.

---

## 09/10/2026 — Hotfix de aperturas `04.38-h6` en Production (antecedente histórico)

Con autorización explícita del responsable se publicó **solo** el hotfix `04.38-h6`, SHA exacto `0dcb55a9fc0bcfc4e6e26b7c5648a46065e5954e`, deployment Vercel `dpl_DCSuFLGFSnbNKAuzQjxFP4zCfg3c` READY y alias `app.bramulab.com` verificado. Soluciona el throttle local de 30 min aplicado erróneamente aunque fallara el registro de aperturas. Se verificaron **7 cuentas reales conservadas**, `legal_v2` vigente y captura `activity_capture_enabled=TRUE`. Ya existe **1 apertura real del 09/10/2026** registrada antes del hotfix. Staging permanece aislado; `main`, BRAMUlive, Supabase schema y AAIP sin cambios por este hotfix. Ver fuente maestra `Metrics/BRAMU_Metrics.md` sección «Hotfix 04.38-h6 PUBLICADO en Production».

---

## 09/10/2026 04:24 AR — Nueva actualización de Production (prevalece sobre estado anterior)

**BRAMU Metrics: captura de aperturas activada expresamente por el responsable en Production**. Config: `legal_version=legal_v2`, `activity_consent_version=activity_v1`, `activity_capture_enabled=TRUE`. Misma versión de frontend `04.38-h5`; siete cuentas preservadas; al activar, una única cuenta había aceptado legal_v2 y 0 filas de actividad. Captura SOLO desde nuevas aperturas de cuentas con aceptación registrada, nunca retroactiva. **Advertencia:** queda pendiente regularizar la discrepancia ante AAIP entre declaración de consentimiento opcional y aceptación legal obligatoria con posibilidad de retirar autorización. No afirmar que la AAIP ya aprobó. En caso de observación u orden formal sobre esta captura, el switch `activity_capture_enabled=FALSE` permite desactivarla sin tocar otras funcionalidades. Fuente maestra: `Metrics/BRAMU_Metrics.md` (apartado de 04:24 AR). `main`, BRAMUlive y frontend no se tocaron con la activación.

---

## 1. Estado actual (09/10/2026)

**ACTUALIZACIÓN VIGENTE — prevalece sobre la tabla histórica inmediatamente inferior:** Production está en `04.38-h5` desde el 09/10/2026, publicación autorizada por el responsable, deployment Vercel `dpl_AteeNe6fyRSD9pnJ3uYAp9wa26Wn` desde SHA `c6c72f0d32dc4c5180d82411d51bbed68d4caf73`. Los documentos legales `legal_v2` están vigentes: nuevos usuarios aceptan la casilla única al registrarse, los siete existentes deben reaceptar una sola vez cuando vuelvan a entrar. **BRAMU Metrics sigue accesible exclusivamente para el administrador, pero el registro de aperturas de usuarios continúa APAGADO:** `activity_consent_version=activity_v1` y `activity_capture_enabled=FALSE` (dos conceptos distintos). Se registran las nuevas aceptaciones, no las aperturas. Los siete registros y las aceptaciones `legal_v1` permanecen intactos. El backend aplicó las cuatro migraciones `20261009030000` a `20261009033000` en Production. El trámite AAIP original y su ampliación están presentados, no aprobados. **La validez de hacer obligatoria la aceptación para analítica de uso identificable continúa pendiente de resolución, no habilitar captura sin nueva autorización y fundamento legal.** Fuente maestra y checklist: `Metrics/BRAMU_Metrics.md` sección «Publicación legal_v2 en Production» y `Operacion/Privacidad_Legal.md` §18. Staging continúa aislado; `main` y BRAMUlive intactos.

### Registro anterior (08/10/2026; conservar para trazabilidad)


| Frente | Estado |
|---|---|
| **Producto** | BRAMUlab **V04.37**. Backend Bloques 1–8, Pre-Bloque 9, 9A/9B, G1–G3 y todos los frentes P0 de salida **cerrados**. |
| **Production** | **ACTIVA**, V04.40 / `04.40-h3` publicada el 13/10/2026, deployment `dpl_C94TxYd6QSr6tHx4dSZeZ7nmbZNK` desde SHA `a7456908` (14/10/2026: hotfix administrativo `dpl_EgQRqW8zFqx1FPZmvEXX9KmqNaSq` con pestaña Web de Metrics y Política actualizada, ver arriba); homónimos en Cargar partido. Privacidad y seguimiento AAIP: `Operacion/Privacidad_Legal.md` §19. |
| **Staging** | **V04.40 / bundle `04.40-h3`**: normalización de @usuario y hotfix de homónimos publicados; build READY y alias independiente. Próximos cambios siguen naciendo en Staging. |
| **Pendientes reales** | Seguimiento del expediente AAIP, smoke humano mínimo de Production, decisión de backups (G4), QA humano de la fecha de nacimiento en Android, y el frente independiente de repositorio público/GitHub Pages. Detalle: `Operacion/Pre_Production.md` §2. Ideas futuras y riesgos conocidos: `Producto/BRAMUlab_Backlog.md`. |
| **BRAMUlab Metrics** | **CERRADO** — publicado en Production y aprobado por Sebastián el 14/10/2026 (§3). |

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
| **BRAMUlab Metrics** | [`Metrics/BRAMU_Metrics.md`](Metrics/BRAMU_Metrics.md) y su cadena (§3) | Cerrada: publicada y aprobada (14/10/2026) |
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

## 3. BRAMUlab Metrics — CERRADO (publicado y aprobado el 14/10/2026)

Consola administrativa privada de BRAMUlab. Sus documentos están juntos en [`Metrics/`](Metrics/) (índice propio: [`Metrics/README.md`](Metrics/README.md)); el plan y el resultado de implementación (`148_*`, `149_*`) **permanecen en `Implementacion/Post_Lanzamiento/`** porque el código los cita por esa ruta. **Estado vigente: publicado en Production y aprobado por Sebastián (commit `425fc5b`, `dpl_FfSp5UGuhQaxfqaTsuaVfNbS58HP`; ver la sección del 14/10/2026 arriba).** Ya no está «en desarrollo»: los cambios futuros nacen en Staging con las reglas normales. Se conservan sus documentos, pruebas (`bramulab/metrics-*.test.mjs`) y referencias técnicas (el código cita `148_*`/`149_*` por ruta).

- BRAMUlab Metrics (consola privada `/admin/metrics`; F1–F4 y F6 implementadas; promovida a Production y aprobada el 14/10/2026): `Metrics/BRAMU_Metrics.md` (producto; marco en `BRAMU_Metrics_UX_V1.md`, `_Privacidad_V1.md` y `_Comparaciones_V1.md`) → `BRAMU_Metrics_Auditoria_V1.md` → `BRAMU_Metrics_Auditoria_Tecnica_V1.md` (fuentes, definiciones, consultas validadas) → `Implementacion/Post_Lanzamiento/148_Plan_Implementacion_BRAMU_Metrics_V1_08OCT.md` (arquitectura y fases).

**Antecedente (08/10/2026, Staging; superado: Metrics se publicó y aprobó el 14/10/2026 — los pendientes que siguen eran de ese momento, no actuales):** F1 presencia, F2 núcleo protegido, F3 consola, **F4** (Activación, Comunidad —Grupos · Nivel · Ranking—, Uso; **D8: comparaciones con días completos, hasta ayer, y «hoy» parcial aparte**) y **F6 Explorar** (selector de los 55 indicadores, series fiables y filtros declarados con k = 5 en SQL) implementadas. F4 aplicada y verificada por Central; **F6 (bundle `04.37-h31`, migración `20261008130000`) falta aplicar en Staging y redeployar `admin-metrics`**. Diseño y fases: `148_…` §11–§12; resultado y checklist de Central: `149_…` §7–§10. **Pendientes de ejecución humana** (sesiones reales de `@seba_qa` y de una cuenta común, y de Vercel porque Staging está tras Vercel Authentication): negativos 401/403 con token válido, headers/robots, presencia, iPhone/Android (`149_…` §7.4; los 401 sin credenciales ya se comprobaron). **Lo más urgente: la presencia diaria todavía NO se captura en Production** (decisiones D3 → D1). **Salida a Production preparada, NO ejecutada** (procedimiento y retiro: `Operacion/Runbook_Operacion_y_Salida.md` Parte D; evidencia, riesgos y decisiones: `149_…` §12). Cambios de bundle por ronda: `Metrics/README.md`.

---

## 4. Reglas de orden

- **Poda.** Un handoff, plan, revisión, gate, hotfix o resultado **consumido** se retira del árbol cuando su contenido ya está en la fuente maestra (o en el registro de rondas). Git es la memoria histórica: `git log --diff-filter=D --name-only -- docs/` y luego `git show <commit>^:<ruta>`. No existen `Archivo/` ni `Backup/` en el repositorio. Los comentarios del código que citan `docs/BRAMUlab/<Documento>.md` se refieren al mismo documento, hoy dentro de `Producto/`, `Operacion/`, `Metrics/` o `Identidad_Visual/` (se encuentra por nombre); **no se editan por eso** (tocar `bramulab/` dispara builds).
- **Raíz de `docs/BRAMUlab/`:** solo `README.md`, `Metodo_Trabajo.md` y las carpetas de la tabla de arriba (lo verifica `node docs/check-docs.mjs`). Un documento nuevo va a la carpeta de su función; no se agregan documentos sueltos en la raíz.
- **Dropbox** (originales de diseño, referencias visuales, material privado no versionado y `Trabajo en curso/` para coordinar agentes sin pasar por Git): `Metodo_Trabajo.md`, «Higiene documental» y «Espacio compartido de coordinación».

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
- **“BRAMU Metrics / métricas / dashboard admin”** → `Metrics/README.md` → `Metrics/BRAMU_Metrics.md` + `BRAMU_Metrics_Auditoria_Tecnica_V1.md` + el plan `Implementacion/Post_Lanzamiento/148_…` (publicado en Production y aprobado el 14/10/2026; `149_…` = evidencia histórica).
- **“Backend / producción / cuentas reales / staging”** → `Operacion/Backend_Infraestructura.md` + la sección del bloque en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`; operación y deploy: `Operacion/Runbook_Operacion_y_Salida.md` y `Operacion/Operacion_Vercel_Staging_Production.md`.
- **“Privacidad / legal / AAIP / eliminación de cuenta”** → `Operacion/Privacidad_Legal.md` + la sección «Production» de `Operacion/Operacion_Vercel_Staging_Production.md`.
- **“Identidad visual / logo / marca”** → `Identidad_Visual/Identidad_Visual.md` (+ `Marca/`).
- **“BRAMUlive”** → `../BRAMUlive/BRAMUlive.md`.
- **“Qué falta / ideas futuras / riesgos conocidos”** → `Producto/BRAMUlab_Backlog.md` y `Operacion/Pre_Production.md` §2.
- **“Qué pasó en una versión anterior”** → `Versiones/README.md` y luego `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
