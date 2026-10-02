# BRAMUlab — Handoff: invitados, invitación y recuperación de identidad

**Fecha:** 02/10/2026  
**Estado de producto:** decisiones CERRADAS para implementación  
**Rama de trabajo:** `staging`  
**Alcance:** identidad provisional → invitación → alta o cuenta existente → recuperación de partidos/evidencia  
**NO es un rediseño general de identidad ni una interfaz universal de fusiones.**

> Este documento consolida la investigación de producto cerrada con Sebastián el 02/10/2026.  
> Si contradice el comportamiento/documentación anterior del claim básico, estas decisiones son las que deben incorporarse a las fuentes maestras al implementar.  
> No usar Archivo/Backup/handoffs históricos como autoridad.

---

## 1. Objetivo

Cerrar una experiencia realista para el caso normal de BRAMU:

1. un usuario carga un partido con una persona que todavía figura como invitado/provisional;
2. esa identidad provisional puede reutilizarse en otros partidos;
3. cualquier jugador registrado que haya compartido realmente un partido con ese provisional puede invitarlo a BRAMU;
4. el invitado abre un enlace personal;
5. si no tiene cuenta, crea una y recupera su identidad;
6. si ya tenía cuenta BRAMU, vincula explícitamente la identidad provisional a su cuenta existente;
7. recupera los partidos asociados, las estadísticas/Intelligence derivadas y, cuando corresponda, evidencia para su Nivel;
8. si la vinculación revela que dos registros eran en realidad el mismo encuentro, el propio jugador lo confirma y BRAMU los reconcilia sin soporte manual rutinario.

La experiencia debe ser simple para jugadores amateurs. No introducir verificación documental, teléfono, email del invitado, matching automático por nombre ni un sistema de fusiones genérico.

---

## 2. Lo que YA funciona y NO TOCAR

### Identidad provisional persistente

Un invitado ya es un `players.type='provisional'` con UUID propio.

Conservar:

- identidad por `player_id`, nunca por texto;
- reutilización explícita de la misma provisional en múltiples partidos;
- mismo nombre/apodo puede corresponder a personas distintas;
- nunca auto-fusionar por coincidencia de nombre;
- provisionales no buscables globalmente;
- relacionadas visibles para usuarios que ya compartieron partido con ellas.

### Selector de jugadores al cargar partido

La UI actual ya ayuda a reutilizar invitados existentes mostrando recientes/invitados relacionados.

**NO rediseñar este selector.**  
**NO agregar fuzzy matching/bloqueos de nombres en esta ronda.**

### Ciclo de partido

Conservar:

- pendiente: 30 días;
- vencido: sigue siendo historial y no se reactiva;
- validado: no se reabre solo por vincular identidad;
- correcciones/identidad siguen usando sus ventanas y mecanismos vigentes;
- Ranking publicado semanal permanece inmutable.

---

## 3. Superficie de producto para invitar

### Dónde

En el **Resumen de un partido server-backed**, si existen participantes que siguen siendo provisionales:

**Jugadores sin cuenta**

- Pedro — **INVITAR**
- Agustín — **INVITAR**

No mostrar esta acción sobre un borrador puramente local/sin sincronizar.

### Bottom sheet

Al tocar `INVITAR`:

**Invitá a Pedro a BRAMU**

Texto de intención:

> Compartile este enlace para que pueda sumarse a BRAMU y recuperar sus partidos. El enlace es personal: envíaselo solo a Pedro.

CTA principal:

**COPIAR ENLACE**

Feedback:

**Enlace copiado. Enviáselo a Pedro.**

No crear botón específico de WhatsApp. Copiar enlace sirve para WhatsApp, Telegram, WeChat, etc.

### Lenguaje

En UI de producto evitar **“reclamar”**.

Preferir:

- invitar;
- vincular;
- recuperar partidos;
- invitación.

El término técnico `claim` puede permanecer internamente en código/DB si conviene.

---

## 4. Quién puede generar una invitación

### Decisión cerrada

Puede generar el enlace **cualquier jugador registrado que tenga una relación real mediante partido compartido con esa identidad provisional**.

No limitarlo al creador original de la provisional.

Reutilizar exactamente el criterio de relación ya existente para provisionales relacionadas:

- creador, o
- jugador que comparte al menos un `match_participants.match_id` con esa provisional.

Nunca permitir que un usuario sin relación real genere enlaces para una provisional arbitraria.

### Gap actual

`create_claim_link` hoy exige `created_by_player_id = caller`.

**REEMPLAZAR** ese permiso por el criterio de relación real anterior.

---

## 5. Links simultáneos

### Decisión cerrada

Puede haber más de un enlace vigente hacia la misma identidad provisional cuando fueron generados por jugadores relacionados distintos.

Ejemplo:

- Seba genera un enlace para Pedro;
- Matu genera otro enlace para el mismo Pedro;
- ambos son válidos;
- Pedro puede abrir cualquiera;
- el **primer claim/vínculo exitoso gana**;
- al completarse, todos los demás links pendientes de esa identidad quedan revocados/inutilizables.

### Recomendación de implementación

Mantener como máximo **un link pending por (provisional, invitador)**.

Si el mismo invitador genera uno nuevo, rota/revoca solo su propio link anterior.

No revocar links de otros invitadores hasta que la identidad sea vinculada exitosamente.

### Gap actual

Hoy existe un índice de **un único pending por provisional** y generar uno nuevo revoca cualquier pending anterior.

**REEMPLAZAR** esa restricción.

### Vigencia

Conservar **30 días** y token de alta entropía/hash server-side.

---

## 6. Seguridad V1 del enlace

No agregar verificación social/segundo jugador, DNI, teléfono, email del invitado ni prueba documental.

El enlace es bearer + confirmación explícita.

### Emisor

Mostrar la advertencia de que es personal y debe enviarse solo a Pedro.

### Receptor

Antes de consumir:

**¿Sos Pedro?**

> Hay partidos registrados con esta identidad. Si sos vos, podés vincularlos a tu cuenta.

CTAs:

**SOY YO**  
**NO SOY YO**

`NO SOY YO` descarta la intención en ese dispositivo/sesión. **No debe consumir ni invalidar el enlace global**, porque un receptor equivocado no debe poder sabotear la invitación.

La confirmación explícita reduce errores accidentales. V1 acepta que un bearer link reenviado a la persona equivocada no prueba criptográficamente identidad antes del primer uso.

---

## 7. Entrada desde el link

### Sin sesión

El link conserva la intención de invitación y lleva al flujo normal de acceso.

El usuario puede:

- crear cuenta;
- o elegir **Ya tengo cuenta** e iniciar sesión.

Después de autenticarse debe volver automáticamente a la invitación, sin perder el token.

### Ya logueado

Abrir directamente la confirmación **¿Sos Pedro?**.

No agregar por ahora `Mi perfil > Recuperar partidos`, ingreso manual de token ni una segunda puerta al mismo flujo.

---

## 8. Cuenta nueva

Conservar el mecanismo base vigente:

- la cuenta temporal recién creada todavía no tiene perfil/Nivel oficializado;
- el claim adopta la identidad provisional antes de `complete_profile`/Nivel;
- el `player_id` provisional puede seguir siendo la identidad registrada;
- luego continúa onboarding normal.

### Cambio nuevo

Una vez que el jugador confirma su Nivel inicial, procesar la **evidencia recuperada** elegible (ver §11) para que los partidos recuperados puedan contar en su calibración.

Ejemplo:

- crea cuenta: `CALIBRANDO 0/5`;
- recupera 2 partidos elegibles;
- queda `CALIBRANDO 2/5`;
- le faltan 3 partidos computables, sujeto también al mínimo de rivales distintos.

---

## 9. Cuenta BRAMU ya existente

### Decisión cerrada

Una cuenta registrada/completa **sí puede vincular una identidad provisional mediante una invitación válida**.

No enviar el caso normal a soporte/admin.

No construir una interfaz general de fusiones entre dos cuentas registradas.

### Modelo conceptual

Ejemplo:

- P1 = `Pedro` provisional;
- P2 = `@pedro` registrado.

Al confirmar **SOY YO**:

- P2 sigue siendo la cuenta registrada/canónica operativa;
- P1 deja de ser una identidad provisional activa independiente;
- los partidos asociados a P1 pasan a ser recuperados por P2;
- debe conservarse trazabilidad/auditoría de que P1 fue vinculada a P2;
- no borrar a ciegas P1 si existen referencias históricas/auditoría.

### Importante

El mecanismo técnico exacto (repoint controlado de FKs, alias/canonical o combinación) debe elegirse después de inspeccionar **todas** las referencias reales de `player_id`.

Preferencia de producto/arquitectura: solución mínima y acotada.  
**NO introducir un sistema general de canonicalización/fusiones si no es necesario.**

La columna `canonical_player_id` está contemplada conceptualmente en documentación histórica vigente, pero **no existe hoy en las migraciones activas**; no asumir que ya está disponible.

### Gap actual

`claim_provisional_player` devuelve `account_already_registered` para una cuenta completa y la UI limpia el token con mensaje de resolución manual.

**REEMPLAZAR** ese comportamiento por el flujo autoservicio anterior.

---

## 10. Más de una identidad provisional de la misma persona

No crear una pantalla general de “fusionar invitados”.

Una cuenta registrada puede recibir y confirmar, una por una, invitaciones válidas para identidades provisionales adicionales que realmente le pertenecen.

Ejemplo:

- `Pedro`;
- `Pedrito`;
- `Pedro Gómez`;

si eran la misma persona, `@pedro` puede vincular cada una mediante su respectivo enlace.

Siempre:

- explícito;
- nunca por similitud de nombre;
- cada provisional requiere una invitación válida + **SOY YO**.

Esto resuelve gradualmente duplicados reales sin construir un sistema universal de merge.

---

## 11. Nivel BRAMU y calibración — decisión nueva que reemplaza la regla anterior

### Principio

**Recuperar identidad sí puede incorporar evidencia deportiva al Nivel del jugador recuperado.**

No tratar al jugador como si BRAMU no supiera nada de partidos reales que ya estaban registrados.

### Partidos recuperados elegibles

Un partido recuperado cuenta para Nivel/calibración del jugador recuperado únicamente si:

- es un partido oficial/validado;
- satisface las reglas temporales y de elegibilidad vigentes de Nivel;
- no está vencido/no oficial/fuera de término;
- no es un duplicado que deba quedar eliminado;
- existe evidencia/snapshot suficiente para procesarlo sin inventar datos.

No convertir un partido que el sistema ya considera no elegible/oficial en evidencia solo por el claim.

### Cómo aplicar la evidencia

Los partidos recuperados elegibles se procesan **en orden cronológico de `played_at`** como evidencia recuperada para ese jugador, partiendo de su Nivel vigente/base al momento de la recuperación.

Usar los snapshots/evidencia histórica real disponible del encuentro para pareja/rivales.  
No reemplazarla por niveles actuales de terceros.

### Qué NO hacer

No recalcular en cascada todos los deltas históricos de terceros.

No modificar retrospectivamente el Nivel que Seba/Matu/etc. tenían en fechas pasadas solo porque Pedro dejó de ser provisional.

No reescribir ediciones de Ranking ya publicadas.

### Qué SÍ cambia

Para el jugador recuperado:

- Nivel actual;
- `rated_matches`;
- evidencia/confianza;
- `distinct_opponents`;
- progreso de calibración;
- estado `CALIBRANDO/CALIBRADO` cuando corresponda.

Regla vigente de calibración:

- 5 partidos computables;
- al menos 3 rivales diferentes.

Por lo tanto:

> si Pedro estaba `0/5` y recupera 2 partidos computables, pasa a `2/5`; no debe jugar cinco nuevos.

Si llega a cinco pero todavía no cumple los tres rivales distintos, sigue calibrando hasta cumplir ambas condiciones.

### Cuenta ya calibrada

Los partidos recuperados elegibles pueden aportar evidencia y mover su Nivel vigente bajo el mecanismo de recuperación, pero no “descalibran” el pasado ni reescriben deltas históricos de terceros.

### Ranking

Ranking no tiene puntos propios: consume Nivel consolidado.

Por lo tanto:

- si la recuperación cambia el Nivel vigente, la **próxima edición semanal** debe usar ese nuevo Nivel;
- una edición semanal ya publicada permanece inmutable.

---

## 12. Estadísticas e Historial

La recuperación **sí es retroactiva a nivel de identidad/historia**.

Después de vincular:

- los partidos recuperados aparecen en el Historial del jugador;
- victorias/derrotas derivadas;
- compañeros/rivales;
- actividad;
- rachas y demás estadísticas derivadas reales;

deben considerar esos partidos según las reglas normales de cada superficie.

No inventar estadísticas si la evidencia no existe.

---

## 13. BRAMU Intelligence

Intelligence debe reconocer la identidad correcta y poder regenerar derivados históricos cuando cambia la historia del jugador.

Conservar:

- snapshots históricos de Nivel del encuentro;
- expectativa previa histórica;
- reglas de evidencia;
- no recalcular pasado con niveles actuales.

La arquitectura actual de fingerprints/checkpoints ya contempla que un cambio real de participantes/historia invalide derivados y se regenere cuando corresponda.

---

## 14. Grupos BRAMU

### Decisión cerrada

Al recuperar la identidad correcta, Grupos vuelve a evaluar los partidos con esa identidad.

Ejemplo:

- Seba = miembro;
- Matu = miembro;
- Pedro provisional = en ese momento no reconocido como `@pedro`;
- Juan = no miembro.

Antes del vínculo: 2/4 miembros → no cuenta.

Si luego se confirma que Pedro provisional era `@pedro` y `@pedro` **ya pertenecía al grupo para esa semana según los períodos/reglas de membresía**, la verdad del partido pasa a ser 3/4 → **el partido cuenta**.

Esto no mete retroactivamente a Pedro en un grupo al que nunca perteneció. Solo corrige quién jugó realmente.

Grupos ya está definido para consumir la verdad oficial del partido y reaccionar a correcciones de identidad; no crear una segunda lógica paralela.

---

## 15. Posibles partidos duplicados revelados por la vinculación

### Problema

Puede ocurrir:

1. Seba carga un encuentro con `Pedro provisional`;
2. Pedro ya tenía cuenta y carga por su lado el mismo encuentro con `@pedro`;
3. como P1 y P2 eran distintos, BRAMU no pudo reconocerlos como el mismo partido;
4. al vincular P1 → P2 aparece una posible colisión.

### Regla cerrada

**NO mandar a soporte.**  
**NO fusionar a ciegas.**

Preguntar al propio jugador:

**Encontramos dos partidos que podrían ser el mismo**

Mostrar contexto real suficiente:

- jugadores;
- fecha/hora si se conoce;
- score;
- lugar si ayuda y existe.

CTAs:

**SÍ, ES EL MISMO**  
**NO, SON DOS PARTIDOS DISTINTOS**

### Si responde NO

Conservar ambos.

### Si responde SÍ

Reconciliar como **un único encuentro**.

- Si las declaraciones coinciden, conservar una sola identidad de partido.
- Si los scores/revisiones difieren, reutilizar la lógica vigente de revisión/corrección/validación; no inventar arbitraje nuevo.
- Preservar trazabilidad de ambos registros/submissions.

### Si ambos ya habían producido efecto deportivo

Eliminar la doble contabilización.

Esto es una **corrección de datos**, distinta del claim simple.

Puede requerir:

- revertir el efecto oficial duplicado sobre Nivel de los participantes;
- dejar una sola contribución a estadísticas;
- una sola contribución a Grupos;
- regenerar Intelligence;
- mantener idempotencia y auditoría.

No recalcular en cascada toda la historia posterior.  
No reescribir Rankings semanales ya publicados.  
La próxima edición usa los niveles vigentes corregidos.

### Regla de seguridad

La reconciliación debe ser atómica: si falla cualquier parte sensible, no dejar una identidad parcialmente movida/duplicado parcialmente anulado.

---

## 16. Colisión “misma cuenta ocupa dos slots”

Si al vincular P1 → P2 un partido quedaría con el mismo `player_id` en dos lugares:

- no completar silenciosamente la reasignación;
- tratarlo como conflicto de identidad/deduplicación dentro del flujo autoservicio;
- pedir resolución cuando sea posible;
- nunca dejar un partido con una persona ocupando dos slots.

No usar soporte humano como camino normal.

---

## 17. Cambios documentales que debe hacer Central al implementar

### Backend_Infraestructura.md

Actualizar especialmente §9:

**REEMPLAZAR**

- “un único link por identidad”;
- claim solo para alta nueva;
- segundo claim/cuenta existente → manual;
- “claim no recalcula Nivel” como regla absoluta.

**AGREGAR**

- varios links por invitadores relacionados;
- first successful claim revoca todos;
- cuenta existente puede vincular provisional explícitamente;
- evidencia recuperada para Nivel del jugador recuperado;
- no cascada histórica de terceros;
- Ranking futuro sí refleja Nivel vigente;
- reconciliación autoservicio de posibles duplicados.

### Pre_Production.md / Backlog

Hoy figuran como futuro:

- interfaz autoservicio de fusiones/duplicados;
- reclamo múltiple de identidades.

Mantener **fuera de V1** la interfaz general/universal de fusiones.

Pero retirar de “futuro” el caso acotado aprobado:

> provisional + invitación válida + confirmación explícita → cuenta registrada existente.

### Copy frontend

Eliminar en UI visible referencias a:

- “reclamar invitación”;
- “se resuelve manualmente durante el piloto”.

Internamente puede seguir llamándose claim.

---

## 18. Alcance técnico — AGREGAR / REEMPLAZAR / FUSIONAR / NO TOCAR

### AGREGAR

- CTA `INVITAR` en Resumen para provisionales;
- bottom sheet + copiar enlace;
- preview/confirmación de identidad del receptor;
- flujo para cuenta existente;
- soporte de múltiples links por invitadores;
- revocación global tras éxito;
- procesamiento de evidencia recuperada para Nivel;
- detección/resolución autoservicio de duplicados revelados;
- tests E2E de identidad + Nivel + derivados.

### REEMPLAZAR

- permiso de `create_claim_link` solo-creador → relación real;
- un único pending por provisional → uno por invitador/provisional;
- rechazo `account_already_registered` como final → vinculación explícita;
- mensaje manual/piloto → flujo autoservicio;
- regla absoluta “claim no toca Nivel” → recuperación de evidencia solo para el jugador recuperado.

### FUSIONAR

Con mecanismos existentes:

- relación de provisionales de Bloque 5;
- create-or-attach/desambiguación;
- correcciones/identity issues Bloque 6;
- reversión determinista de Nivel;
- Grupos consumiendo verdad oficial;
- Intelligence fingerprints/replay;
- Ranking semanal inmutable ya publicado.

No duplicar esas lógicas.

### NO TOCAR

- `main`;
- Production;
- BRAMUlive;
- fórmula base de Nivel;
- selector actual de invitados al cargar partido;
- matching por nombre;
- login social;
- teléfono/email obligatorio para invitado;
- interfaz universal de fusiones;
- Rankings publicados.

---

## 19. Riesgos y pruebas obligatorias

No repetir QA general. Probar el seam nuevo.

### E2E A — cuenta nueva

1. Seba crea Pedro provisional.
2. Pedro participa en varios partidos.
3. Matu reutiliza exactamente el mismo provisional.
4. Seba y Matu generan links distintos.
5. Pedro usa uno en sesión limpia y crea cuenta.
6. verificar:
   - identidad/historial recuperados;
   - otro link queda inválido;
   - pendientes vigentes le reconocen autoridad;
   - expirados no se reactivan;
   - evidencia Nivel elegible se aplica tras Nivel inicial;
   - progreso de calibración correcto.

### E2E B — cuenta existente

1. P1 provisional con varios partidos.
2. P2 cuenta real ya completa.
3. P2 abre link.
4. `SOY YO`.
5. verificar:
   - recuperación de historial;
   - stats;
   - Intelligence;
   - Nivel vigente/evidencia;
   - próxima elegibilidad de Ranking;
   - links restantes revocados;
   - sin pérdida de perfil/Nivel/grupos propios de P2.

### E2E C — varios claims provisionales

P2 vincula P1 y luego otra provisional P3 mediante otra invitación válida.

Debe funcionar sin interfaz genérica de merge.

### E2E D — duplicado

Crear dos registros que solo se vuelven candidatos al vincular P1→P2.

Verificar ambas respuestas:

- `NO, SON DOS` → conserva ambos;
- `SÍ, ES EL MISMO` → una sola identidad de partido y sin doble efecto.

Incluir caso con score diferente.

### E2E E — duplicado ya oficial

Dos partidos validados con efecto.

Al confirmar duplicado:

- revertir solo la doble contabilización;
- estados Nivel vigentes consistentes;
- no cascada histórica completa;
- Ranking publicado intacto;
- próxima edición usa Nivel corregido;
- Grupos/estadísticas/Intelligence no cuentan dos veces.

### E2E F — conflicto de slot

P1 y P2 aparecen en el mismo match en slots distintos.

La vinculación no puede producir dos slots con la misma persona ni mutación parcial.

### Seguridad

Verificar:

- usuario no relacionado no puede generar invitación;
- token inválido/vencido/usado;
- `NO SOY YO` no consume;
- carreras: dos links consumidos simultáneamente → un solo ganador;
- claim/recovery/reconciliation idempotentes;
- rate limits;
- RLS/permisos;
- ningún token crudo persistido en DB.

---

## 20. Orden técnico recomendado

Por riesgo, dividir en fronteras reales, no microtareas:

### Fase 1 — backend de identidad/links

- permisos;
- multi-link;
- preview seguro;
- existing-account recovery;
- invariantes/transacción;
- Nivel recovery contract;
- tests unit/integration.

### Fase 2 — frontend/UX

- INVITAR;
- copiar link;
- acceso/retorno;
- ¿Sos Pedro?;
- estados de éxito/error;
- copy sin “reclamar”.

### Fase 3 — duplicados y derivados

- detección candidata;
- confirmación;
- reconciliación;
- reversión de doble efecto;
- Grupos/Stats/Intelligence/Ranking futuro;
- E2E dirigido.

Si Claude encuentra una decisión humana genuina no cubierta, marcar **DECISIÓN ABIERTA** y continuar lo demás. No reabrir decisiones ya cerradas en este documento.

---

## 21. Gate posterior

Central debe revisar en una sola pasada:

- diff completo;
- migraciones;
- seguridad/RLS/rate limits;
- invariantes de identidad;
- tests;
- comportamiento de Nivel recuperado;
- no mutación de Ranking publicado;
- Grupos/Intelligence/stats;
- Staging real;
- deploy/frontend.

Después, QA humano de Sebastián solo para:

- lectura visual de Resumen → INVITAR;
- bottom sheet;
- pantalla **¿Sos Pedro?**;
- resolución de posible duplicado.

No convertir a Sebastián en operador técnico.

---

## 22. Estado final de decisiones

**No quedan decisiones de producto abiertas conocidas en esta investigación.**

La implementación puede avanzar autónomamente sobre `staging`, respetando este documento y las fuentes maestras vigentes, actualizándolas para eliminar las contradicciones anteriores una vez que el comportamiento nuevo quede implementado/verificado.
