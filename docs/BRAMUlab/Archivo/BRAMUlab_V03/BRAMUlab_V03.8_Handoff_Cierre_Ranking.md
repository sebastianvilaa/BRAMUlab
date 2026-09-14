# BRAMUlab V03.8 — cierre UX de Ranking BRAMU

## Objetivo

Cerrar el frente UX de Ranking dentro de V03 después de V03.7, incorporando únicamente decisiones ya validadas por el análisis especializado de Ranking BRAMU.

Esta ronda debe:

1. actualizar primero la normativa vigente de `Ranking_BRAMU.md`;
2. replicar la tarjeta territorial de Ranking en Mi Perfil;
3. mejorar levemente la jerarquía visual de los puestos en esa tarjeta;
4. hacer que `TU POSICIÓN` lleve/cargue la zona de la clasificación cercana a la fila propia;
5. integrar Ranking en Home únicamente dentro de `TU MOMENTO`, sin agregar otra tarjeta completa;
6. dejar `Explorar rankings` documentado como evolución futura, fuera de V1.

No implementar Nivel BRAMU, BRAMU Intelligence, Backend ni exploración geográfica.

---

# 1. Fuentes

Leer únicamente:

1. `docs/BRAMUlab/Ranking_BRAMU.md`
2. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.7.md`
3. `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.7_Reporte_ChatGPT.md`
4. código actual estrictamente necesario para Ranking, Perfil propio y Home.

No releer documentación histórica.

Base técnica conocida:

- V03.7
- commit `24dc7b8`
- tag `BRAMUlab_V03.7`
- 1020/1020 tests
- cache-bust `03.7`

---

# 2. ACTUALIZAR PRIMERO `Ranking_BRAMU.md`

No rediseñar decisiones previas.

La actualización debe registrar explícitamente estas decisiones cerradas:

## 2.1 Ranking principal = contexto geográfico propio

Los ámbitos:

`Local | Provincial | País | Global | Mi red`

siguen respondiendo a:

> ¿Dónde estoy yo parado?

Para Local / Provincial / País se usa la ubicación principal estructurada del jugador congelada en la edición semanal.

No agregar filtros geográficos para cambiar manualmente el territorio de esos scopes.

Mantener:

- Local = localidad exacta;
- Provincial = misma provincia/estado y país;
- País = mismo país;
- Global = reglas existentes;
- Mi red = vínculos deportivos, sin dependencia territorial.

## 2.2 Explorar otros territorios

Definir conceptualmente una futura función separada:

`Explorar rankings`

Objetivo:

> ¿Cómo está el Ranking en otra ciudad, provincia o país?

Principios:

- búsqueda geográfica estructurada;
- solo consulta;
- no modificar la ubicación del usuario;
- no reemplazar los scopes personales;
- no usar una cascada gigante País → Provincia → Localidad;
- distinguir entidades homónimas por tipo y jerarquía territorial.

Ejemplos futuros:

- `Santa Fe, Argentina · Provincia`
- `Santa Fe, Santa Fe · Localidad`
- `Rosario, Santa Fe · Localidad`
- `Chile · País`

IMPORTANTE:

`Explorar rankings` queda FUERA de V1 actual mientras BRAMU tenga poca densidad.

No implementarlo en V03.8.

## 2.3 `TU POSICIÓN`

Registrar que tocar `TU POSICIÓN` debe llevar/cargar el contexto cercano a la fila propia.

No es:

- un nuevo ámbito;
- un filtro;
- una pantalla paralela.

Es una ayuda de navegación dentro de la clasificación actual.

La intención UX es poder ver rápidamente jugadores inmediatamente por encima y por debajo de la posición propia.

## 2.4 Perfil público y Mi Perfil

Registrar la tarjeta territorial semanal como superficie oficial de Ranking.

Debe existir en:

- Perfil público de un jugador real elegible;
- Mi Perfil.

La tarjeta muestra:

- período de la edición;
- Local: puesto + denominador + territorio;
- Provincia: puesto + denominador + territorio;
- País: puesto + denominador + territorio.

Siempre usa el snapshot semanal del jugador del perfil.

No usa el Nivel actual en vivo para recalcular posiciones.

No es clickeable.

No inventa puestos para:

- calibrando/no elegible;
- cuentas sin identidad real apta para Ranking.

## 2.5 Home

Registrar que Ranking NO debe duplicarse mediante otra tarjeta territorial completa en Home.

Ranking entra en Home únicamente como posible insight de `TU MOMENTO`.

Ejemplos válidos:

- `#8 de 21 en Bella Vista · ↑ 2 esta semana`
- `Esta semana estás #15 de 65 en Provincia`
- `Entraste al top 10 de Bella Vista`

Debe utilizar hechos del snapshot semanal.

No atribuir una subida necesariamente a jugar mejor: las flechas solo significan movimiento de puestos.

## 2.6 No cambia

Dejar claro que esta actualización NO modifica:

- Ranking semanal;
- orden por Nivel consolidado interno;
- elegibilidad;
- snapshots;
- densidad;
- cooldown de ubicación;
- filtros de género/Nivel;
- reglas de Mi red;
- privacidad.

Actualizar fecha/estado del documento de forma coherente.

---

# 3. V03.8 — MI PERFIL

La tarjeta territorial ya implementada en Perfil público debe aparecer también en Mi Perfil.

Reutilizar:

- misma fuente;
- misma lógica;
- mismo período semanal;
- mismo componente/estilos cuando sea razonable.

No crear una segunda implementación de Ranking.

Ubicación recomendada:

debajo de:

- Mejor racha;
- Mejor nivel BRAMU;

y antes de acciones/configuración posteriores, replicando la jerarquía del Perfil público.

Estados:

- elegible → tres columnas;
- calibrando → estado simple, sin puestos inventados;
- no elegible → “Todavía sin posición oficial” o copy vigente equivalente.

---

# 4. AJUSTE VISUAL DE LA TARJETA

En V03.7 la tarjeta quedó validada, pero los puestos (`#2`, `#15`, `#42`) resultan algo pequeños.

Ajustar únicamente jerarquía tipográfica:

- puesto más protagonista;
- `de N` secundario;
- territorio discreto;
- mantener tarjeta compacta;
- no aumentar innecesariamente la altura;
- mobile 375px primero.

Aplicar tanto a Perfil público como Mi Perfil.

No rediseñar la tarjeta.

---

# 5. `TU POSICIÓN` → CONTEXTO CERCANO

Actualmente tocar `TU POSICIÓN` debe evolucionar para garantizar que el usuario llegue a su fila aunque todavía no esté dentro del bloque visible/cargado.

Comportamiento deseado:

1. si la fila propia ya está renderizada:
   - scroll suave hasta ella;
2. si todavía no está cargada:
   - cargar/armar la cantidad mínima razonable necesaria para mostrar un pequeño contexto alrededor de la posición propia;
   - llevar al usuario a esa zona;
3. dejar visibles jugadores inmediatamente anteriores y posteriores cuando sea posible.

No crear:

- otro scope;
- modal;
- sheet;
- pantalla “cerca de mí”.

Preferir reutilizar el paginado/ventana existente.

Si la arquitectura actual hace desproporcionadamente costoso “cargar una ventana” sin cargar todos los bloques previos, documentar la limitación y elegir la solución más simple que preserve la intención sin introducir una arquitectura nueva.

---

# 6. HOME — RANKING SOLO EN `TU MOMENTO`

No agregar la tarjeta completa de Ranking a Home.

Integrar Ranking como un candidato dentro de `TU MOMENTO`, reutilizando el mecanismo actual.

Reglas mínimas recomendadas:

## Movimiento positivo

Si existe movimiento semanal positivo:

`#8 de 21 en Bella Vista · ↑ 2 esta semana`

o variante breve coherente con la voz actual.

## Movimiento negativo

Puede informarse factual y neutralmente:

`#8 de 21 en Bella Vista · ↓ 2 esta semana`

No usar lenguaje punitivo.

## Nuevo

Si entra por primera vez a un Ranking válido:

`Entraste al Ranking de Bella Vista: #8 de 21`

## Sin movimiento

No forzar un mensaje de Ranking solo para llenar espacio si `TU MOMENTO` ya tiene una observación más relevante.

## Sin posición

Mantener la experiencia actual de calibración / primer partido.

No inventar Ranking.

IMPORTANTE:

- usar el snapshot semanal;
- flechas = puestos;
- no decir que subió “porque jugó mejor”;
- no crear un nuevo motor editorial;
- incorporar Ranking al sistema de `TU MOMENTO` existente de la forma más simple.

Si `TU MOMENTO` no tiene hoy una arquitectura de candidatos/rotación y agregarla exige rediseñar el componente, NO hacerlo silenciosamente: documentar el hallazgo antes de expandir alcance.

---

# 7. FUERA DE V03.8

No implementar:

- `Explorar rankings`;
- selector geográfico;
- búsqueda de otra ciudad/provincia/país;
- Nivel BRAMU real;
- cuestionario;
- BRAMU Intelligence;
- Backend;
- validación de partidos;
- historial multiusuario/localStorage;
- login/autocomplete;
- nuevas reglas de Ranking;
- Race/temporadas.

---

# 8. TESTS

Durante desarrollo: focales.

Agregar únicamente pruebas necesarias.

Como mínimo:

## Mi Perfil

- elegible muestra Local / Provincia / País;
- usa la misma edición semanal que Perfil público;
- calibrando/no elegible no recibe puestos inventados.

## Tarjeta

- Perfil propio y público consumen la misma lógica/fuente de resumen.

No testear tamaños CSS.

## TU POSICIÓN

- si self está dentro de filas cargadas, se localiza correctamente;
- si está fuera, la acción garantiza que quede disponible/visible según la solución elegida;
- no cambia scope/filtros.

## TU MOMENTO

- movimiento positivo produce candidato correcto;
- movimiento negativo mantiene lenguaje factual;
- `Nuevo` produce mensaje de entrada;
- sin posición no inventa mensaje;
- sin movimiento no desplaza forzosamente una observación existente si esa es la regla final adoptada.

Suite completa UNA sola vez al final porque se toca Ranking/Home compartidos.

---

# 9. QA MANUAL

Mobile 375px primero.

1. Mi Perfil con cuenta elegible:
   - tarjeta visible;
   - 3 columnas;
   - puestos con mejor jerarquía;
   - período correcto.

2. Perfil público:
   - misma tarjeta;
   - ajuste visual consistente;
   - WhatsApp/acciones intactas.

3. Cuenta calibrando:
   - sin posiciones inventadas.

4. Ranking:
   - Local/Provincial/País siguen correctos;
   - tocar TU POSICIÓN lleva a la zona propia;
   - búsqueda/filtros/paginado intactos.

5. Home:
   - TU MOMENTO puede mostrar un insight de Ranking cuando corresponde;
   - no aparece tarjeta territorial duplicada;
   - layout actual no se degrada.

6. Tablet/desktop:
   - chequeo rápido.

---

# 10. VERSIONADO

Esta ronda es:

`BRAMUlab V03.8`

Actualizar:

- app version;
- `version.json`;
- cache-bust;
- service worker;
- tag `BRAMUlab_V03.8`.

No usar V03.7.1.
No abrir V04.

---

# 11. DOCUMENTACIÓN DE VERSIÓN

Crear:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.8.md`

y al terminar:

`docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.8_Reporte_ChatGPT.md`

Mantener ambos concisos.

El reporte debe indicar:

- actualización normativa realizada;
- archivos tocados;
- cómo se reutilizó la tarjeta en Mi Perfil;
- ajuste visual;
- comportamiento final de TU POSICIÓN;
- integración exacta en TU MOMENTO;
- tests focales;
- suite completa;
- QA;
- commit;
- tag;
- cache-bust;
- deploy;
- problemas o decisiones pendientes reales.

---

# 12. GIT / CIERRE

Antes de tocar código:

- `git status`;
- no incluir cambios ajenos.

Si todo queda verde:

1. actualizar normativa;
2. implementar V03.8;
3. tests focales;
4. suite completa una sola vez;
5. commit del frente;
6. tag `BRAMUlab_V03.8`;
7. push;
8. deploy;
9. verificar producción;
10. completar reporte;
11. detenerse.

No avanzar a V04.

La siguiente decisión la toma ChatGPT después de auditar el reporte.
