# BRAMUlab — Resultado: hotfix validación atascada / self-healing implementado

**Rama:** `staging`
**Fecha:** 27/09/2026
**Bundle:** `04.11-h10` → `04.11-h11` (hotfix, no nueva función de producto)
**Origen:** handoff [`37_Handoff_Hotfix_Validacion_Self_Healing_27SEP.md`](37_Handoff_Hotfix_Validacion_Self_Healing_27SEP.md), evidencia real de Laboratorio físico sobre el partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd`.

---

## 1. Causa raíz (confirmada por código, sin cambios de esta ronda)

El backend ya implementaba el contrato de recuperación completo:

- `confirm_match_validation` soporta exactamente el estado atascado (`status=pending_validation`, `action_side IS NULL`, sin incidencia abierta, deadline vigente) devolviendo `{ok:true, code:'already_confirmed', readyForValidation:true, idempotentReturn:true}`;
- la Edge Function `supabase/functions/officialize-match/index.ts` documenta explícitamente (líneas 23-26) el "reintento silencioso que el cliente dispara al detectar `readyForValidation=true` en una lectura";
- `matches.js`/`match-sync.js` ya transportaban `readyForValidation`/`hasOpenIdentityIssue` correctamente hasta la forma local.

Pero **`app.js` nunca consumía `readyForValidation`**: `refreshServerMatches()` solo guardaba el cache, y `paintB6Actions()` (confirmado leyendo `bramulab/app.js:2711`) solo ofrece la vía "esperando a la otra pareja" cuando `f.actionSide` es verdadero — con `actionSide=null` (ambas parejas ya confirmaron) ninguna rama de `paintB6Actions` pinta banner ni CTA, dejando el partido sin ninguna vía de recuperación desde la UI si la oficialización inicial falló después de la segunda conformidad. Esto es exactamente lo que le pasó al partido real `aa41e8d9-...`.

No se tocó `confirm_match_validation` ni `officialize_match_validation` — no había evidencia nueva que lo justificara, y el propio handoff prohibía reabrirlos sin ella.

---

## 2. Solución implementada

### Módulo nuevo: `bramulab/match-self-heal.js`

IIFE UMD puro (mismo patrón que `match-validation.js`/`match-sync.js`), sin red ni DOM propios — expone `window.PLMatchSelfHeal`:

- `isSelfHealCandidate(match)` / `findSelfHealCandidateIds(matches)`: único criterio de elegibilidad — `status==='pending_validation' && readyForValidation===true && !hasOpenIdentityIssue`.
- `runSelfHeal(matches, { officializeMatch, inFlightMatchIds })`: por cada candidato, intenta como máximo UNA vez `officializeMatch(matchId)`. Guardia contra llamadas duplicadas/concurrentes vía un `Set` que el caller persiste entre corridas (`inFlightMatchIds`): el check-and-add de cada candidato ocurre de forma síncrona, antes del primer `await` de su propio intento, así que dos `runSelfHeal` superpuestos para el mismo `matchId` nunca oficializan dos veces. Un fallo (de negocio o excepción real) queda solo en consola (`console.warn`, nunca un `throw`, nunca un toast) — no genera loop ni segundo intento en el mismo ciclo; el partido queda disponible para un intento futuro en una lectura posterior.

### Integración: `refreshServerMatches()` (`bramulab/app.js`)

Único choke point tocado, tal como recomendaba el handoff (ya es la lectura canónica al abrir Home/Historial y tras cada acción B6):

1. lee `get_my_matches` (sin cambios);
2. llama `SH.runSelfHeal(freshMatches, { officializeMatch: MV.officializeMatch, inFlightMatchIds: selfHealInFlightMatchIds })` — nuevo `Set` de módulo (`selfHealInFlightMatchIds`, junto a `justActedMatchIds`);
3. si algo se oficializó (`healed.healedAny`), hace **una** relectura canónica adicional (`Matches.getMyMatches`) y usa ese resultado en vez del original — sin volver a invocar `SH.runSelfHeal` sobre esa relectura (self-heal desactivado para la reentrada, tal como pedía el paso 5 del handoff);
4. el resto de la función (detección de cambios externos, cache, badge de no vistos) sigue exactamente igual que antes, ahora operando sobre `freshMatches` en vez de `result.matches` directamente.

Nunca se agregó polling, timers ni un intervalo de fondo — el self-heal solo corre dentro de una lectura que ya iba a ocurrir por otro motivo. No se tocó `paintB6Actions` ni ningún otro flujo de UI: sin CTA nuevo, sin toast, sin mensaje "Partido confirmado" — el partido converge a `validated` en el próximo refresco de pantalla, que ya sucede solo (por ejemplo, reabrir Home/Historial dispara `refreshServerMatches` de nuevo y pinta el estado ya oficializado).

---

## 3. Archivos tocados

| Archivo | Qué cambió |
|---|---|
| `bramulab/match-self-heal.js` | **Nuevo.** Módulo puro de detección + orquestación del self-heal. |
| `bramulab/app.js` | Alias `SH`, `Set selfHealInFlightMatchIds`, `refreshServerMatches()` integra self-heal + relectura condicional. |
| `bramulab/index.html` | `<script src="match-self-heal.js?v=04.11-h11">` agregado (entre `match-validation.js` y `intelligence-client.js`), cuarteto de versión bumpeado. |
| `bramulab/sw.js` | `match-self-heal.js` agregado a `CORE_ASSETS`, `CACHE_NAME` bumpeado. |
| `bramulab/store.js` | `BUNDLE_VERSION` bumpeado. |
| `bramulab/version.json` | `bundle` bumpeado. |
| `bramulab/match-self-heal.test.mjs` | **Nuevo.** 9 tests dinámicos sobre el módulo puro real (vm sandbox). |
| `bramulab/refresh-server-matches-self-heal.test.mjs` | **Nuevo.** 5 tests estáticos sobre la orquestación real en `app.js` (mismo mecanismo que `login-resume-session.test.mjs`, ya que `app.js` no corre en `vm`). |

No se tocó `confirm_match_validation`, `officialize_match_validation`, Ranking, Intelligence, P0.2, P0.3, `paintB6Actions`, ni ningún archivo fuera de `staging`.

---

## 4. Tests

### Cobertura de los 8 casos mínimos del handoff §5

| # | Caso | Dónde |
|---|---|---|
| 1 | `pending_validation+readyForValidation=true` → exactamente 1 invocación a `officializeMatch` | `match-self-heal.test.mjs` |
| 2 | `pending_validation+readyForValidation=false` → nada | `match-self-heal.test.mjs` |
| 3 | `validated` → nada (aunque `readyForValidation` viniera `true`) | `match-self-heal.test.mjs` |
| 4 | identidad abierta → nada | `match-self-heal.test.mjs` |
| 5 | fallo (negocio o excepción) → sin loop, sin segunda llamada en el ciclo | `match-self-heal.test.mjs` (2 tests: `{ok:false}` y excepción real) |
| 6 | éxito → exactamente 1 relectura canónica, self-heal no se reinvoca sobre ella | `refresh-server-matches-self-heal.test.mjs` (guarda estática sobre `app.js`) |
| 7 | 2 refrescos concurrentes → sin oficialización duplicada del mismo partido | `match-self-heal.test.mjs` |
| 8 | sin toast de acción manual por el self-heal | `refresh-server-matches-self-heal.test.mjs` (confirma que `refreshServerMatches` nunca llama `showToast`) |

`match-self-heal.js` se testea dinámicamente (vm sandbox, mismo patrón que `match-validation.test.mjs`) porque es un módulo puro sin dependencia de `document`/`window`. `refreshServerMatches` vive dentro de `app.js`, que — igual que documenta `login-resume-session.test.mjs` — asume `document`/`window` reales desde la primera línea y no corre en `vm`; su parte de orquestación (única invocación a `runSelfHeal`, relectura gateada por `healed.healedAny`, ausencia de `showToast`) se cubre con guardas estáticas sobre el código fuente, mismo mecanismo ya establecido en el repo.

### Regresión

- **Suite Node completa:** `node --test bramulab/*.test.mjs supabase/functions/_shared/*.test.mjs supabase/scripts/*.test.mjs` → **303/303 OK** (289 previas + 14 nuevas de este hotfix).
- **`tests.html`** (servido en un puerto nuevo para evitar cache HTTP del navegador): **1564/1564 tests OK — todo verde**, sin cambios respecto de la baseline (el harness no carga `app.js`/`matches.js`/`match-validation.js` por diseño, así que `match-self-heal.js` tampoco se agregó ahí — mismo criterio ya documentado en el propio `tests.html`).
- **Smoke boot de `index.html`** (mismo servidor local, puerto nuevo): sin errores de consola nuevos; `window.PLMatchSelfHeal` presente con las 3 funciones esperadas; `PLStore.BUNDLE_VERSION === '04.11-h11'`; pantalla de login renderiza normal. El único 404 observado (`env.generated.js`) es un artefacto de build de Vercel, ya documentado como esperado en entorno local sin build — no relacionado con este cambio.

---

## 5. Bundle, commit y deploy

- **Bundle:** `04.11-h10` → `04.11-h11`, cuarteto completo (`index.html` 19→20 tags `?v=`, `sw.js` `CACHE_NAME`+`CORE_ASSETS`, `store.js` `BUNDLE_VERSION`, `version.json`), bumpeado una sola vez, al final, después de todo el resto del trabajo.
- **Commit:** único, lógico, con el detalle de causa raíz/archivos/tests en el mensaje.
- **Push:** `origin/staging`.
- **Deploy:** Vercel Staging — este round SÍ toca `bramulab/`, así que dispara build real (a diferencia de las rondas puramente documentales de P0.2/P0.3).

---

## 6. Partido real `aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

**No se tocó por SQL manual**, tal como exigía el handoff. Queda tal cual está en Supabase Staging (`pending_validation`, `action_side=null`, `readyForValidation=true` por contrato de lectura) para que el frontend `04.11-h11` lo detecte y lo auto-repare mediante el camino real `officialize-match` la próxima vez que alguna de las 4 personas involucradas abra Home/Historial (o cualquier otra pantalla que dispare `refreshServerMatches`) contra Staging ya con el bundle nuevo desplegado. Esto convierte el mismo caso roto en la prueba E2E real del hotfix.

---

## 7. Riesgos residuales reales

- El self-heal depende de que **alguna** de las 4 personas del partido abra la app contra Staging con el bundle `04.11-h11` ya desplegado — no hay ningún mecanismo push/realtime que lo dispare antes (deliberado, por diseño, para no convertir esto en polling).
- Si la causa original del fallo de oficialización fuera persistente (no transitoria) para este partido puntual, el self-heal reintentará una vez por cada lectura futura sin loop — pero seguiría sin oficializar hasta que esa causa se resuelva. No hay evidencia de que eso aplique acá: Central ya verificó que el backend actualizado oficializa correctamente este partido real cuando la llamada efectivamente llega.
- `selfHealInFlightMatchIds` es un `Set` en memoria de la pestaña/sesión del navegador — no persiste entre recargas ni se comparte entre pestañas. Esto es intencional (la guardia solo necesita cubrir corridas concurrentes dentro de la misma sesión viva) y no representa un riesgo nuevo: dos pestañas distintas del mismo usuario intentando oficializar el mismo partido a la vez seguirían siendo seguras gracias a la idempotencia ya existente del lado del servidor (`officialize-match`/`officializeMatch` core, sin cambios de esta ronda).

**No se cierra el punto D del Laboratorio.** Queda pendiente que Central confirme, contra Staging real, que el partido `aa41e8d9-...` efectivamente convergió a `validated` tras el deploy — recién ahí corresponde pedirle a Sebastián que repita la validación física.
