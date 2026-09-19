# Backend Bloque 4 — Handoff de inicio
## Jugadores, búsqueda e invitados provisionales

**Fecha:** 19/09/2026  
**Rama:** `staging`  
**HEAD de partida:** `2f3b0da7` o superior  
**Estado:** autorizado para ANÁLISIS / PLANIFICACIÓN. No implementar todavía sin revisión.

---

## 1. Punto de partida

Backend Bloques 1, 2 y 3 están **CERRADOS** en Staging.

Bloque 3 cerró con:
- signup/perfil mínimo/OTP reales;
- Nivel inicial universal `nivel_inicial_v1_2`;
- caminos rápido y completo;
- confirmación final y anticipada;
- refresh/reanudación;
- persistencia server-side;
- paridad navegador ↔ Edge Function;
- verificación automática final:
  - `verify-bloque2.mjs` → OK
  - `verify-bloque3.mjs` → OK
  - `verify-nivel-parity.mjs` → OK

Cierre:
`docs/BRAMUlab/Implementacion/Backend/Bloque_03/12_Cierre_Bloque_03.md`

NO reabrir Bloques 1–3 salvo regresión concreta.

---

## 2. Fuentes maestras que hay que leer

Antes de proponer implementación:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Backend_Infraestructura.md`
   - §6.1 Cuenta e identidad
   - §6.2 Identidad provisional e invitación
   - §8.4 Buscar jugadores
   - §9 Invitados e identidades provisionales
   - §10 Permisos y seguridad mínima
   - §15 Bloque 4
3. `docs/BRAMUlab/Experiencia_Inicial.md`
   - §3.2.E Buscar jugadores
   - §15 Invitados, identidades provisionales y reclamo de actividad
   - casos límite relacionados con provisional/claim

No usar `Archivo/` ni documentos históricos como fuente normativa salvo contradicción concreta que no pueda resolverse con las fuentes anteriores.

---

## 3. Alcance CONFIRMADO de Bloque 4

Debe incluir:

- búsqueda real de jugadores registrados;
- resultados por `@usuario`, display name, nombre o apellido;
- información deportiva pública mínima;
- consumo de Nivel público real del Bloque 3;
- creación de `player` provisional persistente;
- reutilización de la misma identidad provisional;
- recientes / red relacionada cuando exista una relación real disponible;
- provisional fuera de búsqueda global;
- link de invitación/reclamo por identidad provisional;
- token de alta entropía, hash server-side, expiración/rotación y un solo uso;
- reclamar exige login o registro;
- claim atómico;
- el claim conserva el mismo `player_id`, por lo que cualquier historial futuro/presente referenciado a ese ID queda asociado a la cuenta reclamante;
- si un partido sigue pendiente y vigente, el usuario reclamante debe adquirir capacidad de actuar por la pareja correspondiente cuando Bloques 5–6 consuman esta identidad;
- nombres iguales NUNCA se fusionan automáticamente;
- duplicados excepcionales / reclamo de una segunda identidad se resuelven manualmente durante el piloto;
- RLS deny-by-default y pruebas permitidas/prohibidas;
- búsqueda y claims con validación/rate limiting razonable.

---

## 4. Fuera de alcance de Bloque 4

NO implementar todavía:

- modelo completo de partidos compartidos / `matches` — Bloque 5;
- flujo completo `Confirmar / Proponer corrección / No participé` — Bloque 6;
- Ranking real — Bloque 7;
- Intelligence — Bloque 8;
- fusiones autoservicio complejas;
- matching automático por nombre/apodo;
- detección automática de duplicados;
- marcador en vivo / BRAMUlive;
- mocks nuevos para simular backend productivo.

Bloque 4 puede preparar contratos que Bloques 5–6 consuman, pero no debe adelantarlos.

---

## 5. Estado actual que hay que auditar

### Backend existente

`public.players` ya existe con:
- `player_id`;
- `type = registered | provisional`;
- `auth_user_id`;
- `display_name`;
- `is_active`;
- `created_by_player_id`;
- timestamps.

`public.profiles` ya existe 1:1 para jugadores registrados.

Actualmente Bloque 2 dejó la lectura de perfiles ajenos cerrada; Bloque 4 es el bloque que debe habilitar **solo la superficie pública necesaria** sin exponer email, fecha de nacimiento, género personal, auth IDs ni otros datos privados.

### Frontend existente

`BUSCAR JUGADORES` ya existe visualmente, pero hoy `renderPlayerSearchResults()` arma el universo desde datos locales:

- `Store.loadHistory()`;
- `Store.loadPlayerNames()`;
- `ML.buildJugadorDirectory(...)`;
- `ML.computeRecentPlayers(...)`.

Eso es prototipo/local y debe dejar de ser autoridad para cuentas `serverBacked`.

La carga manual actual también permite agregar un nombre libre a la lista local. Bloque 4 debe auditar cómo transformar esa idea en una identidad provisional persistente **sin adelantar la persistencia completa del partido de Bloque 5**.

La recomendación inicial es no duplicar UI si la existente puede adaptarse limpiamente.

---

## 6. Problemas de diseño/arquitectura que el análisis debe resolver

### A. Búsqueda pública segura

Definir la mínima superficie server-side para buscar usuarios registrados autenticados.

Debe decidir:
- RPC / vista / función adecuada;
- campos exactos devueltos;
- normalización y búsqueda parcial;
- exclusión del propio usuario si corresponde;
- límite/paginación simple;
- protección frente a enumeración masiva;
- cómo traer Nivel público sin abrir `level_states` completo;
- cómo mantener RLS deny-by-default.

No abrir `profiles` completo a todos los autenticados si una vista/RPC pública acotada es más segura.

### B. Identidad provisional

Definir comando server-side para:
- crear provisional;
- reutilizar uno ya relacionado/creado;
- impedir que el cliente pueda fabricar relaciones con provisionales ajenos;
- no fusionar por nombre;
- mantener UUID estable.

Debe quedar claro qué significa "relacionado" antes de existir `matches` reales de Bloque 5. Evitar inventar una tabla de red social si no es necesaria.

### C. Claim de provisional

Definir:
- esquema físico de `provisional_claims`;
- generación segura del token;
- almacenamiento solo de hash;
- expiración y rotación;
- un solo uso;
- consumo autenticado;
- carrera de dos intentos simultáneos;
- qué ocurre si el provisional ya fue reclamado;
- qué ocurre si una cuenta ya está asociada a otro `player_id`;
- cómo preservar el mismo `player_id` sin romper las restricciones actuales `players.auth_user_id unique`.

### D. Entrada mediante link

La persona puede:
- ya tener sesión;
- necesitar iniciar sesión;
- necesitar registrarse.

El análisis debe proponer el flujo mínimo para conservar el token durante Auth/onboarding sin convertir Bloque 4 en un rediseño del signup de Bloque 3.

### E. Recientes / red

No crear mocks ni una infraestructura social paralela.

Analizar qué puede quedar genuinamente operativo en Bloque 4 con los datos actuales y qué parte solo puede encenderse cuando Bloque 5 tenga partidos reales.

Si una parte del criterio de Bloque 4 depende físicamente de `matches`, explicitarla como contrato preparado + validación definitiva en Bloque 5, en vez de inventar datos.

---

## 7. Pregunta de producto todavía ABIERTA

La documentación exige expiración/rotación del token de claim, pero no fija una duración exacta.

NO elegir arbitrariamente el plazo dentro del código.

El análisis debe recomendar un valor simple para el piloto y explicar brevemente la implicancia UX/seguridad. La decisión final queda para revisión antes de implementar.

---

## 8. Lo que quiero de Claude Code en esta primera ronda

NO IMPLEMENTAR todavía.

Entregar un análisis concreto que incluya:

1. estado del código actual relevante;
2. propuesta de arquitectura mínima para Bloque 4;
3. tablas/columnas/índices/RPCs/Edge Functions estrictamente necesarias;
4. políticas RLS y límites de datos públicos;
5. integración mínima con la UI existente;
6. estrategia para provisionales y claim;
7. qué puede validarse en Bloque 4 sin partidos reales y qué debe quedar como contrato para Bloque 5;
8. riesgos/regresiones sobre Bloques 1–3;
9. tests automáticos necesarios;
10. prueba manual de Staging propuesta;
11. cualquier contradicción real de las fuentes maestras;
12. recomendación sobre duración del token de claim.

No modificar archivos, migraciones, Supabase, Vercel ni código en esta ronda.

Al terminar, guardar el informe en:

`docs/BRAMUlab/Implementacion/Backend/Bloque_04/02_Analisis_Claude.md`

y responder únicamente con:
- ruta del informe;
- resumen de 5–10 líneas;
- decisiones que necesitan aprobación antes de implementar.
