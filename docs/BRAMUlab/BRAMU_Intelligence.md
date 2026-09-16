# BRAMU Intelligence para partidos cargados manualmente

**Estado:** V1 de producto cerrada y lista para handoff a desarrollo  
**Alcance:** partidos cargados manualmente / ya jugados; no rediseña el registro en vivo  
**Fecha de cierre:** 11 de septiembre de 2026

## 1. Decisión ejecutiva

BRAMU Intelligence no debe ser un relator del partido ni un generador de frases sobre el resultado. Debe ser un **motor selectivo de interpretación personal**: identifica qué tiene de particular el partido, qué cambia o confirma dentro de la historia del jugador y cuál es la evidencia exacta que permite decirlo.

La unidad de valor no es “un texto automático”. Es un **insight respaldado**. Cada insight debe responder al menos una de estas preguntas:

- ¿Qué ocurrió que no se ve inmediatamente mirando el score?
- ¿Qué significa este resultado dentro de la historia reciente del jugador?
- ¿Qué cambia en una relación concreta con un compañero o rival?
- ¿Fue un resultado esperable o excepcional para el contexto disponible?
- ¿Qué hito real se alcanzó o qué tendencia real se cortó?

El núcleo de la primera implementación es determinístico y basado en reglas. Debe generar candidatos, descartar los débiles, ordenarlos por relevancia y mostrar **una conclusión principal más cero, una o dos secundarias**. Sobre ese núcleo se aprueba una capa generativa de redacción, activable cuando supere las pruebas internas. Esa capa no calcula hechos, no modifica prioridades y no es necesaria para que la funcionalidad siga operando.

La definición puede resumirse así:

> BRAMU Intelligence observa lo que está registrado, lo compara con la historia pertinente, selecciona lo excepcional y lo expresa sin exceder la evidencia.

Esta dirección conserva la promesa original del producto —cada partido suma a tu historia— y resuelve el límite central del modo manual: el score aislado aporta poca novedad, pero el mismo score situado dentro de una trayectoria puede ser muy significativo.[^1]

---

## 2. Qué enseñan las referencias investigadas

Las referencias no ofrecen una pantalla para copiar. Sí muestran principios útiles.

### 2.1 La personalización real nace de una comparación pertinente

Strava presenta Athlete Intelligence como una interpretación simple y personalizada de los datos de actividad, no como una lista adicional de métricas.[^2] Oura organiza tendencias para observar cambios en el tiempo,[^3] mientras Garmin combina información personal con referencias comparativas.[^4] La lección para BRAMU es que un número se vuelve insight cuando se contrasta con una base relevante.

Para BRAMU, la mejor base no es “todos los jugadores” sino, en este orden:

1. el propio historial reciente;
2. la propia historia completa comparable;
3. la relación concreta con ese compañero o rival;
4. la expectativa derivada del Nivel BRAMU, cuando sea confiable;
5. una población externa, solo si en el futuro existe una base suficientemente limpia y comparable.

La comparación genérica con otros usuarios, útil en algunos productos de fitness, tiene menos valor en pádel amateur si no controla nivel, formato, frecuencia y calidad del dato. BRAMU debe privilegiar el **yo contra mi historia** antes que el **yo contra un promedio opaco**.

### 2.2 La confiabilidad debe formar parte del producto

Playtomic ajusta el nivel según resultado, niveles de rivales y compañero, y confiabilidad; además explica que la menor confiabilidad produce cambios mayores.[^5] UTR distingue rating estimado, proyectado y confiable; también separa resultados verificados de no verificados y calcula el rendimiento en función del porcentaje de games esperado frente a rivales concretos.[^6]

La lección no es copiar sus algoritmos. Es hacer visible que una conclusión depende de:

- cuántos antecedentes existen;
- si las identidades están resueltas;
- si los partidos son comparables;
- si el Nivel BRAMU está calibrado;
- si el resultado está validado para usos oficiales.

BRAMU no debe usar la misma contundencia para “primer partido registrado” y para una tendencia sustentada por veinte partidos.

### 2.3 Los datos ricos habilitan afirmaciones ricas

SwingVision puede producir estadísticas técnicas porque registra video y procesa acciones; su flujo diferencia explícitamente el ingreso del score final de la generación de estadísticas mediante grabación y análisis.[^7] Es la confirmación más directa de una regla básica: winners, errores, ubicación de golpes o patrones tácticos no aparecen mágicamente a partir del resultado.

BRAMU debe conservar niveles de profundidad distintos:

| Fuente | Qué conoce | Profundidad legítima |
|---|---|---|
| Carga manual | Participantes, fecha, formato, sets, resultado, historial | Score + contexto longitudinal |
| Registro por games | Lo anterior + secuencia de games | Score + secuencia intermedia |
| Punto a punto | Secuencia completa registrada | Análisis temporal profundo |

Esta investigación define la primera fila. No rediseña las otras dos.

### 2.4 Una voz segura puede empeorar la confianza si interpreta de más

Un estudio de 2026 sobre reacciones a feedback generado por IA en Strava encontró cuatro tensiones recurrentes: números contra contexto, resumen aislado contra historia continua, tono fijo contra estados diversos y una sola voz contra distintos tipos de deportistas. Los usuarios rechazaban devoluciones que cerraban demasiado la interpretación de su propia experiencia.[^8]

Esto conduce a cuatro reglas para BRAMU:

- describir resultados, no estados emocionales;
- reconocer el contexto incompleto;
- hablar de la trayectoria sin apropiarse de la experiencia vivida;
- preferir una observación precisa antes que una conclusión grandilocuente.

### 2.5 Ser inteligente también significa seleccionar y abstenerse

Los sistemas de generación automática de historias de datos tratan los hechos como unidades seleccionables y miden su importancia antes de organizarlos en una narrativa.[^9] BRAMU necesita la misma separación: **detectar hechos** y **decidir cuáles merecen aparecer** son problemas distintos.

Mostrar tres frases porque hay tres espacios disponibles degrada el producto. Si solo hay una conclusión fuerte, mostrar una sola es la decisión inteligente.

---

## 3. Modelo conceptual: Evidencia → Contexto → Relevancia → Expresión

BRAMU Intelligence debe funcionar en cuatro etapas lógicas.

### 3.1 Evidencia

Construye hechos atómicos verificables a partir del partido y del historial. Ejemplos:

- el jugador perdió el primer set y ganó los dos siguientes;
- el partido actual es la cuarta victoria consecutiva;
- es el primer partido registrado con ese compañero;
- frente a uno de los rivales, el historial pasó de 1–3 a 2–3;
- el Nivel BRAMU subió 0,08 después de un partido validado.

Cada hecho debe conservar internamente sus partidos fuente, ventana temporal, universo de comparación y nivel de confianza.

### 3.2 Contexto

Decide contra qué base tiene sentido comparar el partido:

- últimos cinco partidos jugados;
- últimos diez;
- historial total comparable;
- historial con un compañero;
- historial frente a un rival;
- historial del mismo cruce de parejas;
- expectativa de Nivel BRAMU;
- temporada o período, si más adelante existe ese concepto.

No todas las bases sirven para todos los hechos. Un 6–4 / 6–4 no debe compararse con un partido decidido mediante super tie-break como si sus games fueran equivalentes.

### 3.3 Relevancia

Genera varios candidatos y prioriza los que aportan mayor novedad personal, especificidad y confianza. Aquí se decide que “cortaste una serie de cuatro derrotas” vale más que “ganaste en dos sets”.

### 3.4 Expresión

Convierte el candidato elegido en lenguaje breve, con el grado de certeza correcto. La redacción nunca agrega significado nuevo. Solo expresa el hecho aprobado.

Esta separación permite incorporar la capa generativa aprobada únicamente en la expresión, sin darle permiso para inventar evidencia, contexto o relevancia.

---

## 4. Contrato de evidencia

Cada insight debe pertenecer a una de estas cuatro clases. Si no entra con claridad en una, no se publica.

| Clase | Definición | Forma verbal permitida | Ejemplo |
|---|---|---|---|
| Dato observado | Está guardado explícitamente | “fue”, “terminó”, “registraste” | “El partido se definió en tres sets.” |
| Deducción determinística | Se deriva sin ambigüedad | “revirtió”, “cortó”, “extendió” | “Revirtieron el resultado después de perder el primer set.” |
| Comparación histórica | Contrasta datos comparables suficientes | “es tu…”, “supera”, “iguala”, “en tus últimos…” | “Es tu primera victoria en tres sets de los últimos 12 partidos.” |
| Inferencia calibrada | Usa una expectativa probabilística confiable | “era menos probable”, “superó la expectativa” | “Ganaste un partido en el que tu pareja partía por debajo en Nivel BRAMU.” |

### 4.1 Afirmaciones permitidas con carga manual

BRAMU puede afirmar:

- quién ganó y en cuántos sets;
- games ganados y perdidos, respetando el tipo de set;
- si hubo un set decisivo;
- si una pareja perdió el primer set y ganó el partido;
- qué set tuvo el menor o mayor margen de games;
- si hubo alternancia en los ganadores de sets;
- si el resultado extiende o corta una racha;
- si cambia la forma reciente;
- cuántas veces jugaron juntos o se enfrentaron;
- el balance histórico en esas relaciones;
- si es un récord o una rareza, con muestra comparable suficiente;
- si el resultado fue distinto de la expectativa de Nivel BRAMU, cuando esa expectativa exista y sea confiable.

### 4.2 Afirmaciones que requieren lenguaje acotado

| Riesgo | Evitar | Usar |
|---|---|---|
| Confundir score con juego | “Fue un partido dominado de principio a fin.” | “El resultado fue en sets corridos y con 12–4 en games.” |
| Psicologizar | “Mostraste fortaleza mental para remontar.” | “Revirtieron el partido después de perder el primer set.” |
| Atribuir causalidad al compañero | “Con Juan jugás mejor.” | “Con Juan llevás 4 victorias en 5 partidos registrados.” |
| Etiquetar capacidad del rival sin nivel | “Venciste a rivales fuertes.” | “Venciste a una pareja contra la que venías 0–2.” |
| Inventar secuencia interna | “El quiebre llegó en el momento justo.” | “El set decisivo terminó 7–5.” |
| Diagnosticar técnica | “Tenés que mejorar tu devolución.” | No producir conclusión técnica. |
| Universalizar un registro parcial | “Siempre rendís mejor con Juan.” | “En tu historial BRAMU, tu efectividad con Juan es 4/5.” |

### 4.3 Afirmaciones prohibidas

Con score manual, BRAMU nunca debe afirmar ni insinuar:

- desarrollo punto a punto o game a game;
- quiebres de saque, holds o puntos de oro;
- quién empezó mejor dentro de un set;
- dominio continuo del juego;
- winners, errores, smash, voleas o cualquier golpe;
- rendimiento técnico individual;
- cansancio, presión, confianza, actitud o estado emocional;
- causas del resultado;
- decisiones tácticas;
- desempeño de un jugador aislado dentro de la pareja;
- que un partido fue “fácil” o “difícil” por el score solamente;
- que una relación es causal: “X te hace ganar”;
- predicciones de mejora futura presentadas como certeza.

La regla editorial más importante es esta:

> BRAMU puede decir qué muestran los resultados. No puede decir cómo se produjo aquello que no registró.

---

## 5. Taxonomía de insights para partidos manuales

### 5.1 Familia A — Estructura del resultado

Es la capa disponible desde el primer partido. Tiene valor limitado y debe perder prioridad a medida que crece el historial.

| Insight | Condición | Ejemplo correcto |
|---|---|---|
| Sets corridos | Victoria o derrota 2–0 | “El resultado se resolvió en dos sets.” |
| Partido a tres sets | Se jugaron tres sets completos | “Fue una definición en tres sets.” |
| Reversión a nivel de sets | Pierde el primero y gana los dos siguientes | “Revirtieron el partido después de perder el primer set.” |
| Alternancia | Cada set cambia de ganador hasta el decisivo | “El ganador de cada set fue alternando hasta la definición.” |
| Set más ajustado | Menor margen válido entre sets | “El segundo fue el set más ajustado: 7–6.” |
| Set más amplio | Mayor margen válido | “La mayor diferencia apareció en el primer set: 6–1.” |
| Margen total | Diferencia de games válidos | “La diferencia total fue de 3 games.” |
| Márgenes similares | La diferencia por set varía muy poco | “Los dos sets tuvieron el mismo margen.” |

Restricción: expresiones como “partido parejo” deben depender de una regla explícita, no de intuición. Para formato estándar al mejor de tres:

- **muy ajustado**: tres sets y margen normalizado total menor o igual a 10%, o dos sets con ambos definidos 7–6/7–5;
- **ajustado**: tres sets con margen normalizado menor o igual a 20%, o al menos dos sets con margen de hasta 2 games;
- **amplio en el score**: victoria en sets corridos y margen normalizado igual o mayor a 40%;
- en otros casos, no aplicar etiqueta global.

El margen normalizado es `diferencia absoluta de games / games totales`, excluyendo puntos de un match tie-break. Los umbrales deben validarse con partidos reales antes de quedar definitivos.

### 5.2 Familia B — Hitos y excepciones personales

Esta familia suele producir el insight principal porque transforma un resultado en historia.

- primera victoria registrada;
- victoria número 10, 25, 50 o 100;
- primera victoria en tres sets;
- mayor racha de victorias registrada;
- igualdad de la mejor racha;
- fin de la racha de derrotas más larga;
- partido con menor o mayor margen dentro de una muestra comparable;
- victoria más ajustada o amplia del historial comparable;
- primer triunfo ante un rival o una pareja luego de antecedentes suficientes;
- regreso registrado después de una inactividad excepcional.

Reglas mínimas recomendadas:

- “récord personal” requiere al menos 10 partidos comparables;
- “el más…” debe considerar empates: “iguala tu…” si no es único;
- los hitos acumulativos deben usar una lista limitada y no convertir cada número en celebración;
- la inactividad es excepcional si supera `máximo entre 30 días y 2 veces la mediana de separación de los últimos 10 partidos`, con al menos 6 partidos previos;
- nunca traducir un regreso en “volviste mejor” sin evidencia de nivel o tendencia suficiente.

### 5.3 Familia C — Racha y forma reciente

La racha responde a resultados consecutivos. La forma reciente es una ventana móvil. No son lo mismo.

**Racha**

- comienza a ser mostrable en 3 victorias o 3 derrotas consecutivas;
- gana máxima prioridad desde 4;
- puede extenderse, igualar récord, marcar récord o terminar;
- siempre se calcula por fecha real del partido, no por orden de carga.

**Forma reciente**

- ventana principal: últimos 5 partidos jugados, incluido el actual;
- contexto secundario: últimos 10, solo cuando aporta contraste;
- se expresa como balance exacto, no como juicio vago;
- “mejoró tu forma reciente” solo si cambia el balance de los últimos 5 respecto de la ventana inmediatamente anterior y la diferencia es material;
- evitar publicar a la vez “4 victorias seguidas” y “ganaste 4 de los últimos 5” salvo que exista una razón excepcional: son casi el mismo relato.

Ejemplos:

- “Con esta victoria, llevás 4 triunfos seguidos: tu mejor racha registrada.”
- “Cortaste una serie de 3 derrotas consecutivas.”
- “Tu balance reciente pasó a 4 victorias en los últimos 5 partidos.”

No usar:

- “Estás jugando cada vez mejor.”
- “Recuperaste tu confianza.”
- “Volviste a tu mejor nivel.”

### 5.4 Familia D — Compañeros

En dobles, esta familia es valiosa pero especialmente propensa a falsas atribuciones.

Insights permitidos:

- primer partido registrado juntos;
- cantidad de partidos y balance de la pareja;
- primera victoria juntos;
- racha actual como pareja;
- mejor balance entre compañeros frecuentes;
- contraste entre etapa reciente y balance histórico de la pareja.

Umbrales:

- “compañero habitual”: al menos 4 partidos juntos;
- comparación de efectividad entre compañeros: al menos 5 partidos con cada compañero comparado;
- “mejor balance”: al menos 5 partidos juntos y mostrar siempre la muestra;
- un 2–0 o 3–0 puede describirse exactamente, pero no etiquetarse como “sociedad ideal”.

Lenguaje correcto:

- “Con Lucía llevás 5 victorias en 7 partidos registrados.”
- “Es la primera victoria de los 3 partidos que jugaste con Martín.”

Lenguaje incorrecto:

- “Lucía potencia tu juego.”
- “Martín no es un buen compañero para vos.”
- “Encontraste tu pareja ideal.”

### 5.5 Familia E — Rivales y enfrentamientos

El sistema debe distinguir cuatro alcances:

1. historial contra un rival individual;
2. historial contra cada integrante rival;
3. historial contra la pareja rival exacta;
4. historial del cruce exacto de las dos parejas.

No deben mezclarse. “Nunca le habías ganado a Pedro” es distinto de “nunca le habías ganado a Pedro y Luis juntos”.

Umbrales recomendados:

- “rival habitual”: 3 enfrentamientos previos;
- tendencia de enfrentamiento: mínimo 4 partidos totales;
- primer triunfo relevante: al menos 2 derrotas previas en el mismo alcance;
- cruce exacto de parejas: puede mostrarse desde el segundo antecedente porque su especificidad ya es alta, pero sin hablar de tendencia hasta 4 partidos.

Ejemplos:

- “Primera victoria frente a Diego después de dos derrotas registradas.”
- “Este cruce de parejas quedó 2–2.”
- “Frente a Paula, tu balance reciente pasó a 3 victorias y 2 derrotas.”

### 5.6 Familia F — Patrón histórico del score

Busca rarezas comparando solo partidos de formato compatible.

- frecuencia de tres sets;
- balance en partidos a tres sets;
- balance cuando se pierde el primer set;
- frecuencia de sets definidos 7–6;
- distribución de márgenes;
- comparación del partido actual con la mediana personal;
- repetición o excepción de una estructura de resultado.

Ejemplos válidos:

- “Es tu tercera victoria en cuatro partidos que llegaron al set decisivo.”
- “Hasta hoy habías perdido los dos partidos registrados en los que cediste el primer set.”
- “Este fue tu resultado más ajustado entre 14 partidos de formato comparable.”

No convertir estos patrones en rasgos psicológicos. “Ganás 3 de 4 en tercer set” no habilita “sos fuerte bajo presión”.

### 5.7 Familia G — Contexto y dificultad sin Nivel BRAMU

Antes del Nivel BRAMU, la dificultad solo puede expresarse mediante antecedentes concretos:

- pareja contra la que el historial era desfavorable;
- rival al que no se le había ganado;
- compañero nuevo;
- formato infrecuente;
- larga inactividad;
- partido dentro o fuera de la forma reciente.

No llamar “rivales fuertes” a quienes simplemente habían ganado antes. La formulación debe conservar el dato:

- correcto: “Era una pareja contra la que venías 0–2.”
- incorrecto: “Superaste un desafío de nivel superior.”

### 5.8 Familia H — Nivel BRAMU y expectativa

Nivel BRAMU V1.4 ya está cerrado. Esta familia queda habilitada cuando el backend entregue los snapshots y códigos de razón definidos por ese sistema.[^11]

Puede incluir:

- expectativa previa de victoria para cada pareja;
- diferencia de fuerza entre parejas;
- resultado esperable o por encima de la expectativa previa;
- variación exacta del Nivel BRAMU;
- avance de calibración;
- nuevo mejor Nivel BRAMU;
- estabilidad del nivel cuando el delta calculado sea pequeño;
- calidad de la evidencia según confiabilidad de los cuatro jugadores.

Reglas V1 de elegibilidad y lenguaje:

- **Por encima de la expectativa:** victoria con expectativa previa de hasta 35%, cuatro niveles conocidos y confianza prepartido mínima de 0,60 en los cuatro jugadores. Puede ser principal.
- **Pareja por debajo:** victoria con expectativa de 36% a 44%, con la misma calidad de evidencia. Solo es principal si se combina con otro hecho relevante.
- **Partido equilibrado:** expectativa de 45% a 55%. No genera por sí sola un insight.
- **Resultado esperable:** expectativa de victoria de 65% o más. Solo aparece para explicar por qué el Nivel cambió poco; nunca se usa como festejo principal.
- **Tres niveles conocidos:** puede decir “con los niveles disponibles, tu pareja partía por debajo”, pero no “sorpresa” ni “triunfo de alto valor”.
- **Dos niveles conocidos o algún nivel aún calibrando:** no clasifica la dificultad; puede explicar que el partido aporta evidencia limitada o mostrar el avance de calibración.
- El score solo puede explicar el multiplicador de margen ya calculado. No se inventa una expectativa de games que Nivel BRAMU V1.4 no calcula.
- No mostrar porcentajes de expectativa en la tarjeta principal ni usar frases como “BRAMU pensaba que perdías”.

Ejemplos permitidos:

- “Tu pareja partía por debajo según los niveles previos y terminó ganando.”
- “La victoria confirma tu nivel actual; el cambio fue pequeño porque la diferencia previa era favorable.”
- “Este partido suma evidencia, pero tu Nivel BRAMU todavía está calibrando.”

Un partido válido y no duplicado puede formar parte de la historia personal aunque esté pendiente, disputado, sea casual, haya sido cargado por un espectador o se haya validado fuera de término. Solo un partido computable y validado según Nivel BRAMU V1.4 puede producir impacto oficial de Nivel o Ranking. Esta separación debe viajar hasta el insight.

---

## 6. Qué hace que un hecho sea realmente interesante

Un hecho no es interesante por ser verdadero. Debe superar una prueba de relevancia.

### 6.1 Puntaje de relevancia recomendado

Cada candidato recibe un puntaje de 0 a 100:

| Factor | Peso | Pregunta |
|---|---:|---|
| Cambio o excepcionalidad | 25 | ¿Corta, inicia, iguala o marca algo fuera de lo normal? |
| Relevancia personal | 20 | ¿Habla de la historia específica del jugador? |
| Especificidad relacional | 15 | ¿Involucra a este compañero, rival o cruce concreto? |
| Confianza de evidencia | 20 | ¿La muestra, identidad, comparabilidad y validación son sólidas? |
| Actualidad narrativa | 10 | ¿Explica qué cambia ahora? |
| Novedad editorial | 10 | ¿Aporta algo distinto de lo mostrado recientemente? |

Penalizaciones:

- `−30` si repite el score visible sin comparación;
- `−20` si otro candidato seleccionado ya cuenta la misma historia;
- `−15` si la misma familia fue insight principal en los últimos 2 partidos;
- `−10` si la frase propuesta reutiliza la misma estructura de los últimos 5;
- descarte total si falta evidencia, comparabilidad o identidad estable.

Estos pesos y penalizaciones quedan congelados como parámetros V1 para el piloto. Pueden recalibrarse después con datos reales, siempre mediante una nueva versión documentada y sin reescribir silenciosamente insights históricos.

### 6.2 Orden editorial de prioridad

Ante empate o cercanía, priorizar:

1. hito excepcional o quiebre de tendencia;
2. resultado por encima/debajo de expectativa confiable de Nivel BRAMU;
3. récord o mejor marca personal;
4. historia específica con compañero, rival o cruce;
5. racha o cambio material de forma;
6. patrón histórico de score;
7. lectura particular del resultado actual;
8. descripción genérica del score.

### 6.3 Regla de diversidad dentro del mismo partido

No mostrar dos insights que respondan la misma pregunta.

Ejemplo de mala selección:

- “Sumaste tu cuarta victoria consecutiva.”
- “Ganaste 4 de tus últimos 4 partidos.”
- “Seguís invicto en tus últimos 4.”

Ejemplo de buena selección:

- Principal: “Sumaste tu cuarta victoria consecutiva, tu mejor racha registrada.”
- Secundario relacional: “Con Nico, el balance quedó en 5 victorias sobre 7 partidos.”
- Secundario de score: “Fue tu primera victoria después de perder el primer set.”

### 6.4 Abstención

Si ningún candidato supera el umbral V1 de 55/100, no se fuerza un insight histórico. El sistema muestra una lectura honesta del score o un estado de aprendizaje.

Ejemplo:

> Partido guardado. Todavía no hay antecedentes suficientes para compararlo con tu historia.

Esto no es un fallo. Es confianza bien calibrada.

### 6.5 Algoritmo editorial V1

El orden de selección queda cerrado así:

1. generar todos los claims compatibles con el partido y la perspectiva del jugador;
2. descartar los que no cumplen evidencia, identidad, muestra, formato, oficialidad o confianza;
3. calcular el puntaje con los pesos y penalizaciones V1;
4. descartar candidatos por debajo de 55;
5. ordenar por puntaje descendente; ante empate, usar el orden editorial de la sección 6.2 y luego un identificador estable;
6. seleccionar el primero como principal;
7. agregar hasta dos secundarios solo si pertenecen a familias diferentes, cuentan historias distintas y también superan 55;
8. aplicar cooldowns y memoria editorial antes de cerrar la salida;
9. si no queda ningún candidato, usar el estado de aprendizaje o una lectura mínima del score;
10. guardar claims, evidencia, puntajes, descartes y versión de reglas para poder reconstruir la decisión.

La IA generativa no altera este orden. Recibe únicamente los claims ya seleccionados y puede redactarlos o fusionar dos compatibles sin agregar información.

---

## 7. Cómo evitar que todos los partidos suenen iguales

La variedad debe resolverse primero en el **contenido** y después en las palabras.

### 7.1 Memoria editorial

BRAMU debe guardar por jugador:

- familia del insight principal de los últimos 5 partidos;
- identificador semántico de cada insight mostrado;
- plantilla de redacción utilizada;
- entidades protagonistas: racha, compañero, rival, nivel, score;
- fecha de última aparición;
- valor anterior mostrado para no celebrar lo mismo sin cambio.

Un insight no se repite si no cambió materialmente. “Con Juan llevás 4 de 5” puede reaparecer como “5 de 6” si sigue siendo relevante, pero no debería ocupar siempre el primer lugar.

### 7.2 Rotación semántica, no sinónimos aleatorios

Cambiar “sumaste” por “conseguiste” no crea inteligencia. La diversidad real surge al rotar entre:

- trayectoria;
- relaciones;
- excepcionalidad;
- expectativa;
- patrón del score.

Las variantes de texto sirven solo después de elegir contenidos distintos.

### 7.3 Cooldowns recomendados

- misma familia como principal: penalización durante 2 partidos;
- mismo hecho relacional: no repetir hasta que cambie el balance o pasen 4 partidos;
- mismo hito: una sola aparición;
- misma plantilla exacta: no reutilizar en los siguientes 5 partidos;
- racha: mostrar al llegar a 3, al igualar récord, al superarlo y al terminar; no necesariamente en cada paso intermedio.

### 7.4 Variación controlada de tono

El tono puede modularse por resultado sin interpretar emociones:

- victoria/hito: afirmativo y celebratorio moderado;
- derrota: factual, sin castigo ni optimismo artificial;
- resultado neutro o muestra baja: exploratorio;
- sorpresa de nivel: destacado, con explicación breve;
- calibración: pedagógico.

Evitar tanto el festejo obligatorio como el “coach positivo” automático. Una derrota puede producir un insight valioso sin cerrar con una moraleja.

---

## 8. Evolución a medida que BRAMU conoce al jugador

La profundidad debe progresar de forma explícita.

| Historial utilizable | Estado | Qué priorizar | Qué no prometer |
|---:|---|---|---|
| 0–1 previos | Primeras señales | Estructura del score, primer compañero/rival, hito inicial | Tendencias, “mejor”, habitualidad |
| 2–4 previos | Calibrando historia | Rachas incipientes, repeticiones concretas, primeros cruces | Patrones estables, récords sólidos |
| 5–9 previos | Lectura reciente | Forma de 5, rachas, relaciones frecuentes, calibración completa de Nivel si aplica | Percentiles robustos |
| 10–19 previos | Historia comparable | Excepciones, récords, patrones de score, regresos, mejores asociaciones con muestra | Conclusiones causales |
| 20+ previos | Inteligencia longitudinal | Tendencias móviles, contexto de temporada, expectativa de nivel, estabilidad | Certeza absoluta o técnica no observada |

### 8.1 Mensajes de aprendizaje

El producto debe convertir la falta de datos en expectativa clara, no esconderla.

- 1 partido: “Primer partido de tu historia BRAMU.”
- 3 partidos: “Ya aparecen tus primeros antecedentes con este grupo.”
- 5 partidos: “Tu forma reciente ya puede leerse sobre tus últimos 5.”
- Nivel calibrando: “Este partido suma evidencia; tu Nivel BRAMU sigue calibrando.”

Estos mensajes deben aparecer una vez por hito de aprendizaje, no en todos los partidos.

### 8.2 Dos historias paralelas

BRAMU debe distinguir:

- **historia personal registrada**: puede incluir partidos manuales admitidos por la política de producto;
- **historia oficial**: solo partidos que cumplen validación para Nivel y Ranking.

Una observación puede ser válida en la primera y no en la segunda. Ejemplo:

> “En tus partidos registrados llevás 3 victorias seguidas.”

no equivale necesariamente a:

> “Tu racha oficial es de 3 victorias.”

La interfaz y el texto deben usar el alcance correcto.

---

## 9. UX posterior a la carga

### 9.1 Recomendación de estructura

Después de guardar el partido, mostrar:

1. **Resultado/resumen** ya existente.
2. **BRAMU Intelligence** inmediatamente debajo.
3. **Una tarjeta principal**.
4. **Hasta dos observaciones secundarias**, solo si superan el umbral.
5. **Evidencia desplegable** con “Por qué aparece”.

No usar un párrafo narrativo único. Una tarjeta principal y observaciones independientes permiten leer rápido, distinguir ideas y omitir lo débil.

### 9.2 Anatomía del insight principal

- etiqueta: `BRAMU Intelligence`;
- título de 3–7 palabras;
- cuerpo de 12–24 palabras;
- una línea de evidencia o chip opcional;
- sin CTA obligatorio.

Ejemplo:

**Nueva mejor racha**  
Con esta victoria llegaste a 4 triunfos seguidos, tu serie más larga en BRAMU.  
`Historial comparable: 18 partidos`

### 9.3 Observaciones secundarias

- 1 frase cada una;
- 10–20 palabras;
- sin repetir el título principal;
- idealmente de otra familia;
- máximo dos.

Ejemplo:

- “Con Tomás, el balance quedó en 5 victorias sobre 7 partidos.”
- “Fue tu primera victoria registrada después de perder el primer set.”

### 9.4 Evidencia y transparencia

“Por qué aparece” abre una explicación factual, no técnica:

- partidos considerados;
- ventana: últimos 5, historial completo, con ese rival;
- dato anterior y dato nuevo;
- estado oficial/personal;
- confiabilidad del Nivel, cuando aplique.

Ejemplo:

> Antes de este partido: 3 derrotas seguidas. Resultado actual: victoria. Partidos ordenados por fecha jugada.

Esto permite corregir problemas de datos y aumenta confianza sin llenar la pantalla principal.

### 9.5 Cantidad adaptativa

| Calidad de candidatos | Salida |
|---|---|
| Un candidato fuerte | 1 tarjeta principal |
| Uno fuerte + uno complementario | 1 principal + 1 secundario |
| Tres familias fuertes y distintas | 1 principal + 2 secundarios |
| Sin candidato histórico | 1 lectura de score o estado de aprendizaje |

Nunca mostrar más de tres conclusiones en el post-partido. El resto puede vivir en Resumen, Historial, Perfil o vistas longitudinales.

### 9.6 Rol del diseño

La jerarquía visual debe expresar la jerarquía intelectual:

- el insight principal tiene más peso, no más texto;
- la evidencia es accesible pero secundaria;
- los números importantes pueden destacarse dentro de la frase;
- no usar íconos diferentes para cada microtipo si generan ruido;
- reservar acento verde para hitos positivos o estado principal, y azul para contexto/información;
- una derrota no debe teñir todo el bloque de rojo; el contenido es informativo, no una alarma.

---

## 10. Ejemplos completos

### Caso 1 — Poco historial

**Datos:** segundo partido registrado; victoria 6–3 / 6–4; compañero nuevo.

**Salida recomendada**

**Primer partido juntos**  
Esta fue tu primera aparición registrada con Marcos como compañero.

Secundario opcional: “El resultado se resolvió en dos sets, con 12–7 en games.”

**No decir:** “La nueva pareja funcionó muy bien.”

### Caso 2 — Quiebre de racha

**Datos:** victoria 6–4 / 3–6 / 6–2; tres derrotas anteriores; 14 partidos históricos.

**Salida recomendada**

**Racha cortada**  
Esta victoria terminó una serie de 3 derrotas consecutivas.

Secundario: “Revirtieron el partido después de perder el segundo set” es incorrecto: ganar primero, perder segundo y ganar tercero no es una reversión del partido. La lectura válida sería: “El partido necesitó un tercer set para definirse.”

### Caso 3 — Remontada legítima a nivel de sets

**Datos:** derrota 4–6 en el primero; victoria 6–3 / 6–4; sin secuencia de games.

**Salida recomendada**

**Resultado revertido**  
Después de perder el primer set, ganaron los dos siguientes y se quedaron con el partido.

**No decir:**

- “Cambiaste el ritmo en el segundo set.”
- “Reaccionaste a tiempo.”
- “El quiebre temprano cambió el partido.”

### Caso 4 — Rival habitual

**Datos:** antes del partido, balance 0–3 frente a Laura; victoria actual; compañero variable.

**Salida recomendada**

**Primera victoria frente a Laura**  
Llegó en el cuarto enfrentamiento registrado; el balance quedó 1–3.

**No decir:** “Superaste finalmente a tu rival más difícil.” No sabemos si es la más difícil ni por qué.

### Caso 5 — Compañero frecuente

**Datos:** 8 partidos con Nico; balance pasa a 6–2.

**Salida recomendada**

**Una pareja con recorrido**  
Con Nico acumulás 6 victorias en 8 partidos registrados.

**No decir:** “Nico es el compañero que mejor complementa tu juego.”

### Caso 6 — Con Nivel BRAMU

**Datos:** pareja A con expectativa de victoria del 29%, niveles confiables; A gana 7–6 / 4–6 / 6–4; partido validado.

**Salida recomendada**

**Por encima de la expectativa**  
Tu pareja partía por debajo según los Niveles BRAMU previos y terminó ganando en tres sets.

Evidencia: `Expectativa previa: 29% · Niveles confiables · Partido validado`

**No decir:** “Diste el batacazo gracias a tu fortaleza mental.”

### Caso 7 — No hay nada excepcional

**Datos:** partido número 12; derrota 3–6 / 4–6; rival nuevo; sin cambio material de forma.

**Salida recomendada**

**Un nuevo cruce en tu historial**  
Fue tu primer partido registrado frente a esta pareja rival.

Si ni siquiera ese hecho es útil, basta con:

> Partido guardado. No apareció una conclusión histórica más relevante que el resultado.

La segunda opción debe probarse en UX: es honesta, pero quizá convenga omitir por completo el bloque secundario y dejar solo el resumen.

---

## 11. Datos necesarios

### 11.1 Mínimo obligatorio para la primera implementación

- `matchId` estable;
- `playedAt` real, separado de `createdAt`;
- identidad estable de cada participante mediante `userId` o `playerId`;
- identificación del jugador desde cuya perspectiva se genera el insight;
- composición exacta de ambas parejas;
- ganador;
- orden y resultado de cada set;
- tipo de set: estándar, tie-break set, match tie-break u otro;
- formato del partido;
- modo de registro: manual, games, completo;
- origen: participante, espectador u organizador;
- estado de validación;
- carácter oficial/competitivo/casual cuando corresponda;
- elegibilidad para historia personal, Nivel BRAMU y Ranking BRAMU por separado.

Sin identidad estable, los insights de compañero y rival son frágiles. El nombre visible solo puede ser fallback legacy; cambiar `displayName` no debe romper el historial.

### 11.2 Derivados que conviene precalcular

- resultado desde la perspectiva de cada jugador;
- games válidos a favor y en contra;
- margen normalizado;
- cantidad de sets y presencia de decisivo;
- secuencia de ganadores de set;
- racha anterior y posterior;
- balance últimos 5 y 10;
- balance con compañero;
- balance frente a cada rival;
- balance contra pareja rival exacta;
- balance del cruce exacto;
- percentiles personales por formato;
- días desde el partido anterior;
- elegibilidad y confianza de cada comparación;
- historial de insights mostrados.

### 11.3 Datos adicionales de alto valor y bajo costo

No se recomienda agregar campos obligatorios a la primera versión. Primero debe comprobarse cuánto valor entrega el historial puro.

Como evolución, los dos datos opcionales con mejor relación valor/fricción serían:

1. **Contexto del partido:** casual, entrenamiento, torneo/liga. Permite comparar universos más justos.
2. **Percepción declarada por el jugador:** una selección opcional como `me sentí bien / normal / por debajo`. BRAMU podría decir “lo marcaste como…” y estudiar asociaciones, nunca presentarlo como observación objetiva ni causa.

No conviene pedir winners, errores o golpes en la carga manual: aumenta mucho la fricción, depende de memoria poco fiable y crea una falsa precisión. Esos datos pertenecen al registro en vivo o a captura automática futura.

---

## 12. Motor propio e IA generativa

### 12.1 Núcleo obligatorio: reglas determinísticas

Debe resolverse con reglas:

- validación del score;
- normalización de formatos;
- cálculo de rachas, forma y balances;
- detección de hitos;
- relaciones entre identidades;
- expectativa de Nivel BRAMU;
- elegibilidad por muestra y confiabilidad;
- puntaje de relevancia;
- deduplicación;
- cooldowns editoriales;
- selección de 1–3 insights;
- plantillas de redacción.

Ventajas:

- cada frase puede auditarse;
- los tests son claros;
- no hay costo variable de generación;
- el tono es controlable;
- no se necesita enviar historial sensible a un modelo;
- los errores se corrigen en una regla concreta.

### 12.2 Arquitectura conceptual del insight

Aunque no se programe ahora, producto debe definir cada insight como un objeto estructurado con:

- `insightType`;
- `family`;
- `perspectivePlayerId`;
- `claim` estructurado;
- `evidenceMatchIds`;
- `comparisonScope`;
- `sampleSize`;
- `confidenceTier`;
- `officialScope`;
- `salienceScore`;
- `semanticKey`;
- `templateId`;
- `dataAsOf`.

La frase visible es una representación de ese objeto, no la fuente de verdad.

### 12.3 Capa generativa aprobada: función permitida

Puede aportar:

- variación natural de redacción;
- síntesis de dos hechos compatibles en una sola frase;
- consultas del usuario sobre su historia;
- resúmenes mensuales o de temporada;
- explicación conversacional de por qué apareció un insight;
- adaptación de longitud o tono.

No debe:

- consultar datos crudos y decidir libremente qué ocurrió;
- calcular estadísticas;
- inferir acciones no registradas;
- diagnosticar técnica;
- inventar causalidad;
- reemplazar la validación determinística.

Flujo aprobado:

1. el motor de reglas calcula, puntúa y selecciona los claims aprobados;
2. la plantilla determinística queda preparada como salida completa de respaldo;
3. el modelo recibe solo los claims seleccionados, placeholders y límites de lenguaje;
4. devuelve una salida estructurada con los identificadores de claims utilizados;
5. un validador comprueba números, nombres, negaciones, longitud, claims y términos prohibidos;
6. si falla, vence el tiempo, se agota la cuota o la capa está apagada, se usa la plantilla determinística.

La IA se implementa como componente técnico opcional, no como modo visible ni elección que el usuario deba entender. Si supera el benchmark, puede estar activa por defecto para todos. “Opcional” significa que BRAMU puede apagarla sin romper el producto.

### 12.4 Qué ocurre si se retira la IA

Al desactivarla:

- no desaparece ningún hecho, comparación, prioridad, tarjeta ni explicación;
- Nivel BRAMU, Ranking BRAMU y todos los cálculos siguen iguales;
- los nuevos textos usan plantillas controladas;
- los textos generativos históricos ya validados pueden conservarse hasta que cambie su contexto;
- se pierde principalmente variedad verbal y la síntesis más natural de claims compatibles;
- el costo de inferencia pasa a cero y no se requiere migrar datos.

Por lo tanto, BRAMU Intelligence no queda atado comercial ni funcionalmente a un proveedor.

### 12.5 Proveedor y costo de referencia

La primera integración recomendada es Cloudflare Workers AI con Qwen3 30B A3B, detrás del backend y nunca desde GitHub Pages.[^12] Con el patrón completo estimado —post-partido, Tu momento y grupos— la referencia actual es:

| Usuarios activos mensuales | Costo mensual estimado de inferencia |
|---:|---:|
| 1.000 | USD 0 |
| 5.000 | aproximadamente USD 8 |
| 10.000 | aproximadamente USD 14 |

La gratuidad operativa prudente se estima en 1.500–2.000 usuarios activos mensuales; el máximo teórico ronda 2.780, pero no conviene diseñar al límite por los picos diarios. A 10.000 usuarios, el backend, almacenamiento y operación general probablemente cuesten más que la redacción generativa.

Groq con GPT-OSS 20B y Zero Data Retention queda como proveedor alternativo. Si ambos dejan de ser convenientes, se apaga la capa generativa y continúan las plantillas.[^12]

Un marco reciente para sistemas generativos de fitness propone evaluar seguridad, utilidad, precisión, relevancia y personalización de forma conjunta, no solo fluidez.[^10] Para BRAMU, precisión factual debe ser una puerta de entrada: si no es 100% verificable en los casos de prueba, la redacción generativa no se publica.

---

## 13. Dependencias con backend, Nivel y Ranking

### 13.1 Backend

Dependencias imprescindibles:

- identidades estables y deduplicación de jugadores;
- consultas cronológicas por fecha jugada;
- relaciones entre participantes;
- estado de validación;
- versionado o recálculo cuando se corrige/elimina un partido;
- capacidad de reconstruir por qué se generó un insight;
- separación entre dato personal y oficial.

Si se edita, elimina o valida un partido antiguo, rachas, forma, balances e insights posteriores pueden cambiar. El sistema debe recalcular derivados; no puede tratar el texto histórico como verdad permanente.

### 13.2 Nivel BRAMU

Nivel BRAMU V1.4 está cerrado. BRAMU Intelligence consume, sin recalcular:

- nivel previo al partido de los cuatro jugadores;
- confiabilidad/calibración de cada nivel;
- fuerza previa de cada pareja;
- expectativa previa, congelada al momento del partido;
- delta posterior por jugador;
- motivo estructurado del cambio;
- elegibilidad oficial del partido.

La expectativa debe guardarse como snapshot. Recalcular un partido antiguo con niveles actuales reescribiría injustamente la historia.

### 13.3 Ranking BRAMU

Ranking BRAMU V1 está cerrado y no tiene puntos propios: ordena el Nivel BRAMU consolidado dentro de universos elegibles.[^13] Ranking e Intelligence cumplen funciones distintas:

- Ranking ordena jugadores por Nivel BRAMU en ámbitos Local, Provincial, País, Global y Mis jugadores.
- Intelligence interpreta qué significa un partido para el jugador.

Un cambio de posición puede ser insight solo si es material, verificable y ocurre al procesar el evento actual:

- primera entrada a un ranking establecido;
- entrada al top 10 de un universo establecido;
- nueva mejor posición con mejora de al menos 3 puestos;
- ascenso de al menos `máximo entre 3 puestos y 5% del universo`;
- cambio de banda pública de Nivel BRAMU, expresado como cambio de nivel, no como categoría competitiva.

No se genera Intelligence de puesto en universos con menos de 15 elegibles ni por movimientos menores. El ranking puede cambiar por actividad ajena; por eso el texto usa “tras actualizarse el ranking” y no atribuye causalidad exclusiva al partido. La Race y las temporadas están fuera de V1.

---

## 14. Primera implementación recomendada

### Alcance funcional V1 cerrado

El núcleo incluye estos detectores:

1. reversión después de perder el primer set;
2. racha de victorias/derrotas: inicio desde 3, récord y corte;
3. forma de últimos 5;
4. primer partido y balance con compañero;
5. primer enfrentamiento y balance frente a rivales;
6. primer triunfo luego de al menos 2 derrotas en el mismo alcance;
7. hitos acumulativos y récords básicos con muestra suficiente;
8. score excepcional dentro del historial comparable.
9. expectativa, calibración y variación de Nivel BRAMU con snapshots V1.4;
10. hitos materiales de Ranking BRAMU bajo las reglas de la sección 13.3.

No incluir:

- recomendaciones técnicas;
- comparaciones poblacionales;
- patrones complejos combinando muchas variables;
- insights oficiales sobre partidos no validados;
- campos manuales extra obligatorios.

La capa generativa forma parte de la arquitectura V1, pero solo se activa públicamente después de superar el banco de casos y el benchmark. Esta validación es control de calidad interno, no una versión “a medias” para el usuario.

### Salida V1

- una tarjeta principal;
- hasta dos secundarias;
- máximo una por familia;
- evidencia desplegable;
- estado de aprendizaje para historiales menores a 5;
- templates controlados con variantes;
- memoria de repetición por jugador.

### Por qué este alcance

Ataca el problema principal —la falta de contexto personal— con un núcleo autónomo y auditable. Nivel y Ranking suman contexto cuando sus datos están disponibles. La IA mejora cómo se expresa la selección, pero nunca determina si BRAMU entiende o no el partido.

---

## 15. Validación de producto

### 15.1 Banco de casos antes de desarrollo

Crear un set de al menos 100 historias sintéticas y reales anonimizadas, incluyendo:

- poco y mucho historial;
- carga desordenada por fecha;
- jugadores con nombres repetidos;
- partidos editados o eliminados;
- formatos estándar y match tie-break;
- rachas y cortes;
- compañeros variables;
- rivales habituales;
- resultados sin nada excepcional;
- partidos pendientes, rechazados, casuales y de espectador;
- Nivel calibrado y no calibrado cuando corresponda.

Cada caso debe tener:

- candidatos esperados;
- candidatos prohibidos;
- insight principal esperado;
- evidencia exacta;
- redacciones inaceptables.

### 15.2 Métricas de calidad

| Métrica | Objetivo inicial |
|---|---:|
| Precisión factual | 100% en banco de casos |
| Claims sin evidencia | 0 |
| Números/nombres incorrectos | 0 |
| Duplicación semántica dentro del bloque | <2% |
| Misma familia como principal en 3 partidos seguidos | <10%, salvo racha excepcional |
| Insights considerados útiles por usuarios | >70% |
| Casos donde usuarios sienten que “inventó” | <3%, objetivo final 0 |
| Longitud principal | 12–24 palabras de cuerpo |
| Cantidad media | 1,5–2 insights por partido |

### 15.3 Prueba con usuarios

Mostrar el insight junto al historial real del jugador y preguntar solo:

- “¿Te contó algo que no era obvio mirando el resultado?”
- “¿Sentís que esto está respaldado por tus partidos?”
- “¿Hay alguna frase que parezca inventar cómo jugaste?”

La validación debe hacerse con historias reales. Evaluar frases aisladas produce una falsa sensación de calidad porque no permite detectar repetición ni comparaciones irrelevantes.

---

## 16. Estado final de producto

### Decisiones cerradas para V1

- BRAMU Intelligence es un motor selectivo de interpretación personal.
- El historial es el principal multiplicador de valor del modo manual.
- La salida es adaptativa: 1 principal + 0–2 secundarias.
- No se fuerza cantidad ni narrativa.
- Cada insight conserva evidencia, alcance y confianza.
- Los detectores, elegibilidad, puntaje y prioridad se resuelven por reglas en V1.
- La diversidad se controla semánticamente, no solo con sinónimos.
- La carga manual no habilita técnica, causalidad ni emociones.
- La perspectiva es individual, pero el desempeño observado sigue siendo de la pareja.
- La fecha jugada, la identidad estable y el tipo de set son datos críticos.
- Historia personal y oficial deben permanecer separadas.
- Nivel BRAMU V1.4 entra mediante snapshots de expectativa, confiabilidad, delta y códigos de razón.
- Ranking BRAMU entra solo para hitos materiales, sin confundir puesto con capacidad.
- La IA generativa se aprueba como capa de redacción activable, siempre con plantilla completa de respaldo.
- Cloudflare/Qwen es el primer proveedor a evaluar y Groq/GPT-OSS el reemplazo previsto.
- Apagar la IA no elimina BRAMU Intelligence ni requiere rediseñar el producto.

### Pendientes de implementación y validación, no de producto

- construir el backend y los snapshots definidos por Nivel y Ranking;
- implementar el motor determinístico y su banco mínimo de 100 casos;
- probar los umbrales V1 con distribución real de scores;
- comparar a ciegas plantilla, Cloudflare/Qwen y Groq/GPT-OSS;
- terminar el ajuste visual del bloque dentro de la pantalla existente;
- revisar política de privacidad y transferencias internacionales antes de enviar datos reales a un proveedor.

No queda una decisión funcional bloqueante que requiera respuesta del usuario antes del handoff. Los parámetros quedan versionados para que el piloto pueda validarlos sin reabrir el concepto del producto.

---

## 17. Conclusión

El límite del partido manual no se resuelve simulando que BRAMU vio más. Se resuelve usando mejor lo que sí sabe.

Un score aislado permite describir estructura. Un score vinculado a identidades, fechas, relaciones e historia permite detectar hitos, quiebres de tendencia, primeras veces, cruces relevantes, rachas y resultados excepcionales. Nivel BRAMU V1.4 suma expectativa e impacto; Ranking BRAMU agrega únicamente hitos materiales. Esa progresión vuelve la devolución más personal con cada partido sin traicionar la evidencia.

La ventaja competitiva de BRAMU Intelligence no debería ser “escribe como una IA”. Debería ser:

> Siempre encuentra lo más significativo que tus datos permiten decir, y sabe cuándo no decir más.

---

## Fuentes

[^1]: BRAMU Lab. *BRAMU Intelligence — Consolidado base para investigación*. Documento interno, 2026.
[^2]: Strava. [“Athlete Intelligence on Strava”](https://support.strava.com/), actualizado en 2026; Strava Newsroom, [“Strava's Athlete Intelligence Translates Workout Data into Simple and Personalized Insights”](https://press.strava.com/), 3 de octubre de 2024.
[^3]: Oura. [“Using Trends”](https://support.ouraring.com/), Oura Member Care, actualizado en 2026.
[^4]: Garmin. [“What Is the Insights Feature in Garmin Connect?”](https://support.garmin.com/), Garmin Support, consultado en septiembre de 2026.
[^5]: Playtomic. [“How the Playtomic level system works”](https://playerhelp.playtomic.com/hc/en-gb/articles/43310980754193-How-the-Playtomic-level-system-works), actualizado el 9 de junio de 2026.
[^6]: UTR Sports. [“How UTR Rating Works”](https://www.utrsports.net/pages/how-utr-works), consultado en septiembre de 2026; UTR Sports Support, [“Understanding the Algorithm — Complete Summary”](https://support.universaltennis.com/), 2026.
[^7]: SwingVision. [“Track Your Tennis & Pickleball Matches with SwingVision”](https://swing.vision/), consultado en septiembre de 2026.
[^8]: Sujay Shalawadi, Joel Wester, Samuel Rhys Cox y Niels van Berkel. [“Who Gets to Interpret the Workout? User Tensions with AI-Generated Fitness Feedback”](https://arxiv.org/abs/2604.23830), 2026.
[^9]: Danqing Shi, Xinyue Xu, Fuling Sun, Yang Shi y Nan Cao. [“Calliope: Automatic Visual Data Story Generation from a Spreadsheet”](https://arxiv.org/abs/2010.09975), 2020.
[^10]: Brent Winslow et al. [“A Principle-based Framework for the Development and Evaluation of Large Language Models for Health and Wellness”](https://arxiv.org/abs/2512.08936), 2025.
[^11]: BRAMU Lab. `Nivel_BRAMU_Formula_V1.4.md`. Documento normativo interno, 10 de septiembre de 2026.
[^12]: BRAMU Lab. `BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md`. Evaluación interna de proveedores, costos, privacidad y arquitectura, septiembre de 2026.
[^13]: BRAMU Lab. `Ranking_BRAMU.md`. Definición V1 cerrada, 11 de septiembre de 2026.
