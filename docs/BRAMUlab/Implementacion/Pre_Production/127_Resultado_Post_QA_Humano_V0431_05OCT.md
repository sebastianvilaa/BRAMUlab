# 127 — Resultado · Ronda post QA humano (V04.31)

**Fecha:** 05/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.31** · bundle **04.31-h1** · **Base:** `0397b06` · **HEAD final:** el commit de esta ronda (`git log -1`; el hash se informa al cerrar).
**Fuente de alcance:** handoff `126_Handoff_Post_QA_Humano_V0430_05OCT.md` + Issue #29. **No se tocó** `main`, Production, BRAMUlive, Nivel, Ranking publicado, Grupos ni Legal; B1/B2/B3/C1/C2 y la deduplicación V04.29 no se modificaron.
**Estado:** implementado y probado **localmente**. La migración **no está aplicada** a Staging y la Edge `get-match-intelligence` **debe redeployarse** (ver "Backend").

## Backend (forward-only, solo local)
`supabase/migrations/20261005100000_v0431_post_qa_intelligence_names_claim_notification.sql`:
- `get_player_intelligence_history` — **BUG 2**: devolvía `display_name_snapshot` crudo (Bruno/federico); ahora `_match_participant_display_name` (nombre canónico actual, igual que `get_my_matches`). Grants conservados explícitamente.
- `get_notifications` — `identity_questioned` suma `openedByName` (el actor de un self-report ya no figura en el partido, por eso salía "Alguien"); `identity_claimed` suma `claimedByName` (nombre actual).
- Notificación nueva persistida **`identity_claimed`**: constraint `notifications_type_check` ampliado + trigger `provisional_claims_notify_inviter` (`AFTER UPDATE OF status`) que avisa **solo a `created_by_player_id` del link ganador** (destinatario inequívoco). No toca `claim_provisional_player`. Sin aviso por `NO SOY YO`.
- **Edge Function:** ninguna se editó, pero `get-match-intelligence` importa `intelligence-presentation.js` (symlink) cuyo **fingerprint ahora incluye el nombre** de cada participante ⇒ **redeploy necesario** para que invalide los checkpoints que ya guardaron nombres viejos (se regeneran solos, determinísticos, sin insights nuevos).

## Implementado
**Bug 1 — alta nueva + claim saltea RECUPERADOS.** Causa: la revisión pendiente se guardaba con `currentUserId` (inexistente/otro durante el alta) y `loadRecoveredReview` exigía igualdad ⇒ nunca la encontraba. Ahora se guarda sin dueño (`userId:null`) y la adopta la cuenta que la abre (el servidor solo entrega los ids al TARGET real de la recuperación); sin recovery duplicado ni match IDs perdidos.
**Bug 2 — Intelligence con nombres viejos.** Historia canónica (arriba) + nombre dentro del fingerprint.
**PARTIDOS RECUPERADOS** (UX confirmada): validado = `NO, NO LO JUGUÉ` (outline rojo, izq.) / `SÍ, LO JUGUÉ` (verde, der.); pendiente accionable = `NO…` + `VALIDAR PARTIDO` (misma `officialize-match` que Resumen; implica participación) + `REPORTAR UN ERROR` (abre el selector existente del Resumen); `✓ Participación confirmada` discreto; `LISTO` secundario, solo con todo respondido; `Revisar después` mientras falte. Respuestas derivadas (si ya no figura ⇒ "no"; si reportó y ya no le toca actuar ⇒ "sí").
**Carrusel de Home:** tarjeta `REVISÁ TUS PARTIDOS RECUPERADOS` mientras haya participaciones sin revisar.
**`¿SOS X?`:** `SÍ, SOY YO` / `NO, NO SOY YO` (outline rojo); conflicto ⇒ estado corto `No podés vincular esta identidad porque ya figurás en uno de sus partidos.` + `ENTENDIDO` (limpia la intención; no atrapa el modal; sin modal de duplicados encadenado).
**Invitación:** `COPIAR INVITACIÓN` / `Invitación copiada. Enviásela a X.`; con identidad no disponible la CTA queda deshabilitada.
**@usuario:** ✓ verde compacto dentro del campo (sin texto "Disponible"), ✕ roja + explicación debajo con más margen; reglas intactas.
**Gate de pendientes:** 1–2 nada; 3 y 4 `Tenés N partidos que esperan una respuesta tuya.` con `VER PARTIDOS PENDIENTES` + `OMITIR` (continúa la carga); 5 bloquea (`Resolvé al menos uno para continuar`, sin omitir). Cuenta el RPC `get_pending_action_count` (solo pendientes donde responde su pareja; no cuenta espera ni correcciones post-validación; fallback offline = conteo local). El CTA abre Historial > Pendientes con **lo accionable primero** (accionables → corrección abierta → en espera), sin bandeja paralela.
**1 cuenta + 3 sin cuenta:** el servidor **ya lo admitía** (probado: se crea `pending_validation`, la acción queda en la pareja contraria, el creador no puede confirmarlo, no cuenta como pendiente accionable; al vincularse una provisional contraria esa cuenta recibe la acción, cuenta 1 pendiente y valida). No existía restricción técnica en cliente ni SQL: la regla vieja era solo documental; se reemplazó en `Experiencia_Inicial.md` por "mínimo 1 cuenta por partido". Sin auto-validación. Provisional ajena sigue rechazada (`provisional_not_selectable`).
**Notificaciones:** self-report con el nombre real del actor; `PARTIDO POR VALIDAR` (me toca) vs `ESPERANDO VALIDACIÓN`; `X ya se sumó a BRAMU y recuperó sus partidos.` al generador del link.
**Historial estado cero:** reutiliza la card `TODO EMPIEZA CON TU PRIMER RESULTADO` (helper `buildFirstResultCardHTML` compartido con Home).
**Intelligence visual:** la aclaración de pendiente usa la jerarquía de `intelligence-frame` y margen de 18 px tras `+ POR QUÉ APARECEN ESTOS INSIGHTS`.

## Tests
| Suite | Resultado |
|---|---|
| `node --test bramulab supabase` | **942 tests · 933 pass · 3 fail · 6 skipped**. Los 3 fallos son los mismos preexistentes (h19-B, h21-9, h23); 6 skipped = concurrencia real sin paquetes. |
| `bramulab/v0431-post-qa-humano.test.mjs` (nuevo) | 14/14 — bug 1 (alta nueva sin identidad local), respuestas/carrusel, acciones y orden izq./der., `¿SOS?`/invitación, @usuario, notificaciones (self-report, por validar/esperando, claimed), Historial cero, fingerprint con nombre, 1+3 sin regla de cliente, versión |
| `supabase/functions/_shared/v0431-post-qa.test.mjs` (nuevo, Postgres real PGlite) | 5/5 — nombres canónicos (falla sin la migración), `identity_claimed` (solo al generador, idempotente, no por preview/`NO SOY YO`), `openedByName`, 1+3 pendiente → claim → valida, provisional ajena rechazada |
| Ajustados | v0428 (Estado Cero vía helper), v0429 (copy `INVITACIÓN`, conflicto), v0430 (gate 3/4/5, recuperados), versionado ×8 |
| `tests.html` | 1495/1503: idéntico a la base (8 `V034-*` de Grupos por fecha) |
| Humo en navegador (375 px) | card de recuperados (validado + pendiente), Historial estado cero, ✓ de @usuario |

## DECISIONES ABIERTAS / residuales
1. **Notificación por `NO SOY YO`:** **no implementada** (el rechazo no prueba identidad y el link puede circular) — futuro.
2. `SÍ, LO JUGUÉ` sigue siendo **local** (sin evento server-side de "participación confirmada"); si se necesita auditoría hay que definirla en backend.
3. **Card pre-auth con datos concretos** (de 125) sigue abierta: requeriría una función `anon`.
4. Anti-abuso 1+3: una misma persona con dos cuentas podría validarse un partido de provisionales propias vinculando una a su segunda cuenta. No se agregó heurística (fuera de alcance, sin auto-validación); queda como riesgo conocido.
5. La agrupación visual de 3 sin cuenta en `JUGADORES SIN CUENTA` no se rediseñó (cards separadas, sin anidar); revisar visualmente el caso de 3 en el QA.

## Qué NO se verificó
Migración y redeploy en Staging; el flujo autenticado en navegador/iPhone (alta nueva + claim real, carrusel, VALIDAR/REPORTAR desde recuperados, gate 3/4/5, Intelligence regenerada con nombres); Vercel.

## QA humano MÍNIMO sugerido
1. **Alta nueva desde invitación** (2 partidos, uno validado y uno pendiente): al terminar el onboarding abre `PARTIDOS RECUPERADOS`; el carrusel de Home muestra `REVISÁ…` hasta responder todo.
2. En esa pantalla: validado ⇒ `SÍ/NO`; pendiente ⇒ `VALIDAR PARTIDO` / `REPORTAR UN ERROR` / `NO`.
3. Intelligence de un partido recuperado: sin `Bruno`/`federico`.
4. Cargar un partido con **1 cuenta + 3 sin cuenta**: queda `ESPERANDO VALIDACIÓN`; vincular una provisional contraria y validarlo.
5. Con 3 pendientes accionables: aviso con `OMITIR`; con 5: bloqueo; el CTA lleva a Pendientes con lo accionable arriba.
6. Notificaciones: self-report con el nombre real; `PARTIDO POR VALIDAR`/`ESPERANDO VALIDACIÓN`; aviso `X ya se sumó…` al invitador.

**No se declara cierre de Pre-Production ni se habilita Production.**
