# BRAMUlab V03.2.1
## Informe — qué se corrigió, verificó y ajustó

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.2 (commit `91a8687`, tag `BRAMUlab_V03.2`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Consolidado.md` —
corrección tras QA visual de la V03.2 en producción. No es exploración de diseño nueva: cierra
inconsistencias que la V03.2 dejó a mitad de camino.
**Estado:** publicado en producción.

---

## 1. Sistema de botones — especificación única final

La V03.2 unificó color y mayúscula, pero `.btn-start` (17px, padding 17px, weight 700, tracking
.08em) y `.btn-secondary` (13px, padding 13px/16px, weight 800, tracking .03em) seguían siendo
dos tipografías/alturas distintas — la diferencia entre familias debía venir solo de color/
borde/fondo.

**Especificación final única** (`.btn-start` y `.btn-secondary`, `styles.css`):
- `font-family: var(--font-display)` (Inter — la que ya usaba toda la app, nunca Montserrat).
- `font-size: 14px`; `font-weight: 700`; `letter-spacing: 0.05em`; `text-transform: uppercase`.
- `min-height: 48px`; `padding: 0 18px` (centrado vertical vía `display:flex` — mismo patrón ya
  probado desde V02.8.1 en el bloque de acciones de Resumen, ahora generalizado).
- `border-radius: 14px`.

Las 4 variantes de color siguen intactas y sin cambios: primario lima (`.btn-start`), funcional
azul (`.btn-secondary--accent`), neutro (`.btn-secondary`), destructivo rojo
(`.btn-secondary--danger`).

**Efecto deliberado:** esto redimensiona TODA la app de una sola vez — EMPEZAR PARTIDO, LISTO,
GUARDAR/CANCELAR de partido en vivo, todo. El consolidado lo pide explícitamente ("no debe
existir un botón especial solo porque vive en otra pantalla"), así que ya no hay excepción de
tamaño por contexto. Con la base unificada, dos scopes que existían solo para igualar tamaños a
mano quedaron redundantes y se retiraron: el de `#analysis-share-section` (Resumen) y el de
`.access-actions` (Bienvenida) — ambos bloques terminan iguales sin necesitar override propio.

`.btn-mini` (pill chica, "+ Agregar"/banner de continuar) y `.btn-ghost` (tercera acción de
Bienvenida, deliberadamente distinta) quedan fuera a propósito: no son una de las 4 familias
del sistema, son componentes de otro nivel.

---

## 2. Splash

QA en producción: con centrado matemático (`justify-content:center`) el conjunto se leía
"demasiado bajo" — corrimiento óptico típico de un bloque compacto en el medio exacto del alto
real del dispositivo. Se sube con `padding-top: 26vh` + `justify-content:flex-start` (nunca
tocando el centrado vía `%`, que en padding-top/bottom siempre se resuelve contra el ANCHO, no
el alto — no hubiera funcionado). Isotipo "B" 116→128px, wordmark 168→184px (agrandado
ligeramente, según lo pedido). Fondo y paleta sin cambios.

---

## 3. Pantalla inicial / Acceso

- Se retira el título "BIENVENIDO A BRAMU": el logo (ya protagonista desde V03.2) comunica la
  marca por sí solo.
- INICIAR SESIÓN / CREAR CUENTA: ya comparten tamaño/peso/tracking exactos vía la especificación
  única del §1 (antes lo lograba un override scoped, ahora es el comportamiento de base).
- "REGISTRAR PARTIDO SIN CUENTA" → **"REGISTRAR PARTIDO COMO INVITADO"**. Se retira el texto de
  apoyo ("Jugá sin crear perfil ni guardar historial.") — no hacía falta explicar de más.

---

## 4. Login

- Logo BRAMU Lab agregado, centrado, debajo de la barra de volver (nueva clase compartida
  `.brand-logo--access`, 30px de alto).
- Botón INICIAR SESIÓN: ya no sobredimensionado — reducido al estándar del §1.
- "¿Olvidaste tu contraseña?": gana aire respecto del botón principal (el link ya no se leía
  pegado/parte del botón), sin ganar protagonismo — sigue como link secundario simple.

---

## 5. Crear cuenta

- **"CREAR ACCESO" → "CREAR CUENTA"** en las 2 referencias que existían (título del header,
  `SIGNUP_STEP_TITLES` en `app.js`) — mismo nombre en todo el flujo, coherente con el botón
  CREAR CUENTA de Bienvenida.
- Mismo logo de marca que Login, mismo componente compartido, mismo patrón.
- Lógica y pasos sin cambios.

---

## 6. Familia de acceso — sin excepciones locales

El logo de marca (§4) se replica, sin variaciones, en **Recuperación/Código/Nueva contraseña**
(una sola vista con 3 pasos, `#view-forgot-password`), **Completar acceso** y **Cambiar
contraseña** — la misma familia ya auditada en V03.2 (§4 de ese consolidado). Mismos botones,
labels, inputs y spacing que ya traían desde V03.2; esta ronda solo agrega la presencia de marca
que faltaba.

---

## 7. Bottom sheet "Registrar partido"

- Se retiran los chevrons (`›`) de "Cargar mi partido jugado" y "Registrar partido en vivo": no
  aportaban (disparan la acción/nivel directamente, no son una lista de navegación con flecha
  necesaria). La clase `.sheet-option__icon` quedó huérfana y se retiró del CSS.
- Header (título + botón "×" de cierre): ya usa el mismo patrón que el resto de los sheets
  aprobados (Fecha/hora/lugar, Elegir jugador, Formato y puntuación) — auditado, correctamente
  integrado, sin cambios necesarios.
- Las dos opciones y su navegación: sin cambios.

---

## 8. Carga manual — header

**Bug de jerarquía real:** el header mostraba el estado puntual del set ("SET 1", "SET
DECISIVO", "PARTIDO COMPLETO") como si fuera el título de la pantalla — se leía raro como
título. Pasa a ser estático: **"CARGAR PARTIDO"** (la acción general; el estado específico ya
vive en el contenido, `#court-current-set-label` → "RESULTADO DEL SET N", sin cambios ahí). Se
retira `manualStateLabel()` (ya sin usos) y la línea que sobreescribía el header en
`renderManualScoreboard()`.

---

## 9. Carga manual — resultado

- **Bloque de resultado agrandado:** padding de la tarjeta 18px→22px/20px, tope de ancho de cada
  número 130→156px, tipografía del marcador 52px→60px. Mismos colores/estados (activo, vacío),
  nada de lógica tocada.
- **Bug de asociación real:** "Resultado válido" vivía dentro de la barra fija de CONTINUAR, al
  fondo de la pantalla — separado del bloque de resultado por el selector de formato y la línea
  de fecha/hora (varios cientos de píxeles en la práctica). Se mueve al flujo normal del scroll,
  inmediatamente después de `.court-current-set`. Deliberadamente **no** se puso adentro de esa
  tarjeta: V02.3 (§4) ya había encontrado que esa tarjeta se oculta por completo una vez decidido
  el partido — justo cuando el hint necesita mostrarse — así que como hermano inmediato en el
  flujo, cuando la tarjeta se oculta, el hint queda pegado debajo del marcador acumulado (que es
  "el resultado" visible en ese momento). Verificado en vivo: aparece justo debajo de los sets
  acumulados, antes del selector de formato.

---

## 10. Resumen del partido

- EDITAR PARTIDO / VOLVER AL INICIO: ya comparten EXACTAMENTE tipografía/tamaño/peso/tracking/
  altura/padding vía la especificación única del §1 (el override scoped de V02.8.1/V03.2 que
  los igualaba a mano quedó redundante y se retiró). Solo cambia la variante: azul vs. lima.
- **ELIMINAR PARTIDO:** la V03.2 lo había convertido en un botón con relleno rojo — en
  producción seguía leyéndose con protagonismo similar a los 2 CTAs de arriba. Vuelve a ser una
  acción **textual** (sin fondo/pastilla): rojo (`--danger`, el mismo de siempre, ningún color
  nuevo), centrada, sin subrayado, tipografía notoriamente más chica (12px vs. 14px de los
  botones reales) que EDITAR/VOLVER AL INICIO. Mismo modal de confirmación, misma lógica de
  borrado — sin cambios ahí.

---

## 11. Bottom sheet "Formato y puntuación"

Botón LISTO: ya usaba `.btn-start`, así que la especificación única del §1 lo redujo
automáticamente al tamaño estándar sin necesitar tocar su HTML — antes se sentía "gigante"
dentro del sheet. Las 5 opciones (Clásico/Americano/Star Point/Punto de Oro/Con ventaja): sin
cambios, no hizo falta ajustar spacing (el botón más chico deja más aire, no menos).

---

## 12. Excepciones / decisiones de criterio

- `.btn-ghost` (tercera acción de Bienvenida) y `.btn-mini` quedan fuera de la especificación
  única de botones — son componentes de otro nivel (terciario / pill compacta), no una de las 4
  familias del sistema.
- El logo de marca (§4/§6) se agregó también a Completar acceso/Cambiar contraseña, reachables
  solo con sesión activa — el consolidado pide explícitamente "misma presencia de marca... no
  crear excepciones locales" para toda la familia, sin acotar por si hay sesión o no.
- `.sheet-option__icon` y `.btn-ghost__hint` se retiraron del CSS por quedar huérfanas tras los
  cambios de HTML de arriba — limpieza directa, no una decisión de diseño nueva.

---

## 13. Tests

**722/722 en verde**, sin tests nuevos — todos los cambios son CSS, texto/clases HTML, y una
función de header que se retira (`manualStateLabel`, sin lógica de negocio: solo mapeaba estado
a un string de UI). Suite completa corrida una sola vez al cierre.

---

## 14. QA

### Mobile (375×812, dev server local)
- ✅ Splash: logo agrandado, composición subida (ya no "demasiado bajo").
- ✅ Acceso: sin "BIENVENIDO A BRAMU", INICIAR SESIÓN/CREAR CUENTA visualmente idénticos,
  "REGISTRAR PARTIDO COMO INVITADO" sin texto de apoyo.
- ✅ Login: logo agregado, botón reducido al estándar, "¿Olvidaste tu contraseña?" con aire.
- ✅ Crear cuenta: "CREAR CUENTA" en el header, logo agregado, resto del flujo (pasos 2-3, Player
  Card) sin cambios.
- ✅ Bottom sheet "Registrar partido": sin chevrons, header integrado.
- ✅ Carga manual: header "CARGAR PARTIDO" estático, bloque de resultado agrandado, "Resultado
  válido" verificado en vivo (set completo → aparece pegado debajo de los sets acumulados, antes
  del selector de formato — no al fondo de la pantalla).
- ✅ Partido completo / Continuar: verificado el flujo completo hasta Confirmar partido.
- ✅ Resumen: EDITAR PARTIDO/VOLVER AL INICIO idénticos en tamaño, ELIMINAR PARTIDO vuelto a
  acción textual roja sin fondo.
- ✅ Bottom sheet "Formato y puntuación": LISTO ya no sobredimensionado.
- Modales relacionados (confirmación de eliminar, salir sin guardar, cerrar sesión): heredan la
  misma especificación de botones automáticamente, sin regresiones — no repetido en captura
  individual, mismo mecanismo ya verificado en V03.2.

### Desktop
Chequeo visual rápido (Home, Bienvenida) — sin regresiones, misma composición centrada.

### Datos de prueba
El dev server arrancó esta ronda sin datos (localStorage vacío en el navegador usado). Se creó
una cuenta de prueba ("Qa V0321") y un partido de prueba para poder recorrer los flujos
mencionados arriba; ambos se eliminaron antes de cerrar — el dev server quedó exactamente en el
mismo estado vacío en el que empezó.

---

## 15. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.2"` → **`"BRAMUlab V03.2.1"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-2` → **`bramulab-v03-2-1`**.
- `?v=03.2` → **`?v=03.2.1`** en los 7 `<script>` + `<link rel="stylesheet">` de `index.html` y
  en `CORE_ASSETS` de `sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 16. Hash exacto y tag

- Commit de implementación (código): `fb9ca217a6a467a16d62727bed2afd866134258b`.
- Tag `BRAMUlab_V03.2.1` apunta al commit inmediatamente posterior a este informe.

---

## 17. Qué no se tocó

Home, Historial, MI PERFIL, MIS DATOS, Ranking, lógica de Nivel BRAMU, Player Intelligence,
cálculos, datos, backend, scoring, navegación estructural — sin cambios. Las opciones de
Clásico/Americano/Star Point/Punto de Oro/Con ventaja del sheet de Formato y puntuación: sin
cambios de contenido ni lógica.
