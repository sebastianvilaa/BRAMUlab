# BRAMUlab V03.0.2 — Sistema visual transversal, Perfil y Notificaciones

## Objetivo de la ronda

V03.0.1 quedó funcionalmente validada y publicada.

La prueba real mostró que el principal problema pendiente ya no es de arquitectura ni de lógica: **varias pantallas funcionan, pero no se sienten todavía como partes del mismo producto**.

Esta ronda debe resolver eso tomando una decisión central:

> **El Home actual es la referencia visual principal de BRAMU. No se rediseña.**
>
> El trabajo consiste en identificar qué decisiones visuales ya funcionan en el Home y convertirlas en reglas reutilizables para el resto de la app, aplicándolas con criterio y no de forma mecánica.

No todas las pantallas deben parecerse al Home.
Sí deben compartir sus constantes: jerarquía, densidad, header, márgenes, lenguaje de tarjetas, color, tipografía, iconografía, navegación y comportamiento.

Además, esta ronda incorpora la primera pantalla real de **Notificaciones**, porque forma parte del mismo sistema transversal y no debe nacer con otro lenguaje visual.

---

# 0. PRINCIPIO DE TRABAJO — IMPORTANTE

## NO REDISEÑAR EL HOME

El Home actual es la fuente de verdad visual más madura.

No proponer alternativas A/B/C.
No rehacer tarjetas del Home.
No cambiar su estructura general.
No modificar Último partido, Tu momento, Actividad, Efectividad, etc., salvo una corrección puntual explícitamente pedida en este consolidado.

## EXTRAER, NO COPIAR

Antes de implementar:

1. auditar el CSS/markup REAL del Home actual;
2. identificar sus constantes visuales;
3. reutilizar esas constantes en las pantallas que correspondan;
4. no copiar componentes del Home cuando la función de la pantalla sea distinta.

Ejemplos de constantes a extraer del Home:
- altura y padding del header;
- márgenes laterales;
- ancho útil;
- radios;
- bordes;
- tratamiento del fondo;
- jerarquías tipográficas;
- verde / azul / grises;
- glow;
- alturas táctiles;
- navegación inferior;
- densidad vertical;
- iconografía.

Si alguna regla actual ya existe como variable/token CSS, reutilizarla.
Si está repetida como valores sueltos, centralizarla solo cuando hacerlo reduzca inconsistencias sin provocar una refactorización innecesaria.

---

# 1. SISTEMA DE HEADER — UNA CONSTANTE PARA TODA LA APP

Durante la prueba real se detectó que Home, Perfil, Ranking, Login, Cambiar contraseña y otras vistas usan alturas, posiciones de flecha y jerarquías diferentes.

## AGREGAR / FUSIONAR

Definir un **header base reutilizable** tomando como referencia exacta el header actual del Home.

Debe compartir:
- misma altura total;
- mismo padding horizontal;
- misma alineación vertical;
- misma relación con el borde/divisor inferior;
- misma zona segura superior;
- misma escala de iconos.

### Variantes permitidas

#### A. Pantallas raíz con sesión
Ejemplos:
- Home
- Historial
- Ranking
- Perfil

Usan la misma altura del header.

No agregar flecha “volver” por sistema a una pantalla raíz accesible desde la bottom nav.

El contenido izquierdo puede ser:
- logo BRAMU en Home;
- título de sección en Historial / Ranking / Perfil.

Acción derecha opcional:
- campana;
- editar;
- otra acción contextual futura.

#### B. Pantallas secundarias con sesión
Ejemplos:
- Editar datos
- Cambiar contraseña
- Notificaciones
- otras vistas internas

Usar:
- flecha volver siempre en la misma coordenada;
- título siempre en la misma línea/base;
- acción derecha opcional.

No cambiar la posición de la flecha de una pantalla a otra.

#### C. Pantallas sin sesión
Ejemplos:
- Bienvenida
- Iniciar sesión
- Crear cuenta
- Completar acceso legacy

Mantener el lenguaje BRAMU y la misma lógica de espaciado/header, pero sin bottom nav personal.

La pantalla raíz de Bienvenida puede usar el wordmark BRAMU como elemento principal.
Las pantallas secundarias de autenticación usan header con volver + título; no hace falta repetir logos decorativos sin función.

## NO AGREGAR

No sumar logos “lavados”, marcas de agua o decoraciones solo para llenar espacio.
La identidad debe aparecer por el sistema, no por repetir el logo.

---

# 2. BOTTOM NAV — REGLA ÚNICA

## CONFIRMADO

### Con sesión activa

Mantener la bottom nav visible en:
- pantallas raíz;
- Perfil;
- Editar datos;
- Cambiar contraseña;
- Notificaciones;
- otras pantallas internas donde navegar a Inicio/Historial/Ranking/Perfil sea una salida válida.

Si el usuario abandona una edición mediante la bottom nav sin guardar, simplemente abandona los cambios no guardados.

No agregar confirmaciones de salida salvo que exista riesgo real de pérdida de información ya persistida.

### Sin sesión

No mostrar bottom nav personal.

Esto ya fue corregido en V03.0.1 y debe mantenerse.

### Partido en vivo

No cambiar el comportamiento actual de navegación del marcador salvo necesidad técnica real.

---

# 3. BUG — AVATAR DEL HOME

Durante la validación publicada de V03.0.1:

- la foto de perfil aparece;
- pero el icono/avatar genérico anterior sigue visible y se mezcla con la foto.

## CORREGIR

Cuando existe `profilePhoto`:

- mostrar únicamente la foto;
- ocultar completamente el fallback genérico.

Cuando no existe foto:

- mostrar únicamente el fallback.

No superponer ambas capas.
No duplicar la fuente de datos.
Seguir leyendo `Store.getCurrentUser().profilePhoto`.

No rediseñar el resto de la tarjeta del Home.

---

# 4. PERFIL — JERARQUÍA GENERAL

Las pestañas **MI PERFIL / MIS DATOS** funcionan conceptualmente y se mantienen.

## AJUSTAR — pestañas

Actualmente el estado activo no se diferencia lo suficiente.

Mejorar contraste sin inventar un componente ajeno a BRAMU.

Criterio:
- activo claramente identificable;
- inactivo secundario;
- usar tipografía/color/línea/acento coherente con Home;
- evitar dos botones gigantes compitiendo entre sí.

Los nombres siguen centralizados y fáciles de cambiar.

---

# 5. MI PERFIL — FICHA DEPORTIVA

## OBJETIVO

MI PERFIL no debe ser una copia del Home.

Diferencia conceptual:

- **Home** = estado actual / lectura rápida / qué está pasando ahora.
- **Mi Perfil** = ficha deportiva / identidad como jugador / evolución en el tiempo.

## FUSIONAR LENGUAJE VISUAL

La cabecera deportiva actual de MI PERFIL debe guardar relación evidente con la tarjeta de jugador del Home.

Debe reutilizar el mismo lenguaje para:
- foto/avatar;
- nombre visible;
- @usuario;
- Nivel BRAMU / calibración;
- progreso o indicador de nivel cuando corresponda.

No es obligatorio que sea el mismo componente pixel por pixel, pero debe sentirse como la misma identidad del jugador.

### Corregir jerarquía actual

Hoy:
- nombre;
- @usuario;
- “X partidos cargados”

quedan demasiado separados y sin relación clara.

Agrupar visualmente identidad + estado deportivo.

## KPIs

No duplicar todos los widgets del Home.

En MI PERFIL mostrar solo información que tenga sentido como ficha estable/deportiva.

Base recomendada:
- Efectividad total;
- Racha actual;
- Partidos considerados/cargados;
- Nivel BRAMU / calibración.

Si existe otro KPI ya calculado y claramente útil para perfil, puede reutilizarse.
No inventar nuevas estadísticas.

---

# 6. EVOLUCIÓN DEL NIVEL BRAMU — HACER EL GRÁFICO LEGIBLE

El gráfico actual muestra una línea pero no permite entender bien:

- cuánto cambió;
- cuándo cambió;
- qué representa cada tramo.

## MEJORAR

### Eje Y

Agregar referencias numéricas de Nivel BRAMU.

No inventar una escala nueva de negocio.
Usar los valores reales disponibles en la serie.

La escala visible debe adaptarse a los datos, dejando un margen razonable arriba/abajo para que la línea sea legible.

### Eje X

Agregar tiempo.

Usar las fechas reales de los partidos considerados.

La granularidad visual debe adaptarse al rango:

- rango corto → días/fechas;
- rango intermedio → semanas o fechas espaciadas;
- rango largo → meses.

No es necesario agregar una etiqueta a cada punto.
Seleccionar etiquetas suficientes para orientar sin saturar.

### Importante

- no usar scroll horizontal como solución principal;
- el gráfico debe entrar en el ancho disponible;
- mantener todos los puntos relevantes de la serie;
- si hay muchos puntos, reducir etiquetas, no datos;
- tooltip/tap de punto es opcional solo si ya puede hacerse sin complejidad innecesaria.

Para cuentas nuevas en calibración:
- respetar el gate actual;
- no inventar nivel numérico;
- no mostrar evolución numérica falsa.

---

# 7. MIS DATOS — ORDEN Y EDICIÓN

La separación conceptual de MIS DATOS funciona.

El problema actual es visual:
- labels a izquierda;
- valores pesados a derecha;
- alineaciones que hacen que la pantalla parezca una tabla administrativa;
- botón grande EDITAR DATOS interrumpe la lectura.

## REEMPLAZAR — botón Editar datos

Quitar el botón full-width **EDITAR DATOS**.

Agregar una acción de edición con **icono lápiz** en la parte superior derecha de la sección de datos.

Debe tener:
- target táctil cómodo;
- icono consistente con el sistema de iconos;
- `aria-label`/texto accesible “Editar datos”.

Abre la pantalla existente Editar datos.

## REORDENAR — campos

En mobile, todos los contenidos deben sentirse alineados a una misma grilla izquierda.

Usar jerarquía:

Label pequeño/secundario  
Valor principal debajo o inmediatamente asociado

Ejemplo:

Nombre  
**Sebastian**

No usar la lógica de “label a izquierda / valor fuerte pegado al margen derecho” como patrón general.

Mantener los grupos:
- Identidad;
- Datos personales / deportivos;
- Acceso y seguridad.

## ACCESO Y SEGURIDAD

Evitar que parezca una colección de botones gigantes.

Mostrar:
- Email;
- Cambiar contraseña;
- Cerrar sesión.

“Cambiar contraseña” puede funcionar como fila/acción con chevron o affordance equivalente.
“Cerrar sesión” debe ser claramente secundario/destructivo, pero integrado al mismo bloque.

---

# 8. EDITAR DATOS — REFINAMIENTO DE FORMULARIO

La decisión de usar pantalla completa se mantiene.

## AJUSTAR

Aplicar el sistema de header definido en §1.

Mantener:
- labels persistentes;
- foto;
- username;
- nombre visible;
- fecha;
- género;
- mano dominante;
- lado habitual;
- categoría.

### Selectores / desplegables

Durante prueba real algunos desplegables siguen viéndose demasiado chicos o poco integrados.

Revisar tamaños y targets táctiles.

No depender de un `<select>` visualmente diminuto si rompe la experiencia mobile.
Si se usa control nativo, asegurar que el trigger tenga:
- altura suficiente;
- tipografía correcta;
- padding;
- ancho completo.

No rehacer controles segmentados que ya funcionan.

### Guardado

Mantener toast “Datos guardados”.

---

# 9. CAMBIAR CONTRASEÑA — INTEGRARLA A LA APP

Funcionalmente quedó validado:
- contraseña actual;
- cambio;
- contraseña vieja deja de funcionar;
- nueva funciona.

No cambiar esa lógica.

## AJUSTAR VISUALMENTE

Aplicar:
- header base;
- misma posición de back;
- mismos márgenes laterales;
- misma tipografía de labels;
- mismo ritmo vertical de formularios.

### Ojo de contraseña

Reemplazar el icono actual tipo círculo/objetivo por un icono reconocible de:
- ojo;
- ojo tachado cuando está visible.

Usar el mismo componente en:
- Login;
- Completar acceso;
- Cambiar contraseña;
- Signup donde corresponda.

### Autocomplete

Revisar atributos HTML adecuados:
- `autocomplete="current-password"`
- `autocomplete="new-password"`
- `autocomplete="email"`

No intentar controlar/estilizar el popup de Google Password Manager: es UI del navegador.
Sí asegurar que los campos estén semánticamente bien declarados para integrarse correctamente con gestores de contraseña.

---

# 10. BIENVENIDA SIN SESIÓN — DARLE IDENTIDAD BRAMU

La lógica actual es correcta:

- INICIAR SESIÓN
- CREAR CUENTA
- REGISTRAR PARTIDO SIN CUENTA

No cambiar.

El problema es visual: hoy se siente como una pantalla separada del producto y el tercer acceso queda “colgado”.

## REDISEÑAR SOLO ESTA PANTALLA BASÁNDOSE EN EL HOME

Usar el mismo lenguaje del Home:
- wordmark;
- fondo;
- márgenes;
- tipografía;
- radios;
- verde;
- secundarios oscuros;
- densidad.

Jerarquía recomendada:

1. INICIAR SESIÓN — principal
2. CREAR CUENTA — secundario
3. REGISTRAR PARTIDO SIN CUENTA — acción terciaria clara y deliberada

La tercera opción NO debe parecer:
- un link olvidado;
- cancelar;
- texto suelto.

Puede ser botón ghost/outline/secundario con un pequeño texto explicativo si ayuda:

“Jugá sin crear perfil ni guardar historial.”

No agregar bottom nav.

---

# 11. LOGIN / SIGNUP / COMPLETAR ACCESO — MISMA FAMILIA

Aplicar un único patrón visual de autenticación.

## FUSIONAR

Compartir:
- header;
- márgenes;
- anchura de formulario;
- labels;
- inputs;
- feedback;
- CTA;
- eye icon;
- errores.

### Login

Corregir el error actual:
“Revisá tu email y contraseña.”

Hoy queda demasiado pegado al campo.

Agregar separación suficiente y mantenerlo claramente asociado al formulario.

No cambiar el texto salvo necesidad.

### Crear cuenta

No rediseñar el flujo de 3 pasos desde cero.
Solo aplicar las constantes transversales cuando corresponda.

### Completar acceso

Mantener pantalla completa y lógica actual.
Aplicar mismo sistema de autenticación.

---

# 12. NOTIFICACIONES — PANTALLA REAL

## REEMPLAZAR

La campana ya no debe abrir un popup pequeño.

Debe abrir una pantalla completa **NOTIFICACIONES**, usando el header secundario estándar.

Bottom nav:
- visible si existe sesión;
- no existe esta pantalla sin sesión.

## ESTRUCTURA

Orden cronológico descendente.

Agrupación visual recomendada:
- Hoy
- Esta semana
- Anteriores

Cada notificación debe poder distinguir:
- no leída;
- leída;
- positiva;
- informativa;
- acción pendiente.

No convertirlo en un carnaval de colores.
Usar el lenguaje BRAMU:
- lima para positivo;
- azul/cian para informativo;
- ámbar/alerta moderada para pendiente;
- rojo solo para error real/destructivo.

## PRIMER MODELO LOCAL

Como todavía no existe backend, las notificaciones de V03.0.2 son locales y por usuario.

### AGREGAR almacenamiento simple

Nueva colección local, por ejemplo:

`bramulab.notifications.v1`

Cada registro debe incluir al menos:
- `id`
- `userId`
- `type`
- `title`
- `body`
- `createdAt`
- `readAt` o estado leído/no leído
- `action`/destino opcional si corresponde

`userId` es obligatorio para no mezclar notificaciones entre cuentas locales.

No usar nombre visible como identidad.

## EVENTOS INICIALES

Generar solo eventos respaldados por acciones/datos reales que ya existen.

Base V03.0.2:

- perfil actualizado;
- acceso completado;
- contraseña actualizada;
- partido guardado para la cuenta activa;
- perfil incompleto / faltan datos, con deduplicación;
- cambio real del Nivel BRAMU cuando la lógica actual efectivamente produzca un cambio.

Para cuentas nuevas en calibración:
- no generar “nuevo nivel X”;
- puede notificarse progreso de calibración solo si se puede hacer sin inventar datos.

No implementar todavía notificaciones sociales como:
- “Fulanito cargó un partido contigo”;
- invitaciones;
- amigos;
- solicitudes;
- ranking global.

Eso requiere backend y queda futuro.

## INTERACCIÓN

- campana puede mostrar badge con cantidad no leída;
- tocar notificación la marca leída;
- si tiene destino claro, navegar a él;
- agregar “Marcar todas como leídas” como acción secundaria si es simple.

Mantener los toasts existentes.
Toast = confirmación inmediata.
Notificación = historial persistente de actividad.

---

# 13. CONSISTENCIA DE ICONOS

## AUDITAR / FUSIONAR

Unificar los iconos nuevos/tocados en esta ronda:
- back;
- bell;
- pencil;
- eye / eye-off;
- chevrons;
- close/logout cuando corresponda.

Evitar mezclar:
- emojis;
- caracteres Unicode improvisados;
- SVG con grosores radicalmente diferentes;
- iconos circulares cuando el significado no lo necesita.

No hace falta reemplazar todos los iconos de la app en esta ronda.
Solo evitar agregar más inconsistencia y corregir los claramente involucrados.

---

# 14. ESPACIADO Y DENSIDAD

Usar Home como referencia.

Corregir especialmente:
- tarjetas demasiado separadas en Perfil;
- paddings excesivos;
- secciones que parecen “flotar” sin relación;
- formularios demasiado pegados o demasiado vacíos.

No reducir targets táctiles.

La app debe seguir siendo cómoda al aire libre y en mobile.

---

# 15. NO TOCAR

No implementar en V03.0.2:

- backend;
- Supabase/Firebase;
- ranking real;
- fórmula real nueva de Nivel BRAMU;
- amigos;
- social;
- asociación remota de partidos;
- notificaciones push;
- notificaciones de otros usuarios;
- Player Intelligence nuevo;
- rediseño general del Home;
- rediseño general de Historial;
- rediseño del marcador;
- cambios en `findPlayerRow` / identidad estable salvo necesidad de usar `userId` en notificaciones.

---

# 16. TESTS Y USO EFICIENTE

La ronda es principalmente visual/UX.

## NO GASTAR TOKENS EN CICLOS REDUNDANTES

Durante implementación:
- usar tests focalizados por bloque;
- no correr la suite completa después de cada cambio visual;
- hacer una corrida completa al cierre.

Mantener todos los tests existentes verdes.

Agregar tests solo donde haya nueva lógica real, especialmente:

- notificaciones separadas por `userId`;
- unread/read;
- deduplicación de “perfil incompleto”;
- partido guardado genera notificación solo para sesión activa;
- invitado no genera notificación personal;
- cambio de contraseña no rompe sesión/identidad;
- cambio real de nivel genera notificación solo cuando corresponde;
- logout/login no mezcla notificaciones entre cuentas.

QA manual mobile + desktop:

1. Home visualmente sin regresiones.
2. Avatar Home: foto o fallback, nunca ambos.
3. Header con misma altura/alineación en Home, Historial, Ranking, Perfil.
4. Perfil: tabs claramente distinguibles.
5. MI PERFIL: identidad deportiva coherente con Home.
6. Gráfico con referencias X/Y legibles.
7. MIS DATOS: alineación izquierda y lápiz de edición.
8. Editar datos: formulario claro.
9. Cambiar contraseña: header/eye/spacing correctos.
10. Logout → Bienvenida coherente con BRAMU.
11. Login visualmente integrado.
12. Error login con separación correcta.
13. Registrar partido sin cuenta sigue funcionando.
14. Bell → pantalla Notificaciones.
15. Badge/read/unread funcionan.
16. Notificaciones de otra cuenta local no aparecen.
17. Bottom nav visible/oculta según reglas de esta versión.
18. Suite completa final sin regresiones.

---

# 17. FORMA DE TRABAJO CON CLAUDE — SIN APROBACIONES INTERMEDIAS

Este consolidado se considera suficientemente cerrado.

## CLAUDE DEBE

1. leer completo el consolidado;
2. hacer una auditoría breve interna del estado actual;
3. implementar directamente;
4. usar tests focalizados durante la ejecución;
5. correr suite completa al final;
6. validar mobile + desktop;
7. corregir errores encontrados dentro de este alcance;
8. generar informe;
9. commit;
10. tag;
11. push;
12. deploy.

## NO DEBE

- detenerse para presentar un plan y esperar aprobación;
- pedir confirmación por decisiones ya especificadas aquí;
- rehacer arquitectura estable.

Solo detenerse si aparece:
- riesgo real de pérdida de datos;
- contradicción que cambie producto;
- acción destructiva no prevista;
- necesidad real de salir del alcance.

---

# 18. VERSIONADO Y ENTREGA

Publicar como:

**BRAMUlab V03.0.2**

Actualizar:
- `APP_VERSION`;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.0.2_Informe.md`

El informe debe incluir:
- sistema de header aplicado;
- reglas de bottom nav;
- pantallas tocadas;
- qué se extrajo del Home;
- corrección avatar;
- Perfil/Mis Datos;
- gráfico;
- autenticación;
- Notificaciones;
- modelo local de notificaciones;
- tests;
- QA mobile/desktop;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

---

# CRITERIO DE ÉXITO

Al terminar V03.0.2:

- el Home debe seguir sintiéndose igual de BRAMU que antes;
- Perfil, Login, Cambiar contraseña, Bienvenida y Notificaciones deben parecer partes del mismo producto;
- las pantallas no deben ser clones del Home;
- las constantes visuales sí deben ser reconocibles;
- la navegación debe sentirse estable;
- el usuario debe dejar de notar cambios arbitrarios de altura, flechas, márgenes o jerarquías al pasar de una pantalla a otra;
- Notificaciones debe dejar de ser decorativa y empezar a tener utilidad real basada en datos existentes.
