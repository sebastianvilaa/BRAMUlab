# Handoff — nuevo chat central BRAMUlab

**Fecha:** 25/09/2026  
**Rama:** `staging`  
**Rol del chat:** coordinación central de BRAMUlab: producto + UX + arquitectura + desarrollo + revisión + documentación. Este chat NO es solo el Laboratorio UX.

## 1. Lectura obligatoria

Leer primero:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md`
4. `docs/BRAMUlab/Versiones/BRAMUlab_Backend/BRAMUlab_Backend_Informe.md`

Para el trabajo interactivo actual, además leer:

5. `docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`

No leer Archivo/Backup/handoffs históricos salvo trazabilidad específica.

## 2. Estado general actual

- Desarrollo activo: `staging`.
- NO tocar `main`, Production ni BRAMUlive sin autorización explícita.
- Bloques backend 1–8: CERRADOS en Staging.
- BRAMU Intelligence V1 A–E: CERRADA.
- F generativa: opcional/no bloqueante.
- P0.1 Estado Cero + perfiles progresivos: implementado; QA integrada en curso.
- P0.1B Ranking automático: implementado y validado.
- P0.1C Perfil editable server-backed: CERRADO EN STAGING.
- Bundle funcional actual esperado: `04.10-h31`.
- Perfil real: edición persistente, avatar privado/persistente, WhatsApp+consentimiento y privacidad pública ya pasaron QA.
- P0.2 Legal/Privacidad: pendiente de cierre/revisión legal.
- P0.3 eliminación/anonimización: decisión de producto V1 cerrada; falta consolidación/implementación operativa.
- P0.4 acceso V1 email+password: cerrado.
- P0.5/Bloque 9 hardening/salida: todavía pendiente.
- Production todavía no debe abrirse.

## 3. Método de trabajo vigente

Sebastián define producto/UX; agentes absorben ejecución técnica.

Para tareas medianas/grandes:
- consolidar primero contexto en repo;
- usar Claude Code para implementación larga;
- usar Work para navegador/QA/manual;
- Sebastián no debe copiar informes técnicos largos;
- Claude/Work deben dejar evidencia en repo cuando corresponda;
- central revisa antes de avanzar a etapas sensibles.

Evitar micro-pushes/microdeploys.
Un único push/deploy lógico por ronda cuando sea posible.
No gastar deploys en documentación.

## 4. Cuentas QA vigentes

Ocho cuentas Staging:

- Seba / `@seba_qa`
- Matu / `@matu_qa`
- Gusti / `@gusti_qa`
- Esteban / `@esteban_qa`
- Lucho / `@lucho_qa`
- Jona / `@jona_qa`
- Diego / `@diego_qa`
- Pablito / `@pablito_qa`

Método interactivo actual:
- Sebastián usa Seba desde su celular.
- Work mantiene sesión estable como Esteban.
- No cambiar de cuenta salvo necesidad.
- Un escenario por vez.
- Sebastián trae screenshots/feedback.
- Central clasifica/documenta antes de avanzar.

## 5. Escenario interactivo actual — NO RESUELTO

Work, como Esteban, ya cargó:

- Esteban + Matu vs Seba + Lucho
- 6-4, 6-3 para Esteban/Matu
- estado server-side: `pending_validation`

NO confirmar todavía.

### Bug detectado

Sebastián abrió BRAMUlab en iPhone como Seba y Home siguió mostrando Estado Cero:

- `0 partidos en tu historia`
- `CARGAR PRIMER PARTIDO`
- sin badge/notificación
- sin pendiente visible

Sin embargo, ya se verificó server-side que:

- el partido existe;
- Seba es participante;
- `get_my_matches` para Seba devuelve el partido;
- `is_action_mine=true`;
- `get_notifications` para Seba devuelve `pending_review` no leída.

Conclusión vigente:

**backend correcto; cliente stale / falta refresco de datos server-backed.**

Este hallazgo ya está documentado en:

`docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md §15`

## 6. Dirección vigente del bug actual

Clasificación:

**BUG FUNCIONAL + UX DE FRESCURA**

Antes de Production debe existir:

- refresco liviano al volver la app a foreground;
- refrescar partidos/notificaciones y estado propio relevante para Home;
- re-render de la vista actual cuando corresponda;
- throttle simple;
- NO polling continuo;
- NO incorporar Realtime solo para este caso.

Sebastián además propuso:

- pull-to-refresh en Home;
- Historial;
- Notificaciones.

Eso es complemento del refresh automático, no sustituto.

## 7. Próximo paso inmediato

Resolver primero este bug de frescura en Staging conservando el partido actual si es posible.

Después revalidar el mismo escenario:

1. Seba vuelve/abre la app;
2. el pendiente debe aparecer naturalmente sin recarga manual forzada;
3. revisar Home;
4. revisar Historial/notificaciones;
5. abrir pantalla de validación;
6. Sebastián evalúa UX/visual;
7. recién después Confirmar.

No avanzar a otro escenario mientras este estado esté roto.

## 8. Hallazgos UX ya pendientes

- Pantalla de validación/confirmación: lógica cerrada; composición visual pendiente de evaluación.
- Responsive escritorio: ancho inconsistente; evaluar después con capturas.
- Botón `+` → Cargar mi partido directo: ya definido.
- Ranking sin opt-in: ya cerrado.
- El Laboratorio integrado se coordina desde este chat central; el chat separado de Laboratorio queda como antecedente, no como centro operativo actual.

## 9. Regla para el nuevo chat central

No pedirle a Sebastián que reconstruya contexto previo.
No asumir que este chat es solo UX.
Debe coordinar TODO BRAMUlab desde este punto.

Si hace falta Claude:
- indicar MISMO CHAT o CHAT NUEVO;
- prompt completo listo para copiar;
- staging solamente;
- no main/Production/BRAMUlive;
- un único commit/push lógico;
- central revisa resultado.

Si hace falta Work:
- mantener sesión Esteban abierta;
- usarlo como navegador/QA;
- no convertirlo en implementador de cambios medianos/grandes.

## 10. Qué no hacer

- no reiniciar el laboratorio desde cero;
- no crear otro partido para reemplazar el actual si el existente sirve;
- no pedir nuevas cuentas;
- no limpiar Staging;
- no reauditar Bloques 1–8;
- no abrir Production;
- no perder el bug actual de frescura.
