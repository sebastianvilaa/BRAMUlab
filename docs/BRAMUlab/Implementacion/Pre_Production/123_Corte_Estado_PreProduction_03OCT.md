# 123 — Corte de estado Pre-Production

**Fecha:** 03/10/2026  
**Rama:** `staging`  
**HEAD de entrada:** `5134924cdd6dfd3087a91e7b4ee7b45b921f464e`  
**Objetivo:** reemplazar el mapa de pendientes histórico por una foto verificable del estado real antes de Production.  
**No toca:** código de producto, Supabase, `main`, Production ni BRAMUlive.

## Conclusión

BRAMUlab no necesita otro bloque grande de producto antes de Production.

### Cerrado en Staging

- Backend Bloques 1–8.
- Nivel BRAMU V1.3.
- Ranking BRAMU V1.
- BRAMU Intelligence V1 determinística.
- Cargar partido V04.27.
- Perfil editable.
- Pre-Bloque 9, Bloque 9A y 9B.
- G1 Emails/Auth V1.
- G2 Configuración/Acceso/Legal, incluido PASS humano final en iPhone.
- P0.3 Eliminación de cuenta: E2E destructivo real ejecutado durante G1.
- Invitados / Identidad / Recuperación V04.29: cierre Central 122.

### Implementado pero con cierre QA residual

1. **P0.1/P0.1B — primera experiencia:** el código vigente ya implementa estados sin datos honestos y participación automática de Ranking. Falta solo un recorrido integrado corto para dejar el cierre formal documentado.
2. **Grupos — Issue #23:** top 2/Americano están implementados y el QA integral base del Issue #6 ya cerró. Queda únicamente QA humana final de la ayuda/desglose V04.24. No reabrir backend ni fórmula.

### Dependiente de Production real

P0.2 no puede cerrarse publicablemente hasta conocer y registrar la realidad de Production. Los HTML públicos conservan placeholders explícitos y el build guard bloquea Production mientras existan.

Datos pendientes reales:
- fecha de vigencia;
- nombre/domicilio publicables del responsable desde fuente privada;
- registro/constancia AAIP-RNBDP;
- proveedor/región reales de base/Auth;
- hosting/región efectiva cuando corresponda;
- proveedor de email transaccional de Production;
- mecanismo real de transferencias internacionales;
- ciclos reales de backups/logs.

Después de los QA residuales, los gates reales son:
- **G3:** autorización explícita + creación/configuración de Production limpia;
- **G4:** plan/región/retención/backups/restauración gestionada de Production + completar legal con esa realidad.

## Smoke adicional de Invitados informado por Sebastián

Además del cierre 122, el 03/10 Sebastián hizo un recorrido espontáneo de uso real en Staging:

- creó un partido con un invitado;
- abrió el Resumen y encontró el CTA de invitación;
- copió el enlace;
- en otra computadora, sin cuentas abiertas, abrió el enlace y creó una cuenta nueva;
- al terminar el alta BRAMU preguntó si era la identidad invitada;
- respondió `SOY YO`;
- la cuenta nueva recuperó partidos previos asociados a esa provisional (observó dos);
- validó uno de esos partidos y quedó validado tanto para la cuenta recuperada como para Seba;
- al volver a seleccionar jugadores desde Seba, la identidad ya aparece como cuenta registrada, no como invitado.

Esto se registra como **smoke humano adicional**, no como sustituto de los gates técnicos ya cerrados ni como afirmación sobre casos no recorridos.

## Próximo orden

1. Sebastián puede seguir explorando Invitados buscando fricciones reales; Central lo acompaña y solo abre bug si aparece una regresión concreta.
2. Cerrar P0.1/P0.1B con un QA integrado corto.
3. Cerrar Issue #23 con QA humana dirigida de Grupos.
4. Recién después decidir G3/G4.
5. Production arranca limpia y primero la usa Sebastián; no se invita a terceros hasta smoke real de Production.

## Tracking después de la consolidación

Ejecutado el 03/10/2026:

- **#28 — Pre-Production final — residuales QA + G3/G4:** nuevo tracking único vigente para la salida.
- **#27:** cerrado completed después de incorporar rotación preventiva a `Metodo_Trabajo.md`.
- **#16:** cerrado completed; V04.20 quedó consumido por G1/G2 posteriores.
- **#18:** cerrado duplicate; #19 ya cerró 9A.
- **#4 y #10:** cerrados como tracking histórico/superado; **esto no significa P0.2 publicable cerrado**. El remanente Legal vive en fuente maestra + #28.
- **#23:** permanece abierto hasta PASS humano final de ayuda/desglose V04.24.
- **#15:** permanece abierto únicamente como backlog P1 no bloqueante del atajo `+ AGREGAR JUGADOR` con grupo <3; el icono iOS ya fue PASS en G2.
