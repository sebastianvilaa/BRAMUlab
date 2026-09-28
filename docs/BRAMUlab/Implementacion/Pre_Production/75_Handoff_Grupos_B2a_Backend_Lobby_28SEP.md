# 75 — Handoff · Grupos B2a — Backend del lobby

**Fecha:** 28/09/2026  
**Rama:** `staging`  
**Estado previo:** Fase A + B1 server-backed **CERRADOS en Staging**.  
**Objetivo de esta ronda:** implementar únicamente el backend/contrato de lectura necesario para el lobby de Grupos. **Sin frontend y sin foto.**

## Fuentes obligatorias

Leer primero:
- `docs/BRAMUlab/README.md`
- `docs/BRAMUlab/Grupos_BRAMU.md`
- `docs/BRAMUlab/Pre_Production.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/70_Analisis_Lobby_Grupos_B2_28SEP.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/74_Cierre_Grupos_B1_28SEP.md`
- este handoff

Inspeccionar solo lo necesario del backend de Grupos y sus verifies.

No leer Archivo/Backup.  
No tocar `main`, Production ni BRAMUlive.

---

# 1. Alcance exacto

B2a debe dejar un contrato server-backed eficiente para que B2b pueda pintar el lobby sin hacer una cadena N+1 de lecturas por grupo.

Debe resolver:

1. lista de grupos activos del usuario;
2. nombre/identidad básica;
3. cantidad de miembros activos;
4. si el usuario actual es admin;
5. membresías/períodos suficientes para que el mismo motor `groups.js` calcule la semana;
6. partidos/candidatos de la semana en forma normalizada compatible con B1;
7. **actividad significativa autoritativa** para ordenar grupos.

No implementar todavía:
- vista lobby;
- estado cero;
- tarjeta;
- navegación;
- desglose de puntos;
- foto/avatar de grupo;
- Storage.

---

# 2. Regla crítica heredada de B1 — NO REGRESAR

La pertenencia deportiva de un alta/reingreso vale desde el **lunes de esa misma semana BRAMU**, no desde la hora exacta de `joined_at`.

Por lo tanto:

- no volver a usar como criterio final `joined_at <= played_at`;
- una alta posterior al partido dentro de la misma semana puede convertir ese partido en 3/4;
- nunca habilitar semanas anteriores;
- `joined_at/left_at` reales se conservan para auditoría.

Cualquier helper SQL nuevo que necesite decidir si un partido califica para actividad/lobby debe quedar alineado con esta semántica y con los casos ya cubiertos por B1.

**NO duplicar la fórmula de puntos en SQL.**  
Los puntos, top 3, bonus y posiciones siguen siendo autoridad de `groups.js`.

---

# 3. Contrato recomendado

Crear una RPC autenticada resumida, por ejemplo:

`get_groups_lobby(p_week_from timestamptz, p_week_to timestamptz)`

Nombre exacto puede adaptarse a convenciones existentes.

Por cada grupo activo donde el caller es miembro activo devolver como mínimo:

- `groupId`;
- `name`;
- `activeMemberCount`;
- `isAdmin`;
- `createdAt`;
- `lastActivityAt`;
- `members[]` con `playerId/isAdmin/periods`;
- `weekMatches[]` compatibles con el adaptador B1:
  - matchId;
  - playedAt;
  - winnerTeam;
  - sets;
  - players;
  - `levelBefore` oficial cuando exista.

No devolver nombres inventados. B2b resolverá identidades reales con el camino compacto ya existente.

El payload debe ser suficiente para que frontend use **el mismo `PG.computeWeeklyTable`** y no exista una segunda tabla calculada en SQL.

---

# 4. Actividad significativa — fuente autoritativa

`lastActivityAt` representa actividad del **grupo**, no del usuario actual.

Cuenta:

1. partido oficial/computable que entra al grupo;
2. corrección oficial aceptada que cambia la verdad/puntos de un partido que entra al grupo;
3. alta/baja/reingreso de miembro;
4. promoción/democión de admin;
5. rename;
6. creación;
7. foto se agregará en B2c mediante `photo_changed`, no ahora.

Usar:
- `group_events.occurred_at` para mutaciones del grupo;
- `match_actions.occurred_at` para `validated` y `correction_accepted`, solo si el partido califica para ese grupo.

Un partido que no cumple la regla del grupo **no mueve el orden**.

Desempate estable y no visible:
- `lastActivityAt DESC`;
- luego `createdAt DESC`;
- luego `groupId` determinístico.

No usar actividad personal del caller.

---

# 5. Helper compartido / evitar divergencias

El análisis 70 recomendó compartir el criterio de selección deportiva entre `get_group_competition_data` y el lobby.

Después de B1 hay una condición adicional: el backend de competencia usa un umbral de candidatos ampliado y `groups.js` aplica el piso semanal exacto.

Implementar el refactor mínimo que evite dos consultas divergentes **sin cambiar el contrato ya validado de B1**.

Opciones válidas:
- helper SQL interno de candidatos reutilizado por ambas RPCs + filtro deportivo exacto donde corresponda;
- otra extracción interna equivalente si preserva el mismo comportamiento.

No es válido:
- copiar/pegar dos versiones del 3/4;
- volver a la semántica pre-h30;
- calcular puntos/bonus en SQL.

---

# 6. Seguridad

Mantener patrón Fase A/B1:

- tablas server-only;
- RLS sin abrir lectura directa;
- RPC `SECURITY DEFINER` con `search_path` seguro;
- solo `authenticated`;
- caller resuelto desde `auth.uid()`;
- solo grupos donde el caller es miembro activo;
- sin filtrar secretos/PII;
- rate limit si el patrón actual lo requiere.

No ampliar grants de tablas.

---

# 7. Tests mínimos obligatorios

Backend/SQL:

1. usuario ve solo sus grupos activos;
2. 1/2/3+ miembros;
3. payload de membresías/períodos correcto;
4. semana devuelve candidatos suficientes para B1;
5. alta posterior dentro de la misma semana no excluye el partido;
6. alta de semana posterior no habilita una semana anterior;
7. partido 2/4 no produce actividad deportiva;
8. partido 3/4 sí produce actividad;
9. `validated` mueve `lastActivityAt`;
10. `correction_accepted` de partido calificable mueve actividad;
11. corrección/partido no calificable no mueve actividad;
12. member add/remove/reentry, admin, rename y creación mueven actividad;
13. orden final correcto con empate estable;
14. caller ajeno no obtiene el grupo;
15. verify previo de Fase A + B1 sigue PASS después del refactor.

Usar transacciones/rollback para fixtures.

---

# 8. No tocar

- UI actual del detalle;
- selector actual;
- motor `groups.js` salvo adaptador puro estrictamente necesario;
- fórmula de puntos;
- Nivel;
- Ranking;
- Intelligence general;
- C1-C4;
- desglose de puntos de B2b;
- foto de B2c.

---

# 9. Salida esperada

1. análisis corto de implementación;
2. migración B2a;
3. verify SQL B2a;
4. actualizar verify Fase A/B1 solo si el refactor lo exige;
5. tests focales;
6. diff review;
7. aplicar migración **solo en Supabase Staging**;
8. correr verify B2a + regresión Fase A/B1;
9. advisors después del DDL;
10. commit lógico + push `origin/staging`;
11. resultado corto en `docs/BRAMUlab/Implementacion/Pre_Production/`.

Como B2a no debe cambiar frontend, un deploy de BRAMUlab puede ser ignorado por Vercel y no es un problema.

No iniciar B2b ni B2c.

No declarar B2 completo. Central revisa B2a antes de habilitar B2b.
