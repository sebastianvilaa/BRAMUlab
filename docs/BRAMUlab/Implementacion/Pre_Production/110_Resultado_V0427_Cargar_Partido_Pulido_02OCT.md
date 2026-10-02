# 110 — V04.27: pulido de Cargar partido (#24) + residual RECALIBRANDO (#26)

**Versión:** `BRAMUlab V04.27` · **Bundle:** `04.27-h1` · Base funcional V04.26 `ed8b589`. Handoff 109 consumido. #24 y #26 siguen abiertos (gate Central / QA humano).

Cambios: ver `Cargar_Partido.md` §9. Archivos: `app.js`, `store.js` (borrador), `index.html`, `styles.css`, versionado, `v0427-cargar-partido-pulido.test.mjs` (reemplaza al v0426), ajustes en `v0425` (#26).

**Tests:** Node 712/715; solo fallan los 3 preexistentes (h19-B, h21-9, h23). Verificación local en Browser pane (cuenta local): labels fuera de tarjeta, wheels 6–6 con SIGUIENTE disabled, borrador guardado, navegación a Inicio, aviso CONTINUAR/EMPEZAR DE NUEVO y restauración exacta.

**No verificado:** wheel/SIGUIENTE en iPhone real, restauración del borrador en sesión server-backed con invitado real (cubierto por test estático de `playerIds`/`kind`), RECALIBRANDO en pantalla real (cubierto por test de condición).

## Hotfix h2 (bundle `04.27-h2`)
- #26: RECALIBRANDO ahora usa la presentación consolidada completa en Home y Mi Perfil (antes solo el color): sin `CALIBRANDO · X / 5`, sin progreso ni módulo de evolución de calibración inicial.
- Modal `Tenés un partido sin terminar`: acciones apiladas (CONTINUAR arriba, EMPEZAR DE NUEVO debajo, ancho completo, sin partir línea) vía 8º parámetro opcional de `confirmAction` y clase `overlay--stacked-actions`; el resto de los modales no cambia.
- `Cargar_Partido.md` depurada a una sola verdad V04.27.
