# Backend Bloque 8 — Revisión central de Fase C

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit revisado:** `b766346dddfe35b120815c9e261580455d3e8369`  
**Estado:** **NO cerrar Fase C todavía — corrección focal antes de avanzar a D.**

## 1. Resultado general

La arquitectura de Fase C es correcta:

- módulo puro separado `intelligence-editorial.js`;
- consume Fase B por composición;
- score/umbral/prioridad/deduplicación/cooldowns/memoria/abstención separados de redacción;
- máximo 1 principal + 2 secundarios;
- sin Supabase/UI/Nivel/Ranking;
- 83/83 tests reportados;
- no reabre A/B.

La tabla de subpuntajes por `insightType` puede permanecer como **parámetro V1 explícito y versionado** para la primera implementación. No requiere una decisión humana ahora; se validará/recalibrará con el banco de casos y uso real sin reescribir silenciosamente decisiones históricas.

La revisión central sí detectó cinco problemas concretos de lógica/memoria que deben corregirse antes de cerrar C.

---

## 2. C01 — “últimos 2 partidos” está implementado como “últimos 2 principales”

**Bloqueante.**

La fuente fija:

> misma familia como principal: penalización durante 2 partidos.

Actualmente `scoreCandidate` hace:

`memory.recentPrincipalFamilies.slice(-2)`

pero `recentPrincipalFamilies` solo agrega una entrada cuando hubo principal.

Eso significa que:

1. partido A: principal Familia B;
2. partido B: abstención;
3. partido C: abstención;
4. partido D: candidato Familia B;

puede seguir recibiendo −15 aunque B ya no fue principal en los **últimos 2 partidos reales**.

### Corrección requerida

La memoria debe conservar la ventana por **partidos procesados**, no solo por principales mostrados.

Solución simple:

- guardar hasta los últimos 5 partidos con `matchId` + `principalFamily|null`;
- la penalización −15 mira exactamente los dos partidos anteriores;
- una abstención ocupa su lugar en la ventana.

Puede mantenerse compatibilidad con el nombre actual o migrar el shape en este módulo, porque todavía no existe persistencia real.

### Además: memoria de templates

El contrato de C debe quedar preparado para D.

`scoreCandidate` ya contempla `recentTemplateIds`, pero:

- `emptyMemory()` no lo declara;
- `memoryUpdate` no lo preserva.

Agregar/preservar una ventana de templates (vacía por ahora) para que D pueda usar la penalización −10 sin reabrir el contrato de memoria.

---

## 3. C02 — La racha simple queda prohibida en 4+ aunque nunca haya sido mostrada

**Bloqueante.**

La fuente dice:

- racha mostrable desde 3;
- **gana máxima prioridad desde 4**;
- mostrar al llegar a 3, al igualar récord, al superarlo y al terminar;
- “no necesariamente” en cada extensión.

La implementación actual excluye siempre:

`racha_de_victorias/derrotas` cuando `length !== 3`.

Eso hace imposible mostrar una racha simple de 4 si la de 3 no fue seleccionada por haber existido una historia más fuerte.

### Corrección requerida

- longitud >=3 puede ser candidata si esa racha todavía no fue mostrada;
- si la racha simple ya fue mostrada, no repetir automáticamente cada extensión;
- récord / igualdad de récord / corte siguen siendo eventos propios y pueden reaparecer según sus reglas;
- una racha de 4 nunca debe quedar prohibida solo por ser 4.

Usar memoria editorial para decidir repetición, no un gate fijo `length === 3`.

Agregar test:

- racha de 3 no seleccionada → racha de 4 todavía elegible;
- racha de 3 ya mostrada → extensión simple a 4 se suprime si no hay otro evento de racha material.

---

## 4. C03 — deduplicación racha / forma reciente no cubre el caso explícito de la fuente

**Bloqueante.**

La fuente dice explícitamente que debe evitarse publicar a la vez:

- “4 victorias seguidas”;
- “ganaste 4 de los últimos 5”.

La implementación actual solo las fusiona si:

`racha.length >= ventana.sampleSize`

es decir, típicamente 5+.

Por lo tanto **4 seguidas + 4/5** quedan como historias distintas, exactamente el caso que la fuente pide evitar.

### Corrección requerida

Para la ventana principal de 5:

- si la racha vigente tiene al menos 4 partidos;
- y el balance de forma reciente está explicado por esa misma racha (ej.: racha 4W + forma 4W/1L; racha 4L + forma 1W/4L; racha >=5 + 5/5);
- ambas deben compartir historia semántica.

No hace falta inventar un porcentaje de solapamiento.

Puede usarse una regla estructural como:

- `streakLength >= 4`;
- cantidad del mismo resultado en `forma_reciente.current` = `min(streakLength, 5)`.

### Orden de aplicación

La fusión semántica actualmente ocurre **después** de cooldown y scoring.

Eso permite que `forma_reciente` reciba novedad/puntaje como historia nueva antes de que se le cambie el `semanticKey`.

La clave semántica final debe quedar resuelta **antes** de:

- cooldown;
- novedad editorial;
- score;
- selección.

Agregar tests de memoria previa para demostrar que una historia de racha ya mostrada no reaparece disfrazada de forma reciente por haber sido puntuada con otra key.

La “DECISIÓN ABIERTA #2” del informe queda resuelta por esta corrección: el caso 4 + 4/5 ya está definido por la fuente.

---

## 5. C04 — semanticKey de primer encuentro usa timestamp y puede colisionar

**Bloqueante.**

Los claims:

- `rival_primer_enfrentamiento`;
- `pareja_rival_primer_enfrentamiento`;
- `cruce_exacto_primer_enfrentamiento`;

se agrupan hoy con:

`primer_encuentro_rival:${candidate.dataAsOf}`

Pero `dataAsOf` es fecha/hora jugada, no identidad del partido.

Dos partidos distintos pueden compartir exactamente el mismo timestamp técnico, especialmente cuando `playedAtTimeKnown=false` y ambos caen en la misma fecha.

La memoria podría entonces tratar el segundo partido como el mismo hito ya mostrado.

### Corrección requerida

Agrupar los scopes del **mismo partido** usando un identificador estable del partido proveniente de la evidencia.

En estos claims Fase B ya conserva el partido actual en `evidenceMatchIds`.

Usar el `matchId` fuente correspondiente, no `dataAsOf`.

Agregar test con dos partidos distintos el mismo día / mismo `playedAt` y demostrar que no comparten milestone semántico entre partidos.

---

## 6. C05 — contrato de memoria/auditoría pierde cambios semánticos reales y motivos de no selección

### A. Firma de valor del mejor compañero

`companero_mejor_balance` usa un semanticKey global:

`companero_mejor_balance:todos_los_companeros`

pero `valueSignatureOf` para ese claim conserva solo `wins-losses`.

Si cambia el compañero protagonista pero el nuevo mejor tiene el mismo 3–2 que el anterior, la firma queda igual y el cooldown puede interpretar erróneamente “sin cambio”.

La firma de este claim debe incluir al menos:

- `companionPlayerId`;
- balance;
- estado de empate relevante (`isUnique/tiedWith` o equivalente).

No hace falta reestructurar el resto de signatures que ya están scoped por entidad.

### B. Motivo editorial de no selección

Hoy un candidato puede quedar:

- `status: above_threshold`;

pero luego no aparecer porque:

- duplica `semanticKey`;
- su familia ya está usada;
- ya se ocuparon los 3 lugares.

Ese motivo no queda registrado en `evaluated`.

Para que la decisión sea realmente reconstruible, conservar un estado/motivo editorial final, por ejemplo:

- `selected_principal`;
- `selected_secondary`;
- `not_selected_duplicate_semantic`;
- `not_selected_family_already_used`;
- `not_selected_capacity`;
- además de `below_threshold` / `excluded_by_cooldown`.

No es necesario mutar el claim original de Fase B.

---

## 7. Qué NO cambiar

**NO TOCAR:**

- Fase A;
- Fase B;
- Supabase;
- UI;
- plantillas finales;
- Nivel;
- Ranking;
- Fase D/E/F;
- main;
- Production;
- BRAMUlive.

La decisión heredada sobre partidos ocultos continúa sin bloquear esta corrección.

---

## 8. Pruebas mínimas de la corrección

Además de mantener A+B+C verdes, agregar cobertura focal para:

1. penalización de misma familia depende de los 2 partidos reales previos, incluyendo abstenciones;
2. `recentTemplateIds` existe y se preserva en memoria;
3. racha de 4 elegible si la de 3 nunca fue mostrada;
4. racha de 4 simple suprimida si la de 3 ya fue mostrada y no hay evento material nuevo;
5. 4 victorias seguidas + 4/5 comparten historia;
6. 4 derrotas seguidas + 4/5 comparten historia;
7. semanticKey racha/forma queda resuelta antes del score/cooldown y respeta memoria previa;
8. dos partidos diferentes con mismo `playedAt` no comparten milestone de “primer encuentro”;
9. cambio de mejor compañero con el mismo W-L se considera cambio real;
10. todo candidato >55 no seleccionado conserva un motivo editorial final.

---

## 9. Próximo gate

Después de corregir C01–C05:

1. ejecutar tests A+B+C;
2. revisar diff;
3. un único commit/push;
4. revisión central;
5. si pasa, cerrar Fase C;
6. recién entonces preparar D — Plantillas y UX.

No avanzar automáticamente a D.
