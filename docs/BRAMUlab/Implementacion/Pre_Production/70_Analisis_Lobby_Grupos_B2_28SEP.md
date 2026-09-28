# Análisis — Lobby de Grupos BRAMU (B2)

**Fecha:** 28/09/2026 · **Handoff:** `69_Handoff_Analisis_Lobby_Grupos_B2_28SEP.md` · **Solo análisis:** sin código, migraciones, bundle ni deploy. B1 (`68_…`) sigue pendiente de QA real y no se modifica.

## 1. Factibilidad

**Factible y acotado.** Toda la verdad deportiva ya existe (Fase A + `groups.js`). Faltan dos cosas que los contratos actuales no dan: **(a)** un timestamp autoritativo de actividad para ordenar y **(b)** un modo barato de leer varios grupos a la vez. La foto es lo único que toca Storage.

- Con solo contratos actuales el top semanal sale con `get_group_competition_data(group, p_from=lunes)` por grupo (N llamadas paralelas, payload chico), pero **el orden por actividad no es calculable** desde el cliente (solo vería partidos de la semana). Por eso conviene una lectura resumida.
- El motor no se duplica: el servidor devuelve **datos**, el mismo `PG.computeWeeklyTable` calcula posiciones/empates.

## 2. Solución mínima recomendada

### Backend — una RPC nueva, sin tocar Fase A
`get_groups_lobby(p_week_from timestamptz, p_week_to timestamptz)` (SECURITY DEFINER, solo `authenticated`, rate limit propio). Por cada grupo activo donde soy miembro activo devuelve, ya ordenado:

`groupId, name, activeMemberCount, isAdmin, lastActivityAt, members[{playerId,isActive,isAdmin,periods}]` + `weekMatches[]` con la **misma forma normalizada** que `get_group_competition_data` (sets, ganador, players con `levelBefore`) limitada a la semana.

- La selección de partidos que califican (≥3 miembros activos en `played_at`, `validated`, revisión vigente) debe salir de **un único helper SQL interno** compartido por `get_group_competition_data` y el lobby. No dejar dos copias de ese criterio. La implementación deberá refactorizar la lectura vigente preservando exactamente su contrato y volver a correr el verify de Fase A.
- **Actividad significativa** respeta la decisión de producto ya cerrada en `Grupos_BRAMU.md`: partido oficial/computable que entra al grupo; corrección oficial aceptada que cambia su verdad/puntos; alta, baja o reingreso de miembro; promoción/democión de admin; cambio de nombre; cambio de foto; creación. Un partido que no califica para el grupo no mueve el orden.
- Para mutaciones del grupo, reutilizar `group_events.occurred_at`: hoy ya existen `created`, `renamed`, `member_added`, `member_removed`, `admin_promoted` y `admin_demoted`; al incorporar foto, agregar un evento `photo_changed`. Para actividad deportiva, usar la bitácora oficial `match_actions.occurred_at` de `validated` y `correction_accepted`, verificando además que el partido califique para ese grupo. Esto evita acoplar el orden del lobby a `match_level_results`/Nivel. Desempate estable: `created_at` desc y luego `group_id`.
- Costo: parte de `group_memberships`→`match_participants` (índice `player_id` existente) → `matches`; adecuado para el volumen del piloto (cientos de usuarios).

### Frontend — reutiliza casi todo
- Nueva vista lobby; `openGroupsScreen` pasa a abrirla (siempre, incluso con 1 grupo); tarjeta → detalle actual (`renderGroupsScreen` intacto); volver del detalle → lobby. El selector actual no se toca.
- Una función pura nueva en `groups.js` (`buildLobbyCardSummary(table, myPlayerId, memberCount)`) que **solo formatea** lo que ya devuelve `computeWeeklyTable`: filas visibles, medallas por **número de posición real** (1,1,3 → 🥇🥇🥉), compresión de empate en la punta, línea "Vos · #n · pts" solo si quedo fuera, y el estado. Identidades: un solo `get_players_compact` batch solo para las filas visibles + yo.
- Reglas de la tarjeta (propuestas, consistentes con `Grupos_BRAMU.md` §10.1): solo filas con puntos > 0 compiten por el podio; si >3 filas comparten la punta → "N jugadores comparten la punta · X pts"; un 0 pts nunca se presenta como "punta".
- **Estados**: no son una decisión abierta; usar la dirección ya cerrada en `Grupos_BRAMU.md`. 1 miembro → **“El grupo ya existe. Ahora falta la banda.” / “Con 3 jugadores activos empieza la competencia.”** 2 miembros → **“Ya son 2. Falta uno para empezar a sumar.” / “Con 3 jugadores activos arranca la competencia.”** ≥3 sin partidos contables esta semana → **“Esta semana están todos vagos 😴” / “¿Cuándo se arma partido?”**. Nunca insinuar puntos con menos de 3 miembros.
- El estado cero reutiliza la **misma tarjeta** con datos de ejemplo marcados EJEMPLO (nunca mezclados con reales).

### Foto (mínimo compatible con Storage)
**Reusar el bucket `avatars` no sirve**: sus políticas exigen carpeta = `player_id` del que sube (un segundo admin no podría reemplazar/borrar), y `Auth.removeAvatarFiles(playerId)` borra **toda** la carpeta del jugador antes de subir su avatar personal — eliminaría la foto del grupo. Recomendado: **un bucket privado `group-avatars`** (mismos límites 2 MB jpeg/png/webp), ruta `{group_id}/{timestamp}.jpg`, políticas de insert/update/delete solo para **admins activos** del grupo y select para **miembros activos** (vía helper SECURITY DEFINER), más `groups.photo_path` y una RPC `set_group_photo(group_id, path|null)` que valida admin y que la ruta empiece con el `group_id` propio (regex anclada, lección del avatar). Lectura por URL firmada en batch (`resolveAvatarUrlsBatch` generalizado al bucket). Fallback: iniciales del nombre (ya existe `playerInitials`). Reutiliza el downscale de imagen de Perfil. La foto **no interviene en el orden**.

## 3. Impacto exacto

| Área | Cambio |
|---|---|
| Backend lobby | 1 migración: helper de partidos que califican + `get_groups_lobby` + su verify SQL |
| Backend foto | 1 migración aparte: bucket + políticas + `groups.photo_path` + `set_group_photo` (+ exponer `photoPath` en el lobby/detalle) |
| `auth.js` | `getGroupsLobby`, `setGroupPhoto`, firma en batch para el bucket nuevo |
| `groups.js` | `buildLobbyCardSummary` (puro), adaptador del payload del lobby |
| `app.js` | vista/orquestación del lobby; redirigir `openGroupsScreen`; back del detalle; tras crear/eliminar volver al lobby; UI de foto en Configuración |
| `index.html`/`styles.css` | sección del lobby y clases de tarjeta (mismos tokens, sin estética nueva); `showView`/bottom-nav conocen la vista nueva |
| No tocar | detalle del grupo, selector, motor de puntos, `list_my_groups`/`get_group_detail`/`get_group_competition_data`, Nivel/Ranking, B1 |

## 4. Riesgos reales

1. **Timestamp de actividad deportiva**: validar que `match_actions` emite `validated` y `correction_accepted` en todos los caminos oficiales relevantes y que el lobby solo los considera cuando el partido califica para ese grupo. Probar validación inicial, corrección aceptada y partido que no califica.
2. **Semana/zona horaria**: el cliente manda el lunes local 00:00 (igual que el motor hoy); un desfase mueve partidos de borde entre semanas. Mismo criterio que B1, pero ahora en el servidor por filtro.
3. **Divergencia de criterio** si el filtro "califica" se copia en vez de compartirse (por eso el helper único).
4. **Foto**: conflicto con `removeAvatarFiles` si se reutilizara `avatars`; URLs firmadas vencen a 24 h (se resuelven en cada apertura, no se persisten); admin que sale deja archivos huérfanos (limpieza al subir/quitar).
5. **B1 sin QA**: el lobby se apoya en el cache/refresh de B1 (`groupsServer`); conviene no mezclar cambios hasta que B1 pase QA, o al menos no editar sus funciones.
6. **Navegación**: `groups-back-btn` hoy vuelve al Home; el perfil público abre `'groups'` (debe seguir volviendo al detalle); nav inferior activa en ambas vistas; refrescar al volver sin parpadeo.
7. **Escala**: payload crece con N grupos × miembros × períodos; irrelevante en el piloto, revisar si aparecen usuarios con muchos grupos.

## 5. Plan recomendado para B2 (mínimo de deploys)

- **B2a — Backend lobby** (sin frontend, sin deploy de app): migración + verify (actividad, empates de datos, corrección, no-califica, 1/2/3 miembros, permisos). Central aplica en Staging.
- **B2b — Lobby + estado cero** (un deploy): vista, tarjeta con iniciales (sin foto), orden, navegación, EJEMPLO con la misma tarjeta, y el resto de B2 de `Grupos_BRAMU.md` (Cómo funciona, header, "Tu grupo está listo", CTA). Tests focales: `buildLobbyCardSummary` (1,1,3 / compresión / "Vos" solo fuera / estados 1-2-≥3 miembros y sin partidos), misma tabla que el detalle para la misma semana (sin fórmula duplicada), orden, guardas estáticas de navegación y de no-localStorage.
- **B2c — Foto de grupo** (un deploy + migración): bucket/políticas/RPC + UI en Configuración; el lobby ya muestra iniciales, así que la foto entra sin rediseño.

Cada parte se puede cortar o posponer sin afectar a las otras.

## 6. Decisiones abiertas

**Ninguna.**

Producto ya cerró:
- qué eventos mueven el orden del lobby;
- estados y tono para 1 miembro, 2 miembros y semana sin partidos;
- lobby incluso con un solo grupo;
- foto opcional editable por admins;
- selector actual conservado dentro del detalle;
- detalle del grupo sin rediseño.

Si durante implementación aparece una limitación técnica real que obligue a cambiar alguna de esas decisiones, detener únicamente ese punto y elevarlo a Central.


## Revisión Central

Central revisó este análisis antes de autorizar implementación. Se corrigieron dos reaperturas innecesarias de decisiones ya cerradas por Producto y se desacopló el criterio de actividad deportiva del sistema de Nivel.

**Conclusión:** la arquitectura propuesta es viable. La dirección recomendada es una lectura resumida server-backed para el lobby, mismo motor `groups.js` para calcular la tabla semanal, `group_events` + bitácora oficial de partidos para ordenar actividad y bucket privado separado para fotos de grupo.

**No implementar B2 todavía:** primero debe cerrarse el QA real multiusuario pendiente de B1. Después avanzar B2a → B2b → B2c.


### Observación visual para B2 — validación del formulario Crear grupo

QA real mostró que el error por nombre vacío aparece como texto rojo suelto al pie del listado, demasiado cerca del CTA y con jerarquía visual pobre.

En B2, **FUSIONAR** esa validación con el propio campo `Nombre del grupo` (mensaje inline/estado de campo) o una solución equivalente del sistema visual vigente. No crear un sistema de errores nuevo ni tocar la lógica de validación; es solo presentación.
