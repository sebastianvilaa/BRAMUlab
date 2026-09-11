# Nivel BRAMU V1 — Handoff para desarrollo

**Estado:** fórmula congelada para piloto  
**Versión del algoritmo:** `nivel_bramu_v1_0`  
**Objetivo:** convertir la definición de producto y matemática ya aprobada en una implementación segura, verificable y gradual.

## 1. Decisión de producto

Nivel BRAMU está suficientemente definido para comenzar desarrollo.

Esto significa que:

- el comportamiento esperado del sistema está decidido;
- la fórmula V1 puede implementarse sin nuevas decisiones de producto;
- los parámetros iniciales están congelados para el piloto;
- cualquier ajuste posterior deberá producir una nueva versión del algoritmo o un cambio de parámetros documentado;
- la validación con datos reales forma parte de la calibración posterior al piloto, no es un bloqueo para empezar a desarrollar.

No significa que la fórmula sea una verdad matemática definitiva. La V1 debe implementarse versionada y parametrizada para poder medirla, auditarla y mejorarla sin alterar resultados históricos silenciosamente.

## 2. Documentos fuente

El desarrollo debe usar estos documentos en este orden:

1. `docs/bramulab/Nivel_BRAMU_Formula_V1_4_Cerrada.md`: fuente normativa de fórmula, parámetros, elegibilidad, casos y simulaciones.
2. `docs/bramulab/Nivel_BRAMU_Consolidado_Base.md`: contexto funcional, cuestionario, estados y experiencia de producto.
3. `docs/bramulab/Nivel_BRAMU_Handoff_Desarrollo_V1.md`: secuencia de implementación, límites y definición de terminado.

Si aparece una contradicción, no resolverla por interpretación: documentarla antes de programar. La fórmula no debe rediseñarse desde desarrollo.

## 3. Alcance cerrado de V1

La implementación debe respetar, como mínimo, estas decisiones:

- escala pública de 1.0 a 10.0;
- un decimal visible y cuatro decimales internos;
- nivel efectivo dependiente de `mu` y confianza;
- expectativa por promedio de cada pareja;
- actualización híbrida basada en resultado esperado, confianza y calidad de evidencia;
- margen por sets con efecto acotado;
- factores por formato, confianza rival, repetición de rivales, compañero repetido, círculo competitivo cerrado y disponibilidad de participantes;
- cuestionario rápido y completo con nivel inicial estimado;
- un único ajuste inicial de hasta ±0.5;
- estado visual de calibración hasta completar 5 partidos computables y enfrentar al menos 3 rivales distintos;
- recalibración voluntaria disponible cada 90 días;
- invitado sin estimación subjetiva de terceros;
- al menos un jugador con nivel por pareja para que el partido sea computable;
- factores de disponibilidad: 1.00 con cuatro conocidos, 0.80 con tres y 0.60 con dos —uno por pareja—;
- los invitados no reciben actualización;
- los partidos internos de un círculo competitivo cerrado tienen peso reducido, sin impedir que el jugador progrese al aportar evidencia externa o contra rivales claramente superiores;
- ningún resultado histórico debe cambiar silenciosamente cuando cambie la fórmula.

## 4. Principio técnico central

El cálculo debe vivir en un motor puro, determinista y auditable.

Para una misma entrada y una misma versión del algoritmo, el resultado debe ser siempre idéntico. La interfaz no debe recalcular por su cuenta ni contener reglas de negocio duplicadas.

Cada actualización debe conservar:

- valores anteriores del jugador;
- instantánea de niveles efectivos y confianza de los participantes;
- expectativa calculada;
- factores aplicados;
- delta resultante;
- valores posteriores;
- versión del algoritmo;
- códigos de motivo suficientes para explicar el cálculo;
- fecha y origen de la operación.

Las correcciones de partidos deben ser idempotentes y reconstruibles. No se debe sumar o restar un nuevo delta sobre un resultado ya corregido sin revertir o recalcular la operación original de forma controlada.

## 5. Implementación por etapas

Cada etapa debe revisarse y probarse antes de abrir la siguiente. No conviene pedir todo en una única entrega.

### Etapa A — Modelo de datos y motor de cálculo

Implementar sin cambios visibles de interfaz:

- estado de rating por jugador: `mu`, confianza, cantidad y tipo de evidencia, estado, timestamps y versión;
- registro auditable del cálculo por partido y por jugador;
- configuración centralizada de parámetros V1;
- motor puro y determinista;
- redondeo público separado de la precisión interna;
- feature flag `nivel_bramu_v1` o equivalente.

**Salida esperada:** cálculo ejecutable mediante pruebas, todavía sin afectar producción ni mostrar resultados al usuario.

### Etapa B — Elegibilidad, invitados y calidad de evidencia

Implementar:

- validación del partido computable;
- regla de al menos un jugador con nivel por pareja;
- imputación del invitado según la fórmula aprobada;
- factores 1.00, 0.80 y 0.60;
- repetición de rivales y compañero;
- detección y factor de círculo competitivo cerrado;
- estados de partido pendiente, computable, excluido, corregido o anulado;
- política temporal y de validación definida en la fórmula;
- ausencia de actualizaciones retroactivas silenciosas.

**Salida esperada:** el backend puede decidir de forma trazable si un partido aporta evidencia y con qué peso.

### Etapa C — Inicio, calibración y recalibración

Implementar:

- cuestionario rápido y cuestionario completo;
- cálculo del nivel inicial estimado;
- ajuste único de hasta ±0.5;
- guardado de respuestas como origen del nivel, nunca como hechos deportivos observados;
- estado de nivel estimado/en calibración;
- transición a calibrado luego de 5 partidos computables y 3 rivales distintos;
- recalibración manual disponible cada 90 días desde el perfil;
- tratamiento explícito de una nueva estimación sin borrar la trazabilidad anterior.

**Salida esperada:** ciclo completo desde usuario nuevo hasta nivel calibrado.

### Etapa D — Presentación y explicación

Implementar:

- nivel público con un decimal;
- diferenciación visual del nivel en calibración;
- estado y confianza expresados en lenguaje de producto;
- explicación breve de por qué un partido incidió mucho, poco o nada, usando códigos calculados;
- ausencia de cambios ficticios como `+0.0`;
- consistencia entre perfil, historial, perfil público y cualquier otra superficie que muestre el nivel.

**Salida esperada:** experiencia comprensible sin exponer complejidad matemática innecesaria.

### Etapa E — Pruebas, simulaciones y activación controlada

Construir una batería reproducible con:

- fixtures exactos de los casos incluidos en la fórmula cerrada;
- victoria que nunca disminuye el nivel y derrota que nunca lo aumenta;
- simetría y límites de cada factor;
- escenarios de 4, 3 y 2 jugadores conocidos;
- repetición de compañero y rivales;
- círculo competitivo cerrado y salida del círculo;
- corrección y anulación de partidos;
- idempotencia ante reintentos;
- estabilidad del redondeo;
- simulaciones anuales del grupo cerrado dentro de los rangos aprobados;
- comparación entre resultados del motor y resultados esperados con tolerancia máxima definida, inicialmente ±0.01;
- activación gradual mediante feature flag y monitoreo de distribución, deriva y casos extremos.

**Salida esperada:** aprobación técnica para piloto, sin migración irreversible ni exposición general antes de pasar las pruebas.

## 6. Qué no debe hacer desarrollo en esta primera conversación

- No implementar toda la funcionalidad de una vez.
- No cambiar la fórmula para adaptarla a la arquitectura sin informar el conflicto.
- No inventar valores faltantes ni niveles subjetivos para invitados.
- No mezclar Nivel BRAMU con Ranking BRAMU.
- No conectar respuestas técnicas del cuestionario con relatos de BRAMU Intelligence.
- No recalcular el historial con una nueva versión sin una migración explícita.
- No desplegar ni habilitar el cálculo para usuarios reales antes de aprobar pruebas y estrategia de migración.

## 7. Primera tarea para el chat de desarrollo

La primera entrega debe ser únicamente un diagnóstico y plan técnico. Debe incluir:

- arquitectura actual relevante;
- archivos, tablas, endpoints, servicios y pantallas afectados;
- diferencias entre el modelo existente y el requerido;
- propuesta de modelo de datos y auditoría;
- propuesta de motor de cálculo y ubicación de parámetros;
- migraciones necesarias y cómo revertirlas;
- plan concreto por etapas A–E;
- riesgos, contradicciones y decisiones que realmente requieran producto;
- estrategia de pruebas y fixtures;
- estimación de qué puede implementarse en cada bloque pequeño.

Después de aprobar ese plan, la primera autorización de código debería limitarse a la **Etapa A**.

## 8. Definición de terminado para el piloto

Nivel BRAMU V1 se considera implementado —no solo programado— cuando:

- el motor coincide con los fixtures aprobados;
- todos los parámetros están centralizados y documentados;
- cada cálculo conserva la versión y una auditoría reproducible;
- reintentos, correcciones y anulaciones no duplican efectos;
- las reglas de invitados y elegibilidad funcionan en todos los casos admitidos;
- la calibración y recalibración respetan sus umbrales;
- el mismo nivel se muestra de forma consistente en todo el producto;
- la V1 puede habilitarse y deshabilitarse de forma controlada;
- existen métricas para detectar inflación, deflación, concentración, saltos anómalos y deriva por círculos cerrados;
- las simulaciones del grupo cerrado permanecen dentro de los rangos de producto aprobados;
- producto revisa los resultados del piloto antes de declarar una V1 estable.

## 9. Estado de la decisión

**Fórmula de producto:** cerrada para V1.  
**Lista para desarrollo:** sí.  
**Lista para desplegar a producción:** todavía no; primero requiere plan técnico, implementación gradual, pruebas y piloto medido.  
**Próxima acción:** enviar al chat de desarrollo el mensaje incluido en la conversación de entrega y pedir solamente el plan técnico.
