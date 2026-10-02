# 106 — V04.24: UX Cargar partido + cierre visual de Grupos

**Fecha:** 02/10/2026 · **Issues:** #24 implementado, #23 técnicamente implementado (ninguno se cierra; gate Central + QA humano) · **Versión:** `BRAMUlab V04.24` · **Bundle:** `04.24-h1`

**Cargar partido (`app.js`/`index.html`/`styles.css`):** modo resultado (`#view-manual-load.is-score-entry`, derivado de `manualKeypadOpen` en `syncManualScoreEntryChrome`): oculta tarjetas de armado, matchup compacto A verde / B celeste, fichas de sets (reabribles vía `reopenManualSet`), resultado actual sobre el teclado, bottom nav oculta con keypad y restaurada al cerrar/salir (`showView` re-sincroniza). Motor de score, teclado y validaciones sin cambios. Fecha/Hora en un solo shell; Hora = `input type=time` nativo (se eliminó la máscara); Lugar + “Usar ubicación” en un renglón. Fuente maestra nueva: `Cargar_Partido.md`.

**Grupos:** ayuda como bottom sheet acotado (header/X fijos, body scrolleable, safe area) con copy final; “Cómo sumás puntos” compacto sin umbrales técnicos; desglose con subtítulo “Cuentan tus 2 mejores partidos de la semana”, valor real siempre, lima solo `counted && points > 0`, sin “No entra en tus 2 mejores”. `Grupos_BRAMU.md` limpiado de restos de top 3.

**Tests:** nuevo `v0424-cargar-partido-grupos.test.mjs` (estructural/estático: `app.js` no tiene harness de DOM por diseño); tests de Grupos actualizados. Verificación visual en dispositivo real: pendiente (QA de Sebastián en iPhone, en particular teclado + modo resultado y la hora nativa).
