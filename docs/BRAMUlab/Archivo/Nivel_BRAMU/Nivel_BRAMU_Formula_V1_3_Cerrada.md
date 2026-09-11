# Nivel BRAMU — Fórmula V1, investigación y simulación

## Resumen ejecutivo

La recomendación es construir Nivel BRAMU V1 como un sistema híbrido, específico para pádel amateur de dobles:

- una expectativa de resultado tipo Elo;
- una medida explícita de incertidumbre inspirada en Glicko y TrueSkill;
- una fuerza de pareja basada en el promedio de las capacidades individuales, atenuadas cuando su confiabilidad es baja;
- una influencia acotada del resultado por sets y games;
- variaciones individuales determinadas por la confiabilidad de cada jugador, sin inventar cuál integrante “jugó mejor”;
- reducción del peso de formatos cortos, rivales poco confiables y enfrentamientos repetidos;
- nivel estable durante la inactividad, pero con menor confiabilidad y mayor sensibilidad al regreso.

Esta arquitectura resuelve la fórmula candidata para el piloto. Sus parámetros iniciales producen comportamientos coherentes en simulaciones, pero no deben considerarse calibrados científicamente hasta contar con resultados reales de BRAMU. La fórmula debe publicarse internamente como **Nivel BRAMU V1.0** y conservar su versión en cada evento de cálculo.

## 1. Qué enseñan los modelos existentes

### Elo

Elo aporta la idea central más útil: convertir la diferencia de nivel previa en una probabilidad esperada y actualizar según la diferencia entre resultado real y esperado. Su principal limitación para BRAMU es que un único número no expresa cuánto se conoce al jugador.

### Glicko y Glicko-2

Glicko agrega una desviación de rating que representa incertidumbre. Un jugador nuevo o inactivo tiene una estimación menos confiable y, por lo tanto, puede moverse más; un jugador activo y bien medido cambia menos. La incertidumbre aumenta con la inactividad sin que la habilidad estimada tenga que disminuir.^1 Glicko-2 añade volatilidad para representar cambios de rendimiento, aunque su implementación completa está pensada para períodos con varios resultados y agrega complejidad innecesaria para el primer piloto de BRAMU.^2

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

## 3. Nivel inicial mediante cuestionario

UTR informa que su cuestionario de estimación fue probado con casi 2.000 usuarios y ubicó al 85% dentro de un rango correcto.^8 Esto no permite reutilizar su fórmula, pero respalda el cuestionario como prior razonable, no como medición definitiva.

### 3.1 Dimensiones y pesos

| Dimensión | Peso |
|---|---:|
| Autoevaluación general | 30% |
| Tiempo jugando | 15% |
| Formación o clases | 10% |
| Frecuencia reciente | 10% |
| Experiencia competitiva | 15% |
| Desempeño declarado en la red | 10% |
| Lectura y uso declarado de rebotes | 10% |

Cada respuesta se normaliza entre 0 y 1. La edad queda excluida.

### 3.2 Fórmula

Sea `q_k` la respuesta normalizada y `w_k` su peso:

`Q = suma(w_k × q_k)`

`nivel_cuestionario = 1 + 7,5 × Q`

El cuestionario completo produce valores entre 1,0 y 8,5. El ajuste posterior del jugador permite ±0,5, siempre limitado a 1,0–9,0. Los valores superiores a 9,0 deben alcanzarse mediante evidencia competitiva o, en una etapa futura, validación externa. Esto evita que una autoevaluación otorgue por sí sola el máximo de la escala.

Confiabilidad inicial:

- evaluación rápida: 0,10;
- cuestionario completo: 0,15.

### 3.3 Camino rápido

| Elección | Semilla propuesta |
|---|---:|
| Iniciación | 2,0 |
| Intermedio | 4,0 |
| Intermedio alto | 5,5 |
| Avanzado | 7,0 |
| Competición | 8,5 |

También permite un ajuste final de ±0,5, pero comienza con menor confiabilidad que el cuestionario completo.

### 3.4 Pruebas del cuestionario

| Perfil sintético | Resultado bruto | Rango tras ajuste |
|---|---:|---:|
| Principiante total | 1,38 | 1,00–1,88 |
| Inicial recreativo | 2,61 | 2,11–3,11 |
| Intermedio en formación | 4,51 | 4,01–5,01 |
| Intermedio consolidado | 6,04 | 5,54–6,54 |
| Avanzado amateur | 7,24 | 6,74–7,74 |
| Competición | 8,50 | 8,00–9,00 |

Los nombres y cortes finales de las categorías requieren validación local. La fórmula del nivel no depende de que ese vocabulario quede cerrado.

### 3.5 Cuestionario completo propuesto

Introducción:

> **Calculemos tu primer Nivel BRAMU**  
> Son 7 preguntas y lleva cerca de 2 minutos. No es un examen: elegí la opción que mejor describe tu juego actual.

Las opciones se puntúan de 0 a 1. El usuario nunca ve esos valores.

**1. ¿Cómo describirías tu nivel actual?** — peso 30%

| Opción | Valor |
|---|---:|
| Estoy empezando | 0,00 |
| Inicial | 0,25 |
| Intermedio | 0,50 |
| Intermedio alto | 0,75 |
| Avanzado o competición | 1,00 |

**2. ¿Hace cuánto jugás al pádel?** — peso 15%

| Opción | Valor |
|---|---:|
| Menos de 3 meses | 0,00 |
| Entre 3 meses y 1 año | 0,25 |
| Entre 1 y 2 años | 0,50 |
| Entre 2 y 4 años | 0,75 |
| Más de 4 años | 1,00 |

**3. ¿Qué experiencia tenés con clases o entrenamiento?** — peso 10%

| Opción | Valor |
|---|---:|
| Nunca tomé clases | 0,00 |
| Hice algunas clases o clínicas | 0,25 |
| Tomo clases de vez en cuando | 0,50 |
| Entreno con regularidad actualmente | 0,75 |
| Entreno regularmente hace más de un año | 1,00 |

**4. En los últimos 3 meses, ¿con qué frecuencia jugaste?** — peso 10%

| Opción | Valor |
|---|---:|
| No estuve jugando | 0,00 |
| Menos de una vez por mes | 0,20 |
| Entre 1 y 3 veces por mes | 0,40 |
| Una vez por semana | 0,60 |
| Entre 2 y 3 veces por semana | 0,80 |
| 4 veces por semana o más | 1,00 |

**5. ¿Qué experiencia competitiva te describe mejor hoy?** — peso 15%

| Opción | Valor |
|---|---:|
| Nunca competí | 0,00 |
| Jugué alguna liga o torneo recreativo | 0,20 |
| Compito en categorías iniciales y tengo partidos parejos | 0,40 |
| Compito en categorías intermedias y tengo partidos parejos | 0,60 |
| Compito en categorías avanzadas y tengo partidos parejos | 0,80 |
| Compito en categorías avanzadas y suelo llegar a instancias finales | 1,00 |

La frase “partidos parejos” importa más que el nombre local de la categoría: evita asumir que una “sexta” o “cuarta” significa lo mismo en todos los clubes.

**6. Cuando estás en la red, ¿qué opción te representa mejor?** — peso 10%

| Opción | Valor |
|---|---:|
| Todavía me cuesta subir y ubicarme | 0,00 |
| Resuelvo voleas simples, pero pierdo control con presión | 0,25 |
| Sostengo la red y me ubico con mi compañero | 0,50 |
| Uso voleas y bandejas para conservar la posición | 0,75 |
| Varío golpes con intención y recupero la red con consistencia | 1,00 |

**7. ¿Cómo te llevás con las paredes?** — peso 10%

| Opción | Valor |
|---|---:|
| Todavía evito dejarlas pasar | 0,00 |
| Devuelvo pelotas simples después de la pared de fondo | 0,25 |
| Uso pared de fondo y lateral en situaciones habituales | 0,50 |
| Leo rebotes dobles y elijo cuándo girar o salir | 0,75 |
| Uso las paredes con consistencia incluso con velocidad o presión | 1,00 |

### 3.6 Camino rápido: texto completo

Entrada:

> **¿Preferís estimarlo rápido o afinarlo?**

- **Elegir mi nivel** — 30 segundos. Cinco descripciones y una estimación menos confiable.
- **Ayudame a calcularlo** — recomendado. Siete preguntas, cerca de 2 minutos y una estimación inicial más precisa.

Opciones rápidas:

| Opción | Descripción | Semilla |
|---|---|---:|
| Iniciación | Estoy aprendiendo las reglas y los golpes básicos | 2,0 |
| Intermedio | Puedo sostener el juego y empiezo a usar posiciones y paredes | 4,0 |
| Intermedio alto | Juego con control, entiendo la pareja y construyo puntos | 5,5 |
| Avanzado | Manejo ritmos, posiciones y recursos con consistencia | 7,0 |
| Competición | Compito de manera habitual frente a jugadores avanzados | 8,5 |

### 3.7 Resultado y ajuste del jugador

Categorías de comunicación iniciales:

| Nivel | Categoría |
|---:|---|
| 1,0–2,4 | Iniciación |
| 2,5–3,9 | Recreativo |
| 4,0–5,4 | Intermedio |
| 5,5–6,9 | Intermedio alto |
| 7,0–8,4 | Avanzado |
| 8,5–10,0 | Competición |

Pantalla propuesta:

> **Tu nivel estimado es 5,3 — Intermedio**  
> Es una primera referencia basada en tus respuestas. Podés ajustarla una sola vez hasta 0,5 puntos. Después BRAMU la va a calibrar con partidos válidos.

El control usa pasos de 0,1, con un desplazamiento total máximo de ±0,5. Antes de confirmar muestra la descripción de la categoría alcanzada. Acción principal: **Confirmar mi nivel**. Acción secundaria: **Revisar respuestas**. Después de confirmar no se repite el alta; las futuras correcciones usan la recalibración con cooldown.

En perfil se muestra en ámbar con la leyenda **Nivel estimado · BRAMU te está conociendo**. Al completar cinco partidos computables y tres rivales diferentes pasa al estado calibrado y adopta el tratamiento visual oficial.

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

Sea `b` la confiabilidad de origen: 0,15 para cuestionario completo y 0,10 para camino rápido. A partir de evidencia acumulada:

`confidence = b + (0,95 − b) × (1 − exp(−evidence_units / 5,5))`

Ambos caminos convergen al mismo techo de 0,95; el cuestionario completo comienza con una ventaja pequeña por aportar más información.

La forma incremental equivalente, útil después de una inactividad, es:

`confidence_post = confidence_pre + (0,95 − confidence_pre) × (1 − exp(−calidad_evidencia / 5,5))`

Comportamiento aproximado con rivales confiables y diversos:

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
- repetir cuestionario completo;
- permitir ajuste ±0,5;
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

## 17. Explicaciones de producto

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

## 18. Contrato de backend derivado

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
- ajuste del jugador;
- variación por partido;
- reversión y corrección;
- inicio, cierre o expiración de recalibración;
- cambios de confiabilidad;
- versión y fecha.

## 19. Qué queda pendiente de evidencia real

La investigación y simulación permiten cerrar una fórmula candidata, pero no pueden resolver sin datos propios:

1. si una diferencia BRAMU de 1,0 representa realmente una probabilidad cercana al 72%;
2. si el `K` inicial converge demasiado rápido o lento para la población real;
3. si el margen 0,90–1,15 predice mejor que un rango más estrecho;
4. si la curva de confiabilidad corresponde a la diversidad real de jugadores;
5. si las categorías descriptivas propuestas coinciden con el lenguaje que los usuarios entienden en Argentina;
6. si el promedio de pareja necesita en el futuro una corrección por desequilibrio.

Estos puntos no bloquean una V1 de piloto. Deben medirse con validación retrospectiva:

- entrenar parámetros con una parte de los partidos;
- predecir una muestra no utilizada;
- medir acierto y calibración de probabilidades;
- revisar estabilidad por nivel, género, categoría y cantidad de partidos;
- cambiar parámetros solo creando una nueva versión del algoritmo.

## 20. Decisión resuelta sobre invitados

Se adopta como regla V1 que alcanza con un jugador con nivel en cada pareja. Los niveles ausentes se imputan mediante el promedio neutral definido en la sección 13 y el partido pierde peso según la cantidad de datos reales disponibles. Nunca se solicita ni se guarda una estimación de terceros sobre el invitado.

## 21. Definición de cierre de Nivel BRAMU V1

El sistema puede considerarse cerrado para desarrollo cuando:

- se aprueben cualitativamente las simulaciones de este documento;
- backend confirme que puede guardar snapshots, eventos y versión de algoritmo;
- se creen pruebas automáticas con estos escenarios;
- toda modificación futura requiera una nueva versión del algoritmo.

La fórmula ya no necesita más investigación conceptual para una V1. Necesita validación de producto sobre una única tensión y, después del lanzamiento piloto, ajuste empírico con datos propios.

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
