# Pre-Production — Laboratorio UX de uso real

**Fecha:** 23/09/2026  
**Estado:** activo hasta retomar implementación técnica.  
**Objetivo:** aprovechar los próximos días para probar BRAMUlab como jugador real, detectar fricciones visuales/UX y consolidar cambios antes de entregarlos a implementación.

## 1. Método

Sebastián prueba BRAMUlab directamente en Staging con sus propios dispositivos/cuentas.

Puede usar, por ejemplo:

- computadora;
- celular;
- dos cuentas distintas;
- recorridos reales de carga, validación, corrección, pendientes, historial, perfiles y Resumen.

Cuando encuentre algo:

1. envía captura o describe la pantalla;
2. explica cómo esperaba que se sintiera o funcionara;
3. ChatGPT central clasifica y documenta;
4. no se implementa inmediatamente salvo bug crítico;
5. al final se consolida un único paquete de cambios para implementación.

La meta es evitar microcambios y microdeploys durante la exploración.

## 2. Clasificación de cada hallazgo

Cada observación debe quedar en una de estas categorías:

### BUG

Algo contradice una regla ya cerrada o rompe el flujo.

Ejemplos:

- botón que no responde;
- estado incorrecto;
- dato falso;
- pantalla que muestra una acción que no corresponde.

### UX / VISUAL

La lógica funciona, pero la presentación no se siente bien.

Ejemplos:

- jerarquía incorrecta;
- botón demasiado protagonista;
- copy confuso;
- espaciado/layout;
- densidad excesiva;
- estado pendiente poco claro.

### PRODUCTO

La prueba revela que hay que decidir cómo debería funcionar algo.

Solo se interrumpe para una decisión humana si cambia materialmente el producto.

### YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA

La documentación ya contiene la decisión correcta, pero la app todavía no la refleja.

Ejemplo actual confirmado:

- Estado Cero / perfiles progresivos.

No presentar esto como idea nueva.

## 3. Qué conviene recorrer

Prioridad de uso real:

1. alta/login/recuperación;
2. Home Estado Cero;
3. carga de partido;
4. pendiente visto desde ambos lados;
5. confirmar;
6. proponer corrección;
7. `No participé`;
8. Historial;
9. Resumen;
10. BRAMU Intelligence;
11. Mi Perfil;
12. Perfil público;
13. Ranking;
14. grupos/notificaciones solo si aparecen naturalmente.

No hace falta cubrir todo en una sola sesión.

## 4. Evidencia útil

Ideal:

- screenshot;
- dispositivo;
- cuenta/rol;
- qué acababas de hacer;
- qué no te gustó;
- cómo te lo imaginabas.

No hace falta lenguaje técnico.

## 5. Rol de ChatGPT central

ChatGPT central debe:

- mantener coherencia con fuentes maestras;
- distinguir bug vs. gusto visual vs. decisión;
- buscar primero si el comportamiento ya estaba definido;
- evitar pedir a Sebastián que reconstruya contexto;
- consolidar cambios en este documento;
- preparar luego un handoff único y priorizado para implementación;
- minimizar deploys.

## 6. Rol de ChatGPT Work

Usar Work solo cuando agregue evidencia única:

- recorrer un flujo completo de navegador;
- comparar viewport móvil/escritorio;
- revisar consola/red;
- validar estados reales del backend;
- reproducir un bug visual específico.

No usar Work como sustituto de Claude Code para cambios medianos/grandes de código.

## 7. Criterio para implementar

Durante estos días, preferir **documentar primero**.

Implementar solo si:

- es un bug crítico;
- bloquea seguir probando;
- compromete datos, identidad, auth o seguridad.

El resto se agrupa.

## 8. Salida del laboratorio

Antes de volver a implementación, producir un consolidado final con:

- CAMBIO OBLIGATORIO antes de Production;
- CONVENIENTE antes de invitar amigos;
- PULIDO FUTURO;
- NO CAMBIAR.

Ese consolidado debe incluir screenshots/referencias suficientes para que el implementador no tenga que reinterpretar la intención visual.


## 9. Regla para el chat paralelo de Laboratorio UX

Este laboratorio se trabaja en un chat separado de coordinación/desarrollo para no mezclar conversación exploratoria con ejecución técnica.

Al comenzar ese chat:

1. leer `docs/BRAMUlab/README.md`;
2. leer `docs/BRAMUlab/Pre_Production.md`;
3. leer `docs/BRAMUlab/Experiencia_Inicial.md`;
4. leer este documento;
5. consultar después únicamente la fuente maestra del sistema que aparezca en la prueba.

### Obligación antes de hacer una pregunta de producto

Antes de preguntarle a Sebastián “¿cómo querés que funcione?”, buscar si esa decisión ya existe en documentación vigente.

Si ya existe:

- recordarla;
- mostrarla en lenguaje simple;
- comparar la app actual contra esa decisión;
- clasificar cualquier diferencia como `YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA`.

Solo preguntar cuando exista una **DECISIÓN ABIERTA real** que no pueda resolverse por las fuentes maestras.

No pedirle a Sebastián que recuerde en qué chat se habló algo.

### Estado Cero

P0.1 está confirmado como implementación incompleta.

Por lo tanto, mientras no se implemente:

- no evaluar el Estado Cero actual como si fuera el diseño final;
- sí se pueden registrar screenshots concretos de gaps;
- no invertir una sesión larga en pulir una pantalla que ya sabemos que va a cambiar;
- la evaluación visual definitiva de Estado Cero se hace después de implementar P0.1.

### Persistencia de decisiones

Al cerrar una idea o pantalla:

- actualizar este documento o un consolidado derivado;
- marcar claramente:
  - `CONFIRMADO`;
  - `PROPUESTA`;
  - `PENDIENTE`;
  - `NO TOCAR`;
- no dejar decisiones importantes solo en el chat.

## 10. Preparación de cuentas para pruebas

No limpiar “todo Staging” por defecto.

La configuración recomendada para UX es:

- **Cuenta A limpia**: usuario principal controlado por Sebastián;
- **Cuenta B limpia**: segundo usuario real controlado por Sebastián desde otro dispositivo/navegador;
- conservar identidades de prueba adicionales cuando sirvan como rivales/compañeros;
- crear/reusar provisionales solo cuando la prueba lo necesite.

Con A + B se pueden probar:

- carga desde un lado;
- recepción desde el otro;
- confirmación por pareja;
- propuesta de corrección;
- estados accionable/no accionable;
- Historial;
- Resumen;
- notificaciones;
- perfil propio/público.

Los otros dos lugares del partido pueden ser identidades de prueba/provisionales cuando el caso lo permita.

### Limpieza

Antes de resetear cuentas:

1. identificar exactamente las dos cuentas de Staging elegidas;
2. revisar qué partidos/claims/datos QA dependen de ellas;
3. preservar cualquier evidencia documental que todavía importe;
4. limpiar solo lo necesario;
5. comprobar que vuelvan a:
   - cuenta nueva;
   - Nivel inicial sin partidos oficiales;
   - 0 historial computable;
   - sin pendientes residuales.

La limpieza de cuentas/datos es destructiva y se hace solo con autorización explícita de Sebastián una vez identificadas las cuentas.

Para probar calibración completa de Nivel, preparar después un escenario controlado específico; no mezclar esa necesidad con la limpieza inicial de UX.


## 11. Cuentas sintéticas de QA — decisión confirmada

**QA = Quality Assurance / control de calidad.** Es una etiqueta interna para distinguir cuentas sintéticas de usuarios reales. No forma parte del producto final.

Para Staging se adopta un set fijo de ocho cuentas sintéticas controladas por BRAMU:

- Seba
- Matu
- Gusti
- Esteban
- Lucho
- Jona
- Diego
- Pablito

### Convención de identidad

La experiencia visible debe parecer la de usuarios normales:

- nombre visible: nombre habitual, sin sufijo QA;
- @usuario: incluir `_qa` para distinguir inequívocamente la cuenta sintética, por ejemplo `@seba_qa`;
- email: usar plus-addressing de la casilla central **sin agregar QA al alias**, por ejemplo `bramulab+seba@gmail.com`, `bramulab+matu@gmail.com`, etc.

Set objetivo de emails:

- `bramulab+seba@gmail.com`
- `bramulab+matu@gmail.com`
- `bramulab+gusti@gmail.com`
- `bramulab+esteban@gmail.com`
- `bramulab+lucho@gmail.com`
- `bramulab+jona@gmail.com`
- `bramulab+diego@gmail.com`
- `bramulab+pablito@gmail.com`

### Perfil de prueba

Estas cuentas deben quedar lo más completas posible para que sirvan también para Perfil y recorridos posteriores.

Antes de crearlas, Work debe hacer **una sola consulta agrupada** a Sebastián con todos los datos que falten para las ocho identidades, por ejemplo:

- nombre y apellido;
- fecha de nacimiento aproximada/sintética si se quiere probar edad;
- mano dominante;
- lado preferido;
- cualquier otro dato de Perfil que la UI vigente permita completar;
- objetivo aproximado de Nivel inicial o respuestas del cuestionario necesarias para generar niveles distintos.

No preguntar cuenta por cuenta si puede resolverse en una sola tabla.

Los datos pueden ser sintéticos o aproximados; no deben presentarse como datos reales de las personas cuyos nombres se usan como referencia.

### Credencial de testing

Las ocho cuentas pueden compartir la misma contraseña **solo en Staging**, siempre que sea una contraseña exclusiva de testing y no reutilizada en cuentas personales ni Production.

Si Sebastián decide compartir esa contraseña con Work para automatizar el alta, Work puede usarla dentro de esa sesión operativa, pero:

- no debe escribirla en el repositorio;
- no debe incluirla en informes;
- no debe persistirla en documentación;
- no debe usarla fuera de Staging.

### Creación

Work puede crear las ocho cuentas en una sola ronda de trabajo, pero antes debe:

1. confirmar que `bramulab+seba@gmail.com` recibe correctamente el primer OTP en la casilla central;
2. si el alias funciona, continuar con las otras siete;
3. completar onboarding/perfil según los datos acordados;
4. verificar que cada cuenta tenga identidad separada y el @usuario correcto;
5. dejar constancia de qué cuentas quedaron creadas y cualquier incidencia, sin registrar contraseñas.

No crear usuarios directamente por SQL/Admin si el objetivo es validar también el flujo real de alta.

### Uso

Con ocho cuentas controladas alcanza holgadamente para probar:

- partidos completos de dobles;
- validación por parejas;
- correcciones;
- `No participé`;
- identidades provisionales/claims;
- diversidad de rivales suficiente para calibración de Nivel;
- perfiles públicos;
- Ranking/eligibilidad cuando corresponda;
- escenarios cruzados sin depender de cuentas personales.

Las cuentas personales de Sebastián quedan fuera del set estándar de QA salvo que una prueba específica lo requiera.


## 12. Secuencia del laboratorio — decisión vigente

No es obligatorio crear las ocho cuentas ni ejecutar ahora el recorrido completo de QA.

Se prioriza esta secuencia:

1. cerrar primero las decisiones de producto/UX que ya pueden resolverse sin datos de prueba;
2. implementar P0.1 Estado Cero / perfiles progresivos y el resto del paquete visual priorizado;
3. recién entonces crear/preparar el set completo de ocho cuentas sintéticas si todavía es necesario;
4. ejecutar un laboratorio integrado sobre una versión más cercana a la experiencia final;
5. cerrar con QA final de punta a punta antes de Production.

Motivo: evita gastar tiempo evaluando pantallas que ya sabemos que van a cambiar y permite que el testing posterior sea más representativo de la experiencia real.

Las cuentas sintéticas siguen siendo el universo recomendado de QA, pero su creación puede diferirse hasta que aporte evidencia útil.


## 13. Hallazgos preliminares antes de la ronda de implementación — 24/09/2026

### 13.1 Participación en Ranking

**Clasificación:** PRODUCTO — decisión confirmada.

Estado documental actual:

- `Ranking_BRAMU.md` exige `ranking_opt_in` para ocupar posición;
- `Experiencia_Inicial.md` lo trata como dato competitivo que se completa al entrar a Ranking;
- la documentación vigente no lo identifica como una obligación legal específica: aparece como decisión de producto/privacidad.

Nueva dirección propuesta por Sebastián:

- un usuario de BRAMU no debería tener que elegir “participar sí/no” en Ranking;
- Ranking sería una consecuencia normal de usar BRAMU cuando el jugador cumpla elegibilidad;
- seguirían siendo necesarios los datos objetivos para ubicarlo correctamente, como localidad/rama y Nivel calibrado.

**Estado:** CONFIRMADO — 24/09/2026.

Nueva regla vigente:

- todo jugador activo participa automáticamente del Ranking cuando cumple elegibilidad;
- no existe opt-in/opt-out ordinario;
- al entrar a Ranking, si faltan localidad o rama, se solicitan esos datos;
- mientras el Nivel esté `CALIBRANDO`, puede explorar Ranking pero no ocupa posición;
- `ranking_opt_in` queda como compatibilidad histórica y debe dejar de decidir elegibilidad.

Implementación: revisar gate, RPCs/cálculo, schema legacy y UI sin romper snapshots existentes.

### 13.2 Pantalla de validación/confirmación de partido

**Clasificación:** UX / VISUAL.

La lógica vigente ya define la jerarquía funcional:

1. `Confirmar` — primaria;
2. `Proponer corrección` — secundaria;
3. `No participé` — excepcional y de menor jerarquía.

Sebastián no cuestiona por ahora esa lógica, sino la composición visual actual: pantalla, distribución y botones no se sienten bien; imagina una solución más cercana a un modal/popup o una presentación más compacta.

**Estado:** PENDIENTE DE EVALUACIÓN VISUAL.

No rediseñar a ciegas. Revisar con captura/flujo real en Laboratorio UX antes de pasar una instrucción a implementación.

### 13.3 Acción central `+` para cargar partido

**Clasificación:** YA DEFINIDO / verificar posible regresión o entorno viejo.

La decisión vigente ya es:

- BRAMUlab registra solo partidos propios ya jugados;
- BRAMUlive contiene el registro/marcador en vivo;
- el acceso `+` de BRAMUlab debe ir directamente a `Cargar mi partido`, sin menú de dos opciones.

Además, el código vigente de `staging` enlaza el FAB central directamente a `data-nav="manual-load"`.

Si una instalación/pantalla todavía muestra dos botones, no reabrir producto: comprobar si corresponde a PWA/cache/deploy antiguo o una regresión concreta del entorno usado.


### 13.4 Responsive / ancho en escritorio

**Clasificación:** UX / VISUAL.

Observación preliminar en Staging:

- gran parte de BRAMUlab se presenta en escritorio con un ancho que se siente más cercano a tablet;
- Iniciar sesión y Crear cuenta se ven bastante más angostos, casi como celular;
- no todas las pantallas parecen responder a una misma regla de ancho.

**Estado:** PENDIENTE DE EVALUACIÓN VISUAL.

No modificar ni normalizar todavía a ciegas. Cuando se retome el Laboratorio UX, comparar con capturas reales y definir una regla responsive consistente para BRAMUlab.

Dirección preliminar a evaluar:

- BRAMUlab sigue siendo mobile-first;
- en escritorio no debería expandirse como un dashboard/tablet ancho;
- debería existir una columna central consistente para las pantallas principales;
- esa columna no necesariamente debe copiar exactamente el ancho físico de un celular;
- Login/Signup pueden ser algo más angostos si funcionalmente conviene, pero deben sentirse parte del mismo sistema visual.

Revisar especialmente:

- Home;
- Historial;
- Ranking;
- Mi Perfil;
- Perfil público;
- Cargar partido;
- Login;
- Signup.

La revisión debe cerrar, antes de implementación, una regla coherente de:

- ancho máximo / `max-width`;
- gutters laterales;
- relación entre viewport móvil, tablet y escritorio;
- posibles excepciones justificadas por tipo de pantalla.

No implementar hasta comparar visualmente las superficies anteriores sobre Staging.


## 14. Método operativo del laboratorio integrado — decisión vigente 24/09/2026

A partir de la disponibilidad de las ocho cuentas sintéticas y del cierre de P0.1/P0.1C, el laboratorio integrado se coordina desde el chat central de BRAMUlab, no desde un chat UX separado.

Motivo:

- Sebastián puede probar desde su celular como jugador real;
- Work puede actuar como contraparte estable desde navegador;
- ChatGPT central coordina escenario por escenario, recibe feedback, clasifica hallazgos y documenta;
- evita pasar contexto entre chats durante una prueba interactiva.

### Roles estables recomendados

- **Sebastián / celular:** cuenta `Seba / @seba_qa`;
- **Work / navegador cloud:** cuenta `Esteban / @esteban_qa`;
- las otras seis cuentas quedan disponibles como compañeros/rivales sin necesidad de iniciar sesión en ellas salvo que un escenario lo exija.

Work debe mantener la sesión de Esteban abierta entre escenarios y evitar logout/login innecesarios.

### Forma de trabajo

Se prueba **un escenario por vez**.

Para cada escenario:

1. ChatGPT central define el estado inicial y las acciones de Work;
2. Work ejecuta solo hasta el punto acordado y se detiene;
3. Sebastián ejecuta su parte desde el celular;
4. Sebastián trae resultado, screenshots y sensaciones;
5. ChatGPT central clasifica y documenta:
   - PASS;
   - BUG;
   - UX / VISUAL;
   - PRODUCTO;
   - YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA;
6. solo después se avanza al escenario siguiente.

No acumular diez acciones de Work sin checkpoints humanos: el objetivo es observar la experiencia real, no solo completar una suite.

### Mapa inicial de escenarios

**Bloque A — circuito normal**
1. Esteban carga / Seba confirma.
2. Seba carga / Esteban confirma.

**Bloque B — desacuerdo y corrección**
3. Propuesta de corrección antes de oficializar.
4. `No participé` + corrección de identidad.

**Bloque C — identidad / duplicados / provisionales**
5. Segunda carga coincidente del mismo encuentro.
6. Participante provisional y posterior claim/reemplazo cuando corresponda.

**Bloque D — progresión real**
7. Construir varios partidos controlados para observar Home/Historial/perfiles/Nivel.
8. Llegar a evidencia suficiente para calibración y revisar Ranking semanal.
9. Revisar BRAMU Intelligence únicamente después de que existan partidos oficiales reales suficientes.

No forzar todos los casos en una sola sesión. Si un escenario descubre un bug bloqueante o una decisión de producto, se resuelve antes de contaminar los siguientes.


## 15. Laboratorio integrado — Escenario 1A (Esteban carga / Seba recibe) — 25/09/2026

### Estado creado

Work, logueado como `Esteban / @esteban_qa`, cargó:

- Esteban + Matu vs Seba + Lucho;
- resultado 6-4, 6-3 para Esteban/Matu;
- estado server-side: `pending_validation`.

ChatGPT central verificó directamente en Supabase Staging que:

- el partido existe;
- Seba figura correctamente como participante;
- `get_my_matches` para Seba devuelve el partido;
- `is_action_mine=true`;
- `get_notifications` para Seba devuelve una notificación derivada `pending_review` no leída.

### Hallazgo 15.1 — Home/notificaciones quedan stale al volver a la app

**Clasificación:** BUG FUNCIONAL + UX DE FRESCURA.

Sebastián volvió al Home en iPhone y la app seguía mostrando Estado Cero:

- `0 partidos en tu historia`;
- `CARGAR PRIMER PARTIDO`;
- sin badge/notificación visible;
- ningún indicio de que existía un pendiente accionable.

El backend sí tenía toda la información correcta. El problema es de sincronización/refresco del cliente.

Revisión de código:

- `openPlayerHome()` refresca partidos al ENTRAR a Home;
- `openHistoryScreen()` refresca partidos al ENTRAR a Historial;
- `openNotificationsScreen()` refresca notificaciones al ABRIR la bandeja;
- al volver la PWA a foreground, el listener de `visibilitychange` solo chequea versión/Wake Lock;
- no refresca partidos ni notificaciones;
- si el usuario ya estaba parado en Home cuando otro participante carga un partido, la pantalla puede quedar desactualizada indefinidamente hasta navegar/recargar.

### Dirección propuesta

**OBLIGATORIO antes de Production:**

Agregar un refresco liviano del estado server-backed cuando la app vuelve a foreground:

- partidos;
- notificaciones;
- cualquier dato propio que haya podido cambiar por acciones remotas y afecte Home;
- re-render únicamente de la vista actualmente abierta cuando corresponda;
- con throttle simple para evitar llamadas duplicadas por cambios rápidos de visibilidad.

No implementar polling continuo ni Realtime solo para resolver este caso.

**UX propuesta para evaluar/implementar:**

Agregar gesto de `pull-to-refresh` en superficies de lectura principales, como mecanismo manual reconocible:

- Home;
- Historial;
- Notificaciones.

El gesto manual es complemento, no sustituto del refresco automático al volver a foreground.

### Estado del escenario

NO confirmar todavía el partido.

Primero resolver/validar la frescura del cliente para que el pendiente aparezca de forma natural; después continuar con la evaluación visual de la pantalla de validación.

### Corrección implementada — 25/09/2026 (Claude Code)

**HEAD resultante:** rama `staging`, sobre `e91c3fe` (punto de partida de esta ronda). **Bundle:** `04.10-h32` (bump desde `04.10-h31`, solo `app.js`/`sw.js`/`index.html` tocados — `Store.VERSION`/`version.json` siguen en `"BRAMUlab V04.10"`, ronda de Backend/Infraestructura, no de Nivel).

**Qué se agregó:** un coordinador liviano `refreshServerStateOnForeground()` (bramulab/app.js), enganchado al **mismo** listener `visibilitychange` que ya usaba `initUpdateCheck()` para `checkForNewVersion()`/Wake Lock — no se creó ningún listener nuevo ni polling. Reutiliza exclusivamente mecanismos ya existentes, sin ninguna RPC ni contrato nuevo:

- `refreshServerMatches()` (cache de `get_my_matches`, ya usado por Home/Historial al entrar);
- `refreshB6Notifications()` (cache de `get_notifications`, ya usado por la bandeja);
- `Auth.fetchOwnProfile()` + `Store.cacheServerUser()` + `syncServerLevelState()` (mismo trío que ya usa `afterB6Action()` para refrescar perfil/Nivel propio);
- repintado condicionado a la pantalla realmente visible: `renderPlayerHome()`/`renderHistory()`/`renderNotificationsList()+renderNotificationsBadge()` — nunca una pantalla que el usuario no está mirando, mismo patrón exacto que ya usa `afterB6Action()` (`!$('#view-X').hidden`).

**Diferencia deliberada respecto de `afterB6Action()`:** ese helper solo refresca notificaciones si la bandeja ya está abierta (su disparador es siempre una acción sobre un partido puntual). Acá el disparador es "la app volvió a primer plano" — sin relación con ningún partido puntual — así que matches y notificaciones se refrescan siempre, sin condicionar a qué pantalla esté visible; de lo contrario el badge de Home podría seguir desactualizado si la notificación llegó mientras el usuario estaba parado en Historial.

**Protección de duplicados/carreras:** un guard `in-flight` (booleano) más un throttle de **2000 ms** que solo colapsa dos eventos `visibilitychange` casi simultáneos — nunca una ventana larga que pudiera ocultar una actualización remota real después de un tiempo real en background (verificado explícitamente: un segundo evento genuino después de la ventana de 2s sí vuelve a refrescar).

**Tolerancia a fallas parciales:** cada uno de los tres pasos de lectura (matches/notificaciones/perfil) queda aislado en su propio `try/catch` — una falla real en uno no impide intentar los otros dos, y ninguna falla vacía un cache existente (cada función interna ya es "mejor esfuerzo" por diseño: conserva el cache anterior si el pedido falla).

**Pull-to-refresh:** NO implementado en esta ronda, según el pedido explícito — queda documentado como mejora UX complementaria, no sustituta.

**DECISIÓN ABIERTA no bloqueante (hallazgo, no un bug de esta ronda):** `renderPlayerHome()` ya tenía, antes de esta ronda, una llamada interna `refreshB6Notifications().then(renderNotificationsBadge)` sin `.catch()` (best-effort de Bloque 6 Fase B). En el uso real esto nunca truena porque `refreshB6Notifications()` usa `c.rpc(...)` de supabase-js, que resuelve con `{data, error}` en vez de rechazar ante un fallo de RPC/red ordinario. Se detectó únicamente al forzar, desde consola, que esa llamada RECHAZARA de verdad (un caso límite no representativo de una falla real de Supabase) — en ese escenario extremo se ve un "Uncaught (in promise)" en consola, sin romper la app ni bloquear nada. No se tocó `renderPlayerHome()` en esta ronda (está fuera del alcance del bug reportado y es código ya validado de un Bloque cerrado); queda anotado acá por si conviene un `.catch()` defensivo en un futuro paso de hardening (Bloque 9).

**Pruebas realizadas:**

- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS** (regresión de control; ninguno de esos módulos fue tocado).
- `bramulab/tests.html` (navegador local) → **1478/1478 PASS**, corrido después del bump de bundle y de nuevo tras el endurecimiento de los `try/catch`.
- `app.js` no tiene cobertura de unit tests por diseño (orquestación de DOM/estado, ver README de rondas anteriores) — la verificación de este comportamiento específico se hizo con spies reales en el navegador embebido (consola, sin credenciales de Supabase, no destructivo — mismo criterio que otras rondas), monkey-parcheando `PLAuth.isConfigured`/`PLAuth.fetchOwnProfile`/`PLMatches.getMyMatches`/`PLMatchValidation.getNotifications` y disparando `visibilitychange` sintéticos contra el bundle real servido (`04.10-h32`). Resultados verificados uno por uno:
  - **sesión local/no server-backed:** `Auth.isConfigured()` en `false` (estado real de este entorno sin `env.generated.js`) → el dispatch de `visibilitychange` no lanza ningún error y no hace ninguna llamada nueva (gate `isServerBackedSession()` correcto).
  - **sesión server-backed + regreso a foreground:** con `isConfigured` forzado a `true` y una cuenta `serverBacked:true` fabricada vía `Store.cacheServerUser` (no destructivo, solo localStorage del navegador embebido), un `visibilitychange` dispara exactamente 1 llamada a cada uno de los 3 mecanismos (matches/notificaciones/perfil).
  - **eventos duplicados cercanos:** 3 `visibilitychange` disparados casi simultáneamente colapsan en una única ronda de refresco (spies en 1/1/1, no 3/3/3).
  - **throttle no oculta una actualización legítima:** pasados los 2000 ms, un nuevo `visibilitychange` vuelve a refrescar con normalidad (spies en 1/1/1 de nuevo, no en 0).
  - **fallo de una lectura:** con `getMyMatches` devolviendo `{ok:false}` y `getNotifications` **lanzando** una excepción real, el cache de partidos existente (`Store.loadServerMatchesCache()`) quedó exactamente igual antes/después, y la app no se rompió ni bloqueó la navegación.
  - **Home abierto se repinta:** forzando `#view-player-home` visible y una notificación `pending_review` no leída en el servidor fabricado, el badge `#player-home-bell-badge` pasó de oculto/"0" a visible/"1" tras el `visibilitychange` — reproduce exactamente el síntoma reportado por Sebastián ("sin badge/notificación visible") y confirma que se corrige.
  - **Historial abierto se repinta:** forzando `#view-history` visible, el `visibilitychange` disparó `refreshServerMatches()` (spy de `getMyMatches` en 1) sin errores.
  - **Notificaciones abiertas:** cubierto por el mismo mecanismo (`renderNotificationsList`/`renderNotificationsBadge`, condicionado a `!$('#view-notifications').hidden)`, mismo patrón ya usado por `afterB6Action`/`openNotificationsScreen`.

**Estado del escenario tras esta corrección:** el fix de frescura queda implementado, testeado localmente y pusheado a `origin/staging`. **PENDIENTE DE VALIDACIÓN REAL EN IPHONE** — Sebastián debe comprobar físicamente, después del deploy, que volver del background con Home/Historial/Notificaciones ya abiertos muestra el partido pendiente de Esteban y el badge correspondiente sin necesitar recargar. **NO se marca el Escenario 1A como PASS** hasta esa comprobación física. **NO se avanza al siguiente escenario del laboratorio. NO se confirmó el partido actual** (Esteban + Matu vs Seba + Lucho, `pending_validation`, se conserva intacto en Supabase Staging).

### Hotfix post-h32 — 25/09/2026 (revisión central)

Dos correcciones puntuales encontradas por revisión central antes de habilitar la prueba física, ambas aplicadas sobre el mismo `04.10-h32` sin nuevo bump de `CACHE_NAME`:

1. **`CORE_ASSETS` de `bramulab/sw.js` seguía precacheando con `?v=04.10-h31`** mientras `CACHE_NAME` e `index.html` ya estaban en `h32` — contradecía el propio comentario del archivo ("estas dos listas de URLs no coinciden AL BYTE... pierde el offline-first"). Corregido: las 19 entradas de `CORE_ASSETS` (JS/CSS propios) ahora apuntan a `?v=04.10-h32`, igual que `index.html`. Sin tocar `CACHE_NAME` de nuevo.

2. **`refreshServerStateOnForeground()` hacía 2 lecturas de `get_notifications` en una sola vuelta a foreground cuando Home era la pantalla visible**: la propia función llamaba `refreshB6Notifications()` y después `renderPlayerHome()`, que YA refresca notificaciones por su cuenta (`refreshB6Notifications().then(renderNotificationsBadge)`, Bloque 6 Fase B, sin cambios). Corregido de la forma más simple posible: se calcula `homeVisible` al principio y la lectura explícita de notificaciones solo se hace `if (!homeVisible)` — cuando Home es la pantalla visible, se deja que `renderPlayerHome()` la haga sola (una sola lectura, badge igual de correcto). Cuando Historial/Notificaciones/ninguna pantalla relevante está visible, la lectura explícita sigue ocurriendo como antes (sin esa duplicación posible, porque `renderPlayerHome()` no se llama en esos casos). No se tocó `renderPlayerHome()`.

**Verificación (navegador embebido, spies sobre el bundle real):** con Home forzado visible y una notificación fabricada, `PLMatchValidation.getNotifications` pasó de 2 llamadas a **exactamente 1** por vuelta de foreground, y el badge `#player-home-bell-badge` siguió pasando correctamente de oculto/"" a visible/"1". Con Historial visible, se confirmó que sigue habiendo exactamente 1 llamada (sin regresión). `node --test` 255/255, `tests.html` 1478/1478.

Commit único de este hotfix pusheado a `origin/staging` sobre `ce7c020`. Sin tocar Supabase/`main`/Production/BRAMUlive. Partido de QA sin tocar.

### Corrección de fondo del mecanismo de actualización — 25/09/2026 (revisión central, V04.11)

**Evidencia real que motivó esta ronda:** en computadora, la misma cuenta Seba mostraba correctamente el banner de partido pendiente, badge en 1, Último partido y "TU TURNO: CONFIRMAR" — backend y lectura server-backed ya estaban bien. Pero en la PWA instalada del iPhone, ni un reinicio completo del teléfono ni reabrir desde el ícono sacaban a la app de Estado Cero, y el botón Herramientas → "Forzar actualización" no producía ningún efecto visible (ni "Actualizando…", ni recarga).

**Diagnóstico (causa raíz, no el fix funcional de `-h32`):**

1. `Store.VERSION`/`version.json` venían fijos en `"BRAMUlab V04.10"` durante varias rondas de Backend/Infraestructura (README §6: esa numeración es de Nivel BRAMU, Backend no la usa) — así que **ningún** bump de bundle intermedio (`-h27` a `-h32`) era detectable por un cliente que ya tenía ese string grabado: su `checkForNewVersion()` legacy solo compara `remoteVersion !== Store.VERSION`, y ambos decían "V04.10".
2. El fetch handler de `sw.js` aplicaba cache-first también a la **navegación del documento principal** — reabrir la PWA podía seguir sirviendo el `index.html`/shell viejo desde Cache Storage sin siquiera intentar la red primero.
3. `forceUpdateApp()` esperaba (`await`) un `registration.update()` sobre el service worker viejo ANTES de desregistrarlo — un riesgo real de cuelgue indefinido en WebKit/iOS con una registración ya rota, que hubiera bloqueado TODO el resto de la función (incluida la única línea que cambia visualmente el botón, aunque esa sea síncrona y corra antes).
4. `registration.update()`/`clients.claim()` no tenían ningún `controllerchange` escuchando del lado del documento — un SW nuevo podía tomar control sin que la pestaña YA ABIERTA recargara jamás para ejecutar los JS nuevos.

**Corrección implementada:**

- **Versión pública:** `"BRAMUlab V04.10"` → `"BRAMUlab V04.11"` (`Store.VERSION`, `version.json#version`) — deliberado y necesario: es la ÚNICA señal que el cliente V04.10 ya instalado en el iPhone puede leer con su propio código legacy para salir de su estado atascado. No se usó `V04.10.1` (README §6 no admite subversiones).
- **Versión técnica de bundle, separada:** `Store.BUNDLE_VERSION = '04.11'` (nuevo) + `version.json#bundle`. `checkForNewVersion()` ahora compara `bundle` primero cuando el remoto lo declara (detecta un futuro `04.11-h1` aunque la versión pública no se mueva) y cae al criterio legacy por `version` cuando no — el texto mostrado al usuario sigue siendo siempre la versión pública, nunca jerga interna.
- **Service worker — navegación:** el fetch handler separa un camino nuevo para `event.request.mode === 'navigate'` — red primero, actualiza la copia offline en éxito, cae al shell cacheado (con `./index.html` como último recurso) solo si la red falla de verdad. Los JS/CSS versionados conservan cache-first sin cambios.
- **Registro/actualización del SW:** `registerServiceWorker()` registra con `updateViaCache:'none'`, llama `registration.update()` explícito al boot, y agrega un listener de `controllerchange` que recarga la página **una sola vez** (guard en memoria) — y SOLO si la pestaña ya tenía un controller antes de este registro (evita un recargo innecesario en la primera instalación).
- **"Forzar actualización":** se quita el `r.update()` previo a `unregister()` (un botón que ya se llama "forzar" no necesita intentar actualizar lo viejo antes de tirarlo) y cada tramo de trabajo de SW/Cache Storage queda protegido por un timeout de 3s (`Promise.race`) — nunca deja la función colgada indefinidamente sea cual sea la causa real en el dispositivo. Sigue sin tocar `localStorage`/sesión/datos/Supabase.
- **Identificación de bundle (solo QA):** dentro de Herramientas de desarrollo (ya oculto en Production), una línea discreta `BRAMUlab V04.11 · bundle 04.11` (`#dev-tools-bundle-info`, completado por `refreshLabPreviewUI()`) — el problema real que motivó esto fue que Sebastián no tenía forma de saber si el iPhone corría el bundle viejo o el nuevo.
- **Bundle/caché alineados al byte:** `CACHE_NAME` (`bramulab-v04-11`, sufijo `-h` reiniciado por ser versión nueva, mismo criterio que V03.7) + las 19 entradas de `CORE_ASSETS` (`?v=04.11`) + `index.html` (mismas 19 query strings) + `version.json#bundle` + `Store.BUNDLE_VERSION` — sin repetir la inconsistencia h31/h32 de la ronda anterior.

**Root cause del botón sin feedback en el iPhone real:** no se pudo reproducir el caso exacto sin acceso físico al dispositivo, pero el riesgo identificado (un `registration.update()` colgado bloqueando todo lo demás) es real, suficiente para explicarlo, y queda corregido estructuralmente con el timeout-guard — independientemente de si esa fue la causa exacta.

**Limitación real de este entorno de pruebas:** el navegador embebido de esta sesión **no puede registrar un Service Worker real** (`navigator.serviceWorker.register(...)` falla con `"An unknown error occurred when fetching the script"`, reproducido con URL relativa y absoluta, sin relación con el contenido de `sw.js` — confirmado con `node --check` y lectura completa del archivo) — restricción de sandbox de este navegador embebido específico, no un bug del código. Por eso la verificación de esta ronda combina, según lo que cada pieza permite: pruebas reales contra el bundle servido (detección de versión/bundle, robustez de "Forzar actualización" ante un `getRegistrations()` que nunca resuelve) y simulación aislada fiel del patrón exacto usado en el código (guard de recarga única de `controllerchange`) para las piezas que dependen de un Service Worker realmente registrado. El comportamiento navigate-first del fetch handler y el ciclo real de `controllerchange` end-to-end quedan sin poder ejecutarse desde esta sesión — recomendado verificarlos como parte de la validación física en iPhone (además del propio Escenario 1A).

**Pruebas realizadas (navegador embebido, contra el bundle real servido en `04.11`):**

- **Migración legacy (el caso central pedido):** se confirmó analíticamente y por comparación de strings que un cliente V04.10 real (cuyo `checkForNewVersion()` shippeado solo compara `remoteVersion !== Store.VERSION`) detecta la actualización apenas `version.json` pasa a decir `"BRAMUlab V04.11"` — `"BRAMUlab V04.11" !== "BRAMUlab V04.10"` es `true` por construcción; ese cliente no conoce `bundle`, así que no necesita ese campo para salir de su estado atascado.
- **Detección por bundle con versión pública igual** (el caso "futuro `04.11-h1`"): con `version.json` fabricado `{version:"BRAMUlab V04.11", bundle:"04.11-h1"}` (misma versión pública, bundle distinto), el cartel de actualización se mostró igual, con el texto correcto ("BRAMUlab V04.11 está disponible.", nunca jerga de bundle) y la clave de descarte interna (`dataset.version`) usando el bundle.
- **Sin actualización real:** con `version.json` idéntico al propio (`{version:"BRAMUlab V04.11", bundle:"04.11"}`), el cartel NO se mostró.
- **Fallback legacy real:** con `Store.BUNDLE_VERSION` eliminado temporalmente (simulando un cliente sin ese campo) y un `version.json` con ambos campos distintos, la detección cayó correctamente al criterio por versión pública.
- **"Forzar actualización" no puede quedar colgado:** con `navigator.serviceWorker.getRegistrations` reemplazado por una promesa que NUNCA resuelve, el click igual completó y navegó a la URL cache-busteada (confirmado por la propia navegación real de la pestaña) — sin el fix, el `await r.update()` serial de la versión anterior podía quedarse esperando para siempre en ese mismo punto.
- **Guard de recarga única de `controllerchange`:** simulado con un `EventTarget` fiel al patrón real (`hadControllerBeforeRegister` + bandera `reloaded`) — sin controller previo (primera instalación), 0 recargas ante `controllerchange`; con controller previo (actualización real), exactamente 1 recarga aunque el evento se dispare 3 veces seguidas.
- **Identificación de bundle en Herramientas:** confirmado visualmente (`BRAMULAB V04.11 · BUNDLE 04.11`, dentro del modal ya oculto en Production).
- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS**.
- `bramulab/tests.html` → **1478/1478 PASS**.

**Estado del escenario:** el mecanismo de actualización queda corregido de fondo y pusheado a `origin/staging` (bundle `04.11`, versión pública `BRAMUlab V04.11`). **El Escenario 1A sigue PENDIENTE** — ni el fix de frescura de `-h32` ni este hotfix de actualización fueron validados todavía en el iPhone físico de Sebastián; esa comprobación (incluyendo que el cliente viejo detecte V04.11, actualice conservando sesión/datos, y termine ejecutando el bundle nuevo identificable en Herramientas) es el paso siguiente antes de marcar PASS. **No se avanza a 1B. No se confirmó el partido actual** (Esteban + Matu vs Seba + Lucho, `pending_validation`, intacto en Supabase Staging). Sin tocar Supabase/`main`/Production/BRAMUlive/cuentas QA/Bloques Backend 1–8.

### Corrección de "sesión fantasma" server-backed — 25/09/2026 (revisión central, bundle 04.11-h1)

**Evidencia real confirmada por logs de Supabase:** en la PWA instalada del iPhone, aproximadamente 05:30–05:32 UTC, `get_my_matches`/`get_notifications`/`get_home_ranking_insight` y otras RPC server-backed devolvieron **401** — las requests llegaban con la publishable key de la app pero **sin JWT autenticado**. En el cliente que sí mostraba correctamente el partido (computadora), las mismas RPC devolvían 200 con un JWT real cuyo `auth.uid()` correspondía a la cuenta canónica Seba/@seba_qa. Backend y partido están correctos — el problema es enteramente de coherencia de sesión en el cliente.

**Síntoma UX:** la PWA sin sesión real seguía mostrando "Seba / @seba_qa / Nivel 5.9 / Home normal" — pero con avatar genérico, 0 partidos, sin pendiente y sin badge. Es decir: pintaba datos **cacheados** como si la cuenta siguiera autenticada, en vez de detectar que la sesión real ya no existía.

**Causa en código:**

1. `isServerBackedSession()` (gate usado en toda la app) solo comprueba `Auth.isConfigured() && Store.getCurrentUser() && user.serverBacked` — nunca confirma que exista una sesión Supabase viva. Un `user.serverBacked:true` cacheado por `Store` puede sobrevivir indefinidamente a la sesión real (revocada, expirada, o simplemente inexistente tras reinstalar/limpiar parcialmente el dispositivo).
2. `bootWithServerSession()`, cuando `Auth.getSession()` devolvía `null`, caía directo a `bootDefaultScreen()` — que abre Home leyendo `Store.getCurrentUser()` sin ningún chequeo adicional. Si Store todavía tenía una cuenta `serverBacked:true` como "actual", Home se abría igual, en un estado falso de login.
3. Ni `bootWithServerSession()` ni el resto de la app volvían a comprobar la sesión real en ningún otro momento — una sesión que muriera con la app ya abierta (o entre una apertura y la siguiente) nunca se detectaba, y cada vuelta a foreground seguía disparando RPCs condenadas al 401 en silencio.

**Corrección implementada** (frontend únicamente, sin tocar Supabase/schema/RPCs):

- **Nueva `exitGhostServerSession(cachedUser)`** (`bramulab/app.js`, junto a `doLogout`): reutiliza EXACTAMENTE el mismo mecanismo ya usado por "Cerrar sesión" — `Store.logoutSession()` borra ÚNICAMENTE el puntero de sesión activa + `CURRENT_PLAYER`, nunca Historial/USERS/match cache/outbox/Nivel/foto/preferencias. Además llama `Auth.signOut()` (best-effort) y lleva a la pantalla de Login con `#login-error` mostrando *"Tu sesión venció. Volvé a ingresar para sincronizar tus datos."*, con el email cacheado prellenado (nunca la contraseña, nunca login automático).
- **`bootWithServerSession()`**: cuando `Auth.getSession()` resuelve explícitamente en `null` (no un fallo de red — ver más abajo) y `Store.getCurrentUser()` sigue siendo `serverBacked:true`, llama a `exitGhostServerSession()` en vez de `bootDefaultScreen()`.
- **`refreshServerStateOnForeground()`**: agrega el mismo chequeo de sesión real ANTES de disparar cualquier RPC server-backed (matches/notificaciones/perfil) — si la sesión ya murió mientras la app estaba abierta o en background, sale a la sesión fantasma en ese mismo momento, sin ejecutar ninguna RPC condenada al 401.
- **Distinción offline vs. sesión vencida (requisito explícito):** ambos puntos usan el mismo patrón — `sessionCheckFailed` distingue "`Auth.getSession()` confirmó que no hay sesión" de "no pudimos ni preguntar" (falla de red transitoria al intentar el chequeo). Solo el primer caso dispara `exitGhostServerSession()`; el segundo cae al camino "mejor esfuerzo" de siempre (nunca expulsa a nadie por falta de conexión momentánea).
- **`isServerBackedSession()` se deja síncrona a propósito** (no se convirtió en `async`, evitando reescribir media app) — se documentó explícitamente la precondición de la que depende: mientras `bootWithServerSession()`/`refreshServerStateOnForeground()` sigan verificando la sesión real y saliendo con `exitGhostServerSession()` cuando corresponda, este gate puede confiar en que un `serverBacked:true` cacheado por `Store` siempre tiene sesión real detrás.
- **No se creó ningún listener `onAuthStateChange` nuevo** — de las dos opciones aceptables del pedido, se optó solo por el chequeo en boot/foreground (ya cubre el caso combinado "sesión perdida + regreso a foreground" pedido explícitamente) para evitar el riesgo real de que un listener global de `SIGNED_OUT` se disparara también durante un `doLogout()` manual normal (que ya llama `Auth.signOut()`) y compitiera/duplicara trabajo con esa salida ya correcta — mantiene la solución más simple posible sin arquitectura nueva.

**Bundle:** primer uso real del mecanismo de bundle independiente introducido en la ronda anterior — `Store.BUNDLE_VERSION`/`version.json#bundle`/`CACHE_NAME`/`CORE_ASSETS`/query strings de `index.html` pasan de `04.11` a **`04.11-h1`**, manteniendo `Store.VERSION`/`version.json#version` fijos en `"BRAMUlab V04.11"` (esto no es una ronda nueva de producto).

**Pruebas realizadas (navegador embebido, contra el bundle real servido en `04.11-h1`, spies reales sobre `PLAuth`/`PLMatches`/`PLMatchValidation`):**

- **Sesión fantasma real** (`Auth.getSession()` resuelve `null`, cuenta `serverBacked:true` cacheada): con Home visible, disparar `visibilitychange` resultó en **cero** llamadas a `getMyMatches`/`getNotifications`/`fetchOwnProfile` (ninguna RPC condenada al 401), `Auth.signOut()` invocado, `Store.getCurrentUser()` pasó a `null`, la app navegó a Login con `#login-error` mostrando el texto exacto y `#login-email` prellenado con el email cacheado — y el cache de partidos (`Store.loadServerMatchesCache()`), el historial (`bramulab.history.v1`) y la lista completa de usuarios (`bramulab.users.v1`, con el mismo registro `serverBacked` intacto) quedaron **exactamente iguales** antes y después.
- **Sin loop:** un segundo `visibilitychange` disparado después de la salida no volvió a llamar `Auth.signOut()` ni a ninguna RPC — `isServerBackedSession()` ya devuelve `false` en el gate inicial apenas la sesión local se limpió.
- **Sesión válida (sin regresión):** con `Auth.getSession()` resolviendo un objeto de sesión real, las tres llamadas (matches/notificaciones/perfil) se dispararon exactamente una vez cada una, el usuario siguió logueado y no hubo navegación a Login.
- **Falla de red transitoria al chequear la sesión** (`Auth.getSession()` lanza una excepción real): la app NO lo confundió con sesión vencida — el usuario permaneció logueado, no hubo navegación a Login ni `signOut`, y el resto del refresco "mejor esfuerzo" igual se intentó (mismo criterio de tolerancia a fallas parciales de la ronda anterior).
- **Cuenta local/no-server-backed:** `Auth.getSession()` ni siquiera se llamó (el gate `isServerBackedSession()` corta antes) — cero cambios de comportamiento.
- QA visual manual (navegador embebido, cuenta local real vía UI): alta + login normal sin regresión, footer mostrando `BRAMUlab V04.11` correctamente.
- `node --test bramulab/*.test.mjs bramulab/scripts/*.test.mjs` → **255/255 PASS**.
- `bramulab/tests.html` → **1478/1478 PASS**.

**No verificado desde esta sesión** (requiere la MISMA limitación de sandbox de Service Worker ya documentada arriba, o acceso físico real): el camino completo de `bootWithServerSession()` contra un arranque en frío real con `env.generated.js`/Supabase real configurado — se verificó exhaustivamente el camino gemelo de `refreshServerStateOnForeground()` (misma lógica compartida, misma función `exitGhostServerSession`), y se trazó por lectura que `bootWithServerSession()` usa el patrón idéntico; y el re-login real de la misma cuenta recuperando `player_id`/match cache server-backed (comportamiento preexistente de `resumeServerSession`/`Store.cacheServerUser`, no tocado en esta ronda, verificado por trazado de código: `cacheServerUser` reemplaza por `id` en vez de duplicar).

**Estado del escenario:** corrección de sesión fantasma pusheada a `origin/staging` (bundle `04.11-h1`, versión pública sin cambios). **El Escenario 1A sigue PENDIENTE** — se suma esta corrección a la lista de comportamientos a validar físicamente en el iPhone de Sebastián (además de la frescura de `-h32` y el mecanismo de actualización de V04.11): que al reabrir la PWA con la sesión real ya vencida, la app lleve a Login con el mensaje correcto en vez de mostrar un Home falso, y que un re-login real recupere todo el estado server-backed. **No se marca PASS. No se avanza a 1B. No se confirmó el partido actual** (Esteban + Matu vs Seba + Lucho, `pending_validation`, intacto). Sin tocar Supabase/schema/RPCs/`main`/Production/BRAMUlive/cuentas QA/Bloques Backend 1–8.


### 15.2 — Revisión UX del pendiente accionable / Resumen / correcciones — 25/09/2026

**Contexto:** Escenario 1A ya visible correctamente en iPhone tras resolver la sesión fantasma. Partido: Esteban + Matu vs Seba + Lucho, 6–4 / 6–3, `pending_validation`, acción del lado de Seba/Lucho.

#### Hallazgos confirmados

**Home con pendiente**
- **NO TOCAR en lo esencial:** el destacado superior comunica bien que existe un partido pendiente y convive correctamente con la Home.
- **UX / VISUAL:** el CTA grande `REVISAR` agranda demasiado la tarjeta. Dirección preferida: toda la tarjeta tappable y una indicación de acción mucho más discreta, sin convertir `Confirmar` en CTA directo porque antes debe revisarse el resultado.
- **YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA:** la notificación debe nombrar al actor que cargó el partido; hoy el texto genérico no lo hace.
- **UX / COPY:** con un partido pendiente ya existente, `0 partidos en tu historia` y `Tu historia empieza acá. Cargá tu primer partido...` resultan incoherentes. Debe distinguirse 0 partidos oficiales de existencia de actividad pendiente.

**Headers / blur**
- **UX / VISUAL / posible bug visual transversal:** en Home y especialmente en Cargar partido, el degradé/fade superior invade logo/títulos y produce un blur perceptible. Revisar como patrón global, no pantalla por pantalla.

**Resumen del partido**
- **YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA:** debe mostrar de forma sutil quién cargó el partido. Dirección visual preferida: metadata tipo `Cargado por Esteban · 24 SEP 26 · 21:30` y debajo formato (`Clásico · Punto de Oro`), en lugar de mezclar `TU TURNO: CONFIRMAR` con fecha/formato.
- **UX / VISUAL:** eliminar el banner redundante `Te toca confirmar este resultado.` si el botón principal ya expresa claramente la acción.
- **BUG VISUAL:** la fila inferior del score (Esteban / Matu + games) queda ópticamente corrida hacia arriba respecto de la fila Seba / Lucho. Revisar alineación vertical.
- **COPY:** mantener `CONFIRMAR PARTIDO` como acción principal. El usuario confirma; BRAMU valida/oficializa.
- **PRODUCTO / UX — propuesta fuerte del laboratorio:** reemplazar la acción secundaria visible `PROPONER CORRECCIÓN` por un concepto más natural tipo `HAY UN ERROR`, que luego pregunte qué está mal.

**BRAMU Intelligence**
- **NO TOCAR en contenido general:** las lecturas del primer partido se perciben útiles y coherentes.
- **PRODUCTO / UX — propuesta:** evitar repetir `+ POR QUÉ APARECE` debajo de cada lectura. Evaluar un único acceso al final del bloque que agrupe la evidencia factual de todas las lecturas, preservando la transparencia definida en BRAMU Intelligence.

**Ocultar partido**
- **UX / VISUAL:** la acción al final del Resumen tiene demasiado protagonismo/ubicación poco natural. Evaluar moverla a una acción contextual del partido (p. ej. menú/ícono) sin decidir todavía el patrón exacto.

**Historial**
- **YA DEFINIDO + UX / VISUAL:** el estado debe comunicar `PENDIENTE DE VALIDACIÓN` (o equivalente) como estado del partido; la condición accionable debe resolverse mediante acento/jerarquía visual, no convertir el estado principal en `TU TURNO: CONFIRMAR`.
- El acento lima/verde para pendiente accionable se mantiene alineado con la fuente vigente.

#### Corrección de resultado — limitación detectada

La hoja actual `PROPONER CORRECCIÓN`:
- usa una composición visual distinta del flujo `Cargar partido`;
- solo permite editar la cantidad de sets que ya existen;
- en un partido cargado con 2 sets no permite proponer un tercer set.

**Clasificación:** BUG FUNCIONAL / IMPLEMENTACIÓN INCOMPLETA + UX / VISUAL.

La fuente vigente ya establece que mientras el partido está pendiente una corrección puede abarcar:
- resultado/sets;
- participantes;
- fecha u otro dato editable cuando corresponda.

**Dirección preferida:** reutilizar la lógica/composición ya aprendida en `Cargar partido` para editar el resultado, prellenada con los datos actuales y permitiendo agregar/quitar sets según las reglas del formato. No crear un segundo lenguaje de edición del score.

#### Identidad incorrecta / `No participé`

La UI actual abre:
1. selector `¿Quién no participó?` con los cuatro lugares del partido;
2. confirmación destructiva `¿Confirmás que no participó?`.

**UX / VISUAL:** hoy el selector usa un modal central mientras `Proponer corrección` usa bottom sheet. La coherencia futura debe ser por tipo de tarea: selección/edición puede resolverse con un patrón común (preferentemente sheet); una confirmación final de una acción de alto impacto puede seguir usando diálogo/modal.

**PRODUCTO / UX — propuesta fuerte:** integrar identidad incorrecta dentro del paraguas `HAY UN ERROR`. Desde ahí, ofrecer categorías del error (resultado / participante / otros datos editables cuando corresponda) y derivar al flujo específico.

**DECISIÓN ABIERTA — autor del partido cuestionado:** la UI actual permite marcar como identidad incorrecta también al jugador que creó el partido. No cerrar aún una exclusión visual. La documentación vigente separa autoría y participación, y permite que cualquier participante detecte una identidad incorrecta. Debe definirse explícitamente el tratamiento del caso en que el autor original deja de ser participante tras una corrección, preservando trazabilidad y sin volver incorregible una carga errónea o fraudulenta.

**Estado del escenario:** no se envió corrección ni incidencia de identidad. El partido sigue intacto y pendiente. No avanzar todavía a 1B hasta completar la decisión/recorrido de confirmación del Escenario 1A.


### 15.3 — Escenario 1A después de confirmar — 25/09/2026

**Resultado funcional:** el partido Esteban + Matu vs Seba + Lucho pasó correctamente a oficial. En Seba:
- Nivel 5.9 → 5.8;
- calibración 0/5 → 1/5;
- Historial pasó a 1 partido;
- Home habilitó Actividad, Efectividad, Racha + Partidos totales;
- Mi Perfil reflejó 1 partido y calibración 1/5.

**NO TOCAR en lo esencial:** la progresión de Home y Mi Perfil después del primer partido válido funciona y se entiende.

**UX / VISUAL — estado normal oficial:** no repetir `VALIDADO` / `Partido oficial` como badge o banner persistente en Último partido, Historial y Resumen. Una vez oficial, ese es el estado normal; reservar estados visibles para excepciones o tareas (pendiente, corrección, identidad cuestionada, expirado, etc.). Puede existir feedback transitorio al confirmar.

**Resumen / trazabilidad:** reemplazar metadata redundante por trazabilidad útil. Dirección: mostrar de forma sutil quién cargó el partido y quién confirmó la versión que lo volvió oficial, además de fecha/hora y formato. Ejemplo conceptual: `Cargado por Esteban · 24 SEP 26 · 21:30` / `Clásico · Punto de Oro` / `Confirmado por Seba`.

**Corrección post-validación:** mantener acceso mientras la ventana vigente lo permita, pero dentro del rediseño propuesto bajo una acción secundaria más natural. Naming preferido para evaluar: `REPORTAR UN ERROR`, que luego pregunta qué dato está mal; comunica mejor que `Proponer corrección` y mejor que el texto aislado `Hay un error`.

**Notificaciones:** la notificación generada por la propia acción de Seba (`Partido oficial · Tu partido ya quedó validado`) se percibe redundante. Dirección: no notificar al actor por una acción que acaba de ejecutar. Sí conservar información para los demás participantes cuando una acción ajena cambia el estado, nombrando al actor y dando contexto suficiente del partido.

**TU MOMENTO — copy incorrecto:** después de este partido dice `ya cargaste tu primer partido`, pero Seba no lo cargó; lo cargó Esteban. Debe hablar de historia/registro, no atribuir la carga al usuario. Dirección: `Tu primer partido ya forma parte de tu historia` o equivalente. No hace falta narrar la derrota aquí; TU MOMENTO sigue siendo una superficie liviana, distinta de BRAMU Intelligence.

**Historial — navegación redundante detectada:** en el producto vigente BRAMUlab solo registra partidos propios; la categoría de partidos observados fue retirada. Por eso `Todos` y `Mis partidos` muestran hoy el mismo universo en el camino real y resultan redundantes. Revisar eliminación/simplificación de estas tabs en la ronda visual; conservar filtros contextuales solo cuando aporten una distinción real.

**Estado Escenario 1A:** recorrido funcional principal completado desde carga rival → pendiente accionable → confirmación → partido oficial. Quedan hallazgos UX/visuales documentados para consolidación antes de la siguiente ronda de implementación.


### 15.4 — Escenario 1B, lado autor antes de validación — 25/09/2026

**Partido cargado por Seba:** Seba + Gusti vs Esteban + Jona, 6–3 / 6–4. Estado actual: `PENDIENTE DE VALIDACIÓN`.

#### Cargar partido

- **NO TOCAR en lo esencial:** composición general de Cargar partido, tarjetas Equipo A/B, carga de sets, `Resultado válido`, paso `CONTINUAR` y pantalla final `CONFIRMAR PARTIDO` se perciben coherentes y ya suficientemente validados para esta ronda.
- **UX / IMPLEMENTACIÓN INCOMPLETA:** al elegir compañero/rivales en una sesión server-backed, el selector no muestra jugadores recientes pese a que Seba ya compartió un partido oficial con Lucho, Esteban y Matu. En el flujo local/legacy existía el patrón `RECIENTES`, pero el camino server-backed actual oculta esa sección y obliga a buscar por texto.
- **DIRECCIÓN CONFIRMADA:** el selector debe aprovechar relaciones reales ya existentes para ofrecer jugadores recientes/frecuentes antes de obligar a buscar. Como mínimo, participantes de partidos previos del usuario que sean identidades registradas y válidas; sin duplicarlos luego en resultados de búsqueda.

#### Resumen del autor mientras espera validación

- **NO TOCAR en lo esencial:** el mensaje `Esperando que Esteban / Jona confirme este resultado.` se entiende y es apropiado para el lado que cargó el partido.
- Los pendientes no alimentan estadísticas oficiales: Efectividad, Actividad, Racha, Partidos totales y calibración permanecen basados únicamente en partidos oficiales. Comportamiento correcto.

#### Home / Historial con pendiente no accionable

- **UX / VISUAL:** `PENDIENTE DE VALIDACIÓN` está correctamente presente, pero en Home queda demasiado pegado al badge de resultado (`VICTORIA`). Dirección a evaluar: separar visualmente resultado y estado del partido, llevando el estado a la zona de metadata/fecha o a una segunda línea clara.
- Aplicar el mismo criterio en Historial: estado del partido separado del resultado, con tratamiento neutro para pendientes que esperan a la otra pareja.
- **NO TOCAR:** tocar la tarjeta abre el Resumen correctamente.
- **NO TOCAR:** el pendiente se ve en Home/Historial pero no altera estadísticas oficiales.

**Estado del escenario:** falta revisar el mismo partido desde la cuenta rival Esteban y luego validar desde ese lado. No confirmar todavía desde Work hasta registrar primero Home / Notificaciones / Historial / Resumen de Esteban.


### 15.5 — Escenario 1B, lado rival accionable antes de confirmar — 25/09/2026

Work, con sesión estable Esteban/@esteban_qa, abrió BRAMUlab y el nuevo pendiente apareció de forma natural, sin refresh manual.

**Home**
- Banner: `PARTIDO PENDIENTE — Seba / Gusti registró un partido en el que participaste. REVISAR`.
- Último partido: derrota para Esteban/Jona, estado `TU TURNO: CONFIRMAR`.
- **FRESCURA:** PASS en navegador/Work para aparición natural del pendiente.
- **COPY:** revisar concordancia/naming del actor: `Seba / Gusti registró` mezcla una pareja con verbo singular y además no identifica necesariamente al autor real de la carga. La fuente vigente pide nombrar al actor que cargó el partido, no a la pareja genéricamente.

**Notificaciones**
- `Partido pendiente — Tenés un partido esperando tu confirmación.`
- Badge total observado: 2.
- **YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA:** sigue faltando nombrar al actor y dar contexto suficiente del partido.

**Historial**
- Partido visible como Seba/Gusti vs Esteban/Jona, 6–3 / 6–4.
- Estado accionable `TU TURNO: CONFIRMAR`.
- Se mantiene la dirección ya documentada: estado principal `PENDIENTE DE VALIDACIÓN` + jerarquía visual accionable, en vez de usar la acción como nombre de estado.

**Resumen**
- Ganadores Seba/Gusti, sets 2–0, games 12–7.
- Mensaje `Te toca confirmar este resultado.`.
- Acciones visibles: Confirmar / Proponer corrección / No participé.
- Sin cambios nuevos respecto de hallazgos ya documentados en 15.2.

**Estado del escenario:** Esteban quedó detenido en el Resumen sin confirmar. Próximo paso: confirmar desde Esteban y validar en iPhone de Seba que el cambio remoto a oficial aparezca al volver a foreground, sin refresh manual.


### 15.6 — Escenario 1B completado — 25/09/2026

- Flujo probado: carga propia → pendiente → confirmación remota → regreso a foreground en iPhone.
- PASS funcional: el iPhone actualizó el partido a oficial sin refresh manual y recalculó Home, Historial, Perfil, Nivel/calibración y estadísticas.
- Frescura foreground: validada en caso real con acción remota desde otra cuenta.
- Notificación remota: corresponde informar al usuario afectado, pero el copy actual `Partido oficial · Tu partido ya quedó validado` es demasiado genérico. Debe nombrar actor y dar contexto suficiente del partido.
- Estado normal oficial: se confirma que `VALIDADO` / `Partido oficial` son redundantes como etiquetas persistentes en Home, Historial y Resumen. Mantener feedback transitorio y usar en detalle trazabilidad útil (`Cargado por…`, `Confirmado por…`).
- TU MOMENTO con dos partidos (`Tu historia empezó a construirse…`) funciona mejor que el copy anterior y no atribuye incorrectamente la carga al usuario.

**Estado:** Escenario 1B COMPLETADO.


### 15.7 — Escenario 1C, corrección pre-validación real — 25/09/2026

**Partido:** Matu + Diego vs Seba + Pablito. Carga original intencional: 6–4 / 6–3 para Matu/Diego. Corrección propuesta desde Seba: segundo set 6–4 para Matu/Diego.

#### Cargar partido — metadata
- **UX / VISUAL — propuesta:** evaluar compactar formato + puntuación + fecha/hora y llevar esa metadata arriba de Equipo A, antes de cargar jugadores/sets. Hoy ocupa dos tarjetas anchas de baja densidad informativa. No cerrar layout exacto todavía; revisar dentro de la ronda visual de Cargar partido.

#### Feedback al proponer corrección
- En uso real, después de enviar la corrección el usuario no percibió una confirmación suficientemente clara de que la propuesta se hubiera enviado; el cambio principal visible fue pasar a “Esperando que Matu / Diego confirme este resultado”.
- El código actual intenta mostrar un toast `Corrección propuesta.`, pero en la prueba real pasó inadvertido.
- **UX / VISUAL:** reforzar feedback de éxito sin agregar una pantalla innecesaria. Debe quedar inequívoco que la corrección fue enviada y que ahora espera a la otra pareja.

#### Copy/evento incorrecto tras una corrección
- Del lado Matu, Home mostró `PARTIDO PENDIENTE — Seba / Pablito registró un partido en el que participaste.`
- **BUG / YA DEFINIDO INCOMPLETO:** no fue una nueva carga; fue una corrección propuesta. El texto debe diferenciar creación de partido vs. propuesta de corrección y nombrar al actor real, no a la pareja genéricamente.

#### BUG de perspectiva del score en tarjetas compactas
Se verificó server-side en Staging, sin modificar datos:
- revisión vigente = corrección propuesta;
- Equipo A canónico: Seba/Pablito;
- Equipo B canónico: Matu/Diego;
- sets canónicos vigentes: 4–6 / 4–6.

Eso equivale correctamente a 6–4 / 6–4 desde la perspectiva de Matu/Diego.

Sin embargo, en Home de Matu la tarjeta compacta muestra:
- nombres: `Matu / Diego vs Seba / Pablito`;
- score: `4–6 · 4–6`.

**Clasificación: BUG FUNCIONAL DE PRESENTACIÓN / ORIENTACIÓN**, no corrupción de backend. La tarjeta pone la pareja del usuario primero pero no invierte el score canónico cuando su pareja es Team B.

El Resumen detallado sí muestra correctamente:
- Seba/Pablito: 4, 4;
- Matu/Diego: 6, 6.

Revisar también Historial y cualquier otra superficie compacta que componga “mi pareja primero” + score line.

#### UX de recibir una corrección
- El Resumen de Matu vuelve a mostrar el flujo genérico `Te toca confirmar este resultado` + `CONFIRMAR PARTIDO`.
- **PRODUCTO / UX:** cuando la revisión vigente proviene de una corrección, debe explicitarlo. Dirección preferida: `Seba propuso una corrección` y mostrar de forma compacta qué cambió (por ejemplo, Set 2: 6–3 → 6–4) antes de pedir confirmación.
- No convertir la corrección en una edición silenciosa: preservar conversación entre parejas y trazabilidad append-only.

**Estado del escenario:** NO confirmar todavía desde Matu hasta revisar la orientación en Historial y dejar registrado el bug. Backend vigente contiene la corrección correcta.


#### Resolución de perspectiva en tarjetas personales — CONFIRMADO

Las superficies personales compactas de BRAMUlab deben presentar el partido desde la perspectiva del usuario actual.

Aplicar al menos a:
- Último partido en Home;
- filas/tarjetas de Historial;
- cualquier futura lista personal equivalente.

Regla:
- la pareja del usuario aparece primero;
- el rival aparece segundo;
- el score se orienta en el mismo sentido que ese orden.

Ejemplo para Matu en el partido Matu/Diego vs Seba/Pablito:
- correcto: `Matu / Diego vs Seba / Pablito` + `6–4 · 6–4`;
- incorrecto: mostrar a Matu primero pero conservar score canónico `4–6 · 4–6`;
- incorrecto también: dejar a Seba/Pablito primero en Historial solo porque son Team A canónico.

El Resumen/detalle compartido puede conservar un orden canónico estable para trazabilidad; esta decisión se refiere a superficies personales compactas.

**Clasificación:** PRODUCTO / UX confirmado + BUG DE PRESENTACIÓN en implementación actual.

#### Reclamo / compartir — aclaración vigente

El reclamo de actividad existe conceptualmente para identidades provisionales:
- se realiza mediante link/token explícito asociado a la identidad provisional;
- el link pertenece a la identidad, no a un partido aislado;
- al reclamarla, la cuenta adopta ese `player_id` y recupera su historial asociado;
- no existe matching automático por nombre.

El escenario actual usa cuatro cuentas reales, por lo que no ejercita ese flujo.

Separadamente, `Recordar por WhatsApp` con deep link a un partido pendiente sigue siendo una propuesta futura no cerrada.

**Pendiente de Laboratorio:** crear más adelante un escenario específico con identidad provisional para revisar visualmente invitación/reclamo, sin mezclarlo con el flujo normal de corrección actual.


### 15.8 — Escenario 1C completado + criterio de Notificaciones — 25/09/2026

**Cierre funcional del escenario 1C**
- Matu cargó Matu/Diego vs Seba/Pablito con 6–4 / 6–3.
- Seba propuso corrección pre-validación: segundo set 6–4.
- Matu confirmó la revisión corregida.
- El partido quedó oficial con el resultado correcto.
- Al volver a foreground en iPhone, Seba primero mostró brevemente el snapshot pendiente y luego convergió solo al estado oficial, actualizando Nivel/calibración/estadísticas.
- Frescura server-backed: PASS nuevamente.

**Resultado final observado en Seba**
- calibración 3/5;
- 3 partidos en historial;
- Efectividad 33%;
- Último partido 4–6 / 4–6 desde su perspectiva;
- el resto de estadísticas oficiales se actualizó correctamente.

#### Notificaciones — criterio de producto para revisar/implementar

La prueba dejó tres tarjetas genéricas `Partido oficial · Tu partido ya quedó validado.`, que no permiten distinguir qué pasó ni quién actuó.

**Confirmado por fuente vigente:**
- una tarea pendiente accionable debe permanecer en Notificaciones hasta resolverse;
- cuando otro integrante de la pareja resuelve esa tarea, debe desaparecer para ambos;
- las notificaciones de acciones relevantes deben nombrar al actor.

**Dirección UX confirmada para la ronda de implementación:**
1. **Tareas accionables**: persisten aunque el usuario las haya leído, hasta que la tarea se resuelva. Leer no equivale a resolver.
2. **Al resolverse una tarea**: desaparece la notificación-tarea. Si la resolución fue una acción remota relevante, puede quedar una notificación informativa contextual.
3. **Acciones propias**: no generar una notificación informativa para el mismo actor.
4. **Informativas leídas**: no borrarlas instantáneamente al abrir; conservarlas como historial reciente, pero sin badge y con menor jerarquía visual.
5. **Contexto obligatorio**: evitar textos genéricos repetidos. Ejemplos conceptuales:
   - `Esteban confirmó tu partido con Gusti.`
   - `Matu aceptó la corrección del partido con Pablito.`
   - `Seba propuso una corrección en el partido.`
6. **Badge**: cuenta pendientes/no leídas vigentes, no tarjetas históricas ya leídas.
7. **“Marcar todas como leídas”**: mantener solo si existen informativas no leídas; no debe esconder ni resolver tareas accionables.

No se fija todavía una política temporal de borrado automático de informativas leídas (7/30 días, etc.); no es necesaria para validar la experiencia central.

**Estado:** Escenario 1C COMPLETADO. Los problemas restantes de esta ronda son de UX/presentación/copy y quedan para consolidación; no bloquean continuar el Laboratorio.


### 15.9 — Semántica visual de Último partido — propuesta de Laboratorio

**UX / VISUAL — PROPUESTA:** el contorno destacado de la tarjeta `Último partido` no debería permanecer verde cuando el resultado oficial fue una derrota, porque entra en conflicto semántico con el badge `DERROTA`.

Dirección a evaluar:
- partido oficial ganado: contorno/acento verde sutil;
- partido oficial perdido: contorno/acento rojo sutil;
- pendiente accionable: el estado de acción prima sobre el resultado y puede conservar acento lima;
- pendiente en espera: tratamiento más neutro;
- evitar un glow rojo excesivo o punitivo: debe comunicar resultado, no dramatizarlo.

Esta propuesta se revisará junto con la separación ya definida entre **resultado** y **estado del partido**.


### 15.10 — Escenario 1D, identidad incorrecta: reporte desde el jugador afectado — 25/09/2026

**Partido de prueba:** Matu + Gusti vs Seba + Diego, 6–2 / 6–2 para Matu/Gusti. En la simulación, Seba fue cargado por error y el jugador correcto será Pablito.

#### Lado Seba — reporte `No participé`

- El pendiente apareció correctamente en Home como accionable.
- Seba abrió el partido, eligió `No participé`, seleccionó su propia identidad y confirmó.
- La UI mostró feedback `Identidad cuestionada`.
- Inmediatamente después, el partido dejó de aparecer en Home/Historial de Seba.
- El contador de notificaciones bajó al resolverse su tarea.

**CLASIFICACIÓN: COMPORTAMIENTO CORRECTO / YA DEFINIDO.**
La fuente vigente establece que, una vez cuestionada una identidad, el partido no debe seguir pegado a la persona incorrecta. Como el partido todavía no era oficial, tampoco había afectado estadísticas/Nivel/calibración; esas métricas de Seba permanecieron en sus 3 partidos oficiales previos.

**NO TOCAR en lo esencial:** que el partido desaparezca de las superficies personales de Seba después de declarar que no participó es coherente con la regla de identidad. El partido sigue existiendo para los participantes válidos y debe continuar pendiente hasta identificar el reemplazo correcto.

**UX / feedback:** `Identidad cuestionada` se percibe como feedback breve y útil tras confirmar la incidencia. Revisar solo su coherencia visual con los demás toasts/modales de acciones sensibles.

**Próximo paso:** revisar cómo recibe Matu la incidencia y cómo se presenta el reemplazo del slot cuestionado antes de actuar.


### 15.11 — Escenario 1D, resolución de identidad desde Matu — 25/09/2026

**Estado previo:** Seba reportó `No participé` en Matu + Gusti vs Seba + Diego. El slot de Seba quedó cuestionado y el partido dejó de aparecer en las superficies personales de Seba.

#### Home / Historial de Matu con identidad cuestionada

- Historial mostró el partido con `IDENTIDAD CUESTIONADA` y el slot `Por identificar / Diego`.
- Home mostró la misma incidencia en Último partido.
- **UX / VISUAL — confirmado:** separar visualmente el resultado del estado del partido. `IDENTIDAD CUESTIONADA` no debe ir pegado al badge `VICTORIA`; debe ocupar una zona de estado propia, coherente con la misma decisión ya tomada para `PENDIENTE DE VALIDACIÓN`.
- En Home, el estado puede convivir cerca de la metadata/fecha o en una línea secundaria clara.
- En Historial, ubicar el estado debajo del resultado/badge principal, no mezclado con `VICTORIA/DERROTA`.

#### Resumen — tarjeta de incidencia

La tarjeta:
- `Por identificar`
- subtítulo `Identidad cuestionada`
- CTA `RESOLVER`

se percibió clara, compacta y útil.

**NO TOCAR en lo esencial / patrón aprobado:** conservar este patrón de tarjeta de incidencia con texto + CTA visible. Puede reutilizarse como lenguaje para otras incidencias de baja complejidad.

**UX / interacción:** hacer tappable toda la tarjeta además del botón `RESOLVER`, manteniendo el botón como affordance explícito.

#### Resolver identidad

Matu abrió `RESOLVER`, eligió a Pablito como reemplazo del slot cuestionado y el sistema dejó el partido esperando confirmación de la nueva pareja Pablito/Diego.

**FUNCIONAL — PASS:** la acción pasó correctamente al lado de la pareja corregida y el partido siguió existiendo sin atribuirlo a Seba.

**UX / selector de jugador — mejora confirmada:** al mostrar resultados para elegir quién jugó realmente, cada opción debe incluir al menos:
- nombre visible;
- `@username` debajo;
- opcionalmente avatar si ya existe en el patrón.

No mostrar solo el nombre cuando existen cuentas con nombres potencialmente repetidos.

#### Realtime / polling

La ausencia de actualización en vivo mientras una sesión permanece quieta sigue siendo esperada: hoy BRAMUlab no usa Realtime ni polling. El refresh al volver a foreground o al navegar ya fue validado.

**NO PRIORITARIO para Pre-Production:** no incorporar Realtime/polling ahora solo por esta prueba. Revisar más adelante si la experiencia real demuestra que la espera visible entre dos usuarios simultáneos genera fricción material.

**Estado del escenario:** falta confirmar la revisión desde Pablito o Diego para cerrar el flujo completo de identidad incorrecta.


### 15.12 — Escenario 1D, lado reemplazo Pablito + confirmación final — 25/09/2026

**Secuencia:** Matu reemplazó el slot cuestionado de Seba por Pablito. Pablito ingresó como cuenta real y recibió el partido pendiente con Diego vs Matu/Gusti, 2–6 / 2–6 desde su perspectiva. Pablito confirmó y el partido quedó oficial.

#### Lado Pablito antes de confirmar

- Home mostró el partido como pendiente accionable, resultado correcto desde la perspectiva del usuario y CTA de confirmación.
- Historial también mostró correctamente a Pablito/Diego primero y el score 2–6 / 2–6.
- Resumen permitió confirmar normalmente.

**FUNCIONAL — PASS:** la identidad reemplazada entra al flujo normal de validación y, al confirmar, el partido se oficializa con la nueva identidad.

#### Copy/evento incorrecto tras reemplazo de identidad

Home mostró:
`Matu / Gusti registró un partido en el que participaste.`

Esto no describe lo ocurrido. Pablito no fue parte de la carga original: fue incorporado mediante una resolución de identidad cuestionada.

**BUG / YA DEFINIDO INCOMPLETO:** las superficies de Home/Notificaciones deben distinguir:
- carga original;
- corrección de score/datos;
- corrección/reemplazo de identidad.

Dirección conceptual para este caso:
- `Matu corrigió un participante en un partido y quedaste incluido.`
- o equivalente más breve, siempre nombrando al actor real y evitando atribuir una “nueva carga”.

#### Después de confirmar

- feedback transitorio `Partido confirmado.`;
- Resumen pasa a estado oficial;
- Home de Pablito actualiza calibración 1/5 → 2/5;
- Nivel observado 5.5 → 5.4;
- Historial pasa a 2 partidos;
- Efectividad/Actividad/Partidos totales se recalculan correctamente.

**NO TOCAR en lo esencial:** la incorporación del reemplazo a estadísticas/Nivel una vez oficializado funciona.

**UX ya documentado y reconfirmado:** `VALIDADO` / `Partido oficial` siguen siendo redundantes como estado persistente normal; mantener feedback transitorio y trazabilidad útil en detalle.

**Estado del escenario:** falta una comprobación final en Seba: el partido corregido no debe reaparecer en Home/Historial ni modificar sus estadísticas, porque su identidad fue correctamente desacoplada antes de oficializarse.


### 15.13 — Escenario 1D cerrado: desacople definitivo de Seba — 25/09/2026

Comprobación final en iPhone de Seba después de que Pablito confirmara el partido corregido:

- Seba mantiene 3 partidos oficiales, no 4;
- el partido Matu + Gusti vs Pablito + Diego no reaparece en Home ni Historial de Seba;
- el último partido visible de Seba sigue siendo el partido anterior Seba + Pablito vs Matu + Diego, 4–6 / 4–6;
- Nivel, calibración y estadísticas de Seba no incorporan el partido del que fue correctamente desacoplado.

**FUNCIONAL — PASS:** el flujo completo de identidad incorrecta funciona de punta a punta:
1. jugador incorrecto reporta `No participé`;
2. el partido se desacopla de esa identidad;
3. otro participante resuelve el slot;
4. el reemplazo real recibe el partido;
5. el reemplazo confirma;
6. el partido queda oficial con la identidad correcta;
7. la identidad originalmente errónea no conserva efectos deportivos ni históricos del partido.

**Estado:** Escenario 1D COMPLETADO.


### 15.14 — Escenario 1E, compañero del autor + partido a 3 sets — 25/09/2026

**Partido:** Seba + Matu vs Esteban + Gusti, 6–4 / 3–6 / 6–2 para Seba/Matu. Cargado por Seba desde iPhone.

#### Lado Matu — compañero del autor

- El partido apareció correctamente en Home/Historial de Matu.
- Estado: `PENDIENTE DE VALIDACIÓN`.
- Matu NO recibe `TU TURNO: CONFIRMAR` ni acción pendiente.
- Las estadísticas oficiales de Matu no incorporan todavía este partido.
- Matu ve el mismo resultado/perspectiva de su pareja, sin necesidad de validar la versión enviada por Seba.

**FUNCIONAL — PASS / NO TOCAR:** confirma la regla de representación por pareja: cuando un integrante carga una revisión, su compañero queda considerado conforme y la acción pasa exclusivamente a la pareja rival.

#### Partido a 3 sets

- La tarjeta compacta muestra correctamente los tres sets: `6–4 · 3–6 · 6–2`.
- No se detectaron problemas funcionales nuevos en este formato durante esta pasada.

#### Estado del escenario

Se decide dejar este partido **pendiente a propósito** por ahora, sin validarlo desde Esteban/Gusti, para poder observar más adelante:
- convivencia de múltiples pendientes;
- diferencia entre pendientes accionables y no accionables;
- priorización visual cuando haya más de uno;
- eventual impacto del límite de pendientes accionables.

No utilizar este pendiente para modificar estadísticas hasta que se decida cerrarlo.


### 15.15 — Escenario 1F, convivencia de pendientes — inicio — 25/09/2026

**Nuevo partido cargado por Matu:** Matu + Diego vs Seba + Lucho, 7–5 / 6–4 para Matu/Diego.

Matu tiene ahora dos partidos pendientes no accionables en Historial:
1. Matu + Diego vs Seba + Lucho, 7–5 / 6–4.
2. Seba + Matu vs Esteban + Gusti, 6–4 / 3–6 / 6–2.

**NO TOCAR / regla vigente:** ambos deben permanecer fuera de estadísticas oficiales hasta validarse.

#### Estado visual de pendientes en Historial

Se reconfirma la necesidad de separar **resultado** de **estado del partido**.

**Dirección vigente:**
- resultado (`VICTORIA` / `DERROTA`) en su propia zona;
- debajo o en una segunda línea, estado del partido;
- partido oficial normal: sin badge persistente `VALIDADO`;
- pendiente no accionable (esperando a la otra pareja): estado neutro, sin competir con el resultado;
- pendiente accionable para el usuario: acento lima/verde, porque requiere atención;
- **NO usar naranja para pendientes**: naranja/amarillo queda reservado a `CALIBRANDO` según la regla visual vigente.

El objetivo del 1F es comprobar en Seba la convivencia simultánea de:
- un pendiente no accionable (Seba/Matu vs Esteban/Gusti);
- un pendiente accionable (Matu/Diego vs Seba/Lucho);

y evaluar priorización en Home, Historial y Notificaciones.


### 15.16 — Escenario 1F, Home con pendientes simultáneos — 25/09/2026

Seba tiene simultáneamente:
1. un pendiente **accionable**: Matu + Diego vs Seba + Lucho, 7–5 / 6–4 para Matu/Diego;
2. un pendiente **no accionable**: Seba + Matu vs Esteban + Gusti, 6–4 / 3–6 / 6–2, esperando a Esteban/Gusti.

#### Hallazgo principal

La Home actual muestra solamente un destacado superior para el pendiente accionable. El pendiente no accionable queda visible recién en Historial.

**PRODUCTO / UX — propuesta fuerte:** la Home debería permitir entender que existen ambos estados sin convertir la parte superior en una lista larga de tarjetas grandes.

Dirección a evaluar:
- si existe un único pendiente relevante: mantener una tarjeta destacada;
- si existen varios: usar un módulo compacto `PARTIDOS PENDIENTES` con prioridad:
  1. accionables primero;
  2. pendientes en espera después;
- mostrar una fila/tarjeta compacta por pendiente y, si la cantidad crece, resumir el resto con `Ver todos`.
- evitar apilar múltiples tarjetas grandes como la actual porque desplazaría demasiado la identidad/Nivel y el resto de Home.

Ejemplo conceptual:
- `REQUIERE TU ACCIÓN · Matu/Diego vs Seba/Lucho`
- `ESPERANDO RIVALES · Seba/Matu vs Esteban/Gusti`

#### Color de pendiente

La fuente vigente reservaba naranja/amarillo para `CALIBRANDO` y lima para pendientes accionables. Durante el laboratorio el usuario plantea que `PENDIENTE DE VALIDACIÓN` comparte semántica de “proceso incompleto” y podría funcionar visualmente en naranja/ámbar.

**DECISIÓN REABIERTA / A PROBAR VISUALMENTE:** no cambiar todavía la regla de color. Preparar comparativa visual más adelante:
- opción A: lima accionable + gris no accionable (regla vigente);
- opción B: ámbar para estado pendiente + lima adicional solo cuando requiere acción;
- mantener separación clara respecto de `CALIBRANDO`.

#### Aclaración de estado

Seba tiene **dos partidos pendientes**, pero solo **uno requiere su confirmación**. La UI debe hacer esta diferencia inequívoca; no usar `pendiente` como sinónimo de `tu turno`.



### 15.17 — Ajuste confirmado: carrusel de pendientes en Home + semántica de color — 25/09/2026

A partir de la revisión visual con dos pendientes simultáneos en Seba, se corrige la dirección anterior de Home.

#### Home — pendientes múltiples

**CONFIRMADO / DIRECCIÓN DE DISEÑO:**
- NO apilar varias tarjetas grandes una debajo de la otra.
- El bloque superior de pendientes debe funcionar como **carrusel horizontal de tarjetas**.
- La tarjeta actual debe reducir altura.
- El CTA grande `REVISAR` se elimina como botón independiente; toda la tarjeta será tappable.
- Si existe un solo pendiente, se muestra una sola tarjeta compacta.
- Si existen varios, se navegan horizontalmente manteniendo el mismo componente.
- La tarjeta debe diferenciar claramente si:
  - **requiere acción del usuario**;
  - **está esperando a la otra pareja**.
- La Home no debe crecer verticalmente de forma proporcional a la cantidad de pendientes.

#### Semántica de color — propuesta consolidada para prueba visual

Se reabre la idea de reservar ámbar exclusivamente para `CALIBRANDO`.

**Dirección recomendada:**
- verde: resultado positivo / victoria;
- rojo: resultado negativo / derrota;
- lima: acción requerida por el usuario;
- ámbar/naranja: estado todavía no final pero sin acción inmediata del usuario;
- gris/neutro: información secundaria;
- `VALIDADO`: no se muestra como badge persistente en estado normal.

Bajo este sistema:
- `CALIBRANDO` puede seguir en ámbar porque representa un estado incompleto/no consolidado;
- un partido `PENDIENTE DE VALIDACIÓN` que espera a terceros también puede usar ámbar por compartir la misma semántica de “todavía no final”;
- si el pendiente requiere acción del usuario, el acento principal pasa a lima.

**A validar visualmente:** comprobar que compartir ámbar entre `CALIBRANDO` y pendientes no genere confusión en una misma pantalla. La hipótesis de diseño es que la semántica común de “en proceso / no final” aporta coherencia en lugar de conflicto.

#### Historial — lectura observada

Con dos pendientes simultáneos:
- pendiente accionable: actualmente `TU TURNO: CONFIRMAR` en lima;
- pendiente no accionable: actualmente `PENDIENTE DE VALIDACIÓN` en gris.

Dirección ya acordada:
- mantener `VICTORIA/DERROTA` como resultado;
- separar el estado del partido en una segunda línea/zona;
- no mostrar `VALIDADO` en partidos oficiales normales;
- evaluar ámbar para pendiente no accionable y lima para pendiente accionable.


### 15.18 — Carrusel superior unificado + tramo final del Laboratorio — 25/09/2026

#### Carrusel superior de Home

**CONFIRMADO:** no crear un carrusel separado para pendientes.

El carrusel superior existente debe funcionar como una única superficie horizontal para contenido temporal/relevante y admitir variantes de tarjeta:
- pendientes accionables;
- pendientes en espera;
- tips / destacados informativos celestes;
- otros destacados temporales ya previstos por producto.

Orden de prioridad recomendado:
1. pendientes que requieren acción del usuario;
2. pendientes en espera;
3. tips / destacados informativos.

Las tarjetas pueden variar semánticamente en color y copy, pero comparten:
- mismo carrusel horizontal;
- altura compacta;
- tarjeta completa tappable;
- sin apilar módulos verticales equivalentes.

#### Tramo final recomendado del Laboratorio antes del handoff a Desarrollo

No seguir generando escenarios equivalentes.

Quedan tres bloques de alto valor:
1. **Transición CALIBRANDO → calibrado / 5 partidos:** aprovechar los pendientes ya existentes para llevar a Seba a 5/5 y revisar Home, Mi Perfil, Perfil público y Ranking al cambiar de estado.
2. **Identidad provisional / claim:** un único recorrido end-to-end visual para verificar invitado → reclamo → recuperación de historial, sin reauditar backend ya cerrado.
3. **Barrido visual final sin crear más datos:** Modificaciones, Mis grupos, Ranking, Perfil público y responsive escritorio (Home, Historial, Ranking, Mi Perfil, Perfil público, Cargar partido, Login y Signup).

Después de esos tres bloques, preparar un único consolidado para Desarrollo con:
- BUG;
- YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA;
- UX / VISUAL;
- PRODUCTO;
- NO TOCAR;
- prioridad: antes de Production / conveniente / futuro.

No probar de nuevo límites/ventanas ya cerrados (5 pendientes, 30 días, 10+7, etc.) salvo regresión concreta.


### 15.19 — Transición hacia 5/5: primer pendiente cerrado — 25/09/2026

**Partido:** Seba + Matu vs Esteban + Gusti, 6–4 / 3–6 / 6–2 para Seba/Matu.

Esteban ingresó desde escritorio, recibió correctamente el pendiente como accionable y confirmó el partido. El partido pasó a oficial.

**FUNCIONAL — PASS:** la pareja rival pudo validar; el compañero del autor no necesitó acción; el partido a 3 sets se oficializó sin incidencia.

**Observación visual reconfirmada:** desde la perspectiva de Esteban el score compacto puede leerse de forma confusa porque la representación actual no siempre reordena visualmente el resultado poniendo al usuario/pareja propia como referencia principal. Este criterio ya fue detectado en Historial/Home y debe resolverse de forma consistente en la ronda de implementación.

**Próximo control:** volver a Seba en iPhone y verificar transición 3/5 → 4/5 sin refresh manual. Luego usar el pendiente Matu + Diego vs Seba + Lucho para provocar deliberadamente 4/5 → 5/5 y revisar con especial atención Home, Mi Perfil, Perfil público y Ranking.

**Método:** después de observar 5/5, pausar la generación de escenarios nuevos y hacer una auditoría/consolidación de las decisiones UX tomadas durante esta sesión antes de entregar un paquete a Desarrollo, para evitar contradicciones acumuladas por la longitud de la ronda.


### 15.20 — Cambios externos: señal en Historial + contextualización de Notificaciones — 25/09/2026

Durante la transición de Seba 3/5 → 4/5, un partido pendiente fue validado por Esteban desde otra sesión. Al volver a iPhone, Home y métricas se actualizaron correctamente, pero el usuario no tiene una señal clara de **qué elemento cambió desde la última vez que miró**.

#### Historial — cambios no vistos

**PRODUCTO / UX — dirección recomendada:**
- cuando un partido cambia por una acción externa relevante (validación, corrección aceptada, identidad resuelta, etc.), marcar Historial como que contiene contenido nuevo/no visto;
- mostrar un pequeño badge/punto en el acceso a Historial mientras exista al menos un cambio no visto;
- al entrar a Historial, resaltar temporalmente la/s fila/s modificada/s con un tratamiento visual sutil;
- una vez vista la fila, retirar el estado de “nuevo” de ese partido y, si no quedan otros, retirar el badge del acceso a Historial.

**A probar visualmente:** badge rojo convencional vs. otro acento de sistema. Evitar que el resaltado del partido compita con los colores semánticos de victoria/derrota/pendiente. Preferir un borde o halo sutil y temporal antes que un contorno blanco fuerte permanente.

Objetivo: que el usuario pueda responder rápidamente “¿qué cambió?” sin tener que comparar mentalmente toda la lista.

#### Notificaciones — contexto insuficiente

La bandeja sigue mostrando eventos genéricos como:
- `Partido oficial · Tu partido ya quedó validado.`
- `Partido pendiente · Tenés un partido esperando tu confirmación.`

**YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA + UX:**
las notificaciones de acciones relevantes deben nombrar al actor y dar contexto suficiente para identificar el partido.

Dirección:
- `Esteban confirmó tu partido con Matu.`
- `Matu aceptó la corrección del partido con Pablito.`
- `Seba propuso una corrección en el partido con Lucho.`
- cada notificación debe abrir el partido correspondiente;
- las acciones propias no deben generar informativa redundante para el mismo actor.

La bandeja no debe ser una colección de estados genéricos indistinguibles.

#### Estado funcional de esta pasada

- Seba pasó correctamente de 3/5 a 4/5 tras la validación externa;
- el partido validado entró a estadísticas oficiales;
- el otro pendiente accionable permanece correctamente visible;
- no se detectó regresión funcional nueva.



### 15.21 — Transición 4/5 → 5/5 / Nivel calibrado — 25/09/2026

Seba confirmó Matu + Diego vs Seba + Lucho (7–5 / 6–4 para Matu/Diego) y pasó correctamente de `CALIBRANDO · 4/5` a estado `CALIBRADO`.

#### Funcional

- `rated_matches` pasó a 5;
- Home muestra 5 partidos en historial;
- Nivel público observado: 5.8;
- Efectividad: 40% (2 ganados / 5 jugados);
- Mi Perfil actualiza 5 partidos / 2 ganados;
- la transición de estado se produjo al quinto partido, sin esperar un sexto.

**FUNCIONAL — PASS:** coincide con la regla maestra de Nivel: 5 partidos computables + 3 rivales distintos computables.

#### Home — tarjeta de identidad/Nivel al calibrarse

La transición visual actual rompe la composición de la tarjeta:
- el Nivel deja de ocupar correctamente la columna derecha;
- aparece una píldora grande `NIVEL CALIBRADO`;
- desaparece la barra de progreso, pero el layout no recompone bien el espacio.

**UX / VISUAL — CONFIRMADO:**
- al finalizar calibración, eliminar la píldora persistente `NIVEL CALIBRADO` de Home;
- volver a una tarjeta limpia de identidad + `NIVEL BRAMU` numérico en su posición normal;
- la ausencia de `CALIBRANDO` ya comunica que el nivel está consolidado;
- la finalización de calibración puede celebrarse con feedback transitorio/carrusel si se desea, pero no como badge permanente que deforme la tarjeta.

**BUG VISUAL:** recomponer el layout responsive de la tarjeta inmediatamente al cambiar de calibrando → calibrado.

#### Mi Perfil — cabecera

Mismo criterio que Home:
- eliminar la píldora persistente `NIVEL CALIBRADO`;
- conservar Nivel BRAMU numérico en la composición normal;
- no repetir un estado que ya es el estado ordinario del jugador calibrado.

#### Mi Perfil — Evolución del Nivel BRAMU

Estado observado:
- título `EVOLUCIÓN DEL NIVEL BRAMU`;
- contenido `NIVEL CALIBRADO`;
- copy todavía afirma: `Es una primera referencia basada en tus respuestas — todavía no es una medición de tu juego. BRAMU la va a calibrar con partidos reales.`

Ese copy es falso una vez completada la calibración.

**BUG DE ESTADO/COPY + IMPLEMENTACIÓN INCOMPLETA:**
- al pasar a calibrado, no mostrar el mensaje de estimación inicial/calibración futura;
- si existen datos reales suficientes de `level_events` para renderizar evolución, usar únicamente esa evidencia real;
- si la UI server-backed todavía no dispone de la serie necesaria, ocultar temporalmente el módulo antes que mostrar un gráfico/copy inventado o contradictorio;
- no simular evolución ni reutilizar datos legacy.

#### Ranking al terminar calibración

Mi Perfil muestra `Todavía sin posición oficial`.

**COMPORTAMIENTO ESPERABLE / NO BUG por sí solo:** Ranking es una edición semanal publicada. Terminar calibración durante la semana no crea retrospectivamente una posición en la edición ya publicada. La incorporación corresponde a una edición futura cuando cumpla las condiciones de elegibilidad de Ranking.

No tocar Ranking solo por este estado sin revisar la edición semanal vigente.

#### Buscar jugadores / Perfil público / JUGADORES

En un Perfil público server-backed real no aparece `AGREGAR JUGADOR`.

Revisión de código vigente:
- el botón se oculta deliberadamente en `renderPlayerPublicProfileServerBacked`;
- la razón documentada en código es que la lista histórica `JUGADORES` escribe localmente por nombre (`Store.addPlayerToList`) y reactivarla para identidades reales por `player_id` reintroduciría el problema de identidad que Backend Bloque 4 corrigió.

**YA DEFINIDO / IMPLEMENTACIÓN INCOMPLETA, no bug accidental.**

Dirección para Producto/Desarrollo:
- NO volver a habilitar el botón legacy por nombre;
- si se conserva `JUGADORES` como función real, debe migrarse a identidad server-backed por `player_id`;
- no convertirlo ahora en sistema social/follow complejo;
- si esa migración amplía demasiado esta ronda, ocultar temporalmente la promesa de `JUGADORES` en cuentas server-backed antes que ofrecer una función que no puede completarse.

#### Mis grupos

**NO TOCAR EN ESTA RONDA.**
Se confirma que `Mis grupos` merece una revisión propia de producto/UX y no debe resolverse como parche dentro del paquete actual. El usuario lo considera una superficie potencialmente central de BRAMU y quiere dedicarle una ronda específica con contexto y diseño suficiente.



### 15.22 — Cierre de contradicciones de la ronda antes del handoff — 25/09/2026

Esta sección fija precedencia sobre propuestas anteriores de §15 cuando hubo iteraciones durante la sesión.

1. **Acción secundaria del Resumen**
   - usar como dirección final `REPORTAR UN ERROR` (mejor que `PROPONER CORRECCIÓN` y más explícito que `HAY UN ERROR`);
   - desde ahí derivar a tipos de error: resultado / participante / otros datos que el backend vigente permita corregir;
   - `No participé` deja de competir como tercera acción principal aislada y vive dentro del flujo de participante incorrecto.

2. **Autor del partido en identidad incorrecta**
   - para una carga normal de BRAMUlab, el autor es un participante obligado por el propio flujo de carga;
   - en la UI de `No participé / participante incorrecto`, NO ofrecer al autor original como candidato a ser removido del partido que él mismo cargó;
   - conservar de todos modos la autoría como dato separado de la identidad deportiva para trazabilidad;
   - la posibilidad de múltiples identidades incorrectas en un mismo partido no se amplía en esta ronda salvo que la implementación actual ya la soporte de forma segura.

3. **Cambios externos en Historial**
   - el indicador de “hay cambios que todavía no viste” se considera visto al **abrir Historial**;
   - no exigir abrir cada partido individualmente para limpiar el badge;
   - durante esa primera apertura pueden resaltarse sutilmente las filas que cambiaron, y luego retirar el tratamiento.

4. **Pendiente no accionable / color**
   - usar ámbar como hipótesis preferida en Staging para `PENDIENTE DE VALIDACIÓN` cuando el usuario está esperando a terceros;
   - usar lima cuando requiere acción del usuario;
   - revisar visualmente después del primer build; si compite demasiado con `CALIBRANDO`, ajustar tono/intensidad sin reabrir la semántica.

5. **Mis grupos y responsive**
   - siguen FUERA de esta ronda de implementación;
   - requieren revisión específica posterior y no deben resolverse por arrastre en el paquete actual.



### 15.23 — Observaciones posteriores al handoff, para próxima ronda — 25/09/2026

Estas observaciones se registran **fuera del handoff 13 ya enviado a Desarrollo**. No deben ampliar la ronda técnica en curso salvo que Desarrollo las encuentre naturalmente dentro del mismo código y sean triviales de resolver. Se revisan en la próxima vuelta del Laboratorio.

#### Buscar jugadores — avatar ausente en resultados

Evidencia visual:
- al buscar `Seba`, la fila server-backed muestra inicial `S` en lugar de la foto;
- al abrir el Perfil de jugador, la foto sí carga correctamente.

**CLASIFICACIÓN PROVISIONAL: UX / IMPLEMENTACIÓN INCOMPLETA.**
No asumir todavía un fallo de almacenamiento de foto, porque el Perfil público demuestra que la imagen existe y puede resolverse.

A revisar después:
- si `search_players` expone una referencia segura de avatar;
- si el resultado puede reutilizar el mismo mecanismo de URL firmada que Perfil público;
- evitar agregar llamadas costosas por cada fila si no existe una solución simple.

#### Perfil público — WhatsApp

Se probó `CONTACTAR POR WHATSAPP` y abrió correctamente el contacto.

**FUNCIONAL — PASS / NO TOCAR.**

#### Perfil público — AGREGAR JUGADOR

Sigue ausente en cuentas server-backed.

**YA DOCUMENTADO:** no tratar como bug accidental ni reactivar el sistema legacy por nombre. Ver §15.21 y handoff 13.

#### Datos de Perfil de las cuentas QA

El usuario recuerda haber definido durante la creación de cuentas sintéticas datos como:
- mano dominante;
- lado habitual;
- edad/fecha de nacimiento;
- género;
- ubicación/localidad.

Observación actual:
- en Perfil público de Seba se ven Mano dominante = Derecha y Lado habitual = Revés;
- la edad no se muestra en Perfil público;
- en algunas cuentas/propios perfiles el usuario percibe varios campos vacíos, con ubicación como uno de los pocos datos presentes.

**CLASIFICACIÓN: PENDIENTE DE VERIFICACIÓN, NO cerrar como bug todavía.**

Motivos:
1. Perfil público oculta deliberadamente ciertos datos privados (por ejemplo edad), por lo que ausencia allí no prueba pérdida de datos.
2. Hay que distinguir si los datos:
   - nunca se persistieron al crear las cuentas QA;
   - están persistidos pero la UI propia no los muestra;
   - están persistidos en campos distintos;
   - o realmente se perdieron.

Próxima validación mínima:
- elegir UNA cuenta QA;
- comparar `Mi Perfil / Mis datos` contra el registro server-backed real;
- si falta persistencia, corregir creación/perfil;
- si los datos existen y no se muestran, clasificar como UI;
- no repetir la comprobación cuenta por cuenta hasta entender la causa.

## 15.24 — Mapa de pendientes tras QA final 04.11-h7 — 26/09/2026

Objetivo de esta sección: evitar que Sebastián tenga que volver a reportar observaciones ya conocidas durante la revisión física final. Separa lo que **debía haber quedado resuelto pero no quedó bien**, lo que fue **deliberadamente diferido** y lo que está **implementado y no hace falta volver a auditar salvo regresión**.

### A. REABIERTO — debía estar resuelto en la ronda y la QA física demuestra que no quedó bien

#### Resumen — alineación vertical de parejas + games

El Laboratorio (§15.2) y el handoff 13 pidieron explícitamente alinear verticalmente las dos filas del score. Ronda 2 aplicó un ajuste CSS y lo dio por cubierto en navegador, pero Sebastián confirma en iPhone sobre 04.11-h7 que la desalineación óptica sigue visible.

**Estado:** BUG VISUAL REABIERTO.

No pedir una nueva descripción desde cero. La próxima corrección debe partir del hallazgo original: la fila inferior de nombres/games no queda ópticamente alineada con la superior.

#### Corrección de resultado — paridad visual con Cargar partido

El handoff 13 pidió **reutilizar composición/lógica** del editor de resultado de `Cargar partido`. Ronda 1 resolvió la parte funcional (sets dinámicos 2↔3 + validador compartido), pero la hoja de corrección conserva un lenguaje visual propio y Sebastián sigue percibiéndola como claramente distinta/peor que Cargar partido.

**Estado:** IMPLEMENTACIÓN PARCIAL — funcional cerrado, UX/VISUAL REABIERTO.

No volver a probar si permite agregar/quitar sets salvo regresión. La próxima tarea es unificar la experiencia visual/editorial con Cargar partido sin duplicar lógica.

### B. DIFERIDO DELIBERADAMENTE — no volver a reportar como bug nuevo

#### Buscar jugadores — avatar en resultados

§15.23 ya documentó que la búsqueda server-backed muestra iniciales aunque el Perfil público sí pueda mostrar la foto.

**Estado:** PENDIENTE DE PRÓXIMA RONDA.

Investigar una solución segura sin N llamadas por fila: reutilizar referencia/avatar del contrato server-backed si existe o extenderlo mínimamente. No asumir pérdida de foto.

#### AGREGAR JUGADOR + pestaña JUGADORES

El botón `AGREGAR JUGADOR` y la pestaña `JUGADORES` se ocultaron deliberadamente para cuentas server-backed.

Motivo:
- la implementación legacy persiste jugadores por nombre;
- la identidad real vigente usa `player_id`;
- reactivar el flujo viejo reintroduciría errores de identidad.

No se borró la función histórica ni sus datos locales: quedó oculta/reversible.

**Estado:** DIFERIDO hasta construir una lista/relación server-backed mínima por `player_id`, sin convertirla automáticamente en un sistema social complejo.

Por lo tanto, mientras esto siga así:
- Buscar jugadores sirve para encontrar/abrir perfiles, no para “agregarlos”;
- Mi Perfil muestra solo `MI PERFIL` + `MIS DATOS`;
- la ausencia de `JUGADORES` es temporal e intencional, no una regresión accidental.

#### Datos de Perfil QA

Mano/lado/edad/género/ubicación quedaron pendientes de una validación dirigida de UNA cuenta contra el registro server-backed para separar dato no persistido vs. dato oculto/no renderizado.

**Estado:** PENDIENTE DE VERIFICACIÓN. No repetir cuenta por cuenta.

#### Subida de foto de perfil

El fallo ocasional `No pudimos guardar la foto` quedó documentado pero no reproducido de manera suficiente para abrir una investigación grande dentro de la ronda UX.

**Estado:** PENDIENTE DE REPRODUCCIÓN DIRIGIDA si vuelve a ocurrir.

#### Mis grupos

Fuera del paquete 25SEP por decisión explícita. Requiere una ronda propia de producto/UX; no resolver con parches.

#### Responsive / ancho escritorio

Fuera del paquete 25SEP. Queda para comparación visual específica posterior.

#### Realtime / polling

No agregar por ahora. El comportamiento vigente es refrescar al volver a foreground/navegar; ya fue validado. Solo reabrir si uso real demuestra fricción material.

### C. NUEVO REFINAMIENTO CONFIRMADO EN QA FINAL — próximo paquete corto

#### RECIENTES al elegir compañero/rival

La sección RECIENTES server-backed ya funciona por `player_id`, pero hoy cada fila usa el subtítulo `Jugaron juntos antes`.

Sebastián considera ese texto redundante: si la persona está en RECIENTES, esa relación ya es obvia. Prefiere usar ese espacio para información útil, idealmente:
- `@username`;
- Nivel BRAMU real.

**Estado:** UX A MEJORAR.

Restricción técnica vigente: el snapshot usado para RECIENTES hoy aporta nombre + `player_id`, pero no username/Nivel. No inventarlos desde el nombre. Resolver en una lectura server-backed/batch o ampliación mínima de contrato, evitando N llamadas por fila.

#### Notificaciones — título genérico `Partido oficial`

04.11-h7 resolvió correctamente contexto, actor, rivales, score y self-caused, pero el título de `match_validated` sigue siendo `Partido oficial`.

Sebastián considera que el título aporta poco porque el estado oficial es el estado normal del producto.

**Estado:** COPY/UX A MEJORAR.

Próxima ronda: usar un título que describa el evento/acción, no el estado genérico del partido. Mantener el contexto real ya implementado.



#### Login — falso retorno al onboarding de Nivel

Sebastián reporta que una cuenta YA existente/completa puede iniciar sesión y, en el primer intento, ser enviada erróneamente al onboarding de Nivel como si la cuenta estuviera incompleta. Al salir/reingresar, la misma cuenta entra correctamente.

Central verificó sobre Staging que `@seba_qa` tiene perfil + `level_states` reales y estado de Nivel distinto de `PENDIENTE`; no corresponde pedir onboarding.

Revisión de código vigente:
- `Auth.fetchOwnProfile()` lee Auth + `profiles` + `level_states` en paralelo;
- si la lectura de `level_states` falla, hoy igual devuelve un usuario válido pero con `levelState:null`;
- `resumeServerSession()` interpreta `levelState:null` exactamente igual que “onboarding de Nivel no completado” y deriva a `resumeSignupProfileStep()/resumeDraftFlow()`.

Ese camino puede producir exactamente el síntoma observado ante una falla parcial/transitoria de lectura, aunque el servidor tenga un Nivel válido.

**Estado:** BUG FUNCIONAL P0 — REABIERTO.

Dirección:
- distinguir “no existe level_state real” de “falló la lectura”;
- una falla parcial de red/RPC nunca debe convertir una cuenta completa en una cuenta nueva/incompleta;
- no usar cache local para inventar que el onboarding está completo si el servidor realmente informa `PENDIENTE`;
- probar login nuevo + restauración de sesión + falla simulada de `level_states` + cuenta realmente incompleta.

### D. Otras observaciones ya conocidas que siguen fuera / sin definición final

- Acción `Ocultar partido` en Resumen: se había marcado con demasiado protagonismo/ubicación poco natural; no entró al handoff final porque no se cerró todavía un patrón contextual concreto (menú/ícono u otro).
- Metadata de `Cargar partido` (formato/puntuación/fecha): se propuso compactarla/moverla arriba, pero no se cerró layout exacto y no se implementó.
- Múltiples identidades incorrectas en un mismo partido: no ampliar si exige arquitectura nueva.
- `Otros datos` dentro de `REPORTAR UN ERROR`: mostrar solo cuando exista un contrato vigente seguro para corregirlos; no inventar una opción vacía.

### E. YA IMPLEMENTADO — no volver a auditar salvo que aparezca una regresión concreta

- perspectiva personal de score en Home/Historial;
- carrusel superior de pendientes;
- separación VICTORIA/DERROTA vs. estado;
- tabs redundantes de Historial retiradas;
- trazabilidad `Cargado por` / `Confirmado por` (puede aparecer después del detalle asincrónico);
- `REPORTAR UN ERROR` como acceso unificado;
- clasificación carga/corrección/reemplazo de identidad;
- Nivel 5/5 sin píldora persistente `NIVEL CALIBRADO`;
- TU MOMENTO sin atribución falsa de carga;
- Intelligence con un solo `POR QUÉ APARECEN ESTOS INSIGHTS`;
- notificaciones con actor/contexto real y filtrado self-caused;
- headers/blur del paquete 25SEP.

## 15.25 — Batería adicional observada en iPhone / escritorio mientras Claude ejecuta la corrección 26SEP

**Fecha:** 26/09/2026  
**Estado:** consolidado para incorporar DESPUÉS de la entrega actual de Claude, antes de volver a pedir una validación física amplia a Sebastián.

Regla de proceso:
- NO pedirle a Sebastián que vuelva a revisar `04.11-h7`;
- terminar primero la ronda correctiva en curso;
- Central revisa técnicamente esa entrega;
- luego FUSIONAR estos puntos en una segunda corrección si no quedaron absorbidos naturalmente;
- recién después hacer una validación física amplia de una batería significativa, evitando micro-iteraciones de una o dos cosas.

### P0 funcional — acciones que hoy fallan

#### Resolver identidad cuestionada

Caso observado en iPhone:
- Resumen muestra `Por identificar · Identidad cuestionada`;
- Sebastián toca `RESOLVER`;
- intenta asignar el participante correcto (ej. Esteban);
- la app devuelve:
  `No se pudo completar la acción. Probá de nuevo.`

**Estado:** BUG FUNCIONAL P0.

No confundir con UX del selector. Antes de volver a pedir QA:
- reproducir contra Staging;
- identificar RPC/error real;
- corregir;
- probar resolución completa de punta a punta;
- verificar que el partido, notificaciones y trazabilidad queden coherentes.

#### Proponer / aceptar corrección de resultado

Caso observado también entre iPhone y cuenta abierta en computadora:
- existe partido con corrección propuesta;
- al intentar actuar sobre el flujo aparece el mismo toast genérico:
  `No se pudo completar la acción. Probá de nuevo.`

**Estado:** BUG FUNCIONAL P0 hasta aislar exactamente qué acción falla.

La ronda actual ya toca el editor visual de corrección, pero eso NO alcanza si el submit/accept real falla.
Antes de cierre:
- reproducir propuesta y aceptación;
- capturar error real;
- verificar permisos/turno/estado;
- no esconder una excepción de backend detrás del toast genérico;
- mantener revisión append-only.

### UX / UI confirmada por Sebastián

#### Notificaciones — título debe describir la acción

No usar `Partido oficial` como título ordinario.

Preferencia conceptual reforzada:
- el actor + acción puede ocupar el título, ej. `Esteban confirmó tu partido`;
- debajo queda una descripción/contexto más claro del partido;
- evitar duplicar exactamente la misma frase entre título y body;
- mantener rivales + score + fecha de h7.

La ronda correctiva actual ya contempla títulos por evento. En revisión central evaluar si el resultado queda suficientemente específico o si conviene actor+acción en el propio título.

#### Header / degradé superior en iPhone

Sebastián confirma que el fade/blur superior SIGUE percibiéndose en iPhone aunque en computadora se vea bien.

**Estado:** REABIERTO SOLO EN iPhone.

No seguir ajustando a ciegas desde desktop.
Revisar safe-area/WebKit/iOS:
- backdrop-filter;
- pseudo-elementos;
- altura del gradiente;
- stacking;
- overscroll/safe-area inset.

Si en iPhone real el efecto sigue invadiendo título/logo, corregir.
Si es una limitación visual menor propia de Safari/PWA y no afecta legibilidad, puede aceptarse, pero debe ser una decisión consciente tras verlo, no declararlo cerrado por desktop.

#### Editor de corrección — claridad de quién gana / orientación

Además de paridad visual con `Cargar partido`, Sebastián marca un problema conceptual:
- el editor actual no deja suficientemente claro qué columna/equipo corresponde a quién;
- con números solos puede no entenderse quién está ganando.

La corrección debe mostrar de forma inequívoca:
- Equipo/pareja A y B, o nombres de parejas;
- orientación coherente con el Resumen y con Cargar partido;
- quién corresponde a cada input de games;
- score actual prellenado.

No basta con copiar CSS de Cargar partido si se pierde la identidad de cada lado.

#### Buscar jugadores — avatar

Confirmación visual en iPhone:
- búsqueda muestra nombre, `@username` y Nivel BRAMU;
- avatar sigue en iniciales;
- al entrar al Perfil público sí aparece la foto.

La ronda correctiva actual ya contempla este punto. Se considera CERRADO solo cuando la fila de búsqueda muestre foto real cuando exista, sin N llamadas.

#### Botón central `+` de Cargar partido

Sebastián percibe el CTA central de carga:
- con poca presencia;
- algo pequeño;
- ópticamente un poco caído / no perfectamente centrado.

**Estado:** AJUSTE VISUAL.

Objetivo:
- más presencia sin volverse grotesco;
- centrado óptico dentro de la barra inferior;
- revisar especialmente iPhone/safe-area;
- conservar jerarquía como acción principal de la app.

#### Cargar partido — formato/puntuación/fecha arriba y más compactos

Se refuerza una observación ya conocida y ahora pasa a ser PEDIDO CONCRETO:

Hoy:
- `Clásico · Punto de Oro` vive arriba como subtítulo;
- el selector `Clásico · Mejor de 3 · Punto de Oro` y la fecha/hora quedan abajo, después del bloque de resultado.

Problema:
- el usuario puede empezar a cargar sets sin notar que el formato no corresponde al partido real;
- ejemplo: un americano / un solo set podría quedar mal conceptualizado antes de llegar a modificar formato.

Dirección:
- poner la metadata crítica de partido ANTES del resultado;
- idealmente en una línea/área compacta arriba:
  formato + puntuación + fecha/hora;
- debe ser visible/editable antes de empezar a cargar sets;
- evitar duplicarla en dos lugares.

**Estado:** UX A IMPLEMENTAR. Ya no queda como idea indefinida.

#### Historial — ubicación de estados

En cada tarjeta:
- `VICTORIA` / `DERROTA` queda arriba a la derecha;
- estados como `PENDIENTE DE VALIDACIÓN`, `IDENTIDAD CUESTIONADA`, etc. NO deberían quedar abajo a la izquierda mezclados con contenido secundario.

Dirección:
- estado debajo de VICTORIA/DERROTA;
- alineado a la derecha;
- jerarquía secundaria;
- mantener resultado y estado como conceptos separados.

#### Historial — indicador de cambios no vistos

El punto/círculo de cambios externos funciona conceptualmente.

Preferencia visual a evaluar:
- probar rojo en vez de celeste para el indicador del ícono de Historial;
- la marca/acento celeste dentro de la fila modificada puede mantenerse aunque no sea definitiva.

No abrir una reestructuración; es ajuste visual.

#### Home — tarjeta Último partido: ubicación del estado

Actualmente `DERROTA` y `PENDIENTE DE VALIDACIÓN` aparecen lado a lado.

Dirección:
- resultado (VICTORIA/DERROTA) mantiene protagonismo;
- estado debe ir debajo de la fecha/hora, alineado a la derecha;
- evitar mezclar resultado y estado en la misma línea.

Este criterio debe ser consistente con Historial.



### Regla de retorno a Laboratorio después de una ronda correctiva

No volver a pedirle a Sebastián una revisión física amplia mientras exista una batería conocida de cambios que todavía no fue implementada, revisada o descartada explícitamente por una razón real.

Antes de volver al Laboratorio, Central debe preparar una **lista de cambios a validar** que funcione como memoria de la ronda. Esa lista debe indicar, para cada punto:
- qué pidió Sebastián;
- qué se implementó finalmente;
- dónde verlo;
- qué comportamiento se espera;
- si algo NO se implementó, por qué y con qué decisión explícita.

No vale dejar pedidos conocidos “para después” de forma silenciosa y luego pedir otra revisión general.

Si un pedido:
- no es técnicamente posible en esta etapa;
- implica una arquitectura desproporcionada;
- requiere una decisión humana nueva;
- o queda fuera por una razón de producto real;

debe marcarse ANTES del próximo Laboratorio como **NO IMPLEMENTADO / DECISIÓN ABIERTA**, con motivo concreto. Todo lo demás debe llegar ya corregido.

Objetivo operativo: que Sebastián se siente a revisar una batería sustancial de cambios una sola vez, y que su revisión sirva principalmente para validar si el resultado coincide con lo esperado o para aclarar una interpretación, no para volver a descubrir pendientes ya conocidos.

### Regla de cierre para la próxima devolución a Sebastián

Antes de pedirle otra revisión física amplia, Central debe confirmar que:

1. la entrega actual de Claude está técnicamente sana;
2. los P0 de acciones fallidas (identidad/corrección) están resueltos o aislados con causa concreta;
3. los puntos visuales anteriores están implementados o explícitamente marcados como DECISIÓN ABIERTA real;
4. Sebastián recibe una sola batería de validación suficientemente grande para justificar sentarse a revisar;
5. no se le vuelve a pedir que descubra por segunda/tercera vez pendientes ya documentados.

## 15.26 — Propuesta futura: aviso modal de evento importante al abrir BRAMU

**Fecha:** 26/09/2026  
**Estado:** PROPUESTA DE PRODUCTO CONFIRMADA PARA ANALIZAR DESPUÉS DE LA RONDA CORRECTIVA ACTUAL.

### Problema que busca resolver

Hay eventos que afectan directamente la validez del dato y que no deberían depender de que el usuario:
- vea un badge;
- entre a Notificaciones;
- descubra manualmente una tarjeta pendiente en Home.

Ejemplo claro:
Sebastián termina de jugar y va a cargar el partido, pero Esteban ya llegó antes a su casa y lo cargó. Al abrir BRAMU, sería útil que Sebastián se entere inmediatamente de que el partido ya existe, evitando una carga redundante y llevándolo al circuito correcto.

### Dirección conceptual

Al abrir/retomar BRAMU, si existe un evento IMPORTANTE nuevo todavía no presentado al usuario, mostrar un modal/pop-up breve con contexto real del partido.

No es una notificación genérica ni un modal para cualquier evento.

Eventos de señal alta candidatos:
- alguien cargó un partido en el que participás;
- tenés que confirmar/validar un partido;
- alguien propuso una corrección relevante;
- existe una incidencia/cambio que requiere una acción tuya.

No usar para:
- “partido oficial” como información rutinaria;
- estadísticas menores;
- eventos sin impacto en la validez del dato.

### CTA contextual según el rol

El CTA NO debe ser siempre `REVISAR PARTIDO`.

Debe depender de lo que realmente puede/debe hacer esa persona.

Ejemplos conceptuales:

**Si sos compañero / no te corresponde validar:**
- título/contexto: `Esteban cargó un partido con vos`;
- CTA: `VER RESUMEN` / `IR AL RESUMEN`.

**Si sos quien debe confirmar:**
- título/contexto: `Esteban cargó un partido con vos`;
- CTA: `VALIDAR PARTIDO` o naming final equivalente.

**Si existe una corrección que requiere tu decisión:**
- CTA: `REVISAR CORRECCIÓN` / `ACEPTAR O REPORTAR` según el flujo vigente.

La UI nunca debe prometer una acción que ese usuario no tiene disponible.

### Comportamiento propuesto

- aparece automáticamente solo ante un evento importante NUEVO;
- tocar CTA abre el Resumen exacto del partido;
- cerrar/tocar afuera NO resuelve la tarea;
- la tarea sigue disponible en Home y Notificaciones;
- no repetir el mismo modal en cada apertura si el usuario ya lo vio;
- un evento nuevo sobre el mismo partido puede habilitar un nuevo modal;
- no requiere Realtime para V1: puede evaluarse en la lectura server-backed de apertura/foreground.

### Relación con la arquitectura actual

Tres niveles complementarios:

1. **Modal de entrada:** novedad importante inmediata.
2. **Home:** tarea persistente mientras siga pendiente.
3. **Notificaciones:** historial/contexto de lo ocurrido.

Objetivo principal:
mejorar el circuito de validación y evitar cargas duplicadas o datos pendientes, porque la calidad de BRAMU depende de que los partidos queden correctamente confirmados/corregidos.

No implementar durante la ronda correctiva 26SEP en curso. Analizar e integrar después de cerrar la batería actual.

## 15.27 — Gate técnico cerrado y retorno controlado al Laboratorio — 26/09/2026

**Bundle:** `04.11-h10`

Central revisó la entrega h10, aplicó la migración de precisión del optimistic lock en Supabase Staging, ejecutó el verify transaccional con PASS/rollback limpio, repitió la reproducción REAL del partido que antes quedaba trabado y obtuvo `ok:true`, y repitió además la rama real de identidad cuestionada con reemplazo dentro de BEGIN/ROLLBACK, también con `ok:true`.

Las tres Edge Functions compartidas de validación/corrección/identidad quedaron redesplegadas en Staging con el motor h10. Vercel BRAMUlab está verde y los assets PWA están alineados.

Antes del QA físico se creó la lista única de cambios a validar:

`25_Checklist_Retorno_Laboratorio_26SEP.md`

Ese documento es la guía vigente para la próxima revisión de Sebastián. Incluye:
- qué pidió;
- qué se implementó;
- dónde verlo;
- qué se espera;
- qué puntos quedan explícitamente fuera/abiertos y por qué.

No volver a usar h7/h8/h9 como base de QA.



### 15.28 — Nuevo evento externo: cómo advertir que “algo cambió” — 27/09/2026

Durante el retorno al Laboratorio sobre `04.11-h10`, antes incluso de revisar la batería visual completa, Sebastián vuelve a detectar un problema de percepción:

Cuando otra persona carga, valida o modifica un partido, el contenido server-backed puede actualizarse correctamente pero el usuario puede sentir que el cambio “apareció de golpe” y no entender qué fue lo nuevo. En especial, la tarjeta `ÚLTIMO PARTIDO` puede cambiar sin una señal suficientemente clara de que ese contenido acaba de entrar por una acción externa.

**CLASIFICACIÓN: UX / PRODUCTO.**

Esto NO es el bug de frescura ya corregido. Los datos llegan; el problema es comunicar el evento nuevo.

#### Dirección a evaluar visualmente

No resolver todavía con una sola solución rígida. La experiencia debería combinar, de forma no redundante:

- **carrusel superior de eventos relevantes** para avisar qué pasó y quién lo provocó;
- **señal temporal de “nuevo/cambió”** sobre la tarjeta de Último partido cuando ese cambio provino de afuera;
- **badge en Historial + resaltado de la fila modificada**, ya definido en §15.20;
- eventual **popup/hoja breve al abrir BRAMU** para eventos realmente importantes, punto ya confirmado para analizar después de la ronda h10.

Principio:
> Un cambio externo importante no debe obligar al usuario a comparar mentalmente la pantalla anterior con la actual para descubrir qué cambió.

Evitar:
- badges permanentes;
- duplicar el mismo aviso en 3 lugares con igual peso;
- convertir Home en un centro de alertas.

**Pendiente de definición visual:** decidir qué combinación exacta usar según severidad del evento:
- carga nueva que requiere acción;
- carga nueva informativa;
- validación;
- corrección aceptada;
- identidad resuelta.



### 15.29 — Retorno h10: Home calibrado — revisión física — 27/09/2026

Evidencia: Home real en iPhone de Seba y Home escritorio de Esteban sobre `04.11-h10`.

#### PASS visual
- borde/acento de `ÚLTIMO PARTIDO` por resultado funciona bien:
  - derrota → rojo;
  - victoria → verde.
- botón central `+` quedó mejor centrado y con mayor presencia general.
- tarjeta calibrada volvió a una composición limpia de identidad + Nivel, sin píldora persistente `NIVEL CALIBRADO`.
- Home general se considera visualmente aceptable para seguir la ronda.

#### Botón central `+`
**UX / VISUAL MENOR:** el SVG está centrado, pero el trazo del símbolo se percibe demasiado fino.
Dirección: engrosar moderadamente el trazo sin aumentar nuevamente el diámetro del botón.

#### Barra debajo del Nivel
Sebastián propone recuperar una barra visual interpretada como “progreso dentro de 5.9”.

**PRODUCTO — NO IMPLEMENTAR ASÍ.**
La barra anterior correspondía a progreso de calibración/evidencia, no a una progresión lineal de 5.9 → 6.0. Nivel BRAMU no funciona como XP: puede subir o bajar en cada partido y el decimal público es una estimación redondeada.

Si más adelante se desea una señal debajo del Nivel, solo podría representar una variable real registrada (por ejemplo confiabilidad/evidencia), con copy explícito y sin sugerir “te falta X para subir”. La fuente maestra permite describir confiabilidad como baja/media/alta, pero no obliga a exponerla en Home.

Dirección actual para Home calibrado: **sin barra de progreso al siguiente nivel**.

#### Padding de Último partido
Sebastián percibe la tarjeta algo más aireada que módulos como `TU MOMENTO`.

**UX / VISUAL — A AJUSTAR SOLO SI LA COMPARATIVA CSS CONFIRMA INCONSISTENCIA.**
Preferir tokens/padding compartidos del sistema antes que un valor particular para Último partido. No reducir todavía por apreciación aislada si rompe la jerarquía de la tarjeta destacada.

#### Header / degradé iPhone
El degradé/fade superior todavía se percibe en iPhone, mientras en escritorio no.

**UX / VISUAL — PARCIALMENTE NO CERRADO.**
No bloquea la ronda, pero el punto I de la checklist no se da por PASS definitivo. Revisar nuevamente durante scroll/overscroll en iPhone antes de cerrar h10.



### 15.30 — Baseline funcional h11 / hotfix de validación — 27/09/2026

Durante el QA de `04.11-h10` se detectó un bug real: un partido podía permanecer en `pending_validation` aunque ambas parejas ya hubieran confirmado.

Central diagnosticó la causa y Claude implementó un hotfix de self-healing.

**Nueva baseline del Laboratorio:**
- BRAMUlab V04.11
- bundle `04.11-h11`

Central verificó E2E en Supabase Staging con el mismo partido real que había quedado trabado (`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`):
- `officialize-match` respondió 200;
- el partido pasó automáticamente a `validated`;
- quedó con resultado de Nivel aplicado.

**TÉCNICO — CERRADO.**
No repetir el caso desde cero.

Durante el resto del recorrido físico, solo comprobar si aparece naturalmente que:
- el partido ya figure oficial/validado;
- no exista una acción pendiente falsa.

El resto del checklist continúa desde donde quedó, tomando `04.11-h11` como nueva baseline.


### 15.31 — Retorno h11: barra de Nivel, Resumen/Reportar error e inconsistencia de identidad — 27/09/2026

Baseline física: BRAMUlab V04.11 / bundle `04.11-h11`.

#### Home — barra visual debajo del Nivel

**CORRECCIÓN DE INTERPRETACIÓN respecto de §15.29.**

La barra que Sebastián pide recuperar NO debe interpretarse como “progreso lineal de 5.9 hacia 6.0”.

Su función visual previa era acompañar el Nivel y comunicar evolución reciente, incluyendo si el Nivel venía subiendo o bajando (por ejemplo delta reciente), como parte estable de la identidad visual del bloque.

**PRODUCTO / UX — CONFIRMADO: RECUPERAR.**

Dirección:
- recuperar la barra debajo del Nivel en estado calibrado;
- no presentarla como XP ni porcentaje restante hasta el siguiente decimal;
- conservar el indicador/delta reciente cuando exista dato real para mostrarlo;
- si no existe evidencia suficiente para un delta reciente, no fabricar una lectura.

#### Home — padding de Último partido

Sebastián verificó visualmente/CSS que los módulos comparables usan 16 px y `Último partido` usa aproximadamente 22/20.

**UX / VISUAL — CONFIRMADO.**

Dirección:
- unificar `Último partido` al padding base de 16 px del resto del sistema, salvo que una restricción técnica concreta lo impida.

#### Resumen del partido — grilla de nombres / sets / divisores

En h11 la composición del resultado sigue rota visualmente:
- el renglón inferior de la pareja no queda centrado correctamente;
- la separación entre nombres, cajas de sets y `result-card__divider` genera una lectura visual confusa;
- en iPhone se percibe peor que en desktop.

**UX / VISUAL — CONFIRMADO.**

Dirección:
- revisar la estructura de la grilla, no solo márgenes aislados;
- alinear verticalmente cada pareja con sus boxes de sets;
- separar claramente divisor de fila y divisor de bloque estadístico;
- conservar nombres de parejas y resultado como una única unidad legible.

#### Reportar un error — jerarquía

El CTA `REPORTAR UN ERROR` en mayúsculas resulta demasiado pesado.

**UX / VISUAL — PROPUESTA CONFIRMADA PARA IMPLEMENTAR.**

Dirección:
- copy en caja normal: `Reportar un error`;
- tratamiento secundario/destructivo suave, preferentemente borde/texto rojo;
- no competir visualmente con acciones positivas principales.

La hoja `¿QUÉ ESTÁ MAL?` con `El resultado` y `Un participante` se percibe demasiado comprimida por encerrar cada opción en una tarjeta completa.

Dirección:
- probar opciones más livianas, con separación/divisor simple y suficiente área táctil;
- mantener claridad de título + subtítulo sin convertir cada alternativa en una tarjeta pesada.

#### Corrección de resultado

**PASS PARCIAL.**
La nueva hoja se entiende mejor que la versión anterior:
- nombres de las dos parejas visibles;
- color de equipo consistente;
- sets visibles como unidades.

Todavía requiere terminar de validar la interacción real de edición/aceptación cuando exista una corrección adecuada.

#### Identidad cuestionada — copy y continuidad del flujo

El copy actual `¿Confirmás que no participó?` / `Sí, no participó` resulta lingüísticamente extraño.

**UX / COPY — CONFIRMADO.**

Dirección conceptual:
- formular la confirmación alrededor de la identidad concreta, por ejemplo `¿Estás seguro de que no fue Lucho?`;
- botones simples y no ambiguos.

Después de confirmar una identidad incorrecta, hoy se muestra `Identidad cuestionada` y el usuario debe volver a entrar a `Resolver`.

**UX / PRODUCTO — CONFIRMADO.**

Dirección:
- si quien reporta ya sabe quién jugó realmente, ofrecer inmediatamente el siguiente paso `¿Sabés quién jugó?` / búsqueda de reemplazo dentro del mismo flujo;
- mantener opción de dejar el slot `Por identificar` si no lo sabe;
- no obligar a cerrar y reabrir el partido solo para continuar una corrección que acaba de iniciar.

La búsqueda de reemplazo debe reutilizar el mismo patrón visual de búsqueda global y mostrar siempre:
- avatar/foto si existe;
- nombre visible;
- `@usuario`;
- Nivel BRAMU vigente.

También debería mostrar `Recientes` cuando haya jugadores con relación/contexto útil y datos reales.

#### BUG DE IDENTIDAD / FUENTE DE DATOS — mismo jugador cambia según la ruta

Durante h11 se observó un caso materialmente más grave que un simple detalle visual.

El mismo jugador `Matu` se representa de forma distinta según desde dónde se abra:
- en `Buscar jugadores`: foto real, `@matu_qa`, Nivel 5.9 y perfil estadístico completo;
- en el selector de reemplazo de identidad: nombre + `@matu_qa`, pero sin avatar ni Nivel;
- en `Compañeros`: inicial `M` en vez de foto;
- al abrir a Matu desde `Compañeros`: aparece otro perfil, con `@matu`, Nivel 6.3 y datos personales vacíos;
- al abrirlo desde `Buscar jugadores`: aparece `@matu_qa`, Nivel 5.9, avatar y estadísticas correctas.

**CLASIFICACIÓN: BUG / IDENTIDAD — PRIORIDAD ALTA.**

Esto no debe tratarse como polish. Un mismo jugador no puede resolver a identidades/perfiles distintos según la superficie de entrada.

Requerimiento:
- identificar si algunas superficies están resolviendo por nombre/fixture/local cache/legacy id en vez de `player_id` real;
- unificar todas las superficies sobre la misma identidad canónica;
- avatar, `@usuario`, Nivel y estadísticas deben provenir del mismo jugador real;
- NO hacer matching por nombre libre;
- no continuar diseñando encima de esta inconsistencia como si fuera solamente un problema de componente.

Por tratarse de identidad/datos, este punto sí amerita intervención técnica durante el Laboratorio antes de seguir cerrando visualmente esas superficies.


### 15.32 — Corrección post-validación: verdad oficial vs propuesta y UX de aceptación — 27/09/2026

Baseline física: BRAMUlab V04.11 / bundle `04.11-h11`.

Durante el Laboratorio se probó una corrección real sobre un partido YA validado: el resultado oficial vigente era Seba/Matu vs Esteban/Gusti y Seba propuso una corrección que agregaba un tercer set y cambiaba el ganador final.

#### Semántica de producto — YA DEFINIDA / NO CAMBIAR

La fuente maestra `Experiencia_Inicial.md` §12.3 define que, durante una corrección normal posterior a validación:

- la última versión validada sigue siendo la versión oficial;
- la propuesta NO reemplaza el resultado oficial mientras espera respuesta;
- la otra pareja debe aceptarla para convertirla en nueva versión oficial;
- recién al aceptar se recalculan de forma atómica los efectos dependientes del cambio.

Por lo tanto, NO hacer que Home/Historial reemplacen silenciosamente el resultado oficial por el propuesto antes de aceptación.

#### Problema UX observado

Aunque la semántica actual es correcta, la presentación de h11 no explica suficientemente la coexistencia de dos versiones.

En Home:
- se mantiene el resultado oficial;
- aparece una píldora pequeña `CORRECCIÓN PROPUESTA`;
- no queda claro qué se propuso ni que el resultado visible sigue siendo el oficial anterior.

En Resumen, para la pareja que debe responder:
- la primera gran tarjeta sigue mostrando ganadores/resultado oficial sin etiquetarlo explícitamente como `Resultado oficial actual`;
- el texto `Seba propuso una corrección del resultado. ¿La aceptás?` queda demasiado chico y separado de la información relevante;
- los cambios concretos aparecen como texto secundario muy débil;
- `ACEPTAR CORRECCIÓN` y `RECHAZAR` tienen tamaños/jerarquías inconsistentes;
- si la propuesta cambia al ganador, la pantalla puede sentirse contradictoria porque arriba se ve un ganador y abajo se pide aceptar una propuesta que lo cambiaría.

**CLASIFICACIÓN: UX / VISUAL — CONFIRMADO.**

#### Dirección confirmada

La pantalla de respuesta debe hacer explícito el antes/después.

Propuesta de estructura:

1. bloque principal etiquetado `Resultado oficial actual`;
2. bloque inmediatamente asociado `Corrección propuesta por Seba`;
3. mostrar la propuesta completa, no solo una frase delta:
   - parejas;
   - sets propuestos;
   - ganador resultante;
4. opcionalmente resumir debajo el delta concreto (`Set 2: 3–6 → 6–0`, `Set 3 agregado: 6–0`) como trazabilidad secundaria;
5. botones `Aceptar corrección` y `Rechazar` con misma altura/alineación; aceptar primario y rechazar secundario.

No presentar dos resultados sin rótulos claros.

Para quien PROPUSO:
- mantener el resultado oficial como verdad vigente;
- mostrar un estado visible `Corrección propuesta` / `Esperando respuesta de la otra pareja`;
- al abrir el Resumen, permitir ver claramente la propuesta completa enviada.

Para Home/Historial:
- conservar el resultado oficial hasta aceptación;
- usar un estado visible de revisión (`CORRECCIÓN PROPUESTA`) separado de VICTORIA/DERROTA;
- no cambiar el resultado ni la condición oficial antes de aceptación;
- el estado debe llevar al Resumen donde se ve el antes/después.

Cuando la otra pareja ACEPTA:
- la propuesta pasa a ser la nueva versión oficial;
- Home, Historial, Resumen, Nivel e Intelligence se actualizan sobre esa nueva verdad según las reglas vigentes.

#### PASS funcional observado

La nueva edición de resultado ya permite, en esta prueba, proponer un tercer set y cambiar el ganador final. Esa capacidad que antes faltaba sí aparece operativa en h11.

No repetir este caso con otro partido solo para demostrar lo mismo salvo que aparezca una regresión nueva.

#### Relación con `Reportar un error`

Se mantiene lo ya definido en §15.31:
- `Reportar un error` como CTA secundario, en caja normal y tratamiento visual suave;
- selector `¿Qué está mal?` más liviano, no dos tarjetas pesadas;
- flujo de identidad continuo;
- búsqueda de jugadores con patrón único (avatar + nombre + @usuario + Nivel).

El problema de identidad canónica detectado en §15.31 sigue siendo PRIORIDAD ALTA y debe resolverse antes de considerar cerradas visualmente las superficies de búsqueda/perfil.


### 15.33 — Corrección post-validación: prioridad visual de la propuesta + bug del editor de sets — 27/09/2026

Baseline física: BRAMUlab V04.11 / bundle `04.11-h11`.

Esta sección amplía §15.32 con dos precisiones observadas inmediatamente después.

#### La propuesta sigue sin ser oficial, pero debe sentirse de primer nivel

Se mantiene la regla de producto ya cerrada en `Experiencia_Inicial.md`: mientras la otra pareja no acepte, la última versión validada sigue siendo la versión oficial.

Pero visualmente la corrección propuesta no puede quedar reducida a una píldora secundaria casi decorativa.

Cuando existe una corrección activa sobre un partido oficial:
- el resultado oficial sigue siendo la verdad vigente;
- la propuesta pasa a ser el evento principal pendiente de resolución de ese partido;
- en el Resumen debe tener jerarquía comparable al resultado oficial, con un antes/después claro;
- para la pareja que debe decidir, el foco principal de la pantalla es entender qué cambiaría y aceptar/rechazar;
- en Home/Historial puede mantenerse el resultado oficial, pero el estado de corrección debe ser suficientemente visible para que no parezca un partido cerrado sin novedad.

Principio:
> La propuesta no reemplaza a la verdad oficial, pero mientras está abierta sí reemplaza al estado “normal/cerrado” del partido.

Esto refuerza la dirección de §15.32: mostrar `Resultado oficial actual` + `Corrección propuesta` como dos bloques claramente relacionados, sin hacer parecer que uno de ellos no importa.

#### BUG — editor de corrección no inicializa/actualiza correctamente el par de games del set

Se detectó un bug funcional concreto en el editor de corrección de resultado.

Caso observado:
- el set oficial visible era, por ejemplo, `2–6`;
- Sebastián modifica solo el lado `2` a `3`;
- el `6` contrario sigue visible en pantalla;
- sin embargo, `Enviar corrección` no queda habilitado hasta volver a seleccionar manualmente ese mismo `6`.

Segundo caso:
- si el set actual es `3–6` y se quiere invertir a `6–4`;
- al editar primero el lado que tenía `3`, el valor `6` aparece deshabilitado porque todavía está seleccionado en el lado contrario;
- esto impide temporalmente cargar el nuevo resultado aunque la intención sea cambiar ambos lados del mismo set.

**CLASIFICACIÓN: BUG / INTERACCIÓN — PRIORIDAD ALTA para este flujo.**

Comportamiento esperado:
- al abrir un set existente, ambos valores visibles deben estar cargados realmente en el estado interno del editor;
- modificar un solo lado debe conservar el otro valor ya existente sin exigir re-seleccionarlo;
- el CTA debe validar el par completo real que se ve en pantalla, no solo los valores tocados durante esa sesión;
- al querer intercambiar ganador/perdedor del set, la restricción de valores no debe bloquear por el valor viejo del otro lado;
- el usuario debe poder editar cualquiera de los dos lados en cualquier orden;
- si por reglas de score hace falta limpiar automáticamente un valor incompatible, hacerlo de forma explícita y comprensible, no mediante botones aparentemente inválidos por estado stale;
- la lógica visual y la lógica de validación deben leer la misma fuente de estado.

No resolver esto con un parche cosmético: revisar inicialización del score del set y la lógica de habilitación/deshabilitación del keypad.

#### Estado de esta ronda

Con este bug ya existe evidencia suficiente para frenar el Laboratorio y pasar el paquete a Desarrollo.

No repetir otro partido para demostrar el mismo problema salvo que Claude necesite un caso mínimo reproducible adicional.


### 15.34 — Ronda correctiva técnica ejecutada sobre h11 (P1–P5) — 27/09/2026

Baseline técnica: BRAMUlab V04.11 / bundle `04.11-h12`.

**Estado: implementado y verificado técnicamente (suite completa + inspección de código/CSS real). PENDIENTE de validación física — ninguno de los puntos siguientes debe leerse como PASS de Laboratorio hasta que Sebastián lo vea en el dispositivo real.**

Resumen objetivo de lo que cambió, sin repetir el detalle completo (ver `41_Resultado_Ronda_Correctiva_Laboratorio_h12_27SEP.md` para causa raíz/archivos/tests):

- **P1 — identidad canónica de Matu:** causa raíz encontrada y corregida (Compañeros/Rivales resolvían por un helper local pre-backend y navegaban al perfil público por nombre plano en vez de `player_id`). Ninguna cuenta fue fusionada ni borrada.
- **P2 — editor de sets:** los dos casos reportados (2–6→3–6 sin re-tocar el 6; 3–6→6–4 empezando por el lado que tenía el 3) quedaron cubiertos por 12 tests nuevos dinámicos/estáticos, además del mismo fix aplicado al editor mellizo de Cargar partido (mismo bug latente, nunca reportado ahí pero con idéntico patrón de código).
- **P3 — corrección post-validación:** la semántica (última versión validada sigue oficial hasta aceptar) no cambió. La pantalla de respuesta ahora rotula "Resultado oficial actual" + "Corrección propuesta por [nombre]" con una tarjeta de resultado completa para la propuesta, delta como trazabilidad secundaria debajo.
- **P4 — componente único de jugador + flujo de identidad:** el sheet de reemplazo de identidad pasa a mostrar avatar/Nivel reales (antes solo nombre + @usuario) y suma Recientes; confirmar una identidad incorrecta abre directo la búsqueda de reemplazo en el mismo flujo, sin volver a tocar RESOLVER; copy actualizado con el nombre real de la persona.
- **P5 — visual:** barra bajo el Nivel calibrado recuperada (sin delta fabricado — ver nota de producto en el Resultado), padding de Último partido unificado a 16px, grilla del Resumen realineada (bug real de altura de celda encontrado), "Reportar un error" en copy normal + tratamiento secundario/rojo suave + opciones más livianas, trazo del + engrosado.

No tocado (fuera de alcance de esta ronda, según el handoff): BRAMUlive, `main`, Production, Mis grupos, hotfix h11 de self-healing, fórmula de Nivel/Ranking/Intelligence.

Batería física corta para la próxima pasada — ver el Resultado de esta ronda para el detalle agrupado en 5 bloques.

**Addendum 27/09/2026 — bundle `04.11-h13`:** revisión de código de Central sobre h12 encontró 4 puntos del handoff 40 incompletos (quien propone una corrección no veía su propuesta completa; `CORRECCIÓN PROPUESTA` seguía demasiado secundaria en Home/Historial; Compañeros/Rivales no mostraban Nivel pese a ya tener el dato disponible; la salida "Por identificar" no era una acción explícita del sheet de identidad). Los 4 quedaron implementados — detalle completo en [`43_Resultado_Correccion_Central_h13_27SEP.md`](43_Resultado_Correccion_Central_h13_27SEP.md). Sigue pendiente la misma validación física original, ahora sobre `04.11-h13`.


### 15.35 — Cierre de gate UX h16 tras validación real de Staging — 27/09/2026

Baseline final revisada:
- **BRAMUlab V04.11**
- **bundle `04.11-h16`**

Esta sección consolida y cierra la ronda iniciada por `45_Handoff_Cierre_UX_h13_27SEP.md`. Para estos puntos, esta sección prevalece sobre estados intermedios de §15.31–§15.34.

#### Incidente bloqueante h14 → h15 — CERRADO

Durante el gate visual real sobre h14 se detectó una regresión runtime:
- Home mostraba 8 partidos pero `Último partido` quedaba falsamente en Estado Cero;
- después de una recarga normal la app podía quedar negra;
- consola: `TypeError: "...".datetime is not a function` dentro de `renderPlayerLastMatchCard`.

Causa raíz confirmada: backticks crudos dentro de un comentario HTML incluido en un template literal JS cerraban el template y hacían interpretar `.datetime` como código.

Hotfix `04.11-h15`: **PASS REAL**.
Retest con sesión nueva de Seba / `@seba_qa`:
- historial real visible;
- Último partido real visible;
- refresh server-backed estable;
- recarga normal estable;
- consola sin errores;
- sin regresión de `renderPlayerLastMatchCard`.

No volver a reabrir este incidente salvo regresión concreta.

#### Gate visual del cierre UX — estado 1–11

1. **Nivel BRAMU — CERRADO CON EVIDENCIA COMBINADA.**
   - PASS visual real: Seba 6.0 muestra barra vacía/al inicio;
   - PASS visual real: no aparece delta inventado;
   - la variante decimal de Esteban 5.8 no pudo verse desde su Home sin cambiar de cuenta;
   - comportamiento decimal queda cubierto por la misma función pura `PH.levelProgressPct` ya validada técnicamente.
   - No reabrir por falta de una segunda cuenta salvo que aparezca una discrepancia visual real.

2. **Último partido con corrección — PASS VISUAL REAL.**
   - fecha/hora arriba a la derecha;
   - `CORRECCIÓN PENDIENTE` debajo, en ámbar;
   - forma + VICTORIA/DERROTA mantienen posición;
   - score oficial permanece intacto mientras la corrección no es aceptada.

3. **Grilla del Resumen — PASS DESKTOP / MÓVIL NO VERIFICABLE POR WORK.**
   - PASS real en desktop con partidos de 2 y 3 sets;
   - parejas/games alineados;
   - divisor continuo;
   - Work no pudo producir un viewport móvil real 390×844 sin simular/modificar el documento.
   - No existe FAIL móvil observado en h16; si reaparece un defecto en iPhone durante uso natural, se reabre con esa evidencia concreta.

4. **Oficial vs propuesta — PASS VISUAL REAL.**
   - resultado oficial y propuesta se distinguen sin ambigüedad;
   - copy humano del cambio;
   - mismas grillas;
   - aceptar/rechazar con composición equilibrada.

5. **Reportar un error — PASS VISUAL REAL en h16.**
   - h15 falló porque `.btn-secondary` forzaba mayúsculas pese a que el DOM ya decía `Reportar un error`;
   - h16 agrega override local, sin tocar sistema global de botones;
   - retest Work: **PASS VISUAL**;
   - sentence case real;
   - tratamiento secundario/rojo suave;
   - selector `El resultado` / `Un participante` liviano.

6. **Identidad incorrecta continua — PARCIAL REAL + TÉCNICO, NO BLOQUEANTE.**
   - PASS visual real del copy `¿Seguro que no fue Matu?`;
   - Work no ejecutó `SÍ, NO FUE` porque habría modificado identidad real;
   - continuidad hacia búsqueda + `No sé · dejar Por identificar` queda respaldada por implementación/tests, pero no se fabrica una incidencia solo para obtener una captura.
   - Revalidar únicamente si este flujo vuelve a usarse naturalmente en Laboratorio.

7. **Patrón canónico de jugador — PASS VISUAL REAL.**
   - Matu mantiene avatar, nombre, `@matu_qa`, Nivel y mismo Perfil público entre superficies observadas;
   - identidad resuelta por `player_id`.

8. **Mi Perfil → Jugadores — PASS VISUAL REAL.**
   - buscador siempre visible;
   - listado debajo;
   - búsqueda global en el mismo panel;
   - sin pantalla puente.

9. **Cargar partido — PASS DESKTOP / MÓVIL NO VERIFICABLE POR WORK.**
   - metadata real arriba de Equipo A/B;
   - formato, sets, puntuación y fecha/hora visibles;
   - sin duplicación;
   - Work no pudo generar viewport móvil real sin simular.
   - Si iPhone muestra solapamiento/orden incorrecto durante uso natural, reabrir con evidencia concreta; no repetir por defecto.

10. **`sync_pending` / `necesita_revision` — NO VERIFICABLE VISUALMENTE, NO BLOQUEANTE.**
    - no existían tarjetas reales con esos estados;
    - generar el caso exigía fabricar/alterar outbox;
    - se decidió NO inventar fixture ni corromper una carga solo para validar visualmente;
    - implementación y comportamiento idempotente siguen cubiertos técnicamente.
    - Revalidar cuando un estado real aparezca.

11. **Notificaciones — PASS VISUAL REAL.**
    - lenguaje humano;
    - actor + rivales + score;
    - sin vocabulario técnico;
    - título y cuerpo no repiten la misma idea.

#### Decisiones UX cerradas de esta ronda — NO dispersar / NO reinterpretar

Quedan como dirección vigente:

- barra de Nivel calibrado = fracción decimal del Nivel visible, nunca XP/progreso por cantidad de partidos;
- delta de Nivel solo con evidencia real;
- corrección activa no mueve la geometría de Último partido;
- score oficial permanece oficial hasta aceptación de corrección;
- `Resultado oficial actual` y `Corrección propuesta` se muestran como dos bloques de primer nivel relacionados;
- grilla de resultado compartida/canónica para resultado oficial y propuesta;
- `Reportar un error` siempre en sentence case y como acción secundaria;
- identidad incorrecta debe continuar dentro del mismo flujo hacia reemplazo o `Por identificar`;
- identidad de jugador en superficies server-backed siempre por `player_id`, con avatar/@usuario/Nivel coherentes;
- Mi Perfil → Jugadores integra buscador y lista en el mismo espacio;
- metadata de Cargar partido vive antes de Equipo A/B;
- `sync_pending` y `necesita_revision` son estados distintos y deben explicarse de forma distinta;
- notificaciones deben usar lenguaje humano/de pádel, no nombres técnicos del workflow.

#### Veredicto de esta ronda

**APTO PARA RETOMAR LABORATORIO FÍSICO sobre `04.11-h16`.**

Esto NO significa que los estados no verificables hayan recibido PASS ficticio.

Regla para la próxima pasada:
- no repetir casos ya cerrados;
- observar los puntos parcialmente/no verificables únicamente si aparecen de forma natural;
- cualquier nuevo FAIL debe registrarse como evidencia nueva y concreta;
- no reabrir decisiones UX cerradas de esta sección sin una regresión real.


### 15.36 — Reapertura por regresiones visuales reales sobre h16 — 27/09/2026

Baseline física observada:
- **BRAMUlab V04.11**
- **bundle `04.11-h16`**
- dispositivo: iPhone físico / uso real de Seba

Esta evidencia reabre únicamente los puntos afectados del gate de §15.35. No es una reinterpretación de producto: son regresiones visibles contra decisiones ya cerradas.

#### FAIL 1 — Último partido con corrección activa

**Clasificación:** UX / VISUAL — REGRESIÓN REAL.

Evidencia física:
- `CORRECCIÓN PENDIENTE` sigue renderizada como una píldora/tarjeta visual dominante a la derecha;
- al aparecer, altera la composición del bloque superior de Último partido;
- la fila de forma + VICTORIA queda desplazada hacia abajo respecto del estado normal;
- esto contradice el criterio cerrado de que la corrección activa no debe mover la geometría de Último partido.

**Estado:** REABIERTO. El PASS de §15.35 punto 2 queda invalidado por esta evidencia.

#### FAIL 2 — Aceptar / Rechazar corrección

**Clasificación:** UX / VISUAL — REGRESIÓN REAL.

Evidencia física:
- `Aceptar corrección` y `Rechazar` siguen viéndose como componentes de tamaños/composición distintos;
- el primario queda más alto por el wrap del texto y el secundario más bajo;
- no se cumple la decisión cerrada: misma altura y composición equilibrada.

**Estado:** REABIERTO. El PASS de §15.35 punto 4 queda invalidado por esta evidencia.

#### Hallazgo de proceso — gate h16 produjo falsos positivos

Las dos regresiones anteriores estaban expresamente cubiertas por:
- `45_Handoff_Cierre_UX_h13_27SEP.md`;
- los criterios de aceptación de §15.35.

Sin embargo fueron declaradas PASS y devueltas a QA físico.

**Conclusión operativa:** no pedir a Sebastián que siga comprobando visualmente el resto de la batería como si h16 fuera confiable. Antes de otra ronda humana, Central debe auditar el bundle real contra los criterios 1–11 y distinguir:
- comprobación estructural/test automático;
- comprobación visual real;
- puntos no verificables.

Ningún criterio visual debe declararse PASS por inferencia desde tests de estructura/CSS si el criterio pedía composición visual.

#### Próximo gate obligatorio

Antes de volver a Sebastián:
1. corregir los dos FAIL anteriores;
2. revisar de nuevo todos los puntos visuales del handoff 45 contra la implementación real de h16;
3. no usar como evidencia suficiente tests que solo verifican presencia de clases, slots, helpers o reglas CSS;
4. registrar explícitamente cualquier punto que no pueda validarse visualmente;
5. entregar una nueva baseline solo después de esa auditoría.

**Regla:** Sebastián no debe repetir pruebas ya hechas para descubrir incumplimientos que el gate interno podía detectar.
