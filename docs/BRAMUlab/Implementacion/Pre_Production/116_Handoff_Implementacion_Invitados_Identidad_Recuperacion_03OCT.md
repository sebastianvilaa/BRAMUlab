# Handoff — Implementación Invitados / Identidad / Recuperación

**Fecha:** 03/10/2026  
**Rama:** `staging`  
**Base documental esperada:** `fa416c82f5ecccf4ba3845cda048ce9c7460e1c3`  
**Estado:** decisiones de producto cerradas; implementación técnica pendiente.  
**Objetivo:** implementar en Staging, de punta a punta, la nueva experiencia de invitación/vinculación y recuperación de identidad definida en el handoff 113 y ya absorbida por las fuentes maestras.

## 0. Autoridad y orden de lectura

Leer primero:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Implementacion/Pre_Production/113_Handoff_Invitados_Identidad_Recuperacion_02OCT.md`
4. este documento

Después consultar únicamente las fuentes maestras afectadas:

- `docs/BRAMUlab/Backend_Infraestructura.md`
- `docs/BRAMUlab/Nivel_BRAMU.md`
- `docs/BRAMUlab/Ranking_BRAMU.md`
- `docs/BRAMUlab/Grupos_BRAMU.md`
- `docs/BRAMUlab/BRAMU_Intelligence.md`
- `docs/BRAMUlab/BRAMU_Intelligence_Implementacion.md`
- `docs/BRAMUlab/Experiencia_Inicial.md`
- `docs/BRAMUlab/Pre_Production.md`

El 113 contiene decisiones de producto YA CERRADAS. Este 116 agrega la revisión técnica del HEAD/DB actual y las fronteras de implementación. No reabrir producto salvo que aparezca una incompatibilidad verdaderamente humana y no técnica.

## 1. Decisiones de producto que no se reabren

Quedan superadas las reglas antiguas de:

- un único link por provisional;
- solo el creador puede invitar;
- cuenta existente enviada a resolución manual;
- segunda identidad provisional resuelta manualmente;
- claim sin incorporación de evidencia recuperada al Nivel;
- duplicados derivados a soporte/administración como camino normal.

Vigente:

- cualquier jugador registrado relacionado con la provisional puede invitar: creador **o** participante de un partido real compartido;
- varios invitadores relacionados pueden tener links válidos en paralelo;
- máximo un link pendiente por `(provisional_player_id, invitador)`;
- regenerar desde el mismo invitador rota solo su link;
- primer vínculo exitoso gana y revoca los demás links pendientes de esa provisional en la misma transacción;
- el receptor confirma explícitamente `SOY YO` / `NO SOY YO`;
- `NO SOY YO` no consume el link globalmente;
- sin sesión se preserva intención y, después de login/alta, se vuelve automáticamente al flujo;
- una cuenta existente puede recuperar una provisional;
- una misma cuenta puede recuperar luego otra provisional, una por una;
- nunca matching por nombre/apodo;
- la historia real recuperada pasa a la cuenta;
- evidencia histórica elegible puede afectar Nivel **solo del jugador recuperado**, usando snapshots históricos reales;
- no se recalculan deltas históricos de terceros;
- Ranking ya publicado no se reescribe;
- Grupos/estadísticas/Intelligence consumen la identidad real corregida;
- duplicados descubiertos después de vincular se resuelven explícitamente `SÍ, ES EL MISMO` / `NO, SON DOS PARTIDOS DISTINTOS`;
- una misma persona ocupando dos slots es conflicto y debe fallar cerrado, sin mutación parcial;
- no construir fusión genérica entre dos cuentas registradas.

## 2. Estado técnico real encontrado por Central

### 2.1 Staging real

Proyecto Supabase Staging: `serxtivkfnptzurnvewg`.

Verificado read-only:

- proyecto ACTIVE_HEALTHY;
- no existe `players.canonical_player_id`;
- no existe todavía tabla `player_identity_recoveries`;
- `match_participants.player_id` existe;
- las tablas sensibles de claim/matches/Nivel/Grupos/Intelligence siguen deny-by-default, sin políticas directas de cliente, y su mutación está reservada a vías controladas/service role según el sistema vigente.

No introducir `canonical_player_id` como una capa genérica de fusión. No existe físicamente y no hace falta para resolver este caso.

### 2.2 Claim actual de Bloque 4

Migración base:
`supabase/migrations/20260920120000_bloque4_jugadores_busqueda_provisional.sql`

Hoy:

- índice único: un solo pending por `provisional_player_id`;
- `create_claim_link` exige ser creador;
- al rotar revoca todos los pending de esa provisional;
- `claim_provisional_player` rechaza cuenta ya completa (`account_already_registered`);
- rechaza segundo claim (`account_already_claimed_identity`);
- serializa principalmente por fila del claim, no por identidad provisional;
- el camino de cuenta nueva adopta P1 y borra el bootstrap P2.

La relación correcta “creador O compartió partido” ya existe conceptualmente/casi literalmente en `list_related_provisional_players()`. Reutilizar una única regla de relación; no duplicarla en distintas RPCs.

### 2.3 Incompatibilidad técnica crítica posterior al Bloque 4

Después del claim original se agregó L1 Legal.

Hoy `legal_acceptances`:

- es append-only;
- tiene FK `player_id -> players(player_id)` sin cascade;
- bloquea UPDATE/DELETE mediante trigger;
- `handle_email_confirmed` puede registrar aceptación legal sobre el bootstrap P2 antes de procesar la invitación.

Por lo tanto, el camino histórico “borrar P2 y pasar auth a P1” ya no puede asumirse seguro: puede chocar con la aceptación legal inmutable.

Esto **NO abre una decisión de producto**. Es una incompatibilidad técnica a resolver preservando ambas garantías:

1. nunca perder/alterar evidencia legal append-only;
2. la persona termina con una única identidad deportiva registrada activa y con sus partidos recuperados.

La solución puede:
- preservar P1 como identidad final, manteniendo P2 como tombstone/auditoría y copiando de forma append-only la evidencia legal necesaria; **o**
- mantener P2 como identidad registrada final y reasociar la provisional P1 hacia P2.

Elegir la opción más simple y segura después de enumerar todas las referencias reales. No destruir aceptación legal, no desactivar su trigger y no inventar una fusión genérica.

### 2.4 Referencias reales a `players.player_id`

Central verificó en Staging que existen referencias desde, entre otras:

- `group_memberships` / `group_events` / `groups`;
- `level_states` / `level_events`;
- `match_participants`;
- `match_actions`, `match_revisions`, `match_submissions`;
- `match_identity_issues`;
- `match_level_results` / `match_level_result_players`;
- `notifications`;
- `pilot_events`;
- `player_saved_players`;
- `ranking_rows` y eventos de Ranking;
- `intelligence_match_outputs`;
- `legal_acceptances`;
- `provisional_claims`.

NO hacer un UPDATE masivo ciego de todas las FKs.

Distinguir:

- **verdad actual/reasociable**: por ejemplo `match_participants`, estado personal/derivados actuales cuando corresponda;
- **auditoría histórica**: actor/proposer/submission/eventos/revisiones deben preservar quién/qué ocurrió originalmente;
- **snapshots publicados**: `ranking_rows` no se toca;
- **salidas regenerables**: Intelligence puede invalidarse/reproducirse;
- **evidencia legal append-only**: nunca se muta/destruye.

## 3. Arquitectura técnica recomendada

### 3.1 Links e identidad

Migración nueva, forward-only.

Cambiar índice pending de:

`(provisional_player_id)`

a:

`(provisional_player_id, created_by_player_id) WHERE status='pending'`

Crear/reutilizar helper server-side único de autorización equivalente a:

`can_invite_provisional(caller_player_id, provisional_player_id)`

que sea verdadero solo si:

- caller creó esa provisional; o
- caller comparte al menos un `match_id` real con esa provisional.

Nunca por nombre ni por UUID conocido sin relación.

`create_claim_link`:

- rate limit;
- lock seguro de provisional;
- valida relación;
- rota únicamente el pending de ese mismo invitador;
- 256 bits aleatorios;
- hash SHA-256 server-side;
- expiración 30 días.

Agregar una lectura/preview segura del token para mostrar el nombre **sin consumirlo**. Debe devolver el mínimo necesario y no filtrar token hash, creador u otros datos privados.

### 3.2 Concurrencia de links

Con varios links simultáneos no alcanza con bloquear la fila de claim, porque dos requests con claims distintos pueden correr a la vez.

El consumo debe serializar por **provisional** antes de mutar claims:

- row lock del player provisional o advisory lock determinístico por provisional;
- después releer/validar claim bajo lock;
- primer éxito vincula;
- misma transacción: claim ganador -> claimed y todos los otros pending de esa provisional -> revoked;
- reintentos devuelven resultado idempotente/estructurado, nunca dejan dos ganadores;
- evitar orden de locks que pueda deadlockear entre dos claims distintos.

### 3.3 Auditoría de recuperación

Crear una tabla server-only específica, por ejemplo `player_identity_recoveries`, con como mínimo:

- `recovery_id`;
- source provisional;
- target registered player;
- claim ganador;
- actor/auth context;
- estado;
- timestamps;
- resultado;
- metadata estructurada mínima de conflictos/derivados.

Debe existir una única recuperación exitosa de una provisional.

La provisional origen deja de ser seleccionable/activa como identidad independiente después del vínculo, pero sigue trazable.

No usar `canonical_player_id` genérico.

### 3.4 Cuenta nueva

Preservar UX vigente:

- token/intención se conserva durante signup;
- después de autenticación vuelve a `¿Sos {nombre}?`;
- vinculación ocurre antes de completar Perfil/Nivel oficial cuando corresponda;
- `complete_profile`/legal/Nivel siguen fail-closed.

Resolver la incompatibilidad de `legal_acceptances` sin perder evidencia.

Después de confirmar Nivel inicial V1.3, ejecutar el procesamiento de evidencia recuperada de forma idempotente. Si falla transitoriamente, la cuenta no debe perder identidad ni duplicar efectos al reintentar.

### 3.5 Cuenta existente y varias provisionales

La identidad registrada existente permanece como destino estable.

Al confirmar una provisional:

- validar que source sigue provisional/no recuperada;
- validar token;
- preflight completo de todos sus partidos;
- si target ya aparece en otro slot del mismo partido -> conflicto estructurado y **cero mutaciones** en esa operación;
- reasociar únicamente verdad actual que corresponda, especialmente `match_participants`;
- refrescar `participant_fingerprint` de cada partido afectado;
- preservar actores/revisiones/submissions/eventos históricos sin reescribirlos como si siempre hubieran pertenecido al target;
- marcar source provisional como inactiva/recuperada de forma auditable.

Una cuenta puede repetir el flujo con otra provisional mediante otra recovery independiente.

## 4. Nivel — evidencia recuperada

No “mover” un delta viejo del invitado: la provisional nunca tuvo fila propia de `match_level_result_players` en los casos normales.

Implementar un camino explícito de **recovery replay** para el jugador destino:

- orden por `played_at` ascendente;
- parte del Nivel actual/base del target al iniciar esa recovery;
- solo partidos elegibles según `Nivel_BRAMU.md`;
- usa snapshots históricos reales de compañero/rivales cuando existan;
- nunca niveles actuales de terceros;
- usa las mismas reglas de invitados/imputación/disponibilidad vigentes si el histórico lo permite;
- reutiliza el motor JS compartido `nivel_bramu_v1_0`; no reimplementar fórmula en SQL;
- aplica efecto solo al target;
- no toca deltas históricos de los otros participantes;
- actualiza `mu/confidence/evidence_units/rated_matches/distinct_opponents/status` del target;
- un CALIBRANDO puede completar 5+3 gracias a evidencia recuperada;
- un CALIBRADO no se descalibra por recuperar.

Persistir cada efecto/omisión de recovery en una tabla server-only dedicada y auditable, por ejemplo `level_recovery_effects`, con unique `(recovery_id, match_id)` o equivalente.

Estados sugeridos:

- applied;
- skipped_ineligible;
- skipped_missing_snapshot;
- reverted_duplicate.

Guardar inputs suficientes para auditar/revertir sin reinterpretar con datos vivos.

La orquestación que necesita el motor JS debe vivir en Edge/server seguro, no en navegador.

## 5. Duplicados post-recuperación

### 5.1 Detección

Después de reasignar identidades pueden aparecer dos `match_id` que ahora tienen composición equivalente.

Reutilizar la semántica estructural existente de `create_or_attach_match`:

- participantes/parejas;
- fecha/hora conocida o día;
- formato;
- score/revisión vigente;
- ubicación si existe.

No matching por nombre.

Persistir candidatos/resolución para que `NO, SON DOS PARTIDOS DISTINTOS` no vuelva a preguntar indefinidamente.

### 5.2 UX

Mostrar:

`Encontramos dos partidos que podrían ser el mismo`

con evidencia disponible.

Acciones:

- `SÍ, ES EL MISMO`
- `NO, SON DOS PARTIDOS DISTINTOS`

### 5.3 Si son distintos

- registrar resolución;
- mantener ambos;
- no modificar efectos.

### 5.4 Si son el mismo

Elegir un `match_id` canónico de encuentro y preservar trazabilidad de ambos registros:

- submissions;
- revisiones;
- acciones;
- origen de la reconciliation.

No borrar historia para ocultar el segundo registro.

Si hay score/revisión diferente, reutilizar el mecanismo vigente de corrección/validación; no inventar una tercera semántica.

Si ambos tenían efecto deportivo:

- dejar un solo efecto de encuentro;
- usar/reutilizar el mecanismo de reversión existente para el efecto normal duplicado cuando aplique;
- revertir también cualquier `level_recovery_effect` perteneciente al duplicado, de forma estrecha e idempotente;
- estadísticas/Grupos/Intelligence dejan de contar dos veces;
- Ranking publicado permanece intacto.

No “recalcular toda la carrera” de todos los participantes.

## 6. Grupos / estadísticas / Intelligence

### Estadísticas

Al cambiar la identidad oficial en `match_participants`, los derivados server-backed deben reconocer el historial recuperado. No duplicar almacenamiento si hoy se deriva de partidos.

### Grupos

Reutilizar `group_memberships` reales de la semana.

- si el target ya era miembro y la identidad corregida hace 3/4, puede contar;
- si no era miembro, no inventar membresía;
- un duplicado reconciliado cuenta una vez.

### BRAMU Intelligence

El fingerprint actual ya incluye composición de participantes y snapshot oficial de Nivel.

Por eso:

- identidad cambiada -> fingerprint distinto;
- replay de prefijos afectados;
- checkpoint reusable solo si fingerprint + rules version siguen iguales;
- conservar snapshots históricos;
- no crear “Intelligence de recovery” paralela.

## 7. Frontend / UX

### Partido con provisional

En Resumen/detalle, si hay provisionales relacionadas:

- sección `JUGADORES SIN CUENTA`;
- fila por jugador;
- acción `INVITAR`.

Sheet:

**Invitá a {nombre} a BRAMU**

`Compartile este enlace para que pueda sumarse a BRAMU y recuperar sus partidos. El enlace es personal: envíaselo solo a {nombre}.`

CTA:
`COPIAR ENLACE`

Feedback:
`Enlace copiado. Enviáselo a {nombre}.`

Sin botón específico de WhatsApp.

### Receptor

Preview seguro antes de consumir:

**¿Sos {nombre}?**

`Hay partidos registrados con esta identidad. Si sos vos, podés vincularlos a tu cuenta.`

- `SOY YO`
- `NO SOY YO`

Sin sesión:

- conservar intención;
- acceso normal;
- crear cuenta / `Ya tengo cuenta`;
- volver automáticamente tras autenticación.

Con sesión completa:

- permitir recovery; no mostrar “contactá soporte”.

Evitar “reclamar” en copy visible.

### Versionado

Como esta ronda agrega UX visible, la primera entrega frontend completa debe salir como:

- **BRAMUlab V04.29**
- bundle **04.29-h1**

Backend-only commits previos pueden no mover versión visible; el commit que distribuya la nueva UX sí debe alinear `APP_VERSION`, `BUNDLE_VERSION`, `version.json`, SW/cache y query strings según el patrón vigente.

## 8. Seguridad / RLS / rate limits

Preservar:

- deny-by-default;
- tablas de tokens/recovery/effects/duplicate resolutions sin SELECT directo de cliente;
- comandos públicos vía RPC/Edge con JWT y payload validado;
- no exponer hash de token;
- no exponer service role;
- rate limits para preview/crear/consumir/recovery/resolución;
- idempotencia para mutaciones;
- locks determinísticos;
- transacciones atómicas;
- auditoría de actor/source/target/claim/timestamps/result.

Después de DDL, revisar advisors de seguridad/performance.

## 9. Ejecución en tres fronteras, una sola ronda coordinada

### A — Backend identidad / links / recovery

Incluye:

- migración;
- índices/constraints;
- helper relación;
- create link multi-invitador;
- preview;
- consumo atómico;
- recovery table;
- cuenta nueva + cuenta existente + múltiples provisionales;
- conflicto doble-slot;
- permisos/RLS/rate limits;
- tests SQL/Node del seam.

Checkpoint técnico interno antes de B.

### B — Frontend / UX

Incluye:

- sección JUGADORES SIN CUENTA;
- INVITAR;
- copiar link;
- preview `¿Sos...?`;
- SOY YO / NO SOY YO;
- preservar intención por auth;
- cuenta existente;
- no support/manual;
- versionado V04.29 / 04.29-h1.

Checkpoint técnico interno antes de C.

### C — Duplicados + derivados

Incluye:

- detección post-recovery;
- persistencia de candidate/resolution;
- UX same/different;
- reconciliación atómica;
- reversión de doble efecto normal/recovery;
- stats;
- Grupos;
- Intelligence replay;
- Ranking futuro únicamente.

Una sola devolución final a Central. No interrumpir por hallazgos técnicos que se puedan resolver siguiendo las fuentes vigentes.

## 10. Pruebas focales obligatorias

No repetir QA general.

Cubrir, como mínimo:

1. cuenta nueva desde link;
2. cuenta existente desde link;
3. segundo provisional vinculado a la misma cuenta;
4. dos links de invitadores distintos a la misma provisional;
5. regenerar link del mismo invitador no rompe el del otro;
6. carrera concurrente de dos links: un único ganador, otros revoked;
7. token inválido/expirado/revocado/usado;
8. NO SOY YO no consume;
9. no relacionado no puede generar link;
10. relation por partido sí puede;
11. legal acceptance del bootstrap no se pierde/rompe;
12. misma persona terminaría en dos slots -> fail cerrado, cero mutación;
13. recovery idempotente;
14. Nivel: recovered eligible aplica solo target y usa snapshots históricos;
15. Nivel: missing snapshot -> skip explícito sin inventar;
16. CALIBRANDO puede avanzar/cerrar 5+3;
17. CALIBRADO no se descalibra;
18. terceros conservan sus deltas históricos;
19. Ranking publicado byte/filas sin cambios;
20. Grupos 2/4 -> 3/4 solo si target ya era miembro esa semana;
21. Intelligence fingerprint/replay cambia con identidad;
22. duplicate candidate SAME -> un solo efecto final;
23. duplicate candidate DIFFERENT -> ambos quedan;
24. duplicado ya oficial con doble efecto -> reversión idempotente del extra;
25. stats no duplican;
26. reintentos de red no duplican recovery/efectos;
27. ACL/RLS/rate limits;
28. advisors después de DDL;
29. regresión focal del create-or-attach existente;
30. regresión focal de correction/identity issue existente.

Cuando sea útil, usar fixtures/transactional verify que terminen en rollback para no ensuciar Staging. Para validar el seam real, Central podrá después aplicar migración y ejecutar la QA contra Supabase Staging.

## 11. Límites de esta implementación

NO tocar:

- `main`;
- Production;
- BRAMUlive;
- fórmula V1.3 del cuestionario;
- reglas de Ranking;
- fórmula de puntos de Grupos;
- generic account-to-account merge;
- social matching por nombre;
- login por @usuario;
- monetización.

No reescribir documentación histórica. Las fuentes maestras ya quedaron actualizadas antes de este handoff.

## 12. Entrega de Claude

Al finalizar informar en una sola devolución:

- HEAD(s) y propósito de cada commit;
- migraciones creadas;
- Edge Functions/RPCs creadas o modificadas;
- tablas/índices/constraints nuevos;
- cómo resolvió técnicamente el seam `legal_acceptances` sin perder auditoría;
- cómo serializa claims concurrentes;
- cómo representa recoveries y efectos de Nivel recuperados;
- cómo resuelve/representa duplicados;
- archivos frontend tocados;
- versión/bundle final;
- tests ejecutados y resultados;
- qué no pudo ejecutar contra Staging real por falta de credenciales;
- Vercel si hubo deploy por push;
- cualquier `DECISIÓN ABIERTA` genuinamente humana, solo si apareció una que las fuentes no resuelven.

Después PARAR y esperar gate Central.
