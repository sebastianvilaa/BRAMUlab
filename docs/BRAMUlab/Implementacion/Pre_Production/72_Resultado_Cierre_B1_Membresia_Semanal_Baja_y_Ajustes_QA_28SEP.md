# Resultado — Cierre Grupos B1: membresía semanal, baja real y ajustes C1-C4

**Fecha:** 28/09/2026 · **Rama:** `staging` · **Handoff:** `71_Handoff_Cierre_B1_Membresia_Semanal_Baja_y_Ajustes_QA_28SEP.md`
**Bundle:** `04.11-h30` (partía de `h29`, aplicado por una ronda QA previa — cuarteto Store/version.json/sw.js/index.html verificado consistente).

**No se declara B1 cerrado.** Falta el retest focal de Central/Sebastián sobre lo implementado acá — en particular el caso real de Pablito y la desaparición de Matu.

## A — Membresía semanal (alta/reingreso cuenta desde el lunes)

- **Backend** ([20260928140000_preprod_grupos_b1_membresia_semanal_hotfix.sql](../../../../supabase/migrations/20260928140000_preprod_grupos_b1_membresia_semanal_hotfix.sql)): `get_group_competition_data` amplía el umbral de candidatos (`joined_at - 7 días`, cota segura de "lunes de esa semana" en cualquier huso horario) para nunca excluir de más. El piso EXACTO (lunes 00:00 local) sigue siendo autoridad exclusiva de `groups.js` — mismo patrón ya documentado en Fase A ("SQL da candidatos, JS decide"). **Pendiente: aplicar y correr `verify-preprod-grupos-b1-membresia-semanal-hotfix.sql` en Staging** (termina en `GRUPOS_B1_MEMBRESIA_SEMANAL_HOTFIX_VERIFY_PASS`); también actualicé la aserción T11 de `verify-preprod-grupos-fase-a.sql` (M4 ahora es candidato SQL con el umbral ampliado — su exclusión real sigue probada en JS).
- **Motor** (`groups.js`): `effectiveMembershipStartAt`/`isMemberDeportivamenteActiveAt` (nuevas) — un período cuenta, para decidir qué partidos entran al grupo, desde el lunes de la semana de su `joinedAt`, nunca antes. Se usa solo en `countActiveMembersInMatch` (vía `findActiveMemberForPlayerRow(..., {effective:true})`); el resto de los usos de "miembro activo ahora" no cambió.
- Verificado con el caso real de QA: Esteban+Matu vs Seba+Pablito ya contaba 3/4; al agregar a Pablito esa misma semana, el partido puede sumarle puntos a él también (tests A1-A6 en `groups-b1-cierre-membresia-baja.test.mjs`).

## B — Baja: eliminar = dejar de verlo (bug real: Matu seguía apareciendo)

- **Causa real:** `membersRelevantForWeek` incluía cualquier período **histórico** que se solapara con la semana pedida, sin importar si la persona seguía siendo miembro. Reescrita: solo entra quien tiene un período **abierto** hoy, y dentro de ese período únicamente desde su piso semanal — un reingreso nunca revive semanas de una etapa ya eliminada.
- Como consecuencia directa (misma tabla filtrada, sin fórmula nueva), Semana actual/pasada y Race ya no muestran al eliminado. `insightBonusHighlight` (BRAMU Intelligence) recibió además un chequeo explícito para no nombrarlo en el destacado de bonus, aunque el partido real siga contando.
- **Nada se borra ni se recalcula:** `countActiveMembersInMatch`/`doesMatchCountForGroup` siguen mirando TODOS los períodos (abiertos y cerrados) — un partido que ya calificó para el grupo sigue calificando, y los puntos de los demás no cambian. Sin cambios de backend (la corrección es enteramente client-side).
- Tests B1-B6 en `groups-b1-cierre-membresia-baja.test.mjs` cubren exactamente los 6 casos del handoff.

## C1-C4 — ajustes UX chicos

- **C1:** error de "sin nombre" al crear grupo pasa a ser contextual (`.field--invalid`, borde/label rojo + mensaje junto al campo, foco automático); se limpia al abrir la hoja o tipear. El error inferior genérico queda solo para fallas de red/servidor y "Elegí al menos un jugador" (fuera de alcance de C1).
- **C2:** `.result-card.result-card--pending` pasa de `rgba(255,201,61,0.45)` a `var(--gold)` (ámbar pleno), igual que Home/Último partido.
- **C3:** `identity_replacement` pre-validación ahora se funde en la misma `.result-card--pending` (título/pie contextual dentro de la tarjeta, vía nuevos `opts.titleText`/`opts.waitText` de `paintPendingInResultCard`) — ya no hay un banner `.b6-correction-card` separado para este caso, igual que h24 ya hacía para la carga normal y `result_correction`.
- **C4:** el carrusel de Home ya no atribuye siempre la carga original ("X cargó un partido con vos") como si fuera el evento accionable actual. `get_my_matches` (snapshot de Home) no trae `currentRevisionNumber`/`actionsRaw`, así que Home no puede certificar si el evento es la carga o una corrección posterior — el copy pasa a ser neutro (`Partido con {rival}.`) para todo accionable; el copy actor-consciente real sigue en Resumen (`paintB6Actions`), sin cambios.

## Tests

- Nuevo `bramulab/groups-b1-cierre-membresia-baja.test.mjs`: **16/16 PASS** (A1-A6, B1-B6, C1-C4 como guardas estáticas/comportamiento).
- Focales re-corridos: `groups-b1-server-backed.test.mjs` (24 tests, incluye el `B1-h29` de la ronda anterior), `h21-sistema-visual-unificado.test.mjs`, `cierre-ux-h13.test.mjs` — **73/73 PASS**.
- Suite general `node --test bramulab/*.test.mjs`: **406/407**. El único fallo, `h23: flujo inicial dice VALIDAR…`, es preexistente (confirmado con `git stash` antes de tocar nada) y no relacionado con esta ronda.
- Ajusté 2 guardas de rondas previas que hardcodeaban texto/versión ya cambiados por esta ronda: `possible-duplicate-h26.test.mjs` (h27, copy del carrusel) y `h21-sistema-visual-unificado.test.mjs` (cuarteto de versión, que además traía una inconsistencia previa entre `h28`/`h29` — quedó uniforme en `h30`).

## No verificado (honesto)

- **No se probó en navegador** (sin Supabase CLI/psql ni sesión real en este sandbox, mismo límite que rondas anteriores) — sin PASS visual ni multiusuario declarado acá.
- La migración del hotfix **no está aplicada en Staging**; falta que Central la aplique y corra su verify.
- El push a `origin/staging` dispara el deploy automático de Vercel BRAMUlab Staging (`ignoreCommand` compara `HEAD^` vs `HEAD` dentro de `bramulab/`, que sí cambió) — no hay forma de confirmar desde este sandbox que el deploy efectivamente terminó bien.

## Pendiente para cerrar B1 (Central/Sebastián)

1. Aplicar `20260928140000_preprod_grupos_b1_membresia_semanal_hotfix.sql` en Supabase Staging y correr su verify + el verify de Fase A actualizado.
2. Retest focal real: reproducir el caso Pablito (alta a mitad de semana habilita el partido) y confirmar que un miembro eliminado (caso Matu) desaparece de Semana actual/pasada/Race/Intelligence sin afectar a nadie más.
3. Confirmar visualmente C1-C4 en Staging real.

No se inició B2 (lobby). No se tocó `main`, Production ni BRAMUlive.


## Revisión Central posterior

Central revisó el commit funcional `50230eb45863471757490071ea596fd121d705de` antes del retest humano.

- Vercel BRAMUlab para ese commit: **SUCCESS / Deployment has completed**.
- BRAMUlive: **Canceled by Ignored Build Step**, como corresponde.
- Migración `preprod_grupos_b1_membresia_semanal_hotfix` aplicada exclusivamente en Supabase Staging. Versión registrada por Supabase: `20260928223208`.
- El runner SQL nuevo tenía tres defectos propios del test, no de la migración: dos concatenaciones text/jsonb sin cast explícito y un control negativo colocado exactamente en el límite de 7 días. Central corrigió solo el runner en commits `faf0282`, `d408aa7` y `39a6f68`.
- Post-corrección:
  - `verify-preprod-grupos-b1-membresia-semanal-hotfix.sql` → **GRUPOS_B1_MEMBRESIA_SEMANAL_HOTFIX_VERIFY_PASS**;
  - `verify-preprod-grupos-fase-a.sql` actualizado → **GRUPOS_FASE_A_VERIFY_PASS**;
  - ambos terminan en rollback, sin fixtures persistentes.
- Advisors de Supabase revisados después del DDL: los avisos de Grupos son los ya esperados por el diseño server-only/RPC (RLS sin policies directas y SECURITY DEFINER autenticadas); no apareció un bloqueo nuevo atribuible a este hotfix.

**Estado:** técnicamente listo para retest focal real. B1 sigue sin declararse cerrado hasta comprobar en navegador los casos afectados y C1-C4.
