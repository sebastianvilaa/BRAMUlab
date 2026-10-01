# 103 — Cierre de correcciones G2 (V04.21)

**Fecha:** 01/10/2026 · **Issue:** #22 (no se cierra) · **Versión visible:** `BRAMUlab V04.21` · **Bundle:** `04.21-h1`
La arquitectura de Configuración aprobada no se tocó. Backend, Supabase, Site URL, G1 y legal sustantivo sin cambios.

1. **Versionado visible:** `V04.20` → `V04.21`, sincronizado en `APP_VERSION`, `BUNDLE_VERSION`, `version.json`, SW (`CACHE_NAME` + `CORE_ASSETS`), query strings, manifest y tests. Regla nueva documentada en `Metodo_Trabajo.md` (versión pública por cada build que Sebastián deba distinguir; `-hN` solo para hotfixes técnicos internos).
2. **Engranaje:** `#profile-settings-btn` y `#groups-settings-btn` (mismo SVG) centrados con una regla CSS acotada (inline-flex, centrado en ambos ejes, SVG `display:block`). `.icon-btn` global y demás botones intactos.
3. **Cambiar contraseña:** cancelar y éxito vuelven a Configuración (`openSettings()`); el recovery iniciado desde esa pantalla también termina en Configuración y conserva su regreso a Cambiar contraseña dentro del wizard. Auth/recovery sin cambios.
4. **Contacto:** texto actualizado a «Este es el canal de soporte y privacidad de BRAMUlab. Las solicitudes se gestionan de forma automática. BRAMUlab no ofrece atención manual por email.» Misma dirección y CTA.

**Tests:** 4 nuevos en `g2-configuracion.test.mjs` (versionado, engranajes, back/éxito/recovery de contraseña, copy) + tests de versión actualizados. Suite Node 710/713 (las 3 fallas `h19-B`, `h21-9`, `h23` son preexistentes), `release-check` PASS. Pendiente humano: visto bueno de Sebastián sobre V04.21 y residual del icono iOS. Los placeholders `[[PENDIENTE_PRODUCCION:*]]` se resuelven en el gate previo a Production.
