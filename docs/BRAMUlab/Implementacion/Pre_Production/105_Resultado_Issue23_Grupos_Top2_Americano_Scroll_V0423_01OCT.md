# 105 — Issue #23: Grupos top 2 + puntaje Americano + ayuda + scroll de Editar datos (V04.23)

**Fecha:** 01/10/2026 · **Issue:** #23 (no se cierra; gate Central) · **Versión:** `BRAMUlab V04.23` · **Bundle:** `04.23-h1`

**Grupos (`bramulab/groups.js`):** `MAX_COUNTED_MATCHES_PER_WEEK` 3→2 (tabla, desglose, Race, copies). Puntaje por formato vía `SCORING_PROFILES`/`getScoringProfile` con `formatId === 'americano'` explícito: Americano base 3, Sorpresa ≥1,0, Clara = único set 6-0/6-1/6-2, sin Remontada, máx 5; Clásico intacto (5, máx 7). `adaptServerCompetitionMatches` ahora propaga `formatId` (el RPC ya lo entregaba; sin migración). Nivel/Ranking sin cambios. Reglas completas en `Grupos_BRAMU.md` §5–§6.

**Ayuda y copies:** hoja `#group-points-info-sheet` reescrita (hero + 3 bloques + “Cómo se suman los puntos”); estado cero “Jugá, ganá, sumá”, “Tus 2 mejores partidos cuentan”; lobby y desglose a “2 mejores”.

**Bug de scroll (iPhone/PWA):** Perfil → Mis datos → Editar datos no scrolleaba. Causa: html/body `overflow:hidden`, `.view` con `min-height:100dvh` (crece con el contenido) y `.access-scroll` sin overflow propio — misma causa que Configuración del grupo. Fix: vista acotada a `100dvh` + `.access-scroll` scroller real (`min-height:0; overflow-y:auto`) con padding inferior `safe-area + --bottomnav-h`. Aplicado a las 3 vistas `.view--access` con `.access-scroll--with-bottom-nav`: `#view-edit-data`, `#view-complete-access`, `#view-change-password`. No tocados (sin bottom-nav, pasos cortos o centrados, sin evidencia del defecto): acceso, legal-gate, login, forgot-password, signup, player-card, nivel-onboarding, account-flow. Sin cambios de campos, orden, validaciones ni diseño. Mejora UX de Editar datos (muy lineal) queda como futura, fuera de esta ronda.

**Tests:** nuevo `groups-v0423-americano-top2-scroll.test.mjs` (18); tests de Grupos existentes actualizados a top 2. Suite Node: 749/752; solo fallan las 3 preexistentes (`h19-B`, `h21-9`, `h23`). `release-check` PASS. Sin verificación visual en dispositivo real (QA de Sebastián en iPhone).
