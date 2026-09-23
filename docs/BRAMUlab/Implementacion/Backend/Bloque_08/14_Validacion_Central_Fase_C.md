# Backend Bloque 8 — Validación central de Fase C

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `a08fb358f4b0e251810815ffd33106b1769f2efc`  
**Estado:** **FASE C — CERRADA EN STAGING**

## 1. Resultado

ChatGPT central revisó la implementación original de C y la corrección C01–C05.

La corrección final resuelve los bloqueantes de `12_Revision_Central_Fase_C.md`:

- la penalización de familia usa los dos partidos reales previos, no los dos últimos principales;
- la memoria incluye abstenciones y queda preparada para templates;
- una racha simple de 4+ puede aparecer si esa racha todavía no fue mostrada;
- una extensión simple se suprime mediante memoria, no mediante un gate fijo de longitud;
- racha y forma reciente comparten historia en el caso explícito 4 seguidas + 4/5;
- la semántica final se resuelve antes de cooldown/novedad/score;
- los primeros encuentros se identifican por match fuente, no por timestamp;
- “mejor compañero” distingue cambio real de protagonista aun con igual W-L;
- todo candidato >55 no seleccionado conserva motivo editorial final.

## 2. Contrato cerrado de Fase C

`PLIntelligenceEditorial.buildEditorialDecision(...)` devuelve una decisión determinística y auditable con:

- candidatos evaluados;
- puntaje y penalizaciones;
- estado editorial final;
- principal;
- hasta 2 secundarios;
- abstención;
- actualización propuesta de memoria;
- versión de reglas.

C no redacta texto visible ni modifica claims/evidencia de B.

## 3. Parámetros V1

La tabla de subpuntajes por `insightType` se acepta como parámetro V1 explícito y versionado para la primera implementación.

No se presenta como valor derivado literalmente de la fuente maestra. Se podrá recalibrar con banco de casos/uso real mediante nueva versión de reglas, sin reescribir silenciosamente decisiones históricas.

## 4. Pruebas

Claude reportó:

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs bramulab/intelligence-editorial.test.mjs`

Resultado final:

**94/94 PASS**

- 29 Fase A;
- 35 Fase B;
- 30 Fase C.

No se ejecutó QA de navegador porque C todavía no tiene UI.

## 5. Persistencia

No se creó persistencia server-side prematuramente.

La memoria editorial queda como objeto serializable. Su almacenamiento se resolverá junto al consumidor real de D, evitando una tabla/RPC anticipada sin flujo que la use.

## 6. Decisión abierta heredada

Sigue abierta y no bloquea D:

**¿Un partido oculto del Historial puede alimentar BRAMU Intelligence personal?**

Hasta resolverla se conserva `p_include_hidden=false`.

## 7. Entornos

- `staging`: único entorno tocado;
- main: NO tocado;
- Production: NO tocada;
- BRAMUlive: NO tocado;
- Supabase: sin cambios en Fase C.

## 8. Decisión de cierre

No queda un bloqueo técnico que justifique mantener abierta Fase C.

**Backend Bloque 8 — Fase C queda CERRADA en Staging.**

Siguiente intervención autorizada:

**Fase D — Plantillas y UX.**

No avanzar automáticamente a E.
