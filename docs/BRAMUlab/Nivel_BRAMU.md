# Nivel BRAMU — Consolidado base de definición de producto

**Estado:** contexto funcional vigente. El motor y el estimador inicial están cerrados para el lanzamiento inicial en `Nivel_BRAMU_Formula_V1.5.md`.

**Nota de precedencia:** `Nivel_BRAMU_Formula_V1.5.md` reemplaza a V1.4 como fuente normativa. Conserva `nivel_bramu_v1_0` para el motor de partidos e incorpora `nivel_inicial_v1_2` para el cuestionario universal (sin ajuste por categoría local en el alta). Toda mención histórica a parámetros pendientes, pesos 30/15/10/10/15/10/10 o ajuste manual ±0,5 queda superada por V1.5.

**Fecha de consolidación:** 10 de septiembre de 2026.  
**Actualización UX:** 18 de septiembre de 2026 — se explicita la progresión temprana de Mi Perfil y Perfil público sin modificar fórmula, estados ni criterios de calibración.

## 1. Propósito

El Nivel BRAMU es la estimación individual de capacidad competitiva de cada jugador dentro de BRAMU Lab.

Debe servir para:

- representar el nivel actual del jugador con una escala común;
- facilitar comparaciones razonables entre jugadores;
- aportar contexto a partidos, perfiles, grupos, rankings y BRAMU Intelligence;
- evolucionar a partir de partidos reales y validados;
- expresar no solo qué nivel estima BRAMU, sino también cuánta evidencia sostiene esa estimación.

El Nivel BRAMU no es lo mismo que el Ranking BRAMU:

- **Nivel BRAMU:** capacidad estimada individual. Es universal y acompaña al jugador.
- **Ranking BRAMU:** posición relativa dentro de un universo filtrado por territorio, categoría u otros criterios.

Un jugador puede conservar su nivel y cambiar de posición en el ranking aunque no haya jugado, porque otros jugadores pueden superarlo.

## 2. Principios rectores

1. **Mayor número significa mejor nivel.**
2. **El nivel pertenece al jugador, no a la pareja.**
3. **Todo nivel inicial es una estimación, no una verdad.**
4. **Nivel y confiabilidad son conceptos separados.**
5. **Los partidos validados son la principal fuente de evidencia.**
6. **El usuario puede participar de la estimación, pero no editar libremente un nivel consolidado.**
7. **El historial nunca se borra por recalibrar.**
8. **Cada variación debe poder explicarse con datos reales.**
9. **El sistema no debe premiar la repetición artificial de rivales fáciles.**
10. **BRAMU nunca debe presentar como observado algo que solamente fue declarado en un cuestionario.**

## 3. Escala y precisión

- Escala pública propuesta: **1,0 a 10,0**.
- Dirección: cuanto más alto, mejor.
- Presentación habitual: **un decimal** para evitar falsa precisión.
- Cálculo interno: hasta **cuatro decimales**.
- Ordenamiento de rankings y cálculos: utiliza el valor interno, no el redondeo visible.
- No mostrar variaciones `+0,0` o `−0,0`.

Categorías de comunicación vigentes:

| Nivel | Categoría |
|---:|---|
| 1,0–2,4 | Iniciación |
| 2,5–3,9 | Recreativo |
| 4,0–4,9 | Intermedio |
| 5,0–6,3 | Intermedio alto |
| 6,4–7,9 | Avanzado |
| 8,0–10,0 | Profesional |

La relación entre número, categoría descriptiva y categorías competitivas reales deberá validarse con jugadores de distintos niveles antes del lanzamiento. La categoría declarada por el usuario no reemplaza al Nivel BRAMU.

## 4. Estados del nivel

### 4.1 Sin estimación

La persona todavía no completó el cuestionario inicial.

- No tiene Nivel BRAMU visible.
- Debe mostrarse una invitación clara a completar la evaluación.
- Sus partidos pueden guardarse, pero el sistema todavía no puede contextualizarlos mediante nivel.

### 4.2 Calibrando

Comienza al confirmar el cuestionario inicial.

- Se muestra inmediatamente un **Nivel BRAMU estimado**.
- Se identifica siempre con la etiqueta **CALIBRANDO**.
- Se muestra el progreso `X / 5 PARTIDOS`.
- El nivel puede variar con mayor sensibilidad porque existe poca evidencia.
- El estado público debe diferenciarse visualmente mediante color ámbar/naranja, etiqueta e icono. El color nunca debe ser la única señal.

Ejemplo:

> **Nivel BRAMU estimado: 4,5**  
> CALIBRANDO · 0 / 5 PARTIDOS  
> Este es tu punto de partida. Puede variar mientras BRAMU te conoce.

### 4.3 Calibrado

Se alcanza cuando existen:

- **5 partidos computables**, y
- al menos **3 rivales diferentes** dentro de esos partidos.

Al completarse:

- el nivel deja de presentarse como estimado;
- aparece como **NIVEL CALIBRADO**;
- se utiliza color lima/verde BRAMU y un check;
- las variaciones futuras son más estables que durante la calibración.

“Calibrado” significa que existe evidencia mínima suficiente. No significa que el nivel sea permanente ni infalible.

### 4.4 Recalibrando

Estado temporal iniciado voluntariamente por un jugador que considera que su nivel dejó de representarlo.

- Conserva íntegramente historial, eventos y nivel consolidado anterior.
- No transforma las nuevas respuestas en una verdad automática.
- Abre un período de sensibilidad controlada para que resultados posteriores confirmen o corrijan la nueva referencia.
- El detalle del nivel puede mostrar la nueva referencia provisional.
- Rankings y comparaciones oficiales continúan utilizando el último nivel consolidado hasta completar la recalibración.

La cantidad exacta de partidos requerida para cerrar una recalibración deberá probarse. Recomendación inicial: **3 partidos computables frente a al menos 2 rivales diferentes**.

## 5. Cuestionario inicial

### 5.1 Experiencia

El onboarding debe ofrecer dos caminos:

- **Estimación rápida:** elección de una descripción general de nivel.
- **Evaluación completa:** cuestionario corto, de una respuesta por pantalla y aproximadamente dos minutos.

La evaluación completa es la recomendada, pero no debe convertirse en una barrera de entrada.

### 5.2 Dimensiones del cuestionario completo

1. Autoevaluación general.
2. Tiempo practicando pádel.
3. Formación o clases recibidas.
4. Frecuencia reciente de juego.
5. Experiencia competitiva.
6. Desempeño declarado en la red.
7. Lectura y uso declarado de rebotes.

La capacidad inicial se estima principalmente mediante autoevaluación, red y paredes. La formación aporta una corrección mínima. Tiempo jugando y frecuencia reciente sirven para estimar cuán informada y vigente es la respuesta, pero no suben directamente el nivel: jugar hace muchos años o jugar muchas veces por semana no implica jugar mejor.

La experiencia competitiva describe el rendimiento dentro de la categoría habitual. La categoría concreta se pregunta al final y solo se utiliza cuando existe un mapa local compatible y versionado.

Las preguntas técnicas deben ser pocas y discriminantes. El cuestionario no intenta observar toda la técnica del jugador.

### 5.3 Resultado y participación del jugador

Al terminar:

1. BRAMU calcula y muestra una estimación previa.
2. Formula una última pregunta neutral: **¿En qué categoría suelen ser parejos tus partidos?**
3. No destaca ni recomienda una categoría.
4. Si existe un mapa compatible, aplica automáticamente una corrección máxima de **±0,5**.
5. Muestra **Tu punto de partida en BRAMU**, número y categoría descriptiva.
6. El jugador confirma o revisa respuestas y comienza el estado CALIBRANDO.

No existe un stepper para mover libremente el número. Deben guardarse separadamente:

- resultado base del cuestionario;
- categoría y contexto declarados;
- categoría local fuera del cálculo inicial; queda como contexto competitivo posterior;
- resultado inicial confirmado;
- `questionnaire_version = nivel_inicial_v1_2`;
- confianza de origen y bandera de coherencia;
- fecha y hora de confirmación.

Las respuestas sirven para estimar el punto de partida. Nunca autorizan a BRAMU Intelligence a afirmar que una volea, un rebote, un smash u otra acción técnica ocurrió en un partido.

## 6. Recalibración autoservicio

### 6.1 Disponibilidad

- Disponible como máximo **una vez cada 90 días corridos**.
- El plazo comienza en la fecha de confirmación de la última calibración o recalibración.
- No existe atención manual al cliente como parte de la primera versión.
- La opción debe ubicarse de forma secundaria y discreta en `Perfil > Mis datos > Nivel BRAMU > Recalibrar nivel`.
- No debe mostrarse como CTA promocional ni como acción frecuente.
- Antes de comenzar debe verse la próxima fecha disponible.

### 6.2 Funcionamiento recomendado

1. Explicar que la recalibración no borra partidos ni garantiza una suba.
2. Repetir el cuestionario completo vigente.
3. Confirmar o actualizar la categoría contextual.
4. Mostrar la referencia universal calculada y permitir confirmarla o revisar respuestas.
5. Cambiar el estado a RECALIBRANDO.
6. Dar mayor sensibilidad temporal a los próximos partidos computables.
7. Consolidar el nuevo nivel solamente después de obtener evidencia de juego.

El cuestionario de recalibración no debe reemplazar instantáneamente el nivel utilizado en rankings. Esto evita que una persona gane posición contestando estratégicamente cada 90 días.

### 6.3 Límites contra abuso

- Cooldown obligatorio de 90 días.
- Sin reinicio anticipado aunque el jugador abandone el flujo después de confirmarlo.
- Historial completo y procedencia visibles para el sistema.
- El nivel anterior queda preservado como evento.
- No se pueden encadenar recalibraciones.
- Los partidos disputados durante la recalibración siguen sujetos a validación y diversidad de rivales.
- El algoritmo puede ignorar patrones anómalos o resultados repetidos contra el mismo grupo, sin acusar públicamente al jugador.

## 7. Partidos computables

Un partido puede existir en el historial sin modificar el Nivel BRAMU.

Para computar debe cumplir todas estas condiciones:

- formato de dobles: dos parejas y cuatro participantes;
- el jugador evaluado participó realmente;
- resultado final válido por sets, incluido el tie-break cuando corresponda;
- fecha real del partido;
- al menos un usuario registrado por pareja;
- resultado validado por, como mínimo, un usuario registrado de la pareja rival;
- estado oficial/validado;
- haber sido cargado por uno de los participantes registrados del encuentro;
- no estar disputado, anulado ni pendiente;
- no ser un duplicado del mismo encuentro.

### 7.1 Invitados

- Puede cargarse un compañero o rival sin cuenta.
- El invitado queda como participación pendiente de reclamar.
- Debe existir un plazo de **30 días** para vincular esa participación con una cuenta real.
- Si al vencer el plazo no se cumple el mínimo de un usuario registrado por pareja, el partido permanece en el historial pero no computa para Nivel BRAMU ni Ranking BRAMU.
- La asociación futura nunca se realiza por simple coincidencia de nombre; requiere una acción explícita.

### 7.2 Datos que pueden afectar el nivel

- identidad de los cuatro participantes;
- nivel y confiabilidad de cada jugador al momento del partido;
- composición de las parejas;
- ganador y perdedor;
- resultado por sets;
- games ganados y perdidos;
- formato y sistema de puntuación;
- fecha real;
- estado de validación;
- repetición reciente de compañeros y rivales.

BRAMUlab V1 trabaja con la carga posterior del resultado del partido propio. No registra puntos, quiebres, winners, errores ni eventos en vivo dentro de esta aplicación. El Nivel no exige esos datos adicionales: el resultado estructurado disponible debe ser suficiente para aplicar el motor vigente.

## 8. Criterios de cálculo ya decididos

*(Superado por `Nivel_BRAMU_Formula_V1.5.md` — la frase siguiente es contenido histórico: la fórmula exacta ya fue diseñada, simulada y cerrada para V1. Ver ese documento para la fórmula real.)*
~~La fórmula exacta todavía debe diseñarse y simularse.~~ Estos comportamientos sí quedan fijados:

### 8.1 Fuerza del partido

- La fuerza de cada pareja surge de los niveles individuales de sus integrantes.
- No debe utilizarse un promedio ingenuo como única señal: la diferencia interna entre compañeros también puede ser relevante.
- La variación final pertenece a cada jugador y puede ser distinta de la de su compañero por nivel previo y confiabilidad.

### 8.2 Resultado y dificultad

- Ganar frente a rivales más fuertes debe aportar más que ganar frente a rivales más débiles.
- Ganar un partido que el sistema esperaba con claridad debe aportar poco o incluso mantener el nivel.
- Una derrota puede reducir o mantener el nivel, pero no subirlo por tratarse de una “buena derrota”.
- Perder frente a rivales muy superiores debe tener un impacto atenuado.
- El margen por sets y games puede modular la magnitud, siempre dentro de límites para evitar cambios desproporcionados.
- Un score amplio no autoriza inferencias técnicas o emocionales.

### 8.3 Repetición

- Repetir victorias contra los mismos rivales débiles produce rendimiento decreciente.
- La diversidad de rivales aumenta la calidad de la evidencia.
- Jugar repetidamente con el mismo compañero no invalida los partidos, pero ofrece menos información para separar el aporte estimado de cada integrante.

### 8.4 Confiabilidad

- Con baja confiabilidad, el nivel puede moverse más.
- Con alta confiabilidad, necesita evidencia más consistente para cambiar en la misma magnitud.
- La confiabilidad crece con partidos válidos, diversidad de rivales y continuidad.
- La confiabilidad disminuye gradualmente con inactividad; el nivel no baja por no jugar.
- Después de aproximadamente 60–90 días sin actividad debe mostrarse una advertencia suave y aumentar la sensibilidad de los próximos resultados.

### 8.5 Momento de actualización

Recomendación para primera versión: actualizar inmediatamente cuando el partido alcanza estado validado. La explicación causal es más comprensible si aparece vinculada al partido que produjo el cambio.

## 9. UX y representación visual

### 9.1 Sistema visual de estados

| Estado | Tratamiento principal | Señal textual |
|---|---|---|
| Sin estimación | Neutro | Completá tu evaluación |
| Calibrando | Ámbar/naranja + progreso | CALIBRANDO · X/5 |
| Calibrado | Lima BRAMU + check | NIVEL CALIBRADO |
| Recalibrando | Ámbar diferenciado + icono de actualización | RECALIBRANDO |
| Confiabilidad afectada por inactividad | Tono atenuado + aviso | Volvé a jugar para actualizar tu nivel |

El color debe acompañar, nunca reemplazar, texto e iconografía accesible.

### 9.2 Superficies

**Onboarding**

- cuestionario rápido o completo;
- devolución inmediata;
- sin pregunta final de categoría ni ajuste local en el onboarding inicial;
- sin edición libre del número;
- explicación breve de calibración.

**Home / Player Card**

- nivel visible;
- estado;
- progreso de calibración cuando corresponda;
- sin explicación extensa.

**Perfil propio**

- siempre puede mostrar identidad, Nivel actual y estado;
- con 0 partidos oficiales: Nivel estimado + `CALIBRANDO · 0/5`, sin Evolución vacía, Efectividad vacía, compañeros/rivales vacíos ni gráficos sin evidencia;
- los partidos pendientes pueden existir en Historial/partido, pero no alimentan estadísticas oficiales del Perfil;
- a medida que aparecen partidos oficiales, los módulos se incorporan progresivamente cuando tienen datos legítimos;
- estado y confiabilidad;
- evolución cuando exista evidencia suficiente;
- partidos que sostienen la estimación cuando existan;
- explicación de variaciones cuando haya una variación real;
- acceso secundario a recalibración.

**Perfil público**

- nivel visible;
- estado `CALIBRANDO` o check de calibración;
- con 0 partidos oficiales: identidad + Nivel estimado/estado, sin estadísticas agregadas, evolución ni módulos vacíos;
- no exponer respuestas del cuestionario;
- incorporar información deportiva progresivamente solo cuando exista evidencia oficial suficiente;
- nunca inventar posición de Ranking: si todavía no corresponde, usar el estado definido por `Ranking_BRAMU.md`.

Criterio común para ambos perfiles:

> **Perfil también se construye con evidencia real.**

**Ranking**

- utilizar el nivel consolidado como dato de orden;
- identificar visualmente a quienes siguen calibrando;
- evitar que una estimación inicial parezca equivalente a un nivel con mucha evidencia;
- definir por separado si una persona aún calibrando participa de posiciones oficiales.

## 10. Explicación de variaciones

BRAMU no necesita revelar la fórmula completa, pero sí el motivo principal de cada cambio.

Ejemplos válidos:

> Tu nivel subió porque vencieron a una pareja de mayor Nivel BRAMU promedio. El impacto fue mayor porque todavía estás calibrando.

> Tu nivel se mantuvo: era un resultado esperable frente a esta pareja y ya existe bastante evidencia sobre tu nivel.

> La derrota tuvo un impacto reducido porque la pareja rival tenía una dificultad claramente superior.

Evitar:

- “Jugaste mejor de lo esperado”.
- “Te sobrepusiste mentalmente”.
- “Tu volea fue determinante”.
- “BRAMU pensaba que ibas a perder”.

Las explicaciones deben ser deportivas, claras y neutrales. No deben sonar como juicio sobre la identidad del jugador.

## 11. Integración con BRAMU Intelligence

BRAMU Intelligence puede utilizar el Nivel BRAMU para contextualizar un partido solamente cuando existan niveles y snapshots válidos.

Ejemplos recomendados:

> **Triunfo de alto valor**  
> Superaron a una pareja con mayor Nivel BRAMU promedio.

> **Respondieron ante un desafío mayor**  
> Es su mejor resultado juntos frente a rivales de esta dificultad.

> **Impacto reducido**  
> La diferencia de nivel previa atenúa el efecto de esta derrota.

Reglas:

- utilizar lenguaje factual y no humillante;
- no decir que BRAMU “esperaba que perdieras”;
- no usar respuestas técnicas del cuestionario como evidencia de un partido;
- no narrar punto a punto cuando solo existe resultado por sets;
- no forzar una lectura de nivel si existe una conclusión histórica más interesante;
- si los niveles todavía son poco confiables, explicitarlo o reducir la fuerza de la afirmación.

## 12. Relación con Ranking BRAMU

El Nivel BRAMU será una entrada del Ranking BRAMU, pero no lo reemplaza.

Dirección ya definida para Ranking:

- vistas nacional, provincial, ciudad/local y Mis jugadores;
- acceso al perfil público desde cada jugador;
- categorías competitivas como filtro;
- desempates mediante criterios adicionales, entre ellos efectividad, a definir en el consolidado específico de Ranking;
- ninguna persona administra o elimina manualmente jugadores del ranking general.

La fórmula de puntos de ranking debe permanecer separada del algoritmo de nivel.

## 13. Contrato mínimo para backend

La infraestructura debe quedar preparada desde el inicio para conservar:

### 13.1 Estado actual del jugador

- valor interno del Nivel BRAMU;
- valor público redondeado;
- estado: sin estimación, calibrando, calibrado o recalibrando;
- confiabilidad interna;
- cantidad de partidos computables;
- cantidad de rivales diferentes;
- fecha de última actividad computable;
- fecha de última calibración/recalibración;
- próxima fecha habilitada para recalibrar;
- versión vigente del algoritmo.

### 13.2 Cuestionarios

- versión del cuestionario;
- respuestas;
- cálculo bruto;
- ajuste del usuario;
- resultado confirmado;
- tipo: inicial o recalibración;
- fecha y hora.

### 13.3 Historial de nivel

Cada modificación debe ser un evento inmutable con:

- nivel anterior y nuevo;
- confiabilidad anterior y nueva;
- causa principal;
- partido o recalibración de origen;
- fecha;
- versión del algoritmo;
- procedencia automática o iniciada por el jugador.

### 13.4 Snapshot por partido

Al validarse un partido deben conservarse el nivel y la confiabilidad de los cuatro jugadores en ese momento.

Este snapshot es obligatorio. Evita reinterpretar partidos antiguos con los niveles actuales y permite que BRAMU Intelligence explique qué significó realmente el encuentro cuando ocurrió.

## 14. Benchmark Playtomic: aprendizajes incorporados

Referencias visuales guardadas en:

`/Otros Trabajos/BRAMUlab/BRAMUlab/Referencias/Benchmark/Playtomic`

Principios adoptados:

- doble camino rápido/completo;
- cuestionario breve;
- resultado inmediato;
- participación mediante categoría contextual y revisión de respuestas;
- corrección automática limitada a ±0,5;
- separación entre nivel y confiabilidad;
- evolución posterior mediante partidos;
- explicación accesible de variaciones;
- trazabilidad de ajustes.

Aspectos que BRAMU adapta:

- no usar edad como predictor de habilidad;
- evitar precisión pública excesiva durante la estimación inicial;
- no depender de soporte manual;
- no permitir que una recalibración autoservicio reemplace evidencia consolidada;
- separar claramente nivel, ranking, matchmaking e Intelligence.

No se incorpora matchmaking en la primera etapa. Solo tendrá sentido cuando exista suficiente densidad real de jugadores por ubicación, horario y nivel.

## 15. Decisiones cerradas en este documento

- Escala 1,0–10,0; mayor es mejor.
- Nivel individual, distinto de ranking.
- Mostrar inmediatamente el nivel estimado tras el cuestionario.
- Etiqueta CALIBRANDO y tratamiento ámbar/naranja.
- Cinco partidos computables y tres rivales diferentes para calibración inicial.
- Check y tratamiento lima/verde al calibrar.
- Cuestionario rápido o completo.
- Cuestionario completo sin edad y con frecuencia reciente.
- Ajuste inicial único de ±0,5.
- Recalibración autoservicio cada 90 días como máximo.
- Acceso a recalibración secundario dentro de Perfil/Mis datos.
- Recalibrar no borra historial ni altera instantáneamente el ranking.
- Un usuario registrado por pareja y validación rival para computar.
- La carga dentro de BRAMUlab corresponde siempre a un partido propio ya jugado; no existen partidos cargados por espectadores como fuente del Nivel.
- Invitados reclamables durante 30 días.
- Resultado por sets y games como evidencia suficiente.
- Los datos punto a punto no dan ventaja matemática para nivel.
- Diversidad de rivales y rendimiento decreciente por repetición.
- Inactividad reduce confiabilidad, no nivel.
- Guardar snapshots históricos de nivel y confiabilidad.
- BRAMU Intelligence puede interpretar dificultad, pero nunca inventar acciones técnicas.
- Mi Perfil y Perfil público se forman progresivamente y no muestran módulos estadísticos vacíos por falta de evidencia.
- Los partidos pendientes pueden ser visibles como actividad, pero no alimentan estadísticas oficiales de Perfil hasta validarse.

## 16. Parámetros todavía pendientes de simulación *(superado por `Nivel_BRAMU_Formula_V1.5.md`)*

**Nota vigente:** esta sección completa es contenido histórico. Los parámetros del motor quedaron resueltos en V1.4 y la estimación inicial fue corregida en `Nivel_BRAMU_Formula_V1.5.md`. Se conserva la lista para trazabilidad, no como trabajo pendiente.

No son dudas conceptuales; requieren diseñar la fórmula y probarla con casos sintéticos y datos reales:

1. límites exactos de cada categoría descriptiva dentro de 1,0–10,0;
2. pesos de cada respuesta del cuestionario;
3. composición matemática de la fuerza de pareja;
4. magnitud base de una variación;
5. topes por partido y por período;
6. peso limitado de sets y games;
7. curva de confiabilidad;
8. penalización decreciente por repetición;
9. sensibilidad exacta tras inactividad;
10. cantidad definitiva de partidos para cerrar una recalibración;
11. participación o no de jugadores CALIBRANDO en rankings oficiales;
12. mapeo entre Nivel BRAMU y categorías competitivas reales.

Estos parámetros deben resolverse mediante simulación antes de desarrollo, sin reabrir las decisiones de producto ya cerradas.

## 17. Próximo paso recomendado *(superado por `Nivel_BRAMU_Formula_V1.5.md` y `Nivel_BRAMU_Implementacion.md`)*

**Nota vigente:** los pasos siguientes describían el camino hacia una fórmula todavía no diseñada. Ese camino ya se recorrió; la fuente normativa actual es `Nivel_BRAMU_Formula_V1.5.md` y la próxima tarea técnica está definida en `Nivel_BRAMU_Implementacion.md`.

1. Revisar este consolidado como fuente única de definición del Nivel BRAMU.
2. Cruzar el contrato de datos con el consolidado de backend V04.
3. Crear una batería de perfiles y partidos sintéticos representativos.
4. Diseñar y comparar variantes matemáticas contra los comportamientos fijados.
5. Validar la escala con jugadores reales de categorías diferentes.
6. Recién entonces convertir la fórmula elegida en especificación técnica para desarrollo.
