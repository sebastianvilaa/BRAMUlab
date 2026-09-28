# Handoff — Grupos BRAMU · Fase B1 — Wiring server-backed sin rediseño

**Fecha:** 28/09/2026  
**Entorno:** únicamente staging  
**Baseline visual:** BRAMUlab V04.11 / bundle 04.11-h27  
**Backend:** Fase A cerrada en Staging — ver `66_Resultado_Grupos_Fase_A_Backend_Compartido_28SEP.md`

## Objetivo

Conectar la experiencia ACTUAL de Grupos BRAMU al backend compartido ya validado, preservando la UI y la lógica de producto que hoy funcionan.

Esta fase es de **wiring**, no de diseño.

Al terminar, dos miembros del mismo grupo deben ver la misma verdad desde cuentas/dispositivos distintos.

---

## Leer

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Grupos_BRAMU.md`
4. `docs/BRAMUlab/Implementacion/Pre_Production/66_Resultado_Grupos_Fase_A_Backend_Compartido_28SEP.md`
5. este handoff

Inspeccionar únicamente:
- `bramulab/groups.js`
- bloque Grupos de `bramulab/app.js`
- bloque Grupos de `bramulab/store.js`
- patrón de clientes RPC vigente (`auth.js`, `matches.js` o equivalente)
- markup/estilos de Grupos solo para no romper selectores/eventos actuales.

No leer Archivo/Backup. No rediseñar.

---

# Regla principal

## NO TOCAR VISUALMENTE

Preservar tal como está la experiencia del grupo armado:

- selector de grupo;
- sheet MIS GRUPOS;
- contador de jugadores;
- tabs horizontales;
- ESTA SEMANA / SEMANA PASADA / RACE;
- tabla y jerarquía;
- empates;
- BRAMU Intelligence grupal;
- gear/configuración;
- rename inline;
- múltiples admins;
- quitar miembro;
- eliminar grupo;
- acceso a perfil desde filas;
- shells/cards/tipografía/sistema visual;
- bottom nav Mis grupos.

No implementar todavía:
- nuevo estado cero;
- preview EJEMPLO;
- “Cómo funciona” nuevo;
- “Tu grupo está listo”;
- cambio de header;
- cambio visual de CTA Agregar jugador.

Eso será Fase B2 después del QA multiusuario.

---

# AGREGAR

## 1. Cliente server-backed de Grupos

Crear un cliente pequeño siguiendo los patrones existentes, sin lógica deportiva duplicada, para consumir:

- `list_my_groups`
- `get_group_detail`
- `create_group`
- `rename_group`
- `add_group_member`
- `remove_group_member`
- `promote_group_admin`
- `demote_group_admin`
- `delete_group`
- `get_group_competition_data`

No exponer service-role.

Mapear errores de negocio a resultados controlables por UI; no inventar toasts técnicos.

## 2. Adaptador de datos

La UI actual consume una forma legacy aproximada:

`{ id, name, createdAt, createdBy, members:[{name,userId,isAdmin,periods}] }`

Crear una adaptación única desde el contrato server-backed:

- `groupId -> id`
- `playerId -> userId` SOLO como compatibilidad interna con la forma actual;
- `periods` preservados exactamente;
- nombres/username/avatar/Nivel visual resueltos por `player_id` usando `get_players_compact` en batch, nunca por nombre;
- iniciales como fallback cuando no hay avatar.

No persistir esta forma adaptada como nueva autoridad local.

## 3. Fuente deportiva compartida

Para tabla/Race/Intelligence grupal, dejar de alimentar el motor con el historial personal local.

Usar `get_group_competition_data`.

Adaptar el shape recibido al motor existente:

- participantes por player_id;
- fecha jugada;
- sets;
- ganador;
- membresía histórica.

### Bonus Sorpresa

**REEMPLAZAR únicamente la fuente de Nivel del bonus:**

En camino server-backed, usar `players[].levelBefore` entregado por el contrato.

- si ambos jugadores de ambas parejas tienen Nivel histórico oficial suficiente, calcular el promedio y aplicar el umbral existente de 0,5;
- si falta cualquier evidencia necesaria para comparar de forma válida, Sorpresa = false;
- nunca usar `computeSimulatedLevelBeforeMatch`, Nivel actual ni estimador legacy en camino server-backed.

Preservar Remontada, Victoria clara, base 5, máximo +2, top 3, empates y Race.

Puede mantenerse compatibilidad legacy pura para tests/dev si no invade el camino productivo.

---

# FUSIONAR — CRUD actual

Reemplazar en el camino server-backed las llamadas actuales de `Store.createGroup/renameGroup/addGroupMember/... ` por los contratos del backend.

La interacción visible debe seguir siendo la misma.

Casos:

- crear grupo → servidor → refrescar verdad compartida;
- renombrar → servidor → refrescar;
- agregar/quitar miembro → servidor → refrescar;
- promover/demover admin → servidor → refrescar;
- eliminar → servidor → salir del grupo y refrescar lista.

No confiar en el guardrail local de último admin como autoridad; puede conservarse para feedback visual, pero el servidor decide.

---

# Autoridad / estado local

En Staging server-backed:

- `localStorage` NO puede decidir qué grupos existen;
- no fusionar silenciosamente grupos locales viejos con los server-backed;
- no migrar automáticamente QA local;
- un grupo local legacy no debe aparecer como si fuera verdad compartida productiva.

Se permite cache efímera/local solo para:
- último grupo seleccionado;
- loading/UI;
- datos que puedan descartarse y reconstruirse desde servidor.

La selección de `activeGroupId` puede conservarse local si no actúa como autoridad.

---

# Async / UX técnica

Como la UI actual era síncrona:

- agregar loading discreto sin rediseñar;
- evitar doble submit;
- ante error de red conservar la pantalla estable;
- no borrar/alterar localmente una membresía antes de éxito server-side;
- respuestas tardías no deben pintar otro grupo si el usuario cambió de grupo/pantalla;
- refresh debe ser focal y no disparar cascadas redundantes.

No convertir esto en un framework/state manager nuevo.

---

# NO HACER

- no cambiar CSS salvo ajuste estrictamente técnico necesario para hidden/loading ya existente;
- no tocar diseño del grupo armado;
- no hacer Fase B2;
- no cambiar fórmula deportiva salvo fuente de `levelBefore`;
- no duplicar puntos/Race en SQL;
- no crear invitaciones/notificaciones;
- no agregar self-service nuevo no presente en UI;
- no tocar Nivel/Ranking;
- no tocar main, Production ni BRAMUlive.

---

# Pruebas focales

Automatizadas donde sea útil:

1. adapter grupo server -> forma UI conserva períodos/admins/player_id;
2. Sorpresa server-backed usa solo `levelBefore`;
3. falta de Level oficial => no Sorpresa;
4. 5/6/7 puntos, nunca 8;
5. top 3/Race/empates sin regresión;
6. CRUD llama al contrato correcto y no guarda autoridad en localStorage;
7. respuesta tardía/cambio de grupo no pisa pantalla si se implementa request guard.

No rehacer suite visual completa.

## QA real posterior (NO declarar PASS visual por tests)

Central/Sebastián probarán en Staging:

- Seba crea grupo con Esteban;
- Esteban entra con su cuenta y ve el mismo grupo;
- nombre/miembros/admin cambian para ambos;
- no-admin no puede administrar;
- ambos ven la misma tabla/Race;
- recarga/cierre de sesión conserva verdad;
- no reaparecen grupos locales como productivos;
- visual del grupo armado sigue igual.

---

# Salida

Al terminar:

1. tests pertinentes;
2. diff revisado;
3. commit lógico;
4. push `origin/staging`;
5. resultado corto en `docs/BRAMUlab/Implementacion/Pre_Production/`.

No iniciar Fase B2.

Si aparece una decisión humana nueva, marcar `DECISIÓN ABIERTA` y continuar lo no bloqueado.
