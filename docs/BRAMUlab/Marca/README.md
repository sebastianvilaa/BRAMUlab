# BRAMUlab — Marca (assets maestros de desarrollo)

Autoridad visual: [`../Identidad_Visual.md`](../Identidad_Visual.md). El maestro editable vive fuera del repo
(`Sistema grafico/BRAMUlab-SistemaGrafico.ai`); estos son los **SVG aprobados** exportados de él.

| Archivo | Qué es |
|---|---|
| `BRAMUlab-Logo.svg` | Logo (wordmark). Se usa tal cual; no se reconstruye con tipografía. |
| `BRAMUlab-Isotipo.svg` | Símbolo independiente. Hoy no se muestra en la UI; queda como master. |
| `BRAMUlab-IconoApp.svg` | Aplicación del isotipo para PWA/iconos digitales (incluye su fondo oscuro). |
| `generar-derivados.html` | Herramienta sin dependencias que rasteriza los derivados técnicos desde estos SVG. |

**Sanitizado (V04.36):** a los SVG se les quitó únicamente el bloque `<metadata>` (XMP/C2PA de Adobe). Geometría, colores, filtros y la imagen
de fondo embebida del IconoApp son idénticos al export aprobado.

## Derivados (nunca son fuente editable)

Se generan **desde los masters** y se copian a `bramulab/icons/`:

| Derivado | Origen | Uso |
|---|---|---|
| `icon-192.png`, `icon-512.png` | IconoApp, lienzo completo, opaco | manifest (`any`) |
| `icon-512-maskable.png` | IconoApp a sangre completa + el mismo master reducido al 80 % con borde suave (safe area) | manifest (`maskable`) |
| `apple-touch-icon.png` (180) | IconoApp, opaco | iOS; además va incrustado como `data:` en `index.html` |
| `favicon-64.png` | IconoApp, recorte de 780/1080 centrado en la B | favicon |
| `logo.svg` | `BRAMUlab-Logo.svg` con el `viewBox` recortado al trazo (+ `width`/`height` intrínsecos); **ningún path/color cambia** | splash, acceso, headers y footer de la app |
| `logo.png` | raster de `logo.svg` (transparente) | **solo compatibilidad de emails** (`/icons/logo.png`) |

Regenerar: servir esta carpeta con cualquier servidor estático (`python3 -m http.server` desde acá), abrir `generar-derivados.html`, tocar
**Generar** y luego **Descargar todo**; copiar los archivos a `bramulab/icons/`, actualizar el `data:` del `apple-touch-icon` en `index.html`
y subir el bundle (`?v=`, `CACHE_NAME`, `version.json`) en el mismo commit. Los parámetros (fondo, recortes, safe area) están al inicio del script.
Un test (`v0436-identidad-visual.test.mjs`) fija el hash de los masters y verifica que `logo.svg` sea idéntico al master salvo `viewBox`/tamaño.
