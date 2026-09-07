# BRAMUlab V03.0
## Informe — qué se implementó, verificó y corrigió

**Fecha:** 07/09/2026.
**Base:** BRAMUlab V02.9.3 (commit `56731e4`, tag `BRAMUlab_V02.9.3`).
**Origen de esta ronda:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md` — nueva etapa de producto: identidad real del jugador (cuenta local, perfil, Player Card) antes de conectar backend/ranking real.
**Estado:** publicado en producción.

---

## 1. Auditoría previa (obligatoria por el propio consolidado, §13)

Antes de tocar código se auditó el sistema de identidad existente (`store.js`, `app.js`,
`player-home.js`) con lectura directa más un agente de exploración dedicado. Hallazgo
central, confirmado exhaustivamente: **no existía ningún id de identidad persistente** —
un jugador era, en toda la app, un string plano (`currentPlayerName`), y los partidos
guardados en `bramulab.history.v1` lo referenciaban por **igualdad exacta de nombre
normalizado**, nunca por id. Ese hallazgo definió el riesgo de migración central de toda
esta ronda: cualquier cambio de identidad que no preservara ese string, o que reemplazara
el matching por nombre sin una alternativa robusta, dejaba el historial de un jugador
huérfano de un día para el otro.

Antes de implementar se presentó un plan a Sebastián, que lo revisó y pidió 3 correcciones
de fondo sobre la primera propuesta (identidad estable por `userId` en vez de solo nombre,
Nivel BRAMU sin número simulado para cuentas nuevas, y una cuenta legacy que pueda
completar su acceso en vez de quedar atrapada) más una regla de integridad adicional
(`userId` autoritativo y exclusivo, nunca ambiguo) — todas incorporadas antes de escribir
una sola línea de código de la implementación final. El plan aprobado queda documentado
en el propio repositorio de la sesión de trabajo; este Informe describe lo que efectivamente
se implementó.

---

## 2. Arquitectura local — modelo de datos

### Claves nuevas en `bramulab/store.js`

| Clave | Contenido |
|---|---|
| `bramulab.users.v1` | Array de cuentas locales (`User`, ver abajo). |
| `bramulab.session.v1` | `{ userId }` de la sesión activa, o ausente. |

`bramulab.currentPlayerName.v1` (ya existente) se **mantiene**, pero deja de ser la fuente
de verdad de "es mi partido" — pasa a ser un valor derivado, sincronizado en cada
login/signup/logout/edición de nombre visible, que sigue alimentando los ~20 sitios de
`app.js` que solo necesitan mostrar el nombre en pantalla (nunca resolver pertenencia).

### Registro `User`

```
{ id, email, password (texto plano — ver §7 más abajo), username, firstName, lastName,
  displayName, birthDate, gender, dominantHand, preferredSide, declaredCategory,
  profilePhoto, legacyMigrated, createdAt, updatedAt }
```

### Identidad estable por `userId` (núcleo de esta versión)

- Cada jugador dentro de `match.players[]` (hoy `{id, team, name}`, con `id` un slot 0-3
  interno del partido, no de identidad) gana un campo opcional **`userId`**.
- **Regla de integridad, autoritativa y exclusiva:** si una fila de `players[]` ya tiene
  `userId`, solo una búsqueda con ESE `userId` exacto puede encontrarla — nunca cae a
  comparar por nombre, ni siquiera si el nombre coincide. Una fila sin `userId` todavía
  (partido legacy no estampado) sigue resolviendo por nombre normalizado, exactamente como
  antes de V03.0. Esto evita que dos cuentas distintas con el mismo nombre visible puedan
  "reclamarse" el historial una a la otra.
- Centralizado en una única función nueva, `player-home.js:findPlayerRow(match, identityRef)`,
  de la que pasan a depender `getPlayerTeam`, `getPartnerName` y `filterMatchesForPlayer`
  (las únicas 3 funciones que antes comparaban `p.name ===` directamente). El resto de las
  ~15 funciones del archivo (compañero/rival frecuente, rachas, Nivel BRAMU, Hitos, tabs de
  Historial, etc.) no se tocaron — todas delegan en esas 3, así que heredan el
  comportamiento sin cambios propios.
- `identityRef` acepta tanto un string plano (compatibilidad total con el comportamiento
  anterior) como un objeto `{name, userId}` — `app.js` construye este último
  (`currentIdentity()`) para los ~20 sitios que resuelven "mis partidos" (Home, Historial,
  Nivel BRAMU, Hitos, Efectividad, Racha, compañero/rival).
- **Estampado en partidos nuevos:** al finalizar un partido en vivo o guardar una carga
  manual, se resuelve la identidad de sesión **fresca desde `Store`** (nunca desde la
  variable de módulo, que podría estar desactualizada si el jugador arrancó un partido sin
  haber visitado Home todavía) y se llama `Store.stampPlayersWithUserId(players, name, userId)`.
- **Nunca ambiguo:** si más de una fila del mismo partido comparte el nombre visible y
  ninguna tiene `userId` todavía, no se tagea a ninguna — se prefiere no adivinar antes que
  asignar el mismo `userId` a dos jugadores distintos. Mismo criterio aplicado al backfill
  de migración (`Store.backfillHistoryUserId`).

**Consecuencia directa y verificada en vivo:** cambiar el "Nombre visible" desde Perfil ya
NO desvincula el historial — los partidos que ya tienen `userId` estampado siguen
resolviendo por id sin importar qué diga después el campo de nombre.

---

## 3. Migración — compatibilidad con datos existentes (consolidado §8)

`Store.migrateLegacyPlayerToUserIfNeeded()`, llamada una sola vez al boot, **antes** de
cualquier otra inicialización:

1. Si ya existe alguna cuenta (`USERS` no vacío), no hace nada — idempotente.
2. Si el dispositivo tiene un `currentPlayerName` de antes de V03.0, crea automáticamente
   una cuenta con `displayName` **idéntico, byte a byte**, al string legacy (nunca
   re-tipeado ni re-normalizado por otra vía), `username` autogenerado (slug del nombre,
   con sufijo numérico si hiciera falta para ser único), y `legacyMigrated: true`.
3. Deja esa cuenta **logueada de inmediato** — el dispositivo entra directo a Home,
   nunca ve la pantalla de Acceso.
4. Vincula por `userId` **todo el historial existente** que coincida con ese nombre
   (`Store.backfillHistoryUserId`).

Nunca toca `PLAYER_NAMES` ni `ACTIVE_MATCH`. Verificado en vivo sobre el dispositivo de
desarrollo real (que ya tenía 2 partidos cargados bajo el nombre "Seba"): tras el primer
arranque post-actualización, se creó exactamente 1 cuenta (`legacyMigrated:true`, sin
email), sesión activa apuntando a ella, y los 2 partidos existentes quedaron con `userId`
estampado en la fila de "Seba" — Home mostró el mismo Nivel BRAMU (5.0) e historial de
siempre, sin fricción ni pantalla de signup.

### Cuenta legacy — nunca atrapada sin acceso (corrección pedida en revisión)

La cuenta migrada nace sin email/contraseña ("acceso pendiente de completar" — la condición
es simplemente `!user.email`). Perfil muestra un aviso con botón **COMPLETAR ACCESO** que
agrega email+contraseña a la MISMA cuenta (nunca crea una segunda). "Cerrar sesión", mientras
el acceso siga incompleto, muestra una advertencia antes de confirmar — nunca se ofrece
"crear otra cuenta con el mismo nombre" como mecanismo de recuperación (contradiría la regla
de exclusividad de `userId`: esa cuenta ya tiene su historial estampado con su propio id,
una cuenta nueva con otro id nunca podría reclamarlo por nombre). Este flujo se probó de
punta a punta: completar acceso → cerrar sesión sin advertencia → iniciar sesión con las
credenciales nuevas → misma cuenta, mismo historial.

---

## 4. Flujo implementado

**Acceso** (reemplaza el modal "¿Quién sos?"): logo + INICIAR SESIÓN / CREAR CUENTA,
mismo lenguaje visual oscuro/lima/cian que el resto de la app.

**Crear cuenta — 3 pasos en una sola vista** (mismo patrón que ya usa `view-manual-load`:
estado interno manejado por JS, sin pasar por el router de vistas entre pasos), con
indicador de progreso de 3 puntos:
- **Paso 1 — Crear acceso:** email, contraseña, repetir. Validación de email, de
  duplicado, y checklist de fuerza de contraseña en vivo (mayúscula/minúscula/número/
  símbolo/8+ caracteres, cada regla pasa a lima al cumplirse).
- **Paso 2 — Tu identidad:** foto opcional (circular, recortada/comprimida a ~256px antes
  de guardar — nunca el archivo original completo en localStorage), nombre, apellido,
  @usuario (sugerido automáticamente a partir de nombre/apellido mientras no se toque a
  mano, con feedback en vivo "Disponible"/"Ya está en uso"), nombre visible — separado del
  @usuario, tal como pide el consolidado.
- **Paso 3 — Tu pádel:** fecha de nacimiento (calcula edad), género, mano hábil, lado
  habitual, categoría declarada (con "No sé mi categoría" como escape explícito).

**TU JUGADOR ESTÁ LISTO** — Player Card ("ficha deportiva", tratamiento visual
aspiracional, borde con glow lima) con avatar/nombre visible/@usuario/edad/mano/lado/
categoría y NIVEL BRAMU · CALIBRANDO · 0/5 PARTIDOS. CTA "ENTRAR A BRAMU" → Home.

**Iniciar sesión:** email + contraseña, error genérico si falla, logueado si coincide.

**Perfil**, extendido in-place (no rehecho): avatar/nombre visible/@usuario editables solo
vía un modal de edición nuevo (nunca inline); filas de solo lectura para nombre y apellido,
fecha de nacimiento/edad, género, mano hábil, lado habitual, categoría declarada. Nivel
BRAMU/mejor nivel/ranking/partidos/victorias/efectividad **no aparecen** en la edición — son
computados, no editables (consolidado §5). Foto: agregar/reemplazar/quitar, con fallback a
iniciales al quitarla.

---

## 5. Nivel BRAMU — calibración (corrección pedida en revisión)

- **Cuentas legacy migradas:** sin ningún cambio — siguen viendo el número simulado de
  siempre, tanto en Home como en la tarjeta "Evolución del Nivel BRAMU" de Perfil.
- **Cuentas nuevas V03.0:** nunca ven un número — la fórmula real todavía no existe.
  0-4 partidos considerados → "CALIBRANDO" + "X / 5 PARTIDOS"; al llegar a 5,
  "CALIBRACIÓN COMPLETA" de forma permanente en esta versión (nunca revierte a un número).
  El mismo gate se aplicó también a la tarjeta de Evolución de Perfil (diferencia
  justificada frente al consolidado, ver §7) para no dejar dos pantallas — que comparten la
  misma fuente de datos — mostrando estados contradictorios.
- `PH.computeLevelEvolution`/`isMatchConsideredForLevel` no se tocaron — se reusan tal
  cual; la única pieza nueva es `PH.buildCalibrationStatus(consideredCount)`, aislada y
  reemplazable el día que exista la fórmula real.

---

## 6. Seguridad — prototipo local (consolidado §7)

`password` se guarda en **texto plano** en `localStorage`, explícitamente marcado así en
el código (`store.js`) con un comentario que documenta: es un prototipo local, sin
servidor real, nunca se transmite a ningún lado; en cuanto exista Auth real este campo se
elimina por completo; **no se construyó ninguna criptografía casera como parche** —
decisión tomada tal como la pide el propio consolidado, no un descuido.

---

## 7. Diferencias justificadas respecto del consolidado

1. **Identidad por `userId`, no solo por nombre** — el consolidado §7/§8 pedía "elegir la
   solución más simple y segura" sin especificar el mecanismo; la auditoría previa mostró
   que depender solo del nombre (como en la primera propuesta de plan) dejaba el
   renombrado de Perfil como una operación destructiva silenciosa. Sebastián pidió esta
   corrección explícitamente antes de implementar — documentada en detalle en §2 de este
   informe.
2. **Nivel BRAMU sin número simulado para cuentas nuevas** — el consolidado §4 mencionaba
   "CALIBRANDO" solo para el Home; se generalizó a "nunca asignar ese sistema
   automáticamente a nuevos jugadores V03.0" (frase del propio pedido de corrección),
   extendiendo el mismo gate a la tarjeta de Evolución de Perfil por consistencia — ambas
   pantallas comparten la misma fuente de datos (`computeLevelEvolution`).
3. **Cuenta legacy que puede completar su acceso** — no estaba en el consolidado original;
   Sebastián lo pidió para que la migración automática nunca deje a un dispositivo sin
   forma de volver a entrar a su propio jugador.
4. **Opciones de Género** (no enumeradas en el consolidado): Femenino / Masculino / Otro /
   Prefiero no decir.
5. **Longitud mínima de contraseña** ("razonable", sin número exacto): 8 caracteres,
   constante exportada (`PLIdentity.PASSWORD_MIN_LENGTH`), fácil de cambiar sin tocar lógica.
6. **Campos del Paso 3** tratados como obligatorios para llegar a "CREAR MI JUGADOR"
   (Categoría y Género ya tienen su propia opción de escape, así que ningún campo real
   queda sin poder completarse).

Nada de lo anterior toca las secciones explícitamente fuera de alcance (§11 del
consolidado): sin backend, sin Supabase/Firebase, sin ranking real, sin AJPP, sin
autotest de categoría, sin rediseños de Home/Historial no pedidos. El sistema "Agregar a
X" (jugadores sin cuenta, §9) queda exactamente como estaba — esos jugadores nunca
reciben `userId`.

---

## 8. Tests

**650/650 tests OK** (baseline 571 + 79 nuevos), corridos en `bramulab/tests.html` vía
navegador. Casos nuevos, agrupados:

- **`player-identity.js` (puro):** formato de email, fuerza de contraseña (las 5 reglas
  por separado), coincidencia de contraseñas, slugify de @usuario (acentos/espacios),
  formato y unicidad de @usuario, sugerencia con sufijo numérico, cálculo de edad
  (incluido el borde exacto del cumpleaños).
- **Identidad estable por `userId` (`player-home.js`, puro):** regresión de que un string
  plano se comporta exactamente igual que antes; fallback por nombre para filas legacy sin
  id; **rename-safety** (encuentra un partido por `userId` aunque el nombre guardado ya no
  coincida con el displayName actual — la prueba directa del pedido de Sebastián); regla de
  exclusividad (dos filas con el mismo nombre visible y distinto `userId` nunca se
  "cruzan"; un `userId` que no existe en el partido nunca cae a nombre).
- **Estampado sin ambigüedad (`store.js`, puro):** candidato único se tagea; nombre
  duplicado sin estampar no tagea a ninguno; con un candidato ya estampado por otra cuenta,
  el estampado sí tagea correctamente al único libre. Mismos casos para
  `backfillHistoryUserId` a nivel de una entrada completa de Historial.
- **Calibración (`PH.buildCalibrationStatus`, puro):** bordes 0/4/5/12 partidos.
- **Cuentas/sesión (`store.js`, único bloque que toca `localStorage` real — con snapshot y
  restauración automática de las claves afectadas para no interferir con datos reales del
  mismo origen):** alta, login correcto/incorrecto (email inexistente vs. contraseña
  incorrecta), `logoutSession` no toca Historial/nombres recordados, migración con
  backfill real, migración idempotente, completar acceso de una cuenta legacy.

---

## 9. Validación manual — mobile y desktop

Recorrido completo en el navegador (viewports 375×812 y desktop), servido localmente vía
`.claude/dev-server.py` (el mismo servidor de desarrollo que ya usaba el repositorio) sobre
el dispositivo de desarrollo real, que ya tenía datos de prueba genuinos:

- **A. Primer acceso con datos legacy reales:** el dispositivo con `currentPlayerName:
  "Seba"` y 2 partidos previos arrancó directo en Home, con Nivel BRAMU 5.0 y el historial
  intacto — la migración corrió sola, sin pedir nada.
- **B. Perfil de la cuenta migrada:** avatar con inicial, @seba, aviso "ACCESO PENDIENTE DE
  COMPLETAR" visible, campos de identidad vacíos (—) tal como corresponde a una cuenta sin
  esos datos todavía.
- **C. Completar acceso:** email + contraseña con checklist de fuerza en vivo → guardado →
  aviso desaparece → misma cuenta (mismo id).
- **D/J. Cerrar sesión / Iniciar sesión:** sin advertencia (ya con acceso completo);
  credenciales incorrectas → error; credenciales correctas → misma sesión restaurada.
- **K. Editar perfil, con renombrado:** cambiar nombre y apellido, **Nombre visible de
  "Seba" a "Sebastián Vila"**, fecha de nacimiento, género, mano hábil, lado habitual,
  categoría → guardado correcto.
- **L. Comprobación central:** tras el renombrado, Home siguió mostrando "2 partidos en tu
  historia" y Nivel BRAMU 5.0 sin cambios; Historial siguió mostrando VICTORIA/DERROTA en
  ambos partidos — la pertenencia se resolvió por `userId`, no por el nombre ya cambiado.
- **B/C/D (signup).** Crear cuenta nueva completa (email/contraseña con checklist en vivo,
  @usuario autogenerado desde nombre/apellido con feedback "Disponible"/"Ya está en uso" al
  chocar contra uno existente, foto omitida) → **Player Card** con avatar/edad calculada
  correctamente (23 años desde una fecha de nacimiento de 2002)/mano/lado/categoría y
  "CALIBRANDO · 0/5 PARTIDOS" → **ENTRAR A BRAMU** → Home mostrando el mismo estado de
  calibración (nunca un número) en la Tarjeta de jugador, y el mismo gate en la tarjeta de
  Evolución de Perfil.
- **G/H.** Carga manual de un partido nuevo para la cuenta recién creada (selección de
  compañero/rivales entre jugadores existentes, carga de sets, confirmación y guardado) →
  el jugador logueado quedó estampado con su `userId` en el partido nuevo; los 3 jugadores
  sin cuenta (compañero y rivales) quedaron sin `userId`, exactamente como especifica §9 del
  consolidado. Home pasó a mostrar "1 / 5 PARTIDOS".
- Verificado en desktop (viewport ancho) que Acceso/Signup/Player Card/Perfil no rompen
  layout ni desbordan — mismo patrón responsive de columna centrada que ya usaba el resto
  de la app.

**Nota de higiene:** las cuentas y el partido creados durante esta validación (incluida la
cuenta de prueba "Martina Gómez"/@martina-gomez y el renombrado temporal de "Seba") se
revirtieron al terminar la prueba — el dispositivo de desarrollo quedó exactamente con los
2 partidos y el nombre "Seba" originales, ahora ya migrados a cuenta (efecto esperado y
correcto de V03.0, no un artefacto de la prueba).

---

## 10. PWA, versión y publicación

- `Store.VERSION`: `"BRAMUlab V02.9.3"` → **`"BRAMUlab V03.0"`**.
- `version.json`: actualizado en paralelo.
- `sw.js`: `CACHE_NAME` `bramulab-v02-9-3` → **`bramulab-v03-0`**; `CORE_ASSETS` suma
  `./player-identity.js` (archivo nuevo, si no el service worker nunca lo precachearía).
- **Commit de implementación (código):** `10aa507`.
- **Push:** a `main` → despliegue automático en GitHub Pages.
- **URL publicada:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/

## 11. Hash exacto y tag

- Commit de implementación (código): `10aa507130c3e612a95ee690710eb25468ca96e6`.
- Commit de este informe: *(se agrega en el próximo commit)*.
- Tag `BRAMUlab_V03.0` apuntará al commit inmediatamente posterior a este.

---

## 12. Qué no se tocó

Backend, Supabase/Firebase, ranking real, fórmula de nivel oficial, AJPP, autotest de
categoría, amigos/grupos/búsqueda online, recuperación real de contraseña, verificación de
email, login Google/Apple/SMS, Player Intelligence, BRAMU Intelligence, Ranking (placeholder
sin cambios), el sistema "Agregar a X" de jugadores sin cuenta, y ningún rediseño de
Home/Historial más allá de lo descripto arriba (sub-label de calibración, gate de Evolución).
