# BRAMUlab V03.2
## Informe — qué se auditó, implementó, verificó y corrigió

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.1.6 (commit `395e220`, tag `BRAMUlab_V03.1.6`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Consolidado.md` —
auditoría y normalización del sistema visual transversal (acceso/autenticación, splash,
botones, modales, navegación inferior), no una suma de parches pantalla por pantalla.
**Estado:** publicado en producción.

Esta ronda no rediseñó ninguna pantalla de referencia (Home, Historial, Cargar/Registrar
partido, Resumen, MI PERFIL, MIS DATOS): todo lo de abajo son correcciones de sistema
compartido (CSS/componentes) más los puntos puntuales que el consolidado autorizó
explícitamente en Resumen y Carga.

---

## 1. Auditoría realizada

Antes de tocar código se recorrió la familia de acceso completa (Splash, Bienvenida, Login,
Crear cuenta ×3 pasos, Player Card, Olvidé mi contraseña ×3 pasos, Completar acceso, Cambiar
contraseña), los ~15 modales de confirmación de la app, el árbol de clases `.btn-*` en
`styles.css`, y la lógica de `showView()`/`BOTTOM_NAV_VIEWS` en `app.js`. De ahí salieron las
inconsistencias de las secciones 2-7; ninguna se resolvió parche por parche sin antes revisar
si el componente compartido correspondiente ya existía.

---

## 2. Splash y colores heredados

- `#app-splash` (styles.css): el degradé radial usaba una familia de **verdes oscuros**
  (`rgba(22,40,31)…#050907`), incoherente con el azul noche adoptado como base desde V02.
  Reemplazado por los tokens reales de superficie (`--surface-2/--surface-1/--bg/--bg-deep`) —
  nunca un color aislado nuevo.
- El halo lima del ícono "B" (`.app-splash__b`) ya viene horneado en el propio PNG — el
  `drop-shadow` extra en CSS lo duplicaba (glow sobre glow). Retirado.
- `<meta name="theme-color">` (index.html) y `background_color`/`theme_color`
  (manifest.webmanifest): `#0B1211` (verde-negro heredado) → `#050A12` (`--bg` real).
- **Íconos de app** (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon.png`): el fondo horneado en el PNG era el mismo verde-negro radial, con un
  glow lima ya bastante marcado alrededor de la "B". Recoloreado por transformación de matiz
  (Python/Pillow: los píxeles de fondo puro, matiz ~165-170°, migran a azul noche ~215°
  manteniendo el brillo/alpha original; el matiz del isotipo lima ~70° y su halo de transición
  quedan intactos — nunca se tocó el dibujo de la "B", solo el entorno). El isotipo/logo de
  BRAMU **no se rediseñó** (§14 del consolidado).
- **Bug real encontrado de paso:** `favicon-64.png` estaba corrupto — el chunk `IDAT` del PNG
  declaraba más bytes de los que el archivo realmente tenía (truncado). Algunos decodificadores
  tolerantes (macOS `sips`) lo abrían igual; Pillow y potencialmente algunos navegadores no.
  Regenerado desde el `icon-192.png` ya recoloreado (mismo diseño, archivo válido).
- **Bug real encontrado, no cosmético:** la función que arma la imagen para "Compartir
  resultado" (`app.js`, cerca de la línea 7960) fijaba una paleta CSS completamente
  congelada desde **antes** de la migración de tokens de V02.5/V02.6 — verde-negro heredado
  (`#0B1211`/`#10201D`/`#16281F`) y colores de equipo viejos (`#C8FF3D`/`#33A6FF`, no
  `#95FF19`/`#199FFF`). La imagen que un usuario comparte a redes sociales mostraba una marca
  distinta a la app real. Corregido a los valores actuales de `:root`.

---

## 3. Bienvenida / Acceso — jerarquía y logo

- **Bug real encontrado:** `.access-logo` usaba `width:92px;height:92px;object-fit:contain`
  sobre `logo.png` (wordmark ancho, 915×139, ratio ~6.6:1). Con esa caja cuadrada, `contain`
  fuerza el ancho como lado limitante y el alto renderizado real terminaba en **~14px** — más
  chico que el logo del header (`.brand-logo--header`, 24px), violando directamente el §3 del
  consolidado ("no puede verse más chico que en el header del Home") pese a que el comentario
  original decía lo contrario. Reemplazado por ancho fijo (240px) + alto automático: el
  wordmark completo ahora se ve, notoriamente más grande que el header.
- Con el logo en su tamaño real, el bloque de contenido quedaba anclado arriba con un vacío
  grande abajo (el `margin:15%` que antes compensaba un logo de 14px ya no cumplía ese rol).
  Se centra verticalmente `.access-scroll` **solo** en `#view-access` (nunca en Login/Crear
  cuenta/etc., que sí tienen header + formulario y se componen mejor ancladas arriba).
- **INICIAR SESIÓN** (`.btn-start`, lima) y **CREAR CUENTA** (`.btn-secondary`, gris) tenían
  tamaños de fuente distintos (17px vs 13px) — se leían como dos jerarquías, no una sola
  diferenciada por color como pide el §6. Igualados en tamaño/padding, scoped a
  `.access-actions` (nunca una normalización global de `.btn-secondary`).
- `REGISTRAR PARTIDO SIN CUENTA` se mantiene como acción terciaria separada — sin cambios, ya
  cumplía.
- No se tocó el texto ("BIENVENIDO A BRAMU…") — el consolidado lo dejaba a criterio ("no hace
  falta conservar…"), se priorizó no introducir un cambio de copy subjetivo en una ronda ya
  extensa de normalización de sistema.

---

## 4. Sistema global de botones

Cuatro familias, por USO (no por pantalla), reforzadas en `styles.css`:

| Familia | Clase | Tratamiento |
|---|---|---|
| Primario | `.btn-start` | Lima sólido |
| Secundario funcional (editar/modificar) | `.btn-secondary--accent` (**nueva**) | Azul (`--accent-cyan`), mismo tratamiento tenue que ya usaba `--danger` |
| Secundario neutro (cancelar/volver) | `.btn-secondary` | Gris/borde |
| Destructivo (eliminar/cerrar sesión/salir sin guardar) | `.btn-secondary--danger` | Rojo |

- **Mayúsculas/minúsculas:** se agregó `text-transform:uppercase` a `.btn-start`, `.btn-secondary`
  y `.btn-mini` — de una sola vez normaliza el mayúsculas/minúsculas inconsistente de TODA la
  app ("Cancelar" junto a "CANCELAR", "Confirmar" junto a "GUARDAR", etc.) sin tocar el texto
  real de ninguna pantalla. Deliberadamente **no** se tocó `.link-btn`: mezcla acciones cortas
  ya en mayúscula con links de una sola oración ("¿Olvidaste tu contraseña?", "Marcar todas
  como leídas") que se leerían agresivos en mayúscula sostenida.
- **Bug real encontrado:** los 7 botones "avanzar/guardar" de la familia de acceso (INICIAR
  SESIÓN del form de Login, ENVIAR CÓDIGO, VALIDAR CÓDIGO, GUARDAR CONTRASEÑA, GUARDAR de
  Editar Datos, GUARDAR ACCESO, GUARDAR de Cambiar contraseña) usaban `.btn-secondary.btn-save`
  — es decir, la familia **secundaria neutra** (gris), contradiciendo la propia definición del
  sistema de botones (§7.1: avanzar/confirmar/guardar = primario lima). Corregidos a
  `.btn-start.btn-save` — mismo layout (`.btn-save` solo aporta ancho/margen), color correcto.
- `EDITAR PARTIDO` (Resumen): pasó de `.btn-secondary` (gris) a `.btn-secondary--accent`
  (azul), la familia correcta para "editar/modificar" (§10).

---

## 5. Modales de confirmación

- **"Salir sin guardar"** (Carga manual, `exitManualLoadScreen` en app.js): el modal genérico
  compartido (`#confirm-overlay`) mostraba "Confirmar"/"Cancelar" genéricos y el botón de
  aceptar era **siempre lima** (`.btn-start`) sin importar que la acción implique pérdida de
  datos. `confirmAction()` gana un 7º parámetro opcional `danger` que alterna el botón de
  aceptar entre lima y rojo (`.btn-secondary--danger`); este caso pasa a usar exactamente
  `CANCELAR` / `SALIR SIN GUARDAR`, rojo — verificado en vivo (cargando un set, tocando Volver).
- **"Eliminar partido"** (Resumen): mismo mecanismo — antes decía "Eliminar" en un botón
  siempre-lima; ahora `CANCELAR` / `ELIMINAR PARTIDO`, rojo — verificado en vivo.
- Los demás ~5 llamadores de `confirmAction()` (Reiniciar partido, Volver al inicio desde ☰,
  Cambiar sacador, ajustes de Set 3/formato durante la carga manual) **no se tocaron**: viven
  dentro del flujo de partido en vivo/edición de marcador, fuera del alcance autorizado, y
  siguen mostrando "Confirmar"/"Cancelar" en lima — solo ahora en mayúscula automática (§4).
- **"Cerrar sesión"** (`#logout-confirm-modal`, Perfil): ya cumplía la estructura exacta del
  consolidado (`CANCELAR`/`CERRAR SESIÓN` rojo) — verificado, sin cambios.
- **"Todavía no completaste tu acceso"** (`#logout-warning-modal`): excepción justificada de 3
  acciones (hay un camino de riesgo real además de completar/cancelar) que el consolidado no
  cubre literalmente. Se normaliza igual: `CERRAR SESIÓN IGUAL` pasa de gris neutro a rojo
  destructivo (es la acción de riesgo real) y a mayúscula como sus hermanas; `CANCELAR` en
  mayúscula.
- `#discard-match-modal`, `#update-available-modal`, `#scoring-system-modal` — auditados, ya
  usaban la semántica de color correcta; sin cambios de contenido.

---

## 6. Resumen del partido

- `EDITAR PARTIDO`: azul funcional (§4 de este informe).
- `VOLVER AL INICIO`: sin cambios, ya era lima primario correcto.
- `ELIMINAR PARTIDO`: pasaba de `.link-btn` suelto (invisible hasta tocar, apagado) a un botón
  real del sistema (`.btn-secondary.btn-secondary--danger`), rojo siempre visible pero
  notoriamente más chico (altura 38px vs 46px de los dos de arriba) para seguir sin competir
  con `VOLVER AL INICIO` — verificado en vivo, incluida la confirmación.

---

## 7. Bottom nav en Carga / Confirmar partido

`BOTTOM_NAV_VIEWS` (app.js) suma `'manual-load'` y `'match-saved'` — las dos pantallas de
`.view--court` que perdían la navegación inferior con sesión activa pese a no ser una tarea de
scoring en vivo.

Estas dos pantallas tienen elementos `position:fixed` en `bottom:0` (el teclado numérico y la
barra CONTINUAR) que habrían quedado tapados por la nav (z-index más alto). Corrección:

- Nueva variable `--bottomnav-h` (0px por defecto), fijada por `showView()` con el alto real
  medido de `#bottom-nav` (nunca un valor adivinado) cada vez que cambia de vista.
- `.load-keypad` pasa de `bottom:0` a `bottom:var(--bottomnav-h)`.
- `positionManualContinueBar()` (ya existía, medía el teclado en vivo) ahora suma ese mismo
  offset al posicionar la barra CONTINUAR.
- `.court-scroll`/`.load-match-scroll.has-keypad` suman `+ var(--bottomnav-h)` a su padding
  inferior para que el contenido no quede detrás de la nav al hacer scroll hasta el final.
- **Bug real encontrado y corregido de paso:** el botón "+" (FAB) de la barra ya traía
  `data-nav="manual-load"` sin uso hasta ahora. Al activarse por primera vez,
  `.bottom-nav__item.is-active{color:lima}` le ganaba en especificidad a
  `.bottom-nav__item--fab{color:oscuro}` — el "+" habría quedado lima sobre fondo lima,
  invisible. Se agrega `.bottom-nav__item--fab.is-active{color:#1A1400}` (el FAB es un
  disparador de acción, nunca debe leerse como pestaña seleccionada).
- Invitado/sin sesión: sin cambios — la nav sigue oculta (el gate `!!Store.getCurrentUser()` no
  se tocó), verificado en vivo entrando a Configuración como invitado.

**Verificado en vivo, extremo a extremo:** login → "+" → Cargar mi partido jugado → nav visible
→ teclado numérico posicionado arriba de la nav (no tapado) → set completo → CONTINUAR visible
arriba de la nav → equipos completos → Confirmar partido (nav visible, GUARDAR PARTIDO con
espacio de sobra) → Resumen.

---

## 8. Familia de acceso — inputs y formularios

- **Bug real encontrado:** Crear cuenta, pasos 1 y 2 (Email/Contraseña/Repetir contraseña,
  Nombre/Apellido/@usuario/Nombre visible) usaban inputs con **placeholder únicamente**,
  mientras el resto de la familia (Login, Editar Datos, Completar Acceso, Cambiar contraseña)
  ya usa labels persistentes visibles — inconsistencia real dentro de la misma familia (§13).
  Unificado al mismo patrón `field--labeled` (label + input), sin tocar IDs ni lógica de
  validación (`wirePasswordToggle`/listeners operan por ID, no por estructura DOM — verificado
  antes de tocar el markup).
- De paso, "Nombre visible" en Crear cuenta gana el mismo texto de ayuda que ya tiene en Editar
  Datos ("Así te va a mostrar BRAMU en partidos, rankings y grupos.") — mismo dato, mismo
  patrón, ahora también en el paso de alta.
- Alturas, bordes, radios, estados de foco, ojo mostrar/ocultar contraseña y mensajes de error
  ya eran consistentes en toda la familia — auditados, sin cambios necesarios ahí.

---

## 9. Tabs

Auditadas (MI PERFIL/MIS DATOS, Historial): ya usan el patrón correcto (activa lima, inactiva
gris, mismo componente). Sin cambios.

---

## 10. Excepciones justificadas

- `#logout-warning-modal` mantiene 3 acciones (no la estructura base de 2) — hay un camino de
  riesgo real (perder acceso a la cuenta) además de completar/cancelar; normalizado en color y
  mayúscula, no en cantidad de botones (§5 de este informe).
- Los ~5 llamadores de `confirmAction()` dentro del flujo de partido en vivo/edición de
  marcador no recibieron el parámetro `danger` ni etiquetas específicas — están fuera del
  alcance autorizado (lógica de scoring), solo heredan la normalización tipográfica compartida.
- No se tocó el texto de bienvenida ("BIENVENIDO A BRAMU…") — el consolidado lo dejaba a
  criterio explícito; se priorizó no introducir copy subjetivo nuevo en una ronda ya extensa de
  normalización de sistema.
- El fix del ícono de app (recoloreado de fondo) y del `favicon-64.png` corrupto no estaban
  pedidos letra por letra en el consolidado, pero caen directamente dentro de "auditar: ícono de
  app; halo/glow asociado" (§14) y "eliminar colores/glows heredados" (prioridad explícita del
  pedido) — se documentan acá como hallazgos de la propia auditoría, no como alcance nuevo.
- La corrección de la paleta del "Compartir resultado" (§2) tampoco estaba nombrada
  literalmente, pero es la misma categoría de bug ("colores heredados") en un lugar no obvio
  (una función que arma HTML para exportar a imagen) — corregida por ser un hallazgo real de
  la auditoría de colores, no un rediseño de una pantalla protegida.

---

## 11. Tests

**722/722 en verde**, sin tests nuevos (no se tocó lógica de negocio/scoring/Nivel BRAMU —
todos los cambios son CSS, clases HTML, y ajustes de posicionamiento/etiquetas visuales).
Suite completa corrida una sola vez al cierre, como pide el consolidado.

---

## 12. QA

### Mobile (375×812, dev server local)
- ✅ Splash: azul noche, un solo glow (sin duplicar).
- ✅ Bienvenida: logo protagonista, INICIAR SESIÓN/CREAR CUENTA misma jerarquía, composición
  centrada.
- ✅ Login: labels persistentes, botón de acceso lima, "¿Olvidaste tu contraseña?" en
  minúscula/sentencia (no forzado a mayúscula).
- ✅ Crear cuenta (pasos 1-3): labels persistentes en pasos 1-2, hint de "Nombre visible",
  botón CONTINUAR/CREAR MI JUGADOR, Player Card final sin cambios.
- ✅ Cambiar contraseña: GUARDAR lima, resto sin cambios.
- ✅ Resumen del partido: EDITAR PARTIDO azul, VOLVER AL INICIO lima, ELIMINAR PARTIDO rojo
  chico + modal CANCELAR/ELIMINAR PARTIDO rojo.
- ✅ Carga/configuración de partido: nav visible con sesión, teclado numérico y CONTINUAR
  correctamente posicionados arriba de la nav en cada estado (cerrado/abierto/decidido), FAB
  "+" visible (no lima-sobre-lima); modal "Salir sin guardar" con CANCELAR/SALIR SIN GUARDAR
  rojo. Invitado: nav sigue oculta.
- ✅ Confirmar partido: nav visible, sin overlaps.
- ✅ Cerrar sesión: modal ya conforme, sin regresiones.
- ✅ "Todavía no completaste tu acceso": CERRAR SESIÓN IGUAL ahora rojo.
- Recuperación/Código/Nueva contraseña/Completar acceso: mismo cambio mecánico de clase
  (`.btn-secondary.btn-save` → `.btn-start.btn-save`) ya verificado en Login/Cambiar
  contraseña/Crear acceso — no se repitió la captura de cada paso individual, mismo patrón
  exacto.

### Desktop
Chequeo visual rápido (Home, Bienvenida) — sin regresiones, misma composición centrada dentro
de la columna de ancho fijo.

No se rehizo QA de Home/Historial/Perfil/Mis Datos/Ranking — no fueron modificados (más allá
de la normalización tipográfica de botones, ya cubierta).

### Datos de prueba
Toda la exploración se hizo contra la sesión real de datos del dev server (cuenta "Seba", 6
partidos). Los artefactos de esta sesión (una cuenta de prueba "Test V032" creada para probar
Crear cuenta, y un partido de prueba cargado para probar el flujo de Carga manual/nav) fueron
eliminados antes de cerrar — el estado del dev server quedó exactamente igual al que tenía al
empezar (6 partidos, "05SEP · 17:00" como último partido, Nivel BRAMU 5.8).

---

## 13. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.1.6"` → **`"BRAMUlab V03.2"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-1-6` → **`bramulab-v03-2`**.
- `?v=03.1.6` → **`?v=03.2`** en los 7 `<script>` + `<link rel="stylesheet">` de `index.html` y
  en `CORE_ASSETS` de `sw.js` (mismo valor en ambos archivos, ver nota junto a V03.1.6).
- `manifest.webmanifest` / `<meta name="theme-color">`: `#0B1211` → `#050A12`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 14. Hash exacto y tag

- Commit de implementación (código): `8c1541959480df2892638c239bbb62c7b4a615cd`.
- Tag `BRAMUlab_V03.2` apunta al commit inmediatamente posterior a este informe.

---

## 15. Qué no se tocó

Home, Historial, MI PERFIL, MIS DATOS, Ranking, Player Intelligence, lógica de scoring, lógica
de Nivel BRAMU, datos, backend, social — sin cambios de estructura, contenido ni navegación.
Las pantallas de partido en vivo (Configuración previa, Partido en vivo, sus modales de
edición de marcador) no se rediseñaron; solo heredan la normalización tipográfica compartida de
botones (mayúscula automática vía CSS), sin cambios de copy, color ni layout propios.
