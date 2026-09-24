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


---

## 11. Revisión central posterior — 24/09/2026

### Ranking automático — backend real

ChatGPT central completó el pendiente operativo que Claude no podía ejecutar:

- migración `bloque7_fase6_ranking_automatic_participation` aplicada correctamente en Supabase **bramulab-staging**;
- registrada por Supabase como versión `20260924194826`;
- `supabase/tests/verify-bloque7-fase2.sql` ejecutado completo contra Staging;
- resultado: **PASS — `BLOQUE 7 FASE 2 (corrección F2-C01..F2-C07) OK — rollback limpio`**;
- no hubo backfill ni limpieza de datos;
- snapshots históricos permanecen intactos.

El advisor de seguridad posterior no mostró una regresión atribuible a esta migración. Los avisos existentes corresponden al modelo deny-by-default/RPC ya conocido y a advisories previos de Auth/SECURITY DEFINER.

### Hallazgo de revisión — Perfil público server-backed

P0.1 **todavía no se considera completamente cerrado**.

La rama real `renderPlayerPublicProfileServerBacked` sigue ocultando Efectividad y rendimiento de forma incondicional porque `get_public_profile` no entrega hoy el historial/agregados necesarios. Esto cumple Estado Cero, pero no cumple todavía la progresión definida para un jugador real con uno o más partidos oficiales.

Acción requerida antes de cerrar P0.1:

- resolver el camino server-backed con la mínima fuente real necesaria;
- no inventar métricas;
- no reconstruir estadísticas desde datos no autorizados;
- preservar Estado Cero con 0 oficiales;
- con evidencia oficial suficiente, mostrar únicamente los módulos respaldados por datos reales.

No reabrir Ranking automático: esa parte queda validada en backend real.

---

## 12. Corrección acotada — Perfil público server-backed (24/09/2026, ronda 2)

**No se tocó** Ranking automático, Nivel, BRAMU Intelligence, Auth (salvo lo estrictamente
necesario, ver más abajo), `main`, Production ni BRAMUlive.

### 12.1 Qué datos reales existían hoy (trazado antes de implementar)

- `matches`/`match_participants`/`match_sets` (Bloque 5) tienen el resultado estructurado de cada
  set, pero **nunca un "winner_team" persistido**: `deriveWinnerTeam` (`bramulab/match-sync.js`)
  lo calcula siempre client-side, a propósito, "para no tener una TERCERA copia de la regla de
  victoria" (comentario de cabecera de ese archivo). Reimplementar esa regla en SQL habría sido
  exactamente esa tercera/cuarta copia — se descartó esa vía.
- `match_level_results`/`match_level_result_players` (Bloque 6) sí tienen `margin`/
  `team_strength_a/b`, pero son estrictamente de Nivel (RLS deny-all, service_role, "no se
  reimplementa el motor acá"), excluyen partidos `eligible=false` (partido oficial sin efecto de
  Nivel) y no tienen un booleano ganó/perdió directo — no son una fuente completa ni segura para
  "partidos jugados/ganados" de rendimiento público.
- `officialize_match_validation` (núcleo único de oficialización, Bloque 6) **sí recibe**
  `localMatch.winnerTeam` ya calculado por el mismo motor compartido (`match-sync.js` vía symlink
  real en la Edge Function, `supabase/functions/_shared/match-officialize-core.ts`) en cada
  trigger, pero nunca lo persistía — se recalculaba y se descartaba en cada llamada.

### 12.2 Solución elegida (mínima, sin duplicar la regla de victoria)

Persistir ese mismo valor **ya calculado** en una columna nueva, escrita por el único lugar que
ya lo calcula, y consumirlo con un agregado nuevo y seguro (dos enteros, nunca partidos
individuales) en `get_public_profile`.

**Migración nueva:** `supabase/migrations/20260924110000_bloque6_public_match_outcomes.sql`.

1. `matches.winner_team` — columna nueva, nullable, `'A'|'B'`. NULL mientras el partido no está
   `validated`.
2. `officialize_match_validation` — `CREATE OR REPLACE` con un parámetro nuevo al final,
   `p_winner_team text default null` (compatible: un caller que no lo pase deja
   `matches.winner_team` intacto). Como Postgres identifica una función por su lista de TIPOS,
   agregar un parámetro crea un overload nuevo en vez de reemplazar el existente — se hizo
   `DROP FUNCTION` de la firma vieja (26 parámetros) primero, para no dejar dos versiones
   coexistiendo con permisos propios. El cuerpo es **idéntico** al de
   `20260921235700_bloque6_fix_applied_result_detection.sql` salvo dos inserciones puntuales
   (verificado con `diff` línea por línea antes de escribir el informe): el parámetro nuevo, y un
   `UPDATE public.matches SET winner_team = p_winner_team ...` que corre para los 4 triggers por
   igual (initial, correction_accepted, identity_resolved, identity_unidentified) — importante
   porque una corrección puede cambiar el resultado, así que `winner_team` se re-escribe siempre,
   nunca solo en la oficialización inicial (eso habría dejado el ganador desactualizado tras una
   corrección real).
3. `get_public_profile` — `CREATE OR REPLACE` (mismo motivo de DROP primero: cambia el tipo de
   retorno) agregando `matches_played integer, matches_won integer`: conteo de partidos
   `status='validated'` con `winner_team` ya resuelto en los que participó el jugador consultado,
   y cuántos ganó su equipo. Nunca devuelve `match_id`, fecha, rival ni ningún dato por partido —
   solo los dos conteos.

**Edge Function:** `supabase/functions/_shared/match-officialize-core.ts` — se agregó
`p_winner_team: localMatch.winnerTeam` a los `rpcParams` que ya se enviaban a
`officialize_match_validation`. Ningún otro archivo de Edge Functions se tocó.

**Frontend:** `bramulab/app.js` → `renderPlayerPublicProfileServerBacked` deja de ocultar
`#player-public-effectiveness-card` de forma incondicional: la revela cuando
`p.matches_played > 0`, calcula el % con `Math.round(matchesWon/matchesPlayed*100)` (la MISMA
fórmula que `PH.computeEffectivenessTotal`, nunca una segunda regla de redondeo) y reutiliza
`renderPlayerPublicEffectivenessDonut` — la misma función que ya usa el camino local/legacy, sin
segunda copia del donut. `bramulab/auth.js` no se tocó: `getPublicProfile` ya devolvía la fila
completa de la RPC sin allowlist de campos, así que los dos campos nuevos llegan solos.

### 12.3 Deliberadamente fuera de alcance (para mantener la corrección acotada)

- **Backfill de `winner_team`** para partidos `validated` **antes** de esta migración:
  reconstruirlo retroactivamente exigiría leer `match_sets` y aplicar el umbral de sets según
  `formatId` (classic=2 de 3, americano=1 de 1) — la misma regla que se decidió no duplicar en
  SQL, esta vez además como operación de datos. Esos partidos no cuentan todavía en
  Efectividad/jugados-ganados público hasta que se corrijan/reapliquen (lo que sí pasa por este
  camino nuevo) o hasta que se decida explícitamente un backfill aparte. Pre-Production: sin
  usuarios reales todavía, impacto práctico nulo hoy.
- **"Mejor racha"/"Mejor nivel BRAMU histórico"** en Perfil público server-backed: siguen ocultos
  (`#player-public-performance-row` permanece `hidden=true`). "Mejor racha" pediría un agregado de
  rachas más complejo sobre la misma fuente; "Mejor nivel BRAMU" (pico histórico) viviría en datos
  de Nivel (`level_events.result->>'muAfter'`), que se prefirió no tocar en esta corrección
  acotada. Ninguno de los dos estaba en el hallazgo original de la revisión central (que hablaba
  específicamente de "Efectividad y rendimiento").
- Edad, Mano/Lado ya seguían su propia regla (privados/reales) sin cambios.

### 12.4 Cobertura de riesgos pedidos

- **0 oficiales:** sin cambios de comportamiento — `matches_played=0` (columna nueva, agregado
  siempre en 0 sin filas) mantiene `#player-public-effectiveness-card` oculta.
- **1 oficial:** cubierto por el test nuevo (ver 12.5) y por el mecanismo — `matches_played=1`
  revela la tarjeta con el % real de ese único partido.
- **Varios oficiales:** cubierto por el test nuevo con 2 partidos + una corrección que cambia el
  ganador del primero, verificando que el agregado se recalcula correctamente (2 jugados/1 ganado
  para cada lado tras la corrección, no 2/2 y 2/0 desactualizados).
- **Pendientes no cuentan:** un tercer partido queda deliberadamente `pending_validation` (nunca
  oficializado) y el test verifica que el agregado sigue en 2, no en 3.
- **Privacidad:** `get_public_profile` sigue devolviendo una fila de columnas escalares — los dos
  campos nuevos son `integer`, nunca un array de partidos. Ningún `match_id`/fecha/rival de otro
  jugador se expone por esta vía.
- **Sin regresión en Ranking/Nivel/identidad:** el cuerpo de `officialize_match_validation` es
  idéntico al vigente salvo las dos inserciones ya descritas (verificado por `diff`); no se tocó
  ninguna columna, tabla ni regla de `level_states`/`level_events`/Ranking. Suite local completa
  corrida después del cambio: **255/255** (`node --test`) + **1478/1478** (`tests.html`), sin
  fallas nuevas. QA visual manual: el camino LOCAL/legacy de Perfil público (no tocado) se
  verificó en el navegador después del cambio, mostrando Efectividad/jugados-ganados/Mejor racha
  sin alteraciones (100%, 1/1, "1 victoria").

### 12.5 Test nuevo — no ejecutado desde esta sesión (mismo bloqueo operativo de siempre)

`supabase/tests/verify-bloque6-public-match-outcomes.sql` — transaccional (`BEGIN`/`ROLLBACK`),
sin depender de ninguna cuenta real preexistente en Staging (fabrica sus propios 2 jugadores).
Llama a `officialize_match_validation` **directamente por SQL** con parámetros nombrados
(`p_eligible := false` para no tocar `level_states`/Nivel en absoluto) — no depende de la Edge
Function ni de un JWT, porque esa RPC es `service_role`-only y no lee `auth.uid()`. Cubre:

1. partido 1 oficializado (`trigger=initial`, `p_winner_team='A'`) → `matches.winner_team='A'`;
2. partido 2 oficializado igual (mismos jugadores) → agregado A: jugó 2/ganó 2, B: jugó 2/ganó 0;
3. partido 3 queda `pending_validation` (nunca oficializado) → el agregado sigue en 2, no en 3;
4. corrección aceptada sobre el partido 1 (`trigger=correction_accepted`, `p_winner_team='B'`) →
   `winner_team` se actualiza a `'B'`, `current_revision_id` avanza, `pending_correction_revision_id`
   vuelve a NULL, y el agregado se recalcula correctamente (A: 2/1, B: 2/1) — prueba directamente
   que una corrección no deja `winner_team` desactualizado;
5. permisos/firmas: la firma vieja de 26 parámetros de `officialize_match_validation` ya no existe
   (confirma que el `DROP FUNCTION` de la migración corrió, no quedó un overload huérfano); la
   nueva de 27 sigue siendo exclusivamente `service_role`; `get_public_profile` sigue siendo
   exclusivamente `authenticated`.

**No cubierto por este archivo** (necesita sesión autenticada real): la llamada completa a
`get_public_profile(uuid)` a través de su propia RPC pública (depende de `auth.uid()`). El test
verifica la MISMA expresión de agregación que esa RPC usa —copiada literal del `LEFT JOIN
LATERAL` de la migración, no reinventada— directamente contra las tablas como `service_role`, para
no depender de fabricar una sesión/JWT ni de que ya exista una cuenta real en Staging. Sugerido
para quien aplique la migración: además de correr este archivo, abrir el Perfil público real de
una cuenta con 1+ partidos oficiales desde el navegador contra Staging, para confirmar visualmente
que la tarjeta de Efectividad aparece con el % correcto.

**Igual que la migración de la ronda 1 (§5): esta sesión no tiene `psql`/CLI/credenciales de
Supabase.** La migración `20260924110000_bloque6_public_match_outcomes.sql` y este test quedan
escritos, revisados por `diff` contra el código vigente y listos, pero **no se ejecutaron** contra
Staging ni contra ningún Postgres real desde acá.

**Acción manual pendiente para quien tenga acceso a Supabase Staging:**

1. aplicar `20260924110000_bloque6_public_match_outcomes.sql`;
2. correr `verify-bloque6-public-match-outcomes.sql` completo y confirmar que pasa entero;
3. QA visual sugerida (no bloqueante): abrir un Perfil público real con partidos oficiales y
   confirmar que Efectividad/jugados-ganados aparecen con datos reales, y que sigue oculta con 0
   oficiales.

No es una `DECISIÓN ABIERTA` — es la misma limitación de acceso técnico ya documentada en la
ronda 1 y en Bloques anteriores.

### 12.6 Archivos de esta ronda 2

- `supabase/migrations/20260924110000_bloque6_public_match_outcomes.sql` (nuevo).
- `supabase/functions/_shared/match-officialize-core.ts` (modificado, 1 línea + comentario).
- `supabase/tests/verify-bloque6-public-match-outcomes.sql` (nuevo).
- `bramulab/app.js` (modificado, `renderPlayerPublicProfileServerBacked`).
- `bramulab/sw.js`/`bramulab/index.html` (bump de bundle, ver más abajo).
- Este informe (§12).

**Bundle:** `04.10-h28` (bump desde `04.10-h27` de la ronda 1 de esta misma intervención). `app.js`
es un `CORE_ASSET` cacheado por el service worker — sin este bump, un cliente que ya tenía la PWA
instalada seguiría sirviendo desde caché la versión que oculta Efectividad incondicionalmente,
confundiendo cualquier QA inmediata de este cambio. `Store.VERSION`/`version.json` siguen en
"BRAMUlab V04.10" (backend/infraestructura, no una ronda nueva de Nivel BRAMU).

### 12.7 Condición de finalización de esta ronda 2

- Trazado de datos reales existentes antes de implementar. ✅
- Solución mínima elegida y justificada por escrito (sin duplicar la regla de victoria). ✅
- Migración + Edge Function + frontend implementados. ✅
- Test focalizado nuevo escrito y verificado por `diff`/lectura, pendiente de ejecución real por
  quien tenga acceso a Supabase (bloqueo operativo explícito, no silencioso). ✅
- Suite local completa sin regresiones: 255/255 + 1478/1478. ✅
- QA visual del camino local no tocado, verificado en el navegador. ✅
- Informe actualizado (mismo documento, §12). ✅
- Commit único + push a `origin/staging`. ✅ (este commit — ver `git log -1` sobre
  `origin/staging`).
- Ranking automático: no reabierto, sin cambios sobre lo ya validado en Staging real. ✅


---

## 13. Revisión central final de backend — 24/09/2026

ChatGPT central ejecutó en Supabase **bramulab-staging** lo que había quedado pendiente de la ronda 2:

- migración `bloque6_public_match_outcomes` aplicada correctamente;
- versión registrada por Supabase: `20260924202303`;
- runner `verify-bloque6-public-match-outcomes.sql` ejecutado completo;
- resultado: **PASS — rollback limpio**;
- `matches.winner_team`, la nueva firma de `officialize_match_validation` y los agregados de `get_public_profile` quedaron verificados contra Staging real.

Como `match-officialize-core.ts` es dependencia compartida, también se redeployaron en Staging todas las Edge Functions que la importan:

- `officialize-match` → ACTIVE v2;
- `create-or-attach-match` → ACTIVE v3;
- `respond-match-correction` → ACTIVE v2;
- `resolve-identity-issue` → ACTIVE v2;
- `admin-resolve-identity-issue` → ACTIVE v2.

Se conservaron sus configuraciones de JWT previas.

El advisor de seguridad posterior no introdujo un aviso nuevo atribuible a esta migración; permanecen los advisories ya conocidos del proyecto.

### Estado de P0.1

Backend y contratos necesarios: **VALIDADOS EN STAGING**.

Queda únicamente **QA visual/funcional de navegador sobre Staging real** para confirmar:

- Estado Cero real;
- Mi Perfil progresivo;
- Perfil público real con 0 y con 1+ partidos;
- Ranking sin opt-in.

Esa QA debe aprovechar las cuentas sintéticas ya planificadas y no requiere otra ronda de implementación salvo regresión concreta.


---

## 14. Hotfix real detectado por Work — Perfil público server-backed (24/09/2026)

Durante la QA sobre `04.10-h28`, Work encontró:

- búsqueda de Seba correcta: `@seba_qa`, Nivel 5.9;
- al abrir Perfil público: fallback `@seba`, Nivel vacío y toast `No pudimos cargar este perfil`.

ChatGPT central reprodujo la RPC real en Staging con sesión autenticada simulada y encontró la causa exacta:

`get_public_profile` declaraba `matches_played integer, matches_won integer`, pero `count(*)` devuelve `bigint`. PostgreSQL rechazaba el `RETURN QUERY` con:

`structure of query does not match function result type — Returned type bigint does not match expected type integer in column 15`.

Corrección aplicada:

- nueva migración `preprod_public_profile_counts_cast`;
- archivo: `supabase/migrations/20260924120000_preprod_public_profile_counts_cast.sql`;
- cast explícito `count(*) -> integer` para ambos agregados;
- aplicada en Supabase Staging;
- llamada real de `get_public_profile` revalidada como usuario autenticado: **PASS**;
- Seba devuelve correctamente `username=seba_qa`, `level_status=CALIBRANDO`, `level_public=5.9`, `matches_played=0`, `matches_won=0`.

No hubo cambio de frontend ni bump de bundle: Staging sigue en `04.10-h28`.

El bug quedó corregido en backend real; Work puede retomar desde el mismo punto y reintentar abrir el Perfil público de Seba.
