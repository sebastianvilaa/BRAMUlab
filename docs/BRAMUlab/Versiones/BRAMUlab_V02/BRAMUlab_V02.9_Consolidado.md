# BRAMUlab V02.9 — Consolidado de implementación

## Objetivo de esta ronda

Cerrar una ronda corta y concreta de refinamiento visual/UX sobre cuatro puntos ya revisados en uso real:

1. Efectividad del Home: volver a una lectura limpia y nítida.
2. Agregar jugador sin cuenta: simplificar la acción y alinearla con el comportamiento natural de una búsqueda.
3. Último partido: completar la información secundaria sin cambiar la esencia visual ya aprobada.
4. Historial: convertir sus tarjetas en una versión compacta de Último partido, manteniendo el mismo lenguaje y orden de lectura.
5. Resumen: mover la eliminación del partido a una acción deliberada y contextual.

No abrir en esta ronda cuentas reales, ranking, validaciones entre usuarios ni lógica multiusuario.

---

# 1. HOME — EFECTIVIDAD

## Problema actual

El último ajuste del aro de Efectividad dejó el halo demasiado difuso. Visualmente parece desenfocado y empeora la lectura.

La animación actual sí funciona y debe conservarse.

## REEMPLAZAR

Volver a una solución limpia y nítida:

- mantener el verde BRAMU fuerte;
- mantener la animación existente;
- eliminar blur, difuminado o cualquier halo que genere sensación de desenfoque;
- usar un stroke principal fino y definido;
- si se necesita un refuerzo visual, puede existir un segundo stroke apenas más ancho y de muy baja opacidad, pero debe ser perfectamente nítido, sin filtros ni blur;
- evitar que el aro quede grueso o pesado.

### Resultado esperado

El donut debe verse limpio, moderno y enfocado tanto durante la animación como en su estado final.

---

# 2. CARGAR PARTIDO — AGREGAR JUGADOR SIN CUENTA

## Problema actual

La opción de crear/agregar un jugador que no tiene cuenta aparece como un CTA grande y muy protagonista. Compite visualmente con el buscador y no se siente como parte natural del flujo de búsqueda.

## REEMPLAZAR

Cambiar esta acción por una fila contextual integrada dentro del listado de búsqueda.

### Comportamiento esperado

Mientras el usuario escribe:

- los jugadores existentes deben seguir filtrándose normalmente;
- debe aparecer una fila clara para usar exactamente el texto ingresado como jugador sin cuenta;
- formato sugerido:

`[icono persona +]  Agregar a “Fernan”   [chevron opcional]`

### Criterios visuales

- eliminar el CTA grande actual;
- no usar borde protagonista de color para esta acción;
- usar una fila limpia y consistente con los resultados de búsqueda;
- ícono circular de persona + a la izquierda;
- texto principal blanco;
- evitar textos innecesarios como “Sin coincidencias” si no aportan información;
- no hace falta escribir “como jugador sin cuenta” en esta primera acción si la interfaz ya resulta suficientemente clara.

### Diferenciación importante

Los usuarios BRAMU existentes deben seguir mostrándose como perfiles reales, idealmente con nombre y @usuario cuando esa información exista en el futuro.

La fila “Agregar a …” debe sentirse distinta de un usuario ya existente.

---

# 3. HOME — ÚLTIMO PARTIDO

## Principio

Último partido queda como componente madre para la representación visual de un partido ya jugado.

NO rediseñar desde cero.

Mantener la esencia y jerarquía visual actual, que ya funciona bien.

## AJUSTAR

### Mantener

- indicadores de forma / últimos resultados;
- etiqueta `ÚLTIMO PARTIDO`;
- fecha y hora;
- etiqueta `VICTORIA` o `DERROTA` en la zona superior, antes del resultado;
- resultado como elemento protagonista;
- participantes abajo a la izquierda;
- tratamiento general actual de tarjeta, borde, fondo, tipografía y jerarquía.

### AGREGAR / REUBICAR metadata secundaria

En la zona inferior derecha, alineada visualmente con los participantes, mostrar en dos líneas:

`CLÁSICO`
`PUNTO DE ORO`

Usar los valores reales del partido.

Si el formato o sistema es otro, mostrar el correspondiente.

### NO hacer

- no mover VICTORIA/DERROTA junto a esta metadata inferior;
- no convertir metadata secundaria en protagonista;
- no rehacer tamaños generales de la tarjeta si no es necesario;
- no alterar el comportamiento actual del componente fuera de este ajuste.

---

# 4. HISTORIAL — TARJETAS DE PARTIDO

## Principio rector

La tarjeta de Historial debe ser una versión compacta de Último partido.

No queremos dos maneras diferentes de contar el mismo tipo de objeto dentro de BRAMU.

Mismo lenguaje visual y mismo orden mental de lectura, con menor altura y densidad apta para una lista de muchos partidos.

## REEMPLAZAR la estructura visual actual

Cada tarjeta debe contener:

### Zona superior

- fecha y hora;
- etiqueta completa `VICTORIA` o `DERROTA`.

Evitar abreviaturas `VIC` / `DER` si el espacio permite la palabra completa.

### Zona principal

- resultado del partido como dato protagonista.

### Zona inferior izquierda

- pareja propia;
- `vs`;
- rivales.

Mantener el mismo criterio de lectura que Último partido.

### Zona inferior derecha

Mostrar en dos líneas:

`CLÁSICO`
`PUNTO DE ORO`

con los valores reales del partido.

## ELIMINAR de las cards

- texto `PARTIDO CARGADO`;
- X de borrado directo.

El origen técnico del partido no necesita ocupar jerarquía en el Historial.

## MANTENER

Tocar cualquier tarjeta del Historial debe seguir abriendo el Resumen del partido.

Este comportamiento ya funciona correctamente y no debe romperse.

## Densidad

La card debe ser claramente más compacta que Último partido, pero conservar su ADN visual.

No buscar una nueva estética paralela.

---

# 5. RESUMEN — ELIMINAR PARTIDO

## AGREGAR

Mover la acción de eliminación al final del Resumen del partido.

Debe ser una acción deliberada y secundaria, no protagonista.

Texto sugerido:

`Eliminar partido`

Al tocar, mostrar confirmación.

### Mensaje de confirmación sugerido

`¿Eliminar este partido?`

`Se actualizarán tu historial y tus estadísticas.`

Acciones:

`Cancelar`
`Eliminar`

### Comportamiento

En esta etapa local, eliminar el partido puede mantener la lógica actual de eliminación completa del registro y recálculo de métricas.

No desarrollar todavía lógica multiusuario ni confirmaciones compartidas.

---

# 6. FUERA DE ALCANCE DE V02.9

NO implementar en esta ronda:

- cuentas reales;
- login/registro;
- backend o base de datos;
- ranking BRAMU;
- validación de resultados entre jugadores;
- propiedad compartida de partidos;
- ocultar vs eliminar en cuentas multiusuario;
- amistades;
- Player Card;
- perfil público/privado;
- rediseño completo de Resumen;
- rediseño de Ranking o Perfil.

Estas líneas quedan para etapas posteriores.

---

# 7. VALIDACIÓN MANUAL OBLIGATORIA

Antes de publicar, revisar en desktop y mobile real:

1. Efectividad:
   - sigue animando;
   - estado final nítido;
   - sin blur/desenfoque;
   - stroke fino.

2. Agregar jugador sin cuenta:
   - búsqueda filtra normalmente;
   - fila `Agregar a “…”` se integra bien al listado;
   - no compite visualmente con resultados reales.

3. Último partido:
   - mantiene diseño actual;
   - VICTORIA/DERROTA sigue en zona superior;
   - resultado mantiene protagonismo;
   - participantes izquierda;
   - formato/sistema a la derecha en dos líneas.

4. Historial:
   - cards más compactas;
   - mismo lenguaje que Último partido;
   - sin `PARTIDO CARGADO`;
   - sin X;
   - VICTORIA/DERROTA completo;
   - tap sigue abriendo Resumen.

5. Resumen:
   - `Eliminar partido` aparece al final;
   - requiere confirmación;
   - borrar actualiza correctamente Home, Historial y estadísticas.

---

# 8. IMPLEMENTACIÓN Y ENTREGA

- trabajar sobre la versión actual publicada;
- no rehacer componentes que ya funcionan sin necesidad;
- mantener tests existentes;
- agregar/ajustar tests solo donde corresponda;
- ejecutar suite completa;
- actualizar versión a `BRAMUlab V02.9`;
- actualizar `version.json` y service worker/cache si corresponde al flujo actual del proyecto;
- publicar en GitHub Pages;
- generar `BRAMUlab_V02.9_Informe.md` con:
  - cambios implementados;
  - decisiones técnicas relevantes;
  - tests ejecutados y resultado;
  - commit(s);
  - confirmación de deploy;
  - cualquier diferencia justificada respecto de este consolidado.

---

## Criterio general

Esta ronda no busca sumar funcionalidad grande. Busca que la forma de representar un partido sea coherente en toda la app y limpiar dos puntos visuales que todavía distraen.

Último partido es la referencia. Historial debe sentirse como su versión compacta, no como otro sistema visual.
