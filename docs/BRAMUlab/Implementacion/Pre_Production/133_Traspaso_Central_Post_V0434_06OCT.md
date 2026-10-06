# 133 — Traspaso Central · Estado integral post V04.34 y próximo QA humano

**Fecha:** 06/10/2026  
**Rama única:** `staging`  
**Objetivo de este documento:** permitir continuar BRAMUlab en un chat Central nuevo sin reconstruir decisiones ni repetir QA. Leerlo después de `docs/BRAMUlab/README.md` y `docs/BRAMUlab/Metodo_Trabajo.md`.

---

## 1. Estado exacto al cierre de este chat

- Versión: **BRAMUlab V04.34 / bundle 04.34-h1**.
- HEAD actual de `staging`: **`5962a6199d81dcf610c492381d43c4ef43100706`**.
- Commit funcional V04.34: **`ffaab1c0b55d19ae4491f13666cc33c7c79e580a`**.
- Vercel sobre HEAD actual: **SUCCESS**.
- Supabase Staging: proyecto `serxtivkfnptzurnvewg`.
- Migración V04.34:
  `20261006100000_v0434_persist_different_duplicate_decision.sql`
  **APLICADA Y VERIFICADA EN STAGING**.
- Gate técnico Central: **PASS**.
- Production, `main` y BRAMUlive: **NO TOCAR**.

Fuentes inmediatas:
- handoff de alcance V04.34: `131_Handoff_Cierre_QA_V0433_Correccion_Final_V0434_06OCT.md`;
- resultado Claude: `132_Resultado_Cierre_QA_V0434_06OCT.md`;
- Issue #29: tracking de esta ronda.

---

## 2. Decisiones de producto ya cerradas — Invitados / identidad / Recuperados

No volver a discutirlas salvo que el QA revele una contradicción real.

### Claim

- `¿SOS X?` sigue siendo un modal/sheet.
- Debe mostrar **el partido que originó esa invitación**, no un partido arbitrario.
- El mini-partido usa identidad visual compacta: avatares chicos, nombres/@ cuando existan, dos parejas y score.
- `SÍ, SOY YO` confirma la identidad histórica y **recupera automáticamente todos los partidos asociados**.
- Se eliminó la obligación de `SÍ, LO JUGUÉ / NO, NO LO JUGUÉ` uno por uno.
- `NO, NO SOY YO` no consume el link.

### Efectos deportivos

- Los recuperados que ya estaban validados entran inmediatamente al historial real y computan para Nivel/calibración/estadísticas según reglas vigentes.
- No se reescriben rankings semanales ya publicados ni historia deportiva de terceros fuera de reglas actuales.
- Los pendientes siguen sin efectos oficiales hasta validarse.

### Post-claim

Después de `SÍ, SOY YO`:
- cerrar modal;
- abrir pantalla completa `RECUPERAMOS N PARTIDOS`;
- informar que ya forman parte del historial;
- mostrar **solo** los partidos que necesitan una respuesta real del recuperado;
- usar validación rápida `Reportar un error / Validar partido`;
- `OMITIR` siempre permitido mientras queden accionables;
- si no quedan accionables: `ENTRAR A BRAMU`;
- `VER LOS N RECUPERADOS` abre `Historial > Recuperados`.

### Historial > Recuperados

- **Sí permanece dentro de Historial**.
- Es un filtro de origen, no una bandeja de tareas.
- Visible 30 días desde cada recuperación.
- Luego desaparece el filtro especial; los partidos siguen en Historial.
- Reportar un error no vence a los 30 días.
- Notificación al reclamante `RECUPERAMOS N PARTIDOS` queda en Centro de Notificaciones y abre este filtro.

---

## 3. Partidos pendientes — arquitectura cerrada

### Pantalla propia

`PENDIENTES` **NO** es una pestaña de Historial.

Debe existir pantalla propia **PARTIDOS PENDIENTES**, abierta desde:
- card ancha de Home;
- gate de 5 pendientes;
- cualquier CTA general de pendientes.

Orden:
1. **POR VALIDAR**
2. **POR RESOLVER**
3. **ESPERANDO VALIDACIÓN**

### Semántica

- `POR VALIDAR`: el usuario/su pareja puede actuar ahora.
- `POR RESOLVER`: incidencia accionable distinta de validar.
- `ESPERANDO VALIDACIÓN`: depende del otro lado; informativo.

En listas:
- `POR VALIDAR`: quick card con `Reportar un error / Validar partido`.
- `POR RESOLVER`: CTA general **`Revisar partido`** azul.
- `ESPERANDO VALIDACIÓN`: misma card base, sin acciones.

No repetir badges `POR VALIDAR` / `ESPERANDO VALIDACIÓN` dentro de cards que ya están bajo esas secciones.

### Identidad

Copy humano elegido:
- **JUGADOR POR IDENTIFICAR**
- texto: `Revisá este partido para confirmar quién jugó.`

En Resumen, si la incidencia es identidad:
- CTA **`IDENTIFICAR JUGADOR`** azul.

Evitar `Identidad cuestionada` en UI.

---

## 4. Home — decisiones cerradas

### Carrusel superior

Mantener arriba **solo lo accionable**:
- partido por validar;
- jugador por identificar / incidencia por resolver.

No mostrar `ESPERANDO VALIDACIÓN` arriba.

V04.34 debe tener:
- altura fija;
- título máximo 1 línea;
- cuerpo máximo 2 líneas;
- ellipsis;
- copy largo nunca agranda la tarjeta.

### Card ancha PARTIDOS PENDIENTES

Ubicada abajo en Home, antes de Buscar jugadores / zona equivalente.

Tres columnas:
- POR VALIDAR
- ESPERANDO
- POR RESOLVER

Dirección visual:
- icono, título/acento y **los tres números** en amarillo/ámbar;
- labels blanco/gris;
- borde ámbar sutil;
- no usar verde/blanco/amarillo como semáforo.

Tocar → pantalla propia `PARTIDOS PENDIENTES`.

---

## 5. Quick validation — interacción aprobada

La interacción de V04.33 se probó manualmente y gustó:

1. toca `Validar partido`;
2. botones desaparecen;
3. aparece franja verde `✓ PARTIDO VALIDADO` durante ~0,8–1 s;
4. card se contrae/desvanece;
5. las demás suben.

No abrir modal de éxito.

V04.34 lleva el mismo patrón al **Resumen**:
- botones → `✓ PARTIDO VALIDADO` → repintado oficial;
- si falla, no fingir éxito.

Estilo de botones:
- `Reportar un error`: rojo outline;
- `Validar partido`: verde outline;
- sentence case;
- mismo estilo en quick card, Recuperados y Resumen;
- verde macizo se reserva al feedback de éxito.

---

## 6. Resumen del partido — reglas de presentación

### Orientación personal

Backend Team A/B sigue canónico e intocable.

En UI personal:
- **mi pareja siempre arriba y verde**;
- rival abajo y azul.

V04.32 solo había arreglado color; V04.34 también reordena filas.

### Estado principal

Arriba de `GANADORES`:
- **PARTIDO POR VALIDAR** si depende de mí;
- **ESPERANDO VALIDACIÓN** si depende del otro lado.

No repetir el mismo estado en el meta superior ni con un párrafo redundante abajo.

### Intelligence pendiente

El disclaimer:
`Este partido todavía está pendiente: estos insights se basan en lo cargado y pueden cambiar cuando se valide.`

debe tener la misma jerarquía sutil que:
`Una lectura objetiva de lo que pasó en la cancha, no una planilla de estadísticas.`

V04.34 ya implementó menor tamaño/peso/color e itálica + más aire.

---

## 7. Duplicados — hallazgo importante y fix V04.34

### Bug descubierto manualmente

Se cargaron dos encuentros reales distintos con:
- mismos 4 jugadores;
- mismas parejas;
- horarios muy cercanos;
- scores diferentes.

BRAMU preguntó `POSIBLE PARTIDO DUPLICADO`; se eligió explícitamente `ES OTRO PARTIDO`. El segundo se creó bien.

Luego Gastón reclamó su identidad y Recovery volvió a preguntar por **ese mismo par** como posible duplicado.

Causa: `disambiguationForceNew` permitía crear el nuevo match pero no persistía la decisión negativa.

### Regla cerrada

Si alguien responde **ES OTRO PARTIDO / SON DOS PARTIDOS DISTINTOS**, esa decisión debe ser durable para ese par de `match_id` y no volver a proponerse en recovery/sync/sesiones futuras.

### Fix aplicado

V04.34 reutiliza `match_duplicate_candidates`:
- par ordenado/simétrico;
- persiste `resolved_different`;
- no pisa `resolved_same`;
- recovery ya respeta ese par y no lo recrea como `open`.

Migración aplicada y prueba real transaccional Central: **PASS**.
El par real del QA Esteban/Gastón vs Seba/Leo ya quedó `resolved_different`.

### Pre-check temprano

V04.34 agrega aviso **antes de cargar score**, al pasar desde jugadores a resultado:
- mismos 4;
- mismas parejas;
- formato;
- ventana temporal vigente.

Modal:
- `POSIBLE PARTIDO DUPLICADO`;
- mini-partido;
- `ES ESTE PARTIDO`;
- `ES OTRO PARTIDO`;
- `CANCELAR` terciario.

El gate backend final al guardar **se conserva** para carreras/concurrencia.

---

## 8. QA humano ya hecho antes de V04.34 — no repetir

Se validó manualmente:
- claim nuevo desde invitación;
- recuperación automática;
- 1 partido validado + 1 pendiente;
- pantalla `RECUPERAMOS 2 PARTIDOS`;
- solo el accionable pide respuesta;
- `Historial > Recuperados`;
- validación rápida real;
- contador Pendientes baja;
- partido desaparece;
- historial/estadísticas se actualizan;
- claim deja de mostrar al jugador como Sin cuenta tras refresh;
- `NO SOY YO` ya había sido cubierto en rondas anteriores;
- dedupe SAME histórico ya había pasado V04.29.

No crear otra batería de cuentas.

---

## 9. Fixtures humanos disponibles al traspaso

Cuentas activas habituales:
- **Esteban**
- **Seba**
- **Gastón** ya fue creado y reclamó su identidad.

**Leo** sigue como provisional/sin cuenta y puede reutilizarse para un smoke futuro.

Caso Gastón/Leo existente:
1. `Esteban / Gastón vs Seba / Leo` — 6–2 · 6–2 para Esteban/Gastón — validado.
2. `Seba / Leo vs Esteban / Gastón` — 6–4 · 6–3 para Seba/Leo — quedó pendiente de respuesta del lado Esteban/Gastón.

Gastón recuperó ambos.
El par de encuentros fue resuelto como **dos partidos distintos**.

No compartir ni pedir contraseñas/OTP.

---

## 10. V04.34 — pruebas técnicas ya hechas

Claude informó:
- Node app: **853 tests · 852 pass · 1 fail preexistente**;
- V04.34 nuevo: **14/14**;
- backend: **96 pass · 6 skipped · 0 fail**, incluido dedupe V04.34 4/4;
- replay limpio / ACL / release-check: PASS;
- `tests.html`: 1496/1504, mismos 8 V034 dependientes de fecha;
- navegador con mock: PASS visual/funcional de Home, pantalla propia, Resumen, inline, identidad, Intelligence y modal duplicado.

Central:
- aplicó migración V04.34 a Supabase Staging;
- verificó ACL/server-only;
- ejecutó prueba transaccional real y rollback;
- verificó `resolved_different` y 0 candidatos abiertos;
- Vercel HEAD actual: SUCCESS.

**Gate técnico: PASS.**

---

## 11. Próximo paso EXACTO en el chat nuevo

Hacer **QA humano final MUY corto**. No implementar nada antes de verlo.

### Paso 1 — solamente

Recargar **Esteban** y mirar Home.

Comprobar visualmente:
- carrusel superior con altura fija;
- no aparecen waiting arriba;
- card ámbar `PARTIDOS PENDIENTES`;
- 3 contadores coherentes;
- al tocarla abre **pantalla propia**, no Historial.

Pedir una captura y evaluar.

### Si PASS, continuar de a una acción

2. Pantalla Pendientes:
   - secciones;
   - quick cards sin badges redundantes;
   - validar un partido si hay uno disponible;
   - `✓ PARTIDO VALIDADO` y contracción.

3. Resumen:
   - mi pareja arriba + verde desde ambos lados si puede;
   - título `POR VALIDAR / ESPERANDO VALIDACIÓN`;
   - inline de validación;
   - identidad con `IDENTIFICAR JUGADOR`.

4. Duplicado: **un único caso** de pre-check `ES OTRO PARTIDO` y, si realmente hace falta para verificar punta a punta, usar Leo/claim para confirmar que no reaparece.

No repetir claim completo salvo que sea necesario para el bug durable.

---

## 12. Residuales conocidos no bloqueantes

No confundir con regresiones:

1. El modal de duplicado generado **después de claim** (`ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO`) conserva el diseño V04.29. El mini-partido nuevo ya existe y podría reutilizarse más adelante si se decide pulirlo.
2. Pre-check usa fecha/hora que tiene el formulario al tocar `CARGAR RESULTADO`; si luego se cambia a otro día, no se reevalúa. El gate backend final cubre integridad.
3. `ES ESTE PARTIDO` en pre-check descarta el borrador y abre el existente sin confirmación adicional.
4. No hace falta iPhone/PWA en esta ronda salvo que aparezca una diferencia real de layout móvil.

---

## 13. Después de cerrar este QA

Cuando V04.34 tenga PASS humano:
- cerrar/actualizar Issue #29;
- actualizar README/resultado si corresponde;
- no avanzar a Production automáticamente;
- volver al mapa de Pre-Production / Issue #28.

Además, el usuario tiene un **chat separado de Brainstorming** donde fue madurando ideas nuevas en paralelo. El método de trabajo fue actualizado para ese flujo. Cuando este bloque Invitados/Pendientes quede realmente cerrado, el usuario va a traer un traspaso de Brainstorming a Central.

Al recibirlo:
1. contrastarlo con fuentes maestras vigentes;
2. separar decisión confirmada / propuesta / futuro;
3. priorizar qué mejora la experiencia central hoy;
4. no mezclar ideas nuevas con bugs ya cerrados;
5. proponer plan de implementación global sin obligar al usuario a operar técnicamente.

También existe Issue #30 sobre primer corte semanal de Ranking / Grupos / Actividad. No mezclarlo con este QA final salvo que el usuario decida cambiar de foco.

---

## 14. Nota de coordinación importante

El usuario pidió explícitamente que Central tenga **criterio propio** y no responda automáticamente que toda alternativa que él propone es mejor.

Forma correcta:
- recomendar una opción y explicar por qué;
- si se discrepa, decirlo claramente;
- si el usuario finalmente decide distinto, ejecutar su decisión sin fingir que siempre fue la recomendación de Central;
- distinguir preferencia de diseño de error funcional.

---

## 15. Límites

No tocar sin autorización explícita:
- `main`;
- Production;
- BRAMUlive.

No reabrir:
- fórmula de Nivel;
- Ranking histórico/publicado;
- Grupos;
- Legal;
- dedupe SAME ya validado;
- claim automático V04.33;
- ventana Recuperados 30 días;
- gate 3/4/5;
- regla 1 cuenta + 3 provisionales;

salvo regresión concreta.

**Estado de salida de este chat: V04.34 backend y deploy PASS; pendiente exclusivamente QA humano final corto.**
