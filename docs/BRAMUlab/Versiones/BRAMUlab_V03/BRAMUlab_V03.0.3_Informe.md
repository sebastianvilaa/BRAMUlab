# BRAMUlab V03.0.3
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 08/09/2026.
**Base:** BRAMUlab V03.0.2 (commit `936479b`, tag `BRAMUlab_V03.0.2`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.3_Consolidado.md` — Perfil deportivo real, acceso público con más identidad BRAMU, y correcciones puntuales (avatar, escala del gráfico, flechas superiores).
**Estado:** publicado en producción.

---

## 1. Auditoría previa (obligatoria por el propio consolidado, §17)

Antes de tocar código se auditó el estado real de Perfil/avatar/header contra lo publicado en
V03.0.2. Tres hallazgos concretos definieron el trabajo:

1. **El bug del avatar del Home era real, no solo percibido.** V03.0.2 ya intentaba ocultar
   el ícono genérico (`hidden` en dos elementos separados, escritos en dos líneas distintas
   de `renderPlayerCard`), pero esas dos escrituras nunca tenían una garantía estructural de
   quedar sincronizadas entre sí. El consolidado pedía explícitamente resolverlo "también a
   nivel CSS/layout" — la pista correcta: la causa no era una condición mal escrita, era la
   falta de un ÚNICO interruptor.
2. **La escala Y del gráfico de Evolución tenía un sesgo concreto**: `buildLevelEvolutionSvgHTML`
   incluía `evolution.base` (el 5.0 fijo de arranque) en el cálculo de mínimo/máximo. Un
   jugador que nunca volvió a estar en 5.0 igual veía la escala arrastrada hasta ahí, exactamente
   el efecto "abre demasiado la escala" que describe el consolidado con su propio ejemplo
   (5.9–6.6 real, nunca 4.3–7.2).
3. **`data-mode` vs `data-value`** (bug encontrado DURANTE esta ronda, no reportado por el
   consolidado): al construir las tabs nuevas de "Registrar partido sin cuenta" (§12) se usó
   `data-mode` en el HTML, pero `wireOptionGroup` (el helper compartido de toda la app para
   controles segmentados) siempre lee `data-value`. El tab visual cambiaba pero el modo
   guardado en `Store` no — ver §12 más abajo. Detectado por el propio QA de esta ronda, no
   por inspección de código: confirma el valor de validar cada interacción en vivo, no solo
   leer el resultado visual.

Plan de trabajo: implementación directa, sin presentar plan intermedio (autorización del
consolidado §17), corrigiendo cada punto dentro del alcance declarado.

---

## 2. Bug — avatar del Home (corrección definitiva)

`renderPlayerCard` pasó de escribir `hidden` en dos elementos por separado a un solo
interruptor: `#player-home-avatar` (el contenedor) recibe `data-has-photo="true"/"false"`, y
es CSS quien decide qué capa se pinta:

```css
.player-card__avatar-img{ display:none; }
.player-card__avatar[data-has-photo="true"] .player-card__avatar-icon{ display:none; }
.player-card__avatar[data-has-photo="true"] .player-card__avatar-img{ display:block; }
```

Nunca dos escrituras independientes que puedan desincronizarse — un solo booleano gobierna
ambas capas. Misma fuente de datos que siempre (`Store.getCurrentUser().profilePhoto`), sin
segundo almacenamiento.

**Verificado en vivo, los 6 casos que pide el consolidado §1**, confirmando con
`getComputedStyle` (no solo el atributo, el `display:none`/`block` real):
cuenta con foto (img `block`, svg `none`) · cuenta sin foto (inverso) · cambiar foto · quitar
foto (toast "Foto quitada", `profilePhoto` vuelve a `null`) · recargar (persiste) · logout/
login (persiste con la cuenta correcta).

---

## 3. MI PERFIL — ficha deportiva real

### Cabecera (§2)
Toma el lenguaje de la tarjeta del Home reusando sus mismas clases (`.player-card__level*`)
sin copiarla pixel a pixel: avatar + nombre visible + @usuario a la izquierda, "NIVEL BRAMU"
+ valor/calibración + variación a la derecha — sin la barra de progreso (esa lectura "ahora"
ya la resuelve el Home; acá la trayectoria la muestra el gráfico de Evolución, más abajo).
"X partidos cargados" se retiró de la cabecera (pasó a "Partidos jugados" en Rendimiento).

### Foto editable (§2/§5)
Nuevo affordance chico (cámara, badge circular lima de 26px) sobre el avatar, en MI PERFIL
**y** en MIS DATOS (arriba del bloque Identidad, que antes no mostraba foto en absoluto).
Tocar el avatar o el badge abre el selector de archivo directo — sin pasar por el formulario
completo de Editar Datos. Reusa exactamente `downscaleImageFileToDataUrl` (mismo upload +
compresión que Editar Datos) y guarda con `Store.updateUserAccount`, un único `profilePhoto`
en toda la app. "Quitar foto" (link chico, visible solo cuando ya hay foto) en ambas pantallas.
Editar desde cualquiera de las dos actualiza la otra automáticamente en el próximo render
(mismo dato, misma fuente — no hay sincronización manual que pueda romperse).

### Datos de la ficha (§3)
Dos bloques compactos de mini-KPIs en grilla de 2 columnas (nunca una sucesión de tarjetas
grandes):

- **Datos declarados**: Edad (`PLI.calculateAge`), Mano dominante, Lado habitual, Categoría —
  mismos valores ya declarados en MIS DATOS, mostrados acá también.
- **Rendimiento**: Partidos jugados, Partidos ganados, Efectividad, Racha actual (mismas 4
  fuentes que ya usaba el Home) + **Mejor racha**, nueva en Perfil pero **no nueva en el
  código** — `PH.computeBestWinStreak` ya existía (la usa "Hitos" desde antes) y nunca se
  había expuesto acá. Cero fórmulas nuevas.
- **Mejor Nivel BRAMU histórico**: agregado como 4ª cifra en la tarjeta de Evolución (junto a
  Nivel actual/Cambio acumulado/Partidos considerados) — `Math.max` sobre la misma serie que
  ya dibuja el gráfico, "solo si puede calcularse con la serie real" (oculto si no hay
  partidos considerados).

No se muestra ranking real, puntos, títulos ni posición — nada de eso existe todavía
(consolidado §3/§14, respetado).

---

## 4. Evolución del Nivel BRAMU — escala Y corregida

`buildLevelEvolutionSvgHTML` (`app.js`) cambia el cálculo de rango:

- Antes: `Math.min/max(evolution.base, ...levels)` — el 5.0 fijo de arranque entraba SIEMPRE
  en la cuenta, aunque la serie real nunca haya vuelto ahí.
- Ahora: el rango sale únicamente de `evolution.points[].level` (los datos reales mostrados),
  con un margen chico (20% del span real) y redondeo a un **paso legible**
  (`niceLevelAxisStep`: 0.1/0.2/0.5/1/2/5, el más chico que da ~4 divisiones), máximo 5 marcas.
- Ejemplo real verificado en la cuenta de prueba (serie 4.9–5.1): antes hubiera abierto la
  escala por el `base`; ahora muestra 4.8/5.0/5.2 — ajustado a los datos reales, sin
  exagerar ni aplastar la variación.

Eje X sin cambios de fondo (ya usaba fechas reales desde V03.0.2); gate de calibración
(cuentas nuevas) intacto — nunca un número inventado.

---

## 5. MIS DATOS

Estructura aprobada, sin cambios salvo lo pedido: foto/avatar arriba del bloque Identidad
(§3 de arriba), editable con el mismo mecanismo que MI PERFIL. Lápiz de edición, grupos
(Identidad/Datos personales/Acceso y seguridad) y "Editar Datos" sin cambios — nunca volvió
el botón full-width.

---

## 6. Cerrar sesión

Sin cambios de posición ni de comportamiento — se mantiene en MIS DATOS → Acceso y seguridad,
como botón secundario/destructivo. El consolidado solo pedía "mejorar visibilidad/spacing si
hace falta"; verificado en vivo que ya es claramente visible y accesible, sin necesidad de
ajuste adicional.

---

## 7. Flechas superiores restauradas

V03.0.2 había quitado la flecha "volver" de Historial/Ranking/Perfil (pantallas raíz,
bottom nav ya resolvía volver a Inicio). En uso real no quedó bien — se restauran, **conviviendo**
con la bottom nav (ambas formas de navegación visibles a la vez, tal como pide el consolidado):

- **Ranking/Perfil**: flecha vuelve siempre a Home (único origen posible en ambas).
- **Historial**: comportamiento contextual sin cambios — vuelve a Home si no hay origen
  especial, o a Configurar partido si se abrió desde ese menú heredado (`historyOpenedFrom`,
  intacto). Antes (V03.0.2) la flecha se ocultaba en el caso "sin origen especial"; ahora
  queda siempre visible, apuntando siempre al destino correcto.

Misma altura/posición de header ya unificada en V03.0.2 — sin cambios ahí.

---

## 8. Familia sin sesión — más identidad BRAMU

### Bienvenida (§9)
- Wordmark: de 56px a 92px, con más aire arriba (`margin-top: 15%` del ancho del contenedor,
  no `vh` — evita que el margen se dispare en viewports muy bajos) — "más presencia y mejor
  ubicación", como pide el consolidado, sin tocar el resto de la pantalla.
- CTA principal (`.btn-start`) con padding reducido, scoped a `.access-actions` (no toca los
  demás usos de `.btn-start` en la app, como "EMPEZAR PARTIDO").
- Jerarquía 1-2-3 y botón ghost de la tercera acción: sin cambios (ya se habían resuelto en
  V03.0.2, el consolidado pedía mantenerlos exactamente así).

### Login/Crear cuenta/Completar acceso (§10/§11)
Ya compartían header/márgenes/labels/eye-icon desde V03.0.2 — verificado que sigue así, sin
necesidad de ajustes adicionales. Flujo, pasos y validaciones sin cambios. **No se agregó
"Olvidé mi contraseña"** (explícitamente fuera de alcance — no existe recuperación real por
email, autenticación local; queda documentado como pendiente de la etapa backend).

---

## 9. Registrar partido sin cuenta — tabs de modo

### Reemplazo del selector (§12)
El selector de modo (Punto a punto/Por games) vivía escondido 2 niveles adentro de un menú
(`header-menu-btn` → `header-menu` → `mode-select-menu`). Se reemplaza por **2 tabs siempre
visibles** debajo del header BRAMU, antes de Equipo A/B (`#setup-mode-tabs`, mismo patrón
`.option-row`/`.option-col` que ya usa "Sistema de puntuación" en la misma pantalla — ningún
componente nuevo). El menú compacto del header se simplifica a Mi pádel/Historial (el trigger
pasa a decir "MENÚ", ya no repite el modo activo). `#mode-select-menu` (el overlay viejo) se
eliminó del DOM — quedaba sin uso.

**Bug real encontrado y corregido durante el QA de esta misma ronda** (ver §1): las tabs
nuevas usaban `data-mode`, pero `wireOptionGroup` lee `data-value` — el tab se veía
seleccionado pero `Store.saveRecordingMode` guardaba siempre "complete". Corregido
renombrando el atributo; reverificado en ambas direcciones (Punto a punto ↔ Por games) con el
valor real de `localStorage` en cada click, no solo el estado visual.

### Navegación de invitado (§12)
Nuevo botón discreto **"Volver al inicio"** al final de Configurar partido, visible
ÚNICAMENTE sin sesión — un solo punto de verdad en `showView('setup')` (no en cada
call-site que navega ahí), así nunca puede quedar desincronizado del resto de la regla de
sesión de esa función. Verificado: con sesión queda oculto; sin sesión (flujo completo
Bienvenida → Registrar partido sin cuenta → Setup) queda visible y vuelve a Bienvenida.
Historial/Ranking/Perfil y la bottom nav personal siguen sin mostrarse sin sesión (V03.0.1/
V03.0.2, sin cambios).

---

## 10. Notificaciones

Sin cambios de lógica ni tipos nuevos (consolidado §13, "queda aprobada"). Ya usaba el header
unificado y ya tenía flecha propia desde V03.0.2 (nunca estuvo en la lista de pantallas raíz
sin flecha) — no necesitó ningún ajuste.

---

## 11. Integridad de métricas

Todo lo agregado en MI PERFIL (jugados/ganados/efectividad/racha actual/mejor racha/mejor
nivel) sale de funciones y datos que YA existían (`PH.computeEffectivenessTotal`,
`PH.computeCurrentStreak`, `PH.computeBestWinStreak`, `PH.computeLevelEvolution`) — cero
fórmulas nuevas, cero placeholders que parezcan datos reales. No se muestra ranking, puntos,
títulos ni posición.

---

## 12. Tests

682/682 verdes (677 existentes + 5 nuevos), sin regresiones. Los 5 nuevos casos (`tests.html`,
bloque "V03.0.3") cubren lo testeable a nivel `Store` (puro, sin DOM) del cambio de esta
ronda — foto editable desde dos pantallas distintas que terminan en el mismo dato:

- Cuenta nueva arranca sin `profilePhoto`.
- `updateUserAccount` guarda y lee `profilePhoto` correctamente (misma fuente para Home/MI
  PERFIL/MIS DATOS).
- "Quitar foto" limpia a `null` (no string vacío, no queda el dato viejo).
- Editar/quitar conserva el mismo `userId` — nunca crea una cuenta nueva.

`PH.computeBestWinStreak` ya tenía cobertura previa (usada por Hitos desde antes) — no
necesitó un test nuevo, solo se reusó.

Igual que en rondas anteriores, lo que vive solo en `app.js` (avatar CSS-driven, header/
flechas, tabs de modo, "Volver al inicio", ficha deportiva completa) no tiene test
automatizado nuevo — `app.js` no expone sus funciones internas fuera de su IIFE y no se carga
en `tests.html`. Se verificó con QA manual en vivo, incluyendo lectura de `getComputedStyle`
y de `localStorage` real en cada paso (no solo el estado visual) — así se encontró el bug de
§1/§9 antes de publicar.

---

## 13. Validación mobile/desktop

Checklist del consolidado §16, ejecutada contra el dev server local (Browser pane, desktop
1280×720 y mobile 375×812) sobre la cuenta real "Seba" (2 partidos) + una cuenta nueva
temporal (para el estado de calibración):

| # | Caso | Resultado |
|---|---|---|
| 1 | Home sin regresiones | ✅ |
| 2 | Avatar sin superposición | ✅ (verificado con `getComputedStyle`, no solo el atributo) |
| 3 | MI PERFIL se siente ficha deportiva | ✅ |
| 4 | Foto editable desde MI PERFIL | ✅ |
| 5 | Foto editable desde MIS DATOS | ✅ |
| 6 | Edad/mano/lado/categoría correctos | ✅ |
| 7 | Jugados/ganados/efectividad correctos | ✅ |
| 8 | Racha actual/mejor racha correctas | ✅ |
| 9 | Mejor Nivel BRAMU correcto si aplica | ✅ (oculto correctamente en calibración) |
| 10 | Gráfico con escala Y cercana a datos reales | ✅ (4.8–5.2 sobre serie 4.9–5.1 real) |
| 11 | Eje X legible | ✅ (sin cambios, ya funcionaba) |
| 12 | Perfil/Historial/Ranking con flecha | ✅ |
| 13 | Cerrar sesión accesible | ✅ |
| 14 | Bienvenida integrada visualmente | ✅ (wordmark 92px, CTA ajustado) |
| 15 | Login integrado visualmente | ✅ |
| 16 | Crear cuenta integrado visualmente | ✅ |
| 17 | Completar acceso integrado visualmente | ✅ (sin cambios desde V03.0.2, reverificado) |
| 18 | Invitado muestra tabs de modo | ✅ |
| 19 | "Volver al inicio" funciona | ✅ |
| 20 | Sin sesión no aparece bottom nav personal | ✅ |
| 21 | Notificaciones siguen funcionando | ✅ |
| 22 | Suite completa sin regresiones | ✅ (682/682) |

Los datos reales del dev server (cuenta "Seba", 2 partidos legacy-migrados) se usaron para la
validación y se restauraron a su estado exacto previo al cierre de la sesión de trabajo.

---

## 14. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V03.0.2"` → **`"BRAMUlab V03.0.3"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-0-2` → **`bramulab-v03-0-3`**.
- **Commit de implementación (código):** `bb673f7`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 15. Hash exacto y tag

- Commit de implementación (código): `bb673f741b4e31daa5900b011d393787b0e85414`.
- Commit de este informe: `aec0f4f5c781165bdcdc644bd1899b5e03f3b7a2`.
- Tag `BRAMUlab_V03.0.3` apuntará al commit inmediatamente posterior a este.

---

## 16. Diferencias justificadas respecto del consolidado

1. **Corrección del bug `data-mode`/`data-value`** (§9 de este informe): no estaba en el
   consolidado (no podía estarlo — es un bug introducido DURANTE esta misma ronda al construir
   la funcionalidad que el consolidado sí pedía). Corregido y documentado apenas se detectó en
   el propio QA, antes de publicar.
2. **Wordmark con `margin-top: 15%`** en vez de un valor fijo en píxeles o `vh`: se prefirió un
   porcentaje (resuelve contra el ancho del contenedor de 460px, no la altura del viewport)
   para dar más presencia sin arriesgar un margen exagerado en pantallas muy bajas — el
   consolidado pedía "más presencia y mejor ubicación" sin especificar la técnica.
3. **"Mejor Nivel BRAMU histórico" vive en la tarjeta de Evolución** (junto a Nivel actual/
   Cambio acumulado), no como una 6ª fila en el bloque Rendimiento — mismo dato, mismo gate de
   calibración, y evita separar dos cifras de Nivel BRAMU en dos tarjetas distintas.
4. **Tests nuevos cubren solo la capa `Store`** de la foto editable, no la interacción de
   UI/DOM (tap → file picker → guardado) — mismo límite ya documentado en los Informes
   V03.0.1/V03.0.2 (`app.js` no se carga en `tests.html`).

---

## 17. Qué no se tocó

Backend, Supabase/Firebase, recuperación real de contraseña, ranking real, social/amigos,
compartir partidos, notificaciones push, fórmula real nueva de Nivel BRAMU
(`computeLevelEvolution`/`computeLevelDeltaForMatch` sin cambios), Player Intelligence nuevo,
rediseño general de Home/Historial, rediseño del marcador, arquitectura de identidad
(`findPlayerRow`, `userId`, `SCHEMA_VERSION` se mantiene en 3), el modelo de guest-match de
V03.0.1, el modelo de notificaciones de V03.0.2.
