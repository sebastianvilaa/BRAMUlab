# Reporte BRAMUlab V03.6 — para pasar a ChatGPT

Este documento lo armó Claude Code (el asistente que trabaja directo sobre la computadora y
el repositorio) para que Sebastián se lo pase a ChatGPT como contexto operativo de esta ronda.
No repite la especificación completa — eso vive en `BRAMUlab_V03.6.md`, en esta misma carpeta —
solo resume qué se hizo realmente, cómo se adaptó a la arquitectura existente, y en qué estado
quedó publicado.

**Link para revisar la app en vivo:** https://sebastianvilaa.github.io/BRAMUlab/bramulab/
**Repositorio de código (GitHub):** https://github.com/sebastianvilaa/BRAMUlab
**Commit de esta ronda:** [`10a05ce`](https://github.com/sebastianvilaa/BRAMUlab/commit/10a05cea8f2a35be88911bfd2a0075fd5d06fa7b)
**Tag:** `BRAMUlab_V03.6`
**Base:** `BRAMUlab_V03.5.2`
**Documento fuente:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.6.md`

---

## 1. Qué se implementó

El frente completo de contacto entre jugadores por WhatsApp, exactamente como lo describe
`BRAMUlab_V03.6.md`, sin recortes de alcance:

- **Dos campos nuevos en el Usuario**: `phone` (string, se guarda tal cual lo tipeó el
  usuario) y `allowWhatsAppContact` (booleano, `false` por defecto SIEMPRE — cargar un
  teléfono nunca infiere consentimiento).
- **Edición en Mis datos → Editar Datos**, sección "CONTACTO": campo de teléfono con
  placeholder en formato internacional recomendado (`+54 9 11 1234 5678`) + un switch on/off
  ("Permitir que otros jugadores me contacten por WhatsApp") con su microcopy de privacidad.
  Es el primer control booleano de la app — no existía ningún componente de switch todavía,
  se construyó uno mínimo (pastilla + círculo, mismos tokens de color que el resto).
- **Bloqueo del switch al activarlo sin teléfono válido**: si se toca el switch para
  encenderlo y el campo está vacío o el número es claramente inválido, el switch NO se
  enciende y aparece un mensaje inline ("Para activar el contacto, cargá primero un número de
  WhatsApp válido.") — nunca se descubre recién al tocar GUARDAR. Apagarlo, en cambio, siempre
  está permitido sin condición (la revocación no tiene barrera).
- **Red de seguridad en el submit**: si el switch quedó encendido y el usuario borra o
  invalida el teléfono después (sin volver a tocar el switch) y presiona GUARDAR, el envío se
  bloquea con el mismo mensaje — nunca queda guardado un estado inconsistente (consentimiento
  `true` sin teléfono válido).
- **Mis datos (solo lectura)**: nueva tarjeta "CONTACTO" mostrando el WhatsApp cargado y si el
  contacto está Activado/Desactivado — mismo patrón de las demás tarjetas de esa pestaña.
- **Perfil público**: botón "CONTACTAR POR WHATSAPP" — visible únicamente si la cuenta tiene
  teléfono válido Y consentimiento `true` (ambas condiciones a la vez, nunca una sola).
  Visualmente secundario (`.btn-secondary--lime`, el mismo estilo ya usado para "CREAR
  GRUPO"), ubicado justo arriba de "AGREGAR JUGADOR" — nunca compite con identidad/Nivel. El
  número de teléfono nunca se imprime en ningún lado de esta pantalla.
- **Deep link `wa.me`**: un solo toque abre `https://wa.me/<dígitos>?text=<mensaje
  URL-encoded>`, sin modal de confirmación previo. Mensaje fijo: "Hola, te encontré en
  BRAMUlab. ¿Te interesaría organizar un partido de pádel?" — nunca se le agrega Nivel,
  localidad, nombre completo, horario ni cancha.
- **Normalización de teléfono**: quita espacios, guiones, paréntesis y el prefijo `+`, deja
  solo dígitos — usada exclusivamente para armar el deep link y para validar (mínimo 8, máximo
  15 dígitos, sin resolver telefonía internacional real). El dato guardado en la cuenta
  conserva el formato tal como lo escribió el usuario (para que lo siga reconociendo si vuelve
  a editarlo).

No se implementó (ni se tocó) nada de lo explícitamente excluido: chat interno, inbox,
notificaciones de mensajes, invitaciones, matchmaking, agenda, favoritos, WhatsApp Business
API, envío desde servidor, confirmación de lectura, bloqueo/reportes, backend, ni rediseño
general de Perfil.

---

## 2. Archivos tocados

- `bramulab/player-identity.js` — 4 funciones puras nuevas: `normalizePhoneForWhatsApp`,
  `isValidWhatsAppPhone`, `canContactViaWhatsApp`, `buildWhatsAppContactUrl`. Sin DOM, sin
  Store — mismo criterio que el resto del módulo (recibe el objeto `user`/el teléfono como
  parámetro, nunca lee storage directo).
- `bramulab/store.js` — `phone`/`allowWhatsAppContact` agregados a `createUserAccount`
  (defaults `null`/`false`); `updateUserAccount` no necesitó cambios (ya mergea cualquier
  patch genérico). Bump de versión (`APP_VERSION` → `BRAMUlab V03.6`).
- `bramulab/index.html` — sección CONTACTO en Editar Datos (input + switch + mensaje inline);
  tarjeta CONTACTO de solo lectura en Mis Datos; botón "CONTACTAR POR WHATSAPP" en Perfil
  público. Bump de cache-bust (`?v=03.6` en los 11 scripts/estilo propios).
- `bramulab/app.js` — estado del formulario (`profileEditAllowWhatsApp`), precarga/reset en
  `openProfileEditModal`, wiring del switch e input en `initProfileEditModal`, validación en
  el submit, patch de guardado, render de la tarjeta de solo lectura en `renderProfileView`,
  render condicional + wiring de click del botón público en `renderPlayerPublicProfile`/
  `initPlayerPublicScreen`, constante `WHATSAPP_CONTACT_MESSAGE`.
- `bramulab/styles.css` — componente `.toggle-switch` (nuevo, primer switch de la app) +
  `.profile-toggle-row`; `.player-public-whatsapp-btn` (reutiliza `.btn-secondary--lime`).
- `bramulab/sw.js` — `CACHE_NAME` y `CORE_ASSETS` actualizados al mismo `?v=03.6`.
- `bramulab/version.json` — `"BRAMUlab V03.6"`.
- `bramulab/tests.html` — 30 aserciones nuevas (PLIdentity, puras) + 1 bloque nuevo con el
  patrón snapshot/restore de `localStorage` (Store real).

---

## 3. Adaptaciones respecto del documento

- **Ubicación de la tarjeta CONTACTO en Mis Datos**: el documento no especifica dónde
  exactamente debe vivir la vista de solo lectura (solo dice que la *edición* va en Mis
  Datos/Editar Datos). Se agregó como una tarjeta propia entre "DATOS PERSONALES /
  DEPORTIVOS" y "ACCESO Y SEGURIDAD" — mismo patrón `.pastilla.profile-group` que ya usan
  esas dos, sin inventar un layout nuevo.
- **El teléfono se guarda tal cual lo escribió el usuario, no normalizado a solo dígitos.**
  El documento dice "almacenar normalizado cuando sea posible" pero también dedica una
  sección completa (§7) a aclarar que la normalización es "para el deep link" — se interpretó
  que el campo guardado conserva el formato reconocible por el usuario (con espacios/`+`) y
  la normalización a dígitos ocurre solo al construir la URL `wa.me`, nunca al guardar. Esto
  evita que alguien vea su propio número desfigurado ("5491112345678") la próxima vez que
  entra a editarlo.
- **Botón de contacto con estilo `.btn-secondary--lime` (outline lima)**, no un verde
  "WhatsApp" nuevo. El documento pide "visualmente secundaria... pero suficientemente
  visible" — se reutilizó el mismo estilo que ya usa "CREAR GRUPO" (acción positiva,
  secundaria) en vez de introducir un color de marca de terceros, siguiendo el criterio ya
  establecido en rondas anteriores de nunca hardcodear colores fuera del sistema de tokens de
  la app.
- **Validación bloqueante en el switch, no solo al guardar.** El documento describe el caso C
  ("consentimiento ON sin número: no permitir guardar/activar") de forma ambigua entre
  bloquear al tocar el switch o solo al guardar — se implementaron AMBAS: el switch se niega a
  encenderse sin teléfono válido (feedback inmediato) y el submit revalida por si el teléfono
  se invalida después de activarlo sin volver a tocar el switch.

Ninguna de estas adaptaciones cambia el comportamiento funcional pedido — son decisiones de
detalle no explicitadas en el documento, resueltas con el mismo criterio ya usado en el resto
de la app.

---

## 4. Bugs encontrados

Ninguno. Al ser una funcionalidad nueva y aislada (no modifica lógica de partidos, Nivel,
Ranking ni Intelligence), no hubo comportamiento preexistente que corregir. El único hallazgo
del proceso fue de higiene de QA, no de producto: el wizard de alta de cuenta usada para
probar (paso 3, Género/Categoría) valida en el evento `input` de los `<select>`, no `change`
— relevante solo para simular el flujo por script, sin impacto real para un usuario tocando
la UI normalmente.

---

## 5. Tests

30 aserciones nuevas en `tests.html`, todas sobre lógica nueva:

- **Normalización** (`V036-NORM`, 6): espacios, guiones, paréntesis, prefijo `+`, vacío y
  `null` → `null`.
- **Validación** (`V036-VALID`, 6): formato internacional completo válido, número local de
  8+ dígitos válido, vacío/corto/largo/sin dígitos inválidos.
- **Visibilidad del contacto** (`V036-VISIBLE`, 5): cubre los 4 casos del documento (B — solo
  teléfono, C — solo consentimiento, D — teléfono inválido, F — sin cuenta) más el caso A
  (ambas condiciones, visible).
- **Revocación** (`V036-REVOCAR`, 2): el mismo objeto, antes y después de apagar el
  consentimiento — visible → oculto de inmediato.
- **Deep link** (`V036-LINK`, 4): host `wa.me` correcto, teléfono normalizado a solo dígitos,
  mensaje URL-encoded, `null` con teléfono inválido/vacío.
- **Consentimiento `false` por defecto** (`V036-DEFAULT`/`V036-UPDATE`, 7, con snapshot/
  restore real de `localStorage` — único bloque de esta ronda que toca Store real): cuenta
  nueva sin `phone` ni `allowWhatsAppContact` en los fields arranca en `null`/`false`; cargar
  un teléfono en el alta no infiere consentimiento; `updateUserAccount` activa/revoca
  correctamente y revocar no borra el teléfono ya guardado (§4 del documento, explícito).

**Resultado final: 977/977 tests OK** (947 antes de esta ronda + 30 nuevas), suite completa
corrida una sola vez al final como pidió la ronda (Store/Perfil son módulos compartidos).

---

## 6. QA realizado

Mobile (375px) primero, con dos cuentas reales creadas para el flujo (una no puede verse a sí
misma en Buscar Jugadores — exclusión ya existente y correcta — así que hizo falta una
segunda cuenta para verificar el Perfil público):

- cargar teléfono, activar consentimiento sin teléfono (bloqueado con mensaje inline),
  cargar teléfono válido, activar consentimiento (switch enciende) — verificado con
  screenshots en cada paso;
- GUARDAR persiste ambos campos; Mis Datos muestra "WhatsApp: 11 2345 6789" / "Contacto por
  WhatsApp: Activado";
- desde una segunda cuenta, Buscar Jugadores → Perfil público de la primera: botón
  "CONTACTAR POR WHATSAPP" visible, sin el número impreso en ningún lado;
- deep link verificado interceptando `window.open` (el entorno de prueba bloquea popups
  reales por seguridad, esperado): URL exacta `https://wa.me/1123456789?text=Hola%2C%20te...`
  — teléfono normalizado, mensaje correctamente encoded;
- revocar el consentimiento → el botón desaparece de inmediato al reabrir el Perfil público,
  sin placeholder ni mensaje de "no acepta mensajes" (caso F/E, tal como pide el documento);
- tablet (768px): formulario y switch se ven correctamente, sin desbordes ni recortes.

**Regresión focal:** Mi Perfil, Mis Datos (identidad, datos personales, acceso y seguridad),
Perfil público (identidad, efectividad, mejor racha/nivel, agregar jugador), Buscar Jugadores
— todo sin cambios de comportamiento fuera de lo agregado. No se tocó Ranking, Nivel, BRAMU
Intelligence ni lógica de partidos (verificado por lectura de diff, cero líneas tocadas en
`ranking.js`/`stats.js`/`engine.js`/`match-load.js`).

Las dos cuentas de prueba locales se descartaron al final (limpieza completa de
`localStorage` del servidor de desarrollo).

---

## 7. Commit, tag, push, deploy

Un solo commit: [`10a05ce`](https://github.com/sebastianvilaa/BRAMUlab/commit/10a05cea8f2a35be88911bfd2a0075fd5d06fa7b)
(implementación completa + el documento operativo `BRAMUlab_V03.6.md`), excluyendo el trabajo
paralelo no relacionado presente en el árbol de trabajo (`BRAMU_Intelligence*`, `Referencias/`,
`Backup/`, `Logo.ai`, el reporte de V03.5.1). Tag `BRAMUlab_V03.6` sobre ese mismo commit. Push
a `origin/main` y al tag.

**Deploy verificado en producción real** (no solo local): GitHub Pages tardó
aproximadamente 1-2 minutos en servir el nuevo `index.html`/assets después del push (demora ya
documentada en rondas anteriores). Se confirmó:

- `version.json` en producción responde `"BRAMUlab V03.6"`;
- los 11 assets propios se sirven con `?v=03.6`;
- `Store.VERSION` en la página en vivo es `"BRAMUlab V03.6"`, sin errores de consola nuevos;
- las 4 funciones de `PLIdentity` existen y funcionan en el bundle real desplegado;
- **flujo completo probado en producción** con las cuentas de prueba `Prod Check`/`Prod Check
  Dos` ya existentes en ese navegador (de una verificación anterior, no de esta ronda): activar
  contacto, ver el botón desde otra cuenta vía Buscar Jugadores, deep link `wa.me` correcto,
  revocar y confirmar que el botón desaparece. Se dejaron esas dos cuentas restauradas a su
  estado original (`phone: null`, `allowWhatsAppContact: false`) al terminar;
- se disparó y se resolvió correctamente el aviso real "HAY UNA NUEVA VERSIÓN DE BRAMU —
  BRAMUlab V03.6 está disponible" al navegar con un `index.html` cacheado por el navegador,
  confirmando que el mecanismo de actualización de V03.1.6 sigue funcionando con este release.

---

## 8. URL publicada

https://sebastianvilaa.github.io/BRAMUlab/bramulab/

---

## 9. Limitaciones conocidas

- **Validación de teléfono es deliberadamente simple** (8-15 dígitos, sin distinguir código de
  país): un número con la cantidad correcta de dígitos pero mal formado (ej. país equivocado)
  no se detecta — el documento pide explícitamente no resolver telefonía internacional real en
  esta ronda.
- **Sin backend**: todo el mecanismo (privacidad, consentimiento) es una convención de UI en
  este prototipo local — el documento ya aclara que la separación conceptual entre dato
  privado/acción pública queda preparada para un backend real, no implementada ahora.
- **`rankingLocalZone`/campos de Ranking no interactúan con esto** — contacto por WhatsApp es
  completamente independiente del sistema de Ranking BRAMU (a propósito, sin tocar esa lógica).

---

## 10. Decisiones pendientes

Ninguna decisión de producto quedó abierta dentro del alcance de V03.6 — el documento no dejó
ambigüedad relevante para el usuario final más allá de los tres detalles de implementación
descriptos en la §3 (adaptaciones), que no cambian el comportamiento visible ni requieren
confirmación adicional.

**Próximo paso, según instrucción explícita de esta ronda:** prueba visual/real de Sebastián
sobre este release; si queda bien, consolidar V03. No se avanza a Nivel BRAMU V04 sin esa
validación.
