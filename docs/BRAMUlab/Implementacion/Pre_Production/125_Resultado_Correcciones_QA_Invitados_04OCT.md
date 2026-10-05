# 125 — Resultado · Correcciones QA Invitados / Identidad / Pendientes (V04.30)

**Fecha:** 04/10/2026 · **Rama:** `staging` · **Versión:** BRAMUlab **V04.30** · bundle **04.30-h2** (h1 en el primer push; h2 = correcciones C1/C2 del gate Central)
**HEAD base:** `79e489e` · **Commits previos:** `b2df2b3` (funcional), `8fd26be`, `ed36adb` (docs; gate Central posterior sobre `ed36adb`) · **HEAD final:** el commit único de C1/C2 + esta actualización (`git log -1`; el hash se informa al cerrar la ronda).
**Fuente de alcance:** GitHub Issue #29 + `124_Handoff_QA_Humano_Invitados_04OCT.md`.
**Estado:** el gate Central (04/10) **aplicó la migración en Staging** y verificó B1/B2/B3 en Staging real (PASS), Vercel SUCCESS y ACLs/advisors. Esta actualización cierra los hallazgos C1 y C2 de ese gate. Ninguna Edge Function cambió.

## Migración (forward-only, solo local)
`supabase/migrations/20261004100000_v0430_create_or_attach_idempotent_replay.sql` — `CREATE OR REPLACE` de funciones existentes (grants conservados), sin cambios de esquema:

| Función | Cambio |
|---|---|
| `create_or_attach_match` | **B2.** `v_existing_submission is not null` evalúa un record compuesto: es verdadero solo si TODAS las columnas son no-nulas. Un submission con error de negocio guarda `result_match_id = NULL` ⇒ el replay no lo detectaba ⇒ re-INSERT ⇒ SQLSTATE 23505 ⇒ `persist_failed`/500 ⇒ falso "Sin conexión". Ahora chequea `idempotency_key` (NOT NULL). Resto idéntico al vigente. |
| `list_my_duplicate_match_candidates`, `get_my_identity_recovery_status` | **B3.** Un candidato solo cuenta/se lista si el caller **sigue figurando** en ambos partidos (si se desligó vía "No participé" queda stale). |
| `preview_claim_link` | Suma `matchCount` y `sourceMatch` (partido más reciente de la provisional: cargador, parejas, score, fecha; **sin ids** de partido). Solo con sesión. |
| `get_my_recovered_match_ids` (**nueva**) | Ids de los partidos de UNA recuperación; solo el target la lee. |
| `get_notifications` | La notificación derivada `identity_questioned` suma `selfReported` (`previous_player_id = opened_by_player_id`). |

## Bugs corregidos
- **B1** — la corrección **pre-validación** reenviaba por `createOrAttach` sin `matchId` (discovery por huella ⇒ `ambiguous_candidates` con dos partidos de los mismos 4 jugadores). Ahora manda `disambiguationMatchId = f.matchId`: opera inequívocamente sobre ESE partido (revisión append-only, action-side, deadline, idempotencia por la RPC existente). La corrección **post-validación** ya usaba `propose-match-correction` con `matchId` (sin cambios).
- **B2** — (a) causa raíz en SQL (arriba); (b) `matches.js#createOrAttach` clasifica **negocio** (4xx/409 con `code`), **servidor** (5xx ⇒ `serverError`, copy "Hubo un problema al guardar en BRAMU…", nunca "Sin conexión") y **red real** (`network_error`/`offline`); (c) `getMatchDetail`/`hideMatchForMe`/`setMatchPrivateNote` rechazan IDs no UUID (`m_…` local) sin llamar a la RPC; `renderB6Actions` no pide detalle de un borrador; (d) un error de negocio ya dejaba la entrada en `necesita_revision` (no `sync_pending`) y se descarta con "Descartar esta carga"; (e) toast: `white-space: normal` + `max-width: calc(100vw - 32px)`.
- **B3** — `resumeServerSession` ya no encadena `syncIdentityRecovery()` tras `NO SOY YO` / enlace inválido / transitorio (prompts serializados) + candidatos stale filtrados en servidor.
- Bug propio hallado por test: `describeProvisionalContext` comparaba contra una propiedad inexistente (`best.playedAt`) y siempre elegía el primer partido; corregido antes del commit.

## UX implementada
- **Pantalla de partidos recuperados** (`#view-recovered`): tras `SOY YO` (o al terminar el onboarding de una alta nueva) se listan los partidos recuperados con la **misma tarjeta de Historial** (`buildHistoryItemElement`, extraída de `renderHistory` sin cambio de comportamiento). Por card: `SÍ, LO JUGUÉ` / `NO, NO LO JUGUÉ` / `VER PARTIDO / HAY OTRO ERROR`; en pendientes accionables `CONFIRMAR O CORREGIR EL RESULTADO` (abre el Resumen existente). Validado ⇒ solo confirma participación; **no revalida**. `NO LO JUGUÉ` reutiliza el self-report existente. Persistente por usuario (`localStorage`, sobrevive recargas), `LISTO` la cierra, `Revisar después` la posterga. Duplicados/Nivel pendientes se ofrecen **al salir** de la pantalla.
- **Self-report `NO PARTICIPÉ`**: sobre el propio lugar → `¿Confirmás que no jugaste este partido?`, CTA `NO PARTICIPÉ`, deja `Por identificar`, avisa a los demás, **no** pide reemplazo. Sobre otro participante se conserva `¿Seguro que no fue X?` → `¿Sabés quién jugó?`. Notificación en primera persona (`X indicó que no participó en este partido`), mismo destino (Resumen/RESOLVER).
- **Gate de 5 pendientes**: el `+` consulta `get_pending_action_count` (fallback offline: conteo local) **antes** de borrador/formulario; con 5 explica y ofrece `VER PARTIDOS PENDIENTES` → Historial > Pendientes. El servidor sigue siendo la última barrera (sin cambios).
- **Entrada de invitación**: card contextual en Acceso antes de autenticar (reemplaza el aviso fugaz) y `¿SOS {nombre}?` con el partido fuente (cargador, parejas, score, fecha, "y N partidos más"). `NO SOY YO` sigue sin consumir el link.
- **Visual/copy**: bloque `JUGADORES SIN CUENTA` como card (ícono + nombre + `INVITAR A {NOMBRE}`); nombres sin cuenta en `--gold` en Historial (vuelven a lo normal tras vincular); selector con secciones `Sin cuenta` / `Jugadores` (una cuenta real nunca queda bajo el heading de sin cuenta; mismo estilo que `Recientes`); referencia `Sin cuenta · jugó con X · fecha` (solo con partidos ya visibles en la caché del usuario); feedback en vivo de coincidencia de contraseñas; aclaración en Intelligence de partidos pendientes.

## Tests
| Suite | Resultado |
|---|---|
| `node --test bramulab supabase` completo | **922 tests · 913 pass · 3 fail · 6 skipped**. Los 3 fallos son los **mismos preexistentes** de 117/119 (h19-B, h21-9, h23). Los 6 skipped son la concurrencia real sin los paquetes. Pasó de 898 a 922 (+24). |
| `bramulab/v0430-correcciones-qa.test.mjs` (nuevo) | 23/23 — B1/B2/B3, gate 4/5 (RPC y offline), self-report, recuperados (persistencia por usuario), invitación, selector, sin cuenta amarillo, contraseña, versión |
| `supabase/functions/_shared/v0430-correcciones.test.mjs` (nuevo, Postgres real PGlite, todas las migraciones) | 6/6 — B2 replay (**falla con 23505 sin la migración**, verificado), idempotencia válida, B3 stale, preview + recuperados + privacidad entre cuentas, `selfReported`, **B1 con dos partidos de los mismos 4 jugadores** (ambiguo sin `matchId`; con `matchId`: partido correcto, +1 revisión, deadline intacto, el homónimo sin tocar) |
| `v0429-invitados-identidad`, `verify-g3-identity-recovery.sql`, replay limpio ×3 ACL, `release-check` | PASS (tests de V04.29 actualizados donde cambió el contrato: `INVITAR A …`, `matchCount`/`sourceMatch`, card en lugar de toast) |
| `tests.html` (navegador) | 1495/1503: **idénticos a la base** `79e489e` (8 fallos `V034-*` de Grupos/Race dependientes de fecha; `groups.js` no se tocó) |
| Humo en navegador | Acceso con card de invitación + toast largo envuelto, a 375 px; sin errores de consola propios |

## Gate Central — C1 y C2 (bundle 04.30-h2)
- **C1 — falso "Sin conexión" ante 4xx conocidos.** `createOrAttach` conserva el body de toda respuesta HTTP con `code` y le suma `httpStatus`; "Sin conexión" se muestra **solo si `result.offline === true`** (sin respuesta del servidor). Copy específico para `rate_limited` (429, "Hiciste muchos intentos seguidos…") y `invalid_session` (401); cualquier otra respuesta HTTP/`unknown` usa el copy genérico de servidor. Semántica de retry intacta: no son errores de negocio ⇒ la entrada sigue `sync_pending` y se reintenta (`rate_limited` explícitamente fuera de `MATCH_BUSINESS_ERROR_CODES`). Helper `transientMatchSaveCopy`.
- **C2 — `LISTO` en PARTIDOS RECUPERADOS.** Mientras quede ≥1 card sin responder: `LISTO` oculto y `Revisar después` visible; con todas respondidas: `LISTO` visible y `Revisar después` oculto. Defensa adicional en `closeRecoveredScreen`: `markDone` se fuerza a `false` si falta alguna respuesta, así nunca se borra la revisión persistente incompleta.
- **Tests:** 2 nuevos focalizados en `v0430-correcciones-qa.test.mjs` (429 ⇒ no "Sin conexión" + offline sí; C2 visibilidad y defensa de cierre). Suite `node --test bramulab supabase`: **924 tests · 915 pass · 3 fail · 6 skipped**; los 3 fallos son los mismos preexistentes (h19-B, h21-9, h23). Bump 04.30-h1→h2 con tests de versión actualizados.
- No se tocó B1/B2/B3 ni nada fuera de C1/C2. Sigue sin verificarse el flujo visual autenticado (QA humano corto pendiente). Issue #29 queda abierto.

## Alcance respetado
No se tocó `main`, Production, BRAMUlive, fórmula de Nivel, Ranking publicado, Grupos ni Legal. La deduplicación V04.29 (SAME/DISTINCT/score distinto) no se modificó; solo se filtran candidatos stale.

## DECISIONES ABIERTAS / residuales
1. **Card pre-autenticación con datos concretos (identidad + partido fuente)** — *no implementada tal cual*. El token `?claim=` solo se puede resolver con una RPC; hacerlo **sin sesión** exige una función ejecutable por `anon` que exponga a cualquiera con el enlace nombres de terceros, score y fecha (hoy `anon` solo ejecuta `is_username_available`; el audit de grants lo trata como decisión de producto). Se implementó la variante segura: card genérica y contextual **antes** de autenticar + identidad y partido fuente en `¿SOS {nombre}?` **después**. Si se quiere la versión pre-auth completa: función `anon` mínima (+ rate limit por IP vía Edge) — requiere decisión de privacidad.
2. **Notificación al invitador cuando el invitado se une** y **aviso de `NO SOY YO` (sin revelar quién)**: *no implementadas*. Ambas exigen persistir eventos nuevos (el claim es una función de concurrencia crítica recién endurecida en G3b; y el rechazo hoy es 100 % local por diseño, sin llamada al servidor). Riesgo/privacidad no triviales ⇒ se dejan para decisión.
3. `SÍ, LO JUGUÉ` se recuerda **localmente** (no hay evento server-side de "participación confirmada" y no se inventó un sistema paralelo). Si se necesita auditoría de la confirmación de participación, hay que definirla en backend.
4. El self-report sigue excluyendo del selector al **creador** del partido (regla previa); el creador no puede declararse "no participé".

## Qué NO se verificó
- **Staging real**: la migración **no está aplicada** y no se probó contra Supabase Staging (sin credenciales/CLI). Central/Work deben aplicarla (forward-only) y re-verificar B2 (mismo `idempotency_key` con `pending_action_limit_reached` ⇒ mismo resultado, sin 500) y B3 (candidato stale) en Staging.
- **Flujo visual autenticado** (pantalla de recuperados, `¿SOS?` con partido, gate del `+`, self-report) en navegador/iPhone real: no hay sesión Supabase aquí; se probó por tests con entorno falso + Postgres real, no por QA visual.
- Deploy de Vercel y comportamiento del Service Worker (el bundle subió a `04.30-h1`).
- QA humano corto posterior (claim + pantalla, `No lo jugué` propio, límite de 5, B1, link consumido).

**No se declara cierre de Pre-Production ni se habilita Production.**
