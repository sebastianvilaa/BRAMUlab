# Backend Bloque 8 — Cierre Fase D: Plantillas, persistencia y UX

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional cerrado:** `30b9fb8538cfb0f65f8e43c33d50f7541e4db425`  
**Bundle:** `04.10-h23`  
**Estado:** **FASE D CERRADA EN STAGING**

## 1. Alcance cerrado

Fase D queda cerrada con:

- templates determinísticos;
- principal + hasta 2 secundarios;
- `templateId` estable;
- “Por qué aparece” factual;
- aprendizaje/abstención/fallback;
- memoria editorial + de templates;
- persistencia server-side por checkpoint cronológico;
- fingerprint de historia;
- auditoría completa server-only;
- Edge Function autenticada `get-match-intelligence`;
- integración real en el Resumen del partido;
- reemplazo del Intelligence legacy en el camino server-backed real.

## 2. Hardening incluido

Quedan cerrados:

- H01 — identidad abierta no alimenta relaciones;
- D01 — replay cronológico por checkpoints;
- D02 — fingerprint con identidad/composición/formato/scoring/hora;
- D03 — memoria propia de D preservada;
- D04 — copy explícito de games;
- D05 — primera lectura de forma sin comparación falsa;
- D06 — auditoría completa persistida.

## 3. Backend Staging real

Migración aplicada:

`bloque8_fased_intelligence_persistence`

Tabla:

`public.intelligence_match_outputs`

Seguridad verificada:

- RLS activo;
- 0 políticas de cliente;
- `anon` sin SELECT;
- `authenticated` sin SELECT;
- `service_role` con lectura/escritura.

Edge Function:

`get-match-intelligence`

- ACTIVE;
- version 1;
- `verify_jwt=true`;
- caller derivado desde sesión;
- navegador no elige `playerId`;
- respuesta pública contiene solo `output`.

## 4. Tests

Suite A+B+C+D reportada al cierre técnico:

**136/136 PASS**

No se repitieron baterías equivalentes después de D06 porque la corrección fue exclusivamente de persistencia/auditoría y mantuvo verdes los tests focales.

## 5. QA real de navegador

QA real sobre Staging:

- 1 partido creado por UI;
- 6 llamadas reales a `get-match-intelligence`, todas HTTP 200;
- una única salida persistida y reutilizada;
- principal + 2 secundarios coherentes;
- “Por qué aparece” factual;
- sin Nivel/Ranking prematuros;
- sin mezcla del Intelligence legacy;
- checkpoint con `output + memory_after + audit`.

Resultado consolidado:

`23_Resultado_QA_Fase_D_Work.md`

**FASE D QA PASS — APTA PARA CIERRE**

## 6. Partido de QA

Se conserva temporalmente el único partido real de QA en Staging:

`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`

No limpiarlo antes de Fase E: puede servir para verificar la transición entre historia personal pendiente y efectos oficiales posteriores.

## 7. Decisión abierta heredada

Sigue abierta, sin bloquear Fase E:

**¿Un partido oculto del Historial puede alimentar BRAMU Intelligence personal?**

Hasta resolverla, el comportamiento vigente continúa con ocultos fuera de Intelligence personal.

## 8. Siguiente fase

**Fase E — Integración Nivel + Ranking.**

Debe consumir datos oficiales ya existentes sin recalcular:

- snapshots/reasonCodes de Nivel;
- expectativa prepartido;
- delta/evidencia/estado de calibración;
- ediciones semanales publicadas de Ranking.

No reabrir A–D salvo regresión concreta.

No avanzar a F generativa automáticamente.
