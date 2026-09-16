# BRAMUlab — documentación activa

**Estado del producto:** BRAMUlab **V04.10**  
**Base estable anterior:** BRAMUlab **V03.10**  
**Tests al cierre de V04.10:** **1400/1400**  
**Actualización documental:** 16 de septiembre de 2026

Este README es el **mapa de autoridad documental** de BRAMUlab. Antes de investigar el árbol completo, desarrollo debe empezar acá y leer solo la fuente maestra del sistema involucrado.

---

## 1. Qué está activo hoy

### BRAMUlab V04 — Nivel BRAMU

V04 está implementada hasta **V04.10** sobre la base cerrada V03.10.

Documentación de implementación:

- `Versiones/BRAMUlab_V04/BRAMUlab_V04_Consolidado.md` — qué se pidió/decidió durante V04.
- `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md` — qué se implementó, testeó y corrigió realmente.

Para continuar desarrollo de V04 no leer el Informe completo por defecto: consultar la sección de la última ronda necesaria.

### V03

V03 está **cerrada en V03.10**. No se reabre salvo regresión concreta.

- `Versiones/BRAMUlab_V03/BRAMUlab_V03_Consolidado.md`
- `Versiones/BRAMUlab_V03/BRAMUlab_V03_Informe.md`

Los documentos intermedios de V03 viven en `Archivo/BRAMUlab_V03/` y no son fuente activa.

### Backend / Infraestructura

Implementación en curso, por bloques, sobre `Backend_Infraestructura.md` (fuente maestra de decisiones). No usa la numeración `V04.x`: esa numeración es de Nivel BRAMU.

- `Backend_Infraestructura.md` — qué se decidió (arquitectura, modelo de datos, alcance por bloque).
- `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` — qué se implementó, testeó y qué acción manual falta, bloque por bloque.

**Bloque 1 (fundación de backend y entornos) está CERRADO**: verificado contra Supabase Staging y Vercel reales (health check y RLS deny-by-default confirmados en producción de Staging, 16/09/2026). El proyecto Supabase/Vercel de Production todavía no existe; se crea más adelante con el mismo procedimiento, sin bloquear Bloque 2.

**Bloque 2 (Auth, perfil, username, ubicación, recuperación) tiene su código completo (16/09/2026), pendiente de validación real en Staging** — no está cerrado todavía: falta aplicar la migración y correr `supabase/tests/verify-bloque2.mjs` contra un proyecto Supabase real, configurar las plantillas de email (código de 6 dígitos) y probar el recorrido completo en el navegador. Ver la sección "Bloque 2" de `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` para el detalle exacto de qué falta.

---

## 2. Fuentes maestras vigentes

| Sistema | Fuente maestra / precedencia | Estado |
|---|---|---|
| **Nivel BRAMU** | `Nivel_BRAMU_Formula_V1.5.md` → `Nivel_BRAMU_Implementacion.md` → `Nivel_BRAMU.md` | Motor + estimador implementados en V04; pendiente validación real/integración posterior |
| **Ranking BRAMU** | `Ranking_BRAMU.md` | V1 de producto/UX cerrada; implementación actual V03 es prototipo local/simulado |
| **BRAMU Intelligence** | `BRAMU_Intelligence.md` → `BRAMU_Intelligence_Implementacion.md` | V1 cerrada para futura implementación |
| **Backend / Infraestructura** | `Backend_Infraestructura.md` → `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Bloque 1 CERRADO (verificado en Staging real); Bloque 2 código completo, pendiente de validación real en Staging |
| **Backlog futuro** | `BRAMUlab_Backlog.md` | Solo ideas realmente futuras/no autorizadas |

### Precedencia de Nivel

`Nivel_BRAMU_Formula_V1.5.md` es la **fuente normativa vigente**.

- Motor de partidos: `nivel_bramu_v1_0` — conservado sin cambios.
- Estimador inicial: `nivel_inicial_v1_1` — reemplaza la estimación inicial de V1.4.
- `Nivel_BRAMU_Formula_V1.4.md` es antecedente histórico y vive en `Archivo/Nivel_BRAMU/`.
- Los handoffs del cuestionario V1.5 ya fueron consumidos y también viven en Archivo.

Si un documento vigente anterior todavía menciona V1.4 como autoridad, **no reabrir la definición**: aplicar V1.5 como precedencia. Las referencias a V1.4 describen el motor heredado que V1.5 conserva, no un cuestionario vigente.

### Ranking semanal

Ranking BRAMU vigente es **semanal**. Nivel puede cambiar partido a partido, pero la posición de Ranking cambia al publicarse una nueva edición semanal. Cualquier texto histórico de Intelligence que hable de movimiento de puesto “al procesar el evento actual” se interpreta bajo esta regla vigente.

---

## 3. Cómo se organiza `docs/BRAMUlab`

### Raíz

Solo documentos que pueden ser necesarios para tomar decisiones actuales:

- este `README.md`;
- `BRAMUlab_Backlog.md`;
- fuentes maestras de Nivel;
- `Ranking_BRAMU.md`;
- `BRAMU_Intelligence.md` y su implementación;
- `Backend_Infraestructura.md`.

### `Versiones/`

Registro por versión mayor del producto. Cada versión consolidada usa principalmente:

- `..._Consolidado.md`: decisiones/pedidos;
- `..._Informe.md`: implementación real, pruebas y correcciones.

No usar el Informe entero como contexto por defecto si alcanza con una sección concreta.

### `Archivo/`

Antecedentes, documentos sustituidos, handoffs ya consumidos e informes diagnósticos preservados. **No son fuente activa** salvo pedido explícito de trazabilidad.

Incluye, entre otros:

- versiones antiguas de fórmulas de Nivel;
- handoffs ya implementados;
- documentación intermedia de V03/V04;
- `Archivo/Backend_Infraestructura/Backend_Infraestructura_Informe.md` como diagnóstico histórico.

### `Backup/`

Copias deliberadas de seguridad. No son fuentes normativas.

### `Referencias/`

Investigaciones, moodboards, auditorías visuales y material de contexto. Pueden fundamentar decisiones, pero no reemplazan una fuente maestra.

---

## 4. Regla de lectura para Claude Code / desarrollo

Para ahorrar contexto y evitar reabrir decisiones cerradas:

1. Leer este README.
2. Identificar el sistema afectado.
3. Leer únicamente su fuente maestra vigente.
4. Si hace falta implementación histórica, consultar la sección concreta del Consolidado/Informe de la versión correspondiente.
5. **No leer `Archivo/`, `Backup/`, Informes completos antiguos ni handoffs consumidos** salvo instrucción explícita.
6. No iniciar una auditoría general porque cambió una ruta o porque existe una referencia histórica.
7. Si aparece una contradicción material que las precedencias de este README no resuelven, reportarla antes de programar.

La reorganización documental del 15/09/2026 quedó registrada en:

`Archivo/BRAMUlab_Reorganizacion_Documental_2026-09-15.md`

---

## 5. Estado resumido de cada sistema

### Nivel BRAMU

Implementado localmente detrás del flujo/preview vigente hasta V04.10:

- motor matemático puro;
- elegibilidad, invitados, repetición y círculo competitivo;
- estimador inicial V1.1;
- onboarding rápido/completo;
- categoría contextual;
- estados pendiente/calibrando/calibrado;
- presentación en Home/Perfil/Perfil público;
- laboratorio de prueba;
- 1400/1400 tests.

Todavía no existe backend real multiusuario ni validación productiva con datos reales.

### Ranking BRAMU

La definición vigente separa:

- Nivel = capacidad estimada dinámica;
- Ranking = posición semanal publicada dentro de un universo elegible.

La UI actual de V03 es prototipo/simulación local y no debe confundirse con el Ranking productivo futuro con backend.

### BRAMU Intelligence

V1 está definida como motor selectivo de insights respaldados por evidencia. La capa generativa es opcional y solo redacta claims ya calculados; no inventa datos ni decide Nivel/Ranking.

### Backend / Infraestructura

La dirección vigente prevé una infraestructura real y permanente, con separación Development/Staging/Production y backend basado en Supabase/Vercel según el documento maestro. No implementar desde antecedentes del Archivo.

---

## 6. Regla de versionado

Desde V04 la numeración de rondas es plana:

`V04.1`, `V04.2`, `V04.3` ... `V04.9`, `V04.10`.

No usar subversiones tipo `V04.9.1`.

Una nueva versión mayor crea una nueva carpeta dentro de `Versiones/`. Una ronda menor dentro de la misma versión no crea otra carpeta mayor.

---

## 7. Qué leer según el pedido

- **“Seguir con Nivel BRAMU / V04”** → este README + `Nivel_BRAMU_Formula_V1.5.md` y, si corresponde, la última sección de `BRAMUlab_V04_Informe.md`.
- **“Ranking”** → `Ranking_BRAMU.md` + Nivel V1.5 solo donde Ranking dependa de Nivel.
- **“BRAMU Intelligence”** → `BRAMU_Intelligence.md` + `BRAMU_Intelligence_Implementacion.md`.
- **“Backend / producción / cuentas reales / staging”** → `Backend_Infraestructura.md` + la sección del bloque correspondiente en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`.
- **“Qué falta / ideas futuras”** → `BRAMUlab_Backlog.md`.
- **“Qué pasó en una versión anterior”** → `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
