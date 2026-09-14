# Reporte BRAMUlab V03.5.1 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora
y el repositorio) para que Sebastián se lo pase a ChatGPT como contexto operativo de esta
ronda. No repite la especificación completa — eso vive en `BRAMUlab_V03.5.1.md`, en esta
misma carpeta — solo resume qué se hizo realmente, cómo cambió respecto de lo pedido, y en
qué estado quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [`8100bfc`](https://github.com/sebastianvilaa/BRAMUlab/commit/8100bfc41c48ddf70d7bc305dfce374d7f6e27a5)
**Tag:** `BRAMUlab_V03.5.1`
**Base:** `BRAMUlab_V03.5`
**Documento fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.5.1.md` (§22 tiene el cierre técnico detallado)

---

## 1. Qué se implementó realmente

Todo lo pedido en el documento, sin recortes de alcance:

- **Ámbitos** reordenados a Local/Provincial/País/Global/Mi red, con **Local** como estado
  inicial (antes era "Mis jugadores").
- **"Mis jugadores" → "Mi red"**: acotado a partidos computables compartidos en los
  últimos **180 días** (antes era todo el historial, sin ventana de tiempo).
- **Ocultar de Mi red**, por fila, + sheet **"Ocultos (N)"** con restauración individual.
  Nunca borra partidos, Nivel ni Ranking — es solo una preferencia de vista personal.
- **Segmentación por género** (Masculino/Femenino) vía desplegable compacto, default =
  género propio declarado, nunca mezclada dentro de la Clasificación.
- **`General | Por Nivel` eliminado** como modos paralelos. Nivel pasa a ser un filtro
  ("Todos los niveles ▾") con atajo directo **"Mi nivel · Nivel X"**.
- **Header** con ícono de lupa (filtra en vivo la Clasificación visible) e ícono de ayuda
  (?), en reemplazo del bloque de búsqueda permanente y el link "¿Cómo funciona?" que
  antes vivían en el cuerpo de la pantalla.
- **"Tu posición" rediseñada** con el lenguaje visual de "Último partido" (borde lima,
  glow, radio grande), la etiqueta "TU POSICIÓN" ahora vive DENTRO de la tarjeta, nunca es
  sticky, y **toda la tarjeta es tappeable**: tocarla hace scroll suave hasta la fila
  propia en la Clasificación (saltando de bloque de 50 si hace falta). Esto reemplaza y
  elimina por completo "Verme en la clasificación" y el bloque "Cerca tuyo".
- **Clasificación** siempre arranca en **#1** (nunca autocentrada en uno mismo);
  paginación progresiva de 50 en 50, preservada tal cual estaba.
- **Botón flotante "↑ Ir al inicio"**, aparece solo lejos del top, scroll suave, probado
  en mobile/tablet/desktop.
- **Fix de bug pedido explícitamente**: Ranking → Mi Perfil → Volver ahora vuelve a
  Ranking (antes iba a Home). Perfil público, que ya andaba bien, no se tocó.
- **Contraste de tabs** corregido como fix de componente compartido (`.history-tab.is-
  active`), no parche local de Ranking — el mismo fix mejora también Historial y Mis
  grupos.
- **Espaciado del aviso "Hay una nueva versión de BRAMU"** normalizado (pedido como pulido
  general, no como feature de Ranking).

## 2. Qué cambió respecto de V03.5

V03.5 tenía "Mis jugadores"/Local/Provincial/País/Global como pestañas sin orden
priorizado, "General"/"Por Nivel" como dos modos paralelos, una tarjeta "Tu posición" con
título externo + botón "Verme en la clasificación" + bloque separado "Cerca tuyo", una
zona de búsqueda y un link de ayuda permanentes en el cuerpo, y el back de Mi Perfil roto
cuando se entraba desde Ranking. V03.5.1 reemplaza esa presentación punto por punto (así
lo autoriza expresamente el propio documento en su §20), sin tocar la lógica matemática
del Ranking ni la fórmula de Nivel BRAMU, que siguen intactas.

## 3. Adaptaciones respecto del documento original

Tres decisiones de implementación que el documento dejaba abiertas y se resolvieron así:

- **La lupa del header no reabre el buscador global de jugadores** (el patrón viejo de
  V03.3, pensado para agregar jugadores). En cambio filtra en vivo la Clasificación del
  universo/ámbito actualmente activo — más simple, y reutiliza el mismo campo de texto que
  ya existía en la pantalla.
- **Las filas "Calibrando"/"Inactivo" dentro de Mi red no se filtran por género.** Son
  informativas (sin puesto, sin comparación), así que la regla de "nunca mezclar géneros
  en una clasificación" no les aplica — esa regla gobierna solo la Clasificación real.
- **El fix de espaciado del aviso de nueva versión quedó acotado por ID**
  (`#update-available-modal`), nunca tocando las clases `.overlay` compartidas por otros
  ~18 modales de la app — tal como pedía el documento explícitamente.

## 4. Bugs encontrados y corregidos

- El bug de back-navegación pedido en el propio documento (Ranking → Mi Perfil → Volver
  iba a Home): corregido replicando el patrón ya correcto que usa Perfil público
  (`playerPublicOrigin`) en un nuevo `profileScreenOrigin`.
- Una línea redundante (`globalBlocked.hidden = false; ... = true;`) introducida durante
  la propia reescritura de esta ronda, encontrada por autorevisión antes de QA — sin
  impacto visible en el resultado final, corregida a una sola asignación.
- La verificación en vivo (mobile/tablet/desktop) no encontró regresiones nuevas en Home,
  Historial, Mis grupos, marcador, Resumen ni bottom nav.

## 5. Decisiones UX materializadas

- Género y Nivel conviven como dos desplegables compactos lado a lado, nunca como tabs
  grandes — evita que compitan visualmente con los ámbitos (Local/Provincial/...), que son
  la jerarquía principal.
- Azul/magenta quedan como acentos secundarios del selector de género, nunca recolorean la
  pantalla entera — lima sigue siendo el color primario de la marca.
- "Tu posición" copia el lenguaje visual de "Último partido" pero no su contenido — mismo
  idioma visual (borde lima, glow, radio grande), información distinta.

## 6. Tests agregados y resultado final

12 aserciones nuevas en `ranking.js`/`store.js`/`tests.html`, cubriendo únicamente lógica
pura nueva (nunca CSS/markup):

- ventana de 180 días de Mi red (`computeNetworkNames`): incluye compañeros dentro de la
  ventana, excluye a los que solo compartieron partidos más viejos, excluye placeholders y
  al propio jugador;
- género mock determinístico y filtro por género (`mockGenderForName`/`filterByGender`);
- CRUD completo de ocultar/restaurar en `Store` (`HIDDEN_NETWORK_PLAYERS`).

**Resultado final: 913/913 tests OK** (901 previos de V03.5 + estos 12), corrida una sola
vez después de aplicar el bump de versión, sin regresiones.

## 7. QA realizado

Verificación en vivo en el navegador, con una cuenta y partidos sembrados a propósito para
poder probar la ventana de 180 días y la paginación real:

- **Mobile (375px), prioridad 1**: header (lupa/ayuda), tabs (orden + contraste), género y
  Nivel (incluido el atajo "Mi nivel"), Tu posición (tap → scroll a fila propia,
  verificado tanto con la fila ya visible como con la fila lejos, salto de bloque de 50
  incluido), eliminación de "Cerca tuyo"/"Verme en la clasificación", Clasificación
  arrancando en #1, paginación "Cargar 50 más", botón flotante "Ir al inicio", Mi red
  (ventana de 180 días verificada con datos reales — compañeros dentro de la ventana
  aparecen, compañeros solo con partidos viejos no aparecen), ocultar/Ocultos/restaurar,
  Perfil público y Mi Perfil (con el fix de back confirmado en ambos sentidos: vuelve a
  Ranking si se entró desde ahí, vuelve a Home si se entró desde la bottom nav), Global
  bloqueado, estado "sin ubicación".
- **Tablet (768px)**: layout limpio, sin solapamientos.
- **Desktop**: chequeo rápido, sin solapamientos.
- Regresión rápida en Home, Historial, Mis grupos y bottom nav: intactos.
- Sin errores de consola nuevos, ni en local ni en producción.

## 8. Commit, tag, push, deploy

- Commit `8100bfc`, staging explícito de solo los archivos de esta ronda (excluyendo a
  propósito trabajo paralelo no relacionado que ya estaba sin commitear en el repo:
  `BRAMU_Intelligence*`, `Referencias/`, `Backup/`, `Logo.ai`).
- Tag `BRAMUlab_V03.5.1`, siguiendo la convención de nombres ya usada en toda la línea V03.
- Push a `origin/main` y al tag.
- Deploy de GitHub Pages verificado (`pages-build-deployment` success sobre el commit
  `8100bfc`) antes de dar la ronda por publicada.

## 9. URL publicada

https://sebastianvilaa.github.io/BRAMUlab/bramulab/ — confirmado sirviendo
`BRAMUlab V03.5.1` (chequeado contra `version.json` en producción), sin errores de
consola.

## 10. Limitaciones conocidas

- El género de los jugadores mock territoriales sigue siendo una simulación
  determinística por nombre (`RK.mockGenderForName`), no un dato real declarado — misma
  naturaleza que el Nivel mock ya documentado en V03.5.
- Dataset territorial 100% Argentina — Global sigue bloqueado en este build (heredado de
  V03.5, sin cambios en esta ronda).

## 11. Deuda / puntos a revisar en la próxima prueba visual de Sebastián

- Confirmar en un dispositivo real (no solo el navegador de desarrollo) que el gesto de
  tap sobre toda la tarjeta "Tu posición" no genera falsos positivos al hacer scroll
  normal de la pantalla.
- Revisar si el filtro de género aplicado solo a la Clasificación (y no a las filas
  Calibrando/Inactivo de Mi red — ver §3) se siente intuitivo en uso real, o si conviene
  que también las filtre.
- Con cuentas reales (no la cuenta de prueba sembrada para esta ronda), confirmar que la
  ventana de 180 días de Mi red muestra a la gente esperada — la lógica está testeada con
  datos sintéticos, pero el prototipo no tuvo una segunda cuenta real jugando en paralelo
  durante esta ronda.
- Evaluar si el desplegable de género necesita más opciones a futuro (fuera de alcance de
  esta ronda, pero puede surgir en la prueba real).

## 12. Estado de cierre de Ranking BRAMU

**Ranking todavía NO está cerrado definitivamente dentro de V03.** Esta publicación es una
ronda de refinamiento UX más, no el cierre de la función. Después del deploy, Sebastián la
va a probar como usuario real; según lo que encuentre, puede pedir `V03.5.2` o
microajustes puntuales. Recién cuando la experiencia se considere realmente terminada se
da por cerrado Ranking dentro de V03 (ver §19 de `BRAMUlab_V03.5.1.md`). No se avanza a
ninguna versión nueva sin instrucción explícita de Sebastián.
