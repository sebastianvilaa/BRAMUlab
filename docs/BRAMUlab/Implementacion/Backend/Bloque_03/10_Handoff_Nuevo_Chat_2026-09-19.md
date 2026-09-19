# BRAMUlab — Handoff urgente de continuidad
## Backend Bloque 3 / onboarding / Nivel inicial
**Fecha:** 19/09/2026  
**Objetivo:** permitir continuar en un chat nuevo sin depender del contexto del chat anterior.

---

## 1. Estado general

BRAMUlab sigue en `staging`.  
`main` no se toca.  
BRAMUlive está separado y NO forma parte de este trabajo.

Backend:
- Bloque 1: cerrado.
- Bloque 2: cerrado.
- Bloque 3: **todavía abierto**, en validación manual real.

Scripts reales contra Supabase Staging ya pasaron sin cambios:
- `verify-bloque2.mjs`: OK
- `verify-bloque3.mjs`: OK
- `verify-nivel-parity.mjs`: OK

Supabase Staging:
- proyecto: `bramulab-staging`
- project ref: `serxtivkfnptzurnvewg`
- Edge Function `officialize-onboarding`: desplegada y ACTIVE.

No pedir ni mostrar contraseñas, OTP, service_role ni secretos en el chat.

---

## 2. Método de trabajo acordado

Para ahorrar créditos/tokens:
- ChatGPT central: coordinación, revisión, GitHub, Supabase plugin, documentación y hotfixes chicos cuando sea seguro.
- ChatGPT Work: solamente tareas que realmente necesiten navegador/cloud computer.
- Claude Code: código/migraciones/tests/debugging profundo que justifique su costo.

Los handoffs operativos viven en:

`docs/BRAMUlab/Implementacion/Backend/Bloque_03/`

Evitar copy/paste de informes largos entre chats. Leer/escribir MD en esa carpeta.

---

## 3. Cambios y fixes importantes ya realizados durante Bloque 3

Claude implementó Bloque 3 y dejó informe en:

`04_Informe_Implementacion_Claude.md`

Luego ChatGPT aplicó/validó Supabase Staging y dejó:

`05_Validacion_ChatGPT.md`

Durante la prueba manual aparecieron y se corrigieron estos bugs:

### Signup con email ya existente
Supabase puede devolver una respuesta obfuscada/fake si el email ya existe.
Hotfix:
- `auth.js` detecta el caso y devuelve `email_taken`.
- cache bump h4.

Registro:
`06_Hotfix_Signup_Existente.md`

### Perfil mínimo después de OTP
`competitive_branch` llegaba como `undefined` y la RPC `complete_profile` necesitaba el parámetro explícito aunque fuera NULL.
Hotfix:
- enviar `p_competitive_branch: fields.competitiveBranch || null`.
- cache bump h5.

Registro:
`07_Hotfix_Perfil_Minimo_RPC.md`

### Botones de header cuadrados/blancos
La regla global `.icon-btn` se había perdido al separar BRAMUlive.
Hotfix:
- restaurada la regla global.
- cache bump h6.

Registro:
`08_Hotfix_Icon_Buttons.md`

---

## 4. Prueba manual real ya validada

Cuenta de prueba 1:
- alta real con email nuevo;
- perfil mínimo;
- cuestionario/Nivel;
- OTP real recibido;
- perfil persistido;
- Nivel oficial persistido;
- llegada a Home;
- estado `CALIBRANDO 0/5`;
- logout y login posterior;
- login posterior desde navegador normal después de haber creado la cuenta en incógnito.

Esto validó persistencia real cross-session/cross-browser.

Supabase confirmó:
- perfil guardado;
- términos aceptados;
- `level_states.status = CALIBRANDO`;
- Nivel oficial persistido;
- exactamente 1 `initial_estimate`.

**Observación a re-chequear:** durante esa primera prueba se recorrió visualmente el camino recomendado/completo, pero una consulta posterior mostró `questionnaire_mode = quick`. Puede haber sido un efecto del flujo de reanudación/hotfix o una inconsistencia real. No darlo por cerrado sin revalidarlo expresamente.

---

## 5. Confirmación anticipada de email — validado parcialmente

Cuenta de prueba 2:
1. alta con email nuevo;
2. llegó a `TU PERFIL`;
3. SIN completar perfil se tocó `¿Ya tenés el código? Confirmar email ahora`;
4. OTP real recibido y confirmado;
5. volvió correctamente a `TU PERFIL`, sin entrar a Home.

Supabase confirmó:
- cuenta/identidad creada;
- `level_states.status = PENDIENTE`;
- sin username;
- sin Nivel oficial.

Esto valida que:

`email confirmado ≠ onboarding terminado`

y que Home sigue bloqueado correctamente.

---

## 6. Decisión NUEVA de producto — Nivel inicial universal

Durante la prueba apareció una contradicción real:

La pregunta final:
`¿En qué categoría suelen ser parejos tus partidos?`

solo podía ajustar el Nivel si existía un mapa local compatible (ej. Argentina masculino). Pero Bloque 3 deliberadamente ya no pide país/rama/género como requisito inicial.

Resultado observado:
- cambiar categoría podía no mover nada;
- la UI prometía “afinar tu nivel” aunque no tuviera contexto suficiente.

Decisión confirmada por Sebastián:

### V1
- eliminar la categoría local del onboarding inicial;
- eliminar la categoría como modificador numérico del Nivel inicial;
- no exigir país/rama/sistema competitivo para obtener Nivel;
- categoría queda como contexto posterior de Perfil/Ranking;
- el Nivel inicial es universal y luego se calibra con partidos reales.

Además se retiró del cuestionario completo la pregunta:

`Cuando competís en tu categoría habitual, ¿cómo suelen ser tus resultados?`

porque también depende de interpretar una categoría local.

Resultado:
- camino completo pasa de 7 a 6 preguntas;
- camino rápido conserva 5 descripciones;
- nueva versión del estimador: `nivel_inicial_v1_2`;
- motor de partidos permanece `nivel_bramu_v1_0`.

Se implementó en commit:
`5302f445` — `feat: make initial BRAMU level universal`

y se alinearon comentarios en:
`43e3d451` — `docs: align universal level onboarding comments`

La Edge Function `officialize-onboarding` se volvió a desplegar y quedó ACTIVE versión 2.

Registro:
`09_Decision_Nivel_Universal.md`

### Idea futura cercana — NO implementar ahora
Sebastián quiere conservar la sensación de agencia del usuario: evitar que la persona sienta “la app me puso una nota” y permitir una pequeña instancia de participación/confirmación del Nivel.

Pensar después una interacción:
- universal;
- acotada;
- sin categorías locales;
- sin permitir subir el Nivel arbitrariamente;
- quizás antes del piloto si entra sin ensuciar el onboarding.

Está documentado como propuesta futura, no como requisito de Bloque 3.

---

## 7. Estado visual actual después de V1.2

La pantalla de resultado ya muestra directamente:

`TU PUNTO DE PARTIDA EN BRAMU`

con:
- número;
- categoría descriptiva de comunicación (ej. Intermedio alto);
- texto aclaratorio;
- `CONFIRMAR MI NIVEL`;
- `Revisar respuestas`.

Ya NO muestra la pregunta de categoría local.

Sebastián verificó visualmente esta pantalla en Staging.

---

## 8. BUG ABIERTO ACTUAL — PRIORIDAD INMEDIATA

Esta es la situación exacta donde quedó la prueba:

La cuenta de prueba 2 ya había confirmado el email **anticipadamente** y había vuelto correctamente a `TU PERFIL`.

Después:
- completó perfil;
- siguió por Nivel;
- se aplicó el cambio V1.2;
- se recargó la página para recibir el bundle nuevo;
- llegó a la pantalla de resultado V1.2;
- al tocar `CONFIRMAR MI NIVEL`, la app volvió a pedir OTP.

Eso NO es lo esperado.

Contrato correcto:
si el email ya fue confirmado anticipadamente y hay sesión válida, al confirmar el Nivel debe:

`perfil completo + Nivel listo + email ya confirmado -> oficializar Nivel -> Home`

sin pedir OTP otra vez.

El OTP viejo devolvió “código venció”. Al tocar `Reenviar código`, la app mostró “código reenviado”, pero todavía no estaba confirmado que haya llegado un nuevo correo.

**No seguir insistiendo con códigos antes de revisar el flujo.**
Para una cuenta ya confirmada, la solución correcta probablemente sea detectar la sesión/email confirmado y saltar el step `verify`, ejecutando directamente `runOfficializeAndEnter()`.

Hay que inspeccionar:
- `confirmNivelOnboarding()`;
- restauración/reanudación de `signupDraft`;
- estado de sesión Supabase después de confirmación anticipada + refresh;
- lógica que decide `signupStep = 'verify'`.

No asumir que un resend de signup OTP sobre una cuenta ya confirmada es la solución.

---

## 9. Qué falta validar antes de cerrar Bloque 3

No marcar Bloque 3 como cerrado todavía.

Falta:

1. Corregir/validar el bug de confirmación anticipada + refresh que vuelve a pedir OTP.
2. Terminar cuenta de prueba 2 hasta Home.
3. Confirmar que queda:
   - `CALIBRANDO 0/5`;
   - un único `initial_estimate`;
   - estimador `nivel_inicial_v1_2`.
4. Revalidar expresamente ambos caminos:
   - rápido;
   - completo (6 preguntas).
5. Re-chequear la inconsistencia observada de `questionnaire_mode` de la cuenta 1.
6. Re-ejecutar después del cambio V1.2:
   - `verify-bloque2.mjs`;
   - `verify-bloque3.mjs`;
   - `verify-nivel-parity.mjs`.
7. Revalidar paridad browser/server con V1.2.
8. Confirmar reanudación/refresh del borrador sin pérdida.
9. Confirmar username ocupado/carrera si hace falta evidencia manual adicional.
10. Recién entonces actualizar documentación operativa y decidir cierre formal de Bloque 3.

---

## 10. Próximo movimiento recomendado

Primero resolver el bug de “email ya confirmado pero CONFIRMAR MI NIVEL vuelve a pedir OTP”.

No abrir todavía otro frente de producto.

Asignación sugerida:
- inspección/hotfix chico: ChatGPT central puede revisar GitHub y Supabase;
- si exige debugging profundo o tests locales complejos: Claude Code;
- Work solo si hace falta navegación visual.

Mantener foco en cerrar Bloque 3 antes de pasar a Bloque 4.

---

## 11. Regla de comunicación para Sebastián

Siempre indicar de forma explícita:

- **A QUIÉN** va la próxima instrucción: Sebastián / este chat / ChatGPT Work / Claude Code.
- Si hay que copiar algo a otra herramienta, entregar el texto completo en un único bloque de código listo para copiar.
- Para terminal/dashboard: un paso por vez.
- En hitos de cierre, decir explícitamente: **“acá podemos cortar tranquilos o seguir”**.
