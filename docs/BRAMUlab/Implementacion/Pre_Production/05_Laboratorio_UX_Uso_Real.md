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
