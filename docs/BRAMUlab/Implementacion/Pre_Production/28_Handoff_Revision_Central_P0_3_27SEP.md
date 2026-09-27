# BRAMUlab — Handoff revisión central P0.3 — cierre técnico antes de aplicar

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Base a revisar:** `8652e4d5b0a1a09f21a954ab67e6f696c32fbde7`  
**Origen:** revisión central de `27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md`.

## 1. Objetivo

Corregir y completar el diseño técnico de P0.3 antes de que Central aplique ninguna migración a Supabase Staging.

La Fase A anterior está bien encaminada y respetó el aislamiento de `04.11-h10`, pero Central encontró huecos concretos en Auth, Storage y presentación de Ranking que impiden aprobarla todavía.

Esta ronda sigue siendo independiente del QA físico pendiente del Laboratorio.

## 2. Fuentes obligatorias

Leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md` — P0.3
4. `docs/BRAMUlab/Backend_Infraestructura.md`
5. `docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md`
6. `docs/BRAMUlab/Implementacion/Pre_Production/26_Handoff_P0_3_Fase_A_Eliminacion_Cuenta_27SEP.md`
7. `docs/BRAMUlab/Implementacion/Pre_Production/27_Resultado_P0_3_Fase_A_Eliminacion_Cuenta.md`
8. `supabase/migrations/20260927150000_preprod_p03_fase_a_account_deletion.sql`
9. `supabase/tests/verify-preprod-p03-fase-a-account-deletion.sql`

Además, verificar contra documentación vigente de Supabase antes de tocar Auth/Storage.

## 3. Hallazgos confirmados por Central

### A — Auth: corregir una afirmación incorrecta

La documentación vigente de Supabase confirma:

- borrar un usuario de `auth.users` / usar Admin `deleteUser` **NO invalida automáticamente un access token JWT ya emitido**;
- ese JWT puede seguir criptográficamente válido hasta expirar;
- para garantías fuertes de cierre de sesión deben considerarse revocación de sesiones y/o validación de `session_id` según el nivel de sensibilidad.

Por lo tanto:

**REEMPLAZAR** cualquier afirmación del resultado/migración que diga o implique que `deleteUser` es “el único mecanismo que invalida realmente una sesión JWT ya emitida”.

BRAMU además tiene una propiedad útil que debe trazarse y probarse: la mayoría de sus RPCs sensibles resuelven al jugador mediante:

`players.auth_user_id = auth.uid()`

Si la identidad eliminada pierde ese vínculo, un JWT viejo puede seguir siendo válido para Supabase Auth pero debería dejar de mapear a un jugador BRAMU.

### Trabajo requerido

1. Auditar TODOS los contratos autenticados relevantes para confirmar cuáles dependen de ese mapping y si existe alguna operación sensible que pudiera seguir actuando con un JWT viejo.
2. Diseñar un corte de acceso BRAMU inmediato y explícito.
3. Evaluar como primera opción que `admin_delete_player_account` deje también `players.auth_user_id = null`, de modo que la autorización de BRAMU se corte en la misma transacción que la anonimización y no dependa de que el paso posterior del Auth Admin API tenga éxito.
4. Si existe una razón concreta para no hacerlo, documentarla y proponer una alternativa igual de fuerte.
5. El procedimiento final debe distinguir claramente:
   - desautorización inmediata dentro de BRAMU;
   - revocación/cierre de sesiones;
   - eliminación final de la cuenta Auth.
6. El flujo debe ser idempotente y recuperable ante fallo parcial.

No tocar directamente tablas internas de Auth por SQL.

---

### B — Storage/avatar: el orden actual no es seguro

La documentación vigente de Supabase confirma que un usuario Auth puede no poder eliminarse si todavía es propietario de objetos en Supabase Storage.

BRAMU actualmente sube avatares reales al bucket privado `avatars` desde la sesión autenticada, bajo:

`{playerId}/{timestamp}.jpg`

y `profiles.avatar_url` conserva la ruta.

La Fase A actual pone `avatar_url = null` pero deja el archivo físico para “limpieza posterior”. Eso puede impedir el paso final de Auth y además dejar un objeto personal huérfano.

### Trabajo requerido

1. Trazar el ownership real de los avatares de BRAMU y el contrato vigente de Storage.
2. El procedimiento administrativo debe borrar los objetos del avatar mediante **Storage API**, no mediante DELETE directo sobre `storage.objects`.
3. Diseñar el orden de pasos para que un fallo parcial sea recuperable.
4. No perder la ruta necesaria para limpiar el archivo antes de haberla capturado o de poder derivarla por `playerId`.
5. Agregar cobertura de prueba del orquestador para:
   - cuenta con avatar;
   - cuenta sin avatar;
   - Storage ya vacío;
   - reintento después de fallo parcial.

---

### C — Ranking publicado: hoy puede quedar una fila sin nombre

Central verificó el contrato real vigente de `get_ranking_classification`.

La clasificación publicada:

- toma las posiciones desde `ranking_rows` — correcto, snapshot semanal inmutable;
- para la identidad visual hace JOIN con `profiles`;
- devuelve `pr.display_name` / `pr.username`;
- no exige `players.is_active` para cada fila de una edición ya publicada.

La Fase A pone esos campos de Perfil en NULL y preserva `ranking_rows`.

Resultado posible durante la edición semanal vigente: el jugador eliminado conserva correctamente su puesto histórico del snapshot, pero aparece con identidad vacía/null.

### Regla

**NO TOCAR ni reescribir `ranking_rows` publicados.** La inmutabilidad semanal sigue siendo obligatoria.

### Trabajo requerido

1. **FUSIONAR** una presentación anónima segura para una identidad eliminada, por ejemplo `Jugador eliminado`, sin revelar username/avatar y sin modificar el snapshot competitivo.
2. Auditar no solo `get_ranking_classification`, sino todas las lecturas de Ranking/Mi red/perfil que puedan resolver una fila histórica de ese jugador.
3. Las ediciones futuras ya deberían excluirlo mediante `is_active=false`; comprobarlo con tests.
4. No alterar fórmula, posición, densidad, Nivel ni reglas del Ranking.

---

## 4. Auditoría transversal de PII/nombres

Revisar nuevamente superficies persistentes y de lectura que puedan conservar o reconstruir el nombre:

- `match_participants.display_name_snapshot`;
- `intelligence_match_outputs.output/audit`;
- notificaciones y su enriquecimiento histórico/actor/contexto;
- `match_actions.metadata`;
- `pilot_events.properties`;
- claims/invitaciones;
- cualquier snapshot o JSON con texto libre.

No borrar estructura histórica necesaria solo por contener IDs.

### Nota sobre auditoría administrativa

La firma actual acepta `p_admin_note text` libre y el comentario pide “no poner PII”. Esa regla no es técnicamente exigible.

Preferencia de Central para V1:

- evitar persistir texto libre innecesario en una operación de privacidad;
- si no existe una necesidad real de producto/operación, **REEMPLAZAR** esa nota libre por auditoría mínima estructurada/no identificatoria o eliminarla;
- no inventar un catálogo complejo de motivos.

---

## 5. Vehículo administrativo mínimo

P0.3 V1 es eliminación **asistida**, no autoservicio.

No hace falta construir un panel de administración ni una arquitectura nueva.

Elegir el vehículo más simple y seguro para orquestar:

1. corte de acceso BRAMU;
2. anonimización SQL;
3. eliminación de avatar vía Storage API;
4. revocación/cierre de sesiones si corresponde;
5. eliminación final de Auth;
6. verificación post-condición.

Preferencia: un script administrativo server-side/repo-local con credenciales provistas por entorno puede ser más seguro y simple que exponer una nueva Edge Function destructiva. Si elegís Edge Function, debe existir una autorización administrativa real adicional; `verify_jwt=true` por sí solo NO alcanza porque también acepta JWTs de usuarios normales.

Nunca:
- exponer `service_role` al navegador;
- commitear secretos;
- pedir secretos en documentación;
- hacer SQL directo sobre `storage.objects` o internals de Auth.

## 6. Implementación esperada

Como la migración `20260927150000_preprod_p03_fase_a_account_deletion.sql` **todavía NO fue aplicada a ningún entorno**, puede corregirse directamente antes de su primera aplicación. No crear una migración correctiva encima de una migración que aún no existe remotamente salvo que haya una razón concreta.

### AGREGAR / FUSIONAR

- correcciones necesarias en la migración P0.3;
- verify SQL actualizado;
- tests del vehículo/orquestador administrativo;
- presentación anónima de Ranking si requiere migración/RPC;
- documentación operativa clara y mínima;
- verificación de permisos.

### NO TOCAR

- frontend `bramulab/` y bundle `04.11-h10`, salvo que una corrección de lectura server-side pueda resolverse únicamente con frontend; en ese caso detener ese subpunto y documentarlo antes de cambiar el bundle;
- `main`;
- Production;
- BRAMUlive;
- fórmula de Nivel;
- fórmula/posiciones/snapshots de Ranking;
- contenido legal P0.2;
- Bloque 9;
- popup §15.26;
- otras rondas UX.

## 7. Tests mínimos

Además de mantener los tests de Fase A:

1. JWT viejo / `auth.uid()` todavía presente pero jugador ya desvinculado: las operaciones sensibles BRAMU no deben encontrar identidad activa.
2. Cuenta eliminada no aparece como jugador activo/buscable/perfil público.
3. Partido compartido conserva `player_id` y muestra `Jugador eliminado`.
4. Ranking publicado conserva puesto/snapshot pero muestra identidad anónima y ninguna PII.
5. Edición futura no vuelve a considerar elegible al jugador.
6. Intelligence derivada no conserva el nombre eliminado.
7. Notificaciones/contextos no reconstruyen nombre viejo.
8. Avatar Storage se elimina por API en la orquestación.
9. Operación completa es reintentable después de:
   - SQL ya ejecutado;
   - Storage ya limpio;
   - Auth ya eliminado.
10. usuario común no puede ejecutar la operación administrativa.
11. fixtures rollback limpio.

## 8. Restricción remota de esta ronda

**NO aplicar migraciones a Supabase Staging todavía.**  
**NO desplegar Edge Functions.**  
**NO hacer deploy de frontend.**

Central hará la revisión final y recién después decidirá aplicación/validación remota.

Sí:

- correr tests locales;
- revisar diff;
- commit lógico;
- push `origin/staging`.

## 9. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/29_Resultado_Revision_Central_P0_3_27SEP.md`

Debe indicar con precisión:

- qué problemas encontró/corrigió;
- flujo administrativo final y orden exacto;
- archivos cambiados;
- tests;
- qué quedó sin ejecutar remotamente;
- riesgos residuales;
- cualquier DECISIÓN ABIERTA real.

No marcar P0.3 cerrado. Central decide el cierre luego de validar Staging real.
