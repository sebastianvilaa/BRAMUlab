# BRAMUlab V03.2 — Sistema visual transversal: acceso, botones, modales y navegación

## Objetivo

Esta ronda no busca rediseñar BRAMUlab desde cero.

Busca **auditar y normalizar el sistema visual transversal** tomando como referencia las pantallas que ya fueron aprobadas y que hoy representan correctamente el lenguaje BRAMU.

La prioridad es resolver inconsistencias entre:
- familia de acceso/autenticación;
- splash;
- botones;
- modales de confirmación;
- navegación inferior;
- tratamientos tipográficos y de color;
- icono/app icon y glows heredados.

Claude tiene autonomía para resolver composición, spacing, jerarquías, escalas y consistencia, pero debe hacerlo **dentro del sistema ya construido**, no inventando uno nuevo.

---

# 1. PRINCIPIO DE TRABAJO

Las pantallas ya aprobadas son **referencia del sistema**, no objeto de rediseño.

Tomar como fuente visual y de comportamiento:
- Home;
- Historial;
- Cargar/Registrar partido;
- Resumen del partido;
- MI PERFIL;
- MIS DATOS.

No rediseñar esas pantallas salvo las **inconsistencias puntuales autorizadas en este consolidado**.

Si Claude necesita un botón, tarjeta, tab, jerarquía de texto, color, spacing o modal, debe primero reutilizar o derivar patrones ya existentes en esas pantallas.

La auditoría debe buscar **consistencia**, no mejoras estéticas libres sobre pantallas estables.

---

# 2. DIRECCIÓN VISUAL BRAMU CONFIRMADA

## Base
- Fondo principal: **azul noche / dark navy**.
- Eliminar usos heredados de verdes ingleses / verdes oscuros viejos como lenguaje dominante.
- Verde lima BRAMU: acento principal.
- Azul: acento funcional/secundario cuando corresponda.
- Rojo: destructivo / riesgo / pérdida.
- Gris/blanco: jerarquía neutral.

## Evitar
- look “tech galaxia”;
- glows exagerados;
- colores heredados sin función;
- variaciones tipográficas arbitrarias;
- componentes que parezcan de otra app.

---

# 3. LOGO BRAMU LAB

El logo debe ser protagonista en pantallas de acceso, bienvenida y splash.

## Regla
En una pantalla de entrada / acceso:
- no puede verse más chico o menos importante que en el header del Home;
- puede ser más grande;
- solo puede reducirse en contextos donde el contenido tenga que dominar claramente.

No volver a usar versiones viejas del logo, tratamientos de color heredados o escalas demasiado pequeñas en acceso.

---

# 4. FAMILIA DE ACCESO / AUTENTICACIÓN

Auditar como una sola familia:
- Splash
- Pantalla inicial / bienvenida
- Login
- Crear cuenta
- Completar acceso
- Olvidé mi contraseña
- Ingresar código
- Nueva contraseña
- Cambiar contraseña
- cualquier pantalla intermedia equivalente de autenticación

## Objetivo
Que todas parezcan parte del mismo sistema BRAMU.

Claude puede reorganizar:
- spacing;
- escalas;
- jerarquías;
- tamaño del logo;
- composición;
- ancho/alto de inputs;
- posición de textos secundarios;
- tratamientos de botones;
- acentos de color;

siempre sin cambiar la lógica funcional ni navegación.

---

# 5. SPLASH

REEMPLAZAR el lenguaje visual viejo si todavía utiliza:
- verdes ingleses;
- colores heredados;
- glows incompatibles con el sistema actual.

## Dirección
- azul noche como base;
- logo BRAMU Lab protagonista;
- lima como acento;
- composición simple;
- no agregar contenido innecesario.

No convertir el splash en una pieza tech/galaxia.

---

# 6. PANTALLA INICIAL / BIENVENIDA

Revisar especialmente:
- logo demasiado chico;
- jerarquía inconsistente entre `INICIAR SESIÓN` y `CREAR CUENTA`;
- separación de `REGISTRAR PARTIDO SIN CUENTA`;
- texto actual de bienvenida si todavía existe.

## Criterio
`INICIAR SESIÓN` y `CREAR CUENTA` deben:
- tener la misma jerarquía tipográfica;
- diferenciarse por tratamiento/color, no por tamaño o familia tipográfica.

`REGISTRAR PARTIDO SIN CUENTA`:
- debe quedar como acción terciaria;
- visualmente más separada de las dos acciones principales.

El texto puede simplificarse si hoy suena redundante o poco BRAMU.

No hace falta conservar literalmente “Bienvenido a BRAMU”.

Claude puede proponer una entrada breve y deportiva coherente con la marca, sin inventar claims largos.

---

# 7. SISTEMA GLOBAL DE BOTONES

Claude debe auditar y normalizar botones de toda la app.

## Problema actual
Existen variaciones inconsistentes en:
- mayúsculas/minúsculas;
- tracking/interletrado;
- tamaño;
- peso tipográfico;
- altura;
- padding;
- contraste;
- jerarquía.

Los botones equivalentes deben usar la misma base.

## Definir 4 familias

### 1. Primario
Uso:
- avanzar;
- confirmar;
- guardar;
- acción principal positiva.

Tratamiento:
- lima sólido;
- misma tipografía base;
- misma lógica de altura/padding.

### 2. Secundario funcional
Uso:
- editar;
- modificar;
- acciones activas que no son destructivas ni primarias.

Tratamiento recomendado:
- azul.

### 3. Secundario neutro
Uso:
- cancelar;
- volver;
- acciones pasivas o de salida sin pérdida.

Tratamiento:
- oscuro / borde / neutro.

### 4. Destructivo
Uso:
- eliminar;
- cerrar sesión;
- salir sin guardar;
- cualquier acción que implique pérdida o ruptura de estado.

Tratamiento:
- rojo;
- consistente entre pantallas.

No convertir cada botón en una excepción visual.

---

# 8. TIPOGRAFÍA DE BOTONES

Claude debe normalizar:
- familia tipográfica;
- tamaño;
- peso;
- tracking;
- uso de mayúsculas/minúsculas.

## Regla
Botones del mismo nivel deben sentirse del mismo sistema.

Ejemplos a auditar:
- `EDITAR PARTIDO`
- `VOLVER AL INICIO`
- `LISTO`
- `GUARDAR`
- `CONFIRMAR`
- `CANCELAR`
- `CERRAR SESIÓN`
- `ELIMINAR`
- `SALIR SIN GUARDAR`

No deben parecer escritos con sistemas tipográficos distintos.

---

# 9. MODALES DE CONFIRMACIÓN — UNIFICAR

Normalizar como una única familia visual y funcional.

Casos principales:
- Salir sin guardar
- Cerrar sesión
- Eliminar partido

## Estructura base
1. Título/pregunta
2. Explicación breve
3. Acción secundaria
4. Acción principal específica

## Regla semántica
Los botones deben nombrar **exactamente lo que va a ocurrir**.

### Salir sin guardar
REEMPLAZAR:
- `Cancelar`
- `Confirmar`

por:
- `CANCELAR`
- `SALIR SIN GUARDAR`

`SALIR SIN GUARDAR` = destructivo rojo.

### Cerrar sesión
Mantener concepto:
- `CANCELAR`
- `CERRAR SESIÓN`

`CERRAR SESIÓN` = destructivo rojo.

### Eliminar partido
Usar:
- `CANCELAR`
- `ELIMINAR PARTIDO`

`ELIMINAR PARTIDO` = destructivo rojo.

No usar términos genéricos como `Confirmar` cuando la acción puede nombrarse claramente.

---

# 10. RESUMEN DEL PARTIDO — INCONSISTENCIAS AUTORIZADAS

No rediseñar la pantalla.

Corregir únicamente:

## Botón Editar partido
- debe formar parte del sistema global de botones;
- puede usar tratamiento **azul funcional**;
- debe compartir tipografía, altura, peso y tracking base con el resto.

## Botón Volver al inicio
- mantener como acción principal positiva;
- lima;
- misma base tipográfica del sistema.

## Eliminar partido
La acción actual se percibe demasiado suelta/extraña como link flotante.

Claude puede resolver su presentación para que:
- siga siendo acción de menor jerarquía;
- sea claramente destructiva;
- use rojo;
- no compita con `VOLVER AL INICIO`;
- se integre al sistema de botones/acciones.

No cambiar la lógica de eliminación.

---

# 11. CARGA / REGISTRO DE PARTIDO — BOTTOM NAV

Actualmente existe una inconsistencia: en una pantalla de carga/configuración de partido se pierde la navegación inferior.

## AGREGAR / RESTAURAR
Si el usuario está logueado:
- la bottom nav debe permanecer visible en la pantalla de carga/configuración de partido, salvo que exista una razón funcional real de máxima concentración.

Para esta ronda:
- mantener bottom nav visible en configuración/carga previa del partido.

No cambiar el flujo de scoring activo salvo necesidad real y documentada.

Invitado/sin sesión:
- mantener comportamiento público actual si no corresponde mostrar navegación personal.

---

# 12. TABS

Cuando una pantalla necesite tabs/solapas:
- reutilizar el patrón aprobado de MI PERFIL / MIS DATOS y/o Historial;
- no inventar botones grandes para comportamientos de tab;
- activa = lima;
- inactiva = gris;
- jerarquía consistente.

---

# 13. INPUTS Y FORMULARIOS

En la familia de acceso:
- unificar altura;
- borde;
- radio;
- labels;
- placeholders;
- estados de foco;
- eye/eye-off;
- spacing;
- mensajes de error.

No cambiar validaciones ni lógica salvo bug real.

---

# 14. ICONO DE APP / GLOW

Auditar:
- app icon;
- halo/glow asociado;
- posibles tratamientos heredados.

## Dirección
- coherente con azul noche + lima;
- evitar glow viejo/verde inglés;
- si hay glow, debe ser controlado y contemporáneo;
- no usar efectos que hagan parecer el producto “gaming” o “galaxia”.

No rediseñar el isotipo/logo de BRAMU.

---

# 15. AUTONOMÍA DE CLAUDE

Claude tiene autonomía para:
- detectar inconsistencias visuales reales;
- resolverlas de forma sistémica;
- consolidar estilos compartidos;
- reducir duplicación CSS;
- reutilizar componentes;
- normalizar spacing;
- normalizar botones;
- normalizar modales;
- normalizar inputs;
- corregir colores heredados;
- corregir glows heredados.

## NO tiene autonomía para:
- rediseñar Home;
- rediseñar Historial;
- rediseñar MI PERFIL;
- rediseñar MIS DATOS;
- cambiar lógica de partido;
- cambiar métricas;
- cambiar navegación estructural;
- agregar funciones nuevas;
- alterar ranking;
- tocar backend;
- inventar social.

---

# 16. AUDITORÍA SISTÉMICA

Antes de implementar:
- recorrer la familia de acceso;
- revisar botones/modales globales;
- detectar inconsistencias;
- identificar estilos duplicados o divergentes.

Después:
- resolver primero en componentes/estilos compartidos;
- evitar parches locales pantalla por pantalla cuando haya una causa común.

No presentar plan para aprobación salvo bloqueo real.

---

# 17. NO TOCAR

No modificar contenido/estructura salvo inconsistencias autorizadas de:
- Home;
- Historial;
- MI PERFIL;
- MIS DATOS;
- Ranking;
- Player Intelligence;
- lógica de scoring;
- lógica de Nivel BRAMU;
- datos;
- backend;
- social.

Resumen del partido y carga de partido solo se pueden tocar en los puntos expresamente autorizados arriba.

---

# 18. TESTS Y QA

## Tests
- tests focalizados solo si se toca lógica;
- no crear tests innecesarios de CSS/markup;
- suite completa UNA sola vez al cierre;
- si queda verde, no repetir.

## QA mobile
Prioridad principal:
- Splash
- Bienvenida
- Login
- Crear cuenta
- Recuperación
- Código
- Nueva contraseña
- Cambiar contraseña
- Completar acceso
- Resumen del partido
- Carga/configuración de partido
- modales afectados

## Desktop
Chequeo visual rápido de la misma familia.

No rehacer QA completa de Home/Historial/Perfil si no fueron modificados.

---

# 19. CRITERIOS DE ÉXITO

La ronda queda cerrada si:
- acceso y autenticación se sienten parte de una sola familia;
- desaparecen colores heredados incoherentes;
- logo tiene protagonismo correcto;
- botones responden a un sistema común;
- modales equivalentes comparten estructura;
- acciones nombran exactamente lo que hacen;
- azul se usa como acción funcional secundaria;
- rojo se usa de forma consistente para destructivos;
- bottom nav no desaparece sin razón en carga/configuración con sesión;
- no se rediseñan pantallas aprobadas;
- no aparecen regresiones.

---

# 20. VERSIONADO

Usar esta ronda como siguiente versión mayor de sistema visual:

**BRAMUlab V03.2**

Actualizar:
- `APP_VERSION`;
- `version.json`;
- service worker/cache;
- referencias necesarias.

Generar:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.2_Informe.md`

El informe debe incluir:
- auditoría realizada;
- inconsistencias encontradas;
- sistema de botones final;
- sistema de modales final;
- cambios en familia de acceso;
- splash;
- icono/glow;
- bottom nav;
- excepciones justificadas;
- tests;
- QA;
- hashes;
- tag;
- deploy.

---

# FORMA DE TRABAJO

Este consolidado está cerrado a nivel de criterio, pero Claude tiene autonomía visual dentro de los límites definidos.

Claude debe:
1. leer completo;
2. auditar;
3. implementar directamente;
4. no presentar plan;
5. resolver sistémicamente;
6. no rediseñar pantallas estables;
7. validar mobile;
8. chequeo rápido desktop;
9. suite completa una sola vez al cierre;
10. generar informe;
11. commit;
12. tag;
13. push;
14. deploy.

Solo detenerse por:
- riesgo real de pérdida de datos;
- contradicción fuerte de producto;
- acción destructiva no prevista;
- necesidad real de salir del alcance.
