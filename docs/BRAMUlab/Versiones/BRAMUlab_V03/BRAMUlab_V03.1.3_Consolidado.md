# BRAMUlab V03.1.3 — Microparche final de MI PERFIL

## Objetivo

Hacer un ajuste visual corto sobre MI PERFIL para terminar de cerrarlo, sin abrir frentes nuevos ni tocar lógica sensible.

---

## ALCANCE

### 1. REEMPLAZAR — "Mejor ranking BRAMU" por el concepto correcto

No estamos hablando de ranking comunitario real. Lo que queremos mostrar es el mejor valor histórico del propio nivel del jugador.

Por lo tanto:
- AGREGAR un KPI que represente el pico histórico del jugador.
- Nombrarlo de forma clara. Recomendación:
  - "Mejor nivel BRAMU"
  o
  - "Pico de nivel BRAMU"

No usar "ranking" si puede generar confusión con ranking global/comunitario.

Mostrar:
- valor del mejor nivel histórico;
- referencia temporal breve;
- si coincide con el valor actual, mostrar `ACT`;
- si no coincide, mostrar mes y año abreviado, por ejemplo:
  - `SEP 26`
  - `OCT 26`

### 2. REEMPLAZAR — composición de la tarjeta de Efectividad

Mantener una sola tarjeta integrada con:
- Efectividad
- Partidos jugados
- Partidos ganados

Pero ajustar composición visual para que respire mejor.

Cambios pedidos:
- AGREGAR más altura a la tarjeta de Efectividad;
- AGRANDAR el donut/círculo todo lo que razonablemente permita el layout;
- MOVER el label `EFECTIVIDAD` arriba dentro de la tarjeta;
- mantener a la derecha:
  - Partidos jugados
  - Partidos ganados
- aprovechar el espacio extra para que los números de jugados/ganados se lean mejor;
- evaluar si el nuevo KPI de "Mejor nivel BRAMU" entra dentro de esta misma lógica/composición o inmediatamente asociado al bloque de rendimiento, sin ensuciar la lectura.

### 3. AGREGAR — animación sutil en Evolución del nivel BRAMU

La gráfica de evolución debería sentirse más viva.

AGREGAR una animación suave al entrar a la pantalla:
- la línea debe dibujarse/progresar visualmente;
- sin exageración;
- breve y limpia;
- consistente con la animación de Efectividad;
- sin convertirlo en algo recargado.

No agregar puntos, tooltips ni interacción nueva. Solo una animación visual sutil de entrada.

---

## 4. MANTENER

Mantener sin cambios:
- cabecera principal de MI PERFIL;
- racha actual;
- mejor racha;
- lógica de efectividad;
- lógica de nivel;
- eje Y y eje X de Evolución tal como quedaron en V03.1.2, salvo la nueva animación;
- MIS DATOS;
- Acceso y seguridad;
- Cerrar sesión;
- Home;
- Historial;
- Ranking;
- Notificaciones;
- Login;
- backend.

---

## 5. CRITERIO DE PRODUCTO

Este KPI nuevo no representa ranking real contra otros usuarios. Representa el mejor nivel histórico del jugador dentro de su propio historial.

---

## 6. TESTS Y QA

- tests focalizados solo si se toca lógica real;
- no crear tests innecesarios de CSS/markup;
- correr la suite completa UNA sola vez al cierre;
- si queda verde, no repetir;
- QA manual mobile sobre MI PERFIL;
- desktop: chequeo visual rápido del layout.

---

## 7. FORMA DE TRABAJO

- no presentar plan para aprobación;
- implementar directamente;
- corregir dentro del alcance;
- generar informe;
- commit;
- tag;
- push;
- deploy.

Solo frenar si aparece:
- riesgo real de pérdida de datos;
- contradicción fuerte de producto;
- necesidad real de salir del alcance.
