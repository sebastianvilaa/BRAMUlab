# Backend Bloque 8 — Resultado de Fase A: Datos y derivados (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `1838bfb` (`01_Handoff_Inicio_Bloque_08.md`, tras traer los 7 commits de ChatGPT central que cerraron Bloque 7 y prepararon este handoff).
**Alcance ejecutado:** únicamente **A — Datos y derivados**, siguiendo `01_Handoff_Inicio_Bloque_08.md` §5. No se avanzó a B — Claims y evidencia. No se tocó ninguna UI, ningún Edge Function nuevo, ni la pantalla post-partido.

No se aplicó nada a Supabase real todavía (ver §5 — siguiente paso).

---

## 1. Qué se implementó

### 1.1 RPC de datos: `get_player_intelligence_history`

Nueva migración `20260923100000_bloque8_fasea_intelligence_history_rpc.sql`, una sola función:

- `get_player_intelligence_history(p_limit integer default 300, p_before_played_at timestamptz default null, p_include_hidden boolean default false)` — `SECURITY DEFINER`, `grant execute` únicamente a `authenticated` (mismo patrón deny-by-default que Bloque 5/6/7: ninguna de las tablas de partidos tiene policy para `authenticated`).
- Devuelve la **historia personal completa** del caller (nunca de otro jugador — se resuelve por `auth.uid()`, igual que `get_my_matches`), ordenada por `played_at` **real** descendente (nunca por orden de carga — prioridad de prueba explícita del handoff §7), con desempate estable por `created_at`/`match_id`.
- `returns table (...)`, mismo tipo de retorno que `get_my_matches` — sus columnas top-level llegan de Supabase/PostgREST en **snake_case** (`match_id`, `played_at`, `official_eligible`, etc.), nunca camelCase. `bramulab/intelligence-context.js` normaliza esa forma real en su propia frontera (`normalizeIntelligenceHistoryRow`, ver §1.2 — corregido tras `03_Revision_Central_Fase_A.md` C01) antes de pasarla a `PLMatchSync.translateServerMatchToLocalShape` (Bloque 5) — **no se reimplementó ninguna traducción, ni se tocó `matches.js`**.
- Agrega dos campos nuevos, exclusivos de Intelligence:
  - `hasOpenIdentityIssue` — mismo criterio exacto que la extensión de Bloque 6 a `get_my_matches`/`get_match_detail`.
  - `officialEligible` — mismo predicado exacto que usa `get_player_match_history_for_level_engine` (Bloque 6) para "tuvo efecto de Nivel aplicado", pero **sin la ventana de 180 días** de esa función: acá interesa si el partido tuvo impacto oficial en algún momento de su historia completa, no si sigue dentro de la ventana de repetición de Nivel.
- Excluye siempre `matches.status = 'annulled'` (un partido anulado nunca fue historia real de producto). Excluye ocultos salvo `p_include_hidden = true` (mismo default que `get_my_matches`; ver DECISIÓN ABIERTA #1).
- No agrega ninguna tabla nueva, no modifica ninguna tabla existente, no recalcula Nivel ni Ranking: es una proyección de lectura sobre `matches`/`match_participants`/`match_sets`/`match_revisions`/`match_user_state`/`match_identity_issues` (Bloque 5/6) y `match_level_results` (Bloque 6), todas ya cerradas.

### 1.2 Módulo de derivados: `bramulab/intelligence-context.js`

Módulo JS puro (IIFE, `global.PLIntelligenceContext`), simlinkeado en `supabase/functions/_shared/intelligence-context.js` — mismo patrón exacto que `level-context.js`/`match-sync.js`: un solo archivo real en `bramulab/`, sin copia. **No se modificó `match-sync.js` ni `level-context.js`** (Bloque 5/6 cerrados): `intelligence-context.js` los consume (`PLMatchSync.translateServerMatchToLocalShape`, `PLLevelContext.detectFormatKey`, `PLLevelContext.computeMarginScoreInputs`) en vez de reimplementarlos — "no duplicar motores" del handoff §6.

No está wireado a ningún Edge Function ni a `index.html`/`tests.html` todavía — es intencional (alcance de Fase A, "sin producir todavía la experiencia completa de Intelligence").

Funciones expuestas y qué resuelven (todas puras, reciben la historia ya traída, nunca hacen red/DOM/storage):

| Función | Resuelve | Fuente normativa |
|---|---|---|
| `normalizeIntelligenceHistoryRow(row)` | Traduce la fila real snake_case de la RPC a camelCase, en la frontera de Intelligence (nunca toca `matches.js`) | C01 |
| `buildPersonalHistory(rows)` | Normaliza + traduce filas servidor + ordena por `playedAt` real (único punto de orden del módulo) | §11.1 |
| `resolvePerspective(match, callerPlayerId)` | Compañero, rivales y resultado (`win`/`loss`/`null` si el partido no tiene ganador todavía) desde la perspectiva del caller | §11.1 |
| `computeFormatFacts(match)` | Sets jugados, ganador por set, set decisivo, margen normalizado, `lostFirstSetWonMatch` (detector 1), alternancia (solo con exactamente 3 sets) | §5.1, Implementacion.md §7.1 |
| `buildDecidedSequence` / `computeStreakTimeline` / `computeCurrentStreak` | Racha anterior/posterior por partido, récord estricto vs. empate de récord, sin fijar el umbral de "cuándo se muestra" (eso es Fase C) | §5.3, §6.2 |
| `computeRecentForm(decidedSequence, windowSize)` | Balance exacto de últimos 5/10, `sampleSize` nunca mayor al historial real | §5.3 |
| `computeMilestones(decidedSequence)` | Primer partido/primera victoria, hitos 10/25/50/100 marcados exactamente en el partido que los alcanza | §5.2 |
| `computeRelationshipSummary` + 4 constructores de relación (`relationCompanion`, `relationIndividualRival`, `relationRivalPair`, `relationExactPairCrossing`) | Balance con compañero, rival individual, pareja rival exacta y cruce exacto de las dos parejas — los 4 alcances de §5.5, sin mezclarlos | §5.4, §5.5 |
| `computeInactivityGap(historyAsc)` | Días desde el partido anterior + umbral exacto de regreso excepcional (`máximo entre 30 y 2× mediana de separación de los últimos 10`, con ≥6 previos) | §5.2 |
| `buildMatchDerivedContext(historyAsc, callerPlayerId)` | Orquestador: arma toda la superficie anterior para UN partido puntual (el último de `historyAsc`) | — |

**Contrato de orden y de "como de ese momento"** (documentado en la cabecera del archivo): toda función recibe `historyAsc` ya ordenado ascendente, y **truncado hasta el partido de interés inclusive** — esto es lo que permite, sin una API separada, recalcular el contexto de un partido pasado después de una corrección/anulación posterior (handoff §7 y §6 "no recalcular Nivel histórico", que acá se traduce en "no inventar un derivado con datos que en ese momento no existían").

**Separación historia personal vs. oficial** (handoff §5): `historyAsc` es siempre la historia personal completa (cualquier estado salvo `annulled`); wins/losses/rachas/forma solo cuentan partidos con resultado definido — uno pendiente sin consenso no es evidencia de nada todavía. `officialEligible` viaja intacto en cada partido del contexto armado, sin filtrar: qué familia de insight exige oficialidad queda para Fase B/E, que ya tienen disponibles los snapshots de Nivel (`get_player_level_state_as_of`) y Ranking (`get_current_ranking_edition`, etc.) de Bloques 6/7 sin que Fase A necesitara tocarlos.

---

## 2. Archivos

**Nuevos (4):**

- `supabase/migrations/20260923100000_bloque8_fasea_intelligence_history_rpc.sql`
- `bramulab/intelligence-context.js`
- `bramulab/intelligence-context.test.mjs`
- `supabase/functions/_shared/intelligence-context.js` (symlink → `../../../bramulab/intelligence-context.js`)

**Modificados:** ninguno. No se tocó `match-sync.js`, `level-context.js`, `index.html`, `tests.html` ni ningún Edge Function existente.

---

## 3. Tests y resultado

`node --test bramulab/intelligence-context.test.mjs` — **29/29 PASS** (27 originales + 2 de regresión C01, ver `04_Correccion_Fase_A_Claude.md`).

Mismo criterio de arnés que `match-level-engine.test.mjs`: los módulos compartidos son scripts de navegador (IIFE sin `export`) y se cargan tal cual en un `vm.createContext` nuevo (`engine.js`, `level.js`, `level-context.js`, `match-sync.js`, `intelligence-context.js`), sin envolverlos en ningún formato de módulo distinto al que ya usa `index.html`/las Edge Functions.

Cobertura, alineada a las prioridades de prueba del handoff §7:

- orden por fecha real vs. orden de carga (filas deliberadamente desordenadas al entrar);
- formatos comparables (margen normalizado, `lostFirstSetWonMatch`, alternancia solo a 3 sets);
- racha: extensión, corte (before/after de tipo distinto), récord estricto vs. empate de récord;
- forma reciente: ventana de 5 que nunca mira más allá del tamaño real del historial ni de la ventana pedida;
- hitos: primer partido/primera victoria, milestone de victoria número 10 marcado exactamente ahí (9 y 11 no lo marcan);
- relaciones: balance con compañero, rival individual (con compañeros propios distintos), pareja rival exacta (no confundir con "uno de los dos repite"), cruce exacto de parejas (exige compañero Y pareja rival simultáneos), identidad no resuelta nunca cuenta como "esa pareja exacta";
- partidos pendientes/sin resultado: no rompen ni extienden racha, no entran a forma reciente/hitos, pero sí aportan a `totalMatches`/participación de relaciones y a `computeInactivityGap`;
- inactividad: muestra insuficiente (`<6` previos) nunca afirma excepcionalidad; regreso excepcional con separación habitual corta;
- el orquestador (`buildMatchDerivedContext`) respeta `officialEligible`/`hidden`/`hasOpenIdentityIssue` tal cual llegan, sin recalcularlos;
- **C01:** la fila cruda de fixture (`row()`) tiene la forma real snake_case de `get_player_intelligence_history` (no una idealización camelCase) — los 27 tests originales corren sobre esa forma real, más 2 pruebas explícitas de `normalizeIntelligenceHistoryRow`/`translateForIntelligence`.

No se corrió la batería de navegador (`bramulab/tests.html`, la que reporta "N/N" en las rondas anteriores): esta ronda no modificó ningún archivo existente que esa batería ya cubre, así que no hay riesgo concreto que justifique repetirla (`Metodo_Trabajo.md` — "no repetir baterías equivalentes si ya existe evidencia suficiente").

---

## 4. DECISIONES ABIERTAS

**DECISIÓN ABIERTA #1 — ¿Un partido oculto por el usuario puede producir un insight de BRAMU Intelligence?**

`get_player_intelligence_history` excluye por default los partidos que el jugador ocultó de su Historial (`p_include_hidden = false`, mismo default que `get_my_matches`), por consistencia con lo que el usuario ya eligió no ver. No es una exclusión fija: queda como parámetro explícito para no bloquear una decisión de producto futura con una migración nueva. No bloquea nada del resto de Fase A ni de esta ronda — Fase B puede resolverla llamando la RPC con el valor que corresponda.

Ninguna otra decisión de producto quedó abierta en esta ronda: la separación historia personal/oficial, el alcance de las 4 relaciones y los umbrales de racha/forma/inactividad ya estaban completamente cerrados en `BRAMU_Intelligence.md`/`BRAMU_Intelligence_Implementacion.md` y se implementaron tal cual, sin reinterpretarlos.

---

## 5. Confirmación de entornos

- `staging`: única rama tocada. `git status` antes y después de esta ronda no mostró cambios fuera de los 4 archivos nuevos listados en §2 (más `Referencias/` y `docs/identidad-visual/Logo.ai`, untracked, ajenos a esta ronda, sin tocar).
- `main`: **no tocado**.
- Production: **no tocada**.
- BRAMUlive: **no tocado**.
- La migración **todavía no se aplicó** a ningún Supabase real (ni Staging ni Production): no hay CLI de Supabase ni credenciales de conexión en este entorno de ejecución. Es lectura pura sobre tablas ya existentes y RLS ya deny-by-default (ninguna tabla nueva, ningún grant nuevo salvo `execute` de la función), por lo que el riesgo de aplicarla es bajo, pero sigue pendiente como paso operativo explícito (ver §6).

---

## 6. Siguiente paso recomendado

1. **Aplicar la migración `20260923100000_bloque8_fasea_intelligence_history_rpc.sql` a Supabase Staging real** (Work o quien tenga acceso al dashboard/CLI) y confirmar con una llamada real de `get_player_intelligence_history` desde una cuenta con partidos reales que la forma jsonb es la esperada — paso operativo simple, no requiere una ronda de Claude Code aparte.
2. Recién con eso confirmado, avanzar a **B — Claims y evidencia**: familias de insight de `BRAMU_Intelligence.md` §5, contrato de evidencia estructurada (§12.2 de `BRAMU_Intelligence.md`), tamaños de muestra mínimos y fixtures de claims — consumiendo `PLIntelligenceContext.buildMatchDerivedContext` tal cual quedó, sin tocar Fase A salvo que Fase B descubra un derivado faltante.

No se avanzó a B en esta ronda (handoff §4/§8: "no avanzar automáticamente a B sin revisión central").
