# BRAMUlab V03.10 — cierre final de V03

## Objetivo

Hacer una última micro-ronda sobre V03.9 con dos ajustes reales detectados en QA:

1. cerrar de forma conservadora el comportamiento editorial de `TU MOMENTO`;
2. mejorar la identificación de jugadores en las listas de Compañeros/Rivales abiertas desde Home.

Base publicada: `BRAMUlab V03.9`.

Este documento SUPERA el handoff anterior:
`BRAMUlab_V03.10_Handoff_Cierre_Editorial_Tu_Momento.md`

Usar ESTE archivo como especificación vigente de V03.10.

No abrir nuevos frentes.
No rediseñar Home.
No avanzar a V04.

---

# 1. TU MOMENTO — cierre conservador antes de BRAMU Intelligence

## Problema real

Con un balance reciente muy negativo, por ejemplo 0 victorias / 5 derrotas, Home muestra:

`Perdiste 5 de tus últimos 5 partidos.`

El dato es correcto, pero `TU MOMENTO` no debería destacar una mala racha reciente como insight editorial principal.

V03.9 resolvió correctamente otro problema: dejó de presentar un balance negativo con framing positivo.

V03.10 debe cerrar la regla sin convertir `TU MOMENTO` en un motor de análisis avanzado.

## Regla V03.10

La cláusula de forma reciente entra únicamente cuando el balance reciente es positivo:

- victorias > derrotas → puede mostrar:
  `Ganaste X de tus últimos N partidos.`
- victorias <= derrotas → NO generar cláusula de forma reciente.

No reemplazarla por:

- `Perdiste...`
- `Balance parejo...`
- otro copy negativo o neutro.

Simplemente omitir esa cláusula y continuar con el siguiente candidato existente.

La prioridad sigue siendo:

`forma reciente positiva > Ranking semanal Local > compañero frecuente > actividad del mes`

Si la forma reciente no califica, Ranking puede ocupar el primer lugar disponible.

## Ranking negativo sí puede aparecer

No modificar el insight de Ranking.

Ejemplo válido:

`#5 de 21 en Bella Vista · ↓ 3 esta semana`

Es un hecho contextual de posición, no una interpretación del rendimiento.

Las flechas siguen significando puestos.

## Relación futura con BRAMU Intelligence

NO implementar BRAMU Intelligence en esta ronda.

Documentar que esta decisión es deliberadamente conservadora:
`TU MOMENTO` queda como superficie liviana y determinística.

La interpretación de:
- mala racha;
- recuperación;
- tendencia;
- contexto temporal;
- qué dato negativo vale la pena mostrar y cómo expresarlo

queda para el diseño/implementación de BRAMU Intelligence en V05.

---

# 2. COMPAÑEROS / RIVALES — identidad visible con @username

## Problema real

Desde Home, las tarjetas de “mejor compañero” / “rival” permiten abrir listados como `RIVALES`.

Hoy las filas muestran:

- nombre;
- enfrentamientos;
- victorias/derrotas;
- efectividad;

pero NO muestran `@username`.

Eso crea ambigüedad si hay dos jugadores con el mismo nombre visible.

En `MIS GRUPOS` ya existe el patrón correcto:

`Nombre · @username`

Ejemplo:

`Diegote · @diegote`

La lista de Compañeros/Rivales debería seguir el mismo criterio de identidad cuando existe una cuenta real vinculable.

## Ajuste UX

En las pantallas/listas de:

- Compañeros;
- Rivales;

mostrar en la línea principal:

`Nombre · @username`

cuando el jugador tenga una cuenta BRAMU real y un username resoluble.

Si NO existe una cuenta real resoluble:
- mostrar solo el nombre;
- no inventar `@username`;
- no crear usernames derivados del nombre.

Mantener exactamente las estadísticas existentes debajo/a la derecha.

No rediseñar las tarjetas.

## Regla de identidad

Respetar la regla vigente del proyecto:

- `userId` guardado en `match.players[]` es autoritativo;
- si existe `userId`, resolver la cuenta por ese ID;
- no sustituir un `userId` existente por coincidencia de nombre;
- para registros legacy sin `userId`, usar únicamente el fallback de identidad ya existente en el proyecto, y solo mostrar `@username` si la resolución es inequívoca/segura;
- si no puede resolverse con seguridad, mostrar solo el nombre.

Si el agregado actual de compañero/rival pierde el `userId`, AGREGAR únicamente el dato mínimo necesario para conservar la identidad al construir esas listas. No crear una segunda lógica de usuarios.

Tomar visualmente `MIS GRUPOS` como referencia para:
- jerarquía nombre + `@username`;
- tamaño/color secundario del handle.

No hace falta copiar literalmente markup si la estructura es diferente.

---

# 3. Alcance

Tocar solo lo necesario para:

1. supresión de forma reciente negativa/neutra en `TU MOMENTO`;
2. `@username` seguro en listas de Compañeros/Rivales;
3. tests;
4. versionado V03.10;
5. documentación/reporte.

No tocar:

- lógica semanal de Ranking;
- geografía;
- Mi red;
- tarjeta territorial de Perfil;
- `Explorar rankings`;
- Nivel BRAMU;
- BRAMU Intelligence;
- Backend;
- validación de partidos;
- historial multiusuario;
- WhatsApp;
- Mis grupos salvo usarlo como referencia visual;
- diseño global.

---

# 4. Tests focales

## TU MOMENTO

- 3W / 2L → genera cláusula positiva.
- 2W / 3L → NO genera cláusula de forma reciente.
- 0W / 5L → NO genera cláusula de forma reciente.
- 2W / 2L → NO genera cláusula de forma reciente.
- si se omite forma reciente y existe insight de Ranking, Ranking ocupa el primer lugar disponible;
- si tampoco hay Ranking, conserva fallback actual a compañero frecuente / actividad;
- no cambia prioridad ni lógica restante.

## Identidad en Compañeros/Rivales

Tests puros/focales donde la arquitectura lo permita:

- jugador con `userId` y cuenta real → nombre + username resoluble;
- dos cuentas con mismo displayName pero distinto `userId` → cada fila conserva la identidad correcta por ID;
- legacy sin `userId` con resolución inequívoca → puede mostrar username según fallback vigente;
- jugador sin cuenta resoluble → nombre solamente;
- nunca inventar username.

No hace falta testear CSS.

Suite completa una sola vez al final.

---

# 5. QA manual

Mobile 375px primero.

## Home / TU MOMENTO

1. caso 0W/5L:
   - NO mostrar `Perdiste 5 de tus últimos 5 partidos`;
   - si existe movimiento de Ranking, puede quedar como primer insight;
   - segundo insight puede venir de los candidatos actuales.

2. caso 3W/2L:
   - debe seguir pudiendo mostrar `Ganaste 3 de tus últimos 5 partidos`.

## Compañeros / Rivales

- abrir ambos listados desde Home;
- cuenta real: `Nombre · @username`;
- jugador histórico/local sin cuenta: nombre solamente;
- probar, si es posible, dos displayNames iguales con IDs distintos;
- estadísticas y efectividad intactas;
- sin overflow a 375px;
- quick check tablet.

---

# 6. Versionado y documentación

Versión:

`BRAMUlab V03.10`

Actualizar:
- app version;
- `version.json`;
- cache-bust;
- service worker;
- tag `BRAMUlab_V03.10`.

Crear:
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.10.md`
- `docs/BRAMUlab/Versiones/BRAMUlab_V03/BRAMUlab_V03.10_Reporte_ChatGPT.md`

El reporte debe indicar:
- cambio exacto de TU MOMENTO;
- cómo se resolvió identidad en Compañeros/Rivales;
- si fue necesario conservar/agregar `userId` en algún agregado;
- tests focales;
- suite completa;
- QA;
- commit;
- tag;
- deploy;
- limitaciones reales.

Al terminar:
1. commit;
2. tag;
3. push;
4. deploy;
5. verificar producción;
6. crear/completar reporte;
7. detenerse.

No consolidar V03 todavía.
No avanzar a V04.

La siguiente decisión la toma ChatGPT después de auditar el reporte.
