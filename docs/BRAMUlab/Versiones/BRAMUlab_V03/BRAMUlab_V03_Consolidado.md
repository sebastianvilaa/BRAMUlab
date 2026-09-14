# BRAMUlab_V03
## Consolidado — qué se especificó

**Tipo de documento:** consolidado retrospectivo (síntesis documental, no una ronda nueva de implementación).
**Fecha de esta síntesis:** 10/09/2026 — actualizado el 14/09/2026 para reflejar el cierre final de la línea en V03.10.
**Cubre:** desde V03.0 (identidad del jugador) hasta V03.10 (cierre final de V03).
**Por qué existe este documento:** hasta V03.4.6, cada ronda de desarrollo (27 en total: V03.0, sus 5 subversiones de identidad, V03.1 y sus 5 microparches, V03.1.6, V03.2 y sus 2 correcciones, V03.3 y sus 3 microparches, V03.4 y sus 5 microparches) tuvo su propio par Consolidado+Informe suelto — 54 archivos en total. Este documento junta, en un solo lugar y en orden cronológico, qué se pidió implementar en cada ronda — la fuente de "qué se implementó realmente" es [`BRAMUlab_V03_Informe.md`](BRAMUlab_V03_Informe.md). Desde V03.5 en adelante, cada ronda ya usa el esquema de un solo par de archivos por versión (`BRAMUlab_V03.X.md` + `BRAMUlab_V03.X_Reporte_ChatGPT.md`, ambos conservados en este mismo directorio) — este documento sigue sintetizándolos acá para mantener una sola línea cronológica legible.

**V03 quedó CERRADA en V03.10** (tag `BRAMUlab_V03.10`), a diferencia de cuando se escribió la primera versión de este documento, cuando la línea seguía activa en V03.4.6. Este documento pasa a ser el cierre documental completo de la línea — no se espera que sume más rondas después de V03.10 salvo instrucción explícita. Los documentos originales de cada ronda anterior a V03.5 (citados abajo por nombre) ya se borraron del repositorio una vez confirmado que este consolidado y el Informe capturaban todo lo que valía la pena conservar — siguen recuperables del historial de git (commit `40c82bc` o anterior) si hiciera falta el texto exacto de alguno. Los documentos de V03.5 en adelante siguen presentes en el repositorio (no se archivaron ni se borraron).

---

## 0. Qué es BRAMUlab_V03

La versión mayor que agrega **identidad real del jugador** (cuenta local con email/contraseña, Player Card, Perfil editable, calibración de Nivel BRAMU) sobre la misma base visual/funcional que dejó cerrada `BRAMUlab_V02.9.3`. A partir de ahí la línea sumó, en orden: un sistema completo de cuentas/sesión, notificaciones, una ficha deportiva de Perfil separada de los datos administrativos, una auditoría y normalización de todo el sistema visual transversal (botones/modales/acceso), un primer sistema social liviano ("Jugadores": buscar, perfil público, agregar) y finalmente "Mis Grupos" — competencia privada semanal entre jugadores conocidos, con puntos, bonuses, Race anual y BRAMU Intelligence grupal.

No hay backend real en ningún punto de esta línea — todo (cuentas, notificaciones, jugadores agregados, grupos, ubicación) es prototipo `localStorage`, explícitamente aislado para ser reemplazado en una futura V04.

---

## 1. V03.0 — Identidad del jugador (base)

**Fuente:** `BRAMUlab_V03.0_Consolidado.md`

Abre la etapa: reemplazar la identificación por nombre de texto plano por una experiencia completa de cuenta — pantalla de Acceso (Iniciar sesión/Crear cuenta), Crear cuenta en 3 pasos (acceso: email/contraseña; identidad: foto/nombre/apellido/@usuario/nombre visible; pádel: fecha de nacimiento/género/mano/lado/categoría declarada), pantalla de recompensa "TU JUGADOR ESTÁ LISTO" con una Player Card estilo ficha deportiva FIP/Premier Padel, calibración del Nivel BRAMU ("CALIBRANDO · X/5 PARTIDOS" para cuentas nuevas, nunca un número inventado), Perfil editable, Iniciar sesión, y migración obligatoria de cualquier dispositivo con datos previos (nombre + historial) a una cuenta nueva sin fricción. Explícitamente fuera de alcance: backend, Supabase/Firebase, ranking real, fórmula de nivel oficial, autotest de categoría, amigos/grupos, y cualquier rediseño de Home/Historial no pedido.

## 2. V03.0.1 — Refinamiento UX de Perfil, Acceso y sesión

**Fuente:** `BRAMUlab_V03.0.1_Consolidado.md`

V03.0 quedó funcionalmente validada en producción (migración, login/logout, persistencia, `userId` estable). Esta ronda es de UX y corrección de bugs visibles, sin reabrir esa arquitectura: Perfil pasa a dos pestañas (MI PERFIL / MIS DATOS), Editar Datos y Completar Acceso pasan de modal a pantalla completa con labels persistentes, se agrega Cambiar contraseña, Cerrar sesión se reubica en MIS DATOS → Acceso y seguridad, se corrige que la foto de perfil no aparecía en el Home, se agregan toasts de confirmación, y — el cambio más importante — sin sesión activa la app debe dejar de exponer pantallas personales (Historial/Ranking/Perfil), mostrando en su lugar "BIENVENIDO A BRAMU" con Iniciar sesión / Crear cuenta / Registrar partido sin cuenta, con el partido de invitado resuelto de la forma más simple y segura posible (sin selector de "¿contás este partido?").

## 3. V03.0.2 — Sistema visual transversal, Perfil y Notificaciones

**Fuente:** `BRAMUlab_V03.0.2_Consolidado.md`

Principio explícito: "el Home actual es la referencia visual principal de BRAMU. No se rediseña" — el trabajo es extraer sus constantes (header, márgenes, tipografía, densidad) y aplicarlas al resto de pantallas, no copiarlas mecánicamente. Define un sistema de header único con 3 variantes (raíz con sesión / secundaria con sesión / sin sesión), una regla única de bottom nav (visible con sesión salvo excepciones), corrige el bug de avatar duplicado (foto + ícono genérico simultáneos), mejora la jerarquía de MI PERFIL y hace legible el gráfico de Evolución del Nivel BRAMU (ejes con referencias reales, sin scroll horizontal). Agrega la primera pantalla real de **Notificaciones** (antes un popup), con modelo local nuevo (`bramulab.notifications.v1`, aislado por `userId`) y eventos generados solo a partir de acciones reales ya existentes (perfil actualizado, acceso completado, contraseña actualizada, partido guardado, perfil incompleto con deduplicación, cambio real de Nivel BRAMU).

## 4. V03.0.3 — Perfil deportivo, acceso público y correcciones visuales

**Fuente:** `BRAMUlab_V03.0.3_Consolidado.md`

Tres frentes: (1) MI PERFIL todavía no funciona como ficha deportiva real — pide convertir su cabecera en el lenguaje de la tarjeta del Home, foto editable in-situ, y una ficha compacta con datos declarados + rendimiento calculable (jugados/ganados/efectividad/racha actual/mejor racha/mejor Nivel BRAMU histórico), sin inventar ranking ni puntos; (2) la familia sin sesión (Bienvenida/Login/Crear cuenta/Completar acceso) todavía no se siente suficientemente BRAMU; (3) ajustes puntuales: corregir definitivamente el bug de avatar duplicado, corregir el sesgo de escala Y del gráfico de Evolución (no debe incluir el 5.0 de arranque si el jugador nunca volvió ahí), restaurar las flechas "volver" de Historial/Ranking/Perfil (que V03.0.2 había quitado y no quedó bien), y reemplazar el selector de modo de "Registrar partido sin cuenta" por tabs claras (Punto a punto/Por games).

### 4.1 V03.0.3.1 — Recuperación simulada de contraseña + ajustes menores

**Fuente:** `BRAMUlab_V03.0.3.1_Consolidado.md`

Parche corto: agregar "¿Olvidaste tu contraseña?" en Login con flujo simulado de 3 pasos (email → código fijo `123456` → nueva contraseña), sin ningún texto "Simulado"/"Demo" visible en la UI (la simulación vive solo en la lógica); regla crítica de preservar exactamente la misma cuenta (`userId`, email, historial, notificaciones intactos, solo cambia la contraseña); limpiar la cabecera de MI PERFIL para mostrar solo el Nivel BRAMU actual (sin `+X`/variación); quitar "Quitar foto" de MI PERFIL/MIS DATOS; quitar la etiqueta visible "SIMULADO" de toda la UI (sin tocar la lógica subyacente).

### 4.2 V03.0.3.2 — Recuperación desde sesión + tabs de modo

**Fuente:** `BRAMUlab_V03.0.3.2_Consolidado.md`

Dos objetivos: permitir recuperar/cambiar contraseña estando ya logueado aunque no se recuerde la actual (reutilizando el mismo flujo de código `123456` pero sin pedir email, arrancando directo en el paso del código), y refinar visualmente "PUNTO A PUNTO | POR GAMES" para que se lean como tabs/solapas (bajas, subrayado activo lima) y no como botones grandes — mismo patrón ya aprobado en MI PERFIL/MIS DATOS.

## 5. V03.1 — Rediseño de MI PERFIL + compactación de MIS DATOS

**Fuente:** `BRAMUlab_V03.1_Consolidado.md`

Redefine la separación conceptual: MI PERFIL es "quién sos como jugador" (identidad deportiva pública/compartible, a futuro base de un perfil visible por otros), MIS DATOS es "tu cuenta privada". Pide: cabecera de MI PERFIL con Nombre visible + @usuario + Nivel BRAMU + Edad/Mano/Lado dentro de la misma tarjeta; eliminar el bloque "DATOS DECLARADOS" y la categoría de MI PERFIL (la categoría pasa a vivir solo en MIS DATOS, con fecha de declaración); bloque de Rendimiento con Efectividad como KPI protagonista (donut) + Partidos jugados/ganados + Racha actual (nunca mostrando derrotas, "—" si no hay racha) + Mejor racha (con contexto temporal); Evolución del Nivel BRAMU simplificada a Nivel actual + Cambio últimos 30 días, gráfico de línea limpia sin puntos ni tooltips, eje Y adaptativo en pasos de 0,25, eje X con densidad adaptativa (4-8 referencias); compactación de MIS DATOS (identidad en una tarjeta con foto a la izquierda, datos personales agrupados en filas); Cambiar contraseña con touch target correcto; y Cerrar sesión separado visualmente + con modal de confirmación.

### 5.1 V03.1.1 — Pulido de MI PERFIL + simplificación de MIS DATOS

**Fuente:** `BRAMUlab_V03.1.1_Consolidado.md`

Tres pulidos visuales sobre V03.1: alinear las columnas Edad/Mano dominante/Lado habitual (mismo ancho visual, buen spacing); reemplazar el bloque único de Rendimiento por 5 tarjetas independientes (Efectividad protagonista + Partidos jugados/ganados + Racha actual/Mejor racha), sin título "RENDIMIENTO"; reemplazar las etiquetas `SEM X` del eje X de Evolución por fechas reales o meses (nunca volver a `SEM X`); y en MIS DATOS eliminar los títulos redundantes "TUS DATOS"/"IDENTIDAD" e integrar el lápiz de edición dentro de la propia tarjeta de identidad.

### 5.2 V03.1.2 — Microparche de composición en Perfil

**Fuente:** `BRAMUlab_V03.1.2_Consolidado.md` (pegado directamente en el chat, sin documento previo)

Ajuste corto: fusionar Efectividad + Partidos jugados + Partidos ganados en UNA sola tarjeta integrada (donut a la izquierda, partidos agrandados a la derecha), y reducir/normalizar el espaciado vertical entre tarjetas tanto en MI PERFIL como en MIS DATOS, tomando el ritmo del Home como referencia.

### 5.3 V03.1.3 — Microparche final de MI PERFIL

**Fuente:** `BRAMUlab_V03.1.3_Consolidado.md` (pegado en el chat)

Agregar un KPI nuevo de "pico histórico del propio nivel" (nombrado explícitamente para nunca sugerir ranking comunitario — "Mejor nivel BRAMU" o "Pico de nivel BRAMU"), con `ACT` si coincide con el actual o mes/año si no; ampliar la tarjeta de Efectividad (donut más grande, label arriba); y agregar una animación sutil de entrada a la línea del gráfico de Evolución (sin puntos, sin tooltips nuevos).

### 5.4 V03.1.4 — Ajuste de composición en Evolución + ritmo vertical de Perfil

**Fuente:** `BRAMUlab_V03.1.4_Consolidado.md` (feedback de audio del usuario, transcripto)

Sobre la V03.1.3 ya publicada: la tarjeta suelta de "Mejor nivel BRAMU" no quedó bien — pide moverla dentro de la tarjeta de Evolución (Nivel actual + Cambio 30 días a la izquierda, Mejor nivel BRAMU anclado a la derecha); unificar el espaciado entre tarjetas de MI PERFIL/MIS DATOS tomando a Home como referencia (detectó que había dos ritmos distintos conviviendo); y achicar "un poquitito" el donut de Efectividad (agrandado en la ronda anterior).

### 5.5 V03.1.5 — Corrección de línea en la tarjeta de Evolución

**Fuente:** `BRAMUlab_V03.1.5_Consolidado.md` (feedback de audio, transcripto)

Corrección puntual sobre V03.1.4: los 3 datos de la cabecera de Evolución (Nivel actual, Cambio 30 días, Mejor nivel BRAMU) deben quedar siempre en una sola línea — en la versión publicada, Mejor nivel BRAMU saltaba a una segunda fila. El usuario confirma explícitamente que "el resto quedó todo bien".

## 6. V03.1.6 — Corrección de loop infinito de actualización

**Fuente:** `BRAMUlab_V03.1.6_Consolidado.md` (reporte de bug en producción, transcripto)

Bug real reportado por el usuario: al actualizar a V03.1.5, el cartel de "hay una nueva versión" reaparece en loop infinito por más veces que se toque ACTUALIZAR. Pide investigar y corregir la causa raíz (no solo el síntoma) — bug de infraestructura de caché, no de producto, sin tocar ninguna pantalla ni lógica de negocio, con prioridad al bloquear a un usuario real.

## 7. V03.2 — Sistema visual transversal: acceso, botones, modales y navegación

**Fuente:** `BRAMUlab_V03.2_Consolidado.md`

Auditoría y normalización explícita (no un rediseño desde cero): toma Home/Historial/Cargar partido/Resumen/MI PERFIL/MIS DATOS como pantallas de referencia ya aprobadas, y pide resolver inconsistencias en la familia completa de Acceso/Autenticación (Splash, Bienvenida, Login, Crear cuenta, Completar acceso, recuperación de contraseña), un sistema de 4 familias de botones por uso —primario lima / secundario funcional azul / secundario neutro gris / destructivo rojo— con tipografía y dimensiones consistentes, modales de confirmación unificados con acciones que nombren exactamente lo que hacen ("SALIR SIN GUARDAR" en vez de "Confirmar"), restaurar la bottom nav en la pantalla de carga/configuración de partido con sesión activa, y auditar el icono de app/glow para eliminar restos de la paleta verde-inglés heredada. Explícitamente sin autonomía para rediseñar Home/Historial/MI PERFIL/MIS DATOS ni tocar lógica de negocio.

### 7.1 V03.2.1 — Corrección visual de acceso, botones y carga manual

**Fuente:** `BRAMUlab_V03.2.1_Consolidado.md`

Corrección tras QA visual de V03.2 ya en producción — no una nueva exploración: pide una especificación tipográfica y dimensional ÚNICA para todos los botones equivalentes de la app (nunca un botón "especial" por vivir en otra pantalla), subir/agrandar el logo del Splash, eliminar "BIENVENIDO A BRAMU" (el logo ya comunica marca), renombrar "REGISTRAR PARTIDO SIN CUENTA" a "REGISTRAR PARTIDO COMO INVITADO", agregar el logo BRAMU Lab a Login/Crear cuenta, renombrar "CREAR ACCESO" a "CREAR CUENTA" en todo el flujo, simplificar el bottom sheet "Registrar partido" (sin chevrons decorativos), corregir la jerarquía del header de Carga manual (título fijo "CARGAR PARTIDO", el estado del set vive en el contenido), agrandar el bloque de resultado y asociar "Resultado válido" inmediatamente a él, y volver "Eliminar partido" a una acción textual (sin pastilla) de menor jerarquía.

### 7.2 V03.2.2 — Microparche visual sobre V03.2.1 (acceso + confirmar partido)

**Fuente:** `BRAMUlab_V03.2.2_Consolidado.md` (pegado en el chat, sin consolidado formal previo)

5 ajustes puntuales: más separación entre los 3 botones de Acceso y altura igualada entre ellos; más aire entre "¿Olvidaste tu contraseña?" y el botón de Login; y en Confirmar partido — corregir la alineación de la flecha del header, quitar el color lima del título (debe usar el mismo sistema que el resto de headers), más aire entre la pill VICTORIA y la tarjeta de ganadores, e igualar el ancho de la tarjeta de fecha/hora con el botón GUARDAR PARTIDO.

## 8. V03.3 — Perfil público, búsqueda y sistema de jugadores

**Fuente:** `BRAMUlab_V03.3_Consolidado.md`

Primera experiencia de "jugadores" sin red social completa. Principio de producto explícito: la única relación es "agregado o no" — nunca amigos/seguidores/popularidad/reciprocidad, y nunca mostrar cuántos jugadores tiene agregados alguien. Pide: una pantalla de Perfil público (identidad + Nivel BRAMU + edad/mano/lado + rendimiento —Efectividad, Mejor racha, Mejor nivel BRAMU—, nunca Racha actual ni Evolución, que son privadas) con acción AGREGAR JUGADOR / JUGADOR AGREGADO; una tarjeta "BUSCAR JUGADORES" al final del Home que abre una pantalla de búsqueda completa; un componente único de fila de jugador (avatar + nombre + @usuario + Nivel BRAMU destacado a la derecha) reutilizado en Buscar Jugadores, Elegir compañero/rival y una nueva tercera pestaña JUGADORES dentro de Perfil. Datos simulados/locales hasta que exista backend real, explícitamente aislados para reemplazo en V04. Fuera de alcance: seguidores, amigos, mensajes, invitaciones, armado de partido desde perfil, grupos, notificaciones sociales.

### 8.1 V03.3.1 — Microparche sobre V03.3 (Perfil público / Jugadores)

**Fuente:** `BRAMUlab_V03.3.1_Consolidado.md` (pegado en el chat)

6 ajustes: más margen en "BUSCAR JUGADORES" del Home y bajar el protagonismo de su texto; quitar el `border-radius` del componente `.player-row` para separadores rectos; el header del Perfil público pasa a decir "PERFIL DE JUGADOR" (fijo, no el nombre); toast "Jugador agregado" al tocar AGREGAR JUGADOR; reemplazar el botón "JUGADOR AGREGADO" (neutro, de aspecto final) por una acción destructiva de menor jerarquía "ELIMINAR DE JUGADORES" (mismo lenguaje que "Eliminar partido") con toast "Jugador eliminado"; sin swipe — el flujo para eliminar sigue siendo JUGADORES → abrir perfil → ELIMINAR DE JUGADORES.

### 8.2 V03.3.2 — Microparche sobre V03.3.1 (Recientes/Todos)

**Fuente:** `BRAMUlab_V03.3.2_Consolidado.md` (pegado en el chat)

Un solo pedido: agregar un título sutil "Recientes"/"Todos" arriba de los listados de Elegir compañero/rival y Buscar Jugadores, para explicar de dónde salen los nombres que aparecen sin contexto — reutilizando el label ya existente, mismo patrón en ambas pantallas.

### 8.3 V03.3.3 — Microparche sobre V03.3.2 (buscador dentro de JUGADORES)

**Fuente:** `BRAMUlab_V03.3.3_Consolidado.md` (pegado en el chat)

Agregar un buscador dentro de la pestaña JUGADORES de Perfil, para cuando esa lista personal crezca ("si tengo cien jugadores agregados"). El usuario plantea explícitamente la duda de si debe mostrar lo mismo que Buscar Jugadores — se aclara que son dos buscadores con propósitos distintos: Buscar Jugadores (universo completo, para descubrir) vs. este nuevo (solo dentro de lo ya agregado, para encontrar).

## 9. V03.4 — Mis grupos

**Fuente:** `BRAMUlab_V03.4_Consolidado.md`

Construye la primera versión de MIS GRUPOS como espacio privado de competencia — explícitamente NO el Ranking BRAMU oficial por ciudad/provincia/país. Reemplaza RANKING en la bottom nav. Principio de producto: la tabla del grupo mide "quién está rindiendo mejor en ese grupo y período", nunca "quién juega mejor" globalmente — el Nivel BRAMU no ordena la tabla. Especifica con precisión: creación de grupo con admins (el creador queda admin, puede haber varios, nunca queda el grupo sin ninguno), semana fija lunes 00:00 a domingo 23:59, un partido cuenta automáticamente para un grupo si al menos 3 de sus 4 jugadores eran miembros activos en la fecha (sin selector, puede contar para varios grupos a la vez), tabla semanal que toma los 3 mejores partidos puntuables de cada jugador esa semana, puntos (victoria=5, derrota=0, +1 sorpresa de nivel si la pareja ganadora tenía Nivel BRAMU promedio ≥0,5 inferior, +1 remontada si perdió el primer set y ganó, +1 victoria clara si ganó 2-0 con el rival por debajo de la mitad de sus games — remontada y victoria clara mutuamente excluyentes, máximo 7 puntos por partido), tres vistas (Actual/Anterior/Race anual), BRAMU Intelligence grupal con 2-3 conclusiones reales basadas en datos (nunca inventadas), y reglas históricas de pertenencia (salir del grupo no borra puntos ya ganados, entrar no suma retroactivo).

### 9.1 V03.4.1 — Microparche: empates/UX/ubicación

**Fuente:** `BRAMUlab_V03.4.1_Consolidado.md` (pedido en chat, transcripto)

No rehacer la lógica general — corregir UX, jerarquía visual, un bug de empate, e incorporar el campo de ubicación pendiente. Pide: CTA "CREAR GRUPO" de ancho completo en el estado vacío; separar visualmente el selector de grupos de las tabs ACTUAL/ANTERIOR/RACE ANUAL (capas distintas); incluir el nombre real del grupo en el título de BRAMU Intelligence; reducir el spacing entre insights; **bug real reportado explícitamente**: dos jugadores con el mismo puntaje deben compartir posición, nunca inventar un desempate (el usuario da el ejemplo exacto: Seba y Esteban con 6 puntos cada uno, y BRAMU Intelligence diciendo "Esteban lidera"/"Seba le pisa los talones" es incorrecto); mostrar foto real en la tabla del grupo (no solo inicial); aclarar que el `+` del header es exclusivamente para crear grupo, nunca para agregar miembros; llevar los botones de Configuración del grupo al sistema estándar; y agregar en MIS DATOS un único campo de ubicación ("¿De dónde sos?", con selector normalizado, preparado para un futuro Ranking BRAMU local — sin implementarlo todavía) más compactar los selectores de Género/Mano/Lado/Categoría a filas con chevron.

### 9.2 V03.4.2 — Microparche: selector de grupo, tabs, Intelligence, eliminar grupo, GeoRef

**Fuente:** `BRAMUlab_V03.4.2_Consolidado.md` (pedido en chat, transcripto)

Reemplazar los chips de selección de grupo (que seguían compitiendo visualmente con las tabs) por un único selector "{Nombre del grupo} ▾" que abre un bottom sheet con todos los grupos + "+ CREAR GRUPO" al final; quitar el `+` del header (el engranaje siempre configura el grupo activo, sin ambigüedad); las tabs ACTUAL/ANTERIOR/RACE ANUAL deben usar EXACTAMENTE el mismo patrón visual que las tabs de Historial (no las de MI PERFIL/MIS DATOS/JUGADORES); reemplazar "EL MOMENTO · {grupo}" por "BRAMU INTELLIGENCE" con el mismo ícono que el resto de la app y el nombre del grupo como segunda jerarquía; quitar el placeholder pesado del campo de nombre al crear grupo; edición de nombre inline (lápiz, sin botón GUARDAR grande); agregar "ELIMINAR GRUPO" (destructivo, solo admins, con modal de confirmación explícito de que no borra los partidos del historial de nadie); y — el hallazgo que motiva la ronda — **reemplazar el dataset local de ~180 localidades por la API oficial GeoRef de Argentina**, porque el dataset curado dejaba afuera casos reales como "General Las Heras", manteniendo el dataset local solo como fallback si la API falla.

### 9.3 V03.4.3 — Ajustes finales de cierre

**Fuente:** `BRAMUlab_V03.4.3_Consolidado.md` (pedido en chat, transcripto)

4 ajustes de cierre: las tabs de Mis Grupos deben ir en minúscula/mayúscula inicial ("Actual / Anterior / Race anual"), no en mayúscula sostenida; más espacio vertical entre la tarjeta de BRAMU Intelligence y el bloque superior; en modales de dos botones en paralelo (como "Eliminar grupo"), bajar el tamaño tipográfico de 14 a 12px, aplicado a todos los modales equivalentes; y el campo de ubicación no debe mostrar una lista precargada al abrir — debe abrir limpio y mostrar resultados recién cuando el usuario escribe. El usuario cierra explícitamente: "si no aparece nada más raro en la revisión, con esto se da por cerrado este bloque".

### 9.4 V03.4.4 — Microparche final: botón crear grupo, contador de jugadores, splash, ícono

**Fuente:** `BRAMUlab_V03.4.4_Consolidado.md` (pedido en chat, transcripto)

Sin tocar lógica de grupos/puntos/tabs/Intelligence/ubicación: convertir "+ CREAR GRUPO" (texto simple, perdido) en un botón real de jerarquía terciaria con acento verde (mismo lenguaje que "Editar partido"/"Cerrar sesión" pero en lima); agregar cantidad de jugadores como segunda lectura en cada fila del selector de grupos ("Jueves De Padel · 6 jugadores", con singular/plural correcto, sin nombrar a los miembros); recomponer el Splash (el logo quedó "demasiado arriba", pide recentrar, dar más protagonismo al wordmark, y quitar el ISO si aparece separado del wordmark — una sola marca protagonista); y revisar el ícono de la app porque "todavía conserva un fondo/tono verde" no alineado con la identidad actual (azul noche + lima).

### 9.5 V03.4.5 — Microparche responsive: bottom nav, tabs Perfil, gráfico Evolución

**Fuente:** `BRAMUlab_V03.4.5_Consolidado.md` (pedido en chat, transcripto)

Microparche responsive final: quitar el "+" de "+ CREAR GRUPO" (queda "CREAR GRUPO", mismo estilo); en tablet/viewport intermedio, la bottom nav queda "como una pastilla flotante angosta" — debe ocupar todo el ancho disponible, coherente con el resto de la interfaz (sin agrandar íconos/texto); las tabs MI PERFIL/MIS DATOS/JUGADORES quedan "demasiado agrupadas en el centro" en tablet — deben distribuirse mejor en el ancho, sin escalar tipografía; y el gráfico de Evolución del Nivel BRAMU en tablet "gana ancho, pero también se están escalando demasiado los textos/ejes/labels" — pide que el gráfico gane ancho SIN que la tipografía de ejes/labels/valores crezca proporcionalmente. Explícitamente sin tocar lógica ni datos de ninguna pantalla.

### 9.6 V03.4.6 — Dos hallazgos de QA sobre V03.4.5

**Fuente:** `BRAMUlab_V03.4.6_Consolidado.md` (reportado por voz en chat, transcripción limpiada de errores de reconocimiento — "raíz anual"/"de observado centavos" se interpretan como "Race anual"/"Observados", únicos nombres reales de esas pestañas)

Dos hallazgos tras revisar V03.4.5 ya en producción: (1) en Mis Grupos las tabs Actual/Anterior/Race anual quedan alineadas a la izquierda en tablet correctamente, pero en Historial las tabs Todos/Mis partidos/Observados — que deberían seguir el mismo criterio — no lo están; (2) el problema del gráfico de Evolución reportado en V03.4.5 §4 **no quedó resuelto**: en tablet el gráfico se agranda pero el tamaño tipográfico de las escalas de ambos ejes también crece, y los textos empiezan a pisarse entre sí. Sin cambios de lógica, datos ni fórmula — solo layout/CSS y la corrección real detrás del punto 2.

## 10. V03.5 / V03.5.1 / V03.5.2 — Ranking BRAMU semanal

**Fuente:** `BRAMUlab_V03.5.md`, `BRAMUlab_V03.5.1.md`, `BRAMUlab_V03.5.2.md`; normativa vigente en [`Ranking_BRAMU.md`](../../Ranking_BRAMU.md).

Abre el frente de **Ranking BRAMU** como producto oficial, separado tanto del Nivel BRAMU (estimación individual) como de Mis grupos (competencia privada) — nunca mezclados entre sí. Especifica cinco ámbitos (Local / Provincial / País / Global / Mi red, Local por defecto), filtros compactos de género/rama y de Nivel (banda 1-10), y una regla de orden sin puntos propios: el puesto sale directamente del Nivel BRAMU consolidado interno exacto, con empates que comparten posición ("1, 1, 3", nunca "1, 1, 2"). V03.5.1 renombra "Mis jugadores" a **Mi red** — vínculos deportivos por partido compartido en los últimos 180 días, con ocultar/restaurar, nunca una lista manual de contactos ni Mis grupos — y agrega el selector de género/rama. V03.5.2 trae el cambio normativo más grande de la línea: Ranking pasa de continuo a **publicación semanal** — edición fija de lunes 00:00:00 a domingo 23:59:59 hora de Buenos Aires, snapshot que congela Nivel/elegibilidad/ubicación/densidad al cierre, movimiento semanal real entre dos ediciones (flechas = puestos, nunca puntos), validaciones tardías que impactan recién en la siguiente edición, y la tarjeta `TU POSICIÓN`/búsqueda/ayuda/paginado quedan formalizadas como UX vigente. Localidad exacta (nunca agrupar localidades cercanas) y densidad por umbrales (0-4 sin puesto, 5-14 en formación, 15+ establecido) completan la primera versión del documento normativo `Ranking_BRAMU.md`.

## 11. V03.6 — Contacto por WhatsApp + identidad

**Fuente:** `BRAMUlab_V03.6.md`.

Agrega un mecanismo simple de contacto entre jugadores desde el Perfil público, sin convertirse en mensajería propia: `phone` (dato privado de cuenta) y `allowWhatsAppContact` (booleano, `false` por defecto siempre — cargar un número nunca infiere consentimiento); edición en Mis Datos con un switch que bloquea activarse sin un teléfono válido cargado antes; botón "CONTACTAR POR WHATSAPP" en Perfil público, visible solo con teléfono válido Y consentimiento a la vez, que abre un deep link `wa.me` con un mensaje fijo de un solo toque — el número nunca se muestra en pantalla. La ronda de cierre suma correcciones reales de identidad (Ranking y Mis jugadores debían resolver la cuenta real de un jugador por `userId`, no solo la de self) y de UX de Ranking (self sin posición ya no bloquea la clasificación completa, color semántico del movimiento, desborde visual de "CALIBRANDO"). Queda documentada, deliberadamente sin corregir, la limitación de historial compartido en `localStorage` entre cuentas del mismo navegador — depende del futuro modelo multiusuario/Backend.

## 12. V03.7 — Geografía del Ranking + Ranking en Perfil público

**Fuente:** `BRAMUlab_V03.7.md`.

Corrige un bug real de producción: el universo territorial mock mezclaba localidades sin relación entre sí (Local ciclaba sobre TODO el dataset nacional en vez de limitarse a una sola localidad; Provincial incluía CABA/Córdoba para un usuario de Provincia de Buenos Aires). La comparación pasa a ser jerárquica por campos estructurados (país/provincia/localidad), nunca por substring: Local = localidad exacta; Provincial = mismo país + misma provincia (CABA y Provincia de Buenos Aires quedan siempre separadas, nunca equivalentes por compartir el texto "Buenos Aires"); País = mismo país (ahí sí conviven varias provincias). Agrega la tarjeta territorial semanal (Local/Provincia/País, con puesto + denominador + territorio + período) al Perfil público de un jugador real elegible, siempre a partir del snapshot semanal del jugador de ESE perfil — nunca el Nivel actual en vivo, nunca la ubicación de quien mira. Sin cuenta real detrás del nombre la tarjeta se oculta por completo; sin elegibilidad completa muestra un estado simple en vez de inventar un puesto.

## 13. V03.8 — Cierre UX de Ranking

**Fuente:** `BRAMUlab_V03.8.md`.

Cierra cuatro decisiones UX sobre Ranking, incorporadas primero a `Ranking_BRAMU.md`: (1) la misma tarjeta territorial semanal del Perfil público pasa a existir también en Mi Perfil, con la MISMA fuente/lógica (nunca una segunda implementación de Ranking); (2) jerarquía tipográfica reforzada del puesto (protagonista) frente al denominador/territorio (secundarios); (3) tocar `TU POSICIÓN` queda formalizado como una ayuda de navegación que garantiza contexto cercano a la fila propia (scroll o carga de la ventana mínima necesaria) — nunca un ámbito/filtro/pantalla nuevos; (4) Ranking se integra a Home ÚNICAMENTE como un insight puntual dentro de `TU MOMENTO` (nunca una tarjeta territorial duplicada), con la prioridad forma reciente > Ranking semanal Local > compañero frecuente > actividad del mes. `Explorar rankings` (consultar el Ranking de otro territorio sin cambiar la ubicación propia) queda definida conceptualmente como evolución futura, explícitamente fuera de V1.

## 14. V03.9 — Microajustes de cierre

**Fuente:** `BRAMUlab_V03.9.md`.

Dos correcciones reales de QA visual y una verificación agregada: el framing de forma reciente de `TU MOMENTO` pasa a seguir el balance real (más victorias que derrotas → "Ganaste..."; más derrotas → "Perdiste..."; empate → formulación neutral — nunca "venís de ganar" con un balance negativo); la tarjeta `TU POSICIÓN` de Mi red con 1-2 elegibles deja de verse desbalanceada (reutiliza la misma estructura visual del caso general, con `—` en la zona de puesto), con singular/plural correcto y sin inventar nunca `#1 de 1` — la regla deportiva de comparación simple sin puesto no cambia. Se agrega una prueba determinística que confirma que la edición semanal vigente cambia exactamente en el corte real (lunes 00:00 hora de Buenos Aires), sin tocar la lógica temporal ya existente.

## 15. V03.10 — Cierre final de V03

**Fuente:** `BRAMUlab_V03.10.md` (supera al handoff previo `BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md`, explícitamente descartado).

Cierre conservador y deliberado de `TU MOMENTO` antes de BRAMU Intelligence: la cláusula de forma reciente entra ÚNICAMENTE con balance positivo (victorias > derrotas); con empate o mayoría de derrotas se OMITE por completo — nunca se reemplaza por "Perdiste..." ni por un framing neutro (la solución de V03.9, superada acá) — y el mecanismo sigue con el siguiente candidato de la misma prioridad ya vigente. El insight de Ranking sigue pudiendo mostrar movimiento negativo (es un hecho de posición, nunca una interpretación del rendimiento); interpretar rachas/tendencias/contexto queda deliberadamente para BRAMU Intelligence. Las listas de Compañeros/Rivales pasan a mostrar `Nombre · @username` con identidad segura: `userId` es autoritativo y exclusivo (dos cuentas reales con el mismo nombre visible nunca se funden en una sola fila ni muestran el username de la otra); sin cuenta real resoluble se muestra solo el nombre, nunca un username inventado ni derivado — a diferencia de Mis Grupos, que puede seguir mostrando handles sintéticos del prototipo (tomado solo como referencia visual de esta ronda, nunca como referencia de identidad).

---

## Estado actual

**BRAMUlab_V03 quedó CERRADA en V03.10** (tag `BRAMUlab_V03.10`), publicada en producción y validada visualmente por el usuario. 35 rondas en total desde V03.0 (las 27 originales hasta V03.4.6, más V03.5, V03.5.1, V03.5.2, V03.6, V03.7, V03.8, V03.9 y V03.10). El detalle de qué se implementó realmente en cada una —con verificaciones, bugs reales encontrados/corregidos y desvíos justificados— está en [`BRAMUlab_V03_Informe.md`](BRAMUlab_V03_Informe.md).

**Roadmap vigente de acá en adelante:** `V04` = Nivel BRAMU (fórmula real y definitiva, hoy sigue siendo una serie simulada); `V05` = BRAMU Intelligence (interpretación de rachas/tendencias/contexto — explícitamente diferida en V03.10 para que `TU MOMENTO` siga siendo una superficie liviana y determinística); `V06` = Backend/Infraestructura (Supabase/Firebase o equivalente). Ninguna de las tres arrancó todavía.

**Qué queda explícitamente pendiente / fuera de alcance de toda la línea BRAMUlab_V03:** backend real (`V06`); fórmula real y definitiva del Nivel BRAMU (`V04`, sigue siendo una serie simulada, marcada como tal en el código aunque ya no en la UI desde V03.0.3.1); interpretación profunda de BRAMU Intelligence a nivel jugador (`V05` — Mis Grupos ya tiene su propia BRAMU Intelligence grupal desde V03.4, acotada a esa competencia); amigos/seguidores/mensajería/invitaciones más allá del contacto por WhatsApp de V03.6; notificaciones push; armado de partido desde perfil o desde grupo; gamificación adicional (premios, medallas); `Explorar rankings` (consultar el Ranking de otro territorio, definido conceptualmente en V03.8 pero no implementado); geografía real fuera de Argentina. **Ranking BRAMU oficial ya NO es pendiente de la línea** — quedó implementado a nivel prototipo (universo/snapshot simulados y determinísticos, sin backend real) entre V03.5 y V03.9, con su cierre final de UX en V03.10; ver el Informe para el detalle completo. El backlog completo de ideas futuras vive en [`BRAMUlab_Backlog.md`](../../BRAMUlab_Backlog.md).

No hay contradicciones sin resolver entre las especificaciones de las 35 rondas: cada una amplía o corrige explícitamente a la anterior, y cuando una ronda encontró que una anterior no había quedado resuelta como creía (por ejemplo, el gráfico de Evolución en tablet entre V03.4.5 y V03.4.6, o el framing de `TU MOMENTO` entre V03.9 y V03.10), lo dice de forma explícita en su propio documento en vez de simplemente repetir el pedido — ver el detalle de esos casos en el Informe.

---

Los documentos originales de cada ronda anterior a V03.5 (citados arriba por nombre) ya no están en este repositorio — se borraron una vez confirmado que este Consolidado no perdía nada relevante; siguen recuperables del historial de git (commit `40c82bc` o anterior). Los documentos de V03.5 en adelante (`BRAMUlab_V03.X.md` + `BRAMUlab_V03.X_Reporte_ChatGPT.md`) siguen presentes en este mismo directorio.
