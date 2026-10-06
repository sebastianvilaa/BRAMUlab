# 141 — Resultado · V04.36 · Anular carga + identidad visual final

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Base:** `62c3f5d` · **Versión:** BRAMUlab **V04.36 / bundle 04.36-h1**  
**SHA final:** el del commit que contiene este archivo (se informa al cerrar la ronda; un archivo no puede citar su propio hash).  
**Handoff:** 140. **No tocado:** `main`, Production, BRAMUlive, Vercel, Supabase remoto, fórmulas de Nivel, Ranking, Grupos, Intelligence, Auth.

---

## 1. Qué cambió

### A. Anular carga (backend + UX)

**Migración (PENDIENTE de aplicar en Staging — la aplica/verifica Central):** `supabase/migrations/20261006200000_v0436_annul_own_submission.sql`.

- **RPC `annul_my_match_submission(p_match_id)`** (authenticated; anon/public sin EXECUTE). `security definer`, `FOR UPDATE` sobre el partido (mismo lock que confirmar/proponer/crear-o-adjuntar), idempotente. **No reutiliza `admin_annul_match`** y **no inserta en `notifications`**.
- **Elegibilidad server-side** (`_annul_submission_block_reason`): caller = autor (`created_by_player_id`) y participante; `pending_validation` con ventana vigente; **ninguna otra persona** reconoció el encuentro. Bloquean acciones de otra persona: `confirmed`, `revision_proposed`, `revision_sustained`, `declared_again_same_side` (un compañero), `participant_replaced`, `validated`/`correction_accepted`, o cualquier revisión con otro proponente. **No bloquean:** `No participé` de un tercero (`identity_questioned`) ni acciones del propio autor. Códigos: `match_not_found` (extraño o partido retirado visto por un no-autor), `not_author`, `not_pending`, `recognized_by_other`.
- **Efecto:** `status='annulled'`, `annulment_reason={kind:'author_retracted',byPlayerId}`, `annulled_at`, acción de bitácora `annulled` (auditoría), partido oculto para los 4 participantes (`match_user_state`), candidatos de duplicado abiertos del partido → `void`. Nada se borra. Sin efectos en Nivel/Ranking/Grupos/Intelligence/stats/contadores (un pending nunca los produjo; el test lo verifica sobre `level_states`, `match_level_results`, `level_events`).
- **Invisibilidad robusta** (`_match_is_author_retracted`, helper interno): `get_my_matches` (aun con `p_include_hidden`, que usa `refreshServerMatches`), `get_match_detail` (devuelve `null`), `get_notifications` (incidencias abiertas y notificaciones persistidas del partido) y los ids de `get_my_recent_recoveries`/`get_my_recovered_match_ids`. Pendientes/contadores/dedupe/Ranking/Grupos/Intelligence ya filtraban por estado y excluyen `annulled` sin cambios. Las 5 funciones se re-crean **con la misma firma** y las mismas concesiones (se endurece `anon` en `get_match_detail`/`get_notifications`).
- `get_match_detail` suma `canAnnulSubmission` (lo calcula el servidor; la UI nunca lo infiere).
- **UX** (`index.html`, `app.js`, `matches.js`, `match-sync.js`, `styles.css`): en el Resumen del pendiente elegible, debajo de `Reportar un error` y con menor jerarquía, texto rojo **Anular carga**; modal `¿Anular esta carga?` / `El partido dejará de estar pendiente y no tendrá efectos en BRAMU.` con `Cancelar` / `Anular carga` (rojo). Éxito → refresca el feed, toast `Carga anulada` y sale al Home. Si el estado cambió (`recognized_by_other`/`not_pending`) se explica y se relee el detalle.

### B. Identidad visual final

- **Masters** en `docs/BRAMUlab/Marca/`: `BRAMUlab-Logo.svg`, `BRAMUlab-Isotipo.svg`, `BRAMUlab-IconoApp.svg`. A los dos que traían metadata se les quitó **solo** el bloque `<metadata>` XMP/C2PA de Adobe (el resto, byte a byte igual al export aprobado; hashes fijados por test). Más `README.md` y `generar-derivados.html` (herramienta sin dependencias, reemplaza al generador Python viejo).
- **Derivados** generados desde esos masters (renderizados en un navegador real y contrastados contra el PNG aprobado: diferencia media ≈ 1/255): `icon-192`, `icon-512`, `icon-512-maskable` (master a sangre + el mismo master al 80 % con borde suave), `apple-touch-icon` (180, opaco; **data URI de `index.html` regenerado**), `favicon-64` (recorte alrededor de la B), `logo.svg`, `logo.png`.
- **`/icons/logo.png` es ahora el logo NUEVO**, derivado de `logo.svg`, fondo transparente y la misma proporción histórica (6,58:1) para que los emails (height 30 / max-width 200) no se deformen. Sin cambio de plantillas.
- **Logo SVG en toda la app** (splash, acceso/legal/alta, headers, footer): 13 `<img>` → `icons/logo.svg`. Verificado en navegador real: cargan todos y miden exactamente lo mismo que antes (header 158×24, acceso 197×30 / 240×37, footer 118×18, splash 260×40).
- **`bramulab/icons/logo.svg` = `BRAMUlab-Logo.svg` con el `viewBox` recortado al trazo** (+ `width`/`height` intrínsecos): el export trae ~23 % de aire vertical y ~6 % horizontal; recortarlo evita rediseñar los tamaños de CSS existentes. Ningún path/color/filtro cambia (test lo exige). → ver DECISIÓN ABIERTA 2.
- **Paleta/tipografía:** `styles.css` ya coincidía con `Identidad_Visual.md` (`#050A12`, `#95FF19`, `#199FFF`, `#F8FAFC`, escala oscura, secundarios, Inter); sin cambios de UI fuera de la marca.
- **Manifest/SW/versionado:** `04.35-h2` → `04.36-h1` en `store.js` (`APP_VERSION`/`BUNDLE_VERSION`), `version.json`, `sw.js` (`CACHE_NAME` + `CORE_ASSETS`, que ahora precachea `logo.svg` y ya no `logo.png`), `index.html`, `manifest.webmanifest`, `styles.css` y tests.

### C. Limpieza de la identidad anterior (borrado verificado)

Eliminados: toda `docs/identidad-visual/` (4 PNG históricos, `Logo.ai` ya retirado antes, generador Python viejo, las 18 referencias Premier Padel — archivadas por Central —), `bramulab/icons/splash-b.png` (0 referencias activas; solo un comentario HTML, reescrito). `INDICE.md` apunta a `Identidad_Visual.md` + `Marca/`. Los tests que leían esos archivos (`v0417`, `v0428`) se actualizaron. `bramulab/icons/padel-court-example.svg` **intacto** (hash fijado). `bramulive/icons/splash-b.png` es de BRAMUlive y no se tocó.

`bramulab/icons/` queda con exactamente: `apple-touch-icon.png`, `favicon-64.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `logo.png`, `logo.svg`, `padel-court-example.svg`.

### D. Documentación

`Experiencia_Inicial.md` §14.1 (regla de Anular carga), `Backend_Infraestructura.md` (orígenes de `annulled`), `Identidad_Visual.md` (apéndice técnico + carpeta histórica retirada), `README.md`, `INDICE.md` y `docs/BRAMUlab/Marca/README.md`. Sin podas documentales fuera de lo pedido.

## 2. Tests ejecutados

| Prueba | Resultado |
|---|---|
| **Nuevo** `supabase/functions/_shared/v0436-anular-carga.test.mjs` (Postgres real PGlite, **todas** las migraciones): autor PASS · no autor FAIL · no pending FAIL · reconocimiento de tercero bloquea (confirmar, corregir, compañero, reemplazo) · `No participé` de tercero NO bloquea · acciones del autor NO bloquean · doble ejecución idempotente · sin notificación nueva · desaparece de todas las lecturas (incl. `include_hidden`, detalle, notificaciones, pendiente) · sin efectos deportivos · recarga posterior crea partido nuevo · candidato de duplicado → void · permisos | **16/16** |
| **Nuevo** `bramulab/v0436-identidad-visual.test.mjs` (masters con hash, `logo.svg`=master salvo viewBox, PNG decodificados: opacos/azul noche/B lima/maskable/favicon, `logo.png` nuevo transparente blanco+lima, 13 logos SVG, manifest/SW/apple-touch/favicon, identidad vieja retirada, **sin referencias activas** en dist y repo, `padel-court` intacto, hardening 139 sin retroceso) | **10/10** |
| **Nuevo** `bramulab/v0436-anular-carga-ui.test.mjs` (wrapper de red, traducción `canAnnulSubmission`, markup/copy/estilo, flujo del modal) | **6/6** |
| Suite Node completa (`node --test` de todos los `*.test.mjs`) | **1037 tests · 1030 pass · 1 fail · 6 skip** (base previa 1005 · 998 · 1 · 6) |
| `release-check.mjs` completo (replay limpio ×3 ACL con la migración nueva, auditoría de grants, ensayo operativo) | **PASS** |
| Navegador real sobre el `dist/` construido | acceso con logo nuevo; 13/13 logos cargan y miden como antes; "Anular carga" bajo "Reportar un error" en rojo (13 px, sin fondo) |

La única falla es **preexistente e ajena** (`h23: flujo inicial dice VALIDAR…`, test viejo contra copy de V04.34; idéntica en `62c3f5d`).

## 3. Qué no pudo verificarse

- **Migración no aplicada en Staging real** ni probada a través de PostgREST/Auth reales: la evidencia es PGlite (Postgres real, todas las migraciones) + replay/ACL del `release-check`. La concurrencia real (dos sesiones) se apoya en el mismo `FOR UPDATE` que ya usan las demás RPC; PGlite es de una sola conexión.
- **QA con dos cuentas reales en Staging** (autor anula; otro reconoce antes; `No participé` de un tercero) y el flujo de UI completo con sesión real: no hay sesión de Staging acá. La UI se verificó por estructura/estilo y con tests de cliente, no por clics reales sobre un partido servidor.
- **iPhone físico:** el icono instalado (iOS cachea el icono: hay que quitar y volver a agregar la PWA), el maskable en Android y la actualización del Service Worker a `04.36-h1`.
- **Safari/iOS** con el logo SVG (`height`/`width:auto` + dimensiones intrínsecas): verificado en el navegador del panel (Chromium).
- **Vercel Preview** del nuevo bundle (build real con `dist/`).
- Logo de emails ya enviados/hosted: ver §4.

## 4. Acciones externas para Central

1. **Aplicar y verificar** `20261006200000_v0436_annul_own_submission.sql` en Supabase Staging (no requiere redeploy de Edge Functions: la RPC se invoca directo desde el cliente).
2. **Emails Auth hosted de Staging:** las 4 plantillas siguen apuntando al `logo.png` **fijado a un commit viejo** de `raw.githubusercontent.com` → siguen mostrando el logo anterior hasta ejecutar la secuencia ya preparada en 139 (`BRAMU_EMAIL_LOGO_BASE` → regenerar → sync). Los emails **custom** (Edge) usan `BRAMU_PUBLIC_BASE_URL`: mostrarán el logo nuevo apenas ese origen sirva el deploy V04.36.
3. Revisar el Preview de Staging (iconos, splash, acceso) y hacer QA humano corto en iPhone (reinstalar la PWA para ver el icono nuevo) + QA de Anular carga con dos cuentas.

## 5. DECISIONES ABIERTAS

1. **¿Se puede anular un pendiente ya vencido?** Hoy NO (el handoff pide "sigue `pending_validation`"; el vencido se muestra como `expired` y queda registrado). Si se quisiera, es un cambio de una condición en `_annul_submission_block_reason`.
2. **Confirmar la interpretación de "no modificar el logo" para `icons/logo.svg`:** se recortó únicamente el `viewBox` (geometría idéntica, hash del master intacto en `Marca/`) para no rediseñar tamaños. Alternativa: servir el SVG sin recortar y reajustar los tamaños de CSS (el logo se vería más chico o los headers más altos).

## 6. Notas menores (no bloquean)

- Una notificación persistida `identity_recovered` conserva su contador "N partidos" aunque uno haya sido retirado por su autor después (las listas ya lo excluyen). Caso muy improbable.
- Un reintento *idempotente* de `create_or_attach_match` con la misma clave tras anular devolvería el resultado original guardado; el partido no aparece en ninguna lectura. No se modificó esa función (31 KB) por riesgo/beneficio.


---

## 7. Gate Central posterior a la entrega — 06/10/2026

**Estado:** **PASS TÉCNICO CENTRAL EN STAGING.** Queda únicamente QA humano mínimo visual/funcional.

Central revisó el diff completo `62c3f5d → f24ef53`: un único commit funcional, sin cambios en `main`, Production ni archivos de BRAMUlive.

### Backend real

- Migración `v0436_annul_own_submission` aplicada correctamente a `bramulab-staging`.
- Versión registrada por Supabase: `20261006203501`.
- ACL real:
  - `anon` NO puede ejecutar `annul_my_match_submission`;
  - `authenticated` SÍ;
  - helper interno `_annul_submission_block_reason` NO queda expuesto a authenticated;
  - `get_match_detail` queda authenticated y no anon.
- Smoke transaccional en Postgres Staging real:
  - `No participé` de otra persona → **NO bloquea**;
  - acción del propio autor → **NO bloquea**;
  - `confirmed` por otra persona → **bloquea** con `recognized_by_other`;
  - doble anulación → retorno idempotente `already_annulled`;
  - tras anular, detalle y feed quedan invisibles incluso con `include_hidden`.
- Sobre un pendiente real de `seba_qa`, `get_match_detail` devuelve `canAnnulSubmission=true`.
- Advisors posteriores: sin hallazgo nuevo bloqueante. El warning de `SECURITY DEFINER` para la nueva RPC es esperado: es un endpoint authenticated deliberado con controles internos; helpers siguen revocados.

### Deploy

GitHub/Vercel reporta **SUCCESS · Deployment has completed** para el commit funcional `f24ef53d399c3ba1021aa0dc33c607628b0aacb5`.

El conector de Central no puede atravesar la protección del Preview para inspección visual directa (403 en bypass), por lo que no se duplica trabajo ni se pide cambio de permisos de Vercel.

### Decisiones abiertas de 141

1. **Pendiente vencido:** se acepta el comportamiento actual. Al vencer la ventana deja de ser una carga pendiente accionable; `Anular carga` no se ofrece. No requiere cambio.
2. **Recorte de `viewBox` del logo runtime:** no modifica paths, proporciones, colores ni geometría; se acepta como adaptación técnica para conservar el tamaño visual histórico. Queda sujeto únicamente al QA visual humano del deploy.

### QA restante

Central dejó un fixture específico y descartable en Staging para `seba_qa`, identificado visualmente por el lugar **`QA · Anular carga`**, score 6–3 / 6–4 y elegibilidad `canAnnulSubmission=true`.

QA humano mínimo:
1. confirmar logo nuevo / aspecto general en Staging;
2. abrir ese partido;
3. comprobar `Anular carga` bajo `Reportar un error`;
4. confirmar modal/copy;
5. anular y comprobar que desaparece y vuelve a Home.

No hace falta repetir escenarios de bloqueo con una segunda cuenta: ya quedaron cubiertos por tests + Postgres real de Central.


### Ajuste visual QA h2

QA humano confirmó el modal de `Anular carga` y detectó que el CTA suelto se percibía débil/inconsistente. Decisión de producto: `Anular carga` usa el **mismo tratamiento visual outline rojo** de `Reportar un error`, manteniéndose inmediatamente debajo. Cambio cosmético únicamente; no altera elegibilidad ni backend. Bundle técnico: `04.36-h2`.
