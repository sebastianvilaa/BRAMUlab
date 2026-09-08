# BRAMUlab V03.0.1 — Refinamiento UX de Perfil, Acceso y sesión

## Objetivo de la ronda

V03.0 quedó funcionalmente validada en uso real sobre la versión pública:

- migración legacy correcta;
- login/logout correcto;
- persistencia de cuenta;
- persistencia de foto y datos;
- 36 partidos e historial conservados;
- Nivel BRAMU legacy conservado;
- `userId` estable funcionando;
- edición de datos funcionando.

V03.0.1 NO debe reabrir esa arquitectura.

Esta ronda es de **UX, jerarquía y corrección de bugs visibles** detectados durante la prueba real.

La prioridad es que:

1. Perfil deje de mezclar identidad, configuración y rendimiento deportivo.
2. Las acciones largas de edición dejen de sentirse como formularios metidos dentro de popups.
3. El estado sin sesión sea coherente y no exponga información personal.
4. Los formularios sean claros aunque ya tengan datos cargados.
5. La app dé feedback visible cuando el usuario guarda o modifica información.

No implementar todavía el nuevo sistema de Notificaciones. Eso queda reservado para V03.0.2.

---

# 1. PERFIL — NUEVA ESTRUCTURA EN DOS PESTAÑAS

## REEMPLAZAR

Reemplazar la pantalla actual de Perfil, que hoy mezcla datos personales + edición + Evolución del Nivel BRAMU, por una pantalla con dos pestañas:

**MI PERFIL | MIS DATOS**

> Estos nombres se toman como versión de trabajo. Deben quedar fáciles de cambiar posteriormente sin alterar lógica.

### Apertura por defecto

Al entrar desde el ícono **Perfil** de la navegación inferior:

- abrir por defecto en **MI PERFIL**.

Al tocar la tarjeta/nombre/foto del jugador desde el Home:

- abrir directamente **Perfil → MI PERFIL**.

### MI PERFIL

Esta pestaña representa al jugador dentro de BRAMU, no su cuenta administrativa.

Mostrar:

- foto/avatar;
- nombre visible;
- @usuario;
- Nivel BRAMU / estado de calibración según la lógica actual;
- evolución del Nivel BRAMU;
- partidos totales;
- efectividad;
- racha actual;
- otros KPIs deportivos YA disponibles que sean útiles y no obliguen a crear nueva lógica.

Evitar duplicar todo el Home.

Criterio:
- Home = estado actual / lectura rápida.
- Mi Perfil = ficha deportiva / evolución / datos más estables del jugador.

No inventar nuevas estadísticas.
No cambiar la fórmula legacy.
No implementar ranking real.

### MIS DATOS

Esta pestaña concentra identidad, datos personales y seguridad.

Mostrar, claramente agrupado:

#### Identidad
- Foto
- Nombre
- Apellido
- @usuario
- Nombre visible

#### Datos personales / deportivos declarados
- Fecha de nacimiento / edad
- Género
- Mano dominante
- Lado habitual
- Categoría declarada

#### Acceso y seguridad
- Email
- Cambiar contraseña
- Cerrar sesión

Si falta información del perfil, mostrar arriba un aviso discreto:

**Completá tus datos**

con texto breve indicando qué falta o que el perfil todavía está incompleto.

No usar todavía el sistema de campana/notificaciones para esto; V03.0.2 resolverá notificaciones.

---

# 2. EDITAR DATOS — PANTALLA COMPLETA

## REEMPLAZAR

Reemplazar el modal actual **EDITAR PERFIL** por una vista/pantalla completa:

**EDITAR DATOS**

No usar overlay/modal.

La pantalla debe:

- respetar navegación normal;
- tener header con volver;
- permitir scroll natural;
- sentirse como parte de la app;
- mantener el lenguaje visual BRAMU;
- no quedar comprimida verticalmente.

## FUSIONAR — estructura de formulario

No usar placeholders como único identificador de los campos.

Cada campo debe conservar un **label visible y persistente arriba**, incluso cuando ya tenga valor.

Ejemplo conceptual:

Nombre  
`Sebastián`

Apellido  
`Vila`

@usuario  
`sebas`

Nombre visible  
`Seba`

Agregar textos auxiliares solo donde aporten claridad.

### Nombre visible

Agregar ayuda breve:

**Así te va a mostrar BRAMU en partidos, rankings y grupos.**

### @usuario

Mantener chequeo de unicidad.

REEMPLAZAR el feedback actual por uno más claro:

- ✓ Disponible
- ! Ya está en uso

El feedback debe quedar visualmente asociado al campo.

### Foto

Mantener la lógica actual de compresión/reescala antes de guardar.

No modificar la arquitectura de almacenamiento de imagen salvo que exista un bug real.

Permitir:

- agregar;
- reemplazar;
- quitar.

### Fecha de nacimiento

Mantener selector actual si funciona, pero con label claro y tamaño táctil correcto.

### Género

MEJORAR el control actual.

El desplegable de navegador que se vio en la prueba resulta demasiado chico.

Usar un control visual coherente con BRAMU, de ancho completo y tamaño táctil cómodo.

Opciones actuales:
- Masculino
- Femenino
- Otro
- Prefiero no decir

No agregar más lógica.

### Mano dominante

AGREGAR label explícito:

**Mano dominante**

Opciones:
- Derecha
- Izquierda

Mantener formato de botones segmentados si funciona.

### Lado habitual

AGREGAR label explícito:

**Lado habitual**

Opciones:
- Drive
- Revés
- Indiferente

Mantener formato de botones segmentados si funciona.

### Categoría actual

AGREGAR label explícito:

**Categoría actual**

Opciones actuales, incluida:
- No sé mi categoría

La categoría declarada sigue siendo independiente del Nivel BRAMU.

Cambiar categoría NO debe alterar el Nivel BRAMU.

### Guardado

Botón principal:

**GUARDAR**

No hacerlo excesivamente grande.

Al guardar correctamente:

- volver a **MIS DATOS**;
- mostrar toast breve:
  **Datos guardados**
- duración aproximada 2–3 s;
- no bloquear la interfaz.

---

# 3. BUG — FOTO DEL JUGADOR EN HOME

## CORREGIR

Durante la prueba real:

- la foto cargada aparece correctamente en Perfil;
- persiste después de recargar y después de logout/login;
- pero la tarjeta principal del Home sigue mostrando el ícono genérico.

Corregir la tarjeta principal del Home para que:

1. si `currentUser.profilePhoto` existe → mostrar esa foto;
2. si no existe → mantener fallback actual.

No duplicar almacenamiento.
No crear una segunda fuente para la imagen.

La tarjeta/nombre/foto del Home debe ser clickeable/tappable y llevar a:

**Perfil → MI PERFIL**

---

# 4. COMPLETAR ACCESO — PANTALLA COMPLETA

## REEMPLAZAR

Reemplazar el modal actual **COMPLETAR ACCESO** por una pantalla completa.

Aplica a cuentas legacy migradas que todavía no tengan email/password.

Campos:

- Email
- Contraseña
- Repetir contraseña

Mantener las validaciones actuales.

## AGREGAR

Agregar botón de mostrar/ocultar contraseña (ojo) en:

- Contraseña
- Repetir contraseña

Mantener checklist de requisitos, pero darle más aire vertical.

Evitar CTA sobredimensionado.

Botón:

**GUARDAR ACCESO**

Al guardar correctamente:

- volver a **MIS DATOS**;
- mostrar toast:
  **Acceso guardado**

La cuenta debe seguir siendo exactamente el mismo `userId`.

---

# 5. CAMBIAR CONTRASEÑA — ACCESO Y SEGURIDAD

## AGREGAR

Dentro de **MIS DATOS → Acceso y seguridad**, agregar acción:

**Cambiar contraseña**

Abrir una pantalla simple, no modal.

Para V03.0.1 local:

- Contraseña actual
- Nueva contraseña
- Repetir nueva contraseña

Agregar mostrar/ocultar contraseña.

Validar:

- contraseña actual correcta;
- nuevas contraseñas coinciden;
- nueva contraseña cumple las reglas existentes.

Al guardar:

- conservar mismo usuario;
- conservar misma sesión;
- conservar historial y `userId`;
- mostrar toast:
  **Contraseña actualizada**

Recordatorio técnico:
esto sigue siendo prototipo local. No agregar criptografía casera ni backend.

---

# 6. CERRAR SESIÓN — JERARQUÍA Y COMPORTAMIENTO

## REEMPLAZAR

El link actual **Cerrar sesión** queda visualmente perdido.

Moverlo dentro de:

**MIS DATOS → Acceso y seguridad**

Usar botón secundario/destructivo claro, sin competir con acciones principales.

Texto:
**CERRAR SESIÓN**

Si la cuenta legacy todavía no completó acceso, mantener la protección/advertencia ya implementada.

---

# 7. ESTADO SIN SESIÓN — NO EXPONER EXPERIENCIA PERSONAL

## CORREGIR

Bug funcional detectado en prueba real:

después de cerrar sesión, la app permite seguir entrando a pantallas personales locales, especialmente Historial, porque los datos siguen físicamente en `localStorage`.

Eso no es correcto desde UX ni desde identidad.

## REEMPLAZAR

Cuando NO exista sesión activa, mostrar una pantalla pública de entrada:

**BIENVENIDO A BRAMU**

Acciones:

1. **INICIAR SESIÓN**
2. **CREAR CUENTA**
3. **REGISTRAR PARTIDO SIN CUENTA**

Ocultar navegación personal mientras no haya sesión:

- Home personal
- Historial personal
- Ranking personal
- Perfil

No borrar datos locales.
Solo impedir que se muestren como si hubiera un jugador autenticado.

### Registrar partido sin cuenta

Debe permitir entrar al flujo de registro en vivo sin crear cuenta.

Para esta versión:

- permitir configurar y registrar el partido;
- permitir ver el resultado/resumen de esa sesión;
- NO vincularlo a ningún `userId`;
- NO mostrar Historial personal ni Perfil mientras siga sin sesión;
- evitar que un partido de invitado termine reclamándose silenciosamente como historial personal por coincidencia de nombre.

Elegir la solución técnica más simple y segura para esto.

Si para evitar una falsa vinculación la opción más segura es que el partido invitado no persista en el historial personal, preferir ese comportamiento en V03.0.1 y documentarlo en el Informe.

No desarrollar todavía:
- “reclamar” un partido invitado;
- convertirlo después en partido de una cuenta;
- flujo social.

---

# 8. LOGIN — REFINAMIENTO VISUAL

## AJUSTAR

Mantener la lógica actual.

Mejorar únicamente UX:

- campos con labels persistentes;
- ojo mostrar/ocultar contraseña;
- CTA menos sobredimensionado;
- espaciado vertical más equilibrado;
- error de credenciales claro y cercano al formulario.

No cambiar reglas de autenticación local.

---

# 9. TOASTS / FEEDBACK GLOBAL

## AGREGAR

Crear un mecanismo simple y reutilizable de toast para confirmaciones breves.

Casos mínimos de esta ronda:

- Datos guardados
- Acceso guardado
- Contraseña actualizada

Puede reutilizarse más adelante.

Características:

- visible 2–3 s;
- no modal;
- no bloquear interacción;
- mobile-first;
- alto contraste;
- consistente con BRAMU.

No convertir esto todavía en sistema de Notificaciones.

---

# 10. ESPACIADO Y JERARQUÍA VISUAL DE PERFIL

## AJUSTAR

Durante la prueba se detectó:

- botón Editar demasiado pegado a Evolución;
- bloques con poco aire;
- acciones secundarias perdidas;
- modal muy comprimido;
- CTAs excesivamente grandes en algunas pantallas.

Al pasar a la nueva estructura:

- mantener separación consistente entre secciones;
- evitar botones full-width gigantes cuando no aporten jerarquía;
- conservar targets táctiles cómodos;
- priorizar lectura clara en mobile;
- mantener fondo, paleta y sistema visual actual.

No hacer un rediseño general de Home/Historial.

---

# 11. NO TOCAR EN V03.0.1

No implementar:

- backend;
- Supabase/Firebase;
- ranking real;
- nueva fórmula de Nivel BRAMU;
- amigos;
- partidos compartidos;
- sistema social;
- reclamo de perfiles;
- Player Intelligence nuevo;
- rediseño de Historial;
- rediseño general de Home;
- pantalla completa de Notificaciones;
- arquitectura definitiva de notificaciones;
- animaciones especiales de entrada/salida de notificaciones.

Las Notificaciones quedan reservadas para:

**BRAMUlab V03.0.2**

---

# 12. TESTS Y VALIDACIÓN

Mantener todos los tests actuales verdes.

Agregar tests razonables para:

- foto de perfil disponible para render del Home;
- navegación Home → Perfil / MI PERFIL;
- cambio de contraseña local;
- logout mantiene datos pero elimina acceso a pantallas personales;
- usuario sin sesión no puede abrir Historial/Perfil personal;
- invitado no recibe `userId`;
- partido invitado no se vincula silenciosamente al historial de una cuenta por coincidencia de nombre;
- misma identidad/historial después de editar datos;
- toasts no modifican estado de negocio.

Validación manual mobile + desktop:

A. Perfil abre en MI PERFIL.  
B. Cambio a MIS DATOS.  
C. Editar Datos abre como pantalla completa.  
D. Labels visibles con campos ya cargados.  
E. Editar foto y guardar.  
F. Foto aparece también en Home.  
G. Guardar muestra toast.  
H. Cambiar contraseña y volver a iniciar sesión.  
I. Cerrar sesión.  
J. Sin sesión no se puede acceder a Historial/Perfil personal.  
K. Registrar partido sin cuenta.  
L. Volver a login y comprobar que el historial personal no fue contaminado.  
M. Home → tocar avatar/nombre → MI PERFIL.  
N. 0 regresiones en los 650 tests existentes + nuevos tests.

---

# 13. ORDEN DE TRABAJO

Antes de implementar:

1. Leer este consolidado completo.
2. Auditar cómo quedaron las vistas V03.0 y los puntos exactos de navegación/sesión.
3. Proponer plan breve.
4. Señalar cualquier riesgo real antes de tocar código.
5. Implementar sin rehacer arquitectura estable.
6. Ejecutar tests.
7. Validar mobile y desktop.
8. Publicar.
9. Generar Informe.

No volver a debatir decisiones ya confirmadas de V03.0 salvo que aparezca un conflicto técnico real.

---

# 14. ENTREGA

Publicar como:

**BRAMUlab V03.0.1**

Actualizar:

- `Store.VERSION` / `APP_VERSION` según estructura actual;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.1_Informe.md`

El informe debe incluir:

- pantallas modificadas;
- estructura MI PERFIL / MIS DATOS;
- comportamiento sin sesión;
- tratamiento de partido invitado;
- corrección de foto en Home;
- edición de datos;
- acceso y seguridad;
- cambio de contraseña;
- toasts;
- tests;
- validación mobile/desktop;
- hashes;
- tag;
- deploy;
- diferencias justificadas respecto de este consolidado.

---

# CRITERIO PRINCIPAL

V03.0.1 no busca agregar más producto.

Busca que la identidad creada en V03.0 **se sienta bien usada**.

La experiencia debería quedar así:

- con sesión → tengo mi jugador, mi perfil deportivo y mis datos;
- sin sesión → BRAMU no expone mi información personal;
- editar datos → se entiende qué estoy editando;
- guardar → recibo confirmación;
- mi foto y mi identidad → aparecen coherentemente en toda la app.

Después de cerrar esta ronda, avanzar a V03.0.2 para diseñar la pantalla y arquitectura de Notificaciones.
