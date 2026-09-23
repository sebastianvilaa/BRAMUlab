# BRAMUlab — Método de trabajo

> Guía operativa vigente para coordinación de agentes, commits, pruebas y deploys. Corta y aplicable — no es una filosofía de proceso.

---

## Fuentes de verdad

- Empezar siempre por `docs/BRAMUlab/README.md`.
- Después leer solo la fuente maestra del sistema afectado (README §2/§7 indica cuál).
- `Archivo/`, `Backup/` y handoffs ya consumidos **no son autoridad normal** — solo se leen ante pedido explícito de trazabilidad puntual.

## Separación de roles

- **ChatGPT central**: coordinación, producto, revisión, arquitectura, documentación y control de coherencia.
- **Claude Code**: implementación, análisis profundo del repo, migraciones, debugging y tests técnicos.
- **Work**: navegador real, GUI, Vercel y QA visual/manual cuando sea necesaria.
- **Sebastián**: puente mínimo, no operador técnico — decide producto y revisa resultado, no ejecuta comandos ni pruebas que un agente pueda correr.

## Brainstorming / producto

- Una idea nueva **no** se convierte automáticamente en desarrollo.
- Distinguir siempre entre:
  1. decisión ya confirmada;
  2. fricción encontrada;
  3. idea futura.
- No abrir frentes de implementación mientras un bloque dependiente sigue sin cerrar.
- Al cerrar una etapa relevante, tomar primero una "foto real del producto" antes de rediseñar pantallas que dependan de ella.

## Tareas medianas / grandes

- Consolidar contexto primero en un documento del repo.
- Pasar al siguiente agente un handoff corto que apunte a ese documento.
- Ese agente lee el documento y avanza autónomamente.
- Si aparece una decisión humana real, marcar `DECISIÓN ABIERTA` y continuar todo lo no bloqueado por ella.
- No repetir investigaciones grandes ya realizadas.

## Git / commits

- Evitar commits intermedios directamente sobre `staging`.
- Explorar, corregir y probar antes del push cuando sea posible.
- Revisar el diff final antes de commitear.
- Consolidar cada intervención en el menor número razonable de commits — idealmente uno solo, lógico y autocontenido.
- No crear commits solo para "probar por las dudas".
- Cambios únicamente documentales no deben provocar deploys de `bramulab` ni `bramulive` (ver `bramulab/vercel.json`/`bramulive/vercel.json` — `ignoreCommand`). El comando vigente compara `HEAD^` contra `HEAD` dentro de cada Root Directory. **No usar `VERCEL_GIT_PREVIOUS_SHA`**: Vercel puede entregar un clon superficial donde ese SHA histórico no exista y el Ignored Build Step falla con `fatal: bad object`.

## Pruebas

- Probar riesgos concretos, no todo por costumbre.
- Repetir pruebas cuando exista riesgo real de datos, identidad, auth, seguridad, migraciones o regresión.
- No repetir baterías equivalentes si ya existe evidencia suficiente.
- Work se usa para QA manual/visual únicamente cuando aporta evidencia que los tests automáticos no pueden dar.

## Recursos / cuotas

- Antes de una ronda técnica, considerar costo de contexto, créditos, commits y deploys.
- No gastar Work o Claude para releer historia ya consolidada.
- Evitar procesos que puedan alcanzar límites de Vercel u otras herramientas por actividad innecesaria.
- Los límites operativos (build-rate-limit, cuotas, etc.) forman parte del diseño del proceso, no un imprevisto externo.

## Entornos

- Desarrollo activo sobre `staging`.
- No tocar `main`, Production ni BRAMUlive salvo autorización o tarea explícita.
- Cambios de backend, siempre primero en Staging.

## Autonomía

- No pedirle a Sebastián comandos, navegación o pruebas que los agentes puedan ejecutar.
- Cuando su intervención sea necesaria, agruparla y reducirla al mínimo.
- Idealmente Sebastián decide producto al inicio de una ronda y revisa el resultado al final.
