# Nivel BRAMU — Fórmula V1.5

**Estado:** fuente normativa vigente para Nivel BRAMU.  
**Versión del motor de partidos:** `nivel_bramu_v1_0` (sin cambios respecto de V1.4).  
**Versión del estimador inicial:** `nivel_inicial_v1_2`.  

> **Decisión vigente — 19/09/2026 (V1.2 del estimador):** la categoría local deja de formar parte del onboarding y del cálculo del Nivel inicial. El resultado inicial es universal y sale solo de la autoevaluación/cuestiónario; los partidos reales lo calibran. El cuestionario completo pasa de 7 a 6 preguntas: se retira también la pregunta de resultados “en tu categoría habitual”, porque sin un sistema local identificado no aporta una señal universal confiable. País, rama y categoría quedan como contexto competitivo posterior (Perfil/Ranking), no como requisito para obtener Nivel ni entrar a Home. Las secciones históricas de este documento que describen mapas/anclas/ajustes por categoría se conservan como referencia de la hipótesis V1.1 y como posible insumo futuro, pero **no son activas en `nivel_inicial_v1_2`**.

**Precedencia:** esta revisión reemplaza a V1.4 como fuente vigente. V1.4 se conserva como antecedente.

V1.5 modifica únicamente la estimación inicial y el uso del cuestionario durante una recalibración. No cambia expectativa, fuerza de pareja, deltas, confiabilidad por partidos, invitados, repetición, círculo competitivo ni ninguna otra regla del motor ya implementado.

## Resumen ejecutivo

La recomendación es construir Nivel BRAMU V1 como un sistema híbrido, específico para pádel amateur de dobles:

- una expectativa de resultado tipo Elo;
- una medida explícita de incertidumbre inspirada en Glicko y TrueSkill;
- una fuerza de pareja basada en el promedio de las capacidades individuales, atenuadas cuando su confiabilidad es baja;
- una influencia acotada del resultado por sets y games;
- variaciones individuales determinadas por la confiabilidad de cada jugador, sin inventar cuál integrante “jugó mejor”;
- reducción del peso de formatos cortos, rivales poco confiables y enfrentamientos repetidos;
- nivel estable durante la inactividad, pero con menor confiabilidad y mayor sensibilidad al regreso.

Esta arquitectura resuelve la fórmula candidata para el lanzamiento inicial. Sus parámetros iniciales producen comportamientos coherentes en simulaciones, pero no deben considerarse calibrados científicamente hasta contar con resultados reales de BRAMU. El motor de partidos continúa publicado internamente como **Nivel BRAMU V1.0**. El origen del nivel debe conservar además `questionnaire_version = nivel_inicial_v1_1` para distinguir la nueva estimación de la implementada originalmente desde V1.4.

## 1. Qué enseñan los modelos existentes

### Elo

Elo aporta la idea central más útil: convertir la diferencia de nivel previa en una probabilidad esperada y actualizar según la diferencia entre resultado real y esperado. Su principal limitación para BRAMU es que un único número no expresa cuánto se conoce al jugador.

### Glicko y Glicko-2

Glicko agrega una desviación de rating que representa incertidumbre. Un jugador nuevo o inactivo tiene una estimación menos confiable y, por lo tanto, puede moverse más; un jugador activo y bien medido cambia menos. La incertidumbre aumenta con la inactividad sin que la habilidad estimada tenga que disminuir.^1 Glicko-2 añade volatilidad para representar cambios de rendimiento, aunque su implementación completa está pensada para períodos con varios resultados y agrega complejidad innecesaria para el lanzamiento inicial de BRAMU.^2

### TrueSkill

TrueSkill modela la habilidad como una distribución y fue diseñado para equipos: la performance del equipo se construye a partir de las performances individuales y el resultado permite actualizar a sus integrantes. También demuestra por qué nivel e incertidumbre deben almacenarse por separado.^3 Su inferencia bayesiana completa es más compleja de explicar y mantener que lo necesario para una V1 amateur.

### UTR

UTR utiliza un Elo modificado, da importancia al porcentaje de games ganado, al nivel del oponente, al formato, la confiabilidad y la antigüedad del partido. Trabaja con hasta 30 resultados recientes dentro de doce meses y considera que aproximadamente cinco partidos alcanzan para pasar de una proyección a una calificación confiable.^4

En dobles, UTR compara el promedio de cada pareja y aplica el mismo cambio a ambos compañeros. También reduce el peso de formatos más cortos y excluye ciertos resultados extremos esperables.^5 BRAMU adopta el promedio como base de equipo, pero mejora la personalización permitiendo cambios diferentes cuando los compañeros tienen distinta confiabilidad.

### DUPR

DUPR, diseñado para pickleball, calcula la fuerza de una pareja promediando los ratings individuales y compara el score real con el esperado. La magnitud individual depende del volumen y la actualidad del historial, y el producto separa rating de confiabilidad.^6 Esto confirma que un deporte de dobles puede inferir niveles individuales sin pretender conocer el aporte técnico de cada jugador.

### Playtomic

Playtomic obtiene una primera estimación mediante un cuestionario y actualiza según resultado, nivel de rivales, compañero y fiabilidad. Con baja fiabilidad permite oscilaciones mayores; solo los partidos competitivos válidos afectan el nivel.^7 Las capturas de referencia muestran además un cuestionario corto, devolución inmediata y corrección inicial de ±0,5.^10

### Decisión

No conviene copiar íntegramente ninguno de estos modelos:

| Modelo | Conservar | No copiar literalmente |
|---|---|---|
| Elo | Expectativa y sorpresa | Ausencia de confiabilidad |
| Glicko | Incertidumbre e inactividad | Escala de ajedrez y períodos rígidos |
| TrueSkill | Equipos e inferencia individual | Complejidad bayesiana completa |
| UTR | Score, formato y evidencia reciente | Promedio móvil que puede cambiar partidos pasados |
| DUPR | Dobles, volumen y confiabilidad | Fórmula propietaria y escalas ajenas |
| Playtomic | Estimación inicial y participación controlada | Dependencia de soporte y efectos de matchmaking |

La fórmula recomendada es una **actualización Elo con confiabilidad explícita y evidencia ponderada**, diseñada para poder explicarse partido por partido.

## 2. Estado matemático de cada jugador

Cada jugador debe conservar:

| Variable | Rango | Significado |
|---|---:|---|
| `mu` | 1,0000–10,0000 | Mejor estimación actual de nivel |
| `confidence` | 0,00–0,95 | Cuánta evidencia sostiene `mu` |
| `evidence_units` | 0 o más | Evidencia acumulada ponderada |
| `state` | Enum | Sin estimación, calibrando, calibrado o recalibrando |
| `rated_matches` | Entero | Partidos computables |
| `distinct_opponents` | Entero | Rivales diferentes computables |
| `last_rated_at` | Fecha | Última actividad que afectó nivel |
| `algorithm_version` | Texto | Versión que produjo el estado |

El valor público habitual muestra un decimal. El backend conserva cuatro. La confiabilidad puede mostrarse como baja, media o alta; no necesita exponerse como porcentaje en todas las pantallas.

Bandas iniciales:

- baja: menos de 0,45;
- media: 0,45 a 0,74;
- alta: 0,75 o más.

Estas bandas describen evidencia, no calidad de juego.

## 3. Nivel inicial mediante cuestionario V1.1

UTR informa que su cuestionario de estimación fue probado con casi 2.000 usuarios y ubicó al 85% dentro de un rango correcto.^8 Esto respalda el cuestionario como prior razonable, no como medición definitiva.

La primera prueba real de V04 reveló un sesgo concreto en la versión anterior: años de experiencia, frecuencia y etiquetas competitivas abstractas podían empujar hacia arriba a amateurs experimentados sin demostrar mayor capacidad. V1.1 conserva el doble camino, pero separa capacidad, contexto y confiabilidad.

### 3.1 Principios

- Autoevaluación, red y paredes estiman capacidad actual.
- Años y frecuencia ayudan a valorar cuán informada y vigente es la respuesta; no suben directamente `mu`.
- El entrenamiento aporta solo un modificador pequeño y positivo.
- La competición se interpreta junto con la categoría real declarada, nunca de forma aislada.
- La categoría es una referencia local blanda, versionada y opcional; jamás una equivalencia universal rígida.
- El ajuste máximo derivado de categoría es ±0,5. No existe un segundo control libre para mover el número.
- Las contradicciones solicitan revisión y reducen confianza; no castigan automáticamente el nivel.

### 3.2 Anclas de capacidad

Autoevaluación general y camino rápido comparten las mismas anclas:

| Elección | Ancla |
|---|---:|
| Iniciación | 2,0 |
| Intermedio | 4,0 |
| Intermedio alto | 5,5 |
| Avanzado | 7,0 |
| Profesional | 8,5 |

Red y paredes utilizan una escala técnica común que el usuario no ve:

| Opción | Ancla técnica |
|---|---:|
| A | 1,0 |
| B | 3,0 |
| C | 5,0 |
| D | 6,5 |
| E | 8,5 |

`ancla_tecnica = (ancla_red + ancla_paredes) / 2`

El entrenamiento no funciona como otra escala completa de nivel:

| Experiencia de entrenamiento | Modificador |
|---|---:|
| Nunca tomé clases | 0,00 |
| Hice clases o clínicas aisladas | +0,02 |
| Tomo clases de vez en cuando, sin continuidad | +0,05 |
| Entrené regularmente durante una etapa, aunque hoy no entreno | +0,08 |
| Entreno con regularidad actualmente | +0,10 |

La base del cuestionario completo es:

`nivel_base = 0,65 × ancla_autoevaluacion + 0,35 × ancla_tecnica + modificador_entrenamiento`

### 3.3 Contexto competitivo y categoría

La pregunta competitiva describe el rendimiento dentro de la categoría habitual:

| Respuesta | Modificador competitivo |
|---|---:|
| No compito | 0,00 |
| Competí pocas veces y no tengo una referencia clara | 0,00 |
| Suelo tener partidos difíciles o quedar eliminado en primeras rondas | −0,15 |
| Tengo partidos parejos y algunas veces avanzo | +0,10 |
| Suelo llegar a cuartos, semifinales o finales | +0,20 |

Después de mostrar el `nivel_base`, BRAMU pregunta de forma neutral:

> **Una última pregunta para afinar tu nivel**  
> ¿En qué categoría suelen ser parejos tus partidos?

No se destaca ni recomienda ninguna respuesta. Deben existir `No compito` y `No estoy seguro`.

Las referencias de categoría viven en una configuración separada por país, región, circuito y división competitiva. Para el lanzamiento inicial en Argentina, rama masculina se adopta esta hipótesis inicial:

| Categoría | Ancla local inicial |
|---:|---:|
| 9.ª | 2,0 |
| 8.ª | 2,8 |
| 7.ª | 3,8 |
| 6.ª | 4,8 |
| 5.ª | 5,5 |
| 4.ª | 6,1 |
| 3.ª | 6,9 |
| 2.ª | 7,7 |
| 1.ª | 8,4 |

Esta tabla no afirma que una categoría valga lo mismo en todos los lugares. Si no existe un mapa validado para el contexto del jugador, la categoría se guarda para análisis pero no modifica el nivel.

Cuando existe mapa compatible:

`referencia_categoria = ancla_categoria + modificador_competitivo`

`ajuste_categoria = clamp(0,70 × (referencia_categoria − nivel_base); −0,5; +0,5)`

`nivel_inicial = clamp(nivel_base + ajuste_categoria; 1,0; 9,0)`

Si se elige `No compito`, `No estoy seguro` o no existe un mapa compatible, `ajuste_categoria = 0`.

El Nivel BRAMU sigue siendo universal. No existe una bonificación o penalización por género. Lo que puede variar es la traducción de una categoría local a la escala universal.

### 3.4 Confiabilidad inicial y coherencia

Camino rápido conserva `confidence = 0,10`.

En el cuestionario completo, años, frecuencia y disponibilidad de una referencia local generan puntos de contexto:

| Señal | Puntos |
|---|---:|
| Menos de un año jugando | 0 |
| Entre uno y cinco años | 1 |
| Más de cinco años | 2 |
| Juego esporádicamente o muy poco | 0 |
| Entre una y tres veces por mes | 1 |
| Una o dos veces por semana | 2 |
| Tres veces por semana o más | 2 |
| Categoría con mapa compatible | 1 |

| Total | Confianza de origen `b` |
|---:|---:|
| 0–1 | 0,12 |
| 2–3 | 0,15 |
| 4–5 | 0,18 |

La frecuencia se satura desde una o dos veces por semana: jugar más no implica jugar mejor ni vuelve ilimitadamente más precisa la estimación.

Se calcula:

`brecha_coherencia = max(|ancla_autoevaluacion − ancla_tecnica|; |nivel_base − referencia_categoria| si existe)`

Con `brecha_coherencia ≥ 2,0`, BRAMU debe advertir que las respuestas describen niveles distintos y ofrecer **Revisar respuestas**. Si el jugador igualmente confirma, el nivel calculado se conserva, pero la confianza de origen queda limitada a `0,10`.

### 3.5 Cuestionario completo

Introducción:

> **Calculemos tu primer Nivel BRAMU**  
> Son 7 preguntas y lleva cerca de 2 minutos. No es un examen: elegí la opción que mejor describe tu juego actual.

**1. ¿Cómo describirías tu juego actual?**

| Opción | Descripción | Ancla |
|---|---|---:|
| Iniciación | Estoy aprendiendo las reglas y los golpes básicos; me cuesta sostener el punto | 2,0 |
| Intermedio | Sostengo intercambios y tengo algunos recursos, pero todavía cometo errores frecuentes y no domino todas las situaciones | 4,0 |
| Intermedio alto | Construyo puntos y uso posiciones, paredes y juego en pareja, aunque al acelerar o recibir presión todavía cometo errores no forzados | 5,5 |
| Avanzado | Manejo ritmos, posiciones y distintos recursos con consistencia; cometo pocos errores no forzados y normalmente obligo al rival a ganar el punto | 7,0 |
| Profesional | Compito en categorías máximas o circuito profesional y mantengo esa consistencia a alta velocidad y presión | 8,5 |

**2. ¿Hace cuánto jugás al pádel?**

- Menos de un año.
- Entre uno y cinco años.
- Más de cinco años.

**3. ¿Qué experiencia tenés con clases o entrenamiento?**

- Nunca tomé clases.
- Hice algunas clases o clínicas aisladas.
- Tomo clases de vez en cuando, sin continuidad.
- Entrené regularmente durante una etapa, aunque actualmente no entreno.
- Entreno con regularidad actualmente.

**4. En tus últimos tres meses activos, ¿con qué frecuencia jugaste?**

- Juego esporádicamente o muy poco.
- Juego entre una y tres veces por mes.
- Juego una o dos veces por semana.
- Juego tres veces por semana o más.

**5. Cuando competís en tu categoría habitual, ¿cómo suelen ser tus resultados?**

- No compito.
- Competí pocas veces y todavía no tengo una referencia clara.
- Suelo tener partidos difíciles o quedar eliminado en las primeras rondas.
- Tengo partidos parejos y algunas veces avanzo de ronda.
- Suelo llegar a cuartos, semifinales o finales.

**6. Cuando estás en la red, ¿qué opción te representa mejor?**

| Opción | Descripción | Ancla técnica |
|---|---|---:|
| A | Me cuesta subir, ubicarme y sostener la posición en la red | 1,0 |
| B | Resuelvo voleas simples, pero pierdo la red fácilmente cuando me presionan o me superan con un globo | 3,0 |
| C | Suelo sostener la red y ubicarme con mi compañero, aunque de vez en cuando me apuro y cometo errores no forzados | 5,0 |
| D | Uso voleas y bandejas para conservar la posición, elijo cuándo acelerar y minimizo los errores no forzados | 6,5 |
| E | Manejo distintos golpes, direcciones y ritmos incluso bajo presión; recupero la red con consistencia y mis errores no forzados son excepcionales | 8,5 |

**7. ¿Cómo te llevás con las paredes?**

| Opción | Descripción | Ancla técnica |
|---|---|---:|
| A | Intento jugar la pelota antes de la pared porque todavía me cuesta interpretar el rebote | 1,0 |
| B | Resuelvo rebotes simples de pared de fondo, pero a veces me ubico tarde o calculo mal la salida | 3,0 |
| C | Uso pared de fondo y lateral con naturalidad en situaciones habituales, pero las pelotas rápidas, profundas o con rebotes complejos todavía me generan errores | 5,0 |
| D | Leo y resuelvo paredes simples y dobles, me ubico antes del rebote y generalmente mantengo el control incluso cuando aumenta la velocidad | 6,5 |
| E | Anticipo rebotes complejos y utilizo las paredes con consistencia bajo presión, pudiendo transformar defensas difíciles en pelotas controladas o de ataque | 8,5 |

### 3.6 Camino rápido

Entrada:

> **¿Preferís estimarlo rápido o afinarlo?**

- **Elegir mi nivel** — 30 segundos. Cinco descripciones y una estimación menos confiable.
- **Ayudame a calcularlo** — recomendado. Siete preguntas, cerca de 2 minutos y una estimación inicial más precisa.

El camino rápido reutiliza las cinco descripciones y anclas de autoevaluación de §3.5. Después muestra el resultado y realiza la misma pregunta final de categoría. Si existe un mapa compatible:

`ajuste_categoria_rapido = clamp(0,70 × (ancla_categoria − semilla_rapida); −0,5; +0,5)`

No utiliza el modificador competitivo porque el camino rápido no formula esa pregunta. Su confianza se mantiene en `0,10` aun cuando exista categoría.

### 3.7 Resultado, categorías y confirmación

| Nivel | Categoría de comunicación |
|---:|---|
| 1,0–2,4 | Iniciación |
| 2,5–3,9 | Recreativo |
| 4,0–4,9 | Intermedio |
| 5,0–6,3 | Intermedio alto |
| 6,4–7,9 | Avanzado |
| 8,0–10,0 | Profesional |

Flujo:

1. BRAMU calcula y muestra la estimación previa.
2. Formula la última pregunta de categoría sin sugerir una respuesta.
3. Aplica, si corresponde, el ajuste automático máximo de ±0,5.
4. Muestra **Tu punto de partida en BRAMU** con un decimal y su categoría de comunicación.
5. Ofrece **Confirmar mi nivel** y **Revisar respuestas**.

Se elimina el stepper de ajuste manual. La persona no debe mover un número cuya escala todavía desconoce. El resultado conserva para auditoría: `base_level`, `category_context_key`, `declared_category`, `competition_answer`, `category_adjustment`, `confirmed_level`, `questionnaire_version`, `confidence_origin` y `coherence_flag`.

En perfil se muestra en ámbar con la leyenda **Nivel estimado · BRAMU te está conociendo**. Al completar cinco partidos computables y tres rivales diferentes pasa al estado calibrado y adopta el tratamiento visual oficial.

### 3.8 Validación con perfiles reales y de estrés

Resultados de la primera prueba real que motivó V1.1:

| Perfil | Camino rápido con categoría | Completo V1.1 | Referencia humana previa |
|---|---:|---:|---:|
| Esteban — 4.ª, instancias finales, red C, paredes D | 5,9 | 6,1 | 6,0–6,3 |
| Seba — 5.ª, instancias finales, red C, paredes D | 5,5 | 5,7 | 5,5–5,9 |
| Lucho — 6.ª, partidos parejos, red C, paredes C | 4,5 | 4,8 | 4,8–4,9 |
| Agustín — no compite, red A, paredes B | 2,0 | 2,1 | 2,0–2,3 |

Perfiles adicionales de estrés:

| Perfil | Resultado V1.1 | Tratamiento esperado |
|---|---:|---|
| Veterano muy activo con técnica limitada | 4,2 | La experiencia no lo infla |
| Jugador técnicamente bueno con poco tiempo | 5,9 | Nivel plausible con confianza menor |
| Autodeclarado avanzado con técnica baja y 6.ª | 5,1 | Solicita revisión; confianza limitada |
| Jugador humilde con técnica alta y 4.ª | 5,5 | Corrección prudente; luego calibran partidos |
| Juega muy bien pero no compite | 7,3 | La ausencia de torneos no lo castiga |
| Llega a instancias finales en una categoría modesta | 4,1 | El resultado se interpreta dentro de su categoría |
| Principiante total | 1,7 | Conserva el extremo bajo |
| Profesional coherente | 8,6 | No obtiene 10,0 solo por autodeclaración |

## 4. Fuerza de pareja

### 4.1 Atenuación por incertidumbre

Una estimación poco confiable no debe producir una expectativa extrema. Para calcular el partido se utiliza un nivel efectivo retraído hacia el centro inicial de la escala:

`mu_efectivo_i = 5 + confidence_i × (mu_i − 5)`

Ejemplos:

- nivel 8,0 con confianza 0,90 → efectivo 7,70;
- nivel 8,0 con confianza 0,15 → efectivo 5,45;
- nivel 5,0 → efectivo 5,0 con cualquier confianza.

Esto no cambia el nivel público. Solo evita que una autoevaluación todavía débil defina con exceso de seguridad la dificultad del partido.

### 4.2 Composición del equipo

`fuerza_pareja = (mu_efectivo_1 + mu_efectivo_2) / 2`

Se recomienda comenzar con promedio simple. TrueSkill modela la performance del equipo como suma de sus integrantes, mientras que UTR y DUPR utilizan el promedio en dobles.^3,5,6 No existe evidencia BRAMU suficiente para imponer de antemano una penalización por pareja despareja.

El sistema no debe asumir que el jugador más fuerte “cargó” al más débil ni que el más débil fue atacado. Con solo resultado final, eso sería inventar el desarrollo.

## 5. Expectativa previa

Para la pareja A:

`P(A) = 1 / (1 + 10 ^ (−(fuerza_A − fuerza_B) / 1,5))`

Con confiabilidad alta, aproximadamente:

| Diferencia entre parejas | Probabilidad del favorito |
|---:|---:|
| 0,0 | 50% |
| 0,5 | 68% |
| 1,0 | 82% |
| 2,0 | 96% |
| 3,0 | 99% |

El divisor 1,5 es un parámetro inicial elegido después de simular temporadas completas. En dobles, la diferencia individual ya se diluye al promediar la pareja; un divisor mayor obligaba a separar demasiado los niveles para explicar una efectividad sostenida y generaba deriva dentro de grupos cerrados. Luego deberá optimizarse con la capacidad predictiva de los partidos reales.

## 6. Influencia del score

El ganador y el perdedor determinan el signo. El score solo modula la magnitud.

Esta es una decisión deliberada:

- una victoria nunca baja el nivel;
- una derrota nunca lo sube;
- un triunfo muy esperable puede producir una suba mínima;
- una derrota muy esperable puede producir una baja mínima.

UTR y DUPR pueden premiar o castigar según performance contra score esperado, incluso independientemente del ganador.^4,6 BRAMU V1 prioriza comprensibilidad y evita la experiencia irritante de ganar y bajar.

### 6.1 Dominio observable

Para la pareja ganadora:

`share_sets = sets_ganados / sets_jugados`

`share_games = games_ganados / games_totales`

`dominio = 0,45 × share_sets + 0,55 × share_games`

`multiplicador_margen = 0,90 + 0,25 × clamp((dominio − 0,55) / 0,35; 0; 1)`

Rango final: 0,90–1,15.

El score puede modificar la magnitud aproximadamente un 15%, pero nunca dominar sobre dificultad y resultado.

Los puntos de un match tie-break no se cuentan como games. El match tie-break modifica el peso del formato.

## 7. Peso del formato

Las reglas FIP reconocen partidos al mejor de tres sets, mini sets a cuatro games y tie-break o super tie-break como reemplazo del último set.^9 BRAMU V1 propone:

| Formato válido | Factor |
|---|---:|
| Mejor de tres sets completos | 1,00 |
| Dos sets completos + match tie-break | 0,90 |
| Mini sets a cuatro games | 0,80 |
| Set único / pro set corto | 0,65 |
| Incompleto, abandono o walkover | 0,00 |

Ventaja, punto de oro o Star Point no cambian el peso si el resultado por games es válido: BRAMU no conoce los puntos internos y no debe fingir una precisión inexistente.

## 8. Repetición y diversidad competitiva

Se consideran los 180 días anteriores al partido:

- `n_pair`: partidos previos contra esa misma pareja rival;
- `n_r1` y `n_r2`: partidos previos contra cada rival individual.

`factor_repeticion = max(0,45; 1 − 0,10 × n_pair − 0,025 × (n_r1 + n_r2))`

Si se repite exactamente la misma pareja:

| Encuentro | Factor aproximado |
|---:|---:|
| Primero | 1,00 |
| Segundo | 0,85 |
| Tercero | 0,70 |
| Cuarto | 0,55 |
| Quinto y siguientes | 0,45 |

La expectativa previa ya reduce el valor de vencer a rivales inferiores. Este factor agrega protección contra el farming por repetición sin volver irrelevantes los partidos habituales.

También se consideran los partidos con el mismo compañero durante los 180 días anteriores:

`factor_companero = max(0,60; 1 − 0,05 × n_companero)`

| Partido con el mismo compañero | Factor aproximado |
|---:|---:|
| Primero | 1,00 |
| Segundo | 0,95 |
| Quinto | 0,80 |
| Noveno y siguientes | 0,60 |

Una pareja fija sigue aportando evidencia, pero cada nuevo resultado permite distinguir menos cuánto corresponde a cada integrante. El factor nunca llega a cero porque la consistencia de la dupla también informa sobre ambos jugadores.

### 8.1 Círculo competitivo cerrado

Rotar compañeros no alcanza para producir evidencia nueva si las mismas personas de nivel semejante juegan casi exclusivamente entre sí. En ese ecosistema BRAMU puede ordenar quién rinde mejor dentro del grupo, pero tiene poca información para afirmar que cambió la escala absoluta del grupo.

Para un jugador ya calibrado, se considera que existe un círculo competitivo cerrado cuando, durante los últimos 180 días:

- tiene al menos 20 partidos computables;
- al menos 80% de esos partidos se concentra en un conjunto de hasta 11 coparticipantes habituales, formando un grupo total máximo de 12 personas;
- la amplitud entre los niveles actuales de ese grupo no supera 1,5 puntos;
- el partido actual se juega íntegramente dentro de ese círculo y la pareja rival no supera a la propia por 0,75 puntos o más.

En esos partidos:

`factor_circulo = 0,45`

En los demás:

`factor_circulo = 1,00`

Si aparece un jugador externo o se enfrenta una pareja claramente superior, el partido aporta evidencia nueva y comienza con peso completo. Si esa persona pasa a integrar sistemáticamente el mismo círculo, el algoritmo termina incorporándola al conjunto habitual. El factor no impone un techo artificial ni bloquea cambios hacia abajo: reduce cuánto puede afirmarse a partir de una red poco conectada con el resto de BRAMU.

## 9. Variación individual

Para cada jugador `i`:

`K_i = 0,10 + 0,30 × (1 − confidence_i)`

`factor_oponente = 0,55 + 0,45 × confianza_pareja_rival`

`delta_i = K_i × (resultado − expectativa) × margen × formato × repeticion × factor_companero × factor_circulo × disponibilidad × factor_oponente`

Donde:

- resultado = 1 si ganó y 0 si perdió;
- expectativa es la probabilidad previa de su pareja;
- `confidence_i` es la confiabilidad efectiva inmediatamente anterior al partido, incluida cualquier reducción por inactividad;
- `factor_companero` reduce la evidencia individual de jugar reiteradamente con la misma persona;
- `factor_circulo` reduce el peso de un ecosistema competitivo pequeño y homogéneo;
- `disponibilidad` representa cuántos niveles reales se conocen en cancha;
- confianza de la pareja rival es el promedio de sus integrantes.

Topes:

- CALIBRANDO o RECALIBRANDO: ±0,50 por partido;
- CALIBRADO: ±0,35 por partido;
- nivel final limitado a 1,0–10,0.

El delta se guarda con cuatro decimales. La interfaz muestra el cambio redondeado a un decimal y omite `±0,0`.

### 9.1 Diferencias entre compañeros

Los compañeros pueden cambiar distinto si tienen distinta confiabilidad. Si ambos tienen la misma confiabilidad, reciben el mismo cambio.

BRAMU V1 no asigna variaciones diferentes por nivel relativo dentro de la pareja porque el score no demuestra cuál de los dos aportó más. Esta decisión preserva la regla de evidencia y coincide con el enfoque de equipos de UTR, incorporando la personalización por incertidumbre observada.^5

## 10. Confiabilidad

### 10.1 Evidencia aportada por un partido

`calidad_evidencia = formato × repeticion × factor_companero × factor_circulo × disponibilidad × (0,55 + 0,45 × confianza_pareja_rival)`

`evidence_units_nuevo = evidence_units_anterior + calidad_evidencia`

### 10.2 Conversión a confiabilidad

Sea `b` la confiabilidad de origen: 0,10 para camino rápido y 0,12, 0,15 o 0,18 para cuestionario completo según §3.4. Una incoherencia confirmada limita `b` a 0,10. A partir de evidencia acumulada:

`confidence = b + (0,95 − b) × (1 − exp(−evidence_units / 5,5))`

Todos los caminos convergen al mismo techo de 0,95. La diferencia inicial expresa solamente cuánto contexto sostiene la estimación, no la calidad del jugador.

La forma incremental equivalente, útil después de una inactividad, es:

`confidence_post = confidence_pre + (0,95 − confidence_pre) × (1 − exp(−calidad_evidencia / 5,5))`

Comportamiento aproximado para un origen estándar `b = 0,15`, con rivales confiables y diversos:

| Evidencia equivalente | Confiabilidad |
|---:|---:|
| 0 partidos | 15% |
| 1 partido | 28% |
| 3 partidos | 49% |
| 5 partidos | 63% |
| 10 partidos | 82% |
| 15 partidos | 90% |

El estado CALIBRADO se obtiene con cinco partidos computables y tres rivales diferentes, aunque la confiabilidad pueda variar según la calidad real de esa evidencia.

### 10.3 Inactividad

Durante los primeros 60 días sin partidos computables no cambia nada. Después:

`confidence_efectiva = max(0,15; confidence × 2 ^ (−(dias_inactivo − 60) / 240))`

El nivel no baja por inactividad. Al regresar, la menor confianza aumenta moderadamente la sensibilidad. Esto replica el principio de Glicko: el paso del tiempo incrementa incertidumbre, no demuestra una pérdida de habilidad.^1

La confiabilidad efectiva pasa a ser la base de la actualización incremental del siguiente partido; no se recupera de golpe el valor anterior. `evidence_units` conserva el total histórico para auditoría, mientras que el cálculo utiliza también la confianza efectiva prepartido.

## 11. Recalibración cada 90 días

### 11.1 Inicio

- disponible una vez cada 90 días corridos;
- acceso secundario en Perfil > Mis datos > Nivel BRAMU;
- repetir el cuestionario completo V1.1;
- volver a confirmar o actualizar la categoría contextual;
- aplicar el ajuste automático de categoría de §3.3, sin stepper libre;
- no borrar historial ni nivel consolidado.

### 11.2 Ancla provisional

Sea `mu_actual` el nivel consolidado y `q_nuevo` la nueva estimación confirmada:

`mu_provisional = clamp(0,75 × mu_actual + 0,25 × q_nuevo; mu_actual − 0,5; mu_actual + 0,5)`

La nueva autoevaluación aporta 25% y nunca mueve la referencia provisional más de 0,5. La confianza provisional será:

`confidence_provisional = max(0,30; min(0,70; 0,75 × confidence_actual))`

### 11.3 Cierre

- requiere 3 partidos computables;
- requiere al menos 2 rivales diferentes;
- ventana máxima de 120 días;
- hasta completarse, rankings y comparaciones oficiales conservan el último nivel consolidado;
- el detalle privado puede mostrar la referencia provisional;
- si vence la ventana, la referencia provisional expira y continúa el nivel consolidado anterior;
- el cooldown de 90 días se cuenta desde la confirmación del cuestionario.

Esto ofrece corrección autoservicio sin convertir el cuestionario en una herramienta para fabricar ranking.

## 12. Reglas temporales y correcciones

### 12.1 Actualización

El nivel cambia inmediatamente cuando el partido se vuelve válido y confirmado. Esto permite vincular la explicación al partido que aportó la evidencia.

### 12.2 Antigüedad de partidos manuales

Para Nivel BRAMU V1, un partido manual debe completar carga, asociación y validación dentro de los 30 días posteriores a la fecha real de juego. Después permanece en el historial, pero no modifica nivel ni ranking.

Esta regla:

- evita reconstrucciones históricas largas;
- limita cargas estratégicas de resultados antiguos;
- coincide con la ventana definida para reclamar participantes;
- mantiene el nivel orientado a capacidad actual.

### 12.3 Corrección posterior

Si se corrige un resultado ya validado:

1. registrar un evento que revierte exactamente la variación anterior;
2. recalcular el partido corregido con los mismos snapshots previos;
3. aplicar solamente la diferencia neta;
4. conservar ambas versiones y la causa de corrección.

No se reescribe silenciosamente la historia ni se recalcula en cascada todo el perfil.

## 13. Elegibilidad y casos especiales

| Caso | Historial | Nivel BRAMU |
|---|---|---|
| Partido completo y validado | Sí | Sí |
| Pendiente de rival | Sí | No todavía |
| Disputado | Sí | No |
| Observado por espectador | Sí | No |
| Walkover / no presentación | Sí | No |
| Abandono o resultado incompleto | Sí | No en V1 |
| Score inválido | Sí, con advertencia | No |
| Cargado o validado fuera de 30 días | Sí | No |
| Duplicado | Una sola identidad de partido | Una sola vez |
| Formato corto válido | Sí | Sí, con menor peso |
| Match tie-break válido | Sí | Sí, con menor peso |

Nivel BRAMU V1 permite computar un partido cuando existe al menos un jugador con nivel en cada pareja. No se pide a otra persona que estime al invitado.

Cuando faltan niveles, se utiliza una imputación neutral basada únicamente en los datos ya conocidos:

- cuatro niveles conocidos: no existe imputación;
- tres niveles conocidos: el invitado toma, solo para ese partido, el promedio de los tres niveles efectivos conocidos;
- dos niveles conocidos, uno en cada pareja: ambos invitados toman el promedio de los dos niveles efectivos conocidos;
- dos conocidos en la misma pareja, uno solo o ninguno en la pareja rival: el partido no computa.

El nivel imputado no crea un perfil, no se guarda como nivel del invitado y no recibe variaciones. Solo los jugadores reales con Nivel BRAMU se actualizan.

Cuando una pareja rival contiene un invitado, `confianza_pareja_rival` se calcula con los rivales que sí tienen nivel; la reducción adicional por dato ausente ya queda contenida en `disponibilidad` y no se aplica dos veces.

Para reflejar la menor información se aplica:

| Niveles conocidos | Factor `disponibilidad` |
|---:|---:|
| 4 de 4 | 1,00 |
| 3 de 4 | 0,80 |
| 2 de 4, uno por pareja | 0,60 |

La imputación comprime la expectativa hacia un partido parejo y el factor reduce tanto el cambio de nivel como la evidencia ganada. Esto permite incluir al invitado que nunca tendrá cuenta sin fingir que BRAMU conoce su capacidad.

## 14. Simulaciones de partido único

La siguiente batería utiliza la fórmula propuesta. “A” es la pareja ganadora. Los valores son internos antes del redondeo público.

| Caso | Score de A | Probabilidad previa A | Cambio A | Cambio B |
|---|---:|---:|---:|---:|
| Parejas 5,0 estables, partido cerrado | 6-4, 4-6, 7-6 | 50% | +0,07 | −0,07 |
| Parejas 5,0 estables, dos sets | 6-4, 6-4 | 50% | +0,08 | −0,08 |
| Parejas 5,0 estables, amplio | 6-1, 6-1 | 50% | +0,08 | −0,08 |
| 5,0 vence a 6,0 | 6-4, 6-4 | 23% | +0,12 | −0,12 |
| 6,0 vence a 5,0 | 6-4, 6-4 | 77% | +0,04 | −0,04 |
| 4,5 vence a 6,5 | 6-4, 6-4 | 8% | +0,14 | −0,14 |
| 6,5 vence a 4,5 | 6-4, 6-4 | 92% | +0,01 | −0,01 |
| Pareja 7,0 + 3,0 vence a 5,0 + 5,0 | 6-4, 6-4 | 50% | +0,08 ambos | −0,08 ambos |
| Nuevos 5,0 vencen a 5,0 estables | 6-4, 6-4 | 50% | +0,17 | −0,05 |
| Estables 5,0 vencen a 5,0 nuevos | 6-4, 6-4 | 50% | +0,05 | −0,17 |
| Nuevos 5,0 vencen a 6,0 estables | 6-4, 6-4 | 23% | +0,27 | −0,08 |
| Segunda victoria ante misma pareja 5,0 | 6-4, 6-4 | 50% | +0,07 | −0,07 |
| Cuarta victoria ante misma pareja 5,0 | 6-4, 6-4 | 50% | +0,04 | −0,04 |
| Mini sets entre pares 5,0 | 4-2, 4-2 | 50% | +0,06 | −0,06 |
| Super tie-break entre pares 5,0 | 6-4, 4-6, 10-8 | 50% | +0,06 | −0,06 |
| Compañeros 5,0 con confianza 20% y 90% | 6-4, 6-4 | 50% | +0,17 / +0,06 | — |
| 5,0 vence a 6,0 en partido cerrado | 6-4, 4-6, 7-6 | 23% | +0,10 | −0,10 |
| 5,0 vence a 6,0 ampliamente | 6-1, 6-1 | 23% | +0,13 | −0,13 |

La fórmula cumple los comportamientos buscados:

- premia más el upset que el resultado esperado;
- limita el efecto del score;
- mueve más al jugador incierto que al consolidado;
- reduce formatos cortos;
- reduce repetición;
- no atribuye rendimiento técnico individual.

## 15. Simulaciones longitudinales

### 15.1 Jugador subestimado

Un jugador inicial 4,5 vence cinco veces a rivales 5,5 confiables y diversos:

`4,50 → 4,73 → 4,94 → 5,12 → 5,28 → 5,42`

El sistema corrige aproximadamente un punto en cinco partidos, pero cada cambio se desacelera al crecer la confianza y acercarse al nivel rival.

### 15.2 Jugador sobreestimado

Un jugador inicial 6,0 pierde cinco veces ante rivales 5,0 confiables:

`6,00 → 5,81 → 5,63 → 5,46 → 5,32 → 5,19`

La calibración corrige con rapidez sin producir un derrumbe de varios puntos en un solo encuentro.

### 15.3 Resultados alternados

Un jugador inicial 5,0 alterna diez victorias y derrotas frente a rivales equivalentes:

`5,00 → 5,17 → 5,01 → 5,16 → 5,02 → … → 5,01`

El nivel converge alrededor del punto de partida mientras aumenta la confiabilidad.

### 15.4 Farming de rivales débiles

Un jugador 6,0 vence diez veces seguidas a la misma pareja 4,0:

`6,00 → 6,01 → 6,02 → 6,03 → 6,03 → 6,04 → … → 6,05`

El resultado esperado y la repetición reducen progresivamente la ganancia. Diez victorias no producen un salto artificial de varios niveles.

## 16. Simulación anual en un grupo cerrado

Se simularon 100 temporadas sintéticas por escenario con estas condiciones:

- jugador inicial 4,2 y ya confiable;
- grupos cerrados de diez y doce jugadores entre 4,0 y 5,0;
- compañeros y rivales rotativos dentro del mismo grupo;
- 200 partidos distribuidos durante un año;
- resultados mayormente parejos;
- cuatro niveles conocidos, que representa el máximo peso posible;
- factores de repetición activos.

Mediana obtenida:

| Tamaño del grupo | Efectividad anual | Récord | Nivel inicial | Nivel a 200 | Variación |
|---:|---:|---:|---:|---:|---:|
| 10 jugadores | 60% | 120–80 | 4,20 | 4,62 | +0,42 |
| 10 jugadores | 65% | 130–70 | 4,20 | 4,75 | +0,55 |
| 10 jugadores | 70% | 140–60 | 4,20 | 4,90 | +0,70 |
| 12 jugadores | 60% | 120–80 | 4,20 | 4,65 | +0,45 |
| 12 jugadores | 65% | 130–70 | 4,20 | 4,79 | +0,59 |
| 12 jugadores | 70% | 140–60 | 4,20 | 4,94 | +0,74 |

El desplazamiento anual queda entre +0,42 y +0,74 en estos escenarios. El líder del grupo logra separarse, pero no cambia más de una categoría completa basándose solamente en resultados internos.

La rotación de compañeros sigue aportando más información individual que una dupla fija, pero no elimina el descuento del círculo. Para avanzar claramente más allá de esa estabilidad, el jugador necesita conectar su rendimiento con otro ecosistema mediante rivales externos o de mayor nivel.

En la versión anterior de parámetros, sin descuento por compañero y con menor sensibilidad de expectativa, 65% podía llevar aproximadamente a 5,64 y 70% a 6,05. Esa deriva se consideró excesiva y fue descartada. Si además faltan niveles en cancha, los factores 0,80 y 0,60 reducen todavía más el desplazamiento.

## 17. Referencia empírica de categorías argentinas

No existe un censo público completo de todos los jugadores amateurs argentinos por categoría. Como referencia primaria se consultó el registro público de jugadores de la Asociación Pádel Argentino y se filtró cada categoría individualmente en septiembre de 2026.^11

El padrón devolvió 36.798 registros categorizados entre primera y séptima. La octava figura como opción, pero no devolvió registros; por eso se excluye del denominador. El padrón puede incluir jugadores históricos o actualmente inactivos y no debe interpretarse como población activa de 2026.

| Categoría | Caballeros | Damas | Total | Participación |
|---:|---:|---:|---:|---:|
| 1ra | 543 | 40 | 583 | 1,6% |
| 2da | 722 | 124 | 846 | 2,3% |
| 3ra | 1.799 | 359 | 2.158 | 5,9% |
| 4ta | 3.323 | 843 | 4.166 | 11,3% |
| 5ta | 5.164 | 1.598 | 6.762 | 18,4% |
| 6ta | 7.875 | 3.263 | 11.138 | 30,3% |
| 7ma | 7.532 | 3.613 | 11.145 | 30,3% |

En esta base:

- 60,6% está en sexta o séptima;
- 78,9% está entre quinta y séptima;
- solamente 9,7% está entre primera y tercera.

Como contraste de actividad reciente se analizó el Circuito Regional de Pádel de Villa María 2026: 17 fechas, tres clubes y más de 900 jugadores declarados.^12 En 67 cuadros publicados, las inscripciones masculinas promediaron:

| Categoría | Parejas promedio por fecha | Rango observado |
|---:|---:|---:|
| 3ra | 11,2 | 8–18 |
| 4ta | 14,6 | 9–21 |
| 5ta | 27,9 | 19–36 |
| 6ta | 30,4 | 27–36 |
| 7ma | 29,1 | 21–42 |
| 8va | 22,9 | 15–30 |

Las dos fuentes tienen sesgos diferentes, pero muestran la misma forma general: la población competitiva se concentra en niveles bajos y medios, y se reduce fuertemente desde cuarta hacia primera.

### Decisión para BRAMU

La pirámide debe utilizarse como control de realidad, no como una cuota forzada. BRAMU no debe decidir de antemano que solo cierto porcentaje puede alcanzar cada nivel ni reducir `K` simplemente porque el jugador ya es alto. Eso haría que una mala clasificación superior también fuera difícil de corregir hacia abajo.

La progresión se aplana legítimamente mediante tres mecanismos ya definidos:

1. al subir, las victorias frente a niveles inferiores son cada vez más esperables y aportan menos;
2. los círculos cerrados no validan grandes desplazamientos absolutos;
3. para seguir avanzando hacen falta resultados frente a rivales de nivel semejante o superior y redes competitivas nuevas.

La distribución madura de BRAMU deberá compararse con esta pirámide, pero no copiarla: BRAMU incluirá muchos jugadores recreativos no federados y probablemente tendrá una base todavía más ancha. Una concentración inesperada en niveles 8–10 sería una señal para revisar cuestionario, calibración o inflación, no para bajar niveles automáticamente.

## 18. Explicaciones de producto

Cada actualización debe conservar códigos de razón y traducir solamente los más relevantes.

Prioridad:

1. sorpresa por dificultad;
2. calibración o baja confiabilidad;
3. margen especialmente amplio o cerrado;
4. formato reducido;
5. repetición de rivales;
6. inactividad previa.

Ejemplos:

> **Triunfo de alto valor**  
> Superaron a una pareja con mayor Nivel BRAMU. Como todavía estás calibrando, este resultado aporta más información.

> **Resultado esperado**  
> La victoria confirma tu nivel actual. El cambio fue pequeño porque la diferencia previa era favorable.

> **Evidencia limitada**  
> Este encuentro aporta menos al nivel porque ya enfrentaste varias veces a la misma pareja.

> **Regreso con mayor sensibilidad**  
> Tu nivel se mantiene, pero después de un período sin actividad los próximos partidos pueden ajustarlo con mayor rapidez.

No se deben mostrar fórmulas, porcentajes de expectativa ni lenguaje como “BRAMU pensaba que perdías” en la devolución principal.

## 19. Contrato de backend derivado

### Jugador

- nivel interno y público;
- confiabilidad almacenada y efectiva;
- unidades de evidencia;
- estado;
- contadores de calibración;
- fecha de última actividad;
- cooldown de recalibración;
- nivel consolidado y provisional separados;
- versión del algoritmo.
- métricas móviles de diversidad y pertenencia a círculo competitivo.

### Partido

- fecha real y fecha de validación;
- formato y factor aplicado;
- resultado estructurado por sets;
- participantes y parejas;
- estado de validación;
- snapshots de `mu` y confiabilidad de los cuatro jugadores;
- expectativa previa;
- factores aplicados;
- cantidad de niveles conocidos, niveles imputados y factor de disponibilidad;
- factor de compañero y factor de círculo competitivo;
- delta individual sin redondear;
- códigos de explicación;
- versión del algoritmo.

### Eventos

- creación del nivel inicial;
- estimación base y ajuste automático de categoría;
- respuestas, contexto, bandera de coherencia y versión del cuestionario;
- variación por partido;
- reversión y corrección;
- inicio, cierre o expiración de recalibración;
- cambios de confiabilidad;
- versión y fecha.

## 20. Qué queda pendiente de evidencia real

La investigación y simulación permiten cerrar una fórmula candidata, pero no pueden resolver sin datos propios:

1. si una diferencia BRAMU de 1,0 representa realmente una probabilidad cercana al 72%;
2. si el `K` inicial converge demasiado rápido o lento para la población real;
3. si el margen 0,90–1,15 predice mejor que un rango más estrecho;
4. si la curva de confiabilidad corresponde a la diversidad real de jugadores;
5. si las categorías descriptivas propuestas coinciden con el lenguaje que los usuarios entienden en Argentina;
6. si los anclajes argentinos de categoría necesitan ajustes después de contar con las primeras semanas de datos reales;
7. qué mapas locales corresponden a otras regiones, circuitos y divisiones competitivas;
8. si el promedio de pareja necesita en el futuro una corrección por desequilibrio.

Estos puntos no bloquean una V1 para el lanzamiento inicial. Deben medirse con validación retrospectiva:

- entrenar parámetros con una parte de los partidos;
- predecir una muestra no utilizada;
- medir acierto y calibración de probabilidades;
- revisar estabilidad por nivel, género, categoría y cantidad de partidos;
- cambiar parámetros solo creando una nueva versión del algoritmo.

## 21. Decisión resuelta sobre invitados

Se adopta como regla V1 que alcanza con un jugador con nivel en cada pareja. Los niveles ausentes se imputan mediante el promedio neutral definido en la sección 13 y el partido pierde peso según la cantidad de datos reales disponibles. Nunca se solicita ni se guarda una estimación de terceros sobre el invitado.

## 22. Definición de cierre de Nivel BRAMU V1

El sistema puede considerarse cerrado para desarrollo cuando:

- se aprueben cualitativamente las simulaciones de este documento;
- backend confirme que puede guardar snapshots, eventos y versión de algoritmo;
- se creen pruebas automáticas con estos escenarios;
- toda modificación futura requiera una nueva versión del algoritmo.

La fórmula y el cuestionario V1.1 quedan cerrados como candidatos implementables para el lanzamiento inicial. Después del lanzamiento requieren validación empírica con datos propios y cualquier cambio posterior debe versionarse.

## Fuentes

1. Mark E. Glickman. “[The Glicko System](https://www.glicko.net/glicko/glicko.pdf).” Documento oficial del autor, revisión 2016.
2. Mark E. Glickman. “[Example of the Glicko-2 System](https://www.glicko.net/glicko/glicko2.pdf).” 22 de marzo de 2022.
3. Ralf Herbrich, Tom Minka y Thore Graepel. “[TrueSkill: A Bayesian Skill Rating System](https://www.microsoft.com/en-us/research/wp-content/uploads/2007/01/NIPS2006_0688.pdf).” Advances in Neural Information Processing Systems 20, Microsoft Research/MIT Press, 2007.
4. UTR Sports. “[Understanding the Algorithm — Complete Summary](https://support.universaltennis.com/en/support/solutions/articles/9000151830-understanding-the-algorithm-complete-summary).” Consultado en septiembre de 2026.
5. UTR Sports. “[FAQ: Doubles Algorithm](https://support.universaltennis.com/en/support/solutions/articles/9000183289-faq-doubles-algorithm).” Consultado en septiembre de 2026.
6. DUPR. “[How It Works](https://www.dupr.com/how-it-works).” Consultado en septiembre de 2026.
7. Playtomic. “[How the Playtomic Level System Works](https://playerhelp.playtomic.com/hc/en-gb/articles/43310980754193-How-the-Playtomic-level-system-works).” Actualizado el 9 de junio de 2026.
8. UTR Sports. “[How UTR Rating Works](https://www.utrsports.net/pages/how-utr-works).” Sección Estimated UTR Rating, consultada en septiembre de 2026.
9. International Padel Federation. “[Rules of Padel](https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel.pdf).” Aplicación desde el 1 de enero de 2026.
10. Playtomic. Capturas privadas `IMG_1556.PNG`–`IMG_1581.PNG`, carpeta `/Otros Trabajos/BRAMUlab/BRAMUlab/Referencias/Benchmark/Playtomic`, consultadas en septiembre de 2026.
11. Asociación Pádel Argentino. “[Listado público de jugadores](https://torneosapa.com.ar/p_jugadores.php).” Conteos obtenidos mediante filtros individuales de categoría, consultado el 10 de septiembre de 2026.
12. Circuito Regional de Pádel de Villa María. “[Temporada y cuadros 2026](https://crpvm.com.ar/).” 67 cuadros publicados de la temporada, consultado el 10 de septiembre de 2026.
