# BRAMUlab — Revisión Central de h12: completar alcance antes de volver al Laboratorio

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**HEAD revisado:** `b229d23b9e2f69aa299ba5c105ec828c384792bf`  
**Bundle actual:** `04.11-h12`  
**Origen:** revisión central posterior a `41_Resultado_Ronda_Correctiva_Laboratorio_h12_27SEP.md`.

## 0. Alcance

La ronda h12 está bien encaminada y la causa raíz principal de identidad quedó correctamente resuelta.

Central verificó además en Supabase Staging que existe **una sola identidad registrada de Matu** relevante para el caso observado; no hay dos cuentas reales que deban fusionarse. El problema era efectivamente la ruta legacy/frontend.

NO reabrir esa investigación.

Esta intervención NO es una ronda nueva amplia. Es una **corrección final de alcance** antes de devolver la app a Sebastián, porque la revisión de código encontró cuatro puntos pedidos en el handoff 40 que quedaron incompletos o sin implementar.

No releer todo el repo ni repetir investigaciones ya cerradas. Partir de:

1. este documento;
2. `40_Handoff_Ronda_Correctiva_Laboratorio_h11_27SEP.md`;
3. `41_Resultado_Ronda_Correctiva_Laboratorio_h12_27SEP.md`;
4. archivos concretos afectados.

---

## A — QUIEN PROPUSO UNA CORRECCIÓN DEBE PODER VER LA PROPUESTA COMPLETA

### Estado h12

Para la pareja que DEBE responder:

- `Resultado oficial actual` está rotulado;
- se muestra tarjeta completa de `Corrección propuesta por [nombre]`;
- delta secundario;
- aceptar/rechazar.

Eso está bien.

Pero para la persona/pareja que PROPUSO la corrección, `paintB6Actions` todavía cae en:

> `Tu propuesta de corrección está esperando respuesta de la otra pareja.`

y **no muestra la propuesta completa enviada**.

Esto contradice el handoff 40:

> “al abrir el Resumen, permitir ver claramente la propuesta completa enviada.”

### CORREGIR

Cuando:

- partido `validated`;
- existe corrección activa;
- `proposedByTeam === f.myTeam`;

mostrar:

1. `Resultado oficial actual`;
2. `Corrección propuesta` / `Tu corrección propuesta`;
3. tarjeta completa con parejas + sets propuestos + ganador resultante;
4. estado `Esperando respuesta de la otra pareja`;
5. delta opcional como trazabilidad secundaria.

**Sin** botones aceptar/rechazar para quien propuso.

Reutilizar `buildCorrectionPreviewCardHTML` y las mismas fuentes reales. No crear otra representación paralela.

Semántica no cambia: el oficial sigue siendo el anterior hasta aceptación.

---

## B — HOME / HISTORIAL: CORRECCIÓN PROPUESTA SIGUE DEMASIADO SECUNDARIA

### Estado h12

El informe 41 dice explícitamente que Home/Historial quedaron “sin cambios”.

Pero el Laboratorio había marcado justamente que la píldora `CORRECCIÓN PROPUESTA` era demasiado secundaria.

Código actual confirma:

- Home muestra `CORRECCIÓN PROPUESTA` como badge de 10px;
- si el partido está `validated`, el borde/acento de Último partido sigue entrando por victoria/derrota;
- una corrección activa no cambia el tratamiento de la tarjeta a “estado pendiente importante”;
- Historial sigue apilando el badge pequeño debajo de VICTORIA/DERROTA.

Esto no cumple el principio confirmado:

> “La propuesta no reemplaza a la verdad oficial, pero mientras está abierta sí reemplaza al estado normal/cerrado del partido.”

### CORREGIR

Sin tocar score ni VICTORIA/DERROTA oficiales:

#### Home / Último partido

Si:

- `status === 'validated'`;
- `pendingCorrectionRevisionId` activo;

la tarjeta debe adoptar tratamiento visual de **estado pendiente/revisión** (ámbar/waiting) por encima del acento normal win/loss, manteniendo VICTORIA/DERROTA como dato deportivo oficial separado.

El estado `CORRECCIÓN PROPUESTA` debe tener mayor presencia que la píldora actual de 10px.

No convertirlo en alerta agresiva ni ocupar media pantalla.

#### Historial

Mantener resultado oficial.

Pero elevar `CORRECCIÓN PROPUESTA` a un estado visible de primer nivel dentro de la tarjeta:

- separado conceptualmente de VICTORIA/DERROTA;
- claramente legible al escanear;
- sin reemplazar el resultado;
- sin volver a introducir `VALIDADO` permanente.

Puede resolverse con una franja/estado/label con peso mayor reutilizando tokens existentes. No inventar una arquitectura nueva.

---

## C — COMPAÑEROS / RIVALES TODAVÍA NO MUESTRAN NIVEL

### Estado h12

La identidad canónica quedó corregida:

- avatar real;
- `@username` real;
- click por `player_id`;
- Perfil público correcto.

Pero `openPersonListScreen` todavía muestra:

- avatar;
- nombre;
- @usuario;
- enfrentamientos/victorias/derrotas;
- efectividad;

y **no utiliza `levelStatus/levelPublic` del `getPlayersCompact` que ya está trayendo**.

El handoff 40 pedía explícitamente que el patrón real de jugador muestre, cuando exista:

- avatar;
- nombre;
- @username;
- Nivel BRAMU vigente;

y aplicaba expresamente a Compañeros y Rivales.

### CORREGIR

Agregar el Nivel real a esas filas usando exclusivamente el mismo `compactById` ya obtenido.

Reglas:

- `CALIBRADO` + `levelPublic` real → mostrar Nivel;
- estado no publicable/calibrando → usar el tratamiento vigente del componente compartido;
- sin dato real → no inventar número;
- no hacer llamadas N+1;
- no tocar estadísticas de compañero/rival existentes.

Preferir reutilizar tokens/helpers visuales existentes de `buildCompactPlayerRowHTML` o el patrón equivalente, sin destruir la información específica de Compañeros/Rivales.

---

## D — FLUJO DE IDENTIDAD: HACER EXPLÍCITA LA SALIDA “POR IDENTIFICAR”

### Estado h12

Mejoró correctamente:

- copy `¿Estás seguro de que no fue [nombre]?`;
- después de reportar abre directo el sheet;
- el sheet permite buscar reemplazo;
- cerrar el sheet deja la incidencia abierta y el slot `Por identificar`.

Funcionalmente el backend lo permite.

Pero el handoff pedía explícitamente:

- preguntar inmediatamente si sabe quién jugó;
- permitir buscar/reemplazar;
- permitir también dejar `Por identificar` si no lo sabe.

Hoy el sheet dice `¿QUIÉN JUGÓ REALMENTE?` y la única forma de “no sé” es descubrir que cerrar con X conserva el estado. Eso no es una acción explícita.

### CORREGIR

Hacer explícita la bifurcación sin agregar backend:

- título/copy cercano a `¿Sabés quién jugó?`;
- búsqueda/reemplazo como camino principal;
- acción secundaria clara tipo `No sé · dejar por identificar` / `Dejar por identificar`.

Esa acción:

- NO debe llamar otra RPC;
- simplemente confirma visualmente el estado ya creado por `report_identity_issue` y cierra el sheet;
- la incidencia sigue abierta dentro de su ventana vigente;
- luego puede resolverse desde el partido como ya ocurre.

Mantener la X como cierre normal si corresponde, pero no usarla como único mecanismo para expresar “no sé quién fue”.

---

## E — NO REABRIR / NO TOCAR

No modificar:

- causa raíz de Matu ya resuelta;
- backend/Supabase;
- fórmula de Nivel;
- Ranking;
- Intelligence;
- h11 self-healing;
- lógica de aceptación/rechazo;
- editor de sets salvo una regresión concreta;
- BRAMUlive;
- main;
- Production;
- P0.2/P0.3;
- Mis grupos;
- popup futuro;
- realtime/polling;
- desktop general.

No hacer otra auditoría grande.

---

## F — TESTS Y VERSIONADO

Agregar únicamente tests/guardas focales para estos cuatro puntos.

Como `h12` ya fue pusheado y desplegado, los cambios frontend necesitan invalidar cache:

- bundle objetivo: `04.11-h13`;
- bump único al final;
- cuarteto completo;
- un solo commit correctivo;
- un solo push `origin/staging`;
- un deploy intencional.

Antes de push:

- tests focales nuevos/actualizados;
- suite Node completa;
- `tests.html`;
- smoke boot.

No repetir pruebas manuales de h11/h12.

---

## G — ENTREGA

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/43_Resultado_Correccion_Central_h13_27SEP.md`

Debe indicar:

1. cómo ve su propuesta completa quien la envió;
2. cómo se elevó `CORRECCIÓN PROPUESTA` en Home/Historial sin reemplazar score oficial;
3. cómo quedó Nivel en Compañeros/Rivales;
4. cómo quedó la salida explícita `Por identificar`;
5. tests;
6. bundle;
7. commit;
8. deploy;
9. si queda algún riesgo real.

Actualizar el resultado 41 o Laboratorio únicamente con hechos objetivos; no declarar PASS físico antes de Sebastián.

Al finalizar, no inventar otra batería de QA: mantener la batería física original de máximo 5 bloques, ajustada a h13.
