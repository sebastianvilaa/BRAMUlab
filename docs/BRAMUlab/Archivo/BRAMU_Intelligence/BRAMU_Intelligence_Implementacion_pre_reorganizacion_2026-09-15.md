# BRAMU Intelligence V1 — Handoff para desarrollo

**Estado:** definición funcional cerrada para V1  
**Alcance:** Intelligence posterior a partidos cargados manualmente / ya jugados  
**Fuera de alcance:** rediseño del análisis punto a punto o del registro en vivo  
**Fecha:** 11 de septiembre de 2026

## 1. Decisión de producto

BRAMU Intelligence V1 está suficientemente definido para comenzar desarrollo.

El sistema debe ser un **motor selectivo de interpretación personal**. Su trabajo es encontrar qué significa un partido dentro de la historia registrada del jugador, no narrar acciones que BRAMU no observó.

La arquitectura queda cerrada así:

1. BRAMU calcula hechos verificables.
2. BRAMU determina qué comparaciones son válidas.
3. BRAMU puntúa y selecciona los insights relevantes.
4. Las plantillas producen una salida completa y siempre disponible.
5. Una capa generativa opcional puede mejorar la redacción de los mismos claims.
6. Un validador aprueba el texto generativo o usa automáticamente la plantilla.
7. El resultado se guarda y no se regenera al abrir una pantalla.

La IA no decide resultados, hechos, Nivel, Ranking ni prioridad. Puede estar activa por defecto después de superar las pruebas internas, pero BRAMU no depende de ella para funcionar.

## 2. Documentos fuente y precedencia

Desarrollo debe usar, en este orden:

1. `BRAMU_Intelligence.md`: definición normativa del producto, evidencia, taxonomía, prioridades, UX y ejemplos.
2. `Nivel_BRAMU_Formula_V1.4.md`: única autoridad para nivel, expectativa, confianza, elegibilidad, snapshots y delta.
3. `Ranking_BRAMU.md`: única autoridad para posición, universo, densidad, actividad y movimiento.
4. `BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md`: proveedor, privacidad, costos, validación y contingencia de la capa generativa.

Si aparece una contradicción, no rediseñarla desde desarrollo. Registrar el caso y resolverlo antes de programar esa parte.

## 3. Reglas no negociables

- Cada frase visible debe derivar de claims estructurados y evidencia recuperable.
- La fecha de juego, no la fecha de carga, ordena la historia.
- La identidad estable de participantes es obligatoria para relaciones históricas.
- Historia personal e historia oficial son alcances distintos.
- Un partido no computable puede generar contexto personal, pero nunca impacto oficial de Nivel o Ranking.
- La perspectiva es individual; el resultado observado pertenece a la pareja.
- No se atribuye el resultado a un integrante sin evidencia adicional.
- No se inventan puntos, games internos, quiebres, golpes, técnica, táctica, emociones ni causas.
- No se fuerza un insight si ningún candidato supera el umbral.
- El usuario nunca ve un error de proveedor generativo.

## 4. Datos mínimos de entrada

Por partido:

- identificador estable;
- fecha real de juego y fecha de carga separadas;
- perspectiva del jugador;
- identidades de los cuatro participantes o invitados diferenciados;
- composición exacta de las parejas;
- ganador;
- orden, resultado y tipo de cada set;
- formato del partido;
- modo de registro;
- origen de la carga;
- estado de validación;
- elegibilidad separada para historia personal, Nivel y Ranking.

Cuando corresponda, consumir sin recalcular:

- snapshots prepartido de Nivel y confianza;
- fuerza previa de ambas parejas;
- expectativa previa;
- delta posterior y códigos de razón;
- posición de Ranking anterior y posterior;
- universo, denominador y estado de densidad.

## 5. Objeto mínimo de insight

Cada candidato debe conservar:

- tipo y familia;
- jugador de perspectiva;
- claim estructurado;
- valores usados en la frase;
- partidos fuente;
- alcance de comparación;
- tamaño de muestra;
- nivel de confianza;
- alcance personal u oficial;
- puntaje de relevancia;
- clave semántica;
- plantilla elegida;
- versión de reglas;
- fecha de corte;
- estado: candidato, descartado, seleccionado, generado o fallback;
- motivo de descarte o fallback cuando corresponda.

La frase visible es una representación del objeto, nunca la fuente de verdad.

## 6. Detectores V1

Implementar:

1. reversión después de perder el primer set;
2. rachas de victorias y derrotas desde 3, récords y cortes;
3. forma de últimos 5, con últimos 10 solo como contraste;
4. primer partido, primera victoria y balance con compañero;
5. primer cruce y balance frente a cada rival o pareja rival exacta;
6. primer triunfo luego de al menos 2 derrotas dentro del mismo alcance;
7. hitos acumulativos y récords con muestra suficiente;
8. score excepcional dentro de partidos de formato comparable;
9. expectativa, calibración, evidencia y variación de Nivel BRAMU;
10. hitos materiales de Ranking BRAMU.

No incluir recomendaciones técnicas, explicaciones causales, comparaciones poblacionales ni campos manuales obligatorios adicionales.

## 7. Selección editorial V1

Puntaje sobre 100:

| Factor | Peso |
|---|---:|
| Cambio o excepcionalidad | 25 |
| Relevancia personal | 20 |
| Especificidad relacional | 15 |
| Confianza de evidencia | 20 |
| Actualidad narrativa | 10 |
| Novedad editorial | 10 |

Penalizaciones:

- `−30` por repetir el score visible sin comparación;
- `−20` si otro seleccionado cuenta la misma historia;
- `−15` si la misma familia fue principal en los últimos 2 partidos;
- `−10` si repite la misma estructura textual de los últimos 5;
- descarte total si falla evidencia, identidad, comparabilidad u oficialidad requerida.

Algoritmo:

1. generar candidatos;
2. validar elegibilidad y evidencia;
3. calcular puntaje;
4. descartar todo valor menor a 55;
5. ordenar por puntaje, prioridad editorial e identificador estable;
6. elegir un principal;
7. agregar hasta dos secundarios de familias e historias distintas;
8. aplicar cooldowns;
9. guardar selección y descartes;
10. si no existe candidato, mostrar aprendizaje o lectura mínima del score.

Salida máxima: **un principal y dos secundarios**. No se completan espacios vacíos.

## 8. Prioridad editorial

1. hito excepcional o quiebre de tendencia;
2. resultado frente a expectativa confiable de Nivel;
3. récord o mejor marca personal;
4. historia con compañero, rival o cruce;
5. racha o cambio material de forma;
6. patrón histórico del score;
7. lectura particular del resultado;
8. descripción genérica del score.

## 9. Reglas de Nivel BRAMU

Intelligence usa exclusivamente la expectativa prepartido guardada por Nivel V1.4.

- Hasta 35% y cuatro niveles con confianza mínima 0,60: puede generar “por encima de la expectativa”.
- De 36% a 44% con la misma evidencia: puede decir que la pareja partía por debajo; necesita otro hecho para ser principal.
- De 45% a 55%: no produce insight de expectativa.
- Desde 65%: solo puede explicar un delta pequeño por resultado favorable esperado.
- Con tres niveles conocidos: lenguaje acotado y sin “sorpresa”.
- Con dos niveles o jugadores calibrando: no clasificar dificultad.
- No mostrar porcentajes en la tarjeta principal.
- No recalcular expectativa con niveles actuales.
- No convertir margen de games en performance esperada no calculada por Nivel V1.4.

## 10. Reglas de Ranking BRAMU

Un cambio puede aparecer solo cuando el universo está establecido —15 o más elegibles— y ocurre al procesar el evento actual.

Casos habilitados:

- primera entrada al ranking establecido;
- entrada al top 10;
- nueva mejor posición con mejora mínima de 3 puestos;
- ascenso de al menos `máximo entre 3 puestos y 5% del universo`;
- cambio de banda pública de Nivel, tratado como hito de Nivel.

No mostrar movimientos menores ni atribuir el cambio únicamente al partido. Usar “tras actualizarse el ranking”, porque otros jugadores también pueden alterar posiciones. Race y temporadas quedan fuera de V1.

## 11. UX posterior al partido

Orden:

1. resultado/resumen;
2. bloque BRAMU Intelligence;
3. tarjeta principal;
4. cero, una o dos observaciones secundarias;
5. detalle desplegable `Por qué aparece`.

Principal:

- título de 3–7 palabras;
- cuerpo de 12–24 palabras;
- una evidencia o chip opcional;
- sin CTA obligatorio.

Secundarios:

- 10–20 palabras;
- máximo uno por familia;
- sin repetir el principal.

Una derrota no tiñe todo el bloque de rojo. El tono es factual y no obliga a cerrar con motivación artificial.

## 12. Capa generativa

### Función permitida

- variar redacción;
- hacer más natural el tono;
- fusionar dos claims compatibles ya seleccionados;
- adaptar longitud dentro de los límites.

### Entrada permitida

- identificadores de claims seleccionados;
- valores estrictamente necesarios;
- placeholders como `SELF`, `PARTNER_A`, `RIVAL_A` y `RIVAL_B`;
- perspectiva, tono y longitud;
- lista de expresiones prohibidas.

No enviar nombres completos, email, teléfono, fecha de nacimiento, foto, ubicación exacta, identificador de autenticación, notas libres ni historial crudo.

### Validación obligatoria

Rechazar la salida si:

- usa un claim no seleccionado;
- agrega o modifica números;
- agrega entidades;
- introduce técnica, acciones, emoción o causalidad;
- contradice el resultado o la perspectiva;
- excede la longitud;
- omite el alcance personal/oficial cuando es necesario.

### Proveedor y contingencia

- proveedor inicial: Cloudflare Workers AI / Qwen3 30B A3B;
- alternativa: Groq / GPT-OSS 20B con Zero Data Retention;
- clave solo en backend;
- feature flag y presupuesto mensual;
- un solo reintento y timeout corto;
- generar una vez y guardar;
- nunca regenerar al abrir la pantalla;
- fallback inmediato a plantillas.

Referencia actual de inferencia para el patrón completo:

| Usuarios activos mensuales | Costo aproximado |
|---:|---:|
| 1.000 | USD 0 |
| 5.000 | USD 8/mes |
| 10.000 | USD 14/mes |

Si se desactiva la IA, BRAMU conserva hechos, prioridad, UX y explicaciones. Solo pierde parte de la variedad verbal y el costo de inferencia pasa a cero.

## 13. Memoria, caché y recálculo

- Guardar familia, clave semántica, plantilla y protagonistas de los últimos 5 partidos.
- No repetir un hecho relacional hasta que cambie o transcurran 4 partidos.
- Un hito se muestra una sola vez.
- Una racha aparece al llegar a 3, igualar récord, superarlo y terminar.
- La misma plantilla exacta no se reutiliza durante 5 partidos.
- El texto se identifica por hash de datos, claims, perspectiva, versión y modelo.
- Si el hash existe, se reutiliza.
- Si se corrige o elimina un partido, recalcular derivados afectados y marcar como obsoletos los textos dependientes.
- Conservar el texto y evidencia que el usuario vio; no reescribir silenciosamente el pasado.

## 14. Implementación en bloques

### Bloque A — Datos y derivados

- modelo de identidad y partido;
- fecha jugada;
- formatos y validación de score;
- separación personal/oficial;
- derivados de racha, forma, score y relaciones.

### Bloque B — Claims y evidencia

- diez familias V1;
- umbrales de muestra y comparabilidad;
- objeto de insight;
- trazabilidad de evidencia;
- fixtures unitarios.

### Bloque C — Relevancia y memoria editorial

- puntaje;
- penalizaciones;
- selección y deduplicación;
- cooldowns;
- abstención.

### Bloque D — Plantillas y UX

- variantes controladas;
- tarjeta principal y secundarios;
- `Por qué aparece`;
- estados de aprendizaje;
- estados de error y fallback invisibles para el usuario.

### Bloque E — Nivel y Ranking

- consumo de snapshots;
- expectativa y confianza;
- códigos de razón;
- hitos materiales de Ranking;
- pruebas de oficialidad y causalidad.

### Bloque F — Generación opcional

- función segura en backend;
- proveedor desacoplado;
- payload seudonimizado;
- validador;
- caché, presupuesto y fallback;
- modo sombra y benchmark antes de activación pública.

Los bloques son orden de construcción y prueba. No representan seis experiencias distintas para el usuario.

## 15. Banco de pruebas obligatorio

Antes de habilitar la experiencia, construir al menos 100 historias con:

- poco y mucho historial;
- cargas fuera de orden;
- nombres repetidos e identidades corregidas;
- formatos estándar y match tie-break;
- rachas, cortes y récords;
- compañeros y rivales variables;
- cruces exactos;
- partidos sin nada excepcional;
- pendientes, disputados, casuales, observados y fuera de término;
- cuatro, tres y dos niveles conocidos;
- calibración y baja confianza;
- movimientos propios y ajenos de Ranking;
- correcciones y eliminaciones.

Criterios mínimos:

| Métrica | Condición |
|---|---:|
| Números incorrectos | 0 |
| Nombres o entidades inventadas | 0 |
| Acciones no registradas | 0 |
| Claims sin evidencia | 0 |
| Precisión factual en fixtures | 100% |
| Salidas generativas rechazadas | menos de 2% |
| Preferencia de IA sobre plantillas | mejora mínima de 15 puntos porcentuales |
| Disponibilidad con fallback | 100% |

Si la IA no supera el benchmark, la V1 se publica con plantillas sin reabrir el motor de producto.

## 16. Definición de terminado

BRAMU Intelligence V1 se considera implementado cuando:

- cada salida puede reconstruirse desde claims y evidencia;
- los diez detectores producen los resultados esperados;
- puntajes, prioridades, deduplicación y cooldowns son determinísticos;
- ningún partido manual habilita acciones no registradas;
- Nivel y Ranking se consumen desde snapshots y nunca se recalculan;
- la historia personal no se confunde con la oficial;
- correcciones y eliminaciones invalidan los derivados correctos;
- el bloque muestra entre una y tres conclusiones sin relleno;
- las plantillas cubren el 100% de los casos habilitados;
- la ausencia o falla del proveedor no afecta la carga ni la consulta del partido;
- costos, latencia, fallbacks y rechazos pueden medirse;
- la experiencia supera el banco de pruebas y una revisión con historias reales.

## 17. Estado final

**Definición funcional:** cerrada para V1.  
**Lista para plan técnico:** sí.  
**Lista para activar sin desarrollo y pruebas:** no.  
**Decisiones pendientes del usuario:** ninguna para comenzar.  
**Primera acción recomendada:** pedir al chat de desarrollo un diagnóstico y plan por bloques A–F, sin autorizar todavía una implementación completa de una sola vez.
