# Backend Bloque 7 — Revisión central del análisis técnico

**Fecha:** 22/09/2026  
**Rama:** `staging`  
**Base revisada:** `a9175044c3a6c04a8a81eb6f674b0ad124b18a57`  
**Documento revisado:** `02_Analisis_Claude.md`  
**Estado:** análisis técnicamente bien orientado, con correcciones obligatorias antes de implementar.

## 1. Qué se acepta

Se acepta como dirección general:

- Ranking real debe ser server-side y consumir una edición semanal publicada;
- reutilizar `get_player_level_state_as_of` / ledger de Nivel en vez de recalcular Nivel;
- reutilizar los partidos oficiales/elegibles ya cerrados en Bloques 5–6;
- edición semanal inmutable;
- `ranking_editions` + filas de Ranking persistidas;
- RLS deny-by-default y lecturas cruzadas solo por RPC segura;
- publicación idempotente;
- `pg_cron` como mecanismo preferido, si Staging lo valida;
- frontend reemplaza mocks sin cambiar UX ni reglas de producto.

No se reabre Ranking_BRAMU.md.

## 2. C-01 — Mi red NO queda como decisión abierta

La aparente ambigüedad se resuelve por las reglas ya cerradas del master:

- Ranking es semanal;
- la edición permanece estable durante toda la semana;
- Mi red es uno de los ámbitos UX vigentes;
- ocultar/restaurar solo cambia la vista personal y **no modifica Ranking oficial**.

Por lo tanto:

**membresía competitiva y posiciones de Mi red deben quedar ancladas al corte de la edición semanal.**

No hace falta materializar una tabla de Mi red si no aporta valor. Puede calcularse al leer, pero siempre usando:

- la ventana de 180 días evaluada **as-of el cutoff de la edición**, no `now()`;
- estados/Niveles congelados de esa misma edición.

Así el resultado es estable durante la semana.

Ocultar/restaurar puede seguir siendo una acción inmediata de presentación personal, pero:

- no recalcula el Ranking oficial;
- no cambia puestos/denominadores oficiales;
- no hace entrar a mitad de semana a una relación deportiva nueva.

Un jugador con quien se comparte un partido después del corte podrá aparecer en la edición siguiente. Si producto en el futuro quiere una sección social "red reciente" en vivo, es otra función y no cambia Ranking V1.

**DECISIÓN ABIERTA eliminada.**

## 3. C-02 — Snapshot: los no elegibles y el motivo NO son opcionales

`Ranking_BRAMU.md §17.2` exige explícitamente que cada edición conserve:

- elegibilidad;
- motivo;
- grupo de empate;
- Nivel/estado del corte;
- última actividad computable;
- ubicación;
- rama;
- reglas/versiones aplicadas.

Por eso es incorrecto tratar las filas no elegibles como “opcionales”.

La implementación debe conservar evidencia suficiente para reconstruir por qué un candidato estaba dentro o fuera de una clasificación en ese corte.

El modelo final debe incluir explícitamente, donde corresponda:

- `is_eligible`;
- `eligibility_reason` o `eligibility_reason_codes`;
- `tie_group` (o representación equivalente persistida);
- `level_algorithm_version`;
- `last_computable_at`/equivalente semánticamente correcto;
- ubicación/IDs canónicos congelados;
- rama congelada;
- `ranking_rules_version`.

No inventar motivos. Deben surgir de reglas reales evaluadas.

## 4. C-03 — Los ámbitos propios no aceptan un territorio arbitrario del cliente

La propuesta `get_ranking_scope(p_scope_type, p_scope_key, ...)` permitiría al cliente pedir cualquier `scope_key`, lo cual crea de hecho la función futura **Explorar rankings**.

Eso está fuera de V1.

Para la pantalla principal de Ranking:

- Local / Provincial / País deben derivarse del ámbito propio congelado del usuario en la edición;
- Global no requiere territorio arbitrario;
- el cliente puede elegir el TIPO de ámbito y filtros permitidos, pero no inyectar otra ciudad/provincia/país.

El servidor debe resolver el `scope_key` autorizado desde la identidad del caller + snapshot vigente.

El Perfil público sí puede leer la tarjeta territorial del jugador de ese perfil, usando **los ámbitos propios de ese jugador**, nunca un territorio elegido libremente.

## 5. C-04 — Falta el contrato real de “Completar datos para Ranking”

Esto es un gap material del análisis.

El backend vigente dejó localidad, rama y `ranking_opt_in` diferidos a la entrada a Ranking.

Pero:

- `complete_profile` actual NO escribe `ranking_opt_in`;
- además conserva semántica de sobreescritura completa de muchos campos;
- reutilizarlo desde una pantalla “Completar datos para Ranking” obliga a reenviar datos de perfil y aumenta riesgo de pisar información.

Bloque 7 debe crear una vía server-side específica y acotada para completar/actualizar los datos de Ranking, por ejemplo una RPC dedicada.

Debe poder manejar exclusivamente:

- localidad deportiva;
- rama competitiva;
- `ranking_opt_in`;

sin reescribir nombre, apellido, username, términos u otros campos ajenos.

Esto no cambia UX: implementa el gate ya cerrado de `Ranking_BRAMU.md §13.7`.

## 6. C-05 — Cambio de ubicación: un timestamp único no alcanza para “queda auditado”

Agregar solo `profiles.location_effective_from` permite cooldown, pero no conserva por sí mismo un historial completo después del segundo cambio.

La regla vigente exige:

- cambio auditado;
- cooldown de 30 días;
- nueva ubicación entra como `Nuevo` en la siguiente edición;
- no arrastra movimiento del territorio anterior.

Implementar la solución mínima que preserve historia real. Preferencia:

- `profiles.location_effective_from` como estado actual;
- tabla/evento append-only de cambios de ubicación (player, before, after, effective_at).

La RPC específica de Ranking debe:

- distinguir alta inicial de ubicación vs. cambio;
- aplicar cooldown solo cuando corresponda;
- registrar el cambio de forma atómica;
- nunca confiar en timestamps enviados por cliente.

## 7. C-06 — Perfil visible e integridad: mapear explícitamente el contrato vigente

El análisis detectó correctamente que hoy no existen `public_profile_enabled` ni `ranking_integrity_status`, pero no puede simplemente ignorarlos.

### Perfil visible

`Backend_Infraestructura.md §5.1` ya cerró que, en el lanzamiento inicial:

- los perfiles deportivos son visibles para usuarios autenticados;
- no hay controles de privacidad campo por campo;
- el consentimiento específico para Ranking es `ranking_opt_in`.

Por lo tanto no hace falta inventar ahora un toggle UX `public_profile_enabled`.

La implementación debe documentar el mapeo efectivo: perfil deportivo visible según la política vigente + `ranking_opt_in` para participar.

No abrir una nueva función de privacidad.

### Integridad

Ranking sí exige poder excluir una cuenta por integridad/cuenta.

Mantenerlo mínimo:

- `players.is_active` sigue resolviendo cuenta activa;
- si hace falta representar una exclusión de Ranking separada, usar un estado server-only mínimo, con default elegible y sin UX/admin avanzada nueva.

No implementar herramientas avanzadas de integridad fuera de V1.

## 8. C-07 — Ubicación canónica: no hay decisión pendiente para aceptar manuales

`Backend_Infraestructura.md §5.3` ya establece:

- una localidad manual queda `verified_for_ranking=false`;
- mientras siga así, **no habilita Ranking territorial**.

Por lo tanto no dejar “Provincial/País podrían aceptar manual si el maestro lo permite” como duda futura.

Para Ranking V1, la elegibilidad territorial requiere ubicación canónica/verificada según el contrato vigente.

Usar IDs estructurados reales:

- Local: ID canónico de localidad;
- Provincial: ID canónico de provincia/área;
- País: `country_code`;
- Global: universo global cuando se desbloquea.

No agrupar por labels libres.

## 9. C-08 — Recalibración y versionado deben resolverse antes de cerrar la función de cálculo

La duda sobre `RECALIBRANDO` es técnica, no una decisión de producto.

Regla cerrada:

- mientras recalibra, Ranking usa el último Nivel consolidado válido;
- el provisional no altera la edición.

Antes de considerar lista Fase 2, verificar cómo se representa eso en el ledger real y, si el helper `get_player_level_state_as_of` no distingue consolidado/provisional, extender el contrato server-side mínimo necesario.

Además el snapshot debe conservar la versión del algoritmo de Nivel usada en el corte. Si el helper actual no la devuelve, resolverlo sin recalcular Nivel.

## 10. C-09 — `pg_cron` no requiere intervención manual del usuario por ahora

La revisión central consultó Supabase Staging real:

- `pg_cron` está disponible en el proyecto;
- versión disponible: 1.6.4;
- actualmente no está instalado/habilitado.

No habilitarlo todavía.

Cuando llegue Fase 4, intentar habilitarlo primero por migración/automatización en Staging. Solo pedir intervención humana si aparece una limitación real de permisos/plataforma.

Por lo tanto esto **no es un bloqueo humano actual**.

## 11. Modelo recomendado antes de implementar

Mantenerlo simple y compatible con el master.

### `ranking_editions`

Una edición semanal inmutable, con corte efectivo y versionado.

### `ranking_rows` / equivalente

Debe persistir suficiente estado congelado para:

- jugadores elegibles;
- candidatos no elegibles relevantes y su motivo;
- scopes propios;
- posición nullable;
- grupo de empate;
- denominador/densidad;
- Nivel exacto/público/banda;
- estado de Nivel;
- algoritmo de Nivel;
- última actividad computable;
- ubicación/IDs canónicos;
- rama;
- elegibilidad/motivo;
- versionado de Ranking.

No es obligatorio crear una tabla materializada aparte para Mi red.

Mi red puede calcularse en RPC usando:

1. relaciones de partido computable dentro de 180 días **respecto del cutoff de la edición**;
2. estado congelado de esa edición;
3. filtros de rama/Nivel;
4. ocultamientos personales como capa de presentación que no altera el Ranking oficial.

## 12. Fase siguiente autorizable

Con estas correcciones, puede arrancar:

**Fase 1 — esquema + contratos mínimos de datos de Ranking.**

Todavía NO:

- función completa de publicación;
- cron;
- frontend;
- mocks eliminados;
- QA de navegador.

Antes de aplicar a Supabase real, la migración de Fase 1 debe ser revisada centralmente y, si es posible, compilada/probada dentro de una transacción con rollback contra Staging.

## 13. Resultado de la revisión

- análisis de Claude: **APROBADO CON CORRECCIONES**;
- decisión Mi red: **CERRADA**, no requiere intervención de Sebastián;
- no hay decisión humana bloqueante;
- Fase 1 puede prepararse;
- Supabase real todavía NO debe modificarse hasta revisión central del diff.
