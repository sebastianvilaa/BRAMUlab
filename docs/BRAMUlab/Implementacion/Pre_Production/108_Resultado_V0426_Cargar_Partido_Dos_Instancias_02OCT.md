# 108 — V04.26: Cargar partido en dos instancias + wheel A/B (#24)

**Fecha:** 02/10/2026 · **Versión:** `BRAMUlab V04.26` · **Bundle:** `04.26-h1` · Issue #24 sigue abierto: falta QA humano real en iPhone. **No se declara la UX cerrada.**

## Qué cambió
- **Instancia Jugadores:** dos tarjetas BRAMU (A borde verde / B borde celeste, sin degradés nuevos) con dos filas `.player-row` cada una (avatar/foto real, nombre, @usuario, Nivel BRAMU + CALIBRANDO vía `buildCompactPlayerRowHTML` / `buildProvisionalRowHTML` / `buildPlayerRowHTML`), separador `.vs-divider` existente, slots vacíos `+ Agregar compañero` / `+ Agregar rival` (abren las hojas vigentes). Datos reales de jugadores registrados: los trae el sheet al elegir + un batch `Auth.getPlayersCompact` por los faltantes; nunca se inventa foto/@usuario/Nivel.
- **CARGAR RESULTADO:** `.btn-start` desde el inicio, `disabled` hasta tener los cuatro jugadores; **no autoavanza** (se eliminó la apertura automática del teclado al elegir el cuarto).
- **Instancia Resultado:** metadata arriba intacta; `.result-card` en variante `--editable` (misma grilla `result-card__rows`), nombres un jugador por renglón, columnas SET 1/2/(3) con números de 34 px. Se eliminó la tarjeta "RESULTADO DEL SET X". Con partido decidido, la misma tarjeta suma GANADORES + SETS/GAMES GANADOS (`buildWinnersBannerHTML` / `buildSetsGamesSummaryHTML` del Resumen) y se habilita **CONFIRMAR PARTIDO** (visible y `disabled` antes).
- **Wheel A/B (reemplaza el teclado):** panel fijo inferior con `scroll-snap` vertical, uno por equipo. Opciones = `ML.computeValidNextDigits` (sin lógica deportiva nueva); el lado contrario al último editado queda restringido por su valor y se vacía si el par deja de ser válido (nunca un par inválido en el borrador). El valor que se mueve se ve en vivo en la columna del set activo. `LISTO` cierra el set completo (A y B) y avanza al siguiente pendiente / deja el partido decidido; tocar otro set confirma antes un borrador válido distinto (nunca se pierde en silencio). Poda de tercer set con la confirmación vigente.
- **CAMBIAR JUGADORES:** botón + flecha ← en Resultado vuelven al armado conservando jugadores, metadata y sets confirmados. Cambiar/quitar un participante con resultado cargado pide confirmación explícita ("el resultado deberá cargarse de nuevo").
- **Paso intermedio eliminado:** se borró `#view-match-saved` / `openConfirmMatchScreen`; `confirmManualMatch` guarda directo (server-backed: `submitManualMatchServerBacked` → create-or-attach + feedback existente + Resumen oficial; local: persiste, toast "Partido guardado", Resumen oficial). Resumen oficial, Intelligence, nota privada, Nivel, Ranking, Grupos, backend: sin cambios.

## Tests
`v0426-cargar-partido-dos-instancias.test.mjs` (22) ejecuta las funciones REALES de `app.js` (sandbox + motor real). Tests de keypad de V04.24/V04.25/corrección Cargar partido reemplazados; versionado V04.26 sincronizado. Suite Node: 705/708 — únicamente los 3 fallos preexistentes (h19-B, h21-9, h23).
Verificación visual local (Browser pane, 375 px, cuenta local): armado → CARGAR RESULTADO habilitado sin avance → Resultado → wheels (A=6 restringe B) → 6-3 / 6-2 → GANADORES + sets/games → CONFIRMAR → toast + Resumen oficial intacto.

## No verificado / para QA humano en iPhone
- Sensación real del wheel (inercia, snap, tamaño de ítem 40 px, panel de ~290 px en pantallas chicas).
- Caminos server-backed (Nivel/CALIBRANDO/avatar reales en las filas, outbox, feedback de validación) — no hay sesión Supabase en el entorno de desarrollo.
- Tiempos del scroll en Safari/PWA real (en el Browser pane los timers/rAF van estrangulados).
- Restricción A/B: después de elegir B, el wheel A queda con pocas opciones; para cambiar A hay que mover B primero (decisión de UX a evaluar con uso real).
