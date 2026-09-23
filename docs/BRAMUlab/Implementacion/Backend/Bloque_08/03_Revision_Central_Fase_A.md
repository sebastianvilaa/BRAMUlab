# Backend Bloque 8 — Revisión central de Fase A

**Fecha:** 23/09/2026  
**Rama:** `staging`  
**Commit revisado:** `6aece8c5511e490a3e3b99420a7e989e69cf98bb`  
**Estado:** **NO cerrar Fase A todavía — 1 corrección concreta antes de aplicar la migración real.**

## 1. Resultado general

La dirección de Fase A es correcta y acotada:

- una sola RPC nueva de lectura;
- módulo puro de derivados;
- reutilización de `PLMatchSync` / `PLLevelContext`;
- sin UI;
- sin tocar contratos cerrados;
- sin avanzar a Fase B;
- 27/27 tests reportados por Claude.

La migración fue además probada por ChatGPT central contra Supabase Staging real dentro de una transacción con `ROLLBACK`.

Resultado del dry-run real:

- función compila: **PASS**;
- `authenticated` tiene EXECUTE: **PASS**;
- `anon` no tiene EXECUTE: **PASS**;
- no quedó ningún cambio persistido.

Staging real actualmente tiene **0 partidos**, por lo que no corresponde fabricar fixtures solo para esta comprobación.

## 2. C01 — normalización real de la salida RPC

**Bloqueante antes de aplicar la migración.**

`get_player_intelligence_history` es una función `RETURNS TABLE(...)`.

Supabase/PostgREST devuelve las columnas top-level de este tipo de RPC en **snake_case**:

- `match_id`
- `played_at`
- `played_at_time_known`
- `format_id`
- `scoring_system`
- `my_team`
- `official_eligible`
- `has_open_identity_issue`
- etc.

Esto ya está explicitado y resuelto para `get_my_matches` mediante `normalizeMyMatchesRow()` en `bramulab/matches.js`.

La implementación actual de Fase A, en cambio, hace:

`translateForIntelligence(row) -> PLMatchSync.translateServerMatchToLocalShape(row)`

asumiendo que `row` ya llega en camelCase.

Los tests actuales también construyen manualmente filas camelCase, por lo que no cubren la forma real que devuelve PostgREST.

Consecuencia si se consumiera hoy la RPC directamente:

- `row.matchId`, `row.playedAt`, `row.formatId`, etc. serían `undefined`;
- `officialEligible` no se leería;
- la traducción no representaría el contrato real de red.

### Corrección requerida

**AGREGAR / FUSIONAR en Fase A, sin tocar Bloque 5:**

1. normalizar la fila real snake_case → camelCase antes de pasarla a `PLMatchSync.translateServerMatchToLocalShape`;
2. mantener esa normalización dentro de la frontera de Intelligence, sin modificar `matches.js`;
3. agregar al menos un test de regresión que use una fila con la forma **real snake_case** de `get_player_intelligence_history`;
4. confirmar que:
   - `matchId`;
   - `playedAt`;
   - `playedAtTimeKnown`;
   - `formatId`;
   - `scoringSystem`;
   - `myTeam`;
   - `hidden`;
   - `hasOpenIdentityIssue`;
   - `officialEligible`;
   - `participants`;
   - `sets`
   
   sobreviven correctamente a la traducción.

**NO TOCAR:**

- `bramulab/matches.js`;
- contratos de Bloques 5–7;
- UI;
- Supabase real hasta que esta corrección esté revisada;
- Fase B.

## 3. Nota no bloqueante — orden con hora desconocida

`matchId` puede usarse como desempate técnico estable cuando dos `playedAt` son idénticos, pero ese desempate no debe convertirse más adelante en evidencia narrativa de “antes/después” si la hora real era desconocida.

No exige ampliar Fase A en esta corrección si el dato `playedAtTimeKnown` queda preservado. Fase B/C deberá abstenerse de claims secuenciales cuando la cronología real no sea distinguible.

## 4. DECISIÓN ABIERTA preservada

Sigue abierta, sin bloquear Fase A:

**¿un partido oculto por el usuario puede alimentar Intelligence?**

El parámetro `p_include_hidden` permite resolverlo más adelante sin otra migración.

No tomar una decisión implícita en esta corrección.

## 5. Próximo gate

Después de corregir C01:

1. tests locales de Fase A;
2. commit único + push a `origin/staging`;
3. revisión central del diff;
4. recién entonces aplicar la migración a Supabase Staging real;
5. validar contrato y seguridad;
6. cerrar Fase A;
7. preparar B — Claims y evidencia.

No avanzar automáticamente a B.
