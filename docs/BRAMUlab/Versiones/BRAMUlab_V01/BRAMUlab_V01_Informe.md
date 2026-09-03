# BRAMUlab_V01
## Informe — qué se implementó, verificó y corrigió

**Tipo de documento:** informe retrospectivo (síntesis documental de informes ya cerrados, no una verificación nueva).
**Fecha de esta síntesis:** 03/09/2026.
**Estado actual de la app:** commit `910975f`, tag `v2.2.1`. Última rama de trabajo cerrada: Etapa 4.2 (Carga manual y jerarquía).
**Cómo leer este documento:** cada sección corresponde a una ronda ya implementada y publicada. El detalle completo (archivos tocados, casos de test, capturas, verificación manual paso a paso) vive en el informe original de cada ronda, preservado en [`Archivo/`](Archivo/) y linkeado desde cada sección. Este documento es el resumen fiel, no el reemplazo.

---

## 0. Arquitectura vigente (acumulada, no por versión)

Módulos de lógica pura, sin DOM, mismo patrón desde el origen del proyecto:
- `engine.js` / `stats.js` — motor del marcador y estadísticas del producto anterior, reusados sin cambios.
- `player-home.js` (`window.PH`) — agregaciones del jugador: forma reciente, rachas, compañero/rival frecuente, hitos, actividad/efectividad 30 días, evolución de Nivel BRAMU.
- `match-load.js` (`window.PLMatchLoad` / `ML`) — toda la lógica de "Cargar partido jugado": construcción de sets, validación (incluida la validación preventiva del teclado), resolución de set activo.
- `store.js` — persistencia (`localStorage`), incluye `Store.normalizePlayerName`, `Store.upsertHistory`, `Store.patchHistoryEntry`.

No existe arnés de test para DOM/`app.js` en ningún punto de esta línea — toda la navegación e interacción visual se verificó a mano en browser (Claude Browser tool, mobile 375×812 + tablet/desktop), no en `tests.html`. `tests.html` solo cubre las funciones puras de los módulos de arriba.

---

## 1. Home Beta (Etapa 2)

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Etapa_2_Informe.md`](Archivo/BRAMU_Rama_Jugador_Etapa_2_Informe.md). Commit `0e3a132`, publicado a `main`.

Implementado: `player-home.js` nuevo; pantallas `view-player-home`/`view-ranking`/`view-profile`; nav inferior de 5 ítems (oculto durante partido en vivo/setup); menú compacto en Setup; modal "¿Quién sos?"; navegación contextual de "Cargar partido jugado" según origen (`finishedSnapshot.mode === 'manual'`); texto de "Forma reciente" corregido para el caso de exactamente 1 partido. Cache `v14` → `v14.1`.

**Verificación:** 343/343 tests verdes (323 preexistentes + 20 nuevos). Verificación manual completa de las 5 rutas de nav inferior, ambos puntos de entrada de carga manual, y que el partido en vivo no se ve afectado.

**Limitaciones deliberadas, no bugs:** identidad sigue siendo por nombre de texto (no cuentas reales); ranking/categoría/tendencia en la tarjeta de identidad eran placeholders demo centralizados (`PLAYER_PROFILE_DEMO`), marcados BETA.

## 1.1. Corrección funcional post-Etapa 2

**Fuente:** [`Archivo/BRAMU_Rama_Jugador_Correccion_Funcional.md`](Archivo/BRAMU_Rama_Jugador_Correccion_Funcional.md)

**Bug real corregido:** Jugador 1 no estaba vinculado a `currentPlayerName` — un partido autocargado podía no aparecer en el propio Home de quien lo cargó. Se agregó `resolvePlayerOneName()`, guardia de identificación obligatoria antes de abrir carga manual desde Home, y "Cambiar jugador" pasó a "Cerrar sesión". 349/349 tests (6 nuevos).

---

## 2. Semántica de fecha (Etapa 3 Fase 1)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Informe.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_1_Semantica_Fecha_Informe.md). Commit `39cb821`.

**Causa raíz real:** todas las lecturas de "cuándo se jugó" usaban `finishedAt` (hora de guardado) en vez de la fecha real jugada — cargar el partido de hoy después del de ayer promovía incorrectamente al recién guardado. Se agregaron `getPlayedAt()` y `comparePlayedAtDesc()` (puras, en `player-home.js`), se corrigieron los 3 flujos de guardado (`finishMatchManual`, `finishMatch`, `finishMatchGames`) para escribir `playedAt`, y se corrigieron 5 superficies de lectura. Desempate: `playedAt` → `createdAt` → `finishedAt` → `matchId`.

**Verificación:** 349→364 tests. Nota de entorno (no bug de producto): una Service Worker cacheada de forma obsoleta produjo una falsa lectura de "349/349 en producción" hasta forzar la limpieza del cache — quedó documentado como gotcha de verificación.

---

## 3. Acceso y registro (Etapa 3 Fase 2 + correcciones post-prueba)

**Fuentes:** [`Archivo/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Informe.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_2_Acceso_Registro_Informe.md) (commit `087634e`) y [`Archivo/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Informe.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_2_Correcciones_Postprueba_Informe.md) (commit `e59d363`).

Implementado: hoja `#register-sheet-scrim` con 3 niveles mutuamente excluyentes; banner de partido en curso; modal de confirmación de descarte; `tryAutoResumeActiveMatch()`; navegación no destructiva a Home desde el header del partido en vivo. **Bug latente corregido de paso:** `#confirm-overlay` estaba anidado dentro de `#view-match` (mismo defecto que V13.2/V13.3 ya habían corregido en el producto anterior) — reubicado a overlays globales. Versión subida a v1.1.

Correcciones post-prueba en iPhone real: `bootDefaultScreen()` reemplaza a `tryAutoResumeActiveMatch()` para decidir Home vs. resume vs. identificación; banner reescrito a layout horizontal compacto; nuevo helper central `formatLiveScoreLabel()`/`formatFinishedSetSegment()` para el marcador parcial completo; título de hoja unificado a "REGISTRAR PARTIDO". 382/382 tests.

**Nota de proceso (ya resuelta):** los commits de estas dos rondas usaron prefijos paralelos "V15"/"V16" en el mensaje, en vez de la versión real de la app — corregido explícitamente por la política introducida en el hotfix v1.2.1 (§4) y respetado sin excepción desde entonces.

**Verificación parcial documentada como tal:** la verificación visual/táctil completa en mobile/tablet fue solo parcial en la ronda de Acceso y Registro (el panel de verificación quedó oculto a mitad de sesión) — se completó con checks estructurales de DOM en su lugar, y `prefers-reduced-motion` se verificó solo por inspección de código, no en vivo.

---

## 4. Hotfix v1.2.1 — Volver al inicio

**Fuente:** [`Archivo/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Informe.md`](Archivo/BRAMU_Lab_v1.2.1_Hotfix_Volver_al_Inicio_Informe.md). Commit `2ec46aa`.

**Causa raíz:** 3 controles (`#summary-new-btn`, `#analysis-home-btn`, `#menu-home`→`goHome()`) tenían lógica condicional heredada de antes de que existiera Home, cayendo por defecto a `showView('setup')`. Corregidos los 3 para llamar `openPlayerHome()` incondicionalmente. Sin tests nuevos (no había lógica pura nueva) — cubierto por 12 escenarios de verificación manual. Primer commit en seguir la nueva regla de nombrado por versión real.

---

## 5. Rediseño de carga manual — v1.3

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Informe.md`](Archivo/BRAMU_Lab_Etapa_3_Fase_3_Carga_Partido_Jugado_Informe.md). Commit `fdaa97c`.

Implementado: pantalla estilo marcador con Jugador 1 fijo, hoja de selección de rival (recientes + búsqueda + invitado), teclado numérico fijo no-modal, línea compacta de formato/puntuación, guardado/edición vía Resumen compartido. Módulo nuevo `match-load.js`. **Decisión de arquitectura:** Jugador 1 (equipo A) pasa a ser siempre `currentPlayerName`, sin importar el origen de entrada — esto volvió obsoleto `resolvePlayerOneName()`, que se borró junto con sus tests. Edición real desde cero: `openManualLoadScreen(origin, editMatch)` precarga un partido existente y reutiliza el mismo `matchId` vía `Store.upsertHistory` (nunca duplica). 414/414 tests (−6 por código muerto eliminado, +38 nuevos).

## 5.1. Hotfix v1.3.1

**Fuente:** [`Archivo/BRAMU_Lab_v1.3.1_Hotfix_Transicion_Post_Guardado_Informe.md`](Archivo/BRAMU_Lab_v1.3.1_Hotfix_Transicion_Post_Guardado_Informe.md). Commit `0f04fd5`.

**Bug real, encontrado por revisión externa de ChatGPT en producción** (no detectado por los 414 tests ni la verificación manual propia): reabrir una celda de set ya cargada dejaba el teclado numérico abierto sin invalidar el borrador, permitiendo tocar Guardar mientras seguía abierto; el teclado (sin scrim, a propósito, para no tapar el marcador) terminaba sobre el Resumen tras guardar. Corregido haciendo que `attemptSaveManualMatch()` cierre explícitamente todos los overlays propios de la pantalla antes de delegar el guardado, más un fix de `max-width` para el mismo panel en desktop. **Nota de método:** el diagnóstico textual de la revisión externa era parcialmente impreciso (decía que toda la pantalla de carga "tapaba" el Resumen; en realidad era específicamente el panel del teclado, de z-index más alto) — se verificó con `getComputedStyle` antes de confiar en la causa reportada.

---

## 6. Home integral — v2.0

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Informe.md`](Archivo/BRAMU_Lab_Etapa_4_v2_Experiencia_Integral_Informe.md). Commit de código `9fcad8c`, tag `v2.0`.

Implementado en una sola pasada (sin publicaciones intermedias, por instrucción explícita del consolidado): orden fijo del Home descrito en el consolidado (§7 de [`BRAMUlab_V01_Consolidado.md`](BRAMUlab_V01_Consolidado.md)). Nuevas agregaciones puras en `player-home.js`: `computeCurrentStreak`, `computeBestPartner` (reemplaza "compañero más frecuente" por "mejor compañero" con umbral mínimo de muestra), `computeActivity30d`, `computeEffectiveness30d`, `computeHitos`. 432/432 tests (18 nuevos).

**Regresión real encontrada y corregida antes de publicar** (no llegó a producción): al reescribir el CSS del Home se borraron `.pastilla--identity` y clases relacionadas por parecer muertas — pero la pantalla de Perfil (no tocada por este consolidado) también las usaba para su propia tarjeta de nombre. Se detectó por chequeo sistemático (grep de cada clase/id referenciada en `index.html`/`app.js` contra lo que `styles.css` define) antes de dar por cerrado el trabajo, no por click manual. Se restauraron las 4 reglas.

---

## 7. Historial y evolución del Nivel BRAMU — v2.1

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Informe.md`](Archivo/BRAMU_Lab_Etapa_4_1_v2_1_Historial_y_Evolucion_Informe.md). Commit `e5b2870`, tag `v2.1`.

**Ronda disparada por revisión externa (ChatGPT) de v2.0 en producción**, que encontró dos bugs que el informe de v2.0 había dado por corregidos/funcionando — ambos reales, con causa raíz instructiva:

1. **"Volver" de Historial siempre iba a Configurar partido, nunca a Home** — `openHistoryScreen()` nunca registraba cuál de sus dos puntos de entrada reales se había usado. Corregido con una variable de módulo `historyOpenedFrom` fijada explícitamente por quien llama.
2. **Las hojas inferiores medían 480px en tablet/desktop en producción, pese a que el informe de v2.0 afirmaba 640px.** Causa raíz: una regla de cascada CSS — la regla responsive de 640px estaba definida *antes* en el archivo que la regla base incondicional de 480px; a igual especificidad, gana la que aparece después en el archivo, sin importar el media query. **El informe de v2.0 estaba mal porque esa medida se había verificado solo visualmente/por intención, nunca con `getBoundingClientRect`.** Corregido moviendo la regla responsive inmediatamente después de la regla base, y subida a 768px por instrucción explícita de esta ronda.

Implementado además: filtros de Historial por propiedad (`classifyMatchOwnership`) y por modo (`matchModeCanonical`), con conteos en vivo sobre el historial completo; evolución simulada de Nivel BRAMU vía `PH.computeLevelEvolution()` — base 5.0, reglas de incremento explícitamente provisionales y aisladas para reemplazo futuro, redondeo en cada paso (no solo al final) para evitar drift de punto flotante, fuente única consumida por Home y por la nueva tarjeta de Perfil "EVOLUCIÓN DEL NIVEL BRAMU" (badge SIMULADO·BETA).

**Verificación destacada:** el ejemplo guiado de 8 partidos del consolidado se convirtió en un test real (`tests.html`), no solo en un chequeo manual — la secuencia de niveles resultante coincide dígito a dígito con la tabla del documento.

---

## 8. Carga manual y jerarquía visual — v2.2 (Etapa 4.2)

**Fuente:** [`Archivo/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Informe.md`](Archivo/BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Informe.md). Commit `e45eb35`, tag `v2.2`.

Implementado: nuevo namespace de tokens CSS `--court-*` (deliberadamente acotado a 5 superficies, no reemplaza los tokens globales); `ML.resolveActiveSetIndex()`, `Store.patchHistoryEntry()`; reuso de validación existente (`ML.canExtendSetDigits`, `E.isValidCompletedSetScore`) en vez de duplicar reglas. Decisión de diseño: el teclado muestra 0–9 siempre (no "0–7 en casos comunes" como sugería el consolidado), dejando que `canExtendSetDigits` deshabilite dinámicamente.

**Dos bugs encontrados y corregidos antes de publicar** (no llegaron a producción): un `Engine is not defined` que dejaba "Continuar" permanentemente deshabilitado, y un crash al navegar "Volver" desde Resumen cuando se llegaba vía la nueva pantalla "Partido guardado". 474/474 tests (9 nuevos). Aislamiento de `privateNote` verificado buscando un marcador literal en todas las pantallas. Las 14 pruebas de aceptación del consolidado se chequearon una por una.

**Este informe se cerró explícitamente "pendiente de revisión externa de ChatGPT y de la evaluación de Sebastián"** — lo cual produjo directamente el hotfix v2.2.1 (§9).

---

## 9. Hotfix v2.2.1 — validación preventiva del teclado y COMPARTIR en Análisis

**Fuente:** [`Archivo/BRAMU_Lab_v2.2.1_Hotfix_Teclado_y_Compartir_Informe.md`](Archivo/BRAMU_Lab_v2.2.1_Hotfix_Teclado_y_Compartir_Informe.md). Commit `910975f`, tag `v2.2.1` — **estado actual de la app**.

Reacción directa a revisión externa del v2.2 recién publicado. Dos hallazgos:

1. **La validación preventiva del teclado estaba incompleta** — solo topeaba dígitos por un techo de formato fijo, sin conocer el valor ya cargado del equipo contrario (ej.: tras cargar "2", el teclado seguía permitiendo "3", formando el imposible "2-3"). Corregido con `ML.computeValidNextDigits(digitsStr, format, otherValue)`, siempre resuelto contra `Engine.isValidCompletedSetScore` por candidato (sin pares hardcodeados), cubriendo automáticamente cualquier formato actual o futuro.
2. **COMPARTIR seguía visible en Análisis** — oculto en Resumen desde v2.0, pero nunca se replicó el ocultamiento en Análisis; descuido preexistente, no introducido por v2.2. Corregido con `hidden` en `#analysis-share-btn`.

483/483 tests (9 nuevos). El informe deja constancia de que la Etapa 4.2 queda cerrada con esto, sin ninguna ronda nueva autorizada todavía.

---

## 10. Notas de proceso que quedaron resueltas durante esta línea de trabajo

Estas dos inconsistencias aparecen en los informes originales pero ya fueron corregidas por el propio equipo, sin que quede nada pendiente de ellas — se listan acá solo como antecedente, no como TODO:

- **Nombrado de commits inconsistente**, luego autocorregido: dos commits de Fase 2 (Etapa 3) usaron prefijos "V15"/"V16" en vez de la versión real de la app; el hotfix v1.2.1 prohibió explícitamente seguir haciendo eso, y todos los commits posteriores (v1.2.1 en adelante) siguieron la versión real.
- **Ruta de cita incorrecta en el informe de v2.2**: cita sus fuentes de contexto visual como si vivieran en `docs/bramulab/consolidados/`, cuando en realidad estaban en `docs/bramulab/backlog-futuro/` y `docs/bramulab/auditorias/` (rutas de antes de esta reorganización). No afecta esta síntesis porque las rutas de origen ya no existen — ver equivalencia completa en la entrega de esta reorganización documental.

## 11. Verificación de producción

Cada ronda desde v1.3 en adelante incluye, además de los tests automatizados, una verificación explícita contra la URL pública real (no solo local) tras el deploy — confirmando que el Service Worker ofrece la actualización correctamente y que la versión nueva carga de verdad. Ver el informe original de cada ronda para el detalle paso a paso.
