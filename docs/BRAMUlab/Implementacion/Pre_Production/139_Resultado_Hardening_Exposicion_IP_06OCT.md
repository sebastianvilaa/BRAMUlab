# 139 — Resultado · Hardening de exposición / IP (Staging)

**Fecha:** 06/10/2026 · **Rama:** `staging` · **Base:** `86a9c64` · **Bundle:** `04.35-h2` (APP_VERSION sigue `BRAMUlab V04.35`: ronda técnica invisible)  
**Insumos:** 138 §5.4 + comentario de Central en Issue #28 (motor de Nivel en cliente). Sin cambios de comportamiento de producto.  
**No tocado:** visibilidad del repo, GitHub Pages, Vercel, Supabase remoto, `main`, Production, BRAMUlive, fórmulas/parámetros de Nivel, historia Git, documentación (salvo este informe y una línea en README).

---

## 1. Qué lógica dejó de llegar al navegador

**Antes:** `index.html` cargaba `level.js` (488 líneas, 23,9 KB) y `level-context.js` (626 líneas, 33,1 KB). Eso incluía `PARAMS` y las funciones exactas del motor dinámico posterior a partidos: expectativa, margen, formato, repetición/compañero/círculo, disponibilidad, K, factor del rival, topes de delta, confianza/evidencia, decay por inactividad y `computeMatchUpdate`.

**Ahora:** el navegador carga `level-public.js` (2,7 KB) en su lugar, con **solo** `ALGORITHM_VERSION`, `STATES`, `roundPublicLevel`, `clampLevel`. Evidencia del uso real que lo justifica (confirma el análisis de Central):

- `app.js` usa de `PLLevel` únicamente `STATES` (8 usos) y `roundPublicLevel` (4); no usa `PLLevelContext` en ningún punto.
- `level-calibration.js` usa de `PLLevel` únicamente `ALGORITHM_VERSION`, `STATES` y `clampLevel`.
- Ningún otro archivo cargado por el navegador referencia `PLLevel*` (grep sobre todo `bramulab/*.js`).

Qué cambió además: `sw.js` (`CORE_ASSETS`) ya no precachea `level.js` ni `level-context.js`; `dist/` no los incluye (ver §3).

**Decisión de diseño — sin tocar `level.js`:** `level.js` y `match-level-engine.js` tienen su SHA-256 pineado por `v0428-nivel-inicial-v13.test.mjs` (garantía de "fórmula intacta"), y las Edge Functions los importan por symlink. Hacer que `level.js` importara de `level-public.js` habría cambiado ese archivo (hash, redeploy de 4 Edge Functions, orden de carga en ~15 harness). En cambio:

- `level.js`, `level-context.js`, `match-level-engine.js`, `level-calibration.js` quedan **byte a byte iguales**; Edge/tests siguen usando el motor completo.
- `level-public.js` repite **solo 4 primitivas triviales, no fórmulas** (2 constantes, un redondeo a 1 decimal y un clamp a la escala 1–10, que ya son públicos en la UI). Para que no puedan divergir en silencio, el test `A5` las compara contra `level.js` con 3.000+ valores (incluye `-0`, `NaN`, bordes de redondeo) y `A6` verifica que `level-calibration.js` da resultados idénticos sobre ambos.
- Regla escrita en la cabecera de `level-public.js`: lo que el navegador necesite se agrega ahí y se paridad-testea; **nunca** se vuelve a cargar `level.js`/`level-context.js` en `index.html`.

**Prueba explícita de que el navegador ya no recibe el motor** (todo automatizado, además de verificado en un navegador real):

- `A1/A2`: `index.html` y `CORE_ASSETS` no referencian el motor.
- `A3`: cargando exactamente los scripts de `index.html` (menos `app.js`) en un sandbox, `Object.keys(PLLevel)` = las 4 públicas; `PLLevelContext` y `PLMatchLevelEngine` son `undefined`.
- `A4`: ningún archivo de `dist/` contiene 16 marcadores del motor (`EXPECTATION_DIVISOR`, `K_BASE`, `computeMatchUpdate`, `INACTIVITY_HALFLIFE_DAYS`, etc.); control positivo: esos marcadores sí están en `level.js`/`level-context.js`.
- Navegador real (build servido en localhost): `window.PLLevel` = las 4 claves; `PLLevelContext`/`PLMatchLevelEngine` `undefined`; sin errores de consola; Network sin `level.js`/`level-context.js`.
- `release-check.mjs` incorpora el mismo control (queda como guarda permanente).

## 2. Qué sigue deliberadamente client-side

- **`level-calibration.js`** (cuestionario/estimador inicial V1.3 `nivel_inicial_v1_3`): sin cambios, como se pidió. Onboarding intacto.
- `level-public.js`: escala, estados y redondeo públicos.
- **Residual a conocer (DECISIÓN ABIERTA, no tocado):** `level-calibration.js` también contiene lógica **posterior a partidos** que el navegador no usa: `computeCalibrationTransition`, `computeRecalibrationEligibility`, `startRecalibration`, `computeRecalibrationClosure` y sus `PARAMS` (`CALIBRATION_MIN_*`, `RECALIBRATION_*`). No es el motor dinámico por partido, pero sí reglas de calibración/recalibración. Separarlas en un módulo server-only obliga a tocar `officialize-onboarding` (Edge) y su paridad: **ronda propia** si Central quiere proteger también eso.
- El navegador seguirá usando `LVC.PARAMS.CALIBRATION_MIN_MATCHES` (barra de CALIBRANDO), que es dato de UI.

## 3. Contenido final de `dist/`

`vercel.json`: `buildCommand: node scripts/build-env.mjs && node scripts/build-dist.mjs`, `outputDirectory: dist` (rewrite de `/robots.txt` sin cambios). Nuevo `bramulab/scripts/build-dist.mjs` (Node puro, sin dependencias ni bundler). `dist/` está en `.gitignore` (y también `robots.generated.txt`, que era un generado sin ignorar).

**Allowlist explícita (35 archivos + `env.generated.js` y `robots.generated.txt` que genera `build-env`):**

- raíz: `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, `version.json`
- JS (en el orden de `index.html`): `engine`, `stats`, `store`, `level-public`, `level-calibration`, `player-home`, `match-load`, `player-identity`, `groups`, `locations`, `ranking`, `auth`, `matches`, `match-sync`, `match-validation`, `match-self-heal`, `intelligence-client`, `app`
- directorios completos: `icons/` (8), `assets/` (1), `privacidad/`, `terminos/`, `eliminar-cuenta/` (solo su `index.html`)

**Ya NO se publican:** `tests.html` (564 KB), los 48 `*.test.mjs` (1,0 MB), `scripts/`, `api/*.test.mjs`, `.env.example`, `vercel.json`, `level.js`, `level-context.js`, `match-level-engine.js`, módulos server-side de Intelligence. (`api/health.js` sigue siendo función de Vercel: se detecta desde el Root Directory, no depende del `outputDirectory`; **verificar en el Preview**, §6.)

**Comentarios:** en la copia se retiran solo comentarios de **línea completa** (JS `//` y `/* */`, CSS, HTML `<!-- -->`), con tokenizador que respeta strings, templates, regex y `url("data:…")`; se conservan comentarios al final de una línea de código, `/*!` y condicionales. El source de `bramulab/` no se modifica. Medido: 2,39 MB → 1,36 MB de fuente en `dist/`; gzip: `app.js` 287 → 131 KB, `index.html` 96 → 60 KB, `styles.css` 93 → 27 KB. Sin minificar y sin pretender seguridad (todo JS entregado es inspeccionable).

**Verificaciones del build (falla el deploy si no pasan):** sintaxis de cada JS (`vm.Script`) tras retirar comentarios; todo lo que referencian `index.html`, el manifest y `CORE_ASSETS` existe en `dist/`; archivo faltante de la allowlist = error.

## 4. Dependencia del logo de emails (`raw.githubusercontent.com`)

**Estado: PREPARADA, NO APLICADA. El comportamiento vigente de Staging no cambió** (con la variable vacía, plantillas/previews/manifest quedan idénticos byte a byte; test `C2`).

Inventario: 4 plantillas Auth (`confirmation`, `recovery`, `email_change`, `password_changed_notification`), `manifest.json` (`hostedStaging.logoBase`) y `NATIVE_VARS.logoBase` en `supabase/functions/_shared/email-templates.mjs`. Los emails **custom** (Edge #3/#4/#5/#7/#8) ya tomaban su logo de `BRAMU_PUBLIC_BASE_URL` (secret de la Edge): no tenían la dependencia.

Cambios (todos opt-in):

- `resolveNativeLogoBase()`/`renderEmail(…, {logoBase})`: acepta solo `https://host[:puerto]` (sin ruta/query/credenciales); rechaza `raw.githubusercontent.com`, `github.com`, `*.github.io`, `localhost`/`127.*`. Sin valor → el default vigente. **No se inventó ningún dominio.**
- `build-email-templates.mjs` lee `BRAMU_EMAIL_LOGO_BASE` al generar (`--check` y escritura).
- `sync-auth-email-templates.mjs` se niega a sincronizar si las plantillas versionadas no se generaron con el mismo origen (evita creer que el logo cambió cuando no).
- README de `supabase/email-templates/` documenta la secuencia (5 pasos).

**Acción externa pendiente (Central):** definir el origen público estable de la app (`dist/` ya sirve `/icons/logo.png`) → regenerar con la variable → `sync --apply --env staging` → apuntar `BRAMU_PUBLIC_BASE_URL` de las Edge al mismo origen → enviar un email real y ver el logo **antes** de privatizar. Agregado a la descripción del gate G3 en `release-check`.

## 5. Supply chain: supabase-js

Hecho (simple, sin dependencias nuevas): `index.html` carga `…/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js` con `integrity="sha384-…"` y `crossorigin="anonymous"` (antes `@2` flotante sin SRI).

- `2.117.2` es lo que el tag `@2` resolvía hoy: no cambia el código que reciben los usuarios, solo deja de moverse.
- El hash coincide con `dist/umd/supabase.js` del tarball oficial de npm (inmutable, `cache-control: immutable`), y **se verificó en un navegador real**: el script se ejecutó con SRI (`window.supabase.createClient` disponible).
- El SW no intercepta ese origen (passthrough), por lo que `integrity` no interfiere.
- `release-check` y tests exigen versión exacta + SRI + `crossorigin`. Para actualizar: recalcular el SRI desde el tarball de npm, probar login/alta en Staging, cambiar versión y hash juntos.
- **No forzado:** las Edge Functions importan `https://esm.sh/@supabase/supabase-js@2` flotante (server-side, sin SRI posible; fijarlo exige redeploy de las Edge Functions y actualizar `ALLOWED_REMOTE_IMPORTS`). Queda documentado para una ronda con redeploy de Edge.

## 6. Tests ejecutados

| Prueba | Resultado |
|---|---|
| Nuevo `bramulab/h2-hardening-exposicion.test.mjs` (21 tests: motor fuera del navegador, paridad `level-public`, motor intacto/symlinks/SHA, allowlist y exclusiones de `dist/`, sintaxis, versionado, stripper con casos borde, source intacto, logo de emails, SRI) | **21/21** |
| Suite Node completa (`node --test` de todos los `*.test.mjs`: app, Edge `_shared`, scripts) | **1005 tests · 998 pass · 1 fail · 6 skip** (base previa: 984 · 977 · 1 · 6) |
| `release-check.mjs` completo (con replay limpio ×3 y ensayo operativo) | **PASS** (+2 chequeos nuevos: motor fuera del navegador y `dist/` por allowlist; el del CDN pasó a exigir versión exacta + SRI) |
| Paridad de Nivel (`v0428`, `match-level-engine`, `identity-recovery-core`, `v0430/v0431/v0434`, intelligence) | verdes; SHA de `level.js` y `match-level-engine.js` sin cambio |
| `tests.html` en navegador real: source vs. copia con comentarios retirados (differential) | idéntico: **1496/1504** en ambos |
| Build servido en navegador real | `PLLevel` = 4 claves, sin errores de consola, SRI válido, Home de acceso y "Crear cuenta" navegan |
| `build-dist` real contra el árbol (con `env.generated.js` de prueba) | OK, 37 archivos |

**Fallas que NO son de esta ronda (idénticas en HEAD `86a9c64`, no se tocaron):** 1 test Node (`h23: flujo inicial dice VALIDAR…`, copy de V04.34 vs. test viejo) y 8 tests de `tests.html` (`V034-TOP3/TABLA/ANTERIOR/RACE`, dependen de la fecha actual).

**Bump de bundle:** `04.35-h1` → `04.35-h2` en `store.js`, `version.json`, `sw.js` (`CACHE_NAME` + `CORE_ASSETS`), `index.html`, `manifest.webmanifest`, `styles.css` y los tests que lo pinean. Necesario porque cambian scripts y `CORE_ASSETS`.

## 7. Qué NO se verificó / límites honestos

- **No hay E2E con Staging real desde acá:** el onboarding V1.3 y el Home con Nivel se cubren con los tests V04.28 + paridad (A6) y con la carga real del bundle, pero **no** se condujo en el navegador un alta real hasta el cuestionario (requiere Auth de Staging). QA corto de Work/Sebastián recomendado.
- **Service Worker real** (actualización `h1` → `h2` en iPhone instalado): el panel del navegador no registra SW reales; la coherencia del SW está cubierta por tests y por `release-check`, no por una instalación.
- **El motor sigue siendo público por otras vías hasta decidir E-2/E-1 de la auditoría 138:** (a) vive en la **historia Git pública** (ya clonada, no se reescribe), y (b) **GitHub Pages sigue sirviendo `main`** (build V04.10) que incluye el `level.js` completo de esa época. Esta ronda protege solo **lo que entrega la app**; privatizar el repo y resolver Pages siguen pendientes (Central).
- No se pudo comprobar localmente un deploy de Vercel con el nuevo `outputDirectory`.

## 8. Acciones externas para Central (gate)

1. **Tras el push, revisar el Preview de Staging** (protegido: con login): `/tests.html`, `/level.js`, `/level-context.js` y `/vercel.json` deben dar 404; `/` carga; `/version.json` = `04.35-h2`; **`/api/health` sigue respondiendo** (si Vercel lo dejara de detectar con `outputDirectory: dist`, avisar: es un cambio de `vercel.json`, no de panel); `/robots.txt` = `Disallow: /`. Confirmar que ninguna *Output Directory* configurada en el panel contradice `vercel.json` (el archivo prevalece).
2. **Edge Functions: no hace falta redeploy por esta ronda** (`level.js`/`level-calibration.js` intactos; `email-templates.mjs` cambia solo de forma, comportamiento por defecto idéntico). Se redeployan cuando se fije el logo/`esm.sh` (§4, §5).
3. Logo de emails: definir origen público estable y ejecutar la secuencia de §4.
4. QA corto de Work/iPhone: alta → cuestionario → Home con Nivel, y actualización del SW a `04.35-h2`.

## 9. Decisiones abiertas reales

1. **¿Separar también la lógica de recalibración/transición de `level-calibration.js` a un módulo server-only?** (§2) — ronda propia con paridad de `officialize-onboarding`.
2. **¿Fijar `esm.sh` de las Edge Functions?** (§5) — acoplado a un redeploy de Edge.
3. Las ya abiertas en 138: origen/dominio estable (§4), Pages y repo privado.
