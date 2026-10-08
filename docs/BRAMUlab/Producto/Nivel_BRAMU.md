# Nivel BRAMU — Fuente maestra

**Estado:** única fuente maestra vigente de Nivel BRAMU. Todo lo que no esté acá (o en el código que acá se cita) no es normativo.
**Cierre:** Nivel BRAMU **V1.3** cerrado en **Staging** (BRAMUlab **V04.28 / bundle `04.28-h7`**, 03/10/2026) con QA técnico y QA humano en iPhone aprobados. **Production (abierta el 07/10/2026) corre esta versión** dentro de V04.37.
**Versionado (dos ejes independientes):**

| Eje | Valor vigente | Qué versiona |
|---|---|---|
| `questionnaire_version` | `nivel_inicial_v1_3` (`questionnaire_mode = full`) | Estimador inicial / cuestionario de alta y de recalibración |
| `algorithm_version` | `nivel_bramu_v1_0` | Motor posterior de partidos (sin cambios desde V04) |

"V1.3" versiona **solo** el estimador inicial. Cualquier cambio de parámetros del cuestionario o del motor exige una versión nueva explícita; nunca se editan los valores de una versión ya usada por registros existentes.

**Código que implementa este documento** (si hay discrepancia matemática entre código y texto, es un bug a reportar, no una decisión a reinterpretar):

- `bramulab/level-calibration.js` — estimador V1.3, estado del cuestionario adaptativo, calibración/recalibración. Compartido con la Edge Function `officialize-onboarding` por symlink (una sola fórmula; el servidor recalcula desde las posiciones crudas).
- `bramulab/level.js` y `bramulab/match-level-engine.js` — motor de partidos `nivel_bramu_v1_0`.
- Tests de reglas: `bramulab/tests/v0428-nivel-inicial-v13.test.mjs` (estimador V1.3; el banco de preguntas del Anexo A se verifica literalmente contra este documento), `bramulab/tests/match-level-engine.test.mjs` y la batería de `bramulab/tests.html`.

---

## 1. Propósito y principios

El Nivel BRAMU es la estimación individual de capacidad competitiva de cada jugador en BRAMUlab, sobre **una única escala universal**.

- **Nivel BRAMU:** capacidad estimada individual, dinámica, universal; acompaña al jugador.
- **Ranking BRAMU:** posición **semanal** publicada dentro de un universo filtrado (ver `Ranking_BRAMU.md`). Ranking consume el Nivel **consolidado**; nunca lo calcula. Un jugador puede cambiar de posición sin haber jugado.

Principios:

1. Mayor número = mejor nivel.
2. El nivel pertenece al jugador, no a la pareja.
3. Todo nivel inicial es una estimación, no una verdad.
4. Nivel y confiabilidad son conceptos separados.
5. Los partidos computables son la principal fuente de evidencia.
6. El usuario participa de la estimación inicial respondiendo el cuestionario, pero no edita libremente ningún número.
7. El historial nunca se borra por recalibrar.
8. Cada variación debe poder explicarse con datos reales.
9. No se premia la repetición artificial de rivales ni de compañeros.
10. **Escala universal:** un Nivel 5,4 significa lo mismo para cualquier persona. No hay Nivel separado por género, ni ajustes hombre/mujer, ni ajuste por categoría competitiva local, país o circuito.
11. Lo declarado en un cuestionario nunca se presenta como observado en un partido.

## 2. Escala y precisión

- Escala pública: **1,0 a 10,0** (el estimador inicial produce valores dentro de 1,0–9,0; el motor limita a 1,0–10,0).
- Presentación: **un decimal**. Cálculo interno: **cuatro decimales**. Ranking y cálculos usan el valor interno.
- No se muestran variaciones `+0,0` / `−0,0`.
- **No hay categoría textual del Nivel** (ni "Intermedio", ni "Avanzado", etc.) en el alta ni en el resultado: se muestra el número y el estado. La categoría competitiva local del jugador no forma parte del cálculo ni de la comunicación del Nivel.

## 3. Estados

### 3.1 PENDIENTE (sin estimación)

El jugador todavía no confirmó el cuestionario. No tiene Nivel visible y nunca se muestra un Nivel inventado. El estado `PENDIENTE` existe server-side desde que hay `player_id` (incluso si el email se confirma antes de terminar el alta). Es el único estado desde el cual el alta puede oficializar un Nivel inicial.

### 3.2 CALIBRANDO

Comienza al confirmar el cuestionario V1.3.

- Se muestra de inmediato el Nivel estimado y el progreso `X / 5 PARTIDOS`.
- El Nivel es visible **desde el inicio**; no se reescribe historial al consolidar.
- Mayor sensibilidad a los partidos (confianza baja, tope ±0,50 por partido).
- Tratamiento visual: **número y etiqueta `CALIBRANDO` en ámbar** (`--gold`); el arco del medidor puede ser cian/azul. El color nunca es la única señal.

Resultado típico del alta: `5,3` + `CALIBRANDO · 0 / 5 PARTIDOS`.

### 3.3 CALIBRADO

Se alcanza con **5 partidos computables y al menos 3 rivales distintos**. Se presenta como `NIVEL CALIBRADO` (lima BRAMU + check). Significa evidencia mínima suficiente, no permanencia. Tope ±0,35 por partido.

### 3.4 RECALIBRANDO

Estado temporal iniciado voluntariamente (ver §6). Mientras dura, el **Nivel consolidado anterior sigue siendo el oficial** para Ranking y comparaciones. Con Nivel consolidado se presenta como consolidado (valor blanco, sin etiqueta ámbar).

### 3.5 Inactividad

Afecta la confiabilidad, no el Nivel ni el estado (§8.3). Tratamiento atenuado + aviso "Volvé a jugar para actualizar tu nivel" después de ~60–90 días sin partidos computables.

| Estado | Señal textual | Tratamiento |
|---|---|---|
| PENDIENTE | Completá tu evaluación | Neutro |
| CALIBRANDO | `CALIBRANDO · X/5` | Ámbar |
| CALIBRADO | `NIVEL CALIBRADO` | Lima + check |
| RECALIBRANDO | `RECALIBRANDO` | Ámbar diferenciado + ícono de actualización |

## 4. Onboarding de Nivel V1.3 (UX vigente)

Único camino. **No existe camino rápido** (ni por UI, URL, estado previo ni función interna; el servidor rechaza `mode: quick` y cualquier versión distinta de `nivel_inicial_v1_3`).

**Qué NO entra al cálculo ni a la UI del alta:** autoetiquetas de nivel, años jugando, frecuencia, entrenamiento/clases, categoría competitiva local, género, pregunta de resultados competitivos, stepper o ajuste manual del número.

### 4.1 Intro (card de bienvenida)

Card propia de BRAMU (oscura/azulada, borde sutil, título 24 px, cuerpo 16 px, sin imagen ni paso extra) con un único CTA:

- kicker `ANTES DE EMPEZAR`
- título `PENSÁ EN TU JUEGO HABITUAL`
- `No en tu mejor ni en tu peor partido. Cuanto más realista seas, mejor será tu punto de partida en BRAMU.`
- `Después, tus partidos lo van ajustando.`
- `5 PREGUNTAS · CERCA DE 2 MINUTOS`
- CTA `EMPEZAR`

### 4.2 Pregunta y componente de respuesta

Cinco preguntas, una por pantalla, cada una con **cuatro descripciones completas** de menor a mayor dominio. El jugador nunca ve letras A/B/C/D, valores internos, rama baja/media/alta ni categorías.

Doble entrada sobre el **mismo valor discreto** `p ∈ {0…9}`:

1. **Tap en una descripción:** descripción 1/2/3/4 → posición 0/3/6/9 (el thumb salta al ancla).
2. **Slider vertical discreto de 10 posiciones.** Entre cada par de descripciones hay exactamente dos posiciones intermedias. Snap en cada posición; nunca valores continuos.

Reglas de UI:

- Nada preseleccionado; `CONTINUAR` deshabilitado hasta la primera interacción válida.
- Orientación vertical, rail neutro/oscuro (no escala verde ni multicolor: el Nivel no es una nota bueno/malo).
- Solo se dibujan los **4 puntos-ancla**; las 10 posiciones siguen siendo funcionales.
- Thumb azul/cian BRAMU con indicador (pico) hacia la derecha; área táctil sin reducir.
- Posición intermedia: las dos tarjetas vecinas se enfatizan **ponderadas por cercanía** — 100/0 (ancla), 67/33, 33/67, 0/100 — vía fondo/borde/glow; **nunca** bajando la opacidad del texto.
- Helper vigente: `Tocá una descripción. Si estás entre dos opciones, usá el control para ajustar tu respuesta.`
- Sin mensajes dinámicos tipo "elegiste una de las descripciones".
- Accesible por touch, mouse y teclado; foco y labels.

### 4.3 Adaptatividad

- P1 es común. Antes de cada pregunta 2–5 se calcula la **media acumulada** de los valores ya respondidos y se elige la rama: `<4,1` baja · `4,1 ≤ m < 6,4` media · `≥6,4` alta (comparación a 4 decimales, sin ruido de coma flotante).
- La rama es técnica e interna; nunca se comunica.
- Volver atrás sin cambiar de rama conserva las respuestas posteriores. **Si el cambio altera la rama, se descartan las respuestas posteriores afectadas y se vuelven a preguntar**; nunca se reutiliza una posición con textos de otra rama.
- Volver atrás o cambiar una respuesta no reduce la confianza.

### 4.4 Resultado y confirmación

Pantalla `TU PUNTO DE PARTIDA EN BRAMU`: número (ámbar) + `CALIBRANDO` + explicación breve; sin categoría textual. Acciones: `CONFIRMAR MI NIVEL` y `Revisar respuestas` (conserva respuestas; aplica la invalidación adaptativa vigente). Si la dispersión es ≥ 2,0 se sugiere revisar las respuestas, **sin bloquear** la confirmación.

### 4.5 Persistencia local y reanudación del alta

- Progreso local versionado `bramulab.nivelProgress.v13`, **aislado por `scopeKey`** (alta en curso: identificador aleatorio persistido en `signupDraft`; cuenta existente: `player_id`). No hay restauración cruzada entre altas/cuentas; el progreso sin scope se descarta. Se limpia al confirmar y al limpiar el alta.
- Tras `CONFIRMAR MI NIVEL`, hasta que la cuenta quede oficializada, la única fuente es `signupDraft.nivelState/nivelAnswers`. Volver desde OTP/confirmación de email y reentrar a Nivel **reconstruye el resultado ya calculado** (no obliga a repetir las 5 preguntas) y `Revisar respuestas` vuelve a P1 con las respuestas. Al oficializar con éxito se limpian borrador y progreso.
- Un cuestionario V1.2 incompleto persistido localmente se reinicia bajo V1.3 descartando **solo** las claves de Nivel; cuenta, email, perfil y username quedan intactos.

## 5. Fórmula inicial V1.3 (`nivel_inicial_v1_3`)

### 5.1 Dimensiones (20 % cada una)

`panorama` (P1, común) · `ritmo` (P2) · `ataque` (P3) · `defensa` (P4) · `decisiones` (P5). El texto exacto de cada pregunta y rama está en el **Anexo A**.

### 5.2 Anclas internas

| Rama | A | B | C | D |
|---|---:|---:|---:|---:|
| P1 común | 1,8 | 3,8 | 5,8 | 7,2 |
| P2–P5 baja | 1,5 | 2,8 | 3,8 | 4,6 |
| P2–P5 media | 3,3 | 4,2 | 5,2 | 6,2 |
| P2–P5 alta | 5,7 | 6,3 | 7,0 | 8,8 |

(A–D = descripciones 1–4 en orden; notación interna.)

### 5.3 Interpolación del slider

Para `p ∈ {0…9}` y anclas `a = [A,B,C,D]`:

```text
si p = 9: value = D
si no:    segment = floor(p / 3); fraction = (p mod 3) / 3
          value = a[segment] + fraction × (a[segment + 1] − a[segment])
```

### 5.4 Resultado

```text
initial_level = clamp((v1 + v2 + v3 + v4 + v5) / 5, 1,0, 9,0)
```

Precisión interna de 4 decimales; presentación a 1 decimal. Sin modificadores por género, entrenamiento, frecuencia, años ni categoría. Un paso intermedio del slider mueve el resultado final entre ≈ 0,04 y 0,13 según rama y segmento: ninguna respuesta aislada puede mover casi un punto.

### 5.5 Confianza de origen

```text
spread = max(v1…v5) − min(v1…v5)
spread < 2,0  → origin_confidence = 0,15
spread ≥ 2,0  → origin_confidence = 0,10
```

`spread ≥ 2,0` solo **sugiere revisar respuestas**; no altera el Nivel. La confianza no se muestra al usuario como juicio: solo controla cuánto puede corregir el motor después.

### 5.6 Por qué existe V1.3 (decisión de diseño que no debe revertirse)

El estimador anterior (V1.2) pesaba 65 % una autoetiqueta relativa al entorno del jugador ("Intermedio alto" significa cosas distintas en distintos grupos); un salto de etiqueta movía ≈ 0,975 mientras una respuesta técnica movía 0,35. Años, frecuencia y entrenamiento miden exposición, no ejecución. V1.3 reemplaza todo por señales observables de juego (ritmo/presión, red, defensa/paredes, decisiones) con peso igual y respuestas adaptativas. Bajar la confianza inicial **no** corrige un mal anclaje (primer partido perdido: −0,1965 con 0,10 vs −0,1857 con 0,18), por eso la solución es el punto inicial y no la volatilidad ni alargar la calibración.

Perfiles de validación del prototipo (referencia humana aproximada → V1.3): Principiante 3,0–3,5 → 2,98 · caso que disparó el Issue #25 ~4,5 → 4,72 · desarrollo medio 4,9–5,0 → 5,05 · intermedio competitivo ~5,7–5,8 → 5,65 · ~5,9–6,0 → 5,95 · avanzado amateur ~6,9–7,0 → 6,81. Orden relativo preservado. Son referencias humanas, no niveles verdaderos registrados.

## 6. Calibración y recalibración

### 6.1 Calibración inicial

Empieza en CALIBRANDO al confirmar el cuestionario; se consolida con **5 partidos computables + ≥ 3 rivales distintos** (cierre independiente de V1.3; el motor no cambia). La confiabilidad puede variar según la calidad real de esa evidencia. No se reescribe historial.

### 6.2 Recalibración (autoservicio)

- Usa **el mismo cuestionario V1.3 vigente**; no se puede ingresar manualmente un Nivel, categoría ni nivel del grupo habitual.
- **Cooldown 90 días corridos** contados desde la confirmación del último cuestionario (inicial o de recalibración); no se reinicia anticipadamente aunque se abandone el flujo; no se encadenan.
- Acceso secundario y discreto (`Perfil > Mis datos > Nivel BRAMU`), con la próxima fecha disponible visible. No es un CTA promocional.
- Sea `mu_actual` el Nivel consolidado y `q_nuevo` el resultado del cuestionario:

```text
mu_provisional = clamp(0,75 × mu_actual + 0,25 × q_nuevo; mu_actual − 0,5; mu_actual + 0,5)
confidence_provisional = max(0,30; min(0,70; 0,75 × confidence_actual))
```

  El cuestionario pesa 25 % y mueve la referencia provisional **a lo sumo ±0,5**.
- **Cierre:** 3 partidos computables + ≥ 2 rivales distintos; **ventana máxima 120 días**. Si vence, la referencia provisional expira y continúa el consolidado anterior.
- Mientras tanto, Ranking y comparaciones usan el Nivel consolidado previo; el detalle privado puede mostrar la referencia provisional. Historial y eventos previos se preservan.
- Estado de implementación: motor y tests listos; la app **todavía no tiene UI de recalibración** (la representación visual de `RECALIBRANDO` se define cuando se construya). No se creó ninguna regla nueva de elegibilidad (por ejemplo "después de 20 partidos"): fuera de alcance hasta que haya evidencia de abuso o necesidad real.

## 7. Motor de partidos (`nivel_bramu_v1_0`)

Arquitectura: expectativa tipo Elo + incertidumbre explícita (Glicko/TrueSkill como inspiración) + fuerza de pareja por promedio + influencia acotada del score + variación individual gobernada por la confiabilidad. Los parámetros son iniciales, coherentes en simulación y **no calibrados con datos reales**; cualquier cambio crea una versión nueva del algoritmo.

### 7.1 Estado por jugador

| Variable | Rango | Significado |
|---|---:|---|
| `mu` | 1,0000–10,0000 | Mejor estimación actual |
| `confidence` | 0,00–0,95 | Cuánta evidencia sostiene `mu` |
| `evidence_units` | ≥ 0 | Evidencia acumulada ponderada |
| `state` | enum | PENDIENTE / CALIBRANDO / CALIBRADO / RECALIBRANDO |
| `rated_matches`, `distinct_opponents` | enteros | Contadores de calibración |
| `last_rated_at` | fecha | Última actividad computable |
| `algorithm_version` | texto | Versión que produjo el estado |

Bandas de confiabilidad (describen evidencia, no calidad de juego): baja `< 0,45` · media `0,45–0,74` · alta `≥ 0,75`.

### 7.2 Fuerza de pareja

```text
mu_efectivo_i = 5 + confidence_i × (mu_i − 5)
fuerza_pareja = (mu_efectivo_1 + mu_efectivo_2) / 2
```

Promedio simple; sin penalización por pareja despareja ni suposición de quién "cargó" a quién. No cambia el Nivel público.

### 7.3 Expectativa

```text
P(A) = 1 / (1 + 10 ^ (−(fuerza_A − fuerza_B) / 1,5))
```

Con confiabilidad alta: diferencia 0,5 → 68 % · 1,0 → 82 % · 2,0 → 96 % · 3,0 → 99 %.

### 7.4 Score

El resultado define el signo (una victoria nunca baja el Nivel; una derrota nunca lo sube); el score solo modula la magnitud.

```text
share_sets  = sets_ganados / sets_jugados
share_games = games_ganados / games_totales      (el match tie-break no cuenta como games)
dominio     = 0,45 × share_sets + 0,55 × share_games
multiplicador_margen = 0,90 + 0,25 × clamp((dominio − 0,55) / 0,35; 0; 1)    → 0,90 … 1,15
```

### 7.5 Peso del formato

| Formato válido | Factor |
|---|---:|
| Mejor de tres sets completos | 1,00 |
| Dos sets completos + match tie-break | 0,90 |
| Mini sets a cuatro games | 0,80 |
| Set único / pro set corto | 0,65 |
| Incompleto, abandono o walkover | 0,00 |

Ventaja, punto de oro o Star Point no cambian el peso (BRAMU no conoce los puntos internos).

### 7.6 Repetición (ventana de 180 días previos)

```text
factor_repeticion = max(0,45; 1 − 0,10 × n_pair − 0,025 × (n_r1 + n_r2))
factor_companero  = max(0,60; 1 − 0,05 × n_companero)
```

Misma pareja rival: 1,00 · 0,85 · 0,70 · 0,55 · 0,45 (desde el 5.º). Mismo compañero: 1,00 · 0,95 · … · 0,80 (5.º) · 0,60 (desde el 9.º). Una pareja fija sigue aportando evidencia, nunca llega a cero.

### 7.7 Círculo competitivo cerrado

Para un jugador **ya calibrado**, en los últimos 180 días: ≥ 20 partidos computables; ≥ 80 % concentrado en un grupo de hasta 12 personas (≤ 11 coparticipantes habituales); amplitud de niveles del grupo ≤ 1,5; y el partido actual se juega íntegro dentro del círculo sin que la pareja rival supere a la propia en 0,75 o más. Entonces `factor_circulo = 0,45`; en los demás casos `1,00`. No impone techo ni bloquea bajas: reduce cuánto puede afirmarse desde una red poco conectada. Un jugador externo o una pareja claramente superior devuelven peso completo.

### 7.8 Variación individual

```text
K_i = 0,10 + 0,30 × (1 − confidence_i)
factor_oponente = 0,55 + 0,45 × confianza_pareja_rival
delta_i = K_i × (resultado − expectativa) × margen × formato × repeticion
              × factor_companero × factor_circulo × disponibilidad × factor_oponente
```

`resultado` = 1 si ganó, 0 si perdió; `confidence_i` es la efectiva inmediatamente anterior al partido (incluida la reducción por inactividad); `confianza_pareja_rival` es el promedio de sus integrantes (con invitado, solo los que tienen Nivel). **Topes:** CALIBRANDO/RECALIBRANDO ±0,50 · CALIBRADO ±0,35 · Nivel final en 1,0–10,0. Delta guardado a 4 decimales; la UI lo muestra a 1 decimal y omite `±0,0`. Compañeros con igual confiabilidad reciben el mismo cambio; con distinta, pueden cambiar distinto. No se asignan variaciones por "quién jugó mejor".

### 7.9 Momento y correcciones

- El Nivel cambia **inmediatamente** cuando el partido se vuelve oficial/computable, para vincular la explicación a ese partido.
- **Corrección posterior** de un resultado ya computado: se registra un evento que revierte exactamente la variación anterior, se recalcula el partido corregido con los **mismos snapshots previos** y se aplica solo la diferencia neta, conservando ambas versiones y la causa. No se recalcula en cascada todo el perfil; no se reescribe un Ranking ya publicado.

## 8. Confiabilidad, evidencia e inactividad

### 8.1 Evidencia por partido

```text
calidad_evidencia = formato × repeticion × factor_companero × factor_circulo
                    × disponibilidad × (0,55 + 0,45 × confianza_pareja_rival)
evidence_units_nuevo = evidence_units_anterior + calidad_evidencia
```

### 8.2 Conversión a confiabilidad

Con `b` = confianza de origen (0,15 o 0,10 según §5.5):

```text
confidence = b + (0,95 − b) × (1 − exp(−evidence_units / 5,5))
confidence_post = confidence_pre + (0,95 − confidence_pre) × (1 − exp(−calidad_evidencia / 5,5))   (forma incremental)
```

Techo común 0,95. Referencia con `b = 0,15` y rivales confiables y diversos: 0 partidos 15 % · 1 → 28 % · 3 → 49 % · 5 → 63 % · 10 → 82 % · 15 → 90 %.

### 8.3 Inactividad

Primeros 60 días sin partidos computables: sin cambio. Después:

```text
confidence_efectiva = max(0,15; confidence × 2 ^ (−(dias_inactivo − 60) / 240))
```

El Nivel **no baja** por inactividad; al volver, la menor confianza aumenta moderadamente la sensibilidad. La confianza efectiva es la base del siguiente partido (no se recupera de golpe); `evidence_units` conserva el total histórico para auditoría. El reloj de inactividad arranca en el onboarding.

## 9. Elegibilidad, invitados y disponibilidad de evidencia

Un partido puede existir en el historial sin tocar el Nivel. **Computa** solo si cumple todo:

- dobles: dos parejas, cuatro participantes; el jugador evaluado participó;
- resultado final válido por sets (incluido tie-break); fecha real de juego;
- al menos **un jugador con Nivel por pareja**;
- oficial/validado según el ciclo de `Experiencia_Inicial.md` (validación por parejas, pendientes, correcciones); no disputado, anulado, pendiente ni duplicado;
- **validado dentro de los 30 días posteriores a `played_at`** (`validated_at − played_at ≤ 30 días`; si falta cualquiera de las dos fechas se considera fuera de ventana). Fuera de ventana: historial y estadísticas oficiales sí, Nivel no;
- cargado por un participante registrado del encuentro. BRAMUlab carga únicamente partidos propios ya jugados; no hay partidos de espectador como fuente de Nivel.

| Caso | Historial | Nivel |
|---|---|---|
| Completo y oficial | Sí | Sí |
| Pendiente de rival / disputado / observado | Sí | No (todavía / no) |
| Walkover, abandono o resultado incompleto | Sí | No en V1 |
| Score inválido | Sí, con advertencia | No |
| Fuera de ventana de 30 días | Sí | No |
| Duplicado | Una sola identidad de partido | Una sola vez |
| Formato corto o match tie-break válido | Sí | Sí, con menor peso |

### 9.1 Invitados e imputación neutral

Se puede cargar un compañero o rival sin cuenta (participación provisional, reclamable por acción explícita; **nunca** se vincula por coincidencia de nombre; plazos de reclamo en `Experiencia_Inicial.md`/`Backend_Infraestructura.md`). Cuando faltan niveles:

| Niveles conocidos | Imputación | `disponibilidad` |
|---|---|---:|
| 4 de 4 | ninguna | 1,00 |
| 3 de 4 | el invitado toma, solo para ese partido, el promedio de los 3 efectivos conocidos | 0,80 |
| 2 de 4, uno por pareja | ambos invitados toman el promedio de los 2 efectivos | 0,60 |
| 2 en la misma pareja; 1 o 0 en la rival | el partido **no computa** | — |

El nivel imputado no crea perfil, no se guarda ni recibe variaciones; mientras la identidad siga siendo provisional no existe un Nivel propio que actualizar. Nunca se pide ni guarda una estimación de terceros sobre un invitado. La reducción por dato ausente vive en `disponibilidad` y no se aplica dos veces en `confianza_pareja_rival`.

### 9.2 Recuperación posterior de evidencia al vincular identidad

> **Decisión vigente de producto; implementación pre-Production pendiente en Staging.** La regla anterior “un invitado nunca recibe efecto” describe únicamente el momento en que todavía es provisional. No impide recuperar evidencia después de que la persona confirme explícitamente que esa identidad era suya.

Al vincular una provisional con una cuenta registrada:

- no se hereda un “Nivel del invitado” ni un valor estimado por terceros;
- se recuperan únicamente partidos realmente asociados a esa identidad y que cumplan las reglas de elegibilidad de esta sección;
- para una cuenta nueva, primero se confirma su Nivel inicial V1.3 y después se procesa la evidencia recuperable;
- para una cuenta existente, el replay parte de su Nivel actual al comenzar la recuperación;
- los partidos se procesan por `played_at` ascendente;
- compañero y rivales se reconstruyen con los **snapshots históricos reales** disponibles en el partido original; nunca con sus niveles actuales;
- se reutiliza `nivel_bramu_v1_0`; no existe una fórmula especial de “Nivel recuperado”;
- el efecto nuevo se aplica **solo al jugador recuperado**. No se recalculan ni reescriben los deltas históricos de compañeros o rivales;
- cada aplicación/omisión deja trazabilidad append-only y una clave idempotente por recuperación + partido;
- si faltan snapshots/evidencia suficiente, el partido puede quedar en Historial/estadísticas pero no se fabrica un efecto de Nivel.

La recuperación sí puede modificar el estado actual del jugador: `mu`, confianza, `evidence_units`, `rated_matches`, `distinct_opponents` y progreso de CALIBRANDO. La condición de cierre sigue siendo **5 partidos computables + 3 rivales distintos**.

Un jugador ya CALIBRADO puede sumar evidencia recuperada y ajustar su Nivel vigente, pero la recuperación no “descalibra” retroactivamente su historia.

Si una vinculación revela dos registros del mismo encuentro y el usuario confirma que efectivamente son duplicados, **solo uno puede conservar efecto deportivo**. La reversión del efecto duplicado debe ser idempotente y preservar los efectos de otros partidos posteriores. Las ediciones de Ranking ya publicadas nunca se reescriben; la siguiente usa el Nivel actual corregido.

## 10. Persistencia, autoridad backend y versionado

**Autoridad:** el servidor es la autoridad de toda operación oficial. El navegador nunca es autoridad: la oficialización la ejecuta la Edge Function `officialize-onboarding` (JWT activo) sobre el **mismo archivo JS** de la fórmula (symlink, nunca reimplementado en SQL), vía la RPC privada `officialize_level_onboarding` (atómica e idempotente, solo desde PENDIENTE, un único `initial_estimate` por jugador).

- **Payload V1.3:** `{ mode: 'full', questionnaireVersion: 'nivel_inicial_v1_3', quizAnswers: { panorama, ritmo, ataque, defensa, decisiones } }`, enteros 0…9. El servidor rechaza `quick`, otra versión y valores inválidos, recalcula y persiste `questionnaire_mode = 'full'` + versión V1.3. La restricción de DB `quick|full` no obligó a migrar.
- **Estado actual del jugador:** `level_states` (valor interno y público, estado, confiabilidad, `evidence_units`, contadores, última actividad, cooldown de recalibración, consolidado y provisional separados, `algorithm_version`, `questionnaire_version/mode`).
- **Cuestionarios:** versión, respuestas crudas, cálculo bruto, resultado confirmado, tipo (inicial o recalibración), fecha y hora, confianza de origen y bandera de dispersión.
- **Historial:** `level_events` inmutables (nivel y confiabilidad anterior/nuevo, causa principal, partido o recalibración de origen, fecha, versión, procedencia automática o iniciada por el jugador; reversiones y correcciones; inicio/cierre/expiración de recalibración).
- **Snapshot por partido (obligatorio):** nivel y confiabilidad de los cuatro jugadores al momento del partido, expectativa previa, factores aplicados, niveles conocidos/imputados, `disponibilidad`, delta individual sin redondear y códigos de explicación. Evita reinterpretar partidos antiguos con niveles actuales.
- **Contrato que debe preservarse:** cálculo puro, determinista y versionado; la UI no duplica reglas matemáticas; correcciones y anulaciones idempotentes con reversión/reproceso determinista; la precisión interna se guarda separada del valor público; Ranking consume Nivel consolidado; BRAMU Intelligence consume snapshots y códigos guardados y nunca recalcula la expectativa histórica con niveles actuales.
- **Versionado de la app:** ver regla de versión pública vs. bundle en `README.md` §6.

## 11. UX visible vigente por superficie

Jerarquía canónica con Nivel server-backed: `NIVEL BRAMU` (chico, neutro) → valor → estado opcional. CALIBRANDO: valor y etiqueta en ámbar; en Home y Mi Perfil, que ya tienen el bloque `CALIBRANDO · X/5 PARTIDOS`, solo se tiñe el número (sin etiqueta duplicada). Consolidado (incluido RECALIBRANDO con Nivel consolidado): valor blanco, sin etiqueta.

- **Home / Player Card:** Nivel, estado y progreso; sin explicación extensa. Home **Estado Cero** (0 partidos): tarjeta de primer partido con pill `TU PRIMER PARTIDO`, titular y CTA `CARGAR MI PRIMER PARTIDO`; con un partido real (incluso pendiente) se muestra ese partido y nunca la CTA de primer partido.
- **Mi Perfil:** identidad, Nivel y estado siempre; con 0 partidos oficiales, Nivel estimado + `CALIBRANDO · 0/5` sin Evolución, Efectividad, compañeros/rivales ni gráficos vacíos. Los módulos se incorporan cuando existe evidencia oficial legítima. Los partidos pendientes aparecen en Historial pero no alimentan estadísticas oficiales. Acceso secundario a recalibración (cuando exista la UI).
- **Perfil público:** Nivel y estado (`CALIBRANDO` o check); no expone respuestas del cuestionario; nunca inventa posición de Ranking (usar el estado de `Ranking_BRAMU.md`); `PENDIENTE` antes de confirmar. Criterio común: **el perfil también se construye con evidencia real.**
- **Ranking:** usa el Nivel consolidado como dato de orden e identifica a quienes siguen calibrando; las reglas de participación y posición viven en `Ranking_BRAMU.md`.

## 12. Explicación de variaciones y BRAMU Intelligence

Cada actualización conserva códigos de razón y traduce solo los más relevantes, en este orden: sorpresa por dificultad · calibración/baja confiabilidad · margen especialmente amplio o cerrado · formato reducido · repetición · inactividad previa. Lenguaje deportivo, neutral y factual:

> **Triunfo de alto valor** — Superaron a una pareja con mayor Nivel BRAMU. Como todavía estás calibrando, este resultado aporta más información.
> **Resultado esperado** — La victoria confirma tu nivel actual. El cambio fue pequeño porque la diferencia previa era favorable.
> **Evidencia limitada** — Este encuentro aporta menos porque ya enfrentaste varias veces a la misma pareja.
> **Regreso con mayor sensibilidad** — Tu nivel se mantiene, pero tras un período sin actividad los próximos partidos pueden ajustarlo más rápido.

Evitar fórmulas, porcentajes de expectativa, "BRAMU pensaba que perdías", "jugaste mejor de lo esperado", "te sobrepusiste mentalmente", "tu volea fue determinante". Intelligence puede contextualizar con Nivel solo cuando existan snapshots válidos, nunca usa respuestas del cuestionario como evidencia de un partido, no narra punto a punto cuando solo hay resultado por sets y atenúa afirmaciones si los niveles son poco confiables. Detalle en `BRAMU_Intelligence.md`.

## 13. Cuentas existentes y migraciones

- **No se recalcularon ni resetearon** niveles existentes V1.1/V1.2. CALIBRANDO/CALIBRADO existentes conservan exactamente su estado y Nivel; no se reescriben niveles históricos ni rankings publicados. Se preserva `questionnaire_version` de cada registro.
- Verificado en Staging: snapshot read-only de `level_states` antes/después del deploy V1.3 — 22 filas y misma huella (`664bc4c5f85522210192223484ea5f73`).
- V1.3 solo oficializa a un jugador que siga en PENDIENTE y complete un cuestionario nuevo. Las cuentas existentes usarán V1.3 únicamente si hacen una recalibración voluntaria futura.
- Un cuestionario V1.2 incompleto (estado local no oficial) se reinicia bajo V1.3 sin tocar el resto del alta (§4.5).
- No hubo migración de datos ni de esquema para V1.3.

## 14. Evidencia de cierre (Staging)

- **Backend:** `officialize-onboarding` ACTIVE v13, JWT ON; alta real V1.3 server-backed verificada (`@sebastian_vila`: CALIBRANDO, `mu` 5,32 → UI 5,3, confianza 0,15, 0 partidos, `nivel_inicial_v1_3`, `full`, `nivel_bramu_v1_0`, `initial_estimate` persistido).
- **Tests:** batería V1.3 (`v0428-nivel-inicial-v13.test.mjs`) cubre fórmula exacta y banco de textos, interpolación de las 10 posiciones, monotonicidad por pregunta, umbrales 4,1/6,4 con vectores reales, mínimos/máximos, clamp sobre las 10⁵ combinaciones sin NaN, spread 1,9999/2,0, irrelevancia de años/frecuencia/entrenamiento/género/categoría, ausencia de camino rápido, adaptatividad/volver atrás/invalidación, reload, paridad cliente–servidor, versionado, regresión del motor con fixture pineado, borradores V1.2, recalibración, aislamiento por `scopeKey` y reconstrucción desde `signupDraft`. Resultado del último ciclo funcional: Node 785/788 (3 fallos **preexistentes**, ajenos a Nivel: h19-B, h21-9, h23).
- **Contrafactuales obligatorios** (deben seguir vigentes ante cualquier cambio): mover P1 un paso con las otras fijas (cambio acotado); recorrer cada pregunta por los 10 puntos (monotonicidad); umbrales exactos 4,1 y 6,4; cambio de rama invalida respuestas posteriores; todos mínimos/máximos; spread 1,9999 vs 2,0; irrelevancia de datos no incluidos; inexistencia del camino rápido.
- **QA humano en iPhone (aprobado):** adaptatividad PASS; slider vertical y pulido h3 PASS; resultado CALIBRANDO (número ámbar) PASS; volver desde OTP PASS; Home Estado Cero PASS; intro final h7 PASS.
- **Límites de la evidencia:** los vectores de los perfiles de §5.6 en los tests son arquetipos coherentes, no las respuestas originales; el touch real se validó en iPhone por QA humano.

## 15. Límites conocidos y decisiones futuras (NO vigentes)

Nada de esta sección es regla activa.

1. **Círculos cerrados mal anclados:** los resultados internos identifican diferencias relativas, no el desplazamiento absoluto de un grupo; limitación estructural conocida. El motor corrige errores unilaterales con evidencia diversa, pero no necesariamente antes del cierre de calibración y más lento con repetición o resultados mixtos.
2. **Parámetros sin validar con datos reales** (pendientes de validación retrospectiva con partidos propios, y cualquier cambio solo como versión nueva): equivalencia diferencia 1,0 ≈ 72–82 %; velocidad de `K`; margen 0,90–1,15; curva de confiabilidad; necesidad de corrección por desequilibrio en la pareja. Método: entrenar con parte de los partidos, predecir una muestra no usada, medir acierto y calibración por nivel y cantidad de partidos.
3. **Distribución madura:** compararla con la pirámide competitiva argentina (concentrada en categorías bajas y medias) como control de realidad, no como cuota. Una concentración inesperada en 8–10 es señal para revisar cuestionario/calibración/inflación, no para bajar niveles automáticamente.
4. **Recalibración:** falta UI (incluida la representación de `RECALIBRANDO`); no definir nuevas reglas de elegibilidad sin evidencia de abuso o necesidad.
5. **Producción:** Production se abrió el 07/10/2026 con V04.37, que incluye Nivel V1.3 (`nivel_inicial_v1_3` + `nivel_bramu_v1_0`). Todo cambio de fórmula requiere una versión nueva, validada primero en Staging y promovida con autorización explícita.
6. **Matchmaking:** fuera de alcance hasta tener densidad real de jugadores por ubicación, horario y nivel.

## 16. Trazabilidad histórica mínima

- V1.1 (cuestionario con autoevaluación 65 %, red/paredes, entrenamiento, años/frecuencia, categoría local con ajuste ±0,5, camino rápido) y V1.2 (V1.1 sin categoría local, 6 preguntas) quedaron **retiradas como estimador vigente**; sus cuentas conservan su Nivel y su `questionnaire_version`.
- Decisión 19/09/2026: la categoría local sale del onboarding y del cálculo. Decisión 02/10/2026 (Issue #25): estimador V1.3. Cierre QA humano: 03/10/2026.
- Detalle histórico completo en Git (documentos retirados en el cierre documental de V1.3), en `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md` y en el Issue #25 de `sebastianvilaa/BRAMUlab`.

---

## Anexo A — Banco de preguntas V1.3 (texto exacto)

Orden de las descripciones: de menor a mayor dominio (A→D). Las letras son notación interna del documento y **no se muestran** al usuario. Los tests verifican cada texto de este anexo literalmente contra `level-calibration.js`; editar un texto exige actualizar ambos y cuenta como cambio de producto.


### P1 — Panorama general (común)

**Pregunta:** ¿Qué describe mejor tu juego durante un partido habitual?

- **A:** Estoy aprendiendo a ubicarme y a sostener varios golpes seguidos.
- **B:** Sostengo intercambios cómodos; cuando aumenta el ritmo pierdo control u orden.
- **C:** Construyo el punto y utilizo distintos recursos; bajo presión todavía me apuro o dejo una pelota fácil.
- **D:** Sostengo un ritmo alto, buenas posiciones y decisiones; normalmente el rival debe construir el punto para superarme.

### P2 — Control y ritmo

#### Rama baja

- **A:** Me cuesta devolver tres pelotas seguidas aunque lleguen cómodas.
- **B:** Sostengo intercambios cortos a ritmo lento; al moverme o dirigir la pelota pierdo control.
- **C:** Sostengo pelotas cómodas con dirección; la velocidad o profundidad me obliga a devolver fácil.
- **D:** Resuelvo varias pelotas exigentes y recupero mi posición, todavía de manera irregular.

#### Rama media

- **A:** Controlo la pelota a ritmo cómodo; cuando aceleran llego tarde o dejo una pelota fácil.
- **B:** Sostengo un ritmo medio y recupero la posición; si la presión continúa, pierdo dirección o profundidad.
- **C:** Mantengo dirección y profundidad a ritmo alto en la mayoría de las jugadas; una pelota difícil todavía puede dejarme defendiendo.
- **D:** A ritmo alto llego equilibrado, neutralizo la presión y puedo elegir la respuesta.

#### Rama alta

- **A:** Sostengo el ritmo alto, pero la presión repetida termina reduciendo mi profundidad o control.
- **B:** Mantengo profundidad y posición a ritmo alto; una defensa extrema todavía puede dejar una oportunidad cómoda.
- **C:** Absorbo cambios de velocidad, recupero la posición y obligo al rival a sostener la presión.
- **D:** Frente al ritmo máximo anticipo, neutralizo y puedo transformar la defensa en iniciativa.

### P3 — Ataque y red

#### Rama baja

- **A:** Me cuesta ubicarme y controlar la volea, incluso con pelotas cómodas.
- **B:** Devuelvo voleas simples, pero pierdo la posición o quedo superado por el globo.
- **C:** Sostengo la red en intercambios lentos con mi compañero; la presión me obliga a retroceder o dejar una pelota fácil.
- **D:** Utilizo la volea o la bandeja para conservar la red, todavía de manera irregular.

#### Rama media

- **A:** Controlo voleas cómodas; con velocidad o presión pierdo la posición.
- **B:** Sostengo la red y uso la volea o la bandeja; a veces acelero desde una posición desfavorable.
- **C:** Me coordino con mi compañero, conservo la red y elijo una pelota favorable para acelerar.
- **D:** Varío dirección y ritmo, recupero la red después del globo y mantengo la iniciativa bajo presión.

#### Rama alta

- **A:** Controlo la posición; la presión sostenida todavía puede hacerme dejar una pelota cómoda o perder la red.
- **B:** Uso la volea y la bandeja para sostener la posición y recupero la red después del globo; a veces me precipito al definir.
- **C:** Varío direcciones y ritmos, elijo cuándo acelerar y mantengo la iniciativa bajo presión.
- **D:** A velocidad máxima anticipo las respuestas y transformo situaciones difíciles en ataques controlados.

### P4 — Defensa y paredes

#### Rama baja

- **A:** Intento jugar antes de la pared porque todavía no interpreto bien el rebote.
- **B:** Resuelvo rebotes simples y lentos de fondo; suelo llegar tarde o calcular mal.
- **C:** Utilizo la pared de fondo en situaciones habituales; la velocidad o los rebotes laterales me complican.
- **D:** Utilizo paredes de fondo y laterales para continuar el punto; todavía pierdo control en rebotes complejos.

#### Rama media

- **A:** Resuelvo el rebote simple; una pelota rápida, profunda o lateral suele dejarme fuera de posición.
- **B:** Utilizo las paredes de fondo y laterales en situaciones habituales; los rebotes complejos me obligan a devolver fácil.
- **C:** Anticipo paredes simples y dobles, recupero la posición y normalmente mantengo una defensa neutral.
- **D:** Uso las paredes para quitar velocidad, soportar la presión y convertir una defensa difícil en una pelota controlada.

#### Rama alta

- **A:** Controlo los rebotes habituales; una pelota muy profunda o compleja todavía puede dejarme defendiendo corto.
- **B:** Anticipo paredes dobles y sostengo la defensa con velocidad; las situaciones extremas pueden hacerme perder control.
- **C:** Uso las paredes para neutralizar la presión, recuperar la posición y convertir una defensa difícil en una pelota controlada.
- **D:** A velocidad máxima resuelvo rebotes complejos y transformo defensas extremas en contraataques sin perder la posición.

### P5 — Decisiones y consistencia

#### Rama baja

- **A:** Me concentro en devolver la pelota, sin una idea clara de dónde jugar o cómo ubicarme.
- **B:** Conozco ideas como subir a la red o tirar un globo; reacciono tarde o intento atacar una pelota desfavorable.
- **C:** Intento construir el punto y moverme con mi compañero; cuando se prolonga pierdo el orden.
- **D:** Reconozco cuándo defender, reconstruir o atacar; todavía me cuesta ejecutarlo durante todo el partido.

#### Rama media

- **A:** Entiendo la jugada, pero intento resolverla rápido y suelo entregar la iniciativa.
- **B:** Alterno momentos ordenados con otros en los que ataco desde una posición desfavorable.
- **C:** Construyo con paciencia y espero una pelota favorable; si la presión continúa, puedo perder el orden.
- **D:** Mantengo el plan, recupero posiciones y adapto mis decisiones durante todo el partido.

#### Rama alta

- **A:** Construyo bien; la presión sostenida termina haciéndome perder profundidad, dirección o iniciativa.
- **B:** Conservo el orden, elijo una respuesta segura y espero una pelota favorable; ocasionalmente dejo una oportunidad cómoda.
- **C:** Administro ritmos y direcciones, anticipo la jugada y normalmente obligo al rival a construir para superarme.
- **D:** Mantengo lectura y calidad frente a presión extrema durante todo el partido, neutralizando o aprovechando situaciones difíciles.


---

## Anexo B — Simulaciones de referencia del motor `nivel_bramu_v1_0`

Referencia de comportamiento (valores internos antes del redondeo público; "A" es la pareja ganadora, confiabilidad estable salvo indicación). Sirven para detectar regresiones del motor.

| Caso | Score de A | P(A) previa | Cambio A | Cambio B |
|---|---|---:|---:|---:|
| Parejas 5,0 estables, partido cerrado | 6-4, 4-6, 7-6 | 50 % | +0,07 | −0,07 |
| Parejas 5,0 estables, dos sets | 6-4, 6-4 | 50 % | +0,08 | −0,08 |
| 5,0 vence a 6,0 | 6-4, 6-4 | 23 % | +0,12 | −0,12 |
| 6,0 vence a 5,0 | 6-4, 6-4 | 77 % | +0,04 | −0,04 |
| 4,5 vence a 6,5 | 6-4, 6-4 | 8 % | +0,14 | −0,14 |
| 6,5 vence a 4,5 | 6-4, 6-4 | 92 % | +0,01 | −0,01 |
| Pareja 7,0+3,0 vence a 5,0+5,0 | 6-4, 6-4 | 50 % | +0,08 ambos | −0,08 ambos |
| Nuevos 5,0 vencen a 5,0 estables | 6-4, 6-4 | 50 % | +0,17 | −0,05 |
| Segunda / cuarta victoria ante la misma pareja | 6-4, 6-4 | 50 % | +0,07 / +0,04 | — |
| Mini sets entre pares 5,0 | 4-2, 4-2 | 50 % | +0,06 | −0,06 |
| Super tie-break entre pares 5,0 | 6-4, 4-6, 10-8 | 50 % | +0,06 | −0,06 |
| Compañeros 5,0 con confianza 20 % y 90 % | 6-4, 6-4 | 50 % | +0,17 / +0,06 | — |

Trayectorias: subestimado 4,5 que vence cinco veces a rivales 5,5 confiables → `4,50 → 4,73 → 4,94 → 5,12 → 5,28 → 5,42`; sobreestimado 6,0 que pierde cinco veces ante 5,0 → `6,00 → 5,81 → 5,63 → 5,46 → 5,32 → 5,19`; resultados alternados contra equivalentes → converge alrededor del punto de partida; farming (6,0 vence diez veces a la misma pareja 4,0) → `6,00 → … → 6,05`. Grupo cerrado de 10–12 jugadores con rotación, 200 partidos/año: efectividad 60 % → +0,42/+0,45 · 65 % → +0,55/+0,59 · 70 % → +0,70/+0,74; el líder se separa pero no cambia una categoría completa solo con resultados internos.

Simulaciones del Issue #25 con el motor vigente desde un 5,405 sobreestimado: cinco derrotas claras con evidencia diversa → `5,405 → 5,215 → 5,045 → 4,894 → 4,759 → 4,639`; mismos compañeros y rivales repetidos → 4,864 a 5 derrotas; dos jugadoras sobreestimadas en lados opuestos con diez partidos alternados quedan en ≈ 5,42 / 5,39 con confianza 0,78; un círculo de ocho jugadores con 20 partidos internos no se mueve (5,300 → 5,302). Es la base de la limitación §15.1.

## Fuentes de diseño

Glicko (Glickman); TrueSkill (Herbrich, Minka, Graepel, 2007); UTR (algoritmo y dobles); DUPR (How It Works); Playtomic (sistema de nivel, 2026); reglas FIP 2026; padrón público de Pádel Argentino y Circuito Regional de Pádel de Villa María (control de realidad de la pirámide de categorías, septiembre 2026). Se adoptó la arquitectura (expectativa + incertidumbre + equipos + score acotado) y no ninguna fórmula ajena literal.


---

## 16. V04.37 — Evolución real del Nivel en Mi Perfil

Decisión cerrada tras QA humano del 06/10/2026.

La tarjeta **EVOLUCIÓN DEL NIVEL BRAMU** vuelve a **Mi Perfil** para cuentas server-backed con evidencia real.

### Regla de verdad

NO reactivar `PH.computeLevelEvolution` ni ninguna serie simulada/legacy para una cuenta V1 real.

La evolución visible debe provenir exclusivamente del backend oficial de Nivel. La implementación debe usar una lectura autenticada y acotada que exponga solo lo necesario para UI pública/personal, nunca parámetros internos del motor.

La fuente canónica debe respetar el estado vigente de resultados:
- incluir únicamente efectos oficiales actualmente aplicados;
- reflejar correcciones y anulaciones sin dejar dobles puntos o “blips” de resultados ya revertidos;
- preservar el orden deportivo real del historial;
- partir del valor inicial oficial cuando corresponda;
- mostrar valores públicos redondeados con la misma precisión vigente de Nivel;
- no exponer `k`, factores, confianza cruda, expectativa interna ni fórmulas del motor.

Si el backend actual no tiene una RPC apropiada, crear una RPC self-only como `get_my_level_evolution()` o equivalente, con autenticación y contrato mínimo.

### UX

Reutilizar, en lo posible, la tarjeta/gráfico histórico que ya existía para Evolución, adaptándolo a la nueva fuente real.

Debe permitir entender:
- Nivel actual;
- recorrido real del Nivel a través de los partidos computables;
- cambio material reciente cuando exista;
- mejor Nivel real, si la evidencia canónica permite calcularlo sin reinterpretar el pasado.

No mostrar el módulo si todavía no existe evidencia real suficiente para una evolución útil.

### BRAMU Intelligence dentro de Evolución

Debajo del gráfico puede aparecer una lectura breve y determinística, con datos de la misma serie.

Prioridad V1:
1. si en los últimos 30 días el valor público cambió materialmente:  
   `En los últimos 30 días tu Nivel pasó de X a Y (↑/↓ Z).`
2. si hubo al menos 3 eventos computables en el período y **todos** conservaron el mismo valor público:  
   `Tu Nivel se mantuvo en X durante tus últimos N partidos computables.`
3. en cualquier otro caso: abstención; no forzar texto.

No atribuir causas, técnica, confianza, mentalidad ni “mejora de juego”. La lectura describe únicamente la evolución registrada.

Mi Perfil con 0 partidos oficiales conserva la regla existente: identidad + Nivel/estado, sin Evolución vacía.
