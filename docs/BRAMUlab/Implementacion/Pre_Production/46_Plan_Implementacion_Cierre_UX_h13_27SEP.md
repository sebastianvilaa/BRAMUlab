# BRAMUlab — Plan único de implementación · cierre UX tras QA físico h13

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline:** BRAMUlab V04.11 / bundle `04.11-h13`  
**Fuente de autoridad de esta ronda:** `45_Handoff_Cierre_UX_h13_27SEP.md`  
**Objetivo de salida:** una única implementación consolidada sobre `staging`, idealmente un único commit/push/deploy, con todos los puntos 1–11 del documento 45 resueltos o explícitamente justificados antes de devolver la app a QA humano.

---

## 0. Regla operativa

Esta ronda NO se divide en microcorrecciones.

Claude debe:

1. leer las fuentes obligatorias;
2. revisar el código actual contra cada criterio literal del 45;
3. implementar toda la tanda compatible de una sola vez;
4. probar riesgos concretos localmente;
5. revisar el diff completo;
6. hacer idealmente un único commit lógico;
7. push a `origin/staging`;
8. permitir un único deploy intencional de BRAMUlab;
9. dejar un resultado trazable punto por punto.

**Importante:** los tests/DOM/CSS pueden demostrar estructura y regresiones, pero NO constituyen por sí solos PASS visual. Claude no debe declarar “apto para Laboratorio”. Ese gate corresponde a Central después del deploy, con revisión técnica + visual.

Si aparece una imposibilidad técnica REAL para cumplir exactamente un criterio:
- documentarla en el resultado;
- explicar qué evidencia la causa;
- continuar todo lo demás;
- no reinterpretar el pedido ni sustituirlo silenciosamente por otra solución.

No pedirle a Sebastián pruebas intermedias.

---

## 1. Lectura obligatoria

Leer en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Pre_Production/45_Handoff_Cierre_UX_h13_27SEP.md`
4. `docs/BRAMUlab/Experiencia_Inicial.md`
5. `docs/BRAMUlab/Backend_Infraestructura.md`
6. fuente maestra de Nivel solo para presentación/datos disponibles, **no para modificar fórmula**.

No usar Archivo/Backup/handoffs consumidos como autoridad.

---

# 2. Hallazgos confirmados por Central en el código h13

Estos puntos ya fueron constatados antes de escribir este plan y no necesitan una nueva auditoría histórica.

## 2.1 Barra de Nivel

En el camino server-backed calibrado de Home, h13 hace:

- barra visible;
- `barEl.style.width = '100%'`.

Eso contradice directamente el punto 1 del 45.

La app YA tiene `PH.levelProgressPct(...)`, cuyo contrato histórico es exactamente “decimal dentro del entero actual”.

Por lo tanto, **REEMPLAZAR** el 100% fijo por el progreso decimal real del Nivel visible.

Ejemplos obligatorios:
- 5.8 → ~80%;
- 6.0 → 0%;
- 6.1 → ~10%.

No tocar fórmula de Nivel.

Delta:
- mostrar `↑/↓ X.X` solo si existe evidencia REAL accesible;
- si el cliente no tiene un before/after real, ocultar el chip;
- no fabricar delta ni deducirlo de la barra.

## 2.2 Cargar partido — metadata

En `index.html` h13, `.court-meta-compact` sigue físicamente **después** de `.court-team-cards`.

El 45 exige el orden inverso.

**MOVER el mismo bloque existente**, sin duplicarlo:

1. header `CARGAR PARTIDO`;
2. metadata compacta;
3. Equipo A;
4. Equipo B;
5. sets.

Conservar los handlers existentes de formato y fecha/hora/lugar.

## 2.3 Notificaciones

h13 todavía contiene títulos técnicos:

- `[Nombre] propuso una corrección`;
- `[Nombre] aceptó la corrección`;
- `[Nombre] resolvió un participante`;
- `[Nombre] cuestionó un participante`.

El backend ya entrega `actorPlayerId`/actor específico y `matchContext` con rivales + score. No abrir backend para cambiar copy.

**REEMPLAZAR en frontend** por lenguaje humano/de pádel según §11 del 45.

## 2.4 Último partido con corrección

El estado de corrección vive dentro de `.player-home-lastmatch__datetime` como badge inline. Al aparecer agrega alto real al encabezado y empuja el contenido inferior.

El criterio obligatorio es **invariancia geométrica**:
activar/desactivar una corrección no debe cambiar la posición vertical de:
- forma reciente;
- VICTORIA/DERROTA.

Resolver estructuralmente, no achicando solo el badge.

## 2.5 Grilla de resultado

La corrección h12/h13 basada en `align-items:stretch` no alcanzó físicamente.

El componente canónico debe corregirse estructuralmente y después ser reutilizado por:
- Resumen oficial;
- Confirmar partido si usa la misma tarjeta;
- preview de corrección propuesta.

No crear dos grillas que puedan volver a divergir.

---

# 3. Implementación requerida, punto por punto

## P0-A — Nivel BRAMU: barra decimal real

**REEMPLAZAR**

- barra calibrada server-backed al 100% fijo;
- cualquier tratamiento que interprete la barra como progreso por partidos.

**USAR**
- valor real de Nivel ya mostrado;
- `PH.levelProgressPct` o una función pura equivalente única.

**TESTS**
- 5.8 → 80%;
- 6.0 → 0%;
- 6.1 → 10%;
- nivel con más decimales respeta redondeo visual esperado;
- chip delta ausente sin evidencia;
- chip delta presente solo con dato real.

No modificar cálculo de `mu`, elegibilidad, calibración ni motor.

---

## P0-B — Último partido: corrección activa sin mover el layout

**REEMPLAZAR** la composición actual que deja al estado agregar altura variable antes de la fila de forma.

Objetivo visual:

- título a la izquierda;
- fecha/hora arriba a la derecha;
- estado corto debajo de fecha/hora;
- forma + VICTORIA/DERROTA siempre en una posición fija e idéntica exista o no corrección;
- copy preferido: `CORRECCIÓN PENDIENTE`;
- ámbar discreto;
- acento/borde ámbar del card mientras la corrección está activa;
- score oficial intacto hasta aceptación.

Soluciones válidas:
- grid con áreas explícitas;
- bloque derecho con slot de estado de altura reservada;
- posición absoluta acotada dentro del header si no rompe accesibilidad/layout.

No aceptar como solución “hacer el badge más chico” si la fila 2 sigue desplazándose.

**TEST estructural:** estado ausente/presente no cambia el orden ni crea una fila adicional antes de `.player-home-lastmatch__row2`.

**Gate visual posterior de Central:** comparar ambos estados en móvil.

---

## P0-C — Grilla canónica de resultado

**REEMPLAZAR estructuralmente** la grilla actual del resultado.

Cada pareja debe ser UNA fila de tabla deportiva:

- columna izquierda: nombres de la pareja;
- columna derecha: games de todos los sets;
- Set 1/2/3 alineados entre ambas filas;
- divisor entre parejas continuo a través del ancho útil del bloque;
- alturas y baseline coherentes;
- 2 y 3 sets deben funcionar sin deformación.

Recomendación: un único CSS Grid para las dos filas, con columnas del tipo:

`minmax(0, 1fr) repeat(n, scoreWidth)`

o una construcción equivalente donde nombres y scores pertenezcan a la MISMA fila/layout, no dos fragmentos visuales independientes.

No depender de bordes en hijos separados que deban “coincidir” ópticamente.

**FUSIONAR**:
- `buildScoreCardHTML`;
- `buildCorrectionPreviewCardHTML`;

para que ambos consuman la misma primitiva/markup de filas de score. La propuesta puede seguir omitiendo stats/duración, pero la grilla de marcador debe ser exactamente la misma.

**Aceptar técnicamente solo si** el DOM demuestra una única estructura de row/grilla para oficial y propuesta. El PASS visual lo hace Central luego.

---

## P0-D — Oficial vs. propuesta

Mantener semántica vigente sin cambios.

### Visual

- centrar `RESULTADO OFICIAL ACTUAL`;
- centrar `CORRECCIÓN PROPUESTA` / `TU CORRECCIÓN PROPUESTA`;
- misma grilla canónica del P0-C en ambos bloques;
- propuesta con peso visual de primer nivel;
- separación clara pero no convertirla en un apéndice.

### Copy humano del cambio

**REEMPLAZAR** el delta técnico aislado como lectura principal.

Crear una función pura de resumen humano basada exclusivamente en:
- sets oficiales;
- sets propuestos;
- actor real cuando esté disponible.

Ejemplos de salida:
- `Esteban indica que el segundo set fue 6–4, no 6–0.`
- múltiples cambios: una frase breve que enumere los sets relevantes sin sonar a diff de sistema.
- set agregado/eliminado: explicarlo en lenguaje humano.

Puede conservarse un diff técnico menor solo si aporta trazabilidad, pero no debe ser la explicación principal.

No inventar nombre de actor: si no es resoluble, usar formulación neutra (`La otra pareja indica...`).

### Acciones

- misma altura;
- misma base/composición;
- aceptar primario;
- rechazar secundario;
- sin estilos inline divergentes si eso dificulta paridad.

Agregar clase compartida/estructura explícita para la pareja de botones si hace falta.

---

## P0-E — Cargar partido: metadata antes de equipos

Mover el bloque existente `.court-meta-compact` antes de `.court-team-cards`.

Debe quedar:

1. header;
2. formato/sets/sistema + fecha/hora;
3. Equipo A;
4. Equipo B;
5. sets.

No duplicar metadata más abajo.

Conservar edición mediante:
- `openManualFormatSheet`;
- `openManualMetaSheet`.

Validar móvil: una o dos líneas compactas, nunca solapadas.

---

## P0-F — Historial / outbox: estado comprensible

No alterar el contrato offline/idempotente.

La base actual ya distingue correctamente:
- `sync_pending` = transitorio, reintento automático con la MISMA `submissionId`;
- `necesita_revision` = error de negocio/ambigüedad que requiere decisión explícita.

El problema es de presentación.

### `sync_pending`

No etiquetar como “Necesita revisión”.

Mostrar en Resumen:
- banner: `Este partido todavía no se sincronizó con BRAMU.`
- explicación breve: se conserva en este dispositivo y BRAMU intenta sincronizarlo;
- acción primaria `Reintentar` que reusa la MISMA submission/idempotency key;
- acción secundaria/destructiva `Descartar carga`;
- copy de descarte: elimina únicamente esa carga local pendiente.

Se puede extraer un helper de reintento de UNA entrada a partir de `retryMatchOutbox`, sin cambiar la semántica automática existente.

### `necesita_revision`

Mostrar el problema real usando `lastError.code` + el mapeo de negocio existente.

Ejemplos:
- jugador repetido;
- participante no disponible;
- fecha fuera de rango;
- ambigüedad de encuentro.

Acción contextual:
- si el contenido debe corregirse → `Corregir carga` / reabrir editor;
- si es ambigüedad → reutilizar modal vigente;
- `Reintentar` solo cuando el error realmente lo permita;
- `Descartar carga` siempre claramente secundaria/destructiva.

**NO** convertir errores de negocio en reintentos ciegos.

Historial debe usar una etiqueta que represente el estado real:
- `PENDIENTE DE SINCRONIZACIÓN` para sync;
- para revisión, un copy específico/útil, no solo `NECESITA REVISIÓN` sin explicación al abrir.

---

## P0-G — Patrón canónico de jugador por player_id

Hacer una auditoría ACOTADA de las superficies del §7 del 45:

- Buscar jugadores;
- selector compañero/rival;
- reemplazo de identidad;
- Compañeros;
- Rivales;
- Mis Jugadores;
- Perfil público.

Para sesión server-backed:

**Regla absoluta**
- navegar/resolver por `player_id`;
- avatar desde la misma identidad;
- @username real;
- Nivel real;
- Perfil público server-backed.

No navegar por nombre plano cuando existe `player_id`.

**FUSIONAR**, sin construir un framework:
- usar `buildCompactPlayerRowHTML` / `buildPlayerRowHTMLFromServerRow` o una primitiva mínima compartida;
- si una superficie necesita stats adicionales, puede envolver el componente, pero no volver a resolver identidad de forma independiente.

Agregar tests/guardas que detecten call-sites server-backed hacia `openPlayerPublicProfile(namePlano)` desde estas superficies.

No borrar ni fusionar cuentas.

---

## P1-H — Mi Perfil > Jugadores: búsqueda directa

El patrón h13 “lista vacía + botón BUSCAR JUGADORES → otra pantalla” queda reemplazado.

La pestaña JUGADORES debe:

- mostrar SIEMPRE arriba un campo `Buscar en tus jugadores…` o copy equivalente;
- mostrar debajo jugadores agregados;
- si no hay guardados: estado vacío breve debajo, sin una pantalla puente;
- desde ese mismo espacio poder buscar un jugador global y agregarlo.

Implementación simple recomendada para server-backed:
- input único;
- con query vacía: lista guardados;
- con query: filtrar/mostrar guardados coincidentes y, con mínimo de caracteres vigente, resultados de `Auth.searchPlayers`;
- distinguir visualmente si ya está agregado;
- tocar abre el mismo Perfil público server-backed;
- agregar/quitar usa contratos vigentes de Mis Jugadores.

No duplicar una segunda lógica de búsqueda global. Reusar RPC/helpers existentes.

Legacy/local puede conservar compatibilidad, pero no debe condicionar la UX server-backed actual.

---

## P1-I — Reportar un error

El código h13 ya avanzó parte del pedido. No rehacer por costumbre.

Verificar y ajustar contra el 45:

- CTA exacto: `Reportar un error`;
- secundario;
- rojo suave;
- selector único;
- `El resultado`;
- `Un participante`;
- opciones tipo lista/divisor, no cards dentro de card;
- área táctil suficiente.

Si ya cumple estructuralmente, limitarse a ajustes visuales necesarios.

---

## P1-J — Identidad incorrecta continua

h13 ya abre automáticamente el sheet y ofrece `No sé · dejar Por identificar`.

Completar contra el 45:

- copy de confirmación preferido: `¿Seguro que no fue [Nombre]?`;
- acción inequívoca;
- después de confirmar, abrir inmediatamente `¿Sabés quién jugó?`;
- búsqueda canónica con avatar + nombre + @usuario + Nivel;
- Recientes reales cuando existan;
- `No sé · dejar Por identificar` explícito;
- no toast como fin intermedio;
- no volver a exigir tocar `Resolver`.

No agregar RPC nueva para “Por identificar”: el estado ya existe al abrir la incidencia.

---

## P1-K — Notificaciones: lenguaje humano de pádel

Mantener:
- actor real;
- contexto del partido;
- score;
- selfCaused;
- read/unread;
- click;
- misma única lectura `get_notifications`.

Cambiar solo traducción/copy.

### Con actor real

Preferidos:
- `match_validated` → `Esteban confirmó tu partido`
- `correction_proposed` → `Esteban reportó un resultado distinto` o `Esteban quiere corregir el resultado`
- `correction_accepted` → `Esteban confirmó el nuevo resultado`
- `identity_questioned` → `Seba indicó que [Nombre] no jugó` **solo si el nombre cuestionado existe realmente en payload/contexto**
- `identity_resolved` → `Esteban indicó quién jugó`
- `identity_unidentified` → copy humano equivalente, sin “resolver participante”.

Si para `identity_questioned` el nombre cuestionado NO está disponible con evidencia actual:
- no inventarlo;
- usar `Seba indicó que un jugador cargado no participó` o formulación breve equivalente;
- NO abrir backend solo para conseguir ese nombre en esta ronda salvo que sea una extensión mínima imprescindible y claramente justificada.

Body:
- rivales/parejas;
- score;
- fecha solo si ya existe evidencia disponible y aporta;
- nunca repetir la misma acción del título.

Fallback sin actor:
- también debe sonar humano, no técnico.

---

# 4. Componentes compartidos que deben converger

Esta ronda no debe resolver cada pantalla por separado si comparten el mismo problema.

## Resultado
Una primitiva canónica de grilla para:
- Resumen;
- Confirmar;
- propuesta.

## Jugador
Una primitiva canónica de identidad para:
- búsqueda;
- selectores;
- identidad;
- listas personales.

## Estado outbox
Una traducción canónica de:
- estado → copy;
- estado → acción;
- lastError → explicación.

## Notificaciones
Un único mapper de tipo → título humano + contexto.

---

# 5. NO TOCAR

- `main`;
- Production;
- BRAMUlive;
- Mis grupos;
- responsive general fuera de las pantallas del 45;
- popup futuro;
- realtime/polling;
- fórmula de Nivel;
- algoritmo Ranking;
- lógica Intelligence;
- self-healing h11;
- backend de validación cerrado;
- lógica offline/idempotente salvo extracción segura de helper para reintento manual con la MISMA key;
- decisiones P0.2/P0.3.

No ampliar alcance.

---

# 6. Tests técnicos obligatorios

Agregar pruebas focales que respondan a los riesgos del 45.

Como mínimo:

1. barra decimal 5.8/6.0/6.1;
2. delta oculto sin evidencia;
3. markup canónico de grilla compartido entre oficial/propuesta;
4. 2 y 3 sets;
5. resumen humano de corrección con 1 cambio, múltiples cambios y set agregado;
6. buttons de corrección con estructura/paridad compartida;
7. metadata aparece antes de team cards en DOM;
8. `sync_pending` → copy + reintento con misma submissionId;
9. `necesita_revision` → motivo real y sin reintento ciego;
10. player_id en todas las superficies server-backed enumeradas;
11. Mi Perfil/Jugadores con input siempre presente + búsqueda global desde el mismo espacio;
12. identidad continua;
13. mapper nuevo de notificaciones;
14. regresión del self-healing;
15. suite Node completa;
16. `tests.html`.

No crear tests que solo busquen una string si puede probarse el comportamiento/estructura con una función pura o DOM real.

---

# 7. Validación visual previa al push

Claude debe hacer una inspección visual local/preview si su entorno lo permite, pero NO sustituye el gate Central.

Comparar al menos estas pantallas en:
- viewport móvil ~390×844;
- desktop ~1440×900.

Estados/fixtures controlados necesarios:

### Home
- Nivel 5.8;
- Nivel 6.0;
- último partido normal;
- último partido con corrección activa.

### Resumen
- 2 sets;
- 3 sets;
- corrección oficial vs propuesta;
- botones;
- Reportar un error.

### Cargar partido
- metadata antes de equipos.

### Historial/Resumen outbox
- sync_pending;
- necesita_revision.

### Perfil > Jugadores
- vacío;
- guardados;
- búsqueda.

### Notificaciones
- validación;
- corrección;
- identidad.

Si el entorno de Claude no permite una revisión visual fiable, documentar esa limitación y NO declarar PASS visual.

---

# 8. Versionado / entrega

Objetivo de bundle final: **`04.11-h14`**.

Porque h13 ya fue desplegado, cualquier cambio de frontend debe invalidar cache.

Antes de terminar:

1. tests;
2. revisión de diff;
3. bump completo de bundle/cache;
4. idealmente un único commit lógico;
5. push `origin/staging`;
6. Vercel Staging verde;
7. NO tocar main/Production/BRAMUlive.

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/47_Resultado_Cierre_UX_h14_27SEP.md`

Debe contener una tabla **1–11 del documento 45** con:

- criterio;
- estado implementado;
- archivos;
- test técnico;
- evidencia visual propia si existió;
- cualquier desvío literal.

No escribir “apto para Laboratorio”. Terminar con:

> `PENDIENTE DE GATE CENTRAL TÉCNICO + VISUAL`

---

# 9. Trabajo de Central posterior

Después del push de Claude, Central hará:

1. revisión de HEAD/diff;
2. verificación de tests/deploy;
3. revisión literal 1–11;
4. revisión visual real del deploy en móvil + desktop;
5. corrección adicional antes de Sebastián si algo no coincide;
6. recién entonces nueva baseline;
7. fusión de decisiones cerradas a `05_Laboratorio_UX_Uso_Real.md`.

Claude no debe adelantar ese cierre.
