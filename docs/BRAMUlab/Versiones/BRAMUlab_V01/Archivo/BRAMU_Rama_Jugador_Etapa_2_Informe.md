# BRAMU Lab — Rama Jugador
## Etapa 2: informe de implementación (Home del jugador — beta)

Implementación realizada dentro del repositorio y la app actuales de BRAMU Lab (`bramu-lab/`), siguiendo exactamente el alcance de `BRAMU_Rama_Jugador_Etapa_2_Home_Beta.md`. No se creó ningún archivo/repositorio nuevo, no se tocó el motor de puntuación, y no se avanzó sobre nada de la sección "Fuera de alcance" de ese documento. Los cambios están hechos en el working tree, sin commitear todavía.

---

## 1. Resumen de lo implementado

- **Header de Home**: los dos links sueltos (Historial / Modo de registro) se reemplazaron por un único botón compacto que sigue mostrando el modo activo ("MODO COMPLETO ▾" / "MODO POR GAMES · BETA ▾") y abre un menú con **Mi pádel / Historial / Modo de registro**. El selector de Completo/Por Games en sí no se tocó.
- **Identificación del jugador**: modal "¿Quién sos?" con autocompletado de los jugadores conocidos, nombre normalizado y persistido en `localStorage`. Reutilizado también para "Cambiar jugador".
- **Home del jugador nuevo** (`view-player-home`, acceso "Mi pádel"): tarjeta de identidad (con datos demo de ranking/categoría/tendencia marcados **BETA**), **Tu momento** (texto determinístico, sin IA), **Forma reciente** (últimos 5 resultados), **Último partido** (con acceso al detalle real en Análisis) y 4 widgets (partidos del mes, mejor racha, compañero frecuente, rival más enfrentado).
- **Barra inferior fija** de 5 posiciones (Inicio / Historial / **+** / Ranking / Perfil), visible solo fuera del partido en vivo. El **+** abre directamente el flujo existente de "Cargar partido jugado", sin modificarlo.
- **Ranking** (placeholder explícito, no ranking real) y **Perfil** (nombre actual + cambiar jugador) como vistas mínimas nuevas.
- **Campana de notificaciones** con estado vacío ("Todavía no tenés notificaciones").
- **Módulo nuevo `player-home.js`**: funciones puras de agregación histórica (filtrado por jugador, forma reciente, racha, compañero/rival frecuentes, texto de "Tu momento"), sin DOM — separado de `app.js` tal como pedía el documento.
- **Bump de versión de caché** (`v14` → `v14.1`) en `store.js`, `sw.js` y `version.json` para que la PWA no quede sirviendo assets viejos.

---

## 2. Archivos creados y modificados

| Archivo | Cambio |
|---|---|
| `bramu-lab/player-home.js` | **Nuevo.** Funciones puras de la Rama Jugador. |
| `bramu-lab/index.html` | Nuevo header-menu, modal de identificación, modal de notificaciones, vistas `view-player-home` / `view-ranking` / `view-profile`, barra inferior, `<script src="player-home.js">`. |
| `bramu-lab/app.js` | Orquestación DOM/navegación de todo lo anterior; `showView` extendido; `normalizePlayerName` ahora delega a `Store`; branch nuevo en el back-button de Análisis. |
| `bramu-lab/store.js` | `normalizePlayerName` (movida acá, única fuente), `loadCurrentPlayerName`/`saveCurrentPlayerName`, bump de `APP_VERSION`. |
| `bramu-lab/styles.css` | Sección nueva y delimitada al final del archivo: tarjeta pastilla, barra inferior, Home del jugador, placeholders. Nada del CSS existente se modificó. |
| `bramu-lab/sw.js` | Bump de `CACHE_NAME`, agregado `player-home.js` a `CORE_ASSETS`. |
| `bramu-lab/version.json` | `v14` → `v14.1`. |
| `bramu-lab/tests.html` | Carga `store.js` y `player-home.js`; 20 tests nuevos para las funciones puras. |

Diff total: **7 archivos modificados + 1 nuevo, ~695 líneas agregadas**, todo dentro de `bramu-lab/`.

---

## 3. Decisiones técnicas tomadas

- **`normalizePlayerName` se movió a `store.js`** (antes vivía solo en `app.js`) para que `app.js` y `player-home.js` compartan exactamente el mismo criterio de normalización al comparar nombres. `app.js` conserva una función wrapper con el mismo nombre para no tocar sus ~10 call-sites existentes.
- **Identidad de jugador = nombre normalizado**, persistido en `padellab.currentPlayerName.v1`. Deuda deliberada, tal como cerraba el documento (§2.11) — no es un sistema de cuentas.
- **Reparto de código**: `player-home.js` solo tiene funciones puras (sin DOM); toda la orquestación vive en `app.js`, mismo criterio que ya usan `engine.js`/`stats.js`.
- **Datos demo de identidad** (categoría/ranking/tendencia) centralizados en un único objeto (`PLAYER_PROFILE_DEMO`, en `app.js`) para que reemplazarlos el día que exista ranking real sea un cambio de una sola línea.
- **Desempate en "rival más frecuente"**: si dos rivales tienen la misma cantidad de enfrentamientos, gana el que aparece primero (determinístico, sin aleatoriedad).
- **"Tu momento" nunca combina más de 2 datos**, con prioridad forma reciente > compañero frecuente > actividad del mes, y cae en un mensaje de actividad/constancia si ninguno tiene muestra suficiente — nunca inventa un patrón.
- **No se modificó el botón "VOLVER AL INICIO"** de Resumen/Análisis (sigue yendo a la pantalla de configurar partido, `view-setup`): ese botón es compartido por los 3 modos de registro (Completo/Por Games/Manual) y no estaba mencionado en el alcance de esta etapa. Ver limitación §6.
- **No se modificó el "Cancelar"/back de "Cargar partido jugado"** (sigue yendo a `view-setup`): mismo criterio, no estaba en el alcance y así se preserva el comportamiento ya probado de V14.

---

## 4. Tests ejecutados y resultados

Corridos en navegador real (`tests.html`, Claude Browser tool) contra un server local:

**343 / 343 tests OK — todo verde** (323 tests preexistentes de motor + BRAMU Intelligence, sin tocar, más **20 tests nuevos** de `player-home.js`: filtrado por jugador, orden por fecha, equipo/compañero/rival, resultado por jugador (victoria/derrota/neutral sin inventar), forma reciente, mejor racha (sobre todo el historial, no solo los últimos 5), compañero y rival más frecuentes, los 4 casos de "Tu momento" (0/1/3+ partidos con y sin patrón fuerte), partidos del mes, y normalización de nombre compartida).

---

## 5. Verificación manual realizada

En el panel de navegador (Claude Browser), viewport mobile (375×812) y tablet (768×1024):

1. Header nuevo: el menú abre, muestra Mi pádel/Historial/Modo de registro con el modo actual visible, y "Modo de registro" abre el selector existente sin duplicar su lógica.
2. Primera entrada a "Mi pádel" sin jugador → modal "¿Quién sos?" → nombre guardado → Home renderizado.
3. Home vacío (sin partidos): estados vacíos correctos en Tu momento, Forma reciente, Último partido y los 4 widgets (`—` + microtexto honesto, nunca un número inventado).
4. Carga de un partido real de prueba (vía "+") con el jugador actual entre los 4 nombres → guardado → el Home refleja correctamente resultado, forma reciente, último partido (compañero/rivales/fecha/modo) y los 4 widgets.
5. "Ver detalle" del último partido abre Análisis real, y el botón atrás vuelve al Home del jugador (nuevo branch de navegación).
6. Barra inferior: Inicio/Historial/Ranking/Perfil navegan correctamente y marcan el estado activo; Historial sigue mostrando el historial global sin cambios.
7. Ranking y Perfil: placeholders explícitos, no botones muertos.
8. Campana: abre y cierra el estado vacío de notificaciones.
9. "Cambiar jugador": cancelar no borra nada ni rompe la vista.
10. Barra inferior **no aparece** en `view-setup` ni en `view-match` (partido en vivo se probó completo: arrancar, ver marcador, volver a inicio) — no compite con el control-bar del marcador.
11. Responsive: en tablet (≥720px) los widgets pasan a grilla de 4 columnas y la barra inferior queda centrada con esquinas redondeadas arriba, sin cambios rotos en el resto de la app.
12. Consola revisada: sin errores nuevos. Quedan dos mensajes preexistentes y ya contemplados por el propio código (no introducidos por esta etapa): un warning de Wake Lock (pestaña no visible durante la automatización) y un error de registro del service worker bajo el servidor de desarrollo local — ambos ya manejados con `try/catch`/`.catch()` desde antes, ver limitación §6.

---

## 6. Limitaciones conocidas

- **Identidad por nombre, no cuenta real**: es la deuda deliberada del documento de Etapa 2, no un descuido.
- **Ranking/categoría/tendencia son datos demo**, iguales para cualquier jugador — no hay todavía ningún cálculo real detrás.
- **"VOLVER AL INICIO" de Resumen/Análisis sigue yendo a la pantalla de configurar partido**, no al nuevo Home del jugador, incluso si el partido se cargó desde el "+". Es un botón compartido por los 3 modos de registro y no estaba en el alcance de esta etapa — lo marco como candidato a revisar en una próxima pasada si en el uso real se siente como fricción del loop "cargar partido → ver mi Home actualizado".
- **El "Cancelar"/flecha atrás de "Cargar partido jugado"** tiene el mismo comportamiento: vuelve a `view-setup`, no al Home, aun si se entró por el "+".
- **Sin arnés de tests de DOM**: todo lo que toca `app.js`/pantallas se verificó a mano en el navegador, no hay forma de automatizarlo con el harness actual (mismo límite que ya existía antes de esta etapa).
- El error de consola del service worker aparece bajo el servidor Python de desarrollo local; a confirmar que no aparece en GitHub Pages real (HTTPS), donde ya funcionaba antes de esta etapa.

---

## 7. Pasos para probarlo en el celular

1. Confirmar el push/deploy (todavía no comiteado — a definir con Sebastián si se sube ahora).
2. Abrir BRAMU Lab, tocar el botón del header (dice "MODO COMPLETO ▾" o el modo que esté activo).
3. Tocar **Mi pádel**.
4. Escribir un nombre (puede ser ficticio) y tocar **Continuar**.
5. Ver el Home vacío: identidad, Tu momento, Forma reciente y widgets en estado inicial.
6. Tocar **+** (o "Cargar primer partido" desde la tarjeta de Último partido).
7. Cargar un partido de prueba usando **el mismo nombre elegido** como uno de los 4 jugadores.
8. Guardar, y desde la barra inferior tocar **Inicio**.
9. Confirmar que aparecen el resultado, forma reciente y los 4 widgets ya con datos.
10. Repetir el paso 6-9 un par de veces más (con distintos compañeros/rivales/resultados) para ver cómo cambia "Tu momento", la racha y los widgets a medida que se acumulan partidos.
11. Probar Historial, Ranking y Perfil desde la barra inferior, y "Cambiar jugador".
12. Confirmar que **Empezar partido** (Completo y Por Games) sigue funcionando exactamente igual que antes, sin la barra inferior encima del marcador.

---

## 8. Pantallas resultantes (descripción)

- **Home del jugador**: tarjetas oscuras redondeadas apiladas — identidad con avatar circular de iniciales y badge "DATOS DEMO · BETA"; Tu momento con ícono ✨ y texto narrativo corto; Forma reciente con puntos de color (lima=victoria, rojo=derrota, gris=sin definición); Último partido con resultado, marcador por sets, fecha, compañero/rivales y botón Ver detalle; grilla 2×2 (4×1 en tablet+) de widgets pequeños.
- **Barra inferior**: 5 posiciones sobre superficie oscura con borde superior sutil; el "+" central es un círculo dorado elevado (mismo dorado que "EMPEZAR PARTIDO"); el ítem activo se resalta en verde lima (mismo color de Equipo A/marca).
- **Ranking**: tarjeta centrada única con ícono 🏆, título y texto explicando que el ranking real todavía no está listo.
- **Perfil**: nombre actual, cantidad de partidos cargados, link para cambiar de jugador.
- **Modal "¿Quién sos?"**: mismo estilo que el resto de los overlays de la app (fondo oscuro, título dorado, input con autocompletado, botón dorado "Continuar").

---

*Pendiente de decisión: si se comitea/pushea este cambio ahora o se revisa primero en el celular.*

---

## 9. Corrección posterior: navegación contextual de "Cargar partido jugado"

Ajuste pedido después de la primera entrega: cuando "Cargar partido jugado" se abre desde el Home del jugador (el "+" o "Cargar primer partido"), todo el recorrido de vuelta debe quedar dentro de la Rama Jugador — nunca soltar al usuario en la pantalla tradicional de configurar partido.

**Cambios en `app.js`:**
- `openManualLoadScreen(origin)` ahora recibe de dónde se abrió (`'setup'` o `'player-home'`) y lo guarda en `manualLoadOrigin`. Los tres puntos de entrada pasan el origen correcto: el link tradicional del setup (`'setup'`), y tanto "Cargar primer partido" del Home vacío como el "+" de la barra inferior (`'player-home'`).
- **Cancelar/volver** de la pantalla de carga: si `manualLoadOrigin === 'player-home'`, vuelve al Home del jugador (re-renderizado); si no, mantiene el comportamiento de siempre (vuelve a configurar partido).
- **"VOLVER AL INICIO"** en Resumen (`#summary-new-btn`) y en Análisis (`#analysis-home-btn`): vuelven al Home del jugador **solo** cuando el partido que se está mostrando es, específicamente, el que se acaba de cargar por esa vía (`finishedSnapshot.mode === 'manual'` y, en Análisis, que sea exactamente ese mismo snapshot el que está en pantalla) **y** el origen fue `'player-home'`. Un partido Completo o Por Games nunca puede cumplir `mode === 'manual'`, así que sus regresos quedan exactamente iguales que antes — no se tocó nada de esos dos flujos.
- Volver al Home siempre pasa por `openPlayerHome()`, que vuelve a leer el historial y renderiza de nuevo — el partido recién cargado aparece inmediatamente en Último partido, Forma reciente y los widgets.

**Tests:** vueltos a correr completos — **343/343 OK**, sin cambios respecto a la entrega anterior (esta corrección es de navegación/DOM, no toca ninguna de las funciones puras cubiertas por `tests.html`).

**Verificación manual** (en navegador, mobile 375px) de los 5 casos pedidos, todos correctos:
1. Home vacío → "+" → Cancelar → vuelve al Home del jugador.
2. Home → "+" → cargar y guardar → Resumen → "VOLVER AL INICIO" → Home del jugador, con el partido recién cargado ya visible.
3. Mismo flujo pero pasando por "VER ANÁLISIS" → "VOLVER AL INICIO" desde Análisis → Home del jugador, partido visible.
4. Entrada tradicional (setup → "Cargar partido jugado" → back) → sigue volviendo a configurar partido, sin cambios.
5. Partido en vivo Completo, finalizado → "VOLVER AL INICIO" → sigue yendo a configurar partido, sin cambios.

Sigue sin comitear ni pushear.
