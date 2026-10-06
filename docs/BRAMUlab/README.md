# BRAMUlab — documentación activa

**Estado del producto:** BRAMUlab **V04.33 / bundle 04.33-h1** en `staging` (rediseño unificado de Recuperados + validación rápida + Partidos pendientes, implementado y probado; migración `20261005200000_v0433_recuperados_pendientes.sql` **APLICADA y verificada en Supabase Staging por Central**; V04.31/V04.32 quedaron con QA funcional PASS y V04.29 / 04.29-h2 sigue siendo cierre histórico válido). **Nivel BRAMU V1.3 está cerrado en Staging**: estimador inicial `nivel_inicial_v1_3` (cuestionario adaptativo de 5 preguntas con slider discreto, sin camino rápido), motor posterior de partidos `nivel_bramu_v1_0`, Edge Function `officialize-onboarding` ACTIVE v13 (JWT ON), QA técnico y QA humano en iPhone completados (03/10/2026). La ronda V04.29 de Invitados / Identidad / Recuperación está **CERRADA EN STAGING / PASS CENTRAL**. No está desplegado en Production. **`Nivel_BRAMU.md` es la única fuente maestra de Nivel.**

**Base estable anterior:** BRAMUlab **V03.10**  
**Suite técnica h21:** **365/365 Node + 1565/1565 tests.html**  
**Actualización documental:** 5 de octubre de 2026

Este README es el **mapa de autoridad documental** de BRAMUlab. Antes de investigar el árbol completo, desarrollo debe empezar acá y leer solo la fuente maestra del sistema involucrado.

`Metodo_Trabajo.md` es la guía operativa vigente para coordinación de agentes, commits, pruebas y deploys — leerla antes de coordinar una ronda de trabajo, no solo antes de programar.

**Ronda final de corrección post-QA humano — V04.34 propuesta (06/10/2026):** V04.33 pasó QA funcional real de recuperación automática, validación rápida y Recuperados, pero la revisión visual/flujo abrió un cierre acotado: `Partidos pendientes` pasa a pantalla propia fuera de Historial; se unifican jerarquías/CTAs, mi equipo verde+arriba, estados del Resumen, carrusel, modal `¿SOS X?`, Recuperados e Intelligence pendiente; además se corrige un bug importante de deduplicación para que una decisión explícita `ES OTRO PARTIDO` quede persistida y no reaparezca tras claim/recovery, y se adelanta el aviso de duplicado antes de cargar score sin quitar el gate backend final. Handoff: `Implementacion/Pre_Production/131_Handoff_Cierre_QA_V0433_Correccion_Final_V0434_06OCT.md`. Aún no implementado. Production sigue prohibida.

**Ronda activa pre-Production — V04.33 (05/10/2026, implementada + backend Staging verificado; pendiente QA humano corto):** rediseño unificado de **Recuperados + Partidos pendientes + validación rápida** (handoff `129_Handoff_Rediseno_Recuperados_Pendientes_V0433_05OCT.md`, resultado `130_Resultado_Rediseno_Recuperados_Pendientes_V0433_05OCT.md`). `SÍ, SOY YO` recupera automáticamente todos los partidos asociados (se eliminó la revisión obligatoria partido por partido); pantalla completa `RECUPERAMOS N PARTIDOS` con los accionables en validación rápida (`OMITIR` siempre disponible); `Historial > Recuperados` temporal (30 días, fijada por el servidor); componente único de validación rápida (`REPORTAR UN ERROR` / `VALIDAR PARTIDO`, feedback inline `✓ PARTIDO VALIDADO`); `Historial > Pendientes` en 3 secciones (`POR VALIDAR` / `POR RESOLVER` / `ESPERANDO VALIDACIÓN`) derivadas de la autoridad server-side; card `PARTIDOS PENDIENTES` en Home con 3 contadores; destacados superiores solo accionables; copy `JUGADOR POR IDENTIFICAR`; `¿SOS X?` muestra el partido que originó la invitación; notificación `RECUPERAMOS N PARTIDOS` para quien se vinculó. Backend mínimo y aditivo: `source_match_id` en el link, `preview_claim_link` con origen/@usuario/avatar, `get_my_recent_recoveries`, notificación `identity_recovered` (sin tocar Nivel, Ranking, Team A/B ni deduplicación). Production sigue prohibida.

**Ajustes visuales post QA de Recuperados (05/10/2026, superados por V04.33 en lo que toca a la revisión por partido):** BRAMUlab **V04.32 / 04.32-h1** (solo frontend, sin migraciones; commit `ffa5b08`): mi equipo en verde en el Resumen (solo presentación), `ESPERANDO VALIDACIÓN` y estados integrados en la card de Recuperados, botones alineados, `REPORTAR UN ERROR` como en el Resumen, cierre `TERMINAR REVISIÓN` y pulido del ✓/✕ de @usuario. Handoff `128_Handoff_Ajustes_Visuales_Post_QA_V0431_05OCT.md`. Pendiente QA humano mínimo.

**Ronda activa pre-Production — V04.31 en Staging (05/10/2026):** BRAMUlab **V04.31 / bundle 04.31-h1**. Corrige el alta nueva que saltaba `PARTIDOS RECUPERADOS`, nombres provisionales viejos en BRAMU Intelligence y aplica la UX de recuperados, `¿SOS X?`/`COPIAR INVITACIÓN`, @usuario, gate 3/4/5, notificaciones, Historial estado cero y **mínimo 1 cuenta por partido (1 + 3 sin cuenta, pendiente, sin auto-validar)**. La migración `20261005100000_v0431_post_qa_intelligence_names_claim_notification.sql` está **APLICADA en Supabase Staging** y `get-match-intelligence` quedó **ACTIVE v12**. QA humano del flujo crítico **PASS**: alta nueva desde invitación → `PARTIDOS RECUPERADOS`; dos recuperados (uno validado + uno pendiente); rama no accionable; rama accionable con `VALIDAR PARTIDO` en un paso; cierre y retorno a Home. Quedan solo ajustes visuales/semánticos acotados consolidados en `Implementacion/Pre_Production/128_Handoff_Ajustes_Visuales_Post_QA_V0431_05OCT.md`. Informe funcional: `Implementacion/Pre_Production/127_Resultado_Post_QA_Humano_V0431_05OCT.md`. Production sigue prohibida.
**Ronda activa pre-Production — correcciones del QA humano de Invitados (04/10/2026):** BRAMUlab **V04.30 / bundle 04.30-h2**. B1/B2/B3 y la UX asociada quedaron implementados; Central aplicó la migración en Supabase Staging y verificó B1/B2/B3 sobre el backend real. El gate posterior detectó C1/C2, corregidos en `5ab2606565239e54c6475ab7d0b75a466bc24bd8`; Central revisó el diff final y Vercel está SUCCESS. La suite final informada por Claude quedó en **924 tests · 915 pass · 3 fail preexistentes · 6 skipped**. **Gate técnico Central: PASS.** Solo queda el QA humano corto autenticado definido en Issue #29. DECISIONES ABIERTAS no bloqueantes en `Implementacion/Pre_Production/125_Resultado_Correcciones_QA_Invitados_04OCT.md`. No se declara cierre de Pre-Production ni se habilita Production.
**Ronda cerrada pre-Production — invitados/identidad (03/10/2026):** **V04.29 / 04.29-h2 CERRADA EN STAGING**. G3 + corrección forward-only G3b están aplicadas en Supabase Staging, `process-identity-recovery` ACTIVE v1, gate técnico Central PASS y flujo visual PASS para duplicado histórico con score distinto → SAME → corrección pendiente → rechazo desde la otra pareja → un partido efectivo y sin corrección pendiente. Los límites de consola/red e iPhone físico del QA 121 fueron aceptados explícitamente por Central como no bloqueantes para esta ronda; no implican cobertura que no existió y quedan documentados para trazabilidad. Evidencia: `Implementacion/Pre_Production/119_Resultado_Correccion_Gate_Invitados_V0429_h2_03OCT.md`, `120_Gate_Central_Tecnico_Invitados_V0429_h2_03OCT.md`, `121_QA_Visual_Invitados_V0429_h2_03OCT.md` y `122_Cierre_Central_Invitados_V0429_h2_03OCT.md`.
**Corte consolidado de Pre-Production (03/10/2026):** el estado vigente está resumido en `Pre_Production.md` y en `Implementacion/Pre_Production/123_Corte_Estado_PreProduction_03OCT.md`; el tracking único de salida es **Issue #28**. G1, G2, P0.3 e Invitados están cerrados en Staging. No hay otro módulo grande para construir antes de Production. Quedan dos QA residuales acotados (P0.1/P0.1B integrado y cierre humano de Grupos Issue #23) y, después, G3/G4 con datos legales dependientes de la Production real. No crear Production sin autorización explícita.


---

## 1. Qué está activo hoy

### BRAMUlab V04 — Nivel BRAMU

Nivel BRAMU V1.3 está **cerrado en Staging sobre BRAMUlab V04.29 / bundle 04.29-h2**.

Fuente maestra vigente:

- `Nivel_BRAMU.md` — definición funcional, fórmula vigente, estados, calibración/recalibración, motor de partidos, backend, UX y evidencia de cierre.

`Versiones/BRAMUlab_V04/` queda únicamente como trazabilidad histórica de las rondas de implementación. No es autoridad vigente para decidir cómo funciona Nivel.

### V03

V03 está **cerrada en V03.10**. No se reabre salvo regresión concreta.

- `Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md`
- `Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`

Los documentos históricos de V03 que todavía se conservan viven en `Archivo/BRAMUlab_V03/` y no son fuente activa. Los handoffs operativos consumidos se eliminan del árbol actual: Git conserva su historia.

### Backend / Infraestructura

Implementación en curso, por bloques, sobre `Backend_Infraestructura.md` (fuente maestra de decisiones). No usa la numeración `V04.x`: esa numeración es de Nivel BRAMU.

- `Backend_Infraestructura.md` — qué se decidió (arquitectura, modelo de datos, alcance por bloque).
- `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` — qué se implementó, testeó y qué acción manual falta, bloque por bloque.

**Bloque 1 (fundación de backend y entornos) está CERRADO**: verificado contra Supabase Staging y Vercel reales (health check y RLS deny-by-default confirmados en producción de Staging, 16/09/2026). El proyecto Supabase de Production todavía no existe; en Vercel se usa un único proyecto `bramulab`, con Preview/Staging sobre la rama `staging` y Production sobre `main`, con variables separadas por Environment.

**Bloque 2 (Auth, perfil, username, ubicación, recuperación) está CERRADO** (18/09/2026): validado de punta a punta contra Supabase Staging real y la app real de Staging, con una cuenta real — migración, RLS, trigger, RPCs, signup/confirmación, logout/login, segunda sesión limpia, recuperación de contraseña y username duplicado. Pusheado únicamente a la rama `staging`, nunca a `main`. Ver la sección "Bloque 2" de `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` para el detalle completo.

**Bloque 3 (Nivel productivo y persistente) está CERRADO** (19/09/2026): onboarding real con confirmación diferida, perfil mínimo, `level_states`/`level_events`, Edge Function `officialize-onboarding`, RPC privada, estimador inicial (entonces `nivel_inicial_v1_2`, reemplazado luego por `nivel_inicial_v1_3`: ver `Nivel_BRAMU.md`), confirmación final y anticipada, refresh/reanudación, idempotencia y paridad navegador/servidor quedaron validados contra Supabase/Vercel Staging real. La corrida final sobre HEAD funcional `7b24979a` dio **BLOQUE 2 OK**, **BLOQUE 3 OK** y **PARIDAD OK**. Ver `Implementacion/Backend/Bloque_03/12_Cierre_Bloque_03.md` y la sección "Bloque 3" de `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`.

Localidad y rama siguen sin bloquear Nivel/Home/primer partido y se piden recién al entrar a Ranking. Desde 24/09/2026 la participación en Ranking es automática al cumplir elegibilidad; `ranking_opt_in` queda como compatibilidad legacy.

**Bloque 4 (Jugadores, búsqueda e invitados provisionales) está CERRADO** (20/09/2026): búsqueda real autenticada, Perfil público server-backed, provisionales persistentes, link/claim de identidad, rate limiting y hardening de tablas server-only quedaron aplicados y validados contra Supabase/Vercel Staging real. La prueba manual final confirmó que un alta desde claim conserva exactamente el `player_id` provisional, el link es de un solo uso y el alta normal sin claim permanece independiente. Ver `Implementacion/Backend/Bloque_04/08_Validacion_Final_Staging.md` y `09_Cierre_Bloque_04.md`.

**Bloque 5 (Partidos e Historial) está CERRADO** (21/09/2026): modelo server-backed de partidos compartidos, create-or-attach, idempotencia/concurrencia, revisiones append-only, outbox/`sync_pending`, historial compartido, ocultamiento privado, nota privada, provisionales relacionadas y separación estricta entre partido visible y partido computable quedaron implementados y validados en Supabase/Vercel Staging real. La QA de navegador detectó y corrigió homónimos reales tratados como duplicados, `00:00` con hora desconocida, estado pendiente faltante en Último partido y copy Eliminar/Ocultar. Revalidación final dirigida: 4/4 PASS. Suite local final: **1448/1448**. Ver `Implementacion/Backend/Bloque_05/16_Cierre_Bloque_05.md`.

**Bloque 6 (Validación y actualización oficial) está CERRADO en Staging** (22/09/2026): backend/Fase A validado, frontend/Fase B conectado y QA real de navegador cerrada sobre `04.10-h19`. La revalidación final dio PASS en resolución de identidad, propuesta de corrección y regresión mínima; los fixtures de navegador fueron limpiados de Staging y los estados de Nivel afectados volvieron a su `initial_estimate`. Ver `Implementacion/Backend/Bloque_06/20_Cierre_Bloque_06.md`.

**Bloque 7 (Ranking real semanal) está CERRADO en Staging** (22/09/2026): Fases 1–4 backend quedaron aplicadas y validadas contra Supabase Staging real; Fase 5 conectó el frontend a los RPCs reales, retiró el fallback productivo a mocks y pasó QA real de navegador completa. HEAD funcional final validado: `44727e61d9d50cedd29c30211fd3a6e43391666e`; bundle: `04.10-h22`; suite: **1478/1478**. La QA A–E confirmó gate, guardado real, ámbitos/rama/filtro/búsqueda/Mi red/perfiles, estado vacío honesto sin edición y regresiones mínimas sin errores funcionales de consola/red. El job `bramu_weekly_ranking_publish` permanece activo los lunes 00:05 de Buenos Aires. Ver `Implementacion/Backend/Bloque_07/23_Cierre_Bloque_07.md`.

**Bloque 8 (BRAMU Intelligence V1) está CERRADO en Staging** (23/09/2026): Fases A–E quedaron implementadas y validadas de punta a punta con datos reales, persistencia auditable, memoria editorial cronológica, integración de Nivel oficial y hitos semanales materiales de Ranking. HEAD funcional final: `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec`; bundle: `04.10-h26`; Edge Function `get-match-intelligence` ACTIVE v2. La QA real validó pending → validación → oficialización → regeneración A+B+C+D+E sin datos inventados. F generativa queda opcional. Ver `Implementacion/Backend/Bloque_08/35_Cierre_Bloque_08.md`.

---

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

## 2. Fuentes maestras vigentes

| Sistema | Fuente maestra / precedencia | Estado |
|---|---|---|
| **Nivel BRAMU** | `Nivel_BRAMU.md` (única fuente maestra) | V1.3 CERRADO en Staging (V04.28 / 04.28-h7); pendiente de promoción a Production |
| **Ranking BRAMU** | `Ranking_BRAMU.md` | V1 de producto/UX + backend/frontend real CERRADOS en Staging; snapshot semanal server-backed, sin fallback a mocks |
| **Cargar partido** | `Cargar_Partido.md` | Fuente maestra del flujo (V04.24: modo resultado, Fecha/Hora/Lugar). |
| **Grupos BRAMU** | `Grupos_BRAMU.md` | Server-backed + QA integral base CERRADOS (Issue #6). V04.23 top 2/Americano implementado; queda únicamente QA humana final de ayuda/desglose V04.24 en Issue #23. |
| **BRAMU Intelligence** | `BRAMU_Intelligence.md` → `BRAMU_Intelligence_Implementacion.md` | Bloque 8 CERRADO en Staging: Fases A–E cerradas. Núcleo determinístico V1 completo; F generativa opcional y no bloqueante |
| **Experiencia inicial / ciclo de partido** | `Experiencia_Inicial.md` → `Backend_Infraestructura.md` para contrato técnico | Experiencia inicial cerrada; impacto inmediato en Bloque 3 y luego en Bloques 4–6 |
| **Backend / Infraestructura** | `Backend_Infraestructura.md` → `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Bloques 1–8 + Pre-Bloque 9 + 9A/9B CERRADOS en Staging; G1/G2 cerrados. Restan G3/G4 después de los QA residuales. |
| **Privacidad / Legal** | `Privacidad_Legal.md` → `Pre_Production.md` P0.2 | Núcleo técnico, G1/G2 y eliminación real cerrados en Staging. Pendiente cierre publicable con datos reales de Production/AAIP; el build de Production bloquea placeholders. |\n| **Pre-Production / salida** | `Pre_Production.md` → `Backend_Infraestructura.md` Bloque 9 | Corte vigente 03/10: QA residual P0.1/P0.1B + Issue #23; luego G3/G4 y cierre de placeholders legales dependientes de Production. |
| **Backlog futuro** | `BRAMUlab_Backlog.md` | Solo ideas realmente futuras/no autorizadas |

### Nivel BRAMU — fuente única

`Nivel_BRAMU.md` contiene toda la definición vigente: escala y estados, onboarding V1.3, fórmula inicial, calibración y recalibración, motor de partidos, confiabilidad, invitados, persistencia/versionado, UX, tratamiento de cuentas existentes y evidencia de cierre. No hay documentos de fórmula ni de implementación aparte.

- Estimador inicial: `nivel_inicial_v1_3` (`questionnaire_mode = full`).
- Motor de partidos: `nivel_bramu_v1_0`, sin cambios.
- Las cuentas V1.1/V1.2 existentes conservaron su Nivel; no se recalcularon.
- Los documentos de Nivel anteriores y los handoffs de V1.3 fueron retirados del árbol; su historia vive en Git.

### Ranking semanal

Ranking BRAMU vigente es **semanal**. Nivel puede cambiar partido a partido, pero la posición de Ranking cambia al publicarse una nueva edición semanal. Cualquier texto histórico de Intelligence que hable de movimiento de puesto “al procesar el evento actual” se interpreta bajo esta regla vigente.

---

## 3. Cómo se organiza `docs/BRAMUlab`

### Regla de poda documental

- `Implementacion/` contiene únicamente trabajo **activo** o evidencia/cierres que una fuente vigente todavía referencia.
- Un handoff, plan, revisión o hotfix consumido se elimina del árbol activo cuando su resultado ya quedó consolidado.
- Git es la fuente de trazabilidad histórica de esos archivos eliminados; no duplicar la historia en `Backup/`.
- `Archivo/` se reserva solo para antecedentes que todavía tengan valor documental concreto y nunca es autoridad normal.
- Antes de leer una carpeta completa, consultar el índice local de `Implementacion/` y la fuente maestra correspondiente.



### Raíz

Solo documentos que pueden ser necesarios para tomar decisiones actuales:

- este `README.md`;
- `Metodo_Trabajo.md` — guía operativa de coordinación de agentes, commits, pruebas y deploys;
- `BRAMUlab_Backlog.md`;
- `Experiencia_Inicial.md`;
- `Nivel_BRAMU.md` (fuente maestra de Nivel);
- `Ranking_BRAMU.md`;
- `Grupos_BRAMU.md`;
- `BRAMU_Intelligence.md` y su implementación;
- `Backend_Infraestructura.md`.

### `Versiones/`

Registro por versión mayor del producto. Cada versión consolidada usa principalmente:

- `..._Consolidado.md`: decisiones/pedidos;
- `..._Informe.md`: implementación real, pruebas y correcciones.

No usar el Informe entero como contexto por defecto si alcanza con una sección concreta.

### `Archivo/`

Antecedentes, documentos sustituidos, handoffs ya consumidos e informes diagnósticos preservados. **No son fuente activa** salvo pedido explícito de trazabilidad.

Incluye, entre otros:

- versiones antiguas de fórmulas de Nivel;
- handoffs ya implementados;
- documentación intermedia de V03/V04;
- `Archivo/Backend_Infraestructura/Backend_Infraestructura_Informe.md` como diagnóstico histórico.

### `Backup/`

Copias deliberadas de seguridad. No son fuentes normativas.

### `Referencias/`

Investigaciones, moodboards, auditorías visuales y material de contexto. Pueden fundamentar decisiones, pero no reemplazan una fuente maestra.

---

## 4. Regla de lectura para Claude Code / desarrollo

Para ahorrar contexto y evitar reabrir decisiones cerradas:

1. Leer este README.
2. Identificar el sistema afectado.
3. Leer únicamente su fuente maestra vigente.
4. Si hace falta implementación histórica, consultar la sección concreta del Consolidado/Informe de la versión correspondiente.
5. **No leer `Archivo/`, `Backup/`, Informes completos antiguos ni handoffs consumidos** salvo instrucción explícita.
6. No iniciar una auditoría general porque cambió una ruta o porque existe una referencia histórica.
7. Si aparece una contradicción material que las precedencias de este README no resuelven, reportarla antes de programar.

La reorganización documental del 15/09/2026 quedó registrada en:

`Archivo/BRAMUlab_Reorganizacion_Documental_2026-09-15.md`

---

## 5. Estado resumido de cada sistema

### Nivel BRAMU

**V1.3 cerrado en Staging.** Estimador inicial universal (`nivel_inicial_v1_3`): cinco preguntas adaptativas (panorama, ritmo, ataque, defensa, decisiones), slider discreto de 10 posiciones, resultado numérico + `CALIBRANDO`, sin camino rápido ni categoría local. Motor de partidos `nivel_bramu_v1_0` (expectativa, confiabilidad, repetición, círculo competitivo, invitados). Persistencia server-side (`level_states`/`level_events`) y oficialización atómica e idempotente vía la Edge Function `officialize-onboarding` + RPC privada, sobre el mismo archivo JS que usa el navegador. Validación de partidos, actualización partido a partido y correcciones cerradas en Backend Bloques 5–6. Pendiente: UI de recalibración y promoción a Production. Todo el detalle está en `Nivel_BRAMU.md`.

### Grupos BRAMU

La definición vigente vive en `Grupos_BRAMU.md`. La base V03.4 se conserva como implementación de referencia, pero Grupos deja de ser una función diferible: debe quedar server-backed y lista antes de abrir Production. La ronda no rediseña la experiencia ya resuelta; prioriza estado cero, ayuda, cierre de creación, identidad/avatar real y persistencia multiusuario.

### Ranking BRAMU

La definición vigente separa:

- Nivel = capacidad estimada dinámica;
- Ranking = posición semanal publicada dentro de un universo elegible.

El prototipo/simulación local de V03 fue retirado del camino real de Staging en Backend Bloque 7. Ranking consume RPCs server-backed, edición semanal publicada y estados vacíos honestos; no existe fallback productivo a mocks.

### BRAMU Intelligence

V1 está definida como motor selectivo de insights respaldados por evidencia y **forma parte del alcance previo a la primera salida productiva**. Se implementa después de contar con identidades, partidos, Nivel y Ranking reales, y antes del endurecimiento final de Producción.

La V1 debe poder funcionar completamente con núcleo determinístico + plantillas. La capa generativa es opcional, mejorable posteriormente y solo redacta claims ya calculados; no inventa datos ni decide Nivel/Ranking.

### Experiencia inicial y ciclo de partido

`Experiencia_Inicial.md` es la fuente activa para Home Estado Cero, pendientes accionables, validación por parejas, correcciones, `No participé`, identidades provisionales y progresión temprana.

Reglas de experiencia/ciclo cerradas al 18/09/2026:

- confirmación de email diferida hasta después de Perfil mínimo + estimador;
- Perfil mínimo antes de Nivel: nombre + apellido + `@usuario` + términos;
- localidad y rama se solicitan al entrar a Ranking, no antes; la participación en Ranking es automática al cumplir elegibilidad;
- BRAMUlab carga únicamente partidos propios ya jugados; no hay carga por espectador ni marcador en vivo dentro de esta app;
- carga retroactiva máxima: 14 días;
- pendiente nunca validado: 30 días desde la carga aceptada por servidor;
- corrección normal post-validación: 3 días;
- incidencia de identidad: hasta 10 días para abrirla + 7 días desde el reporte para identificar al jugador correcto;
- 5 pendientes accionables personales bloquean solo iniciar una nueva carga;
- offline: `sync_pending` local + reintento idempotente;
- doble carga del mismo encuentro: `create-or-attach` hacia un único `match_id` cuando la coincidencia es inequívoca;
- Ranking publicado nunca se reescribe por correcciones posteriores.

`Backend_Infraestructura.md` traduce estas reglas a servidor. No reabrir el viejo modelo `validar/rechazar`.

**Nota de alcance:** referencias históricas en fórmulas/Intelligence a partidos `observados` o cargados por espectador se consideran casos legacy/defensivos, no una función activa de BRAMUlab. Desarrollo no debe crear flujo de carga por espectador.

### Backend / Infraestructura

La dirección vigente prevé una infraestructura real y permanente, con separación Development/Staging/Production y backend basado en Supabase/Vercel según el documento maestro. **Bloques 1–8 están cerrados en Staging.** Los pendientes reales previos a Production quedaron consolidados en `Pre_Production.md`; cerrar primero sus P0 y después ejecutar **Bloque 9 — endurecimiento/salida**. No implementar desde antecedentes del Archivo.

---

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

## 7. Qué leer según el pedido

- **“Nivel BRAMU”** → este README + `Nivel_BRAMU.md` (y, solo si hace falta trazabilidad de una ronda, la sección concreta de `BRAMUlab_V04_Informe.md`).
- **“Ranking”** → `Ranking_BRAMU.md` + `Nivel_BRAMU.md` solo donde Ranking dependa de Nivel.
- **“Grupos / Race privada / puntos de grupo”** → `Grupos_BRAMU.md`.
- **“Cargar partido / ingreso de resultado / Fecha-Hora-Lugar”** → `Cargar_Partido.md`.
- **“BRAMU Intelligence”** → `BRAMU_Intelligence.md` + `BRAMU_Intelligence_Implementacion.md`.
- **“Experiencia inicial / validación / correcciones / pendientes / invitados”** → `Experiencia_Inicial.md` + `Backend_Infraestructura.md` solo para el contrato server-side.
- **“Backend / producción / cuentas reales / staging”** → `Backend_Infraestructura.md` + la sección del bloque correspondiente en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`.
- **“Qué falta / ideas futuras”** → `BRAMUlab_Backlog.md`.
- **“Qué pasó en una versión anterior”** → `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
