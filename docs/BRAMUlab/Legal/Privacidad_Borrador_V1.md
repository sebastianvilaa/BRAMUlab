# Política de Privacidad de BRAMUlab — Borrador V1

> ## ⚠️ BORRADOR DE PRODUCTO — REQUIERE REVISIÓN LEGAL ANTES DE PUBLICARSE
>
> Este documento fue preparado desde producto, a partir de una auditoría directa del código y el esquema de base de datos reales de BRAMUlab (no es una descripción aspiracional). **No es asesoramiento jurídico ni un texto legal definitivo.** No debe publicarse ni presentarse a usuarios reales sin revisión de un profesional en protección de datos/derecho del consumidor en Argentina. Los puntos que requieren esa revisión están marcados explícitamente como `[REVISIÓN LEGAL NECESARIA]`. Los puntos que dependen de una decisión de producto todavía no tomada están marcados como `[DECISIÓN ABIERTA]`.
>
> **Versión de este borrador:** V1 — 27/09/2026. Corresponde a `TERMS_VERSION = 'piloto_v1'` en el código vigente (placeholder técnico, no versión legal real — ver §10).

---

## 0. Qué es BRAMUlab

BRAMUlab es una aplicación web para jugadores amateur de pádel: permite crear una cuenta, cargar y validar partidos jugados junto con otros jugadores, calcular una estimación de nivel de juego ("Nivel BRAMU"), participar de una clasificación semanal ("Ranking BRAMU") y recibir resúmenes/observaciones sobre los propios partidos ("BRAMU Intelligence").

BRAMUlab **no** incluye marcador en vivo, no es una red social con mensajería, no tiene pagos ni compras dentro de la aplicación, y no muestra publicidad. El marcador en vivo es un producto **separado** (BRAMUlive), con su propia infraestructura y aplicación, y no comparte esta base de usuarios ni esta política.

---

## 1. Quiénes somos

`[DECISIÓN ABIERTA]` — Este documento todavía no puede identificar formalmente al responsable del tratamiento de datos: no hay una razón social, domicilio legal, CUIT ni representante definidos en este momento del producto. Antes de publicar esta política, debe completarse:

- nombre legal del responsable (persona física o jurídica);
- domicilio;
- CUIT/identificación fiscal si corresponde;
- forma de contacto legal (ver también §7).

`[REVISIÓN LEGAL NECESARIA]` — Confirmar si, dado el tamaño y naturaleza actual del proyecto, corresponde inscripción ante la Agencia de Acceso a la Información Pública (AAIP) como responsable/base de datos, y cualquier otro requisito formal aplicable en Argentina antes del primer usuario real.

---

## 2. Datos que tratamos

Esta sección describe únicamente datos que el producto **efectivamente** recopila hoy, verificados contra el código. No se incluye ningún dato que la aplicación no trate.

### 2.1 Datos de cuenta

| Dato | Obligatorio | Quién lo ve |
|---|---|---|
| Email | Sí (alta) | Privado — nunca visible a otros jugadores |
| Contraseña | Sí (alta) | Gestionada por nuestro proveedor de autenticación (Supabase Auth); nunca la almacenamos en texto plano ni tenemos acceso a ella |
| Aceptación de Términos (versión + fecha/hora) | Sí (alta) | Privado, registro interno |

El alta se hace exclusivamente con email y contraseña. La confirmación de la cuenta y la recuperación de contraseña usan un código numérico de 6 dígitos enviado por email (no un enlace mágico). No existe alta ni login por redes sociales (Google, Facebook, etc.) ni por teléfono/SMS.

### 2.2 Datos de perfil deportivo

| Dato | Obligatorio | Visible a otros jugadores autenticados |
|---|---|---|
| `@usuario` | Sí | Sí |
| Nombre para mostrar | Sí | Sí |
| Nombre y apellido | Nombre sí / apellido opcional | Sí |
| Foto de perfil (avatar) | No | Sí (si la cargaste) |
| Fecha de nacimiento | No | **No** — privado |
| Género personal | No | **No** — privado |
| Mano dominante / lado de cancha preferido | No | Sí (si los completaste) |
| Rama competitiva (femenino/masculino) | No (solo si querés participar del Ranking) | Sí |
| Localidad deportiva | No (solo si querés participar del Ranking territorial) | Sí, como nombre de localidad (nunca coordenadas ni el identificador interno) |
| Categoría declarada | No | Sí (si la completaste) |
| Teléfono | No | **No**, salvo que actives el contacto por WhatsApp (ver §2.4) |
| Nivel BRAMU (estimación de juego) | Se calcula automáticamente al validar partidos | Se muestra una versión redondeada + tu estado de calibración; el valor interno exacto es privado |
| Estadísticas agregadas (partidos jugados, rivales distintos, partidos ganados) | Se calculan automáticamente | Sí |

`@usuario`, nombre y nombre para mostrar son obligatorios para completar el perfil. Todo lo demás de esta tabla es opcional — podés usar BRAMUlab sin completarlo.

### 2.3 Ubicación

La localidad que aparece en tu perfil es una localidad que **vos elegís por nombre** (buscada contra un directorio público de localidades de Argentina), nunca tu posición GPS. Completar la localidad es opcional y solo hace falta si querés participar del Ranking territorial (Local/Provincial/País) — no es necesaria para el resto de la app.

`[MATIZ IMPORTANTE]` Aparte de la localidad de perfil, existe un botón **opcional** dentro de la pantalla de carga de un partido ("Usar mi ubicación") que, si lo tocás y das permiso al navegador, adjunta la ubicación real de tu dispositivo (coordenadas) **a ese partido puntual** como referencia del lugar donde se jugó — nunca a tu perfil, nunca de forma continua ni en segundo plano. Esa información, si existe, es visible únicamente a los otros 3 participantes de ese partido específico, igual que el resto de los datos del partido (ver §2.6).

### 2.4 Teléfono y contacto por WhatsApp

El teléfono es un dato opcional y privado. Cargarlo **no** activa nada por sí solo. Existe un interruptor de consentimiento separado y explícito ("permitir que me contacten por WhatsApp"): solo cuando lo activás, tu Perfil público muestra un botón de contacto por WhatsApp — el número en sí **nunca se muestra como texto visible**, ni a otros jugadores ni en ningún listado. Podés desactivar este consentimiento en cualquier momento, sin necesidad de borrar el teléfono cargado.

### 2.5 Foto de perfil (avatar)

Si subís una foto, se guarda en un almacenamiento **privado**: no tiene una dirección web pública. Otros jugadores autenticados en BRAMUlab pueden verla mediante un enlace de acceso temporal (vence a las 24 horas y se vuelve a generar cada vez que hace falta) — una persona sin cuenta o sin sesión iniciada no puede acceder a la imagen.

### 2.6 Partidos

Cuando cargás un partido, se registran: los 4 participantes (vos, tu compañero/a, tus dos rivales), el resultado (sets/games), la fecha y hora jugada, el formato y sistema de puntuación, y el estado de validación (pendiente, confirmado, en corrección, etc.). **Esta información es visible únicamente para los 4 participantes de ese partido** — nunca para otros jugadores de BRAMUlab que no hayan participado. Cada participante puede además dejarse una nota privada sobre ese partido, visible solo para quien la escribió.

### 2.7 Nivel BRAMU

Nivel BRAMU es una estimación numérica interna de tu nivel de juego, calculada automáticamente a partir de los partidos que validás. El valor exacto y sus componentes internos son privados — solo vos los ves. A otros jugadores autenticados se les muestra una versión pública redondeada, junto con tu estado de calibración (si el sistema todavía tiene poca evidencia sobre tu juego o ya tiene suficiente).

### 2.8 Ranking BRAMU

Si activás la participación en Ranking (opcional, desactivada por defecto), tu posición en la clasificación semanal correspondiente a tu ámbito (localidad/provincia/país) y rama competitiva es visible para otros jugadores autenticados que consulten ese mismo ámbito — es una clasificación pública dentro de BRAMU, no restringida a tus contactos. Podés ocultar individualmente a otros jugadores de tu vista de "Mi red" sin afectar su posición real.

Cada edición semanal publicada queda fija: una corrección posterior de un partido no reescribe una posición ya publicada, se refleja recién en la siguiente edición.

### 2.9 BRAMU Intelligence

Son observaciones/resúmenes automáticos generados a partir de tus propios partidos ya registrados. Son **estrictamente privados**: ni siquiera tu compañero o tus rivales del mismo partido pueden ver las observaciones que a vos te genera ese partido — cada jugador recibe su propia perspectiva, guardada por separado.

### 2.10 Notificaciones

Recibís notificaciones dentro de la aplicación (nunca notificaciones push del sistema operativo) sobre eventos que te involucran: un partido pendiente de tu confirmación, una corrección propuesta, un partido validado, etc. Son estrictamente privadas de cada destinatario.

### 2.11 Datos técnicos internos

Para prevenir abuso (por ejemplo, demasiados intentos de una misma acción en poco tiempo) guardamos contadores técnicos internos asociados a tu cuenta, sin contenido personal. También registramos un conjunto mínimo de eventos de producto (por ejemplo, que empezaste el alta, que validaste un partido) con fines exclusivamente operativos/de mejora del producto — nunca se registran contraseñas, tokens ni contenido de notas privadas dentro de estos eventos.

---

## 3. Para qué usamos tus datos

- crear, proteger y recuperar tu cuenta;
- identificarte dentro de BRAMU como jugador;
- registrar y compartir partidos entre quienes los jugaron;
- validar, confirmar y corregir la actividad deportiva registrada;
- calcular y mostrar tu Nivel BRAMU;
- publicar el Ranking BRAMU dentro del universo de jugadores elegibles, si elegís participar;
- generar BRAMU Intelligence a partir de la evidencia que ya registraste;
- prevenir duplicados y uso indebido básico del sistema;
- brindarte soporte, recuperación de cuenta y seguridad;
- medir un conjunto mínimo de eventos internos para entender y mejorar el producto.

**No usamos tus datos para publicidad, no los vendemos ni los compartimos con terceros con fines comerciales.** BRAMUlab no tiene ninguna finalidad de monetización activa hoy.

---

## 4. Con quién compartimos datos

### 4.1 Dentro de BRAMU (otros jugadores)

Ver las tablas de las secciones 2.2 a 2.9 — cada categoría de dato indica explícitamente si es visible a otros jugadores autenticados o privada. En términos generales: tu identidad deportiva pública (usuario, nombre, foto, localidad como texto, rama, Nivel redondeado, estadísticas agregadas, posición de Ranking si participás) es visible para cualquier otro jugador con cuenta en BRAMU. Tus datos privados (email, fecha de nacimiento, género, teléfono crudo, contenido de tus notas) nunca se muestran a otros jugadores.

### 4.2 Proveedores de infraestructura

BRAMUlab funciona sobre servicios de infraestructura de terceros que actúan como encargados técnicos del tratamiento, nunca como destinatarios comerciales de tus datos:

- **Supabase** — aloja la base de datos, gestiona la autenticación (incluyendo el envío de los correos de confirmación/recuperación de cuenta) y el almacenamiento de archivos (avatares).
- **Vercel** — aloja y publica la aplicación web.

`[REVISIÓN LEGAL NECESARIA]` Confirmar el país/región donde estos proveedores procesan/almacenan los datos, y si corresponde declarar una transferencia internacional de datos bajo la normativa argentina vigente.

### 4.3 Qué no hacemos

No compartimos tus datos con anunciantes, no los usamos para publicidad dirigida, no los vendemos, y no integramos herramientas de analítica de terceros (por ejemplo, Google Analytics) ni de rastreo de errores de terceros en este momento del producto.

---

## 5. Conservación y eliminación de tu cuenta

Si pedís eliminar tu cuenta, el proceso hoy es **asistido por administración** (todavía no existe un botón de autoservicio dentro de la app):

- tu acceso a BRAMU se corta de inmediato;
- tus datos personales identificables (nombre, usuario, foto, fecha de nacimiento, género, mano/lado, rama competitiva, localidad, teléfono, categoría) se eliminan/anonimizan;
- tu contraseña y tu cuenta de acceso se eliminan;
- tu foto de perfil se elimina del almacenamiento;
- tus notas privadas y tus notificaciones se eliminan;
- tu participación en las listas personales de otros jugadores (y las tuyas propias) se elimina;
- los resúmenes de BRAMU Intelligence asociados a tus partidos se eliminan (se regeneran limpios cuando corresponda, sin tu nombre);
- **los partidos que compartiste con otros jugadores no se eliminan** — se conserva la estructura mínima necesaria para que el historial de esos otros participantes siga siendo coherente. En cualquier lugar donde tu nombre hubiera aparecido, vas a mostrarte como **"Jugador eliminado"**, sin conservar tu nombre visible;
- de la misma forma, tu posición histórica ya publicada en una edición de Ranking se conserva como dato numérico (nunca se reescribe una edición ya publicada), pero se presenta con identidad anónima ("Jugador eliminado"), nunca con tu nombre/usuario/foto reales.

Registramos internamente que la eliminación ocurrió (con qué cuenta técnica y cuándo), sin conservar ningún dato que te identifique por nombre en ese registro.

**Si volvés a BRAMU después de eliminar tu cuenta, empezás de cero con una identidad nueva.** No recuperamos ni revinculamos tu historial anterior. Esto significa que, en teoría, una persona podría intentar "reiniciar" su historial eliminando y creando una cuenta nueva — es un riesgo que asumimos en esta primera versión del producto en lugar de retener información adicional (como un período de espera obligatorio o una huella técnica de tu email anterior) solo para impedirlo.

Mientras tu cuenta está activa, conservamos tus datos durante el tiempo en que la usás. Los registros técnicos mínimos de seguridad se conservan por un período limitado y proporcional a su propósito. `[REVISIÓN LEGAL NECESARIA]` Los plazos exactos de conservación de cada categoría de dato deben cerrarse con revisión legal antes de publicar esta política con números concretos.

---

## 6. Tus derechos

Podés pedirnos, en cualquier momento:

- acceso a los datos que tenemos sobre vos;
- rectificación de datos inexactos;
- actualización de tus datos;
- supresión/eliminación de tu cuenta (ver §5);
- ayuda con cualquier problema de tu cuenta;
- información adicional sobre cómo tratamos tus datos.

`[DECISIÓN ABIERTA]` Canal de contacto: todavía no existe un email o canal de soporte definido públicamente para este fin. Antes de publicar esta política debe existir un contacto real y accesible desde la aplicación.

---

## 7. Seguridad

Tomamos medidas técnicas razonables para proteger tus datos: tu contraseña nunca se guarda en texto plano (la gestiona nuestro proveedor de autenticación), las tablas con información de partidos, Nivel, Ranking e Intelligence solo son accesibles a través de funciones controladas del servidor (nunca por acceso directo a la base de datos desde la aplicación), y los archivos de avatar se guardan en un almacenamiento privado con acceso temporal. Ningún sistema es 100% infalible — no podemos garantizar una protección absoluta frente a cualquier incidente de seguridad, pero trabajamos con ese objetivo.

---

## 8. Menores de edad

`[DECISIÓN ABIERTA]` `[REVISIÓN LEGAL NECESARIA]` BRAMUlab está pensado, en esta primera versión, para personas adultas. Todavía no está definida una edad mínima exacta ni un tratamiento específico para menores de edad. Hasta que eso se defina con revisión legal, no se ofrece deliberadamente el alta a menores, y esta política debe completarse con la edad mínima real antes de publicarse.

---

## 9. Cambios a esta política

Cuando publiquemos una versión con validez legal, la vamos a identificar con un número de versión y la fecha en que entra en vigencia, visible desde la aplicación. Si un cambio es material, vamos a pedirte que vuelvas a aceptar la política actualizada antes de seguir usando BRAMUlab. `[REVISIÓN LEGAL NECESARIA]` El procedimiento exacto para notificar cambios materiales debe confirmarse con revisión legal.

---

## 10. Contacto

`[DECISIÓN ABIERTA]` — Pendiente de completar junto con §1 y §6.

---

## Nota técnica (no forma parte del texto legal — referencia para quien integre este documento)

Este borrador refleja el comportamiento real del código al 27/09/2026. Fue construido auditando directamente el esquema de base de datos y las funciones del servidor (nunca a partir de descripciones de marketing o intenciones de producto no implementadas). Ver `docs/BRAMUlab/Implementacion/Pre_Production/34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md` para el detalle de auditoría y el mapa de integración técnica pendiente.
