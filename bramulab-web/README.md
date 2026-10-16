# BRAMUlab Web — sitio público

**Estado (14/10/2026): PUBLICADA en `https://bramulab.com`** (proyecto Vercel `bramulab-web`, equipo `bramu-lab`; `www.bramulab.com` redirige 308 a `bramulab.com`; HTTPS con certificado Let's Encrypt). Indexable (sin `noindex`, `robots.txt` permite todo y declara el sitemap). **Medición web (BRAMU Metrics) ACTIVA desde el 14/10/2026** (visitas y clics hacia la entrada de la app, contadores diarios agregados; ver «Medición web»).

## Qué es esta carpeta
Sitio público de presentación de BRAMUlab, previsto para `bramulab.com`. **Proyecto independiente** de la aplicación `bramulab/` (en `app.bramulab.com`) y de BRAMUlive. Comparte repositorio Git pero es **hermana** de `bramulab/`, no parte de la app, y se publicará en un **proyecto de Vercel propio**.

## Por dónde empezar
- [Concepto, decisiones y estado](docs/BRAMUlab_Web.md): relato, UX, requisitos, §10 Web Analytics (contrato de Metrics) y §11 estado de implementación.
- [Bases de diseño web](docs/Bases_Diseno_Web.md): brief visual, complementario a la identidad maestra (`../docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md`).

## Organización
```text
bramulab-web/
├── public/                         # LO ÚNICO QUE SE PUBLICA (outputDirectory)
│   ├── index.html                  # single page (también abre con doble clic)
│   ├── css/  js/                   # estilos y scripts (sin frameworks); js/web-metrics.js = medición, INACTIVA
│   ├── assets/{brand,img,fonts,social}/
│   └── robots.txt  sitemap.xml  favicon.ico
├── api/metrics.js                  # Vercel Function del contador (solo del proyecto web)
├── vercel.json                     # outputDirectory, www → bramulab.com, cabeceras, función
├── .vercelignore                   # docs/, README, .claude/ y el launcher no se suben
├── Iniciar-vista-previa.command    # servidor local para ver la web en el iPhone
└── docs/                           # documentación interna (no pública)
```
`public/js/web-metrics.js` (v1.1, commit `0e4fbed5`) y `api/metrics.js` son los archivos de BRAMU Metrics, **sin modificar**.

## Vista previa local (sin publicar nada)
- **Mac:** doble clic en `public/index.html` (rutas relativas, no hace falta servidor).
- **iPhone (mismo Wi-Fi):** doble clic en `Iniciar-vista-previa.command` (la primera vez, clic derecho → Abrir). La Terminal muestra una dirección `http://<IP de la Mac>:8080`; ábrila en Safari. Cerrar la ventana detiene el servidor. Solo visible en tu red local.
- Alternativa manual: `cd bramulab-web/public && python3 -m http.server 8080 --bind 0.0.0.0`.

## Medición web (BRAMU Metrics) — ACTIVA desde el 14/10/2026
Mide solo **visitas** (aperturas de `bramulab.com`, recargas incluidas) y **clics hacia la entrada de `https://app.bramulab.com`**; sin personas, IP, cookies ni sesiones. Contrato: `docs/BRAMUlab_Web.md` §10; estado y evidencia de la activación: `../docs/BRAMUlab/README.md` (14/10/2026).
- `public/js/web-metrics.js` (v1.1, commit `0e4fbed5`, blob `ce20d9af…`) y `api/metrics.js` son los archivos de BRAMU Metrics, **sin modificar**. `bramulab-web/js/web-metrics.js` es el canónico que usan las pruebas de Metrics; la copia de `public/js/` es la que se despliega y **debe mantenerse idéntica**; se carga con `<script defer src="/js/web-metrics.js">` al final de `public/index.html` (una sola vez).
- CTA etiquetados: `login` (Entrar), `hero`, `instalacion` (enlace del paso 1), `final`; «Abrir la app» del pie cuenta como `other`. **«Términos» y «Privacidad» no cuentan.** Los enlaces son directos, sin parámetros ni redirecciones; el script solo actúa en `bramulab.com`/`www` y si falla nunca bloquea la navegación.
- Variables **solo de servidor** del proyecto `bramulab-web` (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_METRICS_ALLOWED_ORIGIN=https://bramulab.com` (Supabase Production; nunca claves de Staging; no están en archivos). Las Previews no las tienen.
- **Desactivarla:** volver a comentar la etiqueta y publicar (o quitar las variables). Los contadores ya guardados se conservan.
- Limitaciones: Origin se puede falsificar fuera del navegador y los bloqueadores restan eventos. Los eventos de la prueba del 14/10 (1 vista, 1 clic `hero`) quedaron incluidos en el contador.
- La Política de Privacidad ya informa esta medición (`../docs/BRAMUlab/Operacion/Privacidad_Legal.md` §20; decisión legal humana abierta).

## Preview en Vercel (creada el 14/10/2026)
- **Proyecto:** `bramulab-web` (equipo `bramu-lab`), independiente de `bramulab` y `bramulive`; sin Git conectado, sin dominios, **sin variables de entorno**. La carpeta local queda enlazada en `.vercel/` (ignorado por `.vercelignore`; no se versiona).
- **Preview anterior (14/10/2026):** `https://bramulab-5yu21agd5-bramu-lab.vercel.app`, protegida con Vercel Authentication. El proyecto hoy usa la protección «todas excepto dominios personalizados» (ver Lanzamiento).
- **Cómo se actualiza:** desde esta carpeta, `npx vercel deploy --target preview --scope bramu-lab` (nunca `--prod`). Hace falta sesión de Vercel (`npx vercel login`, aprobación humana). Para mirarla sin sesión del navegador: `npx vercel curl <ruta> --deployment <url> --scope bramu-lab`.
- **Aviso:** la primera publicación de un proyecto nuevo Vercel la asigna a **Production** aunque se pida preview. Ocurrió; se corrigió (protección total, nueva Preview real y eliminación de ese deployment). Después de ese incidente se publicó el sitio en Production de forma deliberada (ver Lanzamiento).
- **Root Directory:** queda en `.` porque la carga directa sube esta misma carpeta. Si algún día se conecta Git, cambiarlo a `bramulab-web`.
- **Qué sirve:** solo `public/` y `/api/metrics` (rechaza todo sin variables). `README`, `docs/`, `vercel.json`, `.claude/` y el launcher dan 404. Las Previews llevan `X-Robots-Tag: noindex` de Vercel.
- **Medición:** las Previews no tienen las variables de servidor, así que `/api/metrics` las rechaza; además el script solo actúa en `bramulab.com`/`www`, no en `*.vercel.app`.
- **No verificable en la Preview:** vista previa social, redirección `www` y medición real (dependen de `bramulab.com`).

## Lanzamiento (realizado el 14/10/2026) y lo que sigue pendiente
- **Hecho:** deploy de Production del proyecto `bramulab-web`; dominios `bramulab.com` y `www.bramulab.com` asociados (www → apex, 308); DNS en Cloudflare: `A @ → 216.198.79.1` y `CNAME www → aa138c660d16aecf.vercel-dns-017.com`, ambos **solo DNS** (sin proxy); el registro `app` y el correo no se tocaron; `noindex` retirado; `robots.txt` y `sitemap.xml` habilitados.
- **Protección:** Vercel Authentication «todas excepto dominios personalizados»: `bramulab.com` y el alias `bramulab-web.vercel.app` son públicos; las URL únicas de cada deployment y las Previews siguen protegidas.
- **Medición web:** activada el 14/10/2026 (ver sección anterior).
- **Política de Privacidad:** ya menciona el sitio web y su medición (14/10/2026). Selector iPhone/Android sin navegación con flechas y logo del encabezado con área táctil chica (menores).
- **Para publicar cambios:** desde esta carpeta, `npx vercel deploy --prod --scope bramu-lab` (actualiza `bramulab.com`); `npx vercel deploy --target preview --scope bramu-lab` genera una Preview protegida. Nota: una Preview nunca debe ser el primer deploy de un proyecto (Vercel lo manda a Production).

## Franja «Cada partido tiene una historia.» (V04.47)
Sección `#puente` entre el hero y «Cómo funciona» (`public/css/puente.css`, `public/js/puente.js`): cancha real con peloteo → celular → historial, secuencia inicial y luego «viva» (peloteo continuo, destello, tilde, barras que se re-arman) mientras es visible; las cuatro demostraciones de «Cómo funciona» (`js/demos.js`) también repiten. Estado final sin animaciones/JS/movimiento reducido. Pruebas: `tests/puente.test.mjs`. Detalle: `docs/BRAMUlab_Web.md` §12. **Publicada en Production el 15/10/2026**: deployment `dpl_7FKXg96Lginw7DLp5GBrhaQr8hrH` (**READY**) sobre `bramulab.com` / `www.bramulab.com`; punto de retorno `dpl_2w8Jz1nGMBVrs2hL9SYYsgnUqXJH`.

## Condiciones de contenido
- Las pantallas son recreaciones con **datos ilustrativos** (rotulados). No mostrar métricas de adopción ni capturas inventadas.
- Las fotos de Esteban, Gusti, Jona, Lucho y Matu (`assets/img/avatar-real-*.jpg`) están autorizadas **solo para esta web**; no usarlas en otras publicaciones, campañas ni productos. **No están versionadas en Git** (el repositorio es público; `.gitignore` las excluye): viven en Dropbox (`Trabajo en curso/Web_Capturas/IMG-Perfiles/` y la copia de `public/assets/img/`). Para publicar desde un clon hay que copiar esos 5 archivos a `public/assets/img/` antes de `vercel deploy`. Agus y Flor son imágenes generadas; Seba es el creador; Marcos no tiene foto.
- Hero e imágenes nocturnas: fotos provisorias (las de la bienvenida de la app).

## Método de trabajo
- Sebastián y ChatGPT central definen concepto y aprueban el diseño; Claude Code implementa **dentro de esta carpeta** sin modificar `bramulab/`, `bramulive/`, Supabase, `main` ni Production.
- Trabajo temporal entre agentes: Dropbox `/Otros Trabajos/BRAMU/Trabajo en curso/`, **no** dentro de esta carpeta.
- Publicación: proyecto de Vercel separado y autorización explícita de Sebastián.
- Las versiones históricas de prototipo (`index.*-v1.html`, `capturas`, etc.) se eliminaron el 14/10/2026 por indicación de Sebastián; el historial de Git del proyecto no se tocó.
