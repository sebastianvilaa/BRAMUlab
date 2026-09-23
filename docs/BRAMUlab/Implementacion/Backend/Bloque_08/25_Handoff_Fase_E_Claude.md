# Backend Bloque 8 — Handoff Fase E: integración Nivel + Ranking

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Estado de entrada:** Fases A–D CERRADAS en Staging.  
**HEAD funcional de D:** `30b9fb8538cfb0f65f8e43c33d50f7541e4db425`.  
**Objetivo:** implementar únicamente **E — Integración Nivel + Ranking**, consumiendo autoridad ya existente sin recalcular Nivel ni Ranking.

---

## 1. Lectura obligatoria

Leer completo, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Backend/Bloque_08/24_Cierre_Fase_D.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md` — especialmente §§5.8, 6, 8.1, 13.2 y 13.3
5. `docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md` — Bloque E
6. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
7. `docs/BRAMUlab/Ranking_BRAMU.md`
8. `docs/BRAMUlab/Backend_Infraestructura.md` solo donde haga falta autoridad/server-side.

### Precedencia importante

`BRAMU_Intelligence.md` todavía contiene referencias históricas a “Nivel V1.4”.

Para implementación **prevalece Nivel_BRAMU_Formula_V1.5.md**.

El motor de partido `nivel_bramu_v1_0` no cambió, pero el estimador inicial sí está en V1.2. No reintroducir categoría local ni reglas retiradas.

---

## 2. Estado que NO se reabre

A–D están cerradas.

No reauditar ni rediseñar:

- historia/derivados de A;
- claims A–G de B;
- score/memoria de C;
- templates/checkpoints/audit/UI de D;
- H01/D01–D06.

Solo extender contratos donde E necesita sumar datos oficiales.

---

## 3. Fuente de verdad — Nivel

NO recalcular Nivel dentro de Intelligence.

Consumir el resultado oficial ya persistido:

### `match_level_results`

Datos relevantes ya existentes:

- `result_id`;
- `match_id`;
- `algorithm_version`;
- `eligible`;
- `reason_codes`;
- `known_levels_count`;
- `team_strength_a/b`;
- `expectation_a/b`;
- `rival_pair_confidence_avg_a/b`;
- `margin`;
- factores ya calculados;
- `effect_status`;
- relaciones de reversión/supersesión.

### `match_level_result_players`

Datos relevantes:

- `player_id`;
- `team`;
- `formula_mu_before`;
- `formula_confidence_before`;
- `formula_state`;
- `effective_level`;
- `delta_raw`;
- `delta_capped`;
- `evidence_quality`;
- `mu_after`;
- `confidence_after`.

Usar únicamente el resultado **vigente/aplicado** del partido. Una versión revertida o supersedida nunca alimenta Intelligence.

No derivar expectativas desde niveles actuales.

---

## 4. Familia H — reglas cerradas de Nivel

Implementar claims estructurados con el mismo contrato de B.

### 4.1 Por encima de expectativa

Solo si simultáneamente:

- partido oficial/computable;
- victoria del caller;
- expectativa previa de su pareja **<= 35%**;
- `known_levels_count = 4`;
- confianza prepartido mínima **>= 0,60 en los cuatro jugadores**.

Puede ser principal.

No mostrar el porcentaje en la tarjeta principal.

Ejemplo permitido:

> Tu pareja partía por debajo según los Niveles BRAMU previos y terminó ganando.

El porcentaje sí puede aparecer en “Por qué aparece”.

### 4.2 Pareja por debajo

- victoria;
- expectativa entre **36% y 44%**;
- 4 niveles conocidos;
- confianza prepartido >=0,60 en los cuatro.

Puede existir como insight, pero solo será principal si C lo combina/prioriza frente a otro hecho relevante según reglas vigentes. No introducir una excepción manual fuera de C: modelar salience/prioridad para que el motor existente pueda decidir.

### 4.3 Partido equilibrado

45%–55%:

- NO genera por sí solo un insight de dificultad.

### 4.4 Resultado esperable

Expectativa de victoria >=65%:

- solo puede explicar por qué el Nivel cambió poco;
- nunca es festejo principal por sí solo.

### 4.5 Tres niveles conocidos

Puede decir:

> Con los niveles disponibles, tu pareja partía por debajo.

No puede decir:

- sorpresa;
- batacazo;
- triunfo de alto valor;
- expectativa precisa como si hubiera cuatro niveles confiables.

### 4.6 Dos niveles conocidos o algún nivel calibrando

No clasificar dificultad.

Puede:

- explicar evidencia limitada;
- mostrar avance de calibración;
- usar el mensaje cerrado: “Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.”

### 4.7 Variación

Puede mostrar la variación exacta del caller derivada del resultado oficial vigente.

No calcularla restando el Nivel actual del usuario contra un valor histórico.

Consumir el delta/snapshot oficial del resultado aplicado.

### 4.8 Otros hechos permitidos

Solo si se pueden demostrar desde datos oficiales existentes sin inventar:

- nuevo mejor Nivel BRAMU;
- estabilidad de Nivel cuando el cambio sea pequeño;
- avance/cierre de calibración;
- calidad de evidencia.

Si el backend actual no conserva un dato histórico suficiente para “nuevo mejor Nivel”, no inferirlo desde el estado live actual. Documentar la limitación y continuar.

---

## 5. Integración técnica recomendada

Mantener la separación de capas.

Preferir un módulo puro nuevo, por ejemplo:

`bramulab/intelligence-official.js`

o nombre equivalente, que transforme snapshots oficiales de Nivel/Ranking en **claims del mismo contrato** que ya entiende C.

### Nivel

Flujo recomendado:

A/B personal → claims A–G  
+ E snapshot oficial de Nivel → claims H  
→ C score/deduplicación/cooldowns  
→ D templates/persistencia/UX

C no debe conocer SQL ni recalcular Nivel.

### Extensión de C

Puede aceptar `extraClaims`/claims oficiales como entrada adicional, manteniendo exactamente la misma lógica editorial.

No crear un segundo selector paralelo para Familia H.

### Audit

D06 debe conservar también:

- claims H;
- snapshot IDs/versiones;
- evidence/officialScope;
- scores/descartes;
- template final.

Agregar `rulesVersions.e` y actualizar la versión combinada A+B+C+D+E.

---

## 6. Invalidation / fingerprint — requisito crítico

Fase D puede generar una salida personal cuando un partido todavía está pendiente.

Cuando después el partido se valida y aparece el resultado oficial de Nivel, el mismo Resumen debe poder regenerarse con Familia H.

Por lo tanto, el fingerprint de E debe incluir el **snapshot oficial vigente**, no solo historia/score.

Como mínimo:

- `result_id`;
- `algorithm_version`;
- `eligible`;
- `reason_codes`;
- `known_levels_count`;
- expectativas/fuerzas relevantes;
- datos del caller en `match_level_result_players`;
- `effect_status`.

Si no existe resultado oficial aplicado:

- fingerprint debe representar explícitamente “sin snapshot oficial”.

Así:

- pending → validated cambia;
- corrección/identidad que genera nuevo resultado aplicado cambia;
- reabrir sin cambios reutiliza;
- un resultado revertido deja de ser autoridad.

No usar Nivel live actual como fingerprint de un partido antiguo.

---

## 7. Ranking — NO convertirlo en causalidad de partido

Ranking es semanal e inmutable durante la edición.

Un partido puede cambiar Nivel el miércoles y el puesto seguir igual hasta el lunes.

Por eso **NO** insertar retroactivamente en la tarjeta histórica de un partido frases como:

- “este partido te hizo subir 4 puestos”;
- “ganaste y subiste al #10”.

La fuente exige lenguaje de evento semanal:

> “Tras actualizarse el Ranking…”

### Superficie recomendada V1

Integrar los hitos materiales de Ranking en **TU MOMENTO / Home**, que ya consume el Ranking server-backed real.

No crear otra tarjeta territorial ni otra pantalla.

No mezclar el evento semanal de Ranking dentro del checkpoint histórico de un partido salvo que la fuente maestra lo exija explícitamente.

---

## 8. Ranking — hitos materiales cerrados

Usar exclusivamente ediciones semanales publicadas y comparables.

Puede ser insight solo si:

1. **primera entrada** a un ranking establecido;
2. **entrada al Top 10** de un universo establecido;
3. **nueva mejor posición** con mejora de al menos 3 puestos;
4. **ascenso material** de al menos:
   `max(3 puestos, 5% del universo)`;
5. cambio de banda pública de Nivel, expresado como cambio de Nivel, no como categoría competitiva.

### Restricciones

- universo con menos de **15 elegibles** → NO generar Intelligence de puesto;
- movimientos menores → NO insight;
- Ranking no tiene puntos;
- comparar misma scope/branch/universo equivalente;
- empate visible no se rompe por ID;
- usar edición vigente vs edición anterior comparable;
- primera aparición sin comparable anterior = `Nuevo`, no delta inventado;
- no inferir “jugaste mejor” por subir puestos;
- otros jugadores pueden explicar el movimiento;
- texto causal permitido: “tras actualizarse el ranking”.

### Home

El Home actual ya usa `get_home_ranking_insight`.

Reusar/ajustar ese camino server-backed en vez de crear una fuente paralela.

Si para detectar top 10 / mejor posición hace falta ampliar el contrato server-side, hacerlo mínimamente sobre las tablas/RPC actuales de Ranking, sin recalcular la clasificación.

---

## 9. Persistencia de Ranking Intelligence

No guardar un movimiento semanal dentro de `intelligence_match_outputs`, porque esa tabla representa un checkpoint por jugador/partido.

Si hace falta memoria para no repetir el mismo hito semanal:

- preferir una clave semántica derivada de `edition_id + scope + branch + tipo de hito`;
- reutilizar la estructura/memoria editorial de Intelligence donde sea razonable;
- no crear un sistema paralelo grande.

Si la persistencia mínima exacta no está definida por la arquitectura actual, implementar primero detector + contrato y dejar la persistencia/UI final claramente documentada como DECISIÓN ABIERTA **solo si realmente bloquea mostrarlo una vez en Home**.

No sobrearquitecturar.

---

## 10. Templates de Familia H

Agregar templates determinísticos compatibles con D.

### Nivel

Tono:

- sorpresa confiable: destacado, sobrio;
- calibración: pedagógico;
- delta pequeño: explicativo;
- derrota: factual.

Nunca:

- “BRAMU pensaba que perdías”;
- “batacazo”;
- psicología;
- técnica;
- causalidad no registrada.

### Ranking

Ejemplos de tono:

> Entraste por primera vez al Top 10 local tras actualizarse el Ranking semanal.

> Tu posición semanal mejoró 4 puestos en el Ranking local.

No decir:

> Este partido te hizo subir 4 puestos.

“Por qué aparece” puede mostrar:

- edición anterior / edición actual;
- puesto anterior/nuevo;
- total elegible;
- scope;
- fecha de publicación.

Nunca mostrar IDs técnicos.

---

## 11. QA match real existente

Conservar el partido de QA de Fase D:

`4c8c3f8b-f2c4-4ef7-87c1-6b2cafdc33ba`

Actualmente está `pending_validation`.

No borrarlo.

Puede usarse después para validar la transición:

1. Intelligence personal mientras pending;
2. validación real;
3. creación de snapshot oficial de Nivel;
4. regeneración determinística del mismo partido con fingerprint E;
5. aparición o abstención honesta de Familia H.

No fabricar el resultado oficial por SQL para esa prueba: la QA final deberá pasar por el flujo real de validación.

---

## 12. Tests mínimos de E

Mantener A+B+C+D verdes.

Agregar como mínimo:

### Nivel

1. sin resultado oficial aplicado → 0 claims H oficiales;
2. resultado no elegible → no afirmar impacto de Nivel;
3. victoria <=35%, 4 niveles y conf >=0.60 → sorpresa confiable;
4. 36–44% → pareja por debajo, sin lenguaje de sorpresa extrema;
5. 45–55% → no claim de dificultad por sí solo;
6. >=65% → solo explica delta pequeño, nunca festejo;
7. 3 niveles → lenguaje limitado;
8. 2 niveles / calibrando → no clasifica dificultad;
9. delta exacto sale del snapshot oficial, no de Nivel live;
10. resultado revertido/supersedido no alimenta claim;
11. cambio de resultado oficial cambia fingerprint;
12. pending→validated invalida checkpoint;
13. reabrir con mismo snapshot reutiliza;
14. audit incluye Familia H + snapshot/versiones;
15. templates H no exponen porcentajes en principal si la fuente lo prohíbe.

### Ranking

16. <15 elegibles → no insight de puesto;
17. primera entrada a ranking establecido → hito válido;
18. entrada al Top 10 → hito válido;
19. mejora de 1–2 puestos → no insight;
20. nueva mejor posición con >=3 → válido;
21. ascenso >= max(3,5% universo) → válido;
22. movimiento sin partido propio sigue usando lenguaje no causal;
23. edición no comparable → no delta;
24. `Nuevo` no se convierte en subida inventada;
25. mismo hito/edición no se repite en Home;
26. 0 puntos propios de Ranking;
27. 0 claims/números/entidades inventadas.

---

## 13. Entornos / deploy

- desarrollo solo en `staging`;
- no tocar `main`;
- no tocar Production;
- no tocar BRAMUlive;
- no Fase F/generativa.

Si E requiere migración/RPC/Edge Function:

- preparar y testear localmente;
- NO aplicar/deployar Supabase desde Claude si no tiene autorización;
- ChatGPT central revisará y aplicará después.

### Vercel

Consolidar toda E en un único push funcional cuando sea posible.

No hacer micro-pushes ni deploys “para ver”.

---

## 14. Entrega

Al terminar:

1. guardar informe en `docs/BRAMUlab/Implementacion/Backend/Bloque_08/`;
2. listar exactamente archivos/migraciones/functions;
3. indicar cualquier DECISIÓN ABIERTA real;
4. ejecutar A+B+C+D+E;
5. frontend tests si toca Home/UI;
6. revisar diff completo;
7. un único commit/push lógico a `origin/staging`;
8. NO avanzar a F.

La ronda no termina hasta que commit e informe estén accesibles en `origin/staging`.
