# 100 — Fix Central G2: overflow Privacidad + referencias de navegación

**Fecha:** 01/10/2026  
**Issue:** #22  
**Baseline Work:** `3150ac69cbae0ceb4ca854920736f4ec5c950dfa`  
**Alcance:** fix visual/editorial mínimo en Staging. Sin backend, emails, Auth, migraciones ni Production.

## Hallazgo confirmado por Work

En `/privacidad/` dentro del iframe legal:
- clientWidth: 445 px;
- scrollWidth: 511 px;
- overflow horizontal: 66 px.

`/terminos/` no reproducía el fallo.

La causa compatible con el DOM/CSS es la presencia de tokens de Pre-Production largos y sin espacios dentro de `.pend` (por ejemplo placeholders `[[PENDIENTE_PRODUCCION:...]]`), sin `overflow-wrap`.

## Fix Central

**FUSIONAR**:
- `.pend { overflow-wrap:anywhere; word-break:break-word; }`;
- `p, li { overflow-wrap:anywhere; }` como defensa para textos/URLs largos;
- mismo criterio en Términos y Privacidad para que ambos documentos respondan igual en marcos angostos.

No se cambia ninguna obligación, política, retención, edad, dato ni decisión legal.

## Referencias editoriales actualizadas

Work detectó instrucciones de navegación viejas. Se actualizan solo para reflejar la UI vigente:

- Términos §4:
  - antes: `Mi perfil → Mis datos → Acceso y seguridad`;
  - ahora: `Perfil → Configuración`.
- Términos §10:
  - antes: `Acceso y seguridad → Eliminar mi cuenta`;
  - ahora: `Perfil → Configuración → Eliminar mi cuenta`.
- Privacidad §7:
  - antes: `Acceso y seguridad → Solicitar copia de mis datos`;
  - ahora: `Perfil → Configuración → Solicitar copia de mis datos`.

Esto es corrección de navegación, no cambio sustantivo del contrato legal y no requiere nueva versión legal por sí sola.

## Retest requerido

Work debe hacer únicamente:
1. Privacidad dentro del shell en desktop y viewport angosto/mobile disponible: `scrollWidth <= clientWidth`;
2. Términos sigue sin overflow;
3. links/back/legal shell siguen funcionando;
4. verificar visualmente las tres rutas editoriales actualizadas;
5. si puede, completar los backs de Email/Copia que quedaron sin ejecutar.

No repetir G1, reaceptación completa, challenges destructivos ni Site URL.

## Residual iOS

Si Work no dispone de iPhone real, queda una sola comprobación humana agrupada: reinstalar PWA una vez y confirmar icono. No bloquea el retest de este fix.
