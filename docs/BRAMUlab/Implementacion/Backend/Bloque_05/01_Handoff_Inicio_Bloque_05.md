# Backend Bloque 5 — Handoff de inicio
## Partidos compartidos e historial

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**HEAD de partida esperado:** `41af2ef` o superior  
**Estado de partida:** Bloques 1–4 cerrados y validados en Supabase/Vercel Staging. Bloque 5 todavía no implementado.

---

## 1. Objetivo

Diseñar la implementación de **Backend Bloque 5 — Partidos compartidos e historial**, sin reabrir decisiones ya cerradas de producto ni adelantar el flujo completo de validación de Bloque 6.

Este primer trabajo de Claude Code es de **análisis técnico y plan de implementación**, no de ejecución remota.

Al finalizar, debe existir un documento:

`docs/BRAMUlab/Implementacion/Backend/Bloque_05/02_Analisis_Claude.md`

commiteado y pusheado únicamente a `staging`.

---

## 2. Fuentes que debe leer

Leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Backend_Infraestructura.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_04/09_Cierre_Bloque_04.md`

Consultar secciones puntuales del informe de backend solo si hace falta trazabilidad:

`docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`

NO leer `Archivo/`, `Backup/` ni informes históricos completos salvo contradicción material.

---

## 3. Baseline que NO se reabre

- Bloques 1–4 están cerrados.
- Supabase Staging: `bramulab-staging`.
- `main` no se toca.
- Production no se toca.
- BRAMUlive no se toca.
- La app principal BRAMUlab carga partidos YA JUGADOS; no reintroducir marcador en vivo.
- Nivel BRAMU inicial productivo ya existe y persiste server-side.
- Búsqueda, perfiles server-backed, provisionales y claim ya están cerrados.
- Los provisionales tienen `player_id` persistente.
- Nombres iguales nunca se fusionan automáticamente.
- El claim conserva el mismo `player_id`.
- No inventar estadísticas individuales ni resultados que el backend no pueda demostrar.

---

## 4. Alcance obligatorio de Bloque 5

Tomar como vigente `Backend_Infraestructura.md`:

### Partido compartido

Debe existir una entidad real server-side que represente un único encuentro de dobles ya jugado.

Debe contemplar como mínimo:

- `matches`;
- cuatro lugares de participante;
- dos parejas;
- sets y resultado estructurado;
- fecha/hora jugada;
- formato/modalidad;
- creador;
- estado inicial `pending_validation`;
- deadline de validación fijo a 30 días desde la carga aceptada por servidor;
- versión/revisión;
- lado/pareja que tiene la acción cuando corresponda;
- timestamps.

### Participantes

- siempre por `player_id` cuando la identidad está resuelta;
- puede ser cuenta registrada o provisional;
- nunca deduplicar por nombre/apodo;
- snapshot mínimo de nombre visible para trazabilidad;
- un provisional existente debe poder reutilizarse explícitamente en varios partidos conservando su mismo UUID.

### Carga retroactiva

- máximo 14 días hacia atrás;
- validación autoritativa server-side;
- nunca confiar solo en fecha del cliente.

### Idempotencia local

- borrador/outbox local;
- estado local `sync_pending`;
- reintentar el MISMO envío no puede crear duplicados;
- definir una clave/idempotency key estable por intento lógico.

### Deduplicación del encuentro

Idempotencia y deduplicación son problemas distintos.

Dos personas pueden cargar por separado el MISMO partido.

Se debe diseñar un comando atómico/concurrency-safe `create-or-attach` que compare como mínimo:

- los cuatro `player_id`;
- composición de las parejas, sin depender de si una UI las llamó A/B;
- `played_at` dentro de una ventana temporal compatible;
- formato/modalidad.

El score se normaliza según orientación de parejas.

Si la coincidencia es inequívoca, ambas declaraciones deben converger en un único `match_id`.

Si hay ambigüedad, NO fusionar silenciosamente. El servidor debe devolver un estado/candidato para que la UI pida confirmación simple.

Nunca deduplicar por coincidencia de nombres.

### Revisión/auditoría

Bloque 5 debe preparar:

- `match_revisions` append-only;
- `match_actions` append-only;
- revisión original;
- versión esperada para concurrencia;
- historial/modificaciones reconstruibles.

Pero **NO implementar todavía el flujo completo de Confirmar / Proponer corrección / No participé de Bloque 6**.

La segunda declaración coincidente sí debe poder registrarse de forma coherente como declaración adicional sobre el mismo encuentro para que Bloque 6 pueda continuar desde ahí.

### Historial compartido

Un partido creado debe poder aparecer a los participantes vinculados.

Debe distinguir honestamente estados como:

- `pending_validation`;
- `expired`;
- `validated` cuando exista más adelante;
- `annulled` cuando exista más adelante;
- `sync_pending` SOLO local mientras aún no fue aceptado por servidor.

Pendiente/expired no afectan Nivel ni estadísticas oficiales.

### Pendientes

Diseñar soporte para:

- contador personal de pendientes accionables;
- máximo 5 antes de bloquear iniciar una nueva carga;
- el servidor debe ser autoridad del conteo relevante.

No adelantar la UX completa de resolución de Bloque 6.

### Ocultamiento individual

Debe existir base para ocultar un partido del historial personal sin borrar el partido compartido ni sus efectos oficiales.

---

## 5. Frontera con Bloque 6

NO meter dentro de Bloque 5:

- flujo completo `Confirmar / Proponer corrección / No participé`;
- corrección de identidad post-validación;
- reemplazo interactivo de participante;
- correcciones normales durante 3 días post-validación;
- incidencias de identidad 10 + 7 días;
- actualización oficial de Nivel por partido;
- reversión/reproceso de Nivel;
- notificaciones finales del circuito;
- comandos administrativos de anulación/corrección.

Bloque 5 debe dejar el modelo y los contratos preparados para que Bloque 6 pueda implementar eso sin rehacer el esquema.

---

## 6. Compatibilidad obligatoria con Bloques anteriores

El análisis debe comprobar explícitamente cómo preservar:

### Bloque 2

- Auth y RLS;
- `players`/`profiles`;
- privacidad;
- username/ubicación.

### Bloque 3

- ningún partido pendiente modifica `level_states`;
- no crear todavía `match_level_results` con efectos reales si Bloque 6 es quien oficializa;
- no romper `officialize-onboarding`;
- mantener paridad del motor existente.

### Bloque 4

- usar `player_id` real;
- provisional puede ocupar un lugar del partido;
- provisional nunca aparece en búsqueda global;
- claim posterior mantiene el mismo ID y por lo tanto el partido debe quedar automáticamente vinculado a la cuenta reclamada, sin migrar la fila del partido;
- probar literalmente por primera vez que el mismo provisional puede aparecer en varios partidos manteniendo el mismo ID.

---

## 7. Lo que Claude debe investigar en el repo

Antes de proponer SQL/código:

- estructura actual de la carga manual de partido jugado;
- snapshot local actual de historial;
- representación actual de jugadores/equipos/sets/resultado;
- generación actual de IDs locales;
- qué campos actuales son producto vigente y cuáles son mocks/legacy;
- puntos de entrada en `app.js`, `match-load.js`, `store.js` y módulos de historial;
- qué lógica puede reutilizarse sin reescribir una UX que ya funciona;
- compatibilidad con service worker/cache;
- cómo introducir outbox/sync sin romper el camino local actual.

No reescribir por gusto algo que ya funciona.

---

## 8. Decisiones que el análisis DEBE proponer, pero no ejecutar

El documento `02_Analisis_Claude.md` debe cerrar una propuesta concreta para:

1. esquema SQL exacto necesario en Bloque 5;
2. índices y constraints;
3. RLS/GRANTs;
4. RPC(s)/comandos server-side;
5. estrategia de idempotencia;
6. algoritmo de normalización/deduplicación de encuentro;
7. manejo de concurrencia;
8. representación de revisiones/acciones;
9. expiración a 30 días;
10. contador de pendientes;
11. `match_user_state`/ocultamiento;
12. outbox local + `sync_pending`;
13. integración mínima con la UI existente;
14. tests automáticos contra Supabase real;
15. pruebas manuales necesarias en Vercel Staging;
16. cleanup seguro de fixtures;
17. migración/adopción de cualquier dato local existente: si no hace falta migrar automáticamente, decirlo explícitamente.

Para cualquier punto donde la fuente maestra deje una decisión importante abierta, NO inventarla silenciosamente: marcarla como **DECISIÓN A CERRAR CON CHATGPT/SEBASTIÁN** y explicar qué cambia según cada opción.

---

## 9. Seguridad y restricciones

- NO tocar Supabase.
- NO aplicar migraciones.
- NO tocar Vercel.
- NO modificar Production.
- NO tocar `main`.
- NO tocar BRAMUlive.
- NO borrar datos de QA de Bloque 4.
- NO generar secretos.
- NO agregar service role al frontend.
- NO implementar código todavía en esta primera ronda.
- NO crear nuevas funciones de producto fuera de Bloque 5.
- NO iniciar Bloque 6.

---

## 10. Entregable

Crear y commitear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_05/02_Analisis_Claude.md`

El documento debe incluir:

- lectura del estado actual;
- propuesta de arquitectura concreta;
- modelo de datos;
- contratos de RPC;
- deduplicación/idempotencia/concurrencia;
- integración frontend/local;
- RLS/seguridad;
- estrategia de tests;
- riesgos;
- decisiones abiertas reales;
- orden de implementación recomendado;
- definición precisa de cuándo Bloque 5 puede considerarse cerrado.

Commit/push únicamente a `staging`.

Al terminar, responder con:

- HEAD resultante;
- archivo creado;
- resumen de 5–10 puntos;
- decisiones abiertas que requieran revisión;
- confirmación de que NO tocaste Supabase/Vercel/main/Production/BRAMUlive.

NO implementar Bloque 5 todavía.
