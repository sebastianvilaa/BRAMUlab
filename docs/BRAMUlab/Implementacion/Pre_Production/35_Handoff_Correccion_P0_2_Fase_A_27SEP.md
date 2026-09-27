# BRAMUlab — Handoff corrección P0.2 Fase A tras revisión Central

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Base revisada:** `5b8e4edc237011d9d48655e846bb29199b5afb3a`  
**Objetivo:** corregir contradicciones de producto/implementación encontradas por Central en los borradores legales antes de considerarlos listos para revisión profesional.

## 1. Regla de autoridad

Leer primero:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Pre_Production.md`
3. fuente maestra del sistema afectado.

Para Ranking, la fuente maestra vigente es:

`docs/BRAMUlab/Ranking_BRAMU.md`

Su actualización del **24/09/2026** prevalece sobre capas históricas del código/campos legacy:

> Ranking deja de ser opt-in. Todo jugador activo entra automáticamente al universo de Ranking cuando cumple localidad, rama, Nivel/elegibilidad, actividad e integridad. No existe opt-out ordinario. `ranking_opt_in` queda legacy y deja de decidir elegibilidad.

No usar la mera existencia de una columna/campo histórico como regla actual de producto.

## 2. Correcciones obligatorias

### A — Ranking NO es opt-in

Los borradores actuales contienen varias afirmaciones incorrectas:

- `Privacidad_Borrador_V1.md §2.8`: “Si activás la participación en Ranking (opcional, desactivada por defecto)…”
- `Privacidad_Borrador_V1.md §3`: “...si elegís participar”
- `Privacidad_Borrador_V1.md §4.1`: posición “si participás”
- `Terminos_Borrador_V1.md §2`: “participar ... si así lo elegís”
- `Terminos_Borrador_V1.md §7`: “Si elegís activar tu participación (es opcional)...”
- el resultado 34 también describe Ranking como opt-in.

**REEMPLAZAR** esas afirmaciones por la regla vigente:

- la participación es automática al cumplir elegibilidad;
- localidad y rama competitiva se piden cuando empiezan a ser necesarias para ubicar al jugador correctamente;
- un jugador CALIBRANDO puede explorar Ranking pero todavía no ocupa puesto oficial;
- no existe opt-out ordinario V1;
- `ranking_opt_in` es legacy y no debe aparecer en textos para usuarios como si gobernara el producto.

No reabrir esta decisión.

### B — “Categoría actual” NO es dato público

El borrador de Privacidad §2.2 marca:

`Categoría declarada | No | Sí (si la completaste)`

Eso contradice el contrato vigente:

- `get_public_profile` NO devuelve `profiles.current_category`;
- `app.js` documenta explícitamente que “Categoría actual” vive solo en **MIS DATOS**, no en Mi Perfil/Perfil público;
- es un dato declarativo privado del propio jugador.

**REEMPLAZAR**:

- Categoría actual → privada/no visible a otros jugadores.
- Revisar todas las apariciones derivadas (por ejemplo el resumen general de datos públicos en Privacidad §4.1) para que no vuelva a tratarse como pública.

No confundirla con la categoría histórica del onboarding/Nivel ni hacerla pública por inferencia.

### C — No inventar separación técnica/legal de BRAMUlive

Los borradores afirman cosas no cerradas por producto:

- Privacidad: BRAMUlive tendría “su propia infraestructura y aplicación” y “no comparte esta base de usuarios ni esta política”.
- Términos: BRAMUlive tendría “su propia app y sus propios términos”.

Lo único confirmado hoy es:

- BRAMUlab y BRAMUlive son **productos separados**;
- el marcador/seguimiento en vivo NO forma parte de BRAMUlab.

No está cerrada en las fuentes maestras una política definitiva de:

- cuentas compartidas o separadas;
- infraestructura compartida o separada;
- términos/política legal compartidos o separados.

**REEMPLAZAR** esas frases por algo factual y mínimo:

> “El marcador y seguimiento en vivo pertenecen a BRAMUlive, un producto separado y fuera del alcance de BRAMUlab.”

Nada más hasta que exista una definición real.

### D — Proveedor de email: no afirmar más de lo demostrado

El resultado/borrador atribuye a Supabase directamente el “envío” de correos de confirmación/recuperación.

El contrato estable que sí puede afirmarse es:

- BRAMUlab usa Supabase Auth para gestionar autenticación, confirmación y recuperación;
- la entrega de emails depende de la configuración SMTP del entorno;
- Staging/Production pueden no compartir proveedor de entrega.

Para un texto legal futuro no conviene congelar un proveedor SMTP antes de cerrar Production.

**FUSIONAR** una redacción no engañosa:

- Supabase = proveedor de autenticación;
- correo de confirmación/recuperación = enviado a través de la infraestructura de email configurada para el servicio;
- marcar proveedor SMTP/ubicación como dato a confirmar antes de publicar si corresponde incluirlo legalmente.

No inventar Gmail/Resend/SendGrid/etc. en el borrador final de producto.

## 3. Barrido obligatorio

Después de corregir los cuatro puntos, hacer un grep/barrido completo de:

- `Privacidad_Borrador_V1.md`
- `Terminos_Borrador_V1.md`
- `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`
- nota de estado de `02_Borrador_Legal_Privacidad_V1.md`
- bloque P0.2 de `Pre_Production.md`

para detectar cualquier otra frase derivada de:

- opt-in de Ranking;
- categoría actual pública;
- infraestructura/cuentas/términos propios de BRAMUlive;
- proveedor de envío de email asumido.

Si aparece otra contradicción con una fuente maestra vigente, corregirla y documentarla. No ampliar alcance a “mejoras de redacción” generales.

## 4. Mantener intacto

- no tocar frontend;
- no tocar `TERMS_VERSION`;
- no aplicar migraciones;
- no desplegar;
- no tocar main/Production/BRAMUlive;
- no cerrar ninguna de las 8 decisiones legales/humanas ya identificadas;
- no hacer asesoramiento legal;
- no afirmar cumplimiento normativo.

## 5. Entrega

Crear:

`docs/BRAMUlab/Implementacion/Pre_Production/36_Resultado_Correccion_P0_2_Fase_A_27SEP.md`

Debe indicar:

- cada contradicción corregida;
- fuente maestra que resolvió el conflicto;
- cualquier otra contradicción encontrada en el barrido;
- archivos modificados;
- confirmación de 0 cambios en `bramulab/`;
- decisiones abiertas que siguen pendientes.

Actualizar los borradores directamente; todavía son borradores de producto para revisión profesional.

Antes de terminar:

1. revisar diff;
2. commit lógico único;
3. push `origin/staging`.

No marcar P0.2 cerrado.
