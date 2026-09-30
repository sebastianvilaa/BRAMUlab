> **SUPERADO (V04.20):** el texto vigente vive en `bramulab/privacidad/index.html` (alineado con `Privacidad_Legal.md`). Este borrador conserva una restricción 13+ que NO está vigente (fuente maestra §6) y no debe usarse para publicar.

# Política de Privacidad de BRAMUlab — Borrador V1

> ## ⚠️ BORRADOR DE PRODUCTO / COMPLIANCE — CANDIDATO V1
>
> Este documento fue preparado desde producto a partir de una auditoría directa del comportamiento real de BRAMUlab y de la normativa oficial argentina vigente. **No constituye asesoramiento jurídico profesional ni una certificación legal.** La revisión externa de un profesional queda recomendada como reducción adicional de riesgo, pero no se considera por sí sola un requisito técnico de publicación. Los únicos puntos todavía pendientes están marcados expresamente como `[DATO A COMPLETAR]` o `[VERIFICACIÓN OPERATIVA]`.
>
> **Versión de este borrador:** V1 — 27/09/2026. Corresponde a `TERMS_VERSION = 'piloto_v1'` en el código vigente (placeholder técnico, no versión legal real — ver §10).

---

## 0. Qué es BRAMUlab

BRAMUlab es una aplicación web para jugadores amateur de pádel: permite crear una cuenta, cargar y validar partidos jugados junto con otros jugadores, calcular una estimación de nivel de juego ("Nivel BRAMU"), participar de una clasificación semanal ("Ranking BRAMU") y recibir resúmenes/observaciones sobre los propios partidos ("BRAMU Intelligence").

BRAMUlab **no** incluye marcador en vivo, no es una red social con mensajería, no tiene pagos ni compras dentro de la aplicación, y no muestra publicidad. El marcador y seguimiento en vivo pertenecen a BRAMUlive, un producto separado y fuera del alcance de BRAMUlab. `[DECISIÓN ABIERTA]` Todavía no está definida una política de cuentas/infraestructura/documentos legales compartidos o separados entre ambos productos — este documento no asume ninguna de las dos opciones.

---

## 1. Quiénes somos

BRAMUlab es operado por una **persona humana titular del proyecto**, no por una sociedad o empresa separada. Esa persona es el responsable del tratamiento de los datos personales de BRAMUlab.

Antes de publicar esta política deben completarse únicamente los datos identificatorios reales del responsable:

- `[DATO A COMPLETAR]` nombre legal completo;
- `[DATO A COMPLETAR]` domicilio del responsable a efectos de privacidad;
- `[DATO A COMPLETAR]` CUIT/CUIL cuando corresponda informarlo en el trámite o registro;
- `[DATO A COMPLETAR]` canal público de contacto legal/privacidad (ver §6 y §10).

No hace falta inventar un cargo societario: para V1 la calidad correcta es **titular y responsable de BRAMUlab**.

### Registro ante la AAIP

La documentación oficial vigente de la AAIP indica que los responsables y las bases de datos personales alcanzadas deben inscribirse en el Registro Nacional de Bases de Datos Personales. La inscripción del responsable es previa al registro de la base, el trámite es online y gratuito.

`[VERIFICACIÓN OPERATIVA]` Antes de abrir Production a usuarios reales, completar el trámite correspondiente en TAD con los datos reales del titular. No requiere crear una sociedad ni contratar un abogado para efectuar el trámite.

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
| Rama competitiva (femenino/masculino) | No (se pide cuando empieza a hacer falta para ubicarte correctamente en el Ranking, que es automático — ver §2.8) | Sí |
| Localidad deportiva | No (se pide cuando empieza a hacer falta para el Ranking territorial, que es automático — ver §2.8) | Sí, como nombre de localidad (nunca coordenadas ni el identificador interno) |
| Categoría actual (autoevaluación deportiva) | No | **No** — privada, solo vos la ves (vive en la sección "Mis datos" de tu perfil, nunca en tu Perfil público) |
| Teléfono | No | **No**, salvo que actives el contacto por WhatsApp (ver §2.4) |
| Nivel BRAMU (estimación de juego) | Se calcula automáticamente al validar partidos | Se muestra una versión redondeada + tu estado de calibración; el valor interno exacto es privado |
| Estadísticas agregadas (partidos jugados, rivales distintos, partidos ganados) | Se calculan automáticamente | Sí |

`@usuario`, nombre y nombre para mostrar son obligatorios para completar el perfil. Todo lo demás de esta tabla es opcional — podés usar BRAMUlab sin completarlo.

### 2.3 Ubicación

La localidad que aparece en tu perfil es una localidad que **vos elegís por nombre** (buscada contra un directorio público de localidades de Argentina), nunca tu posición GPS. Completar la localidad no es necesaria para el resto de la app — se pide cuando empieza a hacer falta para ubicarte en el Ranking territorial (Local/Provincial/País), que es automático (ver §2.8).

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

La participación en Ranking BRAMU es **automática**: no es una función que actives u ofrezcas activar. Cuando tu cuenta cumple los requisitos de elegibilidad (entre otros: localidad y rama competitiva cargadas, Nivel BRAMU suficientemente calibrado, actividad reciente), tu posición en la clasificación semanal correspondiente a tu ámbito (localidad/provincia/país) y rama competitiva pasa a ser visible para otros jugadores autenticados que consulten ese mismo ámbito — es una clasificación pública dentro de BRAMU, no restringida a tus contactos. No existe una opción ordinaria para optar por no participar mientras cumplas la elegibilidad; dejás de ocupar posición únicamente por reglas objetivas (por ejemplo, inactividad prolongada o dejar de cumplir algún requisito). Podés ocultar individualmente a otros jugadores de tu propia vista de "Mi red" sin afectar la posición real de nadie.

Si tu Nivel BRAMU todavía está en calibración (evidencia insuficiente), podés explorar el Ranking, pero todavía no ocupás una posición propia.

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
- publicar el Ranking BRAMU entre los jugadores que cumplen los requisitos de elegibilidad vigentes (la participación es automática, no una función que actives — ver §2.8);
- generar BRAMU Intelligence a partir de la evidencia que ya registraste;
- prevenir duplicados y uso indebido básico del sistema;
- brindarte soporte, recuperación de cuenta y seguridad;
- medir un conjunto mínimo de eventos internos para entender y mejorar el producto.

**No usamos tus datos para publicidad, no los vendemos ni los compartimos con terceros con fines comerciales.** BRAMUlab no tiene ninguna finalidad de monetización activa hoy.

---

## 4. Con quién compartimos datos

### 4.1 Dentro de BRAMU (otros jugadores)

Ver las tablas de las secciones 2.2 a 2.9 — cada categoría de dato indica explícitamente si es visible a otros jugadores autenticados o privada. En términos generales: tu identidad deportiva pública (usuario, nombre, foto, localidad como texto, rama, Nivel redondeado, estadísticas agregadas, y tu posición de Ranking cuando cumplís los requisitos de elegibilidad — ver §2.8) es visible para cualquier otro jugador con cuenta en BRAMU. Tus datos privados (email, fecha de nacimiento, género, teléfono crudo, categoría actual, contenido de tus notas) nunca se muestran a otros jugadores.

### 4.2 Proveedores de infraestructura

BRAMUlab funciona sobre servicios de infraestructura de terceros que actúan como encargados técnicos del tratamiento, nunca como destinatarios comerciales de tus datos:

- **Supabase** — aloja la base de datos, gestiona la autenticación de tu cuenta (alta, confirmación y recuperación) y el almacenamiento de archivos (avatares). Los correos de confirmación y recuperación se envían a través de la infraestructura de email configurada para el servicio.
- **Vercel** — aloja y publica la aplicación web.

`[VERIFICACIÓN OPERATIVA]` El proveedor SMTP concreto de Production y las regiones efectivas de procesamiento de Supabase/Vercel deben confirmarse en Bloque 9.

Cuando un proveedor procese datos fuera de Argentina, BRAMUlab informará esa circunstancia y usará las garantías exigidas por la normativa argentina para transferencias internacionales. Si el destino no es considerado adecuado por la AAIP, deberán utilizarse los mecanismos admitidos (por ejemplo, cláusulas contractuales modelo o la base legal que corresponda). No se inventa una región antes de conocer la configuración real de Production.

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

Mientras tu cuenta está activa, conservamos los datos necesarios para prestar el servicio y mantener tu historia deportiva. Cuando un dato deja de ser necesario o pertinente para la finalidad que motivó su recolección, debe eliminarse o anonimizarse según corresponda.

Para V1 se usa un **criterio de conservación por finalidad**, en vez de inventar plazos numéricos que el producto no aplica realmente:
- datos de cuenta y perfil: mientras la cuenta permanezca activa;
- al eliminar la cuenta: se aplica el procedimiento de anonimización/eliminación descrito arriba;
- partidos compartidos y efectos deportivos históricos: se conservan con identidad anonimizada cuando sea necesario para no destruir la historia de terceros;
- notas privadas, notificaciones y datos personales privados: se eliminan con la cuenta según el procedimiento vigente;
- registros técnicos de seguridad/operación: únicamente mientras sean necesarios para seguridad, auditoría o diagnóstico, y no para reutilizarlos con fines incompatibles.

`[VERIFICACIÓN OPERATIVA]` Bloque 9 debe comprobar que los mecanismos reales de logs/eventos respeten este criterio y que no exista una retención indefinida accidental.

---

## 6. Tus derechos

Podés pedirnos, en cualquier momento:

- acceso a los datos que tenemos sobre vos;
- rectificación de datos inexactos;
- actualización de tus datos;
- supresión/eliminación de tu cuenta (ver §5);
- ayuda con cualquier problema de tu cuenta;
- información adicional sobre cómo tratamos tus datos.

`[DATO A COMPLETAR]` Canal de contacto: antes de publicar esta política debe confirmarse un email real y público de BRAMUlab para consultas de privacidad, acceso, rectificación y supresión. Debe ser visible desde la aplicación.

---

## 7. Seguridad

Tomamos medidas técnicas razonables para proteger tus datos: tu contraseña nunca se guarda en texto plano (la gestiona nuestro proveedor de autenticación), las tablas con información de partidos, Nivel, Ranking e Intelligence solo son accesibles a través de funciones controladas del servidor (nunca por acceso directo a la base de datos desde la aplicación), y los archivos de avatar se guardan en un almacenamiento privado con acceso temporal. Ningún sistema es 100% infalible — no podemos garantizar una protección absoluta frente a cualquier incidente de seguridad, pero trabajamos con ese objetivo.

---

## 8. Menores de edad

La edad mínima de BRAMUlab V1 es **13 años**.

Esta edad es una **regla de producto de BRAMUlab**, no una afirmación de que la legislación argentina vigente establezca un umbral digital automático de 13 años. La normativa vigente aplica el principio de autonomía progresiva: una persona menor puede prestar consentimiento informado según sus características, aptitudes y grado de desarrollo; si no cuenta con capacidad suficiente, el consentimiento debe provenir de quien ejerce la responsabilidad parental o tutela.

Por eso BRAMUlab debe:
- informar el tratamiento de datos en lenguaje simple y comprensible;
- pedir una declaración expresa de que la persona tiene al menos 13 años;
- no admitir deliberadamente cuentas de menores de 13 años;
- permitir la intervención de la persona adulta responsable cuando, por edad o grado de madurez, corresponda;
- no usar la condición de menor para ampliar la recolección de datos ni para publicidad.

`[VERIFICACIÓN OPERATIVA]` Antes de Production, el alta debe incorporar de forma mínima y clara la declaración 13+ y el aviso específico de menores. Si en una revisión posterior se concluye que BRAMU necesita verificación parental adicional para determinados rangos de edad, se incorporará ese mecanismo sin reducir la protección vigente.

---

## 9. Cambios a esta política

Cada versión publicada se identifica con un número de versión y su fecha de vigencia, visible desde la aplicación. Cuando un cambio modifique materialmente el tratamiento de datos o las condiciones aceptadas, BRAMUlab solicitará una nueva aceptación antes de continuar usando las funciones que dependan de ese consentimiento.

---

## 10. Contacto

`[DATO A COMPLETAR]` — Email público de privacidad/soporte legal de BRAMUlab. Debe coincidir con el canal indicado en §1 y §6.

---

## Nota técnica (no forma parte del texto legal — referencia para quien integre este documento)

Este borrador refleja el comportamiento real del código al 27/09/2026. Fue construido auditando directamente el esquema de base de datos y las funciones del servidor (nunca a partir de descripciones de marketing o intenciones de producto no implementadas). Ver `docs/BRAMUlab/Implementacion/Pre_Production/34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md` para el detalle de auditoría y el mapa de integración técnica pendiente.
