# BRAMUlab V03.1.2 — Microparche de composición en Perfil

## Objetivo

Hacer un ajuste visual corto sobre Perfil, sin abrir funciones nuevas y sin tocar lógica de producto.

---

## ALCANCE

### 1. FUSIONAR — tarjeta de efectividad

Reemplazar la composición actual de:
- Efectividad
- Partidos jugados
- Partidos ganados

por UNA sola tarjeta integrada.

Composición deseada:
- izquierda: donut + porcentaje + label EFECTIVIDAD
- derecha:
  - Partidos jugados
  - Partidos ganados

Todo dentro de la misma tarjeta.

Ajustes:
- mantener Efectividad como dato protagonista;
- agrandar visualmente los números de Partidos jugados y Partidos ganados;
- aprovechar mejor el espacio;
- conservar Racha actual y Mejor racha como dos tarjetas separadas e independientes;
- no cambiar ninguna fórmula ni lógica de datos.

### 2. REEMPLAZAR — spacing en MI PERFIL

Reducir la separación vertical entre:
- tarjeta principal del perfil

y

- bloque/tarjeta de efectividad

Objetivo: que siga el mismo ritmo visual del resto de la pantalla y no quede un hueco excesivo.

### 3. REEMPLAZAR — spacing en MIS DATOS

Reducir y normalizar la separación vertical entre:
- tarjeta de identidad
- datos personales / deportivos
- acceso y seguridad
- cerrar sesión

Objetivo: unificar ritmo visual y evitar que los bloques queden demasiado aislados entre sí.

---

## NO TOCAR

No tocar:
- cabecera principal de MI PERFIL;
- racha actual;
- mejor racha;
- gráfico de evolución;
- acceso y seguridad;
- notificaciones;
- home;
- historial;
- ranking;
- login;
- crear cuenta;
- recuperación de contraseña;
- lógica;
- backend.

---

## TESTS Y QA

- tests focalizados solo si se toca algo con impacto real en lógica;
- evitar tests innecesarios de CSS/markup;
- correr la suite completa UNA sola vez al cierre;
- si queda verde, no repetir;
- QA manual principalmente en mobile;
- desktop: chequeo rápido del layout de Perfil.

---

## FORMA DE TRABAJO

- no presentar plan para aprobación;
- implementar directamente;
- corregir dentro del alcance;
- generar informe;
- commit;
- tag;
- push;
- deploy.

Solo frenar si aparece:
- riesgo de pérdida de datos;
- contradicción de producto;
- necesidad real de salir del alcance.
