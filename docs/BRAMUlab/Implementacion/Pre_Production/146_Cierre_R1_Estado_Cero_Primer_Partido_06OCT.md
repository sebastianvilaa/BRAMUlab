# 146 — Cierre R1 · Estado Cero / primer partido / Perfil progresivo / Ranking automático

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base:** `6796ed62b1b8eed7e5d1875a26b5e90d3099f263`  
**Alcance:** residual R1 de Issue #28 — P0.1 + P0.1B.  
**Resultado:** **PASS CENTRAL / CERRADO EN STAGING.**

## 1. Por qué no se pidió otro login

El residual pedía evidencia de:
- cuenta con 0 partidos;
- primer partido / progresión;
- Mi Perfil y Perfil público sin módulos falsos;
- ausencia del opt-in legacy de Ranking.

Mi Perfil/Perfil público y ausencia visual de opt-in ya habían sido revisados por Sebastián en Staging durante el QA del 06/10.

Para 0 partidos / primer partido existen cuentas reales ya sembradas en Staging. Reutilizarlas evita crear usuarios/fixtures, OTPs y pruebas redundantes.

## 2. Estado Cero — cuenta real

Cuenta elegida: `sebastian_vila`.

Backend Staging:
- identidad registered;
- Nivel `CALIBRANDO`, `mu=5.32`;
- `rated_matches=0`;
- `distinct_opponents=0`;
- `get_my_matches(50,false)` devuelve lista vacía;
- `get_my_level_evolution()` devuelve `available=false`, reason `no_results`;
- `get_public_profile` devuelve Nivel público 5.3 y `matches_played=0 / matches_won=0`.

Ranking:
- el campo legacy `ranking_opt_in` está en `false`;
- aun así `get_my_ranking_position('local')` NO devuelve `ranking_opt_in_false`;
- los únicos reason codes son `competitive_branch_missing`, `location_missing` y `level_not_calibrated`, exactamente los bloqueos vigentes.

## 3. Primer partido — cuenta real

Cuenta elegida: `camilo_test`.

Backend Staging:
- exactamente 1 partido `validated`;
- Nivel `CALIBRANDO`, `rated_matches=1`, `distinct_opponents=2`;
- `get_my_matches` devuelve ese partido real;
- `get_public_profile`: `matches_played=1`, `matches_won=0`;
- la evolución oficial ya puede existir porque hay evidencia real; no es un placeholder.

Esto demuestra la transición de verdad server-backed 0 → 1 sin crear un fixture artificial.

## 4. Gate de frontend actual

La revisión del código vigente confirma:

### Home con 0 oficiales
- `renderPlayerHome` separa `displayMatches` de historial computable;
- `renderPlayerActivity`: 0 → card oculta;
- `renderPlayerEffectiveness`: 0 → card oculta;
- `renderPlayerWidgets`: Racha/Total ocultos y Compañero/Rival ocultos;
- `renderPlayerLastMatchCard`: si no hay ninguna carga, reutiliza `buildFirstResultCardHTML()`;
- copy: `TU PRIMER PARTIDO` + `CARGAR MI PRIMER PARTIDO`;
- `buildTuMomentoText` con 0 usa copy específico de inicio, sin estadísticas inventadas.

### Historial con 0
- `renderHistoryEmptyState(0)` reutiliza la misma card de primer resultado y no muestra filtros/placeholders como contenido principal.

### Mi Perfil
- `renderProfileView`: con 0 oficiales oculta `#profile-kpis`;
- Evolución real no aparece sin resultados;
- identidad + @usuario + Nivel inicial permanecen visibles.

### Perfil público
- camino server-backed inicia Efectividad/rendimiento ocultos;
- solo revela Efectividad cuando `matches_played > 0`;
- cuenta Estado Cero real devuelve `matches_played=0`;
- cuenta con primer partido devuelve `matches_played=1`.

### Progresión desde el primer oficial
Con `matches.length>0`:
- Actividad aparece;
- Efectividad aparece;
- Racha + Partidos totales aparecen como pareja;
- Compañero/Rival siguen sujetos a muestra legítima y no se fuerzan con 1 partido.

## 5. Ranking automático / P0.1B

Frontend vigente:
- `rankingGateMissingFields()` solo evalúa `competitiveBranch` y `locality`;
- no existe control ordinario de opt-in;
- `submitRankingGateModal()` persiste participación automática al completar los datos;
- QA humano del 06/10 mostró Ranking real sin pregunta de participación.

Backend real:
- una cuenta con `ranking_opt_in=false` no recibe ese campo como reason code de inelegibilidad.

Por lo tanto el valor legacy queda como compatibilidad histórica y no vuelve a la experiencia.

## 6. Conclusión

R1 queda **CERRADO / PASS CENTRAL**.

No se detectó un bug nuevo ni se justificó otra ronda de implementación.

R2 / Issue #23 ya estaba cerrado por QA humano de Grupos.

**Siguiente gate:** pedir autorización explícita de Sebastián para G3. G3 deberá seguir la secuencia 137: Production limpia, origen estable antes del smoke PWA/invitaciones, mover assets de emails a origen público estable y recién entonces resolver la eventual privatización del repo tras verificar Vercel/BRAMUlive.
