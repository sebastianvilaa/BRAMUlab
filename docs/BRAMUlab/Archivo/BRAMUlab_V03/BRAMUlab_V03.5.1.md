# BRAMUlab V03.5.1 — Refinamiento UX de Ranking BRAMU

**Estado:** LISTA PARA IMPLEMENTAR Y VALIDAR VISUALMENTE.  
**Base:** BRAMUlab V03.5 publicada.  
**Fuente funcional general:** `docs/BRAMUlab/Ranking_BRAMU.md`.  
**Documento operativo anterior:** `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.5.md`.  
**Objetivo:** refinar la experiencia del Ranking a partir de la primera prueba real de uso, reduciendo competencia visual, eliminando redundancias y acercando la pantalla al lenguaje visual actual de BRAMUlab, sin tocar la fórmula de Nivel BRAMU ni introducir backend real.

---

## 1. Contexto de esta iteración

V03.5 confirmó que la lógica general del Ranking funciona y que la pantalla resulta atractiva, pero la primera prueba publicada mostró un problema de jerarquía: varias funciones correctas compiten visualmente como si tuvieran el mismo peso.

Los principales hallazgos fueron:

- `General` y `Por Nivel` aparecen como dos modos equivalentes, cuando `Por Nivel` es en realidad un filtro del mismo Ranking.
- `Tu posición`, `Verme en la clasificación`, `Cerca tuyo` y `Clasificación` resuelven parcialmente la misma pregunta y generan repetición.
- búsqueda y ayuda ocupan espacio como bloques de contenido aunque sean utilidades secundarias.
- el acceso actual `Mis jugadores` es conceptualmente útil, pero el nombre resulta ambiguo porque BRAMU ya usa “jugadores” para personas agregadas manualmente.
- la tarjeta `Tu posición` todavía no habla el lenguaje visual de las piezas fuertes de BRAMU, especialmente `Último partido`.
- las tabs tienen un contraste activo/inactivo algo débil; debe revisarse de forma sistémica y no parchearse solo para Ranking.
- el back desde Mi Perfil, cuando se llega desde Ranking, vuelve a Home en vez de regresar a Ranking.
- el aviso de nueva versión muestra un espaciado excesivo y debe normalizarse como pulido general.

V03.5.1 no busca agregar complejidad sino ordenar mejor lo que ya existe.

---

## 2. Principio rector

La pantalla debe responder con claridad a esta secuencia:

1. ¿En qué universo estoy compitiendo?
2. ¿Qué ranking estoy viendo?
3. ¿Qué nivel quiero filtrar?
4. ¿Dónde estoy yo?
5. ¿Cómo está la clasificación?

La jerarquía visual debe seguir ese orden.

No crear nuevos bloques grandes si la misma función puede resolverse con un control secundario.

---

## 3. Ámbitos del Ranking

Reordenar los ámbitos principales a:

1. Local
2. Provincial
3. País
4. Global
5. Mi red

### 3.1 Estado inicial

El estado inicial de la pantalla pasa a ser **Local**, no Mi red.

La intención es que entrar a Ranking se sienta primero como entrar a una clasificación competitiva real de la zona.

### 3.2 “Mi red” reemplaza “Mis jugadores”

El nombre operativo para esta iteración será:

`Mi red`

Razón:

- no son “mis jugadores” agregados manualmente;
- incluye rivales y compañeros con los que el usuario compartió partidos computables;
- cada usuario tiene una red diferente;
- funciona como vista personal, no como ámbito territorial.

El nombre puede reevaluarse después de verlo publicado, pero V03.5.1 debe usar `Mi red`.

### 3.3 Ventana temporal de Mi red

`Mi red` debe incluir únicamente jugadores con los que el usuario haya compartido al menos un partido computable en los últimos **180 días**.

Objetivo:

- evitar una agenda histórica infinita;
- priorizar relaciones de juego actuales;
- impedir que alguien con quien se jugó una sola vez hace años siga ocupando espacio;
- mantener automáticamente a los jugadores frecuentes.

Si el usuario vuelve a compartir un partido computable con alguien, su presencia se renueva naturalmente.

Los jugadores fuera de los 180 días no se borran del historial ni del sistema; simplemente dejan de formar parte de `Mi red`.

### 3.4 Ocultar jugadores de Mi red

Debe existir una acción personal equivalente a:

`Ocultar de Mi red`

Ocultar:

- NO elimina partidos;
- NO modifica Nivel BRAMU;
- NO modifica Ranking oficial;
- NO afecta al otro jugador;
- NO elimina el perfil;
- solo quita a esa persona de la vista personal `Mi red` del usuario actual.

### 3.5 Restaurar jugadores ocultos

Para evitar que el usuario pierda el control sobre qué ocultó, `Mi red` debe ofrecer una utilidad secundaria:

`Ocultos (N)`

Esta utilidad solo aparece cuando existe al menos un jugador oculto.

Al tocarla debe abrir una vista compacta o bottom sheet con los jugadores ocultos y una acción:

`Volver a mostrar en Mi red`

No mostrar los ocultos mezclados al final de la clasificación normal.

La gestión de ocultos debe sentirse como una preferencia personal, no como parte del Ranking competitivo.

---

## 4. Género del Ranking

Agregar segmentación de Ranking por género:

- Masculino
- Femenino

No mostrar ambos mezclados en una única clasificación oficial.

### 4.1 Selección por defecto

Al entrar, seleccionar automáticamente el género correspondiente al usuario actual.

La razón es simple: el Ranking debe abrir mostrando el universo en el que el usuario puede encontrarse a sí mismo.

### 4.2 UI

No usar nuevas tabs grandes para género.

Resolver mediante un selector desplegable compacto:

`Masculino ▾`

o

`Femenino ▾`

### 4.3 Color

Mantener el lima como color principal de identidad BRAMU.

Usar solo acentos secundarios:

- masculino: azul ya existente en el sistema;
- femenino: magenta de la paleta histórica de BRAMU.

No recolorear toda la pantalla.

### 4.4 Mi red y género

`Mi red` puede contener jugadores masculinos y femeninos.

El selector de género determina qué clasificación de esa red se está viendo en ese momento.

Por defecto se mantiene el género del usuario actual.

Esta decisión se considera válida para prototipo y debe revisarse visualmente después de implementada.

---

## 5. Nivel como filtro, no como modo paralelo

Eliminar la jerarquía actual:

`General | Por Nivel`

No deben seguir apareciendo como dos botones grandes equivalentes.

El Ranking es uno; el nivel es un filtro.

### 5.1 Nuevo control

Usar un desplegable compacto de nivel junto al selector de género.

Estado por defecto:

`Todos los niveles ▾`

Opciones:

- Mi nivel · Nivel X
- Nivel 1
- Nivel 2
- Nivel 3
- Nivel 4
- Nivel 5
- Nivel 6
- Nivel 7
- Nivel 8
- Nivel 9
- Nivel 10

`Mi nivel · Nivel X` debe permitir llegar al propio segmento con un solo toque.

No modificar la lógica de bandas ya existente.

---

## 6. Header de Ranking

Mantener título:

`RANKING BRAMU`

Agregar dos utilidades en el header:

- lupa → Buscar jugador;
- `?` dentro de círculo → Cómo funciona el Ranking.

Referencia conceptual:

`RANKING BRAMU                     [buscar] [?]`

### 6.1 Buscar jugador

Eliminar el buscador como bloque permanente dentro del cuerpo del Ranking.

La lupa abre la búsqueda existente reutilizando la lógica actual.

La búsqueda debe seguir funcionando dentro del universo y filtros seleccionados cuando corresponda.

Mostrar:

- nombre y apellido / display name suficientemente identificable;
- `@usuario`;
- ubicación cuando exista;
- Nivel BRAMU según corresponda.

No crear un buscador completamente nuevo si el actual puede reutilizarse.

### 6.2 Ayuda

Eliminar `Cómo funciona` como bloque al final de una clasificación potencialmente muy larga.

El icono `?` abre el bottom sheet/ayuda existente.

Mantener el contenido funcional actual salvo ajustes menores de copy que surjan de los cambios de UI.

---

## 7. Tarjeta TU POSICIÓN

Rediseñar la tarjeta para acercarla al lenguaje visual de `Último partido` y de las tarjetas fuertes de BRAMU.

### 7.1 Jerarquía visual

`TU POSICIÓN` debe vivir dentro de la tarjeta, no como título externo independiente.

La tarjeta debe incluir:

- posición actual como dato dominante;
- total del universo;
- Nivel BRAMU con jerarquía clara, idealmente hacia el lado derecho siguiendo patrones existentes;
- movimiento semanal;
- ámbito actual;
- filtro de nivel si corresponde;
- género actual cuando aporte contexto.

Debe evaluarse un borde lima fino y el tratamiento visual ya usado en `Último partido`.

No copiar literalmente la tarjeta de Último partido: reutilizar su lenguaje, no su contenido.

### 7.2 No sticky

La tarjeta NO debe quedar fija al hacer scroll.

Al bajar por la clasificación, desaparece naturalmente.

---

## 8. Clasificación principal

Eliminar el bloque independiente:

`CERCA TUYO`

Eliminar también el botón grande:

`VERME EN LA CLASIFICACIÓN`

La clasificación principal pasa a resolver ambas necesidades.

### 8.1 Estado inicial

Al entrar al Ranking:

- primero se ve la tarjeta `Tu posición`;
- inmediatamente debajo comienza la clasificación desde el puesto #1.

Ejemplo conceptual:

`Tu posición`

`#1`
`#2`
`#3`
`#4`
...

No abrir la clasificación centrada en el usuario por defecto.

Esto evita repetir inmediatamente la misma información que ya muestra la tarjeta.

### 8.2 Tocar Tu posición

La tarjeta completa debe ser interactiva.

Al tocarla:

- cargar directamente el bloque necesario si la posición propia no está cargada;
- hacer scroll suave hasta la fila del usuario;
- dejar la fila propia visualmente centrada cuando sea posible;
- mantener el resaltado sobrio ya existente.

Ejemplo:

si el usuario es #525, tocar la tarjeta debe llevar directamente al tramo alrededor de #525 sin obligarlo a cargar los primeros 500 puestos.

### 8.3 Volver al inicio

Cuando el usuario se haya alejado suficientemente del inicio de la clasificación, mostrar una utilidad flotante discreta:

`↑ Ir al inicio`

Características:

- pequeña;
- no competir con la clasificación;
- aparecer solo cuando tenga sentido;
- desaparecer cerca del inicio;
- al tocarla, hacer smooth scroll hacia la parte superior del Ranking;
- no recargar la pantalla.

No depender del gesto específico de iOS de tocar la status bar, ya que BRAMU debe comportarse de forma consistente también en Android/web.

### 8.4 Paginación

Mantener la carga progresiva existente por bloques de 50.

No renderizar cientos de filas de forma innecesaria.

La navegación directa mediante la tarjeta debe conservar la capacidad actual de saltar al bloque correspondiente.

---

## 9. Fila de jugador

Mantener la arquitectura actual salvo ajustes necesarios por los nuevos filtros.

Debe seguir mostrando, cuando corresponda:

- posición;
- movimiento semanal;
- avatar/foto;
- nombre identificable;
- `@usuario`;
- Nivel BRAMU;
- ubicación/contexto mínimo.

La primera revisión publicada confirmó que mostrar ubicación aporta valor y debe mantenerse.

En búsquedas y contextos donde haya ambigüedad, priorizar nombre y apellido/display name suficiente para identificar a la persona.

---

## 10. Navegación de perfiles — bug a corregir

Bug detectado:

- Ranking → Perfil público de otra persona → Back → vuelve correctamente a Ranking.
- Ranking → Mi Perfil → Back → vuelve a Home.

Debe corregirse para que el back respete el origen.

Si Mi Perfil fue abierto desde Ranking, volver debe regresar a Ranking preservando en lo posible:

- ámbito;
- género;
- filtro de nivel;
- posición de scroll relevante.

No cambiar el comportamiento normal de Mi Perfil cuando se abre desde otros lugares.

---

## 11. Tabs — contraste activo/inactivo

La prueba publicada mostró que la pestaña seleccionada no se diferencia con suficiente fuerza.

No aplicar una corrección exclusiva a Ranking sin revisar el patrón compartido.

Claude debe:

1. identificar qué estilos/componentes de tabs reutiliza Ranking;
2. verificar si el mismo problema existe en Historial/Mis grupos u otras pantallas;
3. proponer y aplicar el ajuste mínimo coherente al componente/patrón compartido si corresponde.

No inventar una familia nueva de tabs solo para Ranking.

El objetivo es mejorar legibilidad del estado activo sin romper la identidad visual actual.

---

## 12. Aviso de nueva versión — pulido general

La ventana/aviso de:

`Hay una nueva versión de BRAMU`

presenta un espaciado vertical excesivo.

Normalizar spacing, manteniendo exactamente la funcionalidad actual:

- Actualizar;
- Más tarde;
- proceso de actualización.

Es un pulido general detectado durante la revisión de V03.5, no una nueva función de Ranking.

---

## 13. Estados existentes que deben preservarse

V03.5.1 reorganiza UX, pero NO elimina la lógica de estados ya construida.

Deben seguir funcionando:

- sin Nivel;
- calibrando con regla real de 5 partidos computables + 3 rivales distintos;
- calibrado;
- inactivo;
- nuevo/reingreso;
- sin ubicación;
- opt-out/perfil privado si el prototipo puede representarlo;
- densidad territorial 0–4, 5–14 y 15+;
- Global bloqueado;
- bandas sin resultados;
- Mi red con jugadores calibrando/inactivos cuando corresponda.

Adaptar copy y ubicación visual de estos estados al nuevo diseño sin reabrir la lógica funcional.

---

## 14. Qué NO debe hacerse en V03.5.1

No implementar todavía:

- backend real;
- snapshots persistidos reales;
- validación multiusuario;
- Nivel BRAMU real V04;
- BRAMU Intelligence;
- contacto por WhatsApp;
- edición del teléfono/permisos públicos;
- cambios de fórmula de Nivel;
- rediseño de Home;
- rediseño general de Perfil;
- nuevas métricas de Ranking;
- puntos propios de Ranking.

---

## 15. Próximo mini-frente después de Ranking

Una vez que Ranking quede visualmente cerrado, evaluar inmediatamente una mejora separada de Perfil público:

### Contactar por WhatsApp

Idea guardada para la siguiente ronda, NO implementar en V03.5.1:

- permitir que el usuario cargue su teléfono en datos privados;
- consentimiento explícito para permitir contacto de otros jugadores;
- no mostrar obligatoriamente el número en texto plano;
- botón `Contactar por WhatsApp` en Perfil público cuando el usuario lo habilite;
- abrir WhatsApp con mensaje prearmado del estilo:
  `Hola, te encontré en BRAMUlab. ¿Te interesaría organizar un partido de pádel?`

Esta función puede convertir Ranking de una experiencia pasiva en una herramienta para generar partidos, pero debe tratarse aparte.

---

## 16. Orden visual objetivo de V03.5.1

Referencia conceptual, no diseño literal:

`RANKING BRAMU                                      [🔍] [?]`

`Local | Provincial | País | Global | Mi red`

`Masculino ▾`    `Todos los niveles ▾`

`[ TARJETA TU POSICIÓN — lenguaje visual BRAMU ]`

`CLASIFICACIÓN`

`#1 ...`
`#2 ...`
`#3 ...`
`...`

Al tocar `Tu posición`:

→ scroll suave a la propia fila

Al alejarse del inicio:

`↑ Ir al inicio`

No debe existir como bloques permanentes separados:

- General / Por Nivel;
- Cerca tuyo;
- Verme en la clasificación;
- Buscar jugador;
- Cómo funciona.

Sus funciones se redistribuyen en controles más adecuados.

---

## 17. Implementación recomendada

V03.5.1 puede implementarse como una única ronda de refinamiento porque la lógica base ya existe, pero conviene trabajar internamente en este orden:

### A. Arquitectura UX

- reordenar ámbitos;
- renombrar `Mis jugadores` → `Mi red`;
- Local por defecto;
- agregar selectores de género y nivel;
- mover búsqueda y ayuda al header;
- eliminar bloques redundantes.

### B. Tarjeta y navegación dentro del Ranking

- rediseñar `Tu posición`;
- hacerla interactiva;
- scroll al usuario;
- `↑ Ir al inicio`;
- preservar paginación de 50.

### C. Mi red

- ventana de 180 días;
- lógica de ocultar;
- gestión `Ocultos (N)`;
- restaurar jugador oculto;
- preservar partidos e historial intactos.

### D. QA y bugs

- back desde Mi Perfil a Ranking;
- tabs activo/inactivo;
- spacing aviso de versión;
- mobile primero;
- tablet;
- desktop quick check;
- regresiones del resto de la app.

---

## 18. Tests y QA

### Tests

Agregar o ajustar tests solo donde haya lógica real nueva:

- filtro 180 días de Mi red;
- ocultar/restaurar jugador;
- género;
- filtro de nivel;
- salto directo al bloque de la propia posición si se modifica lógica pura;
- preservación de estados existentes.

No crear tests artificiales para puro CSS/markup.

### QA manual

Prioridad:

1. iPhone/mobile;
2. ancho pequeño 320–375;
3. tablet / iPad Mini;
4. desktop quick check.

Verificar especialmente:

- claridad de pestaña activa;
- header con lupa y ayuda;
- desplegables;
- tarjeta Tu posición;
- scroll a posición propia;
- regreso al inicio;
- Mi red;
- ocultos;
- vuelta desde perfiles;
- paginación;
- estados vacíos;
- Global bloqueado;
- navegación inferior intacta;
- Home intacto salvo correcciones generales acordadas.

---

## 19. Publicación y validación

V03.5.1 debe publicarse al finalizar el QA técnico.

Esta versión NO se considera cierre definitivo de la línea V03 únicamente por quedar publicada.

Después del deploy:

- Sebastián la revisará como usuario real;
- se evaluará la jerarquía visual y el comportamiento de los nuevos controles;
- pueden surgir V03.5.2 o microajustes adicionales;
- solo cuando la experiencia se considere realmente terminada se dará por cerrado Ranking dentro de V03.

No avanzar a Nivel BRAMU antes de esa validación final salvo indicación expresa.

---

## 20. Relación con documentación previa

`BRAMUlab_V03.5.md` queda como registro cerrado de la primera implementación publicada del Ranking.

Este documento define los cambios de V03.5.1.

Para decisiones de UX que contradigan expresamente la presentación de V03.5 —por ejemplo `General | Por Nivel`, `Cerca tuyo`, orden de ámbitos o ubicación de búsqueda/ayuda— **V03.5.1 reemplaza esa presentación dentro del prototipo**.

No modifica por sí mismo la fórmula de Nivel BRAMU ni las reglas matemáticas de ordenamiento del Ranking.

Las nuevas decisiones de producto incorporadas aquí —segmentación masculino/femenino, ventana de 180 días y ocultamiento dentro de Mi red— deben tratarse como decisiones de V03.5.1 a validar en prototipo. Una vez aprobadas visual y funcionalmente, habrá que sincronizarlas con `Ranking_BRAMU.md` para que la documentación normativa no quede desfasada.

---

## 21. Resultado esperado

Al terminar V03.5.1, Ranking BRAMU debe sentirse:

- más simple;
- menos repetitivo;
- más jerarquizado;
- más parecido al lenguaje visual actual de BRAMU;
- más rápido de leer;
- más fácil de explorar;
- preparado para crecer sin convertir la pantalla en una colección de botones.

La intención no es sumar funciones visibles, sino hacer que cada función aparezca en el lugar correcto.

---

## 22. Cierre de V03.5.1

**Tag:** `BRAMUlab_V03.5.1`. **Base:** BRAMUlab_V03.5. **Tests finales:** 913/913 (901 previos + 12 nuevos de esta ronda, en `ranking.js`/`store.js`/`tests.html`).

### 22.1 Qué quedó implementado

Todo lo pedido en este documento, sin recortes de alcance:

- ámbitos reordenados a Local/Provincial/País/Global/Mi red, con **Local** como estado inicial;
- `Mis jugadores` renombrado a **Mi red**, acotado a partidos computables compartidos en los últimos **180 días** (`RK.computeNetworkNames`/`NETWORK_WINDOW_DAYS`);
- **Ocultar de Mi red** por fila + sheet **"Ocultos (N)"** con restauración individual — nunca toca partidos/Nivel/Ranking, solo la vista personal (`Store.HIDDEN_NETWORK_PLAYERS`);
- segmentación de **género** (Masculino/Femenino) vía desplegable compacto, default = género declarado propio, nunca mezclada en la Clasificación;
- `General | Por Nivel` eliminado como modos paralelos; Nivel pasa a ser un **filtro** ("Todos los niveles ▾") con atajo **"Mi nivel · Nivel X"**;
- header con ícono de **lupa** (filtra en vivo la Clasificación visible) e ícono de **ayuda** (abre el sheet ya existente), reemplazando el bloque de búsqueda permanente y el link "¿Cómo funciona?" del cuerpo;
- **Tu posición** rediseñada con el lenguaje visual de Último partido (borde lima, `--radius-hero`, glow), etiqueta dentro de la tarjeta, nunca sticky, **toda la tarjeta tappeable** → scroll suave hasta la fila propia (saltando de bloque de 50 si hace falta) — reemplaza y elimina "Verme en la clasificación" y "Cerca tuyo" por completo;
- Clasificación siempre arranca en **#1**, paginación progresiva de 50 preservada;
- botón flotante **"↑ Ir al inicio"** (aparece solo lejos del top, scroll suave, funciona igual en Android/web);
- **bug corregido**: Ranking → Mi Perfil → Volver ahora vuelve a Ranking (antes iba a Home); Perfil público, sin tocar, sigue funcionando igual que antes;
- **contraste de tabs** corregido en el componente compartido `.history-tab.is-active` (mismo fix alcanza Historial y Mis grupos, no solo Ranking);
- espaciado del aviso "Hay una nueva versión de BRAMU" normalizado (fix acotado por ID, nunca toca `.overlay` compartida — ver 22.2);
- todos los estados de V03.5 (sin Nivel, calibrando con 5 partidos + 3 rivales distintos, calibrado, inactivo, Nuevo/reingreso, sin ubicación, densidad territorial y de red, Global bloqueado, bandas sin resultados) verificados intactos en vivo.

### 22.2 Adaptaciones reales respecto del documento

- **Lupa del header**: no reabre un overlay de búsqueda global de jugadores (patrón viejo de V03.3) sino que filtra en vivo la Clasificación del universo/ámbito actualmente activo — más simple y más útil que una búsqueda separada, y reutiliza el mismo campo de texto que ya existía.
- **Calibrando/Inactivo dentro de Mi red**: estas filas informativas (sin puesto, sin comparación) **no** se filtran por género — el filtro de género solo gobierna la Clasificación (la comparación "oficial" que el documento pide no mezclar nunca). Mezclar géneros en la lista de "gente de tu red que todavía está calibrando" no es una clasificación, así que no aplicaba la misma regla.
- **Espaciado del aviso de nueva versión**: en vez de tocar `.overlay__card`/`.overlay__title`/`.overlay__text`/`.overlay__actions` (compartidas por ~18 modales), el ajuste quedó acotado con selectores por `#update-available-modal`, tal como pedía el documento explícitamente.

### 22.3 Bugs reales encontrados y corregidos durante esta ronda

- El bug de back-navegación Ranking → Mi Perfil pedido explícitamente en este documento (§10): corregido replicando el patrón ya correcto de `playerPublicOrigin` en un nuevo `profileScreenOrigin`.
- Una línea redundante (`globalBlocked.hidden = false; globalBlocked.hidden = true;`) introducida durante la reescritura de Bloque 3 de este mismo round, encontrada por autorevisión antes de QA — sin impacto visible (el valor final ya era el correcto), corregida a una sola asignación.
- QA en vivo (mobile 375px, tablet, desktop) no encontró regresiones nuevas en Home, Historial, Mis grupos, marcador, Resumen ni bottom nav.

### 22.4 Limitaciones conocidas, propias del prototipo (no bugs)

- El género de los jugadores mock territoriales sigue siendo una simulación determinística por nombre (`RK.mockGenderForName`), no un dato real declarado — igual que el Nivel mock ya documentado en V03.5.
- Dataset territorial 100% Argentina — Global sigue bloqueado en este build (heredado de V03.5, sin cambios).
- Esta publicación **no cierra definitivamente Ranking dentro de V03** — queda sujeta a la prueba real de Sebastián como usuario y a posibles V03.5.2/microajustes, tal como indica §19.
