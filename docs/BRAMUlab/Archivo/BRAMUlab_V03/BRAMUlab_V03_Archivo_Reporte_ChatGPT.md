# Reporte de archivo documental de BRAMUlab_V03 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto
operativo de esta ronda. Ronda **puramente documental de reordenamiento**: no se tocó código de
la app, no se cambió versión, no se corrieron tests, no se tocó cache-bust/service worker/tag
`BRAMUlab_V03.10`, no se implementó Nivel BRAMU.

**Fuente de esta ronda:** instrucción directa del usuario (sin handoff `.md` propio) pidiendo
llevar `docs/BRAMUlab/Versiones/BRAMUlab_V03/` a la misma estructura final que ya tienen
`BRAMUlab_V01` y `BRAMUlab_V02` (solo Consolidado + Informe en la carpeta activa).

---

## 1. Qué se hizo

Se movieron los 22 documentos intermedios de la línea V03 (todo lo que no es el Consolidado ni
el Informe final) desde:

```
docs/BRAMUlab/Versiones/BRAMUlab_V03/
```

hacia una carpeta nueva de archivo histórico:

```
docs/BRAMUlab/Archivo/BRAMUlab_V03/
```

siguiendo el mismo patrón ya usado por `docs/BRAMUlab/Archivo/Nivel_BRAMU/` para los documentos
de investigación/cierre de la fórmula de Nivel. No se borró ningún archivo — todos siguen en el
repositorio, solo cambiaron de carpeta.

## 2. Archivos movidos (22)

Documentos operativos de versión (`BRAMUlab_V03.X.md`):
- `BRAMUlab_V03.5.md`
- `BRAMUlab_V03.5.1.md`
- `BRAMUlab_V03.5.2.md`
- `BRAMUlab_V03.6.md`
- `BRAMUlab_V03.7.md`
- `BRAMUlab_V03.8.md`
- `BRAMUlab_V03.9.md`
- `BRAMUlab_V03.10.md`

Reportes para ChatGPT (`BRAMUlab_V03.X_Reporte_ChatGPT.md`):
- `BRAMUlab_V03.5.1_Reporte_ChatGPT.md`
- `BRAMUlab_V03.5.2_Reporte_ChatGPT.md`
- `BRAMUlab_V03.6_Reporte_ChatGPT.md`
- `BRAMUlab_V03.7_Reporte_ChatGPT.md`
- `BRAMUlab_V03.8_Reporte_ChatGPT.md`
- `BRAMUlab_V03.9_Reporte_ChatGPT.md`
- `BRAMUlab_V03.10_Reporte_ChatGPT.md`

Handoffs (especificaciones que dispararon cada ronda):
- `BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`
- `BRAMUlab_V03.9_Handoff_Ajustes_Cierre_V03.md`
- `BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md` (handoff superado, nunca ejecutado —
  ver §3)
- `BRAMUlab_V03.10_Handoff_Cierre_V03.md`
- `BRAMUlab_V03_Handoff_Consolidacion_Final.md`
- `BRAMU_Ranking_Handoff_Exploracion_Geografica.md` (exploración/investigación, nunca
  implementada — ver §3)

Reporte de cierre de la línea:
- `BRAMUlab_V03_Cierre_Reporte_ChatGPT.md`

No se movió ningún otro archivo: `BRAMU_Intelligence.md`, `Referencias/`, `Backup/`,
`BRAMU_Intelligence_Implementacion.md`, `BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md` y
`Logo.ai` no pertenecen a la línea V03 y quedaron exactamente como estaban en `git status` al
empezar esta ronda (algunos modificados, algunos sin seguimiento — de otros frentes en curso).

## 3. Dos aclaraciones sobre archivos movidos

- `BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md` es el handoff que la propia ronda
  V03.10 pidió explícitamente ignorar ("Este archivo SUPERA al handoff anterior... Ignorá el
  anterior"), reemplazado por `BRAMUlab_V03.10_Handoff_Cierre_V03.md`. Se archivó igual, sin
  distinción especial, porque el pedido de esta ronda fue archivar todos los handoffs de la
  línea — queda como registro de que existió y fue descartado, no como documento vigente.
- `BRAMU_Ranking_Handoff_Exploracion_Geografica.md` es un documento de exploración/investigación
  que nunca disparó una ronda de implementación (no tiene una versión `BRAMUlab_V03.X` asociada).
  Se archivó junto con el resto por instrucción explícita del handoff de esta ronda ("documentos
  de investigación/exploración que hayan quedado en esa carpeta").

## 4. Ruta final

```
docs/BRAMUlab/Versiones/BRAMUlab_V03/
├── BRAMUlab_V03_Consolidado.md
└── BRAMUlab_V03_Informe.md

docs/BRAMUlab/Archivo/BRAMUlab_V03/
├── (los 22 archivos listados arriba en §2)
└── BRAMUlab_V03_Archivo_Reporte_ChatGPT.md   (este mismo reporte)
```

Confirmado por listado directo de ambas carpetas después del movimiento: la carpeta activa
`Versiones/BRAMUlab_V03/` quedó con exactamente 2 archivos; `Archivo/BRAMUlab_V03/` quedó con
exactamente 22 (23 contando este reporte, agregado después del movimiento).

## 5. Referencias corregidas

Se corrigieron las frases vigentes que afirmaban que los documentos de V03.5 en adelante seguían
"en este mismo directorio" (ya no es cierto tras el movimiento), en los dos documentos activos:

- **`BRAMUlab_V03_Consolidado.md`** — 3 frases corregidas (encabezado "Por qué existe este
  documento", párrafo de encabezado sobre qué sigue presente en el repositorio, y el párrafo de
  cierre al final del documento). Las tres ahora apuntan a `docs/BRAMUlab/Archivo/BRAMUlab_V03/`
  con un link relativo (`../../Archivo/BRAMUlab_V03/`).
- **`BRAMUlab_V03_Informe.md`** — 2 frases corregidas (encabezado "Cómo leer este documento" y el
  párrafo de cierre al final del documento), mismo link relativo.
- **`docs/BRAMUlab/README.md`** — 2 links markdown que apuntaban a
  `Versiones/BRAMUlab_V03/BRAMUlab_V03.5.md` y `BRAMUlab_V03.5.1.md` (rotos tras el movimiento)
  corregidos a `Archivo/BRAMUlab_V03/...`. No se tocó el resto del contenido del README (sigue
  desactualizado en otros puntos — por ejemplo, todavía presenta `V03.5.1` como "la versión
  publicada hoy" — pero corregir esa desactualización de contenido es un frente aparte, no un
  link roto por este movimiento, y no fue lo que pidió esta ronda).

No quedó ningún link markdown clicable (`[texto](ruta)`) apuntando a la ruta vieja en ningún
archivo del repositorio — verificado con búsqueda repo-wide después de los cambios.

**Deliberadamente NO corregido:** dentro de los propios documentos archivados (handoffs,
reportes, operativos de versión), varias menciones internas citan la ruta vieja de otro
documento archivado como texto plano entre backticks (ej. "Fuente:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.8_Handoff_Cierre_Ranking.md`" dentro de
`BRAMUlab_V03.8.md`). No son links markdown rotos (no tienen `[texto](ruta)`, son solo citas de
procedencia en texto), y corregir esas decenas de menciones internas en documentos ya archivados
sería reescribir historia — contradice el punto 6 del pedido ("conservar las referencias
históricas tal como fueron definidas en su momento"). Se dejaron intactas.

## 6. Roadmap vigente — sin cambios de sentido histórico

No se tocó ninguna narración histórica de rondas pasadas. En particular, la mención dentro de la
narración histórica de §8 (ronda V03.3) del Consolidado — "Datos simulados/locales hasta que
exista backend real, explícitamente aislados para reemplazo en V04" — sigue intacta, porque
describe lo que esa ronda específica pedía en su momento, no un estado vigente (esto ya se había
evaluado y confirmado en la ronda de microfix anterior a esta, commit `2e11866`).

El roadmap vigente que ya estaba correcto en "Estado actual" de ambos documentos (V04 = Nivel
BRAMU, V05 = BRAMU Intelligence, V06 = Backend/Infraestructura) no requirió ningún cambio
adicional en esta ronda — el movimiento de archivos no afecta esas secciones.

## 7. Commit y push

Un solo commit documental con:
- Los 22 archivos movidos (15 como rename detectado por git, 7 como archivo nuevo porque nunca
  habían sido commiteados — eran handoffs/reportes del usuario o generados en la última ronda
  que todavía no se habían subido).
- Las 3 ediciones de contenido (`BRAMUlab_V03_Consolidado.md`, `BRAMUlab_V03_Informe.md`,
  `docs/BRAMUlab/README.md`).

pusheado a `origin/main`. Este mismo reporte se sube en un commit separado inmediatamente
después, como pidió el handoff.

No se tocó ningún archivo de código (`bramulab/*.js`, HTML/CSS), `tests.html`, `version.json`,
`sw.js`, ni se movió el tag `BRAMUlab_V03.10`. Tampoco se tocaron los archivos ya
modificados/sin seguimiento de otros frentes presentes en `git status` al empezar
(`BRAMU_Intelligence.md`, `Referencias/`, `Backup/`,
`BRAMU_Intelligence_Implementacion.md`, `BRAMU_Intelligence_IA_Generativa_Evaluacion_2026.md`,
`Logo.ai`) — quedan intactos, tal como estaban.

## 8. Confirmación final

`docs/BRAMUlab/Versiones/BRAMUlab_V03/` contiene únicamente:
- `BRAMUlab_V03_Consolidado.md`
- `BRAMUlab_V03_Informe.md`

igual que `BRAMUlab_V01` y `BRAMUlab_V02`.

**Próximo paso:** ninguno de código. `BRAMUlab_V03` queda ahora también ordenada
documentalmente, con la misma estructura que V01/V02. La siguiente decisión (handoff de Nivel
BRAMU / `V04`, u otra) la toma ChatGPT después de auditar este reporte — no se leyó documentación
de Nivel BRAMU en esta ronda.
