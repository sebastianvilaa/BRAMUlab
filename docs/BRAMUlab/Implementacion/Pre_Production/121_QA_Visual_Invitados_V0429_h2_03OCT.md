# QA visual — Invitados / Identidad / Recuperación V04.29-h2

**Fecha:** 03/10/2026
**Rama:** `staging`
**HEAD funcional:** `50675a8331a12eb1db8f6ca4055097990d36d9df`
**Resultado:** PARCIAL / BLOQUEADO EN ACCESO DE LA PAREJA CONTRARIA. No declarar PASS completo ni FAIL del flujo de duplicados. Gate técnico 120 permanece PASS; gate visual pendiente.

## Entorno y avance

Leídos README, Método de Trabajo, 119 y 120. Deployment Vercel `dpl_Ab8f2g8ohmxwEF3Y46wgG1We8Lmq`: Ready, Preview, staging, commit funcional esperado. App real: `https://bramulab-git-staging-bramu-lab.vercel.app/`. Versión visible V04.29.

El acceso seguro inicial devolvió un error genérico. Sebastián consiguió iniciar sesión manualmente como `@seba_qa`; esa sesión se verificó en Home. No se leyeron ni conservaron credenciales.

## Fixture exclusivo del QA

Preparado en Supabase `bramulab-staging` (`serxtivkfnptzurnvewg`), tras comprobar `app_config.environment = staging`.

- Ancla: `a1290001-0000-4000-8000-000000000001`.
- Secundario: `a1290001-0000-4000-8000-000000000002`.
- Candidate: `a1290001-0000-4000-8000-000000000003`.
- Seba/Gusti contra Matu/Esteban.
- Fecha: 26/09/2026, 18:00 Argentina; validated_at 26/09, 19:00 y 19:01. Más de 3 días.
- Lugar: `QA visual 121 · Cancha Central`.
- Scores: `6–3 / 6–4` y `6–4 / 6–4`.
- Dos partidos validated y candidate open, sembrados exclusivamente para el seam visual. recovery_id NULL (admitido por esquema); no simula un claim ni reevalúa recuperación de identidad. Participantes/fingerprint/revisiones/sets/acción created completos.
- Sin ledger de Nivel ni efectos de Ranking/grupos creados. Se planeó rechazo para preservar el score vigente.

## Pasos realmente recorridos: 1–6

1. Al recargar Home de Seba apareció `ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO`.
2. Ambos registros visibles: jugadores, scores distintos, fecha, hora y lugar.
3. Se tocó `SÍ, ES EL MISMO`.
4. No se observó el mensaje de unificación inmediata.
5. El árbol accesible visible mostró exactamente: `Listo. El resultado quedó pendiente de confirmación de la otra pareja.`.
6. El modal cerró y Home mostró `CORRECCIÓN ABIERTA` / `Hay una corrección abierta en este partido. Revisá el detalle.`. Tras navegar al mismo origen, persistió la corrección y no reapareció SÍ/NO. No apareció una pantalla nueva de arbitraje.

Corroboración puntual de fixture: candidate `awaiting_confirmation`, ancla validated, pending revision `1501efaf-b761-4eaf-a0eb-526dd2548a10`. No se resolvió por SQL.

## Evidencia visual y límites

El modal fue observado en screenshot: tarjetas separadas, scores destacados, metadatos legibles y CTA principal verde. Se guardó captura temporal `bramu-qa121-01-duplicado.jpg`. Su guardado persistente falló (transfer_failed); no depender de ese archivo para continuar.

La captura posterior y la lectura de consola fueron impedidas por la protección nativa de documentos con credenciales. El estado posterior se obtuvo del árbol accesible sanitizado. No se intentó eludir esa protección.

Viewport móvil/iPhone: NO verificado. Consola/red funcional: NO verificadas; no afirmar ausencia de errores ni de 4xx/5xx.

## Bloqueo actual: paso 7

Se cerró únicamente la sesión local de Seba mediante Configuración → Cerrar sesión; no se cerraron todas las sesiones.

La pareja contraria requiere la cuenta de Matu o Esteban. Los intentos mediante browserAuth devolvieron `No pudimos iniciar sesión. Probá de nuevo.`; un formulario intermedio fue declined y no se reintentó hasta petición expresa. Sebastián reportó lentitud que impedía escribir en el control manual y pidió reabrir el modo seguro. El último formulario seguro fue submitted, pero la app siguió en login con el mismo error genérico.

**Esperado:** Home autenticado de la otra pareja.
**Obtenido:** login con error genérico.
**Clasificación:** bloqueo funcional de acceso del navegador QA, causa no determinada. No atribuirlo a contraseña ni afirmar regresión de duplicados.

## Pendiente y continuación

No crear otro fixture ni repetir pasos 1–6. Resolver acceso a Esteban o Matu y continuar pasos 7–11: localizar la corrección histórica, verificar score actual/propuesto y acciones existentes, rechazar UNA vez y comprobar cierre sin fantasmas, modal repetido ni segundo partido efectivo. Completar evidencia de consola/red y viewport móvil cuando el navegador lo permita.

El fixture permanece en Staging con corrección pendiente para esa continuación. No se cambió código, migraciones, main, Production ni BRAMUlive. Supabase se tocó exclusivamente para insertar el fixture. La documentación de estado general permanece abierta.
