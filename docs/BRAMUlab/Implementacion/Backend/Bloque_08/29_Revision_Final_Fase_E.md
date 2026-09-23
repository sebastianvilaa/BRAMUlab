# Backend Bloque 8 — Revisión central final de Fase E (post E01–E06)

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit funcional revisado:** `6fd9eae3f9678d9353ada24a150d3c3b6bcc63c3`  
**Estado:** **E01–E06 APROBADOS. Faltan tres correcciones chicas E07–E09 antes del redeploy de Intelligence y la QA final.**

## 1. Qué queda aprobado

La revisión central da por correctos:

- E01 — `Nuevo` ya no equivale automáticamente a primera entrada; gate >=15 correcto;
- E02 — memoria editorial local por usuario/edición/scope/tipo;
- E03 — el claim ya distingue si el caller está calibrando;
- E04 — quinto hito semanal: cambio de banda pública de Nivel;
- E05 — variación + contexto de resultado esperable sin doble historia H;
- E06 — `rulesVersions.b/e` corregido;
- suite reportada: **237/237 PASS**.

La migración de Ranking fue validada por ChatGPT central con **transacción + ROLLBACK sobre el esquema real** y compiló correctamente.

Después del dry-run, ChatGPT central **ya aplicó** en Supabase Staging:

`bloque8_fasee_ranking_best_position`

No revertir ni reemplazar esa migración. E07–E09 no requieren cambios SQL.

La Edge Function E **todavía NO fue redeployada**: se retuvo al detectar los puntos siguientes.

---

## 2. E07 — no marcar un hito de Ranking como “visto” si TU MOMENTO no llegó a mostrarlo

**Bloqueante UX/memoria.**

En `app.js` hoy:

1. se clasifica el hito;
2. se llama a `PH.buildTuMomentoText(..., insight)`;
3. se marca el hito como visto.

Pero `buildTuMomentoText` tiene retornos tempranos para 0, 1 y 2 partidos. En esos estados ignora `rankingInsight`.

Eso significa que, si por cualquier razón el usuario tiene un hito real pero su Home visible contiene menos de 3 partidos —por ejemplo, ocultó partidos válidos del historial—, el hito puede **no aparecer en pantalla y aun así quedar marcado como visto**.

Contradice E02:

> marcar como visto solo después de pintarlo realmente.

### Corrección recomendada

Sin rediseñar `player-home.js`:

- calcular primero el texto base sin Ranking;
- calcular el texto con el hito;
- si ambos textos son iguales, el hito no influyó realmente en TU MOMENTO:
  - no pintar de nuevo;
  - no marcar como visto;
- solo marcar cuando el texto con insight es distinto del texto base.

O una solución igual de simple que demuestre exactamente “se mostró realmente”.

### Tests

Agregar test puro/integración mínima que cubra:

- 0–2 partidos + milestone válido → no debe marcarse visto si el texto no lo incorporó;
- 3+ partidos + milestone incorporado → sí puede marcarse visto.

No cambiar la UX de Estado Cero para forzar Ranking ahí.

---

## 3. E08 — “Por qué aparece” todavía puede atribuir falsamente la evidencia limitada a otro participante

**Bloqueante factual.**

El body de E03 quedó bien.

Pero el `why` actual para `nivel_evidencia_limitada`, cuando `callerCalibrating=false`, dice:

> “Uno o más Niveles BRAMU previos de este partido (de otro participante, no el tuyo) no tenían evidencia suficiente todavía.”

Eso no se puede garantizar.

Caso real posible:

- caller con `formulaState = CALIBRADO`;
- pero su propia `formulaConfidenceBefore < 0.60` (por ejemplo, tras decay/inactividad);
- `callerCalibrating=false`;
- la limitación puede venir del propio caller, no necesariamente de otro participante.

También puede faltar directamente fila propia en escenarios de evidencia incompleta.

### Corrección requerida

Cuando `callerCalibrating=false`, usar un `why` genérico y verdadero, por ejemplo:

> “Uno o más Niveles BRAMU previos de este partido no tenían evidencia suficiente para clasificar la dificultad con confianza.”

No afirmar “otro participante” salvo que el claim lo demuestre explícitamente.

No hace falta agregar otro campo si el copy genérico resuelve el problema de forma honesta.

### Tests

- caller CALIBRADO con confianza propia <0.60 → jamás decir “de otro participante, no el tuyo”;
- caller sin fila propia en evidencia limitada → copy sigue siendo factual;
- mantener el caso caller CALIBRANDO con el mensaje cerrado ya aprobado.

---

## 4. E09 — cambio de banda no debe renderizar “—” como Nivel

**Corrección defensiva factual.**

`classifyHomeRankingMilestone` valida que existan `levelBand` y `previousLevelBand`, pero no exige que existan también:

- `levelPublic`;
- `previousLevelPublic`.

`buildRankingMomentoClause` tiene fallback a `—`, por lo que un snapshot parcial podría producir:

> “Tu Nivel BRAMU pasó de — a —…”

Las columnas son nullable en el esquema real. Aunque el pipeline normal debería poblarlas juntas, Intelligence no debe depender de esa suposición.

### Corrección requerida

Para clasificar `cambio_de_banda`, exigir además:

- `Number.isFinite(levelPublic)`;
- `Number.isFinite(previousLevelPublic)`.

Si faltan, no generar ese hito.

Eliminar el fallback `—` del copy o dejarlo como defensa inaccesible; preferencia: que el classifier garantice el contrato y el copy reciba números reales.

### Tests

- bandas distintas + uno de los niveles públicos null/undefined → no hito;
- bandas distintas + ambos niveles públicos numéricos → hito + copy exacto.

---

## 5. Alcance

**NO TOCAR:**

- migración ya aplicada;
- E01–E06 salvo lo estrictamente necesario para E07–E09;
- motor de Nivel;
- cálculo de Ranking;
- A–D;
- Edge Function;
- Fase F;
- main;
- Production;
- BRAMUlive;
- Mis Grupos.

E08 vive en la capa compartida server-side de presentación, pero no requiere cambio de contrato ni SQL.

E07/E09 tocan archivos servidos al navegador, por lo que corresponde **un único bump final**:

`04.10-h25 → 04.10-h26`

Este push adicional está justificado por bugs reales detectados en revisión final. No hacer micro-pushes.

---

## 6. Gate

Después de E07–E09:

1. mantener A+B+C+D+E verdes;
2. tests focales nuevos;
3. revisar diff;
4. un único commit/push final;
5. ChatGPT central revisa;
6. ChatGPT central redeploya `get-match-intelligence`;
7. QA real;
8. cerrar Fase E.

No avanzar a F.
