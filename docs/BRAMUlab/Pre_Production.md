# BRAMUlab — Consolidado pre-Production

**Fecha:** 23 de septiembre de 2026  
**Estado:** fuente activa para el tramo entre el cierre del Bloque 8 y el inicio/cierre del Bloque 9.  
**Objetivo:** reunir únicamente los pendientes reales antes de abrir BRAMU a usuarios reales, sin reabrir Bloques 1–8 ni convertir ideas futuras en requisitos de salida.

> Regla de lanzamiento vigente: cuando entra el primer usuario real en Production, BRAMU ya empezó. Production no es un piloto descartable.


## Corte de estado consolidado — 03/10/2026

> **Esta sección prevalece sobre estados intermedios más antiguos que permanezcan más abajo por trazabilidad.** No usar una frase histórica de este documento para reabrir trabajo que tenga evidencia posterior de cierre.

### Estado real antes de Production

| Frente | Estado real |
|---|---|
| **P0.1 — Estado cero / progresión temprana** | **IMPLEMENTADO.** El código vigente oculta módulos sin evidencia en Home/Perfil y usa estados vacíos honestos. Falta únicamente un **QA integrado corto de navegador** para formalizar el cierre documental de 0 partidos / primer partido / Perfil público. |
| **P0.1B — Ranking automático** | **IMPLEMENTADO Y VALIDADO.** En el mismo QA integrado de P0.1 confirmar solo que no reaparezca ningún opt-in legacy. |
| **P0.1C — Perfil editable** | **CERRADO EN STAGING.** |
| **P0.2 — Legal / Privacidad** | **NÚCLEO TÉCNICO CERRADO EN STAGING**: aceptación/reaceptación, páginas, acceso/seguridad, emails G1 y QA G2 están cerrados. **P0.2 no se cierra publicablemente todavía** porque las páginas conservan placeholders que dependen de la Production real: responsable/domicilio publicables, fecha de vigencia, AAIP/RNBDP, proveedores/regiones/transferencias y ciclos reales de backups/logs. El build de Production falla de forma segura mientras quede un placeholder. |
| **P0.3 — Eliminación de cuenta** | **CERRADO EN STAGING.** El E2E destructivo real se completó durante G1: challenge específico, OTP, eliminación efectiva, postcondiciones y email #8 posterior. No repetir salvo regresión concreta. |
| **P0.4 — Acceso V1** | **CERRADO.** Email + contraseña, OTP/recovery y Configuración G2 validados. |
| **P0.4B — Grupos BRAMU** | Backend/server-backed y QA integral base **CERRADOS** (Issue #6). La lógica V04.23 de top 2 + Americano está implementada; queda **Issue #23 abierto solo por QA humana final del ajuste V04.24 de ayuda/desglose**. No es un gap de backend ni de modelo deportivo. |
| **P0.4C — Invitados / identidad / recuperación** | V04.29 / 04.29-h2 fue **PASS CENTRAL en Staging**, pero el **QA humano del 04/10** abrió la ronda **V04.30 / 04.30-h1** (B1/B2/B3 + UX de recuperados, `NO PARTICIPÉ`, gate de 5 pendientes). **Implementada y probada en local (commit `b2df2b3`); migración `20261004100000` aplicada y B1/B2/B3 verificados en Staging por Central; C1/C2 corregidos en 04.30-h2; pendiente gate final Central y QA humano corto.** Ver `Implementacion/Pre_Production/125_Resultado_Correcciones_QA_Invitados_04OCT.md` (incluye DECISIONES ABIERTAS). |
| **P0.5 — Hardening / salida** | Pre-Bloque 9, 9A, 9B, **G1 y G2 CERRADOS**. Después de los dos QA residuales anteriores, quedan **G3** (autorización explícita + creación/configuración de Production) y **G4** (plan/región/retención/backups/restauración real de Production). |

### Qué NO corresponde hacer ahora

- no abrir otra feature;
- no repetir gates G1/G2/P0.3/Invitados ya cerrados;
- no tocar `main`, Production ni BRAMUlive;
- no completar placeholders legales con supuestos de Staging;
- no crear Production sin autorización explícita de Sebastián.

### Orden real siguiente

1. QA breve de Invitados por uso exploratorio de Sebastián (no reabre el gate técnico; solo buscar fricciones reales).
2. Cerrar los dos residuales de QA pre-Production que todavía carecen de evidencia formal: P0.1/P0.1B integrado y Issue #23 de Grupos.
3. Recién después pedir decisión/autorización de **G3/G4** y completar los datos legales que dependen de la Production real.
4. Crear Production limpia y hacer smoke inicial solo con Sebastián antes de invitar a terceros.


---

## 1. Punto de partida confirmado

Al crear este consolidado:

- Bloques 1–8 están **CERRADOS en Staging**;
- BRAMU Intelligence V1 A–E está cerrada;
- F generativa es opcional y **NO bloquea** Production;
- Ranking real semanal está cerrado;
- Nivel, identidades, invitados provisionales, partidos, validación, correcciones e Intelligence ya tienen backend real;
- no corresponde reauditar esos sistemas salvo regresión concreta;
- BRAMUlive sigue siendo un producto separado.

El trabajo que sigue no es “agregar funciones”: es **terminar la experiencia inicial pendiente, cerrar legal/privacidad operativa y endurecer la salida**.

---

# 2. OBLIGATORIO antes de abrir Production a un usuario real

## P0.1 — Completar la implementación de Estado Cero y progresión temprana

**Estado P0.1 al 24/09/2026:** IMPLEMENTADO + backend necesario validado en Staging. Pendiente únicamente QA visual/funcional real de navegador antes de marcar cierre final.

**Fuente maestra:** `Experiencia_Inicial.md`.

La definición está cerrada, pero el frontend vigente todavía no la cumple por completo.

### Home con 0 partidos oficiales

Debe:

- conservar identidad + Nivel estimado / `CALIBRANDO · 0/5`;
- usar Último partido como `Cargar primer partido` cuando no existe ninguna carga;
- mostrar el partido real + pendiente cuando ya existe una carga pendiente;
- conservar TU MOMENTO con promesa de valor;
- conservar Buscar jugadores.

Debe ocultar completamente:

- Actividad vacía;
- Efectividad vacía;
- Racha vacía;
- Partidos totales = 0 como estadística;
- Mejor compañero vacío;
- Rival vacío;
- Evolución vacía;
- Intelligence sin evidencia;
- tarjetas grises/locks/placeholders.

**Gap verificado en código actual:** Home todavía renderiza, entre otros, `Sin partidos considerados`, `Sin racha en curso`, `Sin datos suficientes` y widgets vacíos.

### Mi Perfil con 0 partidos oficiales

Debe mostrar identidad, `@usuario`, Nivel inicial y estado de calibración, pero ocultar módulos estadísticos sin evidencia.

**Gap verificado:** el render vigente todavía pinta métricas/valores `0` / `—` en varias superficies.

### Perfil público con 0 partidos oficiales

Debe mostrar identidad + Nivel/calibración y ocultar rendimiento inexistente.

**Gap verificado:** el camino vigente puede revelar tarjetas de efectividad/rendimiento y valores `0` / `—` aunque no existan partidos oficiales.

### Alcance

Esto es **AGREGAR/FUSIONAR visibilidad y progresión**, no rediseñar Home ni Perfil.

No crear una Home nueva.

---


## P0.1B — Ranking con participación automática

**Estado P0.1B al 24/09/2026:** IMPLEMENTADO Y VALIDADO EN STAGING. Falta solo comprobar visualmente en la QA integrada que la pregunta de opt-in no reaparezca.

**Fuentes maestras:** `Ranking_BRAMU.md` + `Experiencia_Inicial.md`.

Decisión cerrada el 24/09/2026:

- todo jugador activo participa automáticamente del Ranking cuando cumple elegibilidad;
- no existe opt-in / opt-out ordinario;
- al entrar a Ranking, si faltan localidad deportiva o rama competitiva, se solicitan esos datos;
- un jugador `CALIBRANDO` puede explorar Ranking pero todavía no ocupa posición;
- al volverse elegible, entra automáticamente en la edición semanal que corresponda;
- `ranking_opt_in` se conserva solo como compatibilidad histórica y deja de decidir elegibilidad.

### Implementación esperada

**FUSIONAR / REEMPLAZAR lógica, sin migración destructiva innecesaria:**

- retirar la pregunta de participación de la UI;
- retirar `ranking_opt_in` del gate de acceso;
- retirar `ranking_opt_in` de la elegibilidad/cálculo server-side;
- preservar snapshots semanales ya publicados;
- mantener la columna/campo legacy si eliminarla agrega riesgo sin valor;
- adaptar RPCs/contratos para que cuentas existentes con `ranking_opt_in=false` no queden excluidas por ese motivo;
- cubrir con tests focalizados perfiles incompletos, calibrando, elegible y cuenta legacy con opt-in false.

No reabrir fórmula de Ranking, densidad, publicación semanal, territorios ni Nivel.

---


## P0.1C — Perfil editable server-backed

**Estado P0.1C al 24/09/2026:** **CERRADO EN STAGING.** Migración `preprod_p01c_profile_editable` registrada como `20260925003222`; runner SQL PASS/rollback limpio; `officialize-onboarding` ACTIVE v3; QA real en `04.10-h31` PASS para edición persistente, avatar propio/cruzado, WhatsApp/consentimiento y privacidad pública. El deep link de WhatsApp queda solo para comprobación rápida en teléfono físico porque Work no puede verificar el handoff a una app nativa. Ver `Implementacion/Pre_Production/10_Resultado_Perfil_Editable_ServerBacked_Claude.md` §§17–20.

**Fuentes maestras:** `Backend_Infraestructura.md`, `Experiencia_Inicial.md`, definición de contacto de V03.6 y contratos actuales de Auth/Perfil.

**Motivo:** la pantalla `Editar datos` existe, pero para cuentas reales/server-backed el guardado está deliberadamente bloqueado y varios datos opcionales todavía no tienen persistencia de backend. Esto impide probar correctamente Mi Perfil, Perfil público, foto y contacto por WhatsApp.

### Decisión de producto vigente

Un usuario real debe poder completar y editar desde Perfil / Mis datos, sin bloquear Home:

- nombre y apellido;
- nombre visible/apodo cuando corresponda;
- fecha de nacimiento;
- género personal opcional;
- mano dominante;
- lado habitual;
- localidad;
- rama competitiva;
- teléfono/WhatsApp;
- consentimiento explícito para contacto por WhatsApp;
- foto/avatar.

Reglas:

- `@usuario` permanece fijo para V1 salvo corrección administrativa; no convertir esta ronda en un cambio de identidad;
- teléfono es dato privado;
- cargar teléfono **no** activa consentimiento;
- `allow_whatsapp_contact=false` por defecto;
- Perfil público muestra `CONTACTAR POR WHATSAPP` solo si hay teléfono válido + consentimiento;
- el número no se muestra visualmente;
- quitar consentimiento oculta inmediatamente el contacto público;
- foto/avatar es opcional y debe persistir entre sesiones/dispositivos;
- no guardar una imagen base64 en la tabla; usar Storage y persistir una referencia segura;
- cambios de Perfil no recalculan libremente Nivel BRAMU ni reescriben snapshots de Ranking.

### Categoría declarada

La UI histórica permite editar categoría, pero el backend actual la toma de `level_states` y forma parte del contexto/auditoría del Nivel inicial.

En esta ronda:

- trazar primero el contrato vigente;
- **NO** recalcular `mu`, confidence, evidence ni reescribir eventos históricos por una edición de Perfil;
- si no existe una vía semánticamente segura y ya definida para editar categoría, mantenerla temporalmente solo lectura en cuentas server-backed y marcarla como `DECISIÓN ABIERTA` no bloqueante;
- no impedir por ese punto que todo el resto del Perfil quede editable.

### Criterio de cierre

La ronda no se cierra solo porque el formulario permita tocar campos. Debe verificarse que:

- guardar persiste realmente en Supabase;
- recargar / cerrar sesión / volver a entrar conserva los cambios;
- Mi Perfil refleja los cambios;
- Perfil público refleja únicamente los campos públicos;
- WhatsApp respeta consentimiento;
- avatar real funciona;
- no se filtran email, fecha de nacimiento, teléfono sin consentimiento ni otros datos privados.

---


## P0.2 — Reemplazar el placeholder legal por documentos reales

**Estado P0.2 al 28/09/2026:** **decisiones humanas de producto CERRADAS; sin revisión jurídica externa obligatoria.** P0.2 permanece abierto únicamente por redacción final, verificación interna contra fuentes oficiales/datos reales e implementación/QA.

Fuente maestra vigente:

- `Privacidad_Legal.md`

La consolidación final de producto confirmó, entre otras cosas:

- lanzamiento/comunicación inicial centrados en Argentina;
- acceso abierto sin geobloqueo a usuarios de otros países;
- sin promoción deliberada dirigida a mercados extranjeros durante V1;
- no quedan decisiones humanas relevantes abiertas del taller de producto;
- menores, identificación pública del responsable, AAIP, retención, transferencias internacionales y redacción final deben verificarse internamente contra fuentes oficiales vigentes y los datos reales de infraestructura antes de cerrar P0.2.

### Corrección de estado anterior

Queda **superada** la mención previa de una edad mínima 13+ como decisión cerrada.

La decisión de producto vigente es **no imponer por anticipado una edad mínima ni flujo parental especial**. Esto no equivale a una certificación jurídica: Central debe contrastarlo contra fuentes oficiales vigentes antes de Production y, solo si aparece una obligación concreta incompatible, implementar el ajuste mínimo necesario. **No hay revisión externa obligatoria como gate.**

### Datos identificatorios del responsable

Los datos privados necesarios para revisión/trámites ya fueron definidos en la fuente privada del taller. **No copiarlos a este repositorio público.** Antes de publicar, Central debe determinar con fuentes oficiales qué corresponde exponer en Términos/Privacidad y qué debe quedar únicamente en registros o trámites.

### Implementación pendiente

El frontend vigente todavía conserva el placeholder legal / versionado piloto. Antes del primer usuario real deben quedar implementados y verificados, según `Privacidad_Legal.md`:

- Términos y Política definitivos y versionados;
- aceptación + timestamp + versión;
- reaceptación ante cambios materiales;
- acceso público a documentos y enlaces desde alta/Configuración;
- canal de soporte/privacidad;
- flujos de eliminación, email, contraseña y sesiones alineados;
- altas abandonadas a 24 h;
- informe estandarizado de acceso/copia;
- inventario real de proveedores/regiones/backups/logs/retención/transferencias;
- requisitos públicos de eliminación/privacidad para futura publicación móvil.

No presentar los textos como una certificación jurídica externa. Deben reflejar las decisiones cerradas, los datos reales y las fuentes oficiales vigentes.


---

**Estado L1 (30/09/2026, V04.19 / 04.19-h1):** IMPLEMENTADO en repo (aceptación legal previa a Auth signup, `legal_acceptances` append-only, versión vigente server-side, base de reaceptación, contraseña fuera de localStorage, fail-closed, cleanup >24 h). Pendiente de Central: aplicar migración `20260930280000` + verify + desplegar Edge Function y cron en Staging. Detalle en `Privacidad_Legal.md` §16. L2/L3 (WhatsApp on-demand, caches owner-scoped, páginas legales finales, delete-my-account) siguen pendientes.

**Estado V04.20 (01/10/2026):** **PASS técnico en Staging.** L1 operativo (cron seguro), L2 (owner-scoped + WhatsApp on-demand) y L3 técnico (páginas legales, reaceptación, Acceso y seguridad, acceso/copia, eliminación autoservicio sobre P0.3) fueron aplicados y verificados por Central. Edge Functions activas; cron real verificado; advisors sin hallazgo nuevo bloqueante. **Pre-Bloque 9 / Issue #17 también PASS**: permisos/RPC, rate limits, SW/entornos, métricas mínimas y runbook de salida endurecidos y verificados en Staging. Pendientes externos: sistema de emails/Auth con Comunicaciones, QA browser corto y E2E destructivo con OTP humano. Detalle en `Privacidad_Legal.md` §17 y `Implementacion/Pre_Production/82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md`.

## P0.3 — Consolidar eliminación de cuenta / anonimización

**Estado P0.3 al 27/09/2026:** implementación técnica + hardening **APLICADOS en Supabase Staging**. Migraciones remotas registradas: `preprod_p03_fase_a_account_deletion` y `preprod_p03_ranking_anonymous_presentation`. `admin_delete_player_account` y `admin_finalize_player_account_deletion` existen con EXECUTE exclusivo de `service_role`; la eliminación corta inmediatamente el vínculo BRAMU `players.auth_user_id`, anonimiza PII/nombres, limpia datos privados y relaciones personales, preserva estructura deportiva/histórica compartida y mantiene `ranking_rows` inmutable. Las lecturas vigentes de Ranking presentan una identidad eliminada como `Jugador eliminado` sin username/avatar. El procedimiento completo ya tiene orquestador server-side/repo-local para Storage + Auth Admin API + verificación + purga final del identificador operativo, con dependencia fijada y lockfile. Tests Node: **289/289 PASS**. Central confirmó en Staging real existencia/permisos de las RPCs y definiciones anónimas de Ranking; los advisors no agregaron hallazgos nuevos por P0.3. El verify SQL transaccional completo no pudo ejecutarse desde la conexión de Central porque los controles de seguridad bloquearon el script destructivo aunque terminara en ROLLBACK. **P0.3 NO está cerrado todavía:** falta un ensayo end-to-end destructivo sobre una cuenta descartable real de Staging para confirmar Storage/Auth Admin API y postcondiciones de punta a punta. Ver `Implementacion/Pre_Production/31_Resultado_Hardening_Final_P0_3_27SEP.md` y `Implementacion/Pre_Production/32_Resultado_Aplicacion_Staging_P0_3_27SEP.md`.

### Decisiones de producto ya tomadas y todavía no fusionadas completamente a la fuente maestra

Al eliminar una cuenta:

- la inactividad por sí sola **nunca** borra cuenta, Nivel ni historial;
- eliminar la cuenta no borra partidos compartidos ni resetea la historia competitiva;
- el usuario eliminado sale de grupos/listas personales donde corresponda;
- en historial compartido pasa a mostrarse como **`Jugador eliminado`**;
- no se conserva el nombre visible de la persona eliminada;
- se eliminan/anónimizan identificadores personales, preservando únicamente lo mínimo necesario para que el partido compartido y sus efectos históricos sigan siendo coherentes.

Esto amplía la regla vigente de `Backend_Infraestructura.md`, que hoy define eliminación **asistida por administración** y preservación de mínimos deportivos.

### Para lanzamiento inicial

No hace falta una automatización autoservicio compleja.

Sí hace falta:

- procedimiento administrativo escrito;
- qué se desactiva;
- qué se anonimiza;
- qué permanece en partidos/historial;
- cómo queda representado en UI;
- quién puede ejecutar la operación;
- cómo se audita.

### Reingreso después de eliminación — DECISIÓN CERRADA V1

Para la primera salida:

- eliminar la cuenta elimina/desactiva acceso, perfil e identificadores personales;
- los partidos compartidos permanecen para no destruir la historia de terceros;
- la participación histórica pasa a mostrarse como **`Jugador eliminado`**;
- no se conserva el nombre visible de la persona eliminada en esas superficies;
- la identidad deportiva eliminada **no se recupera ni se revincula**;
- si la persona vuelve, incluso al día siguiente, crea una **identidad nueva desde cero**;
- no se implementa cooldown de 30 días, hash/HMAC de email ni huella antifraude en V1.

Riesgo aceptado V1:

- una persona podría intentar resetear su carrera creando una cuenta nueva después de eliminar la anterior.

Decisión de producto:

- aceptar ese riesgo en la etapa inicial es preferible a introducir retención extra de identificadores o un sistema antiabuso no validado;
- si aparece abuso real, se diseña después una política específica y se revisa su impacto legal/privacidad.

Idea futura no bloqueante:

- evaluar un período de espera (por ejemplo 30 días) u otra política anti-reset, solo si existe evidencia real de abuso y con criterio de privacidad explícito.

---

## P0.4 — Acceso V1 — DECISIÓN CERRADA

Para la primera salida productiva:

- login: **email + contraseña**;
- recuperación: email + flujo OTP vigente;
- `@usuario`: identidad pública/buscable dentro de BRAMU, **no credencial de acceso V1**;
- el email continúa siendo privado frente a otros jugadores.

No reabrir Auth antes de Production para agregar login por `@usuario`.

Permitir acceso por `@usuario` puede evaluarse después de validar el lanzamiento inicial, como mejora independiente y sin cambiar la identidad pública existente.

---

## P0.4B — Grupos BRAMU productivo — EN CURSO

Desde 28/09/2026 Grupos BRAMU pasa a ser parte del producto requerido antes de abrir Production.

**Estado al 28/09/2026:** **Fase A backend compartido CERRADA EN STAGING.** Migración `preprod_grupos_fase_a_backend_compartido` aplicada; verify transaccional integral **`GRUPOS_FASE_A_VERIFY_PASS`**. Existen tablas server-only `groups`, `group_memberships`, `group_events`; RPCs de lectura/mutación con autorización; guardrail server-side de último admin; períodos históricos; y `get_group_competition_data` como fuente deportiva compartida basada en partidos validados y Nivel histórico oficial. Sin cambios de frontend ni de la experiencia de grupo armado. Ver `Implementacion/Pre_Production/66_Resultado_Grupos_Fase_A_Backend_Compartido_28SEP.md`.

**Estado actualizado 28/09/2026:** **B1 server-backed CERRADO EN STAGING.** La UI existente quedó conectada a contratos reales y validada con QA multiusuario: creación/membresías/admin/rename compartidos, regla 2/4 vs 3/4, tabla/Race/Intelligence consistentes entre cuentas, alta/reingreso semanal, baja visible y actividad real separada del top 3 de puntos. Cierre: `Implementacion/Pre_Production/74_Cierre_Grupos_B1_28SEP.md`.

**Estado actualizado 28/09/2026:** **B2a backend del lobby CERRADO EN STAGING.** Nueva lectura resumida `get_groups_lobby`, orden por actividad significativa autoritativa y frontera semanal canónica `America/Argentina/Buenos_Aires`; migraciones aplicadas y verifies B2a/B1/Fase A en PASS. El commit frontend h32 quedó pendiente de deploy por rate limit de Vercel y entrará en el próximo deploy disponible.

**Siguiente:** B2b — lobby/estado cero/pulido UX + desglose de puntos; después B2c — foto de grupo. No volver a usar localStorage como autoridad productiva.

Fuente maestra:
- `Grupos_BRAMU.md`

Handoff paraguas:
- `Implementacion/Pre_Production/62_Handoff_Grupos_BRAMU_28SEP.md`

Alcance:
- conservar la experiencia actual de grupo armado;
- elevar estado cero + explicación;
- productivizar grupos/membresías/admins sobre backend real;
- usar partidos e identidades oficiales;
- mantener Nivel, Ranking y puntos de grupo separados;
- cerrar todo primero en Staging.

No pasar a Bloque 9/Production hasta cerrar Fase B y QA multiusuario de Grupos.

---

## P0.4C — Invitados, vinculación y recuperación de identidad — V04.29 CERRADO EN STAGING · ronda de correcciones V04.30 EN VERIFICACIÓN

**Decisión de producto cerrada el 02–03/10/2026.** Fuente maestra técnica: `Backend_Infraestructura.md` §9. Fuentes derivadas: `Nivel_BRAMU.md`, `Ranking_BRAMU.md`, `Grupos_BRAMU.md` y `BRAMU_Intelligence.md`.

**Ronda posterior V04.30 (04/10/2026):** el QA humano exploratorio encontró B1/B2/B3 y fricciones de UX; se corrigieron en `b2df2b3` (V04.30 / `04.30-h1`). **Estado real:** código y tests locales OK; migración `20261004100000_v0430_create_or_attach_idempotent_replay.sql` (forward-only) **sin aplicar en Staging**; falta gate Central, verificación en Staging real y QA humano corto (claim + pantalla de recuperados, `No lo jugué` propio, límite de 5, B1, link consumido). Detalle y DECISIONES ABIERTAS: `Implementacion/Pre_Production/125_Resultado_Correcciones_QA_Invitados_04OCT.md`.

**Estado al 03/10/2026:** **IMPLEMENTACIÓN + GATE TÉCNICO + QA VISUAL CERRADOS EN STAGING** sobre BRAMUlab V04.29 / `04.29-h2`. Central acepta como no bloqueantes los límites del QA 121 (sin inspección de consola/red y sin iPhone físico específico), porque el lifecycle real quedó verificado técnicamente en Staging y el flujo visual completo cerró con un único partido efectivo, `Pendientes 0` y sin corrección fantasma. No repetir el recorrido por esos límites. Evidencia: `Implementacion/Pre_Production/119_Resultado_Correccion_Gate_Invitados_V0429_h2_03OCT.md`, `120_Gate_Central_Tecnico_Invitados_V0429_h2_03OCT.md`, `121_QA_Visual_Invitados_V0429_h2_03OCT.md` y `122_Cierre_Central_Invitados_V0429_h2_03OCT.md`.

Esta ronda reemplaza el claim básico limitado de Bloque 4 sin reabrir identidad por nombre ni construir fusiones genéricas de cuentas registradas.

Alcance requerido antes de considerar cerrada la experiencia de invitados:

- CTA `INVITAR` sobre provisionales relacionadas;
- links paralelos por distintos jugadores relacionados, uno pendiente por invitador;
- primer vínculo exitoso atómico + revocación de los demás links;
- confirmación explícita `¿Sos {nombre}?` / `SOY YO` / `NO SOY YO`;
- alta nueva conservando el `player_id` provisional cuando corresponda;
- cuenta existente recuperando una o varias provisionales, una por una, sin matching por nombre;
- recuperación de historial/estadísticas;
- replay idempotente de evidencia elegible para Nivel solo sobre el jugador recuperado;
- Ranking publicado inmutable; cambios solo hacia la siguiente edición;
- Grupos derivados de identidad/membresía real;
- Intelligence regenerable por fingerprint;
- detección y resolución autoservicio de duplicados revelados por la vinculación;
- reversión del doble efecto deportivo si dos registros confirmados eran el mismo encuentro;
- conflicto de una misma persona en dos slots: fail-closed, sin mutación parcial;
- RLS deny-by-default, rate limits, idempotencia, locks/atomicidad y auditoría.

**Fronteras técnicas de ejecución:** backend de identidad/links → frontend/UX → duplicados + derivados. Se puede resolver en una sola ronda coordinada de Claude con checkpoints internos, pero todo queda primero en Staging y requiere gate Central antes de cualquier promoción.

No incluye:

- fusión genérica entre dos cuentas registradas;
- matching por nombre/apodo;
- soporte manual como flujo normal;
- reescritura de rankings publicados;
- cascada de recálculo histórico de terceros.

---

## P0.5 — Bloque 9: endurecimiento y salida

**Estado 01/10/2026:** Pre-Bloque 9 / Issue #17, **Bloque 9A / Issue #19** y **Bloque 9B / Issue #20 están CERRADOS con PASS Central en Staging**. 9A cerró replay/ACL/PG17 `MAINTAIN`; 9B cerró rehearsal operativo, exportación segura y backup lógico. El gate real de 9B detectó dos vías de fuga de ids de terceros (notificaciones y `Intelligence.semanticKey`) y ambas quedaron corregidas/retesteadas en Staging. Quedan únicamente los gates externos G1–G4 antes de abrir Production.

Después de cerrar P0.1, P0.1B, P0.1C y los P0.2–P0.4C vigentes, ejecutar/promover únicamente los gates que sigan pendientes según `Backend_Infraestructura.md`.

No repetir QA exhaustiva de Bloques 1–8. Probar únicamente riesgos de salida.

**Bloque 9B (01/10/2026): CERRADO / PASS Central.** Procedimientos de exportación/operación/recuperación y backup lógico ensayados; migraciones `20261001080000` + forward-fix `20261001090000` aplicadas y retesteadas en Staging; preflight reproducible con G1–G4. Ver `87_Resultado_Bloque_9B_Rehearsal_Operativo_01OCT.md` + `88_Gate_Central_Bloque_9B_01OCT.md`. El backup gestionado de Supabase NO está probado y depende del plan real.

**G1 Emails/Auth V1 (01/10/2026, Issue #21): CERRADO / PASS Central en Staging.** Backend, migración, Edge Functions, secrets, SMTP, templates hosted y los 8 emails V1 quedaron operativos. Work recibió realmente #1–#8 y validó por API las secuencias críticas: signup, recovery + #6, cambio de email con exactamente 2 verificaciones y #5 al email anterior sin tercer mail, y eliminación con challenge específico + #8 solo tras postcondiciones. Vercel Staging permanece protegido; logo Auth sincronizado en repo mediante asset público fijado a commit. Residuales de navegación/UI, Site URL/redirects y cobertura visual/browser se trasladan a **G2 Acceso/Legal**, donde además se incorporarán los ajustes UX de Sebastián antes de una nueva QA. Ver `90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md`, `93_Resultado_G1_Work_QA_01OCT.md` y `94_Gate_Central_G1_Final_01OCT.md`.

**G2 Configuración + Acceso/Legal + browser (01/10/2026, Issue #22): GATE TÉCNICO FINAL PASS / visto bueno visual pendiente.** Work confirmó Privacidad sin overflow (445/445), Términos, backs, Site URL/redirects y fronteras primer tap→CTA. Ajuste visual final en bundle `04.20-h6`: dos bloques (`Cuenta y seguridad` + `Privacidad y cuenta`), Eliminar como última fila danger sin zona propia y `Cerrar sesión` como botón grande separado con el mismo modal sesión actual/todas/cancelar. Vercel SUCCESS; tests G2 13/13. Pendiente únicamente revisión visual de Sebastián sobre h6 y residual manual del icono iOS. Ver `101_Retest_G2_Work_01OCT.md` y `102_Ajuste_Final_UX_Configuracion_G2_01OCT.md`.

### Gate mínimo de Bloque 9

- prueba integral de recorridos críticos entre al menos dos cuentas/dispositivos;
- revisión final de RLS y permisos;
- rate limits;
- signup/verificación/reenvío/recuperación reales;
- SMTP y callbacks de Production;
- caché/service worker y separación de entornos;
- métricas mínimas;
- backups/exportación;
- procedimiento administrativo;
- secretos y custodia;
- Production limpia, sin seeds/mocks/laboratorio común;
- proyecto Supabase Production realmente separado;
- variables Vercel Production correctas;
- migraciones aplicadas primero en Staging y luego Production con verificación;
- smoke real de Production antes de invitar a terceros.

### No son requisitos

- dominio propio;
- IA generativa;
- push notifications;
- social login;
- app nativa;
- autoservicio avanzado de fusiones;
- infraestructura comercial/escalable innecesaria.

---

# 3. CONVENIENTE antes de invitar amigos, pero no bloquea crear Production para Sebastián

Estos puntos pueden resolverse después de que Sebastián use Production solo unos días, siempre mediante cambios primero en Staging y promoción posterior.

## P1.1 — Pulido de primera impresión

- copy definitivo de Estado Cero;
- copy definitivo de TU MOMENTO;
- revisar si la Home ya se siente “formándose” en vez de vacía;
- motion/intensidad exacta del destacado accionable.

No cambiar estructura ni reglas ya cerradas.

## P1.2 — Edge cases visuales del ciclo de partido

Validar visualmente, sin rediseñar backend:

- copy final de `PARTICIPACIÓN CUESTIONADA`;
- representación de `Jugador no identificado`;
- nivel exacto de detalle before/after en `Modificaciones`;
- si mostrar autor en cada fila compacta de Historial o solo en detalle;
- **consistencia visual del estado pendiente:** en Home, `Último partido` usa el borde ámbar pleno (`var(--gold)`), mientras que el `Resumen del partido` pendiente usa `rgba(255,201,61,0.45)`. En la próxima ronda visual, **REEMPLAZAR** únicamente el `border-color` de `.result-card.result-card--pending` para equipararlo al borde ámbar pleno de Último partido. Mantener el glow/sombra sutil actual salvo revisión visual posterior; no tocar lógica ni otros estados.
- **identidad corregida pre-validación — bloque partido fragmentado:** cuando un participante es corregido antes de validar, el Resumen vuelve a separar la tarjeta de resultado y el bloque contextual/acciones. Esto contradice el cierre h24 de “una sola tarjeta”. **FUSIONAR** también el estado `identity_replacement` dentro de la misma `.result-card.result-card--pending`: para quien debe actuar, contexto + acciones `Reportar un error` / `Validar partido` dentro de la tarjeta; para quien espera, contexto de espera dentro de la misma tarjeta. No crear una segunda card/banda separada.
- **Home accionable tras corrección de participante — actor/evento incorrecto:** hoy el carousel de Home usa `createdByPlayerId` para el copy de cualquier pendiente accionable y puede mostrar al propio creador “Esteban cargó un partido con vos” aunque la acción actual exista porque otro jugador corrigió un participante. **REEMPLAZAR** ese fallback para estados `identity_replacement` por copy contextual basado en el evento/actor real de la corrección cuando esté disponible; ejemplo aprobado de intención: `Seba corrigió un participante. Revisá el partido.` Nunca atribuir la carga como evento actual si lo accionable es una corrección posterior.

Son mejoras de claridad; el dato y la lógica ya existen.

## P1.3 — Revisión visual corta de Mi Perfil / Perfil público

Una vez corregido Estado Cero:

- comprobar progresión con 0 / 1 / varios partidos;
- comprobar nombres largos;
- comprobar que no reaparezcan módulos vacíos;
- comprobar que Ranking/Nivel no ocupen espacio con estados falsos.

---

# 4. FUTURO / NO bloquear salida

Mantener fuera del tramo pre-Production salvo nueva decisión explícita:

- `Recordar por WhatsApp` con deep link;
- recordatorios de datos incompletos;
- apodo/nombre visible personalizado;
- interfaz genérica de fusión entre **dos cuentas registradas** no relacionada con una provisional confirmada;
- matching automático/social de identidades sin link válido;
- notificaciones push;
- amigos/seguidores;
- social login/passkeys;
- políticas avanzadas de moderación/antitrampa;
- analítica externa;
- privacidad campo por campo;
- IA generativa de Intelligence;
- fotos/recuerdos/recaps;
- wearables;
- torneos/clubes;
- monetización;
- expansión territorial fuera del alcance inicial.

---

# 5. Cosas que NO deben volver a presentarse como pendientes

No reabrir sin regresión concreta:

- Nivel BRAMU;
- Ranking V1;
- BRAMU Intelligence V1 A–E;
- base técnica de provisionales/claim del Bloque 4;
- búsqueda real;
- create-or-attach;
- historial compartido;
- validación por parejas;
- correcciones 3 días;
- identidad 10 + 7;
- pendiente 30 días;
- carga retroactiva 14 días;
- límite de 5 pendientes accionables;
- separación BRAMUlab / BRAMUlive;
- Ranking semanal;
- ocultamiento personal de partidos;
- recuperación de contraseña de Staging;
- SMTP de Staging;
- QA ya cerradas de Bloques 1–8.

---

# 6. Orden recomendado desde hoy

## Etapa 1 — antes de Bloque 9

1. cerrar las dos decisiones humanas:
   - acceso email vs. `@usuario`;
   - regla de reingreso después de eliminación;
2. implementar Estado Cero + Perfil progresivo;
3. preparar/fusionar política de eliminación;
4. preparar Términos + Privacidad reales y reemplazar el placeholder `piloto_v1`.

## Etapa 2 — Bloque 9

Ejecutar hardening/release sobre Staging y preparar Production limpia.

## Etapa 3 — Production solo Sebastián

Abrir Production con datos permanentes y usarla unos días solo con Sebastián.

Objetivo:

- detectar fricciones reales;
- revisar primera impresión;
- NO volver a tratar Production como base descartable.

## Etapa 4 — última ronda pequeña

Corregir en Staging únicamente problemas reales encontrados por Sebastián, promoverlos y recién entonces invitar amigos.


## Etapa 5 — cierre documental y orden antes de abrir Production

**Decisión registrada 02/10/2026.** Esta etapa ocurre **después de terminar la implementación/QA pre-Production y antes de que entre el primer usuario real**. No bloquea el trabajo UX actual ni obliga a refactorizar código mientras el producto todavía está cerrando detalles.

Objetivo: que BRAMU llegue a Production con una estructura fácil de entender, mantener y retomar meses o años después, sin perder trazabilidad histórica.

### GitHub — fuente de verdad activa

Antes de abrir Production:

- dejar `README.md` como mapa corto y vigente de autoridades;
- asegurar que cada sistema estructural tenga una **fuente maestra autocontenida** que explique su lógica, estado y criterios actuales;
- como mínimo, preservar fuentes maestras claras para **Nivel BRAMU, Ranking BRAMU, Grupos BRAMU, BRAMU Intelligence, Cargar partido, Backend/Infraestructura y Privacidad/Legal**;
- podar del árbol activo handoffs, planes, revisiones y resultados intermedios ya consumidos;
- no crear un gran `Backup/` dentro del repo duplicando historia: **Git conserva commits, diffs y archivos anteriores**;
- usar `Archivo/` únicamente para antecedentes que todavía tengan valor documental concreto;
- crear un **tag/referencia de release** para la primera versión que se abre a usuarios reales;
- no hacer una reorganización masiva de código solo por estética si agrega riesgo inmediatamente antes de Production.

La meta es que, por ejemplo, si dentro de un año hay que revisar Nivel BRAMU, alcance con entrar a su fuente maestra vigente para reconstruir qué significa, cómo funciona y qué versión está operando, sin leer chats ni handoffs históricos.

### Dropbox — copia externa de resguardo

Dropbox se usará como **backup externo y ordenado del estado de lanzamiento**, no como segunda fuente de verdad concurrente.

Al cerrar la primera release productiva:

- guardar una copia/snapshot del repositorio o release;
- mantener una estructura espejo simple de la documentación maestra importante;
- identificar claramente fecha, versión/tag y rama de origen;
- no copiar secretos, credenciales, OTP, service-role keys ni datos sensibles;
- si GitHub y Dropbox difieren, **GitHub + las fuentes maestras vigentes del repo prevalecen**.

### Evolución posterior a Production

Abrir Production **no congela** Nivel, Ranking, Grupos, Intelligence ni otros sistemas.

Después del lanzamiento se podrán introducir nuevas versiones o ajustes, incluso mucho tiempo después, siempre que:

- los datos reales históricos se conserven;
- los cambios de algoritmo o reglas queden versionados y documentados;
- cualquier migración/reinterpretación de datos sea explícita y auditable;
- no se reescriba el pasado silenciosamente;
- cada sistema pueda evolucionar sin obligar a rehacer los demás salvo dependencia real.

Ejemplo: Nivel BRAMU puede pasar de una versión V1 a una V2 después de observar comportamiento real. La decisión de transición se toma en ese momento (continuidad desde una fecha, recálculo controlado u otra estrategia), conservando trazabilidad y sin tratar Production como base descartable.

---

# 7. Criterio de salida

BRAMU está lista para los primeros usuarios reales cuando:

- P0.1, P0.1B, P0.1C y P0.2–P0.5 están cerrados;
- no existen placeholders legales;
- Production está limpia y separada;
- Sebastián puede completar el recorrido real desde cuenta nueva hasta partido/validación/Intelligence sin intervención técnica;
- existe un procedimiento operativo para una cuenta problemática o una eliminación;
- los puntos P1 que queden abiertos son únicamente pulido, no huecos de producto ni seguridad.

No hace falta “terminar BRAMU”. Hace falta que el núcleo que ya construimos sea coherente, seguro, entendible y permanente desde el primer usuario.

**G2 (01/10/2026):** Configuración/Acceso/Legal implementada y validada por Work; correcciones finales de QA de Sebastián en **V04.21** (versionado visible, engranaje, back de Cambiar contraseña, copy de Contacto). Ver `Implementacion/Pre_Production/103_Cierre_Correcciones_G2_V0421_01OCT.md`. Pendiente: visto bueno de Sebastián e icono iOS.
**G2 fix V04.22 (01/10/2026):** el éxito de Cambiar contraseña (camino server-backed) volvía a Perfil; ahora vuelve a Configuración. Ver `Implementacion/Pre_Production/104_Fix_Back_Contrasena_V0422_01OCT.md`. Pendiente: gate Central → QA de Sebastián en iPhone → cierre #22.
