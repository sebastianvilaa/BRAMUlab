# Backend Bloque 4 — Revisión ChatGPT del análisis de Claude
## Jugadores, búsqueda e invitados provisionales

**Fecha:** 20/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `78df798`  
**Estado:** arquitectura aprobada **con ajustes obligatorios antes de implementar**.

---

## 1. Conclusión general

La dirección propuesta por Claude es correcta:

- RPCs `SECURITY DEFINER` en vez de abrir tablas completas;
- sin Edge Functions nuevas;
- búsqueda global solo de cuentas registradas;
- provisional persistente con `player_id` estable;
- claim explícito, autenticado, atómico y de un solo uso;
- claim integrado al flujo de Auth sin reabrir el motor de Nivel;
- Recientes/red sin datos inventados hasta que existan partidos reales.

Sin embargo, hay cuatro correcciones de diseño que deben incorporarse antes de escribir la migración:

1. **no reutilizar provisionales automáticamente por nombre**, ni siquiera dentro del mismo creador;
2. **no agregar una policy de SELECT directo sobre `players` para provisionales creadas por el usuario**;
3. **preservar/reasignar `pilot_events` durante el claim en vez de borrarlos**;
4. **sí implementar rate limiting server-side mínimo** para búsqueda/claims, porque la fuente maestra lo exige explícitamente.

---

## 2. Decisiones cerradas para implementación

### Decisión 1 — duración del token de claim

**APROBADO: 30 días.**

Reglas:

- `expires_at = created_at + 30 días`;
- el creador puede rotar/regenerar el link;
- rotar invalida el token pendiente anterior;
- claim exitoso invalida definitivamente el token;
- token vencido/usado/revocado nunca se reactiva.

Es un plazo adecuado al uso social del piloto sin convertir una invitación en un flujo de recuperación de contraseña.

### Decisión 2 — bootstrap durante el claim

**APROBADO: duplicación mínima dentro de `claim_provisional_player`.**

No extraer un helper compartido ni modificar `handle_email_confirmed` de Bloque 3.

El claim debe crear para el `player_id` provisional adoptado las filas mínimas equivalentes:

- `profiles` vacío;
- `level_states` en `PENDIENTE`.

El flujo correcto para una cuenta nueva que llega desde un link es:

1. completar Perfil/Nivel como borrador local normal de Bloque 3;
2. confirmar email / obtener sesión real;
3. **antes de `complete_profile` y de oficializar Nivel**, consumir el claim;
4. adoptar el `player_id` provisional;
5. continuar `runOfficializeAndEnter()` normalmente sobre ese ID.

No decir que el claim ocurre antes de contestar Perfil/Nivel: esos datos pueden estar ya completados localmente. Lo importante es que ocurra **antes de persistir/oficializar el onboarding en servidor**.

### Decisión 3 — pgcrypto

**APROBADO. Además, Staging ya tiene `pgcrypto 1.3` instalada en el schema `extensions`.**

No hace falta una acción manual en Dashboard.

La migración puede conservar un `create extension if not exists pgcrypto with schema extensions` idempotente para que el futuro entorno de Producción sea reproducible.

### Decisión 4 — rate limiting

**NO se aprueba omitirlo.**

`Backend_Infraestructura.md` §10.4 pide explícitamente rate limiting para búsqueda y claims.

Implementar una protección mínima y genérica, sin infraestructura externa:

- una tabla server-only pequeña, por ejemplo `api_rate_limits`;
- cero policies de cliente;
- helper privado `consume_rate_limit(...)` usado dentro de las RPCs;
- clave por `player_id + action`;
- ventanas simples.

Valores iniciales recomendados para piloto:

- búsqueda: máximo **30 requests / 60 s** por jugador;
- crear/rotar link: máximo **10 / hora**;
- intentar consumir claim: máximo **10 / 15 min**.

Además, el frontend debe usar debounce de búsqueda (~300 ms), query mínima de 2 caracteres y límite duro server-side de resultados.

No hace falta Redis, Edge rate limiter ni infraestructura adicional.

### Decisión 5 — Recientes/red

**APROBADO.**

Para cuentas reales/server-backed:

- `Recientes` queda oculto/vacío hasta Bloque 5;
- no usar historial local como autoridad;
- no inventar red ni seeds;
- cuando existan partidos reales, Bloque 5 habilita esa fuente.

El camino local/legacy puede conservar su comportamiento actual mientras siga existiendo como fallback no productivo.

### Decisión 6 — pestaña JUGADORES y carga manual

**APROBADO con precisión de alcance.**

No rehacer todavía:

- `Store.loadAddedPlayers`;
- la pestaña histórica `JUGADORES`;
- el selector completo de participantes de `Cargar partido jugado`;
- el flujo local de “agregar jugador libre” como parte del partido.

La integración definitiva de selección/reutilización de provisionales dentro de una carga pertenece a Bloque 5.

Bloque 4 sí debe dejar listos y testeados los contratos backend de provisional + claim y la entrada por link.

---

## 3. Corrección obligatoria — nunca reutilizar provisional por nombre

La propuesta:

`create_or_reuse_provisional_player(p_display_name)`

no debe implementarse tal como está.

Incluso si el creador es el mismo, dos personas distintas pueden llamarse igual. Reutilizar automáticamente por:

`created_by_player_id + nombre normalizado`

viola la regla maestra:

> nombres iguales nunca se fusionan solos.

Contrato correcto:

- `create_provisional_player(p_display_name)` **siempre crea un nuevo UUID**;
- reutilizar una provisional existente requiere una selección explícita por `player_id`;
- en Bloque 5, cuando el usuario seleccione un invitado ya relacionado/creado, el partido reutilizará ese `player_id`;
- nunca inferir identidad por texto.

Los reintentos técnicos de una misma operación, si necesitan idempotencia, deben usar una clave de idempotencia explícita, no el nombre como clave.

---

## 4. Corrección obligatoria — no abrir SELECT directo de players

No agregar la policy propuesta:

`players_select_created_by_me`.

Motivo: una provisional reclamada conserva `created_by_player_id` pero pasa a tener `auth_user_id`. Una policy de SELECT sobre la tabla completa permitiría al creador leer columnas internas del jugador reclamado, incluido `auth_user_id`.

Mantener `players` cerrado salvo policies ya existentes.

Si hace falta listar provisionales creadas/relacionadas, hacerlo mediante una RPC acotada, por ejemplo:

- `list_my_provisional_players()`

que devuelva únicamente:

- `player_id`;
- `display_name`;
- timestamps/estado estrictamente necesarios;

y solo mientras `type='provisional'`.

Después del claim, esa identidad deja de aparecer por esa vía.

---

## 5. Corrección obligatoria — preservar pilot_events durante claim

Claude propuso borrar los `pilot_events` del player temporal P2 antes de eliminarlo.

No hacerlo.

En Staging, `pilot_events.player_id` referencia `players(player_id)` **sin ON DELETE CASCADE**, por lo que P2 no puede borrarse mientras conserve eventos.

Además, `signup_completed` es evidencia válida del alta y no debería perderse.

Durante la misma transacción del claim:

1. bloquear/validar claim;
2. validar que P2 todavía no tiene perfil oficializado;
3. reasignar `pilot_events.player_id` de P2 → P1;
4. eliminar P2 y sus filas vacías dependientes;
5. asociar el `auth_user_id` a P1 y cambiarlo a `registered`;
6. crear `profiles` + `level_states(PENDIENTE)` para P1;
7. marcar claim como consumido.

Agregar tests que confirmen que queda un solo player registrado y que el evento de signup sigue asociado al player adoptado.

---

## 6. Búsqueda y perfil público

Se aprueba:

- `search_players` autenticada;
- `get_public_profile` autenticada;
- query mínima;
- límite de resultados;
- columnas declaradas explícitamente;
- excluir provisionales;
- excluir datos privados;
- Nivel mostrado desde el valor oficial persistido.

Nunca devolver:

- email;
- `auth_user_id`;
- fecha de nacimiento;
- género personal;
- términos;
- token/hash de claim;
- `mu` interno sin formato público.

Para la UI server-backed, la identidad pasa a ser `player_id`, no nombre.

No adaptar la lógica nueva para seguir resolviendo cuentas reales por nombre.

---

## 7. Claim — política del piloto

Se mantiene la propuesta de Claude:

- nueva cuenta que llega por link puede auto-reclamar durante su onboarding, después de OTP y antes de persistir perfil/Nivel;
- una cuenta ya completa que intenta reclamar otra identidad provisional **no se fusiona automáticamente**;
- ese caso se deriva a resolución administrativa durante el piloto;
- un token no produce matching por nombre;
- carrera de dos claims simultáneos: solo uno puede ganar.

La UI debe explicar el caso de cuenta ya completa de forma sencilla, sin intentar construir una herramienta de fusión.

---

## 8. Qué implementar en esta ronda

Autorizado para Bloque 4:

- migración de `provisional_claims`;
- rate limiter mínimo server-side;
- RPCs de búsqueda/perfil público;
- RPC de creación de provisional sin deduplicación por nombre;
- RPC acotada para listar provisionales propias si realmente es necesaria para el flujo;
- RPC de crear/rotar claim;
- RPC de consumir claim;
- wrappers en `auth.js`;
- adaptación de Buscar jugadores / Perfil público para datos server-backed;
- persistencia del token de claim durante login/signup;
- claim después de OTP y antes de `runOfficializeAndEnter()`;
- tests `verify-bloque4.mjs`;
- regresión sin modificar de Bloques 2 y 3;
- documentación de implementación.

No autorizado todavía:

- partidos reales;
- historial compartido;
- validación/correcciones;
- Ranking real;
- Intelligence;
- sistema autoservicio de fusiones;
- red/recientes falsos;
- BRAMUlive.

---

## 9. Criterio de validación antes de cerrar Bloque 4

Automático:

- Bloque 2 OK;
- Bloque 3 OK;
- Bloque 4 OK;
- RLS/privacidad;
- búsqueda;
- provisionales con IDs distintos aun con mismo nombre;
- claim feliz;
- token expirado/usado;
- concurrencia;
- rate limits;
- signup event preservado;
- onboarding Nivel posterior al claim.

Manual en Staging:

- A busca a B real;
- A abre perfil real de B;
- respuesta no expone privados;
- provisional + link generado por flujo habilitado para prueba;
- link abierto en incógnito;
- signup + OTP;
- adopción del player provisional;
- Perfil/Nivel terminan normalmente;
- segundo uso del link falla;
- signup normal sin claim sigue igual.

**Con estas correcciones, Bloque 4 queda autorizado para implementación.**
