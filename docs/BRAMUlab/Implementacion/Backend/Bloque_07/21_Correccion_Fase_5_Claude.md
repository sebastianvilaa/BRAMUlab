# Backend Bloque 7 — Corrección de Fase 5 (Claude Code)

**Fecha:** 22 de septiembre de 2026.
**Rama:** `staging`.
**Base:** `d7a15c064c2a6c1d3d464e8fb5ed0fcb661e936f` (`20_Resultado_Fase_5_Claude.md`).
**Alcance ejecutado:** corrección acotada de dos bugs reales de Fase 5 (F5-C01, F5-C02) encontrados por ChatGPT central antes de QA. **No se tocó backend/Supabase, `pg_cron`, Vercel, `main`, Production ni BRAMUlive.** No se cambiaron reglas de Ranking. No se empezó Intelligence. No se inició QA de navegador contra Staging real.

---

## 1. F5-C01 — ubicación GeoRef ya no se degrada al guardar el gate

**Causa real:** `fetchOwnProfile()` (`bramulab/auth.js`) traía `province_label`/`locality_label`/`display_label`/`verified_for_ranking` de `locations` pero nunca `country_code`/`georef_province_id`/`georef_locality_id`. `openRankingGateModal()` (`bramulab/app.js`) reconstruía la ubicación precargada como `{locality, region, country}`, sin esos IDs. Si el usuario ya tenía una ubicación GeoRef verificada y entraba al gate solo porque le faltaba rama u opt-in, guardar sin tocar el campo de ubicación reenviaba esa misma ubicación a `complete_ranking_profile_data` sin IDs GeoRef — el backend la reinterpretaba como `source='manual'`/`verified_for_ranking=false` y podía reasignar `location_id`.

**Corrección:**

1. `fetchOwnProfile()` ahora pide `country_code, georef_province_id, georef_locality_id` en el mismo `select` de `locations` y los copia al objeto cacheado (`locationCountryCode`, `locationGeorefProvinceId`, `locationGeorefLocalityId`). `Store.cacheServerUser` ya guarda el objeto completo tal cual — nada que tocar ahí.
2. La reconstrucción de `rankingGateLocation` se extrajo de `app.js` a una función **pura y testeada** en `bramulab/ranking.js`: `RK.buildGateLocationFromUser(user)` — devuelve `{locality, region, country, provinceId, localityId}` (con los IDs reales si existen, `null` si la ubicación es manual, `null` entero si no hay ubicación cargada). `openRankingGateModal()` ahora solo llama a esa función.
3. Guardar únicamente rama/opt-in sin tocar el campo de ubicación reenvía `rankingGateLocation` intacto (con los IDs originales) — `complete_ranking_profile_data` encuentra la misma fila de `locations` por esos IDs, `location_id` no cambia, no se dispara `location_change_cooldown`, `verified_for_ranking` no se toca.
4. Una ubicación manual (nunca tuvo GeoRef) sigue mandando los IDs en `null` — el fix no inventa IDs donde nunca existieron.

**No se tocó el backend.** El contrato de `complete_ranking_profile_data` (fuente de verdad: si llegan ambos IDs GeoRef, es verificada; si no, manual) queda exactamente igual — el bug era que el frontend dejaba de mandarlos, no que el backend los interpretara mal.

`openProfileEditModal` (Editar Datos) tiene el mismo patrón `{locality, region, country}` sin IDs, pero ese flujo está explícitamente bloqueado para cuentas `serverBacked` (`if (user.serverBacked) return;` antes de guardar) — no hay ningún guardado real posible ahí hoy, así que no reproduce este bug. No se tocó, para no ampliar alcance.

---

## 2. F5-C02 — el gate ahora se abre ENCIMA de Ranking, nunca antes

**Causa real:** la implementación original de Fase 5 interpretó "gate bloqueante" como "modal antes de `showView('ranking')`" — contradice Ranking_BRAMU.md §13.7.A, que exige que la pantalla de Ranking se muestre siempre (atenuada/bloqueada) DETRÁS de un modal simple, con el CTA abriendo recién ahí el flujo de completado.

**Corrección:**

1. `openRankingScreen()` ahora **siempre** llama `renderRankingScreen()` + `showView('ranking')` primero — la entrada a Ranking nunca se reemplaza por el modal. El gate se evalúa DESPUÉS; si faltan datos, abre el overlay encima de la pantalla ya visible.
2. El overlay (`#ranking-gate-modal-scrim`, mismo `.overlay` de siempre — cero CSS nuevo) pasa a tener dos pasos dentro del MISMO modal:
   - `#ranking-gate-step-intro` (estado inicial obligatorio): título + copy simple + un único CTA `COMPLETAR DATOS`, más `AHORA NO` para cerrar sin guardar nada.
   - `#ranking-gate-step-form` (solo tras tocar el CTA): los mismos controles de rama/ubicación/opt-in que ya existían, con `GUARDAR Y CONTINUAR` y `VOLVER` (vuelve al paso simple, nunca guarda nada parcial).
3. Al guardar con éxito: recachea el perfil (sin cambios) y cierra el overlay — como Ranking ya estaba renderizado detrás, solo hace falta `renderRankingContent()` para refrescarlo con los datos ya completos (antes se volvía a llamar `renderRankingScreen()+showView()`, redundante).
4. "AHORA NO"/"VOLVER" nunca invocan la RPC — `rankingGateBranch`/`rankingGateOptIn`/`rankingGateLocation` solo viajan al servidor dentro de `submitRankingGateModal`. Cerrar el overlay revela la pantalla Ranking ya renderizada (bloqueada por su propio estado "faltan datos" hasta completar el gate); el back real (`#ranking-back-btn`, siempre a Home) sigue disponible debajo sin cambios — comportamiento coherente con la navegación existente, sin necesitar un destino especial para "volver".

**No se tocó el contrato backend** — `complete_ranking_profile_data` y las RPCs de lectura quedan exactamente iguales; esto era puramente una corrección de UX/orden de render en `app.js`/`index.html`.

Verificado en vivo en el navegador (servidor estático local, `Auth.isConfigured()`/cuenta `serverBacked` forzados por consola — sin credenciales reales, ver §4): al tocar Ranking con datos faltantes aparecen primero el header/tabs/filtros de Ranking atenuados detrás, y encima el modal simple con `COMPLETAR DATOS`/`AHORA NO`; tocar el CTA revela el formulario completo; `VOLVER` regresa al paso simple; `AHORA NO` cierra el overlay y deja la pantalla Ranking completamente visible e interactiva (con su propio estado de error real al no haber backend real detrás — nunca datos inventados).

---

## 3. Bundle / Service Worker

`04.10-h20` ya estaba desplegado en Preview (central lo confirmó). Bump a `04.10-h21`:

- `CACHE_NAME` y las 18 entradas de `CORE_ASSETS` (`sw.js`) y los `?v=` de `index.html`, en lockstep — verificado: 0 referencias activas residuales a `h20` (las dos únicas menciones que quedan son comentarios de changelog histórico explicando por qué existió `-h20`, no un pin de versión).
- `Store.VERSION`/`version.json` sin cambios (`"BRAMUlab V04.10"`).
- `styles.css` sin tocar — la reestructuración del modal en dos pasos reutiliza exactamente las mismas clases de antes (`.overlay`, `.option-row`/`.option-col`, `.profile-select-row`, `.profile-toggle-row`/`.toggle-switch`, `.setup-section`), solo se agregaron los dos contenedores `#ranking-gate-step-intro`/`#ranking-gate-step-form` que alternan `hidden` por JS.

---

## 4. Tests

- `tests.html`: **1478/1478 — todo verde** (1471 de Fase 5 intactos + 7 nuevos `B7F5-C01`).
- `auth.js` se agregó al arnés de `tests.html` (no estaba cargado desde ningún test hasta esta ronda) específicamente para poder testear `Auth.completeRankingProfileData` con un cliente Supabase fabricado — mismo mecanismo que los `B7F5-RPC` de `ranking.js` (fake `window.__BRAMU_ENV__`/`window.supabase`, restaurados en `finally`; sin esos globals, `Auth.isConfigured()` sigue siendo `false` como en el resto del arnés, así que cargarlo no afecta ningún test previo).
- Los 7 tests nuevos (`B7F5-C01`):
  - `RK.buildGateLocationFromUser` conserva `provinceId`/`localityId` de una ubicación GeoRef ya verificada;
  - con ubicación manual devuelve esos IDs en `null` (nunca inventados);
  - sin localidad/cuenta devuelve `null`, nunca un objeto vacío;
  - `Auth.completeRankingProfileData` reenvía los IDs GeoRef originales al guardar solo rama/opt-in — la regresión específica del bug real reproducido por central;
  - con ubicación manual, los IDs siguen viajando `null`;
  - `p_location_country_code` siempre `'AR'`.
- **F5-C02 no tiene test unitario** (mismo criterio ya documentado en `20_Resultado_Fase_5_Claude.md`: `app.js` no tiene cobertura unitaria por diseño — el gate es orquestación de DOM/vistas, no lógica pura). Se verificó en vivo en el navegador (ver §2): shell de Ranking detrás, paso simple primero, CTA abre el formulario, cerrar sin guardar no persiste nada, guardar exitoso refresca Ranking con datos reales.
- "Sin fallback a mocks server-backed" — cubierto indirectamente por la verificación en vivo de §2 (con `Auth.isConfigured()` forzado pero sin cliente Supabase real detrás, Ranking mostró el estado de error real `NO PUDIMOS CARGAR EL RANKING`, nunca datos simulados) y por los tests `B7F5-RPC`/`B7F5-C01` ya existentes, que verifican que cada wrapper devuelve `{ok:false, code}` — nunca datos inventados — cuando la RPC no está disponible.

---

## 5. Bloqueos reales

Ninguno que impida la entrega. Mismo punto que Fase 4/Fase 5: sin credenciales/CLI de Supabase en esta sesión, no fue posible ejercitar `complete_ranking_profile_data`/las RPCs de lectura contra Staging real. La corrección de F5-C01 se validó con un cliente Supabase fabricado (verifica el mapeo de parámetros exacto que el bug real necesitaba) y la de F5-C02 con la app real corriendo en un navegador (sin backend real detrás). ChatGPT central debe confirmar contra Staging real: que una cuenta con ubicación GeoRef ya verificada conserva `verified_for_ranking=true`/el mismo `location_id` tras completar el gate solo con rama/opt-in, y que el flujo visual del gate (shell detrás → modal simple → formulario → Ranking real) se ve y se comporta igual que en esta verificación local.

---

**Fin de la corrección. No se tocó Supabase/Vercel/main/Production/BRAMUlive. No se cambiaron reglas de Ranking. No se empezó Intelligence. No se inició QA de navegador contra Staging.**
