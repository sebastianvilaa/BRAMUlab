# BRAMUlab — documentación

Naming activo del proyecto (usar siempre exactamente así):

- `BRAMUlab_Partidos_V##` — el producto anterior (marcador congelado, `bramulab-partidos/` en el código). Congelado en V14, documentación consolidada en [`../BRAMUlab_Partidos/`](../BRAMUlab_Partidos/).
- `BRAMUlab_V01` — la primera aplicación integral (`bramulab/` en el código). Todo lo desarrollado hasta el hotfix v2.2.1.
- `BRAMUlab_V02` — sistema visual integral (base) más sus subversiones de corrección `BRAMUlab_V02.1`, `V02.2`... — todas viven en la MISMA carpeta `Versiones/BRAMUlab_V02/`, nunca una carpeta nueva por subversión. Solo un cambio de versión MAYOR (`BRAMUlab_V03`) crea una carpeta nueva.
- `BRAMUlab_V03` — identidad real del jugador (cuenta local, Player Card, Perfil editable) sobre la misma base visual/funcional de V02.9.3. Vive en [`Versiones/BRAMUlab_V03/`](Versiones/BRAMUlab_V03/).

No se usa "Jugador", "Legacy", "Etapa", "Fase", "Plan" ni fechas en el naming activo. Documentos con esos nombres existieron (consolidados/informes de cada ronda de desarrollo) pero se borraron del repositorio una vez que su contenido quedó resumido en el Consolidado/Informe de cada versión y en `BRAMUlab_Backlog.md` — siguen recuperables del historial de git (commit `40c82bc`, el último que todavía los incluye) si hiciera falta el texto original de alguno.

## Versión funcional actual: BRAMUlab_V03.4.6

La app publicada hoy se identifica en producto como **"BRAMUlab V03.4.6"** (footer del Home/badge de versión) — tag técnico de git `BRAMUlab_V03.4.6`, 828/828 tests. La línea V03 (identidad del jugador, cuentas, notificaciones, sistema de jugadores, Mis Grupos) tuvo 27 rondas de trabajo, cada una con su propio Consolidado/Informe suelto — el 10/09/2026 se sintetizaron en un único par de documentos, igual que ya se había hecho antes con V01:

| Qué necesitás | Documento |
|---|---|
| Qué se pidió, ronda por ronda, desde V03.0 hasta V03.4.6 | [`Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md) |
| Qué se implementó, verificó y corrigió en cada una (arquitectura vigente, bugs reales, contradicciones entre rondas resueltas explícitamente) | [`Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`](Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md) |

**V03 es la versión activa** — a diferencia de V01/V02, todavía puede sumar rondas nuevas (V03.4.7, V03.5, etc.). Cuando eso pase, la ronda nueva se documenta primero en su propio Consolidado/Informe, y se vuelve a sintetizar más adelante si el par de arriba vuelve a acumular demasiadas rondas sueltas.

## Sistema visual base: BRAMUlab_V02 (V02.9.3, sin cambios desde entonces)

V02 le cambió a V01 el sistema visual de punta a punta, sin tocar su lógica funcional, en 16 rondas sucesivas de afinación — también sintetizadas en un único par de documentos:

| Qué necesitás | Documento |
|---|---|
| Qué se pidió, ronda por ronda, desde la base hasta V02.9.3 | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md) |
| Qué se implementó, verificó y corrigió en cada una (tokens CSS vigentes, bugs reales, la saga completa del glow de Efectividad) | [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md) |

## Versión anterior: BRAMUlab_V01

Toda la lógica funcional (partidos, historial, Home, BRAMU Intelligence) sigue siendo la de V01 — V02 solo le cambió el sistema visual encima. Para entender esa lógica (no el aspecto visual actual, que ya quedó superado):

| Qué necesitás | Documento |
|---|---|
| Qué se especificó, en orden, desde el origen hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Consolidado.md) |
| Qué se implementó, verificó y corrigió hasta v2.2.1 | [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md) |

Los documentos originales de cada Etapa/Fase/hotfix (citados por nombre dentro del Consolidado/Informe de arriba) ya no están en el repositorio — se borraron una vez confirmado que no quedaba nada sin resumir; recuperables del historial de git (commit `990df66`).

## Producto anterior: BRAMUlab_Partidos (V10 a V14, congelado)

El marcador de pádel en vivo sin identidad de jugador — antesala técnica de BRAMUlab_V01 (su motor de marcador y estadísticas, `engine.js`/`stats.js`, se reusó sin cambios). Congelado en V14, sin más desarrollo funcional planeado. Sus 9 rondas (V10 a V14) quedaron igual de sintetizadas:

| Qué necesitás | Documento |
|---|---|
| Qué se pidió, ronda por ronda, desde V10 hasta V14 | [`../BRAMUlab_Partidos/BRAMUlab_Partidos_Consolidado.md`](../BRAMUlab_Partidos/BRAMUlab_Partidos_Consolidado.md) |
| Qué se implementó, verificó y corrigió en cada una | [`../BRAMUlab_Partidos/BRAMUlab_Partidos_Informe.md`](../BRAMUlab_Partidos/BRAMUlab_Partidos_Informe.md) |

## Backlog

**Documento vivo.** [`BRAMUlab_Backlog.md`](BRAMUlab_Backlog.md) es el único lugar donde viven las ideas futuras del proyecto (validación de partidos, cuentas/ranking, notificaciones, smartwatch, fotos/recuerdos, motion, etc.) — nada de esto está autorizado para implementar todavía. Cuando Sebastián piense una idea nueva con ChatGPT, el flujo es: revisar primero este archivo para no chocar con o duplicar algo ya pensado, y agregarla acá — nunca dejarla suelta en un documento de ronda que después se borra.

## Referencias

Documentación visual y auditorías todavía útiles como contexto, pero que no son consolidados de implementación ni deben confundirse con uno: [`Referencias/`](Referencias/) (moodboard de dirección visual, brief para ChatGPT, auditoría visual pre-V02 del código).

## Qué leer, según lo que te pidan

- **"Seguí desarrollando BRAMU Lab / la app / lo de siempre"** → estás en `BRAMUlab_V03.4.6` (es la versión publicada hoy). Leé su Informe arriba para el estado real actual (identidad/cuenta/grupos), el Informe de V02 para el sistema visual que no cambió, y el Informe/Consolidado de V01 para la lógica funcional de base (partidos, historial, BRAMU Intelligence).
- **Cualquier pedido de ajuste visual, funcional o de UX puntual sobre Home/Historial/partidos** → sigue siendo sobre `BRAMUlab_V02` (subversión `V02.9.3`), no sobre V01 ni V03. Una futura ronda de corrección sobre identidad/cuenta/grupos se documenta como una nueva subversión de `BRAMUlab_V03` (misma carpeta `Versiones/BRAMUlab_V03/`); sobre el resto de la app, sigue siendo una nueva subversión de `BRAMUlab_V02` dentro de `Versiones/BRAMUlab_V02/` — nunca una carpeta nueva salvo cambio de versión mayor.
- **"¿Qué falta / qué es lo próximo?"** → `BRAMUlab_Backlog.md`.
- **Cualquier documento que diga "Etapa", "Fase", "rama jugador" o "BRAMU Lab" (con espacio)** es histórico — ya no existe en el repositorio (se borró una vez resumido en el Consolidado/Informe/Backlog correspondiente), pero es recuperable del historial de git si hiciera falta.
