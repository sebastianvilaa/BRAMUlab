# BRAMUlab V03.6 — Contacto entre jugadores por WhatsApp

**Estado:** CERRADA (ver §19 — cierre final post-QA)  
**Base:** BRAMUlab V03.5.2 cerrada funcionalmente para Ranking  
**Objetivo:** agregar un mecanismo simple de contacto entre jugadores desde el Perfil público, usando WhatsApp, sin convertirlo en un sistema de mensajería propio.

---

## 1. Objetivo de V03.6

Permitir que un jugador pueda ser contactado por otro usuario de BRAMUlab para organizar un partido, con una experiencia simple y controlada.

V03.6 NO crea chat interno, inbox, matching automático ni sistema de invitaciones.

La lógica es:

1. el jugador decide si quiere ser contactado;
2. carga un teléfono;
3. BRAMUlab no muestra ese teléfono en público;
4. desde el Perfil público aparece un botón de contacto;
5. al tocarlo, se abre WhatsApp con un mensaje prearmado.

---

## 2. Principio de privacidad

El teléfono debe tratarse como dato privado de cuenta.

### Reglas

- El número NO debe mostrarse como texto público por defecto.
- El contacto solo debe estar disponible si el jugador dio consentimiento explícito.
- El consentimiento puede revocarse.
- Si el usuario desactiva el consentimiento, el botón deja de mostrarse inmediatamente.
- El otro jugador nunca necesita copiar/ver el número para iniciar el contacto.
- V03.6 puede resolverse localmente en prototipo, pero la separación conceptual entre dato privado y acción pública debe quedar preparada para backend real.

---

## 3. Datos nuevos

Agregar al perfil/cuenta:

- `phone`
- `allowWhatsAppContact`

### `phone`

- string;
- obligatorio solo si `allowWhatsAppContact = true`;
- almacenar normalizado cuando sea posible;
- para Argentina, aceptar número escrito por el usuario y preparar una normalización simple para deep link;
- no mezclar este campo con nombre, username o datos deportivos.

### `allowWhatsAppContact`

Booleano:

- `false` por defecto;
- el usuario debe activarlo explícitamente;
- no inferir consentimiento porque haya cargado un número.

---

## 4. Ubicación de edición

La edición debe vivir en **Mi Perfil / Mis datos**, no en el Perfil público.

Propuesta UX:

### CONTACTO

**WhatsApp**  
`[ número de teléfono ]`

Control:

`Permitir que otros jugadores me contacten por WhatsApp`

Microcopy:

`Tu número no se muestra públicamente. Solo se usa para abrir WhatsApp cuando otro jugador toca “Contactar”.`

Si el control está apagado:
- el teléfono puede quedar guardado;
- no hay botón público.

Si se intenta activar sin teléfono válido:
- indicar que primero debe completar un número válido.

No crear una pantalla nueva si puede integrarse limpiamente en Mis datos.

---

## 5. Perfil público

Si el jugador tiene:

- `allowWhatsAppContact = true`
- teléfono válido

mostrar acción:

**Contactar por WhatsApp**

Ubicación:
- cerca de las acciones principales del Perfil público;
- visualmente secundaria respecto de identidad/Nivel;
- suficientemente visible para que el propósito social se entienda.

No mostrar el número como texto.

Si no hay consentimiento o falta teléfono:
- no mostrar botón;
- no mostrar placeholder ni mensaje de “no acepta mensajes”.

---

## 6. Deep link

Al tocar `Contactar por WhatsApp` abrir:

`https://wa.me/<telefono_normalizado>?text=<mensaje_codificado>`

Mensaje inicial V1:

`Hola, te encontré en BRAMUlab. ¿Te interesaría organizar un partido de pádel?`

El mensaje debe ir correctamente URL-encoded.

No agregar automáticamente:
- Nivel;
- localidad;
- nombre completo;
- horario;
- cancha;
- links extras.

Mantenerlo simple y no invasivo.

---

## 7. Normalización de teléfono

Objetivo V03.6: suficiente para prototipo, sin resolver telefonía internacional completa.

Reglas mínimas:

- eliminar espacios;
- eliminar `-`;
- eliminar paréntesis;
- eliminar prefijo `+` al construir `wa.me`;
- conservar solo dígitos para el deep link.

Preferir que el usuario cargue formato internacional.

Placeholder:

`+54 9 11 1234 5678`

Validación simple:
- cantidad mínima razonable de dígitos;
- impedir activar contacto con campo vacío o claramente inválido.

No implementar una librería internacional de telefonía en esta ronda.

---

## 8. Estados y casos

### A — Contacto habilitado
Teléfono válido + consentimiento ON:
- botón visible;
- abre WhatsApp.

### B — Número cargado, consentimiento OFF
- botón público oculto.

### C — Consentimiento ON sin número
- no permitir guardar/activar;
- feedback claro.

### D — Número inválido
- feedback claro;
- no mostrar botón público.

### E — Revocación
- el botón desaparece inmediatamente.

### F — Perfil sin contacto
- Perfil público funciona igual que hoy;
- no mostrar nada adicional.

---

## 9. UX y tono

Debe sentirse como una utilidad social simple.

Evitar:
- textos legales largos;
- lenguaje alarmista;
- iconografía exagerada;
- modal de confirmación cada vez que se toca WhatsApp.

El consentimiento se resuelve en configuración; después el contacto debe ser de un toque.

---

## 10. Seguridad / privacidad futura

En backend real:

- el teléfono no debe exponerse indiscriminadamente como campo público;
- el servidor deberá respetar `allowWhatsAppContact`;
- cambios de consentimiento deberían poder auditarse;
- considerar rate limiting/abuso más adelante.

Eso NO se implementa ahora.

---

## 11. No hacer en V03.6

No implementar:

- chat interno;
- inbox;
- notificaciones de mensajes;
- invitaciones formales a partidos;
- matchmaking;
- agenda;
- favoritos/contactos;
- WhatsApp Business API;
- envío de mensajes desde servidor;
- confirmación de lectura;
- bloqueo/reportes nuevos;
- backend;
- validación multiusuario real;
- rediseño general de Perfil.

---

## 12. Implementación sobre prototipo

Mantener la arquitectura actual.

Agregar únicamente lo necesario en:

- modelo/store de usuario;
- edición en Mis datos;
- render de Perfil público;
- helper de deep link/normalización;
- estilos mínimos.

No tocar Ranking, Nivel, Intelligence ni lógica de partidos.

---

## 13. Tests

Agregar tests focales solo para lógica nueva:

- normalización de teléfono;
- consentimiento `false` por defecto;
- contacto visible solo con teléfono válido + consentimiento `true`;
- generación correcta del deep link;
- revocación del consentimiento oculta contacto.

No testear CSS.

Suite completa una sola vez al final porque se toca Store/perfil compartido.

---

## 14. QA

### Mobile primero
- editar teléfono;
- activar/desactivar consentimiento;
- validación;
- Perfil público;
- botón WhatsApp;
- abrir deep link;
- volver a la app.

### Tablet/Desktop
Chequeo rápido de:
- formulario;
- botón;
- jerarquía visual.

### Regresión focal
- Mi Perfil;
- Mis datos;
- Perfil público;
- Buscar jugadores;
- Ranking → Perfil público → volver.

---

## 15. Documentación y consumo

Esta ronda debe ser liviana.

Claude NO necesita releer documentación histórica de Ranking/Nivel/Intelligence.

Fuentes suficientes:

1. este documento;
2. código actual de Perfil/Mis datos/Store;
3. si realmente hace falta, el reporte final de V03.5.2 únicamente para conocer el estado publicado.

Evitar lecturas masivas del repo/documentación.

---

## 16. REPORTE PARA CHATGPT — OBLIGATORIO

Al terminar crear:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.6_Reporte_ChatGPT.md`

Debe incluir:

- qué implementó;
- archivos tocados;
- adaptaciones;
- bugs encontrados;
- tests;
- QA;
- commit;
- tag;
- deploy;
- URL;
- limitaciones;
- cualquier decisión pendiente.

No crear múltiples informes para la misma ronda.

---

## 17. Versionado

Esta ronda pasa a:

**BRAMUlab V03.6**

No usar `V03.5.3`.

A partir de acá priorizar numeración correlativa de subversiones para que el seguimiento sea más simple.

Tag esperado:

`BRAMUlab_V03.6`

---

## 18. Cierre esperado

Si queda verde:

- bump a `BRAMUlab V03.6`;
- commit;
- tag;
- push;
- deploy;
- verificar producción;
- actualizar reporte para ChatGPT.

Después:
- prueba visual/real de Sebastián;
- si queda bien, consolidar V03;
- recién entonces pasar al handoff de Nivel BRAMU V04.

---

## 19. Cierre final (ronda de cierre post-QA)

Última ronda sobre V03.6 antes de consolidar V03. No reabre V03.7 ni Nivel BRAMU V04. Fusiona
acá los 4 ajustes de esta ronda de cierre (el detalle de bugs/decisión punto por punto queda en
el reporte para ChatGPT, sección "Cierre final post-QA").

### 19.1 — Ranking sin posición ya no bloquea la clasificación

Una cuenta sin posición oficial (`sin-nivel`/`calibrando`) ya no ve una tarjeta bloqueante en vez
de todo Ranking. En su lugar, en el lugar de "TU POSICIÓN" aparece una tarjeta informativa
("Todavía no tenés posición en el Ranking...") y la clasificación (Local/Provincial/País/
Global/Mi red), búsqueda, filtros y apertura de perfiles siguen disponibles debajo, sin cambios
en la regla semanal ni en elegibilidad. No se inventa posición ni se agrega al usuario a la
clasificación si no es elegible.

### 19.2 — Movimiento semanal con color semántico

El indicador de movimiento (↑/↓/—) de cada fila y de "TU POSICIÓN" ahora usa color: sube = verde
lima (`--brand-lime`), baja = rojo (`--danger`), sin cambio = gris neutro (`--paper-faint`). Solo
se colorea el indicador, nunca la fila completa; el significado de las flechas no cambia.

### 19.3 — Interlineado del modal "Hay una nueva versión"

Se redujo el `line-height` del texto del modal de actualización en mobile (acotado por ID,
`#update-available-modal .overlay__text`, sin tocar el resto de modales que comparten
`.overlay__text`). Sin cambios de copy ni de lógica de actualización/service worker.

### 19.4 — Desborde visual de "CALIBRANDO"/"CALIBRACIÓN COMPLETA"

Se corrigió el desborde/compresión que este texto causaba en la tarjeta de Nivel en cuentas
nuevas, en Home, Mi Perfil y Perfil público (mismo componente compartido). El Nivel numérico
sigue mostrándose igual; los estados de calibración usan un tamaño reducido y prolijo en hasta 2
líneas, sin deformar la tarjeta ni afectar la legibilidad de "0 / 5 PARTIDOS". No se redefinió la
experiencia de Nivel BRAMU (eso queda para V04) — solo se resolvió el problema visual/responsive
actual.

### 19.5 — No tocado / documentado para el futuro

Sin cambios en: ubicación de "Cerrar sesión", mensaje genérico de login, circuito de
validación/confirmación de partidos, notificaciones de partidos, cuestionario de Nivel BRAMU,
calibración definitiva, historial multiusuario real, backend.

Limitación conocida, documentada y no parchada en esta ronda: al usar varias cuentas en el mismo
navegador/localStorage, una cuenta nueva puede ver partidos existentes en el storage como
"Observados" aunque "Mis partidos" sea 0. Es una limitación del prototipo local sin backend real;
queda como requisito futuro del modelo multiusuario: la participación real debe estar ligada por
`userId`, un partido observado nunca debe convertirse en historial propio, y Nivel BRAMU solo
debe considerar partidos donde el usuario realmente participó y que cumplan validación/
elegibilidad.
