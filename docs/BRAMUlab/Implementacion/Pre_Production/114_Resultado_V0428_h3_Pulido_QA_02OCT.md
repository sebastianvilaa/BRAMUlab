# Resultado — V04.28 · bundle 04.28-h3 (pulido post-QA iPhone)

**Base:** `6b5c0bf` (funcional h2 `48d29c2` + 2 commits docs conservados). Solo frontend; sin Edge/Supabase/DB. Spec: `113_Handoff_V0428_h3_QA_Humano_02OCT.md`.

## Cambios
- **Intro:** mismo copy; texto casi blanco (`--paper`), 16 px, interlineado 1,6; meta «5 PREGUNTAS · CERCA DE 2 MINUTOS» 13 px y más contraste. Sin estructura nueva.
- **Slider (vertical, 10 posiciones intactas):** helper nuevo «Tocá una descripción. Si estás entre dos opciones, usá el control para ajustar tu respuesta.»; solo se dibujan los 4 dots-ancla (los 6 intermedios siguen en el DOM y seleccionables); thumb azul con pico a la derecha (hit area sin cambios); énfasis ponderado por `--w` (100/0, 67/33, 33/67, 0/100) aplicado a fondo/borde/glow, sin tocar la opacidad del texto.
- **Resultado:** número ámbar (`--gold`) con CALIBRANDO; arco azul; valor sin cambios.
- **Bug OTP/volver:** `openNivelOnboardingIntro()` (contexto draft) reconstruye el estado desde `signupDraft.nivelAnswers/nivelState` (única fuente una vez confirmado) y muestra el resultado ya calculado; «Revisar respuestas» vuelve a P1 con las respuestas y la invalidación adaptativa vigente. `NIVEL_PROGRESS` se sigue limpiando al confirmar; oficialización exitosa limpia borrador/progreso como antes. Auth/OTP intactos.
- **Home Estado Cero:** solo la rama sin partidos de `renderPlayerLastMatchCard`: eyebrow PRIMER PARTIDO, título CARGÁ TU PRIMER PARTIDO, bajada y CTA lima full-width CARGAR PARTIDO (el click de la tarjeta sigue abriendo Cargar partido). Con partido real (incl. pendiente) se renderiza el partido como antes.

## Tests
Node 785/788 (3 fallos preexistentes h19-B, h21-9, h23). Nuevos `h3-*` en `v0428-nivel-inicial-v13.test.mjs` (intro, slider, pesos 100/0·67/33·33/67·0/100, adaptatividad, resultado ámbar, reconstrucción desde draft, Home, motor/versionado). Verificado en Browser pane (375 px): intro, slider con intermedio (0,667/0,333), resultado ámbar, Home con la tarjeta nueva.

## No verificado
Touch real en iPhone y el flujo OTP real (Auth no configurado en local; cubierto con la función real en harness). Documentación final de Nivel y cierre de #25: pendientes del PASS humano.
