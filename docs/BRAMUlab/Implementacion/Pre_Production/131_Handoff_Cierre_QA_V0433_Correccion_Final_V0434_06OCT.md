# 131 — Handoff · Cierre QA humano V04.33 y corrección final UX/duplicados (V04.34 propuesta)

**Fecha:** 06/10/2026  
**Rama única:** `staging`  
**Base funcional:** BRAMUlab **V04.33 / 04.33-h1**  
**HEAD documental de partida:** `480e21aa937ac4358cc7356492f6180c83d8af83`  
**Tracking:** Issue #29  
**Estado:** V04.33 tiene gate técnico Central PASS y backend aplicado en Staging. El QA humano real validó la arquitectura nueva y detectó un conjunto final de ajustes visuales/estructurales + un bug importante de deduplicación. No repetir la maratón de QA previa.

---

## 1. Evidencia humana V04.33 — PASS que NO hay que reabrir

Se comprobó en Staging real:

- Home ya oculta del carrusel superior los partidos puramente `ESPERANDO VALIDACIÓN`;
- card ancha `PARTIDOS PENDIENTES` muestra correctamente los 3 contadores;
- `POR VALIDAR / POR RESOLVER / ESPERANDO VALIDACIÓN` se derivan coherentemente;
- validación rápida real:
  - `VALIDAR PARTIDO` oficializa el partido correcto;
  - aparece `✓ PARTIDO VALIDADO`;
  - la card desaparece;
  - el contador baja (ej. Pendientes 8 → 7);
  - historial/estadísticas reflejan el resultado;
- claim real de Gastón:
  - modal `¿SOS GASTÓN?` mostró el partido origen correcto;
  - `SÍ, SOY YO` recuperó automáticamente **2 partidos**;
  - pantalla full-screen `RECUPERAMOS 2 PARTIDOS`;
  - detectó correctamente **1** accionable y 1 ya validado;
  - `VER LOS 2 RECUPERADOS` abrió `Historial > Recuperados`;
  - el partido ya validado entró al historial sin confirmación individual;
  - tras refrescar la cuenta del invitador, Gastón dejó de figurar como `Sin cuenta` y desapareció `INVITAR A GASTÓN`.
- `Historial > Recuperados` como filtro temporal tiene sentido conceptual y debe **conservarse**.

No crear cuentas nuevas para repetir esto salvo regresión concreta.

---

# 2. DECISIÓN CONFIRMADA — Partidos pendientes sale de Historial

La prueba visual confirmó que `PENDIENTES` no debe ser una pestaña de Historial.

**Historial = consulta del historial.**  
**Partidos pendientes = superficie de tareas/acción.**

## REEMPLAZAR

Quitar `Pendientes` de las tabs de Historial.

Historial conserva:
- `Todos`;
- `Recuperados` cuando exista la ventana temporal de 30 días;
- `Victorias`;
- `Derrotas`;
- `Ocultos`;
- otros filtros ya vigentes que no contradigan este criterio.

## AGREGAR / CONSOLIDAR

Crear una pantalla propia:

**PARTIDOS PENDIENTES**

Entradas:
- card `PARTIDOS PENDIENTES` del Home;
- gate de máximo 5 pendientes;
- cualquier CTA general `VER PARTIDOS PENDIENTES`.

La pantalla usa el mismo componente y clasificación ya implementados, sin duplicar lógica.

Orden:
1. `POR VALIDAR`
2. `POR RESOLVER`
3. `ESPERANDO VALIDACIÓN`

Al volver, regresar al origen normal de navegación. No convertir Historial en esta pantalla.

---

# 3. Pantalla Partidos pendientes — pulido de cards

## 3.1 Quitar estados redundantes dentro de la card

Dentro de la pantalla propia, la sección ya dice `POR VALIDAR` o `ESPERANDO VALIDACIÓN`.

Por eso:
- quitar badge interno `POR VALIDAR` de las cards de esa sección;
- quitar badge interno `ESPERANDO VALIDACIÓN` de las cards de esa sección.

En `POR RESOLVER`, sí conservar el descriptor específico cuando aporta información:
- `JUGADOR POR IDENTIFICAR`;
- otro descriptor real si la incidencia es de otro tipo.

## 3.2 Acciones consistentes

Las cards de validación rápida deben usar exactamente el mismo lenguaje visual que el Resumen:

- `Reportar un error` — rojo outline;
- `Validar partido` — verde outline / tratamiento equivalente al Resumen;
- **no** mayúsculas integrales para estos CTAs;
- misma altura, radio, tipografía y jerarquía.

El verde sólido/neón se reserva para el feedback transitorio de éxito:

**`✓ PARTIDO VALIDADO`**

Ese feedback de ~0,9 s probado en V04.33 queda aprobado.

## 3.3 POR RESOLVER

En la lista general, reemplazar CTA genérico `RESOLVER` por:

**`Revisar partido`**

Color: azul / outline, coherente con acción de navegación/revisión, no verde de validación.

Motivo: `POR RESOLVER` puede agrupar más de una clase de incidencia; la lista no debe prometer una acción específica equivocada.

---

# 4. Resumen del partido — consistencia de estado y acciones

## 4.1 Mi equipo siempre verde Y arriba

V04.32 corrigió color pero no orden.

Regla confirmada de presentación personal:

- **mi pareja siempre arriba y verde**;
- rival abajo y azul;
- esto es SOLO presentación;
- no tocar Team A / Team B canónicos;
- no invertir score/winner/acciones por error.

El encabezado `GANADORES` sigue mostrando la pareja ganadora real, aunque sea el rival.

Agregar test desde ambos lados del mismo partido.

## 4.2 Estado principal arriba de GANADORES

Para un pending:

- si el usuario debe actuar: **PARTIDO POR VALIDAR**;
- si depende de la otra pareja: **ESPERANDO VALIDACIÓN**.

Ambos deben ocupar la misma posición jerárquica arriba de `GANADORES`.

La línea meta superior no necesita repetir el mismo estado; puede quedar `Cargado por X` + fecha/formato.

## 4.3 Validación inline también en Resumen

Hoy el Resumen usa un feedback/modal distinto.

REEMPLAZAR el éxito de validación del Resumen por el patrón aprobado de validación rápida:

1. toca `Validar partido`;
2. botones se reemplazan por franja verde `✓ PARTIDO VALIDADO`;
3. ~0,8–1 s;
4. desaparece el bloque de acciones;
5. el Resumen queda actualizado como partido validado.

Sin modal de éxito redundante.

No fingir éxito ante `confirmed_not_ready` / error real.

## 4.4 Identidad

Para una incidencia de identidad, el bloque del Resumen debe ser más humano y consistente:

- descriptor: **JUGADOR POR IDENTIFICAR**;
- texto breve: `Revisá este partido para confirmar quién jugó.`;
- CTA específico dentro del Resumen: **IDENTIFICAR JUGADOR**;
- CTA azul, no verde.

Evitar el actual bloque que mezcla `Por identificar` + `Jugador por identificar` + `RESOLVER`.

No usar rojo de error grave para toda la superficie si no corresponde; preferir semántica de atención/pendiente + acción azul.

Para otras incidencias `POR RESOLVER`, conservar la acción específica vigente del flujo correspondiente.

---

# 5. Home — carrusel superior

Mantener arriba únicamente items accionables, como ya hace V04.33.

Pulido:

- todas las tarjetas del carrusel deben tener altura consistente;
- título máximo 1 línea;
- cuerpo máximo **2 líneas**;
- truncar con ellipsis;
- un copy largo (`JUGADOR POR IDENTIFICAR`) no debe hacer crecer la tarjeta.

El detalle completo se ve al tocar.

---

# 6. Home — card PARTIDOS PENDIENTES

La estructura de 3 columnas quedó aprobada.

Mantener:
- `POR VALIDAR`;
- `ESPERANDO`;
- `POR RESOLVER`.

Pulido visual confirmado:

- unificar los **tres números** en amarillo/ámbar;
- icono de atención en amarillo/ámbar;
- título `PARTIDOS PENDIENTES` puede usar el mismo acento;
- labels de columnas en blanco/gris claro, no verde/blanco/amarillo mezclados;
- borde sutil amarillo/ámbar si mejora la composición;
- evitar semántica de “semáforo” en esta card: los tres son subtipos de un mismo universo pendiente.

Tocar abre la pantalla propia `PARTIDOS PENDIENTES`, no Historial.

---

# 7. Modal `¿SOS X?` — mantener concepto, mejorar representación del partido

El modal real funcionó y mostró el **partido origen** correcto. Las fotos pequeñas están bien de tamaño.

El problema visual: hoy se lee como 4 mini-perfiles; debe leerse como **un partido**.

## Layout recomendado

Mantener:
- `¿SOS GASTÓN?`;
- copy: `Hay partidos registrados con esta identidad. Si sos vos, podés vincularlos a tu cuenta.`;
- `Te invitaron desde este partido · FECHA · HORA`;
- `+ N partidos más asociados a Gastón`;
- `SÍ, SOY YO / NO, NO SOY YO`.

Rearmar el partido como mini-resumen robusto para móvil:

- dos filas de pareja;
- pareja de la identidad invitada primero, verde;
- rival segundo, azul;
- dentro de cada pareja, los 2 jugadores apilados/claros;
- foto pequeña + nombre; `@usuario` secundario cuando exista;
- score por set alineado a la derecha, como Resumen;
- soportar 3 sets y nombres largos sin romper layout;
- divisor entre parejas;
- no agrandar avatares.

Evitar un `VS` grande o cuatro cajas que hagan difícil leer el score.

Este mismo lenguaje visual puede reutilizarse después en duplicados.

---

# 8. Recuperados — conservar arquitectura, pulir

## 8.1 Pantalla full-screen post-claim

V04.33 PASS funcional.

Mantener:
- `RECUPERAMOS N PARTIDOS`;
- cantidad que necesita respuesta;
- `VER LOS N RECUPERADOS`;
- `OMITIR` mientras haya accionables;
- `ENTRAR A BRAMU` cuando no queden.

Aplicar a la quick card los estilos del §3:
- `Reportar un error`;
- `Validar partido`;
- sin uppercase integral;
- mismo estilo que Resumen;
- feedback inline aprobado.

En esta pantalla, como ya dice `N PARTIDOS NECESITAN TU RESPUESTA`, el badge `POR VALIDAR` dentro de la card es redundante y puede retirarse.

## 8.2 Historial > Recuperados

**CONSERVAR dentro de Historial.**

Esto sí es un filtro legítimo de origen, no una bandeja de tareas.

Acortar el texto introductorio actual. Recomendado:

> `Estos partidos llegaron a tu cuenta al vincular a Gastón. Esta pestaña estará disponible durante 30 días.`

No hace falta explicar ahí todo el sistema de Reportar un error.

Como esta lista mezcla estados, una indicación compacta de `POR VALIDAR` puede conservarse en la card accionable si ayuda a distinguirla de los ya validados. No duplicar información innecesaria.

---

# 9. BRAMU Intelligence en partido pendiente

Hallazgo reiterado del QA humano.

El disclaimer:

`Este partido todavía está pendiente: estos insights se basan en lo cargado y pueden cambiar cuando se valide.`

debe tener **la misma jerarquía visual sutil** que:

`Una lectura objetiva de lo que pasó en la cancha, no una planilla de estadísticas.`

Esperado:
- tamaño/peso/color/itálica equivalentes o muy próximos;
- más aire después de `+ POR QUÉ APARECEN ESTOS INSIGHTS`;
- no competir con los insights reales.

No cambiar lógica de Intelligence.

---

# 10. Duplicados — BUG funcional descubierto en QA

## Caso real

1. Se creó y validó:
   - Esteban / Gastón vs Seba / Leo
   - 6–2 · 6–2.
2. Minutos después Seba cargó intencionalmente otro partido con exactamente los mismos cuatro jugadores y parejas:
   - Seba / Leo vs Esteban / Gastón
   - 6–4 · 6–3.
3. BRAMU mostró `POSIBLE PARTIDO DUPLICADO`.
4. El usuario eligió explícitamente **ES OTRO PARTIDO**.
5. El segundo partido se creó correctamente como encuentro distinto.
6. Gastón creó cuenta y reclamó su identidad.
7. Recovery volvió a generar/proponer esos mismos dos partidos como posible duplicado:
   `ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO`.

Esto es incorrecto.

## Regla confirmada

Cuando BRAMU pregunta explícitamente si dos encuentros son el mismo y el usuario responde **SON DOS PARTIDOS DISTINTOS / ES OTRO PARTIDO**, esa decisión debe ser **durable** para ese par de partidos.

No volver a proponer ese mismo par durante:
- recovery;
- sync de candidatos;
- futuras sesiones;
- otra superficie de deduplicación.

No basta con que `disambiguationForceNew` permita crear el partido una sola vez.

### Implementación

Antes de crear tablas nuevas, inspeccionar:
- modelo de `duplicate_match_candidates`;
- resoluciones `same/different`;
- `disambiguationForceNew`;
- generación posterior de candidatos en identity recovery.

Preferir fusionar la decisión temprana `different` con el mecanismo persistente existente.

Si en el momento de elegir `ES OTRO PARTIDO` todavía no existe el segundo `match_id`, persistir la relación negativa de forma segura inmediatamente después de crear el nuevo match.

Debe ser simétrica por par de match IDs y no depender del orden.

Agregar test de regresión exacto:
- candidato → `otro partido` → nuevo match;
- claim posterior;
- ese par **no reaparece** como duplicate candidate.

Este cambio toca integridad/deduplicación: probar en Staging antes de dar PASS.

---

# 11. Duplicados — detección temprana antes de cargar score

Además del fix anterior, mejorar la UX.

Hoy el usuario completa jugadores + resultado y recién al guardar descubre que posiblemente ya existía.

## Propuesta confirmada

Cuando ya están elegidos los **4 jugadores y las parejas**, antes de hacer trabajar al usuario con el resultado, comprobar si existe un candidato razonable (mismos jugadores/parejas, ventana temporal vigente).

Idealmente al avanzar desde selección de jugadores hacia score:

- si no hay candidato → seguir normalmente;
- si hay candidato → mostrar `POSIBLE PARTIDO DUPLICADO` con el partido existente.

### Si elige `ES ESTE PARTIDO`

- si el usuario pertenece a la pareja que debe validar el existente → abrir su Resumen y permitir validar;
- si pertenece al lado que ya cargó/hizo su parte → abrir Resumen mostrando `ESPERANDO VALIDACIÓN`;
- si el existente ya está validado y todavía no se ingresó un nuevo score → simplemente abrir ese partido; no inventar una corrección.

### Si elige `ES OTRO PARTIDO`

- continuar a cargar score;
- al crearse el nuevo encuentro, persistir la decisión `different` (§10).

### Protección final

**NO eliminar la detección backend al guardar.**

Puede haber carrera:
- dos personas comienzan la carga al mismo tiempo;
- el partido aparece después del pre-check.

El pre-check es UX anticipada; el gate final sigue siendo protección de datos.

Reutilizar cache/RPC existente si alcanza. No abrir backend innecesario sólo por esta anticipación.

---

# 12. Modal de posible duplicado — jerarquía visual

No cerrar un rediseño totalmente independiente. Reutilizar el lenguaje visual aprobado del mini-partido de `¿SOS X?`.

Problemas actuales:
- demasiado texto;
- partido existente embebido como botón raro;
- todas las opciones compiten con igual jerarquía.

## Dirección

Título:
**POSIBLE PARTIDO DUPLICADO**

Copy corto, por ejemplo:
`Ya hay un partido cargado con estos jugadores y parejas. ¿Es este mismo partido?`

Mostrar el partido existente como **mini-resumen visual**:
- parejas;
- score;
- fecha/hora;
- formato;
- mismo componente/criterio visual que el claim cuando sea razonable.

Decisiones principales:
- `ES ESTE PARTIDO`
- `ES OTRO PARTIDO`

`CANCELAR` queda terciario/discreto.

Si el usuario elige `ES ESTE PARTIDO` después de haber ingresado un resultado diferente, **no sobrescribir silenciosamente**: conservar el flujo vigente de revisión/propuesta de corrección.

---

# 13. NO tocar

- `main`;
- Production;
- BRAMUlive;
- Nivel / fórmula;
- Ranking publicado/histórico;
- Grupos;
- Legal;
- Team A/B backend;
- deduplicación SAME ya validada salvo lo necesario para persistir `different`;
- lógica central de claim automático V04.33;
- ventana Recuperados 30 días;
- gate 3/4/5;
- 1 cuenta + 3 provisionales.

---

# 14. QA técnico requerido

No repetir todo Invitados.

## UI
- Pendientes ya no aparece como tab de Historial.
- Home → Partidos pendientes abre pantalla propia.
- 3 secciones correctas.
- quick card sin badge redundante en secciones.
- botones iguales a Resumen.
- `Revisar partido` azul.
- identidad en Resumen → `IDENTIFICAR JUGADOR`.
- carrusel fijo + ellipsis.
- card Home ámbar coherente.
- mi equipo arriba+verde desde ambos usuarios.
- waiting title en Resumen.
- éxito inline en Resumen.
- claim modal robusto con 2/3 sets y nombres largos.
- Recuperados sigue en Historial y CTA funciona.
- disclaimer Intelligence sutil.

## Duplicados — obligatorio
- pre-check temprano detecta candidato sin score;
- `ES ESTE PARTIDO` navega al existente;
- `ES OTRO PARTIDO` permite continuar;
- backend final sigue detectando carrera/duplicado;
- decisión `different` queda persistida;
- tras claim/recovery el mismo par NO reaparece;
- SAME con scores distintos sigue funcionando y no se regresa V04.29.

---

# 15. QA humano mínimo posterior

Usar fixtures actuales; **no crear otra batería de cuentas**.

Quedó a propósito un partido pendiente con **Leo** que puede servir para una comprobación futura del claim si hiciera falta.

Después de implementar:
1. Home Esteban/Seba: carrusel + card pendientes.
2. Abrir pantalla propia Pendientes y validar 1.
3. Resumen: mi equipo arriba/verde + waiting/por validar + feedback inline.
4. Claim/Recuperados solo si el cambio tocó esa superficie de manera material; puede aprovecharse Leo.
5. Duplicado: un único caso `otro partido` y comprobar que no reaparece.

Nada más salvo fallo.

---

# 16. Versionado / salida

Versión sugerida:
- **V04.34**
- bundle **04.34-h1**

Claude debe:
- analizar impacto;
- implementar toda la ronda de forma autónoma;
- crear migración mínima si el fix durable de `different` la requiere;
- actualizar fuente maestra `Experiencia_Inicial.md` y README;
- actualizar Issue #29;
- guardar informe resultado;
- tests pertinentes;
- un commit/push lógico a `origin/staging`;
- verificar Vercel.

Si existe una decisión humana verdaderamente material no cubierta acá, marcar `DECISIÓN ABIERTA` y seguir con todo lo demás.

**Production sigue prohibida.**
