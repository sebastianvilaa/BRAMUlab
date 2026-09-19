# Backend Bloque 3 — Decisión de producto: Nivel inicial universal

**Fecha:** 19/09/2026

## Confirmado

- Se retira del onboarding inicial la pregunta final “¿En qué categoría suelen ser parejos tus partidos?”.
- La categoría local NO ajusta el Nivel inicial.
- El cuestionario completo pasa de 7 a 6 preguntas: también se retira “Cuando competís en tu categoría habitual, ¿cómo suelen ser tus resultados?”, porque sin contexto local esa respuesta no puede interpretarse de forma universal.
- Camino rápido: conserva las 5 descripciones.
- El resultado se confirma directamente y luego se calibra con partidos reales.
- País, rama competitiva y categoría quedan para Perfil/Ranking/contexto posterior.
- Nueva versión del estimador: `nivel_inicial_v1_2`.
- Motor de partidos: `nivel_bramu_v1_0` sin cambios.

## Motivo

La categoría numerada no es universal: cambia por país, circuito y rama competitiva. Exigir todo ese contexto en el onboarding contradice la decisión de mantener el alta mínima. Sin ese contexto, mostrar una pregunta que promete “afinar” el Nivel pero produce ajuste cero es una mala experiencia.

## Futuro cercano — propuesta para evaluar

Conservar el objetivo emocional/UX de participación del usuario en el resultado: evitar la sensación de “la app me puso una nota” y permitir una confirmación con agencia. Diseñar una interacción universal y acotada que no dependa de categorías locales y no permita manipular libremente el Nivel. No se implementa en esta ronda.

## Implementación

- Browser y Edge Function usan `confirmInitialLevelV1_2`.
- El helper histórico de categoría permanece en el motor como código legado/futuro, pero el onboarding real no lo invoca con contexto/categoría.
- Persistencia mantiene campos de categoría/contexto nullable por compatibilidad/futuro; la oficialización V1.2 escribe `NULL`.
- No requiere migración SQL.
