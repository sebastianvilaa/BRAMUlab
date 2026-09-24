# Pre-Production — Resultado P0.1 + Ranking automático — Claude Code

**Fecha:** 24 de septiembre de 2026
**Rama:** `staging`
**Handoff ejecutado:** `07_Handoff_P0_1_Ranking_Automatico_Claude.md` (reemplaza a `01_Handoff_P0_1_Estado_Cero_Claude.md`).
**Estado:** implementación completa, testeada localmente y pusheada a `origin/staging`. Sin `main` ni Production tocados.

---

## 1. Resumen de una línea

Home/Mi Perfil/Perfil público ocultan por completo los módulos estadísticos sin evidencia con 0 partidos oficiales (Estado Cero) y muestran/ocultan Racha+Partidos totales y Mejor compañero+Rival siempre en pareja (0/2/4, nunca 1/3); el gate de Ranking deja de pedir `ranking_opt_in` (participación automática) y `compute_ranking_edition` deja de excluir por ese motivo.

---

## 2. Archivos modificados

- `bramulab/app.js` — `renderPlayerActivity`, `renderPlayerEffectiveness`, `renderPlayerWidgets` (Home); bloque RENDIMIENTO de `renderProfileView` (Mi Perfil); bloque Efectividad/jugados-ganados/Mejor racha de `renderPlayerPublicProfile` (Perfil público, camino local/legacy); `rankingGateMissingFields`/`openRankingGateModal`/`submitRankingGateModal`/`initRankingGateModal` (gate de Ranking).
- `bramulab/index.html` — agrega `id` a la tarjeta de Actividad (`#player-home-activity-card`) y a la de Partidos totales (`#widget-total-card`) para poder ocultarlas; retira el switch "Quiero participar del Ranking BRAMU" del modal de gate de Ranking; bump de bundle en los `?v=`.
- `bramulab/sw.js` — bump de `CACHE_NAME`/`CORE_ASSETS` a `04.10-h27` (único bump de esta ronda).
- `supabase/tests/verify-bloque7-fase2.sql` — ajusta el fixture/assertions de `optout_1` y los denominadores dependientes a la nueva regla de participación automática.
- `supabase/migrations/20260924100000_bloque7_fase6_ranking_automatic_participation.sql` — **nuevo**. `CREATE OR REPLACE FUNCTION public.compute_ranking_edition` con el único cambio real: se retira el `case` que producía `'ranking_opt_in_false'`.
- Este informe.

No se tocó: fórmula de Nivel BRAMU, reglas de calibración, publicación semanal/densidad/ámbitos/filtros/snapshots históricos de Ranking, validación/corrección de partidos, BRAMU Intelligence, Auth, Legal/Privacidad, eliminación de cuenta, BRAMUlive, `main`, Production. `complete_ranking_profile_data` (la RPC que escribe `ranking_opt_in`) tampoco se tocó — ver §4.

---

## 3. P0.1 — Estado Cero y progresión (qué cambió exactamente)

### Home (`renderPlayerHome` → `renderPlayerActivity`/`renderPlayerEffectiveness`/`renderPlayerWidgets`)

- **Actividad** y **Efectividad**: cada una ahora oculta su tarjeta entera (`hidden = true`) cuando `matches.length === 0`, en vez de mostrar el donut apagado + `"Sin partidos considerados"` o la leyenda `"Sin partidos en las últimas 4 semanas"`. Con ≥1 partido oficial, ambas se muestran exactamente como antes (sin cambios de copy/animación).
- **Racha actual + Partidos totales**: pasan a ser una pareja explícita — ambas tarjetas se ocultan juntas con 0 partidos oficiales y aparecen juntas desde el primero (la racha en estado neutro `"—"` sigue siendo un dato real, no un placeholder).
- **Mejor compañero + Rival más enfrentado**: pasan a ocultarse **juntas** cada vez que cualquiera de las dos no tiene un resultado legítimo según su propia regla (`computeBestPartner`/`computeMostFrequentRival`, muestra mínima ya existente) — nunca más una tarjeta huérfana con `"Sin datos suficientes"`. Esto corrige el caso general de la regla de pareja (Experiencia_Inicial.md §5.3/§5.4), no solo Estado Cero: con 1 o 2 partidos, ambas quedan ocultas hasta que exista una comparación real.
- `renderPlayerLastMatchCard` (CTA "Cargar primer partido" vs. partido pendiente real) y `PH.buildTuMomentoText` (TU MOMENTO) **no se tocaron**: ya distinguían correctamente 0 cargados / 0 oficiales-con-pendiente / con historial, y ya tenían un camino de Estado Cero sin inventar evidencia (verificado leyendo el código, no hacía falta cambiarlo).
- El carrusel superior (`player-home-pending-banner`) ya se ocultaba por completo sin pendiente accionable — sin cambios.

### Mi Perfil (`renderProfileView`)

- Todo el bloque RENDIMIENTO (Efectividad + jugados/ganados + Racha actual + Mejor racha, contenedor único preexistente `#profile-kpis`) se oculta por completo con 0 partidos oficiales. Identidad, `@usuario`, Nivel BRAMU inicial/CALIBRANDO y la tarjeta RANKING BRAMU (que ya mostraba "Todavía sin posición oficial" sin inventar puesto) quedan fuera de ese contenedor y nunca se ocultan.
- Evolución del Nivel BRAMU ya mostraba CALIBRANDO en vez de un gráfico sin historial para cuentas nuevas (sin cambios; el fallback de texto vacío de cuentas legacy queda fuera de alcance de esta ronda, ver §7).

### Perfil público, camino local/legacy (`renderPlayerPublicProfile`)

- Efectividad + jugados/ganados (`#player-public-effectiveness-card`) y la fila Mejor racha/Mejor nivel BRAMU (`#player-public-performance-row`) se ocultan juntas con 0 partidos oficiales. Identidad/avatar, `@usuario`, Nivel BRAMU/CALIBRANDO y RANKING BRAMU quedan fuera y nunca se ocultan; RANKING BRAMU ya no inventaba posición (sin cambios).
- El camino server-backed (`renderPlayerPublicProfileServerBacked`) ya ocultaba estos mismos bloques de forma incondicional (todavía no hay historial oficial server-side wireado a `get_public_profile` — stub documentado desde antes de esta ronda, no una decisión de este handoff). Queda igual: satisface el requisito de Estado Cero por ahora, pero no es todavía un chequeo real de `matches.length` — nota para cuando ese wiring exista.

---

## 4. P0.1B — Qué se hizo con `ranking_opt_in`

Se trazó **cada uso real** de `ranking_opt_in`/`rankingOptIn` en frontend, RPCs, funciones SQL y tests antes de tocar nada.

### Frontend

- El modal de gate de Ranking (`index.html` + `app.js`) tenía un switch real "Quiero participar del Ranking BRAMU" (`#ranking-gate-optin-toggle`) — **se retiró por completo** (markup + variable de estado `rankingGateOptIn` + su prefill + su listener de click).
- `rankingGateMissingFields(user)` ya no chequea `rankingOptIn`: el gate solo pide **rama** y **localidad**.
- `submitRankingGateModal` ahora envía siempre `rankingOptIn: true` a `Auth.completeRankingProfileData` (antes enviaba el estado del switch retirado).
- No existía ningún otro lugar en `app.js` que leyera `rankingOptIn` para decidir algo (verificado por grep completo); `buildServerSelfStatus` solo lo mencionaba en un comentario defensivo sin rama real de código — queda igual, ahora ese código muerto es aún más inalcanzable porque el SQL ya no produce ese reason_code.

### `complete_ranking_profile_data` (RPC que escribe `profiles.ranking_opt_in`) — **sin cambios, a propósito**

Sigue exigiendo `p_ranking_opt_in` no nulo y sigue escribiendo lo que reciba. Se evaluaron dos opciones:

- **Opción A (elegida):** el frontend simplemente deja de ofrecer un control y siempre manda `true`. Cero cambios de SQL, cero riesgo sobre una firma ya validada tres veces en Staging.
- **Opción B (no elegida):** relajar la RPC (`default true`, quitar el `raise` de nulo). Técnicamente correcta pero toca una función crítica sin necesidad real.

El handoff pide explícitamente "preferir compatibilidad segura sobre ruptura de firma salvo que exista una razón concreta y testeada" — no apareció esa razón, así que se tomó la Opción A. Marco esto como el único juicio técnico propio de la ronda, no como una decisión humana pendiente: es reversible y no bloquea nada.

### `compute_ranking_edition` (elegibilidad real, la función que sí decidía exclusión)

Única función que efectivamente excluía por `ranking_opt_in=false` (línea `(case when competitive_branch is not null and not coalesce(ranking_opt_in, false) then 'ranking_opt_in_false' end)` dentro del cálculo de `reason_codes`). La nueva migración la reemplaza completa vía `CREATE OR REPLACE` porque plpgsql no permite parchear una sola línea de un cuerpo existente — **verificado con `diff` línea por línea contra la versión de Fase 2** que el único cambio funcional real es la eliminación de ese `case`; todo lo demás (candidatos, ubicación, rama, 180 días de inactividad, densidad, desbloqueo Global, RANK, unicidad de snapshot) es byte-idéntico.

`ranking_opt_in` sigue guardándose en la tabla temporal de candidatos (auditoría/histórico) y en `profiles`/`ranking_profile_events` — no se borró ni se migró destructivamente ninguna columna ni fila, tal como pide el handoff.

### Inmutabilidad de lo ya publicado

`compute_ranking_edition` solo hace `INSERT` (nunca `UPDATE`) sobre ediciones ya existentes — reemplazar la función no toca ninguna fila ya publicada. Un snapshot histórico con `'ranking_opt_in_false'` en `eligibility_reason_codes` queda exactamente como estaba; solo las ediciones calculadas **después** de aplicar esta migración dejan de producir ese motivo.

### Tests

- `supabase/tests/verify-bloque7-fase2.sql`: el fixture `optout_1` (única cuenta con `ranking_opt_in=false` en toda la batería) probaba antes que quedaba excluido — **se invirtió** la aserción para que ahora se espere elegible, y se corrigieron los tres denominadores que dependían de ese conteo (Bella Vista M: 2→3; Global M edición 1: 26→27; Global M edición 2: 27→28). El resto de las aserciones de esa misma corrida (Rosario, Córdoba, calibrando, recalibrando, inactividad, ubicación no verificada, rama faltante, cuenta excluida, idempotencia, inmutabilidad, desbloqueo Global por 2do país, seguridad/permisos) no dependían de opt-in y quedan intactas.
- `supabase/tests/verify-bloque7-fase1.sql` y `verify-bloque7-fase3.sql`: revisados completos — ninguno tiene un fixture de opt-out ni una aserción que dependa de la semántica vieja; no necesitaron cambios.
- `supabase/tests/diagnose-bloque2-user.mjs`: solo imprime `ranking_opt_in` como diagnóstico (no es una aserción) — sin cambios.

---

## 5. Migración SQL — **no aplicada a Supabase real** (bloqueo operativo, no decisión)

Esta sesión de Claude Code no tiene acceso a Supabase: no hay `psql`, CLI de Supabase ni variables de entorno/credenciales de conexión disponibles (mismo bloqueo estructural ya documentado en Bloque 7 Fase 4 — `17_Resultado_Fase_4_Claude.md §"Siguiente paso"`). Por lo tanto:

- `supabase/migrations/20260924100000_bloque7_fase6_ranking_automatic_participation.sql` quedó escrita, revisada por `diff` contra la función que reemplaza y lista para aplicarse, pero **nunca se ejecutó** contra Staging ni contra ningún Postgres real ni local.
- `supabase/tests/verify-bloque7-fase2.sql` quedó actualizada para reflejar el comportamiento esperado, pero tampoco pudo correrse (mismo motivo) — no hay evidencia de ejecución real de este archivo en esta ronda, solo revisión manual línea por línea del cambio.

**Acción manual pendiente** (para quien tenga acceso a Supabase Staging, típicamente ChatGPT central / Work, según `Metodo_Trabajo.md`):

1. aplicar `20260924100000_bloque7_fase6_ranking_automatic_participation.sql` en Staging;
2. correr `verify-bloque7-fase2.sql` completo (transacción con `ROLLBACK`, mismo patrón que el resto del archivo) y confirmar que pasa entero, en particular el bloque de `optout_1` y los tres totales ajustados;
3. si todo pasa, no hace falta ninguna acción de datos adicional — no hay backfill ni limpieza que ejecutar, la migración es puramente de lógica de elegibilidad hacia adelante.

Esto no es una `DECISIÓN ABIERTA` (no requiere criterio de producto de Sebastián): es una limitación de acceso técnico de esta sesión, igual que en rondas anteriores de Backend.

---

## 6. Tests ejecutados en esta sesión y resultados

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS**. Ninguno de estos módulos (`engine`, `stats`, `store`, `player-home`, `match-load`, `identity`, `groups`, `locations`, `ranking`, `auth`, `level*`, `intelligence-*`, `match-level-engine`, `env-guard`, `health`) fue tocado por esta ronda; corrida como regresión de control.
- `bramulab/tests.html` vía servidor estático local (sin Supabase configurado) → **1478/1478 PASS**, corrido dos veces (antes y después del bump de bundle).
- QA visual manual en el navegador embebido, contra el dev server local (sin backend real — cuentas locales/legacy efímeras, nunca tocan Supabase ni se pushean a ningún lado):
  - **Estado Cero, Home**: identidad + `CALIBRANDO · 0/5 PARTIDOS`, CTA `+ CARGAR PRIMER PARTIDO`, TU MOMENTO con el copy de Estado Cero, Buscar jugadores — confirmado que Actividad/Efectividad/la grilla completa de widgets (Racha/Total/Compañero/Rival) no se renderizan en absoluto.
  - **Estado Cero, Mi Perfil**: identidad + `@usuario` + Nivel CALIBRANDO + RANKING BRAMU "Todavía sin posición oficial" — confirmado que el bloque RENDIMIENTO completo no se renderiza.
  - **Estado Cero, Perfil público** (visto desde una segunda cuenta vía Buscar Jugadores): mismo patrón — identidad/Nivel/Ranking visibles, Efectividad/jugados-ganados/Mejor racha/Mejor nivel ausentes por completo, sin posición de Ranking inventada.
  - **Progresión con 1 partido oficial real** (cargado en la sesión): Actividad y Efectividad reaparecen con datos reales (100% · 1 de 1); Racha actual + Partidos totales reaparecen juntas (`1 · victoria seguida` / `1 · partido registrado`); Mejor compañero + Rival más enfrentado **permanecen ocultas** correctamente, porque con un solo partido ninguna de las dos tiene todavía una comparación legítima — confirma en vivo la regla 0/2/4 nunca 1/3.
  - **Gate de Ranking**: inspección de DOM confirmó que `#ranking-gate-optin-toggle` y el texto "Quiero participar del Ranking BRAMU" ya no existen en ningún lado del formulario del gate.
- No se pudo ejecutar QA de navegador contra Supabase/Vercel Staging real (fuera del alcance de acceso de esta sesión, igual que toda validación real de Staging en rondas anteriores — la ejecuta ChatGPT central/Work).

---

## 7. Observaciones que NO bloquean (no son `DECISIÓN ABIERTA`)

- `renderPlayerPublicProfileServerBacked` oculta Efectividad/rendimiento/Ranking/etc. de forma incondicional (stub previo a esta ronda, documentado desde antes: "mientras Bloque 5 no aporte historial oficial"). Hoy cumple el requisito de Estado Cero por construcción, pero el día que se conecte historial oficial real ahí, va a necesitar un chequeo real de `matches.length` en vez de un `hidden = true` fijo. No es parte del alcance de este handoff (que es de visibilidad/gate, no de wiring de datos server-side nuevos).
- Mi Perfil, cuentas `legacyMigrated` con 0 partidos: siguen cayendo en el placeholder de texto `"Todavía no hay partidos que muevan tu nivel — arranca en 5.0."` en vez de ocultar `Evolución`. Esto ya estaba así antes de esta ronda y corresponde a cuentas de prueba fabricadas, no al flujo real de alta de un usuario nuevo — no se tocó, consistente con el alcance P0.1 (Estado Cero real, no cuentas legacy de laboratorio).

---

## 8. Bundle final

`04.10-h27` (bump desde `04.10-h26`, único bump de esta ronda — `CACHE_NAME`/`CORE_ASSETS` en `sw.js` + todos los `?v=` de `index.html`). `Store.VERSION`/`version.json` siguen en `"BRAMUlab V04.10"` sin cambios, porque esto es una ronda de Backend/Infraestructura pre-Production, no una ronda nueva de Nivel BRAMU.

---

## 9. Commit

Un único commit lógico, autocontenido, incluye código + migración + test + este informe. Push final a `origin/staging`.

**Commit SHA:** el HEAD de `origin/staging` inmediatamente después de este push (este mismo commit — revisar `git log -1` sobre `origin/staging`, título `feat(preprod): P0.1 Estado Cero + P0.1B Ranking automático`).

---

## 10. Condición de finalización

- Implementación completa (P0.1 + P0.1B). ✅
- Tests focalizados corridos localmente: 255/255 (`node --test`) + 1478/1478 (`tests.html`). ✅
- QA visual manual de los tres Estado Cero + progresión 1 partido + gate sin opt-in, verificados en el navegador. ✅
- Staging real: **no aplicable desde esta sesión** — migración SQL y test SQL escritos y revisados, pendientes de aplicación/ejecución por quien tenga acceso a Supabase (§5). Bloqueo operativo explícito, no un pendiente silencioso.
- Commit final + push a `origin/staging`: ✅ (este commit).
- `DECISIÓN ABIERTA` real que haya bloqueado algo: **ninguna**. Un solo juicio técnico propio (Opción A sobre `complete_ranking_profile_data`, §4) documentado para que pueda revisarse, sin bloquear el resto.
