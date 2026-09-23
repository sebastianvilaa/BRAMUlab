# Backend Bloque 8 — Revisión central de Fase E

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit funcional revisado:** `e7d73efcebe8891466b36f64c786b9526e65cba9`  
**Estado:** **NO cerrar Fase E todavía — arquitectura aprobada, corrección focal E01–E06 antes de aplicar/deployar Staging.**

## 1. Resultado general

La dirección de Fase E es correcta:

- `intelligence-official.js` consume snapshots oficiales de Nivel sin recalcular el motor;
- Familia H entra por `extraClaims` al selector existente de C, no por un segundo selector;
- fingerprint incorpora el snapshot oficial;
- la Edge Function consulta `match_level_results` / `match_level_result_players` server-side;
- Ranking sigue fuera del checkpoint por partido y se integra en `TU MOMENTO`;
- no se tocó main/Production/BRAMUlive;
- migración de Ranking NO aplicada;
- Edge Function E NO redeployada todavía;
- Claude reporta **214/214 PASS**.

La revisión central detectó seis puntos concretos. E01–E04 son bloqueantes funcionales/de producto; E05–E06 son correcciones de contrato que conviene cerrar en la misma ronda.

---

## 2. E01 — “Nuevo” de Ranking no equivale a “primera entrada”, y hoy además saltea el mínimo de 15

**Bloqueante.**

La fuente permite:

> primera entrada a un ranking establecido.

Y prohíbe Intelligence de puesto con menos de 15 elegibles.

La implementación actual:

`if (insight.isNew) return true;`

corre **antes** del gate `total < 15`.

El test actual incluso afirma como válido:

`isNew=true, total=12 → true`

Eso contradice directamente el handoff y la fuente.

Además, `movement.status='nuevo'` en Bloque 7 significa **“no hay edición anterior comparable”**, no necesariamente “nunca estuviste en ese ranking”. Puede ocurrir por reingreso después de inactividad o ruptura de comparabilidad.

### Corrección requerida

1. El gate de universo establecido (`total >= 15`) debe correr **antes de cualquier hito de puesto**, incluida primera entrada.
2. “Primera entrada” requiere evidencia de que no hubo posición histórica previa en ese scope/branch.
3. Usar el dato histórico agregado por la migración:
   - campo presente + `bestPositionBefore === null` → puede ser primera entrada;
   - `bestPositionBefore` numérico → no es primera entrada, aunque movement.status sea `nuevo`;
   - campo ausente/undefined → no afirmar primera entrada.
4. Mantener `Nuevo` como estado de Ranking donde corresponda, pero no traducirlo automáticamente a hito de Intelligence.

### Tests

- total 12 + isNew → NO hito;
- total 15+ + isNew + bestPositionBefore null → primera entrada;
- total 15+ + isNew + bestPositionBefore numérico → NO “primera entrada”;
- campo bestPositionBefore ausente → no afirmar primera entrada.

---

## 3. E02 — el mismo hito semanal de Ranking se repite en cada visita al Home

**Bloqueante.**

La fuente de Intelligence fija:

> mismo hito: una sola aparición.

Y el handoff E pedía explícitamente:

> mismo hito/edición no se repite en Home.

El informe de Claude lo dejó como DECISIÓN ABIERTA porque `TU MOMENTO` histórico no tenía memoria. Central cierra esa decisión ahora:

### Decisión V1

**El hito material de Ranking se muestra una sola vez por usuario + edición + tipo de hito.**

Esto es memoria de presentación, no autoridad deportiva. Para V1 no hace falta crear un subsistema server-side nuevo.

### Solución recomendada

Usar el Store/localStorage ya existente, con una clave mínima por usuario real.

Guardar un identificador estable equivalente a:

`ranking:<editionId>:<scopeType>:<scopeKey>:<milestoneType>`

Reglas:

- marcar como visto **solo después de pintarlo realmente** en `TU MOMENTO`;
- no marcar si la RPC falla;
- una edición nueva genera otra clave;
- no guardar posición/nivel como verdad deportiva, solo el identificador de “ya mostrado”;
- separar por `userId`, para no contaminar cuentas en el mismo navegador.

No hace falta sincronización multi-dispositivo en V1 para este estado puramente editorial.

### Requisito de contrato

El insight que llega al Home debe incluir al menos:

- `editionId`;
- `scopeType` (local para Home V1);
- `scopeKey`/territorio;
- `milestoneType`.

### Tests

- mismo usuario + misma edición + mismo tipo: segunda visita no vuelve a pintar el hito;
- edición nueva: puede aparecer un nuevo hito;
- dos usuarios distintos en el mismo navegador no comparten el “seen”;
- RPC fallida no marca como visto.

---

## 4. E03 — “evidencia limitada” puede afirmar falsamente que TU Nivel sigue calibrando

**Bloqueante factual.**

`nivel_evidencia_limitada` se genera también cuando:

- el caller ya está `CALIBRADO`;
- pero otro participante sigue `CALIBRANDO`, o la evidencia global no alcanza.

La plantilla actual siempre dice:

> “Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.”

Eso puede ser falso para el jugador de perspectiva.

### Corrección requerida

El claim debe distinguir explícitamente:

- `callerCalibrating`;
- evidencia limitada por terceros / confianza / disponibilidad.

Copy:

**Si callerCalibrating=true**  
Puede usarse el mensaje cerrado:

> Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.

**Si callerCalibrating=false**  
Usar una formulación factual de evidencia limitada, por ejemplo:

> Los Niveles disponibles todavía no alcanzan para clasificar con confianza la dificultad de este partido.

“Por qué aparece” debe explicar que uno o más Niveles previos no tenían evidencia suficiente, sin atribuírselo al caller cuando no corresponde.

### Tests

- partner/rival calibrando + caller calibrado → nunca “tu Nivel sigue calibrando”;
- caller calibrando → sí puede usar ese mensaje;
- baja confianza de un rival con caller calibrado → copy de evidencia limitada, no calibración propia.

---

## 5. E04 — falta el quinto hito cerrado: cambio de banda pública de Nivel

**Bloqueante de alcance.**

`BRAMU_Intelligence.md §13.3` incluye explícitamente:

> cambio de banda pública de Nivel BRAMU, expresado como cambio de nivel, no como categoría competitiva.

El informe lo identifica como “hito de Nivel” y lo deja fuera del detector de Ranking, pero **no lo implementa en ninguna otra superficie**. Por lo tanto hoy el quinto caso no existe.

### Decisión de implementación V1

Tratarlo como **evento semanal de TU MOMENTO**, usando snapshots publicados de Ranking/Nivel, no como causalidad de un partido.

Ampliar mínimamente el contrato server-side preparado para Home para devolver, cuando exista edición previa comparable:

- `previousLevelPublic`;
- `previousLevelBand`;
- current `levelPublic` / `levelBand` ya existentes.

No recalcular bandas desde estados live si la fila semanal ya las guarda.

Hito:

- `previousLevelBand != currentLevelBand`;
- edición vigente publicada;
- existe comparación válida;
- una vez por edición mediante E02.

Copy debe expresarse como **cambio de Nivel**, por ejemplo:

> Tu Nivel BRAMU pasó de 5,8 a 6,1 en el último corte semanal.

No usar:

- “subiste de categoría”;
- puntos de Ranking;
- causalidad con un partido.

Si al revisar la RPC vigente existe una forma todavía más directa de obtener ambos snapshots publicados, usarla. No crear una fórmula paralela.

---

## 6. E05 — “resultado esperable” existe como claim pero actualmente no puede cumplir su función visible

**Corrección de contrato.**

`nivel_resultado_esperable` queda con perfil `genericScoreOnly` y penalización −30. Con sus subpuntajes actuales no alcanza el umbral 55, por lo que en la práctica queda siempre fuera.

Al mismo tiempo `nivel_variacion` puede superar 55 y mostrarse sola.

Resultado: en una victoria con expectativa >=65%, BRAMU puede mostrar el delta pero **no explicar el contexto favorable previo**, aunque la fuente define precisamente ese uso.

### Corrección requerida

No inventar un umbral nuevo de “delta chico”.

Usar los datos oficiales ya existentes para que, cuando:

- victoria;
- expectativa >=65%;
- existe `nivel_variacion` oficial del caller;

la salida visible pueda **combinar el contexto esperable con la variación exacta** sin crear dos historias H separadas.

Solución simple recomendada:

- enriquecer el claim de `nivel_variacion` con `expectationOwn` / `wasExpectedResult`;
- cuando `wasExpectedResult=true`, template factual:
  - informa el delta exacto;
  - explica que la diferencia previa era favorable;
  - no necesita decir “pequeño” si no hay un umbral documentado.

Ejemplo:

> Tu Nivel BRAMU varió +0,04; los Niveles previos marcaban una diferencia favorable para tu pareja.

“Por qué aparece” puede mostrar el porcentaje exacto.

`nivel_resultado_esperable` puede conservarse como claim auditable o fusionarse semánticamente con variación, pero no debe quedar como código muerto que nunca puede influir la salida.

### Tests

- victoria >=65% + delta oficial → la salida visible explica contexto + delta;
- porcentaje no aparece en título/cuerpo principal;
- porcentaje sí puede aparecer en “Por qué aparece”;
- no se generan dos insights H contando lo mismo.

---

## 7. E06 — metadata de rulesVersions en output mezcla B con E

**Corrección pequeña, hacer ahora.**

En `renderInsight`:

`b: candidate.rulesVersion || 'bramu_intelligence_v1'`

Para un claim de Familia H, `candidate.rulesVersion` es `bramu_intelligence_official_v1`, por lo que termina guardado erróneamente bajo la clave **b**.

El audit sí guarda A/B/C/D/E correctamente, pero el output persistido queda semánticamente mal rotulado.

### Corrección

En output:

- `b` siempre = versión real de Fase B;
- `e` = versión de integración oficial E;
- A/C/D permanecen iguales.

Puede incluir E también para insights A–G porque el pipeline combinado ya está en versión E; no hace falta condicionar por familia.

Agregar test de un insight H persistido:

- `rulesVersions.b === bramu_intelligence_v1`;
- `rulesVersions.e === bramu_intelligence_official_v1`.

---

## 8. Migración preparada — ajuste adicional

Como la migración todavía NO fue aplicada, modificar el mismo archivo existente.

Al consultar historia para `bestPositionBefore` y snapshots previos:

- usar solo ediciones realmente publicadas (`published_at is not null`) si el modelo permite que existan ediciones no publicadas;
- nunca leer una edición futura;
- conservar mismo scope/branch para hitos de puesto;
- para el cambio de Nivel semanal, consumir las filas publicadas correspondientes sin recalcular Nivel.

No crear migración compensatoria.

---

## 9. Qué queda aprobado y NO tocar

**APROBADO:**

- uso de snapshots `match_level_results` / `match_level_result_players`;
- `effect_status='applied'`;
- extraClaims dentro de C;
- fingerprint oficial;
- Edge Function batched;
- thresholds 35 / 36–44 / 45–55 / >=65;
- 4 niveles + confianza >=0,60;
- lenguaje acotado con 3 niveles;
- 2 niveles/evidencia limitada sin clasificar dificultad;
- delta desde snapshot, nunca live;
- ubicación de Ranking en TU MOMENTO;
- no causalidad de partido para movimiento semanal;
- bundle único h24.

**NO TOCAR:**

- A–D salvo extensiones estrictamente necesarias para E03/E05/E06;
- motor de Nivel;
- cálculo de Ranking;
- Fase F;
- main;
- Production;
- BRAMUlive;
- Mis Grupos.

---

## 10. Tests mínimos de corrección

Mantener la suite E actual y agregar cobertura para:

1. isNew con total<15 → false;
2. isNew + total>=15 + sin posición histórica → primera entrada;
3. isNew + posición histórica previa → no primera entrada;
4. bestPositionBefore ausente → no afirmar primera entrada;
5. mismo hito/edición se muestra una sola vez;
6. edición nueva puede mostrar hito nuevo;
7. memoria seen separada por userId;
8. caller calibrado + tercero calibrando → copy NO dice “tu Nivel sigue calibrando”;
9. caller calibrando → copy de calibración permitido;
10. baja confianza ajena → evidencia limitada factual;
11. cambio de banda pública de Nivel desde snapshots semanales → hito válido;
12. sin cambio de banda → no hito;
13. copy de banda usa niveles, nunca “categoría” ni puntos;
14. expectativa >=65 + delta oficial → contexto esperable influye el copy visible;
15. no hay doble insight H para variación + resultado esperable;
16. rulesVersions del output conserva B bajo `b` y E bajo `e`;
17. migración compila sobre esquema real con rollback.

---

## 11. Gate

Después de corregir E01–E06:

1. tests A+B+C+D+E;
2. frontend tests pertinentes;
3. revisar diff;
4. UN solo commit/push correctivo;
5. revisión central corta;
6. ChatGPT central hace dry-run/aplica la migración de Ranking;
7. ChatGPT central redeploya `get-match-intelligence`;
8. QA real con el partido conservado;
9. cerrar Fase E;
10. F generativa sigue opcional y NO arranca automáticamente.

No aplicar/deployar desde Claude.
