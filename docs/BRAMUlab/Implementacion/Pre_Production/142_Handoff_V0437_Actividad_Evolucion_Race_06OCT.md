# 142 — Handoff V04.37 · Actividad histórica + Evolución real de Nivel + movimiento Race

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base:** `7a9e24c6b101d3c40bae5d65d6e7b6d810b1b51d`  
**Versión objetivo:** BRAMUlab **V04.37 / bundle 04.37-h1**  
**NO TOCAR:** `main`, Production, BRAMUlive.

## 1. Contexto

V04.36 está CERRADA / PASS CENTRAL.

Durante el QA residual R1/R2:
- R2 Grupos quedó PASS y Issue #23 fue cerrado;
- Mi Perfil y Perfil público con evidencia real dieron PASS;
- aparecieron tres gaps reales de producto que Sebastián confirmó como una única ronda final antes de retomar el cierre de R1:
  1. detalle histórico de Actividad;
  2. Evolución del Nivel real en Mi Perfil;
  3. movimiento de puestos en Race anual.

Las decisiones ya fueron incorporadas a las fuentes maestras:
- `Experiencia_Inicial.md` §27;
- `Nivel_BRAMU.md` §16;
- `Grupos_BRAMU.md` §29;
- `BRAMU_Intelligence.md` §18.

## 2. Leer antes de tocar código

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. este handoff
4. las cuatro fuentes maestras indicadas arriba, solo las secciones vigentes afectadas.

No reabrir V04.36, Invitados/Identidad, fórmulas de Nivel, Ranking ni la lógica deportiva de Grupos.

## 3. A — Home > Actividad histórica

### AGREGAR

La tarjeta `ACTIVIDAD` del Home pasa a ser tocable.

Destino recomendado: pantalla completa simple `ACTIVIDAD`, con back, bottom-nav coherente y scroll vertical.

Cada semana con actividad oficial real:
- rango lunes–domingo humano, ej. `5 OCT — 11 OCT`;
- partidos jugados;
- ganados;
- perdidos;
- efectividad semanal.

Orden: más reciente → más antigua.

No usar número ISO de semana como lectura principal.

### FUSIONAR

- conservar intacto el gráfico de 4 barras del Home;
- usar la MISMA fuente, elegibilidad y frontera semanal que ya alimentan esas barras;
- preferir un helper puro compartido para evitar que resumen y detalle diverjan;
- no incluir pendientes/no oficiales;
- no listar semanas vacías solo para rellenar.

No convertirlo en Historial filtrado ni en planilla compleja.

## 4. B — Evolución real del Nivel BRAMU

### Problema actual

La vieja tarjeta de Evolución existe, pero para cuentas V1 server-backed se oculta deliberadamente porque solo sabía graficar `PH.computeLevelEvolution` (simulación legacy).

Eso fue correcto. NO deshacer ese gate.

### AGREGAR

Crear una lectura oficial self-only de evolución.

Preferencia:
- RPC authenticated `get_my_level_evolution()` o nombre equivalente;
- contrato mínimo y público para UI;
- no acceso directo del browser a tablas internas del motor;
- no exponer fórmulas/factores/confianza cruda.

La serie debe representar la verdad ACTUAL:
- punto inicial oficial;
- resultados de Nivel actualmente aplicados;
- correcciones/anulaciones reflejadas sin puntos duplicados de resultados revertidos;
- orden deportivo consistente;
- valor público/redondeado coherente con Nivel;
- identificar fecha y match si sirve a UI, sin exponer internals.

Inspeccionar `match_level_results.effect_status`, `match_level_result_players`, `level_events` y los helpers vigentes antes de elegir la consulta. No asumir que todos los `level_events` son directamente graficables: son auditoría inmutable y contienen reversals.

### UX

Reutilizar el componente visual de `EVOLUCIÓN DEL NIVEL BRAMU` existente en vez de rediseñarlo desde cero, salvo adaptación estrictamente necesaria.

Mostrar:
- recorrido;
- Nivel actual;
- cambio últimos 30 días si material;
- mejor Nivel real si la serie canónica lo soporta.

Con evidencia insuficiente, ocultar módulo completo. No placeholders vacíos.

### BRAMU Intelligence longitudinal

Dentro de la misma tarjeta, debajo del gráfico:
- si el valor público cambió en 30 días: `En los últimos 30 días tu Nivel pasó de X a Y (↑/↓ Z).`
- si hubo >=3 eventos computables y TODOS los valores públicos fueron iguales: `Tu Nivel se mantuvo en X durante tus últimos N partidos computables.`
- si no: no mostrar insight.

Determinístico. Sin LLM nuevo. Sin causas inventadas.

### Seguridad/IP

Hardening 139 no puede retroceder:
- no volver a enviar motor/fórmulas al browser;
- no exponer `level.js`;
- RPC devuelve solo datos necesarios para presentación.

## 5. C — Race anual: movimiento

La fila de Race anual muestra movimiento respecto del cierre de la semana anterior:

- `↑ N` verde/lima;
- `↓ N` rojo;
- sin indicador si delta=0;
- sin indicador sin posición previa comparable.

Reusar el lenguaje/estilos de movement de Ranking donde sea razonable, sin acoplar la lógica deportiva de ambos sistemas.

### Cálculo

- Race actual = acumulado anual vigente hasta semana actual;
- Race previa = acumulado anual hasta cierre de semana BRAMU anterior;
- comparar posiciones usando ranking de competición 1,1,3;
- usar frontera semanal canónica BA de Grupos;
- respetar altas/reingresos;
- no cambiar puntos, top 2, bonus, Race ni Intelligence.

Puede implementarse con helper puro en `groups.js` usando los datos ya disponibles; no agregar backend si no es necesario.

## 6. NO TOCAR

- fórmula/motor de Nivel;
- onboarding/calibración;
- Ranking BRAMU;
- puntuación de Grupos;
- top 2;
- Americano;
- Invitados/Identidad/Recuperados/Pendientes;
- Anular carga;
- Auth;
- identidad visual;
- main / Production / BRAMUlive.

## 7. Pruebas por riesgo

### Actividad
- resumen 4 semanas no cambia;
- detalle usa misma muestra;
- semana con 1 partido calcula correctamente 0/100% según resultado;
- varias semanas ordenadas desc;
- pending no entra;
- semana sin partidos no genera fila falsa;
- navegación/scroll mobile.

### Evolución
- cuenta calibrada con resultados reales muestra serie;
- cuenta 0 partidos / sin evidencia suficiente no muestra Evolución;
- resultado revertido no queda como punto vigente duplicado;
- corrección deja una trayectoria coherente con el estado actual;
- anulación no deja impacto visible;
- último punto coincide con Nivel público actual;
- mejor Nivel y delta 30 días salen de la misma serie;
- Intelligence: subida, bajada, estabilidad estricta, abstención;
- ACL: anon no; authenticated solo propia evolución;
- no se exponen internals del motor.

### Race
- primera semana: sin flecha;
- sube 2 → ↑2;
- baja 1 → ↓1;
- mismo puesto: nada;
- empates 1,1,3;
- alta/reingreso sin comparación válida: nada;
- puntos/Race existentes byte-for-byte o semánticamente iguales fuera del indicador.

Ejecutar focales + suite Node completa + `release-check`. Si hay migración, verify SQL focal y advisors.

## 8. QA humano posterior

Mantenerlo mínimo:
1. tocar Actividad en Home y revisar 2–3 semanas;
2. Mi Perfil: Evolución real visible y coherente con Nivel actual;
3. Race: si Staging aún tiene una sola semana, verificar ausencia correcta de flecha; el resto queda cubierto por tests.

No crear fixtures manuales solo para fabricar movimiento de Race si los tests determinísticos ya lo prueban.

## 9. R1 residual

Después de V04.37 todavía queda cerrar el punto original de cuenta 0 / primer partido.

No crear otra cuenta si no hace falta. Staging ya contiene cuentas registradas con 0 partidos (por ejemplo `sebastian_vila` y otras); buscar la forma menos costosa de validar Estado Cero, priorizando pruebas existentes/automatizadas y una única intervención humana solo si aporta evidencia que no pueda obtenerse de otro modo.

## 10. Entrega

- V04.37 / 04.37-h1;
- un único push funcional razonable a `origin/staging`;
- documentación de resultado `143_Resultado_V0437_...`;
- reportar migración aplicada o pendiente;
- no pedir a Sebastián pruebas técnicas;
- si surge una decisión real, marcar `DECISIÓN ABIERTA` y continuar el resto.
