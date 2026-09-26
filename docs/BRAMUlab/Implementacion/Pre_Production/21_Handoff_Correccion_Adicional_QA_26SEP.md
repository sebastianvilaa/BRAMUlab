# BRAMUlab — Handoff segunda corrección post-QA 26SEP

**Fecha:** 26/09/2026  
**Rama:** `staging`  
**HEAD de partida:** `b0f505e719c5cb8a94713187bd9fc166351f07a1`  
**Versión pública:** `BRAMUlab V04.11`  
**Bundle actual:** `04.11-h8`

## 1. Estado previo confirmado por Central

La primera ronda correctiva de Claude quedó integrada en Staging y Central la revisó.

Implementado en h8:
- falso onboarding de Nivel al login;
- nuevo layout técnico del score en Resumen;
- editor de corrección rehecho sobre la gramática de carga;
- capa compacta server-backed de jugadores;
- avatar real en búsqueda;
- @username + Nivel en recientes registrados;
- Mis Jugadores server-backed por `player_id`;
- títulos de notificaciones por evento.

Migraciones aplicadas por Central en Supabase Staging:
- `preprod_ux_players_compact`;
- `preprod_ux_mis_jugadores`.

Verifies:
- players compact: PASS;
- Mis Jugadores: PASS después de corregir exclusivamente dos errores del FIXTURE de verify:
  1. esperaba listar un jugador que el propio fixture ya había marcado inactivo;
  2. usaba `pg_sleep` para distinguir `now()` dentro de una misma transacción, pero `now()` es estable durante la transacción.

No se cambió producto para corregir esos tests.

Postchecks:
- 0 fixtures residuales `plc_*` / `mj_*`;
- RLS activa en `player_saved_players`, 0 policies directas;
- RPCs solo `authenticated`, no `anon`;
- búsqueda real de Esteban devuelve username, Nivel y `avatar_url` real;
- bundle h8: 19/19 assets PWA alineados;
- Vercel BRAMUlab verde.

**NO pedir todavía QA manual a Sebastián.**

## 2. P0 — fallo compartido de oficialización / corrección / identidad

Este es el punto más importante de esta ronda.

### Evidencia real de Staging

Partido:
`aa41e8d9-6d16-4c47-8928-187c5fad5ccd`

Participantes:
- A: Matu + Seba
- B: Esteban + Lucho

Se creó el 26/09 y hubo confirmaciones/corrección real.

Acciones registradas:
- created → Esteban;
- confirmed → Seba;
- revision_proposed → Seba;
- confirmed → Esteban.

Sin embargo el partido sigue `pending_validation`.

Logs de Supabase muestran múltiples respuestas reales:

`POST | 500 | /functions/v1/officialize-match`

entre 17:06 y 17:11 UTC, tanto con sesión de Seba como de Esteban.

Por lo tanto NO es un problema visual del toast.

### Identidad cuestionada

Partido:
`20a3dbd1-7cae-4e13-9b6d-efe69f653bf8`

Incidencia:
`6cd9cd16-5450-4496-a9c4-6491403047ed`

Slot:
- team B
- position 2
- jugador anterior: Diego
- abrió: Seba
- status: open

Sebastián intentó reemplazarlo por Esteban y recibió:
`No se pudo completar la acción. Probá de nuevo.`

Log real:
`POST | 200 | /functions/v1/resolve-identity-issue`

pero la UI recibió un resultado `ok:false`.

Central ejecutó, dentro de BEGIN/ROLLBACK, la RPC SQL de autorización:

`resolve_identity_issue(auth Seba, issue, Esteban, false)`

Resultado:
`identity_resolved_authorized`, `needsRecompute:true`.

Conclusión:
- autoridad/ventana/reemplazo son válidos;
- la falla sucede DESPUÉS, durante recomputación/oficialización.

Además, el resultado original del partido aparece `reverted` por la incidencia, como corresponde, y la incidencia sigue abierta. No hay estado parcial.

### Hipótesis técnica acotada

`officialize-match`, `respond-match-correction` y `resolve-identity-issue` convergen en:

`supabase/functions/_shared/match-officialize-core.ts`

y finalmente en:

`officialize_match_validation`.

Central probó transaccionalmente `officialize_match_validation` sobre el partido nuevo con:
- trigger initial;
- revisión real;
- `eligible=false`;
- arrays vacíos de updates;

y la RPC persistente completó correctamente dentro del rollback.

Eso sugiere que la falla no está en el estado básico/permisos de la RPC, sino probablemente en el payload calculado por el motor / rama eligible / actualizaciones de Nivel.

### Tarea

Reproducir primero el caso real con un runner/fixture seguro y capturar el error exacto.

Hoy `match-officialize-core.ts` aplasta `rpcError` a:
`persist_failed`.

En Staging debe existir logging técnico suficiente para diagnosticar el error real sin exponer datos sensibles al cliente.

Corregir la causa compartida, no tres parches separados.

Validar punta a punta:
1. primera oficialización;
2. corrección aceptada;
3. identidad resuelta;
4. identidad no identificada si comparte el mismo core;
5. idempotencia/reintento;
6. ningún doble efecto de Nivel.

No mutar manualmente los partidos reales anteriores para “arreglarlos”.

## 3. Notificaciones — título actor + acción

h8 cambió `Partido oficial` por `Resultado confirmado`.

Eso mejora, pero la aclaración posterior de producto es más específica.

Cuando el actor real esté disponible, preferir:

`Esteban confirmó tu partido`

como título.

El body debe aportar CONTEXTO, no repetir la frase:
- rivales;
- score;
- información necesaria para reconocer el partido.

Ejemplo conceptual:

Título:
`Esteban confirmó tu partido`

Body:
`vs Esteban + Gusti · 6–4 · 3–6 · 6–2`

Para otros eventos:
- `Seba propuso una corrección`;
- `Matu aceptó la corrección`;
- `Seba cuestionó un participante`;
- etc., solo con actor real.

Sin actor resoluble, usar título de evento neutro.

Conservar:
- selfCaused;
- read/unread;
- click al partido;
- matchContext;
- no N+1.

## 4. Header / degradé — iPhone

El fade/blur superior sigue percibiéndose sobre títulos/logo en iPhone aunque desktop se vea correcto.

Reabrir SOLO la variante iOS/PWA.

Revisar:
- `backdrop-filter` / `-webkit-backdrop-filter`;
- pseudo-elemento del header;
- safe-area inset;
- altura real del fade;
- z-index/stacking;
- overscroll.

Objetivo:
- profundidad sutil;
- nunca ensuciar BRAMUlab/logo/título;
- no parche distinto por pantalla.

Validar al menos conceptualmente en viewport iPhone.

## 5. CTA central “+” de Cargar partido

Sebastián lo percibe:
- demasiado chico;
- con poca presencia;
- ópticamente algo caído.

Ajustar:
- diámetro/presencia moderadamente mayor;
- símbolo + proporcionado;
- centrado óptico vertical/horizontal;
- revisar safe-area;
- no tapar navegación ni contenido.

Debe seguir siendo claramente la acción primaria de la app.

## 6. Cargar partido — metadata crítica ANTES del resultado

Pedido ya confirmado; ya no es una idea indefinida.

Hoy formato/puntuación/fecha quedan parcialmente duplicados y la edición completa aparece después del score.

Problema:
el usuario puede empezar a cargar sets con un formato incorrecto y descubrirlo demasiado tarde.

Mover ANTES del bloque de resultado una barra/área compacta con:
- formato;
- cantidad/tipo de sets (`Mejor de 3` o lo que corresponda);
- sistema de puntuación;
- fecha/hora.

Dirección preferida:
- una sola área compacta arriba de los equipos o inmediatamente después de ellos, pero SIEMPRE antes del primer set;
- formato/puntuación a la izquierda y fecha/hora a la derecha si entra;
- permitir wrap limpio en iPhone;
- tocar abre la edición vigente;
- evitar duplicación abajo.

No inventar “americano” si el producto todavía no lo soporta; el objetivo es hacer visible el formato REAL seleccionado antes de cargar score.

## 7. Historial — resultado y estado en columna derecha

En tarjetas de Historial:

- `VICTORIA` / `DERROTA`: arriba a la derecha;
- estado (`PENDIENTE DE VALIDACIÓN`, `IDENTIDAD CUESTIONADA`, etc.): debajo del resultado, también alineado a la derecha.

No dejar el estado abajo a la izquierda.

Mantener separados conceptualmente:
- resultado deportivo;
- estado administrativo/acción.

### Indicador de cambios no vistos

El punto del ícono de Historial funciona.

Probar rojo para el punto/badge de “hay cambios” en vez de celeste.

El acento celeste de la fila cambiada puede mantenerse por ahora.

No reestructurar el sistema.

## 8. Home — Último partido

Actualmente `DERROTA` / `VICTORIA` y `PENDIENTE DE VALIDACIÓN` pueden quedar en la misma línea.

Cambiar jerarquía:

- resultado deportivo mantiene su lugar protagonista;
- fecha/hora arriba a la derecha;
- estado debajo de fecha/hora, alineado a la derecha;
- nunca resultado + estado como dos píldoras hermanas en la misma línea.

Consistente con Historial.

## 9. Editor de corrección — claridad de equipos

h8 rehízo el editor usando la gramática del cargador. Revisarlo con la aclaración final de Sebastián:

NO basta con tener un court/keypad parecido.

Debe ser inequívoco:
- qué pareja/equipo corresponde a cada lado;
- qué números pertenecen a quién;
- quién ganó cada set;
- score actual prellenado;
- orientación consistente con el Resumen.

Usar nombres reales de las parejas/equipos en el editor.

No obligar al usuario a deducir “izquierda=A / derecha=B”.

## 10. Mantener lo ya resuelto en h8

No regresionar:
- login sin falso onboarding;
- alineación compartida del score;
- avatar de búsqueda;
- fila compacta;
- recientes con @username/Nivel;
- Mis Jugadores server-backed;
- identidad por player_id.

## 11. NO tocar

- main;
- Production;
- BRAMUlive;
- Mis grupos;
- fórmula de Nivel;
- reglas de Ranking;
- legal/P0.2;
- eliminación/P0.3;
- Realtime/polling;
- monetización.

## 12. Tests

Obligatorios:

### P0 shared core
- reproducir fallo previo antes del fix;
- officialize initial real;
- corrección aceptada;
- identidad resuelta con reemplazo registrado;
- reintento idempotente;
- rollback/estado atómico si falla;
- Nivel no se duplica.

### UX
- notificación actor+acción con fallback sin actor;
- Home pending: estado debajo de fecha/hora;
- Historial pending/identity: estado debajo de resultado;
- metadata de Cargar partido antes del score;
- editor de corrección muestra nombres de ambos equipos;
- + central no rompe viewport/safe-area.

### Regresión
- Node;
- tests.html;
- boot smoke.

## 13. Versionado

Mantener versión pública:
`BRAMUlab V04.11`

Bundle objetivo:
`04.11-h8 -> 04.11-h9`

Un solo bump final.

## 14. Documentación

Crear:
`docs/BRAMUlab/Implementacion/Pre_Production/22_Resultado_Correccion_Adicional_QA_26SEP.md`

Documentar especialmente:
- causa exacta del P0 shared core;
- evidencia de reproducción;
- fix;
- si requirió migración y/o redeploy de Edge Functions;
- UX implementada;
- tests;
- riesgos residuales reales.

## 15. Entrega

Revisar diff completo.

Idealmente:
`fix(preprod): cerrar bateria adicional QA 26SEP`

Push a `origin/staging`.

FRENAR.

NO pedir QA manual a Sebastián.

Central revisará, aplicará cualquier migración/redeploy necesario a Staging y recién entonces decidirá el retorno a Laboratorio.
