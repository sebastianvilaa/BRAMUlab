# BRAMUlab V03.4.6 — Dos hallazgos de QA sobre V03.4.5

Reportado por voz en chat (dictado, con algún error de reconocimiento en la transcripción
automática — "raíz anual"/"de observado centavos" se interpretan acá como "Race anual"/
"Observados", únicos nombres reales de esas pestañas) tras revisar V03.4.6 en producción.
Transcripción limpia del pedido, mismo criterio que el resto de `Versiones/`.

## 1. Historial — tabs no alineadas a la izquierda en tablet

En MIS GRUPOS las pestañas "Actual / Anterior / Race anual" quedan alineadas a la izquierda en
tablet, y eso está bien.

En Historial, las tres pestañas "Todos / Mis partidos / Observados" también deberían quedar
alineadas a la izquierda (mismo criterio que Mis Grupos) — hoy no lo están.

## 2. Perfil — gráfico de Evolución del Nivel BRAMU sigue sin corregirse en tablet

El problema reportado en la ronda anterior (V03.4.5 §4) no quedó resuelto: al agrandarse la
pantalla en tablet, el gráfico de Evolución del Nivel BRAMU se agranda entero, pero el tamaño
tipográfico de las escalas (eje Y) y de las fechas (eje X) también crece, y los textos se
empiezan a pisar entre sí.

## 3. No tocar

Mismo alcance que rondas anteriores — sin cambios de lógica, datos ni fórmula. Solo layout/CSS
y la corrección del bug real detrás del punto 2.

## 4. QA

Verificar en tablet (iPad Mini / 768px):
- Historial con tabs alineadas a la izquierda, igual que Mis Grupos;
- gráfico de Evolución con una cuenta que tenga datos reales (no solo CALIBRANDO), confirmando
  que las etiquetas de eje X/Y no crecen ni se pisan.

Suite completa una sola vez al cierre.

Implementar directamente.
Informe, commit, tag, push y deploy.
