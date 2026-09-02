# BRAMU Lab — Rama Jugador
## Etapa 3: plan técnico de separación/implementación + auditoría de organización del repositorio

**Estado de este documento:** análisis y planificación únicamente. No se modificó ningún código, no se restauró ningún commit, no se copió ninguna carpeta, no se movió ni eliminó ningún archivo, no se hizo commit ni push para producir este documento.

Responde a tres documentos de entrada:
1. `BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md`
2. `BRAMU_Backlog_Futuro_Validacion_Partidos.md`
3. `BRAMU_Direccion_Visual_Moodboard_Analisis.md`

Contiene dos planes separados: **Plan 1** sigue al pie de la letra la sección "Entrega solicitada a Claude antes de programar" del Consolidado de Etapa 3. **Plan 2** es una auditoría de organización del repositorio y del método de trabajo, pedida aparte porque la estructura documental actual se está volviendo difícil de mantener.

---

# PLAN 1 — ETAPA 3 RAMA JUGADOR

## 1. Diagnóstico breve del estado actual

- El repo tiene una sola app real: `bramu-lab/` (PWA estática, sin build). Nunca tuvo una segunda ruta — todo lo de la Rama Jugador (Etapa 2 + corrección funcional) se implementó **dentro de los mismos archivos** del marcador (`app.js`, `index.html`, `store.js`, `styles.css`, `sw.js`), sumando un único archivo nuevo (`player-home.js`).
- GitHub Pages sirve el repo completo desde la rama `main`, carpeta raíz (`source.branch: "main"`, `source.path: "/"`) — confirmado vía la API de GitHub, no supuesto. Esto importa mucho para el punto 3: **cualquier carpeta nueva en la raíz queda publicada automáticamente**, sin configuración adicional.
- La URL compartida (`.../BRAMUlab/bramu-lab/`) hoy sirve el HEAD actual (`34a2d5c`), que ya incluye toda la Rama Jugador. El problema que describe el consolidado es real y ya está pasando: cualquiera con el link puede estar viendo el Home del jugador.
- Confirmé con `git diff --stat` entre el último commit sin Rama Jugador y HEAD: el cambio toca 8 archivos, todos dentro de `bramu-lab/`, y agrega un único archivo nuevo. No hay ningún asset (ícono, imagen) nuevo todavía.
- Encontré un problema de fondo ya activo en el código, no hipotético: el orden de "Último partido" y el filtro de Home usan `finishedAt` (momento en que se guardó) en vez de una fecha real de juego — es exactamente el bug que describe la sección 3 del consolidado, y lo ubiqué con precisión (detalle en el punto 6).

## 2. Commit propuesto para congelar la URL anterior

**`5c46337`** (tag `v14`, 2026-08-31) — *"V14: Cargar partido jugado — carga manual de partidos ya jugados"*.

Evidencia:
- Es el padre directo de `0e3a132` ("Rama Jugador — Etapa 2: Home del jugador (beta)"), el primer commit que toca algo de la Rama Jugador.
- `git diff --stat 5c46337 HEAD -- bramu-lab` muestra exactamente los 8 archivos de la Rama Jugador y ninguno más — confirma que `5c46337` es un corte limpio, sin contaminación parcial.
- `git ls-tree -r 5c46337 -- bramu-lab` vs. el árbol actual: el conjunto de archivos es idéntico salvo por `player-home.js` (inexistente en `5c46337`). No hay íconos ni assets nuevos que separar.
- Ya está tageado (`v14`), así que se puede referenciar sin memorizar el hash (`git show v14:...`).

## 3. Ruta/nombre propuesto para la Rama Jugador

**`bramu-player/`** — el nombre que el propio consolidado sugiere como ejemplo, y lo confirmo como la mejor opción: sigue la convención ya establecida (`bramu-lab`), es autoexplicativo, y como Pages sirve desde la raíz, quedaría publicada sola en `https://sebastianvilaa.github.io/BRAMUlab/bramu-player/` sin tocar nada de configuración de GitHub.

Importante — aclaración que el consolidado da por hecho pero conviene decir explícito: **"privada por desconocimiento del enlace" no es privacidad real.** El repo es público y Pages es público; cualquiera que adivine o reciba la URL puede entrar. Es la misma protección (ninguna) que ya tiene hoy `bramu-lab/`. Si en algún momento se necesita algo más fuerte, hace falta otra solución (auth, robots.txt + noindex como mínimo gesto, etc.) — no es parte de esta etapa, pero prefiero decirlo ahora y no que se descubra tarde.

## 4. Plan dividido en fases

### Fase 0 — Separación de infraestructura (sin features nuevas)
Puramente mecánica: preservar, congelar, separar caché/storage. Es la única fase que el consolidado autoriza a ejecutar recién con aprobación explícita del commit/rutas (su propio punto 57: *"No ejecutar esta separación hasta que el plan, el commit elegido y las rutas sean aprobados"*).

1. Copiar el `bramu-lab/` actual (HEAD, con toda la Rama Jugador) a `bramu-player/` — copia literal, nada se reescribe todavía.
2. Restaurar `bramu-lab/` al estado exacto de `5c46337` (git checkout de esa ruta a ese commit) — el marcador vuelve a ser exactamente lo que los amigos de Sebastián están usando hoy.
3. Editar `bramu-player/manifest.webmanifest`: `name`/`short_name` distintos (p. ej. `"BRAMU"` / `"Mi pádel"`), manteniendo `start_url`/`scope` relativos (`./`) — al vivir en su propia carpeta, se resuelven solos a `.../bramu-player/`, sin colisión con el scope de `bramu-lab/`.
4. Editar el `sw.js` de **ambas** carpetas (ver riesgo crítico en el punto 9 — es el hallazgo más importante de este plan).
5. Decidir y documentar la estrategia de `localStorage` (ver punto 6 — recomiendo compartir, no separar del todo).
6. Matriz de pruebas manuales con las dos URLs abiertas a la vez, en el mismo navegador (ver punto 10).

### Fase 1 — Semántica de fecha (`playedAt`)
Foundational: todo lo demás (Home, Historial, Hitos) depende de que esto esté bien. Va primero, antes de tocar UI.

### Fase 2 — Botón `+` con hoja de acciones
Chico y aislado: envolver el punto de entrada actual en una hoja con dos opciones. No toca el motor de puntuación.

### Fase 3 — Rediseño de "Cargar partido jugado" (la fase grande)
Se divide en sub-fases internas, cada una testeable por separado:
- 3a. Estructura del marcador (cabecera, filas de equipo, sets en columna) sin selector de jugadores todavía.
- 3b. Selector de jugadores (hoja con recientes + búsqueda + "agregar sin cuenta").
- 3c. Teclado numérico + validación de resultado (funciones puras, tests).
- 3d. Selector compacto de formato/sistema (una línea + hoja, reusando el modal existente).
- 3e. Guardado → Resumen de lectura → Editar (reabre precargado).

### Fase 4 — Reorganización del Home del jugador
Depende de la Fase 1 (`playedAt`). Puede avanzar en paralelo con partes de la Fase 3, pero conviene cerrarla después porque el rediseño de "Último partido" (§6.3) toma como referencia visual la nueva pantalla de carga (§5).

### Fase 5 — Historial: orden real + preparación de pestañas
Chica. El orden por `playedAt` es casi gratis una vez hecha la Fase 1; la preparación visual de pestañas es solo estructura, sin datos ficticios.

## 5. Archivos afectados por fase

| Fase | Archivos que se crean | Archivos que se modifican |
|---|---|---|
| 0 | `bramu-player/*` (copia completa de `bramu-lab/` hoy) | `bramu-lab/*` (revertido a `5c46337`); `bramu-player/manifest.webmanifest`, `bramu-player/sw.js`; posible ajuste mínimo en `bramu-lab/sw.js` (ver punto 9) |
| 1 | — | `bramu-player/app.js` (guardado + lecturas de fecha), `bramu-player/player-home.js` (orden, mes/ventana), `bramu-player/tests.html` |
| 2 | — | `bramu-player/index.html` (nuevo bottom-sheet), `bramu-player/app.js`, `bramu-player/styles.css` (clases nuevas, no retoque global) |
| 3 | Posible módulo nuevo, p. ej. `bramu-player/match-load.js`, para aislar las funciones puras de validación/parseo de esta pantalla (a definir en el detalle de la fase, no ahora) | `bramu-player/index.html`, `app.js`, `engine.js` (si hace falta exponer algo nuevo de validación, sin tocar lo existente), `styles.css`, `tests.html` |
| 4 | — | `bramu-player/index.html`, `app.js`, `player-home.js`, `styles.css`, `tests.html` |
| 5 | — | `bramu-player/app.js`, `player-home.js` |

`engine.js`/`stats.js` (motor de puntuación y BRAMU Intelligence del marcador completo) no deberían tocarse en ninguna fase salvo que la Fase 3 necesite **agregar** una función pura nueva (nunca modificar una existente) para el detalle de tie-break — a confirmar cuando se especifique esa fase en detalle.

## 6. Estrategia de compatibilidad/migración de fechas e historial

**Hallazgo clave, con evidencia:** `startedAt` ya se guarda hoy en las tres formas de finalizar un partido (`finishMatch`, `finishMatchGames`, `finishMatchManual` — confirmé las tres líneas). Para partidos en vivo, `startedAt` es el momento en que arrancó el marcador (que es, en la práctica, cuándo se jugó). Para partidos cargados manualmente, `startedAt` **ya es la fecha que el usuario eligió a mano** en el formulario actual — no el momento de guardar. Es decir: el dato que `playedAt` necesita **ya existe** en todos los registros históricos, con otro nombre.

Propuesta:
- No hace falta ninguna migración de datos. `playedAt` se agrega como campo nuevo y opcional a partir de ahora; para todo lo ya guardado, se deriva así: `playedAt ?? startedAt ?? finishedAt` (el último eslabón es un colchón defensivo, nunca debería usarse en la práctica).
- Aislar esto en una única función pura y testeable, p. ej. `PH.getPlayedAt(match)` en `player-home.js` — un solo lugar de verdad, nunca repetir la lógica de fallback en cada pantalla.
- Reemplazar **todos** los usos actuales de `.finishedAt` para ordenar o mostrar "cuándo fue" por `PH.getPlayedAt(...)`. Los ubiqué con precisión:
  - `player-home.js:67` — el `.sort()` de `filterMatchesForPlayer` (la causa exacta del bug de la sección 3 del consolidado).
  - `player-home.js:81` — el cálculo de "partidos este mes" (se va a volver "Actividad 30 días" en la Fase 4, pero la fecha usada debe corregirse ya en la Fase 1).
  - `app.js:4538` — fecha mostrada en cada fila del Historial.
  - `app.js:4723` — fecha mostrada en la tarjeta Último Partido.
  - `app.js:4826` — fecha en el pie de la imagen de Compartir (menor prioridad, cosmético).
- La nueva pantalla de carga (Fase 3, §5.6) escribe `playedAt` explícito desde el primer momento. Para partidos en vivo, lo más simple y consistente es que `finishMatch`/`finishMatchGames` empiecen a copiar `playedAt = startedAt` también (mismo valor que ya tenían implícito, ahora con el nombre correcto) — así el campo queda presente en todo registro nuevo, sin ambigüedad de fallback hacia adelante.
- Test imprescindible del consolidado (cargar hoy, después uno de ayer, hoy debe seguir siendo Último Partido): se vuelve un test puro directo sobre `filterMatchesForPlayer`/`computeRecentForm` una vez corregido el `.sort()`, sin necesitar DOM.

## 7. Estrategia de separación de PWA, service worker, caché y storage

**PWA/manifest:** cada carpeta con su propio `manifest.webmanifest`, `start_url`/`scope` relativos (ya es el patrón actual, se resuelve solo por carpeta). Recomiendo agregar el campo `id` explícito en ambos manifests como buena práctica (no imprescindible, ya que `start_url` difiere), para que el sistema operativo no tenga ambigüedad si algún día ambas apps se instalan en el mismo dispositivo.

**Service worker — riesgo real, no teórico:** `Cache Storage` (la API que usa `sw.js`) es **por origen**, no por ruta. Las dos apps van a vivir en `sebastianvilaa.github.io`, el mismo origen. Revisé el `activate` handler actual de `sw.js`:

```js
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
});
```

Esto borra **cualquier caché cuyo nombre no sea el propio**, sin filtrar por app. Si `bramu-lab/sw.js` usa `CACHE_NAME = 'bramulab-v13.4'` y `bramu-player/sw.js` usa, por ejemplo, `'bramuplayer-v1'`, la próxima vez que se active cualquiera de los dos service workers en un navegador que visitó ambas URLs, **va a borrar la caché de la otra app** (rompiendo su modo offline hasta la próxima visita). Es exactamente lo que el consolidado pide evitar en su punto 4 y no se resuelve solo con nombres distintos — nombres distintos sin este ajuste **empeoran** el problema en vez de arreglarlo.

Corrección mínima necesaria (a proponer, no a implementar todavía) en **ambos** `sw.js`: que el filtro de limpieza solo borre cachés de la propia familia, por ejemplo `k.startsWith('bramulab-') && k !== CACHE_NAME` en el marcador y `k.startsWith('bramuplayer-') && k !== CACHE_NAME` en la Rama Jugador. Es un cambio de una línea en cada archivo, pero implica tocar el `sw.js` de la app "congelada" — lo marco como excepción justificada a "no tocar el marcador", porque sin esto la separación no es realmente segura.

**`localStorage` — decisión de producto, no solo técnica:** acá el consolidado deja la puerta abierta ("las claves nuevas no deben contaminar") pero no resuelve si el *historial en sí* debe compartirse o separarse. Mi recomendación, con el respaldo de lo que ya vi en el código:

- **Compartir** `padellab.history.v1`, `padellab.playerNames.v1`, `padellab.recordingMode.v1` y `padellab.activeMatch.v1` entre ambas apps. Es la misma persona, los mismos partidos reales — separar el historial obligaría a una migración inicial y, peor, dejaría el nuevo Home del jugador arrancando "vacío" pese a que Sebastián ya tiene partidos cargados. Además, la propia sección 3 del consolidado ya asume compatibilidad hacia atrás con partidos sin `playedAt` — un diseño que solo tiene sentido si los datos se siguen leyendo desde el mismo lugar.
- **No hace falta namespacing nuevo** para `padellab.currentPlayerName.v1`: ya es una clave exclusiva de la Rama Jugador (el marcador congelado en `5c46337` nunca la lee ni la escribe), así que no hay colisión posible con el marcador viejo.
- Riesgo real a vigilar: si en el futuro cualquiera de las dos apps cambia el *schema* de `activeMatch` o `history` de forma incompatible, la que quedó atrás puede llegar a descartar datos por `schemaVersion` distinto (la propia lógica de `store.js` ya hace esto a propósito, de forma segura — no rompe, pero silenciosamente ignora). Como el marcador queda congelado y no se le va a tocar el código, este riesgo es bajo y unidireccional (solo la Rama Jugador evoluciona), pero conviene documentarlo como watch-item.

## 8. Estrategia de componentes para no duplicar DOM/CSS/lógica

Honestidad sobre el punto de partida: al forkear `bramu-lab/` completo en `bramu-player/`, **hay duplicación real e inevitable el día uno** — es el costo de que hoy la Rama Jugador viva entreverada en los mismos archivos que el marcador. No hay forma de separar sin copiar primero.

Lo que sí propongo:
- `engine.js` y `stats.js` deberían quedar **idénticos** entre ambas carpetas inmediatamente después del fork (lo voy a verificar con un diff en el momento de ejecutar la Fase 0) — son el motor de puntuación y BRAMU Intelligence del marcador completo, que esta etapa tiene explícitamente prohibido tocar.
- No propongo extraer un `shared/` a nivel raíz todavía — sería anticipar una arquitectura (rutas cruzadas entre carpetas, otro nivel de indirección) que el propio consolidado pide evitar ("no introducir... dependencias pesadas"). Lo dejo marcado como decisión a revisar más adelante, cuando quede claro si `engine.js`/`stats.js` van a seguir divergiendo entre las dos apps o no.
- Dentro de `bramu-player/`, sí aplican los criterios visuales de la sección 8 del consolidado: componentes nuevos con clases reutilizables y roles semánticos, sin colores hardcodeados nuevos, reusar el lenguaje SVG existente — esto lo sigo al pie de la letra en cada fase de UI.

## 9. Riesgos y decisiones todavía ambiguas

1. **El filtro de limpieza de caché de `sw.js`** (punto 7) — es una excepción real a "no tocar el marcador congelado". Necesito el ok explícito antes de tocarlo, aunque sea mínimo.
2. **Compartir vs. separar `localStorage`** (punto 7) — es la decisión de mayor impacto de este plan. Recomiendo compartir; si se prefiere separar por completo, hace falta sumar un paso de "copia inicial" del historial existente hacia las claves nuevas, y aceptar que el Home puede arrancar sin datos reales hasta esa copia.
3. **Nombre final de `bramu-player/`** — se da por bueno salvo que se prefiera otro.
4. **Vida útil del marcador congelado** — el consolidado dice "podrán reunificarse más adelante" pero no fija cuándo ni cómo se decide que `bramu-lab/` deja de recibir uso. No es bloqueante ahora, pero conviene tenerlo en mente para no mantener dos apps para siempre sin querer.
5. **Selector de jugadores (§5.2)** — "reutilizar los datos locales existentes" es claro, pero falta definir el modelo mínimo de "jugador sin cuenta" (¿sigue siendo un string, como hoy, o ya conviene un objeto liviano con id local?) antes de tocar la Fase 3. Se trataría como parte del detalle de esa fase, no de este plan de separación.
6. **Tie-break en el teclado numérico (§5.4)** — el consolidado explícitamente permite dejarlo para una mejora posterior si complejiza la etapa; se marca como candidato a simplificar en la primera versión de la Fase 3 (guardar el resultado del set como `7–6`/`6–7` sin pedir el score interno, igual que ya hace el editor de Por Games hoy).

## 10. Plan de tests automáticos y pruebas manuales

**Automáticos (en `tests.html`, siguiendo el patrón ya establecido):**
- `PH.getPlayedAt` — con `playedAt` presente, ausente con `startedAt`, y el caso defensivo de ningún dato de fecha.
- Orden de `filterMatchesForPlayer`/`computeRecentForm` con partidos cargados fuera de orden cronológico de guardado — el test explícito "hoy y después ayer" del consolidado.
- Validación de resultado del teclado numérico (Fase 3) contra `E.isValidCompletedSetScore` — reusar el validador reglamentario ya existente, no escribir uno nuevo.
- Selector de jugadores: no permitir duplicados (función pura de filtrado, sin DOM).
- Suite completa preexistente (hoy 349/349) debe seguir en verde después de cada fase.

**Manuales, ambas URLs abiertas a la vez en el mismo navegador (clave para validar la separación):**
1. Instalar/abrir `bramu-lab/` viejo → confirmar que se ve y funciona exactamente como antes de la Rama Jugador (sin barra inferior, sin Home del jugador).
2. Abrir `bramu-player/` → confirmar Home, identificación, historial compartido con datos reales ya existentes.
3. Recargar `bramu-lab/` después de haber visitado `bramu-player/` → confirmar que sigue funcionando offline (verifica que no se borró su caché).
4. Y viceversa.
5. Cargar un partido desde `bramu-player/` → confirmar que aparece en el Historial de `bramu-lab/` también (si se decide compartir storage) sin romper nada de esa vista vieja.
6. Los 17 criterios de aceptación de la sección 13 del consolidado, uno por uno, sobre `bramu-player/`.

## 11. Confirmación

No se modificó ningún archivo de código, no se restauró ni reseteó ningún commit, no se copió ninguna carpeta, no se hizo commit ni push. Todo lo anterior es análisis y propuesta, a la espera de aprobación del commit (`5c46337`), la ruta (`bramu-player/`) y las decisiones marcadas como ambiguas antes de ejecutar la Fase 0.

---

# PLAN 2 — ORGANIZACIÓN DEL REPOSITORIO Y MÉTODO DE TRABAJO

## 1. Inventario resumido

| Carpeta | Tamaño | Contenido | Estado en git |
|---|---|---|---|
| `bramu-lab/` | 1.9 MB | La app real (código + íconos) | Tracked, al día |
| `Reportes y consolidados/BRAMUlab/` | dentro de 472 KB totales | 9 Consolidados + 7 Reportes del marcador (V10 a V14) | **Sin trackear** — nunca se hizo `git add` |
| `Reportes y consolidados/Jugador/` | ídem | 10 documentos de la Rama Jugador (Etapa 1 a 3, auditorías, backlog, dirección visual) | Trackeados |
| `Sistema Grafico/` | 5.2 MB | 4 PNG (logo, ícono, sistema gráfico, ícono2) | 3 sin trackear, 1 trackeado (inconsistente entre sí) |
| `RRSS/` | 10 MB | 6 capturas/imágenes para redes sociales | Sin trackear |
| `Referencias visuales/` | 6.5 MB | 15 fotos de Premier Padel (moodboard) | Sin trackear |
| Raíz del repo | — | `Consolidado V10.md`, `Consolidado V11.md`, `Reporte V10/V11/V12 - para ChatGPT.md` | **Trackeados pero borrados del disco** — git los sigue viendo como "pendientes de commit de borrado" |
| `.claude/` | 8 KB | `dev-server.py`, `launch.json` — tooling de desarrollo | Trackeado |

## 2. Identificación por tipo

- **Aplicación activa:** `bramu-lab/` — única app real hoy, en producción.
- **Versiones publicadas:** cada commit desde `v9.2` hasta `v14` tiene su tag en git — es, de hecho, la fuente de verdad más confiable de todo el repo (ver punto 6). Nada que reorganizar ahí: ya funciona bien.
- **Reportes técnicos:** los "Reporte V{N} - para ChatGPT.md" — documentos de traspaso técnico+producto para relayar a ChatGPT. Hoy viven en `Reportes y consolidados/BRAMUlab/` (7 de 9 versiones) más 2 restos en la raíz.
- **Consolidados de producto/UX:** los "Consolidado V{N}.md" (marcador) y los "BRAMU_Rama_Jugador_Etapa_{N}_..." (Rama Jugador) — especificaciones que autorizan una ronda de implementación.
- **Auditorías:** `BRAMU_Rama_Jugador_Auditoria_Funcional.md`, `BRAMU_Rama_Jugador_Auditoria_Visual.md` — análisis de estado real del código/diseño, no especificación de producto.
- **Documentos futuros (no ejecutables todavía):** `BRAMU_Backlog_Futuro_Validacion_Partidos.md`, `BRAMU_Direccion_Visual_Moodboard_Analisis.md` — backlog conceptual y exploración visual, explícitamente marcados como "no implementar todavía" en su propio texto.
- **Referencias visuales:** `Referencias visuales/` (moodboard fuente) y `Sistema Grafico/` (logo/ícono actuales de marca).
- **Archivos obsoletos, duplicados o de estado incierto:**
  - Los 5 archivos "D" en la raíz (`Consolidado V10/V11.md`, `Reporte V10/V11/V12.md`) — son restos: ya existen versiones al día en `Reportes y consolidados/BRAMUlab/`, pero git todavía los tiene registrados en la ruta vieja. No están duplicados en contenido (asumiendo que es el mismo archivo movido a mano), pero sí en referencia de git.
  - `Sistema Grafico/BRAMULab icono2.png` — sin trackear, sin que quede claro en qué se diferencia de `BRAMULab icono.png` (si es una iteración, un descarte, o el que reemplaza al otro).
  - `Reportes y consolidados/Jugador/BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md` — conceptualmente ya fue "consumido" (Etapa 2 se implementó, corrigió, comiteó) — no es obsoleto como registro histórico, pero conviene marcarlo como cerrado, no como "consolidado activo".
  - Dos `.DS_Store` sueltos (raíz y `Reportes y consolidados/`) — ruido de macOS, cero valor, candidatos directos a `.gitignore` (nunca llegaron a trackearse, así que ni siquiera hace falta sacarlos de git).

## 3. Propuesta de estructura final de carpetas

No se crea todavía — esto es la propuesta a aprobar:

```
BRAMUlab/                              (raíz del repo)
├── bramu-lab/                         (app: marcador — se congela en Fase 0 del Plan 1)
├── bramu-player/                      (app: Rama Jugador — nueva, Fase 0 del Plan 1)
├── docs/
│   ├── marcador/
│   │   ├── consolidados/              (Consolidado V10.md ... V14.md)
│   │   └── reportes/                  (Reporte V10 ... V14 - para ChatGPT.md)
│   ├── rama-jugador/
│   │   ├── consolidados/              (Etapa 1 Contexto, Etapa 2 Home Beta, Etapa 3 Consolidado...)
│   │   ├── informes/                  (Etapa 1 Análisis, Etapa 2 Informe, Correccion Funcional...)
│   │   ├── auditorias/                (Auditoria Funcional, Auditoria Visual)
│   │   └── backlog-futuro/            (Backlog Validación Partidos, Dirección Visual Moodboard)
│   └── identidad-visual/              (Sistema Grafico/*, Referencias visuales/*)
├── redes-sociales/                    (RRSS/, renombrado sin espacios/mayúsculas — ver punto 5)
└── .claude/                           (sin cambios)
```

Notas de diseño de esta estructura:
- Separa por **tipo de documento** primero (consolidado vs. informe vs. auditoría vs. backlog), y dentro de cada tipo por **rama de producto** (marcador vs. Rama Jugador) — hoy es al revés (todo mezclado dentro de una carpeta por rama), lo que ya está costando (es el motivo de este pedido).
- `docs/` como raíz documental separa claramente "esto es código que corre" de "esto es papel/decisión" — hoy ambos conviven como carpetas hermanas sin jerarquía que lo exprese.
- Nombres de carpeta en minúscula sin espacios ni tildes (`rama-jugador`, no `Rama Jugador`) — evita problemas de escaping en cada comando de terminal y es más portable.

## 4. Tabla archivo por archivo

| Archivo(s) | Ubicación actual | Ubicación propuesta | Motivo | Estado |
|---|---|---|---|---|
| `Consolidado V10.md`, `V11.md` | raíz (trackeados, borrados en disco) | `docs/marcador/consolidados/` | Ya existen ahí (en `Reportes y consolidados/BRAMUlab/`) — solo falta que git lo refleje | **Revisar**: confirmar que el contenido en la nueva ubicación es igual antes de resolver el estado "borrado" en git |
| `Consolidado V12. Express.md`, `V12.md`, `V13.md`, `V13.2.md`, `V13.3.md`, `V13.4.md`, `V14.md` | `Reportes y consolidados/BRAMUlab/` | `docs/marcador/consolidados/` | Reubicación directa, mismo tipo | Activo (histórico de referencia) |
| `Reporte V10-V14 - para ChatGPT.md` (7 archivos) | `Reportes y consolidados/BRAMUlab/` | `docs/marcador/reportes/` | Reubicación directa | Activo (histórico de referencia) |
| `Reporte V10.md`, `V11.md`, `V12.md` (raíz) | raíz (trackeados, borrados en disco) | — | Duplicados de los de arriba | **Revisar**: resolver el estado de git, no crear una tercera copia |
| `BRAMU_Rama_Jugador_Etapa_1_Contexto.md` | `Reportes y consolidados/Jugador/` | `docs/rama-jugador/consolidados/` | Es la especificación que abrió la Rama Jugador | Activo (histórico) |
| `BRAMU_Rama_Jugador_Etapa_1_Analisis.md` | ídem | `docs/rama-jugador/informes/` | Es análisis del repo, no una decisión de producto | Activo (histórico) |
| `BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md` | ídem | `docs/rama-jugador/consolidados/` | Especificación que autorizó la Etapa 2 | Archivar conceptualmente (ya implementado y comiteado) |
| `BRAMU_Rama_Jugador_Etapa_2_Informe.md` | ídem | `docs/rama-jugador/informes/` | Informe de resultado de esa etapa | Archivar conceptualmente |
| `BRAMU_Rama_Jugador_Correccion_Funcional.md` | ídem | `docs/rama-jugador/informes/` | Informe de una corrección puntual | Archivar conceptualmente |
| `BRAMU_Rama_Jugador_Auditoria_Funcional.md` | ídem | `docs/rama-jugador/auditorias/` | Auditoría de estado, no consolidado | Activo — insumo directo del Plan 1 |
| `BRAMU_Rama_Jugador_Auditoria_Visual.md` | ídem | `docs/rama-jugador/auditorias/` | Auditoría de estado | Activo — insumo de la futura etapa visual |
| `BRAMU_Rama_Jugador_Etapa_3_Consolidado_Producto_UX.md` | ídem | `docs/rama-jugador/consolidados/` | Es el consolidado analizado en el Plan 1 | **Activo — documento vigente ahora mismo** |
| `BRAMU_Backlog_Futuro_Validacion_Partidos.md` | ídem | `docs/rama-jugador/backlog-futuro/` | Explícitamente "no forma parte del próximo consolidado de implementación" | Activo (referencia futura, no ejecutable) |
| `BRAMU_Direccion_Visual_Moodboard_Analisis.md` | ídem | `docs/rama-jugador/backlog-futuro/` | Explícitamente "no ejecutable, insumo de discusión" | Activo (referencia futura) |
| `Sistema Grafico/BRAMULab Logo.png`, `Sistema Grafico.png`, `icono.png` | raíz | `docs/identidad-visual/` | Assets de marca, no código | Activo |
| `Sistema Grafico/BRAMULab icono2.png` | raíz | `docs/identidad-visual/` | Assets de marca | **Revisar**: aclarar si reemplaza a `icono.png` o es una variante a conservar |
| `Referencias visuales/*.jpg` (15 fotos) | raíz | `docs/identidad-visual/referencias-premier-padel/` | Ya analizadas y resumidas en el moodboard | Activo como respaldo, de bajo uso diario |
| `RRSS/*.png` (6 imágenes) | raíz | `redes-sociales/` | Sin relación con documentación de producto | Activo, uso externo (no de este proyecto de código) |
| `.DS_Store` (raíz y en `Reportes y consolidados/`) | — | — | Ruido de macOS | **Eliminar** (vía `.gitignore`, nunca trackeados) |
| `.claude/dev-server.py`, `launch.json` | `.claude/` | sin cambios | Tooling de desarrollo, no documentación | Activo, no tocar |
| `bramu-lab/*` | raíz | sin cambios de fondo (solo su contenido se congela en `5c46337`, ver Plan 1) | Es la app | Activo |

## 5. Convención de nombres y versiones para documentos futuros

- **Prefijo por rama de producto**, siempre: `BRAMU-Marcador_` o `BRAMU-Jugador_` (guion en vez de espacio en el prefijo, para que quede claro de un vistazo a qué rama pertenece un archivo aunque se lo saque de su carpeta).
- **Tipo de documento** después del prefijo, en un vocabulario cerrado de 4 palabras: `Consolidado`, `Informe`, `Auditoria`, `Backlog`.
- **Versión o etapa**, siempre numérica y en el mismo lugar: `V14` para el marcador (ya es la convención existente, no cambiarla), `Etapa3` para la Rama Jugador (ya es la suya también).
- **Descripción corta al final**, 2-4 palabras, sin artículos.
- Patrón resultante: `BRAMU-Jugador_Consolidado_Etapa3_ProductoUX.md`, `BRAMU-Marcador_Consolidado_V14.md`, `BRAMU-Jugador_Auditoria_Funcional.md`.
- Carpetas y nombres de archivo: minúsculas para carpetas, el patrón `Palabra_Palabra` (guion bajo) para archivos — ya es la convención de hecho en `Reportes y consolidados/Jugador/`, solo formalizarla y aplicarla también al lado del marcador (hoy tiene espacios: `"Consolidado V13.2.md"`).
- Nunca reusar un nombre de versión/etapa ya cerrado. Si hace falta un ajuste chico sobre una etapa ya implementada, es un `Informe` nuevo (como ya se hizo con `Correccion_Funcional`), no editar el consolidado original — mantiene la especificación original intacta como referencia histórica de qué se pidió.

## 6. Fuente de verdad por tipo de información

| Tipo de información | Fuente de verdad |
|---|---|
| Qué features existen hoy y cómo funcionan | El código en `bramu-lab/`/`bramu-player/`, no ningún documento — los documentos describen intención, el código es lo que corre |
| Qué versión está publicada y cuándo | Los tags de git (`v9.2` a `v14`) — ya es exacto y confiable, no tocar ese sistema |
| Qué se decidió pedir en una ronda | El Consolidado de esa ronda — nunca se edita después de cerrada |
| Qué se implementó realmente y qué quedó afuera | El Informe de esa ronda (cuando existe) — si un consolidado no tiene informe, el mensaje de commit + el diff son la fuente |
| Estado real de un problema (bug, deuda técnica) | Una Auditoría — vive independiente del ciclo consolidado→informe, se puede volver a generar cuando haga falta re-chequear |
| Dirección futura no autorizada todavía | Backlog — nunca se implementa directo desde ahí, siempre pasa primero por un Consolidado que lo autorice explícitamente |
| Identidad de marca vigente | `bramu-lab/icons/` (los assets que la app usa de verdad) — `Sistema Grafico/` es el archivo fuente/de trabajo, no necesariamente lo último que está en producción |

## 7. Método de trabajo propuesto para las próximas etapas

```
Decisión de producto (Sebastián + ChatGPT)
        ↓
Consolidado aprobado (.md dropeado en la carpeta correspondiente)
        ↓
Análisis técnico (Claude lee, inspecciona repo, devuelve plan — NO implementa)
        ↓
Aprobación del plan (commit elegido, rutas, fases, decisiones ambiguas)
        ↓
Implementación por fase (una fase pequeña por vez, no todo junto)
        ↓
Tests automáticos de esa fase (suite completa en verde, no solo los nuevos)
        ↓
Informe de esa fase (qué se hizo, qué tests corrieron, qué falta)
        ↓
Prueba de Sebastián en el celular (sin esto no se avanza a la próxima fase)
        ↓
Commit (mensaje siguiendo la convención ya usada, sin mezclar fases)
        ↓
Push / deploy (solo con confirmación explícita, como se viene trabajando)
        ↓
Informe final de la etapa completa (cuando cierran todas sus fases)
```

Lo único que cambiaría respecto de cómo se viene trabajando: explicitar que **cada fase se prueba y aprueba antes de arrancar la siguiente**, en vez de implementar una etapa entera y recién ahí probar todo junto — con etapas tan grandes como esta (Etapa 3 tiene 5 fases, una de ellas con 5 sub-fases), probar solo al final hace mucho más difícil ubicar qué fase rompió qué cosa.

## 8. Recomendación de estrategia Git

- **Ramas:** seguir trabajando sobre `main` para cada fase pequeña (como se viene haciendo) — el repo es de un solo desarrollador efectivo y las fases ya son chicas y secuenciales; una rama por fase agregaría ceremonia de merge sin beneficio real a esta escala. Se reservaría una rama aparte únicamente para algo grande y reversible por naturaleza, como la Fase 0 de separación (crear `separacion-rama-jugador` antes de restaurar `bramu-lab/` a `5c46337`), justamente porque ese paso reescribe una carpeta entera y conviene poder abortarlo sin ensuciar `main` si algo sale mal a mitad de camino.
- **Commits:** uno por fase testeada y aprobada (patrón que ya se sigue) — nunca mezclar dos fases en un commit, para que `git log`/`git tag` sigan siendo la fuente de verdad confiable que son hoy.
- **Versiones/tags:** mantener el esquema `vN`/`vN.M` para el marcador (`bramu-lab/`, ya congelado en `v14`, no debería necesitar tags nuevos salvo que se decida reabrirlo). Para la Rama Jugador, arrancar un esquema propio y explícito desde la separación — sugiero `player-v1`, `player-v1.1`, etc., para que nunca se confunda con el versionado del marcador aunque convivan en el mismo repo.
- **Convivencia temporal marcador/Rama Jugador:** mientras ambas apps convivan, cada tag debería dejar claro a cuál pertenece con el prefijo (`v14` marcador, `player-v1` Rama Jugador) — evita que alguien mire `git tag` dentro de un año y no sepa a qué app corresponde cada uno.

## 9. Riesgos de reorganizar ahora y orden seguro para hacerlo después

**Riesgos de hacerlo ahora, junto con el Plan 1:**
- Mover documentación a la vez que se ejecuta la Fase 0 del Plan 1 (que ya implica copiar una carpeta entera y resetear otra) multiplica la superficie de error en un solo movimiento — si algo sale mal, es más difícil saber si fue la separación de apps o la reorganización de carpetas la que lo causó.
- Los 5 archivos "D" en la raíz son commits de borrado pendientes — resolverlos junto con una reorganización más grande arriesga perder de vista si el contenido en la ubicación nueva es realmente idéntico antes de confirmar el borrado.
- Cambiar rutas de documentos mientras hay consolidados "en vuelo" (como este mismo, la Etapa 3) puede generar confusión sobre cuál es la versión vigente si el movimiento no se hace con cuidado.

**Orden seguro para hacerlo después (recomendado):**
1. Primero cerrar y aprobar el Plan 1 (separación de apps) — es el cambio con más riesgo técnico real, mejor no combinarlo con nada más.
2. Una vez que `bramu-lab/`/`bramu-player/` estén separados y probados, reorganizar la documentación en un commit propio, chico y reversible (git conserva historial de todas formas, así que ni siquiera se pierde nada al mover).
3. Recién ahí resolver los 5 archivos "D" de la raíz (confirmando primero que el contenido en `docs/marcador/` es igual).
4. Último paso, de menor urgencia: mover `RRSS/`/`Referencias visuales/`/`Sistema Grafico/` — no bloquean nada técnico, se pueden posponer sin costo.

---

## Confirmación final

- **No se modificó ningún código.**
- **No se movió, renombró, archivó ni eliminó ningún archivo.**
- **No se hizo commit ni push.**
- **No se creó la estructura de carpetas propuesta.**

## Decisiones a aprobar antes de avanzar

1. El commit `5c46337` (tag `v14`) como punto de congelamiento del marcador.
2. El nombre `bramu-player/` para la nueva ruta.
3. Compartir `localStorage` (historial, jugadores conocidos, modo de registro, partido en curso) entre ambas apps, en vez de separarlo del todo.
4. Tocar el filtro de limpieza de caché en el `sw.js` del marcador congelado (mínimo, justificado, pero es una excepción a "no tocarlo").
5. El orden de fases propuesto para la Etapa 3 (0 → 1 → 2 → 3 → 4 → 5), y si conviene arrancar por la Fase 0 en cuanto se apruebe, o revisar antes el detalle de alguna fase (sobre todo la 3, la más grande).
6. La estructura de carpetas y el orden de reorganización documental del Plan 2 — y si se ejecuta en algún momento, o queda solo como referencia por ahora.
