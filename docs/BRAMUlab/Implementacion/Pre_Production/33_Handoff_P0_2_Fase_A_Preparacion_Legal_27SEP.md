# BRAMUlab — Handoff P0.2 Fase A — preparación legal/técnica para revisión profesional

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Objetivo:** aprovechar una ventana técnica independiente para dejar P0.2 preparado para revisión legal real, SIN tocar el frontend funcional `04.11-h10` ni presentar ningún texto como asesoramiento jurídico definitivo.

## 1. Fuentes obligatorias

Leer, en este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md` — P0.2 y P0.3
4. `docs/BRAMUlab/Backend_Infraestructura.md` — privacidad/Auth/eliminación/retención
5. `docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md`
6. `docs/BRAMUlab/Implementacion/Pre_Production/32_Resultado_Aplicacion_Staging_P0_3_27SEP.md`
7. contratos reales del repo que registran/leen:
   - alta/Auth;
   - aceptación de términos;
   - Perfil;
   - ubicación;
   - teléfono/WhatsApp;
   - avatar/Storage;
   - partidos;
   - Nivel;
   - Ranking;
   - Intelligence;
   - notificaciones;
   - eliminación de cuenta.

No usar Archivo/Backup/handoffs consumidos como autoridad salvo trazabilidad puntual.

## 2. Contexto de producto ya cerrado

BRAMUlab es una app de pádel amateur.

No es BRAMUlive y no incluye marcador en vivo.

Para P0.2:

- no hay monetización;
- no hay publicidad;
- no se venden datos;
- no hay IA generativa activa de usuario en esta versión;
- no inventar finalidades o tratamientos que el producto no hace;
- distinguir datos públicos dentro de BRAMU de datos privados;
- P0.3 ya define eliminación asistida, anonimización y preservación mínima de historial compartido;
- el reingreso después de eliminación crea identidad nueva, sin relink;
- no existe anti-reset por hash/HMAC/cooldown en V1.

## 3. Problema actual

El frontend vigente todavía tiene el placeholder:

`TERMS_VERSION = 'piloto_v1'`

y copy equivalente a:

`Acepto los Términos y Condiciones de BRAMU (versión piloto)`

El backend ya persiste aceptación versionada y timestamp, pero todavía faltan documentos reales y el contrato de publicación/acceso.

## 4. Alcance de ESTA fase

### A — Auditoría real de datos y finalidades

Trazar desde el código/schema actual, sin inventar:

- qué datos se recopilan;
- qué datos son obligatorios/opcionales;
- cuáles son privados;
- cuáles se muestran a otros jugadores autenticados;
- para qué se usa cada categoría de datos;
- dónde se persiste;
- qué datos se conservan al eliminar una cuenta y por qué;
- qué datos se eliminan/anónimizan;
- qué integraciones externas reales intervienen hoy (por ejemplo Supabase/Vercel/SMTP si corresponde);
- qué superficies no existen y por lo tanto NO deben aparecer en los textos.

Si una finalidad no está demostrada por el producto, no incluirla.

### B — Preparar borrador completo de Política de Privacidad V1

Crear:

`docs/BRAMUlab/Legal/Privacidad_Borrador_V1.md`

Debe ser un documento completo y legible para revisión profesional, pero encabezado claramente:

**BORRADOR DE PRODUCTO — REQUIERE REVISIÓN LEGAL ANTES DE PUBLICARSE**

Debe cubrir como mínimo:

- responsable/producto, dejando placeholder explícito cuando falte definición societaria/legal;
- datos tratados;
- finalidades reales;
- visibilidad dentro de BRAMU;
- proveedores/infraestructura realmente usados;
- conservación/eliminación;
- P0.3 y `Jugador eliminado`;
- derechos/canal de contacto;
- seguridad en términos razonables, sin promesas absolutas;
- menores/edad solo hasta donde exista decisión real;
- cambios/versionado del documento.

No inventar bases legales, plazos regulatorios, jurisdicción, razón social, domicilio, CUIT, representante, DPO ni obligaciones legales específicas no confirmadas.

Lo que requiera abogado debe quedar marcado como:

`[REVISIÓN LEGAL NECESARIA]`

Lo que requiera decisión de Sebastián/producto:

`[DECISIÓN ABIERTA]`

### C — Preparar borrador completo de Términos V1

Crear:

`docs/BRAMUlab/Legal/Terminos_Borrador_V1.md`

Mismo estado: borrador de producto para revisión legal, NO documento definitivo.

Debe reflejar únicamente funciones existentes/previstas para V1:

- cuenta e identidad;
- uso amateur;
- carga/validación/corrección de partidos;
- identidades provisionales;
- Nivel BRAMU como estimación deportiva dinámica;
- Ranking BRAMU como clasificación bajo reglas/elegibilidad;
- Intelligence basada en datos registrados;
- conducta básica e integridad de datos;
- disponibilidad/cambios razonables del servicio sin promesas comerciales inventadas;
- eliminación de cuenta;
- propiedad intelectual del producto/contenido solo de forma genérica si no hay definición jurídica final.

No inventar sanciones, indemnidades, jurisdicciones, arbitrajes, edades contractuales ni limitaciones de responsabilidad específicas como si estuvieran validadas legalmente.

### D — Matriz de decisiones abiertas para Sebastián / abogado

Crear una sección compacta dentro del resultado con solo las decisiones que realmente bloquean publicación, por ejemplo:

- titular/responsable legal del servicio;
- email/canal legal-soporte público;
- política exacta de retención donde el producto no la haya cerrado;
- tratamiento/edad mínima de menores;
- jurisdicción/ley aplicable;
- cualquier wording exigido por revisión legal.

No abrir decisiones técnicas ya cerradas.

### E — Auditoría técnica de integración futura

Sin modificar frontend, localizar exactamente:

- dónde vive `TERMS_VERSION`;
- dónde se registra `terms_version` / `terms_accepted_at`;
- pantallas/flows donde hoy aparece aceptación;
- dónde deberían enlazarse Términos y Privacidad desde alta/app;
- qué cambios mínimos serían necesarios cuando el texto legal quede aprobado.

Entregar un mapa **AGREGAR / FUSIONAR / REEMPLAZAR / NO TOCAR**.

No implementar todavía.

## 5. NO HACER

- NO tocar `bramulab/`;
- NO cambiar `04.11-h10`;
- NO modificar `TERMS_VERSION` todavía;
- NO aplicar migraciones;
- NO desplegar nada;
- NO tocar main, Production ni BRAMUlive;
- NO afirmar que los borradores cumplen la ley;
- NO hacer asesoramiento jurídico;
- NO inventar empresa/razón social/domicilio/CUIT;
- NO iniciar Bloque 9;
- NO mezclar monetización/publicidad/futuras funciones.

## 6. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`

Y los dos borradores:

- `docs/BRAMUlab/Legal/Privacidad_Borrador_V1.md`
- `docs/BRAMUlab/Legal/Terminos_Borrador_V1.md`

Actualizar `docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md` solo si hace falta convertirlo en índice/estado y evitar duplicación; no borrar trazabilidad útil.

Actualizar `Pre_Production.md` únicamente si el estado cambia de forma objetiva, dejando claro que P0.2 sigue ABIERTO hasta revisión legal + integración + QA.

Antes de terminar:

1. revisar coherencia contra código/schema real;
2. evitar afirmaciones legales no verificadas;
3. diff;
4. commit lógico único;
5. push `origin/staging`;
6. reportar DECISIONES ABIERTAS reales y siguiente paso de Central.

Esta fase puede cerrar la **preparación** de P0.2, pero nunca cerrar P0.2 completo.
