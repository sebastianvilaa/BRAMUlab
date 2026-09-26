# BRAMUlab — Handoff P0 precisión / optimistic lock de Nivel

**Fecha:** 26/09/2026  
**Rama autorizada:** `staging`  
**HEAD de partida esperado:** `5364cbf3d0776da5c16f5d07749b5b4c858250fa` (o el HEAD documental posterior si Central agregó solo documentación)  
**Bundle actual:** `04.11-h9`  
**Estado:** P0 ABIERTO — NO volver a Laboratorio todavía.

## 1. Qué pasó después de la entrega h9

Claude cerró la batería adicional y Central revisó/pusheó el paquete h9.

Central además hizo el redeploy REAL en Supabase Staging de las tres Edge Functions modificadas:

- `officialize-match` → ACTIVE v3;
- `respond-match-correction` → ACTIVE v3;
- `resolve-identity-issue` → ACTIVE v3.

Las tres comparten el nuevo `_shared/match-officialize-core.ts`.

El logging y el manejo idempotente agregados en h9 son útiles y deben CONSERVARSE.

Sin embargo, Central no dio por cerrado el P0 porque el partido real seguía `pending_validation` y el informe 22 reconocía que no había reproducido el error real de persistencia.

## 2. Causa raíz REAL reproducida por Central

Partido real de Staging:

`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

Central ejecutó el MISMO motor JS real usado por la Edge Function, cargando desde el repo:

- `engine.js`;
- `level.js`;
- `level-context.js`;
- `match-sync.js`;
- `match-level-engine.js`.

También leyó desde Supabase Staging real:

- `get_match_officialization_snapshot(match_id)`;
- `get_player_match_history_for_level_engine(...)`.

Con esos datos reconstruyó exactamente:

- `localMatch`;
- `playerStates`;
- `computeOfficializationResult`;
- `computeLevelStateUpdates`;
- `resultPlayers`;
- `levelStateUpdates`.

Resultado del motor para el partido:
- eligible=true;
- winnerTeam=A;
- knownLevelsCount=4;
- payload de Nivel coherente.

Luego Central llamó `officialize_match_validation` dentro de:

`BEGIN; ... ROLLBACK;`

con el payload REAL calculado.

Respuesta exacta:

```json
{
  "ok": false,
  "code": "stale_level_snapshot",
  "playerId": "98442582-8440-4076-b028-1681c0f33906"
}
```

Esto reproduce el bloqueo real sin mutar Staging.

## 3. Causa exacta

La optimistic lock de `officialize_match_validation` compara NUMERIC con igualdad exacta:

- `mu`;
- `confidence`;
- `evidence_units`;

contra los valores que viajaron:

Postgres NUMERIC → JSON → JavaScript Number → JSON → NUMERIC.

Para el jugador que dispara el error, el valor REAL persistido hoy es:

```
level_states.evidence_units::text
= 2.4797000000000004
```

El snapshot JSON llega a JavaScript y por representación IEEE-754 se convierte en:

```
2.4797000000000002
```

El motor lo reenvía como:

`currentEvidenceUnitsForLock = 2.4797000000000002`.

La RPC compara ese número contra:

`2.4797000000000004`

con `IS DISTINCT FROM`.

Por lo tanto SIEMPRE devuelve `stale_level_snapshot`, aunque ningún proceso concurrente haya cambiado el Nivel.

El core reintenta tres veces y obtiene exactamente el mismo mismatch; termina en `stale_snapshot_retries_exhausted` / error visible.

Esto explica el HTTP 500 real observado anteriormente.

## 4. Por qué existe ese decimal largo

La fórmula normativa trabaja con precisión interna de **4 decimales**.

`level.js`:
- `PARAMS.INTERNAL_DECIMALS`;
- `roundInternal(...)`;
- mu/confidence/evidenceQuality del motor se calculan a esa precisión.

Pero `match-level-engine.js#computeLevelStateUpdates` hoy hace aritmética JS sin normalizar al final:

```js
const finalConfidence =
  current.confidence - oldConfidenceEffect + newConfidenceEffect;

const finalEvidenceUnits =
  Math.max(0, (current.evidenceUnits || 0) - oldEvidenceEffect + newEvidenceEffect);
```

y luego esos números se persisten en columnas `numeric` sin escala fija.

Así pueden quedar artefactos binarios largos como:

`2.4797000000000004`.

El problema no debe resolverse ajustando ese jugador a mano.

## 5. Fix requerido

Resolver las DOS capas.

### A. Optimistic lock SQL robusta a la precisión normativa

Crear una NUEVA migración aditiva.

NO editar migraciones aplicadas.

Reemplazar `officialize_match_validation(...)` preservando todo su contrato y lógica, cambiando únicamente la comparación de locks numéricos para usar la precisión interna normativa.

Dirección:

```sql
round(v_current_level_state.mu, 4)
  is distinct from
round((v_update->>'currentMuForLock')::numeric, 4)
```

mismo criterio para:
- mu;
- confidence;
- evidence_units.

Usar la constante/decisión documental vigente de 4 decimales; no introducir tolerancias arbitrarias tipo 1e-6 si puede evitarse.

La optimistic lock debe seguir detectando cambios REALES de Nivel, solo ignorar diferencias inferiores a la precisión que el propio motor descarta.

NO eliminar el optimistic lock.

### B. Canonicalizar valores LIVE nuevos en JS antes de persistir

En `match-level-engine.js#computeLevelStateUpdates` normalizar a `Level.PARAMS.INTERNAL_DECIMALS`:

- `finalConfidence`;
- `finalEvidenceUnits`;
- si corresponde también los tres `current*ForLock` como defensa/canonicalización del payload.

`finalMu` ya pasa por `Level.clampLevel`, que redondea internamente.

No modificar la fórmula de Nivel.
Solo respetar su precisión interna definida.

Idealmente crear un helper local chico para no copiar la matemática de redondeo varias veces, usando `Level.PARAMS.INTERNAL_DECIMALS`.

No cambiar Nivel público ni algoritmo_version.

## 6. Datos existentes

NO hacer un backfill destructivo masivo salvo que sea estrictamente necesario.

Con la comparación SQL redondeada, los estados existentes con artefactos binarios pueden seguir funcionando.

Cuando esos jugadores vuelvan a escribirse por un evento legítimo, el nuevo JS dejará el valor canonicalizado.

Si decidís proponer un backfill, documentarlo como alternativa y NO aplicarlo sin Central.

## 7. Segundo hallazgo Central — errores 4xx de Edge Functions

h9 empezó a devolver HTTP 409 para varios códigos de negocio.

Eso es correcto a nivel HTTP, PERO el cliente vigente en:

`bramulab/match-validation.js`

hace:

```js
const { data, error } = await c.functions.invoke(...)
if (error) return {
  ok:false,
  code:(data && data.code) || error.message || 'unknown'
}
```

Supabase documenta que para una `FunctionsHttpError` el body de la función se obtiene desde:

`await error.context.json()`.

En un non-2xx, `data` no debe asumirse como el JSON de negocio.

Por eso, con h9, un 409 puede degradarse a:

`Edge Function returned a non-2xx status code`

y perder el `code` real que `B6_ERROR_MESSAGES` necesita.

### Fix frontend requerido

Crear un helper único para invocar las Edge Functions B6 que:

1. haga `functions.invoke`;
2. si no hay error, devuelva `data`;
3. si hay error HTTP y existe `error.context.json()`, intente parsear el body una sola vez;
4. si ese body trae `{ok:false, code}`, devuelva ese código real;
5. si no se puede parsear, recién ahí fallback a `error.message`;
6. nunca exponga detail/hint internos al usuario.

Usarlo al menos en:
- `officializeMatch`;
- `proposeMatchCorrection`;
- `respondMatchCorrection`;
- `resolveIdentityIssue`.

No cambiar las RPC directas.

Agregar tests dirigidos para 409 con body JSON y fallback sin body.

## 8. Tests obligatorios

### SQL / Staging

Crear verify transaccional para el lock de precisión.

Debe probar:

1. estado DB con decimal largo equivalente a 4 decimales;
2. payload JS/caller con la variante IEEE-754 vecina;
3. NO debe devolver `stale_level_snapshot`;
4. una diferencia REAL > precisión interna sí debe devolver `stale_level_snapshot`;
5. rollback limpio.

Después Central aplicará migración en Staging.

### JS

Probar:
- finalConfidence canonical 4 decimales;
- finalEvidenceUnits canonical 4 decimales;
- lock values canonicales;
- no cambio de resultado deportivo / fórmula;
- helper de Edge Functions recupera `code` desde `FunctionsHttpError.context.json()`;
- fallback seguro.

### Reproducción Central esperada

Después de aplicar:
- volver a reconstruir el payload REAL del match `aa41e8d9-...`;
- llamar `officialize_match_validation` dentro de BEGIN/ROLLBACK;
- debe devolver `ok:true`, no stale snapshot.

Luego, solo si eso pasa, considerar cerrado el root cause técnico antes del QA humano.

## 9. Mantener h9

NO revertir:
- logging nuevo del core;
- idempotencia `already_validated`;
- títulos de notificaciones;
- header iPhone;
- CTA +;
- metadata de Cargar partido;
- Historial;
- Home;
- editor de corrección;
- h8 Mis Jugadores / compact players.

## 10. Versionado

Mantener versión pública:

`BRAMUlab V04.11`

Bundle objetivo:

`04.11-h9 -> 04.11-h10`

UN bump final.

## 11. Salida

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/24_Resultado_Fix_P0_Precision_Officialization_26SEP.md`

Idealmente un commit:

`fix(preprod): corregir lock de precision de oficializacion`

Push a `origin/staging`.

NO aplicar la migración.
NO desplegar Edge Functions.
NO pedir QA a Sebastián.

Central revisará, aplicará Staging, repetirá la reproducción transaccional real y recién después decidirá si queda algo antes de volver a Laboratorio.
