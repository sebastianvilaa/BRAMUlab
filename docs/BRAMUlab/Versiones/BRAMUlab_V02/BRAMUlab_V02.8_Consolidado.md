# BRAMUlab V02.8 — Consolidado final

**Base:** BRAMUlab V02.7 publicada.
**Documento de referencia:** `BRAMUlab_V02.8_Auditoria_Visual_CSS.md`.

## Objetivo

Cerrar la etapa de afinación visual y microinteracciones antes de pasar al siguiente bloque de producto.

V02.8 debe resolver inconsistencias visuales verificadas por la auditoría, consolidar decisiones ya validadas, mejorar el dinamismo del Home sin hacerlo invasivo, normalizar ritmo/títulos/superficies donde hay desvíos reales y limpiar CSS muerto o duplicado de bajo riesgo.

No convertir esta versión en una refactorización general ni en una ampliación de producto.

---

# 1. Home — microanimaciones

## REEMPLAZAR comportamiento actual

Las animaciones deben ejecutarse **cada vez que el usuario entra o vuelve al Home**.

### Nivel BRAMU
- barra desde 0 hasta el valor real;
- duración ~0.5–0.6 s;
- easing suave, sin rebote.

### Actividad
- 4 barras desde 0 hasta altura real;
- stagger izquierda→derecha;
- semana más reciente sigue a la derecha;
- duración ~0.45–0.6 s;
- stagger ~60–80 ms.

### Efectividad
- arco desde 0 hasta porcentaje real;
- número central directo, sin contar;
- duración ~0.7–0.8 s.

Mantener `prefers-reduced-motion`: estado final directo y sin pulsos.

Criterio: movimiento visible pero breve, sin sensación de loading/demo.

---

# 2. Home — Efectividad

## REEMPLAZAR glow actual

El `drop-shadow` actual genera una percepción rectangular/cuadrada y en iPhone casi no se ve.

No aumentar ese mismo efecto.

Nueva solución:
- duplicar el arco verde detrás del stroke principal;
- stroke posterior algo más grueso;
- baja opacidad;
- blur suave;
- el halo debe seguir la circunferencia/arco, nunca formar una caja.

El arco principal queda nítido.

El glow debe verse en iPhone, pero seguir por debajo del `+` central en intensidad.

Mantener Efectividad histórica total y copy `X ganados de Y jugados`.

---

# 3. Home — Último partido

## MANTENER
- estructura;
- altura;
- nombres/equipos;
- marcador y separadores.

No compactar ni llevar nombres a una sola línea.

## AJUSTAR pulso
El pulso actual es demasiado sutil.

Subir un escalón la intensidad:
- ciclo lento ~3–4 s;
- variar solo glow;
- sin cambiar tamaño ni borde;
- sin blink;
- debe sentirse vivo sin reclamar atención.

Mantener `prefers-reduced-motion`.

---

# 4. Home — tarjeta de hito

## REEMPLAZAR por variante validada

```css
.player-home-hitos__chip {
  flex: 0 0 86%;
  scroll-snap-align: start;
  background: var(--surface-2);
  border: 1px solid #199FFF;
  border-radius: 14px;
  box-shadow: 0 0 5px rgba(25, 159, 255, 0.5);
  padding: 16px 18px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--text);
  white-space: normal;
}
```

Texto blanco, fondo `surface-2`, borde azul BRAMU, glow azul leve, hasta 2 líneas.

No volver a texto azul.
No crear nuevas tarjetas/carrusel.

---

# 5. Títulos de overlays / modales

## REEMPLAZAR tracking heredado

`.overlay__title` usa `letter-spacing: 0.1em` y quedó viejo frente al sistema actual.

Cambiar la clase compartida a:

`letter-spacing: 0.03em`

No corregir solo Notificaciones: aplicar a la familia completa de overlays.

Mantener mayúsculas, peso y color salvo necesidad específica del componente.

---

# 6. “Agregar como jugador sin cuenta”

## REEMPLAZAR color del texto

Mantener:
- fondo secundario/neutro;
- borde contextual verde (compañero/A) o azul (rival/B);
- lógica actual.

Cambiar texto a:
`color: var(--text);`

El color contextual queda expresado por el borde, no por el texto.

---

# 7. Resumen del partido — ritmo vertical

La auditoría confirmó que 26px entre todos los bloques genera demasiado aire.

## AGREGAR aire entre metadata y primera tarjeta
La línea fecha/hora/formato debe separarse mejor de la tarjeta de resultado.

Referencia: ~12–16px.

## REDUCIR separación entre bloques
Resultado / BRAMU Intelligence / Notas privadas / Editar partido / acciones:
- 12px como ritmo estándar;
- hasta 16px si hay cambio real de bloque.

No comprimir padding interno ni cambiar contenido/lógica.

---

# 8. Setup / Configurar partido

## REEMPLAZAR fondo plano

`.view--setup` debe usar la misma familia de fondo funcional que Historial, Ranking, Perfil, Carga manual, Confirmar y Resumen.

Usar `var(--bg-gradient-app)` o mecanismo equivalente ya consolidado.

No tocar el degradé propio del Home.

---

# 9. Overlay Highlight

## REEMPLAZAR bug heredado

De:
```css
background: rgba(11,18,17,0.55);
```

A:
```css
background: var(--scrim);
```

Mantener resto sin cambios.

---

# 10. Normalización segura de radios

No homogeneizar indiscriminadamente.

Mantener familias:
- circular 50%;
- pills 999px;
- microcontroles 4–10px;
- filas/superficies compactas 12–14px;
- tarjetas estándar 16px;
- hero 18px;
- sheets/modales 20px.

## NORMALIZAR solo casos verificables
- `.court-team-card__player`: 11px → 12px.
- cuando una tarjeta estándar literal use exactamente 16px, reemplazar por `var(--radius-card)` si es equivalencia 1:1.
- cuando un hero literal use exactamente 18px, reemplazar por `var(--radius-hero)` si es equivalencia 1:1.

No cambiar Historial para igualarlo al Home.
No convertir 12/14/16/18 en un solo valor.

---

# 11. Historial — bordes

## MANTENER

No agregar bordes verdes/azules a las tarjetas de Historial en V02.8.
No convertirlas en copias del Home.

El rediseño de Historial queda para el próximo bloque de producto.

---

# 12. Limpieza CSS segura

## Duplicado `.status-banner`
Eliminar uno de los dos bloques idénticos `.status-banner` / `.band-seg`.

Sin cambio visual.

## CSS muerto de vieja pantalla Resumen
Eliminar las ~85 líneas confirmadas sin uso:
- `.view--summary`;
- `.summary-card*`;
- `.summary-stats`;
- `.summary-actions`;
- selectores asociados únicamente si búsqueda confirma que no tienen referencias activas.

No hacer limpieza general agresiva.

---

# 13. Arquitectura CSS

## MANTENER un solo `styles.css`

No modularizar V02.8.

La auditoría determinó que 2122 líneas siguen siendo manejables y no hay síntomas que justifiquen el riesgo ahora.

Reevaluar modularización más adelante, especialmente al acercarse a 2500–3000 líneas o al sumar una feature grande.

---

# 14. Mantener sin cambios

No modificar:
- Inter;
- verde `#95FF19`;
- azul `#199FFF`;
- fondo actual del Home;
- Actividad últimas 4 semanas;
- semana actual a la derecha;
- Efectividad histórica total;
- Último partido (estructura/altura/nombres);
- bottom nav;
- carga manual;
- selector alto;
- Confirmar partido;
- contenido/estadísticas de Resumen (solo spacing);
- Notas privadas;
- BRAMU Intelligence;
- reglas deportivas;
- backend/BD;
- perfiles sociales;
- Ranking real.

---

# 15. Fuera de alcance

No implementar:
- rediseño funcional de Historial;
- ficha detallada nueva;
- Perfil completo/amigos/password;
- usuarios reales;
- algoritmo de Ranking;
- nuevas métricas;
- nuevas tarjetas de hito;
- carrusel;
- cambios en BRAMU Intelligence;
- modularización CSS;
- refactorización de keyframes solo por mantenibilidad;
- cambios generales no listados.

---

# 16. Validación obligatoria

## Tests
- batería completa;
- todos verdes;
- agregar tests solo si aparece lógica nueva real;
- no inventar tests para CSS puro.

## Visual — Home
Probar 402px y 360px:
- Nivel/Actividad/Efectividad animan cada vez que se entra;
- animación visible y breve;
- sin saltos;
- glow de Efectividad sigue el arco, no forma cuadrado;
- visible en móvil;
- Último partido conserva altura/nombres;
- pulso apenas perceptible pero presente;
- hito coincide con variante aprobada.

## Visual — resto
Verificar:
- Notificaciones y overlays equivalentes con tracking coherente;
- CTA jugador sin cuenta con texto blanco;
- Resumen con mejor ritmo;
- metadata con aire correcto;
- Setup con fondo unificado;
- Highlight con scrim correcto;
- Historial intacto.

## Regresión
Recorrer:
Home, Historial, Ranking, Perfil, Setup, Carga manual, selector de jugador, Confirmar, Resumen, Notificaciones y Highlight.

Sin overflows nuevos en 360px.
Sin errores nuevos de consola atribuibles a V02.8.

---

# 17. Cierre

Al finalizar:
1. actualizar versión a BRAMUlab V02.8;
2. actualizar `version.json`;
3. actualizar cache/service worker;
4. tests completos;
5. corregir regresiones;
6. validar 402px y 360px;
7. publicar GitHub Pages;
8. crear tag `BRAMUlab_V02.8`;
9. generar `BRAMUlab_V02.8_Informe.md` en la misma carpeta.

El informe debe documentar:
- requisito → implementación → archivo/regla;
- overlay Highlight;
- `.overlay__title`;
- microanimaciones y reentrada al Home;
- técnica final de glow de Efectividad;
- valores finales del pulso;
- spacing de Resumen;
- CSS muerto/duplicado eliminado;
- radios normalizados;
- tests;
- validación visual;
- commits/tag.

---

# Criterio de éxito

V02.8 queda cerrada cuando BRAMU se siente visualmente consistente sin que todas las superficies parezcan iguales, las microanimaciones del Home sean perceptibles pero discretas y no queden inconsistencias visuales claras heredadas del CSS.

Después de V02.8, la prioridad pasa al siguiente bloque de producto: **Historial**.
