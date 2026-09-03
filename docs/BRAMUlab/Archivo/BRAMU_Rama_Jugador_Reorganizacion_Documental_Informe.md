# BRAMU Lab
## Informe: reorganización documental (Plan 2 ejecutado)

Segundo trabajo de esta ronda, en un commit independiente del cambio de aplicaciones. No se tocaron `bramulab/` ni `bramulab-partidos/`.

---

## 1. Estructura final de carpetas

```
BRAMUlab/
├── bramulab/                                          (app — sin tocar)
├── bramulab-partidos/                                 (app — sin tocar)
├── docs/
│   ├── bramulab/
│   │   ├── consolidados/            (3 archivos)
│   │   ├── informes/                (6 archivos, incluye este mismo)
│   │   ├── auditorias/              (2 archivos)
│   │   └── backlog-futuro/          (2 archivos)
│   ├── bramulab-partidos/
│   │   ├── consolidados/            (7 archivos)
│   │   └── reportes/                (4 archivos)
│   └── identidad-visual/
│       ├── referencias-premier-padel/   (15 fotos)
│       └── (4 archivos de marca sueltos)
├── redes-sociales/                                     (6 imágenes)
├── INDICE.md                                           (nuevo)
├── .claude/                                            (sin cambios)
└── Reportes y consolidados/BRAMUlab/                   (quedaron 5 archivos, ver §3)
```

`Reportes y consolidados/Jugador/`, `Sistema Grafico/` y `Referencias visuales/` quedaron vacías y se eliminaron (carpetas, no documentos). `RRSS/` se renombró a `redes-sociales/`.

## 2. Archivos movidos o renombrados

**Con historial preservado (`git mv`, 15 archivos):**
- Los 12 documentos de `Reportes y consolidados/Jugador/` → `docs/bramulab/{consolidados,informes,auditorias,backlog-futuro}/`.
- 3 archivos de `Sistema Grafico/` (`Logo.png`, `Sistema Grafico.png`, `icono.png`) → `docs/identidad-visual/`.

**Sin historial previo que preservar (nunca estuvieron en git — `mv` + `git add`, 34 archivos):**
- 7 Consolidados + 4 Reportes de `Reportes y consolidados/BRAMUlab/` → `docs/bramulab-partidos/{consolidados,reportes}/`.
- `Sistema Grafico/BRAMULab icono2.png` → `docs/identidad-visual/`.
- 16 fotos de `Referencias visuales/` → `docs/identidad-visual/referencias-premier-padel/`.
- 6 imágenes de `RRSS/` → `redes-sociales/`.

**Nuevos:** `INDICE.md` (índice general) y este mismo informe.

**Total: 49 archivos movidos/renombrados + 2 archivos nuevos.**

## 3. Archivos pendientes por conflicto — no resueltos, no decidí por cuenta propia

Cinco documentos del marcador existen en **dos lugares a la vez**, con el mismo nombre:

| Nombre | Ubicación A | Ubicación B |
|---|---|---|
| `Consolidado V10.md` | Raíz del repo — git lo tiene trackeado pero **borrado del disco** desde antes de esta ronda | `Reportes y consolidados/BRAMUlab/` — presente, sin trackear |
| `Consolidado V11.md` | ídem | ídem |
| `Reporte V10 - para ChatGPT.md` | ídem | ídem |
| `Reporte V11 - para ChatGPT.md` | ídem | ídem |
| `Reporte V12 - para ChatGPT.md` | ídem | ídem |

No moví ni toqué ninguno de los dos lados. Quedaron exactamente como estaban: la Ubicación A sigue apareciendo como "D" (borrado, pendiente de confirmar) en `git status`, y la Ubicación B (`Reportes y consolidados/BRAMUlab/`, con esos 5 archivos únicamente) sigue existiendo tal cual.

**Lo que hace falta decidir** (no lo decidí yo):
- Si el contenido de ambas versiones es idéntico o no — no lo comparé, porque decidir "cuál es la buena" ya es parte de la resolución del conflicto.
- Si corresponde confirmar el borrado de la raíz (asumiendo que `Reportes y consolidados/BRAMUlab/` es la versión vigente) o restaurar la de la raíz.
- Recién con esa decisión, mover el resultado final a `docs/bramulab-partidos/{consolidados,reportes}/` para completar la estructura.

## 4. Hash del segundo commit

**`43e55e2`** — *"docs: reorganizar documentación bajo docs/ e índice general"*

Sin push todavía — sin pedirlo explícitamente para esta parte, y porque el mensaje decía deternerse a esperar revisión.

## 5. Confirmación de que no se eliminó ningún archivo

Conté todos los archivos del repositorio (excluyendo `bramulab/`, `bramulab-partidos/` y `.DS_Store`) antes y después de mover todo:

- **Antes: 57 archivos.**
- **Después: 59 archivos** (57 preexistentes + 2 nuevos: `INDICE.md` y este mismo informe).

Comparé la lista completa de rutas antes/después con `diff`: cada archivo que desapareció de una ubicación vieja reaparece exactamente en su ubicación nueva, mismo nombre. Los únicos archivos genuinamente nuevos son `INDICE.md` y este informe. **No se eliminó ningún documento.**

Referencias internas: busqué en todos los `.md` movidos algún link o ruta relativa hacia otro documento que pudiera quedar roto por el movimiento — no encontré ninguno (los documentos no se enlazan entre sí, solo describen rutas como texto narrativo de su propio contenido, que sigue siendo históricamente exacto tal como está escrito). No hizo falta actualizar ninguna referencia interna dentro de los documentos.
