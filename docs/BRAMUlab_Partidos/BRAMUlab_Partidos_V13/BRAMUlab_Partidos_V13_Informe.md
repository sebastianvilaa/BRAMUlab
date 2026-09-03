# Reporte BRAMU Lab V13 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto.
Mismas dos partes que los reportes anteriores: **cómo se trabajó** y **qué se hizo en la
app**. Es la continuación de esos reportes — no repite las definiciones básicas.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [41ae5ae](https://github.com/sebastianvilaa/BRAMUlab/commit/41ae5ae)
**Tag:** `v13`

---

## PARTE 1 — Cómo se trabajó

### De dónde nació esta ronda

El Consolidado V13 nace de la misma fuente que V12: uso real en cancha. Pero el problema
que resuelve es distinto y más de fondo — no es "la app no supo qué hacer en un caso
raro", sino "el registro punto por punto es demasiada carga para alguien que también
quiere mirar el partido, hablar con amigos y usar el celular". La respuesta no es pulir el
modo existente: es agregar un modo completamente nuevo, más liviano, sin degradar el que
ya funciona. El principio del propio documento — *"registrar casi sin esfuerzo y aun así
recibir algo interesante al final"* — es la vara con la que hay que medir el resultado, no
la cantidad de estadísticas que el modo nuevo conserva.

### Lo que se hizo, en orden

1. **Mapeo de arquitectura antes de programar** (pedido explícito del Consolidado, §34):
   un análisis a fondo de `engine.js`/`app.js`/`stats.js` para entender el motor de puntos
   existente — cómo se representa el estado, cómo funciona `applyPoint`, el sistema de
   eventos + `adjustment` para correcciones honestas, la resolución de sacador, y el Tie
   break extraordinario de V12. Esto identificó el camino de menor riesgo: **el motor de
   puntos es entrelazado con la lógica de puntos y no se presta a "apagar" el conteo
   interno** — así que en vez de forzar el modo Games adentro de `applyPoint`, se construyó
   un **motor paralelo y más simple** (`applyGameWin`/`applyGameTiebreak`/
   `applyExtraordinaryGameTiebreak` en `engine.js`) que reutiliza todo lo que ya era
   agnóstico de puntos (formatos, validadores de estados reglamentarios, resolución de
   sacador, `isValidTiebreakScore`) sin duplicar ni tocar el motor existente.
2. Con ese mapa, se armó un plan de 4 pasadas y se ejecutó de punta a punta sin volver a
   pedir aprobación intermedia (autorización ya dada explícitamente para esta ronda):
   (1) selector de modo + metadata de fecha/hora en Resumen/Análisis + Editar jugadores,
   bajo riesgo, toca ambos modos; (2) motor Por Games completo — pantalla en vivo, hold/break
   automático, TB reglamentario y extraordinario, Deshacer, Editar — con tests desde el
   principio; (3) estadísticas y BRAMU Intelligence propias de Por Games; (4) regresión,
   tests nuevos, versión y entrega.
3. **Verificación real, no solo de lectura de código**: se levantó un servidor local (con
   Python, sin depender de Node — este Mac no lo tiene) y se jugaron partidos completos a
   mano en el navegador: partido a 2 sets con hold/break automático, Tie break reglamentario
   con y sin resultado interno cargado, "Resolver con Tie break" extraordinario, Deshacer,
   Ajustar Games, Editar marcador completo (agregar sets ya jugados), Highlight con popup de
   categoría, y — importante — **cerrar el navegador y volver a abrir a mitad de partido**
   para confirmar que la persistencia sobrevive igual que en modo Completo.
4. Esa verificación real encontró **dos bugs reales antes de que llegaran a Sebastián**
   (detalle en Parte 2) — exactamente el tipo de cosa que aparecer en una prueba de cancha
   real hubiera sido mucho más costoso de diagnosticar. Se corrigieron ambos y se agregaron
   tests automáticos que los cubren, para que no puedan reaparecer en una ronda futura.
5. Se corrió la batería de tests existente (186 casos de V9-V12, sin tocarlos) para
   confirmar cero regresiones en modo Completo, y se agregaron 26 tests nuevos específicos
   de Por Games (motor, hold/break, Tie break reglamentario/extraordinario, Deshacer,
   corrección manual sin inventar orden, y los dos bugs reales ya corregidos). Total final:
   **212/212 verde**.

### Una decisión que vale la pena que Sebastián entienda

El Consolidado pedía, para el editor de Por Games, algo parecido a "Ajustar Games" (rápido)
y "Editar marcador completo" (profundo) como dos herramientas. Se implementaron como
**un solo modal con revelado progresivo** — se abre mostrando los selectores rápidos del
set actual, y un link abajo ("EDITAR MARCADOR COMPLETO") despliega la sección de sets ya
finalizados si hace falta algo más profundo. Es la misma idea del Consolidado, con menos
pantallas — y evita tener que replicar toda la lógica del editor de puntos (que no aplica
acá, porque no hay puntos) en una estructura paralela separada.

---

## PARTE 2 — Qué se hizo en la app

### POR GAMES · BETA — lo esencial

- **Selector de modo en Home** ("HISTORIAL · MODO COMPLETO ▾"), recuerda la última
  elección, se bloquea al empezar el partido.
- **Un toque = un game.** El marcador grande pasa a mostrar games (0→1→2→3...). En el
  score de disparo del Tie break (6-6 Clásico, 5-5 Americano), el mismo toque en una pareja
  significa "esa pareja ganó el Tie break" — no hace falta un paso extra para avisarlo.
- **Hold/Break automático**, sin pedir que se etiquete nada — se calcula solo, reutilizando
  la misma rotación de saque que ya existía.
- **"GAME PARA EL SET" / "GAME PARA EL PARTIDO"** en vez de lenguaje de puntos — nunca Set
  Point/Match Point/Break Point, que Por Games no puede conocer.
- **Tie break reglamentario**: pregunta ganador (obligatorio) y score interno (opcional,
  con "OMITIR"). El score del set queda correcto (ej. `6-0 · 7-6`) aunque se omita el
  detalle interno del Tie break — nunca se muestra `6-6 · TB ?`.
- **Americano**: misma lógica de siempre (5-5 va directo a TB, 6-5 final), adaptada al
  flujo de un paso.
- **"Resolver con Tie break" extraordinario**: misma función validada en V12.2, adaptada —
  elegir modalidad/objetivo (reutiliza el modal existente sin cambios), después ganador +
  score interno opcional. Nunca fabrica games que no se jugaron.
- **Deshacer**: revierte el último game y todas sus consecuencias (rotación, estadísticas,
  Evolución).
- **Editar** (sin "Ajustar" aparte, como pide el Consolidado): corrección rápida del set
  actual + edición profunda de sets ya jugados en un solo modal.
- **Corrección manual sin inventar secuencia**: si se corrige de `3-2` a `4-3`, el score
  final es correcto, pero holds/breaks/racha del tramo corregido no se le atribuyen a
  nadie (en vez de inventar quién ganó qué). Marcado como parcial (`*`) en las métricas
  afectadas.
- **Highlights**: mismo mecanismo, sin score de puntos inventado (solo contexto real: set,
  score de games, sacador si se conoce, categoría).
- **Resumen/Análisis propios**: Games ganados, Games de saque ganados, Breaks, Racha máxima
  de games, Máxima ventaja alcanzada, Mayor desventaja remontada. Nunca puntos, Puntos de
  Oro, Break/Set/Match Points (no existen en este modo).
- **BRAMU Intelligence propia**: un generador de texto separado y más corto, que solo
  afirma lo que games/servicio/score/tiempo respaldan honestamente — nunca inventa nada a
  nivel de punto.
- **Evolución**: gráfico propio (más simple que el de Completo, que necesita datos de
  puntos que este modo no tiene) — un nodo por game, con tramos de corrección manual
  marcados con círculo hueco.
- **Historial**: distingue partidos Por Games con una etiqueta discreta.
- **Editar jugadores** (nuevo, para ambos modos): desde el menú ☰, cambia el nombre
  retroactivamente en todo — marcador, Resumen, Análisis, Intelligence, Historial,
  Highlights — porque es el mismo jugador por dentro, nunca uno nuevo.
- **Metadata de fecha/hora/formato/sistema/modo** en Resumen, Análisis e Historial, para
  ambos modos — resuelve el problema real que motivó el pedido: hoy se podía ver el
  resultado de un partido viejo pero no cuándo se jugó.

### Bugs reales encontrados y corregidos durante el desarrollo (nunca llegaron a producción)

1. **Remontada falsa al perder un set.** Si una pareja perdía un set estando muy abajo
   (ej. 0-6) y arrancaba el set siguiente en 0-0, el cálculo de "mayor desventaja
   remontada" contaba eso como si hubieran remontado 6 games — cuando en realidad
   simplemente arrancó un set nuevo. BRAMU Intelligence llegó a decir "recuperaron terreno
   después de estar 6 games abajo" sin que fuera cierto. Corregido: un set nuevo resetea el
   contador sin acreditar ninguna remontada.
2. **"Games ganados" se quedaba corto después de una corrección manual.** Si se corregía el
   marcador con Ajustar Games, el total de "games ganados" en el Resumen no contaba los
   games que la corrección había absorbido de una sola vez — mostraba, por ejemplo, 3
   cuando el marcador real ya decía 4. Corregido: el total general de games es un dato
   matemáticamente seguro (el Consolidado lo dice explícito, §11) y ahora se lee siempre
   del marcador final, nunca de una cuenta evento por evento que una corrección puede dejar
   corta.

### Diferencias respecto del Consolidado (deliberadas, documentadas)

- **"Ajustar Games" y "Editar marcador completo"** son un solo modal con revelado
  progresivo, no dos pantallas separadas (ver Parte 1).
- **No se implementó "Partido ya empezado"** (empezar a registrar Por Games a mitad de un
  partido real) — el Consolidado no lo pide explícitamente para este modo y no es parte de
  los 25 criterios de cierre (§33); queda como candidato natural para una ronda futura si
  hace falta en la prueba de cancha.
- **Compartir (exportar imagen)** no se adaptó a Por Games — el propio Consolidado excluye
  explícitamente un "overhaul de Compartir" de esta ronda (§31). Si alguien lo intenta
  desde un partido Por Games, falla de forma segura (aviso de "no se pudo generar la
  imagen", sin romper la app) en vez de mostrar una imagen con datos de puntos inventados.
  Vale la pena resolverlo en una ronda futura si se usa en la práctica.
- **Desglose de saque por jugador** (individual, no por pareja) no se agregó a Por Games —
  no está entre los criterios de cierre del Consolidado; la info a nivel pareja sí está
  completa.

### Tests finales

- **186/186** tests previos (V9-V12, sin modificar) — cero regresiones en modo Completo.
- **26 tests nuevos** de Por Games — motor (Casos A/B/C/F/G/H/I/J/N del Consolidado §29),
  los dos bugs reales encontrados, y validación de que Evolución no fabrica el tramo
  intermedio de una corrección.
- **Total: 212/212 verde.**
- Verificación manual completa en navegador (no solo tests automáticos): partido completo,
  hold/break, banners "GAME PARA EL SET/PARTIDO", TB reglamentario con y sin score interno,
  TB extraordinario, Deshacer, Ajustar Games, Editar marcador completo, Highlight,
  persistencia real (cerrar y volver a abrir a mitad de partido), Resumen, Análisis
  (estadísticas/Evolución/Momentos Clave/Highlights), Historial, Editar jugadores
  retroactivo — todo verificado sin errores de consola.

### Puntos recomendados para probar en cancha

Las 7 preguntas del Consolidado (§30) son literalmente el objetivo de esta ronda — no hay
forma de responderlas desde una computadora. En particular, prestar atención a:

1. **¿Un toque por game alcanza, o falta algo intermedio?** (ej. anotar quién estaba
   sacando sin mirar tanto la pantalla).
2. **El flujo de Tie break reglamentario** (ganador + score opcional) — ¿se siente natural
   en el momento, o interrumpe más de lo esperado?
3. **BRAMU Intelligence Por Games** — ¿el texto más corto sigue siendo interesante, o se
   siente pobre comparado con el de Completo?
4. Si en algún momento se registra mal un game, **Deshacer y Ajustar Games** — ¿son rápidos
   de encontrar y usar a mitad de partido real?
