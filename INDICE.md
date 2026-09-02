# Índice general — BRAMU Lab

Dónde encontrar cada tipo de contenido en este repositorio. Este índice reemplaza la estructura anterior (`Reportes y consolidados/`, `Sistema Grafico/`, `Referencias visuales/`, `RRSS/` sueltas en la raíz).

## Aplicaciones (código, lo único que corre)

| Carpeta | Qué es | URL pública |
|---|---|---|
| [`bramulab/`](bramulab/) | **BRAMU Lab** — la aplicación principal, en desarrollo activo. | https://sebastianvilaa.github.io/BRAMUlab/bramulab/ |
| [`bramulab-partidos/`](bramulab-partidos/) | **BRAMU Lab Partidos** — el marcador completo, congelado en v14. No recibe más cambios funcionales. | https://sebastianvilaa.github.io/BRAMUlab/bramulab-partidos/ |

La fuente de verdad de qué hace la app hoy es siempre el código, no un documento. Qué versión está publicada y cuándo: los tags de git (`git tag`).

## Documentación (`docs/`)

### `docs/bramulab/` — todo lo referido a BRAMU Lab

| Subcarpeta | Contenido | Se edita después de creado |
|---|---|---|
| [`consolidados/`](docs/bramulab/consolidados/) | Especificaciones que autorizaron cada etapa (qué se pidió implementar). | No — quedan como referencia histórica de qué se pidió. |
| [`informes/`](docs/bramulab/informes/) | Qué se implementó realmente en cada etapa, resultados de tests, verificación. | No — si hace falta un ajuste posterior, es un informe nuevo. |
| [`auditorias/`](docs/bramulab/auditorias/) | Estado real del código/diseño en un momento dado (bugs, deuda técnica, inventario visual). | Se puede regenerar cuando haga falta re-chequear. |
| [`backlog-futuro/`](docs/bramulab/backlog-futuro/) | Dirección futura **no autorizada todavía** para implementar — nunca se construye directo desde acá, siempre pasa primero por un consolidado. | Se actualiza a medida que evoluciona la conversación de producto. |

### `docs/bramulab-partidos/` — todo lo referido al marcador congelado

| Subcarpeta | Contenido |
|---|---|
| [`consolidados/`](docs/bramulab-partidos/consolidados/) | Especificaciones de cada versión del marcador (V12 a V14). |
| [`reportes/`](docs/bramulab-partidos/reportes/) | Reportes técnicos+producto de traspaso a ChatGPT (V13 a V14). |

**Pendiente sin resolver:** `Consolidado V10.md`, `Consolidado V11.md`, `Reporte V10/V11/V12 - para ChatGPT.md` de esta app **no están acá todavía** — quedaron en conflicto de nombres con archivos que ya existían en `Reportes y consolidados/BRAMUlab/` (que tampoco se movió) y con un estado de git heredado (archivos borrados del disco pero seguían trackeados en la raíz del repo). No se decidió por cuenta propia cuál versión es la buena — ver el informe de esta reorganización para el detalle y decidir antes de resolverlo.

### `docs/identidad-visual/`

Logo, ícono y sistema gráfico de marca (`BRAMULab Logo.png`, `BRAMULab Sistema Grafico.png`, `BRAMULab icono.png`, `BRAMULab icono2.png`), más el moodboard fuente de Premier Padel en [`referencias-premier-padel/`](docs/identidad-visual/referencias-premier-padel/) (15 fotos analizadas en `docs/bramulab/backlog-futuro/BRAMU_Direccion_Visual_Moodboard_Analisis.md`).

La identidad de marca realmente en uso hoy es la que está en `bramulab/icons/`/`bramulab-partidos/icons/` — esta carpeta es el material fuente/de trabajo, no necesariamente lo último publicado.

## `redes-sociales/`

Capturas/imágenes para redes sociales. Sin relación con la documentación de producto — uso externo.

## `.claude/`

Configuración de herramientas de desarrollo (servidor local, preview). No es documentación de producto.

---

*Índice creado como parte de la reorganización documental (ver `docs/bramulab/informes/` para el detalle de qué se movió y por qué).*
