# 128 — Handoff · Ajustes visuales post QA humano V04.31

**Fecha:** 05/10/2026  
**Rama única:** `staging`  
**Base funcional:** V04.31 / 04.31-h1  
**Tracking:** Issue #29  
**Estado:** flujo de Recuperados validado manualmente; quedan ajustes visuales/semánticos acotados. No reabrir la lógica de V04.31.

## 1. PASS humano confirmado

No repetir salvo regresión:

- alta nueva desde invitación abre `PARTIDOS RECUPERADOS` correctamente;
- una identidad con 2 partidos recupera ambos (uno validado + uno pendiente);
- partido validado → permite confirmar participación sin revalidar resultado;
- partido pendiente donde la pareja del recuperado NO debe responder → confirmar participación funciona y el resultado sigue pendiente;
- partido pendiente donde la pareja del recuperado SÍ debe responder → aparecen `NO, NO LO JUGUÉ` + `VALIDAR PARTIDO` + `REPORTAR UN ERROR`;
- `VALIDAR PARTIDO` desde Recuperados confirma participación + resultado en un solo paso;
- al completar todas las participaciones aparece cierre global y luego vuelve al Home;
- calibración/historial reflejan únicamente partidos ya validados;
- copy `SÍ, SOY YO / NO, NO SOY YO` y `COPIAR INVITACIÓN` funcionan visualmente mejor;
- no se observó recuperación duplicada ni pérdida de partido.

Casos humanos usados:
- Mariano: 2 recuperados, uno validado y uno pendiente;
- Camilo: recuperado pendiente y accionable.

## 2. AJUSTE DE PRESENTACIÓN — “mi equipo” en verde

Hallazgo visual en Resumen del partido:

El backend conserva Team A / Team B de forma canónica y estable, lo cual está bien. Sin embargo, distintas cuentas pueden ver su propia pareja en azul si internamente quedó como Team B.

### Decisión

**NO TOCAR backend ni Team A/Team B canónicos.**

En superficies orientadas al jugador autenticado:
- su propia pareja debe renderizarse en **verde**;
- la pareja rival en **azul**;
- el orden visual puede invertirse respecto del Team A/B interno;
- score, winner_team, validaciones y revisiones deben seguir referenciando los IDs canónicos correctos.

Aplicar donde tenga sentido de lectura personal (como mínimo Resumen del partido). No alterar vistas que dependan de un orden global/canónico si existe una razón concreta.

Agregar test para evitar invertir datos/score al invertir solo la presentación.

## 3. PARTIDOS RECUPERADOS — estado contextual correcto

### 3.1 Pendiente pero NO accionable para el recuperado

Caso Mariano:
- Esteban / Mariano vs Matu / Lucas;
- cargó Esteban;
- la respuesta corresponde a Matu/Lucas.

Después de que Mariano confirma que sí jugó, la card hoy conserva badge `PENDIENTE DE VALIDACIÓN`.

### Esperado

Mostrar **`ESPERANDO VALIDACIÓN`** desde la perspectiva de Mariano cuando ya no tiene ninguna acción pendiente sobre ese resultado.

No cambiar el estado real del match; solo el copy contextual.

## 4. PARTIDOS RECUPERADOS — estados finales dentro de la card

Hoy `✓ Participación confirmada` queda suelto por debajo de la card.

### Esperado

Integrar el estado dentro de la card y con jerarquía discreta.

- si solo confirmó participación y el resultado sigue esperando a terceros:
  - `✓ Participación confirmada`;
- si desde Recuperados tocó `VALIDAR PARTIDO` y oficializó el resultado:
  - preferir `✓ Partido validado` (describe mejor lo que realmente ocurrió).

No crear estados backend nuevos para esto si puede derivarse de los datos actuales.

## 5. PARTIDOS RECUPERADOS — composición de acciones

Hallazgo visual:
- `NO, NO LO JUGUÉ` y `SÍ, LO JUGUÉ` no siempre quedan con la misma altura;
- las acciones se sienten “flotando” por fuera de la tarjeta;
- el badge extra puede mover fecha/score y generar saltos visuales;
- `REPORTAR UN ERROR` no usa la misma jerarquía que en Resumen.

### Ajuste

- igualar altura, padding y baseline de acciones hermanas;
- integrar visualmente acciones y estados a la card;
- mantener orden semántico ya aprobado: negativo izquierda / positivo derecha;
- mantener `NO, NO LO JUGUÉ` como outline rojo;
- `VALIDAR PARTIDO` verde;
- `REPORTAR UN ERROR` debe ser coherente con la acción homónima del Resumen (outline rojo o jerarquía equivalente), sin competir visualmente con el CTA principal;
- evitar que un badge de estado rompa el ritmo vertical entre fecha, resultado y parejas.

No rediseñar toda la pantalla; hacer una pasada de consistencia sobre lo existente.

## 6. Cierre global de Recuperados

Hoy aparece `LISTO` una vez respondidas todas las participaciones. Funcionalmente PASS, visualmente demasiado genérico/secundario.

### Propuesta

Dar al cierre una jerarquía clara de “terminar revisión”, manteniendo que aparece solo cuando todo está respondido.

Copy recomendado: `TERMINAR REVISIÓN` si encaja bien en la UI; si se conserva `LISTO`, darle formato inequívoco de cierre global.

No hacerlo competir con acciones individuales de las cards.

## 7. @usuario — pulido menor

El ✓/✕ nuevo funciona.

Pulido deseable:
- acercar el icono al contenido/campo para que no quede perdido en el extremo;
- evaluar envolverlo en un pequeño círculo si mejora legibilidad;
- conservar feedback verde/rojo y mensajes actuales;
- no cambiar reglas de validación.

Prioridad baja dentro de esta corrección.

## 8. Qué NO tocar

- lógica de claim / recovery de V04.31;
- backend de Recuperados;
- Nivel / Ranking;
- Grupos;
- Legal;
- deduplicación;
- gate 3/4/5;
- notificaciones, salvo regresión visible;
- main / Production / BRAMUlive.

## 9. QA mínimo posterior

Después de implementar:

1. Resumen visto desde ambas parejas: cada usuario ve **su equipo verde** y rival azul, sin cambiar score/winner.
2. Recuperado no accionable: tras `SÍ, LO JUGUÉ` → estado integrado + `ESPERANDO VALIDACIÓN`.
3. Recuperado accionable: `NO` / `VALIDAR` / `REPORTAR` alineados; validar → `✓ Partido validado`.
4. Recuperado ya validado: sí/no participación con botones de igual altura.
5. Cierre global claro y vuelta a Home.
6. Humo @usuario en ancho móvil.

No repetir alta completa de múltiples cuentas salvo que un cambio toque el flujo de claim.

## 10. Salida esperada

Implementar como corrección visual/semántica pequeña sobre `staging`, idealmente un único commit/push.

Actualizar Issue #29 y documentación solo en lo afectado. Informar:
- HEAD final;
- archivos tocados;
- tests;
- QA humano mínimo restante.

**Production sigue prohibida.**
