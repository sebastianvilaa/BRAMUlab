# 79 — Handoff · Grupos B2b — Lobby + pulido UX + desglose de puntos

**Fecha:** 28/09/2026  
**Rama:** `staging`  
**Estado previo:** Fase A + B1 + B2a backend lobby **CERRADOS en Staging**.  
**Objetivo:** implementar la experiencia frontend de B2 usando el backend real ya aplicado. **Sin foto/Storage** (eso queda para B2c).

## Fuentes obligatorias

Leer primero:
- `docs/BRAMUlab/README.md`
- `docs/BRAMUlab/Grupos_BRAMU.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/70_Analisis_Lobby_Grupos_B2_28SEP.md`
- `docs/BRAMUlab/Implementacion/Pre_Production/78_Resultado_B2a_Frontera_Semanal_Canonica_28SEP.md`
- este handoff

Inspeccionar solo el código de Grupos, auth/RPC y componentes visuales reutilizables necesarios.

No leer Archivo/Backup. No tocar `main`, Production ni BRAMUlive.

---

# A. Lobby de Grupos — entrada obligatoria

**REEMPLAZAR** la entrada actual directa al último grupo:

- bottom-nav **Mis grupos** → siempre abre un lobby dedicado **GRUPOS BRAMU**;
- incluso con un solo grupo;
- tarjeta → detalle existente del grupo;
- back desde detalle → lobby;
- selector rápido existente dentro del detalle **NO TOCAR**.

Crear una vista separada para lobby; no convertir el detalle actual en lobby.

Backend:
- agregar wrapper `Auth.getGroupsLobby(weekFrom, weekTo)`;
- usar la RPC B2a ya aplicada;
- cache solo efímero/memoria;
- no volver a localStorage como autoridad server-backed;
- no N+1 por grupo;
- resolver identidades en batch.

Semana:
- usar `PG.weekStartBA`, ya cerrado;
- no volver a timezone local del dispositivo.

---

# B. Lobby con grupos — tarjeta real

Una misma tarjeta reusable por grupo.

Identidad V1 sin foto todavía:
- fallback de iniciales del nombre del grupo;
- nombre;
- cantidad de miembros activos.

Lectura semanal:
- hasta 3 posiciones visibles;
- posición real, nombre, puntos;
- respetar empates `1,1,3`;
- si un empate en la punta genera demasiadas filas, comprimir según fuente maestra;
- si el usuario actual no está en las filas visibles: `Vos · #N · X pts`;
- si ya está visible, no duplicarlo.

Estados cerrados:
- 1 miembro: `El grupo ya existe. Ahora falta la banda.` / `Con 3 jugadores activos empieza la competencia.`
- 2 miembros: `Ya son 2. Falta uno para empezar a sumar.` / `Con 3 jugadores activos arranca la competencia.`
- 3+ sin actividad: `Esta semana están todos vagos 😴` / `¿Cuándo se arma partido?`

Orden:
- respetar exactamente `lastActivityAt` del backend;
- no recalcular actividad en cliente;
- desempate ya viene autoritativo.

Cuando ya existen grupos:
- acción secundaria **Crear otro grupo**;
- no CTA gigante por encima de las tarjetas.

Implementar una función pura tipo `buildLobbyCardSummary` en `groups.js` para que la tarjeta no replique reglas deportivas.

---

# C. Estado cero

Header principal: **GRUPOS BRAMU**.

Copy cerrado:
- claim: **Tu grupo de siempre. Una competencia nueva cada semana.**
- subcopy: **Creá un grupo con la gente con la que jugás. BRAMU detecta los partidos que corresponden, suma los puntos y arma la competencia automáticamente.**

Tres módulos compactos:
- **Ganá y sumá** — 5 puntos por victoria + bonus.
- **Tus 3 mejores cuentan** — evita que gane simplemente quien más juega.
- **Cada semana vuelve a empezar** — tabla semanal + Race anual.

Preview:
- etiqueta clara **EJEMPLO**;
- reutilizar EXACTAMENTE el mismo componente de tarjeta del lobby;
- datos demo completamente separados de verdad real.

CTA primario: **Crear mi grupo**.  
Secundario: **Cómo funciona**.

No convertirlo en onboarding largo.

---

# D. Ayuda

**FUSIONAR** la ayuda existente de puntos en una única hoja:

**Cómo funcionan los Grupos BRAMU**

Acceso:
- `?` discreto en header del lobby;
- puede mantenerse acceso equivalente dentro del detalle si queda coherente;
- engranaje sigue siendo solo configuración/admin.

Contenido corto y humano:
- 3/4 miembros para que un partido entre;
- 5 puntos por victoria;
- bonus reales;
- tus 3 mejores partidos puntúan;
- semana lunes-domingo;
- Race acumula los puntos semanales efectivos.

No duplicar sistema de ayuda.

---

# E. Creación

Conservar flujo base y selector actual.

Ya existe C1 de validación contextual del nombre; no regresarlo.

Después de create exitoso, antes de entrar al detalle:
- **Tu grupo está listo**
- nombre del grupo;
- `N jugadores`;
- `Desde ahora, los partidos que cumplan las reglas del grupo entran automáticamente.`
- opcional si encaja visualmente: `Vos jugás. BRAMU lleva la cuenta.`
- CTA **Ir al grupo**

Luego abrir detalle.

En lobby con grupos, create = **Crear otro grupo**.

---

# F. CTA Agregar jugador

**REEMPLAZAR** el lima macizo por la familia secundaria lima ya vigente:
- borde lima;
- texto lima;
- fondo muy sutil;
- misma lógica en detalle/configuración donde aplique.

No cambiar función ni permisos.

---

# G. Desglose de puntos — decisión cerrada nueva

## Semana actual / Semana pasada

Hoy tocar fila → Perfil.

**REEMPLAZAR:**
- tocar fila → sheet/panel compacto **desglose de puntos**;
- `Ver perfil` queda como acción secundaria.

Cabecera:
- avatar/nombre/@usuario;
- actividad real del período;
- **puntos totales a la derecha en la misma jerarquía/posición conceptual que hoy**.

Partidos:
- filas compactas, altura cercana a la fila actual del ranking;
- por línea: fecha · compañero · rivales · resultado;
- puntos del partido alineados a la derecha;
- bonus real breve cuando exista: Sorpresa / Remontada / Victoria clara.

Top 3:
- distinguir claramente los 3 partidos que aportaron al total;
- derrota → `0 pts`;
- victoria puntuable que quedó fuera → `No entra en tus 3 mejores`.

**No duplicar lógica.** Refactorizar el motor si hace falta para que `computeWeeklyTable` y el desglose compartan el MISMO helper/selección de partidos contados. No puede existir un top 3 para la tabla y otro reconstruido aparte en UI.

Usar únicamente partidos/evidencia real que ya llegan de B1.

## Race anual

Tocar fila Race → resumen compacto del jugador **semana por semana**:
- una línea por semana;
- rango/fecha de la semana;
- actividad breve si sirve;
- puntos efectivos de esa semana a la derecha;
- orden recomendado: más reciente primero.

V1:
- NO desplegar por defecto todos los partidos de todas las semanas;
- no acordeones anidados gigantes;
- `Ver perfil` también disponible secundario.

El detalle B1 ya tiene `get_group_competition_data` con historial suficiente; no crear backend nuevo salvo limitación real comprobada.

---

# H. Visual / navegación

No rediseñar el detalle aprobado.

Mantener sistema visual BRAMU:
- deportivo, limpio, oscuro;
- cards y radios/tipografía existentes;
- sin estética paralela;
- evitar tarjetas dentro de tarjetas innecesarias;
- filas de desglose densas pero legibles.

NO TOCAR salvo integración necesaria:
- tabla existente;
- tabs Semana actual / Semana pasada / Race;
- Intelligence;
- gear;
- selector interno;
- lógica de admins;
- reglas de baja;
- fórmula de puntos;
- Nivel/Ranking.

---

# I. Tests

Focales mínimos:

Lobby:
- 1/2/3+ miembros;
- sin partidos;
- top 3;
- empate 1,1,3;
- compresión de empate;
- `Vos` visible solo cuando corresponde;
- orden conserva backend;
- ejemplo usa mismo componente pero no verdad real;
- bottom-nav → lobby; card → detalle; back → lobby.

Desglose:
- total visible = suma exacta de los 3 partidos marcados como contados;
- 10 partidos / 6V / 4D puede mostrar 17 pts sin esconder los otros 7;
- derrota = 0;
- victoria fuera top3 = no contada;
- bonus mostrado coincide con `computeMatchPointsBreakdown`;
- Race semanal suma al total anual;
- fila ya no abre Perfil directamente;
- `Ver perfil` sí abre Perfil.

Regresión:
- B1 focal;
- h32 frontera BA;
- suite general una vez al final.

---

# J. Vercel / salida

**Situación actual:** Vercel está rate-limited por 24 h. No reintentar deploys durante la implementación.

Igualmente:
1. implementar;
2. tests;
3. diff review;
4. bump de bundle una sola vez;
5. commit lógico;
6. push `origin/staging`;
7. dejar resultado corto.

Si Vercel vuelve a rechazar por rate limit:
- registrarlo como limitación operativa;
- NO hacer microcommits/no-op para reintentar;
- Central disparará/validará un único deploy del HEAD más reciente cuando se libere la cuota.

No declarar PASS visual sin deploy real.

No iniciar B2c/foto.
