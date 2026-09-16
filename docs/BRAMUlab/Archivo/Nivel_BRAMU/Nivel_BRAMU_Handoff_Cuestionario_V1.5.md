# Handoff a Desarrollo — Cuestionario Nivel BRAMU V1.5

## Estado

La prueba visual real de V04.4/V04.5 detectó un sesgo sistemático en la estimación inicial intermedia. No es un bug de implementación: V04 reproduce correctamente V1.4, pero años, frecuencia y etiquetas competitivas abstractas pueden inflar a amateurs experimentados.

Se cerró una corrección específica en `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md` §3.

- Motor de partidos: **CONSERVAR** `nivel_bramu_v1_0` sin cambios.
- Estimador inicial: **REEMPLAZAR** por `nivel_inicial_v1_1`.
- Ranking BRAMU y BRAMU Intelligence: **NO TOCAR**.
- Baseline vigente antes del cambio: 1338/1338 tests.

## Fuentes y precedencia

1. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
2. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
3. `docs/BRAMUlab/Nivel_BRAMU.md`

V1.4 queda como antecedente. No usar sus §§3.1–3.7 para altas nuevas.

## Cambios solicitados

### REEMPLAZAR

- `FULL_QUESTIONNAIRE` y `computeFullQuestionnaireRaw` en `bramulab/level-calibration.js` por las preguntas, anclas y fórmula de V1.5 §3.
- El uso de `Q = Σ(w×q)` y `1 + 7.5×Q` para la estimación inicial.
- Las descripciones rápidas por las cinco descripciones de V1.5; las semillas 2,0 / 4,0 / 5,5 / 7,0 / 8,5 se conservan.
- La etiqueta superior `Competición` por `Profesional`.
- El stepper libre de ±0,5 por la pregunta final neutral de categoría y su ajuste automático.
- Los fixtures específicos del cuestionario V1.4 por fixtures V1.1.

### AGREGAR

- `questionnaireVersion: 'nivel_inicial_v1_1'` en el origen persistido.
- Cálculo y persistencia de `baseLevel`, `technicalAnchor`, `trainingModifier`, `categoryContextKey`, `declaredCategory`, `competitionAnswer`, `categoryReference`, `categoryAdjustment`, `confidenceOrigin` y `coherenceFlag`.
- Configuración versionada de anclas locales. Activar inicialmente solo el mapa argentino cuyo contexto sea compatible; para cualquier contexto no soportado, guardar la categoría y aplicar ajuste `0`.
- Confianza completa variable `0.12`/`0.15`/`0.18`; ante brecha de coherencia ≥2,0, ofrecer **Revisar respuestas** y limitarla a `0.10` si el usuario confirma.
- Pregunta final: **Una última pregunta para afinar tu nivel — ¿En qué categoría suelen ser parejos tus partidos?** Sin opción sugerida o destacada; incluir `No compito` y `No estoy seguro`.
- Resultado final: **Tu punto de partida en BRAMU**.

### REUBICAR / FUSIONAR

- Si categoría ya se pregunta durante Crear cuenta/Mis datos, reutilizar ese mismo dato en el paso final de Nivel: no crear dos categorías independientes.
- La pregunta competitiva debe describir el rendimiento dentro de esa categoría; categoría + rendimiento forman una sola evidencia contextual.

### CONSERVAR

- `bramulab/level.js`, `PARAMS` y `algorithmVersion: 'nivel_bramu_v1_0'`.
- Toda fórmula de partidos, expectativa, deltas, invitados, repetición, compañero, círculo e inactividad.
- Estados CALIBRANDO/CALIBRADO y umbrales 5 partidos + 3 rivales.
- Recalibración 90 días, ancla 75/25, tope ±0,5, ventana 120 días y cierre 3 partidos + 2 rivales.
- Feature flag y separación entre nivel real V1 y simulación anterior.

## Fixtures obligatorios V1.1

Cuestionario completo, tolerancia interna ±0,01:

| Perfil | Resultado |
|---|---:|
| Esteban | 6,11 |
| Seba | 5,69 |
| Lucho | 4,75 |
| Agustín | 2,05 |

Camino rápido con categoría:

| Perfil | Resultado |
|---|---:|
| Esteban | 5,92 |
| Seba | 5,50 |
| Lucho | 4,50 |
| Agustín | 2,00 |

Agregar también los ocho perfiles de estrés de V1.5 §3.8, casos de coherencia, límites ±0,5, contexto no soportado y redondeo público.

Los fixtures no relacionados con el cuestionario deben seguir pasando sin cambios. El total final debe ser 1338/1338 más los nuevos casos, descontando únicamente fixtures viejos reemplazados de V04.3.

## UX a verificar manualmente

1. Camino completo y rápido en mobile 375 px.
2. Ninguna categoría aparece preseleccionada, sugerida ni destacada.
3. `No compito`/`No estoy seguro` mantienen el nivel previo.
4. El ajuste automático nunca supera ±0,5.
5. Una contradicción muestra revisión sin acusar al usuario.
6. Ya no existe el stepper manual.
7. Home y Perfil muestran el mismo valor confirmado y `CALIBRANDO`.
8. Cuentas de prueba antiguas no se mezclan silenciosamente con `nivel_inicial_v1_1`; limpiar o migrar explícitamente el estado local de preview.

## Límite de la ronda

Implementar únicamente esta sustitución del estimador y su UI inmediata. No avanzar todavía con evolución por partidos reales, Ranking, perfil público ni BRAMU Intelligence.
