# BRAMU Lab
## Informe: resolución del conflicto de nombres pendiente (5 documentos)

Complementa a `BRAMU_Rama_Jugador_Reorganizacion_Documental_Informe.md`, que había dejado estos 5 archivos sin tocar por conflicto de nombres.

## 1. Comparación

Los 5 documentos existían en dos ubicaciones: la raíz del repo (trackeados en git, pero borrados del disco desde antes de esta ronda de trabajo) y `Reportes y consolidados/BRAMUlab/` (presentes en disco, sin trackear). Comparé el contenido byte a byte (`diff`) entre la versión que git tenía guardada en su historial (`git show HEAD:"archivo"`) y la copia local:

| Archivo | Resultado |
|---|---|
| `Consolidado V10.md` | Idénticos |
| `Consolidado V11.md` | Idénticos |
| `Reporte V10 - para ChatGPT.md` | Idénticos |
| `Reporte V11 - para ChatGPT.md` | Idénticos |
| `Reporte V12 - para ChatGPT.md` | Idénticos |

**Los 5 pares son idénticos.** No hubo ningún caso de contenido divergente.

## 2. Resolución aplicada

Al ser idénticos, correspondía la primera rama de la instrucción: conservar una sola copia en la carpeta definitiva.

- `git rm --cached` confirmó el borrado (ya presente en el working tree desde antes) de las 5 rutas viejas de la raíz del repo.
- Las 5 copias locales (idénticas) se movieron a su ubicación definitiva: `Consolidado V10/V11.md` → `docs/bramulab-partidos/consolidados/`; `Reporte V10/V11/V12 - para ChatGPT.md` → `docs/bramulab-partidos/reportes/`.
- Git detectó automáticamente los 5 movimientos como renames (100% de similitud de contenido entre la ruta vieja borrada y la ruta nueva agregada), así que el historial de git de estos archivos queda preservado.
- No se usó la carpeta `archivo-conflictos/` — esa solo aplicaba si el contenido hubiera sido distinto.
- `Reportes y consolidados/BRAMUlab/` quedó vacía y se eliminó (carpeta, no documento).
- `INDICE.md` actualizado: la nota de "pendiente sin resolver" se reemplazó por la nota de conflicto resuelto.

## 3. Verificación de que no se perdió ningún archivo

Conteo de archivos del repo (excluyendo `bramulab/`, `bramulab-partidos/` y `.DS_Store`) antes y después de este paso específico: **59 → 59** — sin cambio neto, tal como corresponde a un movimiento interno (5 archivos salieron de una ubicación, los mismos 5 entraron en otra). Comparación de listados completos (`diff`) confirma que los únicos cambios son exactamente esos 5 archivos cambiando de ruta, más este mismo informe nuevo.

## 4. Estado final de `docs/bramulab-partidos/`

- `consolidados/`: 9 archivos — V10, V11, V12, "V12. Express", V13, V13.2, V13.3, V13.4, V14.
- `reportes/`: 7 archivos — V10, V11, V12, V13, V13.3, V13.4, V14.

Con esto, **no queda ningún documento pendiente por conflicto** de los detectados en la reorganización.
