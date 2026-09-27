# BRAMUlab — Hotfix visual punto 5 del gate h16

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Origen:** gate visual real sobre `04.11-h15`  
**Alcance:** únicamente criterio 5 de `45_Handoff_Cierre_UX_h13_27SEP.md`.

## Evidencia

Work verificó sobre Staging real:

- selector `¿Qué está mal?`: PASS;
- opciones `El resultado` / `Un participante`: PASS;
- CTA de entrada: FAIL visual porque se veía `REPORTAR UN ERROR`, con demasiado peso.

El DOM ya contenía correctamente:

`Reportar un error`

La causa era CSS global:

`.btn-secondary { text-transform: uppercase; ... }`

## Corrección

**AGREGAR** override local exclusivo de `#b6-report-error-btn`:

- `text-transform:none`;
- `font-weight:600`;
- `letter-spacing:0.01em`.

Mantiene:
- misma familia secundaria;
- borde/texto rojo suave;
- mismo alto/touch target;
- misma acción y disponibilidad.

No se modifica el sistema global de botones.

## Versionado

Bundle `04.11-h15 → 04.11-h16` para invalidar cache.

## Gate

Retest visual requerido únicamente para criterio 5 antes del cierre Central.

Los criterios 1–4 y 6–11 no se reabren por este cambio CSS localizado.
