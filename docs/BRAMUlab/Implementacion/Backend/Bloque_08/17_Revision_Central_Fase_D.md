# Backend Bloque 8 — Revisión central de Fase D

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit revisado:** `17fe1947fae7cd685cb13bd6aa18427d97905043`  
**Estado:** **NO cerrar Fase D todavía — corrección focal antes de aplicar/deployar Supabase Staging.**

## 1. Resultado general

La dirección de Fase D es correcta:

- H01 está bien ubicado y conserva hechos no relacionales;
- existe capa pura de presentación/templates;
- el frontend server-backed deja de usar el Intelligence legacy como V1;
- la UX usa la tarjeta canónica de Resumen;
- hay cliente específico;
- la generación real está planteada server-side;
- la migración y Edge Function todavía **NO fueron aplicadas/deployadas** en Supabase Staging;
- bundle único `04.10-h23`;
- Claude reporta **118/118 PASS**.

La revisión central detectó tres bloqueantes técnicos de persistencia/memoria y dos ajustes de copy/UX. Como la migración todavía no se aplicó, este es el momento correcto para corregirlos sin migración compensatoria ni deuda de esquema.

---

## 2. D01 — memoria editorial dependiente del orden de apertura, no de la cronología real

**Bloqueante.**

La fuente y el handoff exigen que la memoria/generación siga `playedAt`, no el orden de carga/apertura.

La implementación actual usa una sola fila:

`intelligence_player_memory`

como memoria “actual” y la reutiliza para generar cualquier partido solicitado.

Eso produce dos errores reales:

### A. Un partido viejo puede recibir memoria del futuro

Si ya se generó Intelligence para partidos posteriores y después se abre por primera vez un partido antiguo, la salida antigua se calcula con cooldowns, semanticKeys y templates acumulados **después** de ese partido.

Aunque `historyFull` esté truncada correctamente, la memoria no lo está.

Por lo tanto un partido viejo puede quedar influido por historias futuras sin que sus `evidenceMatchIds` las muestren.

### B. Una corrección del partido más reciente puede auto-penalizarse

Ejemplo:

1. se genera Intelligence para partido M;
2. la memoria global queda actualizada con M;
3. M recibe una corrección y cambia su fingerprint;
4. la Edge Function regenera M usando la memoria que **ya contiene a M**.

Entonces M puede recibir:

- penalización de misma familia contra sí mismo;
- cooldown de un semanticKey que él mismo mostró;
- repetición de template contra su propia salida anterior;
- supresión de hitos que pertenecían a ese mismo partido.

Esto contradice la reconstruibilidad e idempotencia buscadas.

### Corrección recomendada

**REEMPLAZAR el blob global como fuente de generación por checkpoints cronológicos por partido.**

Como la migración todavía no fue aplicada, la solución V1 más simple y robusta es:

- mantener una sola tabla `intelligence_match_outputs`;
- cada fila por `(player_id, match_id)` guarda:
  - fingerprint del prefijo;
  - rules version combinada;
  - output visible;
  - **memory_after**: memoria editorial/presentación inmediatamente después de ese partido;
  - generated_at.

`intelligence_player_memory` puede eliminarse de la migración antes de aplicarla. No hace falta una segunda tabla para V1.

### Algoritmo de la Edge Function

Al pedir el partido objetivo:

1. cargar historia real ordenada por `playedAt`;
2. localizar el target;
3. traer en una sola consulta los outputs existentes del jugador hasta donde resulte útil;
4. caminar cronológicamente desde el primer partido hasta el target;
5. para cada prefijo:
   - calcular fingerprint;
   - si existe checkpoint con mismo fingerprint + misma rules version + `memory_after`, reutilizarlo y continuar;
   - si no existe o quedó inválido, generar ese partido con la memoria del checkpoint inmediatamente anterior, persistir output + `memory_after`, y continuar;
6. devolver la fila del target.

Así:

- abrir un partido viejo nunca recibe memoria del futuro;
- corregir M usa memoria hasta M−1, nunca la memoria que ya contiene M;
- una carga retroactiva invalida automáticamente todos los prefijos posteriores porque cambia su fingerprint;
- un cambio de reglas invalida checkpoints viejos;
- el resultado no depende del orden en que el usuario abrió pantallas;
- no hace falta snapshot global mutable.

Para la escala inicial de BRAMU, este replay/checkpoint cronológico es suficientemente simple. No agregar colas ni event sourcing.

---

## 3. D02 — fingerprint no incluye identidad de participantes ni todos los inputs relevantes

**Bloqueante.**

`computeHistoryFingerprint()` incluye hoy:

- matchId;
- playedAt;
- status;
- officialEligible;
- hasOpenIdentityIssue;
- hidden;
- winnerTeam;
- sets.

Pero A/B/C/D también consumen:

- identidades reales de participantes;
- equipo/composición;
- formato;
- scoring system;
- conocimiento de hora;
- relaciones derivadas de esas identidades.

El propio handoff exigía:

> identidad resuelta/cambiada que cambia la fuente produce fingerprint distinto.

Hoy una sustitución real de participante donde el booleano `hasOpenIdentityIssue` sea `false` antes y después puede conservar exactamente el mismo fingerprint.

También un cambio de formato relevante para comparabilidad puede no invalidar.

### Corrección requerida

El fingerprint debe incluir todos los campos estructurales que pueden cambiar claims/presentación, como mínimo:

- `matchId`;
- `playedAt`;
- `playedAtTimeKnown`;
- `status`;
- `officialEligible`;
- `hidden`;
- `hasOpenIdentityIssue`;
- `formatId`;
- `scoringSystem`;
- composición estable de participantes por `playerId/userId + team/position`;
- sets/tiebreaks y ganador derivado.

No incluir `createdAt`.

Agregar test donde:

- participante A se reemplaza por participante B;
- ambos estados tienen `hasOpenIdentityIssue=false`;
- sets/fecha son idénticos;
- fingerprint **debe cambiar**.

Agregar test de cambio de formato si el formato afecta comparabilidad.

---

## 4. D03 — la memoria propia de D se pierde al atravesar C

**Bloqueante.**

La Edge Function hace actualmente:

`PR.renderIntelligence(decision, truncated, decision.memoryUpdate)`

Pero `decision.memoryUpdate` es el objeto construido por Fase C y no conserva todos los campos agregados por D.

Caso concreto:

- D agrega `learningHitosShown`;
- en el siguiente partido C construye un nuevo `memoryUpdate` sin ese campo;
- la Edge Function pasa exclusivamente ese objeto a D;
- D deja de ver la memoria previa de aprendizaje.

`recentTemplateIds` hoy sobrevive porque C fue preparado previamente para preservarlo; `learningHitosShown` no.

### Corrección requerida

La presentación debe recibir la **memoria anterior completa** y fusionarla con la actualización producida por C para el partido actual.

Conceptualmente:

- `memoryBefore` = checkpoint del partido anterior;
- C produce `editorialMemoryAfter`;
- D parte de `memoryBefore + editorialMemoryAfter`;
- D agrega/actualiza sus campos propios;
- el resultado final es `memoryAfter`, guardado como checkpoint de este partido.

No hacer que C conozca campos de D uno por uno.

Agregar test secuencial que demuestre:

- un hito de aprendizaje guardado permanece en memoria después de partidos posteriores;
- una regeneración no puede volver a tratarlo como “nunca mostrado” por pérdida del campo;
- `recentTemplateIds` también continúa correctamente.

Con la arquitectura de D01, `rules_version` del checkpoint queda validada junto con cada fila y desaparece además el problema de usar memoria construida con reglas antiguas.

---

## 5. D04 — copy de sets corridos debe decir explícitamente “en games”

**Ajuste pequeño de UX, incluir en la misma corrección.**

La fuente maestra usa como forma segura:

> “El resultado fue en sets corridos y con 12–4 en games.”

La plantilla actual produce algo equivalente a:

> “El resultado se resolvió en dos sets, 12–5.”

Ese número es el total agregado de games, no el score de un set. Sin la aclaración puede leerse como marcador de set.

### Corrección

Usar una forma explícita:

> “El resultado se resolvió en dos sets, con 12–5 en games.”

Mantener siempre los números derivados del claim.

---

## 6. D05 — “Por qué aparece” de forma reciente con primera ventana de 5

**Ajuste pequeño de UX.**

Con exactamente 5 partidos, Fase B/C permiten la primera lectura válida de forma, pero la ventana previa todavía no tiene 5 partidos comparables.

La plantilla actual puede terminar diciendo:

> “comparada con los 0/1/2… inmediatamente anteriores”.

Eso es técnicamente literal pero editorialmente incorrecto como explicación de una comparación equivalente.

### Corrección

- si `previousWindow.sampleSize < 5`: explicar solo que es la primera lectura sobre los últimos 5;
- si `previousWindow.sampleSize === 5`: sí mencionar la ventana móvil anterior.

No introducir “mejoró/empeoró” sin el umbral material que sigue fuera de esta fase.

---

## 7. H01

La revisión central **aprueba H01**:

- partidos históricos con identidad abierta quedan fuera de agregados relacionales;
- current match con incidencia abierta no produce claims relacionales;
- hechos no relacionales verificables siguen disponibles;
- no se elimina el partido ni se mezcla identidad con oficialidad.

No reabrir H01 salvo regresión concreta de los cambios D01–D03.

---

## 8. Supabase / deploy

**NO aplicar todavía**:

- `20260923180000_bloque8_fased_intelligence_persistence.sql`;
- `get-match-intelligence`.

No hay nada que revertir porque Claude correctamente no aplicó/deployó esos cambios.

Después de corregir D01–D05:

1. tests A+B+C+D;
2. tests focales de checkpoint/replay/fingerprint/memoria D;
3. batería de frontend pertinente;
4. un único commit/push correctivo;
5. revisión central;
6. recién entonces ChatGPT central aplica migración y deploya la Edge Function en Supabase Staging;
7. verificación real;
8. QA visual/manual del Resumen en Preview;
9. cerrar D;
10. recién después preparar E.

---

## 9. Restricciones

**NO TOCAR:**

- Fase E;
- Nivel;
- Ranking;
- capa generativa;
- main;
- Production;
- BRAMUlive;
- Mis Grupos.

Por cuota de Vercel, esta corrección justifica **un segundo y último push de Fase D** porque corrige bloqueantes reales detectados en revisión. No hacer pushes intermedios.
