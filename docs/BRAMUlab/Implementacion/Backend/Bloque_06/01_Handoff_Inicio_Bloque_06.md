# Backend Bloque 6 — Handoff de inicio para Claude Code
## Validación y actualización oficial

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD de partida:** `73c2e38` o superior  
**Estado previo:** Bloques 1–5 CERRADOS en Staging  
**Bundle funcional actual:** `04.10-h15`

---

## 1. Objetivo de esta primera ronda

Iniciar **Backend Bloque 6 — Validación y actualización oficial**.

Esta primera ronda es **SOLO ANÁLISIS + PLAN DE IMPLEMENTACIÓN**.

No implementar todavía.

El bloque es sensible porque por primera vez una acción de usuario puede convertir un partido compartido en **verdad deportiva oficial** y modificar:

- Nivel BRAMU;
- calibración;
- estadísticas oficiales;
- snapshots;
- reasonCodes;
- historial de efectos;
- correcciones/reversiones posteriores.

Antes de tocar esquema o lógica, hay que entender exactamente cómo encaja con Bloques 3–5 y cerrar cualquier hueco técnico real.

---

## 2. Fuentes de verdad

Leer primero y respetar precedencia:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Experiencia_Inicial.md`
   - especialmente §§8–16 y casos límite de §22;
3. `docs/BRAMUlab/Backend_Infraestructura.md`
   - especialmente Bloque 6, alineaciones y riesgos;
4. `docs/BRAMUlab/Nivel_BRAMU_Formula_V1.5.md`
   - especialmente reglas de actualización, elegibilidad, snapshots, correcciones y contrato backend;
5. `docs/BRAMUlab/Nivel_BRAMU_Implementacion.md`
   - solo donde haga falta mapear fórmula vigente al motor real existente;
6. `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`
   - leer únicamente secciones Bloques 3, 4 y 5;
7. `docs/BRAMUlab/Implementacion/Backend/Bloque_05/16_Cierre_Bloque_05.md`

No usar `Archivo/`, `Backup/` ni handoffs históricos como autoridad salvo trazabilidad puntual.

---

## 3. Estado heredado que NO se reabre

### Bloque 3

Ya existe Nivel persistente real:

- `level_states`;
- `level_events`;
- onboarding oficial server-backed;
- Edge Function `officialize-onboarding`;
- motor JS compartido/versionado;
- estimador `nivel_inicial_v1_2`.

Bloque 6 debe integrar partidos al mismo sistema sin duplicar la fórmula ni reimplementarla en SQL.

### Bloque 4

Ya existe identidad real/provisional:

- `player_id` como identidad;
- provisionales persistentes;
- claim conservando exactamente el mismo `player_id`;
- nunca matching/fusión por nombre.

### Bloque 5

Ya existe:

- `matches`;
- `match_participants`;
- `match_sets`;
- `match_revisions`;
- `match_actions`;
- `match_user_state`;
- `match_submissions`;
- `create-or-attach-match`;
- `pending_validation`;
- `validation_deadline_at`;
- `action_side`;
- `readyForValidation`;
- revisiones append-only;
- idempotencia;
- control de concurrencia;
- ambigüedad;
- outbox/`sync_pending`;
- historial server-backed;
- límite de 5 pendientes;
- expiración lógica;
- hide / nota privada;
- separación display vs computable.

Bloque 5 **deliberadamente NO marca un partido como `validated`**.

La segunda declaración coincidente desde la pareja contraria deja:

- mismo `match_id`;
- una acción `confirmed`;
- `action_side = null`;
- `status = pending_validation`;
- `readyForValidation = true`.

Bloque 6 debe consumir correctamente ese estado.

---

## 4. Reglas de producto de Bloque 6 que son obligatorias

### Validación por parejas

- La revisión original requiere conformidad de la pareja contraria a quien la propuso/cargó.
- Cualquiera de los dos integrantes registrados del lado accionable puede resolver por su pareja.
- Si uno resuelve, la tarea desaparece para ambos.
- Si en una pareja solo hay un usuario real y el compañero es provisional, el usuario real puede actuar.
- Si ese provisional reclama luego su identidad mientras el partido sigue abierto, adquiere autoridad por esa pareja.

### Acciones normales

Las acciones de producto son:

- `Confirmar`;
- `Proponer corrección`;
- `No participé`.

No volver al viejo modelo `validar/rechazar`.

### Partido pendiente

- deadline fijo de 30 días desde la primera carga aceptada;
- ninguna corrección reinicia el reloj;
- al expirar, permanece en historial y deja de ser accionable/computable.

### Corrección pre-validación

- cualquiera de los cuatro puede proponerla;
- crea nueva revisión append-only;
- quien propone deja a su pareja conforme con esa revisión;
- la acción pasa a la otra pareja;
- pueden existir múltiples intercambios hasta el deadline;
- una acción contra una revisión vieja debe fallar/requerir refresh.

### Corrección post-validación

- ventana normal: 3 días desde `validated_at`;
- la versión oficial previa sigue contando mientras la propuesta espera;
- si la otra pareja acepta, la nueva revisión pasa a ser oficial;
- corregir NO reinicia los 3 días;
- después de 3 días el score/resultado normal ya no se discute por autoservicio.

### Identidad / `No participé`

- no significa “rechazar partido”;
- significa que un slot está asociado a la identidad incorrecta;
- antes de validar, el partido sigue pendiente;
- puede reemplazarse por cuenta real o provisional;
- después de validar, una incidencia de identidad puede abrirse hasta 10 días desde `validated_at`;
- una vez abierta, hay 7 días corridos para identificar correctamente ese slot;
- el resultado oficial puede mantenerse mientras se resuelve la identidad;
- si no se identifica, queda `Jugador no identificado`;
- no fabricar identidad ni mantener el partido atribuido a quien dijo que no participó.

### Ranking

Bloque 7 todavía no existe.

Bloque 6 NO implementa Ranking, pero debe preservar la regla:

- una edición semanal publicada será inmutable;
- una corrección posterior afectará solo verdad actual y futuras ediciones.

---

## 5. Nivel BRAMU — contrato obligatorio

Fuente normativa: `Nivel_BRAMU_Formula_V1.5.md`.

Reglas críticas:

- el Nivel cambia cuando el partido se vuelve válido y confirmado;
- un partido manual debe quedar cargado/asociado/validado dentro de la ventana vigente para ser computable;
- pending/expired no computan;
- corrección posterior:
  1. registrar reversión exacta del efecto anterior;
  2. recalcular con los mismos snapshots previos;
  3. aplicar solamente la diferencia neta;
  4. conservar versiones y causa;
- no recalcular en cascada toda la historia;
- un partido puede computar con niveles faltantes según reglas de imputación/disponibilidad V1.5;
- un provisional nunca recibe Nivel permanente de terceros;
- deben preservarse:
  - snapshots previos;
  - expectativa;
  - factores;
  - disponibilidad;
  - repetición/círculo/compañero;
  - delta individual interno;
  - reasonCodes;
  - versión de algoritmo.

No inventar nuevas reglas deportivas.

---

## 6. Preguntas técnicas que el análisis DEBE resolver

No son pedidos de nuevas funciones; son riesgos que hay que cerrar antes de escribir código.

### 6.1 ¿Cómo se dispara la oficialización?

Analizar los dos caminos:

1. usuario pulsa `Confirmar`;
2. una segunda carga independiente del rival ya dejó `readyForValidation=true` en Bloque 5.

La fuente de producto permite que una segunda declaración coincidente complete la validación.

Definir cómo Bloque 6 convierte ambos caminos en **el mismo comando idempotente de oficialización**, sin tener dos lógicas paralelas.

### 6.2 Atomicidad con motor JS

El motor de Nivel vive en JS y no debe duplicarse en SQL.

Diseñar una arquitectura que garantice:

- lectura consistente de los estados de Nivel;
- cálculo con el motor compartido;
- aplicación atómica a DB;
- protección si dos partidos que comparten jugador se validan a la vez;
- expected versions / locks / retry cuando corresponda;
- un único efecto por partido/revisión;
- retry HTTP seguro.

Evaluar explícitamente el patrón:

Edge Function → cálculo JS → RPC privada transaccional con comparación de versiones / retry

u otra opción simple compatible con lo existente.

No asumir que una lectura Edge + escritura posterior es atómica sin demostrar cómo se protege.

### 6.3 Qué datos persistir para poder revertir EXACTAMENTE

Auditar si `level_events` actual alcanza.

Definir el mínimo modelo necesario para preservar por partido/revisión:

- snapshots prepartido;
- resultado del cálculo;
- reasonCodes;
- versión del algoritmo;
- delta aplicado a cada jugador;
- evidencia/unidades/confianza;
- efecto vigente vs revertido;
- vínculo entre una oficialización y su reversión/corrección.

Evitar tablas duplicadas si puede resolverse limpiamente con lo existente.

### 6.4 Corrección de un partido ya oficial

Explicar exactamente cómo implementar:

- oficialización inicial;
- reversión exacta;
- recálculo de revisión corregida con snapshots originales;
- aplicación de diferencia neta sobre el estado ACTUAL;
- auditoría;
- idempotencia;
- concurrencia.

No hacer recomputación en cascada del historial.

### 6.5 Cambio de participante después de validar

Este es un punto crítico.

Si una incidencia de identidad cambia uno de los cuatro participantes:

- el jugador incorrecto no puede seguir recibiendo efecto;
- el correcto puede tener un Nivel distinto;
- la expectativa y los deltas del partido pueden cambiar.

Analizar cómo obtener el snapshot apropiado del participante correcto para la revisión corregida sin usar arbitrariamente su nivel actual si no corresponde.

Si la documentación vigente no determina de forma inequívoca el criterio temporal para un participante agregado post-validación, marcarlo como:

**DECISIÓN ABIERTA**

y proponer una recomendación concreta y segura.

### 6.6 Representación de “Jugador no identificado”

El modelo actual usa participantes con `player_id`.

Pero producto dice:

- retirar la atribución a la persona incorrecta;
- no fabricar una identidad;
- permitir slot `por identificar`;
- eventualmente terminar como `Jugador no identificado`.

Analizar el cambio mínimo de esquema que permita eso.

No usar una cuenta/provisional ficticia como “Jugador no identificado” si eso viola la regla de no fabricar identidad.

### 6.7 Estadísticas oficiales

Auditar qué estadísticas hoy se derivan localmente y cuáles tienen persistencia real.

Bloque 6 debe asegurar que:

- pending nunca cuente;
- validated sí;
- corrección/anulación cambie los derivados correctos;
- no se dupliquen dos fuentes de verdad.

Proponer si conviene:
- persistir agregados;
- derivar server-side desde partidos oficiales;
- o una combinación mínima.

No crear métricas nuevas.

### 6.8 Repetición / compañero / círculo competitivo

Auditar cómo el motor actual obtiene estos factores.

Definir cómo un partido server-backed validado alimentará esas entradas con datos reales y cómo una corrección posterior preservará los snapshots usados originalmente.

### 6.9 Pendientes accionables y superficies

Mapear:

- contador personal;
- Home;
- Historial;
- Notificaciones;
- detalle del partido.

Bloque 6 debe distinguir:
- pendiente accionable;
- pendiente en espera;
- corrección post-validación;
- incidencia de identidad post-validación.

Las incidencias post-validación NO cuentan para el límite de 5 cargas.

### 6.10 Notificaciones internas

Auditar la implementación actual.

Definir el mínimo server-backed necesario para eventos como:

- X cargó un partido;
- X confirmó;
- X propuso corrección;
- X reportó identidad incorrecta;
- corrección aceptada;
- deadline cercano si corresponde.

No agregar push notifications.

### 6.11 Comando administrativo

Proponer un mecanismo simple y seguro para:

- anular;
- corregir excepcionalmente;
- dejar actor + motivo;
- revertir/reprocesar efectos oficiales de forma idempotente.

No construir panel admin complejo en este bloque.

---

## 7. Casos que el plan de tests debe cubrir

Como mínimo, el plan debe contemplar:

### Validación
- rival A confirma revisión original;
- compañero del rival intenta confirmar después → idempotente / sin doble efecto;
- dos integrantes del mismo lado confirman simultáneamente;
- segunda carga coincidente de Bloque 5 → oficialización exactamente una vez;
- reintento de la Edge Function → cero doble efecto.

### Nivel
- cuatro niveles conocidos;
- tres conocidos;
- dos conocidos, uno por pareja;
- no computable por falta de niveles;
- provisional no recibe Nivel permanente;
- rated_matches/calibración avanzan una sola vez;
- motor server/browser conserva paridad.

### Corrección
- corrección pendiente antes de validar;
- contrapropuesta;
- stale revision/version conflict;
- corrección post-validación dentro de 3 días;
- corrección fuera de 3 días rechazada;
- reversión exacta + net delta;
- retry de corrección sin duplicar.

### Identidad
- `No participé` pre-validación;
- reemplazo por usuario real;
- reemplazo por provisional;
- incidencia post-validación dentro de 10 días;
- apertura fuera de 10 días rechazada;
- slot por identificar;
- resolución dentro de 7 días;
- vencimiento de 7 días;
- claim de provisional abierto en un pendiente hereda autoridad correcta.

### Seguridad
- solo participantes autorizados pueden actuar;
- autoridad por pareja;
- RPCs privadas / RLS;
- usuario externo no puede ver o mutar incidentes;
- service-role nunca llega al cliente.

### Regresiones
- Bloques 2–5 continúan verdes;
- pending no computa;
- hide personal no altera efecto oficial;
- historial local legacy no se convierte en autoridad server-side.

No pedir pruebas redundantes si una misma corrida cubre varios riesgos.

---

## 8. Qué NO hacer en esta ronda

NO:

- escribir migraciones;
- modificar JS/CSS/HTML;
- desplegar Edge Functions;
- tocar Supabase;
- tocar Vercel;
- tocar `main`;
- tocar Production;
- tocar BRAMUlive;
- implementar Ranking;
- implementar Intelligence;
- rediseñar pantallas;
- abrir una arquitectura nueva innecesaria;
- releer todo `Archivo/`.

Sí podés inspeccionar todo el código vigente de `staging`.

---

## 9. Entregables

Crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_06/02_Analisis_Claude.md`

y:

`docs/BRAMUlab/Implementacion/Backend/Bloque_06/03_Plan_Implementacion_Claude.md`

El análisis debe incluir:

- mapa exacto de tablas/RPCs/Edge/functions/frontend afectados;
- qué se reutiliza;
- qué falta;
- riesgos;
- decisiones técnicas recomendadas;
- **DECISIONES ABIERTAS** solo donde la fuente maestra realmente no alcance.

El plan debe separar claramente:

- AGREGAR;
- FUSIONAR;
- REEMPLAZAR;
- NO TOCAR.

También debe proponer orden de implementación y checkpoints.

---

## 10. Cierre de esta ronda

Al terminar:

- commit/push únicamente a `staging`;
- devolver HEAD;
- listar archivos creados;
- resumir recomendaciones;
- listar DECISIONES ABIERTAS reales;
- confirmar que no tocaste código, Supabase, Vercel, main, Production ni BRAMUlive.

Después detenerte.

ChatGPT central revisará análisis y plan antes de autorizar implementación.
