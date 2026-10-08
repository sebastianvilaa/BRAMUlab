# BRAMUlab — Comunicaciones / Emails V1 (fuente maestra de decisiones de producto)

**Estado:** cerrado e implementado (G1, 01/10/2026) y vigente en Production. Este documento conserva las **decisiones de producto y diseño** del handoff de Comunicaciones (consumido; original en Dropbox, `Archivo histórico/BRAMUlab/`). El **copy exacto, asuntos y HTML** viven en código: `supabase/functions/_shared/email-templates.mjs` (fuente única) y `supabase/email-templates/README.md`; el contrato técnico y la implementación, en `Implementacion/Pre_Production/90_Resultado_G1_Emails_Implementacion_Tecnica_01OCT.md`; las reglas de eliminación y sesiones, en `Privacidad_Legal.md`.

## Principio y tono
Los emails se sienten como **BRAMUlab hablando por otro medio**: deportivos, modernos, claros, ágiles y cercanos. No son una plantilla genérica de Supabase, newsletter, mini-app, comunicación bancaria, estética gamer/neón ni humor deportivo forzado. Primero la información importante.
- Español con voseo natural (`confirmá`, `ingresalo`, `podés`), sin exceso de argentinismos, sin «Estimado usuario», sin legalismos ni marketing ni emojis (único emoji V1: `🎾` en la confirmación de cuenta).
- Guiños de pádel solo cuando suman; **nunca en seguridad ni eliminación** (ahí manda la claridad).
- **Sin Instagram en el footer por ahora** (la familia queda preparada para sumarlo cuando esté operativo). **Sin preheader de marketing**: si el HTML exige uno, deriva literalmente de la primera frase funcional.

## Inventario V1 (8 emails)
1 Confirmación de cuenta · 2 Recuperación de contraseña · 3 Confirmación desde el email actual (cambio de email) · 4 Confirmación del email nuevo · 5 Email cambiado (al email anterior) · 6 Contraseña cambiada · 7 Confirmación de eliminación · 8 Cuenta eliminada (comprobante). **Fuera de V1** (no diseñar ni activar sin decisión nueva): bienvenida adicional, magic link, invitaciones Auth, MFA, teléfono, proveedores vinculados, actividad de partidos/Ranking/Nivel/Grupos/Intelligence, promocionales y reautenticación genérica.

## Contratos de flujo
- **Códigos de 6 dígitos** (vigencia 60 min) ingresados dentro de la app; los emails con código **no llevan botón/CTA** (evita una segunda vía, scanners y tracking). No revelar si un email existe al pedir recuperación.
- **Cambio de email = exactamente 2 verificaciones visibles** (email actual → email nuevo), luego aviso #5 al email anterior y cierre de las demás sesiones. No puede aparecer una tercera confirmación ni un «Recuperá tu contraseña» en ese recorrido.
- **Eliminación:** email #7 propio y contextual (explica las consecuencias), vinculado a **esa cuenta + esa acción** (desafío específico `delete_account`, destinatario derivado server-side, un uso, rate limit); el #8 se envía **solo** tras éxito real, es idempotente y **no ofrece recuperación ni soporte** (la eliminación es definitiva). Los avisos #5 y #6 no piden código.

## Sistema visual «BRAMU Night Card»
- Una columna (~560 px máx. en desktop, fluida en mobile): fondo exterior oscuro → tarjeta → logo → categoría → título → explicación → módulo principal (código / datos / aviso) → información secundaria → seguridad → separador → footer. **Diseñado oscuro de origen** (no depende de `prefers-color-scheme`), con tablas y estilos inline.
- Paleta (tokens de la app): fondos `#03070D` `#050A12` `#09131F` `#0D1A2A` `#112238`; texto `#F8FAFC` / `#9AA7B5` / `#687482`; **lima `#95FF19`** = foco/acción, **azul `#199FFF`** = atmósfera/estructura, **rojo `#FF5B61`** solo para riesgo/destrucción. Nunca los tres con el mismo peso.
- **Logo real, nunca reconstruido** (28–32 px de alto, `alt="BRAMUlab"`), con URL HTTPS pública y estable. Elemento de pádel: línea geométrica fina de cancha con un punto lima, decorativo y degradable (sin paletas, pelotas, redes ni fotos).
- Categoría en mayúsculas pequeñas (`CUENTA`, `ACCESO`, `SEGURIDAD`); título en sentence case. **El código es el héroe**: 6 dígitos de texto real (seleccionable, nunca imagen ni casillas simuladas), centrado, 36–40 px, con tracking; lima en flujos normales, rojo medido en eliminación.
- Tipografía `Inter, Arial, Helvetica, sans-serif` (sin depender de webfonts). Footer: **BRAMUlab · Donde vive tu pádel.** y, en #1–#7, `¿Necesitás ayuda? bramulab@gmail.com`; el #8 lleva solo marca.
- Esenciales que siempre deben sobrevivir: marca (texto/alt), categoría, título, cuerpo, código, vigencia, consecuencia/seguridad y soporte cuando corresponda. Pueden degradar: línea de cancha, glow, radios, sombras, matices de fondo y webfont.

## Pendiente conocido
El logo sale hoy de un origen público fijado a commit en GitHub; el cambio a `https://app.bramulab.com` está preparado (`BRAMU_EMAIL_LOGO_BASE`) y se ejecuta como parte de la intervención independiente de privacidad del repositorio (`Operacion_Vercel_Staging_Production.md`, «Pendientes operativos de Production»).
