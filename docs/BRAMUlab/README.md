# BRAMUlab — documentación

Naming activo del proyecto (usar siempre exactamente así):

- `BRAMUlab_Partidos_V##` — el producto anterior (marcador congelado, `bramulab-partidos/` en el código). Documentación en [`../BRAMUlab_Partidos/`](../BRAMUlab_Partidos/).
- `BRAMUlab_V01` — la aplicación integral actual (`bramulab/` en el código). Todo lo desarrollado hasta hoy.
- `BRAMUlab_V02` — la próxima versión, con el nuevo sistema visual integral. Todavía no implementada.

No se usa "Jugador", "Legacy", "Etapa", "Fase", "Plan" ni fechas en el naming activo — esos nombres solo sobreviven dentro de las carpetas `Archivo/`, como identidad histórica de cada documento.

## Versión funcional actual: BRAMUlab_V01

La app publicada hoy corre en `v2.2.1` (tag de git), dentro de `BRAMUlab_V01`.

| Qué necesitás | Documento |
|---|---|
| Qué se especificó, en orden, desde el origen hasta hoy | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md) |
| Qué se implementó, verificó y corrigió realmente | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md) |
| Los documentos originales de cada Etapa/Fase/hotfix (preservados, ya no son fuente activa) | [`Versiones/BRAMUlab_V01/Archivo/`](Versiones/BRAMUlab_V01/Archivo/) |

**Si vas a seguir desarrollando BRAMUlab_V01, leé el Informe primero** (es el estado real de la app), y el Consolidado para el porqué de cada decisión.

## Próxima versión: BRAMUlab_V02

Sistema visual integral y coherencia de experiencia — todavía **no implementada**.

| Qué necesitás | Documento |
|---|---|
| Consolidado pendiente de implementación | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md) |
| Informe | No existe todavía — se genera después de implementar la versión. |

**Si te piden implementar BRAMUlab_V02, ese consolidado es la fuente de verdad** para las decisiones visuales, por encima de auditorías/informes anteriores.

## Backlog

Ideas y direcciones futuras no autorizadas todavía para implementar (validación de partidos, cuentas/ranking, motion): [`BRAMUlab_Backlog.md`](BRAMUlab_Backlog.md).

## Referencias

Documentación visual y auditorías todavía útiles como contexto, pero que no son consolidados de implementación ni deben confundirse con uno: [`Referencias/`](Referencias/) (moodboard de dirección visual, brief para ChatGPT, auditoría visual pre-V02 del código).

## Archivo

Documentos superados o puramente históricos que no son parte de ninguna versión activa — reorganizaciones documentales anteriores, el índice de repositorio previo a esta reorganización: [`Archivo/`](Archivo/).

## Qué leer, según lo que te pidan

- **"Seguí desarrollando BRAMU Lab / la app / lo de siempre"** → estás en `BRAMUlab_V01`. Leé el Informe de V01 arriba.
- **"Implementá el nuevo sistema visual / el rediseño"** → es `BRAMUlab_V02`. Leé su Consolidado arriba; no está implementado todavía.
- **"¿Qué falta / qué es lo próximo?"** → `BRAMUlab_Backlog.md`.
- **Cualquier documento que diga "Etapa", "Fase", "rama jugador" o "BRAMU Lab" (con espacio)** es histórico — pertenece a una carpeta `Archivo/` y ya no es una fuente activa, aunque el contenido en sí sigue siendo válido como registro de lo que pasó.
