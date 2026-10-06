# 137 — Evaluación Central · secuencia Brainstorming antes de salida

**Fecha:** 06/10/2026  
**Rama:** `staging`  
**Base evaluada:** `bfae907666c9c48b010a8c72b16fb68ec43ae305`  
**Entrada:** `136_Handoff_Brainstorming_Pre_Salida_06OCT.md`  
**Estado previo:** V04.35 cerrada en Staging / PASS Central. Issue #29 cerrado.  
**Objetivo:** ubicar las decisiones de Brainstorming dentro de la secuencia real de salida sin abrir Production ni reabrir V04.35.

## 1. Recomendación ejecutiva

**NO pasar todavía a G3.**

Antes de pedir autorización para crear Production conviene insertar dos cierres:

1. **Auditoría no destructiva de exposición/seguridad del repositorio y de su historia Git.**
2. **Última ronda de producto pre-Production** para cubrir el hueco real `Anular carga` y resolver el icono PWA definitivo si el asset final está disponible en la misma ronda.

Después se cierran los residuales ya existentes de Issue #28:
- R1 — P0.1/P0.1B;
- R2 — QA final de Grupos / Issue #23.

Recién entonces corresponde pedir autorización explícita para **G3 Production**.

## 2. Clasificación

| Frente | Clasificación | Motivo |
|---|---|---|
| Auditoría repo/exposición/secretos + historia Git | **ANTES DE PRODUCTION** | Una credencial histórica expuesta debe rotarse antes de usuarios reales; privatizar después no revoca una credencial filtrada. |
| Cambiar repo a privado | **DURANTE G3, antes de usuarios externos**, condicionado a auditoría y dependencias | Es deseable reducir exposición interna, pero el repo es compartido con BRAMUlive, Vercel depende de GitHub y los emails de Staging usan hoy un logo público desde `raw.githubusercontent.com`. No tocar visibilidad antes de resolver esas dependencias. |
| Poda documental / fuentes maestras / release tag | **DURANTE G3/G4, antes del primer usuario externo** | Ya está exigido por Pre_Production Etapa 5. Debe ser una poda segura, no una reorganización masiva. |
| Artefacto público limpio | **DURANTE G3/G4** | Production no debería entregar arqueología interna innecesaria. No es una defensa de seguridad ni justifica una toolchain compleja. Auditar y aplicar solo una solución simple/compatible. |
| Icono PWA definitivo | **ANTES DE PRODUCTION** | Primera impresión + instalación real. La infraestructura 192/512/maskable/apple-touch ya existe; falta cerrar el asset/tratamiento y probar instalación real. |
| URL estable de app | **DURANTE G3, antes del smoke PWA final y antes de enviar invitaciones a terceros** | Invitaciones se generan desde `window.location.origin`; además una PWA instalada queda ligada a su origen. Evitar instalar/circular una URL temporal que luego cambie. |
| Web pública one-page | **POST-LANZAMIENTO CORTO** | Útil para explicar/convertir, pero no bloquea el núcleo ni el primer smoke. |
| `Anular carga` pendiente | **ANTES DE PRODUCTION** | Es un escape legítimo para una carga equivocada y evita dejar un pendiente falso durante 30 días. La regla de producto ya está cerrada. |
| FAQ / Ayuda | **POST-LANZAMIENTO CORTO** | Valor real, pero sin evidencia de que deba bloquear salida. |
| Feedback por email | **POST-LANZAMIENTO CORTO** | Solución simple suficiente; no construir tickets antes de validar uso. |
| Auto-validación por reputación | **DESCARTADO — NO IMPLEMENTAR** | Mantener reglas iguales para todos. Solo reabrir con evidencia fuerte de veto sistemático. |
| Veto estratégico por silencio | **RIESGO ACEPTADO V1** | No crear tribunal ni excepción previa a evidencia. |
| Sanción automática por `No participé` | **FUTURO / SOLO CON EVIDENCIA** | Hoy no se puede distinguir con suficiente certeza abuso de víctima legítima. |
| Ventana temporal de duplicados | **FUTURO / SOLO CON EVIDENCIA** | Mantener regla actual ±3 h con horas conocidas / mismo día BA si alguna es desconocida. No ampliar a ±12 h sin estudiar revanchas reales y UX de Fecha/Hora. |

## 3. Frente exposición / seguridad — dependencias confirmadas

### Repo

Central confirmó:
- `sebastianvilaa/BRAMUlab` está **PUBLIC**;
- el mismo repo contiene **BRAMUlab y BRAMUlive**;
- solo existen ramas `main` y `staging`;
- Vercel reporta checks de deploy sobre commits del repo, por lo que existe dependencia activa GitHub → Vercel;
- el árbol de Staging contiene ~195 documentos BRAMUlab y ~80 documentos de Pre-Production: la superficie interna publicada es grande.

La visibilidad es una propiedad del repo compartido: privatizarlo afecta también el acceso/integraciones de BRAMUlive aunque no se cambie su código. Por eso requiere autorización explícita y verificación previa.

### Secretos

La higiene del árbol actual parece razonable a primera vista:
- `.gitignore` excluye `.env` y variantes;
- solo se versiona `bramulab/.env.example`;
- la publishable/anon key está tratada como pública y la service role como secreta.

**Esto NO prueba la historia Git.** Falta una auditoría de commits/blobs históricos y de secretos actuales hardcodeados. Si aparece una credencial real en cualquier commit, la acción primaria es **rotarla**; reescribir historia o privatizar el repo no la vuelve secreta otra vez.

### Dependencia crítica de emails

Los emails Auth de Staging usan actualmente el logo mediante una URL pública fijada a un commit:

`raw.githubusercontent.com/sebastianvilaa/BRAMUlab/.../bramulab/icons/logo.png`

y la documentación de templates ya dice que antes de Production debe sustituirse por el origen público definitivo.

Por lo tanto, **NO privatizar el repo antes de mover ese asset a una URL pública estable** y actualizar/verificar templates/configuración correspondiente.

### Artefacto navegador

`bramulab/index.html` y JS contienen comentarios extensos de versiones, bugs, handoffs y decisiones. Se sirven como frontend estático. No existe hoy una toolchain de minificación/bundling general en BRAMUlab.

Criterio:
- obligatorio: ningún secreto/dato privado debe formar parte del artefacto;
- deseable: retirar arqueología interna innecesaria;
- prohibido convertirlo en una reescritura/build complejo justo antes de Production.

Claude debe medir el problema y recomendar la solución mínima.

## 4. `Anular carga` — contraste preliminar con arquitectura real

La decisión de producto del handoff 136 es compatible con el modelo existente, pero **no existe todavía el comando normal de usuario**.

Soporte ya presente en Staging:
- `matches.status = 'annulled'` ya es usado;
- existen `annulled_at` y `annulment_reason`;
- existe `match_actions.action_type = 'annulled'`;
- existen `admin_annul_match` y el helper interno de anulación por duplicado;
- una anulación de duplicado ya oculta el match para todos vía `match_user_state`.

Huecos concretos:
- `admin_annul_match` NO sirve como UX de usuario: es administrativo y además genera notificaciones `admin_action`, contrario a la regla cerrada de “sin notificación nueva”;
- no hay RPC/Edge autoservicio para que el autor retire su carga;
- `get_my_matches` no excluye por sí mismo `status='annulled'`; el helper de duplicados consigue invisibilidad ocultándolo para participantes. La implementación normal debe garantizar invisibilidad robusta en Historial/Pendientes/Home/notificaciones;
- la elegibilidad debe decidirse server-side: autor original + `pending_validation` + ninguna acción de **otra persona** que reconozca el encuentro;
- `identity_questioned` / “No participé” de otra persona NO bloquea;
- `confirmed`, correcciones/revisiones, reemplazo de participante y acciones equivalentes de otra persona SÍ bloquean;
- acciones del propio autor no bloquean por sí solas;
- al ser un pending no oficial, no debería existir efecto deportivo que revertir, pero debe probarse explícitamente Nivel/Ranking/Grupos/Intelligence/contadores;
- conservar auditoría interna, no borrar físicamente el partido.

**Recomendación:** implementar antes de Production en una ronda acotada y server-authoritative. No reutilizar ciegamente la RPC administrativa.

## 5. Icono PWA

La infraestructura actual ya declara:
- 192×192;
- 512×512;
- 512 maskable;
- apple-touch-icon 180×180 (embebido como data URI para que funcione aun con Staging protegido).

No rediseñar branding. Falta el **asset final con margen/tratamiento óptico correcto** y QA de instalación real.

**DECISIÓN ABIERTA — Sebastián:** aprobación/entrega del icono final o definición visual suficiente para producirlo. Si queda disponible a tiempo, conviene incluirlo en la misma versión visible que `Anular carga` para ahorrar un ciclo de QA/deploy.

## 6. URL estable / dominio

El código de invitaciones construye el link con:

`window.location.origin + window.location.pathname + ?claim=...`

Por lo tanto, no hay hoy un dominio hardcodeado en el flujo: los links nuevos adoptarán automáticamente el origen público final.

Pero el origen importa por dos motivos:
1. los links ya compartidos quedan apuntando al host donde se generaron;
2. una PWA instalada / storage / sesión del navegador pertenecen al origen.

**Recomendación:** en G3, crear/configurar Production y asignar la URL estable **antes del smoke instalado definitivo** y antes de invitar a terceros.

También deberán alinearse:
- Supabase Auth Site URL / redirects;
- `BRAMU_PUBLIC_BASE_URL` de emails;
- logos/assets públicos usados por templates;
- health/env guards;
- manifest/service worker bajo el origen final.

**DECISIÓN ABIERTA — Sebastián:** dominio/host exacto y autorización de compra/configuración si implica costo. La landing pública puede esperar; solo hace falta resolver el origen estable de la app.

## 7. Secuencia recomendada

### Fase A — ahora, sin mutaciones
Auditoría focalizada de repo/exposición:
- dependencias de repo público;
- secretos actuales + historia Git;
- URLs/assets públicos que dependen de GitHub;
- inventario de comentarios/artefacto browser;
- propuesta de poda segura;
- plan para privatización sin romper Vercel/BRAMUlive/emails.

No privatizar, borrar, rotar, reescribir historia ni cambiar infra durante la auditoría.

### Fase B — última ronda funcional de Staging
Propuesta: **V04.36**.
- `Anular carga`;
- icono PWA definitivo si la decisión visual ya está lista;
- fuentes maestras afectadas;
- tests focales + QA humano mínimo.

No reabrir V04.35.

### Fase C — cerrar residuales de Issue #28
- R1: P0.1/P0.1B integrado;
- R2: Issue #23, QA final de Grupos.

Agrupar la intervención de Sebastián tanto como sea posible. Work debe absorber lo navegable/visual que pueda.

### Fase D — autorización explícita
Solo con A+B+C cerrados, Central pide autorización a Sebastián para G3.

### Fase E — G3 / G4
Con autorización:
- Production limpia/separada;
- origen estable de app;
- assets/email URLs;
- eventual repo privado después de verificar integraciones;
- limpieza documental de release;
- artifact cleanup mínimo seguro;
- migraciones/env vars/SMTP/callbacks;
- smoke solo Sebastián;
- plan/región/backups/retención/restauración;
- completar datos legales reales y superar legal guard;
- tag/snapshot de primera release.

### Fase F — primeros usuarios
Solo después del smoke final y criterio de salida.

## 8. Decisiones abiertas reales

1. **Icono final:** asset/tratamiento visual definitivo.
2. **Dominio/URL final:** host exacto y eventual compra/configuración.
3. **Repo privado:** autorización explícita solo después de la auditoría y de resolver dependencias. La recomendación preliminar es privatizarlo antes de usuarios externos si no aparece una razón operativa para mantenerlo público.

No hay decisión abierta de producto para `Anular carga`.

## 9. Próximo agente recomendado

**Claude Code — auditoría de exposición/seguridad, NO implementación.**

Debe trabajar desde este documento + handoff 136 y producir una auditoría focal, sin tocar visibilidad, infraestructura, Production, main ni BRAMUlive.

Regla especial por seguridad:
- nunca imprimir/commitear valores de secretos;
- si encuentra una credencial real actual o histórica, no publicar detalles sensibles en el repo: informar solo categoría/proveedor/acción de rotación de forma redactada y detener cualquier cambio irreversible.

Central revisa esa auditoría antes de autorizar la ronda V04.36.
