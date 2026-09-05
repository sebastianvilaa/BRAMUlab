# BRAMUlab V02.6 — Consolidado de implementación

**Fecha:** 05/09/2026  
**Base obligatoria:** BRAMUlab V02.5 publicada  
**Tipo de ronda:** corrección visual + regresiones de layout  
**Objetivo:** cerrar los ajustes detectados en la prueba real de V02.5 sin ampliar el alcance funcional. La mayoría de los cambios son CSS/tokens; las únicas correcciones estructurales importantes están en Confirmar partido / Resumen y en el sistema visual del score de Último partido.

---

## 0. Instrucciones generales

1. Trabajar sobre V02.5 publicada.
2. Implementar toda V02.6 en una sola ronda.
3. Prioridad absoluta: arreglar primero las regresiones de layout de Confirmar partido y Resumen.
4. No reabrir BRAMU Intelligence en esta ronda.
5. No cambiar reglas deportivas, lógica de scoring, persistencia, historial, ranking ni flujo de carga manual salvo donde este consolidado lo indique.
6. Mantener Inter.
7. Resolver cambios cromáticos desde tokens semánticos y sus derivados, no por componentes aislados.
8. Mantener tests existentes verdes y agregar tests solo si se toca lógica.

---

# 1. Sistema cromático

## 1.1 Azul BRAMU

**REEMPLAZAR** el azul actual:

```css
#19BAFF
```

por:

```css
#199FFF
```

Este cambio debe arrastrar a toda la familia azul/celeste relacionada:

- `--accent-cyan`
- `--team-b`
- variantes `deep`
- focus
- hover / pressed
- glows
- shadows
- bordes
- hardcodes RGB equivalentes que hayan quedado de V02.5

Conceptualmente el sistema debe sentirse más azul y menos “celeste bebé”.

Referencia sugerida para deep:

```css
--team-b-deep: #0D6FCC;
```

Claude puede ajustar levemente si necesita contraste, manteniendo la misma familia.

---

## 1.2 Texto principal

**REEMPLAZAR**:

```css
--text: #F5F7FA;
```

por:

```css
--text: #F8FAFC;
```

No usar `#FFFFFF` como texto principal global.

El cambio debe ser sutil: apenas más limpio/blanco.

No tocar automáticamente `--text-dim` ni `--text-faint` salvo que un contraste concreto quede roto.

---

# 2. Fondo del Home

V02.5 mejoró con el degradé, pero la parte superior quedó demasiado clara y algunas tarjetas perdieron contraste.

## Ajuste

- MANTENER degradé.
- Oscurecer la zona superior respecto de V02.5.
- Mantener la zona inferior oscura actual.
- Buscar un punto intermedio entre el Home de V02.4 y el degradé de V02.5.
- No volver al fondo completamente plano.
- No agregar efectos sci-fi.

Referencia visual posible:

```css
background: linear-gradient(
  180deg,
  #08121E 0%,
  var(--bg) 45%,
  var(--bg-deep) 100%
);
```

No es obligatorio usar exactamente ese HEX si una mezcla con tokens existentes queda mejor.

---

# 3. Glow / resplandor — sumar vida sin convertir la app en neón

V02.5 quedó demasiado mate en algunos módulos.

Agregar glow MUY sutil y localizado.

## 3.1 Actividad

Aplicar un glow leve al segmento verde activo/ganados.

Referencia:

```css
box-shadow: 0 0 8px rgba(149,255,25,.16);
```

Ajustar intensidad visualmente; no competir con el botón `+`.

## 3.2 Efectividad

Agregar un `drop-shadow` leve al stroke verde del aro.

Referencia:

```css
filter: drop-shadow(0 0 4px rgba(149,255,25,.20));
```

## 3.3 Último partido

MANTENER borde de 1px y sumar glow muy leve en vez de engrosarlo a 2px.

No usar un 2px duro.

Objetivo: que se sienta apenas “encendido”, no fosforescente.

---

# 4. Tarjeta destacada superior / insight

Tarjeta actual:

`Ganaste 4 de tus últimos 5 con Matu.`

## Problema

Hoy se siente demasiado similar a una tarjeta normal y el borde lateral solo no alcanza.

## Ajuste

- REEMPLAZAR borde lateral aislado por borde completo azul BRAMU.
- Agregar glow azul leve.
- Permitir que el texto ocupe hasta 2 líneas.
- No forzar `nowrap`.
- Mantener contenido corto y legible.
- Darle un poco más de altura si hace falta.

Referencia visual:

```css
border: 1px solid rgba(25,159,255,.70);
box-shadow: 0 0 14px rgba(25,159,255,.10);
```

No implementar carrusel ni múltiples tarjetas nuevas en V02.6. Esa expansión queda para una ronda posterior de producto.

---

# 5. Tarjeta de perfil / Nivel BRAMU

Problema: hay demasiado espacio vacío entre la barra de nivel y `32 partidos en tu historia`.

## Ajuste

- Compactar el espacio vertical.
- Reducir margin/padding en ese tramo.
- Mantener respiración suficiente.
- No reducir el tamaño de la barra.
- No cambiar cálculo ni contenido del nivel.

---

# 6. “Tu momento”

El texto descriptivo está demasiado lavado.

Ejemplo:

`Venís de ganar 5 de tus últimos 5 partidos. Matu es tu compañero más frecuente.`

## Ajuste

- Subir ligeramente el peso tipográfico.
- Subir ligeramente el contraste.
- Mantenerlo por debajo del título en jerarquía.

Referencia:

```css
font-weight: 500;
color: rgba(248,250,252,.78);
```

No convertirlo en blanco pleno ni bold fuerte.

---

# 7. Efectividad — copy inferior

Actualmente:

`22 de 32`

queda pobre en significado.

**REEMPLAZAR** por:

`22 ganados de 32 jugados`

Mantener 69% como dato principal dentro del aro.

No cambiar cálculo.

---

# 8. Selector de jugador — botón “Agregar como jugador sin cuenta”

El selector mejoró mucho y se mantiene.

Problema: el botón actual de alta manual se siente cromáticamente extraño, demasiado relleno y poco integrado.

## Ajuste

Convertirlo en acción secundaria/outlined:

- fondo neutro / surface;
- borde en color contextual del equipo;
- texto en ese mismo color;
- sin relleno verde fuerte;
- sin glow agresivo.

Compañero / Equipo A → verde.

Rival / Equipo B → azul.

Mantener exactamente la función:

`Agregar “X” como jugador sin cuenta`

No tocar lógica de selección ni búsqueda.

---

# 9. Sheet Fecha, Hora y Lugar

La estructura de V02.5 mejoró y se mantiene.

## Problemas

- Se siente tipográficamente algo sobredimensionado respecto del resto de la app.
- Podría tener un poco más de aire vertical.

## Ajuste

- Reducir levemente tamaños tipográficos de labels/campos si están por encima de la escala UI del resto de BRAMU.
- No achicar áreas táctiles.
- Aumentar levemente espaciado vertical/padding del sheet.
- Si hace falta, permitir que el sheet crezca un poco más de alto.
- Mantener Fecha y Hora perfectamente alineados.
- Mantener Lugar + Usar mi ubicación + LISTO.

Idea central: **más aire, no más tipografía**.

---

# 10. Último partido — score, guiones y puntos

Este ajuste debe resolverse de forma robusta.

## Problema

El guion y el punto separador dependen hoy de glifos tipográficos y baseline/`vertical-align`, por lo que nunca terminan de compartir exactamente el mismo eje óptico.

## Solución preferida

**DEJAR de depender del glifo tipográfico para los separadores.**

Construir el score con elementos `inline-flex` / `flex` centrados verticalmente.

Cada set puede seguir leyendo visualmente:

`6–3`

pero el “guion” debe representarse como una barra geométrica propia.

Ejemplo conceptual:

```html
<span class="lastmatch-score__set">
  <span class="lastmatch-score__num">6</span>
  <span class="lastmatch-score__dash" aria-hidden="true"></span>
  <span class="lastmatch-score__num">3</span>
</span>
<span class="lastmatch-score__dot" aria-hidden="true"></span>
```

Referencia CSS:

```css
.lastmatch-score__set,
.lastmatch-score {
  display: inline-flex;
  align-items: center;
}

.lastmatch-score__dash {
  display: block;
  width: .34em;
  height: .07em;
  border-radius: 999px;
  background: currentColor;
  margin: 0 .12em;
  flex: none;
}

.lastmatch-score__dot {
  display: block;
  width: .11em;
  height: .11em;
  border-radius: 50%;
  background: currentColor;
  margin: 0 .18em;
  flex: none;
}
```

Claude puede afinar medidas, pero el principio es obligatorio: **dash y dot deben compartir el mismo eje geométrico, no baseline tipográfico**.

Si por accesibilidad se reemplazan glifos visibles, conservar un `aria-label` equivalente al score completo.

## Resultado esperado

- guiones y puntos perfectamente centrados entre sí;
- ambos centrados respecto de los números;
- dash más liviano/chico que los números;
- separación lateral apenas mayor que V02.5;
- sin hacks de `vertical-align:text-bottom` ni transforms distintos por navegador.

---

# 11. PRIORIDAD CRÍTICA — Confirmar partido / Resumen

V02.5 introdujo una regresión visual importante.

## 11.1 Confirmar partido

Problemas observados:

- nombres y score se descuadraron;
- columnas de sets no quedan alineadas;
- las dos filas de equipos no comparten estructura estable;
- alturas y espacios se sienten arbitrarios.

## 11.2 Resumen

El mismo problema aparece en el bloque principal de resultado:

- nombre ↔ score desalineados;
- columnas de sets inconsistentes;
- renglones se deforman;
- se perdió la lectura deportiva ordenada.

## Solución

No resolver con margins manuales ni `flex-start` ad hoc.

**REEMPLAZAR la estructura de filas por grid estable.**

Cada fila de equipo debe tener:

```text
[NOMBRE / EQUIPO]   [SET 1] [SET 2] [SET 3]
```

Referencia conceptual:

```css
.result-card__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 12px;
}

.result-card__sets {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 28px;
  gap: 8px;
  justify-content: end;
}
```

Los dos equipos deben compartir exactamente la misma grilla de sets.

Requisitos:

- cada columna de set queda alineada verticalmente entre ambas filas;
- nombre puede truncarse con ellipsis si es largo;
- score no salta ni se desplaza por largo de nombre;
- cajas de set tienen tamaño consistente;
- misma solución compartida en Confirmar partido y Resumen si usan el mismo componente;
- no sacrificar lectura en 360px.

No volver al problema anterior de “score demasiado lejos del nombre”: resolverlo con grid y medidas correctas, no con `flex:1` descontrolado.

---

# 12. Resumen — filas Sets ganados / Games ganados

Mantener formato tipo broadcast:

```text
1        SETS GANADOS        2
11       GAMES GANADOS      14
```

## Ajuste

- restaurar altura de fila consistente;
- centrar verticalmente números y labels;
- mantener columnas simétricas;
- evitar alturas distintas por line-height;
- Equipo A verde / Equipo B azul.

Referencia:

```css
.summary-stat-row {
  display: grid;
  grid-template-columns: 44px minmax(0,1fr) 44px;
  align-items: center;
}
```

No convertir en mini-KPIs.

---

# 13. Lo que se mantiene

- Inter.
- Verde BRAMU `#95FF19`.
- Lógica de Actividad.
- Selector de jugador alto (~72%).
- Equipos A/B en verde/azul.
- Flow de carga manual.
- Fecha/hora funcional.
- Notas privadas dentro de Resumen.
- BRAMU Intelligence sin cambios.
- Bottom sheet inicial Registrar partido sin cambios.

---

# 14. Fuera de alcance V02.6

No implementar:

- carrusel/múltiples tarjetas de insight superior;
- nuevas estadísticas;
- cambios de BRAMU Intelligence;
- backend/base de datos;
- perfiles sociales;
- ranking real;
- nuevas funciones de historial;
- cambios de reglas deportivas.

---

# 15. Validación

## 15.1 Automática

- Ejecutar batería completa.
- Mantener todo verde.
- No agregar tests por cambios puramente CSS.

## 15.2 Visual mínima

Validar en 402px y 360px:

1. Home completo.
2. Último partido — score con dash/dot geométricos.
3. Selector de jugador y botón “Agregar sin cuenta”.
4. Sheet Fecha/Hora/Lugar.
5. Confirmar partido.
6. Resumen.

Prioridad especial en Confirmar/Resumen: verificar que las columnas de set coincidan exactamente entre ambas filas.

---

# 16. Criterios de aceptación

- Azul principal es `#199FFF` y derivados acompañan.
- Texto principal es `#F8FAFC`.
- Fondo del Home conserva degradé pero recupera contraste.
- Actividad/Efectividad tienen glow leve, no exagerado.
- Último partido gana presencia sin borde grueso.
- Tarjeta de insight superior tiene borde completo azul + glow leve + hasta 2 líneas.
- Perfil tiene menos aire muerto bajo la barra.
- Texto de Tu momento es más legible.
- Efectividad dice `22 ganados de 32 jugados` o valor equivalente dinámico.
- Botón “Agregar jugador sin cuenta” se integra visualmente como acción secundaria.
- Sheet Fecha/Hora/Lugar respira más pero no usa tipografía sobredimensionada.
- Dash y dot del score están centrados geométricamente en el mismo eje.
- Confirmar partido y Resumen recuperan grilla estable, columnas alineadas y filas consistentes.
- Sets ganados / Games ganados mantienen estructura broadcast.
- BRAMU Intelligence queda intacto.
- Sin regresiones funcionales.

---

# 17. Versión, publicación e informe

1. Actualizar versión a `BRAMUlab V02.6`.
2. Actualizar `version.json`, `Store.VERSION` y caché SW según patrón actual.
3. Ejecutar tests completos.
4. Publicar en GitHub Pages.
5. Crear `BRAMUlab_V02.6_Informe.md` en esta misma carpeta.
6. El informe debe incluir:
   - matriz requisito → implementación;
   - tokens finales;
   - causa exacta de la regresión Confirmar/Resumen;
   - implementación final del score dash/dot;
   - total de tests;
   - validación visual;
   - commit/tag/publicación.

---

## Principio de esta ronda

V02.6 no agrega producto: **afina y corrige**.

La meta es que BRAMU se vea más firme, menos lavado, más deportivo y coherente, y que el flujo final vuelva a sentirse sólido y ordenado.
