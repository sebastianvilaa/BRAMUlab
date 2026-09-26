# BRAMUlab — Handoff cambio de chat Central 26SEP

**Fecha:** 26/09/2026  
**Motivo:** el chat central alcanzó la longitud máxima.  
**Rama activa:** `staging`  
**NO tocar:** `main`, Production, BRAMUlive.  
**Versión pública:** `BRAMUlab V04.11`  
**Bundle funcional actual:** `04.11-h10`  
**HEAD funcional h10:** `7be715c3a8cd696143f6b5ca46b1e435d74513aa`

Este documento es el punto de reentrada para el próximo chat central. No reconstruir la historia desde chats previos.

---

## 1. Leer primero

En el nuevo chat:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. este documento
4. solo después, si hace falta detalle:
   - `05_Laboratorio_UX_Uso_Real.md`, especialmente §15.24, §15.25 y §15.26;
   - `22_Resultado_Correccion_Adicional_QA_26SEP.md`;
   - `24_Resultado_Fix_P0_Precision_Officialization_26SEP.md`.

No releer handoffs históricos salvo trazabilidad puntual.

---

## 2. Estado real al cortar

La ronda correctiva larga quedó implementada y luego Central detectó y corrigió un P0 backend que Claude no había reproducido en h9.

### h8 / h9 ya integrados

Quedó implementado, entre otras cosas:

- falso onboarding de Nivel al login;
- alineación del score del Resumen;
- editor de corrección rehecho con gramática de Cargar partido;
- capa compacta server-backed de jugadores;
- avatar real en búsqueda;
- @username + Nivel en recientes;
- Mis Jugadores server-backed por `player_id`;
- títulos de notificaciones con actor/acción;
- ajuste de header/fade iPhone;
- FAB `+` más presente y centrado;
- metadata crítica de Cargar partido antes del score;
- estado debajo de resultado en Historial;
- badge/punto de Historial en rojo;
- estado separado en Último partido del Home;
- nombres/equipos explícitos en el editor de corrección.

### P0 real encontrado por Central

Partido real de Staging:

`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

El error real era:

`stale_level_snapshot`

por comparación exacta entre Postgres NUMERIC y el número que hacía round-trip por JavaScript.

Caso real:

- DB: `2.4797000000000004`
- JS: `2.4797000000000002`

Mismo valor de negocio a precisión normativa de 4 decimales, pero el optimistic lock lo trataba como cambio concurrente.

---

## 3. Fix h10 — estado confirmado por Central

Claude implementó el fix completo en commit:

`7be715c3a8cd696143f6b5ca46b1e435d74513aa`

Cambios:

- nueva migración:
  `supabase/migrations/20260927140000_preprod_fix_officialize_precision_lock.sql`
- optimistic lock compara redondeado a 4 decimales;
- `match-level-engine.js` canonicaliza valores LIVE/locks a `INTERNAL_DECIMALS`;
- `match-validation.js` incorpora helper único para recuperar el `code` real desde `FunctionsHttpError.context.json()`;
- bundle `04.11-h10`;
- tests Claude:
  - Node: 270/270 PASS;
  - tests.html: 1564/1564 PASS.

### Revisión Central

Central leyó el diff, migración y código.

No se detectaron cambios destructivos ni alteración de la fórmula de Nivel.

La migración conserva:
- misma firma de `officialize_match_validation`;
- optimistic lock;
- `SECURITY DEFINER`;
- `search_path`;
- EXECUTE solo para `service_role`.

---

## 4. Backend Staging YA aplicado por Central

### Migración

Central aplicó en Supabase Staging:

`preprod_fix_officialize_precision_lock`

Supabase la registró con versión:

`20260926224931`

(nombre lógico correcto; el timestamp del registro lo asignó la herramienta al aplicar).

### Verify SQL

Se ejecutó:

`supabase/tests/verify-preprod-fix-officialize-precision-lock.sql`

Resultado:

`FIX P0 PRECISION — optimistic lock redondeado a 4 decimales OK — rollback limpio`

Fixtures residuales:
- `oplk_profiles = 0`
- `oplk_players = 0`

Permisos verificados:
- `service_role = execute true`
- `authenticated = false`
- `anon = false`

### Reproducción REAL del partido que fallaba

Central volvió a cargar el motor JS real de `staging`, reconstruyó el payload real del partido `aa41e8d9-...` con datos reales de Supabase y llamó `officialize_match_validation` dentro de:

`BEGIN; ... ROLLBACK;`

Resultado después del fix:

```json
{
  "ok": true,
  "eligible": true,
  "resultId": "66692c3c-6a1b-4d0d-a827-06645c488ae8"
}
```

El rollback dejó el partido real sin mutar; sigue `pending_validation`.

**Conclusión:** la causa raíz técnica del `stale_level_snapshot` quedó reproducida antes del fix y cerrada después del fix con el mismo caso real.

---

## 5. Edge Functions Staging YA redesplegadas

Central redesplegó con el motor h10 actualizado:

- `officialize-match` → ACTIVE v4
- `respond-match-correction` → ACTIVE v4
- `resolve-identity-issue` → ACTIVE v4

No tocar Production.

---

## 6. Frontend / deploy

Estado verificado:

- `version.json`: BRAMUlab V04.11 / `04.11-h10`
- Store: `04.11-h10`
- index/SW: 19/19 assets alineados;
- Vercel BRAMUlab: SUCCESS;
- `staging` funcional HEAD antes de este handoff: `7be715c...`.

Este handoff es solo documentación; no debe usarse para inferir un nuevo bundle.

---

## 7. Perfil — pendiente técnico que Central ya verificó sin pedirle nada a Sebastián

§15.24 tenía pendiente separar “dato no persistido” vs. “dato no renderizado”.

Central consultó la cuenta real `@seba_qa` en Staging.

Persistido en `profiles`:

- birth_date: presente;
- gender: presente;
- dominant_hand: presente;
- preferred_side: presente;
- competitive_branch: presente;
- location_id: presente;
- avatar_url: presente;
- phone/WhatsApp: presentes;
- current_category: presente.

La ubicación referenciada existe y está activa/verificada:
- Bella Vista, Buenos Aires.

Código actual:
- `auth.js#fetchOwnProfile` copia birthDate/gender/dominantHand/preferredSide/locality/region/etc. al usuario server-backed;
- `app.js#renderProfileView` renderiza esos mismos campos en MIS DATOS / MI PERFIL.

Por lo tanto, a nivel persistencia + wiring de lectura, este punto ya NO necesita una investigación grande ni una prueba cuenta-por-cuenta. Solo observarlo visualmente en el próximo Laboratorio y reabrir únicamente si algo concreto se ve mal.

La subida ocasional de foto sigue siendo “reabrir solo si vuelve a ocurrir”.

---

## 8. Idea futura confirmada — NO implementar ahora

§15.26 documenta propuesta de modal/pop-up al abrir BRAMU ante eventos importantes:

- alguien cargó un partido con vos;
- tenés que validarlo;
- hay una corrección;
- incidencia importante de identidad.

CTA contextual:
- `VER RESUMEN`;
- `VALIDAR PARTIDO`;
- `REVISAR CORRECCIÓN`;
según rol/acción real.

Objetivo adicional: evitar carga duplicada si otro jugador ya cargó el partido antes.

**Estado:** idea futura confirmada para analizar DESPUÉS de cerrar la ronda correctiva actual. No meterla en h10 ni bloquear el QA por esto.

---

## 9. Qué NO está cerrado por definición y no debe aparecer como “faltó hacerlo”

Siguen fuera / sin definición final o deliberadamente posteriores:

- `Ocultar partido` en Resumen: ubicación/patrón final todavía no definido;
- múltiples identidades incorrectas si exige arquitectura adicional;
- `Otros datos` dentro de Reportar un error si no existe contrato seguro;
- Mis grupos: ronda propia;
- responsive desktop: fuera de esta ronda;
- Realtime/polling: no agregar ahora;
- legal/P0.2;
- eliminación/P0.3;
- monetización;
- popup §15.26: propuesta futura, no parte de la batería correctiva cerrada.

No usar estos puntos para volver a frenar el QA actual salvo que aparezca una dependencia real.

---

## 10. Próximo paso del NUEVO chat central

**NO mandar a Sebastián directamente al Laboratorio apenas abra el nuevo chat.**

Primero hacer el gate final definido en `Metodo_Trabajo.md`:

1. leer README + este handoff;
2. confirmar HEAD actual de `staging`;
3. confirmar que no hubo cambios funcionales posteriores a h10;
4. reconciliar §15.24 + §15.25 contra h8/h9/h10;
5. si Work/browser puede aportar una revisión visual rápida sin gastar una ronda humana, usarlo;
6. preparar una checklist ÚNICA y concreta para Sebastián.

Cada pedido conocido debe quedar como:
- `IMPLEMENTADO`;
- `NO IMPLEMENTADO — DECISIÓN ABIERTA`;
- `NO IMPLEMENTADO — LIMITACIÓN REAL`.

No existe “queda para después” silencioso.

Si el gate final no encuentra faltantes implementables, recién ahí devolver a Sebastián al Laboratorio.

---

## 11. Checklist física que probablemente corresponda al próximo Laboratorio

No tomar esta lista a ciegas: Central debe reconciliarla primero.

Validaciones humanas de mayor valor:

- iPhone carga realmente `04.11-h10`;
- login de cuenta existente no deriva falsamente a onboarding;
- Resumen: parejas/games alineados;
- Cargar partido:
  - FAB `+`;
  - metadata antes del score;
  - selección de compañeros/rivales;
- Buscar jugadores:
  - avatar;
  - @username;
  - Nivel;
- Perfil público:
  - Agregar/Quitar jugador;
- Mi Perfil:
  - pestaña JUGADORES;
  - campos de MIS DATOS;
- RECIENTES:
  - avatar/username/Nivel cuando exista;
- Historial:
  - VICTORIA/DERROTA + estado a la derecha;
  - indicador rojo de cambio no visto;
- Home:
  - estado debajo de fecha/hora en Último partido;
- Notificaciones:
  - título actor + acción;
  - body contextual;
- corrección de resultado:
  - editor claro respecto de quién es cada lado;
  - propuesta/aceptación sin error genérico;
- identidad cuestionada:
  - resolver hacia jugador real sin error genérico;
- header/fade en iPhone.

No volver a pedir una auditoría general sin guía.

---

## 12. Regla operativa

Sebastián no debe reconstruir contexto ni transportar informes técnicos.

Mensaje esperado del usuario al nuevo chat: solo una instrucción corta apuntando a este documento.

El nuevo Central debe absorber el contexto desde repo y continuar autónomamente.
