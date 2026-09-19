# BRAMUlab — documentación activa

**Estado del producto:** BRAMUlab **V04.10**  
**Base estable anterior:** BRAMUlab **V03.10**  
**Tests al cierre de V04.10:** **1400/1400**  
**Actualización documental:** 19 de septiembre de 2026

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

**Bloque 2 (Auth, perfil, username, ubicación, recuperación) está CERRADO** (18/09/2026): validado de punta a punta contra Supabase Staging real y la app real de Staging, con una cuenta real — migración, RLS, trigger, RPCs, signup/confirmación, logout/login, segunda sesión limpia, recuperación de contraseña y username duplicado. Pusheado únicamente a la rama `staging`, nunca a `main`. Ver la sección "Bloque 2" de `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` para el detalle completo.

**Bloque 3 (Nivel productivo y persistente) está IMPLEMENTADO, pendiente de validación real en Staging** (19/09/2026): la alineación de onboarding (confirmación de email diferida, perfil mínimo = nombre + apellido + `@usuario` + términos), `level_states`/`level_events`, la Edge Function `officialize-onboarding` (reutiliza el motor JS compartido, `supabase/functions/_shared/` son symlinks reales a `bramulab/level.js`/`level-calibration.js`, nunca una copia) y la RPC privada `officialize_level_onboarding` ya están escritos y pasaron la regresión local (1408/1408) y una verificación manual del camino sin backend. Falta que Sebastián aplique la migración `20260919120000_bloque3_nivel_persistente.sql`, despliegue la Edge Function y corra `verify-bloque3.mjs`/`verify-nivel-parity.mjs` contra Supabase Staging real antes de dar el bloque por cerrado. Ver `Implementacion/Backend/Bloque_03/04_Informe_Implementacion_Claude.md` para el detalle completo y la sección "Bloque 3" de `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` para el resumen de fuente maestra.

Localidad, rama y `ranking_opt_in` siguen sin bloquear Nivel/Home/primer partido y se piden recién al entrar a Ranking (sin cambios sobre lo ya alineado).

Próximo bloque, una vez validado Bloque 3 en Staging: **Bloque 4** (Jugadores, búsqueda e invitados provisionales) — no iniciado.

---

## 2. Fuentes maestras vigentes

| Sistema | Fuente maestra / precedencia | Estado |
|---|---|---|
| **Nivel BRAMU** | `Nivel_BRAMU_Formula_V1.5.md` → `Nivel_BRAMU_Implementacion.md` → `Nivel_BRAMU.md` | Motor + estimador implementados en V04; pendiente validación real/integración posterior |
| **Ranking BRAMU** | `Ranking_BRAMU.md` | V1 de producto/UX cerrada; implementación actual V03 es prototipo local/simulado |
| **BRAMU Intelligence** | `BRAMU_Intelligence.md` → `BRAMU_Intelligence_Implementacion.md` | V1 cerrada; implementación obligatoria antes de la primera salida productiva. Capa generativa opcional |
| **Experiencia inicial / ciclo de partido** | `Experiencia_Inicial.md` → `Backend_Infraestructura.md` para contrato técnico | Experiencia inicial cerrada; impacto inmediato en Bloque 3 y luego en Bloques 4–6 |
| **Backend / Infraestructura** | `Backend_Infraestructura.md` → `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md` | Bloques 1 y 2 CERRADOS; Bloque 3 es el próximo autorizado. Roadmap vigente: Bloques 1–7 → Intelligence V1 → endurecimiento/salida |
| **Backlog futuro** | `BRAMUlab_Backlog.md` | Solo ideas realmente futuras/no autorizadas |

### Precedencia de Nivel

`Nivel_BRAMU_Formula_V1.5.md` es la **fuente normativa vigente**.

- Motor de partidos: `nivel_bramu_v1_0` — conservado sin cambios.
- Estimador inicial: `nivel_inicial_v1_2` — estimación inicial universal; reemplaza V1.1 retirando categoría local del onboarding/cálculo.
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
- `Experiencia_Inicial.md`;
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

Implementado localmente detrás del flujo/preview vigente hasta V04.10 (motor matemático puro, elegibilidad/invitados/repetición/círculo competitivo, estimador inicial V1.1, onboarding rápido/completo, categoría contextual, presentación en Home/Perfil/Perfil público, laboratorio de prueba, 1408/1408 tests).

**Backend Bloque 3 (19/09/2026, implementado, pendiente de validación en Staging)** agrega la persistencia server-side real: `level_states`/`level_events`, estado `PENDIENTE` explícito (creado por `handle_email_confirmed` apenas hay `player_id`, incluso si el email se confirma antes de terminar el resto del onboarding), y la oficialización atómica/idempotente vía la Edge Function `officialize-onboarding` + la RPC privada `officialize_level_onboarding` — el motor sigue siendo el mismo archivo JS que usa el navegador (symlink real, nunca una copia), nunca se reimplementó en SQL. El laboratorio de prueba queda oculto en Production (visible en Development/Staging). Detalle completo en `Implementacion/Backend/Bloque_03/`.

### Ranking BRAMU

La definición vigente separa:

- Nivel = capacidad estimada dinámica;
- Ranking = posición semanal publicada dentro de un universo elegible.

La UI actual de V03 es prototipo/simulación local y no debe confundirse con el Ranking productivo futuro con backend.

### BRAMU Intelligence

V1 está definida como motor selectivo de insights respaldados por evidencia y **forma parte del alcance previo a la primera salida productiva**. Se implementa después de contar con identidades, partidos, Nivel y Ranking reales, y antes del endurecimiento final de Producción.

La V1 debe poder funcionar completamente con núcleo determinístico + plantillas. La capa generativa es opcional, mejorable posteriormente y solo redacta claims ya calculados; no inventa datos ni decide Nivel/Ranking.

### Experiencia inicial y ciclo de partido

`Experiencia_Inicial.md` es la fuente activa para Home Estado Cero, pendientes accionables, validación por parejas, correcciones, `No participé`, identidades provisionales y progresión temprana.

Reglas de experiencia/ciclo cerradas al 18/09/2026:

- confirmación de email diferida hasta después de Perfil mínimo + estimador;
- Perfil mínimo antes de Nivel: nombre + apellido + `@usuario` + términos;
- localidad, rama y `ranking_opt_in` se vuelven obligatorios al entrar a Ranking, no antes;
- BRAMUlab carga únicamente partidos propios ya jugados; no hay carga por espectador ni marcador en vivo dentro de esta app;
- carga retroactiva máxima: 14 días;
- pendiente nunca validado: 30 días desde la carga aceptada por servidor;
- corrección normal post-validación: 3 días;
- incidencia de identidad: hasta 10 días para abrirla + 7 días desde el reporte para identificar al jugador correcto;
- 5 pendientes accionables personales bloquean solo iniciar una nueva carga;
- offline: `sync_pending` local + reintento idempotente;
- doble carga del mismo encuentro: `create-or-attach` hacia un único `match_id` cuando la coincidencia es inequívoca;
- Ranking publicado nunca se reescribe por correcciones posteriores.

`Backend_Infraestructura.md` traduce estas reglas a servidor. No reabrir el viejo modelo `validar/rechazar`.

**Nota de alcance:** referencias históricas en fórmulas/Intelligence a partidos `observados` o cargados por espectador se consideran casos legacy/defensivos, no una función activa de BRAMUlab. Desarrollo no debe crear flujo de carga por espectador.

### Backend / Infraestructura

La dirección vigente prevé una infraestructura real y permanente, con separación Development/Staging/Production y backend basado en Supabase/Vercel según el documento maestro. Bloque 3 (Nivel productivo y persistente) está implementado, pendiente de aplicar la migración/desplegar la Edge Function y validar con cuenta real en Staging. Luego continúan Jugadores/Invitados, Partidos/Historial, Validación, Ranking, Intelligence y endurecimiento. No implementar desde antecedentes del Archivo.

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
- **“Experiencia inicial / validación / correcciones / pendientes / invitados”** → `Experiencia_Inicial.md` + `Backend_Infraestructura.md` solo para el contrato server-side.
- **“Backend / producción / cuentas reales / staging”** → `Backend_Infraestructura.md` + la sección del bloque correspondiente en `Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`.
- **“Qué falta / ideas futuras”** → `BRAMUlab_Backlog.md`.
- **“Qué pasó en una versión anterior”** → `Versiones/<versión>/..._Informe.md`; ir a la sección concreta, no cargar todo por defecto.
