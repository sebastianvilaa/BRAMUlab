# BRAMUlab — Checklist de retorno al Laboratorio — 26SEP

**Rama:** `staging`  
**Versión pública:** `BRAMUlab V04.11`  
**Bundle a validar:** `04.11-h10`  
**HEAD funcional:** `7be715c3a8cd696143f6b5ca46b1e435d74513aa`

Objetivo: que Sebastián haga una única revisión física amplia de la batería acumulada, sabiendo exactamente qué cambió y qué debe esperar. No usar esta ronda para redescubrir pendientes ya documentados.

## 1. Gate técnico de Central — CERRADO antes del QA humano

Central revisó h10 y ejecutó sobre Supabase Staging real:

- migración `preprod_fix_officialize_precision_lock` aplicada;
- verify SQL transaccional: **PASS / rollback limpio**;
- causa raíz del P0 confirmada y corregida: lock NUMERIC vs IEEE-754, normalizado a la precisión normativa de 4 decimales;
- reproducción REAL del partido `aa41e8d9-6d16-4c47-8928-187c5fad5ccd` con motor JS real + payload real + `officialize_match_validation` dentro de BEGIN/ROLLBACK: **`ok:true`, eligible=true**;
- reproducción REAL del flujo de identidad del partido `20a3dbd1-7cae-4e13-9b6d-efe69f653bf8`, incidencia abierta real y reemplazo por jugador registrado, dentro de BEGIN/ROLLBACK: **`ok:true`, eligible=true**;
- fixtures del verify: **0 residuos**;
- permisos de `officialize_match_validation`: service_role sí; authenticated/anon no;
- Edge Functions redesplegadas con h10:
  - `officialize-match` ACTIVE v4;
  - `respond-match-correction` ACTIVE v4;
  - `resolve-identity-issue` ACTIVE v4;
- las 3 contienen el motor canonicalizado y el manejo compartido de errores de h9;
- Vercel BRAMUlab: **success**;
- bundle: **04.11-h10**;
- assets PWA: **19/19 alineados** entre index y Service Worker.

Central verificó además una cuenta real de Staging para el pendiente de Perfil:
- birth_date, gender, dominant_hand, preferred_side, competitive_branch, ubicación, avatar, teléfono y categoría están persistidos server-side;
- ubicación real resuelve a Bella Vista, Buenos Aires;
- `Auth.fetchOwnProfile()` mapea esos campos;
- `renderProfileView()` los consume en MI PERFIL / MIS DATOS.

No hace falta una auditoría campo-por-campo de varias cuentas.

## 2. Qué debe validar Sebastián físicamente

### A — Acceso / sesión existente

**Pedido:** una cuenta existente no debe volver falsamente al onboarding de Nivel ante una lectura parcial.

**Implementado:** `levelStateReadFailed` distingue fallo de lectura vs. ausencia real; solo `PENDIENTE`/ausencia real sigue el onboarding correspondiente.

**Mirar:** entrar con una cuenta ya existente y/o reabrir la PWA.

**Esperado:** Home normal. No debe aparecer el cuestionario de Nivel como si fuera una cuenta nueva.

### B — Resumen: alineación del marcador

**Pedido:** nombres y games de ambas parejas alineados ópticamente.

**Implementado:** layout de score corregido en la primera ronda h8.

**Mirar:** Resumen de un partido de 2 y/o 3 sets.

**Esperado:** las dos filas se leen como una misma grilla; no debe verse una pareja/games caída respecto de la otra.

### C — Reportar error / corregir resultado

**Pedido:** el editor anterior era visualmente distinto, confuso y no dejaba claro quién era quién ni quién ganó cada set.

**Implementado:** lenguaje visual alineado con Cargar partido, equipos/nombres visibles, score prellenado y contraste ganador/perdedor en sets confirmados.

**Mirar:** `REPORTAR UN ERROR → RESULTADO`.

**Esperado:** se entiende inmediatamente qué pareja corresponde a cada lado, qué score pertenece a quién y quién ganó cada set. No debe sentirse como una pantalla ajena a Cargar partido.

### D — P0 corrección / validación

**Pedido:** dejar de recibir `No se pudo completar la acción` al oficializar o actuar sobre correcciones.

**Implementado:** causa raíz real corregida en SQL + motor JS; 409 de negocio conserva ahora su `code` real en frontend.

**Mirar:** validar un partido pendiente y, cuando exista una corrección pendiente real, aceptarla/rechazarla según corresponda.

**Esperado:** una operación válida se completa. Si hay un estado de negocio que impide la acción, mostrar mensaje específico y no un genérico técnico.

### E — P0 identidad cuestionada

**Pedido:** `RESOLVER` identidad no debe fallar al asignar al jugador correcto.

**Implementado:** mismo root cause técnico corregido; reproducción real transaccional del caso observado: PASS.

**Mirar:** en el partido que sigue con identidad abierta, entrar a `RESOLVER` y seleccionar al jugador correcto.

**Esperado:** resolución completa sin toast genérico; el Resumen debe quedar coherente con la nueva identidad.

### F — Buscar jugadores / RECIENTES

**Pedido:** avatar real en búsqueda; en RECIENTES usar información útil en vez de `Jugaron juntos antes`.

**Implementado:** capa compacta server-backed batch, sin N RPCs.

**Mirar:**
- Buscar Jugadores;
- selector de compañero/rivales → RECIENTES.

**Esperado:** cuando exista foto se ve el avatar real; además aparecen `@username` y Nivel BRAMU real. Si no existe foto, fallback honesto a iniciales.

### G — Mis Jugadores / Agregar Jugador

**Pedido:** recuperar la función sin volver al sistema legacy por nombre.

**Implementado:** lista server-backed privada/unilateral por `player_id`; botón AGREGAR/ELIMINAR y pestaña JUGADORES restaurados.

**Mirar:** Perfil público de un jugador → agregar; Mi Perfil → JUGADORES; quitarlo.

**Esperado:** agregar/quitar funciona, la pestaña existe y abre siempre al jugador correcto aunque haya nombres repetidos.

### H — Notificaciones

**Pedido:** dejar `Partido oficial` y usar actor + acción real.

**Implementado:** títulos contextuales cuando el actor puede resolverse.

**Mirar:** bandeja de Notificaciones.

**Esperado:** ejemplos del estilo `Esteban confirmó tu partido`, `Seba propuso una corrección`; debajo solo contexto útil del partido, sin repetir la misma frase.

### I — Header / degradé en iPhone

**Pedido:** el fade/blur superior seguía invadiendo logo/título en iPhone.

**Implementado:** documento bloqueado contra elastic bounce de Safari/iOS; las vistas continúan con scroll interno.

**Mirar:** especialmente en iPhone/PWA, al entrar y hacer scroll/overscroll.

**Esperado:** logo/título limpios; el degradé no debe trepar/invadir la cabecera. Este punto requiere iPhone físico para cierre visual definitivo.

### J — Botón central + de Cargar partido

**Pedido:** más presencia y mejor centrado.

**Implementado:** 52→58 px y glifo de texto reemplazado por SVG geométricamente centrado.

**Mirar:** barra inferior.

**Esperado:** acción principal más clara, + ópticamente centrado, sin tapar navegación/contenido.

### K — Cargar partido: metadata antes del score

**Pedido:** formato/puntuación/fecha-hora visibles antes de empezar a cargar sets.

**Implementado:** bloque compacto único arriba del primer set.

**Mirar:** Cargar partido.

**Esperado:** formato/puntuación a la izquierda y fecha/hora a la derecha cuando entra; wrap limpio en móvil; tocar sigue abriendo la edición existente; no debe haber duplicación más abajo.

### L — Historial

**Pedido:** estado debajo de VICTORIA/DERROTA a la derecha; indicador de cambios más visible.

**Implementado:** columna derecha resultado+estado; punto de cambios del ícono pasa a rojo; acento cian de la fila permanece.

**Mirar:** partidos pendientes / identidad cuestionada / cambio externo.

**Esperado:** estado alineado debajo del resultado, nunca abajo a la izquierda; punto rojo en navegación cuando corresponda.

### M — Home / Último partido

**Pedido:** no poner `PENDIENTE DE VALIDACIÓN` al lado de VICTORIA/DERROTA.

**Implementado:** estado debajo de fecha/hora a la derecha; resultado queda separado.

**Mirar:** tarjeta Último partido con un estado pendiente.

**Esperado:** jerarquía limpia: fecha/hora arriba-derecha, estado debajo; VICTORIA/DERROTA no comparte la línea con el estado.

## 3. Qué NO forma parte de esta validación y por qué

Estos puntos quedan explícitos; ninguno está “olvidado”:

- **Popup al abrir BRAMU por evento importante (§15.26):** propuesta de producto confirmada para analizar después de cerrar esta ronda. No implementada todavía.
- **Ocultar partido:** ubicación/protagonismo siguen abiertos porque todavía no se definió el patrón final (menú, acción contextual u otro). DECISIÓN ABIERTA de UX.
- **Subida ocasional de foto:** no hay reproducción confiable; reabrir solo si vuelve a ocurrir. LIMITACIÓN DE EVIDENCIA, no se inventa un fix.
- **Mis grupos:** ronda propia de producto/UX; fuera del paquete actual.
- **Responsive desktop:** fuera del paquete actual.
- **Realtime/polling:** deliberadamente no se agrega en esta etapa.
- **Múltiples identidades incorrectas simultáneas:** no ampliar sin revisar impacto arquitectónico.
- **`Otros datos` dentro de Reportar error:** no mostrar hasta tener contrato seguro para corregirlos.
- **Perfil — datos personales/deportivos:** Central ya verificó persistencia + mapeo + render con una cuenta real. No requiere una ronda manual dedicada; si Sebastián ve una discrepancia concreta, recién ahí se reabre.

## 4. Regla del Laboratorio

La revisión física de esta batería busca solo dos cosas:

1. confirmar que lo implementado se ve/se siente como Sebastián esperaba;
2. detectar una interpretación distinta o una regresión nueva.

No usar esta ronda para volver a explicar pendientes ya documentados.

Si un punto falla, registrar:
- pantalla;
- acción;
- resultado esperado;
- resultado real;
- captura si ayuda.

No repetir pruebas equivalentes una vez que el riesgo concreto ya quedó cubierto.
