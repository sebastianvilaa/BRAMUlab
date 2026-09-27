# BRAMUlab — Resultado de la corrección de regresiones visuales h17

**Fecha:** 27/09/2026
**Rama:** `staging`
**Baseline previa:** BRAMUlab V04.11 / bundle `04.11-h16`
**Bundle resultante:** BRAMUlab V04.11 / bundle `04.11-h17`
**Fuente operativa de esta ronda:** `53_Auditoria_Central_Reapertura_h16_y_Plan_h17_27SEP.md` (secciones 1, 2 y 2.1), apoyado en `05_Laboratorio_UX_Uso_Real.md` §15.36/§15.37 y `45_Handoff_Cierre_UX_h13_27SEP.md`.

Esta ronda implementa únicamente los dos FAIL reales de §15.36 (Último partido con corrección activa, Aceptar/Rechazar) y el punto B del doc 53 (bloque de corrección del Resumen), siguiendo literalmente la "Dirección visual final confirmada por Sebastián para h17". No se reabrió ningún otro criterio del 1–11, no se tocó Mis grupos, ni backend/Supabase/Ranking/Nivel/Intelligence/self-healing/editor de sets/semántica oficial-propuesta/outbox.

---

## 1. Causa real de los dos FAIL

### FAIL 1 — Último partido con corrección activa

La implementación h13/h14 ubicaba el badge de estado (`CORRECCIÓN PENDIENTE` y el resto de estados server-backed) **dentro de `.datetime`**, la misma columna de `row1` que fecha/lugar, con un `min-height:18px` como única defensa de invariancia (`.player-home-lastmatch__badge-slot--reserved`). Cuando el copy real (padding + radio + font-size propios de una píldora) medía más que esos 18px reservados, `.datetime` crecía, `row1` crecía con ella y empujaba `row2` (forma reciente + VICTORIA/DERROTA) hacia abajo — exactamente la regresión física observada por Sebastián en iPhone. El comentario del código afirmaba invariancia; la composición real no la garantizaba.

### FAIL 2 — Aceptar / Rechazar corrección

`.b6-action-row` ponía los dos botones lado a lado (`display:flex; gap:10px`) con `flex:1` en ambos, pero el botón primario (`ACEPTAR CORRECCIÓN`, más texto) hereda `margin-top:10px` de `.btn-start` (pensado para un botón que vive solo, debajo de otro contenido) mientras `RECHAZAR` (`.btn-secondary`) no trae ese margen. En el ancho móvil de referencia, el label largo del primario podía además wrappear a 2 líneas mientras el secundario quedaba en 1 — la combinación de margen asimétrico + wrap potencial producía la composición despareja observada.

---

## 2. Dirección visual aplicada (sin reinterpretar)

Se tomó literalmente la sección "Dirección visual final confirmada por Sebastián para h17" del doc 53:

- `CORRECCIÓN PENDIENTE` pasa a texto ámbar discreto, sin cápsula/píldora/contenedor propio.
- El bloque de corrección del Resumen pierde el texto introductorio redundante y el diff técnico gris, y se lee como una sola unidad: rótulo + propuesta (con acento ámbar) + explicación humana + acciones.
- En móvil, `ACEPTAR CORRECCIÓN`/`RECHAZAR` quedan apilados a ancho completo; en desktop pueden volver a horizontal.
- `Reportar un error` no se tocó.
- Mis grupos no se tocó.

---

## 3. Cambios exactos

### `bramulab/app.js`

- `renderPlayerLastMatchCard`: el status (`CORRECCIÓN PENDIENTE` u otro) deja de vivir dentro de `.datetime`/`row1`. `row2` pasa a tener dos hijos: `.player-home-lastmatch__row2-left` (forma + badge de resultado, como antes) y `.player-home-lastmatch__status-slot` (nuevo, a la derecha). Para `hasActiveCorrectionOnLastMatch` el slot pinta un `<span class="player-home-lastmatch__status-text player-home-lastmatch__status-text--correction">` (texto plano); para cualquier otro estado server-backed sigue usando el badge/píldora existente (`.player-home-lastmatch__badge--${modifier}`), solo que reubicado. Se retiró el markup y la lógica de `.player-home-lastmatch__badge-slot`/`--reserved` (dead code).
- `paintB6Actions` (rama `f.status === 'validated'` con corrección activa):
  - `respondText` (`#b6-respond-correction-text`) ya no muestra `"[Nombre] propuso una corrección del resultado."` para quien debe responder (`isResponder === true`): se oculta (`respondText.hidden = isResponder`) porque el rótulo `Corrección propuesta por [Nombre]` + la explicación humana ya cubren esa información. Para quien propuso (`isResponder === false`) se conserva `"Esperando respuesta de la otra pareja."` — no es redundante, es el único lugar que comunica ese estado de espera.
  - Se retiró la llamada `renderCorrectionDiff('b6-respond-correction-diff', f.sets, f.pendingCorrectionSets)` (el diff técnico gris de este bloque puntual). El diff de la banda **pre-validación** (`#b6-status-banner-diff`, otro bloque, fuera de alcance de esta ronda) sigue exactamente igual.

### `bramulab/index.html`

- Se retiró `<ul class="b6-correction-diff" id="b6-respond-correction-diff" hidden></ul>` dentro de `#b6-respond-correction-block` (el diff técnico ya no se pinta ahí; el elemento no tiene motivo para seguir existiendo).
- Comentarios actualizados para reflejar la estructura nueva (sin referencias a markup retirado).

### `bramulab/styles.css`

- `.player-home-lastmatch__row2` pasa a `justify-content:space-between; flex-wrap:nowrap` (antes solo `gap` + `flex-wrap:wrap`); nuevo `.player-home-lastmatch__row2-left` agrupa forma+resultado.
- Se retiran `.player-home-lastmatch__badge-slot`/`--reserved` (dead code); se agregan `.player-home-lastmatch__status-slot` (sin altura mínima propia — la geometría de `row2` ya la gobierna el badge de resultado, siempre presente) y `.player-home-lastmatch__status-text`/`--correction` (texto ámbar liso, `white-space:nowrap`, sin fondo/borde/radio).
- `.player-home-lastmatch__badge` gana `white-space:nowrap` (evita wrap de estados largos ahora que comparten renglón con forma+resultado).
- `.b6-action-row` pasa a `flex-direction:column` por defecto (apilado, móvil) con `@media (min-width:720px)` volviendo a `flex-direction:row` (mismo breakpoint que el resto de la app, ver `history-filters`/`profile-tabs`).
- `.b6-action-row__btn` pasa a `flex:none; width:100%; margin-top:0` por defecto (neutraliza el `margin-top:10px` heredado de `.btn-start`, ancho completo apilado) con el mismo media query devolviendo `flex:1; width:auto` en desktop. Scope local a este par — `.btn-start`/`.btn-secondary` globales no cambiaron.
- `.b6-correction-compare .result-card` gana `border-color: rgba(255,201,61,0.4)` (acento ámbar en la tarjeta de la propuesta, un solo nivel de borde — no se agregó una caja nueva por encima).

### Tests (`bramulab/*.test.mjs`)

- **Nuevo** `h17-visual-regression.test.mjs`: 13 tests cubriendo estructura normal vs. corrección de Último partido, ausencia del badge-slot viejo, geometría estable de `row2`, ausencia de píldora para `CORRECCIÓN PENDIENTE`, móvil apilado/ancho completo + reseteo de margen asimétrico + paridad desktop, retiro del texto blanco y del diff técnico redundantes, unidad visual de la propuesta (acento ámbar sin caja nueva), no regresión de "Reportar un error", y el quartet de bundle `04.11-h17`.
- `cierre-ux-h13.test.mjs`: los dos tests P0-B que afirmaban la arquitectura vieja (badge-slot/`--reserved`) quedaron reemplazados por una guarda más chica (sigue comprobando que `hasActiveCorrectionOnLastMatch` se calcula explícitamente); el test P0-D que verificaba el orden `resumen humano → diff técnico` se actualizó para reflejar que el diff ya no existe en ese bloque.
- **Desvío disclosed** (ver §6): se corrigieron dos tests con bugs de escaping regex ya presentes en `staging` antes de esta ronda (`h15-runtime-template-regression.test.mjs`, `h16-report-error-cta.test.mjs`), detallado abajo.

---

## 4. Tests

### Suite Node completa

```
node --test bramulab/*.test.mjs
```

**338/338 tests OK** (0 fallas) — incluye la guarda de regresión h15 (backticks en comentarios HTML dentro del template de Último partido, corregida, ver §6), la guarda de "Reportar un error" h16, y los 13 tests nuevos de h17.

### `tests.html` (batería de módulos puros, navegador)

Servido con el dev server local (`.claude/dev-server.py`, puerto 4173) y verificado en el Browser pane: **1564/1564 tests OK — todo verde**. `tests.html` no carga `app.js`/`index.html` (solo módulos puros: `engine.js`, `stats.js`, `match-sync.js`, `store.js`, `player-home.js`, etc.), así que no ejercita directamente el marcado tocado en esta ronda — se corrió igual porque el doc 53 lo pide explícitamente como parte de la batería técnica.

### Smoke boot

`index.html` servido localmente carga sin errores nuevos en consola ni en red: los 20 scripts + `styles.css` resuelven con `?v=04.11-h17` (200 OK), la pantalla de acceso (`INICIAR SESIÓN`/`CREAR CUENTA`) renderiza correctamente. El único error de consola/red observado (`env.generated.js → 404`) es preexistente y ambiental (archivo generado por Vercel en build, ausente en este dev server local sin credenciales de Supabase) — no relacionado con los cambios de esta ronda.

### Regresión h15 runtime (crash)

Cubierta por `h15-runtime-template-regression.test.mjs` (corregida en esta ronda, ver §6): confirma que ningún comentario HTML dentro del template de `renderPlayerLastMatchCard` contiene un backtick crudo. El template reescrito en h17 además **elimina** los dos bloques de comentario HTML largos que existían ahí (movidos a comentarios `//` normales, fuera del template literal), reduciendo aún más la superficie de ese vector de crash.

### Regresión h16 (Reportar un error)

Cubierta por `h16-report-error-cta.test.mjs` (intacta en su aserción funcional) + repetida en `h17-visual-regression.test.mjs`: sentence case, secundario, rojo suave — sin cambios de este bloque en h17.

### Bundle/cache quartet

`04.11-h17` alineado en `index.html` (script `app.js` + link `styles.css` + los otros 18 scripts), `store.js` (`BUNDLE_VERSION`), `sw.js` (`CACHE_NAME` + `CORE_ASSETS`) y `version.json` — verificado por test automático y por inspección de red en el smoke boot.

---

## 5. Commit / deploy

- **Commit:** `ddb4d7c` — único commit lógico sobre `staging` (rebaseado sobre `cce5473`, un commit documental ajeno llegado a `origin/staging` mientras se trabajaba esta ronda; sin conflicto, no toca ningún archivo de esta ronda).
- **Push:** `origin/staging` (`cce5473..ddb4d7c`).
- **Deploy:** el push a `staging` dispara el `ignoreCommand` de `bramulab/vercel.json` (compara `HEAD^`↔`HEAD` dentro de `bramulab/`); como esta ronda modifica archivos de `bramulab/`, el deploy de BRAMUlab Staging se dispara — es el único deploy intencional de esta ronda. **No se pudo confirmar el resultado del build en vivo desde acá**: el alias de Staging (`bramulab-git-staging-bramu-lab.vercel.app`) redirige a un login de Vercel (Deployment Protection), y este agente no tiene ni debe usar credenciales de Vercel del usuario. Confirmar el deploy verde queda para Central/Work, con acceso real al panel.

---

## 6. Desvíos literales respecto del pedido

1. **Dos tests con bugs de escaping preexistentes, corregidos por necesidad de "suite Node completa" en verde.** El doc pide explícitamente que la suite Node completa forme parte de la cobertura de esta ronda. Al correr la suite ANTES de tocar nada, ya había una falla preexistente en `staging` (`h15-runtime-template-regression.test.mjs`, test "bundle/cache quartet") — su regex usaba `\\.`/`\\?` (doble backslash) en vez de `\.`/`\?`, un bug de escaping que nunca podía matchear el HTML/JS real, así que fallaba desde que se escribió (no solo por quedar desactualizado a "h15"). Revisando el mismo archivo se encontró un segundo bug del mismo tipo, más grave: la guarda real de la regresión h15 (`region.match(/<!--[\\s\\S]*?-->/g)`) tenía el mismo error de doble backslash — `[\\s\\S]` es una clase de caracteres literal `{\, s, S}`, nunca "cualquier carácter", así que esa guarda **nunca encontraba ningún comentario HTML real** y pasaba en falso sin comprobar nada. Se corrigió a `[\s\S]` (single backslash, el escape correcto). El mismo patrón de test de quartet hardcodeado a una ronda ya pasada existía también en `h16-report-error-cta.test.mjs`, y hubiera roto con el bump a h17 sin aportar ninguna cobertura real (cada ronda define su propio quartet). Se retiraron ambos quartets obsoletos (dejando comentarios explicativos) y se agregó el quartet de `04.11-h17` en `h17-visual-regression.test.mjs`. Ningún código de producción fue tocado por este punto — solo archivos `*.test.mjs`.
2. **`tests.html` no ejercita el marcado tocado.** Se corrió igual (lo pide el doc 53 como parte de la batería), pero como no carga `app.js`/`index.html`, su resultado (1564/1564) no aporta cobertura directa de los cambios de Último partido/Resumen — la cobertura real de esos cambios viene de la suite Node + inspección estructural, nunca de `tests.html`.

Ningún otro punto del plan se desvió: los criterios 1, 3, 5–11 del handoff 45/doc 53 no se tocaron; Mis grupos, backend, Supabase, Ranking, Nivel, Intelligence, self-healing, editor de sets, semántica oficial/propuesta y outbox quedaron exactamente como estaban.

---

## 7. Lo que este documento NO afirma

Esta ronda es implementación + verificación técnica. No incluye:

- Ninguna captura/inspección visual real en dispositivo o navegador con datos reales de una corrección activa (esta implementación no tiene acceso a una sesión real de Supabase Staging con un partido con corrección pendiente para observarlo desplegado).
- Ningún PASS visual sobre los criterios 1–11 del handoff 45.
- Ninguna afirmación de que la app esté apta para volver al Laboratorio físico de Sebastián.

---

**PENDIENTE DE GATE CENTRAL VISUAL 1–11**
