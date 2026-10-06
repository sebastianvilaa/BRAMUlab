# 132 — Resultado · Cierre QA V04.33 y corrección final (V04.34)

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.34** · bundle **04.34-h1** · **Base:** `111e66d` · **HEAD final:** el commit de esta ronda (`git log -1`).
**Fuente de alcance:** handoff `131_Handoff_Cierre_QA_V0433_Correccion_Final_V0434_06OCT.md` + Issue #29. **No se tocó** `main`, Production, BRAMUlive, fórmula de Nivel, Ranking publicado, Grupos, Legal, Team A/B canónicos, la lógica de claim automático V04.33, la ventana Recuperados de 30 días, el gate 3/4/5 ni la regla 1 cuenta + 3 provisionales.
**Estado:** implementado y probado **localmente**. La migración **no está aplicada** en Staging (sin credenciales): **la aplica Central** (ver §2).

## 1. Qué cambió

| Handoff | Resultado |
|---|---|
| §2 Partidos pendientes sale de Historial | `Pendientes` ya no es pestaña. Pantalla propia `#view-pending` (POR VALIDAR → POR RESOLVER → ESPERANDO VALIDACIÓN, misma derivación `PH.computePendingBuckets`). La abren la card de Home, el gate y cualquier CTA; volver = Home; el Resumen vuelve a la misma lista con su scroll. Historial: `Todos`, `Recuperados` (temporal), `Victorias`, `Derrotas`, `Ocultos`. |
| §3 cards | Sin badge `POR VALIDAR`/`ESPERANDO VALIDACIÓN` dentro de sus secciones (ni en el post-claim); `POR RESOLVER` conserva el descriptor. Botones = los del Resumen (`Reportar un error` rojo outline / `Validar partido` verde outline, sentence case, 48 px). `Revisar partido` (azul) reemplaza a `RESOLVER`. El verde macizo queda para `✓ PARTIDO VALIDADO`. |
| §4.1 mi equipo arriba y verde | `buildResultRowsHTML(…, firstTeam)` reordena filas (solo Resumen y sus previews de corrección); colores por la clase `team-mine-b` existente. `GANADORES`, scores, winner y acciones siguen canónicos. Share y otros usos conservan el orden A/B. |
| §4.2 título de estado | `PARTIDO POR VALIDAR` / `ESPERANDO VALIDACIÓN` en el mismo lugar arriba de `GANADORES`; se quitó el párrafo "El partido con X está esperando validación" y el estado repetido en la línea meta. |
| §4.3 inline en Resumen | `resumenValidateInline`: botones → `✓ PARTIDO VALIDADO` (~0,9 s) → relee y repinta el Resumen validado. Sin modal/toast de éxito; error real o `confirmed_not_ready` no fingen éxito. |
| §4.4 identidad | Bloque único: `JUGADOR POR IDENTIFICAR` + `Revisá este partido para confirmar quién jugó.` + CTA azul `IDENTIFICAR JUGADOR` (abre el mismo flujo de identificación); semántica ámbar. |
| §5 carrusel Home | Altura fija 84 px, título 1 línea, cuerpo máx. 2 con ellipsis. |
| §6 card Home | Icono, título y los tres números en ámbar, labels gris claro, borde ámbar sutil; abre la pantalla propia. |
| §7 `¿SOS X?` | Mini-partido reutilizable (`buildMiniMatchHTML`): dos filas de pareja (la invitada primero, verde; rival azul), jugadores apilados con avatar chico/nombre/`@usuario`, score por set a la derecha, 3 sets y nombres largos con ellipsis, sin `VS` grande. Mismo copy y acciones. |
| §8 Recuperados | Texto corto: `Estos partidos llegaron a tu cuenta al vincular a X. Esta pestaña estará disponible durante 30 días.` Quick cards con el estilo nuevo; la pestaña conserva el badge `POR VALIDAR` en la card accionable. |
| §9 Intelligence | `.intelligence-text p` (14 px, color pleno) ganaba por especificidad sobre `.intelligence-frame--pending`: regla explícita con 12 px / `--paper-faint` / itálica y más aire (22 px). Sin cambios de lógica. |
| §10 BUG `different` | Ver §2. |
| §11 pre-check temprano | `manualDuplicatePrecheck` al tocar `CARGAR RESULTADO` (ver §3). |
| §12 modal duplicado | `POSIBLE PARTIDO DUPLICADO`, copy corto, mini-partido (fecha·formato, parejas, score), `ES ESTE PARTIDO` (principal) / `ES OTRO PARTIDO` / `CANCELAR` (terciario). `ES ESTE PARTIDO` tras otro score sobre un validado sigue yendo a la propuesta de corrección (no sobrescribe). |

## 2. Backend — decisión durable `ES OTRO PARTIDO` (integridad/deduplicación)

**Investigación del modelo (se reutilizó, sin tablas nuevas):** `match_duplicate_candidates` ya tenía par ordenado `(match_low_id < match_high_id)` único, estados `open / resolved_same / resolved_different / void` y `_detect_duplicate_candidates` hace `on conflict do nothing`. El hueco: `disambiguationForceNew` creaba el segundo partido pero **no escribía nada**, así que el par no existía como `resolved_different` y la recuperación posterior lo volvía a detectar (misma huella + ventana).

**Fix:** migración forward-only **`supabase/migrations/20261006100000_v0434_persist_different_duplicate_decision.sql`** (`create or replace` de `create_or_attach_match`, misma firma y grants). Es la función V04.30 **idéntica salvo un bloque** (verificado por test que compara el texto): cuando se crea por `p_disambiguation_force_new`, inserta `resolved_different` para cada par (nuevo, existente vivo con la misma huella/formato/ventana), con `resolved_by`, `resolution {decision:'different'}`; `on conflict … do update … where status = 'open'` (nunca pisa `resolved_same`). Idempotente, atómico con la creación, simétrico. No toca Nivel, Ranking, Team A/B ni claim. **Central debe aplicarla en Staging** y probar el caso (ver QA).

**Pruebas backend reales (PGlite, todas las migraciones) — `supabase/functions/_shared/v0434-duplicados.test.mjs`, 4/4:**
1. **Caso exacto del QA:** validado Esteban/Gastón vs Seba/Leo 6-2 6-2 → carga invertida con otro score ⇒ el servidor responde `validated_match_needs_bloque6_correction` (gate final intacto, sin escribir nada) → `ES OTRO PARTIDO` ⇒ se crea y queda `resolved_different` → Gastón reclama ⇒ `duplicateCandidates = 0`, `openDuplicateCandidates = 0`, el par no está en la lista del recuperado y sigue habiendo **una** fila. El test **falla sin la migración** (comprobado).
2. **SAME sigue funcionando:** dos partidos del mismo encuentro **sin** decisión previa sí se proponen tras el claim (`status 'open'`).
3. `ES OTRO PARTIDO` sobre un pendiente con el mismo score también es durable; sin candidatos no se escribe nada.
4. Un `resolved_same` previo no se pisa; el nuevo partido queda `different` de los dos existentes.

## 3. Pre-check temprano (UX) + gate final

`PLMatchSync.findPossibleDuplicateCandidates` (pura): mismas 4 personas **y mismas parejas** (cualquier lado/orden), formato, estado vivo (validated o pending con deadline vigente), ventana ±3 h / mismo día BA; descarta slots "por identificar". Usa la caché de partidos que el usuario ya ve (quien carga siempre participa, así que cualquier candidato real está ahí) tras un refresco acotado a 1,5 s: **no hay backend nuevo**. `ES OTRO PARTIDO` queda ligado al plantel (si cambia un jugador se vuelve a preguntar) y viaja como `disambiguationForceNew`, lo que dispara la persistencia del §2. **No se eliminó** el chequeo backend al guardar (carreras): sigue devolviendo `validated_match_needs_bloque6_correction` / `ambiguous_candidates` y el cliente los maneja como antes.

## 4. Pruebas

| Prueba | Resultado |
|---|---|
| Node `bramulab/*.test.mjs` | **853 tests · 852 pass · 1 fail** — el único rojo es `h23` (preexistente, copy obsoleto; falla igual en `e06fcab`). Baseline previo a la ronda: 839 · 838 pass · 1 fail. |
| Nuevo `v0434-cierre-qa.test.mjs` | **14/14**: tabs sin Pendientes + pantalla propia y entradas; quick card (badge/botones/casing, ejecutada); mi equipo arriba desde **ambos lados del mismo partido** (primitiva ejecutada; datos A/B intactos); título pendiente/espera; **validación inline del Resumen ejecutada** (éxito, error real, `confirmed_not_ready`); identidad; Home (CSS); Recuperados/Intelligence; `findPossibleDuplicateCandidates` (14 casos de borde); **pre-check ejecutado** (sin candidato, ES ESTE, ES OTRO, CANCELAR, decisión ya tomada); gate backend conservado; modal; migración idéntica salvo el bloque. |
| Backend `supabase/functions/_shared` + `scripts` | 102 · 96 pass · 6 skipped · 0 fail (incluye `v0434-duplicados` 4/4). |
| Replay limpio ×3 ACL + `verify-clean-room` + `release-check` | PASS (82 migraciones). |
| `tests.html` | 1496/1504 — mismos 8 `V034-*` de HEAD (dependen de la fecha). |
| Navegador (app real contra mock de Supabase, temporal y borrado) | Home (card ámbar, carrusel 84 px en las 3 tarjetas); pantalla propia con 3 secciones y **sin** badges redundantes; Resumen de un partido donde soy Team B: **mi pareja arriba y verde, GANADORES = rival**; validación inline `✓` → partido validado sin modal; `ESPERANDO VALIDACIÓN` sin párrafo; identidad con `IDENTIFICAR JUGADOR`; disclaimer de Intelligence sutil; modal `POSIBLE PARTIDO DUPLICADO` con mini-partido y 3 botones. |

## 5. Archivos

Frontend `app.js`, `match-sync.js`, `index.html`, `styles.css` (+ versionado `store.js`, `version.json`, `sw.js`, `manifest.webmanifest`, `tests.html`); Backend `supabase/migrations/20261006100000_v0434_persist_different_duplicate_decision.sql`, `supabase/functions/_shared/v0434-duplicados.test.mjs`; Tests `v0434-cierre-qa.test.mjs` (nuevo) + ajustes de los que fijaban Pendientes en Historial / copy / firmas (`v0430`, `v0431`, `v0433`, `v0427`, `h19`, `h21`, `cierre-ux-h13`, `revision-central-h12`, `possible-duplicate-h26`) y bump de versión; Docs `README.md`, `Experiencia_Inicial.md` (§15.4), `Implementacion/Pre_Production/README.md`, este informe.

## 6. DECISIONES ABIERTAS / criterios (no bloquean)

1. **El pre-check usa la fecha/hora que haya en el formulario al tocar `CARGAR RESULTADO`** (por defecto "ahora"). Si el usuario cambia después la fecha a otro día, no se re-evalúa (el gate backend lo cubre). Alternativa: re-chequear al guardar.
2. **`ES ESTE PARTIDO` en el pre-check descarta el borrador** (el encuentro ya existe); no pide confirmación adicional.
3. El modal del duplicado **detectado por claim** (`ENCONTRAMOS DOS PARTIDOS…`, V04.29) no se rediseñó: el handoff pedía reutilizar el mini-partido "después"; el componente ya está listo (`buildMiniMatchHTML`).
4. En el mini-partido, la pareja de arriba va **verde** y la de abajo **azul** por posición (no por Team A/B). En el modal de duplicado la pareja de arriba es la del usuario.
5. La decisión durable cubre únicamente el camino `disambiguationForceNew`. No retroalimenta pares ya decididos **antes** de aplicar la migración (p. ej. el par Esteban/Gastón/Seba/Leo del QA): ese par, si todavía no fue reclamado, queda cubierto recién cuando se vuelva a decidir; si ya generó un candidato `open`, Central puede resolverlo como `resolved_different` desde la propia UI de duplicados.

## 7. Qué NO se verificó

Staging real (migración sin aplicar; por eso el caso real del QA de punta a punta queda para Central), iPhone físico/PWA, avatares firmados reales, y el pre-check recorriendo la UI completa de Cargar partido (se ejecutó la función con stubs y se vio el modal en la app; no se navegó el selector de jugadores real).

## 8. QA humano mínimo restante (después de aplicar la migración)

1. Home (Esteban/Seba): carrusel + card ámbar → pantalla propia → validar 1 (✓ y la card se contrae).
2. Resumen: mi equipo arriba y verde, título `POR VALIDAR`/`ESPERANDO`, feedback inline.
3. Duplicado: un único caso `ES OTRO PARTIDO` (con el pre-check) y comprobar que, tras un claim (puede usarse el partido pendiente con **Leo**), el par **no** reaparece.
4. Solo si hace falta: `¿SOS X?` con 2/3 sets.


## 9. Gate Central en Staging — 06/10/2026

Central completó la revisión de V04.34 sobre **Supabase Staging**.

- Migración `20261006100000_v0434_persist_different_duplicate_decision.sql`: **APLICADA**.
- Deploy Vercel del commit funcional `ffaab1c0b55d19ae4491f13666cc33c7c79e580a`: **SUCCESS**.
- La RPC `create_or_attach_match(...)` conserva ACL server-only y contiene el bloque durable de `resolved_different`.
- Prueba transaccional real `BEGIN/ROLLBACK` sobre Seba/Leo vs Esteban/Gaston:
  - force-new creó el encuentro de prueba dentro de la transacción;
  - se verificaron 2 relaciones `resolved_different` contra los 2 encuentros equivalentes;
  - se verificaron 0 candidatos `open` para el encuentro de prueba;
  - `ROLLBACK` dejó Staging sin fixtures de esa prueba.
- Resultado: **V04.34 staging durable-different PASS**.
- El par real usado en el QA humano ya figura como `resolved_different`.

**Gate técnico Central: PASS.** Resta únicamente QA humano visual/focal. No repetir batería histórica.

Production sigue prohibida.
