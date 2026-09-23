# Backend Bloque 8 — Validación técnica final de Fase E en Staging

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec`  
**Bundle esperado:** `04.10-h26`  
**Estado:** **VALIDACIÓN TÉCNICA PASS — pendiente QA real final antes de cerrar Fase E.**

## 1. Revisión central E07–E09

ChatGPT central revisó directamente el commit final de Claude.

Quedan aprobados:

- E07 — un hito semanal solo se marca como visto si realmente modificó el texto visible de TU MOMENTO;
- E08 — “Por qué aparece” de evidencia limitada ya no atribuye la limitación a otro participante sin prueba;
- E09 — cambio de banda exige Nivel público actual y previo numéricos; nunca puede producir “— → —”.

Claude ejecutó las suites focales correctas para esta corrección:

- `ranking-home-milestone.test.mjs`: **32/32 PASS**;
- `intelligence-presentation.test.mjs`: **50/50 PASS**.

No se repitieron suites A–D porque E07–E09 no modificaron esas capas.

## 2. Migración Ranking — aplicada

Migración:

`bloque8_fasee_ranking_best_position`

Versión registrada en Supabase Staging:

`20260923221945`

Antes de aplicarla se ejecutó la migración completa dentro de una transacción con `ROLLBACK` sobre el esquema real y compiló correctamente.

La migración amplía `get_my_ranking_position` sin recalcular Ranking y expone:

- `bestPositionBefore`;
- `ownLevelBand`;
- `previousLevelPublic`;
- `previousLevelBand`.

Solo consulta ediciones publicadas para historia previa.

## 3. Edge Function — redeploy final de E

`get-match-intelligence`

Estado real:

- **ACTIVE**;
- version: **2**;
- `verify_jwt=true`;
- incluye A+B+C+D+E y `intelligence-official.js`;
- usa snapshots oficiales `effect_status='applied'`;
- no recalcula Nivel;
- no usa Nivel live para un partido histórico;
- audit/memory siguen server-only.

## 4. Partido real conservado para QA

No crear otro partido.

Usar:

`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`

Estado actual antes de QA:

- `pending_validation`;
- resultado: 6–3 / 6–4;
- creador: equipo B;
- `action_side = A`;
- todavía no existe `match_level_result` aplicado;
- existe un checkpoint de Fase D con rules version A+B+C+D.

Los cuatro participantes tienen Nivel en estado `CALIBRANDO`. Esto lo convierte en un caso real útil para verificar que E no inventa dificultad confiable.

## 5. Qué debe demostrar la QA

1. abrir el partido pendiente con el creator y forzar el camino E real;
2. confirmar el partido desde el lado A usando el flujo real de validación;
3. volver al creator;
4. abrir el mismo Resumen;
5. comprobar que Intelligence sigue coherente;
6. si aparece un insight de Nivel, debe ser de calibración/evidencia limitada, nunca sorpresa confiable;
7. reabrir y comprobar estabilidad;
8. Home no debe mostrar un hito de Ranking falso en un universo insuficiente/sin edición apta.

Después de la QA de navegador, ChatGPT central verificará directamente en Supabase:

- resultado oficial aplicado;
- fingerprint/checkpoint regenerado;
- rules version A+B+C+D+E;
- claims H en audit;
- output final;
- ausencia de causalidad falsa de Ranking.

No avanzar a F.
