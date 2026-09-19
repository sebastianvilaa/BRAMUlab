# Backend Bloque 3 — Revisión de ChatGPT y autorización de implementación

**Fecha:** 19/09/2026  
**Estado:** aprobado con correcciones.  
**Base revisada:** plan de Claude posterior a la inspección de `staging` en `998eac5`.

Revisé el plan. Está APROBADO para implementación con las siguientes correcciones y decisiones cerradas.

Podés avanzar con Backend Bloque 3 en esta misma sesión respetando estos ajustes.

---

## 1. Precisión de Nivel — confirmado

Tu detección es correcta.

Mantener lo que dicen hoy la Fórmula V1.5 y el código:

- valor público: 1 decimal;
- precisión interna/backend: 4 decimales.

NO cambiar a 2 decimales.

La referencia anterior a 2 decimales era contexto desactualizado y queda descartada.

No modificar la fórmula por este punto.

---

## 2. Motor server-side — cambiar la propuesta

NO quiero duplicar el motor matemático de Nivel en PL/pgSQL si podemos evitarlo.

El principio vigente de Backend es:

`un único motor compartido/versionado + tests de paridad`

El motor actual de Nivel ya es JS puro y determinista.

Por lo tanto:

**REEMPLAZAR** la propuesta:

`compute_initial_level_estimate()` implementado como puerto completo PL/pgSQL

**POR** una arquitectura que reutilice el MISMO motor JS en server-side.

Preferencia:

- Supabase Edge Function para la oficialización/calculadora server-side;
- reutilizar/refactorizar el motor puro existente para que navegador y Edge Function ejecuten la misma fuente matemática;
- evitar mantener dos implementaciones independientes de la fórmula.

La Edge Function debe:

1. validar la sesión/JWT;
2. recibir respuestas crudas del cuestionario, nunca un Nivel final confiado al cliente;
3. ejecutar el motor vigente compartido/versionado;
4. obtener el resultado oficial;
5. llamar a una operación/RPC privada y atómica de persistencia;
6. devolver el estado oficial.

La escritura final en base debe seguir siendo atómica.

La RPC de persistencia NO debe poder ser usada por el cliente para inyectar libremente un resultado de Nivel. Restringir permisos adecuadamente para que la autoridad siga siendo server-side.

IMPORTANTE:
No copies simplemente el motor JS dentro de `_shared` generando otra copia manual que después pueda divergir.

Buscá la forma mínima de tener una única fuente matemática real reutilizable por:

- navegador;
- Edge Function;
- tests.

Si para lograr esto aparece una limitación técnica real del bundling/deploy de Supabase que obligaría a una duplicación importante, FRENÁ y explicámela antes de caer automáticamente en PL/pgSQL.

No rediseñar la fórmula.

---

## 3. `level_states` — PENDIENTE debe existir

No quiero que la ausencia de fila sea la representación backend definitiva de `PENDIENTE`.

El contrato backend vigente define explícitamente:

- PENDIENTE
- CALIBRANDO
- CALIBRADO
- RECALIBRANDO

Por lo tanto `level_states.status` debe contemplar también:

`PENDIENTE`

El hecho de que el prototipo/localStorage haya representado históricamente “sin estimación” como ausencia de estado NO debe modificar el contrato productivo backend.

Flujo esperado:

- antes de confirmar email: no hay identidad server-side completa y el borrador sigue local;
- cuando el email queda confirmado y existe `player_id`, puede existir estado server-side `PENDIENTE`;
- cuando la oficialización de Nivel termina correctamente, pasa atómicamente a `CALIBRANDO`.

Esto además ayuda al caso de confirmación anticipada del email.

Evaluá si lo más coherente es extender idempotentemente `handle_email_confirmed` para crear ese `level_state PENDIENTE`, o inicializarlo inmediatamente mediante el flujo server-side correspondiente.

Elegí la variante más simple y segura, pero el modelo final debe admitir `PENDIENTE` explícitamente.

---

## 4. `complete_profile` — no hacer COALESCE genérico

NO apruebo cambiar ahora `complete_profile` a una semántica general de merge parcial con `COALESCE`.

Bloque 2 está cerrado y no quiero modificar más semántica de la necesaria.

Para Bloque 3:

- reutilizá las validaciones existentes;
- relajá únicamente lo imprescindible para que localidad y `competitive_branch` no bloqueen el perfil mínimo;
- o creá un comando específico de perfil mínimo/oficialización si eso mantiene más limpio el contrato de Bloque 2.

NO resolver ahora anticipadamente la futura pantalla de “completar datos para Ranking”.

La edición/completado competitivo puede tener su contrato específico cuando corresponda.

Los tests de Bloque 2 deben continuar pasando sin modificaciones oportunistas.

---

## 5. Ranking — decisión

La pantalla/modal:

`Completá tus datos para entrar al Ranking`

NO se implementa en Bloque 3.

El modelo debe quedar preparado para que:

- localidad;
- `competitive_branch`;
- `ranking_opt_in`

puedan estar incompletos sin bloquear Home/Nivel.

La UX específica de entrada productiva a Ranking se implementará con el bloque de Ranking correspondiente.

No adelantar Bloque 7.

---

## 6. Disponibilidad de @usuario pre-confirmación — sí

Sí quiero feedback de disponibilidad de `@usuario` antes de terminar todo el cuestionario.

Podés habilitar una vía `anon` muy acotada para:

`is_username_available`

siempre que:

- solo devuelva disponibilidad booleana / estado mínimo;
- no exponga datos del perfil;
- respete nombres reservados y formato;
- mantenga igualmente la validación definitiva server-side durante la oficialización.

Esto mejora UX, pero NO elimina el caso de carrera.

Aunque inicialmente figure disponible, `officialize_onboarding` debe volver a comprobarlo.

Si fue ocupado mientras tanto:

- conservar nombre/apellido;
- conservar términos;
- conservar cuestionario;
- conservar estimación local;
- volver solamente al paso de elegir `@usuario`.

---

## 7. Controles de laboratorio — confirmado

Conservarlos.

Pero:

- Development: visibles;
- Staging: pueden seguir disponibles para pruebas internas;
- Production: ocultos para usuarios comunes.

No eliminar herramientas útiles.

No permitir que “Resetear Nivel” modifique arbitrariamente un Nivel server-backed real.

---

## 8. Confirmación de email anticipada — aclaración importante

El usuario puede decidir confirmar el email antes de terminar el onboarding.

Si lo hace:

- se establece la sesión real;
- puede crearse la identidad server-side mínima correspondiente;
- el flujo continúa donde estaba;
- NO entra a Home;
- NO se oficializa Nivel hasta que estén completos:
  - perfil mínimo;
  - términos;
  - cuestionario;
  - confirmación visual del Nivel estimado.

La operación final de oficialización se ejecuta recién cuando el borrador requerido está completo.

Por lo tanto:

`email confirmado ≠ onboarding terminado`.

Home requiere:

`email confirmado + onboarding completo + Nivel oficial persistido`.

---

## 9. Idempotencia — ajuste

Acepto usar `player_id` / existencia de `level_states` como identidad natural de una oficialización única, sin introducir una tabla compleja de idempotency keys solo para este caso.

Pero reforzarlo a nivel DB:

- `level_states.player_id` único/PK;
- impedir más de un `initial_estimate` inicial oficial por jugador mediante constraint/índice o contrato equivalente;
- la operación completa debe ser atómica;
- un retry después de éxito devuelve el estado oficial ya existente;
- NO recalcula;
- NO duplica `level_events`;
- NO sobrescribe un resultado oficial con otro payload enviado por un retry posterior.

Agregar tests explícitos para:

- doble click;
- mismo request repetido;
- timeout después de commit;
- payload diferente enviado después de que el onboarding ya quedó oficializado.

---

## 10. Términos

Para Bloque 3 alcanza con el soporte técnico ya propuesto:

- `terms_version`;
- `terms_accepted_at`.

No diseñar ahora un sistema legal complejo ni redactar T&C.

La aceptación debe persistirse server-side y no depender solo del borrador local.

---

## 11. Tests

Antes de modificar nada, reconfirmá efectivamente la suite actual con el runner real.

No uses el conteo por grep como fuente del número de tests.

Baseline esperado:

`1408/1408`

Si el runner real devuelve otro número ANTES de tus cambios:

**FRENÁ y reportalo antes de continuar.**

Después de implementar:

- suite completa existente;
- `verify-bloque2` sin modificar;
- `verify-bloque3`;
- paridad del motor compartido;
- RLS;
- onboarding rápido;
- onboarding completo;
- confirmación anticipada;
- confirmación al final;
- refresh/reanudación;
- username ocupado;
- idempotencia;
- cuenta real Staging.

---

## 12. Resto del plan

Todo lo demás del plan queda aprobado:

- borrador local device-only;
- perfil mínimo nombre/apellido/@usuario/términos;
- Nivel rápido/completo;
- respuestas crudas hacia servidor;
- `level_states`;
- `level_events`;
- Home solamente después de oficialización;
- `CALIBRANDO 0/5`;
- localidad/rama/`ranking_opt_in` no bloqueantes;
- no tocar BRAMUlive;
- no tocar Bloques 4+;
- no tocar `main`;
- no rediseñar Nivel V1.5.

---

## Autorización

Con estos ajustes:

**AUTORIZO IMPLEMENTAR BACKEND BLOQUE 3.**

Hacé la implementación completa de forma ordenada.

Al finalizar:

- tests;
- migraciones verificadas en Staging;
- documentación actualizada;
- commit;
- push a `origin/staging`;
- deploy/verificación correspondiente;
- informe final claro.

Además, a partir de esta ronda, usar la carpeta:

`docs/BRAMUlab/Implementacion/Backend/Bloque_03/`

como registro operativo del bloque.

Antes de implementar, guardá tu plan ya producido como:

`02_Plan_Claude.md`

Al finalizar, guardá el informe completo de implementación como:

`04_Informe_Implementacion_Claude.md`

No conviertas estos archivos en nuevas fuentes maestras de producto: son registro operativo. Si la implementación cambia documentación maestra, actualizar también los documentos maestros correspondientes.

Si aparece una contradicción arquitectónica REAL relacionada con el motor compartido/server-side que obligue a abandonar este criterio, FRENÁ antes de elegir otra arquitectura.

Fuera de eso, no hace falta volver a pedir aprobación por decisiones menores de implementación.
