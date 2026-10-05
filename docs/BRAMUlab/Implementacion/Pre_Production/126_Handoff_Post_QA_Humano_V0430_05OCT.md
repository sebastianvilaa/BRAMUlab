# 126 — Handoff post QA humano V04.30

**Fecha:** 05/10/2026  
**Rama única:** `staging`  
**HEAD funcional previo:** `824f6a825758114f88ee45a4780876647fdc4a36`  
**Tracking:** Issue #29  
**Estado:** QA humano exploratorio suficiente. Corregir primero; después retest humano corto.

## Fuentes y límites

Leer primero:
1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. `docs/BRAMUlab/BRAMU_Intelligence.md`
5. `docs/BRAMUlab/Implementacion/Pre_Production/125_Resultado_Correcciones_QA_Invitados_04OCT.md`
6. este handoff
7. Issue #29 completo

NO tocar `main`, Production, BRAMUlive, Nivel, Ranking publicado, Grupos ni Legal salvo regresión concreta dentro de este alcance.

## PASS humanos — no repetir antes de implementar

- alias provisional → identidad real;
- homónimos provisionales no se auto-fusionan;
- selector `Sin cuenta · jugó con X · fecha` funciona;
- cuenta real ya no queda bajo heading de sin cuenta;
- self-report propio deja `Por identificar` sin pedir reemplazo;
- límite duro de 5 pendientes accionables funciona;
- B1 desde UI: corrige el match concreto y no el homónimo;
- claim con cuenta existente abre `PARTIDOS RECUPERADOS`;
- conflicto de identidad mismo match falla cerrado;
- nombre provisional distinto del nombre real puede resolverse;
- claim reemplaza provisional por identidad real en score/Historial;
- deduplicación V04.29 no mostró regresión.

## BUG 1 — alta nueva + claim saltea PARTIDOS RECUPERADOS

Caso Federico → Fede:
- alta nueva desde invitación;
- onboarding + OTP;
- `¿SOS FEDERICO?` → `SOY YO`;
- backend recuperó correctamente **2 partidos**;
- uno validado computó correctamente en calibración;
- pero frontend fue directo al Home y **no abrió `PARTIDOS RECUPERADOS`**.

Contraste: con cuenta existente (Seba reclamando Bruno), la pantalla sí abre.

Central trazó como causa probable que la revisión pendiente de recuperados queda asociada al identificador disponible antes de terminar de oficializar/sincronizar la cuenta nueva y luego no se encuentra con la identidad canónica.

**Esperado:** alta nueva + claim debe abrir la misma superficie de recuperados que una cuenta existente, sin duplicar recovery ni perder match IDs.

## BUG 2 — BRAMU Intelligence conserva nombres provisionales viejos

Después de resolver `Bruno → Seba`, el partido muestra correctamente `Pedro / Seba vs Esteban / Fede`, pero Intelligence sigue nombrando a `Bruno` (también se observaron textos viejos con `federico`).

**Esperado:** al resolver identidad, Intelligence debe invalidar/recalcular o renderizar contra la identidad canónica actual para todas las perspectivas del match.

No inventar insights nuevos; corregir únicamente nombres/evidencia.

### Visual Intelligence
La aclaración de partido pendiente debe tener la misma jerarquía sutil que el subtítulo “Una lectura objetiva…”, con más aire después de `+ POR QUÉ APARECEN ESTOS INSIGHTS`.

## PARTIDOS RECUPERADOS — UX confirmada

La separación conceptual sigue siendo:
1. identidad;
2. participación;
3. resultado.

Pero no forzar tres pasos.

### Partido ya validado
- izquierda: `NO, NO LO JUGUÉ` — outline rojo;
- derecha: `SÍ, LO JUGUÉ` — verde.
Confirmar participación no revalida resultado.

### Partido pendiente y accionable
No usar:
`SÍ, LO JUGUÉ` → `Participación confirmada` → `CONFIRMAR O CORREGIR EL RESULTADO`.

Usar directamente acciones canónicas:
- `NO, NO LO JUGUÉ` → self-report propio;
- `REPORTAR UN ERROR` → flujo existente;
- `VALIDAR PARTIDO` → implica que participó y el resultado está bien.

Mantener negativo a la izquierda / positivo a la derecha. Si hay estado `✓ Participación confirmada`, integrarlo discretamente en la card. Evitar un `LISTO` gigante que compita con acciones.

### Volver a la revisión
Mientras haya recuperados cuya participación no fue revisada, Home debe poder mostrar en el carrusel algo tipo:
`REVISÁ TUS PARTIDOS RECUPERADOS`.

Al terminar participaciones, desaparece. Las validaciones de resultado pendientes vuelven al circuito normal Home/Historial/Notificaciones.

## ¿SOS X? / conflicto

Copy:
- `SÍ, SOY YO`;
- `NO, NO SOY YO`.

Semántica:
- sí verde;
- no outline rojo.

Preview de 1 partido + `y N partidos más`: suficiente.

Cuando se detecta conflicto porque la cuenta ya ocupa otro slot del mismo partido, no dejar el modal atrapado con `SOY YO / NO SOY YO`.
Mostrar estado corto:
`No podés vincular esta identidad porque ya figurás en uno de sus partidos.`
CTA `ENTENDIDO` o `VER PARTIDO`.

## Invitación — copy confirmado

REEMPLAZAR:
- `COPIAR ENLACE` → `COPIAR INVITACIÓN`;
- `Enlace copiado. Enviáselo a X.` → `Invitación copiada. Enviásela a X.`.

Si la identidad ya no está disponible para invitar, no dejar una CTA activa que parezca válida.

## Alta — @usuario

Contraseñas coincidentes: PASS.

@usuario:
- válido → ✓ verde compacto asociado al campo; no texto `Disponible` pegado a la línea;
- inválido → ✕ roja + explicación debajo;
- mejorar margen entre underline y mensaje;
- no cambiar reglas reales.

## Límite de pendientes — UX nueva

Regla dura:
- 5 pendientes accionables ⇒ bloqueo.

Progresión:
- 1–2: no avisar;
- 3: aviso + `VER PARTIDOS PENDIENTES` + `OMITIR`;
- 4: igual;
- 5: bloquear, `RESOLVÉ AL MENOS UNO PARA CONTINUAR`, sin omitir.

Copy simple:
`Tenés 3 partidos que esperan una respuesta tuya.`

Solo cuentan pendientes donde la pareja del usuario debe responder. No contar espera del otro lado ni una identidad cuestionada post-validación solo por existir.

El CTA debe llevar a Historial priorizando **pendientes accionables**, no mezclar arriba pendientes en espera. Reutilizar Historial, no crear bandeja paralela.

## NUEVA DECISIÓN DE PRODUCTO — permitir 1 cuenta + 3 provisionales

Se reemplaza la restricción histórica de `1 usuario por pareja`.

**Confirmado:** un partido puede cargarse con **1 sola cuenta registrada total + 3 personas sin cuenta**.

Ejemplo:
- Esteban + provisional A
- vs provisional B + provisional C.

Queda pendiente hasta que una contraparte válida pueda responder/validar.

Motivo: exigir una cuenta por pareja frena el caso de uso central y la expansión orgánica.

Claude debe localizar todos los lugares donde la regla vieja esté codificada/documentada, reemplazarla por el contrato mínimo coherente de al menos 1 cuenta por partido, revisar seguridad/action-side/claim/validación e incorporar tests específicos.

No improvisar auto-validación.

## Historial estado cero

Mejora aprobada de bajo riesgo: reutilizar la card de Home
`TODO EMPIEZA CON TU PRIMER RESULTADO`
con CTA de primer partido también en Historial cuando hay 0 partidos.

## Notificaciones — revisión humana

### BUG confirmado
Todavía aparece:
`Alguien indicó que no participó en este partido`
aunque el actor es conocido.

Esperado:
`Julián indicó que no participó en este partido`
o equivalente actor-específico. Debe seguir abriendo Resumen/RESOLVER.

### Pendiente accionable vs espera
`Partido pendiente` es demasiado genérico.
Alinear con Home:
- usuario debe actuar → `PARTIDO POR VALIDAR`;
- usuario espera al otro lado → `ESPERANDO VALIDACIÓN`.

### Claim exitoso
Útil cerrar loop:
`Seba ya se sumó a BRAMU y recuperó sus partidos.`

Implementar solo si encaja limpiamente en el contrato server-side actual y el destinatario es inequívoco. Si exige subsistema nuevo, dejar `DECISIÓN ABIERTA` y no bloquear.

### NO SOY YO
No implementar ahora salvo solución segura obvia: el link puede circular y el rechazo no prueba identidad del actor. Mantener como residual/futuro.

## JUGADORES SIN CUENTA

Con 1–2 provisionales la card actual es razonable. No rehacer sin evidencia.
Al habilitar 1+3, revisar visualmente el caso con 3. Evitar cards anidadas. La idea de agrupar todos en una sola pastilla NO está cerrada.

## Qué NO tocar / reabrir

- B1/B2/B3/C1/C2 salvo regresión;
- deduplicación V04.29;
- Nivel/Ranking;
- Grupos/Legal;
- main/Production/BRAMUlive.

## Implementación

### AGREGAR
- continuidad de recuperados para alta nueva;
- acceso desde carrusel mientras falten participaciones;
- warnings 3/4;
- soporte 1 cuenta + 3 provisionales;
- tests de canonicalización de Intelligence.

### FUSIONAR
- recuperados con Validar/Reportar/self-report existentes;
- claim con refresh de Intelligence;
- gate con Historial accionable;
- notificación self-report con actor real.

### REEMPLAZAR
- pasos redundantes de recuperados accionables;
- conflicto atrapado en modal;
- `COPIAR ENLACE`;
- regla 1 cuenta por pareja;
- nombres provisionales stale en Intelligence.

## Pruebas mínimas posteriores

1. alta nueva + claim → abre recuperados;
2. varios recuperados (validado + pendiente);
3. cuenta existente + claim;
4. pending recuperado → validar directo;
5. validado recuperado → participación sí/no;
6. carrusel reabre revisión incompleta;
7. claim actualiza nombres en Intelligence;
8. self-report notifica actor real;
9. 3/4/5 pendientes warn/warn/block;
10. gate lleva a accionables;
11. crear match con 1 cuenta + 3 provisionales;
12. claim posterior de uno y validación coherente;
13. conflicto mismo match sigue fail-closed;
14. regresión B1 mínima;
15. suite completa pertinente.

Después, QA humano corto. No repetir la maratón exploratoria.

## Salida esperada

Trabajar autónomamente en `staging`. Si aparece una decisión humana nueva, marcar `DECISIÓN ABIERTA` y continuar el resto.

Al final:
- preferir un único push funcional;
- migraciones solo si son necesarias y primero Staging;
- actualizar README + Experiencia_Inicial + BRAMU_Intelligence si corresponde;
- actualizar Issue #29;
- crear informe de resultado siguiente;
- informar HEAD, archivos, backend, tests, decisiones abiertas y QA humano mínimo.

**Production sigue prohibida.**
