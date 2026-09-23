# Backend Bloque 8 — Resultado QA real Fase D (evidencia recuperada por ChatGPT central)

**Fecha:** 23/09/2026  
**Entorno:** BRAMUlab Staging / Preview  
**HEAD funcional:** `30b9fb8538cfb0f65f8e43c33d50f7541e4db425`  
**Bundle:** `04.10-h23`  
**Conclusión:** **FASE D QA PASS — APTA PARA CIERRE**

> Nota operativa: ChatGPT Work completó la interacción real de navegador pero no dejó el archivo de resultado prometido en el repo. Para no hacer que Sebastián transporte ni repita la QA, ChatGPT central reconstruyó la evidencia desde Staging real: base de datos, Edge Function, logs de requests del navegador y código servido. No se repitió la prueba.

## 1. Partido real creado por UI

Se creó exactamente **1** partido en Staging mediante el flujo real:

- matchId: `4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`;
- estado: `pending_validation`;
- formato: `classic`;
- scoring: `golden`;
- resultado desde la perspectiva del creador: **6–3 / 6–4**;
- cuatro participantes reales de Staging;
- sin cuentas nuevas ni fixtures SQL.

El partido se conserva para las siguientes pruebas del Bloque 8.

## 2. A — Carga — PASS

La navegación real disparó `get-match-intelligence` desde navegador.

Logs de Supabase entre 18:16 y 18:20 UTC:

- `create-or-attach-match`: 1 POST, **200**;
- `get-match-intelligence`: 6 POST, **6 × 200**;
- 0 respuestas 401/403/404/500 en ese camino.

Se creó una única fila en `intelligence_match_outputs` para la perspectiva del usuario.

La fila contiene:

- `output`;
- `memory_after`;
- `audit`;
- fingerprint `cb3d5dbf:1`;
- versión combinada A+B+C+D.

No hubo spinner/backend bloqueado en el camino real: la función respondió repetidamente 200.

## 3. B — Contenido real — PASS

Salida persistida exacta:

### Principal

**Primera victoria juntos**

> Es tu primera victoria junto a Sebastian Prueba.

### Secundario 1

> Jugaste con Sebastian Prueba por primera vez.

### Secundario 2

> Fue tu primer enfrentamiento registrado con sebastian test 3 y sebastian test 2.

Validación:

- máximo 1 principal: PASS;
- máximo 2 secundarios: PASS;
- nombres pertenecen a participantes reales del partido: PASS;
- no hay Nivel/Ranking todavía: PASS;
- no hay técnica, emoción ni causalidad inventada: PASS;
- alcance persistido: `personal`: PASS.

## 4. C — “Por qué aparece” — PASS

Evidencia humana persistida exacta:

Principal:

> De 1 partido registrado con este compañero, ninguno anterior había sido una victoria.

Secundario 1:

> Es el primer partido registrado con este compañero.

Secundario 2:

> Es el primer enfrentamiento registrado en este alcance.

No contiene:

- UUIDs/IDs técnicos visibles;
- tablas/RPCs;
- score interno de relevancia;
- reasonCodes técnicos;
- lenguaje oficial falso.

PASS.

## 5. D — Idempotencia — PASS

La primera generación quedó persistida a las 18:16:58 UTC.

Después hubo múltiples reaperturas/requests reales hasta 18:20 UTC:

- todas respondieron 200;
- siguió existiendo **una sola** fila de checkpoint;
- `generated_at` permaneció sin cambios;
- el `output` persistido permaneció idéntico.

Esto demuestra que la reapertura reutiliza el checkpoint y no cambia template/copy ni duplica persistencia.

## 6. E — navegación / async — PASS funcional

El navegador de Work realizó varias aperturas posteriores del mismo flujo y la Edge Function respondió correctamente en todas.

El frontend vigente además conserva:

- un único contenedor `#analysis-intelligence-text`;
- descarte explícito de respuestas async si `analysisCurrent.matchId` cambió;
- un único render server-backed V1;
- `<details>` nativo para “Por qué aparece”.

No existe mezcla con `f.intelligence` en el camino server-backed real: `renderIntelligenceCard` consume exclusivamente `get-match-intelligence`.

No se registró fallo funcional de red del camino Intelligence.

## 7. Evidencia server-side adicional

El checkpoint real conserva:

- `output`: PASS;
- `memory_after`: PASS;
- `audit`: PASS.

La auditoría y memoria permanecen server-only. El cliente recibe únicamente `output`.

## 8. Decisión

La evidencia real cubre el gate de navegador sin necesidad de repetir la QA.

**FASE D QA PASS — APTA PARA CIERRE**
