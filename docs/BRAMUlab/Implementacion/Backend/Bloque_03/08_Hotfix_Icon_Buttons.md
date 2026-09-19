# Backend Bloque 3 — Hotfix visual de icon buttons

**Fecha:** 19/09/2026  
**Estado:** aplicado en `staging`; validación visual pendiente.

## Síntoma

Después de completar correctamente el onboarding real y llegar a Home, los botones de cabecera de laboratorio, Ranking y notificaciones se mostraban como cuadrados blancos con estilo nativo del navegador.

## Causa

La clase global `.icon-btn` seguía siendo utilizada por distintas vistas, pero su regla CSS histórica había quedado físicamente dentro de una sección de estilos asociada al marcador en vivo. Durante la separación de BRAMUlive esa sección fue retirada y la regla global se perdió con ella.

## Cambio

Se restauró exactamente la regla global que existía antes de la separación:

`.icon-btn{ background:none; border:none; color: var(--paper-dim); font-size:20px; padding:4px 8px; cursor:pointer; line-height:1; }`

Se ubicó junto al header de Home, fuera de cualquier bloque de estilos de BRAMUlive.

Bump de caché frontend:

`04.10-h5 → 04.10-h6`

No se modificó lógica, backend, Supabase, Nivel, `main` ni BRAMUlive.
