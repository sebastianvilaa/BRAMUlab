# 135 — Resultado · Ajustes finales post-QA V04.34 → V04.35

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.35** · bundle **04.35-h1** · **Base:** `7697f97` · **HEAD funcional final:** `26bbdbd690965d4fd73d2c50cf0415517484089e` · **Cierre:** PASS Central + QA humano.
**Fuente de alcance:** handoff `134_Handoff_Ajustes_Finales_Post_QA_V0434_V0435_06OCT.md` + `BRAMU_Intelligence.md` + Issue #29. **No se tocó** `main`, Production, BRAMUlive, Team A/B, claim/recovery, Recuperados 30 días, gate 3/4/5, Nivel, Ranking, Grupos, dedupe SAME, `resolved_different` ni el backend de deduplicación. **Sin migración.**

## 1. Edge Function — CERRADO
Cambió `bramulab/intelligence-claims.js` e `intelligence-presentation.js`, que `get-match-intelligence` importa por **symlink** (`supabase/functions/_shared/`). Central redesplegó la función en Supabase Staging: **ACTIVE v14, JWT ON**. Claims activos: `bramu_intelligence_v1.1`. El cambio de versión combinada invalida los checkpoints anteriores y los regenera en la próxima lectura (replay cronológico con memoria). Central verificó antes del redeploy v14 que los 203 checkpoints existentes seguían en la versión anterior, por lo que la primera regeneración ya usa simultáneamente la nueva regla de relevancia y el copy corregido. Sin migración ni cambios de `index.ts`.

## 2. Qué se modificó
**Intelligence (relevancia + copy)**
- `buildBestCompanionClaim`: se sigue comparando a todos los compañeros (≥5 partidos cada uno, ≥2 comparables), pero el claim solo se emite si el **compañero de ESTE partido** es el mejor o empata el tope; entonces nombra a ese compañero (`isUnique`/`tiedWith` coherentes). Si no, queda **descartado** con `mejor_companero_no_participa_en_este_partido` y **no se fuerza reemplazo**: se muestran menos insights. Rivales/cruces ya eran por partido; no cambian.
- Copy: `Con Gusti ganaste 8 de 11 partidos registrados.` (empate: `…: empatás tu mejor balance.`; singular correcto; respeta el alcance "oficial/registrado"). Se elimina `Tu mejor balance es con Gusti: 8 en 11.`
- Fuente maestra `BRAMU_Intelligence.md` §5.4 actualizada con la regla y el copy; "mejor compañero histórico" global queda para una superficie longitudinal (`Tu momento`), fuera de esta ronda.

**Visual**
- Carrusel Home: altura común (84 px) **solo con 2+ tarjetas**; con una sola, compacta por contenido (61 px medido); límites de título (1 línea) y cuerpo (2 líneas, ellipsis) intactos.
- Card `PARTIDOS PENDIENTES`: icono/título/borde ámbar y 3 columnas se mantienen; **números en blanco/neutro**; labels 11 px con más presencia; sin semáforo.
- Pantalla `PARTIDOS PENDIENTES`: headings `POR VALIDAR · 1` / `POR RESOLVER · 1` / `ESPERANDO VALIDACIÓN · 6` (número junto al título, ya no aislado a la derecha); menos aire entre secciones.
- Disclaimer de Intelligence en pendiente: `margin-top` 22 px → **5 px** (medido en la regla real `.intelligence-text p.intelligence-frame--pending`); copy y `+ POR QUÉ APARECEN ESTOS INSIGHTS` intactos.
- Mini-partido (modal de duplicado y `¿SOS X?`): filas más altas (9 px), avatares 28 px, nombres en blanco/neutro, verde/azul solo en la línea lateral de cada pareja, `@usuario` debajo del nombre. En el duplicado se completa desde el RPC batch **existente** `get_players_compact` (`hydrateMiniMatchPlayers`); provisionales/sin cuenta no vuelven en el Map → sin `@usuario` ni foto (nunca se inventa). Estructura, título, score, botones y acciones del modal sin cambios.

## 3. Archivos
`bramulab/intelligence-claims.js`, `intelligence-presentation.js`, `app.js`, `styles.css` + versionado (`store.js`, `version.json`, `sw.js`, `manifest.webmanifest`, `index.html`, `tests.html`); tests `intelligence-claims.test.mjs`, `intelligence-editorial.test.mjs`, `intelligence-presentation.test.mjs`, `v0434-cierre-qa.test.mjs`, `v0431-post-qa-humano.test.mjs` + bump de versión; docs `BRAMU_Intelligence.md`, `README.md`, este informe.

## 4. Tests
| Prueba | Resultado |
|---|---|
| Node `bramulab/*.test.mjs` | **859 tests · 858 pass · 1 fail** — solo `h23` (preexistente, copy obsoleto; falla igual desde V04.33). Antes de la ronda: 853 · 852 pass · 1 fail. |
| Intelligence nuevos | candidato de compañero ajeno **queda fuera**; compañero actual elegible **sigue apareciendo** (único y empatado, nombrando al del partido); actual presente pero fuera del tope → descartado; **fallback** sin reemplazo débil; copy explícito (plural/singular/empate, sin "8 en 11"); tests previos de Familia D/C03/C05-A reordenados para que el compañero actual sea el evaluado. Suites `intelligence-*` completas en verde. |
| UI focales (`v0434-cierre-qa`) | carrusel 2+/1 tarjeta, card Home neutra, headings `TÍTULO · N`, disclaimer 5 px, mini-partido (CSS + hidratación `@usuario` ejecutada: cuenta sí, provisional no). |
| Backend `_shared` + `scripts`, `release-check` | 102 · 96 pass · 6 skipped · 0 fail; `release-check` PASS. |
| Navegador (mock de Supabase, temporal y borrado) | carrusel 3×84 px / 1×61 px; números `rgb(248,250,252)`; labels 11 px; headings `POR VALIDAR · 1` / `ESPERANDO VALIDACIÓN · 4`; disclaimer `margin-top: 5px`. |

## 5. Cierre de QA humano

PASS final observado en Staging real:

- BRAMU Intelligence del partido `Seba / Leo vs Esteban / Gastón · 6–1 · 6–1`: desaparece el insight ajeno de Gusti y, sin candidato suficientemente relevante, BRAMU se abstiene honestamente con el fallback; `Tu momento` conserva a Gusti como lectura longitudinal, que es la superficie correcta.
- Disclaimer de partido pendiente: separación visual corregida a 5 px.
- Home con una sola tarjeta superior: altura compacta.
- Home con 2+ tarjetas: altura común consistente.
- Card `PARTIDOS PENDIENTES`: números blancos/neutros, labels con más presencia, acento ámbar reservado al contenedor/título.
- Pantalla `PARTIDOS PENDIENTES`: headings `TÍTULO · N` y espaciado reducido.
- Modal `POSIBLE PARTIDO DUPLICADO`: filas/avatares mejorados, nombres neutros, `@usuario` donde existe, provisionales sin handle inventado, líneas verde/azul como único acento de pareja.
- Persistencia `ES OTRO PARTIDO`: ya verificada por Central en Supabase Staging como `resolved_different` contra los encuentros equivalentes.
- Vercel del HEAD funcional final: SUCCESS.
- `get-match-intelligence`: ACTIVE v14.

**Issue #29: cerrar como completed.** No queda QA humano adicional para este bloque. No habilita Production.

Residual deliberado / idea futura no bloqueante:
- deduplicación temporal vigente: ±3 horas si ambas horas son conocidas; mismo día BA si alguna hora es desconocida. Se decidió **no ampliar ahora a ±12 h** porque podría capturar revanchas reales del mismo día. Queda para revisar más adelante junto con la UX de Fecha/Hora (por ejemplo, exigir confirmación explícita o tratar mejor el valor automático cuando el partido se carga horas después).

## Addendum (06/10/2026) — concordancia singular/plural de victorias/derrotas en Intelligence
Tras el gate de Central (HEAD `a5ffbcd`, `get-match-intelligence` ACTIVE v13) apareció, en el checkpoint real del partido de QA, un bug **preexistente** de copy: `2 victorias y 1 derrotas`, `1 victorias y 2 derrotas`. Corrección focal **solo de copy** en `intelligence-presentation.js` (sin tocar selección/relevancia, scoring, umbrales, evidencia, Nivel/Ranking, frontend, claim/recovery, duplicados, Supabase ni versionado: **APP_VERSION/BUNDLE_VERSION siguen en V04.35 / 04.35-h1**).
- Helpers `countOf / winsLabel / lossesLabel` (y `streakLabel / streakSeguidas` en reemplazo de `streakNoun`) aplicados a todas las plantillas que hardcodeaban `victorias`/`derrotas`: `hito_de_victorias`, rachas (victorias/derrotas/cortada/récord/iguala), `companero_balance` (v1/v2), `*_balance` de rival/pareja/cruce (v1/v2), `*_primer_triunfo_tras_derrotas` (body y why), `contexto_dificultad_previa_rival`, `forma_reciente`, `balance_perdiendo_primer_set`. Resultado: `1 victoria y 2 derrotas`, `2 victorias y 1 derrota`, `1 victoria en 3 partidos registrados`, `0 derrotas` (cero en plural), `1 derrota seguida`.
- Tests (`intelligence-presentation.test.mjs`, +2): barrido de todas las plantillas afectadas con 0/1/plural (regex que prohíbe `1 victorias|1 derrotas` y `N victoria` con N≠1) y las frases exactas pedidas. **Fallan con el código anterior y pasan con el nuevo.**
- Resultado: Node `bramulab` 861 tests · 860 pass · 1 fail (`h23`, preexistente); `_shared` sin fallos.
- Central redesplegó `get-match-intelligence` en **Staging v14**. No hizo falta subir la versión de presentación ni borrar checkpoints: antes del redeploy v14 Central verificó que los 203 checkpoints persistidos seguían con claims `bramu_intelligence_v1`, así que la subida ya hecha a `bramu_intelligence_v1.1` los invalida y la próxima lectura los regenera directamente con el copy corregido. **DECISIÓN ABIERTA resuelta.**
