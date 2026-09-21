# Backend Bloque 5 — Revalidación dirigida de navegador en Work

**Fecha:** 21/09/2026  
**Rama:** `staging`  
**HEAD esperado:** `02dafa1` o superior  
**Bundle esperado:** `04.10-h15`

## Objetivo

Revalidar únicamente los 4 puntos corregidos después de la primera QA real de Work.

NO repetir toda la batería de Bloque 5.
NO desarrollar.
NO modificar código, Supabase, Vercel, main, Production, BRAMUlive ni Bloque 6.

Si un punto falla, documentar reproducción exacta y continuar los demás.

---

## 1. Entorno

Abrir la Preview/Staging real de BRAMUlab.

Confirmar:

- deployment de `staging` asociado a `02dafa1` o superior;
- bundle `04.10-h15`;
- no Production.

Si el deployment todavía no refleja el HEAD nuevo, esperar/recargar la Preview correspondiente; no tocar configuración de Vercel.

---

## 2. Revalidación B5-WORK-01 — homónimos reales

Usar la misma sesión `@sebas`.

Desde Cargar partido:

- seleccionar dos o más usuarios reales distintos que compartan el mismo nombre visible `Prueba`, si siguen disponibles;
- caso preferido: `@claimb4h11` + `@normalb4h11` + `@claim_mualea_20`, siempre que la búsqueda los ofrezca;
- completar los cuatro slots con `player_id` distintos.

PASS si:
- la UI permite continuar;
- NO aparece `Hay un jugador repetido en el partido` por compartir display name;
- sigue bloqueando correctamente si se intenta elegir exactamente el mismo usuario/player_id dos veces.

No guardar el partido si no hace falta para validar este bug.

---

## 3. Revalidación B5-WORK-02 — hora desconocida

Crear un partido QA nuevo solo si hace falta para validar el render final.

Usar:
- fecha dentro de 14 días;
- hora borrada;
- lugar: `QA B5 Work h15`;
- resultado válido;
- participantes QA existentes.

Después de guardar:

PASS si:
- Resumen no muestra hora inventada;
- Historial muestra solo la fecha, sin `00:00`;
- tras refresh sigue sin `00:00`.

---

## 4. Estado visible en Último partido

Sobre ese mismo partido pendiente:

PASS si Home muestra:
- el partido como Último partido;
- resultado descriptivo;
- badge/estado `PENDIENTE DE VALIDACIÓN`.

No debe aparecer como `VALIDADO` ni `OFICIAL`.

Confirmar rápidamente que Nivel, 0/5 o métricas oficiales no cambiaron respecto del baseline visible previo.

---

## 5. Copy correcto de la acción

Abrir el detalle del partido server-backed.

PASS si el botón visible dice:

`OCULTAR PARTIDO`

y la confirmación explica que solo se oculta para el usuario actual.

No hace falta pulsarlo si eso complica comparar después.

Si se abre un outbox/sync_pending naturalmente, el copy esperado es `DESCARTAR CARGA`.
El camino local legacy mantiene `ELIMINAR PARTIDO`.

No forzar esos dos casos si no están disponibles naturalmente.

---

## 6. Evidencia mínima

No hace falta repetir:
- nota privada;
- persistencia general;
- RLS;
- concurrencia;
- idempotencia;
- ambigüedad;
- límite de 5;
- offline;
- segundo participante.

Solo registrar:
- deployment/HEAD;
- bundle;
- PASS/FAIL de los 4 puntos;
- cualquier bug nuevo;
- cualquier dato QA nuevo creado.

---

## 7. Reporte

Si Work tiene escritura en repo, crear:

`docs/BRAMUlab/Implementacion/Backend/Bloque_05/15_Revalidacion_Dirigida_Work.md`

Commit/push únicamente a `staging`.

Si no puede escribir, devolver el informe completo en el chat.

Después detenerse.
