# 147 — Handoff de cambio de chats · Pre-G3 Production

**Fecha:** 06/10/2026  
**Rama activa:** `staging`  
**HEAD al crear este handoff:** `c0b98a445728e973df1ef448acb9320f440e874c`  
**Estado:** todos los residuales funcionales/visuales previos a G3 están cerrados. **Production sigue NO autorizada.**

## 1. Estado ejecutivo

BRAMUlab está listo para pasar de cierre de Staging a preparación de **G3 Production**, pero ningún agente debe tocar Production hasta que Sebastián dé autorización explícita en el nuevo chat Central.

Cierres vigentes:
- V04.35 Invitados/Identidad/Recuperados/Pendientes: CERRADA / PASS Central.
- hardening exposición/IP 139: CERRADO / PASS Central.
- V04.36 Anular carga + identidad visual: CERRADA / PASS Central.
- R2 Grupos / Issue #23: CERRADO / PASS humano.
- V04.37 Actividad histórica + Evolución real + movimiento Race: CERRADA / PASS Central.
- R1 P0.1/P0.1B Estado Cero / primer partido / Perfil / Ranking automático: CERRADO / PASS Central.
- Issue #28 queda como tracking de salida y debe continuar desde este estado.

Documento más reciente de R1:
`docs/BRAMUlab/Implementacion/Pre_Production/146_Cierre_R1_Estado_Cero_Primer_Partido_06OCT.md`.

## 2. Fuentes que el nuevo ChatGPT Central debe leer

En este orden:

1. `docs/BRAMUlab/README.md`
2. `docs/BRAMUlab/Metodo_Trabajo.md`
3. `docs/BRAMUlab/Pre_Production.md`
4. `docs/BRAMUlab/Implementacion/Pre_Production/137_Evaluacion_Central_Brainstorming_Secuencia_Pre_Salida_06OCT.md`
5. `docs/BRAMUlab/Implementacion/Pre_Production/138_Resultado_Auditoria_Exposicion_Seguridad_06OCT.md`
6. `docs/BRAMUlab/Implementacion/Pre_Production/139_Resultado_Hardening_Exposicion_IP_06OCT.md`
7. `docs/BRAMUlab/Implementacion/Pre_Production/146_Cierre_R1_Estado_Cero_Primer_Partido_06OCT.md`
8. Issue #28.

No usar Archivo/Backup/handoffs históricos como autoridad salvo trazabilidad específica.

## 3. Próximo gate: G3

Antes de cualquier mutación de Production, Central debe pedir y recibir autorización explícita de Sebastián.

G3 debe respetar la secuencia definida en 137.

Objetivos de G3:
- crear/configurar Production limpia y separada de Staging;
- establecer el origen/URL estable de la app antes del smoke PWA final y antes de circular invitaciones externas;
- alinear Supabase Auth Site URL/redirects, variables de Vercel y guards ambientales;
- mover el logo de emails Auth fuera de `raw.githubusercontent.com` hacia un origen público estable;
- alinear `BRAMU_EMAIL_LOGO_BASE` y `BRAMU_PUBLIC_BASE_URL`;
- verificar que Vercel pueda seguir desplegando si el repo pasa a privado;
- revisar dependencia de GitHub Pages vieja antes de desactivarla;
- recién después, pedir autorización específica para cambiar el repo a privado;
- mantener BRAMUlive intacto aunque comparta repo.

No asumir dominio propio. El host exacto es una decisión humana abierta.

## 4. Decisiones humanas todavía abiertas

1. **Origen/URL final de BRAMUlab Production.**
   - Puede ser dominio propio o una URL estable de Vercel.
   - No comprar/configurar dominio sin decisión explícita.

2. **Repo privado.**
   - Recomendación vigente: sí, antes de usuarios externos.
   - No cambiar visibilidad hasta resolver el asset público de emails y verificar integraciones Vercel/BRAMUlive.
   - Requiere autorización explícita separada.

3. **Datos legales dependientes de Production.**
   - No inventar responsable/domicilio publicable, fecha de vigencia, AAIP/RNBDP, proveedores/regiones, retención/backups.
   - Completar recién con datos reales del entorno final.

## 5. Seguridad / exposición

Auditoría 138:
- no se encontraron secretos reales actuales ni históricos;
- repo público expuso código/docs y puede haber sido indexado/copiado;
- privatizar reduce exposición futura pero no borra copias históricas;
- navegador no debe recibir fórmulas sensibles si pueden vivir server-side.

Hardening 139 ya aplicado:
- motor dinámico de Nivel fuera del navegador;
- `dist/` allowlist;
- tests/scripts/docs internos no se sirven;
- supabase-js fijado con SRI;
- logo de emails preparado para origen configurable.

No deshacer este hardening durante G3.

## 6. Estado de Staging que NO se reabre

No volver a probar ni rediseñar salvo regresión concreta:
- Anular carga;
- Grupos / top 2 / Americano;
- Nivel / Evolución;
- Ranking / avatares;
- Actividad histórica;
- Invitados/Identidad/Recuperados/Pendientes;
- emails G1/G2 ya cerrados;
- eliminación de cuenta;
- Auth;
- identidad visual.

## 7. Ramas y entornos

- desarrollo activo: `staging`;
- no tocar `main` ni Production sin autorización;
- BRAMUlive separado funcionalmente: no tocar;
- mismo repo contiene BRAMUlab + BRAMUlive, por lo que cambios de visibilidad/integración afectan ambos.

## 8. Método de trabajo para G3

ChatGPT Central:
- coordina;
- define secuencia;
- revisa dependencias y documentación;
- pide autorizaciones humanas solo cuando corresponden.

Claude Code:
- analiza repo;
- prepara migraciones/configs/cambios técnicos;
- tests;
- documentación de implementación;
- nunca debe asumir permiso para Production solo porque el handoff existe.

Work:
- usar solo si hace falta navegador real/Vercel UI/smoke;
- no cargar a Sebastián con QA redundante.

Para una tarea mediana/grande:
1. Central documenta contexto/alcance.
2. Da prompt listo para copiar a Claude.
3. Claude trabaja autónomamente sobre lo autorizado.
4. Central revisa antes de una mutación sensible.
5. Sebastián interviene solo en decisión/OTP/autorización real.

## 9. Estado exacto al cambio de chat

- `staging` HEAD: `c0b98a445728e973df1ef448acb9320f440e874c`.
- Production: **NO autorizada**.
- main: **NO tocar**.
- repo: sigue público.
- URL estable final: pendiente decisión.
- primer usuario externo: todavía no.
- siguiente conversación debe empezar pidiendo/confirmando autorización de G3 antes de cualquier mutación de Production.
