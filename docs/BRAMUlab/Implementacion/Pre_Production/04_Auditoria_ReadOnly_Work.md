# Pre-Production — Auditoría read-only de Staging y preparación de Production

**Fecha:** 24/09/2026  
**Repositorio:** `sebastianvilaa/BRAMUlab`  
**Rama auditada:** `staging`  
**Modo:** solo lectura; no se modificó código, GitHub, Vercel, Supabase ni datos.

## 1. Resumen ejecutivo

La infraestructura funcional de Staging está saludable y correctamente separada de Production: el Preview real sirve el último deploy funcional de `staging`, el frontend declara el entorno `staging`, el health check responde correctamente contra el único proyecto Supabase existente (`bramulab-staging`), las ocho Edge Functions están activas y el cron semanal de Ranking está activo.

BRAMUlab **todavía no está apta para abrir Production**. Los bloqueantes confirmados son:

1. Estado Cero / Mi Perfil siguen teniendo módulos y valores vacíos en el código que sirve el Preview; la comprobación visual final quedó pendiente porque la sesión de la app no sobrevivió al corte de créditos.
2. El alta sigue usando el placeholder legal `versión piloto` / `piloto_v1` y no ofrece enlaces reales a Términos, Privacidad ni un canal de soporte/privacidad.
3. No existe un proyecto Supabase Production.
4. El proyecto Vercel tiene entorno Production asociado a `main`, pero las tres variables de BRAMU están presentes **solo en Preview**; Production no tiene esas variables.
5. La organización Supabase está en plan Free: no hay backups diarios accesibles ni PITR; para Production todavía no existe una política/infraestructura de backup verificable.
6. La verificación puntual de SMTP, remitente y callbacks de Auth no pudo hacerse porque el Dashboard de Supabase exigió login manual. No se reabre la validación histórica de Staging, pero la configuración real de Production necesariamente sigue pendiente porque ese proyecto no existe.

## 2. Revisión y deploy realmente servidos

| Dato | Resultado | Clasificación |
|---|---|---|
| HEAD actual de `origin/staging` | `0472762e28dc177f6eaae0385694c1ddab5ce76d` | OK / YA CUBIERTO |
| Deploy servido por el alias de Staging | `dpl_GdvTWsACcat2UL8CdYWeFX6DhJW1` | OK / YA CUBIERTO |
| Commit del deploy servido | `ba3a0b9360e2e88730a0ab8a3a9532bb765293ec` | OK / YA CUBIERTO |
| Rama / Environment | `staging` / Preview | OK / YA CUBIERTO |
| Estado Vercel | Ready; marcado Stale porque los commits posteriores son documentación y no generaron otro build | OK / YA CUBIERTO |
| Alias auditado | `bramulab-git-staging-bramu-lab.vercel.app` | OK / YA CUBIERTO |
| Bundle visible | `04.10-h26` | OK / YA CUBIERTO |
| Versión pública | `BRAMUlab V04.10` | OK / YA CUBIERTO |
| Health check | `ok: true`, `environment: staging`, `supabase: reachable` | OK / YA CUBIERTO |

Los commits entre `ba3a0b936…` y `0472762e…` son documentales. El alias de Staging conserva correctamente el último build funcional.

## 3. Auditoría visual / Estado Cero

### PENDIENTE DE INTERVENCIÓN HUMANA

Al reabrir el navegador, BRAMUlab mostró la pantalla pública de inicio de sesión; no había una sesión de la app reutilizable. Conforme al handoff, no se creó otra cuenta ni se modificaron datos. Por eso quedaron pendientes de comprobación visual interactiva:

- Home con una cuenta de 0 partidos oficiales;
- Mi Perfil con 0 partidos oficiales;
- Perfil público de esa cuenta.

La auditoría continuó con el Preview público, su DOM desplegado y el código exacto correspondiente al commit servido.

### Hallazgos confirmados en el artefacto servido / código activo

| Superficie | Evidencia | Clasificación |
|---|---|---|
| Home — Actividad | Con muestra vacía sigue asignando `Sin partidos en las últimas 4 semanas`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Home — Efectividad | Sigue asignando `—` y `Sin partidos considerados`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Home — Racha | Sigue asignando `—` y `Sin racha en curso`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Home — Partidos totales | Sigue asignando `0` / `partidos registrados`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Home — Mejor compañero / Rival | Sigue asignando `—` y `Sin datos suficientes`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Mi Perfil — rendimiento | Con cero partidos sigue calculando y pintando `—`, `0` jugados, `0` ganados y `—` para rachas. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Perfil público server-backed | El camino server-backed oculta Efectividad y el bloque de rendimiento antes de cargar el perfil; el código coincide con la regla de no inventar rendimiento. Falta la revalidación visual real con una cuenta 0/5. | OK / YA CUBIERTO (evidencia estática); PENDIENTE DE INTERVENCIÓN HUMANA para QA visual |
| Copy/motion final de Estado Cero | No se evaluó porque depende de la implementación pendiente y de una sesión apta. | P1 CONVENIENTE ANTES DE AMIGOS |

Conclusión de este punto: P0.1 sigue abierto. La evidencia del código coincide con los gaps declarados en `Pre_Production.md`; no se amplió la QA a otros recorridos.

## 4. Alta, legal y privacidad

Se recorrió el alta hasta la pantalla inicial de credenciales sin completar ni enviar ningún registro. Además se inspeccionó el DOM desplegado completo.

| Hallazgo | Evidencia | Clasificación |
|---|---|---|
| Copy de Términos | `Acepto los Términos y Condiciones de BRAMU (versión piloto)` sigue presente en el Preview. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Versión legal | El código activo conserva `TERMS_VERSION = 'piloto_v1'` y el comentario `sin sistema legal todavía`. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Link real a Términos | No existe enlace en la pantalla ni archivo/ruta legal en el frontend auditado. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Link real a Privacidad | No existe enlace ni ruta visible. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Canal de soporte/privacidad | No se encontró `mailto:`, ruta de soporte/privacidad ni contacto operativo visible. El contacto por WhatsApp entre jugadores no es un canal de soporte. | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Acceso V1 | El alta pública pide Email + Contraseña; coincide con la decisión cerrada. | OK / YA CUBIERTO |

P0.2 sigue abierto de forma objetiva.

## 5. Vercel — estado real read-only

### Proyecto y entornos

- Cuenta/equipo visible: `BRAMUlab`, plan **Hobby**.
- Proyectos visibles: `bramulab` y `bramulive`; solo se auditó `bramulab`.
- `bramulab` usa los entornos estándar:
  - Production: rama `main`, con `bramulab.vercel.app` y dos dominios adicionales indicados por el panel;
  - Preview: todas las ramas Git no asignadas, incluido `staging`;
  - Development: accesible vía CLI;
  - no existen Custom Environments.

### Variables — solo nombres/presencia

El panel muestra exactamente estas variables en el proyecto:

| Variable | Preview | Production | Development |
|---|---:|---:|---:|
| `BRAMU_ENV_NAME` | presente | ausente | ausente en el panel |
| `SUPABASE_URL` | presente | ausente | ausente en el panel |
| `SUPABASE_ANON_KEY` | presente | ausente | ausente en el panel |

No se leyó, copió ni registró ningún valor.

La presencia real en el artefacto público también quedó verificada sin exponer valores: `env.generated.js` declara `staging`, contiene `supabaseUrl`/`supabaseAnonKey` y apunta al único proyecto Supabase Staging listado por el panel.

**Clasificación:**

- Preview/Staging correctamente configurado: **OK / YA CUBIERTO**.
- Variables de Production ausentes: **P0 BLOQUEANTE ANTES DE PRODUCTION**.

### Protección, indexación, caché y observabilidad

| Control | Estado observado | Clasificación |
|---|---|---|
| Vercel Authentication | `Require Log In` activo con Standard Protection para deployments. | OK / YA CUBIERTO |
| Sourcemaps | `Protected Sourcemaps` activo. | OK / YA CUBIERTO |
| Robots | `/robots.txt` sirve `User-agent: *` + `Disallow: /`. No hay meta `robots`, pero el bloqueo global existe. | OK / YA CUBIERTO |
| Service worker | Publicado y coherente con `bramulab-v04-10-h26`; assets propios cache-first, `version.json` siempre network/no-store. | OK / YA CUBIERTO |
| Bundle/cache | Todos los assets propios inspeccionados usan `?v=04.10-h26`. | OK / YA CUBIERTO |
| Deployment | Ready, build de 8 s, branch `staging`, sin fallo visible. | OK / YA CUBIERTO |
| Deployment retention | Habilitado; el panel advierte que algunos deploys se eliminarán con el tiempo. | OK / YA CUBIERTO |
| Speed Insights | No habilitado. | P1 CONVENIENTE ANTES DE AMIGOS |
| Web Analytics | No habilitado. | P1 CONVENIENTE ANTES DE AMIGOS |
| Alertas de anomalías | No disponibles en Hobby; el panel ofrece upgrade a Pro. | P1 CONVENIENTE ANTES DE AMIGOS; el gate de “métricas mínimas” debe resolverse en Bloque 9 |
| Deploy Hooks | Ninguno configurado. | FUERA DE ALCANCE / no es requisito de salida |
| Dominio propio | No se exigió ni auditó como requisito. | FUERA DE ALCANCE |

La consola del recorrido público no mostró errores propios de BRAMUlab. Solo aparecieron errores del content script de la extensión del navegador, ajenos a la app.

## 6. Supabase — estado real read-only

### Inventario

- Existe **un solo proyecto**: `bramulab-staging`.
- Región: `sa-east-1`.
- Estado: `ACTIVE_HEALTHY`.
- PostgreSQL: 17, release channel GA.
- Organización: `BRAMUlab`, plan **Free**.
- No existe un proyecto Supabase Production.

**Clasificación:** Staging saludable, **OK / YA CUBIERTO**. Ausencia de Supabase Production, **P0 BLOQUEANTE ANTES DE PRODUCTION**.

### Edge Functions activas

| Función | Estado | Versión | JWT |
|---|---|---:|---|
| `officialize-onboarding` | ACTIVE | 2 | requerido |
| `create-or-attach-match` | ACTIVE | 2 | requerido |
| `officialize-match` | ACTIVE | 1 | requerido |
| `propose-match-correction` | ACTIVE | 1 | requerido |
| `respond-match-correction` | ACTIVE | 1 | requerido |
| `resolve-identity-issue` | ACTIVE | 1 | requerido |
| `admin-resolve-identity-issue` | ACTIVE | 1 | no requerido por gateway; usa su control administrativo propio ya cerrado en Bloque 6 |
| `get-match-intelligence` | ACTIVE | 2 | requerido |

**Clasificación:** OK / YA CUBIERTO. No se reauditaron sus contratos ni RLS.

### Cron de Ranking

- Job: `bramu_weekly_ranking_publish`.
- Activo: sí.
- Schedule: `5 3 * * 1` con base UTC, equivalente a lunes 00:05 de Buenos Aires.
- Historial de ejecuciones: todavía vacío al momento de la auditoría; el job fue creado después del último lunes y su primera ventana ordinaria aún no ocurrió.

**Clasificación:** OK / YA CUBIERTO. El primer run real deberá observarse operativamente, sin reabrir Bloque 7.

### Backups / PITR / exportación

- El proyecto está en plan Free.
- Según la documentación oficial vigente de Supabase, los backups diarios accesibles corresponden a Pro/Team/Enterprise; para Free se recomienda exportación periódica con `supabase db dump` y backup off-site.
- PITR es un add-on de planes pagos y no está disponible en el estado actual.
- No se observó una exportación externa ni un procedimiento de backup existente.

**Clasificación:**

- Para Staging actual: limitación operativa conocida del plan, **OK / YA CUBIERTO** como inventario.
- Antes de Production: backup/exportación y restauración verificables son **P0 BLOQUEANTE ANTES DE PRODUCTION**.

### SMTP, remitente y callbacks

El Dashboard de Supabase abrió una pantalla de login y no había sesión reutilizable. No se pidió contraseña ni OTP y no se intentó modificar configuración.

**PENDIENTE DE INTERVENCIÓN HUMANA** para volver a leer en el panel:

- Site URL y Redirect URLs de Auth;
- proveedor SMTP vigente;
- remitente configurado;
- límites/alertas del proyecto visibles en Dashboard;
- pantalla de backups del proyecto.

Esto no convierte SMTP de Staging en una regresión: `Pre_Production.md` lo da por ya validado y esta auditoría no encontró evidencia contraria. Para Production, SMTP/callbacks son **P0 BLOQUEANTE ANTES DE PRODUCTION** porque todavía no existe el proyecto donde configurarlos.

## 7. Production — qué existe y qué falta

### Existe

- Un único proyecto Vercel `bramulab`.
- Environment Production asociado a `main`.
- Dominio Vercel de Production (`bramulab.vercel.app`) y dos dominios adicionales declarados en el panel.
- Guardas de build en el repositorio para evitar cruces de `BRAMU_ENV_NAME`/`VERCEL_ENV`.

No se abrió ni se probó la aplicación Production.

### Falta objetivamente

| Falta | Clasificación |
|---|---|
| Proyecto Supabase Production separado | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Variables Vercel Production `BRAMU_ENV_NAME`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Migraciones y Edge Functions verificadas en Supabase Production | P0 BLOQUEANTE ANTES DE PRODUCTION |
| SMTP/remitente/callbacks de Production | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Backups/exportación y restauración de Production | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Smoke real de Production | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Estado Cero / perfil progresivo cerrado | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Términos, Privacidad y canal de soporte reales | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Procedimiento administrativo de eliminación/anonimización según P0.3 | P0 BLOQUEANTE ANTES DE PRODUCTION |
| Métricas/alertas mínimas de salida | P0 BLOQUEANTE ANTES DE PRODUCTION como gate de Bloque 9; las opciones concretas no se decidieron en esta auditoría |

## 8. Clasificación consolidada

### P0 BLOQUEANTE ANTES DE PRODUCTION

- P0.1 Estado Cero / Mi Perfil progresivo sigue abierto.
- P0.2 legal/privacidad sigue en placeholder y sin accesos reales.
- P0.3 procedimiento de eliminación/anonimización sigue siendo requisito documental/operativo de salida.
- No existe Supabase Production.
- No existen variables Vercel Production para BRAMU.
- No existen todavía SMTP/callbacks, backups/exportación, migraciones verificadas ni smoke de Production.
- El gate de métricas/alertas mínimas de Bloque 9 no está cerrado.

### P1 CONVENIENTE ANTES DE AMIGOS

- QA visual final de Home/Mi Perfil/Perfil público 0/1/varios partidos después de corregir P0.1.
- Copy/motion final de Estado Cero y TU MOMENTO.
- Speed Insights, Web Analytics y/o una alternativa suficiente de observabilidad de primera impresión.
- Edge cases visuales del ciclo de partido ya listados en `Pre_Production.md`.

### OK / YA CUBIERTO

- Preview funcional `ba3a0b936…`, bundle `04.10-h26`, Ready.
- Health de Staging y enlace exclusivo al proyecto Supabase Staging.
- Variables Preview presentes sin exposición de valores.
- Supabase Staging ACTIVE_HEALTHY.
- Ocho Edge Functions activas.
- Cron semanal de Ranking activo en horario correcto.
- `robots.txt` bloqueando indexación.
- Vercel Authentication y sourcemaps protegidos.
- Service worker/cache/versionado coherentes.
- Acceso V1 por email + contraseña.

### FUERA DE ALCANCE

- Reauditoría profunda de RLS y Bloques 1–8.
- Cambios en BRAMUlive.
- Dominio propio.
- IA generativa, push, social login, app nativa y demás backlog futuro.
- Implementar o decidir soluciones durante esta auditoría.

## 9. Incidencias y limitaciones de la auditoría

1. **PENDIENTE DE INTERVENCIÓN HUMANA:** sesión válida de BRAMUlab Staging para la QA visual de Home/Mi Perfil/Perfil público con 0 partidos oficiales.
2. **PENDIENTE DE INTERVENCIÓN HUMANA:** sesión del Dashboard de Supabase para callbacks, SMTP/remitente, backups y alertas visibles.
3. La conexión Vercel del plugin devolvió 403 por scope, pero el navegador ya tenía sesión válida y permitió completar la revisión read-only del panel sin cambios.
4. No se tomó ninguna captura porque la evidencia textual del DOM/panel era suficiente y no había una anomalía visual que requiriera imagen.

## 10. Conclusión

La base técnica de Staging está sana y consistente con el cierre de Bloques 1–8, pero los P0 pre-Production definidos en la fuente maestra siguen abiertos. En particular, Estado Cero, legal/privacidad, infraestructura Supabase Production, variables Production y continuidad operativa (SMTP/callbacks/backups/métricas/smoke) impiden abrir Production a usuarios reales.

**AUDITORÍA READ-ONLY COMPLETADA — PRODUCTION NO APTA TODAVÍA**
