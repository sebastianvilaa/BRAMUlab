# BRAMUlab — Backend e Infraestructura

> Fuente maestra vigente para construir el backend mínimo del piloto real.
>
> Estado: consolidado para implementación.
>
> Alcance de producto de referencia: BRAMUlab V04.10.
>
> El informe `docs/BRAMUlab/Archivo/Backend_Infraestructura/Backend_Infraestructura_Informe.md` se conserva únicamente como diagnóstico histórico. Ante diferencias, manda este documento.

---

## 1. Propósito y criterio de diseño

El objetivo inmediato es llevar BRAMU desde un prototipo basado en `localStorage` a una Producción real para aproximadamente 10–20 jugadores, con cuentas, datos persistentes y partidos compartidos entre dispositivos.

La primera infraestructura:

- no es descartable ni una base piloto que luego haya que migrar;
- debe funcionar también con usuarios que Sebastián no conozca;
- debe soportar cómodamente cientos de usuarios y crecer aproximadamente hasta 1.000 sin rehacer la arquitectura;
- no debe diseñarse para 100.000 usuarios ni incorporar complejidad comercial anticipada;
- debe mantener el motor y los contratos vigentes de Nivel BRAMU;
- debe producir datos confiables que Ranking BRAMU pueda publicar y BRAMU Intelligence pueda consumir más adelante.

La prioridad es construir la mínima verdad multiusuario. Toda función que no sea necesaria para registrar, validar, procesar y consultar esa verdad queda fuera del piloto.

---

## 2. Estado de partida

- BRAMUlab V03.10 está cerrada.
- Nivel BRAMU V04.10 está cerrado en producto, UX y motor local; mantiene 1400/1400 tests.
- El contrato matemático vigente es Nivel BRAMU V1.5, con motor `nivel_bramu_v1_0` y estimador inicial `nivel_inicial_v1_1`.
- Ranking BRAMU V1 está cerrado conceptualmente y en UX, pero su implementación actual es local/simulada.
- BRAMU Intelligence V1 está definida y documentada, pero no implementada.
- Cuentas, perfiles, partidos, historial, Nivel, grupos y Ranking continúan dependiendo total o parcialmente de `localStorage`, mocks o simulaciones.
- Nivel V1 continúa detrás de una herramienta/preview interno. Antes del piloto debe convertirse en el flujo normal, con autoridad server-side y sin controles de laboratorio visibles para usuarios comunes.

No se migrarán a Producción los partidos, cuentas o rankings simulados actuales. Producción comenzará limpia.

---

## 3. Arquitectura mínima elegida

### 3.1 Componentes

- **Frontend/PWA actual:** se conserva la aplicación web y el repositorio GitHub.
- **Publicación:** Vercel para Staging y Producción, con proyectos o configuraciones claramente separados.
- **Backend administrado:** Supabase.
  - Supabase Auth para cuentas, sesiones, verificación y recuperación.
  - PostgreSQL para datos persistentes y relaciones.
  - Row Level Security (RLS) para permisos de lectura y escritura.
  - funciones server-side/Edge Functions o comandos RPC únicamente donde sea necesario ejecutar operaciones privilegiadas, atómicas o validadas.
- **Correo transaccional:** proveedor SMTP externo configurado y probado para verificación y recuperación reales.
- **Repositorio y flujo de trabajo:** GitHub continúa siendo la fuente del código; los despliegues de código nunca reemplazan los datos.

Esta arquitectura es una base real, no provisional. Permite el piloto y el crecimiento inicial sin agregar servidores propios, microservicios, colas o una plataforma analítica.

### 3.2 Principios obligatorios

- Producción y Staging nunca comparten base de datos, proyecto Supabase ni credenciales.
- El navegador no puede decidir el resultado oficial de un partido, el Nivel oficial ni el Ranking publicado.
- Toda escritura sensible se valida en el servidor.
- Las operaciones que pueden reintentarse usan una clave de idempotencia para no duplicar partidos o efectos.
- Los cambios de estructura se aplican mediante migraciones versionadas y controladas.
- Las fórmulas y contratos se versionan; el backend no debe copiar lógica matemática divergente dentro de la interfaz.
- Un despliegue de frontend jamás reinicia, siembra ni sobrescribe datos de Producción.

---

## 4. Alcance del backend mínimo del piloto

### 4.1 Incluido

1. Registro, verificación de email, login, cierre de sesión y recuperación real de contraseña.
2. Cuenta, identidad de jugador y perfil persistentes.
3. `@usuario` único y buscable.
4. Ubicación canónica necesaria para Ranking territorial.
5. Rama competitiva separada del género personal.
6. Persistencia server-side del cuestionario, estimación y estado oficial de Nivel.
7. Búsqueda de jugadores reales.
8. Identidades provisionales persistentes para invitados.
9. Alta de partidos de dobles con cuatro participantes, sets y resultado.
10. Ciclo oficial mínimo: pendiente de validación, validado o rechazado.
11. Descubrimiento claro de validaciones pendientes.
12. Actualización atómica de partido, Nivel, calibración, snapshots, `reasonCodes`, estadísticas oficiales y futura elegibilidad de Ranking.
13. Historial compartido por participante con estados visibles.
14. Corrección o anulación excepcional por administración.
15. Ranking BRAMU V1 semanal calculado desde datos reales validados.
16. Separación completa de Development, Staging y Production.
17. Caché y cola local de reintentos, sin convertir datos locales en autoridad.
18. Métricas mínimas del piloto.
19. Datos y versiones suficientes para que BRAMU Intelligence pueda construirse posteriormente sin rehacer el historial.

### 4.2 Expresamente fuera del piloto

- implementación de BRAMU Intelligence;
- IA generativa;
- matchmaking;
- rankings privados de grupos;
- expansión de Ranking fuera del V1 vigente;
- marcador en vivo integrado;
- push notifications;
- flujo autoservicio complejo de reclamos, fusiones o disputas;
- detección automática de duplicados por nombre o apodo;
- antitrampa sofisticado;
- estadísticas técnicas adicionales;
- configuración de privacidad campo por campo;
- aplicación nativa de App Store o Google Play;
- microservicios, colas distribuidas, data warehouse o infraestructura para escala masiva;
- dominio propio como requisito del piloto;
- migración de datos simulados desde `localStorage`.

---

## 5. Decisiones de producto cerradas para el piloto

### 5.1 Privacidad básica del perfil

Durante el piloto, los perfiles deportivos son visibles únicamente para personas autenticadas en BRAMU; no son páginas públicas indexables en Internet.

**Visibles para usuarios autenticados:**

- `@usuario`;
- nombre para mostrar;
- nombre y apellido;
- avatar;
- localidad deportiva;
- rama competitiva;
- mano/lado y datos deportivos ya definidos por producto;
- categoría contextual;
- Nivel público, estado y progreso de calibración;
- posición vigente de Ranking cuando corresponda;
- estadísticas oficiales agregadas.

**Privados:**

- email;
- fecha de nacimiento exacta;
- género personal;
- identificadores de autenticación;
- sesiones, tokens y datos de recuperación;
- notas privadas;
- información técnica de dispositivos y logs.

El detalle completo de un partido es accesible para sus participantes y administración. El perfil público muestra resúmenes y estadísticas, no convierte todo el historial detallado en público.

No habrá controles de privacidad campo por campo en el piloto. Ranking mantiene su consentimiento específico mediante `ranking_opt_in`; salir del Ranking no elimina el perfil deportivo ni el historial compartido.

### 5.2 `@usuario`

- Es obligatorio, único y no distingue mayúsculas/minúsculas.
- Se almacena en forma canónica minúscula.
- Formato inicial: entre 3 y 24 caracteres; letras ASCII minúsculas, números, punto y guion bajo.
- No admite espacios, tildes ni caracteres ambiguos.
- Existe una lista de nombres reservados.
- La unicidad se impone en la base de datos, no solo en la interfaz.
- Es buscable junto con nombre para mostrar, nombre y apellido, únicamente por usuarios autenticados.
- Durante el piloto queda fijo; una corrección excepcional puede hacerla administración.

### 5.3 Ubicación canónica

- Cada ubicación tiene un `location_id` interno estable.
- Para Argentina se utilizan identificadores y jerarquías canónicas de GeoRef cuando existan.
- Se guardan por separado código de país, provincia/área administrativa, localidad, etiquetas de presentación, fuente y estado de verificación.
- Se registra la localidad principal de juego, no dirección exacta ni GPS.
- El cambio conserva la espera/cooldown de 30 días definido por Ranking.
- Una localidad escrita manualmente puede guardarse en el perfil, pero queda `verified_for_ranking = false` hasta ser vinculada o verificada. Mientras tanto no habilita Ranking territorial.
- El piloto prioriza Argentina; el modelo conserva `country_code` para no bloquear una expansión futura.

### 5.4 Rama competitiva y género personal

- `competitive_branch` es un campo explícito separado y admite las ramas competitivas vigentes M/F.
- Es obligatorio para participar del Ranking.
- No se deriva automáticamente del género personal.
- El género personal es privado y opcional para el piloto.

### 5.5 Autoridad temporal

- Fechas oficiales, vencimientos, semana de Ranking y ventanas se calculan con hora del servidor.
- Ranking semanal utiliza `America/Argentina/Buenos_Aires`: lunes 00:00 a domingo 23:59.
- El snapshot publicado el lunes queda estable durante la semana.
- Una validación tardía entra en la próxima edición y no reescribe retrospectivamente una edición publicada.

---

## 6. Modelo de datos mínimo

Esta sección define entidades y contratos lógicos. Los nombres físicos, índices y SQL exactos se cierran en las migraciones de implementación.

### 6.1 Cuenta e identidad

#### Cuenta de autenticación

Responsabilidad de Supabase Auth:

- `auth_user_id`;
- email normalizado y estado de verificación;
- credenciales cifradas administradas por el proveedor;
- sesiones;
- timestamps de alta y último acceso;
- estado activo/desactivado.

BRAMU nunca guarda contraseñas ni códigos de recuperación en texto plano.

#### `players`

Identidad deportiva estable:

- `player_id` UUID;
- tipo: `registered` o `provisional`;
- `auth_user_id` opcional y único cuando hay cuenta;
- `canonical_player_id` opcional para una unificación administrativa futura;
- nombre para mostrar;
- creador y timestamps;
- estado activo/archivado.

Los partidos, relaciones y estadísticas se vinculan con `player_id`, no directamente con email o nombre escrito.

#### `profiles`

- `player_id`;
- `username` canónico y etiqueta visible;
- nombre, apellido, display name y avatar;
- datos deportivos definidos por producto;
- `competitive_branch`;
- género personal privado y opcional;
- `location_id`;
- `ranking_opt_in`;
- estado/completitud del perfil;
- timestamps.

### 6.2 Identidad provisional e invitación

#### `provisional_claims`

- `claim_id`;
- `provisional_player_id`;
- hash de token de alta entropía;
- estado, creador, creación, vencimiento y uso;
- `claimed_by_player_id` cuando corresponda.

El link pertenece a la identidad provisional, no a un partido. Varias superficies pueden compartir el mismo link.

### 6.3 Ubicación

#### `locations`

- `location_id`;
- `country_code`;
- códigos canónicos de provincia/área y localidad;
- etiquetas normalizadas;
- fuente;
- `verified_for_ranking`;
- estado activo y timestamps.

### 6.4 Partido

#### `matches`

- `match_id`;
- `created_by_player_id`;
- fecha/hora jugada y zona horaria;
- origen/modo/formato vigentes;
- estado oficial;
- `validation_deadline_at`;
- claves de versión e idempotencia;
- timestamps de creación, envío, validación, rechazo y anulación;
- actor de última acción administrativa;
- motivo estructurado de rechazo/anulación/corrección cuando exista.

Estados server-side del piloto:

- `pending_validation`;
- `validated`;
- `rejected`;
- `expired`;
- `annulled`.

`draft` y `sync_pending` son estados locales de interfaz, no estados oficiales del partido.

Un partido nuevo se crea siempre como `pending_validation`. La ausencia de estado nunca significa validado.

#### `match_participants`

- `match_id`;
- `player_id`;
- equipo 1/2;
- posición dentro de la pareja;
- rol registrado/provisional al momento del partido;
- snapshot mínimo del nombre mostrado;
- vínculo con el participante que creó o validó.

Debe haber exactamente cuatro participantes y dos por pareja. No existe modalidad individual.

#### `match_sets`

- `match_id`;
- número de set;
- games/puntos de cada equipo;
- modalidad de definición cuando corresponda;
- orden estable.

#### `match_actions`

Registro append-only de:

- creación/envío;
- validación;
- rechazo;
- vencimiento;
- corrección administrativa;
- anulación administrativa.

Incluye actor, timestamp del servidor, motivo y metadatos mínimos. Es la auditoría del ciclo del partido.

#### `match_revisions`

Conserva la revisión original y las correcciones excepcionales sin borrar la evidencia necesaria para revertir efectos.

#### `match_user_state`

Estado privado por usuario cuando el producto lo necesite:

- oculto en su historial;
- nota privada;
- preferencias locales sincronizables.

Ocultar no elimina el partido ni sus efectos oficiales.

### 6.5 Nivel

#### `level_states`

Estado actual por jugador:

- Nivel consolidado y provisional cuando corresponda;
- confianza/evidencia;
- estado `PENDIENTE`, `CALIBRANDO`, `CALIBRADO` o `RECALIBRANDO`;
- contadores de progreso;
- timestamps relevantes;
- versión de motor y estimador.

#### `match_level_results`

Snapshot reproducible de cómo un partido validado afectó el Nivel:

- snapshot previo de cada participante computable;
- expectativa;
- factores aplicados;
- datos conocidos/imputados y disponibilidad;
- delta por jugador;
- snapshot posterior;
- `reasonCodes`;
- versión de fórmula/motor;
- vínculo con la revisión exacta del partido.

#### `level_events`

Eventos append-only:

- estimación inicial;
- confirmación/cambio de cuestionario;
- ajuste por categoría contextual;
- variación por partido;
- corrección/reversión;
- entrada/salida de recalibración;
- cambios relevantes de estado.

No se recalcula silenciosamente todo el historial cuando cambia una fórmula. Las correcciones deben poder revertir exactamente el efecto guardado y aplicar la regla definida por Nivel.

### 6.6 Ranking semanal

#### `ranking_editions`

- `edition_id`;
- semana y zona horaria;
- inicio/cierre;
- timestamp de publicación;
- versión de reglas;
- estado de cálculo/publicación.

#### `ranking_rows`

- edición;
- ámbito: Local, Provincial, País, Global o Mi red;
- rama competitiva;
- ubicación canónica cuando corresponda;
- `player_id`;
- posición;
- score/criterios vigentes;
- movimiento respecto de la edición anterior;
- flags/motivos de elegibilidad;
- snapshot de Nivel y actividad relevantes.

Una edición publicada es inmutable. Una corrección posterior impacta la siguiente edición salvo intervención administrativa excepcional documentada.

### 6.7 Notificaciones internas

#### `notifications`

Para el piloto se limita a una bandeja interna:

- validación pendiente;
- partido validado;
- partido rechazado;
- corrección/anulación administrativa.

No incluye push. La pantalla/badge de pendientes debe consultar esta fuente o una vista server-side equivalente.

### 6.8 Métricas del piloto

#### `pilot_events`

Eventos mínimos, con identificador pseudónimo, timestamp de servidor y propiedades acotadas:

- `signup_started`;
- `signup_completed`;
- `level_started`;
- `level_confirmed` con modo rápido/completo;
- `match_created`;
- `match_validated`;
- `match_rejected`;
- cambio de calibración 1/5, 3/5 y 5/5;
- actividad diaria deduplicada.

El tiempo de validación se deriva de timestamps del partido. Los regresos a 1, 7 y 14 días se derivan de actividad, sin construir una plataforma analítica independiente.

No se almacenan contraseñas, tokens, textos privados ni contenido innecesario dentro de métricas.

---

## 7. Autoridad server-side y estado local permitido

### 7.1 Autoridad exclusiva del servidor

- cuentas, verificación y sesiones;
- identidad de jugador y relación cuenta–jugador;
- usernames y su unicidad;
- perfiles y permisos;
- ubicaciones canónicas y aptitud para Ranking;
- partidos, participantes, sets y revisiones;
- estado y deadline de validación;
- acciones de validación/rechazo/corrección/anulación;
- estadísticas oficiales;
- Nivel actual, progreso de calibración, snapshots, eventos y `reasonCodes`;
- elegibilidad y ediciones de Ranking;
- reclamos de identidades provisionales;
- métricas oficiales del piloto;
- timestamps usados para reglas.

### 7.2 Puede existir localmente

- archivos de la PWA y caché de recursos;
- preferencias puramente visuales;
- borrador de un partido todavía no enviado;
- estado temporal de una pantalla;
- caché de lectura con fecha/versión;
- outbox de acciones pendientes de sincronización;
- identificadores de idempotencia;
- último estado confirmado por servidor para permitir una UX tolerante a cortes.

Los datos locales no otorgan validez oficial. Al recuperar conexión, el servidor acepta o rechaza la operación y la interfaz muestra el resultado. No se calcula en local un Nivel o Ranking oficial alternativo.

---

## 8. Flujos productivos exactos

### 8.1 Registro, login y recuperación

1. La persona inicia el registro con email y contraseña.
2. Supabase crea una cuenta no verificada y envía el email real de confirmación.
3. Al verificar, un comando idempotente crea su `player`, `profile` incompleto y `level_state` inicial.
4. La sesión se mantiene con los mecanismos estándar de Supabase.
5. El login acepta email y contraseña; `@usuario` es identidad pública, no reemplaza el email como credencial en el piloto.
6. “Olvidé mi contraseña” envía un código de seis dígitos con vigencia de 60 minutos.
7. Los intentos se limitan, las respuestas no revelan si un email existe y los tokens quedan administrados/hasheados por el proveedor.

Solo cuentas con email verificado pueden cargar, validar o rechazar partidos oficiales.

### 8.2 Completar perfil

1. El usuario elige un `@usuario` disponible.
2. Completa nombre, apellido, display name y datos deportivos requeridos.
3. Elige explícitamente su rama competitiva.
4. Selecciona una localidad canónica; el fallback manual queda no verificado para Ranking.
5. Acepta las condiciones y define `ranking_opt_in`.
6. El servidor valida formato, unicidad y campos requeridos.

### 8.3 Definir Nivel

1. Con el perfil mínimo completo, Nivel V1 pasa a ser el flujo productivo normal.
2. El usuario inicia el cuestionario rápido o completo.
3. Las respuestas pueden guardarse como borrador, pero la confirmación oficial se envía al servidor.
4. El servidor ejecuta el estimador vigente, registra versión, contexto, evento y estado inicial.
5. Devuelve el Nivel y progreso confirmados.
6. Los controles de laboratorio quedan ocultos o restringidos a administración fuera del flujo común.

### 8.4 Buscar jugadores

1. Solo un usuario autenticado puede buscar.
2. La búsqueda consulta jugadores reales por `@usuario`, display name, nombre o apellido.
3. Devuelve información deportiva pública mínima.
4. No mezcla mocks, cuentas de Staging ni semillas.
5. Una identidad provisional no aparece en la búsqueda global; solo puede reaparecer para usuarios relacionados mediante partidos, recientes o red.

### 8.5 Crear y cargar un partido

1. Un participante registrado arma dos parejas con cuatro `player_id`.
2. Puede elegir usuarios reales o reutilizar identidades provisionales relacionadas; si crea una nueva, obtiene un UUID persistente.
3. Completa fecha, formato y resultado.
4. El dispositivo conserva borrador y, si no hay conexión, lo deja en outbox con una clave idempotente.
5. Al enviar, el servidor valida participantes, resultado, permisos, fecha y reglas básicas.
6. Crea el partido como `pending_validation`, nunca como validado.
7. El partido aparece en los cuatro historiales vinculados con su estado, pero todavía no afecta Nivel, calibración, Ranking ni estadísticas oficiales.

### 8.6 Validar o rechazar

1. La bandeja “Pendientes” muestra al menos al rival registrado habilitado para decidir.
2. Alcanza la confirmación de un único rival registrado del equipo contrario.
3. El creador no puede autovalidar; la confirmación de su compañero no reemplaza la rival.
4. El rival revisa participantes, fecha y resultado.
5. Puede validar o rechazar con un motivo simple.
6. Si valida, una única transacción server-side:
   - cambia el estado a `validated`;
   - registra la acción;
   - congela la revisión computada;
   - calcula y guarda Nivel conforme V1.5;
   - actualiza progreso y estado de calibración;
   - guarda snapshots, delta, versiones y `reasonCodes`;
   - actualiza estadísticas oficiales;
   - deja el partido disponible para la próxima evaluación de Ranking;
   - genera las notificaciones y métricas mínimas.
7. Si rechaza, el partido queda `rejected`, visible pero sin efectos oficiales.
8. Si pasan 30 días sin una validación habilitada, queda `expired`: permanece en historial, pero no computa Nivel ni Ranking.

No existe disputa autoservicio compleja en el piloto. Una corrección o anulación excepcional la realiza administración, con motivo, revisión y reversión idempotente del efecto exacto.

### 8.7 Actualización oficial de Nivel

- Solo ocurre con partidos `validated`.
- Respeta elegibilidad, invitados, repetición, círculo competitivo, imputación y demás reglas de Nivel V1.5.
- Un invitado provisional puede permitir el cómputo del partido cuando las reglas vigentes tengan información suficiente, pero no recibe un Nivel permanente cargado por terceros.
- La actualización guarda pre/post snapshot y no depende de que el cliente permanezca conectado.
- Reintentar la misma validación no duplica deltas.

### 8.8 Historial

- Incluye partidos pendientes, validados, rechazados, vencidos y anulados con etiqueta clara.
- Solo los validados alimentan estadísticas y resultados oficiales.
- Cada usuario puede ocultar un partido de su propia vista sin borrarlo ni alterar a los demás.
- La fuente es el backend. El caché local sirve solo para velocidad o lectura temporal.

### 8.9 Ranking

1. Un proceso server-side semanal cierra la edición según la zona horaria definida.
2. Evalúa únicamente cuentas reales y datos validados.
3. Aplica la elegibilidad vigente: cuenta estable/activa, perfil deportivo visible, consentimiento, ubicación canónica, Nivel consolidado, actividad e integridad.
4. Publica `ranking_editions` y `ranking_rows`.
5. La app lee la edición publicada; no recalcula posiciones en el navegador.
6. Si todavía no hay participantes suficientes, muestra un estado vacío honesto. Nunca utiliza personas simuladas como reemplazo.

---

## 9. Invitados e identidades provisionales en el piloto

### 9.1 Comportamiento incluido

- Un invitado es un `player` provisional persistente con UUID propio, no texto dentro del partido.
- Puede reutilizarse en múltiples partidos y aparecer en recientes, red, compañeros y rivales de usuarios relacionados.
- Puede acumular historial y estadísticas derivadas, pero no Nivel permanente ni posición competitiva hasta tener cuenta y cumplir elegibilidad.
- No se pide teléfono, email, DNI ni apellido para crearlo.
- Tiene un único link de invitación/reclamo por identidad, compartible mediante el sistema normal del dispositivo.
- Al registrarse desde el link, la nueva cuenta reclama ese `player_id` y obtiene todos los partidos ya vinculados a ese ID.
- BRAMU nunca fusiona personas automáticamente por coincidencia de nombre o apodo.

### 9.2 Reclamo simplificado

- El link contiene un token aleatorio de alta entropía; en base se guarda su hash.
- La persona debe registrarse o iniciar sesión para consumirlo.
- El reclamo de una identidad no reclamada es atómico y de un solo uso.
- Si una cuenta necesita reclamar una segunda identidad, o existen duplicados, se resuelve manualmente por administración durante el piloto.
- No se construye todavía una interfaz general de fusiones, pruebas de identidad o matching entre redes.

### 9.3 Efecto sobre Nivel y Ranking

- Reclamar una identidad no recalcula retroactivamente deltas ya procesados.
- Un partido todavía pendiente y dentro de sus 30 días puede validarse después del reclamo y se procesa con la identidad ya vinculada.
- Un partido vencido sigue siendo historial y no se reactiva automáticamente.
- El jugador reclamado empieza a construir su Nivel y elegibilidad según las reglas vigentes desde las acciones oficiales que correspondan; no hereda automáticamente un Nivel permanente estimado por terceros.

### 9.4 Red y Ranking

Una identidad provisional puede aparecer en recientes o en la red personal como relación derivada de partidos, pero nunca ocupa una posición competitiva de Ranking. Esto concilia la utilidad social del invitado con la exigencia de identidad elegible de Ranking.

---

## 10. Permisos y seguridad mínima

### 10.1 Política general

RLS comienza en “denegar por defecto”. Cada acceso se habilita mediante una política explícita y probada.

### 10.2 Lecturas

- Un usuario autenticado puede leer campos públicos de perfiles registrados.
- Puede leer identidades provisionales solo si está relacionado con ellas mediante un partido o las creó.
- Puede leer el detalle de un partido si participa, lo creó o es administrador.
- Puede leer su propia cuenta, datos privados, borradores sincronizados y notas.
- Las ediciones de Ranking publicadas son legibles por usuarios autenticados.
- Datos de auth, tokens de claim, logs y métricas crudas no son legibles desde el cliente.

### 10.3 Escrituras

- Cada usuario edita únicamente su perfil permitido.
- No puede cambiar por API directa username, ubicación, rama o estado de Nivel evitando validaciones; usa comandos server-side o reglas verificadas.
- Solo un participante habilitado crea el partido.
- Solo un rival registrado del equipo contrario puede validarlo o rechazarlo.
- Nadie puede modificar directamente Nivel, snapshots, estadísticas o Ranking.
- Correcciones/anulaciones requieren rol administrativo y dejan auditoría.
- El cliente nunca recibe claves de servicio.

### 10.4 Controles mínimos

- rate limiting en registro, login, recuperación, búsqueda y claims;
- validación server-side de todos los payloads;
- claves de idempotencia;
- tokens con expiración y almacenamiento seguro;
- logs sin contraseñas, tokens ni datos privados innecesarios;
- backups/PITR disponibles según el plan contratado y exportación periódica antes del piloto;
- secretos separados por entorno;
- pruebas automáticas de RLS con casos permitidos y prohibidos.

---

## 11. Development, Staging y Production

| Entorno | Uso | Datos | Acceso |
|---|---|---|---|
| Development | Modificar y probar código localmente | Falsos/locales o proyecto dev desechable; nunca Producción | Equipo de desarrollo |
| Staging | Versión online e instalable para aceptación | Proyecto Supabase y base separados; usuarios de prueba | Sebastián/equipo/testers |
| Production | BRAMU real | Cuentas, partidos y datos reales persistentes | Usuarios reales |

Reglas:

- Staging nunca apunta a la base de Producción.
- Las variables públicas y secretos se administran por entorno.
- La PWA de Staging debe tener nombre/ícono/color distinguible.
- `robots` y controles de acceso evitan difusión accidental de Staging.
- Seeds y usuarios test solo existen en Development/Staging.
- Producción no incluye botón, fallback ni ruta común que cargue datos simulados.
- Una migración se prueba primero en Development, luego Staging y finalmente Producción con respaldo y verificación.
- El código desplegado cambia comportamiento/esquema mediante migraciones; nunca reemplaza filas reales.

---

## 12. Autenticación y recuperación reales

- Método inicial: email + contraseña.
- Email verificado obligatorio para acciones oficiales.
- Recuperación mediante OTP de seis dígitos, vigencia de 60 minutos, límite de intentos y respuestas que no permitan enumerar cuentas.
- Las URLs de callback se permiten únicamente para los dominios correctos de Staging y Producción.
- El remitente y proveedor SMTP deben verificarse antes de invitar al primer jugador.
- Se prueban: alta, reenvío, expiración, recuperación, cambio de contraseña, cierre de sesiones y acceso desde segundo dispositivo.
- No se incorporan social login, teléfono/SMS ni passkeys en el piloto.
- La eliminación de cuenta es asistida por administración: se desactiva el acceso y se anonimiza lo público que corresponda, preservando identificadores deportivos mínimos cuando el historial compartido lo requiera.

El piloto inicial se orienta a adultos invitados. Si el alcance incorpora menores, las reglas de consentimiento y tratamiento de datos deberán resolverse antes de aceptar esas altas; esto no bloquea el piloto adulto.

---

## 13. Eliminación de mocks y caminos de laboratorio

Antes del piloto:

1. Producción arranca sin cuentas, partidos ni filas de Ranking simuladas.
2. La app deja de leer claves históricas de `localStorage` como fallback productivo.
3. Las nuevas claves locales se versionan y separan por entorno.
4. Búsqueda y perfiles consultan exclusivamente personas reales del backend.
5. Ranking consulta exclusivamente la última edición real publicada.
6. Si no hay datos, se muestra estado vacío; no se rellenan posiciones con mocks.
7. Nivel productivo deja de depender del preview interno.
8. El laboratorio, si se conserva, queda fuera de navegación común y restringido a Development/Staging o rol administrativo.
9. El service worker no comparte caché entre dominios/entornos ni conserva respuestas falsas después de un despliegue.
10. Los usuarios test se crean únicamente en Staging.

---

## 14. Preparación de datos para BRAMU Intelligence

Intelligence no se implementa en el piloto. Para no cerrarle el camino, el backend conserva:

- IDs estables de usuario, jugador, partido, participante y edición;
- `played_at`, `created_at`, `validated_at` y estado;
- parejas, rivales y relaciones derivadas;
- formato, origen y score estructurado por set;
- distinción entre dato personal, pendiente y oficial;
- revisiones, correcciones y anulaciones;
- snapshots de Nivel antes/después;
- expectativa, factores, delta, datos conocidos/imputados;
- `reasonCodes` y versiones del motor;
- estado y progreso de calibración;
- categoría contextual;
- ediciones y movimientos semanales de Ranking;
- ubicación canónica a la granularidad permitida;
- eventos mínimos del recorrido de producto.

Se evita guardar inferencias generativas como hechos. En el futuro, Intelligence deberá producir afirmaciones deterministas y versionadas desde estos datos; la generación de lenguaje será opcional y no autoridad.

---

## 15. Orden de implementación

Cada bloque debe ser pequeño, desplegable en Staging y verificable antes de comenzar el siguiente.

### Bloque 1 — Fundación de backend y entornos **(PRIMERO)**

**Incluye**

- proyectos/configuración separados de Supabase para Staging y Production;
- integración base del frontend por entorno;
- migraciones versionadas;
- esquema inicial de identidades y guardas ambientales;
- roles mínimos y RLS en denegación por defecto;
- health check;
- despliegue separado de Staging;
- backups/exportación y secretos documentados.

**Depende de:** nada.

**Terminado cuando**

- Staging conecta solo con su backend;
- Production conecta solo con el suyo;
- un build falla de forma segura si faltan o se cruzan variables;
- una migración puede aplicarse primero en Staging y luego en Producción sin sembrar datos;
- las tablas protegidas no pueden leerse/escribirse anónimamente;
- no se modificó todavía el comportamiento productivo de Nivel o partidos.

### Bloque 2 — Auth, perfil, username, ubicación y recuperación

**Incluye**

- registro, verificación, login, logout y recuperación;
- creación idempotente de `player/profile`;
- perfil mínimo;
- username único;
- rama competitiva;
- ubicación canónica/manual no elegible;
- primeras métricas de alta.

**Depende de:** Bloque 1.

**Terminado cuando**

- una persona puede crear cuenta real, verificarla, completar perfil y entrar desde otro dispositivo;
- recuperación funciona con correo real en Staging;
- username duplicado falla en servidor;
- ubicación manual no habilita Ranking;
- un usuario no puede leer ni editar datos privados ajenos.

### Bloque 3 — Nivel productivo y persistente

**Incluye**

- persistencia de cuestionarios/confirmación;
- ejecución server-side del estimador y contratos vigentes;
- `level_states` y `level_events`;
- Nivel como flujo normal;
- laboratorio oculto/restringido;
- métricas de inicio, confirmación y modo.

**Depende de:** Bloques 1 y 2.

**Terminado cuando**

- Nivel confirmado permanece entre dispositivos y sesiones;
- el servidor es autoridad;
- rápido/completo generan los resultados esperados del motor probado;
- se guardan versiones y contexto;
- un usuario común no ve controles de laboratorio.

### Bloque 4 — Jugadores, búsqueda e invitados provisionales

**Incluye**

- búsqueda real;
- creación/reutilización de `player` provisional;
- recientes/red relacionada;
- link y claim básico de una sola identidad;
- administración manual de duplicados excepcionales.

**Depende de:** Bloque 2; consume Nivel público del Bloque 3.

**Terminado cuando**

- búsqueda no devuelve mocks;
- un provisional mantiene el mismo ID en varios partidos;
- no aparece globalmente;
- un link permite registrarse y reclamar todo el historial del ID;
- nombres iguales nunca se fusionan solos.

### Bloque 5 — Partidos compartidos e historial

**Incluye**

- partidos, cuatro participantes, sets y resultado;
- borrador/outbox local;
- creación idempotente como `pending_validation`;
- historial compartido y badges de estado;
- vencimiento a 30 días;
- ocultamiento individual.

**Depende de:** Bloques 2, 3 y 4.

**Terminado cuando**

- un partido cargado en un dispositivo aparece una sola vez en los participantes relacionados;
- sin conexión se conserva y reintenta sin duplicar;
- no afecta Nivel ni estadísticas antes de validar;
- pendientes/rechazados/vencidos se distinguen;
- ocultar no elimina el partido.

### Bloque 6 — Validación y actualización oficial

**Incluye**

- bandeja/badge de pendientes;
- validación o rechazo por un rival;
- transacción atómica de estado, Nivel, calibración, snapshots, `reasonCodes`, estadísticas y métricas;
- notificaciones internas;
- comando administrativo de corrección/anulación.

**Depende de:** Bloque 5.

**Terminado cuando**

- creador/compañero no pueden autovalidar;
- un rival autorizado valida o rechaza;
- validar una vez actualiza todo coherentemente;
- reintentar no duplica efectos;
- rechazo/vencimiento no computan;
- corrección/anulación revierten el efecto exacto y dejan auditoría;
- los escenarios vigentes de Nivel continúan pasando.

### Bloque 7 — Ranking real semanal

**Incluye**

- cálculo server-side;
- edición y filas inmutables;
- ámbitos y elegibilidad V1;
- movimiento semanal;
- estados vacíos honestos;
- eliminación del Ranking simulado en Producción.

**Depende de:** Bloque 6 y ubicación canónica del Bloque 2.

**Terminado cuando**

- solo cuentas reales elegibles y partidos validados participan;
- el snapshot semanal permanece estable;
- una validación tardía entra en la edición siguiente;
- provisionales no ocupan posiciones;
- no existe fallback a mocks.

### Bloque 8 — Endurecimiento y salida al piloto

**Incluye**

- prueba integral en Staging;
- revisión de RLS, rate limits, emails, recuperación, caché y service worker;
- tablero/consulta simple de métricas;
- respaldo/exportación;
- procedimiento administrativo;
- checklist y despliegue limpio de Producción.

**Depende de:** Bloques 1–7.

**Terminado cuando**

- los recorridos críticos funcionan entre al menos dos dispositivos y cuentas;
- no hay cruces entre entornos;
- se puede recuperar una cuenta;
- se puede detectar y corregir un partido excepcional;
- métricas mínimas se registran sin datos sensibles;
- Producción no contiene seeds ni mocks;
- los primeros 10–20 jugadores pueden operar con datos persistentes.

---

## 16. Primer handoff recomendado para Claude Code

El primer trabajo de implementación debe ser **Bloque 1 — Fundación de backend y entornos**.

Su alcance debe terminar en una base segura y verificable, sin intentar migrar simultáneamente Auth, Nivel y partidos. El handoff debe pedir:

- auditar la configuración actual del repositorio necesaria para integrar Supabase/Vercel;
- crear la estructura de migraciones y configuración por entorno;
- conectar exclusivamente Staging a su proyecto de Staging;
- establecer guardas que impidan usar credenciales de Producción desde Staging/Development;
- crear el núcleo mínimo de identidad requerido por el siguiente bloque;
- habilitar RLS en denegación por defecto y sus pruebas;
- documentar variables, despliegue, respaldo y rollback;
- no importar `localStorage`, no sembrar Producción y no alterar todavía el motor de Nivel.

No debe abarcar los ocho bloques en una única entrega.

---

## 17. Riesgos reales y mitigación

| Riesgo | Mitigación mínima |
|---|---|
| La app sigue mostrando datos viejos de `localStorage` | Namespace nuevo por entorno, sin fallback productivo, limpieza guiada de claves históricas |
| Duplicación por reintentos offline | UUID de cliente + clave de idempotencia única server-side |
| Partido validado pero Nivel a medias | Una transacción/comando server-side atómico |
| Fórmula divergente entre cliente y servidor | Un único motor compartido/versionado y tests de paridad |
| Filtración por permisos demasiado amplios | RLS deny-by-default y pruebas positivas/negativas |
| Staging toca datos reales | Proyectos, claves, dominios y comprobaciones separados |
| Caché/service worker conserva mocks | Versionado de cachés y limpieza en despliegue |
| Emails de verificación/recuperación no llegan | SMTP real y pruebas antes del piloto |
| Localidad manual contamina Ranking territorial | `verified_for_ranking = false` hasta mapping/verificación |
| Reclamo de invitado por link filtrado | Token largo, hash, expiración/rotación, un solo uso y login |
| Doble efecto por corrección | Revisión y snapshot exactos, reversión idempotente |
| Cron semanal con fecha incorrecta | Zona horaria explícita y tests en límites de semana |
| Límites del plan gratuito | Métricas de uso y alertas; evaluar costo solo al acercarse al límite |
| Sobrediseño retrasa el piloto | Mantener fuera las funciones postergadas y entregar por bloques |

La migración no requiere transformar los datos simulados actuales. El riesgo principal no es el volumen, sino permitir que el frontend continúe tratándolos como autoridad o mezcle caches de entornos.

---

## 18. Alineaciones y contradicciones resueltas

1. **Referencias históricas a V04:** V04 corresponde a Nivel BRAMU. Backend/Infraestructura es una etapa posterior y aquí no se numera como V04.
2. **Invitado como texto vs identidad:** queda superado. Todo invitado es una identidad provisional persistente con ID.
3. **Invitado en red vs Ranking:** puede aparecer en relaciones personales/recientes, pero no recibe posición competitiva hasta tener cuenta y ser elegible.
4. **Efecto de partidos con invitados:** manda Nivel BRAMU V1.5. El partido puede afectar a jugadores computables si cumple sus reglas; el provisional no recibe Nivel permanente de terceros.
5. **Ubicación manual de V04.10:** se conserva como fallback de perfil, pero sin ID canónico/verificación no habilita Ranking territorial.
6. **Ranking local simulado:** se elimina del camino productivo. Ranking real depende de partidos validados y snapshots semanales server-side.
7. **Movimientos de Intelligence:** cuando se implemente, consumirá movimientos entre ediciones semanales publicadas; no existe movimiento oficial instantáneo.
8. **Piloto descartable:** queda superado. Los amigos iniciales usan Producción y conservan sus cuentas/datos.

Estas alineaciones no requieren modificar ahora la documentación de Nivel, Ranking o Intelligence. Deben respetarse en sus futuros handoffs de implementación.

---

## 19. Decisiones abiertas no bloqueantes

Pueden decidirse con datos del piloto:

- compra y proveedor de dominio propio;
- proveedor definitivo de email al superar el volumen inicial;
- matching inteligente de identidades entre redes;
- sugerencia de invitados recientes y ventana tentativa;
- autoservicio para reclamar múltiples identidades;
- interfaz completa de fusiones;
- social login/passkeys;
- push notifications;
- políticas avanzadas de moderación y antitrampa;
- analítica externa;
- automatización de eliminación/exportación de cuenta;
- soporte territorial fuera de Argentina.

---

## 20. Bloqueantes antes de implementar

No queda un bloqueo conceptual de producto para comenzar el Bloque 1.

Antes de conectar servicios deberá resolverse como tarea operativa, no conceptual:

- crear o identificar las cuentas/proyectos de Supabase y Vercel;
- definir quién custodia accesos, secretos y códigos de recuperación;
- elegir un proveedor SMTP compatible con el presupuesto del piloto;
- confirmar los dominios gratuitos de Staging/Producción mientras no haya dominio propio.

Estas selecciones no cambian el modelo ni impiden preparar el primer handoff técnico.

---

## 21. Definición de terminado del backend mínimo del piloto

Backend/Infraestructura está listo para el piloto cuando:

- existen Development, Staging y Production realmente separados;
- una cuenta puede registrarse, verificarse, recuperarse y usarse desde distintos dispositivos;
- perfil, username, ubicación, rama y Nivel persisten server-side;
- búsqueda devuelve solo personas reales del entorno;
- invitados tienen identidad persistente y claim básico;
- un partido siempre nace pendiente;
- un rival puede validarlo o rechazarlo;
- la validación actualiza atómicamente historial, Nivel, calibración, snapshots, `reasonCodes` y estadísticas;
- pendientes y estados son visibles;
- Ranking semanal usa exclusivamente datos reales elegibles;
- Producción no contiene ni consulta mocks;
- la app funciona con caché temporal pero no depende de `localStorage` como verdad;
- quedan guardados los contratos necesarios para Intelligence;
- las métricas mínimas permiten evaluar el piloto;
- backups, RLS, logs y procedimiento administrativo fueron probados en Staging.

Al cumplir esta definición, BRAMU puede incorporar los primeros 10–20 jugadores en una Producción real sin necesitar una migración posterior hacia otra base “definitiva”.
