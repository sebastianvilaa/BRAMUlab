# Handoff — Cierre documental Nivel BRAMU V1.3

**Fecha:** 03/10/2026  
**Rama:** `staging`  
**Estado funcional aprobado:** BRAMUlab V04.28 / bundle `04.28-h7`  
**Objetivo:** cerrar documentalmente Nivel BRAMU V1.3 después del PASS técnico y humano, dejando una única fuente maestra vigente y retirando del árbol activo documentación de Nivel ya supersedida/consumida.

## 1. Estado cerrado que debe preservarse

Nivel inicial vigente:
- `questionnaire_version = nivel_inicial_v1_3`
- `questionnaire_mode = full`
- motor posterior de partidos: `algorithm_version = nivel_bramu_v1_0`
- sin camino rápido
- cuestionario adaptativo de 5 preguntas
- no usar etiquetas de auto-nivel, años, frecuencia ni entrenamiento para estimar capacidad inicial
- no usar género, categoría competitiva local ni ajustes hombre/mujer
- escala única/universal

Preguntas/dimensiones V1.3:
- `panorama`
- `ritmo`
- `ataque`
- `defensa`
- `decisiones`
- 20% cada una

Anclas:
- P1: `[1.8, 3.8, 5.8, 7.2]`
- P2-P5 low: `[1.5, 2.8, 3.8, 4.6]`
- P2-P5 mid: `[3.3, 4.2, 5.2, 6.2]`
- P2-P5 high: `[5.7, 6.3, 7.0, 8.8]`

Slider:
- 10 posiciones discretas
- anclas visibles en 0/3/6/9
- posiciones 1/2 interpolan por tercios entre anclas
- branch adaptativo por media acumulada:
  - <4.1 = low
  - 4.1–<6.4 = mid
  - >=6.4 = high
- ninguna respuesta preseleccionada
- continuar disabled hasta interacción
- orientación vertical
- solo 4 dots de ancla visibles; 10 posiciones funcionales
- thumb cyan con indicador/pico hacia la derecha
- estados intermedios ponderados visualmente 67/33 y 33/67
- rail neutro
- helper vigente: `Tocá una descripción. Si estás entre dos opciones, usá el control para ajustar tu respuesta.`

Cálculo inicial:
- media de las cinco dimensiones
- clamp 1–9
- hasta 4 decimales internos
- spread = max-min
- confianza de origen:
  - spread <2.0 → 0.15
  - spread >=2.0 → 0.10
- spread >=2.0 solo sugiere revisar respuestas; no altera el nivel
- sin ajuste por categoría
- resultado visible: número + estado CALIBRANDO
- número y etiqueta CALIBRANDO en ámbar; arco del medidor puede ser cyan

Calibración inicial:
- empieza en CALIBRANDO
- se consolida con 5 partidos computables + al menos 3 rivales distintos
- Nivel visible desde el inicio
- no reescribir historial

Recalibración:
- usa el mismo cuestionario V1.3 vigente
- cooldown 90 días
- cuestionario pesa 25%
- desplazamiento provisional máximo ±0.5 respecto del nivel consolidado
- durante RECALIBRANDO el nivel consolidado anterior sigue siendo el oficial para Ranking/comparaciones
- cierra con 3 partidos computables + 2 rivales distintos
- ventana máxima 120 días
- historial/eventos previos se preservan

Tratamiento de cuentas existentes:
- NO recalcular ni resetear niveles existentes V1.1/V1.2
- CALIBRANDO/CALIBRADO existentes conservan exactamente su estado/nivel
- un cuestionario V1.2 incompleto puede reiniciar solo ese flujo incompleto bajo V1.3
- cuentas existentes usarán V1.3 únicamente si hacen recalibración voluntaria futura
- no reescribir niveles históricos ni rankings publicados

Backend validado en Staging:
- Edge `officialize-onboarding` ACTIVE v13, JWT ON
- V1.3 server-backed verificado con alta real
- snapshot de `level_states` antes/después del deploy V1.3 sin cambios en cuentas existentes
- progreso de cuestionario aislado por signup/account mediante scopeKey
- volver desde OTP reconstruye Nivel ya confirmado desde `signupDraft.nivelState/nivelAnswers` y no obliga a repetir cuestionario

QA humano final:
- adaptatividad: PASS
- slider vertical y pulido h3: PASS
- resultado CALIBRANDO: PASS
- Home Estado Cero asociada al onboarding: PASS
- intro final h7: PASS en iPhone
- intro final:
  - kicker `ANTES DE EMPEZAR`
  - título `PENSÁ EN TU JUEGO HABITUAL`
  - `No en tu mejor ni en tu peor partido. Cuanto más realista seas, mejor será tu punto de partida en BRAMU.`
  - `Después, tus partidos lo van ajustando.`
  - `5 PREGUNTAS · CERCA DE 2 MINUTOS`
  - CTA `EMPEZAR`

Commit funcional final aprobado de intro:
- `a15cb592478d1e16152e0d13c022fb2d75fb18a1`
- Vercel SUCCESS

## 2. Fuente maestra objetivo

Después de este cierre, la única fuente maestra funcional/técnica de Nivel debe ser:

`docs/BRAMUlab/Nivel_BRAMU.md`

Debe absorber lo que siga vigente de:
- `Nivel_BRAMU_Formula_V1.5.md`
- `Nivel_BRAMU_Implementacion.md`
- documentos V1.3 de Pre_Production listados abajo
- evidencias finales del Issue #25

El nuevo `Nivel_BRAMU.md` debe distinguir con claridad:
1. propósito y relación con Ranking;
2. estados;
3. onboarding V1.3;
4. fórmula inicial V1.3;
5. calibración y recalibración;
6. motor de partidos `nivel_bramu_v1_0` y sus reglas vigentes;
7. confiabilidad/evidencia/inactividad;
8. invitados y disponibilidad de evidencia, solo según reglas vigentes reales;
9. persistencia/versionado/autoridad backend;
10. UX visible vigente;
11. tratamiento de cuentas existentes/migraciones;
12. pruebas/evidencia de cierre;
13. límites conocidos y decisiones futuras, claramente separadas de lo vigente.

NO conservar como vigente texto V1.1/V1.2 que contradiga V1.3.

## 3. Documentos Nivel consumidos a retirar del árbol activo

Una vez absorbido su contenido vigente y verificado que no se pierde ninguna regla necesaria, retirar:

Raíz:
- `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
- `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`

Pre_Production:
- `docs/BRAMUlab/Implementacion/Pre_Production/110_Recuperacion_Chat_Nivel_BRAMU_02OCT.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/111_Handoff_Implementacion_Nivel_V13_02OCT.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/112_Resultado_V0428_Nivel_Inicial_V13_02OCT.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/113_Handoff_V0428_h3_QA_Humano_02OCT.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/114_Resultado_V0428_h3_Pulido_QA_02OCT.md`

No moverlos a Archivo solo por conservarlos: Git ya preserva historial.

No borrar documentación general de V04/Backend/Pre-Production que también sirve a otros sistemas en esta ronda. Solo retirar estos documentos claramente consumidos por Nivel.

## 4. README

Actualizar `docs/BRAMUlab/README.md` para que:
- muestre el estado real `BRAMUlab V04.28 / 04.28-h7`;
- marque Nivel BRAMU V1.3 como cerrado en Staging;
- enlace `Nivel_BRAMU.md` como única fuente maestra de Nivel;
- elimine referencias activas a QA humano pendiente;
- elimine referencias activas a los handoffs que se retiren;
- no presente V1.2 como estimador inicial vigente;
- mantenga `nivel_bramu_v1_0` como motor de partidos vigente;
- no invente Production ni diga que fue desplegado allí.

## 5. Issue #25

Después de verificar el diff documental:
- dejar comentario final de cierre con resumen factual;
- cerrar Issue #25 como completed.

## 6. Límites

Este cierre es DOCUMENTAL.

NO tocar:
- JS/CSS/HTML de la app;
- tests funcionales salvo que solo existan referencias documentales rotas y sea imprescindible;
- Supabase;
- Edge Functions;
- DB;
- main;
- Production;
- BRAMUlive.

No cambiar fórmula ni decisiones de producto.

## 7. Criterio de éxito

Al terminar:
- existe una sola fuente maestra vigente de Nivel: `Nivel_BRAMU.md`;
- no quedan contradicciones activas V1.2/V1.3 en la documentación de autoridad;
- los 7 documentos consumidos arriba ya no están en el árbol activo;
- README refleja h7/PASS final;
- Issue #25 queda cerrado;
- un agente nuevo puede entender Nivel vigente leyendo README → Nivel_BRAMU.md sin reconstruir la historia.
