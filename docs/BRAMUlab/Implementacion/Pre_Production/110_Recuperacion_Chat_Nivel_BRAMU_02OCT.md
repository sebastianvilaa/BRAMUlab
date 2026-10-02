# 110 — Recuperación segura del chat “01 - Nivel BRAMU” tras cuelgue

**Fecha:** 02/10/2026  
**Objetivo:** preservar el estado recuperable del trabajo del chat de investigación de Nivel BRAMU sin inventar avances no confirmados.  
**Alcance:** investigación / producto / simulación. **No implementar cambios de fórmula todavía.**

## 1. Fuentes vigentes a leer antes de continuar

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Nivel_BRAMU.md`
3. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
4. Issue #25 completo
5. Este documento de recuperación

No usar Archivo/ como autoridad salvo trazabilidad específica.

## 2. Propósito de la investigación

Validar si el estimador inicial vigente es suficientemente universal y robusto para producción/piloto real, especialmente frente a:
- sensibilidad excesiva a autoevaluación;
- etiquetas subjetivas/relativas;
- círculos cerrados de jugadores con sesgo compartido;
- capacidad real del motor posterior para corregir una estimación inicial equivocada;
- necesidad o no de una siguiente versión del estimador inicial.

No mezclar esta investigación con Ranking BRAMU.

## 3. Restricción de alcance ya establecida

La investigación debe centrarse en el **estimador inicial/onboarding**.

No cambiar por ahora:
- motor de partidos `nivel_bramu_v1_0`;
- escala pública 1.0–10.0;
- Ranking;
- Grupos;
- backend de Nivel salvo lectura necesaria;
- datos reales de Staging.

Staging debe consultarse estrictamente **read-only**.

## 4. Caso real de Staging ya reproducido

Caso desidentificado analizado antes del cuelgue:

- nivel inicial calculado: **5.405** → visible 5.4;
- estado: **CALIBRANDO**;
- confianza: **0.15**;
- partidos computables: **0**;
- rivales distintos: **0**.

Composición documentada:
- **65% autoevaluación**;
- **35% técnica**;
- ajuste de entrenamiento: **+0.08**.

Cálculo reproducido:

`0.65 × 5.5 + 0.35 × 5.0 + 0.08 = 5.405`

El mismo caso, cambiando la autoevaluación de “Intermedio alto” a “Intermedio”, daba aproximadamente **4.43**.

Conclusión ya firme: la autoevaluación es una fuente importante de sensibilidad del punto inicial.

## 5. Simulaciones ya obtenidas

Resultado firme 1:
- partiendo de 5.405;
- con rivales estables y diversos;
- cinco derrotas seguidas en un escenario de corrección favorable;
- el nivel baja aproximadamente a **4.64**.

Resultado firme 2:
- si dos jugadores comparten una sobreestimación similar;
- quedan uno por cada equipo;
- juegan diez partidos alternados;
- ambos pueden permanecer prácticamente alrededor de **5.4** mientras aumenta su confianza.

Lectura provisional ya establecida:
- el motor puede corregir errores individuales cuando recibe evidencia externa suficiente;
- un círculo cerrado con sesgo compartido puede cancelar parte de esa corrección y aumentar confianza sin corregir del todo el nivel relativo.

## 6. Hallazgos conceptuales ya establecidos

- Las etiquetas de autoevaluación pueden ser interpretadas de forma relativa al entorno del jugador.
- Un estimador inicial demasiado sensible a esas etiquetas puede producir anclas altas o bajas.
- La calibración posterior no garantiza por sí sola corregir rápido un sesgo compartido dentro de un círculo cerrado.
- No corresponde cambiar pesos o fórmula a ciegas: primero hay que comparar contrafactuales, simulaciones y casos reales.

## 7. Decisión de producto ya cerrada

**Un Nivel BRAMU 5.4 debe significar lo mismo independientemente del género.**

Por lo tanto:
- no crear Nivel separado por género;
- no aplicar correcciones de Nivel por género;
- no reinterpretar la escala según género.

## 8. Plan de trabajo que estaba en ejecución

La ejecución tenía cinco tareas:

1. Consolidar diagnóstico vigente y restricciones del estimador — **COMPLETADA**.
2. Diseñar una siguiente versión adaptativa del estimador inicial con scoring, continuidad y confianza.
3. Construir contrafactuales y simular convergencia del motor actual.
4. Contrastar casos reales desidentificados de Staging.
5. Presentar conclusiones y decisiones abiertas **sin implementar**.

Antes del cuelgue visible, la tarea 1 figuraba completada. Había resultados parciales firmes de simulación ya descritos arriba.

## 9. Qué NO se puede afirmar como recuperado

No asumir como terminado ningún razonamiento, archivo o simulación que no esté:
- visible en el chat;
- persistido en repo;
- documentado en Issue #25;
- o consignado explícitamente en este documento.

La ejecución se colgó mientras seguía trabajando. Cualquier trabajo interno no emitido ni persistido puede no ser recuperable exactamente y debe reconstruirse desde las fuentes anteriores, evitando repetir lo que sí está preservado.

## 10. Próximo paso recomendado

Continuar desde la tarea 2 o desde el último artefacto realmente persistido que exista en repo.

El entregable final debe incluir:
- diagnóstico final;
- propuesta de siguiente versión del estimador inicial;
- scoring y sensibilidad;
- simulaciones de convergencia;
- contraste con casos reales desidentificados;
- riesgos;
- decisiones abiertas para Sebastián;
- estrategia de versionado/migración;
- tests necesarios;
- documentación a actualizar.

No implementar hasta que Sebastián apruebe las decisiones de producto abiertas.
