# 144 — Hotfix visual V04.37-h2 · Evolución + avatares de Ranking

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base:** `529cd65065d12a188744b264f06e987268cf7c1c`  
**Objetivo:** BRAMUlab V04.37 / bundle `04.37-h2`  
**NO TOCAR:** `main`, Production, BRAMUlive.

## Contexto

V04.37 pasó gate técnico Central. QA humano posterior confirmó:
- Actividad: PASS.
- Race anual: PASS; movimientos ↑/↓ visibles y coherentes.
- Evolución real: datos/copy/Intelligence PASS, pero el trazo visual no coincide con la dirección ya aprobada.
- Ranking: bug visual real, los jugadores con foto muestran iniciales.

## 1. Evolución del Nivel — ajuste visual

Decisión humana:
- la línea del gráfico debe ser **azul/celeste BRAMU** (`--accent-cyan: #199FFF`), no lima;
- debe verse **suavizada**, no como una polilínea de dientes/picos rectos.

Implementación:
- conservar EXACTAMENTE los mismos puntos/datos/ejes;
- no agregar ni quitar observaciones;
- no alterar cálculo de Nivel, change30, peak ni Intelligence;
- generar un path suavizado que pase por los puntos reales;
- preferir interpolación monotónica / curva que evite overshoot visual fuera del rango de los puntos;
- no usar una suavización que invente máximos/mínimos;
- conservar línea limpia, sin dots/tooltips;
- conservar animación de entrada vigente.

CSS:
- `.evolution-chart__line` debe usar `var(--accent-cyan)`.

## 2. Ranking — avatares reales

Bug observado:
- Ranking server-backed muestra iniciales (S/E/M/G/J...) aunque esos jugadores tienen foto real visible en Home, Perfil y Grupos.

Causa a verificar en código:
- `buildRankingRowHTML` / `buildUnrankedRowHTML` llaman `buildGroupAvatarHTML(...)` sin identidad/avatar resuelta para las filas de Ranking.
- No asumir que el cache de Grupos esté cargado al abrir Ranking.

Fix esperado:
- resolver avatares de los `playerId` visibles del Ranking mediante `Auth.getPlayersCompact` o el contrato batch vigente;
- una sola carga batch/cacheada, **nunca N+1 por fila**;
- usar la foto firmada real cuando exista;
- fallback a iniciales cuando realmente no exista foto;
- cubrir clasificación territorial y Mi red / filas sin posición si usan el mismo render;
- no tocar posición, Nivel, movimiento, filtros ni lógica del Ranking.

No acoplar la corrección a haber visitado antes Mis Grupos.

## 3. Pruebas

Focales mínimas:
- Evolución: path suave conserva endpoints y pasa por los puntos sin overshoot; color cyan;
- ningún cálculo de serie cambia;
- Ranking con avatar URL real renderiza `img`;
- Ranking sin avatar conserva iniciales;
- resolución de avatares es batch, no N+1;
- navegación/Ranking existente intacta.

Suite Node + `release-check`.

## 4. QA humano final

Solo una captura de:
- Mi Perfil > Evolución;
- Ranking con al menos Seba/Matu/Gusti mostrando sus fotos reales.

Si ambas pasan, V04.37 se cierra.

## 5. Entrega

- bundle `04.37-h2`, sin cambiar versión visible V04.37;
- resultado corto en `145_Resultado_Hotfix_V0437_h2_...`;
- un único push razonable a `origin/staging`;
- sin migración.
