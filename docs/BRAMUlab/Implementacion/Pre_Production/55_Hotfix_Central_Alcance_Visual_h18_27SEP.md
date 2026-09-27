# BRAMUlab — Hotfix Central de alcance visual h18

**Fecha:** 27/09/2026  
**Rama:** `staging`  
**Baseline:** `04.11-h17`  
**Resultado:** `04.11-h18`

Durante la revisión Central del diff h17 se detectó un desvío antes del gate visual: al mover `CORRECCIÓN PENDIENTE` al segundo renglón de Último partido, h17 movió también todos los demás estados server-backed a esa posición.

La decisión visual confirmada por Sebastián era puntual para una corrección activa. Mover también `PENDIENTE DE VALIDACIÓN`, `IDENTIDAD CUESTIONADA` y otros estados ampliaba alcance y podía generar una regresión nueva con copies más largos.

## Corrección

- `CORRECCIÓN PENDIENTE`: permanece en row2, derecha, texto ámbar sin píldora.
- demás estados: recuperan su ubicación previa debajo de fecha/hora y su tratamiento de badge.
- no se toca lógica de partido ni corrección;
- no se toca el bloque Aceptar/Rechazar;
- no se toca Reportar un error.

Bundle sube a `04.11-h18` para invalidar caché.

## Gate

`04.11-h18` es la baseline que debe usar el gate visual interno 1–11.

No declara PASS visual.
