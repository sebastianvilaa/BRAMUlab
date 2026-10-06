# 143 — Resultado · V04.37 · Actividad histórica + Evolución real del Nivel + movimiento en Race

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Base:** `f8e03b3` · **Versión:** BRAMUlab **V04.37 / bundle 04.37-h1**  
**SHA final:** el del commit que contiene este archivo (se informa al cerrar la ronda).  
**Migración PENDIENTE de aplicar en Supabase Staging (la aplica/verifica Central):** `supabase/migrations/20261006300000_v0437_level_evolution.sql` (solo agrega una función de lectura; sin cambios de tablas ni de datos).  
**No tocado:** `main`, Production, BRAMUlive, fórmulas/motor de Nivel, `PH.computeLevelEvolution` (sigue siendo solo legacy), Ranking BRAMU, puntuación/top 2/bonus/Americano de Grupos, Anular carga, identidad visual, Auth. Hardening 139 intacto (el navegador sigue sin motor de Nivel).

---

## 1. Qué cambió

### A. Actividad histórica (Home)
- La tarjeta **ACTIVIDAD** es tocable (rol botón, teclado, chevron como Efectividad) y abre la pantalla **ACTIVIDAD** (`#view-activity`: back, bottom-nav, scroll vertical). **El resumen de 4 barras no cambió.**
- Una fila por semana lunes–domingo **con actividad oficial real**, de la más reciente a la más antigua: rango humano (`5 OCT — 11 OCT`; con año si cruza de año o no es el actual), jugados / ganados / perdidos, efectividad semanal (ganados ÷ jugados) y una barra apilada fina.
- **Misma verdad que el Home:** el detalle usa los partidos *computables* del jugador (`getHomeComputableMatches`, el mismo conjunto que recibe `renderPlayerActivity`) y el helper único `PH.classifyMatchForActivity` (semana lunes local + resultado) compartido con `computeActivityWeeks4`. Sin semanas vacías de relleno; fechas futuras/inválidas y pendientes no cuentan; sin actividad oficial no se abre un detalle vacío (Estado Cero igual que antes).

### B. Evolución REAL del Nivel (Mi Perfil)
- **Backend — RPC `get_my_level_evolution()`** (authenticated, self-only, sin parámetros; anon/public sin EXECUTE). **Fuente canónica = estado vigente, no la bitácora:** se inspeccionaron `level_events` (auditoría inmutable con reversiones y snapshots por operación: no se grafica), `match_level_results` y `match_level_result_players`. Se usan los resultados `applied` + `eligible` (máx. uno por partido) con la fila del propio jugador; el efecto de cada partido es `mu_after − original_live_mu_before` (exactamente lo que `officialize_match_validation` suma y `_bloque6_revert_applied_result` resta, C-01). Como los efectos son aditivos, la trayectoria se **ancla al Nivel actual**: `valor_k = mu_actual − Σ efectos vigentes + Σ_{i≤k} efecto_i`, en orden deportivo (`played_at`, `computed_at`). Resultado: **el último punto coincide siempre con el Nivel público actual**, una corrección deja un solo punto por partido (el vigente) y una anulación/identidad que revierte no deja ningún punto. El punto inicial es el valor base vigente, fechado en la estimación inicial (o en el primer partido si fue anterior).
- **Contrato mínimo:** `{ ok, available, currentLevel, points:[{at, level, matchId}] }` con valores **públicos de 1 decimal**. Nada de `mu` de 4 decimales, confianza, k, factores, expectativa ni deltas crudos. Sin evidencia (PENDIENTE o sin ningún resultado vigente con efecto) → `available:false` y el módulo se oculta completo.
- **Cliente:** `Auth.getMyLevelEvolution` (valida el contrato) → `PH.buildRealLevelEvolution` (pura) → misma tarjeta/gráfico que ya existía (`buildLevelEvolutionSvgHTML`): Nivel actual, **Cambio últimos 30 días**, **Mejor nivel BRAMU** (`ACT` o fecha) y la línea. Se relee al abrir Mi Perfil. **El gate legacy no se deshizo:** el camino V1 nunca llama a `PH.computeLevelEvolution` (test lo exige) y solo muestra la tarjeta si el último punto coincide con el Nivel público que muestra el resto de la app; si no hay serie real se comporta como antes (CALIBRANDO: progreso; CALIBRADO: tarjeta oculta). Badge `BETA` y nota de "regla de prueba" solo en el camino legacy.
- **BRAMU Intelligence longitudinal** (determinístico, sin LLM, sin causas), debajo del gráfico: (1) si el valor público cambió en 30 días → `En los últimos 30 días tu Nivel pasó de X a Y (↑/↓ Z).` (X = valor al cierre del día-30, o el punto inicial si la cuenta es más joven); (2) estabilidad solo con **≥ 3 eventos computables en la ventana y todos los valores públicos iguales** → `Tu Nivel se mantuvo en X durante tus últimos N partidos computables.`; (3) cualquier otro caso (pocas muestras, oscilaciones que terminan igual, nada en la ventana) → abstención.

### C. Race anual — movimiento
- `PG.computeRaceAnual(..., { beforeWeekStartMs })` (opcional; sin él, byte a byte igual) arma la Race **hasta el cierre de la semana BRAMU anterior**; `PG.annotateRaceMovement(actual, previa)` agrega `movement.delta` (puesto previo − actual) usando los puestos de competición `1,1,3` que ya traen las tablas, solo si el jugador tenía fila previa y el puesto cambió. Frontera = `PG.weekStartBA` (la de Grupos).
- UI: `↑ N` lima / `↓ N` rojo con las **mismas clases que Ranking** (`.ranking-row__movement is-up|is-down`). Primera semana, alta/reingreso sin fila previa o mismo puesto → nada; si nadie se movió la tabla queda idéntica; si alguien se movió se reserva la columna en todas las filas para no desalinear. Intelligence grupal sigue sobre la tabla base: ningún punto, top 2, bonus ni posición cambia.

### D. Versionado
`04.36-h2` → `04.37-h1` (`APP_VERSION`/`BUNDLE_VERSION`, `version.json`, `sw.js`, `?v=`, manifest) y los tests que lo fijan.

## 2. Tests

| Prueba | Resultado |
|---|---|
| **Nuevo** `supabase/functions/_shared/v0437-level-evolution.test.mjs` (Postgres real PGlite, todas las migraciones): serie anclada con último punto == Nivel público · sin evidencia (PENDIENTE/sin resultados/no elegible) · **anulación real** (`admin_annul_match`) sin punto fantasma · **corrección** (revertido + nuevo) con un solo punto · orden deportivo · self-only/aislamiento · ACL · contrato sin internals | **8/8** |
| **Nuevo** `bramulab/v0437-actividad-evolucion-race.test.mjs`: Actividad (orden desc, 1 partido 0/100 %, sin semanas vacías, futuro/inválido, años, **400 fixtures aleatorios: resumen de 4 semanas idéntico al de V04.36 y coincidente fila a fila con el detalle**, cableado) · Evolución (null sin evidencia, último==actual, mejor Nivel/cambio de la misma serie, Intelligence subida/bajada/estabilidad/abstención/oscilación, gate legacy, wrapper de red) · Race (primera semana, sube/baja/mantiene con empates 1,1,3, alta sin comparación, **tablas y Intelligence idénticas a V04.36**, cableado y estilo de Ranking) | **19/19** |
| Suite Node completa | **1064 tests · 1057 pass · 1 fail · 6 skip** (base 1037 · 1030 · 1 · 6) |
| `release-check.mjs` completo (replay limpio ×3 ACL con la migración nueva, auditoría de grants, ensayo operativo) | **PASS** |
| Navegador real sobre el `dist/` construido | pantalla Actividad (filas, barras, % y rangos) y tarjeta de Evolución con lectura de Intelligence se ven correctas |

Única falla: `h23` (test viejo contra el copy de V04.34), preexistente y ajena.

## 3. Qué no pudo verificarse
- **Migración no aplicada** en Staging real ni probada vía PostgREST/Auth reales (evidencia: PGlite sobre todas las migraciones + replay/ACL de `release-check`). La serie sobre datos reales de Staging (cuentas con resultados ya aplicados, recuperaciones de identidad) debe mirarse en el QA: el ancla garantiza coherencia del último punto, pero el punto inicial mostrado es el *valor base vigente* (coincide con la estimación inicial salvo ajustes/recuperaciones posteriores).
- **QA con sesión real:** tocar Actividad en el Home real, Mi Perfil con serie real, y Race con una sola semana (debe NO mostrar flechas). El movimiento ↑/↓ de la Race queda cubierto por tests determinísticos (no se fabricaron fixtures en Staging).
- Safari/iPhone: layout de la pantalla Actividad y de la columna de movimiento de Race.

## 4. Acciones externas para Central
1. Aplicar y verificar `20261006300000_v0437_level_evolution.sql` (no requiere redeploy de Edge Functions). Verificación sugerida: `select public.get_my_level_evolution()` con una cuenta calibrada → último punto == `round(mu,1)`.
2. QA humano mínimo (handoff 142 §8).

## 5. DECISIONES ABIERTAS
1. **CALIBRANDO con resultados reales:** hoy, si ya existe ≥ 1 resultado vigente, Mi Perfil muestra el gráfico real **junto con** el progreso de calibración (sin la nota de "primera referencia"). Alternativa: ocultar el gráfico hasta calibrar. El handoff pide ocultar "con evidencia insuficiente", no define CALIBRANDO.
2. **Formato de decimales en la lectura de Intelligence:** se usa punto (`5.8`, `↑ 0.2`) por coherencia con todo el Nivel de la app y con el copy existente de Intelligence; los ejemplos de `BRAMU_Intelligence.md` §18 usan coma. Cambiarlo es una línea en `PH.buildRealLevelEvolution`.
