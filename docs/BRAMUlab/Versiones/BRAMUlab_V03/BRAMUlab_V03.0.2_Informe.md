# BRAMUlab V03.0.2
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 08/09/2026.
**Base:** BRAMUlab V03.0.1 (commit `fa6f163`, tag `BRAMUlab_V03.0.1`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Consolidado.md` — sistema visual transversal (el Home como referencia, sin rediseñarlo) + primera pantalla real de Notificaciones.
**Estado:** publicado en producción.

---

## 1. Auditoría previa (obligatoria por el propio consolidado, §17)

Antes de tocar código se auditó el CSS/markup real del Home y se comparó contra el resto de
pantallas. Tres hallazgos concretos definieron el trabajo:

1. **Dos sistemas de header distintos conviviendo**: `.analysis-header` (Historial/Ranking/
   Perfil/Compañeros/Análisis/Timeline) con un padding, y `.access-back`+`.access-title`
   (Login/Signup/Editar Datos/Completar Acceso/Cambiar contraseña) con otro padding y otra
   jerarquía tipográfica — la causa técnica exacta de "alturas, posiciones de flecha y
   jerarquías diferentes" que reportaba la prueba real.
2. **Bug de avatar real, no solo teórico**: `renderPlayerCard` (V03.0.1) agregó el `<img>` de
   la foto pero nunca ocultaba el `<svg>` genérico — ambos quedaban en el DOM sin `hidden`,
   así que con fotos de bordes irregulares o transparencia el ícono se veía "mezclado" detrás,
   exactamente como describió Sebastián.
3. **Pantallas raíz (Home/Historial/Ranking/Perfil) con flecha "volver" redundante**: la barra
   inferior ya resuelve "volver a Inicio" desde cualquiera de esas 4 — la flecha era una
   segunda forma de hacer lo mismo, y ninguna de las 4 la necesitaba salvo Historial en su
   segundo punto de entrada real (menú heredado de Configurar partido).

---

## 2. Sistema de header — una sola constante

- `.analysis-header` pasa a usar exactamente el padding de `.player-home-header` (Home es la
  referencia): `calc(14px + var(--safe-top)) 18px 12px`, antes `calc(12px + var(--safe-top))
  14px 12px`.
- **Pantallas raíz (Home/Historial/Ranking/Perfil)**: pierden la flecha "volver" por sistema.
  Historial es la única con un segundo punto de entrada real (menú de Configurar partido) —
  ahí sí se muestra, condicionalmente (`$('#history-back-btn').hidden = historyOpenedFrom !==
  'setup'`, `app.js`), verificado en vivo en ambos sentidos.
- **Pantallas secundarias con sesión** (Editar Datos, Completar Acceso, Cambiar contraseña) y
  **familia de autenticación** (Login, Signup): se convirtieron de `.access-back`+
  `.access-title` (dentro de `.access-scroll`, con el padding de toda la sección) a
  `.analysis-header` como hermano de `.access-scroll` — mismo componente, misma posición de
  flecha, en las 5 pantallas. Esto obligó a mover el padding de `.view--access` (la sección
  entera) a `.access-scroll` (`--under-header` lo ajusta cuando ya hay un header arriba), para
  que el header quede edge-to-edge con el mismo borde inferior que Home/Historial/Perfil.
- Bienvenida y Player Card (sin header, wordmark como elemento principal) quedan sin cambios
  de estructura — el consolidado los excluye explícitamente de este patrón.

---

## 3. Bottom nav — regla única (con sesión)

`BOTTOM_NAV_VIEWS` (`app.js`) suma `edit-data`, `complete-access`, `change-password` y
`notifications` — antes esas 4 pantallas nunca mostraban la barra inferior. Efecto colateral
real detectado y corregido: el botón GUARDAR/CAMBIAR quedaba muy cerca de (o detrás de) la
barra inferior recién visible, porque `.access-scroll` nunca había necesitado espacio para
ella — se agregó `.access-scroll--with-bottom-nav` (padding-bottom extra) a esas 3 pantallas.
Notificaciones usa `.analysis-scroll`, que ya convivía con la barra en Historial/Perfil.

Sin sesión, sigue exactamente igual que V03.0.1: `showView` oculta la barra completa
(`Store.getCurrentUser()` fresco, no la variable cacheada) sin importar la vista — verificado
de nuevo en vivo con el flujo de invitado completo.

---

## 4. Bug — avatar del Home

`renderPlayerCard` ahora oculta explícitamente el `<svg>` de fallback (`#player-home-avatar-
fallback`) cuando hay foto, y lo vuelve a mostrar cuando no la hay — antes solo se mostraba/
ocultaba el `<img>`, el ícono genérico nunca recibía `hidden`. Nunca dos capas visibles a la
vez, misma fuente de datos (`Store.getCurrentUser().profilePhoto`).

---

## 5. Perfil — pestañas y jerarquía

- **Pestañas**: el estado activo pasa de un fondo sutil a un acento lima (texto + subrayado
  de 2px), mismo lenguaje que el resto de la app — inactivo en `--paper-faint` para más
  contraste. Nombres siguen en `PROFILE_TAB_LABELS`, sin tocar lógica.
- **MI PERFIL**: nombre/@usuario/"X partidos cargados" se agruparon visualmente (menos
  separación vertical, la nota de partidos deja de ser itálica/con margen de nota suelta).
  KPIs (Efectividad, Racha actual) y Evolución del Nivel BRAMU sin cambios de fuente de datos.

---

## 6. Gráfico de Evolución del Nivel BRAMU — legible

`buildLevelEvolutionSvgHTML` (`app.js`) se reescribió manteniendo `PH.computeLevelEvolution`
intacto (solo presentación):

- **Eje Y**: 3 líneas de grilla con su valor numérico real de Nivel BRAMU al lado (antes solo
  líneas sin número).
- **Eje X**: fechas reales (`playedAt` de cada punto), formato adaptado al rango entre el
  primer y último partido considerado (≤21 días → día/mes, ≤180 → día + mes abreviado, más →
  mes/año), máximo ~5 etiquetas repartidas (siempre incluye la primera y la última) — nunca
  más de eso, para no saturar.
- **Responsive real**: el `viewBox` pasa a un ancho virtual fijo (320) y el `<svg>` se
  renderiza a `width:100%` — antes crecía 56px por punto y dependía de scroll horizontal
  (`overflow-x:auto` en el contenedor). Ahora siempre entra en el ancho disponible sin
  importar cuántos partidos haya; ningún dato se recorta, solo el texto de las etiquetas.
- Verificado en vivo con la cuenta real de 2 partidos: eje Y mostró 4.6/4.9/5.2, eje X mostró
  las fechas reales de ambos partidos.

---

## 7. Mis Datos — orden y edición

- **Botón "EDITAR DATOS" reemplazado** por un ícono de lápiz (SVG, mismo trazo que el resto
  del sistema) arriba a la derecha de una cabecera "TUS DATOS", sobre el bloque de Identidad +
  Datos personales.
- **Campos reordenados**: de "label a la izquierda / valor pesado a la derecha" (leía como
  tabla administrativa) a label chico arriba + valor debajo, alineados a la misma grilla
  izquierda — cambio acotado a `.profile-group .profile-field` (scoped), no afecta los KPIs de
  MI PERFIL que usan el mismo componente base sin ese problema.
- **Acceso y seguridad**: "Cambiar contraseña" pasa de botón full-width a fila con chevron
  (`.profile-row-action`, mismo glyph "›" que ya usaban las tarjetas del Home). "Cerrar
  sesión" se mantiene como botón secundario/destructivo, integrado al mismo bloque.
- Verificado en vivo: banner "Completá tus datos" desaparece al completar todos los campos,
  fila de contraseña aparece/desaparece según haya o no acceso completo.

---

## 8. Editar Datos — refinamiento

Header unificado (§2). Se mantiene todo lo demás de V03.0.1 (labels persistentes, foto,
username, nombre visible, fecha, género segmentado, mano/lado, categoría, toast "Datos
guardados"). El consolidado pedía revisar selects "diminutos" — Género ya había pasado a
control segmentado en V03.0.1; Categoría sigue siendo un `<select>` nativo pero ya usa
`.field__input` a ancho completo con padding/tipografía estándar (no un control diminuto sin
estilo) — no se rehizo el control segmentado ahí para no introducir una lista de 10 opciones
como botones, que el propio consolidado no pide explícitamente.

---

## 9. Cambiar contraseña — integración visual

Header unificado (§2). Lógica sin cambios (contraseña actual/nueva/repetida, misma validación
V03.0.1). **Ojo de contraseña reemplazado**: el ícono circular "◎" (Unicode sin significado
reconocible) pasa a un SVG de ojo/ojo tachado real, mismo trazo lineal (1.8px) que el resto de
la iconografía de la app — un solo componente (`wirePasswordToggle`, `app.js`) reusado en
Login, Completar Acceso, Cambiar contraseña **y Signup** (paso 1, que no lo tenía).

---

## 10. Bienvenida sin sesión — identidad BRAMU

Lógica de las 3 acciones sin cambios (consolidado explícito: "no cambiar"). Rediseño
puramente visual de la tercera acción: de un `.link-btn` (se leía como link olvidado/
cancelar) a un botón ghost/outline deliberado (`.btn-ghost`, borde lima tenue, fondo
transparente) con texto de apoyo "Jugá sin crear perfil ni guardar historial." — jerarquía
1-2-3 ahora clara: INICIAR SESIÓN (CTA principal) → CREAR CUENTA (secundario) → REGISTRAR
PARTIDO SIN CUENTA (terciario, pero deliberado). Sin bottom nav, como antes.

---

## 11. Login / Signup / Completar acceso — misma familia

Las 5 pantallas comparten ahora header, márgenes, ancho de formulario, labels, inputs, ojo de
contraseña y errores. Cambios puntuales:

- **Login**: el error "Revisá tu email y contraseña." tenía un `margin-top` NEGATIVO
  (`-6px`, regla compartida con otros formularios de la app) que lo pegaba al campo. Se
  agregó `.access-form .edit-error{ margin-top: 10px; }` (scoped, no afecta otros
  formularios) — verificado con 14px de separación real entre el campo y el error.
- **Signup**: no se rediseñó el flujo de 3 pasos (consolidado explícito) — solo header
  unificado y ojo de contraseña agregado al paso 1 (antes no lo tenía).
- **Completar acceso**: pantalla completa y lógica sin cambios, mismo sistema de
  autenticación que el resto de la familia.
- `autocomplete` (username/current-password/new-password/email) ya estaba correctamente
  declarado desde V03.0.1 en las 5 pantallas — revisado, sin cambios necesarios.

---

## 12. Notificaciones — pantalla real

**Reemplaza** el popup "todavía no tenés notificaciones" (Etapa 2) por `#view-notifications`,
pantalla completa con el header secundario estándar (§2), bottom nav visible con sesión (nunca
sin sesión — la campana solo vive en el Home, que ya está gateado).

### Modelo local (`store.js`)
Nueva colección `bramulab.notifications.v1`, cada registro con `id`, `userId` (obligatorio,
nunca nombre visible — así nunca se mezclan cuentas locales), `type`, `category` (`positive`/
`info`/`pending`/`error`, decide el color: lima/cian/ámbar/rojo), `title`, `body`, `createdAt`,
`readAt`, `action` opcional. Funciones nuevas: `addNotification`, `addNotificationOnce`
(deduplicación por `dedupeKey` mientras la anterior siga sin leer), `markNotificationRead`,
`markAllNotificationsRead`, `countUnreadNotifications`, `loadNotifications(userId)`.

### Eventos generados (todos sobre datos/acciones reales ya existentes)
- **Perfil actualizado** — al guardar Editar Datos.
- **Acceso completado** — al completar email+contraseña de una cuenta legacy/pendiente.
- **Contraseña actualizada** — al cambiar contraseña.
- **Partido guardado** — solo si hay sesión activa (`persistFinishedMatchAndNotify`, nuevo
  helper compartido entre `finishMatch`/`finishMatchGames`, reemplaza la duplicación de
  V03.0.1). Un partido de invitado (sin sesión) **nunca** genera notificación — no hay
  `userId` al cual asociarla, y tampoco se persiste (regla de V03.0.1 §7, sin tocar).
- **Perfil incompleto** — mismo chequeo de campos que ya alimentaba el banner "Completá tus
  datos" en `renderProfileView`, con deduplicación (`dedupeKey: 'profile-incomplete'`): no
  repite el aviso mientras el anterior siga sin leerse; si se lee y el perfil sigue
  incompleto, genera uno nuevo la próxima vez que se abre Perfil.
- **Nivel BRAMU cambió** — solo para cuentas legacy (nunca en calibración, que no muestra
  número) y solo si `computeLevelEvolution` efectivamente produce un valor distinto antes/
  después de guardar el partido — nunca inventado.

No implementado (fuera de alcance explícito): notificaciones sociales, invitaciones, "reclamar"
un partido invitado.

### Interacción
Badge de no leídas sobre la campana (`#player-home-bell-badge`, hasta "9+"). Tocar una
notificación la marca leída y navega a su `action` si tiene uno (`profile` o `history`).
"Marcar todas como leídas" como acción secundaria en el header. Agrupación cronológica
Hoy/Esta semana/Anteriores. Toasts existentes sin cambios (confirmación inmediata, distinta de
las notificaciones como historial persistente).

Verificado en vivo: guardar datos + completar acceso generaron 2 notificaciones reales,
badge mostró "2", "Marcar todas como leídas" lo llevó a 0, tocar una notificación navegó a
Perfil.

---

## 13. Consistencia de íconos

- **Lápiz**: reemplaza "✎" (carácter Unicode) por un SVG de trazo lineal, reusado en el
  avatar de Editar Datos/Signup **y** en la nueva acción de editar de MIS DATOS.
- **Ojo/ojo tachado**: reemplaza "◎" por un SVG real de ojo/ojo tachado (§9), reusado en las
  4 pantallas con contraseña.
- **Chevron** ("›"): ya era consistente en toda la app (tarjetas del Home) — la nueva fila de
  "Cambiar contraseña" reusa el mismo glyph, no uno nuevo.
- **Back/bell**: sin cambios de ícono, solo de posición/contexto (§2).
- No se reemplazaron todos los íconos de la app — solo los directamente involucrados en esta
  ronda, tal como pide el consolidado.

---

## 14. Espaciado y densidad

Ajustes puntuales: agrupación de identidad en MI PERFIL (§5), cabecera "TUS DATOS" en vez de
un botón separado (§7), sin reducir ningún target táctil (los controles segmentados y botones
mantienen su `min-height` existente). Sin rediseño general de Home/Historial.

---

## 15. Tests

677/677 verdes (661 existentes + 16 nuevos), sin regresiones. Los 16 nuevos casos
(`tests.html`, bloque "V03.0.2") siguen el mismo patrón de snapshot/restore de `localStorage`
que los bloques V03.0/V03.0.1, y cubren la capa `Store` (pura, sin DOM) de Notificaciones:

- Separadas por `userId` (nunca mezcladas, nunca accesibles sin id).
- Orden cronológico descendente.
- Unread/read (`countUnreadNotifications`, `markNotificationRead`, `markAllNotificationsRead`
  no cruza cuentas).
- Deduplicación de "perfil incompleto" (`addNotificationOnce`): no repite mientras la anterior
  siga sin leer, genera una nueva fresca una vez leída, nunca se agrupa con un `dedupeKey`
  distinto.
- Logout/login en el mismo dispositivo no mezcla ni borra notificaciones entre cuentas
  locales.

Igual que en V03.0.1, las conductas de navegación/UI (header unificado, gate de bottom nav,
pantalla de Notificaciones en sí, flujo de invitado) no tienen test automatizado nuevo —
`app.js` no expone sus funciones internas fuera de su IIFE. Se verificaron con QA manual en
vivo contra el dev server real, detallado en cada sección de arriba y en el checklist de abajo.

---

## 16. Validación mobile/desktop

Checklist del consolidado §16, ejecutada contra el dev server local (Browser pane, desktop
1280×720 y mobile 375×812) sobre la cuenta real "Seba" (2 partidos):

| # | Caso | Resultado |
|---|---|---|
| 1 | Home visualmente sin regresiones | ✅ |
| 2 | Avatar Home: foto o fallback, nunca ambos | ✅ (fallback explícito con `hidden`) |
| 3 | Header misma altura/alineación en Home/Historial/Ranking/Perfil | ✅ |
| 4 | Perfil: tabs claramente distinguibles | ✅ (acento lima + subrayado) |
| 5 | MI PERFIL: identidad deportiva coherente con Home | ✅ |
| 6 | Gráfico con referencias X/Y legibles | ✅ (verificado con datos reales) |
| 7 | MIS DATOS: alineación izquierda y lápiz de edición | ✅ |
| 8 | Editar datos: formulario claro | ✅ |
| 9 | Cambiar contraseña: header/eye/spacing correctos | ✅ |
| 10 | Logout → Bienvenida coherente con BRAMU | ✅ (botón ghost + jerarquía 1-2-3) |
| 11 | Login visualmente integrado | ✅ |
| 12 | Error login con separación correcta | ✅ (14px de espacio real medido) |
| 13 | Registrar partido sin cuenta sigue funcionando | ✅ (partido completo jugado, 0 impacto en Historial) |
| 14 | Bell → pantalla Notificaciones | ✅ |
| 15 | Badge/read/unread funcionan | ✅ |
| 16 | Notificaciones de otra cuenta local no aparecen | ✅ (test automatizado + diseño por `userId`) |
| 17 | Bottom nav visible/oculta según reglas de esta versión | ✅ (con sesión en las 4 pantallas nuevas, oculta sin sesión en todas) |
| 18 | Suite completa final sin regresiones | ✅ (677/677) |

Verificación adicional no pedida explícitamente pero relevante: se confirmó, midiendo la
geometría real (`getBoundingClientRect`), que el botón GUARDAR de Editar Datos/Cambiar
contraseña queda con margen real respecto a la barra inferior ahora visible (29px de
separación), evitando que la nueva regla de bottom nav (§3) tapara el CTA.

Los datos reales del dev server (cuenta "Seba", 2 partidos legacy-migrados) se usaron para la
validación y se restauraron a su estado exacto previo al cierre de la sesión de trabajo.

---

## 17. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0.1"` → **`"BRAMUlab V03.0.2"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0-1` → **`bramulab-v03-0-2`**.
- **Commit de implementación (código):** `b519885`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 18. Hash exacto y tag

- Commit de implementación (código): `b5198858536cb94da37cf834e6bd1d5b0274783d`.
- Commit de este informe: se registra en un commit de documentación inmediatamente
  posterior a este (mismo patrón que V03.0/V03.0.1), agregado ahí una vez conocido su propio
  hash.
- Tag `BRAMUlab_V03.0.2` apuntará al commit inmediatamente posterior a este informe.

---

## 19. Diferencias justificadas respecto del consolidado

1. **Padding de `.view--access` movido a `.access-scroll`**: no estaba pedido explícitamente,
   pero era la única forma técnica de lograr "misma relación con el borde/divisor inferior"
   (§1) sin duplicar el padding del header. Documentado acá porque toca la estructura CSS
   compartida por las 7 pantallas de la familia de autenticación (Bienvenida/Login/Signup/
   Player Card/Editar Datos/Completar Acceso/Cambiar contraseña), aunque el resultado visual
   para Bienvenida/Player Card (sin header) es idéntico a antes.
2. **`.access-scroll--with-bottom-nav`**: consecuencia directa y necesaria de §2 (nunca
   mencionada en el consolidado) — sin este ajuste, el CTA de guardado quedaba pegado a la
   barra inferior recién visible en Editar Datos/Completar Acceso/Cambiar contraseña.
3. **Ojo de contraseña agregado también en Signup paso 1**: el consolidado dice "Signup donde
   corresponda" — se interpretó que si las otras 3 pantallas de contraseña lo tienen, Signup
   (que también pide contraseña) corresponde.
4. **Categoría sigue siendo `<select>` nativo** (no se convirtió a control segmentado): el
   consolidado pide revisar tamaño/integración de selects "diminutos", no necesariamente
   reemplazarlos — con 10 opciones, un control segmentado sería más ruido visual que el
   `<select>` de ancho completo ya usado. Se prefirió no tocarlo ("no rehacer controles
   segmentados que ya funcionan" aplicado también en sentido inverso).
5. **Tests nuevos cubren solo la capa `Store`** de Notificaciones, no la navegación/UI — mismo
   límite ya documentado en el Informe V03.0.1 (`app.js` no expone sus funciones internas).

---

## 20. Qué no se tocó

Backend, Supabase/Firebase, ranking real, fórmula real nueva de Nivel BRAMU, amigos/social/
asociación remota de partidos, notificaciones push o de otros usuarios, Player Intelligence
nuevo, rediseño general de Home/Historial, rediseño del marcador, `findPlayerRow`/identidad
estable/`SCHEMA_VERSION` (se mantiene en 3 — ningún campo de identidad cambió, solo se agregó
la colección independiente de notificaciones), la arquitectura de guest-match de V03.0.1.
