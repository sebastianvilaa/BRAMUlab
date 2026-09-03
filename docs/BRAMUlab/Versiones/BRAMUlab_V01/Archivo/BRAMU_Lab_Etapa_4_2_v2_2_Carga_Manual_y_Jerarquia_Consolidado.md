# BRAMU Lab — Etapa 4.2

## v2.2 · Carga manual centrada en el marcador y nueva jerarquía visual

**Estado:** especificación lista para implementación.
**Base obligatoria:** BRAMU Lab v2.1, commit `e5b28700f947e5a7d62c6ff757d9cc64374d8169`, tag `v2.1`.
**Aplicación autorizada:** `bramulab/` únicamente.
**Aplicación congelada:** `bramulab-partidos/` v14. No tocar ningún archivo, versión, caché, manifest ni service worker de esa aplicación.

## 1. Objetivo

Rehacer la experiencia de **Cargar mi partido jugado** para que deje de sentirse como un formulario administrativo y se convierta en una carga deportiva, clara y rápida, donde el resultado sea el protagonista.

La ronda debe resolver conjuntamente:

1. Una entrada más clara desde el botón `+`.
2. Un marcador compacto que se completa set por set.
3. Carga directa mediante números grandes y teclado numérico propio de BRAMU.
4. Validación contextual que impida resultados imposibles antes de confirmarlos.
5. Guardado seguro del partido antes de pedir datos secundarios.
6. Edición posterior de fecha, hora y lugar.
7. Notas privadas opcionales con sensaciones en caliente.
8. Una jerarquía visual más deportiva, inspirada en la claridad de lectura de la tarjeta “Last Match” de VIBERO, sin copiar sus colores ni su interfaz.

No es todavía el rediseño visual integral de toda BRAMU Lab. Es una intervención completa y coherente sobre el flujo de carga manual y las superficies directamente relacionadas.

## 2. Principio de producto

El usuario normalmente carga el partido inmediatamente después de jugar. La aplicación debe priorizar lo que necesita en ese momento:

1. Quiénes jugaron.
2. Cómo terminó.
3. Guardar el partido sin riesgo de pérdida.
4. Solo después, enriquecerlo opcionalmente con contexto y sensaciones.

Fecha, hora, lugar y notas no deben competir visualmente con el resultado ni bloquear el guardado.

## 3. Jerarquía visual obligatoria

La referencia de VIBERO se usa únicamente por su manejo de niveles de lectura:

- **Primer nivel:** resultado del partido o del set, con números grandes y contraste alto.
- **Segundo nivel:** estado del partido, por ejemplo Set 3, Set decisivo, Victoria o Partido guardado.
- **Tercer nivel:** nombres de los equipos o jugadores.
- **Cuarto nivel:** formato, sistema de puntuación, fecha, hora y lugar.
- **Quinto nivel:** acciones secundarias, edición y ayuda.

No copiar colores, marca, tamaños exactos ni composición literal de VIBERO.

Reglas visuales:

- Fondo oscuro y lenguaje BRAMU actual.
- Lima como acento de acción, foco y estado positivo; no usarlo en todos los elementos.
- El resultado debe ser el elemento visualmente dominante.
- Evitar una colección de tarjetas iguales compitiendo entre sí.
- Evitar que todos los títulos tengan el mismo peso, tamaño y contraste.
- Usar el espacio vacío para separar niveles, no agregar cajas por costumbre.
- Datos contextuales pequeños pero legibles; nunca por debajo de 11 px efectivos.
- Mantener coherencia con los pesos tipográficos y la identidad de BRAMU, sin convertir toda la pantalla en mayúsculas.

## 4. Entrada desde el botón `+`

Al tocar `+`, conservar una hoja inferior, pero corregir su jerarquía:

- Debe sentirse deliberada y no como una franja demasiado baja.
- En móvil puede ocupar aproximadamente entre 30% y 40% de la pantalla según contenido.
- Título: `REGISTRAR PARTIDO`.
- Acción principal: `Cargar mi partido jugado`.
- Acción secundaria: `Registrar partido en vivo`.
- Ambas deben leerse inequívocamente como botones.
- Textos centrados si se usan botones de ancho completo.
- Mantener cierre por cruz, toque exterior y gesto hacia abajo.
- En tablet y escritorio conservar el ancho útil de 768 px ya corregido en v2.1.

No cambiar las opciones disponibles ni el flujo de registro en vivo.

## 5. Selección de jugadores

Los datos actuales son correctos y deben conservarse: jugador actual, compañero y dos rivales.

Esta ronda no necesita inventar otro modelo de jugadores, pero sí debe mejorar su lectura:

- Mostrar claramente Equipo A / Tu equipo y Equipo B / Rivales.
- Mantener el acento lima para el equipo del jugador y azul para los rivales, sin que el color sea la única diferencia.
- Los nombres elegidos deben verse como contenido confirmado, no como campos de formulario todavía activos.
- El selector de jugador debe conservar ancho completo en móvil y hasta 768 px en tablet/escritorio.
- Mantener búsqueda y recientes.
- Evitar una lista visualmente encerrada dentro de otra lista si no aporta claridad.

No bloquear esta etapa intentando rediseñar todo el selector. Priorizar que sea claro, tocable y consistente.

## 6. Pantalla principal: marcador y carga de sets

### 6.1. Cabecera compacta

Mostrar arriba, con menor jerarquía que el resultado:

- Estado contextual: `Set 1`, `Set 2`, `Set decisivo` o `Partido completo`.
- Formato y puntuación: por ejemplo `Clásico · Punto de oro`.
- Acción Volver.
- Menú o edición secundaria solo si es necesaria.

No ocupar una tarjeta grande para estos datos.

### 6.2. Marcador acumulado

Debajo de la cabecera, mostrar un marcador compacto:

- Una fila por equipo.
- Nombres a la izquierda.
- Columnas de sets a la derecha.
- Los sets ya terminados permanecen visibles.
- El set actual se distingue con acento y actualiza su valor mientras el usuario carga.
- El set ganado se diferencia por contraste, no mediante ruido decorativo.
- Tocar un resultado ya cargado permite editar ese set sin borrar los posteriores silenciosamente.

Si editar un set anterior cambia la necesidad de un tercer set o el ganador, recalcular el partido de forma segura y pedir confirmación antes de descartar datos incompatibles.

### 6.3. Resultado actual protagonista

En el centro mostrar:

- `RESULTADO DEL SET N`.
- Un número grande para Equipo A.
- Separador central.
- Un número grande para Equipo B.
- Nombres abreviados debajo de cada lado.

Ambos números son controles tocables. El lado activo debe quedar inequívocamente marcado.

Comportamiento:

1. El usuario toca el número izquierdo o la pantalla lo deja activo por defecto.
2. Ingresa el valor con el teclado BRAMU.
3. El foco pasa al otro equipo.
4. Ingresa el segundo valor.
5. Si el resultado es válido, se habilita `Continuar`.
6. `Continuar` confirma el set, actualiza el marcador superior y abre el set siguiente o cierra el partido.

No usar una lista fija de cuatro resultados posibles: un set admite más combinaciones y el patrón no escala.

## 7. Teclado numérico BRAMU

Construir un teclado numérico propio, inspirado en el comportamiento de ingreso de monto de Mercado Pago, no en sus colores.

### 7.1. Distribución

- Debe aparecer desde abajo al activar uno de los números.
- Puede ocupar aproximadamente 35%–42% de la altura útil en móvil.
- La zona superior se compacta o desplaza para conservar visibles el resultado, el marcador y `Continuar`.
- `Continuar` queda inmediatamente arriba del teclado.
- Teclas grandes, regulares y fáciles de pulsar con una mano.
- Incluir números, borrar y cambiar de lado si fuera necesario.
- Permitir ocultarlo mediante `Listo` o gesto coherente.
- No abrir simultáneamente el teclado nativo del sistema.

### 7.2. Validación preventiva

El teclado debe impedir errores, no limitarse a informarlos después.

- Después del primer valor, habilitar únicamente valores capaces de formar un resultado válido para el formato activo.
- Deshabilitar visual y funcionalmente las opciones imposibles.
- Si el usuario vuelve y cambia el primer valor, recalcular inmediatamente las opciones del segundo.
- `Continuar` permanece deshabilitado mientras el par no cierre un set válido.
- Mostrar confirmación breve `Resultado válido` cuando corresponda.
- Mantener una vía clara para borrar o corregir.

La validez no debe hardcodearse de forma aislada en la interfaz. Reutilizar o centralizar las reglas canónicas existentes según:

- Clásico.
- Americano.
- Punto de Oro, Con ventaja y Star Point cuando afecten el cierre.
- Tie-breaks y cualquier regla ya soportada por la carga manual.

El teclado puede presentar 0–7 en los casos habituales, pero la lógica no debe impedir ampliar valores si un formato existente o futuro lo requiere.

## 8. Guardado en dos momentos

### 8.1. Momento 1: resultado

Cuando el partido queda definido y el usuario confirma:

- Guardar inmediatamente el partido en el historial.
- Usar como fecha y hora predeterminadas el momento actual.
- Dejar lugar vacío si no fue indicado.
- No exigir notas.
- La transición debe comunicar `PARTIDO GUARDADO`.

Desde este punto, cerrar la app, volver al Home o perder la sesión visual no puede hacer perder el partido.

### 8.2. Momento 2: enriquecimiento opcional

Después de guardar, mostrar una pantalla liviana con:

- Resultado final resumido.
- Estado `Partido guardado`.
- `Ahora · Hoy · [hora]` y lugar, con acción secundaria `Modificar`.
- Campo opcional de sensaciones privadas.
- Acción principal `Ver resumen`.
- Acción secundaria para volver al inicio si sigue siendo necesaria.

No volver a mostrar un botón `Guardar partido`, porque el partido ya fue guardado. Los cambios posteriores deben autoguardarse o confirmarse dentro de su propia edición sin poner en duda el estado del partido.

## 9. Fecha, hora y lugar

- Dar por sentado que la carga sucede al terminar de jugar.
- Fecha y hora iniciales: ahora.
- Lugar: opcional, vacío o última opción válida solo si esa reutilización es explícita y segura.
- Mostrar estos datos como información secundaria, no como campos abiertos en la pantalla principal.
- `Modificar` abre una hoja o panel compacto para editar fecha, hora y lugar.
- Mantener la posibilidad real de cargar partidos anteriores.
- Al editar `playedAt`, recalcular todas las métricas dependientes: actividad, efectividad, orden del historial y evolución de nivel.
- Conservar la regla honesta de v2.1: un partido con fecha/hora futura no cuenta en las ventanas de actividad hasta que ocurra.

## 10. Sensaciones privadas del partido

Agregar un campo opcional llamado `SENSACIONES DEL PARTIDO` o `¿CÓMO TE SENTISTE?` en la pantalla posterior al guardado.

Microcopy sugerido:

> Ej.: Me sentí bien con el globo, pero llegué tarde a varias voleas.

Reglas:

- Texto libre, opcional.
- Indicar `Solo vos` con un icono de candado.
- No bloquear `Ver resumen`.
- Guardar asociado al partido correspondiente.
- Autoguardar al salir del campo o usar una confirmación propia discreta.
- Poder consultar y editar la nota desde el detalle del partido.
- No mostrar la nota en tarjetas públicas, listas, perfiles de otros jugadores, exportaciones o vistas compartidas.
- No incorporarla todavía al análisis automático de BRAMU Intelligence.
- No crear todavía flujo para coach, profesor o compartir.

Nombre técnico sugerido: un único campo opcional como `privateNote` dentro del registro del partido. La implementación debe tolerar partidos anteriores donde el campo no exista.

Importante: en la beta actual los datos viven localmente en el dispositivo. No prometer cifrado ni privacidad de servidor inexistente. La interfaz debe expresar que la nota es personal dentro del alcance actual de la app.

## 11. Tarjeta Último partido del Home

Actualizar su jerarquía para que acompañe el nuevo lenguaje, usando la referencia VIBERO solo como criterio de lectura:

- Resultado claramente protagonista y de mayor tamaño.
- Estado `Victoria` o `Derrota` pequeño, cercano al título.
- Fecha y lugar pequeños y alineados como metadatos.
- Pareja y rivales en un nivel secundario.
- Indicadores de forma reciente más pequeños; no necesitan llevar letras dentro si la forma y el color ya son comprensibles con alternativa accesible.
- Toda la tarjeta abre el detalle.
- Mantener una señal direccional discreta.

No convertir esta modificación en el rediseño de todas las tarjetas del Home. Solo asegurar que Último partido ya exprese la jerarquía que se usará como referencia para el sistema futuro.

## 12. Resumen posterior

`Ver resumen` debe abrir el resumen actual del partido ya guardado.

En esta ronda:

- Conservar cálculos y datos existentes.
- Confirmar que el resultado editado coincide con el resumen.
- Mantener eliminado el control Compartir visible.
- No rediseñar todavía todo BRAMU Intelligence.
- La nota privada no debe mezclarse automáticamente con el texto del análisis.

## 13. Persistencia, edición y compatibilidad

- Mantener claves y datos existentes en localStorage.
- No borrar ni migrar destructivamente partidos actuales.
- Los registros antiguos sin `privateNote` deben funcionar sin cambios visibles.
- Guardar el partido antes de la pantalla opcional exige que la navegación posterior no cree duplicados.
- Volver desde la pantalla posterior debe abrir el mismo partido guardado, no crear uno nuevo.
- Editar resultado, fecha, hora, lugar o nota debe actualizar el registro existente por identificador estable.
- Home, Historial, Perfil y Evolución deben recalcularse después de cambios relevantes.
- No compartir datos con `bramulab-partidos/`.

## 14. Movimiento y microinteracciones

Usar animación sutil y funcional:

- El teclado sube desde abajo y el contenido se reacomoda sin salto brusco.
- El foco pasa de un equipo al otro con transición corta.
- Al confirmar un set, el valor se integra al marcador superior.
- Al guardar el partido, usar una confirmación breve inspirada en el rebote/pique ya definido para BRAMU, sin animación decorativa excesiva.
- Respetar `prefers-reduced-motion`.
- Evitar loops permanentes salvo un pulso mínimo de foco o estado activo cuando sea necesario.

## 15. Responsive

### Mobile

- Diseñar y probar primero en 390×844 y 402×874.
- Teclado y controles cómodos para una mano.
- `Continuar` siempre visible arriba del teclado.
- No producir scroll interno mientras se carga un set.

### Tablet y escritorio

- Mantener shell útil de hasta 768 px.
- El teclado puede conservar el patrón numérico dentro del ancho del shell; no debe estirarse a todo el viewport.
- Probar con mouse además de táctil simulado.
- La funcionalidad no puede depender de gestos exclusivamente táctiles.

## 16. Pruebas mínimas obligatorias

### Funciones puras

- Resultados válidos e inválidos por cada formato soportado.
- Valores habilitados después de ingresar el primer lado.
- Cambio del primer valor recalcula el segundo.
- Cierre en dos sets.
- Tercer set decisivo.
- Americano y tie-break según reglas actuales.
- Edición de un set anterior.
- Compatibilidad con partidos sin `privateNote`.

### Integración

- Abrir `+` → Cargar mi partido jugado.
- Elegir cuatro jugadores.
- Cargar un partido 6–2, 4–6, 6–4 solo con el teclado BRAMU.
- Ver el marcador actualizarse mientras se escribe.
- Ver teclas imposibles deshabilitadas.
- Borrar y corregir ambos lados.
- Confirmar que `Continuar` no se habilita con un resultado inválido.
- Guardar y cerrar inmediatamente: el partido debe existir al volver.
- Modificar fecha, hora y lugar después de guardado.
- Agregar, editar y borrar una nota privada.
- Abrir la nota desde el detalle del partido.
- Confirmar que la nota no aparece en Home, lista de Historial, resumen compartible ni vistas de otros jugadores.
- `Ver resumen` abre el partido correcto y no genera duplicados.
- Home actualiza Último partido, métricas y evolución.
- Edición posterior actualiza las métricas dependientes.
- Registro en vivo Game por game y Punto por punto sin regresiones.
- Pruebas con mouse y viewport móvil.
- Mobile 390×844 y 402×874; tablet 834×1112; escritorio 1366×768.
- Suite completa en verde y consola sin errores propios.
- Actualización PWA desde v2.1 a v2.2 sin pérdida de historial.

## 17. Fuera de alcance

- Rediseño integral de todas las pantallas y tarjetas.
- Cambio del algoritmo simulado de Nivel BRAMU.
- Base de datos, cuentas y sincronización.
- Ranking oficial.
- Amigos, grupos y validación por rivales.
- Análisis automático de las notas.
- Compartir notas con coach o profesor.
- Dynamic Island, Live Activities y pantalla bloqueada.
- Cambios funcionales en el marcador en vivo.
- Cualquier cambio en BRAMU Lab Partidos v14.

## 18. Criterios de aceptación

1. La carga manual deja de presentarse como un formulario plano y el resultado pasa a ser protagonista.
2. El marcador superior refleja en tiempo real los sets cargados.
3. El teclado BRAMU evita combinaciones imposibles antes de confirmar.
4. `Continuar` permanece visible inmediatamente arriba del teclado.
5. El partido se guarda antes de pedir fecha, lugar o notas adicionales.
6. Cerrar la app después del guardado no pierde el partido.
7. Fecha, hora y lugar parten de `Ahora` y pueden modificarse después.
8. La nota privada es opcional, editable y no aparece fuera del detalle personal.
9. `Ver resumen` sustituye a un segundo `Guardar partido`.
10. La tarjeta Último partido muestra resultado, estado, participantes y metadatos con jerarquía inequívoca.
11. Home, Historial, Perfil y Evolución permanecen consistentes después de guardar o editar.
12. No hay regresiones en registro en vivo ni pérdida de datos anteriores.
13. `bramulab-partidos/` permanece intacta.
14. La versión se publica como v2.2 solo después de verificación completa.

## 19. Entrega esperada de Claude

- Leer primero este consolidado y el informe de v2.1 completo.
- Revisar el código actual antes de proponer cambios y señalar en el plan cualquier incompatibilidad real.
- Implementar sobre la base exacta v2.1.
- No pedirle a Sebastián decisiones técnicas menores: documentarlas y elegir la opción más simple, reversible y coherente con esta especificación.
- Si una ambigüedad cambia materialmente la experiencia, detener solo ese punto y dejar la pregunta claramente formulada en el informe.
- Ejecutar pruebas automáticas y manuales en los viewports indicados, incluyendo uso con mouse.
- Publicar únicamente cuando todo esté verde.
- Commit y tag v2.2.
- Crear `BRAMU_Lab_Etapa_4_2_v2_2_Carga_Manual_y_Jerarquia_Informe.md` dentro de `docs/bramulab/informes/`.
- Informar archivos modificados, modelo de persistencia de la nota, reglas de validación reutilizadas, pruebas, commit, tag, deploy y URLs.
- Confirmar explícitamente que `bramulab-partidos/` no fue tocada.
- Dejar el repositorio limpio al finalizar.

