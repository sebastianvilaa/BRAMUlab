# QA visual — Invitados / Identidad / Recuperación V04.29-h2

**Fecha:** 03/10/2026
**Rama:** `staging`
**HEAD funcional:** `50675a8331a12eb1db8f6ca4055097990d36d9df`
**Resultado:** PASS DEL FLUJO VISUAL (pasos 1–11, evidencia combinada Work + QA humano). Gate técnico 120 permanece PASS. Gate completo solicitado aún tiene límites de cobertura: consola/red no verificadas y dispositivo iPhone no confirmado. No declarar cierre completo de la ronda mientras esos criterios requeridos no estén verificados o Central acepte explícitamente esa limitación.

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
- Sin ledger de Nivel ni efectos de Ranking/grupos creados. Se recorrió rechazo para preservar el score vigente.

## Pasos realmente recorridos: 1–6

1. Al recargar Home de Seba apareció `ENCONTRAMOS DOS PARTIDOS QUE PODRÍAN SER EL MISMO`.
2. Ambos registros visibles: jugadores, scores distintos, fecha, hora y lugar.
3. Se tocó `SÍ, ES EL MISMO`.
4. No se observó el mensaje de unificación inmediata.
5. El árbol accesible visible mostró exactamente: `Listo. El resultado quedó pendiente de confirmación de la otra pareja.`.
6. El modal cerró y Home mostró `CORRECCIÓN ABIERTA` / `Hay una corrección abierta en este partido. Revisá el detalle.`. Tras navegar al mismo origen, persistió la corrección y no reapareció SÍ/NO. No apareció una pantalla nueva de arbitraje.

Corroboración puntual de fixture: candidate `awaiting_confirmation`, ancla validated, pending revision `1501efaf-b761-4eaf-a0eb-526dd2548a10`. No se resolvió por SQL.

## Pasos 7–11: QA humano desde la cuenta de Matu

Ante la lentitud y el bloqueo del Cloud Browser, Sebastián continuó en su navegador y declaró estar en la cuenta de Matu. Work revisó las capturas y corroboró únicamente el fixture por SQL; la resolución se ejecutó desde la UI, no desde SQL.

7–9. Matu encontró el partido pendiente y abrió el Resumen del fixture del 26/09, 18:00, con ubicación QA visual 121 · Cancha Central. Una corrección originada por duplicado se pudo responder después de más de 3 días.
10. La pantalla existente presentó:
- `RESULTADO OFICIAL ACTUAL`: Seba/Gusti 6–3 / 6–4 contra Matu/Esteban.
- `CORRECCIÓN PROPUESTA POR SEBA`: 6–4 / 6–4.
- Explicación: `Seba indica que el primer set fue 6–4, no 6–3.`.
- Acciones: `Mantener resultado cargado`, `Aceptar corrección` y `Reportar un error`.
- Sin terminología técnica de recovery/duplicate ni pantalla nueva de arbitraje.

11. Se recorrió UNA rama, rechazo:
- Sebastián tocó Mantener resultado cargado.
- El modal existente explicó que la corrección propuesta no se aplica y el resultado cargado se mantiene sin cambios.
- Confirmó MANTENER.
- Resumen final: 6–3 / 6–4, sin tarjeta de corrección.
- Ante la instrucción de recargar y abrir Historial, aportó captura del historial con `Pendientes 0` y un solo registro del fixture el 26/09, 18:00, `3–6 · 4–6` desde la perspectiva de Matu. No hay modal de duplicado visible ni estado contradictorio en esa captura.
- No se pidió aceptación adicional: ya está cubierta técnicamente en 120.

Corroboración puntual posterior: candidate `resolved_same`, `chosenScore=current`, `finalizedBy=rejected`; ancla validated y secundario annulled; ambos pending_correction_revision_id NULL. Ledger reverted 0, consistente con un fixture sin efectos de Nivel.

## Evidencia visual

- Modal inicial observado por Work: tarjetas separadas, scores destacados, metadatos legibles y CTA principal verde.
- Mensaje pendiente verificado por árbol accesible visible de Work; no se pudo guardar captura posterior por protección nativa de credenciales.
- Capturas humanas revisadas en este chat:
  - `image(20261003-173018).png` — Resumen con actual/propuesto/acciones. Referencia: `libfile_a784d19303588191bc3f9e0a288585bc`.
  - `image(20261003-173127).png` — modal de confirmación de rechazo. Referencia: `libfile_c9332dac4ab881919760d89589548a3a`.
  - `image(20261003-173228).png` — Resumen después del rechazo, sin propuesta. Referencia: `libfile_b32f59d54be08191858476c2fcf54ebd`.
  - `image(20261003-173709).png` — Historial final, Pendientes 0 y un partido efectivo. Referencia: `libfile_b21120f4418c81918ab832cfa2bf9b16`.

Las capturas tienen composición estrecha (área de app aproximada 390 px), con scores/acciones/metadatos legibles, sin solapamiento en el flujo observado. No prueban por sí solas que se ejecutó en un dispositivo iPhone; no atribuirles ese alcance.

## Consola/red y bloqueo del navegador Work

Consola y requests del recorrido no pudieron verificarse. La protección nativa de documentos con credenciales bloqueó screenshot/consola y después incluso cierre/navegación de la pestaña. No se intentó eludirla. No afirmar cero errores de consola ni ausencia de 4xx/5xx.

La app del Cloud Browser mostró repetidamente `No pudimos iniciar sesión. Probá de nuevo.` mediante acceso seguro. Sebastián reportó lag severo en control manual. Clasificación: bloqueo funcional del entorno de QA/acceso, causa no determinada; no demuestra regresión de duplicados ni error de contraseña. En su navegador pudo recorrer el fixture como Matu.

## Estado final y alcance

**Flujo visual PASS**, con ejecución de pasos 1–6 por Work y pasos 7–11 por Sebastián, capturas revisadas por Work y corroboración dirigida del fixture real en Staging.

**No cubierto:** inspección funcional de consola/red y prueba específica en iPhone. El bloque no se marca completamente cerrado sin resolver o aceptar explícitamente esos límites. No repetir el recorrido funcional ni la otra rama solo por costumbre.

Fixture resuelto y conservado como evidencia en Staging: un partido validated efectivo y secundario annulled, sin corrección fantasma. No se cambió código, migraciones, main, Production ni BRAMUlive. Supabase se tocó exclusivamente para sembrar el fixture y hacer consultas dirigidas de evidencia.
