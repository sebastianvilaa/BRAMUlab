# BRAMUlab Web — sitio público

**Estado:** planificación conceptual cerrada; siguiente etapa: boceto visual mobile first. **No existe código web ni despliegue todavía.**

## Qué es esta carpeta
Sitio público de presentación de BRAMUlab, previsto para `bramulab.com`. **Proyecto independiente** de la aplicación `bramulab/` (en `app.bramulab.com`) y de BRAMUlive.

Aunque los proyectos comparten el repositorio Git, esta carpeta es **hermana** de `bramulab/`, no una parte de la app. La rama Git no define las carpetas ni los destinos de publicación. La web deberá contar con configuración/build y proyecto de Vercel propios, sin utilizar el despliegue de la app.

## Por dónde empezar
- [Concepto y recorrido](docs/BRAMUlab_Web.md): decisiones confirmadas de relato, UX, hero, funcionalidades, capturas reales, movimiento, SEO y alcances.
- Marca oficial: `../docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md` y maestros de marca en su carpeta.
- [Bases de diseño web](docs/Bases_Diseno_Web.md): brief visual, complementario a la identidad maestra.
- Fotografías candidatas: Dropbox `/Otros Trabajos/BRAMU/Sistema grafico/Archivos/BRAMUlab-Inicio.png` y `BRAMUlab-Inicio-Desk.png`.

## Organización al iniciar diseño/desarrollo
```text
bramulab-web/
├── README.md
├── docs/
│   ├── BRAMUlab_Web.md
│   └── Bases_Diseno_Web.md
├── index.html            # pendiente, NO crear en fase conceptual
├── css/                  # pendiente
├── js/                   # pendiente
└── assets/               # pendiente
```

Las carpetas futuras se crearán al tener contenido real: Git no guarda directorios vacíos.

## Método de trabajo
- Sebastián y ChatGPT central definen concepto y aprueban el diseño antes de la implementación.
- Claude Code implementa luego dentro de **esta carpeta**, sin modificar `bramulab/`, `bramulive/`, Supabase, `main` ni Production.
- Trabajo temporal entre agentes: Dropbox `/Otros Trabajos/BRAMU/Trabajo en curso/` (un frente `Frente_Web.md` cuando corresponda), **no** dentro de esta carpeta.
- Capturas del producto: solo capturas reales vigentes, elegidas y aprobadas; nunca inventar interfaces o estadísticas.
- Publicación web: proyecto de Vercel separado y autorización explícita de Sebastián.

**Nota de orden (12/10/2026):** esta carpeta es la ubicación correcta de la documentación y futura implementación web. El primer borrador estaba bajo `docs/BRAMUlab/Web/`; se consolida aquí para evitar mezclar la organización de la app con la web pública.
