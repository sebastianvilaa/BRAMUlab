# BRAMUlab — Backup de decisiones de UX y flujo de partidos (V02)

**Tipo de documento:** respaldo final de un chat archivado  
**Fecha de cierre:** 10 de septiembre de 2026  
**Alcance:** decisiones recuperables surgidas durante la revisión de BRAMUlab V02.x, contrastadas con la documentación vigente al cierre.  
**Importante:** este archivo no reemplaza los consolidados ni los informes de versión. Ante una contradicción, prevalece el documento de la versión más nueva y, para el estado actual de la aplicación, el `README.md` del proyecto.

## 1. Objetivo que tuvo este chat

Convertir una revisión intensiva de la rama jugador de BRAMUlab en decisiones concretas de producto, UX y terminación visual. El trabajo se concentró en:

- Home del jugador: identidad, Nivel BRAMU, Actividad, Efectividad, Último partido y tarjetas de historial.
- Flujo para registrar/cargar un partido manualmente.
- Pantallas de confirmación y resumen posterior al guardado.
- Historial y accesos a estadísticas de compañeros y rivales.
- Organización del trabajo en subversiones V02.x y preparación de consolidados para implementación.
- Un método de implementación y QA que permitiera iterar sin consumir tiempo ni cuota en verificaciones visuales innecesarias.

La intención no era definir desde cero toda la aplicación, sino pulir una base funcional existente y dejar instrucciones suficientemente precisas para que otra persona o agente pudiera implementarlas sin depender de este chat.

## 2. Estado documental y versiones de referencia

### Estado vigente al cierre de este backup

- La versión funcional informada por el `README.md` es **BRAMUlab V03.4.6**.
- **V02.9.3** es el cierre efectivo de V02 y la última referencia para el sistema visual de esa etapa.
- V03 parte de la base visual/funcional de V02.9.3 y agrega identidad real, cuenta local, Player Card y Perfil editable, entre otras evoluciones posteriores.
- Por lo tanto, las decisiones de este backup deben tratarse como **criterios de producto y antecedentes de diseño**, no como una orden de volver el código actual a V02.4.

### Hitos relevantes de este chat

| Hito | Qué dejó establecido |
|---|---|
| V02.1–V02.2 | Primeras correcciones de flujo, jerarquía visual, Historial y accesos desde Home. |
| V02.3 | Color contextual en selección de jugadores, pausa explícita al completar el último set, confirmación previa al guardado, notas y primera corrección de Actividad/Efectividad. |
| V02.4 | Actividad apilada, lectura visual del progreso del Nivel BRAMU, mayor jerarquía de Último partido, sheet de registro compacto y sets más legibles. |
| V02.5–V02.8.x | Integración cromática, selector, fecha/hora, notas no bloqueantes, grillas estables, fondo y motion, auditoría visual y correcciones sucesivas. |
| V02.9–V02.9.3 | Cierre visual: Historial compacto, información real de formato/sistema, eliminación de partido, jerarquía definitiva del resultado y neutralidad de nombres de jugadores. |
| V03.0 | Inicio de la identidad real del jugador sobre la base de V02.9.3. |
| V03.4.6 | Versión funcional vigente al cerrar este documento; corrigió alineación de tabs de Historial en tablet y el cálculo/render del gráfico de Evolución del Nivel BRAMU cuando Perfil estaba oculto. |

## 3. Decisiones confirmadas de producto y UX

### 3.1. Arquitectura de cierre de un partido

La experiencia no debe dividir el mismo contenido entre pantallas redundantes de “Partido guardado”, “Resumen” y “Análisis”. La decisión fue mantener un flujo con funciones diferenciadas:

1. Al completar el resultado del último set, mostrar un estado de **PARTIDO COMPLETO** y detenerse allí.
2. Mantener visibles equipos, resultado por sets, formato/sistema y acceso para modificar fecha, hora y lugar.
3. No navegar automáticamente al completar el último set: el usuario debe conservar la oportunidad de revisar o corregir.
4. El botón **CONTINUAR** abre **CONFIRMAR PARTIDO**.
5. La confirmación debe mostrar victoria/derrota, ganador, ambos equipos y marcador por sets, además de fecha/hora/lugar editables y notas privadas.
6. La acción principal es **GUARDAR PARTIDO**.
7. Después de guardar se abre una única pantalla **RESUMEN DEL PARTIDO**.

El Resumen debe integrar, sin duplicaciones:

- marcador y participantes;
- estadísticas del partido disponibles;
- BRAMU Intelligence;
- notas privadas del partido, si existen, dentro de una tarjeta permanente y reconocible;
- acción discreta para **EDITAR PARTIDO**;
- acción clara para **VOLVER AL INICIO**;
- navegación inferior general de la app.

Se confirmó expresamente que **Editar partido** y **Volver al inicio** pueden convivir con la navegación inferior. No deben eliminarse solo porque el menú general esté visible.

### 3.2. Registro de partido y selección de jugadores

- “Cargar mi partido jugado” y “Registrar partido en vivo” son dos opciones hermanas y deben tener la misma jerarquía visual.
- El título **REGISTRAR PARTIDO** debe estar centrado.
- El sheet debe ser compacto pero no quedar pegado al borde inferior ni parecer una franja mínima. En V02.4 se trabajó con una referencia aproximada de `35dvh`; lo importante es mantener una proporción coherente entre dispositivos, no asignar alturas arbitrarias a cada pantalla.
- Equipo propio debe conservar contexto azul/cyan; rivales, contexto magenta. La diferenciación tiene que acompañar selección, borde y foco sin ensuciar la lectura.
- La selección debe avanzar automáticamente por la secuencia lógica: compañero → Rival 1 → Rival 2.
- Los jugadores ya mostrados como recientes o seleccionados no deben repetirse innecesariamente en listados inferiores.
- La lista de jugadores necesita jerarquía suficiente: nombre legible, estados seleccionados claros y búsqueda útil.
- En **PARTIDO COMPLETO**, las pastillas de los sets debían ganar aproximadamente 15–20 % de tamaño respecto de la primera implementación.

### 3.3. Resultado y pantalla de confirmación

- El marcador no debe aparecer como un dato suelto sin estructura. Debe conservar la lógica visual de un tablero: equipos diferenciados, sets comparables y resultado legible de un vistazo.
- Fecha y hora deben tener la misma jerarquía tipográfica.
- El lugar es opcional y debe poder modificarse antes de guardar.
- El bloque de notas privadas debe ser parte de su propia tarjeta; el título no debe quedar flotando por fuera.
- Las notas son opcionales y nunca deben bloquear el guardado.

### 3.4. Último partido en Home

Esta tarjeta debe tener más jerarquía que las tarjetas secundarias. Las decisiones visuales confirmadas en la ronda fueron:

- algo más de altura;
- fondo `Surface 3`;
- borde completo lima de 1 px;
- eliminación del antiguo acento vertical verde del lateral;
- resultado como dato principal, con referencia de 44 px, `line-height: 1` y `letter-spacing: 0.02em`;
- punto separador entre sets en blanco, aproximadamente `0.75em` y peso 900;
- conservar el guion deportivo/en dash para separar games, pero renderizado como elemento independiente, más liviano, aproximadamente `0.65em` y peso 500;
- participantes en dos líneas: pareja propia y, debajo, “vs” más pareja rival;
- encabezado superior compacto; el cierre V02.9.3 redujo su separación inferior a 3 px.

El usuario prefirió visualmente la barra `/` durante una prueba, pero aceptó conservar el guion por convención deportiva. Es una decisión revisable, no una autorización para cambiarlo sin una nueva prueba.

El cierre visual definitivo de V02 agregó dos reglas para Historial y tarjetas relacionadas:

- el resultado es el protagonista;
- los nombres de jugadores se muestran en color neutral, sin colorear ganador ni pareja propia.

### 3.5. Actividad y Efectividad

El objetivo conceptual de **Actividad** es responder dos preguntas: cuánto está jugando la persona en comparación con períodos recientes y qué proporción de esos partidos ganó o perdió.

La representación acordada fue:

- cuatro barras ordenadas del período más antiguo al actual;
- altura total relativa al volumen de partidos del período;
- segmento lima para victorias;
- segmento oscuro pero visible para derrotas;
- estado vacío claramente distinto;
- leyenda mínima que permita comprender los colores.

La primera corrección que convirtió toda la actividad a cyan fue considerada incorrecta. La visualización apilada lima + oscuro fue la corrección aceptada.

La definición temporal cambió después de esta charla: V02.7 llevó Actividad a **semanas calendario** y Efectividad a **histórico total**. Por eso, la referencia inicial a “últimos 30 días” no debe recuperarse como regla vigente.

### 3.6. Nivel BRAMU en Home

Para la representación visual del decimal dentro de un nivel entero se definió:

- 6.0 = 0 % del tramo;
- 6.3 = 30 %;
- 6.9 = 90 %;
- 7.0 = reinicio en 0 % del nuevo tramo.

La pastilla de variación debe acompañar la posición actual de la barra. Esto fue una solución visual para evitar que un 6.2 pareciera representar el 62 % de toda una escala.

Esta regla **no define el algoritmo de Nivel BRAMU** ni su calibración. Desde V03.0 existe una capa de identidad/calibración posterior; para cualquier modificación actual hay que consultar la documentación de V03.

### 3.7. Historial y accesos desde Home

- La jerarquía principal del Historial es **Todos / Mis partidos / Observados**. La modalidad de carga es un filtro secundario y no debe competir como otra fila equivalente de navegación.
- Un partido propio debe indicar claramente **Victoria** o **Derrota**; no debe obligar a inferirlo únicamente por el resultado o por un color.
- El orden y los cálculos deben basarse en la fecha real del partido, no en cuándo se cargó el registro.
- En el cierre V02.9.3, el resultado del Historial quedó en 30 px/800 y los participantes en 13 px/500, con nombres neutrales.
- La navegación inferior debe mantenerse en Resumen y en las pantallas derivadas de compañeros/rivales.

Destinos conceptuales de las tarjetas de Home:

| Tarjeta | Destino esperado |
|---|---|
| Racha actual | Historial filtrado a la racha o al conjunto pertinente. |
| Efectividad | Vista de partidos que expliquen el cálculo según la ventana vigente. |
| Mejor compañero | Listado/ranking de compañeros con partidos, victorias, derrotas y efectividad. |
| Rival más enfrentado | Listado equivalente de rivales. |
| Partidos totales | Sin navegación obligatoria. |
| Actividad | Quedó sin destino definido. |

Estos destinos se implementaron o evolucionaron en distintas rondas; deben verificarse contra V03.4.6 antes de tocar el producto actual.

### 3.8. Identidad y navegación

- Durante V02 se usó temporalmente “Seba” y `@seba`, con avatar genérico, para reservar espacio y probar composición.
- El logo de Home no debe comportarse como acceso a cargar un partido.
- El pie “BRAMU Lab · Concepto y diseño…” pertenece al Home y no debía quedar aislado en la pantalla de carga.
- La navegación inferior es una estructura global y no debe desaparecer al entrar a compañeros, rivales o al Resumen del partido, salvo que una pantalla realmente modal lo justifique.

### 3.9. Jerarquía de acciones y color

- Botón lima relleno: acción primaria.
- Botón secundario o contorno: acción de menor prioridad.
- El contorno verde puede funcionar en filtros o chips, pero no debe reemplazar sistemáticamente al CTA principal.
- El cyan puede aportar una jerarquía secundaria y contexto, pero no debe introducirse como acento competitivo sin una función clara.
- Las pantallas oscuras deben mantener contraste suficiente; fecha/hora y metadatos importantes no pueden perderse en gris excesivamente apagado.

## 4. Decisiones técnicas y reglas de datos recuperables

Estas referencias corresponden a la implementación V02 y sirven para diagnóstico histórico. Los nombres exactos pueden haber cambiado en V03.

- Los cálculos y listados temporales deben usar `playedAt` o fecha real de juego, no `createdAt` ni el orden de carga.
- Deben excluirse partidos futuros.
- Antes de computar métricas del jugador, la colección se filtraba con `PH.filterMatchesForPlayer`; las funciones posteriores asumían una lista ya filtrada.
- `computeEffectiveness30d` calculaba victorias sobre partidos propios decididos dentro de la ventana y desde la perspectiva del jugador actual, incluso cuando figuraba como Equipo B; excluía observados y partidos fuera de rango. Esta función es referencia histórica porque V02.7 cambió la métrica visible a efectividad histórica total.
- V02.4 incorporó ayudas puras como `PH.computeActivityBarSegments` y `PH.levelProgressPct` para separar cálculo de render.
- Se eliminó el `setTimeout` que finalizaba automáticamente la carga al cerrar el último set; la pausa explícita pasó a ser parte del flujo.
- Último partido recibió un constructor propio (`buildLastMatchScoreHTML`) para ajustar su tipografía sin alterar la línea de resultado compartida por Historial/Confirmación.
- El control nativo de hora producía formatos dependientes de la configuración regional. Se reemplazó por entrada de texto en 24 horas con máscara y normalización (`maskManualTimeInput`, `normalizeManualTimeOnBlur`).
- Al cerrar una versión, el proceso usado incluía actualización coherente de `Store.VERSION`, `version.json` y `sw.js`/`CACHE_NAME`, ejecución de tests, commit/tag, publicación y un Informe de implementación.

## 5. Problemas detectados y resolución adoptada

| Problema | Resolución acordada o implementada |
|---|---|
| Resumen y Análisis repetían información y generaban un flujo fragmentado. | Unificar la salida en un solo Resumen posterior al guardado; conservar una confirmación previa con función distinta. |
| La carga avanzaba sola después del set decisivo y evitaba corregir fecha/hora. | Quitar el avance automático y exigir CONTINUAR. |
| El selector obligaba a volver y tocar cada rol, y repetía jugadores. | Autoavance compañero → Rival 1 → Rival 2 y limpieza de duplicaciones. |
| Equipo propio y rivales se mezclaban visualmente. | Contexto azul/cyan para Equipo A y magenta para Equipo B. |
| El sheet Registrar partido era demasiado bajo y las dos opciones tenían distinta jerarquía. | Sheet compacto coherente y opciones hermanas equivalentes. |
| Fecha y hora se veían desparejas; el input nativo dependía del locale. | Misma jerarquía visual y entrada normalizada en 24 horas. |
| Las notas parecían un título suelto y podían bloquear el guardado. | Tarjeta propia, contenido opcional y guardado no bloqueante. |
| Actividad no reflejaba semanas/derrotas; una corrección la volvió totalmente cyan. | Barras apiladas con victorias lima, derrotas oscuras visibles y períodos comparables. Luego V02.7 fijó semanas calendario. |
| La barra de Nivel no representaba correctamente el decimal. | Progreso relativo dentro del entero actual, con reinicio al pasar al entero siguiente. |
| Guion y separadores del marcador se veían pesados. | Separar guion y punto en spans con escala/peso propios; conservar guion deportivo. |
| Último partido no tenía jerarquía suficiente. | Más altura, Surface 3, borde completo lima, marcador mayor y participantes en dos líneas. |
| Historial obligaba a deducir resultado y coloreaba demasiado los nombres. | Badge Victoria/Derrota y, en el cierre V02.9.3, nombres neutrales con marcador dominante. |
| Se calculaban estados con fecha de carga en lugar de fecha del partido. | Usar fecha real (`playedAt`) y excluir futuros. |
| El logo de Home podía abrir carga de partido. | Eliminar esa navegación. |
| Las pantallas de compañeros/rivales perdían la navegación inferior. | Mantener el menú global. |

## 6. Pendientes que quedaron abiertos

Estos puntos no deben darse por resueltos solo por aparecer aquí. Hay que contrastarlos con la versión actual y el backlog antes de incorporarlos a un consolidado nuevo.

- **Tu momento:** se detectaron frases que no coincidían con la secuencia real de resultados. Quedó pendiente revisar exactitud, reglas y redacción.
- **Drill-down de Actividad:** no se definió qué pantalla debe abrir ni qué análisis aporta.
- **Último partido:** quedó abierta una revisión futura de tipografía y separador del score. El guion fue la decisión adoptada, pero no convenció por completo.
- **Fuente tipográfica general:** hubo dudas sobre si la tipografía existente ayudaba al marcador; no se eligió reemplazo.
- **Datos reales de Actividad/Efectividad:** aunque se agregaron cálculos y tests, el chat pidió seguir validando la lectura con historiales reales y fechas antiguas.
- **Modos de partido en vivo:** se señalaron inconsistencias de navegación, presencia del texto “beta” y ubicación de “Cargar partido jugado”. Versiones posteriores pueden haberlas resuelto; revisar antes de reabrir.
- **Jerarquía de tarjetas inferiores de Home:** durante la ronda se percibió monotonía visual. V02.8 y versiones posteriores hicieron una auditoría y pulido; cualquier pendiente debe evaluarse sobre V03.4.6, no sobre las capturas antiguas.

## 7. Ideas futuras todavía útiles

Las siguientes ideas conservaron valor conceptual, pero no quedaron autorizadas para implementación directa desde este chat:

- profundizar las estadísticas de compañeros y rivales con partidos, victorias, derrotas y efectividad;
- definir un destino analítico útil para Actividad;
- seguir refinando la notación deportiva del marcador mediante prueba visual real;
- revisar “Tu momento” como módulo explicativo basado en datos verificables;
- mantener pestañas principales por relación con el partido (Todos/Mis/Observados) y tratar la modalidad como filtro secundario;
- avanzar hacia validación social de partidos, cuentas, ranking y notificaciones solo mediante consolidados específicos.

El documento vivo para ideas futuras es `BRAMUlab_Backlog.md`. Nada contenido únicamente en el backlog está autorizado para construirse sin pasar antes por un consolidado de versión.

## 8. OBSOLETAS, REEMPLAZADAS O RECHAZADAS

### OBSOLETA — V02.1–V02.4 como base actual

Fueron hitos importantes de este chat, pero ya no representan el estado vigente. V02 cerró en V02.9.3 y el producto evolucionó hasta V03.4.6.

### OBSOLETA — pantalla separada de Análisis

La propuesta de mantener Resumen y Análisis como pantallas distintas fue descartada por duplicación. La salida aceptada es un único Resumen posterior al guardado.

### OBSOLETA — avance automático tras el último set

Se reemplazó por una pausa explícita en PARTIDO COMPLETO y la acción CONTINUAR.

### OBSOLETA — Actividad totalmente cyan

Fue una interpretación incorrecta. Se reemplazó por segmentos lima y oscuros; V02.7 además fijó semanas calendario.

### OBSOLETA — Actividad y Efectividad ambas limitadas a 30 días

Fue la primera definición. V02.7 dejó Actividad por semanas calendario y Efectividad histórica total.

### OBSOLETA — identidad definitiva `Seba` / `@seba` con avatar genérico

Fue contenido de relleno para V02. V03 incorporó identidad/cuenta y Perfil; no debe restaurarse como modelo definitivo.

### OBSOLETA — datos exclusivamente locales como dirección de producto

La frase “los datos viven en este dispositivo” describía la etapa local de V02. V03 incorporó identidad y luego arquitectura posterior; cualquier decisión actual debe basarse en la documentación vigente, no en esa limitación histórica.

### OBSOLETA — Ranking como pantalla vacía o placeholder

En V02 era una reserva visual. Versiones V03 posteriores desarrollaron identidad, jugadores, grupos y ranking; consultar la versión actual.

### OBSOLETA — hora nativa dependiente del locale

Se sustituyó por un campo en 24 horas con máscara/normalización.

### OBSOLETA — una carpeta por cada subversión V02.x

Fue una organización propuesta y corregida. Todos los documentos V02.x viven en `Versiones/BRAMUlab_V02/`. Solo una versión mayor crea carpeta nueva, por ejemplo `BRAMUlab_V03/`.

### NO ADOPTADA — barra `/` como separador de games

Se probó y al usuario le resultó visualmente atractiva, pero la decisión final de esta ronda fue mantener el guion deportivo con tratamiento tipográfico separado.

### RECHAZADA — quitar Editar partido y Volver al inicio por existir bottom nav

Se decidió conservar ambas acciones en el Resumen.

### RECHAZADA — botón principal de contorno verde

El CTA principal debe ser lima relleno; el contorno queda para acciones secundarias, filtros o chips.

### OBSOLETA — especificación visual temprana del Historial

Las primeras pruebas con nombres coloreados y jerarquías mixtas fueron reemplazadas por V02.9.3: resultado dominante, participantes neutrales y encabezado compacto.

### LEGACY — nombres de funciones y selectores V02

`computeEffectiveness30d`, `computeActivityBarSegments`, `levelProgressPct`, `buildLastMatchScoreHTML` y las máscaras de hora son pistas útiles para recuperar el origen de una solución, no contratos obligatorios para el código V03.

## 9. Método de trabajo acordado

- Dividir la implementación en rondas pequeñas de aproximadamente 3–4 cambios relacionados.
- Preparar un consolidado claro antes de autorizar una nueva ronda.
- Exigir un Informe que registre qué se implementó, pruebas, versión, commit/tag y publicación.
- Verificar afirmaciones importantes de forma puntual; no repetir una auditoría exhaustiva en cada microcambio.
- Usar inspección de DOM/estilos y tests cuando alcancen; reservar capturas para cambios visuales grandes o dudosos.
- Como referencia operativa, se acordó evitar recorridos “pantalla por pantalla con captura” cuando no aportaran evidencia adicional.
- Mantener el quartet de versión/cache sincronizado y hacer una suite completa al cierre de la ronda; agregar tests focalizados cuando haya lógica pura nueva.
- Guardar consolidado e Informe dentro de la carpeta de la versión mayor correspondiente.

## 10. Referencias documentales vigentes

### Punto de entrada

- `/Otros Trabajos/BRAMUlab/BRAMUlab/docs/BRAMUlab/README.md` — índice y versión funcional vigente.
- `/Otros Trabajos/BRAMUlab/BRAMUlab/docs/BRAMUlab/BRAMUlab_Backlog.md` — único repositorio vivo de ideas futuras no autorizadas.

### Cierre de V02

- `Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Consolidado.md`
- `Versiones/BRAMUlab_V02/BRAMUlab_V02.3_Informe.md`
- `Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Consolidado.md`
- `Versiones/BRAMUlab_V02/BRAMUlab_V02.4_Informe.md`
- `Versiones/BRAMUlab_V02/BRAMUlab_V02.8_Auditoria_Visual_CSS.md`
- `Versiones/BRAMUlab_V02/BRAMUlab_V02.9.3_Informe.md` — **último estado real de V02**.

### Evolución posterior

- `Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Consolidado.md` — identidad del jugador, cuenta local, Player Card, Perfil y calibración inicial.
- `Versiones/BRAMUlab_V03/BRAMUlab_V03.0_Informe.md`
- `Versiones/BRAMUlab_V03/BRAMUlab_V03.4.6_Consolidado.md`
- `Versiones/BRAMUlab_V03/BRAMUlab_V03.4.6_Informe.md` — **estado funcional vigente al cerrar este backup**.

## 11. Regla para recuperar información desde este backup

Usar este documento para recordar la intención de producto, los criterios visuales y las razones detrás de decisiones de V02. Si se desea implementar algo hoy:

1. confirmar la versión vigente en `README.md`;
2. revisar el Informe de esa versión;
3. consultar V02.9.3 únicamente para la base visual que V03 no haya reemplazado;
4. revisar `BRAMUlab_Backlog.md` para evitar duplicaciones o autorizar por error una idea futura;
5. crear un consolidado nuevo antes de modificar el producto.

---

**Cierre:** este backup preserva los criterios útiles de la conversación y separa explícitamente las decisiones superadas. El chat original puede archivarse o borrarse sin usarlo como fuente operativa primaria.
