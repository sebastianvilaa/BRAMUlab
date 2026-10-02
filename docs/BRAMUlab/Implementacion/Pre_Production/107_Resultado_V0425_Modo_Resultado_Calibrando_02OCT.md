# 107 — V04.25: result board, edición de set completo y CALIBRANDO (#24 / #26)

**Fecha:** 02/10/2026 · **Versión:** `BRAMUlab V04.25` · **Bundle:** `04.25-h1` · Issues #24 y #26 siguen abiertos (QA real en iPhone).

- **Result board:** matchup A verde arriba / B celeste abajo, bloques teñidos completos, nombres 18 px (2 líneas). Mensaje de tercer set integrado (sin margen negativo, centrado, ancho completo).
- **Bug funcional (editar set anterior):** `advanceDraftSide` cerraba el keypad e intentaba confirmar un par a medio corregir cuando el otro lado ya tenía el valor viejo; `reopenManualSet` además dejaba el keypad cerrado. Ahora reabrir entra al modo resultado y el keypad pasa al otro lado hasta completar el set (`!manualSideEntered[otherSide]`). Motor/validaciones/poda intactos. Fecha/Hora/Lugar y selección de jugadores sin tocar.
- **#26:** `buildLevelCellHTML` (NIVEL BRAMU → valor → CALIBRANDO), `setLevelValueText(..., calibrating)`, perfil público server-backed con sub `CALIBRANDO`, línea de Compañeros/Rivales. Home/Mi Perfil: número ámbar mientras calibra.
- **Tests:** `v0425-modo-resultado-calibrando.test.mjs` ejecuta las funciones REALES de `app.js` en un sandbox con DOM stub (carga 2-0, 1-1 → set 3, reapertura de Set 1 con Set 3 pendiente, poda por cambio de ganador, Americano). Ajustado el test mellizo de `advanceDraftSide` (la corrección de resultados Propose queda como estaba). Sin verificación visual en dispositivo.
