# BRAMUlab V03.1.1 — Pulido de MI PERFIL + simplificación de MIS DATOS

## Objetivo
Parche corto sobre V03.1 para pulir visualmente Perfil sin abrir nuevas funciones.

Tres objetivos:
1. Ajustar MI PERFIL: alineación de Edad / Mano dominante / Lado habitual y rediseño de KPIs como tarjetas independientes.
2. Ajustar Evolución: mantener lógica actual y reemplazar `SEM X` por fechas reales o meses.
3. Simplificar MIS DATOS: eliminar títulos redundantes e integrar edición dentro de la tarjeta de identidad.

## 1. MI PERFIL — CABECERA
MANTENER foto, Nombre visible, `@usuario`, Nivel BRAMU, Edad, Mano dominante y Lado habitual.

AJUSTAR las tres columnas inferiores para que tengan el mismo ancho visual, buena alineación y spacing equilibrado. Conservar labels chicos/lavados y valores grandes/blancos. No achicar la foto ni rediseñar la cabecera.

## 2. ELIMINAR — TÍTULO “RENDIMIENTO”
Eliminar el título `RENDIMIENTO`. Los KPIs deben leerse por sí mismos.

## 3. RENDIMIENTO — REEMPLAZAR POR 5 TARJETAS
Crear 5 tarjetas claramente separadas:
1. Efectividad
2. Partidos jugados
3. Partidos ganados
4. Racha actual
5. Mejor racha

No cambiar fórmulas.

## 4. EFECTIVIDAD — TARJETA PRINCIPAL
Debe seguir siendo el KPI protagonista:
- tarjeta propia;
- más grande que las demás;
- reutilizar donut/aro actual;
- porcentaje grande;
- label `EFECTIVIDAD`.

Puede compartir fila con las dos tarjetas de Partidos.

## 5. PARTIDOS JUGADOS / GANADOS
Dos tarjetas propias:
- Partidos jugados: `18`
- Partidos ganados: `14`

Composición recomendada:
- Efectividad ocupa mayor superficie.
- Al lado, Partidos jugados y ganados en dos tarjetas apiladas.
- Ambas juntas equilibran la altura de Efectividad.

## 6. RACHA ACTUAL / MEJOR RACHA
Segunda fila con dos tarjetas independientes.

Racha actual:
- si hay racha positiva: `6 victorias seguidas`
- si no hay: `—`
- no mostrar derrotas.

Mejor racha:
- `6 victorias`
- mantener contexto temporal breve:
  - mismo mes: `SEP 26`
  - cruza meses: `SEP–OCT 26`

## 7. EVOLUCIÓN — MANTENER
Mantener:
- Nivel actual;
- Cambio últimos 30 días;
- línea limpia;
- sin puntos;
- sin tooltips;
- eje Y adaptativo;
- pasos Y de 0.25.

## 8. EJE X — REEMPLAZAR “SEM X”
Eliminar labels `SEM 1`, `SEM 2`, etc.

Nueva regla:
- rango corto: fechas reales (`27 AGO`, `03 SEP`, `10 SEP`, `17 SEP`);
- rango largo: meses (`JUN`, `JUL`, `AGO`, `SEP`).

La cantidad de labels sigue siendo adaptativa:
- aprox. 4–7 referencias;
- sin superposición;
- sin repetir innecesariamente el mismo mes;
- no un label por partido.

Claude puede ajustar el umbral exacto entre fecha y mes según el rango real, pero nunca volver a `SEM X`.

## 9. MIS DATOS — ELIMINAR TÍTULOS REDUNDANTES
Eliminar:
- `TUS DATOS`
- `IDENTIDAD`

La pestaña ya se llama `MIS DATOS`. No agregar reemplazo.

## 10. MIS DATOS — TARJETA DE IDENTIDAD
Mantener una sola tarjeta con:
- foto;
- Nombre + Apellido;
- `@usuario`;
- Nombre visible.

MOVER el botón de edición/lápiz dentro de esta misma tarjeta, idealmente en esquina superior derecha. No dejarlo flotando afuera. La foto sigue editable.

## 11. MIS DATOS — DATOS PERSONALES / DEPORTIVOS
Mantener una única tarjeta con:
- Fecha de nacimiento
- Edad
- Género
- Mano dominante
- Lado habitual
- Categoría declarada
- Fecha de declaración cuando exista

Puede conservar el título interno `DATOS PERSONALES / DEPORTIVOS` si ayuda, pero evitar jerarquías externas redundantes. Priorizar compactación y columnas equilibradas.

## 12. ACCESO Y SEGURIDAD
Mantener V03.1 sin cambios:
- email;
- Cambiar contraseña;
- touch target;
- recuperación;
- separación de Cerrar sesión;
- modal de confirmación.

## 13. NO TOCAR
No modificar:
- Home;
- Historial;
- Ranking;
- Notificaciones;
- Login;
- Crear cuenta;
- Olvidé mi contraseña;
- Splash;
- Registrar partido;
- tabs Punto a punto / Por games;
- scoring;
- Player Intelligence;
- backend;
- social;
- fórmula Nivel BRAMU;
- lógica de rachas/efectividad;
- eje Y de Evolución.

## 14. TESTS Y QA
Tests focalizados solo si se toca lógica.
Como la ronda es mayormente visual:
- evitar tests innecesarios de CSS/markup;
- suite completa UNA sola vez al cierre;
- si queda verde, no repetir.

QA mobile:
1. columnas Edad / Mano / Lado alineadas;
2. no aparece RENDIMIENTO;
3. Efectividad protagonista;
4. Partidos jugados/ganados son tarjetas propias;
5. Racha actual/Mejor racha son tarjetas propias;
6. layout soporta valores largos;
7. eje X usa fechas o meses;
8. no aparece `SEM X`;
9. labels no se pisan;
10. MIS DATOS sin `TUS DATOS`;
11. MIS DATOS sin `IDENTIDAD`;
12. lápiz dentro de tarjeta de identidad;
13. datos personales/deportivos compactos;
14. Acceso y seguridad sin regresiones;
15. Cerrar sesión/modal sin regresiones.

Desktop: chequeo rápido solo de MI PERFIL y MIS DATOS.

## 15. FORMA DE TRABAJO CON CLAUDE
Este consolidado está cerrado.

Claude debe:
1. leer completo;
2. auditar brevemente;
3. implementar directamente;
4. no presentar plan;
5. no salir del alcance;
6. reutilizar estilos/componentes existentes;
7. validar mobile;
8. chequeo rápido desktop;
9. suite completa una sola vez al cierre;
10. generar informe;
11. commit;
12. tag;
13. push;
14. deploy.

Solo detenerse por riesgo real de pérdida de datos, contradicción de producto, acción destructiva no prevista o necesidad real de salir del alcance.

## 16. VERSIONADO
Publicar como **BRAMUlab V03.1.1**.

Actualizar:
- `APP_VERSION`
- `version.json`
- service worker/cache
- referencias necesarias

Generar:
`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.1.1_Informe.md`

El informe debe incluir:
- cambios visuales;
- composición final de KPIs;
- ajuste de eje X;
- simplificación de MIS DATOS;
- tests;
- QA;
- hashes;
- tag;
- deploy;
- diferencias justificadas.

# CRITERIO DE ÉXITO
V03.1.1 queda cerrada si:
- cabecera alineada;
- Rendimiento pasa a 5 tarjetas claras;
- Efectividad domina visualmente;
- Evolución usa fechas/meses legibles;
- MIS DATOS elimina ruido;
- botón de edición integrado;
- no hay regresiones;
- no se modifica nada fuera de alcance.
