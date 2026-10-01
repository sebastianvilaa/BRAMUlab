# 102 — Ajuste final UX de Configuración (G2)

**Fecha:** 01/10/2026 · **Issue:** #22 (no se cierra) · **Bundle:** `04.20-h6` (pública `BRAMUlab V04.20`)
**Origen:** revisión visual de Sebastián posterior al retest de Work (101). **Solo jerarquía/composición; sin cambio funcional.**

## Cambios
- Configuración queda con **dos encabezados**: `CUENTA Y SEGURIDAD` (Email, Cambiar contraseña; sin cambios) y `PRIVACIDAD Y CUENTA`, **una sola lista** con: Términos y Condiciones · Política de Privacidad · Solicitar copia de mis datos · Contacto · **Eliminar mi cuenta** (última fila, texto danger, chevron normal, sin tarjeta/borde rojo/título propios).
- Eliminadas las secciones `PRIVACIDAD Y DATOS`, `LEGAL`, `AYUDA`, `SESIÓN` y `ZONA DE CUENTA`.
- `CERRAR SESIÓN` vuelve a ser un **botón grande de ancho completo (danger)**, separado debajo de las listas y más evidente que Eliminar. Sigue abriendo el mismo modal: Cerrar sesión / Cerrar todas las sesiones / Cancelar (sin fila permanente de "cerrar todas").
- La fila Eliminar se oculta para cuentas sin backend (misma regla que antes, ahora sobre la fila).

## Sin cambios
Engranaje, Mis datos limpio, pantallas previas (Email/Eliminación/Copia/Contacto), primer tap sin email/mailto, CTA intermedio, flujo G1, Legal in-app, reaceptación, Site URL/redirects, iconos/assets, backend, emails y Supabase.

## Versionado
`04.20-h5` → `04.20-h6` sincronizado en `store.js`, `version.json`, `sw.js` (cache + CORE_ASSETS), `index.html` y `manifest.webmanifest`. `APP_VERSION` intacto.

## Tests
`g2-configuracion.test.mjs` (13/13) actualizado: solo dos encabezados · orden del segundo bloque · títulos eliminados · Eliminar danger dentro de la misma lista, sin borde rojo de bloque · Cerrar sesión botón grande separado que abre el mismo modal · primer tap sin acciones externas · bundle h6. Suite Node 706/709 (las 3 fallas `h19-B`, `h21-9`, `h23` son preexistentes); `release-check` PASS. `supabase/email-templates/manifest.json` regenerado (solo orden de claves). Pendientes: visto bueno visual de Sebastián sobre h6 y el residual humano del icono iOS.
