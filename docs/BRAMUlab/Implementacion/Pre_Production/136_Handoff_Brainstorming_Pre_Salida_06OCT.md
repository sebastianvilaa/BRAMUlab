# 136 — Handoff Brainstorming · decisiones maduras antes de salida

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base al preparar este handoff:** `ac7dc95451c292426b6a7f1b19b72d61ee3f470e`  
**Objetivo:** transferir al chat Central/Desarrollo las decisiones maduras del chat de Brainstorming una vez cerrado V04.35, para que Desarrollo decida **qué corresponde hacer antes de Production, qué conviene integrar durante la preparación de salida y qué debe quedar para después**, sin reabrir bloques ya cerrados.

## 0. Antes de actuar

Leer en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. este handoff
4. únicamente las fuentes maestras afectadas por el frente que se decida abordar

Estado de corte:
- V04.35 / 04.35-h1 está **CERRADA EN STAGING / PASS CENTRAL + QA humano**.
- Invitados / Identidad / Recuperados / Pendientes + duplicados asociados: **cerrado**. No reabrir salvo regresión concreta.
- `main`, Production y BRAMUlive siguen prohibidos sin autorización explícita.
- Este handoff **no autoriza** por sí solo a abrir Production.

---

# 1. Qué debe hacer Desarrollo con este handoff

No implementar todo en bloque ni asumir que cada punto es requisito de salida.

Primero hacer una **evaluación de secuencia** y clasificar cada frente como:

- **ANTES DE PRODUCTION**
- **DURANTE G3/G4 / preparación de salida**
- **POST-LANZAMIENTO CORTO**
- **FUTURO / SOLO SI APARECE EVIDENCIA**

Para cada punto relevante, Desarrollo debe considerar:
- impacto real en el primer usuario;
- esfuerzo;
- riesgo técnico;
- dependencias con Vercel / GitHub / Supabase / PWA;
- riesgo de seguridad o exposición;
- si ya existe infraestructura reutilizable;
- si requiere una decisión humana adicional.

Después de esa evaluación, coordinar la ejecución con los agentes adecuados:
- Central: producto, arquitectura, documentación, gates y coherencia.
- Claude Code: auditoría de repo, implementación, migraciones, pruebas.
- Work: Vercel/GUI/navegador/validación visual cuando aporte evidencia.
- Sebastián: solo decisiones de producto, autorizaciones sensibles y QA final.

---

# 2. Frente A — exposición, repo y limpieza de salida

## Estado: DECISIÓN MADURA / Desarrollo debe decidir la secuencia

### Problema observado

Durante Brainstorming se verificó que el repositorio GitHub `sebastianvilaa/BRAMUlab` está actualmente **público**.

También se inspeccionó `bramulab/index.html` en `staging` y contiene abundantes comentarios que llegan literalmente al navegador: historia de versiones, handoffs, causas de bugs, decisiones de rondas y explicación interna de implementación.

La preocupación de producto no es “ocultar mágicamente JavaScript”, sino:
- no regalar documentación interna innecesaria;
- no exponer más superficie de la necesaria;
- ordenar el repo antes de usuarios reales;
- verificar que nunca se haya filtrado un secreto;
- separar **código fuente mantenible** de **artefacto público limpio**.

### Dirección confirmada

1. **Auditar la exposición del repo antes de Production.**
2. Evaluar pasar el repo a **privado**, pero **NO cambiar la visibilidad a ciegas**: antes trazar dependencias reales con Vercel, GitHub Pages, integraciones, agentes y cualquier flujo actual.
3. Ejecutar una **auditoría de secretos**, incluyendo historia Git cuando corresponda. Si alguna credencial sensible fue commiteada alguna vez, eliminar el archivo actual no alcanza: la credencial afectada debe tratarse como expuesta y rotarse.
4. Revisar qué archivos/documentos necesitan vivir en Git y cuáles son temporales/consumidos.
5. Mantener las **fuentes maestras vigentes versionadas**. No sacar documentos centrales del repo solamente por miedo a exposición si el repo queda correctamente privado.
6. Podar handoffs consumidos, temporales, duplicaciones y documentación agente-a-agente que ya haya sido absorbida por una fuente maestra, siguiendo la regla vigente de `Metodo_Trabajo.md` / `README.md`.
7. Revisar el artefacto que recibe el navegador:
   - conservar en source los comentarios técnicos que realmente ayuden a mantener código;
   - evitar que Production entregue arqueología de versiones/handoffs/comentarios internos innecesarios;
   - evaluar minificación/build limpio **solo si puede hacerse de forma simple y compatible con la arquitectura actual**;
   - no introducir una toolchain compleja únicamente para “ocultar” frontend.
8. Recordatorio de seguridad: cualquier JS/HTML/CSS ejecutado en el cliente es inspeccionable. La seguridad real debe seguir en backend, RLS, RPCs, permisos, rate limits y secretos fuera del cliente.

### NO hacer

- No borrar indiscriminadamente todos los comentarios del source.
- No mover fuentes maestras a una computadora local sin estrategia de versionado/backup.
- No asumir que minificar vuelve secreto el frontend.
- No convertir esta limpieza en una reescritura de arquitectura.

---

# 3. Frente B — identidad visual de instalación y URL

## B1. Icono PWA / app

### Estado: CONFIRMADO COMO NECESIDAD DE SALIDA

La infraestructura de iconos ya existe (`192`, `512`, `maskable`, `apple-touch-icon`), pero Sebastián considera que el icono instalado actual sigue viéndose mal / sin el margen y tratamiento visual correcto.

**Dirección:** resolver el asset y su presentación antes del primer usuario real, con QA real de instalación cuando corresponda.

No requiere rediseñar branding completo: es un pulido de primera impresión.

## B2. URL estable de la app

### Estado: DIRECCIÓN CONFIRMADA; timing técnico a decidir

Es deseable que, cuando empiecen a circular invitaciones reales, los links ya usen una URL estable propia en vez de una URL temporal de Vercel.

Dirección conceptual:
- dominio principal de marca para web pública;
- subdominio o ruta estable para la app, por ejemplo `app.bramulab...`.

**No se cerró todavía el dominio exacto** (`.com`, `.com.ar`, etc.).

Desarrollo debe evaluar si conviene resolver el dominio de la app:
- antes de abrir Production;
- durante G3/G4;
- o inmediatamente después del smoke inicial de Sebastián pero antes de invitar a terceros.

---

# 4. Frente C — web pública de BRAMUlab

## Estado: CONFIRMADA COMO DIRECCIÓN DE PRODUCTO / POST-LANZAMIENTO CORTO salvo que Desarrollo vea una razón fuerte para adelantarla

Sebastián quiere una web pública simple, visual, tipo one-page, separada de la app.

Objetivo:
- explicar qué es BRAMUlab;
- contar el flujo de valor sin tecnicismos;
- usar capturas reales;
- tener un CTA claro hacia la app/instalación.

Relato tentativo a trabajar más adelante:
- qué es BRAMU;
- Nivel BRAMU;
- carga de partidos;
- historial;
- Grupos;
- Ranking;
- BRAMU Intelligence;
- CTA.

El orden final y el copy **no están cerrados**.

### Instalación

Dirección deseada: que el CTA reduzca al mínimo la fricción para instalar la PWA.

No asumir una API universal de “instalar”:
- donde el navegador permita prompt directo, aprovecharlo;
- donde no, llevar a la app y mostrar la instrucción mínima específica de plataforma.

No convertir la landing en un requisito técnico grande para abrir Production si no aporta al primer smoke/primeros usuarios.

---

# 5. Frente D — validación y abuso

## D1. “Cargador confiable” / auto-validación por reputación

### Estado: DESCARTADO

Se exploró una idea donde usuarios con muchas cargas correctas y alta “confianza” pudieran tener partidos auto-validados si el rival no respondía.

**Decisión:** NO implementar.

### Motivos

- introduce excepciones a una regla que conviene que sea igual para todos;
- genera preguntas del tipo “¿por qué a él le creen y a mí no?”;
- exige definir score de confianza, volumen, ventana temporal, errores, degradación, fraude, colusión, etc.;
- resuelve un abuso todavía no observado en usuarios reales;
- aumenta bastante la complejidad para un caso probablemente poco frecuente.

Regla preferida:
- mismas reglas de validación para todos;
- validación por pareja;
- pendientes accionables;
- gate vigente 3/4/5;
- partido nunca oficial: expira a los 30 días.

Reabrir esta idea solo con evidencia real y suficiente de veto estratégico por no-validación.

---

## D2. Veto estratégico por silencio

### Estado: RIESGO ACEPTADO V1

Caso:
- una pareja pierde un partido real;
- ambos integrantes deciden no validar para evitar que compute.

BRAMU no debe crear ahora un tribunal ni una auto-validación especial para resolverlo.

Resultado vigente:
- queda pendiente;
- se aplican las superficies/gates actuales;
- si no se resuelve, expira según la regla vigente de 30 días;
- no computa oficialmente.

Observar uso real antes de agregar mecanismos.

---

## D3. Anular una carga pendiente

### Estado: DECISIÓN DE PRODUCTO CERRADA / evaluar implementación

Se detectó un hueco legítimo distinto de “reportar un error”:

> El autor cargó un registro que no debería seguir existiendo como carga.

La arquitectura ya contempla conceptualmente el estado server-side `annulled`, pero falta decidir/implementar su interacción normal si Desarrollo confirma que corresponde ahora.

### Regla cerrada

**Solo el autor original de la carga puede anularla.**

Puede hacerlo mientras:
- el partido siga `pending_validation`;
- **ninguna otra persona** haya realizado una acción que reconozca que ese encuentro existió.

### Qué NO bloquea la anulación

Un tercero que marca sobre sí mismo:
- `No participé`

no reconoce que el encuentro existió; solo protege su identidad. Por lo tanto, **no bloquea** la posibilidad del autor de anular.

### Qué SÍ bloquea la anulación

Una acción de otra persona que presupone/reconoce la existencia del encuentro, por ejemplo:
- validar/confirmar;
- proponer una corrección de score;
- aceptar/mantener una revisión;
- corregir identidad indicando quién sí jugó;
- cualquier acción equivalente que afirme de hecho que hubo un partido.

La corrección realizada por el propio autor no debe convertir automáticamente la carga en “ajena”; el criterio importante es la evidencia aportada por **otra persona**.

### UX acordada

En el Resumen de un partido pendiente cargado por el usuario:
- `REPORTAR UN ERROR`;
- debajo, con menor jerarquía, acción destructiva tipo texto rojo: **`Anular carga`**.

No esconderla dentro del formulario de `Reportar un error`; son conceptos distintos.

Confirmación conceptual:

**¿Anular esta carga?**  
El partido dejará de estar pendiente y no tendrá efectos en BRAMU.

Acciones:
- cancelar;
- anular carga.

Copy final puede pulirse sin cambiar la semántica.

### Efecto para usuarios

Al anular:
- desaparece de Historial;
- desaparece de Pendientes;
- desaparece de Home;
- desaparece de notificaciones/superficies deportivas vigentes;
- no genera una notificación nueva diciendo que fue anulado;
- no produce efectos de Nivel, Ranking, Grupos ni estadísticas.

Para el usuario, se comporta como una carga retirada, no como un “partido anulado” histórico visible.

### Trazabilidad interna

Internamente BRAMU sí debe conservar el evento/estado necesario para:
- auditoría;
- debugging;
- eventual análisis antiabuso.

No borrar físicamente la evidencia si el contrato actual de datos permite conservarla como `annulled`.

---

## D4. Abuso de “No participé”

### Estado: RIESGO CONOCIDO / NO DISEÑAR SANCIÓN AHORA

Posible abuso:
- alguien pierde un partido;
- en vez de ignorarlo, miente con `No participé` para intentar evitar que quede asociado a la derrota.

Pero existe el abuso inverso:
- una víctima real puede recibir partidos falsos y usar legítimamente `No participé` muchas veces.

Por eso **no se cerró ninguna suspensión automática, umbral ni culpable automático**.

### Decisión actual

- `No participé` protege identidad; no significa que BRAMU pueda decidir quién dice la verdad.
- No crear ahora un tribunal, votación ni castigo automático.
- Conservar trazabilidad de eventos relevantes para que, si aparece abuso real, se pueda investigar patrones.

### FUTURO, solo con evidencia

Podría evaluarse:
- advertencia;
- revisión;
- limitación temporal;
- suspensión.

Pero antes habría que poder distinguir razonablemente:
- usuario abusivo;
- usuario víctima de cargas falsas.

**No hay regla cerrada de sanción. No implementar una suspensión automática desde este handoff.**

---

# 6. Frente E — FAQ / Ayuda + canal de ideas de usuarios

## Estado: FUTURA / DIFERIDA, corto plazo; NO autoriza implementación inmediata

Idea surgida al final del Brainstorming:

### Ayuda / Preguntas frecuentes

Crear una superficie simple para resolver dudas comunes del usuario.

Ubicación candidata:
- Configuración / Ayuda / zona cercana a Soporte/Legal.

La ubicación y contenido final **no están cerrados**.

### Enviar comentarios / sugerencias

Dar al usuario una forma fácil de mandar:
- idea;
- comentario;
- sugerencia;
- eventualmente problema.

Primera solución posible y deliberadamente simple:
- abrir email hacia `bramulab@gmail.com`;
- asunto reconocible/filtrable, por ejemplo `[BRAMU FEEDBACK]`.

Más adelante podría distinguir categorías, pero **no está definido**.

Objetivo:
- captar ideas que BRAMU no esté viendo;
- evitar construir de entrada un sistema interno de tickets/feedback.

No implementar todavía sin una ronda específica de producto/UX.

---

# 7. Resumen de estados

| Tema | Estado de Brainstorming |
|---|---|
| Repo/exposición/secretos/artefacto público limpio | decisión madura; Desarrollo define secuencia |
| Repo privado | objetivo a evaluar antes de Production; no cambiar sin mapear dependencias |
| Poda de temporales/handoffs consumidos | confirmada como higiene; respetar fuentes maestras |
| Icono PWA definitivo | necesidad de salida |
| URL estable de app | dirección confirmada; timing a decidir |
| Web pública one-page | dirección confirmada; corto plazo, no bloqueante por defecto |
| Auto-validación por “cargador confiable” | **DESCARTADA** |
| Veto por silencio | riesgo aceptado V1 |
| Anular carga pendiente por autor | **DECISIÓN CERRADA**, evaluar implementación |
| Suspensión automática por abuso | **NO CERRADA / NO IMPLEMENTAR** |
| Trazabilidad antiabuso | conservar base de evidencia; sin sanción automática |
| FAQ/Ayuda | futura/diferida corto plazo |
| Enviar feedback por email | futura/diferida corto plazo |

---

# 8. Resultado esperado de Desarrollo

Después de leer este handoff, Desarrollo debe devolver una recomendación concreta y priorizada, no otra lluvia de ideas.

Esperado:

1. decir qué puntos, si alguno, deben entrar **antes de Production**;
2. decir cuáles conviene resolver durante **G3/G4**;
3. decir cuáles quedan **post-lanzamiento corto**;
4. identificar dependencias/riesgos;
5. indicar qué debe ejecutar Claude, qué puede absorber Central y qué requiere Work;
6. marcar cualquier decisión humana real como `DECISIÓN ABIERTA`;
7. no reabrir V04.35 ni repetir QA ya cerrada;
8. no tocar `main`, Production ni BRAMUlive sin autorización explícita.

Si Desarrollo recomienda implementar `Anular carga` antes de Production, primero debe contrastar esta regla con `Experiencia_Inicial.md` + `Backend_Infraestructura.md`, inspeccionar el soporte real de `annulled` y preparar una ronda acotada en `staging`.

Si recomienda abordar el frente de exposición/seguridad antes de Production, primero debe producir una auditoría focalizada y un plan de cambio seguro; **no privatizar/borrar/reorganizar a ciegas**.

---

# 9. Regla de continuidad

Este documento es el corte de Brainstorming del 06/10/2026.

Las ideas incluidas como **DESCARTADAS** deben conservar su motivo para no reabrirlas por memoria informal dentro de meses.

Las ideas **FUTURAS / DIFERIDAS** no son tareas pendientes obligatorias: son memoria de producto.

Las ideas nuevas que aparezcan después de este corte vuelven al chat de Brainstorming y entrarán en un traspaso posterior cuando Sebastián lo pida.
