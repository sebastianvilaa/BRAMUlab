# BRAMUlab_V03
## Informe — qué se implementó, verificó y corrigió

**Tipo de documento:** informe retrospectivo (síntesis documental de informes ya cerrados, no una verificación nueva).
**Fecha de esta síntesis:** 10/09/2026.
**Estado actual de la app:** tag `BRAMUlab_V03.4.6`, 828/828 tests. Última ronda cerrada: V03.4.6 (dos correcciones responsive sobre Mis Grupos/Historial/Evolución).
**Cómo leer este documento:** cada sección corresponde a una ronda ya implementada y publicada, en orden cronológico. El detalle completo (archivos tocados, capturas, verificación manual paso a paso) vivía en el informe original de cada ronda (citado por nombre en cada sección) — esos originales ya se borraron del repositorio una vez confirmado que este resumen no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).

---

## 0. Arquitectura vigente (acumulada, no por versión)

Módulos de lógica pura, sin DOM, mismo patrón heredado de V01/V02:

- `engine.js` / `stats.js` — motor del marcador y estadísticas, sin cambios en esta línea.
- `player-home.js` (`window.PH`) — agregaciones del jugador: Home, MI PERFIL, ahora también base de datos para Perfil público y Mis Grupos. Funciones clave acumuladas en V03: `findPlayerRow` (identidad por `userId`, autoritativa y exclusiva — una fila con `userId` estampado SOLO se encuentra por ese `userId`, nunca por nombre, ni siquiera si coincide), `resolveIdentityRef`, `buildCalibrationStatus`, `computeBestWinStreakRange`, `computeLevelChangeLast30Days`, `computePeakLevel`, `computeSimulatedJugadorLevel` (Nivel BRAMU determinístico por hash de nombre para jugadores sin historial contra el usuario actual, reemplazado por el valor real en cuanto exista al menos un partido considerado).
- `player-identity.js` (`window.PLI`, nuevo en V03.0) — validación pura: formato de email, fuerza de contraseña, slugify de `@usuario`, cálculo de edad.
- `match-load.js` (`window.PLMatchLoad` / `ML`) — sumó `buildJugadorDirectory` (universo de jugadores conocidos, nunca incluye al propio usuario), `filterPlayerCandidates`, `computeRecentPlayers` (con el bug de identidad corregido en V03.3.2, ver §19).
- `groups.js` (`window.PLGroups`, nuevo en V03.4) — toda la lógica pura de competencia por grupos: pertenencia temporal por períodos, detección automática de partidos válidos (3 de 4), cálculo de puntos y bonuses, tabla semanal (top 3), Race anual, BRAMU Intelligence grupal, y `assignPositions` (posición "estilo competencia", con empates compartidos — fix de V03.4.1).
- `locations.js` (`window.PLLocations`, nuevo en V03.4.1) — dataset local de ~180 localidades argentinas como fallback, mas `searchLocationsRemote` (V03.4.2) contra la API pública GeoRef como fuente principal.
- `store.js` — persistencia `localStorage`. Claves nuevas de esta línea: `bramulab.users.v1`, `bramulab.session.v1` (V03.0), `bramulab.notifications.v1` (V03.0.2, aislada por `userId`), `bramulab.addedPlayers.v1` (V03.3, aislada por `userId`), `bramulab.groups.v1` (V03.4, **global**, no aislada por usuario — un grupo es una entidad compartida entre varios jugadores, mismo criterio que `HISTORY`). `SCHEMA_VERSION` se mantiene en 3 durante toda la línea; los únicos campos nuevos en el registro `User` son `declaredCategoryAt` (V03.1) y `locality`/`region`/`country`/`rankingLocalZone` (V03.4.1).

**Identidad por `userId` (núcleo de toda la línea, sin cambios desde V03.0):** cada jugador dentro de `match.players[]` puede tener un `userId` opcional. Regla de integridad autoritativa y exclusiva: una fila con `userId` estampado solo se encuentra buscando exactamente por ese `userId`; una fila sin `userId` (partido legacy) sigue resolviendo por nombre normalizado. Esto es lo que permite que renombrar el "Nombre visible" desde Perfil nunca desvincule el historial — y es también la causa raíz de al menos un bug real detectado más tarde (V03.3.2, §19: una función nueva olvidó pasar el `userId` y perdió silenciosamente los partidos "Recientes" de cualquier cuenta creada después de V03.0).

**Sin arnés de test para DOM/`app.js`** en ningún punto de esta línea (mismo límite documentado desde V01) — toda navegación/interacción visual se verifica a mano con el Browser tool (mobile 375×812 + tablet 768px + desktop), nunca en `tests.html`. `tests.html` cubre exclusivamente las funciones puras de los módulos de arriba.

**Cuarteto de versionado, desde V03.1.6:** cada release debe sincronizar 4 lugares — `Store.VERSION`/`APP_VERSION`, `version.json`, `sw.js` (`CACHE_NAME` + `CORE_ASSETS`), y (agregado por el fix de V03.1.6) `?v=X` como query string de cache-busting en cada `<script>`/`<link>` de `index.html` y en las entradas equivalentes de `CORE_ASSETS`. Antes de V03.1.6 eran solo 3 lugares — la caché HTTP nativa del navegador (no la Cache Storage del Service Worker) podía servir una copia vieja de `store.js` sin importar cuántas veces se tocara "ACTUALIZAR", produciendo un loop infinito del cartel de nueva versión en producción real (nunca reproducible contra el dev server local, que manda `no-store` en todo).

---

## 1. V03.0 — Identidad del jugador

**Fuente:** `BRAMUlab_V03.0_Informe.md`. Commit de implementación `10aa507130c3e612a95ee690710eb25468ca96e6`, commit de informe `ed1b214f59ed41b625c4699d02dc55f47aa86fa6`, tag `BRAMUlab_V03.0`. Base: V02.9.3 (commit `56731e4`).

**Auditoría previa, hallazgo central:** no existía ningún id de identidad persistente — un jugador era, en toda la app, un string plano (`currentPlayerName`), y los partidos guardados lo referenciaban por igualdad exacta de nombre normalizado. Ese hallazgo definió el riesgo de toda la ronda. Sebastián pidió, sobre la primera propuesta de plan, 3 correcciones de fondo: identidad estable por `userId` (no solo nombre), Nivel BRAMU sin número simulado para cuentas nuevas, y una cuenta legacy que pueda completar su acceso en vez de quedar atrapada — más una regla de integridad adicional (exclusividad de `userId`), todas incorporadas antes de escribir código.

**Implementado:** modelo `User` completo, `Store.migrateLegacyPlayerToUserIfNeeded()` (corre una sola vez al boot, antes de cualquier otra inicialización, deja la cuenta migrada logueada de inmediato y vincula por `userId` todo el historial existente que coincida por nombre — nunca ambiguo: si dos filas comparten nombre y ninguna tiene `userId` todavía, no se tagea a ninguna), flujo completo de Acceso/Crear cuenta en 3 pasos/Player Card/Login, Perfil extendido con edición vía modal, calibración 0/5→5/5 sin número inventado para cuentas nuevas (gate extendido también a la tarjeta de Evolución de Perfil, por consistencia — diferencia justificada frente al consolidado). Contraseña en texto plano documentado explícitamente como prototipo local, sin criptografía casera.

**Verificación en producción real, no solo simulada:** sobre el dispositivo de desarrollo real (que ya tenía 2 partidos bajo el nombre "Seba"), la migración creó exactamente 1 cuenta `legacyMigrated:true`, sesión activa, y ambos partidos quedaron con `userId` estampado — Home mostró el mismo Nivel BRAMU (5.0) e historial de siempre sin fricción. Tras renombrar "Seba" a "Sebastián Vila" en Editar Perfil, Home e Historial siguieron resolviendo por `userId`, sin cambios — la prueba directa del pedido de identidad estable.

**Tests:** 650/650 (571 baseline de V02.9.3 + 79 nuevos): fuerza de contraseña, slugify de `@usuario`, cálculo de edad, identidad estable por `userId` (incluida rename-safety), estampado sin ambigüedad, calibración, cuentas/sesión con snapshot/restore de `localStorage`.

---

## 2. V03.0.1 — Refinamiento UX de Perfil, Acceso y sesión

**Fuente:** `BRAMUlab_V03.0.1_Informe.md`. Commit `c499103eb8d76219388b0386e91820d9fcd52fb0`, tag `BRAMUlab_V03.0.1`.

**Auditoría previa, 3 hallazgos que definieron el plan:** (1) Historial/Ranking/Perfil no estaban gateados por sesión — tras `doLogout()` la app volvía a `showView('setup')`, que SÍ está en `BOTTOM_NAV_VIEWS`, así que la barra inferior reaparecía y esas pantallas quedaban alcanzables; (2) riesgo real (no hipotético) de que un partido de invitado con nombre coincidente terminara en el historial de una cuenta real, por la regla de fallback a nombre de `findPlayerRow`; (3) Home nunca leía `profilePhoto` — el avatar era un SVG hardcodeado sin ningún `<img>`.

**Corrección del usuario sobre el plan inicial:** el ocultamiento de navegación sin sesión debía ser visual y principal (ocultar la barra inferior completa), no solo un gate interno por click — los gates internos se mantuvieron como protección adicional.

**Implementado:** Perfil en dos pestañas MI PERFIL/MIS DATOS; Editar Datos y Completar Acceso pasan de modal a pantalla completa; foto en el Home (`renderPlayerCard` lee `Store.getCurrentUser().profilePhoto`); Cambiar contraseña nuevo; Cerrar sesión reubicado; `showView(name)` calcula la visibilidad de `#bottom-nav` con `BOTTOM_NAV_VIEWS.indexOf(name) !== -1 && !!Store.getCurrentUser()` usando una lectura FRESCA de `Store` (nunca la variable de módulo cacheada, que quedaba en `null` tras un cold boot que resumía un partido activo); **partido de invitado: si no hay sesión activa, el partido no se persiste en absoluto** — el invitado ve el Resumen desde el snapshot en memoria, pero no sobrevive a un recierre de la app (la solución "más simple y segura" que pedía el consolidado si evitaba una vinculación falsa).

**Verificado en vivo, extremo a extremo:** partido completo jugado como invitado, Resumen visto con la barra inferior oculta durante todo el recorrido, y confirmado por `localStorage` que `bramulab.history.v1` conservó exactamente las mismas 2 entradas de antes — el partido de invitado nunca se escribió.

**Tests:** 661/661 (650 + 11) — capa `Store` únicamente (cambio de contraseña, `logoutSession` no toca `USERS`, precondición del gate de invitado). Navegación/UI sin test automatizado (mismo límite de siempre) — cubierto por checklist manual A-N, las 14 verificadas en vivo.

---

## 3. V03.0.2 — Sistema visual transversal, Perfil y Notificaciones

**Fuente:** `BRAMUlab_V03.0.2_Informe.md`. Commit `b5198858536cb94da37cf834e6bd1d5b0274783d`, tag `BRAMUlab_V03.0.2`.

**Auditoría previa, 3 hallazgos:** (1) dos sistemas de header distintos conviviendo (`.analysis-header` vs. `.access-back`+`.access-title`, con paddings y jerarquías tipográficas distintas — la causa técnica exacta reportada); (2) bug de avatar real: V03.0.1 agregó el `<img>` de la foto pero nunca ocultaba el `<svg>` genérico con `hidden` — ambos quedaban en el DOM; (3) las 4 pantallas raíz (Home/Historial/Ranking/Perfil) tenían flecha "volver" redundante con la bottom nav.

**Implementado:** header único (`.analysis-header` toma el padding exacto de `.player-home-header`); pantallas raíz pierden la flecha (Historial la conserva condicionalmente en su segundo punto de entrada real); familia de autenticación migrada al mismo header; `BOTTOM_NAV_VIEWS` suma `edit-data`/`complete-access`/`change-password`/`notifications`; avatar del Home con `hidden` explícito en ambas capas; gráfico de Evolución con eje Y de 3 líneas con valor numérico y eje X con fechas reales/formato adaptativo, `viewBox` de ancho virtual fijo (320) en vez de crecer 56px por punto (elimina el scroll horizontal que tenía antes); Notificaciones como pantalla completa nueva con modelo local (`bramulab.notifications.v1`, `userId` obligatorio) y eventos generados solo sobre acciones reales (perfil actualizado, acceso completado, contraseña actualizada, partido guardado —solo con sesión—, perfil incompleto con deduplicación por `dedupeKey`, cambio real de Nivel BRAMU solo para cuentas legacy).

**Verificado en vivo:** guardar datos + completar acceso generaron 2 notificaciones reales, badge mostró "2", "Marcar todas como leídas" lo llevó a 0. Verificación adicional no pedida: se confirmó por `getBoundingClientRect()` que el botón GUARDAR de Editar Datos/Cambiar contraseña quedaba con 29px de margen respecto a la barra inferior ahora visible (evitando que la tapara).

**Tests:** 677/677 (661 + 16) — Notificaciones separadas por `userId`, orden cronológico, unread/read, deduplicación, logout/login no mezcla notificaciones entre cuentas.

---

## 4. V03.0.3 — Perfil deportivo, acceso público y correcciones visuales

**Fuente:** `BRAMUlab_V03.0.3_Informe.md`. Commit `bb673f741b4e31daa5900b011d393787b0e85414`, tag `BRAMUlab_V03.0.3`.

**Auditoría previa, 3 hallazgos:** (1) el bug del avatar del Home era real, no solo percibido: V03.0.2 ya intentaba ocultar el ícono genérico con `hidden` en dos escrituras separadas de `renderPlayerCard`, sin garantía estructural de quedar sincronizadas entre sí; (2) sesgo real en la escala Y del gráfico de Evolución: `buildLevelEvolutionSvgHTML` incluía `evolution.base` (el 5.0 fijo de arranque) en el cálculo de mínimo/máximo, así que un jugador que nunca volvió a 5.0 igual veía la escala arrastrada hasta ahí; (3) **bug encontrado DURANTE esta misma ronda** (no reportado por el consolidado, no podía estarlo): las tabs nuevas de "Registrar partido sin cuenta" usaban `data-mode` en el HTML, pero `wireOptionGroup` (el helper compartido de la app) siempre lee `data-value` — el tab se veía seleccionado pero el modo guardado en `Store` no cambiaba.

**Fix del avatar (definitivo):** de dos escrituras `hidden` independientes a un solo interruptor — `#player-home-avatar` recibe `data-has-photo="true"/"false"` y es CSS quien decide qué capa se pinta (`.player-card__avatar[data-has-photo="true"] .player-card__avatar-icon{display:none}` etc.) — nunca más dos escrituras que puedan desincronizarse. Verificado con `getComputedStyle` (no solo el atributo) en los 6 casos del consolidado.

**MI PERFIL — ficha deportiva:** cabecera reusando `.player-card__level*` sin copiar pixel a pixel; foto editable con affordance chico (badge circular cámara) en MI PERFIL y MIS DATOS, reusando `downscaleImageFileToDataUrl`; datos declarados + rendimiento en grilla compacta de 2 columnas, incluida "Mejor racha" (función `PH.computeBestWinStreak` ya existente, nunca antes expuesta en Perfil) y "Mejor Nivel BRAMU histórico" (`Math.max` sobre la misma serie del gráfico, oculto si no hay partidos considerados).

**Gráfico:** rango sale únicamente de `evolution.points[].level` (nunca del `base`), margen del 20% del span real, redondeo a paso legible (`niceLevelAxisStep`: 0.1/0.2/0.5/1/2/5), máximo 5 marcas. Ejemplo real verificado: serie 4.9-5.1 mostró 4.8/5.0/5.2 en vez de arrastrar hasta 5.0.

**Flechas restauradas:** Ranking/Perfil vuelven a Home siempre; Historial mantiene su comportamiento contextual (`historyOpenedFrom`), ahora siempre visible en vez de ocultarse en el caso "sin origen especial".

**Tabs de modo del invitado:** reemplaza el selector escondido 2 niveles adentro de un menú por 2 tabs siempre visibles antes de Equipo A/B — con el bug `data-mode`/`data-value` corregido antes de publicar, reverificado en ambas direcciones leyendo el valor real de `localStorage`.

**Tests:** 682/682 (677 + 5) — foto editable desde dos pantallas terminando en el mismo dato, "quitar foto" limpia a `null`, mismo `userId` conservado.

---

## 5. V03.0.3.1 — Recuperación simulada de contraseña + ajustes menores

**Fuente:** `BRAMUlab_V03.0.3.1_Informe.md`. Commit `2e7852ff079aa5f661a594b2b19e821253e82ebb`, tag `BRAMUlab_V03.0.3.1`.

**Implementado:** wizard de 3 pasos en una sola vista (`#view-forgot-password`), código fijo `FORGOT_PASSWORD_CODE = '123456'`, `Store.updateUserAccount(user.id, {password: next})` como ÚNICA escritura de todo el flujo (nunca `createUserAccount`, imposible que termine creando una cuenta nueva por error). Verificado que ningún texto "Simulado"/"Demo"/"Código de prueba" aparece en la UI (leído el texto visible completo de cada paso) — la simulación vive solo en la constante y en comentarios técnicos. `renderProfileEvolution` deja de escribir texto/clase de color en `#mi-perfil-level-delta` (queda oculto por CSS) — el cálculo subyacente (`change`/`change.direction`) sigue usándose sin cambios en la tarjeta de Evolución y en la Tarjeta del Home. "Quitar foto" retirado solo de MI PERFIL y MIS DATOS (Editar Datos conserva el suyo — el consolidado nombra explícitamente solo esos dos). Badge de Evolución pasa de "SIMULADO · BETA" a "BETA" (único lugar de la UI que mostraba la palabra).

**Tests:** 693/693 (nuevo bloque `V03031-RECUPERAR`, 10 casos descritos aunque el propio informe original suma "11 nuevos" en el total — discrepancia menor de conteo en el documento original, no resuelta ahí, sin impacto real: el total 693/693 y el detalle funcional de cada caso son consistentes). **Bug de higiene de tests detectado y corregido en la misma ronda:** `Store.signUpAndLogin` también escribe `bramulab.currentPlayerName.v1`/`bramulab.playerNames.v1`, dos claves que el bloque nuevo (y el heredado `V0303-AVATAR`) no tenían protegidas en su `AFFECTED_KEYS` — nombres de prueba quedaban filtrados en el dispositivo real tras correr la suite. Corregido y reverificado corriendo la suite dos veces seguidas.

---

## 6. V03.0.3.2 — Recuperación desde sesión + tabs de modo

**Fuente:** `BRAMUlab_V03.0.3.2_Informe.md`. Commit `7c10cc6217d1550309cc79efe7b140cbec493b4e`, tag `BRAMUlab_V03.0.3.2`.

**Implementado:** `openForgotPasswordFromSession()` toma la cuenta de `Store.getCurrentUser()` (nunca `getUserByEmail`, nunca pide email) y arranca el MISMO wizard de recuperación directo en el Paso 2 (código) vía `resetForgotPasswordWizard(2)` — reutiliza toda la lógica de validación existente en vez de duplicarla en un segundo lugar. `forgotPasswordOrigin` (`'login'` vs `'session'`) determina el piso del botón atrás y el destino final (MIS DATOS sin desloguear, vs. Login con email precompletado como antes). Tabs de modo: se retira la clase `option-row` del contenedor (deja de heredar el layout de grilla de tarjeta) y se aplica CSS scoped a `#setup-mode-tabs .option-col` con el mismo tratamiento que `.profile-tab` (subrayado lima, sin fondo) — mismo `wireOptionGroup`/`Store.saveRecordingMode` de siempre, verificado leyendo el valor real de `localStorage`.

**Tests:** 705/705 (693 + 12) — bloque `V0332-SESION` protegiendo desde el inicio las claves que se habían fugado en la ronda anterior.

---

## 7. V03.1 — Rediseño de MI PERFIL + compactación de MIS DATOS

**Fuente:** `BRAMUlab_V03.1_Informe.md`. Commit `3a3dc89bceb777f6d224375048c3f00b20e8109d`, tag `BRAMUlab_V03.1`.

**Auditoría previa:** el componente donut de Efectividad ya existía en el Home, reusable tal cual; la cuenta no tenía ningún campo de fecha para categoría (se agregó `declaredCategoryAt`, única extensión de esquema de esta ronda); `requestLogout` cerraba sesión con un solo toque para cuentas con acceso completo, sin confirmación.

**Implementado:** cabecera de MI PERFIL con Edad/Mano/Lado dentro de la misma tarjeta (`.pastilla-identity__meta`, nueva fila con línea separadora), bloque "DATOS DECLARADOS" eliminado, categoría retirada de MI PERFIL (queda solo en MIS DATOS con fecha — `declaredCategoryAt` se reestampa solo si el valor cambia, nunca al guardar sin tocar el campo); Rendimiento en dos niveles (Efectividad hero con donut agrandado + Partidos jugados/ganados apilados; fila secundaria Racha actual/Mejor racha); nueva `PH.computeBestWinStreakRange` (rango temporal de la mejor racha, con criterio determinístico documentado ante empate: se queda con la racha cronológicamente primera); Racha actual muestra `—` en vez de "Sin racha en curso" ante ausencia de racha positiva (nunca menciona derrotas); nueva `PH.computeLevelChangeLast30Days`; gráfico sin puntos ni tooltips (se retiran círculos, animación de pulso y detalle al tocar); eje Y en pasos fijos de 0,25 (`computeLevelYAxis`, rango mínimo 1,25); eje X con formato dependiente del rango real (≤14 días día+mes, 15-45 días "SEM N", 46-200 día+mes, >200 solo mes); MIS DATOS compactado (`.profile-identity-compact`, de ~9 líneas a 3); Cambiar contraseña con `min-height:48px` (antes bastante por debajo del mínimo táctil); Cerrar sesión separado en su propia tarjeta + modal de confirmación nuevo (`#logout-confirm-modal`) para cuentas con acceso completo — el modal de advertencia fuerte para cuentas sin email se mantiene con prioridad.

**Tests:** 716/716 (705 + 11) — `computeLevelChangeLast30Days` y `computeBestWinStreakRange` (funciones puras nuevas, sin `AFFECTED_KEYS`).

---

## 8. V03.1.1 — Pulido de MI PERFIL + simplificación de MIS DATOS

**Fuente:** `BRAMUlab_V03.1.1_Informe.md`. Commit `bab6c3e4b9d54dc9a9cdeb16fd568e46c029a2ba`, tag `BRAMUlab_V03.1.1`.

**Bug real confirmado con medición:** a 320px de ancho, "Mano dominante" envolvía a 2 líneas mientras "Edad"/"Lado habitual" quedaban en 1 — los 3 valores arrancaban en `top` distintos porque el label más corto no reservaba el mismo alto que uno que envuelve. Fix: `min-height:26px` en el label (alto de 2 líneas), aplica automáticamente también a la fila equivalente de MIS DATOS.

**Implementado:** Rendimiento pasa de un solo `.pastilla` con divisores internos a 5 `.pastilla` separadas en 2 filas; eje X pierde la banda "SEM N" (15-45 días) — queda en 2 bandas simples (≤200 días fecha real, >200 solo mes) con deduplicación de etiquetas consecutivas repetidas (excepto extremos); MIS DATOS pierde los títulos "TUS DATOS"/"IDENTIDAD", lápiz de edición movido dentro de la tarjeta de identidad (esquina superior derecha).

**Bug encontrado durante el QA de esta misma ronda:** con nombre/apellido largo, el texto corría por debajo del lápiz recién movido — corregido reservando su ancho (`padding-right:40px`).

**Tests:** 716/716, sin tests nuevos (ronda puramente visual/markup — `formatLevelAxisLabel` es UI, fuera del alcance de `tests.html`).

---

## 9. V03.1.2 — Microparche de composición en Perfil

**Fuente:** `BRAMUlab_V03.1.2_Informe.md` (consolidado pegado en el chat). Commit `89814ca46362d7baf715cd0be2f359a1bf789b8e`, tag `BRAMUlab_V03.1.2`.

**Bug real de espaciado confirmado con medición, no a ojo:** `.pastilla` trae `margin-bottom:12px` de base, y `.profile-panel{gap:14px}` NO hace colapsar ese margin con su propio `gap` — se sumaban. Medido: 26px entre bloques donde debía haber uno solo de ritmo. Fix de raíz único: `.profile-panel > .pastilla{margin-bottom:0}` (y el equivalente dentro del bloque de Rendimiento) — el `gap` pasa a ser la única fuente de espaciado. Resultado medido: de 26px a 14px en ambos casos.

**Implementado:** Efectividad + Partidos jugados + Partidos ganados fusionados en una sola `.pastilla` (donut a la izquierda, números de Partidos en 24px, antes 15px — reusando el tamaño ya establecido para "número protagonista de tarjeta chica" del Home). Racha actual/Mejor racha sin cambios.

**Tests:** 716/716, sin tests nuevos.

---

## 10. V03.1.3 — Microparche final de MI PERFIL

**Fuente:** `BRAMUlab_V03.1.3_Informe.md` (consolidado pegado en el chat). Commit `62359325ca29e18729b7bf09ba8843e0c8fba507`, tag `BRAMUlab_V03.1.3`.

**Implementado:** nueva `PH.computePeakLevel(evolution)` — pico histórico de la misma serie del gráfico (nunca compara contra otros usuarios), `{value, isCurrent, date}`; UI muestra "Mejor nivel BRAMU" con `ACT` si coincide con el actual, o mes+año del ÚLTIMO partido que alcanzó ese pico (ante empates de nivel, el más reciente). Vive asociado al bloque de Rendimiento, no dentro de la tarjeta de Efectividad (para no competir por el espacio que esa misma ronda libera ahí). Tarjeta de Efectividad: label sube a título real, donut de 96px a 128px, Partidos de 24px a 26px. Animación de entrada en el gráfico (`animateEvolutionLine`, mismo mecanismo Web Animations API que ya usa el donut de Efectividad, misma duración/curva — `stroke-dasharray`/`stroke-dashoffset` vía `path.getTotalLength()`), respeta `prefers-reduced-motion`.

**Tests:** 722/722 (716 + 6) — `PH.computePeakLevel`: sin partidos, ascenso continuo, subió-y-bajó (fecha del pico, no del último partido), empate resuelto por fecha más reciente.

---

## 11. V03.1.4 — Ajuste de composición en Evolución + ritmo vertical de Perfil

**Fuente:** `BRAMUlab_V03.1.4_Informe.md` (feedback de usuario transcripto). Commit `8ec715063f8270f7248d157227b29544559e26a3`, tag `BRAMUlab_V03.1.4`.

**Auditoría previa con medición:** espaciado real en MI PERFIL era 14px entre identidad y Rendimiento pero 10px entre Efectividad y la fila Racha/Mejor racha — dos ritmos distintos en la misma pantalla. El Home (tomado como referencia) usa siempre `margin-bottom:12px`, un tercer valor.

**Implementado:** "Mejor nivel BRAMU" se elimina como tarjeta propia (`#mi-perfil-peak-card`) y se muda dentro de `.evolution-summary` como tercer ítem, anclado a la derecha (`flex:0 0 auto; margin-left:auto`) mientras Nivel actual/Cambio siguen a la izquierda — al vivir dentro de `#evolution-numeric` queda gateado gratis por el mismo `hidden` de calibración. `.profile-panel{gap:14px}`→`12px`, `.profile-performance{gap:10px}`→`12px` — un solo ritmo, igual al de Home. Donut de Efectividad: 128px→112px.

**Tests:** 722/722, sin tests nuevos (`PH.computePeakLevel` sin cambios, solo cambia dónde se pinta).

---

## 12. V03.1.5 — Corrección de línea en la tarjeta de Evolución

**Fuente:** `BRAMUlab_V03.1.5_Informe.md` (feedback de usuario transcripto). Commit `52589c1f3770d2cef167b033fa4657eb8d6cfa2a`, tag `BRAMUlab_V03.1.5`.

**Diagnóstico:** `.evolution-summary` tenía `flex-wrap:wrap`, regla heredada de V03.0.3 cuando la fila mostraba 4 valores (razón que ya no existía desde V03.1, que la simplificó a 2, y V03.1.4 agregó un tercero sin revisar si el `wrap` seguía haciendo falta). Confirmado con `getBoundingClientRect()` a 375px y 320px: el tercer ítem caía a una fila aparte.

**Fix:** `flex-wrap:nowrap` — los 3 ítems quedan forzados a una fila siempre; si el ancho aprieta, ceden los labels de Nivel actual/Cambio (`flex:1 1 38%`, envolviendo su propio texto), nunca la fila entera. "Mejor nivel BRAMU" (`flex:0 0 auto`) nunca se achica.

**Tests:** 722/722, sin tests nuevos (corrección CSS pura). Sin diferencias respecto del pedido — fix exacto, sin decisiones de diseño adicionales.

---

## 13. V03.1.6 — Corrección de loop infinito de actualización

**Fuente:** `BRAMUlab_V03.1.6_Informe.md` (reporte de bug transcripto). Commit `ff8056173fc2996a416f6870e31ead29d0a4f21a`, tag `BRAMUlab_V03.1.6`.

**Diagnóstico:** `forceUpdateApp()` desregistra el Service Worker, borra toda la Cache Storage y recarga con `?_fu=timestamp` — completo en apariencia, pero **Cache Storage no es la única caché del navegador**. Los `<script src="store.js">` de `index.html` no llevaban query string propio, así que podían resolverse desde la caché HTTP nativa del navegador (bajo control exclusivo de las cabeceras `Cache-Control` del servidor, que `caches.delete()` jamás toca). El `?_fu=...` solo forzaba a repedir el DOCUMENTO — que seguía apuntando a `store.js` sin query, permitiendo servir la copia vieja sin ni siquiera consultar la red. Resultado: `Store.VERSION` seguía siendo el anterior, el cartel volvía a aparecer indefinidamente.

**Por qué nunca se vio en 15 rondas de QA previas:** todo el QA de la serie corrió contra el dev server local, que manda `Cache-Control: no-store` en todo — ahí este bug es estructuralmente imposible de reproducir. Solo existe contra GitHub Pages, con cabeceras de caché normales real. Un punto ciego real del método de QA, no una falla de atención puntual.

**Fix:** `?v=03.1.6` agregado a los 7 `<script>` + `<link>` de `index.html` y a las entradas equivalentes de `CORE_ASSETS` en `sw.js` (deben coincidir exactamente entre ambos archivos — es parte de la clave de `caches.match()`). Este valor pasa a ser el **cuarto lugar** a sincronizar en cada release (ver §0). Corrección adicional encontrada de paso: `forceUpdateApp()` solo deshabilitaba el botón de HERRAMIENTAS DE DESARROLLO, nunca el botón público real `#update-now-btn` que el usuario efectivamente toca — ahora deshabilita cualquiera de los dos que exista.

**Tests:** 722/722, sin tests nuevos — bug de infraestructura de caché HTTP no reproducible en `tests.html`/dev server local (la misma razón por la que pasó desapercibido). Validado por revisión de código: una URL con query nunca vista no puede ser cache hit, sin importar las cabeceras del servidor.

---

## 14. V03.2 — Sistema visual transversal: acceso, botones, modales y navegación

**Fuente:** `BRAMUlab_V03.2_Informe.md`. Commit `8c1541959480df2892638c239bbb62c7b4a615cd`, tag `BRAMUlab_V03.2`.

**Auditoría realizada:** familia de acceso completa, ~15 modales de confirmación, árbol de clases `.btn-*`, lógica de `showView()`/`BOTTOM_NAV_VIEWS`.

**Bugs reales encontrados (no solo inconsistencias estéticas):**
1. Splash con degradé de **verdes oscuros** heredados, incoherente con el azul noche adoptado desde V02 — reemplazado por tokens reales de superficie.
2. `favicon-64.png` **corrupto** (chunk `IDAT` truncado) — algunos decodificadores tolerantes (macOS `sips`) lo abrían igual, Pillow y potencialmente algunos navegadores no. Regenerado.
3. La función que arma la imagen de "Compartir resultado" tenía una **paleta CSS completamente congelada desde antes de la migración de tokens de V02.5/V02.6** — verde-negro heredado y colores de equipo viejos (`#C8FF3D`/`#33A6FF`). La imagen compartida a redes sociales mostraba una marca distinta a la app real. Corregida a los valores actuales de `:root`.
4. `.access-logo` con `width:92px;height:92px;object-fit:contain` sobre un wordmark ancho (915×139) — con esa caja cuadrada, el alto renderizado real terminaba en ~14px, más chico que el logo del header (24px), **violando directamente lo que pedía el consolidado** pese a que el comentario del código decía lo contrario. Reemplazado por ancho fijo + alto automático.
5. Los 7 botones "avanzar/guardar" de la familia de acceso usaban `.btn-secondary.btn-save` (familia secundaria neutra, gris) — **contradiciendo la propia definición del sistema de botones que esta misma ronda define** (avanzar/guardar = primario lima). Corregidos a `.btn-start.btn-save`.
6. Crear cuenta pasos 1-2 usaban inputs solo con placeholder mientras el resto de la familia ya usaba labels persistentes desde V03.0.1 — inconsistencia real dentro de la misma familia.
7. El FAB "+" de la barra, al activarse, quedaba lima sobre fondo lima (invisible) por especificidad de CSS — corregido con una regla específica para el FAB activo.

**Implementado:** 4 familias de botones por uso (primario lima `.btn-start`, funcional azul `.btn-secondary--accent` nueva, neutro gris `.btn-secondary`, destructivo rojo `.btn-secondary--danger`), `text-transform:uppercase` normalizado; `confirmAction()` gana un 7º parámetro `danger` para modales ("Salir sin guardar"/"Eliminar partido" pasan a texto exacto rojo); `BOTTOM_NAV_VIEWS` suma `manual-load`/`match-saved` con nueva variable `--bottomnav-h` (alto real medido, nunca adivinado) para que el teclado numérico y la barra CONTINUAR no queden tapados.

**Tests:** 722/722, sin tests nuevos (todo CSS/clases/posicionamiento).

---

## 15. V03.2.1 — Corrección visual de acceso, botones y carga manual

**Fuente:** `BRAMUlab_V03.2.1_Informe.md`. Commit `fb9ca217a6a467a16d62727bed2afd866134258b`, tag `BRAMUlab_V03.2.1`.

**Implementado:** especificación única final de botones (`.btn-start`/`.btn-secondary`: Inter 14px/700/tracking 0.05em/uppercase, `min-height:48px`, `padding:0 18px`, `border-radius:14px` — las 4 variantes de color intactas). Efecto deliberado: esto redimensiona TODA la app de una sola vez (EMPEZAR PARTIDO, LISTO, botones de partido en vivo) — el consolidado lo pedía explícitamente ("no debe existir un botón especial solo porque vive en otra pantalla"). Splash: logo subido con `padding-top:26vh` (nunca `%` en padding vertical, que se resuelve contra el ancho, no el alto) tras QA mostrar que el centrado matemático se leía "demasiado bajo". "BIENVENIDO A BRAMU" retirado; "REGISTRAR PARTIDO SIN CUENTA"→"REGISTRAR PARTIDO COMO INVITADO"; logo agregado a Login/Crear cuenta/toda la familia; "CREAR ACCESO"→"CREAR CUENTA"; chevrons retirados del bottom sheet "Registrar partido"; header de Carga manual estático "CARGAR PARTIDO"; bloque de resultado agrandado (números 52px→60px) y "Resultado válido" movido al flujo normal del scroll (deliberadamente NO dentro de la tarjeta de resultado, porque esa tarjeta se oculta al decidir el partido — justo cuando el hint debe mostrarse, lección heredada de V02.3); "ELIMINAR PARTIDO" vuelve a acción textual sin fondo.

**Tests:** 722/722, sin tests nuevos.

---

## 16. V03.2.2 — Microparche visual sobre V03.2.1 (acceso + confirmar partido)

**Fuente:** `BRAMUlab_V03.2.2_Informe.md` (pedido en chat, sin consolidado formal previo). Commit `a86c572ef70480755324e22e9b5b5830faf46a9d`, tag `BRAMUlab_V03.2.2`.

**Bug real de alineación:** `.court-header--saved` (Confirmar partido) usaba `justify-content:center`, centrando el PAR flecha+título como grupo — la flecha quedaba flotando junto al título en vez de pegada al borde izquierdo, única pantalla de la app con ese defecto. Corregido con el mismo mecanismo de `.bottom-sheet__title` (posición absoluta, centrado respecto al header completo). También: `.court-header__status--saved` era el único título de header de toda la app en color lima — corregido a blanco/`--paper` como el resto. Ancho de tarjeta fecha/hora vs. botón GUARDAR PARTIDO: **verificado con `getBoundingClientRect()` que ya medían exactamente el mismo ancho (339px)** — no se aplicó ningún cambio ahí por no encontrarse una diferencia real.

**Tests:** 722/722, sin tests nuevos.

---

## 17. V03.3 — Perfil público, búsqueda y sistema de jugadores

**Fuente:** `BRAMUlab_V03.3_Informe.md`. Commit `796f97f5e5c11073460e1fc66f6017d3f3318667`, tag `BRAMUlab_V03.3`.

**Implementado:** `#view-player-public` (perfil público de solo lectura, reutiliza `.pastilla--identity` de MI PERFIL, nunca email/fecha de nacimiento/género/categoría/datos de acceso); `#view-player-search` (Buscar Jugadores, `ML.buildJugadorDirectory` — universo completo sin el propio jugador); `buildPlayerRowHTML(name, level)` como ÚNICO punto de armado de fila de jugador, reutilizado en Buscar Jugadores, Elegir compañero/rival, y la nueva tab JUGADORES de Perfil; `bramulab.addedPlayers.v1` aislado por `userId` (mismo criterio que Notificaciones); nueva `PH.computeSimulatedJugadorLevel` — usa el valor real de `computeLevelEvolution` en cuanto hay al menos un partido considerado contra el usuario actual, y solo si nunca jugaron entre sí cae a un hash determinístico del nombre (rango 3.0-7.5) para que la fila nunca muestre "—" ni cambie entre renders.

**Adaptación documentada respecto del consolidado:** las tarjetas Mejor compañero/Rival más enfrentado del Home **siguen** abriendo la lista completa (comportamiento desde V02.1) en vez de ir directo a un perfil — redirigirlas hubiera dejado esa lista inalcanzable, una regresión no pedida. En cambio, cada FILA de esa lista ahora abre su perfil público — cumple la letra del pedido sin remover el acceso existente.

**Verificado en vivo con datos reales:** perfil público de un jugador tras perder su primer partido mostró Nivel BRAMU 4.8 (real, derivado igual que el propio — base 5.0 menos 0.2 por la derrota), Efectividad 0%, coherentes entre sí.

**Tests:** 739/739 (722 + 17) — `computeSimulatedJugadorLevel` (determinístico, usa el valor real en cuanto existe), `buildJugadorDirectory` (nunca incluye al propio jugador, sin duplicados), jugadores agregados (aislamiento por `userId`, idempotencia, comparación normalizada).

---

## 18. V03.3.1 — Microparche sobre V03.3 (Perfil público / Jugadores)

**Fuente:** `BRAMUlab_V03.3.1_Informe.md` (pegado en el chat). Commit `991fc13873a68be838e721a7d8369cabfd4a0c8c`, tag `BRAMUlab_V03.3.1`.

**Implementado:** `.player-row{border-radius:12px→0}` (separadores rectos en los 4 usos del componente); header del perfil público fijo "PERFIL DE JUGADOR"; `showToast` gana un 3º parámetro `variant` opcional; botón alterna entre `.btn-start` (AGREGAR JUGADOR) y `.analysis-delete-btn` (ELIMINAR DE JUGADORES, misma clase que "Eliminar partido" en Resumen — texto rojo sin fondo); nuevo toast rojo `.toast.is-danger`. Sin confirmación al eliminar (acción reversible de bajo riesgo, distinta de "Eliminar partido").

**Tests:** 739/739, sin tests nuevos (ningún cambio toca lógica pura — microparche 100% visual/UX/copy).

---

## 19. V03.3.2 — Microparche sobre V03.3.1 (Recientes/Todos + bug real corregido)

**Fuente:** `BRAMUlab_V03.3.2_Informe.md` (pegado en el chat). Commit `a6870ca246db599b44fd5006b559d965d20affba`, tag `BRAMUlab_V03.3.2`.

**Bug real serio encontrado al implementar el pedido de copy** (el título "Recientes" en sí no era el problema — al querer mostrar contenido real bajo ese título, se descubrió que la sección **nunca mostraba nada, en ninguna de las dos pantallas, desde V03.0** para cualquier cuenta creada después de esa versión): `ML.computeRecentPlayers(history, playerName, excludeNames)` recibía el nombre del jugador actual como **string plano** y lo pasaba tal cual a `PH.filterMatchesForPlayer` — por la regla de exclusividad de `userId` (V03.0: una fila con `userId` estampado SOLO se encuentra por ese `userId`, nunca por nombre aunque coincida), esa búsqueda nunca encontraba los propios partidos de ninguna cuenta post-V03.0. La sección de abajo, al mostrar "todos sin excluir a nadie", se veía visualmente correcta como "la lista completa" — el bug quedó invisible durante 3 días de desarrollo (07/09 a 10/09) hasta que agregar los títulos lo expuso.

**Fix:** `computeRecentPlayers` ahora resuelve el nombre propio con `PH.resolveIdentityRef(playerRef).name` para la exclusión, y pasa `playerRef` intacto (string o `{name, userId}`) a `filterMatchesForPlayer`. Los 2 call sites en `app.js` pasan `currentIdentity()` en vez del string plano.

**Tests:** 743/743 (739 + 4) — reproduce el bug original con nombre plano, confirma el fix con `{name, userId}`, confirma que un `userId` incorrecto no "reclama" partidos de otra cuenta, confirma que una cuenta legacy sin `userId` sigue funcionando exactamente igual (cero regresión).

---

## 20. V03.3.3 — Microparche sobre V03.3.2 (buscador dentro de JUGADORES)

**Fuente:** `BRAMUlab_V03.3.3_Informe.md` (pegado en el chat). Commit `093925975902793de36e4140bc9d9fac52715340`, tag `BRAMUlab_V03.3.3`.

**Implementado:** campo de búsqueda en la pestaña JUGADORES, reutilizando `ML.filterPlayerCandidates` (la misma función pura ya usada por Buscar Jugadores) aplicada al pool de agregados, no al directorio completo — distinción de alcance confirmada con el usuario antes de implementar. Solo aparece si hay ≥1 jugador agregado; nuevo estado "Sin coincidencias." distinto del estado de lista vacía.

**QA con escala real:** simulados 100 jugadores agregados vía consola para probar el escenario que motivó el pedido ("si tengo cien jugadores").

**Tests:** 743/743, sin cambios (reutiliza una función ya probada).

---

## 21. V03.4 — Mis grupos

**Fuente:** `BRAMUlab_V03.4_Informe.md`. Tag `BRAMUlab_V03.4`.

**Modelo:** nuevo `groups.js` (`window.PLGroups`), toda la lógica pura de competencia grupal, `app.js` solo orquesta DOM. `group = {id, name, createdAt, createdBy, members:[{name, userId|null, isAdmin, periods:[{joinedAt, leftAt|null}]}]}`. Persistencia global (no aislada por `userId`) en `bramulab.groups.v1`.

**Desviación deliberada del modelo mínimo pedido:** el consolidado pedía un único par `joinedAt`/`leftAt` por miembro; se implementó como array de `periods[]` porque un único par rompía la propia regla de éxito §22 del consolidado ("los históricos no se reescriben al agregar/quitar miembros") en el caso de un reingreso — sin períodos, volver a entrar pisaría el `joinedAt` original y excluiría del cálculo los partidos que sí contaron durante la primera etapa.

**Implementado:** `doesMatchCountForGroup` (partido válido + al menos 3 de 4 jugadores miembros activos en la fecha real, automático, sin selector, puede contar para varios grupos a la vez); puntos (base 5/0, sorpresa de nivel calculada "antes del partido" recortando el historial a fecha anterior real, remontada comparando el score real del Set 1 — nunca un campo `winner` opcional que podría faltar, victoria clara — exclusión estructural de remontada/clara, nunca un chequeo aparte, ya que ganar 2-0 implica no haber perdido el Set 1); `computeWeeklyTable` (top 3 de la semana, `PH.startOfWeekMonday` reusada de Actividad del Home desde V02.7 — nunca una segunda noción de semana); `computeRaceAnual`; `buildGroupIntelligence` (6 candidatas puras probadas en orden de prioridad, primeras 2-3 con algo real que decir); admins con guardrail compartido (`activeAdminCountExcluding`, bloquea dejar el grupo sin ningún admin).

**4 bugs reales encontrados y corregidos en QA (no en el consolidado):**
1. Wrap roto en la fila de tabla (`display:block` faltante en 2 clases).
2. Botón "GUARDAR NOMBRE" de 216px de alto en Configuración — `.btn-secondary{flex:1}` creciendo sin freno dentro de un padre `flex-column` (`.access-scroll`) — corregido con `flex:none` en `.btn-save`, beneficia cualquier uso futuro de esa combinación.
3. **Tocar la propia fila en la tabla del grupo mostraba "0 partidos"/efectividad vacía** — `openPlayerPublicProfile` buscaba por nombre plano, y un partido propio con `userId` estampado nunca se encuentra así (regla de exclusividad de V03.0). Es el primer lugar de la app donde la propia fila puede aparecer en una lista tocable (Buscar Jugadores/JUGADORES siempre excluyen al propio jugador). Corregido: la fila propia abre MI PERFIL en vez del perfil público.
4. Decisión de producto (no bug): la etiqueta "ADMIN" se retiró de la tabla principal durante QA por truncar nombres en pantallas angostas — queda solo en Configuración, coherente con "no mostrar privilegios administrativos como parte del ranking deportivo".

**Tests:** 793/793 (743 + 50) — pertenencia temporal, detección 3-de-4, múltiples grupos sobre el mismo partido, base 5, sorpresa de nivel con su umbral exacto de 0,5, remontada, victoria clara con los 3 ejemplos textuales exactos del consolidado (6-3/6-3 no suma, 6-3/6-2 sí, 6-2/6-1 sí), exclusión estructural, top 3, límites lunes-domingo, Race anual, admins.

---

## 22. V03.4.1 — Microparche: empates/UX/ubicación

**Fuente:** `BRAMUlab_V03.4.1_Informe.md` (pedido en chat, transcripto). Tag `BRAMUlab_V03.4.1`.

**Bug real de empates:** `computeWeeklyTable`/`computeRaceAnual` asignaban posición como `índice+1` tras ordenar — dos jugadores con el mismo puntaje terminaban en posiciones consecutivas (1, 2) en vez de compartir la 1, y BRAMU Intelligence heredaba el error hablando de un líder único inexistente. **Fix:** nueva `PLGroups.assignPositions(rows)` — posición "estilo competencia" (`1, 1, 3`, nunca `1, 1, 2`), un solo punto de verdad para ambas tablas. BRAMU Intelligence corregida en las 3 funciones que hablan de "quién va primero" (`insightLeader` junta todos los nombres empatados en la cima; `insightGapOrParity` compara contra el SEGUNDO GRUPO DISTINTO de puntaje, no `fila[1]`, que daría un gap de 0 falso ante empate en la cima; `insightRaceLeader`). Verificado con doble empate simultáneo real: "La semana está muy pareja: Bartolome Alejandro Fernandez y Wal le pisan los talones a Esteban y Seba por 1 punto." (plural correcto en ambos lados).

**Implementado además:** selector de grupos vs. tabs de contenido diferenciados (`.history-mode-chip` con label "GRUPO" para el selector, tabs de contenido intactas); "EL MOMENTO DEL GRUPO"→"EL MOMENTO · {nombre}"; bug real de spacing en Intelligence (los `<p>` traían margen vertical propio del navegador SUMADO al `gap` del flex — fix `margin:0` + `gap` bajado de 9px a 6px); tabla del grupo con bug real de identidad (siempre mostraba inicial aunque hubiera cuenta con foto real — fix `buildGroupRowAccount`); nuevo módulo `locations.js` con ~180 localidades argentinas curadas y `Store` con 4 campos nuevos de ubicación (`locality`/`region`/`country`/`rankingLocalZone`, este último siempre `null`, preparado para el futuro); selectores de Género/Mano/Lado/Categoría convertidos a filas compactas con chevron + hoja compartida.

**Tests:** 814/814 (793 + 21: 11 de empates, 10 de ubicación).

---

## 23. V03.4.2 — Microparche: selector de grupo, tabs, Intelligence, eliminar grupo, GeoRef

**Fuente:** `BRAMUlab_V03.4.2_Informe.md` (pedido en chat, transcripto). Tag `BRAMUlab_V03.4.2`.

**El hallazgo que motivó la ronda:** "General Las Heras" no estaba en el dataset curado de ~180 localidades de V03.4.1. `locations.js` gana `searchLocationsRemote(query, {signal})` — fetch real contra la API pública GeoRef (`apis.datos.gob.ar/georef/api/localidades`, sin auth, CORS abierto), con `toTitleCaseEs` (GeoRef devuelve mayúsculas sostenidas) y deduplicado por localidad+región normalizada. El dataset local baja de rango a fallback mínimo, usado solo si GeoRef falla. `app.js` agrega debounce de 300ms + `AbortController` (cancela una búsqueda vieja si el usuario ya tipeó algo más nuevo). **Verificado contra la API real** (no solo mockeada en tests): "general las heras" devuelve las 2 localidades reales con ese nombre; "bella vista" devuelve las 3 localidades reales del país (Buenos Aires/Corrientes/Tucumán) más un barrio de San Juan — mejor cobertura que el dataset local, que solo tenía la de Buenos Aires.

**Implementado además:** selector único de grupo (reemplaza los chips de V03.4.1, que "todavía competían" con las tabs) — fila "{Nombre} ▾" que abre un bottom sheet; el "+" del header se elimina (el engranaje siempre configura el grupo activo, sin ambigüedad); tabs ACTUAL/ANTERIOR/RACE ANUAL migradas al MISMO contenedor `.history-filters` que usa Historial (la diferencia real no estaba en la clase de las tabs, ya compartida desde V03.4, sino en el contenedor — un override propio que no era idéntico); BRAMU Intelligence con el mismo ícono/pelotita de "TU MOMENTO" del Home + "BRAMU INTELLIGENCE" fijo + nombre del grupo como segunda jerarquía; edición de nombre inline (lápiz, `Escape` cancela, blur/Enter confirman solo si el valor cambió y no queda vacío); `Store.deleteGroup(id)` (nunca toca `HISTORY` — los partidos que alguna vez contaron para el grupo siguen intactos en el historial de cada jugador).

**Tests:** 828/828 (814 + 14: 5 de `deleteGroup`, 9 de GeoRef con `fetch` mockeado — la red real se verificó aparte en QA).

---

## 24. V03.4.3 — Ajustes finales de cierre

**Fuente:** `BRAMUlab_V03.4.3_Informe.md` (pedido en chat, transcripto). Tag `BRAMUlab_V03.4.3`.

**Implementado:** tabs "ACTUAL/ANTERIOR/RACE ANUAL"→"Actual/Anterior/Race anual" (bug real: `.history-tab` no tiene ningún `text-transform`, el texto se ve tal cual se escribe en el HTML — Historial nunca tuvo este problema porque sus labels ya estaban en minúscula/mayúscula inicial); `margin-top:12px` en `.groups-panel` (bug real: la tarjeta de Intelligence quedaba pegada a la línea inferior de `.history-filters`, que no traía margen propio — mismo ritmo estándar de 12px ya documentado desde V02.8); botones de modales de doble acción horizontal de 14px a 12px vía un selector acotado (`.overlay__actions:not(.overlay__actions--stacked) > button`) que nunca toca las clases base — aplica automáticamente a los ~11 modales que ya usaban el contenedor plano, sin cambio de markup por pantalla; hoja de ubicación deja de mostrar el dataset local completo al abrir (`clearProfileLocationList()`) — resultados solo al escribir ≥2 caracteres.

**Tests:** sin tests nuevos (texto/CSS/orden de render). 828/828 sin cambios.

---

## 25. V03.4.4 — Microparche final sobre V03.4.3

**Fuente:** `BRAMUlab_V03.4.4_Informe.md` (pedido en chat, transcripto). Tag `BRAMUlab_V03.4.4`.

**Implementado:** "+ CREAR GRUPO" (antes fila de texto lima sin borde/fondo propio) pasa a botón real con nueva variante `.btn-secondary--lime` (borde/texto verde, fondo lima muy lavado `rgba(149,255,25,0.10)`) — deliberadamente NO `.btn-start` sólido, sigue siendo acción secundaria; cantidad de jugadores por grupo en el selector (`Jueves De Padel · 1 jugador` / `· 3 jugadores`, singular/plural correcto, usando `PG.isMemberActiveAt` — cuenta solo miembros ACTIVOS, mismo criterio que Configuración del grupo); Splash recompuesto: se retira el ISO "B" (vivía arriba del wordmark como segunda marca separada, el pedido era "una sola marca protagonista"), wordmark solo, agrandado 40% (184px→260px), centrado matemático real (el `padding-top:26vh` de V03.2.1 compensaba el corrimiento óptico de DOS elementos apilados — con uno solo, ya no aplica).

**Ícono de la app — sin cambios necesarios, investigado y documentado:** los 5 assets vigentes ya estaban en azul noche + B lima desde el commit `8c15419` (V03.2, un día antes). Diagnóstico: lo que se percibía con fondo verde es casi con certeza el **ícono cacheado por el sistema operativo** desde antes de V03.2 — iOS/Android capturan el ícono al "Agregar a pantalla de inicio" y no lo vuelven a consultar después, a diferencia de `styles.css`/`app.js` que sí se refrescan vía el cuarteto de versión. La solución no es de código: sacar el ícono de la pantalla de inicio y volver a agregarlo.

**Tests:** sin tests nuevos. 828/828 sin cambios.

---

## 26. V03.4.5 — Microparche responsive: bottom nav, tabs Perfil, gráfico Evolución

**Fuente:** `BRAMUlab_V03.4.5_Informe.md` (pedido en chat, transcripto). Tag `BRAMUlab_V03.4.5`.

**Tres bugs reales de tablet, cada uno con causa raíz distinta:**

1. **Bottom nav — dos capas de bug apiladas.** `max-width:480px` era más angosto que el `max-width:768px` que ya usaba TODO el resto de la interfaz en ese breakpoint (`.view--history`, `.history-filters`, `.profile-tabs`). Pero subir solo ese número no habría alcanzado: la regla base (fuera del media query) traía `right:0`, y el media query centraba con `left:50%; transform:translateX(-50%)` — con `left:50%` Y `right:0` simultáneos, el navegador resuelve el ancho por ecuación (`contenedor - left - right`), dando `768-384-0=384px` **sin importar el valor de `max-width`**. Confirmado midiendo con `getBoundingClientRect()` antes/después. Fix: mismo patrón que los otros 3 componentes — `left:0; right:0` + `margin:0 auto`.

2. **Tabs de Perfil.** `.profile-tabs` es ítem flex del contenedor columna `.view--history`. Agregarle `margin:0 auto` para centrarlo desactiva, por especificación de flexbox, el `align-items:stretch` por defecto — el contenedor colapsaba a "encogerse hasta el contenido" (~348px medido, lejos de los 768px declarados), y los 3 `flex:1` de cada tab se repartían ese ancho angosto. Fix: `width:100%` explícito, que deja de depender de si `stretch` está activo.

3. **Gráfico de Evolución.** El `viewBox` usaba un ancho virtual FIJO (320) mientras el `<svg>` se renderiza a `width:100%` — en SVG el `font-size` vive en las MISMAS unidades del `viewBox`, así que estirar un viewBox de 320 unidades a un contenedor de ~700px en tablet escala TODO el sistema de coordenadas por igual, texto incluido (factor ~2.2x, labels de 9px terminando en ~23px reales, medido). Fix: `buildLevelEvolutionSvgHTML` recibe el ancho como parámetro; `renderProfileEvolution` mide el ancho REAL del contenedor con `getBoundingClientRect()` antes de insertar el SVG. Fallback a la constante fija si el contenedor mide 0.

**Nota de verificación honesta:** la verificación del punto 3 se hizo inyectando en vivo una réplica del algoritmo en un contenedor YA VISIBLE, no siguiendo el flujo real de navegación — esto resultaría relevante un día después (§28, V03.4.6): el fix del cálculo era correcto, pero nunca se ejecutaba en la práctica.

**Tests:** sin tests nuevos (CSS de layout + corrección de escala geométrica en un SVG, no la fórmula de Nivel BRAMU). 828/828 sin cambios.

---

## 27. V03.4.6 — Dos hallazgos de QA sobre V03.4.5

**Fuente:** `BRAMUlab_V03.4.6_Informe.md` (reportado por voz, transcripción limpiada de errores de reconocimiento). Tag `BRAMUlab_V03.4.6`.

**Hallazgo 1 — Historial con el MISMO bug que Perfil, en un componente hermano que hasta ahora no lo mostraba.** `.history-filters` es ítem flex DIRECTO de `.view--history` en Historial (mismo mecanismo exacto del bug de `.profile-tabs` corregido un día antes en V03.4.5) — el `margin:0 auto` desactivaba `align-items:stretch`, colapsando el contenedor a ~361px y centrándolo como bloque angosto. **Por qué Mis Grupos, que comparte el mismo `.history-filters`/`.history-tab`, no lo mostraba:** ahí el contenedor vive anidado dentro de `.analysis-scroll` (`flex:1`, pero `display` normal, no flex) — nunca es ítem flex directo de `.view--history`, así que nunca sufrió el bug. Dos pantallas que comparten el mismo componente visual pueden tener bugs de ancho distintos según su posición en el árbol del DOM — la misma lección de V03.4.5, repetida en un componente que había quedado sin revisar. Fix: mismo `width:100%` explícito.

**Hallazgo 2 — el fix de V03.4.5 para el gráfico de Evolución nunca se ejecutaba en el flujo real.** La ronda anterior corrigió correctamente EL CÁLCULO, pero `renderProfileEvolution` (donde se mide el contenedor) es llamada por `renderProfileView`, y en los 3 lugares del código donde eso pasa, el orden siempre es `renderProfileView()` (mide `#evolution-chart-wrap`) **antes** de `showView('profile')` (recién ahí deja de estar `hidden` la pantalla) — la medición corría siempre contra un ancestro oculto, `getBoundingClientRect()` devolvía `width:0` siempre, y el fallback que V03.4.5 agregó para ese caso ("si mide 0, usar la constante fija") era exactamente lo que terminaba usándose en el 100% de los casos reales, reproduciendo el bug de escala que esa ronda creía haber resuelto. **Por qué V03.4.5 no lo detectó:** su verificación inyectó la réplica del algoritmo en un contenedor YA VISIBLE, que nunca ejercitó el bug de timing real.

**Fix:** si la medición inicial da 0, el pintado del gráfico se pospone un `requestAnimationFrame` (para cuando ese callback corre, `showView('profile')` ya se ejecutó y el layout real existe) en vez de caer al fallback fijo — sin tocar el orden en ninguno de los 3 puntos de entrada a Perfil.

**Verificación esta vez con datos reales, no una réplica aislada:** se migró una cuenta legacy de prueba (7 partidos reales sembrados en `localStorage`, dejando correr `migrateLegacyPlayerToUserIfNeeded` normalmente) para ver el gráfico numérico real (no el estado CALIBRANDO de una cuenta nueva) contra el código real. Resultado en tablet: `viewBox="0 0 706 180"` (antes habría sido `0 0 320 180`), labels a 9px reales, 13 etiquetas sin superposición.

**Tests:** sin tests nuevos (layout/CSS y timing de render). **828/828 OK.**

---

## Estado actual de la app: BRAMUlab_V03.4.6

Tag `BRAMUlab_V03.4.6`, publicada en https://sebastianvilaa.github.io/BRAMUlab/bramulab/. 828/828 tests. Arquitectura vigente descripta en §0: identidad por `userId` exclusivo, cuentas/sesión locales, notificaciones, sistema de jugadores (buscar/perfil público/agregar), Mis Grupos (puntos/bonuses/tabla semanal/Race anual/BRAMU Intelligence grupal), ubicación vía GeoRef, todo sin backend real.

**Estado de la última ronda (V03.4.6) como vigente:** las tabs de Historial (Todos/Mis partidos/Observados) quedan alineadas a la izquierda en tablet, igual que las de Mis Grupos — corregido el mismo bug de `align-items:stretch` desactivado por `margin:0 auto` en un ítem flex directo de `.view--history`, esta vez en `.history-filters`. El gráfico de Evolución del Nivel BRAMU en Perfil ya no escala su tipografía en tablet — corregido el bug de timing (la medición del contenedor corría antes de que `showView('profile')` lo hiciera visible, cayendo siempre al fallback de ancho fijo) pospuesta a un `requestAnimationFrame`. Ambos verificados esta vez contra una cuenta con datos reales, no una réplica aislada del algoritmo — el método de verificación de la ronda anterior (V03.4.5) es precisamente lo que había dejado pasar el segundo bug.

**Qué sigue pendiente para cualquier ronda futura de esta línea** (repetido de forma consistente en todos los consolidados desde V03.0): backend real, Ranking BRAMU oficial, fórmula real y definitiva de Nivel BRAMU (sigue siendo una serie simulada), amigos/seguidores/mensajería, notificaciones push, armado de partido desde perfil o grupo. Ver `BRAMUlab_Backlog.md` para el detalle completo de ideas futuras.

---

Los documentos originales de cada ronda (citados arriba por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Informe no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior).
