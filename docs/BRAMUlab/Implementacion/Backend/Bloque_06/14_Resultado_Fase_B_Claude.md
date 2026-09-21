# Backend Bloque 6 — Resultado de Fase B (frontend/wiring)

Ejecuta `13_Handoff_Fase_B_Claude.md` sobre el HEAD `44bd6c8`. Backend/Fase A ya validado en Supabase Staging (`12_Validacion_Backend_Staging_ChatGPT.md`) — esta ronda no toca migraciones, Edge Functions ni backend, solo conecta el frontend ya existente a las RPCs/Edge Functions ya desplegadas.

## Archivos tocados

- **`bramulab/match-validation.js`** (nuevo) — módulo `PLMatchValidation`, mismo patrón que `auth.js`/`matches.js`/`match-sync.js`: única bisagra de red para Bloque 6 (`officializeMatch`, `proposeMatchCorrection`, `respondMatchCorrection`, `reportIdentityIssue`, `resolveIdentityIssue`, `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`), gateado por `isConfigured()`.
- **`bramulab/matches.js`** — `normalizeMyMatchesRow` extendido con `pendingCorrectionRevisionId`/`hasOpenIdentityIssue` (nuevas columnas de `get_my_matches`, ya presentes en Staging).
- **`bramulab/match-sync.js`** — `translateServerMatchToLocalShape` extendido con `myTeam`, `pendingCorrectionRevisionId`, `openIdentityIssues`, `hasOpenIdentityIssue`, `actionsRaw` (de `get_match_detail`).
- **`bramulab/index.html`** — script tag de `match-validation.js`; bloque `#analysis-b6-actions` dentro de `#view-analysis` (Confirmar/Proponer corrección/Responder corrección/No participé/banners de estado); modales `#report-identity-overlay`, `#identity-resolve-scrim`/`-sheet`, `#propose-correction-scrim`/`-sheet`; pastilla `#player-home-pending-banner` en el Home.
- **`bramulab/styles.css`** — sección nueva "Backend Bloque 6 (Fase B)": pastilla Home (con pulso, respeta `prefers-reduced-motion`), modificadores de badge de Historial (`--action`, `--identity`), bloques de acciones de Resumen, lista de slots, editor de sets de corrección.
- **`bramulab/app.js`** — alias `MV`; sección nueva de estado + funciones (`b6PlayerAt`/`b6AllSlots`, `afterB6Action`, `renderB6Actions`/`paintB6Actions`, Confirmar, No participé, Resolver identidad, Proponer/Responder corrección, `initB6ActionsSection`); `renderAnalysis` pinta el bloque B6; Notificaciones reescrito para fusionar tareas derivadas del servidor (`get_notifications`) con las locales existentes; `renderPlayerHome` gana la pastilla de pendientes accionables; `serverMatchStatusLabel`/nuevo `serverMatchStatusBadgeModifier` distinguen pendiente accionable (lima) / en espera (neutro) / identidad cuestionada (rojo) / corrección propuesta, consumidos por `renderHistory`.

## Flujos conectados

Los 7 flujos pedidos por el handoff quedan cableados de punta a punta desde la UI real:

1. **Pendientes accionables** — pastilla en Home (cuenta + navega al primero) + badges diferenciados en Historial (`serverMatchStatusBadgeModifier`).
2. **Confirmar** — botón en Resumen cuando `isActionMine` (`confirm_match_validation` vía `MV.officializeMatch`).
3. **Proponer corrección** — editor de sets reutilizando `E.isValidCompletedSetScore`; branchea por `f.status`: pre-validación reenvía por `Matches.createOrAttach` (mecanismo de Bloque 5, orientación resuelta por el servidor — C-04), post-validación llama al Edge Function `propose-match-correction`.
4. **Responder corrección** — Aceptar/Rechazar cuando el `actingSide` del último `revision_proposed` (de `get_match_detail#actions`) no es el propio equipo; banner de espera cuando sí lo es.
5. **No participé** — selector de los 4 lugares (excluye los que ya tienen incidencia abierta) → `reportIdentityIssue`.
6. **Resolución de identidad** — bottom sheet nuevo (búsqueda de provisionales relacionados + jugadores reales + alta de invitado), mismo patrón visual que `#load-player-sheet` pero implementado independiente para no arriesgar la máquina de estados del carga manual.
7. **Notificaciones** — `get_notifications` (tareas derivadas `pending_review`/`correction_proposed`/`identity_questioned` + informativas persistidas) fusionado con las notificaciones locales existentes, mismo badge/lista/marcar-leído.

Ningún flujo requirió tocar backend — no hubo BLOQUEO BACKEND esta ronda.

## Tests

- `node --test bramulab/match-level-engine.test.mjs` → **30/30 OK** (sin cambios de lógica de backend, se re-corrió para confirmar que Fase B no la tocó).
- `node --check` limpio en `app.js`, `matches.js`, `match-sync.js`, `match-validation.js`, `auth.js`, `stats.js`, `engine.js`.
- Suite completa `tests.html` (dev server local, `python3 .claude/dev-server.py` + Browser pane) → **1448/1448 OK — todo verde**, sin errores de consola nuevos (el único 404 es `env.generated.js`, esperado sin config de backend en local).
- Carga completa de `index.html` en local sin backend configurado: sin errores de JS, `match-validation.js?v=04.10-h15` carga correctamente, degrada con gracia a la pantalla de acceso (comportamiento esperado, mismo criterio que el resto de los módulos server-backed).
- No se hizo QA manual contra Supabase/Vercel real desde acá — corresponde a Central, según el handoff.

## Limitaciones

- La derivación de "quién propuso la corrección pendiente" depende de `f.actionsRaw`, que solo llega con el detalle completo (`get_match_detail`) — el primer pintado desde un snapshot de lista (`get_my_matches`) no muestra ningún botón de corrección hasta que ese refresco en paralelo llega (unos cientos de ms), para no arriesgar mostrar "Proponer corrección" mientras ya hay una pendiente.
- El sheet de resolución de identidad es una implementación nueva y separada del selector de carga manual (deliberado — evita acoplarse a `manualActiveSheetSlot`/`manualPlayerIds`), por lo que no comparte código con él más allá de las clases CSS.

## DECISIONES ABIERTAS

Ninguna — el handoff no dejaba puntos de diseño pendientes, solo wiring de un backend ya cerrado.
