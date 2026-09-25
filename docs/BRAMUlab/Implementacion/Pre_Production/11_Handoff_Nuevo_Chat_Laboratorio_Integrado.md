# Handoff — nuevo chat central / Laboratorio UX integrado

**Fecha:** 25/09/2026  
**Rama:** `staging`  
**Objetivo:** continuar el Laboratorio UX integrado sin reconstruir contexto manualmente.

## 1. Lectura obligatoria

Leer primero:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Pre_Production.md`
3. `docs/BRAMUlab/Experiencia_Inicial.md`
4. `docs/BRAMUlab/Implementacion/Pre_Production/05_Laboratorio_UX_Uso_Real.md`

Después consultar solo la fuente maestra del sistema afectado.

## 2. Estado técnico vigente

- Bloques backend 1–8 cerrados en Staging.
- P0.1 Estado Cero/perfiles progresivos implementado.
- Ranking automático implementado y validado.
- P0.1C Perfil editable server-backed CERRADO EN STAGING.
- Bundle actual esperado: `04.10-h31`.
- Avatar privado/persistente + WhatsApp/consentimiento + privacidad pública: QA real PASS.
- No tocar `main`, Production ni BRAMUlive.

## 3. Cuentas QA

Set de ocho cuentas:

- Seba / `@seba_qa`
- Matu / `@matu_qa`
- Gusti / `@gusti_qa`
- Esteban / `@esteban_qa`
- Lucho / `@lucho_qa`
- Jona / `@jona_qa`
- Diego / `@diego_qa`
- Pablito / `@pablito_qa`

Método operativo vigente:

- Sebastián usa **Seba** desde su celular.
- Work mantiene sesión estable como **Esteban**.
- No cambiar de cuenta salvo necesidad explícita.
- Probar un escenario por vez.
- Sebastián trae screenshots/feedback; ChatGPT central clasifica y documenta antes de avanzar.

## 4. Escenario actual — 1A

Work, como Esteban, ya cargó UN partido:

- Pareja 1: Esteban + Matu
- Pareja 2: Seba + Lucho
- Resultado: 6-4, 6-3 para Esteban/Matu
- Estado server-side: `pending_validation`

**No confirmar todavía.**

## 5. Problema NO resuelto que bloqueó el escenario

Sebastián abrió BRAMUlab en iPhone como Seba y siguió viendo Home Estado Cero:

- `0 partidos en tu historia`
- `CARGAR PRIMER PARTIDO`
- sin badge/notificación visible
- sin indicio del pendiente accionable

Sin embargo, la verificación server-side ya confirmó que:

- el partido existe;
- Seba está correctamente asociado como participante;
- `get_my_matches` para Seba devuelve ese partido;
- `is_action_mine=true`;
- `get_notifications` para Seba devuelve una notificación derivada `pending_review` no leída.

Conclusión: **backend correcto; cliente stale / falta de refresco.**

La documentación ya registra este hallazgo en `05_Laboratorio_UX_Uso_Real.md §15`.

## 6. Dirección vigente para resolverlo

Clasificación:

**BUG FUNCIONAL + UX DE FRESCURA.**

Obligatorio antes de Production:

- refresco liviano de datos server-backed al volver la app a foreground;
- como mínimo partidos + notificaciones + estado propio que afecte Home;
- re-render solo de la vista relevante;
- throttle simple para evitar llamadas repetidas;
- NO polling continuo;
- NO introducir Realtime solo para este caso.

Además, Sebastián propuso un patrón UX natural:

- **pull-to-refresh** en Home;
- Historial;
- Notificaciones.

El pull-to-refresh es complemento, no sustituto del refresh automático al volver a foreground.

## 7. Próximo paso recomendado

Antes de continuar el escenario 1A:

1. revisar el código vigente de refresco/foreground;
2. preparar un cambio técnico ACOTADO para resolver frescura;
3. implementarlo primero en Staging;
4. revalidar que, sin recarga manual ni navegación forzada, Seba vea el pendiente al volver/abrir la app;
5. recién después continuar con:
   - Home;
   - Historial/notificación;
   - pantalla de validación;
   - feedback visual de Sebastián;
   - Confirmar.

No limpiar el partido actual ni crear otro si puede conservarse para revalidar el mismo caso.

## 8. Hallazgos UX ya pendientes para observar durante el laboratorio

- Pantalla de validación/confirmación: lógica confirmada, composición visual pendiente.
- Responsive escritorio: ancho inconsistente; revisar luego con capturas.
- Botón `+` debe ir directo a Cargar mi partido; ya definido.
- Ranking sin opt-in; ya cerrado.

## 9. Regla de coordinación

No pedirle a Sebastián que reconstruya conversaciones anteriores.

Si hace falta Claude Code:

- preparar prompt completo listo para copiar;
- indicar **MISMO CHAT** o **CHAT NUEVO**;
- trabajar en `staging`;
- un solo commit/push lógico;
- no gastar deploys en documentación o micropruebas.

Work queda como contraparte de navegador, no como sustituto de Claude para una corrección técnica mediana.
