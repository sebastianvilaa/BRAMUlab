# BRAMUlab — Identidad Visual

**Estado:** fuente maestra visual vigente.  
**Fecha de consolidación:** 06/10/2026.  
**Alcance:** identidad de BRAMUlab. BRAMUlive es un producto separado.

Este documento registra únicamente decisiones visuales confirmadas y necesarias para mantener coherencia entre producto, assets y futuras piezas. No reemplaza el criterio de diseño ni pretende ser un brand book extenso.

---

## 1. Fuentes maestras de marca

El maestro editable vive fuera del repositorio:

`/Otros Trabajos/BRAMU/Sistema grafico/BRAMUlab-SistemaGrafico.ai`

Exports aprobados:

### SVG — autoridad de geometría
- `BRAMUlab-Logo.svg`
- `BRAMUlab-Isotipo.svg`
- `BRAMUlab-IconoApp.svg`

Ubicación externa vigente:

`/Otros Trabajos/BRAMU/Sistema grafico/Archivos/Marca/SVG/`

Los PNG equivalentes de `Archivos/Marca/PNG/` son referencias/derivados y **no** son fuente editable.

Regla:
- **Logo** = wordmark BRAMUlab.
- **Isotipo** = símbolo independiente.
- **IconoApp** = aplicación específica del isotipo para PWA/iconos digitales; no reemplaza al isotipo puro.
- No deformar, redibujar, reacomodar ni reinterpretar estas piezas sin una nueva decisión explícita de marca.

Durante V04.36 los SVG aprobados deben incorporarse al repo como assets maestros de desarrollo en `docs/BRAMUlab/Marca/`.

---

## 2. Personalidad confirmada

BRAMUlab debe sentirse:

- deportiva;
- moderna;
- tecnológica;
- personal;
- nocturna;
- competitiva.

La tecnología debe sentirse integrada al deporte, no como ciencia ficción ni estética gamer.

El usuario y su historia deportiva son el centro. La marca no debe parecer una gráfica de transmisión profesional ni un sistema de e-sports.

---

## 3. Concepto visual

Concepto rector: **arena nocturna**.

Referencias de clima:
- cancha bajo iluminación artificial;
- entorno profundo y oscuro;
- contraste alto;
- luz focal;
- pelota / acento lima como punto de atención;
- geometría precisa.

La oscuridad es atmósfera. El color brillante es foco, no relleno constante.

---

## 4. Paleta principal

### Marca

- **Azul noche BRAMU:** `#050A12`
- **Verde lima BRAMU:** `#95FF19`
- **Azul eléctrico:** `#199FFF`
- **Blanco principal:** `#F8FAFC`

Jerarquía:
- azul noche = universo / atmósfera;
- lima = foco principal;
- blanco = información y contraste;
- azul eléctrico = contrapunto / energía secundaria.

El lima debe usarse con disciplina. No debe convertirse en un campo dominante permanente.

### Escala oscura / superficies

- `#03070D`
- `#050A12`
- `#09131F`
- `#0D1A2A`
- `#112238`
- `#152B43`

### Profundos / secundarios

- lima profundo: `#66B30F`
- azul profundo: `#0D6FCC`
- texto secundario: `#9AA7B5`
- texto tenue: `#687482`
- base cromática de bordes: `#B7D3EB`, normalmente con baja opacidad.

### Colores funcionales de producto

No son colores principales de marca:

- `#FFC93D` — estados deportivos especiales / Punto de Oro;
- `#FFA93D` — Star Point;
- `#FF5B61` — error / peligro / acción destructiva;
- `#2ECC71` — confirmación positiva.

No usarlos para inventar variantes principales del logo.

---

## 5. Tipografía

Tipografía vigente del producto: **Inter**.

Pesos utilizados:
- 400–500: lectura y secundarios;
- 600–700: interfaz general;
- 700–800: títulos, labels y botones;
- 800–900: Nivel, Ranking, números o momentos de mayor jerarquía.

Oswald y Manrope pertenecen a etapas anteriores y no son tipografías vigentes.

El logotipo tiene su propia geometría. No reconstruirlo tipográficamente con Inter.

---

## 6. Geometría

Principios confirmados:
- líneas precisas;
- bordes finos;
- geometría clara;
- espacio negativo;
- terminaciones modernas y moderadamente suaves;
- pocos elementos simultáneos;
- profundidad mediante contraste/luz antes que ornamentación.

La geometría puede tomar referencias abstractas del pádel, pero no necesita representar literalmente una pala o una pelota.

---

## 7. Glow e iluminación

El glow y la iluminación son **puntuales y controlados**, con lógica de estadio.

Usar:
- para enfatizar un foco real;
- para separar elementos relevantes del fondo oscuro;
- con intensidad contenida.

Evitar:
- glow aplicado a todo;
- múltiples neones simultáneos;
- RGB;
- magenta/violeta/cyan como estética dominante;
- fondos gamer o cyberpunk.

---

## 8. Iconografía

La iconografía debe priorizar:
- trazos simples;
- geometría clara;
- terminaciones modernas y suaves;
- referencias minimalistas, cuando correspondan, a:
  - cancha;
  - red;
  - pelota;
  - recorrido / trayectoria.

No convertir cada icono en una ilustración deportiva literal.

Evitar:
- escudos genéricos;
- rayos;
- símbolos e-sports;
- circuitos;
- hexágonos tecnológicos decorativos;
- glitches o recursos sci-fi.

---

## 9. Fotografía e imagen

Dirección confirmada:
- preferencia nocturna o con iluminación artificial;
- cancha como escenario;
- contraste alto;
- fondos profundos;
- luz localizada;
- presencia humana/deportiva real cuando corresponda;
- tratamiento realista.

Evitar:
- multineones;
- colores ajenos a la paleta sin una razón concreta;
- fondos gamer;
- saturación artificial generalizada;
- teñir toda la imagen de verde lima.

La imagen puede usar el azul como atmósfera y reservar el lima para foco/acento.

---

## 10. Splash e iconos digitales

No existe una cuarta marca para splash.

El splash reutiliza el **logo oficial** sobre el universo oscuro de BRAMUlab.

El icono de app parte de `BRAMUlab-IconoApp.svg`. Los tamaños raster necesarios son **derivados técnicos**, no nuevos originales:
- 192×192;
- 512×512;
- 512×512 maskable;
- Apple Touch 180×180;
- favicon.

Los derivados deben generarse desde el master aprobado y nunca editarse como nueva fuente.

Para emails puede mantenerse un PNG derivado por compatibilidad. Tampoco es fuente maestra.

---

### Implementación en el repo (V04.36)

- Masters: `docs/BRAMUlab/Marca/` (SVG aprobados, con el bloque `<metadata>` de Adobe/C2PA retirado; geometría y colores idénticos al export). Procedimiento y herramienta de derivados: `docs/BRAMUlab/Marca/README.md` + `generar-derivados.html`.
- La app usa `bramulab/icons/logo.svg`: el mismo SVG del logo con el `viewBox` recortado al trazo (más `width`/`height` intrínsecos) para conservar las proporciones de layout vigentes (header 24 px, acceso 30 px, footer 18 px). Ningún path, color ni filtro cambia.
- `bramulab/icons/logo.png` queda **solo** por compatibilidad de emails (`/icons/logo.png`); se deriva de `logo.svg` (fondo transparente).
- Iconos PWA/apple-touch/favicon: derivados de `BRAMUlab-IconoApp.svg` (192, 512, 512 maskable al 80 %, 180 opaco, favicon recortado alrededor de la B).

### Variante ST (icono de Staging) — regla de separación (h27, 07/10/2026)

- **Production usa SIEMPRE el icono oficial; Staging usa la variante azul ST** (`BRAMUlab-IconoApp ST`, mismo diseño con el isotipo en `#199fff`) para distinguir a simple vista las dos instalaciones en el celular. Es **solo** el icono instalado: logo, isotipo y todo gráfico dentro de la app son los oficiales en ambos entornos.
- Masters ST (sanitizados igual que los oficiales, sin `<metadata>`): `docs/BRAMUlab/Marca/BRAMUlab-IconoApp-ST.svg` y `BRAMUlab-Isotipo-ST.svg`. Derivados ST: `bramulab/icons-staging/` (mismos 5 nombres/tamaños que los iconos PWA oficiales), generados con `generar-derivados.html?variante=ST`.
- **El icono lo decide el ENTORNO del build, nunca la rama ni el commit.** `scripts/build-dist.mjs` lee el entorno horneado por `build-env.mjs` en `env.generated.js` (`BRAMU_ENV_NAME`): solo `staging` copia `icons-staging/` sobre `dist/icons/`, reemplaza el `apple-touch-icon` incrustado en `index.html` y marca las URLs de icono del manifest con `?v=<bundle>-st`. Production/Development publican `icons/` oficial; `icons-staging/` no está en la allowlist de `dist/` y ni siquiera se publica. Por eso **promover el mismo commit de `staging` a Production no puede adoptar el icono ST**; además el build aborta si `VERCEL_ENV=production` con entorno `staging`, y también si Staging no encuentra un icono ST (no cae en silencio al oficial).
- `bramulab/icons/` y el `apple-touch-icon` del source siguen siendo el icono oficial: **no se reemplazan jamás por el ST**. Tests: `bramulab/icon-staging-h27.test.mjs`.
- Instalaciones ya existentes: iOS fija el icono al «Agregar a inicio» → hay que quitar y volver a instalar la PWA de Staging; Android lo actualiza solo (puede demorar) o al reinstalar.

---

## 11. Usos prohibidos

No:
- deformar logo/isotipo;
- cambiar proporciones;
- redibujar las piezas;
- cambiar el verde aprobado por variantes heredadas;
- usar colores de otra identidad como reemplazo de la paleta;
- aplicar multineón;
- convertir la marca en gamer/e-sports;
- inventar un logo específico de splash;
- usar PNG como original editable;
- tomar moodboards como fuente de verdad.

---

## 12. Referencias visuales

Las referencias de Premier Padel y Playtomic son **archivo de investigación/moodboard**, no autoridad visual.

Archivo externo:

- `/Otros Trabajos/BRAMU/Sistema grafico/Referencias/Premier-Padel/`
- `/Otros Trabajos/BRAMU/Sistema grafico/Referencias/Playtomic/`

Pueden servir para estudiar clima, jerarquía o soluciones de producto, pero nunca para reemplazar las reglas vigentes de este documento.

---

## 13. Regla para desarrollo

Cuando una tarea afecte identidad:
1. leer este documento;
2. usar los SVG aprobados como autoridad;
3. generar derivados desde esos masters;
4. no recuperar assets antiguos desde Git salvo trazabilidad específica;
5. no usar documentación visual histórica como autoridad.

La carpeta histórica `docs/identidad-visual/` se retiró en V04.36 (sin referencias activas; los masters vigentes están en `docs/BRAMUlab/Marca/`).
