# 135 — Resultado · Ajustes finales post-QA V04.34 → V04.35

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.35** · bundle **04.35-h1** · **Base:** `7697f97` · **HEAD final:** el commit de esta ronda (`git log -1`; el hash se informa al cerrar).
**Fuente de alcance:** handoff `134_Handoff_Ajustes_Finales_Post_QA_V0434_V0435_06OCT.md` + `BRAMU_Intelligence.md` + Issue #29. **No se tocó** `main`, Production, BRAMUlive, Team A/B, claim/recovery, Recuperados 30 días, gate 3/4/5, Nivel, Ranking, Grupos, dedupe SAME, `resolved_different` ni el backend de deduplicación. **Sin migración.**

## 1. Edge Function — REQUIERE ACCIÓN DE CENTRAL
Cambió `bramulab/intelligence-claims.js` e `intelligence-presentation.js`, que `get-match-intelligence` importa por **symlink** (`supabase/functions/_shared/`). **Hay que redesplegar `get-match-intelligence` en Supabase Staging** (el push de Git no lo hace). Además se subió `RULES_VERSION` de claims a `bramu_intelligence_v1.1`: `RULES_VERSION_COMBINED` cambia, por lo que los checkpoints guardados quedan inválidos y se **regeneran solos** en la próxima lectura (replay cronológico con memoria), incluido el partido del QA que mostraba "Tu mejor compañero: Gusti". Sin migración ni cambios de `index.ts`.

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

## 5. Residuales / qué falta
- **Central:** redeploy de `get-match-intelligence` (Staging), revisar diff/Vercel y gate final.
- El mock de navegador no tenía insights, así que el espacio exacto entre `+ POR QUÉ APARECEN ESTOS INSIGHTS` y el disclaimer se verificó por la regla CSS (5 px) y no visualmente con datos reales; confirmar en QA humano.
- QA humano mínimo (solo lo cambiado): Home con 1 y con 2+ tarjetas; card pendientes; pantalla Pendientes (headings); un partido pendiente con Intelligence (espacio del disclaimer y que no aparezca un compañero ajeno tras el redeploy); modal de duplicado (`@usuario`/avatares).
