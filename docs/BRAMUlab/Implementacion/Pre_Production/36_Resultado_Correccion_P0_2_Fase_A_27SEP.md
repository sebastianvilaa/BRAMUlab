# BRAMUlab — Resultado: corrección de contradicciones en P0.2 Fase A

**Rama:** `staging`
**Fecha:** 27/09/2026
**HEAD base:** `5b8e4ed` (`docs(preprod): preparar P0.2 Fase A - borradores legales para revision`)
**Origen:** handoff [`35_Handoff_Correccion_P0_2_Fase_A_27SEP.md`](35_Handoff_Correccion_P0_2_Fase_A_27SEP.md), corrección tras la revisión central de la Fase A de P0.2.

**Cero cambios en `bramulab/` (frontend), bundle `04.11-h10`, `TERMS_VERSION`, migraciones ni deploy.** Esta ronda corrige exclusivamente texto en documentación/borradores legales — nada de código.

---

## 1. Regla de autoridad aplicada

Para cada corrección se usó la fuente maestra vigente del sistema afectado, nunca la mera existencia de una columna/campo/comentario histórico en el código como si fuera la regla actual de producto — tal como pedía el handoff. En particular, `docs/BRAMUlab/Ranking_BRAMU.md` (actualización del 24/09/2026, "participación automática") prevalece sobre el campo legacy `ranking_opt_in` y sobre cualquier copy de UI que todavía no se haya actualizado a esa decisión.

---

## 2. Las 4 contradicciones corregidas

### A — Ranking BRAMU no es opt-in

**Contradicción:** los 2 borradores y el documento 34 describían la participación en Ranking como una función que el jugador "activa" o "elige", "opcional" y "desactivada por defecto".

**Fuente maestra que resolvió el conflicto:** `docs/BRAMUlab/Ranking_BRAMU.md`, actualización del 24/09/2026 ("participación automática") — línea 9 del documento y §6 ("La participación es **automática**: no existe opt-in/opt-out ordinario. Un jugador deja de ocupar posición únicamente por reglas objetivas de elegibilidad, actividad, ubicación/rama, integridad o estado de cuenta"). `ranking_opt_in` queda explícitamente como "campo legacy de compatibilidad; no decide elegibilidad desde 24/09/2026".

**Corrección aplicada:**
- `Privacidad_Borrador_V1.md §2.2` (tabla): rama competitiva y localidad pasan de "solo si querés participar del Ranking" a "se pide cuando empieza a hacer falta para ubicarte en el Ranking, que es automático".
- `Privacidad_Borrador_V1.md §2.3`: mismo ajuste en el párrafo de ubicación.
- `Privacidad_Borrador_V1.md §2.8`: reescrito por completo — participación automática al cumplir elegibilidad, sin opt-in/opt-out ordinario, un jugador `CALIBRANDO` puede explorar sin ocupar posición propia todavía.
- `Privacidad_Borrador_V1.md §3` (finalidades) y `§4.1` (compartido dentro de BRAMU): "si elegís participar"/"si participás" reemplazado por "entre los jugadores que cumplen los requisitos de elegibilidad vigentes"/"cuando cumplís los requisitos de elegibilidad".
- `Terminos_Borrador_V1.md §2`: "participar ... si así lo elegís" → "cuando cumplís los requisitos de elegibilidad".
- `Terminos_Borrador_V1.md §7`: reescrito por completo con el mismo criterio que Privacidad §2.8.
- `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`: sección "Nivel BRAMU / Ranking BRAMU / Intelligence" corregida, dejando explícito qué decía antes (incorrecto) y por qué cambia, citando la fuente maestra.

### B — "Categoría actual" no es un dato público

**Contradicción:** `Privacidad_Borrador_V1.md §2.2` marcaba "Categoría declarada" como visible a otros jugadores ("Sí, si la completaste").

**Fuente maestra que resolvió el conflicto:** el propio código, `bramulab/app.js` (comentario explícito: "para cuentas server-backed, 'Categoría actual' muestra `profiles.current_category` ... NUNCA `level_states.declared_category`" y la propia estructura de pestañas del Perfil, donde "Categoría actual" vive únicamente en la pestaña **MIS DATOS**, nunca en **MI PERFIL**/Perfil público). Confirmado además contra `get_public_profile` (la RPC de lectura pública real): no selecciona `profiles.current_category` en ningún punto.

**Corrección aplicada:**
- `Privacidad_Borrador_V1.md §2.2` (tabla): "Categoría declarada | No | Sí (si la completaste)" → "Categoría actual (autoevaluación deportiva) | No | **No** — privada, solo vos la ves (vive en 'Mis datos', nunca en tu Perfil público)".
- `Privacidad_Borrador_V1.md §4.1`: la categoría se agregó explícitamente a la lista de datos privados que nunca se muestran a otros.
- `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md` — sección "Perfil": se agregó `current_category` a la lista de campos que nunca se exponen (junto a `gender`/`birth_date`/`phone`), con la aclaración de que es distinta de `level_states.declared_category` (contexto histórico del onboarding de Nivel, tampoco público) — para que quede explícito que no se está confundiendo ninguna de las dos categorías.

No se tocó ninguna otra sección que ya trataba correctamente la categoría (por ejemplo, su inclusión en la lista de datos que se anonimizan al eliminar una cuenta — eso sigue siendo correcto, es sobre qué se borra, no sobre visibilidad).

### C — Separación BRAMUlive: no inventar más de lo confirmado

**Contradicción:** ambos borradores afirmaban que BRAMUlive tiene "su propia infraestructura y aplicación" (Privacidad) y "su propia app y sus propios términos" (Términos) — ninguna de esas 2 afirmaciones está cerrada por producto.

**Fuente maestra que resolvió el conflicto:** `docs/BRAMUlab/Backend_Infraestructura.md` §4.2 y comentarios explícitos del código (`bramulab/app.js`, `bramulab/sw.js`) — lo único confirmado es que "el marcador en vivo dentro de BRAMUlab: pertenece a una aplicación/producto separado (BRAMUlive) y no forma parte del alcance de esta app". No hay ninguna fuente que confirme cuentas/infraestructura/documentos legales compartidos o separados entre ambos productos.

**Corrección aplicada:** en ambos borradores, la frase se reemplazó por la redacción mínima que el handoff pidió textualmente: *"El marcador y seguimiento en vivo pertenecen a BRAMUlive, un producto separado y fuera del alcance de BRAMUlab"*, agregando un `[DECISIÓN ABIERTA]` explícito aclarando que la política de cuentas/infraestructura/documentos legales compartidos o separados entre ambos productos todavía no está definida — el documento no asume ninguna de las dos opciones.

### D — Proveedor de email: no afirmar más de lo demostrado

**Contradicción:** `Privacidad_Borrador_V1.md §4.2` y `34_Resultado...md` atribuían directamente a Supabase el "envío" de los correos de confirmación/recuperación, como si fuera un hecho técnico ya fijado.

**Fuente maestra que resolvió el conflicto:** el propio contrato de infraestructura (`docs/BRAMUlab/Backend_Infraestructura.md` §3.1: "Correo transaccional: proveedor SMTP externo configurado y probado" — un componente separado y configurable por entorno, no necesariamente el mismo servicio que gestiona la autenticación) — Staging y Production pueden no compartir proveedor de entrega, y el código no nombra ningún SMTP específico.

**Corrección aplicada:**
- `Privacidad_Borrador_V1.md §4.2`: reescrito para separar con precisión "Supabase gestiona la autenticación de tu cuenta" de "los correos se envían a través de la infraestructura de email configurada para el servicio" (sin atribuírselo a Supabase como hecho fijo), agregando un `[DECISIÓN ABIERTA]` explícito sobre el proveedor SMTP concreto, todavía no definido de forma estable.
- `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`: misma corrección, dejando explícito qué decía antes y por qué cambia.

No se inventó ningún proveedor concreto (Gmail/Resend/SendGrid/etc.) en ningún punto de la corrección.

---

## 3. Barrido completo — otras contradicciones encontradas

Se hizo un grep exhaustivo de patrones equivalentes (`opt-in`, `si elegís`/`si querés participar`/`si activás`, `categor`, `BRAMUlive`/`propia infraestructura`/`propia app`/`propios términos`, `gestionado internamente por el proveedor`) sobre los 5 archivos indicados por el handoff (`Privacidad_Borrador_V1.md`, `Terminos_Borrador_V1.md`, `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md`, la nota de estado de `02_Borrador_Legal_Privacidad_V1.md`, y el bloque P0.2 de `Pre_Production.md`).

**No se encontró ninguna contradicción adicional.** La nota de estado agregada a `02_Borrador_Legal_Privacidad_V1.md` en la ronda anterior no contenía ninguna de las 4 categorías de error (solo apunta a los borradores nuevos). El bloque de estado de P0.2 en `Pre_Production.md` tampoco las contenía — se le agregó una línea de trazabilidad apuntando a este documento, sin necesidad de corregir contenido.

No se amplió el alcance a mejoras de redacción generales — solo se tocó lo que efectivamente contradecía una fuente maestra vigente.

---

## 4. Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `docs/BRAMUlab/Legal/Privacidad_Borrador_V1.md` | Correcciones A, B, C, D — ver §2 arriba |
| `docs/BRAMUlab/Legal/Terminos_Borrador_V1.md` | Correcciones A, C — ver §2 arriba |
| `docs/BRAMUlab/Implementacion/Pre_Production/34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md` | Correcciones A, B, D + nota de corrección en el encabezado |
| `docs/BRAMUlab/Pre_Production.md` | Línea de trazabilidad agregada al bloque de estado P0.2, apuntando a este documento |
| `docs/BRAMUlab/Implementacion/Pre_Production/36_Resultado_Correccion_P0_2_Fase_A_27SEP.md` | Este documento |

`docs/BRAMUlab/Implementacion/Pre_Production/02_Borrador_Legal_Privacidad_V1.md` no requirió cambios — su nota de estado (agregada en la ronda anterior) no contenía ninguna de las 4 contradicciones.

---

## 5. Confirmación: 0 cambios en `bramulab/`

```
git diff --stat -- bramulab/
```

Sin salida — ningún archivo de frontend fue tocado en esta ronda ni en la anterior de P0.2. `TERMS_VERSION`, el bundle `04.11-h10`, y ninguna migración fueron modificados.

---

## 6. Decisiones abiertas que siguen pendientes

Las mismas 8 de `34_Resultado_P0_2_Fase_A_Preparacion_Legal_27SEP.md §4` — ninguna decisión legal/humana se cerró en esta ronda de corrección, y no se inventó ninguna definición nueva:

1. titular/responsable legal del servicio;
2. email/canal de contacto legal-soporte público;
3. edad mínima de usuarios (menores);
4. jurisdicción/ley aplicable;
5. plazos exactos de conservación de cada categoría de dato;
6. si corresponde inscripción ante la AAIP;
7. país/región de procesamiento de datos de Supabase/Vercel (y ahora también, explícitamente, la ubicación del proveedor SMTP una vez que se defina);
8. redacción final de propiedad intelectual/limitación de responsabilidad/consecuencias de incumplimiento.

Además, esta ronda dejó explícita una novena área todavía sin cerrar, señalada por la propia corrección C: la política de cuentas/infraestructura/documentos legales compartidos o separados entre BRAMUlab y BRAMUlive.

---

## 7. Próximo paso de Central

1. Confirmar que las 4 correcciones reflejan correctamente las fuentes maestras vigentes.
2. Continuar con el resto del plan ya definido en `34_Resultado...md §8` (resolver las decisiones abiertas, revisión legal profesional real, integración técnica cuando el texto esté aprobado).

**P0.2 sigue sin cerrarse** — esta ronda corrige exactitud de los borradores, no avanza su aprobación legal ni su integración técnica.
