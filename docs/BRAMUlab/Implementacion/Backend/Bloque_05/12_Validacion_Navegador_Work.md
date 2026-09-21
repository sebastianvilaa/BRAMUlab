# Backend Bloque 5 — Validación real de navegador en Work

**Fecha:** 21/09/2026 UTC (el partido se fechó 20/09/2026 en la UI).  
**Rama:** staging. **HEAD probado:** bdff6466cbb8e617cd2fabea45a94bdbdd86f438.  
**Preview:** https://bramulab-git-staging-bramu-lab.vercel.app/  
**Cuenta:** @sebas. **Bundle:** 04.10-h14. **Backend frontend:** referencia serxtivkfnptzurnvewg (bramulab-staging), comprobada sin publicar credenciales.  
**Alcance:** navegador real; no se modificó código, Supabase directamente, configuración de Vercel, main, Production, BRAMUlive ni Bloque 6.

## Evidencia de entorno y límites

La rama staging apuntaba a bdff6466cbb8e617cd2fabea45a94bdbdd86f438. El estado GitHub de ese commit indicó deployment exitoso «Vercel – bramulab». Se utilizó el alias de Preview de la rama staging; los scripts cargados tenían sufijo 04.10-h14 y la configuración pública apuntaba al ref de Supabase Staging. El conector de Vercel no permitió leer los metadatos del deployment (403 de autorización), por lo que la vinculación al SHA se apoya en el estado del commit y el alias de rama, no en la ficha interna de Vercel. Ningún error de la app bloqueó la navegación; la consola registró únicamente mensajes repetidos de la extensión del navegador sobre envío de metadata, sin error propio de BRAMUlab.

## Resultados por sección del handoff

| Sección | Resultado | Evidencia |
| --- | --- | --- |
| 1. Entorno | PASS con límite de metadatos Vercel | Alias staging, estado exitoso del SHA esperado, bundle h14 y ref de backend Staging; ficha Vercel no accesible por 403. |
| 2. Sesión | PASS | Se reutilizó @sebas; autenticación segura en navegador. No se creó ni reseteó cuenta. |
| 3. Baseline | PASS | Home: Nivel 5.5 CALIBRANDO, 0/5 partidos, Efectividad —, Racha —, Partidos totales 0; Último partido vacío, actividad sin partidos. Historial Todos 0 / Mis partidos 0. |
| 4. Carga real | PASS con bug de selector | Cuatro cuentas existentes elegidas por resultados reales; formato Clásico · Punto de Oro; 20/09/2026, hora borrada, lugar QA B5 Work, 6–2 y 6–4. Un solo guardado. El selector rechazó una combinación de usuarios distintos con el mismo nombre visible; se continuó con otros usuarios existentes. |
| 5. Resultado inmediato | FAIL parcial | El resumen mostró cuatro participantes, marcador, lugar y PENDIENTE DE VALIDACIÓN, nunca VALIDADO/OFICIAL. Historial tuvo exactamente una fila y Home mostró Último partido. Sin embargo, Historial mostró «00:00» pese a haberse borrado la hora. |
| 6. Pendiente no computable | PASS para métricas observadas | Home mantuvo Nivel 5.5, CALIBRANDO 0/5, Efectividad —, Racha —, Partidos totales 0, sin actividad/forma reciente nueva ni mejor compañero/rival. El partido sí fue visible en Último partido e Historial. No se tomó baseline independiente de Ranking; su comparación exacta queda sin verificar en esta sesión. |
| 7. Navegación y refresh | FAIL parcial | Tras salir, volver a Home/Historial y recargar el Preview, persistió exactamente una fila pendiente con participantes, 6–2/6–4 y lugar en detalle, sin duplicado. La hora errónea «00:00» persistió en Historial. El detalle omitió la hora. |
| 8. Nota privada | PASS en sesión propia | Se escribió «QA B5 Work: nota privada de validación.»; persistió al salir, reabrir y recargar. No apareció en tarjeta de Home, fila de Historial, marcador ni participantes. Privacidad respecto de otra cuenta no comprobada. |
| 9. Ocultar para mí | PASS para vista propia | El botón visible «Eliminar partido» abrió confirmación «¿Ocultar este partido de tu historial?» y aclaró que sigue existiendo para otros participantes. El código del camino server-backed confirmado antes de actuar invoca hide_match_for_me; se pulsó «Ocultar». Home volvió a Último partido vacío; Historial pasó a Todos 0 / Mis partidos 0 y permaneció así tras refresh. No se borró el partido compartido. |

Participantes finales: @sebas y @claimb4h11 contra @sebastian_test_3_vila y @sebastian_test_2_vila. El resumen presentó el equipo ganador Sebastian / Prueba. **match_id:** no expuesto por la interfaz; no se consultó Supabase directamente para obtenerlo.

## Bugs reproducibles

### B5-WORK-01 — Distintos usuarios con nombre visible igual se tratan como jugador repetido

1. En Cargar partido, seleccionar a @claimb4h11 como compañero y @normalb4h11 como rival 1; ambos aparecen en búsqueda como «Prueba» con usernames distintos.
2. Seleccionar @claim_mualea_20 como rival 2, también «Prueba» con username distinto.
3. La pantalla avisa «Hay un jugador repetido en el partido». Sustituir rival 2 por @sebastian_test_2_vila conserva el aviso mientras los otros dos «Prueba» siguen elegidos.
4. Sustituir rival 1 por @sebastian_test_3_vila hace desaparecer el aviso y permite continuar.

Impacto: se bloquea la carga con identidades seleccionables de usernames distintos que comparten nombre visible. No se inspeccionaron sus player_id; esta es la conducta reproducida en la UI, sin atribuir causa interna definitiva. No se crearon identidades para evitar el bloqueo.

### B5-WORK-02 — Hora desconocida aparece como 00:00 en Historial

1. En «Fecha, hora y lugar», usar «Borrar hora»; el campo Hora quedó vacío.
2. Guardar el partido fechado 20/09/2026 con lugar QA B5 Work.
3. El resumen omite hora, pero la fila de Historial dice «20 de sept de 2026 · 00:00».
4. Recargar el Preview y volver a Historial: «00:00» persiste.

Impacto: se muestra una hora inventada para un partido cargado sin hora conocida. Por eso las secciones 5 y 7 no reciben PASS completo. No se inspeccionó directamente el flag almacenado en backend.

## Observaciones UX

- **UX REVIEW:** Home muestra el partido pendiente en «Último partido» con badge VICTORIA pero sin badge PENDIENTE DE VALIDACIÓN en esa tarjeta; Historial y detalle sí indican el estado. Puede sugerir que el resultado ya es oficial pese a no computarse.
- **UX REVIEW:** El botón del detalle dice «Eliminar partido» aunque en un partido server-backed aceptado abre la acción «Ocultar» solo para la cuenta actual. La confirmación explica correctamente el alcance, pero el texto inicial es ambiguo.
- **OK:** El resultado válido, estado pendiente en Historial/detalle, nota privada en detalle y Home sin métricas oficiales nuevas fueron claros.

## Pruebas opcionales y datos QA

- **Offline:** NO EJECUTADO — el navegador de Work no ofreció simulación offline fiable; no se fingió desconexión.
- **Segundo participante:** NO EJECUTADO — no había segunda sesión QA autenticada disponible; no se crearon ni resetearon cuentas.
- **Datos creados:** exactamente un partido compartido pendiente en Supabase Staging con fecha 20/09/2026, marcador 6–2/6–4, lugar QA B5 Work, los cuatro participantes indicados y nota privada en la vista de @sebas. Se ocultó solo para @sebas; queda como fixture QA para revisión/limpieza futura por el equipo con acceso autorizado. No se creó provisional ni cuenta.
- **Capturas:** se guardaron en Work vistas del resumen pendiente, Historial con «00:00» e Historial vacío tras ocultar; no se incorporaron imágenes al repositorio en este commit documental.

## Conclusión

**Bloque 5 requiere corrección/revisión antes de cierre de experiencia de navegador:** la carga y persistencia server-backed, la exclusión de métricas oficiales y el ocultamiento personal funcionan; quedan los fallos B5-WORK-01 y B5-WORK-02. No se implementaron correcciones en esta ronda.
