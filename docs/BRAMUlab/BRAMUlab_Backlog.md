# BRAMUlab — Backlog

Ideas y direcciones futuras **no autorizadas todavía para implementar**. Nada de este documento se construye directo desde acá — siempre pasa primero por un consolidado de una versión (`BRAMUlab_V0#_Consolidado.md`). Unifica en un solo lugar lo que antes estaba disperso en varios documentos de backlog sueltos.

---

## 1. Modelo de validación de partidos (Pendiente / Validado / Disputado / Observado)

**Fuente original, preservada íntegra:** [`Archivo/BRAMU_Backlog_Futuro_Validacion_Partidos.md`](Archivo/BRAMU_Backlog_Futuro_Validacion_Partidos.md).

**Principio rector:** quien registra un partido no necesariamente es quien lo juega — BRAMU debe separar siempre al autor del registro de los participantes. "Los de afuera son de palo": un espectador puede producir un registro valioso, pero no puede modificar el Nivel BRAMU, el ranking ni las estadísticas oficiales.

**Modelo conceptual:**
- **Partido declarado por un participante:** el cargador declara en representación de su pareja (validado por origen); se vuelve oficial con la confirmación de al menos un integrante del equipo rival. El rival puede confirmar, proponer corrección (con motivo) o indicar que no participó. Mientras falta confirmación, el partido queda **Pendiente** y no afecta Nivel BRAMU ni rankings. Una corrección sobre un dato relevante vuelve a poner el partido en pendiente. No fijar todavía un límite de ediciones — preferir historial de revisiones y pasar a **Disputado** ante abuso/desacuerdo repetido.
- **Partido registrado por un espectador:** el flujo es "Registrar partido en vivo → Completo o Por Games". No modifica Nivel BRAMU, rankings, efectividad ni rachas oficiales; queda identificado como "Registrado por [persona]" y se guarda como **Observado**.
- **Qué datos pueden afectar el Nivel BRAMU (futuro):** solo identidad de participantes, resultado final, fecha real, formato, y validación mínima de un participante por equipo — nunca puntos/breaks/highlights, que enriquecen el análisis pero no determinan el nivel.
- **4 estados conceptuales:** Pendiente de validación, Validado, Disputado, Observado.
- **Historial con pestañas:** Todos / Mis partidos / Observados / Pendientes (con contador), ordenado siempre por fecha real de juego. La modalidad de registro (Resultado/Por Games/Completo) es filtro secundario, no pestaña principal.
- **Competiciones con premios (más adelante):** la validación por un jugador por equipo alcanza para uso social; con premios/torneos reales haría falta un nivel de confianza adicional (organizador/club verificado).
- **Consideración arquitectónica para cuando se implemente:** el modelo de partido debe contemplar, conceptualmente, campos separados para id estable, autor del registro, participantes, fecha real, modalidad/nivel de detalle, estado de validación, historial de correcciones, y vínculo opcional con un registro observado — sin construir todavía cuentas, notificaciones, confirmaciones, disputas ni rankings reales.

**Estado real hoy (BRAMUlab_V01, v2.2.1):** los filtros de Historial por Todos/Mis partidos/Observados y por modo ya existen en UI (shipped en v2.1) y usan la terminología de este backlog, pero los estados Pendiente/Validado/Disputado en sí — y toda la lógica de confirmación entre rivales — **no existen todavía**. Nada de esto se implementa hasta que haya un consolidado específico que lo autorice.

---

## 2. Identidad real (cuentas / sesión) — reemplazo del modelo de nombre libre

**Fuente:** nota de diseño en [`Versiones/BRAMUlab_V01/Archivo/BRAMU_Rama_Jugador_Auditoria_Funcional.md`](Versiones/BRAMUlab_V01/Archivo/BRAMU_Rama_Jugador_Auditoria_Funcional.md), §9.

Hoy el jugador actual es un nombre de texto libre, tratado como preferencia liviana y reemplazable — coherente con la beta, pero no con hacia dónde va el producto. Cuando exista una capa real de sesión/cuenta:
- "Cambiar jugador" (ya renombrado a **"Cerrar sesión"** en la corrección funcional de la Etapa 2, ver [`Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md`](Versiones/BRAMUlab_V01/BRAMUlab_V01_Informe.md) §1.1) debería separarse conceptualmente de "elegir quién sos la primera vez" — hoy ambos casos reutilizan el mismo modal "¿Quién sos?", razonable en la beta pero no con cuentas reales.
- A más largo plazo, evaluar si vale la pena normalizar diacríticos en `Store.normalizePlayerName` como red de seguridad adicional — de valor menor una vez exista identidad real, porque deja de depender de que alguien retipee el nombre igual cada vez.

Esta nota está ligada al pivote de comunidad/cuentas de más largo plazo (ranking, ver §3).

---

## 3. Pivote de comunidad — cuentas, ranking, torneos

No viene de un documento de backlog específico — es la dirección de más largo plazo que Sebastián viene charlando con ChatGPT desde el origen del proyecto (ver memoria de sesión `project_bramu_lab_origin`). Resumen:

- Cuentas de usuario reales (no nombres de texto libre) para que un partido cargado impacte automáticamente el historial de ambos jugadores.
- Ranking consciente del nivel del rival ("no debería dar lo mismo si le ganaste a alguien mejor que vos o no").
- Posible ángulo de monetización más cercano: ofrecer la app a organizadores de torneos para registrar una final y entregar un informe pulido a los jugadores.
- **No está autorizado ni planificado como próxima ronda** — es contexto para no tomar decisiones estructurales que compliquen este pivote más adelante (ej. no asumir de forma dura un solo dispositivo por jugador donde sea evitable), sin construir nada de esto todavía.

---

## 4. Motion / sistema de movimiento de marca

**Fuente original:** [`Versiones/BRAMUlab_V01/Archivo/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md`](Versiones/BRAMUlab_V01/Archivo/BRAMU_Lab_Etapa_3_Adenda_Producto_UX_02SEP2026.md) proponía tres movimientos de marca: **Rebote** (pique de pelota, para confirmaciones/éxito, uso poco frecuente), **Latido** (glow/respiración sutil para estados activos: partido en curso, Punto de Oro) y **Desplazamiento** (transiciones de hojas, nativo y rápido). Regla transversal: respetar `prefers-reduced-motion`, reemplazando desplazamientos por fades simples.

**Estado:** en gran parte ya recogido por [`Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md`](Versiones/BRAMUlab_V02/BRAMUlab_V02_Consolidado.md) §3.6 (Motion) — no hace falta una ronda separada para esto; verificar al implementar V02 que cubre lo mismo que proponía la Adenda.

---

## 5. Otros ítems fuera de alcance repetidos en cada consolidado de BRAMUlab_V01 y BRAMUlab_V02

Listados de forma consistente como "no implementar todavía" en múltiples rondas — no son un plan, solo lo que queda explícitamente afuera hasta nuevo aviso:

- Base de datos y autenticación real.
- Usuarios, amigos y grupos.
- Nivel/ranking competitivo real (más allá de la simulación actual).
- Rediseño estructural definitivo del marcador en vivo.
- Procesamiento inteligente de notas privadas; compartir notas con coach/profesor.
- Personalización de tarjetas, Dynamic Island, rebranding final del logo.
