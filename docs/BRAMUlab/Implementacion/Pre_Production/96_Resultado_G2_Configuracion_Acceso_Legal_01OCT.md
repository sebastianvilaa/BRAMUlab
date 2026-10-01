# 96 — Resultado G2: Configuración, Acceso/Legal y QA browser (implementación)

**Fecha:** 01/10/2026 · **Issue:** #22 · **Rama:** `staging` · **HEAD de entrada:** `c5070ad` · **Bundle:** `04.20-h5` (versión pública sin cambio: V04.20)
**Alcance respetado:** sin cambios en backend de challenges/eliminación, emails G1, Nivel/Ranking/Intelligence, `main`, Production ni BRAMUlive. Sin migraciones ni dependencias nuevas.
**Decisiones abiertas:** ninguna.

## 1. Cambios UI / navegación

- **Mis datos** vuelve a ser solo datos del jugador. Se sacaron *Acceso y seguridad*, *Legal y privacidad* y *Cerrar sesión*. Única excepción deliberada: el aviso **Acceso incompleto** (cuenta legacy sin email/contraseña) sigue en Mis datos, oculto salvo ese caso, porque no puede quedar detrás de un engranaje.
- **Engranaje** discreto (mismo SVG que el de Configuración de Grupos) en el header de Perfil → `Configuración`; back vuelve a Perfil.
- **Configuración** (`#view-settings`): lista compacta, una superficie por grupo (sin card dentro de card), filas de 46 px con label/valor/chevron centrados (flex + `align-items:center`), chevrons de ancho fijo, divisor solo entre filas visibles. Orden: Cuenta y seguridad (Email con valor, Cambiar contraseña) · Privacidad y datos (Solicitar copia) · Legal (Términos, Política) · Ayuda (Contacto) · Sesión (Cerrar sesión) · Zona de cuenta (Eliminar mi cuenta, en danger y aislada al final). No hay fila permanente de "cerrar todas".
- **Pantallas intermedias** (reusan `.view--access` + `.analysis-header`, sin bottom nav): `Email`, `Eliminar mi cuenta`, `Copia de mis datos`, `Contacto`. Tocar la fila **solo navega**; el CTA hace la acción:
  - `CAMBIAR EMAIL` → flujo G1 (Email #3 → verificar → nuevo → #4 → verificar → cambio → #5), sin cambios.
  - `CONTINUAR CON LA ELIMINACIÓN` → challenge `delete_account` (Email #7) → flujo G1/P0.3, sin cambios.
  - `SOLICITAR COPIA` → mismo mecanismo operativo vigente (mail preparado a `bramulab@gmail.com`), recién en el CTA. La pantalla lista **categorías** reales (cuenta y perfil, actividad deportiva, Nivel/Ranking, grupos, aceptaciones legales, notificaciones/Intelligence, datos técnicos mínimos), tomadas de `Privacidad_Legal.md` + el reporte de exportación real; sin datos concretos del usuario ni copy legal nuevo.
  - `ENVIAR EMAIL` → muestra primero `bramulab@gmail.com`, abre el correo solo en el CTA.
- **Cerrar sesión**: la fila abre el modal con `Cerrar sesión` / `Cerrar todas las sesiones` / `Cancelar` (todas = `signOut` global; se oculta para cuentas sin backend). Las cuentas sin email conservan el aviso fuerte previo.
- **Términos y Política in-app** (`#view-legal-doc`): mismo documento público (`terminos/`, `privacidad/`) en un marco same-origin bajo header con `←` y título, sin bottom nav. Vuelve a su origen: Configuración, aceptación legal o alta (el formulario de alta conserva su estado porque la vista solo se oculta). Los links del gate y del alta ya no usan `target=_blank`.
- **Reaceptación legal**: solo layout/jerarquía — bloque centrado verticalmente, ancho de lectura 420 px, más aire entre logo / texto / decisión / CTA, casilla en superficie propia, links subrayados. Mismo copy, misma casilla obligatoria, misma persistencia (`accept_legal_version`). Verificado visualmente en 375×812 sobre la vista real.
- Flujo de cuenta: su back y el cierre del cambio de email ahora vuelven a Configuración.

## 2. Ícono / isotipo instalado en iOS — diagnóstico y fix

Evidencia: los PNG son válidos (`apple-touch-icon` 180×180, `icon-192/512/512-maskable`, **todos 100 % opacos**, sin canal alfa transparente → descartada la causa "iOS rellena la transparencia de negro"); `manifest.webmanifest` válido (rutas, tamaños, `maskable`, `start_url`/`scope` relativos); head y SW coherentes con el bundle; MIME correcto en estáticos.
**Causa más probable (no verificable desde acá, requiere iPhone real):** Staging está protegido por Vercel. iOS pide `apple-touch-icon` y el manifest al "Agregar a inicio" **sin cookies**, así que recibe la página de login de Vercel en vez del PNG, y reinstalar no lo arregla (igual que los favicons).
**Fix:** (1) `apple-touch-icon` ahora va **incrustado** como `data:image/png;base64` con los **mismos bytes** de `icons/apple-touch-icon.png` (un test verifica la igualdad y que haya un único `apple-touch-icon`); no depende de ninguna request. (2) `<link rel="manifest" crossorigin="use-credentials">` para que el manifest viaje con credenciales en Staging protegido. (3) Bundle `04.20-h5` en `store.js`, `version.json`, `sw.js` (`CACHE_NAME` + `CORE_ASSETS`), `index.html` y `manifest.webmanifest`; el SW nuevo borra las cachés `bramulab-v*` anteriores. Protección de Vercel intacta. **Work:** desinstalar la PWA, abrir Staging autenticado, "Agregar a inicio" y confirmar el ícono; si persiste, el residual sería iOS cacheando el ícono por URL de origen (borrar datos de Safari del sitio).

## 3. Site URL / redirects de Auth (Staging)

**No cerrado desde código — es configuración hosted** (sin credenciales de Supabase en este entorno y el origen estable de Staging no figura en el repo; ningún flujo usa links, todo es OTP, por eso G1 funcionó). Dejé la sincronización lista y reproducible: `sync-auth-email-templates.mjs` agrega `site_url` + `uri_allow_list` (`<origen>,<origen>/**`) al payload cuando se define `BRAMU_SITE_URL`; rechaza `http`, `localhost`, GitHub raw/pages y valores sin esquema.
**Para Work:** `BRAMU_SITE_URL=https://<origen estable de Staging> SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node supabase/scripts/sync-auth-email-templates.mjs --apply --env staging` (o Dashboard → Authentication → URL Configuration: Site URL = ese origen, Redirect URLs = `<origen>` y `<origen>/**`). Vercel Staging se mantiene protegido; no se abre para esto.

## 4. Archivos tocados

`bramulab/`: `index.html`, `app.js`, `styles.css`, `store.js`, `sw.js`, `version.json`, `manifest.webmanifest` · tests: `g2-configuracion.test.mjs` (nuevo), `v0417-cierre-final`, `v0419-l1-legal-alta`, `v0420-l2-l3`, `groups-b1-server-backed`, `h21-sistema-visual-unificado`, `g1-emails` (versión/estructura) · `supabase/scripts/sync-auth-email-templates.mjs` (+`BRAMU_SITE_URL`) · `supabase/email-templates/manifest.json` (regenerado: estaba desfasado respecto de la fuente tras el gate G1) · este informe.

## 5. Tests ejecutados

- `g2-configuracion.test.mjs` **13/13**: Mis datos sin seguridad/legal/logout · engranaje→Configuración→back · orden/estilo de filas · filas sensibles no disparan flujo ni mail al primer tap · CTA sí inicia (y solo dos llamadas a `openAccountFlow`) · copia/contacto no saltan directo · categorías de copia respaldadas por el export real · modal de cierre diferencia actual/todas/cancelar · legal in-app con back a su origen y sin bottom nav · reaceptación mantiene obligación/persistencia · Perfil/Mis datos server-backed intactos · ícono/manifest/head/SW/versionado · Site URL · sin migraciones G2.
- Suite completa Node (bramulab + `_shared` + scripts): **706/709**; las 3 fallas (`h19-B`, `h21-9`, `h23`) son **preexistentes** (ya fallaban en `a7178a9`, ajenas a G2). `release-check` PASS. (`tests.html` no se tocó: sus 5 fallas `V034-*` son preexistentes.)
- Tests viejos de G1/L3 actualizados al nuevo layout (mismos contratos: 2 verificaciones, `delete_account`, sin recovery).

## 6. Bundle final y deploy

`04.20-h5` / pública `V04.20`. Un único commit/push a `staging`; el deploy de Vercel Staging lo dispara el push (frontend cambió). No hay cambios de backend que aplicar.

## 7. Exclusivamente para Work

1. QA mobile + desktop sobre Staging real: Perfil → ⚙ → todos los backs; Mis datos limpio; filas compactas/centradas; safe areas.
2. Email: la pantalla no envía nada, el CTA sí (#3). Eliminación: idem (#7). Copia y Contacto no abren Mail hasta su CTA.
3. Legal in-app desde Configuración, aceptación legal y alta (back correcto, sin bottom nav, el iframe se ve bien en iOS Safari/PWA).
4. Reaceptación legal reproducida con fixture/cuenta sintética (equilibrio vertical en teléfono y desktop).
5. Ícono PWA en iPhone real (ver §2) y Site URL/redirects hosted (ver §3), más la verificación del logo de los emails si cambia el origen.

## 8. DECISIONES ABIERTAS

Ninguna.
