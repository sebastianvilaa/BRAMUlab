# BRAMUlab — Consolidado pre-Production

**Fecha:** 23 de septiembre de 2026  
**Estado:** fuente activa para el tramo entre el cierre del Bloque 8 y el inicio/cierre del Bloque 9.  
**Objetivo:** reunir únicamente los pendientes reales antes de abrir BRAMU a usuarios reales, sin reabrir Bloques 1–8 ni convertir ideas futuras en requisitos de salida.

> Regla de lanzamiento vigente: cuando entra el primer usuario real en Production, BRAMU ya empezó. Production no es un piloto descartable.

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

## P0.5 — Bloque 9: endurecimiento y salida

**Estado 01/10/2026:** Pre-Bloque 9 / Issue #17, **Bloque 9A / Issue #19** y **Bloque 9B / Issue #20 están CERRADOS con PASS Central en Staging**. 9A cerró replay/ACL/PG17 `MAINTAIN`; 9B cerró rehearsal operativo, exportación segura y backup lógico. El gate real de 9B detectó dos vías de fuga de ids de terceros (notificaciones y `Intelligence.semanticKey`) y ambas quedaron corregidas/retesteadas en Staging. Quedan únicamente los gates externos G1–G4 antes de abrir Production.

Después de cerrar P0.1, P0.1B, P0.1C y P0.2–P0.4, ejecutar Bloque 9 según `Backend_Infraestructura.md`.

No repetir QA exhaustiva de Bloques 1–8. Probar únicamente riesgos de salida.

**Bloque 9B (01/10/2026): CERRADO / PASS Central.** Procedimientos de exportación/operación/recuperación y backup lógico ensayados; migraciones `20261001080000` + forward-fix `20261001090000` aplicadas y retesteadas en Staging; preflight reproducible con G1–G4. Ver `87_Resultado_Bloque_9B_Rehearsal_Operativo_01OCT.md` + `88_Gate_Central_Bloque_9B_01OCT.md`. El backup gestionado de Supabase NO está probado y depende del plan real.

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
- interfaz autoservicio de fusiones/duplicados;
- reclamo múltiple de identidades;
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
- claim básico de provisional;
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
