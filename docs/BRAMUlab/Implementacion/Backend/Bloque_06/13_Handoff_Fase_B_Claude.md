# Backend Bloque 6 — Handoff Fase B frontend/wiring para Claude Code

**Fecha:** 21/09/2026  
**Rama obligatoria:** `staging`  
**Backend:** implementado y validado en Supabase Staging  
**Documento de entrada principal:** `12_Validacion_Backend_Staging_ChatGPT.md`

## Objetivo

Completar **Fase B de Bloque 6**: conectar la app BRAMUlab real con el backend ya implementado para que los usuarios puedan recorrer desde la UI los flujos vigentes de:

- pendientes accionables;
- Confirmar;
- Proponer corrección;
- responder corrección;
- No participé;
- resolución de identidad;
- Notificaciones.

No rediseñar el backend ni reabrir producto.

## Lectura obligatoria y acotada

Leer completo, en este orden:

1. `docs/BRAMUlab/README.md`;
2. `docs/BRAMUlab/Backend_Infraestructura.md` — solo Bloque 6 y contratos relacionados;
3. `docs/BRAMUlab/Experiencia_Inicial.md` — únicamente validación/correcciones/identidad/notificaciones;
4. `docs/BRAMUlab/Implementacion/Backend/Bloque_06/12_Validacion_Backend_Staging_ChatGPT.md`;
5. `docs/BRAMUlab/Implementacion/Backend/Bloque_06/11_Resultado_Correccion_Final_Claude.md`.

Después inspeccionar el frontend vigente:

- `bramulab/auth.js`;
- `bramulab/app.js`;
- `bramulab/index.html`;
- `bramulab/styles.css`;
- módulos B5 ya usados para partidos/historial.

No releer Archivo/Backup ni reabrir Bloques 1–5 salvo regresión concreta.

## Estado que debes asumir como verdadero

Supabase Staging ya tiene Bloque 6 aplicado y las Edge Functions activas:

- `create-or-attach-match`;
- `officialize-match`;
- `propose-match-correction`;
- `respond-match-correction`;
- `resolve-identity-issue`;
- `admin-resolve-identity-issue`.

Las RPCs de notificaciones/identidad/corrección también están aplicadas.

No vuelvas a migrar ni redesplegar backend en esta ronda.

## Implementación requerida

### 1. auth.js — AGREGAR/FUSIONAR capa de acceso B6

Agregar wrappers reutilizables siguiendo el patrón de Auth ya existente, sin service role en navegador, para las operaciones que correspondan:

- invocar `officialize-match`;
- invocar `propose-match-correction`;
- invocar `respond-match-correction`;
- invocar `resolve-identity-issue`;
- llamar RPC autenticada `report_identity_issue`;
- leer `get_notifications`;
- `mark_notification_read`;
- `mark_all_notifications_read`;
- cualquier RPC/read B6 ya existente necesaria para refrescar match/detail/pending count.

Nunca exponer ni pedir `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Partido pendiente — wiring real de autoridad por pareja

En server-backed `pending_validation`:

- mostrar claramente la acción vigente;
- permitir **Confirmar** solo por el lado accionable;
- cualquiera de los dos integrantes registrados de ese lado puede resolver por su pareja;
- después de confirmar, refrescar estado server-backed y evitar doble acción;
- nunca oficializar por lógica local;
- nunca reconstruir hacks de B5: usar la Edge Function/RPC B6 vigente.

### 3. Proponer corrección

Implementar el camino server-backed que hoy `app.js` todavía marca como pendiente de Bloque 6.

Debe respetar:

- pre-validación: mecanismo de revisión vigente del partido;
- post-validación: ventana de 3 días;
- score/sets únicamente para corrección normal;
- participante/identidad NO se modifica por este camino;
- la revisión oficial anterior sigue siendo la oficial mientras la propuesta espera respuesta.

Reutilizar el editor de score existente si encaja; no crear una UX paralela innecesaria.

### 4. Responder corrección

Para el lado que debe responder:

- aceptar;
- rechazar si el contrato actual lo permite;
- refrescar match, Nivel y notificaciones después de la operación;
- retries/idempotencia sin duplicar efectos.

### 5. No participé / identidad

Conectar el flujo visible al backend real:

- abrir incidencia con `report_identity_issue`;
- respetar 10 días para abrir incidencia post-validación;
- mostrar slot cuestionado como “Por identificar” / estado equivalente vigente;
- permitir resolución con jugador registrado o provisional seleccionable;
- si la ventana de 7 días venció y el backend materializa `unidentified`, mostrar “Jugador no identificado”;
- nunca fabricar identidad;
- el partido no se rechaza automáticamente.

No crear panel administrativo. `admin-resolve-identity-issue` queda fuera de UI normal.

### 6. Notificaciones / badge de pendientes

Conectar la bandeja real a `get_notifications`.

Debe contemplar:

Tareas accionables derivadas:

- `pending_review`;
- `correction_proposed`;
- `identity_questioned`.

Informativas persistidas:

- `match_validated`;
- `correction_accepted`;
- `identity_resolved`;
- `identity_unidentified`;
- otras vigentes.

Reglas:

- una tarea derivada desaparece para ambos integrantes de la pareja cuando uno la resuelve;
- no inventar “leída” para tareas sintéticas;
- marcar leídas solo las notificaciones persistidas;
- badge/contador debe reflejar estado real del servidor.

### 7. Refresh coherente

Después de cualquier acción B6 que cambie estado:

- refrescar match/detail;
- historial/Home si corresponde;
- Nivel server-backed;
- contador de pendientes;
- notificaciones.

Evitar recargas globales innecesarias si el wiring actual permite refresco acotado.

## UX

Mantener la dirección visual actual de BRAMUlab.

No convertir esto en una pantalla técnica.

Prioridad:

- qué necesita hacer el jugador;
- quién tiene la acción;
- qué cambió;
- estado claro después de actuar.

No agregar funciones nuevas ni “mejoras” fuera del flujo ya decidido.

## Tests obligatorios de esta ronda

### Local/regresión

- suite `tests.html` completa;
- tests B6 locales existentes;
- `node --check` de JS tocado.

Agregar tests dirigidos donde sea razonable para el wiring nuevo.

### No hacer todavía

No hacer QA manual completa en Vercel/Supabase desde Claude.

Después de implementar y dejar suite verde, ChatGPT central revisará el diff y Work hará QA real de navegador en Staging.

## Alcance prohibido

**NO TOCAR:**

- `main`;
- Production;
- BRAMUlive;
- Ranking;
- Intelligence;
- monetización;
- arquitectura backend B6 ya validada;
- migraciones Supabase;
- Edge Functions, salvo que encuentres un bloqueo técnico reproducible e imposible de resolver solo en frontend.

Si aparece ese caso:

1. documentarlo como **BLOQUEO BACKEND**;
2. no improvisar otro contrato;
3. continuar todo lo demás que no dependa de él.

## Entrega

Crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_06/14_Resultado_Fase_B_Claude.md`

Debe incluir:

- archivos tocados;
- qué flujo quedó conectado;
- tests;
- cualquier limitación;
- DECISIONES ABIERTAS, solo si realmente existen.

Commit/push únicamente a `staging`.

Al terminar, detenerse. No desplegar Vercel ni iniciar Bloque 7.
