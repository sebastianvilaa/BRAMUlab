# BRAMUlab — Hotfix Central h20: copy neutral de corrección en Home

**Fecha:** 27/09/2026  
**Baseline previa:** `04.11-h19`  
**Resultado:** `04.11-h20`

Durante la revisión Central posterior a h19 se detectó que el carrusel de Home usaba
`La otra pareja propuso una corrección` para cualquier corrección activa.

`get_my_matches` no expone en esa lista liviana quién propuso la corrección, por lo que ese
copy podía ser falso para el propio proponente.

No se abre backend en esta ronda. Se reemplaza únicamente por un copy neutral y verdadero:

- título: `CORRECCIÓN ABIERTA`;
- texto: `Hay una corrección abierta en este partido. Revisá el detalle.`

La distinción actor-relativa permanece en Resumen, donde `get_match_detail` sí trae la
información necesaria.

No cambia lógica, prioridad ni navegación del carrusel.

**PENDIENTE DE REVISIÓN VISUAL DIRECTA DE SEBASTIÁN**
