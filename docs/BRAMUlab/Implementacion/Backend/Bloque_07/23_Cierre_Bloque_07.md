# Backend Bloque 7 — Cierre formal

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**HEAD funcional final validado:** `44727e61d9d50cedd29c30211fd3a6e43391666e`  
**Bundle final:** `04.10-h22`  
**Suite final:** **1478/1478**  
**Estado:** **CERRADO en Staging**

## 1. Alcance cerrado

Backend Bloque 7 deja operativo Ranking BRAMU V1 real, semanal y server-backed sobre los datos persistentes de Staging.

Quedó implementado y validado:

- snapshot semanal inmutable;
- cutoff y calendario en `America/Argentina/Buenos_Aires`;
- cálculo atómico e idempotente;
- elegibilidad por cuenta real, Nivel, rama, ubicación y opt-in;
- ámbitos Local / Provincia / País / Global / Mi red;
- densidad territorial y empates con competition ranking;
- movimiento semanal contra la edición inmediatamente anterior;
- Mi red as-of-cutoff con ocultar/restaurar personal;
- lectura autenticada mediante RPCs;
- publicación automática semanal con `pg_cron`;
- frontend real conectado a backend;
- retiro del fallback productivo a mocks;
- gate de datos de Ranking;
- Perfil y Home consumiendo datos reales de Ranking;
- estados vacíos honestos.

## 2. Fases 1–4

Las cuatro fases backend quedaron aplicadas y validadas en Supabase Staging antes de conectar el frontend:

1. esquema, contratos y hardening;
2. cálculo de edición semanal;
3. RPCs de lectura;
4. publicación automática.

El job vigente es:

- `bramu_weekly_ranking_publish`;
- `5 3 * * 1`;
- lunes 00:05 de Buenos Aires;
- `select public.publish_current_ranking_edition();`.

Las validaciones de estas fases usaron rollback cuando correspondía y no dejaron ediciones/fixtures QA persistentes.

## 3. Fase 5 — frontend real

Fase 5 conectó la pantalla de Ranking a los contratos server-side reales.

Antes de QA final se corrigieron:

- preservación de `country_code`, `georef_province_id` y `georef_locality_id` al completar el gate;
- orden visual correcto: shell de Ranking detrás y overlay bloqueante delante;
- `AHORA NO` vuelve a Home y nunca deja Ranking interactuable con datos obligatorios incompletos.

La preservación GeoRef fue revalidada directamente contra Supabase Staging con rollback antes de la QA de navegador.

## 4. QA real de navegador

QA final ejecutada sobre:

- HEAD servido: `44727e61d9d50cedd29c30211fd3a6e43391666e`;
- bundle servido: `04.10-h22`.

Resultado:

- **A — Confirmación de deploy: PASS**;
- **B — Gate de datos: PASS**;
- **C — Guardado real: PASS**;
- **D — Ranking server-backed: PASS**;
- **E — Regresiones mínimas: PASS**.

Guardado validado:

- rama: Masculina;
- localidad: Bella Vista, Buenos Aires;
- participación en Ranking: activa;
- persistencia correcta tras recargar;
- el gate no reapareció.

Ranking real:

- ámbitos, rama, filtro de Nivel, búsqueda, Mi red y perfiles funcionan;
- Staging devuelve el estado vacío real `0 jugadores elegibles`;
- no aparecen nombres mock ni puestos fabricados.

Regresión mínima:

- Home ↔ Ranking;
- Volver;
- ayuda;
- cierre de overlays;
- TU MOMENTO en estado vacío correcto.

Consola/red: ningún error originado por BRAMUlab ni fallo funcional de RPC/red.

Conclusión de QA:

**FASE 5 QA PASS — BLOQUE 7 APTO PARA CIERRE**

## 5. Limpieza

No se crearon fixtures independientes ni ediciones QA persistentes durante la QA final de navegador.

La actualización del perfil de la cuenta utilizada para QA se conserva: es un estado válido del propio flujo de Ranking y no un fixture transitorio.

No se requiere limpieza adicional de Bloque 7.

## 6. Decisión

Los criterios de terminado de Bloque 7 están cubiertos y no quedan bloqueos funcionales abiertos.

**Backend Bloque 7 queda formalmente CERRADO en Staging.**

El siguiente bloque del roadmap es:

**Bloque 8 — BRAMU Intelligence V1.**

## 7. Entornos

- `staging`: validado;
- `main`: NO tocado;
- Production: NO tocada;
- BRAMUlive: NO tocado.
