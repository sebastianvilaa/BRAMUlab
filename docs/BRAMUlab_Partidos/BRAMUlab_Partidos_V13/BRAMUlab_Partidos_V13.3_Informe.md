# Reporte BRAMU Lab V13.3 — para pasar a ChatGPT

Este documento lo armó Claude Code para que Sebastián se lo pase a ChatGPT como contexto.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramu-lab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [4c86355](https://github.com/sebastianvilaa/BRAMUlab/commit/4c86355)
**Tag:** `v13.3`

---

## Qué cambió en BRAMU Intelligence (Por Games) y por qué

El Consolidado pedía una arquitectura narrativa: **datos → hechos → jerarquía → relaciones →
historia**, con dos problemas concretos de fondo.

### 1. La racha de cierre ya no asume que empezó en un empate

El código anterior (V13.1/V13.2) buscaba "el último empate" del set y contaba los games
desde ahí. Eso es una contradicción real cuando la racha decisiva arranca estando **abajo**
en el marcador, no empatado — el Consolidado lo señala explícito: *"si una racha fue
1-4 → 6-4, el origen de la racha es 1-4"*, nunca un empate intermedio que puede no haber
pasado.

Ahora el motor busca la **racha de cierre real**: la corrida más larga de games seguidos
ganados por quien se quedó el set, contando hacia atrás desde el último game — y reporta el
score exacto desde el que arrancó, sea un empate o un déficit. Con el benchmark del propio
Consolidado (6-4 · 6-3, Set 2 con una remontada real desde 1-3), el resultado es:

> El primero se mantuvo abierto hasta el 4-4, y desde ahí encadenaron 2 games para
> quedárselo 6-4.
> El segundo set parecía de Cruz y Dan, pero desde el 1-3 Ana y Bea ganaron los últimos 5
> games y dieron vuelta el marcador para cerrarlo 6-3.

Además, esto ahora distingue una **remontada real** (arrancó abajo) de un **set simplemente
parejo** (arrancó empatado) como formas distintas — y por eso, en ese mismo benchmark, la
Intelligence correctamente **no dice** que ambos sets tuvieron "un patrón parecido" (formas
distintas: uno es "parejo", el otro es "remontada"), tal como pide el Consolidado.

### 2. Se cuenta también al equipo que pierde, cuando aporta a la historia

Benchmark del Consolidado (4-6 · 6-1 · 6-3), Set 2: Ana y Bea se ponen 3-0, Cruz y Dan
cortan esa racha con un solo game (3-1), pero no les alcanza — Ana y Bea ganan los 3
siguientes y cierran 6-1. El resultado real:

> Ana y Bea se pusieron 3-0 en el segundo set. Cruz y Dan cortaron la racha para el 3-1,
> pero no alcanzó: Ana y Bea ganaron los 3 siguientes y cerraron 6-1.

Esto es prácticamente palabra por palabra el ejemplo que trae el propio Consolidado.

### Límite honesto de esta ronda

El Set 3 de ese mismo benchmark (parejo hasta 2-2, con un quiebre que abre diferencia y
otro que cierra el partido) el Consolidado lo imagina como una mini-crónica de tres actos
("se mantuvo equilibrado... consiguieron el quiebre que abrió la diferencia... lo
confirmaron... volvieron a quebrar"). Lo que se implementó detecta bien la **racha de
cierre** y **quién cortó una racha de apertura**, pero no arma esa crónica de tres actos
completa para un tramo empatado en el medio del set (ni una remontada ni una racha de
apertura clara). En ese caso, el texto cae a una descripción genérica correcta pero menos
rica ("Ana y Bea tomaron el control del tercer set desde temprano y lo cerraron 6-3") —
nunca inventa nada falso, pero no cuenta toda la riqueza posible. Lo dejo anotado para una
ronda futura si vale la pena profundizar ahí.

**Completo no se tocó**: ya usa su propio mecanismo (`computeSetGameDeficits`) para
encontrar el peor déficit real sin asumir empates — no tenía este bug, así que no hacía
falta reescribirlo. Se verificó que sigue narrando Break Points, Match Points y holds bajo
presión exactamente igual (186 tests originales sin tocar, todos verdes).

---

## Bug real de estadísticas por set — causa encontrada

Con el benchmark 4-6 · 6-1 · 6-3, el Set 3 mostraba holds/breaks incorrectos. La causa: al
calcular estadísticas de UN set aislado (para mostrarlo en la pestaña "SET 3"), el código
volvía a reproducir esos eventos desde cero — así que tanto "en qué número de set estamos"
como "qué número de game global es este" (usado para calcular la paridad de quién saca)
quedaban mal apenas el saque inicial de ese set era distinto al del Set 1. Se corrigió
pasándole a ese cálculo el punto de partida real (número de set + número de game global) en
vez de asumir que siempre arranca en cero. Se agregó un test que verifica la identidad
matemática obligatoria: **suma de breaks/holds/games de cada set = total del partido**.

---

## Timeline Por Games — cómo quedó

Antes reutilizaba la presentación de Completo y mostraba una progresión de puntos
(0-15-30-40) que **nunca se registró** en este modo — no era solo feo, era información
falsa. Ahora cada fila es un game real:

> **Game 3 · 2-1** `HOLD`
> Ganó Jugador 1 / Jugador 2 · Saque: Jugador 2

Con Highlights intercalados por hora real, y tramos de una corrección manual marcados como
parciales — nunca se inventa un game intermedio.

---

## Sistema de puntuación en vivo

- **Por Games:** el sistema es puro metadata (nunca afecta cómo se cuenta un game) — se
  cambia desde `☰ → Sistema de puntuación`, en cualquier momento.
- **Completo:** cada punto que se juega queda grabado con el sistema vigente EN ESE
  INSTANTE (mismo mecanismo que ya existía para el modo de Tie break). Por eso un cambio de
  sistema **nunca hace falta bloquearlo**: como cada punto ya jugado conserva su propia
  regla para siempre, cambiar el sistema hacia adelante no puede reinterpretar retroactivamente
  un game que ya se cerró. Verificado en vivo: a 40-40 con Punto de Oro, cambiar a Con
  Ventaja deja correctamente "VENTAJA" en vez de inventar que el game ya terminó.
- **"CAMBIAR SISTEMA"** aparece solo en la franja de Deuce/Punto de Oro/Star Point/Ventaja
  (donde realmente importa); fuera de esos momentos, el cambio se hace desde el menú ☰.

**Bug real encontrado en el camino:** los modales de "Hay una nueva versión" (V13.2) y
"Sistema de puntuación" vivían dentro de la sección de Home — que la app oculta apenas
arranca un partido. Un modal con posición fija no se pinta si algún ancestro suyo está
oculto, así que ninguno de los dos se veía nunca durante un partido en vivo (solo si
disparaban antes de arrancar). Se movieron junto al toast global, que sí está pensado para
verse sin importar la pantalla activa — confirmado con captura de pantalla en vivo.

---

## Tests finales

**270/270 verde** (262 tests previos sin modificar + 8 nuevos de esta ronda): los dos
benchmarks narrativos exactos del Consolidado (A y B), las invariantes de estadísticas por
set, y tres casos de seguridad del cambio de sistema en Completo (40-40 sin decidir, cambio
en estado normal, y bloqueo real después de cerrar un game). Verificación manual completa
en navegador: cambio de sistema en vivo en ambos modos, Timeline Por Games, Historial y
Análisis con los modales reubicados.
