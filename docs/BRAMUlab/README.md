# BRAMUlab — documentación

Naming activo del proyecto (usar siempre exactamente así):

- `BRAMUlab_Partidos_V##` — el producto anterior (marcador congelado, `bramulab-partidos/` en el código). Documentación en [`../BRAMUlab_Partidos/`](../BRAMUlab_Partidos/).
- `BRAMUlab_V01` — la primera aplicación integral (`bramulab/` en el código). Todo lo desarrollado hasta el hotfix v2.2.1.
- `BRAMUlab_V02` — versión funcional actual, con el nuevo sistema visual integral, publicada sobre la misma base de código y datos de V01.

No se usa "Jugador", "Legacy", "Etapa", "Fase", "Plan" ni fechas en el naming activo — esos nombres solo sobreviven dentro de las carpetas `Archivo/`, como identidad histórica de cada documento.

## Versión funcional actual: BRAMUlab_V02

La app publicada hoy se identifica en producto como **"BRAMUlab V02"** (footer/badge de versión) — tag técnico de git `v3.0`, dentro de `BRAMUlab_V02`.

| Qué necesitás | Documento |
|---|---|
| Qué se especificó (sistema visual integral) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md) |
| Qué se implementó, verificó y corrigió realmente | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md) |

**Si vas a seguir desarrollando BRAMUlab_V02, leé el Informe primero** (es el estado real de la app), y el Consolidado para el porqué de cada decisión visual.

## Versión anterior: BRAMUlab_V01

Toda la lógica funcional (partidos, historial, Home, BRAMU Intelligence) sigue siendo la de V01 — V02 solo le cambió el sistema visual encima. Para entender esa lógica (no el aspecto visual actual, que ya quedó superado):

| Qué necesitás | Documento |
|---|---|
| Qué se especificó, en orden, desde el origen hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md) |
| Qué se implementó, verificó y corrigió hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md) |
| Los documentos originales de cada Etapa/Fase/hotfix (preservados, ya no son fuente activa) | [`Versiones/BRAMUlab_V01/Archivo/`](Versiones/BRAMUlab_V01/Archivo/) |

## Backlog

Ideas y direcciones futuras no autorizadas todavía para implementar (validación de partidos, cuentas/ranking, motion): [`BRAMUlab_Backlog.md`](BRAMUlab_Backlog.md).

## Referencias

Documentación visual y auditorías todavía útiles como contexto, pero que no son consolidados de implementación ni deben confundirse con uno: [`Referencias/`](Referencias/) (moodboard de dirección visual, brief para ChatGPT, auditoría visual pre-V02 del código).

## Archivo

Documentos superados o puramente históricos que no son parte de ninguna versión activa — reorganizaciones documentales anteriores, el índice de repositorio previo a esta reorganización: [`Archivo/`](Archivo/).

## Qué leer, según lo que te pidan

- **"Seguí desarrollando BRAMU Lab / la app / lo de siempre"** → estás en `BRAMUlab_V02` (es la versión publicada hoy). Leé su Informe arriba para el estado visual actual, y el Informe/Consolidado de V01 para la lógica funcional de base (partidos, historial, BRAMU Intelligence), que V02 no tocó.
- **Cualquier pedido de ajuste visual puntual** (paleta, tipografía, tarjetas, iconografía) → es sobre `BRAMUlab_V02`, no sobre V01.
- **"¿Qué falta / qué es lo próximo?"** → `BRAMUlab_Backlog.md`.
- **Cualquier documento que diga "Etapa", "Fase", "rama jugador" o "BRAMU Lab" (con espacio)** es histórico — pertenece a una carpeta `Archivo/` y ya no es una fuente activa, aunque el contenido en sí sigue siendo válido como registro de lo que pasó.
