# BRAMUlab — Resultado: fix P0 precisión de oficialización

**Rama:** `staging`
**Fecha:** 26/09/2026
**HEAD base:** `3c21a14` (`docs(preprod): aislar P0 de precision en oficializacion`)
**Origen:** handoff [`23_Handoff_Fix_P0_Precision_Officialization_26SEP.md`](23_Handoff_Fix_P0_Precision_Officialization_26SEP.md), a partir de la reproducción transaccional REAL hecha por Central contra Supabase Staging (partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd`).

No se reabrió el Laboratorio ni ninguna UX ya cerrada en `04.11-h9` (notificaciones, header iPhone, CTA "+", metadata de Cargar partido, Historial, Home, editor de corrección, Mis Jugadores/fila compacta) — este documento cubre exclusivamente el fix de precisión pedido por el handoff 23.

---

## 1. Causa raíz (ya confirmada por Central, resumida acá para trazabilidad)

Central reprodujo el bloqueo real ejecutando el motor JS real (`engine.js`/`level.js`/`level-context.js`/`match-sync.js`/`match-level-engine.js`) contra datos reales de `get_match_officialization_snapshot`/`get_player_match_history_for_level_engine` del partido `aa41e8d9-...`, y llamando `officialize_match_validation` dentro de `BEGIN;...ROLLBACK;` con el payload REAL calculado. Resultado exacto:

```json
{"ok": false, "code": "stale_level_snapshot", "playerId": "98442582-8440-4076-b028-1681c0f33906"}
```

**Causa:** el optimistic lock de `officialize_match_validation` compara `mu`/`confidence`/`evidence_units` con igualdad EXACTA (`is distinct from` sobre el `numeric` crudo). Esos valores viajan Postgres NUMERIC → JSON → JavaScript Number → JSON → NUMERIC. Para el jugador que dispara el error, `level_states.evidence_units::text` real es `2.4797000000000004`; al pasar por JSON/IEEE-754 en JavaScript ese mismo valor de negocio se representa como `2.4797000000000002` — un artefacto binario de representación, nunca un cambio real de Nivel. La comparación exacta siempre rechaza ese caso, el core reintenta 3 veces con el mismo mismatch y termina en `stale_snapshot_retries_exhausted` (el HTTP 500 real observado en Staging entre 17:06-17:11 UTC).

El origen del decimal largo: la fórmula normativa trabaja con precisión interna de 4 decimales (`level.js#PARAMS.INTERNAL_DECIMALS`/`roundInternal`), pero `match-level-engine.js#computeLevelStateUpdates` hacía la aritmética de `finalConfidence`/`finalEvidenceUnits` (resta/suma de efectos) en JS puro, sin normalizar el resultado a esa precisión antes de persistirlo — dejando artefactos binarios más allá del cuarto decimal en columnas `numeric` sin escala fija.

---

## 2. Fix — capa A: optimistic lock SQL robusto a la precisión normativa

Migración nueva y aditiva: [`20260927140000_preprod_fix_officialize_precision_lock.sql`](../../../../supabase/migrations/20260927140000_preprod_fix_officialize_precision_lock.sql).

`create or replace function public.officialize_match_validation(...)` con la **misma firma exacta** de 27 parámetros que la versión vigente (`20260924110000_bloque6_public_match_outcomes.sql`) — a diferencia de esa migración (que sí cambió la firma y necesitó `drop function` antes), esta no agrega ni quita ningún parámetro, así que no hace falta `drop function`. Se preservó el 100% del cuerpo/contrato/lógica de la función, carácter por carácter, salvo el único bloque que cambia:

```sql
-- antes (igualdad exacta):
v_current_level_state.mu is distinct from (v_update->>'currentMuForLock')::numeric
-- ...

-- ahora (igualdad redondeada a la precisión interna normativa):
round(v_current_level_state.mu, 4) is distinct from round((v_update->>'currentMuForLock')::numeric, 4)
-- mismo criterio para confidence y evidence_units
```

`4` queda como literal en SQL (no hay forma de importar `Level.PARAMS.INTERNAL_DECIMALS` desde Postgres) — documentado explícitamente en el comentario de la función y de la migración: si esa constante cambia algún día en `level.js`, esta función SQL debe actualizarse junto con ese cambio normativo. El lock sigue vivo: una diferencia real (≥ 0.0001) en cualquiera de los 3 campos sigue devolviendo `stale_level_snapshot` exactamente igual que antes — el fix no debilita la detección de carreras reales, solo deja de rechazar ruido de representación que el propio motor ya considera "el mismo valor".

No se tocó ningún otro comportamiento de la función (idempotencia, revisión esperada, bookkeeping de corrección/identidad, `winner_team`, notificaciones, etc.).

---

## 3. Fix — capa B: canonicalización JS antes de persistir

[`bramulab/match-level-engine.js`](../../../../bramulab/match-level-engine.js) (symlinked real hacia `supabase/functions/_shared/match-level-engine.js`, usado server-side por las Edge Functions):

- Nuevo helper local `roundToInternalDecimals(n)`, que redondea con `Math.pow(10, Level.PARAMS.INTERNAL_DECIMALS)` — nunca un `4` hardcodeado en JS, siempre leído de la fuente normativa (`level.js`).
- Aplicado en `computeLevelStateUpdates`, en las dos ramas (reversión pura y aplicación con `newP`), a los 5 valores que el handoff señaló:
  - `finalConfidence` y `finalEvidenceUnits` (antes: aritmética JS cruda sin normalizar).
  - `currentMuForLock`, `currentConfidenceForLock`, `currentEvidenceUnitsForLock` (defensa/canonicalización del payload que viaja al lock SQL — así ambos lados de la comparación, DB y payload, quedan en la misma representación redondeada antes de siquiera necesitar el `round()` de la capa A).
- `finalMu` **no** se tocó — ya pasa por `Level.clampLevel`, que internamente ya redondea a la misma precisión (`roundInternal`).
- No se modificó ninguna fórmula de Nivel, ningún K/delta/expectativa/factor — el fix es exclusivamente de representación numérica al final del pipeline, nunca de cálculo.

---

## 4. Fix — segundo hallazgo: `FunctionsHttpError`/HTTP 4xx en el cliente

[`bramulab/match-validation.js`](../../../../bramulab/match-validation.js): nuevo helper único `invokeB6Function(c, functionName, body)`, usado ahora por las 4 funciones que invocan Edge Functions B6 (`officializeMatch`, `proposeMatchCorrection`, `respondMatchCorrection`, `resolveIdentityIssue`) — antes cada una repetía el mismo parseo inline (`(data && data.code) || error.message`), que dejó de ser correcto desde que `04.11-h9` empezó a devolver HTTP 409 real para códigos de negocio: supabase-js v2 **no** expone el body de negocio en `data` para una respuesta non-2xx — solo es recuperable vía `error.context.json()` (`error.context` es la `Response` cruda del fetch, contrato documentado de `FunctionsHttpError`). Sin este fix, un 409 real con `{ok:false, code:'match_expired'}` se perdía y degradaba al string genérico de `error.message` ("Edge Function returned a non-2xx status code"), que `B6_ERROR_MESSAGES` (`app.js`) no reconoce — el usuario veía siempre el mensaje default en vez del real.

El helper:
1. sin error → devuelve `data` tal cual;
2. con error y `error.context.json()` disponible → lo lee UNA vez; si el body trae `code`, lo devuelve tal cual;
3. si el parseo falla (error de red/`FunctionsFetchError`, de relay/`FunctionsRelayError`, o un body que no es JSON) → cae al mismo fallback de siempre (`data && data.code`, luego `error.message`);
4. nunca expone `detail`/`hint` internos — esos ya no viajan desde el servidor desde la ronda anterior (`match-officialize-core.ts`).

No se tocaron las RPCs directas (`reportIdentityIssue`, `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`) — el handoff pidió el fix solo para las 4 que usan `functions.invoke`.

---

## 5. Datos existentes

No se propuso ni se aplicó ningún backfill. Con la comparación SQL redondeada, los estados existentes con artefactos binarios (como el jugador `98442582-...` del partido real) pueden seguir funcionando sin ninguna intervención manual — la próxima vez que ese jugador participe de un evento legítimo (partido, corrección, identidad), la capa B (JS canonicalizado) va a dejar su `evidence_units`/`confidence` ya limpios en `level_states`. No se mutó manualmente ningún dato de los partidos reales citados en el handoff.

---

## 6. Migración y redeploy que Central debe aplicar

- **Migración nueva** (no aplicada desde este sandbox, sin credenciales de Supabase): `20260927140000_preprod_fix_officialize_precision_lock.sql`. Aditiva, mismo criterio que rondas anteriores — Central la aplica contra Staging.
- **Redeploy de Edge Functions requerido:** aunque esta ronda no tocó directamente ningún `index.ts`, sí cambió `bramulab/match-level-engine.js` — el mismo archivo symlinked hacia `supabase/functions/_shared/match-level-engine.js`, consumido por las Edge Functions que calculan el payload de oficialización. Deno Deploy empaqueta el código en el momento del deploy (no sigue symlinks en vivo), así que las funciones que importan ese motor deben redesplegarse para que la canonicalización nueva tome efecto en producción. Este repo no expone directamente qué Edge Function importa `match-level-engine.js` de forma transitiva más allá de las 3 ya redesplegadas en la ronda anterior (`officialize-match`, `resolve-identity-issue`, `respond-match-correction`, que llaman a `match-officialize-core.ts`, y ese archivo es quien construye el payload con el motor) — Central debe confirmar la cadena de imports real y redesplegar como corresponda.
- `match-validation.js` es frontend puro (cargado por `index.html` vía `<script>`, no una Edge Function) — el fix del helper `invokeB6Function` queda activo apenas se publique el nuevo bundle `04.11-h10`, sin ningún paso de deploy de backend adicional.

---

## 7. Reproducción esperada (Central, después de aplicar la migración)

Según el handoff §8: reconstruir el payload REAL del partido `aa41e8d9-...` (ya con el motor JS actualizado, que va a entregar `currentEvidenceUnitsForLock` canonicalizado) y llamar `officialize_match_validation` dentro de `BEGIN;...ROLLBACK;` — debe devolver `ok:true`, no `stale_level_snapshot`. Solo si eso pasa, Central puede considerar cerrado el root cause técnico antes del QA humano.

---

## 8. Tests

### SQL (escrito, NO ejecutado — sin Supabase CLI/credenciales en este sandbox, igual que todas las rondas anteriores)

[`supabase/tests/verify-preprod-fix-officialize-precision-lock.sql`](../../../../supabase/tests/verify-preprod-fix-officialize-precision-lock.sql) — transaccional (`BEGIN`/`ROLLBACK`), sin fixtures residuales. Cubre los 5 puntos pedidos por el handoff:

1. estado DB (`level_states`) con el decimal largo REAL del handoff (`evidence_units = 2.4797000000000004`, persistido exacto — `numeric` es precisión arbitraria en Postgres, a diferencia de un float JS);
2. payload del caller con la variante IEEE-754 vecina exacta del handoff (`2.4797000000000002`, también replicada para `mu`/`confidence`);
3. **Caso A** — ese payload NO debe devolver `stale_level_snapshot` (`ok:true`), y confirma además que `level_states` sí quedó escrito;
4. **Caso B** — un payload con diferencia REAL (`2.4797` vs `2.4800`, > 4 decimales) en `evidence_units` SÍ debe devolver `stale_level_snapshot`, con el `playerId` correcto, y confirma que NO se escribió nada (el lock rechaza antes de mutar);
5. **Caso C** — mismo criterio para `mu` con una diferencia real, aislado de `confidence`/`evidence_units` (que quedan limpios), para probar que cualquiera de los 3 campos por sí solo dispara el rechazo — "mismo criterio para mu; confidence; evidence_units", como pide el handoff;
6. rollback limpio al final, sin dejar ningún jugador/partido de prueba en la base.

### JS (ejecutado en este sandbox)

- `bramulab/match-level-engine.test.mjs` — 7 tests nuevos: `roundToInternalDecimals` colapsa un arrastre real de aritmética flotante (`2.48 - 0.0003 + 0.0000000004`) y el clásico `0.1+0.2` al mismo valor de 4 decimales; valores no finitos pasan intactos; `finalConfidence`/`finalEvidenceUnits` quedan canonicalizados en ambas ramas (con `newP` y reversión pura); `currentMuForLock`/`currentConfidenceForLock`/`currentEvidenceUnitsForLock` quedan canonicalizados — dos snapshots LIVE que solo difieren en ruido IEEE-754 producen el **mismo** payload de lock; canonicalizar no cambia el resultado deportivo/fórmula (`finalMu`/`finalConfidence` idénticos entre una entrada limpia y una con ruido).
- `bramulab/match-validation.test.mjs` — nuevo archivo, 10 tests: éxito 2xx normal; `data` vacío/no-objeto; recuperación real del `code` desde `error.context.json()` (reproduce el 409 real del handoff §7); mismo comportamiento para los 4 tipos de trigger; `error.context.json()` que rechaza (body no era JSON) → fallback seguro sin propagar la excepción; error sin `context` (red/relay) → fallback directo; body parseable sin campo `code` → no se usa como si fuera de negocio; nunca expone `detail`/`hint`; guarda estática confirmando que las 4 funciones públicas usan `invokeB6Function` y ninguna llama a `c.functions.invoke` directo.

### Regresión

- `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs` → **270/270 PASS** (253 previas + 17 nuevas).
- `bramulab/tests.html` → **1564/1564 PASS**, sin regresión.
- Boot smoke test: `index.html` (todavía bundle `04.11-h9` al momento de este smoke, antes del bump), sin errores de consola nuevos (único 404 preexistente: `env.generated.js`). Confirmado en consola: `PLMatchValidation.invokeB6Function` expuesto y cargado correctamente. `match-level-engine.js` **no** se carga en el cliente (no aparece en `index.html`/`sw.js` — es exclusivamente server-side vía symlink), así que el cambio de esa capa no es observable desde el boot del navegador; su verificación real depende del verify SQL + la reproducción de Central contra Staging.

---

## 9. Bundle

- Versión pública: `BRAMUlab V04.11` (sin cambios).
- Bundle técnico: `04.11-h9` → **`04.11-h10`** (único bump de esta ronda).
- Sincronizados: `version.json`, `Store.BUNDLE_VERSION`, los `?v=` de `index.html`, `sw.js#CACHE_NAME`, `sw.js#CORE_ASSETS`.

---

## 10. Riesgos residuales reales

| Riesgo | Detalle | Mitigación |
|---|---|---|
| Verify SQL nunca corrido contra Postgres real | Sin Supabase CLI/credenciales en este sandbox — escrito siguiendo el patrón ya validado de `verify-bloque6-public-match-outcomes.sql`, pero sin ejecución real | Central aplica la migración y corre este verify antes de dar por cerrado el root cause |
| Reproducción del caso REAL (partido `aa41e8d9-...`) todavía pendiente | El verify prueba la PROPIEDAD del fix con fixtures sintéticos fieles al caso real (mismos valores literales del handoff), pero no reconstruye el payload real de ESE partido específico contra Staging | Central repite exactamente la reproducción transaccional que ya hizo antes del fix (handoff §2), ahora con la migración aplicada — debe devolver `ok:true` |
| Cadena de imports de Edge Functions no confirmada end-to-end desde este sandbox | Se identificó que `match-officialize-core.ts` construye el payload con el motor, pero no se pudo confirmar con `deno check`/inspección de deploy real cuáles Edge Functions necesitan redeploy más allá de las 3 ya identificadas en la ronda anterior | Central confirma la cadena real antes de redesplegar |
| `invokeB6Function` sin prueba contra un servidor Supabase real | Los 10 tests usan un cliente fabricado (`c.functions.invoke` mockeado) que simula fielmente el contrato documentado de supabase-js v2, pero nunca se ejecutó contra una Edge Function real devolviendo un 409 real | Central: una corrección/identidad real contra Staging después del redeploy, confirmando que el mensaje de error que ve el usuario ya no es el genérico |

---

## 11. Qué quedó fuera / se mantuvo intacto (según el handoff §9 y §11 heredado)

Se conservó sin tocar: logging nuevo del core, idempotencia `already_validated`, títulos de notificaciones, header iPhone, CTA "+", metadata de Cargar partido, Historial, Home, editor de corrección, Mis Jugadores/fila compacta. `main`, Production, BRAMUlive, Mis grupos, fórmula de Nivel (motor de cálculo, nunca tocado — solo su representación numérica final), reglas de Ranking, legal/P0.2, eliminación/P0.3, Realtime/polling, monetización.

---

## 12. Decisiones técnicas menores resueltas sin marcar como abiertas

- Precisión de comparación en SQL: `4` decimales literal (no una constante importable desde Postgres), documentado en 2 lugares (comentario de función + comentario de migración) como dependiente de `level.js#PARAMS.INTERNAL_DECIMALS` — el handoff explícitamente pidió "usar la constante/decisión documental vigente de 4 decimales; no introducir tolerancias arbitrarias tipo 1e-6 si puede evitarse", así que se usó `round(..., 4)` en vez de una tolerancia épsilon.
- El verify SQL prueba los 3 campos del lock (`mu`, `confidence`, `evidence_units`) con 3 casos separados (A/B/C) en vez de uno solo combinado — permite aislar cuál campo específico dispara el rechazo, más útil para diagnóstico futuro que un único caso con los 3 campos "sucios" a la vez.
- `invokeB6Function` se expone en `PLMatchValidation` (no queda privado al closure) exclusivamente para permitir el test dirigido — no es parte de la superficie que consume `app.js`, que sigue llamando solo a las 4 funciones públicas de siempre.

Ninguna decisión de producto nueva quedó abierta.

---

## 13. Qué debe revisar Central

1. HEAD de `staging` (diff completo + este documento).
2. Aplicar `20260927140000_preprod_fix_officialize_precision_lock.sql` contra Staging y correr `verify-preprod-fix-officialize-precision-lock.sql`.
3. Repetir la reproducción transaccional real del partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd` (§7 arriba) — debe devolver `ok:true`.
4. Confirmar la cadena de imports real y redesplegar las Edge Functions que consumen `match-level-engine.js` (al menos las 3 ya redesplegadas en la ronda anterior).
5. Deploy a Staging (Vercel) con bundle `04.11-h10`.
6. Si el paso 3 pasa limpio, considerar cerrado el root cause técnico del P0 y decidir el retorno a Laboratorio.
