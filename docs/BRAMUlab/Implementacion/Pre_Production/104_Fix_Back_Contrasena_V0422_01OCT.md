# 104 — Fix: destino tras cambiar contraseña (V04.22)

**Fecha:** 01/10/2026 · **Issue:** #22 (no se cierra) · **Versión visible:** `BRAMUlab V04.22` · **Bundle:** `04.22-h1`

**Bug (hallazgo del gate Central de V04.21):** en `initChangePasswordScreen()` el camino de éxito **server-backed** (tras `updatePassword` + `signOutOthers` + notificación + badge) todavía hacía `showView('profile')`. Ahora hace `openSettings()`, igual que el camino local, el cancelar y el recovery desde sesión. Sin cambios en Auth, recovery, `signOutOthers` ni notificaciones.

**Test:** `V0421-3` reescrito: inspecciona explícitamente ambos caminos de éxito (local y server-backed) y exige que no quede ningún `showView('profile')` dentro de `initChangePasswordScreen()` (el anterior daba falso positivo al recortar hasta el primer toast, que era el del camino local). `v0420-l2-l3` ajustado al nuevo destino.

**Versionado:** V04.21 → V04.22 / `04.22-h1` sincronizado (APP_VERSION, BUNDLE_VERSION, version.json, SW, query strings, manifest, tests). Suite Node: solo fallan las 3 preexistentes (`h19-B`, `h21-9`, `h23`); `release-check` PASS. Siguiente: gate Central → QA única de Sebastián en iPhone → cierre #22 si pasa.
