# BRAMUlab_V02
## Sistema visual integral y coherencia de experiencia

**Tipo de documento:** consolidado de implementación para Claude Code  
**Estado:** aprobado para implementar — pendiente de implementación  
**Fecha:** 03/09/2026  
**Base:** BRAMUlab_V01 (estado funcional actual, hoy en v2.2.1)  
**Fuente de verdad de esta ronda:** este documento prevalece, para las decisiones visuales aquí incluidas, sobre auditorías, informes y consolidados anteriores.

---

## 0. Instrucción principal

Implementar una pasada visual integral sobre la aplicación existente, preservando la lógica funcional que ya fue verificada. El objetivo no es aplicar parches aislados ni sumar otra capa cromática sobre lo actual: hay que convertir la interfaz completa en un sistema único, coherente y reconocible.

La referencia de atmósfera es una cancha profesional nocturna y la referencia de jerarquía/densidad es VIBERO. No copiar ninguna de las dos literalmente. BRAMU debe sentirse como el archivo personal premium de un jugador de pádel: oscuro, preciso, humano y deportivo.

### Regla de ejecución

- **REEMPLAZAR:** sistema cromático global, tipografía, jerarquías, superficies, bordes, botones, chips, hojas inferiores y tratamiento visual de tarjetas.
- **FUSIONAR:** los nuevos criterios visuales con los componentes, datos, navegación y flujos funcionales existentes.
- **CONSERVAR:** persistencia, modelos de datos, reglas de partido, validaciones, ordenamiento cronológico, PWA, actualización, navegación funcional y tests ya aprobados.
- **NO AGREGAR:** funciones sociales, usuarios reales, base de datos remota, validación entre rivales, ranking real, amigos, grupos, Dynamic Island ni rediseño estructural definitivo del marcador en vivo.

No dejar pantallas con el lenguaje anterior. Un híbrido verde-negro + azul nuevo se considera una implementación incompleta.

---

## 1. Norte conceptual

**BRAMU es donde vive tu pádel.** Registra partidos y convierte datos dispersos en historia personal: momento, evolución, compañeros, rivales, rachas y recuerdos.

La interfaz debe transmitir:

1. **Noche de partido:** fondo azul noche casi negro, profundidad y contraste.
2. **Precisión de cancha:** líneas finas, grilla clara, alineaciones cuidadas y espacios consistentes.
3. **Luz con función:** el brillo aparece solo en acciones, estados vivos, logros o datos protagonistas.
4. **Jerarquía deportiva:** el resultado se lee antes que los metadatos; los nombres acompañan y no compiten.
5. **Historia personal:** no debe parecer una transmisión televisiva ni un dashboard SaaS genérico.

### Qué significa “neón” en BRAMU

Sí se permite el neón entendido como luz localizada: un halo leve en el botón principal, una línea activa, un dato vivo o un estado ganado.

No se permite:

- múltiples colores brillando con el mismo peso;
- glow permanente en todas las tarjetas;
- fondos galaxia, grillas sci-fi, circuitos o estética gamer;
- gradientes decorativos sin función;
- glassmorphism generalizado.

---

## 2. Decisiones cerradas

### 2.1 Tipografía

**REEMPLAZAR Oswald y Manrope por Inter como familia principal de toda la aplicación.**

- Inter 400: cuerpo y textos largos.
- Inter 500: metadatos y controles secundarios.
- Inter 600: labels, pestañas, nombres y botones secundarios.
- Inter 700: títulos, CTA y cifras importantes.
- Inter 800/900: resultados, marcadores y números hero.
- Usar `font-variant-numeric: tabular-nums` en resultados, horarios, porcentajes y nivel.
- Evitar mayúsculas condensadas con tracking exagerado.
- Las mayúsculas se reservan para volantas pequeñas, no para todo el sistema.

Preferencia técnica: incluir Inter Variable como recurso local `.woff2` para asegurar consistencia y funcionamiento PWA. Mantener fallbacks `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.

Archivo no entra en esta versión. Puede conservarse como exploración futura para usos editoriales puntuales, pero no debe mezclarse ahora.

### 2.2 Roles cromáticos

Los roles son semánticos y no intercambiables:

- **Azul noche casi negro:** ambiente, fondo y superficies.
- **Azul intenso:** Equipo A.
- **Magenta chicle:** Equipo B.
- **Verde lima eléctrico:** identidad BRAMU, acción, selección, progreso y estados positivos. No representa un equipo.
- **Cian intenso:** microacento lumínico, reflejo, línea técnica o información secundaria especial. No es un tercer protagonista.
- **Blanco y grises fríos:** contenido, lectura y jerarquía.
- **Dorado:** excepción semántica para “Punto de Oro”. No es color global de marca ni CTA.
- **Coral/rojo:** error, derrota o peligro, con uso contenido.

### 2.3 Paleta inicial implementable

Estos valores son punto de partida coherente. Deben centralizarse como tokens y podrán afinarse luego de ver las pantallas reales:

```css
:root {
  --bg-deep: #03070D;
  --bg: #050A12;
  --surface-1: #09131F;
  --surface-2: #0D1A2A;
  --surface-3: #112238;
  --surface-active: #152B43;

  --text: #F5F7FA;
  --text-dim: #9AA7B5;
  --text-faint: #687482;

  --brand-lime: #C8FF3D;
  --brand-lime-deep: #87C91C;
  --accent-cyan: #32D7FF;

  --team-a: #2D9CFF;
  --team-a-deep: #1267BD;
  --team-b: #FF3EA5;
  --team-b-deep: #B91F73;

  --gold: #FFC93D;
  --danger: #FF5B61;
  --success: #C8FF3D;

  --line: rgba(183, 211, 235, 0.14);
  --line-strong: rgba(183, 211, 235, 0.24);
  --scrim: rgba(1, 5, 10, 0.78);
}
```

No hardcodear colores nuevos dentro de componentes si ya existe un token semántico adecuado.

### 2.4 Estados competitivos

- **Punto de Oro:** dorado.
- **Deuce/iguales:** blanco o gris neutro.
- **Ventaja:** color del equipo que tiene la ventaja.
- **Match point:** color del equipo correspondiente, con un glow breve y controlado.
- **Victoria personal / progreso / acción confirmada:** lima.
- **Derrota / error:** coral, sin inundar la tarjeta.

---

## 3. Sistema base de interfaz

### 3.1 Fondo y profundidad

**REEMPLAZAR** el negro verdoso del Home, Historial y Perfil por el mismo universo azul noche del flujo de partido.

- El fondo general usa `--bg` y puede profundizarse con `--bg-deep`.
- Las superficies se distinguen por luminosidad, borde y un degradado muy sutil; no por sombras grises convencionales.
- Se admite un spotlight azul/cian casi imperceptible en zonas hero, nunca como fondo decorativo permanente.
- El azul debe dominar claramente la composición. Lima y magenta deben ocupar poco peso visual.

### 3.2 Tarjetas

- Radio base: 16px.
- Tarjetas hero: 18px.
- Controles y chips: 10–12px o forma píldora cuando corresponda.
- Borde: 1px con `--line`; `--line-strong` solo en selección/foco.
- Padding móvil base: 16px; hero: 18–20px.
- Separación entre tarjetas: 12px.
- No usar el mismo tratamiento visual para todas las tarjetas: debe existir jerarquía entre hero, narrativa y métrica.

### 3.3 Glow y elevación

- Sin sombra negra pesada.
- Glow lime suave únicamente en CTA principal activo, progreso importante o logro.
- Glow azul/magenta únicamente para estados competitivos del equipo correspondiente.
- El glow no debe reducir legibilidad ni producir un contorno gamer.
- Respetar `prefers-reduced-motion`.

### 3.4 Iconografía

**REEMPLAZAR emojis e iconos mezclados por un único sistema de SVG lineal.**

- Trazo aproximado: 1.75–2px.
- Tamaños de navegación: 22–24px.
- Tamaños dentro de tarjetas: 18–22px.
- Usar lima solo en iconos activos o protagonistas.
- “Tu momento” puede usar una pelota de pádel o símbolo propio, no el emoji pequeño actual.

### 3.5 Botones

- CTA principal: fondo lima, texto azul noche, ancho completo cuando cierra una tarea.
- Secundario: superficie azul oscura, borde fino, texto blanco.
- Terciario: texto o control compacto; no competir con el CTA.
- Estados disabled claramente legibles, sin parecer errores de contraste.
- Altura táctil mínima: 48px.
- El texto se centra cuando el control es un botón de acción.
- El dorado deja de ser CTA global.

### 3.6 Motion

- Transiciones entre 160 y 240ms.
- Sheets: entrada vertical limpia y salida inversa.
- Botones: feedback breve de presión, sin rebote excesivo.
- Resultados/logros: pulso único; no animación infinita salvo estado “en vivo”.
- Mantener soporte de reducción de movimiento.

---

## 4. Aplicación por pantalla

### 4.1 Header y navegación

#### Header

- Fondo integrado al azul noche general.
- Logo con alto contraste, sin sumar dorado como acento.
- Campana mediante SVG del sistema; estados futuros pueden usar un punto lima pequeño.
- Divisores finos y discretos.

#### Barra inferior

- Mantener: Inicio, Historial, +, Ranking, Perfil.
- Fondo azul noche con separación superior precisa.
- Estado activo en lima; estados inactivos en gris frío.
- Botón `+` central en lima, entendido visualmente como la pelota/acción BRAMU.
- El glow del `+` debe ser controlado, no una mancha amarilla.

En flujos de tarea concentrada —cargar partido, registrar en vivo, editar— la barra inferior puede ocultarse deliberadamente. La pantalla debe tener regreso claro y transición coherente para que no parezca que la navegación desapareció por error.

### 4.2 Sheet “Registrar partido”

**REEMPLAZAR** el sheet bajo y débil actual.

- En móvil: ancho completo, anclado abajo, radio solo en esquinas superiores.
- Altura según contenido, aproximadamente 30–38% de la pantalla.
- Handle superior, título y cierre correctamente alineados.
- Dos opciones con aspecto inequívoco de botones/tarjetas de acción.
- Texto centrado en cada acción.
- Primera acción: “Cargar partido jugado”, jerarquía principal.
- Segunda acción: “Registrar partido en vivo”, jerarquía secundaria.
- Scrim oscuro suficiente para separar el contexto.
- En tablet/escritorio puede tener ancho máximo y quedar centrado.

### 4.3 Home

#### Insight superior

- Mantenerlo compacto.
- Debe leerse como una observación contextual, no como otra tarjeta completa.
- Puede usar una línea/acento lime muy pequeño; sin glow permanente.

#### Tarjeta de perfil

- Nombre principal: “Seba”.
- “12 partidos en tu historia” debajo del nombre, en jerarquía secundaria.
- Nivel BRAMU a la derecha, con cifra clara y variación pequeña.
- Barra de progreso fina, limpia y lime.
- Reducir competencia entre avatar, nombre, datos y nivel.

#### Último partido — tarjeta hero

Esta es la pieza principal del Home y debe adoptar la jerarquía observada en VIBERO sin copiar su diseño.

- Superficie más oscura que las demás, con leve degradado azul noche.
- Volanta superior unificada: puntos de forma reciente + “ÚLTIMO PARTIDO” + etiqueta Victoria/Derrota.
- Fecha y lugar alineados a la derecha dentro del mismo nivel de lectura.
- Resultado notablemente más grande; Inter 800/900 con números tabulares.
- Nombres de jugadores más pequeños que el resultado.
- Chevron alineado con la fila de jugadores o zona de entrada al detalle, no flotando en el medio.
- Padding interno generoso.
- Acento lineal fino lateral o superior según resultado: lime para victoria, coral contenido para derrota.
- Los puntos de forma no llevan letras internas; son indicadores pequeños de color con accesibilidad mediante `aria-label`/texto alternativo.

#### Tu momento

- Debe diferenciarse de una tarjeta estadística común.
- Reemplazar el emoji por icono propio de pelota/momento.
- Crear una iluminación o degradado muy sutil que le dé carácter narrativo.
- Mantener el texto como protagonista, con interlineado cómodo y lectura izquierda.
- No convertirla en una tarjeta neón.

#### Actividad y efectividad

- Mantenerlas como métricas visuales destacadas y de igual altura.
- Unificar títulos, periodos, grosores, alineaciones y textos inferiores.
- Lima representa progreso/efectividad; cian puede acompañar información técnica secundaria.
- No usar Team A/Team B en estas métricas.

#### Métricas restantes

- Racha actual, partidos totales, mejor compañero y rival frecuente: tarjetas compactas del mismo sistema.
- El dato debe dominar; el label y la explicación acompañan.
- Evitar cuatro tarjetas idénticas sin variación de jerarquía.

### 4.4 Historial

- Mantener las pestañas principales horizontales con scroll cuando no entren: Todos / Mis partidos / Observados.
- Las pestañas funcionan como filtros reales, no como botones sueltos.
- Estado activo: texto blanco/lima y línea inferior precisa.
- Filtros secundarios por modo deben verse como chips, con menor jerarquía que las pestañas.
- Las tarjetas de partido deben priorizar, en este orden: resultado, jugadores, estado, fecha/modo y duración.
- Usar azul y magenta solo cuando aporten lectura de equipos.
- Evitar bordes o glows intensos en todas las entradas.
- Mantener barra inferior visible por ser una sección principal.

### 4.5 Carga manual de partido jugado

La carga debe sentirse como registrar un resultado, no completar un formulario administrativo.

#### Estructura

- Pantalla enfocada, sin barra inferior.
- Header corto con volver, número de set y formato activo.
- Jugadores y equipos claramente diferenciados: Equipo A azul, Equipo B magenta.
- El resultado del set es el centro visual de la pantalla.
- Formato, fecha, hora y lugar son información secundaria.

#### Selector de jugadores

- En móvil debe abrir como sheet de ancho completo, no como modal angosto flotante.
- Estructura tipo selector/transferencia: frecuentes arriba, búsqueda clara, listado debajo.
- Área táctil cómoda y alineación consistente.
- No perder contexto de qué rol se está eligiendo: compañero, rival 1 o rival 2.

#### Carga de resultado

- Dos campos numéricos grandes enfrentados, con color de equipo y separador central.
- Al tocar un campo, el teclado ocupa la zona inferior y el CTA “Continuar” sube por encima, como patrón de ingreso monetario de Mercado Pago.
- Mantener el teclado propio solo si funciona como parte integrada de la pantalla; no debe quedar lejos del resultado.
- Restringir opciones según las reglas de set cuando sea seguro hacerlo. No permitir combinaciones imposibles para luego castigarlas únicamente con un error tardío.
- Si una regla admite excepciones, permitir corrección manual clara.
- Avanzar al segundo campo y al set siguiente con el mínimo de toques.
- Mostrar arriba el resultado parcial ya completado.
- Errores junto al resultado, en lenguaje concreto; no como texto rojo perdido en la pantalla.

#### Formato y puntuación

- Sheet de ancho completo en móvil.
- Título centrado y cierre alineado.
- Separar visualmente “Formato de partido” de “Sistema de puntuación”.
- Controles con aire suficiente; ningún label pegado a otro botón.
- “Listo” como CTA de ancho completo, no como botón pequeño aislado.
- Punto de Oro usa dorado por semántica; no recolorear todo el sheet de dorado.

#### Fecha, hora y lugar

- Dar por defecto que se carga al terminar de jugar: “Ahora · Hoy · [hora]”.
- Mostrarlo en una fila secundaria compacta con acción “Modificar”.
- Lugar opcional y ubicación no deben competir con Guardar.
- “Usar mi ubicación” pasa a acción secundaria/terciaria compacta.
- “Guardar partido” debe ser el CTA central y de ancho completo cuando corresponda.

#### Cierre de carga

Cuando el resultado sea válido y defina el partido:

1. Guardar el partido.
2. Confirmar visualmente que quedó registrado.
3. Ofrecer, sin bloquear el guardado:
   - modificar fecha/hora/lugar;
   - agregar sensaciones privadas del partido.

Las sensaciones son privadas para quien cargó el partido y deben persistir asociadas a ese registro. En esta versión no se comparten con rivales ni se procesan como función social. Preparar el dato para un uso futuro con coach/profesor, sin construir todavía ese producto.

### 4.6 Resumen de partido

- Mantener el resultado y ganadores con alta jerarquía.
- Reducir el exceso de centrado: el bloque analítico debe leerse de izquierda a derecha.
- Crear una sección identificable como **BRAMU Intelligence**, con icono propio, título y una frase de encuadre.
- El análisis debe vivir dentro de una superficie o bloque editorial que invite a leerlo, no como párrafo colgado.
- Mantener “Editar partido” como secundaria y “Volver al inicio” como CTA principal.
- No reincorporar “Compartir resumen” en esta ronda.

### 4.7 Ranking y Perfil

- Aplicar fondo, tipografía, header, iconografía, navegación y superficies del nuevo sistema.
- No inventar contenido ni funciones para llenar placeholders.
- Los estados vacíos deben sentirse intencionales y premium, no pantallas olvidadas.

### 4.8 Partido en vivo

- FUSIONAR la paleta actual de cancha con los nuevos tokens globales.
- Actualizar tipografía, botones, overlays y colores de equipos: A azul, B magenta, lima para interfaz.
- Mantener reglas y funcionamiento actual.
- No ejecutar todavía el rediseño estructural definitivo del marcador en vivo; requiere una ronda específica posterior.

---

## 5. Reglas de composición y accesibilidad

- Diseñar primero para iPhone 16 Pro / viewport aproximado 402 × 874, sin romper otros anchos.
- Mantener áreas táctiles mínimas de 44–48px.
- Verificar contraste de texto, especialmente gris sobre superficies azules.
- No comunicar estados exclusivamente por color: sumar texto, icono o `aria-label`.
- Respetar safe areas superior e inferior.
- Evitar que teclados, sheets o CTA tapen el contenido activo.
- No introducir scroll horizontal salvo en pestañas/chips expresamente desplazables.
- En escritorio, mantener un ancho de app controlado; no estirar tarjetas a todo el navegador.

---

## 6. Arquitectura técnica esperada

### REEMPLAZAR

- Variables de color actuales por tokens semánticos centralizados.
- Tipografías globales por Inter.
- Estilos dispersos de botones, chips, tarjetas, sheets, scrims, inputs e iconos por componentes/tokens compartidos.
- Colores de equipos actuales: lime/azul pasa a azul/magenta.

### FUSIONAR

- Clases y estructura existentes con el nuevo sistema, evitando reescribir lógica innecesariamente.
- Paleta `court-*` con la paleta global para que el marcador no parezca otra aplicación.
- Estados existentes de victoria, derrota, forma, selección y disabled con sus nuevos roles cromáticos.

### CONSERVAR Y FUSIONAR

- **`privateNote`:** el campo persistente de notas/sensaciones privadas ya está implementado y funcionando en BRAMUlab_V01 (Etapa 4.2/v2.2). Mantener el campo tal cual — no duplicarlo ni cambiar su modelo de datos salvo que exista una necesidad técnica comprobada — y rediseñar únicamente su presentación dentro del nuevo sistema visual.

### AGREGAR

- Archivo/fuente Inter Variable local si todavía no existe.
- Tokens de tipografía, espaciado, radios, bordes, motion y glow.
- SVG consistentes para iconografía faltante.
- Pruebas de migración/retrocompatibilidad si cambia el esquema local del partido.

No duplicar hojas de estilo completas ni crear un “theme v2” paralelo permanente. El resultado final debe tener una sola fuente de verdad visual.

---

## 7. Criterios de aceptación visual

La implementación no se considera terminada hasta verificar:

1. No quedan superficies verde-negras del sistema anterior.
2. No quedan CTA dorados generales.
3. Equipo A se representa en azul y Equipo B en magenta en todas las pantallas.
4. Lima se usa como identidad/acción, nunca como color de equipo.
5. Inter aparece realmente como fuente calculada en toda la app.
6. No quedan emojis usados como iconografía funcional.
7. Home tiene tres jerarquías claras: último partido hero, Tu momento narrativo y métricas.
8. El resultado domina la carga manual y el resumen.
9. Los sheets móviles usan correctamente el ancho disponible.
10. Historial conserva pestañas desplazables y filtros secundarios diferenciados.
11. La barra inferior se ve consistente y solo desaparece en flujos enfocados de manera deliberada.
12. No existen glows permanentes compitiendo entre lima, azul, magenta, cian y dorado.
13. La aplicación se percibe como un solo producto al pasar de Home a Historial, carga, resumen y partido en vivo.

---

## 8. Verificación obligatoria antes de publicar

### Funcional

- Ejecutar la suite completa existente.
- Probar carga de partido clásico a dos sets.
- Probar partido a tres sets.
- Probar Punto de Oro y otros sistemas disponibles.
- Probar edición posterior.
- Probar persistencia al cerrar/reabrir la PWA.
- Probar “Volver al inicio”.
- Probar orden cronológico de Último partido.
- Probar que `privateNote` (sensaciones privadas, ya existente desde BRAMUlab_V01) sigue persistiendo y funcionando igual, solo con presentación nueva.
- Probar que la actualización PWA se ofrece y aplica correctamente.

### Visual

Generar capturas comparables en 402 × 874 de:

1. Home completo.
2. Sheet Registrar partido.
3. Carga manual sin teclado.
4. Carga manual con teclado.
5. Selector de jugador.
6. Formato y puntuación.
7. Historial con pestañas y filtros.
8. Resumen con BRAMU Intelligence.
9. Partido en vivo.
10. Ranking/Perfil en estado actual.

Revisar las diez capturas como conjunto antes de publicar. Si una parece pertenecer a otra app o conserva el lenguaje anterior, corregirla antes del deploy.

### Publicación

- Actualizar la versión visible de la aplicación (badge/texto de producto) para que se identifique como **BRAMUlab V02** — con espacio, como texto de producto, no `BRAMUlab_V02` (esa es la convención de nombrado de archivos/documentos). Los tags técnicos internos anteriores como `v2.2.1` quedan como historial técnico de BRAMUlab_V01 y no deben seguir apareciendo como naming visible de producto.
- Commit único o secuencia clara de commits para esta etapa.
- Publicar en GitHub Pages solo después de tests y revisión visual.
- Crear `docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md` con archivos modificados, decisiones técnicas, pruebas realizadas, capturas y cualquier desvío justificado.

---

## 9. Fuera de alcance de BRAMUlab_V02

- Rediseño estructural definitivo del marcador en vivo.
- Base de datos y autenticación real.
- Usuarios, amigos y grupos.
- Validación de partido por rivales.
- Nivel/ranking competitivo real.
- Procesamiento inteligente de notas privadas.
- Compartir notas con coach/profesor.
- Personalización de tarjetas.
- Dynamic Island.
- Gráfico de evolución definitivo con ranking real.
- Rebranding final del logo.

Estos temas no deben usarse como excusa para dejar incompleto el sistema visual de las pantallas existentes.

---

## 10. Entrega esperada de Claude Code

Antes de implementar:

1. Leer este documento completo.
2. Leer `docs/BRAMUlab/Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md` como fuente de verdad del estado funcional actual. Consultar documentos archivados solamente si hace falta resolver una duda técnica concreta.
3. Presentar un plan breve por archivos/componentes.
4. Señalar conflictos concretos entre el documento y el código actual, sin reabrir decisiones ya cerradas.

Después:

1. Implementar la ronda completa.
2. Ejecutar tests y verificación visual.
3. Corregir inconsistencias encontradas.
4. Actualizar la versión visible, publicar y crear `docs/BRAMUlab/Versiones/BRAMUlab_V02/BRAMUlab_V02_Informe.md`.

No pedir a Sebastián valores CSS pantalla por pantalla. La implementación debe resolver el sistema con criterio; el ajuste fino vendrá después de ver una versión coherente funcionando.
