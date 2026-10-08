# BRAMUlab — Operación Vercel: deployments y alias

**Fecha de verificación:** 07/10/2026. **Alcance:** proyecto `bramulab`, rama de trabajo `staging`. No modifica reglas de producto, datos ni infraestructura.

## Fuente de verdad y precauciones

Leer primero `docs/BRAMUlab/README.md`. En cualquier operación confirmar el proyecto `bramulab` (`prj_224Rt2SjQtwZ7xZluMexwvwrODew`) y el commit exacto autorizado. No modificar `main`, Production ni BRAMUlive sin autorización explícita. **No reutilizar los SHA ni deployment IDs de este documento para despliegues futuros:** son referencias históricas.

## Staging: diferencia entre deployment READY y dominio actualizado

La URL estable de pruebas es:

`https://bramulab-git-staging-bramu-lab.vercel.app/`

Un deployment Preview puede estar **READY** sin que esa URL estable apunte a él. Esto ocurrió el 07/10: el deployment h27 estaba READY (`dpl_H4eNcj1b222Z7qNaXCKihft9FqN9`, SHA `5636be5592b845fca979231fe5a08a08545eea1a`), pero el alias seguía enlazado al deployment h24 `dpl_5DtuSNoRkSqEDPPhi3Z72T7TVYNL`. Se detectó al abrir `/version.json` en Safari: seguía indicando `04.37-h24`. Por eso el icono PWA ST no aparecía, incluso tras reinstalar.

### Verificación y corrección

1. Comprobar en la URL **estable** de Staging `/version.json` con un parámetro único para evitar caché; contrastar con la versión esperada. No conformarse con que Vercel muestre el nuevo deployment READY.
2. Con conector Vercel, ejecutar **Get Alias** (`get_alias`) para `bramulab-git-staging-bramu-lab.vercel.app`, **sin `teamId` explícito** si el alcance por defecto de la conexión ya resuelve el proyecto correcto. Comparar `deploymentId` con el deployment Preview aprobado.
3. **Solo si el alias apunta a una versión vieja y está autorizado corregir Staging**, ejecutar **Assign Alias** (`assign_alias`) con `id=<DEPLOYMENT_ID_PREVIEW_APROBADO>` y `requestBody.alias="bramulab-git-staging-bramu-lab.vercel.app"`. No introducir `teamId` por inercia.
4. Verificar otra vez `get_alias` y `get_deployment` para el alias, y verificar en navegador la versión real de `/version.json`. Confirmar que `app.bramulab.com` sigue apuntando al deployment de Production esperado.
5. Solo entonces pedir comprobar/reinstalar la instalación **Staging** del iPhone, si sigue mostrando el icono viejo. No tocar la instalación de Production.

**Causa del bloqueo de herramientas detectada:** el 07/10 las operaciones de Vercel con `teamId="team_XcCyzcJRPguK7VOQ6Lv3xgCZ"` devolvían 403/404. Las mismas consultas sin ese argumento funcionaron y `assign_alias` se completó. Fue una diferencia de alcance/autorización efectiva en ese contexto; **no** queda demostrado que la reconexión del plugin fuera necesaria. No prometer que omitir `teamId` solucione todos los 403 futuros; verificar el proyecto antes de cualquier escritura.

**Resultado verificado:** el alias Staging quedó en `dpl_H4eNcj1b222Z7qNaXCKihft9FqN9` (h27). El usuario confirmó que `/version.json` ya muestra h27. Production permaneció en `dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp` (h26). **Pendiente al escribir:** comprobación visual del icono azul ST tras reinstalar Staging.

## Production: patrón de publicación aprobado (sin modificar main)

En una sesión anterior se publicó h26 creando un deployment **nuevo** de Production desde el SHA aprobado de `staging` mediante Vercel **Create Deployment** (`create_deployment`):

```text
forceNew: "1"
skipAutoDetectionConfirmation: "1"
requestBody:
  name: "bramulab"
  project: "prj_224Rt2SjQtwZ7xZluMexwvwrODew"
  target: "production"
  gitSource:
    type: "github"
    org: "sebastianvilaa"
    repo: "BRAMUlab"
    ref: "staging"
    sha: "<SHA_EXACTO_APROBADO>"
```

Usar solo con autorización explícita de publicación y verificación del SHA. Este procedimiento construye con entorno Production y no requiere merge a `main`. Comprobar `READY`, SHA exacto, `target: production` y que `app.bramulab.com` resuelva al nuevo deployment. **No promover directamente un build Preview como sustituto:** podría no usar las variables de Production.

El procedimiento anterior fue reportado como exitoso por el chat que publicó h26; en este chat se **verificó el resultado desplegado**, pero no se volvió a ejecutar una publicación de Production. Referencia histórica: h26 SHA `f1ad7d1b712dfaaa437c230ffcc034f36f4ed3d4`, deployment `dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp`.

## Iconos PWA por entorno

La separación del icono oficial y del azul ST está definida en `docs/BRAMUlab/Identidad_Visual/Identidad_Visual.md` y `docs/BRAMUlab/Identidad_Visual/Marca/README.md`. En h27 `build-dist.mjs` selecciona la variante ST solo para Staging; Production conserva la oficial incluso al construir el mismo commit. Distinguir siempre **build correcto**, **alias correcto** e **icono cacheado en iOS** antes de modificar código.

## Production — infraestructura y estado de salida (verificado 07/10/2026)

Consolida lo que antes vivía en los informes de G3/G4 y del primer deploy (retirados el 08/10/2026; Git los conserva). **Esta sección es la fuente para los datos reales de Production**; no contiene secretos.

| Elemento | Valor |
|---|---|
| Dominio definitivo | `https://app.bramulab.com` (`bramulab.com` registrado en Cloudflare; `app.` conectado por CNAME a Vercel, verificado). Aliases técnicos: `bramulab.vercel.app`, `bramulab-bramu-lab.vercel.app` |
| Vercel | proyecto `bramulab`; variables de Production separadas de Preview/Staging; `main` no se mueve; BRAMUlive no se toca |
| Supabase Production | proyecto `bramulab-production`, ref `bgnnnfbdywefftvoqiss`, región `sa-east-1` (São Paulo), plan **Free**, `app_config.environment = production` |
| Edge Functions | 12/12 ACTIVE al 07/10/2026 (la lista vigente se verifica con `release-check`/el panel; no confiar en este número a futuro) |
| Cron | `bramu_weekly_ranking_publish` (lunes 00:05 Buenos Aires) y cleanup de altas abandonadas (solo Production) |
| Auth | Site URL `https://app.bramulab.com`; redirects del dominio nuevo + los de `bramulab.vercel.app` conservados como fallback temporal; `BRAMU_PUBLIC_BASE_URL=https://app.bramulab.com` |
| Primer deploy Production | 07/10/2026, desde `staging` (`b0889fe6`, `dpl_Nmn2pKLHi4XN8WdBKaGfDhC4Vwd4`), con datos vacíos (0 usuarios/jugadores/partidos) |
| Promociones posteriores | h24 (`303d7038`) y h26 (`f1ad7d1b`, `dpl_2FiyCJD1eA5t7sVj27qWyaayRnCp`, vigente): ver `README.md` para el estado actual |

**Incidente de aliases (07/10, resuelto):** el primer deploy dirigido desde `staging` recibió temporalmente el alias automático de la rama Staging; se reasignó al último Preview READY. Ante cualquier deploy Production dirigido, verificar siempre ambos alias (ver arriba).

### Legal / AAIP / transferencias (datos reales publicados)

- Los textos públicos (`bramulab/{terminos,privacidad,eliminar-cuenta}/index.html`) no tienen placeholders `[[PENDIENTE_PRODUCCION:*]]`; el build de Production los exige en cero. Vigencia 07/10/2026. La identidad y el domicilio publicables salen de la fuente privada del titular (no se copian a este repositorio; ver `Privacidad_Legal.md` §13).
- **AAIP/RNBDP:** trámite presentado el 07/10/2026, expediente `EX-2026-97673851-APN-DNDPD#AAIP`, estado Iniciación, **sin número definitivo**. Mientras esté pendiente los textos públicos dicen literalmente que la inscripción fue presentada y está pendiente. **Al asignarse el número:** actualizar `privacidad/index.html`, esta sección y `Privacidad_Legal.md`, y modificar el registro si algún dato cambió.
- **Transferencias internacionales:** Brasil (Supabase Production en São Paulo) y Estados Unidos (Vercel Inc. / Google LLC, con posible procesamiento global). Mecanismo para destinos sin nivel adecuado: **consentimiento expreso e informado**, recogido por el checkbox de alta y por la reaceptación.
- **Retención / backups / logs (Supabase Free):** logs operativos accesibles las últimas 24 h; sin ventana de restauración administrada desde el panel. **No prometer backups propios que no existen**; las copias técnicas de proveedores siguen sus ciclos y no se usan para restablecer datos eliminados. Un plan con backups/PITR sigue siendo una decisión de Sebastián (G4).

### Pendientes operativos de Production

1. Smoke humano mínimo en `app.bramulab.com` (carga sin protección de Vercel, acceso/crear cuenta visible, Términos y Privacidad abren, logo de emails resuelve desde el dominio público). No crear datos reales solo para repetir QA deportiva ya cerrada.
2. Seguimiento del expediente AAIP (ver arriba).
3. Decisión G4: plan de Supabase / backups gestionados (ver `Runbook_Operacion_y_Salida.md`, «Backup»).
4. Repositorio público, GitHub Pages viejo y logo de emails en `raw.githubusercontent.com`: **intervención independiente** (ver `Implementacion/Pre_Production/138_…` y `139_…`); nada de eso se cambia sin autorización específica y verificación de BRAMUlive/Pages.
