# 147 — Handoff post-lanzamiento · primeros usuarios — 07OCT26

## Propósito

Este documento permite continuar BRAMUlab en un chat/agente nuevo sin reconstruir el contexto de la salida a Production ni repetir decisiones ya cerradas.

Leer primero:
1. `docs/BRAMUlab/README.md`
2. este documento
3. únicamente la fuente maestra del sistema que vaya a tocarse.

No usar `Archivo/`, `Backup/` ni handoffs históricos como autoridad salvo trazabilidad puntual.

---

## Estado operativo actual

- Producto: **BRAMUlab V04.37**
- Production: **ACTIVA** en `https://app.bramulab.com`
- Bundle vigente en Production: **04.37-h24**
- Commit funcional exacto de h24: `303d703896580d0cb50b457356194c5a4fb1f735`
- Deployment Production h24: `dpl_GoQTSQbtMhpY3bZN9L1hjHCWzszY`
- Staging estable: `https://bramulab-git-staging-bramu-lab.vercel.app/`
- Deployment Staging h24: `dpl_5DtuSNoRkSqEDPPhi3Z72T7TVYNL`
- Rama activa de trabajo: `staging`
- **No tocar `main`, Production ni BRAMUlive sin nueva autorización explícita.**
- Las promociones recientes a Production se hicieron desde el SHA aprobado de `staging`, sin mergear `main`.

BRAMU ya salió de la etapa puramente pre-Production: **el primer usuario real fue creado en Production el 07/10/2026 y ya empezaron a entrar amigos/primeros usuarios reales**. La prioridad inmediata no es agregar funciones sino detectar fricciones reales y resolver bloqueantes pequeños con rapidez y cuidado.

---

## Cambios cerrados inmediatamente antes de este handoff

### PWA / instalación — h20

Flujo de instalación móvil cerrado visualmente y publicado. Invitación tipo bottom sheet, guía iOS/iPadOS y lógica de recurrencia por dispositivo. No reabrir salvo regresión concreta.

### Legal + Perfil — h21 → h23

Decisiones ya confirmadas y publicadas:

- checkbox legal:
  **“Acepto los Términos y Condiciones, declaro haber leído la Política de Privacidad y autorizo el tratamiento de mis datos por proveedores fuera de Argentina.”**
- mismo cuerpo visual que las reglas de contraseña;
- links de Términos y Política subrayados, **sin verde**, mismo color que el resto del texto;
- **Categoría actual** retirada de la experiencia activa:
  - no se pide;
  - no se muestra;
  - no se edita;
  - no genera aviso de perfil incompleto;
  - el dato técnico/histórico no se destruye;
  - esto NO modifica la categoría/respuesta utilizada por el estimador de Nivel.
- género y rama siguen siendo campos distintos, pero la UI evita preguntar dos veces:
  - Masculino → rama Masculina por default;
  - Femenino → rama Femenina por default;
  - Otro / Prefiero no decir / sin género → se pregunta rama Femenina o Masculina cuando hace falta;
  - una rama explícita ya guardada prevalece y nunca se pisa por inferencia.

Bundle publicado de este bloque antes del hotfix de scroll: **04.37-h23**.

### Hotfix onboarding de Nivel — h24

Bug real reportado por uno de los primeros usuarios: en determinados móviles el cuestionario de Nivel podía dejar el CTA `CONTINUAR` fuera del viewport sin permitir desplazar la pantalla.

Fix h24:
- `#view-nivel-onboarding` queda limitado al viewport;
- su `.access-scroll` tiene scroll vertical;
- no se tocaron preguntas;
- no se tocó fórmula;
- no se tocó slider;
- no se tocó Supabase/backend;
- no hubo migración.

Se aprobó por ser un bloqueante real de altas y se promovió directamente después del fix acotado en Staging.

---

## Regla para primeros usuarios

Estamos en una fase de **uso real temprano**, no en un piloto descartable.

Prioridad:
1. bloqueantes de alta/login/OTP/onboarding;
2. pérdida, corrupción o mezcla de identidad/datos;
3. carga/validación/duplicados de partidos;
4. problemas visuales que impidan completar una acción;
5. recién después, mejoras de conveniencia.

No transformar cada comentario aislado en una función nueva. Observar patrón antes de ampliar alcance.

---

## Partidos “en joda”, datos incorrectos y limpieza

Decisión conceptual confirmada en conversación:

- si una carga sigue pendiente y nadie la reconoció, existe **Anular carga**;
- si un partido ya quedó oficial pero es inventado, duplicado o incorrecto, BRAMU puede corregirlo, invalidarlo o excluirlo del cómputo preservando trazabilidad;
- no borrar filas a ciegas cuando un partido impacta en terceros, Nivel, Ranking, estadísticas o Intelligence;
- si una cuenta de prueba queda contaminada, puede evaluarse limpieza/eliminación administrativa después de inspeccionar sus relaciones;
- eliminar una cuenta no borra automáticamente el historial compartido de terceros;
- **no construir todavía un panel admin** solo por esta fase: resolver casos excepcionales de forma controlada mientras el volumen sea bajo.

Si el usuario pide “borrá estos partidos” o “limpiá esta cuenta”, primero identificar exactamente las entidades afectadas y el impacto deportivo antes de ejecutar.

Fuente maestra legal relacionada: `Privacidad_Legal.md`.

---

## Forma de trabajo a mantener

- Staging primero para cualquier cambio nuevo.
- Production solo con aprobación explícita del usuario.
- Microfixes bloqueantes pueden ser ejecutados por Central sin handoff innecesario a Claude.
- Cambios medianos/grandes: consolidar contexto y delegar ejecución larga.
- No pedirle al usuario comandos, navegación técnica ni pruebas redundantes que los agentes puedan resolver.
- Backend siempre primero en Staging.
- No tocar BRAMUlive.
- No inventar estadísticas ni estados deportivos.
- Nivel y Ranking son sistemas distintos.

---

## Próximo foco recomendado

No hay una gran feature pendiente para abrir desde este corte.

El siguiente chat debe funcionar como **torre de control de los primeros usuarios reales**:
- recibir feedback;
- clasificarlo como bloqueante / bug / fricción / idea;
- resolver rápido solo lo que impide uso real;
- acumular observaciones antes de reabrir producto.

Si vuelve a aparecer el problema de scroll después de h24, pedir solo dispositivo/navegador/pantalla exacta si hace falta y verificar si el usuario realmente recibió el bundle nuevo antes de modificar más CSS.

---

## Prompt corto para abrir el próximo chat

```
Continuamos BRAMUlab desde el lanzamiento con primeros usuarios reales.

Leé primero:
- docs/BRAMUlab/README.md
- docs/BRAMUlab/Implementacion/Post_Lanzamiento/147_Handoff_Primeros_Usuarios_07OCT.md

Tomá esos documentos como contexto vigente. No reconstruyas trabajo histórico ni reabras decisiones cerradas.

Production está activa en https://app.bramulab.com con bundle 04.37-h24.
Staging sigue siendo el entorno de trabajo.
No tocar main, Production ni BRAMUlive sin mi autorización explícita.

La prioridad ahora es acompañar el uso de los primeros usuarios reales: detectar bloqueantes, bugs y fricciones, y evitar agregar funciones innecesarias.
```
