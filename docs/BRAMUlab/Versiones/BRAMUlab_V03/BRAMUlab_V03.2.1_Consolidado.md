# BRAMUlab V03.2.1 — Corrección visual de acceso, botones y carga manual

## OBJETIVO

Esta ronda corrige la V03.2 después de QA visual en producción.

No es una nueva exploración de diseño.
No rediseñar Home, Historial, MI PERFIL, MIS DATOS ni Ranking.

La prioridad es corregir inconsistencias visuales todavía visibles en:
- Splash
- Acceso / bienvenida
- Login
- Crear cuenta
- Bottom sheet "Registrar partido"
- Carga manual de partido
- Resumen del partido
- Bottom sheet "Formato y puntuación"
- Sistema tipográfico de botones

Implementar directamente.

---

# 1. REGLA PRINCIPAL — SISTEMA REAL DE BOTONES

La V03.2 normalizó colores, pero todavía hay diferencias visibles en:
- peso tipográfico;
- tamaño;
- tracking;
- altura;
- padding;
- sensación visual.

## REEMPLAZAR

Crear una única especificación tipográfica y dimensional base para botones.

Todos los botones equivalentes deben compartir:
- la misma familia tipográfica que ya usa actualmente la app;
- mismo font-size;
- mismo font-weight;
- mismo letter-spacing;
- misma altura;
- mismo padding vertical/horizontal;
- misma lógica de alineación.

NO asumir Montserrat.
Usar la fuente/token vigente real del sistema actual.

Las variantes cambian por:
- color;
- borde;
- fondo;
- semántica;

NO por tipografía.

## Familias
- Primario: lima.
- Funcional: azul.
- Neutro: oscuro/borde.
- Destructivo: rojo.

No debe existir un botón "especial" solo porque vive en otra pantalla.

---

# 2. SPLASH

Mantener el sistema actual.

## AJUSTAR
- subir visualmente el logo/isotipo;
- permitir agrandarlo ligeramente;
- no cambiar fondo;
- no volver a tocar paleta;
- no agregar contenido.

Debe sentirse centrado de manera óptica, no demasiado bajo.

---

# 3. PANTALLA INICIAL / ACCESO

## ELIMINAR
`BIENVENIDO A BRAMU`

El logo ya comunica marca y el texto repite innecesariamente BRAMU.

## MANTENER
Texto secundario corto de entrada, sin repetir la marca.

## BOTONES

`INICIAR SESIÓN`
`CREAR CUENTA`

Deben usar:
- mismo tamaño;
- mismo peso;
- mismo tracking;
- misma altura;
- misma tipografía.

Solo cambia el tratamiento visual/color.

## REEMPLAZAR
`REGISTRAR PARTIDO SIN CUENTA`

por:

`REGISTRAR PARTIDO COMO INVITADO`

## ELIMINAR
Texto explicativo inferior:
`Jugá sin crear perfil ni guardar historial.`

No hace falta explicar de más.

---

# 4. LOGIN

## AGREGAR
Logo BRAMU Lab centrado en la parte superior de la pantalla/familia.

Mantener flecha volver a la izquierda.

El logo debe funcionar como elemento de marca estable de la familia de acceso.

## AJUSTAR
Botón `INICIAR SESIÓN`:
- reducir altura/tamaño si hoy está sobredimensionado;
- llevarlo al botón estándar definido en §1.

## AJUSTAR
`¿Olvidaste tu contraseña?`
- mantener como link secundario;
- darle más aire respecto del botón principal;
- evitar que parezca pegado o parte del botón;
- no darle protagonismo excesivo.

---

# 5. CREAR CUENTA

## REEMPLAZAR
Cualquier uso visible de:

`CREAR ACCESO`

por:

`CREAR CUENTA`

Usar ese nombre en todo el flujo.

## AGREGAR
Logo BRAMU Lab centrado arriba, siguiendo el mismo patrón de Login.

Mantener flecha volver.

No cambiar lógica ni pasos.

---

# 6. FAMILIA DE ACCESO

Login, Crear cuenta, Recuperación, Código, Nueva contraseña y pantallas equivalentes deben compartir:

- misma presencia de marca;
- misma lógica de header;
- mismos botones;
- mismos labels;
- mismos inputs;
- mismos spacing;
- misma jerarquía.

No crear excepciones locales.

---

# 7. BOTTOM SHEET "REGISTRAR PARTIDO"

Actualmente se percibe recargado/inconsistente.

## AJUSTAR
Header del bottom sheet:
- título claro;
- cierre simple;
- mejor alineación vertical.

## ELIMINAR
Chevrons/flechitas de:
- `Cargar mi partido jugado`
- `Registrar partido en vivo`

No aportan.

## REVISAR
El botón `X` actual:
- mantener solo si queda correctamente integrado al header;
- si no, usar el patrón de cierre ya existente en otros sheets aprobados.

No cambiar las dos opciones ni su navegación.

---

# 8. CARGA MANUAL — HEADER

Actualmente aparece `SET 1` como título principal de pantalla y se percibe raro.

## REEMPLAZAR
Título principal:

`CARGAR PARTIDO`

Dentro del bloque de resultado mantener:

`RESULTADO DEL SET 1`

Luego:
`RESULTADO DEL SET 2`
etc.

La pantalla debe explicar la acción general; el set pertenece al contenido.

---

# 9. CARGA MANUAL — RESULTADO

## AGRANDAR
El bloque de resultado del set.

Objetivo:
- más ancho;
- más alto;
- mayor presencia;
- números más cómodos;
- aprovechar mejor el ancho disponible.

No exagerar ni romper scroll/mobile.

## MOVER
`RESULTADO VÁLIDO`

Debe quedar inmediatamente asociado al bloque de resultado.

No dejarlo separado varios cientos de píxeles abajo.

Ideal:
- inmediatamente debajo del bloque de resultado;
- visible antes de la zona de acciones final.

---

# 10. RESUMEN DEL PARTIDO

No rediseñar la pantalla completa.

## BOTONES
`EDITAR PARTIDO`
`VOLVER AL INICIO`

Deben compartir EXACTAMENTE:
- tipografía;
- tamaño;
- peso;
- tracking;
- altura;
- padding.

Solo cambia la variante:
- Editar = azul funcional.
- Volver al inicio = lima primario.

## ELIMINAR PARTIDO

REEMPLAZAR la pastilla/botón rojo actual.

Usar una acción textual destructiva:
- roja;
- centrada;
- clara;
- sin fondo/pastilla;
- sin protagonismo equivalente a los CTAs principales;
- sin underline si visualmente queda mejor dentro del sistema.

Debe existir y ser visible, pero con jerarquía claramente menor.

No cambiar su modal ni lógica.

---

# 11. BOTTOM SHEET "FORMATO Y PUNTUACIÓN"

## AJUSTAR
Botón `LISTO`.

Actualmente está sobredimensionado.

Debe usar EXACTAMENTE la misma altura, tipografía, peso, tracking y padding del botón primario estándar.

No puede ser más grande por estar dentro de un bottom sheet.

No tocar las opciones:
- Clásico
- Americano
- Star Point
- Punto de Oro
- Con ventaja

salvo ajustes mínimos de spacing si son necesarios para acomodar el botón estándar.

---

# 12. NO TOCAR

No modificar:
- Home;
- Historial;
- MI PERFIL;
- MIS DATOS;
- Ranking;
- lógica de Nivel BRAMU;
- Player Intelligence;
- cálculos;
- datos;
- backend;
- scoring;
- navegación estructural.

Solo tocar las pantallas/puntos autorizados arriba y estilos compartidos necesarios.

---

# 13. TESTS / QA

## Tests
- no crear tests de CSS/markup;
- correr tests focales solo si se toca lógica;
- suite completa UNA sola vez al cierre.

## QA mobile obligatorio
Revisar:
1. Splash
2. Acceso
3. Login
4. Crear cuenta
5. Registrar partido bottom sheet
6. Carga manual
7. Partido completo / continuar
8. Resumen
9. Formato y puntuación
10. Modales relacionados

Comparar visualmente botones equivalentes entre pantallas.

## Desktop
Chequeo rápido solamente.

---

# 14. CRITERIO DE ÉXITO

La ronda queda bien si:

- todos los botones equivalentes parecen del mismo sistema;
- no hay diferencias arbitrarias de peso/tamaño/tracking;
- Login y Crear cuenta tienen marca visible y consistente;
- "Crear acceso" desaparece;
- Welcome deja de repetir BRAMU;
- invitado queda simplificado;
- carga manual tiene jerarquía más clara;
- resultado y estado válido quedan asociados;
- Resumen tiene 2 CTAs principales coherentes;
- Eliminar partido pierde protagonismo;
- `LISTO` deja de ser gigante;
- no hay regresiones en pantallas ya aprobadas.

---

# 15. VERSIONADO

Versión:

BRAMUlab V03.2.1

Actualizar los cuatro puntos de versión/cache vigentes:
- APP_VERSION
- version.json
- CACHE_NAME
- query ?v= de assets

Generar:

docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.2.1_Informe.md

Incluir:
- cambios realizados;
- sistema base final de botones;
- pantallas tocadas;
- QA;
- tests;
- hashes;
- tag;
- deploy.

---

# FORMA DE TRABAJO

Implementar directamente.

No presentar plan.

Resolver primero desde estilos/componentes compartidos.

Solo frenar por:
- riesgo real de pérdida de datos;
- contradicción de producto;
- necesidad de salir del alcance;
- acción destructiva no prevista.

Al terminar:
- QA mobile;
- chequeo desktop;
- suite completa una sola vez;
- informe;
- commit;
- tag;
- push;
- deploy.
