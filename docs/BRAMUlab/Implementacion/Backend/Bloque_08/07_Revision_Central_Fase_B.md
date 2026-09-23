# Backend Bloque 8 — Revisión central de Fase B

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit revisado:** `67c70efa168921f6c75d3a26de80212979a24abe`  
**Estado:** **NO cerrar Fase B todavía — corrección focal antes de avanzar a C.**

## 1. Resultado general

La dirección de Fase B es correcta:

- módulo puro nuevo `intelligence-claims.js`;
- composición sobre Fase A sin reabrirla;
- separación clara entre evidencia (B), relevancia/memoria (C) y redacción (D);
- familias A–G cubiertas sin tocar Nivel/Ranking;
- Familia H correctamente diferida a Fase E;
- 57/57 tests reportados;
- sin cambios de Supabase, UI, main, Production ni BRAMUlive.

La revisión central detectó cuatro puntos concretos de contrato/evidencia. Son corregibles dentro de Fase B sin rediseñarla.

---

## 2. C01 — `evidenceMatchIds` incompleto en claims históricos/comparativos

**Bloqueante.**

`BRAMU_Intelligence.md` define el insight como objeto trazable y exige conservar **partidos fuente**. La evidencia debe alcanzar para reconstruir la afirmación estructurada; no alcanza con que el número haya sido calculado correctamente en memoria.

Actualmente varios claims incluyen valores históricos/comparativos que no están respaldados por todos los partidos necesarios en `evidenceMatchIds`.

Casos concretos:

### Racha cortada

El claim contiene:

- `previousType`;
- `previousLength`;
- `newType`.

Pero hoy `evidenceMatchIds` contiene únicamente el partido actual.

Debe incluir al menos:

- los partidos que forman la racha previa afirmada;
- el partido actual que la corta.

### Récord / igualdad de récord de racha

Para afirmar “nuevo récord personal” o “iguala récord personal” no alcanza con guardar los IDs de la racha actual.

Debe conservar evidencia suficiente del universo comparable usado para demostrar el récord/empate. La opción simple y auditable en V1 es incluir los IDs del historial decidido comparable usado para esa evaluación.

### Hitos acumulativos 10 / 25 / 50 / 100 y primera victoria

Un claim “victoria número 10” no queda respaldado por un único `matchId`.

Debe conservar los partidos fuente que sostienen el conteo acumulativo. Para hitos de victorias, incluir como mínimo los IDs de las victorias contadas hasta ese hito.

Para “primera victoria”, conservar el historial decidido necesario para demostrar que no existía una victoria previa.

### Forma reciente

El objeto `claim` hoy contiene:

- ventana actual;
- `previousWindow`.

Pero `evidenceMatchIds` contiene únicamente los IDs de la ventana actual.

Si el claim conserva valores de ambas ventanas, la evidencia debe incluir los partidos de ambas ventanas —idealmente con IDs diferenciables dentro del propio claim o, como mínimo, la unión completa en `evidenceMatchIds`.

### Mejor compañero

`companero_mejor_balance` compara a varios compañeros pero conserva evidencia únicamente de los partidos del compañero elegido.

Para afirmar “mejor entre N compañeros comparables”, debe conservar evidencia de todos los candidatos realmente comparados, junto con su muestra/balance, o una estructura equivalente que permita reconstruir el ranking comparativo.

### Regreso tras inactividad

El threshold de inactividad depende de:

- partido actual;
- partido anterior;
- gaps de hasta los últimos 10 antecedentes;
- muestra mínima de 6 previos.

Hoy el claim conserva solo `[ctx.matchId]` y `sampleSize:1`.

Debe conservar los partidos realmente usados para calcular el gap/mediana/threshold y reportar una muestra coherente con esa evidencia.

### Regla de aceptación C01

Todo claim afirmado debe poder reconstruirse usando:

- `claim`;
- `evidenceMatchIds`;
- `comparisonScope`;
- `sampleSize`;
- `dataAsOf`;

sin depender de información histórica invisible que no quedó referenciada.

---

## 3. C02 — Forma reciente: la “ventana inmediatamente anterior” está calculada incorrectamente

**Bloqueante.**

La fuente maestra dice:

> “La forma reciente es una ventana móvil.”

y:

> “mejoró tu forma reciente” solo si cambia el balance de los últimos 5 respecto de la ventana inmediatamente anterior.

La implementación actual usa un bloque no superpuesto anterior:

`slice(max(0, windowEnd - 5), windowEnd)`

Ejemplo con 6 partidos decididos:

- ventana actual correcta: partidos 2–6;
- ventana inmediatamente anterior correcta: partidos 1–5;
- implementación actual: solo partido 1.

Eso no es una ventana móvil.

### Corrección requerida

- Con 5 partidos decididos: existe la primera lectura de forma de 5.
- Con 6 o más: la ventana inmediatamente anterior debe ser los **5 partidos anteriores al actual**, es decir, la ventana móvil previa.
- El contexto de 10 sigue siendo secundario y no debe confundirse con esta comparación.

Además, la definición de madurez de producto dice:

- 2–4 previos: “Calibrando historia”;
- 5–9: “Forma de 5”;
- mensaje de aprendizaje: “5 partidos: Tu forma reciente ya puede leerse sobre tus últimos 5.”

Por lo tanto, `forma_reciente` **no debe afirmarse como claim válido con 1–4 partidos decididos**.

Con menos de 5:

- devolver candidato descartado con motivo explícito, o
- no afirmarlo como claim utilizable.

Preferencia: descartado explícito, consistente con el contrato adoptado en Fase B.

### Evidencia requerida

Cuando exista comparación contra la ventana previa, conservar IDs de ambas ventanas.

---

## 4. C03 — Empates en “el más / mejor”

**Bloqueante.**

`BRAMU_Intelligence.md` §5.2 fija:

> “el más…” debe considerar empates: “iguala tu…” si no es único.

Hay dos lugares donde hoy se pierde esa información.

### Score excepcional

`buildComparableFormatExtremeClaim` marca:

- `mas_ajustado` si `current === min`;
- `mas_amplio` si `current === max`.

No distingue si el extremo es único o está empatado con uno o más partidos anteriores.

Debe conservar explícitamente:

- si el extremo es único;
- cuántos partidos comparten ese extremo;
- o un estado equivalente que permita a D redactar “iguala” cuando corresponda.

No usar un desempate técnico para convertir un empate en récord único.

### Mejor compañero

`buildBestCompanionClaim` ordena por efectividad y usa `playerId` como desempate estable.

Eso es válido para orden técnico, pero **no** para afirmar que uno es el “mejor” si dos o más tienen la misma efectividad.

Debe:

- detectar empate real en el valor comparado;
- conservar todos los compañeros empatados relevantes o un estado estructurado de empate;
- nunca transformar el `playerId` estable en desempate semántico visible.

La muestra de cada compañero comparado debe permanecer disponible.

---

## 5. C04 — Partido pendiente no debe cortar la búsqueda de “primer triunfo tras derrotas”

**Bloqueante.**

`buildFirstWinAfterLossesClaim` recorre `summary.matches` hacia atrás y corta ante cualquier elemento cuyo `result !== 'loss'`.

Pero `summary.matches` incluye participaciones sin resultado definido.

Ejemplo válido:

1. derrota;
2. partido pendiente;
3. derrota;
4. primera victoria.

La fuente define “primer triunfo luego de al menos 2 derrotas en el mismo alcance”. El pendiente no es victoria ni derrota y Fase A ya fijó el principio de que un partido sin resultado no rompe ni extiende una secuencia decidida.

En este caso deben contarse las derrotas decididas previas ignorando partidos sin resultado.

Además, “primer triunfo” significa que no debe existir una victoria decidida anterior dentro de ese alcance. La lógica debe verificar esto de manera explícita.

Agregar test al menos para:

- derrota + pendiente + derrota + victoria => claim válido;
- derrota + victoria previa + derrota + victoria => NO es “primer triunfo”.

---

## 6. Qué NO cambiar

**NO TOCAR:**

- Fase A;
- `matches.js`;
- migraciones/RPCs de Supabase;
- Nivel;
- Ranking;
- UI;
- plantillas;
- relevancia/cooldowns de Fase C;
- main;
- Production;
- BRAMUlive.

La decisión abierta sobre partidos ocultos permanece sin resolver y no bloquea esta corrección.

---

## 7. Pruebas mínimas de la corrección

Agregar tests focales para:

1. racha cortada: evidencia contiene racha previa + partido actual;
2. récord de racha: evidencia permite demostrar el universo comparable;
3. hito 10: evidencia contiene las victorias contadas;
4. forma reciente:
   - 4 partidos => descartada/no afirmada;
   - 5 => primera forma válida;
   - 6 => actual 2–6 vs previa 1–5;
   - evidencia de ambas ventanas;
5. mejor compañero empatado;
6. score extremo empatado;
7. inactividad: evidencia + sample coherentes con el threshold;
8. derrota + pending + derrota + primera victoria;
9. existencia de una victoria previa impide “primer triunfo”.

Mantener verdes los tests de Fase A.

---

## 8. Próximo gate

Después de corregir C01–C04:

1. ejecutar tests de A+B;
2. revisar diff final;
3. un único commit/push a `origin/staging`;
4. revisión central;
5. si pasa, cerrar Fase B;
6. recién entonces autorizar C — Relevancia y memoria editorial.

No avanzar automáticamente a Fase C.
