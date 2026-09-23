# Backend Bloque 8 — Resultado de Fase B: Claims y evidencia (Claude Code)

**Fecha:** 23 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `e521f96` (Fase A cerrada en Staging, ver `05_Validacion_Central_Fase_A_Staging.md`).
**Alcance ejecutado:** únicamente **B — Claims y evidencia**, siguiendo `BRAMU_Intelligence.md`/`BRAMU_Intelligence_Implementacion.md` §10. No se avanzó a C — Relevancia y memoria editorial. No se tocó UI, plantillas finales ni capa generativa. No se tocó Fase A (`intelligence-context.js`, la migración de Bloque 8, `matches.js` ni contratos de Bloques 5–7). No se aplicó nada a Supabase.

---

## 1. Qué se implementó

Un módulo nuevo, `bramulab/intelligence-claims.js` (IIFE, `global.PLIntelligenceClaims`, simlinkeado en `supabase/functions/_shared/`), que construye **candidatos de insight estructurados con su evidencia** a partir de la capa ya cerrada de Fase A — por **composición pura** de la API pública de `PLIntelligenceContext` (`buildMatchDerivedContext`, `buildDecidedSequence`, `resolvePerspective`, `computeFormatFacts`, `computeRelationshipSummary` + sus 4 constructores de relación). Ningún archivo de Fase A se modificó: todo lo que Fase B necesitó ya estaba exportado.

### 1.1 Contrato del objeto de claim

Subconjunto deliberado de `BRAMU_Intelligence.md` §12.2 — incluye todo lo que es evidencia/comparabilidad, excluye explícitamente lo que es relevancia (Fase C) o redacción (Fase D):

```
{
  discarded, insightType, family, perspectivePlayerId,
  claim,                  // valores estructurados concretos (nunca la frase final)
  evidenceMatchIds,        // partidos fuente reales — nunca vacío si discarded=false
  comparisonScope, sampleSize, minSampleRequired, confidenceTier,
  officialScope,           // 'personal' | 'oficial' | 'mixto' | 'sin_evidencia' — derivado de
                            // officialEligible real de cada evidenceMatchIds, nunca asumido
  dataAsOf, rulesVersion,
  discardReasonCodes,      // solo cuando discarded=true
}
```

**Excluidos a propósito:** `salienceScore` (Fase C — puntaje de relevancia), `semanticKey` (Fase C — memoria editorial/deduplicación), `templateId` (Fase D — redacción). Incluirlos ahora hubiera significado tomar decisiones de relevancia/expresión bajo el nombre de "evidencia".

**Ningún candidato se omite en silencio.** Cuando la evidencia no alcanza el umbral, el candidato se registra igual con `discarded:true` + `discardReasonCodes` — mismo criterio que `eligible`/`reason_codes` de `match_level_results` y `is_eligible`/`eligibility_reason_codes` de `ranking_rows`. Esto es lo que hace verificable "0 claims sin evidencia": no es que no haya candidatos débiles, es que ninguno se afirma sin la muestra que exige.

### 1.2 Familias cubiertas y umbrales exactos aplicados

Todos los números están tomados literalmente de `BRAMU_Intelligence.md` §5 — ninguno se inventó. Se citan acá para que la revisión central pueda verificarlos sin releer el código:

| Familia | Claims | Umbral exacto | Fuente |
|---|---|---|---|
| **A — Estructura** | sets corridos/tres sets, reversión tras perder el primer set, alternancia de sets | Sin muestra mínima (hecho de un solo partido); solo con `winnerTeam` definido | §5.1 |
| **B — Hitos/rachas** | primer partido, primera victoria, hito de victorias (10/25/50/100) | Exacto por conteo, sin aproximar | §5.2 |
| **B — Rachas** | racha de victorias/derrotas, racha cortada | Mostrable desde **3** | §5.3 |
| **B — Récord de racha** | nuevo récord / iguala récord | Exige **≥10** partidos decididos comparables; por debajo, se descarta explícitamente | §5.2 "récord personal requiere al menos 10 partidos comparables" |
| **C — Forma reciente** | balance actual de últimos 5 vs. ventana inmediatamente anterior | Expuesto como dato comparativo puro — **sin** afirmar "mejoró/empeoró": el documento exige que la diferencia sea "material" sin fijar un número exacto; esa decisión queda para Fase C | §5.3 |
| **D — Compañero** | primer partido juntos, primera victoria juntos (independientes entre sí), balance | Balance ("habitual") desde **4** partidos decididos juntos | §5.4 |
| **D — Mejor compañero** | mejor balance entre compañeros comparables | Exige **≥5** partidos con CADA compañero comparado, **≥2** compañeros comparables | §5.4 |
| **E — Rival individual** | primer enfrentamiento, balance, primer triunfo tras derrotas | Habitual desde **3**, tendencia desde **4**; primer triunfo exige **≥2** derrotas previas en el mismo alcance | §5.5 |
| **E — Pareja rival exacta** | primer enfrentamiento, balance, primer triunfo tras derrotas | Mismos umbrales que rival individual (3/4) — el documento no da un número distinto para este alcance | §5.5 |
| **E — Cruce exacto de parejas** | primer enfrentamiento, balance, primer triunfo tras derrotas | Mostrable desde **2**, tendencia desde **4** (umbrales más bajos por diseño explícito) | §5.5 "puede mostrarse desde el segundo antecedente... sin hablar de tendencia hasta 4" |
| **F — Score excepcional** | más ajustado / más amplio dentro de formato comparable | Exige **≥10** partidos decididos del mismo `formatKey` (reusa el criterio de récord; el propio §5.6 ejemplifica con 14) | Implementacion.md §7 detector 8, §5.6 |
| **F — Balance perdiendo el primer set** | balance histórico cuando el equipo perdió el primer set, solo si el partido actual también lo perdió | Sin mínimo (se afirma desde 1, `confidenceTier` distingue `temprano`/`establecido` en ≥5) | §5.6 ejemplo 2 |
| **G — Contexto sin Nivel** | compañero nuevo, dificultad previa frente a un rival (incluye "nunca le había ganado" como caso `priorWins===0`), regreso tras inactividad excepcional | Reusa umbrales/derivados ya existentes de Fase A | §5.7 |

### 1.3 Explícitamente NO implementado en esta ronda (con motivo)

- **Familia H completa** (expectativa/calibración/delta de Nivel, detector 9) e **hitos de Ranking semanal** (detector 10): diferidos a Fase E ("Integración Nivel + Ranking", Implementacion.md §10) — ninguno de los dos necesita tocarse desde Fase B, y este módulo no importa ninguna RPC de Nivel/Ranking.
- **Etiqueta global de paridad** ("muy ajustado"/"ajustado"/"amplio en el score", §5.1): el propio documento marca sus umbrales como "deben validarse con partidos reales antes de quedar definitivos" — no es uno de los 8 detectores V1 de Implementacion.md §7. Se prefirió no fijar fixtures sobre números que la fuente misma no da por cerrados.
- Familia F: "balance en partidos a tres sets" y "frecuencia de 7-6" (§5.6): no están en la lista de 8 detectores V1; quedan como extensión futura de Familia F si Fase C/D los necesita.
- Familia G: "formato infrecuente" (sin umbral de "infrecuente" definido en la fuente) y "partido dentro/fuera de la forma reciente" (ya cubierto por el claim `forma_reciente` de Familia C, hubiera sido una segunda copia de la misma evidencia).

Ninguna de estas ausencias es una **DECISIÓN ABIERTA**: son alcance explícitamente diferido o ya cubierto por otro claim, no una decisión de producto pendiente.

---

## 2. Archivos

**Nuevos (3):**

- `bramulab/intelligence-claims.js`
- `bramulab/intelligence-claims.test.mjs`
- `supabase/functions/_shared/intelligence-claims.js` (symlink → `../../../bramulab/intelligence-claims.js`)

**Modificados:** ninguno. `intelligence-context.js`, su test, la migración de Fase A y `matches.js` quedan exactamente como los cerró `05_Validacion_Central_Fase_A_Staging.md`.

---

## 3. Tests y resultado

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs` — **57/57 PASS** (29 de Fase A, sin cambios, + 28 nuevos de Fase B).

Cobertura de Fase B, por criterio del handoff:

- **0 claims sin evidencia**, verificado con un historial largo (18 partidos, compañeros/rivales variados) evaluado partido por partido: todo claim afirmado trae `evidenceMatchIds` real y no vacío; todo candidato descartado trae `discardReasonCodes`;
- un partido sin resultado definido (pendiente) no produce ningún claim de estructura/racha/forma/hitos — solo pueden sobrevivir claims de contexto que no dependen de SU resultado;
- cada umbral de la tabla de §1.2 probado en su frontera exacta (2 vs. 3 para racha mostrable; 9 vs. 10 para récord/score excepcional; 3 vs. 4 para compañero habitual; 3 vs. 4 para rival tendencia; 2 vs. 4 para cruce exacto);
- pareja rival exacta nunca se confunde con "uno de los dos integrantes repite" (probado evaluando cada partido por separado, no solo el estado final);
- "primer partido juntos" y "primera victoria juntos" son evidencia **independiente** — ambas ciertas si el debut se gana, sin que Fase B decida cuál mostrar (esa selección es Fase C);
- `officialScope` distingue `oficial`/`mixto` según `officialEligible` real de cada partido fuente, nunca asumido;
- un partido con `playedAtTimeKnown=false` sigue produciendo claims válidos por fecha real, nunca por hora exacta — nota no bloqueante de `05_Validacion_Central_Fase_A_Staging.md` §4, verificada.

No se corrió la batería de navegador (`bramulab/tests.html`): esta ronda no modificó ningún archivo que esa batería cubra.

---

## 4. DECISIONES ABIERTAS

Se preserva, sin resolver, la única decisión abierta heredada de Fase A:

**¿Un partido oculto por el usuario puede alimentar BRAMU Intelligence personal?** `p_include_hidden` sigue en `false` por defecto; esta ronda no cambió ningún efecto oficial de Nivel/Ranking ni confundió ocultar con eliminar. No bloqueó nada de Fase B: los fixtures de esta ronda simplemente no pasan partidos ocultos por la RPC.

No se abrió ninguna decisión de producto nueva en Fase B: todos los umbrales aplicados están cerrados en `BRAMU_Intelligence.md` §5, y las tres ausencias de §1.3 son alcance diferido, no ambigüedad de producto.

---

## 5. Confirmación de entornos

- `staging`: única rama tocada.
- `main`: **no tocado**.
- Production: **no tocada**.
- BRAMUlive: **no tocado**.
- Supabase: **nada aplicado** — Fase B es JS puro, sin migraciones, sin RPCs nuevas, sin tocar ninguna tabla.
- Fase A (`intelligence-context.js`, su migración, `matches.js`, contratos de Bloques 5–7): **intactos**, cero regresión.

---

## 6. Siguiente paso recomendado

**C — Relevancia y memoria editorial**, consumiendo `PLIntelligenceClaims.buildClaimsForMatch` sin reabrir Fase B salvo regresión concreta: puntaje de relevancia (§6.1 de `BRAMU_Intelligence.md`), deduplicación semántica, cooldowns editoriales, selección de 1 principal + hasta 2 secundarios, y recién ahí decidir la "materialidad" de forma reciente que Fase B dejó expuesta como dato puro. No avanzar automáticamente a C.
