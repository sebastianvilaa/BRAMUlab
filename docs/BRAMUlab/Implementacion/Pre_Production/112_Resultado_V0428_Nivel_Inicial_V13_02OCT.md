# Resultado — V04.28 · Nivel BRAMU inicial V1.3

**Fecha:** 2 de octubre de 2026 · **Rama:** `staging` (base `3d44444`) · **Versión:** BRAMUlab V04.28 / bundle 04.28-h1
**Definición de producto:** handoff 111 (referencia temporal; no se consolidó `Nivel_BRAMU.md` — va después del PASS humano).
**Estado:** implementado y verificado en local; **pendiente** deploy de Edge Function, comparación de cuentas V1.2 y QA humano (ver "Qué falta").

## Qué cambió

- `questionnaire_version = nivel_inicial_v1_3`; `algorithm_version = nivel_bramu_v1_0` (sin cambios; `level.js` y `match-level-engine.js` byte a byte iguales).
- `bramulab/level-calibration.js` (compartido por navegador y Edge Function vía symlink): reemplaza el estimador V1.2 por la fórmula V1.3 (anclas, interpolación 0…9, ramas 4,1/6,4, media 20 %, clamp 1–9, 4 decimales, confianza 0,15/0,10 por dispersión) + estado puro del cuestionario adaptativo (`answerQuestion`, `reconcileQuestionnaireState`: un cambio de rama descarta las respuestas posteriores). El banco de textos se generó **desde el .md del handoff** (no retipeado). Eliminados: camino rápido, autoevaluación, técnica, entrenamiento, años/frecuencia, categoría/mapas, `confirmInitialLevelV1_1/V1_2`. Se conserva (sin cambios de regla) calibración 5+3 y recalibración (25 %, ±0,5, 3+2, 90/120 días); su cuestionario es ahora el V1.3.
- UI (`app.js`/`index.html`/`styles.css`): intro con el copy aprobado → 5 preguntas con las 4 descripciones completas, tap en descripción (0/3/6/9) + slider vertical discreto de 10 posiciones sobre el mismo valor, nada preseleccionado, CONTINUAR disabled hasta interactuar, azul BRAMU, sin A/B/C/D ni gradiente. Resultado = número + `CALIBRANDO` + explicación vigente (sin categoría textual). "Revisar respuestas" conserva respuestas (aviso por dispersión ≥ 2,0, no bloquea).
- Persistencia: `Store.NIVEL_PROGRESS` (`bramulab.nivelProgress.v13`, versionado, se limpia con el borrador). Borradores V1.2 (incompletos o confirmados sin oficializar): `stripLegacyNivelDraft` descarta **solo** las claves de Nivel; cuenta/email/perfil/username intactos.
- Backend: `officialize-onboarding` acepta `{mode:'full', questionnaireVersion, quizAnswers:{panorama,ritmo,ataque,defensa,decisiones}}` (enteros 0…9), rechaza `quick`/otra versión/valores inválidos, recalcula con el motor compartido y persiste `mode='full'` + versión V1.3. **No hay migración** (la restricción `quick|full` no obligó a ninguna; la RPC ya es idempotente solo-PENDIENTE).
- Scripts live de Staging (`supabase/tests/verify-bloque3/4/5/6`, `verify-nivel-parity`) migrados a payloads V1.3 (no se ejecutaron: sin credenciales). Nuevo `supabase/tests/snapshot-level-states-readonly.sql` (solo SELECT) para el before/after.

## Tests

- Node (`bramulab/*.test.mjs` + `_shared`): **774/777**; los 3 fallos (h19-B, h21-9, h23) son **preexistentes** (idénticos en la base `3d44444`). Nuevo `v0428-nivel-inicial-v13.test.mjs`: 30 tests cubren los 39 puntos del encargo (fórmula, 10 posiciones, monotonicidad, umbrales 4,1/6,4 con vectores reales, mínimos/máximos, clamp, 10⁵ combinaciones sin NaN, spread 1,9999/2,0, paso intermedio ≤ 0,134, irrelevancia de años/frecuencia/etc., ausencia de quick, adaptatividad/volver atrás/invalidación, UI, reload, paridad cliente-servidor, versiones, regresión del motor con fixture pineado, borradores V1.2, recalibración).
- `tests.html` (navegador): 1495/1503; los 8 fallos son V034-* **preexistentes** (la base da 1557/1565; la diferencia son tests V1.2 retirados). Los tests de estimador V1.2 se reemplazaron por un smoke V1.3.
- Verificación manual en Browser pane (375 px, cuenta local, flag de Nivel): intro, tap en tarjeta, drag por el riel (snap a 10 posiciones), thumb entre dos tarjetas, rama alta/baja con textos distintos, cambio de P1 que re-pregunta P2, volver desde resultado, reload en P3 conservando progreso, resultado 3,4 + CALIBRANDO, confirmación y estado guardado `nivel_inicial_v1_3`/`nivel_bramu_v1_0`.

## Limitaciones reales / no verificado

- **Edge Function y Supabase Staging:** Claude Code no tiene CLI ni credenciales → no desplegué la función ni tomé el snapshot. Hasta que Central despliegue la función, el alta nueva en Staging fallará al oficializar (el payload nuevo no lo entiende la versión vieja) y, al revés, un bundle viejo fallaría contra la función nueva.
- **Perfiles del handoff §9:** el handoff solo publica referencia y resultado de cada perfil, **no sus posiciones de slider**; los vectores del test son arquetipos coherentes, no las respuestas originales (no se pueden reproducir 2,98/4,72/5,05/5,65/5,95/6,81 exactos).
- **Táctil real:** probado con eventos de puntero en el Browser pane; el touch en iPhone queda para QA humano. El layout del riel se calcula en JS a partir de la altura real de los textos (recalcula en resize).
- RECALIBRANDO: solo motor/tests (la app no tiene aún UI de recalibración); sin UX nueva, como se pidió.

## Qué falta (en orden)

1. **Central:** snapshot read-only `snapshot-level-states-readonly.sql` en Staging → deploy `officialize-onboarding` → mismo snapshot (las filas preexistentes deben quedar idénticas en las 8 columnas) → opcional `verify-nivel-parity.mjs`.
2. Confirmar build Vercel de Staging (V04.28 / 04.28-h1).
3. **QA humano iPhone (Sebastián):** slider táctil (tap + arrastre + 10 posiciones), volver y cambiar de rama, reload, resultado número + CALIBRANDO, aviso de dispersión.
4. Solo después: consolidar `Nivel_BRAMU.md` como fuente única y cerrar #25. No se promovió nada a Production.
