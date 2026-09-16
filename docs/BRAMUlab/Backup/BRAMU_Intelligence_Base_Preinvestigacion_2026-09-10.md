# BRAMU Intelligence — Consolidado base para investigación

## Estado
Documento de contexto para investigación de producto. No implementar todavía.

## Alcance
Este trabajo debe concentrarse exclusivamente en **BRAMU Intelligence aplicado a partidos cargados manualmente / partidos ya jugados**.

El análisis del modo **partido registrado en vivo** se considera suficientemente bien resuelto para esta etapa y no debe modificarse como parte de esta investigación.

## 1. Qué es BRAMU Intelligence
BRAMU Intelligence es la capa de interpretación de BRAMU Lab.

Su función no es repetir el resultado ni listar estadísticas. Debe transformar los datos disponibles en una lectura clara, útil, interesante y comprensible para un jugador amateur.

La promesa conceptual es que BRAMU no solo guarda partidos: ayuda al jugador a entender qué significan dentro de su historia.

## 2. Problema actual
En partidos cargados manualmente, BRAMU Intelligence se siente pobre y poco inteligente.

Hoy puede describir el score o detectar diferencias obvias entre sets, pero:
- suele quedarse demasiado cerca del resultado;
- puede sonar genérico;
- no aprovecha suficientemente el historial del jugador;
- no siempre agrega una lectura nueva;
- corre el riesgo de hablar como si hubiera visto el desarrollo del partido cuando solo conoce el resultado final por sets.

El objetivo de la investigación es resolver este problema sin inventar información.

## 3. Regla principal
BRAMU Intelligence debe distinguir siempre entre:
- **dato observado**: existe explícitamente en los datos;
- **inferencia válida**: puede deducirse razonablemente de datos reales;
- **suposición no permitida**: no debe presentarse como hecho.

Si el partido fue cargado manualmente con el resultado por sets, BRAMU NO sabe:
- desarrollo punto a punto;
- quiebres;
- rachas internas;
- cambios emocionales;
- errores no forzados;
- winners;
- smash;
- dominio de tramos específicos;
- quién “arrancó mejor” dentro de un set;
- momentos decisivos internos;
- cualquier evento técnico no registrado.

No debe narrar el partido como si lo hubiera observado.

## 4. Datos que puede tener para un partido cargado manualmente
Según la evolución del producto, BRAMU puede disponer de:
- identidad del jugador;
- compañero;
- rivales;
- fecha y hora;
- formato;
- sistema de puntuación;
- resultado por set;
- ganador;
- cantidad de sets;
- games ganados y perdidos;
- historial completo del jugador;
- efectividad histórica;
- forma reciente;
- rachas;
- frecuencia y rendimiento con compañeros;
- frecuencia y resultados frente a rivales;
- Nivel BRAMU actual;
- evolución histórica del Nivel BRAMU;
- mejor Nivel BRAMU histórico;
- contexto de calibración del nivel;
- fuerza relativa de compañeros y rivales, cuando el sistema definitivo de Nivel BRAMU exista;
- condición oficial/validada del partido cuando exista backend real.

La investigación debe separar qué puede usarse hoy y qué depende de sistemas todavía en definición.

## 5. Qué debería aportar
BRAMU Intelligence debería trabajar, como mínimo, en tres capas.

### Capa A — Lectura del partido actual
Interpretar únicamente lo que puede sostenerse con el score y los datos del partido.

Ejemplos posibles:
- partido resuelto en dos o tres sets;
- set más parejo;
- set con mayor diferencia;
- alternancia de ganadores de set;
- remontada a nivel de sets;
- definición ajustada o amplia;
- diferencia total de games;
- regularidad o irregularidad visible entre sets.

### Capa B — Contexto dentro de la historia del jugador
Explicar qué representa ese partido dentro del recorrido personal.

Ejemplos:
- corta o extiende una racha;
- mejora o empeora la forma reciente;
- resultado con un compañero frecuente;
- primer partido con un compañero;
- nuevo enfrentamiento contra un rival habitual;
- cambia una tendencia reciente;
- se parece o contrasta con resultados anteriores;
- consolida una buena serie;
- aparece después de varias derrotas o victorias.

Esta capa es clave para que BRAMU Intelligence deje de ser una descripción del score y empiece a sentirse personal.

### Capa C — Impacto BRAMU
Cuando los sistemas correspondientes existan, interpretar:
- impacto sobre Nivel BRAMU;
- diferencia entre resultado esperado y real;
- fortaleza relativa del partido;
- calibración;
- consistencia del nivel;
- señales de mejora o estancamiento.

No implementar conclusiones de esta capa antes de que las reglas de Nivel BRAMU estén definidas y los datos necesarios existan.

## 6. Principios de tono
BRAMU Intelligence debe sentirse:
- claro;
- deportivo;
- cercano;
- breve;
- útil;
- interesante para un amateur;
- sin jerga estadística innecesaria;
- sin grandilocuencia;
- sin psicologizar el partido;
- sin frases vacías.

Debe evitar:
- repetir literalmente el score si ya está visible;
- párrafos largos;
- frases genéricas que servirían para cualquier partido;
- conclusiones no respaldadas;
- tono de comentarista profesional cuando faltan datos.

## 7. Personalización
El análisis debe priorizar aquello que sea particular de ese jugador y ese partido.

Si existen varios insights posibles, elegir los que tengan mayor valor informativo.

Prioridad conceptual:
1. hecho excepcional o cambio de tendencia;
2. relación con compañero/rival;
3. impacto sobre racha/forma/nivel;
4. lectura particular del score;
5. dato genérico del partido.

No hace falta mostrar todas las conclusiones posibles.

## 8. Modos de datos
La investigación debe diferenciar explícitamente entre:

### Partido manual
Conoce esencialmente resultado, participantes, contexto e historial.

### Partido por games
Puede reconstruir más secuencia que un partido manual, pero no necesariamente el punto a punto.

### Partido punto a punto / en vivo
Tiene mayor profundidad temporal y puede generar lecturas más específicas.

**Importante:** el producto actual considera suficientemente resuelto el análisis del partido registrado en vivo. La investigación puede usarlo como referencia conceptual, pero no debe proponer rediseñarlo salvo incompatibilidad sistémica realmente importante.

### Lectura longitudinal
No depende de un partido aislado: interpreta trayectoria, forma, compañeros, rivales, nivel y tendencias.

## 9. UX del resultado
La investigación debe definir:
- cantidad ideal de insights;
- longitud de cada uno;
- si conviene un bloque narrativo o varias observaciones;
- jerarquía visual;
- cuándo mostrar una sola conclusión fuerte;
- cuándo mostrar 2–3 lecturas;
- cómo evitar una pared de texto.

La experiencia debe seguir siendo rápida y atractiva.

## 10. Investigación esperada
Investigar referencias útiles en:
- apps deportivas amateur;
- fitness;
- tenis/pádel;
- productos que traducen métricas en lenguaje natural;
- sistemas de insights post actividad;
- experiencias tipo Strava/Garmin/Whoop u otras equivalentes, sin copiar mecánicamente.

El objetivo no es encontrar una pantalla para copiar, sino entender qué hace que una devolución automática se sienta inteligente y relevante.

## 11. Preguntas que el Work debe resolver con autonomía
- Qué modelo conceptual debería usar BRAMU Intelligence.
- Qué taxonomía de insights conviene.
- Qué insights son válidos con score manual.
- Qué insights requieren historial.
- Qué insights requieren Nivel BRAMU.
- Qué insights están prohibidos por falta de evidencia.
- Cómo priorizar entre varios insights.
- Cómo evitar repetición entre partidos parecidos.
- Cómo hacer que el análisis mejore a medida que BRAMU conoce más al jugador.
- Qué estructura de salida conviene.
- Qué tono y longitud funcionan mejor.
- Qué datos adicionales serían realmente valiosos y cuánto costaría capturarlos.
- Qué puede resolverse algorítmicamente y qué podría beneficiarse de IA generativa en una etapa posterior.

## 12. Entregable esperado
El Work debe producir un documento de definición, no código, con:
- marco conceptual;
- taxonomía de insights;
- reglas de evidencia;
- sistema de prioridades;
- diferencias por modo de registro;
- propuesta de UX;
- ejemplos buenos y malos;
- datos requeridos;
- dependencias con Nivel BRAMU/backend;
- propuesta de evolución;
- recomendación concreta de primera implementación.

Debe tomar decisiones y avanzar con autonomía. Preguntar al usuario solo cuando una respuesta cambie materialmente el producto y no pueda resolverse razonablemente mediante investigación y criterio.
