# Backend Bloque 5 — Revalidación dirigida de navegador en Work

**Fecha:** 21/09/2026  
**Rama:** staging  
**HEAD probado antes del registro:** fce8f1d13f6963f09d919c58d2d05222a3415a6f  
**Preview:** https://bramulab-git-staging-bramu-lab.vercel.app/  
**Bundle visible:** 04.10-h15 (app.js, matches.js y match-sync.js)  
**Cuenta:** @sebas

El estado de GitHub para fce8f1d informó deployment exitoso «Vercel – bramulab». Se probó el alias Preview de staging, no Production. Una primera recarga todavía mostró assets h14 del Service Worker previo; la siguiente mostró h15 y se hizo toda la prueba sobre h15. La ficha interna del deployment de Vercel no estaba accesible desde Work; el SHA se verificó mediante HEAD de staging y el estado exitoso del commit, y el bundle mediante los scripts realmente cargados.

## Cuatro puntos revalidados

| Punto | Resultado | Evidencia en navegador |
| --- | --- | --- |
| 1. Usuarios reales homónimos | **PASS** | Se seleccionaron @sebas, @claimb4h11, @normalb4h11 y @claim_mualea_20 en cuatro slots. Las últimas tres cuentas figuran como «Prueba» con usernames distintos. No apareció «Hay un jugador repetido en el partido»; el marcador 6–2 / 6–4 se consideró válido y permitió CONTINUAR. Al buscar @claimb4h11 en otro slot después de seleccionarlo como compañero, el resultado de esa cuenta ya no estaba disponible: el mismo usuario no se podía volver a elegir. |
| 2. Hora desconocida | **PASS** | Se usó «Borrar hora» y se comprobó que Hora quedó vacía antes de guardar. El resumen mostró solo 21 de sept de 2026, sin hora; Historial mostró solo la fecha, sin «00:00», también tras refresh del Preview. |
| 3. Estado en Último partido | **PASS** | Home mostró el encuentro 6–2 / 6–4 y el badge «PENDIENTE DE VALIDACIÓN» junto a VICTORIA, incluso tras refresh; no mostró VALIDADO/OFICIAL. El Nivel siguió 5.5 CALIBRANDO · 0/5; Efectividad —, Racha —, Partidos totales 0 y actividad sin partidos computados. |
| 4. Copy server-backed | **PASS** | En el detalle del partido aceptado, el botón visible dice «OCULTAR PARTIDO». Al abrirlo, la confirmación explica que solo se dejará de ver para el usuario actual, mientras el partido permanece para otros participantes. Se pulsó «Cancelar»; no se ocultó ni eliminó el fixture. |

No surgieron bugs nuevos en estos cuatro puntos. No se forzaron caminos outbox o legacy ni se repitieron las otras pruebas de Bloque 5.

## Fixture QA creado

Se guardó **un único partido compartido pendiente** en Staging el 21/09/2026, formato Clásico · Punto de Oro, score 6–2 / 6–4, lugar **QA B5 Work h15**, hora borrada. Equipo A: @sebas y @claimb4h11; equipo B: @normalb4h11 y @claim_mualea_20. Queda visible en Home e Historial de @sebas para identificación y eventual limpieza por el equipo autorizado. El match_id no se expuso en la UI; no se consultó ni modificó Supabase directamente para obtenerlo. No se crearon cuentas ni provisionales.

**Alcance:** solo validación de navegador y este documento. No se modificó código, configuración de Vercel, Supabase directamente, main, Production, BRAMUlive ni Bloque 6.
