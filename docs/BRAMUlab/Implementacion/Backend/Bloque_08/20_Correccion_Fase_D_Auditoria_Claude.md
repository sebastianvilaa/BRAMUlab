# Backend Bloque 8 — Corrección de Fase D: auditoría persistida (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Corrige:** `19_Revision_Central_Fase_D_Auditoria.md` — **D06** (único punto pendiente antes de aplicar Supabase Staging).
**Alcance ejecutado:** únicamente D06. D01–D05 y H01 quedaron **aprobados** por la revisión y no se reabrieron — cero cambios en `intelligence-context.js`/`intelligence-claims.js` (Fases A/B), cero cambios de scoring/selección en Fase C, cero cambios de templates/copy ya aprobados en Fase D. No se avanzó a Fase E. No se tocó Nivel, Ranking, capa generativa, Mis Grupos, `main`, Production ni BRAMUlive. No se aplicó ninguna migración ni se deployó la Edge Function.

Cero cambios de frontend: D06 no modifica nada que corra en el navegador (los 4 módulos puros de Intelligence solo corren server-side, vía la Edge Function) — **sin bump de bundle**, tal como pedía la corrección.

---

## D06 — persistencia de auditoría completa de BRAMU Intelligence

**Bloqueante antes de aplicar la migración.**

**Problema:** cada checkpoint persistido guardaba `output` (la salida visible) y `memory_after` (la memoria interna), pero no la decisión auditable completa — el claim estructurado de cada candidato de Fase B (incluidos los descartados), la evaluación editorial de Fase C (score/subscores/penalizaciones/motivo de exclusión de cada candidato) y la relación exacta entre esa decisión y lo finalmente presentado. Esa información existía durante la ejecución de A→B→C→D, pero se perdía al terminar la request — una salida histórica no podía auditarse sin volver a ejecutar las reglas ACTUALES sobre datos que ya pueden haber cambiado, justo lo que la fuente busca evitar (`BRAMU_Intelligence.md` §6.5).

### Separación de responsabilidades (tal como sugería la revisión)

**1. Fase C extiende su contrato de retorno, sin cambiar ninguna lógica** (`bramulab/intelligence-editorial.js`, `buildEditorialDecision`): ahora devuelve también `allClaims`, la lista COMPLETA que ya recibe de Fase B (`CL.buildClaimsForMatch`) — afirmados y descartados por evidencia/muestra insuficiente, tal cual, sin tocarla. `evaluated`/`principal`/`secondary`/`abstention`/`memoryUpdate` siguen calculándose exactamente igual que antes, a partir de `affirmed` (el filtro que ya existía) — `allClaims` nunca participa de ninguna decisión de puntaje o selección, es un adjunto puro para quien quiera auditar. Cambio de 2 líneas, ambas en los 2 puntos de `return` de la función.

**2. Fase D construye el snapshot inmutable** (`bramulab/intelligence-presentation.js`, funciones nuevas):

- `summarizeClaimForAudit(c)` / `summarizeEvaluatedForAudit(e)`: copian explícitamente (nunca un spread ciego) los campos de un claim de Fase B o de una entrada evaluada de Fase C — un contrato de auditoría intencional y versionado, no lo que sea que esos módulos devuelvan internamente en el futuro.
- `buildAuditSnapshot(decision, rendered, callerPlayerId, fingerprint, rulesVersionCombined)`: el snapshot final, construido ÚNICAMENTE a partir de lo que `decision` (C, incluido `allClaims`) y `rendered` (este mismo módulo) ya calcularon — nunca recalcula ni re-deriva nada. Contiene: `matchId`, `perspectivePlayerId`, `dataAsOf`, `fingerprint`, las 4 versiones de reglas + la combinada, `claims` (todo Fase B, mapeado), `evaluated` (todo Fase C afirmado, con score/motivo, mapeado), `abstention`, `principal`/`secondary` (con su `templateId`/`semanticKey` final, cruzando `decision` con `rendered` por índice — `renderIntelligence` los mapea 1 a 1, nunca los reordena) y los mensajes de aprendizaje/fallback.

**3. `runIntelligenceReplay` devuelve `audit` por paso**, junto a `output`/`memoryAfter`: para un paso reutilizado, `audit: existing.audit` (nunca se regenera solo porque se reutiliza el resto — la revisión lo pide explícitamente); para uno regenerado, `audit: buildAuditSnapshot(...)`.

**4. La Edge Function persiste los tres campos** (`upsert` con `output`/`memory_after`/`audit`) y sigue devolviendo ÚNICAMENTE `output` en la respuesta HTTP — `audit` nunca sale de la base de datos hacia el cliente.

### Migración — reemplazada directamente (todavía no aplicada)

`supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql`: se agregó la columna `audit jsonb not null` a `intelligence_match_outputs`, siguiendo la misma instrucción que D01 (la migración nunca se aplicó a Supabase, así que se modifica en el lugar, sin migración compensatoria). Sigue RLS deny-by-default, `service_role` únicamente — la tabla completa (incluida esta columna nueva) nunca es accesible por `authenticated`/`anon`.

### Por qué no hace falta guardar historial crudo dentro de `audit`

Tal como autorizó la revisión: los `evidenceMatchIds` de cada claim + los propios `matchId`/`playedAt` del snapshot ya son la evidencia trazable — nunca se duplican `sets`/`players` completos de cada partido dentro de `audit` (esa información ya vive en la historia real, consultable por `matchId` si algún día hiciera falta una herramienta administrativa).

---

## Tests mínimos D06 (los 8 pedidos por la revisión, todos verdes)

Todos nuevos en `intelligence-presentation.test.mjs`, salvo el complementario en `intelligence-editorial.test.mjs`:

1. **D06.1** — un checkpoint nuevo contiene `audit`.
2. **D06.2** — `audit.claims` contiene el claim estructurado + `evidenceMatchIds` + `comparisonScope` + `sampleSize` + `confidenceTier` + `officialScope` de un candidato afirmado real.
3. **D06.3** — un claim descartado por Fase B (`companero_balance` con solo 3 partidos, mismo fixture que el test #13 de C) queda en `audit.claims` con `discarded:true` y `discardReasonCodes` no vacío.
4. **D06.4** — con una historia rica (10 partidos), al menos un candidato evaluado por C que no terminó seleccionado conserva su `editorialStatus` y, según el caso, su `excludedReason` o su desglose de `score`.
5. **D06.5** — `audit.principal`/`audit.secondary` coinciden exactamente (`templateId`/`semanticKey`) con `output.principal`/`output.secondary`.
6. **D06.6** — un checkpoint reutilizado (mismo fingerprint+rules_version en una segunda pasada) conserva el `audit` byte a byte idéntico al de la primera generación.
7. **D06.7** — `output` (lo que efectivamente viaja al cliente) nunca tiene las claves `audit` ni `memoryUpdate`.
8. **D06.8** — la cantidad de `claims`/`evaluated` en `audit` coincide EXACTAMENTE con la de una decisión recalculada de forma independiente sobre el mismo prefijo+memoria (nunca hay más ni menos), y ningún `evidenceMatchId` referenciado es ajeno a la historia real del jugador.

Más un test complementario en `intelligence-editorial.test.mjs` (**D06**, junto al test #13 existente): confirma que `decision.allClaims` conserva el candidato descartado por B tal cual (con su `discardReasonCodes`), y que sigue sin aparecer entre los `evaluated`/seleccionados — la extensión de contrato nunca le da a un descarte de B una segunda vía para revivir en C.

## Tests y resultado

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs bramulab/intelligence-presentation.test.mjs` — **136/136 PASS** (128 de la ronda anterior sin cambios + 8 nuevos de esta corrección: 1 en editorial, 7 en presentation).

---

## Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**. Production: **no tocada**. BRAMUlive: **no tocado**. Mis Grupos: **no tocado**. Nivel/Ranking: **no integrados**.
- H01/D01–D05: **no reabiertos** — ningún cambio de esta corrección afecta scoring/selección de C, claims/reglas de B, ni templates/copy de D.
- Frontend: **no tocado**, sin bump de versión (D06 no tiene nada observable en el navegador).

---

## Supabase — sigue sin aplicarse

Este entorno sigue sin credenciales de Supabase Staging. Quedan preparados y documentados para ChatGPT central, ahora con la auditoría incluida:

1. **Migración** `supabase/migrations/20260923180000_bloque8_fased_intelligence_persistence.sql` — reemplazada en el lugar (mismo archivo, mismo timestamp): agrega `audit jsonb not null` a `intelligence_match_outputs`.
2. **Edge Function** `supabase/functions/get-match-intelligence/` — persiste y reutiliza `audit` en cada checkpoint; la respuesta al cliente no cambia (sigue siendo solo `output`).

---

## Siguiente paso recomendado

Según `19_Revision_Central_Fase_D_Auditoria.md` §7 ("Gate final de D"): revisión central corta de esta corrección → recién entonces ChatGPT central hace dry-run/aplica la migración en Supabase Staging → deploya `get-match-intelligence` → validación de seguridad/contrato en Staging real → QA visual/manual en Preview → cerrar Fase D → recién después preparar Fase E.
