# BRAMUlab V03.2.2
## Informe — microparche visual sobre V03.2.1

**Fecha:** 09/09/2026.
**Base:** BRAMUlab V03.2.1 (commit `17a2cc9`, tag `BRAMUlab_V03.2.1`).
**Origen de esta ronda:** pedido directo del usuario en el chat (sin consolidado previo,
transcripto en `BRAMUlab_V03.2.2_Consolidado.md`) — 5 ajustes puntuales sobre Acceso, Login y
Confirmar partido, sin tocar el resto de la app.
**Estado:** publicado en producción.

---

## 1. Acceso

- `.access-actions` gap 10px → **12px**.
- `.btn-ghost` ("REGISTRAR PARTIDO COMO INVITADO"): pasa a `min-height: 48px` +
  `justify-content:center`, el mismo alto que INICIAR SESIÓN/CREAR CUENTA (antes tenía su
  propio padding vertical de 11px, pensado para cuando llevaba una segunda línea de texto de
  apoyo — retirada en V03.2.1).

## 2. Login

- `.login-forgot-link` margin-top 4px → **10px**: "¿Olvidaste tu contraseña?" ya no se lee
  pegado al botón INICIAR SESIÓN.

## 3. Confirmar partido

- **Bug real de alineación:** `.court-header--saved` usaba `justify-content:center`, que
  centraba el PAR flecha+título como grupo — la flecha quedaba flotando junto al título en vez
  de pegada al borde izquierdo (única pantalla de la app con ese defecto). Corregido con el
  mismo mecanismo ya usado en `.bottom-sheet__title` (posición absoluta, centrado respecto al
  header completo, ignora el ancho de la flecha).
- **Color del título:** `.court-header__status--saved` usaba `color: var(--brand-lime)` — único
  título de header de toda la app en lima; ningún otro (`.court-header__status`,
  `.analysis-header__title`) usa color de marca. Ahora hereda exactamente la misma tipografía
  que `.court-header__status` (blanco/`--paper`, sin reglas propias de color/tamaño/tracing).
- `.court-saved-result` padding inferior 4px → **14px**: más aire entre la pill VICTORIA y la
  tarjeta de ganadores.
- Tarjeta de fecha/hora vs. botón GUARDAR PARTIDO: **verificado en vivo con
  `getBoundingClientRect()`** — ya miden exactamente el mismo ancho (339px, mismo `x`, ambos
  `width:100%` dentro del mismo `.court-scroll`). No se encontró una diferencia real en el
  código; no se aplicó ningún cambio para este punto específico.
- `#match-saved-meta-line` margin-bottom 8px → **14px** (scoped a Confirmar partido, nunca al
  `.court-meta-line` genérico que también usa Carga manual — ahí sigue seguido de otro
  contenido, no de un botón).

---

## 4. Tests

**722/722 en verde**, sin tests nuevos — todos los cambios son CSS puro. Suite completa corrida
una sola vez al cierre.

## 5. QA

Mobile (375×812, dev server local): verificado en vivo cada uno de los 5 puntos con una cuenta
y un partido de prueba (creados y eliminados al cerrar, dev server quedó vacío como al empezar).
Capturas confirmaron: gap de Bienvenida más aire, los 3 botones a la misma altura, link de
Login separado del botón, flecha de Confirmar partido pegada al borde izquierdo, título en
blanco, más aire pill→tarjeta y tarjeta→botón.

---

## 6. PWA y versión

- `Store.VERSION`: `"BRAMUlab V03.2.1"` → **`"BRAMUlab V03.2.2"`**.
- `version.json` actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v03-2-1` → **`bramulab-v03-2-2`**.
- `?v=03.2.1` → **`?v=03.2.2`** en `index.html`/`sw.js`.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 7. Hash exacto y tag

- Commit de implementación (código): `a86c572ef70480755324e22e9b5b5830faf46a9d`.
- Tag `BRAMUlab_V03.2.2` apunta al commit inmediatamente posterior a este informe.

---

## 8. Qué no se tocó

Home, Historial, MI PERFIL, MIS DATOS, Ranking, Carga manual (salvo el scope explícito de
`#match-saved-meta-line`, que no la afecta), lógica de partido, backend, tests. Ningún layout
nuevo ni variante adicional — solo los 5 valores puntuales pedidos.
