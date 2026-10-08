# BRAMUlab — Salida a Production (cerrada) y pendientes posteriores

**Estado:** la salida a Production **se completó el 07/10/2026** (`https://app.bramulab.com`). Este documento reemplaza al consolidado pre-Production del 23/09 (≈ 40 KB de requisitos P0, ya cerrados) y conserva solo lo que sigue vivo: el estado de cada frente de salida, los pendientes reales, el pulido P1 y las reglas «no reabrir». Cómo funciona cada sistema lo dicen sus fuentes maestras (`README.md` §2); los datos reales de infraestructura, legal y AAIP están en `Operacion_Vercel_Staging_Production.md`.

> Regla de lanzamiento vigente: cuando entra el primer usuario real en Production, BRAMU ya empezó. Production no es un piloto descartable: las cuentas, partidos, historial y Nivel reales son permanentes y conservan continuidad entre versiones (`README.md` §1.1).

---

## 1. Frentes de salida — todos cerrados

| Frente | Resultado | Fuente maestra / evidencia |
|---|---|---|
| **P0.1 Estado Cero / progresión temprana** | CERRADO / PASS Central (06/10) con cuenta de 0 y de 1 partido reales | `Experiencia_Inicial.md`; `Implementacion/Pre_Production/146_Cierre_R1_Estado_Cero_Primer_Partido_06OCT.md` |
| **P0.1B Ranking automático** | CERRADO: sin opt-in; la UI solo pide rama/localidad; `ranking_opt_in` es campo legacy que no decide elegibilidad | `Ranking_BRAMU.md` |
| **P0.1C Perfil editable server-backed** | CERRADO en Staging (foto/avatar en bucket privado con URL firmada, WhatsApp con consentimiento, `Categoría actual` retirada de la experiencia activa) | `Backend_Infraestructura.md`, `Experiencia_Inicial.md` |
| **P0.2 Legal / Privacidad** | CERRADO y publicado (sin placeholders); resta el número definitivo de AAIP | `Privacidad_Legal.md`; datos reales en `Operacion_Vercel_Staging_Production.md` |
| **P0.3 Eliminación de cuenta** | CERRADO: autoservicio con OTP, anonimización, `Jugador eliminado`, reingreso = identidad nueva desde cero | `Privacidad_Legal.md` §3 |
| **P0.4 Acceso V1** | CERRADO: email + contraseña; recuperación por OTP; `@usuario` es identidad pública, no credencial | `Privacidad_Legal.md` §2, `Backend_Infraestructura.md` |
| **P0.4B Grupos BRAMU** | CERRADO: server-backed, top 2, Americano, lobby, foto, QA integral (Issue #6 y #23) | `Grupos_BRAMU.md` |
| **P0.4C Invitados / identidad / recuperación** | CERRADO (V04.29 → V04.35) | `Backend_Infraestructura.md` §9; `122_Cierre_Central_Invitados_V0429_h2_03OCT.md` |
| **P0.5 Hardening / salida (Pre-Bloque 9, 9A, 9B, G1, G2, G3, G4 parcial)** | CERRADO salvo la decisión de backups gestionados (G4) | `Runbook_Operacion_y_Salida.md`; evidencia `82_…`, `84_…`, `87_…`, `90_…` |
| **Hardening de exposición / IP** | CERRADO en Staging (06/10) | `138_…`, `139_…` |

## 2. Pendientes reales después del lanzamiento

1. **AAIP/RNBDP:** esperar el número definitivo del expediente y reemplazar el texto público «presentada y pendiente» (procedimiento en `Operacion_Vercel_Staging_Production.md`).
2. **Smoke humano mínimo de Production** (carga, acceso/crear cuenta, Términos y Privacidad, logo de emails desde el dominio público).
3. **G4 — backups gestionados:** Supabase Production está en plan Free (logs 24 h, sin ventana de restauración administrada). Decidir plan/retención/backups y probar una restauración real antes de prometer nada (`Runbook_Operacion_y_Salida.md`, «Backup»).
4. **QA humano de la fecha de nacimiento en Android** (`showPicker()` de V04.37-h26, no reproducido en Samsung real).
5. **Repositorio público, GitHub Pages y logo de emails en `raw.githubusercontent.com`:** intervención independiente con autorización específica y verificación previa de BRAMUlive/Pages (`138_…`, `139_…`). Nada de esto se cambia como efecto colateral de otra ronda.
6. **BRAMU Metrics:** en desarrollo; se gobierna por su propia cadena de documentos (`README.md` §3).
7. Operación con usuarios reales (triage, partidos «en joda», limpieza de cuentas): `Runbook_Operacion_y_Salida.md`, Parte C.

## 3. Pulido P1 (no bloquea; verificar contra el estado actual antes de implementar)

Cambios primero en Staging, promoción posterior con aprobación de Sebastián.

### P1.1 — Pulido de primera impresión

- copy definitivo de Estado Cero;
- copy definitivo de TU MOMENTO;
- revisar si la Home ya se siente “formándose” en vez de vacía;
- motion/intensidad exacta del destacado accionable.

No cambiar estructura ni reglas ya cerradas.

### P1.2 — Edge cases visuales del ciclo de partido

Validar visualmente, sin rediseñar backend:

- copy final de `PARTICIPACIÓN CUESTIONADA`;
- representación de `Jugador no identificado`;
- nivel exacto de detalle before/after en `Modificaciones`;
- si mostrar autor en cada fila compacta de Historial o solo en detalle;
- **consistencia visual del estado pendiente:** en Home, `Último partido` usa el borde ámbar pleno (`var(--gold)`), mientras que el `Resumen del partido` pendiente usa `rgba(255,201,61,0.45)`. En la próxima ronda visual, **REEMPLAZAR** únicamente el `border-color` de `.result-card.result-card--pending` para equipararlo al borde ámbar pleno de Último partido. Mantener el glow/sombra sutil actual salvo revisión visual posterior; no tocar lógica ni otros estados.
- **identidad corregida pre-validación — bloque partido fragmentado:** cuando un participante es corregido antes de validar, el Resumen vuelve a separar la tarjeta de resultado y el bloque contextual/acciones. Esto contradice el cierre h24 de “una sola tarjeta”. **FUSIONAR** también el estado `identity_replacement` dentro de la misma `.result-card.result-card--pending`: para quien debe actuar, contexto + acciones `Reportar un error` / `Validar partido` dentro de la tarjeta; para quien espera, contexto de espera dentro de la misma tarjeta. No crear una segunda card/banda separada.
- **Home accionable tras corrección de participante — actor/evento incorrecto:** hoy el carousel de Home usa `createdByPlayerId` para el copy de cualquier pendiente accionable y puede mostrar al propio creador “Esteban cargó un partido con vos” aunque la acción actual exista porque otro jugador corrigió un participante. **REEMPLAZAR** ese fallback para estados `identity_replacement` por copy contextual basado en el evento/actor real de la corrección cuando esté disponible; ejemplo aprobado de intención: `Seba corrigió un participante. Revisá el partido.` Nunca atribuir la carga como evento actual si lo accionable es una corrección posterior.

Son mejoras de claridad; el dato y la lógica ya existen.

### P1.3 — Revisión visual corta de Mi Perfil / Perfil público

Una vez corregido Estado Cero:

- comprobar progresión con 0 / 1 / varios partidos;
- comprobar nombres largos;
- comprobar que no reaparezcan módulos vacíos;
- comprobar que Ranking/Nivel no ocupen espacio con estados falsos.

## 4. Cosas que NO deben volver a presentarse como pendientes

No reabrir sin regresión concreta:

- Nivel BRAMU;
- Ranking V1;
- BRAMU Intelligence V1 A–E;
- base técnica de provisionales/claim del Bloque 4;
- búsqueda real;
- create-or-attach;
- historial compartido;
- validación por parejas;
- correcciones 3 días;
- identidad 10 + 7;
- pendiente 30 días;
- carga retroactiva 14 días;
- límite de 5 pendientes accionables;
- separación BRAMUlab / BRAMUlive;
- Ranking semanal;
- ocultamiento personal de partidos;
- recuperación de contraseña de Staging;
- SMTP de Staging;
- QA ya cerradas de Bloques 1–8.

## 5. Evolución posterior a Production

Abrir Production **no congela** Nivel, Ranking, Grupos ni Intelligence. Cada sistema puede evolucionar siempre que:

- los datos reales históricos se conserven;
- los cambios de algoritmo o reglas queden versionados y documentados;
- cualquier migración o reinterpretación de datos sea explícita y auditable;
- no se reescriba el pasado silenciosamente (Ranking publicado inmutable);
- cada sistema pueda cambiar sin obligar a rehacer los demás salvo dependencia real.

Ejemplo: Nivel BRAMU puede pasar de V1 a V2 tras observar comportamiento real; la estrategia de transición (continuidad desde una fecha, recálculo controlado u otra) se decide en ese momento, con trazabilidad.

## 6. Cierre documental (hecho el 08/10/2026)

La «Etapa 5» planificada acá (README como mapa corto, una fuente maestra por sistema, poda de handoffs consumidos, sin `Backup/` duplicado) se ejecutó el 08/10/2026: ver `README.md` §4 y `Metodo_Trabajo.md`, «Higiene documental». La historia de las rondas V04.11–V04.37 quedó en `Versiones/BRAMUlab_V04/BRAMUlab_V04_Informe.md`; los riesgos conocidos y las ideas futuras, en `BRAMUlab_Backlog.md`. Falta, como parte de la misma etapa, un tag de release (decisión de Sebastián, no ejecutada).
