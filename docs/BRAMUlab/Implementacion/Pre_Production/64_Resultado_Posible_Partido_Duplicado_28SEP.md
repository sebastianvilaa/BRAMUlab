# Resultado — Posible partido duplicado (handoff 63)

**Fecha:** 28/09/2026 · **Entorno:** staging · **Bundle:** 04.11-h26

## Decisión técnica
Solo frontend. `create_or_attach_match` ya devuelve `validated_match_needs_bloque6_correction` + `matchId` para el caso (mismos 4 + parejas + ±3 h + candidato validado + score distinto); no se tocó backend, ventana ni detección. No hubo migración/deploy de Supabase que aplicar.

## Cambios (`bramulab/app.js`, `index.html`)
- Ese código ya no cae en el error genérico: el borrador de outbox queda `necesita_revision` con `lastError {code, matchId}` y se abre el modal de desambiguación existente (`#ambiguous-match-overlay`) adaptado a **un único candidato** (título/texto propios; el resto de la lista de múltiples candidatos no cambia).
- Home/Historial/Resumen muestran **POSIBLE PARTIDO DUPLICADO** (no NECESITA REVISIÓN) y el Resumen ofrece **Revisar** para reabrir el modal. `NECESITA REVISIÓN` sigue para el resto de errores de negocio.
- **Es el mismo partido** → descarta el borrador (no crea partido), abre el Resumen del oficial y el sheet de corrección vigente (`openProposeCorrection`) precargado con el marcador nuevo (mapeado por pareja). Sin ventana de 3 días o con corrección ya pendiente: solo se explica.
- **Es otro partido** → `forceNewFromAmbiguous` (`disambiguationForceNew`), sin cambios.
- Bump bundle 04.11-h26 (store/index/sw/version.json). Se corrigió el test h21 de quartet, que tenía h24 hardcodeado y ya fallaba.

## Pruebas
`possible-duplicate-h26.test.mjs` (5 tests focales sobre label, outcome, modal, ramas de resolución, banner). Suite Node completa: 372/372 (bajo costo, se corrió por el bump del quartet). Los casos 1, 5 y 6 del handoff son comportamiento de servidor sin modificar.

**Pendiente:** verificación visual/manual en Staging real por Sebastián (caso mismos 4 + otro marcador).
