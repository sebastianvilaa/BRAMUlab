# Backend Bloque 6 — Revisión central de Fase B

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**Claude Fase B revisada:** `983a6e838c950ac66ef6817fb26301e5607f67d6`  
**HEAD después de correcciones centrales:** `0a419586db0e4e41448267ad6326a18a432dc3a5`  
**Resultado:** **Fase B aceptada con 3 correcciones localizadas. Lista para QA real de navegador en Staging.**

## 1. Qué dejó Claude

La implementación de Claude conectó correctamente el frontend de BRAMUlab con el backend B6 ya validado:

- Confirmar;
- Proponer corrección;
- Responder corrección;
- No participé;
- resolución de identidad;
- Notificaciones server-backed;
- pendientes accionables en Home/Historial.

No tocó backend, migraciones ni Edge Functions.

Evidencia entregada por Claude:

- `match-level-engine.test.mjs` → **30/30 OK**;
- `tests.html` → **1448/1448 OK**;
- `node --check` limpio.

## 2. Correcciones encontradas por ChatGPT central

### F2-01 — acciones vencidas seguían visibles en UI

El backend ya protegía correctamente las ventanas:

- corrección normal: 3 días desde `validated_at`;
- identidad: 10 días desde `validated_at`.

Pero la UI seguía mostrando:

- `Proponer corrección` después de 3 días;
- `No participé` después de 10 días.

Al tocar, el servidor rechazaba la operación. La integridad no estaba comprometida, pero la UX ofrecía acciones que ya no existían.

**Corrección:**

- helper de ventana client-side usado solo para presentación;
- servidor sigue siendo autoridad final;
- acciones vencidas ya no se ofrecen;
- defensa adicional al enviar por si el estado cambió mientras la pantalla estaba abierta.

### F2-02 — vencimiento de identidad a 7 días no tenía camino de materialización desde la app

El backend implementa `forceUnidentified` pero no existe cron.

Claude conectó el endpoint, pero ningún flujo de UI lo invocaba. Resultado posible:

- issue físicamente `open`;
- deadline de 7 días vencido;
- notificación/tarea seguía abierta;
- slot nunca pasaba a `Jugador no identificado` salvo operación manual/administrativa.

**Corrección:**

Al abrir el detalle de un partido:

1. se leen los `openIdentityIssues`;
2. si alguno tiene `resolutionDeadlineAt` vencido;
3. la app llama al endpoint existente con `forceUnidentified:true`;
4. backend materializa el estado terminal atómicamente;
5. se refresca el partido.

No se agregó cron ni arquitectura nueva.

Además:

- slot NULL + issue open → `Por identificar`;
- slot NULL + sin issue open en detalle completo → `Jugador no identificado`.

### F2-03 — el bundle nuevo podía no llegar por Service Worker

Claude agregó `match-validation.js` a `index.html`, pero:

- no estaba en `CORE_ASSETS` de `sw.js`;
- el bundle seguía en `04.10-h15`;
- `CACHE_NAME` también seguía h15.

Un navegador que ya tenía h15 podía continuar sirviendo assets viejos y no cargar el wiring B6 nuevo.

**Corrección:**

- bundle técnico → **04.10-h16**;
- `CACHE_NAME` → h16;
- todas las query strings propias de `index.html` → h16;
- `match-validation.js?v=04.10-h16` agregado al precache.

La versión humana sigue siendo **BRAMUlab V04.10**.

## 3. Coherencia de estadísticas durante identidad cuestionada

Alineado además con el comportamiento server-side:

- un partido validated con identidad cuestionada sigue visible como registro oficial;
- mientras el issue está open, no alimenta derivados personales que dependen de saber quién jugó:
  - Efectividad;
  - Evolución;
  - compañeros/rivales;
  - agregaciones equivalentes.

El backend ya revierte/suspende el efecto de Nivel al abrir la incidencia.

Cuando la identidad se resuelve o queda terminal, el partido vuelve a evaluarse según su estado oficial vigente.

## 4. Estado

**Fase B frontend/wiring: VERDE para QA real.**

Todavía NO cerrar Bloque 6 antes de probar en navegador real:

- autoridad por pareja;
- corrección;
- identidad;
- notificaciones;
- refresh visual;
- bundle h16 real.

No iniciar Bloque 7 todavía.
