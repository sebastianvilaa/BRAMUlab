# BRAMU Lab — Rama Jugador
## Fusión de correcciones funcionales (según `BRAMU_Rama_Jugador_Auditoria_Funcional.md`)

Implementación de la causa raíz documentada en la auditoría funcional: Jugador 1 nunca estaba vinculado a `currentPlayerName`, así que un partido cargado por el "+" podía guardarse sin quedar asociado al jugador logueado. No se tocó ningún color, tipografía, ícono ni diseño general — todos los cambios son de comportamiento en `app.js`, `store.js`, `player-home.js` e `index.html` (solo texto/atributos de dos botones). `styles.css` no se modificó.

---

## 1. Qué se implementó

### 1.1 Jugador 1 = "Vos" cuando se abre desde el Home (§1, §2, §4)

`openManualLoadScreen(origin)` (`bramu-lab/app.js`): cuando `origin === 'player-home'`, después de resetear el formulario, completa `#manual-player-1` con el texto **"Vos"** y lo pone en modo lectura (`readOnly = true`). Cuando se abre desde el flujo tradicional (`origin === 'setup'`), el campo queda exactamente como siempre — vacío, editable, placeholder "Jugador 1" — sin ningún cambio de comportamiento.

`saveManualMatch()` ya no lee el texto de `#manual-player-1` para decidir el nombre de Jugador 1. Usa `PH.resolvePlayerOneName(manualLoadOrigin, currentPlayerName, valorDelCampo, 'Jugador 1')`, una función pura nueva en `player-home.js`:
- si el origen es `'player-home'`, devuelve `currentPlayerName` directamente — **nunca** lo que diga el campo (aunque diga "Vos", esté vacío, o alguien lo haya manipulado);
- si el origen es cualquier otro, se comporta exactamente igual que antes (texto normalizado del campo, con el fallback genérico "Jugador 1" si queda vacío).

Compañero (Jugador 2) y los dos rivales (Jugador 3/4) siguen siendo campos de texto libre normales, sin cambios.

### 1.2 Guardia de identificación antes de guardar con "Jugador 1" (§3)

`openManualLoadScreen('player-home')` ahora empieza leyendo `Store.loadCurrentPlayerName()`. Si no hay nadie identificado, **no** muestra la pantalla de carga: abre "¿Quién sos?" primero y, recién después de que la persona se identifique, vuelve a llamarse a sí misma (`openManualLoadScreen('player-home')`) para completar la apertura con el nombre ya disponible. Si cancela la identificación, vuelve a la pantalla de configurar partido — nunca llega a ver el formulario de carga sin identidad.

En la práctica esto es un cinturón de seguridad: hoy no debería activarse en el uso normal (identificarse es el primer paso obligatorio para llegar al "+"), pero cubre el caso de que la identificación se pierda a mitad de sesión (verificado en pruebas, sección 3).

### 1.3 "Cambiar jugador" reemplazado por "Cerrar sesión" (§5)

- Se eliminó el botón "Cambiar jugador" de la tarjeta de identidad del Home (`index.html`, antes `#player-home-change-player-btn`) y su listener en `app.js`.
- En Perfil, el botón "Cambiar jugador" (`#profile-change-player-btn`) se reemplazó por **"Cerrar sesión"** (`#profile-logout-btn`), mismo estilo (`link-btn`, sin diseño nuevo).
- Nueva función `logoutCurrentPlayer()`: llama a `Store.clearCurrentPlayerName()` (nueva función en `store.js`, borra únicamente la clave `padellab.currentPlayerName.v1`), limpia la variable en memoria y vuelve a `view-setup`. No toca `Store.loadHistory()` ni ninguna otra clave — el Historial y los partidos guardados quedan intactos.
- El modal "¿Quién sos?" se simplificó: ya no existe el modo "cambiar" (`isChange`/`playerHomeChangeMode`, eliminados). Ahora solo se abre en un caso — no hay jugador identificado — y acepta un callback opcional (`afterIdentifyAction`) para saber a dónde continuar después de guardar el nombre; por defecto va al Home, pero "Cargar partido jugado" lo usa para retomar la carga (sección 1.2).

## 2. Decisiones técnicas

- **`readOnly` en vez de `disabled`** para Jugador 1: un campo `disabled` no se envía con el formulario y en algunos navegadores cambia de aspecto por default; como de todas formas el valor de ese campo nunca se lee al guardar, `readOnly` alcanza para impedir la edición sin ese efecto colateral, y mantiene la apariencia visual sin cambios (consistente con "no realizar mejora visual").
- **`resolvePlayerOneName` vive en `player-home.js`, no en `app.js`**: es lógica pura (sin DOM), mismo criterio de reparto que el resto de la Rama Jugador — y de paso es lo que permite testearla sin necesitar un arnés de DOM.
- **El guard de identificación se resuelve reintentando `openManualLoadScreen('player-home')`** después de identificarse, en vez de duplicar la lógica de apertura de la pantalla en dos lugares — un solo punto de verdad para "cómo se abre esta pantalla".
- **No se tocó el formulario de partido en vivo** (`view-setup`, `#player-1`): la auditoría señaló que tiene el mismo vacío estructural, pero esta etapa pidió explícitamente no modificar "el registro de partidos ajenos u observados" y acotó el alcance a "Cargar partido jugado" — queda documentado como posible extensión futura, no se decidió acá.
- **No se tocó `styles.css`**: quedó una regla CSS húerfana (`.pastilla-identity__change`, sin ningún elemento que la use tras borrar el botón) — se dejó así a propósito para no tocar el archivo de estilos en esta etapa; es limpieza de cero riesgo visual para una futura pasada.

## 3. Verificación manual (navegador, en vivo)

Todo probado end-to-end en `http://localhost:4173` (Claude Browser tool):

1. **Identificación + Home vacío**: "Mi pádel" sin jugador → "¿Quién sos?" → identificado como "Testuser" → Home renderizado. Confirmado que **ya no existe** el botón "Cambiar jugador" en la tarjeta de identidad (`document.getElementById('player-home-change-player-btn')` → `null`).
2. **Guardia de identificación (§3)**: con el jugador ya identificado, se borró `padellab.currentPlayerName.v1` de `localStorage` a mano (simulando pérdida de identificación a mitad de sesión) y se tocó el "+" de la barra inferior → se abrió "¿Quién sos?", **no** la pantalla de carga. Al identificarse de nuevo, retomó la carga sola, con Jugador 1 ya en `"Vos"` y `readOnly: true`.
3. **Guardado con nombre real**: completado Compañero/Rival 1/Rival 2 y guardado — el partido persistido en `localStorage` tiene `players[0].name === "Sebastián"` (el `currentPlayerName` real), nunca `"Vos"` ni `"Jugador 1"`.
4. **Aparece de inmediato en todos lados (§6)**: tras "VOLVER AL INICIO", el Home mostró correctamente Último partido (VICTORIA, 6-4 · 6-3, compañero y rivales correctos), Forma reciente (un punto "V"), y los 4 widgets (1 partido este mes, 1 racha, Martín, Cruz). El Historial mostró la misma fila con "Sebastián / Martín vs Cruz / Dan".
5. **Flujo tradicional intacto (§4)**: entrando por "Configurar partido" → "Cargar partido jugado", Jugador 1 quedó vacío, editable, `readOnly: false`, placeholder "Jugador 1" — sin ningún cambio respecto al comportamiento de siempre. Cancelar volvió a `view-setup`, igual que antes de esta corrección.
6. **Cerrar sesión (§5)**: desde Perfil, "Cerrar sesión" limpió `currentPlayerName`, conservó el Historial (se verificó que seguía teniendo el mismo partido guardado), y volvió a `view-setup`. Al volver a entrar a "Mi pádel", apareció "¿Quién sos?" de nuevo, como corresponde.
7. Consola revisada: sin errores nuevos (el único mensaje presente es el error de registro del service worker bajo el servidor Python local, ya documentado como preexistente en informes anteriores).

## 4. Tests automatizados

Se agregaron 6 casos nuevos en `tests.html` para `PH.resolvePlayerOneName`, cubriendo ambos orígenes:
- Origen `player-home`: siempre devuelve `currentPlayerName`, sin importar qué diga el campo — probado con un campo con texto arbitrario, con un campo vacío, y con un campo que contiene un nombre distinto al del jugador actual.
- Origen `setup` (tradicional): comportamiento sin cambios — normaliza el texto del campo, cae al fallback genérico si está vacío, y no depende de si hay o no un `currentPlayerName` en memoria.

**Resultado de la suite completa: 349/349 tests OK** (343 previos + 6 nuevos), corrida en navegador antes de escribir este informe.

## 5. Alcance no tocado (a propósito)

- Ninguna mejora visual de la pantalla de carga — sigue viéndose exactamente igual salvo que Jugador 1 ahora muestra "Vos" cuando corresponde.
- El formulario de partido en vivo (`view-setup`) no se modificó — mismo vacío estructural que la auditoría señaló, pero fuera del alcance pedido para esta etapa.
- No se agregó ninguna advertencia para el caso "se guarda un partido manual sin que nadie coincida con `currentPlayerName`" en el flujo tradicional — sigue sin aplicar ahí, tal como pide el punto 4 ("no modificar el registro de partidos ajenos u observados").
- No se normalizan diacríticos en `Store.normalizePlayerName` — dejó de ser necesario para el síntoma reportado, porque Jugador 1 ya no se re-tipea cuando se abre desde el Home.

---

*Sin commit ni push todavía — a la espera de confirmación.*
