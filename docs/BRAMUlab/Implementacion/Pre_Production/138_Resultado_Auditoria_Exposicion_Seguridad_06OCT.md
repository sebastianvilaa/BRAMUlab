# 138 — Resultado · Auditoría de exposición / seguridad previa a Production

**Fecha:** 06/10/2026  
**Rama:** `staging` · **HEAD auditado:** `dad149c`  
**Tipo:** auditoría focalizada, **no destructiva**. No se cambió visibilidad, configuración, credenciales, historia Git, Supabase, Vercel, `main`, Production ni BRAMUlive.  
**Insumos:** handoff 136 + evaluación Central 137.

> Este informe es público junto con el repo: **no contiene valores de secretos**. Solo categorías, rutas, conteos y estados.

---

## 0. Veredicto

| Pregunta | Respuesta |
|---|---|
| ¿Hay alguna credencial real, actual o histórica, en el árbol o en la historia Git? | **NO se encontró ninguna.** |
| ¿Hace falta rotar algo? | **No por esta auditoría.** |
| ¿Se puede privatizar el repo hoy sin romper nada? | **No todavía.** Hay dependencias reales de repo público (§4); la principal es el logo de los emails. |
| ¿El artefacto del navegador filtra algo sensible? | **No.** Filtra *mucha información interna innecesaria* (≈ 594 KB de comentarios de proceso) y, si Production se publica tal cual, también tests y scripts (§5). |
| ¿Hay solución mínima? | **Sí, sin toolchain nueva:** carpeta de salida por allowlist + retiro de comentarios *de línea completa* en el build (§5.4). |

**Límite honesto del veredicto:** "no se encontró" significa que no apareció con el método descrito en §1. No es una prueba matemática de ausencia (ver §1.3). Mitigación recomendada: correr `gitleaks`/`trufflehog` una vez en una máquina de Central antes de privatizar.

---

## 1. Alcance y método

### 1.1 Qué se auditó

- **Historia Git completa accesible:** 851 commits, 8.640 objetos (3.262 blobs de texto), todas las ramas locales y remotas (`main`, `staging`, ramas locales viejas), 86 tags, y **objetos no alcanzables** del almacén local (`git cat-file --batch-all-objects`, no solo `git log`).
- **Commits huérfanos de GitHub:** el historial de Actions mostró 4 commits del 21/09 que ya no pertenecen a ninguna rama; se recuperaron por SHA (lectura) y se escanearon. Además se contrastaron los 402 SHAs de los *deployments* de GitHub contra el almacén local: todos estaban presentes.
- **Árbol de trabajo actual** (`HEAD`) + archivos sin trackear (`Referencias/`, 13 MB, no está en Git y **no** se incluye en este commit).
- **Texto público fuera del código:** 30 issues + 175 comentarios de issues (0 PRs).
- **Metadatos de GitHub vía API de solo lectura:** visibilidad, Pages, hooks, deploy keys, Actions (workflows y *nombres* de secrets), colaboradores, protección de ramas, tráfico.
- **Sondeos HTTP GET** a URLs públicas (Pages, Vercel) para confirmar qué se sirve.

### 1.2 Cómo se buscó (sin imprimir valores)

Escáner propio en Python (no había `gitleaks`/`trufflehog` instalados; no se instaló nada). Todo resultado se redactó: solo ruta, línea, categoría y longitud.

- Formatos de proveedor: JWT (decodificando el claim `role` localmente), `sb_secret_`/`sb_publishable_`, `sbp_`, claves privadas PEM, tokens de GitHub (`ghp_`/`github_pat_`…), AWS, Google OAuth/API, Slack, Stripe, Resend/SendGrid, URLs de Postgres con password.
- Asignaciones por nombre: `*PASSWORD*`, `*SECRET*`, `*TOKEN*`, `*API_KEY*`, `*PEPPER*`, `*SERVICE_ROLE*`, `*SMTP_*`, clasificando el valor como placeholder/referencia/literal.
- Contraseña de aplicación de Gmail: formato `xxxx xxxx xxxx xxxx` y 16 minúsculas junto a palabras clave (`smtp`, `gmail`, `app password`…).
- Tokens tipo Vercel (24 alfanuméricos con contexto), IDs `prj_`/`team_`/`dpl_`.
- Entropía genérica (cadenas ≥ 28 caracteres) y base64 largo, revisando cada hit por clase.
- Nombres de archivo sensibles alguna vez presentes en la historia (`.env*`, `.pem`, `.key`, `credentials*`, dumps, exports).

### 1.3 Lo que NO cubre

- Binarios (PNG/JPG/`Logo.ai`): no se inspeccionó su contenido.
- Secretos con formato no reconocido y sin contexto de nombre (un string aleatorio suelto de 16–23 caracteres sin palabra clave cerca).
- Logs de ejecución de Actions (158 runs): `Actions secrets = 0`, así que ningún workflow pudo usar secrets del repo; igualmente los logs no se descargaron.
- Cualquier cosa fuera de GitHub/Git (paneles de Vercel/Supabase, variables de entorno reales): **no se tocó ni se miró**, por mandato.

---

## 2. Secretos — resultado

### 2.1 Resultado por categoría

| Categoría | Árbol actual | Historia | Estado |
|---|---|---|---|
| Supabase service-role / `sb_secret_` / `sbp_` | 0 | 0 | Limpio. Solo hay *nombres* de variable (`SUPABASE_SERVICE_ROLE_KEY`) leídos de `Deno.env`/`process.env`. |
| SMTP / Gmail App Password | 0 | 0 | Limpio. `BRAMU_SMTP_*` solo como nombres de variable de entorno. |
| `BRAMU_CHALLENGE_PEPPER` | 0 | 0 | Limpio. Solo el nombre, leído del entorno de la Edge Function. |
| Tokens de Vercel (`prj_`/`team_`/`dpl_`/tokens) | 0 | 0 | Limpio. |
| PAT/tokens de GitHub | 0 | 0 | Limpio. |
| Claves privadas PEM | 0 | 0 | Limpio. |
| OAuth / client secrets (Google, Slack, Stripe, etc.) | 0 | 0 | Limpio. |
| URLs de base de datos con password | 0 | 0 | Limpio. |
| `.env` real | 0 | 0 | Solo `bramulab/.env.example` (en historia 1 commit; valores vacíos salvo el nombre del entorno). `.gitignore` cubre `.env`, `.env.*`, `env.generated.js`. |
| JWT literales | 1 fixture | 1 fixture | Falso positivo: token de 76 caracteres dentro de un test del propio escáner (`bloque9a-release.test.mjs`), sin claim `role`. |
| `sb_publishable_` | 2 fixtures | 2 fixtures | **Público por diseño** y, además, valores de ejemplo en tests (`api/health.test.mjs`, `supabase/scripts/release-check.mjs`). La key publishable real de Staging **no aparece en ningún commit** (se inyecta por variable de entorno en el build). |
| Entropía / base64 largo | 0 secretos | 0 secretos | Todo clasificado: nombres de archivo en comentarios, prosa, rutas, data-URIs de imagen. |
| Issues y comentarios públicos | 0 | — | Limpio. |
| Commits huérfanos de GitHub (4 + 402 SHAs de deployments) | — | 0 | Limpio. |

### 2.2 Hallazgos menores (no son credenciales reales)

| ID | Hallazgo | Severidad | Detalle / acción |
|---|---|---|---|
| S-1 | **Passwords de cuentas sintéticas hardcodeadas** en 7 scripts `supabase/tests/verify-*.mjs` (y fixtures de `tests.html`/tests) | **Baja** | Son literales fijos para usuarios `bramu-verify-…@example.com` con *timestamp* en el email. Los scripts los borran al terminar (`deleteUser`/cleanup presentes en los 7). Riesgo residual solo si alguna corrida murió a mitad y dejó una cuenta viva en Staging con password conocido. Acción sugerida (Central, Staging): verificar que no queden `bramu-verify-*` en `auth.users`; a futuro generar el password por corrida. **No es rotación**: no hay credencial real. |
| S-2 | **GitHub secret scanning y push protection están deshabilitados** en el repo (también Dependabot) | Media (prevención) | En repos públicos son gratuitos. Habilitarlos es un cambio de configuración: requiere autorización explícita. No habría cambiado el resultado de esta auditoría pero habría avisado en tiempo real. |
| S-3 | **Email personal del titular** como autor de 384 de 851 commits y mencionado 1 vez en un documento (`BRAMUlab_Backend_Informe.md`) | Baja (PII, no credencial) | Es metadata de Git, inseparable de la historia pública. Mitigable a futuro configurando el email `noreply` de GitHub (los 467 commits restantes ya lo usan). **No** reescribir historia por esto. |
| S-4 | `.claude/launch.json` (trackeado) contiene la ruta local `/Users/<usuario>/Library/CloudStorage/Dropbox/…` | Muy baja | Revela nombre de usuario de macOS y estructura de carpetas. Higiene. |
| S-5 | La cuenta `bramulab@gmail.com` es a la vez contacto público (legales, app) e identidad de envío SMTP | Informativa | Está bien como diseño, pero esa cuenta pasa a ser blanco de phishing/ingeniería social: activar 2FA y revisar que la contraseña de aplicación sea revocable (fuera del alcance de este informe). |

**Distinción de valores públicos por diseño:** la Supabase *publishable/anon key* y la URL del proyecto se tratan como públicas (llegan al navegador); no se cuentan como hallazgo. El **ref del proyecto Supabase de Staging** aparece en documentos internos y es un identificador público (también está en el navegador); no es un secreto, pero es un dato que sobra en un repo público.

### 2.3 Conclusión de la sección

No hay ninguna credencial que deba tratarse como expuesta ni rotarse **por lo hallado en Git/GitHub**. Cualquier credencial que Sebastián o un agente haya *pegado en un chat* o guardado fuera del repo queda fuera de lo auditable acá.

---

## 3. Exposición actual del repositorio

| Hecho | Evidencia |
|---|---|
| Visibilidad | **PUBLIC** desde su creación (26/08/2026). |
| Alcance social | 0 forks, 0 estrellas, 1 solo colaborador (titular, admin). |
| **Tráfico de clonado (últimos 14 días)** | **4.490 clones, 1.468 únicos.** Es un volumen incompatible con una persona o un equipo: indica rastreo automático (indexadores, scrapers de secretos, espejos). **Asumir que todo el contenido público ya fue copiado.** Es otra razón por la que "privatizar después" no revoca nada. |
| **GitHub Pages: ACTIVO** | Publica **toda la rama `main`** en `sebastianvilaa.github.io/BRAMUlab/`: la raíz da 404, pero `/bramulab/` (la app, versión V04.10), `/bramulab-partidos/` y **`/docs/BRAMUlab/*.md`** responden 200 sin autenticación. 152 deployments históricos; último build 16/09. |
| Protección de ramas | Ninguna (`main` y `staging` sin protección). |
| Actions | 1 workflow histórico (`B6 Hotfix Verify`, 21/09, hoy inexistente en las ramas), 0 secrets, 0 variables. |
| Webhooks / deploy keys / releases | 0 / 0 / 0. |
| Issues | 30 abiertos o cerrados: contienen trazabilidad interna del proyecto (públicos). |
| Superficie interna publicada | 516 archivos trackeados: 171 en `docs/BRAMUlab`, 196 en `supabase/`, 100 en `bramulab/`, 23 en `docs/identidad-visual` (17,5 MB). Incluye **fórmula de Nivel, reglas de Intelligence, modelo de datos, RPCs, migraciones y runbooks** (propiedad intelectual del producto, no secretos). |

---

## 4. Mapa de dependencias de "repo público"

Estado: **Verificado** = comprobado con evidencia en esta auditoría · **No verificado** = no se pudo comprobar sin tocar paneles.

| Consumidor | ¿Depende de que sea público? | Evidencia | Qué pasa al privatizar |
|---|---|---|---|
| **Vercel — proyecto BRAMUlab** (Root `bramulab/`) | **No** (usa la GitHub App) | Verificado: deployments creados por `vercel[bot]` (193 `Preview – bramulab`); el alias `…git-staging…vercel.app` responde 302 → login (Deployment Protection activa). | Debería seguir funcionando. **No verificado:** que la instalación de la App incluya este repo explícitamente y que el scope/plan de Vercel admita repos privados del usuario personal. Chequeo para Work en el panel. |
| **Vercel — proyecto BRAMUlive** (Root `bramulive/`) | **No**, pero **comparte repo** | Verificado: 138 deployments `Production – bramulive`; `bramulive.vercel.app` responde 200. | Misma App, mismo repo: sigue funcionando bajo las mismas condiciones. **BRAMUlive está en producción real**; cualquier error de privatización lo afecta. |
| **GitHub Pages** (`github.io/BRAMUlab/`) | **Sí** | Verificado: sirve `main` completo (§3). | En el plan **Free**, Pages de repos privados **no** funciona y se despublica. El plan de la cuenta **no pudo verificarse** (la API no lo expone). **DECISIÓN ABIERTA** (§7). |
| **`raw.githubusercontent.com`** | **Sí — dependencia crítica** | Verificado: logo del email fijado a un commit (`…/<sha>/bramulab/icons/logo.png`, hoy responde 200) en `supabase/email-templates/auth/*.html` (4 plantillas), `supabase/email-templates/manifest.json`, `supabase/email-templates/README.md`, `supabase/functions/_shared/email-templates.mjs` (`NATIVE_VARS.logoBase`, usado por el Email #8 / desafíos) y la lista negra de `sync-auth-email-templates.mjs`. | El logo de **todos** los emails (Auth nativos y Edge) pasa a 404: imagen rota. Arreglarlo exige cambiar plantillas + `logoBase` + **redeploy de la Edge Function** + **re-sincronizar Auth templates** en Supabase. |
| **Código de la app** (`bramulab/`, `bramulive/`) | No | Verificado: ninguna URL a GitHub/Pages/raw en código no-test; solo comentarios sobre el origen `github.io` (`store.js`, `sw.js`). La única dependencia externa de runtime es supabase-js por jsDelivr **npm** (no GitHub). | Sin efecto. |
| **Edge Functions / migraciones / scripts** | No | Verificado: `release-check.mjs` y el resto usan `git ls-files` local y `SUPABASE_*` por entorno. No hay `config.toml` ni evidencia de integración Supabase↔GitHub (branching). | Sin efecto. |
| **ChatGPT Central** (lee HEAD, diff, docs "directamente desde el repo") | **No verificado** | Método de trabajo (`Metodo_Trabajo.md`) asume acceso por conector. | Necesita acceso autenticado al repo privado (conector/App con permiso sobre el repo). Si hoy lee por URL pública o `raw`, se rompe. |
| **Claude Code** | No | Verificado: `gh`/Git por HTTPS con token del keyring, scope `repo`. | Sin efecto. |
| **Work** (navegador/GUI) | **No verificado** | — | Cualquier lectura anónima de github.com/raw pasaría a requerir sesión. |
| **Issues referenciados en docs** (#23, #28, etc.) | No funcional | — | Pasan a ser privados; los links solo sirven para el titular. |

---

## 5. Artefacto público del navegador

### 5.1 Qué recibe realmente el cliente hoy

- `bramulab/vercel.json` define `outputDirectory: "."` y **no existe** `.vercelignore`. Es decir, en un deploy **sin protección** (Production) se serviría **todo el contenido de `bramulab/`**, no solo la app:
  - app real: `index.html` (300 KB), 25 JS de app, `styles.css` (325 KB), `sw.js`, manifest, iconos, páginas legales;
  - **no necesarios para el usuario:** `tests.html` (564 KB), **48** archivos `*.test.mjs` (1,0 MB), `scripts/` (guards de build), `.env.example`, `vercel.json`, fuentes de `api/`.
- Los previews de Staging hoy **no** son públicos (Deployment Protection), por lo que el problema actual es **latente** y se activa recién cuando exista Production sin protección.
- **Source maps:** ninguno (0 `.map`, 0 `sourceMappingURL`).
- **`manifest.webmanifest`, `version.json`, `sw.js`:** sin datos sensibles (solo versión/bundle, scope y lista de assets).
- **`/api/health`:** responde nombre del entorno y errores de conectividad; sin secretos. Conviene que en Production no devuelva `detail` de errores de red.
- **Dependencia no fijada:** `index.html` carga supabase-js desde jsDelivr con `@2` (versión mayor flotante) y **sin SRI**. Riesgo de cadena de suministro (B), no de exposición; sugerido fijar versión exacta + `integrity`.

### 5.2 Cuantificación de comentarios (archivos que consume la app: HTML, JS de app, CSS, SW, páginas legales)

Medición con tokenizador propio (verificado: los 26 JS resultantes pasan `node --check`). Es una estimación, no un parser formal.

| Métrica | Valor |
|---|---|
| Tamaño total de fuentes de la app | 2,65 MB |
| Comentarios | **≈ 1,12 MB (42 %)** en 6.376 comentarios |
| ↳ **A — dato realmente sensible** | **0** (los 3 "hits" son falsos positivos: menciones del origen `github.io` en `store.js`/`sw.js` y la ruta `/users/` de una API) |
| ↳ **B — información interna innecesaria** | **≈ 594 KB · 1.906 comentarios** |
| ↳ **C — comentario técnico inocuo/útil** | ≈ 522 KB · 4.470 comentarios |
| Gzip (lo que viaja) sin tocar | 796 KB |
| Gzip tras retirar comentarios | **348 KB (−56 %)** |

Por archivo, los más pesados: `app.js` 395 KB de comentarios (2.953), `styles.css` 160 KB, `index.html` 91 KB (224 comentarios, ~30 % del archivo), `stats.js` 77 KB.

**Qué hay en B** (conteo de menciones dentro de los archivos que llegan al navegador): "handoff" 232, "Central" 97, "Claude" 47, "ChatGPT" 32, "Sebastián" 3, "Laboratorio" 76, "QA" 90, "Staging" 30, rutas `docs/BRAMUlab/…` 21, referencias a Issues 18, referencias a versiones `V0x.y` ≈ 1.265 y a rondas `hNN` ≈ 307, "Bloque N" 305. Es **arqueología de proceso y de agentes**: no es secreto, pero cuenta cómo se construyó el producto, quién interviene y dónde está la documentación. Además `index.html` empieza con historia de versiones en comentarios HTML.

**Información técnica visible igual por red (no requiere ocultarse):** nombres de RPC/Edge Functions invocadas, estructura de tablas expuestas por RLS. La seguridad real está en RLS/RPC/rate limits/secretos fuera del cliente; el JS siempre es inspeccionable.

### 5.3 Clasificación de lo anterior

- **A (sensible):** ninguno hallado.
- **B (interno innecesario):** comentarios de proceso/agentes/handoffs/versiones (≈ 594 KB) · tests, `tests.html` y `scripts/` servidos desde la carpeta de salida (≈ 1,6 MB sin valor para el usuario).
- **C (inocuo):** comentarios que explican el *porqué* del código (invariantes, trampas de CSS/Auth, contratos de RPC).

### 5.4 Solución MÍNIMA compatible con la arquitectura actual

Ya existe un paso de build (`node scripts/build-env.mjs`) y un chequeador de release (`supabase/scripts/release-check.mjs`). Propuesta, **sin dependencias nuevas ni bundler**:

1. **Carpeta de salida por allowlist** (`bramulab/dist/`): copiar solo lo que la app necesita (`index.html`, JS de app, `styles.css`, `sw.js`, manifest, `version.json`, `env.generated.js`, `robots.generated.txt`, `icons/`, `assets/`, `privacidad/`, `terminos/`, `eliminar-cuenta/`) y apuntar `outputDirectory` a esa carpeta. Deja fuera tests, `tests.html`, `scripts/`, `.env.example` y `vercel.json`. `api/` sigue siendo detectado por Vercel desde el Root Directory.
2. **Retirar solo comentarios de línea completa** en la copia (JS `//` y `/* */`, CSS `/* */`, HTML `<!-- -->`), **no** comentarios finales de línea ni minificar. Medido: esa regla captura prácticamente el 100 % del peso de los comentarios (JS de app 2,00 MB → 1,11 MB; gzip 596 KB → 254 KB) y es mucho menos riesgosa que parsear comentarios al final de una línea de código.
3. **El código fuente del repo no se toca**: los comentarios útiles siguen en Git para mantenimiento.
4. **Verificación en el propio build:** `node --check` de cada JS de `dist/`, test de que ningún archivo de `dist/` coincide con los patrones de `FORBIDDEN` de `release-check.mjs`, y que `tests.html`/`*.test.mjs` no están en `dist/`.
5. **Prueba antes de Production:** correr la suite de navegador (`tests.html`) y un smoke contra una vista previa generada desde `dist/` (Work), y verificar `CORE_ASSETS` del Service Worker.

Efecto colateral positivo: **−56 % de bytes transferidos** en primera carga y en actualizaciones del Service Worker.

**Costos/riesgos honestos:** (a) toca el build de BRAMUlab (un push → un deploy, revisar contra la cuota); (b) la regla "solo línea completa" puede, en teoría, tocar una línea que parezca comentario dentro de un template literal multilínea: `node --check` y la suite lo detectan en la práctica, no lo descartan formalmente; (c) **no es seguridad**: es higiene y rendimiento.

---

## 6. Documentación — mapa (sin borrar ni mover nada)

Hay un **acoplamiento código/tests → docs** que condiciona cualquier poda: **37** documentos distintos son citados desde comentarios de `bramulab/` y `supabase/`, y **7 tests leen archivos de `docs/`** en ejecución (p. ej. `Metodo_Trabajo.md`, `Nivel_BRAMU.md`, `82_Resultado_Pre_Bloque_9_Hardening_Staging_30SEP.md`, `docs/BRAMUlab/` como directorio, `identidad-visual/BRAMULab icono2.png`, `generar-iconos-pwa.py` y una imagen de `referencias-premier-padel/`). **Podar sin ajustar esos tests los rompe.**

### 6.1 Conservar (fuentes maestras)

`README.md`, `Metodo_Trabajo.md`, `Pre_Production.md`, `Backend_Infraestructura.md`, `Nivel_BRAMU.md`, `Ranking_BRAMU.md`, `Grupos_BRAMU.md`, `BRAMU_Intelligence.md` + `…_Implementacion.md`, `Experiencia_Inicial.md`, `Cargar_Partido.md`, `Privacidad_Legal.md`, `Runbook_Operacion_y_Salida.md`, `BRAMUlab_Backlog.md`, `Legal/*` (borradores), `Versiones/*` (Consolidados e Informes), `Implementacion/Pre_Production/README.md`, `Implementacion/Backend/00_LEEME.md` y los 6 `Cierre_Bloque_*` de Backend. Código `supabase/`, `bramulab/`, `bramulive/`.

### 6.2 Candidatos a podar más adelante (handoffs/resultados consumidos)

- **`Implementacion/Pre_Production/`: 81 archivos; 47 no están citados por ninguna fuente maestra ni por código** (todos handoffs, resultados, gates o fixes de rondas ya cerradas: 64, 67–81, 83–86, 89, 91, 92, 95–100, 105–109, 113, 116–118, 124, 126, 133, 136, 137, etc.). Los otros 34 sí están citados y no deben moverse sin actualizar quien los cita.
- `Implementacion/Backend/` (21): evidencia de cierres de bloque; conservar los `Cierre_*` y validaciones citadas, el resto es consumible.
- `Archivo/` (39): por README **no es autoridad**; candidato natural a salir de un release público (la historia queda en Git).
- `Versiones/BRAMUlab_V0x`: valor de trazabilidad; decidir si se conserva completo.

### 6.3 Temporales / duplicaciones / que no deberían estar en un release público

| Qué | Dónde | Nota |
|---|---|---|
| **Fotos de referencia de terceros (Premier Padel)** y moodboards | `docs/identidad-visual/referencias-premier-padel/` (≈ 18 imágenes) | **Riesgo de derechos de autor** en un repo público (no es un secreto). Un test de V04.28 lee una de ellas. |
| Activos pesados de identidad | `docs/identidad-visual/` (23 archivos, 17,5 MB, incl. `Logo.ai`) | En historia hay además `redes-sociales/ChatGPT*` (varios MB) ya borrados. |
| `Referencias/` | raíz, **sin trackear**, 13 MB | No commitear. |
| `Temporales/`, `.DS_Store`, `.claude/worktrees/` | raíz | Ya ignorados. |
| `.claude/launch.json`, `dev-server*.py` | trackeados | Tooling local con ruta del titular. |
| `87_release_manifest.json` / `84_…` | `Pre_Production/` | Manifest derivado; regenerable con `release-check.mjs`. |
| `INDICE.md` | raíz | Revisar vigencia. |
| `bramulive/tests.html`, `docs/BRAMUlive/` | trackeados | BRAMUlive: **no tocar** sin autorización. |
| Rama local `add-bramu-lab-app` | local (2 commits locales; el remoto fue borrado) y `claude/goofy-shaw-ed307a` | Escaneadas: limpias. Decidir si se conservan. |

Podar archivos **no los saca de la historia pública ya clonada** (§3). Su valor es de orden y de exposición hacia adelante.

---

## 7. Plan para un eventual repo privado

**Premisa:** privatizar es reversible (se puede volver a público) pero **no revoca** lo ya clonado; se hace para reducir exposición de propiedad intelectual y de proceso, no para proteger secretos (no hay). Recomendación de Central (137): privatizar **antes de usuarios externos**. Esta auditoría la respalda, con las precondiciones de abajo.

### Decisiones abiertas (Sebastián)

1. **DECISIÓN ABIERTA — GitHub Pages:** ¿alguien usa `sebastianvilaa.github.io/BRAMUlab/…` (la PWA V04.10 instalada, links viejos)? Si no: **despublicarlo a propósito** antes de privatizar (cierra además la copia pública de `docs/`). Si sí: migrar esos usuarios primero. Además hay que confirmar el **plan de GitHub** (Pages privado exige plan pago).
2. **DECISIÓN ABIERTA — origen público estable** (dominio/subdominio de la app): es el destino natural del logo de los emails y de la futura Production.
3. **Autorización explícita** para cada cambio de configuración externo (visibilidad, Pages, secret scanning, Vercel, Supabase).

### Secuencia segura

| # | Paso | Quién | Reversible | Gate previo |
|---|---|---|---|---|
| 0 | Decidir Pages y origen estable (decisiones 1–2). | Sebastián | — | — |
| 1 | **Mover el logo de los emails a una URL pública estable** que no dependa de GitHub (origen de Production, o bucket público de Supabase Storage solo para el logo si el dominio tarda). Actualizar las 4 plantillas Auth, `manifest.json`, `README`, `_shared/email-templates.mjs` (`logoBase`) y el chequeo de `sync-auth-email-templates.mjs`. | Claude (código) + Central (aplicar en Staging) | Sí | Decisión 2 |
| 2 | **Redeploy** de las Edge Functions que importan `email-templates.mjs` y **re-sincronizar plantillas Auth** en Supabase Staging; **enviar un email real** y confirmar que el logo carga con el repo todavía público. | Central/Work | Sí | Paso 1 |
| 3 | Despublicar GitHub Pages (si se decidió). Confirmar 404 en la URL vieja. | Sebastián/Central | Sí | Decisión 1 |
| 4 | Verificar en el panel de **Vercel**: que la GitHub App tenga acceso a este repo, scope/plan compatible con repos privados, y que ambos proyectos (BRAMUlab y BRAMUlive) usen esa conexión. | Work | Sí | — |
| 5 | Confirmar que **ChatGPT Central, Claude Code y Work** leen el repo con acceso autenticado, sin URLs `raw`/Pages. | Central/Work | Sí | — |
| 6 | (Recomendado) Correr `gitleaks`/`trufflehog` completo sobre el clon en una máquina de Central; archivar el resultado sin valores. | Central | n/a | — |
| 7 | **Privatizar** (no antes de 1–6). Hacerlo sin pushes pendientes en `staging`/`main`. | Sebastián (autoriza) | Sí | 1–6 verdes |
| 8 | Verificar: `bramulive.vercel.app` sigue 200; el próximo push (el de la ronda siguiente, sin push extra solo para probar) crea el deployment de Staging normalmente; el logo del email carga; Pages 404; Central/Work leen el repo. | Work/Central | — | Paso 7 |
| 9 | Después: aplicar §5.4 (dist + comentarios), podar docs según §6 con tests ajustados, habilitar branch protection si se desea. | Claude/Central | Sí | Ronda propia |

**No romper BRAMUlive:** ningún paso toca su código ni su proyecto de Vercel. Riesgo propio: que la App de Vercel pierda acceso al repo al cambiar la visibilidad (verificado en el paso 4 *antes*, y en el paso 8 *después*).

**Cuota Vercel:** los pasos 1–2 tocan `supabase/` y `docs/` (fuera de `bramulab/`/`bramulive/`); el paso 7 no genera push. §5.4 sí toca `bramulab/` (1 deploy intencional).

---

## 8. Resumen de hallazgos y prioridades

| ID | Tema | Severidad | ¿Antes de Production? | Dueño sugerido |
|---|---|---|---|---|
| E-1 | Repo público con 1.468 clonadores únicos en 14 días; contiene IP de producto y proceso | Media | Sí (privatizar antes de externos) | Sebastián/Central |
| E-2 | **GitHub Pages sirve `main` completo (app V04.10 + docs)** sin que figure en ninguna decisión vigente | **Media** | Sí (decidir y despublicar/migrar) | Sebastián |
| E-3 | Logo de emails depende de `raw.githubusercontent` (4 plantillas + Edge #8) | **Alta si se privatiza** | Sí, precondición | Claude + Central |
| E-4 | `outputDirectory "."`: Production serviría tests, `tests.html`, scripts y `.env.example` | Media (latente) | **Sí** | Claude |
| E-5 | ≈ 594 KB de comentarios de proceso/agentes en el artefacto (A = 0) | Baja (información) | Deseable | Claude |
| E-6 | Secret scanning/push protection deshabilitados | Media (prevención) | Deseable | Sebastián (autoriza) |
| E-7 | supabase-js por jsDelivr `@2`, sin SRI | Baja–media | Deseable | Claude |
| E-8 | Fotos de terceros (Premier Padel) en repo público | Media (derechos) | Antes de difusión | Sebastián/Central |
| E-9 | 47 handoffs/resultados sin referencia + acoplamiento tests↔docs | Baja | Después | Claude/Central |
| S-1…S-5 | Ver §2.2 | Baja | No bloquean | — |

**No hay hallazgo que bloquee por sí solo el avance de la ronda V04.36 (`Anular carga`/icono).** Los bloqueantes para **abrir Production** son E-3 (si se privatiza), E-4 y la decisión sobre E-2.

---

## 9. Qué NO se hizo

Sin cambios en repo (salvo este informe), visibilidad, Pages, Actions, Vercel, Supabase, credenciales, historia Git, `main`, Production ni BRAMUlive. Se hizo `git fetch` y un *fast-forward* local de `staging` a `origin/staging` para leer 136/137; y la descarga de 4 objetos huérfanos de GitHub al almacén Git **local** para escanearlos.
