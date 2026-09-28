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

- La selección de partidos que califican (≥3 miembros activos en `played_at`, `validated`, revisión vigente) debe salir de **un único helper SQL interno** compartido con `get_group_competition_data` (evita dos criterios que diverjan). Refactorizar esa función existente obliga a re-correr su verify de Fase A; alternativa de menor riesgo: helper nuevo y dejar Fase A intacta hasta después.
- **Actividad significativa** = `max(` `groups.created_at`, último momento oficial de un partido que **califica** al grupo, último `group_events` de tipo `member_added` `)`. Nada más (renombre, foto, admin y bajas **no** mueven el orden; un partido que no califica tampoco). Momento oficial del partido = `max(match_level_results.computed_at)` del resultado `applied` (cubre validación **y** corrección aceptada; se crea aun con `eligible=false`), con `matches.validated_at` de respaldo. No hace falta columna ni evento nuevo, pero hay que **probarlo** (ver riesgos). Desempate: `created_at` desc, luego `group_id`.
- Costo: parte de `group_memberships`→`match_participants` (índice `player_id` existente) → `matches`; adecuado para el volumen del piloto (cientos de usuarios).

### Frontend — reutiliza casi todo
- Nueva vista lobby; `openGroupsScreen` pasa a abrirla (siempre, incluso con 1 grupo); tarjeta → detalle actual (`renderGroupsScreen` intacto); volver del detalle → lobby. El selector actual no se toca.
- Una función pura nueva en `groups.js` (`buildLobbyCardSummary(table, myPlayerId, memberCount)`) que **solo formatea** lo que ya devuelve `computeWeeklyTable`: filas visibles, medallas por **número de posición real** (1,1,3 → 🥇🥇🥉), compresión de empate en la punta, línea "Vos · #n · pts" solo si quedo fuera, y el estado. Identidades: un solo `get_players_compact` batch solo para las filas visibles + yo.
- Reglas de la tarjeta (propuestas, consistentes con `Grupos_BRAMU.md` §10.1): solo filas con puntos > 0 compiten por el podio; si >3 filas comparten la punta → "N jugadores comparten la punta · X pts"; un 0 pts nunca se presenta como "punta".
- **Estados** (dato importante): un partido cuenta con ≥3 de 4 miembros, así que un grupo de **1–2 miembros no puede sumar** por regla. Copy positivo y honesto: 1 miembro → "Sumá jugadores para empezar"; 2 → "Con 3 jugadores del grupo en un partido arranca la competencia"; ≥3 sin partidos → "Esta semana todavía no hay partidos". No prometer partidos que no pueden contar.
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

1. **Timestamp de corrección**: asumir que toda corrección oficial aceptada crea un `applied` nuevo; hay que demostrarlo en el verify (validación, corrección, partido que no califica no mueve).
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

Ninguna bloqueante. Dos a confirmar por Producto (con recomendación ya incluida):
- **Qué mueve el orden**: creación, partido/corrección oficial que califica y alta de miembro; **no** renombre, foto, admin ni bajas.
- **Copy de grupos de 1–2 miembros**: el lobby debe reconocer que, por la regla 3 de 4, no pueden sumar todavía (redacción propuesta arriba).
