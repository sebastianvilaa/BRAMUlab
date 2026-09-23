# Backend Bloque 8 — Validación central de Fase B

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**HEAD funcional revisado:** `d4923d0f30a0b0bf0aac90fd3c59fdccc5943f01`  
**Estado:** **FASE B — CERRADA EN STAGING**

## 1. Resultado de revisión

ChatGPT central revisó la implementación original de Fase B y la corrección posterior C01–C04.

La corrección final resuelve los cuatro bloqueantes registrados en `07_Revision_Central_Fase_B.md`:

- evidencia suficiente y reconstruible para claims históricos/comparativos;
- forma reciente con ventana móvil correcta;
- empates preservados semánticamente en “mejor / el más”;
- partidos pendientes ignorados correctamente al buscar el primer triunfo tras derrotas.

El commit funcional final revisado es:

`d4923d0f30a0b0bf0aac90fd3c59fdccc5943f01`.

## 2. Contrato cerrado de Fase B

`PLIntelligenceClaims.buildClaimsForMatch(...)` produce candidatos estructurados con:

- claim factual;
- partidos fuente;
- scope de comparación;
- tamaño de muestra;
- confianza;
- alcance personal/oficial;
- versión de reglas;
- descarte explícito y motivo cuando la evidencia no alcanza.

Fase B no:

- puntúa relevancia;
- elige principal/secundarios;
- aplica cooldowns;
- redacta plantillas;
- consume Nivel/Ranking;
- toca UI.

Esas responsabilidades siguen separadas en C/D/E.

## 3. Familias cubiertas

Quedan disponibles para las fases siguientes:

- A — estructura del resultado;
- B — hitos / rachas / récords;
- C — forma reciente;
- D — compañeros;
- E — rivales / pareja rival / cruce exacto;
- F — score histórico comparable;
- G — contexto sin Nivel.

Familia H — Nivel + Ranking — queda para Fase E, como establece la implementación vigente.

## 4. Pruebas

Claude reportó:

`node --test bramulab/intelligence-context.test.mjs bramulab/intelligence-claims.test.mjs`

Resultado final:

**64/64 PASS**

Incluye:

- 29 tests de Fase A;
- 35 tests de Fase B;
- cobertura focal de C01–C04.

No se repitió QA de navegador porque Fase B no está conectada todavía a UI/producto visible.

## 5. Observaciones que viajan a Fase C

### Forma reciente

Con exactamente 5 partidos decididos existe la primera lectura válida de forma de 5.

Una afirmación de **cambio material respecto de la ventana inmediatamente anterior** solo puede evaluarse cuando la ventana anterior también tenga 5 partidos. Fase C debe respetar `previousWindow.sampleSize` y no comparar muestras desiguales como si fueran equivalentes.

### Cronología

`playedAtTimeKnown=false` preserva el partido en el orden por fecha, pero nunca autoriza una afirmación de secuencia horaria exacta entre partidos que no puede conocerse.

### Ocultamiento

Sigue abierta y no bloqueante:

**¿Un partido oculto del Historial puede alimentar BRAMU Intelligence personal?**

Hasta resolverla se conserva `p_include_hidden=false`.

## 6. Entornos

- `staging`: único entorno tocado;
- main: NO tocado;
- Production: NO tocada;
- BRAMUlive: NO tocado;
- Supabase: sin cambios en Fase B.

## 7. Decisión de cierre

No queda un bloqueo técnico que justifique mantener abierta Fase B.

**Backend Bloque 8 — Fase B queda CERRADA en Staging.**

Siguiente intervención autorizada:

**Fase C — Relevancia y memoria editorial.**

No avanzar automáticamente a D.
