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

La separación del icono oficial y del azul ST está definida en `docs/BRAMUlab/Identidad_Visual.md` y `docs/BRAMUlab/Marca/README.md`. En h27 `build-dist.mjs` selecciona la variante ST solo para Staging; Production conserva la oficial incluso al construir el mismo commit. Distinguir siempre **build correcto**, **alias correcto** e **icono cacheado en iOS** antes de modificar código.
