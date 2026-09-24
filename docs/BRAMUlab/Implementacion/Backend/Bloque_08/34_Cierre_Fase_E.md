# Backend Bloque 8 — Cierre Fase E: Nivel + Ranking

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional cerrado:** `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec`  
**Bundle:** `04.10-h26`  
**Estado:** **FASE E CERRADA EN STAGING**

## 1. Alcance cerrado

Fase E integra BRAMU Intelligence con autoridad deportiva real sin recalcular sistemas cerrados.

### Nivel

Intelligence consume exclusivamente:

- `match_level_results`;
- `match_level_result_players`;
- resultados con `effect_status='applied'`.

Quedan cerrados:

- expectativa previa;
- evidencia/confianza;
- calibración;
- variación oficial;
- snapshot histórico por partido;
- invalidación de checkpoint al aparecer/cambiar autoridad oficial;
- Familia H dentro del mismo selector editorial de C;
- templates y audit A+B+C+D+E.

No se usa el Nivel live actual para reinterpretar un partido histórico.

### Ranking

Ranking permanece semanal.

Quedan cerrados los hitos materiales de TU MOMENTO:

- primera entrada real;
- entrada a Top 10;
- nueva mejor posición material;
- ascenso material;
- cambio de banda pública de Nivel.

Restricciones cerradas:

- mínimo 15 elegibles;
- ediciones publicadas/comparables;
- sin puntos propios de Ranking;
- sin causalidad de un partido;
- mismo hito/edición se muestra una sola vez por usuario;
- `Nuevo` no equivale automáticamente a primera entrada histórica.

## 2. Backend Staging

Migración aplicada:

`bloque8_fasee_ranking_best_position`

Versión Supabase:

`20260923221945`

Edge Function:

`get-match-intelligence`

- ACTIVE;
- version 2;
- JWT obligatorio;
- pipeline A+B+C+D+E;
- snapshots oficiales server-side;
- audit/memoria nunca expuestos al navegador.

## 3. Correcciones centrales cerradas

Quedan cerradas:

- E01 — primera entrada / universo mínimo;
- E02 — memoria “seen” de hito semanal;
- E03 — evidencia limitada no atribuye calibración incorrecta al caller;
- E04 — cambio de banda pública;
- E05 — contexto esperable integrado con variación;
- E06 — versionado B/E;
- E07 — no marcar visto si TU MOMENTO no lo mostró;
- E08 — “Por qué aparece” factual ante evidencia limitada;
- E09 — sin Nivel público nulo en cambio de banda.

## 4. Tests

Base completa de E antes de la corrección final:

**237/237 PASS**

Corrección final focal:

- `ranking-home-milestone.test.mjs`: **32/32 PASS**;
- `intelligence-presentation.test.mjs`: **50/50 PASS**.

No se repitieron suites no afectadas por E07–E09.

## 5. QA real

Partido:

`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`

Resultado:

- validado por flujo real;
- resultado de Nivel oficial aplicado;
- checkpoint regenerado con versión A+B+C+D+E;
- Familia H presente en audit;
- evidencia baja tratada honestamente;
- salida visible estable;
- 8/8 llamadas reales a Intelligence con HTTP 200;
- Ranking Home sin hito inventado.

Detalle:

`33_Resultado_QA_Final_Fase_E_Work.md`

## 6. Decisión

**Fase E — Integración Nivel + Ranking queda CERRADA en Staging.**

La capa generativa F continúa siendo opcional y no bloquea la primera salida productiva.
