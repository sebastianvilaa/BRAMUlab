# BRAMUlab — Handoff de continuidad de chat

**Fecha:** 22/09/2026  
**Repositorio:** `sebastianvilaa/BRAMUlab`  
**Rama activa:** `staging`  
**HEAD funcional actualmente desplegado en BRAMUlab Preview:** `44727e61d9d50cedd29c30211fd3a6e43391666e`  
**Estado general:** Backend Bloques 1–6 cerrados. Bloque 7 (Ranking real semanal) en tramo final: backend Fases 1–4 cerrado/aplicado; frontend Fase 5 implementado y corregido; falta QA real de navegador de Ranking y, si pasa, cierre formal de Bloque 7.

---

## 1. Cómo trabajar con Sebastián

Sebastián es diseñador gráfico, no programador.

Su aporte principal debe estar en:

- producto;
- lógica;
- UX/UI;
- diseño;
- evaluación visual;
- decisiones.

Los agentes deben absorber la mayor cantidad posible de ejecución técnica.

Reglas operativas:

- máxima autonomía;
- mínima intervención manual del usuario;
- no pedir comandos si un agente puede ejecutarlos;
- no pedir navegación manual por Supabase/Vercel si puede automatizarse;
- no pedir capturas repetitivas si Work/navegador puede validar;
- no repetir pruebas equivalentes sin riesgo concreto;
- cuando haya una decisión humana real, explicarla en lenguaje de producto;
- si no bloquea, seguir y marcarla como `DECISIÓN ABIERTA`;
- para tareas medianas/grandes, consolidar primero contexto en repo y después dar un prompt corto al siguiente agente.

Roles preferidos:

- ChatGPT central: coordinación, producto, arquitectura, revisión, GitHub, Supabase, documentación, decisión de pruebas.
- Claude Code: implementación técnica larga, migraciones, debugging, tests.
- ChatGPT Work: navegador/GUI/Vercel/QA visual real.
- Sebastián: decisiones y evaluación final.

Claude Code por defecto:

- **Sonnet 5 + Extra**.
- No hacer elegir modelo tarea por tarea.
- Reusar chat si sigue el mismo subsistema y el contexto está cómodo.
- Abrir chat nuevo cuando cambia materialmente el bloque/problema o el contexto ya está saturado.
- El usuario informó que la cuota semanal de Claude llevaba ~62% consumida el martes por la noche y resetea el domingo a las 06:00. No bajar calidad por eso, pero evitar vueltas redundantes, investigaciones repetidas y tareas que ChatGPT central pueda absorber.

Convención útil:

- “ya se lo pasé” = Claude arrancó;
- “Claude terminó” = Claude terminó la tarea y central debe verificar GitHub antes de asumir nada.

---

## 2. Fuente de verdad

Leer SIEMPRE primero:

`docs/BRAMUlab/README.md`

Después:

`docs/BRAMUlab/Metodo_Trabajo.md`

Y únicamente la fuente maestra del sistema afectado.

Backend:

`docs/BRAMUlab/Backend_Infraestructura.md`

Informe actual:

`docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`

Ranking:

`docs/BRAMUlab/Ranking_BRAMU.md`

Nivel:

`docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`

Intelligence:

`docs/BRAMUlab/BRAMU_Intelligence.md`

NO usar como autoridad:

- `Archivo/`;
- `Backup/`;
- handoffs históricos ya consumidos.

Solo consultarlos por trazabilidad puntual.

---

## 3. Principios de producto que no se reabren

BRAMUlab es una app de pádel amateur.

Valor central:

- identidad de jugadores;
- carga de partidos ya jugados;
- historial compartido;
- Nivel BRAMU;
- Ranking BRAMU;
- BRAMU Intelligence.

BRAMUlab y BRAMUlive son productos separados.

- BRAMUlab: jugadores, partidos ya jugados, historial, validación, Nivel, Ranking, perfiles, Intelligence.
- BRAMUlive: marcador y seguimiento en vivo.

NO volver a introducir marcador en vivo dentro de BRAMUlab.

No monetización/ads/planes/comercialización todavía.

No inventar datos ni estadísticas.

Nivel y Ranking son distintos:

- Nivel = estimación dinámica de capacidad;
- Ranking = posición competitiva semanal publicada dentro de un universo elegible.

No existe una cohorte “piloto”.

Testing = Staging + Sebastián + usuarios/partidos sintéticos y descartables.

Cuando entra el primer usuario real en Production, BRAMU ya empezó y sus datos son permanentes.

---

## 4. Entornos

Desarrollo activo:

- rama: `staging`;
- Supabase: `bramulab-staging`;
- project ref: `serxtivkfnptzurnvewg`;
- región: sa-east-1.

NO tocar:

- `main`;
- Production;
- BRAMUlive;

salvo autorización explícita.

Production Supabase todavía no existe.

---

## 5. Estado de Backend por bloques

### Bloque 1 — Fundación / entornos
**CERRADO.**

### Bloque 2 — Auth / perfil / username / ubicación / recuperación
**CERRADO.**

### Bloque 3 — Nivel productivo
**CERRADO.**

### Bloque 4 — Jugadores / búsqueda / invitados
**CERRADO.**

### Bloque 5 — Partidos / historial
**CERRADO.**

### Bloque 6 — Validación / actualización oficial
**CERRADO.**

Incluye backend, frontend, QA real de navegador, correcciones de identidad, propuestas de corrección, estado derivado y limpieza de fixtures.

Bundle funcional final de B6:

`04.10-h19`

### Bloque 7 — Ranking real semanal
**EN CURSO — tramo final.**

Backend Fases 1–4 cerrado/aplicado.

Frontend Fase 5 implementado, corregido y con un último ajuste central del gate.

Falta únicamente:

1. QA real de navegador contra Staging;
2. correcciones focales si la QA encuentra un bug real;
3. cierre formal/documental de Bloque 7.

Después:

### Bloque 8 — BRAMU Intelligence V1
**PENDIENTE.**

### Bloque 9 — Hardening + salida
**PENDIENTE.**

---

## 6. Bloque 7 — decisiones cerradas de Ranking

Ranking V1:

- semanal;
- lunes 00:00:00 → domingo 23:59:59;
- timezone: `America/Argentina/Buenos_Aires`;
- nueva edición lógica al lunes 00:00 usando estado consolidado al cierre del domingo;
- late validation/correction afecta la edición futura, nunca reescribe una publicada;
- edición histórica inmutable.

Orden:

1. Nivel interno consolidado exacto descendente;
2. empates exactos comparten puesto;
3. competition ranking `1,1,3`;
4. ID estable solo orden técnico, no desempate visible.

Solo cuentas reales elegibles ocupan posición.

Provisionales no tienen puesto.

Elegibilidad:

- `CALIBRADO`;
- `RECALIBRANDO` usa último Nivel consolidado;
- `CALIBRANDO` no tiene puesto;
- localidad/rama/opt-in incompletos bloquean la posición y abren gate.

Densidad territorial:

- 0–4: sin posiciones;
- 5–14: en formación;
- 15+: establecido.

Scopes:

- Local;
- Provincia;
- País;
- Global;
- Mi red.

Masculino/Femenino son clasificaciones separadas.

Nivel 1–10 es filtro server-side, no ranking separado.

Mi red:

- propio usuario + jugadores registrados con partido computable compartido en los 180 días anteriores al cutoff de edición;
- estable durante la semana;
- selector M/F;
- 1–2 elegibles: comparación sin puesto;
- 3+: puestos;
- ocultar/restaurar es presentación personal y no modifica Ranking oficial.

No implementar en V1:

- Explorar rankings arbitrarios;
- Ranking de Grupos;
- Race;
- matchmaking;
- puntos propios.

---

## 7. Bloque 7 — Fase 1 cerrada

Fase 1 aplicó y validó en Supabase Staging:

- `ranking_editions`;
- `ranking_rows`;
- `location_change_events`;
- `profiles.location_effective_from`;
- `players.ranking_excluded`;
- `complete_ranking_profile_data(...)`;
- RLS deny-by-default;
- tablas históricas append-only;
- cooldown de ubicación;
- auditoría de cambios;
- seguridad SECURITY DEFINER;
- constraints de snapshot.

Se detectaron y corrigieron antes de aplicar:

- PUBLIC EXECUTE por defecto;
- UPDATE/DELETE heredado por service_role;
- bypass de ubicación vía `complete_profile`;
- falta de `FOR UPDATE`;
- constraints débiles;
- unicidad insuficiente.

Fase 1 quedó aplicada y validada en Staging.

---

## 8. Bloque 7 — Fase 2 cerrada

Fase 2 implementó y validó:

- `ranking_profile_events` append-only para rama/opt-in as-of-cutoff;
- helper de Nivel as-of;
- `compute_ranking_edition(cutoff)`;
- snapshot semanal atómico/idempotente;
- ramas M/F separadas;
- RECALIBRANDO = último Nivel consolidado + actividad computable real;
- Global auditable;
- candidatos sin ubicación conservados como no elegibles;
- densidad/empates;
- motivos de no elegibilidad.

Prueba real con los 7 perfiles registrados actuales:

- 7 filas Global no elegibles;
- 0 territoriales;
- motivos reales `location_missing` / `competitive_branch_missing`.

Sin fixtures persistentes.

---

## 9. Bloque 7 — Fase 3 cerrada

RPCs de lectura reales aplicadas y validadas:

- `get_current_ranking_edition()`;
- `get_ranking_classification(...)`;
- `get_my_ranking_position(...)`;
- `get_ranking_network(...)`;
- `set_ranking_network_hidden(...)`;
- `get_profile_ranking_summary(...)`;
- `get_home_ranking_insight()`.

También:

- `ranking_network_hidden`;
- búsqueda/paginación;
- movimiento semanal;
- scope propio resuelto server-side;
- filtros de Nivel server-side;
- Mi red as-of-cutoff;
- hiddenRows para restaurar;
- Perfil/Home;
- no exposición de `level_internal`.

Correcciones absorbidas por central antes de aplicar:

- migración no compilaba por nombre `position`;
- firmas `smallint`;
- Mi red cortaba una semana antes;
- mezcla potencial de ramas;
- falta de hiddenRows;
- movimiento faltante por fila;
- comparación contra una edición vieja no inmediatamente anterior.

Fase 3 aplicada y validada en Staging.

---

## 10. Bloque 7 — Fase 4 cerrada

Publicación automática semanal aplicada.

Supabase Staging:

- `pg_cron 1.6.4` instalado;
- job: `bramu_weekly_ranking_publish`;
- schedule: `5 3 * * 1`;
- equivalente: lunes 00:05 Buenos Aires;
- comando:
  `select public.publish_current_ranking_edition();`;
- job activo;
- runtime/owner: `postgres`.

Wrapper:

`publish_current_ranking_edition()`

Calcula cutoff lógico lunes 00:00 BA y delega en `compute_ranking_edition`.

Runner de Fase 4 corregido por central:

- `period_start_at = cutoff - 7 días`;
- `period_end_at = cutoff - 1 microsegundo`.

Resultado:

`BLOQUE 7 FASE 4 OK — rollback limpio`

No quedó ninguna edición QA persistente.

---

## 11. Incidente Vercel — RESUELTO

Problema observado:

- commits que solo tocaban docs/supabase empezaron a fallar en Vercel;
- mail decía Deployment Failed;
- parecía rate limit.

Causa real confirmada por logs:

`fatal: bad object 98a548...`

El `ignoreCommand` usaba:

`VERCEL_GIT_PREVIOUS_SHA`

Ese SHA histórico podía no existir dentro del clon superficial que usa Vercel.

Corrección aplicada a:

- `bramulab/vercel.json`;
- `bramulive/vercel.json`.

Comando vigente:

`git diff --quiet HEAD^ HEAD ./`

Pruebas reales:

1. commit que tocó ambos `vercel.json`:
   - bramulab: SUCCESS;
   - bramulive: SUCCESS.

2. commit solo docs/supabase:
   - bramulab: `Canceled by Ignored Build Step`;
   - bramulive: `Canceled by Ignored Build Step`.

3. frontend Fase 5:
   - bramulab: Preview desplegado;
   - bramulive: `Canceled by Ignored Build Step`.

Pipeline Vercel queda considerado **RESUELTO**.

No volver a `VERCEL_GIT_PREVIOUS_SHA`.

---

## 12. Bloque 7 — Fase 5: frontend real

Claude implementó Fase 5 en:

`d7a15c064c2a6c1d3d464e8fb5ed0fcb661e936f`

Bundle inicial:

`04.10-h20`

Integró:

- pantalla Ranking server-backed;
- Local / Provincial / País / Global / Mi red;
- rama M/F;
- filtro de Nivel;
- búsqueda;
- Tu posición;
- movimiento;
- Global locked;
- Mi red hide/restore;
- Perfil;
- Home/TU MOMENTO;
- gate de datos;
- retiro del fallback productivo a mocks.

Suite:

`1471/1471`

La revisión central detectó dos problemas antes de QA real:

### F5-C01

La ubicación GeoRef existente perdía:

- country_code;
- georef_province_id;
- georef_locality_id;

al abrir/guardar el gate.

Eso podía degradar una ubicación verificada a manual/no verificada.

Central reprodujo el bug contra Supabase Staging con rollback:

`B7_F5_GEOREF_ID_LOSS_REPRODUCED_ROLLBACK_OK`

### F5-C02

El gate se abría antes de entrar a Ranking, contradiciendo `Ranking_BRAMU.md §13.7`.

Contrato correcto:

- shell de Ranking visible detrás;
- overlay bloqueante;
- primer paso simple;
- CTA “COMPLETAR DATOS”;
- segundo paso = formulario.

---

## 13. Fase 5 — corrección actual + ajuste central final

Claude corrigió F5-C01/F5-C02 en:

`e117a1823eccb72f90ce95b5af6ef58891369f48`

Después central detectó una inconsistencia UX adicional: `AHORA NO` cerraba el overlay pero dejaba Ranking interactuable aunque todavía faltaran datos obligatorios. Se corrigió en:

`44727e61d9d50cedd29c30211fd3a6e43391666e`

Comportamiento final del gate:

- Ranking se renderiza detrás;
- overlay simple bloquea la pantalla;
- `COMPLETAR DATOS` abre el formulario;
- `VOLVER` vuelve al paso simple sin guardar;
- `AHORA NO` sale de Ranking y vuelve a Home, por lo que nunca deja la clasificación accesible con datos incompletos;
- guardado correcto cierra overlay y permanece en Ranking.

Bundle actual:

`04.10-h22`

Tests:

`1478/1478`

Cambios principales:

### F5-C01

`fetchOwnProfile()` ahora conserva:

- `country_code`;
- `georef_province_id`;
- `georef_locality_id`.

`RK.buildGateLocationFromUser(user)` reconstruye:

- locality;
- region;
- country;
- provinceId;
- localityId.

Guardar solo rama/opt-in reenvía los IDs GeoRef originales.

Central ya verificó el contrato backend contra Supabase Staging dentro de rollback:

`B7_F5_GEOREF_PRESERVED_ROLLBACK_OK`

No quedó fixture.

### F5-C02

`openRankingScreen()` ahora:

1. renderiza Ranking;
2. muestra la vista;
3. recién después evalúa el gate;
4. overlay aparece encima.

Gate:

- paso 1: modal simple + `COMPLETAR DATOS` / `AHORA NO`;
- paso 2: formulario de rama/localidad/opt-in;
- guardar recachea perfil y refresca Ranking;
- volver/cancelar no persiste nada parcial.

### Bundle/service worker

Bump:

`04.10-h21`

`index.html` y `sw.js` en lockstep.

### Vercel del HEAD funcional actual

Para `44727e61...`:

- bramulab: **Deployment has completed**;
- bramulive: **Canceled by Ignored Build Step**.

Pipeline correcto.

Existe además el handoff específico para Work:

`docs/BRAMUlab/Implementacion/Backend/Bloque_07/22_Handoff_QA_Final_Fase_5_Work.md`

---

## 14. Estado EXACTO al cambiar de chat

HEAD funcional actualmente desplegado:

`44727e61d9d50cedd29c30211fd3a6e43391666e`

Rama:

`staging`

El HEAD de rama puede estar uno o más commits documentales por delante; esos commits deben quedar `Canceled by Ignored Build Step` y NO cambian el Preview funcional.

Bundle esperado en Preview:

`04.10-h22`

Tests reportados por Claude:

`1478/1478`

Validación central ya hecha después del commit:

- diff revisado;
- Vercel correcto;
- GeoRef preservado contra Supabase real con rollback:
  `B7_F5_GEOREF_PRESERVED_ROLLBACK_OK`.

**Todavía NO se hizo la QA real completa de navegador contra Staging del bundle `04.10-h22`.**

Ese es el próximo paso.

---

## 15. Próximo paso — NO REINVESTIGAR

No volver a Claude por defecto.

Primero hacer **QA real dirigida de Ranking en navegador** sobre el Preview funcional del HEAD:

`44727e61d9d50cedd29c30211fd3a6e43391666e`

Bundle esperado:

`04.10-h22`

Usar como guion operativo completo:

`docs/BRAMUlab/Implementacion/Backend/Bloque_07/22_Handoff_QA_Final_Fase_5_Work.md`

Preferencia:

**ChatGPT Work / navegador real.**

Objetivo de QA:

1. confirmar HEAD/bundle servido;
2. entrar con cuenta server-backed de Staging;
3. abrir Ranking;
4. validar gate:
   - Ranking visible detrás;
   - overlay simple primero;
   - CTA abre formulario;
   - guardar datos reales;
   - no degradar ubicación GeoRef;
5. validar pantalla real:
   - sin fallback a mocks;
   - estados vacíos honestos si no hay edición;
   - tabs/scopes;
   - rama;
   - filtro de Nivel;
   - búsqueda;
   - Tu posición;
   - Mi red;
   - ocultar/restaurar;
6. validar Perfil y Home donde Ranking ya consume RPC real;
7. revisar errores visuales/regresiones importantes;
8. evitar crear datos persistentes innecesarios.

Si QA encuentra un bug focal:

- central decide si lo absorbe directamente o vuelve a Claude;
- no abrir otra investigación grande.

Si QA pasa:

1. cierre formal Bloque 7;
2. actualizar README + Backend informe;
3. limpiar fixtures si se crearon;
4. preparar Bloque 8 — BRAMU Intelligence V1.

---

## 16. Qué NO hacer al retomar

- NO repetir auditoría grande de Ranking;
- NO rehacer Fases 1–4;
- NO volver a probar B6;
- NO tocar main;
- NO tocar Production;
- NO tocar BRAMUlive;
- NO crear mocks para “llenar” Ranking;
- NO inventar stats;
- NO empezar Intelligence antes de cerrar B7;
- NO pedirle a Sebastián que opere Supabase/Vercel manualmente si las herramientas pueden hacerlo.

---

## 17. Contexto de UX / producto para QA

BRAMU debe sentirse:

- deportiva;
- moderna;
- clara;
- visual;
- ágil;
- fácil de entender.

No debe sentirse:

- herramienta profesional compleja;
- planilla deportiva;
- app llena de números sin contexto.

En esta etapa importa que el jugador amateur:

- entienda qué está viendo;
- sienta utilidad real;
- quiera volver.

La QA visual de Ranking debe evaluar eso además de funcionalidad.

---

## 18. Resumen en una línea

**BRAMUlab está en Bloque 7 de 9; Ranking backend real semanal está cerrado hasta Fase 4, frontend real Fase 5 está implementado/corregido en `44727e61` / `04.10-h22`, GeoRef ya fue revalidado contra Supabase real y el próximo paso único es QA real de navegador para poder cerrar Bloque 7.**
