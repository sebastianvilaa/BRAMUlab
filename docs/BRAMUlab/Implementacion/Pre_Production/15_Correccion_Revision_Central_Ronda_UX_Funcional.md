# BRAMUlab — Corrección · Revisión central sobre la Ronda UX 25/09

**Rama:** `staging`
**Fecha:** 25/09/2026
**HEAD revisado por central:** `3c53900`
**Handoff de origen:** `docs/BRAMUlab/Implementacion/Pre_Production/13_Handoff_Implementacion_Ronda_UX_25SEP.md` (§G)

Ronda correctiva sobre `14_Resultado_Ronda_UX_Funcional_Claude.md`, a partir de los dos problemas que central encontró al revisar HEAD real de `staging` contra Supabase Staging.

---

## Corrección 1 — Mostrar qué cambió en una corrección

### Causa

`get_match_detail` solo devolvía los sets de `current_revision_id` (la revisión vigente). No había ningún camino, ni pre- ni post-validación, para obtener la revisión CONTRA la que comparar:

- **Pre-validación**: cuando la pareja rival propone una corrección, esa nueva revisión pasa a ser `current_revision_id` de inmediato (Bloque 5: `action_side` es derivado de la revisión vigente, nunca de la original). `sets` ya es el resultado PROPUESTO; faltaba la revisión anterior.
- **Post-validación**: `current_revision_id` sigue apuntando a la revisión OFICIAL mientras una corrección post-validación está pendiente (`pending_correction_revision_id`); `sets` ya es el oficial, pero la propuesta pendiente nunca se exponía.

### Migración agregada

`supabase/migrations/20260925150000_preprod_ux_correction_revision_diff.sql` — `CREATE OR REPLACE FUNCTION public.get_match_detail(p_match_id uuid)`, misma firma exacta, mismos `GRANT`/`REVOKE`. Agrega dos campos al mismo `jsonb_build_object` existente, ningún campo previo cambia de nombre ni de significado:

```json
{
  ...campos ya existentes sin cambios...,
  "previousRevisionSets": [ { "setNumber": 1, "gamesA": 6, "gamesB": 4, "tiebreakA": null, "tiebreakB": null }, ... ] | null,
  "pendingCorrectionSets": [ ... ] | null
}
```

- `previousRevisionSets` — sets de la revisión `currentRevisionNumber - 1` del mismo `match_id`. `null` cuando `currentRevisionNumber = 1` (nunca hubo revisión anterior) — mismo criterio de `jsonb_agg` sin `coalesce` que ya usa el campo hermano `sets`, sin caso especial.
- `pendingCorrectionSets` — sets de la revisión referenciada por `pending_correction_revision_id`. `null` cuando no existe una corrección post-validación pendiente — comparar contra `NULL` en SQL nunca es verdadero, el subselect no encuentra fila, `jsonb_agg` devuelve `null` sin necesitar un `case`.

**No aplicada desde esta sesión** (sin Supabase CLI ni credenciales en este sandbox, mismo motivo documentado en la ronda anterior) — queda para que central la aplique/verifique contra Staging real, como se indicó.

### Frontend afectado

- `bramulab/match-sync.js#translateServerMatchToLocalShape` — mapea los dos campos nuevos pasándolos por el MISMO `buildLocalSets` que ya usa `sets`, para que los tres campos (`sets`/`previousRevisionSets`/`pendingCorrectionSets`) compartan exactamente la misma forma local (`{gamesA, gamesB, tiebreak, winner}`, posicional).
- `bramulab/match-load.js` — nueva función pura `buildCorrectionDiffLines(beforeSets, afterSets)`: comparación ESTRUCTURAL (nunca por string) que devuelve líneas compactas (`Set 2: 6–3 → 6–4`, `Set 3 agregado: 6–2`, `Set 3 eliminado`) o `[]` si no hay diferencias reales. El tie break interno nunca participa de la comparación (no es autoritativo, ver comentario en `validateMatchSets`).
- `bramulab/app.js#paintB6Actions` — `renderCorrectionDiff(elId, beforeSets, afterSets)` pinta la `<ul>` correspondiente o la oculta:
  - **PRE-VALIDACIÓN** (`isCorrectionPending`, dentro de `f.isActionMine`): `before = f.previousRevisionSets`, `after = f.sets`.
  - **POST-VALIDACIÓN** (`respondBlock`, corrección de la pareja rival esperando respuesta): `before = f.sets` (oficial), `after = f.pendingCorrectionSets`.
- `bramulab/index.html`/`styles.css` — dos `<ul class="b6-correction-diff">` nuevas (`#b6-status-banner-diff`, `#b6-respond-correction-diff`), estilo compacto/secundario, mismo criterio que `.coverage-note`.

El Resumen sigue usando orientación canónica A/B en todo lo demás (sin cambios).

### Tests

- `bramulab/tests.html`, bloque `CORR-DIFF ·` (8 aserciones, pura, sin Supabase): pre-validación before/after, post-validación official vs pending, tercer set agregado, tercer set eliminado, sin corrección (mismos sets) ⇒ `[]`, ambos arrays vacíos/ausentes ⇒ `[]`, y un cambio solo en el tie break interno (mismo score de games) NO genera línea.
- `supabase/tests/verify-preprod-ux-correction-revision-diff.sql` — verificación transaccional (`BEGIN`/`ROLLBACK`, nunca deja fixtures) contra Staging real: requiere una cuenta real ya existente (mismo criterio que `verify-preprod-p01c-profile-editable.sql`, sesión simulada vía `set_config('request.jwt.claim.sub', ...)`). Cubre las 5 situaciones descriptas en su cabecera: revisión 1 sin anterior, corrección que agrega Set 3, corrección que lo elimina, post-validación oficial vs pendiente, y `pendingCorrectionSets` vuelve a `null` al limpiar el puntero. Incluye verificación de firma/permisos (misma firma `p_match_id uuid`, solo `authenticated`, nunca `anon`).

---

## Corrección 2 — Recientes no debe confundir provisionales

### Causa

`match-sync.js#buildLocalPlayers` estampa `userId` (= `player_id` real) desde `participant.playerId` tanto para participantes **registrados** como **provisionales** — un invitado también tiene un `player_id` real, solo que `type='provisional'` del lado del servidor, un dato que la forma local de un partido nunca lleva. `PH.computeRecentRealPlayers` (que solo filtra por `p.userId` truthy) no tenía forma de distinguir ambos casos: un invitado con el que se compartió un partido podía terminar apareciendo en RECIENTES, y `selectManualPlayer(name, playerId)` sin tercer argumento (`kind`) lo trataba por defecto como registrado.

### Corrección aplicada

`bramulab/app.js#renderManualPlayerSheetContentServerBacked` — reordenado exactamente como se pidió: se resuelve primero `provisionalById` (los mismos dos resultados que ya se pedían para INVITADOS — `Matches.listRelatedProvisionalPlayers()` + `Auth.listMyProvisionalPlayers()`, sin ninguna RPC nueva), y RECIENTES se calcula después, excluyendo esos `player_id` además de `excludedIds` (los ya asignados a otro lugar del partido en curso). `PH.computeRecentRealPlayers` en sí **no cambió** — sigue sin poder distinguir provisional de registrado por diseño (documentado en el primer assert del test nuevo); la exclusión ocurre en la orquestación de `app.js`, que sí tiene la información completa.

Un invitado sigue siendo perfectamente seleccionable por INVITADOS — nada de esa sección se tocó.

### Tests

`bramulab/tests.html`, bloque `V25UX-N` (2 aserciones nuevas): (1) documenta el bug — sin `excludeIds`, un participante con forma idéntica a un provisional (`userId` estampado igual que un registrado) aparece en el resultado crudo de `computeRecentRealPlayers`; (2) prueba el mecanismo de la corrección — pasando ese mismo `player_id` en `excludeIds` (lo que `app.js` ahora hace vía `provisionalById`), nunca aparece, mientras que un participante registrado real sigue apareciendo. La protección de homónimos (ya cubierta en la ronda anterior) sigue intacta.

---

## Notificaciones

Sin cambios — como se indicó, el faltante de actor en `match_validated`/`correction_accepted`/`identity_resolved`/`identity_unidentified`/`admin_action` queda para la Ronda 2 / bloque de Notificaciones del handoff 13. No se agregaron llamadas de red nuevas.

---

## Archivos cambiados

| Archivo | Qué cambió |
|---|---|
| `bramulab/app.js` | `renderCorrectionDiff` + wiring pre/post-validación (Corrección 1); reordenamiento de RECIENTES para excluir provisionales (Corrección 2) |
| `bramulab/match-load.js` | `ML.buildCorrectionDiffLines` (nueva, pura) |
| `bramulab/match-sync.js` | `previousRevisionSets`/`pendingCorrectionSets` mapeados vía `buildLocalSets` |
| `bramulab/index.html` | 2 `<ul class="b6-correction-diff">` nuevas |
| `bramulab/styles.css` | estilo `.b6-correction-diff` |
| `bramulab/store.js` | `BUNDLE_VERSION` → `04.11-h3` |
| `bramulab/sw.js` | `CACHE_NAME`/`CORE_ASSETS` → `04.11-h3` |
| `bramulab/version.json` | `bundle` → `04.11-h3` |
| `bramulab/tests.html` | 8 aserciones `CORR-DIFF ·` + 2 aserciones `V25UX-N ·` (provisionales) |
| `supabase/migrations/20260925150000_preprod_ux_correction_revision_diff.sql` | nueva, aditiva — **no aplicada, pendiente de central** |
| `supabase/tests/verify-preprod-ux-correction-revision-diff.sql` | nueva |

Sin cambios en `bramulive/`, `main`, Production, Mis grupos, responsive de escritorio, Realtime/polling, fórmula de Nivel, reglas de Ranking, JUGADORES legacy, ni ninguna migración ya aplicada (todas las funciones tocadas se reemplazan con `CREATE OR REPLACE`, nunca se edita el archivo original).

---

## Tests ejecutados

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (sin cambios).
- `bramulab/tests.html` → **1496/1496 PASS** (1486 de la ronda anterior + 8 `CORR-DIFF` + 2 `V25UX-N` nuevas).
- Boot smoke test: `index.html` con bundle `04.11-h3`, todos los módulos 200 OK, sin errores de consola nuevos (mismo único 404 preexistente de `env.generated.js`, esperado sin Supabase configurado en este entorno local).
- `supabase/tests/verify-preprod-ux-correction-revision-diff.sql`: escrito y revisado manualmente con cuidado (mismo patrón que los verify existentes del proyecto), **no ejecutado desde esta sesión** — sin Supabase CLI/credenciales en este sandbox. Central lo ejecutará junto con la aplicación de la migración.

---

## Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h2` → **`04.11-h3`**.
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, todos los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## Riesgos residuales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Migración sin aplicar/verificar desde esta sesión | El contrato JSON final de `get_match_detail` (con los dos campos nuevos) no se probó contra Staging real | Central aplica la migración y corre `verify-preprod-ux-correction-revision-diff.sql` después de este push |
| Diff sin QA visual real | `renderCorrectionDiff`/`buildCorrectionDiffLines` están cubiertos por tests puros, pero nunca se vieron en pantalla contra un partido real con una corrección real | Pendiente de QA (Work/iPhone) junto con el resto de la Ronda 1, mismo motivo documentado en la ronda anterior (sin acceso a Staging desde este sandbox) |
| RECIENTES: la exclusión depende de que `listRelatedProvisionalPlayers`/`listMyProvisionalPlayers` sigan siendo exhaustivas | Si algún día esas RPC dejaran de cubrir "todo provisional con el que compartí partido", RECIENTES podría volver a filtrarse un invitado | Sin acción nueva — es el mismo contrato ya usado por INVITADOS, no se amplía ni se duplica |

---

## Decisiones abiertas

Ninguna decisión de producto nueva.

---

## Qué debe revisar ChatGPT central

1. HEAD de `staging` (diff + este documento).
2. Aplicar `supabase/migrations/20260925150000_preprod_ux_correction_revision_diff.sql` contra Supabase Staging real.
3. Ejecutar `supabase/tests/verify-preprod-ux-correction-revision-diff.sql` contra Staging tras aplicar la migración.
4. Confirmar que ambas correcciones (diff antes/después, RECIENTES sin provisionales) cierran el Bloque 1 para autorizar la Ronda 2 (jerarquía visual) del handoff 13.

No se pidió nada a Sebastián. Frenado después del push, a la espera de la aplicación/verificación de la migración y la revisión de HEAD por central.
